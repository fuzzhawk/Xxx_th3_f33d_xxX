import { Game, W, H, drawFit, ready } from './engine.js';

// ================================================================ Merge (Suika-like)
// Discs roll, spin and stack (sequential impulses with friction and rolling resistance) in containers of
// different shapes, one per post: box, bowl, funnel, hourglass, tray, flask, tilted box, two chambers, planet.
const FRUIT = ['🫐', '🍒', '🍓', '🍋', '🍊', '🍎', '🍑', '🍍', '🥥', '🍈', '🍉'];
const RADII = [11, 15, 20, 25, 31, 38, 45, 53, 61, 70, 80];
const WALL = 4, PI = Math.PI;
const FIXED = { vx: 0, vy: 0, w: 0, r: 0, im: 0, ii: 0 };
const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
// `wall` is an open polyline from rim to rim, `extra` more polylines, `k` scales the discs, `rail` the dropper's height
const MODES = {
  box: () => ({ wall: [[22, 84], [22, 402], [338, 402], [338, 84]] }),
  bowl: () => ({ wall: [[20, 84], ...arc(180, 244, 160, PI, 0, 20), [340, 84]] }),
  funnel: () => ({ wall: [[10, 84], [112, 402], [248, 402], [350, 84]], k: 0.9 }),
  hourglass: () => ({ wall: [[14, 84], [134, 226], [134, 248], [14, 328], [14, 402], [346, 402], [346, 328], [226, 248], [226, 226], [346, 84]], k: 0.88 }),
  tray: () => ({ wall: [[8, 226], [46, 402], [314, 402], [352, 226]], rail: 150, k: 0.8 }),
  flask: () => ({ wall: [[100, 84], ...arc(180, 252, 158, (PI * 4) / 3, -PI / 3, 28), [260, 84]], k: 0.92 }),
  tilt: (R) => {
    const a = (R() < 0.5 ? -1 : 1) * 0.17, c = Math.cos(a), s = Math.sin(a), p = (x, y) => [180 + x * c - y * s, 262 + x * s + y * c];
    return { wall: [p(-142, -118), p(-142, 118), p(142, 118), p(142, -118)], k: 0.9 };
  },
  twin: () => ({ wall: [[22, 84], [22, 402], [338, 402], [338, 84]], extra: [[[171, 402], [180, 250], [189, 402]]] }),
  planet: () => ({ core: [180, 238, 26], ring: 142, orbit: 160, k: 0.9 })
};
// circle against a capsule segment [ax, ay, bx, by, radius]: [nx, ny, depth] pointing at the disc, or null
function segHit(x, y, r, s) {
  const ex = s[2] - s[0], ey = s[3] - s[1], L = ex * ex + ey * ey;
  let t = L ? ((x - s[0]) * ex + (y - s[1]) * ey) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - s[0] - ex * t, dy = y - s[1] - ey * t, rr = r + s[4], d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2) || 0.01;
  return [dx / d, dy / d, rr - d];
}

