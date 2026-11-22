// Bladeview's pictures. The walls come from Vitriol's GREEBLEWORKS (procedural cyber facades: concrete,
// windows, greebles, pipes, signage, wear, grime, crushed to a palette), then get Hell Maze's grit and
// dither (grime.js, no gore) and a pixel-sorted streak or two, like rain running down a wall. The
// people come from Vitriol's MERC FORGE, set up as civilians: coats, hoods, satchels, no armour, the
// gun all but gone. Also here: the neon signs (glyph stacks, no words), the billboards' slow
// simulations (Conway's Life, Langton's ant, rule 110, Brian's brain) and the ads' Markov-chain
// poetry, kept dim. Everything is cached and shared between views.
import { mulberry32 } from './util.js';
import { grimePixels } from './grime.js';

const GEN = new URL('../ext/vitriol/src/gen/', import.meta.url).href;
let loading = null;
const script = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(`could not load ${src}`)); document.head.append(s); });
export const loadGen = () => (loading ||= Promise.all([window.GREEBLEWORKS || script(`${GEN}greebleworks.js`), window.MERCFORGE || script(`${GEN}mercforge.js`), window.CRAWLERFORGE || script(`${GEN}crawlerforge.js`)]).then(() => ({ GW: window.GREEBLEWORKS, MF: window.MERCFORGE, CF: window.CRAWLERFORGE })));

const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
const BASE = { mode: 'level', palette: 'sodium', dither: 0.45, greeble: 0.75, pipes: 0.7, windows: 0.6, neon: 0.3, grime: 0.8, wear: 0.65, relief: 1, lightdir: 315, platKind: 'auto',
  skyMood: 'coldrain', cloud: 0.8, glow: 0.7, horizon: 0.7, weatherAmt: 0.9, cloudScale: 1, cloudStretch: 1.1, cloudSharp: 0.4, cloudDetail: 1, cloudTurb: 0.4, cloudHeight: 0.7,
  cityLayers: 5, cityDens: 1.45, cityMass: 1.6, cityVar: 0.9, cityWidth: 1.1, cityOverlap: 1.6, cityHaze: 1.3, cityContrast: 0.7, cityDetail: 0.75, cityWin: 0.5, citySkyway: 0.9, cityRuin: 0.1, cityLights: 0.4, cityBlimps: 0.4, fog: 1.2, weather: 'auto' };

// pixel-sorted streaks: here and there a short run of a column sorted by brightness, the light sinking,
// the way rain and rust run down concrete
function streaks(d, w, h, share, seed) {
  const R = mulberry32(seed), seg = [];
  for (let x = 0; x < w; x++) {
    if (R() > share) continue;
    const y0 = Math.floor(R() * h), len = 4 + Math.floor(R() * 14);
    seg.length = 0;
    for (let q = 0; q < len; q++) { const j = (((y0 + q) % h) * w + x) * 4; seg.push([d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11, d[j], d[j + 1], d[j + 2]]); }
    seg.sort((a, b) => a[0] - b[0]);
    for (let q = 0; q < len; q++) { const j = (((y0 + q) % h) * w + x) * 4, c = seg[q]; d[j] = c[1]; d[j + 1] = c[2]; d[j + 2] = c[3]; }
  }
}
// the grit pass over a baked canvas: Hell Maze's grime without the gore, then the streaks
export function grit(cv, seed = 1, o = {}) {
  const c = cv.getContext('2d', { willReadFrequently: true }), im = c.getImageData(0, 0, cv.width, cv.height);
  grimePixels(im.data, cv.width, cv.height, { gore: 0, melt: 0, sat: o.sat ?? 0.72, levels: o.levels ?? 12, shade: 0 });
  streaks(im.data, cv.width, cv.height, o.streak ?? 0.12, seed);
  c.putImageData(im, 0, 0);
  return cv;
}

