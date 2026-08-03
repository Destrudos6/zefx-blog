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
// 用 element 访问器而非 text：==...== 内部若含内联元素（如 `code`、链接），
// 会被解析成多个 text 节点，逐节点匹配会漏掉；这里按块级容器整体重建子节点。
function markHighlightHastPlugin() {
  // 行内内容直接作为子节点的块级容器
  const inlineContainers = ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dd', 'dt', 'figcaption'];
  return {
    name: 'mark-highlight',
    element: {
      filter: inlineContainers,
      visit(node, ctx) {
        const children = node.children ?? [];
        if (!children.some((c) => c.type === 'text' && c.value.includes('=='))) return;

        // 合并相邻文本节点，内联元素节点保留为独立段
        const segs = [];
        for (const child of children) {
          if (child.type === 'text') {
            const last = segs[segs.length - 1];
            if (last && last.kind === 'text') last.node.value += child.value;
            else segs.push({ kind: 'text', node: child });
          } else {
            segs.push({ kind: 'element', node: child });
          }
        }

        // 虚拟文本流：文本值 + 每个内联元素一个占位符，让 ==...== 可跨内联元素匹配
        const starts = new Array(segs.length);
        let stream = '';
        for (let i = 0; i < segs.length; i++) {
          starts[i] = stream.length;
          stream += segs[i].kind === 'text' ? segs[i].node.value : '\u0000';
        }

        // 按流偏移 [from, to) 切出节点：文本段按需切片，元素段整体保留
        const slice = (from, to) => {
          const out = [];
          for (let i = 0; i < segs.length; i++) {
            const s = starts[i];
            const len = segs[i].kind === 'text' ? segs[i].node.value.length : 1;
            const e = s + len;
            if (e <= from || s >= to) continue;
            if (segs[i].kind === 'text') {
              const a = Math.max(from, s) - s;
              const b = Math.min(to, e) - s;
              if (b > a) out.push({ type: 'text', value: segs[i].node.value.slice(a, b) });
            } else {
              out.push(segs[i].node);
            }
          }
          return out;
        };

        const out = [];
        let cursor = 0;
        let matched = false;
        const re = /==([^=]+)==/g;
        let m;
        while ((m = re.exec(stream)) !== null) {
          matched = true;
          const spanStart = m.index;
          const spanEnd = re.lastIndex;
          out.push(...slice(cursor, spanStart)); // 高亮前的普通内容
          out.push({
            type: 'element',
            tagName: 'mark',
            properties: {},
            children: slice(spanStart + 2, spanEnd - 2), // 去掉两端的 ==
          });
          cursor = spanEnd;
        }
        if (!matched) return;
        if (cursor < stream.length) out.push(...slice(cursor, stream.length));
        ctx.replaceNode(node, {
          type: 'element',
          tagName: node.tagName,
          properties: { ...(node.properties ?? {}) },
          children: out,
        });
      },
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
