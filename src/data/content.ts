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
  coverImage?: string;
  project?: string;
  tags: string[];
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
  // 分类固定颜色：以 categories.json 为准，覆盖文章 frontmatter 里各自写的颜色；
  // categories.json 未收录的分类保留文章自己的颜色兜底
  const categories = await (await import('../data/backblaze')).getCategories();
  const catColorMap = Object.fromEntries(categories.map(c => [c.label, c]));
  return entries.map(entry => {
    const cat = catColorMap[entry.data.category];
    return {
      slug: entry.id,
      category: entry.data.category,
      categoryColor: cat?.color ?? entry.data.categoryColor,
      categoryTextColor: cat?.textColor ?? entry.data.categoryTextColor,
      date: entry.data.date,
      title: entry.data.title,
      excerpt: entry.data.excerpt,
      readTime: entry.data.readTime,
      comments: entry.data.comments,
      coverImage: entry.data.coverImage,
      project: entry.data.project,
      tags: entry.data.tags ?? [],
    };
  });
}

/**
 * 从 Content Collection 获取所有项目。
 * 只能在 .astro 文件的 frontmatter 中使用 (async 上下文)。
 */
export async function getAllProjects(): Promise<Project[]> {
  const { getCollection } = await import('astro:content');
  const entries = await getCollection('projects');
  return entries.map(entry => {
    return {
      slug: entry.id,
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

export async function getPostsPageData() {
  const [allPosts, allProjects, allCategories, siteDataResult] = await Promise.all([
    getAllPostsFromCollection(),
    getAllProjects(),
    (await import('../data/backblaze')).getCategories(),
    (await import('../data/backblaze')).getSiteData(),
  ]);

  const projectMap = Object.fromEntries(allProjects.map(p => [p.slug, p]));
  const siteData = siteDataResult.site;
  const postsTagline = siteData.postsTagline ?? '关于技术、生活、摄影和读书。不追热点,只写想写的。';

  const categoryLabels = [...new Set(allPosts.map(p => p.category))];
  const categories = [
    { label: '全部', count: allPosts.length, active: true },
    ...categoryLabels.map(label => ({
      label,
      count: allPosts.filter(p => p.category === label).length,
      active: false,
    })),
  ];
  const catMap = Object.fromEntries(allCategories.map(c => [c.slug, c.label]));
  catMap.all = '全部';

  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);

  return { allPosts, allProjects, projectMap, siteData, postsTagline, categories, catMap, totalPages };
}
