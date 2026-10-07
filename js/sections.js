'use strict';
/* =====================================================================
   sections.js
   Hero, 01 tangga dimensi, 02 bayangan, 03 rotasi, 06 cermin, 07 galeri.
   (04 irisan ada di slicing.js, 05 jaring-jaring di unfold.js.)
   ===================================================================== */

const axc = i => Theme.c.ax[i];
const wCol = (w, P = Theme.c) => Theme.w(0.5 + w / 2, P);

/* "Tangga dimensi": n-kubus yang sedang digeser ke arah sumbu berikutnya.
   L = 0 titik, 1 garis, 2 persegi, 3 kubus, 4 tesseract; nilai pecahan = sedang digeser. */
const LADDER = (() => {
  const out = [];
  for (let k = 0; k <= 4; k++) {
    const e = [], a = [];
    for (let i = 0; i < 1 << k; i++) {
      for (let c = 0; c < k; c++) if (!((i >> c) & 1)) { e.push(i, i | (1 << c)); a.push(c); }
    }
    out.push({ e: Int32Array.from(e), a });
  }
  return out;
})();
function ladderVerts(L, P) {
  const k = L <= 1e-6 ? 0 : Math.ceil(L - 1e-6);
  const t = k ? clamp(L - (k - 1), 0, 1) : 0, n = 1 << k;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) P[i * 4 + c] = c < k ? ((i >> c) & 1 ? 0.5 : -0.5) * (c === k - 1 ? t : 1) : 0;
  }
  return { k, n };
}

/* ---------------------------------------------------------------------
   Hero: tesseract dibangun dari garis, lalu berputar (rotasi ganda XW + YZ)
   --------------------------------------------------------------------- */
function initHero() {
  const P = new Float64Array(64);
  const STEP = ['titik', 'garis', 'persegi', 'kubus', 'tesseract'];
  let L = REDUCED ? 4 : 2, building = !REDUCED, auto = !REDUCED, lastCap = '';
  const btn = $('#hero-play'), cap = $('#hero-caption'), again = $('#hero-build');
  const caption = () => {
    const k = Math.max(1, Math.min(4, Math.ceil(L - 1e-6)));
    const text = building ? 'Menggeser ' + STEP[k - 1] + ' ke arah ' + AXES[k - 1] + ' → ' + STEP[k] : 'Rotasi ganda di bidang XW dan YZ';
    if (text !== lastCap) { cap.textContent = text; lastCap = text; }
  };
  setPlay(btn, auto);
  const v = new View($('#v-hero'), {
    stage: true, bloom: true, gauge: true, allow4D: true,
    yaw: 0.62, pitch: 0.38, D: 1.8, fit: 1.42,
    label: 'Tesseract yang dibangun dari sebuah garis lalu berputar di ruang empat dimensi',
    update(dt, v) {
      if (building) {
        L = Math.min(4, L + dt * 1.1);
        if (L >= 4) building = false;
        caption();
        return true;
      }
      if (!auto || v.dragging) return false;
      v.rotate4(0, 3, dt * 0.42);
      v.rotate4(1, 2, dt * 0.16);
      return true;
    },
    draw(v) {
      const C = v.pal, { k, n } = ladderVerts(L, P), b = v.project4(P, n), E = LADDER[k];
      v.tubes(b, E.e, e => C.ax[E.a[e]], { r: 0.0135, vr: 0.03, nv: n, vcol: i => wCol(b.w[i], C), fog: 0.5 });
      v.gaugeData = { b, n, col: i => wCol(b.w[i], C) };
    },
  });
  if (REDUCED) v.rotate4(0, 3, 0.35);
  btn.addEventListener('click', () => { auto = !auto; setPlay(btn, auto); });
  again.addEventListener('click', () => {
    v.rot4 = M4.id();
    L = 0.05;
    building = true;
    caption();
    v.dirty = true;
  });
  caption();
}

/* ---------------------------------------------------------------------
   01 · Tangga dimensi: titik → garis → persegi → kubus → tesseract
   --------------------------------------------------------------------- */
