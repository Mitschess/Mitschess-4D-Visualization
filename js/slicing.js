'use strict';
/* =====================================================================
   slicing.js · bagian 04: irisan benda 4D oleh ruang 3D
   ===================================================================== */

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
