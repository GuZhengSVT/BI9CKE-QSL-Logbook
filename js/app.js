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
    pageSize: 25,
    expanded: null,       // 展开详情的 record id
    activeTab: 'log',
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
    document.getElementById('station-call').textContent = call || 'QSL';
    const admin = document.getElementById('admin-link');
    admin.hidden = !cfg.apiBaseUrl;
    if (cfg.apiBaseUrl) admin.href = new URL('/admin/', cfg.apiBaseUrl).href;
    const status = document.getElementById('data-status');
    status.hidden = !Store.isFallback();
    status.textContent = I18N.t('liveUnavailable');
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

    this.renderOverview();
    StationMap.render(this.state.config, this.state.records);
  },

  /* --------------------------------------------------------------- 导航 */
  showTab(name) {
    if (!this.tabs[name]) name = 'log';
    this.state.activeTab = name;
    this.updatePageHeading();
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === name);
      if (el.dataset.tab === name) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    document.querySelectorAll('.tab-page').forEach(el => {
      el.classList.toggle('active', el.id === 'page-' + name);
    });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
    const fn = this.tabs[name];
    if (fn) fn();
    this.satelliteTools?.setActive(name==='satellites');
    window.scrollTo(0, 0);
  },

  updatePageHeading() {
    const name = this.state.activeTab;
    const key = { log: 'navLog', stats: 'navStats', qsl: 'navQsl', entry: 'navEntry', cards: 'navCards',satellites:'navSatellites' }[name];
    document.getElementById('page-title').textContent = I18N.t(key);
    document.getElementById('current-page').textContent = I18N.t(key);
    document.getElementById('page-description').textContent = I18N.t(name + 'Description');
    document.querySelectorAll('.nav-item').forEach(el => {
      el.setAttribute('title', I18N.t({ log: 'navLog', stats: 'navStats', qsl: 'navQsl', entry: 'navEntry', cards: 'navCards',satellites:'navSatellites' }[el.dataset.tab]));
    });
    document.querySelectorAll('.tab-page').forEach(el => {
      el.setAttribute('aria-label', I18N.t({ log: 'navLog', stats: 'navStats', qsl: 'navQsl', entry: 'navEntry', cards: 'navCards',satellites:'navSatellites' }[el.id.slice(5)]));
    });
  },

  renderOverview() {
    const records = this.state.records;
    const confirmed = records.filter(r => r.QSL_RCVD === 'Y' || r.LOTW_QSL_RCVD === 'Y').length;
    const dxcc = new Set(records.map(r => r.DXCC || r.COUNTRY).filter(Boolean)).size;
    const bands = new Set(records.map(r => r.BAND).filter(Boolean)).size;
    const modes = new Set(records.map(r => r.MODE).filter(Boolean)).size;
    const summary = [
      ['overviewTotal', records.length, 'QSO', 'log', I18N.t('totalFoot')],
      ['overviewDxcc', dxcc, 'DXCC', 'globe', I18N.t('dxccFoot')],
      ['overviewConfirmed', confirmed, 'QSO', 'check', I18N.t('confirmedFoot', { n: records.length ? Math.round(confirmed / records.length * 100) : 0 })],
      ['overviewBands', bands, 'BANDS', 'wave', I18N.t('bandsFoot', { n: modes })]
    ];
    document.getElementById('overview-stats').innerHTML = summary.map(([label, value, unit, icon, foot]) => `
      <div class="overview-card"><div class="overview-label"><span>${Utils.esc(I18N.t(label))}</span><svg class="icon" aria-hidden="true"><use href="#i-${icon}"/></svg></div><div class="overview-value">${value.toLocaleString()}<small>${unit}</small></div><div class="overview-foot">${Utils.esc(foot)}</div></div>`).join('');
    document.getElementById('nav-log-count').textContent = records.length.toLocaleString();
    document.getElementById('log-total').textContent = records.length.toLocaleString();
  },

  bindEvents() {
    const clock = () => { document.getElementById('utc-time').textContent = new Date().toISOString().slice(11, 19); };
    clock();
    setInterval(clock, 1000);
    window.addEventListener('hashchange', () => {
      const name = location.hash.slice(1);
      if (this.tabs[name]) this.showTab(name);
    });
    document.getElementById('hero-stats').onclick = () => { location.hash = 'stats'; };

    // 日志筛选栏
    const filterBar = document.getElementById('log-filters');
    if (filterBar) {
      filterBar.addEventListener('input', e => {
        if (e.target.name === 'q') { this.state.filter.q = e.target.value; this.state.page = 1; this.debounceRender(); }
      });
      filterBar.addEventListener('click', e => {
        if (!e.target.closest('[data-reset-filters]')) return;
        this.state.filter = { q: '', band: '', mode: '', year: '', country: '' };
        this.state.page = 1;
        this.tabs.log();
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
        const row = e.target.closest('tr[data-id]');
        if (!row) return;
        const id = row.dataset.id;
        const rec = this.state.records.find(r => ADIF.recordId(r) === id);
        if (!rec) return;

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
        || (r.SAT_NAME || '').toLowerCase().includes(q)
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

    const activeInput = document.activeElement;
    const searchFocused = activeInput && activeInput.matches('#log-filters input[name="q"]');
    const selection = searchFocused ? activeInput.selectionStart : null;
    document.getElementById('log-filters').innerHTML = `
      <label class="search-field"><svg class="icon" aria-hidden="true"><use href="#i-search"/></svg><input type="search" name="q" aria-label="${Utils.esc(I18N.t('filterSearch'))}" placeholder="${Utils.esc(I18N.t('filterSearch'))}" value="${Utils.esc(sel('q'))}"></label>
      <select name="band" aria-label="${Utils.esc(I18N.t('allBands'))}"><option value="">${Utils.esc(I18N.t('allBands'))}</option>${distinct('BAND').map(b => `<option ${b === sel('band') ? 'selected' : ''}>${Utils.esc(b)}</option>`).join('')}</select>
      <select name="mode" aria-label="${Utils.esc(I18N.t('allModes'))}"><option value="">${Utils.esc(I18N.t('allModes'))}</option>${distinct('MODE').map(m => `<option ${m === sel('mode') ? 'selected' : ''}>${Utils.esc(m)}</option>`).join('')}</select>
      <select name="year" aria-label="${Utils.esc(I18N.t('allYears'))}"><option value="">${Utils.esc(I18N.t('allYears'))}</option>${years.map(y => `<option ${y === sel('year') ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select name="country" aria-label="${Utils.esc(I18N.t('allCountries'))}"><option value="">${Utils.esc(I18N.t('allCountries'))}</option>${distinct('COUNTRY').map(c => `<option ${c === sel('country') ? 'selected' : ''}>${Utils.esc(c)}</option>`).join('')}</select>
      ${Object.values(this.state.filter).some(Boolean) ? `<button class="filter-reset" data-reset-filters>${Utils.esc(I18N.t('resetFilters'))}</button>` : ''}
      <span class="filter-count">${Utils.esc(I18N.t('filterCount', { n: total }))}</span>
    `;

    if (searchFocused) {
      const input = document.querySelector('#log-filters input[name="q"]');
      input.focus();
      if (selection !== null) input.setSelectionRange(selection, selection);
    }
    const tbody = document.getElementById('log-body');
    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">${Utils.esc(I18N.t(this.state.records.length ? 'noResults' : 'logEmpty'))}</td></tr>`;
    } else {
      tbody.innerHTML = slice.map(rec => {
        const id = ADIF.recordId(rec);
        const expanded = this.state.expanded === id;
        const detail = expanded ? this.renderDetail(rec, id) : '';
        return `
        <tr data-id="${Utils.esc(id)}" class="${expanded ? 'expanded' : ''}">
          <td class="date">${Utils.esc(ADIF.prettyDate(rec.QSO_DATE))}<small>${Utils.esc(ADIF.prettyTime(rec.TIME_ON) || '—')} UTC</small></td>
          <td class="call"><button class="record-toggle" aria-expanded="${expanded}" aria-label="${Utils.esc(I18N.t('openRecord', { call: rec.CALL || '—' }))}">${Utils.esc(rec.CALL || '—')}</button><small>${Utils.esc(rec.COUNTRY || '—')}</small></td>
          <td><span class="band-tag">${Utils.esc(rec.BAND || '—')}</span></td>
          <td><span class="mode-tag mode-${Utils.esc((rec.MODE || '').toLowerCase())}">${Utils.esc(rec.MODE || '—')}</span></td>
          <td class="rst">${Utils.esc(rec.RST_SENT || '—')} / ${Utils.esc(rec.RST_RCVD || '—')}</td>
          <td class="grid-cell">${Utils.esc(rec.GRIDSQUARE || '—')}</td>
          <td>${Utils.badge(rec.QSL_SENT, false)}</td>
          <td>${Utils.badge(rec.QSL_RCVD, true)}</td>
        </tr>
        ${detail ? `<tr class="detail-row" data-id="${Utils.esc(id)}"><td colspan="8">${detail}</td></tr>` : ''}`;
      }).join('');
    }

    // 分页
    const pager = document.getElementById('log-pager');
    pager.innerHTML = `
      <span class="pager-summary">${Utils.esc(I18N.t('pagerRange', { from: total ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, total), n: total }))}</span>
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
      [I18N.t('satelliteName'),rec.SAT_NAME],
      [I18N.t('propagationMode'),rec.PROP_MODE],
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
      `;
  }
};

window.App = App;
window.Utils = Utils;

App.tabs.log = () => App.log();
App.tabs.satellites=()=>{
  const el=document.getElementById('page-satellites');if(!el.classList.contains('active'))return;
  if(!App.satelliteTools)App.satelliteTools=QslSat.mount(el,{apiBaseUrl:App.state.config.apiBaseUrl,station:App.state.config.station,language:I18N.getLang()});
  else App.satelliteTools.setLanguage(I18N.getLang());
};
