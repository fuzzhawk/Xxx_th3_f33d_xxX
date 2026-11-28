// The platformer's middle distance: a city of falling sand. Every cell is a grain with a type and a colour,
// on a grid that scrolls with the parallax (half the hero's speed) and is painted ahead from a plan of
// towers (greebleworks facades, a texel to a cell), rubble, giant fungus, vines, flowers and flesh. The
// flaming spore asteroids blow craters in it: the blast throws grains, leaves embers and fire, and any
// part of a tower no longer joined to the ground falls whole and shatters into sand where it lands.
// Spores seed growth that climbs the wreck, and flesh creeps over what still stands. The further the hero
// gets, the more ruined and overgrown the plan is to begin with.
import { mulberry32 } from '../util.js';

export const CS = 2, GW = 448, GH = 170, ROCKH = 4;
const N = GW * GH, GW2 = GW >> 1, GH2 = GH >> 1, GW4 = GW2 >> 1, GH4 = GH2 >> 1;
// the grid in 16×16 chunks: a chunk where nothing moves sleeps until something moves, lands or burns near it
const CW = GW >> 4, CH = (GH + 15) >> 4;
// cell types: static first (structures), then loose grains, then the light things that rise or drift
const E = 0, ROCK = 1, SOLID = 2, FLESH = 3, VINE = 4, STALK = 5, CAP = 6, BLOOM = 7, TIP = 8,
  RUBBLE = 9, SAND = 10, EMBER = 11, OOZE = 12, FALL = 13, FIRE = 14, SMOKE = 15, SPORE = 16;
