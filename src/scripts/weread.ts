/**
 * 微信读书模块：阅读统计渲染、最近在读、已读完书架、书籍详情弹窗。
 *
 * 从 stats.astro 的内联脚本中抽出，通过 initWeread() 一次性初始化
 * （绑定 tab 切换、弹窗遮罩并触发数据加载）。依赖 heatmap 的 fetchTimeout。
 */

import { fetchTimeout } from './heatmap';

// ---------- 模块状态 ----------
var wrData = null;
var wrMode = 'monthly';
var wrFinishedExpanded = false;

// ---------- 工具 ----------
function wrDur(sec) {
  sec = Number(sec) || 0;
  var h = Math.floor(sec / 3600);
  var m = Math.round((sec % 3600) / 60);
  if (h >= 100) return h + ' 小时';
  if (h > 0) return h + ' 时 ' + m + ' 分';
  return m + ' 分钟';
}
function wrDate(ts) {
  if (!ts) return '';
  var d = new Date(Number(ts) * 1000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function wrCover(b) {
  if (b && b.cover) return b.cover;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="#eee"/><text x="50" y="75" font-size="11" text-anchor="middle" fill="#999">' + ((b && b.title) || '书') + '</text></svg>');
}

// ---------- 统计 tab 渲染 ----------
function wrRenderStats() {
  var s = wrData && wrData.stats ? wrData.stats[wrMode] : null;
  if (!s) return;
  function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  set('wr-days', (s.readDays || 0) + ' 天');
  set('wr-time', wrDur(s.totalReadTime));
  set('wr-avg', wrDur(s.dayAverageReadTime));
  var cmp = s.compare == null ? '–' : (s.compare > 0 ? '↑ ' + Math.round(s.compare * 100) + '%' : (s.compare < 0 ? '↓ ' + Math.round(Math.abs(s.compare) * 100) + '%' : '持平'));
  set('wr-compare', cmp);
  var box = document.getElementById('wr-longest');
  if (!box) return;
  box.innerHTML = '';
  var longest = s.readLongest || [];
  if (!longest.length) return;
  var head = document.createElement('div');
  head.className = 'wr-longest-head mono';
  head.textContent = '读书排行 · 读得最多';
  box.appendChild(head);
  var max = 1;
  longest.forEach(function (x) { var v = Number(x.readTime) || 0; if (v > max) max = v; });
  longest.slice(0, 8).forEach(function (x) {
    var name = x.book ? x.book.title : (x.albumInfo ? x.albumInfo.name : '未知');
    var sub = x.book ? x.book.author : (x.albumInfo ? x.albumInfo.authorName : '');
    var row = document.createElement('div');
    row.className = 'wr-bar-row';
    var lab = document.createElement('span');
    lab.className = 'wr-bar-label';
    lab.textContent = name;
    row.appendChild(lab);
    var track = document.createElement('span');
    track.className = 'wr-bar-track';
    var fill = document.createElement('span');
    fill.className = 'wr-bar-fill';
    fill.style.width = Math.max(2, Math.round((Number(x.readTime) || 0) / max * 100)) + '%';
    track.appendChild(fill);
    row.appendChild(track);
    var val = document.createElement('span');
    val.className = 'wr-bar-val mono';
    val.textContent = wrDur(x.readTime);
    row.appendChild(val);
    if (sub) {
      var mini = document.createElement('div');
      mini.className = 'wr-bar-mini';
      mini.textContent = sub;
      lab.appendChild(mini);
    }
    box.appendChild(row);
  });
}

// ---------- 书籍详情弹窗 ----------
function wrOpenBook(bookId) {
  var modal = document.getElementById('wr-modal');
  var box = document.getElementById('wr-modal-box');
  if (!modal || !box) return;
  modal.hidden = false;
  box.innerHTML = '<div class="wr-modal-loading mono">加载中…</div>';
  fetchTimeout('/api/stats-weread/book?bookId=' + encodeURIComponent(bookId), 15000)
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      if (d.error) throw new Error(d.error);
      var info = d.info || {};
      var prog = d.progress || {};
      box.innerHTML = '';

      // 头部：封面 + 基本信息
      var head = document.createElement('div');
      head.className = 'wr-modal-head';
      var img = document.createElement('img');
      img.className = 'wr-modal-cover';
      img.src = wrCover(info);
      img.alt = info.title || '';
      head.appendChild(img);
      var meta = document.createElement('div');
      meta.className = 'wr-modal-meta';
      var t = document.createElement('h3');
      t.textContent = info.title || '未知书名';
      meta.appendChild(t);
      var byline = document.createElement('p');
      byline.textContent = [info.author, info.translator ? '译 ' + info.translator : '', info.publisher].filter(Boolean).join(' · ');
      meta.appendChild(byline);
      // 分类 + 评分 + ISBN 标签
      var chips = document.createElement('div');
      chips.className = 'wr-modal-chips';
      if (info.category) {
        var chip = document.createElement('span');
        chip.className = 'wr-chip';
        chip.textContent = info.category;
        chips.appendChild(chip);
      }
      if (info.newRating) {
        var rating = document.createElement('span');
        rating.className = 'wr-chip wr-chip-rating';
        rating.textContent = '★ ' + Number(info.newRating).toFixed(1) + (info.newRatingCount ? '（' + info.newRatingCount + ' 人）' : '');
        chips.appendChild(rating);
      }
      if (info.isbn) {
        var isbn = document.createElement('span');
        isbn.className = 'wr-chip mono';
        isbn.textContent = 'ISBN ' + info.isbn;
        chips.appendChild(isbn);
      }
      meta.appendChild(chips);
      // 阅读进度
      if (prog.progress != null) {
        var pbar = document.createElement('div');
        pbar.className = 'wr-modal-progress';
        pbar.textContent = '阅读进度：' + (prog.progress === 100 ? '已完成' : prog.progress + '%');
        meta.appendChild(pbar);
      }
      // 跳转微信读书
      var actions = document.createElement('div');
      actions.className = 'wr-modal-actions';
      if (info.deepLink) {
        var link = document.createElement('a');
        link.className = 'wr-modal-open';
        link.href = info.deepLink;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '在微信读书打开 ↗';
        actions.appendChild(link);
      }
      meta.appendChild(actions);
      head.appendChild(meta);
      box.appendChild(head);

      // 简介
      if (info.intro) {
        var intro = document.createElement('p');
        intro.className = 'wr-modal-intro';
        intro.textContent = info.intro;
        box.appendChild(intro);
      }

      // 热门划线（占满弹窗宽度；桌面端横向排版，移动端竖向）
      if (d.highlights && d.highlights.length) {
        var hSec = document.createElement('div');
        hSec.className = 'wr-modal-sec';
        var hTitle = document.createElement('div');
        hTitle.className = 'wr-modal-sec-title mono';
        hTitle.textContent = '热门划线';
        hSec.appendChild(hTitle);
        d.highlights.forEach(function (h) {
          var blk = document.createElement('div');
          blk.className = 'wr-quote';
          var q = document.createElement('p');
          q.textContent = '「' + (h.text || '') + '」';
          blk.appendChild(q);
          var tl = document.createElement('div');
          tl.className = 'wr-quote-meta mono';
          tl.textContent = (h.count || 0) + ' 人划线' + (h.chapter != null ? ' · 章节 ' + h.chapter : '');
          blk.appendChild(tl);
          hSec.appendChild(blk);
        });
        box.appendChild(hSec);
      }

      // 关闭按钮（置于底部）
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'wr-modal-close mono';
      close.textContent = '关闭';
      close.addEventListener('click', function () { modal.hidden = true; });
      box.appendChild(close);
    })
    .catch(function (e) {
      box.innerHTML = '<div class="wr-modal-loading mono">加载失败：' + (e && e.message ? e.message : e) + '</div>';
    });
}

