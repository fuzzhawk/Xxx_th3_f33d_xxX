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
    this.algo = typeof this[post.sub] === 'function' && post.sub !== 'frame' ? post.sub : 'plasma'; this.pal = PALS[(post.seed >>> 2) % PALS.length];
    this.lut = paletteLUT(this.pal);
    this.speed = reduceMotion ? 0.25 : 1;
    this.t = this.rng() * 100;
    this.running = false;
    this.pixel = ['julia', 'mandel', 'tunnel', 'plasma', 'warp', 'sand', 'fluid', 'reaction'].includes(this.algo);
  }
  resize() {
    const cw = this.canvas.clientWidth || 360, ch = this.canvas.clientHeight || 450;
    if (this.pixel) {
      const s = { mandel: 0.33, julia: 0.33, sand: 0.3, fluid: 0.22, reaction: 0.27 }[this.algo] || 0.4;
      this.bw = Math.max(80, Math.round(cw * s)); this.bh = Math.round(this.bw * (ch / cw));
      this.canvas.width = this.bw; this.canvas.height = this.bh;
      this.ctx = this.canvas.getContext('2d');
      this.img = this.ctx.createImageData(this.bw, this.bh);
      if (this.algo === 'tunnel') this.tunnelTables();
      this[this.algo + 'Init']?.();
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
    this[this.algo + 'Init']?.();
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

  // ------------------------------------------------ physics: grid sims (render into the small buffer)
  slowSkip() { this.tick = (this.tick || 0) + 1; return this.speed < 1 && this.tick % 4; }
  sandInit() {
    const { bw, bh } = this, R = this.rng;
    this.g = new Uint8Array(bw * bh); this.wall = new Uint8Array(bw * bh); this.fill = 0; this.drain = false;
    const n = 4 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const len = bw * (0.22 + R() * 0.2), sl = (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.5);
      let x0 = R() * (bw - len), y0 = bh * (0.22 + 0.62 * (k + R() * 0.5) / n);
      for (let j = 0; j < len; j++) for (let th = 0; th < 2; th++) {
        const x = Math.floor(x0 + j), y = Math.floor(y0 + j * sl + th);
        if (x >= 0 && x < bw && y >= 0 && y < bh) this.wall[y * bw + x] = 1;
      }
    }
  }
  sand() {
    const { bw, bh, g, wall, t } = this, R = this.rng, tot = bw * bh;
    if (!this.slowSkip()) {
      for (let k = 0; k < 3; k++) {
        const x = Math.floor(bw * (0.5 + 0.38 * Math.sin(t * (0.35 + k * 0.11) + k * 2.1))), col = 1 + (Math.floor(t * 14 + k * 70) % 255);
        for (let j = 0; j < 3; j++) { const xx = x + Math.floor(R() * 5) - 2; if (xx >= 0 && xx < bw && !g[xx] && !wall[xx]) { g[xx] = col; this.fill++; } }
      }
      for (let pass = 0; pass < 2; pass++) for (let y = bh - 2; y >= 0; y--) {
        const dir = (y + pass + this.tick) & 1;
        for (let xi = 0; xi < bw; xi++) {
          const x = dir ? xi : bw - 1 - xi, i = y * bw + x, c = g[i];
          if (!c) continue;
          const b = i + bw;
          if (!g[b] && !wall[b]) { g[b] = c; g[i] = 0; continue; }
          const l = x > 0 && !g[b - 1] && !wall[b - 1] && !g[i - 1] && !wall[i - 1], r = x < bw - 1 && !g[b + 1] && !wall[b + 1] && !g[i + 1] && !wall[i + 1];
          if (l && (!r || R() < 0.5)) { g[b - 1] = c; g[i] = 0; } else if (r) { g[b + 1] = c; g[i] = 0; }
        }
      }
      if (this.fill > tot * 0.3) this.drain = true; else if (this.fill < tot * 0.14) this.drain = false;
      if (this.drain) {
        const w = Math.floor(bw / 4), x0 = Math.floor((t * 22) % (bw - w));
        for (let y = bh - 3; y < bh; y++) for (let x = x0; x < x0 + w; x++) if (g[y * bw + x]) { g[y * bw + x] = 0; this.fill--; }
      }
    }
    const d = this.img.data, lut = this.lut;
    for (let y = 0, i = 0; y < bh; y++) for (let x = 0; x < bw; x++, i++) {
      const o = i * 4, c = g[i];
      if (c) {
        const sh = (y && !g[i - bw] ? 1.12 : 0.9) * (0.92 + 0.08 * ((x * 7 + y * 13) & 3) / 3);
        d[o] = lut[c * 3] * sh; d[o + 1] = lut[c * 3 + 1] * sh; d[o + 2] = lut[c * 3 + 2] * sh;
      } else if (wall[i]) { d[o] = 92; d[o + 1] = 84; d[o + 2] = 92; } else { const k = y / bh; d[o] = 14 + 10 * k; d[o + 1] = 11 + 6 * k; d[o + 2] = 12 + 12 * k; }
      d[o + 3] = 255;
    }
  }
  fluidInit() {
    const n = this.bw * this.bh, F = () => new Float32Array(n);
    this.fu = F(); this.fv = F(); this.fu0 = F(); this.fv0 = F(); this.fp = F(); this.fd = F();
    this.dye = [F(), F(), F()]; this.dye0 = [F(), F(), F()];
  }
  advect(dst, src, u, v) {
    const { bw, bh } = this;
    for (let y = 0, i = 0; y < bh; y++) for (let x = 0; x < bw; x++, i++) {
      let px = x - u[i], py = y - v[i];
      px = px < 0 ? 0 : px > bw - 1.001 ? bw - 1.001 : px; py = py < 0 ? 0 : py > bh - 1.001 ? bh - 1.001 : py;
      const x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0, k = y0 * bw + x0;
      dst[i] = (src[k] * (1 - fx) + src[k + 1] * fx) * (1 - fy) + (src[k + bw] * (1 - fx) + src[k + bw + 1] * fx) * fy;
    }
  }
  fluid() {
    if (this.slowSkip()) return;
    const { bw, bh, t, fu, fv, fu0, fv0, fp, fd } = this, n = bw * bh;
    for (let k = 0; k < 3; k++) {
      const a = t * (0.5 + k * 0.17) + k * 2.4, b = t * (0.37 + k * 0.13) + k * 1.1;
      const cx = bw * (0.5 + 0.34 * Math.cos(a)), cy = bh * (0.5 + 0.34 * Math.sin(b));
      const vx = -Math.sin(a) * 2.2 * (k % 2 ? -1 : 1), vy = Math.cos(b) * 2.2, col = this.pal[(k + Math.floor(t * 0.25)) % this.pal.length], rad = 3 + bw / 40;
      for (let y = Math.max(0, cy - rad * 2 | 0); y < Math.min(bh, cy + rad * 2); y++) for (let x = Math.max(0, cx - rad * 2 | 0); x < Math.min(bw, cx + rad * 2); x++) {
        const w = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (rad * rad)), i = y * bw + x;
        fu[i] += vx * w * 0.6; fv[i] += vy * w * 0.6;
        for (let c = 0; c < 3; c++) this.dye[c][i] += col[c] / 255 * w * 0.5;
      }
    }
    fu0.set(fu); fv0.set(fv);
    this.advect(fu, fu0, fu0, fv0); this.advect(fv, fv0, fu0, fv0);
    for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) { const i = y * bw + x; fd[i] = -0.5 * (fu[i + 1] - fu[i - 1] + fv[i + bw] - fv[i - bw]); fp[i] = 0; }
    for (let it = 0; it < 14; it++) for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) { const i = y * bw + x; fp[i] = (fd[i] + fp[i - 1] + fp[i + 1] + fp[i - bw] + fp[i + bw]) * 0.25; }
    for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) { const i = y * bw + x; fu[i] -= 0.5 * (fp[i + 1] - fp[i - 1]); fv[i] -= 0.5 * (fp[i + bw] - fp[i - bw]); }
    for (let i = 0; i < n; i++) { fu[i] *= 0.998; fv[i] *= 0.998; }
    for (let c = 0; c < 3; c++) {
      this.dye0[c].set(this.dye[c]); this.advect(this.dye[c], this.dye0[c], fu, fv);
      const dc = this.dye[c]; for (let i = 0; i < n; i++) dc[i] *= 0.993;
    }
    const d = this.img.data, [dr, dg, db] = this.dye;
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      d[o] = 12 + 255 * (1 - Math.exp(-dr[i] * 1.6)); d[o + 1] = 10 + 255 * (1 - Math.exp(-dg[i] * 1.6)); d[o + 2] = 9 + 255 * (1 - Math.exp(-db[i] * 1.6)); d[o + 3] = 255;
    }
    this.fillDone = true;
  }
  reactionInit() {
    const { bw, bh } = this, n = bw * bh, R = this.rng;
    this.A = new Float32Array(n).fill(1); this.B = new Float32Array(n); this.A2 = new Float32Array(n); this.B2 = new Float32Array(n);
    const P = [[0.0367, 0.0649], [0.029, 0.057], [0.0545, 0.062], [0.039, 0.058], [0.0460, 0.0630]];
    [this.f0, this.k0] = P[this.post.seed % P.length];
    for (let k = 0; k < 7; k++) this.pokeB(R() * bw, R() * bh, 3 + R() * 4);
  }
  pokeB(cx, cy, r) {
    const { bw, bh } = this;
    for (let y = Math.max(0, cy - r | 0); y < Math.min(bh, cy + r); y++) for (let x = Math.max(0, cx - r | 0); x < Math.min(bw, cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) { this.B[y * bw + x] = 1; this.A[y * bw + x] = 0.4; }
  }
  reaction() {
    const { bw, bh } = this;
    if (!this.slowSkip()) {
      if (!this.nextPoke || this.t > this.nextPoke) { this.nextPoke = this.t + 4 + this.rng() * 4; this.pokeB(this.rng() * bw, this.rng() * bh, 3 + this.rng() * 3); }
      const f = this.f0 + 0.002 * Math.sin(this.t * 0.2), k = this.k0;
      let A = this.A, B = this.B, A2 = this.A2, B2 = this.B2;
      for (let s = 0; s < 8; s++) {
        for (let y = 0; y < bh; y++) {
          const ym = ((y + bh - 1) % bh) * bw, yp = ((y + 1) % bh) * bw, yy = y * bw;
          for (let x = 0; x < bw; x++) {
            const xm = (x + bw - 1) % bw, xp = (x + 1) % bw, i = yy + x, a = A[i], b = B[i];
            const la = 0.2 * (A[yy + xm] + A[yy + xp] + A[ym + x] + A[yp + x]) + 0.05 * (A[ym + xm] + A[ym + xp] + A[yp + xm] + A[yp + xp]) - a;
            const lb = 0.2 * (B[yy + xm] + B[yy + xp] + B[ym + x] + B[yp + x]) + 0.05 * (B[ym + xm] + B[ym + xp] + B[yp + xm] + B[yp + xp]) - b;
            const r = a * b * b;
            A2[i] = a + la - r + f * (1 - a); B2[i] = b + 0.5 * lb + r - (k + f) * b;
          }
        }
        [A, A2] = [A2, A]; [B, B2] = [B2, B];
      }
      this.A = A; this.B = B; this.A2 = A2; this.B2 = B2;
    }
    const d = this.img.data, lut = this.lut, B = this.B, shift = this.t * 8;
    for (let i = 0, o = 0; i < B.length; i++, o += 4) {
      const b = B[i], v = Math.min(1, b * 3.4), k = ((b * 520 + shift) & 255) * 3, m = 0.12 + 0.88 * v;
      d[o] = lut[k] * m + 12; d[o + 1] = lut[k + 1] * m + 10; d[o + 2] = lut[k + 2] * m + 9; d[o + 3] = 255;
    }
  }

  // ------------------------------------------------ physics: particles and bodies (vector canvas)
  boidsInit() {
    const R = this.rng, s = this.w / 400;
    this.bd = Array.from({ length: 90 }, () => { const a = R() * 6.283; return { x: R() * this.w, y: R() * this.h, vx: Math.cos(a) * 60 * s, vy: Math.sin(a) * 60 * s }; });
  }
  boids(dt) {
    const c = this.ctx, s = this.w / 400, B = this.bd, W = this.w, H = this.h, t = this.t;
    const px = W * (0.5 + 0.42 * Math.sin(t * 0.37)), py = H * (0.5 + 0.4 * Math.sin(t * 0.53 + 1)), pr = 120 * s, vr = 52 * s, sr = 17 * s;
    this.fade(0.16);
    for (const b of B) {
      let n = 0, ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0;
      for (const o of B) {
        if (o === b) continue;
        const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > vr * vr) continue;
        n++; ax += o.vx; ay += o.vy; cx += o.x; cy += o.y;
        if (d2 < sr * sr) { sx -= dx; sy -= dy; }
      }
      if (n) { b.vx += ((ax / n - b.vx) * 1.6 + (cx / n - b.x) * 0.9 + sx * 5) * dt; b.vy += ((ay / n - b.vy) * 1.6 + (cy / n - b.y) * 0.9 + sy * 5) * dt; }
      const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
      if (d < pr) { const f = (1 - d / pr) * 900 * s * dt / (d + 1); b.vx += dx * f; b.vy += dy * f; }
      const sp = Math.hypot(b.vx, b.vy) || 1, tg = Math.min(130 * s, Math.max(55 * s, sp));
      b.vx *= tg / sp; b.vy *= tg / sp;
      b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H;
      const a = Math.atan2(b.vy, b.vx), L = 7 * s;
      c.fillStyle = this.rgb(Math.floor((a / 6.283 + 1) * this.pal.length * 1.5), 0.9);
      c.beginPath(); c.moveTo(b.x + Math.cos(a) * L * 1.4, b.y + Math.sin(a) * L * 1.4);
      c.lineTo(b.x + Math.cos(a + 2.5) * L, b.y + Math.sin(a + 2.5) * L); c.lineTo(b.x + Math.cos(a - 2.5) * L, b.y + Math.sin(a - 2.5) * L); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(px, py, 4 * s, 0, 6.283); c.fill();
  }
  orbitsInit() {
    const R = this.rng, W = 400, H = 400 * this.h / this.w, GM = 1.1e6;
    this.ob = []; this.sc = this.w / 400; this.WH = [W, H];
    const bin = this.post.seed % 3 === 0, mid = [W / 2, H / 2];
    if (bin) {
      const r = 38, v = Math.sqrt(GM * 0.5 / (4 * r));
      this.ob.push({ x: mid[0] - r, y: mid[1], vx: 0, vy: v, m: 0.5, star: 1, c: 0 }, { x: mid[0] + r, y: mid[1], vx: 0, vy: -v, m: 0.5, star: 1, c: 1 });
    } else this.ob.push({ x: mid[0], y: mid[1], vx: 0, vy: 0, m: 1, star: 1, c: 0 });
    const n = 4 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const r = (bin ? 110 : 55) + k * 28 + R() * 14, a = R() * 6.283, v = Math.sqrt(GM / r) * (0.85 + R() * 0.25), dir = R() < 0.12 ? -1 : 1;
      this.ob.push({ x: mid[0] + Math.cos(a) * r, y: mid[1] + Math.sin(a) * r, vx: -Math.sin(a) * v * dir, vy: Math.cos(a) * v * dir, m: 0.0005 + R() * 0.002, c: k + 2 });
    }
    this.GM = GM; this.age = 0;
    this.ctx.fillStyle = '#0c0a09'; this.ctx.fillRect(0, 0, this.w, this.h);
  }
  orbits(dt) {
    const c = this.ctx, B = this.ob, s = this.sc, GM = this.GM, [W, H] = this.WH;
    this.fade(0.035); this.age += dt;
    const sub = Math.max(1, Math.ceil(dt / 0.004)), h = dt / sub * 1.3;
    for (let q = 0; q < sub; q++) {
      for (const b of B) {
        let ax = 0, ay = 0;
        for (const o of B) { if (o === b) continue; const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy + 90, inv = GM * o.m / (d2 * Math.sqrt(d2)); ax += dx * inv; ay += dy * inv; }
        b.vx += ax * h; b.vy += ay * h;
      }
      for (const b of B) { b.px = b.x; b.py = b.y; b.x += b.vx * h; b.y += b.vy * h; }
    }
    let lost = 0;
    for (const b of B) {
      if (b.star) { const g = c.createRadialGradient(b.x * s, b.y * s, 0, b.x * s, b.y * s, 22 * s); g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(b.x * s, b.y * s, 22 * s, 0, 6.283); c.fill(); continue; }
      if (b.x < -W || b.x > 2 * W || b.y < -H || b.y > 2 * H) lost++;
      c.strokeStyle = this.rgb(b.c, 0.85); c.lineWidth = 1.8 * s; c.beginPath(); c.moveTo(b.px * s, b.py * s); c.lineTo(b.x * s, b.y * s); c.stroke();
      c.fillStyle = this.rgb(b.c + 1, 1); c.beginPath(); c.arc(b.x * s, b.y * s, 3 * s, 0, 6.283); c.fill();
    }
    if (lost > 1 || this.age > 90) this.orbitsInit();
  }
  pendulumInit() {
    const R = this.rng, a = R() * 1.2 + 1.8, b = R() * 2 + 1.5;
    this.pn = Array.from({ length: 5 }, (_, i) => ({ s: [a + i * 0.0015, b + i * 0.0015, 0, 0], tr: [] }));
    this.gl = 9.81 * (0.8 + R() * 0.5);
  }
  pendDeriv(s, g) {
    const [a, b, w1, w2] = s, d = a - b, den = 3 - Math.cos(2 * d);
    return [w1, w2,
      (-3 * g * Math.sin(a) - g * Math.sin(a - 2 * b) - 2 * Math.sin(d) * (w2 * w2 + w1 * w1 * Math.cos(d))) / den,
      (2 * Math.sin(d) * (2 * w1 * w1 + 2 * g * Math.cos(a) + w2 * w2 * Math.cos(d))) / den];
  }
  pendulum(dt) {
    const c = this.ctx, g = this.gl, ox = this.w / 2, oy = this.h * 0.4, L = Math.min(this.w * 0.2, this.h * 0.2), sc = this.w / 400;
    c.fillStyle = '#0c0a09'; c.fillRect(0, 0, this.w, this.h);
    const sub = Math.max(1, Math.ceil(dt / 0.004)), h = dt / sub * 1.6;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    this.pn.forEach((p, k) => {
      for (let q = 0; q < sub; q++) {
        const s = p.s, k1 = this.pendDeriv(s, g), k2 = this.pendDeriv(s.map((v, i) => v + k1[i] * h / 2), g), k3 = this.pendDeriv(s.map((v, i) => v + k2[i] * h / 2), g), k4 = this.pendDeriv(s.map((v, i) => v + k3[i] * h), g);
        for (let i = 0; i < 4; i++) s[i] += h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      }
      const [a, b] = p.s, x1 = ox + Math.sin(a) * L, y1 = oy + Math.cos(a) * L, x2 = x1 + Math.sin(b) * L, y2 = y1 + Math.cos(b) * L;
      p.tr.push(x2, y2); if (p.tr.length > 480) p.tr.splice(0, 2);
      const n = p.tr.length / 2, chunks = 8, per = Math.ceil(n / chunks);
      c.lineWidth = 2.2 * sc;
      for (let ch = 0; ch < chunks; ch++) {
        const i0 = Math.max(0, ch * per - 1), i1 = Math.min(n, (ch + 1) * per);
        if (i1 - i0 < 2) continue;
        c.strokeStyle = this.rgb(k, 0.06 + 0.5 * (ch + 1) / chunks); c.beginPath(); c.moveTo(p.tr[i0 * 2], p.tr[i0 * 2 + 1]);
        for (let i = i0 + 1; i < i1; i++) c.lineTo(p.tr[i * 2], p.tr[i * 2 + 1]);
        c.stroke();
      }
      if (k === 0) { c.strokeStyle = 'rgba(255,240,220,.45)'; c.lineWidth = 1.5 * sc; c.beginPath(); c.moveTo(ox, oy); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.fillStyle = 'rgba(255,240,220,.8)'; c.beginPath(); c.arc(x1, y1, 4 * sc, 0, 6.283); c.fill(); }
      c.fillStyle = this.rgb(k + 1, 0.95); c.beginPath(); c.arc(x2, y2, 5 * sc, 0, 6.283); c.fill();
    });
    c.globalCompositeOperation = 'source-over';
  }
  magnetInit() {
    const R = this.rng, n = 3 + Math.floor(R() * 2);
    this.poles = Array.from({ length: n }, (_, k) => ({ q: k === 0 ? 1 : k === 1 ? -1 : R() < 0.5 ? 1 : -1, r: 0.14 + R() * 0.18, a: R() * 6.283, w: (0.15 + R() * 0.25) * (R() < 0.5 ? -1 : 1), e: 0.8 + R() * 0.4, c: k, x: 0, y: 0 }));
    this.mp = Array.from({ length: 480 }, () => ({ x: -1, y: -1, age: 99, c: 0 }));
    this.ctx.fillStyle = '#0c0a09'; this.ctx.fillRect(0, 0, this.w, this.h);
  }
  magnet(dt) {
    const c = this.ctx, s = this.w / 400, t = this.t, P = this.poles, R = this.rng, W = this.w, H = this.h;
    this.fade(0.07);
    for (const p of P) { p.x = W / 2 + Math.cos(p.a + p.w * t) * p.r * W * 1.2; p.y = H / 2 + Math.sin(p.a * 1.7 + p.w * t * 1.3) * p.e * p.r * H * 1.5; }
    const src = P.filter((p) => p.q > 0), sp = 85 * s * dt;
    c.lineWidth = 1.4 * s;
    for (const q of this.mp) {
      q.age += dt;
      if (q.age > 7 || q.x < -10 || q.x > W + 10 || q.y < -10 || q.y > H + 10) { const o = src[Math.floor(R() * src.length)] || P[0], a = R() * 6.283; q.x = o.x + Math.cos(a) * 9 * s; q.y = o.y + Math.sin(a) * 9 * s; q.age = R() * 0.5; q.c = o.c; }
      let ex = 0, ey = 0;
      for (const p of P) { const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy + 30, inv = p.q / (d2 * Math.sqrt(d2)); ex += dx * inv; ey += dy * inv; }
      const m = Math.hypot(ex, ey) || 1, ca = 0.28, dx = (ex * Math.cos(ca) - ey * Math.sin(ca)) / m, dy = (ex * Math.sin(ca) + ey * Math.cos(ca)) / m;
      const nx = q.x + dx * sp, ny = q.y + dy * sp;
      c.strokeStyle = this.rgb(q.c + (m > 0.004 ? 0 : 1), 0.55); c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(nx, ny); c.stroke();
      q.x = nx; q.y = ny;
      for (const p of P) if (p.q < 0 && Math.hypot(q.x - p.x, q.y - p.y) < 9 * s) q.age = 99;
    }
    for (const p of P) { const col = p.q > 0 ? '255,235,200' : '170,200,255'; const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16 * s); g.addColorStop(0, `rgba(${col},.95)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 16 * s, 0, 6.283); c.fill(); }
  }
  clothInit() {
    const cols = 15, rows = 20, sp = Math.min(this.w * 0.82 / (cols - 1), this.h * 0.7 / (rows - 1)), x0 = (this.w - sp * (cols - 1)) / 2, y0 = this.h * 0.1;
    this.cl = { cols, rows, sp, pts: [] };
    const step = 2 + (this.post.seed % 3);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) this.cl.pts.push({ x: x0 + i * sp, y: y0 + j * sp, px: x0 + i * sp, py: y0 + j * sp, pin: j === 0 && i % step === 0, x0: x0 + i * sp, y0 });
  }
  cloth(dt) {
    const c = this.ctx, { cols, rows, sp, pts } = this.cl, s = this.w / 400, t = this.t, d2 = dt / 2;
    for (let sub = 0; sub < 2; sub++) {
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const p = pts[j * cols + i];
        if (p.pin) continue;
        const gust = 0.55 + 0.45 * Math.sin(t * 0.6 + 1) + 0.5 * Math.sin(t * 1.7 + j * 0.35 + i * 0.12), wx = (gust + 0.1) * 380 * s, wy = Math.sin(t * 2.3 + i * 0.5 + j * 0.2) * 260 * s;
        const vx = (p.x - p.px) * 0.992, vy = (p.y - p.py) * 0.992;
        p.px = p.x; p.py = p.y; p.x += vx + wx * d2 * d2; p.y += vy + (1100 * s + wy) * d2 * d2;
      }
      for (let it = 0; it < 7; it++) for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = pts[j * cols + i];
        for (const [di, dj] of [[1, 0], [0, 1]]) {
          if (i + di >= cols || j + dj >= rows) continue;
          const b = pts[(j + dj) * cols + i + di], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - sp) / d, fa = a.pin ? 0 : b.pin ? 1 : 0.5, fb = b.pin ? 0 : a.pin ? 1 : 0.5;
          a.x += dx * f * fa; a.y += dy * f * fa; b.x -= dx * f * fb; b.y -= dy * f * fb;
        }
        if (a.pin) { a.x = a.x0; a.y = a.y0; }
      }
    }
    const g = c.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, '#16111a'); g.addColorStop(1, '#0c0a09');
    c.fillStyle = g; c.fillRect(0, 0, this.w, this.h);
    c.lineWidth = 0.7 * s; c.lineJoin = 'round';
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = pts[j * cols + i], b = pts[j * cols + i + 1], d = pts[(j + 1) * cols + i + 1], e = pts[(j + 1) * cols + i];
      const area = ((b.x - a.x) * (e.y - a.y) - (b.y - a.y) * (e.x - a.x)) / (sp * sp), k = Math.max(0.35, Math.min(1.35, 0.55 + 0.6 * area + (a.x - b.x + e.x - d.x) * 0.004));
      const col = this.pal[(Math.floor(i / 2) + (j >> 2)) % this.pal.length];
      const css = `rgb(${Math.min(255, col[0] * k) | 0},${Math.min(255, col[1] * k) | 0},${Math.min(255, col[2] * k) | 0})`;
      c.fillStyle = css; c.strokeStyle = css;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath(); c.fill(); c.stroke();
    }
    c.strokeStyle = 'rgba(230,220,200,.7)'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(this.w * 0.05, this.h * 0.1 - 3 * s); c.lineTo(this.w * 0.95, this.h * 0.1 - 3 * s); c.stroke();
  }
}
