import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Dash (side-scrolling runner)
export class Dash extends Game {
  setup() {
    this.ground = H - 70;
    this.reset();
    this.hills = Array.from({ length: 8 }, (_, i) => ({ x: i * 70, h: this.r(30, 90) }));
  }
  reset() {
    this.p = { x: 80, y: this.ground - 22, s: 22, vy: 0, on: true, jumps: 0, rot: 0 };
    this.speed = 230; this.obs = []; this.gaps = []; this.dist = 0; this.dead = 0; this.spawnX = W + 60; this.score = 0;
  }
  spawn() {
    const t = this.rng();
    const x = this.spawnX;
    if (t < 0.4) this.obs.push({ type: 'spike', x, w: 22, h: 22 });
    else if (t < 0.55) { this.obs.push({ type: 'spike', x, w: 22, h: 22 }); this.obs.push({ type: 'spike', x: x + 22, w: 22, h: 22 }); }
    else if (t < 0.78) this.obs.push({ type: 'block', x, w: this.r(28, 60), h: this.r(26, 52) });
    else this.gaps.push({ x, w: this.r(55, 100) });
    this.spawnX += this.r(200, 330) + this.speed * 0.25;
  }
  jump() {
    const p = this.p;
    if (this.dead) return;
    if (p.on) { p.vy = -620; p.on = false; p.jumps = 1; }
    else if (p.jumps < 2) { p.vy = -540; p.jumps = 2; }
  }
  overGap(x0, x1) { return this.gaps.some((g) => x0 > g.x + 2 && x1 < g.x + g.w - 2); }
  autopilot() {
    const p = this.p, front = p.x + p.s;
    const next = [...this.obs.map((o) => ({ ...o, k: 'o' })), ...this.gaps.map((g) => ({ ...g, k: 'g' }))].filter((o) => o.x + o.w > p.x).sort((a, b) => a.x - b.x)[0];
    if (!next) return;
    const dx = next.x - front;
    const lead = this.speed * (next.k === 'g' ? 0.06 : next.type === 'block' && next.h > 40 ? 0.26 : 0.2) + (this.jitter || 0);
    if (p.on && dx < lead && dx > -5) { this.jump(); this.jitter = this.r(-8, 10); }
    else if (!p.on && p.jumps === 1 && p.vy > 60 && next.k === 'g' && p.x + p.s / 2 > next.x && p.x < next.x + next.w) this.jump();
  }
  down() { this.jump(); }
  step(dt) {
    const p = this.p;
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    this.speed = Math.min(460, this.speed + dt * 6);
    const dx = this.speed * dt;
    this.dist += dx; this.score = Math.floor(this.dist / 10);
    for (const o of this.obs) o.x -= dx;
    for (const g of this.gaps) g.x -= dx;
    this.spawnX -= dx;
    while (this.spawnX < W + 400) this.spawn();
    this.obs = this.obs.filter((o) => o.x + o.w > -40);
    this.gaps = this.gaps.filter((g) => g.x + g.w > -40);
    this.hills.forEach((h) => { h.x -= dx * 0.25; if (h.x < -80) { h.x += 8 * 70; h.h = this.r(30, 90); } });
    const prevBottom = p.y + p.s;
    p.vy += 1900 * this.G * dt; p.y += p.vy * dt;
    let floor = this.overGap(p.x, p.x + p.s) ? Infinity : this.ground;
    for (const o of this.obs) {
      if (p.x + p.s <= o.x + 2 || p.x >= o.x + o.w - 2) continue;
      if (o.type === 'block') {
        const top = this.ground - o.h;
        if (prevBottom <= top + 2) floor = Math.min(floor, top);
        else if (p.y + p.s > top + 3) return this.die();
      } else if (p.y + p.s > this.ground - o.h * 0.7) {
        const mid = o.x + o.w / 2;
        if (Math.abs(p.x + p.s / 2 - mid) < o.w / 2 + 2) return this.die();
      }
    }
    if (p.y + p.s >= floor) { p.y = floor - p.s; p.vy = 0; p.on = true; p.jumps = 0; p.rot = Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2); }
    else { p.on = false; p.rot += dt * 7; }
    if (p.y > H) this.die();
  }
  die() { this.dead = 0.9; this.burst(this.p.x + 11, this.p.y + 11, this.col(0), 22, 260); }
  draw(c) {
    this.clear(c);
    c.fillStyle = this.pal.c[5]; c.globalAlpha = 0.25;
    for (const h of this.hills) { c.beginPath(); c.moveTo(h.x - 60, this.ground); c.quadraticCurveTo(h.x + 35, this.ground - h.h * 2, h.x + 130, this.ground); c.fill(); }
    c.globalAlpha = 1;
    c.fillStyle = this.pal.c[2];
    let x = -10;
    for (const g of [...this.gaps].sort((a, b) => a.x - b.x)) { c.fillRect(x, this.ground, g.x - x, H - this.ground); x = g.x + g.w; }
    c.fillRect(x, this.ground, W - x + 10, H - this.ground);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, this.ground + 6, W, 3);
    for (const o of this.obs) {
      c.fillStyle = o.type === 'spike' ? this.col(3) : this.col(1);
      if (o.type === 'spike') { const e = this.skin.pick('spike', 'enemy', 'meteor'); if (!drawFit(c, e, o.x + o.w / 2, this.ground - o.h / 2, o.w * 1.2, o.h * 1.2)) { c.beginPath(); c.moveTo(o.x, this.ground); c.lineTo(o.x + o.w / 2, this.ground - o.h); c.lineTo(o.x + o.w, this.ground); c.fill(); } }
      else { roundRect(c, o.x, this.ground - o.h, o.w, o.h, 3); c.fill(); const t = this.skin.pick('blk', 'block', 'tile'); if (t) { c.save(); c.clip(); drawRectImg(c, t, o.x, this.ground - o.h, o.w, o.h, true); c.restore(); } }
    }
    if (!this.dead) {
      const p = this.p;
      c.save(); c.translate(p.x + p.s / 2, p.y + p.s / 2); c.rotate(p.rot);
      const hero = this.skin.pick('hero', 'char', 'animal');
      if (!drawFit(c, hero, 0, 0, p.s * 1.5, p.s * 1.5)) { c.fillStyle = this.col(0); roundRect(c, -p.s / 2, -p.s / 2, p.s, p.s, 4); c.fill(); c.fillStyle = this.pal.bg; c.fillRect(2, -5, 4, 4); }
      c.restore();
    }
  }
}