function initLadder() {
  const TEXT = [
    'Sebuah titik. Ia tidak punya panjang, lebar, maupun tinggi, jadi tidak ada arah untuk bergerak.',
    'Geser titik ke arah X. Jejaknya adalah garis dengan 2 titik ujung dan 1 rusuk.',
    'Geser garis ke arah Y, yang tegak lurus X. Garis lama dan salinannya disambung di ujung-ujungnya menjadi persegi.',
    'Geser persegi ke arah Z, yang tegak lurus X dan Y. Hasilnya kubus: dua persegi yang disambung 4 rusuk biru.',
    'Geser kubus ke arah W, yang tegak lurus X, Y, dan Z sekaligus. Hasilnya tesseract: dua kubus yang disambung 8 rusuk ungu. Kubus kecil dan kubus besar di layar sebenarnya sama besar. Yang kecil hanya lebih jauh di arah W.',
  ];
  const NEXT = ['Geser ke arah X →', 'Geser ke arah Y →', 'Geser ke arah Z →', 'Geser ke arah W →', 'Sudah sampai 4D'];
  const P = new Float64Array(64);
  let L = 3, target = 3;
  const btns = $$('[data-dim]'), desc = $('#ladder-desc'), rows = $$('#ladder-table tbody tr');
  const next = $('#ladder-next'), prev = $('#ladder-prev');

  const v = new View($('#v-ladder'), {
    yaw: 0.62, pitch: 0.42, D: 1.8, fit: 1.3, allow4D: true, tag: 'Tangga dimensi',
    label: 'Bentuk yang dibangun dengan menggeser bentuk sebelumnya ke arah baru',
    update(dt, v) {
      let a = false;
      if (L !== target) {
        const st = dt * 1.1;
        L = Math.abs(target - L) <= st ? target : L + Math.sign(target - L) * st;
        a = true;
      }
      if (!REDUCED && !v.dragging && !v.vel) { v.yaw += dt * 0.12; a = true; }
      return a;
    },
    draw(v) {
      const C = Theme.c, { k, n } = ladderVerts(L, P), b = v.project4(P, n), E = LADDER[k];
      v.tubes(b, E.e, e => C.ax[E.a[e]], { r: 0.012, vr: k === 0 ? 0.05 : 0.028, nv: n, vcol: () => C.ink });
    },
  });

  function set(d) {
    target = clamp(d, 0, 4);
    pressOnly(btns, btns[target]);
    desc.textContent = TEXT[target];
    rows.forEach((r, i) => r.classList.toggle('on', i === target));
    next.textContent = NEXT[target];
    next.disabled = target === 4;
    prev.disabled = target === 0;
    v.dirty = true;
  }
  btns.forEach(b => b.addEventListener('click', () => set(+b.dataset.dim)));
  next.addEventListener('click', () => set(target + 1));
  prev.addEventListener('click', () => set(target - 1));
  set(3);
}

/* ---------------------------------------------------------------------
   02 · Bayangan: kubus di bawah lampu  ↔  tesseract di bawah "lampu 4D"
   --------------------------------------------------------------------- */
