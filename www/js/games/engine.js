// Tiny 2D game base: fixed logical resolution, fixed-step physics, autopilot hook.
import { mulberry32 } from '../util.js';

export const PALETTES = [
  { bg: '#1b1511', bg2: '#2a1f18', ink: '#f1e3cf', c: ['#ff7a1a', '#c9952b', '#7d8a4a', '#b5532f', '#d8c3a5', '#4f7a6f'] },
  { bg: '#14181a', bg2: '#1f2628', ink: '#e9e1d2', c: ['#e8742a', '#d9b26f', '#5e6b3a', '#9b3d1f', '#8fb0a3', '#f2c14e'] },
  { bg: '#1d1414', bg2: '#2b1c1a', ink: '#f3e6d6', c: ['#ff8c42', '#e0a458', '#a3b18a', '#c0392b', '#ffd6a5', '#6d597a'] },
  { bg: '#171410', bg2: '#25201a', ink: '#efe4d0', c: ['#f4a259', '#bc4b51', '#8cb369', '#f4e285', '#5b8e7d', '#e76f51'] },
  { bg: '#111315', bg2: '#1c2024', ink: '#ece6da', c: ['#ff7a1a', '#ffb703', '#5b9aa9', '#8ecae6', '#fb8500', '#a7c957'] },
  { bg: '#1a1712', bg2: '#2d261c', ink: '#f4ead9', c: ['#d4a373', '#e76f51', '#2a9d8f', '#e9c46a', '#f4a261', '#8a5a44'] }
];

export const W = 360, H = 420;
const STEP = 1 / 120;

export class Game {
  constructor(canvas, post) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.post = post;
    this.rng = mulberry32(post.seed || 1);
    this.pal = PALETTES[(post.seed >>> 3) % PALETTES.length];
    this.W = W; this.H = H;
    this.auto = true;
    this.score = 0;
    this.best = 0;
    this.t = 0;
    this.acc = 0;
    this.running = false;
    this.particles = [];
    this.pointer = { x: W / 2, y: H / 2, down: false };
    this.onHud = null;
    this.setup();
  }
  r(a = 0, b = 1) { return a + this.rng() * (b - a); }
  ri(a, b) { return Math.floor(this.r(a, b + 1)); }
  col(i) { return this.pal.c[((i % this.pal.c.length) + this.pal.c.length) % this.pal.c.length]; }

  resize() {
    const cw = this.canvas.clientWidth || 360;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(cw * (H / W) * dpr);
    this.scale = this.canvas.width / W;
  }
  start() {
    if (this.running) return;
    this.resize();
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  frame(now) {
    const dt = Math.min(1 / 20, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n++ < 12) {
      if (this.auto) this.autopilot(STEP);
      this.step(STEP);
      this.stepParticles(STEP);
      this.t += STEP;
      this.acc -= STEP;
    }
    const c = this.ctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.draw(c);
    this.drawParticles(c);
    if (this.score > this.best) this.best = this.score;
    this.onHud?.(this.hud());
  }
  hud() { return `${Math.floor(this.score)}`; }

  // input, in logical coordinates
  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  setAuto(a) { this.auto = a; this.onModeChange?.(a); }
  // subclass hooks
  setup() {}
  step() {}
  draw() {}
  autopilot() {}
  down() {}
  move() {}
  up() {}
  tap(x, y) { this.down(x, y); this.up(x, y); }

  // effects
  burst(x, y, color, n = 10, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = this.r(0, Math.PI * 2), s = this.r(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: this.r(0.3, 0.8), max: 0.8, color, r: this.r(1.5, 3.5) });
    }
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260);
  }
  stepParticles(dt) {
    for (const p of this.particles) { p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
  drawParticles(c) {
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  clear(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.pal.bg2); g.addColorStop(1, this.pal.bg);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  text(c, s, x, y, size = 16, color = this.pal.ink, align = 'center') {
    c.font = `700 ${size}px ui-monospace, monospace`;
    c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = color; c.fillText(s, x, y);
  }
}

// ---------------------------------------------------------------- physics helpers
// Push circle b out of axis-aligned rect r; returns the collision normal or null.
export function circleRect(b, r) {
  const cx = Math.max(r.x, Math.min(b.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(b.y, r.y + r.h));
  let dx = b.x - cx, dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 > b.r * b.r) return null;
  let d = Math.sqrt(d2);
  if (d < 1e-6) {
    // centre inside rect: push out along the shallowest axis
    const l = b.x - r.x, rr = r.x + r.w - b.x, t = b.y - r.y, bb = r.y + r.h - b.y;
    const m = Math.min(l, rr, t, bb);
    if (m === l) { dx = -1; dy = 0; d = -l; } else if (m === rr) { dx = 1; dy = 0; d = -rr; } else if (m === t) { dx = 0; dy = -1; d = -t; } else { dx = 0; dy = 1; d = -bb; }
    b.x += dx * (b.r - d); b.y += dy * (b.r - d);
    return { nx: dx, ny: dy };
  }
  const nx = dx / d, ny = dy / d;
  b.x += nx * (b.r - d); b.y += ny * (b.r - d);
  return { nx, ny };
}
export function reflect(b, n, e = 0.8) {
  const vn = b.vx * n.nx + b.vy * n.ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * n.nx; b.vy -= (1 + e) * vn * n.ny; }
}
// Static circle (peg) collision.
export function circlePeg(b, p, e = 0.7) {
  const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + p.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return false;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = p.x + nx * rr; b.y = p.y + ny * rr;
  reflect(b, { nx, ny }, e);
  return true;
}
export function walls(b, x0, x1, y0, y1, e = 0.8) {
  let hit = false;
  if (b.x - b.r < x0) { b.x = x0 + b.r; b.vx = Math.abs(b.vx) * e; hit = true; }
  if (b.x + b.r > x1) { b.x = x1 - b.r; b.vx = -Math.abs(b.vx) * e; hit = true; }
  if (y0 != null && b.y - b.r < y0) { b.y = y0 + b.r; b.vy = Math.abs(b.vy) * e; hit = true; }
  if (y1 != null && b.y + b.r > y1) { b.y = y1 - b.r; b.vy = -Math.abs(b.vy) * e; hit = true; }
  return hit;
}
export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
