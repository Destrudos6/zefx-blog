/**
 * 微信读书统计 API（Cloudflare Pages Function）
 *
 * 通过微信读书官方 Agent API Gateway 获取用户数据，token 从环境变量
 * WEREAD_TOKEN 读取（不落前端、不进代码库）。
 *
 * 用法：
 *   GET /api/stats-weread                    → 书架 + 阅读统计（周/月/年/总）
 *   GET /api/stats-weread/book?bookId=xxx    → 单本书详情 + 阅读进度
 */

const GATEWAY = 'https://i.weread.qq.com/api/agent/gateway';
const SKILL_VERSION = '1.0.4';
const TIMEOUT_MS = 15000;

/** 调用微信读书网关 */
async function gateway(env, apiName, params = {}) {
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
function normalizeBook(b) {
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
function normalizeStats(d) {
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

/** 聚合端点：书架 + 四种模式的阅读统计 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // 书籍详情端点
  if (url.pathname.endsWith('/book')) {
    const bookId = (url.searchParams.get('bookId') || '').trim();
    if (!bookId) {
      return new Response(JSON.stringify({ error: 'Missing bookId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    try {
      const [info, progress] = await Promise.all([
        gateway(env, '/book/info', { bookId }),
        gateway(env, '/book/getprogress', { bookId }),
      ]);
      const prog = progress.book || {};
      return new Response(
        JSON.stringify({
          bookId,
          info: {
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
          },
          progress: {
            progress: prog.progress == null ? null : prog.progress, // 0-100 整数
            recordReadingTime: prog.recordReadingTime || 0,
            finishTime: prog.finishTime || 0,
            updateTime: prog.updateTime || 0,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          },
        }
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status || 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 聚合端点：书架 + 统计
  try {
    const [shelf, weekly, monthly, annually, overall] = await Promise.all([
      gateway(env, '/shelf/sync'),
      gateway(env, '/readdata/detail', { mode: 'weekly' }),
      gateway(env, '/readdata/detail', { mode: 'monthly' }),
      gateway(env, '/readdata/detail', { mode: 'annually' }),
      gateway(env, '/readdata/detail', { mode: 'overall' }),
    ]);

    return new Response(
      JSON.stringify({
        books: (shelf.books || []).map(normalizeBook),
        albums: (shelf.albums || []).length,
        stats: {
          weekly: normalizeStats(weekly),
          monthly: normalizeStats(monthly),
          annually: normalizeStats(annually),
          overall: normalizeStats(overall),
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          // 数据变动不频繁，缓存 1 小时
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.status || 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