function initShadow() {
  const C3 = Shapes.cube3(0.5), T = Shapes.tesseract();
  const YC = -0.25, D = 1.8, LY = YC + D, FLOOR = -1.35, G = 1.9;
  let theta = (30 * Math.PI) / 180, playing = !REDUCED, sun = false;
  const P = new Float64Array(24), S = new Float64Array(24), RAY = new Float64Array(48);
  const LAMP = Float64Array.from([0, LY, 0]);
  const gl = [];
  for (let i = -4; i <= 4; i++) {
    const u = (i / 4) * G;
    gl.push(u, FLOOR, -G, u, FLOOR, G, -G, FLOOR, u, G, FLOOR, u);
  }
  const GRID = Float64Array.from(gl);
  const btn = $('#shadow-play'), ang = $('#shadow-angle'), angOut = $('#shadow-angle-out'), lights = $$('[data-light]');
  // Rusuk tegak (sumbu Y, arah ke lampu) diberi warna W: arah yang tak terlihat dari lantai.
  const colL = e => (C3.edgeAxis[e] === 1 ? axc(3) : axc(C3.edgeAxis[e]));

  const left = new View($('#v-shadow3'), {
    yaw: 0.75, pitch: 0.42, fit: 2.15, cam: 9, tag: 'Analogi 3D',
    label: 'Kerangka kubus disinari lampu dari atas dan bayangannya di lantai',
    draw(v, ctx) {
      const C = Theme.c, c = Math.cos(theta), s = Math.sin(theta);
      for (let i = 0; i < 8; i++) {
        const x = C3.verts[i * 3], y = C3.verts[i * 3 + 1], z = C3.verts[i * 3 + 2];
        const X = x * c - y * s, Y = x * s + y * c + YC;
        P[i * 3] = X; P[i * 3 + 1] = Y; P[i * 3 + 2] = z;
        const t = (FLOOR - LY) / (Y - LY);
        S[i * 3] = sun ? X : X * t; S[i * 3 + 1] = FLOOR; S[i * 3 + 2] = sun ? z : z * t;
        RAY[i * 6] = sun ? X : 0; RAY[i * 6 + 1] = LY; RAY[i * 6 + 2] = sun ? z : 0;
        RAY[i * 6 + 3] = S[i * 3]; RAY[i * 6 + 4] = FLOOR; RAY[i * 6 + 5] = S[i * 3 + 2];
      }
      // Lantai berpetak
      const g = v.project3(GRID, GRID.length / 3, 'g');
      ctx.lineWidth = 1;
      ctx.strokeStyle = Color.css(C.ink2, 0.22);
      ctx.beginPath();
      for (let i = 0; i < GRID.length / 3; i += 2) { ctx.moveTo(g.sx[i], g.sy[i]); ctx.lineTo(g.sx[i + 1], g.sy[i + 1]); }
      ctx.stroke();
      // Bayangan di lantai: garis lembut berwarna gelap
      const bs = v.project3(S, 8, 's'), sh = e => Color.mix(colL(e), C.ink, 0.3);
      v.edges(bs, C3.edges, sh, { width: 8, far: 1, alpha: 0.09 });
      v.edges(bs, C3.edges, sh, { width: 2.2, far: 0.8, alpha: 0.85 });
      // Sinar
      const br = v.project3(RAY, 16, 'r');
      ctx.lineWidth = 1;
      ctx.strokeStyle = Color.css(C.lamp, 0.55);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let i = 0; i < 16; i += 2) { ctx.moveTo(br.sx[i], br.sy[i]); ctx.lineTo(br.sx[i + 1], br.sy[i + 1]); }
      ctx.stroke();
      ctx.setLineDash([]);
      // Kerangka kubus
      const bp = v.project3(P, 8, 'p');
      v.tubes(bp, C3.edges, colL, { r: 0.022, vr: 0.048, nv: 8, vcol: () => C.ink });
      // Lampu
      if (!sun) {
        const bl = v.project3(LAMP, 1, 'l');
        const x = bl.sx[0], y = bl.sy[0];
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 26);
        gr.addColorStop(0, Color.css(C.lamp, 0.8));
        gr.addColorStop(1, Color.css(C.lamp, 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill();
        v.drawBall(x, y, 6.5, C.lamp, false);
      } else {
        ctx.fillStyle = Color.css(C.lamp);
        for (let i = 0; i < 16; i += 2) { ctx.beginPath(); ctx.arc(br.sx[i], br.sy[i], 2.6, 0, TAU); ctx.fill(); }
      }
    },
  });

  const right = new View($('#v-shadow4'), {
    yaw: 0.62, pitch: 0.38, fit: 1.3, D, tag: 'Tesseract',
    label: 'Bayangan tiga dimensi dari kerangka tesseract yang berputar di bidang XW',
    draw(v) {
      v.rot4 = M4.rot(0, 3, theta);
      v.D = sun ? Infinity : D;
      const b = v.project4(T.verts, T.n);
      v.tubes(b, T.edges, e => axc(T.edgeAxis[e]), { r: 0.0135, vr: 0.03, nv: T.n, vcol: i => wCol(b.w[i]) });
    },
  });

  const sync = () => {
    const deg = Math.round((theta * 180) / Math.PI) % 360;
    ang.value = deg;
    angOut.textContent = deg + '°';
  };
  Loop.task(dt => {
    if (!playing || !(left.visible || right.visible)) return;
    theta = (theta + dt * 0.45) % TAU;
    sync();
    left.dirty = right.dirty = true;
  });
  setPlay(btn, playing);
  sync();
  btn.addEventListener('click', () => { playing = !playing; setPlay(btn, playing); });
  ang.addEventListener('input', () => {
    theta = (+ang.value * Math.PI) / 180;
    angOut.textContent = ang.value + '°';
    playing = false;
    setPlay(btn, false);
    left.dirty = right.dirty = true;
  });
  lights.forEach(b => b.addEventListener('click', () => {
    sun = b.dataset.light === 'sun';
    pressOnly(lights, b);
    left.dirty = right.dirty = true;
  }));
}

/* ---------------------------------------------------------------------
   03 · Rotasi: enam bidang putar
   --------------------------------------------------------------------- */
