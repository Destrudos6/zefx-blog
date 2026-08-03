// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';

// 给 markdown 正文中的 <img> 注入懒加载属性（构建时处理，无需客户端 JS）
function lazyImagesHastPlugin() {
  return {
    name: 'lazy-images',
    element: {
      filter: ['img'],
      visit(node, ctx) {
        if (!node.properties?.loading) {
          ctx.setProperty(node, 'loading', 'lazy');
          ctx.setProperty(node, 'decoding', 'async');
        }
      },
    },
  };
}

// 高亮标记 ==text== → <mark>text</mark>（构建时处理，无需客户端 JS）
function markHighlightHastPlugin() {
  return {
    name: 'mark-highlight',
    text(node, ctx) {
      const value = node.value || '';
      if (!value.includes('==')) return;
      const parts = value.split(/==([^=]+)==/g);
      // split 带捕获组：奇数索引是 == 包裹的高亮内容，偶数索引是普通文本
      if (parts.length === 1) return;
      const nodes = [];
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        if (!seg) continue;
        if (i % 2 === 1) {
          nodes.push({
            type: 'element',
            tagName: 'mark',
            properties: {},
            children: [{ type: 'text', value: seg }],
          });
        } else {
          nodes.push({ type: 'text', value: seg });
        }
      }
      ctx.insertBefore(node, nodes);
      ctx.removeNode(node);
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://zefx.site',
  integrations: [sitemap()],
  markdown: {
    processor: satteri({
      hastPlugins: [lazyImagesHastPlugin(), markHighlightHastPlugin()],
    }),
  },
});
