'use strict';
/* =====================================================================
   shapes.js
   Pembuat bentuk 4D (dan padanan 3D-nya). Semua bentuk dinormalkan
   sehingga jari-jari lingkaran luarnya = 1.
   Format: verts = Float64Array (stride 4, atau 3 untuk bentuk 3D),
           edges = Int32Array berisi pasangan indeks titik.
   ===================================================================== */

const Shapes = (() => {
  const PHI = (1 + Math.sqrt(5)) / 2;

  /* Semua 24 permutasi indeks 0..3, ditandai genap/ganjil. */
  const PERMS = [];
  (function rec(arr, rest) {
    if (!rest.length) {
      let inv = 0;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (arr[i] > arr[j]) inv++;
      PERMS.push({ p: arr, even: inv % 2 === 0 });
      return;
    }
    rest.forEach((x, i) => rec([...arr, x], rest.filter((_, j) => j !== i)));
  })([], [0, 1, 2, 3]);

  /* Semua permutasi (atau hanya yang genap) dari base, dengan semua kombinasi tanda ±. */
  function expand(base, evenOnly = false) {
    const out = new Map();
    for (const { p, even } of PERMS) {
      if (evenOnly && !even) continue;
      const v = p.map(i => base[i]);
      const nz = [];
      v.forEach((x, i) => { if (x !== 0) nz.push(i); });
      for (let m = 0; m < 1 << nz.length; m++) {
        const w = v.slice();
        nz.forEach((i, k) => { if ((m >> k) & 1) w[i] = -w[i]; });
        out.set(w.map(x => x.toFixed(6)).join(','), w);
      }
    }
    return [...out.values()];
  }

  function pack(list, d) {
    const V = new Float64Array(list.length * d);
    list.forEach((v, i) => { for (let k = 0; k < d; k++) V[i * d + k] = v[k]; });
    return V;
  }

  function normalize(V, d) {
    let r = 0;
    for (let i = 0; i < V.length; i += d) {
      let s = 0;
      for (let k = 0; k < d; k++) s += V[i + k] * V[i + k];
      r = Math.max(r, Math.sqrt(s));
    }
    for (let i = 0; i < V.length; i++) V[i] /= r;
    return V;
  }

  /* Rusuk = pasangan titik dengan jarak terpendek (berlaku untuk bentuk beraturan). */
  function edgesByMin(V, n, d) {
    const d2 = (i, j) => {
      let s = 0;
      for (let k = 0; k < d; k++) { const t = V[i * d + k] - V[j * d + k]; s += t * t; }
      return s;
    };
    let m = Infinity;
    for (let j = 1; j < n; j++) m = Math.min(m, d2(0, j));
    const tol = m * 1e-4, E = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(d2(i, j) - m) < tol) E.push(i, j);
    return Int32Array.from(E);
  }

  function regular(id, list, d = 4) {
    const verts = normalize(pack(list, d), d);
    const n = list.length;
    return { id, verts, n, edges: edgesByMin(verts, n, d), dim: d };
  }

  /* n-kubus dengan titik ±half, beserta sumbu tiap rusuk (untuk pewarnaan). */
  function hypercube(dim, half) {
    const n = 1 << dim, V = new Float64Array(n * dim), E = [], A = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) V[i * dim + k] = (i >> k) & 1 ? half : -half;
    for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) if (!((i >> k) & 1)) { E.push(i, i | (1 << k)); A.push(k); }
    return { verts: V, n, edges: Int32Array.from(E), edgeAxis: Int8Array.from(A), dim };
  }

  const tesseract = () => Object.assign(hypercube(4, 0.5), { id: 'tess' });
  const cube3 = (half = 0.5) => Object.assign(hypercube(3, half), { id: 'cube' });

  function cell5() {
    const s = 1 / Math.sqrt(5);
    return regular('c5', [[1, 1, 1, -s], [1, -1, -1, -s], [-1, 1, -1, -s], [-1, -1, 1, -s], [0, 0, 0, Math.sqrt(5) - s]]);
  }
  const cell16 = () => regular('c16', expand([1, 0, 0, 0]));
  const cell24 = () => regular('c24', expand([1, 1, 0, 0]));
  const cell600 = () => regular('c600', [
    ...expand([1, 0, 0, 0]),
    ...expand([0.5, 0.5, 0.5, 0.5]),
    ...expand([PHI / 2, 0.5, 1 / (2 * PHI), 0], true),
  ]);
  const cell120 = () => regular('c120', [
    ...expand([0, 0, 2, 2]),
    ...expand([1, 1, 1, Math.sqrt(5)]),
    ...expand([PHI ** -2, PHI, PHI, PHI]),
    ...expand([1 / PHI, 1 / PHI, 1 / PHI, PHI ** 2]),
    ...expand([0, PHI ** -2, 1, PHI ** 2], true),
    ...expand([0, 1 / PHI, PHI, Math.sqrt(5)], true),
    ...expand([1 / PHI, 1, PHI, 2], true),
  ]);

  /* Padanan 3D untuk bagian irisan. */
  const octa3 = () => regular('octa', [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], 3);
  const tetra3 = () => regular('tetra', [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], 3);

  /* Duoprisma p×q: hasil kali dua poligon. Kelompok 0 = rusuk keliling poligon
     pertama, kelompok 1 = rusuk keliling poligon kedua. */
  function duoprism(p, q) {
    const n = p * q, V = new Float64Array(n * 4), E = [], G = [], r = Math.SQRT1_2;
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < q; j++) {
        const a = (TAU * i) / p, b = (TAU * j) / q, k = (i * q + j) * 4;
        V[k] = r * Math.cos(a); V[k + 1] = r * Math.sin(a);
        V[k + 2] = r * Math.cos(b); V[k + 3] = r * Math.sin(b);
        E.push(i * q + j, ((i + 1) % p) * q + j); G.push(0);
        E.push(i * q + j, i * q + ((j + 1) % q)); G.push(1);
      }
    }
    return { id: 'duo', verts: V, n, edges: Int32Array.from(E), edgeGroup: Int8Array.from(G), dim: 4 };
  }

  /* Torus Clifford: (cos a, sin a, cos b, sin b)/√2, digambar sebagai cincin. */
  function clifford(rings = 24, seg = 72) {
    const pts = [], lines = [], r = Math.SQRT1_2;
    for (let g = 0; g < 2; g++) {
      for (let i = 0; i < rings; i++) {
        const fixed = (TAU * (i + 0.5)) / rings, start = pts.length / 4;
        for (let s = 0; s < seg; s++) {
          const t = (TAU * s) / seg;
          const a = g ? t : fixed, b = g ? fixed : t;
          pts.push(r * Math.cos(a), r * Math.sin(a), r * Math.cos(b), r * Math.sin(b));
        }
        lines.push({ start, count: seg, closed: true, g });
      }
    }
    return { id: 'clifford', verts: Float64Array.from(pts), n: pts.length / 4, edges: new Int32Array(0), lines, dim: 4 };
  }

  /* Fibrasi Hopf: setiap titik di bola biasa (garis lintang eta, bujur phi)
     berpadanan dengan satu lingkaran besar di hipersfer:
     (z1, z2) = e^{it} · (sin eta · e^{i phi}, cos eta).
     Lingkaran dengan eta yang sama membentuk satu torus; hasilnya torus bersarang. */
  function hopf() {
    const etas = [0.8, 1.1, 1.38], per = [12, 16, 20], seg = 96;
    const pts = [], lines = [];
    etas.forEach((eta, li) => {
      const se = Math.sin(eta), ce = Math.cos(eta);
      for (let k = 0; k < per[li]; k++) {
        const phi = (TAU * k) / per[li] + li * 0.35, start = pts.length / 4;
        for (let i = 0; i < seg; i++) {
          const t = (TAU * i) / seg;
          pts.push(se * Math.cos(t + phi), se * Math.sin(t + phi), ce * Math.cos(t), ce * Math.sin(t));
        }
        lines.push({ start, count: seg, closed: true, hue: (phi * 180) / Math.PI, lat: li });
      }
    });
    return { id: 'hopf', verts: Float64Array.from(pts), n: pts.length / 4, edges: new Int32Array(0), lines, dim: 4 };
  }

  /* Sel (sisi 3D) sebuah politop dari normal-normal penumpunya. Dipakai untuk irisan. */
  function facets(shape, normals) {
    const { verts: V, n, edges: E } = shape;
    return normals.map(raw => {
      const nn = unit(raw);
      const d = [];
      let c = -Infinity;
      for (let i = 0; i < n; i++) {
        d[i] = V[i * 4] * nn[0] + V[i * 4 + 1] * nn[1] + V[i * 4 + 2] * nn[2] + V[i * 4 + 3] * nn[3];
        c = Math.max(c, d[i]);
      }
      const on = new Set();
      for (let i = 0; i < n; i++) if (c - d[i] < 1e-6) on.add(i);
      const es = [];
      for (let e = 0; e < E.length; e += 2) if (on.has(E[e]) && on.has(E[e + 1])) es.push(e >> 1);
      return { n: nn, verts: [...on], edges: es };
    });
  }

  return { PHI, expand, tesseract, cube3, cell5, cell16, cell24, cell120, cell600, octa3, tetra3, duoprism, clifford, hopf, facets };
})();