function initRotation() {
  const T = Shapes.tesseract();
  const active = new Set(REDUCED ? [] : [3]);
  let speed = 0.6;
  const chips = $$('[data-plane]'), status = $('#rot-status');
  const sp = $('#rot-speed'), spOut = $('#rot-speed-out');

  const v = new View($('#v-rot'), {
    yaw: 0.6, pitch: 0.36, D: 1.8, fit: 1.42, allow4D: true, gizmo: true, gauge: true, tag: 'Tesseract',
    label: 'Tesseract yang diputar pada bidang-bidang pilihan',
    update(dt, v) {
      if (!active.size || v.dragging) return false;
      for (const p of active) v.rotate4(PLANES[p][0], PLANES[p][1], dt * speed);
      return true;
    },
    draw(v) {
      const b = v.project4(T.verts, T.n);
      v.tubes(b, T.edges, e => axc(T.edgeAxis[e]), { r: 0.0135, vr: 0.03, nv: T.n, vcol: i => wCol(b.w[i]) });
      v.gaugeData = { b, n: T.n, col: i => wCol(b.w[i]) };
    },
  });

  function describe() {
    const list = [...active].sort((a, b) => a - b);
    if (!list.length) return 'Tidak ada bidang yang aktif. Pilih satu bidang di atas, atau seret gambarnya.';
    if (list.length === 1) {
      const [i, j] = PLANES[list[0]];
      const rest = [0, 1, 2, 3].filter(k => k !== i && k !== j);
      const fixed = AXES[rest[0]] + AXES[rest[1]];
      return 'Rotasi sederhana di bidang <b>' + PLANE_NAMES[list[0]] + '</b>. Di 4D, rotasi sederhana membiarkan seluruh bidang <b>' + fixed + '</b> diam, bukan hanya satu sumbu. ' +
        (j === 3
          ? 'Bidangnya melibatkan W, jadi bagian dalam dan luar bayangan bertukar tempat. Perhatikan titik-titik di pengukur W bergerak naik turun.'
          : 'Bidangnya tidak melibatkan W, jadi bayangannya hanya tampak berputar biasa dan titik-titik di pengukur W diam.');
    }
    if (list.length === 2 && list[0] + list[1] === 5) {
      return 'Rotasi ganda: bidang <b>' + PLANE_NAMES[list[0]] + '</b> dan <b>' + PLANE_NAMES[list[1]] +
        '</b> saling tegak lurus dan berputar bersamaan. Dengan kecepatan yang sama, hanya titik pusat yang diam. Gerakan seperti ini mustahil di 3D.';
    }
    return '<b>' + list.length + ' bidang</b> aktif sekaligus. Hasilnya tetap satu rotasi 4D, yang selalu bisa diuraikan menjadi paling banyak dua putaran di dua bidang yang saling tegak lurus.';
  }
  function refresh() {
    chips.forEach(c => c.setAttribute('aria-pressed', String(active.has(+c.dataset.plane))));
    status.innerHTML = describe();
    v.dirty = true;
  }
  chips.forEach(c => c.addEventListener('click', () => {
    const p = +c.dataset.plane;
    if (active.has(p)) active.delete(p); else active.add(p);
    refresh();
  }));
  const PRESETS = { biasa: [1], xw: [3], ganda: [0, 5], semua: [0, 1, 2, 3, 4, 5] };
  $$('[data-rpreset]').forEach(b => b.addEventListener('click', () => {
    active.clear();
    PRESETS[b.dataset.rpreset].forEach(p => active.add(p));
    refresh();
  }));
  sp.addEventListener('input', () => {
    speed = +sp.value / 100;
    spOut.textContent = fmt(speed, 1) + ' rad/detik';
  });
  $('#rot-reset').addEventListener('click', () => v.resetView());
  refresh();
}

/* ---------------------------------------------------------------------
   06 · Cermin: rotasi 180° lewat dimensi yang lebih tinggi membalik
   kiri-kanan. Huruf F di 2D ↔ pegas (heliks) di 3D.
   --------------------------------------------------------------------- */
