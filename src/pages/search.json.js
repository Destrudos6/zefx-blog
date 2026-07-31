import { getAllProjects } from '../data/content';
import { getMediaUrl } from '../utils/media';
import { getCollection } from 'astro:content';

export async function GET() {
  const [posts, projects] = await Promise.all([
    getCollection('posts'),
    getAllProjects(),
  ]);

  const projectMap = Object.fromEntries(projects.map(p => [p.slug, p]));

  const data = [
    ...posts.map(p => {
      const proj = p.data.project && projectMap[p.data.project]
        ? { title: projectMap[p.data.project].title, coverColor: projectMap[p.data.project].coverColor }
        : null;
      return {
        type: 'post',
        slug: p.id,
        title: p.data.title,
        category: p.data.category,
        categoryColor: p.data.categoryColor,
        date: p.data.date,
        excerpt: p.data.excerpt,
        content: (p.body || '').replace(/\r\n/g, '\n').slice(0, 20000),
        coverImage: p.data.coverImage ? getMediaUrl(p.data.coverImage) : null,
        project: proj,
      };
    }),
    ...projects.map(p => ({
      type: 'project',
      slug: p.slug,
      title: p.title,
      description: p.description,
      tags: p.tags,
      status: p.status,
      statusLabel: p.statusLabel,
      coverImage: getMediaUrl(`projects/${p.slug}/cover.png`),
    })),
  ];

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
