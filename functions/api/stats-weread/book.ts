/**
 * 微信读书单本书详情端点（Cloudflare Pages Function）
 *
 * 对应路径 /api/stats-weread/book（独立文件才能被 Pages Functions 正确路由）。
 *
 * 用法：GET /api/stats-weread/book?bookId=xxx
 */

import { gateway, normalizeBookInfo } from '../_weread-shared';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
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
        info: normalizeBookInfo(info),
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
