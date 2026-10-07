'use strict';
/* =====================================================================
   main.js — tema, navigasi, dan inisialisasi semua bagian
   ===================================================================== */
(function () {
  const root = document.documentElement;
  const KEY = 'penjelajah-4d-tema';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) { /* penyimpanan tidak tersedia */ }

  Theme.init();

  /* Tombol tema */
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

  /* Semua bagian */
  [initHero, initLadder, initShadow, initRotation, initSlicing, initUnfold, initMirror, initLab].forEach(f => {
    try { f(); } catch (err) { console.error(f.name, err); }
  });

  /* Navigasi: tandai bagian yang sedang dibaca */
  const links = $$('.nav a');
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.removeAttribute('aria-current'));
      const a = byId.get(e.target.id);
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('main > section[id]').forEach(s => spy.observe(s));

  /* Bilah kemajuan membaca */
  const bar = $('#progress');
  let ticking = false;
  const progress = () => {
    ticking = false;
    const max = root.scrollHeight - root.clientHeight;
    bar.style.transform = 'scaleX(' + clamp(max > 0 ? root.scrollTop / max : 0, 0, 1).toFixed(4) + ')';
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(progress); }
  }, { passive: true });
  progress();

  /* Isi trek slider sesuai nilainya (slider dua arah terisi dari tengah). */
  const ranges = $$('input[type="range"]');
  const fill = r => {
    const p = ((r.value - r.min) / (r.max - r.min)) * 100;
    const a = r.hasAttribute('data-bipolar') ? Math.min(50, p) : 0;
    const b = r.hasAttribute('data-bipolar') ? Math.max(50, p) : p;
    r.style.setProperty('--a', a + '%');
    r.style.setProperty('--b', b + '%');
  };
  ranges.forEach(r => { r._v = r.value; fill(r); });
  Loop.task(() => {
    for (const r of ranges) if (r._v !== r.value) { r._v = r.value; fill(r); }
  });
})();
