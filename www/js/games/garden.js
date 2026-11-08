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
import { settings } from '../state.js';
import * as Wd from './garden-world.js';

const { T, CH, HR, GRASS, FOREST, FLOWERS, SAND, WATER, PATH, STONE, BRIDGE, ROCK, PORTAL, VOID, PLANTS, ANIMALS, COMMON, REALM_NAME, stageOf, FRUIT_CAP, ix, inside, now, palFor } = Wd;
const Z = 1.5, VW = W / Z, VH = H / Z, CP = CH * T;
const MODES = ['morning', 'day', 'evening'];
// Seed & Sage's walking: speed in world px/s at full stick, and the stick's radius (card units)
const HERO_SPEED = 112, STICK_R = 40;
// what the philosophers say: the only words in the garden
const QUOTES = [
  ['The soul becomes dyed with the colour of its thoughts.', 'Marcus Aurelius'], ['Very little is needed to make a happy life.', 'Marcus Aurelius'],
  ['Look well into thyself; there is a source of strength which will always spring up if thou wilt always look.', 'Marcus Aurelius'],
  ['No man ever steps in the same river twice.', 'Heraclitus'], ['The way up and the way down are one and the same.', 'Heraclitus'],
  ['Nature does not hurry, yet everything is accomplished.', 'Lao Tzu'], ['A journey of a thousand miles begins beneath one’s feet.', 'Lao Tzu'],
  ['Knowing others is intelligence; knowing yourself is true wisdom.', 'Lao Tzu'], ['Be still, and the earth will speak to you.', 'a Navajo saying'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'], ['We suffer more often in imagination than in reality.', 'Seneca'],
  ['Wherever there is a human being, there is an opportunity for a kindness.', 'Seneca'], ['No great thing is created suddenly.', 'Epictetus'],
  ['First say to yourself what you would be; then do what you have to do.', 'Epictetus'], ['The unexamined life is not worth living.', 'Socrates'],
  ['Wonder is the feeling of a philosopher, and philosophy begins in wonder.', 'Plato'], ['The roots of education are bitter, but the fruit is sweet.', 'Aristotle'],
  ['In all things of nature there is something of the marvellous.', 'Aristotle'], ['Let us cultivate our garden.', 'Voltaire'],
  ['I went to the woods because I wished to live deliberately.', 'Thoreau'], ['Heaven is under our feet as well as over our heads.', 'Thoreau'],
  ['Adopt the pace of nature: her secret is patience.', 'Emerson'], ['The earth laughs in flowers.', 'Emerson'], ['To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.', 'attributed to Emerson'],
  ['What you seek is seeking you.', 'Rumi'], ['Let yourself be silently drawn by the strange pull of what you really love.', 'Rumi'],
  ['The wound is the place where the light enters you.', 'Rumi'], ['Do not seek to follow in the footsteps of the wise; seek what they sought.', 'Matsuo Bashō'],
  ['Every day is a journey, and the journey itself is home.', 'Matsuo Bashō'], ['To see a world in a grain of sand, and a heaven in a wild flower.', 'William Blake'],
  ['The tree which moves some to tears of joy is in the eyes of others only a green thing that stands in the way.', 'William Blake'],
  ['Come forth into the light of things; let Nature be your teacher.', 'Wordsworth'], ['Not knowing when the dawn will come, I open every door.', 'Emily Dickinson'],
  ['Forever is composed of nows.', 'Emily Dickinson'], ['I am large, I contain multitudes.', 'Walt Whitman'], ['Keep your face always toward the sunshine.', 'Walt Whitman'],
  ['The mind is everything. What you think you become.', 'attributed to the Buddha'], ['Peace comes from within. Do not seek it without.', 'attributed to the Buddha'],
  ['Happiness is when what you think, what you say, and what you do are in harmony.', 'Gandhi'], ['There is more to life than increasing its speed.', 'Gandhi'],
  ['Life can only be understood backwards; but it must be lived forwards.', 'Kierkegaard'], ['He who has a why to live can bear almost any how.', 'Nietzsche'],
  ['One must still have chaos in oneself to give birth to a dancing star.', 'Nietzsche'], ['Patience is bitter, but its fruit is sweet.', 'Rousseau'],
  ['The present moment is filled with joy and happiness. If you are attentive, you will see it.', 'attributed to the Buddha'], ['Whatever you do, do it with all your might.', 'Cicero'],
  ['If you have a garden and a library, you have everything you need.', 'Cicero'], ['Silence is the sleep that nourishes wisdom.', 'Francis Bacon'],
  ['Everything has beauty, but not everyone sees it.', 'Confucius'], ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
  ['The quieter you become, the more you are able to hear.', 'attributed to Rumi'], ['Muddy water, let stand, becomes clear.', 'Lao Tzu'],
  ['To plant a garden is to believe in tomorrow.', 'an old saying'], ['He that plants trees loves others besides himself.', 'Thomas Fuller'],
  ['Time spent among trees is never time wasted.', 'an old saying'], ['A society grows great when old men plant trees in whose shade they know they shall never sit.', 'a Greek proverb'],
  ['The clearest way into the Universe is through a forest wilderness.', 'John Muir'], ['In every walk with nature one receives far more than he seeks.', 'John Muir'],
  ['The mountains are calling and I must go.', 'John Muir'], ['Look deep into nature, and then you will understand everything better.', 'attributed to Einstein']
];
const ALTS = { deep: -2, cave: -1, canyon: -1, surface: 0, canopy: 1, mountain: 1, sky: 2 }, LIFT_UP = (from, to) => (ALTS[to] ?? 0) > (ALTS[from] ?? 0);
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Water that moves: a small height-field ripple simulation over the visible water (2-pixel cells).
// Ducks, fish, rain, wind and new bridges disturb it; it is drawn as light and shadow pixels.
// per light: the grade (multiply colour and strength, how much colour drains), the fog colour (and
// the sky's cloud colour), how many fog patches hang about and how thick, and the bloom
const ATMOS = {
  morning: { dim: '#84949a', dimA: 0.95, desat: 0.24, mistCol: [190, 206, 220], cloudCol: [236, 240, 248], fog: 12, fogA: 0.72, bloom: 0.34 },
  day: { dim: '#929f92', dimA: 0.92, desat: 0.24, mistCol: [222, 232, 228], cloudCol: [250, 252, 255], fog: 7, fogA: 0.6, bloom: 0.45 },
  evening: { dim: '#7d7690', dimA: 0.62, desat: 0.12, mistCol: [184, 166, 214], cloudCol: [240, 214, 230], fog: 11, fogA: 0.66, bloom: 0.55 },
  cave: { dim: '#a09cb0', dimA: 0.4, desat: 0.1, mistCol: [120, 132, 166], fog: 5, fogA: 0.45, bloom: 0.5 }
};
// one soft puff of fog: an ellipse whose density falls off toward the edge, posterised into four
// levels with a Bayer dither between them, so it reads as pixel fog rather than a blur
const puffCache = new Map();
function puffTex(r, col) {
  const key = `${r}|${col}`;
  if (puffCache.has(key)) return puffCache.get(key);
  const w = r * 2 + 2, h = Math.round(r * 1.3) + 2, cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), c = cv.getContext('2d'), img = c.createImageData(w, h), d = img.data;
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ex = (x - w / 2) / r, ey = (y - h / 2) / (r * 0.62), q = 1 - Math.hypot(ex, ey);
    if (q <= 0) continue;
    const v = Math.min(1, q * 1.6) ** 1.3, lv = v * 4, base = Math.floor(lv), step = Math.min(4, base + ((lv - base) * 16 > B[(y & 3) * 4 + (x & 3)] ? 1 : 0));
    const i = (y * w + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = Math.round((step / 4) * 255);
  }
  c.putImageData(img, 0, 0);
  puffCache.set(key, cv);
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
    this.hero.x = Rm.hero.x; this.hero.y = Rm.hero.y; this.hero.path = []; this.hero.task = null; this.hero.portalArmed = false; this.stick = null;
    this.cam.x = this.hero.x; this.cam.y = this.hero.y - 16;
    for (const a of Rm.animals) if (a.tx === undefined) this.brain(a);
    this.amb = Array.from({ length: realm === 'cave' ? 22 : this.mode === 'evening' ? 26 : 18 }, () => ({ x: Math.random() * VW, y: Math.random() * VH, p: Math.random() * 6.28, s: 0.5 + Math.random() }));
    this.grass = new Map(); this.leaves = []; this.prints = []; this.rip ||= new Ripples(); this.fog = []; this.fogInit = false;
    this.npcs = null;   // spawned once the map is ready (below)
    this.computeBlock();
    this.markSeen();
    this.spawnNPCs();
    this.ready = true;
    if (first && realm === 'cave') { this.say('Down into the caverns. Your lantern lights the way'); this.say('Clear the rubble to explore · glowshrooms grow only down here'); }
    if (first && realm === 'sky') { this.say('Up among the sky islands!'); this.say('Tap the cloud sea beside an island to step onto a cloud'); }
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
    for (const p of Rm.plants) { if (PLANTS[p.k].giant) { for (let dx = -1; dx <= 1; dx++) if (inside(Rm, p.x + dx, p.y)) b[ix(Rm, p.x + dx, p.y)] = 1; } else if (PLANTS[p.k].type === 'tree' && stageOf(p) >= 2) b[ix(Rm, p.x, p.y)] = 1; }
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
  // can feet go here? tall grass, rubble and mist give way underfoot, so they count
  walkable(x, y) { const Rm = this.Rm; if (!inside(Rm, x, y)) return false; const i = ix(Rm, x, y), g = Rm.ground[i]; return g !== WATER && g !== ROCK && g !== VOID && !this.block[i]; }
  path(goal, from = this.hero) {
    const Rm = this.Rm, sx = Math.floor(from.x / T), sy = Math.floor((from.y - 2) / T);
    const prev = new Int32Array(Rm.w * Rm.h).fill(-2), q = [ix(Rm, sx, sy)];
    prev[q[0]] = -1;
    for (let qi = 0; qi < q.length && qi < 9000; qi++) {
      const cur = q[qi], cx = cur % Rm.w, cy = (cur / Rm.w) | 0;
      if (goal(cx, cy)) { const out = []; for (let c = cur; c !== -1; c = prev[c]) out.push([c % Rm.w, (c / Rm.w) | 0]); return out.reverse(); }
      for (const [dx, dy] of N8) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.walkable(nx, ny) || prev[ix(Rm, nx, ny)] !== -2) continue;
        if (dx && dy && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
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
  plantAt(x, y) { const L = Wd.plantsIn(this.Rm, x - 1, y, x + 1, y + 2); return L.find((p) => p.x === x && p.y === y) || L.find((p) => PLANTS[p.k].type === 'tree' && stageOf(p) === 3 && Math.abs(p.x - x) <= 1 && y <= p.y && y >= p.y - 2); }

  // ---------------------------------------------- input
  // Movement is Seed & Sage's: drag anywhere and a floating stick appears where you pressed; how far
  // you pull sets the pace, and pulling past its rim drags the stick along behind your finger. A
  // short press is a tap, which only reaches things within arm's length.
  down(x, y) { this.press = { x, y, t: performance.now(), moved: 0, lx: x, ly: y }; }
  move(x, y) {
    const p = this.press;
    if (!p || !this.ready || this.fade) return;
    p.moved += Math.abs(x - p.lx) + Math.abs(y - p.ly); p.lx = x; p.ly = y;
    if (!this.stick && p.moved > 8) { this.stick = { ox: p.x, oy: p.y, x, y }; const h = this.hero; h.path = []; h.task = null; h.actor.cancel(); h.busy = 0; }
    if (this.stick) { this.stick.x = x; this.stick.y = y; }
  }
  up(x, y) {
    const p = this.press; this.press = null;
    if (this.stick) { this.stick = null; return; }
    if (p && p.moved < 10 && performance.now() - p.t < 450) this.tap(x, y);
  }
  // within arm's reach (tiles): act on it now, facing it; further away, the tap just ripples
  reach(tx, ty, task, r = 2) {
    const h = this.hero, hx = Math.floor(h.x / T), hy = Math.floor((h.y - 2) / T);
    if (Math.max(Math.abs(hx - tx), Math.abs(hy - ty)) > r) return false;
    h.actor.cancel(); h.busy = 0; h.path = []; h.task = task;
    h.actor.face(tx * T + 8 < h.x ? 'W' : 'E');
    return true;
  }
  // Seed & Sage's step: small sub-steps, each axis on its own, so the hero slides along whatever
  // is in the way instead of sticking to it
  standable(x, y) { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; if (!this.walkable(Math.floor((x + Math.cos(a) * 4.5) / T), Math.floor((y - 3 + Math.sin(a) * 4.5) / T))) return false; } return true; }
  moveHero(dx, dy) {
    const h = this.hero, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3)), sx = dx / n, sy = dy / n;
    for (let k = 0; k < n; k++) { if (sx && this.standable(h.x + sx, h.y)) h.x += sx; if (sy && this.standable(h.x, h.y + sy)) h.y += sy; }
  }
  tap(x, y) {
    if (!this.ready || this.fade) return;
    const Rm = this.Rm, wx = x / Z + this.cam.x - VW / 2, wy = y / Z + this.cam.y - VH / 2, tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (!inside(Rm, tx, ty)) return;
    this.fx.push({ kind: 'ring', x: wx, y: wy, t: 0, life: 0.5 });
    const who = (this.npcs || []).filter((n) => Math.hypot(n.x - wx, n.y - 10 - wy) < 18).sort((p, q) => Math.hypot(p.x - wx, p.y - wy) - Math.hypot(q.x - wx, q.y - wy))[0];
    if (who && Math.hypot(who.x - this.hero.x, who.y - this.hero.y) < 3 * T) {
      const h = this.hero; h.actor.face(who.x < h.x ? 'W' : 'E'); who.actor.face(h.x < who.x ? 'W' : 'E'); who.path = []; who.task = null;
      if (who.sage) {
        const q = QUOTES[(this.quoteN = ((this.quoteN ?? Math.floor(Math.random() * QUOTES.length)) + 1 + Math.floor(Math.random() * 5)) % QUOTES.length)];
        this.quote = { n: who, text: q[0], by: q[1], t: 0, life: 6 + q[0].length / 18 };
        who.actor.emote('nod', 1.2); who.busy = 1.4; who.follow = this.t + 8 + Math.random() * 6;
      } else { who.actor.emote('wave', 0.9); who.busy = 0.9; who.follow = this.t + 15; }
      return;
    }
    const a = Rm.animals.filter((o) => Math.hypot(o.x - wx, o.y - 4 - wy) < 14 && !(ANIMALS[o.k].night && this.mode !== 'evening')).sort((p, q) => Math.hypot(p.x - wx, p.y - wy) - Math.hypot(q.x - wx, q.y - wy))[0];
    if (a) { this.reach(Math.floor(a.x / T), Math.floor(a.y / T), { kind: 'animal', a }, 2); return; }
    const i = ix(Rm, tx, ty), g = Rm.ground[i];
    // a way down, up or back
    const ruin = Rm.ruins.find((r) => r.found && tx >= r.x && tx < r.x + r.w && ty >= r.y - 1 && ty < r.y + r.h);
    const portal = Rm.portals.find((p) => (p.x === tx && p.y === ty) || (ruin && ruin.t === 'cloudstair' && p.kind === 'stair'));
    if (portal && (!portal.ruin || ruin?.found)) { this.reach(portal.x, portal.y, { kind: 'portal', p: portal }, 1); return; }
    const plant = this.plantAt(tx, ty);
    if (plant) { this.reach(plant.x, plant.y, { kind: 'plant', p: plant }, 2); return; }
    if (ruin) { this.reach(tx, ty, { kind: 'ruin', r: ruin }, 3); return; }
    // tall grass, rubble or mist: walk into it (drag); it gives way underfoot and leaves a trail
    if (Rm.wild[i]) return;
    if (g === WATER || g === VOID) {
      // build out over the water (or the cloud sea) from the shore
      if (!N8.slice(0, 4).some(([dx, dy]) => this.open(tx + dx, ty + dy) || (inside(Rm, tx + dx, ty + dy) && Rm.ground[ix(Rm, tx + dx, ty + dy)] === BRIDGE))) { this.say(g === VOID ? 'Build out from an island edge: tap the cloud sea right beside it' : 'Build out from the shore: tap the water right beside the land'); return; }
      this.reach(tx, ty, { kind: 'build', x: tx, y: ty }, 1);
      return;
    }
    if (g === ROCK) { this.say(Rm.kind === 'cave' ? 'The cave wall is solid here' : 'Solid rock. Look for a cave mouth in the hills'); return; }
    this.reach(tx, ty, { kind: 'plant-here', x: tx, y: ty }, 2);
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
  // ---------------------------------------------- the other gardeners
  // A few people live in the garden besides you. They wander, trample paths through the tall grass,
  // sow from their own seed bags, water what is thirsty, fuss over the animals and wave when you
  // pass. They come and go with each visit; what they plant stays.
  spawnNPCs() {
    const Rm = this.Rm, n = Rm.kind === 'surface' ? 3 : 1, sages = Rm.kind === 'surface' ? 2 : 1;
    this.npcs = [];
    for (let k = 0; k < n + sages; k++) {
      const at = this.npcSpot(5, 15);
      if (!at) break;
      const sage = k >= n;
      this.npcs.push({ k, sage, actor: new Actor(this.skin.crystal(sage ? 20 + k : k + 1, 'Fantasy'), { mode: 'eight', walkSpeed: 8, runSpeed: 70 }), x: at[0] * T + 8, y: at[1] * T + 12, path: [], wait: 1 + Math.random() * 3, busy: 0, vx: 0, vy: 0, sowT: 12 + Math.random() * 25, greetT: 0, task: null, follow: 0 });
    }
  }
  // an open tile some distance from the hero (or from a gardener)
  npcSpot(r0, r1, from = this.hero) {
    const Rm = this.Rm, hx = Math.floor(from.x / T), hy = Math.floor((from.y - 2) / T);
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * 6.283, r = r0 + Math.random() * (r1 - r0), x = Math.round(hx + Math.cos(a) * r), y = Math.round(hy + Math.sin(a) * r);
      if (this.walkable(x, y) && Rm.ground[ix(Rm, x, y)] !== PORTAL) return [x, y];
    }
    return null;
  }
  stepNPC(n, dt) {
    const h = this.hero, Rm = this.Rm;
    let vx = 0, vy = 0;
    if (n.busy > 0) { n.busy -= dt; if (n.busy <= 0) { n.busy = 0; n.actor.cancel(); } }
    else if (n.follow > this.t) { /* following you: handled below */ }
    else if (n.path.length) {
      const [px, py] = n.path[0], dx = px - n.x, dy = py - n.y, d = Math.hypot(dx, dy), deep = Rm.wild[ix(Rm, Math.floor(n.x / T), Math.floor((n.y - 2) / T))], sp = 30 * (deep ? 0.65 : 1);
      if (d < 1.5) n.path.shift();
      else { const st = Math.min(d, sp * dt); vx = (dx / d) * sp; vy = (dy / d) * sp; n.x += (dx / d) * st; n.y += (dy / d) * st; }
      this.underfoot(n, dt, vx || vy);
    } else if (n.task) { const t = n.task; n.task = null; this.npcAct(n, t); }
    else if ((n.wait -= dt) <= 0) this.npcThink(n);
    // a wave when you come by (not too often)
    if (n.busy <= 0 && this.t > n.greetT && Math.hypot(h.x - n.x, h.y - n.y) < 34) { n.greetT = this.t + 45; n.path = []; n.task = null; n.actor.face(h.x < n.x ? 'W' : 'E'); n.actor.emote(n.sage ? 'nod' : 'wave', 1); n.busy = 1; n.wait = 1.5; if (Math.random() < 0.45) n.follow = this.t + 10 + Math.random() * 8; }
    if (n.follow > this.t && n.busy <= 0) {
      // walking along a little behind you
      n.path = []; n.task = null;
      const fx = h.x + (n.x < h.x ? -22 : 22) - n.x, fy = h.y + 4 - n.y, d = Math.hypot(fx, fy);
      if (d > 8) {
        const sp = Math.min(HERO_SPEED * 0.95, 30 + d * 1.2), mx = (fx / d) * sp * dt, my = (fy / d) * sp * dt, ok = (x, y) => this.walkable(Math.floor(x / T), Math.floor((y - 2) / T));
        if (ok(n.x + mx, n.y)) n.x += mx; if (ok(n.x, n.y + my)) n.y += my;
        vx = (fx / d) * sp; vy = (fy / d) * sp; this.underfoot(n, dt, true);
      }
    }
    n.sowT -= dt; n.vx = vx; n.vy = vy;
    n.actor.update(dt, { vx, vy });
  }
  npcGo(n, goal, task) {
    const p = this.path(goal, n);
    if (!p) { n.wait = 1 + Math.random() * 2; return; }
    n.path = p.slice(1).map(([x, y]) => [x * T + 8, y * T + 12]); n.task = task;
  }
  npcThink(n) {
    if (n.sage) {
      // a philosopher: long pauses, a slow walk, a thought now and then
      if (Math.random() < 0.55) { n.actor.emote(Math.random() < 0.6 ? 'think' : 'nod', 2); n.busy = 2; n.wait = 2 + Math.random() * 4; return; }
      const spot = this.npcSpot(2, 6, n);
      if (spot) this.npcGo(n, (x, y) => x === spot[0] && y === spot[1], null);
      n.wait = 3 + Math.random() * 5;
      return;
    }
    const Rm = this.Rm, R = Math.random, nx = Math.floor(n.x / T), ny = Math.floor((n.y - 2) / T), g = Wd.G;
    const day = Wd.dayKey(), log = (g.npcSown ||= { day, n: 0 });
    if (log.day !== day) { log.day = day; log.n = 0; }
    const r = R();
    // sow: a free spot of open ground near them, not crowded
    if (n.sowT <= 0 && log.n < 24 && r < 0.45) {
      for (let k = 0; k < 14; k++) {
        const x = nx + Math.round((R() - 0.5) * 8), y = ny + Math.round((R() - 0.5) * 8);
        if (!inside(Rm, x, y) || !this.open(x, y) || Rm.wild[ix(Rm, x, y)]) continue;
        const gr = Rm.ground[ix(Rm, x, y)];
        if (![GRASS, FLOWERS, FOREST, PATH].includes(gr) || this.occ?.has(ix(Rm, x, y)) || Wd.plantsIn(Rm, x - 2, y - 2, x + 2, y + 2).length > 2) continue;
        const kind = this.npcSeed(gr, x, y);
        if (!kind) continue;
        this.npcGo(n, this.near(x, y, 1), { kind: 'sow', x, y, k: kind });
        return;
      }
    }
    // water: something young and thirsty nearby
    if (r < 0.65) {
      const p = Wd.plantsIn(Rm, nx - 6, ny - 6, nx + 6, ny + 6).find((q) => stageOf(q) < 3 && !PLANTS[q.k].giant && now() - (q.w || 0) > 120e3);
      if (p) { this.npcGo(n, this.near(p.x, p.y, 1), { kind: 'water', p }); return; }
    }
    // fuss over an animal
    if (r < 0.78) {
      const a = Rm.animals.find((o) => !ANIMALS[o.k].fly && !ANIMALS[o.k].water && Math.abs(o.x / T - nx) < 7 && Math.abs(o.y / T - ny) < 7);
      if (a) { this.npcGo(n, this.near(Math.floor(a.x / T), Math.floor(a.y / T), 1), { kind: 'pet', a }); return; }
    }
    // stand and look about for a moment
    if (r < 0.86) { n.actor.emote(R() < 0.5 ? 'think' : 'nod', 1.2); n.busy = 1.2; n.wait = 1.5 + R() * 2; return; }
    // wander, now and then straight through the tall grass (that is how the trails appear)
    const into = R() < 0.2, to = into ? this.npcWild(nx, ny) : null, spot = to || this.npcSpot(3, 9, n);
    if (spot) this.npcGo(n, (x, y) => x === spot[0] && y === spot[1], null);
    n.wait = 2 + R() * 4;
  }
  npcWild(nx, ny) {
    const Rm = this.Rm;
    for (let k = 0; k < 30; k++) { const x = nx + Math.round((Math.random() - 0.5) * 14), y = ny + Math.round((Math.random() - 0.5) * 14); if (inside(Rm, x, y) && Rm.wild[ix(Rm, x, y)] && this.walkable(x, y)) return [x, y]; }
    return null;
  }
  npcSeed(gr, x, y) {
    const Rm = this.Rm, R = Math.random;
    if (Rm.kind === 'cave') return 'glowshroom';
    if (Rm.kind === 'sky') return ['skyorchid', 'cosmos', 'daisy'][Math.floor(R() * 3)];
    const trees = ['apple', 'cherry', 'birch', 'oak', 'willow'];
    if (gr === FOREST && R() < 0.3 && !Wd.plantsIn(Rm, x - 3, y - 3, x + 3, y + 3).some((p) => ['tree', 'giant'].includes(PLANTS[p.k].type) && Math.hypot(p.x - x, p.y - y) < 3)) return trees[Math.floor(R() * trees.length)];
    const small = COMMON.filter((k) => PLANTS[k].type !== 'tree');
    return small[Math.floor(R() * small.length)];
  }
  npcAct(n, t) {
    const Rm = this.Rm, a = n.actor;
    if (t.kind === 'sow') {
      if (Rm.plants.some((p) => p.x === t.x && p.y === t.y) || !this.open(t.x, t.y)) return;
      a.face(t.x * T + 8 < n.x ? 'W' : 'E'); a.cast(); n.busy = 0.8; n.wait = 2 + Math.random() * 3; n.sowT = 30 + Math.random() * 50;
      this.later(0.5, () => {
        if (Rm.plants.some((p) => p.x === t.x && p.y === t.y)) return;
        Rm.plants.push({ k: t.k, x: t.x, y: t.y, g: 0.02, w: now(), fr: 0, sd: 0, by: 'npc' });
        Wd.G.npcSown.n++;
        this.puff(t.x * T + 8, t.y * T + 12, '#a7835a', 6);
        this.computeBlock(); Wd.saveGarden(true);
      });
    } else if (t.kind === 'water') { a.cast(); n.busy = 0.7; n.wait = 2 + Math.random() * 3; this.later(0.4, () => this.water(t.p, true)); }
    else if (t.kind === 'pet') { a.face(t.a.x < n.x ? 'W' : 'E'); a.emote('love', 0.9); n.busy = 0.9; n.wait = 2 + Math.random() * 3; t.a.wait = 1; this.hearts(t.a.x, t.a.y - 8); }
  }

  // which seed to sow on a tile, chosen for you: what suits the spot, then what you have most of,
  // turning through your seeds so a run of taps plants a mixed bed
  seedFor(x, y) {
    const g = Wd.G, Rm = this.Rm, cave = Rm.kind === 'cave', gr = Rm.ground[ix(Rm, x, y)];
    const wet = N8.slice(0, 4).some(([dx, dy]) => inside(Rm, x + dx, y + dy) && Rm.ground[ix(Rm, x + dx, y + dy)] === WATER);
    const ok = Object.keys(g.inv.seeds).filter((k) => g.inv.seeds[k] > 0 && PLANTS[k] && !!PLANTS[k].cave === cave &&
      !(PLANTS[k].type === 'tree' && Wd.plantsIn(Rm, x - 3, y - 3, x + 3, y + 3).some((p) => ['tree', 'giant'].includes(PLANTS[p.k].type) && Math.hypot(p.x - x, p.y - y) < 2.5)));
    if (!ok.length) return null;
    const suits = (k) => (wet && k === 'reed' ? 3 : 0) + (gr === Wd.FOREST && (k === 'fern' || PLANTS[k].type === 'tree') ? 2 : 0) + (gr === Wd.FLOWERS && PLANTS[k].type === 'flower' ? 1 : 0) + (Rm.kind === 'sky' && k === 'skyorchid' ? 2 : 0) + (k === this.lastSown ? -2 : 0);
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
        this.puff(task.x * T + 8, task.y * T + 8, Rm.kind === 'sky' ? '#ffffff' : '#c8a070', 10);
        this.say(Rm.kind === 'sky' ? 'You called a cloud to step on' : Rm.kind === 'cave' ? 'Laid planks across the pool' : 'Built a little plank bridge');
        Wd.saveGarden(true);
      });
    } else if (task.kind === 'portal') {
      const p = task.p;
      a.emote(p.to === 'sky' ? 'surprise' : 'nod', 0.8); h.busy = 0.5;
      this.fade = { t: 0, p, col: p.kind === 'lift' ? (LIFT_UP(Rm.name, p.to) ? '#f2f6ff' : '#0a0810') : p.to === 'cave' || Rm.kind === 'cave' ? '#07050c' : '#ffffff' };
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
        a.emote('love', 0.7); h.busy = 0.5; g.inv.food--; o.f = t; o.wait = 1.5; o.follow = this.t + 15;
        this.hearts(o.x, o.y - 10); this.say(`You fed the ${o.baby ? 'baby ' : ''}${o.k === 'cloudsheep' ? 'cloud sheep' : o.k}`);
        this.breed(o);
      } else {
        a.emote(A.eats ? 'wave' : 'love', 0.7); h.busy = 0.45; o.wait = 1.2; o.follow = this.t + 12; this.hearts(o.x, o.y - 8);
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
  // the chunks around the view grow their wild plants and residents the first time you come near
  growNear() {
    const Rm = this.Rm, c0x = Math.floor((this.cam.x - VW) / (T * CH)), c1x = Math.floor((this.cam.x + VW) / (T * CH)), c0y = Math.floor((this.cam.y - VH) / (T * CH)), c1y = Math.floor((this.cam.y + VH) / (T * CH));
    let grew = false;
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) if (Wd.populate(Wd.G, Rm, cx, cy)) grew = true;
    if (grew) { this.computeBlock(); for (const a of Rm.animals) if (a.tx === undefined) this.brain(a); }
  }
  // walking onto a cave mouth, ladder or the Cloud Stair takes you through (not the one you arrived on)
  portalUnderfoot() {
    const h = this.hero, Rm = this.Rm, tx = Math.floor(h.x / T), ty = Math.floor((h.y - 2) / T);
    const p = Rm.portals.find((q) => q.x === tx && q.y === ty);
    if (!p) { h.portalArmed = true; return; }
    if (!h.portalArmed || this.fade || h.task || this.auto) return;
    if (p.ruin && !Rm.ruins.find((r) => r.t === 'cloudstair')?.found) return;
    h.portalArmed = false; this.stick = null; this.press = null;
    this.act({ kind: 'portal', p });
  }
  // feet on the ground: tall grass, rubble and mist give way a level at a time (quickly), and grass
  // walked over again and again wears into a path
  underfoot(w, dt, moving) {
    const Rm = this.Rm, tx = Math.floor(w.x / T), ty = Math.floor((w.y - 2) / T);
    if (!inside(Rm, tx, ty)) return;
    const i = ix(Rm, tx, ty);
    if (i !== w.tile) { w.tile = i; w.tileT = 0; this.trample(tx, ty, w === this.hero); return; }
    if (moving && Rm.wild[i] && (w.tileT = (w.tileT || 0) + dt) > 0.12) { w.tileT = 0; this.trample(tx, ty, w === this.hero); }
  }
  trample(x, y, hero) {
    const Rm = this.Rm, i = ix(Rm, x, y), R = Math.random;
    if (Rm.wild[i]) {
      if (Rm.kind === 'cave' && R() < 0.35) return;   // rubble is a little tougher than grass
      // two levels a step: one walk through even the tallest grass leaves a clear trail
      if (Rm.wild[i] <= 2) { this.clear(x, y, { narrow: true, quiet: !hero }); return; }
      Rm.wild[i] -= 2; this.grass.delete(i);
      const P = palFor(Rm.name, this.mode), cols = Rm.kind === 'cave' ? P.rubble : Rm.kind === 'sky' ? ['#ffffff', '#f0f4ff', '#e8eef8'] : P.wild;
      for (let k = 0; k < 4; k++) this.fx.push({ kind: 'leaf', x: x * T + 8, y: y * T + 8, vx: (R() - 0.5) * 50, vy: -20 - R() * 30, t: 0, life: 0.6, c: cols[(R() * 3) | 0] });
      Wd.invalidate(Rm, x, y, x, y);
      return;
    }
    const g = Rm.ground[i];
    if (Rm.kind !== 'surface' || !(g === GRASS || g === FLOWERS || g === FOREST) || this.occ?.has(i)) return;
    const wear = (Rm.wear ||= new Uint8Array(Rm.w * Rm.h));
    if (++wear[i] >= 9) { Rm.ground[i] = PATH; this.grass.delete(i); Wd.invalidate(Rm, x, y, x, y); }
  }
  clear(x, y, { narrow = false, quiet = false } = {}) {
    const Rm = this.Rm, g = Wd.G, R = Math.random, i = ix(Rm, x, y);
    if (!Rm.wild[i]) return;
    Rm.wild[i] = 0; this.grass.delete(i);
    // each swing opens a little space around it (a footstep only its own tile)
    if (!narrow) for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (!inside(Rm, nx, ny)) continue; const j = ix(Rm, nx, ny); if (Rm.wild[j] === 1 && R() < 0.75) Rm.wild[j] = 0; else if (Rm.wild[j] === 2 && R() < 0.35) Rm.wild[j] = 1; }
    const P = palFor(Rm.name, this.mode), cols = Rm.kind === 'cave' ? P.rubble : Rm.kind === 'sky' ? ['#ffffff', '#f0f4ff', '#e8eef8'] : P.wild;
    for (let k = 0; k < (narrow ? 5 : 10); k++) this.fx.push({ kind: 'leaf', x: x * T + 8, y: y * T + 6, vx: (R() - 0.5) * 70, vy: -30 - R() * 50, t: 0, life: 0.9, c: cols[(R() * 3) | 0] });
    const r = Rm.ruins.find((u) => !u.found && x >= u.x - 1 && x <= u.x + u.w && y >= u.y - 1 && y <= u.y + u.h);
    if (r) {
      r.found = 1;
      for (let yy = r.y - 1; yy <= r.y + r.h; yy++) for (let xx = r.x - 1; xx <= r.x + r.w; xx++) {
        if (!inside(Rm, xx, yy)) continue;
        const j = ix(Rm, xx, yy), inFoot = yy >= r.y && yy < r.y + r.h && xx >= r.x && xx < r.x + r.w;
        Rm.wild[j] = 0;
        if (Rm.ground[j] !== WATER && Rm.ground[j] !== VOID && Rm.ground[j] !== ROCK) Rm.ground[j] = inFoot || r.t === 'glyphs' ? STONE : Rm.kind === 'surface' ? PATH : Rm.ground[j];
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
    } else if (!quiet && R() < (narrow ? 0.08 : 0.16)) {
      const k = Rm.kind === 'cave' ? 'glowshroom' : Rm.kind === 'sky' ? (R() < 0.5 ? 'skyorchid' : 'cosmos') : COMMON[(R() * 8) | 0];
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
      if (Rm.kind === 'surface' && g === WATER && !Rm.saidLake) { Rm.saidLake = 1; this.say('A lake! Tap the water beside the shore to build a bridge'); }
      if (Rm.kind === 'surface' && g === PORTAL && !Rm.saidCave) { Rm.saidCave = 1; this.say('A cave mouth in the hillside…'); }
      if (Rm.kind === 'cave' && g === WATER && !Rm.saidLake) { Rm.saidLake = 1; this.say('An underground pool, perfectly still'); }
    }
  }

  // ---------------------------------------------- animals
  brain(a) { a.tx = a.x; a.ty = a.y; a.wait = Math.random() * 2; a.ph = Math.random() * 6.28; a.dir = Math.random() < 0.5 ? 1 : -1; }
  okFor(a, x, y) {
    const Rm = this.Rm, tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < 1 || ty < 1 || tx >= Rm.w - 1 || ty >= Rm.h - 1) return false;
    const A = ANIMALS[a.k], i = ix(Rm, tx, ty), g = Rm.ground[i];
    if (A.fly) return Rm.kind !== 'cave' || g !== ROCK;
    if (A.water) return g === WATER;
    if (A.shore) return !Rm.wild[i] && g !== WATER && g !== ROCK && N8.some(([dx, dy]) => inside(Rm, tx + dx * 2, ty + dy * 2) && Rm.ground[ix(Rm, tx + dx * 2, ty + dy * 2)] === WATER);
    return !Rm.wild[i] && g !== WATER && g !== ROCK && g !== VOID && !this.block[i];
  }
  stepAnimal(a, dt) {
    const Rm = this.Rm, A = ANIMALS[a.k], lively = Rm.kind === 'cave' ? 0.8 : this.mode === 'day' ? 1.35 : this.mode === 'evening' ? 0.75 : 1;
    if (A.night && this.mode !== 'evening') return;
    a.ph += dt * (A.fly ? 9 : 5) * lively;
    // tagging along behind you for a while (after a pat or a snack, or just because)
    const h = this.hero;
    if (!A.fly && !A.water && !(a.follow > this.t) && Math.random() < dt * 0.04 && Math.hypot(h.x - a.x, h.y - a.y) < 30) a.follow = this.t + 6 + Math.random() * 6;
    if (a.follow > this.t && !A.fly && !A.water) {
      const fx = h.x + (a.x < h.x ? -16 : 16) - a.x, fy = h.y + 2 - a.y;
      if (Math.hypot(fx, fy) > 6) { a.wait = 0; a.tx = a.x + fx; a.ty = a.y + fy; }
      else { a.tx = a.x; a.ty = a.y; a.vx = a.vy = 0; return; }
    }
    if (a.wait > 0) { a.wait -= dt; a.vx = a.vy = 0; return; }
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (d < 2) {
      a.wait = (A.fly ? 0.3 : 0.8) + Math.random() * (A.fly ? 1.5 : 3) / lively;
      let nx = a.x + (Math.random() - 0.5) * (A.fly ? 120 : 90), ny = a.y + (Math.random() - 0.5) * (A.fly ? 100 : 70);
      const mine = Wd.plantsIn(Rm, Math.floor(a.x / T) - 14, Math.floor(a.y / T) - 14, Math.floor(a.x / T) + 14, Math.floor(a.y / T) + 14);
      if (['butterfly', 'bee', 'dragonfly', 'glowworm'].includes(a.k) && mine.length) { const p = mine[(Math.random() * mine.length) | 0]; if (Math.hypot(p.x * T - a.x, p.y * T - a.y) < 220) { nx = p.x * T + 8; ny = p.y * T - 4; } }
      if (['songbird', 'owl', 'squirrel'].includes(a.k) && Math.random() < 0.5) { const p = mine[(Math.random() * mine.length) | 0]; if (p && PLANTS[p.k].type === 'tree' && Math.hypot(p.x * T - a.x, p.y * T - a.y) < 260) { nx = p.x * T + 8 + (Math.random() - 0.5) * 10; ny = p.y * T - (stageOf(p) === 3 ? 30 : 16); } }
      if (this.mode === 'day' && !A.fly && Math.random() < 0.25) { const f = Rm.animals.find((o) => o !== a && o.k === a.k && Math.hypot(o.x - a.x, o.y - a.y) < 160); if (f) { nx = f.x + (Math.random() - 0.5) * 20; ny = f.y + (Math.random() - 0.5) * 20; a.wait = 0; } }
      if (this.okFor(a, nx, ny)) { a.tx = nx; a.ty = ny; }
      return;
    }
    const sp = A.speed * lively * (a.baby ? 0.85 : 1) * (A.fly ? 1 + Math.sin(a.ph) * 0.3 : 1) * (a.follow > this.t ? 2.2 : 1);
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
        if (f.p.to === 'surface') this.say(Rm.kind === 'cave' ? 'Back out into the daylight' : 'Down the Cloud Stair to the meadows');
        Wd.saveGarden(true);
      }
      if (f.t >= 0.9) this.fade = null;
    }
    // the hero
    let vx = 0, vy = 0;
    // actions never hold the hero still: the pose plays only while standing, walking cancels it
    if (h.busy > 0) { h.busy -= dt; if (h.busy <= 0) h.actor.cancel(); }
    const deep = this.Rm.wild[ix(this.Rm, Math.floor(h.x / T), Math.floor((h.y - 2) / T))] || 0, slow = deep ? 0.62 : 1;
    if (this.stick) {
      const st = this.stick;
      let dx = st.x - st.ox, dy = st.y - st.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) { const ex = (d - STICK_R) / d; st.ox += dx * ex; st.oy += dy * ex; dx = st.x - st.ox; dy = st.y - st.oy; }
      if (d > 3) {
        if (h.actor.a.action) { h.actor.cancel(); h.busy = 0; }
        const m = Math.min(d / STICK_R, 1), dd = Math.hypot(dx, dy) || 1, sp = HERO_SPEED * slow * m;
        vx = (dx / dd) * sp; vy = (dy / dd) * sp;
        this.moveHero(vx * dt, vy * dt);
      }
    } else if (h.path.length) {
      const [px0, py0] = h.path[0], dx = px0 - h.x, dy = py0 - h.y, d = Math.hypot(dx, dy), sp = (this.auto ? 46 : 70) * slow;
      if (d < 1.5) h.path.shift();
      else { if (h.actor.a.action) { h.actor.cancel(); h.busy = 0; } const stp = Math.min(d, sp * dt); vx = (dx / d) * sp; vy = (dy / d) * sp; h.x += (dx / d) * stp; h.y += (dy / d) * stp; }
    } else if (h.task && h.busy <= 0) { const t = h.task; h.task = null; this.act(t); }
    this.underfoot(h, dt, vx || vy);
    this.portalUnderfoot();
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
    if (this.seenAcc > 0.3) { this.seenAcc = 0; this.markSeen(); this.growNear(); }
    // now and then a wisp of light drifts off toward something still hidden
    this.wispAcc = (this.wispAcc ?? 30) + dt;
    if (this.wispAcc > 45) { this.wispAcc = 0; this.wisp(); }
    // nearby animals live; far ones wait for you
    for (const a of cR.animals) if (Math.abs(a.x - this.cam.x) < VW * 1.3 && Math.abs(a.y - this.cam.y) < VH * 1.3) this.stepAnimal(a, dt);
    for (const n of this.npcs || []) this.stepNPC(n, dt);
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
    if (this.physAcc >= 1 / 60) { const pd = this.physAcc; this.physAcc = 0; this.rip.anchor(this.cam, cR); this.rip.step(); this.stepGrass(pd); this.stepPlants(pd); this.stepLeaves(pd); this.stepFog(pd); }
    this.saveAcc += dt;
    if (this.saveAcc > 20) { this.saveAcc = 0; cR.hero = { x: h.x, y: h.y }; Wd.saveGarden(); }
  }
  stepWeather(dt) {
    const w = this.weather, realm = this.Rm.kind;
    w.t += dt;
    if (this.mode === 'day' && realm !== 'cave' && w.t > w.until) {
      // lively days: gusts, passing showers with a rainbow after, bright spells
      const next = w.kind === 'rain' ? 'rainbow' : (realm === 'sky' ? ['gust', 'sun', 'gust', 'calm'] : ['gust', 'rain', 'sun', 'gust', 'calm'])[Math.floor(Math.random() * (realm === 'sky' ? 4 : 5))];
      w.kind = next; w.t = 0; w.until = next === 'rain' ? 14 : next === 'rainbow' ? 9 : next === 'gust' ? 7 : 12 + Math.random() * 10;
      if (next === 'rain') this.say('A spring shower passes over');
      if (next === 'rainbow') this.say('A rainbow!');
    }
    // a gentle wind: enough to stir the grass and walk the fog along, never a gale
    const target = realm === 'cave' ? 0 : this.mode === 'evening' ? 0.32 : this.mode === 'morning' ? 0.42 : w.kind === 'gust' ? 1.3 : w.kind === 'rain' ? 0.85 : 0.55;
    w.wind += (target - w.wind) * Math.min(1, dt * 0.25);
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
    const thirsty = Wd.plantsIn(Rm, hx - 10, hy - 10, hx + 10, hy + 10).filter((p) => !p.n && t - (p.w || 0) > 15 * 60e3 && stageOf(p) < 3 && Math.hypot(p.x - hx, p.y - hy) < 10).sort((p, q) => Math.hypot(p.x - hx, p.y - hy) - Math.hypot(q.x - hx, q.y - hy));
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
    if (this.Rm.kind === 'cave') return 0;
    const w = this.weather.wind;
    return w * (0.16 + 0.1 * Math.sin(t * 1.6 + x * 0.035) + 0.05 * Math.sin(t * 3.1 + x * 0.11)) * (this.weather.kind === 'gust' ? 1.6 : 1);
  }
  // who pushes the grass aside: the hero and the animals on foot, [x, y, vx, vy, mass]
  movers() {
    const h = this.hero, out = [[h.x, h.y, h.vx || 0, h.vy || 0, 1.4]];
    for (const a of this.Rm.animals) { const A = ANIMALS[a.k]; if (A.fly || A.water || Math.abs(a.x - this.cam.x) > VW || Math.abs(a.y - this.cam.y) > VH) continue; out.push([a.x, a.y, a.vx || 0, a.vy || 0, a.baby ? 0.5 : 0.8]); }
    for (const n of this.npcs || []) if (Math.abs(n.x - this.cam.x) < VW && Math.abs(n.y - this.cam.y) < VH) out.push([n.x, n.y, n.vx || 0, n.vy || 0, 1.2]);
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
    for (const p of Wd.plantsIn(this.Rm, Math.floor((this.cam.x - VW / 2) / T) - 4, Math.floor((this.cam.y - VH / 2) / T) - 4, Math.ceil((this.cam.x + VW / 2) / T) + 4, Math.ceil((this.cam.y + VH / 2) / T) + 6)) {
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
    const h = this.hero, wind = this.Rm.kind === 'cave' ? 0 : this.weather.wind;
    // trees shed now and then, more in a gust
    if (this.Rm.kind !== 'cave' && Math.random() < dt * wind * (this.weather.kind === 'gust' ? 3 : 0.8)) {
      const trees = Wd.plantsIn(this.Rm, Math.floor((this.cam.x - VW / 2) / T) - 4, Math.floor((this.cam.y - VH / 2) / T) - 4, Math.ceil((this.cam.x + VW / 2) / T) + 4, Math.ceil((this.cam.y + VH / 2) / T) + 6).filter((p) => PLANTS[p.k].type === 'tree' && stageOf(p) === 3 && Math.abs(p.x * T - this.cam.x) < VW * 0.6 && Math.abs(p.y * T - this.cam.y) < VH * 0.6);
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
    const b = this.buf.getContext('2d'), Rm = this.Rm, realm = Rm.kind, cx = Math.round(this.cam.x - VW / 2), cy = Math.round(this.cam.y - VH / 2), t = this.t, P = palFor(Rm.name, this.mode);
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
    const plantAlpha = settings.gardenPlantAlpha ?? 0.88;
    const vis = (x, y, m = 48) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m * 2, items = [], sw = this.sway;
    for (const r of Rm.ruins) if (r.found) {
      if (r.t === 'stones') { for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) { const x = (r.x + dx) * T + 8, y = (r.y + dy) * T + 14; if (vis(x, y)) items.push([y, 'ruin', { t: 'stones', x, y }]); } }
      else if (r.t !== 'glyphs') { const x = r.x * T + r.w * 8, y = (r.y + r.h) * T - 1; if (vis(x, y)) items.push([y, 'ruin', { t: r.t, x, y }]); }
    }
    for (const d of Rm.decor) if (d.t === 'crystal') { const x = d.x * T + 8, y = d.y * T + 14; if (vis(x, y)) items.push([y, 'crystal', d]); }
    for (const p of Wd.plantsIn(this.Rm, Math.floor((this.cam.x - VW / 2) / T) - 4, Math.floor((this.cam.y - VH / 2) / T) - 4, Math.ceil((this.cam.x + VW / 2) / T) + 4, Math.ceil((this.cam.y + VH / 2) / T) + 6)) { const x = p.x * T + 8, y = p.y * T + 14; if (vis(x, y, PLANTS[p.k].giant ? 120 : 48)) items.push([y, PLANTS[p.k].giant ? 'giant' : 'plant', p]); }
    for (const d of Rm.decor) if (d.t === 'lift') { const x = d.x * T + 8, y = d.y * T + 15; if (vis(x, y)) items.push([y - 1, 'lift', d]); }
    for (const a of Rm.animals) { if (ANIMALS[a.k].night && this.mode !== 'evening') continue; if (vis(a.x, a.y)) items.push([a.y + (ANIMALS[a.k].fly ? 30 : 0), 'animal', a]); }
    items.push([this.hero.y, 'hero']);
    for (const n of this.npcs || []) if (vis(n.x, n.y)) items.push([n.y, 'npc', n]);
    items.sort((p, q) => p[0] - q[0]);
    const canopies = [];
    for (const [, kind, o] of items) {
      if (kind === 'plant') {
        const st = stageOf(o), s = Wd.plantSprite(o.k, st, o.fr > 0), x = o.x * T + 8 - cx, y = o.y * T + 14 - cy, a = sw?.get(o)?.a || 0;
        // ground plants are a touch see-through (the setting, ±3% per plant, kept within 80–95%); trees stay solid
        b.globalAlpha = PLANTS[o.k].type === 'tree' ? 1 : Math.max(0.8, Math.min(0.95, plantAlpha + (((o.x * 7 + o.y * 13) % 7) - 3) * 0.01));
        if (!a) b.drawImage(s.cv, Math.round(x - s.w / 2), Math.round(y - s.h));
        else {
          // bend from the root: shift each row of the sprite by how far up it is (stays pixel-crisp)
          const rows = s.h, step = Math.max(2, Math.round(rows / 6));
          for (let r0 = 0; r0 < rows; r0 += step) { const hgt = Math.min(step, rows - r0), up = (rows - r0) / rows; b.drawImage(s.cv, 0, r0, s.w, hgt, Math.round(x - s.w / 2 + a * up * up * rows * 0.5), Math.round(y - s.h + r0), s.w, hgt); }
        }
        b.globalAlpha = 1;
      } else if (kind === 'giant') {
        const S = Wd.giantSprites(o.x * 7 + o.y), x = Math.round(o.x * T + 8 - cx), y = Math.round(o.y * T + 14 - cy);
        b.fillStyle = 'rgba(10,30,15,.18)'; b.beginPath(); b.ellipse(x, y - 4, 58, 22, 0, 0, 7); b.fill();
        b.drawImage(S.trunk.cv, x - (S.trunk.w >> 1), y - S.trunk.h + 2);
        canopies.push([o, S, x, y]);
      } else if (kind === 'lift') { const s = Wd.liftSprite(o.up); b.drawImage(s.cv, Math.round(o.x * T + 8 - cx - s.w / 2), Math.round(o.y * T + 15 - cy - s.h + 6)); }
      else if (kind === 'ruin') { const s = Wd.ruinSprite(o.t, P); b.drawImage(s.cv, Math.round(o.x - cx - s.w / 2), Math.round(o.y - cy - s.h)); }
      else if (kind === 'crystal') { const s = Wd.crystalSprite(o.c); b.drawImage(s.cv, o.x * T + 2 - cx, o.y * T + 15 - cy - s.h); }
      else if (kind === 'animal') {
        const A = ANIMALS[o.k], f = Math.sin(o.ph) > 0 ? 1 : 0, s = Wd.animalSprite(o.k, A.fly || A.hop || o.wait <= 0 ? f : 0), k = o.baby ? 0.65 : 1;
        const hop = A.hop && o.wait <= 0 ? Math.abs(Math.sin(o.ph)) * (this.mode === 'day' ? 4 : 2.5) : 0, fly = A.fly ? 10 + Math.sin(o.ph * 0.5) * 3 : 0, x = Math.round(o.x - cx), y = Math.round(o.y - cy);
        if (!A.fly && !A.water) { b.fillStyle = 'rgba(0,0,0,.16)'; b.fillRect(x - Math.round(4 * k), y - 1, Math.round(8 * k), 2); }
        if (A.fly) { b.fillStyle = 'rgba(0,0,0,.08)'; b.fillRect(x - 2, y + 2, 4, 1); }
        b.save(); b.translate(x, Math.round(y - hop - fly)); if (o.dir < 0) b.scale(-1, 1);
        if (k !== 1) b.drawImage(s.cv, -Math.floor(s.w * k / 2), -Math.round(s.h * k), Math.round(s.w * k), Math.round(s.h * k)); else b.drawImage(s.cv, -Math.floor(s.w / 2), -s.h);
        b.restore();
      } else if (kind === 'hero' || kind === 'npc') {
        const w = kind === 'hero' ? this.hero : o;
        b.fillStyle = 'rgba(0,0,0,.18)'; b.fillRect(Math.round(w.x - cx) - 6, Math.round(w.y - cy) - 1, 12, 2);
        w.actor.draw(b, Math.round(w.x - cx), Math.round(w.y - cy), 1);
      }
    }
    // the ancient trees' crowns, over everything; thin to a veil when you walk beneath one
    const ca = (this.canopyA ||= new WeakMap()), hx = this.hero.x - cx, hy = this.hero.y - cy - 10;
    for (const [o, S, x, y] of canopies) {
      const top = y - S.trunk.h - S.canopy.h * 0.55, under = Math.abs(hx - x) < 56 && hy > top - 4 && hy < y - 4;
      const a = ca.get(o) ?? 1, to = under ? 0.32 : 1, na = a + (to - a) * 0.12; ca.set(o, na);
      b.globalAlpha = na; b.drawImage(S.canopy.cv, x - (S.canopy.w >> 1) + Math.round(Math.sin(t * 0.5 + o.x) * 1.2), Math.round(top)); b.globalAlpha = 1;
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
    this.drawFog(b, cx, cy);
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
    const Rm = this.Rm, t = this.t, sky = Rm.kind === 'sky';
    if (Rm.kind === 'cave' || !this.grass.size) return;
    const tufts = this.tuftCols ||= {};
    const key = `${Rm.name}${this.mode}`;
    tufts[key] ||= sky ? [Wd.tone(P.grass[0], -0.16), Wd.tone(P.grass[2], 0.1), P.grass[0], P.grass[0]] : [Wd.tone(P.grass[0], -0.24), Wd.tone(P.grass[2], 0.1), Wd.tone(P.forest[0], -0.26), Wd.tone(P.forest[2], 0.08)];
    const tc = tufts[key], wildCols = sky ? [P.grass[2], P.grass[0]] : [P.blade, P.wild[0]];
    b.globalAlpha = Math.max(0.8, Math.min(0.95, settings.gardenPlantAlpha ?? 0.88));
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
    b.globalAlpha = 1;
  }
  // the dream layer: a darker, cooler grade and a soft bloom so the lights smear a little, as in a
  // half-remembered place (the fog itself lives in the world: see stepFog)
  drawAtmos(b, cx, cy) {
    const realm = this.Rm.kind, mode = this.mode, t = this.t, A = ATMOS[realm === 'cave' ? 'cave' : mode] || ATMOS.day;
    b.globalCompositeOperation = 'multiply'; b.globalAlpha = A.dimA; b.fillStyle = A.dim; b.fillRect(0, 0, VW, VH);
    b.globalCompositeOperation = 'saturation'; b.globalAlpha = A.desat; b.fillStyle = '#808080'; b.fillRect(0, 0, VW, VH);
    b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
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
  // fog and cloud: patches that sit in the world and drift slowly downwind. Each is a cluster of soft
  // puffs on springs; whoever walks through pushes them aside and they drift closed behind.
  // Denser over water and in the forest, densest at dawn; in the sky they are the clouds.
  stepFog(dt) {
    const Rm = this.Rm, realm = Rm.kind, A = ATMOS[realm === 'cave' ? 'cave' : this.mode] || ATMOS.day, w = this.weather;
    const want = Math.round(A.fog * (realm === 'sky' ? 1.5 : 1) * (w.kind === 'rain' ? 1.3 : 1)), fog = (this.fog ||= []);
    const mx0 = this.cam.x - VW / 2 - 90, my0 = this.cam.y - VH / 2 - 90, mw = VW + 180, mh = VH + 180;
    const drift = realm === 'cave' ? 0.6 : 2 + w.wind * 6, ang = Math.sin(this.t * 0.013) * 0.5;
    // keep a field of patches around the view; new ones drift in from upwind
    for (let n = 0; fog.length < want && n < 3; n++) {
      let best = null, bs = -1;
      for (let k = 0; k < 6; k++) {
        const fresh = !this.fogInit, x = fresh ? mx0 + Math.random() * mw : mx0 - 30 + Math.random() * 40, y = my0 + Math.random() * mh, tx = Math.floor(x / T), ty = Math.floor(y / T);
        const g = inside(Rm, tx, ty) ? Rm.ground[ix(Rm, tx, ty)] : -1, sc = Math.random() + (g === WATER ? 1.2 : g === FOREST ? 0.8 : 0) + (inside(Rm, tx, ty) && Rm.wild[ix(Rm, tx, ty)] ? 0.4 : 0);
        if (sc > bs) { bs = sc; best = [x, y]; }
      }
      const r = 1 + Math.random(), n0 = 4 + Math.floor(Math.random() * 5);
      fog.push({ x: best[0], y: best[1], a: 0, life: 40 + Math.random() * 60, puffs: Array.from({ length: n0 }, () => ({ ox: (Math.random() - 0.5) * 64 * r, oy: (Math.random() - 0.5) * 30 * r, r: 14 + Math.random() * 16 * r, dx: 0, dy: 0, vx: 0, vy: 0 })) });
    }
    this.fogInit = true;
    const mv = this.movers();
    for (const f of fog) {
      f.x += Math.cos(ang) * drift * dt; f.y += Math.sin(ang) * drift * 0.3 * dt;
      f.life -= dt; f.a += ((f.life > 0 ? 1 : 0) - f.a) * Math.min(1, dt * 0.4);
      for (const p of f.puffs) {
        const px = f.x + p.ox + p.dx, py = f.y + p.oy + p.dy;
        let fx = -p.dx * 1.2 - p.vx * 1.6, fy = -p.dy * 1.2 - p.vy * 1.6;
        for (const [ax, ay, avx, avy, m] of mv) {
          const ex = px - ax, ey = py - (ay - 6), d = Math.hypot(ex, ey), reach = p.r + 14;
          if (d < reach && d > 0.01) { const k = (1 - d / reach) * (120 + Math.hypot(avx, avy) * 2) * m; fx += (ex / d) * k; fy += (ey / d) * k * 0.7; }
        }
        p.vx += fx * dt; p.vy += fy * dt; p.dx += p.vx * dt; p.dy += p.vy * dt;
      }
    }
    this.fog = fog.filter((f) => (f.life > 0 || f.a > 0.02) && f.x > mx0 - 120 && f.x < mx0 + mw + 120 && f.y > my0 - 120 && f.y < my0 + mh + 120);
  }
  drawFog(b, cx, cy) {
    if (!this.fog?.length) return;
    const realm = this.Rm.kind, A = ATMOS[realm === 'cave' ? 'cave' : this.mode] || ATMOS.day, col = realm === 'sky' ? A.cloudCol || A.mistCol : A.mistCol;
    for (const f of this.fog) for (const p of f.puffs) {
      const s = puffTex(Math.round(p.r / 3) * 3, col), x = Math.round(f.x + p.ox + p.dx - cx - s.width / 2), y = Math.round(f.y + p.oy + p.dy - cy - s.height / 2);
      if (x > VW || y > VH || x + s.width < 0 || y + s.height < 0) continue;
      b.globalAlpha = f.a * A.fogA * (realm === 'sky' ? 1.25 : 1); b.drawImage(s, x, y);
    }
    b.globalAlpha = 1;
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
    const P = palFor(this.Rm.name, this.mode), t = this.t, g = b.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, P.bg[0]); g.addColorStop(1, P.bg[1]);
    b.fillStyle = g; b.fillRect(0, 0, VW, VH);
    if (this.Rm.name === 'canopy') {
      // the treetops: the forest floor far below, trunks falling away into the dark, light coming
      // down in shafts, and the crowns of other trees drifting past
      for (let i = 0; i < 9; i++) { const x = ((i * 53 - this.cam.x * 0.25) % (VW + 60) + VW + 60) % (VW + 60) - 30; b.fillStyle = `rgba(20,14,10,${0.35 + (i % 3) * 0.12})`; b.fillRect(Math.round(x), 0, 6 + (i % 4) * 3, VH); }
      b.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) { const x = ((i * 97 - this.cam.x * 0.4 + t * 2) % (VW + 80) + VW + 80) % (VW + 80) - 40; b.fillStyle = 'rgba(200,230,150,.05)'; b.beginPath(); b.moveTo(x, 0); b.lineTo(x + 22, 0); b.lineTo(x + 52, VH); b.lineTo(x + 20, VH); b.fill(); }
      b.globalCompositeOperation = 'source-over';
      b.fillStyle = P.cloud;
      for (let i = 0; i < 6; i++) { const x = ((i * 141 - this.cam.x * 0.5) % (VW + 200) + VW + 200) % (VW + 200) - 100, y = ((i * 87 - this.cam.y * 0.5) % (VH + 70) + VH + 70) % (VH + 70) - 35; b.globalAlpha = 0.35; for (const [dx, dy, r] of [[0, 0, 24], [20, 5, 18], [-18, 6, 16]]) { b.beginPath(); b.ellipse(Math.round(x + dx), Math.round(y + dy), r, Math.round(r * 0.6), 0, 0, 7); b.fill(); } }
      b.globalAlpha = 1;
      return;
    }
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
    const t = this.t, w = this.weather, realm = this.Rm.kind, sx = (x) => x - cx, sy = (y) => y - cy;
    const glow = (x, y, r, col, a) => { const rg = b.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col.replace('A', a)); rg.addColorStop(1, col.replace('A', 0)); b.fillStyle = rg; b.fillRect(x - r, y - r, r * 2, r * 2); };
    if (realm === 'cave') {
      // darkness, with the lantern, glowshrooms, crystals and shafts of daylight cut out of it
      this.dark ||= Object.assign(document.createElement('canvas'), { width: VW, height: VH });
      const d = this.dark.getContext('2d');
      d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, VW, VH); d.fillStyle = 'rgba(8,6,16,.84)'; d.fillRect(0, 0, VW, VH);
      d.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a = 1) => { const rg = d.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(0,0,0,${a})`); rg.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = rg; d.fillRect(x - r, y - r, r * 2, r * 2); };
      hole(sx(this.hero.x), sy(this.hero.y - 10), 104 + Math.sin(t * 7) * 2);
      for (const n of this.npcs || []) hole(sx(n.x), sy(n.y - 10), 46 + Math.sin(t * 6 + n.k) * 2, 0.9);
      const lights = [];
      for (const p of Wd.plantsIn(this.Rm, Math.floor((this.cam.x - VW / 2) / T) - 4, Math.floor((this.cam.y - VH / 2) / T) - 4, Math.ceil((this.cam.x + VW / 2) / T) + 4, Math.ceil((this.cam.y + VH / 2) / T) + 6)) if (PLANTS[p.k].glow && stageOf(p) >= 2) lights.push([p.x * T + 8, p.y * T + 6, 27, '#8ff0d8']);
      for (const dc of this.Rm.decor) if (dc.t === 'crystal') lights.push([dc.x * T + 8, dc.y * T + 6, 31, dc.c]);
      for (const p of this.Rm.portals) lights.push([p.x * T + 8, p.y * T + 8, 54, '#fff0c8']);
      for (const d of this.Rm.decor) if (d.t === 'lift') lights.push([d.x * T + 8, d.y * T + 8, 60, d.up ? '#bfe8ff' : '#ffd8a0']);
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
    b.globalCompositeOperation = 'lighter';
    for (const d of this.Rm.decor) {
      if (d.t !== 'lift' || !d.up) continue;
      const X = sx(d.x * T + 8), Y = sy(d.y * T + 12);
      if (X < -20 || X > VW + 20 || Y < -10 || Y > VH + 120) continue;
      const gr = b.createLinearGradient(0, Y - 110, 0, Y), k = 0.16 + Math.sin(t * 1.6 + d.x) * 0.05;
      gr.addColorStop(0, 'rgba(190,230,255,0)'); gr.addColorStop(1, `rgba(190,230,255,${k})`);
      b.fillStyle = gr; b.fillRect(X - 6, Y - 110, 12, 110);
    }
    b.globalCompositeOperation = 'source-over';
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
      for (const p of Wd.plantsIn(this.Rm, Math.floor((this.cam.x - VW / 2) / T) - 4, Math.floor((this.cam.y - VH / 2) / T) - 4, Math.ceil((this.cam.x + VW / 2) / T) + 4, Math.ceil((this.cam.y + VH / 2) / T) + 6)) { const Pp = PLANTS[p.k]; if (!Pp.glow || stageOf(p) < 2) continue; const x = sx(p.x * T + 8), y = sy(p.y * T + 14 - (Pp.type === 'tree' ? 22 : 8)); if (x < -30 || y < -30 || x > VW + 30 || y > VH + 30) continue; glow(x, y, Pp.type === 'tree' ? 20 : 9, 'rgba(255,230,160,A)', 0.35 + Math.sin(t * 2 + p.x) * 0.08); }
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
    const q = this.quote;
    if (q) {
      q.t += 1 / 60;
      if (q.t > q.life || !this.npcs?.includes(q.n)) this.quote = null;
      else {
        const a = Math.min(1, q.t * 3, (q.life - q.t) * 1.5), sx = (q.n.x - this.cam.x + VW / 2) * Z, sy = (q.n.y - this.cam.y + VH / 2) * Z;
        c.save(); c.globalAlpha = Math.max(0, a);
        c.font = 'italic 13px Georgia, serif';
        const words = q.text.split(' '), lines = []; let line = '';
        for (const w of words) { const tr = line ? `${line} ${w}` : w; if (c.measureText(tr).width > 210 && line) { lines.push(line); line = w; } else line = tr; }
        lines.push(line);
        const bw = Math.min(232, Math.max(...lines.map((l) => c.measureText(l).width)) + 22), bh = lines.length * 17 + 30;
        const bx = Math.max(8, Math.min(W - bw - 8, sx - bw / 2)), by = Math.max(8, sy - 52 - bh);
        c.fillStyle = 'rgba(24,20,30,.78)'; c.beginPath(); c.roundRect?.(bx, by, bw, bh, 10); if (!c.roundRect) c.rect(bx, by, bw, bh); c.fill();
        c.beginPath(); c.moveTo(Math.max(bx + 14, Math.min(bx + bw - 14, sx)) - 6, by + bh); c.lineTo(Math.max(bx + 14, Math.min(bx + bw - 14, sx)), by + bh + 8); c.lineTo(Math.max(bx + 14, Math.min(bx + bw - 14, sx)) + 6, by + bh); c.fill();
        c.fillStyle = '#f3ead8'; c.textBaseline = 'top';
        lines.forEach((l, i) => c.fillText(l, bx + 11, by + 9 + i * 17));
        c.font = '11px system-ui, sans-serif'; c.fillStyle = 'rgba(243,234,216,.62)'; c.fillText(`— ${q.by}`, bx + 11, by + 12 + lines.length * 17);
        c.restore();
      }
    }
    if (this.stick) {
      const st = this.stick, dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), k = Math.min(d, STICK_R) / (d || 1);
      c.strokeStyle = 'rgba(232,240,227,.22)'; c.lineWidth = 1.5; c.beginPath(); c.arc(st.ox, st.oy, STICK_R, 0, 7); c.stroke();
      c.fillStyle = 'rgba(240,232,214,.28)'; c.beginPath(); c.arc(st.ox + dx * k, st.oy + dy * k, 12, 0, 7); c.fill();
    }
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
