import { Game, W, H, circleRect, reflect, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Asteroids
export class Rocks extends Game {
  setup() { this.wave = 0; this.reset(); }
  reset() { this.ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2 }; this.shots = []; this.rocks = []; this.spawnWave(); this.dead = 0; }
  spawnWave() { for (let i = 0; i < 3 + this.wave; i++) this.rock(this.rng() < 0.5 ? 0 : W, this.r(0, H), 34); }
  rock(x, y, r) { const a = this.r(0, 7); this.rocks.push({ x, y, r: r * this.S, vx: Math.cos(a) * this.r(20, 70) * (40 / r), vy: Math.sin(a) * this.r(20, 70) * (40 / r), rot: 0, vr: this.r(-1.5, 1.5), i: this.skin.any('meteor', 'prop', 'animal', 'item') }); }
  wrapd(a, b, L) { let d = b - a; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; }
  fire() { const s = this.ship; if (this.cool > 0 || this.dead) return; this.cool = 0.22; this.shots.push({ x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14, vx: Math.cos(s.a) * 420 + s.vx, vy: Math.sin(s.a) * 420 + s.vy, life: 1.1 }); }
  autopilot(dt) {
    const s = this.ship;
    const t = this.rocks.map((r) => ({ r, dx: this.wrapd(s.x, r.x, W), dy: this.wrapd(s.y, r.y, H) })).sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy))[0];
    if (!t) return;
    const dist = Math.hypot(t.dx, t.dy), lead = dist / 420;
    let d = Math.atan2(t.dy + t.r.vy * lead, t.dx + t.r.vx * lead) - s.a;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    s.a += Math.sign(d) * Math.min(Math.abs(d), 4 * dt);
    if (Math.abs(d) < 0.15) this.fire();
    this.thrust = dist > 170 && Math.abs(d) < 0.5 ? 1 : dist < t.r.r + 50 ? -1 : 0;
  }
  down(x, y) { this.aim = { x, y }; this.held = this.t; this.fireAt(x, y); }
  move(x, y) { if (this.aim) this.aim = { x, y }; }
  up() { this.aim = null; this.thrust = 0; }
  fireAt(x, y) { this.ship.a = Math.atan2(y - this.ship.y, x - this.ship.x); this.fire(); }
  step(dt) {
    this.cool = (this.cool || 0) - dt;
    const s = this.ship;
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) { this.ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2 }; this.dead = 0; } }
    if (!this.auto && this.aim) { s.a = Math.atan2(this.aim.y - s.y, this.aim.x - s.x); this.thrust = this.t - this.held > 0.25 ? 1 : 0; if (this.t - this.held > 0.25) this.fire(); }
    if (!this.dead) {
      if (this.thrust) { s.vx += Math.cos(s.a) * 260 * this.thrust * dt; s.vy += Math.sin(s.a) * 260 * this.thrust * dt; }
      s.vx *= 0.992; s.vy *= 0.992; s.x = (s.x + s.vx * dt + W) % W; s.y = (s.y + s.vy * dt + H) % H; s.inv -= dt;
    }
    for (const b of this.shots) { b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H; b.life -= dt; }
    for (const r of this.rocks) { r.x = (r.x + r.vx * dt + W) % W; r.y = (r.y + r.vy * dt + H) % H; r.rot += r.vr * dt; }
    for (const b of this.shots) for (const r of this.rocks) {
      if (b.life <= 0 || r.dead) continue;
      if (Math.hypot(this.wrapd(b.x, r.x, W), this.wrapd(b.y, r.y, H)) < r.r) {
        b.life = 0; r.dead = true; this.score += Math.round(60 - r.r); this.burst(r.x, r.y, this.col(this.ri(0, 5)), 12);
        if (r.r > 14) for (let k = 0; k < 2; k++) this.rock(r.x, r.y, r.r / this.S * 0.58);
      }
    }
    if (!this.dead && s.inv <= 0) for (const r of this.rocks) if (!r.dead && Math.hypot(this.wrapd(s.x, r.x, W), this.wrapd(s.y, r.y, H)) < r.r + 8) { this.dead = 1.2; this.burst(s.x, s.y, this.col(0), 30, 260); this.score = Math.max(0, this.score - 100); break; }
    this.shots = this.shots.filter((b) => b.life > 0);
    this.rocks = this.rocks.filter((r) => !r.dead);
    if (!this.rocks.length) { this.wave++; this.spawnWave(); }
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 40; i++) c.fillRect((i * 97) % W, (i * 57) % H, 1.5, 1.5);
    for (const r of this.rocks) if (!drawFit(c, r.i, r.x, r.y, r.r * 2.2, r.r * 2.2, r.rot)) { c.strokeStyle = this.col(1); c.lineWidth = 2; c.beginPath(); c.arc(r.x, r.y, r.r, 0, 7); c.stroke(); }
    c.fillStyle = this.col(1); for (const b of this.shots) { c.beginPath(); c.arc(b.x, b.y, 2.5, 0, 7); c.fill(); }
    const s = this.ship;
    if (!this.dead && (s.inv <= 0 || Math.floor(this.t * 10) % 2)) {
      if (!drawFit(c, this.skin.vehicle('ship'), s.x, s.y, 34 * this.S, 34 * this.S, s.a + Math.PI / 2)) {
        c.save(); c.translate(s.x, s.y); c.rotate(s.a); c.strokeStyle = this.pal.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 0); c.lineTo(-10, -9); c.lineTo(-6, 0); c.lineTo(-10, 9); c.closePath(); c.stroke(); c.restore();
      }
      if (this.thrust > 0) { c.fillStyle = this.col(0); c.beginPath(); c.arc(s.x - Math.cos(s.a) * 16, s.y - Math.sin(s.a) * 16, 4 + Math.random() * 3, 0, 7); c.fill(); }
    }
  }
  hud() { return `${this.score} · wave ${this.wave + 1}`; }
}
