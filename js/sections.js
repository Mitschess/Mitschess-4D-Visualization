'use strict';
/* =====================================================================
   sections.js
   Setiap bagian halaman: hero, tangga dimensi, bayangan, rotasi,
   irisan, jaring-jaring, dan galeri.
   ===================================================================== */

const axc = i => Theme.c.ax[i];
const wCol = (w, r = 1) => Theme.w(0.5 + w / (2 * r));

/* ---------------------------------------------------------------------
   Hero: tesseract dengan rotasi ganda (XW + YZ)
   --------------------------------------------------------------------- */
function initHero() {
  const T = Shapes.tesseract();
  const btn = $('#hero-play');
  let auto = !REDUCED;
  setPlay(btn, auto);
  const v = new View($('#v-hero'), {
    yaw: 0.62, pitch: 0.4, D: 1.8, fit: 1.3, allow4D: true,
    label: 'Tesseract yang berputar perlahan di ruang empat dimensi',
    update(dt, v) {
      if (!auto || v.dragging) return false;
      v.rotate4(0, 3, dt * 0.42);
      v.rotate4(1, 2, dt * 0.16);
      return true;
    },
    draw(v) {
      const b = v.project4(T.verts, T.n);
      v.edges(b, T.edges, e => axc(T.edgeAxis[e]), { width: 2.6, glow: true });
      v.dots(b, T.n, i => wCol(b.w[i]), 3.6, { ring: true });
    },
  });
  v.rotate4(0, 3, 0.35);
  btn.addEventListener('click', () => { auto = !auto; setPlay(btn, auto); });
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
  const E = [];
  for (let k = 0; k <= 4; k++) {
    const e = [], a = [];
    for (let i = 0; i < 1 << k; i++) {
      for (let c = 0; c < k; c++) if (!((i >> c) & 1)) { e.push(i, i | (1 << c)); a.push(c); }
    }
    E.push({ e: Int32Array.from(e), a });
  }
  const P = new Float64Array(16 * 4);
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
      if (!REDUCED && !v.dragging) { v.yaw += dt * 0.12; a = true; }
      return a;
    },
    draw(v) {
      const k = L <= 1e-6 ? 0 : Math.ceil(L - 1e-6);
      const t = k ? clamp(L - (k - 1), 0, 1) : 0, n = 1 << k;
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < 4; c++) {
          P[i * 4 + c] = c < k ? ((i >> c) & 1 ? 0.5 : -0.5) * (c === k - 1 ? t : 1) : 0;
        }
      }
      const b = v.project4(P, n);
      v.edges(b, E[k].e, e => axc(E[k].a[e]), { width: 2.8, glow: true });
      v.dots(b, n, () => Theme.c.ink, k === 0 ? 6 : 4, { ring: true });
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
      // Bayangan di lantai
      const bs = v.project3(S, 8, 's');
      v.edges(bs, C3.edges, colL, { width: 2, far: 0.7, alpha: 0.8 });
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
      v.edges(bp, C3.edges, colL, { width: 2.8, glow: true });
      v.dots(bp, 8, () => C.ink, 3, { ring: true });
      // Lampu
      if (!sun) {
        const bl = v.project3(LAMP, 1, 'l');
        const x = bl.sx[0], y = bl.sy[0];
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 22);
        gr.addColorStop(0, Color.css(C.lamp, 0.75));
        gr.addColorStop(1, Color.css(C.lamp, 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill();
        ctx.fillStyle = Color.css(C.lamp, 1);
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = Color.css(C.lamp, 1);
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
      v.edges(b, T.edges, e => axc(T.edgeAxis[e]), { width: 2.6, glow: true });
      v.dots(b, T.n, i => wCol(b.w[i]), 3.4, { ring: true });
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
    yaw: 0.6, pitch: 0.36, D: 1.8, fit: 1.3, allow4D: true, tag: 'Tesseract',
    label: 'Tesseract yang diputar pada bidang-bidang pilihan',
    update(dt, v) {
      if (!active.size || v.dragging) return false;
      for (const p of active) v.rotate4(PLANES[p][0], PLANES[p][1], dt * speed);
      return true;
    },
    draw(v) {
      const b = v.project4(T.verts, T.n);
      v.edges(b, T.edges, e => axc(T.edgeAxis[e]), { width: 2.6, glow: true });
      v.dots(b, T.n, i => wCol(b.w[i]), 3.6, { ring: true });
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
          ? 'Bidangnya melibatkan W, jadi bagian dalam dan luar bayangan bertukar tempat.'
          : 'Bidangnya tidak melibatkan W, jadi bayangannya hanya tampak berputar biasa.');
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
   04 · Irisan: benda melewati dunia satu dimensi lebih rendah
   --------------------------------------------------------------------- */
function initSlicing() {
  const SQ = Math.SQRT1_2, R3 = 1 / Math.sqrt(3);
  const tess = Shapes.tesseract();
  tess.facets = Shapes.facets(tess, [[1, 0, 0, 0], [-1, 0, 0, 0], [0, 1, 0, 0], [0, -1, 0, 0], [0, 0, 1, 0], [0, 0, -1, 0], [0, 0, 0, 1], [0, 0, 0, -1]]);
  tess.facets.forEach(f => { f.axis = f.n.findIndex(x => Math.abs(x) > 0.5); });
  const c16 = Shapes.cell16();
  c16.facets = Shapes.facets(c16, Shapes.expand([1, 1, 1, 1]));
  const c5 = Shapes.cell5();
  const v5 = i => Array.from(c5.verts.subarray(i * 4, i * 4 + 4));
  c5.facets = Shapes.facets(c5, [0, 1, 2, 3, 4].map(i => v5(i).map(x => -x)));
  const cube = Shapes.cube3(R3), oct = Shapes.octa3(), tet = Shapes.tetra3();
  const t3 = i => Array.from(tet.verts.subarray(i * 3, i * 3 + 3));
  const neg = a => a.map(x => -x);
  const sum = (a, b) => a.map((x, i) => x + b[i]);

  // n4/n3 = arah di benda yang diputar menjadi "atas" (W untuk 4D, Y untuk 3D).
  // Benda bergerak turun, jadi bagian di arah -n menyentuh dunia lebih dulu.
  const OBJ = {
    sphere: { sphere: true, presets: [{ label: 'Lurus', n4: [0, 0, 0, 1], n3: [0, 1, 0] }] },
    tess: {
      s4: tess, s3: cube, def: 2, presets: [
        { label: 'Datar', n4: [0, 0, 0, 1], n3: [0, 1, 0] },
        { label: 'Miring', n4: [0, 0, SQ, SQ], n3: [0, SQ, SQ] },
        { label: 'Pojok dulu', n4: [0.5, 0.5, 0.5, 0.5], n3: [R3, R3, R3] },
      ],
    },
    c16: {
      s4: c16, s3: oct, def: 0, presets: [
        { label: 'Pojok dulu', n4: [0, 0, 0, 1], n3: [0, 1, 0] },
        { label: 'Datar', n4: [0.5, 0.5, 0.5, 0.5], n3: [R3, R3, R3] },
      ],
    },
    c5: {
      s4: c5, s3: tet, def: 0, presets: [
        { label: 'Pojok dulu', n4: neg(v5(4)), n3: neg(t3(0)) },
        { label: 'Rusuk dulu', n4: neg(unit(sum(v5(0), v5(1)))), n3: neg(unit(sum(t3(0), t3(1)))) },
      ],
    },
  };
  const NAME3 = { sphere: 'Bola', tess: 'Kubus', c16: 'Oktahedron', c5: 'Tetrahedron' };
  const NAME4 = { sphere: 'Hipersfer', tess: 'Tesseract', c16: '16-sel', c5: '5-sel' };

  let obj = 'tess', pi = 2, s = 0, dir = 1, playing = !REDUCED, spinning = false, need = true, cur = null;
  let spin4 = M4.id(), spin3 = M4.id(), spinCount = 0;
  const W4 = new Float64Array(16 * 4), W3 = new Float64Array(8 * 3);

  function section3(S, W) {
    const E = S.edges, map = new Set(), pts = [], eps = 1e-9;
    const add = (x, z) => {
      const k = Math.round(x * 1e5) + ',' + Math.round(z * 1e5);
      if (!map.has(k)) { map.add(k); pts.push([x, z]); }
    };
    for (let e = 0; e < E.length; e += 2) {
      const a = E[e] * 3, b = E[e + 1] * 3, ya = W[a + 1], yb = W[b + 1];
      if ((ya > eps && yb > eps) || (ya < -eps && yb < -eps)) continue;
      const za = Math.abs(ya) <= eps, zb = Math.abs(yb) <= eps;
      if (za) add(W[a], W[a + 2]);
      if (zb) add(W[b], W[b + 2]);
      if (!za && !zb) {
        const t = ya / (ya - yb);
        add(lerp(W[a], W[b], t), lerp(W[a + 2], W[b + 2], t));
      }
    }
    if (pts.length > 2) {
      let cx = 0, cz = 0;
      pts.forEach(p => { cx += p[0]; cz += p[1]; });
      cx /= pts.length; cz /= pts.length;
      pts.sort((p, q) => Math.atan2(p[1] - cz, p[0] - cx) - Math.atan2(q[1] - cz, q[0] - cx));
    }
    return pts;
  }

  function sortRing(ids, P, N) {
    let cx = 0, cy = 0, cz = 0;
    for (const i of ids) { cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2]; }
    cx /= ids.length; cy /= ids.length; cz /= ids.length;
    let u = null;
    for (const i of ids) {
      const d = [P[i * 3] - cx, P[i * 3 + 1] - cy, P[i * 3 + 2] - cz], l = Math.hypot(...d);
      if (l > 1e-9) { u = d.map(x => x / l); break; }
    }
    if (!u) return ids;
    const w = [N[1] * u[2] - N[2] * u[1], N[2] * u[0] - N[0] * u[2], N[0] * u[1] - N[1] * u[0]];
    const ang = i => {
      const d = [P[i * 3] - cx, P[i * 3 + 1] - cy, P[i * 3 + 2] - cz];
      return Math.atan2(d[0] * w[0] + d[1] * w[1] + d[2] * w[2], d[0] * u[0] + d[1] * u[1] + d[2] * u[2]);
    };
    return ids.map(i => [ang(i), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }

  /* Irisan 4D: setiap sel (sisi 3D) politop dipotong oleh ruang w = 0 menjadi
     satu poligon. Kumpulan poligon itu membentuk polihedron irisan. */
  function section4(S, W, T) {
    const map = new Map(), pts = [], E = S.edges, eps = 1e-9, faces = [];
    const add = (x, y, z) => {
      const k = Math.round(x * 1e5) + ',' + Math.round(y * 1e5) + ',' + Math.round(z * 1e5);
      let j = map.get(k);
      if (j === undefined) { j = pts.length / 3; pts.push(x, y, z); map.set(k, j); }
      return j;
    };
    S.facets.forEach((F, fi) => {
      if (F.verts.every(i => Math.abs(W[i * 4 + 3]) <= eps)) return;
      const set = new Set();
      for (const e of F.edges) {
        const a = E[2 * e] * 4, b = E[2 * e + 1] * 4, da = W[a + 3], db = W[b + 3];
        const za = Math.abs(da) <= eps, zb = Math.abs(db) <= eps;
        if (za) set.add(add(W[a], W[a + 1], W[a + 2]));
        if (zb) set.add(add(W[b], W[b + 1], W[b + 2]));
        if (!za && !zb && (da < 0) !== (db < 0)) {
          const t = da / (da - db);
          set.add(add(lerp(W[a], W[b], t), lerp(W[a + 1], W[b + 1], t), lerp(W[a + 2], W[b + 2], t)));
        }
      }
      if (set.size < 3) return;
      const Nn = M4.apply(T, F.n), l = Math.hypot(Nn[0], Nn[1], Nn[2]);
      if (l < 1e-6) return;
      const N = [Nn[0] / l, Nn[1] / l, Nn[2] / l];
      faces.push({ idx: sortRing([...set], pts, N), N, fi });
    });
    return { pts: Float64Array.from(pts), faces };
  }

  function compute() {
    const O = OBJ[obj], pr = O.presets[pi], u = (s + 1) / 2;
    if (O.sphere) {
      const h = lerp(-1.08, 1.08, u);
      cur = { sphere: true, h, r: Math.sqrt(Math.max(0, 1 - h * h)) };
      return;
    }
    const S4 = O.s4, T4 = M4.mul(spin4, M4.alignTo(pr.n4, 3));
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < S4.n; i++) {
      const q = M4.apply(T4, [S4.verts[i * 4], S4.verts[i * 4 + 1], S4.verts[i * 4 + 2], S4.verts[i * 4 + 3]]);
      W4.set(q, i * 4);
      lo = Math.min(lo, q[3]); hi = Math.max(hi, q[3]);
    }
    const m4 = (hi - lo) * 0.05, h4 = lerp(lo - m4, hi + m4, u);
    for (let i = 0; i < S4.n; i++) W4[i * 4 + 3] -= h4;
    const sec4 = section4(S4, W4, T4);

    const S3 = O.s3, T3 = M4.mul(spin3, M4.alignTo([...pr.n3, 0], 1));
    lo = Infinity; hi = -Infinity;
    for (let i = 0; i < S3.n; i++) {
      const q = M4.apply(T3, [S3.verts[i * 3], S3.verts[i * 3 + 1], S3.verts[i * 3 + 2], 0]);
      W3[i * 3] = q[0]; W3[i * 3 + 1] = q[1]; W3[i * 3 + 2] = q[2];
      lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]);
    }
    const m3 = (hi - lo) * 0.05, h3 = lerp(lo - m3, hi + m3, u);
    for (let i = 0; i < S3.n; i++) W3[i * 3 + 1] -= h3;
    cur = { sphere: false, S3, sec3: section3(S3, W3), sec4 };
  }

  /* ---- Nama bentuk irisan ---- */
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  function polygonName(p) {
    const n = p.length;
    if (!n) return null;
    if (n === 1) return 'sebuah titik';
    if (n === 2) return 'sebuah garis';
    const sides = p.map((q, i) => Math.sqrt(dist2(q, p[(i + 1) % n])));
    const eq = Math.max(...sides) / Math.min(...sides) < 1.02;
    if (n === 3) return eq ? 'segitiga sama sisi' : 'segitiga';
    if (n === 4) {
      const d0 = Math.sqrt(dist2(p[0], p[2])), d1 = Math.sqrt(dist2(p[1], p[3]));
      const diagEq = Math.abs(d0 - d1) / Math.max(d0, d1) < 0.02;
      if (diagEq && eq) return 'persegi';
      if (diagEq && Math.abs(sides[0] - sides[2]) < 0.02 * sides[0]) return 'persegi panjang';
      return 'segi empat';
    }
    if (n === 5) return 'segi lima';
    if (n === 6) return eq ? 'segi enam beraturan' : 'segi enam';
    return 'segi-' + n;
  }
  function rightAngles(sec) {
    const P = sec.pts;
    return sec.faces.every(f => f.idx.every((i, k) => {
      const a = f.idx[(k + f.idx.length - 1) % f.idx.length], c = f.idx[(k + 1) % f.idx.length];
      let d = 0, la = 0, lc = 0;
      for (let j = 0; j < 3; j++) {
        const u = P[a * 3 + j] - P[i * 3 + j], w = P[c * 3 + j] - P[i * 3 + j];
        d += u * w; la += u * u; lc += w * w;
      }
      return Math.abs(d) / Math.sqrt(la * lc) < 0.03;
    }));
  }
  function equalEdges(sec) {
    const P = sec.pts, L = [];
    sec.faces.forEach(f => f.idx.forEach((i, k) => {
      const j = f.idx[(k + 1) % f.idx.length];
      L.push(Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]));
    }));
    return Math.max(...L) / Math.min(...L) < 1.02;
  }
  function solidName(sec) {
    const nv = sec.pts.length / 3, F = sec.faces.length;
    if (!nv) return null;
    if (!F) return nv === 1 ? 'sebuah titik' : nv === 2 ? 'sebuah garis' : 'bidang datar';
    const h = {};
    sec.faces.forEach(f => { h[f.idx.length] = (h[f.idx.length] || 0) + 1; });
    const t = h[3] || 0, q = h[4] || 0, p = h[5] || 0, x = h[6] || 0;
    if (F === 4 && t === 4) return equalEdges(sec) ? 'tetrahedron beraturan' : 'tetrahedron';
    if (F === 6 && q === 6) return rightAngles(sec) ? (equalEdges(sec) ? 'kubus' : 'balok') : 'heksahedron (6 sisi)';
    if (F === 8 && t === 8) return equalEdges(sec) ? 'oktahedron beraturan' : 'oktahedron';
    if (F === 5 && t === 2 && q === 3) return 'prisma segitiga';
    if (F === 5 && t === 4 && q === 1) return 'limas segi empat';
    if (F === 7 && p === 2 && q === 5) return 'prisma segi lima';
    if (F === 8 && x === 2 && q === 6) return 'prisma segi enam';
    if (F === 8 && t === 4 && x === 4) return 'tetrahedron terpancung';
    if (F === 14 && t === 8 && q === 6) return 'kuboktahedron';
    return 'polihedron dengan ' + F + ' sisi';
  }

  /* ---- Geometri bantu untuk panel kiri ---- */
  const PL = 1.45;
  const PLANE = Float64Array.from([-PL, 0, -PL, PL, 0, -PL, PL, 0, PL, -PL, 0, PL]);
  const pg = [];
  for (let i = -5; i <= 5; i++) { const u = (i / 5) * PL; pg.push(u, 0, -PL, u, 0, PL, -PL, 0, u, PL, 0, u); }
  const PGRID = Float64Array.from(pg);
  const sph = [];
  const ring = fn => { for (let i = 0; i < 48; i++) sph.push(...fn((TAU * i) / 48), ...fn((TAU * (i + 1)) / 48)); };
  for (const lat of [-60, -30, 0, 30, 60]) {
    const r = Math.cos((lat * Math.PI) / 180), y = Math.sin((lat * Math.PI) / 180);
    ring(t => [r * Math.cos(t), y, r * Math.sin(t)]);
  }
  for (let k = 0; k < 6; k++) {
    const ph = (k * Math.PI) / 6;
    ring(t => [Math.cos(t) * Math.cos(ph), Math.sin(t), Math.cos(t) * Math.sin(ph)]);
  }
  const SPH = Float64Array.from(sph);
  const LIGHT = unit([-0.45, 0.6, 0.66]);
  const emptyText = () => (s < 0 ? 'Belum menyentuh ruang kita' : 'Sudah melewati ruang kita');

  const left = new View($('#v-slice3'), {
    yaw: 0.6, pitch: 0.5, fit: 1.75, cam: 8, tag: 'Dunia 2D',
    label: 'Benda tiga dimensi yang menembus sebuah bidang datar',
    draw(v, ctx) {
      if (!cur) return;
      const C = Theme.c, lo = [], hi = [];
      const seg = (ax, ay, az, bx, by, bz) => {
        if (ay >= 0 && by >= 0) hi.push(ax, ay, az, bx, by, bz);
        else if (ay <= 0 && by <= 0) lo.push(ax, ay, az, bx, by, bz);
        else {
          const t = ay / (ay - by), mx = lerp(ax, bx, t), mz = lerp(az, bz, t);
          (ay > 0 ? hi : lo).push(ax, ay, az, mx, 0, mz);
          (by > 0 ? hi : lo).push(mx, 0, mz, bx, by, bz);
        }
      };
      if (cur.sphere) {
        const dy = -cur.h;
        for (let i = 0; i < SPH.length; i += 6) seg(SPH[i], SPH[i + 1] + dy, SPH[i + 2], SPH[i + 3], SPH[i + 4] + dy, SPH[i + 5]);
      } else {
        const E = cur.S3.edges;
        for (let e = 0; e < E.length; e += 2) {
          const a = E[e] * 3, b = E[e + 1] * 3;
          seg(W3[a], W3[a + 1], W3[a + 2], W3[b], W3[b + 1], W3[b + 2]);
        }
      }
      const strokeSegs = (arr, alpha, width, dash) => {
        if (!arr.length) return;
        const n = arr.length / 3, b = v.project3(Float64Array.from(arr), n, 'seg');
        ctx.setLineDash(dash || []);
        ctx.strokeStyle = Color.css(C.ink, alpha);
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 0; i < n; i += 2) { ctx.moveTo(b.sx[i], b.sy[i]); ctx.lineTo(b.sx[i + 1], b.sy[i + 1]); }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const above = v.pitch >= 0;
      strokeSegs(above ? lo : hi, 0.38, 1.2, [4, 4]);
      // Bidang datar (dunia 2D)
      const bp = v.project3(PLANE, 4, 'pl');
      ctx.beginPath();
      for (let i = 0; i < 4; i++) i ? ctx.lineTo(bp.sx[i], bp.sy[i]) : ctx.moveTo(bp.sx[i], bp.sy[i]);
      ctx.closePath();
      ctx.fillStyle = Color.css(C.ca, Theme.dark ? 0.13 : 0.1);
      ctx.fill();
      ctx.strokeStyle = Color.css(C.ca, 0.6);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const bg = v.project3(PGRID, PGRID.length / 3, 'pg');
      ctx.strokeStyle = Color.css(C.ca, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < PGRID.length / 3; i += 2) { ctx.moveTo(bg.sx[i], bg.sy[i]); ctx.lineTo(bg.sx[i + 1], bg.sy[i + 1]); }
      ctx.stroke();
      // Irisan
      let poly = [];
      if (cur.sphere) {
        if (cur.r > 1e-3) for (let i = 0; i < 64; i++) poly.push([cur.r * Math.cos((TAU * i) / 64), cur.r * Math.sin((TAU * i) / 64)]);
      } else poly = cur.sec3;
      if (poly.length) {
        const PP = new Float64Array(poly.length * 3);
        poly.forEach((p, i) => { PP[i * 3] = p[0]; PP[i * 3 + 2] = p[1]; });
        const b = v.project3(PP, poly.length, 'poly');
        ctx.beginPath();
        for (let i = 0; i < poly.length; i++) i ? ctx.lineTo(b.sx[i], b.sy[i]) : ctx.moveTo(b.sx[i], b.sy[i]);
        if (poly.length > 2) {
          ctx.closePath();
          ctx.fillStyle = Color.css(C.accent, 0.5);
          ctx.fill();
        }
        ctx.strokeStyle = Color.css(C.accent, 1);
        ctx.lineWidth = 2.6;
        ctx.stroke();
        if (poly.length === 1) {
          ctx.fillStyle = Color.css(C.accent, 1);
          ctx.beginPath(); ctx.arc(b.sx[0], b.sy[0], 4, 0, TAU); ctx.fill();
        }
      }
      strokeSegs(above ? hi : lo, cur.sphere ? 0.55 : 0.95, cur.sphere ? 1.1 : 2.2);
    },
  });

  const facetCol = fi => (obj === 'tess'
    ? Theme.c.ax[tess.facets[fi].axis]
    : Color.hsl(fi * 137.508, 0.58, Theme.dark ? 0.64 : 0.5));

  const right = new View($('#v-slice4'), {
    yaw: 0.6, pitch: 0.42, fit: 1.25, tag: 'Ruang kita (3D)',
    label: 'Irisan tiga dimensi dari benda empat dimensi',
    draw(v, ctx) {
      if (!cur) return;
      const C = Theme.c;
      if (cur.sphere) {
        if (cur.r <= 1e-3) { v.message(emptyText()); return; }
        const r = cur.r, pr = (r * v.s * v.cam) / Math.sqrt(v.cam * v.cam - r * r);
        const g = ctx.createRadialGradient(v.cx - pr * 0.35, v.cy - pr * 0.4, pr * 0.05, v.cx, v.cy, pr);
        g.addColorStop(0, Color.css(Color.mix(C.paper, C.accent, 0.22), 1));
        g.addColorStop(1, Color.css(Color.mix(C.paper, C.accent, 0.92), 1));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(v.cx, v.cy, pr, 0, TAU); ctx.fill();
        const R = new Float64Array(64 * 3 * 2);
        for (let i = 0; i < 64; i++) {
          const t = (TAU * i) / 64;
          R.set([r * Math.cos(t), 0, r * Math.sin(t)], i * 3);
          R.set([r * Math.cos(t), r * Math.sin(t), 0], 192 + i * 3);
        }
        const b = v.project3(R, 128, 'eq');
        ctx.strokeStyle = Color.css(C.paper, 0.6);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k < 2; k++) {
          for (let i = 0; i < 64; i++) {
            const a = k * 64 + i, c = k * 64 + ((i + 1) % 64);
            if (b.z[a] < 0 || b.z[c] < 0) continue;
            ctx.moveTo(b.sx[a], b.sy[a]);
            ctx.lineTo(b.sx[c], b.sy[c]);
          }
        }
        ctx.stroke();
        return;
      }
      const { pts, faces } = cur.sec4, n = pts.length / 3;
      if (!n) { v.message(emptyText()); return; }
      const b = v.project3(pts, n, 'q');
      if (!faces.length) {
        ctx.strokeStyle = ctx.fillStyle = Color.css(C.accent, 1);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i < n; i++) i ? ctx.lineTo(b.sx[i], b.sy[i]) : ctx.moveTo(b.sx[i], b.sy[i]);
        ctx.stroke();
        for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(b.sx[i], b.sy[i], 3.5, 0, TAU); ctx.fill(); }
        return;
      }
      const items = faces.map(f => {
        let X = 0, Y = 0, Z = 0;
        for (const i of f.idx) { X += b.X[i]; Y += b.Y[i]; Z += b.z[i]; }
        const k = f.idx.length;
        X /= k; Y /= k; Z /= k;
        const nc = v.camDir(f.N[0], f.N[1], f.N[2]);
        const front = -nc[0] * X - nc[1] * Y + nc[2] * (v.cam - Z) > 0;
        const lam = Math.max(0, nc[0] * LIGHT[0] + nc[1] * LIGHT[1] + nc[2] * LIGHT[2]);
        return { idx: f.idx, front, lam, col: facetCol(f.fi) };
      });
      const path = idx => {
        ctx.beginPath();
        idx.forEach((i, k) => (k ? ctx.lineTo(b.sx[i], b.sy[i]) : ctx.moveTo(b.sx[i], b.sy[i])));
        ctx.closePath();
      };
      for (const it of items) if (!it.front) { path(it.idx); ctx.fillStyle = Color.css(it.col, 0.1); ctx.fill(); }
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = Color.css(C.ink2, 0.6);
      for (const it of items) if (!it.front) { path(it.idx); ctx.stroke(); }
      ctx.setLineDash([]);
      for (const it of items) {
        if (!it.front) continue;
        path(it.idx);
        ctx.fillStyle = Color.css(Color.mix(C.paper, it.col, 0.35 + 0.5 * it.lam), 0.84);
        ctx.fill();
      }
      ctx.lineWidth = 2;
      for (const it of items) {
        if (!it.front) continue;
        path(it.idx);
        ctx.strokeStyle = Color.css(Color.mix(it.col, C.ink, 0.3), 1);
        ctx.stroke();
      }
    },
  });

  /* ---- Kontrol ---- */
  const out3 = $('#slice-out3'), out4 = $('#slice-out4'), pos = $('#slice-pos'), posOut = $('#slice-pos-out');
  const playBtn = $('#slice-play'), spinBtn = $('#slice-spin'), presetBox = $('#slice-presets'), objBtns = $$('[data-obj]');
  let last3 = '', last4 = '';
  function names() {
    let a, b;
    if (cur.sphere) {
      a = cur.r > 1e-3 ? 'Makhluk 2D melihat: <b>lingkaran</b>, jari-jari ' + fmt(cur.r) : 'Makhluk 2D melihat: <b>tidak ada apa-apa</b>';
      b = cur.r > 1e-3 ? 'Kita melihat: <b>bola</b>, jari-jari ' + fmt(cur.r) : 'Kita melihat: <b>tidak ada apa-apa</b>';
    } else {
      const p = polygonName(cur.sec3), q = solidName(cur.sec4);
      a = 'Makhluk 2D melihat: <b>' + (p || 'tidak ada apa-apa') + '</b>';
      b = 'Kita melihat: <b>' + (q || 'tidak ada apa-apa') + '</b>';
    }
    a += ' <span>· ' + NAME3[obj].toLowerCase() + ' menembus bidang</span>';
    b += ' <span>· ' + NAME4[obj].toLowerCase() + ' menembus ruang 3D</span>';
    if (a !== last3) { out3.innerHTML = a; last3 = a; }
    if (b !== last4) { out4.innerHTML = b; last4 = b; }
    posOut.textContent = Math.round(u100()) + '% terlewati';
  }
  const u100 = () => (s + 1) * 50;
  function buildPresets() {
    presetBox.innerHTML = '';
    OBJ[obj].presets.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = p.label;
      b.setAttribute('aria-pressed', String(i === pi));
      b.disabled = OBJ[obj].sphere;
      b.addEventListener('click', () => {
        pi = i;
        spin4 = M4.id(); spin3 = M4.id();
        buildPresets();
        need = true;
      });
      presetBox.append(b);
    });
  }
  objBtns.forEach(btn => btn.addEventListener('click', () => {
    obj = btn.dataset.obj;
    pi = OBJ[obj].def || 0;
    spin4 = M4.id(); spin3 = M4.id();
    pressOnly(objBtns, btn);
    spinBtn.disabled = !!OBJ[obj].sphere;
    buildPresets();
    need = true;
  }));
  playBtn.addEventListener('click', () => { playing = !playing; setPlay(playBtn, playing); });
  spinBtn.addEventListener('click', () => {
    spinning = !spinning;
    spinBtn.setAttribute('aria-pressed', String(spinning));
  });
  pos.addEventListener('input', () => {
    s = +pos.value / 100;
    playing = false;
    setPlay(playBtn, false);
    need = true;
  });
  setPlay(playBtn, playing);
  buildPresets();

  Loop.task(dt => {
    if (!(left.visible || right.visible)) return;
    if (playing) {
      s += dir * dt * 0.3;
      if (s >= 1) { s = 1; dir = -1; } else if (s <= -1) { s = -1; dir = 1; }
      pos.value = Math.round(s * 100);
      need = true;
    }
    if (spinning && !OBJ[obj].sphere) {
      spin4 = M4.mul(M4.rot(0, 3, dt * 0.31), spin4);
      spin4 = M4.mul(M4.rot(1, 3, dt * 0.23), spin4);
      spin4 = M4.mul(M4.rot(2, 3, dt * 0.17), spin4);
      spin3 = M4.mul(M4.rot(0, 1, dt * 0.31), spin3);
      spin3 = M4.mul(M4.rot(2, 1, dt * 0.23), spin3);
      if (++spinCount % 60 === 0) { M4.orthonormalize(spin4); M4.orthonormalize(spin3); }
      need = true;
    }
    if (need) {
      need = false;
      compute();
      names();
      left.dirty = right.dirty = true;
    }
  });
}

