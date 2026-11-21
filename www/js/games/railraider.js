// Rail Raider: a steampunk shooter on rails. You ride an armoured rail cart through five stages: the coal seams,
// the foundry, the smog line (a viaduct over a city of chimneys), the clockworks and a canyon
// trestle. The cart drives itself; you aim and fire. Clockwork troopers step out from behind
// pillars, steam drones swoop, goons pump handcars along the next track over, bats come in swarms,
// bombers lob dynamite, turrets rake the halls, and each stage ends with a boss whose glowing cores
// you shoot out: an armoured locomotive, a spider tank, an airship. Incoming bolts and dynamite
// can be shot down. At a junction you pick your line (two arrows; both branches are there to see).
// Crates hold steam (health) and upgrades: spread shot, rapid fire, explosive rounds.
// Drawn like Hell Maze: three.js at a low resolution with nearest-neighbour textures, and most of
// the world as gritty pixel billboards (railraider-art.js), under film grain and a vignette.
import { Game, W, H } from './engine.js';
import * as A from './railraider-art.js';
import { mulberry32 } from '../util.js';

let T = null, loading = null;
const loadThree = () => (loading ||= import('../vendor/three.module.min.js').then((m) => { T = m; return m; }));
const RW = 240, RH = 280, FOV = 70;
let RR = null;
const live = [];
function renderer() {
  if (RR && !RR.lost) return RR;
  const cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
  const r = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  r.setPixelRatio(1); r.setSize(RW, RH, false); r.outputColorSpace = T.LinearSRGBColorSpace;
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r.lost = true; for (const g of [...live]) g.dropGpu(true); });
  RR = r; return r;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

// ------------------------------------------------ the stages
const THEMES = {
  mine: { name: 'THE COAL SEAMS', env: 'tunnel', wall: 'rock', floor: 'gravel', bg: 0x120c08, fog: [0x1a120c, 4, 60], lamp: [1, 0.72, 0.4], props: ['lantern', 'minecart', 'barrel', 'chains'], foes: ['soldier', 'bat', 'handcar', 'bomber', 'soldier'], boss: 'ironclad', tint: '#3a2410' },
  foundry: { name: 'THE FOUNDRY', env: 'hall', wall: 'brick', floor: 'slag', bg: 0x2a1206, fog: [0x3a1a0a, 8, 95], lamp: [1, 0.5, 0.2], props: ['boiler', 'piston', 'pillar', 'chains', 'barrel'], foes: ['soldier', 'turret', 'drone', 'soldier', 'bomber'], boss: 'spider', tint: '#5a2408', molten: 1 },
  city: { name: 'THE SMOG LINE', env: 'open', ground: 'roof', bg: 0xa8a070, fog: [0x9a9670, 24, 180], lamp: [1, 0.85, 0.6], props: ['facade', 'chimney', 'facade', 'skyship'], foes: ['drone', 'soldier', 'bomber', 'drone', 'bat'], boss: 'airship', sky: 1, tint: '#4a4a28' },
  clock: { name: 'THE CLOCKWORKS', env: 'hall', wall: 'brass', floor: 'iron', bg: 0x1a1408, fog: [0x2a2010, 8, 90], lamp: [1, 0.85, 0.5], props: ['gear', 'pillar', 'piston', 'gear', 'chains'], foes: ['drone', 'turret', 'soldier', 'bat'], boss: 'spider', tint: '#3a2c10', gears: 1 },
  canyon: { name: 'DEADWOOD TRESTLE', env: 'trestle', ground: 'sand', bg: 0xd8a070, fog: [0xd8a070, 40, 240], lamp: [1, 0.9, 0.7], props: ['mesa', 'cactus', 'spire', 'cactus'], foes: ['handcar', 'bomber', 'soldier', 'bat', 'handcar'], boss: 'ironclad', sky: 1, tint: '#6a3a18' }
};
const ORDER = ['mine', 'foundry', 'city', 'clock', 'canyon'];
const FOE = {
  soldier: { hp: 3, r: 0.8, w: 1.4, h: 2.3, frames: 3, pts: 100, fire: 1.9 },
  bomber: { hp: 3, r: 0.8, w: 1.4, h: 2.3, frames: 2, pts: 120, fire: 2.6, lob: 1 },
  drone: { hp: 2, r: 0.7, w: 1.6, h: 1.3, frames: 4, pts: 150, fire: 2.2, fly: 1 },
  bat: { hp: 1, r: 0.45, w: 1.1, h: 0.7, frames: 2, pts: 60, fly: 1, swarm: 1 },
  turret: { hp: 5, r: 0.8, w: 1.6, h: 1.5, frames: 3, pts: 200, fire: 0.9, burst: 3 },
  handcar: { hp: 6, r: 1.2, w: 3.4, h: 2.8, frames: 3, pts: 300, fire: 1.6, rail: 1 }
};
const BOSS = { ironclad: { w: 15, h: 8.2, cores: [[-4.6, 3.2], [0, 3.6], [4.6, 3.2]], side: 6.2, hp: 14 }, spider: { w: 12, h: 8.6, cores: [[-2.6, 4.6], [2.6, 4.6], [0, 6.4]], ahead: 18, hp: 14 }, airship: { w: 18, h: 9, cores: [[-5, 2.6], [0, 2.2], [5, 2.6]], side: 9, up: 7, hp: 16 } };

export class RailRaider extends Game {
  static noMods = ['mirror', 'wobble', 'giant', 'tiny', 'hue', 'invert', 'mono', 'party', 'trails'];   // the brass-and-soot palette stays
  setup() {
    const R = this.rng;
    this.order = [...ORDER].sort(() => R() - 0.5);
    this.stageN = 0; this.score = 0; this.hp = 8; this.inv = 0; this.heat = 0; this.over = 0; this.cool = 0;
    this.aim = { x: W / 2, y: H * 0.46 }; this.firing = false; this.upg = null; this.upgT = 0;
    this.fx2 = []; this.hurtT = 0; this.flashT = 0; this.recoil = 0; this.banner = 0; this.deadT = 0; this.ready = false;
    loadThree().then(() => { this.ready = true; }).catch((e) => { this.failed = String(e?.message || e); });
    this.newStage(true);
  }
  hud() { return `${Math.floor(this.score)} · ${this.th?.name.toLowerCase() || ''}`; }
  later(s, fn) { (this.pending ||= []).push({ at: this.t + s, fn }); }