// ------------------------------------------------ baking, a slice at a time
// A queue of greebleworks generators run in small time slices, so the card never stalls; each job's
// result is cached by its key.
const baked = new Map(), queue = [];
export function want(key, make) {
  if (baked.has(key)) return baked.get(key);
  const job = { key, gen: null, make, out: null, done: false };
  baked.set(key, job); queue.push(job);
  return job;
}
export function pump(ms = 6) {
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < ms) {
    const j = queue[0];
    try {
      j.gen ||= j.make();
      if (typeof j.gen?.next !== 'function') { j.out = j.finish ? j.finish(j.gen) : j.gen; j.done = true; queue.shift(); continue; }
      const r = j.gen.next();
      if (r.done) { j.out = j.finish ? j.finish(r.value) : r.value; j.done = true; queue.shift(); }
    } catch (e) { console.warn('bladeview bake', j.key, e); j.done = true; j.failed = true; queue.shift(); }
  }
  if (baked.size > 160) for (const [k, j] of baked) { if (baked.size <= 120) break; if (j.done && !j.keep) baked.delete(k); }
  return queue.length;
}
// a wall tile: greebleworks' facade (64² from a 192² bake) with the grit on top
export function facade(GW, style, palette, seed) {
  const job = want(`f|${style}|${palette}|${seed}`, () => GW.bakeFacade({ ...BASE, style, palette, outW: 64, outH: 64, SS: 3, tileX: true, tileY: true, seed, neon: 0.25 + (seed % 5) * 0.08 }));
  job.finish ||= (v) => grit(v.final, seed);
  return job;
}
export function platform(GW, style, palette, seed) {
  const job = want(`p|${style}|${palette}|${seed}`, () => GW.bakePlatform({ ...BASE, style, palette, outW: 64, outH: 20, SS: 3, seed }));
  job.finish ||= (v) => grit(v.final, seed, { streak: 0.04 });
  return job;
}
// the sky: greebleworks' sky with its layers of far city, at a mood for the hour and the weather
export function sky(GW, mood, palette, seed) {
  const job = want(`s|${mood}|${palette}|${seed}`, () => GW.bakeSky({ ...BASE, style: 'kowloon', palette, skyMood: mood, outW: 256, outH: 128, SS: 2, seed }));
  job.finish ||= (v) => grit(v.final, seed, { streak: 0.03, sat: 0.85, levels: 10 });
  return job;
}

