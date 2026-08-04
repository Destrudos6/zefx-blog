import { getAllProjects } from '../data/content';
import { getMediaUrl, getPostCoverPath } from '../utils/media';
import { getCollection } from 'astro:content';
import { getCategories } from '../data/backblaze';

export async function GET() {
  const [posts, projects, categories] = await Promise.all([
    getCollection('posts'),
    getAllProjects(),
    getCategories(),
  ]);

  const projectMap = Object.fromEntries(projects.map(p => [p.slug, p]));
  const catColorMap = Object.fromEntries(categories.map(c => [c.label, c]));

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
        categoryColor: catColorMap[p.data.category]?.color ?? p.data.categoryColor,
        date: p.data.date,
        excerpt: p.data.excerpt,
        content: (p.body || '').replace(/\r\n/g, '\n').slice(0, 5000),
        coverImage: getPostCoverPath(p.data, projectMap) ? getMediaUrl(getPostCoverPath(p.data, projectMap)) : null,
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
