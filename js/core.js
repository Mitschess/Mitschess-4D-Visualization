'use strict';
/* =====================================================================
   core.js
   Matematika 4D (matriks rotasi 4×4), warna dari token tema CSS,
   dan komponen View: kanvas dengan kamera 3D, proyeksi 4D→3D→2D,
   interaksi seret, serta satu loop animasi bersama.
   ===================================================================== */

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const AXES = ['X', 'Y', 'Z', 'W'];
const PLANES = [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3]];
const PLANE_NAMES = PLANES.map(([i, j]) => AXES[i] + AXES[j]);
const fmt = (x, d = 2) => x.toFixed(d).replace('.', ',');
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };

/* ---------------------------------------------------------------------
   Matriks 4×4 (baris-utama). Rotasi selalu terjadi pada sebuah BIDANG.
   --------------------------------------------------------------------- */
const M4 = {
  id() {
    const m = new Float64Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  mul(a, b) {
    const r = new Float64Array(16);
    for (let i = 0; i < 4; i++) {
      const i4 = i * 4;
      for (let j = 0; j < 4; j++) {
        r[i4 + j] = a[i4] * b[j] + a[i4 + 1] * b[4 + j] + a[i4 + 2] * b[8 + j] + a[i4 + 3] * b[12 + j];
      }
    }
    return r;
  },
  /* Rotasi di bidang sumbu i–j: sumbu i berputar menuju sumbu j. */
  rot(i, j, t) {
    const m = M4.id(), c = Math.cos(t), s = Math.sin(t);
    m[i * 5] = c; m[j * 5] = c;
    m[i * 4 + j] = -s; m[j * 4 + i] = s;
    return m;
  },
  /* Rotasi di bidang yang direntang vektor ortonormal a dan b (a menuju b). */
  planeRot(a, b, t) {
    const c = Math.cos(t) - 1, s = Math.sin(t), m = M4.id();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        m[i * 4 + j] += c * (a[i] * a[j] + b[i] * b[j]) + s * (b[i] * a[j] - a[i] * b[j]);
      }
    }
    return m;
  },
  apply(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3],
      m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3],
      m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3],
      m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3],
    ];
  },
  /* Rotasi terkecil yang membawa vektor n ke sumbu ke-k. */
  alignTo(n, k) {
    n = unit(n);
    const d = n[k];
    if (d > 1 - 1e-9) return M4.id();
    if (d < -1 + 1e-9) return M4.rot((k + 1) % 4, k, Math.PI);
    const e = [0, 0, 0, 0];
    e[k] = 1;
    const u = unit(n.map((x, i) => x - d * e[i]));
    return M4.planeRot(u, e, Math.acos(d));
  },
  /* Gram–Schmidt pada baris, mencegah galat pembulatan menumpuk. */
  orthonormalize(m) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < i; j++) {
        let d = 0;
        for (let k = 0; k < 4; k++) d += m[i * 4 + k] * m[j * 4 + k];
        for (let k = 0; k < 4; k++) m[i * 4 + k] -= d * m[j * 4 + k];
      }
      let l = 0;
      for (let k = 0; k < 4; k++) l += m[i * 4 + k] * m[i * 4 + k];
      l = Math.sqrt(l) || 1;
      for (let k = 0; k < 4; k++) m[i * 4 + k] /= l;
    }
    return m;
  },
};

/* ---------------------------------------------------------------------
   Warna
   --------------------------------------------------------------------- */
const Color = {
  _x: null,
  parse(str) {
    if (!this._x) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      this._x = c.getContext('2d', { willReadFrequently: true });
    }
    const x = this._x;
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = '#808080';
    x.fillStyle = str || '#808080';
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  },
  css(c, a = 1) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  },
  mix(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  },
  hsl(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    const f = n => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  },
};

/* Membaca token warna dari CSS agar kanvas mengikuti tema terang/gelap. */
const Theme = {
  c: null,
  lut: [],
  dark: false,
  subs: new Set(),
  isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  },
  read() {
    const cs = getComputedStyle(document.documentElement);
    const g = n => Color.parse(cs.getPropertyValue(n).trim());
    this.dark = this.isDark();
    this.c = {
      paper: g('--paper'), bg: g('--bg'), ink: g('--ink'), ink2: g('--ink-2'),
      line: g('--line'), grid: g('--grid'), accent: g('--accent'), lamp: g('--lamp'),
      ax: [g('--ax-x'), g('--ax-y'), g('--ax-z'), g('--ax-w')],
      wl: g('--w-low'), wm: g('--w-mid'), wh: g('--w-high'),
      ca: g('--cell-a'), cb: g('--cell-b'),
    };
    const { wl, wm, wh } = this.c;
    this.lut = [];
    for (let i = 0; i < 64; i++) {
      const t = i / 63;
      this.lut.push(t < 0.5 ? Color.mix(wl, wm, t * 2) : Color.mix(wm, wh, (t - 0.5) * 2));
    }
    this.subs.forEach(f => f());
  },
  w(t) { return this.lut[Math.round(clamp(t, 0, 1) * 63)]; },
  init() {
    this.read();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.read());
    new MutationObserver(() => this.read())
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  },
};

