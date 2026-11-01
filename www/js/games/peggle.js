// Peg Shot (Peggle-like): aim the cannon and light every orange peg. Lit pegs crumble into sand, water, gunpowder,
// stone or lava when the shot ends, and the material rains through the board, piles on pegs and fills the moving
// bucket. Bomb pegs blow up their neighbours (chain reactions), shelves hold heaps and pools that spill when their
// bricks go, wheels and sliders keep the board moving, green pegs grant a power, the last orange gets slow motion.
import { Game, W, H, circleRect, roundRect, drawFit } from './engine.js';
import { Materials, Fx, Tail, TAILS, glowSprite, SAND, WATER, OIL, LAVA, POWDER, STONE, FIRE, SPARK, EMBER } from './materials.js';

const TAU = Math.PI * 2, CX = W / 2, CY = 34, SPEED = 430, PR = 6.5, BK_W = 70, BK_Y = H - 24, GC = 32;
const KITS = [
  { blue: SAND, orange: SAND, shelf: SAND, name: 'SANDSTORM' },
  { blue: WATER, orange: SAND, shelf: WATER, name: 'CLOUDBURST' },
  { blue: POWDER, orange: SAND, shelf: POWDER, name: 'POWDER RAIN' },
  { blue: STONE, orange: LAVA, shelf: WATER, name: 'LAVA RAIN' },
  { blue: OIL, orange: SAND, shelf: OIL, name: 'OIL SLICK' },
  { blue: SAND, orange: WATER, shelf: POWDER, name: 'SANDSTORM' }
];
const POWERS = ['multi', 'fire', 'bomb', 'storm'];
const COL = { blue: '#3d8bff', orange: '#ff8a2a', purple: '#b45cff', green: '#4cd964', bomb: '#e8333a' };
const VAL = { blue: 10, orange: 100, purple: 500, green: 10, bomb: 50 };

// ball against a disc moving at (ux, uy); returns the impact speed (0 when apart)
function bounce(b, x, y, r, e, ux = 0, uy = 0) {
  const dx = b.x - x, dy = b.y - y, rr = b.r + r, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return 0;
  const d = Math.sqrt(d2) || 0.01, nx = d2 ? dx / d : 0, ny = d2 ? dy / d : -1;
  b.x = x + nx * rr; b.y = y + ny * rr;
  const vn = (b.vx - ux) * nx + (b.vy - uy) * ny;
  if (vn >= 0) return 0.01;
  b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
  return -vn;
}
function hitBrick(b, p, e) {
  const n = circleRect(b, { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h });
  if (!n) return 0;
  const vn = b.vx * n.nx + b.vy * n.ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * n.nx; b.vy -= (1 + e) * vn * n.ny; }
  return -vn || 0.01;
}

