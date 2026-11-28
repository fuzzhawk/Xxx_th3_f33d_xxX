// The platformer's look: a city ending. Greebleworks (Vitriol's procedural cyber facades) bakes the
// pictures a slice at a time: three skies with their far-city layers (sodium smog; an ember storm over a
// ruined skyline; a fungal bloom under a magnetar sky), the facades the sand city's towers are painted
// from, the platforms' building faces and deck strips, a ceiling, and decals for the walls. The backdrop
// scrolls in layers: the sky, four far layers, the sand city (platformer-sand.js), fog between them, the
// play layer, then hanging cables and tendrils in front, weather, a grade, grain and a vignette.
// Flaming spore asteroids fall on every layer: far ones leave fires on the skyline, near ones blow holes
// in the sand city, and now and then one lands right in the play layer (only for show: the level's
// shape never changes). The change runs with the hero's distance: murky city, burning city, bloom.
import { W, H } from './engine.js';
import { mulberry32 } from '../util.js';
import { grit } from '../bladeview-art.js';
import { Sand, CS, GH as SGH, ROCKH } from './platformer-sand.js';

const TAU = Math.PI * 2;
export const PF = 0.5; // the sand city's parallax
const LF = [0.05, 0.11, 0.17, 0.24]; // the far layers'
const GEN = new URL('../../ext/vitriol/src/gen/', import.meta.url).href;
export const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// how far the end has come at world x: 0 a living (if murky) city, 1 a jungle of fungus and flesh
export const tAt = (x) => sstep(500, 15500, x);
export function phase(T) {
  const wA = 1 - sstep(0.12, 0.4, T), wC = sstep(0.5, 0.82, T), wB = Math.max(0, 1 - wA - wC);
  return { T, wA, wB, wC, burn: sstep(0.05, 0.2, T) * (1 - 0.65 * sstep(0.62, 0.92, T)), bio: sstep(0.3, 0.9, T) };
}
const HAZE = [[58, 66, 72], [108, 54, 28], [46, 74, 50]];
const GRADE = [[110, 150, 190, 0.06], [255, 90, 30, 0.08], [90, 210, 110, 0.06]];
export const hazeAt = (T) => { const p = phase(T); return [0, 1, 2].map((k) => HAZE[0][k] * p.wA + HAZE[1][k] * p.wB + HAZE[2][k] * p.wC); };
const h1 = (x) => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const pk = (r, g, b) => ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
const CORES = [[170, 255, 90], [120, 255, 150], [220, 255, 120], [90, 240, 190]];

// ---------------------------------------------------------------- the bakes, shared by every platformer card
const BASE = { mode: 'level', palette: 'sodium', dither: 0.45, greeble: 0.8, pipes: 0.75, windows: 0.6, neon: 0.3, grime: 0.9, wear: 0.75, relief: 1, lightdir: 315, platKind: 'auto',
  skyMood: 'smog', cloud: 0.9, glow: 0.7, horizon: 0.72, weatherAmt: 0.9, cloudScale: 1, cloudStretch: 1.2, cloudSharp: 0.35, cloudDetail: 1, cloudTurb: 0.5, cloudHeight: 0.75,
  cityLayers: 4, cityDens: 1.5, cityMass: 1.7, cityVar: 0.9, cityWidth: 1.05, cityOverlap: 1.6, cityHaze: 1.25, cityContrast: 0.75, cityDetail: 0.8, cityWin: 0.55, citySkyway: 1, cityRuin: 0.1, cityLights: 0.45, cityBlimps: 0.4, fog: 1.25, weather: 'auto' };
// the play layer's faces and decks, by look: [facade style, palette, deck kind]
const FACES = { street: ['slum', 'sodium', 'concrete'], under: ['undercity', 'rust', 'pipes'], ruin: ['ruin', 'sodium', 'concrete'], works: ['industrial', 'rust', 'grating'], sky: ['megacorp', 'chrome', 'deck'],
  tower: ['hab', 'sodium', 'concrete'], one: ['industrial', 'rust', 'catwalk'], move: ['spaceport', 'chrome', 'deck'], crum: ['brutalist', 'sodium', 'concrete'] };
