# 10 — 按需渲染与 API 端点

## 渲染模式概述

| 模式 | 默认行为 | 配置文件 |
|------|----------|----------|
| **`static`** (静态) | 所有页面在构建时预渲染为 HTML | `output: 'static'`（默认） |
| **`server`** (服务端) | 所有页面在请求时按需渲染 | `output: 'server'` |
| **`hybrid`** (混合) | 默认预渲染，导出 `prerender = false` 的页面按需渲染 | `output: 'hybrid'` |

---

## 启用按需渲染（SSR）

### 1. 安装适配器 (Adapter)

SSR 需要适配器来运行在特定服务端环境：

```bash
# Node.js
npx astro add node

# Netlify
npx astro add netlify

# Vercel
npx astro add vercel

# Cloudflare
npx astro add cloudflare
```

### 2. 配置渲染模式

**方式一：按页面开启（hybrid 模式）**

```astro
---
// 此页面按需渲染，其余页面保持静态
export const prerender = false;
---

<html>
  <!-- 每次请求时在服务端渲染 -->
  <h1>随机数: {Math.random()}</h1>
</html>
```

**方式二：全局开启（server 模式）**

```javascript
// astro.config.mjs
export default defineConfig({
  output: 'server',
  adapter: netlify(),  // 或 node() / vercel() 等
});
```

然后在个别页面关闭 SSR：

```astro
---
// 此页面仍预渲染为静态
export const prerender = true;
---
```

> 💡 提示：默认用 `static` 模式，直到确定大部分页面都需要 SSR 再切换。

---

## SSR 提供的能力

### HTML 流式传输

Astro 在 SSR 中使用流式传输，组件渲染完成后立即发送到浏览器。这意味着用户能更快看到页面内容。

### Cookie 操作

```astro
---
export const prerender = false;

let counter = 0;
if (Astro.cookies.has('counter')) {
  const cookie = Astro.cookies.get('counter');
  const value = cookie?.number();
  if (value !== undefined && !isNaN(value)) counter = value + 1;
}
Astro.cookies.set('counter', String(counter));
---

<h1>Counter = {counter}</h1>
```

### 响应状态和头

```astro
---
export const prerender = false;

if (!product) {
  Astro.response.status = 404;
  Astro.response.statusText = 'Not found';
}

Astro.response.headers.set('Cache-Control', 'public, max-age=3600');
---
```

也可以用 `Response` 对象：

```astro
---
if (!product) {
  return new Response(null, {
    status: 404,
    statusText: 'Not found'
  });
}
---
```

### Request 对象

```astro
---
const url = Astro.request.url;
const method = Astro.request.method;
const cookie = Astro.request.headers.get('cookie');
---
```

---

## API 端点 (Endpoints)

端点用于生成非 HTML 数据：JSON、RSS、图片等。

### 静态端点

```typescript
// src/pages/api/data.json.ts → 生成 /api/data.json
export function GET({ params, request }) {
  return new Response(
    JSON.stringify({
      name: "Astro",
      url: "https://astro.build/",
    }),
  );
}
```

### 动态端点（带路由参数）

```typescript
// src/pages/api/[id].json.ts
import type { APIRoute } from "astro";

const usernames = ["Sarah", "Chris", "Yan"];

export const GET = (({ params }) => {
  const id = Number(params.id);
  return new Response(
    JSON.stringify({ name: usernames[id] }),
  );
}) satisfies APIRoute;

export function getStaticPaths() {
  return usernames.map((_, i) => ({ params: { id: String(i) } }));
}
```

### 服务端端点 (API Routes)

SSR 模式下，端点支持完整的 HTTP 方法：

```typescript
// src/pages/api/products/[id].json.ts
import type { APIRoute } from "astro";
import { getProduct } from "../db";

export const prerender = false;

export const GET = (async ({ params }) => {
  const product = await getProduct(params.id);

  if (!product) {
    return new Response(null, {
      status: 404,
      statusText: "Not found",
    });
  }

  return new Response(JSON.stringify(product), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) satisfies APIRoute;
```

### 支持所有 HTTP 方法

```typescript
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ params }) => { /* ... */ };
export const POST: APIRoute = ({ request }) => { /* ... */ };
export const PUT: APIRoute = ({ request }) => { /* ... */ };
export const DELETE: APIRoute = ({ request }) => { /* ... */ };
// ALL 匹配所有未定义的方法
export const ALL: APIRoute = ({ request }) => { /* ... */ };
```

### POST 请求处理

```typescript
import type { APIRoute } from "astro";

export const POST = (async ({ request }) => {
  if (request.headers.get("Content-Type") === "application/json") {
    const body = await request.json();
    const name = body.name;
    return new Response(
      JSON.stringify({ message: "Hello, " + name }),
      { status: 200 },
    );
  }
  return new Response(null, { status: 400 });
}) satisfies APIRoute;
```

---

## 服务端岛屿 (Server Islands)

将个性化/动态内容的渲染延迟到请求时，不阻塞页面主要内容的渲染：

```astro
---
import Avatar from "../components/Avatar.astro";
import PriceDisplay from "../components/PriceDisplay.astro";
---

<!-- 页面主要内容立即渲染 -->
<h1>商品名称</h1>
<p>商品描述...</p>

<!-- 个性化内容延迟加载 -->
<Avatar server:defer>
  <svg slot="fallback" class="generic-avatar">...</svg>
</Avatar>

<PriceDisplay server:defer>
  <p slot="fallback">加载价格中...</p>
</PriceDisplay>
```

### 适用场景

- 用户头像/个人信息
- 商品价格（实时更新）
- 用户评价
- 实时库存

---

## 注意事项

1. **重定向必须在页面级别**执行，不能在子组件中
2. **修改 Response Headers** 也必须在页面级别
3. **SSR 需要适配器**，不同适配器有不同配置
4. **默认用静态模式**，只在需要时才启用 SSR
5. **服务端端点中的 `request` 是完整的 Request 对象**（SSR 模式）
