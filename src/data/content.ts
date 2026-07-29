export interface Post {
  slug: string;
  category: string;
  categoryColor: string;
  categoryTextColor?: string;
  date: string;
  title: string;
  excerpt: string;
  readTime: string;
  comments: number;
  project?: string;
}

export interface ProjectLog {
  date: string;
  text: string;
}

export interface Project {
  slug: string;
  title: string;
  status: 'active' | 'done' | 'pause';
  statusLabel: string;
  description: string;
  logs: ProjectLog[];
  tags: string[];
  coverColor: string;
  coverImage?: string;
}

/** 从 entry.id 提取 slug（与 [slug].astro 路由一致） */

/**
 * 从 Content Collection 获取所有文章并转换为 Post[] 格式。
 * 只能在 .astro 文件的 frontmatter 中使用 (async 上下文)。
 */
export async function getAllPostsFromCollection(): Promise<Post[]> {
  const { getCollection } = await import('astro:content');
  const entries = await getCollection('posts');
  entries.sort((a, b) => {
    const da = a.data.date || '';
    const db = b.data.date || '';
    return db.localeCompare(da);
  });
  return entries.map(entry => ({
    slug: entry.id,
    category: entry.data.category,
    categoryColor: entry.data.categoryColor,
    categoryTextColor: entry.data.categoryTextColor,
    date: entry.data.date,
    title: entry.data.title,
    excerpt: entry.data.excerpt,
    readTime: entry.data.readTime,
    comments: entry.data.comments,
    coverImage: entry.data.coverImage,
    project: entry.data.project,
  }));
}

/**
 * 从 Content Collection 获取所有项目。
 * 只能在 .astro 文件的 frontmatter 中使用 (async 上下文)。
 */
export async function getAllProjects(): Promise<Project[]> {
  const { getCollection } = await import('astro:content');
  const entries = await getCollection('projects');
  return entries.map(entry => {
    // entry.id 形如 "blog-rebuild/logs" → slug 取第一段
    const slug = entry.id.split('/')[0];
    return {
      slug,
      title: entry.data.title,
      status: entry.data.status,
      statusLabel: entry.data.statusLabel,
      description: entry.data.description,
      coverColor: entry.data.coverColor,
      coverImage: entry.data.coverImage,
      tags: entry.data.tags,
      logs: entry.data.logs,
    };
  });
}

export const POSTS_PER_PAGE = 8;

export async function getProjectPosts(projectSlug: string) {
  const allPosts = await getAllPostsFromCollection();
  return allPosts.filter(p => p.project === projectSlug);
}
