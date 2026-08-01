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
    const [info, progress, best, reviewsResp] = await Promise.all([
      gateway(env, '/book/info', { bookId }),
      gateway(env, '/book/getprogress', { bookId }),
      gateway(env, '/book/bestbookmarks', { bookId }),
      gateway(env, '/review/list', { bookId, count: 10 }),
    ]);
    const prog = progress.book || {};

    // 热门划线：固定前 20 条，展示前 5 条
    const highlights = (best.items || []).slice(0, 5).map((it) => ({
      text: it.markText || '',
      count: it.totalCount || 0,
      chapter: it.chapterUid != null ? it.chapterUid : null,
    }));

    // 公开点评：取前 5 条
    const reviews = (reviewsResp.reviews || []).slice(0, 5).map((r) => {
      const rv = (r.review && r.review.review) || {};
      const au = rv.author || {};
      return {
        name: au.name || '匿名',
        avatar: au.avatar || '',
        star: rv.star || 0,
        isFinish: !!rv.isFinish,
        content: (rv.content || '').slice(0, 400),
        createTime: rv.createTime || 0,
      };
    });

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
        highlights,
        reviews,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=14400, s-maxage=14400',
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
