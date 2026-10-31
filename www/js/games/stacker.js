import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Stacker
export class Stacker extends Game {
  setup() { this.reset(); }
  reset() {
    this.stack = [{ x: W / 2 - 100, w: 200, y: H - 40 }];
    this.debris = []; this.cam = 0; this.score = 0; this.dir = 1; this.newBlock(); this.over = 0;
  }
  newBlock() {
    const top = this.stack[this.stack.length - 1];
    this.mov = { x: this.dir > 0 ? -top.w : W, w: top.w, y: top.y - 22 };
    this.mspeed = 140 + Math.min(220, this.stack.length * 7);
    this.tol = this.r(0, 1) < 0.25 ? this.r(6, 24) : this.r(0, 5);
  }
  place() {
    if (this.over) return;
    const top = this.stack[this.stack.length - 1], m = this.mov;
    let x0 = Math.max(top.x, m.x), x1 = Math.min(top.x + top.w, m.x + m.w);
    if (Math.abs(m.x - top.x) < 4) { x0 = top.x; x1 = top.x + top.w; this.burst(top.x + top.w / 2, m.y + 11, this.col(0), 16); this.score += 2; }
    if (x1 - x0 <= 2) { this.debris.push({ x: m.x, y: m.y, w: m.w, vy: 0, vx: 0, rot: 0, vr: this.r(-2, 2), c: this.colFor(this.stack.length) }); this.over = 1.2; return; }
    if (m.x < x0) this.debris.push({ x: m.x, y: m.y, w: x0 - m.x, vy: 0, vx: -40, rot: 0, vr: -2, c: this.colFor(this.stack.length) });
    if (m.x + m.w > x1) this.debris.push({ x: x1, y: m.y, w: m.x + m.w - x1, vy: 0, vx: 40, rot: 0, vr: 2, c: this.colFor(this.stack.length) });
    this.stack.push({ x: x0, w: x1 - x0, y: m.y });
    this.score++;
    this.dir = -this.dir;
    this.newBlock();
  }
  colFor(i) { return this.col(Math.floor(i / 3)); }
  autopilot() {
    const top = this.stack[this.stack.length - 1];
    if (Math.abs(this.mov.x - top.x) <= this.tol + 1 && !this.over) this.place();
  }
  down() { this.place(); }
  step(dt) {
    if (this.over) { this.over -= dt; if (this.over <= 0) this.reset(); }
    const m = this.mov;
    if (!this.over) { m.x += this.dir * this.mspeed * dt; if (m.x > W) this.dir = -1; if (m.x + m.w < 0) this.dir = 1; }
    for (const d of this.debris) { d.vy += 900 * this.G * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.rot += d.vr * dt; }
    this.debris = this.debris.filter((d) => d.y - this.cam < H + 100);
    const targetCam = Math.min(0, this.stack[this.stack.length - 1].y - H * 0.55);
    this.cam += (targetCam - this.cam) * Math.min(1, dt * 4);
  }
  draw(c) {
    this.clear(c);
    c.save(); c.translate(0, -this.cam);
    const tex = this.skin.pick('stk', 'tile', 'block');
    this.stack.forEach((s, i) => { c.fillStyle = this.colFor(i); c.fillRect(s.x, s.y, s.w, 22); if (tex) { c.globalAlpha = 0.45; drawRectImg(c, tex, s.x, s.y, s.w, 22, true); c.globalAlpha = 1; } c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(s.x, s.y + 18, s.w, 4); });
    if (!this.over) { c.fillStyle = this.colFor(this.stack.length); c.fillRect(this.mov.x, this.mov.y, this.mov.w, 22); }
    for (const d of this.debris) { c.save(); c.translate(d.x + d.w / 2, d.y + 11); c.rotate(d.rot); c.fillStyle = d.c; c.fillRect(-d.w / 2, -11, d.w, 22); c.restore(); }
    c.restore();
  }
}
