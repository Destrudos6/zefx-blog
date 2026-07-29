# 使用 Cloudflare Worker 代理私有 Backblaze B2 存储桶

> 原文：[How to Serve Data From a Private Bucket with a Cloudflare Worker](https://www.backblaze.com/blog/how-to-serve-data-from-a-private-bucket-with-a-cloudflare-worker/)
>
> 作者：Pat Patterson | 发布日期：2023-01-18
>
> 本文综合参考了 Backblaze 官方技术文档 [Deliver Private Backblaze B2 Content Through Cloudflare CDN](https://www.backblaze.com/docs/cloud-storage-deliver-private-backblaze-b2-content-through-cloudflare-cdn) 以及两个开源仓库：[cloudflare-b2](https://github.com/backblaze-b2-samples/cloudflare-b2) 和 [cloudflare-b2-proxy](https://github.com/backblaze-b2-samples/cloudflare-b2-proxy)。

---

## 目录

1. [为什么需要阻止直接下载？](#1-为什么需要阻止直接下载)
2. [工作原理](#2-工作原理)
3. [前提条件](#3-前提条件)
4. [详细操作步骤](#4-详细操作步骤)
   - [4.1 启用 Backblaze B2](#41-启用-backblaze-b2)
   - [4.2 创建私有存储桶（Bucket）](#42-创建私有存储桶bucket)
   - [4.3 创建应用程序密钥（Application Key）](#43-创建应用程序密钥application-key)
   - [4.4 安装并配置 Cloudflare Workers CLI（Wrangler）](#44-安装并配置-cloudflare-workers-cliwrangler)
   - [4.5 创建 Cloudflare Worker 项目](#45-创建-cloudflare-worker-项目)
   - [4.6 配置 Worker](#46-配置-worker)
   - [4.7 设置安全密钥](#47-设置安全密钥)
   - [4.8 部署 Worker](#48-部署-worker)
   - [4.9 配置存储桶的缓存指令](#49-配置存储桶的缓存指令)
   - [4.10 更新网页链接](#410-更新网页链接)
   - [4.11 将存储桶设为私有并验证](#411-将存储桶设为私有并验证)
5. [高级配置](#5-高级配置)
   - [5.1 存储桶名称路由策略](#51-存储桶名称路由策略)
   - [5.2 限制签名 HTTP 头](#52-限制签名-http-头)
   - [5.3 Rclone 下载端点](#53-rclone-下载端点)
   - [5.4 大文件 Range 请求处理](#54-大文件-range-请求处理)
   - [5.5 Webhook 通知（cloudflare-b2-proxy）](#55-webhook-通知cloudflare-b2-proxy)
6. [源码核心逻辑解读](#6-源码核心逻辑解读)
   - [6.1 cloudflare-b2（简化版代理）](#61-cloudflare-b2简化版代理)
   - [6.2 cloudflare-b2-proxy（带签名验证的完整代理）](#62-cloudflare-b2-proxy带签名验证的完整代理)
7. [总结](#7-总结)

---

## 1. 为什么需要阻止直接下载？

Backblaze B2 云存储与多家 CDN 提供商（Cloudflare、Fastly、Bunny.net）建立了合作伙伴关系。通过 **Bandwidth Alliance**，从 Backblaze 到 Cloudflare 的数据传输**完全免费**，不产生任何下载费用。

### 直接下载的问题

假设你正在搭建一个网站，将图片存储在 Backblaze B2 的公开存储桶中：

```text
https://acme-images.s3.us-west-001.backblazeb2.com/logos/acme.png
```

这种直接链接存在两个问题：

1. **用户体验差**：用户距离 B2 数据中心越远，图片加载越慢。光速限制决定了跨国传输必然有延迟。
2. **成本问题**：直接从 B2 下载数据会产生费用——每天前 1GB 免费，之后每 GB 0.01 美元。相比之下，通过 Cloudflare 的 Bandwidth Alliance 传输则完全免费。

### 解决方案

即使配置了 CDN，用户仍然可以通过直接链接从 B2 存储桶下载文件（例如书签、浏览器缓存、爬虫存档的链接）。解决方法是：

1. **将存储桶设为私有**
2. **在 CDN 边缘创建一个 Worker（边缘函数）**，该 Worker 拥有安全访问私有存储桶的权限，并为每个请求进行签名认证

这样，用户只能通过 CDN 访问内容，而无法直接访问 B2 存储桶。

---

## 2. 工作原理

整体请求流程如下：

```
用户浏览器
    │
    ▼
Cloudflare Worker (images.acme.com)
    │
    ├── 复制传入请求，将目标主机改为 B2 端点
    ├── 使用 Application Key 和 Key ID 对请求进行 AWS V4 签名
    │
    ▼
Backblaze B2 (私有存储桶)
    │
    ▼
验证签名 → 处理请求 → 返回数据
    │
    ▼
Cloudflare Worker 将响应流式转发给用户浏览器
```

关键点：
- Worker 对每个 GET 请求进行 **AWS V4 签名**，因为私有存储桶要求每个请求都必须签名认证
- 由于 GET 请求没有请求体，签名过程的额外开销极小
- Worker 无需将响应体读入内存，而是通过 Cloudflare Workers 框架直接流式传输给用户

---

## 3. 前提条件

开始之前，你需要准备：

1. **Backblaze B2 云存储账户**
   - 注册地址：[https://www.backblaze.com/b2/sign-up.html](https://www.backblaze.com/b2/sign-up.html)

2. **Cloudflare Workers 账户**
   - 注册地址：[https://dash.cloudflare.com/sign-up/workers](https://dash.cloudflare.com/sign-up/workers)
   - 免费套餐可以使用 `*.workers.dev` 子域名发布 Worker
   - 付费套餐可以绑定自定义域名

3. **Node.js**（版本 >= 16.17.0）
   - 下载地址：[https://nodejs.org/](https://nodejs.org/)
   - 建议使用 Volta 或 nvm 管理 Node.js 版本

---

## 4. 详细操作步骤

### 4.1 启用 Backblaze B2

1. 登录 [Backblaze Web 控制台](https://secure.backblaze.com/user_signin.htm)
2. 在右上角用户菜单中选择 **My Settings**
3. 在 **Enabled Products** 下，勾选 **B2 Cloud Storage**
4. 阅读并接受条款，点击 **OK**

### 4.2 创建私有存储桶（Bucket）

1. 登录 Backblaze Web 控制台
2. 在左侧导航菜单的 **B2 Cloud Storage** 下，点击 **Buckets**
3. 点击 **Create a Bucket**
4. 输入存储桶名称（例如 `my-private-bucket`）
   > 注意：存储桶名称必须是全局唯一的，如果名称已被使用会有提示
5. **隐私设置选择 Private（私有）**
   > 注意：你可以随时更改存储桶的隐私设置
6. 可选配置：
   - **服务端加密（Server-Side Encryption）**
   - **对象锁定（Object Lock）**：在指定时间内限制文件被修改或删除
   - **生命周期设置（Lifecycle Settings）**：控制文件的保留时间
7. 点击 **Create a Bucket**
8. **复制 Endpoint 字段的值**（例如 `s3.us-west-001.backblazeb2.com`），后续配置需要用到

### 4.3 创建应用程序密钥（Application Key）

1. 登录 Backblaze Web 控制台
2. 在左侧导航菜单的 **B2 Cloud Storage** 下，点击 **Application Keys**
3. 点击 **Add a New Application Key**
4. 输入密钥名称（最多 100 个字符，支持字母、数字和 `-`，不支持国际化字符）
5. **Allow Access to Bucket(s)**：选择 **All** 或指定刚才创建的存储桶
   > 如果选择特定存储桶，还可以勾选 **Allow List All Bucket Names**
6. **Access Type**（访问类型）：
   - 推荐选择 **Read Only（只读）**，因为 Worker 只需要下载文件
   - 如果需要上传等操作，可选择 **Read and Write**
7. （可选）**File Name Prefix**：限制密钥只能访问指定前缀的文件
8. （可选）**Expiration**：设置密钥过期时间（秒，需小于 1000 天）
9. 点击 **Create New Key**
10. **立即保存生成的 keyID 和 applicationKey！**
    > 安全提示：applicationKey 只会在创建时显示一次，之后无法再查看。务必将其复制并安全保存。

### 4.4 安装并配置 Cloudflare Workers CLI（Wrangler）

打开终端，安装 Wrangler 并登录：

```bash
npm install -g wrangler
```

或者通过 `npx` 使用（推荐跟随项目安装）：

```bash
npx wrangler login
```

运行 `wrangler login` 后，浏览器会打开 Cloudflare 登录页面，授权 Wrangler CLI 访问你的账户。

### 4.5 创建 Cloudflare Worker 项目

有两种方式创建项目：

#### 方式一：使用 C3 CLI 从模板创建（推荐）

```bash
npm create cloudflare@latest -- --template https://github.com/backblaze-b2-samples/cloudflare-b2 --deploy false my-b2-proxy
cd my-b2-proxy
npm install
```

#### 方式二：使用 Wrangler generate

```bash
npx wrangler generate my-b2-proxy https://github.com/backblaze-b2-samples/cloudflare-b2
cd my-b2-proxy
npm install
```

### 4.6 配置 Worker

编辑项目中的 `wrangler.toml` 文件，添加或修改 `[vars]` 部分：

```toml
name = "my-b2-proxy"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
B2_APPLICATION_KEY_ID = "<你的 Backblaze Application Key ID>"
B2_ENDPOINT = "<你的 S3 端点，例如 s3.us-west-001.backblazeb2.com>"
BUCKET_NAME = "$path"
ALLOW_LIST_BUCKET = "false"
```

#### 配置项说明

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `B2_APPLICATION_KEY_ID` | Backblaze Application Key ID | `001234567890abcdef00000001` |
| `B2_ENDPOINT` | 存储桶所在的 S3 端点 | `s3.us-west-001.backblazeb2.com` |
| `BUCKET_NAME` | 存储桶名称路由策略（见下文） | `"$path"` 或 `"my-bucket"` |
| `ALLOW_LIST_BUCKET` | 是否允许列出存储桶中的对象 | `"true"` 或 `"false"`（推荐） |

#### BUCKET_NAME 的三种路由策略

| 策略 | 值 | 说明 | URL 示例 |
|------|-----|------|----------|
| 固定存储桶 | `"my-bucket"` | 所有请求都指向指定存储桶 | `https://worker.example.com/path/to/file.png` |
| 路径解析 | `"$path"` | 使用 URL 路径的第一段作为存储桶名 | `https://worker.example.com/my-bucket/path/to/file.png` |
| 主机解析 | `"$host"` | 使用 URL 子域名的第一段作为存储桶名 | `https://my-bucket.worker.example.com/path/to/file.png` |

**注意**：
- 如果使用默认的 `*.workers.dev` 子域名，建议指定存储桶名称或将 `BUCKET_NAME` 设为 `"$path"`
- 使用 `$host` 时，必须为每个存储桶名称配置 [Route](https://developers.cloudflare.com/workers/platform/triggers/routes) 或 [Custom Domain](https://developers.cloudflare.com/workers/platform/triggers/custom-domains/)，不能直接路由 `*.example.com/*`

#### 其他可选配置

```toml
# 限制要签名的 HTTP 头（高级选项，见下文）
#ALLOWED_HEADERS = [
#    "content-type",
#    "range",
#    "x-amz-content-sha256",
#    "x-amz-date",
#]

# 启用 rclone 下载端点支持
#RCLONE_DOWNLOAD = "true"
```

### 4.7 设置安全密钥

**绝对不要**将 `B2_APPLICATION_KEY`（Secret）写在 `wrangler.toml` 中！应使用 Cloudflare 的 Secrets 功能：

```bash
echo "<你的 Backblaze Application Key>" | npx wrangler secret put B2_APPLICATION_KEY
```

或者通过 Cloudflare Dashboard 设置：
1. 登录 Cloudflare Dashboard
2. 进入 **Workers & Pages** > 选择你的 Worker
3. 点击 **Settings** > **Variables**
4. 点击 **Edit Variables**
5. 添加变量名：`B2_APPLICATION_KEY`，值：你的 Application Key
6. 勾选 **Encrypt**，点击 **Save and deploy**

#### 本地开发模式

Wrangler 的本地开发服务器无法访问 Secrets，需要创建 `.dev.vars` 文件：

```bash
cp .dev.vars.template .dev.vars
```

编辑 `.dev.vars`：

```bash
B2_APPLICATION_KEY = "<你的 Backblaze Application Key>"
```

### 4.8 部署 Worker

```bash
npx wrangler deploy
```

如果尚未配置子域名，Wrangler 会在发布过程中提示你设置一个。

部署完成后，你的 Worker 地址为：

```text
https://my-b2-proxy.<你的子域名>.workers.dev
```

#### 配置自定义域名（可选）

1. 在 Cloudflare Dashboard 中进入你的域名
2. 添加 DNS 记录（例如 `images.acme.com`）指向 Worker
3. 在 Worker 的 **Triggers** > **Custom Domains** 中添加域名

### 4.9 配置存储桶的缓存指令

由于 Worker 在请求私有存储桶时会在 `Authorization` 头中携带签名，Cloudflare **默认不会缓存**带有 `Authorization` 头的请求。因此，需要配置存储桶的 Bucket Info 来添加 `Cache-Control` 指令：

1. 登录 Backblaze 账户
2. 左侧导航菜单点击 **Buckets**
3. 找到你的存储桶，点击 **Bucket Settings**
4. 在 **Bucket Info** 字段中输入：

```json
{"Cache-Control":"public"}
```

如果需要更精细的缓存控制，例如缓存一天：

```json
{"Cache-Control": "public, max-age=86400"}
```

5. 点击 **Update Bucket**

> **为什么需要这一步？**
>
> 默认情况下，Cloudflare 不会缓存带有 `Authorization` 头的请求响应。通过在 Bucket Info 中设置 `Cache-Control: public`，可以显式告诉 Cloudflare 即使请求包含认证信息也允许缓存，从而充分利用 CDN 的缓存优势。

### 4.10 更新网页链接

将网页中所有直接指向 B2 存储桶的链接替换为指向 Cloudflare Worker 的链接：

| 修改前 | 修改后 |
|--------|--------|
| `https://acme-images.s3.us-west-001.backblazeb2.com/logos/acme.png` | `https://images.acme.com/logos/acme.png`（固定存储桶） |
| | `https://images.acme.com/acme-images/logos/acme.png`（`$path` 模式） |

### 4.11 将存储桶设为私有并验证

1. **验证 Worker 正常工作**：在浏览器中访问 Worker 的 URL，确认能正常获取文件
2. **更改存储桶为私有**：
   - 在 Backblaze 控制台的 Bucket 设置中，将隐私设置修改为 **Private**
3. **验证直接访问被阻止**：
   - 尝试直接通过 B2 端点 URL 访问文件
   - 应该收到 **403 Forbidden** 错误
   - 而通过 Worker URL 访问仍然正常

---

## 5. 高级配置

### 5.1 存储桶名称路由策略

#### `$path` 模式

URL 路径的第一段被用作存储桶名称。适合需要代理多个存储桶的场景。

```
https://worker.example.com/bucket-alpha/logos/acme.png
                           └─ 存储桶名 ─┘
```

#### `$host` 模式

URL 主机名的第一级子域名被用作存储桶名称。

```
https://bucket-alpha.worker.example.com/logos/acme.png
       └─ 存储桶名 ─┘
```

**注意**：使用 `$host` 时，必须为每个存储桶单独配置 Route 或 Custom Domain。

### 5.2 限制签名 HTTP 头

默认情况下，Worker 会签名并转发所有客户端 HTTP 头（除 `cf-*`、`x-forwarded-proto`、`x-real-ip`、`accept-encoding` 以及条件头 `if-match`、`if-modified-since` 等之外）。

可以通过配置 `ALLOWED_HEADERS` 来限制被签名的头：

```toml
[vars]
ALLOWED_HEADERS = [
    "content-type",
    "date",
    "host",
    "range",
    "x-amz-content-sha256",
    "x-amz-date",
    "x-amz-server-side-encryption-customer-algorithm",
    "x-amz-server-side-encryption-customer-key",
    "x-amz-server-side-encryption-customer-key-md5"
]
```

> **注意**：
> - 如果设置了 `ALLOWED_HEADERS`，只有列出的头会被包含在签名中，外加 `authorization`、`x-amz-content-sha256` 和 `x-amz-date` 这三个必需头
> - 如果 `x-amz-content-sha256` 不在列表中，传入请求中的该头将被丢弃，传出请求中设为 `UNSIGNED-PAYLOAD`
> - HTTP 头不区分大小写，`host` 会匹配 `host`、`Host` 和 `HOST`

### 5.3 Rclone 下载端点

如果使用 [Rclone](https://rclone.org/b2/) 进行文件同步，可以通过 `--b2-download-url` 选项指定自定义下载端点：

```toml
[vars]
RCLONE_DOWNLOAD = "true"
```

启用后，Worker 会从 URL 路径中移除 `file/` 前缀（因为 Rclone 使用 B2 Native API 的友好下载 URL 格式）。

**使用示例**：

```bash
rclone copy --b2-download-url https://my-b2-proxy.my-subdomain.workers.dev \
  myremote:my-bucket/path/to/file.txt /local/path/
```

### 5.4 大文件 Range 请求处理

对于大于约 2GB 的文件，Cloudflare 在处理 Range 请求时可能会返回整个文件而不是请求的范围。Worker 中包含了重试逻辑来处理这个问题：

- 如果请求包含 `range` 头，Worker 检查响应中是否包含 `content-range` 头
- 如果没有，自动中止请求并重试（最多 3 次）
- 如果 3 次后仍没有 `content-range`，返回最后一次的响应而不是报错

### 5.5 Webhook 通知（cloudflare-b2-proxy）

如果使用 [`cloudflare-b2-proxy`](https://github.com/backblaze-b2-samples/cloudflare-b2-proxy) 仓库，可以配置 Webhook URL 来接收每个请求的通知：

```toml
[vars]
WEBHOOK_URL = "https://api.example.com/webhook/1"
```

Webhook 发送的 JSON 负载示例：

```json
{
  "contentLength": 14,
  "contentType": "text/plain",
  "method": "PUT",
  "signatureTimestamp": "20220224T193204Z",
  "status": 200,
  "url": "https://s3.us-west-004.backblazeb2.com/my-private-bucket/tester.txt"
}
```

通知是**异步**触发的，不会延迟对客户端的响应。

---

## 6. 源码核心逻辑解读

Backblaze 提供了两个相关的开源仓库，适用于不同的场景。

### 6.1 cloudflare-b2（简化版代理）

适用于「私有存储桶 + 只读下载」场景。

**仓库地址**：<https://github.com/backblaze-b2-samples/cloudflare-b2>

**核心逻辑**：

1. **方法限制**：只允许 `GET` 和 `HEAD` 请求，其他方法返回 405
2. **URL 重写**：根据 `BUCKET_NAME` 配置（固定值 / `$path` / `$host`）将请求的 host 重写为 B2 端点
3. **AWS V4 签名**：使用 `aws4fetch` 库和配置的密钥对请求进行签名
4. **HEAD 请求处理**：Cloudflare 会将 HEAD 转为 GET，所以 Worker 发送 GET 请求，但返回时移除响应体
5. **Range 请求重试**：针对大文件的 Range 请求添加重试逻辑
6. **Rclone 支持**：移除 `file/` 前缀以配合 Rclone 的 `--b2-download-url`

**核心代码片段**：

```javascript
import { AwsClient } from 'aws4fetch';

export default {
  async fetch(request, env) {
    // 只允许 GET 和 HEAD
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 405, statusText: "Method Not Allowed" });
    }

    const url = new URL(request.url);
    // 确保使用 HTTPS
    url.protocol = "https:";
    url.port = "443";

    // 根据 BUCKET_NAME 策略设置目标 host
    switch (env['BUCKET_NAME']) {
      case "$path":
        url.hostname = env['B2_ENDPOINT'];
        break;
      case "$host":
        url.hostname = url.hostname.split('.')[0] + '.' + env['B2_ENDPOINT'];
        break;
      default:
        url.hostname = env['BUCKET_NAME'] + "." + env['B2_ENDPOINT'];
        break;
    }

    // 创建 S3 客户端并签名请求
    const client = new AwsClient({
      "accessKeyId": env['B2_APPLICATION_KEY_ID'],
      "secretAccessKey": env['B2_APPLICATION_KEY'],
      "service": "s3",
    });

    const signedRequest = await client.sign(url.toString(), {
      method: 'GET',
      headers: headers
    });

    // 发送签名后的请求到 B2
    return fetch(signedRequest);
  },
};
```

### 6.2 cloudflare-b2-proxy（带签名验证的完整代理）

适用于「需要双向签名验证 + Webhook 通知」的场景，支持上传（PUT）等操作。

**仓库地址**：<https://github.com/backblaze-b2-samples/cloudflare-b2-proxy>

**与简化版的区别**：

| 特性 | cloudflare-b2 | cloudflare-b2-proxy |
|------|---------------|---------------------|
| 方法支持 | 仅 GET/HEAD | 所有 S3 方法（包括 PUT） |
| 签名验证 | 只对传出请求签名 | 验证传入请求 + 重新签名传出请求 |
| Webhook | 不支持 | 支持异步 Webhook 通知 |
| 适用场景 | 公开只读下载 | 安全代理所有 S3 API 操作 |

**核心逻辑**：

1. **验证传入请求签名**：验证客户端请求的 AWS V4 签名是否使用配置的密钥
2. **重新签名传出请求**：用相同的密钥重新签名转发给 B2 的请求
3. **异步 Webhook**：将请求元数据 POST 到配置的 Webhook URL

**使用示例**（使用 AWS CLI）：

```bash
export AWS_ACCESS_KEY_ID=<你的 b2 application key id>
export AWS_SECRET_ACCESS_KEY=<你的 b2 application key>
export AWS_REGION=<你的 b2 bucket 的区域>

# 上传文件
aws s3 cp --endpoint-url https://my-proxy.my-subdomain.workers.dev \
  hello.txt s3://my-bucket/hello.txt
```

---

## 7. 总结

通过本文的步骤，你可以搭建一个完整的架构，确保用户只能通过 Cloudflare CDN 访问 Backblaze B2 存储桶中的内容，而无法直接访问：

### 架构优势

| 优势 | 说明 |
|------|------|
| 🚀 **性能提升** | Cloudflare CDN 将内容缓存到离用户最近的节点，大幅降低延迟 |
| 💰 **零传输费用** | 通过 Bandwidth Alliance，B2 → Cloudflare 的数据传输完全免费 |
| 🔒 **安全性** | 存储桶设为私有，所有请求必须通过 Worker 签名认证 |
| 🎯 **灵活路由** | 支持单个或多个存储桶，支持路径/主机名解析 |
| 📦 **丰富的生态** | 支持 Rclone、AWS CLI、S3 SDK 等多种工具 |

### 多仓库选择建议

- 如果你只需要**只读下载代理**：使用 [`cloudflare-b2`](https://github.com/backblaze-b2-samples/cloudflare-b2)
- 如果你需要**完整的 S3 API 代理**（上传/下载/Webhook）：使用 [`cloudflare-b2-proxy`](https://github.com/backblaze-b2-samples/cloudflare-b2-proxy)

---

> 本文档是基于 Backblaze 官方博客和技术文档整理的中文操作指南，内容截至 2026 年 7 月。
> 实际使用时，请参考各官方仓库的最新文档和版本更新。
