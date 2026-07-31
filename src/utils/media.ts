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