export class Merge extends Game {
  setup() {
    const keys = Object.keys(MODES);
    this.mode = keys[this.ri(0, keys.length - 1)];
    const m = this.m = MODES[this.mode](this.rng);
    this.k = (m.k || 1) * Math.sqrt(this.S) * (this.mods.swarm ? 0.85 : 1);
    m.segs = [];
    for (const line of [m.wall, ...(m.extra || [])].filter(Boolean)) for (let i = 1; i < line.length; i++) m.segs.push([...line[i - 1], ...line[i], WALL]);
    if (m.core) { m.segs.push([m.core[0], m.core[1], m.core[0], m.core[1], m.core[2]]); this.aimA = -PI / 2; }
    else {
      const a = m.wall[0], b = m.wall[m.wall.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      m.rim = a; m.rn = [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
      m.x0 = Math.min(a[0], b[0]); m.x1 = Math.max(a[0], b[0]);
      m.railY = m.rail || Math.min(a[1], b[1]) - 34;
    }
    this.balls = []; this.rings = [];
    this.cur = this.ri(0, 3); this.nxt = this.ri(0, 3);
    this.aimX = W / 2; this.cool = 0; this.over = 0; this.flash = 0; this.useEmoji = this.rng() < 0.35;
    this.lvImg = this.rng() < 0.75 ? this.skin.list('levels', RADII.length, 'animal', 'ball', 'item', 'enemy') : null;
  }
  rad(lv) { return RADII[lv] * this.k; }
  setAuto(a) { super.setAuto(a); this.goal = null; }
  // where the next disc hangs: on the rail, or on the orbit around the planet
  dropPos(r = this.rad(this.cur)) {
    const m = this.m;
    if (m.core) return [m.core[0] + Math.cos(this.aimA) * m.orbit, m.core[1] + Math.sin(this.aimA) * m.orbit];
    return [Math.max(m.x0 + r + WALL + 1, Math.min(m.x1 - r - WALL - 1, this.aimX)), m.railY];
  }
  dropAt() {
    if (this.cool > 0) return;
    const R = this.rad(this.cur), [x, y] = this.dropPos(R);
    this.balls.push({ x, y, vx: 0, vy: 0, w: this.r(-1, 1), a: this.r(0, 6.3), r: R, R, lv: this.cur, age: 0, grow: 1 });
    this.mass(this.balls[this.balls.length - 1]);
    this.cur = this.nxt; this.nxt = this.ri(0, this.mods.swarm ? 2 : 3); this.cool = 0.55;
  }
  mass(b) { const m = b.r * b.r; b.im = 1 / m; b.ii = 2 / (m * b.r * b.r); }
  aim(x, y) { const m = this.m; if (m.core) this.aimA = Math.atan2(y - m.core[1], x - m.core[0]); else this.aimX = x; }
  down(x, y) { this.aim(x, y); }
  move(x, y) { this.aim(x, y); }
  up(x, y) { this.aim(x, y); this.dropAt(); }

  // first resting contact of a disc dropped from (x, y) along (dx, dy): distance travelled and the disc it lands on
  landing(x, y, dx, dy, r) {
    let s = 1e9, hit = null;
    for (const b of this.balls) {
      const px = b.x - x, py = b.y - y, t = px * dx + py * dy, q = px * dy - py * dx, rr = r + b.r;
      if (t <= 0 || Math.abs(q) >= rr) continue;
      const sc = t - Math.sqrt(rr * rr - q * q);
      if (sc < s) { s = sc; hit = b; }
    }
    for (let t = 0; t < s; t += 4) if (this.m.segs.some((g) => segHit(x + dx * t, y + dy * t, r, g))) return [t, null];
    return [s, hit];
  }
  // score candidate drops: land on a twin, low and away from the rim
  plan() {
    const m = this.m, r = this.rad(this.cur);
    let best = null, bs = -1e9;
    for (let i = 0; i <= 26; i++) {
      let x, y, dx = 0, dy = 1, v;
      if (m.core) { v = (i / 27) * PI * 2; x = m.core[0] + Math.cos(v) * m.orbit; y = m.core[1] + Math.sin(v) * m.orbit; dx = -Math.cos(v); dy = -Math.sin(v); }
      else { v = m.x0 + r + WALL + 1 + ((m.x1 - m.x0 - 2 * (r + WALL + 1)) * i) / 26; x = v; y = m.railY; }
      const [t, hit] = this.landing(x, y, dx, dy, r), lx = x + dx * t, ly = y + dy * t;
      let s = this.r(0, 2) + (m.core ? -Math.hypot(lx - m.core[0], ly - m.core[1]) * 0.06 : ly * 0.04);
      if (hit) { const d = hit.lv - this.cur; s += d === 0 ? 40 : d === 1 ? 5 : d > 1 ? 1 : 4 * d; }
      for (const b of this.balls) if (b !== hit && b.lv === this.cur && Math.hypot(b.x - lx, b.y - ly) < r + b.r + 14) s += 8;
      if (this.out({ x: lx, y: ly, r: r + 8 })) s -= 40;
      if (s > bs) { bs = s; best = v; }
    }
    return best;
  }
  autopilot(dt) {
    if (this.goal == null) {
      if (this.cool > 0) return;
      this.goal = this.plan(); this.hold = this.r(0.2, 0.55);
    }
    let d;
    if (this.m.core) { d = Math.atan2(Math.sin(this.goal - this.aimA), Math.cos(this.goal - this.aimA)); this.aimA += Math.sign(d) * Math.min(Math.abs(d), 2.4 * dt); d *= 60; }
    else { d = this.goal - this.aimX; this.aimX += Math.sign(d) * Math.min(Math.abs(d), 260 * dt); }
    if (Math.abs(d) < 1) { this.hold -= dt; if (this.hold <= 0) { this.dropAt(); this.goal = null; } }
  }
  out(b) {
    const m = this.m;
    if (m.core) return Math.hypot(b.x - m.core[0], b.y - m.core[1]) + b.r > m.ring;
    return (b.x - m.rim[0]) * m.rn[0] + (b.y - m.rim[1]) * m.rn[1] > -b.r;
  }
  merge(a, b) {
    a.dead = b.dead = true;
    const lv = a.lv + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    this.score += (lv + 1) * 3;
    this.burst(x, y, this.col(lv), 14);
    this.rings.push({ x, y, r: this.rad(Math.min(lv, RADII.length - 1)), t: 0, c: this.col(lv) });
    if (lv >= RADII.length) { this.score += 300; this.burst(x, y, this.col(lv + 1), 40, 320); return; }
    const R = this.rad(lv), n = { x, y, vx: (a.vx + b.vx) / 2, vy: this.m.core ? (a.vy + b.vy) / 2 : Math.min(0, (a.vy + b.vy) / 2), w: (a.w + b.w) / 2, a: a.a, r: R * 0.6, R, lv, age: 0.6, grow: 0 };
    this.mass(n); this.balls.push(n);
  }
  contact(a, b, nx, ny, s) {
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny, im = a.im + b.im;
    a.touch = b.touch = true;
    return { a, b, nx, ny, s, mn: 1 / im, mt: 1 / (3 * im), bias: vn < -70 ? -vn * (a === FIXED ? 0.22 : 0.15) : 0, mu: a === FIXED ? 0.6 : 0.45, pn: 0, pt: 0 };
  }
  step(dt) {
    this.cool -= dt; this.flash = Math.max(0, this.flash - dt);
    const m = this.m, g = 900 * this.G, bs = this.balls;
    for (const b of bs) {
      if (b.grow < 1) { b.grow = Math.min(1, b.grow + dt * 7); b.r = b.R * (0.6 + 0.4 * b.grow); this.mass(b); }
      if (m.core) { const dx = m.core[0] - b.x, dy = m.core[1] - b.y, d = Math.hypot(dx, dy) || 1; b.vx += (dx / d) * g * dt; b.vy += (dy / d) * g * dt; }
      else b.vy += g * dt;
      b.age += dt; b.touch = false;
    }
    const cs = [];
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (a.dead) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        if (a.lv === b.lv) { this.merge(a, b); break; }
        const d = Math.sqrt(d2) || 0.01;
        cs.push(this.contact(a, b, dx / d, dy / d, 0));
      }
      if (a.dead) continue;
      m.segs.forEach((s, k) => { const h = segHit(a.x, a.y, a.r, s); if (h) cs.push(this.contact(FIXED, a, h[0], h[1], -1 - k)); });
    }
    // velocities: normal impulses (bounce only on hard hits) and Coulomb friction that spins the discs
    for (let it = 0; it < 10; it++) for (const k of cs) {
      const { a, b, nx, ny } = k, tx = -ny, ty = nx;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      const p0 = k.pn; k.pn = Math.max(0, p0 + (k.bias - vn) * k.mn);
      const pn = k.pn - p0;
      a.vx -= pn * nx * a.im; a.vy -= pn * ny * a.im; b.vx += pn * nx * b.im; b.vy += pn * ny * b.im;
      const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty - b.w * b.r - a.w * a.r;
      const t0 = k.pt, lim = k.mu * k.pn; k.pt = Math.max(-lim, Math.min(lim, t0 - vt * k.mt));
      const pt = k.pt - t0;
      a.vx -= pt * tx * a.im; a.vy -= pt * ty * a.im; a.w -= pt * a.r * a.ii;
      b.vx += pt * tx * b.im; b.vy += pt * ty * b.im; b.w -= pt * b.r * b.ii;
    }
    for (const b of bs) {
      if (b.dead) continue;
      if (b.touch) { b.w *= 1 - 2.5 * dt; b.vx *= 1 - 0.15 * dt; b.vy *= 1 - 0.15 * dt; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
      if (b.y > H + 150 || b.y < -200 || b.x < -150 || b.x > W + 150) b.dead = true;
    }
    // positions: push overlapping pairs apart by inverse mass, out of the walls completely
    for (let it = 0; it < 3; it++) for (const k of cs) {
      const { a, b } = k;
      if (a.dead || b.dead) continue;
      if (a === FIXED) {
        const h = segHit(b.x, b.y, b.r, m.segs[-1 - k.s]);
        if (h && h[2] > 0.05) { b.x += h[0] * (h[2] - 0.05); b.y += h[1] * (h[2] - 0.05); }
        continue;
      }
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, pen = a.r + b.r - d - 0.1;
      if (pen <= 0) continue;
      const c = (Math.min(pen, 6) * 0.6) / (a.im + b.im);
      a.x -= (dx / d) * c * a.im; a.y -= (dy / d) * c * a.im; b.x += (dx / d) * c * b.im; b.y += (dy / d) * c * b.im;
    }
    this.balls = bs.filter((b) => !b.dead);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.45);
    const high = this.balls.some((b) => b.age > 2 && this.out(b) && b.vx * b.vx + b.vy * b.vy < 1600);
    this.over = high ? this.over + dt : 0;
    if (this.over > 1.6) { this.balls.forEach((b) => this.burst(b.x, b.y, this.col(b.lv), 4)); this.balls = []; this.score = 0; this.over = 0; this.flash = 1.4; }
  }

