'use strict';
/* =====================================================================
   main.js — tema terang/gelap dan inisialisasi semua bagian
   ===================================================================== */
(function () {
  const root = document.documentElement;
  const KEY = 'penjelajah-4d-tema';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) { /* penyimpanan tidak tersedia */ }

  Theme.init();

  const btn = $('#theme-toggle');
  const label = () => {
    const dark = Theme.isDark();
    btn.dataset.mode = dark ? 'dark' : 'light';
    btn.setAttribute('aria-label', dark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
    btn.title = dark ? 'Tema terang' : 'Tema gelap';
  };
  btn.addEventListener('click', () => {
    const next = Theme.isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* abaikan */ }
  });
  Theme.subs.add(label);
  label();

  [initHero, initLadder, initShadow, initRotation, initSlicing, initUnfold, initLab].forEach(f => {
    try { f(); } catch (err) { console.error(f.name, err); }
  });
})();
