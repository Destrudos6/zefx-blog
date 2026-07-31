import rss from '@astrojs/rss';
import { getAllPostsFromCollection } from '../data/content';
import { getSiteData } from '../data/backblaze';

// 手动解析 YYYY.MM.DD[ HH:MM[:SS]] / YYYY-MM-DD 等格式，避免 new Date(string)
// 在各引擎/时区下解析不一致导致 RSS pubDate 错位一天。
// - 带时间部分：按东八区（无夏令时）解释 frontmatter 里写的本地时间，转成 UTC，
//   保证 RSS 阅读器显示的时刻与博客页面上的一致；
// - 纯日期：保持 UTC 零点，避免时间戳被减 8 小时退回前一天。
function parsePostDate(value) {
  if (!value) return new Date();
  const m = /^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(String(value));
  if (m) {
    if (m[4] === undefined) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - 8 * 3600 * 1000);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function GET(context) {
  const allPosts = await getAllPostsFromCollection();
  const siteData = (await getSiteData()).site;
  return rss({
    title: siteData.name,
    description: siteData.description,
    site: context.site || 'https://zefx.site',
    items: allPosts.map(post => ({
      title: post.title,
      pubDate: parsePostDate(post.date),
      description: post.excerpt,
      link: `/posts/${post.slug}`,
      categories: [post.category],
    })),
    customData: `<language>zh-cn</language>`,
  });
}
