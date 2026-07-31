import rss from '@astrojs/rss';
import { getAllPostsFromCollection } from '../data/content';
import { getSiteData } from '../data/backblaze';

// 手动解析 YYYY.MM.DD / YYYY-MM-DD 日期，统一按 UTC 零点处理，
// 避免 new Date(string) 在各引擎/时区下解析不一致导致 RSS pubDate 错位一天。
function parsePostDate(value) {
  if (!value) return new Date();
  const m = /^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/.exec(String(value));
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
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
