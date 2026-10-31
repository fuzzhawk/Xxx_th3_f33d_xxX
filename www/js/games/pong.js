import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Pong (vertical)
export class Pong extends Game {
  setup() {
    this.top = { x: W / 2, w: 70, err: 0 }; this.bot = { x: W / 2, w: 70, err: 0 };
    this.pts = [0, 0];
    this.serve(1);
  }
  serve(dir) {
    const a = (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + this.r(-0.6, 0.6);
    this.speed = 260;
    this.b = { x: W / 2, y: H / 2, r: 7, vx: Math.cos(a) * this.speed, vy: Math.sin(a) * this.speed, wait: 0.6 };
  }
  track(p, dt, toward, skill) {
    if (toward && Math.random() < dt * 2) p.err = this.r(-1, 1) * p.w * (1 - skill);
    const target = toward ? this.b.x + p.err : W / 2;
    const d = target - p.x;
    p.x += Math.sign(d) * Math.min(Math.abs(d), (180 + skill * 220) * dt);
  }
  autopilot(dt) { this.track(this.bot, dt, this.b.vy > 0, 0.72); }
  down(x) { this.bot.x = x; }
  move(x) { if (!this.auto) this.bot.x = x; }
  step(dt) {
    const b = this.b;
    this.track(this.top, dt, b.vy < 0, 0.62);
    [this.top, this.bot].forEach((p) => (p.x = Math.max(p.w / 2, Math.min(W - p.w / 2, p.x))));
    if (b.wait > 0) { b.wait -= dt; return; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    walls(b, 0, W, null, null, 1);
    const hit = (p, y, dir) => {
      if (Math.sign(b.vy) === dir && Math.abs(b.y - y) < b.r + 5 && Math.abs(b.x - p.x) < p.w / 2 + b.r) {
        const off = (b.x - p.x) / (p.w / 2);
        this.speed = Math.min(620, this.speed + 18);
        const a = (dir > 0 ? -Math.PI / 2 : Math.PI / 2) + off * 0.9 * (dir > 0 ? 1 : -1);
        b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed;
        this.burst(b.x, b.y, this.col(0), 6, 90);
        this.score++;
      }
    };
    hit(this.top, 30, -1); hit(this.bot, H - 30, 1);
    if (b.y < -20) { this.pts[1]++; this.serve(-1); }
    if (b.y > H + 20) { this.pts[0]++; this.serve(1); }
  }
  hud() { return `${this.pts[0]} : ${this.pts[1]}`; }
  draw(c) {
    this.clear(c);
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke(); c.setLineDash([]);
    this.text(c, String(this.pts[0]), W - 24, H / 2 - 24, 22, 'rgba(255,255,255,.2)');
    this.text(c, String(this.pts[1]), W - 24, H / 2 + 24, 22, 'rgba(255,255,255,.2)');
    c.fillStyle = this.col(3); roundRect(c, this.top.x - this.top.w / 2, 20, this.top.w, 10, 5); c.fill();
    c.fillStyle = this.col(0); roundRect(c, this.bot.x - this.bot.w / 2, H - 30, this.bot.w, 10, 5); c.fill();
    this.orb(c, this.skin.pick('pb', 'ball', 'animal', 'item'), this.b.x, this.b.y, this.b.r * this.S, this.pal.ink, this.t * 3);
  }
}
