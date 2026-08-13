/* ============================================================================
 * stats.js — 统计页（总览卡片 + ECharts 图表）
 * 骨架 DOM 只构建一次；每次切到本页仅更新数据并 resize（避免隐藏容器 0 尺寸 / 实例堆积）
 * 依赖: i18n.js, adif.js, store.js, app.js, vendor/echarts.min.js
 * 注册到 App.tabs.stats
 * ==========================================================================*/
'use strict';

App.tabs.stats = (() => {
  let initialized = false;
  const charts = {};

  function buildSkeleton() {
    const el = document.getElementById('page-stats');
    el.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-num" data-stat="total">0</div><div class="stat-label" data-i18n="statTotal"></div></div>
        <div class="stat-card"><div class="stat-num" data-stat="dxcc">0</div><div class="stat-label" data-i18n="statDxcc"></div></div>
        <div class="stat-card"><div class="stat-num" data-stat="countries">0</div><div class="stat-label" data-i18n="statCountries"></div></div>
        <div class="stat-card"><div class="stat-num" data-stat="confirmed">0</div><div class="stat-label" data-i18n="statConfirmed"></div></div>
        <div class="stat-card"><div class="stat-num" data-stat="sent">0</div><div class="stat-label" data-i18n="statSent"></div></div>
        <div class="stat-card"><div class="stat-num" data-stat="rcvd">0</div><div class="stat-label" data-i18n="statRcvd"></div></div>
      </div>
      <div class="chart-grid">
        <div class="chart-box"><h3 data-i18n="chartBand"></h3><div id="chart-band" class="chart"></div></div>
        <div class="chart-box"><h3 data-i18n="chartMode"></h3><div id="chart-mode" class="chart"></div></div>
        <div class="chart-box wide"><h3 data-i18n="chartMonth"></h3><div id="chart-month" class="chart"></div></div>
        <div class="chart-box wide"><h3 data-i18n="chartYear"></h3><div id="chart-year" class="chart"></div></div>
      </div>`;

    if (typeof echarts === 'undefined') {
      el.querySelectorAll('.chart').forEach(c => { c.innerHTML = '<p class="empty">' + I18N.t('chartLoadFail') + '</p>'; });
      return false;
    }
    const theme = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4a9eff';
    const axisColor = 'rgba(160,170,190,0.55)';
    const baseOpt = {
      textStyle: { color: '#c8d0e0' },
      grid: { left: 40, right: 16, top: 24, bottom: 28 },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,26,40,0.92)', borderColor: '#2a3550', textStyle: { color: '#e8ecf5' } }
    };
    charts.band = echarts.init(document.getElementById('chart-band'));
    charts.mode = echarts.init(document.getElementById('chart-mode'));
    charts.month = echarts.init(document.getElementById('chart-month'));
    charts.year = echarts.init(document.getElementById('chart-year'));
    charts.band.setOption({ ...baseOpt, tooltip: { ...baseOpt.tooltip, trigger: 'item' } });
    charts.mode.setOption({ ...baseOpt, tooltip: { ...baseOpt.tooltip, trigger: 'item' }, legend: { textStyle: { color: '#a8b2c8' }, bottom: 0 } });
    charts.month.setOption({ ...baseOpt });
    charts.year.setOption({ ...baseOpt });
    charts.theme = theme;
    charts.axisColor = axisColor;
    window.addEventListener('resize', () => resizeAll());
    I18N.applyStatic(); // 填充骨架内的 data-i18n 文本
    return true;
  }

  function resizeAll() {
    Object.keys(charts).forEach(k => { if (charts[k] && charts[k].resize) charts[k].resize(); });
  }

  function bandRank(b) {
    const m = String(b).match(/(\d+)([MGKm]?)/);
    if (!m) return 999;
    return parseInt(m[1], 10) || 999;
  }

  return function render() {
    const el = document.getElementById('page-stats');
    if (!el) return;
    if (!initialized) {
      initialized = buildSkeleton();
      if (!initialized) return;
    }
    const records = App.state.records;

    // ---------------------------------------------------------- 统计计算
    const total = records.length;
    const dxcc = new Set(records.map(r => r.DXCC || r.COUNTRY).filter(Boolean)).size;
    const countries = new Set(records.map(r => r.COUNTRY).filter(Boolean)).size;
    const confirmed = records.filter(r => r.QSL_RCVD === 'Y' || r.LOTW_QSL_RCVD === 'Y').length;
    const cardsSent = records.filter(r => r.QSL_SENT === 'Y').length;
    const cardsRcvd = records.filter(r => r.QSL_RCVD === 'Y').length;

    const byBand = {}, byMode = {}, byMonth = {}, byYear = {};
    for (const r of records) {
      const band = r.BAND || 'N/A';
      byBand[band] = (byBand[band] || 0) + 1;
      const mode = r.MODE || 'N/A';
      byMode[mode] = (byMode[mode] || 0) + 1;
      const year = (r.QSO_DATE || '').slice(0, 4) || 'N/A';
      byYear[year] = (byYear[year] || 0) + 1;
      if (r.QSO_DATE && r.QSO_DATE.length === 8) {
        const ym = `${r.QSO_DATE.slice(0, 4)}-${r.QSO_DATE.slice(4, 6)}`;
        byMonth[ym] = (byMonth[ym] || 0) + 1;
      }
    }
    const bandData = Object.entries(byBand).sort((a, b) => bandRank(a[0]) - bandRank(b[0]));
    const modeData = Object.entries(byMode).sort((a, b) => b[1] - a[1]);
    const monthData = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
    const yearData = Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0]));

    // ---------------------------------------------------------- 更新卡片
    const num = k => el.querySelector(`[data-stat="${k}"]`);
    num('total').textContent = total;
    num('dxcc').textContent = dxcc;
    num('countries').textContent = countries;
    num('confirmed').textContent = confirmed;
    num('sent').textContent = cardsSent;
    num('rcvd').textContent = cardsRcvd;

    // ---------------------------------------------------------- 更新图表
    const theme = charts.theme, axisColor = charts.axisColor;
    const axis = { type: 'category', axisLabel: { color: axisColor } };
    const valueAxis = { type: 'value', axisLabel: { color: axisColor }, splitLine: { lineStyle: { color: 'rgba(120,130,160,0.15)' } } };

    charts.band.setOption({
      xAxis: { ...axis, data: bandData.map(d => d[0]) },
      yAxis: valueAxis,
      series: [{ type: 'bar', data: bandData.map(d => d[1]), itemStyle: { color: theme, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 36 }]
    }, true);

    charts.mode.setOption({
      series: [{
        type: 'pie', radius: ['38%', '66%'], center: ['50%', '46%'],
        data: modeData.map(d => ({ name: d[0], value: d[1] })),
        label: { color: '#c8d0e0' },
        itemStyle: { borderColor: '#12182a', borderWidth: 2 }
      }]
    }, true);

    charts.month.setOption({
      xAxis: { ...axis, data: monthData.map(d => d[0]) },
      yAxis: valueAxis,
      series: [{
        type: 'line', smooth: true, data: monthData.map(d => d[1]),
        itemStyle: { color: theme }, lineStyle: { color: theme, width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: theme + '55' }, { offset: 1, color: theme + '00' }] } }
      }]
    }, true);

    charts.year.setOption({
      xAxis: { ...axis, data: yearData.map(d => d[0]) },
      yAxis: valueAxis,
      series: [{ type: 'bar', data: yearData.map(d => d[1]), itemStyle: { color: '#38c172', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 44 }]
    }, true);

    resizeAll();
  };
})();
