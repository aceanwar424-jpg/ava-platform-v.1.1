/* OWNED_BY: ava. Public navigation only; no authentication or patient data. */
(() => {
  document.documentElement.classList.add('js-ready');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#navigation');
  const close = () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('open')) { close(); toggle.focus(); } });
  const filters = document.querySelector('.filters');
  if (filters) filters.hidden = false;
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let count = 0;
    document.querySelectorAll('[data-category]').forEach(item => {
      item.hidden = button.dataset.filter !== 'semua' && item.dataset.category !== button.dataset.filter;
      if (!item.hidden) count++;
    });
    document.querySelector('#filter-result').textContent = `${count} produk dan layanan ditampilkan.`;
  }));
  const revealBrand = () => {
    const section = document.getElementById(location.hash.slice(1));
    if (section?.classList.contains('brand-card')) section.querySelector('details').open = true;
  };
  window.addEventListener('hashchange', revealBrand);
  revealBrand();
})();
