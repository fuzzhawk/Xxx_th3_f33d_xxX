// Bladeview: a slow camera somewhere in a vertical city of stacked blocks, ten levels deep, from the
// rooftop gardens down through the sky lanes, the stacks and the walkways to the street, the
// undercity, the works and the sewers. Each card is a new place; a tap moves the camera on.
//
// The city round the camera is built for each view: a canyon of brutalist blocks faced with
// greebleworks facades (bladeview-art.js), shacks and cages and air conditioners bolted on, neon
// signs, walkways and bridges at every height, wires slung between the blocks. Spinners and cars move
// in their lanes, small people walk the walkways in their coats and hoods, steam rises, searchlights
// sweep, refinery flares burn on the far towers. Rain, fog, smog, ash and the hour (night, a sunset,
// a grey dawn) set the mood. The billboards run slow simulations (Life, Langton's ant, rule 110,
// Brian's brain); the ad panels crawl with Markov-chain poetry, all kept dim.
//
// Drawn with three.js at 192×224, unlit (shade and light baked into vertex colours, glows added),
// then read back and finished in 2D: quantised and Bayer-dithered, a little grain, a vignette.
import * as A from './bladeview-art.js';
import { mulberry32 } from './util.js';

let T = null, threeP = null;
const loadThree = () => (threeP ||= import('./vendor/three.module.min.js').then((m) => (T = m)));
const W = 360, H = 420, RW = 192, RH = 224, FOV = 58;
let RR = null;
function renderer() {
  if (RR && !RR.lost) return RR;
  const cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
  const r = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(RW, RH, false); r.outputColorSpace = T.LinearSRGBColorSpace;
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r.lost = true; });
  RR = r; return r;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LEVELS_Q = 18, BQ = BAYER.map((b) => (b / 16 - 0.5) * LEVELS_Q);
// one table per hour: [offset bucket][channel][value] → graded, dithered, quantised value
function gradeLut(hour) {
  const gr = hour === 'dusk' ? [1.08, 0.94, 0.86] : hour === 'dawn' ? [0.98, 1, 1.03] : [0.9, 0.98, 1.1], NB = 48, t = new Uint8Array(NB * 768);
  for (let o = 0; o < NB; o++) for (let ch = 0; ch < 3; ch++) for (let val = 0; val < 256; val++) t[o * 768 + ch * 256 + val] = clamp(Math.round((val * gr[ch] * 1.08 + 5 + (o + 0.5) / 2 - 12) / LEVELS_Q) * LEVELS_Q, 0, 255);
  return { hour, t };
}

// ------------------------------------------------ the ten levels
// kind decides the shape of the place: a sewer tunnel, the works' hall, a street (under a slab in
// the undercity), a walkway in the canyon, an open sky lane, a gantry, a ledge on a spire, a roof
export const LEVELS = [
  { name: 'The Sewers', kind: 'tunnel', styles: ['boiler', 'undercity', 'industrial'], pal: 'rust', under: 1, cw: 9 },
  { name: 'The Works', kind: 'hall', styles: ['industrial', 'reactor', 'boiler', 'refinery'], pal: 'rust', under: 1, cw: 30 },
  { name: 'Undercity', kind: 'street', styles: ['undercity', 'market', 'slum'], pal: 'sodium', under: 1, slab: 1, cw: 14 },
  { name: 'Street Level', kind: 'street', styles: ['slum', 'market', 'kowloon', 'hab'], pal: 'sodium', cw: 16 },
  { name: 'Lower Walkways', kind: 'walkway', styles: ['kowloon', 'hab', 'slum'], pal: 'sodium', cw: 10 },
  { name: 'The Stacks', kind: 'walkway', styles: ['kowloon', 'hab', 'residential', 'brutalist'], pal: 'chrome', cw: 12 },
  { name: 'Sky Lanes', kind: 'lane', styles: ['brutalist', 'hab', 'megacorp', 'arcology'], pal: 'chrome', cw: 44 },
  { name: 'High Gantries', kind: 'gantry', styles: ['brutalist', 'industrial', 'refinery', 'megacorp'], pal: 'chrome', cw: 16 },
  { name: 'The Spires', kind: 'ledge', styles: ['megacorp', 'arcology', 'brutalist'], pal: 'chrome', cw: 30 },
  { name: 'Rooftop Gardens', kind: 'roof', styles: ['residential', 'brutalist', 'kowloon'], pal: 'sodium', cw: 0 }
];
const MOODS = { night: ['voidnight', 'coldrain', 'monsoon', 'magnetar', 'eclipse', 'coldrain'], dusk: ['bloodrise', 'smog', 'emberstorm', 'toxicdusk'], dawn: ['ashfall', 'dustveil', 'nuclearwinter', 'acidmist'] };
const WEATHER = { rain: { rain: 1, fog: 0.022 }, drizzle: { rain: 0.45, fog: 0.018 }, storm: { rain: 1.6, fog: 0.026, lightning: 1 }, fog: { rain: 0, fog: 0.04 }, smog: { rain: 0, fog: 0.034 }, clear: { rain: 0, fog: 0.011 }, ash: { rain: 0, fog: 0.028, ash: 1 } };
const WNAME = { rain: 'acid rain', drizzle: 'drizzle', storm: 'storm', fog: 'fog', smog: 'smog', clear: 'clear', ash: 'ashfall' };

// ------------------------------------------------ geometry batches: quads per material, merged
class Batch {
  constructor() { this.p = []; this.uv = []; this.c = []; this.i = []; this.n = 0; }
  quad(a, b, c, d, u0, v0, u1, v1, ka = 1, kb = ka, kc = ka, kd = ka, tint = [1, 1, 1]) {
    this.p.push(...a, ...b, ...c, ...d); this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (const k of [ka, kb, kc, kd]) this.c.push(k * tint[0], k * tint[1], k * tint[2]);
    const n = this.n; this.i.push(n, n + 1, n + 2, n, n + 2, n + 3); this.n += 4;
  }
  mesh(mat) {
    if (!this.n) return null;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i);
    return new T.Mesh(g, mat);
  }
}
// a box's faces into a batch, the texture tiling at a fixed density (one tile = 6 m), shaded by height
function box(B, x0, x1, y0, y1, z0, z1, shade, tint, faces = 'all', S = 6) {
  const k = (y) => shade(y), U = (a) => a / S;
  const f = faces === 'all' ? ['px', 'nx', 'pz', 'nz', 'py'] : faces;
  if (f.includes('nx')) B.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], U(z1), U(y0), U(z0), U(y1), k(y0), k(y0), k(y1), k(y1), tint);
  if (f.includes('px')) B.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], U(z0), U(y0), U(z1), U(y1), k(y0), k(y0), k(y1), k(y1), tint);
  if (f.includes('nz')) B.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], U(x0), U(y0), U(x1), U(y1), k(y0), k(y0), k(y1), k(y1), tint);
  if (f.includes('pz')) B.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], U(x1), U(y0), U(x0), U(y1), k(y0), k(y0), k(y1), k(y1), tint);
  if (f.includes('py')) { const kk = k(y1) * 0.7; B.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], U(x0), U(z0), U(x1), U(z1), kk, kk, kk, kk, tint); }
  if (f.includes('ny')) { const kk = k(y0) * 0.5; B.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], U(x0), U(z1), U(x1), U(z0), kk, kk, kk, kk, tint); }
}

