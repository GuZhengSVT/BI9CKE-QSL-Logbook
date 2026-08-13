/* ============================================================================
 * store.js — 数据层
 * 数据来源（合并后供全站使用）：
 *   1. 仓库内的 data/log.adi（只读基础数据，git 版本控制 = 权威源）
 *   2. 浏览器 localStorage 中的覆盖层（本机新增 / 修改 / 删除，未提交前的草稿）
 * 合并规则：localStorage 覆盖层优先；支持删除（tombstone）。
 * 对外暴露全局对象: Store
 * ==========================================================================*/
'use strict';

const Store = (() => {
  const LS_KEY = 'qsl_log_overlay_v1';

  /* ------------------------------------------------------------- 覆盖层 */
  // overlay = { version: 1, updated: {id: rec}, added: {id: rec}, deleted: {id: true} }
  function loadOverlay() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { version: 1, updated: {}, added: {}, deleted: {} };
      const o = JSON.parse(raw);
      return {
        version: 1,
        updated: o.updated || {},
        added: o.added || {},
        deleted: o.deleted || {}
      };
    } catch (e) {
      return { version: 1, updated: {}, added: {}, deleted: {} };
    }
  }

  function saveOverlay(overlay) {
    localStorage.setItem(LS_KEY, JSON.stringify(overlay));
  }

  /* ------------------------------------------------------------ 基础数据 */
  let baseRecords = null;      // 解析后的仓库 ADIF 记录（原始）
  let config = null;

  async function loadBase() {
    if (baseRecords) return baseRecords;
    const res = await fetch('data/log.adi');
    if (!res.ok) throw new Error('无法加载 data/log.adi (HTTP ' + res.status + ')');
    const text = await res.text();
    baseRecords = ADIF.parse(text).records.map(ADIF.normalize);
    return baseRecords;
  }

  async function loadConfig() {
    if (config) return config;
    try {
      const res = await fetch('data/config.json');
      config = await res.json();
    } catch (e) {
      config = {};
    }
    return config;
  }

  /* ------------------------------------------------------------ 合并视图 */
  // 返回合并后的记录数组（已按日期倒序）
  async function getRecords() {
    const base = await loadBase();
    const overlay = loadOverlay();

    const byId = new Map();
    for (const rec of base) byId.set(ADIF.recordId(rec), rec);
    for (const [id, rec] of Object.entries(overlay.updated)) byId.set(id, rec);
    for (const [id, rec] of Object.entries(overlay.added)) byId.set(id, rec);
    for (const id of Object.keys(overlay.deleted)) byId.delete(id);

    const list = Array.from(byId.values());
    list.sort((a, b) => {
      const d = (b.QSO_DATE || '').localeCompare(a.QSO_DATE || '');
      if (d !== 0) return d;
      return (b.TIME_ON || '').localeCompare(a.TIME_ON || '');
    });
    return list;
  }

  /* ------------------------------------------------------------- 写入 */
  // 保存一条记录（新增或覆盖）。返回 {id, rec}
  function upsert(rec) {
    const norm = ADIF.normalize(rec);
    const id = ADIF.recordId(norm);
    const overlay = loadOverlay();
    const inBase = baseRecords ? baseRecords.some(r => ADIF.recordId(r) === id) : false;
    if (inBase) overlay.updated[id] = norm;
    else overlay.added[id] = norm;
    delete overlay.deleted[id];
    saveOverlay(overlay);
    return { id, rec: norm };
  }

  // 删除一条记录
  function remove(id) {
    const overlay = loadOverlay();
    delete overlay.updated[id];
    delete overlay.added[id];
    overlay.deleted[id] = true;
    saveOverlay(overlay);
  }

  // 从合并视图中移除（用于撤销删除）
  function unRemove(id) {
    const overlay = loadOverlay();
    delete overlay.deleted[id];
    saveOverlay(overlay);
  }

  /* ---------------------------------------------------------- 导入 / 导出 */
  // 批量导入 ADIF 记录（已存在的按 merge 策略合并，不存在的追加）
  function importRecords(incoming, merge = false) {
    const overlay = loadOverlay();
    const base = baseRecords || [];
    const merged = getMergedMap(base, overlay);
    let added = 0, updated = 0;
    for (const raw of incoming) {
      const rec = ADIF.normalize(raw);
      const id = ADIF.recordId(rec);
      const existing = merged.get(id);
      if (existing) {
        if (!merge) continue; // 跳过重复
        const next = ADIF.mergeFields(existing, rec);
        overlay.updated[id] = next;
        merged.set(id, next);
        updated++;
      } else {
        overlay.added[id] = rec;
        merged.set(id, rec);
        added++;
      }
    }
    saveOverlay(overlay);
    return { added, updated, skipped: incoming.length - added - updated };
  }

  function getMergedMap(base, overlay) {
    const m = new Map();
    for (const r of base) m.set(ADIF.recordId(r), r);
    for (const [id, r] of Object.entries(overlay.updated)) m.set(id, r);
    for (const [id, r] of Object.entries(overlay.added)) m.set(id, r);
    for (const id of Object.keys(overlay.deleted)) m.delete(id);
    return m;
  }

  // 导出 ADIF：合并视图完整导出（含本地草稿）；若 onlyLocal=true 只导出本地覆盖层
  function exportAdif(onlyLocal = false) {
    const overlay = loadOverlay();
    const base = baseRecords || [];
    let records;
    if (onlyLocal) {
      records = Object.values(overlay.updated).concat(Object.values(overlay.added));
    } else {
      const m = getMergedMap(base, overlay);
      records = Array.from(m.values());
      records.sort((a, b) => (a.QSO_DATE || '').localeCompare(b.QSO_DATE || ''));
    }
    const header = { ADIF_VER: '3.1.4', PROGRAMID: 'ham-qsl-log', PROGRAMVERSION: '1.0' };
    return ADIF.serialize(records, { header });
  }

  // 本地覆盖层是否有未提交内容
  function hasLocalChanges() {
    const o = loadOverlay();
    return Object.keys(o.updated).length + Object.keys(o.added).length + Object.keys(o.deleted).length > 0;
  }

  function clearLocalChanges() {
    localStorage.removeItem(LS_KEY);
  }

  // 统计本地草稿数量
  function localChangeCount() {
    const o = loadOverlay();
    return {
      added: Object.keys(o.added).length,
      updated: Object.keys(o.updated).length,
      deleted: Object.keys(o.deleted).length
    };
  }

  return {
    loadBase, loadConfig, getRecords,
    upsert, remove, unRemove,
    importRecords, exportAdif, hasLocalChanges, clearLocalChanges, localChangeCount
  };
})();
