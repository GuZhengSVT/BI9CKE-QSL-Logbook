/* ============================================================================
 * qsl.js — QSL 卡片管理看板
 * 视图：待发出 / 待收到 / 已确认 / 超时提醒
 * 依赖: adif.js, store.js, app.js
 * 注册到 App.tabs.qsl
 * ==========================================================================*/
'use strict';

App.tabs.qsl = function () {
  const el = document.getElementById('page-qsl');
  if (!el) return;
  const records = App.state.records;

  const DAYS_OVERDUE = 90; // 寄出超过此天数未收到 → 提醒

  const dateDiffDays = (adifDate) => {
    if (!adifDate || adifDate.length !== 8) return null;
    const d = new Date(+adifDate.slice(0, 4), +adifDate.slice(4, 6) - 1, +adifDate.slice(6, 8));
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  };

  const sentNotRcvd = records.filter(r => r.QSL_SENT === 'Y' && r.QSL_RCVD !== 'Y');
  const toSend = records.filter(r => !r.QSL_SENT || r.QSL_SENT === 'N' || r.QSL_SENT === 'R' || r.QSL_SENT === 'Q');
  const toRcvd = records.filter(r => !r.QSL_RCVD || r.QSL_RCVD === 'N' || r.QSL_RCVD === 'R' || r.QSL_RCVD === 'Q');
  const confirmed = records.filter(r => r.QSL_RCVD === 'Y' || r.LOTW_QSL_RCVD === 'Y');
  const overdue = sentNotRcvd.filter(r => {
    const d = dateDiffDays(r.QSL_SENT_DATE);
    return d !== null && d >= DAYS_OVERDUE;
  });

  const rows = (list, actions) => list.length === 0
    ? `<tr><td colspan="7" class="empty">（空）</td></tr>`
    : list.map(r => {
      const id = ADIF.recordId(r);
      const sentDate = r.QSL_SENT_DATE ? ADIF.prettyDate(r.QSL_SENT_DATE) : '—';
      const rcvdDate = r.QSL_RCVD_DATE ? ADIF.prettyDate(r.QSL_RCVD_DATE) : '—';
      return `<tr data-id="${Utils.esc(id)}">
        <td class="date">${Utils.esc(ADIF.prettyDate(r.QSO_DATE))}</td>
        <td class="call">${Utils.esc(r.CALL || '—')}</td>
        <td>${Utils.esc(r.BAND || '—')} ${Utils.esc(r.MODE || '')}</td>
        <td>${Utils.badge(r.QSL_SENT, false)}</td>
        <td>${Utils.esc(sentDate)}</td>
        <td>${Utils.badge(r.QSL_RCVD, true)}</td>
        <td>${Utils.esc(rcvdDate)}</td>
        <td class="row-actions">${actions(r)}</td>
      </tr>`;
    }).join('');

  const today = Utils.todayAdif();
  const mark = (rec, field, value) => {
    const next = { ...rec };
    next[field] = value;
    if (field === 'QSL_SENT') next.QSL_SENT_DATE = next.QSL_SENT_DATE || today;
    if (field === 'QSL_RCVD') next.QSL_RCVD_DATE = next.QSL_RCVD_DATE || today;
    Store.upsert(next);
    App.refresh();
  };

  const btn = (label, cls, fn) => `<button class="btn btn-sm ${cls || ''}" data-fn="${Utils.esc(fn)}">${Utils.esc(label)}</button>`;
  // 注意：按钮事件用委托处理，避免内联 eval；fn 是字符串键

  el.innerHTML = `
    <div class="qsl-summary">
      <span class="qsl-summary-item"><b>${confirmed.length}</b> 已确认</span>
      <span class="qsl-summary-item"><b>${toSend.length}</b> 待发出</span>
      <span class="qsl-summary-item"><b>${toRcvd.length}</b> 待收到</span>
      <span class="qsl-summary-item warn"><b>${overdue.length}</b> 寄出超时(>${DAYS_OVERDUE}天未收到)</span>
    </div>

    <div class="qsl-section">
      <h3>⚠ 寄出超时提醒（已寄出 ${DAYS_OVERDUE}+ 天未收到）</h3>
      <table class="log-table">
        <thead><tr><th>日期</th><th>呼号</th><th>波段/模式</th><th>发出</th><th>寄出日期</th><th>收到</th><th>收到日期</th><th>操作</th></tr></thead>
        <tbody id="qsl-overdue">${rows(overdue, r => btn('标记已收到', 'btn-green', 'rcvd-y') + btn('请求补卡', 'btn-blue', 'rcvd-r'))}</tbody>
      </table>
    </div>

    <div class="qsl-section">
      <h3>📤 待发出 / 未发出</h3>
      <table class="log-table">
        <thead><tr><th>日期</th><th>呼号</th><th>波段/模式</th><th>发出</th><th>寄出日期</th><th>收到</th><th>收到日期</th><th>操作</th></tr></thead>
        <tbody id="qsl-tosend">${rows(toSend, r => btn('标记已寄出', 'btn-green', 'sent-y') + (r.QSL_SENT ? btn('标记待寄出', 'btn-blue', 'sent-q') : ''))}</tbody>
      </table>
    </div>

    <div class="qsl-section">
      <h3>📥 待收到</h3>
      <table class="log-table">
        <thead><tr><th>日期</th><th>呼号</th><th>波段/模式</th><th>发出</th><th>寄出日期</th><th>收到</th><th>收到日期</th><th>操作</th></tr></thead>
        <tbody id="qsl-torcvd">${rows(toRcvd, r => btn('标记已收到', 'btn-green', 'rcvd-y'))}</tbody>
      </table>
    </div>

    <div class="qsl-section">
      <h3>✅ 已确认</h3>
      <table class="log-table">
        <thead><tr><th>日期</th><th>呼号</th><th>波段/模式</th><th>发出</th><th>寄出日期</th><th>收到</th><th>收到日期</th><th>操作</th></tr></thead>
        <tbody id="qsl-confirmed">${rows(confirmed, r => btn('撤销已收', 'btn-plain', 'rcvd-clear') + btn('撤销已发', 'btn-plain', 'sent-clear'))}</tbody>
      </table>
    </div>`;

  // 事件委托
  el.querySelectorAll('tbody').forEach(tbody => {
    tbody.addEventListener('click', e => {
      const b = e.target.closest('button[data-fn]');
      const row = e.target.closest('tr[data-id]');
      if (!b || !row) return;
      const rec = records.find(r => ADIF.recordId(r) === row.dataset.id);
      if (!rec) return;
      const fn = b.dataset.fn;
      switch (fn) {
        case 'sent-y': mark(rec, 'QSL_SENT', 'Y'); break;
        case 'sent-q': mark(rec, 'QSL_SENT', 'Q'); break;
        case 'sent-clear': {
          const next = { ...rec }; delete next.QSL_SENT; delete next.QSL_SENT_DATE;
          Store.upsert(next); App.refresh(); break;
        }
        case 'rcvd-y': mark(rec, 'QSL_RCVD', 'Y'); break;
        case 'rcvd-r': mark(rec, 'QSL_RCVD', 'R'); break;
        case 'rcvd-clear': {
          const next = { ...rec }; delete next.QSL_RCVD; delete next.QSL_RCVD_DATE;
          Store.upsert(next); App.refresh(); break;
        }
      }
    });
  });
};
