/* ============================================================================
 * cards.js — QSL 卡片相册页
 * 数据来源: qsl-cards/manifest.json（手动维护或脚本生成）
 * manifest 结构: { "cards": [ {"file": "BG1ABC_20240101.jpg", "call": "BG1ABC", "date": "20240101", "note": ""} ] }
 * 依赖: i18n.js, app.js
 * 注册到 App.tabs.cards
 * ==========================================================================*/
'use strict';

App.tabs.cards = function () {
  const el = document.getElementById('page-cards');
  if (!el) return;

  el.innerHTML = '<p class="empty">' + Utils.esc(I18N.t('cardsLoading')) + '</p>';

  fetch('qsl-cards/manifest.json')
    .then(res => res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status)))
    .then(data => render(data.cards || []))
    .catch(err => {
      el.innerHTML = '<p class="empty">' + Utils.esc(I18N.t('cardsLoadFail', { msg: err.message })) + '</p>';
    });

  function render(cards) {
    if (cards.length === 0) {
      el.innerHTML = `<div class="empty empty-state"><div class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-image"/></svg></div><h2 class="empty-title">${Utils.esc(I18N.t('collectionEmpty'))}</h2><p class="empty-description">${Utils.esc(I18N.t('collectionPublicHint'))}</p></div>`;
      return;
    }
    el.innerHTML = `
      <div class="cards-toolbar">
        <input type="search" id="card-search" aria-label="${Utils.esc(I18N.t('cardsSearch'))}" placeholder="${Utils.esc(I18N.t('cardsSearch'))}">
        <span class="filter-count">${Utils.esc(I18N.t('cardsCount', { n: cards.length }))}</span>
      </div>
      <div class="card-grid" id="card-grid"></div>
      <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="QSL card" tabindex="-1" hidden>
        <img id="lightbox-img" alt="QSL card">
        <div class="lightbox-caption" id="lightbox-caption"></div>
        <button class="lightbox-close" id="lightbox-close" aria-label="${Utils.esc(I18N.t('closePreview'))}">✕</button>
      </div>`;

    const grid = el.querySelector('#card-grid');
    const renderGrid = (q) => {
      const list = q
        ? cards.filter(c => (c.call || '').toLowerCase().includes(q))
        : cards;
      grid.innerHTML = list.map(c => `
        <figure class="card-fig" data-call="${Utils.esc(c.call || '')}">
          <button class="card-open" aria-label="${Utils.esc(c.call || 'QSL card')}"><img loading="lazy" src="qsl-cards/${Utils.esc(c.file)}" alt="QSL card ${Utils.esc(c.call || '')}" data-full="${Utils.esc(c.file)}" data-caption="${Utils.esc(c.call || '')} ${Utils.esc(ADIF.prettyDate(c.date) || '')} ${Utils.esc(c.note || '')}"></button>
          <figcaption>${Utils.esc(c.call || '')}${c.date ? ' · ' + Utils.esc(ADIF.prettyDate(c.date)) : ''}</figcaption>
        </figure>`).join('') || '<p class="empty">' + Utils.esc(I18N.t('cardsNoMatch')) + '</p>';
    };
    renderGrid('');

    el.querySelector('#card-search').addEventListener('input', e => renderGrid(e.target.value.trim().toLowerCase()));

    const lb = el.querySelector('#lightbox');
    let opener;
    const close = () => { lb.hidden = true; if (opener) opener.focus(); };
    grid.addEventListener('click', e => {
      const button = e.target.closest('.card-open');
      const img = button && button.querySelector('img[data-full]');
      if (!img) return;
      el.querySelector('#lightbox-img').src = 'qsl-cards/' + img.dataset.full;
      el.querySelector('#lightbox-caption').textContent = img.dataset.caption || '';
      opener = button;
      lb.hidden = false;
      el.querySelector('#lightbox-close').focus();
    });
    lb.addEventListener('click', e => {
      if (e.target === lb || e.target.closest('.lightbox-close')) close();
    });
    lb.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { e.preventDefault(); el.querySelector('#lightbox-close').focus(); }
    });
  }
};
