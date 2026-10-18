// Generative, math-based visuals. Pixel-based effects render into a small
// buffer that is scaled up (soft edges suit the style and keep phones cool).
import { mulberry32 } from './util.js';

const PALS = [
  [[255, 122, 26], [201, 149, 43], [125, 138, 74], [181, 83, 47], [216, 195, 165]],
  [[255, 90, 40], [255, 190, 90], [80, 40, 90], [20, 120, 130], [250, 230, 200]],
  [[230, 57, 70], [241, 250, 238], [168, 218, 220], [69, 123, 157], [29, 53, 87]],
  [[255, 0, 110], [251, 86, 7], [255, 190, 11], [131, 56, 236], [58, 134, 255]],
  [[38, 70, 83], [42, 157, 143], [233, 196, 106], [244, 162, 97], [231, 111, 81]],
  [[60, 9, 108], [123, 44, 191], [224, 170, 255], [255, 158, 0], [255, 84, 0]]
];
function paletteLUT(pal, n = 256) {
  const lut = new Uint8ClampedArray(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * pal.length, k = Math.floor(t), f = t - k;
    const a = pal[k % pal.length], b = pal[(k + 1) % pal.length];
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c] + (b[c] - a[c]) * (0.5 - 0.5 * Math.cos(f * Math.PI));
  }
  return lut;
}