const SANDFAC = [['megacorp', 'chrome'], ['kowloon', 'sodium'], ['hab', 'sodium'], ['industrial', 'rust'], ['brutalist', 'sodium'], ['arcology', 'chrome'], ['slum', 'rust'], ['server', 'chrome']];
const DECALS = [['vent', 'industrial'], ['junction', 'industrial'], ['escape', 'slum'], ['graffiti', 'slum'], ['shrine', 'kowloon'], ['tunnel', 'undercity'], ['collapse', 'ruin']];
// the moods: cold rain over the living city; an ember storm over its ruin; a toxic dusk over a forest of
// fungus spires and (the far layers taking turns with it) a jungle canopy in an acid mist: greens
const SKIES = [
  { style: 'megacorp', skyMood: 'coldrain', palette: 'sodium', cityRuin: 0.08, cityLights: 0.7, citySkyway: 1.3, cityBlimps: 0.6 },
  { style: 'ruin', skyMood: 'emberstorm', palette: 'rust', cityRuin: 1.8, cityLights: 0.12, citySkyway: 0.3, cityBlimps: 0, cloudTurb: 1.1 },
  { style: 'ruin', skyMood: 'toxicdusk', palette: 'none', cityRuin: 1, cityWidth: 1.4, cityMass: 1.5, flora: { form: 'spine', veg: ['#16301c', '#1d3a22', '#122a20'], lit: '#b0ff60', dens: 0.9 } },
  { style: 'ruin', skyMood: 'acidmist', palette: 'none', cityRuin: 1, cityWidth: 1.6, cityMass: 1.5, flora: { form: 'canopy', veg: ['#14321a', '#1e4024', '#0e2a1e'], lit: '#7dff9a', dens: 0.9 } }
];
let ART = null;
export const art = () => (ART ||= new Art());
class Art {
  constructor() {
    this.q = []; this.ver = 0; this.skies = [null, null, null, null]; this.subs = new Set(); this.face = {}; this.deck = {}; this.ceil = null; this.decals = []; this.growth = []; this.sandTex = []; this.sandDone = false;
    this.fallbacks();
    const go = () => { try { this.start(window.GREEBLEWORKS); } catch (e) { console.warn('platformer art', e); } };
    if (window.GREEBLEWORKS) go();
    else { const s = document.createElement('script'); s.src = `${GEN}greebleworks.js`; s.onload = go; s.onerror = () => console.warn('greebleworks did not load'); document.head.append(s); }
  }
  // stand-ins until greebleworks has baked: dark concrete panels, a plain deck; and the sprites
  fallbacks() {
    const R = mulberry32(77), f = mk(64, 64), x = f.getContext('2d');
    x.fillStyle = '#2a2622'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) { const v = 26 + R() * 30; x.fillStyle = `rgb(${v},${v * 0.92},${v * 0.82})`; x.fillRect(R() * 64, R() * 64, 1 + R() * 3, 1 + R() * 2); }
    x.fillStyle = 'rgba(0,0,0,0.5)'; for (let y = 0; y < 64; y += 16) x.fillRect(0, y, 64, 1); for (let xx = 0; xx < 64; xx += 32) x.fillRect(xx, 0, 1, 64);
    const d = mk(64, 20), y = d.getContext('2d');
    y.fillStyle = '#4a443c'; y.fillRect(0, 0, 64, 20); y.fillStyle = '#6e665a'; y.fillRect(0, 0, 64, 3); y.fillStyle = '#211e1a'; y.fillRect(0, 12, 64, 8);
    y.fillStyle = 'rgba(0,0,0,0.4)'; for (let xx = 0; xx < 64; xx += 16) y.fillRect(xx, 3, 1, 9);
    this.fbFace = f; this.fbDeck = d;
    const g = (this.glow = mk(64, 64)).getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    // smoke: a lumpy soft dark ball
    const s = (this.smoke = mk(48, 48)).getContext('2d');
    for (let i = 0; i < 7; i++) { const cx = 14 + R() * 20, cy = 14 + R() * 20, r = 8 + R() * 10, q = s.createRadialGradient(cx, cy, 0, cx, cy, r); q.addColorStop(0, 'rgba(255,255,255,0.35)'); q.addColorStop(1, 'rgba(255,255,255,0)'); s.fillStyle = q; s.fillRect(0, 0, 48, 48); }
    // fog: soft noise bands, one per mood, white tinted
    const fw = 256, fh = 64, nz = (xx, yy, sc, k) => { const fx = xx / sc, fy = yy / sc, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), P = Math.round(fw / sc), hh = (i, j) => h1(((i % P) + P) % P * 7.13 + j * 91.7 + k * 13.1); return (hh(ix, iy) * (1 - a) + hh(ix + 1, iy) * a) * (1 - b) + (hh(ix, iy + 1) * (1 - a) + hh(ix + 1, iy + 1) * a) * b; };
    const field = new Float32Array(fw * fh);
    for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) { const band = Math.sin((yy / fh) * Math.PI) ** 1.5; field[yy * fw + xx] = Math.max(0, (0.55 * nz(xx, yy, 32, 1) + 0.3 * nz(xx, yy, 16, 2) + 0.15 * nz(xx, yy, 8, 3)) * 1.6 - 0.45) * band; }
    this.fog = HAZE.map((hz) => {
      const c = mk(fw, fh), cx = c.getContext('2d'), im = cx.createImageData(fw, fh), u = new Uint32Array(im.data.buffer), col = hz.map((v) => Math.min(255, v * 1.9 + 30));
      for (let i = 0; i < fw * fh; i++) u[i] = ((Math.min(255, field[i] * 255) << 24) | ((col[2] | 0) << 16) | ((col[1] | 0) << 8) | (col[0] | 0)) >>> 0;
      cx.putImageData(im, 0, 0); return c;
    });
    // grain, and the vignette with the grain baked into it: three frames to cycle, one full-screen draw a frame
    const gn = mk(128, 128).getContext('2d'), gi = gn.createImageData(128, 128), gu = new Uint32Array(gi.data.buffer);
    for (let i = 0; i < gu.length; i++) { const r = R(); gu[i] = r < 0.5 ? ((((r * 90) | 0) << 24) >>> 0) : ((((r - 0.5) * 70) | 0) << 24 | 0xd8e0e8) >>> 0; }
    gn.putImageData(gi, 0, 0);
    this.vigs = [0, 1, 2].map(() => {
      const cv = mk(W, H), vg = cv.getContext('2d'), vr = vg.createRadialGradient(W / 2, H * 0.46, H * 0.25, W / 2, H * 0.5, H * 0.78);
      vr.addColorStop(0, 'rgba(0,0,0,0)'); vr.addColorStop(0.7, 'rgba(4,2,6,0.35)'); vr.addColorStop(1, 'rgba(2,0,4,0.82)');
      vg.fillStyle = vr; vg.fillRect(0, 0, W, H);
      vg.globalAlpha = 0.5; const ox = -Math.floor(R() * 128), oy = -Math.floor(R() * 128);
      for (let y = oy; y < H; y += 128) for (let x = ox; x < W; x += 128) vg.drawImage(gn.canvas, x, y);
      return cv;
    });
  }
  start(GW) {
    if (!GW) return;
    const job = (make, done) => this.q.push({ make, done, gen: null });
    let s = 101;
    for (const k in FACES) {
      const [style, palette, kind] = FACES[k], seed = s++;
      job(() => GW.bakeFacade({ ...BASE, style, palette, outW: 64, outH: 64, SS: 3, tileX: true, tileY: true, seed, neon: 0.2 }), (v) => { this.face[k] = grit(v.final, seed, { sat: 0.66, streak: 0.14 }); });
      job(() => GW.bakePlatform({ ...BASE, style, palette, platKind: kind, outW: 64, outH: 20, SS: 3, seed: seed + 50 }), (v) => { this.deck[k] = grit(v.final, seed + 50, { streak: 0.03, sat: 0.7 }); });
    }
    job(() => GW.bakeCeiling({ ...BASE, style: 'undercity', palette: 'rust', outW: 64, outH: 44, SS: 3, seed: 211 }), (v) => { this.ceil = grit(v.final, 211, { streak: 0.05 }); });
    job(() => GW.bakeSky({ ...BASE, ...SKIES[0], outW: 480, outH: 300, SS: 1, seed: 7 }), (v) => this.skyDone(0, v));
    SANDFAC.forEach(([style, palette], i) => job(() => GW.bakeFacade({ ...BASE, style, palette, outW: 64, outH: 96, SS: 2, tileX: true, tileY: true, seed: 300 + i, windows: 0.75, neon: 0.35 }), (v) => {
      this.sandTex.push(this.toTex(v, 32, 48)); if (this.sandTex.length === SANDFAC.length) this.sandDone = true;
    }));
    DECALS.forEach(([decalKind, style], i) => job(() => GW.bakeDecal({ ...BASE, style, palette: 'sodium', decalKind, outW: 56, outH: 56, SS: 2, seed: 400 + i }), (v) => { this.decals.push(v.final); }));
    for (let i = 0; i < 2; i++) job(() => GW.bakeDecal({ ...BASE, style: 'slum', palette: 'toxic', decalKind: 'growth', outW: 56, outH: 56, SS: 2, seed: 450 + i }), (v) => { this.growth.push(v.final); });
    job(() => GW.bakeSky({ ...BASE, ...SKIES[1], outW: 480, outH: 300, SS: 1, seed: 8 }), (v) => this.skyDone(1, v));
    job(() => GW.bakeSky({ ...BASE, ...SKIES[2], outW: 480, outH: 300, SS: 1, seed: 9 }), (v) => this.skyDone(2, v));
    job(() => GW.bakeSky({ ...BASE, ...SKIES[3], outW: 480, outH: 300, SS: 1, seed: 10 }), (v) => this.skyDone(3, v));
    this.idle();
  }
  // bake on a timer too, so a card showing a still (autopilot off) gets its pictures; redraw such stills when done
  idle() {
    if (!this.q.length) { this.done = true; for (const g of this.subs) if (!g.running && g.scale) { try { g.frame(performance.now()); } catch { /* a still that fails stays as it was */ } } this.subs.clear(); return; }
    this.pump(6); setTimeout(() => this.idle(), 40);
  }
  // a sky: the gritted sky, its far layers, each layer's skyline (where an asteroid can land) and its low colour
  skyDone(k, v) {
    const sky = grit(v.sky, 31 + k, { streak: 0.02, sat: 0.9, levels: 10 }), tops = [], layers = [], oys = [];
    // the green skies are bright at the horizon: take them down toward a deep green dusk
    if (k >= 2) { const x = sky.getContext('2d'), g = x.createLinearGradient(0, 0, 0, sky.height); g.addColorStop(0, 'rgb(90,112,92)'); g.addColorStop(1, 'rgb(128,150,118)'); x.globalCompositeOperation = 'multiply'; x.fillStyle = g; x.fillRect(0, 0, sky.width, sky.height); }
    for (const L of v.layers) {
      const w = L.width, h = L.height, d = L.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, top = new Int16Array(w).fill(h);
      let y0 = h;
      for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 8) { if (d[(y * w + x) * 4 + 3] > 140 || y0 > y) y0 = Math.min(y0, y); if (d[(y * w + x) * 4 + 3] > 140) { top[x] = y; break; } }
      y0 = Math.max(0, Math.min(h - 1, y0 - 1));
      const cv = mk(w, h - y0); cv.getContext('2d').drawImage(L, 0, -y0);
      tops.push(top); layers.push(cv); oys.push(y0);
    }
    const sd = sky.getContext('2d').getImageData(0, sky.height - 2, sky.width, 1).data;
    let r = 0, g = 0, b = 0; for (let i = 0; i < sd.length; i += 4) { r += sd[i]; g += sd[i + 1]; b += sd[i + 2]; }
    const n = sd.length / 4;
    this.skies[k] = { sky, layers, oys, tops, low: [r / n, g / n, b / n] };
  }
  // a facade for the sand city: its colours, and how much each texel glows
  toTex(v, w, h) {
    const c = mk(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(v.final, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, data = new Uint32Array(w * h), glow = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) data[i] = pk(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    x.clearRect(0, 0, w, h); x.imageSmoothingEnabled = true; x.drawImage(v.emissive, 0, 0, w, h);
    const e = x.getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) { const m = Math.max(e[i * 4], e[i * 4 + 1], e[i * 4 + 2]) * (e[i * 4 + 3] / 255); glow[i] = m > 60 ? Math.min(255, m * 1.3) : 0; }
    return { w, h, data, glow };
  }
  pump(ms = 4) {
    const t0 = performance.now();
    while (this.q.length && performance.now() - t0 < ms) {
      const j = this.q[0];
      try {
        j.gen ||= j.make();
        const r = typeof j.gen?.next === 'function' ? j.gen.next() : { done: true, value: j.gen };
        if (r.done) { this.q.shift(); j.done(r.value); this.ver++; }
      } catch (e) { console.warn('platformer bake', e); this.q.shift(); }
    }
  }
  faceOf(k) { return this.face[k] || this.fbFace; }
  deckOf(k) { return this.deck[k] || this.fbDeck; }
}

