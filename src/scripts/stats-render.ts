/**
 * 统计页渲染逻辑（从 stats.astro 抽离，与 weread.ts 同一模式）。
 * GitHub / 力扣的数据拉取与 DOM 渲染在此维护，stats.astro 只负责调用。
 */
import { fetchTimeout, normalizeWeeks, calendarToWeeks, renderHeatmap } from './heatmap';

/** GitHub：拉取贡献日历与公开仓库，渲染标签/热力图/仓库列表 */
export function initGitHubStats() {
  // 用户名由 API 从环境变量 GITHUB_OWNER 读取，前端无需传参
  fetchTimeout('/api/stats-github', 15000)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var tag = document.getElementById('gh-tag');
      var foot = document.getElementById('gh-foot');
      if (tag) tag.textContent = '共 ' + data.totalContributions + ' 次贡献';
      if (foot) foot.textContent = 'GitHub · ' + data.username + '（过去一年）';
      // 归一化新旧两种结构，再计算颜色分级与渲染
      var weeks = normalizeWeeks(data.weeks);
      var max = 1;
      weeks.forEach(function (week) { (week.days || []).forEach(function (v) { if (v > max) max = v; }); });
      renderHeatmap(document.getElementById('gh-calendar'), weeks, max);
      // 公开仓库列表（按 star 从高到低只展示前 5 个，防止卡片被撑长形变）
      var MAX_REPOS = 5;
      var listEl = document.getElementById('gh-repos-list');
      if (listEl && Array.isArray(data.repos) && data.repos.length) {
        data.repos.slice(0, MAX_REPOS).forEach(function (r) {
          var item = document.createElement('a');
          item.className = 'gh-repo';
          item.href = r.url;
          item.target = '_blank';
          item.rel = 'noopener noreferrer';
          var name = document.createElement('span');
          name.className = 'gh-repo-name mono';
          name.textContent = r.name;
          item.appendChild(name);
          if (r.stars > 0) {
            var stars = document.createElement('span');
            stars.className = 'gh-repo-stars mono';
            stars.textContent = '★ ' + r.stars;
            item.appendChild(stars);
          }
          if (r.description) {
            var desc = document.createElement('span');
            desc.className = 'gh-repo-desc';
            desc.textContent = r.description;
            item.appendChild(desc);
          }
          listEl.appendChild(item);
        });
        // 仓库数量超出上限时，提供查看全部入口
        if (data.repos.length > MAX_REPOS) {
          var more = document.createElement('a');
          more.className = 'gh-repo-more mono';
          more.href = 'https://github.com/' + encodeURIComponent(data.username || '') + '?tab=repositories';
          more.target = '_blank';
          more.rel = 'noopener noreferrer';
          more.textContent = '查看全部 ' + data.repos.length + ' 个公开仓库 →';
          listEl.appendChild(more);
        }
      } else if (listEl) {
        var empty = document.createElement('span');
        empty.className = 'gh-repo-empty mono';
        empty.textContent = '暂无公开仓库';
        listEl.appendChild(empty);
      }
    })
    .catch(function (e) {
      var tag = document.getElementById('gh-tag');
      var foot = document.getElementById('gh-foot');
      if (tag) tag.textContent = '加载失败：' + (e && e.message ? e.message : e);
      if (foot) foot.textContent = 'GitHub · 数据加载失败，请展开下方诊断日志';
    });
}

/** 力扣：拉取用户刷题统计与提交日历，渲染数字/进度条/热力图 */
export function initLeetcodeStats(username: string) {
  if (!username) return;
  fetchTimeout('/api/stats-leetcode?username=' + encodeURIComponent(username), 15000)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var tag = document.getElementById('lc-tag');
      if (tag) tag.textContent = '总题数 ' + data.totalQuestions;
      var solved = document.getElementById('lc-solved');
      var totalq = document.getElementById('lc-totalq');
      if (solved) solved.textContent = String(data.totalSolved);
      if (totalq) totalq.textContent = '/ ' + data.totalQuestions + ' 题已解';

      var pct = function (n) { return data.totalSolved ? Math.round(n / data.totalSolved * 100) : 0; };
      var setBar = function (id, nid, solvedN) {
        var bar = document.getElementById(id);
        var num = document.getElementById(nid);
        if (bar) bar.style.width = pct(solvedN) + '%';
        if (num) num.textContent = String(solvedN);
      };
      setBar('lc-easy', 'lc-easy-n', data.easySolved);
      setBar('lc-mid', 'lc-mid-n', data.mediumSolved);
      setBar('lc-hard', 'lc-hard-n', data.hardSolved);

      // 提交日历热力图（归一化新旧两种结构后渲染）
      var weeks = normalizeWeeks(calendarToWeeks(data.submissionCalendar || {}));
      var max = 1;
      weeks.forEach(function (week) { (week.days || []).forEach(function (v) { if (v > max) max = v; }); });
      renderHeatmap(document.getElementById('lc-calendar'), weeks, max);
    })
    .catch(function (e) {
      var tag = document.getElementById('lc-tag');
      if (tag) tag.textContent = '加载失败：' + (e && e.message ? e.message : e);
    });
}