function initMirror() {
  const FP = [[-0.35, -0.7], [-0.1, -0.7], [-0.1, -0.05], [0.25, -0.05], [0.25, 0.2], [-0.1, 0.2], [-0.1, 0.45], [0.45, 0.45], [0.45, 0.7], [-0.35, 0.7]]
    .map(([x, y]) => [x - 0.05, y]);
  const nF = FP.length, PF = new Float64Array(nF * 3), PS = new Float64Array(nF * 3);
  const SHEET = Float64Array.from([-1.05, -0.95, 0, 1.05, -0.95, 0, 1.05, 0.95, 0, -1.05, 0.95, 0]);
  // Heliks berpilin ke kanan di sekitar sumbu Y: (r sin φ, y, r cos φ).
  const N = 180, TURNS = 2.5, HR = 0.42, H = new Float64Array(N * 4), HE = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), ph = TAU * TURNS * u;
    H[i * 4] = HR * Math.sin(ph);
    H[i * 4 + 1] = -0.78 + 1.56 * u;
    H[i * 4 + 2] = HR * Math.cos(ph);
    if (i) HE.push(i - 1, i);
  }
  const HEa = Int32Array.from(HE), AXIS = Float64Array.from([0, -0.95, 0, 0, 0, 0.95, 0, 0]);
  let theta = 0, playing = !REDUCED, dir = 1, hold = 1;
  const range = $('#mirror-angle'), out = $('#mirror-angle-out'), btn = $('#mirror-play');
  const o3 = $('#mirror-out3'), o4 = $('#mirror-out4');
  const poly = (ctx, b, n) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) i ? ctx.lineTo(b.sx[i], b.sy[i]) : ctx.moveTo(b.sx[i], b.sy[i]);
    ctx.closePath();
  };

  const left = new View($('#v-mirror3'), {
    yaw: 0.42, pitch: 0.3, fit: 1.3, cam: 7, tag: 'Analogi 3D',
    label: 'Huruf F yang diangkat dari bidang datar, dibalik melalui dimensi ketiga, lalu diletakkan kembali',
    draw(v, ctx) {
      const C = Theme.c, c = Math.cos(theta), s = Math.sin(theta);
      FP.forEach(([x, y], i) => {
        PF[i * 3] = x * c; PF[i * 3 + 1] = y; PF[i * 3 + 2] = x * s;
        PS[i * 3] = x * c; PS[i * 3 + 1] = y; PS[i * 3 + 2] = 0;
      });
      const bs = v.project3(SHEET, 4, 'sheet');
      poly(ctx, bs, 4);
      ctx.fillStyle = Color.css(C.ca, Theme.dark ? 0.12 : 0.08);
      ctx.fill();
      ctx.strokeStyle = Color.css(C.ca, 0.55);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Yang terlihat oleh makhluk datar: proyeksi huruf ke bidangnya.
      const bp = v.project3(PS, nF, 'shadow');
      poly(ctx, bp, nF);
      ctx.fillStyle = Color.css(C.ink, 0.14);
      ctx.fill();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = Color.css(C.ink, 0.45);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
      // Huruf F: sisi depan biru, sisi belakang merah muda.
      const bf = v.project3(PF, nF, 'f');
      let X = 0, Y = 0, Z = 0;
      for (let i = 0; i < nF; i++) { X += bf.X[i]; Y += bf.Y[i]; Z += bf.z[i]; }
      X /= nF; Y /= nF; Z /= nF;
      const nc = v.camDir(-s, 0, c);
      const front = -nc[0] * X - nc[1] * Y + nc[2] * (v.cam - Z) > 0;
      const col = front ? C.ca : C.cb;
      const lit = 0.55 + 0.45 * Math.abs(nc[2]);
      poly(ctx, bf, nF);
      ctx.fillStyle = Color.css(Color.mix(C.paper, col, 0.45 + 0.45 * lit), 0.94);
      ctx.fill();
      ctx.strokeStyle = Color.css(Color.mix(col, C.ink, 0.35));
      ctx.lineWidth = 2.2;
      ctx.stroke();
    },
  });

  const right = new View($('#v-mirror4'), {
    yaw: 0.42, pitch: 0.3, fit: 1.2, D: 1.8, tag: 'Pegas di 4D',
    label: 'Pegas berpilin yang diputar 180 derajat di bidang XW menjadi bayangan cerminnya',
    draw(v, ctx) {
      const C = Theme.c;
      v.rot4 = M4.rot(0, 3, theta);
      const ba = v.project4(AXIS, 2, 'axis');
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = Color.css(C.ink2, 0.45);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ba.sx[0], ba.sy[0]);
      ctx.lineTo(ba.sx[1], ba.sy[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      const b = v.project4(H, N);
      v.tubes(b, HEa, e => Color.mix(C.ca, C.cb, e / (N - 2)), {
        r: 0.02, vr: 0.045, vlist: [0, N - 1], vcol: i => (i ? C.cb : C.ca), fog: 0.38,
      });
    },
  });

  function texts() {
    const deg = (theta * 180) / Math.PI;
    let a, b;
    if (deg < 88) {
      a = 'Dunia datar melihat: <b>huruf F</b>';
      b = 'Kita melihat: <b>pegas berpilin ke kanan</b>';
    } else if (deg <= 92) {
      a = 'Dunia datar melihat: <b>sebuah garis</b> <span>· hurufnya sedang tegak lurus terhadap dunia itu</span>';
      b = 'Kita melihat: <b>pegas yang pipih</b> <span>· separuhnya sedang berada di arah W</span>';
    } else {
      a = 'Dunia datar melihat: <b>huruf F terbalik</b> <span>· bayangan cermin dari semula</span>';
      b = 'Kita melihat: <b>pegas berpilin ke kiri</b> <span>· bayangan cermin dari semula</span>';
    }
    if (o3.innerHTML !== a) o3.innerHTML = a;
    if (o4.innerHTML !== b) o4.innerHTML = b;
    range.value = Math.round(deg);
    out.textContent = Math.round(deg) + '°';
  }
  Loop.task(dt => {
    if (!playing || !(left.visible || right.visible)) return;
    if (hold > 0) { hold -= dt; return; }
    theta += dir * dt * 0.75;
    if (theta >= Math.PI) { theta = Math.PI; dir = -1; hold = 1.4; }
    else if (theta <= 0) { theta = 0; dir = 1; hold = 1.4; }
    texts();
    left.dirty = right.dirty = true;
  });
  setPlay(btn, playing);
  btn.addEventListener('click', () => { playing = !playing; setPlay(btn, playing); });
  range.addEventListener('input', () => {
    theta = (+range.value * Math.PI) / 180;
    playing = false;
    setPlay(btn, false);
    texts();
    left.dirty = right.dirty = true;
  });
  texts();
}

