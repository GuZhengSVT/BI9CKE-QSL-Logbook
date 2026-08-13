/* ============================================================================
 * cards.js — QSL 卡片相册页
 * 数据来源: qsl-cards/manifest.json（手动维护或脚本生成）
 * manifest 结构: { "cards": [ {"file": "BG1ABC_20240101.jpg", "call": "BG1ABC", "date": "20240101", "note": ""} ] }
 * 依赖: app.js
 * 注册到 App.tabs.cards
 * ==========================================================================*/
'use strict';

App.tabs.cards = function () {
  const el = document.getElementById('page-cards');
  if (!el) return;

  el.innerHTML = '<p class="empty">正在加载卡片列表…</p>';

  fetch('qsl-cards/manifest.json')
    .then(res => res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status)))
    .then(data => render(data.cards || []))
    .catch(err => {
      el.innerHTML = `<p class="empty">无法加载 qsl-cards/manifest.json（${Utils.esc(err.message)}）。<br>
        把卡片扫描图放入 <code>qsl-cards/</code> 目录，并在 manifest.json 中登记后即可在此展示。</p>`;
    });

  function render(cards) {
    if (cards.length === 0) {
      el.innerHTML = `<p class="empty">还没有 QSL 卡片图片。<br>
        将扫描图放入 <code>qsl-cards/</code>，并在 <code>qsl-cards/manifest.json</code> 登记（file / call / date 字段）。</p>`;
      return;
    }
    el.innerHTML = `
      <div class="cards-toolbar">
        <input type="search" id="card-search" placeholder="按呼号筛选…">
        <span class="filter-count">共 ${cards.length} 张</span>
      </div>
      <div class="card-grid" id="card-grid"></div>
      <div class="lightbox" id="lightbox" hidden>
        <img id="lightbox-img" alt="QSL card">
        <div class="lightbox-caption" id="lightbox-caption"></div>
        <button class="lightbox-close" id="lightbox-close">✕</button>
      </div>`;

    const grid = el.querySelector('#card-grid');
    const renderGrid = (q) => {
      const list = q
        ? cards.filter(c => (c.call || '').toLowerCase().includes(q))
        : cards;
      grid.innerHTML = list.map(c => `
        <figure class="card-fig" data-call="${Utils.esc(c.call || '')}">
          <img loading="lazy" src="qsl-cards/${Utils.esc(c.file)}" alt="QSL card ${Utils.esc(c.call || '')}" data-full="${Utils.esc(c.file)}" data-caption="${Utils.esc(c.call || '')} ${Utils.esc(ADIF.prettyDate(c.date) || '')} ${Utils.esc(c.note || '')}">
          <figcaption>${Utils.esc(c.call || '')}${c.date ? ' · ' + Utils.esc(ADIF.prettyDate(c.date)) : ''}</figcaption>
        </figure>`).join('') || '<p class="empty">无匹配卡片</p>';
    };
    renderGrid('');

    el.querySelector('#card-search').addEventListener('input', e => renderGrid(e.target.value.trim().toLowerCase()));

    const lb = el.querySelector('#lightbox');
    grid.addEventListener('click', e => {
      const img = e.target.closest('img[data-full]');
      if (!img) return;
      el.querySelector('#lightbox-img').src = 'qsl-cards/' + img.dataset.full;
      el.querySelector('#lightbox-caption').textContent = img.dataset.caption || '';
      lb.hidden = false;
    });
    lb.addEventListener('click', e => {
      if (e.target === lb || e.target.closest('.lightbox-close')) lb.hidden = true;
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !lb.hidden) lb.hidden = true;
    });
  }
};