  // ------------------------------------------------ the course: a stage of pieces with a junction
  newStage(first = false) {
    const key = this.order[this.stageN % this.order.length], th = (this.th = THEMES[key]), R = mulberry32(((this.post.seed || 1) * 31 + this.stageN * 977) >>> 0);
    this.key = key; this.R2 = R;
    const pieces = [];
    const add = (o) => pieces.push({ len: 80, turn: 0, climb: 0, v: 12, ...o });
    add({ len: 50, v: 9, kind: 'start' });
    for (let k = 0; k < 3; k++) { add({ len: 70 + R() * 40, turn: (R() - 0.5) * 1.4, climb: (R() - 0.5) * (th.env === 'tunnel' ? 6 : 10), v: 14, kind: 'run' }); add({ len: 90 + R() * 30, turn: (R() - 0.5) * 0.5, v: 8, kind: 'fight', twin: R() < 0.5 }); }
    this.jIndex = pieces.length;
    add({ len: 40, v: 10, kind: 'junction' });
    this.trunkPieces = pieces;
    // the two branches: each bends its own way first, then they run on as fights to the boss
    const branch = (s) => [{ len: 70, turn: s * 0.9, climb: (R() - 0.5) * 6, v: 12, kind: 'run', alt: s > 0 ? 0 : 1 }, { len: 100, turn: -s * 0.4, v: 8, kind: 'fight', twin: true, alt: s > 0 ? 0 : 1 }, { len: 60, turn: (R() - 0.5) * 0.6, v: 13, kind: 'run' }, { len: 90, turn: 0, v: 8, kind: 'fight' }, { len: 240, turn: (R() - 0.5) * 0.3, v: 11, kind: 'boss', twin: true }];
    this.branchPieces = [branch(1), branch(-1)].map((L) => L.map((o) => ({ turn: 0, climb: 0, v: 12, ...o })));
    this.choice = -1;
    this.track = [this.frames(this.trunkPieces, null), null, null];
    const end = this.track[0].n - 1;
    this.Jd = end;
    for (const b of [0, 1]) this.track[b + 1] = this.frames(this.branchPieces[b], this.track[0], end);
    this.d = 0; this.v = 9; this.spawned = new Set(); this.foes = []; this.shots = []; this.crates = []; this.boss = null; this.bossDone = false;
    this.plan = this.encounters(R);
    this.banner = 3.2; this.clearT = 0;
    if (this.gl) this.rebuildGpu();
  }
  // integrate the pieces into frames one unit apart: position, heading, pitch, and what each piece is
  frames(pieces, from, at = 0) {
    const N = Math.ceil(pieces.reduce((s, p) => s + p.len, 0)) + 2, f = { n: N, x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), yaw: new Float32Array(N), pit: new Float32Array(N), piece: new Uint8Array(N), pieces, d0: at };
    let x = from ? from.x[at] : 0, y = from ? from.y[at] : 0, z = from ? from.z[at] : 0, yaw = from ? from.yaw[at] : 0, k = 0, inP = 0;
    for (let i = 0; i < N; i++) {
      while (k < pieces.length - 1 && inP >= pieces[k].len) { inP -= pieces[k].len; k++; }
      const p = pieces[k], u = clamp(inP / p.len, 0, 1), pit = Math.atan2(p.climb, p.len) * Math.sin(u * Math.PI) * 1.6;
      f.x[i] = x; f.y[i] = y; f.z[i] = z; f.yaw[i] = yaw; f.pit[i] = pit; f.piece[i] = k;
      yaw += (p.turn / p.len) * (0.5 + 0.5 * Math.sin(u * Math.PI)) * 1.27;
      x += Math.sin(yaw) * Math.cos(pit); z += Math.cos(yaw) * Math.cos(pit); y += Math.sin(pit);
      inP++;
    }
    return f;
  }
  // a point along the line at distance d (trunk, then the chosen branch), and its frame vectors
  at(d, b = this.choice) {
    let f = this.track[0], dd = d;
    if (d >= this.Jd) { f = this.track[(b < 0 ? 0 : b) + 1]; dd = d - this.Jd; }
    const i = clamp(Math.floor(dd), 0, f.n - 2), t = clamp(dd - i, 0, 1), L = (a) => a[i] + (a[i + 1] - a[i]) * t;
    const yaw = L(f.yaw), pit = L(f.pit), fx = Math.sin(yaw), fz = Math.cos(yaw);
    return { x: L(f.x), y: L(f.y), z: L(f.z), yaw, pit, fx, fz, rx: -fz, rz: fx, piece: f.pieces[f.piece[i]] };
  }
  stageLen() { return this.Jd + this.track[(this.choice < 0 ? 0 : this.choice) + 1].n - 3; }
  // where the waves come from: each fight piece gets a few, the runs a scattering, crates here and there
  encounters(R) {
    const th = this.th, out = [];
    const walk = (pieces, d0, branch) => {
      let d = d0;
      for (const p of pieces) {
        if (p.kind === 'fight') for (let w = 0; w < 4; w++) { const k = th.foes[(R() * th.foes.length) | 0]; out.push({ d: d + 6 + (w / 4) * p.len * 0.9, k, n: FOE[k].swarm ? 5 : k === 'handcar' ? 1 : 1 + (R() < 0.5 ? 1 : 0), side: R() < 0.5 ? -1 : 1, branch, twin: p.twin }); }
        else if (p.kind === 'run' && R() < 0.7) out.push({ d: d + p.len * 0.5, k: R() < 0.5 ? 'bat' : 'drone', n: R() < 0.5 ? 1 : 3, side: R() < 0.5 ? -1 : 1, branch });
        if (p.kind !== 'boss' && p.kind !== 'start') for (let q = 0; q < 2; q++) if (R() < 0.6) out.push({ d: d + R() * p.len, crate: (R() * 4) | 0, side: R() < 0.5 ? -1 : 1, branch });
        if (p.kind === 'boss') out.push({ d: d + 20, boss: th.boss, branch });
        d += p.len;
      }
    };
    walk(this.trunkPieces, 0, -1);
    walk(this.branchPieces[0], this.Jd, 0); walk(this.branchPieces[1], this.Jd, 1);
    return out.sort((a, b) => a.d - b.d);
  }

  // ------------------------------------------------ simulation
  step(dt) {
    if (!this.ready) return;
    if (this.pending?.length) { const due = this.pending.filter((q) => q.at <= this.t); if (due.length) { this.pending = this.pending.filter((q) => q.at > this.t); due.forEach((q) => q.fn()); } }
    this.banner = Math.max(0, this.banner - dt); this.inv = Math.max(0, this.inv - dt); this.hurtT = Math.max(0, this.hurtT - dt); this.flashT = Math.max(0, this.flashT - dt); this.recoil = Math.max(0, this.recoil - dt * 6);
    this.cool -= dt; this.heat = Math.max(0, this.heat - dt * (this.over > 0 ? 0.7 : 0.45)); if (this.over > 0) this.over -= dt;
    if (this.upgT > 0 && (this.upgT -= dt) <= 0) this.upg = null;
    if (this.deadT > 0) { this.deadT -= dt; if (this.deadT <= 0) { this.hp = 8; this.score = Math.max(0, this.score - 500); this.newStage(); } return; }
    if (this.clearT > 0) { this.clearT -= dt; if (this.clearT <= 0) { this.stageN++; this.hp = Math.min(8, this.hp + 3); this.newStage(); } return; }
    // the cart: its speed eases toward the piece's, and past the junction the choice is made
    const here = this.at(this.d), tv = (here.piece?.v || 10) * (this.boss && !this.bossDone ? 1 : 1);
    this.v += (tv - this.v) * Math.min(1, dt * 0.8);
    if (this.choice < 0 && this.d > this.Jd - 2) this.choose(this.auto ? (this.R2() < 0.5 ? 0 : 1) : 0);
    if (!(this.boss && !this.bossDone && this.d > this.stageLen() - 30)) this.d = Math.min(this.stageLen() - 2, this.d + this.v * dt);
    // spawn what the plan says is due
    for (const e of this.plan) {
      if (e.d > this.d + 2) break;
      if (this.spawned.has(e) || (e.branch >= 0 && this.choice >= 0 && e.branch !== this.choice) || (e.branch >= 0 && this.choice < 0)) continue;
      this.spawned.add(e);
      if (e.crate !== undefined) this.crates.push({ d: this.d + 26, side: e.side * (2.6 + this.R2() * 1.5), k: e.crate, hp: 1, b: this.choice });
      else if (e.boss) this.spawnBoss(e.boss);
      else for (let q = 0; q < e.n; q++) this.spawnFoe(e.k, e.side, q, e.twin);
    }
    for (const f of this.foes) this.stepFoe(f, dt);
    this.foes = this.foes.filter((f) => !f.gone);
    if (this.boss) this.stepBoss(dt);
    for (const s of this.shots) this.stepShot(s, dt);
    this.shots = this.shots.filter((s) => !s.gone);
    this.crates = this.crates.filter((c) => !c.gone && c.d > this.d - 4);
    for (const p of this.fx2) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= (p.g || 0) * dt; }
    this.fx2 = this.fx2.filter((p) => p.t < p.life);
    if (this.firing) this.fire();
  }
  choose(b) { if (this.choice >= 0) return; this.choice = b; this.plan = this.plan.filter((e) => e.branch < 0 || e.branch === b); if (this.gl) this.gl.dropBranch = 1 - b; }
  // a world point d along the line, `side` across it, `up` above the rail
  place(d, side, up = 0, b = this.choice) { const p = this.at(d, b); return { x: p.x + p.rx * side, y: p.y + up, z: p.z + p.rz * side }; }
  spawnFoe(k, side, q, twin) {
    const R = this.R2, F = FOE[k], env = this.th.env, room = env === 'tunnel' ? 3.1 : env === 'hall' ? 9 : 2.4;
    const f = { k, F, hp: F.hp, t: -q * 0.35, side: side * Math.min(room, F.rail ? 3.4 : F.fly ? 1.5 + R() * 3 : 2.2 + R() * 3.5), up: F.fly ? 1.8 + R() * 2.5 : 0, ahead: (F.fly ? 22 : 24 + R() * 12) + q * 1.5, cd: F.fire ? 0.8 + R() * F.fire : 0, fr: 0, ph: R() * TAU };
    if (F.rail) { f.ahead = 10; f.side = twin ? 3.4 : side * 3.4; }
    if (k === 'turret') { f.up = env === 'tunnel' ? 2.6 : 2.4 + R() * 2; if (env === 'tunnel') f.side = side * 3.4; }
    f.d = this.d + f.ahead;
    this.foes.push(f);
  }
  stepFoe(f, dt) {
    const F = f.F, R = this.R2;
    f.t += dt;
    if (f.t < 0) return;
    if (f.dead) { f.dt2 = (f.dt2 || 0) + dt; if (f.dt2 > 0.6) f.gone = true; return; }
    // how each kind moves: troopers and turrets stand where they are; drones and bats keep ahead of
    // the cart and weave; handcars run alongside on the next track; bats dive at you
    if (F.rail) { f.d += (this.v + Math.sin(f.t * 0.7) * 2 - (f.t < 1.2 ? 4 : 0)) * dt; f.d = Math.max(f.d, this.d + 6); }
    else if (f.k === 'drone') { const want = this.d + 13 + Math.sin(f.t * 0.6 + f.ph) * 4; f.d += (want - f.d) * Math.min(1, dt * 1.2); f.sideW = Math.sin(f.t * 1.3 + f.ph) * 2.2; if (f.t > 11) f.leave = 1; if (f.leave) f.up += dt * 6; }
    else if (f.k === 'bat') { const want = this.d + Math.max(1.5, 14 - f.t * 4.5); f.d += (want - f.d) * Math.min(1, dt * 2); f.sideW = Math.sin(f.t * 3 + f.ph) * 1.2 * Math.max(0, 1 - f.t / 3.5); f.up += (1.5 - f.up) * dt; if (f.d - this.d < 2.2 && !f.hit) { f.hit = 1; this.hurt(1); f.gone = true; } }
    if (f.d < this.d - 2) { f.gone = true; return; }
    f.fr = F.frames > 2 ? (f.k === 'drone' ? Math.floor(f.t * 12) % 4 : f.cd < 0.18 && f.cd > 0 ? 2 : f.d - this.d < 30 ? 1 : 0) : Math.floor(f.t * (f.k === 'bat' ? 10 : 2)) % 2;
    if (F.rail) f.fr = Math.floor(f.t * 4) % 2 + (f.cd < 0.15 && f.cd > 0 ? 1 : 0);
    // firing: a bolt (or a lobbed stick of dynamite) at where the cart will be
    const dist = f.d - this.d;
    if (F.fire && dist < 40 && dist > 4 && !f.leave) {
      f.cd -= dt;
      if (f.cd <= 0) {
        f.cd = F.fire * (0.7 + R() * 0.6);
        const n = F.burst || 1;
        for (let q = 0; q < n; q++) this.later(q * 0.14, () => { if (!f.dead) this.enemyShot(f, F.lob); });
      }
    }
  }
  foePos(f) { return this.place(f.d, f.side + (f.sideW || 0), f.up + (FOE[f.k]?.fly ? Math.sin(f.t * 2 + f.ph) * 0.3 : 0)); }
  enemyShot(f, lob) {
    const p = f.boss ? f.pos : this.foePos(f), lead = this.d + this.v * (lob ? 1.4 : 0.9), tgt = this.place(lead + (lob ? 4 : 0), (this.R2() - 0.5) * 1.2, lob ? 0.2 : 1.5);
    const tt = lob ? 1.4 : 1.1 + this.R2() * 0.3, g = lob ? 18 : 0;
    this.shots.push({ k: lob ? 'dynamite' : 'bolt', x: p.x, y: p.y + (f.boss ? 0 : FOE[f.k].h * 0.55), z: p.z, vx: (tgt.x - p.x) / tt, vy: (tgt.y - p.y - (f.boss ? 0 : FOE[f.k].h * 0.55)) / tt + (g * tt) / 2, vz: (tgt.z - p.z) / tt, g, t: 0, life: tt + 0.6, hp: 1, r: lob ? 0.45 : 0.5 });
  }
  stepShot(s, dt) {
    s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy -= s.g * dt;
    const cam = this.camPos || this.place(this.d, 0, 1.7), dx = s.x - cam.x, dy = s.y - cam.y, dz = s.z - cam.z, dd = Math.hypot(dx, dy, dz);
    if (s.k === 'dynamite' && s.t > s.life - 0.6 && s.y <= this.at(this.d).y + 0.3) { this.boom(s.x, s.y, s.z, dd < 4 ? 0.7 : 1.6); if (dd < 3.2) this.hurt(1); s.gone = true; return; }
    if (dd < 1.3) { this.hurt(1); this.spark(s.x, s.y, s.z, 6); s.gone = true; return; }
    if (s.t > s.life) s.gone = true;
  }
  spawnBoss(k) {
    // the locomotive runs on the next track over; in a tunnel everything is smaller, to fit
    const B = BOSS[k], env = this.th.env, sc = env === 'tunnel' ? 0.55 : k === 'ironclad' ? 0.75 : 1;
    this.boss = { k, B, sc, t: 0, cd: 2.5, cores: B.cores.map(([cx, cy]) => ({ cx: cx * sc, cy: cy * sc, hp: B.hp })), side: k === 'ironclad' ? 3.4 : (B.side || 0) * (env === 'tunnel' ? 0.4 : 1), ahead: B.ahead || 14, up: (B.up || 0) * (env === 'tunnel' ? 0.3 : 1), enter: 0 };
    this.banner = 2;
  }
  stepBoss(dt) {
    const b = this.boss;
    if (this.bossDone) { b.t += dt; return; }
    b.t += dt; b.enter = Math.min(1, b.enter + dt * 0.4);
    const sway = Math.sin(b.t * 0.6) * 1.5;
    b.d = this.d + b.ahead + (1 - b.enter) * 40 + Math.sin(b.t * 0.4) * 3;
    const base = this.place(b.d, b.side + sway, b.up + Math.sin(b.t * 1.1) * (b.k === 'airship' ? 1.2 : 0));
    b.pos = base;
    for (const c of b.cores) { const p = this.at(b.d); c.x = base.x + p.rx * c.cx; c.z = base.z + p.rz * c.cx; c.y = base.y + c.cy; }
    b.cd -= dt;
    if (b.cd <= 0 && b.enter > 0.8) {
      const alive = b.cores.filter((c) => c.hp > 0);
      b.cd = 0.9 + alive.length * 0.25;
      for (const c of alive) for (let q = 0; q < (b.k === 'airship' ? 2 : 1); q++) this.later(q * 0.2, () => { if (c.hp > 0) this.enemyShot({ boss: 1, pos: { x: c.x, y: c.y, z: c.z } }, b.k === 'airship' && q === 1); });
    }
    if (b.cores.every((c) => c.hp <= 0)) {
      this.bossDone = true; this.score += 2500;
      for (let q = 0; q < 6; q++) this.later(q * 0.2, () => this.boom(base.x + (this.R2() - 0.5) * 8, base.y + this.R2() * 5, base.z + (this.R2() - 0.5) * 4, 3));
      this.clearT = 4.5; this.banner = 4.5;
    }
  }
  hurt(n) {
    if (this.inv > 0 || this.deadT > 0) return;
    this.hp -= n; this.inv = 0.7; this.hurtT = 0.5; this.shake = 0.4;
    if (this.hp <= 0) { this.hp = 0; this.deadT = 3; this.banner = 3; this.firing = false; }
  }

  // ------------------------------------------------ shooting
  fire() {
    if (this.cool > 0 || this.over > 0 || this.deadT > 0 || !this.camPos) return;
    const rapid = this.upg === 'rapid';
    this.cool = rapid ? 0.07 : 0.13; this.recoil = 1; this.flashT = 0.05; this.side = !this.side;
    this.heat += rapid ? 0.035 : 0.05; if (this.heat >= 1) { this.heat = 1; this.over = 1.6; }
    // what lies under the crosshair: the nearest thing whose picture covers it (spread shot: a wider net)
    const net = this.upg === 'spread' ? 2.2 : 1, hits = this.under(this.aim.x, this.aim.y, net);
    const take = this.upg === 'spread' ? hits.slice(0, 3) : hits.slice(0, 1);
    for (const h of take) this.hit(h, this.upg === 'boom' ? 2 : 1);
    if (this.upg === 'boom' && take[0]) { const p = take[0].p; this.boom(p.x, p.y, p.z, 1.2, true); }
    if (!take.length) this.tracerMiss = 0.06;
  }
  // targets near a screen point, nearest first
  under(sx, sy, net = 1) {
    const out = [], c = this.cam3;
    if (!c) return out;
    const fpx = (H / 2) / Math.tan((FOV * Math.PI) / 360), test = (p, r, o) => { const q = this.toScreen(p); if (!q || q.z <= 0) return; const rr = (r * fpx) / q.z * net + 4; if (Math.hypot(q.x - sx, q.y - sy) < rr) out.push({ ...o, p, z: q.z }); };
    for (const f of this.foes) if (!f.dead && f.t >= 0) { const p = this.foePos(f), F = FOE[f.k]; test({ x: p.x, y: p.y + F.h * 0.5, z: p.z }, F.r * 1.3, { f }); }
    for (const s of this.shots) test(s, s.r * 1.6, { s });
    for (const cr of this.crates) if (cr.b === this.choice || cr.b < 0 || this.choice < 0) { const p = this.place(cr.d, cr.side, 0.5); test(p, 0.7, { cr }); }
    if (this.boss && !this.bossDone) for (const co of this.boss.cores) if (co.hp > 0 && co.x !== undefined) test(co, 0.95, { co });
    return out.sort((a, b) => a.z - b.z);
  }
  hit(h, dmg) {
    const p = h.p;
    this.spark(p.x, p.y, p.z, 4);
    if (h.f) { const f = h.f; f.hp -= dmg; if (f.hp <= 0 && !f.dead) { f.dead = 1; this.score += f.F.pts; this.debris(p.x, p.y, p.z, f.k === 'handcar' ? 14 : 8); if (f.k === 'handcar' || f.k === 'drone') this.boom(p.x, p.y, p.z, 1.2); } }
    else if (h.s) { h.s.gone = true; this.score += 25; if (h.s.k === 'dynamite') this.boom(p.x, p.y, p.z, 1.4, true); else this.spark(p.x, p.y, p.z, 8); }
    else if (h.cr) { const cr = h.cr; cr.gone = true; this.debris(p.x, p.y, p.z, 6); if (cr.k === 0) { this.hp = Math.min(8, this.hp + 2); this.score += 50; } else { this.upg = ['spread', 'rapid', 'boom'][cr.k - 1]; this.upgT = 12; this.score += 100; } this.pickT = 1.2; this.pickK = cr.k; }
    else if (h.co) { h.co.hp -= dmg; this.score += 10; if (h.co.hp <= 0) { this.boom(h.co.x, h.co.y, h.co.z, 2); this.score += 500; } }
  }
  // explosive rounds and dynamite also catch what is near
  boom(x, y, z, r, splash = false) {
    for (let q = 0; q < 10; q++) this.fx2.push({ k: q < 3 ? 'flash' : 'smoke', x: x + (Math.random() - 0.5) * r, y: y + Math.random() * r, z: z + (Math.random() - 0.5) * r, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, t: 0, life: q < 3 ? 0.35 : 1.1, s: r * (q < 3 ? 1.6 : 1.1) });
    this.debris(x, y, z, 6);
    if (splash) for (const f of this.foes) { if (f.dead) continue; const p = this.foePos(f); if (Math.hypot(p.x - x, p.y - y, p.z - z) < 3) this.hit({ f, p }, 2); }
  }
  spark(x, y, z, n) { for (let q = 0; q < n; q++) this.fx2.push({ k: 'flash', x, y, z, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 6, g: 9, t: 0, life: 0.25, s: 0.35 }); }
  debris(x, y, z, n) { for (let q = 0; q < n; q++) this.fx2.push({ k: 'scrap', v: q % 3, x, y, z, vx: (Math.random() - 0.5) * 7, vy: 2 + Math.random() * 5, vz: (Math.random() - 0.5) * 7, g: 14, t: 0, life: 1.2, s: 0.4 }); }

  // ------------------------------------------------ the autopilot: the nearest threat, then the nearest foe
  autopilot(dt) {
    if (!this.ready || !this.camPos) return;
    if (this.choice < 0 && this.d > this.Jd - 70 && this.R2() < dt) this.choose(this.R2() < 0.5 ? 0 : 1);
    let best = null, bs = 1e9;
    const cons = (p, pri) => { const q = this.toScreen(p); if (!q || q.z <= 0 || q.x < 10 || q.x > W - 10 || q.y < 20 || q.y > H - 60) return; const sc = q.z - pri; if (sc < bs) { bs = sc; best = q; } };
    for (const s of this.shots) cons(s, 25);
    for (const f of this.foes) if (!f.dead && f.t >= 0) { const p = this.foePos(f); cons({ x: p.x, y: p.y + FOE[f.k].h * 0.5, z: p.z }, f.k === 'bat' ? 18 : 0); }
    if (this.boss && !this.bossDone) for (const co of this.boss.cores) if (co.hp > 0 && co.x !== undefined) cons(co, 5);
    for (const cr of this.crates) if (this.hp < 6 || cr.k) cons(this.place(cr.d, cr.side, 0.5), -6);
    const tx = best ? best.x : W / 2 + Math.sin(this.t * 0.5) * 40, ty = best ? best.y : H * 0.45 + Math.sin(this.t * 0.7) * 20, k = Math.min(1, dt * 9);
    this.aim.x += (tx - this.aim.x) * k; this.aim.y += (ty - this.aim.y) * k;
    this.firing = !!best && Math.hypot(tx - this.aim.x, ty - this.aim.y) < 14 && this.over <= 0 && this.heat < 0.92;
  }
  // ------------------------------------------------ touch: drag to aim and hold to fire; tap the arrows at a junction
  junctionOpen() { return this.choice < 0 && this.d > this.Jd - 95 && this.d < this.Jd; }
  down(x, y) {
    if (this.junctionOpen() && y > H * 0.3 && y < H * 0.62 && (x < 70 || x > W - 70)) { this.choose(x < W / 2 ? 0 : 1); return; }
    this.aim.x = x; this.aim.y = Math.min(y, H - 40); this.firing = true;
  }
  move(x, y) { this.aim.x = x; this.aim.y = Math.min(y, H - 40); }
  up() { this.firing = false; }
  tap(x, y) { this.down(x, y); this.fire(); this.firing = false; }

  // ------------------------------------------------ GPU side
  start() {
    const i = live.indexOf(this); if (i >= 0) live.splice(i, 1); live.push(this);
    while (live.length > 2) { const old = live.find((g) => g !== this && !g.running); if (!old) break; old.dropGpu(); }
    super.start();
  }
  dropGpu(lost = false) {
    const i = live.indexOf(this); if (i >= 0) live.splice(i, 1);
    const gl = this.gl; this.gl = null;
    if (!gl || lost) return;
    this.freeScene(gl);
  }
  freeScene(gl) {
    const seen = new Set(), free = (o) => { if (!o || seen.has(o)) return; seen.add(o); o.dispose?.(); };
    gl.scene.traverse((o) => { free(o.geometry); if (Array.isArray(o.material)) o.material.forEach(free); else free(o.material); });
    for (const t of gl.textures) free(t);
    for (const m of gl.mats.values()) free(m);
  }
  rebuildGpu() { if (!this.gl) return; this.freeScene(this.gl); this.gl = null; this.buildGpu(); }
  texOf(gl, key, cv, rep = false) {
    let t = gl.texs.get(key);
    if (!t) { t = new T.CanvasTexture(cv); t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; if (rep) t.wrapS = t.wrapT = T.RepeatWrapping; gl.textures.push(t); gl.texs.set(key, t); }
    return t;
  }
  spriteMat(gl, kind, f = 0, v = 0, add = false) {
    const key = `${kind}|${f}|${v}|${add ? 1 : 0}`;
    let m = gl.mats.get(key);
    if (!m) { m = new T.SpriteMaterial({ map: this.texOf(gl, `s|${kind}|${f}|${v}`, A.sprite(kind, f, v)), transparent: true, alphaTest: add ? 0 : 0.4, fog: !add, depthWrite: !add, blending: add ? T.AdditiveBlending : T.NormalBlending }); gl.mats.set(key, m); }
    return m;
  }
  buildGpu() {
    const th = this.th, sc = new T.Scene();
    sc.background = new T.Color(th.bg); sc.fog = new T.Fog(th.fog[0], th.fog[1], th.fog[2]);
    const cam = new T.PerspectiveCamera(FOV, RW / RH, 0.1, 700);
    const gl = (this.gl = { scene: sc, cam, textures: [], texs: new Map(), mats: new Map(), chunks: new Map(), pool: [], frame: 0 });
    // the far skyline: rings of silhouettes round the camera that turn slower than you do
    if (th.sky) {
      gl.pano = [];
      const grad = document.createElement('canvas'); grad.width = 4; grad.height = 128; const gx = grad.getContext('2d'), gg = gx.createLinearGradient(0, 0, 0, 128);
      gg.addColorStop(0, this.key === 'city' ? '#6a6a50' : '#6a90c0'); gg.addColorStop(0.6, this.key === 'city' ? '#c8c088' : '#f0b878'); gg.addColorStop(1, this.key === 'city' ? '#d8d0a0' : '#f8d8a8'); gx.fillStyle = gg; gx.fillRect(0, 0, 4, 128);
      const sky = new T.Mesh(new T.CylinderGeometry(420, 420, 600, 24, 1, true), new T.MeshBasicMaterial({ map: this.texOf(gl, 'grad', grad), side: T.BackSide, fog: false, depthWrite: false }));
      sky.renderOrder = -3; sc.add(sky); gl.sky = sky;
      for (let l = 0; l < 3; l++) {
        const t = this.texOf(gl, `pano${l}`, A.pano(this.key, l), true); t.repeat.set(3, 1);
        const m = new T.Mesh(new T.CylinderGeometry(380 - l * 70, 380 - l * 70, 150 - l * 10, 32, 1, true), new T.MeshBasicMaterial({ map: t, side: T.BackSide, transparent: true, fog: false, depthWrite: false, color: new T.Color().setScalar(0.75 + l * 0.1) }));
        m.renderOrder = -2 + l * 0.1; sc.add(m); gl.pano.push(m);
      }
    }
    gl.mat = {
      wall: new T.MeshBasicMaterial({ map: this.texOf(gl, 'wall', A.tex(th.wall || 'rock'), true), vertexColors: true }),
      floor: new T.MeshBasicMaterial({ map: this.texOf(gl, 'floor', A.tex(th.floor || th.ground || 'gravel'), true), vertexColors: true }),
      ground: new T.MeshBasicMaterial({ map: this.texOf(gl, 'ground', A.tex(th.ground || th.floor || 'gravel'), true) }),
      timber: new T.MeshBasicMaterial({ map: this.texOf(gl, 'timber', A.tex('timber'), true) }),
      iron: new T.MeshBasicMaterial({ map: this.texOf(gl, 'iron', A.tex('iron'), true) }),
      rail: new T.MeshBasicMaterial({ color: 0x8a8a96 }),
      sleeper: new T.MeshBasicMaterial({ map: this.texOf(gl, 'plank', A.tex('plank'), true) }),
      molten: new T.MeshBasicMaterial({ color: 0xff7a1a, fog: false })
    };
    for (const m of Object.values(gl.mat)) gl.mats.set(`m|${m.uuid}`, m);
    // a pool of sprites for foes, shots, crates and effects, reused frame to frame
    for (let q = 0; q < 140; q++) { const s = new T.Sprite(this.spriteMat(gl, 'flash')); s.center.set(0.5, 0); s.visible = false; sc.add(s); gl.pool.push(s); }
    gl.bossSpr = new T.Sprite(this.spriteMat(gl, 'flash')); gl.bossSpr.center.set(0.5, 0); gl.bossSpr.visible = false; sc.add(gl.bossSpr);
  }
  // ------------------------------------------------ the world, built a chunk at a time ahead of the cart
  chunkKey(b, c) { return `${b}|${c}`; }
  buildChunk(gl, b, c) {
    // b: -1 the trunk (before the junction), 0 or 1 a branch; c: the chunk index along it (40 units)
    const th = this.th, f = b < 0 ? this.track[0] : this.track[b + 1], d0 = c * 40, d1 = Math.min(f.n - 2, d0 + 40);
    if (d1 - d0 < 2) return null;
    const grp = new T.Group(), R = mulberry32((this.stageN * 7919 + c * 131 + (b + 2) * 31 + (this.post.seed || 1)) >>> 0);
    const P = (i) => ({ x: f.x[i], y: f.y[i], z: f.z[i], rx: -Math.cos(f.yaw[i]), rz: Math.sin(f.yaw[i]), fx: Math.sin(f.yaw[i]), fz: Math.cos(f.yaw[i]), piece: f.pieces[f.piece[i]] });
    // a ribbon along the line: for each unit, points across it from side a to b at height h
    const ribbon = (mat, a, bb, h, uS, vS, shadeFn, step = 1) => {
      const pos = [], uv = [], col = [], idx = [];
      let n = 0;
      for (let i = d0; i <= d1; i += step) {
        const p = P(i);
        for (const [s, u] of [[a, 0], [bb, 1]]) { pos.push(p.x + p.rx * s, p.y + h, p.z + p.rz * s); uv.push(u * uS, (i * vS) % 1000); const k = shadeFn ? shadeFn(i, s) : 1; col.push(k, k, k); }
        if (n) idx.push((n - 1) * 2, (n - 1) * 2 + 1, n * 2, (n - 1) * 2 + 1, n * 2 + 1, n * 2);
        n++;
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      const m = new T.Mesh(g, mat); grp.add(m); return m;
    };
    // the lamps along the way (their light is baked into the walls' colours)
    const lamps = [];
    for (let i = Math.ceil(d0 / 9) * 9; i < d1; i += 9) lamps.push([i, (i / 9) % 2 ? 1 : -1]);
    const lit = (i, s) => { let k = th.env === 'tunnel' ? 0.32 : 0.55; for (const [li, ls] of lamps) { const dd = Math.abs(i - li); k += Math.exp(-(dd * dd) / 18) * (Math.sign(s) === ls ? 0.9 : 0.4); } return Math.min(1.2, k); };
    // the track: ballast, sleepers, two rails (and the next track over where there is one)
    ribbon(gl.mat.floor, -1.6, 1.6, -0.06, 1, 0.25, th.env === 'tunnel' ? lit : null);
    const sleepers = new T.InstancedMesh(new T.BoxGeometry(2.4, 0.14, 0.32), gl.mat.sleeper, Math.ceil(d1 - d0) + 1), m4 = new T.Matrix4(), q4 = new T.Quaternion(), e4 = new T.Euler(), v3 = new T.Vector3(), s3 = new T.Vector3(1, 1, 1);
    let ns = 0;
    for (let i = d0; i < d1; i++) { const p = P(i); e4.set(f.pit[i] * -1, f.yaw[i], 0, 'YXZ'); q4.setFromEuler(e4); m4.compose(v3.set(p.x, p.y + 0.02, p.z), q4, s3); sleepers.setMatrixAt(ns++, m4); }
    sleepers.count = ns; if (ns) grp.add(sleepers);
    for (const s of [-0.72, 0.72]) { ribbon(gl.mat.rail, s - 0.06, s + 0.06, 0.2, 1, 1); ribbon(gl.mat.rail, s - 0.06, s - 0.06 + 0.001, 0.2, 1, 1); }
    const twin = (i) => P(i).piece?.twin;
    if (twin(d0) || twin(d1 - 1)) { ribbon(gl.mat.floor, 2.0, 4.8, -0.06, 1, 0.25); for (const s of [2.68, 4.12]) ribbon(gl.mat.rail, s - 0.06, s + 0.06, 0.2, 1, 1); }
    // the surroundings
    if (th.env === 'tunnel') {
      // a rough arch of rock round the line, timber frames holding it up, lamps on them
      const pos = [], uv = [], col = [], idx = [], A0 = -0.12 * Math.PI, A1 = 1.12 * Math.PI, NA = 10;
      let n = 0;
      for (let i = d0; i <= d1; i += 1) {
        const p = P(i);
        for (let a = 0; a <= NA; a++) { const an = A0 + ((A1 - A0) * a) / NA, r = 4.4 + Math.sin(i * 0.7 + a * 1.9) * 0.35 + Math.sin(i * 0.23 + a) * 0.3; pos.push(p.x + p.rx * Math.cos(an) * r, p.y + 1.1 + Math.sin(an) * r * 0.95, p.z + p.rz * Math.cos(an) * r); uv.push((a / NA) * 3, (i / 4) % 1000); const k = lit(i, Math.cos(an)) * (0.7 + Math.sin(an) * 0.2); col.push(k, k * 0.92, k * 0.8); }
        if (n) for (let a = 0; a < NA; a++) { const p0 = (n - 1) * (NA + 1) + a, p1 = n * (NA + 1) + a; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
        n++;
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      const tube = new T.Mesh(g, gl.mat.wall); tube.material.side = T.DoubleSide; grp.add(tube);
      ribbon(gl.mat.floor, -4.4, -1.6, -0.1, 1, 0.25, lit); ribbon(gl.mat.floor, 1.6, 4.4, -0.1, 1, 0.25, lit);
      const posts = new T.InstancedMesh(new T.BoxGeometry(0.35, 4.6, 0.35), gl.mat.timber, 20), beams = new T.InstancedMesh(new T.BoxGeometry(7.2, 0.4, 0.4), gl.mat.timber, 10);
      let np = 0, nb = 0;
      for (let i = Math.ceil(d0 / 6) * 6; i < d1; i += 6) { const p = P(i); e4.set(0, f.yaw[i], 0); q4.setFromEuler(e4); for (const s of [-3.4, 3.4]) { m4.compose(v3.set(p.x + p.rx * s, p.y + 2.2, p.z + p.rz * s), q4, s3); posts.setMatrixAt(np++, m4); } m4.compose(v3.set(p.x, p.y + 4.5, p.z), q4, s3); beams.setMatrixAt(nb++, m4); }
      posts.count = np; beams.count = nb; if (np) grp.add(posts); if (nb) grp.add(beams);
    } else if (th.env === 'hall') {
      // a great hall: walls well out to each side, a dark roof of girders, the floor; in the foundry
      // a channel of molten iron runs along one side
      const wl = (i, s) => lit(i, s) * 0.9;
      ribbon(gl.mat.floor, -12, -1.6, -0.1, 3, 0.25, wl); ribbon(gl.mat.floor, 1.6, 12, -0.1, 3, 0.25, wl);
      const wall = (s) => { const pos = [], uv = [], col = [], idx = []; let n = 0; for (let i = d0; i <= d1; i++) { const p = P(i); for (const [hh, u] of [[-0.1, 0], [15, 1]]) { pos.push(p.x + p.rx * s, p.y + hh, p.z + p.rz * s); uv.push(u * 3, (i / 4) % 1000); const k = wl(i, s) * (hh > 1 ? 0.5 : 1); col.push(k, k * 0.9, k * 0.8); } if (n) idx.push((n - 1) * 2, n * 2, (n - 1) * 2 + 1, (n - 1) * 2 + 1, n * 2, n * 2 + 1); n++; } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); const me = new T.Mesh(g, gl.mat.wall); me.material.side = T.DoubleSide; grp.add(me); };
      wall(-12); wall(12);
      ribbon(gl.mat.iron, -12, 12, 15, 4, 0.25);
      if (th.molten) { const m = ribbon(gl.mat.molten, 7, 10, 0.02, 1, 1); m.renderOrder = 1; }
      const girders = new T.InstancedMesh(new T.BoxGeometry(24, 0.6, 0.5), gl.mat.iron, 8); let ng = 0;
      for (let i = Math.ceil(d0 / 7) * 7; i < d1; i += 7) { const p = P(i); e4.set(0, f.yaw[i], 0); q4.setFromEuler(e4); m4.compose(v3.set(p.x, p.y + 12, p.z), q4, s3); girders.setMatrixAt(ng++, m4); }
      girders.count = ng; if (ng) grp.add(girders);
    } else {
      // out in the open: a viaduct over the smog city, or a timber trestle over the canyon; the
      // ground far below
      const drop = th.env === 'open' ? 16 : 30, pmat = th.env === 'open' ? gl.mat.iron : gl.mat.timber;
      const pos = [], uv = [], idx = []; let n = 0;
      for (let i = d0; i <= d1; i += 2) { const p = P(i); for (const [s, u] of [[-160, 0], [160, 1]]) { pos.push(p.x + p.rx * s, Math.min(p.y, f.y[0]) - drop, p.z + p.rz * s); uv.push(u * 40, (i / 8) % 1000); } if (n) idx.push((n - 1) * 2, (n - 1) * 2 + 1, n * 2, (n - 1) * 2 + 1, n * 2 + 1, n * 2); n++; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); grp.add(new T.Mesh(g, gl.mat.ground));
      const posts = new T.InstancedMesh(new T.BoxGeometry(0.5, 1, 0.5), pmat, 24); let np = 0;
      for (let i = Math.ceil(d0 / 5) * 5; i < d1; i += 5) { const p = P(i), hgt = p.y - (Math.min(p.y, f.y[0]) - drop); e4.set(0, f.yaw[i], 0); q4.setFromEuler(e4); for (const s of [-1.2, 1.2]) { m4.compose(v3.set(p.x + p.rx * s, p.y - hgt / 2, p.z + p.rz * s), q4, v3.clone().set(1, hgt, 1)); posts.setMatrixAt(np++, m4); } }
      posts.count = np; if (np) grp.add(posts);
      ribbon(pmat, -1.7, 1.7, -0.25, 1, 0.25);
    }
    // billboards: the stage's props along both sides, now and then something big further out
    const props = th.props, sprites = [];
    const add = (kind, i, s, up, w, h, v = 0, f2 = 0) => { const p = P(i), sp = new T.Sprite(this.spriteMat(gl, kind, f2, v)); sp.center.set(0.5, 0); sp.position.set(p.x + p.rx * s, p.y + up, p.z + p.rz * s); sp.scale.set(w, h, 1); grp.add(sp); sprites.push({ sp, kind, base: sp.material }); return sp; };
    for (let i = d0 + (R() * 4 | 0); i < d1; i += 3 + (R() * 5 | 0)) {
      const kind = props[(R() * props.length) | 0], s = (R() < 0.5 ? -1 : 1);
      if (th.env === 'tunnel') {
        if (kind === 'lantern') continue;
        add(kind, i, s * (2.4 + R() * 1), 0, kind === 'chains' ? 0.5 : kind === 'barrel' ? 0.8 : 1.6, kind === 'chains' ? 4 : kind === 'barrel' ? 1 : 1.2, (R() * 4) | 0);
      } else if (th.env === 'hall') {
        const far = 5 + R() * 6, big = kind === 'gear' ? 3 + R() * 4 : kind === 'boiler' ? 2.6 : kind === 'pillar' ? 2 : 1.6;
        const hh = kind === 'pillar' ? 15 : kind === 'chains' ? 6 : kind === 'gear' ? big : big * 1.6;
        add(kind, i, s * far, kind === 'chains' ? 8 : kind === 'gear' ? 1 + R() * 6 : 0, kind === 'chains' ? 0.6 : kind === 'pillar' ? 1.4 : big, hh, (R() * 4) | 0);
      } else if (th.env === 'open') {
        const far = 8 + R() * 50, drop = 16;
        if (kind === 'skyship') add(kind, i, s * (40 + R() * 60), 8 + R() * 20, 14, 6);
        else if (kind === 'chimney') add(kind, i, s * far, -drop, 2.4, 11 + R() * 8);
        else add('facade', i, s * far, -drop, 6 + R() * 4, 12 + R() * 14, (R() * 4) | 0);
      } else {
        const far = 6 + R() * 70;
        if (kind === 'mesa') add(kind, i, s * (40 + R() * 80), -30, 26 + R() * 20, 30 + R() * 26);
        else add(kind, i, s * far, -30, kind === 'spire' ? 5 : 1.4, kind === 'spire' ? 14 + R() * 10 : 2.6);
      }
    }
    // lanterns where the light is baked
    if (th.env === 'tunnel') for (const [li, ls] of lamps) if (li >= d0 && li < d1) add('lantern', li, ls * 3.1, 2.6, 0.5, 1.3);
    else if (th.env === 'hall') for (const [li, ls] of lamps) if (li >= d0 && li < d1) add('lantern', li, ls * 11.4, 4, 0.8, 2.1);
    gl.scene.add(grp);
    return { grp, sprites };
  }
  // keep the chunks round the cart built, and drop the ones behind (and the branch not taken)
  syncChunks(gl) {
    const want = new Set(), ahead = this.th.fog[2] + 40, b = this.choice;
    const need = (br, d0, d1) => { for (let c = Math.max(0, Math.floor(d0 / 40)); c <= Math.floor(d1 / 40); c++) want.add(this.chunkKey(br, c)); };
    const lo = this.d - 30, hi = this.d + ahead;
    if (lo < this.Jd) need(-1, lo, Math.min(hi, this.Jd));
    if (hi > this.Jd) for (const br of b >= 0 ? [b] : [0, 1]) need(br, Math.max(0, lo - this.Jd), hi - this.Jd);
    let built = 0;
    for (const k of want) if (!gl.chunks.has(k) && (built < 2 || gl.frame < 4)) { const [br, c] = k.split('|').map(Number); const ch = this.buildChunk(gl, br, c); gl.chunks.set(k, ch); built++; }
    for (const [k, ch] of gl.chunks) if (!want.has(k)) { if (ch) { gl.scene.remove(ch.grp); ch.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } gl.chunks.delete(k); }
  }
  sync(gl, dt) {
    const th = this.th, cam = gl.cam, p = this.at(this.d), ahead = this.at(this.d + 7);
    gl.frame++;
    this.syncChunks(gl);
    // the camera rides the cart: a little sway, the kick of the guns, a glance toward the crosshair
    const sk = (this.shake = Math.max(0, (this.shake || 0) - dt)), jx = (Math.random() - 0.5) * sk * 0.3, jy = (Math.random() - 0.5) * sk * 0.3;
    const sway = Math.sin(this.d * 0.9) * 0.05, eye = { x: p.x + p.rx * sway + jx, y: p.y + 1.75 + Math.abs(Math.sin(this.d * 1.7)) * 0.04 + jy, z: p.z + p.rz * sway };
    this.camPos = eye;
    const gx = (this.aim.x / W - 0.5) * 2.2, gy = (0.46 - this.aim.y / H) * 1.6;
    cam.position.set(eye.x, eye.y, eye.z);
    cam.lookAt(ahead.x + ahead.rx * gx, ahead.y + 1.6 + gy - this.recoil * 0.05, ahead.z + ahead.rz * gx);
    cam.updateMatrixWorld(); this.cam3 = cam;
    if (gl.sky) { gl.sky.position.copy(cam.position); gl.pano.forEach((m, l) => { m.position.set(cam.position.x, cam.position.y + 30 - l * 12, cam.position.z); m.rotation.y = -p.yaw * (0.25 + l * 0.25); }); }
    // the pool: foes, shots, crates, effects and the boss, each a sprite this frame
    let k = 0;
    const put = (kind, f, v, x, y, z, w, h, add = false, rot = 0) => { const s = gl.pool[k++]; if (!s) return; s.visible = true; s.material = this.spriteMat(gl, kind, f, v, add); s.material.rotation = rot; s.position.set(x, y, z); s.scale.set(w, h, 1); s.center.set(0.5, add ? 0.5 : 0); };
    for (const f of this.foes) {
      if (f.t < 0) continue;
      const q = this.foePos(f), F = FOE[f.k], dying = f.dead ? Math.min(1, (f.dt2 || 0) / 0.5) : 0;
      if (dying && Math.floor(f.dt2 * 20) % 2) continue;
      put(f.k, f.fr, f.k === 'soldier' ? (f.ph * 3) | 0 : 0, q.x, q.y - dying * F.h * 0.6, q.z, F.w, F.h * (1 - dying * 0.4));
    }
    for (const s of this.shots) put(s.k, Math.floor(this.t * 10) % 2, 0, s.x, s.y, s.z, s.k === 'bolt' ? 0.7 : 0.5, s.k === 'bolt' ? 0.7 : 0.5, s.k === 'bolt', s.k === 'dynamite' ? s.t * 8 : 0);
    for (const cr of this.crates) { if (!(cr.b === this.choice || cr.b < 0 || this.choice < 0)) continue; const q = this.place(cr.d, cr.side, 0); put('crate', 0, cr.k, q.x, q.y, q.z, 0.9, 0.9); }
    for (const e of this.fx2) { const cp = this.camPos, near = cp ? Math.hypot(e.x - cp.x, e.y - cp.y, e.z - cp.z) : 9; if (near < 1.6) continue; const sz = e.s * (e.k === 'smoke' ? 1 + e.t : 1) * Math.min(1, near / 4); put(e.k, 0, e.v || 0, e.x, e.y, e.z, sz, sz, e.k === 'flash', e.k === 'scrap' ? e.t * 9 : 0); }
    // the boss and its glowing cores
    const b = this.boss;
    if (b && b.pos) {
      const B = b.B, bs = gl.bossSpr, dying = this.bossDone ? Math.min(1, b.t / 3) : 0;
      bs.visible = !(dying && Math.floor(b.t * 12) % 2); bs.material = this.spriteMat(gl, b.k, Math.floor(this.t * 4) % 2); bs.position.set(b.pos.x, b.pos.y - dying * 3, b.pos.z); bs.scale.set(B.w * b.sc, B.h * b.sc, 1);
      for (const co of b.cores) if (co.hp > 0 && co.x !== undefined) put('core', Math.floor(this.t * 6) % 2, 0, co.x, co.y, co.z, 1.3, 1.3, true);
    } else gl.bossSpr.visible = false;
    for (; k < gl.pool.length; k++) gl.pool[k].visible = false;
    // things that turn: the clockworks' gears; the foundry's pistons pump
    if (gl.frame % 2 === 0) { this.spriteMat(gl, 'gear').rotation = this.t * 0.6; for (const ch of gl.chunks.values()) if (ch) for (const s of ch.sprites) if (s.kind === 'piston') s.sp.material = this.spriteMat(gl, 'piston', Math.floor(this.t * 5) % 4); }
  }
  toScreen(p) {
    const cam = this.cam3; if (!cam) return null;
    const v = (this._v ||= new T.Vector3()).set(p.x, p.y, p.z), z = v.clone().applyMatrix4(cam.matrixWorldInverse).z;
    v.project(cam);
    return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, z: -z };
  }

  // ------------------------------------------------ drawing
  draw(c) {
    c.fillStyle = '#0c0a08'; c.fillRect(0, 0, W, H);
    if (this.failed) { this.text(c, '3D unavailable on this device', W / 2, H / 2, 13); return; }
    if (!this.ready || !T) { this.text(c, 'stoking the boiler…', W / 2, H / 2, 13, '#d8b878'); return; }
    let r;
    try { r = renderer(); } catch (e) { this.failed = String(e?.message || e); return; }
    if (!this.gl) this.buildGpu();
    const gl = this.gl, now = performance.now(), dt = Math.min(0.05, (now - (gl.last || now)) / 1000);
    gl.last = now;
    this.sync(gl, dt);
    r.setClearColor(gl.scene.background, 1); r.clear(); r.render(gl.scene, gl.cam);
    c.imageSmoothingEnabled = false; c.drawImage(r.domElement, 0, 0, W, H);
    // the stage's air (soot, smog, furnace light) laid over the picture
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.35; c.fillStyle = this.th.tint; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    this.drawGuns(c); this.drawFilm(c); this.drawHud(c);
  }
  // the twin repeaters at the bottom of the view: brass barrels, a boiler between, recoil and flash
  gunSprite(side) {
    const key = `gun${side}`;
    if (this[key]) return this[key];
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 70; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    P(22, 0, 14, 50, '#5a5a62'); P(22, 0, 4, 50, '#8a8a94'); P(32, 0, 4, 50, '#3a3a42'); for (let y = 4; y < 48; y += 9) P(20, y, 18, 3, '#b8903a');
    P(18, 0, 22, 5, '#3a3a42'); P(24, 1, 10, 3, '#0c0a08');
    P(10, 40, 40, 30, '#8a6a2a'); P(10, 40, 40, 4, '#c89a4a'); P(44, 40, 6, 30, '#5a4420'); for (const x of [14, 24, 34, 44]) P(x, 48, 2, 2, '#f0d07a');
    P(side < 0 ? 0 : 50, 52, 14, 18, '#5a3a24'); P(side < 0 ? 2 : 52, 56, 10, 4, '#3a2418');
    A.soot(cv, 0.6, side + 9);
    return (this[key] = cv);
  }
  drawGuns(c) {
    const rc = this.recoil * 6;
    for (const s of [-1, 1]) {
      const g = this.gunSprite(s), x = W / 2 + s * 92 - 32 + (this.aim.x - W / 2) * 0.12, y = H - 78 + rc * (this.side === (s > 0) ? 1 : 0.4) + (this.aim.y - H / 2) * 0.05;
      c.save(); c.translate(x + 32, y + 70); c.rotate(s * -0.18 + (this.aim.x - W / 2) * 0.0008); c.drawImage(g, -32, -70, 64, 70); c.restore();
      if (this.flashT > 0 && this.side === (s > 0)) { const fx = x + 32 + s * -8, fy = y - 2; c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(fx, fy, 1, fx, fy, 22); gr.addColorStop(0, 'rgba(255,240,190,.95)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); c.fillStyle = gr; c.fillRect(fx - 22, fy - 22, 44, 44); c.globalCompositeOperation = 'source-over'; c.strokeStyle = 'rgba(255,220,140,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, fy); c.lineTo(this.aim.x, this.aim.y); c.stroke(); }
    }
  }
  drawFilm(c) {
    const film = (this.filmCv ||= Array.from({ length: 4 }, (_, k) => {
      const cv = document.createElement('canvas'), w = 180, h = 210; cv.width = w; cv.height = h; const x = cv.getContext('2d'), im = x.createImageData(w, h), d = im.data, R = mulberry32(k * 977 + 3);
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const i = (y * w + xx) * 4, dx = (xx - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2), v = clamp((Math.hypot(dx * 0.9, dy) - 0.5) / 0.7, 0, 1), g = R(); if (g > 0.97) { d[i] = 220; d[i + 1] = 200; d[i + 2] = 160; d[i + 3] = 40; } else { d[i] = 10; d[i + 1] = 6; d[i + 2] = 2; d[i + 3] = Math.round((v * v * 0.75 + (g < 0.12 ? 0.08 : 0)) * 255); } }
      x.putImageData(im, 0, 0); return cv;
    }));
    c.imageSmoothingEnabled = false; c.drawImage(film[Math.floor(this.t * 24) % 4], 0, 0, W, H); c.imageSmoothingEnabled = true;
    if (this.hurtT > 0) { c.fillStyle = `rgba(200,30,10,${(this.hurtT * 0.7).toFixed(3)})`; c.fillRect(0, 0, W, H); c.strokeStyle = `rgba(240,230,220,${(this.hurtT * 1.2).toFixed(3)})`; c.lineWidth = 1; c.beginPath(); for (let q = 0; q < 6; q++) { const a = q * 1.1 + 0.4, r0 = 10, r1 = 70 + q * 9; c.moveTo(W * 0.7 + Math.cos(a) * r0, H * 0.3 + Math.sin(a) * r0); c.lineTo(W * 0.7 + Math.cos(a) * r1, H * 0.3 + Math.sin(a) * r1); } c.stroke(); }
  }
  drawHud(c) {
    const t = this.t;
    // the crosshair: a brass ring with ticks; red when it is over something, grey when the guns overheat
    const over = this.under(this.aim.x, this.aim.y, this.upg === 'spread' ? 2.2 : 1).length > 0, col = this.over > 0 ? '#8a8a8a' : over ? '#ff5a3a' : '#f0c870';
    c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.arc(this.aim.x, this.aim.y, this.upg === 'spread' ? 15 : 10, 0, TAU); c.stroke();
    c.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.moveTo(this.aim.x + dx * 6, this.aim.y + dy * 6); c.lineTo(this.aim.x + dx * 15, this.aim.y + dy * 15); } c.stroke();
    // the pressure gauge (your steam: health), the heat bar, the score
    const gx = 30, gy = 30;
    c.fillStyle = '#2a2018'; c.beginPath(); c.arc(gx, gy, 21, 0, TAU); c.fill(); c.strokeStyle = '#c89a4a'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#efe6d0'; c.beginPath(); c.arc(gx, gy, 16, 0, TAU); c.fill();
    c.strokeStyle = '#c83a2a'; c.lineWidth = 3; c.beginPath(); c.arc(gx, gy, 13, Math.PI * 0.75, Math.PI * 1.05); c.stroke();
    for (let q = 0; q <= 8; q++) { const a = Math.PI * 0.75 + (q / 8) * Math.PI * 1.5; c.fillStyle = '#3a2a1a'; c.fillRect(gx + Math.cos(a) * 12 - 1, gy + Math.sin(a) * 12 - 1, 2, 2); }
    const na = Math.PI * 0.75 + (this.hp / 8) * Math.PI * 1.5 + Math.sin(t * 30) * 0.02;
    c.strokeStyle = '#2a1a10'; c.lineWidth = 2; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(na) * 12, gy + Math.sin(na) * 12); c.stroke(); c.fillStyle = '#b8903a'; c.beginPath(); c.arc(gx, gy, 3, 0, TAU); c.fill();
    c.fillStyle = '#2a2018'; c.fillRect(56, 22, 62, 10); c.fillStyle = this.over > 0 ? (Math.floor(t * 8) % 2 ? '#ff5a3a' : '#8a2a1a') : this.heat > 0.7 ? '#ff8a3a' : '#e8c060'; c.fillRect(57, 23, 60 * this.heat, 8); c.strokeStyle = '#c89a4a'; c.lineWidth = 1; c.strokeRect(56, 22, 62, 10);
    this.text(c, String(Math.floor(this.score)).padStart(6, '0'), W - 12, 24, 14, '#f0d07a', 'right');
    if (this.upg) { this.text(c, this.upg.toUpperCase(), 87, 44, 9, '#9fe0ff'); c.fillStyle = '#9fe0ff'; c.fillRect(57, 51, 60 * (this.upgT / 12), 2); }
    // the stage's name as it begins, and as it is cleared
    if (this.banner > 0) {
      const a = Math.min(1, this.banner, 3.2 - this.banner + 0.3), msg = this.deadT > 0 ? 'BOILER BURST' : this.clearT > 0 ? 'LINE CLEARED' : this.boss && !this.bossDone ? 'SOMETHING BIG ON THE LINE' : this.th.name;
      c.globalAlpha = clamp(a, 0, 1); c.fillStyle = 'rgba(14,10,6,.6)'; c.fillRect(0, H * 0.22, W, 30); this.text(c, msg, W / 2 + 1, H * 0.22 + 16, 15, '#000'); this.text(c, msg, W / 2, H * 0.22 + 15, 15, this.deadT > 0 ? '#ff6a3a' : '#f0d07a'); c.globalAlpha = 1;
    }
    // a junction ahead: two arrows to pick the line
    if (this.junctionOpen()) {
      const pulse = 0.6 + Math.sin(t * 6) * 0.3;
      for (const s of [-1, 1]) { const x = s < 0 ? 34 : W - 34, y = H * 0.46; c.globalAlpha = pulse; c.fillStyle = '#2a2018'; c.beginPath(); c.arc(x, y, 24, 0, TAU); c.fill(); c.strokeStyle = '#f0c870'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#f0d07a'; c.beginPath(); c.moveTo(x + s * 12, y); c.lineTo(x - s * 6, y - 12); c.lineTo(x - s * 6, y + 12); c.closePath(); c.fill(); c.globalAlpha = 1; }
      this.text(c, 'PICK YOUR LINE', W / 2, H * 0.46 - 40, 11, '#f0d07a');
    }
    if (this.pickT > 0) { this.pickT -= 1 / 60; this.text(c, ['STEAM +2', 'SPREAD SHOT', 'RAPID FIRE', 'EXPLOSIVE ROUNDS'][this.pickK], W / 2, H * 0.6, 12, '#9fe0ff'); }
  }
}