// ------------------------------------------------ the people
// civilians from the merc forge: no helmets or a hood, a coat in a dull colour, a satchel now and then,
// the gun shrunk to nothing, a walk instead of a run. Cops (full helmet, a lit visor) now and then.
export function citizen(MF, seed) {
  const job = want(`c|${seed}`, () => {
    const R = mulberry32(seed), pick = (a) => a[(R() * a.length) | 0], hsl = MF.hsl;
    // what they wear: the outfit sets the coat's length, the head, the bag; the colours are the
    // city's: wet browns, greys, olive, navy, oxblood, black, the odd faded colour
    const OUT = [
      { w: 4, coat: [0.5, 0.72], hat: ['brim', 'none', 'none'], belt: 1 },       // a trench coat
      { w: 3, coat: [0.7, 0.9], hat: ['none', 'hood', 'brim'] },                 // a long dark coat
      { w: 3, coat: [0.12, 0.22], hat: ['none', 'cap', 'beanie'] },              // a short jacket
      { w: 3, coat: [0.1, 0.18], hat: ['hood'] },                                // a hoodie
      { w: 2, coat: [0, 0], skirt: 1, hat: ['none', 'none', 'beanie'] },         // a skirt and a top
      { w: 2, coat: [0.3, 0.45], hat: ['cap'], work: 1 },                        // a worker's coat
      { w: 1, coat: [0.45, 0.55], hat: ['cap'], cop: 1 }                         // the police
    ];
    let t = R() * OUT.reduce((s, o) => s + o.w, 0), o = OUT[0];
    for (const q of OUT) if ((t -= q.w) < 0) { o = q; break; }
    const coatH = o.cop ? 220 : o.work ? pick([28, 40, 75]) : pick([25, 30, 35, 210, 220, 0, 350, 80, 40]);
    const coatS = o.cop ? 26 : o.work ? 34 : pick([6, 10, 14, 20, 28]), coatL = o.cop ? 20 : pick([12, 16, 20, 24, 30]);
    const skin = pick([[28, 46, 70], [26, 42, 58], [22, 38, 44], [20, 34, 32], [24, 30, 24], [30, 28, 62]]);
    const hair = R() < 0.08 ? hsl(pick([180, 320, 10]), 40, 34) : hsl(pick([25, 30, 20, 0]), pick([10, 20, 30]), pick([8, 12, 18, 30, 55]));
    const p = Object.assign({}, MF.P_DEFAULTS, MF.randomParams(seed), {
      civ: true, coat: o.coat[0] + R() * (o.coat[1] - o.coat[0]), skirt: !!o.skirt, hat: pick(o.hat), scarf: !o.work && !o.cop && R() < 0.3,
      bag: o.cop || o.work ? 'none' : pick(['none', 'none', 'shoulder', 'shoulder', 'case']), armSwing: 0.6 + R() * 0.6,
      gun: 'pistol', gunSize: 0.04, twoHanded: false, aimRows: 1, antenna: false, corrupt: 0, growths: 0, rotVeins: 0, pads: 0, plates: false, armour: 0, helmet: 'none',
      backpack: R() < 0.12 ? 'pack' : 'none', gloveSize: 0, bootSize: 0.2 + R() * 0.3, height: 23 + ((R() * 8) | 0), headSize: 0.78 + R() * 0.16,
      limbThick: 0.04 + R() * 0.012, shoulderW: 0.26 + R() * 0.08, stride: 0.13 + R() * 0.06, lift: 0.045, bounce: 0.01, runLean: 2, lean: R() < 0.2 ? 5 : 1,
      colSuit: hsl(coatH, coatS, coatL), colSuit2: hsl(pick([220, 30, 0, 200]), pick([4, 8, 12]), 7 + R() * 9), colAccent: hsl(pick([0, 20, 45, 200, 160, 300]), 20 + R() * 25, 22 + R() * 18),
      colSkin: hsl(...skin), colVisor: hair, colGun: hsl(pick([25, 30, 220, 0]), pick([8, 14, 20]), 10 + R() * 10), grit: 0.9
    });
    return MF.forge(p);
  });
  job.finish ||= (sh) => { const cv = mk(sh.canvas.width, sh.canvas.height); cv.getContext('2d').drawImage(sh.canvas, 0, 0); grit(cv, seed, { streak: 0, sat: 0.6, levels: 16 }); return { cv, CW: sh.CW, CH: sh.CH, run: sh.colOf('run', 0), runN: sh.framesOf('run'), idle: sh.colOf('idle', 0), idleN: sh.framesOf('idle') }; };
  return job;
}

// one of Vitriol's abominations, grown big and idle: a Crawlerforge body (its idle frames) and its
// tentacle strips, both put through the grit; the scene hangs it in the sky and lets it drift
export function abomination(CF, seed) {
  const job = want(`ab|${seed}`, () => {
    const R = mulberry32(seed ^ 0xab0), pick = (a) => a[(R() * a.length) | 0], size = 44 + ((R() * 14) | 0);
    return CF.forge(Object.assign({}, CF.P_DEFAULTS, CF.randomParams(seed), {
      size, lobes: 5 + ((R() * 5) | 0), chaos: 0.5 + R() * 0.5, tentacles: 7 + ((R() * 5) | 0), tentVariants: 3,
      tentLen: Math.round(size * (1.9 + R() * 0.7)), tentThick: Math.max(8, Math.round(size * 0.24)), tentTaper: 0.5 + R() * 0.25,
      eyes: 3 + ((R() * 5) | 0), palette: pick(['raw', 'necrotic', 'deepsea', 'void', 'rust', 'ember', 'bile', 'chrome']), SS: 2, pullFrames: 1, hurtFrames: 1
    }));
  });
  job.finish ||= (sh) => {
    const body = mk(sh.canvas.width, sh.CH); body.getContext('2d').drawImage(sh.canvas, 0, 0); grit(body, seed, { streak: 0, sat: 0.7, levels: 16 });
    const tc = mk(sh.tentacles.canvas.width, sh.tentacles.canvas.height); tc.getContext('2d').drawImage(sh.tentacles.canvas, 0, 0); grit(tc, seed + 1, { streak: 0, sat: 0.7, levels: 16 });
    return { body, CW: sh.CW, CH: sh.CH, idle: sh.colOf('idle', 0), idleN: sh.framesOf('idle'), tent: { ...sh.tentacles, canvas: tc }, sockets: sh.physics.sockets, eyes: sh.physics.eyes, centre: sh.physics.centre, anchor: sh.anchor };
  };
  return job;
}

