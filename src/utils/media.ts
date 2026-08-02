import { isB2Enabled, getProxyUrl, getB2Prefix } from './config';

export function getMediaUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  if (isB2Enabled()) {
    const prefix = getB2Prefix();
    const fullPath = prefix ? `${prefix}/${cleanPath}` : cleanPath;
    return `${getProxyUrl()}/${fullPath}`;
  }

  return `/${cleanPath}`;
}

/**
 * 文章封面路径：文章自己的 coverImage 优先；缺失且关联项目时回退到项目封面
 * （与项目卡片/详情页同一路径规则：project.coverImage || projects/<slug>/cover.png）。
 * 返回原始路径（未 getMediaUrl），由调用方统一转换。
 */
export function getPostCoverPath(
  post: { coverImage?: string; project?: string } | null | undefined,
  projectMap?: Record<string, { coverImage?: string; slug: string }> | null,
): string | undefined {
  if (!post) return undefined;
  if (post.coverImage) return post.coverImage;
  if (post.project && projectMap?.[post.project]) {
    const proj = projectMap[post.project];
    return proj.coverImage || `projects/${proj.slug}/cover.png`;
  }
  return undefined;
}


