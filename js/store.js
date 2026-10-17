/* Public, read-only data. Browser drafts never appear on the public site. */
'use strict';
const Store = (() => {
  const FIELDS = ['CALL','QSO_DATE','TIME_ON','BAND','MODE','SUBMODE','FREQ','RST_SENT','RST_RCVD','GRIDSQUARE','LAT','LON','DXCC','COUNTRY','QSL_SENT','QSL_RCVD','LOTW_QSL_RCVD'];
  let snapshot, bootstrap, fallback = false;
  const publicRecord = record => Object.fromEntries(FIELDS.filter(key => record[key] != null).map(key => [key, record[key]]));
  async function load() {
    if (snapshot) return snapshot;
    bootstrap = bootstrap || fetch('data/config.json', {cache:'no-cache'}).then(r => {
      if (!r.ok) throw new Error('无法读取站点配置');
      return r.json();
    });
    const local = await bootstrap;
    if (local.apiBaseUrl) {
      try {
        const url = new URL('/api/public', local.apiBaseUrl);
        const res = await fetch(url, {credentials:'omit', cache:'no-cache'});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.records) || !data.config) throw new Error('Invalid public snapshot');
        snapshot = { config: {...local, ...data.config, apiBaseUrl: local.apiBaseUrl}, records: data.records.map(publicRecord) };
        return snapshot;
      } catch (error) { fallback = true; console.warn('Live log unavailable; using repository snapshot.', error.message); }
    }
    const res = await fetch('data/log.adi', {cache:'no-cache'});
    if (!res.ok) throw new Error('无法读取通联日志');
    snapshot = { config: local, records: ADIF.parse(await res.text()).records.map(ADIF.normalize).map(publicRecord) };
    return snapshot;
  }
  async function loadConfig() { return (await load()).config; }
  async function getRecords() {
    return [...(await load()).records].sort((a,b) => (b.QSO_DATE || '').localeCompare(a.QSO_DATE || '') || (b.TIME_ON || '').localeCompare(a.TIME_ON || ''));
  }
  return { loadConfig, getRecords, isFallback: () => fallback };
})();
