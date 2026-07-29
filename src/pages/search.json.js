import { getAllPostsFromCollection, getAllProjects } from '../data/content';

export async function GET() {
  const [posts, projects] = await Promise.all([
    getAllPostsFromCollection(),
    getAllProjects(),
  ]);

  const projectMap = Object.fromEntries(projects.map(p => [p.slug, p]));

  const data = [
    ...posts.map(p => {
      const proj = p.project && projectMap[p.project]
        ? { title: projectMap[p.project].title, coverColor: projectMap[p.project].coverColor }
        : null;
      return {
        type: 'post',
        slug: p.slug,
        title: p.title,
        category: p.category,
        categoryColor: p.categoryColor,
        date: p.date,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
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
      coverImage: p.coverImage,
    })),
  ];

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
