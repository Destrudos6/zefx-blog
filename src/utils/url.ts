/**
 * URL 工具函数。
 */

/** 从友链 URL 安全提取域名；无效 URL 返回空串（不显示 favicon） */
export function safeHost(url?: string): string {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
