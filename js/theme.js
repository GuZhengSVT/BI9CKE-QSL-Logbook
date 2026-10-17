/* Shared by the public site and private console; runs before CSS to avoid a flash. */
'use strict';
const QslTheme = (() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  let choice = 'system';
  try { choice = localStorage.getItem('qsl-theme') || 'system'; } catch {}
  if (!['system','light','dark'].includes(choice)) choice = 'system';
  function apply() {
    const theme = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('[data-theme-select]').forEach(el => { el.value = choice; });
    window.dispatchEvent(new CustomEvent('qsl:themechange',{detail:{theme,choice}}));
  }
  function set(value) {
    choice = ['system','light','dark'].includes(value) ? value : 'system';
    try { localStorage.setItem('qsl-theme',choice); } catch {}
    apply();
  }
  apply();
  media.addEventListener('change',() => { if (choice === 'system') apply(); });
  window.addEventListener('storage',event => { if (event.key === 'qsl-theme') {choice=event.newValue || 'system';apply();} });
  document.addEventListener('DOMContentLoaded',() => {
    document.querySelectorAll('[data-theme-select]').forEach(el => {el.value=choice;el.addEventListener('change',()=>set(el.value));});
  });
  return {set};
})();
