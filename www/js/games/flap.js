import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Flap
export class Flap extends Game {
  setup() { this.gapH = this.r(120, 150); this.reset(); }
  reset() { this.b = { x: 100, y: H / 2, vy: 0, r: 11 }; this.pipes = []; this.nextX = W + 40; this.dead = 0; this.score = 0; this.speed = 140; }
  flap() { if (!this.dead) this.b.vy = -360; }
  autopilot() {
    const b = this.b;
    const p = this.pipes.find((p) => p.x + 54 > b.x - b.r);
    const target = p ? p.gap + this.gapH / 2 + 8 : H / 2;
    if (b.y > target && b.vy > -40) this.flap();
  }
  down() { this.flap(); }
  step(dt) {
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    const b = this.b;
    b.vy += 1250 * this.G * dt; b.y += b.vy * dt;
    for (const p of this.pipes) { p.x -= this.speed * dt; if (!p.passed && p.x + 54 < b.x) { p.passed = true; this.score++; } }
    this.nextX -= this.speed * dt;
    if (this.nextX < W) { this.pipes.push({ x: this.nextX + 60, gap: this.r(60, H - 80 - this.gapH) }); this.nextX += this.r(180, 220); }
    this.pipes = this.pipes.filter((p) => p.x > -60);
    if (b.y + b.r > H - 20 || b.y - b.r < 0) return this.die();
    for (const p of this.pipes) {
      const top = { x: p.x, y: -10, w: 54, h: p.gap + 10 }, bot = { x: p.x, y: p.gap + this.gapH, w: 54, h: H };
      const t = { ...b };
      if (circleRect(t, top) || circleRect(t, bot)) return this.die();
    }
  }
  die() { this.dead = 0.8; this.burst(this.b.x, this.b.y, this.col(0), 18); }
  draw(c) {
    this.clear(c);
    for (const p of this.pipes) {
      c.fillStyle = this.col(2); roundRect(c, p.x, -10, 54, p.gap + 10, 6); c.fill(); roundRect(c, p.x, p.gap + this.gapH, 54, H, 6); c.fill();
      const pt = this.skin.pick('pipe', 'tile', 'block');
      if (pt) { c.globalAlpha = 0.6; drawRectImg(c, pt, p.x, -10, 54, p.gap + 10, true); drawRectImg(c, pt, p.x, p.gap + this.gapH, 54, H, true); c.globalAlpha = 1; }
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(p.x + 8, -10, 6, p.gap + 10); c.fillRect(p.x + 8, p.gap + this.gapH, 6, H);
    }
    c.fillStyle = this.col(1); c.fillRect(0, H - 20, W, 20);
    if (!this.dead) {
      const b = this.b;
      c.save(); c.translate(b.x, b.y); c.rotate(Math.max(-0.5, Math.min(1.2, b.vy / 500)));
      if (!drawFit(c, this.skin.pick('bird', 'animal', 'enemy', 'ship'), 0, 0, b.r * 3 * this.S, b.r * 3 * this.S)) {
        c.fillStyle = this.col(0); c.beginPath(); c.arc(0, 0, b.r, 0, 7); c.fill();
        c.fillStyle = this.pal.ink; c.beginPath(); c.arc(4, -3, 3.5, 0, 7); c.fill();
        c.fillStyle = this.pal.bg; c.beginPath(); c.arc(5, -3, 1.6, 0, 7); c.fill();
        c.fillStyle = this.col(1); c.beginPath(); c.moveTo(9, 0); c.lineTo(16, 2); c.lineTo(9, 4); c.fill();
      }
      c.restore();
    }
  }
}