export class PegShot extends Game {
  setup() {
    this.mat = new Materials({ floor: 'open', seed: this.post.seed, g: this.G });
    this.fx = new Fx();
    this.tail = TAILS[this.ri(0, TAILS.length - 1)];
    this.ts = this.tsT = 1; this.zoom = this.zoomT = 1; this.fcx = CX; this.fcy = H / 2; this.focus = null; this.slowT = 0;
    this.spr = {}; this.angle = Math.PI / 2; this.balls = [];
    this.shotImg = this.skin.pick('shot', 'ball', 'item', 'animal');
    this.level();
  }
  // ------------------------------------------------ levels
  level() {
    this.lvl = (this.lvl || 0) + 1;
    const m = this.mat;
    m.clear(true);
    this.kit = KITS[this.ri(0, KITS.length - 1)];
    this.power = POWERS[this.ri(0, POWERS.length - 1)];
    this.pegs = [];
    const add = (x, y, o = {}) => {
      if (x < 16 || x > W - 16 || y < 92 || y > H - 78) return null;
      if (this.pegs.some((p) => (p.brick ? Math.abs(p.x - x) < p.w / 2 + 12 && Math.abs(p.y - y) < p.h / 2 + 12 : Math.hypot(p.x - x, p.y - y) < 18 + (o.R || p.R ? 4 : 0)))) return null;
      const p = { x, y, r: PR, k: 'blue', lit: false, gone: false, flash: 0, ...o };
      this.pegs.push(p);
      return p;
    };
    // shelves: bricks carrying a heap of sand or powder, or troughs of water and oil that spill when broken
    const shelves = [];
    if (this.rng() < 0.6) for (let k = this.ri(1, 3), tries = 0; k > 0 && tries < 40; tries++) {
      const w = this.r(56, 90), x = this.r(22 + w / 2, W - 22 - w / 2), y = this.r(150, 280);
      if (shelves.some((s) => Math.abs(s.x - x) < (s.w + w) / 2 + 24 && Math.abs(s.y - y) < 60)) continue;
      shelves.push({ x, y, w }); k--;
    }
    const liquid = this.kit.shelf === WATER || this.kit.shelf === OIL;
    for (const s of shelves) {
      this.pegs.push({ x: s.x, y: s.y, w: s.w, h: 8, brick: true, k: 'blue', lit: false, gone: false, flash: 0 });
      if (liquid) for (const sx of [-1, 1]) this.pegs.push({ x: s.x + sx * (s.w / 2 - 3), y: s.y - 15, w: 6, h: 22, brick: true, wall: true, k: 'blue', lit: false, gone: false, flash: 0 });
    }
    const near = (x, y) => shelves.some((s) => Math.abs(s.x - x) < s.w / 2 + 14 && y > s.y - 46 && y < s.y + 16);
    const put = (x, y, o) => (near(x, y) ? null : add(x, y, o));
    const pat = this.ri(0, 10), ph = this.r(0, TAU);
    if (pat === 0) for (let r = 0; r < 6; r++) for (let k = 0; k < 9; k++) put(28 + k * 38 + (r % 2) * 19, 110 + r * 42);
    if (pat === 1) for (let a = 0; a < 3; a++) for (let i = 0; i < 16; i++) { const t = (i / 15) * Math.PI; put(CX + Math.cos(t) * (60 + a * 50), 120 + Math.sin(t) * (60 + a * 50)); }
    if (pat === 2) for (let i = 0; i < 80; i++) { const t = i * 0.35 + ph, rr = 10 + i * 2.1; put(CX + Math.cos(t) * rr, 220 + Math.sin(t) * rr * 0.85); }
    if (pat === 3) for (let i = 0; i < 400 && this.pegs.length < 64; i++) put(this.r(20, W - 20), this.r(100, H - 80));
    if (pat === 4) for (let r = 0; r < 7; r++) for (let k = 0; k < 10; k++) put(20 + k * 36, 100 + r * 38 + Math.sin(k * 0.8 + r + ph) * 14);
    if (pat === 5) for (let c = 0; c < 5; c++) { const x = 44 + c * 68; for (let y = 150 + (c % 2) * 22; y < H - 84; y += 24) put(x, y); if (!near(x, 118)) { this.pegs.push({ x, y: 122, w: 40, h: 8, brick: true, k: 'blue', lit: false, gone: false, flash: 0 }); shelves.push({ x, y: 122, w: 40, cap: true }); } }
    if (pat === 6) { // wheels of pegs turning
      const n = this.ri(2, 3);
      for (let k = 0; k < n; k++) {
        const cx = n === 2 ? 100 + k * 160 : 70 + k * 110, cy = 170 + (k % 2) * 90, R = this.r(36, 50), m = Math.floor((TAU * R) / 24), w = (k % 2 ? 1 : -1) * this.r(0.5, 1);
        for (let i = 0; i < m; i++) { const a0 = (i / m) * TAU; add(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, { cx, cy, R, a0, w }); }
        add(cx, cy);
      }
      for (let i = 0; i < 200 && this.pegs.length < 70; i++) put(this.r(20, W - 20), this.r(100, H - 80));
    }
    if (pat === 7) { // heart
      for (let i = 0; i < 44; i++) { const t = (i / 44) * TAU, hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); put(CX + hx * 8.6, 205 + hy * 8.6); }
      for (let y = 150; y < 280; y += 26) for (let x = CX - 70; x <= CX + 70; x += 28) put(x + ((y / 26) % 2) * 14, y);
    }
    if (pat === 8) for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) put(18 + k * 25, 108 + r * 54 + (k % 2) * 17);
    if (pat === 9) for (let r = 0; r < 6; r++) { const amp = this.r(16, 34), f = this.r(0.6, 1.2), p0 = this.r(0, TAU); for (let k = 0; k < 7; k++) { const sx = 46 + k * 45 + (r % 2) * 22; if (sx - amp > 16 && sx + amp < W - 16) put(sx, 110 + r * 42, { sx, amp, f, ph: p0 }); } }
    if (pat === 10) for (let k = 0; k < 4; k++) for (let i = 0; i < 9; i++) { const v = (i - 4) * 19; put(CX + v * (k % 2 ? 1 : -1) * 1.6 + (k - 1.5) * 20, 120 + k * 60 + Math.abs(v) * 0.9); put(CX - v * 1.6, 130 + k * 60 + Math.abs(v) * 0.9); }
    for (let i = 0; i < 300 && this.pegs.length < 34; i++) put(this.r(20, W - 20), this.r(100, H - 80));
    // kinds: oranges to clear, two greens, a few bombs; the purple moves every shot
    const pool = this.pegs.filter((p) => !p.wall);
    for (let i = pool.length - 1; i > 0; i--) { const j = this.ri(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const nO = Math.max(6, Math.min(22, Math.round(pool.length * 0.27))), nB = this.ri(2, 5) + (this.mods.swarm ? 3 : 0);
    pool.slice(0, nO).forEach((p) => (p.k = 'orange'));
    pool.slice(nO, nO + 2).forEach((p) => (p.k = 'green'));
    pool.slice(nO + 2, nO + 2 + nB).forEach((p) => { if (!p.brick) p.k = 'bomb'; });
    this.oranges = nO; this.litOrange = 0;
    for (const p of this.pegs) this.stampPeg(p, true);
    for (const s of shelves) { // heaps on shelves, pools in troughs
      const t = this.kit.shelf, cs = m.cs;
      if (liquid && !s.cap) m.crumbleRect(s.x - s.w / 2 + 7, s.y - 22, s.w - 14, 17, t, null, false);
      else for (let row = 0, h = s.cap ? 4 : 9; row < h; row++) { const inset = row * cs * 1.15 + 2; if (s.w / 2 - inset > 2) m.crumbleRect(s.x - s.w / 2 + inset, s.y - 4 - (row + 1) * cs, s.w - inset * 2, cs, t === POWDER || this.rng() < 0.5 ? t : SAND, t === SAND ? this.col(this.ri(0, 5)) : null, false); }
    }
    this.bucket = { x: CX, dir: 1, cell: Math.floor((CX - BK_W / 2) / m.cs), fill: 0, dumpT: 0 };
    this.stampBucket(true);
    m.settle(20);
    this.shots = 10; this.phase = 'aim'; this.lt = 0; this.balls = []; this.fever = false; this.feverPaid = false; this.plan = null; this.storm = 0;
    this.pickPurple(); this.buildGrid();
    this.fx.banner(`LEVEL ${this.lvl}`, `${nO} orange pegs · ${this.power === 'multi' ? 'multiball' : this.power === 'fire' ? 'fireball' : this.power === 'bomb' ? 'bomb ball' : this.kit.name.toLowerCase()} on green`, COL.orange, 1.8);
  }
  stampPeg(p, on) {
    if (p.brick) this.mat.solidRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, on);
    else this.mat.solid(p.x, p.y, p.r, on);
    p.sc = on ? Math.floor(p.x / 3) * 1000 + Math.floor(p.y / 3) : -1;
  }
  stampBucket(on) {
    const m = this.mat, x = this.bucket.cell * m.cs;
    m.solidRect(x, BK_Y, 4, H - BK_Y, on); m.solidRect(x + BK_W - 4, BK_Y, 4, H - BK_Y, on); m.solidRect(x, H - 4, BK_W, 4, on);
  }
  pickPurple() {
    for (const p of this.pegs) p.purple = false;
    const blues = this.pegs.filter((p) => !p.gone && !p.lit && p.k === 'blue' && !p.wall);
    if (blues.length) blues[this.ri(0, blues.length - 1)].purple = true;
  }
  // static pegs in a coarse grid for the autopilot's look-ahead
  buildGrid() {
    this.gx = Math.ceil(W / GC); this.grid = Array.from({ length: this.gx * Math.ceil(H / GC) }, () => []);
    for (const p of this.pegs) {
      if (p.gone || p.R || p.amp) continue;
      const hw = (p.brick ? p.w / 2 : p.r) + 8, hh = (p.brick ? p.h / 2 : p.r) + 8;
      for (let y = Math.max(0, Math.floor((p.y - hh) / GC)); y <= Math.floor((p.y + hh) / GC); y++) for (let x = Math.max(0, Math.floor((p.x - hw) / GC)); x <= Math.min(this.gx - 1, Math.floor((p.x + hw) / GC)); x++) this.grid[y * this.gx + x]?.push(p);
    }
    this.moving = this.pegs.filter((p) => !p.gone && (p.R || p.amp));
  }
  // where a moving peg is at level time t, and how fast it goes
  pegAt(p, t) {
    if (p.R) { const a = p.a0 + p.w * t; return [p.cx + Math.cos(a) * p.R, p.cy + Math.sin(a) * p.R, -Math.sin(a) * p.R * p.w, Math.cos(a) * p.R * p.w]; }
    const a = p.ph + p.f * t; return [p.sx + Math.sin(a) * p.amp, p.y, Math.cos(a) * p.amp * p.f, 0];
  }
  mult() { const f = this.litOrange / this.oranges; return f < 0.4 ? 1 : f < 0.6 ? 2 : f < 0.76 ? 3 : f < 0.9 ? 5 : 10; }

  // ------------------------------------------------ shooting
  fire() {
    if (this.phase !== 'aim' || this.shots <= 0) return;
    const a = this.angle, x = CX + Math.cos(a) * 28, y = CY + Math.sin(a) * 28;
    this.balls = [this.newBall(x, y, Math.cos(a) * SPEED, Math.sin(a) * SPEED)];
    this.shots--; this.phase = 'fly'; this.shot = { pts: 0, hits: 0 }; this.plan = null;
    this.fx.sparks(x, y, 10, ['#fff6c8', '#ffb347'], 220, { dir: a, cone: 0.5 }); this.fx.puffs(x, y, 3, '#d8d4dc', 40, 0.7); this.fx.shake(1.5);
  }
  newBall(x, y, vx, vy) { return { x, y, vx, vy, r: 6 * this.S, still: 0, fireT: 0, bombs: 0, tail: new Tail(14), tk: 0, done: false }; }
  aimAt(x, y) { this.angle = Math.max(0.12, Math.min(Math.PI - 0.12, Math.atan2(y - CY, x - CX))); }
  down(x, y) { this.aimAt(x, y); }
  move(x, y) { this.aimAt(x, y); }
  up(x, y) { this.aimAt(x, y); this.fire(); }
  hud() { return `${this.score} · ${this.shots} balls`; }

  // ------------------------------------------------ autopilot: try many shots in a quick look-ahead, take the best
  autopilot(dt) {
    if (this.phase !== 'aim') return;
    if (!this.plan) {
      const list = Array.from({ length: 56 }, (_, i) => 0.14 + ((i + this.rng()) / 56) * (Math.PI - 0.28));
      this.plan = { list, k: 0, best: null, t: 0, wait: this.r(0.5, 1.1) };
    }
    const P = this.plan;
    P.t += dt;
    for (let n = 0; n < 2 && P.k < P.list.length; n++) {
      const a = P.list[P.k++], v = this.sim(a);
      if (!P.best || v > P.best.v) P.best = { a, v };
      if (P.k === 56) for (let j = -6; j <= 6; j++) if (j) P.list.push(P.best.a + j * 0.006);
    }
    const goal = P.best ? P.best.a : Math.PI / 2, da = goal - this.angle;
    this.angle += Math.sign(da) * Math.min(Math.abs(da), dt * 2.4);
    if (P.k >= P.list.length && Math.abs(da) < 1e-3 && P.t > P.wait) { this.angle += this.r(-0.003, 0.003); this.fire(); }
  }
  sim(a) {
    const b = { x: CX + Math.cos(a) * 28, y: CY + Math.sin(a) * 28, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, r: 6 * this.S }, dt = 1 / 60, g = 480 * this.G, seen = new Set();
    let v = 0, bx = this.bucket.x, bd = this.bucket.dir, t = this.lt;
    const left = this.oranges - this.litOrange;
    for (let s = 0; s < 330; s++) {
      b.vy += g * dt; b.x += b.vx * dt; b.y += b.vy * dt; t += dt;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.9; } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.9; }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.9; }
      const cell = this.grid[Math.floor(b.y / GC) * this.gx + Math.floor(b.x / GC)] || [];
      for (const p of cell) if (p.brick ? hitBrick(b, p, 0.6) : bounce(b, p.x, p.y, p.r, 0.78)) if (!seen.has(p)) { seen.add(p); v += p.k === 'orange' ? (left === 1 ? 40 : 10) : p.purple ? 12 : p.k === 'green' ? 7 : p.k === 'bomb' ? 7 + this.pegs.filter((q) => q.k === 'orange' && !q.gone && Math.hypot(q.x - p.x, q.y - p.y) < 46).length * 6 : 1; }
      for (const p of this.moving) {
        if (p.R ? Math.abs(b.x - p.cx) > p.R + 16 || Math.abs(b.y - p.cy) > p.R + 16 : Math.abs(b.y - p.y) > 16 || Math.abs(b.x - p.sx) > p.amp + 16) continue;
        const [x, y, ux, uy] = this.pegAt(p, t); if (bounce(b, x, y, p.r, 0.78, ux, uy) && !seen.has(p)) { seen.add(p); v += p.k === 'orange' ? (left === 1 ? 40 : 10) : p.k === 'bomb' ? 8 : 1; } }
      bx += bd * 90 * dt; if (bx > W - BK_W / 2 - 6) bd = -1; if (bx < BK_W / 2 + 6) bd = 1;
      if (b.y > BK_Y && Math.abs(b.x - bx) < BK_W / 2 - 6) { v += 6; break; }
      if (b.y > H + 10) break;
    }
    return v + this.rng() * 0.6;
  }

  // ------------------------------------------------ hits, explosions, powers
  light(p, b) {
    if (p.lit || p.gone) return;
    p.lit = true; p.flash = 0.5;
    const pts = (p.purple ? VAL.purple : VAL[p.k]) * this.mult();
    this.score += pts; if (this.shot) { this.shot.pts += pts; this.shot.hits++; }
    const col = p.purple ? COL.purple : COL[p.k];
    this.fx.pop(p.x, p.y - 12, `+${pts}`, col, p.k === 'orange' || p.purple ? 12 : 9);
    this.fx.sparks(p.x, p.y, p.k === 'orange' ? 8 : 4, [col, '#fff'], 160); this.fx.ring(p.x, p.y, 12, col, 0.3, 2);
    if (p.purple) { this.fx.confetti(p.x, p.y, 16, [COL.purple, '#fff', '#ffd6ff'], 160, 60); this.fx.pop(p.x, p.y - 26, 'BONUS!', '#e7c6ff', 11, true); }
    if (p.k === 'bomb') p.fuse = 0.22;
    if (p.k === 'green' && b) this.usePower(p, b);
    if (p.k === 'orange' && ++this.litOrange === this.oranges) this.extreme(p);
    if (b && b.bombs > 0 && p.k !== 'bomb') { b.bombs--; this.explode(p.x, p.y, 30); }
  }
  explode(x, y, r) {
    const fx = this.fx;
    this.mat.blast(x, y, r * 0.8, { power: 420 });
    fx.ring(x, y, r * 1.6, '#ffd27a', 0.45, 5); fx.sparks(x, y, 28, ['#fff3b0', '#ffb347', '#ff5a3c'], 430);
    fx.shards(x, y, 10, [COL.bomb, '#5a1a14'], 260); fx.puffs(x, y, 6, '#7a7480', 60, 1.4);
    fx.flash('#fff0c0', 0.22); fx.shake(7); fx.pop(x, y - 16, ['BOOM!', 'KABOOM!', 'BLAM!', 'KRAK!'][this.ri(0, 3)], '#ffcf4d', 15, true);
    for (const p of this.pegs) {
      if (p.gone) continue;
      const d = p.brick ? Math.hypot(Math.max(Math.abs(p.x - x) - p.w / 2, 0), Math.max(Math.abs(p.y - y) - p.h / 2, 0)) : Math.hypot(p.x - x, p.y - y) - p.r;
      if (d > r) continue;
      if (p.k === 'bomb' && !p.fuse && !p.lit) { this.light(p, null); p.fuse = 0.12 + d * 0.004; continue; }
      if (p.k === 'bomb') continue;
      this.light(p, null); this.crumble(p);
    }
    for (const b of this.balls) { const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy); if (d < r * 1.8 && d > 0.1) { const f = (1 - d / (r * 1.8)) * 380; b.vx += (dx / d) * f; b.vy += (dy / d) * f; } }
  }
  matOf(p) { return p.k === 'bomb' ? EMBER : p.k === 'orange' || p.purple ? this.kit.orange : p.k === 'green' ? SAND : this.kit.blue; }
  crumble(p) {
    if (p.gone) return;
    p.gone = true;
    const t = this.matOf(p), col = t === SAND ? (p.purple ? COL.purple : COL[p.k]) : null;
    if (p.brick) this.mat.crumbleRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, t, col);
    else this.mat.crumble(p.x, p.y, p.r, t, col);
    if (t !== EMBER) this.mat.spray(p.x, p.y, p.brick ? 18 : 12, t, col, 70, 0, -30);
    this.fx.puffs(p.x, p.y, 2, '#e8e0d8', 30, 0.6);
    if (t === LAVA || t === EMBER) this.fx.sparks(p.x, p.y, 5, '#ffb347', 120);
  }
  usePower(p, b) {
    const fx = this.fx;
    if (this.power === 'multi') { this.balls.push(this.newBall(p.x, p.y - 4, -b.vx * 0.8 + this.r(-40, 40), -Math.abs(b.vy) * 0.6 - 120)); fx.banner('MULTIBALL!', '', COL.green, 1.2); }
    else if (this.power === 'fire') { b.fireT = 3.5; fx.banner('FIREBALL!', 'burns straight through', '#ff7a1f', 1.2); }
    else if (this.power === 'bomb') { b.bombs = 4; fx.banner('BOMB BALL!', 'the next hits explode', COL.bomb, 1.2); }
    else { this.storm = 2.4; fx.banner(this.kit.name + '!', 'from above', '#5ac8ff', 1.2); }
    fx.confetti(p.x, p.y, 20, [COL.green, '#fff', '#c8ffd0'], 200, 80);
  }
  // the last orange peg: everything slows, the camera leans in, then fever
  extreme(p) {
    this.fever = true; this.slowT = 1.3; this.tsT = 0.12; this.zoomT = 2; this.focus = { x: p.x, y: p.y };
    const fx = this.fx;
    fx.banner('EXTREME FEVER', 'last orange peg!', COL.orange, 2.6); fx.flash('#fff2d8', 0.6); fx.shake(10);
    fx.confetti(p.x, p.y, 60, this.pal.c, 300, 120); fx.ring(p.x, p.y, 60, COL.orange, 0.7, 6); fx.ring(p.x, p.y, 34, '#fff', 0.5, 4);
    this.fireworks = 3.5;
  }
  firework() {
    const x = this.r(40, W - 40), y = this.r(60, 200), c = this.col(this.ri(0, 5));
    this.mat.spray(x, y, 24, SPARK, null, 240);
    this.fx.sparks(x, y, 26, [c, '#fff'], 300); this.fx.ring(x, y, 36, c, 0.45, 3); this.fx.confetti(x, y, 10, this.pal.c, 180, 40);
  }

  // ------------------------------------------------ stepping
  step(dt) {
    // slow motion and zoom follow their targets in real time
    if (this.slowT > 0) this.slowT -= dt; else if (this.tsT < 1) { this.tsT = 1; this.zoomT = 1; this.focus = null; }
    this.ts += (this.tsT - this.ts) * Math.min(1, dt * 8);
    this.zoom += (this.zoomT - this.zoom) * Math.min(1, dt * 4);
    const fx = this.focus ? this.focus.x : CX, fy = this.focus ? this.focus.y : H / 2;
    this.fcx += (fx - this.fcx) * Math.min(1, dt * 5); this.fcy += (fy - this.fcy) * Math.min(1, dt * 5);
    const sdt = dt * this.ts, m = this.mat;
    this.lt += sdt;
    // bucket glides and carries its sand
    const bk = this.bucket;
    if (!this.fever) {
      bk.x += bk.dir * 90 * sdt;
      if (bk.x > W - BK_W / 2 - 6) bk.dir = -1;
      if (bk.x < BK_W / 2 + 6) bk.dir = 1;
      const cell = Math.floor((bk.x - BK_W / 2) / m.cs);
      while (bk.cell !== cell) { const d = Math.sign(cell - bk.cell); m.shift(bk.cell * m.cs, BK_Y - 30, BK_W - 1, H - BK_Y + 30, d); bk.cell += d; }
    }
    for (const p of this.pegs) {
      p.flash = Math.max(0, p.flash - sdt);
      if (p.gone) continue;
      if (p.R || p.amp) {
        [p.x, p.y] = this.pegAt(p, this.lt);
        const sc = Math.floor(p.x / 3) * 1000 + Math.floor(p.y / 3);
        if (sc !== p.sc) { m.solid(p.ox ?? p.x, p.oy ?? p.y, p.r, false); m.solid(p.x, p.y, p.r, true); p.sc = sc; p.ox = p.x; p.oy = p.y; }
      }
      if (p.fuse > 0 && (p.fuse -= sdt) <= 0) { p.fuse = 0; this.crumble(p); this.explode(p.x, p.y, 46); }
    }
    for (const b of this.balls) this.stepBall(b, sdt);
    this.balls = this.balls.filter((b) => !b.done);
    // slow motion when a ball closes in on the last orange peg
    if (this.phase === 'fly' && !this.fever && this.oranges - this.litOrange === 1) {
      const p = this.pegs.find((q) => q.k === 'orange' && !q.lit && !q.gone);
      for (const b of this.balls) if (p) { const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy); if (d < 80 && dx * b.vx + dy * b.vy > 0) { this.tsT = 0.25; this.zoomT = 1.6; this.slowT = 0.25; this.focus = { x: (p.x + b.x) / 2, y: (p.y + b.y) / 2 }; } }
    }
    if (this.storm > 0) { this.storm -= sdt; for (let k = 0; k < 3; k++) m.emit(this.r(0, W), 2, this.r(-20, 20), this.r(20, 90), this.kit.shelf === POWDER ? POWDER : this.kit.blue === STONE ? LAVA : this.kit.blue, m.paint(this.kit.blue, this.kit.blue === SAND ? m.rgb(SAND, this.col(this.ri(0, 5))) : null)); }
    if (this.fireworks > 0) { this.fireworks -= dt; if (this.rng() < dt * 5) this.firework(); }
    m.g = this.G; m.step(sdt);
    for (const e of m.events) { // gunpowder blasts light and break pegs nearby, so powder trails chain
      this.fx.sparks(e.x, e.y, 8, '#ffcf6b', 240); this.fx.shake(2);
      for (const p of this.pegs) if (!p.gone && !p.brick && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 4) { if (p.k === 'bomb') { if (!p.fuse && !p.lit) { this.light(p, null); p.fuse = 0.15; } } else { this.light(p, null); this.crumble(p); } }
    }
    m.events.length = 0;
    // sand in the bucket pays; a full bucket erupts
    if ((bk.fillT = (bk.fillT || 0) - dt) <= 0 && !this.fever) {
      bk.fillT = 0.5;
      const n = m.amount(bk.cell * m.cs + 4, BK_Y - 24, BK_W - 8, H - BK_Y + 20);
      if (n > bk.fill + 4) { this.score += (n - bk.fill) * 2; this.fx.pop(bk.x, BK_Y - 10, `+${(n - bk.fill) * 2}`, '#ffe9a8', 9); }
      bk.fill = n;
      if (n > 150) { this.score += 300; m.blast(bk.x, H - 6, 34, { power: 380, fire: false }); this.fx.pop(bk.x, BK_Y - 26, 'BUCKET FULL! +300', '#ffe14d', 11, true); this.fx.confetti(bk.x, BK_Y, 24, this.pal.c, 220, 160); bk.fill = 0; }
    }
    this.fx.step(sdt, this.G);
    this.phases(dt);
  }
  stepBall(b, dt) {
    const g = 480 * this.G;
    b.vy += g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.9; } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.9; }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.9; }
    for (const p of this.pegs) {
      if (p.gone || Math.abs(p.x - b.x) > (p.w || 0) / 2 + 16 || Math.abs(p.y - b.y) > (p.h || 0) / 2 + 30) continue;
      if (b.fireT > 0 && !p.brick) { if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r) { this.light(p, b); b.vx *= 0.97; b.vy *= 0.97; } continue; }
      let hit;
      if (p.brick) hit = hitBrick(b, p, 0.6);
      else if (p.R || p.amp) { const [, , ux, uy] = this.pegAt(p, this.lt); hit = bounce(b, p.x, p.y, p.r, 0.78, ux, uy); }
      else hit = bounce(b, p.x, p.y, p.r, 0.78);
      if (hit) this.light(p, b);
    }
    // bucket rims and catch
    const bk = this.bucket, bx = bk.cell * this.mat.cs + BK_W / 2;
    if (!this.fever) {
      bounce(b, bx - BK_W / 2 + 2, BK_Y, 3, 0.6); bounce(b, bx + BK_W / 2 - 2, BK_Y, 3, 0.6);
      if (b.y > BK_Y + 2 && Math.abs(b.x - bx) < BK_W / 2 - 4) { b.done = true; this.shots++; this.fx.confetti(b.x, BK_Y, 24, this.pal.c, 220, 150); this.fx.pop(bx, BK_Y - 14, 'FREE BALL!', '#7fffb0', 12, true); this.fx.ring(bx, BK_Y, 40, '#7fffb0', 0.5, 3); return; }
    }
    const m = this.mat.plow(b.x, b.y, b.r, b.vx, b.vy), met = this.mat.met;
    if (m) { const f = 1 / (1 + Math.min(m, 16) * 0.008); b.vx *= f; b.vy *= f; }
    if (met[WATER] > 3) b.vy -= g * dt * 0.45;
    if (b.fireT > 0) { b.fireT -= dt; if (this.rng() < 0.5) this.mat.emit(b.x, b.y, this.r(-30, 30), this.r(-40, 0), FIRE, 0, 0.3); if (this.rng() < 0.3) this.mat.pour(b.x - b.vx * 0.02, b.y - b.vy * 0.02, 4, FIRE, 1); }
    if (++b.tk % 2 === 0) b.tail.push(b.x, b.y);
    // stuck on pegs: clear the lit ones around it, as in the original
    if (Math.abs(b.vx) + Math.abs(b.vy) < 40) {
      if ((b.still += dt) > 1) { b.still = 0; let freed = false; for (const p of this.pegs) if (p.lit && !p.gone && Math.hypot(p.x - b.x, p.y - b.y) < 30) { this.crumble(p); freed = true; } if (!freed) { b.vx += this.r(-80, 80); b.vy -= 40; } }
    } else b.still = 0;
    if (b.y > H + 16) {
      b.done = true;
      if (this.fever && !this.feverPaid) { // fever slots along the bottom
        this.feverPaid = true;
        const i = Math.max(0, Math.min(4, Math.floor(b.x / (W / 5)))), v = [500, 1500, 5000, 1500, 500][i];
        this.score += v; this.fx.pop((i + 0.5) * (W / 5), H - 30, `+${v}`, '#ffe14d', 18, true); this.fx.confetti((i + 0.5) * (W / 5), H - 10, 50, this.pal.c, 320, 260); this.fx.flash('#fff', 0.3);
      }
    }
  }
  phases(dt) {
    if (this.phase === 'fly' && !this.balls.length) {
      this.phase = 'clear'; this.clearT = 0;
      this.queue = this.pegs.filter((p) => p.lit && !p.gone);
      if (this.shot?.pts > 0) this.fx.pop(CX, 112, `SHOT +${this.shot.pts}`, '#fff', 13);
    } else if (this.phase === 'clear') {
      if ((this.clearT -= dt) > 0) return;
      this.clearT = 0.045;
      const p = this.queue.shift();
      if (p) { if (!p.gone && !p.fuse) this.crumble(p); return; }
      if (this.pegs.some((q) => q.fuse > 0)) return;
      this.pegs = this.pegs.filter((q) => !q.gone);
      if (this.fever) {
        this.phase = 'won'; this.wait = 3.2; this.fireworks = 2.5; this.score += this.shots * 1000;
        this.fx.banner('LEVEL CLEAR!', `+${this.shots * 1000} for ${this.shots} spare balls`, '#7fffb0', 2.6);
        for (const q of this.pegs) q.fuse = q.k === 'bomb' ? 0.2 + this.r(0, 1.5) : 0;
        this.wave = this.pegs.slice().sort((a, b) => a.y - b.y);
      } else if (this.shots <= 0) { this.phase = 'lost'; this.wait = 2.4; this.fx.banner('OUT OF BALLS', `${this.oranges - this.litOrange} orange pegs left`, '#ff8a8a', 2.2); }
      else { this.phase = 'aim'; this.pickPurple(); this.buildGrid(); }
    } else if (this.phase === 'won' || this.phase === 'lost') {
      if (this.phase === 'won' && this.wave?.length && this.rng() < dt * 30) { const p = this.wave.shift(); if (!p.gone) { this.light(p, null); this.crumble(p); } } // the rest of the board rains down
      if ((this.wait -= dt) <= 0) this.level();
    }
  }

  // ------------------------------------------------ drawing
  pegSprite(k, lit) {
    const key = k + lit;
    if (this.spr[key]) return this.spr[key];
    const s = 2, r = PR, n = Math.ceil((r + 3) * 2), cv = Object.assign(document.createElement('canvas'), { width: n * s, height: n * s }), x = cv.getContext('2d'), col = COL[k];
    x.scale(s, s); x.translate(n / 2, n / 2);
    const g = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, lit ? '#fff' : '#ffffffaa'); g.addColorStop(lit ? 0.5 : 0.25, col); g.addColorStop(1, lit ? col : '#00000055');
    x.fillStyle = col; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill(); x.fillStyle = g; x.fill();
    x.lineWidth = lit ? 1.6 : 1; x.strokeStyle = lit ? '#fff' : 'rgba(0,0,0,.55)'; x.stroke();
    if (k === 'bomb') {
      x.fillStyle = '#17110f'; x.beginPath(); x.arc(0, r * 0.12, r * 0.62, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(-r * 0.22, -r * 0.08, r * 0.16, 0, TAU); x.fill();
      x.strokeStyle = '#d9b37a'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(r * 0.3, -r * 0.4); x.quadraticCurveTo(r * 0.7, -r * 0.9, r * 0.35, -r * 1.15); x.stroke();
      x.fillStyle = '#ffe14d'; x.beginPath(); x.arc(r * 0.35, -r * 1.15, 1.4, 0, TAU); x.fill();
    }
    return (this.spr[key] = cv);
  }
  draw(c) {
    this.clear(c);
    const z = this.zoom, fx = this.fx, vx = Math.max(W / (2 * z), Math.min(W - W / (2 * z), this.fcx)), vy = Math.max(H / (2 * z), Math.min(H - H / (2 * z), this.fcy));
    c.save(); c.translate(W / 2 + fx.ox, H / 2 + fx.oy); c.scale(z, z); c.translate(-vx, -vy);
    // pegs
    for (const p of this.pegs) {
      if (p.gone) continue;
      const k = p.purple ? 'purple' : p.k, col = COL[k];
      if (p.lit || p.flash || p.k === 'bomb') { const g = glowSprite(col), q = (p.brick ? p.w : 18) * (1.6 + p.flash); c.globalCompositeOperation = 'lighter'; c.globalAlpha = p.lit ? 0.55 : p.flash || 0.22 + Math.sin(this.t * 5 + p.x) * 0.12; c.drawImage(g, p.x - q / 2, p.y - q / 2, q, q); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
      if (p.brick) {
        c.fillStyle = col; c.globalAlpha = p.lit ? 1 : 0.85; roundRect(c, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 3); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = p.lit ? '#fff' : 'rgba(0,0,0,.5)'; c.lineWidth = p.lit ? 1.5 : 1; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(p.x - p.w / 2 + 2, p.y - p.h / 2 + 1.5, p.w - 4, 1.5);
      } else {
        const s = this.pegSprite(k, p.lit), w = s.width / 2, j = p.fuse > 0 ? Math.sin(this.t * 80) * 1.3 : 0;
        c.drawImage(s, p.x - w / 2 + j, p.y - w / 2, w, w);
        if (p.fuse > 0) { const g = glowSprite('#ffcf6b'), q = 16 + Math.sin(this.t * 60) * 4; c.globalCompositeOperation = 'lighter'; c.drawImage(g, p.x + 2 - q / 2, p.y - 7 - q / 2, q, q); c.globalCompositeOperation = 'source-over'; }
      }
    }
    // bucket (or fever slots)
    const bk = this.bucket, bx = bk.cell * this.mat.cs;
    if (this.fever) {
      [500, 1500, 5000, 1500, 500].forEach((v, i) => { c.fillStyle = i === 2 ? '#ffd23f' : i % 2 ? COL.purple : COL.orange; c.globalAlpha = 0.35 + Math.sin(this.t * 8 + i) * 0.1; c.fillRect(i * (W / 5) + 2, H - 22, W / 5 - 4, 22); c.globalAlpha = 1; this.text(c, String(v), (i + 0.5) * (W / 5), H - 10, 11, '#fff'); });
    } else { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(bx + 4, BK_Y, BK_W - 8, H - BK_Y); }
    this.mat.draw(c);
    if (!this.fever) {
      c.fillStyle = this.col(1); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(bx, BK_Y - 2); c.lineTo(bx + 4, BK_Y - 2); c.lineTo(bx + 4, H - 4); c.lineTo(bx + BK_W - 4, H - 4); c.lineTo(bx + BK_W - 4, BK_Y - 2); c.lineTo(bx + BK_W, BK_Y - 2); c.lineTo(bx + BK_W, H); c.lineTo(bx, H); c.closePath(); c.fill(); c.stroke();
    }
    // balls
    for (const b of this.balls) {
      b.tail.draw(c, b.fireT > 0 ? 'comet' : this.tail, b.fireT > 0 ? '#ff7a1f' : this.pal.ink, b.r * 1.4, this.t);
      if (b.fireT > 0 || b.bombs > 0) { const g = glowSprite(b.fireT > 0 ? '#ff7a1f' : COL.bomb), q = b.r * 6; c.globalCompositeOperation = 'lighter'; c.drawImage(g, b.x - q / 2, b.y - q / 2, q, q); c.globalCompositeOperation = 'source-over'; }
      this.orb(c, this.shotImg, b.x, b.y, b.r, this.pal.ink, this.t * 5);
    }
    // cannon
    c.save(); c.translate(CX, CY); c.rotate(this.angle);
    c.fillStyle = 'rgba(0,0,0,.4)'; roundRect(c, 2, -8, 34, 16, 6); c.fill();
    c.fillStyle = this.col(1); roundRect(c, 0, -7, 32, 14, 5); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(4, -5, 24, 3);
    c.restore();
    c.fillStyle = this.col(2); c.beginPath(); c.arc(CX, CY, 15, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.5; c.stroke();
    if (this.phase === 'aim' && this.shots > 0) this.orb(c, this.shotImg, CX, CY, 6 * this.S, this.pal.ink, this.t);
    if (this.phase === 'aim' && !this.auto) this.guide(c);
    fx.draw(c);
    c.restore();
    // spare balls and the orange meter
    for (let i = 0; i < Math.min(this.shots, 15); i++) { c.fillStyle = this.pal.ink; c.globalAlpha = 0.75; c.beginPath(); c.arc(9, 84 + i * 13, 4.2, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    const f = this.litOrange / this.oranges, mh = 150;
    c.fillStyle = 'rgba(0,0,0,.35)'; roundRect(c, W - 13, 80, 7, mh, 3); c.fill();
    c.fillStyle = COL.orange; roundRect(c, W - 13, 80 + mh * (1 - f), 7, mh * f + 0.01, 3); c.fill();
    this.text(c, `×${this.mult()}`, W - 10, 70, 10, COL.orange);
    fx.over(c);
  }
  guide(c) {
    const b = { x: CX + Math.cos(this.angle) * 28, y: CY + Math.sin(this.angle) * 28, vx: Math.cos(this.angle) * SPEED, vy: Math.sin(this.angle) * SPEED, r: 6 * this.S };
    c.fillStyle = 'rgba(255,255,255,.4)';
    for (let i = 0; i < 30; i++) {
      for (let k = 0; k < 4; k++) { b.vy += (480 * this.G) / 120; b.x += b.vx / 120; b.y += b.vy / 120; }
      if (this.pegs.some((p) => !p.gone && (p.brick ? Math.abs(p.x - b.x) < p.w / 2 + b.r && Math.abs(p.y - b.y) < p.h / 2 + b.r : Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r))) break;
      c.beginPath(); c.arc(b.x, b.y, 2, 0, TAU); c.fill();
    }
  }
}
