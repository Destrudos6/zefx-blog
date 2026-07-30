/**
 * 生成本地 content-index.json 模板
 *
 * 扫描 src/content/ 和 public/ 目录，生成索引文件。
 * 你可以把这个索引文件上传到 B2 桶根目录。
 *
 * 用法：
 *   node scripts/generate-index.mjs              # 输出到控制台
 *   node scripts/generate-index.mjs --write       # 写入 content-index.json
 *   node scripts/generate-index.mjs --upload      # 同时输出 B2 上传用的格式
 */

import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'src', 'content');
const PUBLIC_DIR = join(ROOT, 'public');

const WRITE = process.argv.includes('--write');
const UPLOAD_FORMAT = process.argv.includes('--upload');

// 需要忽略的文件/目录
const IGNORE = [
  '.astro',
  'node_modules',
  '.DS_Store',
  'giscus-light.css',
  'giscus-dark.css',
  'Avatar.png',
  'favicon.ico',
];

/**
 * 递归扫描目录，返回所有文件路径
 */
async function scanDir(dir, baseDir) {
  const results = [];
  const entries = await readdir(dir);

  for (const entry of entries) {
    if (IGNORE.some(i => entry.includes(i))) continue;

    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      results.push(...await scanDir(fullPath, baseDir));
    } else {
      const relPath = relative(baseDir, fullPath).split('\\').join('/');
      results.push(relPath);
    }
  }

  return results;
}

/**
 * 判断是否为二进制文件
 */
function isBinary(filePath) {
  const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf'];
  return binaryExts.some(ext => filePath.toLowerCase().endsWith(ext));
}

// 生成索引
async function generateIndex() {
  console.log('[generate-index] Scanning directories...\n');

  // 扫描内容文件
  const contentFiles = await scanDir(CONTENT_DIR, CONTENT_DIR);
  console.log(`Found ${contentFiles.length} content files:`);
  contentFiles.forEach(f => console.log(`  ${f}`));

  // 扫描媒体文件
  const mediaFiles = await scanDir(PUBLIC_DIR, PUBLIC_DIR);
  console.log(`\nFound ${mediaFiles.length} media files:`);
  mediaFiles.forEach(f => console.log(`  ${f}`));

  // 构建索引对象
  const index = {
    generated: new Date().toISOString(),
    content: contentFiles.map(path => ({
      path,
      type: isBinary(path) ? 'binary' : 'text',
    })),
    media: mediaFiles.map(path => ({
      path,
      type: isBinary(path) ? 'binary' : 'text',
    })),
  };

  const jsonOutput = JSON.stringify(index, null, 2);

  if (WRITE) {
    const outputPath = join(ROOT, 'content-index.json');
    await writeFile(outputPath, jsonOutput);
    console.log(`\n[generate-index] Written to ${outputPath}`);
  }

  if (UPLOAD_FORMAT) {
    console.log('\n\n=== B2 UPLOAD FORMAT ===');
    console.log('Upload this file to your B2 bucket root as: content-index.json');
    console.log('\nOr if using B2_PREFIX (e.g. "zefx-data"), upload to: zefx-data/content-index.json');
    console.log('\n=== JSON CONTENT ===');
  }

  console.log(jsonOutput);
}

generateIndex().catch(err => {
  console.error('[generate-index] Error:', err);
  process.exit(1);
});
