/**
 * 共享的 GitHub Discussions 评论数据获取（客户端）。
 * 同一页面内多次调用共享同一个 Promise，避免重复请求 /api/github-discussions。
 */

let cached: Promise<unknown> | null = null;

export function getDiscussions(owner: string, repo: string): Promise<any[]> {
  if (!cached) {
    cached = fetch(`/api/github-discussions?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return cached as Promise<any[]>;
}
