import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Breakout
export class Breakout extends Game {
  setup() {
    this.paddle = { x: W / 2, y: H - 28, w: 74, h: 10 };
    this.level = 0;
    this.lives = 3;
    this.build();
  }
  build() {
    const rows = this.ri(5, 8), cols = 8, bw = (W - 20) / cols, bh = 16;
    const pattern = this.ri(0, 5);
    this.bricks = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const keep = [true, (r + k) % 2 === 0, Math.abs(k - 3.5) <= r / 1.4, Math.abs(k - 3.5) + Math.abs(r - rows / 2) <= rows / 1.6, this.rng() > 0.25, Math.sin(k * 0.9 + r) > -0.4][pattern];
      if (keep) this.bricks.push({ x: 10 + k * bw + 1.5, y: 54 + r * (bh + 4), w: bw - 3, h: bh, hp: this.rng() < 0.12 ? 2 : 1, c: this.col(r), i: this.skin.pick(`row${r % 3}`, 'tile', 'block') });
    }
    this.serve();
  }
  serve() {
    this.ball = { x: this.paddle.x, y: this.paddle.y - 12, vx: 0, vy: 0, r: 6 * this.S, stuck: 0.6, i: this.skin.pick('bb', 'ball', 'item') };
    this.speed = 300 + this.level * 15;
  }
  autopilot(dt) {
    const b = this.ball;
    if (b.vy > 0 && this.aimFor !== b) { this.aimFor = b; this.offset = this.r(-0.36, 0.36) * this.paddle.w; }
    // predict where the ball reaches the paddle, folding wall bounces
    let tx = b.x;
    if (b.vy > 0) {
      const t = (this.paddle.y - b.y) / b.vy;
      let x = b.x + b.vx * t;
      const span = W - 2 * b.r;
      x = ((((x - b.r) % (2 * span)) + 2 * span) % (2 * span));
      tx = (x > span ? 2 * span - x : x) + b.r;
    }
    const target = tx - (this.offset || 0);
    const d = target - this.paddle.x;
    this.paddle.x += Math.sign(d) * Math.min(Math.abs(d), 460 * dt);
  }
  down(x) { this.paddle.x = x; }
  move(x) { if (!this.auto) this.paddle.x = x; }
  step(dt) {
    const p = this.paddle, b = this.ball;
    p.x = Math.max(p.w / 2, Math.min(W - p.w / 2, p.x));
    if (b.stuck > 0) {
      b.x = p.x; b.y = p.y - 12; b.stuck -= dt;
      if (b.stuck <= 0) { const a = -Math.PI / 2 + this.r(-0.5, 0.5); b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed; }
      return;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    walls(b, 0, W, 0, null, 1);
    if (b.vy > 0 && b.y + b.r >= p.y && b.y < p.y + p.h && Math.abs(b.x - p.x) < p.w / 2 + b.r) {
      const off = (b.x - p.x) / (p.w / 2);
      const a = -Math.PI / 2 + off * 1.05;
      this.speed = Math.min(560, this.speed + 4);
      b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed;
    }
    for (const k of this.bricks) {
      if (k.dead) continue;
      const n = circleRect(b, k);
      if (n) {
        reflect(b, n, 1);
        k.hp--;
        if (k.hp <= 0) { k.dead = true; this.score += 10; this.burst(k.x + k.w / 2, k.y + k.h / 2, k.c, 12); }
        break;
      }
    }
    this.bricks = this.bricks.filter((k) => !k.dead);
    if (!this.bricks.length) { this.level++; this.build(); }
    if (b.y > H + 20) { this.lives--; if (this.lives < 0) { this.lives = 3; this.score = 0; this.level = 0; this.build(); } else this.serve(); }
  }
  hud() { return `${this.score} · ♥${Math.max(0, this.lives)}`; }
  draw(c) {
    this.clear(c);
    for (const k of this.bricks) { c.fillStyle = k.c; c.globalAlpha = k.hp > 1 ? 1 : 0.85; roundRect(c, k.x, k.y, k.w, k.h, 4); c.fill(); if (k.i) { c.globalAlpha = 0.75; c.save(); roundRect(c, k.x, k.y, k.w, k.h, 4); c.clip(); drawRectImg(c, k.i, k.x, k.y, k.w, k.h, true); c.restore(); } c.globalAlpha = 1; if (k.hp > 1) { c.strokeStyle = this.pal.ink; c.lineWidth = 1.5; roundRect(c, k.x, k.y, k.w, k.h, 4); c.stroke(); } }
    c.globalAlpha = 1;
    const p = this.paddle;
    c.fillStyle = this.pal.ink; roundRect(c, p.x - p.w / 2, p.y, p.w, p.h, 5); c.fill();
    this.orb(c, this.ball.i, this.ball.x, this.ball.y, this.ball.r, this.col(0), this.t * 4);
  }
}
