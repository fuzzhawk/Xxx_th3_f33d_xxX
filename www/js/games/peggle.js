import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Peg Shot (Peggle-like)
export class PegShot extends Game {
  setup() { this.level(); }
  level() {
    this.pegs = [];
    const kind = this.ri(0, 4);
    const add = (x, y) => { if (x > 16 && x < W - 16 && y > 80 && y < H - 60 && !this.pegs.some((p) => Math.hypot(p.x - x, p.y - y) < 18)) this.pegs.push({ x, y, r: 6, lit: false, gone: 0 }); };
    if (kind === 0) for (let r = 0; r < 6; r++) for (let k = 0; k < 9; k++) add(28 + k * 38 + (r % 2) * 19, 110 + r * 42);
    if (kind === 1) for (let a = 0; a < 3; a++) for (let i = 0; i < 16; i++) { const t = (i / 15) * Math.PI; add(W / 2 + Math.cos(t) * (60 + a * 50), 130 + Math.sin(t) * (60 + a * 50)); }
    if (kind === 2) for (let i = 0; i < 70; i++) { const t = i * 0.35, rr = 8 + i * 2.2; add(W / 2 + Math.cos(t) * rr, 220 + Math.sin(t) * rr * 0.9); }
    if (kind === 3) for (let i = 0; i < 60; i++) add(this.r(20, W - 20), this.r(100, H - 70));
    if (kind === 4) for (let r = 0; r < 7; r++) for (let k = 0; k < 10; k++) add(20 + k * 36, 100 + r * 38 + Math.sin(k * 0.8 + r) * 14);
    const n = Math.max(6, Math.round(this.pegs.length * 0.25));
    shuffleWith(this.pegs, this.rng).slice(0, n).forEach((p) => (p.target = true));
    this.shots = 10; this.ball = null; this.angle = Math.PI / 2; this.aimT = 1; this.bucket = { x: W / 2, dir: 1 };
  }
  fire() {
    if (this.ball || this.shots <= 0) return;
    this.ball = { x: W / 2 + Math.cos(this.angle) * 26, y: 34 + Math.sin(this.angle) * 26, vx: Math.cos(this.angle) * 430, vy: Math.sin(this.angle) * 430, r: 6, hits: 0 };
    this.shots--;
  }
  aimAt(x, y) { this.angle = Math.max(0.15, Math.min(Math.PI - 0.15, Math.atan2(y - 34, x - W / 2))); }
  autopilot(dt) {
    if (this.ball) return;
    if (!this.goal) {
      const t = this.pegs.filter((p) => p.target && !p.lit);
      const g = t.length ? t[this.ri(0, t.length - 1)] : this.pegs[0];
      this.goal = g ? Math.max(0.15, Math.min(Math.PI - 0.15, Math.atan2(g.y - 34 - 40, g.x - W / 2) + this.r(-0.08, 0.08))) : Math.PI / 2;
      this.aimT = this.r(0.5, 1.1);
    }
    this.angle += (this.goal - this.angle) * Math.min(1, dt * 5);
    this.aimT -= dt;
    if (this.aimT <= 0) { this.fire(); this.goal = null; }
  }
  down(x, y) { this.aimAt(x, y); }
  move(x, y) { this.aimAt(x, y); }
  up(x, y) { this.aimAt(x, y); this.fire(); }
  step(dt) {
    const bk = this.bucket;
    bk.x += bk.dir * 90 * dt; if (bk.x > W - 40) bk.dir = -1; if (bk.x < 40) bk.dir = 1;
    this.pegs.forEach((p) => p.gone && (p.gone -= dt));
    this.pegs = this.pegs.filter((p) => p.gone === 0 || p.gone > 0);
    const b = this.ball;
    if (!b) { if (this.shots <= 0 || !this.pegs.some((p) => p.target)) { this.score += this.shots * 50; this.level(); } return; }
    b.vy += 480 * this.G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    walls(b, 0, W, 0, null, 0.9);
    for (const p of this.pegs) if (!p.gone && circlePeg(b, p, 0.78)) { if (!p.lit) { p.lit = true; b.hits++; this.score += p.target ? 100 : 10; } }
    if (b.y > H - 18 && Math.abs(b.x - bk.x) < 34) { this.shots++; this.burst(b.x, b.y, this.col(1), 16); this.ball = null; this.clearLit(); return; }
    if (b.y > H + 10) { this.ball = null; this.clearLit(); }
  }
  clearLit() { this.pegs.forEach((p) => { if (p.lit && !p.gone) { p.gone = 0.25; this.burst(p.x, p.y, p.target ? this.col(0) : this.col(5), 5, 80); } }); }
  hud() { return `${this.score} · ${this.shots} balls`; }
  draw(c) {
    this.clear(c);
    for (const p of this.pegs) {
      c.fillStyle = p.target ? this.col(0) : this.col(5);
      c.globalAlpha = p.gone ? Math.max(0, p.gone * 4) : 1;
      const pi = p.target ? this.skin.pick('tgt', 'item', 'enemy') : null;
      if (!pi || !drawFit(c, pi, p.x, p.y, 17, 17)) { c.beginPath(); c.arc(p.x, p.y, p.r + (p.lit ? 1.5 : 0), 0, 7); c.fill(); }
      if (p.lit) { c.strokeStyle = this.pal.ink; c.lineWidth = 2; c.stroke(); }
    }
    c.globalAlpha = 1;
    if (!this.ball && !this.auto) {
      let x = W / 2 + Math.cos(this.angle) * 26, y = 34 + Math.sin(this.angle) * 26, vx = Math.cos(this.angle) * 430, vy = Math.sin(this.angle) * 430;
      c.fillStyle = 'rgba(255,255,255,.3)';
      for (let i = 0; i < 26; i++) { for (let k = 0; k < 4; k++) { vy += 480 / 120; x += vx / 120; y += vy / 120; } c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); }
    }
    c.save(); c.translate(W / 2, 34); c.rotate(this.angle);
    c.fillStyle = this.col(1); roundRect(c, 0, -7, 30, 14, 5); c.fill(); c.restore();
    c.fillStyle = this.col(2); c.beginPath(); c.arc(W / 2, 34, 14, 0, 7); c.fill();
    c.fillStyle = this.col(1); c.globalAlpha = 0.8; roundRect(c, this.bucket.x - 34, H - 16, 68, 14, 6); c.fill(); c.globalAlpha = 1;
    if (this.ball) this.orb(c, this.skin.pick('shot', 'ball', 'item', 'animal'), this.ball.x, this.ball.y, this.ball.r * this.S, this.pal.ink, this.t * 5);
  }
}
function shuffleWith(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