// ---------------------------------------------------------------- the backdrop: one per game
export class Backdrop {
  constructor(g) {
    this.g = g; this.A = art(); if (!this.A.done) this.A.subs.add(g);
    const seed = g.post.seed || 1;
    this.sand = new Sand({ seed, tAt: (ax) => tAt((ax * CS) / PF), haze: hazeAt });
    this.rng = mulberry32((seed ^ 0x77aa11) >>> 0);
    this.texOn = false; this.pats = new Map();
    this.clear();
  }
  R(a = 0, b = 1) { return a + this.rng() * (b - a); }
  clear() {
    this.ast = []; this.burns = []; this.smk = []; this.fx = []; this.scars = []; this.ghosts = []; this.wx = [];
    this.nextAst = 2.5; this.nextNear = 12; this.nextGhost = 4; this.flk = 8; this.dark = 0; this.lightK = 1; this.flash = 0; this.acc = 0; this.lastT = null; this.lastCx = null;
    this.P = phase(0);
  }
  reset() { this.clear(); this.sand.reset(Math.floor((this.g.camX * PF) / CS)); }
  skyY() { return Math.round(-22 - this.g.camY * 0.04); }
  sandY() { return Math.round(300 - SGH * CS - this.g.camY * 0.3); }
  layerY(i) { return Math.round(this.skyY() - this.g.camY * 0.025 * i); }
  pat(c, img) { let p = this.pats.get(img); if (!p) { p = c.createPattern(img, 'repeat'); this.pats.set(img, p); } return p; }