export class Psych {
  constructor(canvas, post, { reduceMotion } = {}) {
    this.canvas = canvas; this.post = post; this.rng = mulberry32(post.seed || 7);
    this.algo = post.sub; this.pal = PALS[(post.seed >>> 2) % PALS.length];
    this.lut = paletteLUT(this.pal);
    this.speed = reduceMotion ? 0.25 : 1;
    this.t = this.rng() * 100;
    this.running = false;
    this.pixel = ['julia', 'mandel', 'tunnel', 'plasma', 'warp'].includes(this.algo);
  }
  resize() {
    const cw = this.canvas.clientWidth || 360, ch = this.canvas.clientHeight || 450;
    if (this.pixel) {
      const s = this.algo === 'mandel' || this.algo === 'julia' ? 0.33 : 0.4;
      this.bw = Math.max(80, Math.round(cw * s)); this.bh = Math.round(this.bw * (ch / cw));
      this.canvas.width = this.bw; this.canvas.height = this.bh;
      this.ctx = this.canvas.getContext('2d');
      this.img = this.ctx.createImageData(this.bw, this.bh);
      if (this.algo === 'tunnel') this.tunnelTables();
    } else {
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.canvas.width = Math.round(cw * dpr); this.canvas.height = Math.round(ch * dpr);
      this.ctx = this.canvas.getContext('2d');
      this.w = this.canvas.width; this.h = this.canvas.height;
      this.ctx.fillStyle = '#0c0a09'; this.ctx.fillRect(0, 0, this.w, this.h);
      this.initVector();
    }
  }
  start() {
    if (this.running) return;
    this.resize();
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.t += dt * this.speed;
      this.frame(dt * this.speed);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  frame(dt) {
    if (this.pixel) { this[this.algo](); this.ctx.putImageData(this.img, 0, 0); }
    else this[this.algo](dt);
  }
  put(i, v) { const d = this.img.data, k = ((v & 255) >>> 0) * 3; d[i] = this.lut[k]; d[i + 1] = this.lut[k + 1]; d[i + 2] = this.lut[k + 2]; d[i + 3] = 255; }

  // ------------------------------------------------ pixel effects
  julia() {
    const { bw, bh, t } = this;
    const a = t * 0.13 + (this.post.seed % 100);
    const cr = 0.7885 * Math.cos(a), ci = 0.7885 * Math.sin(a);
    const zoom = 1.5, max = 48, shift = t * 40;
    for (let y = 0, i = 0; y < bh; y++) for (let x = 0; x < bw; x++, i += 4) {
      let zr = ((x / bw) - 0.5) * 3 / zoom, zi = ((y / bh) - 0.5) * 3 / zoom * (bh / bw);
      let n = 0;
      while (n < max && zr * zr + zi * zi < 4) { const tmp = zr * zr - zi * zi + cr; zi = 2 * zr * zi + ci; zr = tmp; n++; }
      this.put(i, n === max ? 0 : n * 6 + shift);
    }
  }
  mandel() {
    const spots = [[-0.743643887, 0.131825904], [-0.7453, 0.1127], [0.2549, 0.0005], [-1.25066, 0.02012], [-0.1592, 1.0317], [-0.77568377, 0.13646737]];
    const [cx, cy] = spots[this.post.seed % spots.length];
    const cycle = 22, ph = (this.t % cycle) / cycle;
    const scale = 3 * Math.pow(0.0009, ph);
    const { bw, bh } = this, max = 60 + Math.floor(ph * 140), shift = this.t * 30;
    for (let y = 0, i = 0; y < bh; y++) for (let x = 0; x < bw; x++, i += 4) {
      const x0 = cx + ((x / bw) - 0.5) * scale, y0 = cy + ((y / bh) - 0.5) * scale * (bh / bw);
      let zr = 0, zi = 0, n = 0;
      while (n < max && zr * zr + zi * zi < 4) { const tmp = zr * zr - zi * zi + x0; zi = 2 * zr * zi + y0; zr = tmp; n++; }
      this.put(i, n === max ? 0 : n * 4 + shift);
    }
  }
  tunnelTables() {
    const { bw, bh } = this;
    this.dist = new Float32Array(bw * bh); this.ang = new Float32Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const dx = x - bw / 2, dy = y - bh / 2;
      this.dist[y * bw + x] = 32 * 40 / (Math.sqrt(dx * dx + dy * dy) + 0.5);
      this.ang[y * bw + x] = (Math.atan2(dy, dx) / Math.PI) * 128;
    }
  }
  tunnel() {
    const { bw, bh, t } = this, n = bw * bh;
    const sx = t * 60, sy = t * 25, twist = (this.post.seed % 3) + 1;
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const u = (this.dist[p] + sx) | 0, v = (this.ang[p] * twist + sy) | 0;
      const tex = ((u ^ v) & 63) * 2 + ((u >> 3) & 1) * 40;
      const fade = Math.min(1, 900 / (this.dist[p] * 2 + 200));
      this.put(i, tex * fade + t * 20);
      const d = this.img.data; d[i] *= fade * 1.4; d[i + 1] *= fade * 1.4; d[i + 2] *= fade * 1.4;
    }
  }
  plasma() {
    const { bw, bh, t } = this, k = 1 + (this.post.seed % 4) * 0.4;
    for (let y = 0, i = 0; y < bh; y++) for (let x = 0; x < bw; x++, i += 4) {
      const u = x / bw * 8 * k, v = y / bh * 10 * k;
      const val = Math.sin(u + t) + Math.sin((v + t) * 0.5) + Math.sin((u + v + t) * 0.5) + Math.sin(Math.sqrt(u * u + v * v + 1) + t * 1.3);
      this.put(i, (val + 4) * 32 + t * 25);
    }
  }
  warp() {
    const { bw, bh, t } = this, s = 0.035 + (this.post.seed % 5) * 0.004;
    for (let y = 0, i = 0; y < bh; y++) for (let x = 0; x < bw; x++, i += 4) {
      let u = x * s, v = y * s;
      const q1 = Math.sin(u * 1.7 + t * 0.4) + Math.cos(v * 1.3 - t * 0.3);
      const q2 = Math.cos(u * 1.1 - t * 0.2) + Math.sin(v * 1.9 + t * 0.5);
      u += q1 * 1.6; v += q2 * 1.6;
      const r = Math.sin(u * 2.1 + Math.cos(v * 1.4 + t * 0.6) * 2) + Math.cos(v * 1.7 - t * 0.35);
      this.put(i, (r + 2) * 60 + t * 18);
    }
  }

  // ------------------------------------------------ vector effects
  initVector() {
    const R = this.rng;
    if (this.algo === 'flow') this.parts = Array.from({ length: 700 }, () => ({ x: R() * this.w, y: R() * this.h, c: Math.floor(R() * 5) }));
    if (this.algo === 'spiro') { this.R = 0.36; this.r = 0.05 + R() * 0.25; this.d = 0.05 + R() * 0.3; this.ph = 0; }
    if (this.algo === 'kaleido') this.n = 6 + Math.floor(R() * 4) * 2;
  }
  rgb(i, a = 1) { const c = this.pal[((i % this.pal.length) + this.pal.length) % this.pal.length]; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
  fade(a) { const c = this.ctx; c.fillStyle = `rgba(12,10,9,${a})`; c.fillRect(0, 0, this.w, this.h); }
  flow(dt) {
    const c = this.ctx, s = 0.0035, t = this.t * 0.15;
    this.fade(0.04);
    c.lineWidth = 1.3 * (this.w / 400);
    for (const p of this.parts) {
      const a = (Math.sin(p.x * s + t) + Math.cos(p.y * s * 1.3 - t) + Math.sin((p.x + p.y) * s * 0.7)) * Math.PI;
      const nx = p.x + Math.cos(a) * 90 * dt * (this.w / 400), ny = p.y + Math.sin(a) * 90 * dt * (this.w / 400);
      c.strokeStyle = this.rgb(p.c, 0.6); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(nx, ny); c.stroke();
      p.x = nx; p.y = ny;
      if (p.x < 0 || p.x > this.w || p.y < 0 || p.y > this.h || this.rng() < 0.003) { p.x = this.rng() * this.w; p.y = this.rng() * this.h; }
    }
  }
  spiro(dt) {
    const c = this.ctx, m = Math.min(this.w, this.h), cx = this.w / 2, cy = this.h / 2;
    this.fade(0.012);
    c.lineWidth = 1.6 * (this.w / 400);
    const R = this.R * m, r = this.r * m, d = this.d * m;
    for (let k = 0; k < 6; k++) {
      const a0 = this.ph, a1 = this.ph + dt * 1.2;
      c.strokeStyle = this.rgb(Math.floor(this.t * 0.4), 0.9);
      c.beginPath();
      for (let a = a0; a <= a1; a += 0.01) {
        const x = cx + (R - r) * Math.cos(a) + d * Math.cos(((R - r) / r) * a), y = cy + (R - r) * Math.sin(a) - d * Math.sin(((R - r) / r) * a);
        a === a0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      this.ph = a1;
    }
    if (this.ph > 400) { this.ph = 0; this.r = 0.05 + this.rng() * 0.25; this.d = 0.05 + this.rng() * 0.3; }
  }
  rings() {
    const c = this.ctx, cx = this.w / 2, cy = this.h / 2, max = Math.hypot(cx, cy);
    const gap = 18 * (this.w / 400), off = (this.t * 40 * (this.w / 400)) % gap;
    for (let r = max + gap; r > 0; r -= gap) {
      const i = Math.floor((r - off) / gap + this.t * 0.8);
      const wob = Math.sin(this.t * 1.5 + r * 0.02) * 6;
      c.fillStyle = this.rgb(i, 1);
      c.beginPath(); c.ellipse(cx + wob, cy - wob, Math.max(0, r - off), Math.max(0, (r - off) * (0.85 + 0.15 * Math.sin(this.t + r * 0.01))), this.t * 0.2, 0, Math.PI * 2); c.fill();
    }
  }
  moire() {
    const c = this.ctx, t = this.t;
    c.fillStyle = '#0c0a09'; c.fillRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    const centers = [[0.5 + 0.25 * Math.sin(t * 0.4), 0.45 + 0.2 * Math.cos(t * 0.3)], [0.5 + 0.25 * Math.cos(t * 0.35), 0.55 + 0.2 * Math.sin(t * 0.45)]];
    c.lineWidth = 3 * (this.w / 400);
    centers.forEach(([u, v], k) => {
      c.strokeStyle = this.rgb(k * 2 + Math.floor(t * 0.2), 0.65);
      for (let r = 6; r < Math.max(this.w, this.h) * 1.2; r += 9 * (this.w / 400)) { c.beginPath(); c.arc(u * this.w, v * this.h, r, 0, Math.PI * 2); c.stroke(); }
    });
    c.globalCompositeOperation = 'source-over';
  }
  kaleido() {
    const c = this.ctx, n = this.n, cx = this.w / 2, cy = this.h / 2, m = Math.max(this.w, this.h), t = this.t;
    this.fade(0.08);
    for (let k = 0; k < n; k++) {
      c.save(); c.translate(cx, cy); c.rotate((k * 2 * Math.PI) / n + t * 0.1);
      if (k % 2) c.scale(1, -1);
      for (let j = 0; j < 5; j++) {
        const r = m * (0.08 + 0.09 * j + 0.04 * Math.sin(t * (0.7 + j * 0.2)));
        const a = 0.25 + 0.2 * Math.sin(t * 0.6 + j);
        c.fillStyle = this.rgb(j + Math.floor(t * 0.5), 0.55);
        c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, m * (0.012 + 0.02 * (0.5 + 0.5 * Math.sin(t + j * 1.7))), 0, Math.PI * 2); c.fill();
        c.strokeStyle = this.rgb(j + 2, 0.5); c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * 0.6, Math.sin(t + j) * r * 0.4, Math.cos(a) * r, Math.sin(a) * r); c.stroke();
      }
      c.restore();
    }
  }
}
