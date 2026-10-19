// Tiny 2D game base: fixed logical resolution, fixed-step physics, autopilot hook.
import { mulberry32 } from '../util.js';
import { settings } from '../state.js';
import { Skin, drawFit, drawRectImg, ready } from './assets.js';
export { drawFit, drawRectImg, ready };

// Random modifiers that make each game card a little different (and stranger).
export const MUTATORS = {
  lowg: { label: 'LOW-G', grav: 0.45 },
  heavy: { label: 'HEAVY', grav: 1.7 },
  fast: { label: 'TURBO', time: 1.45 },
  slow: { label: 'SLOW-MO', time: 0.6 },
  giant: { label: 'GIANT', size: 1.45 },
  tiny: { label: 'TINY', size: 0.7 },
  trails: { label: 'TRAILS', w: 0.7 },
  mirror: { label: 'MIRROR', w: 0.5 },
  wobble: { label: 'WOBBLE', w: 0.12 },
  hue: { label: 'ACID', w: 0.6 },
  invert: { label: 'NEGATIVE', w: 0.35 },
  junk: { label: 'JUNK RAIN', w: 0.5 },
  pixel: { label: '8-BIT', w: 0.8 },
  party: { label: 'PARTY', w: 0.8 },
  chaos: { label: 'CHAOS', w: 0.4 },
  swarm: { label: 'SWARM', w: 1.2 },
  glass: { label: 'GLASS CANNON', w: 0.8 },
  mono: { label: 'MONO', w: 1 }
};
const EXCLUSIVE = [['lowg', 'heavy'], ['fast', 'slow'], ['giant', 'tiny'], ['hue', 'invert', 'mono']];

