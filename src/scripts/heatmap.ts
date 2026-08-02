/**
 * 热力图渲染工具（纯函数，无页面依赖）
 *
 * 从 stats.astro 的内联脚本中抽出，供 GitHub 贡献日历、LeetCode 提交日历
 * 复用；未来其他"按天统计"的数据（如微信读书每日时长）也可直接使用。
 */

export var MAX_LEVEL = 4;
export var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
// 左侧星期标签显示的行（周一、周三、周五，与 GitHub 官方一致）
export var LABEL_ROWS = [1, 3, 5];

/** 带超时的 fetch：Promise.race 实现，不依赖 AbortController（跨环境兼容） */
export function fetchTimeout(url, ms) {
  return Promise.race([
    fetch(url),
    new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('请求超时（' + ms + 'ms）')); }, ms);
    }),
  ]);
}

/** 贡献值 → 颜色等级 class（c0-c4） */
export function levelClass(v, max) {
  if (v <= 0) return 'c0';
  var r = v / (max || 1);
  if (r < 0.25) return 'c1';
  if (r < 0.5) return 'c2';
  if (r < 0.75) return 'c3';
  return 'c4';
}

/** "YYYY-MM-DD" → 本地 Date（避免 new Date(str) 的时区歧义） */
export function parseDay(str) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

export function fmtDay(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * 兼容两种 API 结构，统一为 [{ date, days }]：
 *   新结构：{ date: "YYYY-MM-DD", days: [7 个数] }
 *   旧结构：纯数组 [7 个数]（wrangler 缓存旧编译时可能返回）
 */
export function normalizeWeeks(weeks) {
  if (!Array.isArray(weeks)) return [];
  return weeks.map(function (w) {
    if (Array.isArray(w)) return { date: null, days: w };        // 旧结构：纯数组
    if (w && typeof w === 'object') {
      return { date: w.date || null, days: Array.isArray(w.days) ? w.days : [] };
    }
    return { date: null, days: [] };
  });
}

/**
 * weeks: [{ date: "YYYY-MM-DD"(该周周日), days: [7 个数] }]，max 用于颜色分级。
 * 渲染 GitHub 官方风格的日历：顶部月份/年份标签 + 左侧星期标签 + 每格日期 tooltip。
 */
export function renderHeatmap(container, weeks, max) {
  if (!container || !weeks.length) return;
  container.innerHTML = '';

  // 顶部月份/年份标签行
  var head = document.createElement('div');
  head.className = 'gh-head';
  var labelsSpace = document.createElement('div');
  labelsSpace.className = 'gh-labels-space';
  head.appendChild(labelsSpace);
  var months = document.createElement('div');
  months.className = 'gh-months';

  // 按月份跨度分组渲染标签：每个标签横跨其所属月份的所有列宽，避免文字互相重叠
  var CELL_W = 10;  // 与 .gh-cell 宽度一致
  var GAP = 3;      // 与 .gh-col gap 一致
  var monthGroups = [];
  weeks.forEach(function (week) {
    var d = parseDay(week.date);
    var key = d ? (d.getFullYear() + '-' + d.getMonth()) : 'none';
    var last = monthGroups[monthGroups.length - 1];
    if (last && last.key === key) {
      last.count++;
    } else {
      monthGroups.push({ key: key, count: 1, date: d });
    }
  });
  monthGroups.forEach(function (g) {
    var span = document.createElement('span');
    span.className = 'gh-month';
    span.style.width = (g.count * (CELL_W + GAP) - GAP) + 'px';
    if (g.date) {
      if (g.date.getMonth() === 0) {
        span.textContent = String(g.date.getFullYear()) + '年'; // 每年 1 月显示年份
      } else {
        span.textContent = (g.date.getMonth() + 1) + '月';
      }
    }
    months.appendChild(span);
  });
  head.appendChild(months);
  container.appendChild(head);

  // 主体：左侧星期标签列 + 贡献列
  var body = document.createElement('div');
  body.className = 'gh-body';
  var labels = document.createElement('div');
  labels.className = 'gh-labels';
  for (var i = 0; i < 7; i++) {
    var lab = document.createElement('span');
    lab.className = 'gh-label';
    if (LABEL_ROWS.indexOf(i) !== -1) lab.textContent = WEEKDAYS[i];
    labels.appendChild(lab);
  }
  body.appendChild(labels);

  var cols = document.createElement('div');
  cols.className = 'gh-cols';
  weeks.forEach(function (week) {
    var colEl = document.createElement('div');
    colEl.className = 'gh-col';
    var base = parseDay(week.date);
    // 防御：API 返回异常结构（无 days 字段）时不崩溃
    (week.days || []).forEach(function (v, di) {
      var cell = document.createElement('span');
      cell.className = 'gh-cell ' + levelClass(v, max);
      var day = base ? fmtDay(new Date(base.getFullYear(), base.getMonth(), base.getDate() + di)) : '';
      cell.title = day ? (day + '：' + v + ' 次贡献') : (v + ' contributions');
      colEl.appendChild(cell);
    });
    cols.appendChild(colEl);
  });
  body.appendChild(cols);
  container.appendChild(body);
}

/** LeetCode submissionCalendar {时间戳秒: 当日提交数} → 最近一年的 53×7 矩阵（带每周起始日期） */
export function calendarToWeeks(calendar) {
  var byDay = {};
  Object.keys(calendar).forEach(function (ts) {
    var d = new Date(Number(ts) * 1000);
    var key = fmtDay(d);
    byDay[key] = (byDay[key] || 0) + calendar[ts];
  });
  var today = new Date();
  var start = new Date(today);
  start.setDate(start.getDate() - 363);
  // 对齐到周日，保证与 GitHub 日历相同的列结构
  start.setDate(start.getDate() - start.getDay());
  var weeks = [];
  for (var w = 0; w < 53; w++) {
    var days = [];
    for (var d = 0; d < 7; d++) {
      var date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      if (date > today) { days.push(0); continue; }
      days.push(byDay[fmtDay(date)] || 0);
    }
    weeks.push({ date: fmtDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7)), days: days });
  }
  return weeks;
}

