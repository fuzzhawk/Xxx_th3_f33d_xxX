import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Plinko
export class Plinko extends Game {
  setup() {
    this.pegs = [];
    const rows = this.ri(8, 11), gap = (W - 40) / 9;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? gap / 2 : 0;
      for (let x = 20 + off; x <= W - 20; x += gap) this.pegs.push({ x, y: 70 + r * ((H - 150) / rows), r: 4, hit: 0 });
    }
    const vals = [[50, 20, 10, 5, 2, 5, 10, 20, 50], [100, 25, 5, 1, 0, 1, 5, 25, 100], [5, 10, 20, 50, 100, 50, 20, 10, 5]][this.ri(0, 2)];
    this.slots = vals.map((v, i) => ({ v, x: (i * W) / 9, w: W / 9, flash: 0 }));
    this.balls = [];
    this.next = 0;
    this.gravity = this.r(700, 1000);
  }
  drop(x) {
    if (this.balls.length > 30) return;
    this.balls.push({ x: Math.max(12, Math.min(W - 12, x)), y: 22, vx: this.r(-20, 20), vy: 0, r: 6 * this.S, c: this.col(this.ri(0, 5)), i: this.skin.any('ball', 'item', 'animal', 'enemy'), rot: 0 });
  }
  autopilot(dt) {
    this.next -= dt;
    if (this.next <= 0) { this.drop(W / 2 + this.r(-90, 90)); this.next = this.r(0.35, 0.9); }
  }
  down(x) { this.drop(x); }
  step(dt) {
    const floor = H - 44;
    for (const b of this.balls) {
      b.vy += this.gravity * this.G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      for (const p of this.pegs) if (circlePeg(b, p, 0.5)) { p.hit = 0.25; b.vx += this.r(-12, 12); }
      walls(b, 0, W, null, null, 0.5);
      if (b.y > floor) {
        for (let i = 1; i < 9; i++) { const sx = (i * W) / 9; if (Math.abs(b.x - sx) < b.r + 1.5) { b.x = b.x < sx ? sx - b.r - 1.5 : sx + b.r + 1.5; b.vx *= -0.5; } }
      }
      if (b.y > H - 10 && !b.done) {
        b.done = true;
        const s = this.slots[Math.min(8, Math.max(0, Math.floor(b.x / (W / 9))))];
        s.flash = 0.5; this.score += s.v; this.burst(b.x, H - 14, b.c, 8, 120);
      }
    }
    this.balls = this.balls.filter((b) => !b.done);
    this.pegs.forEach((p) => (p.hit = Math.max(0, p.hit - dt)));
    this.slots.forEach((s) => (s.flash = Math.max(0, s.flash - dt)));
  }
  draw(c) {
    this.clear(c);
    for (const p of this.pegs) {
      c.fillStyle = p.hit ? this.col(0) : this.pal.c[4];
      c.globalAlpha = p.hit ? 1 : 0.55;
      c.beginPath(); c.arc(p.x, p.y, p.r + (p.hit ? 1.5 : 0), 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    this.slots.forEach((s, i) => {
      c.fillStyle = s.flash ? this.col(0) : this.col(i % 2 ? 1 : 3);
      c.globalAlpha = s.flash ? 0.9 : 0.35;
      c.fillRect(s.x + 2, H - 40, s.w - 4, 40);
      c.globalAlpha = 1;
      this.text(c, String(s.v), s.x + s.w / 2, H - 20, 11);
    });
    for (const b of this.balls) { b.rot += b.vx * 0.002; this.orb(c, b.i, b.x, b.y, b.r, b.c, b.rot); }
  }
}
