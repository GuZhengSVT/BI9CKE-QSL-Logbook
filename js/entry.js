/* ============================================================================
 * entry.js — 录入页（表单录入 / ADIF 导入 / ADIF 导出 / 本地草稿管理 / GitHub 一键提交）
 * 依赖: i18n.js, adif.js, store.js, app.js, github.js
 * 注册到 App.tabs.entry；暴露 window.Entry
 * ==========================================================================*/
'use strict';

const Entry = {
  editingId: null,   // 编辑中的记录 id（null = 新增）
  pendingImages: [], // 待上传的卡片图片文件

  /* ------------------------------------------------------------ 渲染 */
  render() {
    const el = document.getElementById('page-entry');
    if (!el) return;
    const cfg = App.state.config || {};
    const commonBands = (cfg.commonBands || ['160M', '80M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M', '2M', '70CM']).join(',');
    const commonModes = (cfg.commonModes || ['SSB', 'CW', 'FT8', 'FM', 'AM', 'RTTY', 'PSK31', 'FT4', 'DSTAR']).join(',');

    el.innerHTML = `
      <div class="entry-grid">
        <!-- 左：录入表单 -->
        <div class="entry-form-card">
          <h3 id="entry-title">${Utils.esc(I18N.t('entryTitle'))}</h3>
          <div class="form-grid">
            <label>${Utils.esc(I18N.t('fldCall'))} *<input id="f-call" placeholder="BG1ABC" required></label>
            <label>${Utils.esc(I18N.t('fldDate'))} *<input id="f-date" type="date" value="${Utils.todayAdif().slice(0, 4)}-${Utils.todayAdif().slice(4, 6)}-${Utils.todayAdif().slice(6, 8)}"></label>
            <label>${Utils.esc(I18N.t('fldTime'))}<input id="f-time" type="time" step="1" value=""></label>
            <label>${Utils.esc(I18N.t('fldBand'))} *<input id="f-band" list="dl-bands" placeholder="20M" required></label>
            <label>${Utils.esc(I18N.t('fldMode'))} *<input id="f-mode" list="dl-modes" placeholder="SSB" required></label>
            <label>${Utils.esc(I18N.t('fldFreq'))}<input id="f-freq" placeholder="14.270"></label>
            <label>${Utils.esc(I18N.t('fldRstS'))}<input id="f-rst-s" placeholder="599"></label>
            <label>${Utils.esc(I18N.t('fldRstR'))}<input id="f-rst-r" placeholder="599"></label>
            <label>${Utils.esc(I18N.t('fldGrid'))}<input id="f-grid" placeholder="OM89AA"></label>
            <label>IOTA<input id="f-iota" placeholder="AS-007"></label>
            <label>DXCC<input id="f-dxcc" placeholder="318"></label>
            <label>${Utils.esc(I18N.t('fldCountry'))}<input id="f-country" placeholder="China"></label>
            <label>${Utils.esc(I18N.t('fldQslS'))}
              <select id="f-qsl-s">
                <option value="">${Utils.esc(I18N.t('qslNone'))}</option>
                <option value="N">N ${Utils.esc(I18N.t('qslN'))}</option>
                <option value="Q">Q ${Utils.esc(I18N.t('qslQ'))}</option>
                <option value="R">R ${Utils.esc(I18N.t('qslR'))}</option>
                <option value="Y">Y ${Utils.esc(I18N.t('qslY'))}</option>
                <option value="S">S ${Utils.esc(I18N.t('qslS'))}</option>
                <option value="M">M ${Utils.esc(I18N.t('qslM'))}</option>
                <option value="I">I ${Utils.esc(I18N.t('qslI'))}</option>
              </select></label>
            <label>${Utils.esc(I18N.t('fldQslSDate'))}<input id="f-qsl-s-date" type="date"></label>
            <label>${Utils.esc(I18N.t('fldQslR'))}
              <select id="f-qsl-r">
                <option value="">${Utils.esc(I18N.t('qslNone'))}</option>
                <option value="N">N ${Utils.esc(I18N.t('qslNRcvd'))}</option>
                <option value="R">R ${Utils.esc(I18N.t('qslRRcvd'))}</option>
                <option value="Y">Y ${Utils.esc(I18N.t('qslYRcvd'))}</option>
                <option value="I">I ${Utils.esc(I18N.t('qslIRcvd'))}</option>
              </select></label>
            <label>${Utils.esc(I18N.t('fldQslRDate'))}<input id="f-qsl-r-date" type="date"></label>
            <label>${Utils.esc(I18N.t('fldQslVia'))}<input id="f-qsl-via" placeholder="DIRECT / BURO"></label>
            <label class="wide">${Utils.esc(I18N.t('fldQslMsg'))}<input id="f-qslmsg" placeholder="TNX QSO! 73"></label>
            <label class="wide">${Utils.esc(I18N.t('fldComment'))}<input id="f-comment"></label>
          </div>
          <datalist id="dl-bands">${commonBands.split(',').map(b => `<option value="${b.trim()}">`).join('')}</datalist>
          <datalist id="dl-modes">${commonModes.split(',').map(m => `<option value="${m.trim()}">`).join('')}</datalist>
          <div class="entry-actions">
            <button class="btn btn-primary" id="btn-save">${Utils.esc(I18N.t('btnSave'))}</button>
            <button class="btn" id="btn-reset">${Utils.esc(I18N.t('btnReset'))}</button>
            <span class="entry-hint">${Utils.esc(I18N.t('entryHint'))}</span>
          </div>
          <div id="entry-msg" class="entry-msg"></div>
        </div>

        <!-- 右：导入 / 导出 / 草稿 / 一键提交 -->
        <div class="entry-side">
          <div class="side-card">
            <h3>${Utils.esc(I18N.t('importTitle'))}</h3>
            <p class="side-hint">${Utils.esc(I18N.t('importHint'))}</p>
            <textarea id="import-text" rows="6" placeholder="${Utils.esc(I18N.t('importPlaceholder'))}"></textarea>
            <div class="side-row">
              <label class="checkbox"><input type="checkbox" id="import-merge"> ${Utils.esc(I18N.t('importMerge'))}</label>
              <input type="file" id="import-file" accept=".adi,.txt,text/plain" class="file-input">
            </div>
            <div class="entry-actions">
              <button class="btn" id="btn-import">${Utils.esc(I18N.t('btnImport'))}</button>
            </div>
            <div id="import-msg" class="entry-msg"></div>
          </div>

          <div class="side-card">
            <h3>${Utils.esc(I18N.t('exportTitle'))}</h3>
            <p class="side-hint">${Utils.esc(I18N.t('exportHint'))}</p>
            <div class="entry-actions">
              <button class="btn" id="btn-export-all">${Utils.esc(I18N.t('btnExportAll'))}</button>
              <button class="btn" id="btn-export-local">${Utils.esc(I18N.t('btnExportLocal'))}</button>
              <button class="btn" id="btn-copy">${Utils.esc(I18N.t('btnCopy'))}</button>
            </div>
          </div>

          <div class="side-card">
            <h3>${Utils.esc(I18N.t('draftTitle'))}</h3>
            <p class="side-hint">${Utils.esc(I18N.t('draftHint'))}</p>
            <div id="local-detail" class="local-detail"></div>
            <div class="entry-actions">
              <button class="btn btn-danger" id="btn-clear-local">${Utils.esc(I18N.t('btnClearDraft'))}</button>
            </div>
          </div>

          <div class="side-card">
            <h3>${Utils.esc(I18N.t('ghTitle'))}</h3>
            <p class="side-hint">${Utils.esc(I18N.t('ghHint'))}</p>
            <div class="github-config">
              <input id="gh-owner" placeholder="${Utils.esc(I18N.t('ghOwner'))}" autocomplete="off">
              <input id="gh-repo" placeholder="${Utils.esc(I18N.t('ghRepo'))}" autocomplete="off">
              <input id="gh-branch" placeholder="${Utils.esc(I18N.t('ghBranch'))}" autocomplete="off">
              <input id="gh-token" type="password" placeholder="${Utils.esc(I18N.t('ghToken'))}" autocomplete="off">
            </div>
            <div class="entry-actions">
              <button class="btn" id="btn-gh-save">${Utils.esc(I18N.t('btnGhSave'))}</button>
              <button class="btn" id="btn-gh-test">${Utils.esc(I18N.t('btnGhTest'))}</button>
              <button class="btn btn-danger" id="btn-gh-clear">${Utils.esc(I18N.t('btnGhClear'))}</button>
            </div>
            <div id="gh-status" class="entry-msg"></div>
            <hr class="side-hr">
            <p class="side-hint">${Utils.esc(I18N.t('ghImagesHint'))}</p>
            <input type="file" id="gh-images" accept="image/*" multiple>
            <div id="gh-filelist" class="local-detail"></div>
            <div class="entry-actions">
              <button class="btn btn-primary" id="btn-gh-push">${Utils.esc(I18N.t('btnPush', { n: 0 }))}</button>
            </div>
            <div id="gh-push-msg" class="entry-msg"></div>
          </div>
        </div>
      </div>`;

    this.bind(el);
    this.renderLocalDetail();
  },

  bind(el) {
    el.querySelector('#btn-save').onclick = () => this.save();
    el.querySelector('#btn-reset').onclick = () => this.resetForm();
    el.querySelector('#btn-import').onclick = () => this.doImport();
    el.querySelector('#btn-export-all').onclick = () => this.download(Store.exportAdif(false), 'qsl-log-full.adi');
    el.querySelector('#btn-export-local').onclick = () => this.download(Store.exportAdif(true), 'qsl-log-local.adi');
    el.querySelector('#btn-copy').onclick = () => this.copy();
    el.querySelector('#btn-clear-local').onclick = () => {
      if (confirm(I18N.t('clearDraftConfirm'))) {
        Store.clearLocalChanges();
        App.refresh();
      }
    };

    // ---- GitHub 一键提交 ----
    this.fillGithubForm(el);
    el.querySelector('#btn-gh-save').onclick = () => this.saveGithubForm(el);
    el.querySelector('#btn-gh-test').onclick = () => this.testGithub(el);
    el.querySelector('#btn-gh-clear').onclick = () => {
      if (confirm(I18N.t('ghClearConfirm'))) {
        GitHub.clearConfig();
        this.fillGithubForm(el);
        this.msg('gh-status', I18N.t('ghCleared'), 'ok');
      }
    };
    el.querySelector('#gh-images').onchange = () => this.onImagesSelected(el);
    el.querySelector('#btn-gh-push').onclick = () => this.doPush(el);

    const fileInput = el.querySelector('#import-file');
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { el.querySelector('#import-text').value = reader.result; };
      reader.readAsText(file);
    };
  },

  /* ------------------------------------------------------------ 保存 */
  save() {
    const g = id => document.getElementById(id).value.trim();
    const call = g('f-call').toUpperCase();
    const date = g('f-date').replace(/-/g, '');
    const band = g('f-band').toUpperCase();
    const mode = g('f-mode').toUpperCase();
    if (!call || !date || !band || !mode) {
      this.msg('entry-msg', I18N.t('entryRequired'), 'error');
      return;
    }
    const time = g('f-time').replace(/:/g, '');
    const rec = {
      CALL: call,
      QSO_DATE: date,
      TIME_ON: time,
      BAND: band,
      MODE: mode,
      FREQ: g('f-freq'),
      RST_SENT: g('f-rst-s'),
      RST_RCVD: g('f-rst-r'),
      GRIDSQUARE: g('f-grid').toUpperCase(),
      IOTA: g('f-iota').toUpperCase(),
      DXCC: g('f-dxcc'),
      COUNTRY: g('f-country'),
      QSL_SENT: g('f-qsl-s') || undefined,
      QSL_SENT_DATE: g('f-qsl-s-date') ? g('f-qsl-s-date').replace(/-/g, '') : undefined,
      QSL_RCVD: g('f-qsl-r') || undefined,
      QSL_RCVD_DATE: g('f-qsl-r-date') ? g('f-qsl-r-date').replace(/-/g, '') : undefined,
      QSL_VIA: g('f-qsl-via').toUpperCase(),
      QSLMSG: g('f-qslmsg'),
      COMMENT: g('f-comment')
    };
    Store.upsert(rec);
    this.msg('entry-msg', I18N.t('entrySaved', { call, date }), 'ok');
    this.editingId = null;
    this.resetForm();
    App.refresh();
  },

  /* --------------------------------------------------------- 编辑载入 */
  loadIntoForm(rec) {
    this.editingId = ADIF.recordId(rec);
    const set = (id, v) => { document.getElementById(id).value = v || ''; };
    const toDate = v => v && v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : '';
    set('f-call', rec.CALL); set('f-date', toDate(rec.QSO_DATE));
    set('f-time', rec.TIME_ON ? `${rec.TIME_ON.slice(0, 2)}:${rec.TIME_ON.slice(2, 4)}` : '');
    set('f-band', rec.BAND); set('f-mode', rec.MODE); set('f-freq', rec.FREQ);
    set('f-rst-s', rec.RST_SENT); set('f-rst-r', rec.RST_RCVD);
    set('f-grid', rec.GRIDSQUARE); set('f-iota', rec.IOTA);
    set('f-dxcc', rec.DXCC); set('f-country', rec.COUNTRY);
    set('f-qsl-s', rec.QSL_SENT); set('f-qsl-s-date', toDate(rec.QSL_SENT_DATE));
    set('f-qsl-r', rec.QSL_RCVD); set('f-qsl-r-date', toDate(rec.QSL_RCVD_DATE));
    set('f-qsl-via', rec.QSL_VIA); set('f-qslmsg', rec.QSLMSG); set('f-comment', rec.COMMENT);
    const title = document.getElementById('entry-title');
    if (title) title.textContent = I18N.t('entryEditTitle', { call: rec.CALL, date: ADIF.prettyDate(rec.QSO_DATE) });
  },

  resetForm() {
    if (this.editingId) {
      const title = document.getElementById('entry-title');
      if (title) title.textContent = I18N.t('entryTitle');
      this.editingId = null;
    }
    document.querySelectorAll('#page-entry .form-grid input:not([type=checkbox]), #page-entry .form-grid select').forEach(el => {
      if (el.type === 'date' && el.id === 'f-date') {
        const t = Utils.todayAdif();
        el.value = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
      } else if (el.type === 'date') {
        el.value = '';
      } else {
        el.value = '';
      }
    });
  },

  /* ------------------------------------------------------------ 导入 */
  doImport() {
    const text = document.getElementById('import-text').value;
    if (!text.trim()) { this.msg('import-msg', I18N.t('importEmpty'), 'error'); return; }
    try {
      const parsed = ADIF.parse(text);
      const merge = document.getElementById('import-merge').checked;
      if (parsed.records.length === 0) { this.msg('import-msg', I18N.t('importNone'), 'error'); return; }
      const result = Store.importRecords(parsed.records, merge);
      this.msg('import-msg', I18N.t('importResult', result), 'ok');
      App.refresh();
    } catch (e) {
      this.msg('import-msg', I18N.t('importError', { msg: e.message }), 'error');
    }
  },

  /* ------------------------------------------------------------ 导出 */
  download(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },

  async copy() {
    try {
      await navigator.clipboard.writeText(Store.exportAdif(false));
      this.msg('entry-msg', I18N.t('copied'), 'ok');
    } catch (e) {
      this.msg('entry-msg', I18N.t('copyFail'), 'error');
    }
  },

  /* ------------------------------------------------------ 草稿详情 */
  renderLocalDetail() {
    const el = document.getElementById('local-detail');
    if (!el) return;
    const c = Store.localChangeCount();
    el.innerHTML = c.added + c.updated + c.deleted === 0
      ? '<p class="side-hint">' + Utils.esc(I18N.t('draftEmpty')) + '</p>'
      : `<ul>
          <li>${Utils.esc(I18N.t('draftAdded', { n: c.added }))}</li>
          <li>${Utils.esc(I18N.t('draftUpdated', { n: c.updated }))}</li>
          <li>${Utils.esc(I18N.t('draftDeleted', { n: c.deleted }))}</li>
        </ul>`;
  },

  /* ------------------------------------------------------ GitHub 提交 */
  // 从文件名解析呼号与日期，如 "JA1XYZ_20240315.jpg" → {call:'JA1XYZ', date:'20240315'}
  parseCardFilename(name) {
    const base = name.replace(/\.[^.]+$/, '');
    const m = base.match(/^([0-9]?[A-Z]{1,2}\d[A-Z0-9]{1,4})(?:[-_]?(\d{8}))?$/i);
    if (!m) return { call: '', date: '' };
    return { call: m[1].toUpperCase(), date: m[2] || '' };
  },

  fillGithubForm(el) {
    const cfg = GitHub.loadConfig();
    el.querySelector('#gh-owner').value = cfg.owner || '';
    el.querySelector('#gh-repo').value = cfg.repo || '';
    el.querySelector('#gh-branch').value = cfg.branch || 'main';
    el.querySelector('#gh-token').value = cfg.token || '';
  },

  saveGithubForm(el) {
    const cfg = {
      owner: el.querySelector('#gh-owner').value.trim(),
      repo: el.querySelector('#gh-repo').value.trim(),
      branch: el.querySelector('#gh-branch').value.trim() || 'main',
      token: el.querySelector('#gh-token').value.trim()
    };
    if (!cfg.owner || !cfg.repo) { this.msg('gh-status', I18N.t('ghErrOwner'), 'error'); return; }
    if (!cfg.token) { this.msg('gh-status', I18N.t('ghErrToken'), 'error'); return; }
    GitHub.saveConfig(cfg);
    this.msg('gh-status', I18N.t('ghSaved'), 'ok');
  },

  async testGithub(el) {
    try {
      this.msg('gh-status', I18N.t('ghTesting'), '');
      const info = await GitHub.test();
      this.msg('gh-status', I18N.t('ghTestOk', { info }), 'ok');
    } catch (e) {
      this.msg('gh-status', I18N.t('ghTestFail', { msg: e.message }), 'error');
    }
  },

  onImagesSelected(el) {
    const input = el.querySelector('#gh-images');
    const list = el.querySelector('#gh-filelist');
    const btn = el.querySelector('#btn-gh-push');
    this.pendingImages = Array.from(input.files || []);
    if (this.pendingImages.length === 0) {
      list.innerHTML = '';
      btn.textContent = I18N.t('btnPush', { n: 0 });
      return;
    }
    list.innerHTML = `<ul>${this.pendingImages.map(f =>
      `<li>${Utils.esc(I18N.t('ghImageItem', { name: f.name, size: (f.size / 1024).toFixed(0) }))}</li>`).join('')}</ul>`;
    const changes = Store.localChangeCount();
    const total = this.pendingImages.length + (changes.added + changes.updated + changes.deleted > 0 ? 1 : 0);
    btn.textContent = I18N.t('btnPush', { n: total });
  },

  async doPush(el) {
    const pushMsg = el.querySelector('#gh-push-msg');
    const btn = el.querySelector('#btn-gh-push');
    try {
      // 组装待提交文件
      const files = [];
      // 1. 完整日志（含草稿）
      const adifContent = Store.exportAdif(false);
      files.push({ path: 'data/log.adi', content: adifContent, encoding: 'utf-8' });

      // 2. 图片 + manifest
      let manifest = { cards: [] };
      try {
        const res = await fetch('qsl-cards/manifest.json');
        if (res.ok) manifest = await res.json();
      } catch (e) { /* 忽略，从空开始 */ }
      const cards = manifest.cards || [];
      const images = this.pendingImages || [];
      let manifestChanged = false;
      for (const file of images) {
        const base64 = await this.fileToBase64(file);
        files.push({ path: 'qsl-cards/' + file.name, content: base64, encoding: 'base64' });
        if (!cards.some(c => c.file === file.name)) {
          const { call, date } = this.parseCardFilename(file.name);
          cards.push({ file: file.name, call, date });
          manifestChanged = true;
        }
      }
      if (manifestChanged) {
        files.push({ path: 'qsl-cards/manifest.json', content: JSON.stringify({ cards }, null, 2) + '\n', encoding: 'utf-8' });
      }

      if (files.length <= 1) {
        this.msg('gh-push-msg', I18N.t('ghNothing'), 'error');
        return;
      }

      // 统计信息
      const recordsCount = Store.localChangeCount();
      const summary = [];
      summary.push(`log (drafts: +${recordsCount.added}/~${recordsCount.updated}/-${recordsCount.deleted})`);
      if (images.length) summary.push(`${images.length} card image(s)`);
      if (manifestChanged) summary.push('manifest');

      btn.disabled = true;
      btn.textContent = I18N.t('btnPushing');
      this.msg('gh-push-msg', I18N.t('ghPushing'), '');

      const result = await GitHub.pushFiles(files, 'Web push: ' + summary.join(', '));
      this.msg('gh-push-msg', I18N.t('ghPushOk', { sha: result.commitSha.slice(0, 7) }), 'ok');
      this.pendingImages = [];
      el.querySelector('#gh-images').value = '';
      el.querySelector('#gh-filelist').innerHTML = '';
      btn.textContent = I18N.t('btnPush', { n: 0 });
      // 数据已入库，清除草稿
      Store.clearLocalChanges();
      App.refresh();
    } catch (e) {
      this.msg('gh-push-msg', I18N.t('ghPushFail', { msg: e.message }), 'error');
    } finally {
      btn.disabled = false;
    }
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('读取文件失败：' + file.name));
      reader.readAsDataURL(file);
    });
  },

  msg(id, text, type) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = 'entry-msg ' + (type || '');
    }
  }
};

window.Entry = Entry;
App.tabs.entry = () => Entry.render();