// ---------- 已读完书架 ----------
function wrRenderFinished() {
  var box = document.getElementById('wr-finished');
  var count = document.getElementById('wr-finished-count');
  if (!box || !wrData) return;
  box.innerHTML = '';
  var finished = (wrData.books || []).filter(function (b) { return b.finishReading; });
  if (count) count.textContent = String(finished.length);
  if (!finished.length) {
    var empty = document.createElement('span');
    empty.className = 'wr-empty mono';
    empty.textContent = '暂无已读完的书';
    box.appendChild(empty);
    return;
  }
  // 响应式默认显示数量：桌面端一行约 7 本，手机端一行约 2 本，
  // 其余通过"展开全部"查看
  var SHOWN = (typeof window !== 'undefined' && window.innerWidth <= 640) ? 2 : 7;
  var shown = wrFinishedExpanded ? finished : finished.slice(0, SHOWN);
  shown.forEach(function (b) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'wr-book';
    var img = document.createElement('img');
    img.className = 'wr-book-cover';
    img.src = wrCover(b);
    img.alt = b.title || '';
    img.loading = 'lazy';
    card.appendChild(img);
    var meta = document.createElement('span');
    meta.className = 'wr-book-meta';
    var t = document.createElement('b');
    t.textContent = b.title || '';
    meta.appendChild(t);
    var a = document.createElement('small');
    a.textContent = b.author || '';
    meta.appendChild(a);
    card.appendChild(meta);
    card.addEventListener('click', function () { wrOpenBook(b.bookId); });
    box.appendChild(card);
  });
  // 展开/收起切换
  if (finished.length > SHOWN) {
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'wr-toggle mono';
    toggle.textContent = wrFinishedExpanded
      ? '收起 ↑'
      : '展开全部 ' + finished.length + ' 本 ↓';
    toggle.addEventListener('click', function () {
      wrFinishedExpanded = !wrFinishedExpanded;
      wrRenderFinished();
    });
    box.appendChild(toggle);
  }
}

