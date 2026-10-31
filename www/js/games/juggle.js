import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Juggle
export class Juggle extends Game {
  setup() { this.reset(); }
  reset() { this.balls = [this.mk()]; this.score = 0; this.drops = 0; }
  mk() { return { i: this.skin.any('ball', 'animal', 'item', 'enemy'), x: this.r(80, W - 80), y: this.r(60, 140), vx: this.r(-60, 60), vy: 0, r: 22 * this.S, spin: 0, c1: this.col(this.ri(0, 5)), c2: this.col(this.ri(0, 5)), cd: 0 }; }
  kick(b, x) { b.vy = -560 - this.r(0, 60); b.vx += (b.x - x) * 7; b.spin += (b.x - x) * 0.2; b.cd = 0.15; this.score++; this.burst(b.x, b.y + b.r, b.c1, 6, 100); if (this.score % 15 === 0 && this.balls.length < 4) this.balls.push(this.mk()); }
  autopilot() {
    for (const b of this.balls) if (b.vy > 0 && b.y > H * 0.66 && b.cd <= 0) this.kick(b, b.x + this.r(-9, 9));
  }
  down(x, y) {
    const b = this.balls.filter((b) => b.cd <= 0).sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y))[0];
    if (b && Math.hypot(b.x - x, b.y - y) < b.r + 45) this.kick(b, x);
  }
  step(dt) {
    for (const b of this.balls) {
      b.cd -= dt; b.vy += 720 * this.G * dt; b.vx *= 0.999; b.x += b.vx * dt; b.y += b.vy * dt; b.spin *= 0.99;
      walls(b, 0, W, 0, null, 0.8);
      if (b.y - b.r > H) { b.dead = true; this.drops++; }
    }
    this.balls = this.balls.filter((b) => !b.dead);
    if (!this.balls.length) this.reset();
    this.ang = (this.ang || 0) + dt;
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, H * 0.66, W, 2);
    for (const b of this.balls) {
      if (drawFit(c, b.i, b.x, b.y, b.r * 2.2, b.r * 2.2, (this.ang || 0) * b.spin * 0.1 + b.x * 0.02)) continue;
      c.save(); c.translate(b.x, b.y); c.rotate((this.ang || 0) * b.spin * 0.1 + b.x * 0.02);
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? b.c1 : b.c2; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, b.r, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3); c.fill(); }
      c.fillStyle = this.pal.ink; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
      c.restore();
    }
  }
}