/**
 * 月度热力图：渲染指定月份（year 年 month 月，month 0-11）的贡献日历，
 * 支持一次渲染连续多个月份（months 参数，默认 1）并排显示。
 * 与 renderHeatmap 共用 gh-* 结构与样式；列 = 周、行 = 日（周日到周六），
 * 每月 1 号按星期几对齐，格子数量 = 当月实际天数（由 year/month 精确计算），
 * 当月之外的空位用隐藏占位格保持对齐。
 * calendar: { ts秒: count }。
 */
export function renderMonthHeatmap(container, calendar, max, year, month, months) {
  if (!container) return;
  container.innerHTML = '';

  // 按 "YYYY-MM-DD" 归组
  var byDay = {};
  Object.keys(calendar || {}).forEach(function (ts) {
    var d = new Date(Number(ts) * 1000);
    byDay[fmtDay(d)] = (byDay[fmtDay(d)] || 0) + (calendar[ts] || 0);
  });

  var count = months || 1;

  // 每个月份一个独立块（头部标签 + 星期列 + 周列），并排排列
  for (var mi = 0; mi < count; mi++) {
    var mDate = new Date(year, month + mi, 1);
    var y = mDate.getFullYear();
    var m = mDate.getMonth();

    var block = document.createElement('div');
    block.className = 'gh-month-block';

    var daysInMonth = new Date(y, m + 1, 0).getDate(); // 当月实际天数
    var firstDay = new Date(y, m, 1).getDay();          // 1 号是星期几（0=周日）

    // 顶部月份标签
    var head = document.createElement('div');
    head.className = 'gh-head';
    var labelsSpace = document.createElement('div');
    labelsSpace.className = 'gh-labels-space';
    head.appendChild(labelsSpace);
    var monthsEl = document.createElement('div');
    monthsEl.className = 'gh-months';
    var span = document.createElement('span');
    span.className = 'gh-month';
    span.style.width = 'auto';
    span.textContent = y + ' 年 ' + (m + 1) + ' 月';
    monthsEl.appendChild(span);
    head.appendChild(monthsEl);
    block.appendChild(head);

    // 主体：左侧星期标签列 + 周列
    var body = document.createElement('div');
    body.className = 'gh-body';
    var labels = document.createElement('div');
    labels.className = 'gh-labels';
    for (var i = 0; i < 7; i++) {
      var lab = document.createElement('span');
      lab.className = 'gh-label';
      lab.textContent = WEEKDAYS[i];
      labels.appendChild(lab);
    }
    body.appendChild(labels);

    var cols = document.createElement('div');
    cols.className = 'gh-cols';
    var totalCells = firstDay + daysInMonth;              // 从周日对齐到月末的总格数
    var weekCount = Math.ceil(totalCells / 7);            // 需要的周列数
    for (var w = 0; w < weekCount; w++) {
      var col = document.createElement('div');
      col.className = 'gh-col';
      for (var d = 0; d < 7; d++) {
        var dayIndex = w * 7 + d - firstDay + 1;          // 当月第几天（1..daysInMonth）
        var cell = document.createElement('span');
        if (dayIndex < 1 || dayIndex > daysInMonth) {
          // 当月之外的空位：隐藏占位，保持周对齐
          cell.className = 'gh-cell c0';
          cell.style.visibility = 'hidden';
        } else {
          var dayStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dayIndex).padStart(2, '0');
          var v = byDay[dayStr] || 0;
          cell.className = 'gh-cell ' + levelClass(v, max);
          cell.title = dayStr + '：' + v + ' 篇';
        }
        col.appendChild(cell);
      }
      cols.appendChild(col);
    }
    body.appendChild(cols);
    block.appendChild(body);
    container.appendChild(block);
  }
}