// ---------- 最近在读 ----------
function wrRenderRecent() {
  var box = document.getElementById('wr-recent');
  if (!box || !wrData) return;
  box.innerHTML = '';
  var books = (wrData.books || []).slice().sort(function (a, b) { return (b.readUpdateTime || 0) - (a.readUpdateTime || 0); });
  var recent = books.filter(function (b) { return !b.finishReading; }).slice(0, 5);
  if (!recent.length) {
    var empty = document.createElement('span');
    empty.className = 'wr-empty mono';
    empty.textContent = '暂无在读的书';
    box.appendChild(empty);
    return;
  }
  recent.forEach(function (b) {
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'wr-recent-row';
    var img = document.createElement('img');
    img.className = 'wr-recent-cover';
    img.src = wrCover(b);
    img.alt = b.title || '';
    row.appendChild(img);
    var body = document.createElement('span');
    body.className = 'wr-recent-body';
    var t = document.createElement('b');
    t.textContent = b.title || '';
    body.appendChild(t);
    var a = document.createElement('small');
    a.textContent = (b.author || '') + (b.readUpdateTime ? ' · 最近阅读 ' + wrDate(b.readUpdateTime) : '');
    body.appendChild(a);
    var prog = document.createElement('span');
    prog.className = 'wr-recent-prog mono';
    prog.textContent = '进度…';
    body.appendChild(prog);
    row.appendChild(body);
    row.addEventListener('click', function () { wrOpenBook(b.bookId); });
    box.appendChild(row);
    // 异步补充每本进度
    (function (el, id) {
      fetchTimeout('/api/stats-weread/book?bookId=' + encodeURIComponent(id), 15000)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (d) {
          if (d.progress && d.progress.progress != null) {
            el.textContent = '进度 ' + (d.progress.progress === 100 ? '已完成' : d.progress.progress + '%');
          }
        })
        .catch(function () { el.textContent = ''; });
    })(prog, b.bookId);
  });
}

// ---------- 数据加载 ----------
function wrLoad() {
  var tag = document.getElementById('wr-tag');
  fetchTimeout('/api/stats-weread', 15000)
    .then(function (r) {
      if (r.status === 503) throw new Error('WEREAD_TOKEN 未配置（环境变量）');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (data.error) throw new Error(data.error);
      wrData = data;
      if (tag) tag.textContent = '数据已加载';
      wrRenderStats();
      wrRenderRecent();
      wrRenderFinished();
    })
    .catch(function (e) {
      if (tag) tag.textContent = '加载失败：' + (e && e.message ? e.message : e);
      var c = document.getElementById('wr-cards');
      if (c) {
        var p = document.createElement('div');
        p.className = 'wr-empty mono';
        p.textContent = '请检查环境变量 WEREAD_TOKEN 是否已配置';
        c.appendChild(p);
      }
    });
}

/** 初始化：绑定 tab 切换、弹窗遮罩，并触发数据加载 */
export function initWeread() {
  var tabs = document.getElementById('wr-tabs');
  if (tabs) {
    tabs.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button');
      if (!btn || !btn.dataset || !btn.dataset.mode) return;
      wrMode = btn.dataset.mode;
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      wrRenderStats();
    });
  }
  var maskEl = document.getElementById('wr-modal-mask');
  if (maskEl) {
    maskEl.addEventListener('click', function () { var m = document.getElementById('wr-modal'); if (m) m.hidden = true; });
  }
  wrLoad();
}
