/**
 * 媒体 URL 工具函数
 *
 * 当启用 B2 时，将本地路径转换为 B2 代理 URL
 * 本地开发时，保持使用 public/ 目录下的路径
 */

const USE_B2 = import.meta.env.USE_B2 === 'true' || import.meta.env.USE_B2 === true;
const B2_PROXY_URL = import.meta.env.B2_PROXY_URL || '';
const B2_PREFIX = import.meta.env.B2_PREFIX || '';

/**
 * 获取完整的媒体资源 URL
 * @param path 资源路径，例如 "posts/coverimage/test-cover.png"
 * @returns 完整的 URL
 *
 * 示例：
 *   - 本地开发: /posts/coverimage/test-cover.png
 *   - B2 模式: https://your-worker.workers.dev/posts/coverimage/test-cover.png
 */
export function getMediaUrl(path: string): string {
  // 如果已经是完整 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // 移除开头的 / 以便拼接
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  if (USE_B2 && B2_PROXY_URL) {
    const fullPath = B2_PREFIX ? `${B2_PREFIX}/${cleanPath}` : cleanPath;
    return `${B2_PROXY_URL}/${fullPath}`;
  }

  return `/${cleanPath}`;
}

/**
 * 检查是否启用了 B2 远程数据
 */
export function isUsingB2(): boolean {
  return USE_B2 && !!B2_PROXY_URL;
}
