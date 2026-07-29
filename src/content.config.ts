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
      // 项目文章：路径含子目录（如 project-slug/posts/article.md）
      // 用 "project-name-article-name" 格式确保唯一且 URL 友好
      const hasSubDir = parts.length > 2 && parts.some(p => p === 'posts');
      if (hasSubDir) {
        return parts[0] + '-' + name;
      }
      return name;
    },
  }),
  schema: z.object({
    category: z.string(),
    categoryColor: z.string(),
    categoryTextColor: z.string().optional(),
    date: z.string(),
    title: z.string(),
    excerpt: z.string(),
    readTime: z.string(),
    comments: z.number(),
    coverImage: z.string().optional(),
    project: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/logs.json', base: './src/content' }),
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