  drawBall(c, x, y, r, lv, a = 0) {
    const li = this.lvImg?.[lv];
    c.save(); c.translate(x, y);
    c.fillStyle = this.col(lv); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.rotate(a);
    if (li && ready(li)) drawFit(c, li, 0, 0, r * 1.72, r * 1.72);
    else if (this.useEmoji) { c.font = `${r * 1.25}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(FRUIT[lv] || '⭐', 0, r * 0.06); }
    else {
      c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(0, -r * 0.62, r * 0.16, 0, 7); c.arc(r * 0.55, r * 0.42, r * 0.11, 0, 7); c.arc(-r * 0.6, r * 0.3, r * 0.08, 0, 7); c.fill();
      c.fillStyle = this.pal.bg; c.beginPath(); c.arc(-r * 0.3, -r * 0.05, r * 0.09 + 1, 0, 7); c.arc(r * 0.3, -r * 0.05, r * 0.09 + 1, 0, 7); c.fill();
      c.strokeStyle = this.pal.bg; c.lineWidth = 1.5; c.beginPath(); c.arc(0, r * 0.12, r * 0.22, 0.2, PI - 0.2); c.stroke();
    }
    c.rotate(-a);
    // light stays put while the disc turns underneath
    c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.ellipse(-r * 0.36, -r * 0.42, r * 0.34, r * 0.2, -0.6, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, r - 0.75, 0, 7); c.stroke();
    c.restore();
  }
  draw(c) {
    this.clear(c);
    const m = this.m, warn = this.over > 0;
    c.lineJoin = c.lineCap = 'round';
    if (m.core) {
      const [cx, cy, cr] = m.core;
      c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.arc(cx, cy, m.ring, 0, 7); c.fill();
      c.strokeStyle = warn ? this.col(3) : 'rgba(255,255,255,.16)'; c.setLineDash([6, 6]); c.lineWidth = 1; c.stroke(); c.setLineDash([]);
      const gr = c.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, 2, cx, cy, cr);
      gr.addColorStop(0, this.pal.c[4]); gr.addColorStop(1, this.pal.c[3]);
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, cr, 0, 7); c.fill();
    } else {
      c.beginPath(); m.wall.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      c.fillStyle = 'rgba(255,255,255,.05)'; c.fill();
      c.strokeStyle = warn ? this.col(3) : 'rgba(255,255,255,.16)'; c.setLineDash([6, 6]); c.lineWidth = 1;
      const [a, b] = [m.wall[0], m.wall[m.wall.length - 1]]; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
      c.beginPath();
      for (const line of [m.wall, ...(m.extra || [])]) line.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.globalAlpha = 0.6; c.strokeStyle = this.pal.c[4]; c.lineWidth = WALL * 2; c.stroke();
      c.globalAlpha = 0.35; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1;
    }
    for (const b of this.balls) this.drawBall(c, b.x, b.y, b.r, b.lv, b.a);
    for (const r of this.rings) { c.globalAlpha = 1 - r.t / 0.45; c.strokeStyle = r.c; c.lineWidth = 3; c.beginPath(); c.arc(r.x, r.y, r.r * (1 + r.t * 1.6), 0, 7); c.stroke(); }
    c.globalAlpha = 1;
    // dropper and its guide
    const R = this.rad(this.cur), [x, y] = this.dropPos(R);
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y);
    if (m.core) c.lineTo(m.core[0], m.core[1]); else c.lineTo(x, H);
    c.stroke();
    c.globalAlpha = this.cool > 0 ? 0.35 : 1; this.drawBall(c, x, y, R, this.cur); c.globalAlpha = 1;
    this.drawBall(c, W - 24, 62, 10, this.nxt);
    // labels stay readable under the MIRROR mutator
    if (this.mods.mirror) { c.save(); c.translate(W, 0); c.scale(-1, 1); }
    const lx = this.mods.mirror ? 24 : W - 24;
    this.text(c, this.mode.toUpperCase(), lx, 82, 8, 'rgba(255,255,255,.45)');
    if (this.flash) { c.globalAlpha = Math.min(1, this.flash); this.text(c, 'OVERFLOW', W / 2, H / 2, 26, this.col(3)); c.globalAlpha = 1; }
    if (this.mods.mirror) c.restore();
  }
}