// ------------------------------------------------ small things, drawn here
const cache = new Map();
const memo = (key, fn) => { let v = cache.get(key); if (!v) cache.set(key, (v = fn())); return v; };
// a glow: a soft dithered disc
export const glow = (col) => memo(`g|${col}`, () => { const cv = mk(32, 32), c = cv.getContext('2d'), g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, col); g.addColorStop(0.35, col.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); return cv; });
// the rooftop gardens' plants: a shrub, a small tree, tall grasses, a vine on a frame; leaves dark and dithered
export const plant = (k) => memo(`pl|${k}`, () => {
  const cv = mk(24, 32), c = cv.getContext('2d'), R = mulberry32(k * 31 + 7), leaf = ['#2a4a2e', '#355a34', '#3e6a3a', '#24402a'], kind = k % 4;
  if (kind === 1) { c.fillStyle = '#2a1e16'; c.fillRect(11, 14, 2, 18); }
  if (kind === 3) { c.fillStyle = '#3a3a40'; c.fillRect(4, 4, 1, 28); c.fillRect(19, 4, 1, 28); c.fillRect(4, 4, 16, 1); }
  const n = kind === 2 ? 0 : 18;
  for (let q = 0; q < n; q++) { const x = kind === 1 ? 12 + (R() - 0.5) * 18 : 12 + (R() - 0.5) * 16, y = kind === 1 ? 6 + R() * 12 : kind === 3 ? 6 + R() * 24 : 14 + R() * 16, r = 2 + R() * 3; c.fillStyle = leaf[(R() * 4) | 0]; c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, 7); c.fill(); }
  if (kind === 2) for (let q = 0; q < 14; q++) { const x = 3 + R() * 18; c.fillStyle = leaf[(R() * 4) | 0]; c.fillRect(x, 8 + R() * 10, 1, 24); }
  for (let q = 0; q < 6; q++) { c.fillStyle = 'rgba(160,220,140,.5)'; c.fillRect(4 + R() * 16, 6 + R() * 20, 1, 1); }
  grit(cv, k + 3, { streak: 0, sat: 0.7, levels: 16 });
  return cv;
});
// steam and smoke
export const puff = () => memo('puff', () => { const cv = mk(32, 32), c = cv.getContext('2d'), R = mulberry32(9); for (let q = 0; q < 7; q++) { const x = 8 + R() * 16, y = 8 + R() * 16, r = 6 + R() * 6, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(200,205,210,.35)'); g.addColorStop(1, 'rgba(200,205,210,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); } return cv; });
// a neon sign: a vertical or horizontal strip of glyphs (shapes, not letters) in a lit tube colour
const NEON = ['#ff4f8b', '#54e0ff', '#ffb020', '#ff6a3d', '#8fe36a', '#c070ff', '#ff3a3a'];
export function neonSign(seed, vertical) {
  return memo(`n|${seed}|${vertical ? 1 : 0}`, () => {
    const R = mulberry32(seed), n = 3 + ((R() * 4) | 0), col = NEON[(R() * NEON.length) | 0], cell = 12, w = vertical ? cell + 4 : n * cell + 4, h = vertical ? n * cell + 4 : cell + 4, cv = mk(w, h), c = cv.getContext('2d');
    c.fillStyle = '#0a0808'; c.fillRect(0, 0, w, h); c.strokeStyle = col; c.lineWidth = 1.4; c.lineCap = 'square';
    for (let k = 0; k < n; k++) {
      const ox = vertical ? 2 : 2 + k * cell, oy = vertical ? 2 + k * cell : 2;
      c.beginPath();
      for (let s = 0; s < 3 + ((R() * 3) | 0); s++) { const a = [ox + 2 + ((R() * 3) | 0) * 3.5, oy + 2 + ((R() * 3) | 0) * 3.5], b = R() < 0.5 ? [a[0] + 3.5 * (1 + ((R() * 2) | 0)), a[1]] : [a[0], a[1] + 3.5 * (1 + ((R() * 2) | 0))]; c.moveTo(Math.min(a[0], ox + 10), Math.min(a[1], oy + 10)); c.lineTo(Math.min(b[0], ox + 10), Math.min(b[1], oy + 10)); }
      c.stroke();
    }
    return { cv, col };
  });
}

