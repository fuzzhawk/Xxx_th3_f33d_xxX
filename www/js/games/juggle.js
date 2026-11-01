import { Game, W, H, walls, drawFit } from './engine.js';
import { Fx, Backdrop, sceneFor, SCENE_KEYS, clamp } from './arcadekit.js';

// ================================================================ Juggle
// Balls over a layered parallax landscape (the post's picture group when it has one); the camera leans
// toward the balls, looks up when they fly high and bumps with every kick, so the layers slide past each other.
export class Juggle extends Game {
  setup() {
    const set = this.skin.bgSet;
    this.scene = set?.length ? sceneFor(this.skin.bgGroup, () => this.rng()) : SCENE_KEYS[this.ri(0, SCENE_KEYS.length - 1)];
    this.bd = new Backdrop(this, this.scene, { imgs: set, floor: H + 4 });
    this.fx = new Fx();
    this.cam = { x: 0, y: 0, bump: 0, vb: 0 };
    this.pan = this.r(0, 600);
    this.reset();
  }
  reset() { this.balls = [this.mk()]; this.score = 0; this.drops = 0; }
  mk() { return { i: this.skin.any('ball', 'animal', 'item', 'enemy'), x: this.r(80, W - 80), y: this.r(60, 140), vx: this.r(-60, 60), vy: 0, r: 22 * this.S, spin: 0, c1: this.col(this.ri(0, 5)), c2: this.col(this.ri(0, 5)), cd: 0, flash: 0 }; }
  kick(b, x) {
    b.vy = -560 - this.r(0, 60); b.vx += (b.x - x) * 7; b.spin += (b.x - x) * 0.2; b.cd = 0.15; b.flash = 1; this.score++;
    this.burst(b.x, b.y + b.r, b.c1, 6, 100);
    this.fx.ring(b.x, b.y, b.r * 2.2, b.c1, 0.35, 3, b.r);
    this.fx.sparks(x, b.y + b.r * 0.8, 6, '#fff', 180, Math.PI / 2, 1.6, 0.3);
    this.cam.vb += 90 + Math.abs(b.vx) * 0.1;
    if (this.score % 10 === 0) this.fx.text(b.x, b.y - b.r - 14, `${this.score}!`, this.pal.ink, 16);
    if (this.score % 15 === 0 && this.balls.length < 4) { const n = this.mk(); this.balls.push(n); this.fx.text(n.x, n.y + 30, '+1 BALL', b.c1, 13); this.fx.ring(n.x, n.y, 40, this.pal.ink, 0.5, 2); }
  }
  autopilot() {
    for (const b of this.balls) if (b.vy > 0 && b.y > H * 0.66 && b.cd <= 0) this.kick(b, b.x + this.r(-9, 9));
  }
  down(x, y) {
    const b = this.balls.filter((b) => b.cd <= 0).sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y))[0];
    if (b && Math.hypot(b.x - x, b.y - y) < b.r + 45) this.kick(b, x);
  }
  step(dt) {
    for (const b of this.balls) {
      b.cd -= dt; b.flash = Math.max(0, b.flash - dt * 4);
      b.vy += 720 * this.G * dt; b.vx *= 0.999; b.x += b.vx * dt; b.y += b.vy * dt; b.spin *= 0.99;
      if (walls(b, 0, W, 0, null, 0.8)) this.fx.sparks(b.x < W / 2 ? 2 : W - 2, b.y, 3, b.c2, 120, b.x < W / 2 ? 0 : Math.PI, 1.4, 0.25);
      if (b.y - b.r > H) { b.dead = true; this.drops++; this.fx.shake(4, 0.3); this.fx.puff(b.x, H, 0, -40, 20, this.pal.ink, 0.6, 40, 0.3); }
    }
    this.balls = this.balls.filter((b) => !b.dead);
    if (!this.balls.length) this.reset();
    this.ang = (this.ang || 0) + dt;
    // camera: lean toward the balls, look up at the highest one, spring back from kick bumps, and a slow pan
    const n = this.balls.length, ax = this.balls.reduce((s, b) => s + b.x, 0) / n, top = Math.min(...this.balls.map((b) => b.y));
    const cm = this.cam, k = Math.min(1, dt * 2.5);
    this.pan += dt * 10;
    cm.x += ((ax - W / 2) * 1.1 + this.pan - cm.x) * k;
    cm.y += (clamp((H * 0.5 - top) * 0.32, -24, 70) - cm.y) * k;
    cm.vb += (-cm.bump * 60 - cm.vb * 9) * dt; cm.bump += cm.vb * dt;
    this.fx.step(dt);
  }
  draw(c) {
    this.fx.apply(c);
    const cm = this.cam;
    if (this.mods.trails && this.t > 0.5) { this.clear(c); this.bd.draw(c, cm.x, cm.y + cm.bump, this.t, 0.3); }
    else this.bd.draw(c, cm.x, cm.y + cm.bump, this.t);
    if (this.wall) { c.globalAlpha = 0.18; for (const w of this.wall) drawFit(c, w.i, w.x, w.y, w.s, w.s, w.r); c.globalAlpha = 1; }
    for (const b of this.balls) {
      const rot = (this.ang || 0) * b.spin * 0.1 + b.x * 0.02;
      c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(b.x + 5, b.y + 7, b.r * 1.02, b.r * 0.98, 0, 0, 7); c.fill();
      if (!drawFit(c, b.i, b.x, b.y, b.r * 2.2, b.r * 2.2, rot)) {
        c.save(); c.translate(b.x, b.y); c.rotate(rot);
        for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? b.c1 : b.c2; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, b.r, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3); c.fill(); }
        c.fillStyle = this.pal.ink; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
        c.restore();
      }
      if (b.flash > 0) { c.globalAlpha = b.flash * 0.5; c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r * 1.05, 0, 7); c.fill(); c.globalAlpha = 1; }
    }
    this.fx.draw(c);
    this.fx.over(c);
  }
}
