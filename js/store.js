/* Public, read-only data. Browser drafts never appear on the public site. */
'use strict';
const Store = (() => {
  const FIELDS = ['CALL','QSO_DATE','TIME_ON','BAND','MODE','SUBMODE','FREQ','RST_SENT','RST_RCVD','GRIDSQUARE','LAT','LON','DXCC','COUNTRY','QSL_SENT','QSL_RCVD','LOTW_QSL_RCVD','SAT_NAME','PROP_MODE'];
  let bootstrap, fallback = false;
  const publicRecord = record => Object.fromEntries(FIELDS.filter(key => record[key] != null).map(key => [key, record[key]]));
  function loadConfig() {
    return bootstrap ||= fetch('data/config.json', {cache:'no-cache', signal:AbortSignal.timeout(8_000)}).then(r => {
      if (!r.ok) throw new Error('无法读取站点配置');
      return r.json();
    });
  }
  async function loadSnapshot() {
    const local = await loadConfig();
    if (local.apiBaseUrl) {
      try {
        const url = new URL('/api/public', local.apiBaseUrl);
        const res = await fetch(url, {credentials:'omit', cache:'no-cache', signal:AbortSignal.timeout(8_000)});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.records) || !data.config) throw new Error('Invalid public snapshot');
        return {config:{...local, ...data.config, apiBaseUrl:local.apiBaseUrl}, records:data.records.map(publicRecord).sort(ADIF.newestFirst)};
      } catch (error) { fallback = true; console.warn('Live log unavailable; using repository snapshot.', error.message); }
    }
    const res = await fetch('data/log.adi', {cache:'no-cache', signal:AbortSignal.timeout(8_000)});
    if (!res.ok) throw new Error('无法读取通联日志');
    const records = ADIF.parse(await res.text()).records.map(ADIF.normalize).map(publicRecord).sort(ADIF.newestFirst);
    return {config:local, records};
  }
  return {loadConfig, loadSnapshot, isFallback: () => fallback};
})();