  // ---------------------------------------------------------------- per frame
  update() {
    const g = this.g, A = this.A, S = this.sand;
    A.pump(4);
    if (A.sandDone && !this.texOn) { this.texOn = true; S.setTextures(A.sandTex); }
    const now = g.t, dt = this.lastT == null ? 0 : Math.max(0, Math.min(0.05, now - this.lastT)); this.lastT = now;
    const cx = g.camX, P = (this.P = phase(tAt(cx + W * 0.4)));
    const Lx = cx * PF, ax0 = Math.floor(Lx / CS), ax1 = ax0 + Math.ceil(W / CS) + 1;
    S.view(ax0, ax1);
    const lo = ax0 - S.c0, hi = ax1 - S.c0;
    this.acc += dt; let n = 0;
    while (this.acc >= 1 / 60 && n < 2) { S.step(lo - 16, hi + 16, P.bio); this.acc -= 1 / 60; n++; }
    if (this.acc > 0.05) this.acc = 0;
    // haunted: now and then the lights stutter and the dark comes in
    this.flk -= dt;
    if (this.flk <= 0) { this.flkN = 1 + Math.floor(this.R(0, 3)); this.flk = this.R(7, 16); this.flkT = 0; }
    if (this.flkN > 0) { this.flkT += dt; const on = Math.floor(this.flkT / 0.07) % 2 === 0; this.lightK = on ? 0.12 : 1; this.dark = on ? 0.22 : 0; if (this.flkT > this.flkN * 0.14) { this.flkN = 0; this.lightK = 1; this.dark = 0; } }
    S.render(lo - 1, hi + 1, now, this.lightK, Math.floor(-this.sandY() / CS));
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (dt > 0) { this.stepAst(dt, P); this.stepFx(dt, P); }
    this.stepWeather(dt, cx);
  }
  stepAst(dt, P) {
    const g = this.g;
    this.nextAst -= dt;
    if (this.nextAst <= 0) {
      const rate = 0.13 + P.burn * 1.15 + P.bio * 0.35;
      this.nextAst = this.R(0.5, 1.5) / rate;
      if (P.T < 0.05 || this.rng() < 0.35) this.launchFar(P); else this.launchSand(P);
    }
    if (P.burn + P.bio > 0.25) { this.nextNear -= dt; if (this.nextNear <= 0) { this.nextNear = this.R(9, 17); this.launchNear(P); } }
    for (const a of this.ast) {
      if (a.dead) continue;
      const px = a.x, py = a.y;
      a.x += a.vx * dt; a.y += a.vy * dt; a.age += dt;
      if (a.L === 'sand') { const h = this.trace(px, py, a.x, a.y); if (h) { a.x = h.x; a.y = h.y; a.ax = h.ax; a.row = h.row; this.hit(a, P); a.dead = true; continue; } }
      a.tr.push({ x: a.x + this.R(-1, 1) * a.s * 0.4, y: a.y + this.R(-1, 1) * a.s * 0.4, l: 0, m: this.R(0.3, 0.6) * (a.L === 'near' ? 1.3 : 1), s: a.s * this.R(1, 1.8), vx: -a.vx * 0.06 + this.R(-6, 6), vy: -a.vy * 0.06 - this.R(4, 14) });
      if (a.y >= a.ty) { this.hit(a, P); a.dead = true; }
    }
    // trails fade; a struck asteroid's trail lingers a moment after it
    for (const a of this.ast) { for (const p of a.tr) { p.l += dt; p.x += p.vx * dt; p.y += p.vy * dt; } a.tr = a.tr.filter((p) => p.l < p.m); }
    this.ast = this.ast.filter((a) => !a.dead || a.tr.length);
  }
  launchSand(P) {
    const g = this.g, Lx = g.camX * PF, sy = this.sandY(), tx = Lx + this.R(W * 0.45, W * 1.25), ty = this.R(60, 250) - sy;
    const dir = this.rng() < 0.7 ? -1 : 1, dx = dir * this.R(0.3, 0.7), l = Math.hypot(dx, 1), ux = dx / l, uy = 1 / l, D = (ty - (-40 - sy)) / uy, sp = this.R(300, 390);
    this.ast.push({ L: 'sand', x: tx - ux * D, y: ty - uy * D, vx: ux * sp, vy: uy * sp, ty: 1e9, r: Math.round(this.R(3, 6 + P.burn * 3)), s: this.R(4, 6.5), core: CORES[Math.floor(this.R(0, 4))], tr: [], age: 0 });
  }
  // a sand asteroid's path from (x0, y0) to (x1, y1), traced cell by cell: the first solid cell, or null
  trace(x0, y0, x1, y1) {
    const S = this.sand, n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / CS) + 1;
    for (let k = 1; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n, ax = Math.floor(x / CS), row = Math.floor(y / CS); if (S.solidAt(ax, row)) return { ax, row, x, y }; }
    return null;
  }
  launchFar(P) {
    const g = this.g, A = this.A, i = Math.floor(this.R(0, 4)), f = LF[i], X = g.camX * f + this.R(W * 0.15, W * 1.2);
    const k = P.wC > 0.5 ? 2 : P.wB > 0.5 ? 1 : 0, sk = A.skies[k] || A.skies[0];
    let ty = 190;
    if (sk) { const top = sk.tops[i], w = top.length, col = ((Math.floor(X) % w) + w) % w; ty = top[col] < 296 ? top[col] + 3 : 240; }
    const dir = this.rng() < 0.7 ? -1 : 1, dx = dir * this.R(0.25, 0.6), l = Math.hypot(dx, 1), ux = dx / l, uy = 1 / l, D = (ty + 40) / uy, sp = 90 + i * 45;
    this.ast.push({ L: i, x: X - ux * D, y: ty - uy * D, vx: ux * sp, vy: uy * sp, ty, s: 1.4 + i * 0.7, core: CORES[Math.floor(this.R(0, 4))], tr: [], age: 0 });
  }
  launchNear(P) {
    const g = this.g, x = g.camX + this.R(W * 0.62, W * 1.05), y = g.groundTop(x);
    if (y == null || y - g.camY > H - 20) return;
    const dir = this.rng() < 0.6 ? -1 : 1, dx = dir * this.R(0.25, 0.5), l = Math.hypot(dx, 1), ux = dx / l, uy = 1 / l, D = (y - (g.camY - 70)) / uy, sp = 560;
    this.ast.push({ L: 'near', x: x - ux * D, y: y - uy * D, vx: ux * sp, vy: uy * sp, ty: y, s: this.R(8, 12), core: CORES[Math.floor(this.R(0, 4))], tr: [], age: 0 });
  }
  hit(a, P) {
    const g = this.g;
    if (a.L === 'sand') {
      this.sand.impact(a.ax, a.r, P.bio, a.row);
      g.shake = Math.max(g.shake, 0.1 + a.r * 0.014);
      this.flash = Math.max(this.flash, 0.25 + a.r * 0.02);
      this.burst('sand', a.x, a.y, a.core, 14 + a.r * 2, a.r * 2.2);
    } else if (a.L === 'near') {
      g.shake = Math.max(g.shake, 0.45); this.flash = Math.max(this.flash, 0.7);
      this.burst('near', a.x, a.y, a.core, 40, 26);
      g.puff(a.x, a.y, '#ffb347', 14, 220, 0.6); g.puff(a.x, a.y, rgba(a.core), 12, 170, 0.8);
      this.scars.push({ x: a.x, y: a.y, t: g.t, s: this.R(0.8, 1.3), c: a.core, bio: P.bio, seed: this.rng() });
      if (this.scars.length > 24) this.scars.shift();
    } else {
      this.burns.push({ i: a.L, x: a.x, y: a.y, t: 0, life: this.R(8, 16), bio: this.rng() < P.bio, c: a.core });
      if (this.burns.length > 40) this.burns.shift();
      this.burst(a.L, a.x, a.y, a.core, 6 + a.L * 3, 4 + a.L * 3);
      this.flash = Math.max(this.flash, 0.05 + a.L * 0.04);
    }
  }
  burst(L, x, y, core, n, sp) {
    this.fx.push({ L, x, y, vx: 0, vy: 0, l: 0, m: 0.35, s: sp * 3, k: 'flash', c: [255, 230, 180] });
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * this.R(0.05, 0.95), v = sp * this.R(2, 7);
      this.fx.push({ L, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, m: this.R(0.4, 1.1), s: this.R(0.8, 2) * (L === 'near' ? 1.6 : 1), k: 'spark', c: this.rng() < 0.4 ? core : [255, 150 + this.R(0, 80), 50] });
    }
    if (this.fx.length > 500) this.fx.splice(0, this.fx.length - 500);
  }
  stepFx(dt, P) {
    for (const f of this.fx) { f.l += dt; f.vy += (f.k === 'spark' ? 160 : 0) * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    this.fx = this.fx.filter((f) => f.l < f.m);
    for (const b of this.burns) {
      b.t += dt;
      if (this.rng() < dt * 5 && this.smk.length < 160) this.smk.push({ i: b.i, x: b.x + this.R(-2, 2), y: b.y - 2, vx: this.R(2, 8), vy: -this.R(6, 14) * (1 + b.i * 0.4), l: 0, m: this.R(3, 6), s: (3 + b.i * 2) * this.R(0.8, 1.4), bio: b.bio });
    }
    this.burns = this.burns.filter((b) => b.t < b.life);
    for (const s of this.smk) { s.l += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.s += dt * (2 + s.i); }
    this.smk = this.smk.filter((s) => s.l < s.m);
    // ghosts on the rooftops of the sand city: pale ones while it stands, watchers with lit eyes after
    this.nextGhost -= dt;
    if (this.nextGhost <= 0 && this.ghosts.length < 2) {
      this.nextGhost = this.R(5, 12);
      const S = this.sand, Lx = this.g.camX * PF, ax = Math.floor((Lx + this.R(W * 0.55, W * 1.1)) / CS), y = S.surface(ax);
      if (y > 8 && y < SGH - ROCKH - 2) this.ghosts.push({ x: ax * CS + 1, y: y * CS, t: 0, life: this.R(4, 8), k: P.bio > 0.4 ? 1 : 0, ph: this.R(0, TAU), h: this.R(13, 19) });
    }
    for (const q of this.ghosts) q.t += dt;
    this.ghosts = this.ghosts.filter((q) => q.t < q.life);
  }
  stepWeather(dt, cx) {
    const P = this.P, dx = this.lastCx == null ? 0 : cx - this.lastCx; this.lastCx = cx;
    while (this.wx.length < 70) this.wx.push(this.newWx(this.R(0, W), this.R(0, H)));
    for (const p of this.wx) {
      p.x -= dx * p.z; p.l += dt;
      if (p.k === 0) { p.x += p.vx * dt; p.y += p.vy * dt; }
      else if (p.k === 1) { p.x += (p.vx + Math.sin(p.l * 2 + p.ph) * 8) * dt; p.y += p.vy * dt; }
      else { p.x += Math.sin(p.l * 1.3 + p.ph) * 10 * dt + p.vx * dt; p.y += p.vy * dt; }
      if (p.x < -20 || p.x > W + 20 || p.y > H + 10 || p.y < -20) Object.assign(p, this.newWx(p.x < -20 ? W + 10 : p.x > W + 20 ? -10 : this.R(0, W), p.y > H + 10 ? -10 : p.y < -20 ? H + 5 : this.R(0, H)));
    }
  }
  newWx(x, y) {
    const P = this.P, r = this.rng(), k = r < P.wA ? 0 : r < P.wA + P.wB ? 1 : 2, z = this.R(0.6, 1.5);
    if (k === 0) return { k, x, y, z, vx: -60 * z, vy: 300 * z, l: 0, ph: 0 };
    if (k === 1) { const ember = this.rng() < 0.4; return { k, x, y, z, vx: -8, vy: ember ? -this.R(10, 30) : this.R(12, 30), ember, l: 0, ph: this.R(0, TAU) }; }
    return { k, x, y, z, vx: this.R(-6, 6), vy: -this.R(4, 16), l: 0, ph: this.R(0, TAU), c: CORES[Math.floor(this.R(0, 3))] };
  }

  // ---------------------------------------------------------------- drawing, back to front
  back(c) {
    this.update();
    const g = this.g, A = this.A, P = this.P, cx = g.camX, cy = g.camY, ws = [P.wA, P.wB, P.wC];
    const low = [0, 1, 2].map((k) => { let s = 0, n = 0; for (let j = 0; j < 3; j++) if (A.skies[j]) { s += A.skies[j].low[k] * ws[j]; n += ws[j]; } return n ? s / n : HAZE[0][k] * 0.6; });
    // the trails mutator: the sky and the far city only partly cover the last frame, so what moves smears
    const ta = g.mods.trails && g.t > 0.5 ? 0.25 : 1;
    const sy = this.skyY(), sky = A.skies.some((k, j) => k && j < 3 && ws[j] > 0.01);
    c.globalAlpha = ta; c.fillStyle = rgba(low);
    if (sky && ta === 1) c.fillRect(0, sy + 298, W, H - sy - 298); else c.fillRect(0, 0, W, H); // the sky is opaque: fill only below it
    // the sky: the three moods crossfaded, tiled slowly
    let acc = 0;
    for (let k = 0; k < 3; k++) {
      const sk = A.skies[k], w = ws[k]; if (!sk || w < 0.01) continue;
      acc += w; c.globalAlpha = (w / acc) * ta;
      this.tile(c, sk.sky, cx * 0.02, sy);
    }
    c.globalAlpha = 1;
    if (!A.skies[0]) { const gr = c.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#120f0c'); gr.addColorStop(1, '#4a3a26'); c.fillStyle = gr; c.fillRect(0, 0, W, 300); }
    // the far layers, each with its own asteroids, fires and smoke
    for (let i = 0; i < 4; i++) {
      const y = this.layerY(i);
      for (let k = 0; k < 3; k++) { const sk = (k === 2 && i % 2 && A.skies[3]) || A.skies[k], w = ws[k]; if (!sk || w < 0.01) continue; c.globalAlpha = Math.min(1, w * 1.35) * ta; this.tile(c, sk.layers[i], cx * LF[i], y + sk.oys[i]); }
      c.globalAlpha = 1;
      this.drawLayerFx(c, i, -cx * LF[i], y);
    }
    // haze between the skyline and the sand city
    this.fogBand(c, cx * 0.2, Math.round(this.sandY() + 150), 120, 0.5);
    // the sand city, its ghosts, its glow and the asteroids that strike it
    const S = this.sand, sx = Math.round(S.c0 * CS - cx * PF), ssy = this.sandY(), bot = ssy + SGH * CS;
    S.draw(c, sx, ssy);
    // below the street: the foundations, falling away into the dark (so a pit reads as a pit)
    if (bot < H) {
      c.save(); c.translate(-Math.round(cx * PF), 0); c.fillStyle = this.pat(c, A.faceOf('under')); c.fillRect(Math.round(cx * PF), bot - 1, W, Math.min(40, H - bot + 1)); c.restore();
      const gr = c.createLinearGradient(0, bot, 0, bot + 40); gr.addColorStop(0, 'rgba(5,3,4,0.7)'); gr.addColorStop(1, 'rgba(2,1,2,1)');
      c.fillStyle = gr; c.fillRect(0, bot - 1, W, H - bot + 1);
    }
    this.drawGhosts(c, -Math.round(cx * PF), ssy);
    this.fogBand(c, cx * 0.42, bot - 120, 110, 0.42);
    S.drawGlow(c, sx, ssy, this.lightK > 0.5 ? 1 : 0.55);
    this.drawLayerFx(c, 'sand', -cx * PF, ssy);
  }
  tile(c, img, off, y) {
    const w = img.width, x0 = -(((off % w) + w) % w);
    for (let x = Math.round(x0); x < W; x += w) c.drawImage(img, x, y);
  }
  fogBand(c, off, y, h, a) {
    const P = this.P, ws = [P.wA, P.wB, P.wC], f = this.A.fog;
    c.save(); c.imageSmoothingEnabled = true;
    for (let k = 0; k < 3; k++) {
      if (ws[k] < 0.01) continue;
      c.globalAlpha = a * ws[k];
      const w = 512, x0 = -((((off + this.g.t * 6) % w) + w) % w);
      for (let x = x0; x < W; x += w) c.drawImage(f[k], Math.round(x), y, w, h);
    }
    c.restore();
  }
  // asteroids, trails, sparks, fires and smoke that belong to layer L, offset (ox, oy) to the screen
  drawLayerFx(c, L, ox, oy) {
    const A = this.A, G = A.glow, far = typeof L === 'number';
    c.save();
    // smoke first, under the fire
    if (far) for (const s of this.smk) {
      if (s.i !== L) continue;
      const k = s.l / s.m, x = s.x + ox, y = s.y + oy; if (x < -40 || x > W + 40) continue;
      c.globalAlpha = (1 - k) * 0.35 * Math.min(1, s.l * 3); c.filter = 'none';
      c.drawImage(A.smoke, x - s.s, y - s.s, s.s * 2, s.s * 2);
    }
    c.globalCompositeOperation = 'lighter';
    if (far) for (const b of this.burns) {
      if (b.i !== L) continue;
      const x = b.x + ox, y = b.y + oy; if (x < -30 || x > W + 30) continue;
      const k = Math.min(1, b.t * 3) * Math.min(1, (b.life - b.t) / 2), fl = 0.75 + 0.25 * Math.sin(this.g.t * 13 + b.x), r = (5 + L * 3) * fl;
      c.globalAlpha = k * 0.8; this.tintGlow(c, b.bio ? b.c : [255, 120, 30], x, y, r * 2.2);
      c.globalAlpha = k; this.tintGlow(c, b.bio ? [230, 255, 220] : [255, 210, 120], x, y, r * 0.7);
    }
    for (const a of this.ast) {
      if (a.L !== L) continue;
      for (const p of a.tr) {
        const k = p.l / p.m, x = p.x + ox, y = p.y + oy;
        c.globalAlpha = (1 - k) * 0.7;
        this.tintGlow(c, k < 0.25 ? [255, 230, 160] : k < 0.6 ? [255, 120, 30] : [140, 40, 20], x, y, p.s * (1 + k * 1.5));
      }
      if (!a.dead) { const x = a.x + ox, y = a.y + oy; c.globalAlpha = 1; this.tintGlow(c, [255, 160, 60], x, y, a.s * 3.2); this.tintGlow(c, a.core, x, y, a.s * 1.6); this.tintGlow(c, [255, 255, 240], x, y, a.s * 0.7); }
    }
    for (const f of this.fx) {
      if (f.L !== L) continue;
      const k = f.l / f.m, x = f.x + ox, y = f.y + oy;
      if (f.k === 'flash') { c.globalAlpha = (1 - k) * 0.9; this.tintGlow(c, f.c, x, y, f.s * (0.6 + k)); }
      else { c.globalAlpha = 1 - k; c.fillStyle = rgba(f.c); c.fillRect(x - f.s / 2, y - f.s / 2, f.s, f.s); }
    }
    c.restore();
  }
  // the glow sprite, tinted: a tinted copy per colour is kept (colours are few and fixed)
  tintGlow(c, col, x, y, r) {
    const key = col[0] * 65536 + col[1] * 256 + col[2];
    let s = (this.tints ||= new Map()).get(key);
    if (!s) { s = mk(64, 64); const x2 = s.getContext('2d'); x2.drawImage(this.A.glow, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = rgba(col); x2.fillRect(0, 0, 64, 64); this.tints.set(key, s); }
    c.drawImage(s, x - r, y - r, r * 2, r * 2);
  }
  drawGhosts(c, ox, oy) {
    const t = this.g.t;
    for (const q of this.ghosts) {
      const x = q.x + ox, y = q.y + oy; if (x < -20 || x > W + 20) continue;
      const near = Math.min(1, Math.max(0, (x - W * 0.3) / (W * 0.25))), a = Math.min(1, q.t / 1.2) * Math.min(1, (q.life - q.t) / 1.2) * near * (0.75 + 0.25 * Math.sin(t * 7 + q.ph));
      if (a <= 0.01) continue;
      const h = q.h, sw = Math.sin(t * 1.3 + q.ph) * 0.8;
      c.save(); c.globalAlpha = a * (q.k ? 0.85 : 0.22);
      c.fillStyle = q.k ? '#07040a' : '#cfe4ee';
      c.beginPath(); c.moveTo(x - h * 0.22 + sw, y); c.lineTo(x - h * 0.13 + sw * 0.5, y - h * 0.72); c.lineTo(x + h * 0.13 + sw * 0.5, y - h * 0.72); c.lineTo(x + h * 0.22 + sw, y); c.fill();
      c.beginPath(); c.ellipse(x + sw * 0.3, y - h * 0.82, h * 0.1, h * 0.13, 0, 0, TAU); c.fill();
      if (q.k) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; this.tintGlow(c, [255, 60, 90], x - 1 + sw * 0.3, y - h * 0.83, 2.4); this.tintGlow(c, [255, 60, 90], x + 1.5 + sw * 0.3, y - h * 0.83, 2.4); }
      c.restore();
    }
  }
  // in world coordinates, with the play layer: the growth an asteroid left where it struck
  scarsWorld(c, x0, x1) {
    const t = this.g.t;
    for (const s of this.scars) {
      if (s.x < x0 - 60 || s.x > x1 + 60) continue;
      const age = t - s.t, k = Math.min(1, age / 2.5), R = mulberry32(Math.floor(s.seed * 1e6));
      c.save();
      c.fillStyle = 'rgba(8,4,4,0.75)'; c.beginPath(); c.ellipse(s.x, s.y + 1, 26 * s.s, 3, 0, 0, TAU); c.fill();
      for (let i = 0; i < 9; i++) {
        const dx = (R() - 0.5) * 46 * s.s, hh = (4 + R() * 12) * k * s.s, col = CORES[Math.floor(R() * 3)], fl = 0.7 + 0.3 * Math.sin(t * 3 + i);
        if (R() < 0.5) { const ln = (R() - 0.5) * 3; c.fillStyle = '#7a9a64'; c.beginPath(); c.moveTo(s.x + dx - 2, s.y); c.lineTo(s.x + dx + ln, s.y - hh * 1.4); c.lineTo(s.x + dx + 2, s.y); c.fill(); c.fillStyle = rgba(col); c.fillRect(s.x + dx + ln - 1, s.y - hh * 1.4 - 1, 2, 2); }
        else { c.strokeStyle = '#2f8a50'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(s.x + dx, s.y); c.quadraticCurveTo(s.x + dx + 4, s.y - hh * 0.6, s.x + dx + (R() - 0.5) * 6, s.y - hh); c.stroke(); c.fillStyle = rgba(col); c.fillRect(s.x + dx - 1.5, s.y - hh - 1.5, 3, 3); }
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * fl * k; this.tintGlow(c, col, s.x + dx, s.y - hh, 7); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      if (age < 6) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, 1 - age / 6) * 0.8; this.tintGlow(c, [255, 120, 30], s.x, s.y - 4, 30 * s.s); }
      c.restore();
    }
  }
  // ---------------------------------------------------------------- in front of the play layer
  front(c) {
    const g = this.g, P = this.P, cx = g.camX, cy = g.camY, t = g.t;
    this.drawLayerFx(c, 'near', -cx, -cy);
    this.foreground(c, cx, cy, t);
    // weather: drizzle in the murk, ash and embers in the burning, spores rising in the bloom
    c.save();
    for (const p of this.wx) {
      if (p.k === 0) { c.globalAlpha = 0.22 * p.z; c.strokeStyle = '#a8b8c0'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 2 * p.z, p.y + 9 * p.z); c.stroke(); }
      else if (p.k === 1) { if (p.ember) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8; this.tintGlow(c, [255, 130, 40], p.x, p.y, 2.5 * p.z); c.globalCompositeOperation = 'source-over'; } else { c.globalAlpha = 0.45; c.fillStyle = '#5a524a'; c.fillRect(p.x, p.y, 1.6 * p.z, 1.6 * p.z); } }
      else { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 + 0.35 * Math.sin(p.l * 3 + p.ph); this.tintGlow(c, p.c, p.x, p.y, 3 * p.z); c.globalCompositeOperation = 'source-over'; }
    }
    c.restore();
    // the grade: a wash of the mood's colour, the stutter's dark, a strike's flash, the vignette, the grain
    const ws = [P.wA, P.wB, P.wC];
    let ga = 0; const gc = [0, 0, 0];
    for (let k = 0; k < 3; k++) { const q = GRADE[k], w = ws[k] * q[3]; ga += w; for (let j = 0; j < 3; j++) gc[j] += q[j] * w; }
    if (ga > 0.005) { c.fillStyle = `rgba(${(gc[0] / ga) | 0},${(gc[1] / ga) | 0},${(gc[2] / ga) | 0},${ga})`; c.fillRect(0, 0, W, H); }
    if (this.dark > 0) { c.fillStyle = `rgba(0,0,0,${this.dark})`; c.fillRect(0, 0, W, H); }
    if (this.flash > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,190,130,${Math.min(0.35, this.flash * 0.4)})`; c.fillRect(0, 0, W, H); c.restore(); }
    this.vf = ((this.vf || 0) + 1) % 9;
    c.drawImage(this.A.vigs[(this.vf / 3) | 0], 0, 0);
  }
  // hanging cables, pipes and signs at the top, wreckage below; tendrils, bulbs and fronds once it turns
  foreground(c, cx, cy, t) {
    const F = 1.35, fx = cx * F, B = 170, b0 = Math.floor(fx / B) - 1, oy = -cy * 0.12;
    const face = this.A.faceOf('ruin');
    c.save();
    for (let b = b0; b <= b0 + Math.ceil(W / B) + 2; b++) {
      const r = h1(b * 1.37 + 0.5), x = b * B - fx + h1(b * 7.1) * 60, bio = sstep(0.3, 0.85, tAt((b * B) / F)), sil = bio > 0.5 ? '#0a0610' : '#0a0807';
      if (r < 0.28) continue;
      const top = r < 0.64, k = h1(b * 3.3);
      c.fillStyle = sil; c.strokeStyle = sil;
      if (top) {
        if (k < 0.5) { // cables (or tendrils) sagging between two points above the screen
          const L = 120 + h1(b * 5.7) * 160, n = 1 + Math.floor(h1(b * 9.1) * 3);
          for (let j = 0; j < n; j++) {
            const sag = 22 + j * 9 + h1(b + j) * 30 + Math.sin(t * 0.8 + b) * 2, y0 = -6 + oy;
            c.lineWidth = bio > 0.5 ? 3.5 - j : 2 - j * 0.4; c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + L / 2, y0 + sag * 2, x + L, y0); c.stroke();
            if (bio > 0.5) for (let q = 1; q < 5; q++) { const u = q / 5, px = x + L * u, py = y0 + sag * 2 * 2 * u * (1 - u) + 4; c.fillStyle = sil; c.beginPath(); c.ellipse(px, py, 3, 4.5, 0, 0, TAU); c.fill(); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 + 0.3 * Math.sin(t * 2 + q + b); this.tintGlow(c, CORES[(b + q) % 3], px, py + 1, 6); c.restore(); }
          }
        } else { // a pipe or a sign hanging down (a frond of tendrils, later)
          const hh = 30 + h1(b * 2.9) * 50 + oy;
          if (bio > 0.5) { c.lineWidth = 2.5; for (let j = 0; j < 4; j++) { const sx = x + j * 7, sw = Math.sin(t * 1.1 + j + b) * 4; c.beginPath(); c.moveTo(sx, -4); c.quadraticCurveTo(sx + sw, hh * 0.6, sx + sw * 1.5, hh + j * 6); c.stroke(); } }
          else { c.fillStyle = this.pat(c, face); c.fillRect(x, -4, 12, hh); c.fillStyle = 'rgba(6,5,4,0.82)'; c.fillRect(x, -4, 12, hh); c.fillStyle = sil; c.fillRect(x - 5, hh - 4, 22, 5); if (k > 0.8) { c.fillRect(x - 18, hh, 46, 18); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + (Math.sin(t * 17 + b) > 0.7 ? 0.25 : 0); c.fillStyle = '#ff3d6e'; c.fillRect(x - 14, hh + 5, 38, 2); c.restore(); } }
        }
      } else { // below: wreckage textured with a ruined facade (or a frond and a fungus stalk)
        const by = H + 4 + oy * 0.5, hh = 26 + h1(b * 4.4) * 44;
        if (bio > 0.5) {
          c.lineWidth = 3; c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + 10, by - hh, x + 34 + Math.sin(t + b) * 3, by - hh * 1.1); c.stroke();
          for (let q = 0; q < 6; q++) { const u = q / 6, px = x + 10 * u + 24 * u * u, py = by - hh * (u * 1.05); c.beginPath(); c.ellipse(px, py, 9, 2.5, -0.6 - u, 0, TAU); c.fill(); }
          c.beginPath(); c.moveTo(x + 36, by); c.lineTo(x + 43, by - hh * 1.6); c.lineTo(x + 50, by); c.fill();
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45; this.tintGlow(c, CORES[b & 1 ? 1 : 2], x + 43, by - hh * 1.6, 10); c.restore();
        } else {
          c.beginPath(); c.moveTo(x - 10, by); for (let q = 0; q <= 8; q++) c.lineTo(x + q * 10, by - hh * (0.4 + 0.6 * Math.sin((q / 8) * Math.PI)) * (0.7 + h1(b * 11 + q) * 0.4)); c.lineTo(x + 90, by); c.closePath();
          c.fillStyle = this.pat(c, face); c.fill(); c.fillStyle = 'rgba(6,5,4,0.8)'; c.fill();
          c.fillStyle = sil; c.save(); c.translate(x + 30, by - hh * 0.7); c.rotate(-0.4 - k * 0.5); c.fillRect(-4, -40, 8, 60); c.restore();
        }
      }
    }
    c.restore();
  }
}