// ------------------------------------------------ the billboards' slow simulations
// Each runs on a small grid and is drawn dim, in one tint, onto its own canvas; a step every so often.
export class Sim {
  constructor(kind, seed, w = 48, h = 32, tint = '#54e0ff') {
    this.kind = kind; this.w = w; this.h = h; this.tint = tint; this.R = mulberry32(seed);
    this.cv = mk(w, h); this.c = this.cv.getContext('2d'); this.im = this.c.createImageData(w, h);
    this.a = new Uint8Array(w * h); this.b = new Uint8Array(w * h); this.t = 0; this.gen = 0;
    this.reset();
  }
  reset() {
    const { a, R, w, h } = this;
    a.fill(0); this.gen = 0;
    if (this.kind === 'life' || this.kind === 'brain') for (let i = 0; i < a.length; i++) a[i] = R() < 0.3 ? 1 : 0;
    else if (this.kind === 'rule') { this.row = new Uint8Array(w); this.row[w >> 1] = 1; for (let i = 0; i < w; i++) if (R() < 0.15) this.row[i] = 1; }
    else if (this.kind === 'ant') { this.ax = w >> 1; this.ay = h >> 1; this.ad = 0; }
  }
  step() {
    const { a, b, w, h } = this;
    this.gen++;
    if (this.kind === 'life' || this.kind === 'brain') {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += a[((y + dy + h) % h) * w + ((x + dx + w) % w)] === 1 ? 1 : 0;
        const i = y * w + x, v = a[i];
        b[i] = this.kind === 'life' ? (v ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0) : v === 1 ? 2 : v === 2 ? 0 : n === 2 ? 1 : 0;
      }
      a.set(b);
      let alive = 0; for (let i = 0; i < a.length; i++) alive += a[i] === 1 ? 1 : 0;
      if (alive < 6 || this.gen > 600) this.reset();
    } else if (this.kind === 'rule') {
      // rule 110, scrolling up the board a row at a time
      const r = this.row, nr = new Uint8Array(w);
      for (let x = 0; x < w; x++) { const k = (r[(x - 1 + w) % w] << 2) | (r[x] << 1) | r[(x + 1) % w]; nr[x] = (110 >> k) & 1; }
      a.copyWithin(0, w); a.set(nr, (h - 1) * w); this.row = nr;
      if (this.gen > 400) this.reset();
    } else {
      // Langton's ant: a few steps a tick, the highway emerging after a while
      for (let s = 0; s < 6; s++) {
        const i = this.ay * w + this.ax;
        this.ad = (this.ad + (a[i] ? 3 : 1)) % 4; a[i] = a[i] ? 0 : 1;
        this.ax = (this.ax + [0, 1, 0, -1][this.ad] + w) % w; this.ay = (this.ay + [-1, 0, 1, 0][this.ad] + h) % h;
      }
      if (this.gen > 2200) this.reset();
    }
    this.paint();
  }
  paint() {
    const d = this.im.data, { a } = this, t = this.tint, r = parseInt(t.slice(1, 3), 16), g = parseInt(t.slice(3, 5), 16), bl = parseInt(t.slice(5, 7), 16);
    for (let i = 0; i < a.length; i++) { const v = a[i], k = v === 1 ? 0.85 : v === 2 ? 0.35 : 0.06; d[i * 4] = r * k; d[i * 4 + 1] = g * k; d[i * 4 + 2] = bl * k; d[i * 4 + 3] = 255; }
    this.c.putImageData(this.im, 0, 0);
  }
}