/* ---------------------------------------------------------------------
   05 · Jaring-jaring: kubus → salib 6 persegi, tesseract → salib 8 kubus
   --------------------------------------------------------------------- */
function initUnfold() {
  const COL = 1; // Sumbu Y: arah "batang" salib.
  /* Titik p milik sisi (a, s). Sisi dasar (up, −1) diam; sisi samping berputar
     90° di bidang (a, up) mengelilingi rusuk/sisi yang menempel ke dasar.
     Sisi seberang (up, +1) menempel ke sisi (COL, −1): ia berputar dulu
     terhadap sisi itu, lalu ikut berputar bersamanya. */
  function unfoldPt(p, a, s, up, th1, th2) {
    const q = p.slice();
    if (a === up && s === -1) return q;
    if (a === up && s === 1) {
      const dc = q[COL] + 1, du = q[up] - 1, c = Math.cos(th2), sn = Math.sin(th2);
      q[COL] = -1 + dc * c - du * sn;
      q[up] = 1 + dc * sn + du * c;
      a = COL;
      s = -1;
    }
    const da = q[a] - s, du = q[up] + 1, c = Math.cos(th1), sn = Math.sin(th1);
    q[a] = s + da * c + s * du * sn;
    q[up] = -1 - s * da * sn + du * c;
    return q;
  }

  const F3 = [];
  for (let a = 0; a < 3; a++) {
    for (const s of [-1, 1]) {
      const o = [0, 1, 2].filter(k => k !== a), pts = [];
      for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 0, 0];
        p[a] = s; p[o[0]] = u; p[o[1]] = w;
        pts.push(p);
      }
      F3.push({ a, s, pts });
    }
  }
  const CELLS = [], E4 = [], EC = [], FACES4 = [];
  for (let a = 0; a < 4; a++) {
    for (const s of [-1, 1]) {
      const o = [0, 1, 2, 3].filter(k => k !== a), verts = [], ci = CELLS.length, base = ci * 8;
      for (let i = 0; i < 8; i++) {
        const p = [0, 0, 0, 0];
        p[a] = s;
        o.forEach((k, j) => { p[k] = (i >> j) & 1 ? 1 : -1; });
        verts.push(p);
      }
      for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) if (!((i >> j) & 1)) { E4.push(base + i, base + (i | (1 << j))); EC.push(ci); }
      for (let j = 0; j < 3; j++) {
        for (const val of [0, 1]) {
          const r = [0, 1, 2].filter(x => x !== j);
          FACES4.push({ ci, idx: [[0, 0], [1, 0], [1, 1], [0, 1]].map(([b1, b2]) => base + ((val << j) | (b1 << r[0]) | (b2 << r[1]))) });
        }
      }
      CELLS.push({ a, s, verts });
    }
  }
  const E4a = Int32Array.from(E4);
  const P4 = new Float64Array(64 * 4), P3 = new Float64Array(24 * 3);
  const cellCol = (a, s, up) => (a === up ? (s < 0 ? Theme.c.ca : Theme.c.cb) : Theme.c.ax[a]);
  let t = 0.5, playing = !REDUCED, dir = 1, hold = 0;

  function build() {
    const th1 = (Math.PI / 2) * smooth(t / 0.62), th2 = (Math.PI / 2) * smooth((t - 0.42) / 0.58), sh = smooth(t);
    CELLS.forEach((c, ci) => c.verts.forEach((p, i) => {
      const q = unfoldPt(p, c.a, c.s, 3, th1, th2);
      q[COL] += sh;
      for (let k = 0; k < 4; k++) P4[(ci * 8 + i) * 4 + k] = q[k] * 0.5;
    }));
    F3.forEach((f, fi) => f.pts.forEach((p, i) => {
      const q = unfoldPt(p, f.a, f.s, 2, th1, th2);
      q[COL] += sh;
      for (let k = 0; k < 3; k++) P3[(fi * 4 + i) * 3 + k] = q[k] * 0.5;
    }));
  }

  const quad = (ctx, b, idx) => {
    ctx.beginPath();
    idx.forEach((i, k) => (k ? ctx.lineTo(b.sx[i], b.sy[i]) : ctx.moveTo(b.sx[i], b.sy[i])));
    ctx.closePath();
  };

  const left = new View($('#v-unfold3'), {
    yaw: 0.5, pitch: 0.32, fit: 2.15, cam: 9, tag: 'Analogi 3D',
    label: 'Kubus yang dibuka menjadi jaring-jaring enam persegi',
    draw(v, ctx) {
      const b = v.project3(P3, 24);
      const order = F3.map((f, fi) => {
        let z = 0;
        for (let i = 0; i < 4; i++) z += b.z[fi * 4 + i];
        return [z, fi];
      }).sort((p, q) => p[0] - q[0]);
      ctx.lineWidth = 2.2;
      for (const [, fi] of order) {
        const f = F3[fi], col = cellCol(f.a, f.s, 2);
        quad(ctx, b, [0, 1, 2, 3].map(i => fi * 4 + i));
        ctx.fillStyle = Color.css(col, Theme.dark ? 0.26 : 0.3);
        ctx.fill();
        ctx.strokeStyle = Color.css(col, 1);
        ctx.stroke();
      }
    },
  });

  const right = new View($('#v-unfold4'), {
    yaw: 0.5, pitch: 0.3, D: 2.2, fit: 2.15, allow4D: true, tag: 'Tesseract',
    label: 'Tesseract yang dibuka menjadi jaring-jaring delapan kubus',
    draw(v, ctx) {
      const b = v.project4(P4, 64);
      const order = FACES4.map((f, k) => [b.z[f.idx[0]] + b.z[f.idx[1]] + b.z[f.idx[2]] + b.z[f.idx[3]], k]).sort((p, q) => p[0] - q[0]);
      for (const [, k] of order) {
        const f = FACES4[k], c = CELLS[f.ci];
        quad(ctx, b, f.idx);
        ctx.fillStyle = Color.css(cellCol(c.a, c.s, 3), Theme.dark ? 0.12 : 0.1);
        ctx.fill();
      }
      v.edges(b, E4a, e => { const c = CELLS[EC[e]]; return cellCol(c.a, c.s, 3); }, { width: 2, far: 0.45 });
    },
  });

  const range = $('#unfold-t'), out = $('#unfold-out'), btn = $('#unfold-play');
  const sync = () => { range.value = Math.round(t * 100); out.textContent = Math.round(t * 100) + '%'; };
  build();
  sync();
  setPlay(btn, playing);
  Loop.task(dt => {
    if (!playing || !(left.visible || right.visible)) return;
    if (hold > 0) { hold -= dt; return; }
    t += dir * dt * 0.2;
    if (t >= 1) { t = 1; dir = -1; hold = 1.4; } else if (t <= 0) { t = 0; dir = 1; hold = 1.4; }
    build();
    sync();
    left.dirty = right.dirty = true;
  });
  btn.addEventListener('click', () => { playing = !playing; setPlay(btn, playing); });
  range.addEventListener('input', () => {
    t = +range.value / 100;
    playing = false;
    setPlay(btn, false);
    build();
    sync();
    left.dirty = right.dirty = true;
  });
}

