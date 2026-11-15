// The dream garden's living layer, added to the Garden game (install): what a tap does to houses,
// lamps, chests, wells, signs and crystals; pictogram bubbles in place of any words; sky whales that
// swim among the islands and sing; the gentle giant gardeners, who leave flowers and young forest
// where they step; leaves, petals, dust, spores and embers blowing through the world; the wisps
// that follow you for each treasure found; and the lights (lamps, windows, neon, glowing things).
// Everything is in the world, nothing is laid over the picture, and all of it is cheap: small cached
// sprites, a few dozen particles, lights as ready-made glow sprites.
import { Actor } from '../crystal/sprites.js';
import * as Wd from './garden-world.js';
import * as Art from './garden-art.js';
import { glowSprite, hash2, mk, tone } from './garden-kit.js';

const { T, PLANTS, ANIMALS, ix, inside, GRASS, FOREST, FLOWERS, WATER, PATH, SAND, STREET, ROCK, VOID } = Wd;
const WISP = ['#fff6c8', '#9fd8ff', '#ffb8e8', '#bff7ea', '#c8a8ff', '#ffd98a'];
const RARE = ['moonflower', 'crystallily', 'lanterntree', 'spirittree', 'wisteria', 'jacaranda', 'ginkgo', 'crystaltree', 'skyorchid', 'cherry', 'maple', 'redwood'];
// what blows through each kind of country: [kind, colours, how many]
const MOTES = [
  ['petal', ['#ffffff', '#ffd6e4', '#fff3a8'], 16], ['leaf', ['#8cc46a', '#5a9a4e', '#c8d870'], 16], ['petal', ['#ff9ac0', '#ffffff', '#ffd23f', '#c08aff'], 26], ['spore', ['#d8f0c0', '#f0f8d8'], 14], ['petal', ['#d880e8', '#f0b0f8'], 16],
  ['leaf', ['#e07a2a', '#c0502a', '#e8b030', '#d8692e'], 30], ['dust', ['#e8cc98', '#d8b878'], 22], ['spore', ['#bff7ea', '#d8fff0'], 18], ['spore', ['#ffffff', '#cfe8ff'], 12], ['spore', ['#8ff0d8', '#c8a8ff', '#ffb8e8'], 26]
];
const REALM_MOTES = { canyon: ['dust', ['#e0a070', '#c98050'], 20], mountain: ['spore', ['#ffffff'], 8], gorge: ['spore', ['#8af8e8', '#c8a8ff'], 24], cave: ['spore', ['#b8b0c8'], 8], deep: ['spore', ['#9ff0f0', '#e0a8ff'], 12], abyss: ['ember', ['#ff8a3a', '#ffd24a', '#ff5a2a'], 30],
  under: ['spore', ['#5af0ff', '#ff5ad8'], 16], sky: ['petal', ['#ffffff', '#e8dcff'], 12], high: ['petal', ['#ffd6e4', '#ffffff', '#fff3a8'], 20], stars: ['star', ['#fff6c8', '#9fd8ff', '#ffffff'], 30], canopy: ['leaf', ['#7fb86a', '#cfe8a0'], 22], roofs: ['spore', ['#5af0ff', '#ff5ad8', '#ffd24a'], 10] };
