/**
 * 微信读书共享逻辑（非路由文件，`_` 前缀不会被 Pages Functions 暴露为端点）
 *
 * 提供微信读书网关调用与数据规范化函数，供以下端点共用：
 *   functions/api/stats-weread.ts        → /api/stats-weread
 *   functions/api/stats-weread/book.ts   → /api/stats-weread/book
 */

const GATEWAY = 'https://i.weread.qq.com/api/agent/gateway';
const SKILL_VERSION = '1.0.4';
const TIMEOUT_MS = 15000;

/** 调用微信读书网关；token 从环境变量 WEREAD_TOKEN 读取 */
export async function gateway(env, apiName, params = {}) {
  const token = env.WEREAD_TOKEN;
  if (!token) {
    const err = new Error('WEREAD_TOKEN 未配置');
    err.status = 503;
    throw err;
  }
  const resp = await fetch(GATEWAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + String(token).trim(),
    },
    body: JSON.stringify({ api_name: apiName, skill_version: SKILL_VERSION, ...params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || (data && data.errcode && data.errcode !== 0)) {
    const msg = (data && (data.message || data.errmsg || data.errcode_msg)) || ('HTTP ' + resp.status);
    const err = new Error(msg);
    err.status = resp.status || 502;
    throw err;
  }
  return data || {};
}

/** 书架中的书 → 前端所需字段 */
export function normalizeBook(b) {
  return {
    bookId: b.bookId,
    title: b.title,
    author: b.author || '',
    category: b.category || '',
    cover: b.cover || '',
    finishReading: b.finishReading === 1, // 已读完
    secret: b.secret === 1,
    isTop: b.isTop === 1,
    readUpdateTime: b.readUpdateTime || 0,
  };
}

/** 阅读统计 → 前端所需字段 */
export function normalizeStats(d) {
  return {
    readDays: d.readDays || 0,
    totalReadTime: d.totalReadTime || 0,
    dayAverageReadTime: d.dayAverageReadTime || 0,
    compare: d.compare == null ? null : d.compare,
    readStat: d.readStat || [],
    readLongest: d.readLongest || [],
    readTimes: d.dailyReadTimes || d.readTimes || {},
    preferCategory: d.preferCategory || [],
    preferTime: d.preferTime || [],
    readRate: d.readRate == null ? null : d.readRate,
    wrReadTime: d.wrReadTime || 0,
    wrListenTime: d.wrListenTime || 0,
    preferAuthor: d.preferAuthor || [],
    preferPublisher: d.preferPublisher || [],
    rank: d.rank || null,
  };
}

/** 书籍详情 → 前端所需字段 */
export function normalizeBookInfo(info) {
  return {
    title: info.title,
    author: info.author || '',
    translator: info.translator || '',
    publisher: info.publisher || '',
    cover: info.cover || '',
    intro: info.intro || '',
    category: info.category || '',
    isbn: info.isbn || '',
    wordCount: info.wordCount || 0,
    newRating: info.newRating || 0,
    newRatingCount: info.newRatingCount || 0,
    publishTime: info.publishTime || '',
    deepLink: info.deepLink || '',
  };
}
