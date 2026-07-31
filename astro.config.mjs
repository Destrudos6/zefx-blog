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

// https://astro.build/config
export default defineConfig({
  site: 'https://zefx.site',
  integrations: [sitemap()],
  markdown: {
    processor: satteri({ hastPlugins: [lazyImagesHastPlugin()] }),
  },
});
