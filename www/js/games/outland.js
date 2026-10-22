// Outland: a modern open-terrain shooter in WebGL (three.js, loaded on demand).
// Each game rolls one setting (forest, junkyard, neon city or canyon) and one
// material kit: every texture is painted from the same noise, the same weathered
// photo and the same palette, then dithered, so a run looks of a piece while no
// two runs match. Destroy the far-off relay towers to secure each sector while
// swarms, troopers, snipers, hover bikes and dropships come at you; there is a
// buggy with a turret to drive.
import { Game, W, H, noiseMap, imagePixels, ready } from './engine.js';
import { creatureName } from './creature.js';
import { mulberry32 } from '../util.js';

let T = null, loading = null;
const loadThree = () => (loading ||= import('../vendor/three.module.min.js').then((m) => { T = m; return m; }));

// one renderer for every Outland card; scenes are built per game and dropped when old
const RW = 240, RH = 280;
let R = null;
const live = [];
function renderer() {
  if (R && !R.lost) return R;
  const cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
  const r = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  r.setPixelRatio(1); r.setSize(RW, RH, false); r.autoClear = false;
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r.lost = true; for (const g of [...live]) g.dropGpu(true); });
  R = r; return r;
}

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const angTo = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const BIOMES = {
  forest: { name: 'Forest', amp: 15, sky: ['#7f9db4', '#d8d4bc'], fog: '#a5b0a0', fogD: [25, 210], sun: '#fff0cc', sunI: 2.2, hemi: ['#b9cbd8', '#4a4a30', 1.4], grass: ['#3b4a20', '#5d6c2c', '#86844a'], rock: ['#4d4a44', '#6f6a60', '#9a9384'], weather: 'leaves' },
  junk: { name: 'Junkyard', amp: 7, sky: ['#b98c5c', '#ebcf9c'], fog: '#bf9f74', fogD: [20, 170], sun: '#ffd9a0', sunI: 2.4, hemi: ['#e4c9a0', '#4a3828', 1.3], grass: ['#4b3c2a', '#6e5838', '#91774f'], rock: ['#4a3a30', '#6e5444', '#8e7462'], weather: 'dust' },
  city: { name: 'Neon city', amp: 1, sky: ['#07041a', '#3a1660'], fog: '#2a1846', fogD: [18, 165], sun: '#b0b8ff', sunI: 1.1, hemi: ['#8a70d0', '#2a2030', 1.5], grass: ['#2a2834', '#3a3846', '#55526a'], rock: ['#3a3846', '#4c4a5a', '#6a687a'], weather: 'rain', night: true },
  canyon: { name: 'Canyon', amp: 30, sky: ['#d58a5a', '#f6d2a0'], fog: '#d6a67a', fogD: [30, 240], sun: '#fff0d0', sunI: 2.6, hemi: ['#f0c8a0', '#5a3020', 1.3], grass: ['#7a4428', '#a3613a', '#c88a56'], rock: ['#6a3a26', '#8e5234', '#b57a52'], weather: 'dust' }
};
const BIOME_KEYS = Object.keys(BIOMES);

const ARMS = [
  { k: 'rifle', auto: true, rate: 0.085, dmg: 9, spread: 0.022, mag: 36, res: 252, range: 140, kick: 0.010, tracer: [1, 0.85, 0.5], magnet: 0.03 },
  { k: 'marksman', rate: 0.5, dmg: 75, spread: 0.0012, mag: 5, res: 35, range: 520, zoom: 4, kick: 0.05, tracer: [0.6, 0.95, 1], magnet: 0.004 },
  { k: 'rocket', rate: 1.1, dmg: 150, splash: 6.5, proj: 70, mag: 2, res: 10, kick: 0.09 },
  { k: 'scatter', rate: 0.75, dmg: 10, pellets: 9, spread: 0.075, mag: 6, res: 42, range: 34, kick: 0.07, tracer: [1, 0.7, 0.4], magnet: 0.05 }
];
const GUN_A = ['Rusted', 'Feral', 'Hollow', 'Velvet', 'Howling', 'Salted', 'Lunar', 'Grim', 'Bent', 'Weeping', 'Static', 'Junk', 'Neon', 'Mossy', 'Choral'];
const GUN_B = { rifle: ['Carbine', 'Chatter', 'Hymnal', 'Rattler'], marksman: ['Longshot', 'Needle', 'Psalm', 'Spyglass'], rocket: ['Thumper', 'Lobber', 'Sermon', 'Kettle'], scatter: ['Scattergun', 'Spreader', 'Hailmaker', 'Gossip'] };

const FOES = {
  crawler: { hp: 18, speed: 9, r: 0.7, melee: 6, score: 5 },
  trooper: { hp: 60, speed: 4.2, r: 0.55, score: 25 },
  brute: { hp: 240, speed: 3.1, r: 0.9, armor: 0.6, score: 60, size: 1.5 },
  sniper: { hp: 50, speed: 3.6, r: 0.55, score: 40 },
  bike: { hp: 160, speed: 17, r: 1.4, score: 70 },
  tower: { hp: 800, r: 2.6, score: 250 },
  ship: { hp: 1000, r: 6, score: 300 }
};

// ------------------------------------------------------------------ geometry helpers
const MAT = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
// atlas tiles (4×4 of 64px): every prop shares one texture, so one material
const TILE = { bark: 0, leaf: 1, rock: 2, metal: 3, rust: 4, crate: 5, armor: 6, dark: 7, glow: 8, rubber: 9, concrete: 10, paint: 11, wood: 12, skin: 13, glass: 14, plain: 15 };
// parts: [geometry, matrix, colour (hex or null), tile]
function merge(parts) {
  const pos = [], nor = [], uv = [], col = [];
  const c = new T.Color();
  for (const [g0, m, hex, tile] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    if (m) g.applyMatrix4(m);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    c.set(hex ?? '#ffffff');
    const tx = (tile ?? 0) % 4, ty = Math.floor((tile ?? 0) / 4), e = 1.5 / 256;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i));
      const u = U ? U.getX(i) : 0, v = U ? U.getY(i) : 0;
      uv.push(tx / 4 + e + (u - Math.floor(u === 1 ? 0 : u)) * (0.25 - 2 * e), 1 - (ty + 1) / 4 + e + (v - Math.floor(v === 1 ? 0 : v)) * (0.25 - 2 * e));
      col.push(c.r, c.g, c.b);
    }
    g.dispose();
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
const BOX = () => new T.BoxGeometry(1, 1, 1);
const CYL = (seg = 8, top = 1) => new T.CylinderGeometry(0.5 * top, 0.5, 1, seg);
const ICO = () => new T.IcosahedronGeometry(0.5, 0);
const CONE = (seg = 7) => new T.ConeGeometry(0.5, 1, seg);

export class Outland extends Game {
  static noMods = ['mirror', 'wobble', 'trails', 'party'];
  setup() {
    const s = this.post.seed || 1;
    this.biomeKey = BIOME_KEYS[(s >>> 5) % BIOME_KEYS.length];
    this.B = BIOMES[this.biomeKey];
    this.hueShift = this.r(-0.045, 0.045);
    this.arms = ARMS.map((a) => ({ ...a, name: `${GUN_A[this.ri(0, GUN_A.length - 1)]} ${GUN_B[a.k][this.ri(0, 3)]}` }));
    this.enemyName = creatureName(s * 7 + 3);
    this.sector = 0; this.kills = 0; this.deaths = 0;
    this.ready = false; this.msg = []; this.feed = [];
    this.in = { mx: 0, mz: 0, fire: false, jump: false };
    this.touch = { stick: null, look: null, fire: null };
    loadThree().then(() => { this.initColors(); this.newSector(); this.ready = true; }).catch((e) => { this.failed = String(e?.message || e); });
  }
  hud() { return `${Math.floor(this.score)}`; }
  initColors() {
    const B = this.B, a2 = new T.Color(this.pal.c[2] || this.pal.c[1]), g = this.colour(B.grass[1]);
    this.accent2 = [a2.r, a2.g, a2.b]; this.boltCol = [a2.r, a2.g, a2.b]; this.dustCol = [g.r * 1.3, g.g * 1.3, g.b * 1.3];
  }

