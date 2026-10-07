'use strict';
/* =====================================================================
   core.js
   Matematika 4D (matriks rotasi 4×4), palet warna dari token CSS,
   dan komponen View: kanvas dengan kamera 3D, proyeksi 4D→3D→2D,
   gambar tabung & bola berbayang, pengukur W, gizmo sumbu,
   interaksi (seret + momentum, cubit/zoom, keyboard), serta satu loop
   animasi bersama.
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
const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';

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
  /* k > 0 mencerahkan menuju putih, k < 0 menggelapkan menuju hitam. */
  shade(c, k) {
    return k >= 0 ? Color.mix(c, [255, 255, 255], k) : Color.mix(c, [0, 0, 0], -k);
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

/* Palet kanvas dibaca dari token CSS: Theme.c mengikuti tema halaman,
   Theme.s adalah palet "panggung" gelap yang sama di kedua tema. */
const Theme = {
  c: null,
  s: null,
  dark: false,
  subs: new Set(),
  isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  },
  palette(cs, p, dark) {
    const g = n => Color.parse(cs.getPropertyValue(p + n).trim());
    const P = {
      dark,
      paper: g('paper'), ink: g('ink'), ink2: g('ink-2'), line: g('line'), accent: g('accent'), lamp: g('lamp'),
      ax: [g('ax-x'), g('ax-y'), g('ax-z'), g('ax-w')],
      wl: g('w-low'), wm: g('w-mid'), wh: g('w-high'), ca: g('cell-a'), cb: g('cell-b'),
      lut: [],
    };
    for (let i = 0; i < 64; i++) {
      const t = i / 63;
      P.lut.push(t < 0.5 ? Color.mix(P.wl, P.wm, t * 2) : Color.mix(P.wm, P.wh, (t - 0.5) * 2));
    }
    return P;
  },
  read() {
    const cs = getComputedStyle(document.documentElement);
    this.dark = this.isDark();
    this.c = this.palette(cs, '--', this.dark);
    this.s = this.palette(cs, '--s-', true);
    this.subs.forEach(f => f());
  },
  w(t, P = this.c) { return P.lut[Math.round(clamp(t, 0, 1) * 63)]; },
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
const LIGHT2 = unit([-0.55, -0.83]); // arah cahaya di layar (kiri atas)

class View {
  constructor(host, o = {}) {
    this.host = host;
    this.o = o;
    const c = (this.canvas = document.createElement('canvas'));
    c.className = 'view-canvas';
    c.tabIndex = 0;
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', (o.label || 'Visualisasi') + '. Tombol panah memutar gambar' +
      (o.allow4D ? ', Shift dengan panah memutar ke arah W' : '') + ', tombol 0 mengatur ulang.');
    host.prepend(c);
    if (o.gizmo) host.classList.add('has-gizmo');
    this.main = this.ctx = c.getContext('2d');
    this.yaw0 = o.yaw ?? 0.55;
    this.pitch0 = o.pitch ?? 0.3;
    this.yaw = this.yaw0;
    this.pitch = this.pitch0;
    this.rot4 = M4.id();
    this._rc = 0;
    this.D = o.D ?? 1.8;
    this.cam = o.cam ?? 6;
    this.fit = o.fit ?? 1.4;
    this.zoom0 = o.zoom ?? 1;
    this.zoom = this.zoom0;
    this.allow3D = o.allow3D !== false;
    this.allow4D = !!o.allow4D;
    this.dragMode = 3;
    this.update = o.update || null;
    this.draw = o.draw || null;
    this.dirty = true;
    this.visible = false;
    this.dragging = false;
    this.vel = null;
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

  get pal() { return this.o.stage ? Theme.s : Theme.c; }

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
      ? (touch ? 'Geser ke samping: putar · tombol 4D: putar ke arah W' : 'Seret: putar · Shift + seret: ke arah W')
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
    this.vel = null;
    this.setZoom(this.zoom0);
    if (this.allow4D) this.rot4 = M4.id();
    if (this.o.onReset) this.o.onReset(this);
    this.dirty = true;
  }

  setZoom(z) {
    this.zoom = clamp(z, 0.5, 2.6);
    this.dirty = true;
    if (this.o.onZoom) this.o.onZoom(this.zoom);
  }

  _isFour(shift) { return this.allow4D && (this.dragMode === 4 || shift || !this.allow3D); }

  _input() {
    const c = this.canvas, pts = new Map();
    let last = 0, pinch = 0;
    const pdist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    c.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
      this.dragging = true;
      this.vel = null;
      this._vx = this._vy = 0;
      last = performance.now();
      this.host.classList.add('is-dragging');
      if (pts.size === 2) pinch = pdist();
    });
    c.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size >= 2) {
        const d = pdist();
        if (pinch > 0) this.setZoom((this.zoom * d) / pinch);
        pinch = d;
        return;
      }
      const now = performance.now(), dtm = Math.max(4, now - last);
      last = now;
      this._four = this._isFour(e.shiftKey);
      this.drag(dx, dy, this._four);
      this._vx = lerp(this._vx, dx / dtm, 0.4);
      this._vy = lerp(this._vy, dy / dtm, 0.4);
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      pinch = 0;
      if (pts.size) return;
      this.dragging = false;
      this.host.classList.remove('is-dragging');
      if (e.type === 'pointerup' && !REDUCED && performance.now() - last < 70) {
        this.vel = { x: this._vx, y: this._vy, four: this._four };
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', () => this.resetView());
    c.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      this.setZoom(this.zoom * Math.exp(-clamp(e.deltaY, -40, 40) * 0.01));
    }, { passive: false });
    c.addEventListener('keydown', e => {
      const k = e.key, st = 14;
      let dx = 0, dy = 0;
      if (k === 'ArrowLeft') dx = -st;
      else if (k === 'ArrowRight') dx = st;
      else if (k === 'ArrowUp') dy = -st;
      else if (k === 'ArrowDown') dy = st;
      else if (k === '+' || k === '=') { this.setZoom(this.zoom * 1.12); e.preventDefault(); return; }
      else if (k === '-') { this.setZoom(this.zoom / 1.12); e.preventDefault(); return; }
      else if (k === '0') { this.resetView(); e.preventDefault(); return; }
      else return;
      e.preventDefault();
      this.drag(dx, dy, this._isFour(e.shiftKey));
    });
  }

  drag(dx, dy, four) {
    const k = 0.0085;
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
    if (this.vel && !this.dragging) {
      const v = this.vel;
      this.drag(v.x * dt * 1000, v.y * dt * 1000, v.four);
      const k = Math.exp(-dt * 3.2);
      v.x *= k;
      v.y *= k;
      if (Math.abs(v.x) + Math.abs(v.y) < 0.01) this.vel = null;
      anim = true;
    }
    if (this.update) anim = this.update(dt, this) === true || anim;
    if (anim || this.dirty) {
      this.dirty = false;
      this.render();
    }
  }

  render() {
    if (!this.w || !this.draw || !Theme.c) return;
    const main = this.main;
    const bloom = !!this.o.bloom && View.canFilter && this.pal.dark;
    let ctx = main;
    if (bloom) {
      if (!this.off) {
        this.off = document.createElement('canvas');
        this.offCtx = this.off.getContext('2d');
        this.blur = document.createElement('canvas');
        this.blurCtx = this.blur.getContext('2d');
      }
      if (this.off.width !== this.canvas.width || this.off.height !== this.canvas.height) {
        this.off.width = this.canvas.width;
        this.off.height = this.canvas.height;
        this.blur.width = Math.ceil(this.canvas.width / 2);
        this.blur.height = Math.ceil(this.canvas.height / 2);
      }
      ctx = this.offCtx;
    }
    this.ctx = ctx;
    this._bloom = bloom;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.cx = this.w / 2 - (this.o.gauge ? 14 : 0);
    this.cy = this.h / 2;
    this.s = (Math.min(this.w, this.h) / 2 / this.fit) * this.zoom;
    this._c = [Math.cos(this.yaw), Math.sin(this.yaw), Math.cos(this.pitch), Math.sin(this.pitch)];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.gaugeData = null;
    this.draw(this, ctx);
    if (bloom) {
      // Cahaya pendar: salinan gambar yang dikaburkan, ditambahkan di bawah gambar tajam.
      const W = this.canvas.width, H = this.canvas.height, bc = this.blurCtx;
      bc.setTransform(1, 0, 0, 1, 0, 0);
      bc.clearRect(0, 0, this.blur.width, this.blur.height);
      bc.filter = 'blur(' + Math.round(5 * this.dpr) + 'px)';
      bc.drawImage(this.off, 0, 0, this.blur.width, this.blur.height);
      bc.filter = 'none';
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.clearRect(0, 0, W, H);
      main.globalCompositeOperation = 'lighter';
      main.globalAlpha = 0.8;
      main.drawImage(this.blur, 0, 0, W, H);
      main.globalAlpha = 1;
      main.globalCompositeOperation = 'source-over';
      main.drawImage(this.off, 0, 0);
      main.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx = main;
    }
    if (this.o.gizmo) this.drawGizmo(main);
    if (this.o.gauge && this.gaugeData) this.drawGauge(main);
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

  /* ---------- Tabung & bola berbayang ---------- */
  drawTube(x1, y1, r1, x2, y2, r2, rgb, glow) {
    const ctx = this.ctx, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    let nx = 0, ny = -1;
    if (L > 0.5) { nx = -dy / L; ny = dx / L; }
    if (nx * LIGHT2[0] + ny * LIGHT2[1] < 0) { nx = -nx; ny = -ny; }
    const rm = (r1 + r2) / 2, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    if (glow) {
      ctx.strokeStyle = Color.css(rgb, 0.13);
      ctx.lineWidth = rm * 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(mx - nx * rm, my - ny * rm, mx + nx * rm, my + ny * rm);
    g.addColorStop(0, Color.css(Color.shade(rgb, -0.42)));
    g.addColorStop(0.5, Color.css(rgb));
    g.addColorStop(0.8, Color.css(Color.shade(rgb, 0.42)));
    g.addColorStop(1, Color.css(Color.shade(rgb, 0.08)));
    ctx.fillStyle = g;
    if (L > 0.5) {
      ctx.beginPath();
      ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
      ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
      ctx.lineTo(x2 - nx * r2, y2 - ny * r2);
      ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x1, y1, r1, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x2, y2, r2, 0, TAU);
    ctx.fill();
  }

  drawBall(x, y, r, rgb, glow) {
    const ctx = this.ctx;
    if (glow) {
      ctx.fillStyle = Color.css(rgb, 0.16);
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, TAU);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    g.addColorStop(0, Color.css(Color.shade(rgb, 0.72)));
    g.addColorStop(0.38, Color.css(rgb));
    g.addColorStop(1, Color.css(Color.shade(rgb, -0.48)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /* Rusuk sebagai tabung dan titik sudut sebagai bola, diurutkan dari jauh ke
     dekat. Tebalnya mengikuti perspektif 3D dan 4D, jadi bagian yang "dekat"
     di arah W tampak lebih tebal. Yang jauh memudar ke warna latar. */
  tubes(b, E, col, o = {}) {
    const P = this.pal, items = [], m = E.length >> 1;
    let lo = Infinity, hi = -Infinity;
    for (let e = 0; e < m; e++) {
      const a = E[2 * e], c = E[2 * e + 1];
      if (o.skip && o.skip(a, c)) continue;
      const z = (b.z[a] + b.z[c]) * 0.5;
      items.push([z, 0, e]);
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
    const verts = o.vlist || Array.from({ length: o.nv || 0 }, (_, i) => i);
    for (const i of verts) {
      if (o.vskip && o.vskip(i)) continue;
      const z = b.z[i] + 1e-4;
      items.push([z, 1, i]);
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
    items.sort((p, q) => p[0] - q[0]);
    const span = hi - lo || 1, fog = o.fog ?? 0.42, s = this.s, r0 = o.r ?? 0.012, vr = o.vr ?? 0.03;
    const glow = !!o.glow && P.dark && !this._bloom;
    const rad = (i, base, min) => Math.max(min, base * s * b.k[i] * Math.pow(b.f[i], 0.55));
    for (const [z, kind, idx] of items) {
      const fk = fog * Math.pow(1 - (z - lo) / span, 1.3);
      if (kind === 0) {
        const a = E[2 * idx], c = E[2 * idx + 1], rgb = col(idx, a, c);
        if (!rgb) continue;
        this.drawTube(b.sx[a], b.sy[a], rad(a, r0, o.min ?? 0.9), b.sx[c], b.sy[c], rad(c, r0, o.min ?? 0.9), Color.mix(rgb, P.paper, fk), glow);
      } else {
        const rgb = o.vcol ? o.vcol(idx) : P.ink;
        this.drawBall(b.sx[idx], b.sy[idx], rad(idx, vr, 1.6), Color.mix(rgb, P.paper, fk), glow);
      }
    }
  }

  /* ---------- Garis tipis (untuk bentuk dengan ratusan rusuk) ---------- */
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
    const glow = o.glow && this.pal.dark && !this._bloom;
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
        ctx.strokeStyle = Color.css(this.pal.paper, 0.9);
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
      ctx.lineWidth = lw * lerp(0.75, 1.25, t);
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

  /* ---------- Pengukur W: posisi setiap titik sudut di arah keempat ---------- */
  drawGauge(ctx) {
    const { b, n, col } = this.gaugeData, P = this.pal;
    const x = this.w - 24, top = 66, bot = this.h - (this.o.gizmo ? 104 : 44);
    if (bot - top < 70) return;
    const yOf = w => lerp(bot, top, clamp((w + 1) / 2, 0, 1));
    const g = ctx.createLinearGradient(0, bot, 0, top);
    g.addColorStop(0, Color.css(P.wl));
    g.addColorStop(0.5, Color.css(P.wm));
    g.addColorStop(1, Color.css(P.wh));
    ctx.fillStyle = g;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - 2.5, top, 5, bot - top, 2.5);
    else ctx.rect(x - 2.5, top, 5, bot - top);
    ctx.fill();
    ctx.font = '500 10px ' + MONO;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = Color.css(P.ink2);
    ctx.fillText('+1', x + 6, yOf(1));
    ctx.fillText('0', x + 6, yOf(0));
    ctx.fillText('−1', x + 6, yOf(-1));
    ctx.textAlign = 'center';
    ctx.font = '600 11px ' + MONO;
    ctx.fillStyle = Color.css(P.ink);
    ctx.fillText('W', x, top - 14);
    const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => b.w[p] - b.w[q]);
    const r = n > 150 ? 1.5 : n > 40 ? 2.2 : 3, rows = new Map();
    for (const i of order) {
      const y = yOf(b.w[i]), key = Math.round(y / (r * 2.1)), c = rows.get(key) || 0;
      rows.set(key, c + 1);
      if (c > 16) continue;
      ctx.beginPath();
      ctx.arc(x - 9 - c * r * 2.2, y, r, 0, TAU);
      ctx.fillStyle = Color.css(col(i));
      ctx.fill();
    }
  }

  /* ---------- Gizmo: ke mana sumbu X, Y, Z, W benda menghadap ---------- */
  drawGizmo(ctx) {
    const P = this.pal, m = this.rot4, R = 24, cx = this.w - R - 20, cy = this.h - R - 20;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 11, 0, TAU);
    ctx.fillStyle = Color.css(P.paper, 0.88);
    ctx.fill();
    ctx.strokeStyle = Color.css(P.line);
    ctx.lineWidth = 1;
    ctx.stroke();
    const axes = [0, 1, 2, 3].map(k => {
      const d = this.camDir(m[k], m[4 + k], m[8 + k]);
      return { k, x: d[0], y: d[1], z: d[2] };
    }).sort((p, q) => p.z - q.z);
    ctx.font = '600 10px ' + MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const a of axes) {
      const len = Math.hypot(a.x, a.y), al = a.z < -0.05 ? 0.5 : 1;
      const ex = cx + a.x * R, ey = cy - a.y * R;
      ctx.strokeStyle = ctx.fillStyle = Color.css(P.ax[a.k], al);
      if (len < 0.2) {
        // Sumbu ini hampir seluruhnya tersembunyi (menunjuk ke arah W atau ke layar).
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(ex, ey, 4.5, 0, TAU);
        ctx.stroke();
        ctx.fillText(AXES[a.k], cx + 12, cy + 11);
        continue;
      }
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, 2.2, 0, TAU);
      ctx.fill();
      ctx.fillText(AXES[a.k], ex + (a.x / len) * 8, ey - (a.y / len) * 8);
    }
  }

  message(text) {
    const ctx = this.ctx;
    ctx.fillStyle = Color.css(this.pal.ink2);
    ctx.font = '500 13px ' + MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, this.w / 2, this.h / 2);
  }
}

/* Apakah kanvas mendukung filter blur (untuk cahaya pendar)? Diuji dengan
   menggambar, karena sekadar membaca properti bisa menipu. */
View.canFilter = (() => {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 12;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.filter = 'blur(2px)';
    x.fillRect(5, 5, 2, 2);
    return x.getImageData(3, 6, 1, 1).data[3] > 0;
  } catch (e) {
    return false;
  }
})();

/* Tombol jalankan/jeda yang dipakai di beberapa bagian. */
function setPlay(btn, on) {
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('.lbl').textContent = on ? 'Jeda' : 'Jalankan';
}
function pressOnly(btns, active) {
  btns.forEach(b => b.setAttribute('aria-pressed', String(b === active)));
}
