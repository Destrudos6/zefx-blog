# ZEFX — 个人博客系统

一个基于 **Astro 7** 的静态博客，采用 **Neo-Brutalist（新粗野主义）** 风格设计。内容存储在 **Backblaze B2**（私有存储桶），通过 **Cloudflare Worker** 代理访问，部署在 **Cloudflare Pages** 上。

## 特性

- 📄 **Markdown 文章** — 支持分类、标签、封面图、阅读时长、代码高亮与 TOC 目录
- 🖼️ **文章封面** — 文章页头部右侧展示封面，无封面时自动生成分类色占位
- 📑 **右侧粘性目录** — 正文左侧、目录右侧的双栏阅读布局，移动端自动折叠
- 🔍 **客户端全文搜索** — 搜索标题、摘要与正文，零服务器开销
- 🏷️ **标签系统** — 独立标签云页（`/tags`），点击标签筛选文章
- 📚 **相关文章推荐** — 按共享标签推荐 3 篇同类文章，提升阅读留存
- ⏮️ **上一篇 / 下一篇** — 文章底部导航卡片，快速切换相邻文章
- 💬 **Giscus 评论** — 基于 GitHub Discussions，支持明暗主题同步
- 📊 **Umami 统计** — 轻量隐私友好的网站分析，可配置公开看板入口
- 📈 **统计页（`/stats`）** — 聚合 GitHub 贡献日历、公开仓库、LeetCode 刷题、微信读书阅读数据
- 🌙 **暗色模式** — localStorage 记忆 + 系统偏好检测
- 📱 **响应式布局** — 桌面 / 平板 / 手机三端适配
- 📡 **RSS / Sitemap** — 自动生成订阅源与站点地图

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Astro 7（静态站点生成） |
| 样式 | 原生 CSS（Neo-Brutalist 设计系统） |
| 存储 | Backblaze B2（私有存储桶） |
| CDN/代理 | Cloudflare Worker（B2 代理 + AWS V4 签名） |
| 评论 | Giscus（基于 GitHub Discussions） |
| 统计 | Umami |
| 部署 | Cloudflare Pages |

## 快速开始

### 环境要求

- Node.js >= 22.12.0

### 安装与开发

```bash
git clone https://github.com/Destrudos6/zefx-blog.git
cd zefx-blog

npm install

# 复制环境变量模板（详见下方"环境变量"）
cp .env.example .env

# 本地开发（USE_B2=false 时使用本地文件，无需 B2）
npm run dev
```

### 构建

```bash
# 完整构建（USE_B2=true 时从 B2 拉取数据 + 生成静态页面）
npm run build

# 仅构建（不拉取 B2，使用本地文件）
npm run build:local

# 预览构建结果
npm run preview
```

## 环境变量