/* ---------------------------------------------------------------------
   06 · Galeri bentuk 4D
   --------------------------------------------------------------------- */
function initLab() {
  let p = 6, q = 6;
  const CAT = {
    tess: {
      make: () => Shapes.tesseract(), title: 'Tesseract', alt: 'Hiperkubus · 8-sel · simbol Schläfli {4,3,3}', analog: 'Kubus',
      stats: [['Titik sudut', '16'], ['Rusuk', '32'], ['Sisi', '24 persegi'], ['Sel', '8 kubus']],
      desc: 'Kubus yang digeser ke arah W. Kubus dalam, kubus luar, dan enam bentuk mirip limas terpancung di antaranya semuanya adalah kubus yang sama besar. Mereka tampak berbeda hanya karena perspektif 4D.',
      width: 2.5, D: 1.8, fit: 1.3, dot: 3.6,
    },
    c5: {
      make: () => Shapes.cell5(), title: '5-sel', alt: 'Pentakoron · 4-simpleks · {3,3,3}', analog: 'Tetrahedron',
      stats: [['Titik sudut', '5'], ['Rusuk', '10'], ['Sisi', '10 segitiga'], ['Sel', '5 tetrahedron']],
      desc: 'Bentuk 4D yang paling sederhana. Kelima titiknya saling terhubung dan semua jaraknya sama. Di 3D paling banyak hanya 4 titik yang bisa seperti itu, yaitu tetrahedron.',
      width: 2.5, D: 1.8, fit: 1.3, dot: 4,
    },
    c16: {
      make: () => Shapes.cell16(), title: '16-sel', alt: 'Heksadekakoron · ortopleks · {3,3,4}', analog: 'Oktahedron',
      stats: [['Titik sudut', '8'], ['Rusuk', '24'], ['Sisi', '32 segitiga'], ['Sel', '16 tetrahedron']],
      desc: 'Pasangan (dual) tesseract: titik-titiknya terletak di pusat kedelapan sel tesseract. Setiap titik terhubung ke semua titik lain kecuali titik di seberangnya.',
      width: 2.3, D: 1.8, fit: 1.3, dot: 4,
    },
    c24: {
      make: () => Shapes.cell24(), title: '24-sel', alt: 'Ikositetrakoron · oktapleks · {3,4,3}', analog: 'tidak ada',
      stats: [['Titik sudut', '24'], ['Rusuk', '96'], ['Sisi', '96 segitiga'], ['Sel', '24 oktahedron']],
      desc: 'Satu-satunya bentuk beraturan yang tidak punya kembaran di dimensi lain mana pun. Bentuk ini juga dual dari dirinya sendiri: pusat-pusat selnya membentuk 24-sel lagi.',
      width: 1.9, D: 1.8, fit: 1.35, dot: 3,
    },
    c120: {
      make: () => Shapes.cell120(), title: '120-sel', alt: 'Hekatonikosakoron · dodekapleks · {5,3,3}', analog: 'Dodekahedron',
      stats: [['Titik sudut', '600'], ['Rusuk', '1200'], ['Sisi', '720 segi lima'], ['Sel', '120 dodekahedron']],
      desc: 'Tersusun dari 120 dodekahedron, tiga di setiap rusuk. Ini bentuk beraturan paling rumit di 4D. Warna menunjukkan posisi W, sehingga lapisan dalam dan luarnya bisa dibedakan.',
      width: 1, D: 1.8, fit: 1.4, dot: 1.3, far: 0.18,
    },
    c600: {
      make: () => Shapes.cell600(), title: '600-sel', alt: 'Heksakosikoron · tetrapleks · {3,3,5}', analog: 'Ikosahedron',
      stats: [['Titik sudut', '120'], ['Rusuk', '720'], ['Sisi', '1200 segitiga'], ['Sel', '600 tetrahedron']],
      desc: 'Tersusun dari 600 tetrahedron, lima di setiap rusuk. Jika titik-titiknya ditulis sebagai kuaternion, perkalian dua titik selalu menghasilkan titik lain dari bentuk yang sama.',
      width: 1.2, D: 1.8, fit: 1.4, dot: 2, far: 0.2,
    },
    duo: {
      make: () => Shapes.duoprism(p, q), title: () => 'Duoprisma ' + p + '×' + q, alt: 'Hasil kali dua poligon', analog: 'Prisma',
      stats: () => [['Titik sudut', String(p * q)], ['Rusuk', String(2 * p * q)], ['Sisi', String(p * q + p + q)], ['Sel', String(p + q) + ' prisma']],
      desc: () => 'Setiap titik poligon segi-' + p + ' dipasangkan dengan setiap titik poligon segi-' + q + '. Hasilnya ' + p + ' prisma segi-' + q + ' dan ' + q + ' prisma segi-' + p + ' yang menyambung menjadi dua rantai yang saling mengunci. Rusuk biru dan merah muda mengikuti keliling masing-masing poligon.',
      width: 2, D: 1.8, fit: 1.4, dot: 3,
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
      '" aria-label="Kecepatan putar bidang ' + PLANE_NAMES[i] + '"><output id="lab-sp-' + i + '-out"></output>';
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
    yaw: 0.6, pitch: 0.35, D: 1.8, fit: 1.4, allow4D: true, tag: 'Galeri',
    label: 'Bentuk 4D pilihan yang berputar',
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
      v.edges(b, S.edges, col, { width: cfg.width, glow: S.n <= 120, far: cfg.far ?? 0.3, skip: (a, c) => bad(a) || bad(c) });
      if (dots.checked) v.dots(b, S.n, i => wCol(b.w[i]), cfg.dot ?? 3, { ring: S.n <= 120, skip: bad });
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
    if (id === 'duo') shape = cfg.make();
    else shape = cache[id] || (cache[id] = cfg.make());
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
    p = +pIn.value; q = +qIn.value;
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
