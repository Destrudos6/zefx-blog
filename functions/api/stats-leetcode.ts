/**
 * LeetCode 统计 API（Cloudflare Pages Function）
 *
 * 通过 LeetCode 官方 GraphQL 接口获取用户统计，公开数据，无需 token。
 * 参考 https://github.com/JeremyTsaii/leetcode-stats-api 的接口用法。
 *
 * 用法：GET /api/stats-leetcode?username=<leetcode用户名>
 */

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

const STATS_QUERY = `
  query($username: String!) {
    matchedUser(username: $username) {
      username
      submissionCalendar
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
    allQuestionsCount {
      difficulty
      count
    }
  }
`;

export async function onRequestGet(context) {
  const { env, request } = context;

  const url = new URL(request.url);
  // 优先使用显式传入的 username，缺省时回退到环境变量 LEETCODE_USERNAME
  const username = (url.searchParams.get('username') || env.LEETCODE_USERNAME || '').trim();
  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing username (set LEETCODE_USERNAME or pass ?username=)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const resp = await fetch(LEETCODE_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'zefx-blog',
      },
      body: JSON.stringify({
        query: STATS_QUERY,
        variables: { username },
      }),
    });

    const data = await resp.json();

    if (!resp.ok || data.errors) {
      const msg = data.errors?.[0]?.message || 'LeetCode API error';
      return new Response(JSON.stringify({ error: msg }), {
        status: resp.status || 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const matched = data.data?.matchedUser;
    const totalQ = data.data?.allQuestionsCount;
    if (!matched || !totalQ) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 已解题数按难度
    const ac = (matched.submitStatsGlobal?.acSubmissionNum || []).reduce((m, x) => {
      m[x.difficulty.toLowerCase()] = x.count;
      return m;
    }, {});

    // 总题数按难度
    const all = (totalQ || []).reduce((m, x) => {
      m[x.difficulty.toLowerCase()] = x.count;
      return m;
    }, {});

    // 提交日历：字符串化的 {时间戳: 提交数}，解析为对象供前端渲染热力图
    let submissionCalendar = {};
    const raw = matched.submissionCalendar;
    if (raw) {
      try {
        submissionCalendar = JSON.parse(raw);
      } catch {
        submissionCalendar = {};
      }
    }

    return new Response(
      JSON.stringify({
        username: matched.username || username,
        totalSolved: ac.all ?? 0,
        totalQuestions: all.all ?? 0,
        easySolved: ac.easy ?? 0,
        mediumSolved: ac.medium ?? 0,
        hardSolved: ac.hard ?? 0,
        submissionCalendar,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          // 数据变动不频繁，缓存 1 小时
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
