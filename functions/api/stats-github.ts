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
      repositories(first: 12, privacy: PUBLIC, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          name
          description
          url
          primaryLanguage { name }
          stargazerCount
          forkCount
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
  // 优先使用显式传入的 username，缺省时回退到环境变量 GITHUB_OWNER（与评论数接口共用的用户名配置）
  const username = (url.searchParams.get('username') || env.GITHUB_OWNER || '').trim();
  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing username (set GITHUB_OWNER or pass ?username=)' }), {
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

    // 规范化为 53 周 × 7 天的贡献矩阵，保留每周起始日期供前端渲染月份/年份标签
    // 防御：contributionDays 缺失时兜底为空数组，保证 days 恒为数组
    const weeks = cal.weeks.map(w => {
      const days = (w.contributionDays || []).map(d => d.contributionCount);
      return {
        date: (w.contributionDays && w.contributionDays[0]?.date) || null,
        days,
      };
    });

    // 公开仓库列表（按最近更新排序，供前端展示与跳转）
    const repos = (data.data?.user?.repositories?.nodes || []).map(r => ({
      name: r.name,
      description: r.description || '',
      url: r.url,
      language: r.primaryLanguage?.name || '',
      stars: r.stargazerCount || 0,
      forks: r.forkCount || 0,
    }));

    return new Response(
      JSON.stringify({
        username,
        totalContributions: cal.totalContributions,
        weeks,
        repos,
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
