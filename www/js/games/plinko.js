// Plinko: drop balls through a board of posts. Every post deals its own board: peg layout and post shapes,
// automatic pinball flippers, pop bumpers, spinners, kickers and ledges, a kit of falling materials (sand, water,
// lava, oil, gunpowder) and a mix of balls: sand-filled, water balloons, firecrackers, gunpowder sacks, lava blobs
// and critters that pop into confetti. Hits build a combo that multiplies the slot a ball lands in; special slots,
// streaks and big combos set off events (fever, stampedes, storms, fireworks).
import { Game, W, H, drawFit, ready } from './engine.js';
import { Materials, Fx, Tail, TAILS, glowSprite, SAND, WATER, OIL, LAVA, POWDER, FIRE, SMOKE, SPARK, EMBER } from './materials.js';

const TAU = Math.PI * 2, SLOT_Y = H - 44, GC = 40;
const KITS = [
  { n: 'sand', mats: [SAND], mix: { ball: 3, sand: 5, animal: 2, cracker: 1 } },
  { n: 'beach', mats: [SAND, WATER], mix: { ball: 2, sand: 3, water: 3, animal: 2 } },
  { n: 'powder', mats: [POWDER, SAND], mix: { ball: 2, powder: 3, cracker: 3, animal: 1, sand: 1 } },
  { n: 'volcano', mats: [LAVA, WATER], mix: { ball: 2, lava: 3, water: 3, cracker: 1 } },
  { n: 'refinery', mats: [OIL, POWDER], mix: { ball: 2, oil: 3, cracker: 3, powder: 1 } },
  { n: 'zoo', mats: [SAND, WATER], mix: { ball: 1, animal: 6, water: 1, cracker: 1 } },
  { n: 'fireworks', mats: [POWDER, SAND, WATER], mix: { ball: 2, cracker: 4, animal: 2, sand: 1, water: 1 } }
];
const LAYOUTS = ['classic', 'wave', 'grid', 'pyramid', 'scatter', 'hex', 'rings', 'chevron', 'diamonds', 'columns'];
const LOOKS = ['dot', 'ring', 'gem', 'nut', 'candy', 'sprite', 'neon'];
const PEGS = { pin: [0.5, 1, 1], post: [0.5, 1, 1], rubber: [0.95, 2, 1], gem: [0.55, 5, 2], bell: [0.6, 3, 3], crumble: [0.45, 2, 1], cracker: [0.5, 8, 2], mover: [0.6, 2, 1] }; // bounce, points, combo
const COMIC = ['POP!', 'BOING!', 'KAPOW!', 'BLAM!', 'POOF!', 'WHAM!', 'ZAP!', 'BONK!'];
const SPECIAL = { JACKPOT: '#ffd23f', BOOM: '#ff5a3c', FEVER: '#ff4fd8', STAMPEDE: '#7be36b', STORM: '#5ac8ff' };
const SPILL = { sand: SAND, water: WATER, powder: POWDER, oil: OIL, lava: LAVA };
const N = { x: 0, y: -1 }; // normal of the last contact

// ball against a capsule a→b of radius sr; a surface spinning at w about o kicks the ball. Returns impact speed.
function hitSeg(b, ax, ay, bx, by, sr, e, w = 0, ox = 0, oy = 0) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + ex * t, py = ay + ey * t, dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy, rr = b.r + sr;
  if (d2 >= rr * rr) return 0;
  const d = Math.sqrt(d2);
  N.x = d > 1e-6 ? dx / d : 0; N.y = d > 1e-6 ? dy / d : -1;
  b.x = px + N.x * rr; b.y = py + N.y * rr;
  const ux = -w * (py - oy), uy = w * (px - ox), vn = (b.vx - ux) * N.x + (b.vy - uy) * N.y;
  if (vn >= 0) return 0.01;
  b.vx -= (1 + e) * vn * N.x; b.vy -= (1 + e) * vn * N.y;
  return -vn;
}
const segD = (x, y, ax, ay, bx, by) => { const ex = bx - ax, ey = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1))); return Math.hypot(x - ax - ex * t, y - ay - ey * t); };

export class Plinko extends Game {
  setup() {
    this.kit = KITS[this.ri(0, KITS.length - 1)];
    this.layout = LAYOUTS[this.ri(0, LAYOUTS.length - 1)];
    this.look = LOOKS[this.ri(0, LOOKS.length - 1)];
    this.tail = TAILS[this.ri(0, TAILS.length - 1)];
    this.gravity = this.r(640, 900);
    this.br = 6 * this.S;
    this.mat = new Materials({ floor: 0.03, seed: this.post.seed, g: this.G });
    this.fx = new Fx();
    Object.assign(this, { balls: [], flippers: [], bumpers: [], spinners: [], kickers: [], ledges: [], hoppers: [], timers: [], spr: {} });
    this.fever = 0; this.storm = 0; this.evT = this.r(18, 28); this.streak = { i: -1, n: 0, t: 0 }; this.drainT = 0.5;
    this.slotsSetup(); this.featuresSetup(); this.pegsSetup(); this.stamp();
    const cr = this.skin.creatures || [];
    this.zoo = [...cr.slice(1, 5).map((m) => ({ f: m.frames, hurt: m.hurt || m.frames[0] })), ...this.skin.list('zoo', 3, 'animal', 'enemy').filter(Boolean).map((i) => ({ f: [i], hurt: i }))];
    this.ballArt = this.skin.list('balls', 3, 'ball', 'item');
    this.bumpArt = this.skin.pick('bump', 'item', 'enemy');
    this.crumbleMat = this.kit.mats.includes(POWDER) && this.rng() < 0.5 ? POWDER : SAND;
    this.bins = Array.from({ length: 10 }, () => 40); this.dropX = W / 2; this.aimX = this.r(60, W - 60); this.next = 0.8;
    this.nextKind = this.pickKind();
  }