  // ------------------------------------------------------------------ world data (no GPU)
  newSector() {
    this.sector++;
    const R = this.rng, B = this.B;
    const N = 129, SIZE = 320, cell = SIZE / (N - 1);
    this.N = N; this.SIZE = SIZE; this.cell = cell;
    const n1 = noiseMap(R, 128, 5, 3), n2 = noiseMap(R, 128, 3, 2);
    const h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = n1[(j % 128) * 128 + (i % 128)], b = n2[(j % 128) * 128 + (i % 128)];
      const x = i * cell - SIZE / 2, z = j * cell - SIZE / 2, r = Math.hypot(x, z);
      let y;
      if (this.biomeKey === 'canyon') { const t = clamp((a - 0.3) * 1.9, 0, 1), st = Math.floor(t * 4) / 4, f = t * 4 - Math.floor(t * 4); y = (st + Math.pow(f, 6) / 4) * B.amp * 1.4 - 6 + (b - 0.5) * 6; }
      else if (this.biomeKey === 'city') y = (a - 0.5) * 1.2;
      else if (this.biomeKey === 'junk') y = (a - 0.5) * B.amp * 2 + Math.max(0, b - 0.6) * 30;
      else y = (a - 0.45) * B.amp * 2.2 + (b - 0.5) * B.amp;
      if (r > 128) y += Math.pow(r - 128, 1.35) * (this.biomeKey === 'city' ? 0.15 : 0.9);
      const fl = clamp((r - 10) / 22, 0, 1); // flat ground at the drop point
      h[j * N + i] = lerp(this.biomeKey === 'city' ? 0 : y * 0.25, y, fl);
    }
    this.hmap = h;
    this.obs = []; this.cells = new Map();
    this.props = { trees: [], trees2: [], rocks: [], containers: [], cars: [], tires: [], scrap: [], spires: [], ruins: [], buildings: [], signs: [], lamps: [] };
    this.layout();
    // relay towers on high ground, far out
    const towers = [], want = 3 + Math.min(2, this.sector - 1);
    const cands = [];
    for (let k = 0; k < 260; k++) {
      const a = R() * TAU, d = this.r(85, 122), x = Math.cos(a) * d, z = Math.sin(a) * d;
      let y = this.hAt(x, z);
      const roof = this.biomeKey === 'city' ? this.props.buildings.filter((b) => Math.abs(b.x - x) < b.w / 2 - 3 && Math.abs(b.z - z) < b.d / 2 - 3)[0] : null;
      if (roof) y = roof.h;
      else if (this.blocked(x, z, 3)) continue;
      cands.push({ x, z, y, roof: !!roof, a, score: y + (roof ? 30 : 0) + R() * 4 });
    }
    cands.sort((p, q) => q.score - p.score);
    for (const c of cands) { if (towers.length >= want) break; if (towers.every((t) => Math.abs(angTo(t.a, c.a)) > 1.0)) towers.push(c); }
    if (!towers.length) towers.push({ x: 100, z: 0, y: this.hAt(100, 0), a: 0 });
    this.foes = []; this.shots = []; this.fx = []; this.picks = []; this.nades = [];
    for (const t of towers) this.spawn('tower', t.x, t.z, { y: t.y });
    // the player and a buggy at the drop point
    const sa = R() * TAU;
    this.p = { x: Math.cos(sa) * 4, z: Math.sin(sa) * 4, y: 0, vy: 0, yaw: Math.atan2(-towers[0].x, -towers[0].z) + Math.PI, pitch: 0, ground: true, hp: this.mods.glass ? 50 : 100, max: this.mods.glass ? 50 : 100, sh: this.mods.glass ? 40 : 100, shMax: this.mods.glass ? 40 : 100, shT: 0, w: 0, cool: 0, reload: 0, swap: 0, zoom: false, nades: 4, veh: null, dead: 0, hurt: 0, hurtDir: 0, bob: 0, kick: 0, step: 0 };
    this.p.yaw = Math.atan2(towers[0].x - this.p.x, towers[0].z - this.p.z);
    this.p.y = this.hAt(this.p.x, this.p.z);
    this.ammo = this.arms.map((a) => ({ mag: a.mag, res: Math.round(a.res * 0.6) }));
    const ca = sa + Math.PI * 0.6, cx = Math.cos(ca) * 9, cz = Math.sin(ca) * 9;
    this.cars = [this.mkCar(cx, cz, this.p.yaw)];
    // squads by the towers, crawler nests out in the field
    const sw = this.mods.swarm ? 1.7 : 1;
    for (const t of towers) {
      for (let k = 0; k < this.ri(2, 4) + Math.floor(this.sector / 2); k++) { const a = R() * TAU, d = this.r(6, 16); this.spawn(k === 0 && R() < 0.3 ? 'brute' : 'trooper', t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, { home: t }); }
      if (R() < 0.75) { const a = R() * TAU; this.spawn('sniper', t.x + Math.cos(a) * (t.roof ? 5 : 9), t.z + Math.sin(a) * (t.roof ? 5 : 9), t.roof ? { home: t, y: t.y } : { home: t }); }
    }
    for (let k = 0; k < 2 + this.sector; k++) {
      const a = R() * TAU, d = this.r(45, 110), x = Math.cos(a) * d, z = Math.sin(a) * d, n = Math.round(this.ri(7, 13) * sw);
      for (let q = 0; q < n; q++) this.spawn('crawler', x + this.r(-5, 5), z + this.r(-5, 5), { idle: true });
    }
    for (let k = 0; k < 1 + Math.floor(this.sector / 2); k++) { const a = R() * TAU; this.spawn('bike', Math.cos(a) * 100, Math.sin(a) * 100); }
    this.waveT = this.mods.swarm ? 14 : 24; this.shipT = 38; this.clearT = 0;
    this.say(`SECTOR ${this.sector} · ${this.B.name.toUpperCase()}`, 3); this.say(`Destroy ${towers.length} relay towers`, 3);
    if (this.gl) this.dropGpu();
  }
  hAt(x, z) {
    const N = this.N, fx = clamp((x + this.SIZE / 2) / this.cell, 0, N - 1.001), fz = clamp((z + this.SIZE / 2) / this.cell, 0, N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, h = this.hmap;
    const a = h[j * N + i], b = h[j * N + i + 1], c = h[(j + 1) * N + i], d = h[(j + 1) * N + i + 1];
    return tx + tz < 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }
  addObs(o) {
    this.obs.push(o);
    const r = o.r || Math.max(o.w, o.d) / 2;
    for (let cx = Math.floor((o.x - r) / 16); cx <= Math.floor((o.x + r) / 16); cx++) for (let cz = Math.floor((o.z - r) / 16); cz <= Math.floor((o.z + r) / 16); cz++) {
      const k = cx * 1000 + cz; let l = this.cells.get(k); if (!l) this.cells.set(k, (l = [])); l.push(o);
    }
  }
  near(x, z) { return this.cells.get(Math.floor(x / 16) * 1000 + Math.floor(z / 16)) || []; }
  blocked(x, z, pad = 0) {
    for (const o of this.near(x, z)) {
      if (o.r) { if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return o; }
      else if (Math.abs(x - o.x) < o.w / 2 + pad && Math.abs(z - o.z) < o.d / 2 + pad) return o;
    }
    return null;
  }
  // push a circle out of obstacles; returns true if it touched one
  collide(e, r, y) {
    let hit = false;
    for (const o of this.near(e.x, e.z)) {
      if (y !== undefined && y > o.top) continue;
      if (o.r) {
        const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
        if (d < m && d > 1e-4) { e.x = o.x + (dx / d) * m; e.z = o.z + (dz / d) * m; hit = true; }
      } else {
        const cx = clamp(e.x, o.x - o.w / 2, o.x + o.w / 2), cz = clamp(e.z, o.z - o.d / 2, o.z + o.d / 2), dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz);
        if (d < r) {
          if (d > 1e-4) { e.x = cx + (dx / d) * r; e.z = cz + (dz / d) * r; }
          else { const l = e.x - (o.x - o.w / 2), rr = o.x + o.w / 2 - e.x, t = e.z - (o.z - o.d / 2), b = o.z + o.d / 2 - e.z, m = Math.min(l, rr, t, b); if (m === l) e.x -= l + r; else if (m === rr) e.x += rr + r; else if (m === t) e.z -= t + r; else e.z += b + r; }
          hit = true;
        }
      }
    }
    const lim = 138, d = Math.hypot(e.x, e.z);
    if (d > lim) { e.x *= lim / d; e.z *= lim / d; hit = true; }
    return hit;
  }
  layout() {
    const R = this.rng, P = this.props, k = this.biomeKey;
    const spot = (minR = 14, maxR = 132) => { const a = R() * TAU, d = Math.sqrt(R()) * (maxR - minR) + minR; return [Math.cos(a) * d, Math.sin(a) * d]; };
    if (k === 'forest') {
      // clearings stay open; trees thicken toward the edges
      const clear = Array.from({ length: 5 }, () => spot(30, 110));
      for (let i = 0; i < 620; i++) {
        const [x, z] = spot(); if (clear.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 14)) continue;
        const s = this.r(0.8, 1.5), y = this.hAt(x, z);
        (R() < 0.6 ? P.trees : P.trees2).push({ x, z, y, s, rot: R() * TAU });
        this.addObs({ x, z, r: 0.45 * s, top: y + 14 * s });
      }
      for (let i = 0; i < 90; i++) { const [x, z] = spot(10); const s = this.r(0.8, 3.2); P.rocks.push({ x, z, y: this.hAt(x, z), s, rot: R() * TAU }); this.addObs({ x, z, r: s * 0.55, top: this.hAt(x, z) + s * 0.7 }); }
    } else if (k === 'junk') {
      for (let i = 0; i < 70; i++) {
        const [x, z] = spot(18); const rot = Math.floor(R() * 2) * Math.PI / 2 + this.r(-0.05, 0.05), stack = this.ri(1, 3), y = this.hAt(x, z);
        for (let q = 0; q < stack; q++) P.containers.push({ x, z, y: y + q * 2.6, rot, c: this.ri(0, 5) });
        const along = Math.abs(Math.sin(rot)) > 0.5; this.addObs(along ? { x, z, w: 6.2, d: 2.5, top: y + stack * 2.6 } : { x, z, w: 2.5, d: 6.2, top: y + stack * 2.6 });
      }
      for (let i = 0; i < 80; i++) { const [x, z] = spot(12); const y = this.hAt(x, z); P.cars.push({ x, z, y, rot: R() * TAU, flip: R() < 0.2, c: this.ri(0, 5) }); this.addObs({ x, z, r: 1.8, top: y + 1.6 }); }
      for (let i = 0; i < 60; i++) { const [x, z] = spot(10); const n = this.ri(2, 5), y = this.hAt(x, z); for (let q = 0; q < n; q++) P.tires.push({ x, z, y: y + q * 0.42 }); this.addObs({ x, z, r: 0.75, top: y + n * 0.42 }); }
      for (let i = 0; i < 26; i++) { const [x, z] = spot(25); const s = this.r(4, 9); P.scrap.push({ x, z, y: this.hAt(x, z), s, seed: R() }); this.addObs({ x, z, r: s * 0.55, top: this.hAt(x, z) + s * 0.6 }); }
      for (let i = 0; i < 4; i++) { const [x, z] = spot(40, 120); P.ruins.push({ x, z, y: this.hAt(x, z), crane: true, rot: R() * TAU }); this.addObs({ x, z, r: 1.6, top: 999 }); }
    } else if (k === 'canyon') {
      for (let i = 0; i < 46; i++) { const [x, z] = spot(18); const s = this.r(1.5, 4), hh = this.r(8, 26); P.spires.push({ x, z, y: this.hAt(x, z) - 1, s, h: hh, rot: R() * TAU }); this.addObs({ x, z, r: s * 0.9, top: this.hAt(x, z) + hh }); }
      for (let i = 0; i < 140; i++) { const [x, z] = spot(8); const s = this.r(0.6, 3.6); P.rocks.push({ x, z, y: this.hAt(x, z), s, rot: R() * TAU }); this.addObs({ x, z, r: s * 0.55, top: this.hAt(x, z) + s * 0.7 }); }
      for (let i = 0; i < 40; i++) { const [x, z] = spot(14); P.trees2.push({ x, z, y: this.hAt(x, z), s: this.r(0.5, 0.9), rot: R() * TAU, dead: true }); }
      for (let i = 0; i < 12; i++) { const [x, z] = spot(25, 120); const w = this.r(4, 10), d = this.r(0.8, 1.4), hh = this.r(2, 6), rot = R() < 0.5 ? 0 : Math.PI / 2; P.ruins.push({ x, z, y: this.hAt(x, z), w, d, h: hh, rot }); this.addObs(rot ? { x, z, w: d, d: w, top: this.hAt(x, z) + hh } : { x, z, w, d, top: this.hAt(x, z) + hh }); }
    } else {
      // city blocks on a street grid; a plaza at the centre
      const S = 38, road = 11;
      for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
        const bx = gx * S, bz = gz * S;
        if (Math.hypot(bx, bz) < 30 || Math.hypot(bx, bz) > 150) continue;
        const lot = S - road, split = R() < 0.5 ? 1 : 2;
        for (let a = 0; a < split; a++) for (let b = 0; b < split; b++) {
          if (R() < 0.12) continue;
          const w = lot / split - this.r(1, 4), d = lot / split - this.r(1, 4);
          const x = bx - lot / 2 + (a + 0.5) * lot / split, z = bz - lot / 2 + (b + 0.5) * lot / split;
          const far = Math.hypot(x, z), hh = Math.round(this.r(9, 22) + (far > 100 ? this.r(10, 50) : this.r(0, 25)));
          P.buildings.push({ x, z, w, d, h: hh, c: this.ri(0, 3) });
          this.addObs({ x, z, w, d, top: hh });
          if (R() < 0.55) P.signs.push({ x: x + (R() < 0.5 ? -1 : 1) * (w / 2 + 0.3), z: z + this.r(-d / 3, d / 3), y: this.r(5, Math.min(hh - 2, 24)), side: true, h: this.r(4, 9), c: this.ri(0, 3) });
          if (R() < 0.35) P.signs.push({ x: x + this.r(-w / 3, w / 3), z: z + (R() < 0.5 ? -1 : 1) * (d / 2 + 0.3), y: this.r(4, Math.min(hh - 2, 20)), side: false, h: this.r(1.2, 2.4), w: this.r(4, 9), c: this.ri(0, 3) });
        }
        for (const [dx, dz] of [[S / 2, 0], [0, S / 2]]) if (R() < 0.6) { const x = bx + dx, z = bz + dz + this.r(-3, 3); P.lamps.push({ x, z }); this.addObs({ x, z, r: 0.25, top: 7 }); }
      }
      for (let i = 0; i < 40; i++) { const [x, z] = spot(14); if (this.blocked(x, z, 2)) continue; P.cars.push({ x, z, y: 0, rot: Math.round(R() * 4) * Math.PI / 2, c: this.ri(0, 5) }); this.addObs({ x, z, r: 1.8, top: 1.6 }); }
    }
  }

  // ------------------------------------------------------------------ entities
  spawn(kind, x, z, o = {}) {
    const d = FOES[kind];
    const e = { kind, x, z, y: o.y ?? this.hAt(x, z), vx: 0, vz: 0, vy: 0, yaw: this.r(0, TAU), hp: d.hp * (1 + (this.sector - 1) * 0.12), max: d.hp * (1 + (this.sector - 1) * 0.12), cd: this.r(1, 3), t: this.r(0, 9), awake: !o.idle && kind !== 'crawler', dead: 0, los: false, losT: this.r(0, 0.3), home: o.home || null, phase: this.r(0, TAU), m: null, sz: (d.size || 1) * this.S };
    if (kind === 'bike') { e.y += 1.2; e.orbit = this.r(18, 32) * (this.rng() < 0.5 ? 1 : -1); }
    if (kind === 'ship') Object.assign(e, o);
    if (kind === 'tower') { e.awake = true; e.spin = 0; }
    if (kind === 'sniper' && o.y !== undefined) { e.perch = true; e.y = o.y; }
    this.foes.push(e);
    return e;
  }
  mkCar(x, z, yaw) { return { x, z, y: this.hAt(x, z) + 0.6, yaw, vy: 0, speed: 0, steer: 0, pitch: 0, roll: 0, hp: 380, max: 380, wheel: 0, cool: 0, dead: 0, m: null }; }
  say(t, dur = 2.2) { this.msg.push({ t, life: dur }); if (this.msg.length > 3) this.msg.shift(); }
  kill(e, by) {
    if (e.dead) return;
    e.dead = 0.001; e.hp = 0;
    const d = FOES[e.kind];
    this.score += d.score; this.kills++;
    if (e.kind === 'tower') { this.boom(e.x, e.y + 8, e.z, 9, 0, true); this.say(`RELAY DOWN · ${this.foes.filter((f) => f.kind === 'tower' && !f.dead).length} LEFT`, 2.5); }
    else if (e.kind === 'ship' || e.kind === 'bike') this.boom(e.x, e.y, e.z, e.kind === 'ship' ? 8 : 4, 0, true);
    else this.puff(e.x, e.y + 0.8, e.z, e.kind === 'crawler' ? this.accent2 : [0.9, 0.2, 0.15], 10);
    if ((e.kind === 'trooper' || e.kind === 'brute' || e.kind === 'sniper') && this.rng() < 0.35) this.picks.push({ x: e.x, z: e.z, y: e.y, kind: this.rng() < 0.4 ? 'health' : 'ammo', t: 0, m: null });
    if (by === 'car') this.feed.push({ t: 'SPLATTER', life: 1.2 });
    if (e.kind !== 'crawler' && e.kind !== 'tower') this.feed.push({ t: `${e.kind.toUpperCase()} DOWN`, life: 1.4 });
  }
  damage(e, amt, by, head = false) {
    if (e.dead || e.hp <= 0) return;
    const d = FOES[e.kind];
    amt *= (d.armor || 1) * (head ? 2.5 : 1) * (this.mods.glass ? 1.6 : 1);
    e.hp -= amt; e.hit = 0.12; e.awake = true;
    if (e.kind === 'crawler') e.vx *= 0.3, e.vz *= 0.3;
    this.hitMark = head ? 0.3 : 0.15; this.hitHead = head;
    if (e.hp <= 0) this.kill(e, by);
  }
  hurtPlayer(amt, fx, fz) {
    const p = this.p;
    if (p.dead) return;
    if (p.veh) { p.veh.hp -= amt * 0.75; amt *= 0.25; if (p.veh.hp <= 0) this.wreck(p.veh); }
    p.shT = 4;
    if (p.sh > 0) { const a = Math.min(p.sh, amt); p.sh -= a; amt -= a; }
    p.hp -= amt; p.hurt = 0.4;
    if (fx !== undefined) p.hurtDir = Math.atan2(fx - p.x, fz - p.z);
    if (p.hp <= 0) this.die();
  }
  die() {
    const p = this.p;
    p.dead = 3.2; p.hp = 0; this.deaths++; this.score = Math.max(0, this.score - 100);
    if (p.veh) { p.veh.driver = false; p.veh = null; }
    this.say('YOU WERE KILLED', 2.5);
  }
  respawn() {
    const p = this.p;
    Object.assign(p, { x: this.r(-5, 5), z: this.r(-5, 5), vy: 0, hp: p.max, sh: p.shMax, dead: 0, nades: Math.max(p.nades, 2), w: 0, reload: 0, zoom: false });
    p.y = this.hAt(p.x, p.z);
    this.ammo.forEach((a, i) => { a.mag = this.arms[i].mag; a.res = Math.max(a.res, Math.round(this.arms[i].res * 0.4)); });
    for (const f of this.foes) if (f.kind === 'crawler' && Math.hypot(f.x - p.x, f.z - p.z) < 30) { f.x += 40; f.z += 40; }
    if (!this.cars.some((c) => !c.dead)) this.cars.push(this.mkCar(p.x + 7, p.z + 5, p.yaw));
  }
  wreck(c) {
    if (c.dead) return;
    c.dead = 0.001; this.boom(c.x, c.y + 1, c.z, 5, 0, true);
    if (this.p.veh === c) { this.p.veh = null; this.hurtPlayer(30); this.p.x += 3; }
    this.say('VEHICLE DESTROYED', 2);
  }

  // ------------------------------------------------------------------ effects (data; drawn by the GPU side)
  puff(x, y, z, col, n = 8, sp = 4, life = 0.6, size = 0.35) {
    for (let i = 0; i < n; i++) this.fx.push({ k: 'p', x, y, z, vx: this.r(-sp, sp), vy: this.r(0, sp * 1.2), vz: this.r(-sp, sp), life: this.r(life * 0.5, life), max: life, col, size, g: 9 });
    if (this.fx.length > 700) this.fx.splice(0, this.fx.length - 700);
  }
  smoke(x, y, z, n = 1, life = 1.6) { for (let i = 0; i < n; i++) this.fx.push({ k: 'p', x: x + this.r(-0.5, 0.5), y, z: z + this.r(-0.5, 0.5), vx: this.r(-0.4, 0.4), vy: this.r(1, 2.5), vz: this.r(-0.4, 0.4), life, max: life, col: [0.25, 0.23, 0.22], size: 1.6, g: -0.5, smoke: true }); }
  tracer(a, b, col, life = 0.07) { this.fx.push({ k: 't', a, b, col, life, max: life }); }
  boom(x, y, z, rad, dmg, big = false, fromPlayer = true) {
    this.fx.push({ k: 'b', x, y, z, rad, life: big ? 0.7 : 0.45, max: big ? 0.7 : 0.45 });
    this.puff(x, y, z, [1, 0.6, 0.2], big ? 40 : 18, rad * 1.4, 0.8, 0.5);
    for (let i = 0; i < (big ? 12 : 5); i++) this.smoke(x, y, z, 1, 2.4);
    const p = this.p, dp = Math.hypot(p.x - x, p.y + 1 - y, p.z - z);
    this.shake = Math.max(this.shake || 0, clamp(1.2 - dp / 40, 0, 1) * (big ? 1 : 0.6));
    if (!dmg) return;
    for (const e of this.foes) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y + 1 - y, e.z - z); if (d < rad + FOES[e.kind].r) { this.damage(e, dmg * (1 - (d / (rad + 2)) * 0.6), 'boom'); if (!e.dead && e.kind !== 'tower' && e.kind !== 'ship') { e.vx += (e.x - x) / (d + 0.5) * 8; e.vz += (e.z - z) / (d + 0.5) * 8; e.vy = 5; } } }
    if (dp < rad) this.hurtPlayer(dmg * (fromPlayer ? 0.35 : 1) * (1 - dp / rad), x, z);
    for (const c of this.cars) if (!c.dead && Math.hypot(c.x - x, c.z - z) < rad + 2) { c.hp -= dmg * 0.6; if (c.hp <= 0) this.wreck(c); }
  }

  // ------------------------------------------------------------------ rays
  // march a ray; returns {t, e (foe), head, ground}
  ray(o, d, range, magnet = 0, skip = null) {
    let best = { t: range, e: null };
    for (const e of this.foes) {
      if (e.dead || e === skip) continue;
      const F = FOES[e.kind], rr = F.r * e.sz, cy = e.y + (e.kind === 'crawler' ? 0.5 : e.kind === 'tower' ? 10 : e.kind === 'ship' ? 0 : e.kind === 'bike' ? 0 : 1.1 * e.sz);
      const hh = e.kind === 'tower' ? 8 : e.kind === 'trooper' || e.kind === 'sniper' || e.kind === 'brute' ? 1.0 * e.sz : 0;
      // capsule as two spheres
      for (const yy of hh ? [cy - hh * 0.5, cy + hh * 0.5] : [cy]) {
        const ox = e.x - o.x, oy = yy - o.y, oz = e.z - o.z, tc = ox * d.x + oy * d.y + oz * d.z;
        if (tc < 0 || tc > best.t) continue;
        const r = rr * (hh ? 1.3 : 1) + magnet * tc, dd = ox * ox + oy * oy + oz * oz - tc * tc;
        if (dd < r * r) { const t = tc - Math.sqrt(r * r - dd); if (t < best.t) best = { t: Math.max(0, t), e, head: (e.kind === 'trooper' || e.kind === 'sniper' || e.kind === 'brute') && o.y + d.y * tc > e.y + 1.75 * e.sz }; }
      }
    }
    // world
    let t = 0, step = 0.6;
    while (t < best.t) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < this.hAt(x, z)) { return { t, e: null, ground: true }; }
      const b = this.blocked(x, z); if (b && y < b.top) return { t, e: null, ground: true };
      t += step; if (t > 40) step = 1.2;
    }
    return best;
  }
  losTo(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz), n = Math.ceil(L / 3);
    for (let i = 1; i < n; i++) { const t = i / n, x = ax + dx * t, y = ay + dy * t, z = az + dz * t; if (y < this.hAt(x, z) - 0.3) return false; const b = this.blocked(x, z); if (b && y < b.top) return false; }
    return true;
  }
  eye() { const p = this.p; return { x: p.x, y: p.y + (p.dead ? 0.4 : 1.65), z: p.z }; }
  aimDir() { const p = this.p, cp = Math.cos(p.pitch); return { x: Math.sin(p.yaw) * cp, y: Math.sin(p.pitch), z: Math.cos(p.yaw) * cp }; }

  // ------------------------------------------------------------------ player actions
  fire() {
    const p = this.p, a = this.arms[p.w], am = this.ammo[p.w];
    if (p.dead || p.cool > 0 || p.reload > 0 || p.swap > 0) return;
    if (p.veh) { this.carGun(); return; }
    if (am.mag <= 0) { this.reload(); return; }
    am.mag--; p.cool = a.rate; p.kick = Math.min(1, p.kick + 0.5); this.flash = 0.05;
    p.pitch = clamp(p.pitch + a.kick * (p.zoom ? 0.4 : 1), -1.2, 1.2);
    const e = this.eye(), d0 = this.aimDir();
    if (a.proj) {
      this.shots.push({ k: 'rocket', x: e.x + d0.x, y: e.y + d0.y - 0.2, z: e.z + d0.z, vx: d0.x * a.proj, vy: d0.y * a.proj, vz: d0.z * a.proj, life: 4, mine: true, dmg: a.dmg, rad: a.splash });
    } else {
      for (let k = 0; k < (a.pellets || 1); k++) {
        const s = a.spread * (p.zoom ? 0.3 : 1) * (this.in.mx || this.in.mz ? 1.4 : 1);
        const d = { x: d0.x + this.r(-s, s), y: d0.y + this.r(-s, s), z: d0.z + this.r(-s, s) }, L = Math.hypot(d.x, d.y, d.z); d.x /= L; d.y /= L; d.z /= L;
        const h = this.ray(e, d, a.range, a.magnet * (p.zoom ? 0.3 : 1));
        const end = { x: e.x + d.x * h.t, y: e.y + d.y * h.t, z: e.z + d.z * h.t };
        if (k < 3) this.tracer({ x: e.x + d.x * 1.2 + Math.cos(p.yaw) * 0.25, y: e.y - 0.25, z: e.z + d.z * 1.2 - Math.sin(p.yaw) * 0.25 }, end, a.tracer);
        if (h.e) this.damage(h.e, a.dmg * (h.t > a.range * 0.6 && a.k !== 'marksman' ? 0.6 : 1), 'gun', h.head);
        else if (h.ground && k < 3) this.puff(end.x, end.y, end.z, this.dustCol, 3, 2, 0.4, 0.25);
      }
    }
    if (am.mag <= 0) this.reload();
  }
  carGun() {
    const p = this.p, c = p.veh;
    if (c.cool > 0) return;
    c.cool = 0.075; this.flash = 0.04;
    const d0 = this.aimDir(), o = { x: c.x - Math.sin(c.yaw) * 1.5, y: c.y + 2.2, z: c.z - Math.cos(c.yaw) * 1.5 };
    const s = 0.02, d = { x: d0.x + this.r(-s, s), y: d0.y + this.r(-s, s) + 0.02, z: d0.z + this.r(-s, s) }, L = Math.hypot(d.x, d.y, d.z); d.x /= L; d.y /= L; d.z /= L;
    const h = this.ray(o, d, 150, 0.035);
    const end = { x: o.x + d.x * h.t, y: o.y + d.y * h.t, z: o.z + d.z * h.t };
    this.tracer({ x: o.x + d.x, y: o.y + d.y, z: o.z + d.z }, end, [1, 0.9, 0.5]);
    if (h.e) this.damage(h.e, 13, 'gun', false); else if (h.ground) this.puff(end.x, end.y, end.z, this.dustCol, 3, 2, 0.4, 0.25);
  }
  reload() { const p = this.p, a = this.arms[p.w], am = this.ammo[p.w]; if (p.reload > 0 || am.mag >= a.mag || am.res <= 0) { if (am.mag <= 0 && am.res <= 0) this.swapTo(this.best()); return; } p.reload = a.k === 'rocket' ? 1.8 : a.k === 'marksman' ? 1.6 : 1.3; p.zoom = false; }
  best() { return [0, 3, 1, 2].find((i) => this.ammo[i].mag + this.ammo[i].res > 0) ?? 0; }
  swapTo(w) { const p = this.p; if (w === p.w) return; p.w = w; p.swap = 0.45; p.reload = 0; p.zoom = false; }
  throwNade() {
    const p = this.p; if (p.nades <= 0 || p.dead || p.veh || p.swap > 0) return;
    p.nades--; const e = this.eye(), d = this.aimDir();
    this.nades.push({ x: e.x + d.x, y: e.y, z: e.z + d.z, vx: d.x * 17, vy: d.y * 17 + 5, vz: d.z * 17, t: 2.2, m: null });
  }
  useCar() {
    const p = this.p;
    if (p.veh) { const c = p.veh; c.driver = false; p.veh = null; p.x = c.x + Math.cos(c.yaw) * 2.6; p.z = c.z - Math.sin(c.yaw) * 2.6; p.y = this.hAt(p.x, p.z); return; }
    const c = this.carNear(); if (c) { p.veh = c; c.driver = true; p.zoom = false; p.reload = 0; }
  }
  carNear() { const p = this.p; return this.cars.find((c) => !c.dead && !c.driver && Math.hypot(c.x - p.x, c.z - p.z) < 4.5) || null; }

  // ------------------------------------------------------------------ simulation
  step(dt) {
    if (!this.ready) return;
    const p = this.p;
    for (const m of this.msg) m.life -= dt; this.msg = this.msg.filter((m) => m.life > 0);
    for (const m of this.feed) m.life -= dt; this.feed = this.feed.filter((m) => m.life > 0);
    this.hitMark = Math.max(0, (this.hitMark || 0) - dt); this.flash = Math.max(0, (this.flash || 0) - dt); this.shake = Math.max(0, (this.shake || 0) - dt * 2);
    if (this.clearT > 0) { this.clearT -= dt; if (this.clearT <= 0) this.newSector(); }
    if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0) this.respawn(); }
    else this.stepPlayer(dt);
    for (const c of this.cars) this.stepCar(c, dt);
    this.stepFoes(dt);
    this.stepShots(dt);
    for (const f of this.fx) { f.life -= dt; if (f.k === 'p') { f.vy -= f.g * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; if (f.smoke) f.size += dt * 1.5; } }
    if (this.t % 0.25 < dt) this.fx = this.fx.filter((f) => f.life > 0);
    for (const k of this.picks) { k.t += dt; if (!p.dead && !p.veh && Math.hypot(k.x - p.x, k.z - p.z) < 1.6) { k.got = true; if (k.kind === 'health') { p.hp = Math.min(p.max, p.hp + 50); this.feed.push({ t: '+ HEALTH', life: 1.2 }); } else { this.ammo.forEach((a, i) => { a.res = Math.min(this.arms[i].res, a.res + Math.ceil(this.arms[i].mag * 1.5)); }); p.nades = Math.min(4, p.nades + 1); this.feed.push({ t: '+ AMMO', life: 1.2 }); } } }
    this.picks = this.picks.filter((k) => !k.got && k.t < 60);
    // pressure: swarms from out of sight, dropships with troopers
    if (!p.dead && !this.clearT) {
      this.waveT -= dt; this.shipT -= dt;
      const crawlers = this.foes.filter((f) => f.kind === 'crawler' && !f.dead).length;
      if (this.waveT <= 0) {
        this.waveT = (this.mods.swarm ? 15 : 24) * this.r(0.8, 1.2) / (1 + this.sector * 0.08);
        if (crawlers < 70) { const a = p.yaw + Math.PI + this.r(-1.4, 1.4), d = this.r(55, 75), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d, n = Math.round(this.ri(10, 18) * (this.mods.swarm ? 1.7 : 1) * (1 + this.sector * 0.1)); for (let q = 0; q < n; q++) { const e = this.spawn('crawler', x + this.r(-6, 6), z + this.r(-6, 6)); e.awake = true; } this.feed.push({ t: 'SWARM INBOUND', life: 2 }); }
      }
      if (this.shipT <= 0) { this.shipT = this.r(45, 65); this.dropship(); }
    }
    for (const e of this.foes) if (e.dead) e.dead += dt;
    this.foes = this.foes.filter((e) => !e.dead || e.dead < (e.kind === 'tower' ? 6 : e.kind === 'ship' ? 4 : 3));
    if (!this.clearT && !this.foes.some((f) => f.kind === 'tower' && !f.dead)) { this.clearT = 5; this.score += 1000; this.say('SECTOR SECURED', 4.5); }
  }
  stepPlayer(dt) {
    const p = this.p, a = this.arms[p.w], am = this.ammo[p.w], I = this.in;
    p.cool -= dt; p.kick = Math.max(0, p.kick - dt * 4); p.hurt = Math.max(0, p.hurt - dt);
    if (p.swap > 0) p.swap -= dt;
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { const need = a.mag - am.mag, take = Math.min(need, am.res); am.mag += take; am.res -= take; } }
    p.shT -= dt; if (p.shT <= 0 && p.sh < p.shMax) p.sh = Math.min(p.shMax, p.sh + 45 * dt);
    if (p.veh) { const c = p.veh; p.x = c.x; p.z = c.z; p.y = c.y; if (I.fire) this.fire(); return; }
    // walk relative to view
    const sp = 6.6 * (p.zoom ? 0.6 : 1), fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let mx = I.mx, mz = I.mz; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const vx = (fx * mz - fz * mx) * sp, vz = (fz * mz + fx * mx) * sp;
    const ox = p.x, oz = p.z;
    p.x += vx * dt; p.z += vz * dt;
    // steep ground is a wall
    const gh = this.hAt(p.x, p.z);
    if (p.ground && gh - p.y > 0.9) { p.x = ox; p.z = oz; }
    this.collide(p, 0.45, p.y + 0.5);
    const g = this.hAt(p.x, p.z);
    if (I.jump && p.ground) { p.vy = 7.5; p.ground = false; }
    I.jump = false;
    p.vy -= 22 * this.G * dt; p.y += p.vy * dt;
    if (p.y <= g) { if (!p.ground && p.vy < -14) this.hurtPlayer((-p.vy - 14) * 3); p.y = g; p.vy = 0; p.ground = true; }
    else if (p.y - g > 0.35) p.ground = false; else if (p.vy <= 0) { p.y = g; p.ground = true; }
    const moving = Math.hypot(p.x - ox, p.z - oz) / dt;
    p.bob += moving * dt * 1.6;
    if (I.fire && (a.auto || !this.fireHeld)) this.fire();
    this.fireHeld = I.fire;
    if (I.tapShot) { I.tapShot = false; this.fire(); }
  }
  stepCar(c, dt) {
    if (c.dead) { c.dead += dt; if (c.dead < 12 && this.rng() < 0.2) this.smoke(c.x, c.y + 1, c.z, 1, 2); return; }
    c.cool -= dt;
    const drv = c.driver && this.p.veh === c, I = this.in;
    const thr = drv ? clamp(I.mz, -1, 1) : 0, st = drv ? clamp(I.mx, -1, 1) : 0;
    const g = this.hAt(c.x, c.z), air = c.y > g + 0.6;
    if (!air) {
      c.speed += (thr * (thr > 0 ? 27 : 12) - c.speed) * dt * (thr ? 1.4 : 0.9);
      c.steer = lerp(c.steer, st, dt * 6);
      c.yaw -= c.steer * clamp(c.speed / 10, -1, 1) * 1.9 * dt;
    }
    const ox = c.x, oz = c.z;
    c.x += Math.sin(c.yaw) * c.speed * dt; c.z += Math.cos(c.yaw) * c.speed * dt;
    if (this.collide(c, 1.6, c.y + 0.6)) { if (Math.abs(c.speed) > 8) { c.hp -= Math.abs(c.speed) * 0.6; this.shake = 0.4; } c.speed *= -0.3; }
    const ng = this.hAt(c.x, c.z);
    if (!air && ng - g > 1.2 * dt * Math.abs(c.speed) + 0.5) { c.x = ox; c.z = oz; c.speed *= -0.2; }
    c.vy -= 24 * this.G * dt; c.y += c.vy * dt;
    if (c.y < ng + 0.6) { if (c.vy < -12) this.shake = 0.5; c.vy = air ? 0 : Math.max(0, (ng + 0.6 - c.y) / dt * 0.2); c.y = ng + 0.6; }
    else if (!air && ng + 0.6 - c.y < -0.3 && c.speed > 12) c.vy = Math.max(c.vy, 0); // launch off crests
    // tilt from the wheels
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), hf = this.hAt(c.x + fx * 1.8, c.z + fz * 1.8), hb = this.hAt(c.x - fx * 1.8, c.z - fz * 1.8), hl = this.hAt(c.x + fz * 1.1, c.z - fx * 1.1), hr = this.hAt(c.x - fz * 1.1, c.z + fx * 1.1);
    c.pitch = lerp(c.pitch, Math.atan2(hb - hf, 3.6), dt * 8); c.roll = lerp(c.roll, Math.atan2(hl - hr, 2.2), dt * 8);
    c.wheel += c.speed * dt / 0.45;
    if (Math.abs(c.speed) > 7) for (const e of this.foes) if (!e.dead && (e.kind === 'crawler' || e.kind === 'trooper' || e.kind === 'sniper' || e.kind === 'brute') && Math.hypot(e.x - c.x, e.z - c.z) < 2.2 && Math.abs(e.y - c.y) < 2.5) { this.damage(e, Math.abs(c.speed) * (e.kind === 'brute' ? 4 : 10), 'car'); e.vx += fx * c.speed * 0.6; e.vz += fz * c.speed * 0.6; e.vy = 6; }
    if (drv && Math.abs(c.speed) > 10 && this.rng() < 0.3) this.puff(c.x - fx * 2, c.y - 0.4, c.z - fz * 2, this.dustCol, 1, 1.5, 0.8, 0.6);
    if (c.hp <= 0) this.wreck(c);
  }
  dropship() {
    const p = this.p, a = this.r(0, TAU), d = this.r(30, 50);
    const tx = clamp(p.x + Math.sin(a) * d, -110, 110), tz = clamp(p.z + Math.cos(a) * d, -110, 110), from = this.r(0, TAU);
    const e = this.spawn('ship', tx + Math.sin(from) * 260, tz + Math.cos(from) * 260, { tx, tz, phase: 'in', y: 60, drops: this.ri(3, 5) + Math.floor(this.sector / 2), hover: 0 });
    e.awake = true; e.yaw = Math.atan2(tx - e.x, tz - e.z);
    this.feed.push({ t: 'DROPSHIP INBOUND', life: 2.2 });
  }
  stepFoes(dt) {
    const p = this.p, pe = this.eye(), alive = !p.dead;
    const tx = p.veh ? p.veh.x : p.x, tz = p.veh ? p.veh.z : p.z;
    for (const e of this.foes) {
      if (e.dead) { if (e.kind === 'ship') { e.y -= 12 * dt; e.yaw += dt; } continue; }
      e.t += dt; e.cd -= dt; e.hit = Math.max(0, (e.hit || 0) - dt);
      const dx = tx - e.x, dz = tz - e.z, dist = Math.hypot(dx, dz);
      e.losT -= dt;
      if (e.losT <= 0) { e.losT = 0.25 + this.rng() * 0.15; e.los = alive && dist < 220 && this.losTo(e.x, e.y + (e.kind === 'tower' ? 12 : 1.4), e.z, pe.x, pe.y, pe.z); if (!e.awake && e.los && dist < (e.kind === 'crawler' ? 42 : 70)) { e.awake = true; if (e.kind === 'crawler') for (const f of this.foes) if (f.kind === 'crawler' && Math.hypot(f.x - e.x, f.z - e.z) < 14) f.awake = true; } }
      const F = FOES[e.kind];
      if (e.kind === 'tower') {
        e.spin += dt * (e.hit ? 6 : 1.2);
        if (alive && e.cd <= 0 && dist < 210 && e.los) { e.cd = this.r(5, 8); const lx = tx + (p.veh ? Math.sin(p.veh.yaw) * p.veh.speed * 2 : 0), lz = tz + (p.veh ? Math.cos(p.veh.yaw) * p.veh.speed * 2 : 0); const fl = 2.4, sx = e.x, sy = e.y + 15, sz = e.z, gy = this.hAt(lx, lz); this.shots.push({ k: 'mortar', x: sx, y: sy, z: sz, vx: (lx - sx) / fl, vz: (lz - sz) / fl, vy: (gy - sy + 0.5 * 20 * fl * fl) / fl, g: 20, life: 6, dmg: 45, rad: 7, tx: lx, tz: lz }); }
        continue;
      }
      if (e.kind === 'ship') { this.stepShip(e, dt); continue; }
      if (e.kind === 'bike') { this.stepBike(e, dt, dx, dz, dist); continue; }
      // walkers
      let wx = 0, wz = 0;
      const sp = F.speed * (e.kind === 'crawler' ? 1 : 1) * (this.mods.swarm && e.kind === 'crawler' ? 1.1 : 1);
      if (!e.awake) { if (e.kind === 'crawler') { wx = Math.sin(e.t * 0.7 + e.phase) * 0.3; wz = Math.cos(e.t * 0.5 + e.phase) * 0.3; } else if (e.home && !e.perch) { const hx = e.home.x + Math.sin(e.t * 0.2 + e.phase) * 12 - e.x, hz = e.home.z + Math.cos(e.t * 0.17 + e.phase) * 12 - e.z, hl = Math.hypot(hx, hz); if (hl > 1) { wx = hx / hl * 0.35; wz = hz / hl * 0.35; } } }
      else if (e.kind === 'crawler') {
        if (alive) { wx = dx / (dist || 1); wz = dz / (dist || 1); const side = Math.sin(e.t * 3 + e.phase) * 0.5; wx += -wz * side; wz += wx * side; }
        if (alive && dist < 1.6 && Math.abs(e.y - p.y) < 2 && e.cd <= 0) { e.cd = 0.6; this.hurtPlayer(F.melee * (1 + this.sector * 0.1), e.x, e.z); }
        if (alive && dist < 7 && dist > 2.5 && e.y <= this.hAt(e.x, e.z) + 0.05 && this.rng() < dt * 1.5) { e.vy = 6; e.vx += dx / dist * 9; e.vz += dz / dist * 9; }
      } else {
        // troopers keep a fighting distance and strafe; snipers hold their perch
        const want = e.kind === 'brute' ? 9 : e.kind === 'sniper' ? 60 : 20;
        if (alive && !e.perch) {
          const ux = dx / (dist || 1), uz = dz / (dist || 1), side = Math.sin(e.t * 0.9 + e.phase) > 0 ? 1 : -1;
          const toward = dist > want + 6 || !e.los ? 1 : dist < want - 6 ? -0.8 : 0;
          wx = ux * toward + -uz * side * 0.6; wz = uz * toward + ux * side * 0.6;
        }
        if (alive && e.los && e.cd <= 0 && dist < (e.kind === 'sniper' ? 200 : 75)) this.foeShoot(e, dist);
      }
      const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
      e.vx = lerp(e.vx, wx * sp, dt * 4); e.vz = lerp(e.vz, wz * sp, dt * 4);
      // crawlers keep apart a little
      if (e.kind === 'crawler' && (e.t * 60 | 0) % 4 === 0) for (const f of this.foes) { if (f === e || f.kind !== 'crawler' || f.dead) continue; const ax = e.x - f.x, az = e.z - f.z, ad = ax * ax + az * az; if (ad < 1.2 && ad > 1e-4) { e.x += ax * 0.1; e.z += az * 0.1; } }
      const ox = e.x, oz = e.z;
      e.x += e.vx * dt; e.z += e.vz * dt;
      const g = this.hAt(e.x, e.z);
      if (g - e.y > 1.2 && e.y <= g + 0.1) { e.x = ox; e.z = oz; e.phase += 1; }
      if (!e.perch) this.collide(e, F.r * e.sz, e.y + 0.4);
      e.vy -= 22 * this.G * dt; e.y += e.vy * dt;
      const gg = e.perch ? e.y : this.hAt(e.x, e.z);
      if (e.y < gg || e.perch) { e.y = Math.max(e.y, gg); e.vy = 0; }
      if (Math.hypot(e.vx, e.vz) > 0.4) e.yaw = lerp(e.yaw, e.yaw + angTo(e.yaw, Math.atan2(e.vx, e.vz)), dt * 8);
      if (e.awake && e.los && e.kind !== 'crawler' && dist < 90) e.yaw = e.yaw + angTo(e.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      e.phase += Math.hypot(e.vx, e.vz) * dt * 1.8;
    }
  }
  foeShoot(e, dist) {
    const p = this.p, pe = this.eye();
    const ty = (p.veh ? p.veh.y + 1 : pe.y - 0.3);
    if (e.kind === 'sniper') {
      if (!e.aim) { e.aim = 1.6; return; }
      e.aim -= 1 / 120 * 1;
      if (e.aim > 0) return;
      e.aim = 0; e.cd = this.r(3.5, 5.5);
      const moving = Math.hypot(this.in.mx, this.in.mz) > 0.3 || p.veh;
      this.tracer({ x: e.x, y: e.y + 1.6, z: e.z }, { x: pe.x, y: ty, z: pe.z }, [1, 0.3, 0.3], 0.15);
      if (this.rng() < (moving ? 0.45 : 0.85)) this.hurtPlayer(32, e.x, e.z);
      return;
    }
    const brute = e.kind === 'brute', sp = brute ? 26 : 44, lead = dist / sp;
    const vx = p.veh ? Math.sin(p.veh.yaw) * p.veh.speed : 0, vz = p.veh ? Math.cos(p.veh.yaw) * p.veh.speed : 0;
    const ax = pe.x + vx * lead * 0.7 - e.x, ay = ty - (e.y + 1.4 * e.sz), az = pe.z + vz * lead * 0.7 - e.z, L = Math.hypot(ax, ay, az), s = 0.05;
    e.burst = (e.burst || (brute ? 1 : 3)) - 1;
    e.cd = e.burst > 0 ? 0.18 : this.r(1.2, 2.2) / (1 + this.sector * 0.05);
    if (e.burst <= 0) e.burst = 0;
    this.shots.push({ k: brute ? 'fuel' : 'bolt', x: e.x, y: e.y + 1.4 * e.sz, z: e.z, vx: (ax / L + this.r(-s, s)) * sp, vy: (ay / L + this.r(-s, s)) * sp, vz: (az / L + this.r(-s, s)) * sp, life: 3, dmg: brute ? 22 : 7, rad: brute ? 3.5 : 0 });
    e.fire = 0.12;
  }
  stepBike(e, dt, dx, dz, dist) {
    const p = this.p;
    if (!e.awake) { e.yaw += dt * 0.3; } else {
      const a = Math.atan2(-dx, -dz) + (e.orbit > 0 ? 1 : -1) * 0.012 * Math.abs(e.orbit), want = Math.abs(e.orbit);
      const gx = (p.veh ? p.veh.x : p.x) + Math.sin(a) * want, gz = (p.veh ? p.veh.z : p.z) + Math.cos(a) * want;
      const hy = Math.atan2(gx - e.x, gz - e.z), turn = angTo(e.yaw, hy);
      e.yaw += clamp(turn, -1.8 * dt, 1.8 * dt); e.bank = lerp(e.bank || 0, clamp(turn, -0.6, 0.6), dt * 4);
    }
    const sp = e.awake ? FOES.bike.speed : 6;
    e.x += Math.sin(e.yaw) * sp * dt; e.z += Math.cos(e.yaw) * sp * dt;
    if (this.collide(e, 1.4, e.y)) e.yaw += 1.5;
    e.y = lerp(e.y, this.hAt(e.x, e.z) + 1.1 + Math.sin(e.t * 3) * 0.1, dt * 6);
    if (e.awake && e.los && e.cd <= 0 && dist < 60 && Math.abs(angTo(e.yaw, Math.atan2(dx, dz))) < 0.6) {
      e.cd = 0.12; e.burst = (e.burst || 6) - 1; if (e.burst <= 0) { e.burst = 0; e.cd = this.r(1.5, 2.5); }
      const pe = this.eye(), ax = pe.x - e.x, ay = pe.y - 0.4 - e.y, az = pe.z - e.z, L = Math.hypot(ax, ay, az), s = 0.06;
      this.shots.push({ k: 'bolt', x: e.x, y: e.y + 0.4, z: e.z, vx: (ax / L + this.r(-s, s)) * 50, vy: (ay / L + this.r(-s, s)) * 50, vz: (az / L + this.r(-s, s)) * 50, life: 2, dmg: 5 });
    }
    // ram the buggy
    const c = p.veh; if (c && Math.hypot(c.x - e.x, c.z - e.z) < 3 && Math.abs(c.speed) > 8) this.damage(e, 60, 'car');
  }
  stepShip(e, dt) {
    const tgt = e.phase === 'in' ? { x: e.tx, z: e.tz } : null;
    if (e.phase === 'in') {
      const dx = e.tx - e.x, dz = e.tz - e.z, d = Math.hypot(dx, dz);
      const sp = Math.min(38, d * 0.8 + 4); e.x += dx / d * sp * dt; e.z += dz / d * sp * dt;
      e.y = lerp(e.y, this.hAt(e.x, e.z) + (d < 40 ? 14 : 45), dt * 0.8);
      if (d < 2) { e.phase = 'hover'; e.hover = 6; }
    } else if (e.phase === 'hover') {
      e.hover -= dt; e.y = lerp(e.y, this.hAt(e.x, e.z) + 13 + Math.sin(e.t * 2) * 0.4, dt);
      if (e.drops > 0 && e.hover < 5.5 && (e.t * 2 | 0) !== (e.lastDrop | 0)) {
        e.lastDrop = e.t * 2; e.drops--;
        const f = this.spawn(this.rng() < 0.2 ? 'brute' : 'trooper', e.x + this.r(-3, 3), e.z + this.r(-3, 3)); f.y = e.y - 2; f.awake = true;
      }
      if (e.hover <= 0) { e.phase = 'out'; e.ex = e.x + Math.sin(e.yaw) * 300; e.ez = e.z + Math.cos(e.yaw) * 300; }
    } else {
      const dx = e.ex - e.x, dz = e.ez - e.z, d = Math.hypot(dx, dz);
      e.x += dx / d * 40 * dt; e.z += dz / d * 40 * dt; e.y += 10 * dt;
      if (d < 10 || Math.hypot(e.x, e.z) > 320) { e.dead = 10; }
    }
    void tgt;
  }
  stepShots(dt) {
    const p = this.p, pe = this.eye();
    for (const s of this.shots) {
      s.life -= dt; s.vy -= (s.g || 0) * dt;
      const ox = s.x, oy = s.y, oz = s.z;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.k === 'rocket' && this.rng() < 0.6) this.smoke(ox, oy, oz, 1, 0.9);
      let hit = s.y < this.hAt(s.x, s.z);
      const b = this.blocked(s.x, s.z); if (b && s.y < b.top) hit = true;
      if (s.mine) {
        for (const e of this.foes) { if (e.dead) continue; const F = FOES[e.kind], cy = e.y + (e.kind === 'tower' ? 10 : e.kind === 'crawler' ? 0.5 : 1.1); if (Math.hypot(e.x - s.x, (cy - s.y) * (e.kind === 'tower' ? 0.3 : 0.8), e.z - s.z) < F.r * e.sz + 0.6) { hit = true; break; } }
      } else if (!p.dead) {
        const bx = p.veh ? p.veh.x : pe.x, by = p.veh ? p.veh.y + 0.8 : pe.y - 0.6, bz = p.veh ? p.veh.z : pe.z;
        if (Math.hypot(bx - s.x, (by - s.y) * 0.6, bz - s.z) < (p.veh ? 2 : 0.75)) { hit = true; if (!s.rad) this.hurtPlayer(s.dmg, s.x - s.vx, s.z - s.vz); }
      }
      if (hit || s.life <= 0) {
        s.life = 0;
        if (s.rad) this.boom(s.x, s.y, s.z, s.rad, s.dmg, s.k === 'rocket' || s.k === 'mortar', !!s.mine);
        else this.puff(s.x, s.y, s.z, this.boltCol, 4, 2, 0.3, 0.2);
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const n of this.nades) {
      n.t -= dt; n.vy -= 22 * dt;
      n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
      const g = this.hAt(n.x, n.z);
      if (n.y < g + 0.15) { n.y = g + 0.15; n.vy = Math.abs(n.vy) * 0.35; n.vx *= 0.6; n.vz *= 0.6; }
      const b = this.blocked(n.x, n.z); if (b && n.y < b.top) { n.vx *= -0.5; n.vz *= -0.5; n.x += n.vx * dt * 2; n.z += n.vz * dt * 2; }
      if (n.t <= 0) this.boom(n.x, n.y + 0.3, n.z, 7, 120, false, true);
    }
    this.nades = this.nades.filter((n) => n.t > 0);
  }

  // ------------------------------------------------------------------ autopilot
  // the nearest heading to `h` with clear, walkable ground ahead
  freeDir(x, z, h, look, y) {
    for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.1, -2.1]) {
      const a = h + off; let ok = true;
      for (const d of [look * 0.4, look * 0.7, look]) { const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d; if (this.blocked(px, pz, 1.2) || this.hAt(px, pz) - y > d * 0.6 || Math.hypot(px, pz) > 136) { ok = false; break; } }
      if (ok) return a;
    }
    return h + Math.PI;
  }
  autopilot(dt) {
    if (!this.ready) return;
    const p = this.p, I = this.in, A = (this.ai ||= { goal: null, stuck: 0, last: [0, 0], detour: 0, dside: 1, strafe: 1, sT: 0, nadeT: 3, think: 0, tgt: null });
    I.fire = false; I.mx = 0; I.mz = 0;
    if (p.dead > 0) return;
    A.think -= dt;
    const tx = p.x, tz = p.z;
    if (A.think <= 0) {
      A.think = 0.2;
      // threats first (close and visible), then the nearest relay
      let tgt = null, best = 1e9;
      for (const e of this.foes) {
        if (e.dead || (!e.los && e.kind !== 'tower')) continue;
        const d = Math.hypot(e.x - tx, e.z - tz);
        let s = d;
        if (e.kind === 'crawler') s = d * (e.awake ? 0.6 : 3); else if (e.kind === 'tower') s = d * 2.4 + 60; else if (e.kind === 'ship') s = d * 3; else if (e.kind === 'sniper') s = d * 0.9;
        if (d > (e.kind === 'tower' ? 230 : 120)) continue;
        if (e.kind === 'tower' && !e.los) continue;
        if (s < best) { best = s; tgt = e; }
      }
      A.tgt = tgt;
      A.goal = this.foes.filter((f) => f.kind === 'tower' && !f.dead).sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz))[0] || null;
      // weapon choice
      if (!p.veh && tgt) {
        const d = Math.hypot(tgt.x - tx, tgt.z - tz), has = (i) => this.ammo[i].mag + this.ammo[i].res > 0;
        const crowd = this.foes.filter((f) => f.kind === 'crawler' && !f.dead && Math.hypot(f.x - tx, f.z - tz) < 12).length;
        let w = 0;
        if ((tgt.kind === 'tower' || tgt.kind === 'bike' || tgt.kind === 'ship' || tgt.kind === 'brute') && d > 12 && d < 120 && has(2)) w = 2;
        else if (d > 55 && has(1) && tgt.kind !== 'tower') w = 1;
        else if (tgt.kind === 'tower' && has(1) && !has(2)) w = 1;
        else if (crowd >= 3 && has(3)) w = 3;
        else if (!has(0)) w = this.best();
        if (w !== p.w && p.swap <= 0) this.swapTo(w);
        p.zoom = w === 1 && d > 80 && tgt.kind !== 'crawler';
        A.nadeT -= 0.2;
        if (crowd >= 5 && A.nadeT <= 0 && p.nades > 0 && d > 6) { A.nadeT = 5; this.throwNade(); }
      }
    }
    const tgt = A.tgt;
    // aim
    if (tgt) {
      const e = this.eye(), from = p.veh ? { x: p.veh.x, y: p.veh.y + 2.2, z: p.veh.z } : e;
      const ty = tgt.y + (tgt.kind === 'tower' ? 10 : tgt.kind === 'crawler' ? 0.45 : tgt.kind === 'bike' || tgt.kind === 'ship' ? 0 : 1.3 * tgt.sz);
      const d = Math.hypot(tgt.x - from.x, tgt.z - from.z), lead = this.arms[p.w].proj && !p.veh ? d / this.arms[p.w].proj : d / 400;
      const ax = tgt.x + (tgt.vx || 0) * lead - from.x, az = tgt.z + (tgt.vz || 0) * lead - from.z;
      const dropComp = this.arms[p.w].proj && !p.veh ? 0 : 0;
      const wantYaw = Math.atan2(ax, az), wantPitch = Math.atan2(ty - from.y + dropComp, Math.hypot(ax, az));
      const rate = (p.zoom ? 1.6 : 3.2) * dt, jy = angTo(p.yaw, wantYaw), jp = wantPitch - p.pitch;
      p.yaw += clamp(jy, -rate, rate) + Math.sin(this.t * 1.7) * 0.0015; p.pitch += clamp(jp, -rate, rate);
      const err = Math.hypot(jy, jp), tol = p.veh ? 0.06 : p.w === 1 ? 0.012 : p.w === 2 ? 0.05 : Math.max(0.02, 1.2 / Math.max(4, d));
      if (err < tol && (tgt.los || tgt.kind === 'tower') && p.swap <= 0) I.fire = true;
      if (this.ammo[p.w].mag === 0 && !p.veh) this.reload();
    } else if (!p.veh) {
      p.pitch = lerp(p.pitch, 0, dt * 2);
      const am = this.ammo[p.w]; if (am.mag < this.arms[p.w].mag * 0.5) this.reload();
    }
    // move
    const goal = A.goal;
    if (p.veh) {
      const c = p.veh, gx = goal ? goal.x : 0, gz = goal ? goal.z : 0, gd = Math.hypot(gx - c.x, gz - c.z);
      if (!goal || gd < 55 || c.hp < c.max * 0.25) { this.useCar(); return; }
      const hy = this.freeDir(c.x, c.z, Math.atan2(gx - c.x, gz - c.z), 12, c.y), turn = angTo(c.yaw, hy);
      if (A.detour > 0) { A.detour -= dt; I.mz = -1; I.mx = A.dside; }
      else { I.mx = clamp(-turn * 2, -1, 1); I.mz = Math.abs(turn) > 1.6 ? 0.4 : 1; }
      if (!tgt) { p.yaw = p.yaw + angTo(p.yaw, c.yaw) * dt * 3; p.pitch = lerp(p.pitch, -0.05, dt * 2); }
    } else {
      let gx = 0, gz = 0;
      const car = this.cars.find((c) => !c.dead && !c.driver);
      const gd = goal ? Math.hypot(goal.x - tx, goal.z - tz) : 0;
      const busy = tgt && tgt.kind !== 'tower' && Math.hypot(tgt.x - tx, tgt.z - tz) < 45;
      A.noCar = Math.max(0, (A.noCar || 0) - dt);
      if (car && goal && gd > 90 && !busy && !A.noCar && Math.hypot(car.x - tx, car.z - tz) < 45) {
        gx = car.x - tx; gz = car.z - tz;
        if (Math.hypot(gx, gz) < 3.8) { this.useCar(); return; }
      } else if (goal) {
        gx = goal.x - tx; gz = goal.z - tz;
        if (gd < 30) { const ox = gx; gx = -gz * 0.5; gz = ox * 0.5; }
      }
      // fight: strafe and keep distance from swarms
      if (tgt && tgt.kind !== 'tower') {
        const d = Math.hypot(tgt.x - tx, tgt.z - tz), ux = (tgt.x - tx) / (d || 1), uz = (tgt.z - tz) / (d || 1);
        A.sT -= dt; if (A.sT <= 0) { A.sT = this.r(0.8, 2); A.strafe = -A.strafe; }
        const back = tgt.kind === 'crawler' && d < 9 ? -1.2 : tgt.kind === 'brute' && d < 12 ? -0.8 : d > 40 ? 0.6 : 0;
        gx = gx * 0.25 + ux * back * 10 - uz * A.strafe * 8; gz = gz * 0.25 + uz * back * 10 + ux * A.strafe * 8;
        if (this.rng() < dt * 0.4) I.jump = true;
      }
      if (A.detour > 0) { A.detour -= dt; const a = Math.atan2(gx, gz) + 1.4 * A.dside; gx = Math.sin(a) * 10; gz = Math.cos(a) * 10; }
      else if (Math.hypot(gx, gz) > 0.5) { const a = this.freeDir(tx, tz, Math.atan2(gx, gz), 6, p.y), l = Math.hypot(gx, gz); gx = Math.sin(a) * l; gz = Math.cos(a) * l; }
      // obstacles push the walk aside
      for (const o of this.near(tx, tz)) { const cx = o.r ? o.x : clamp(tx, o.x - o.w / 2, o.x + o.w / 2), cz = o.r ? o.z : clamp(tz, o.z - o.d / 2, o.z + o.d / 2), ox = tx - cx, oz = tz - cz, d = Math.hypot(ox, oz) - (o.r || 0); if (d < 3 && d > 0.01) { gx += ox / (d + 0.3) * 6; gz += oz / (d + 0.3) * 6; } }
      const gl = Math.hypot(gx, gz);
      if (gl > 0.5) {
        const wx = gx / gl, wz = gz / gl, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
        I.mz = wx * fx + wz * fz; I.mx = wx * fz - wz * fx;
        I.mx = -I.mx;
        if (!tgt) p.yaw = p.yaw + angTo(p.yaw, Math.atan2(wx, wz)) * Math.min(1, dt * 3);
      }
    }
    // unstick
    const mv = Math.hypot(p.x - A.last[0], p.z - A.last[1]);
    A.stuck = mv < (p.veh ? 0.03 : 0.02) && (I.mx || I.mz) && A.detour <= 0 ? A.stuck + dt : Math.max(0, A.stuck - dt * 0.5);
    A.last = [p.x, p.z];
    if (A.stuck > 0.8) { A.stuck = 0; A.detour = p.veh ? 1.2 : 1.6; A.dside = this.rng() < 0.5 ? 1 : -1; I.jump = true; A.carFails = (A.carFails || 0) + (p.veh ? 1 : 0); if (A.carFails > 4 && p.veh) { this.useCar(); A.noCar = 20; } }
  }

  // ------------------------------------------------------------------ input
  btns() {
    const p = this.p, near = !p.veh && this.carNear();
    const b = [{ k: 'fire', x: 306, y: 338, r: 34, l: '●' }, { k: 'jump', x: 252, y: 386, r: 19, l: '⤒' }, { k: 'swap', x: 330, y: 266, r: 18, l: '⇄' }, { k: 'nade', x: 286, y: 270, r: 17, l: '✸' }];
    if (this.arms[p.w].zoom && !p.veh) b.push({ k: 'zoom', x: 246, y: 300, r: 17, l: '◎' });
    if (near || p.veh) b.push({ k: 'car', x: 188, y: 372, r: 20, l: p.veh ? 'OUT' : 'DRIVE' });
    return b;
  }
  down(x, y, id) {
    if (!this.ready) return;
    const p = this.p, b = this.btns().find((q) => Math.hypot(q.x - x, q.y - y) < q.r + 6);
    if (b) {
      if (b.k === 'fire') { this.touch.fire = id ?? 'm'; this.in.fire = true; if (!this.arms[p.w].auto) this.in.tapShot = true; }
      else if (b.k === 'jump') this.in.jump = true;
      else if (b.k === 'swap') this.swapTo((p.w + 1) % 4);
      else if (b.k === 'nade') this.throwNade();
      else if (b.k === 'zoom') p.zoom = !p.zoom;
      else if (b.k === 'car') this.useCar();
      return;
    }
    if (x < 170 && y > 230) this.touch.stick = { id, ox: x, oy: y, x, y };
    else this.touch.look = { id, x, y, t: this.t, moved: 0 };
  }
  move(x, y, id) {
    const S = this.touch.stick, L = this.touch.look;
    if (S && S.id === id) { S.x = x; S.y = y; this.in.mx = clamp((x - S.ox) / 40, -1, 1); this.in.mz = clamp(-(y - S.oy) / 40, -1, 1); return; }
    if (L && L.id === id) {
      const z = this.p.zoom ? 0.3 : 1, dx = x - L.x, dy = y - L.y;
      this.p.yaw -= dx * 0.011 * z; this.p.pitch = clamp(this.p.pitch - dy * 0.009 * z, -1.25, 1.25);
      L.x = x; L.y = y; L.moved += Math.abs(dx) + Math.abs(dy);
    }
  }
  up(x, y, id) {
    if (this.touch.fire !== null && (this.touch.fire === id || id === undefined)) { this.touch.fire = null; this.in.fire = false; }
    const S = this.touch.stick, L = this.touch.look;
    if (S && (S.id === id || id === undefined)) { this.touch.stick = null; this.in.mx = 0; this.in.mz = 0; }
    if (L && (L.id === id || id === undefined)) { if (L.moved < 8 && this.t - L.t < 0.3) this.in.tapShot = true; this.touch.look = null; }
  }
  setAuto(a) { super.setAuto(a); this.in = { mx: 0, mz: 0, fire: false, jump: false }; this.touch = { stick: null, look: null, fire: null }; if (this.p) this.p.zoom = false; }

  // ------------------------------------------------------------------ GPU side
  start() {
    const i = live.indexOf(this); if (i >= 0) live.splice(i, 1); live.push(this);
    while (live.length > 2) { const old = live.find((g) => g !== this && !g.running) || null; if (!old) break; old.dropGpu(); }
    super.start();
  }
  dropGpu(lost = false) {
    const i = live.indexOf(this); if (i >= 0) live.splice(i, 1);
    const gl = this.gl; this.gl = null;
    if (!gl || lost) return;
    const seen = new Set();
    const free = (o) => { if (!o || seen.has(o)) return; seen.add(o); o.dispose?.(); };
    for (const sc of [gl.scene, gl.vm]) sc.traverse((o) => { free(o.geometry); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (!m) continue; free(m.map); free(m.emissiveMap); free(m); } });
    for (const t of gl.textures) free(t);
    for (const e of this.foes || []) e.m = null;
    for (const c of this.cars || []) c.m = null;
    for (const k of this.picks || []) k.m = null;
    for (const n of this.nades || []) n.m = null;
  }
  colour(hex, dl = 0) { const c = new T.Color(hex); c.offsetHSL(this.hueShift, 0, dl); return c; }
  // the run's material kit: one noise, one weathered photo, one palette, one dither
  paintKit() {
    const R = this.vr, B = this.B;
    const noise = noiseMap(R, 64, 4, 4), grime = noiseMap(R, 64, 3, 2);
    const photoSrc = this.skin.texFor?.(61) || this.skin.slots.tile[0];
    const accent = new T.Color(this.pal.c[0]), accent2 = new T.Color(this.pal.c[2] || this.pal.c[1]);
    const team = new T.Color(this.pal.c[1]).offsetHSL(0, 0.1, -0.05);
    const ground = B.grass.map((h) => this.colour(h)), rock = B.rock.map((h) => this.colour(h));
    const mid = (c) => [c[0], c[1], c[2]];
    const tones = {
      bark: [this.colour('#2a1f16'), this.colour('#4a3626'), this.colour('#6e5440')], leaf: mid(B.grass.map((h, i) => this.colour(h, i === 2 ? 0.05 : 0))), rock,
      metal: [this.colour('#2c3036'), this.colour('#56606a'), this.colour('#8d97a0')], rust: [this.colour('#3a1e12'), this.colour('#7a3d1e'), this.colour('#b0683a')],
      crate: [this.colour('#2a2a2a'), new T.Color(this.pal.c[3] || '#777').multiplyScalar(0.8), new T.Color(this.pal.c[3] || '#aaa')], armor: [team.clone().multiplyScalar(0.35), team, team.clone().offsetHSL(0, 0, 0.18)],
      dark: [this.colour('#0d0d10'), this.colour('#1e1f24'), this.colour('#34363d')], glow: [new T.Color('#ffffff'), new T.Color('#ffffff'), new T.Color('#ffffff')],
      rubber: [this.colour('#0b0b0b'), this.colour('#1a1a1a'), this.colour('#2e2e2e')], concrete: [this.colour('#3e3c3a'), this.colour('#6a6763'), this.colour('#97938c')],
      paint: [accent.clone().multiplyScalar(0.3), accent.clone().multiplyScalar(0.75), accent], wood: [this.colour('#2e2012'), this.colour('#5e4228'), this.colour('#8e6a44')],
      skin: [accent2.clone().multiplyScalar(0.3), accent2.clone().multiplyScalar(0.7), accent2], glass: [this.colour('#05070a'), this.colour('#1a2a36'), this.colour('#3c5a6e')], plain: [new T.Color('#6e6e6e'), new T.Color('#b4b4b4'), new T.Color('#f0f0f0')]
    };
    const ramp = (t, c) => { const [a, b, d] = c; return t < 0.5 ? a.clone().lerp(b, t * 2) : b.clone().lerp(d, (t - 0.5) * 2); };
    const textures = [];
    const tex = (cv) => { const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; textures.push(t); return t; };
    const mipTex = (cv, rep) => { const t = tex(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.minFilter = T.NearestMipmapLinearFilter; t.generateMipmaps = true; if (rep) t.repeat.set(rep, rep); return t; };
    // L(x, y) for a material
    const field = (kind, x, y, ph) => {
      const i = (y & 63) * 64 + (x & 63), n = noise[i], g = grime[i];
      let L = n * 0.55 + (ph ? ph[i] : 0.5) * 0.45;
      switch (kind) {
        case 'bark': L = L * 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(x * 0.9 + n * 7)); break;
        case 'leaf': L = (n > 0.62 ? 0.25 : L) * 0.8 + ((x * 7 + y * 13) % 11 < 2 ? 0.2 : 0); break;
        case 'rock': L = Math.pow(L, 1.4) + 0.12 * Math.sin(y * 0.6 + n * 5); break;
        case 'metal': case 'armor': L = L * 0.6 + 0.3 - ((x % 32 === 0 || y % 32 === 0) ? 0.3 : 0) + ((x % 32 === 3 && y % 8 === 3) ? 0.3 : 0); if (g > 0.68 && kind === 'metal') L -= (g - 0.68) * 1.5 * (1 - (y % 64) / 90); break;
        case 'rust': L = L * 0.9 + (g > 0.6 ? 0.15 : -0.05); break;
        case 'plain': L = L * 0.5 + 0.3 + (g > 0.65 ? -0.15 : 0); break;
        case 'crate': L = L * 0.4 + 0.45 + (x % 4 < 2 ? 0.12 : -0.08) - (y < 3 || y > 60 ? 0.3 : 0); break;
        case 'rubber': L = L * 0.4 + (y % 8 < 2 ? 0.4 : 0.2); break;
        case 'concrete': L = L * 0.7 + 0.2 - (y % 16 === 0 ? 0.2 : 0); break;
        case 'wood': L = L * 0.5 + 0.35 + 0.15 * Math.sin(y * 0.35 + n * 4) - (x % 16 === 0 ? 0.25 : 0); break;
        case 'skin': L = L * 0.7 + 0.15 + ((x + y * 3) % 9 < 1 ? 0.25 : 0); break;
        case 'glass': L = 0.3 + n * 0.3 + ((x + y) % 23 < 2 ? 0.5 : 0); break;
        case 'glow': L = 1; break;
        default: break;
      }
      return clamp(L - (g > 0.72 ? (g - 0.72) * 1.2 : 0), 0, 1);
    };
    const dither = (d, i, x, y, c) => { const b = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.09; d[i] = clamp(Math.round((c.r + b) * 7) / 7, 0, 1) * 255; d[i + 1] = clamp(Math.round((c.g + b) * 7) / 7, 0, 1) * 255; d[i + 2] = clamp(Math.round((c.b + b) * 7) / 7, 0, 1) * 255; d[i + 3] = 255; };
    // atlas
    const atlas = document.createElement('canvas'); atlas.width = atlas.height = 256;
    const ground64 = document.createElement('canvas'); ground64.width = ground64.height = 64;
    const facade = document.createElement('canvas'); facade.width = 64; facade.height = 64;
    const lit = document.createElement('canvas'); lit.width = 64; lit.height = 64;
    const neon = B.night ? ['#ff2bd6', '#2bf0ff', '#ffd12b', '#8b5bff'].map((h) => this.colour(h)) : [accent, accent2, new T.Color('#ffd27a'), new T.Color('#fff')];
    this.neon = neon;
    const paint = () => {
      const ph0 = imagePixels(photoSrc, 64, 64), ph = ph0 ? Float32Array.from({ length: 4096 }, (_, i) => (ph0[i * 4] * 0.3 + ph0[i * 4 + 1] * 0.55 + ph0[i * 4 + 2] * 0.15) / 255) : null;
      const ax = atlas.getContext('2d'), img = ax.createImageData(256, 256), d = img.data;
      for (const [name, k] of Object.entries(TILE)) {
        const tx = (k % 4) * 64, ty = Math.floor(k / 4) * 64, tn = tones[name];
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) dither(d, ((ty + y) * 256 + tx + x) * 4, x, y, ramp(field(name, x, y, ph), tn));
      }
      ax.putImageData(img, 0, 0);
      // terrain detail (neutral, tinted by vertex colours)
      const gx = ground64.getContext('2d'), gi = gx.createImageData(64, 64), gd = gi.data, grey = [new T.Color('#8a8a8a'), new T.Color('#c4c4c4'), new T.Color('#ffffff')];
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) dither(gd, (y * 64 + x) * 4, x, y, ramp(field(this.biomeKey === 'city' ? 'concrete' : 'ground', x, y, ph), grey));
      gx.putImageData(gi, 0, 0);
      // facade: four floors of windows; lit windows on their own map
      const fx = facade.getContext('2d'), fi = fx.createImageData(64, 64), fd = fi.data, lx = lit.getContext('2d'), li = lx.createImageData(64, 64), ld = li.data;
      const wallT = tones.concrete, glassT = tones.glass, Rw = (a) => ((a * 2654435761) >>> 0) / 4294967296;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const win = x % 16 > 2 && x % 16 < 14 && y % 16 > 3 && y % 16 < 13, i = (y * 64 + x) * 4, wid = Math.floor(x / 16) + Math.floor(y / 16) * 4;
        dither(fd, i, x, y, win ? ramp(field('glass', x, y, ph), glassT) : ramp(field('concrete', x, y, ph), wallT));
        const on = win && Rw(wid + 7) < (B.night ? 0.45 : 0.08), c = on ? neon[Math.floor(Rw(wid + 3) * 2) + 2].clone().lerp(new T.Color('#ffe9b0'), 0.6).multiplyScalar(0.7 + Rw(wid) * 0.3) : new T.Color(0, 0, 0);
        ld[i] = c.r * 255; ld[i + 1] = c.g * 255; ld[i + 2] = c.b * 255; ld[i + 3] = 255;
      }
      fx.putImageData(fi, 0, 0); lx.putImageData(li, 0, 0);
      for (const t of textures) t.needsUpdate = true;
    };
    paint();
    if (photoSrc && !ready(photoSrc)) photoSrc.addEventListener?.('load', paint, { once: true });
    return { atlas: tex(atlas), ground: mipTex(ground64, 80), facade: mipTex(facade), lit: mipTex(lit), textures, groundCols: ground, rockCols: rock };
  }
  buildGpu() {
    this.vr = mulberry32(((this.post.seed || 1) * 7919 + this.sector * 104729) >>> 0);
    this.vrr = (a, b) => a + this.vr() * (b - a);
    if (!live.includes(this)) live.push(this);
    const B = this.B, sc = new T.Scene();
    const kit = this.paintKit();
    const gl = { scene: sc, textures: kit.textures, kit };
    this.gl = gl;
    const fogC = this.colour(B.fog);
    sc.fog = new T.Fog(fogC, B.fogD[0], B.fogD[1]);
    sc.background = fogC;
    const cam = new T.PerspectiveCamera(72, RW / RH, 0.1, 900); gl.cam = cam;
    sc.add(new T.HemisphereLight(this.colour(B.hemi[0]), this.colour(B.hemi[1]), B.hemi[2]));
    const sun = new T.DirectionalLight(new T.Color(B.sun), B.sunI); sun.position.set(0.5, 0.8, 0.3); sc.add(sun);
    gl.solid = new T.MeshLambertMaterial({ map: kit.atlas, vertexColors: true });
    gl.glow = new T.MeshBasicMaterial({ map: kit.atlas, vertexColors: true, fog: true });
    gl.glowAdd = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    this.buildSky(gl);
    this.buildTerrain(gl);
    this.buildProps(gl);
    this.buildPools(gl);
    // first-person weapon in its own scene so it never clips into the world
    gl.vm = new T.Scene(); gl.vmCam = new T.PerspectiveCamera(54, RW / RH, 0.01, 10);
    gl.vm.add(new T.HemisphereLight(this.colour(B.hemi[0]), this.colour(B.hemi[1]), B.hemi[2] * 1.1));
    const s2 = new T.DirectionalLight(new T.Color(B.sun), B.sunI * 0.8); s2.position.set(0.3, 1, 0.6); gl.vm.add(s2);
    gl.guns = this.arms.map((a) => this.gunModel(a.k, gl)); for (const g of gl.guns) { g.visible = false; gl.vm.add(g); }
    gl.flash = new T.Mesh(new T.PlaneGeometry(0.35, 0.35), new T.MeshBasicMaterial({ color: '#ffd28a', transparent: true, blending: T.AdditiveBlending, depthWrite: false })); gl.vm.add(gl.flash);
    // reusable dynamic bits
    gl.tmpM = new T.Matrix4(); gl.tmpQ = new T.Quaternion(); gl.tmpE = new T.Euler(); gl.tmpV = new T.Vector3(); gl.tmpS = new T.Vector3();
  }
  buildSky(gl) {
    const B = this.B, geo = new T.SphereGeometry(800, 16, 12), col = [], top = this.colour(B.sky[0]), hor = this.colour(B.sky[1]), fog = this.colour(B.fog);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i) / 800, c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(fog, Math.min(1, -y * 4)); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    gl.sky = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
    gl.sky.renderOrder = -2; gl.scene.add(gl.sky);
    // sun or moon
    const disc = new T.Mesh(new T.CircleGeometry(B.night ? 26 : 34, 20), new T.MeshBasicMaterial({ color: B.night ? '#e8e6ff' : '#fff6dc', fog: false, transparent: true, opacity: B.night ? 0.9 : 0.85, depthWrite: false }));
    disc.position.set(0.5, 0.55, 0.3).normalize().multiplyScalar(700); disc.lookAt(0, 0, 0); disc.renderOrder = -1; gl.sky.add(disc);
    // stars, or distant cloud streaks
    const pts = [], pc = [];
    for (let i = 0; i < (B.night ? 500 : 120); i++) { const a = this.vrr(0, TAU), y = this.vrr(B.night ? 0.05 : 0.15, B.night ? 1 : 0.45), r = Math.sqrt(1 - y * y); pts.push(Math.cos(a) * r * 760, y * 760, Math.sin(a) * r * 760); const b = B.night ? this.vrr(0.4, 1) : this.vrr(0.75, 1); pc.push(b, b, b); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(pc, 3));
    gl.sky.add(new T.Points(sg, new T.PointsMaterial({ size: B.night ? 2 : 26, sizeAttenuation: !B.night, vertexColors: true, fog: false, transparent: true, opacity: B.night ? 1 : 0.35, depthWrite: false })));
  }
  buildTerrain(gl) {
    const N = this.N, S = this.SIZE, geo = new T.PlaneGeometry(S, S, N - 1, N - 1);
    geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); P.setY(i, this.hAt(x, z)); }
    geo.computeVertexNormals();
    const Nn = geo.attributes.normal, col = [], gc = gl.kit.groundCols, rc = gl.kit.rockCols, c = new T.Color();
    const roads = this.biomeKey === 'city';
    for (let i = 0; i < P.count; i++) {
      const ny = Nn.getY(i), x = P.getX(i), z = P.getZ(i), y = P.getY(i), n = (Math.sin(x * 0.13) + Math.cos(z * 0.11)) * 0.25 + 0.5;
      const steep = clamp((0.9 - ny) * 4, 0, 1);
      c.copy(gc[0]).lerp(gc[1], n).lerp(gc[2], clamp(y / 30, 0, 0.5)).lerp(rc[1], steep);
      if (roads) { const m = (v) => Math.abs(((v + 19) % 38 + 38) % 38 - 19); if (m(x) < 5.5 || m(z) < 5.5) c.multiplyScalar(0.55); }
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const t = new T.Mesh(geo, new T.MeshLambertMaterial({ map: gl.kit.ground, vertexColors: true }));
    gl.scene.add(t);
  }
  inst(geo, mat, list, place, opt = {}) {
    if (!list.length) return null;
    const m = new T.InstancedMesh(geo, mat, list.length), M4 = new T.Matrix4(), c = new T.Color();
    list.forEach((it, i) => { m.setMatrixAt(i, place(it, M4)); if (opt.col) m.setColorAt(i, opt.col(it, c)); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere(); this.gl.scene.add(m); return m;
  }
  buildProps(gl) {
    const P = this.props, sol = gl.solid, k = this.biomeKey;
    const at = (x, y, z, ry, s = 1, sy = s) => MAT(x, y, z, 0, ry, 0, s, sy, s);
    // trees: conifer and broadleaf
    const conifer = merge([[CYL(6, 0.7), MAT(0, 1.5, 0, 0, 0, 0, 0.5, 3, 0.5), null, TILE.bark], [CONE(7), MAT(0, 5.2, 0, 0, 0, 0, 4.6, 6.5, 4.6), null, TILE.leaf], [CONE(7), MAT(0, 8.3, 0, 0, 0.4, 0, 3.2, 4.6, 3.2), null, TILE.leaf]]);
    const broad = merge(P.trees2[0]?.dead ? [[CYL(5, 0.5), MAT(0, 2.2, 0, 0, 0, 0, 0.45, 4.4, 0.45), null, TILE.bark], [CYL(4, 0.4), MAT(0.6, 3.6, 0, 0, 0, -0.7, 0.22, 2.2, 0.22), null, TILE.bark], [CYL(4, 0.4), MAT(-0.5, 4.0, 0.2, 0.3, 0, 0.8, 0.2, 1.8, 0.2), null, TILE.bark]]
      : [[CYL(6, 0.7), MAT(0, 2, 0, 0, 0, 0, 0.6, 4, 0.6), null, TILE.bark], [ICO(), MAT(0, 6, 0, 0, 0, 0, 6, 5, 6), null, TILE.leaf], [ICO(), MAT(1.4, 5, 0.6, 0.5, 0, 0, 3.6, 3.2, 3.6), null, TILE.leaf], [ICO(), MAT(-1.2, 5.4, -0.8, 0, 0.6, 0, 3.8, 3.4, 3.8), null, TILE.leaf]]);
    this.inst(conifer, sol, P.trees, (t, M) => M.copy(at(t.x, t.y - 0.3, t.z, t.rot, t.s)));
    this.inst(broad, sol, P.trees2, (t, M) => M.copy(at(t.x, t.y - 0.3, t.z, t.rot, t.s)));
    const rock = merge([[new T.DodecahedronGeometry(0.6, 0), MAT(0, 0.25, 0, 0, 0, 0, 1, 0.75, 1.1), null, TILE.rock]]);
    this.inst(rock, sol, P.rocks, (t, M) => M.copy(MAT(t.x, t.y, t.z, t.rot * 0.3, t.rot, 0, t.s, t.s * 0.8, t.s)));
    // junkyard
    const cont = merge([[BOX(), MAT(0, 1.3, 0, 0, 0, 0, 6, 2.6, 2.4), null, TILE.plain], [BOX(), MAT(3.01, 1.3, 0, 0, 0, 0, 0.05, 2.5, 2.3), '#999', TILE.metal]]);
    const contCols = ['#9b3d2a', '#2d4f7f', '#5d6f4a', '#c86a1e', '#6b6b6b', '#7a1f2b'].map((h) => this.colour(h));
    this.inst(cont, sol, P.containers, (t, M) => M.copy(at(t.x, t.y, t.z, t.rot)), { col: (t, c) => c.copy(contCols[t.c]) });
    const car = merge([[BOX(), MAT(0, 0.65, 0, 0, 0, 0, 1.9, 0.8, 4.3), null, TILE.plain], [BOX(), MAT(0, 1.3, -0.3, 0, 0, 0, 1.7, 0.6, 2.1), null, TILE.glass], [CYL(8), MAT(0.9, 0.38, 1.3, 0, 0, Math.PI / 2, 0.75, 0.25, 0.75), null, TILE.rubber], [CYL(8), MAT(-0.9, 0.38, 1.3, 0, 0, Math.PI / 2, 0.75, 0.25, 0.75), null, TILE.rubber], [CYL(8), MAT(0.9, 0.38, -1.3, 0, 0, Math.PI / 2, 0.75, 0.25, 0.75), null, TILE.rubber], [CYL(8), MAT(-0.9, 0.38, -1.3, 0, 0, Math.PI / 2, 0.75, 0.25, 0.75), null, TILE.rubber]]);
    const carCols = ['#7a2a1e', '#2a3a5a', '#6a6a60', '#3a5a3a', '#8a7a3a', '#5a2a4a'].map((h) => this.colour(h));
    this.inst(car, sol, P.cars, (t, M) => M.copy(MAT(t.x, t.y + (t.flip ? 1.6 : 0), t.z, t.flip ? Math.PI : 0, t.rot, 0)), { col: (t, c) => c.copy(carCols[t.c]).multiplyScalar(k === 'junk' ? 0.7 : 1.1) });
    const tire = merge([[new T.TorusGeometry(0.42, 0.18, 5, 10), MAT(0, 0.2, 0, Math.PI / 2, 0, 0), null, TILE.rubber]]);
    this.inst(tire, sol, P.tires, (t, M) => M.copy(at(t.x, t.y, t.z, 0)));
    if (P.scrap.length) {
      const parts = [];
      for (const s of P.scrap) { let r = s.seed * 1e4; const rr = () => ((r = (r * 9301 + 49297) % 233280) / 233280); for (let q = 0; q < 14; q++) { const a = rr() * TAU, d = rr() * s.s * 0.5, hh = (1 - d / (s.s * 0.5)) * s.s * 0.55 * rr(); parts.push([rr() < 0.5 ? BOX() : CYL(6), MAT(s.x + Math.cos(a) * d, s.y + hh, s.z + Math.sin(a) * d, rr() * 3, rr() * 3, rr() * 3, 0.6 + rr() * 2.4, 0.4 + rr() * 1.4, 0.6 + rr() * 2), null, [TILE.rust, TILE.metal, TILE.paint, TILE.rust][q % 4]]); } parts.push([CONE(7), MAT(s.x, s.y + s.s * 0.2, s.z, 0, 0, 0, s.s * 1.1, s.s * 0.5, s.s * 1.1), null, TILE.rust]); }
      gl.scene.add(new T.Mesh(merge(parts), sol));
    }
    for (const r of P.ruins) {
      if (r.crane) {
        const g = merge([[BOX(), MAT(0, 14, 0, 0, 0, 0, 1.6, 28, 1.6), null, TILE.paint], [BOX(), MAT(0, 27.5, 7, 0, 0, 0, 1.2, 1.2, 22), null, TILE.paint], [BOX(), MAT(0, 26, -4, 0, 0, 0, 2.2, 2.2, 3), null, TILE.concrete], [BOX(), MAT(0, 27, 1, 0, 0, 0, 2.4, 2, 2.4), null, TILE.glass], [CYL(4), MAT(0, 20, 16, 0, 0, 0, 0.05, 14, 0.05), '#222', TILE.dark], [BOX(), MAT(0, 12.6, 16, 0, 0, 0, 2, 0.6, 2), null, TILE.metal]]);
        const m = new T.Mesh(g, sol); m.position.set(r.x, r.y, r.z); m.rotation.y = r.rot; gl.scene.add(m);
      } else {
        const m = new T.Mesh(merge([[BOX(), MAT(0, r.h / 2, 0, 0, 0, 0, r.w, r.h, r.d), null, TILE.concrete], [BOX(), MAT(r.w * 0.3, r.h + 0.6, 0, 0, 0, 0.3, r.w * 0.25, 1.2, r.d), null, TILE.concrete]]), sol);
        m.position.set(r.x, r.y - 0.2, r.z); m.rotation.y = r.rot; gl.scene.add(m);
      }
    }
    if (P.spires.length) gl.scene.add(new T.Mesh(merge(P.spires.flatMap((s) => [[CYL(7, 0.65), MAT(s.x, s.y + s.h * 0.35, s.z, 0, s.rot, 0, s.s * 2.2, s.h * 0.7, s.s * 2.2), null, TILE.rock], [CYL(6, 0.5), MAT(s.x + 0.3, s.y + s.h * 0.82, s.z, 0.05, s.rot, 0, s.s * 1.5, s.h * 0.36, s.s * 1.5), null, TILE.rock], [CYL(6, 1.3), MAT(s.x + 0.3, s.y + s.h * 1.02, s.z, 0, s.rot, 0, s.s * 1.8, 0.8, s.s * 1.8), null, TILE.rock]])), sol));
    // city
    if (P.buildings.length) this.buildCity(gl);
  }
  buildCity(gl) {
    const P = this.props, pos = [], uv = [], nor = [], col = [];
    const tint = ['#a8a4b4', '#8a94a8', '#b4a494', '#9aa89a'].map((h) => this.colour(h));
    const quad = (a, b, c, d, n, u0, v0, u1, v1, cc) => {
      for (const [p, u, v] of [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]]) { pos.push(...p); uv.push(u, v); nor.push(...n); col.push(cc.r, cc.g, cc.b); }
    };
    for (const b of P.buildings) {
      const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, y0 = -1, y1 = b.h, c = tint[b.c], fw = 8, fh = 12;
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], 0, 0, b.w / fw, b.h / fh, c);
      quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], 0, 0, b.w / fw, b.h / fh, c);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], 0, 0, b.d / fw, b.h / fh, c);
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], 0, 0, b.d / fw, b.h / fh, c);
      quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 0.01, 0.01, 0.03, 0.03, c.clone().multiplyScalar(0.6));
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    gl.scene.add(new T.Mesh(g, new T.MeshLambertMaterial({ map: gl.kit.facade, vertexColors: true, emissive: '#ffffff', emissiveMap: gl.kit.lit, emissiveIntensity: this.B.night ? 1 : 0.15 })));
    // neon signs, roof gear, street lamps
    const parts = [], glow = [];
    for (const s of P.signs) {
      const c = this.neon[s.c];
      if (s.side) glow.push([BOX(), MAT(s.x, s.y + s.h / 2, s.z, 0, 0, 0, 0.25, s.h, 1.1), c, TILE.glow]);
      else glow.push([BOX(), MAT(s.x, s.y, s.z, 0, 0, 0, s.w, s.h, 0.2), c, TILE.glow]);
    }
    for (const b of P.buildings) if (b.h > 14) { parts.push([BOX(), MAT(b.x + b.w * 0.2, b.h + 1, b.z - b.d * 0.15, 0, 0, 0, 3, 2, 3), null, TILE.metal]); if (b.h > 40) glow.push([BOX(), MAT(b.x, b.h + 4, b.z, 0, 0, 0, 0.3, 8, 0.3), this.neon[(b.c + 1) % 4], TILE.glow]); }
    for (const l of P.lamps) { parts.push([CYL(5), MAT(l.x, 3.5, l.z, 0, 0, 0, 0.18, 7, 0.18), null, TILE.dark]); glow.push([BOX(), MAT(l.x, 7.1, l.z, 0, 0, 0, 0.6, 0.25, 0.6), new T.Color('#ffe2a8'), TILE.glow]); }
    if (parts.length) gl.scene.add(new T.Mesh(merge(parts), gl.solid));
    if (glow.length) gl.scene.add(new T.Mesh(merge(glow), gl.glow));
    // traffic in the sky lanes
    const car = merge([[BOX(), MAT(0, 0, 0, 0, 0, 0, 1.6, 0.7, 3.4), null, TILE.dark], [BOX(), MAT(0, 0, -1.72, 0, 0, 0, 1.4, 0.25, 0.05), '#ff3040', TILE.glow], [BOX(), MAT(0, 0, 1.72, 0, 0, 0, 1.4, 0.25, 0.05), '#fff2c0', TILE.glow]]);
    gl.traffic = Array.from({ length: 16 }, (_, i) => ({ lane: (i % 8) - 4, ax: i % 2, y: 28 + (i % 4) * 9, s: this.vrr(-1, 1) * 30 + (i % 2 ? 18 : -18), o: this.vrr(-150, 150) }));
    gl.trafficMesh = new T.InstancedMesh(car, gl.glow, gl.traffic.length); gl.trafficMesh.frustumCulled = false; gl.scene.add(gl.trafficMesh);
    // holo billboards from the theme's pictures
    gl.holos = [];
    const pics = [this.skin.pick('holo0', 'item', 'enemy'), this.skin.pick('holo1', 'enemy', 'item'), this.skin.pick('holo2', 'hero', 'item')];
    const tall = P.buildings.filter((b) => b.h > 24).slice(0, 3);
    tall.forEach((b, i) => {
      const px = imagePixels(pics[i], 64, 64); if (!px) return;
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), id = x.createImageData(64, 64), c = this.neon[i % 4];
      for (let q = 0; q < 4096; q++) { const L = (px[q * 4] + px[q * 4 + 1] + px[q * 4 + 2]) / 765, a = px[q * 4 + 3] / 255, scan = (Math.floor(q / 64) % 3 === 0) ? 0.5 : 1; id.data[q * 4] = c.r * 255 * L * scan * a; id.data[q * 4 + 1] = c.g * 255 * L * scan * a; id.data[q * 4 + 2] = c.b * 255 * L * scan * a; id.data[q * 4 + 3] = 255; }
      x.putImageData(id, 0, 0);
      const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; gl.textures.push(t);
      const m = new T.Mesh(new T.PlaneGeometry(12, 12), new T.MeshBasicMaterial({ map: t, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
      m.position.set(b.x, b.h + 9, b.z); gl.scene.add(m); gl.holos.push(m);
    });
  }
  buildPools(gl) {
    const sol = gl.solid, team = null;
    void team;
    // crawlers share one instanced mesh
    const crawler = merge([[ICO(), MAT(0, 0.45, 0, 0, 0, 0, 1.1, 0.7, 1.6), null, TILE.skin], [ICO(), MAT(0, 0.55, 0.75, 0, 0, 0, 0.7, 0.55, 0.7), null, TILE.skin], [CONE(4), MAT(0.2, 0.5, 1.15, Math.PI / 2, 0, 0, 0.12, 0.45, 0.12), '#eee', TILE.metal], [CONE(4), MAT(-0.2, 0.5, 1.15, Math.PI / 2, 0, 0, 0.12, 0.45, 0.12), '#eee', TILE.metal],
      ...[-1, 1].flatMap((s) => [-0.4, 0.1, 0.6].map((z) => [CYL(4, 0.4), MAT(s * 0.6, 0.25, z, 0, 0, s * 1.0, 0.1, 0.9, 0.1), '#555', TILE.dark]))]);
    gl.crawlers = new T.InstancedMesh(crawler, sol, 160); gl.crawlers.count = 0; gl.crawlers.frustumCulled = false; gl.scene.add(gl.crawlers);
    gl.eyes = new T.InstancedMesh(merge([[BOX(), MAT(0.18, 0.7, 1.05, 0, 0, 0, 0.12, 0.08, 0.06), null, TILE.glow], [BOX(), MAT(-0.18, 0.7, 1.05, 0, 0, 0, 0.12, 0.08, 0.06), null, TILE.glow]]), new T.MeshBasicMaterial({ color: this.B.night ? '#ff4060' : '#ffdd40' }), 160); gl.eyes.count = 0; gl.eyes.frustumCulled = false; gl.scene.add(gl.eyes);
    // particles, tracers, explosions
    const dot = document.createElement('canvas'); dot.width = dot.height = 16;
    const dx = dot.getContext('2d'), di = dx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.hypot(x - 7.5, y - 7.5) / 8, a = clamp(1 - r, 0, 1), q = (BAYER[(y & 3) * 4 + (x & 3)] / 16) < a * 1.4 ? 1 : 0, i = (y * 16 + x) * 4; di.data[i] = di.data[i + 1] = di.data[i + 2] = 255; di.data[i + 3] = q * 255 * Math.min(1, a * 2); }
    dx.putImageData(di, 0, 0);
    const dotT = new T.CanvasTexture(dot); dotT.magFilter = T.NearestFilter; dotT.minFilter = T.NearestFilter; dotT.generateMipmaps = false; gl.textures.push(dotT);
    const PN = 900;
    gl.pg = new T.BufferGeometry(); gl.pg.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(PN * 3), 3)); gl.pg.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(PN * 3), 3));
    gl.parts = new T.Points(gl.pg, new T.PointsMaterial({ size: 0.45, map: dotT, alphaTest: 0.3, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); gl.parts.frustumCulled = false; gl.scene.add(gl.parts);
    gl.smg = new T.BufferGeometry(); gl.smg.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(PN * 3), 3)); gl.smg.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(PN * 3), 3));
    gl.smoke = new T.Points(gl.smg, new T.PointsMaterial({ size: 2.2, map: dotT, alphaTest: 0.3, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false })); gl.smoke.frustumCulled = false; gl.scene.add(gl.smoke);
    const TN = 160;
    gl.tg = new T.BufferGeometry(); gl.tg.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(TN * 6), 3)); gl.tg.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(TN * 6), 3));
    gl.tracers = new T.LineSegments(gl.tg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); gl.tracers.frustumCulled = false; gl.scene.add(gl.tracers);
    gl.booms = Array.from({ length: 6 }, () => { const m = new T.Mesh(new T.IcosahedronGeometry(1, 1), new T.MeshBasicMaterial({ color: '#ffb050', transparent: true, blending: T.AdditiveBlending, depthWrite: false })); m.visible = false; gl.scene.add(m); return m; });
    const boltG = new T.IcosahedronGeometry(0.22, 0);
    gl.bolts = new T.InstancedMesh(boltG, new T.MeshBasicMaterial({ color: new T.Color(...this.boltCol).multiplyScalar(1.4), fog: false }), 200); gl.bolts.count = 0; gl.bolts.frustumCulled = false; gl.scene.add(gl.bolts);
    gl.heavy = new T.InstancedMesh(new T.IcosahedronGeometry(0.45, 0), new T.MeshBasicMaterial({ color: '#9dff6a', fog: false }), 40); gl.heavy.count = 0; gl.heavy.frustumCulled = false; gl.scene.add(gl.heavy);
    gl.markers = new T.InstancedMesh(new T.RingGeometry(5, 7, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide }), 12); gl.markers.count = 0; gl.markers.frustumCulled = false; gl.scene.add(gl.markers);
    gl.nadeM = new T.InstancedMesh(merge([[ICO(), MAT(0, 0, 0, 0, 0, 0, 0.3, 0.36, 0.3), null, TILE.dark]]), sol, 12); gl.nadeM.count = 0; gl.nadeM.frustumCulled = false; gl.scene.add(gl.nadeM);
    // weather around the camera
    const WN = this.B.weather === 'rain' ? 700 : 260, wp = new Float32Array(WN * 3);
    for (let i = 0; i < WN; i++) { wp[i * 3] = this.vrr(-30, 30); wp[i * 3 + 1] = this.vrr(0, 25); wp[i * 3 + 2] = this.vrr(-30, 30); }
    gl.wg = new T.BufferGeometry(); gl.wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3));
    const wc = this.B.weather === 'rain' ? '#8fa0ff' : this.B.weather === 'leaves' ? '#c9b060' : '#e8d0a8';
    gl.weather = new T.Points(gl.wg, new T.PointsMaterial({ color: wc, size: this.B.weather === 'rain' ? 0.08 : 0.12, transparent: true, opacity: 0.6, depthWrite: false })); gl.weather.frustumCulled = false; gl.scene.add(gl.weather);
  }
  // per-kind models
  mkFoeMesh(e) {
    const gl = this.gl, sol = gl.solid, glowC = this.B.night ? new T.Color('#ff3a6a') : new T.Color(...this.boltCol).multiplyScalar(1.3);
    if (e.kind === 'trooper' || e.kind === 'brute' || e.kind === 'sniper') {
      const g = new T.Group(), arm = e.kind === 'brute' ? TILE.metal : TILE.armor;
      const torso = new T.Mesh(merge([[BOX(), MAT(0, 0.42, 0, 0, 0, 0, 0.78, 0.86, 0.5), null, arm], [BOX(), MAT(0, 0.55, -0.32, 0, 0, 0, 0.6, 0.6, 0.25), null, TILE.dark], [BOX(), MAT(0, 1.0, 0.06, 0.15, 0, 0, 0.4, 0.38, 0.46), null, arm], [BOX(), MAT(0, 1.0, 0.3, 0.15, 0, 0, 0.3, 0.1, 0.06), glowC, TILE.glow],
        ...(e.kind === 'brute' ? [[BOX(), MAT(0.5, 0.75, 0, 0, 0, 0.3, 0.45, 0.25, 0.6), null, TILE.armor], [BOX(), MAT(-0.5, 0.75, 0, 0, 0, -0.3, 0.45, 0.25, 0.6), null, TILE.armor]] : [])]), sol);
      torso.position.y = 0.95; torso.rotation.x = 0.18; g.add(torso);
      const limb = (x, y, len, w, tile) => { const pv = new T.Group(); pv.position.set(x, y, 0); const m = new T.Mesh(merge([[BOX(), MAT(0, -len / 2, 0, 0, 0, 0, w, len, w * 1.1), null, tile], [BOX(), MAT(0, -len + 0.05, 0.08, 0, 0, 0, w * 1.1, 0.12, w * 1.5), null, TILE.dark]]), sol); pv.add(m); g.add(pv); return pv; };
      e.legs = [limb(0.2, 0.95, 0.95, 0.26, arm), limb(-0.2, 0.95, 0.95, 0.26, arm)];
      e.arms = [limb(0.5, 1.75, 0.72, 0.2, arm), limb(-0.5, 1.75, 0.72, 0.2, arm)];
      const gun = new T.Mesh(merge([[BOX(), MAT(0, 0, e.kind === 'sniper' ? 0.7 : 0.35, 0, 0, 0, 0.14, 0.18, e.kind === 'sniper' ? 1.6 : 0.8), null, TILE.dark], [BOX(), MAT(0, 0.07, e.kind === 'sniper' ? 1.5 : 0.76, 0, 0, 0, 0.08, 0.06, 0.08), glowC, TILE.glow]]), sol);
      gun.position.set(0, -0.68, 0.1); e.arms[0].add(gun);
      g.scale.setScalar(e.sz);
      if (e.kind === 'sniper') { const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3)); e.laser = new T.Line(lg, new T.LineBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0.8, fog: false })); e.laser.frustumCulled = false; gl.scene.add(e.laser); }
      return g;
    }
    if (e.kind === 'bike') {
      const g = new T.Group();
      g.add(new T.Mesh(merge([[BOX(), MAT(0, 0, 0, 0, 0, 0, 1.2, 0.5, 2.6), null, TILE.armor], [CONE(4), MAT(0, 0.05, 1.6, Math.PI / 2, Math.PI / 4, 0, 1, 1.0, 0.6), null, TILE.armor], [BOX(), MAT(1.1, -0.05, -0.2, 0, 0, 0.2, 1.2, 0.18, 1.8), null, TILE.metal], [BOX(), MAT(-1.1, -0.05, -0.2, 0, 0, -0.2, 1.2, 0.18, 1.8), null, TILE.metal], [BOX(), MAT(0, 0.45, -0.5, 0, 0, 0, 0.6, 0.5, 0.8), null, TILE.dark]]), sol));
      g.add(new T.Mesh(merge([[BOX(), MAT(0, -0.1, -1.35, 0, 0, 0, 1.0, 0.3, 0.06), glowC, TILE.glow], [BOX(), MAT(0, -0.32, 0, 0, 0, 0, 0.8, 0.05, 2), glowC.clone().multiplyScalar(0.6), TILE.glow]]), gl.glow));
      return g;
    }
    if (e.kind === 'tower') {
      const g = new T.Group();
      g.add(new T.Mesh(merge([[CYL(8, 0.7), MAT(0, 1.5, 0, 0, 0, 0, 6, 3, 6), null, TILE.concrete], [CYL(6, 0.4), MAT(0, 9, 0, 0, 0, 0, 1.6, 13, 1.6), null, TILE.metal], ...[0, 1, 2].map((i) => [BOX(), MAT(Math.cos(i * 2.1) * 1.6, 6, Math.sin(i * 2.1) * 1.6, Math.sin(i * 2.1) * 0.25, 0, -Math.cos(i * 2.1) * 0.25, 0.4, 10, 0.4), null, TILE.armor]), [BOX(), MAT(0, 3.4, 0, 0, 0.4, 0, 4.2, 0.6, 4.2), null, TILE.armor]]), sol));
      e.core = new T.Mesh(merge([[new T.OctahedronGeometry(1.4, 0), MAT(0, 0, 0), glowC, TILE.glow], [new T.TorusGeometry(2.4, 0.15, 4, 16), MAT(0, 0, 0, Math.PI / 2, 0, 0), glowC, TILE.glow]]), gl.glow);
      e.core.position.y = 16.5; g.add(e.core);
      return g;
    }
    if (e.kind === 'ship') {
      const g = new T.Group();
      g.add(new T.Mesh(merge([[BOX(), MAT(0, 0, 0, 0, 0, 0, 4, 2.6, 13), null, TILE.armor], [CONE(6), MAT(0, 0.2, 8.5, Math.PI / 2, 0, 0, 3.6, 4, 2.6), null, TILE.armor], [BOX(), MAT(0, -0.3, -2, 0, 0, 0, 16, 0.5, 4.5), null, TILE.metal], [CYL(8), MAT(7.5, -0.4, -2, Math.PI / 2, 0, 0, 1.8, 6, 1.8), null, TILE.dark], [CYL(8), MAT(-7.5, -0.4, -2, Math.PI / 2, 0, 0, 1.8, 6, 1.8), null, TILE.dark], [BOX(), MAT(0, -1.7, -1, 0, 0, 0, 3, 0.8, 6), null, TILE.dark]]), sol));
      g.add(new T.Mesh(merge([[CYL(8), MAT(7.5, -0.4, -5.05, Math.PI / 2, 0, 0, 1.4, 0.1, 1.4), glowC, TILE.glow], [CYL(8), MAT(-7.5, -0.4, -5.05, Math.PI / 2, 0, 0, 1.4, 0.1, 1.4), glowC, TILE.glow], [BOX(), MAT(0, 0.9, 7.4, 0.5, 0, 0, 2.2, 0.15, 1.6), glowC, TILE.glow]]), gl.glow));
      return g;
    }
    return null;
  }
  mkCarMesh() {
    const gl = this.gl, sol = gl.solid, g = new T.Group();
    const body = new T.Mesh(merge([[BOX(), MAT(0, 0.55, 0, 0, 0, 0, 2.1, 0.6, 4.2), null, TILE.paint], [BOX(), MAT(0, 0.85, 1.3, -0.25, 0, 0, 2.0, 0.35, 1.6), null, TILE.paint], [BOX(), MAT(0, 0.3, 2.15, 0, 0, 0, 2.2, 0.35, 0.2), null, TILE.dark],
      [BOX(), MAT(0.8, 1.4, -0.1, 0, 0, 0, 0.1, 1.3, 0.1), null, TILE.dark], [BOX(), MAT(-0.8, 1.4, -0.1, 0, 0, 0, 0.1, 1.3, 0.1), null, TILE.dark], [BOX(), MAT(0, 2.05, -0.1, 0, 0, 0, 1.7, 0.1, 0.1), null, TILE.dark], [BOX(), MAT(0, 1.0, 0.1, 0, 0, 0, 1.6, 0.6, 0.6), null, TILE.dark],
      [CYL(6), MAT(0, 1.1, -1.5, 0, 0, 0, 0.5, 1.1, 0.5), null, TILE.metal], [BOX(), MAT(0, 1.75, -1.5, 0, 0, 0, 0.7, 0.45, 0.9), null, TILE.metal], [CYL(6), MAT(0, 1.75, -0.6, Math.PI / 2, 0, 0, 0.18, 1.2, 0.18), null, TILE.dark], [BOX(), MAT(0.6, 0.62, 2.12, 0, 0, 0, 0.35, 0.16, 0.05), '#fff2c0', TILE.glow], [BOX(), MAT(-0.6, 0.62, 2.12, 0, 0, 0, 0.35, 0.16, 0.05), '#fff2c0', TILE.glow]]), sol);
    g.add(body);
    const wg = merge([[CYL(10), MAT(0, 0, 0, 0, 0, Math.PI / 2, 0.95, 0.42, 0.95), null, TILE.rubber], [CYL(6), MAT(0, 0, 0, 0, 0, Math.PI / 2, 0.5, 0.44, 0.5), null, TILE.metal]]);
    const wheels = [[1.15, 1.4], [-1.15, 1.4], [1.15, -1.4], [-1.15, -1.4]].map(([x, z]) => { const w = new T.Mesh(wg, sol); w.position.set(x, 0.05, z); g.add(w); return w; });
    g.userData.wheels = wheels;
    return g;
  }
  gunModel(k, gl) {
    const sol = new T.MeshLambertMaterial({ map: gl.kit.atlas, vertexColors: true, fog: false });
    const parts = {
      rifle: [[BOX(), MAT(0, 0, 0, 0, 0, 0, 0.09, 0.12, 0.55), null, TILE.metal], [BOX(), MAT(0, -0.02, -0.38, 0, 0, 0, 0.05, 0.05, 0.3), null, TILE.dark], [BOX(), MAT(0, -0.12, 0.05, 0.25, 0, 0, 0.06, 0.18, 0.08), null, TILE.dark], [BOX(), MAT(0, -0.05, 0.36, 0, 0, 0, 0.07, 0.1, 0.2), null, TILE.paint], [BOX(), MAT(0, 0.08, -0.05, 0, 0, 0, 0.04, 0.04, 0.22), null, TILE.dark], [BOX(), MAT(0, 0.04, -0.2, 0, 0, 0, 0.1, 0.06, 0.16), null, TILE.paint]],
      marksman: [[BOX(), MAT(0, 0, 0, 0, 0, 0, 0.08, 0.11, 0.6), null, TILE.paint], [CYL(6), MAT(0, -0.01, -0.62, Math.PI / 2, 0, 0, 0.035, 0.7, 0.035), null, TILE.dark], [CYL(8), MAT(0, 0.11, -0.05, Math.PI / 2, 0, 0, 0.08, 0.32, 0.08), null, TILE.dark], [BOX(), MAT(0, -0.04, 0.4, 0, 0, 0, 0.07, 0.14, 0.26), null, TILE.wood], [BOX(), MAT(0, -0.12, 0.05, 0.2, 0, 0, 0.05, 0.14, 0.06), null, TILE.dark]],
      rocket: [[CYL(8), MAT(0, 0.02, -0.1, Math.PI / 2, 0, 0, 0.2, 1.0, 0.2), null, TILE.paint], [CYL(8), MAT(0, 0.02, -0.62, Math.PI / 2, 0, 0, 0.24, 0.08, 0.24), null, TILE.dark], [BOX(), MAT(0, -0.14, 0.05, 0.15, 0, 0, 0.06, 0.18, 0.08), null, TILE.dark], [BOX(), MAT(0.1, 0.12, -0.1, 0, 0, 0, 0.06, 0.08, 0.2), null, TILE.dark]],
      scatter: [[BOX(), MAT(0, 0, 0, 0, 0, 0, 0.1, 0.12, 0.5), null, TILE.metal], [CYL(6), MAT(0, 0.02, -0.4, Math.PI / 2, 0, 0, 0.06, 0.45, 0.06), null, TILE.dark], [BOX(), MAT(0, -0.06, -0.3, 0, 0, 0, 0.09, 0.07, 0.25), null, TILE.wood], [BOX(), MAT(0, -0.06, 0.34, 0, 0, 0, 0.08, 0.13, 0.24), null, TILE.wood]]
    }[k];
    const m = new T.Mesh(merge(parts), sol), g = new T.Group(); m.scale.setScalar(0.62); g.add(m); return g;
  }

  // ------------------------------------------------------------------ drawing
  sync(gl) {
    const sc = gl.scene, M = gl.tmpM, Q = gl.tmpQ, E = gl.tmpE, V = gl.tmpV, Sv = gl.tmpS;
    // walkers, bikes, towers, ships
    let ci = 0;
    for (const e of this.foes) {
      const fall = e.dead ? Math.min(1, e.dead * 2) : 0;
      if (e.kind === 'crawler') {
        if (ci >= 160) continue;
        const wig = Math.sin(e.t * 18 + e.phase) * 0.12, sq = e.dead ? Math.max(0.01, 1 - e.dead * 1.5) : 1;
        E.set(e.dead ? 0 : -e.vy * 0.04, e.yaw + wig, e.dead ? Math.PI * fall : 0); Q.setFromEuler(E); V.set(e.x, e.y + Math.abs(Math.sin(e.phase * 2)) * 0.08, e.z); Sv.set(sq * (1 + wig * 0.3) * e.sz, sq * e.sz, sq * e.sz);
        M.compose(V, Q, Sv); gl.crawlers.setMatrixAt(ci, M); gl.eyes.setMatrixAt(ci, M);
        gl.crawlers.setColorAt(ci, (gl._hc ||= new T.Color()).setRGB(e.hit ? 3 : 1, e.hit ? 3 : 1, e.hit ? 3 : 1));
        ci++; continue;
      }
      if (!e.m) { e.m = this.mkFoeMesh(e); if (e.m) sc.add(e.m); }
      const m = e.m; if (!m) continue;
      m.position.set(e.x, e.y, e.z);
      if (e.kind === 'tower') { e.core.rotation.y = e.spin; e.core.visible = !e.dead; m.rotation.z = e.dead ? Math.min(0.5, e.dead * 0.2) : 0; m.position.y = e.y - (e.dead ? Math.min(10, e.dead * e.dead * 0.8) : 0); continue; }
      if (e.kind === 'ship') { m.rotation.set(0, e.yaw, e.dead ? e.dead * 0.3 : 0); continue; }
      if (e.kind === 'bike') { m.rotation.set(0, e.yaw, -(e.bank || 0)); if (e.dead) m.position.y -= e.dead; continue; }
      m.rotation.set(0, e.yaw, 0);
      const sw = Math.sin(e.phase * 2.2), aim = e.awake && e.los && !e.dead;
      e.legs[0].rotation.x = sw * 0.7; e.legs[1].rotation.x = -sw * 0.7;
      e.arms[1].rotation.x = -sw * 0.4;
      e.arms[0].rotation.x = aim ? -1.45 + (e.fire > 0 ? 0.2 : 0) : -0.5 + sw * 0.2;
      if (e.fire > 0) e.fire -= 1 / 60;
      if (e.dead) { m.rotation.x = -Math.PI / 2 * fall; m.position.y = e.y + 0.3 * fall - Math.max(0, e.dead - 2) * 0.5; }
      if (e.laser) {
        const on = e.aim > 0 && !e.dead; e.laser.visible = on;
        if (on) { const p = this.p, A = e.laser.geometry.attributes.position, pe = this.eye(); A.setXYZ(0, e.x, e.y + 1.6 * e.sz, e.z); A.setXYZ(1, pe.x, pe.y - 0.2, pe.z); A.needsUpdate = true; e.laser.material.opacity = 0.4 + (1.6 - e.aim) * 0.35; void p; }
      }
    }
    gl.crawlers.count = ci; gl.eyes.count = ci; gl.crawlers.instanceMatrix.needsUpdate = true; gl.eyes.instanceMatrix.needsUpdate = true; if (gl.crawlers.instanceColor) gl.crawlers.instanceColor.needsUpdate = true;
    // remove meshes of the gone
    if (!gl.keep) gl.keep = new Set();
    const keep = new Set(this.foes.map((e) => e.m).concat(this.cars.map((c) => c.m), this.picks.map((k) => k.m)).filter(Boolean));
    for (const o of gl.keep) if (!keep.has(o)) { sc.remove(o); o.traverse((q) => { if (q.geometry) q.geometry.dispose(); }); }
    for (const e of this.foes) if (e.laser && e.dead > 2.5) { sc.remove(e.laser); e.laser.geometry.dispose(); e.laser = null; }
    gl.keep = keep;
    // cars
    for (const c of this.cars) {
      if (!c.m) { c.m = this.mkCarMesh(); sc.add(c.m); gl.keep.add(c.m); }
      c.m.position.set(c.x, c.y - 0.55, c.z); c.m.rotation.set(c.pitch, c.yaw, c.roll, 'YXZ');
      for (const w of c.m.userData.wheels) w.rotation.x = c.wheel;
      if (c.dead) { c.m.rotation.z = 0.4; c.m.children[0].material = gl.burnt ||= new T.MeshLambertMaterial({ color: '#222', map: gl.kit.atlas }); }
    }
    // pickups
    for (const k of this.picks) {
      if (!k.m) { k.m = new T.Mesh(merge([[BOX(), MAT(0, 0.3, 0, 0, 0, 0, 0.8, 0.5, 0.5), null, k.kind === 'health' ? TILE.concrete : TILE.crate], [BOX(), MAT(0, 0.3, 0, 0, 0, 0, 0.82, 0.12, 0.52), k.kind === 'health' ? '#ff4040' : '#ffd040', TILE.glow]]), gl.glow); sc.add(k.m); gl.keep.add(k.m); }
      k.m.position.set(k.x, k.y + 0.2 + Math.sin(k.t * 3) * 0.1, k.z); k.m.rotation.y = k.t * 1.5;
    }
    // bolts and mortars
    let bi = 0, hi = 0, mi = 0;
    for (const s of this.shots) {
      V.set(s.x, s.y, s.z); Q.identity(); Sv.set(1, 1, 1); M.compose(V, Q, Sv);
      if (s.k === 'bolt' && bi < 200) gl.bolts.setMatrixAt(bi++, M);
      else if (hi < 40) { if (s.k === 'rocket') Sv.set(0.5, 0.5, 0.5), M.compose(V, Q, Sv); gl.heavy.setMatrixAt(hi++, M); }
      if (s.k === 'mortar' && mi < 12) { V.set(s.tx, this.hAt(s.tx, s.tz) + 0.15, s.tz); const sc2 = 0.6 + 0.4 * Math.sin(this.t * 12); Sv.set(sc2, 1, sc2); M.compose(V, Q, Sv); gl.markers.setMatrixAt(mi++, M); }
    }
    gl.bolts.count = bi; gl.heavy.count = hi; gl.markers.count = mi;
    gl.bolts.instanceMatrix.needsUpdate = gl.heavy.instanceMatrix.needsUpdate = gl.markers.instanceMatrix.needsUpdate = true;
    let ni = 0;
    for (const n of this.nades) { V.set(n.x, n.y, n.z); E.set(n.t * 9, n.t * 7, 0); Q.setFromEuler(E); Sv.set(1, 1, 1); M.compose(V, Q, Sv); gl.nadeM.setMatrixAt(ni++, M); }
    gl.nadeM.count = ni; gl.nadeM.instanceMatrix.needsUpdate = true;
    // particles
    const pp = gl.pg.attributes.position.array, pc = gl.pg.attributes.color.array, sp = gl.smg.attributes.position.array, scl = gl.smg.attributes.color.array;
    let a = 0, b = 0, t = 0, bo = 0;
    const tp = gl.tg.attributes.position.array, tc = gl.tg.attributes.color.array;
    for (const f of this.fx) {
      if (f.life <= 0) continue;
      const k = f.life / f.max;
      if (f.k === 'p') {
        if (f.smoke) { if (b >= 900) continue; sp[b * 3] = f.x; sp[b * 3 + 1] = f.y; sp[b * 3 + 2] = f.z; const v = 0.35 * k + 0.05; scl[b * 3] = v * 1.1; scl[b * 3 + 1] = v; scl[b * 3 + 2] = v * 0.95; b++; }
        else { if (a >= 900) continue; pp[a * 3] = f.x; pp[a * 3 + 1] = f.y; pp[a * 3 + 2] = f.z; pc[a * 3] = f.col[0] * k; pc[a * 3 + 1] = f.col[1] * k; pc[a * 3 + 2] = f.col[2] * k; a++; }
      } else if (f.k === 't' && t < 160) {
        tp.set([f.a.x, f.a.y, f.a.z, f.b.x, f.b.y, f.b.z], t * 6); tc.set([f.col[0] * k * 0.4, f.col[1] * k * 0.4, f.col[2] * k * 0.4, f.col[0] * k, f.col[1] * k, f.col[2] * k], t * 6); t++;
      } else if (f.k === 'b' && bo < gl.booms.length) {
        const m = gl.booms[bo++]; m.visible = true; m.position.set(f.x, f.y, f.z); m.scale.setScalar(f.rad * (0.85 - k * 0.6) + 0.4); m.material.opacity = k * k * 0.55 * clamp((gl.cam.position.distanceTo(m.position) - m.scale.x) / 10, 0, 1); m.material.color.setRGB(1, 0.4 + k * 0.4, 0.1 + k * 0.3);
      }
    }
    for (; bo < gl.booms.length; bo++) gl.booms[bo].visible = false;
    gl.pg.setDrawRange(0, a); gl.smg.setDrawRange(0, b); gl.tg.setDrawRange(0, t * 2);
    gl.pg.attributes.position.needsUpdate = gl.pg.attributes.color.needsUpdate = gl.smg.attributes.position.needsUpdate = gl.smg.attributes.color.needsUpdate = gl.tg.attributes.position.needsUpdate = gl.tg.attributes.color.needsUpdate = true;
    // city traffic
    if (gl.trafficMesh) {
      gl.traffic.forEach((c, i) => { const v = ((c.o + this.t * c.s) % 300 + 450) % 300 - 150; V.set(c.ax ? c.lane * 38 + 19 : v, c.y, c.ax ? v : c.lane * 38 + 19); E.set(0, c.ax ? (c.s > 0 ? 0 : Math.PI) : (c.s > 0 ? Math.PI / 2 : -Math.PI / 2), 0); Q.setFromEuler(E); Sv.set(1, 1, 1); M.compose(V, Q, Sv); gl.trafficMesh.setMatrixAt(i, M); });
      gl.trafficMesh.instanceMatrix.needsUpdate = true;
      for (const h of gl.holos) h.rotation.y = this.t * 0.4;
    }
  }
  camera(gl) {
    const p = this.p, cam = gl.cam, d = this.aimDir(), sh = (this.shake || 0) * 0.3;
    cam.fov = p.zoom ? 72 / this.arms[1].zoom : 72; cam.updateProjectionMatrix();
    if (p.veh) {
      const c = p.veh, back = 7.5, cx = c.x - d.x * back, cz = c.z - d.z * back;
      const cy = Math.max(c.y + 2.6 - d.y * back, this.hAt(cx, cz) + 1.2);
      cam.position.set(cx, cy, cz); cam.lookAt(c.x + d.x * 10, c.y + 1.6 + d.y * 10, c.z + d.z * 10);
    } else {
      const e = this.eye(), bob = Math.sin(p.bob * 2) * 0.05 * (p.zoom ? 0.2 : 1);
      cam.position.set(e.x, e.y + bob, e.z);
      if (p.dead > 0) cam.position.y = this.hAt(p.x, p.z) + 0.5 + (3.2 - p.dead) * 0.8;
      cam.lookAt(e.x + d.x, e.y + bob + d.y, e.z + d.z);
      if (p.dead > 0) cam.rotateZ(0.4);
    }
    if (sh) { cam.rotateX(this.r(-sh, sh) * 0.05); cam.rotateY(this.r(-sh, sh) * 0.05); }
    gl.sky.position.copy(cam.position);
    // weather follows the camera
    const wp = gl.wg.attributes.position.array, rain = this.B.weather === 'rain';
    for (let i = 0; i < wp.length; i += 3) {
      wp[i + 1] -= (rain ? 0.45 : 0.02) + (this.B.weather === 'leaves' ? 0.01 : 0);
      if (!rain) { wp[i] += Math.sin(this.t + i) * 0.01; }
      if (wp[i + 1] < -2) wp[i + 1] += 26;
    }
    gl.wg.attributes.position.needsUpdate = true;
    gl.weather.position.set(cam.position.x, cam.position.y - 8, cam.position.z);
  }
  viewmodel(gl) {
    const p = this.p, a = this.arms[p.w];
    for (let i = 0; i < gl.guns.length; i++) gl.guns[i].visible = i === p.w && !p.veh && !p.dead && !p.zoom;
    const g = gl.guns[p.w];
    const walk = Math.hypot(this.in.mx, this.in.mz), bx = Math.sin(p.bob) * 0.012 * walk, by = Math.abs(Math.cos(p.bob)) * 0.014 * walk;
    const rel = p.reload > 0 ? Math.sin(Math.min(1, 1 - p.reload / 1.6) * Math.PI) : 0, sw = p.swap > 0 ? p.swap / 0.45 : 0;
    g.position.set(0.15 + bx, -0.15 - by - rel * 0.12 - sw * 0.25, -0.5 + p.kick * 0.04);
    g.rotation.set(rel * 0.7 + p.kick * 0.12, 0.05, rel * 0.4);
    const tip = (a.k === 'marksman' ? -1 : a.k === 'rocket' ? -0.72 : -0.6) * 0.62;
    gl.flash.visible = this.flash > 0 && g.visible;
    gl.flash.position.set(g.position.x, g.position.y + 0.02, g.position.z + tip); gl.flash.rotation.z = this.t * 40;
  }
  draw(c) {
    c.fillStyle = '#0c0b0a'; c.fillRect(0, 0, W, H);
    if (this.failed) { this.text(c, '3D unavailable on this device', W / 2, H / 2, 13); return; }
    if (!this.ready || !T) { this.text(c, 'loading…', W / 2, H / 2, 14, '#c9b8a0'); return; }
    let r;
    try { r = renderer(); } catch (e) { this.failed = String(e?.message || e); return; }
    if (!this.gl) this.buildGpu();
    const gl = this.gl;
    this.sync(gl); this.camera(gl); this.viewmodel(gl);
    r.setClearColor(gl.scene.background, 1); r.clear();
    r.render(gl.scene, gl.cam);
    r.clearDepth(); r.render(gl.vm, gl.vmCam);
    c.imageSmoothingEnabled = false;
    c.drawImage(r.domElement, 0, 0, W, H);
    this.drawHud(c, gl);
  }
  project(gl, x, y, z) {
    const v = (gl._pv ||= new T.Vector3()).set(x, y, z).project(gl.cam);
    const behind = v.z > 1;
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, behind };
  }
  drawHud(c, gl) {
    const p = this.p, a = this.arms[p.w], am = this.ammo[p.w], ink = '#e9f2ff', dim = 'rgba(233,242,255,.45)';
    c.save();
    // scope
    if (p.zoom && !p.veh) {
      c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, W, H); c.arc(W / 2, H / 2, 150, 0, TAU, true); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(W / 2 - 150, H / 2); c.lineTo(W / 2 + 150, H / 2); c.moveTo(W / 2, H / 2 - 150); c.lineTo(W / 2, H / 2 + 150); c.stroke();
      c.strokeStyle = 'rgba(255,60,40,.9)'; c.beginPath(); c.arc(W / 2, H / 2, 3, 0, TAU); c.stroke();
    }
    // damage
    if (p.hurt > 0) { c.fillStyle = `rgba(160,20,10,${p.hurt * 0.5})`; c.fillRect(0, 0, W, H); const a2 = angTo(p.yaw, p.hurtDir); c.strokeStyle = `rgba(255,60,40,${p.hurt * 2})`; c.lineWidth = 5; c.beginPath(); c.arc(W / 2, H / 2, 70, -Math.PI / 2 - a2 - 0.35, -Math.PI / 2 - a2 + 0.35); c.stroke(); }
    if (p.sh <= 0 && !p.dead) { c.strokeStyle = `rgba(255,50,30,${0.3 + 0.3 * Math.sin(this.t * 10)})`; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6); }
    // objective markers
    c.font = '700 9px ui-monospace, monospace'; c.textAlign = 'center';
    for (const e of this.foes) {
      if (e.kind !== 'tower' || e.dead) continue;
      const s = this.project(gl, e.x, e.y + 19, e.z), off = angTo(p.yaw, Math.atan2(e.x - p.x, e.z - p.z));
      let x = s.x, y = s.y;
      if (s.behind || x < 0 || x > W) { x = off > 0 ? 14 : W - 14; y = H * 0.42; }
      x = clamp(x, 14, W - 14); y = clamp(y, 96, H - 96);
      c.fillStyle = '#ffcf4a'; c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x - 6, y - 4); c.lineTo(x + 6, y - 4); c.closePath(); c.fill();
      c.fillText(`${Math.round(Math.hypot(e.x - p.x, e.z - p.z))}m`, x, y - 10);
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x - 12, y + 9, 24, 3); c.fillStyle = '#ffcf4a'; c.fillRect(x - 12, y + 9, 24 * e.hp / e.max, 3);
    }
    // crosshair
    if (!p.zoom && !p.dead) {
      const h = this.ray(p.veh ? { x: p.veh.x, y: p.veh.y + 2.2, z: p.veh.z } : this.eye(), this.aimDir(), p.veh ? 150 : a.range || 120, 0);
      const red = !!h.e, cx = W / 2, cy = H / 2, sp = 5 + p.kick * 6 + (a.k === 'scatter' ? 6 : 0);
      c.strokeStyle = red ? '#ff4a3a' : 'rgba(233,242,255,.85)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(cx, cy, sp + 4, 0, TAU); c.stroke();
      c.fillStyle = c.strokeStyle; c.fillRect(cx - 1, cy - 1, 2, 2);
      if (this.hitMark > 0) { c.strokeStyle = this.hitHead ? '#ffdf40' : '#fff'; c.lineWidth = 2; c.beginPath(); for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.moveTo(cx + dx * 6, cy + dy * 6); c.lineTo(cx + dx * 11, cy + dy * 11); } c.stroke(); }
    }
    // shield, health, ammo and status down the right-hand side
    const bx = W - 132;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(bx, 12, 120, 8); c.fillRect(bx, 22, 120, 4);
    c.fillStyle = p.sh > p.shMax * 0.25 ? '#6ad8ff' : '#ff5a3a'; c.fillRect(bx + 1, 13, 118 * p.sh / p.shMax, 6);
    c.fillStyle = p.hp > 30 ? '#9be36a' : '#ff5a3a'; c.fillRect(bx + 1, 23, 118 * Math.max(0, p.hp) / p.max, 2);
    c.textAlign = 'right'; c.fillStyle = ink; c.font = '700 16px ui-monospace, monospace';
    c.fillText(p.veh ? '∞' : p.reload > 0 ? '…' : `${am.mag}`, W - 12, 42);
    c.font = '600 9px ui-monospace, monospace'; c.fillStyle = dim;
    c.fillText(p.veh ? 'TURRET' : `${am.res} · ${a.name.toUpperCase()}`, W - 12, 56);
    c.fillText(`✸ ${p.nades} · S${this.sector} · ${this.kills} KILLS${this.deaths ? ` · ${this.deaths}✝` : ''}`, W - 12, 68);
    if (p.veh) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(W - 72, 74, 60, 4); c.fillStyle = '#ffcf4a'; c.fillRect(W - 72, 74, 60 * p.veh.hp / p.veh.max, 4); }
    // motion tracker
    const rx = 44, ry = H - 46, rr = 32;
    c.fillStyle = 'rgba(10,20,30,.55)'; c.beginPath(); c.arc(rx, ry, rr, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(120,200,255,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(rx, ry, rr * 0.5, 0, TAU); c.moveTo(rx - rr, ry); c.lineTo(rx + rr, ry); c.moveTo(rx, ry - rr); c.lineTo(rx, ry + rr); c.stroke();
    const sy = Math.sin(p.yaw), cyy = Math.cos(p.yaw);
    for (const e of this.foes) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz); if (d > 50 && e.kind !== 'tower') continue;
      const lx = dx * cyy - dz * sy, lz = dx * sy + dz * cyy, k = Math.min(1, d / 50);
      const ux = rx - (lx / (d || 1)) * k * rr, uy = ry - (lz / (d || 1)) * k * rr;
      c.fillStyle = e.kind === 'tower' ? '#ffcf4a' : '#ff4a3a'; c.fillRect(ux - 1.5, uy - 1.5, e.kind === 'crawler' ? 2 : 3.5, e.kind === 'crawler' ? 2 : 3.5);
    }
    for (const car of this.cars) if (!car.dead) { const dx = car.x - p.x, dz = car.z - p.z, d = Math.hypot(dx, dz); if (d < 50) { const lx = dx * cyy - dz * sy, lz = dx * sy + dz * cyy; c.fillStyle = '#7adfff'; c.fillRect(rx - lx / 50 * rr - 2, ry - lz / 50 * rr - 2, 4, 4); } }
    c.fillStyle = '#e9f2ff'; c.beginPath(); c.moveTo(rx, ry - 4); c.lineTo(rx - 3, ry + 3); c.lineTo(rx + 3, ry + 3); c.closePath(); c.fill();
    // messages and kill feed
    c.textAlign = 'center';
    this.msg.forEach((m, i) => { c.globalAlpha = Math.min(1, m.life); c.font = `800 ${i === 0 ? 14 : 11}px ui-monospace, monospace`; c.fillStyle = '#000'; c.fillText(m.t, W / 2 + 1, 140 + i * 18 + 1); c.fillStyle = '#ffe6a0'; c.fillText(m.t, W / 2, 140 + i * 18); });
    c.globalAlpha = 1; c.textAlign = 'right'; c.font = '700 9px ui-monospace, monospace';
    this.feed.slice(-4).forEach((m, i) => { c.globalAlpha = Math.min(1, m.life * 2); c.fillStyle = '#ffd27a'; c.fillText(m.t, W - 12, 90 + i * 11); });
    c.globalAlpha = 1;
    if (p.dead > 0) { c.textAlign = 'center'; this.text(c, `RESPAWN IN ${Math.ceil(p.dead)}`, W / 2, H / 2 + 40, 12, '#ffe6a0'); }
    // touch controls when you play
    if (!this.auto) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const b of this.btns()) { c.fillStyle = b.k === 'fire' && this.in.fire ? 'rgba(255,90,60,.45)' : 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; c.font = `700 ${b.l.length > 2 ? 9 : 14}px ui-monospace, monospace`; c.fillText(b.l, b.x, b.y + 1); }
      const S = this.touch.stick;
      if (S) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(S.ox, S.oy, 40, 0, TAU); c.stroke(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(S.ox + this.in.mx * 40, S.oy - this.in.mz * 40, 14, 0, TAU); c.fill(); }
      else { c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '600 9px ui-monospace, monospace'; c.fillText('move', 92, 300); }
    }
    c.restore();
  }
}
