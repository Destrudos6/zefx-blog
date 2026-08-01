/**
 * 微信读书统计 API（Cloudflare Pages Function）
 *
 * 通过微信读书官方 Agent API Gateway 获取用户数据，token 从环境变量
 * WEREAD_TOKEN 读取（不落前端、不进代码库）。
 *
 * 用法：
 *   GET /api/stats-weread                → 书架 + 阅读统计（周/月/年/总）
 *   GET /api/stats-weread/book?bookId=   → 单本书详情 + 进度（见 stats-weread/book.ts）
 */

import { gateway, normalizeBook, normalizeStats } from './_weread-shared';

/** 聚合端点：书架 + 四种模式的阅读统计 */
export async function onRequestGet(context) {
  const { env } = context;

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
