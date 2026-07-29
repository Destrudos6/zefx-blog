# 06 — 样式与 CSS

## 作用域样式 (Scoped Styles)

Astro 的 `<style>` 标签默认**自动作用域化**——样式只作用于当前组件。

```astro
<style>
  /* 这个样式只会作用于当前组件中的 <h1> */
  h1 { color: red; }
  .text { color: blue; }
</style>
```

编译后变成：

```css
h1[data-astro-cid-hhnqfkh6] { color: red; }
.text[data-astro-cid-hhnqfkh6] { color: blue; }
```

### 作用域样式特点

- ✅ 不会泄漏到其他组件
- ✅ 可以使用低特异性选择器（如 `h1 {}`）
- ❌ 不会影响子组件（父子组件样式隔离）

### 向子组件传递 class

```astro
---
// 子组件中接收 class
const { class: className, ...rest } = Astro.props;
---
<div class={className} {...rest}>
  <slot/>
</div>
```

```astro
---
// 父组件使用
---
<style>
  .red { color: red; }
</style>
<MyComponent class="red">This will be red!</MyComponent>
```

---

## 全局样式

### 使用 `is:global` 属性

```astro
<style is:global>
  /* 全局样式，作用于所有 <h1> */
  h1 { color: red; }
</style>
```

### 混合全局与作用域样式

```astro
<style>
  /* 仅作用于本组件 */
  h1 { color: red; }

  /* 作用于子元素中的 <h1> */
  article :global(h1) {
    color: blue;
  }
</style>
```

---

## 外部样式

### 导入本地 CSS 文件

```astro
---
// 在组件脚本中导入（推荐）
import '../styles/global.css';
import '../styles/utils.css';
---
```

### 通过 `<link>` 标签加载

```astro
<!-- 从 public/ 目录加载（不经构建处理） -->
<link rel="stylesheet" href="/styles/global.css" />

<!-- 从外部 CDN 加载 -->
<link rel="stylesheet" href="https://cdn.example.com/styles.css" />
```

### 导入 npm 包中的 CSS

```astro
---
// 直接导入（包名需要包含文件扩展名）
import 'prismjs/themes/prism-tomorrow.css';
---
```

如果 npm 包的文件名不包含扩展名，需要在配置中添加：

```javascript
// astro.config.mjs
export default defineConfig({
  vite: {
    ssr: {
      noExternal: ['package-name'],
    }
  }
});
```

---

## CSS 变量

```astro
---
const foregroundColor = "rgb(221 243 228)";
const backgroundColor = "rgb(24 121 78)";
---

<style define:vars={{ foregroundColor, backgroundColor }}>
  h1 {
    background-color: var(--backgroundColor);
    color: var(--foregroundColor);
  }
</style>
```

---

## `class:list` 指令

动态合并 class 名（基于 clsx 库）：

```astro
---
const isActive = true;
const isLarge = false;
---

<!-- 数组 -->
<div class:list={['box', 'rounded']} />

<!-- 对象（truthy 值的 key 被添加） -->
<div class:list={[{ active: isActive, large: isLarge }]} />

<!-- 混合 -->
<div class:list={['btn', { active: isActive }]} />

<!-- false / null / undefined 自动跳过 -->
<div class:list={['a', null, 'b', undefined]} />
```

---

## 内联样式

```astro
<!-- 字符串形式 -->
<p style="color: brown; text-decoration: underline;">文本</p>

<!-- 对象形式 -->
<p style={{ color: "brown", textDecoration: "underline" }}>文本</p>
```

---

## CSS 层叠顺序

Astro 中的 CSS 优先级（从低到高）：

1. **`<link>` 标签**（最低优先级）
2. **导入的样式表**
3. **作用域样式**（最高优先级）

**注意：** 同特异性下，作用域样式总是最后出现，因此优先级更高。但更高特异性的导入样式仍会覆盖作用域样式。

示例：

```astro
---
import './make-it-purple.css';   // 包含 h1 { color: purple; }
---
<style>
  h1 { color: red; }             // 作用是域，优先级更高
</style>
<h1>I will be red!</h1>
```

但如果导入样式有更高特异性：

```css
/* make-it-purple.css */
#intro { color: purple; }
```

```astro
<h1 id="intro">I will be purple!</h1>  <!-- ID 选择器优先 -->
```

---

## Tailwind CSS

### 安装 Tailwind 4（推荐）

```bash
npx astro add tailwind
```

安装后在 CSS 文件中导入：

```css
/* src/styles/global.css */
@import "tailwindcss";
```

在 Layout 中引入：

```astro
---
import '../styles/global.css';
---
```

### 从 Tailwind 3 升级到 4

```bash
# 1. 安装 Tailwind 4
npx astro add tailwind

# 2. 卸载旧的 Tailwind 3 集成
npm uninstall @astrojs/tailwind

# 3. 从 astro.config.mjs 中移除 @astrojs/tailwind 集成
# 4. 按照 Tailwind 升级指南调整配置
```

---

## 支持的 CSS 预处理器

| 预处理器 | 安装方式 |
|----------|----------|
| Sass/SCSS | 直接使用 `.scss` 文件扩展名 |
| Less | 安装并配置 Vite 插件 |

**Sass 使用示例：**

```astro
---
import '../styles/global.scss';
---
```

无需额外配置，Astro 原生支持 Sass（需安装 `sass` 包）。
