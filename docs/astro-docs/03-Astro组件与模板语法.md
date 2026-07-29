# 03 — Astro 组件与模板语法

## 组件结构

每个 `.astro` 文件由两部分组成：

```astro
---
// ═══════════════════════════════════════
// 组件脚本 (Component Script) — 服务端运行
// ═══════════════════════════════════════

import SomeComponent from './SomeComponent.astro';
import someData from '../data/data.json';

// 接收 props
const { title, name } = Astro.props;

// 获取外部数据（安全！不会暴露给客户端）
const data = await fetch('API_URL').then(r => r.json());

// 创建变量
const items = ["Dog", "Cat", "Bird"];
---

<!-- ═══════════════════════════════════════ -->
<!-- 组件模板 (Component Template) — HTML 输出 -->
<!-- ═══════════════════════════════════════ -->

<h1>{title}</h1>

{items.map(item => <li>{item}</li>)}

<SomeComponent prop={name} />
```

### 关键规则

- `---` 之间的代码称为**代码栅栏 (code fence)**
- 栅栏内的代码仅在**服务端**运行，不会泄露到浏览器
- 栅栏内的代码支持 TypeScript
- 任何有效的 HTML 都是有效的 Astro 模板

---

## 模板表达式

### 变量插值

```astro
---
const name = "Astro";
const count = 42;
---

<h1>Hello {name}!</h1>         <!-- Hello Astro! -->
<p>Count: {count}</p>          <!-- Count: 42 -->
```

### 动态属性

```astro
---
const className = "active";
const href = "/about";
---

<a href={href} class={className}>About</a>
```

### 动态 HTML

```astro
---
const items = ["Dog", "Cat", "Bird"];
const visible = true;
const showA = true;
---

<ul>
  {items.map(item => <li>{item}</li>)}
</ul>

{visible && <p>显示我</p>}

{visible ? <p>显示我</p> : <p>否则显示我</p>}

{showA && <ComponentA />}
```

### 动态标签

```astro
---
const Element = 'div';  // 变量名必须首字母大写
---

<Element>Hello!</Element>  <!-- 渲染为 <div>Hello!</div> -->
```

### Fragments

```astro
---
const htmlString = '<p>Raw HTML</p>';
---

<Fragment set:html={htmlString} />

<!-- 也可以使用简写 <> </> -->
<>
  <h1>Title</h1>
  <p>Paragraph</p>
</>
```

---

## Astro vs JSX 差异

| 特性 | Astro | JSX (React) |
|------|-------|-------------|
| HTML 属性 | `kebab-case` (`class`, `data-value`) | `camelCase` (`className`, `dataValue`) |
| 多根元素 | ✅ 支持 | ❌ 必须用 Fragment 包裹 |
| 注释 | `<!-- HTML -->` 和 `{/* JS */}` 都支持 | `{/* JS */}` 只有 JS 风格 |
| 事件处理 | 用 `<script>` + `addEventListener` | `onClick={handler}` |
| 响应式 | ❌ 不响应，一次渲染 | ✅ 状态变化自动更新 |

---

## 组件 Props（属性）

```astro
---
// 方式 1: 直接解构
const { greeting, name } = Astro.props;

// 方式 2: 带默认值
const { greeting = "Hello", name = "Astronaut" } = Astro.props;

// 方式 3: TypeScript 类型定义（推荐）
interface Props {
  name: string;
  greeting?: string;    // 可选属性
}
const { greeting = "Hello", name } = Astro.props;
---
```

---

## Slots（插槽）

插槽用于在组件中注入子元素：

### Layout 组件中的插槽

```astro
---
// src/layouts/BaseLayout.astro
---
<html lang="zh">
  <head>
    <meta charset="utf-8" />
    <title>{title}</title>
  </head>
  <body>
    <header>网站导航</header>
    <main>
      <slot />  <!-- 子内容将在这里渲染 -->
    </main>
    <footer>页脚</footer>
  </body>
</html>
```

### 具名插槽 (Named Slots)

```astro
// 定义组件
<div class="card">
  <header><slot name="header" /></header>
  <main><slot /></main>
  <footer><slot name="footer" /></footer>
</div>

// 使用组件
<Card>
  <h1 slot="header">卡片标题</h1>
  <p>卡片主体内容（默认插槽）</p>
  <p slot="footer">页脚内容</p>
</Card>
```

---

## Astro 内置对象

### `Astro.props` — 组件接收的属性

```astro
---
const { title } = Astro.props;
---
```

### `Astro.params` — 路由参数

```astro
---
// 对于路由 /posts/[slug].astro
const { slug } = Astro.params;
---
```

### `Astro.request` — HTTP 请求对象

```astro
---
const url = Astro.request.url;
const cookie = Astro.request.headers.get('cookie');
---
```

### `Astro.response` — HTTP 响应对象

```astro
---
Astro.response.status = 404;
Astro.response.headers.set('Cache-Control', 'public, max-age=3600');
---
```

### `Astro.redirect()` — 重定向

```astro
---
return Astro.redirect('/login', 302);
---
```

### `Astro.cookies` — Cookie 操作

```astro
---
Astro.cookies.set('counter', '42');
const val = Astro.cookies.get('counter');
---
```

### `Astro.generator` — 版本标记

```html
<meta name="generator" content={Astro.generator} />
```

### `Astro.url` — 请求 URL 对象

```astro
---
const pathname = Astro.url.pathname;
---
```

---

## 组件指令参考 (Directives)

### 通用指令

| 指令 | 用法 | 说明 |
|------|------|------|
| `class:list` | `class:list={['a', {b: true}]}` | 动态合并 class 名 |
| `set:html` | `set:html={htmlString}` | 直接注入 HTML（⚠️ 注意 XSS 风险） |
| `set:text` | `set:text={text}` | 设置文本内容（自动转义） |
| `define:vars` | `define:vars={{color}}` | 将服务端变量传到 `<style>` 或 `<script>` |

### 客户端指令

| 指令 | 说明 |
|------|------|
| `client:load` | 页面加载时立即加载 JS |
| `client:idle` | 浏览器空闲时加载 |
| `client:visible` | 组件进入视口时加载 |
| `client:media={QUERY}` | 匹配媒体查询时加载 |
| `client:only={FRAMEWORK}` | 仅客户端渲染（不进行服务端渲染） |

### 服务端指令

| 指令 | 说明 |
|------|------|
| `server:defer` | 延迟服务端渲染（服务端岛屿） |

### 其他指令

| 指令 | 说明 |
|------|------|
| `is:raw` | 将子元素视为纯文本，不处理 Astro 语法 |
| `is:inline` | 不对 `<script>` 或 `<style>` 进行打包处理 |

### `class:list` 详细用法

```astro
---
const isActive = true;
const isLarge = false;
---

<!-- 字符串 -->
<div class:list={['hello', 'goodbye']} />         <!-- class="hello goodbye" -->

<!-- 对象（truthy 的 key 会被添加） -->
<div class:list={[{ active: isActive, large: isLarge }]} />  <!-- class="active" -->

<!-- 混合 -->
<div class:list={['base', { active: isActive }]} />          <!-- class="base active" -->

<!-- false/null/undefined 自动跳过 -->
<div class:list={['a', null, 'b', undefined, false]} />      <!-- class="a b" -->
```
