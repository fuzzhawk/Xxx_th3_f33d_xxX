// Garden: one shared world, saved on the phone, that grows in real time. Every garden card opens the
// same world. Tap to walk; plant, water and harvest; feed the animals (fed pairs have young); clear
// tall grass, rubble and mist to explore. The meadows have lakes (build plank bridges out to the
// islands), forests, flower fields and rocky hills; cave mouths lead down into the dark caverns; the
// Cloud Stair, once uncovered, climbs to the sky islands. The light follows the feed: pastel spring
// in the morning, lively weather in the day, dusk in the evening. On autopilot the gardener only
// waters, wanders and visits the animals; planting, clearing, building and exploring are yours.
// There is no text anywhere: everything is told with light, sparkles, hearts and small icons.
import { Game, W, H } from './engine.js';
import { Actor } from '../crystal/sprites.js';
import { getMode } from '../modes.js';
import * as Wd from './garden-world.js';

const { T, CH, HR, WATER, PATH, STONE, BRIDGE, ROCK, PORTAL, VOID, PLANTS, ANIMALS, COMMON, REALM_NAME, stageOf, FRUIT_CAP, ix, inside, now, palFor } = Wd;
const Z = 1.5, VW = W / Z, VH = H / Z, CP = CH * T;
const MODES = ['morning', 'day', 'evening'];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Water that moves: a small height-field ripple simulation over the visible water (2-pixel cells).
// Ducks, fish, rain, wind and new bridges disturb it; it is drawn as light and shadow pixels.
// per light: the grade (multiply colour and strength, how much colour drains), the mist colour and
// strength of the near and far banks, and the bloom
const ATMOS = {
  morning: { dim: '#84949a', dimA: 0.95, desat: 0.24, mistCol: [178, 196, 212], mist: [0.42, 0.3], bloom: 0.34 },
  day: { dim: '#929f92', dimA: 0.92, desat: 0.24, mistCol: [214, 226, 222], mist: [0.42, 0.3], bloom: 0.45 },
  evening: { dim: '#7d7690', dimA: 0.62, desat: 0.12, mistCol: [176, 156, 210], mist: [0.42, 0.3], bloom: 0.55 },
  cave: { dim: '#a09cb0', dimA: 0.4, desat: 0.1, mistCol: [110, 122, 156], mist: [0.3, 0.2], bloom: 0.5 }
};
// tileable mist: two octaves of smooth value noise, posterised into four soft levels with a Bayer
// dither between them, so it reads as pixel fog rather than a blur
const mistCache = new Map();
function mistTex(layer, col) {
  const key = `${layer}|${col}`;
  if (mistCache.has(key)) return mistCache.get(key);
  const S = 128, cv = Object.assign(document.createElement('canvas'), { width: S, height: S }), c = cv.getContext('2d'), img = c.createImageData(S, S), d = img.data;
  let seed = 1013 + layer * 7919; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grid = (n) => { const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = rnd(); return (x, y) => { const X = (x / S) * n, Y = (y / S) * n, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), at = (i, j) => g[((j + n) % n) * n + ((i + n) % n)]; return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy; }; };
  const n1 = grid(layer ? 3 : 4), n2 = grid(layer ? 7 : 9), B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = n1(x, y) * 0.7 + n2(x, y) * 0.3; v = Math.min(1, Math.max(0, (v - 0.5) / 0.32));
    const lv = v * 4, base = Math.floor(lv), frac = lv - base, step = Math.min(4, base + (frac * 16 > B[(y & 3) * 4 + (x & 3)] ? 1 : 0));
    const i = (y * S + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = Math.round((step / 4) * 255);
  }
  c.putImageData(img, 0, 0);
  mistCache.set(key, cv);
  return cv;
}

class Ripples {
  constructor() { this.w = Math.ceil((VW + 64) / 2); this.h = Math.ceil((VH + 64) / 2); this.a = new Float32Array(this.w * this.h); this.b = new Float32Array(this.w * this.h); this.m = new Uint8Array(this.w * this.h); this.ox = -1e9; this.oy = -1e9; this.dirty = true; }
  anchor(cam, Rm) {
    const ox = Math.floor((cam.x - VW / 2 - 32) / 2), oy = Math.floor((cam.y - VH / 2 - 32) / 2), dx = ox - this.ox, dy = oy - this.oy;
    if (Rm !== this.Rm) { this.Rm = Rm; this.a.fill(0); this.b.fill(0); this.ox = ox; this.oy = oy; this.dirty = true; }
    else if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      // slide the water along with the camera, keeping the waves
      for (const k of ['a', 'b']) {
        const o = this[k], n = new Float32Array(o.length);
        for (let j = 0; j < this.h; j++) { const sj = j + dy; if (sj < 0 || sj >= this.h) continue; for (let i = 0; i < this.w; i++) { const si = i + dx; if (si >= 0 && si < this.w) n[j * this.w + i] = o[sj * this.w + si]; } }
        this[k] = n;
      }
      this.ox = ox; this.oy = oy; this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
        const tx = ((this.ox + i) * 2 + 1) >> 4, ty = ((this.oy + j) * 2 + 1) >> 4;
        this.m[j * this.w + i] = inside(Rm, tx, ty) && Rm.ground[ix(Rm, tx, ty)] === WATER ? 1 : 0;
      }
    }
  }
  // a soft, round drop (a single-cell poke rings as a checkerboard on this grid)
  poke(x, y, s) {
    const i = Math.floor(x / 2) - this.ox, j = Math.floor(y / 2) - this.oy;
    if (i < 3 || j < 3 || i >= this.w - 3 || j >= this.h - 3 || !this.m[j * this.w + i]) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const k = (j + dy) * this.w + i + dx; if (this.m[k]) this.a[k] += s * Math.exp(-(dx * dx + dy * dy) / 1.2); }
  }
  step() {
    const { w, h, a, b, m } = this;
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { const k = j * w + i; b[k] = m[k] ? ((a[k - 1] + a[k + 1] + a[k - w] + a[k + w]) * 0.5 - b[k]) * 0.975 : 0; }
    this.a = b; this.b = a;
  }
  draw(c, cx, cy, light, dark) {
    const { w, h, a, m } = this, i0 = Math.max(1, Math.floor(cx / 2) - this.ox), j0 = Math.max(1, Math.floor(cy / 2) - this.oy), i1 = Math.min(w - 1, i0 + VW / 2 + 2), j1 = Math.min(h - 1, j0 + VH / 2 + 2);
    for (const [col, sign] of [[light, 1], [dark, -1]]) {
      c.fillStyle = col;
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = j * w + i; if (m[k] && (a[k - 1] - a[k + 1] + a[k - w] - a[k + w]) * sign > 0.3) c.fillRect((this.ox + i) * 2 - cx, (this.oy + j) * 2 - cy, 2, 2); }
    }
  }
}

export class Garden extends Game {
  constructor(canvas, post) { super(canvas, { ...post, mods: [] }); }
  static state() { return Wd.G; }      // for tests
  setup() {
    this.mode = MODES.includes(this.post.mode) ? this.post.mode : getMode();
    this.ready = false;
    this.cam = { x: 0, y: 0 };
    this.msgs = []; this.fx = []; this.pending = [];
    this.weather = { kind: 'calm', t: 0, until: 8 + Math.random() * 10, rain: [], wind: 1 };
    this.autoWait = 1.5; this.lastArrival = 0; this.lastSeed = 0; this.growAcc = 0; this.seenAcc = 0; this.saveAcc = 0;
    this.hero = { actor: new Actor(this.skin.crystal(0, 'Fantasy'), { mode: 'eight', walkSpeed: 10, runSpeed: 70 }), path: [], task: null, busy: 0, x: 0, y: 0 };
    Wd.loadGarden().then((g) => {
      this.enter(g.realm);
      if (g.firstVisit) { this.hint = 9; g.firstVisit = 0; }
      else if (g.migrated) { this.say('Your garden has grown into a whole world'); this.say('Explore: lakes, forests, hills with caves, and something in the sky'); g.migrated = 0; }
      else if (g.away?.length) { this.say('While you were away…'); for (const m of g.away) this.say(m); g.away = []; }
      else this.greet();
    });
  }
  greet() {
    const r = Wd.G.realm;
    if (r === 'cave') this.say('Cool air and the drip of water');
    else if (r === 'sky') this.say(['Wind and wide sky', 'Clouds drift under your feet'][Math.floor(Math.random() * 2)]);
    else if (this.mode === 'morning') this.say(['Good morning, garden', 'Dew on everything', 'The bees are up early'][Math.floor(Math.random() * 3)]);
    else if (this.mode === 'evening') this.say(['The garden at dusk', 'Fireflies are out', 'Everything is settling down'][Math.floor(Math.random() * 3)]);
  }
  // step into a realm (on load, or through a cave mouth or the Cloud Stair)
  enter(realm, at = null) {
    const g = Wd.G;
    g.realm = realm;
    const Rm = this.Rm = g.R[realm];
    const first = !Rm.visited;
    Rm.visited = 1;
    if (at) Rm.hero = { x: at[0] * T + 8, y: at[1] * T + 12 };
    this.hero.x = Rm.hero.x; this.hero.y = Rm.hero.y; this.hero.path = []; this.hero.task = null;
    this.cam.x = this.hero.x; this.cam.y = this.hero.y - 16;
    for (const a of Rm.animals) if (a.tx === undefined) this.brain(a);
    this.amb = Array.from({ length: realm === 'cave' ? 22 : this.mode === 'evening' ? 26 : 18 }, () => ({ x: Math.random() * VW, y: Math.random() * VH, p: Math.random() * 6.28, s: 0.5 + Math.random() }));
    this.grass = new Map(); this.leaves = []; this.prints = []; this.rip ||= new Ripples();
    this.loadFlora();
    this.computeBlock();
    this.markSeen();
    this.ready = true;
    if (first && realm === 'cave') { this.say('Down into the caverns. Your lantern lights the way'); this.say('Clear the rubble to explore · glowshrooms grow only down here'); }
    if (first && realm === 'sky') { this.say('Up among the sky islands!'); this.say('Tap the cloud sea beside an island to step onto a cloud'); }
  }
  // today's wild plants (real sprites, a different handful each day)
  loadFlora() {
    const day = Wd.dayKey();
    if (this.floraDay === day) return;
    this.floraDay = day;
    Wd.floraToday(day).then((s) => { if (this.floraDay === day) this.flora = s; });
  }
  start() {
    super.start();
    if (this.ready && Garden.active !== this) {
      // back to the garden after a while in the feed: time has passed out there too
      if (now() - Wd.G.saved > 5 * 60e3) { const m = Wd.catchUp(Wd.G); if (m.length) { this.say('Since you last looked…'); m.forEach((x) => this.say(x)); } }
      this.enter(Wd.G.realm);
    }
    Garden.active = this;
  }
  stop() { const live = this.live; super.stop(); if (this.ready && live) { this.Rm.hero = { x: this.hero.x, y: this.hero.y }; Wd.saveGarden(); } }
  get live() { return this.ready && Garden.active === this; }
  hud() { return ''; }   // nothing to read: the garden speaks in pictures

