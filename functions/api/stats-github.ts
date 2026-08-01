/**
 * GitHub 贡献日历 API（Cloudflare Pages Function）
 *
 * 通过 GitHub GraphQL API 查询指定用户的最近一年贡献日历，
 * 复用现有的 GITHUB_TOKEN 环境变量（与评论数接口共用，避免多个 token）。
 *
 * 用法：GET /api/stats-github?username=<github用户名>
 */

const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

const CALENDAR_QUERY = `
  query($username: String!) {
    user(login: $username) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              weekday
            }
          }
        }
      }
    }
  }
`;

export async function onRequestGet(context) {
  const { env, request } = context;

  const token = env.GITHUB_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const username = (url.searchParams.get('username') || '').trim();
  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing username' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const resp = await fetch(GITHUB_GRAPHQL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'zefx-blog',
      },
      body: JSON.stringify({
        query: CALENDAR_QUERY,
        variables: { username },
      }),
    });

    const data = await resp.json();

    if (!resp.ok || data.errors) {
      const msg = data.errors?.[0]?.message || data.message || 'GitHub API error';
      return new Response(JSON.stringify({ error: msg }), {
        status: resp.status || 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cal = data.data?.user?.contributionsCollection?.contributionCalendar;
    if (!cal) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 规范化为 53 周 × 7 天的贡献矩阵
    const weeks = cal.weeks.map(w => w.contributionDays.map(d => d.contributionCount));

    return new Response(
      JSON.stringify({
        username,
        totalContributions: cal.totalContributions,
        weeks,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          // 贡献数据按天更新，缓存 1 小时降低 GraphQL 配额消耗
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