const tab = (ks) => { const a = new Uint8Array(32); for (const k of ks) a[k] = 1; return a; };
// structures hold together; light things are passed through; plants (not towers) may root in loose debris
const STRUCT = tab([SOLID, FLESH, VINE, STALK, CAP, BLOOM, TIP]), PASS = tab([E, FIRE, SMOKE, SPORE]), LOOSE = tab([RUBBLE, SAND, EMBER, OOZE]), PLANT = tab([VINE, STALK, CAP, BLOOM, TIP]);
const cb = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const pk = (r, g, b, a = 255) => ((a << 24) | (cb(b) << 16) | (cb(g) << 8) | cb(r)) >>> 0;
const cR = (c) => c & 255, cG = (c) => (c >>> 8) & 255, cB = (c) => (c >>> 16) & 255;
const scl = (c, k) => pk(cR(c) * k, cG(c) * k, cB(c) * k);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const h2 = (x, y, k = 0) => { let q = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
const vn1 = (x, s, k) => { const f = x / s, i = Math.floor(f), u = f - i, w = u * u * (3 - 2 * u); return h2(i, 7, k) * (1 - w) + h2(i + 1, 7, k) * w; };
const vn2 = (x, y, s, k) => {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return (h2(ix, iy, k) * (1 - a) + h2(ix + 1, iy, k) * a) * (1 - b) + (h2(ix, iy + 1, k) * (1 - a) + h2(ix + 1, iy + 1, k) * a) * b;
};
const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// the growth's colours: vivid, the opposite of the city's sodium murk
const VINES = [[34, 140, 84], [20, 170, 140], [96, 196, 54], [60, 120, 40], [24, 110, 120]];
const CAPS = [[236, 60, 170], [40, 220, 226], [255, 136, 40], [150, 84, 255], [190, 255, 70], [255, 70, 90]];
const PETALS = [[255, 70, 180], [70, 140, 255], [255, 200, 40], [170, 255, 60], [255, 110, 60], [200, 90, 255]];
const FLESHP = [[[38, 6, 20], [150, 32, 70], [236, 128, 150]], [[28, 8, 40], [120, 40, 150], [226, 150, 255]], [[8, 30, 28], [30, 130, 110], [150, 255, 200]]];
const FIRE_LUT = new Uint32Array(256), FIRE_GLOW = new Uint32Array(256);
for (let l = 0; l < 256; l++) {
  const k = l / 255, r = k > 0.25 ? 255 : 120 + k * 540, g = k < 0.2 ? 20 + k * 100 : k < 0.7 ? 40 + (k - 0.2) * 300 : 190 + (k - 0.7) * 200, b = k > 0.75 ? (k - 0.75) * 600 : 10;
  FIRE_LUT[l] = pk(r, g, b, k < 0.08 ? k * 2400 : 255); FIRE_GLOW[l] = pk(r * k, g * k * 0.8, b * k * 0.6);
}

// a facade to paint towers with before greebleworks has baked any: concrete, floors, a grid of windows
function fallbackTex(seed) {
  const R = mulberry32(seed), w = 48, h = 64, data = new Uint32Array(w * h), glow = new Uint8Array(w * h);
  const base = [[58, 52, 46], [46, 48, 52], [64, 56, 44], [40, 42, 40]][seed % 4], fh = 6 + ((R() * 4) | 0), ww = 2 + ((R() * 2) | 0), wp = ww + 2 + ((R() * 2) | 0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = 0.8 + h2(x, y, seed) * 0.25, fy = y % fh, wx = x % wp, i = y * w + x;
    let c = base.map((v) => v * n);
    if (fy === 0) c = c.map((v) => v * 0.6);
    else if (fy > 1 && fy < fh - 1 && wx < ww) {
      const lit = h2((x / wp) | 0, (y / fh) | 0, seed + 3) < 0.18;
      c = lit ? [200, 150, 70] : [18, 22, 26]; if (lit) glow[i] = 150;
    }
    data[i] = pk(c[0], c[1], c[2]);
  }
  return { w, h, data, glow };
}

export class Sand {
  // host: { seed, tAt(ax) → progress 0..1 at an absolute column, haze(T) → [r,g,b] }
  constructor(host) {
    this.host = host;
    this.t = new Uint8Array(N); this.col = new Uint32Array(N); this.life = new Uint8Array(N); this.glow = new Uint8Array(N); this.stamp = new Uint8Array(N);
    this.vis = new Uint16Array(N); this.gen = 0; this.queue = new Int32Array(N); this.act = new Uint8Array(CW * CH);
    this.cv = mkc(GW, GH); this.cx = this.cv.getContext('2d'); this.img = this.cx.createImageData(GW, GH); this.px = new Uint32Array(this.img.data.buffer);
    this.gv = mkc(GW2, GH2); this.gx = this.gv.getContext('2d'); this.gimg = this.gx.createImageData(GW2, GH2); this.gpx = new Uint32Array(this.gimg.data.buffer);
    this.gq = mkc(GW4, GH4); this.gqx = this.gq.getContext('2d'); this.gqx.imageSmoothingEnabled = true;
    this.ar = new Uint16Array(GW2 * GH2); this.ag = new Uint16Array(GW2 * GH2); this.ab = new Uint16Array(GW2 * GH2);
    this.tex = [0, 1, 2, 3].map((k) => fallbackTex(k + 1)); this.real = false;
    this.pulse = new Float32Array(64);
    this.reset(0);
  }
  // greebleworks' facades, as { w, h, data: Uint32Array, glow: Uint8Array }
  setTextures(list) {
    if (!list.length) return;
    this.tex = list; this.real = true;
    if (!this.hits) { for (let gx = 0; gx < GW; gx++) this.paint(gx); this.act.fill(2); } // nothing broken yet: repaint the city in its proper facades
  }
  reset(ax0) {
    this.t.fill(0); this.col.fill(0); this.life.fill(0); this.glow.fill(0);
    this.rng = mulberry32(((this.host.seed || 1) ^ 0x5a17d) >>> 0);
    this.c0 = Math.floor(ax0) - 120; this.genAx = this.c0 - 40; this.blds = []; this.ops = new Map();
    this.tips = []; this.front = []; this.parts = []; this.rechecks = []; this.tick = 0; this.hits = 0;
    this.plan(this.c0 + GW + 60);
    for (let gx = 0; gx < GW; gx++) this.paint(gx);
    this.act.fill(2);
  }
  R() { return this.rng(); }
  wake(x, y) { if (x >= 0 && x < GW && y >= 0 && y < GH) this.act[(y >> 4) * CW + (x >> 4)] = 2; }
  wakeRect(x0, y0, x1, y1) { for (let cy = Math.max(0, y0) >> 4; cy <= Math.min(GH - 1, y1) >> 4; cy++) for (let cx = Math.max(0, x0) >> 4; cx <= Math.min(GW - 1, x1) >> 4; cx++) this.act[cy * CW + cx] = 2; }

  // ---------------------------------------------------------------- the plan ahead
  op(ax, y, ty, c, g = 0, l = 0) { if (y < 0 || y >= GH - ROCKH) return; let a = this.ops.get(ax); if (!a) this.ops.set(ax, (a = [])); a.push(y, ty, c, g, l); }
  tone(T) { const hz = this.host.haze(T); return (r, g, b, k = 1) => pk((r + (hz[0] - r) * 0.3) * 0.78 * k, (g + (hz[1] - g) * 0.3) * 0.78 * k, (b + (hz[2] - b) * 0.3) * 0.78 * k); }
  plan(until) {
    const R = () => this.rng(), G = GH - ROCKH;
    while (this.genAx < until) {
      const ax = this.genAx, T = this.host.tAt(ax + 16), ruin = sstep(0.1, 0.62, T), bio = sstep(0.3, 0.9, T), tn = this.tone(T);
      let gap = 1 + Math.floor(R() * (3 + ruin * 5)) + (R() < 0.35 + ruin * 0.3 ? 4 + Math.floor(R() * 12) : 0);
      // between towers: heaps of rubble, then flowers, fungus and ooze as the place turns
      if (gap > 0) {
        if (ruin > 0.1) for (let x = 0; x < gap + 4; x++) { const hh = Math.floor(ruin * (3 + 9 * Math.sin(((x + 0.5) / (gap + 4)) * Math.PI)) * (0.6 + R() * 0.5)); for (let y = 0; y < hh; y++) { const v = 34 + R() * 30; this.op(ax - 2 + x, G - 1 - y, RUBBLE, tn(v * 1.1, v, v * 0.85)); } }
        if (bio > 0.12 && gap > 3 && R() < bio) this.fungus(ax + Math.floor(gap / 2) - 1, G - 1 - Math.floor(ruin * 6), bio, T);
        if (bio > 0.4 && R() < bio * 0.6) for (let x = 0; x < gap; x++) for (let y = 0; y < 2; y++) this.op(ax + x, G - 1 - Math.floor(ruin * 5) - y, OOZE, pk(120, 255, 90), 160);
      }
      const x0 = ax + gap;
      if (T > 0.82 && R() < (T - 0.82) * 3) { this.genAx = this.mound(x0, bio, T) + 1; continue; }
      const w = 12 + Math.floor(R() * 30), tall = 34 + Math.pow(R(), 1.1) * (G - 40), hgt = Math.max(14, Math.floor(tall * (1 - ruin * R() * 0.5)));
      const b = { x0, w, top: G - hgt, hgt, steps: [], ant: -1, antH: 0, tex: Math.floor(R() * 64), ox: Math.floor(R() * 64), oy: Math.floor(R() * 64), ruin: ruin * (0.6 + R() * 0.6), jagA: hgt * 0.4,
        bio: bio * (0.5 + R() * 0.7), fp: Math.floor(R() * 3), seed: Math.floor(R() * 1e6), dark: 0.8 + R() * 0.35, T };
      for (let s = 0, n = R() < 0.6 ? 1 + Math.floor(R() * 2) : 0, y = b.top; s < n; s++) { y += Math.floor(hgt * (0.12 + R() * 0.2)); const ins = 2 + Math.floor(R() * (w / 5)); if (w - ins * 2 > 6) b.steps.push([y, ins * (s + 1)]); }
      if (b.ruin < 0.35 && R() < 0.5) { b.ant = 3 + Math.floor(R() * (w - 6)); b.antH = 5 + Math.floor(R() * 16); }
      this.blds.push(b);
      // vines up its face
      if (b.bio > 0.1) for (let v = 0, nv = Math.floor(b.bio * 4 * R()) + (R() < b.bio ? 1 : 0); v < nv; v++) this.vine(x0 - 1 + Math.floor(R() * (w + 2)), G - 1, Math.floor(hgt * (0.3 + R() * 0.8) * b.bio), T);
      if (b.bio > 0.3 && R() < b.bio * 0.5) this.flowers(x0 + Math.floor(R() * w), G - 1, T);
      this.genAx = x0 + w;
    }
  }
  vine(ax, y, len, T) {
    const R = () => this.rng(), vc = VINES[Math.floor(R() * VINES.length)], k = 0.7 + T * 0.4;
    let x = ax, lean = R() < 0.5 ? -1 : 1;
    for (let s = 0; s < len; s++) {
      this.op(x, y, VINE, pk(vc[0] * k * (0.8 + R() * 0.4), vc[1] * k * (0.8 + R() * 0.4), vc[2] * k), 0);
      if (R() < 0.12) this.op(x + lean, y, VINE, pk(vc[0] * 1.2, vc[1] * 1.25, vc[2] * 1.1), 30);
      if (R() < 0.035) this.bloom(x + (R() < 0.5 ? -1 : 1), y, 1);
      y--; if (R() < 0.22) x += lean; if (R() < 0.08) lean = -lean;
    }
    this.bloom(x, y, R() < 0.5 ? 2 : 1);
  }
  bloom(ax, y, r) {
    const R = () => this.rng(), pc = PETALS[Math.floor(R() * PETALS.length)];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r + 1) continue; const core = !dx && !dy; this.op(ax + dx, y + dy, BLOOM, core ? pk(255, 250, 200) : pk(pc[0], pc[1], pc[2]), core ? 255 : 170); }
  }
  flowers(ax, y, T) { const R = () => this.rng(); for (let i = 0, n = 2 + Math.floor(R() * 4); i < n; i++) { const x = ax + Math.floor((R() - 0.5) * 10), h = 2 + Math.floor(R() * 8); for (let s = 0; s < h; s++) this.op(x, y - s, VINE, pk(40, 150 + R() * 40, 70)); this.bloom(x, y - h, R() < 0.3 ? 2 : 1); } }
  fungus(ax, base, bio, T) {
    const R = () => this.rng(), sw = 2 + Math.floor(R() * 3), sh = Math.floor((18 + R() * 100) * bio), cc = CAPS[Math.floor(R() * CAPS.length)];
    let x = ax;
    for (let s = 0; s < sh; s++) { for (let k = 0; k < sw; k++) { const v = 150 + R() * 40; this.op(x + k, base - s, STALK, pk(v, v * 0.92, v * 0.86), k === 1 && s % 6 < 2 ? 60 : 0); } if (R() < 0.05) x += R() < 0.5 ? -1 : 1; }
    this.cap(x + (sw >> 1), base - sh, 5 + sw + Math.floor(R() * 15 * bio), cc, (ax2, y, ty, c, g) => this.op(ax2, y, ty, c, g));
  }
  cap(cx, cy, rx, cc, put) {
    const R = () => this.rng(), ry = Math.max(3, Math.floor(rx * (0.35 + R() * 0.2))), sp = CAPS[Math.floor(R() * CAPS.length)];
    for (let dx = -rx; dx <= rx; dx++) {
      const hh = Math.floor(ry * Math.sqrt(Math.max(0, 1 - (dx * dx) / (rx * rx))));
      for (let dy = -hh; dy <= 1; dy++) {
        const rim = dy >= 0, spot = !rim && h2(cx + dx, cy + dy, 91) < 0.1, sh = 0.7 + 0.3 * (1 + dy / (hh + 1));
        put(cx + dx, cy + dy, CAP, rim ? pk(cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5) : spot ? pk(sp[0], sp[1], sp[2]) : pk(cc[0] * sh, cc[1] * sh, cc[2] * sh), rim ? 140 : spot ? 230 : 40);
      }
    }
  }
  // the far end: no towers left, a hill of flesh with the jungle on it
  mound(x0, bio, T) {
    const R = () => this.rng(), w = 30 + Math.floor(R() * 50), A = 10 + R() * 40, G = GH - ROCKH, fp = FLESHP[Math.floor(R() * 3)], sd = Math.floor(R() * 1e5);
    for (let x = 0; x < w; x++) {
      const hh = Math.floor(A * Math.pow(Math.sin(((x + 0.5) / w) * Math.PI), 0.7) * (0.85 + vn1(x0 + x, 5, sd) * 0.3));
      for (let y = 0; y < hh; y++) { const n = vn2(x0 + x, y, 4, sd), vein = Math.abs(vn2(x0 + x, y, 7, sd + 1) - 0.5) < 0.03; const c = vein ? fp[2] : n < 0.5 ? fp[0] : fp[1], k = 0.75 + n * 0.4; this.op(x0 + x, G - 1 - y, FLESH, pk(c[0] * k, c[1] * k, c[2] * k), vein ? 120 : 0); }
      if (R() < 0.25) for (let s = 0, gh = 1 + Math.floor(R() * 3); s < gh; s++) this.op(x0 + x, G - 1 - hh - s, VINE, pk(60, 200, 90));
      if (R() < 0.05) this.flowers(x0 + x, G - 1 - hh, T);
      if (R() < 0.03 && x > 6 && x < w - 6) this.fungus(x0 + x, G - 1 - hh, bio, T);
      if (R() < 0.04) this.vine(x0 + x, G - 1 - hh, 6 + Math.floor(R() * 30), T);
    }
    return x0 + w;
  }
  topAt(b, lx) {
    let top = b.top;
    for (const [sy, ins] of b.steps) if (lx < ins || lx >= b.w - ins) top = Math.max(top, sy);
    if (b.ruin > 0.05) top += Math.floor(b.ruin * b.jagA * (0.6 * vn1(b.x0 + lx, 4, b.seed) + 0.4 * h2(b.x0 + lx, 3, b.seed)));
    return top;
  }
  // one column of the grid, from the plan: road, towers, then everything grown or heaped in front of them
  paint(gx) {
    const ax = this.c0 + gx, t = this.t, col = this.col, life = this.life, glow = this.glow, G = GH - ROCKH;
    for (let y = 0; y < GH; y++) { const i = y * GW + gx; t[i] = E; col[i] = 0; life[i] = 0; glow[i] = 0; }
    for (let y = G; y < GH; y++) { const i = y * GW + gx, v = (y === G ? 40 : 22) + h2(ax, y, 5) * 10; t[i] = ROCK; col[i] = pk(v, v * 0.95, v * 0.9); }
    for (const b of this.blds) {
      const lx = ax - b.x0;
      if (lx < 0 || lx >= b.w) continue;
      const top = this.topAt(b, lx), T = this.tex[b.tex % this.tex.length], tn = this.tone(b.T), fp = FLESHP[b.fp], edge = lx === 0 || lx === b.w - 1;
      for (let y = Math.max(0, top); y < G; y++) {
        const i = y * GW + gx;
        if (b.ruin > 0.15 && y > top + 2 && vn2(ax, y, 6, b.seed + 11) > 1.02 - b.ruin * 0.35) continue; // blown out
        const ti = (((G - 1 - y + b.oy) % T.h) * T.w + ((lx + b.ox) % T.w)), c = T.data[ti], g = T.glow[ti];
        let k = b.dark * (edge ? 0.55 : y === top ? 1.25 : 1);
        if (b.ruin > 0.15 && vn2(ax, y, 6, b.seed + 11) > 0.94 - b.ruin * 0.35) k *= 0.45; // scorched round the holes
        t[i] = SOLID;
        if (b.bio > 0.05 && vn2(ax, y, 9, b.seed + 23) < b.bio * 0.5) {
          const L = (cR(c) * 0.3 + cG(c) * 0.59 + cB(c) * 0.11) / 255, a = L < 0.35 ? fp[0] : fp[1], z = L < 0.35 ? fp[1] : fp[2], q = Math.min(1, (L < 0.35 ? L / 0.35 : (L - 0.35) / 0.65));
          t[i] = FLESH; col[i] = pk(a[0] + (z[0] - a[0]) * q, a[1] + (z[1] - a[1]) * q, a[2] + (z[2] - a[2]) * q);
          if (g > 40) { glow[i] = 220; col[i] = b.fp === 2 ? pk(220, 255, 120) : pk(255, 210, 90); }
          continue;
        }
        col[i] = tn(cR(c), cG(c), cB(c), k);
        if (g > 40 && h2(ax, y, b.seed) > b.ruin * 1.3) { glow[i] = Math.min(255, g * 1.2); col[i] = pk(cR(c) * 1.1, cG(c) * 1.05, cB(c)); life[i] = h2(ax, y, b.seed + 2) < 0.04 ? 2 : 0; }
      }
      if (lx === b.ant) for (let y = top - b.antH; y < top; y++) { if (y < 0) continue; const i = y * GW + gx; t[i] = SOLID; col[i] = tn(40, 40, 44); if (y === top - b.antH) { glow[i] = 255; col[i] = pk(255, 40, 30); life[i] = 1; } }
    }
    const a = this.ops.get(ax);
    if (a) for (let k = 0; k < a.length; k += 5) { const i = a[k] * GW + gx; t[i] = a[k + 1]; col[i] = a[k + 2]; glow[i] = a[k + 3]; life[i] = a[k + 4]; }
  }
  // keep the grid under the view: shift it left and paint what comes in
  view(ax0, ax1) {
    if (ax0 < this.c0 - 60 || ax1 > this.c0 + GW + 200) return this.reset(ax0);
    if (this.c0 + GW >= ax1 + 24) return;
    const S = Math.min(GW, ax1 + 72 - (this.c0 + GW));
    for (let y = 0; y < GH; y++) {
      const r = y * GW;
      for (const a of [this.t, this.col, this.life, this.glow]) a.copyWithin(r, r + S, r + GW);
    }
    this.c0 += S;
    this.plan(this.c0 + GW + 60);
    for (let gx = GW - S; gx < GW; gx++) this.paint(gx);
    this.collapse(GW - S - 60, GW - 1); // a ruin painted with nothing left holding it up comes down
    this.act.fill(2);
    for (const k of this.ops.keys()) if (k < this.c0) this.ops.delete(k);
    this.blds = this.blds.filter((b) => b.x0 + b.w >= this.c0);
    this.tips = this.tips.filter((p) => p.x >= this.c0);
    this.front = this.front.filter((f) => f[0] >= this.c0);
  }
  // is anything solid at absolute column ax, row y? (an asteroid's path is traced through these)
  solidAt(ax, y) { const gx = ax - this.c0; if (gx < 0 || gx >= GW || y >= GH) return true; if (y < 0) return false; return !PASS[this.t[y * GW + gx]]; }
  surface(ax) {
    const gx = ax - this.c0; if (gx < 0 || gx >= GW) return GH - ROCKH;
    for (let y = 0, i = gx; y < GH; y++, i += GW) if (!PASS[this.t[i]]) return y;
    return GH - ROCKH;
  }

  // ---------------------------------------------------------------- the blast
  // a spore asteroid strikes the column ax: a crater of radius r, grains thrown, fire, spores, collapse
  impact(ax, r, bio, row = -1) {
    const gx = ax - this.c0, t = this.t, col = this.col, life = this.life, glow = this.glow, R = () => this.rng();
    if (gx < r + 2 || gx >= GW - r - 2) return null;
    this.hits++;
    const cy = Math.min(GH - ROCKH - 1, (row >= 0 ? row : this.surface(ax)) + Math.floor(r * 0.35));
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = gx + dx, y = cy + dy; if (y < 0 || y >= GH) continue;
      const d = Math.sqrt(dx * dx + dy * dy) / (r * (0.8 + h2(x, y, this.hits) * 0.35));
      if (d > 1) continue;
      const i = y * GW + x, ty = t[i];
      if (ty === ROCK || PASS[ty]) continue;
      const c = scl(col[i], 0.55), ang = Math.atan2(dy - r * 0.6, dx), sp = 0.6 + R() * 1.6;
      if (d < 0.6) {
        const q = R();
        if (q < 0.4) this.part(this.c0 + x + 0.5, y + 0.5, Math.cos(ang) * sp, Math.sin(ang) * sp - 0.6, R() < 0.7 ? SAND : RUBBLE, c);
        this.clear(i);
        if (q > 0.82) { t[i] = FIRE; life[i] = 150 + R() * 100; }
      } else {
        const q = R();
        if (q < 0.12) { t[i] = EMBER; life[i] = 160 + R() * 90; col[i] = pk(120, 40, 12); glow[i] = 200; }
        else if (q < 0.22) { this.part(this.c0 + x + 0.5, y + 0.5, Math.cos(ang) * sp * 0.6, Math.sin(ang) * sp * 0.6 - 0.4, SAND, c); this.clear(i); }
        else if (STRUCT[ty] || ty === RUBBLE) { t[i] = R() < 0.6 ? SAND : RUBBLE; col[i] = c; glow[i] = 0; life[i] = 0; }
      }
    }
    // smoke over the crater and spores everywhere, most of them glowing
    for (let k = 0; k < r * 5; k++) { const x = gx + Math.floor((R() - 0.5) * r * 2), y = cy - r - Math.floor(R() * r); if (y > 0 && t[y * GW + x] === E) { const i = y * GW + x, v = 30 + R() * 25; t[i] = SMOKE; life[i] = 100 + R() * 120; col[i] = pk(v, v * 0.9, v * 0.85); } }
    for (let k = 0; k < r * (3 + bio * 6); k++) { const a = -Math.PI * (0.1 + R() * 0.8), sp = 0.5 + R() * 2.2; this.part(ax + 0.5, cy - r * 0.5, Math.cos(a) * sp, Math.sin(a) * sp, SPORE, 0); }
    this.wakeRect(gx - r * 2, cy - r * 3, gx + r * 2, cy + r + 2);
    this.collapse(gx - 90, gx + 90);
    this.rechecks.push([gx, this.tick + 40], [gx, this.tick + 110]);
    // what the spores bring: growth at the rim, flesh creeping from it
    if (bio > 0.2) for (let k = 0, n = 1 + Math.floor(bio * 3 * R()); k < n; k++) this.sprout(gx + Math.floor((R() - 0.5) * r * 2.4), cy - r, bio);
    if (bio > 0.1) for (let k = 0; k < 10 + bio * 30; k++) { const x = gx + Math.floor((R() - 0.5) * r * 3), y = cy + Math.floor((R() - 0.5) * r * 3); if (x > 0 && x < GW && y > 0 && y < GH && t[y * GW + x] === SOLID) this.front.push([this.c0 + x, y]); }
    return { x: gx, y: cy };
  }
  clear(i) { this.t[i] = E; this.col[i] = 0; this.life[i] = 0; this.glow[i] = 0; }
  part(x, y, vx, vy, k, c) { if (this.parts.length < 900) this.parts.push({ x, y, vx, vy, k, c }); }
  // a growing tip on whatever surface is under (gx, y0): a vine, or (later on) a giant fungus stalk
  sprout(gx, y0, bio) {
    if (gx < 2 || gx >= GW - 4 || this.tips.length > 150) return;
    let y = Math.max(1, y0); while (y < GH - 1 && PASS[this.t[(y + 1) * GW + gx]]) y++;
    if (y >= GH - ROCKH || this.t[y * GW + gx] !== E) return;
    const R = () => this.rng(), stalk = bio > 0.45 && R() < 0.3, i = y * GW + gx, vc = VINES[Math.floor(R() * VINES.length)];
    this.t[i] = TIP; this.col[i] = pk(200, 255, 150); this.glow[i] = 200;
    this.tips.push({ x: this.c0 + gx, y, k: stalk ? 1 : 0, e: stalk ? 20 + R() * 70 * bio : 12 + R() * 50 * bio, lean: R() < 0.5 ? -1 : 1, rate: stalk ? 0.35 : 0.25 + R() * 0.25, vc, w: 2 + Math.floor(R() * 2), cc: CAPS[Math.floor(R() * CAPS.length)] });
  }
  // everything structural that is no longer joined to the ground (or the window's edge) falls
  collapse(lo, hi) {
    lo = Math.max(0, lo); hi = Math.min(GW - 1, hi);
    const t = this.t, vis = this.vis, q = this.queue;
    if (++this.gen > 65000) { vis.fill(0); this.gen = 1; }
    const g = this.gen; let qh = 0, qt = 0;
    for (let y = 0; y < GH; y++) for (let x = lo; x <= hi; x++) {
      const i = y * GW + x;
      const ty = t[i];
      if (STRUCT[ty] && (x === lo || x === hi || (y + 1 < GH && (t[i + GW] === ROCK || (PLANT[ty] && LOOSE[t[i + GW]]))))) { vis[i] = g; q[qt++] = i; }
    }
    while (qh < qt) {
      const i = q[qh++], x = i % GW;
      if (x > lo && STRUCT[t[i - 1]] && vis[i - 1] !== g) { vis[i - 1] = g; q[qt++] = i - 1; }
      if (x < hi && STRUCT[t[i + 1]] && vis[i + 1] !== g) { vis[i + 1] = g; q[qt++] = i + 1; }
      if (i >= GW && STRUCT[t[i - GW]] && vis[i - GW] !== g) { vis[i - GW] = g; q[qt++] = i - GW; }
      if (i + GW < N && STRUCT[t[i + GW]] && vis[i + GW] !== g) { vis[i + GW] = g; q[qt++] = i + GW; }
    }
    let n = 0;
    for (let y = 0; y < GH; y++) for (let x = lo; x <= hi; x++) { const i = y * GW + x; if (STRUCT[t[i]] && vis[i] !== g) { t[i] = FALL; this.life[i] = 0; this.act[(y >> 4) * CW + (x >> 4)] = 2; n++; } }
    return n;
  }

  // ---------------------------------------------------------------- the simulation, one tick over columns lo..hi
  step(lo, hi, bio) {
    const t = this.t, col = this.col, life = this.life, glow = this.glow, st = this.stamp, R = this.rng, act = this.act;
    const tk = (++this.tick) & 255;
    lo = Math.max(1, lo); hi = Math.min(GW - 2, hi);
    // a move wakes both ends' chunks, and the neighbours across a chunk's edge (what rested on it may go now)
    const wk = (i) => { const x = i % GW, y = (i / GW) | 0, c = (y >> 4) * CW + (x >> 4); act[c] = 2; if ((x & 15) === 0 && x > 0) act[c - 1] = 2; else if ((x & 15) === 15 && x < GW - 1) act[c + 1] = 2; if ((y & 15) === 0 && y > 0) act[c - CW] = 2; };
    const mv = (i, j) => {
      const a = t[i], c = col[i], l = life[i], g = glow[i];
      t[i] = t[j]; col[i] = col[j]; life[i] = life[j]; glow[i] = glow[j];
      t[j] = a; col[j] = c; life[j] = l; glow[j] = g; st[j] = tk; wk(i); wk(j);
    };
    for (let y = GH - 2; y >= 0; y--) {
      const ltr = ((y + this.tick) & 1) === 0, row = y * GW, crow = (y >> 4) * CW;
      for (let k = lo; k <= hi; k++) {
        const x = ltr ? k : lo + hi - k, ci = crow + (x >> 4);
        if (!act[ci]) { k += ltr ? 15 - (x & 15) : x & 15; continue; } // a sleeping chunk: skip the rest of it
        const i = row + x, ty = t[i];
        if (ty < RUBBLE || st[i] === tk) continue;
        const dn = i + GW;
        switch (ty) {
          case SAND: case OOZE: {
            if (PASS[t[dn]]) { mv(i, dn); break; }
            const d = R() < 0.5 ? 1 : -1;
            if (PASS[t[dn + d]] && PASS[t[i + d]]) mv(i, dn + d);
            else if (PASS[t[dn - d]] && PASS[t[i - d]]) mv(i, dn - d);
            else if (ty === OOZE) { if (t[i + d] === E) mv(i, i + d); else if (t[i - d] === E) mv(i, i - d); }
            break;
          }
          case RUBBLE: case EMBER: {
            if (ty === EMBER && (this.tick % 3) === 0) {
              const l = life[i] - 1;
              if (l <= 0) { t[i] = RUBBLE; glow[i] = 0; col[i] = pk(30, 26, 22); } else { life[i] = l; glow[i] = l; if (i >= GW && t[i - GW] === E && R() < 0.05) { t[i - GW] = FIRE; life[i - GW] = 60 + R() * 90; st[i - GW] = tk; } }
            }
            if (ty === EMBER) act[ci] = 2;
            if (PASS[t[dn]]) { mv(i, dn); break; }
            if (R() < 0.25) { const d = R() < 0.5 ? 1 : -1; if (PASS[t[dn + d]] && PASS[t[i + d]]) mv(i, dn + d); }
            else if ((PASS[t[dn + 1]] && PASS[t[i + 1]]) || (PASS[t[dn - 1]] && PASS[t[i - 1]])) act[ci] = 2; // could still slide
            break;
          }
          case FALL: {
            const b = t[dn];
            if (PASS[b]) {
              const l = life[i];
              if (l > 22 && dn + GW < N && PASS[t[dn + GW]]) { mv(i, dn + GW); life[dn + GW] = Math.min(255, l + 2); } else { mv(i, dn); life[dn] = Math.min(255, l + 1); }
              break;
            }
            // resting on the falling part below, or crushing down into loose debris a little at a time
            act[ci] = 2;
            if (b === FALL || (LOOSE[b] && R() > 0.3)) break;
            if (life[i] > 6 || LOOSE[b]) {
              const q = R();
              t[i] = q < 0.5 ? SAND : q < 0.95 ? RUBBLE : EMBER; col[i] = scl(col[i], 0.85); life[i] = t[i] === EMBER ? 140 : 0; glow[i] = t[i] === EMBER ? 140 : 0;
              if (i >= GW && t[i - GW] === E && R() < 0.05) { const v = 60 + R() * 30; t[i - GW] = SMOKE; life[i - GW] = 70; col[i - GW] = pk(v, v * 0.92, v * 0.8); st[i - GW] = tk; }
            } else { t[i] = SOLID; life[i] = 0; }
            break;
          }
          case FIRE: {
            act[ci] = 2;
            const l = life[i] - 2 - ((R() * 3) | 0);
            if (l <= 0) { if (R() < 0.45) { const v = 26 + R() * 20; t[i] = SMOKE; life[i] = 90 + R() * 80; col[i] = pk(v, v * 0.9, v * 0.85); glow[i] = 0; } else this.clear(i); break; }
            life[i] = l;
            if (y > 0 && R() < 0.55 && (t[i - GW] === E || t[i - GW] === SMOKE)) mv(i, i - GW);
            else { const d = R() < 0.5 ? 1 : -1; if (t[i + d] === E) mv(i, i + d); }
            break;
          }
          case SMOKE: {
            act[ci] = 2;
            if (--life[i] === 0) { this.clear(i); break; }
            if (y > 0 && R() < 0.6 && t[i - GW] === E) mv(i, i - GW);
            else if (R() < 0.3) { const d = R() < 0.5 ? 1 : -1; if (t[i + d] === E) mv(i, i + d); }
            break;
          }
          case SPORE: {
            act[ci] = 2;
            if ((this.tick & 1) && --life[i] === 0) { this.clear(i); break; }
            const r = R();
            if (r < 0.3) { if (PASS[t[dn]] && t[dn] !== SPORE) mv(i, dn); else if (!PASS[t[dn]] && t[dn] !== FIRE && R() < 0.02 * bio) { this.clear(i); this.sprout(x, y, bio); } }
            else if (r < 0.5) { const d = R() < 0.5 ? 1 : -1; if (t[i + d] === E) mv(i, i + d); }
            break;
          }
        }
      }
    }
    for (let cy = 0; cy < CH; cy++) for (let cx = lo >> 4, c = cy * CW + cx; cx <= hi >> 4; cx++, c++) if (act[c]) act[c]--;
    this.particles(); this.grow(bio); this.infect(bio);
    for (let k = this.rechecks.length - 1; k >= 0; k--) { const r = this.rechecks[k]; if (this.tick >= r[1]) { this.collapse(r[0] - 90, r[0] + 90); this.rechecks.splice(k, 1); } }
    // the spore rain, once the change is under way: drifting down out of the sky, seeding what it lands on
    if (bio > 0.15 && R() < bio * 0.35) { const x = lo + Math.floor(R() * (hi - lo)); if (t[x] === E) { t[x] = SPORE; life[x] = 200 + R() * 55; act[x >> 4] = 2; } }
  }
  particles() {
    const t = this.t, ps = this.parts, c0 = this.c0;
    for (let k = ps.length - 1; k >= 0; k--) {
      const p = ps[k], n = Math.abs(p.vx) + Math.abs(p.vy) > 1.5 ? 2 : 1;
      let dead = false;
      for (let s = 0; s < n && !dead; s++) {
        const px = p.x, py = p.y;
        p.vy += 0.09 / n; p.x += p.vx / n; p.y += p.vy / n;
        const gx = Math.floor(p.x) - c0, gy = Math.floor(p.y);
        if (gx < 0 || gx >= GW || gy >= GH) { dead = true; break; }
        if (gy < 0) continue;
        const j = gy * GW + gx;
        if (!PASS[t[j]]) {
          const ox = Math.floor(px) - c0, oy = Math.floor(py);
          if (ox >= 0 && ox < GW && oy >= 0 && oy < GH) { const i = oy * GW + ox; if (t[i] === E) { t[i] = p.k; this.col[i] = p.c; this.life[i] = p.k === SPORE ? 220 : 0; this.glow[i] = 0; this.wake(ox, oy); } }
          dead = true;
        }
      }
      if (dead) { ps[k] = ps[ps.length - 1]; ps.pop(); }
    }
  }
  grow(bio) {
    const t = this.t, col = this.col, glow = this.glow, R = this.rng, tips = this.tips;
    for (let k = tips.length - 1; k >= 0; k--) {
      const p = tips[k], gx = p.x - this.c0;
      const drop = () => { tips[k] = tips[tips.length - 1]; tips.pop(); };
      if (gx < 2 || gx >= GW - 4) { drop(); continue; }
      const i = p.y * GW + gx;
      if (t[i] !== TIP) { drop(); continue; }
      if (R() > p.rate) continue;
      const vc = p.vc, body = pk(vc[0] * (0.8 + R() * 0.4), vc[1] * (0.8 + R() * 0.4), vc[2]);
      if (p.k === 0) {
        const opts = [[0, -1], [0, -1], [0, -1], [p.lean, -1], [-p.lean, -1], [p.lean, 0], [-p.lean, 0]];
        let ok = -1;
        for (let a = 0; a < 4 && ok < 0; a++) { const o = opts[Math.floor(R() * opts.length)], x = gx + o[0], y = p.y + o[1]; if (y > 0 && x > 1 && x < GW - 2 && t[y * GW + x] === E) ok = y * GW + x; }
        t[i] = VINE; col[i] = body; glow[i] = 0;
        if (ok < 0 || --p.e <= 0) { this.liveBloom(gx, p.y, R() < 0.5 ? 2 : 1); drop(); continue; }
        t[ok] = TIP; col[ok] = pk(200, 255, 150); glow[ok] = 200; p.x = this.c0 + (ok % GW); p.y = (ok / GW) | 0;
        if (R() < 0.05 && tips.length < 150) { const fx = (ok % GW) - p.lean, fj = ok - p.lean; if (fx > 1 && fx < GW - 2 && t[fj] === E) { t[fj] = TIP; col[fj] = pk(200, 255, 150); glow[fj] = 200; tips.push({ ...p, lean: -p.lean, e: p.e * 0.6, x: this.c0 + fx, y: p.y }); } }
        if (R() < 0.03) this.liveBloom(gx + p.lean, p.y, 1);
        if (R() < 0.08) p.lean = -p.lean;
      } else {
        let free = p.y > 2;
        for (let w = 0; w < p.w && free; w++) if (t[(p.y - 1) * GW + gx + w] !== E) free = false;
        for (let w = 0; w < p.w; w++) { const j = p.y * GW + gx + w; if (t[j] === E || t[j] === TIP) { const v = 150 + R() * 40; t[j] = STALK; col[j] = pk(v, v * 0.92, v * 0.86); glow[j] = 0; } }
        if (!free || --p.e <= 0) { this.cap(gx + (p.w >> 1), p.y - 1, 4 + p.w + Math.floor(R() * 12 * bio), p.cc, (x, y, ty, c, g) => { if (x < 1 || x >= GW - 1 || y < 0 || y >= GH) return; const j = y * GW + x; if (PASS[t[j]]) { t[j] = ty; col[j] = c; glow[j] = g; this.life[j] = 0; } }); drop(); continue; }
        p.y--; const j = p.y * GW + gx; t[j] = TIP; col[j] = pk(240, 230, 210); glow[j] = 120;
      }
    }
  }
  liveBloom(gx, y, r) {
    const R = this.rng, pc = PETALS[Math.floor(R() * PETALS.length)];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + 1) continue;
      const x = gx + dx, yy = y + dy; if (x < 1 || x >= GW - 1 || yy < 0 || yy >= GH) continue;
      const j = yy * GW + x; if (!PASS[this.t[j]] && this.t[j] !== VINE) continue;
      const core = !dx && !dy; this.t[j] = BLOOM; this.col[j] = core ? pk(255, 250, 200) : pk(pc[0], pc[1], pc[2]); this.glow[j] = core ? 255 : 170; this.life[j] = 0;
    }
  }
  infect(bio) {
    const F = this.front; if (!F.length || bio <= 0) return;
    const t = this.t, col = this.col, R = this.rng, n = Math.min(F.length, 6 + Math.floor(bio * 30));
    for (let k = 0; k < n && F.length; k++) {
      const q = Math.floor(R() * F.length), f = F[q], gx = f[0] - this.c0;
      if (gx < 1 || gx >= GW - 1) { F[q] = F[F.length - 1]; F.pop(); continue; }
      const d = Math.floor(R() * 4), x = gx + (d === 0 ? 1 : d === 1 ? -1 : 0), y = f[1] + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (y >= 0 && y < GH) {
        const j = y * GW + x;
        if (t[j] === SOLID && R() < 0.2 + bio * 0.6) {
          const c = col[j], L = (cR(c) * 0.3 + cG(c) * 0.59 + cB(c) * 0.11) / 255, fp = FLESHP[(((f[0] >> 6) % 3) + 3) % 3], a = L < 0.3 ? fp[0] : fp[1], z = L < 0.3 ? fp[1] : fp[2], u = Math.min(1, L < 0.3 ? L / 0.3 : (L - 0.3) / 0.7);
          t[j] = FLESH; col[j] = pk(a[0] + (z[0] - a[0]) * u, a[1] + (z[1] - a[1]) * u, a[2] + (z[2] - a[2]) * u);
          if (this.glow[j]) { this.glow[j] = 230; col[j] = pk(255, 210, 90); }
          if (F.length < 600) F.push([this.c0 + x, y]);
        }
      }
      if (R() < 0.25) { F[q] = F[F.length - 1]; F.pop(); }
    }
  }

  // ---------------------------------------------------------------- the picture: the grains, and their glow at half size
  render(lo, hi, time, lightK) {
    lo = Math.max(0, lo & ~3); hi = Math.min(GW - 1, hi | 3);
    const t = this.t, col = this.col, life = this.life, glow = this.glow, px = this.px, ar = this.ar, ag = this.ag, ab = this.ab, pu = this.pulse;
    for (let k = 0; k < 64; k++) pu[k] = 0.82 + 0.18 * Math.sin(time * 2.4 + k * 0.196);
    const g0 = lo >> 1, g1 = hi >> 1;
    for (let y = 0; y < GH2; y++) { const r = y * GW2; ar.fill(0, r + g0, r + g1 + 1); ag.fill(0, r + g0, r + g1 + 1); ab.fill(0, r + g0, r + g1 + 1); }
    const blink = Math.sin(time * 3) > 0.6 ? 1 : 0.15, sp = 0.6 + 0.4 * Math.sin(time * 5);
    for (let y = 0; y < GH; y++) {
      const row = y * GW, grow = (y >> 1) * GW2;
      for (let x = lo; x <= hi; x++) {
        const i = row + x, ty = t[i];
        if (ty === E) { px[i] = 0; continue; }
        let c, gc = 0, gk = 0;
        if (ty === FIRE) { const l = life[i]; c = FIRE_LUT[l]; gc = FIRE_GLOW[l]; gk = 1; }
        else if (ty === SMOKE) { const a = life[i] * 1.3; c = (col[i] & 0xffffff) | ((a > 150 ? 150 : a | 0) << 24); c >>>= 0; }
        else if (ty === SPORE) { const v = ((x * 7 + y * 3) & 3); c = v === 0 ? pk(200, 255, 120) : v === 1 ? pk(255, 120, 230) : v === 2 ? pk(120, 255, 240) : pk(255, 230, 120); gc = c; gk = sp; }
        else if (ty === FLESH) { const k = pu[(x + y * 2) & 63]; c = scl(col[i], k); if (glow[i]) { gc = col[i]; gk = (glow[i] / 255) * k * k; } }
        else { c = col[i]; const g = glow[i]; if (g) { gc = c; const l = life[i]; gk = (g / 255) * (l === 1 ? blink : l === 2 ? (h2(x, (time * 9) | 0, y) < 0.4 ? 0.1 : 1) : lightK); } }
        px[i] = c;
        if (gk > 0) { const gi = grow + (x >> 1); ar[gi] += cR(gc) * gk; ag[gi] += cG(gc) * gk; ab[gi] += cB(gc) * gk; }
      }
    }
    for (const p of this.parts) {
      const gx = Math.floor(p.x) - this.c0, gy = Math.floor(p.y);
      if (gx < lo || gx > hi || gy < 0 || gy >= GH) continue;
      const i = gy * GW + gx;
      if (p.k === SPORE) { px[i] = pk(220, 255, 150); const gi = (gy >> 1) * GW2 + (gx >> 1); ar[gi] += 120; ag[gi] += 200; ab[gi] += 120; } else px[i] = p.c;
    }
    const gpx = this.gpx;
    for (let y = 0; y < GH2; y++) for (let x = g0; x <= g1; x++) { const i = y * GW2 + x, r = ar[i] >> 1, g = ag[i] >> 1, b = ab[i] >> 1; gpx[i] = r | g | b ? pk(r, g, b) : 0; }
    this.cx.putImageData(this.img, 0, 0, lo, 0, hi - lo + 1, GH);
    this.gx.putImageData(this.gimg, 0, 0, g0, 0, g1 - g0 + 1, GH2);
    this.gqx.clearRect(g0 >> 1, 0, ((g1 - g0) >> 1) + 2, GH4);
    this.gqx.drawImage(this.gv, g0, 0, g1 - g0 + 1, GH2, g0 >> 1, 0, (g1 - g0 + 1) >> 1, GH4);
    this.lo = lo; this.hi = hi;
  }
  // the grains at (sx, sy) = the screen position of grid cell (0, 0)
  draw(c, sx, sy) {
    const lo = this.lo, w = this.hi - lo + 1;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.cv, lo, 0, w, GH, sx + lo * CS, sy, w * CS, GH * CS);
  }
  drawGlow(c, sx, sy, a = 1) {
    const g0 = this.lo >> 1, gw = (this.hi - this.lo + 1) >> 1;
    c.save(); c.globalCompositeOperation = 'lighter'; c.imageSmoothingEnabled = true;
    c.globalAlpha = 0.4 * a; c.drawImage(this.gv, g0, 0, gw, GH2, sx + g0 * 2 * CS, sy, gw * 2 * CS, GH2 * 2 * CS);
    c.globalAlpha = 0.65 * a; c.drawImage(this.gq, g0 >> 1, 0, gw >> 1, GH4, sx + g0 * 2 * CS, sy, gw * 2 * CS, GH4 * 4 * CS);
    c.restore();
  }
}
