const MAX_PAGES = 10; // 最多拉取 10 页（1000 条讨论），防止意外死循环

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
  const owner = url.searchParams.get('owner') || '';
  const repo = url.searchParams.get('repo') || '';

  if (!owner || !repo) {
    return new Response(JSON.stringify({ error: 'Missing owner or repo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 参数格式校验：GitHub 用户名/仓库名只允许字母数字、点、下划线、连字符。
  // 防止非法字符触发额外的 API 请求消耗配额，也避免注入异常路径。
  if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
    return new Response(JSON.stringify({ error: 'Invalid owner or repo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 白名单校验：配置了 GITHUB_OWNER / GITHUB_REPO 时，只允许查询该仓库。
  // GitHub 用户名/仓库名大小写不敏感，统一转小写比较，避免因大小写不一致误拦截。
  const expectedOwner = (env.GITHUB_OWNER || '').trim().toLowerCase();
  const expectedRepo = (env.GITHUB_REPO || '').trim().toLowerCase();
  if (expectedOwner && owner.trim().toLowerCase() !== expectedOwner) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (expectedRepo && repo.trim().toLowerCase() !== expectedRepo) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'zefx-blog',
  };

  try {
    // 分页拉取全部讨论，避免超过 100 条时评论数被静默截断
    const all = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/discussions?per_page=100&page=${page}`, { headers });

      // 错误响应不设置 Cache-Control，避免把 GitHub 的错误结果缓存 5 分钟
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return new Response(JSON.stringify(errData), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const batch = await resp.json();
      if (!Array.isArray(batch)) {
        return new Response(JSON.stringify({ error: 'Unexpected response from GitHub' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      all.push(...batch);
      if (batch.length < 100) break;
    }

    return new Response(JSON.stringify(all), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