完整配置见 [部署指南](docs/DEPLOYMENT.md#环境变量)。核心变量：

| 变量 | 说明 |
|------|------|
| `USE_B2` | `true` 从 B2 远程拉取内容；`false` 使用本地文件（开发） |
| `B2_PROXY_URL` | Cloudflare Worker 代理地址，**必须带 `https://`** |
| `B2_BUCKET_NAME` | Backblaze B2 存储桶名称 |
| `GITHUB_TOKEN` | GitHub Token，用于评论数与统计页贡献日历（运行时读取） |
| `GITHUB_OWNER` / `GITHUB_REPO` | 可选白名单，限制 GitHub API 可查询的仓库 |
| `LEETCODE_USERNAME` | 可选，LeetCode 用户名（统计页刷题数据；也可在 site.json 配置） |
| `WEREAD_TOKEN` | 微信读书 Token（统计页阅读数据，官方 Agent API 所需） |

## 站点配置（site.json）

站点全局配置位于 B2 存储桶的 `data/site.json`（本地模式为 `src/data/site.json`），包括：

- **基础信息**：站名、描述、版权、头像、favicon
- **导航**：`navItems`（顶栏导航）、`footerNav`、`elsewhere`（页脚外链）
- **首页 Hero**：标题、副标题、标语、贴纸
- **订阅区**：邮件订阅文案
- **GitHub / Giscus**：评论系统配置（仓库、分类、主题）
- **Umami**：统计脚本地址与看板链接（可选）

```json
{
  "site": {
    "name": "ZEFX",
    "navItems": [{ "href": "/", "label": "首页" }],
    "searchPlaceholder": "搜索文章…",
    "github": { "owner": "your-github-name", "repo": "your-blog-repo" },
    "giscus": {
      "repo": "your-github-name/your-comments-repo",
      "repoId": "your-repo-id",
      "category": "Announcements",
      "categoryId": "your-category-id",
      "mapping": "pathname"
    },
    "umami": {
      "url": "https://cloud.umami.is/script.js",
      "websiteId": "your-umami-website-id",
      "dashboardUrl": "https://your-umami-dashboard-url"
    }
  }
}
```

> ⚠️ **请勿在公开仓库中填写真实的 `repoId`、`categoryId`、Umami `websiteId` 或看板链接**——这些属于隐私信息，只应存放在 B2 私有存储桶的 `site.json` 中。上面的示例均为占位符。

## 统计页（/stats）

统计页通过 **Cloudflare Pages Functions** 在运行时拉取数据（非构建时快照），聚合以下模块：

| 模块 | 数据来源 | 所需配置 |
|------|----------|----------|
| **GitHub 贡献日历** | GitHub GraphQL（最近一年热力图） | `GITHUB_TOKEN`、`GITHUB_OWNER`（运行时读取，无需 site.json） |
| **公开仓库** | 同上，按 Star 数排序展示前 5 个 | 同上 |
| **力扣** | LeetCode 官方 GraphQL（已解题数、难度分布、提交日历） | `LEETCODE_USERNAME` 或 site.json 的 `leetcode.username` |
| **微信读书** | 微信读书官方 Agent API（阅读统计周/月/年/总、最近在读、已读完书架、书籍详情） | `WEREAD_TOKEN`（官方 API 所需，运行时读取） |
| **Umami** | 站点访问统计看板内嵌 | site.json 的 `umami.dashboardUrl`（可选） |

### 配置要点

- **token 均为运行时环境变量**：在 Cloudflare Pages 项目的"设置 → 环境变量"中配置（本地开发时写入 `.env`，`wrangler pages dev` 会自动读取）。修改 token 后无需重新构建。
- **缓存策略**：所有统计接口响应缓存 **4 小时**（`Cache-Control: max-age=14400`），数据按 4 小时粒度刷新。
- **GitHub 贡献数说明**：贡献日历只统计 `GITHUB_TOKEN` 可见范围内的仓库。若 token 未授权某些私有仓库，这些仓库的贡献不会计入，数字会小于 GitHub 个人页面（页面登录后显示全部贡献）。如需完整统计，生成 fine-grained token 时勾选对应仓库并授予 `Contents: Read` 权限。
- **微信读书 token 获取**：参考 [weread-dashboard](https://github.com/Destrudos6/WeChatReading) 项目的说明，从微信读书网页端抓取。

## 写文章

### 文件位置

文章放在 `src/content/posts/` 目录下：

```
src/content/posts/
├── my-first-post.md              ← 普通文章
└── coverimage/
    └── my-first-post-cover.png   ← 对应的封面图
```

### Frontmatter

```markdown
---
category: "随笔"
categoryColor: "var(--red)"
categoryTextColor: "#fff"
date: "2026.06.14"
title: "我的第一篇文章"
excerpt: "这是我的第一篇文章，用来展示博客的基本功能。"
readTime: "5 分钟"
comments: 0
coverImage: "/posts/coverimage/my-first-post-cover.png"
project: "my-project"
tags: ["随笔", "生活"]
---
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `category` | string | ✅ | 分类名称（需与 `categories.json` 的 `label` 匹配） |
| `categoryColor` | string | ✅ | 分类标签颜色（CSS 变量或色值） |
| `categoryTextColor` | string | ❌ | 分类标签文字颜色 |
| `date` | string | ✅ | 发布日期（格式：`YYYY.MM.DD`） |
| `title` | string | ✅ | 文章标题 |
| `excerpt` | string | ✅ | 文章摘要（显示在卡片和搜索结果中） |
| `readTime` | string | ✅ | 预计阅读时间（如 `"5 分钟"`） |
| `comments` | number | ✅ | 评论数（从 Giscus 同步，初始为 0） |
| `coverImage` | string | ❌ | 封面图片路径（不填则用分类色占位） |
| `project` | string | ❌ | 关联项目的 slug（如 `"read-design-of-design"`） |
| `tags` | string[] | ❌ | 文章标签（驱动标签云与相关文章推荐） |

### 正文

使用标准 Markdown（标题、列表、代码、图片、链接等）：

```markdown
## 引言

这是正文。

### 代码

    console.log('hello');   ← 4 空格缩进表示代码块

### 图片

![示例图片](/posts/illustration/my-image.png)

### 链接

[访问 GitHub](https://github.com)
```

### URL 生成规则

- `src/content/posts/test.md` → `/posts/test`
- `src/content/posts/coverimage/...` 等子目录中的文章 → `/posts/<上级目录名>-<文件名>`

## 分类与标签

### 分类（Category）

分类定义在 `data/categories.json`，控制文章列表页的分类筛选按钮。每篇文章只能有一个分类。

### 标签（Tag）

标签定义在文章的 `tags` 字段，驱动两个功能：

- **标签云页** `/tags`：展示全部标签及文章数（热门标签高亮），点击筛选文章
- **相关文章推荐**：文章页底部展示共享标签最多的 3 篇

## 创建项目

项目数据在 `src/content/projects/<slug>/logs.json`：

```json
{
  "title": "项目名",
  "status": "active",
  "statusLabel": "进行中",
  "description": "项目描述",
  "coverColor": "var(--green)",
  "tags": ["tag1"],
  "logs": [
    { "date": "2026.07.01", "text": "更新日志" }
  ]
}
```

- `status`：`active` / `done` / `pause`
- 项目页会展示项目日志，以及 `project` 字段关联到该项目的文章列表

## 媒体资源

- **文章封面图**：`/posts/coverimage/<slug>.png`，frontmatter 的 `coverImage` 引用
- **文章内嵌图片**：正文中直接引用 `/posts/illustration/xxx.png`
- **项目封面图**：`projects/<slug>/cover.png`（或 `coverImage` 字段指定）
- 所有路径在 Markdown / JSON 中用**本地相对路径**（以 `/` 开头），系统会按 `USE_B2` 自动转换为 B2 代理 URL

## 评论系统（Giscus）

在 `site.json` 的 `giscus` 字段配置仓库与分类后自动启用（需与 `GITHUB_TOKEN` 配合统计评论数）。支持自定义 CSS 主题（`public/giscus-light.css` / `giscus-dark.css`）。

## 部署

完整部署指南（B2 连接、Cloudflare Worker 代理、Cloudflare Pages 配置、常见问题）见 **[部署指南](docs/DEPLOYMENT.md)**。

核心流程：

```bash
# 本地构建验证
npm run build

# push 到 GitHub 触发 Cloudflare Pages 自动部署
git push origin main
```

## 项目结构

```
zefx/
├── .env.example            # 环境变量模板
├── astro.config.mjs        # Astro 配置（含 sitemap）
├── content-index.json      # B2 内容索引（构建时生成）
├── scripts/
│   ├── pull-content.mjs    # B2 数据拉取脚本
│   └── generate-index.mjs  # 索引文件生成器
├── functions/api/          # Cloudflare Pages Functions
│   └── github-discussions.ts  # GitHub Discussions API 代理（评论数）
├── src/
│   ├── components/         # UI 组件（Header、PostCard、Giscus 等）
│   ├── data/               # 数据加载层（B2 / 本地双模式）
│   ├── layouts/            # BaseLayout（全站布局，含 Umami、主题切换）
│   ├── pages/              # 页面（index、posts、projects、search、tags、rss）
│   ├── content/            # 内容集合（构建时从 B2 拉取）
│   ├── styles/             # 全局样式
│   └── utils/              # 工具（媒体 URL、配置、评论共享缓存）
└── public/                 # 静态资源（头像、favicon、giscus 主题）
```

## License

MIT License
