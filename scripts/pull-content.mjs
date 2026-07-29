/**
 * 从 Backblaze B2 拉取内容到本地
 *
 * 在 astro build 之前运行：node scripts/pull-content.mjs
 * 仅在 USE_B2=true 时执行远程拉取
 *
 * 拉取的内容：
 *   - src/content/ 目录下的 Markdown 和 JSON 文件
 *   - public/ 目录下的媒体资源（图片等）
 *
 * 用法：
 *   node scripts/pull-content.mjs          # 根据 .env 自动判断
 *   node scripts/pull-content.mjs --force  # 强制拉取（忽略 USE_B2 设置）
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// 加载 .env 文件
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'src', 'content');
const PUBLIC_DIR = join(ROOT, 'public');

const USE_B2 = process.env.USE_B2 === 'true';
const B2_PROXY_URL = process.env.B2_PROXY_URL || '';
const B2_PREFIX = process.env.B2_PREFIX || '';
const FORCE = process.argv.includes('--force');

if (!USE_B2 && !FORCE) {
  console.log('[pull-content] USE_B2 is not enabled, skipping remote fetch.');
  console.log('[pull-content] Using local content from src/content/ and public/');
  process.exit(0);
}

if (!B2_PROXY_URL) {
  console.error('[pull-content] Error: B2_PROXY_URL is not set');
  process.exit(1);
}

console.log(`[pull-content] Fetching content from: ${B2_PROXY_URL}`);

/**
 * 从 B2 获取文件
 */
async function fetchFromB2(path) {
  const fullPath = B2_PREFIX ? `${B2_PREFIX}/${path}` : path;
  const url = `${B2_PROXY_URL}/${fullPath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }
  return response;
}

async function fetchText(path) {
  const response = await fetchFromB2(path);
  return response.text();
}

async function fetchBinary(path) {
  const response = await fetchFromB2(path);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * 确保目录存在
 */
async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

/**
 * 写入文件
 */
async function writeFileContent(filePath, content) {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content);
}

/**
 * 拉取单个文件
 */
async function pullFile(remotePath, localPath, isBinary = false) {
  try {
    const content = isBinary
      ? await fetchBinary(remotePath)
      : await fetchText(remotePath);
    await writeFileContent(localPath, content);
    console.log(`  ✓ ${remotePath}`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${remotePath}: ${err.message}`);
    return false;
  }
}

/**
 * 从 B2 获取内容索引并下载所有内容
 */
async function pullAllContent() {
  // 尝试获取内容索引
  const indexPath = B2_PREFIX ? `${B2_PREFIX}/content-index.json` : 'content-index.json';
  const indexUrl = `${B2_PROXY_URL}/${indexPath}`;

  let contentIndex;
  try {
    const response = await fetch(indexUrl);
    if (!response.ok) {
      console.log('[pull-content] No content-index.json found, using default structure...');
      await pullDefaultStructure();
      return;
    }
    contentIndex = await response.json();
  } catch (err) {
    console.log('[pull-content] Failed to fetch content-index.json, using default structure...');
    await pullDefaultStructure();
    return;
  }

  console.log(`[pull-content] Found content index`);

  // 拉取内容文件（Markdown、JSON）
  if (contentIndex.content) {
    console.log(`[pull-content] Pulling ${contentIndex.content.length} content files...`);
    for (const file of contentIndex.content) {
      const remotePath = typeof file === 'string' ? file : file.path;
      const isBinary = typeof file === 'object' && file.type === 'binary';
      const localPath = join(CONTENT_DIR, remotePath);
      await pullFile(remotePath, localPath, isBinary);
    }
  }

  // 拉取媒体资源
  if (contentIndex.media) {
    console.log(`[pull-content] Pulling ${contentIndex.media.length} media files...`);
    for (const file of contentIndex.media) {
      const remotePath = typeof file === 'string' ? file : file.path;
      const isBinary = typeof file === 'object' && file.type === 'binary';
      const localPath = join(PUBLIC_DIR, remotePath);
      await pullFile(remotePath, localPath, isBinary);
    }
  }
}

/**
 * 使用默认目录结构拉取内容
 * 假设 B2 存储桶中的目录结构与本地一致
 */
async function pullDefaultStructure() {
  const textExtensions = ['.md', '.json', '.css', '.js', '.html', '.svg', '.txt'];
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf'];

  // 拉取内容目录
  const contentDirs = ['posts', 'projects'];
  for (const dir of contentDirs) {
    try {
      // 尝试获取目录索引
      const indexContent = await fetchText(`${dir}/index.json`);
      const items = JSON.parse(indexContent);

      for (const item of items) {
        if (item.contentPath) {
          await pullFile(item.contentPath, join(CONTENT_DIR, item.contentPath), false);
        }
        if (item.metaPath) {
          await pullFile(item.metaPath, join(CONTENT_DIR, item.metaPath), false);
        }
      }
    } catch (err) {
      console.log(`  - Skipping ${dir}: ${err.message}`);
    }
  }

  // 拉取媒体资源目录
  const mediaDirs = ['posts/coverimage', 'posts/illustration', 'projects'];
  for (const dir of mediaDirs) {
    try {
      const indexContent = await fetchText(`${dir}/index.json`);
      const items = JSON.parse(indexContent);

      for (const item of items) {
        const ext = item.path.split('.').pop()?.toLowerCase();
        const isBinary = binaryExtensions.some(e => item.path.endsWith(e));
        await pullFile(item.path, join(PUBLIC_DIR, item.path), isBinary);
      }
    } catch (err) {
      console.log(`  - Skipping media ${dir}: ${err.message}`);
    }
  }
}

// 执行拉取
try {
  console.log('[pull-content] Starting content pull from B2...');
  await pullAllContent();
  console.log('[pull-content] Done!');
} catch (err) {
  console.error('[pull-content] Error:', err);
  process.exit(1);
}
