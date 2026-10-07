'use strict';
/* =====================================================================
   unfold.js · bagian 05: jaring-jaring kubus dan tesseract
   ===================================================================== */

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
