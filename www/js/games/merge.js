import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Merge (Suika-like)
const FRUIT = ['🫐', '🍒', '🍓', '🍋', '🍊', '🍎', '🍑', '🍍', '🥥', '🍈', '🍉'];
const RADII = [11, 15, 20, 25, 31, 38, 45, 53, 61, 70, 80];
export class Merge extends Game {
  setup() {
    this.balls = [];
    this.L = 22; this.R = W - 22; this.F = H - 18; this.line = 74;
    this.cur = this.ri(0, 3); this.nxt = this.ri(0, 3);
    this.aimX = W / 2; this.cool = 0; this.over = 0; this.useEmoji = this.rng() < 0.35;
    this.lvImg = this.rng() < 0.75 ? this.skin.list('levels', RADII.length, 'animal', 'ball', 'item', 'enemy') : null;
  }
  dropAt(x) {
    if (this.cool > 0) return;
    const r = RADII[this.cur];
    this.balls.push({ x: Math.max(this.L + r, Math.min(this.R - r, x)), y: 44, vx: 0, vy: 0, r, lv: this.cur, age: 0 });
    this.cur = this.nxt; this.nxt = this.ri(0, 3); this.cool = 0.55;
  }
  // pick a target once per drop, glide the dropper there smoothly, pause, then drop
  autopilot(dt) {
    if (this.goalX == null) {
      if (this.cool > 0) return;
      const same = this.balls.filter((b) => b.lv === this.cur && b.age > 0.5).sort((a, b) => a.y - b.y)[0];
      this.goalX = same ? same.x + this.r(-5, 5) : this.cur < 2 ? this.r(this.L + 20, this.R - 20) : this.rng() < 0.5 ? this.L + 40 : this.R - 40;
      this.hold = this.r(0.25, 0.6);
    }
    const d = this.goalX - this.aimX;
    this.aimX += Math.sign(d) * Math.min(Math.abs(d), 260 * dt);
    if (Math.abs(d) < 1) { this.hold -= dt; if (this.hold <= 0) { this.dropAt(this.aimX); this.goalX = null; } }
  }
  down(x) { this.aimX = x; }
  move(x) { this.aimX = x; }
  up(x) { this.aimX = x; this.dropAt(x); }
  step(dt) {
    this.cool -= dt;
    const bs = this.balls;
    for (const b of bs) { b.vy += 900 * this.G * dt; b.vx *= 0.996; b.vy *= 0.999; b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt; }
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i]; if (a.dead) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j]; if (b.dead) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          if (a.lv === b.lv) {
            a.dead = b.dead = true;
            const lv = a.lv + 1;
            this.score += (lv + 1) * 3;
            this.burst((a.x + b.x) / 2, (a.y + b.y) / 2, this.col(lv), 14);
            if (lv < RADII.length) bs.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (a.vx + b.vx) / 2, vy: Math.min(0, (a.vy + b.vy) / 2), r: RADII[lv], lv, age: 0.6 });
            break;
          }
          const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d, ov = rr - d;
          const ma = a.r * a.r, mb = b.r * b.r, t = ma + mb;
          a.x -= nx * ov * (mb / t); a.y -= ny * ov * (mb / t); b.x += nx * ov * (ma / t); b.y += ny * ov * (ma / t);
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) { const imp = (-(1.15) * rv) / (1 / ma + 1 / mb); a.vx -= (imp / ma) * nx; a.vy -= (imp / ma) * ny; b.vx += (imp / mb) * nx; b.vy += (imp / mb) * ny; }
        }
      }
      for (const b of bs) {
        if (b.x - b.r < this.L) { b.x = this.L + b.r; b.vx = Math.abs(b.vx) * 0.3; }
        if (b.x + b.r > this.R) { b.x = this.R - b.r; b.vx = -Math.abs(b.vx) * 0.3; }
        if (b.y + b.r > this.F) { b.y = this.F - b.r; b.vy = -Math.abs(b.vy) * 0.15; b.vx *= 0.97; }
      }
    }
    this.balls = bs.filter((b) => !b.dead);
    const high = this.balls.some((b) => b.age > 2 && b.y - b.r < this.line && Math.abs(b.vy) < 40);
    this.over = high ? this.over + dt : 0;
    if (this.over > 1.6) { this.balls.forEach((b) => this.burst(b.x, b.y, this.col(b.lv), 4)); this.balls = []; this.score = 0; this.over = 0; }
  }
  drawBall(c, x, y, r, lv) {
    const li = this.lvImg?.[lv];
    if (li && drawFit(c, li, x, y, r * 2.15, r * 2.15)) return;
    c.fillStyle = this.col(lv);
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, 7); c.fill();
    if (this.useEmoji) { c.font = `${r * 1.15}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(FRUIT[lv] || '⭐', x, y + r * 0.05); }
    else { c.fillStyle = this.pal.bg; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.05, r * 0.09 + 1, 0, 7); c.arc(x + r * 0.3, y - r * 0.05, r * 0.09 + 1, 0, 7); c.fill(); c.strokeStyle = this.pal.bg; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y + r * 0.12, r * 0.22, 0.2, Math.PI - 0.2); c.stroke(); }
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(this.L, this.line, this.R - this.L, this.F - this.line);
    c.strokeStyle = this.over ? this.col(3) : 'rgba(255,255,255,.12)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(this.L, this.line); c.lineTo(this.R, this.line); c.stroke(); c.setLineDash([]);
    c.fillStyle = this.pal.c[4]; c.globalAlpha = 0.5; c.fillRect(this.L - 4, this.line, 4, this.F - this.line); c.fillRect(this.R, this.line, 4, this.F - this.line); c.fillRect(this.L - 4, this.F, this.R - this.L + 8, 4); c.globalAlpha = 1;
    for (const b of this.balls) this.drawBall(c, b.x, b.y, b.r, b.lv);
    const r = RADII[this.cur], x = Math.max(this.L + r, Math.min(this.R - r, this.aimX));
    c.globalAlpha = this.cool > 0 ? 0.35 : 1; this.drawBall(c, x, 44, r, this.cur); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(x, 44 + r); c.lineTo(x, this.F); c.stroke();
    this.drawBall(c, W - 30, 22, 9, this.nxt);
  }
}
