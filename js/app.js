/* ============================================================================
 * app.js — 应用外壳 + 通联日志页（表格 / 筛选 / 分页 / 详情 / QSL 快捷操作）
 * 依赖: adif.js, store.js
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
    return `<span class="badge badge-${info.color}">${Utils.esc(info.label)}</span>`;
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
    await this.refresh();
    this.showTab(location.hash ? location.hash.slice(1) : 'log');
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
        if (confirm(`确认删除 ${rec.CALL} ${rec.QSO_DATE} 这条记录？\n（删除会写入本地草稿，提交仓库后生效）`)) {
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
      <input type="search" name="q" placeholder="搜索呼号 / 国家 / 网格 / 备注…" value="${Utils.esc(sel('q'))}">
      <select name="band"><option value="">全部波段</option>${distinct('BAND').map(b => `<option ${b === sel('band') ? 'selected' : ''}>${Utils.esc(b)}</option>`).join('')}</select>
      <select name="mode"><option value="">全部模式</option>${distinct('MODE').map(m => `<option ${m === sel('mode') ? 'selected' : ''}>${Utils.esc(m)}</option>`).join('')}</select>
      <select name="year"><option value="">全部年份</option>${years.map(y => `<option ${y === sel('year') ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select name="country"><option value="">全部国家</option>${distinct('COUNTRY').map(c => `<option ${c === sel('country') ? 'selected' : ''}>${Utils.esc(c)}</option>`).join('')}</select>
      <span class="filter-count">共 ${total} 条</span>
    `;

    const tbody = document.getElementById('log-body');
    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">暂无通联记录。去「录入」页添加，或把 data/log.adi 替换成你的 ADIF 日志。</td></tr>`;
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
      <button ${page <= 1 ? 'disabled' : ''} data-pg="prev">上一页</button>
      <span class="page-info">第 ${page} / ${pages} 页</span>
      <button ${page >= pages ? 'disabled' : ''} data-pg="next">下一页</button>
      <select class="page-size" title="每页条数">
        ${[25, 50, 100, 200].map(n => `<option value="${n}" ${n === pageSize ? 'selected' : ''}>${n} 条/页</option>`).join('')}
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
    const fields = [
      ['呼号', rec.CALL], ['日期 (UTC)', ADIF.prettyDate(rec.QSO_DATE)], ['时间 (UTC)', ADIF.prettyTime(rec.TIME_ON)],
      ['波段', rec.BAND], ['模式', rec.MODE], ['频率 (MHz)', rec.FREQ],
      ['RST 发送', rec.RST_SENT], ['RST 接收', rec.RST_RCVD],
      ['网格', rec.GRIDSQUARE], ['IOTA', rec.IOTA], ['DXCC', rec.DXCC], ['国家/地区', rec.COUNTRY],
      ['QSL 发出', ADIF.qslStatusInfo(rec.QSL_SENT, false).label + (rec.QSL_SENT_DATE ? ' (' + ADIF.prettyDate(rec.QSL_SENT_DATE) + ')' : '')],
      ['QSL 收到', ADIF.qslStatusInfo(rec.QSL_RCVD, true).label + (rec.QSL_RCVD_DATE ? ' (' + ADIF.prettyDate(rec.QSL_RCVD_DATE) + ')' : '')],
      ['QSL 途径', rec.QSL_VIA], ['QSL 附言', rec.QSLMSG],
      ['LoTW', `${rec.LOTW_QSL_SENT || '—'}/${rec.LOTW_QSL_RCVD || '—'}`],
      ['eQSL', `${rec.EQSL_QSL_SENT || '—'}/${rec.EQSL_QSL_RCVD || '—'}`],
      ['备注', rec.COMMENT]
    ].filter(([, v]) => v !== undefined && v !== null && v !== '');

    return `
      <div class="detail-grid">
        ${fields.map(([k, v]) => `<div class="detail-item"><span class="detail-key">${Utils.esc(k)}</span><span class="detail-val">${Utils.esc(v)}</span></div>`).join('')}
      </div>
      <div class="detail-actions">
        <button class="btn btn-sm" data-action="qsl-sent-y" ${sentY ? 'disabled' : ''}>标记 QSL 已寄出</button>
        <button class="btn btn-sm" data-action="qsl-sent-q" ${sentY ? 'disabled' : ''}>标记待寄出</button>
        <button class="btn btn-sm" data-action="qsl-rcvd-y" ${rcvdY ? 'disabled' : ''}>标记 QSL 已收到</button>
        <button class="btn btn-sm" data-action="qsl-rcvd-r" ${rcvdY ? 'disabled' : ''}>标记请求补卡</button>
        <button class="btn btn-sm" data-action="edit">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete">删除</button>
        <span class="detail-hint">操作保存在本机草稿，提交到仓库后正式生效</span>
      </div>`;
  },

  /* ------------------------------------------------------- 本地草稿徽标 */
  updateLocalBadge() {
    const c = Store.localChangeCount();
    const badge = document.getElementById('local-badge');
    const total = c.added + c.updated + c.deleted;
    if (badge) {
      badge.textContent = total > 0 ? `本机草稿 ${total} 条未提交` : '';
      badge.classList.toggle('show', total > 0);
    }
  }
};

window.App = App;
window.Utils = Utils;
