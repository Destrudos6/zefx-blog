# ZEFX — 个人博客系统

一个基于 **Astro 7** 的静态博客，采用 **Neo-Brutalist（新粗野主义）** 风格设计。后端数据存储在 **Backblaze B2**，通过 **Cloudflare Worker** 代理访问，部署在 **Cloudflare Pages** 上。

## 目录

- [项目架构](#项目架构)
- [快速开始](#快速开始)
- [连接 Backblaze B2](#连接-backblaze-b2)
- [B2 存储桶目录结构](#b2-存储桶目录结构)
- [数据文件详解](#数据文件详解)
- [写文章](#写文章)
- [分类与标签](#分类与标签)
- [创建项目](#创建项目)
- [媒体资源引用](#媒体资源引用)
- [评论系统](#评论系统)
- [部署](#部署)
- [常见问题](#常见问题)

---

## 项目架构

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Astro 7（静态站点生成） |
| 样式 | 原生 CSS（Neo-Brutalist 设计系统） |
| 部署 | Cloudflare Pages |
| 存储 | Backblaze B2（私有存储桶） |
| CDN/代理 | Cloudflare Worker（B2 代理 + AWS V4 签名） |
| 评论 | Giscus（基于 GitHub Discussions） |
| 搜索 | 客户端 JSON 搜索 |
| RSS | @astrojs/rss |
| Sitemap | @astrojs/sitemap |

### 数据流

```
┌─────────────────────────────────────────────────────────┐
│                    构建流程                               │
│                                                         │
│  npm run build                                          │
│       │                                                 │
│       ├──► scripts/pull-content.mjs                     │
│       │         │                                       │
│       │         ├── 从 B2 拉取 content-index.json        │
│       │         ├── 下载 Markdown/JSON → src/content/   │
│       │         └── 下载图片 → public/                  │
│       │                                                 │
│       └──► astro build                                  │
│                 │                                       │
│                 ├── 读取 Content Collections             │
│                 ├── 获取 JSON 数据（B2 或本地）          │
│                 └── 生成静态页面 → dist/                │
└─────────────────────────────────────────────────────────┘
```

### 双模式设计

- **开发模式**（`USE_B2=false`）：使用本地 `src/data/` 和 `src/content/` 中的文件
- **生产模式**（`USE_B2=true`）：从 B2 拉取所有数据和媒体文件

---

## 快速开始

### 环境要求

- Node.js >= 22.12.0
- npm >= 10.0.0

### 安装

```bash
# 克隆项目
git clone https://github.com/destrudos6/zefx.git
cd zefx

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env
```

### 开发

```bash
# 本地开发（使用本地文件，不需要 B2）
npm run dev
```

打开 http://localhost:4321 查看网站。

### 构建

```bash
# 完整构建（从 B2 拉取数据 + 生成静态页面）
npm run build

# 仅构建（不拉取 B2 数据，使用本地文件）
npm run build:local

# 预览构建结果
npm run preview
```

---

## 连接 Backblaze B2

### 前提条件

1. **Backblaze B2 账户** — 已创建私有存储桶
2. **Cloudflare Worker** — 已部署 [cloudflare-b2](https://github.com/backblaze-b2-samples/cloudflare-b2) 代理
3. **环境变量** — 在 `.env` 中配置

### 环境变量配置

编辑 `.env` 文件：

```env
# 是否启用 B2 远程数据拉取
USE_B2=true

# Cloudflare Worker 代理地址
B2_PROXY_URL=https://your-worker.your-subdomain.workers.dev

# Backblaze B2 存储桶名称
B2_BUCKET_NAME=your-bucket-name

# 存储桶中的路径前缀（如果数据放在桶的子目录中）
# 例如：zefx-data 或留空表示根目录
B2_PREFIX=
```

### Cloudflare Worker 代理设置

本项目使用 Backblaze 官方的 [cloudflare-b2](https://github.com/backblaze-b2-samples/cloudflare-b2) 代理方案。

配置 `wrangler.toml`：

```toml
name = "your-b2-proxy"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
B2_APPLICATION_KEY_ID = "<你的 Backblaze Application Key ID>"
B2_ENDPOINT = "<你的 S3 端点，例如 s3.us-west-001.backblazeb2.com>"
BUCKET_NAME = "your-bucket-name"
ALLOW_LIST_BUCKET = "false"
```

设置密钥：

```bash
echo "<你的 Backblaze Application Key>" | npx wrangler secret put B2_APPLICATION_KEY
```

部署 Worker：

```bash
npx wrangler deploy
```

详细配置步骤请参考：[使用 Cloudflare Worker 代理私有 Backblaze B2 存储桶](./docs/使用%20Cloudflare%20Worker%20代理私有%20Backblaze%20B2%20存储桶.md)

---

## B2 存储桶目录结构

### 推荐结构

B2 存储桶中的目录结构应与本地保持一致：

```
your-bucket/
├── content-index.json          ← 内容索引文件（必需）
├── data/                       ← JSON 配置文件
│   ├── site.json               ← 站点配置
│   ├── about.json              ← 关于页面数据
│   ├── friends.json            ← 友链数据
│   ├── ticker.json             ← 跑马灯文本
│   └── categories.json         ← 分类定义
├── posts/                      ← 文章 Markdown 文件
│   ├── test.md
│   ├── coverimage/             ← 文章封面图
│   │   └── test-cover.png
│   └── illustration/           ← 文章内嵌图片
│       └── sample.png
└── projects/                   ← 项目数据
    └── read-design-of-design/
        ├── cover.png           ← 项目封面图
        ├── logs.json           ← 项目元数据
        └── posts/              ← 项目相关文章
            └── test.md
```

### content-index.json

这是构建时的"清单文件"，告诉 `pull-content.mjs` 需要从 B2 下载哪些文件。

**格式：**

```json
{
  "generated": "2026-07-28T16:00:00.000Z",
  "content": [
    { "path": "posts/test.md", "type": "text" },
    { "path": "read-design-of-design/logs.json", "type": "text" },
    { "path": "read-design-of-design/posts/test.md", "type": "text" }
  ],
  "media": [
    { "path": "Avatar.png", "type": "binary" },
    { "path": "favicon.ico", "type": "binary" },
    { "path": "posts/coverimage/test-cover.png", "type": "binary" },
    { "path": "projects/read-design-of-design/cover.png", "type": "binary" }
  ]
}
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `content` | 内容文件列表（Markdown、JSON），不应包含二进制文件 |
| `media` | 媒体文件列表（图片等二进制文件） |
| `path` | 文件在 B2 中的路径（使用正斜杠 `/`） |
| `type` | `text`（文本文件）或 `binary`（二进制文件） |

**自动生成索引：**

```bash
# 扫描本地文件并生成 content-index.json
node scripts/generate-index.mjs --write
```

---

## 数据文件详解

### site.json — 站点配置

站点全局配置，包括导航、Hero 区域、Giscus 评论等。

```json
{
  "site": {
    "name": "ZEFX",
    "url": "https://zefx.dev",
    "description": "记录自己，就是记录世界",
    "copyright": "© 2026–now ZEFX",
    "lang": "zh-CN",
    "avatar": "/Avatar.png",
    "favicon": "/favicon.ico",

    "navItems": [
      { "href": "/", "label": "首页" },
      { "href": "/posts", "label": "文章" },
      { "href": "/projects", "label": "项目" },
      { "href": "/about", "label": "关于" },
      { "href": "/friends", "label": "友链" }
    ],

    "footerNav": [
      { "href": "/", "label": "首页" },
      { "href": "/posts", "label": "文章" }
    ],

    "categories": [
      { "href": "/posts#tech", "label": "技术" },
      { "href": "/posts#essay", "label": "随笔" }
    ],

    "elsewhere": [
      { "href": "https://github.com/yourname", "label": "GitHub" },
      { "href": "/rss.xml", "label": "RSS 订阅" },
      { "href": "mailto:hi@zefx.site", "label": "联系邮箱" }
    ],

    "hero": {
      "ghost": "CURIOUS",
      "metaChips": [
        { "text": "第 {{issue}} 期", "variant": "hot" },
        { "text": "----.--.-- --:--:--", "variant": "mono", "id": "clock" },
        { "text": "Done is better than perfect.", "variant": "mono" }
      ],
      "title": "ZEFX",
      "subtitle": "A personal zine on the slow internet ✶ since 2026",
      "tagline": "这里是zefx个人博客。",
      "stickers": ["计算机科学", "广泛学习", "每周一更(大概)"]
    },

    "subscribe": {
      "kicker": "NEWSLETTER · 订阅",
      "title": "不错过最新更新",
      "copy": "关注最新技术、最新新闻...",
      "label": "收件地址 / YOUR EMAIL",
      "placeholder": "you@example.com",
      "btnText": "订阅",
      "note": "已有 1,024 位订阅者 · 随时可退订"
    },

    "searchPlaceholder": "搜索文章…",

    "github": {
      "owner": "destrudos6",
      "repo": "zefx"
    },

    "giscus": {
      "repo": "destrudos6/zefx.site-comments",
      "repoId": "R_kgDOTl_23A",
      "category": "Announcements",
      "categoryId": "DIC_kwDOTl_23M4DCJ2-",
      "mapping": "pathname",
      "strict": "0",
      "reactionsEnabled": "1",
      "inputPosition": "top",
      "theme": "/giscus-theme.css",
      "lang": "zh-CN"
    }
  }
}
```

**metaChips 说明：**

| 字段 | 说明 |
|------|------|
| `text` | 显示文本。`{{issue}}` 会被自动替换为文章总数，`{{clock}}` 由 JS 动态填充 |
| `variant` | `hot`（红色高亮）/ `mono`（普通样式）/ 留空（默认） |
| `id` | `clock` 时由 JS 动态更新时间 |

**avatar / favicon 说明：**

| 字段 | 说明 |
|------|------|
| `avatar` | 可选。站点头像路径，默认 `/Avatar.png`。B2 模式下自动转换为代理 URL |
| `favicon` | 可选。网站图标路径，默认 `/favicon.ico` |

---

### about.json — 关于页面

```json
{
  "name": "ZEFX",
  "bio": "你好,我是ZEFX。记录自己，就是记录世界。",
  "bioLong": "你好,我是ZEFX。记录自己，就是记录世界。这里是我用文字、代码和胶片搭建的个人角落。",
  "facts": [
    "专业:数据科学与大数据",
    "爱好:思考、写作、折腾",
    "座右铭:Done is better than perfect."
  ],
  "stats": [
    { "count": 0, "unit": "篇文章" },
    { "count": 0, "unit": "天网站运行" },
    { "count": 0, "unit": "个项目" },
    { "count": 0, "unit": "元赞助" }
  ],
  "timeline": [
    {
      "date": "2026.7",
      "title": "博客运行",
      "text": "用 Astro 架构搭建了一个静态博客..."
    }
  ]
}
```

**注意：** `stats` 中的 `count` 会被动态计算覆盖（文章数、运行天数、项目数），你填写的初始值只在构建前使用。

---

### friends.json — 友链

```json
[
  {
    "name": "Cloudflare",
    "color": "var(--green)",
    "desc": "全球知名的 CDN 和网络安全公司",
    "url": "https://cloudflare.com/"
  },
  {
    "name": "GitHub",
    "color": "var(--ink)",
    "desc": "全球最大的代码托管平台",
    "url": "https://github.com/"
  }
]
```

**颜色变量：**

| 变量 | 色值 | 用途 |
|------|------|------|
| `var(--red)` | #e8432d | 红色 |
| `var(--blue)` | #2b46d4 | 蓝色 |
| `var(--green)` | #1e7a5c | 绿色 |
| `var(--lemon)` | #ffd23f | 黄色 |
| `var(--orange)` | #f28c1b | 橙色 |
| `var(--ink)` | #1f2537 | 深色 |

---

### ticker.json — 跑马灯

首页顶部滚动的文字条。

```json
[
  {
    "text": "写就对了，哪怕没人看。",
    "highlight": "写就对了"
  },
  {
    "text": "博客搭好了，总该写点什么——哪怕只是碎碎念。",
    "highlight": "碎碎念"
  },
  {
    "text": "学计算机的福利：永远有有趣的开源项目等你发现。"
  }
]
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `text` | 完整显示文本 |
| `highlight` | 可选。需要高亮的部分（显示为黄色） |

---

### categories.json — 分类定义

```json
[
  {
    "label": "随笔",
    "slug": "essay",
    "color": "var(--red)",
    "textColor": "#fff"
  },
  {
    "label": "技术",
    "slug": "tech",
    "color": "var(--blue)"
  },
  {
    "label": "观点",
    "slug": "opinion",
    "color": "var(--green)"
  },
  {
    "label": "分享",
    "slug": "share",
    "color": "var(--orange)"
  },
  {
    "label": "读书",
    "slug": "reading",
    "color": "var(--lemon)",
    "textColor": "var(--ink)"
  }
]
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `label` | 显示名称（中文） |
| `slug` | URL 中的标识（英文，用于 `#tech` 锚点） |
| `color` | 分类标签背景色 |
| `textColor` | 可选。标签文字颜色（默认白色） |

---

## 写文章

### 文件位置

文章放在 `src/content/posts/` 目录下：

```
src/content/posts/
├── my-first-post.md              ← 普通文章
├── another-post.md
└── coverimage/
    └── my-first-post-cover.png   ← 对应的封面图
```

### Frontmatter 格式

每篇文章顶部需要包含 YAML 格式的 frontmatter：

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
---
```

### Frontmatter 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `category` | string | ✅ | 分类名称（需与 `categories.json` 中的 `label` 匹配） |
| `categoryColor` | string | ✅ | 分类标签颜色（CSS 变量或色值） |
| `categoryTextColor` | string | ❌ | 分类标签文字颜色 |
| `date` | string | ✅ | 发布日期（格式：`YYYY.MM.DD`） |
| `title` | string | ✅ | 文章标题 |
| `excerpt` | string | ✅ | 文章摘要（显示在卡片和搜索结果中） |
| `readTime` | string | ✅ | 预计阅读时间（如 `"5 分钟"`） |
| `comments` | number | ✅ | 评论数（从 Giscus 同步，初始为 0） |
| `coverImage` | string | ❌ | 封面图片路径 |
| `project` | string | ❌ | 关联项目的 slug（如 `"read-design-of-design"`） |

### 正文格式

Frontmatter 下方直接写 Markdown 正文：

```markdown
---
category: "技术"
categoryColor: "var(--blue")
date: "2026.07.28"
title: "如何使用 Astro 搭建博客"
excerpt: "本文介绍如何使用 Astro 框架搭建一个静态博客。"
readTime: "10 分钟"
comments: 0
---

# 引言

这是文章的引言部分。

## 第一节

这里是第一节的内容。可以包含**粗体**、*斜体*、~~删除线~~等基础格式。

### 代码示例

```javascript
function hello() {
  console.log("Hello, World!");
}
```

### 列表

- 第一项
- 第二项
  - 嵌套项
  - 嵌套项

### 引用

> 这是一段引用。
> 可以多行。

### 图片

![示例图片](/posts/illustration/my-image.png)

### 链接

[访问 GitHub](https://github.com)

---

## 结语

以上就是全部内容。
```

### URL 生成规则

| 文件路径 | 生成的 URL |
|----------|-----------|
| `posts/test.md` | `/posts/test/` |
| `posts/my-post.md` | `/posts/my-post/` |
| `projects/read-design-of-design/posts/test.md` | `/posts/read-design-of-design-test/` |

---

## 分类与标签

### 分类（Category）

分类在 `categories.json` 中定义，用于文章归类和筛选。

**创建新分类：**

1. 编辑 `src/data/categories.json`（本地开发）或 B2 上的 `data/categories.json`
2. 添加新条目：

```json
{
  "label": "摄影",
  "slug": "photo",
  "color": "var(--orange)",
  "textColor": "#fff"
}
```

3. 在文章 frontmatter 中使用：

```yaml
category: "摄影"
categoryColor: "var(--orange)"
categoryTextColor: "#fff"
```

### 标签（Tag）

标签用于项目（Project），在项目的 `logs.json` 中定义。

```json
{
  "tags": ["读书", "笔记", "设计"]
}
```

标签没有全局定义，可以直接在项目中自由使用。

---

## 创建项目

### 项目结构

```
src/content/read-design-of-design/
├── logs.json           ← 项目元数据（必需）
├── cover.png           ← 项目封面图（可选）
└── posts/              ← 项目相关文章（可选）
    └── test.md
```

### logs.json 格式

```json
{
  "title": "读《设计中的设计》",
  "status": "done",
  "statusLabel": "已完成",
  "description": "原研哉关于信息设计和感官体验的思考。读书笔记整理成了一份可复用的设计原则清单。",
  "coverColor": "var(--lemon)",
  "coverImage": "/projects/read-design-of-design/cover.png",
  "tags": ["读书", "笔记", "设计"],
  "logs": [
    {
      "date": "06.30",
      "text": "读完。最喜欢「雷电」一章。"
    },
    {
      "date": "06.15",
      "text": "读到一半,开始重新审视自己的博客设计。"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 项目名称 |
| `status` | string | ✅ | `active`（进行中）/ `done`（已完成）/ `pause`（已暂停） |
| `statusLabel` | string | ✅ | 状态显示文本（如 `"进行中"`） |
| `description` | string | ✅ | 项目描述 |
| `coverColor` | string | ✅ | 封面背景色（当没有封面图时使用） |
| `coverImage` | string | ❌ | 封面图片路径 |
| `tags` | string[] | ✅ | 标签数组 |
| `logs` | array | ✅ | 项目更新日志 |
| `logs[].date` | string | ✅ | 更新日期 |
| `logs[].text` | string | ✅ | 更新内容 |

### 项目相关文章

在项目目录下创建 `posts/` 文件夹，放入 Markdown 文章：

```markdown
---
category: "读书"
categoryColor: "var(--lemon)"
categoryTextColor: "var(--ink)"
date: "2026.06.20"
title": "《设计中的设计》读书笔记"
excerpt: "原研哉对信息设计的思考..."
readTime: "8 分钟"
comments: 0
project: "read-design-of-design"
---
```

**注意：** `project` 字段值必须与项目目录名一致。

---

## 媒体资源引用

### 路径规则

本项目支持两种路径模式，通过 `USE_B2` 环境变量切换：

| 模式 | `USE_B2=false`（本地） | `USE_B2=true`（生产） |
|------|------------------------|-----------------------|
| 图片路径 | `/posts/coverimage/test.png` | `https://your-worker.workers.dev/posts/coverimage/test.png` |

**在 Markdown 和 JSON 中，始终使用本地格式的路径**（以 `/` 开头的相对路径），系统会自动转换为 B2 代理 URL。

### 文章封面图

**推荐路径格式：** `/posts/coverimage/{文章slug}-cover.png`

```yaml
coverImage: "/posts/coverimage/my-post-cover.png"
```

### 文章内嵌图片

**推荐路径格式：** `/posts/illustration/{图片名称}.png`

在 Markdown 中引用：

```markdown
![示例插图](/posts/illustration/sample.png)
```

### 项目封面图

**推荐路径格式：** `/projects/{项目slug}/cover.png`

```json
{
  "coverImage": "/projects/read-design-of-design/cover.png"
}
```

### 项目相关图片

**推荐路径格式：** `/projects/{项目slug}/illustration/{图片名称}.png`

### 完整目录结构参考

```
public/ 或 B2 桶
├── Avatar.png                        ← 站点头像
├── favicon.ico                       ← 网站图标
├── giscus-theme.css                  ← Giscus 自定义主题
├── posts/
│   ├── coverimage/                   ← 文章封面图
│   │   ├── test-cover.png
│   │   └── my-post-cover.png
│   └── illustration/                 ← 文章内嵌图片
│       ├── sample.png
│       └── diagram.png
└── projects/
    └── read-design-of-design/
        ├── cover.png                 ← 项目封面图
        └── illustration/             ← 项目相关图片
            └── sketch.png
```

---

## 评论系统

本项目使用 [Giscus](https://giscus.app) 作为评论系统，基于 GitHub Discussions。

### 配置步骤

1. **创建 GitHub 仓库** — 用于存储评论（如 `yourname/site-comments`）
2. **启用 Discussions** — 在仓库设置中开启 Discussions 功能
3. **安装 Giscus App** — 在 GitHub 上安装 [Giscus](https://github.com/apps/giscus)
4. **获取配置参数** — 访问 [giscus.app](https://giscus.app) 生成配置
5. **更新 site.json** — 填入配置参数

### site.json 中的 Giscus 配置

```json
{
  "giscus": {
    "repo": "yourname/site-comments",
    "repoId": "R_kgDOK...",
    "category": "Announcements",
    "categoryId": "DIC_kwDOK...",
    "mapping": "pathname",
    "strict": "0",
    "reactionsEnabled": "1",
    "inputPosition": "top",
    "theme": "/giscus-theme.css",
    "lang": "zh-CN"
  }
}
```

### 自定义主题

项目包含一个自定义 Giscus 主题文件 `public/giscus-theme.css`，采用与博客一致的 Neo-Brutalist 风格。

如需修改主题，编辑该文件后重新部署即可。

---

## 部署

### Cloudflare Pages 部署

1. **连接 GitHub 仓库**

在 Cloudflare Dashboard 中创建 Pages 项目，连接到你的 GitHub 仓库。

2. **构建设置**

| 设置 | 值 |
|------|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node 版本 | >= 22.12.0 |

3. **环境变量**

在 Pages 项目设置中添加以下环境变量：

```
USE_B2=true
B2_PROXY_URL=https://your-worker.your-subdomain.workers.dev
B2_BUCKET_NAME=your-bucket-name
B2_PREFIX=
```

4. **自定义域名**（可选）

在 Pages 设置中添加自定义域名。

### 手动部署

```bash
# 构建
npm run build

# 部署到 Cloudflare Pages
npx wrangler pages deploy dist
```

---

## 常见问题

### Q: 本地开发时需要连接 B2 吗？

**不需要。** 默认情况下 `USE_B2=false`，使用本地文件进行开发。只有运行 `npm run build` 时才会从 B2 拉取数据。

### Q: 如果 B2 上的文件更新了，本地如何同步？

运行以下命令强制从 B2 拉取最新数据：

```bash
npm run pull:content
```

或者直接运行 `npm run build`，它会自动先拉取数据再构建。

### Q: 如何添加新文章？

1. 在 `src/content/posts/` 目录下创建 `.md` 文件
2. 填写 frontmatter（参考 [写文章](#写文章) 章节）
3. 上传文章到 B2 桶对应路径
4. 更新 `content-index.json` 并上传到 B2
5. 重新构建

### Q: 文章中的图片应该放在哪里？

- **封面图：** `posts/coverimage/` 目录
- **文章内嵌图片：** `posts/illustration/` 目录
- **项目封面图：** `projects/{项目slug}/` 目录
- **项目相关图片：** `projects/{项目slug}/illustration/` 目录

### Q: 如何修改网站外观？

编辑 `src/styles/global.css` 文件，修改 CSS 变量：

```css
:root{
  --paper: #f5f1e6;    /* 背景色 */
  --card: #fdfaf1;    /* 卡片背景 */
  --ink: #1f2537;     /* 文字/边框色 */
  --soft: #5b6172;    /* 次要文字 */
  --red: #e8432d;     /* 强调色 */
  --blue: #2b46d4;    /* 链接色 */
  --lemon: #ffd23f;   /* 高亮色 */
  --green: #1e7a5c;   /* 成功色 */
  --orange: #f28c1b;  /* 警告色 */
}
```

### Q: 构建时报错 "No files found matching **/*.md"

这表示 `src/content/` 目录下没有找到 Markdown 文件。可能原因：
- B2 上的文件路径不正确
- `content-index.json` 中列出的路径有误
- B2 存储桶中没有上传这些文件

### Q: 构建时报错 "Failed to fetch ... 404 Not Found"

表示 B2 上找不到对应的文件。请检查：
1. 文件是否已上传到 B2
2. 文件路径是否正确（注意大小写）
3. `content-index.json` 中的路径是否与 B2 上的实际路径一致

### Q: 如何生成 content-index.json？

```bash
# 扫描本地文件并生成
node scripts/generate-index.mjs --write
```

如果本地文件已被删除，需要手动创建或从 B2 下载文件后再生成。

### Q: favicon 或头像不显示？

1. 确认文件已上传到 B2 对应路径
2. 清除浏览器缓存（Ctrl+Shift+R 强制刷新）
3. 检查 `content-index.json` 中是否包含这些文件

### Q: 评论数显示为 0？

评论数通过 GitHub API 获取，需要：
1. `site.json` 中正确配置 `github.owner` 和 `github.repo`
2. Giscus 已正确配置并与 GitHub Discussions 关联
3. 文章标题与 GitHub Discussion 标题一致

---

## 项目结构总览

```
zefx/
├── .env                    # 环境变量（不提交到 Git）
├── .env.example            # 环境变量模板
├── astro.config.mjs        # Astro 配置（含 sitemap 集成）
├── content-index.json      # B2 内容索引
├── package.json            # 依赖和脚本
├── scripts/
│   ├── pull-content.mjs    # B2 数据拉取脚本
│   └── generate-index.mjs  # 索引文件生成器
├── public/                 # 静态资源（构建时从 B2 填充）
│   ├── Avatar.png
│   ├── favicon.ico
│   ├── giscus-theme.css
│   ├── robots.txt
│   ├── posts/
│   └── projects/
└── src/
    ├── components/         # UI 组件
    ├── content/            # 内容集合（构建时从 B2 填充）
    │   ├── posts/          # 文章
    │   └── projects/       # 项目
    ├── data/               # 数据加载器
    │   ├── backblaze.ts    # B2 数据获取
    │   └── content.ts      # Content Collection 辅助函数
    ├── layouts/            # 页面布局
    ├── pages/              # 页面路由
    │   ├── index.astro     # 首页
    │   ├── 404.astro       # 404 页面
    │   ├── about.astro     # 关于
    │   ├── friends.astro   # 友链
    │   ├── search.astro    # 搜索
    │   ├── rss.xml.js      # RSS 订阅
    │   ├── posts/          # 文章页面
    │   └── projects/       # 项目页面
    ├── styles/
    │   └── global.css      # 全局样式
    ├── utils/
    │   └── media.ts        # 媒体 URL 工具
    └── content.config.ts   # Content Collection 配置
```

---

## License

MIT License

---

## 相关资源

- [Astro 官方文档](https://docs.astro.build)
- [Backblaze B2 文档](https://www.backblaze.com/b2/docs/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Giscus 配置指南](https://giscus.app)
- [cloudflare-b2 代理示例](https://github.com/backblaze-b2-samples/cloudflare-b2)
