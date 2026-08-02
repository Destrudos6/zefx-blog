/**
 * 文章列表分类筛选脚本（posts/index.astro 与 posts/[page].astro 共用）。
 * 在 define:vars 注入 catMap 后调用 initCategoryFilter()。
 */
export function initCategoryFilter(catMap: Record<string, string>) {
  (function () {
    const buttons = document.querySelectorAll('.cat-btn');
    const grid = document.getElementById('posts-grid');
    if (!grid) return;
    const items = grid.querySelectorAll('.post-card');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => {
          b.classList.remove('on');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('on');
        btn.setAttribute('aria-pressed', 'true');
        const label = btn.dataset.label;
        const en =
          Object.entries(catMap).find((v) => v[1] === label)?.[0] || '';
        history.replaceState(null, '', en ? '#' + en : window.location.pathname);
        let visibleCount = 0;
        items.forEach((item) => {
          const show = label === '全部' || item.dataset.category === label;
          item.style.display = show ? '' : 'none';
          if (show) visibleCount++;
        });
        grid.style.setProperty('display', visibleCount > 0 ? 'grid' : 'none');
      });
    });
    const hash = window.location.hash.slice(1);
    if (hash) {
      const zhLabel = catMap[hash] || hash;
      const target = document.querySelector('.cat-btn[data-label="' + zhLabel + '"]');
      if (target) (target as HTMLButtonElement).click();
    }
  })();
}
