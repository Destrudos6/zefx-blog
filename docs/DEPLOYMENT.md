# ZEFX 部署指南

本文档详细说明 ZEFX 博客的部署配置：Backblaze B2 连接、Cloudflare Worker 代理、Cloudflare Pages 部署。部署的概要流程见 [README](../README.md#部署)。

## 架构总览

```
GitHub 仓库 ──push──▶ Cloudflare Pages（构建 + 托管）
                          │
                          ▼
                    npm run build
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      Backblaze B2（内容源）    GitHub API（评论数）
      └─ 经 Cloudflare Worker 代理
```

- **内容存储**：Backblaze B2 私有存储桶（文章、JSON 配置、媒体资源）
- **CDN/代理**：Cloudflare Worker（B2 代理，AWS V4 签名）
- **评论数**：Cloudflare Pages Function 代理 GitHub Discussions API
- **部署**：Cloudflare Pages，构建时从 B2 拉取内容生成静态站点

---

## 环境变量

所有环境变量仅在**构建时（服务端）**使用，不会暴露到客户端。本地配置在 `.env`（参考 [.env.example](../.env.example)），Cloudflare Pages 部署时配置在项目设置中。

| 变量 | 必填 | 说明 |
|------|------|------|
| `USE_B2` | ✅ | `true` 启用 B2 远程拉取；`false` 使用本地文件（开发模式） |
| `B2_PROXY_URL` | ✅（生产） | Cloudflare Worker 代理完整地址，**必须带 `https://`**，如 `https://your-worker.workers.dev` |
| `B2_BUCKET_NAME` | ✅ | Backblaze B2 存储桶名称 |
| `B2_PREFIX` | ❌ | 存储桶路径前缀（如 `zefx-data`），全部资源在桶根目录时留空 |
| `GITHUB_TOKEN` | ✅ | GitHub Personal Access Token，用于代理 GitHub Discussions API（评论数统计）。生成地址：<https://github.com/settings/tokens> |
| `GITHUB_OWNER` | ❌ | GitHub Discussions API 白名单 owner |
| `GITHUB_REPO` | ❌ | GitHub Discussions API 白名单 repo |

### GitHub 白名单说明

`GITHUB_OWNER` / `GITHUB_REPO` 为可选白名单，配置后 `/api/github-discussions` 只允许查询指定仓库，防止 token 被滥用。

- **值必须与 `site.json` 中 `giscus.repo` 按 `/` 拆分的结果一致**：owner 为 `/` 前部分，repo 为 `/` 后部分
- 例如 `giscus.repo = "your-github-name/your-comments-repo"` → `GITHUB_OWNER=your-github-name`、`GITHUB_REPO=your-comments-repo`（注意不是链接，也不是 `owner/repo` 完整形式）
- 比较**不区分大小写**，owner 填大写或小写均可
- 不配置则不做白名单校验（仅需 `GITHUB_TOKEN`）

---

## 连接 Backblaze B2

### 前提条件

1. **Backblaze B2 账户** — 已创建私有存储桶
2. **Cloudflare Worker** — 已部署 [cloudflare-b2](https://github.com/backblaze-b2-samples/cloudflare-b2) 代理
3. **环境变量** — 已配置（见上表）

### Cloudflare Worker 代理设置

本项目使用 Backblaze 官方的 [cloudflare-b2](https://github.com/backblaze-b2-samples/cloudflare-b2) 代理方案，配置 `wrangler.toml`：

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

设置密钥并部署：

```bash
echo "<你的 Backblaze Application Key>" | npx wrangler secret put B2_APPLICATION_KEY
npx wrangler deploy
```

> 详细配置步骤请参考：<https://github.com/backblaze-b2-samples/cloudflare-b2>

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
├── posts/                      ← 普通文章 Markdown 文件
│   ├── test.md
│   ├── coverimage/             ← 普通文章封面图
│   │   └── test-cover.png
│   └── illustration/           ← 普通文章内嵌图片
│       └── sample.png
└── projects/                   ← 项目数据（自包含）
    └── read-design-of-design/
        ├── cover.png           ← 项目封面图
        ├── logs.json           ← 项目元数据
        ├── coverimage/         ← 项目文章封面图
        │   └── xxx.png
        ├── illustration/       ← 项目文章内嵌图片
        │   └── sample.png
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

| 字段 | 说明 |
|------|------|
| `content` | 内容文件列表（Markdown、JSON），不应包含二进制文件 |
| `media` | 媒体文件列表（图片等二进制文件） |
| `path` | 文件在 B2 中的路径（使用正斜杠 `/`） |
| `type` | `text`（文本文件）或 `binary`（二进制文件） |

**自动生成索引：**

```bash
node scripts/generate-index.mjs --write
```

> 如果 `content-index.json` 不存在，`pull-content.mjs` 会回退到 `posts/index.json`、`projects/index.json` 等默认结构；推荐始终维护 `content-index.json`。

---

## Cloudflare Pages 部署

1. **连接 GitHub 仓库**

   在 Cloudflare Dashboard 中创建 Pages 项目，连接到你的 GitHub 仓库。

2. **构建设置**

   | 设置 | 值 |
   |------|-----|
   | 构建命令 | `npm run build` |
   | 输出目录 | `dist` |
   | Node 版本 | >= 22.12.0 |

3. **环境变量**

   在 Pages 项目设置中添加[环境变量](#环境变量)：

   ```
   USE_B2=true
   B2_PROXY_URL=https://your-worker.your-subdomain.workers.dev
   B2_BUCKET_NAME=your-bucket-name
   B2_PREFIX=
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   GITHUB_OWNER=your-github-name
   GITHUB_REPO=your-comments-repo
   ```

   > 环境变量修改后需要**重新部署**才会生效。

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

## 部署常见问题

### 构建卡在 "Initializing build environment"

通常是 Cloudflare 与 GitHub 的 Git 集成问题，发生在 clone 代码之前，与项目代码无关：

1. 检查 Deployments 日志，若提示 `build failed to initialize in time` 或 `Unable to submit build job` 即为集成问题
2. 在 Cloudflare Dashboard → Workers & Pages → 项目 → Settings 中**断开并重新连接 Git**（必要时先在 GitHub → Settings → Applications 中 Uninstall Cloudflare Pages，再重新授权）
3. 若仓库迁移/改名过，确认连接的是**新仓库地址**
4. 偶发情况可多次 Retry deployment

### 构建报错 `ENOTFOUND https`

`B2_PROXY_URL` 配成了 `https://https://...`（协议重复）。Node 把第一个 `https` 当主机名解析导致 DNS 失败。改为单份协议：`https://your-worker.workers.dev`。

### 构建报错 `Failed to fetch ... 404 Not Found`

B2 中缺少对应文件，或 `content-index.json` 里的路径与存储桶实际结构不一致。运行 `node scripts/generate-index.mjs --write` 重新生成索引并上传到 B2 桶根目录。

### 评论数显示为 0

1. 确认 `GITHUB_TOKEN` 已配置且对目标仓库有 Discussions 读取权限（fine-grained token 需勾选 Discussions 权限）
2. 若配置了 `GITHUB_OWNER` / `GITHUB_REPO` 白名单，确认值与 `site.json` 中 `giscus.repo` 拆分结果一致（大小写不敏感）
3. 直连测试：`curl "https://你的域名/api/github-discussions?owner=<owner>&repo=<repo>"`，返回 `403 Forbidden` 即白名单不匹配
