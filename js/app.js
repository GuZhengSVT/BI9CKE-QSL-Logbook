/* ============================================================================
 * app.js — 应用外壳 + 通联日志页（表格 / 筛选 / 分页 / 详情 / QSL 快捷操作）
 * 依赖: i18n.js, adif.js, store.js
 * 对外暴露: window.App, window.Utils
 * ==========================================================================*/
'use strict';

/* ---------------------------------------------------------------- 通用工具 */
const Utils = {
  // HTML 转义，防 XSS
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  // 今天日期，ADIF 格式 YYYYMMDD
  todayAdif() {
    const d = new Date();
    return d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
  },
  badge(code, isRcvd) {
    const info = ADIF.qslStatusInfo(code, isRcvd);
    return `<span class="badge badge-${info.color}">${Utils.esc(I18N.t(info.labelKey))}</span>`;
  }
};

/* ------------------------------------------------------------------ 应用 */
const App = {
  state: {
    records: [],          // 合并后的记录
    filter: { q: '', band: '', mode: '', year: '', country: '' },
    page: 1,
    pageSize: 50,
    expanded: null,       // 展开详情的 record id
    config: {}
  },

  tabs: {},               // 各模块注册 {name: renderFn}

  async init() {
    this.state.config = await Store.loadConfig();
    this.bindEvents();
    this.updateSiteHeader();
    await this.refresh();
    this.showTab(location.hash ? location.hash.slice(1) : 'log');
  },

  /* ------------------------------------------------------ 站点标题（随语言） */
  updateSiteHeader() {
    const cfg = this.state.config || {};
    const call = cfg.call;
    document.title = call ? I18N.t('titleWithCall', { call }) : I18N.t('title');
    document.getElementById('site-name').textContent = call ? I18N.t('siteName', { call }) : I18N.t('appName');
    document.getElementById('site-sub').textContent = cfg.name || I18N.t('appSub');
  },

  /* ------------------------------------------------------------- 数据刷新 */
  async refresh() {
    this.state.records = await Store.getRecords();
    this.renderAllTabs();
  },

  renderAllTabs() {
    for (const fn of Object.values(this.tabs)) {
      try { fn(); } catch (e) { console.error('render error:', e); }
    }
    this.updateLocalBadge();
  },

  /* --------------------------------------------------------------- 导航 */
  showTab(name) {
    if (!this.tabs[name]) name = 'log';
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === name);
    });
    document.querySelectorAll('.tab-page').forEach(el => {
      el.classList.toggle('active', el.id === 'page-' + name);
    });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
    const fn = this.tabs[name];
    if (fn) fn();
  },

  bindEvents() {
    // 导航点击
    document.querySelector('.nav-bar').addEventListener('click', e => {
      const item = e.target.closest('.nav-item');
      if (item) this.showTab(item.dataset.tab);
    });

    // 日志筛选栏
    const filterBar = document.getElementById('log-filters');
    if (filterBar) {
      filterBar.addEventListener('input', e => {
        if (e.target.name === 'q') { this.state.filter.q = e.target.value; this.state.page = 1; this.debounceRender(); }
      });
      filterBar.addEventListener('change', e => {
        const name = e.target.name;
        if (name === 'q') return;
        this.state.filter[name] = e.target.value;
        this.state.page = 1;
        this.tabs.log();
      });
    }

    // 日志表格：事件委托（详情展开 / QSL 快捷标记 / 删除）
    const tbody = document.getElementById('log-body');
    if (tbody) {
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        const row = e.target.closest('tr[data-id]');
        if (!row) return;
        const id = row.dataset.id;
        const rec = this.state.records.find(r => ADIF.recordId(r) === id);
        if (!rec) return;

        if (btn) {
          const action = btn.dataset.action;
          this.handleLogAction(action, rec);
          return;
        }
        // 点击行：切换详情
        this.state.expanded = (this.state.expanded === id) ? null : id;
        this.tabs.log();
      });
    }
  },

  debounceTimer: null,
  debounceRender() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.tabs.log(), 250);
  },

  /* ------------------------------------------------------- 日志页操作 */
  handleLogAction(action, rec) {
    const today = Utils.todayAdif();
    const next = { ...rec };
    switch (action) {
      case 'qsl-sent-y':  next.QSL_SENT = 'Y'; next.QSL_SENT_DATE = next.QSL_SENT_DATE || today; break;
      case 'qsl-sent-q':  next.QSL_SENT = 'Q'; break;
      case 'qsl-rcvd-y':  next.QSL_RCVD = 'Y'; next.QSL_RCVD_DATE = next.QSL_RCVD_DATE || today; break;
      case 'qsl-rcvd-r':  next.QSL_RCVD = 'R'; break;
      case 'qsl-clear-s': delete next.QSL_SENT; delete next.QSL_SENT_DATE; break;
      case 'qsl-clear-r': delete next.QSL_RCVD; delete next.QSL_RCVD_DATE; break;
      case 'edit': {
        if (window.Entry) Entry.loadIntoForm(rec);
        this.showTab('entry');
        return;
      }
      case 'delete': {
        if (confirm(I18N.t('deleteConfirm', { call: rec.CALL, date: rec.QSO_DATE }))) {
          Store.remove(ADIF.recordId(rec));
          this.refresh();
        }
        return;
      }
      default: return;
    }
    Store.upsert(next);
    this.refresh();
  },

  /* ------------------------------------------------------------ 筛选派生 */
  filteredRecords() {
    const f = this.state.filter;
    let list = this.state.records;
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter(r =>
        (r.CALL || '').toLowerCase().includes(q) ||
        (r.COMMENT || '').toLowerCase().includes(q) ||
        (r.COUNTRY || '').toLowerCase().includes(q) ||
        (r.GRIDSQUARE || '').toLowerCase().includes(q)
      );
    }
    if (f.band) list = list.filter(r => r.BAND === f.band);
    if (f.mode) list = list.filter(r => r.MODE === f.mode);
    if (f.year) list = list.filter(r => (r.QSO_DATE || '').slice(0, 4) === f.year);
    if (f.country) list = list.filter(r => r.COUNTRY === f.country);
    return list;
  },

  /* ------------------------------------------------------------- 日志渲染 */
  log() {
    const filtered = this.filteredRecords();
    const total = filtered.length;
    const pageSize = this.state.pageSize;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (this.state.page > pages) this.state.page = pages;
    const page = this.state.page;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

    // 筛选下拉选项
    const distinct = (key) => {
      const set = new Set(this.state.records.map(r => r[key]).filter(Boolean));
      return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true }));
    };
    const years = distinct('QSO_DATE').map(d => d.slice(0, 4)).filter((v, i, a) => a.indexOf(v) === i).sort().reverse();
    const sel = (key) => this.state.filter[key];

    document.getElementById('log-filters').innerHTML = `
      <input type="search" name="q" placeholder="${Utils.esc(I18N.t('filterSearch'))}" value="${Utils.esc(sel('q'))}">
      <select name="band"><option value="">${Utils.esc(I18N.t('allBands'))}</option>${distinct('BAND').map(b => `<option ${b === sel('band') ? 'selected' : ''}>${Utils.esc(b)}</option>`).join('')}</select>
      <select name="mode"><option value="">${Utils.esc(I18N.t('allModes'))}</option>${distinct('MODE').map(m => `<option ${m === sel('mode') ? 'selected' : ''}>${Utils.esc(m)}</option>`).join('')}</select>
      <select name="year"><option value="">${Utils.esc(I18N.t('allYears'))}</option>${years.map(y => `<option ${y === sel('year') ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select name="country"><option value="">${Utils.esc(I18N.t('allCountries'))}</option>${distinct('COUNTRY').map(c => `<option ${c === sel('country') ? 'selected' : ''}>${Utils.esc(c)}</option>`).join('')}</select>
      <span class="filter-count">${Utils.esc(I18N.t('filterCount', { n: total }))}</span>
    `;

    const tbody = document.getElementById('log-body');
    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">${Utils.esc(I18N.t('logEmpty'))}</td></tr>`;
    } else {
      tbody.innerHTML = slice.map(rec => {
        const id = ADIF.recordId(rec);
        const expanded = this.state.expanded === id;
        const detail = expanded ? this.renderDetail(rec, id) : '';
        return `
        <tr data-id="${Utils.esc(id)}" class="${expanded ? 'expanded' : ''}">
          <td class="date">${Utils.esc(ADIF.prettyDate(rec.QSO_DATE))}</td>
          <td class="call">${Utils.esc(rec.CALL || '—')}</td>
          <td>${Utils.esc(rec.BAND || '—')}</td>
          <td>${Utils.esc(rec.MODE || '—')}</td>
          <td class="rst">${Utils.esc(rec.RST_SENT || '—')} / ${Utils.esc(rec.RST_RCVD || '—')}</td>
          <td>${Utils.esc(rec.GRIDSQUARE || '—')}</td>
          <td>${Utils.badge(rec.QSL_SENT, false)}</td>
          <td>${Utils.badge(rec.QSL_RCVD, true)}</td>
        </tr>
        ${detail ? `<tr class="detail-row" data-id="${Utils.esc(id)}"><td colspan="8">${detail}</td></tr>` : ''}`;
      }).join('');
    }

    // 分页
    const pager = document.getElementById('log-pager');
    pager.innerHTML = `
      <button ${page <= 1 ? 'disabled' : ''} data-pg="prev">${Utils.esc(I18N.t('pagerPrev'))}</button>
      <span class="page-info">${Utils.esc(I18N.t('pagerInfo', { page, pages }))}</span>
      <button ${page >= pages ? 'disabled' : ''} data-pg="next">${Utils.esc(I18N.t('pagerNext'))}</button>
      <select class="page-size" title="per page">
        ${[25, 50, 100, 200].map(n => `<option value="${n}" ${n === pageSize ? 'selected' : ''}>${Utils.esc(I18N.t('perPage', { n }))}</option>`).join('')}
      </select>`;
    pager.onclick = e => {
      const btn = e.target.closest('button[data-pg]');
      if (!btn || btn.disabled) return;
      this.state.page += (btn.dataset.pg === 'next' ? 1 : -1);
      this.tabs.log();
    };
    pager.onchange = e => {
      if (e.target.classList.contains('page-size')) {
        this.state.pageSize = parseInt(e.target.value, 10);
        this.state.page = 1;
        this.tabs.log();
      }
    };
  },

  /* ------------------------------------------------------------- 详情面板 */
  renderDetail(rec, id) {
    const today = Utils.todayAdif();
    const sentY = rec.QSL_SENT === 'Y', rcvdY = rec.QSL_RCVD === 'Y';
    const sentLabel = I18N.t(ADIF.qslStatusInfo(rec.QSL_SENT, false).labelKey);
    const rcvdLabel = I18N.t(ADIF.qslStatusInfo(rec.QSL_RCVD, true).labelKey);
    const fields = [
      [I18N.t('fldCall'), rec.CALL],
      [I18N.t('fldDate'), ADIF.prettyDate(rec.QSO_DATE)],
      [I18N.t('fldTime'), ADIF.prettyTime(rec.TIME_ON)],
      [I18N.t('fldBand'), rec.BAND],
      [I18N.t('fldMode'), rec.MODE],
      [I18N.t('fldFreq'), rec.FREQ],
      [I18N.t('fldRstS'), rec.RST_SENT],
      [I18N.t('fldRstR'), rec.RST_RCVD],
      [I18N.t('fldGrid'), rec.GRIDSQUARE],
      ['IOTA', rec.IOTA],
      ['DXCC', rec.DXCC],
      [I18N.t('fldCountry'), rec.COUNTRY],
      [I18N.t('fldQslS'), sentLabel + (rec.QSL_SENT_DATE ? ' (' + ADIF.prettyDate(rec.QSL_SENT_DATE) + ')' : '')],
      [I18N.t('fldQslR'), rcvdLabel + (rec.QSL_RCVD_DATE ? ' (' + ADIF.prettyDate(rec.QSL_RCVD_DATE) + ')' : '')],
      [I18N.t('fldQslVia'), rec.QSL_VIA],
      [I18N.t('fldQslMsg'), rec.QSLMSG],
      ['LoTW', `${rec.LOTW_QSL_SENT || '—'}/${rec.LOTW_QSL_RCVD || '—'}`],
      ['eQSL', `${rec.EQSL_QSL_SENT || '—'}/${rec.EQSL_QSL_RCVD || '—'}`],
      [I18N.t('fldComment'), rec.COMMENT]
    ].filter(([, v]) => v !== undefined && v !== null && v !== '');

    return `
      <div class="detail-grid">
        ${fields.map(([k, v]) => `<div class="detail-item"><span class="detail-key">${Utils.esc(k)}</span><span class="detail-val">${Utils.esc(v)}</span></div>`).join('')}
      </div>
      <div class="detail-actions">
        <button class="btn btn-sm" data-action="qsl-sent-y" ${sentY ? 'disabled' : ''}>${Utils.esc(I18N.t('btnMarkSent'))}</button>
        <button class="btn btn-sm" data-action="qsl-sent-q" ${sentY ? 'disabled' : ''}>${Utils.esc(I18N.t('btnMarkQueue'))}</button>
        <button class="btn btn-sm" data-action="qsl-rcvd-y" ${rcvdY ? 'disabled' : ''}>${Utils.esc(I18N.t('btnMarkRcvd'))}</button>
        <button class="btn btn-sm" data-action="qsl-rcvd-r" ${rcvdY ? 'disabled' : ''}>${Utils.esc(I18N.t('btnRequestCard'))}</button>
        <button class="btn btn-sm" data-action="edit">${Utils.esc(I18N.t('btnEdit'))}</button>
        <button class="btn btn-sm btn-danger" data-action="delete">${Utils.esc(I18N.t('btnDelete'))}</button>
        <span class="detail-hint">${Utils.esc(I18N.t('detailHint'))}</span>
      </div>`;
  },

  /* ------------------------------------------------------- 本地草稿徽标 */
  updateLocalBadge() {
    const c = Store.localChangeCount();
    const badge = document.getElementById('local-badge');
    const total = c.added + c.updated + c.deleted;
    if (badge) {
      badge.textContent = total > 0 ? I18N.t('localBadge', { n: total }) : '';
      badge.classList.toggle('show', total > 0);
    }
  }
};

window.App = App;
window.Utils = Utils;
