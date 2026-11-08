// Garden: one shared world, saved on the phone, that grows in real time. Every garden card opens the
// same world. Tap to walk; plant, water and harvest; feed the animals (fed pairs have young); clear
// tall grass, rubble and mist to explore. The meadows have lakes (build plank bridges out to the
// islands), forests, flower fields and rocky hills; cave mouths lead down into the dark caverns; the
// Cloud Stair, once uncovered, climbs to the sky islands. The light follows the feed: pastel spring
// in the morning, lively weather in the day, dusk in the evening. On autopilot the gardener only
// waters, wanders and visits the animals; planting, clearing, building and exploring are yours.
// There is no text anywhere: everything is told with light, sparkles, hearts and small icons.
import { Game, W, H, roundRect } from './engine.js';
import { Actor } from '../crystal/sprites.js';
import { getMode } from '../modes.js';
import * as Wd from './garden-world.js';

const { T, CH, HR, WATER, PATH, STONE, BRIDGE, ROCK, PORTAL, VOID, PLANTS, ANIMALS, COMMON, REALM_NAME, stageOf, FRUIT_CAP, ix, inside, now, palFor } = Wd;
const Z = 1.5, VW = W / Z, VH = H / Z, CP = CH * T;
const MODES = ['morning', 'day', 'evening'];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

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
    this.amb = Array.from({ length: realm === 'cave' ? 22 : this.mode === 'evening' ? 26 : 18 }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 6.28, s: 0.5 + Math.random() }));
    Wd.minimap(Rm);
    this.computeBlock();
    this.markSeen();
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
    for (const p of Rm.plants) if (PLANTS[p.k].type === 'tree' && stageOf(p) >= 2) b[ix(Rm, p.x, p.y)] = 1;
    for (const r of Rm.ruins) {
      if (!r.found) continue;
      if (r.t === 'stones') { for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) b[ix(Rm, r.x + dx, r.y + dy)] = 1; continue; }
      if (r.solid) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) b[ix(Rm, x, y)] = 1;
    }
    this.block = b;
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
    if (this.uiTap(x, y)) return;
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
  uiTap(x, y) {
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h, g = Wd.G;
    if (hit(this.ui?.seed)) {
      const kinds = Object.keys(g.inv.seeds).filter((k) => g.inv.seeds[k] > 0);
      if (!kinds.length) { this.say('No seeds: gather them from blooming flowers'); return true; }
      g.inv.pick = kinds[(kinds.indexOf(g.inv.pick) + 1) % kinds.length];
      this.say(`Planting ${PLANTS[g.inv.pick].name.toLowerCase()} (${g.inv.seeds[g.inv.pick]} seeds)`);
      return true;
    }
    if (hit(this.ui?.ruins)) {
      const Rm0 = this.Rm, hx0 = this.hero.x / T, hy0 = this.hero.y / T, u0 = Rm0.ruins.filter((u) => !u.found).sort((p, q) => Math.hypot(p.x - hx0, p.y - hy0) - Math.hypot(q.x - hx0, q.y - hy0))[0];
      if (u0) { const a = Math.atan2(u0.y + u0.h / 2 - hy0, u0.x + u0.w / 2 - hx0); for (let i = 1; i <= 9; i++) this.fx.push({ kind: 'trail', x: this.hero.x + Math.cos(a) * i * 13, y: this.hero.y - 4 + Math.sin(a) * i * 13, t: -i * 0.12, life: 2.2 }); }
      const Rm = this.Rm, hx = this.hero.x / T, hy = this.hero.y / T, left = Rm.ruins.filter((u) => !u.found).sort((p, q) => Math.hypot(p.x - hx, p.y - hy) - Math.hypot(q.x - hx, q.y - hy));
      if (!left.length) this.say(Rm.name === 'surface' ? 'Every ruin in the meadows is found. The caves and the sky hold more' : 'Every ruin here has been found');
      else { const u = left[0], dir = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round(((Math.atan2(u.y - hy, u.x - hx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8], far = Math.hypot(u.x - hx, u.y - hy); this.say(`Something old lies ${far > 30 ? 'far' : far > 14 ? 'a way' : 'just'} to the ${dir}`); }
      return true;
    }
    return hit(this.ui?.map);
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
        this.puff(task.x * T + 8, task.y * T + 8, Rm.name === 'sky' ? '#ffffff' : '#c8a070', 10);
        this.say(Rm.name === 'sky' ? 'You called a cloud to step on' : Rm.name === 'cave' ? 'Laid planks across the pool' : 'Built a little plank bridge');
        Wd.saveGarden(true);
      });
    } else if (task.kind === 'portal') {
      const p = task.p;
      a.emote(p.to === 'sky' ? 'surprise' : 'nod', 0.8); h.busy = 0.5;
      this.fade = { t: 0, p, col: p.to === 'cave' || Rm.name === 'cave' ? '#07050c' : '#ffffff' };
    } else if (task.kind === 'plant-here') {
      const k = g.inv.pick, P = PLANTS[k], gr = Rm.ground[ix(Rm, task.x, task.y)];
      if (!g.inv.seeds[k]) { this.say('Out of those seeds: tap the seed button to pick others'); return; }
      if (Rm.plants.some((p) => p.x === task.x && p.y === task.y) || !this.open(task.x, task.y) || [STONE, PORTAL, BRIDGE].includes(gr)) { this.say('Can’t plant just there'); return; }
      if (Rm.name === 'cave' && !P.cave) { this.say('Only glowshrooms grow down here in the dark'); return; }
      if (Rm.name !== 'cave' && P.cave) { this.say('Glowshrooms need the dark of the caverns'); return; }
      if (P.type === 'tree' && Rm.plants.some((p) => PLANTS[p.k].type === 'tree' && Math.hypot(p.x - task.x, p.y - task.y) < 2.5)) { this.say('Trees need a little more room'); return; }
      a.cast(); h.busy = 0.5;
      this.later(0.4, () => {
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
        a.emote('love', 1.2); h.busy = 0.6; g.inv.food--; o.f = t; o.wait = 1.5;
        this.hearts(o.x, o.y - 10); this.say(`You fed the ${o.baby ? 'baby ' : ''}${o.k === 'cloudsheep' ? 'cloud sheep' : o.k}`);
        this.breed(o);
      } else {
        a.emote(A.eats ? 'wave' : 'love', 1.2); h.busy = 0.5; o.wait = 1.2; this.hearts(o.x, o.y - 8);
        if (A.eats && !g.inv.food) this.say('No food left: pick berries or apples');
      }
      Wd.saveGarden(true);
    } else if (task.kind === 'ruin') { a.emote('think', 1.4); h.busy = 0.6; this.say(`${task.r.name[0].toUpperCase()}${task.r.name.slice(1)}. ${task.r.lore}`); }
    else if (task.kind === 'pet') { a.emote('love', 1); h.busy = 0.4; this.hearts(task.a.x, task.a.y - 8); task.a.wait = 1; }
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
    if (a.wait > 0) { a.wait -= dt; return; }
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
    a.x += mx; a.y += my;
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
    if (h.busy > 0) h.busy -= dt;
    else if (h.path.length) {
      const [px0, py0] = h.path[0], dx = px0 - h.x, dy = py0 - h.y, d = Math.hypot(dx, dy), sp = this.auto ? 46 : 70;
      if (d < 1.5) h.path.shift();
      else { const stp = Math.min(d, sp * dt); vx = (dx / d) * sp; vy = (dy / d) * sp; h.x += (dx / d) * stp; h.y += (dy / d) * stp; }
    } else if (h.task) { const t = h.task; h.task = null; this.act(t); }
    h.actor.update(dt, { vx, vy });
    const cR = this.Rm;
    this.cam.x += (h.x - this.cam.x) * Math.min(1, dt * 3);
    this.cam.y += (h.y - 16 - this.cam.y) * Math.min(1, dt * 3);
    this.cam.x = Math.max(VW / 2, Math.min(cR.w * T - VW / 2, this.cam.x));
    this.cam.y = Math.max(VH / 2, Math.min(cR.h * T - VH / 2, this.cam.y));
    if (!this.live) return;
    this.seenAcc += dt;
    if (this.seenAcc > 0.3) { this.seenAcc = 0; this.markSeen(); }
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
    if (w.kind === 'rain' && this.mode === 'day' && realm === 'surface') for (let i = 0; i < 6; i++) w.rain.push({ x: Math.random() * (W + 60) - 30, y: -10, v: 260 + Math.random() * 120 });
    for (const r of w.rain) r.y += r.v * dt;
    w.rain = w.rain.filter((r) => r.y < H);
    const evening = this.mode === 'evening' || realm === 'cave';
    for (const p of this.amb) { p.p += dt * p.s; p.x += Math.sin(p.p) * 6 * dt + w.wind * (evening ? 2 : 10) * dt; p.y += (evening ? Math.cos(p.p * 0.7) * 5 : 9 + p.s * 6) * dt * (realm === 'cave' ? 0.4 : 1); if (p.x > W + 8) p.x = -8; if (p.x < -8) p.x = W + 8; if (p.y > H + 8) { p.y = -8; p.x = Math.random() * W; } if (p.y < -8) p.y = H + 8; }
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

  // ---------------------------------------------- drawing
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
    const Rm = this.Rm, realm = Rm.name, cx = Math.round(this.cam.x - VW / 2), cy = Math.round(this.cam.y - VH / 2), t = this.t, wind = this.weather.wind;
    if (realm === 'sky') this.drawSkyBg(c); else { c.fillStyle = realm === 'cave' ? '#0d0a12' : '#3a4a3a'; c.fillRect(0, 0, W, H); }
    c.save(); c.scale(Z, Z);
    const x0 = Math.floor(cx / CP), x1 = Math.floor((cx + VW) / CP), y0 = Math.floor(cy / CP), y1 = Math.floor((cy + VH) / CP);
    const ok = (gx, gy) => gx >= 0 && gy >= 0 && gx * CH < Rm.w && gy * CH < Rm.h;
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) if (ok(gx, gy)) c.drawImage(Wd.chunk(Rm, this.mode, gx, gy).gc, gx * CP - cx, gy * CP - cy);
    // water shimmer
    if (realm !== 'sky') {
      c.fillStyle = realm === 'cave' ? 'rgba(160,210,255,.35)' : 'rgba(255,255,255,.55)';
      const tx0 = Math.floor(cx / T), ty0 = Math.floor(cy / T);
      for (let ty = ty0; ty <= ty0 + VH / T + 1; ty++) for (let tx = tx0; tx <= tx0 + VW / T + 1; tx++) {
        if (!inside(Rm, tx, ty) || Rm.ground[ix(Rm, tx, ty)] !== WATER) continue;
        if (Math.sin(t * 1.4 + tx * 1.7 + ty * 2.3) > 0.3) c.fillRect(tx * T - cx + 3 + ((t * 6 + tx * 5) % 9), ty * T - cy + 6 + (ty % 3) * 3, 4, 1);
      }
    }
    // tall grass sways in strips; rubble and mist sit still
    for (let y = 0; y < VH; y += 4) {
      const wy = cy + y, gy = Math.floor(wy / CP), sy = wy - gy * CP, hgt = Math.min(4, CP - sy);
      const off = realm === 'surface' ? Math.round(Math.sin(t * 1.7 + wy * 0.05) * wind * 0.9 + Math.sin(t * 0.6 + wy * 0.013) * wind * 0.6) : realm === 'sky' ? Math.round(Math.sin(t * 0.4 + wy * 0.02) * 1.5) : 0;
      for (let gx = x0; gx <= x1; gx++) if (ok(gx, gy)) c.drawImage(Wd.chunk(Rm, this.mode, gx, gy).wc, 0, sy, CP, hgt, gx * CP - cx + off, y, CP, hgt);
    }
    // things, back to front
    const vis = (x, y, m = 48) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m * 2, items = [];
    for (const r of Rm.ruins) if (r.found) {
      if (r.t === 'stones') { for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) { const x = (r.x + dx) * T + 8, y = (r.y + dy) * T + 14; if (vis(x, y)) items.push([y, 'ruin', { t: 'stones', x, y }]); } }
      else if (r.t !== 'glyphs') { const x = r.x * T + r.w * 8, y = (r.y + r.h) * T - 1; if (vis(x, y)) items.push([y, 'ruin', { t: r.t, x, y }]); }
    }
    for (const d of Rm.decor) if (d.t === 'crystal') { const x = d.x * T + 8, y = d.y * T + 14; if (vis(x, y)) items.push([y, 'crystal', d]); }
    for (const p of Rm.plants) { const x = p.x * T + 8, y = p.y * T + 14; if (vis(x, y)) items.push([y, 'plant', p]); }
    for (const a of Rm.animals) { if (ANIMALS[a.k].night && this.mode !== 'evening') continue; if (vis(a.x, a.y)) items.push([a.y + (ANIMALS[a.k].fly ? 30 : 0), 'animal', a]); }
    items.push([this.hero.y, 'hero']);
    items.sort((p, q) => p[0] - q[0]);
    const P = palFor(realm, this.mode);
    for (const [, kind, o] of items) {
      if (kind === 'plant') {
        const st = stageOf(o), s = Wd.plantSprite(o.k, st, o.fr > 0), x = o.x * T + 8 - cx, y = o.y * T + 14 - cy;
        const sway = st === 0 ? 0 : Math.sin(t * 2 + o.x * 0.7 + o.y * 0.3) * 0.05 * wind * (PLANTS[o.k].type === 'tree' ? 0.4 : 1);
        c.save(); c.translate(x, y); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(s.cv, -Math.floor(s.w / 2), -s.h); c.restore();
      } else if (kind === 'ruin') { const s = Wd.ruinSprite(o.t, P); c.drawImage(s.cv, Math.round(o.x - cx - s.w / 2), Math.round(o.y - cy - s.h)); }
      else if (kind === 'crystal') { const s = Wd.crystalSprite(o.c); c.drawImage(s.cv, o.x * T + 2 - cx, o.y * T + 14 - cy - s.h); }
      else if (kind === 'animal') {
        const A = ANIMALS[o.k], f = Math.sin(o.ph) > 0 ? 1 : 0, s = Wd.animalSprite(o.k, A.fly || A.hop || o.wait <= 0 ? f : 0), k = o.baby ? 0.65 : 1;
        const hop = A.hop && o.wait <= 0 ? Math.abs(Math.sin(o.ph)) * (this.mode === 'day' ? 4 : 2.5) : 0, fly = A.fly ? 10 + Math.sin(o.ph * 0.5) * 3 : 0, x = o.x - cx, y = o.y - cy;
        if (!A.fly && !A.water) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(x, y, 5 * k, 1.8 * k, 0, 0, 7); c.fill(); }
        c.save(); c.translate(Math.round(x), Math.round(y - hop - fly)); if (o.dir < 0) c.scale(-1, 1); c.scale(k, k); c.drawImage(s.cv, -Math.floor(s.w / 2), -s.h); c.restore();
      } else if (kind === 'hero') {
        c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(this.hero.x - cx, this.hero.y - cy, 7, 2.5, 0, 0, 7); c.fill();
        this.hero.actor.draw(c, Math.round(this.hero.x - cx), Math.round(this.hero.y - cy), 1);
      }
    }
    for (const f of this.fx) {
      if (f.t < 0) continue;
      const k = f.t / f.life, x = f.x - cx + (f.vx || 0) * f.t, y = f.y - cy + (f.vy || 0) * f.t + (f.kind === 'leaf' || f.kind === 'dot' ? 60 * f.t * f.t : 0);
      c.globalAlpha = Math.max(0, 1 - k);
      if (f.kind === 'ring') { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, 4 + k * 10, 2 + k * 5, 0, 0, 7); c.stroke(); }
      else if (f.kind === 'heart') { c.fillStyle = '#ff7a9a'; const X = Math.round(x) - 3, Y = Math.round(y) - 3; c.fillRect(X + 1, Y, 2, 1); c.fillRect(X + 4, Y, 2, 1); c.fillRect(X, Y + 1, 7, 2); c.fillRect(X + 1, Y + 3, 5, 1); c.fillRect(X + 2, Y + 4, 3, 1); c.fillRect(X + 3, Y + 5, 1, 1); }
      else if (f.kind === 'glow') { const r = 10 + k * 70; c.strokeStyle = '#fff6c8'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, 7); c.stroke(); c.globalAlpha *= 0.5; c.beginPath(); c.ellipse(x, y, r * 0.6, r * 0.3, 0, 0, 7); c.stroke(); }
      else if (f.kind === 'trail') { const fade = Math.sin(Math.min(1, k) * Math.PI); c.globalAlpha = fade * 0.9; c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(x, y, 1.8, 0, 7); c.fill(); }
      else if (f.kind === 'drop') { c.fillStyle = '#7ac8f0'; c.fillRect(x, y, 1, 3); }
      else { c.fillStyle = f.c || '#fff'; c.fillRect(x, y, 2, 2); }
    }
    c.globalAlpha = 1;
    c.restore();
    this.drawLight(c, cx, cy);
    this.drawUI(c);
    if (this.fade) { const f = this.fade, a = f.t < 0.45 ? f.t / 0.45 : 1 - (f.t - 0.45) / 0.45; c.globalAlpha = Math.max(0, Math.min(1, a)); c.fillStyle = f.col; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  }
  // the open sky under the islands: gradient, drifting cloud banks, far islands and now and then a sky whale
  drawSkyBg(c) {
    const P = palFor('sky', this.mode), t = this.t, g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.bg[0]); g.addColorStop(1, P.bg[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const x = ((i * 157 - this.cam.x * 0.12 + t * 3) % (W + 160) + W + 160) % (W + 160) - 80, y = 60 + ((i * 97 - this.cam.y * 0.12) % H + H) % H;
      c.fillStyle = 'rgba(120,110,140,.25)'; c.beginPath(); c.ellipse(x, y, 16 + i * 4, 6, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(160,190,140,.3)'; c.beginPath(); c.ellipse(x, y - 4, 14 + i * 4, 4, 0, 0, 7); c.fill();
    }
    if (t % 70 < 26) {
      const k = (t % 70) / 26, x = -120 + k * (W + 240), y = 120 + Math.sin(k * 6) * 10;
      c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(x, y, 60, 18, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(x - 55, y); c.lineTo(x - 85, y - 14); c.lineTo(x - 80, y + 10); c.fill();
    }
    for (let i = 0; i < 7; i++) {
      const x = ((i * 211 - this.cam.x * 0.3 + t * 6) % (W + 300) + W + 300) % (W + 300) - 150, y = ((i * 131 - this.cam.y * 0.3) % (H + 100) + H + 100) % (H + 100) - 50;
      c.globalAlpha = i % 2 ? 0.75 : 0.5;
      c.fillStyle = P.cloud;
      for (const [dx, dy, r] of [[0, 0, 40], [34, 6, 30], [-30, 8, 28], [10, -12, 26]]) { c.beginPath(); c.ellipse(x + dx, y + dy, r, r * 0.55, 0, 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  drawLight(c, cx, cy) {
    const t = this.t, w = this.weather, realm = this.Rm.name, sx = (x) => (x - cx) * Z, sy = (y) => (y - cy) * Z;
    const glow = (x, y, r, col, a) => { const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col.replace('A', a)); rg.addColorStop(1, col.replace('A', 0)); c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2); };
    if (realm === 'cave') {
      // darkness, with the lantern, glowshrooms, crystals and shafts of daylight cut out of it
      this.dark ||= Object.assign(document.createElement('canvas'), { width: W, height: H });
      const d = this.dark.getContext('2d');
      d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H); d.fillStyle = 'rgba(8,6,16,.84)'; d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a = 1) => { const rg = d.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(0,0,0,${a})`); rg.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = rg; d.fillRect(x - r, y - r, r * 2, r * 2); };
      hole(sx(this.hero.x), sy(this.hero.y - 10), 155 + Math.sin(t * 7) * 3);
      const lights = [];
      for (const p of this.Rm.plants) if (PLANTS[p.k].glow && stageOf(p) >= 2) lights.push([p.x * T + 8, p.y * T + 6, 40, '#8ff0d8']);
      for (const dc of this.Rm.decor) if (dc.t === 'crystal') lights.push([dc.x * T + 8, dc.y * T + 6, 46, dc.c]);
      for (const p of this.Rm.portals) lights.push([p.x * T + 8, p.y * T + 8, 80, '#fff0c8']);
      for (const r of this.Rm.ruins) if (r.found) lights.push([r.x * T + r.w * 8, r.y * T + r.h * 8, r.t === 'crystalheart' ? 140 : 70, r.t === 'crystalheart' ? '#9ff0f0' : '#b8c8ff']);
      for (const [x, y, r] of lights) { const X = sx(x), Y = sy(y); if (X > -r && Y > -r && X < W + r && Y < H + r) hole(X, Y, r * (1 + Math.sin(t * 2 + x) * 0.05), 0.85); }
      c.drawImage(this.dark, 0, 0);
      c.globalCompositeOperation = 'lighter';
      for (const [x, y, r, col] of lights) { const X = sx(x), Y = sy(y); if (X > -r && Y > -r && X < W + r && Y < H + r) glow(X, Y, r * 0.5, `rgba(${parseInt(col.slice(1, 3), 16)},${parseInt(col.slice(3, 5), 16)},${parseInt(col.slice(5, 7), 16)},A)`, 0.25); }
      for (const p of this.amb) { const a = 0.25 + Math.sin(p.p * 2) * 0.2; c.fillStyle = `rgba(200,230,255,${a})`; c.fillRect(p.x, p.y, 1, 1); }
      for (const a of this.Rm.animals) if (a.k === 'glowworm') glow(sx(a.x), sy(a.y - 12), 10, 'rgba(210,255,150,A)', 0.6);
      c.globalCompositeOperation = 'source-over';
      return;
    }
    if (this.mode === 'morning') {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, 'rgba(255,200,220,.16)'); g.addColorStop(0.5, 'rgba(255,240,220,0)'); g.addColorStop(1, 'rgba(190,220,255,.12)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) { const y = ((i * 151 + t * 5) % (H + 80)) - 40; c.fillStyle = 'rgba(255,255,255,.06)'; c.beginPath(); c.ellipse(W / 2 + Math.sin(t * 0.2 + i) * 80, y, 220, 14, 0, 0, 7); c.fill(); }
      for (const [i, p] of this.amb.entries()) { if (i % 2) continue; c.fillStyle = p.s > 1 ? '#ffc4d8' : '#fff4f8'; c.globalAlpha = 0.9; c.fillRect(p.x, p.y, 2, 2); }
      c.globalAlpha = 1;
    } else if (this.mode === 'evening') {
      c.globalCompositeOperation = 'multiply';
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#ffc7a0'); g.addColorStop(0.5, '#efa9c6'); g.addColorStop(1, '#8f88d8');
      c.globalAlpha = realm === 'sky' ? 0.6 : 0.8; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      c.globalCompositeOperation = 'overlay';
      const tint = c.createLinearGradient(0, 0, 0, H);
      tint.addColorStop(0, 'rgba(255,140,150,.22)'); tint.addColorStop(1, 'rgba(90,70,190,.22)');
      c.fillStyle = tint; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'screen';
      const sun = c.createRadialGradient(W * 0.8, -20, 10, W * 0.8, -20, 300);
      sun.addColorStop(0, 'rgba(255,160,110,.32)'); sun.addColorStop(1, 'rgba(255,160,110,0)');
      c.fillStyle = sun; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      for (const p of this.Rm.plants) { const Pp = PLANTS[p.k]; if (!Pp.glow || stageOf(p) < 2) continue; const x = sx(p.x * T + 8), y = sy(p.y * T + 14 - (Pp.type === 'tree' ? 22 : 8)); if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue; glow(x, y, Pp.type === 'tree' ? 30 : 14, 'rgba(255,230,160,A)', 0.35 + Math.sin(t * 2 + p.x) * 0.08); }
      for (const r of this.Rm.ruins) { if (!r.found || !['shrine', 'obelisk', 'glyphs', 'fountain', 'well', 'cloudstair', 'starharp', 'windtemple'].includes(r.t)) continue; glow(sx(r.x * T + r.w * 8), sy(r.y * T + r.h * 8), 40, r.t === 'shrine' ? 'rgba(255,210,120,A)' : 'rgba(150,210,255,A)', 0.3 + Math.sin(t * 1.3 + r.x) * 0.08); }
      for (const p of this.Rm.portals) if (p.kind === 'mouth') glow(sx(p.x * T + 8), sy(p.y * T + 10), 22, 'rgba(255,200,140,A)', 0.18);
      glow(sx(this.hero.x), sy(this.hero.y - 12), 36, 'rgba(255,220,150,A)', 0.25);
      for (const p of this.amb) { const a = 0.4 + Math.sin(p.p * 3) * 0.4; if (a < 0.1) continue; glow(p.x, p.y, 6, 'rgba(220,255,140,A)', a); c.fillStyle = `rgba(240,255,190,${a})`; c.fillRect(p.x, p.y, 1.5, 1.5); }
      c.globalCompositeOperation = 'source-over';
    } else {
      if (realm === 'surface') { c.fillStyle = 'rgba(30,40,60,.07)'; for (let i = 0; i < 3; i++) { const x = ((i * 190 + t * 12) % (W + 300)) - 150; c.beginPath(); c.ellipse(x, 80 + i * 130, 120, 50, 0.2, 0, 7); c.fill(); } }
      if (w.kind === 'rain') { c.fillStyle = `rgba(40,60,90,${Math.min(0.18, w.t * 0.04)})`; c.fillRect(0, 0, W, H); }
      c.strokeStyle = 'rgba(210,230,255,.7)'; c.lineWidth = 1;
      c.beginPath(); for (const r of w.rain) { c.moveTo(r.x, r.y); c.lineTo(r.x - 3, r.y + 7); } c.stroke();
      if (w.kind === 'rainbow') {
        const a = Math.min(1, w.t / 2, (w.until - w.t) / 2) * 0.35;
        ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'].forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = a; c.lineWidth = 5; c.beginPath(); c.arc(W * 0.7, H * 0.95, 300 - i * 5, Math.PI * 1.1, Math.PI * 1.75); c.stroke(); });
        c.globalAlpha = 1;
      }
      if (w.kind === 'sun') { const g = c.createRadialGradient(W * 0.85, 0, 10, W * 0.85, 0, 320); g.addColorStop(0, `rgba(255,240,180,${Math.min(0.3, w.t * 0.1)})`); g.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      if (w.kind === 'gust') for (const p of this.amb) { c.fillStyle = realm === 'sky' ? '#ffffff' : '#9ccf7a'; c.fillRect(p.x, p.y, 3, 2); }
    }
  }
  drawUI(c) {
    const g = Wd.G, Rm = this.Rm, dark = this.mode === 'evening' || Rm.name === 'cave';
    const bg = dark ? 'rgba(28,20,32,.5)' : 'rgba(255,255,255,.5)', ink = dark ? 'rgba(243,230,212,.85)' : 'rgba(60,70,60,.7)';
    // a small map of what you have explored, around you
    const mm = Wd.minimap(Rm), S = 56, mx = W - S - 10, my = 10, half = S / 2, hx = Math.floor(this.hero.x / T), hy = Math.floor(this.hero.y / T);
    const sx0 = Math.max(0, Math.min(Rm.w - S, hx - half)), sy0 = Math.max(0, Math.min(Rm.h - S, hy - half));
    c.fillStyle = bg; roundRect(c, mx - 3, my - 3, S + 6, S + 6, 9); c.fill();
    c.save(); roundRect(c, mx, my, S, S, 6); c.clip(); c.globalAlpha = 0.85; c.drawImage(mm.cv, sx0, sy0, S, S, mx, my, S, S); c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(mx + hx - sx0 + 0.5, my + hy - sy0 + 0.5, 1.8 + Math.sin(this.t * 3) * 0.4, 0, 7); c.fill();
    this.ui = { map: { x: mx - 3, y: my - 3, w: S + 6, h: S + 6 } };
    // round buttons with no words: the seed you will plant (its ring fills with how many you have),
    // your food (an apple, the same kind of ring), and a compass that points to something still hidden
    const by = H - 30, R0 = 19;
    const disc = (x) => { c.fillStyle = bg; c.beginPath(); c.arc(x, by, R0, 0, 7); c.fill(); };
    const ring = (x, f, col) => { c.strokeStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, by, R0 - 2, 0, 7); c.stroke(); if (f > 0) { c.strokeStyle = col; c.beginPath(); c.arc(x, by, R0 - 2, -Math.PI / 2, -Math.PI / 2 + Math.min(1, f) * Math.PI * 2); c.stroke(); } };
    const k = g.inv.pick, n = g.inv.seeds[k] || 0;
    disc(30);
    if (PLANTS[k]) { const s = Wd.plantSprite(k, 3, true), sc = Math.min(1.4, 24 / s.h); c.save(); c.translate(30, by + 11); c.scale(sc, sc); c.globalAlpha = n ? 1 : 0.35; c.drawImage(s.cv, -s.w / 2, -s.h); c.restore(); }
    ring(30, n / 12, '#8fd08a');
    disc(76);
    c.fillStyle = g.inv.food ? '#e2453f' : 'rgba(226,69,63,.35)'; c.beginPath(); c.arc(76, by + 1, 6.5, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(73, by - 3, 2, 2); c.fillStyle = '#5f9a4e'; c.fillRect(76, by - 9, 2, 4); c.fillRect(77, by - 8, 3, 1);
    ring(76, g.inv.food / 12, '#ef7a6a');
    const cxp = W - 30, left = Rm.ruins.filter((u) => !u.found), hx1 = this.hero.x / T, hy1 = this.hero.y / T;
    disc(cxp);
    c.strokeStyle = ink; c.lineWidth = 1; c.beginPath(); c.arc(cxp, by, R0 - 6, 0, 7); c.stroke();
    if (left.length) {
      const u = left.sort((p, q) => Math.hypot(p.x - hx1, p.y - hy1) - Math.hypot(q.x - hx1, q.y - hy1))[0], a = Math.atan2(u.y + u.h / 2 - hy1, u.x + u.w / 2 - hx1) + Math.sin(this.t * 1.5) * 0.04;
      c.save(); c.translate(cxp, by); c.rotate(a);
      c.fillStyle = '#ffd66a'; c.beginPath(); c.moveTo(11, 0); c.lineTo(-3, -4); c.lineTo(-3, 4); c.fill();
      c.fillStyle = ink; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-3, -3); c.lineTo(-3, 3); c.fill(); c.restore();
    } else { c.fillStyle = '#ffd66a'; for (let i = 0; i < 4; i++) { c.save(); c.translate(cxp, by); c.rotate(i * Math.PI / 2 + this.t * 0.3); c.beginPath(); c.moveTo(0, -9); c.lineTo(2, 0); c.lineTo(-2, 0); c.fill(); c.restore(); } }
    Object.assign(this.ui, { seed: { x: 30 - R0, y: by - R0, w: R0 * 2, h: R0 * 2 }, ruins: { x: cxp - R0, y: by - R0, w: R0 * 2, h: R0 * 2 } });
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