/* ---------------------------------------------------------------------
   Loop animasi bersama. View hanya digambar ulang saat terlihat.
   --------------------------------------------------------------------- */
const Loop = {
  views: [],
  tasks: [],
  on: false,
  last: 0,
  add(v) { this.views.push(v); this.start(); },
  task(f) { this.tasks.push(f); this.start(); },
  start() {
    if (this.on) return;
    this.on = true;
    this.last = performance.now();
    const tick = t => {
      const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      for (const f of this.tasks) f(dt);
      for (const v of this.views) if (v.visible) v.frame(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
};

/* ---------------------------------------------------------------------
   View: satu kanvas dengan kamera orbit 3D dan orientasi 4D.
   Alur proyeksi:  titik 4D → rotasi 4D → perspektif sepanjang W (lampu 4D
   di w = D) → rotasi kamera (yaw, pitch) → perspektif 3D → layar.
   --------------------------------------------------------------------- */
class View {
  constructor(host, o = {}) {
    this.host = host;
    this.o = o;
    const c = (this.canvas = document.createElement('canvas'));
    c.className = 'view-canvas';
    if (o.label) {
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', o.label);
    }
    host.prepend(c);
    this.ctx = c.getContext('2d');
    this.yaw0 = o.yaw ?? 0.55;
    this.pitch0 = o.pitch ?? 0.3;
    this.yaw = this.yaw0;
    this.pitch = this.pitch0;
    this.rot4 = M4.id();
    this._rc = 0;
    this.D = o.D ?? 1.8;
    this.cam = o.cam ?? 6;
    this.fit = o.fit ?? 1.4;
    this.zoom = 1;
    this.allow3D = o.allow3D !== false;
    this.allow4D = !!o.allow4D;
    this.dragMode = 3;
    this.update = o.update || null;
    this.draw = o.draw || null;
    this.dirty = true;
    this.visible = false;
    this.dragging = false;
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.bufs = {};
    this._c = [1, 0, 1, 0];
    this._ui();
    this._input();
    new ResizeObserver(() => this.resize()).observe(c);
    new IntersectionObserver(es => {
      for (const e of es) {
        this.visible = e.isIntersecting;
        if (this.visible) this.dirty = true;
      }
    }, { rootMargin: '100px' }).observe(c);
    Theme.subs.add(() => { this.dirty = true; });
    Loop.add(this);
  }

  _ui() {
    const ui = document.createElement('div');
    ui.className = 'view-ui';
    if (this.allow4D && this.allow3D) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', 'Arah putaran saat diseret');
      this.segBtns = [3, 4].map(m => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = m + 'D';
        b.title = m === 3 ? 'Seret untuk memutar bayangan 3D' : 'Seret untuk memutar ke arah W';
        b.setAttribute('aria-pressed', String(m === 3));
        b.addEventListener('click', () => this.setDragMode(m));
        seg.append(b);
        return b;
      });
      ui.append(seg);
    }
    const rb = document.createElement('button');
    rb.type = 'button';
    rb.className = 'vbtn';
    rb.title = 'Atur ulang sudut pandang';
    rb.setAttribute('aria-label', 'Atur ulang sudut pandang');
    rb.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.4 8.6a4.7 4.7 0 1 0 1.5-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4.4 1.6v3.2h3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    rb.addEventListener('click', () => this.resetView());
    ui.append(rb);
    this.host.append(ui);
    if (this.o.tag) {
      const t = document.createElement('div');
      t.className = 'view-tag';
      t.textContent = this.o.tag;
      this.host.append(t);
    }
    const hint = document.createElement('div');
    hint.className = 'view-hint';
    const touch = window.matchMedia('(pointer: coarse)').matches;
    hint.textContent = this.o.hint ?? (this.allow4D
      ? (touch ? 'Geser ke samping: putar · tombol 4D: putar ke arah W' : 'Seret: putar · Shift + seret: putar ke arah W')
      : (touch ? 'Geser ke samping untuk memutar' : 'Seret untuk memutar'));
    this.host.append(hint);
  }

  setDragMode(m) {
    this.dragMode = m;
    if (this.segBtns) this.segBtns.forEach((b, i) => b.setAttribute('aria-pressed', String((i ? 4 : 3) === m)));
  }

  resetView() {
    this.yaw = this.yaw0;
    this.pitch = this.pitch0;
    if (this.allow4D) this.rot4 = M4.id();
    if (this.o.onReset) this.o.onReset(this);
    this.dirty = true;
  }

  _input() {
    const c = this.canvas;
    let lx = 0, ly = 0, id = null;
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      id = e.pointerId;
      try { c.setPointerCapture(id); } catch (err) { /* abaikan */ }
      lx = e.clientX;
      ly = e.clientY;
      this.dragging = true;
      this.host.classList.add('is-dragging');
    });
    c.addEventListener('pointermove', e => {
      if (!this.dragging || e.pointerId !== id) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      this.drag(dx, dy, e.shiftKey);
    });
    const end = e => {
      if (e.pointerId !== id) return;
      this.dragging = false;
      id = null;
      this.host.classList.remove('is-dragging');
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  drag(dx, dy, shift) {
    const k = 0.0085;
    const four = this.allow4D && (this.dragMode === 4 || shift || !this.allow3D);
    if (four) {
      // Putar di bidang (arah kanan layar, W) dan (arah atas layar, W).
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const right = [cy, 0, sy, 0], up = [sy * sp, cp, -cy * sp, 0], W = [0, 0, 0, 1];
      this.rot4 = M4.mul(M4.planeRot(right, W, dx * k), this.rot4);
      this.rot4 = M4.mul(M4.planeRot(up, W, -dy * k), this.rot4);
      M4.orthonormalize(this.rot4);
    } else if (this.allow3D) {
      this.yaw += dx * k;
      this.pitch = clamp(this.pitch + dy * k, -1.45, 1.45);
    }
    this.dirty = true;
    if (this.o.onDrag) this.o.onDrag(this);
  }

  /* Putar orientasi 4D di bidang i–j (kerangka dunia). */
  rotate4(i, j, a) {
    this.rot4 = M4.mul(M4.rot(i, j, a), this.rot4);
    if (++this._rc % 90 === 0) M4.orthonormalize(this.rot4);
    this.dirty = true;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.dirty = true;
    if (this.visible) this.render();
  }

  frame(dt) {
    let anim = false;
    if (this.update) anim = this.update(dt, this) === true;
    if (anim || this.dirty) {
      this.dirty = false;
      this.render();
    }
  }

  render() {
    if (!this.w || !this.draw || !Theme.c) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.s = (Math.min(this.w, this.h) / 2 / this.fit) * this.zoom;
    this._c = [Math.cos(this.yaw), Math.sin(this.yaw), Math.cos(this.pitch), Math.sin(this.pitch)];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.draw(this, ctx);
  }

  buf(n, key = 'a') {
    let b = this.bufs[key];
    if (!b || b.cap < n) {
      const F = () => new Float64Array(n);
      b = this.bufs[key] = { cap: n, sx: F(), sy: F(), z: F(), k: F(), w: F(), f: F(), X: F(), Y: F() };
    }
    return b;
  }

  _put(b, i, X, Y, Z) {
    const c = this._c;
    const x1 = X * c[0] + Z * c[1], z1 = -X * c[1] + Z * c[0];
    const y2 = Y * c[2] - z1 * c[3], z2 = Y * c[3] + z1 * c[2];
    const f = this.cam / Math.max(this.cam - z2, 0.05);
    b.X[i] = x1;
    b.Y[i] = y2;
    b.z[i] = z2;
    b.k[i] = f;
    b.sx[i] = this.cx + x1 * f * this.s;
    b.sy[i] = this.cy - y2 * f * this.s;
  }

  /* Titik 4D (stride 4) → rotasi 4D → perspektif W → kamera → layar. */
  project4(P, n, key = 'a') {
    const b = this.buf(n, key), m = this.rot4, D = this.D;
    for (let i = 0; i < n; i++) {
      const o = i * 4, x0 = P[o], y0 = P[o + 1], z0 = P[o + 2], w0 = P[o + 3];
      const x = m[0] * x0 + m[1] * y0 + m[2] * z0 + m[3] * w0;
      const y = m[4] * x0 + m[5] * y0 + m[6] * z0 + m[7] * w0;
      const z = m[8] * x0 + m[9] * y0 + m[10] * z0 + m[11] * w0;
      const w = m[12] * x0 + m[13] * y0 + m[14] * z0 + m[15] * w0;
      const f4 = D === Infinity ? 1 : D / Math.max(D - w, 1e-3);
      b.w[i] = w;
      b.f[i] = f4;
      this._put(b, i, x * f4, y * f4, z * f4);
    }
    return b;
  }

  /* Titik 3D (stride 3) → kamera → layar. */
  project3(P, n, key = 'a') {
    const b = this.buf(n, key);
    for (let i = 0; i < n; i++) {
      b.w[i] = 0;
      b.f[i] = 1;
      this._put(b, i, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    }
    return b;
  }

  /* Arah 3D ke ruang kamera (tanpa perspektif), untuk normal permukaan. */
  camDir(x, y, z) {
    const c = this._c;
    const x1 = x * c[0] + z * c[1], z1 = -x * c[1] + z * c[0];
    return [x1, y * c[2] - z1 * c[3], y * c[3] + z1 * c[2]];
  }

  /* Rusuk diurutkan dari jauh ke dekat; yang jauh lebih tipis dan pudar. */
  edges(b, E, col, o = {}) {
    const m = E.length >> 1;
    if (!m) return;
    const key = new Float64Array(m), idx = [];
    let lo = Infinity, hi = -Infinity;
    for (let e = 0; e < m; e++) {
      const a = E[2 * e], c = E[2 * e + 1];
      if (o.skip && o.skip(a, c, e)) continue;
      const z = (b.z[a] + b.z[c]) * 0.5;
      key[e] = z;
      if (z < lo) lo = z;
      if (z > hi) hi = z;
      idx.push(e);
    }
    idx.sort((p, q) => key[p] - key[q]);
    const ctx = this.ctx, span = hi - lo || 1, lw = o.width ?? 2, far = o.far ?? 0.32, al = o.alpha ?? 1;
    const glow = o.glow && Theme.dark;
    for (const e of idx) {
      const a = E[2 * e], c = E[2 * e + 1];
      const rgb = col(e, a, c);
      if (!rgb) continue;
      const t = (key[e] - lo) / span;
      const alpha = lerp(far, 1, t) * al, wd = lw * lerp(0.7, 1.25, t);
      if (glow) {
        ctx.strokeStyle = Color.css(rgb, alpha * 0.16);
        ctx.lineWidth = wd * 4;
        ctx.beginPath();
        ctx.moveTo(b.sx[a], b.sy[a]);
        ctx.lineTo(b.sx[c], b.sy[c]);
        ctx.stroke();
      }
      ctx.strokeStyle = Color.css(rgb, alpha);
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(b.sx[a], b.sy[a]);
      ctx.lineTo(b.sx[c], b.sy[c]);
      ctx.stroke();
    }
  }

  dots(b, n, col, r = 3, o = {}) {
    const idx = [];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      if (o.skip && o.skip(i)) continue;
      idx.push(i);
      if (b.z[i] < lo) lo = b.z[i];
      if (b.z[i] > hi) hi = b.z[i];
    }
    idx.sort((p, q) => b.z[p] - b.z[q]);
    const ctx = this.ctx, span = hi - lo || 1, far = o.far ?? 0.45;
    for (const i of idx) {
      const t = (b.z[i] - lo) / span;
      const rr = r * lerp(0.7, 1.2, t);
      ctx.beginPath();
      ctx.arc(b.sx[i], b.sy[i], rr, 0, TAU);
      ctx.fillStyle = Color.css(col(i), lerp(far, 1, t));
      ctx.fill();
      if (o.ring) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = Color.css(Theme.c.paper, 0.9);
        ctx.stroke();
      }
    }
  }

  /* Polyline (untuk lingkaran-lingkaran torus dan fibrasi Hopf). */
  lines(b, L, col, o = {}) {
    const ctx = this.ctx, items = [];
    let lo = Infinity, hi = -Infinity;
    for (const ln of L) {
      let z = 0;
      for (let i = 0; i < ln.count; i++) z += b.z[ln.start + i];
      z /= ln.count;
      items.push([z, ln]);
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
    items.sort((p, q) => p[0] - q[0]);
    const span = hi - lo || 1, lw = o.width ?? 1.6, far = o.far ?? 0.35, al = o.alpha ?? 1;
    for (const [z, ln] of items) {
      const t = (z - lo) / span;
      ctx.strokeStyle = Color.css(col(ln), lerp(far, 1, t) * al);
      ctx.lineWidth = lw * lerp(0.75, 1.2, t);
      ctx.beginPath();
      let pen = false;
      const N = ln.count + (ln.closed ? 1 : 0);
      for (let p = 0; p < N; p++) {
        const i = ln.start + (p % ln.count);
        if (o.bad && o.bad(i)) { pen = false; continue; }
        if (pen) ctx.lineTo(b.sx[i], b.sy[i]);
        else { ctx.moveTo(b.sx[i], b.sy[i]); pen = true; }
      }
      ctx.stroke();
    }
  }

  message(text) {
    const ctx = this.ctx;
    ctx.fillStyle = Color.css(Theme.c.ink2, 1);
    ctx.font = '500 13px "IBM Plex Mono", ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, this.w / 2, this.h / 2);
  }
}

/* Tombol jalankan/jeda yang dipakai di beberapa bagian. */
function setPlay(btn, on) {
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('.lbl').textContent = on ? 'Jeda' : 'Jalankan';
}
function pressOnly(btns, active) {
  btns.forEach(b => b.setAttribute('aria-pressed', String(b === active)));
}
