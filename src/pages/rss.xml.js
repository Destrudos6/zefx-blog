import rss from '@astrojs/rss';
import { getAllPostsFromCollection } from '../data/content';

export async function GET(context) {
  const allPosts = await getAllPostsFromCollection();
  return rss({
    title: 'ZEFX · 个人博客',
    description: '一叶个人的互联网扁舟。关于技术、生活、摄影和读书。',
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