// ------------------------------------------------ Markov-chain poetry for the advertisements
// A small corpus, written for this, of the city talking to itself at three in the morning. An
// order-one chain over its words makes new lines; they scroll by slowly on the ad panels.
const CORPUS = `the rain remembers every face it has touched
we were sold the sky in instalments
somewhere above the clouds there is a sun nobody pays for
every window is a life lit from inside and switched off at dawn
the city dreams in neon and wakes in rust
nothing is real until the lights go out
your memories are on sale this week only
we built the towers to reach heaven and lived in the basement
the dark between the signs is the only honest light
if you listen the pipes are singing
a ghost walks the walkways counting doors
tomorrow is a rumour the old men tell
everything you love is rented
the street is wet with all the words nobody said
somewhere a machine is lonely
the smoke rises and forgets the fire
we are what the light leaves behind
under the city there is another city and under that the sea
the sky is a screen with nothing on
every umbrella is a small house
you were promised a garden and given a view
the dead still pay their subscriptions
the wires carry voices and the voices carry rain
listen the stairs go down forever
a pigeon owns the roof and nobody else
time is the slowest train in the city
we sleep in shifts and dream in turns
all the stars were bought by the same company
the fog is the city breathing out
somebody is always awake on the forty third floor
hope is a vending machine that takes old coins
the light at the end of the tunnel is an advertisement
we keep the plants alive so they will remember us`;
let CHAIN = null;
function chain() {
  if (CHAIN) return CHAIN;
  CHAIN = new Map();
  for (const line of CORPUS.split('\n')) { const w = ['^', ...line.trim().split(/\s+/), '$']; for (let i = 0; i < w.length - 1; i++) { const k = w[i]; if (!CHAIN.has(k)) CHAIN.set(k, []); CHAIN.get(k).push(w[i + 1]); } }
  return CHAIN;
}
export function poem(R) {
  const C = chain();
  for (let tries = 0; tries < 6; tries++) {
    const out = []; let k = '^';
    for (let i = 0; i < 16; i++) { const L = C.get(k); if (!L) break; k = L[Math.floor(R() * L.length)]; if (k === '$') break; out.push(k); }
    if (out.length >= 4 && out.length <= 13) return out.join(' ');
  }
  return 'the rain remembers';
}
// an ad panel: dark glass, a thin lit frame, a line of poetry crawling across it
export class Crawl {
  constructor(seed, w = 96, h = 16, col = '#ffb020') {
    this.R = mulberry32(seed); this.w = w; this.h = h; this.col = col; this.cv = mk(w, h); this.c = this.cv.getContext('2d'); this.x = w; this.text = poem(this.R);
  }
  step(dx = 1) {
    const c = this.c, w = this.w, h = this.h;
    c.fillStyle = '#06070a'; c.fillRect(0, 0, w, h);
    c.fillStyle = this.col; c.globalAlpha = 0.25; c.fillRect(0, 0, w, 1); c.fillRect(0, h - 1, w, 1); c.globalAlpha = 0.7;
    c.font = `${h - 6}px ui-monospace, monospace`; c.textBaseline = 'middle';
    c.fillText(this.text, this.x, h / 2 + 1);
    c.globalAlpha = 1;
    this.x -= dx;
    if (this.x < -c.measureText(this.text).width - 8) { this.x = w; this.text = poem(this.R); }
  }
}
export { NEON };