/* ---------------------------------------------------------------------
   07 · Galeri bentuk 4D
   --------------------------------------------------------------------- */
function initLab() {
  let p = 6, q = 6;
  const CAT = {
    tess: {
      make: () => Shapes.tesseract(), title: 'Tesseract', alt: 'Hiperkubus · 8-sel · simbol Schläfli {4,3,3}', analog: 'Kubus',
      stats: [['Titik sudut', '16'], ['Rusuk', '32'], ['Sisi', '24 persegi'], ['Sel', '8 kubus']],
      desc: 'Kubus yang digeser ke arah W. Kubus dalam, kubus luar, dan enam bentuk mirip limas terpancung di antaranya semuanya adalah kubus yang sama besar. Mereka tampak berbeda hanya karena perspektif 4D.',
      r: 0.0135, vr: 0.03, D: 1.8, fit: 1.42,
    },
    c5: {
      make: () => Shapes.cell5(), title: '5-sel', alt: 'Pentakoron · 4-simpleks · {3,3,3}', analog: 'Tetrahedron',
      stats: [['Titik sudut', '5'], ['Rusuk', '10'], ['Sisi', '10 segitiga'], ['Sel', '5 tetrahedron']],
      desc: 'Bentuk 4D yang paling sederhana. Kelima titiknya saling terhubung dan semua jaraknya sama. Di 3D paling banyak hanya 4 titik yang bisa seperti itu, yaitu tetrahedron.',
      r: 0.014, vr: 0.034, D: 1.8, fit: 1.4,
    },
    c16: {
      make: () => Shapes.cell16(), title: '16-sel', alt: 'Heksadekakoron · ortopleks · {3,3,4}', analog: 'Oktahedron',
      stats: [['Titik sudut', '8'], ['Rusuk', '24'], ['Sisi', '32 segitiga'], ['Sel', '16 tetrahedron']],
      desc: 'Pasangan (dual) tesseract: titik-titiknya terletak di pusat kedelapan sel tesseract. Setiap titik terhubung ke semua titik lain kecuali titik di seberangnya.',
      r: 0.013, vr: 0.032, D: 1.8, fit: 1.4,
    },
    c24: {
      make: () => Shapes.cell24(), title: '24-sel', alt: 'Ikositetrakoron · oktapleks · {3,4,3}', analog: 'tidak ada',
      stats: [['Titik sudut', '24'], ['Rusuk', '96'], ['Sisi', '96 segitiga'], ['Sel', '24 oktahedron']],
      desc: 'Satu-satunya bentuk beraturan yang tidak punya kembaran di dimensi lain mana pun. Bentuk ini juga dual dari dirinya sendiri: pusat-pusat selnya membentuk 24-sel lagi.',
      r: 0.0095, vr: 0.022, D: 1.8, fit: 1.48,
    },
    c120: {
      make: () => Shapes.cell120(), title: '120-sel', alt: 'Hekatonikosakoron · dodekapleks · {5,3,3}', analog: 'Dodekahedron',
      stats: [['Titik sudut', '600'], ['Rusuk', '1200'], ['Sisi', '720 segi lima'], ['Sel', '120 dodekahedron']],
      desc: 'Tersusun dari 120 dodekahedron, tiga di setiap rusuk. Ini bentuk beraturan paling rumit di 4D. Warna menunjukkan posisi W, sehingga lapisan dalam dan luarnya bisa dibedakan.',
      width: 1, dot: 1.3, far: 0.18, D: 1.8, fit: 1.4,
    },
    c600: {
      make: () => Shapes.cell600(), title: '600-sel', alt: 'Heksakosikoron · tetrapleks · {3,3,5}', analog: 'Ikosahedron',
      stats: [['Titik sudut', '120'], ['Rusuk', '720'], ['Sisi', '1200 segitiga'], ['Sel', '600 tetrahedron']],
      desc: 'Tersusun dari 600 tetrahedron, lima di setiap rusuk. Jika titik-titiknya ditulis sebagai kuaternion, perkalian dua titik selalu menghasilkan titik lain dari bentuk yang sama.',
      width: 1.2, dot: 2, far: 0.2, D: 1.8, fit: 1.4,
    },
    duo: {
      make: () => Shapes.duoprism(p, q), title: () => 'Duoprisma ' + p + '×' + q, alt: 'Hasil kali dua poligon', analog: 'Prisma',
      stats: () => [['Titik sudut', String(p * q)], ['Rusuk', String(2 * p * q)], ['Sisi', String(p * q + p + q)], ['Sel', String(p + q) + ' prisma']],
      desc: () => 'Setiap titik poligon segi-' + p + ' dipasangkan dengan setiap titik poligon segi-' + q + '. Hasilnya ' + p + ' prisma segi-' + q + ' dan ' + q + ' prisma segi-' + p + ' yang menyambung menjadi dua rantai yang saling mengunci. Rusuk biru dan merah muda mengikuti keliling masing-masing poligon.',
      r: 0.01, vr: 0.022, D: 1.8, fit: 1.4,
    },
    clifford: {
      make: () => Shapes.clifford(), title: 'Torus Clifford', alt: 'Torus datar di dalam hipersfer', analog: 'Torus (donat)',
      stats: [['Bentuk', 'Permukaan 2D'], ['Kelengkungan', 'Nol'], ['Digambar', '48 lingkaran'], ['Proyeksi', 'Stereografik']],
      desc: 'Hasil kali dua lingkaran yang sama besar. Torus di 3D selalu melengkung, sedangkan torus ini benar-benar datar, seperti kertas yang sisi-sisinya disambung tanpa ditekuk. Ia membelah hipersfer menjadi dua bagian yang sama persis.',
      width: 1.4, D: 1, fit: 2.5,
    },
    hopf: {
      make: () => Shapes.hopf(), title: 'Fibrasi Hopf', alt: 'Hipersfer yang tersusun dari lingkaran', analog: 'Bola biasa',
      stats: [['Ruang', 'Hipersfer'], ['Serat', 'Lingkaran besar'], ['Digambar', '48 lingkaran'], ['Proyeksi', 'Stereografik']],
      desc: 'Hipersfer bisa diisi penuh oleh lingkaran yang tidak saling berpotongan, tetapi setiap pasangnya bertaut seperti mata rantai. Setiap lingkaran mewakili satu titik di permukaan bola biasa, dan warna yang mirip berarti titiknya berdekatan.',
      width: 1.5, D: 1, fit: 2.9,
    },
  };

  const DEFAULT_SPEEDS = REDUCED ? [0, 0, 0, 0, 0, 0] : [0, 10, 0, 30, 0, 18];
  const speeds = DEFAULT_SPEEDS.map(x => x / 100);
  const box = $('#lab-speeds');
  const sliders = PLANES.map((pl, i) => {
    const row = document.createElement('label');
    row.className = 'speed-row' + (pl[1] === 3 ? ' w' : '');
    row.htmlFor = 'lab-sp-' + i;
    row.innerHTML = '<span>' + PLANE_NAMES[i] + '</span><input type="range" id="lab-sp-' + i + '" min="-100" max="100" step="5" value="' + DEFAULT_SPEEDS[i] +
      '" data-bipolar aria-label="Kecepatan putar bidang ' + PLANE_NAMES[i] + '"><output id="lab-sp-' + i + '-out"></output>';
    box.append(row);
    const input = row.querySelector('input'), o = row.querySelector('output');
    const show = () => { o.textContent = fmt(speeds[i], 2); };
    input.addEventListener('input', () => { speeds[i] = +input.value / 100; show(); });
    show();
    return { input, show };
  });

  const cache = {};
  let curId = 'c24', cfg = CAT[curId], shape = null;
  const Din = $('#lab-D'), Dout = $('#lab-D-out'), ortho = $('#lab-ortho'), zoom = $('#lab-zoom'), zoomOut = $('#lab-zoom-out');
  const wcolor = $('#lab-wcolor'), dots = $('#lab-dots'), chips = $$('[data-shape]');

  const v = new View($('#v-lab'), {
    yaw: 0.6, pitch: 0.35, D: 1.8, fit: 1.4, allow4D: true, gizmo: true, gauge: true, tag: 'Galeri',
    label: 'Bentuk 4D pilihan yang berputar',
    onZoom: z => { zoom.value = Math.round(z * 100); zoomOut.textContent = zoom.value + '%'; },
    update(dt, v) {
      if (v.dragging) return false;
      let any = false;
      speeds.forEach((sp, i) => { if (sp) { v.rotate4(PLANES[i][0], PLANES[i][1], dt * sp); any = true; } });
      return any;
    },
    draw(v) {
      if (!shape) return;
      const S = shape, C = Theme.c, b = v.project4(S.verts, S.n);
      const lim = v.cam - 0.25, clipF = 16;
      const bad = i => b.f[i] > clipF || b.z[i] > lim;
      const natural = !!(S.edgeAxis || S.edgeGroup || S.lines);
      const useW = wcolor.checked || !natural;
      if (S.lines) {
        const avgW = ln => { let w = 0; for (let i = 0; i < ln.count; i++) w += b.w[ln.start + i]; return w / ln.count; };
        v.lines(b, S.lines, ln => {
          if (useW) return wCol(avgW(ln) * 2.2);
          if (ln.hue !== undefined) return Color.hsl(ln.hue, 0.72, Theme.dark ? 0.64 : 0.46);
          return ln.g ? C.cb : C.ca;
        }, { width: cfg.width, bad });
        return;
      }
      let col;
      if (useW) col = (e, a, c) => wCol((b.w[a] + b.w[c]) / 2);
      else if (S.edgeAxis) col = e => C.ax[S.edgeAxis[e]];
      else col = e => (S.edgeGroup[e] ? C.cb : C.ca);
      if (cfg.r) {
        v.tubes(b, S.edges, col, {
          r: cfg.r, vr: cfg.vr, nv: dots.checked ? S.n : 0, vcol: i => wCol(b.w[i]),
          skip: (a, c) => bad(a) || bad(c), vskip: bad, min: 0.7,
        });
      } else {
        v.edges(b, S.edges, col, { width: cfg.width, far: cfg.far ?? 0.3, skip: (a, c) => bad(a) || bad(c) });
        if (dots.checked) v.dots(b, S.n, i => wCol(b.w[i]), cfg.dot ?? 3, { skip: bad });
      }
      v.gaugeData = { b, n: S.n, col: i => wCol(b.w[i]) };
    },
  });

  const val = x => (typeof x === 'function' ? x() : x);
  function showInfo() {
    $('#lab-title').textContent = val(cfg.title);
    $('#lab-alt').textContent = cfg.alt;
    $('#lab-analog').textContent = cfg.analog;
    $('#lab-desc').textContent = val(cfg.desc);
    $('#lab-stats').innerHTML = val(cfg.stats).map(([k, x]) => '<div><dt>' + k + '</dt><dd>' + x + '</dd></div>').join('');
  }
  function applyD() {
    const d = +Din.value / 100;
    v.D = ortho.checked ? Infinity : d;
    Din.disabled = ortho.checked;
    Dout.textContent = ortho.checked ? '∞ (sejajar)' : fmt(d) + (d <= 1.001 ? ' · stereografik' : '');
    v.dirty = true;
  }
  function select(id) {
    curId = id;
    cfg = CAT[id];
    shape = id === 'duo' ? cfg.make() : cache[id] || (cache[id] = cfg.make());
    v.fit = cfg.fit;
    v.cam = Math.max(6, cfg.fit * 4);
    v.rot4 = M4.id();
    Din.value = Math.round(cfg.D * 100);
    ortho.checked = false;
    applyD();
    $('#lab-pq').hidden = id !== 'duo';
    const natural = !!(shape.edgeAxis || shape.edgeGroup || shape.lines);
    wcolor.disabled = !natural;
    wcolor.checked = !natural;
    dots.disabled = !!shape.lines;
    pressOnly(chips, chips.find(c => c.dataset.shape === id));
    showInfo();
    v.dirty = true;
  }
  chips.forEach(c => c.addEventListener('click', () => select(c.dataset.shape)));
  Din.addEventListener('input', applyD);
  ortho.addEventListener('change', applyD);
  zoom.addEventListener('input', () => {
    v.zoom = +zoom.value / 100;
    zoomOut.textContent = zoom.value + '%';
    v.dirty = true;
  });
  wcolor.addEventListener('change', () => { v.dirty = true; });
  dots.addEventListener('change', () => { v.dirty = true; });
  const pIn = $('#lab-p'), qIn = $('#lab-q');
  const pq = () => {
    p = +pIn.value;
    q = +qIn.value;
    $('#lab-p-out').textContent = p;
    $('#lab-q-out').textContent = q;
    if (curId === 'duo') { shape = CAT.duo.make(); showInfo(); v.dirty = true; }
  };
  pIn.addEventListener('input', pq);
  qIn.addEventListener('input', pq);
  $('#lab-stop').addEventListener('click', () => {
    speeds.fill(0);
    sliders.forEach(s => { s.input.value = 0; s.show(); });
  });
  $('#lab-reset').addEventListener('click', () => v.resetView());
  select(curId);
}
