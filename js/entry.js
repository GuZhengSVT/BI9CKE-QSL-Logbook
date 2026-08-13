/* ============================================================================
 * entry.js — 录入页（表单录入 / ADIF 导入 / ADIF 导出 / 本地草稿管理 / GitHub 一键提交）
 * 依赖: adif.js, store.js, app.js, github.js
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
    const c = Store.localChangeCount();
    const commonBands = (cfg.commonBands || ['160M', '80M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M', '2M', '70CM']).join(',');
    const commonModes = (cfg.commonModes || ['SSB', 'CW', 'FT8', 'FM', 'AM', 'RTTY', 'PSK31', 'FT4', 'DSTAR']).join(',');

    el.innerHTML = `
      <div class="entry-grid">
        <!-- 左：录入表单 -->
        <div class="entry-form-card">
          <h3 id="entry-title">新增通联记录</h3>
          <div class="form-grid">
            <label>呼号 *<input id="f-call" placeholder="BG1ABC" required></label>
            <label>日期 (UTC) *<input id="f-date" type="date" value="${Utils.todayAdif().slice(0, 4)}-${Utils.todayAdif().slice(4, 6)}-${Utils.todayAdif().slice(6, 8)}"></label>
            <label>时间 (UTC)<input id="f-time" type="time" step="1" value=""></label>
            <label>波段 *<input id="f-band" list="dl-bands" placeholder="20M" required></label>
            <label>模式 *<input id="f-mode" list="dl-modes" placeholder="SSB" required></label>
            <label>频率 (MHz)<input id="f-freq" placeholder="14.270"></label>
            <label>RST 发送<input id="f-rst-s" placeholder="599"></label>
            <label>RST 接收<input id="f-rst-r" placeholder="599"></label>
            <label>网格<input id="f-grid" placeholder="OM89AA"></label>
            <label>IOTA<input id="f-iota" placeholder="AS-007"></label>
            <label>DXCC<input id="f-dxcc" placeholder="318"></label>
            <label>国家/地区<input id="f-country" placeholder="China"></label>
            <label>QSL 发出状态
              <select id="f-qsl-s">
                <option value="">未标记</option>
                <option value="N">N 未发</option>
                <option value="Q">Q 排队中</option>
                <option value="R">R 已请求</option>
                <option value="Y">Y 已寄出</option>
                <option value="S">S 已提交第三方</option>
                <option value="M">M 卡片局</option>
                <option value="I">I 忽略</option>
              </select></label>
            <label>寄出日期<input id="f-qsl-s-date" type="date"></label>
            <label>QSL 收到状态
              <select id="f-qsl-r">
                <option value="">未标记</option>
                <option value="N">N 未收</option>
                <option value="R">R 已请求</option>
                <option value="Y">Y 已收到</option>
                <option value="I">I 忽略</option>
              </select></label>
            <label>收到日期<input id="f-qsl-r-date" type="date"></label>
            <label>QSL 途径<input id="f-qsl-via" placeholder="DIRECT / BURO"></label>
            <label class="wide">QSL 附言<input id="f-qslmsg" placeholder="TNX QSO! 73"></label>
            <label class="wide">备注<input id="f-comment"></label>
          </div>
          <datalist id="dl-bands">${commonBands.split(',').map(b => `<option value="${b.trim()}">`).join('')}</datalist>
          <datalist id="dl-modes">${commonModes.split(',').map(m => `<option value="${m.trim()}">`).join('')}</datalist>
          <div class="entry-actions">
            <button class="btn btn-primary" id="btn-save">💾 保存记录</button>
            <button class="btn" id="btn-reset">清空</button>
            <span class="entry-hint">保存到本机草稿；「一键提交」或「导出 ADIF」后写回仓库即正式入库</span>
          </div>
          <div id="entry-msg" class="entry-msg"></div>
        </div>

        <!-- 右：导入 / 导出 / 草稿 / 一键提交 -->
        <div class="entry-side">
          <div class="side-card">
            <h3>📥 导入 ADIF</h3>
            <p class="side-hint">从 WSJT-X / N1MM / Log4OM / LoTW / Clublog 等导出的 .adi 文件或文本，粘贴或选择文件导入。相同记录默认跳过，可勾选合并更新。</p>
            <textarea id="import-text" rows="6" placeholder="在此粘贴 ADIF 文本…"></textarea>
            <div class="side-row">
              <label class="checkbox"><input type="checkbox" id="import-merge"> 已存在记录用新值合并更新</label>
              <input type="file" id="import-file" accept=".adi,.txt,text/plain" class="file-input">
            </div>
            <div class="entry-actions">
              <button class="btn" id="btn-import">导入</button>
            </div>
            <div id="import-msg" class="entry-msg"></div>
          </div>

          <div class="side-card">
            <h3>📤 导出 ADIF</h3>
            <p class="side-hint">导出后 <b>提交到仓库</b>（git commit 或 GitHub 网页上传）即完成正式入库。推荐提交后点「清除本机草稿」。</p>
            <div class="entry-actions">
              <button class="btn" id="btn-export-all">下载完整日志</button>
              <button class="btn" id="btn-export-local">下载本机草稿</button>
              <button class="btn" id="btn-copy">复制 ADIF</button>
            </div>
          </div>

          <div class="side-card">
            <h3>🗂 本机草稿</h3>
            <p class="side-hint">尚未提交到仓库的本地修改（只存在于当前浏览器）。</p>
            <div id="local-detail" class="local-detail"></div>
            <div class="entry-actions">
              <button class="btn btn-danger" id="btn-clear-local">清除本机草稿</button>
            </div>
          </div>

          <div class="side-card">
            <h3>🚀 一键提交到 GitHub</h3>
            <p class="side-hint">把本机草稿和卡片图片直接写回仓库，一次提交、自动重新部署，无需手动 git。</p>
            <div class="github-config">
              <input id="gh-owner" placeholder="GitHub 用户名" autocomplete="off">
              <input id="gh-repo" placeholder="仓库名（如 ham-qsl-log）" autocomplete="off">
              <input id="gh-branch" placeholder="分支（默认 main）" autocomplete="off">
              <input id="gh-token" type="password" placeholder="PAT 令牌（仅存于本浏览器）" autocomplete="off">
            </div>
            <div class="entry-actions">
              <button class="btn" id="btn-gh-save">保存设置</button>
              <button class="btn" id="btn-gh-test">测试连接</button>
              <button class="btn btn-danger" id="btn-gh-clear">清除令牌</button>
            </div>
            <div id="gh-status" class="entry-msg"></div>
            <hr class="side-hr">
            <p class="side-hint">选择要一并上传的 QSL 卡片图片（可多选）；数据文件 <code>data/log.adi</code> 会自动包含全部日志，图片文件名建议 <code>呼号_日期.jpg</code> 以便自动登记。</p>
            <input type="file" id="gh-images" accept="image/*" multiple>
            <div id="gh-filelist" class="local-detail"></div>
            <div class="entry-actions">
              <button class="btn btn-primary" id="btn-gh-push">⬆ 一键提交（0 个文件）</button>
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
      if (confirm('确认清除本机所有草稿？仓库数据不受影响，但未提交的修改会丢失。')) {
        Store.clearLocalChanges();
        App.refresh();
      }
    };

    // ---- GitHub 一键提交 ----
    this.fillGithubForm(el);
    el.querySelector('#btn-gh-save').onclick = () => this.saveGithubForm(el);
    el.querySelector('#btn-gh-test').onclick = () => this.testGithub(el);
    el.querySelector('#btn-gh-clear').onclick = () => {
      if (confirm('确认清除本机保存的 GitHub 令牌与设置？')) {
        GitHub.clearConfig();
        this.fillGithubForm(el);
        this.msg('gh-status', '已清除令牌与设置', 'ok');
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
      this.msg('entry-msg', '呼号、日期、波段、模式为必填项', 'error');
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
    this.msg('entry-msg', `已保存：${call} ${date} — 记录在「本机草稿」，可一键提交或导出`, 'ok');
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
    if (title) title.textContent = `编辑：${rec.CALL} ${ADIF.prettyDate(rec.QSO_DATE)}`;
  },

  resetForm() {
    if (this.editingId) {
      const title = document.getElementById('entry-title');
      if (title) title.textContent = '新增通联记录';
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
    if (!text.trim()) { this.msg('import-msg', '请先粘贴 ADIF 文本或选择文件', 'error'); return; }
    try {
      const parsed = ADIF.parse(text);
      const merge = document.getElementById('import-merge').checked;
      if (parsed.records.length === 0) { this.msg('import-msg', '未解析到任何 QSO 记录，请检查格式', 'error'); return; }
      const result = Store.importRecords(parsed.records, merge);
      this.msg('import-msg', `导入完成：新增 ${result.added} 条，更新 ${result.updated} 条，跳过重复 ${result.skipped} 条`, 'ok');
      App.refresh();
    } catch (e) {
      this.msg('import-msg', '解析失败：' + e.message, 'error');
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
      this.msg('entry-msg', 'ADIF 已复制到剪贴板', 'ok');
    } catch (e) {
      this.msg('entry-msg', '复制失败，请使用「下载」', 'error');
    }
  },

  /* ------------------------------------------------------ 草稿详情 */
  renderLocalDetail() {
    const el = document.getElementById('local-detail');
    if (!el) return;
    const c = Store.localChangeCount();
    el.innerHTML = c.added + c.updated + c.deleted === 0
      ? '<p class="side-hint">暂无未提交修改 ✓</p>'
      : `<ul>
          <li>新增 ${c.added} 条</li>
          <li>修改 ${c.updated} 条</li>
          <li>删除 ${c.deleted} 条</li>
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
    if (!cfg.owner || !cfg.repo) { this.msg('gh-status', '用户名和仓库名必填', 'error'); return; }
    if (!cfg.token) { this.msg('gh-status', '请填写 PAT 令牌', 'error'); return; }
    GitHub.saveConfig(cfg);
    this.msg('gh-status', '设置已保存到本浏览器', 'ok');
  },

  async testGithub(el) {
    try {
      this.msg('gh-status', '正在测试连接…', '');
      const info = await GitHub.test();
      this.msg('gh-status', '✅ ' + info, 'ok');
    } catch (e) {
      this.msg('gh-status', '❌ 连接失败：' + e.message, 'error');
    }
  },

  onImagesSelected(el) {
    const input = el.querySelector('#gh-images');
    const list = el.querySelector('#gh-filelist');
    const btn = el.querySelector('#btn-gh-push');
    this.pendingImages = Array.from(input.files || []);
    if (this.pendingImages.length === 0) {
      list.innerHTML = '';
      btn.textContent = '⬆ 一键提交（0 个文件）';
      return;
    }
    list.innerHTML = `<ul>${this.pendingImages.map(f =>
      `<li>🖼 ${Utils.esc(f.name)}（${(f.size / 1024).toFixed(0)} KB）</li>`).join('')}</ul>`;
    const changes = Store.localChangeCount();
    const total = this.pendingImages.length + (changes.added + changes.updated + changes.deleted > 0 ? 1 : 0);
    btn.textContent = `⬆ 一键提交（${total} 个文件）`;
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
        this.msg('gh-push-msg', '没有要提交的内容（无草稿、无图片）', 'error');
        return;
      }

      // 统计信息
      const recordsCount = Store.localChangeCount();
      const summary = [];
      summary.push(`日志更新（草稿 新增${recordsCount.added}/修改${recordsCount.updated}/删除${recordsCount.deleted}）`);
      if (images.length) summary.push(`卡片图片 ${images.length} 张`);
      if (manifestChanged) summary.push('manifest 更新');

      btn.disabled = true;
      btn.textContent = '⏳ 正在提交…';
      this.msg('gh-push-msg', '正在写入仓库（需 5-15 秒）…', '');

      const result = await GitHub.pushFiles(files, '网页一键提交：' + summary.join('、'));
      this.msg('gh-push-msg', `✅ 提交成功（${result.commitSha.slice(0, 7)}）。GitHub Actions 正在重新部署，1-2 分钟后生效。`, 'ok');
      this.pendingImages = [];
      el.querySelector('#gh-images').value = '';
      el.querySelector('#gh-filelist').innerHTML = '';
      btn.textContent = '⬆ 一键提交（0 个文件）';
      // 数据已入库，清除草稿
      Store.clearLocalChanges();
      App.refresh();
    } catch (e) {
      this.msg('gh-push-msg', '❌ 提交失败：' + e.message, 'error');
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
