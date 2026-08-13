/* ============================================================================
 * qsl.js — QSL 卡片管理看板
 * 视图：待发出 / 待收到 / 已确认 / 超时提醒
 * 依赖: i18n.js, adif.js, store.js, app.js
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

  const th = () => `<tr>
    <th>${Utils.esc(I18N.t('thDate'))}</th><th>${Utils.esc(I18N.t('thCall'))}</th><th>${Utils.esc(I18N.t('thBand'))}/${Utils.esc(I18N.t('thMode'))}</th>
    <th>${Utils.esc(I18N.t('thQslSent'))}</th><th>${Utils.esc(I18N.t('fldQslSDate'))}</th>
    <th>${Utils.esc(I18N.t('thQslRcvd'))}</th><th>${Utils.esc(I18N.t('fldQslRDate'))}</th><th></th>
  </tr>`;

  const rows = (list, actions) => list.length === 0
    ? `<tr><td colspan="8" class="empty">${Utils.esc(I18N.t('qslEmpty'))}</td></tr>`
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
  const clearField = (rec, field, dateField) => {
    const next = { ...rec };
    delete next[field]; delete next[dateField];
    Store.upsert(next);
    App.refresh();
  };

  const btn = (label, cls, fn) => `<button class="btn btn-sm ${cls || ''}" data-fn="${Utils.esc(fn)}">${Utils.esc(label)}</button>`;

  el.innerHTML = `
    <div class="qsl-summary">
      <span class="qsl-summary-item"><b>${confirmed.length}</b> ${Utils.esc(I18N.t('qslSummaryConfirmed'))}</span>
      <span class="qsl-summary-item"><b>${toSend.length}</b> ${Utils.esc(I18N.t('qslSummaryToSend'))}</span>
      <span class="qsl-summary-item"><b>${toRcvd.length}</b> ${Utils.esc(I18N.t('qslSummaryToRcvd'))}</span>
      <span class="qsl-summary-item warn"><b>${overdue.length}</b> ${Utils.esc(I18N.t('qslSummaryOverdue', { n: DAYS_OVERDUE }))}</span>
    </div>

    <div class="qsl-section">
      <h3>${Utils.esc(I18N.t('qslOverdueTitle', { n: DAYS_OVERDUE }))}</h3>
      <table class="log-table">
        <thead>${th()}</thead>
        <tbody id="qsl-overdue">${rows(overdue, r => btn(I18N.t('btnMarkRcvdShort'), 'btn-green', 'rcvd-y') + btn(I18N.t('btnRequestShort'), 'btn-blue', 'rcvd-r'))}</tbody>
      </table>
    </div>

    <div class="qsl-section">
      <h3>${Utils.esc(I18N.t('qslToSendTitle'))}</h3>
      <table class="log-table">
        <thead>${th()}</thead>
        <tbody id="qsl-tosend">${rows(toSend, r => btn(I18N.t('btnMarkSentShort'), 'btn-green', 'sent-y') + (r.QSL_SENT ? btn(I18N.t('btnMarkQueueShort'), 'btn-blue', 'sent-q') : ''))}</tbody>
      </table>
    </div>

    <div class="qsl-section">
      <h3>${Utils.esc(I18N.t('qslToRcvdTitle'))}</h3>
      <table class="log-table">
        <thead>${th()}</thead>
        <tbody id="qsl-torcvd">${rows(toRcvd, r => btn(I18N.t('btnMarkRcvdShort'), 'btn-green', 'rcvd-y'))}</tbody>
      </table>
    </div>

    <div class="qsl-section">
      <h3>${Utils.esc(I18N.t('qslConfirmedTitle'))}</h3>
      <table class="log-table">
        <thead>${th()}</thead>
        <tbody id="qsl-confirmed">${rows(confirmed, r => btn(I18N.t('btnUndoRcvd'), 'btn-plain', 'rcvd-clear') + btn(I18N.t('btnUndoSent'), 'btn-plain', 'sent-clear'))}</tbody>
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
        case 'sent-clear': clearField(rec, 'QSL_SENT', 'QSL_SENT_DATE'); break;
        case 'rcvd-y': mark(rec, 'QSL_RCVD', 'Y'); break;
        case 'rcvd-r': mark(rec, 'QSL_RCVD', 'R'); break;
        case 'rcvd-clear': clearField(rec, 'QSL_RCVD', 'QSL_RCVD_DATE'); break;
      }
    });
  });
};
