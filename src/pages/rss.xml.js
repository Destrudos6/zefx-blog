import rss from '@astrojs/rss';
import { getAllPostsFromCollection } from '../data/content';
import { getSiteData } from '../data/backblaze';

export async function GET(context) {
  const allPosts = await getAllPostsFromCollection();
  const siteData = (await getSiteData()).site;
  return rss({
    title: siteData.name,
    description: siteData.description,
    site: context.site || 'https://zefx.site',
    items: allPosts.map(post => ({
      title: post.title,
      pubDate: new Date(post.date),
      description: post.excerpt,
      link: `/posts/${post.slug}`,
      categories: [post.category],
    })),
    customData: `<language>zh-cn</language>`,
  });
}
