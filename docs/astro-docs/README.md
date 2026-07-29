# Astro 框架开发文档速查手册

> 来源：Astro 官方文档 (https://docs.astro.build)
> 整理时间：2026-07-27 | Astro v7
> 适用项目：Superior Singularity (Astro Basics 模板)

## 📖 目录

| # | 文件 | 内容 |
|---|------|------|
| 1 | [`01-快速入门与核心概念.md`](./01-快速入门与核心概念.md) | Astro 简介、设计原则、岛屿架构 |
| 2 | [`02-项目结构与配置.md`](./02-项目结构与配置.md) | 目录结构、astro.config、tsconfig、命令 |
| 3 | [`03-Astro组件与模板语法.md`](./03-Astro组件与模板语法.md) | .astro 组件、模板表达式、指令参考 |
| 4 | [`04-页面与路由.md`](./04-页面与路由.md) | 文件路由、静态/动态路由、重定向 |
| 5 | [`05-布局与插槽.md`](./05-布局与插槽.md) | Layout 组件、Slot 机制 |
| 6 | [`06-样式与CSS.md`](./06-样式与CSS.md) | 作用域样式、全局样式、Tailwind、class:list |
| 7 | [`07-客户端脚本与交互.md`](./07-客户端脚本与交互.md) | `<script>` 处理、事件处理、Web Component |
| 8 | [`08-内容集合.md`](./08-内容集合.md) | Content Collections、Loader、Schema |
| 9 | [`09-框架组件集成.md`](./09-框架组件集成.md) | React/Vue/Svelte 集成、client:* 指令 |
| 10 | [`10-按需渲染与API端点.md`](./10-按需渲染与API端点.md) | SSR、Adapter、API Routes |
| 11 | [`11-部署指南.md`](./11-部署指南.md) | 构建、适配器、部署平台 |

## 🚀 快速起步

```bash
# 开发
npm run dev           # http://localhost:4321
npx astro dev --background  # 后台模式

# 构建
npm run build         # 输出到 dist/

# 预览
npm run preview

# 添加集成
npx astro add react   # 安装 React 集成
```

## 📚 推荐学习路径

1. **先看** [01-快速入门与核心概念.md](./01-快速入门与核心概念.md) — 理解 Astro 的设计理念
2. **再看** [03-Astro组件与模板语法.md](./03-Astro组件与模板语法.md) — 学会写 .astro 文件
3. **然后** [04-页面与路由.md](./04-页面与路由.md) 和 [05-布局与插槽.md](./05-布局与插槽.md) — 构建页面
4. **最后** 按需查阅其他文件

## 🔗 官方链接

- [Astro 官方文档](https://docs.astro.build)
- [官方教程 - Build a Blog](https://docs.astro.build/en/tutorial/)
- [Astro 集成市场](https://astro.build/integrations/)
- [Discord 社区](https://astro.build/chat)
