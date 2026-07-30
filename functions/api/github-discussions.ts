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

  const ghUrl = `https://api.github.com/repos/${owner}/${repo}/discussions?per_page=100`;

  try {
    const resp = await fetch(ghUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'zefx-blog',
      },
    });

    const data = await resp.json();

    return new Response(JSON.stringify(data), {
      status: resp.status,
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