  say(text) { this.msgs.push({ text, t: 0 }); if (this.msgs.length > 7) this.msgs.splice(0, this.msgs.length - 7); }

  // ---------------------------------------------- map helpers
  computeBlock() {
    const Rm = this.Rm, b = new Uint8Array(Rm.w * Rm.h);
    for (const p of Rm.plants) if (PLANTS[p.k].type === 'tree' && stageOf(p) >= 2) b[ix(Rm, p.x, p.y)] = 1;
    for (const r of Rm.ruins) {
      if (!r.found) continue;
      if (r.t === 'stones') { for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) b[ix(Rm, r.x + dx, r.y + dy)] = 1; continue; }
      if (r.solid) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) b[ix(Rm, x, y)] = 1;
    }
    this.block = b;
    // tiles where today's wild plants should not sprout
    const occ = this.occ = new Set();
    for (const p of Rm.plants) occ.add(ix(Rm, p.x, p.y));
    for (const p of Rm.portals) occ.add(ix(Rm, p.x, p.y));
    for (const d of Rm.decor) occ.add(ix(Rm, d.x, d.y));
    for (const r of Rm.ruins) if (r.found) for (let y = r.y - 1; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inside(Rm, x, y)) occ.add(ix(Rm, x, y));
  }
  open(x, y) { const Rm = this.Rm; if (!inside(Rm, x, y)) return false; const i = ix(Rm, x, y), g = Rm.ground[i]; return !Rm.wild[i] && g !== WATER && g !== ROCK && g !== VOID && !this.block[i]; }
  path(goal) {
    const Rm = this.Rm, sx = Math.floor(this.hero.x / T), sy = Math.floor((this.hero.y - 2) / T);
    const prev = new Int32Array(Rm.w * Rm.h).fill(-2), q = [ix(Rm, sx, sy)];
    prev[q[0]] = -1;
    for (let qi = 0; qi < q.length && qi < 9000; qi++) {
      const cur = q[qi], cx = cur % Rm.w, cy = (cur / Rm.w) | 0;
      if (goal(cx, cy)) { const out = []; for (let c = cur; c !== -1; c = prev[c]) out.push([c % Rm.w, (c / Rm.w) | 0]); return out.reverse(); }
      for (const [dx, dy] of N8) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.open(nx, ny) || prev[ix(Rm, nx, ny)] !== -2) continue;
        if (dx && dy && (!this.open(cx + dx, cy) || !this.open(cx, cy + dy))) continue;
        prev[ix(Rm, nx, ny)] = cur; q.push(ix(Rm, nx, ny));
      }
    }
    return null;
  }
  near(tx, ty, r = 1) { return (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= r; }
  goTo(goal, task) {
    // a new walk always wins: whatever the hero was doing ends now (its effect still lands)
    this.hero.actor.cancel(); this.hero.busy = 0;
    const p = this.path(goal);
    if (!p) { if (task) this.say('Can’t get there yet: clear a way through'); return false; }
    this.hero.path = p.slice(1).map(([x, y]) => [x * T + 8, y * T + 12]);
    this.hero.task = task;
    return true;
  }
  plantAt(x, y) { const Rm = this.Rm; return Rm.plants.find((p) => p.x === x && p.y === y) || Rm.plants.find((p) => PLANTS[p.k].type === 'tree' && stageOf(p) === 3 && Math.abs(p.x - x) <= 1 && y <= p.y && y >= p.y - 2); }

  // ---------------------------------------------- input
  tap(x, y) {
    if (!this.ready || this.fade) return;
    const Rm = this.Rm, wx = x / Z + this.cam.x - VW / 2, wy = y / Z + this.cam.y - VH / 2, tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (!inside(Rm, tx, ty)) return;
    this.fx.push({ kind: 'ring', x: wx, y: wy, t: 0, life: 0.5 });
    const a = Rm.animals.filter((o) => Math.hypot(o.x - wx, o.y - 4 - wy) < 14 && !(ANIMALS[o.k].night && this.mode !== 'evening')).sort((p, q) => Math.hypot(p.x - wx, p.y - wy) - Math.hypot(q.x - wx, q.y - wy))[0];
    if (a) { this.goTo(this.near(Math.floor(a.x / T), Math.floor(a.y / T), 1), { kind: 'animal', a }); return; }
    const i = ix(Rm, tx, ty), g = Rm.ground[i];
    // a way down, up or back
    const ruin = Rm.ruins.find((r) => r.found && tx >= r.x && tx < r.x + r.w && ty >= r.y - 1 && ty < r.y + r.h);
    const portal = Rm.portals.find((p) => (p.x === tx && p.y === ty) || (ruin && ruin.t === 'cloudstair' && p.kind === 'stair'));
    if (portal && (!portal.ruin || ruin?.found)) { this.goTo((x0, y0) => x0 === portal.x && y0 === portal.y, { kind: 'portal', p: portal }); return; }
    const plant = this.plantAt(tx, ty);
    if (plant) { this.goTo(this.near(plant.x, plant.y, 1), { kind: 'plant', p: plant }); return; }
    if (ruin) { this.goTo(this.near(ruin.x, ruin.y, 2), { kind: 'ruin', r: ruin }); return; }
    if (Rm.wild[i]) {
      const p = this.path((x0, y0) => this.frontierToward(x0, y0, tx, ty));
      if (!p) { this.say('Can’t reach that yet'); return; }
      const [ex, ey] = p[p.length - 1], t = this.frontierToward(ex, ey, tx, ty);
      this.hero.actor.cancel(); this.hero.busy = 0;
      this.hero.path = p.slice(1).map(([x0, y0]) => [x0 * T + 8, y0 * T + 12]);
      this.hero.task = { kind: 'clear', x: t[0], y: t[1] };
      return;
    }
    if (g === WATER || g === VOID) {
      // build out over the water (or the cloud sea) from the shore
      if (!N8.slice(0, 4).some(([dx, dy]) => this.open(tx + dx, ty + dy) || (inside(Rm, tx + dx, ty + dy) && Rm.ground[ix(Rm, tx + dx, ty + dy)] === BRIDGE))) { this.say(g === VOID ? 'Build out from an island edge: tap the cloud sea right beside it' : 'Build out from the shore: tap the water right beside the land'); return; }
      this.goTo((x0, y0) => Math.abs(x0 - tx) + Math.abs(y0 - ty) === 1, { kind: 'build', x: tx, y: ty });
      return;
    }
    if (g === ROCK) { this.say(Rm.name === 'cave' ? 'The cave wall is solid here' : 'Solid rock. Look for a cave mouth in the hills'); return; }
    this.goTo(this.near(tx, ty, 1), { kind: 'plant-here', x: tx, y: ty });
  }
  frontierToward(x, y, tx, ty) {
    const Rm = this.Rm;
    let best = null, bd = Infinity;
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!inside(Rm, nx, ny) || !Rm.wild[ix(Rm, nx, ny)]) continue;
      const d = Math.hypot(nx - tx, ny - ty);
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    return best && bd <= Math.hypot(x - tx, y - ty) + 0.01 ? best : null;
  }
  wisp() {
    const Rm = this.Rm, h = this.hero, hx = h.x / T, hy = h.y / T;
    const u = Rm.ruins.filter((r) => !r.found).sort((p, q) => Math.hypot(p.x - hx, p.y - hy) - Math.hypot(q.x - hx, q.y - hy))[0];
    if (!u || Math.hypot(u.x - hx, u.y - hy) < 3) return;
    const a = Math.atan2(u.y + u.h / 2 - hy, u.x + u.w / 2 - hx);
    for (let i = 1; i <= 11; i++) this.fx.push({ kind: 'trail', x: h.x + Math.cos(a) * i * 13 + Math.sin(i) * 3, y: h.y - 6 + Math.sin(a) * i * 13, t: -i * 0.16, life: 2.6 });
  }
  // which seed to sow on a tile, chosen for you: what suits the spot, then what you have most of,
  // turning through your seeds so a run of taps plants a mixed bed
  seedFor(x, y) {
    const g = Wd.G, Rm = this.Rm, cave = Rm.name === 'cave', gr = Rm.ground[ix(Rm, x, y)];
    const wet = N8.slice(0, 4).some(([dx, dy]) => inside(Rm, x + dx, y + dy) && Rm.ground[ix(Rm, x + dx, y + dy)] === WATER);
    const ok = Object.keys(g.inv.seeds).filter((k) => g.inv.seeds[k] > 0 && PLANTS[k] && !!PLANTS[k].cave === cave &&
      !(PLANTS[k].type === 'tree' && Rm.plants.some((p) => PLANTS[p.k].type === 'tree' && Math.hypot(p.x - x, p.y - y) < 2.5)));
    if (!ok.length) return null;
    const suits = (k) => (wet && k === 'reed' ? 3 : 0) + (gr === Wd.FOREST && (k === 'fern' || PLANTS[k].type === 'tree') ? 2 : 0) + (gr === Wd.FLOWERS && PLANTS[k].type === 'flower' ? 1 : 0) + (Rm.name === 'sky' && k === 'skyorchid' ? 2 : 0) + (k === this.lastSown ? -2 : 0);
    ok.sort((a, b) => suits(b) - suits(a) || g.inv.seeds[b] - g.inv.seeds[a]);
    return (this.lastSown = ok[0]);
  }

  // ---------------------------------------------- doing things
  act(task) {
    const h = this.hero, a = h.actor, t = now(), g = Wd.G, Rm = this.Rm;
    if (task.kind === 'clear') { a.attack(); h.busy = 0.45; this.later(0.35, () => this.clear(task.x, task.y)); }
    else if (task.kind === 'build') {
      a.cast(); h.busy = 0.5;
      this.later(0.4, () => {
        const i = ix(Rm, task.x, task.y);
        if (Rm.ground[i] !== WATER && Rm.ground[i] !== VOID) return;
        Rm.ground[i] = BRIDGE;
        Wd.invalidate(Rm, task.x - 1, task.y - 1, task.x + 1, task.y + 1);
        for (let k = 0; k < 6; k++) this.rip.poke(task.x * T + 2 + Math.random() * 12, task.y * T + 2 + Math.random() * 12, 5);
        this.rip.dirty = true;
        this.puff(task.x * T + 8, task.y * T + 8, Rm.name === 'sky' ? '#ffffff' : '#c8a070', 10);
        this.say(Rm.name === 'sky' ? 'You called a cloud to step on' : Rm.name === 'cave' ? 'Laid planks across the pool' : 'Built a little plank bridge');
        Wd.saveGarden(true);
      });
    } else if (task.kind === 'portal') {
      const p = task.p;
      a.emote(p.to === 'sky' ? 'surprise' : 'nod', 0.8); h.busy = 0.5;
      this.fade = { t: 0, p, col: p.to === 'cave' || Rm.name === 'cave' ? '#07050c' : '#ffffff' };
    } else if (task.kind === 'plant-here') {
      const gr = Rm.ground[ix(Rm, task.x, task.y)];
      if (Rm.plants.some((p) => p.x === task.x && p.y === task.y) || !this.open(task.x, task.y) || [STONE, PORTAL, BRIDGE].includes(gr)) return;
      const k = this.seedFor(task.x, task.y), P = PLANTS[k];
      // no seed that fits: a small shrug; gather seeds from blooming plants
      if (!k) { a.emote('shake', 0.6); h.busy = 0.3; return; }
      a.cast(); h.busy = 0.45;
      this.later(0.3, () => {
        Rm.plants.push({ k, x: task.x, y: task.y, g: 0.02, w: t, fr: 0, sd: 0 });
        g.inv.seeds[k]--;
        this.puff(task.x * T + 8, task.y * T + 12, '#a7835a', 8);
        this.say(`Planted a ${P.name.toLowerCase()}`);
        this.computeBlock(); Wd.saveGarden(true);
      });
    } else if (task.kind === 'plant') {
      const p = task.p, P = PLANTS[p.k], st = stageOf(p);
      a.cast(); h.busy = 0.5;
      this.later(0.35, () => {
        if (P.food && st === 3 && p.fr > 0) {
          g.inv.food += p.fr; this.say(`Picked ${p.fr} ${p.k === 'apple' ? 'apples' : p.k === 'lanterntree' ? 'lantern fruits' : 'handfuls of berries'}`);
          if (Math.random() < 0.35) { g.inv.seeds[p.k] = (g.inv.seeds[p.k] || 0) + 1; this.say(`…and a ${P.name.toLowerCase()} seed`); }
          p.fr = 0; this.puff(p.x * T + 8, p.y * T, P.fruit, 10);
        } else if (st === 3 && t - (p.sd || 0) > 2 * HR) {
          const n = P.type === 'tree' ? 1 : 1 + (Math.random() < 0.5 ? 1 : 0);
          g.inv.seeds[p.k] = (g.inv.seeds[p.k] || 0) + n; p.sd = t;
          this.say(P.type === 'tree' ? `Found a ${P.name.toLowerCase()} seed` : `Gathered ${n} ${P.name.toLowerCase()} seed${n > 1 ? 's' : ''}`); this.puff(p.x * T + 8, p.y * T + 4, '#e8d8a8', 8);
        } else this.water(p);
        Wd.saveGarden(true);
      });
    } else if (task.kind === 'water') { a.cast(); h.busy = 0.5; this.later(0.35, () => this.water(task.p, true)); }
    else if (task.kind === 'animal') {
      const o = task.a, A = ANIMALS[o.k];
      a.face(o.x < h.x ? 'W' : 'E');
      if (A.eats && g.inv.food > 0) {
        a.emote('love', 0.7); h.busy = 0.5; g.inv.food--; o.f = t; o.wait = 1.5;
        this.hearts(o.x, o.y - 10); this.say(`You fed the ${o.baby ? 'baby ' : ''}${o.k === 'cloudsheep' ? 'cloud sheep' : o.k}`);
        this.breed(o);
      } else {
        a.emote(A.eats ? 'wave' : 'love', 0.7); h.busy = 0.45; o.wait = 1.2; this.hearts(o.x, o.y - 8);
        if (A.eats && !g.inv.food) this.say('No food left: pick berries or apples');
      }
      Wd.saveGarden(true);
    } else if (task.kind === 'ruin') { a.emote('think', 0.8); h.busy = 0.5; this.say(`${task.r.name[0].toUpperCase()}${task.r.name.slice(1)}. ${task.r.lore}`); }
    else if (task.kind === 'pet') { a.emote('love', 0.6); h.busy = 0.4; this.hearts(task.a.x, task.a.y - 8); task.a.wait = 1; }
  }
  later(s, fn) { this.pending.push({ at: this.t + s, fn }); }
  water(p, quiet = false) {
    const P = PLANTS[p.k], before = stageOf(p), t = now();
    const boost = t - (p.w || 0) < 30e3 ? 0.01 : P.type === 'tree' ? 0.05 : P.type === 'shrub' ? 0.08 : 0.12;
    p.g = Math.min(1, p.g + boost); p.w = t;
    for (let i = 0; i < 8; i++) this.fx.push({ kind: 'drop', x: p.x * T + 8 + (Math.random() - 0.5) * 10, y: p.y * T - 6, vy: 20 + Math.random() * 30, t: 0, life: 0.6 });
    if (stageOf(p) > before) {
      this.puff(p.x * T + 8, p.y * T, P.petal || P.bloom || P.leaf || '#9fd88a', 12);
      this.say(stageOf(p) === 3 ? `The ${P.name.toLowerCase()} ${P.type === 'flower' ? 'bloomed' : 'is fully grown'}!` : `The ${P.name.toLowerCase()} grew`);
      if (stageOf(p) === 3) this.hero.actor.emote('cheer', 1.2);
      this.computeBlock();
    } else if (!quiet && boost < 0.02) this.say('Already watered: it needs time now');
  }
  clear(x, y) {
    const Rm = this.Rm, g = Wd.G, R = Math.random, i = ix(Rm, x, y);
    if (!Rm.wild[i]) return;
    Rm.wild[i] = 0;
    // each swing opens a little space around it
    for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (!inside(Rm, nx, ny)) continue; const j = ix(Rm, nx, ny); if (Rm.wild[j] === 1 && R() < 0.75) Rm.wild[j] = 0; else if (Rm.wild[j] === 2 && R() < 0.35) Rm.wild[j] = 1; }
    const P = palFor(Rm.name, this.mode), cols = Rm.name === 'cave' ? P.rubble : Rm.name === 'sky' ? ['#ffffff', '#f0f4ff', '#e8eef8'] : P.wild;
    for (let k = 0; k < 10; k++) this.fx.push({ kind: 'leaf', x: x * T + 8, y: y * T + 6, vx: (R() - 0.5) * 70, vy: -30 - R() * 50, t: 0, life: 0.9, c: cols[(R() * 3) | 0] });
    const r = Rm.ruins.find((u) => !u.found && x >= u.x - 1 && x <= u.x + u.w && y >= u.y - 1 && y <= u.y + u.h);
    if (r) {
      r.found = 1;
      for (let yy = r.y - 1; yy <= r.y + r.h; yy++) for (let xx = r.x - 1; xx <= r.x + r.w; xx++) {
        if (!inside(Rm, xx, yy)) continue;
        const j = ix(Rm, xx, yy), inFoot = yy >= r.y && yy < r.y + r.h && xx >= r.x && xx < r.x + r.w;
        Rm.wild[j] = 0;
        if (Rm.ground[j] !== WATER && Rm.ground[j] !== VOID && Rm.ground[j] !== ROCK) Rm.ground[j] = inFoot || r.t === 'glyphs' ? STONE : Rm.name === 'surface' ? PATH : Rm.ground[j];
      }
      Rm.plants = Rm.plants.filter((p) => !(p.x >= r.x - 1 && p.x <= r.x + r.w && p.y >= r.y - 1 && p.y <= r.y + r.h));
      g.inv.seeds[r.seed] = (g.inv.seeds[r.seed] || 0) + 3;
      Wd.invalidate(Rm, r.x - 2, r.y - 2, r.x + r.w + 1, r.y + r.h + 1);
      for (let i = 0; i < 3; i++) this.fx.push({ kind: 'glow', x: r.x * T + r.w * 8, y: r.y * T + r.h * 8, t: -i * 0.35, life: 1.6 });
      this.say(`You uncovered ${r.name}!`); this.say(r.lore);
      if (r.t === 'cloudstair') this.say('Walk up the stair to climb to the sky islands');
      this.say(`Inside: 3 ${PLANTS[r.seed].name.toLowerCase()} seeds`);
      this.hero.actor.emote('surprise', 1.5);
      this.puff(r.x * T + r.w * 8, r.y * T + r.h * 8, '#fff2b0', 24);
    } else if (R() < 0.16) {
      const k = Rm.name === 'cave' ? 'glowshroom' : Rm.name === 'sky' ? (R() < 0.5 ? 'skyorchid' : 'cosmos') : COMMON[(R() * 8) | 0];
      g.inv.seeds[k] = (g.inv.seeds[k] || 0) + 1; this.say(k === 'glowshroom' ? 'Found glowshroom spores in the rubble' : `Found a ${PLANTS[k].name.toLowerCase()} seed`);
    }
    Wd.invalidate(Rm, x - 1, y - 1, x + 1, y + 1);
    for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (inside(Rm, xx, yy)) this.grass.delete(ix(Rm, xx, yy));
    this.computeBlock(); this.markSeen();
    Wd.saveGarden(true);
  }
  breed(o) {
    const Rm = this.Rm, A = ANIMALS[o.k];
    if (o.baby || Wd.countKind(Rm, o.k) >= A.cap) return;
    const mate = Rm.animals.find((m) => m !== o && m.k === o.k && !m.baby && m.f && now() - m.f < 6 * HR);
    const name = o.k === 'cloudsheep' ? 'cloud sheep' : `${o.k}s`;
    if (!mate) { if (Wd.countKind(Rm, o.k) >= 2) this.say(`Feed another ${o.k === 'cloudsheep' ? 'cloud sheep' : o.k} too and they may have young`); return; }
    this.say(`The ${name} seem very happy together ♥`);
    this.hearts((o.x + mate.x) / 2, (o.y + mate.y) / 2 - 12);
    this.later(14 + Math.random() * 8, () => {
      if (Wd.countKind(Rm, o.k) >= A.cap) return;
      const b = Wd.addAnimal(Rm, o.k, o.x + 6, o.y + 3, 1); this.brain(b);
      this.say(`A baby ${o.k === 'cloudsheep' ? 'cloud sheep' : o.k} was born!`); this.hearts(b.x, b.y - 8); this.hero.actor.emote('cheer', 1.4);
      Wd.saveGarden(true);
    });
  }
  hearts(x, y) { for (let i = 0; i < 4; i++) this.fx.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 12, y, vy: -18 - Math.random() * 10, t: -i * 0.12, life: 1.2 }); }
  puff(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 20 + Math.random() * 40; this.fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0, life: 0.7, c }); } }
  // explored tiles around the hero (for the map), and first sightings
  markSeen() {
    const Rm = this.Rm, hx = Math.floor(this.hero.x / T), hy = Math.floor(this.hero.y / T), r = 9;
    for (let y = hy - r; y <= hy + r; y++) for (let x = hx - r; x <= hx + r; x++) {
      if (!inside(Rm, x, y) || (x - hx) ** 2 + (y - hy) ** 2 > r * r) continue;
      const i = ix(Rm, x, y);
      if (Rm.seen[i]) continue;
      Rm.seen[i] = 1; Wd.miniPaint(Rm, x, y);
      const g = Rm.ground[i];
      if (Rm.name === 'surface' && g === WATER && !Rm.saidLake) { Rm.saidLake = 1; this.say('A lake! Tap the water beside the shore to build a bridge'); }
      if (Rm.name === 'surface' && g === PORTAL && !Rm.saidCave) { Rm.saidCave = 1; this.say('A cave mouth in the hillside…'); }
      if (Rm.name === 'cave' && g === WATER && !Rm.saidLake) { Rm.saidLake = 1; this.say('An underground pool, perfectly still'); }
    }
  }

  // ---------------------------------------------- animals
  brain(a) { a.tx = a.x; a.ty = a.y; a.wait = Math.random() * 2; a.ph = Math.random() * 6.28; a.dir = Math.random() < 0.5 ? 1 : -1; }
  okFor(a, x, y) {
    const Rm = this.Rm, tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < 1 || ty < 1 || tx >= Rm.w - 1 || ty >= Rm.h - 1) return false;
    const A = ANIMALS[a.k], i = ix(Rm, tx, ty), g = Rm.ground[i];
    if (A.fly) return Rm.name !== 'cave' || g !== ROCK;
    if (A.water) return g === WATER;
    if (A.shore) return !Rm.wild[i] && g !== WATER && g !== ROCK && N8.some(([dx, dy]) => inside(Rm, tx + dx * 2, ty + dy * 2) && Rm.ground[ix(Rm, tx + dx * 2, ty + dy * 2)] === WATER);
    return !Rm.wild[i] && g !== WATER && g !== ROCK && g !== VOID && !this.block[i];
  }
  stepAnimal(a, dt) {
    const Rm = this.Rm, A = ANIMALS[a.k], lively = Rm.name === 'cave' ? 0.8 : this.mode === 'day' ? 1.35 : this.mode === 'evening' ? 0.75 : 1;
    if (A.night && this.mode !== 'evening') return;
    a.ph += dt * (A.fly ? 9 : 5) * lively;
    if (a.wait > 0) { a.wait -= dt; a.vx = a.vy = 0; return; }
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (d < 2) {
      a.wait = (A.fly ? 0.3 : 0.8) + Math.random() * (A.fly ? 1.5 : 3) / lively;
      let nx = a.x + (Math.random() - 0.5) * (A.fly ? 120 : 90), ny = a.y + (Math.random() - 0.5) * (A.fly ? 100 : 70);
      const mine = Rm.plants;
      if (['butterfly', 'bee', 'dragonfly', 'glowworm'].includes(a.k) && mine.length) { const p = mine[(Math.random() * mine.length) | 0]; if (Math.hypot(p.x * T - a.x, p.y * T - a.y) < 220) { nx = p.x * T + 8; ny = p.y * T - 4; } }
      if (['songbird', 'owl', 'squirrel'].includes(a.k) && Math.random() < 0.5) { const p = mine[(Math.random() * mine.length) | 0]; if (p && PLANTS[p.k].type === 'tree' && Math.hypot(p.x * T - a.x, p.y * T - a.y) < 260) { nx = p.x * T + 8 + (Math.random() - 0.5) * 10; ny = p.y * T - (stageOf(p) === 3 ? 30 : 16); } }
      if (this.mode === 'day' && !A.fly && Math.random() < 0.25) { const f = Rm.animals.find((o) => o !== a && o.k === a.k && Math.hypot(o.x - a.x, o.y - a.y) < 160); if (f) { nx = f.x + (Math.random() - 0.5) * 20; ny = f.y + (Math.random() - 0.5) * 20; a.wait = 0; } }
      if (this.okFor(a, nx, ny)) { a.tx = nx; a.ty = ny; }
      return;
    }
    const sp = A.speed * lively * (a.baby ? 0.85 : 1) * (A.fly ? 1 + Math.sin(a.ph) * 0.3 : 1);
    const mx = (dx / d) * Math.min(d, sp * dt), my = (dy / d) * Math.min(d, sp * dt);
    if (!A.fly && !this.okFor(a, a.x + mx, a.y + my)) { a.tx = a.x; a.ty = a.y; return; }
    a.x += mx; a.y += my; a.vx = mx / dt; a.vy = my / dt;
    if (A.water && Math.random() < 0.3) this.rip.poke(a.x, a.y, 1.6);
    if (Math.abs(mx) > 0.01) a.dir = mx > 0 ? 1 : -1;
  }

  // ---------------------------------------------- the loop
  step(dt) {
    if (!this.ready) return;
    const h = this.hero, Rm = this.Rm;
    for (const m of this.msgs) m.t += dt;
    while (this.msgs.length && this.msgs[0].t > 4.2 + (this.msgs.length > 1 ? 0 : 1.5)) { this.msgs.shift(); if (this.msgs[0]) this.msgs[0].t = 0; }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
    const due = this.pending.filter((p) => p.at <= this.t);
    if (due.length) { this.pending = this.pending.filter((p) => p.at > this.t); due.forEach((p) => p.fn()); }
    // through a cave mouth or up the stair: fade, switch realm, fade back
    if (this.fade) {
      const f = this.fade;
      f.t += dt;
      if (f.t >= 0.45 && !f.done) {
        f.done = true;
        Rm.hero = { x: h.x, y: h.y };
        this.enter(f.p.to, [f.p.tx, f.p.ty]);
        if (f.p.to === 'surface') this.say(Rm.name === 'cave' ? 'Back out into the daylight' : 'Down the Cloud Stair to the meadows');
        Wd.saveGarden(true);
      }
      if (f.t >= 0.9) this.fade = null;
    }
    // the hero
    let vx = 0, vy = 0;
    // actions never hold the hero still: the pose plays only while standing, walking cancels it
    if (h.busy > 0) { h.busy -= dt; if (h.busy <= 0) h.actor.cancel(); }
    if (h.path.length) {
      const [px0, py0] = h.path[0], dx = px0 - h.x, dy = py0 - h.y, d = Math.hypot(dx, dy), sp = this.auto ? 46 : 70;
      if (d < 1.5) h.path.shift();
      else { if (h.actor.a.action) { h.actor.cancel(); h.busy = 0; } const stp = Math.min(d, sp * dt); vx = (dx / d) * sp; vy = (dy / d) * sp; h.x += (dx / d) * stp; h.y += (dy / d) * stp; }
    } else if (h.task && h.busy <= 0) { const t = h.task; h.task = null; this.act(t); }
    h.vx = vx; h.vy = vy;
    h.actor.update(dt, { vx, vy });
    // footprints in sand and on paths
    if (vx || vy) {
      h.stride = (h.stride || 0) + Math.hypot(vx, vy) * dt;
      if (h.stride > 7) { h.stride = 0; h.foot = !h.foot; const g0 = this.Rm.ground[ix(this.Rm, Math.floor(h.x / T), Math.floor((h.y - 2) / T))]; if (g0 === Wd.SAND || g0 === PATH) (this.prints ||= []).push({ x: h.x + (h.foot ? 2 : -2), y: h.y, t: 0 }); }
    }
    const cR = this.Rm;
    this.cam.x += (h.x - this.cam.x) * Math.min(1, dt * 3);
    this.cam.y += (h.y - 16 - this.cam.y) * Math.min(1, dt * 3);
    this.cam.x = Math.max(VW / 2, Math.min(cR.w * T - VW / 2, this.cam.x));
    this.cam.y = Math.max(VH / 2, Math.min(cR.h * T - VH / 2, this.cam.y));
    if (!this.live) return;
    this.seenAcc += dt;
    if (this.seenAcc > 0.3) { this.seenAcc = 0; this.markSeen(); }
    // now and then a wisp of light drifts off toward something still hidden
    this.wispAcc = (this.wispAcc ?? 30) + dt;
    if (this.wispAcc > 45) { this.wispAcc = 0; this.wisp(); this.loadFlora(); }
    // nearby animals live; far ones wait for you
    for (const a of cR.animals) if (Math.abs(a.x - this.cam.x) < VW * 1.3 && Math.abs(a.y - this.cam.y) < VH * 1.3) this.stepAnimal(a, dt);
    this.growAcc += dt;
    if (this.growAcc >= 1) {
      const sec = this.growAcc; this.growAcc = 0;
      for (const p of cR.plants) {
        if (p.n && p.g >= 1) { if (PLANTS[p.k].food && Math.random() < sec / 5400) p.fr = Math.min(FRUIT_CAP[PLANTS[p.k].type] || 3, p.fr + 1); continue; }
        const P = PLANTS[p.k], before = stageOf(p);
        p.g = Math.min(1, p.g + sec / (P.hours * 3600));
        if (P.food && before === 3 && Math.random() < sec / 5400) p.fr = Math.min(FRUIT_CAP[P.type] || 3, p.fr + 1);
        if (stageOf(p) > before) { this.say(`The ${P.name.toLowerCase()} ${stageOf(p) === 3 ? 'bloomed' : 'grew'}`); this.computeBlock(); }
      }
    }
    if (this.t - this.lastArrival > 25) {
      this.lastArrival = this.t;
      cR.hero = { x: h.x, y: h.y };
      for (const m of Wd.arrivals(cR, 1)) { this.say(m); for (const a of cR.animals) if (a.tx === undefined) this.brain(a); }
    }
    if (this.t - this.lastSeed > 40) {
      this.lastSeed = this.t;
      const fl = cR.plants.filter((p) => !p.n && PLANTS[p.k].type === 'flower' && stageOf(p) === 3);
      if (fl.length && Math.random() < 0.3) { const p = fl[(Math.random() * fl.length) | 0], t = Wd.freeTile(cR, p.x, p.y, 2); if (t) { cR.plants.push({ k: p.k, x: t[0], y: t[1], g: 0.05, w: 0, fr: 0, sd: 0 }); this.say(`A ${PLANTS[p.k].name.toLowerCase()} seeded itself`); } }
    }
    this.stepWeather(dt);
    this.physAcc = (this.physAcc || 0) + dt;
    if (this.physAcc >= 1 / 60) { const pd = this.physAcc; this.physAcc = 0; this.rip.anchor(this.cam, cR); this.rip.step(); this.stepGrass(pd); this.stepPlants(pd); this.stepLeaves(pd); }
    this.saveAcc += dt;
    if (this.saveAcc > 20) { this.saveAcc = 0; cR.hero = { x: h.x, y: h.y }; Wd.saveGarden(); }
  }
  stepWeather(dt) {
    const w = this.weather, realm = this.Rm.name;
    w.t += dt;
    if (this.mode === 'day' && realm !== 'cave' && w.t > w.until) {
      // lively days: gusts, passing showers with a rainbow after, bright spells
      const next = w.kind === 'rain' ? 'rainbow' : (realm === 'sky' ? ['gust', 'sun', 'gust', 'calm'] : ['gust', 'rain', 'sun', 'gust', 'calm'])[Math.floor(Math.random() * (realm === 'sky' ? 4 : 5))];
      w.kind = next; w.t = 0; w.until = next === 'rain' ? 14 : next === 'rainbow' ? 9 : next === 'gust' ? 7 : 12 + Math.random() * 10;
      if (next === 'rain') this.say('A spring shower passes over');
      if (next === 'rainbow') this.say('A rainbow!');
    }
    const target = realm === 'cave' ? 0 : this.mode === 'evening' ? 0.5 : this.mode === 'morning' ? 0.8 : w.kind === 'gust' ? 3 : w.kind === 'rain' ? 1.6 : 1.1;
    w.wind += (target - w.wind) * Math.min(1, dt * 0.8);
    if (w.kind === 'rain' && this.mode === 'day' && realm === 'surface') {
      for (let i = 0; i < 4; i++) w.rain.push({ x: Math.random() * (VW + 40) - 20, y: -8, v: 180 + Math.random() * 80 });
      for (let i = 0; i < 2; i++) this.rip.poke(this.cam.x + (Math.random() - 0.5) * VW, this.cam.y + (Math.random() - 0.5) * VH, 3);
    }
    if (realm !== 'cave' && Math.random() < w.wind * 0.25) this.rip.poke(this.cam.x + (Math.random() - 0.5) * VW, this.cam.y + (Math.random() - 0.5) * VH, 1.1 * w.wind);
    for (const r of w.rain) r.y += r.v * dt;
    w.rain = w.rain.filter((r) => r.y < VH);
    const evening = this.mode === 'evening' || realm === 'cave';
    for (const p of this.amb) { p.p += dt * p.s; p.x += Math.sin(p.p) * 4 * dt + w.wind * (evening ? 1.5 : 7) * dt; p.y += (evening ? Math.cos(p.p * 0.7) * 3.5 : 6 + p.s * 4) * dt * (realm === 'cave' ? 0.4 : 1); if (p.x > VW + 6) p.x = -6; if (p.x < -6) p.x = VW + 6; if (p.y > VH + 6) { p.y = -6; p.x = Math.random() * VW; } if (p.y < -6) p.y = VH + 6; }
  }
  autopilot(dt) {
    if (!this.ready || this.fade || this.hero.path.length || this.hero.task || this.hero.busy > 0) return;
    this.autoWait -= dt;
    if (this.autoWait > 0) return;
    this.autoWait = 1.5 + Math.random() * 2.5;
    const Rm = this.Rm, h = this.hero, hx = h.x / T, hy = h.y / T, t = now(), roll = Math.random();
    // tend: water what is thirsty and close; otherwise visit an animal, a ruin, or wander
    const thirsty = Rm.plants.filter((p) => !p.n && t - (p.w || 0) > 15 * 60e3 && stageOf(p) < 3 && Math.hypot(p.x - hx, p.y - hy) < 10).sort((p, q) => Math.hypot(p.x - hx, p.y - hy) - Math.hypot(q.x - hx, q.y - hy));
    if (thirsty.length && roll < 0.6) { this.goTo(this.near(thirsty[0].x, thirsty[0].y, 1), { kind: 'water', p: thirsty[0] }); return; }
    const pets = Rm.animals.filter((a) => !ANIMALS[a.k].fly && !ANIMALS[a.k].water && Math.hypot(a.x / T - hx, a.y / T - hy) < 8);
    if (pets.length && roll < 0.8) { const a = pets[(Math.random() * pets.length) | 0]; this.goTo(this.near(Math.floor(a.x / T), Math.floor(a.y / T), 1), { kind: 'pet', a }); return; }
    const found = Rm.ruins.filter((r) => r.found && Math.hypot(r.x - hx, r.y - hy) < 24);
    if (found.length && roll < 0.88) { const r = found[(Math.random() * found.length) | 0]; this.goTo(this.near(r.x, r.y, 2), null); return; }
    for (let i = 0; i < 8; i++) {
      const tx = Math.round(hx + (Math.random() - 0.5) * 10), ty = Math.round(hy + (Math.random() - 0.5) * 8);
      if (this.open(tx, ty) && Rm.ground[ix(Rm, tx, ty)] !== PORTAL) { this.goTo((x, y) => x === tx && y === ty, null); return; }
    }
  }

  // ---------------------------------------------- physics: grass on springs, swaying plants, falling leaves
  windAt(x, t) {
    if (this.Rm.name === 'cave') return 0;
    const w = this.weather.wind;
    return w * (0.16 + 0.1 * Math.sin(t * 1.6 + x * 0.035) + 0.05 * Math.sin(t * 3.1 + x * 0.11)) * (this.weather.kind === 'gust' ? 1.6 : 1);
  }
  // who pushes the grass aside: the hero and the animals on foot, [x, y, vx, vy, mass]
  movers() {
    const h = this.hero, out = [[h.x, h.y, h.vx || 0, h.vy || 0, 1.4]];
    for (const a of this.Rm.animals) { const A = ANIMALS[a.k]; if (A.fly || A.water || Math.abs(a.x - this.cam.x) > VW || Math.abs(a.y - this.cam.y) > VH) continue; out.push([a.x, a.y, a.vx || 0, a.vy || 0, a.baby ? 0.5 : 0.8]); }
    return out;
  }
  stepGrass(dt) {
    const Rm = this.Rm, t = this.t, Gm = this.grass, mv = this.movers();
    const tx0 = Math.floor((this.cam.x - VW / 2) / T) - 1, ty0 = Math.floor((this.cam.y - VH / 2) / T) - 1, tw = Math.ceil(VW / T) + 3, th = Math.ceil(VH / T) + 3;
    for (let ty = ty0; ty < ty0 + th; ty++) for (let tx = tx0; tx < tx0 + tw; tx++) {
      if (!inside(Rm, tx, ty)) continue;
      const i = ix(Rm, tx, ty);
      let g = Gm.get(i);
      if (!g) { const b = Wd.bladesFor(Rm, tx, ty); if (!b || !b.length) continue; g = { a: 0, v: 0, b, i }; Gm.set(i, g); }
      const x = tx * T + 8, y = ty * T + 11;
      let f = (this.windAt(x + y * 0.3, t) - g.a) * 40 - g.v * 5;
      for (const [mx, my, vx, vy, m] of mv) { const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy; if (d2 > 225) continue; const sp = Math.min(1, Math.hypot(vx, vy) / 40); f += Math.sign(dx || vx || 1) * (1 - Math.sqrt(d2) / 15) * (0.3 + sp) * 300 * m; }
      g.v += f * dt; g.a = Math.max(-1.1, Math.min(1.1, g.a + g.v * dt)); g.seen = t;
    }
    if (Gm.size > 1600) for (const [k, g] of Gm) if (t - g.seen > 2) Gm.delete(k);
  }
  stepPlants(dt) {
    const sw = this.sway ||= new WeakMap(), mv = this.movers(), t = this.t;
    for (const p of this.Rm.plants) {
      const x = p.x * T + 8, y = p.y * T + 14;
      if (Math.abs(x - this.cam.x) > VW * 0.7 || Math.abs(y - this.cam.y) > VH * 0.7 || stageOf(p) === 0) continue;
      let s = sw.get(p); if (!s) { s = { a: 0, v: 0 }; sw.set(p, s); }
      const tree = PLANTS[p.k].type === 'tree';
      let f = (this.windAt(x, t) * (tree ? 0.22 : 0.55) - s.a) * (tree ? 14 : 30) - s.v * (tree ? 2.6 : 4);
      for (const [mx, my, vx, vy, m] of mv) {
        const dx = x - mx, dy = y - my;
        if (dx * dx + dy * dy > (tree ? 260 : 120)) continue;
        const sp = Math.min(1, Math.hypot(vx, vy) / 40);
        f += Math.sign(dx || vx || 1) * (0.3 + sp) * (tree ? 18 : 110) * m;
        if (tree && sp > 0.5 && Math.random() < dt * 3) this.dropLeaf(p);
      }
      s.v += f * dt; s.a = Math.max(-0.6, Math.min(0.6, s.a + s.v * dt));
    }
  }
  dropLeaf(p) {
    const k = p.k, col = k === 'cherry' ? (Math.random() < 0.5 ? '#ffd6e4' : '#ffffff') : k === 'birch' ? '#e8d870' : k === 'pine' ? '#5f8a5a' : this.mode === 'evening' ? '#d8a05a' : Math.random() < 0.6 ? '#8cc46a' : '#d8c060';
    if (this.leaves.length < 90) this.leaves.push({ x: p.x * T + 8 + (Math.random() - 0.5) * 22, y: p.y * T + 12 + Math.random() * 10, z: 18 + Math.random() * 16, vx: 0, vy: 0, fall: 7 + Math.random() * 7, ph: Math.random() * 6.28, t: 0, col, rest: false, life: 0 });
  }
  stepLeaves(dt) {
    const h = this.hero, wind = this.Rm.name === 'cave' ? 0 : this.weather.wind;
    // trees shed now and then, more in a gust
    if (this.Rm.name !== 'cave' && Math.random() < dt * wind * (this.weather.kind === 'gust' ? 3 : 0.8)) {
      const trees = this.Rm.plants.filter((p) => PLANTS[p.k].type === 'tree' && stageOf(p) === 3 && Math.abs(p.x * T - this.cam.x) < VW * 0.6 && Math.abs(p.y * T - this.cam.y) < VH * 0.6);
      if (trees.length) this.dropLeaf(trees[(Math.random() * trees.length) | 0]);
    }
    const hs = Math.hypot(h.vx || 0, h.vy || 0);
    for (const l of this.leaves) {
      if (l.rest) {
        l.life -= dt;
        // kicked up as you walk through
        if (hs > 20 && Math.abs(l.x - h.x) < 7 && Math.abs(l.y - h.y) < 5) { l.rest = false; l.z = 1; l.fall = 5; l.vx = (h.vx || 0) * 0.5 + (Math.random() - 0.5) * 30; l.vy = (h.vy || 0) * 0.4; l.up = 22; }
        continue;
      }
      l.t += dt;
      l.vx += (wind * 14 - l.vx) * dt * 1.2;
      l.x += (l.vx + Math.sin(l.t * 4 + l.ph) * 8) * dt; l.y += (l.vy || 0) * dt; l.vy = (l.vy || 0) * (1 - dt * 2);
      l.up = Math.max(0, (l.up || 0) - 60 * dt);
      l.z += (l.up - l.fall) * dt;
      if (l.z <= 0) { l.z = 0; l.rest = true; l.life = 6 + Math.random() * 6; }
    }
    this.leaves = this.leaves.filter((l) => !l.rest || l.life > 0);
    for (const f of this.prints) f.t += dt;
    this.prints = this.prints.filter((f) => f.t < 5);
  }

  // ---------------------------------------------- drawing: the world goes into a small pixel buffer, scaled up
  draw(c) {
    c.imageSmoothingEnabled = false;
    if (!this.ready) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, this.mode === 'evening' ? '#3a2a3a' : '#e8f4ea'); g.addColorStop(1, this.mode === 'evening' ? '#1a1418' : '#cfe8d2');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const sp = Wd.plantSprite('daisy', 2, false), k = 2.4 + Math.sin(performance.now() / 500) * 0.2;
      c.save(); c.translate(W / 2, H / 2 + 14); c.scale(k, k); c.drawImage(sp.cv, -sp.w / 2, -sp.h); c.restore();
      return;
    }
    this.buf ||= Object.assign(document.createElement('canvas'), { width: VW, height: VH });
    const b = this.buf.getContext('2d'), Rm = this.Rm, realm = Rm.name, cx = Math.round(this.cam.x - VW / 2), cy = Math.round(this.cam.y - VH / 2), t = this.t, P = palFor(realm, this.mode);
    b.setTransform(1, 0, 0, 1, 0, 0); b.imageSmoothingEnabled = false; b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    if (realm === 'sky') this.drawSkyBg(b); else { b.fillStyle = realm === 'cave' ? '#0d0a12' : '#3a4a3a'; b.fillRect(0, 0, VW, VH); }
    const x0 = Math.floor(cx / CP), x1 = Math.floor((cx + VW) / CP), y0 = Math.floor(cy / CP), y1 = Math.floor((cy + VH) / CP);
    const ok = (gx, gy) => gx >= 0 && gy >= 0 && gx * CH < Rm.w && gy * CH < Rm.h;
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) if (ok(gx, gy)) b.drawImage(Wd.chunk(Rm, this.mode, gx, gy).gc, gx * CP - cx, gy * CP - cy);
    if (realm !== 'sky') this.rip.draw(b, cx, cy, realm === 'cave' ? 'rgba(170,215,255,.45)' : 'rgba(255,255,255,.7)', realm === 'cave' ? 'rgba(0,0,10,.35)' : 'rgba(10,40,80,.22)');
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) if (ok(gx, gy)) b.drawImage(Wd.chunk(Rm, this.mode, gx, gy).wc, gx * CP - cx, gy * CP - cy);
    // footprints, then the live grass
    for (const f of this.prints) { b.globalAlpha = 0.35 * (1 - f.t / 5); b.fillStyle = '#5a4630'; b.fillRect(Math.round(f.x - cx), Math.round(f.y - cy), 2, 1); }
    b.globalAlpha = 1;
    this.drawGrass(b, cx, cy, P);
    for (const l of this.leaves) if (l.rest) { b.globalAlpha = Math.min(1, l.life / 2); b.fillStyle = l.col; b.fillRect(Math.round(l.x - cx), Math.round(l.y - cy), 2, 1); }
    b.globalAlpha = 1;
    // things, back to front
    const vis = (x, y, m = 48) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m * 2, items = [], sw = this.sway;
    for (const r of Rm.ruins) if (r.found) {
      if (r.t === 'stones') { for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) { const x = (r.x + dx) * T + 8, y = (r.y + dy) * T + 14; if (vis(x, y)) items.push([y, 'ruin', { t: 'stones', x, y }]); } }
      else if (r.t !== 'glyphs') { const x = r.x * T + r.w * 8, y = (r.y + r.h) * T - 1; if (vis(x, y)) items.push([y, 'ruin', { t: r.t, x, y }]); }
    }
    for (const d of Rm.decor) if (d.t === 'crystal') { const x = d.x * T + 8, y = d.y * T + 14; if (vis(x, y)) items.push([y, 'crystal', d]); }
    for (const p of Rm.plants) { const x = p.x * T + 8, y = p.y * T + 14; if (vis(x, y)) items.push([y, 'plant', p]); }
    if (this.flora) {
      const tx0 = Math.floor(cx / T) - 1, ty0 = Math.floor(cy / T) - 1, tx1 = tx0 + Math.ceil(VW / T) + 2, ty1 = ty0 + Math.ceil(VH / T) + 4;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (!inside(Rm, tx, ty) || this.occ?.has(ix(Rm, tx, ty))) continue;
        const f = Wd.floraAt(Rm, tx, ty, this.flora, this.floraDay);
        if (f) items.push([ty * T + 13, 'flora', { f, tx, ty }]);
      }
    }
    for (const a of Rm.animals) { if (ANIMALS[a.k].night && this.mode !== 'evening') continue; if (vis(a.x, a.y)) items.push([a.y + (ANIMALS[a.k].fly ? 30 : 0), 'animal', a]); }
    items.push([this.hero.y, 'hero']);
    items.sort((p, q) => p[0] - q[0]);
    for (const [, kind, o] of items) {
      if (kind === 'plant') {
        const st = stageOf(o), s = Wd.plantSprite(o.k, st, o.fr > 0), x = o.x * T + 8 - cx, y = o.y * T + 14 - cy, a = sw?.get(o)?.a || 0;
        if (!a) b.drawImage(s.cv, Math.round(x - s.w / 2), Math.round(y - s.h));
        else {
          // bend from the root: shift each row of the sprite by how far up it is (stays pixel-crisp)
          const rows = s.h, step = Math.max(2, Math.round(rows / 6));
          for (let r0 = 0; r0 < rows; r0 += step) { const hgt = Math.min(step, rows - r0), up = (rows - r0) / rows; b.drawImage(s.cv, 0, r0, s.w, hgt, Math.round(x - s.w / 2 + a * up * up * rows * 0.5), Math.round(y - s.h + r0), s.w, hgt); }
        }
      } else if (kind === 'flora') {
        // wild plants lean with the grass spring on their tile (wind, and anyone passing)
        const { s } = o.f, x = o.tx * T + 8 + o.f.dx - cx, y = o.ty * T + 13 - cy, a = (this.grass.get(ix(Rm, o.tx, o.ty))?.a || this.windAt(o.tx * T, t) * 0.5) * (s.h > 24 ? 0.12 : 0.35);
        if (Math.abs(a) < 0.04) b.drawImage(s.cv, Math.round(x - s.w / 2), Math.round(y - s.h));
        else { const rows = s.h, step = Math.max(2, Math.round(rows / 6)); for (let r0 = 0; r0 < rows; r0 += step) { const hgt = Math.min(step, rows - r0), up = (rows - r0) / rows; b.drawImage(s.cv, 0, r0, s.w, hgt, Math.round(x - s.w / 2 + a * up * up * rows * 0.5), Math.round(y - s.h + r0), s.w, hgt); } }
      } else if (kind === 'ruin') { const s = Wd.ruinSprite(o.t, P); b.drawImage(s.cv, Math.round(o.x - cx - s.w / 2), Math.round(o.y - cy - s.h)); }
      else if (kind === 'crystal') { const s = Wd.crystalSprite(o.c); b.drawImage(s.cv, o.x * T + 2 - cx, o.y * T + 15 - cy - s.h); }
      else if (kind === 'animal') {
        const A = ANIMALS[o.k], f = Math.sin(o.ph) > 0 ? 1 : 0, s = Wd.animalSprite(o.k, A.fly || A.hop || o.wait <= 0 ? f : 0), k = o.baby ? 0.65 : 1;
        const hop = A.hop && o.wait <= 0 ? Math.abs(Math.sin(o.ph)) * (this.mode === 'day' ? 4 : 2.5) : 0, fly = A.fly ? 10 + Math.sin(o.ph * 0.5) * 3 : 0, x = Math.round(o.x - cx), y = Math.round(o.y - cy);
        if (!A.fly && !A.water) { b.fillStyle = 'rgba(0,0,0,.16)'; b.fillRect(x - Math.round(4 * k), y - 1, Math.round(8 * k), 2); }
        if (A.fly) { b.fillStyle = 'rgba(0,0,0,.08)'; b.fillRect(x - 2, y + 2, 4, 1); }
        b.save(); b.translate(x, Math.round(y - hop - fly)); if (o.dir < 0) b.scale(-1, 1);
        if (k !== 1) b.drawImage(s.cv, -Math.floor(s.w * k / 2), -Math.round(s.h * k), Math.round(s.w * k), Math.round(s.h * k)); else b.drawImage(s.cv, -Math.floor(s.w / 2), -s.h);
        b.restore();
      } else if (kind === 'hero') {
        b.fillStyle = 'rgba(0,0,0,.18)'; b.fillRect(Math.round(this.hero.x - cx) - 6, Math.round(this.hero.y - cy) - 1, 12, 2);
        this.hero.actor.draw(b, Math.round(this.hero.x - cx), Math.round(this.hero.y - cy), 1);
      }
    }
    // falling leaves and petals
    for (const l of this.leaves) if (!l.rest) { b.fillStyle = l.col; b.fillRect(Math.round(l.x - cx), Math.round(l.y - l.z - cy), Math.sin(l.t * 6 + l.ph) > 0 ? 2 : 1, 1); }
    for (const f of this.fx) {
      if (f.t < 0) continue;
      const k = f.t / f.life, x = Math.round(f.x - cx + (f.vx || 0) * f.t), y = Math.round(f.y - cy + (f.vy || 0) * f.t + (f.kind === 'leaf' || f.kind === 'dot' ? 60 * f.t * f.t : 0));
      b.globalAlpha = Math.max(0, 1 - k);
      if (f.kind === 'ring') { b.fillStyle = '#ffffff'; const r = 3 + k * 8; for (let a = 0; a < 6.28; a += 0.5) b.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.5), 1, 1); }
      else if (f.kind === 'heart') { b.fillStyle = '#ff7a9a'; const X = x - 3, Y = y - 3; b.fillRect(X + 1, Y, 2, 1); b.fillRect(X + 4, Y, 2, 1); b.fillRect(X, Y + 1, 7, 2); b.fillRect(X + 1, Y + 3, 5, 1); b.fillRect(X + 2, Y + 4, 3, 1); b.fillRect(X + 3, Y + 5, 1, 1); }
      else if (f.kind === 'glow') { const r = 8 + k * 46; b.fillStyle = '#fff6c8'; for (let a = 0; a < 6.28; a += 0.18) b.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.5), 2, 1); }
      else if (f.kind === 'trail') { b.globalAlpha = Math.sin(Math.min(1, k) * Math.PI) * 0.9; b.fillStyle = '#fff6c8'; b.fillRect(x - 1, y - 1, 2, 2); }
      else if (f.kind === 'drop') { b.fillStyle = '#7ac8f0'; b.fillRect(x, y, 1, 2); }
      else { b.fillStyle = f.c || '#fff'; b.fillRect(x, y, 2, 2); }
    }
    b.globalAlpha = 1;
    this.drawLight(b, cx, cy);
    this.drawAtmos(b, cx, cy);
    this.drawGrain(b);
    // up to the card, chunky pixels
    c.drawImage(this.buf, 0, 0, W, H);
    this.drawUI(c);
    if (this.fade) { const f = this.fade, a = f.t < 0.45 ? f.t / 0.45 : 1 - (f.t - 0.45) / 0.45; c.globalAlpha = Math.max(0, Math.min(1, a)); c.fillStyle = f.col; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  }
  // the grass: blades on springs, three crisp segments each, leaning with the wind and whoever walks by
  drawGrass(b, cx, cy, P) {
    const Rm = this.Rm, t = this.t, sky = Rm.name === 'sky';
    if (Rm.name === 'cave' || !this.grass.size) return;
    const tufts = this.tuftCols ||= {};
    const key = `${Rm.name}${this.mode}`;
    tufts[key] ||= sky ? [Wd.tone(P.grass[0], -0.16), Wd.tone(P.grass[2], 0.1), P.grass[0], P.grass[0]] : [Wd.tone(P.grass[0], -0.24), Wd.tone(P.grass[2], 0.1), Wd.tone(P.forest[0], -0.26), Wd.tone(P.forest[2], 0.08)];
    const tc = tufts[key], wildCols = sky ? [P.grass[2], P.grass[0]] : [P.blade, P.wild[0]];
    for (const g of this.grass.values()) {
      if (t - g.seen > 0.1) continue;
      const tx = g.i % Rm.w, ty = (g.i / Rm.w) | 0, X = tx * T - cx, Y = ty * T - cy;
      if (X < -16 || Y < -10 || X > VW + 16 || Y > VH + 24) continue;
      const wild = Rm.wild[g.i] > 0, forest = Rm.ground[g.i] === Wd.FOREST;
      for (const [bx, by, h, sh] of g.b) {
        const lean = g.a * (0.75 + ((bx * 7 + by) % 5) * 0.12), x = X + bx, y = Y + by, h3 = Math.max(1, Math.round(h / 3));
        b.fillStyle = wild ? wildCols[sh] : tc[(forest ? 2 : 0) + sh];
        b.fillRect(x, y - h3, 1, h3);
        b.fillRect(x + Math.round(lean * h * 0.25), y - 2 * h3, 1, h3);
        b.fillRect(x + Math.round(lean * h * 0.7), y - h, 1, Math.max(1, h - 2 * h3));
      }
    }
  }
  // the dream layer: a darker, cooler grade, two banks of dithered pixel mist drifting at different
  // depths, and a soft bloom so the lights smear a little, as in a half-remembered place
  drawAtmos(b, cx, cy) {
    const realm = this.Rm.name, mode = this.mode, t = this.t, A = ATMOS[realm === 'cave' ? 'cave' : mode] || ATMOS.day;
    b.globalCompositeOperation = 'multiply'; b.globalAlpha = A.dimA; b.fillStyle = A.dim; b.fillRect(0, 0, VW, VH);
    b.globalCompositeOperation = 'saturation'; b.globalAlpha = A.desat; b.fillStyle = '#808080'; b.fillRect(0, 0, VW, VH);
    b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
    const breathe = 0.85 + 0.15 * Math.sin(t * 0.21), wind = realm === 'cave' ? 0.2 : this.weather.wind;
    this.mistT = (this.mistT || 0) + wind * 0.016;
    for (const [layer, par, speed, alpha] of [[0, 1, 5, A.mist[0]], [1, 1.35, 11, A.mist[1] * (realm === 'sky' ? 1.3 : 1)]]) {
      const f = mistTex(layer, A.mistCol), S = f.width;
      const ox = -(((cx * par + this.mistT * speed * 60) % S) + S) % S, oy = -(((cy * par + Math.sin(t * 0.05 + layer) * 20) % S) + S) % S;
      b.globalAlpha = alpha * breathe;
      for (let y = oy; y < VH; y += S) for (let x = ox; x < VW; x += S) b.drawImage(f, Math.round(x), Math.round(y));
    }
    b.globalAlpha = 1;
    // bloom: a quarter-size copy, multiplied by itself twice so only the bright things (lanterns,
    // blossoms, water glints, mist) glow, then smoothed back up and screened over
    this.bloom ||= Object.assign(document.createElement('canvas'), { width: VW / 4, height: VH / 4 });
    this.bloom2 ||= Object.assign(document.createElement('canvas'), { width: VW / 4, height: VH / 4 });
    const q = this.bloom.getContext('2d'), q2 = this.bloom2.getContext('2d');
    q.imageSmoothingEnabled = true; q.globalCompositeOperation = 'copy'; q.globalAlpha = 1; q.drawImage(this.buf, 0, 0, VW / 4, VH / 4);
    q2.globalCompositeOperation = 'copy'; q2.drawImage(this.bloom, 0, 0);
    q.globalCompositeOperation = 'multiply'; q.drawImage(this.bloom2, 0, 0); q.drawImage(this.bloom2, 0, 0);
    b.imageSmoothingEnabled = true; b.globalCompositeOperation = 'screen'; b.globalAlpha = A.bloom;
    b.drawImage(this.bloom, 0, 0, VW, VH);
    b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.imageSmoothingEnabled = false;
  }
  // film grain and a soft vignette, for the lo-fi look
  drawGrain(b) {
    if (!this.grain) {
      this.grain = [0, 1, 2].map(() => { const cv = Object.assign(document.createElement('canvas'), { width: VW, height: VH }), g = cv.getContext('2d'); for (let i = 0; i < VW * VH * 0.05; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; g.fillRect((Math.random() * VW) | 0, (Math.random() * VH) | 0, 1, 1); } return cv; });
      const v = Object.assign(document.createElement('canvas'), { width: VW, height: VH }), g = v.getContext('2d'), rg = g.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.78);
      rg.addColorStop(0, 'rgba(20,14,28,0)'); rg.addColorStop(1, 'rgba(20,14,28,.32)'); g.fillStyle = rg; g.fillRect(0, 0, VW, VH);
      this.vignette = v;
    }
    b.drawImage(this.grain[Math.floor(this.t * 12) % 3], 0, 0);
    b.drawImage(this.vignette, 0, 0);
  }
  // the open sky under the islands: gradient, drifting cloud banks, far islands and now and then a sky whale
  drawSkyBg(b) {
    const P = palFor('sky', this.mode), t = this.t, g = b.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, P.bg[0]); g.addColorStop(1, P.bg[1]);
    b.fillStyle = g; b.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 4; i++) {
      const x = ((i * 105 - this.cam.x * 0.12 + t * 2) % (VW + 110) + VW + 110) % (VW + 110) - 55, y = 40 + ((i * 65 - this.cam.y * 0.12) % VH + VH) % VH;
      b.fillStyle = 'rgba(120,110,140,.25)'; b.fillRect(Math.round(x - 10 - i * 3), Math.round(y), 20 + i * 6, 4);
      b.fillStyle = 'rgba(160,190,140,.3)'; b.fillRect(Math.round(x - 9 - i * 3), Math.round(y - 3), 18 + i * 6, 3);
    }
    if (t % 70 < 26) {
      const k = (t % 70) / 26, x = -80 + k * (VW + 160), y = 80 + Math.sin(k * 6) * 7;
      b.fillStyle = 'rgba(255,255,255,.22)'; b.beginPath(); b.ellipse(x, y, 40, 12, 0, 0, 7); b.fill();
      b.beginPath(); b.moveTo(x - 37, y); b.lineTo(x - 57, y - 9); b.lineTo(x - 53, y + 7); b.fill();
    }
    b.fillStyle = P.cloud;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 141 - this.cam.x * 0.3 + t * 4) % (VW + 200) + VW + 200) % (VW + 200) - 100, y = ((i * 87 - this.cam.y * 0.3) % (VH + 70) + VH + 70) % (VH + 70) - 35;
      b.globalAlpha = i % 2 ? 0.75 : 0.5;
      for (const [dx, dy, r] of [[0, 0, 26], [22, 4, 20], [-20, 5, 18], [7, -8, 17]]) { b.beginPath(); b.ellipse(Math.round(x + dx), Math.round(y + dy), r, Math.round(r * 0.55), 0, 0, 7); b.fill(); }
    }
    b.globalAlpha = 1;
  }
  drawLight(b, cx, cy) {
    const t = this.t, w = this.weather, realm = this.Rm.name, sx = (x) => x - cx, sy = (y) => y - cy;
    const glow = (x, y, r, col, a) => { const rg = b.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col.replace('A', a)); rg.addColorStop(1, col.replace('A', 0)); b.fillStyle = rg; b.fillRect(x - r, y - r, r * 2, r * 2); };
    if (realm === 'cave') {
      // darkness, with the lantern, glowshrooms, crystals and shafts of daylight cut out of it
      this.dark ||= Object.assign(document.createElement('canvas'), { width: VW, height: VH });
      const d = this.dark.getContext('2d');
      d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, VW, VH); d.fillStyle = 'rgba(8,6,16,.84)'; d.fillRect(0, 0, VW, VH);
      d.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a = 1) => { const rg = d.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(0,0,0,${a})`); rg.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = rg; d.fillRect(x - r, y - r, r * 2, r * 2); };
      hole(sx(this.hero.x), sy(this.hero.y - 10), 104 + Math.sin(t * 7) * 2);
      const lights = [];
      for (const p of this.Rm.plants) if (PLANTS[p.k].glow && stageOf(p) >= 2) lights.push([p.x * T + 8, p.y * T + 6, 27, '#8ff0d8']);
      for (const dc of this.Rm.decor) if (dc.t === 'crystal') lights.push([dc.x * T + 8, dc.y * T + 6, 31, dc.c]);
      for (const p of this.Rm.portals) lights.push([p.x * T + 8, p.y * T + 8, 54, '#fff0c8']);
      for (const r of this.Rm.ruins) if (r.found) lights.push([r.x * T + r.w * 8, r.y * T + r.h * 8, r.t === 'crystalheart' ? 94 : 47, r.t === 'crystalheart' ? '#9ff0f0' : '#b8c8ff']);
      for (const [x, y, r] of lights) { const X = sx(x), Y = sy(y); if (X > -r && Y > -r && X < VW + r && Y < VH + r) hole(X, Y, r * (1 + Math.sin(t * 2 + x) * 0.05), 0.85); }
      b.drawImage(this.dark, 0, 0);
      b.globalCompositeOperation = 'lighter';
      for (const [x, y, r, col] of lights) { const X = sx(x), Y = sy(y); if (X > -r && Y > -r && X < VW + r && Y < VH + r) glow(X, Y, r * 0.5, `rgba(${parseInt(col.slice(1, 3), 16)},${parseInt(col.slice(3, 5), 16)},${parseInt(col.slice(5, 7), 16)},A)`, 0.25); }
      for (const p of this.amb) { b.fillStyle = `rgba(200,230,255,${0.25 + Math.sin(p.p * 2) * 0.2})`; b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      for (const a of this.Rm.animals) if (a.k === 'glowworm') glow(sx(a.x), sy(a.y - 12), 7, 'rgba(210,255,150,A)', 0.6);
      b.globalCompositeOperation = 'source-over';
      return;
    }
    if (this.mode === 'morning') {
      const g = b.createLinearGradient(0, 0, VW, VH);
      g.addColorStop(0, 'rgba(255,200,220,.16)'); g.addColorStop(0.5, 'rgba(255,240,220,0)'); g.addColorStop(1, 'rgba(190,220,255,.12)');
      b.fillStyle = g; b.fillRect(0, 0, VW, VH);
      for (const [i, p] of this.amb.entries()) { if (i % 2) continue; b.fillStyle = p.s > 1 ? '#ffc4d8' : '#fff4f8'; b.globalAlpha = 0.9; b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      b.globalAlpha = 1;
    } else if (this.mode === 'evening') {
      b.globalCompositeOperation = 'multiply';
      const g = b.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, '#ffc7a0'); g.addColorStop(0.5, '#efa9c6'); g.addColorStop(1, '#8f88d8');
      b.globalAlpha = realm === 'sky' ? 0.6 : 0.8; b.fillStyle = g; b.fillRect(0, 0, VW, VH); b.globalAlpha = 1;
      b.globalCompositeOperation = 'overlay';
      const tint = b.createLinearGradient(0, 0, 0, VH);
      tint.addColorStop(0, 'rgba(255,140,150,.22)'); tint.addColorStop(1, 'rgba(90,70,190,.22)');
      b.fillStyle = tint; b.fillRect(0, 0, VW, VH);
      b.globalCompositeOperation = 'screen';
      const sun = b.createRadialGradient(VW * 0.8, -14, 6, VW * 0.8, -14, 200);
      sun.addColorStop(0, 'rgba(255,160,110,.32)'); sun.addColorStop(1, 'rgba(255,160,110,0)');
      b.fillStyle = sun; b.fillRect(0, 0, VW, VH);
      b.globalCompositeOperation = 'lighter';
      for (const p of this.Rm.plants) { const Pp = PLANTS[p.k]; if (!Pp.glow || stageOf(p) < 2) continue; const x = sx(p.x * T + 8), y = sy(p.y * T + 14 - (Pp.type === 'tree' ? 22 : 8)); if (x < -30 || y < -30 || x > VW + 30 || y > VH + 30) continue; glow(x, y, Pp.type === 'tree' ? 20 : 9, 'rgba(255,230,160,A)', 0.35 + Math.sin(t * 2 + p.x) * 0.08); }
      for (const r of this.Rm.ruins) { if (!r.found || !['shrine', 'obelisk', 'glyphs', 'fountain', 'well', 'cloudstair', 'starharp', 'windtemple'].includes(r.t)) continue; glow(sx(r.x * T + r.w * 8), sy(r.y * T + r.h * 8), 27, r.t === 'shrine' ? 'rgba(255,210,120,A)' : 'rgba(150,210,255,A)', 0.3 + Math.sin(t * 1.3 + r.x) * 0.08); }
      for (const p of this.Rm.portals) if (p.kind === 'mouth') glow(sx(p.x * T + 8), sy(p.y * T + 10), 15, 'rgba(255,200,140,A)', 0.18);
      glow(sx(this.hero.x), sy(this.hero.y - 12), 24, 'rgba(255,220,150,A)', 0.25);
      for (const p of this.amb) { const a = 0.4 + Math.sin(p.p * 3) * 0.4; if (a < 0.1) continue; glow(p.x, p.y, 4, 'rgba(220,255,140,A)', a); b.fillStyle = `rgba(240,255,190,${a})`; b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      b.globalCompositeOperation = 'source-over';
    } else {
      if (realm === 'surface') { b.fillStyle = 'rgba(30,40,60,.07)'; for (let i = 0; i < 3; i++) { const x = ((i * 127 + t * 8) % (VW + 200)) - 100; b.beginPath(); b.ellipse(x, 53 + i * 87, 80, 33, 0.2, 0, 7); b.fill(); } }
      if (w.kind === 'rain') { b.fillStyle = `rgba(40,60,90,${Math.min(0.18, w.t * 0.04)})`; b.fillRect(0, 0, VW, VH); }
      b.fillStyle = 'rgba(210,230,255,.75)';
      for (const r of w.rain) { b.fillRect(Math.round(r.x), Math.round(r.y), 1, 3); b.fillRect(Math.round(r.x) - 1, Math.round(r.y) + 3, 1, 2); }
      if (w.kind === 'rainbow') {
        const a = Math.min(1, w.t / 2, (w.until - w.t) / 2) * 0.35;
        ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'].forEach((col, i) => { b.strokeStyle = col; b.globalAlpha = a; b.lineWidth = 3; b.beginPath(); b.arc(VW * 0.7, VH * 0.95, 200 - i * 3, Math.PI * 1.1, Math.PI * 1.75); b.stroke(); });
        b.globalAlpha = 1;
      }
      if (w.kind === 'sun') { const g = b.createRadialGradient(VW * 0.85, 0, 6, VW * 0.85, 0, 210); g.addColorStop(0, `rgba(255,240,180,${Math.min(0.3, w.t * 0.1)})`); g.addColorStop(1, 'rgba(255,240,180,0)'); b.fillStyle = g; b.fillRect(0, 0, VW, VH); }
      if (w.kind === 'gust') for (const p of this.amb) { b.fillStyle = realm === 'sky' ? '#ffffff' : '#9ccf7a'; b.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); }
    }
  }
  // no buttons, maps or words on the card: only, on a first visit, two soft ripples where to tap
  drawUI(c) {
    // first visit: two soft ripples show where to tap (grass to plant, tall grass to clear)
    if (this.hint > 0) {
      this.hint -= 1 / 60;
      const a = Math.min(1, this.hint / 2), Z0 = Z, cx0 = this.cam.x - VW / 2, cy0 = this.cam.y - VH / 2;
      const spots = [[this.hero.x + 24, this.hero.y + 20]];
      const fw = this.frontierNear(); if (fw) spots.push(fw);
      for (const [wx, wy] of spots) for (let i = 0; i < 2; i++) { const ph = ((this.t * 0.7 + i * 0.5) % 1), x = (wx - cx0) * Z0, y = (wy - cy0) * Z0; c.globalAlpha = a * (1 - ph) * 0.9; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, 6 + ph * 20, 3 + ph * 10, 0, 0, 7); c.stroke(); }
      c.globalAlpha = 1;
    }
  }
  // the nearest tall grass to the hero (world pixels), for the first-visit ripple
  frontierNear() {
    const Rm = this.Rm, hx = Math.floor(this.hero.x / T), hy = Math.floor(this.hero.y / T);
    for (let r = 1; r < 12; r++) for (let y = hy - r; y <= hy + r; y++) for (let x = hx - r; x <= hx + r; x++) if (inside(Rm, x, y) && Rm.wild[ix(Rm, x, y)] && (Math.abs(x - hx) === r || Math.abs(y - hy) === r)) return [x * T + 8, y * T + 8];
    return null;
  }
}