// film grain, made once and shared
let grain = null;
function grainCanvas() {
  if (grain) return grain;
  grain = document.createElement('canvas'); grain.width = grain.height = 128;
  const x = grain.getContext('2d'), d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  return grain;
}

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
    this.pal = PALETTES[(post.seed >>> 3) % PALETTES.length]; // replaced by the theme palette below
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
    this.rollMutators(post);
    this.skin = new Skin(post, !!this.mods.chaos);
    this.pal = this.skin.pal;
    this.monoHue = (this.skin.hue + 30) % 360;
    this.theme = this.skin.name;
    this.bgImg = this.skin.bg || this.skin.slots.tile[0];
    this.bgStyle = this.skin.bg ? 'image' : 'pattern';
    this.wall = this.mods.chaos ? Array.from({ length: 9 }, () => ({ i: this.skin.prop(), x: this.r(0, W), y: this.r(0, H), s: this.r(40, 110), r: this.r(-0.6, 0.6) })) : null;
    this.junk = [];
    this.setup();
  }
  rollMutators(post) {
    const R = mulberry32((post.seed || 1) * 2654435761);
    const banned = this.constructor.noMods || [];
    const keys = Object.keys(MUTATORS).filter((k) => !banned.includes(k));
    const total = keys.reduce((s, k) => s + (MUTATORS[k].w ?? 1), 0);
    const n = post.mods ? 0 : [0, 1, 1, 2, 2, 3][Math.floor(R() * 6)];
    const picked = new Set(post.mods || []);
    let guard = 0;
    while (picked.size < n && guard++ < 50) {
      let x = R() * total, k = keys[0];
      for (const kk of keys) { x -= MUTATORS[kk].w ?? 1; if (x <= 0) { k = kk; break; } }
      if (EXCLUSIVE.some((g) => g.includes(k) && g.some((o) => o !== k && picked.has(o)))) continue;
      picked.add(k);
    }
    this.modList = [...picked];
    this.mods = Object.fromEntries(this.modList.map((k) => [k, true]));
    this.G = this.modList.reduce((g, k) => g * (MUTATORS[k].grav || 1), 1);
    this.T = this.modList.reduce((g, k) => g * (MUTATORS[k].time || 1), 1);
    this.S = this.modList.reduce((g, k) => g * (MUTATORS[k].size || 1), 1);
  }
  modLabels() { return this.modList.map((k) => MUTATORS[k].label); }
  r(a = 0, b = 1) { return a + this.rng() * (b - a); }
  ri(a, b) { return Math.floor(this.r(a, b + 1)); }
  col(i) { return this.pal.c[((i % this.pal.c.length) + this.pal.c.length) % this.pal.c.length]; }

  resize() {
    const cw = this.canvas.clientWidth || 360;
    const dpr = this.mods.pixel ? 0.42 : Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.imageRendering = this.mods.pixel ? 'pixelated' : '';
    this.canvas.style.filter = this.mods.hue ? `hue-rotate(${(this.post.seed % 300) + 30}deg) saturate(1.6)` : this.mods.invert ? 'invert(1) hue-rotate(180deg)' : '';
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
    const dt = Math.min(1 / 20, (now - this.last) / 1000) * this.T;
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
    if (this.mods.mirror) { c.translate(W, 0); c.scale(-1, 1); }
    if (this.mods.wobble) { c.translate(W / 2, H / 2); c.rotate(Math.sin(this.t * 1.7) * 0.06); c.scale(1 + Math.sin(this.t * 2.3) * 0.03, 1); c.translate(-W / 2, -H / 2); }
    this.draw(c);
    this.drawParticles(c);
    if (this.mods.junk) this.drawJunk(c);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.mods.mono) { c.globalCompositeOperation = 'color'; c.fillStyle = `hsl(${this.monoHue},45%,50%)`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
    if (settings.grit !== false) this.grit(c);
    if (this.score > this.best) this.best = this.score;
    this.onHud?.(this.hud());
  }
  hud() { return `${Math.floor(this.score)}`; }

  // input, in logical coordinates
  local(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    return { x: this.mods.mirror ? W - x : x, y: ((e.clientY - r.top) / r.height) * H };
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
    if (this.mods.party) { n *= 2.5; color = `hsl(${Math.floor(this.r(0, 360))},90%,60%)`; }
    for (let i = 0; i < n; i++) {
      const a = this.r(0, Math.PI * 2), s = this.r(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: this.r(0.3, 0.8), max: 0.8, color, r: this.r(1.5, 3.5) });
    }
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260);
  }
  stepParticles(dt) {
    for (const p of this.particles) { p.vy += 300 * this.G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.mods.junk) {
      if (this.rng() < dt * 1.6) this.junk.push({ i: this.skin.prop(), x: this.r(0, W), y: -40, vy: this.r(40, 120), vr: this.r(-2, 2), r: 0, s: this.r(26, 60) });
      for (const j of this.junk) { j.vy += 120 * this.G * dt; j.y += j.vy * dt; j.r += j.vr * dt; }
      this.junk = this.junk.filter((j) => j.y < H + 80);
    }
  }
  drawParticles(c) {
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  // weathered look: grain, vignette, dust and the odd scratch
  grit(c) {
    if (!this.gritPat) { this.gritPat = c.createPattern(grainCanvas(), 'repeat'); this.vig = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75); this.vig.addColorStop(0, 'rgba(0,0,0,0)'); this.vig.addColorStop(1, 'rgba(10,6,3,.55)'); }
    c.save();
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.16;
    c.translate((this.t * 977) % 128, (this.t * 613) % 128); c.fillStyle = this.gritPat; c.fillRect(-128, -128, W + 256, H + 256);
    c.restore();
    c.fillStyle = this.vig; c.fillRect(0, 0, W, H);
    const k = Math.floor(this.t * 12);
    if (k !== this.dustK) { this.dustK = k; this.dust = Array.from({ length: 6 }, () => [Math.random() * W, Math.random() * H, Math.random() * 2 + 0.5, Math.random() < 0.5]); this.scratch = Math.random() < 0.12 ? Math.random() * W : -1; }
    for (const [x, y, r, light] of this.dust) { c.fillStyle = light ? 'rgba(255,240,220,.25)' : 'rgba(0,0,0,.35)'; c.fillRect(x, y, r, r); }
    if (this.scratch > 0) { c.fillStyle = 'rgba(255,240,220,.12)'; c.fillRect(this.scratch, 0, 1, H); }
  }
  drawJunk(c) { for (const j of this.junk) { c.globalAlpha = 0.85; drawFit(c, j.i, j.x, j.y, j.s, j.s, j.r); } c.globalAlpha = 1; }
  clear(c) {
    if (this.mods.trails && this.t > 0.5) { c.fillStyle = this.pal.bg; c.globalAlpha = 0.22; c.fillRect(0, 0, W, H); c.globalAlpha = 1; return; }
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.pal.bg2); g.addColorStop(1, this.pal.bg);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (this.bgStyle === 'image' && ready(this.bgImg)) {
      const i = this.bgImg, s = Math.max(W / i.naturalWidth, H / i.naturalHeight);
      c.globalAlpha = 0.6; c.drawImage(i, (W - i.naturalWidth * s) / 2, (H - i.naturalHeight * s) / 2, i.naturalWidth * s, i.naturalHeight * s);
      c.globalAlpha = 0.35; c.fillStyle = this.pal.bg; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    } else if (this.bgStyle === 'pattern' && ready(this.bgImg)) {
      c.globalAlpha = 0.16; drawRectImg(c, this.bgImg, 0, 0, W, H, true); c.globalAlpha = 1;
    }
    if (this.wall) {
      c.globalAlpha = 0.18; for (const w of this.wall) drawFit(c, w.i, w.x, w.y, w.s, w.s, w.r); c.globalAlpha = 1;
    }
  }
  // Draw a sprite if loaded, otherwise a coloured circle.
  orb(c, i, x, y, r, color, rot = 0) {
    if (i && drawFit(c, i, x, y, r * 2.3, r * 2.3, rot)) return;
    c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
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