  // ------------------------------------------------ board generation
  slotsSetup() {
    const n = [5, 7, 7, 9, 9, 9, 11, 6, 8][this.ri(0, 8)], sw = W / n, mid = (n - 1) / 2, scheme = this.ri(0, 4);
    const vals = Array.from({ length: n }, (_, i) => {
      const e = Math.round((Math.abs(i - mid) / mid) * 6);
      return scheme === 0 ? [1, 2, 5, 10, 25, 50, 100][e] : scheme === 1 ? [100, 50, 25, 10, 5, 2, 1][e] : scheme === 2 ? [5, 10, 20, 50][this.ri(0, 3)] : scheme === 3 ? Math.round(5 + (i / (n - 1)) * 95) : [10, 2, 25, 5, 50][i % 5];
    });
    this.slots = vals.map((v, i) => ({ v, x: i * sw, w: sw, flash: 0, sp: null }));
    const kinds = Object.keys(SPECIAL);
    for (let k = this.ri(1, 2); k > 0; k--) { const s = this.slots[this.ri(0, n - 1)]; s.sp = kinds[this.ri(0, kinds.length - 1)]; if (s.sp === 'JACKPOT') s.v = [250, 500, 1000][this.ri(0, 2)]; }
  }
  addFlipper(x, y, side, len) {
    const rest = side > 0 ? 0.5 : Math.PI - 0.5, up = side > 0 ? -0.55 : Math.PI + 0.55;
    if (this.flippers.some((f) => Math.hypot(f.x - x, f.y - y) < 80)) return;
    this.flippers.push({ x, y, len, side, rest, up, a: rest, w: 0, hold: 0, cd: this.r(0.2, 1), idle: this.r(1, 4), glow: 0 });
  }
  featuresSetup() {
    const gap = Math.max(30, this.br * 2 + 18), fl = this.rng() < 0.85 ? this.ri(0, 3) : -1;
    if (fl === 0 || fl === 3) { const y = SLOT_Y - this.r(70, 100), len = this.r(42, 52), tx = Math.cos(0.5) * len; this.addFlipper(W / 2 - gap / 2 - tx, y, 1, len); this.addFlipper(W / 2 + gap / 2 + tx, y, -1, len); }
    if (fl === 1 || fl === 3) { const y = this.r(160, 240), len = this.r(38, 48); this.addFlipper(3, y, 1, len); this.addFlipper(W - 3, y + this.r(-30, 30), -1, len); }
    if (fl === 2) for (let k = this.ri(2, 4); k > 0; k--) { const s = this.rng() < 0.5 ? 1 : -1; this.addFlipper(s > 0 ? this.r(16, W / 2 - 50) : this.r(W / 2 + 50, W - 16), this.r(130, SLOT_Y - 80), s, this.r(36, 46)); }
    if (this.rng() < 0.45) { const y = this.r(120, 260), l = this.r(30, 44); this.kickers.push({ ax: 2, ay: y, bx: l * 0.7, by: y + l, flash: 0 }, { ax: W - 2, ay: y, bx: W - l * 0.7, by: y + l, flash: 0 }); }
    const far = (x, y, m) => !this.flippers.some((f) => segD(x, y, f.x, f.y, f.x + Math.cos(f.rest) * f.len, f.y + Math.sin(f.rest) * f.len) < m || segD(x, y, f.x, f.y, f.x + Math.cos(f.up) * f.len, f.y + Math.sin(f.up) * f.len) < m)
      && !this.kickers.some((k) => segD(x, y, k.ax, k.ay, k.bx, k.by) < m) && !this.bumpers.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + m) && !this.spinners.some((s) => Math.hypot(s.x - x, s.y - y) < s.len + m);
    for (let k = this.rng() < 0.8 ? this.ri(1, 5) : 0, tries = 0; k > 0 && tries < 80; tries++) {
      const r = this.r(11, 17), x = this.r(40, W - 40), y = this.r(100, SLOT_Y - 100);
      if (far(x, y, r + this.br * 2 + 22)) { this.bumpers.push({ x, y, r, flash: 0 }); k--; }
    }
    for (let k = this.rng() < 0.5 ? this.ri(1, 2) : 0, tries = 0; k > 0 && tries < 60; tries++) {
      const len = this.r(20, 30), x = this.r(50, W - 50), y = this.r(110, SLOT_Y - 110);
      if (far(x, y, len + this.br * 2 + 16)) { this.spinners.push({ x, y, len, arms: this.ri(2, 4), a: this.r(0, TAU), w: (this.rng() < 0.5 ? -1 : 1) * this.r(1.6, 3.6) }); k--; }
    }
    for (let k = this.rng() < 0.4 ? this.ri(1, 3) : 0, tries = 0; k > 0 && tries < 60; tries++) {
      const l = this.r(34, 56), a = this.r(-0.3, 0.3), x = this.r(30, W - 30 - l), y = this.r(110, SLOT_Y - 70), bx = x + Math.cos(a) * l, by = y + Math.sin(a) * l;
      if (far(x, y, 30) && far(bx, by, 30) && far((x + bx) / 2, (y + by) / 2, 30) && !this.ledges.some((g) => segD(x, y, g.ax, g.ay, g.bx, g.by) < 40)) { this.ledges.push({ ax: x, ay: y, bx, by }); k--; }
    }
    this.far = far;
    for (let k = this.rng() < 0.75 ? this.ri(1, 2) : 0; k > 0; k--) this.hoppers.push({ x: this.r(50, W - 50), m: this.kit.mats[this.ri(0, this.kit.mats.length - 1)], on: 0, off: this.r(1, 5) });
  }
  pegPoints(md) {
    const L = this.layout, y0 = 70, y1 = SLOT_Y - 24, x0 = 12, x1 = W - 12, pts = [], g = Math.max(md + 3, this.r(30, 40)), ph = this.r(0, TAU);
    if (L === 'classic' || L === 'wave') {
      for (let r = 0, y = y0; y <= y1; r++, y += g * 0.84) { const off = L === 'wave' ? (Math.sin(r * 0.8 + ph) * 0.5 + 0.5) * g : (r % 2) * g * 0.5; for (let x = x0 + off; x <= x1; x += g) pts.push([x, y]); }
    } else if (L === 'grid') {
      for (let y = y0; y <= y1; y += g * 0.92) for (let x = x0 + g * 0.5; x <= x1; x += g) pts.push([x + this.r(-4, 4), y + this.r(-3, 3)]);
    } else if (L === 'pyramid') {
      for (let r = 0, y = y0; y <= y1; r++, y += g * 0.86) for (let k = 0, n = r + 3; k < n; k++) pts.push([W / 2 + (k - (n - 1) / 2) * g, y]);
    } else if (L === 'scatter') {
      for (let k = 0; k < 1200 && pts.length < 90; k++) { const p = [this.r(x0, x1), this.r(y0, y1)]; if (pts.every((q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 > (g * 0.85) ** 2)) pts.push(p); }
    } else if (L === 'hex') {
      const R = Math.max(md, g * 0.72);
      for (let cy = y0 + R, row = 0; cy <= y1; cy += R * 2.5, row++) for (let cx = x0 + R + (row % 2) * R * 1.5; cx <= x1; cx += R * 3) for (let k = 0; k < 6; k++) pts.push([cx + Math.cos((k * Math.PI) / 3 + Math.PI / 6) * R, cy + Math.sin((k * Math.PI) / 3 + Math.PI / 6) * R]);
    } else if (L === 'rings') {
      const cs = this.bumpers.length ? this.bumpers.map((b) => [b.x, b.y, b.r + this.br * 2 + 12]) : [];
      for (let k = 0; cs.length < 4 && k < 40; k++) { const c = [this.r(60, W - 60), this.r(110, y1 - 40), this.r(26, 40)]; if (cs.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) > o[2] + c[2] + 30)) cs.push(c); }
      for (const [cx, cy, R] of cs) for (let k = 0, n = Math.floor((TAU * R) / Math.max(md, 26)); k < n; k++) pts.push([cx + Math.cos((k / n) * TAU + ph) * R, cy + Math.sin((k / n) * TAU + ph) * R]);
      for (let y = y0; y <= y1; y += g * 1.1) for (let x = x0 + (Math.round(y) % 2) * g * 0.5; x <= x1; x += g * 1.2) pts.push([x, y]);
    } else if (L === 'chevron') {
      const p = this.r(50, 80), a = this.r(18, 30);
      for (let y = y0; y <= y1; y += g * 0.95) for (let x = x0; x <= x1; x += md + 2) pts.push([x, y + Math.abs(((x / p + ph) % 2) - 1) * a]);
    } else if (L === 'diamonds') {
      const s = Math.max(md, g * 0.78);
      for (let cy = y0 + s, row = 0; cy <= y1; cy += s * 2.3, row++) for (let cx = x0 + s * (row % 2 ? 1 : 2.15); cx <= x1; cx += s * 2.6) pts.push([cx, cy - s], [cx - s, cy], [cx + s, cy], [cx, cy + s]);
    } else {
      for (let cx = x0 + g * 0.6, c = 0; cx <= x1; cx += g * 1.3, c++) for (let y = y0 + (c % 2) * md * 0.5; y <= y1; y += md + 2) pts.push([cx, y]);
    }
    return pts;
  }
  pegsSetup() {
    const base = this.rng() < 0.3 ? 'post' : 'pin', pr = (base === 'post' ? this.r(3, 4.2) : this.r(3.2, 5.4)) * Math.min(1.2, this.S);
    const md = 2 * this.br + 2 * pr + 5 + (base === 'post' ? pr : 0);
    const pool = ['rubber', 'gem', 'bell', 'crumble', 'mover', ...(this.kit.mats.includes(POWDER) ? ['cracker', 'cracker'] : [])];
    for (let i = pool.length - 1; i > 0; i--) { const j = this.ri(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const specials = pool.slice(0, this.ri(1, 3)), share = this.r(0.12, 0.3);
    this.pegs = [];
    for (const [x, y] of this.pegPoints(md)) {
      if (x < 9 || x > W - 9 || y < 64 || y > SLOT_Y - 20) continue;
      const t = this.rng() < share ? specials[this.ri(0, specials.length - 1)] : base, r = t === 'rubber' ? pr * 1.5 : t === 'gem' || t === 'bell' ? pr * 1.25 : t === 'cracker' ? pr * 1.2 : pr, hl = t === 'post' || t === 'cracker' ? pr * 1.6 : 0;
      if (!this.far(x, y, r + hl + this.br * 2 + 6) || this.ledges.some((g) => segD(x, y, g.ax, g.ay, g.bx, g.by) < r + this.br * 2 + 8)) continue;
      if (this.pegs.some((p) => Math.hypot(p.x - x, p.y - y) < 2 * this.br + p.r + r + 5 + Math.max(p.hl, hl))) continue;
      this.pegs.push({ x, y, x0: x, r, hl, t, hit: 0, wob: 0, hp: 3, dead: 0, fuse: 0, ph: this.r(0, TAU) });
    }
    this.gx = Math.ceil(W / GC); this.gy = Math.ceil(H / GC);
    this.grid = Array.from({ length: this.gx * this.gy }, () => []);
    for (const p of this.pegs) if (p.t !== 'mover') this.grid[Math.floor(p.y / GC) * this.gx + Math.floor(p.x / GC)].push(p);
    this.movers = this.pegs.filter((p) => p.t === 'mover');
  }
  stampPeg(p, on = true) { if (p.hl) this.mat.solidSeg(p.x, p.y - p.hl, p.x, p.y + p.hl, p.r, on); else this.mat.solid(p.x, p.y, p.r, on); }
  stamp() {
    for (const p of this.pegs) if (p.t !== 'mover') this.stampPeg(p);
    for (const b of this.bumpers) this.mat.solid(b.x, b.y, b.r);
    for (const s of this.spinners) this.mat.solid(s.x, s.y, 5);
    for (const k of [...this.ledges, ...this.kickers]) this.mat.solidSeg(k.ax, k.ay, k.bx, k.by, 3);
    for (let i = 1; i < this.slots.length; i++) this.mat.solidSeg(this.slots[i].x, SLOT_Y, this.slots[i].x, H, 1.5);
  }

  // ------------------------------------------------ balls
  pickKind() {
    if (this.fever > 0 && this.rng() < 0.5) return 'gold';
    const mix = this.kit.mix, tot = Object.values(mix).reduce((a, b) => a + b, 0);
    let x = this.rng() * tot;
    for (const k in mix) if ((x -= mix[k]) <= 0) return k;
    return 'ball';
  }
  spawn(kind, x, y = 24) {
    if (this.balls.length > 44) return null;
    const b = { x: Math.max(10, Math.min(W - 10, x)), y, vx: this.r(-20, 20), vy: 0, r: this.br, kind, c: this.col(this.ri(0, 5)), rot: 0, hits: 0, combo: 0, age: 0, still: 0, nudge: 0, fuse: 0, burstAt: 0, dx: x, ph: this.r(0, 9), tail: new Tail(kind === 'cracker' || kind === 'gold' ? 16 : 12), tk: 0 };
    if (kind === 'animal' && this.zoo.length) { b.a = this.zoo[this.ri(0, this.zoo.length - 1)]; b.r *= 1.35; b.burstAt = this.ri(4, 8); }
    else if (kind === 'animal') b.kind = 'ball';
    if (SPILL[kind]) { b.burstAt = this.ri(kind === 'water' ? 5 : 3, 10) + (this.mods.glass ? -2 : 0); b.r *= kind === 'water' ? 1.25 : 1.1; if (kind === 'sand') b.c = this.col(this.ri(0, 5)); }
    if (kind === 'cracker') { b.fuse = this.r(1.1, 2.4); b.c = '#ff4a3a'; }
    if (kind === 'gold') b.c = '#ffd23f';
    if (b.kind === 'ball') b.i = this.ballArt[this.ri(0, this.ballArt.length - 1)];
    this.balls.push(b);
    return b;
  }
  drop(x) {
    if (this.balls.length > 30) return;
    const n = this.mods.swarm ? 3 : 1;
    for (let k = 0; k < n; k++) this.spawn(this.nextKind, x + (k - (n - 1) / 2) * 16);
    this.nextKind = this.pickKind();
  }
  award(b, pts, combo) { this.score += pts * (this.fever > 0 ? 2 : 1); b.combo += combo; }
  pegHit(b, p) {
    if (p.dead > 0) return;
    const T = PEGS[p.t], imp = p.hl ? hitSeg(b, p.x, p.y - p.hl, p.x, p.y + p.hl, p.r, T[0]) : hitSeg(b, p.x, p.y, p.x, p.y, p.r, T[0]);
    if (imp < 45) return;
    p.hit = 0.3; p.wob = 1; b.vx += this.r(-14, 14); b.hits++;
    this.award(b, T[1], T[2]);
    if (p.t === 'rubber') { b.vx += N.x * 70; b.vy += N.y * 70; }
    else if (p.t === 'gem') this.fx.sparks(p.x, p.y, 5, this.col(1), 130);
    else if (p.t === 'bell') this.fx.ring(p.x, p.y, 16, '#ffd34d', 0.35, 2);
    else if (p.t === 'crumble' && --p.hp <= 0) { this.mat.crumble(p.x, p.y, p.r, this.crumbleMat, this.crumbleMat === SAND ? '#d9b47a' : null); p.dead = this.r(10, 16); this.fx.puffs(p.x, p.y, 2, '#cdbfa8', 30, 0.6); }
    else if (p.t === 'cracker' && !p.fuse) p.fuse = 0.45;
    if (b.burstAt && b.hits >= b.burstAt) this.burst(b);
    else if (b.kind === 'water' && imp > 340) this.burst(b);
  }
  stepBall(b, dt) {
    const g = this.gravity * this.G;
    b.age += dt; b.vy += g * dt;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 950) { b.vx *= 950 / sp; b.vy *= 950 / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const cx = Math.floor(b.x / GC), cy = Math.floor(b.y / GC);
    for (let gy = Math.max(0, cy - 1); gy <= Math.min(this.gy - 1, cy + 1); gy++) for (let gx = Math.max(0, cx - 1); gx <= Math.min(this.gx - 1, cx + 1); gx++) for (const p of this.grid[gy * this.gx + gx]) this.pegHit(b, p);
    for (const p of this.movers) this.pegHit(b, p);
    for (const k of this.bumpers) {
      const imp = hitSeg(b, k.x, k.y, k.x, k.y, k.r, 0.4);
      if (!imp) continue;
      const v = Math.max(430, Math.hypot(b.vx, b.vy) * 0.9);
      b.vx = N.x * v + b.vx * 0.15; b.vy = N.y * v + b.vy * 0.15;
      if (k.flash < 0.1) { k.flash = 0.3; this.award(b, 10, 3); this.fx.ring(k.x, k.y, k.r + 12, this.col(0), 0.35, 3); this.fx.sparks(k.x + N.x * k.r, k.y + N.y * k.r, 4, '#fff6c8', 160); if (b.kind === 'animal' || b.kind === 'water' || (SPILL[b.kind] && this.rng() < 0.5)) this.burst(b); }
    }
    for (const s of this.spinners) for (let k = 0; k < s.arms; k++) {
      const a = s.a + (k * TAU) / s.arms, imp = hitSeg(b, s.x, s.y, s.x + Math.cos(a) * s.len, s.y + Math.sin(a) * s.len, 3.5, 0.5, s.w, s.x, s.y);
      if (imp > 60) this.award(b, 3, 2);
    }
    for (const f of this.flippers) {
      const imp = hitSeg(b, f.x, f.y, f.x + Math.cos(f.a) * f.len, f.y + Math.sin(f.a) * f.len, 5, 0.3, f.w, f.x, f.y);
      if (imp > 150 && Math.abs(f.w) > 3) { this.award(b, 2, 2); f.glow = 0.25; this.fx.sparks(b.x, b.y, 4, '#fff', 150); if (b.kind === 'water' && imp > 400) this.burst(b); }
    }
    for (const k of this.kickers) if (hitSeg(b, k.ax, k.ay, k.bx, k.by, 3, 0.7) > 40) { b.vx += N.x * 240; b.vy += N.y * 240; if (k.flash < 0.05) { k.flash = 0.2; this.award(b, 5, 2); } }
    for (const k of this.ledges) hitSeg(b, k.ax, k.ay, k.bx, k.by, 3, 0.3);
    if (b.y > SLOT_Y - b.r) for (let i = 1; i < this.slots.length; i++) hitSeg(b, this.slots[i].x, SLOT_Y, this.slots[i].x, H, 1.5, 0.4);
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
    if (b.y < b.r && b.vy < 0) { b.y = b.r; b.vy *= -0.5; }
    // materials: shove through them, get slowed, float in water, catch fire
    const m = this.mat.plow(b.x, b.y, b.r, b.vx, b.vy), met = this.mat.met;
    if (m) { const f = 1 / (1 + Math.min(m, 16) * 0.009); b.vx *= f; b.vy *= f; }
    if (met[WATER] > 3) b.vy -= g * dt * 0.45;
    if (met[FIRE] + met[LAVA] + met[EMBER] > 0) this.scorch(b);
    if (b.kind === 'cracker') {
      b.fuse -= dt;
      const fx = b.x + Math.cos(b.rot - 1.2) * b.r, fy = b.y + Math.sin(b.rot - 1.2) * b.r;
      if (this.rng() < 0.45) this.mat.emit(fx, fy, this.r(-50, 50), this.r(-90, -10), SPARK, 0xff70e0ff, this.r(0.15, 0.4));
      if (b.fuse <= 0) this.burst(b);
    } else if (b.kind === 'lava' && this.rng() < 0.12) this.mat.emit(b.x, b.y + b.r, b.vx * 0.2, 40, LAVA, this.mat.paint(LAVA));
    if (++b.tk % 2 === 0) b.tail.push(b.x, b.y);
    b.rot += b.vx * dt * 0.06;
    if (Math.abs(b.vx) + Math.abs(b.vy) < 30) { if ((b.still += dt) > 1.1) { b.vx += this.r(-90, 90); b.vy -= 70; b.still = 0; if (++b.nudge > 4) this.burst(b); } } else b.still = 0;
    if (b.y > H - 6 && !b.done) this.land(b);
  }
  // touching fire or lava: fuses shorten, gunpowder goes up, water hisses
  scorch(b) {
    if (b.kind === 'cracker') b.fuse = Math.min(b.fuse, 0.1);
    else if (b.kind === 'powder') { b.done = true; this.boom(b.x, b.y, 34, b, true); }
    else if (b.kind === 'water') this.burst(b);
    else if (this.rng() < 0.1) this.mat.emit(b.x, b.y - b.r, this.r(-20, 20), -60, SMOKE, 0);
  }
  burst(b, landed = false) {
    if (b.done && !landed) return;
    b.done = true;
    const { x, y } = b, fx = this.fx, m = this.mat, base = { sand: 10, water: 10, powder: 10, oil: 10, lava: 15, cracker: 25, animal: 50, gold: 30 }[b.kind] || 5;
    if (!landed) { const pts = base * (1 + Math.min(5, Math.floor(b.combo / 8))); this.score += pts * (this.fever > 0 ? 2 : 1); this.learn(b, pts); }
    const up = landed ? -160 : b.vy * 0.2 - 40;
    if (b.kind === 'cracker') return this.boom(x, y, 22, b);
    if (SPILL[b.kind]) {
      const t = SPILL[b.kind];
      m.spray(x, y, t === LAVA ? 45 : 85, t, t === SAND ? b.c : null, t === WATER ? 200 : 150, b.vx * 0.3, up);
      if (t === LAVA) fx.sparks(x, y, 10, '#ffb347', 200);
      else fx.puffs(x, y, 3, t === WATER ? '#cfe9ff' : t === POWDER || t === OIL ? '#58545c' : b.c, 40, 0.8);
      if (t === WATER) fx.ring(x, y, b.r * 2.5, '#bfe6ff', 0.35, 2);
      fx.pop(x, y - 12, { [SAND]: 'POOF', [WATER]: 'SPLASH!', [POWDER]: 'FWUMP', [OIL]: 'SPLAT!', [LAVA]: 'SIZZLE!' }[t], { [SAND]: '#fff2c4', [WATER]: '#9fdcff', [POWDER]: '#d0ccd8', [OIL]: '#c7b8ff', [LAVA]: '#ffb347' }[t], 11, true);
      return;
    }
    if (b.kind === 'animal') {
      const n = this.mods.party ? 60 : 34;
      fx.confetti(x, y, n, this.pal.c, 240, 120); fx.stars(x, y, 7, '#ffe14d', 190); fx.puffs(x, y, 5, '#f4f0ff', 60);
      fx.fling(b.a.hurt, x, y, b.vx * 0.3 + this.r(-80, 80), -280, b.r * 2.6);
      fx.pop(x, y - 14, COMIC[this.ri(0, COMIC.length - 1)], '#ffe14d', 13, true);
      m.pour(x, y, 10, SMOKE, 12); fx.shake(2);
      return;
    }
    fx.sparks(x, y, 10, b.c, 180); fx.ring(x, y, 14, b.c, 0.3, 2);
  }
  boom(x, y, r, src, big = false) {
    const fx = this.fx;
    this.mat.blast(x, y, r, { power: big ? 480 : 380 });
    if (big) this.mat.spray(x, y, 40, POWDER, null, 200);
    fx.sparks(x, y, big ? 34 : 22, ['#fff3b0', '#ffb347', '#ff6b3c'], big ? 460 : 380); fx.ring(x, y, r * 2.2, '#ffd27a', 0.4, 4);
    fx.puffs(x, y, 5, '#8a8590', 50, 1.3); fx.confetti(x, y, 10, this.pal.c, 200, 60);
    fx.pop(x, y - 14, big ? 'KABOOM!' : ['BANG!', 'POP!', 'CRACK!', 'BOOM!'][this.ri(0, 3)], '#ffcf4d', big ? 16 : 13, true);
    fx.flash('#fff2c0', big ? 0.35 : 0.16); fx.shake(big ? 9 : 5);
    this.kick(x, y, r * 3, big ? 560 : 420, src);
  }
  kick(x, y, r, pw, src) {
    for (const b of this.balls) {
      if (b === src || b.done) continue;
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
      if (d > r || d < 0.1) continue;
      const f = (1 - d / r) * pw;
      b.vx += (dx / d) * f; b.vy += (dy / d) * f - f * 0.3; b.combo++;
      if (b.kind === 'cracker') b.fuse = Math.min(b.fuse, this.r(0.08, 0.25));
      else if (b.kind === 'powder' && d < r * 0.6) this.later(0.06, () => { if (!b.done) { b.done = true; this.boom(b.x, b.y, 34, b, true); } });
    }
    for (const p of this.pegs) if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r) { p.wob = 1; p.hit = 0.2; if (p.t === 'cracker' && !p.fuse && !p.dead) p.fuse = 0.2; }
  }
  land(b) {
    b.done = true;
    const n = this.slots.length, i = Math.max(0, Math.min(n - 1, Math.floor(b.x / (W / n)))), s = this.slots[i], st = this.streak;
    let mult = 1 + Math.min(5, Math.floor(b.combo / 8));
    if (this.fever > 0) mult *= 2;
    if (b.kind === 'gold') mult *= 3;
    if (b.kind === 'animal') mult *= 2;
    if (st.i === i && this.t - st.t < 1.6) st.n++; else st.n = 1;
    st.i = i; st.t = this.t;
    if (st.n >= 2) mult += st.n - 1;
    const pts = s.v * mult, x = s.x + s.w / 2;
    this.score += pts; s.flash = 0.6;
    this.fx.pop(x, SLOT_Y - 8, `+${pts}`, s.v >= 50 ? '#ffd23f' : '#fff', pts >= 100 ? 15 : 12);
    if (st.n >= 2) this.fx.pop(x, SLOT_Y - 26, ['DOUBLE!', 'TRIPLE!', 'QUAD!'][st.n - 2] || 'MEGA!', '#7ff', 11);
    else if (mult > 1) this.fx.pop(x, SLOT_Y - 26, `COMBO ×${mult}`, '#7ff', 10);
    this.fx.sparks(b.x, SLOT_Y + 6, 8, b.c, 220, { dir: -Math.PI / 2, cone: 0.6 });
    if (pts >= 100) { this.fx.confetti(x, SLOT_Y, 26, this.pal.c, 260, 160); this.fx.shake(3); }
    if (b.kind !== 'ball' && b.kind !== 'gold') this.burst(b, true);
    if (s.sp) this.trigger(s.sp, x);
    else if (b.combo >= 24) this.trigger('MULTIBALL', b.x, 'SUPER COMBO!');
    this.learn(b, pts);
  }
  learn(b, pts) { const k = Math.max(0, Math.min(9, Math.floor(((b.dx - 20) / (W - 40)) * 10))); this.bins[k] += (pts - this.bins[k]) * 0.2; }
  later(t, f) { this.timers.push({ t, f }); }
  firework(x, y) {
    const c = this.col(this.ri(0, 5));
    this.mat.spray(x, y, 26, SPARK, null, 240); this.mat.blast(x, y, 9, { power: 120, fire: false });
    this.fx.sparks(x, y, 26, [c, '#fff'], 300); this.fx.ring(x, y, 34, c, 0.45, 3); this.fx.confetti(x, y, 12, this.pal.c, 180, 40); this.fx.flash(c, 0.1);
  }
  trigger(name, x = W / 2, label) {
    const fx = this.fx, top = () => this.r(30, W - 30);
    if (name === 'JACKPOT') {
      fx.banner('JACKPOT!', 'the whole board celebrates', '#ffd23f', 2.2); fx.flash('#fff6c8', 0.5); fx.shake(8);
      for (let k = 0; k < 6; k++) this.later(k * 0.25, () => this.firework(top(), this.r(80, 220)));
      for (let k = 0; k < 6; k++) fx.confetti(this.r(0, W), -6, 16, this.pal.c, 80, -40);
    } else if (name === 'BOOM' || name === 'FIREWORKS') {
      fx.banner('KABOOM!', 'firecrackers incoming', '#ff7a3c');
      for (let k = 0; k < 5; k++) this.later(k * 0.3, () => this.firework(top(), this.r(80, 200)));
      for (let k = 0; k < 3; k++) this.later(0.4 + k * 0.35, () => this.spawn('cracker', top()));
    } else if (name === 'FEVER') {
      this.fever = 8; fx.banner('FEVER!', 'every point ×2', '#ff4fd8');
      for (let k = 0; k < 6; k++) this.later(k * 0.3, () => this.spawn('gold', top()));
    } else if (name === 'STAMPEDE') {
      fx.banner('STAMPEDE!', 'critters on the loose', '#7be36b');
      for (let k = 0; k < 6; k++) this.later(k * 0.22, () => this.spawn('animal', top()));
    } else if (name === 'STORM') {
      const m = (this.stormM = this.kit.mats[this.ri(0, this.kit.mats.length - 1)]);
      fx.banner({ [WATER]: 'CLOUDBURST!', [LAVA]: 'LAVA RAIN!', [POWDER]: 'POWDER RAIN!', [OIL]: 'OIL SLICK!' }[m] || 'SANDSTORM!', 'look out below', '#5ac8ff');
      this.storm = 3;
    } else {
      fx.banner(label || 'MULTIBALL!', '', '#5ac8ff');
      for (let k = 0; k < 5; k++) this.later(k * 0.15, () => this.spawn(this.pickKind(), x + this.r(-60, 60)));
    }
  }

  // ------------------------------------------------ stepping
  stepFlipper(f, dt) {
    f.cd -= dt; f.hold -= dt; f.glow = Math.max(0, f.glow - dt);
    if (f.cd <= 0) {
      const tx = f.x + Math.cos(f.rest) * f.len, ty = f.y + Math.sin(f.rest) * f.len;
      for (const b of this.balls) if (b.vy > -60 && b.y < Math.max(f.y, ty) + 2 && segD(b.x, b.y, f.x, f.y, tx, ty) < b.r + 14) { f.hold = this.r(0.12, 0.2); f.cd = this.r(0.35, 0.6); break; }
      if (f.cd <= 0 && (f.idle -= dt) <= 0) { f.hold = 0.12; f.cd = 0.4; f.idle = this.r(2, 6); }
    }
    const da = (f.hold > 0 ? f.up : f.rest) - f.a, sp = (f.hold > 0 ? 24 : 9) * dt, s = Math.abs(da) <= sp ? da : Math.sign(da) * sp;
    f.w = s / dt; f.a += s;
  }
  step(dt) {
    this.fever = Math.max(0, this.fever - dt);
    for (const tm of this.timers) if ((tm.t -= dt) <= 0) tm.f();
    this.timers = this.timers.filter((tm) => tm.t > 0);
    if (!this.auto) this.dropX += (this.aimX - this.dropX) * Math.min(1, dt * 10);
    for (const f of this.flippers) this.stepFlipper(f, dt);
    for (const s of this.spinners) s.a += s.w * dt;
    for (const p of this.pegs) {
      p.hit = Math.max(0, p.hit - dt); p.wob *= Math.exp(-6 * dt);
      if (p.t === 'mover') p.x = p.x0 + Math.sin(this.t * 1.3 + p.ph) * 12;
      if (p.dead > 0 && (p.dead -= dt) <= 0) { p.hp = 3; p.fuse = 0; this.stampPeg(p); this.fx.ring(p.x, p.y, 10, this.col(2), 0.4, 2); }
      if (p.fuse > 0 && (p.fuse -= dt) <= 0) { p.dead = this.r(6, 9); this.stampPeg(p, false); this.boom(p.x, p.y, 20, null); this.score += 8; }
    }
    for (const k of this.bumpers) k.flash = Math.max(0, k.flash - dt);
    for (const k of this.kickers) k.flash = Math.max(0, k.flash - dt);
    for (const s of this.slots) s.flash = Math.max(0, s.flash - dt);
    for (const h of this.hoppers) {
      if (h.on > 0) { h.on -= dt; if (this.rng() < 0.6) this.mat.emit(h.x + this.r(-5, 5) * (h.m === WATER ? 4 : 1), 12, this.r(-12, 12), this.r(30, 70), h.m, this.mat.paint(h.m, h.m === SAND ? this.mat.rgb(SAND, this.col(this.ri(0, 5))) : null)); }
      else if ((h.off -= dt) <= 0) { h.on = this.r(1.2, 2.6); h.off = this.r(5, 12); }
    }
    if (this.storm > 0) { this.storm -= dt; for (let k = 0; k < 2; k++) this.mat.emit(this.r(0, W), 2, this.r(-20, 20), this.r(20, 80), this.stormM, this.mat.paint(this.stormM, this.stormM === SAND ? this.mat.rgb(SAND, this.col(this.ri(0, 5))) : null)); }
    for (const b of this.balls) if (!b.done) this.stepBall(b, dt);
    const bs = this.balls;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, o = (rr - d) / 2;
      a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) { const j2 = -0.8 * vn; a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny; }
    }
    this.balls = bs.filter((b) => !b.done);
    this.mat.g = this.G; this.mat.step(dt);
    for (const e of this.mat.events) { this.kick(e.x, e.y, e.r * 3, 260); this.fx.sparks(e.x, e.y, 6, '#ffcf6b', 220); this.fx.shake(1.2); this.score += 2; }
    this.mat.events.length = 0;
    if ((this.drainT -= dt) <= 0) { // grains that trickle out of a slot pay a point each
      this.drainT = 0.5;
      const d = this.mat.drain, cs = this.mat.cs;
      for (let x = 0; x < d.length; x++) if (d[x]) { this.score += d[x]; this.slots[Math.min(this.slots.length - 1, Math.floor((x * cs) / (W / this.slots.length)))].flash = 0.15; d[x] = 0; }
    }
    this.fx.step(dt, this.G);
    if ((this.evT -= dt) <= 0) { this.evT = this.r(24, 40); this.trigger(['MULTIBALL', 'STAMPEDE', 'STORM', 'FIREWORKS', 'FEVER'][this.ri(0, 4)], this.r(60, W - 60)); }
  }
  // the autopilot learns which drop columns pay and keeps feeding them, with some curiosity
  autopilot(dt) {
    this.next -= dt;
    this.dropX += (this.aimX - this.dropX) * Math.min(1, dt * 6);
    if (this.next > 0 || this.balls.length >= (this.fever > 0 ? 24 : 14) || Math.abs(this.dropX - this.aimX) > 4) return;
    this.drop(this.dropX);
    if (this.rng() < 0.18) this.aimX = this.r(24, W - 24);
    else {
      const mx = Math.max(...this.bins), ws = this.bins.map((v) => Math.exp((v - mx) / (mx * 0.3 + 4))), tot = ws.reduce((a, b) => a + b, 0);
      let x = this.rng() * tot, k = 0;
      while (k < 9 && (x -= ws[k]) > 0) k++;
      this.aimX = 20 + ((k + this.r(0.1, 0.9)) * (W - 40)) / 10;
    }
    this.next = this.fever > 0 ? this.r(0.12, 0.3) : this.rng() < 0.25 ? this.r(0.1, 0.25) : this.r(0.4, 1.1);
  }
  down(x) { this.aimX = this.dropX = Math.max(12, Math.min(W - 12, x)); this.drop(this.dropX); }
  move(x) { this.aimX = Math.max(12, Math.min(W - 12, x)); }
  hud() { return `${Math.floor(this.score)}${this.fever > 0 ? ' · FEVER ×2' : ''}`; }

  // ------------------------------------------------ drawing
  pegCol(t) { return { rubber: this.col(2), gem: this.col(1), bell: '#ffd34d', crumble: '#c9a46a', cracker: '#e8333a', mover: this.col(3) }[t] || this.pal.c[4]; }
  pegSprite(p) {
    const key = p.t;
    if (this.spr[key]) return this.spr[key];
    const r = p.r, hl = p.hl, w = Math.ceil((r + 3) * 2), h = Math.ceil((r + hl + 3) * 2), cv = Object.assign(document.createElement('canvas'), { width: w * 2, height: h * 2 }), x = cv.getContext('2d');
    x.scale(2, 2); x.translate(w / 2, h / 2);
    const col = this.pegCol(p.t), look = p.t === 'cracker' ? 'cracker' : hl ? 'post' : this.look;
    x.fillStyle = col; x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1;
    const disc = (rr) => { x.beginPath(); x.arc(0, 0, rr, 0, TAU); };
    if (look === 'post' || look === 'cracker') {
      x.beginPath(); x.roundRect(-r, -r - hl, r * 2, (r + hl) * 2, r); x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(-r * 0.5, -r - hl + 2, r * 0.45, (r + hl) * 2 - 4);
      if (look === 'cracker') { x.fillStyle = '#ffd34d'; x.fillRect(-r, -hl * 0.5, r * 2, 1.6); x.fillRect(-r, hl * 0.5, r * 2, 1.6); x.strokeStyle = '#2b1d14'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, -r - hl); x.quadraticCurveTo(2, -r - hl - 2, 1, -r - hl - 3); x.stroke(); }
    } else if (look === 'ring') { disc(r - 0.8); x.lineWidth = 2; x.strokeStyle = col; x.stroke(); disc(r * 0.35); x.fill(); }
    else if (look === 'gem') { x.beginPath(); x.moveTo(0, -r * 1.15); x.lineTo(r, 0); x.lineTo(0, r * 1.15); x.lineTo(-r, 0); x.closePath(); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.moveTo(0, -r * 1.15); x.lineTo(r, 0); x.lineTo(0, 0); x.closePath(); x.fill(); }
    else if (look === 'nut') { x.beginPath(); for (let k = 0; k < 6; k++) x.lineTo(Math.cos((k * TAU) / 6) * r * 1.1, Math.sin((k * TAU) / 6) * r * 1.1); x.closePath(); x.fill(); x.stroke(); x.fillStyle = 'rgba(0,0,0,.45)'; disc(r * 0.42); x.fill(); }
    else if (look === 'candy') { disc(r); x.fill(); x.save(); disc(r); x.clip(); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = r * 0.45; for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(-r * 2, k * r * 0.9 - r); x.lineTo(r * 2, k * r * 0.9 + r); x.stroke(); } x.restore(); disc(r); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.stroke(); }
    else if (look === 'neon') { x.globalAlpha = 0.35; disc(r + 2.5); x.fill(); x.globalAlpha = 1; disc(r * 0.8); x.fill(); x.fillStyle = '#fff'; disc(r * 0.35); x.fill(); }
    else { disc(r); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(-r * 0.35, -r * 0.35, r * 0.35, 0, TAU); x.fill(); }
    if (p.t === 'bell') { x.strokeStyle = '#7a5a10'; x.lineWidth = 1; x.beginPath(); x.arc(0, r * 0.15, r * 0.45, Math.PI, TAU); x.stroke(); }
    return (this.spr[key] = cv);
  }
  drawPegs(c) {
    const art = this.look === 'sprite' ? this.skin.pick('pegart', 'item', 'enemy') : null;
    for (const p of this.pegs) {
      if (p.dead > 0) { if (p.dead < 1.5) { c.globalAlpha = 0.3; c.strokeStyle = this.pegCol(p.t); c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, p.r * (1.5 - p.dead / 1.5), 0, TAU); c.stroke(); c.globalAlpha = 1; } continue; }
      const jx = p.wob > 0.05 ? Math.sin(this.t * 45 + p.ph) * p.wob * 1.6 : 0, jy = p.fuse > 0 ? Math.sin(this.t * 70) * 1.2 : 0;
      if (p.hit > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, p.hit * 3); const g = glowSprite(this.pegCol(p.t)), s = p.r * 6; c.drawImage(g, p.x - s / 2, p.y - s / 2, s, s); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
      if (art && !p.hl && p.t !== 'cracker' && drawFit(c, art, p.x + jx, p.y, p.r * 2.6, p.r * 2.6, p.ph)) continue;
      const s = this.pegSprite(p), w = s.width / 2, h = s.height / 2;
      if (p.t === 'crumble') c.globalAlpha = 0.45 + p.hp * 0.18;
      c.drawImage(s, p.x + jx - w / 2, p.y + jy - h / 2, w, h);
      c.globalAlpha = 1;
      if (p.fuse > 0) { const g = glowSprite('#ffcf6b'), q = 14 + Math.sin(this.t * 60) * 3; c.globalCompositeOperation = 'lighter'; c.drawImage(g, p.x - q / 2, p.y - p.r - p.hl - 3 - q / 2, q, q); c.globalCompositeOperation = 'source-over'; }
    }
  }
  drawBall(c, b) {
    const { x, y } = b, r = b.r;
    if (b.kind === 'animal') {
      const f = b.a.f[Math.floor(this.t * 6 + b.ph) % b.a.f.length], sq = 1 + Math.sin(b.age * 16) * 0.07;
      if (drawFit(c, f, x, y, r * 2.5 * sq, (r * 2.5) / sq, Math.sin(b.age * 5) * 0.25, b.vx < 0)) return;
    }
    if (b.kind === 'cracker') {
      c.save(); c.translate(x, y); c.rotate(b.rot);
      c.fillStyle = '#e8333a'; c.beginPath(); c.roundRect(-r * 0.6, -r * 1.25, r * 1.2, r * 2.5, 2); c.fill();
      c.fillStyle = '#ffd34d'; c.fillRect(-r * 0.6, -r * 0.7, r * 1.2, 1.5); c.fillRect(-r * 0.6, r * 0.5, r * 1.2, 1.5);
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -r * 1.25); c.quadraticCurveTo(r * 0.6, -r * 1.7, r * 0.2, -r * 2); c.stroke();
      c.restore();
      const g = glowSprite('#ffd27a'), q = 12 + Math.sin(this.t * 50) * 4, fx = x + Math.cos(b.rot - 1.4) * r * 2, fy = y + Math.sin(b.rot - 1.4) * r * 2;
      c.globalCompositeOperation = 'lighter'; c.drawImage(g, fx - q / 2, fy - q / 2, q, q); c.globalCompositeOperation = 'source-over';
      return;
    }
    if (b.kind === 'water') {
      const sq = 1 + Math.sin(b.age * 13) * 0.1;
      c.fillStyle = 'rgba(80,160,255,.75)'; c.beginPath(); c.ellipse(x, y, r * sq, r / sq, 0, 0, TAU); c.fill();
      c.fillStyle = '#4a8ad8'; c.beginPath(); c.moveTo(x - 2, y - r / sq - 2); c.lineTo(x + 2, y - r / sq - 2); c.lineTo(x, y - r / sq + 1); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); c.fill();
      return;
    }
    if (b.kind === 'sand' || b.kind === 'powder' || b.kind === 'oil') {
      const fill = b.kind === 'sand' ? b.c : b.kind === 'oil' ? '#2a1f1d' : '#3c3a42';
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(x, y, r - 1, 0, TAU); c.clip(); c.fillStyle = fill; c.fillRect(x - r, y - r * 0.15 + Math.sin(b.rot) * 2, r * 2, r * 2); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x - r * 0.4, y - r * 0.4, r * 0.22, 0, TAU); c.fill();
      return;
    }
    if (b.kind === 'lava' || b.kind === 'gold') {
      const col = b.kind === 'lava' ? '#ff7a1f' : '#ffd23f', g = glowSprite(col), q = r * 5;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; c.drawImage(g, x - q / 2, y - q / 2, q, q); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = b.kind === 'lava' ? '#7a1e08' : '#fff6c8'; c.beginPath(); c.arc(x + Math.cos(b.rot) * r * 0.4, y + Math.sin(b.rot) * r * 0.4, r * 0.3, 0, TAU); c.fill();
      return;
    }
    this.orb(c, b.i, x, y, r, b.c, b.rot);
  }
  drawBoard(c) {
    const ink = this.pal.ink;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, SLOT_Y, W, H - SLOT_Y);
    this.slots.forEach((s, i) => {
      c.globalAlpha = s.flash ? 0.35 + s.flash : 0.22; c.fillStyle = s.sp ? SPECIAL[s.sp] : this.col(i % 2 ? 1 : 3);
      c.fillRect(s.x + 1.5, SLOT_Y + 2, s.w - 3, H - SLOT_Y - 2);
    });
    c.globalAlpha = 1;
    c.strokeStyle = this.pal.c[4]; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); for (let i = 1; i < this.slots.length; i++) { c.moveTo(this.slots[i].x, SLOT_Y); c.lineTo(this.slots[i].x, H); } c.stroke();
    // top rail and dropper
    c.globalAlpha = 0.5; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(8, 12); c.lineTo(W - 8, 12); c.stroke(); c.globalAlpha = 1;
    for (const h of this.hoppers) {
      if (h.m === WATER) { c.fillStyle = h.on > 0 ? '#c8d4e4' : '#9aa6b8'; for (const [dx, dy, r] of [[-12, 4, 9], [0, 0, 12], [13, 4, 9]]) { c.beginPath(); c.arc(h.x + dx, 6 + dy, r, 0, TAU); c.fill(); } }
      else { c.fillStyle = h.m === LAVA ? '#5a2a1a' : h.m === OIL ? '#3a3a44' : '#7a6a58'; c.beginPath(); c.moveTo(h.x - 14, 0); c.lineTo(h.x + 14, 0); c.lineTo(h.x + 4, 12); c.lineTo(h.x - 4, 12); c.closePath(); c.fill(); if (h.on > 0) { c.fillStyle = h.m === LAVA ? '#ff7a1f' : '#ffe9a8'; c.fillRect(h.x - 2, 11, 4, 2); } }
    }
    c.lineCap = 'round';
    for (const k of this.ledges) { c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 7; c.beginPath(); c.moveTo(k.ax, k.ay); c.lineTo(k.bx, k.by); c.stroke(); c.strokeStyle = this.col(5); c.lineWidth = 5; c.stroke(); }
    for (const k of this.kickers) { c.strokeStyle = k.flash ? '#fff' : this.col(0); c.lineWidth = 6; c.beginPath(); c.moveTo(k.ax, k.ay); c.lineTo(k.bx, k.by); c.stroke(); }
  }
  draw(c) {
    this.clear(c);
    const fx = this.fx;
    c.save(); c.translate(fx.ox, fx.oy);
    this.drawBoard(c);
    this.drawPegs(c);
    for (const k of this.bumpers) {
      const s = 1 + k.flash * 0.7;
      if (k.flash) { c.globalCompositeOperation = 'lighter'; const g = glowSprite(this.col(0)), q = k.r * 5; c.drawImage(g, k.x - q / 2, k.y - q / 2, q, q); c.globalCompositeOperation = 'source-over'; }
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(k.x + 2, k.y + 3, k.r * s, 0, TAU); c.fill();
      c.fillStyle = this.col(3); c.beginPath(); c.arc(k.x, k.y, k.r * s, 0, TAU); c.fill();
      c.fillStyle = k.flash ? '#fff' : this.col(0); c.beginPath(); c.arc(k.x, k.y, k.r * s * 0.72, 0, TAU); c.fill();
      if (!drawFit(c, this.bumpArt, k.x, k.y, k.r * 1.2, k.r * 1.2)) { c.fillStyle = this.pal.ink; c.beginPath(); c.arc(k.x, k.y, k.r * 0.3, 0, TAU); c.fill(); }
    }
    c.lineCap = 'round';
    for (const s of this.spinners) {
      for (let k = 0; k < s.arms; k++) { const a = s.a + (k * TAU) / s.arms, tx = s.x + Math.cos(a) * s.len, ty = s.y + Math.sin(a) * s.len; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 9; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tx, ty); c.stroke(); c.strokeStyle = this.col(2); c.lineWidth = 6; c.stroke(); }
      c.fillStyle = this.pal.ink; c.beginPath(); c.arc(s.x, s.y, 5, 0, TAU); c.fill();
    }
    for (const f of this.flippers) {
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      if (f.glow) { c.shadowColor = '#fff6c8'; c.shadowBlur = 12; }
      c.fillStyle = f.glow ? '#fff' : this.col(1); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, 0, 6.5, Math.PI / 2, Math.PI * 1.5); c.lineTo(f.len, -3.5); c.arc(f.len, 0, 3.5, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fill(); c.stroke();
      c.shadowBlur = 0; c.fillStyle = this.pal.ink; c.beginPath(); c.arc(0, 0, 2.4, 0, TAU); c.fill();
      c.restore();
    }
    for (const b of this.balls) b.tail.draw(c, this.tail, b.c, b.r * 1.3, this.t);
    for (const b of this.balls) this.drawBall(c, b);
    this.mat.draw(c);
    // slot labels and the dropper
    this.slots.forEach((s) => this.text(c, s.sp ? (s.sp === 'JACKPOT' ? String(s.v) : s.sp) : String(s.v), s.x + s.w / 2, H - 14, s.sp && s.sp !== 'JACKPOT' ? (s.w < 44 ? 6.5 : 8) : s.v >= 100 && s.w < 40 ? 9 : 11, s.sp ? SPECIAL[s.sp] : this.pal.ink));
    c.fillStyle = this.pal.ink; c.globalAlpha = 0.85; c.beginPath(); c.roundRect(this.dropX - 9, 6, 18, 10, 3); c.fill(); c.globalAlpha = 1;
    this.drawBall(c, { kind: this.nextKind === 'animal' && !this.zoo.length ? 'ball' : this.nextKind, x: this.dropX, y: 25, r: this.br * 0.8, c: this.col(2), rot: 0, age: this.t, ph: 0, a: this.zoo[0], i: this.ballArt[0] });
    fx.draw(c);
    c.restore();
    if (this.fever > 0) { c.strokeStyle = SPECIAL.FEVER; c.globalAlpha = 0.5 + Math.sin(this.t * 10) * 0.3; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6); c.globalAlpha = 1; c.fillStyle = SPECIAL.FEVER; c.fillRect(0, 0, (W * this.fever) / 8, 3); }
    fx.over(c);
  }
}