// ------------------------------------------------ the view
export class BladeView {
  constructor(canvas, onInfo) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.onInfo = onInfo;
    this.buf = document.createElement('canvas'); this.buf.width = RW; this.buf.height = RH; this.bc = this.buf.getContext('2d', { willReadFrequently: true });
    this.running = false; this.t = 0; this.seed = (Math.random() * 2 ** 31) | 0; this.view = null; this.gl = null; this.state = 'load'; this.fade = 0;
  }
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    Promise.all([loadThree(), A.loadGen()]).then(({ 1: g }) => { this.G = g; if (!this.view) this.go(this.seed); }).catch((e) => { this.failed = String(e?.message || e); });
    const loop = (now) => { if (!this.running) return; try { this.frame(now); } catch (e) { if (!this.warned) { this.warned = 1; console.error(e); } } this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() { this.stop(); this.free(); }
  tap() { if (this.state === 'live' || this.state === 'load') { this.seed = (this.seed * 1103515245 + 12345 + ((Math.random() * 1e6) | 0)) >>> 0; this.next = this.seed; this.state = 'out'; this.fade = 0; } }

  // ------------------------------------------------ choosing a place
  plan(seed) {
    const R = mulberry32(seed), lv0 = Math.floor(R() * LEVELS.length), lv = this.forceLv ?? lv0, L = LEVELS[lv];   // forceLv: for tests
    const hour = L.under ? 'night' : R() < 0.55 ? 'night' : R() < 0.7 ? 'dusk' : 'dawn';
    const wk = L.under ? (lv === 0 ? 'fog' : R() < 0.5 ? 'smog' : 'drizzle') : ['rain', 'rain', 'drizzle', 'storm', 'fog', 'smog', 'clear', 'ash'][Math.floor(R() * 8)];
    const mood = MOODS[hour][Math.floor(R() * MOODS[hour].length)];
    const pal = L.pal === 'chrome' && hour === 'dusk' ? 'sodium' : L.pal;
    const styles = [...L.styles].sort(() => R() - 0.5).slice(0, 3);
    const cam = L.kind === 'tunnel' ? 'dolly' : L.kind === 'roof' ? (R() < 0.5 ? 'pan' : 'drift') : ['dolly', 'dolly', 'crane', 'pan', 'drift'][Math.floor(R() * 5)];
    return { seed, R, lv, L, hour, wk, W: WEATHER[wk], mood, pal, styles, cam, clock: `${String(hour === 'night' ? [23, 0, 1, 2, 3, 4][Math.floor(R() * 6)] : hour === 'dusk' ? 19 + Math.floor(R() * 2) : 5 + Math.floor(R() * 2)).padStart(2, '0')}:${String(Math.floor(R() * 60)).padStart(2, '0')}`,
      // one or two of Vitriol's abominations idling in the sky, in about half the open views
      abom: L.under ? 0 : R() < ({ roof: 0.6, ledge: 0.6, lane: 0.6, gantry: 0.5 }[L.kind] ?? 0.4) ? (R() < 0.3 ? 2 : 1) : 0 };
  }
  go(seed) {
    const v = this.plan(seed), { GW, MF, CF } = this.G;
    // everything this place needs, baked a slice at a time while the last one fades
    v.walls = v.styles.flatMap((s, k) => [A.facade(GW, s, v.pal, (seed + k * 7919) >>> 0), A.facade(GW, s, v.pal, (seed + k * 7919 + 31) >>> 0)]);
    v.plat = A.platform(GW, v.styles[0], v.pal, (seed ^ 0x51) >>> 0);
    v.skyJob = v.L.under ? null : A.sky(GW, v.mood, v.pal, (seed ^ 0x77) >>> 0);
    v.people = Array.from({ length: 8 }, (_, k) => A.citizen(MF, ((seed % 997) * 13 + k * 101) % 4000 + 1));
    v.aboms = Array.from({ length: v.abom }, (_, k) => A.abomination(CF, ((seed % 389) * 7 + k * 313) % 600 + 1));
    this.pending = v; this.state = this.view ? 'out' : 'load';
  }
  ready(v) { return [...v.walls, v.plat, v.skyJob, ...v.people, ...v.aboms].every((j) => !j || j.done); }

  // ------------------------------------------------ building the place
  free() {
    const gl = this.gl; this.gl = null;
    if (!gl) return;
    const seen = new Set(), f = (o) => { if (o && !seen.has(o)) { seen.add(o); o.dispose?.(); } };
    gl.scene.traverse((o) => { f(o.geometry); if (o.material) { f(o.material); f(o.material.map); } });
    for (const t of gl.tex) f(t);
  }
  tex(gl, cv, rep = true) { const t = new T.CanvasTexture(cv); t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; if (rep) t.wrapS = t.wrapT = T.RepeatWrapping; gl.tex.push(t); return t; }
  build(v) {
    this.free();
    const R = mulberry32((v.seed ^ 0xb1ad) >>> 0), L = v.L, kind = L.kind, sc = new T.Scene(), rr = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rr(a, b + 1)), pick = (a) => a[Math.floor(R() * a.length)];
    const gl = (this.gl = { scene: sc, tex: [], movers: [], cars: [], people: [], glows: [], sims: [], crawls: [], signs: [], puffs: [], cones: [], flares: [] });
    gl.camZ = kind === 'roof' ? rr(-10, 10) : rr(0, 30);
    // the air: fog in the colour of the horizon (or the dark underground), denser with the weather
    const fogCol = new T.Color(L.under ? (kind === 'tunnel' ? 0x161812 : 0x2a1d14) : v.hour === 'dusk' ? 0x3a2418 : v.hour === 'dawn' ? 0x34363a : 0x10141a);
    if (!L.under && v.skyJob?.out) { const c = v.skyJob.out.getContext('2d', { willReadFrequently: true }).getImageData(0, Math.floor(v.skyJob.out.height * 0.6), 1, 1).data, lu = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255, k = Math.min(0.5, 0.2 / Math.max(0.05, lu)); fogCol.setRGB(c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k); }
    sc.fog = new T.FogExp2(fogCol, v.W.fog * (kind === 'roof' || kind === 'ledge' ? 0.55 : kind === 'lane' || kind === 'gantry' || kind === 'hall' ? 0.66 : 0.85));
    sc.background = fogCol.clone();
    gl.fogBase = v.W.fog; gl.fogCol = fogCol.clone();
    const mats = v.walls.filter((j) => j.out).map((j) => new T.MeshBasicMaterial({ map: this.tex(gl, j.out), vertexColors: true, side: T.DoubleSide }));
    if (!mats.length) mats.push(new T.MeshBasicMaterial({ color: 0x4a4640, vertexColors: true, side: T.DoubleSide }));
    const platMat = new T.MeshBasicMaterial({ map: v.plat.out ? this.tex(gl, v.plat.out) : null, color: v.plat.out ? 0xffffff : 0x3a3834, vertexColors: true, side: T.DoubleSide });
    const dark = new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: T.DoubleSide });
    const batches = mats.map(() => new Batch()), pb = new Batch(), db = new Batch();
    // the sky: greebleworks' sky with its far city, wrapped round
    if (!L.under && v.skyJob?.out) {
      const t = this.tex(gl, v.skyJob.out); t.wrapT = T.ClampToEdgeWrapping; t.repeat.set(3, 1);
      const sky = new T.Mesh(new T.CylinderGeometry(500, 500, 420, 24, 1, true), new T.MeshBasicMaterial({ map: t, side: T.BackSide, fog: false, depthWrite: false }));
      sky.position.y = kind === 'roof' || kind === 'ledge' ? 40 : 110; sky.renderOrder = -2; sc.add(sky); gl.sky = sky;
    }
    // how light falls: dark low in the canyon, paler toward the sky; underground, all dim
    const span = kind === 'lane' || kind === 'ledge' ? 160 : 120, low = kind === 'roof' ? -40 : kind === 'ledge' ? -120 : -60;
    const shade = (y) => (L.under ? 0.42 + clamp((y + 4) / 30, 0, 1) * 0.24 : clamp(0.26 + ((y - low) / span) * (v.hour === 'night' ? 0.7 : 0.85), 0.18, 1.1));
    const tintOf = () => { const k = rr(0.82, 1.08); return v.hour === 'dusk' ? [k * 1.08, k * 0.92, k * 0.82] : v.hour === 'dawn' ? [k * 0.95, k * 0.98, k * 1.04] : [k * 0.86, k * 0.94, k * 1.08]; };
    const cw = L.cw, half = cw / 2;
    // ---- the blocks either side of the canyon (and a second, taller row behind)
    const floors = { tunnel: 0, hall: 0, street: 0, walkway: -26, lane: -90, gantry: -70, ledge: -150, roof: -18 }[kind];
    const tops = { tunnel: 8, hall: 34, street: L.slab ? 14 : 90, walkway: 110, lane: 160, gantry: 140, ledge: 220, roof: 2 }[kind];
    gl.blocks = [];
    if (kind !== 'tunnel' && kind !== 'roof') {
      for (const side of [-1, 1]) for (const row of [0, 1]) {
        let z = -60;
        while (z < 300) {
          const len = rr(8, 24), gap = R() < 0.3 ? rr(2, 6) : 0.2, dep = rr(10, 22), top = row ? tops * rr(1.1, 1.7) : L.slab ? tops : tops * rr(0.55, 1.15) + rr(-10, 10);
          const xi = side * (half + row * (dep + rr(6, 30))), xo = xi + side * dep, x0 = Math.min(xi, xo), x1 = Math.max(xi, xo), m = (R() * mats.length) | 0;
          box(batches[m], x0, x1, floors - (kind === 'hall' ? 0 : 40), top, z, z + len, shade, tintOf(), row ? ['nz', 'pz', side < 0 ? 'px' : 'nx', 'py'] : 'all');
          gl.blocks.push({ side, row, xi, z0: z, z1: z + len, top });
          z += len + gap;
        }
      }
    }
    // in the sky lanes and round the spires, towers stand out in the open, the traffic weaving past
    if (kind === 'lane' || kind === 'ledge') for (let z = kind === 'lane' ? gl.camZ + rr(16, 28) : rr(70, 100); z < 300; z += kind === 'lane' ? rr(14, 30) : rr(40, 70)) {
      const w = rr(6, 10), x = (R() < 0.5 ? -1 : 1) * rr(Math.min(w / 2 + 5, half - 7), half - 6), m = (R() * mats.length) | 0, d = rr(8, 14);
      box(batches[m], x - w / 2, x + w / 2, floors - 40, rr(tops * 0.4, tops * 0.9), z, z + d, shade, tintOf());
      for (let q = 0; q < 18; q++) gl.glows.push([q % 6 ? 'window' : 'sign', x + (R() < 0.5 ? -w / 2 - 0.2 : w / 2 + 0.2), rr(-40, 70), z + rr(0, d)]);
    }
    // ---- the floor, the slab overhead, the tunnel, the hall
    if (kind === 'street') {
      // wet asphalt down the middle, a raised pavement either side
      box(db, -half, half, -0.4, 0, -60, 300, () => 0.22, [0.6, 0.62, 0.7], ['py']);
      for (const s of [-1, 1]) box(pb, s < 0 ? -half : half - 3, s < 0 ? -half + 3 : half, -0.2, 0.18, -60, 300, () => 0.42, [1, 1, 1], ['py', s < 0 ? 'px' : 'nx']);
      if (L.slab) box(batches[0], -half - 30, half + 30, 14, 18, -60, 300, () => 0.2, [0.7, 0.7, 0.75], ['ny']);
    } else if (kind === 'tunnel') {
      // a brick barrel vault over a black channel of water, a walkway either side
      const NA = 12;
      for (let z = -40; z < 220; z += 4) for (let a = 0; a < NA; a++) {
        const a0 = Math.PI * (a / NA), a1 = Math.PI * ((a + 1) / NA), r = 6.5, P = (an, zz) => [Math.cos(an) * r, 1 + Math.sin(an) * r * 0.9, zz];
        const k0 = 0.3 + Math.sin(a0) * 0.15, k1 = 0.3 + Math.sin(a1) * 0.15;
        batches[0].quad(P(a0, z), P(a0, z + 4), P(a1, z + 4), P(a1, z), z / 6, a0 * 2, (z + 4) / 6, a1 * 2, k0, k0, k1, k1, [0.95, 0.85, 0.75]);
      }
      box(db, -2.6, 2.6, -1.6, -1.2, -40, 220, () => 0.14, [0.5, 0.6, 0.55], ['py']);
      for (const s of [-1, 1]) box(pb, s < 0 ? -6.4 : 2.6, s < 0 ? -2.6 : 6.4, -1.2, 0, -40, 220, () => 0.36, [1, 0.95, 0.9], ['py', s < 0 ? 'px' : 'nx']);
    } else if (kind === 'hall') {
      for (const s of [-1, 1]) box(batches[1 % batches.length], s * half - (s < 0 ? 4 : 0), s * half + (s > 0 ? 4 : 0), 0, 34, -40, 260, shade, [0.95, 0.85, 0.75], [s < 0 ? 'px' : 'nx']);
      box(pb, -half, half, -0.3, 0, -40, 260, () => 0.3, [1, 0.95, 0.9], ['py']);
      box(db, -half, half, 34, 36, -40, 260, () => 0.18, [0.8, 0.75, 0.7], ['ny']);
    } else if (kind === 'roof') {
      // a field of rooftops at different heights, ours in the middle, cloud below
      for (let q = 0; q < 90; q++) { const x = rr(-160, 160), z = rr(-120, 300), w = rr(10, 26), d = rr(10, 26), far = Math.hypot(x, z - 20) > 90, top = far && R() < 0.4 ? rr(10, 90) : rr(-40, -3), m = (R() * mats.length) | 0; if (Math.abs(x + w / 2) < 22 && z + d > -30 && z < 60) continue; box(batches[m], x, x + w, -140, top, z, z + d, shade, tintOf()); if (top > 0) for (let k = 0; k < 4; k++) gl.glows.push(['window', x + rr(0, w), rr(-30, top), z - 0.2]); }
      // a sea of cloud below the roofs
      gl.cloudSea = 1;
      box(pb, -14, 14, -0.3, 0, -20, 50, () => 0.42, [1, 1, 1], ['py']);
      for (let q = 0; q < 26; q++) { const x = rr(-12, 11), z = rr(-16, 46); box(pb, x, x + rr(1.2, 3), 0, rr(0.4, 0.8), z, z + rr(0.8, 1.6), () => 0.3, [0.6, 0.45, 0.35]); gl.glows.push(['plant', x + 1, 0.8, z + 0.6]); }
      for (let q = 0; q < 6; q++) { const x = rr(-12, 9), z = rr(-14, 44), hh = rr(2.2, 3.2); box(pb, x, x + 3, 0, hh, z, z + 2.2, (y) => 0.3 + y * 0.05, [0.5, 0.55, 0.55]); gl.glows.push(['tank', x + 1.5, hh + 0.5, z + 1]); }
    } else if (kind === 'walkway' || kind === 'gantry' || kind === 'ledge') {
      // the deck we stand on: a walkway down the canyon (a ledge hugs one face), with its railing
      const x0 = kind === 'ledge' ? half - 6 : -2.2, x1 = kind === 'ledge' ? half : 2.2;
      box(pb, x0, x1, -0.4, 0, -60, 300, () => 0.4, [1, 1, 1], ['py', 'ny', 'px', 'nx']);
      for (const x of kind === 'ledge' ? [x0] : [x0, x1]) for (let z = -60; z < 300; z += 2.5) box(db, x - 0.04, x + 0.04, 0, 1.1, z, z + 0.08, () => 0.22, [0.6, 0.6, 0.65], ['nx', 'px']);
      box(db, x0 - 0.04, x0 + 0.04, 1.05, 1.12, -60, 300, () => 0.25, [0.6, 0.6, 0.65], ['py', 'nx', 'px']);
      if (kind !== 'ledge') box(db, x1 - 0.04, x1 + 0.04, 1.05, 1.12, -60, 300, () => 0.25, [0.6, 0.6, 0.65], ['py', 'nx', 'px']);
      // the street far below, its own little lights
      if (kind !== 'ledge') { const fy = floors; box(db, -half - 1, half + 1, fy - 0.4, fy, -60, 300, () => 0.12, [0.5, 0.55, 0.65], ['py']); for (let q = 0; q < 40; q++) gl.glows.push([pick(['street', 'sign']), rr(-half, half), fy + 0.5, rr(-40, 280)]); }
    }
    // ---- walkways across the view, above and below: open decks with railings (some hung on rods),
    // enclosed skybridges with a lit strip of windows; catwalks over the works and the sewer channel
    const deck = kind === 'walkway' || kind === 'gantry' || kind === 'ledge';
    if (kind !== 'roof') {
      const n = { lane: 14, tunnel: 7, hall: 12 }[kind] ?? 26, X0 = kind === 'tunnel' ? -6 : -half, X1 = -X0;
      for (let q = 0; q < n; q++) {
        const y = kind === 'street' ? rr(5, L.slab ? 12 : 60) : kind === 'tunnel' ? rr(3.4, 4.6) : kind === 'hall' ? rr(8, 28) : rr(-40, 70), z = rr(-20, 260), wd = rr(1.6, 3.2), k = R();
        if ((deck && Math.abs(y) < 3) || (kind === 'lane' && Math.abs(y - 6) < 16 && Math.abs(z - gl.camZ) < 50) || (kind === 'street' && y < 14 && Math.abs(z - gl.camZ) < 30)) continue;
        if (k < 0.25 && kind !== 'tunnel' && kind !== 'hall') {
          const hh = rr(2.6, 3.6);
          box(batches[(R() * batches.length) | 0], X0, X1, y - 0.4, y + hh, z, z + wd + 1, shade, tintOf(), ['py', 'ny', 'pz', 'nz']);
          for (let x = X0 + 2; x < X1 - 1; x += rr(2.5, 5)) if (R() < 0.6) gl.glows.push(['window', x, y + hh * 0.55, z - 0.1]);
        } else {
          box(pb, X0, X1, y - 0.35, y, z, z + wd, (yy) => shade(yy) * 1.1, tintOf(), ['py', 'ny', 'pz', 'nz']);
          for (let x = X0; x < X1; x += 2.4) box(db, x, x + 0.06, y, y + 1, z, z + 0.06, () => 0.2, [0.6, 0.6, 0.6], ['nz', 'pz']);
          box(db, X0, X1, y + 0.95, y + 1.03, z, z + 0.06, () => 0.22, [0.6, 0.6, 0.6], ['nz', 'pz', 'py']);
          if (k > 0.72 && kind !== 'tunnel') for (let x = X0 + rr(2, 4); x < X1; x += rr(4, 8)) box(db, x, x + 0.05, y, y + rr(6, 14), z + wd / 2, z + wd / 2 + 0.05, () => 0.18, [0.5, 0.5, 0.55], ['nz', 'pz']);
          if (R() < 0.6) gl.glows.push(['bridge', rr(X0 * 0.6, X1 * 0.6), y - 0.4, z + wd / 2]);
        }
        gl.walks ||= []; gl.walks.push({ y, z: z + wd / 2, across: 1 });
      }
    }
    // ---- pipes: fat runs across the view (some in bundles) with their flanges, runs along the
    // faces and down the tunnel walls
    if (kind !== 'roof') {
      const ptint = () => pick([[0.8, 0.66, 0.52], [0.62, 0.64, 0.68], [0.58, 0.52, 0.44], [0.75, 0.48, 0.36]]);
      const across = (x0, x1, y, z, r, tint) => {
        box(pb, x0, x1, y - r, y + r, z - r, z + r, () => shade(y) * 0.85, tint, ['py', 'ny', 'pz', 'nz']);
        for (let x = x0 + rr(1, 3); x < x1; x += rr(3, 6)) box(db, x, x + 0.14, y - r * 1.4, y + r * 1.4, z - r * 1.4, z + r * 1.4, () => shade(y) * 0.45, tint, ['nz', 'pz', 'py', 'ny', 'px', 'nx']);
      };
      const along = (x, y, z0, len, r, tint) => {
        box(pb, x - r, x + r, y - r, y + r, z0, z0 + len, () => shade(y) * 0.8, tint, ['py', 'ny', 'px', 'nx']);
        for (let z = z0 + rr(1, 3); z < z0 + len; z += rr(3, 6)) box(db, x - r * 1.4, x + r * 1.4, y - r * 1.4, y + r * 1.4, z, z + 0.14, () => shade(y) * 0.45, tint, ['nz', 'pz', 'py', 'ny', 'px', 'nx']);
      };
      if (kind === 'tunnel') for (const s2 of [-1, 1]) for (let k = 0; k < 3; k++) along(s2 * rr(5.2, 5.7), rr(1.6, 4.2), -40, 260, rr(0.12, 0.3), ptint());
      else {
        const n = kind === 'hall' ? 14 : kind === 'lane' ? 8 : 18;
        for (let q = 0; q < n; q++) {
          const y = kind === 'street' ? rr(4, L.slab ? 12 : 40) : kind === 'hall' ? rr(6, 30) : rr(-30, 60), z = rr(-10, 260), r = rr(0.15, 0.5), tint = ptint();
          if ((deck && Math.abs(y) < 2.6) || (kind === 'lane' && Math.abs(y - 6) < 16 && Math.abs(z - gl.camZ) < 50)) continue;
          const nb = R() < 0.35 ? ri(2, 4) : 1;
          for (let b = 0; b < nb; b++) across(-half, half, y + b * r * 2.6, z, r, tint);
        }
        for (let q = 0; q < (kind === 'hall' ? 10 : 12); q++) { const s2 = R() < 0.5 ? -1 : 1, r = rr(0.12, 0.4); along(s2 * (half - r - 0.05), kind === 'hall' ? rr(2, 30) : rr(Math.max(floors + 2, -30), 60), rr(-30, 200), rr(15, 90), r, ptint()); }
      }
    }
    // ---- the clutter bolted on the faces: shacks, cages, air conditioners, pipes; signs and screens
    const fronts = (gl.blocks || []).filter((b) => !b.row);
    for (const b of fronts) {
      const face = b.xi, s = b.side, n = Math.floor((b.z1 - b.z0) * (Math.min(b.top, 80) - floors) / 90);
      for (let q = 0; q < n; q++) {
        const z = rr(b.z0 + 0.5, b.z1 - 1.5), y = rr(floors + 1, Math.min(b.top - 2, 90)), r = R();
        if (r < 0.18) { const w = rr(2, 4.5), hh = rr(2, 3.4), dd = rr(1, 2.6); box(batches[(R() * batches.length) | 0], s < 0 ? face : face - dd, s < 0 ? face + dd : face, y, y + hh, z, z + w, shade, tintOf()); }
        else if (r < 0.5) box(pb, s < 0 ? face : face - 0.5, s < 0 ? face + 0.5 : face, y, y + 0.6, z, z + 0.9, () => shade(y) * 0.8, [0.55, 0.55, 0.58]);
        else if (r < 0.62) box(pb, s < 0 ? face : face - 1.1, s < 0 ? face + 1.1 : face, y, y + 1.6, z, z + rr(1.6, 3), () => shade(y) * 0.6, [0.45, 0.45, 0.5], [s < 0 ? 'px' : 'nx', 'py', 'nz', 'pz']);
        else if (r < 0.72) box(db, s < 0 ? face : face - 0.18, s < 0 ? face + 0.18 : face, y - 4, y + 6, z, z + 0.18, () => shade(y) * 0.7, [0.6, 0.45, 0.35], [s < 0 ? 'px' : 'nx']);
        else if (r < 0.8 && y < 70 && gl.signs.length < 46) gl.signs.push({ x: s < 0 ? face + 0.25 : face - 0.25, y, z, s, seed: ri(1, 40), vert: R() < 0.6 });
        else if (r < 0.83 && y > floors + 4) gl.glows.push(['window', s < 0 ? face + 0.2 : face - 0.2, y, z]);
      }
    }
    // underground, a lamp every few metres (the tunnel's along its vault, the works' on the walls)
    if (kind === 'tunnel') for (let z = -30; z < 220; z += 9) gl.glows.push(['lamp', (z / 9) % 2 ? -5.4 : 5.4, 4.6, z]);
    if (kind === 'hall') for (let z = -30; z < 260; z += 12) for (const s2 of [-1, 1]) gl.glows.push(['lamp', s2 * (half - 0.6), rr(8, 20), z + rr(0, 6)]);
    if (L.slab) for (let z = -40; z < 300; z += 10) gl.glows.push(['lamp', rr(-half + 2, half - 2), 13.4, z]);
    // the street itself: the kerb and gutter, worn markings, wet patches, lamps bent over the road;
    // against the walls and on the pavements, rubbish piled up, kiosks, vending machines, bins and
    // burning barrels, awnings over the shopfronts, bollards
    if (kind === 'street') {
      const ks = half - 3;
      for (const s2 of [-1, 1]) box(db, s2 * ks - 0.15, s2 * ks + 0.15, 0, 0.02, -60, 300, () => 0.07, [0.6, 0.6, 0.7], ['py']);
      for (let z = -60; z < 300; z += 7) if (R() < 0.7) box(db, -0.08, 0.08, 0, 0.012, z, z + 3, () => rr(0.22, 0.36), [0.9, 0.85, 0.6], ['py']);
      for (let q = 0; q < 40; q++) { const x = rr(-ks + 0.5, ks - 3), z = rr(-20, 260); box(db, x, x + rr(0.8, 3), 0, 0.01, z, z + rr(0.8, 4), () => rr(0.28, 0.42), [0.55, 0.62, 0.78], ['py']); }
      for (let z = rr(-20, 0); z < 260; z += rr(14, 22)) for (const s2 of [-1, 1]) {
        const x = s2 * (ks + 0.4), x2 = x - s2 * 1.6;
        box(db, x - 0.07, x + 0.07, 0.18, 6, z, z + 0.14, () => 0.2, [0.5, 0.5, 0.55]); box(db, Math.min(x, x2), Math.max(x, x2), 5.9, 6.04, z, z + 0.14, () => 0.2, [0.5, 0.5, 0.55]);
        gl.glows.push(['street', x2, 5.75, z + 0.07]);
      }
      for (let q = 0; q < 38; q++) {
        const s2 = R() < 0.5 ? -1 : 1, z = rr(-20, 250), r = R(), wx = s2 * half;
        if (r < 0.32) {
          for (let k = ri(4, 9); k > 0; k--) { const w = rr(0.35, 0.9), h = rr(0.3, 0.75), x = wx - s2 * rr(0.25, 1.4), zz = z + rr(-1, 1); box(R() < 0.5 ? db : pb, x - w / 2, x + w / 2, 0.18, 0.18 + h, zz, zz + w, () => rr(0.22, 0.42), pick([[0.4, 0.42, 0.45], [0.55, 0.45, 0.32], [0.3, 0.35, 0.3], [0.5, 0.5, 0.55]])); }
        } else if (r < 0.46) {
          const x = s2 * (ks + 1.5), w = rr(1.6, 2.4);
          box(batches[(R() * batches.length) | 0], x - 0.9, x + 0.9, 0.18, 2.5, z, z + w, () => 0.45, tintOf());
          box(db, x - 1.1, x + 1.1, 2.5, 2.62, z - 0.2, z + w + 0.2, () => 0.3, [0.6, 0.6, 0.65]);
          gl.glows.push(['stall', x - s2 * 0.95, 1.4, z + w / 2]);
          if (gl.signs.length < 54) gl.signs.push({ x: x - s2 * 0.92, y: 3.0, z: z + w / 2, s: s2, seed: ri(1, 40), vert: false, small: 1 });
        } else if (r < 0.6) {
          const x = wx - s2 * 0.4; box(db, x - 0.4, x + 0.4, 0.18, 2.0, z, z + 0.9, () => 0.24, [0.5, 0.52, 0.58]); gl.glows.push([pick(['sign', 'window', 'house']), x - s2 * 0.42, 1.3, z + 0.45]);
        } else if (r < 0.72) {
          const x = s2 * (ks + rr(0.3, 2)); box(pb, x - 0.32, x + 0.32, 0.18, 1.1, z, z + 0.64, () => 0.3, [0.6, 0.5, 0.4]);
          if (L.slab || R() < 0.3) { gl.glows.push(['lamp', x, 1.4, z + 0.32]); gl.puffs.push({ x, y: 1.1, z: z + 0.32, t: R() * 5 }); }
        } else if (r < 0.86) {
          const x1 = wx - s2 * rr(1.6, 2.6), y = rr(2.6, 3.2), w = rr(3, 6);
          box(pb, Math.min(wx, x1), Math.max(wx, x1), y, y + 0.1, z, z + w, () => 0.35, tintOf(), ['py', 'ny']);
          gl.glows.push(['stall', (wx + x1) / 2, y - 0.5, z + w / 2]);
        } else for (let k = 0; k < 4; k++) { const x = s2 * (ks + 0.25); box(db, x - 0.1, x + 0.1, 0.18, 0.9, z + k * 1.4, z + k * 1.4 + 0.2, () => 0.3, [0.7, 0.65, 0.4]); }
      }
    }
    // the ground floor of the street: stalls with their lamps, steam from the drains
    if (kind === 'street' || kind === 'hall' || kind === 'tunnel') {
      for (let q = 0; q < (kind === 'tunnel' ? 10 : 24); q++) { const z = rr(-20, 240), s = R() < 0.5 ? -1 : 1, x = kind === 'tunnel' ? s * 4.5 : s * (half - 1.5); gl.puffs.push({ x: kind === 'street' ? rr(-half + 4, half - 4) : x, y: 0, z, t: R() * 5 }); if (kind === 'street') gl.glows.push(['stall', s * (half - 2), 2.2, z]); }
    }
    batches.forEach((B, k) => { const m = B.mesh(mats[k]); if (m) sc.add(m); });
    const pm = pb.mesh(platMat); if (pm) sc.add(pm);
    const dm = db.mesh(dark); if (dm) sc.add(dm);
    // ---- neon signs (a few textures shared among many signs), and their glow on the wet
    const signTex = new Map();
    for (const sg of gl.signs) {
      const key = sg.seed % 10, ns = A.neonSign(key + 1, sg.vert);
      let t = signTex.get(`${key}|${sg.vert}`); if (!t) { t = this.tex(gl, ns.cv, false); signTex.set(`${key}|${sg.vert}`, t); }
      const h = sg.small ? 0.6 : sg.vert ? 3 + (ns.cv.height / 16) : 1.2, w = (ns.cv.width / ns.cv.height) * h;
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, fog: true, transparent: false }));
      m.position.set(sg.x, sg.y, sg.z); m.rotation.y = sg.s < 0 ? Math.PI / 2 : -Math.PI / 2; sc.add(m);
      sg.mesh = m; sg.col = ns.col; sg.ph = R() * 10;
      gl.glows.push(['neon', sg.x + (sg.s < 0 ? 0.6 : -0.6), sg.y, sg.z, ns.col]);
    }
    // ---- billboards: the slow simulations; ad panels with their crawl of poetry
    const tints = ['#54e0ff', '#ffb020', '#ff4f8b', '#8fe36a', '#c070ff'];
    const faces = fronts.filter((b) => b.top - floors > 30);
    for (let q = 0; q < Math.min(3, faces.length) && kind !== 'tunnel'; q++) {
      const b = faces[(R() * faces.length) | 0], sim = new A.Sim(pick(['life', 'ant', 'rule', 'brain', 'life']), ri(1, 1e6), 48, 32, pick(tints)), t = this.tex(gl, sim.cv, false);
      const w = rr(9, 15), m = new T.Mesh(new T.PlaneGeometry(w, w * (32 / 48)), new T.MeshBasicMaterial({ map: t, fog: true }));
      m.position.set(b.xi + (b.side < 0 ? 0.3 : -0.3), rr(Math.max(floors + 10, 8), Math.min(b.top - 8, 60)), rr(b.z0 + 2, b.z1 - 2)); m.rotation.y = b.side < 0 ? Math.PI / 2 : -Math.PI / 2; sc.add(m);
      gl.sims.push({ sim, t, every: rr(0.12, 0.3), acc: 0 }); gl.glows.push(['screen', m.position.x + (b.side < 0 ? 1 : -1), m.position.y, m.position.z, sim.tint]);
    }
    for (let q = 0; q < (kind === 'tunnel' ? 2 : 5); q++) {
      const cr = new A.Crawl(ri(1, 1e6), 96, 16, pick(['#ffb020', '#54e0ff', '#ff4f8b', '#e8e0cc'])), t = this.tex(gl, cr.cv, false);
      const b = fronts.length ? fronts[(R() * fronts.length) | 0] : null, m = new T.Mesh(new T.PlaneGeometry(6, 1), new T.MeshBasicMaterial({ map: t, fog: true }));
      if (b) { m.position.set(b.xi + (b.side < 0 ? 0.3 : -0.3), rr(2.5, 18), rr(b.z0 + 2, b.z1 - 2)); m.rotation.y = b.side < 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { const sd = R() < 0.5 ? -1 : 1; m.position.set(sd * 5.6, rr(2.4, 3.6), rr(30, 160)); m.rotation.y = sd < 0 ? Math.PI / 2 : -Math.PI / 2; }
      sc.add(m); gl.crawls.push({ cr, t });
    }
    // ---- wires slung between the blocks, heavy and sagging: single cables and bundles, loose ends
    // hanging from them, washing pegged out along a few, a lamp on some
    const wires = [], wash = new Batch();
    if (kind !== 'roof' && kind !== 'ledge') for (let q = 0; q < ({ tunnel: 26, hall: 50, lane: 30 }[kind] ?? 110); q++) {
      const z = rr(-20, 260), y = kind === 'tunnel' ? rr(3, 5.5) : rr(floors + 4, Math.min(tops, 70)), x0 = kind === 'tunnel' ? -5.5 : -half, x1 = -x0, z2 = z + rr(-6, 6), sag = rr(0.6, 3.5) * (kind === 'lane' ? 2.5 : 1), NS = 10;
      const P = (u, oy = 0, oz = 0, sg = sag) => [x0 + (x1 - x0) * u, y - oy - Math.sin(u * Math.PI) * sg, z + oz + (z2 - z) * u];
      const nb = R() < 0.35 ? ri(2, 5) : 1;
      for (let b = 0; b < nb; b++) { const oy = b * rr(0.1, 0.3), oz = rr(-0.25, 0.25), sg = sag * rr(0.85, 1.2); for (let k = 0; k < NS; k++) wires.push(...P(k / NS, oy, oz, sg), ...P((k + 1) / NS, oy, oz, sg)); }
      if (R() < 0.3) for (let d = ri(1, 3); d > 0; d--) {
        const p = P(rr(0.15, 0.85)), len = rr(1.5, 7), dx = rr(-0.8, 0.8);
        for (let k = 0; k < 5; k++) { const a0 = k / 5, a1 = (k + 1) / 5; wires.push(p[0] + dx * a0 * a0, p[1] - len * a0, p[2], p[0] + dx * a1 * a1, p[1] - len * a1, p[2]); }
      }
      if (kind !== 'tunnel' && kind !== 'lane' && R() < 0.18) for (let u = rr(0.08, 0.2); u < 0.9; u += rr(0.05, 0.12)) {
        const p = P(u), w = rr(0.4, 0.9), h = rr(0.5, 1.2);
        box(wash, p[0] - w / 2, p[0] + w / 2, p[1] - h, p[1], p[2] - 0.02, p[2] + 0.02, () => rr(0.16, 0.36), pick([[0.9, 0.5, 0.4], [0.5, 0.6, 0.8], [0.8, 0.8, 0.7], [0.6, 0.7, 0.5], [0.85, 0.7, 0.4]]), ['nz', 'pz']);
      }
      if (R() < 0.25) gl.glows.push(['wire', 0, y - sag, (z + z2) / 2]);
    }
    if (wires.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(wires, 3)); sc.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x0a0a0c, fog: true }))); }
    { const wm = wash.mesh(dark); if (wm) sc.add(wm); }
    // ---- glows (lamps, windows, neon, screens, stalls), drawn as additive sprites
    const GC = { mast: 'rgba(255,40,40,1)', house: 'rgba(160,255,170,1)', lamp: 'rgba(255,170,80,1)', neon: null, window: 'rgba(255,190,110,1)', bridge: 'rgba(255,210,150,1)', street: 'rgba(255,170,90,1)', sign: 'rgba(255,80,140,1)', stall: 'rgba(255,170,80,1)', wire: 'rgba(255,220,160,1)', screen: null, plant: 'rgba(120,220,120,1)', tank: 'rgba(255,80,60,1)' };
    const SZ = { mast: 1.4, house: 3.5, lamp: 7, neon: 4, window: 2.2, bridge: 3, street: 4, sign: 3, stall: 5, wire: 1.6, screen: 9, plant: 1.2, tank: 0.9 };
    const glowMats = new Map(), gmat = (col) => { let m = glowMats.get(col); if (!m) { const c = col.startsWith('#') ? `rgba(${parseInt(col.slice(1, 3), 16)},${parseInt(col.slice(3, 5), 16)},${parseInt(col.slice(5, 7), 16)},1)` : col; m = new T.SpriteMaterial({ map: this.tex(gl, A.glow(c), false), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: true }); glowMats.set(col, m); } return m; };
    // ---- vehicles: spinners in their lanes (most levels), cars on the street
    const body = new T.BoxGeometry(2, 0.7, 4.4), cab = new T.BoxGeometry(1.3, 0.55, 1.8); cab.translate(0, 0.55, -0.3);
    const carMat = new T.MeshBasicMaterial({ color: 0x24262c, fog: true });
    const lanes = kind === 'street' ? [[-half / 2 + 1.5, 0.35, 1, 0], [half / 2 - 1.5, 0.35, -1, 0]] : kind === 'tunnel' ? [] : Array.from({ length: kind === 'lane' ? 8 : 3 }, () => [rr(-half * 0.7, half * 0.7), kind === 'hall' ? rr(14, 26) : kind === 'lane' ? rr(-4, 26) : rr(8, 50), R() < 0.5 ? 1 : -1, 1]);
    for (const [lx, ly, dir, fly] of lanes) for (let q = 0; q < (fly ? 2 : 3); q++) {
      const g = new T.Group(); g.add(new T.Mesh(body, carMat), new T.Mesh(cab, carMat));
      const L1 = new T.Sprite(gmat('rgba(255,240,210,1)')), L2 = new T.Sprite(gmat('rgba(255,40,30,1)')), L3 = new T.Sprite(gmat(fly ? 'rgba(80,160,255,1)' : 'rgba(255,170,60,1)'));
      L1.position.set(0, 0.1, 2.3); L1.scale.set(2.4, 1.6, 1); L2.position.set(0, 0.1, -2.3); L2.scale.set(1.8, 1.2, 1); L3.position.set(0, 0.9, 0); L3.scale.set(1.2, 1.2, 1);
      g.add(L1, L2, L3); sc.add(g);
      gl.cars.push({ g, beacon: L3, x: lx, y: ly, dir, fly, z: rr(-40, 280), sp: fly ? rr(10, 22) : rr(6, 11), bob: R() * 6 });
    }
    // a blimp with a screen, high and slow, its searchlight sweeping
    if (!L.under && (kind === 'lane' || kind === 'ledge' || kind === 'roof' || kind === 'gantry')) {
      const bl = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshBasicMaterial({ color: 0x1a1c22, fog: true })); bl.scale.set(14, 6, 32); bl.position.set(rr(-80, 80), rr(60, 110), rr(160, 260)); sc.add(bl);
      const sim = new A.Sim('rule', ri(1, 1e6), 48, 32, '#ffb020'), st = this.tex(gl, sim.cv, false), scr = new T.Mesh(new T.PlaneGeometry(16, 10), new T.MeshBasicMaterial({ map: st, fog: true, side: T.DoubleSide })); scr.position.set(bl.position.x, bl.position.y - 7, bl.position.z - 10); sc.add(scr);
      gl.sims.push({ sim, t: st, every: 0.25, acc: 0 }); gl.blimp = { bl, scr, x0: bl.position.x };
    }
    // searchlights from the far towers, and refinery flares on the skyline
    if (!L.under) for (let q = 0; q < 3; q++) {
      const cone = new T.Mesh(new T.ConeGeometry(14, 160, 16, 1, true), new T.MeshBasicMaterial({ color: 0x9ab0c8, transparent: true, opacity: 0.06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
      cone.geometry.translate(0, -80, 0); cone.position.set(rr(-200, 200), rr(80, 150), rr(200, 320)); sc.add(cone); gl.cones.push({ cone, ph: R() * 6, sp: rr(0.1, 0.25) });
    }
    if (!L.under && kind !== 'street') for (let q = 0; q < 4; q++) { const s = new T.Sprite(gmat('rgba(255,140,40,1)')); s.position.set(rr(-260, 260), rr(30, 90), rr(260, 380)); s.scale.set(12, 16, 1); sc.add(s); gl.flares.push({ s, t: rr(0, 8), next: rr(2, 9) }); }
    // ---- people: on the floor, the decks and the bridges, going about their business
    const sheets = v.people.filter((j) => j.out).map((j) => ({ j, t: this.tex(gl, j.out.cv, false) }));
    const where = [], camZ = gl.camZ;
    if (kind === 'street') for (let q = 0; q < 46; q++) where.push({ x: (R() < 0.5 ? -1 : 1) * rr(half - 2.6, half - 0.6), y: 0.18, z: rr(-10, 200), along: 1 });
    else if (kind === 'tunnel') for (let q = 0; q < 10; q++) where.push({ x: (R() < 0.5 ? -1 : 1) * rr(3.2, 5.6), y: 0, z: rr(0, 160), along: 1 });
    else if (kind === 'hall') for (let q = 0; q < 18; q++) where.push({ x: rr(-half + 3, half - 3), y: 0, z: rr(0, 180), along: R() < 0.5 });
    else if (kind === 'roof') for (let q = 0; q < 10; q++) where.push({ x: rr(-11, 11), y: 0, z: rr(-10, 44), along: R() < 0.5 });
    else if (kind === 'walkway' || kind === 'gantry' || kind === 'ledge') for (let q = 0; q < 26; q++) where.push({ x: kind === 'ledge' ? rr(half - 5, half - 1) : rr(-1.8, 1.8), y: 0, z: rr(-10, 220), along: 1 });
    for (const wk of gl.walks || []) if (Math.abs(wk.z - camZ) > 14) for (let q = 0; q < 2; q++) if (R() < 0.6) where.push({ x: rr(-half + 1, half - 1), y: wk.y, z: wk.z, along: 0, x0: -half + 0.5, x1: half - 0.5 });
    if (kind === 'walkway') for (let q = 0; q < 30; q++) where.push({ x: (R() < 0.5 ? -1 : 1) * rr(half - 2.4, half - 0.5), y: -26, z: rr(-10, 220), along: 1 });
    for (const p of where) {
      if (!sheets.length) break;
      if (p.along && Math.abs(p.z - camZ) < 12) p.z = camZ + 12 + R() * 30;
      const si = (R() * sheets.length) | 0, sh = sheets[si].j.out, h = 1.75 * (sh.CH / 35), idle = R() < 0.25;
      gl.people.push({ si, sh, w: h * (sh.CW / sh.CH), h, ...p, dir: R() < 0.5 ? 1 : -1, sp: idle ? 0 : rr(0.7, 1.3), f: R() * 8, idle });
    }
    // one mesh per sheet: a quad per person, turned to the camera and given its frame every frame
    gl.crowds = sheets.map((S, si) => {
      const list = gl.people.filter((p) => p.si === si), n = list.length; if (!n) return null;
      const pos = new Float32Array(n * 12), uv = new Float32Array(n * 8), idx = [];
      for (let i = 0; i < n; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx);
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: S.t, alphaTest: 0.35, fog: true, side: T.DoubleSide })); m.frustumCulled = false; sc.add(m);
      return { list, geo, pos, uv };
    }).filter(Boolean);
    // ---- the rooftop gardens: their plants, masts with a red light, a greenhouse lit from inside; cloud below
    if (kind === 'roof') {
      const pm = [0, 1, 2, 3].map((k) => new T.SpriteMaterial({ map: this.tex(gl, A.plant(k + (v.seed % 7)), false), fog: true, transparent: true, alphaTest: 0.4 }));
      for (const [k, x, y, z] of gl.glows) if (k === 'plant') { const s = new T.Sprite(pm[(R() * 4) | 0]); s.center.set(0.5, 0); s.position.set(x, y - 0.2, z); const h = rr(0.8, 2.4); s.scale.set(h * 0.9, h, 1); sc.add(s); }
      for (let q = 0; q < 3; q++) { const x = rr(-12, 12), z = rr(-14, 46), hh = rr(6, 14), m = new T.Mesh(new T.BoxGeometry(0.12, hh, 0.12), new T.MeshBasicMaterial({ color: 0x1a1a1e, fog: true })); m.position.set(x, hh / 2, z); sc.add(m); gl.glows.push(['mast', x, hh, z]); }
      const gx = rr(-10, 4), gz = rr(10, 36), gh = new T.Mesh(new T.BoxGeometry(5, 2.6, 3.4), new T.MeshBasicMaterial({ color: 0x2a4a3a, transparent: true, opacity: 0.4, fog: true, depthWrite: false })); gh.position.set(gx + 2.5, 1.3, gz); sc.add(gh); gl.glows.push(['house', gx + 2.5, 1.0, gz]);
    }
    if (gl.cloudSea) { const t = this.tex(gl, A.puff()); t.repeat.set(40, 40); const cs = new T.Mesh(new T.PlaneGeometry(1200, 1200), new T.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.55, color: gl.fogCol.clone().multiplyScalar(2.4), depthWrite: false, fog: true })); cs.rotation.x = -Math.PI / 2; cs.position.set(0, -34, 100); sc.add(cs); }
    // ---- rain: streaks in a box that travels with the camera; ash: slow flakes
    const NR = Math.round(700 * clamp(v.W.rain + (v.W.ash ? 0.6 : 0), 0, 1.6)) + (L.under ? 60 : 0);
    if (NR) {
      const pos = new Float32Array(NR * 6), drops = [];
      for (let q = 0; q < NR; q++) drops.push([rr(-20, 20), rr(-8, 22), rr(-6, 40), rr(0.8, 1.2)]);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      const ln = new T.LineSegments(g, new T.LineBasicMaterial({ color: v.W.ash ? 0xb0a898 : 0x8a98a8, transparent: true, opacity: v.W.ash ? 0.5 : 0.32, fog: false, depthWrite: false })); ln.frustumCulled = false; sc.add(ln);
      gl.rain = { ln, pos, drops, ash: !!v.W.ash, under: L.under };
    }
    // ---- the camera's path
    const camH = { tunnel: 1.7, hall: rr(2, 9), street: rr(1.8, 7), walkway: rr(1.7, 4), lane: rr(-6, 20), gantry: rr(1.7, 3.5), ledge: rr(1.7, 6), roof: rr(1.8, 5) }[kind];
    gl.cam = { mode: v.cam, x: kind === 'ledge' ? half - 3 : kind === 'walkway' || kind === 'gantry' ? rr(-1, 1) : kind === 'street' ? rr(-half + 3, half - 3) : 0, y: camH, z: gl.camZ, yaw: kind === 'roof' ? rr(-0.6, 0.6) : rr(-0.12, 0.12), pitch: (kind === 'walkway' || kind === 'gantry') && R() < 0.4 ? -0.32 : kind === 'roof' ? rr(-0.12, 0.02) : kind === 'lane' ? rr(-0.15, 0.2) : rr(-0.02, 0.2), sp: rr(0.5, 1.1), dir: 1, t: 0 };
    // ---- abominations: Vitriol's horrors grown huge, hanging idle in the far sky with their tentacles
    // adrift, hazed by the distance; each is drawn into its own small canvas a few times a second
    gl.aboms = [];
    const open = kind === 'roof' || kind === 'ledge' || kind === 'lane';
    for (const job of v.aboms || []) {
      const a = job.out; if (!a) continue;
      const Lt = a.tent.length, W = Math.ceil(a.CW + Lt * 1.15), H = Math.ceil(a.CH + Lt * 0.95), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const t = this.tex(gl, cv, false), dz = rr(90, 150), haze = Math.exp(-Math.pow(v.W.fog * 0.45 * dz, 2));
      const m = new T.SpriteMaterial({ map: t, fog: false, transparent: true, depthWrite: false, opacity: clamp(0.62 + haze * 0.4, 0.62, 0.95) });
      m.color.setScalar(0.85 + haze * 0.3).lerp(gl.fogCol.clone().multiplyScalar(4).addScalar(0.4), 0.2);
      const sp = new T.Sprite(m), size = rr(50, 80) * (open ? 1.25 : 1); sp.scale.set(size * W / H, size, 1); sp.center.set(0.5, 1 - a.CH / H * 0.8); sc.add(sp);
      gl.aboms.push({ a, cv, c: cv.getContext('2d'), t, sp, dz, x0: open ? rr(-32, 32) : rr(-0.4, 0.4) * half, y0: gl.cam.y + rr(open ? 14 : 22, open ? 44 : 40), ph: R() * 10, acc: 1,
        sock: a.sockets.map((k, i) => ({ ...k, v: i % a.tent.count, len: rr(0.6, 1), ph: R() * 6 })) });
    }
    // ---- glows (lamps, windows, neon, screens, stalls, masts): additive points, one batch per size
    // with the colour per point, so a few hundred lights are a handful of draw calls
    const glowTex = this.tex(gl, A.glow('rgba(255,255,255,1)'), false), rgb = (c) => (c.startsWith('#') ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) : c.match(/[\d.]+/g).slice(0, 3).map((n) => n / 255));
    const BASE = { neon: 0.75, screen: 0.22, window: 0.45 }, groups = new Map();
    for (const [k, x, y, z, col] of gl.glows) {
      if (k === 'plant') continue;
      const sz = SZ[k] || 2; let g = groups.get(sz); if (!g) groups.set(sz, (g = { p: [], c: [], base: [], ph: [], neon: [] }));
      g.p.push(x, y, z); g.c.push(...rgb(col || GC[k] || 'rgba(255,200,140,1)')); g.base.push(BASE[k] ?? 0.55); g.ph.push(R() * 10); g.neon.push(k === 'neon');
    }
    gl.glowPts = [];
    for (const [sz, g] of groups) {
      const geo = new T.BufferGeometry(), attr = new T.Float32BufferAttribute(g.c, 3); geo.setAttribute('position', new T.Float32BufferAttribute(g.p, 3)); geo.setAttribute('color', attr);
      const pts = new T.Points(geo, new T.PointsMaterial({ size: sz / Math.tan((FOV / 2) * Math.PI / 180), map: glowTex, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: true }));
      pts.frustumCulled = false; sc.add(pts); gl.glowPts.push({ attr, c0: Float32Array.from(g.c), ...g });
    }
    // the wet street gives the low lights back: a long dim streak on the road under each, toward us
    if (kind === 'street') {
      const B = { p: [], uv: [], c: [], i: [] };
      for (const [k, x, y, z, col] of gl.glows) {
        if (y > 9 || !['street', 'stall', 'lamp', 'neon', 'sign', 'window', 'house'].includes(k)) continue;
        const c = rgb(col || GC[k] || 'rgba(255,200,140,1)').map((v2) => v2 * 0.4), w = (SZ[k] || 2) * 0.35, len = (SZ[k] || 2) * (1.4 + y * 0.5), n = B.p.length / 3;
        B.p.push(x - w, 0.03, z + len * 0.12, x + w, 0.03, z + len * 0.12, x + w, 0.03, z - len, x - w, 0.03, z - len); B.uv.push(0, 1, 1, 1, 1, 0, 0, 0); for (let q = 0; q < 4; q++) B.c.push(...c);
        B.i.push(n, n + 1, n + 2, n, n + 2, n + 3);
      }
      if (B.i.length) { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(B.p, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(B.c, 3)); geo.setIndex(B.i); sc.add(new T.Mesh(geo, new T.MeshBasicMaterial({ map: glowTex, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: true, side: T.DoubleSide }))); }
    }
    gl.camera = new T.PerspectiveCamera(FOV, RW / RH, 0.2, 900);
    gl.kind = kind; gl.v = v; gl.lightning = 0;
    sc.add(gl.camera);
    return gl;
  }

  // ------------------------------------------------ every frame
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    A.pump(this.state === 'live' ? 4 : 10);
    if (this.failed) { this.drawFail(); return; }
    if (!this.G) { this.drawBlank(); return; }
    // tapped: fade the old place out (its columns sort and sink), build the next, fade it in
    if (this.state === 'out') { this.fade = Math.min(1, this.fade + dt * 1.8); if (this.next != null && this.fade >= 1) { const s = this.next; this.next = null; this.go(s); } }
    if (this.pending && this.ready(this.pending) && (this.state === 'load' || this.fade >= 1)) { this.view = this.pending; this.pending = null; this.build(this.view); this.state = 'in'; this.fade = 1; this.infoT = 0; this.onInfo?.(this.info()); }
    if (this.state === 'in') { this.fade = Math.max(0, this.fade - dt * 0.9); if (this.fade <= 0) this.state = 'live'; }
    if (!this.gl) { this.drawBlank(); return; }
    this.step(dt);
    // render at about 30 frames a second: the city moves slowly, and the readback costs
    this.acc = (this.acc || 0) + dt;
    if (this.acc < 1 / 30 && this.drawn) return;
    this.acc = 0; this.drawn = true;
    let r;
    try { r = this.r = renderer(); } catch (e) { this.failed = String(e?.message || e); return; }
    r.setClearColor(this.gl.scene.background, 1); r.clear(); r.render(this.gl.scene, this.gl.camera);
    this.post(r.domElement);
  }
  // an abomination's frame: tentacles first, hanging and splayed and slowly swaying, then the body
  drawAbom(ab, t) {
    const { a, c, cv } = ab, Tn = a.tent, bx = cv.width / 2, by = a.CH * 0.95, CF = this.G.CF;
    c.clearRect(0, 0, cv.width, cv.height);
    for (const k of ab.sock) {
      const x0 = bx + k.x, y0 = by + k.y, Lk = Tn.length * k.len;
      const dx = k.nx * Lk * 0.42 + Math.sin(t * 0.33 + k.ph) * Lk * 0.16, dy = (0.62 + k.ny * 0.3 + Math.sin(t * 0.27 + k.ph * 1.3) * 0.08) * Lk;
      CF.drawTentacle(c, Tn, k.v, x0, y0, x0 + dx, y0 + dy, Math.sin(t * 0.5 + k.ph * 1.7) * Lk * 0.22);
    }
    const f = Math.floor(t * 3 + ab.ph) % a.idleN;
    c.drawImage(a.body, (a.idle + f) * a.CW, 0, a.CW, a.CH, bx - a.anchor.x, by - a.anchor.y, a.CW, a.CH);
    ab.t.needsUpdate = true;
  }
  info() { const v = this.view; return { level: v.lv + 1, name: v.L.name, weather: WNAME[v.wk], hour: v.hour, clock: v.clock }; }
  step(dt) {
    const gl = this.gl, t = this.t, c = gl.cam, cam = gl.camera, half = gl.v.L.cw / 2;
    // the camera: a slow dolly, a crane up the canyon, a pan or a drift; at the end of its run it turns back
    c.t += dt;
    if (c.mode === 'dolly') { c.z += c.sp * c.dir * dt; if (c.z > 180 || c.z < -10) c.dir *= -1; }
    else if (c.mode === 'crane') { c.y += 0.35 * c.dir * dt; if (c.y > 40 || c.y < 1.7) c.dir *= -1; c.z += 0.2 * dt; }
    else if (c.mode === 'drift') { c.x += 0.3 * c.dir * dt; if (Math.abs(c.x) > Math.max(2, half * 0.5)) c.dir *= -1; c.z += 0.25 * dt; }
    const yaw = c.yaw + (c.mode === 'pan' ? Math.sin(c.t * 0.05) * (gl.kind === 'roof' ? 0.8 : 0.32) : Math.sin(c.t * 0.07) * 0.08);
    const pitch = c.pitch + Math.sin(c.t * 0.11) * 0.03, bob = Math.sin(c.t * 1.7) * 0.03;
    cam.position.set(c.x, c.y + bob, c.z);
    cam.lookAt(c.x + Math.sin(yaw) * 10, c.y + bob + Math.tan(pitch) * 10, c.z + Math.cos(yaw) * 10);
    if (gl.sky) gl.sky.position.set(c.x, gl.sky.position.y, c.z);
    // the weather breathes: rain comes and goes, the fog thickens and thins, lightning in a storm
    const W = gl.v.W, gust = 0.5 + 0.5 * Math.sin(t * 0.07) * Math.sin(t * 0.031 + 1);
    gl.scene.fog.density = gl.fogBase * (0.85 + gust * 0.35);
    if (W.lightning && Math.random() < dt * 0.06) gl.lightning = 1;
    if (gl.lightning > 0) { gl.lightning = Math.max(0, gl.lightning - dt * 3); if (gl.lightning === 0) { gl.scene.fog.color.copy(gl.fogCol); gl.scene.background.copy(gl.fogCol); } else { const k = gl.lightning * (Math.sin(t * 60) > 0 ? 1 : 0.4); gl.scene.fog.color.copy(gl.fogCol).lerp(new T.Color(0x9ab0d0), k * 0.6); gl.scene.background.copy(gl.scene.fog.color); } }
    if (gl.rain) {
      const { pos, drops, ash, under } = gl.rain, fall = ash ? 1.2 : under ? 6 : 16, wind = ash ? 0.6 : 1.4 * gust;
      drops.forEach((d, q) => {
        d[1] -= fall * d[3] * dt; d[0] += wind * dt;
        if (d[1] < -8) { d[1] = 22; d[0] = (Math.random() - 0.5) * 40; d[2] = Math.random() * 46 - 6; }
        const x = c.x + d[0] + (d[2] * Math.sin(yaw)), z = c.z + d[2] * Math.cos(yaw) + d[0] * 0.1, y = c.y + d[1], l = ash ? 0.08 : under ? 0.3 : 0.9 * d[3];
        pos.set([x, y, z, x - wind * 0.05, y + l, z], q * 6);
      });
      gl.rain.ln.geometry.attributes.position.needsUpdate = true;
    }
    // traffic
    for (const car of gl.cars) {
      car.z += car.sp * car.dir * dt; if (car.z > 300) car.z = -60; if (car.z < -60) car.z = 300;
      car.g.position.set(car.x + (car.fly ? Math.sin(t * 0.3 + car.bob) * 1.5 : 0), car.y + (car.fly ? Math.sin(t * 0.8 + car.bob) * 0.4 : 0), car.z); car.g.rotation.y = car.dir > 0 ? 0 : Math.PI;
      car.beacon.material.opacity = car.fly ? (Math.sin(t * 6 + car.bob) > 0.3 ? 1 : 0.1) : 0.6;
    }
    // people walking (a step every so often), turning round at the end of their beat
    // people: walk, then their quads, turned to the camera; each faces the way it moves on screen
    cam.updateMatrixWorld(); const RX = cam.matrixWorld.elements[0], RZ = cam.matrixWorld.elements[2];
    for (const cr of gl.crowds) {
      const P = cr.pos, U = cr.uv;
      cr.list.forEach((p, i) => {
        if (!p.idle) {
          if (p.along) { p.z += p.sp * p.dir * dt; if (p.z > 220 || p.z < -10) p.dir *= -1; }
          else { p.x += p.sp * p.dir * dt; if (p.x > p.x1 || p.x < p.x0) p.dir *= -1; }
          p.f += dt * p.sp * 7;
        } else p.f += dt * 3;
        const sh = p.sh, n = p.idle ? sh.idleN : sh.runN, col = (p.idle ? sh.idle : sh.run) + (Math.floor(p.f) % n), cw = sh.CW / sh.cv.width;
        const onScreen = p.along ? p.dir : p.dir * Math.sign(RX || 1), u0 = onScreen > 0 ? col * cw : (col + 1) * cw, u1 = onScreen > 0 ? (col + 1) * cw : col * cw;
        const hw = p.w / 2, ax = RX * hw, az = RZ * hw, o = i * 12;
        P[o] = p.x - ax; P[o + 1] = p.y; P[o + 2] = p.z - az; P[o + 3] = p.x + ax; P[o + 4] = p.y; P[o + 5] = p.z + az;
        P[o + 6] = p.x + ax; P[o + 7] = p.y + p.h; P[o + 8] = p.z + az; P[o + 9] = p.x - ax; P[o + 10] = p.y + p.h; P[o + 11] = p.z - az;
        const q = i * 8; U[q] = u0; U[q + 1] = 0; U[q + 2] = u1; U[q + 3] = 0; U[q + 4] = u1; U[q + 5] = 1; U[q + 6] = u0; U[q + 7] = 1;
      });
      cr.geo.attributes.position.needsUpdate = true; cr.geo.attributes.uv.needsUpdate = true;
    }
    // the billboards and the ad crawls
    for (const s of gl.sims) { s.acc += dt; if (s.acc > s.every) { s.acc = 0; s.sim.step(); s.t.needsUpdate = true; } }
    if (Math.floor(t * 30) !== this.lastCrawl) { this.lastCrawl = Math.floor(t * 30); for (const cr of gl.crawls) { cr.cr.step(0.5); cr.t.needsUpdate = true; } }
    // neon flickers; windows and lamps breathe; flares burst on the skyline; searchlights sweep
    for (const g of gl.glowPts) {
      const a = g.attr.array;
      for (let i = 0; i < g.base.length; i++) { const k = g.base[i] * (g.neon[i] && Math.sin(t * 13 + g.ph[i] * 7) > 0.97 ? 0.15 : 1) * (0.9 + Math.sin(t * 2 + g.ph[i]) * 0.1); a[i * 3] = g.c0[i * 3] * k; a[i * 3 + 1] = g.c0[i * 3 + 1] * k; a[i * 3 + 2] = g.c0[i * 3 + 2] * k; }
      g.attr.needsUpdate = true;
    }
    for (const sg of gl.signs) { const on = !(Math.sin(t * 9 + sg.ph * 5) > 0.985); sg.mesh.visible = on; }
    for (const f of gl.flares) { f.t += dt; const u = f.t - f.next; f.s.material.opacity = u > 0 && u < 1.6 ? Math.sin((u / 1.6) * Math.PI) : 0; if (u > 1.6) { f.t = 0; f.next = 3 + Math.random() * 9; } f.s.scale.set(12, 14 + Math.max(0, Math.sin(u * 3)) * 12, 1); }
    for (const k of gl.cones) { k.cone.rotation.z = Math.sin(t * k.sp + k.ph) * 0.5; k.cone.rotation.x = Math.cos(t * k.sp * 0.7 + k.ph) * 0.3; }
    for (const ab of gl.aboms) {
      ab.sp.position.set(ab.x0 + Math.sin(t * 0.03 + ab.ph) * 9, ab.y0 + Math.sin(t * 0.21 + ab.ph) * 1.4, c.z + ab.dz);
      if ((ab.acc += dt) > 0.12) { ab.acc = 0; this.drawAbom(ab, t); }
    }
    if (gl.blimp) { const b = gl.blimp; b.bl.position.x = b.x0 + Math.sin(t * 0.01) * 40; b.scr.position.x = b.bl.position.x; }
    // steam from the drains and vents
    this.puffT = (this.puffT || 0) + dt;
    if (gl.puffs.length && this.puffT > 0.25) { this.puffT = 0; this.spawnPuff(gl); }
    for (const s of gl.steam || []) { s.life += dt; s.spr.position.y += dt * 0.6; s.spr.scale.multiplyScalar(1 + dt * 0.25); s.spr.material.opacity = Math.max(0, 0.32 * (1 - s.life / 5)); }
    if (gl.steam) gl.steam = gl.steam.filter((s) => { if (s.life < 5) return true; gl.scene.remove(s.spr); return false; });
  }
  spawnPuff(gl) {
    const p = gl.puffs[(Math.random() * gl.puffs.length) | 0];
    gl.puffMat ||= new T.SpriteMaterial({ map: this.tex(gl, A.puff(), false), transparent: true, depthWrite: false, fog: true, opacity: 0.3 });
    const s = new T.Sprite(gl.puffMat.clone()); s.position.set(p.x, p.y + 0.3, p.z); s.scale.set(1.6, 1.6, 1); gl.scene.add(s);
    (gl.steam ||= []).push({ spr: s, life: 0 });
    if (gl.steam.length > 30) { const o = gl.steam.shift(); gl.scene.remove(o.spr); o.spr.material.dispose(); }
  }
  // ------------------------------------------------ the 2D finish: quantise, dither, grain, sort, vignette
  post(src) {
    const b = this.bc, v = this.gl.v;
    b.drawImage(src, 0, 0);
    const im = b.getImageData(0, 0, RW, RH), d = im.data, f = this.fade, seed = Math.floor(this.t * 24);
    // the hour's grade (dusk warm, dawn grey, night cold, a little lift in the shadows so it reads),
    // the Bayer dither and a flicker of grain, quantised to a few levels: all one table lookup a channel
    const lut = this.lut?.hour === v.hour ? this.lut : (this.lut = gradeLut(v.hour)), L0 = lut.t, sd = (seed * 83492791) | 0;
    for (let y = 0; y < RH; y++) {
      const by = (y & 3) * 4, hy = (y * 19349663) ^ sd;
      for (let x = 0, j = y * RW * 4; x < RW; x++, j += 4) {
        const o = ((BQ[by + (x & 3)] + ((((x * 73856093) ^ hy) & 15) - 7.5) * 0.35 + 12) * 2) | 0, r = o * 768;
        d[j] = L0[r + d[j]]; d[j + 1] = L0[r + 256 + d[j + 1]]; d[j + 2] = L0[r + 512 + d[j + 2]];
      }
    }
    // fading in or out: the picture's columns sort by brightness and sink into the dark
    if (f > 0) {
      const col = [];
      for (let x = 0; x < RW; x++) {
        if (((x * 2654435761) >>> 0) / 4294967296 > f * 1.2) continue;
        col.length = 0;
        const y0 = Math.floor(RH * (1 - f) * (0.4 + (((x * 40503) & 255) / 255) * 0.6));
        for (let y = y0; y < RH; y++) { const j = (y * RW + x) * 4; col.push([d[j] + d[j + 1] + d[j + 2], d[j], d[j + 1], d[j + 2]]); }
        col.sort((p, q) => p[0] - q[0]);
        for (let y = y0; y < RH; y++) { const j = (y * RW + x) * 4, c = col[y - y0], k = 1 - f * 0.9; d[j] = c[1] * k; d[j + 1] = c[2] * k; d[j + 2] = c[3] * k; }
      }
    }
    b.putImageData(im, 0, 0);
    this.blit();
  }
  blit() {
    const cv = this.cv, c = this.c, cw = cv.clientWidth || W, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(cw * (H / W) * dpr); }
    const s = cv.width / W;
    c.setTransform(s, 0, 0, s, 0, 0); c.imageSmoothingEnabled = false;
    c.drawImage(this.buf, 0, 0, W, H);
    // a vignette, and a small line of the feed's own text, dim, in the corner
    const vg = (this.vg ||= (() => { const g = document.createElement('canvas'); g.width = W; g.height = H; const x = g.getContext('2d'), rg = x.createRadialGradient(W / 2, H * 0.46, H * 0.2, W / 2, H / 2, H * 0.72); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.62)'); x.fillStyle = rg; x.fillRect(0, 0, W, H); return g; })());
    c.drawImage(vg, 0, 0);
    if (this.view) {
      this.infoT = (this.infoT || 0) + 1 / 30;
      const v = this.view, a = clamp(Math.min(this.infoT - 1, 9 - this.infoT), 0, 1) * 0.55;
      if (a > 0) { c.globalAlpha = a; c.font = '10px ui-monospace, monospace'; c.textBaseline = 'top'; c.fillStyle = '#c8d4dc'; c.fillText(`LV ${String(v.lv + 1).padStart(2, '0')} · ${v.L.name.toUpperCase()}`, 12, 12); c.fillText(`${v.clock} · ${WNAME[v.wk].toUpperCase()}`, 12, 25); c.globalAlpha = 1; }
    }
  }
  drawBlank() { const c = this.c; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#07080a'; c.fillRect(0, 0, this.cv.width, this.cv.height); }
  drawFail() { this.drawBlank(); const c = this.c; c.fillStyle = '#8a8a8a'; c.font = '13px ui-monospace, monospace'; c.fillText('no signal', 20, 30); }
}

// the card's moving part
export function bladeCard(el, onInfo) {
  const canvas = el('canvas.blade'), stage = el('div.stage.blade-stage', canvas);
  let V = null;
  stage.addEventListener('click', () => V?.tap());
  return { stage, activate: () => { V ||= new BladeView(canvas, onInfo); V.start(); }, deactivate: () => { V?.stop(); } };
}
