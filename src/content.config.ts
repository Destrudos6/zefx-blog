import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content',
    generateId({ entry }) {
      const parts = entry.split('/');
      const name = parts[parts.length - 1].replace(/\.md$/, '');
      const hasSubDir = parts.length > 2 && parts.some(p => p === 'posts');
      if (hasSubDir) {
        const postsIdx = parts.indexOf('posts');
        return parts[postsIdx - 1] + '-' + name;
      }
      return name;
    },
  }),
  schema: z.object({
    category: z.string(),
    // 分类颜色已由 categories.json 统一决定，frontmatter 不再必填；缺失时用默认蓝兜底
    categoryColor: z.string().default('var(--blue)'),
    categoryTextColor: z.string().optional(),
    date: z.string(),
    title: z.string(),
    excerpt: z.string(),
    readTime: z.string(),
    comments: z.number(),
    coverImage: z.string().optional(),
    project: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({
    pattern: '**/logs.json',
    base: './src/content',
    generateId({ entry }) {
      const parts = entry.split('/');
      return parts[parts.length - 2];
    },
  }),
  schema: z.object({
    title: z.string(),
    status: z.enum(['active', 'done', 'pause']),
    statusLabel: z.string(),
    description: z.string(),
    coverColor: z.string(),
    coverImage: z.string().optional(),
    tags: z.array(z.string()),
    logs: z.array(z.object({
      date: z.string(),
      text: z.string(),
    })).default([]),
  }),
});

export const collections = { posts, projects };
