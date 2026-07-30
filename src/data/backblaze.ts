/**
 * Backblaze B2 数据加载器
 *
 * 通过 Cloudflare Worker 代理从私有 B2 存储桶获取数据。
 * 通过环境变量 USE_B2 控制是否启用远程拉取：
 *   - USE_B2=true: 从 B2 拉取所有数据
 *   - USE_B2=false (默认): 使用本地 JSON 文件（开发模式）
 *
 * 部署到 Cloudflare Pages 时，在项目设置中配置 USE_B2=true
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// 使用 process.cwd() 定位数据目录，因为构建后 __dirname 会变化
const DATA_DIR = resolve(process.cwd(), 'src', 'data');

export interface FriendLink {
  name: string;
  color: string;
  desc?: string;
  url?: string;
}

export interface TickerItem {
  text: string;
  highlight?: string;
}

export interface AboutData {
  name: string;
  bio: string;
  bioLong: string;
  facts: string[];
  stats: { count: number; unit: string }[];
  timeline: { date: string; title: string; text: string }[];
}

export interface CategoryDef {
  label: string;
  slug: string;
  color: string;
  textColor?: string;
}

export interface SiteData {
  site: {
    name: string;
    description: string;
    copyright: string;
    avatar?: string;
    favicon?: string;
    navItems: { href: string; label: string }[];
    footerNav: { href: string; label: string }[];
    categories: { href: string; label: string }[];
    elsewhere: { href: string; label: string }[];
    hero: {
      ghost: string;
      metaChips: { text: string; variant?: string; id?: string }[];
      title: string;
      subtitle: string;
      tagline: string;
      stickers: string[];
    };
    subscribe: {
      kicker: string;
      title: string;
      copy: string;
      label: string;
      placeholder: string;
      btnText: string;
      note: string;
    };
    searchPlaceholder: string;
    postsTagline?: string;
    github: {
      owner: string;
      repo: string;
    };
    giscus?: {
      repo: string;
      repoId: string;
      category: string;
      categoryId: string;
      mapping?: string;
      strict?: string;
      reactionsEnabled?: string;
      inputPosition?: string;
      theme?: string;
      themeDark?: string;
      lang?: string;
    };
  };
}

export interface HotPost {
  slug: string;
  title: string;
  category: string;
  categoryColor: string;
  categoryTextColor?: string;
  excerpt: string;
  coverColor: string;
  coverImage?: string;
  project?: { title: string; coverColor: string } | null;
}

// ============================================================
// 环境变量读取
// ============================================================

const USE_B2 = import.meta.env.USE_B2 === 'true' || import.meta.env.USE_B2 === true;
const B2_PROXY_URL = import.meta.env.B2_PROXY_URL || '';
const B2_BUCKET_NAME = import.meta.env.B2_BUCKET_NAME || '';
const B2_PREFIX = import.meta.env.B2_PREFIX || '';

// ============================================================
// B2 远程数据获取
// ============================================================

/**
 * 从 B2 存储桶获取 JSON 数据
 * @param path 文件路径（相对于存储桶根目录或 B2_PREFIX）
 */
async function fetchJSONFromB2<T>(path: string): Promise<T> {
  const fullPath = B2_PREFIX ? `${B2_PREFIX}/${path}` : path;
  const url = `${B2_PROXY_URL}/${fullPath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path} from B2: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * 从 B2 存储桶获取文本数据（Markdown 等）
 * @param path 文件路径
 */
async function fetchTextFromB2(path: string): Promise<string> {
  const fullPath = B2_PREFIX ? `${B2_PREFIX}/${path}` : path;
  const url = `${B2_PROXY_URL}/${fullPath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path} from B2: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

// ============================================================
// 本地 JSON 文件加载（开发模式 fallback）
// ============================================================

async function loadLocalJSON<T>(fileName: string): Promise<T> {
  const filePath = resolve(DATA_DIR, fileName);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

// ============================================================
// 统一数据获取接口
// ============================================================

async function getData<T>(b2Path: string, localFileName: string): Promise<T> {
  if (USE_B2 && B2_PROXY_URL) {
    return fetchJSONFromB2<T>(b2Path);
  }
  return loadLocalJSON<T>(localFileName);
}

// ============================================================
// 公开 API
// ============================================================

export async function getFriendLinks(): Promise<FriendLink[]> {
  return getData<FriendLink[]>('data/friends.json', 'friends.json');
}

export async function getTickerItems(): Promise<TickerItem[]> {
  return getData<TickerItem[]>('data/ticker.json', 'ticker.json');
}

let _aboutDataCache: AboutData | null = null;

export async function getAboutData(): Promise<AboutData> {
  if (_aboutDataCache) return _aboutDataCache;

  const data = await getData<AboutData>('data/about.json', 'about.json');

  const { getAllPostsFromCollection, getAllProjects } = await import('./content');
  const [allPosts, allProjects] = await Promise.all([
    getAllPostsFromCollection(),
    getAllProjects(),
  ]);

  const articleCount = allPosts.length;
  const projectCount = allProjects.length;
  const startDate = new Date('2026-07-28');
  const daysRunning = Math.floor((Date.now() - startDate.getTime()) / 86400000);

  const result: AboutData = {
    ...data,
    stats: [
      { count: articleCount, unit: '篇文章' },
      { count: daysRunning, unit: '天网站运行' },
      { count: projectCount, unit: '个项目' },
      { count: 0, unit: '元赞助' },
    ],
  };

  _aboutDataCache = result;
  return result;
}

let _siteDataCache: SiteData | null = null;

export async function getSiteData(): Promise<SiteData> {
  if (_siteDataCache) return _siteDataCache;

  const data = await getData<SiteData>('data/site.json', 'site.json');

  const { getAllPostsFromCollection } = await import('./content');
  const allPosts = await getAllPostsFromCollection();
  const issue = allPosts.length;

  const result = structuredClone(data);
  if (result.site.hero?.metaChips) {
    result.site.hero.metaChips = result.site.hero.metaChips.map(chip => ({
      ...chip,
      text: chip.text.replace(/\{\{issue\}\}/g, String(issue)),
    }));
  }

  _siteDataCache = result;
  return result;
}

export async function getCategories(): Promise<CategoryDef[]> {
  return getData<CategoryDef[]>('data/categories.json', 'categories.json');
}

// ============================================================
// Markdown 内容获取（用于从 B2 拉取文章）
// ============================================================

/**
 * 获取 B2 代理的基础 URL（用于构建媒体资源 URL）
 */
export function getB2ProxyUrl(): string {
  return B2_PROXY_URL;
}