let bubble = null;
const bubbleSprite = () => bubble || (bubble = (() => { const [cv, c] = mk(15, 17); c.fillStyle = 'rgba(24,20,34,.9)'; c.fillRect(1, 0, 13, 14); c.fillRect(0, 1, 15, 12); c.fillRect(6, 14, 3, 2); c.fillRect(7, 16, 1, 1); c.fillStyle = '#fbf6ea'; c.fillRect(2, 1, 11, 12); c.fillRect(1, 2, 13, 10); c.fillRect(7, 13, 1, 2); return cv; })());
const auroraSprite = (() => { let cv = null; return () => cv || (cv = (() => { const [a, c] = mk(48, 160), g = c.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, 'rgba(120,255,190,0)'); g.addColorStop(0.35, 'rgba(120,255,190,.5)'); g.addColorStop(0.7, 'rgba(160,140,255,.35)'); g.addColorStop(1, 'rgba(160,140,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 48, 160); const h = c.createLinearGradient(0, 0, 48, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = h; c.fillRect(0, 0, 48, 160); return a; })()); })();

export function install(Garden, K) {
  const { VW, VH, GAIT } = K;
  // is it dark where you are? (dusk, the always-night realms, underground, deep in the city, the gorge)
  Object.defineProperty(Garden.prototype, 'dark', { get() { return this.night || this.mode === 'evening' || this.Rm.kind === 'cave' || this.cityK > 0.35 || this.Rm.name === 'gorge'; } });
  Object.assign(Garden.prototype, {
    // ------------------------------------------------ set up on entering a realm
    dreamInit() {
      const Rm = this.Rm, R = Math.random;
      this.motes = []; this.icons = []; this.lit = new Map(); this.trail = []; this.fade2 = new WeakMap(); this.cityK = 0; this.moteT = 0; this.ctxT = 0;
      this.night = !!Wd.NIGHT[Rm.name];
      // sky whales: each on its own slow round, some swimming below the islands, some above
      this.whales = [];
      const nW = { sky: 3, high: 5, stars: 4 }[Rm.name] || 0, W0 = Rm.w * T;
      for (let k = 0; k < nW; k++) { const h = (q) => hash2(k * 7 + q, Rm.seed & 1023, 3); this.whales.push({ cx: W0 * (0.25 + h(1) * 0.5), cy: W0 * (0.25 + h(2) * 0.5), A: W0 * (0.14 + h(3) * 0.2), B: W0 * (0.1 + h(4) * 0.18), w: (0.012 + h(5) * 0.012) * (h(6) < 0.5 ? 1 : -1), ph: h(7) * 6.283, v: Rm.name === 'stars' ? 3 : k % 3, layer: k % 3 === 1 ? 0 : 1, calf: k === nW - 1 && nW > 3, x: 0, y: 0, dir: 1, sang: -99, ox: 0, oy: 0 }); }
      for (const g of (Rm.name === 'surface' && Wd.G.giants) || []) { g.f ||= 0; g.ft = 0; g.wait = R() * 2; g.tx = undefined; g.follow = 0; }
    },
    unstick() {
      const h = this.hero, Rm = this.Rm, tx = Math.floor(h.x / T), ty = Math.floor((h.y - 2) / T);
      if (this.walkable(tx, ty)) return;
      for (let r = 1; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !this.walkable(tx + dx, ty + dy) || Rm.ground[ix(Rm, tx + dx, ty + dy)] === WATER) continue;
        h.x = (tx + dx) * T + 8; h.y = (ty + dy) * T + 12; this.cam.x = h.x; this.cam.y = h.y - 16; return;
      }
    },
    lightMode() { return this.night || this.Rm.name === 'gorge' ? 'evening' : this.mode; },
    icon(x, y, k, delay = 0) { this.icons.push({ x, y, k, t: -delay, life: 2.4 }); if (this.icons.length > 14) this.icons.shift(); },
    // what stands in the way: houses, towers, wells and stalls, lamps, chests
    decorBlock(b, occ) {
      const Rm = this.Rm, set = (x, y) => { if (inside(Rm, x, y)) { b[ix(Rm, x, y)] = 1; occ.add(ix(Rm, x, y)); } };
      for (const d of Rm.decor) {
        if (d.t === 'house') { for (let y = d.y - 1; y <= d.y; y++) for (let x = d.x - 1; x <= d.x + 1; x++) set(x, y); occ.add(ix(Rm, d.x, d.y + 1)); }
        else if (d.t === 'tower') { for (let y = d.y - d.d + 1; y <= d.y; y++) for (let x = d.x; x < d.x + d.w; x++) set(x, y); }
        else if (d.t === 'prop' || d.t === 'chest' || d.t === 'lamp' || d.t === 'neon') set(d.x, d.y);
      }
    },
    // the sprite a piece of decor is drawn with, and where its foot stands (world pixels)
    decorArt(d) {
      const t = this.t, lit = this.isLit(d) ? 1 : 0;
      if (d.t === 'house') return Art.houseSprite(d.s, d.v, lit);
      if (d.t === 'tower') return Art.towerSprite(d.v, d.w, d.h);
      if (d.t === 'prop') return Art.propSprite(d.k, d.k === 'windmill' ? Math.floor(t * (this.lit.get(d) > t ? 9 : 2.2 * (0.4 + this.weather.wind))) % 4 : d.v || 0, lit);
      if (d.t === 'lamp') return Art.propSprite(d.k, d.v || 0, lit);
      if (d.t === 'gate') return Art.propSprite('gate');
      if (d.t === 'chest') return Art.propSprite(d.k, d.o ? 1 : 0);
      if (d.t === 'neon') return Art.neonSprite(d.v, hash2(d.x, Math.floor(t * 7), d.y) < 0.06 ? 1 : 0);
      if (d.t === 'glint') return Art.propSprite('glint', Math.floor(t * 3 + d.x) % 2);
      return null;
    },
    isLit(d) { return this.lit.get(d) > this.t || (this.dark && d.t !== 'chest'); },
    // ------------------------------------------------ taps
    // a whale, a giant or a piece of decor under the finger: true if the tap was theirs
    tapDream(wx, wy) {
      const Rm = this.Rm, h = this.hero;
      for (const w of this.whales) if (Math.abs(wx - w.x) < 44 && Math.abs(wy - (w.y - 30)) < 22) { this.sing(w); return true; }
      for (const g of (Rm.name === 'surface' && Wd.G.giants) || []) if (Math.abs(wx - g.x) < 22 && wy < g.y + 4 && wy > g.y - 78) { if (Math.hypot(g.x - h.x, g.y - h.y) < 7 * T) this.greetGiant(g); return true; }
      const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
      let best = null, bd = 1e9;
      for (const d of Wd.decorIn(Rm, tx - 4, ty - 1, tx + 4, ty + 10)) {
        const s = this.decorArt(d); if (!s && d.t !== 'crystal' && d.t !== 'holo' && d.t !== 'ring') continue;
        const w = d.t === 'tower' ? d.w * T : s ? s.w : 16, hgt = s ? s.h : 18, fx = d.t === 'tower' ? d.x * T + w / 2 : d.x * T + 8, fy = (d.y + 1) * T + (d.t === 'holo' ? -30 : 0);
        if (Math.abs(wx - fx) > w / 2 + 3 || wy > fy + 4 || wy < fy - hgt - 3) continue;
        const dist = Math.hypot(wx - fx, wy - (fy - hgt / 2)) - (d.t === 'tower' || d.t === 'house' ? 0 : 30);
        if (dist < bd) { bd = dist; best = d; }
      }
      if (!best) return false;
      const far = best.t === 'tower' || best.t === 'house' || best.t === 'holo' ? 5 : 3, bx = best.t === 'tower' ? best.x + (best.w >> 1) : best.x;
      this.reach(bx, best.y + (best.t === 'tower' || best.t === 'house' ? 1 : 0), { kind: 'decor', d: best }, far);
      return true;
    },
    sparkle(x, y, col, n = 10) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 14 + Math.random() * 34; this.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - 16, t: -Math.random() * 0.15, life: 0.7 + Math.random() * 0.5, c: col }); } },
    chime(x, y, col = '#fff6c8', n = 2) { for (let i = 0; i < n; i++) this.fx.push({ kind: 'song', x, y, t: -i * 0.3, life: 1.3, c: col }); },
    // touching a thing in the world: each answers in its own way, with light and little signs
    touch(d) {
      const Rm = this.Rm, g = Wd.G, h = this.hero, a = h.actor, x = d.x * T + 8, y = d.y * T + 8, t = this.t, R = Math.random;
      a.face(x < h.x ? 'W' : 'E');
      if (d.t === 'chest') {
        if (d.o) { this.sparkle(x, y - 4, '#fff6c8', 4); return; }
        d.o = 1; a.emote('cheer', 1.4); h.busy = 1;
        g.inv.gems = (g.inv.gems || 0) + 1; g.inv.wisps = Math.min(12, (g.inv.wisps || 0) + 1);
        const cave = Rm.kind === 'cave', k = cave ? 'glowshroom' : RARE[(R() * RARE.length) | 0];
        g.inv.seeds[k] = (g.inv.seeds[k] || 0) + 2; g.inv.food += 2;
        this.sparkle(x, y - 6, '#fff6c8', 22); this.sparkle(x, y - 6, WISP[(g.inv.wisps - 1) % WISP.length], 12); this.chime(x, y - 4, '#fff6c8', 3);
        this.icon(x, y - 16, 'gem'); this.icon(x, y - 16, 'seed', 0.7); this.icon(x, y - 16, 'star', 1.4);
        Wd.saveGarden(true);
      } else if (d.t === 'glint') {
        Rm.decor = Rm.decor.filter((o) => o !== d); g.inv.gems = (g.inv.gems || 0) + 1;
        this.sparkle(x, y, '#fff8d0', 12); this.icon(x, y - 10, 'gem'); a.emote('surprise', 0.7); h.busy = 0.5;
        if (R() < 0.5 && Rm.kind !== 'cave' && !Rm.plants.some((p) => p.x === d.x && p.y === d.y) && [GRASS, FLOWERS, FOREST].includes(Rm.ground[ix(Rm, d.x, d.y)])) Rm.plants.push({ k: ['moonflower', 'crystallily', 'cosmos', 'bluebell'][(R() * 4) | 0], x: d.x, y: d.y, g: 0.5, w: Wd.now(), fr: 0, sd: 0, q: 1 });
        this.computeBlock(); Wd.saveGarden(true);
      } else if (d.t === 'house') {
        this.lit.set(d, t + 30); this.chime(x, y - 6, '#ffd98a', 1);
        const n = (this.npcs || []).find((q) => q.home === d && q.inside);
        if (n) { n.inside = false; n.x = d.x * T + 8; n.y = (d.y + 1) * T + 12; n.busy = 1.2; n.actor.face(h.x < n.x ? 'W' : 'E'); n.actor.emote('wave', 1.2); n.wait = 3; this.icon(n.x, n.y - 30, ['heart', 'flower', 'sun', 'note'][(R() * 4) | 0], 0.4); }
        else this.icon(x, y - 34, ['heart', 'note', 'moon'][(R() * 3) | 0]);
        a.emote('wave', 0.8); h.busy = 0.6;
      } else if (d.t === 'lamp') { this.lit.set(d, t + 90); this.sparkle(x, y - 14, d.k === 'neonlamp' ? Art.NEON[(d.v || 0) % 3] : d.k === 'shroomlamp' ? '#8ff0d8' : '#ffd98a', 8); this.chime(x, y - 12, '#ffd98a', 1); a.emote('nod', 0.6); h.busy = 0.4; }
      else if (d.t === 'prop' && d.k === 'well') { for (let i = 0; i < 6; i++) this.fx.push({ kind: 'drop', x: x + (R() - 0.5) * 8, y: y - 14, vy: 26 + R() * 20, t: -i * 0.05, life: 0.5 }); this.chime(x, y, '#9fd8ff', 2); this.icon(x, y - 22, 'star', 0.5); a.emote('think', 0.9); h.busy = 0.7; }
      else if (d.t === 'prop' && d.k === 'stall') { g.inv.food++; this.icon(x, y - 22, ['fish', 'flower', 'seed'][(R() * 3) | 0]); this.sparkle(x, y - 8, '#ffd23f', 6); a.emote('love', 0.7); h.busy = 0.5; }
      else if (d.t === 'prop' && d.k === 'windmill') { this.lit.set(d, t + 7); for (let i = 0; i < 14; i++) this.addMote('petal', x + (R() - 0.5) * 30, y - 20, ['#ffffff', '#ffd6e4'], 30 + R() * 20); a.emote('cheer', 0.8); h.busy = 0.5; }
      else if (d.t === 'prop') { for (let i = 0; i < 16; i++) this.addMote('petal', x + (R() - 0.5) * 30, y, ['#ffd6e4', '#ffffff', '#ff9ac0'], 22 + R() * 20); this.icon(x, y - 46, 'heart'); this.chime(x, y - 20, '#ffd6e4', 2); a.emote('love', 0.9); h.busy = 0.6; }
      else if (d.t === 'gate') { this.chime(x, y - 20, '#ffb08a', 2); for (let i = 0; i < 10; i++) this.addMote('petal', x + (R() - 0.5) * 36, y, ['#ffd6e4', '#ffffff'], 30 + R() * 14); a.emote('nod', 0.8); h.busy = 0.5; }
      else if (d.t === 'neon') { d.v = ((d.v || 0) + 1 + ((R() * 3) | 0)) % 8; this.sparkle(x, y - 18, Art.NEON[d.v % 6], 8); this.lit.set(d, t + 2); a.emote('nod', 0.5); h.busy = 0.3; }
      else if (d.t === 'tower') { this.lit.set(d, t + 3); this.chime((d.x + d.w / 2) * T, y - 20, Art.NEON[d.v % 6], 3); this.icon((d.x + d.w / 2) * T, y - d.h - 6, ['note', 'heart', 'fish', 'moon'][d.v % 4]); a.emote('surprise', 0.6); h.busy = 0.4; }
      else if (d.t === 'crystal') { this.chime(x, y - 4, d.c, 2); this.sparkle(x, y - 6, d.c, 7); if (R() < 0.15) this.icon(x, y - 14, 'gem'); a.emote('think', 0.5); h.busy = 0.3; }
      else if (d.t === 'holo') { d.v = ((d.v || 0) + 1) % 4; this.sparkle(x, y - 40, '#5af0ff', 18); this.chime(x, y - 40, '#5af0ff', 3); a.emote('surprise', 0.8); h.busy = 0.5; }
      else if (d.t === 'ring') {
        for (let q = 0; q < 9; q++) { const an = (q / 9) * 6.283; this.fx.push({ kind: 'glow', x: x + Math.cos(an) * 30, y: y + Math.sin(an) * 30, t: -q * 0.12, life: 0.9 }); }
        this.chime(x, y, '#8ff0d8', 3); this.icon(x, y - 14, 'spiral');
        if (!d.o) { d.o = 1; g.inv.wisps = Math.min(12, (g.inv.wisps || 0) + 1); this.sparkle(x, y, '#8ff0d8', 20); a.emote('cheer', 1.2); Wd.saveGarden(true); }
        h.busy = 0.8;
      }
    },
    // a strange creature answers a touch with its own sign and a flourish
    reactAnimal(o) {
      const A = ANIMALS[o.k], R = Math.random;
      if (!A.strange) return;
      this.icon(o.x, o.y - 16, A.icon || 'heart', 0.2);
      if (A.glow) { this.sparkle(o.x, o.y - 8, A.glow, 12); this.chime(o.x, o.y - 6, A.glow, 2); }
      if (o.k === 'kirin' || o.k === 'stag' || o.k === 'tortoise' || o.k === 'snail') {
        // flowers open where it stands
        const Rm = this.Rm, tx = Math.floor(o.x / T), ty = Math.floor(o.y / T);
        for (let q = 0; q < 5; q++) { const x = tx + Math.round((R() - 0.5) * 4), y = ty + Math.round((R() - 0.5) * 4); if (this.open(x, y) && [GRASS, FLOWERS, FOREST].includes(Rm.ground[ix(Rm, x, y)]) && !this.occ.has(ix(Rm, x, y)) && !Rm.plants.some((p) => p.x === x && p.y === y)) Rm.plants.push({ k: o.k === 'stag' ? 'moonflower' : ['daisy', 'cosmos', 'bluebell', 'tulip'][(R() * 4) | 0], x, y, g: 0.45, w: Wd.now(), fr: 0, sd: 0, n: 1, q: 1 }); }
      }
      if (o.k === 'kodama') for (const q of this.Rm.animals) if (q.k === 'kodama' && Math.hypot(q.x - o.x, q.y - o.y) < 80) this.icon(q.x, q.y - 14, 'note', R() * 0.8);
    },
    // ------------------------------------------------ sky whales
    sing(w) {
      const t = this.t;
      w.sang = t; w.near = t + 14;
      for (let i = 0; i < 4; i++) this.fx.push({ kind: 'song', x: w.x, y: w.y - 30, t: -i * 0.35, life: 2.2, c: ['#bfe6ff', '#e0c8ff', '#ffffff'][i % 3], big: 1 });
      for (let i = 0; i < 3; i++) this.icon(w.x + 26 - i * 14, w.y - 54, 'note', i * 0.35);
      // the others answer, each in its own time
      this.whales.forEach((o, k) => { if (o !== w) this.later(1.2 + k * 0.7, () => { o.sang = this.t; for (let i = 0; i < 2; i++) this.fx.push({ kind: 'song', x: o.x, y: o.y - 30, t: -i * 0.35, life: 2, c: '#e0c8ff', big: 1 }); }); });
      this.hero.actor.emote('cheer', 1.2);
    },
    stepWhales(dt) {
      const now = Date.now() / 1000, h = this.hero;
      for (const w of this.whales) {
        const th = w.ph + w.w * now, px = w.x;
        // one that has been sung to comes over to look
        const want = w.near > this.t ? 1 : 0, bx = w.cx + Math.cos(th) * w.A, by = w.cy + Math.sin(th) * w.B;
        w.ox += ((want ? h.x - bx : 0) - w.ox) * Math.min(1, dt * 0.35); w.oy += ((want ? h.y - 20 - by : 0) - w.oy) * Math.min(1, dt * 0.35);
        w.x = bx + w.ox; w.y = by + w.oy;
        if (Math.abs(w.x - px) > 0.01 && px) w.dir = w.x > px ? 1 : -1;
      }
    },
    drawWhale(b, w, cx, cy) {
      const t = this.t, sc = w.layer ? 1 : 0.7, X = Math.round(w.x - cx), Y = Math.round(w.y - cy - 30 + Math.sin(t * 0.7 + w.ph) * 5);
      if (X < -70 || X > VW + 70 || Y < -40 || Y > VH + 60) return;
      const s = Art.whaleSprite(w.v, Math.sin(t * 1.6 + w.ph) > 0 ? 1 : 0);
      if (w.layer) { b.globalAlpha = 0.16; b.fillStyle = '#101830'; b.beginPath(); b.ellipse(X, Y + 58, 36, 9, 0, 0, 7); b.fill(); }
      b.globalAlpha = w.layer ? 1 : 0.5;
      b.save(); b.translate(X, Y); b.scale(w.dir * sc, sc); b.drawImage(s.cv, -(s.w >> 1), -(s.h >> 1));
      if (w.calf) { b.scale(0.5, 0.5); b.drawImage(s.cv, -s.w * 1.4, s.h * 0.9 + Math.sin(t * 1.1) * 6); }
      b.restore(); b.globalAlpha = 1;
      if (t - w.sang < 2) { const g = glowSprite('#bfe6ff', 48); b.globalCompositeOperation = 'lighter'; b.globalAlpha = 0.5 * (1 - (t - w.sang) / 2); b.drawImage(g, X - 48, Y - 48); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; }
    },
    // ------------------------------------------------ the giant gardeners
    greetGiant(g) {
      const h = this.hero, Rm = this.Rm, R = Math.random, hx = Math.floor(h.x / T), hy = Math.floor(h.y / T);
      g.follow = this.t + 30; g.wait = 1.5;
      this.icon(g.x, g.y - 84, 'flower'); this.icon(g.x, g.y - 84, 'heart', 0.8); this.hearts(g.x, g.y - 70);
      h.actor.face(g.x < h.x ? 'W' : 'E'); h.actor.emote('cheer', 1.2); h.busy = 0.8;
      // a ring of flowers opens round you
      for (let q = 0; q < 10; q++) { const a = (q / 10) * 6.283, x = Math.round(hx + Math.cos(a) * 2.2), y = Math.round(hy + Math.sin(a) * 2.2); if (this.open(x, y) && [GRASS, FLOWERS, FOREST, SAND].includes(Rm.ground[ix(Rm, x, y)]) && !this.occ.has(ix(Rm, x, y)) && !Rm.plants.some((p) => p.x === x && p.y === y)) { Rm.plants.push({ k: ['daisy', 'tulip', 'poppy', 'cosmos', 'bluebell', 'lavender'][(R() * 6) | 0], x, y, g: 0.42, w: Wd.now(), fr: 0, sd: 0, n: 1, q: 1, by: 'g' }); this.puff(x * T + 8, y * T + 10, '#ffd6e4', 3); } }
    },
    stepGiants(dt) {
      const Rm = this.Rm, h = this.hero;
      if (Rm.name !== 'surface') return;
      const stand = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (!inside(Rm, tx, ty) || tx < 6 || ty < 6 || tx > Rm.w - 7 || ty > Rm.h - 7) return false; const g0 = Rm.ground[ix(Rm, tx, ty)]; return [GRASS, FLOWERS, FOREST, PATH, SAND].includes(g0) && !(Rm.city && tx > Rm.city.x0 - 6 && tx < Rm.city.x1 + 6 && ty > Rm.city.y0 - 6 && ty < Rm.city.y1 + 6) && !(Rm.villages || []).some((v) => Math.abs(v.x - tx) < 12 && Math.abs(v.y - ty) < 10); };
      for (const g of Wd.G.giants || []) {
        if (Math.abs(g.x - this.cam.x) > VW * 1.6 || Math.abs(g.y - this.cam.y) > VH * 1.6) continue;
        if (g.wait > 0) { g.wait -= dt; continue; }
        if (g.follow > this.t) { g.tx = h.x + (g.x < h.x ? -44 : 44); g.ty = h.y + 6; }
        else if (g.tx === undefined || Math.hypot(g.tx - g.x, g.ty - g.y) < 6) { let ok = false; for (let q = 0; q < 12 && !ok; q++) { const a = Math.random() * 6.283, d = (10 + Math.random() * 22) * T, x = g.x + Math.cos(a) * d, y = g.y + Math.sin(a) * d; if (stand(x, y)) { g.tx = x; g.ty = y; ok = true; } } g.wait = 1 + Math.random() * 3; if (!ok) g.tx = undefined; continue; }
        const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
        if (d < 6) { g.f = 0; continue; }
        const sp = g.follow > this.t ? 22 : 11, nx = g.x + (dx / d) * sp * dt, ny = g.y + (dy / d) * sp * dt;
        if (!stand(nx, ny)) { g.tx = undefined; continue; }
        g.x = nx; g.y = ny; g.dir = dx > 0 ? 1 : -1;
        if ((g.ft += dt) > 0.55) { g.ft = 0; g.f = (g.f + 1) % 4; if (g.f % 2 === 0) this.giantBloom(g); }
      }
    },
    // a giant's footfall: dust, petals, and flowers, ferns and young trees springing up round it
    giantBloom(g) {
      const Rm = this.Rm, R = Math.random, tx = Math.floor(g.x / T), ty = Math.floor(g.y / T), bio = Wd.biomeAt(Rm, tx, ty), B = Wd.BIOMES[bio];
      for (let k = 0; k < 6; k++) this.fx.push({ kind: 'leaf', x: g.x + (R() - 0.5) * 22, y: g.y, vx: (R() - 0.5) * 50, vy: -20 - R() * 30, t: 0, life: 0.8, c: ['#8cc46a', '#ffd6e4', '#ffffff', '#ffd23f'][k % 4] });
      this.fx.push({ kind: 'wake', x: g.x, y: g.y, t: 0, life: 0.6 });
      if (Math.abs(g.x - this.cam.x) < 60 && Math.abs(g.y - this.cam.y) < 70) this.shake = 0.18;
      const TREES = [['oak', 'apple', 'cherry', 'birch'], ['oak', 'pine', 'ginkgo', 'birch'], ['cherry', 'wisteria', 'jacaranda'], ['willow', 'mangrove'], ['pine', 'cypress'], ['maple', 'ginkgo', 'oak'], ['palm', 'acacia'], ['redwood', 'oak', 'willow'], ['snowpine'], ['bigshroom', 'crystaltree', 'spirittree']][bio] || ['oak'];
      const FL = B.snow ? ['moonflower', 'bluebell'] : bio === Wd.B_FUNGAL ? ['glowshroom', 'moonflower'] : ['daisy', 'tulip', 'poppy', 'cosmos', 'bluebell', 'lavender', 'sunflower'];
      if (Wd.plantsIn(Rm, tx - 3, ty - 3, tx + 3, ty + 3).length > 15) return;
      let tree = false;
      for (let q = 0; q < 4; q++) {
        const x = tx + Math.round((R() - 0.5) * 5), y = ty + Math.round((R() - 0.5) * 4) + 1, i = ix(Rm, x, y);
        if (!inside(Rm, x, y) || !this.open(x, y) || this.occ.has(i) || ![GRASS, FLOWERS, FOREST].includes(Rm.ground[i]) || Rm.plants.some((p) => p.x === x && p.y === y)) continue;
        const r = R(), near = Wd.plantsIn(Rm, x - 2, y - 2, x + 2, y + 2).some((p) => PLANTS[p.k].type === 'tree' || PLANTS[p.k].giant);
        const k = r < 0.26 && !near ? TREES[(R() * TREES.length) | 0] : r < 0.42 ? ['fern', 'rosebush', 'hydrangea', 'berrybush', 'heather'][(R() * 5) | 0] : FL[(R() * FL.length) | 0];
        const isTree = PLANTS[k].type === 'tree';
        Rm.plants.push({ k, x, y, g: isTree ? 0.14 : 0.42, w: Wd.now(), fr: 0, sd: 0, n: 1, q: 1, by: 'g' });
        this.puff(x * T + 8, y * T + 10, isTree ? '#7ab86a' : '#ffd6e4', 4);
        if (isTree && Rm.ground[i] !== FOREST) { Rm.ground[i] = FOREST; Wd.invalidate(Rm, x, y, x, y); tree = true; }
      }
      if (tree) this.computeBlock();
      // the oldest of what the giants grew makes room for the new
      const mine = Rm.plants.reduce((n, p) => n + (p.by === 'g' ? 1 : 0), 0);
      if (mine > 700) { let drop = 60; Rm.plants = Rm.plants.filter((p) => !(p.by === 'g' && PLANTS[p.k].type !== 'tree' && drop-- > 0)); }
    },
    // ------------------------------------------------ people: who lives where you are
    npcContext() {
      const Rm = this.Rm, hx = this.hero.x / T, hy = this.hero.y / T, c = Rm.city;
      if (Rm.name === 'under' || Rm.name === 'roofs' || (c && hx > c.x0 - 4 && hx < c.x1 + 4 && hy > c.y0 - 4 && hy < c.y1 + 4)) return 'city';
      const vi = (Rm.villages || []).findIndex((v) => Math.hypot(v.x - hx, v.y - hy) < 44);
      return vi >= 0 ? `v${vi}` : 'wild';
    },
    spawnDreamNPCs() {
      const Rm = this.Rm, key = (this.npcKey = this.npcContext()), R = Math.random, mk2 = (k, era, x, y, o) => ({ k, actor: new Actor(this.skin.crystal(k, era), GAIT), x, y, path: [], wait: 0.5 + R() * 3, busy: 0, vx: 0, vy: 0, sowT: 12 + R() * 25, greetT: 0, task: null, follow: 0, ...o });
      this.npcs = [];
      if (key === 'city') { for (let k = 0; k < 6; k++) { const at = this.npcSpot(3, 13); if (at) this.npcs.push(mk2(30 + k, 'Sci-fi', at[0] * T + 8, at[1] * T + 12, { citizen: 1 })); } return; }
      if (key[0] === 'v') {
        const v = Rm.villages[+key.slice(1)];
        v.houses.slice(0, 7).forEach((hs, k) => { const d = Rm.decor.find((o) => o.t === 'house' && o.x === hs.x && o.y === hs.y); if (d && this.walkable(hs.x, hs.y + 1)) this.npcs.push(mk2(1 + ((v.x + k * 3) % 18), 'Fantasy', hs.x * T + 8, (hs.y + 1) * T + 12, { home: d, vil: v, inside: this.mode === 'evening' && R() < 0.6 })); });
        if (this.walkable(v.x, v.y + 1)) this.npcs.push(mk2(20 + (v.x % 6), 'Fantasy', v.x * T + 8, (v.y + 1) * T + 12, { sage: 1, vil: v }));
        return;
      }
      for (let k = 0; k < 3; k++) { const at = this.npcSpot(5, 15); if (at) this.npcs.push(mk2(k === 2 ? 22 : k + 1, 'Fantasy', at[0] * T + 8, at[1] * T + 12, { sage: k === 2 ? 1 : 0 })); }
    },
    // ------------------------------------------------ what blows through the world
    addMote(kind, x, y, cols, z = 20) { if (this.motes.length < 90) this.motes.push({ kind, x, y, z, c: cols[(Math.random() * cols.length) | 0], ph: Math.random() * 6.283, t: 0, life: kind === 'dust' ? 1.6 + Math.random() : 5 + Math.random() * 4, fall: 5 + Math.random() * 7 }); },
    stepDream(dt) {
      const Rm = this.Rm, h = this.hero, t = this.t, R = Math.random;
      // how deep in the city you are (its own night falls round it)
      const c = Rm.city;
      if (c) { const hx = h.x / T, hy = h.y / T, d = Math.max(c.x0 - hx, hx - c.x1, c.y0 - hy, hy - c.y1, 0); this.cityK += (Math.max(0, 1 - d / 9) - this.cityK) * Math.min(1, dt * 2); }
      if ((this.ctxT += dt) > 2.5) { this.ctxT = 0; if (this.npcContext() !== this.npcKey && !this.npcs?.some((n) => n.follow > t)) this.spawnDreamNPCs(); }
      this.stepWhales(dt); this.stepGiants(dt);
      for (const ic of this.icons) ic.t += dt;
      this.icons = this.icons.filter((ic) => ic.t < ic.life);
      if (this.shake > 0) this.shake -= dt;
      // the wisps follow where you have been
      if ((this.trailT = (this.trailT || 0) + dt) > 0.07) { this.trailT = 0; this.trail.push([h.x, h.y]); if (this.trail.length > 90) this.trail.shift(); }
      // motes: kept topped up round the view, born upwind, carried by the wind
      const wind = Rm.kind === 'cave' ? 0.15 : this.weather.wind, sp = Rm.name === 'surface' ? (this.cityK > 0.5 ? ['spore', ['#5af0ff', '#ff5ad8'], 10] : MOTES[Wd.biomeAt(Rm, Math.floor(h.x / T), Math.floor(h.y / T))]) : REALM_MOTES[Rm.name] || MOTES[0];
      const want = Math.round(sp[2] * (this.q >= 1 ? 1 : 0.5) * (this.weather.kind === 'gust' ? 1.5 : 1));
      if (this.motes.length < want && (this.moteT -= dt) <= 0) {
        this.moteT = 0.06;
        const first = this.motes.length < want * 0.4 && t < 3, x = first || sp[0] === 'spore' || sp[0] === 'ember' || sp[0] === 'star' ? this.cam.x + (R() - 0.5) * (VW + 60) : this.cam.x - VW / 2 - 20 + R() * 30, y = this.cam.y + (R() - 0.5) * (VH + 80);
        this.addMote(sp[0], x, y, sp[1], sp[0] === 'dust' ? 1 + R() * 4 : sp[0] === 'leaf' || sp[0] === 'petal' ? 14 + R() * 36 : R() * 10);
      }
      for (const m of this.motes) {
        m.t += dt;
        if (m.rest) continue;
        const sway = Math.sin(m.t * 3 + m.ph);
        if (m.kind === 'leaf' || m.kind === 'petal') { m.x += (wind * 26 + 6 + sway * 9) * dt; m.y += Math.cos(m.t * 1.7 + m.ph) * 4 * dt; m.z -= m.fall * dt * (1 - wind * 0.3); if (m.z <= 0) { m.z = 0; m.rest = 1; m.life = m.t + 2.5; } }
        else if (m.kind === 'dust') { m.x += (wind * 60 + 22) * dt; m.y += sway * 3 * dt; }
        else if (m.kind === 'ember') { m.z += 16 * dt; m.x += sway * 7 * dt; }
        else { m.z += (m.kind === 'star' ? 1.5 : 4) * dt; m.x += (wind * 6 + sway * 5) * dt; m.y += Math.cos(m.t * 0.9 + m.ph) * 3 * dt; }
      }
      const x0 = this.cam.x - VW / 2 - 50, y0 = this.cam.y - VH / 2 - 60;
      this.motes = this.motes.filter((m) => m.t < m.life && m.x > x0 && m.x < x0 + VW + 100 && m.y > y0 && m.y < y0 + VH + 130);
      // smoke from the chimneys of lit houses
      if (R() < dt * 2.5) { const hs = Wd.decorIn(Rm, Math.floor(x0 / T), Math.floor(y0 / T), Math.floor((x0 + VW + 100) / T), Math.floor((y0 + VH + 130) / T)).filter((d) => d.t === 'house' && this.isLit(d) && d.s !== 'igloo' && d.s !== 'cloud'); if (hs.length) { const d = hs[(R() * hs.length) | 0]; this.fx.push({ kind: 'smoke', x: d.x * T + 8 + (d.v % 2 ? -10 : 12), y: (d.y + 1) * T - 40, vx: 4 + wind * 8, vy: -9, t: 0, life: 2.6 }); } }
    },
    // ------------------------------------------------ drawing
    // decor and giants near the view, into the back-to-front list
    dreamItems(items, vis) {
      const Rm = this.Rm, x0 = Math.floor((this.cam.x - VW / 2) / T) - 5, y0 = Math.floor((this.cam.y - VH / 2) / T) - 2, x1 = Math.ceil((this.cam.x + VW / 2) / T) + 2, y1 = Math.ceil((this.cam.y + VH / 2) / T) + 11;
      for (const d of Wd.decorIn(Rm, x0, y0, x1, y1)) { if (d.t === 'crystal' || d.t === 'lift' || d.t === 'island' || d.t === 'ring') continue; items.push([(d.y + 1) * T - (d.t === 'glint' ? 6 : 1), d.t === 'holo' ? 'holo' : 'decor', d]); }
      for (const g of (Rm.name === 'surface' && Wd.G.giants) || []) if (vis(g.x, g.y, 90)) items.push([g.y, 'giantg', g]);
    },
    drawDream(b, kind, o, cx, cy) {
      const h = this.hero, t = this.t;
      if (kind === 'giantg') {
        const s = Art.giantSprite(o.v, o.f || 0), X = Math.round(o.x - cx), Y = Math.round(o.y - cy);
        b.drawImage(Art.shadowSprite(44, 12), X - 22, Y - 6);
        b.save(); b.translate(X, Y + 2); if (o.dir < 0) b.scale(-1, 1); b.drawImage(s.cv, -(s.w >> 1), -s.h); b.restore();
        return;
      }
      if (kind === 'holo') {
        const s = Art.whaleSprite(o.v, Math.sin(t * 1.4) > 0 ? 1 : 0), X = Math.round(o.x * T + 8 - cx), Y = Math.round((o.y + 1) * T - cy - 46 + Math.sin(t * 0.8) * 4);
        b.globalCompositeOperation = 'lighter'; b.globalAlpha = 0.5 + Math.sin(t * 9) * 0.05; b.drawImage(s.cv, X - (s.w >> 1), Y - (s.h >> 1));
        b.globalAlpha = 0.12; b.fillStyle = '#5af0ff'; for (let q = 0; q < 5; q++) b.fillRect(X - 30 + q * 3, Y + 20 + q * 5, 60 - q * 6, 1);
        b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
        return;
      }
      const s = this.decorArt(o); if (!s) return;
      const tall = o.t === 'tower' || o.t === 'house' || (o.t === 'prop' && o.k === 'windmill'), fx = o.t === 'tower' ? o.x * T + (o.w * T) / 2 : o.x * T + 8, fy = (o.y + 1) * T + (o.t === 'house' ? 2 : o.t === 'glint' ? -4 : 1), X = Math.round(fx - cx - s.w / 2), Y = Math.round(fy - cy - s.h);
      if (o.t === 'house' || (o.t === 'prop' && o.k !== 'well')) b.drawImage(Art.shadowSprite(s.w - 8, 8), X + 4, Y + s.h - 6);
      if (tall) {
        // thin to a veil when you walk behind it
        const under = Math.abs(h.x - fx) < s.w / 2 + 2 && h.y < fy - 3 && h.y > fy - s.h - 2, a0 = this.fade2.get(o) ?? 1, a = a0 + ((under ? 0.3 : 1) - a0) * 0.14; this.fade2.set(o, a); b.globalAlpha = a;
      }
      b.drawImage(s.cv, X, Y); b.globalAlpha = 1;
      // a tower whose windows you set dancing
      if (o.t === 'tower' && this.lit.get(o) > t) { b.globalCompositeOperation = 'lighter'; b.fillStyle = Art.NEON[(o.v + Math.floor(t * 8)) % 6]; b.globalAlpha = 0.5; for (let q = 0; q < 10; q++) b.fillRect(X + 3 + ((q * 7 + Math.floor(t * 10)) % Math.max(4, s.w - 8)), Y + 24 + ((q * 13) % Math.max(6, o.h - 16)), 3, 3); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; }
    },
    // over the things: whales above the islands, motes, bubbles with their signs, and your wisps
    drawOver(b, cx, cy) {
      const t = this.t, h = this.hero;
      for (const w of this.whales) if (w.layer) this.drawWhale(b, w, cx, cy);
      for (const m of this.motes) {
        const a = m.rest ? Math.max(0, (m.life - m.t) / 2.5) : Math.min(1, m.t * 2, (m.life - m.t) * 1.5), X = Math.round(m.x - cx), Y = Math.round(m.y - m.z - cy);
        b.globalAlpha = Math.max(0, a) * (m.kind === 'dust' ? 0.6 : 0.95); b.fillStyle = m.c;
        if (m.kind === 'dust') b.fillRect(X, Y, 2, 1);
        else if (m.kind === 'leaf' || m.kind === 'petal') b.fillRect(X, Y, Math.sin(m.t * 6 + m.ph) > 0 ? 2 : 1, 1);
        else if (Math.sin(m.t * 5 + m.ph) > -0.6) b.fillRect(X, Y, 1, 1);
      }
      b.globalAlpha = 1;
      const n = Math.min(12, Wd.G.inv.wisps || 0), tr = this.trail;
      for (let k = 0; k < n; k++) { const p = tr[Math.max(0, tr.length - 5 - k * 6)]; if (!p) break; const X = Math.round(p[0] - cx + Math.sin(t * 2 + k * 2.1) * 5), Y = Math.round(p[1] - cy - 16 + Math.cos(t * 1.6 + k * 1.3) * 4); b.fillStyle = WISP[k % WISP.length]; b.fillRect(X, Y, 2, 2); b.fillStyle = '#ffffff'; b.fillRect(X, Y, 1, 1); }
      for (const ic of this.icons) {
        if (ic.t < 0) continue;
        const k = ic.t / ic.life, X = Math.round(ic.x - cx - 7), Y = Math.round(ic.y - cy - 17 - k * 12 - (k < 0.12 ? (0.12 - k) * -40 : 0));
        b.globalAlpha = Math.min(1, ic.t * 6, (ic.life - ic.t) * 2.5); b.drawImage(bubbleSprite(), X, Y); b.drawImage(Art.iconSprite(ic.k).cv, X + 2, Y + 2); b.globalAlpha = 1;
      }
      void h;
    },
    // the sky behind the star sea and the rooftops, and the whales that swim below the islands
    drawSkyDream(b) {
      const Rm = this.Rm, t = this.t, cx = this.cam.x, cy = this.cam.y;
      if (Rm.name === 'stars') {
        // far stars that barely move, nearer ones that slide, a band of milky light
        for (let L = 0; L < 2; L++) { const par = L ? 0.3 : 0.08, ox = cx * par, oy = cy * par; for (let k = 0; k < (L ? 50 : 90); k++) { const x = ((hash2(k, L, 5) * 4000 - ox) % (VW + 20) + VW + 20) % (VW + 20) - 10, y = ((hash2(k, L, 9) * 4000 - oy) % (VH + 20) + VH + 20) % (VH + 20) - 10, tw = Math.sin(t * (1 + hash2(k, L, 2) * 3) + k); b.globalAlpha = 0.45 + tw * 0.35; b.fillStyle = ['#ffffff', '#fff6c8', '#9fd8ff', '#e0a8ff'][k % 4]; b.fillRect(Math.round(x), Math.round(y), L && k % 7 === 0 ? 2 : 1, L && k % 7 === 0 ? 2 : 1); } }
        b.globalAlpha = 0.1; b.fillStyle = '#b8a8ff'; b.beginPath(); b.ellipse(VW / 2 - (cx * 0.05) % 60, VH * 0.45, VW * 0.8, 34, -0.35, 0, 7); b.fill(); b.globalAlpha = 1;
      } else if (Rm.name === 'roofs') {
        // the streets far below: a grid of small lights, and traffic sliding along it
        for (let k = 0; k < 110; k++) { const x = ((hash2(k, 1, 7) * 3000 - cx * 0.35) % (VW + 20) + VW + 20) % (VW + 20) - 10, y = ((Math.floor(hash2(k, 2, 7) * 60) * 14 - cy * 0.35) % (VH + 28) + VH + 28) % (VH + 28) - 14; b.globalAlpha = 0.5; b.fillStyle = Art.NEON[k % 6]; b.fillRect(Math.round(x), Math.round(y), 2, 1); }
        for (let k = 0; k < 6; k++) { const y = ((k * 53 - cy * 0.35) % (VH + 28) + VH + 28) % (VH + 28) - 14, x = ((t * (20 + k * 7) * (k % 2 ? 1 : -1) + k * 90 - cx * 0.35) % (VW + 40) + VW + 40) % (VW + 40) - 20; b.globalAlpha = 0.8; b.fillStyle = k % 2 ? '#ff5a5a' : '#fff6c8'; b.fillRect(Math.round(x), Math.round(y), 4, 1); }
        b.globalAlpha = 1;
      }
      for (const w of this.whales) if (!w.layer) this.drawWhale(b, w, Math.round(cx - VW / 2), Math.round(cy - VH / 2));
    },
    // lights that belong to things: lamps, windows, neon, glowing plants and creatures, treasure; and
    // the light of the place: shafts through the forest, glints on the water, an aurora, the city's dusk
    dreamLights(b, cx, cy) {
      const Rm = this.Rm, t = this.t, dark = this.dark, x0 = Math.floor(cx / T) - 3, y0 = Math.floor(cy / T) - 3, x1 = Math.ceil((cx + VW) / T) + 3, y1 = Math.ceil((cy + VH) / T) + 6;
      const L = (x, y, r, col, a) => { const X = Math.round(x - cx), Y = Math.round(y - cy); if (X < -r || Y < -r || X > VW + r || Y > VH + r) return; b.globalAlpha = Math.min(1, a); b.drawImage(glowSprite(col, r), X - Math.round(r / 4) * 4, Y - Math.round(r / 4) * 4); };
      if (this.cityK > 0.02 && Rm.kind !== 'cave') { b.globalCompositeOperation = 'multiply'; b.globalAlpha = this.cityK * (this.mode === 'evening' ? 0.3 : 0.5); b.fillStyle = '#44448a'; b.fillRect(0, 0, VW, VH); b.globalAlpha = 1; }
      b.globalCompositeOperation = 'lighter';
      for (const d of Wd.decorIn(Rm, x0, y0, x1, y1 + 4)) {
        const x = d.x * T + 8, y = (d.y + 1) * T, fl = 0.85 + Math.sin(t * 5 + d.x * 3 + d.y) * 0.1;
        if (d.t === 'lamp') { if (this.isLit(d)) { const col = d.k === 'neonlamp' ? Art.NEON[(d.v || 0) % 3] : d.k === 'shroomlamp' ? '#8ff0d8' : '#ffd98a', ly = y - (d.k === 'neonlamp' ? 28 : d.k === 'lamp' ? 15 : 9); L(x, ly, 44, col, 0.55 * fl); L(x, ly, 16, col, 0.9 * fl); L(x, y - 2, 28, col, 0.35); } }
        else if (d.t === 'house') { if (this.isLit(d)) { L(x, y - 12, 44, '#ffc070', 0.5 * fl); L(x, y + 4, 28, '#ffd98a', 0.4); } }
        else if (d.t === 'tower') { if (dark) L((d.x + d.w / 2) * T, y - 4, 32, Art.NEON[d.v % 6], 0.3); }
        else if (d.t === 'neon') L(x, y - 20, 22, Art.NEON[d.v % 6], dark ? 0.6 : 0.25);
        else if (d.t === 'chest') { if (!d.o) L(x, y - 6, 12, d.k === 'capsule' ? '#ff5ad8' : '#ffe9a8', 0.3 + Math.sin(t * 3 + d.x) * 0.2); }
        else if (d.t === 'crystal') { if (dark && Rm.kind !== 'cave') L(x, y - 8, 16, d.c, 0.5); }
        else if (d.t === 'holo') L(x, y - 46, 56, '#5af0ff', 0.4);
        else if (d.t === 'ring') { if (dark || d.o) L(x, y - 8, 36, '#8ff0d8', 0.3 + Math.sin(t * 1.5) * 0.1); }
        else if (d.t === 'prop' && d.k === 'well' && dark) L(x, y - 12, 14, '#ffd98a', 0.5);
      }
      // creatures that carry their own light
      for (const a of Rm.animals) { const A = ANIMALS[a.k]; if (A.glow && (dark || a.k === 'jelly' || a.k === 'angler' || a.k === 'drone') && Math.abs(a.x - cx - VW / 2) < VW && Math.abs(a.y - cy - VH / 2) < VH) L(a.x, a.y - (A.fly ? 16 : 6), A.big ? 22 : 13, A.glow, 0.5); }
      for (const g of (Rm.name === 'surface' && Wd.G.giants) || []) L(g.x + (g.dir < 0 ? -18 : 18), g.y - 14, 20, '#ffd98a', dark ? 0.7 : 0.3);
      const n = Math.min(12, Wd.G.inv.wisps || 0), tr = this.trail;
      for (let k = 0; k < n; k++) { const p = tr[Math.max(0, tr.length - 5 - k * 6)]; if (p) L(p[0] + Math.sin(t * 2 + k * 2.1) * 5, p[1] - 15 + Math.cos(t * 1.6 + k * 1.3) * 4, 9, WISP[k % WISP.length], dark ? 0.75 : 0.4); }
      for (const m of this.motes) if ((m.kind === 'spore' || m.kind === 'ember' || m.kind === 'star') && dark && (m.ph * 10 | 0) % 3 === 0) L(m.x, m.y - m.z, 5, m.c, 0.5);
      if (Rm.kind !== 'cave' && this.q >= 1) {
        const day = !dark;
        // shafts of light through the forest canopy, standing where the trees let them through
        if (day) for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (hash2(tx, ty, 777) > 0.014 || !inside(Rm, tx, ty) || Rm.ground[ix(Rm, tx, ty)] !== FOREST) continue; const X = tx * T - cx, Y = ty * T - cy, k = 0.07 + Math.sin(t * 0.8 + tx) * 0.03; b.globalAlpha = k; b.fillStyle = this.mode === 'morning' ? '#ffe8c8' : '#fff8d0'; b.beginPath(); b.moveTo(X - 22, Y - 60); b.lineTo(X - 8, Y - 60); b.lineTo(X + 16, Y + 10); b.lineTo(X - 6, Y + 10); b.fill(); b.globalAlpha = k * 1.6; b.drawImage(glowSprite('#fff3c0', 16), X - 11, Y - 6); }
        // glints on the water
        b.fillStyle = this.mode === 'evening' ? '#ffd6f0' : '#ffffff';
        const tb = Math.floor(t * 2.5);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (!inside(Rm, tx, ty) || Rm.ground[ix(Rm, tx, ty)] !== WATER) continue; const hsh = hash2(tx, ty, tb); if (hsh > 0.07) continue; b.globalAlpha = 0.8; const X = tx * T - cx + ((hsh * 220) | 0) % 14, Y = ty * T - cy + ((hsh * 3100) | 0) % 14; b.fillRect(X, Y, 2, 1); b.fillRect(X + 1, Y - 1, 1, 3); }
        // an aurora over the frost at dusk, and in the high sky and the star sea
        const frost = Rm.name === 'surface' && Wd.biomeAt(Rm, Math.floor(this.hero.x / T), Math.floor(this.hero.y / T)) === Wd.B_FROST;
        if ((frost && this.mode === 'evening') || Rm.name === 'stars' || (Rm.name === 'high' && this.mode === 'evening') || Rm.name === 'mountain' && this.mode === 'evening') { const au = auroraSprite(); for (let k = 0; k < 4; k++) { b.globalAlpha = 0.13 + Math.sin(t * 0.3 + k * 1.7) * 0.06; const X = ((k * 83 + t * 4 - cx * 0.5) % (VW + 120) + VW + 120) % (VW + 120) - 60; b.drawImage(au, Math.round(X), Math.round(-20 + Math.sin(t * 0.2 + k) * 14), 70 + k * 12, VH * 0.75); } }
      }
      b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
    }
  });
}
export { STREET, ROCK, VOID, tone };
