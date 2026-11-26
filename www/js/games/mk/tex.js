// The Makhana texture engine, ported from the MAKHANA prototype: paint at s× with a height buffer,
// light the paint from the heights, box-downsample, then Bayer-dither into a palette. Ground tiles
// (64×64, tileable), props, buildings, creatures and the giants are all painted through it, which
// is where the garden's gritty, hand-lit pixel look comes from. All drawing coordinates are in
// OUTPUT pixels (fractions allowed).

export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
export const cx2d = (c) => c.getContext('2d', { willReadFrequently: true });
export function RNG(seed) {
  let a = seed >>> 0;
  const f = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { f, range: (x, y) => x + f() * (y - x), int: (x, y) => Math.floor(x + f() * (y - x + 1)), pick: (arr) => arr[Math.floor(f() * arr.length)], chance: (p) => f() < p, sign: () => (f() < 0.5 ? -1 : 1) };
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t;
export function hash2(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, -1640531535)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function vnoise(x, y, s, p) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  let ax = x0, bx = x0 + 1, ay = y0, by = y0 + 1;
  if (p) { ax = ((ax % p) + p) % p; bx = ((bx % p) + p) % p; ay = ((ay % p) + p) % p; by = ((by % p) + p) % p; }
  return lerp(lerp(hash2(ax, ay, s), hash2(bx, ay, s), sx), lerp(hash2(ax, by, s), hash2(bx, by, s), sx), sy);
}
export function fbm(x, y, s, oct, p) { oct = oct || 4; let v = 0, a = 1, t = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * vnoise(x * f, y * f, s + o * 31, p ? p * f : 0); t += a; a *= 0.5; f *= 2; } return v / t; }
export const BAY = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => v / 64 - 0.49);
export const bay = (x, y) => BAY[(y & 7) * 8 + (x & 7)];
export function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
export const rgb = (c, a) => (a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
export const shade = (c, m) => [clamp(c[0] * m, 0, 255), clamp(c[1] * m, 0, 255), clamp(c[2] * m, 0, 255)];
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export function shadeHex(h, m) { const c = shade(hex(h), m); return '#' + c.map((v) => (v | 0).toString(16).padStart(2, '0')).join(''); }
export function mixHex(a, b, t) { const c = mix(hex(a), hex(b), t); return '#' + c.map((v) => (v | 0).toString(16).padStart(2, '0')).join(''); }

// palettes: the quantisation targets (a cache maps a 15-bit colour to its nearest entry)
export function makePal(list) {
  const c = list.map(hex); let d = 0, best = 1e9;
  c.forEach((p, i) => { const l = p[0] + p[1] + p[2]; if (l < best) { best = l; d = i; } });
  return { c, dark: c[d], cache: new Int16Array(32768).fill(-1) };
}
export function qIdx(P, r, g, b) {
  r = clamp(r, 0, 255) | 0; g = clamp(g, 0, 255) | 0; b = clamp(b, 0, 255) | 0;
  const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); let i = P.cache[k];
  if (i < 0) { let bd = 1e9; i = 0; for (let n = 0; n < P.c.length; n++) { const p = P.c[n], dr = r - p[0], dg = g - p[1], db = b - p[2], d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; if (d < bd) { bd = d; i = n; } } P.cache[k] = i; }
  return i;
}

export class TB {
  // pad: an empty margin round the drawing (in output px), so nothing painted near the edge is cut off
  constructor(w, h, s, seed, pad = 0) { this.w = w | 0; this.h = h | 0; this.s = s || 4; this.p = pad | 0; this.W = (this.w + 2 * this.p) * this.s; this.H = (this.h + 2 * this.p) * this.s; this.c = mk(this.W, this.H); this.x = cx2d(this.c); this.hb = new Float32Array(this.W * this.H); this.r = RNG(seed || 1); this.x.lineCap = 'round'; this.x.lineJoin = 'round'; this.x.translate(this.p * this.s, this.p * this.s); }
  _hRegion(x0, y0, x1, y1, fn) {
    const s = this.s, W = this.W, H = this.H, p = this.p;
    const X0 = Math.max(0, Math.floor((x0 + p) * s)), Y0 = Math.max(0, Math.floor((y0 + p) * s)), X1 = Math.min(W, Math.ceil((x1 + p) * s)), Y1 = Math.min(H, Math.ceil((y1 + p) * s));
    for (let Y = Y0; Y < Y1; Y++) for (let X = X0; X < X1; X++) { const i = Y * W + X, v = fn((X + 0.5) / s - p, (Y + 0.5) / s - p, this.hb[i]); if (v !== undefined) this.hb[i] = v; }
  }
  fill(col, ht) { this.x.save(); this.x.setTransform(1, 0, 0, 1, 0, 0); this.x.fillStyle = col; this.x.fillRect(0, 0, this.W, this.H); this.x.restore(); if (ht !== undefined) this.hb.fill(ht); return this; }
  rect(x, y, w, h, col, ht, bev) {
    const s = this.s; if (col) { this.x.fillStyle = col; this.x.fillRect(x * s, y * s, w * s, h * s); }
    if (ht !== undefined && ht !== null) { bev = bev || 0; this._hRegion(x, y, x + w, y + h, (px, py) => { if (!bev) return ht; const e = Math.min(px - x, x + w - px, py - y, y + h - py); return ht * clamp(e / bev, 0, 1); }); }
    return this;
  }
  hrect(x, y, w, h, ht, bev, add) { this._hRegion(x, y, x + w, y + h, (px, py, o) => { const e = bev ? clamp(Math.min(px - x, x + w - px, py - y, y + h - py) / bev, 0, 1) : 1; return add ? o + ht * e : ht * e; }); }
  ell(cx, cy, rx, ry, col, ht, dome) {
    const s = this.s; if (col) { this.x.fillStyle = col; this.x.beginPath(); this.x.ellipse(cx * s, cy * s, Math.max(0.1, rx * s), Math.max(0.1, ry * s), 0, 0, 6.2832); this.x.fill(); }
    if (ht !== undefined && ht !== null) this._hRegion(cx - rx, cy - ry, cx + rx, cy + ry, (px, py, o) => { const d = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2; if (d > 1) return; const v = dome === false ? ht : ht * Math.sqrt(1 - d) + (dome === 'base' ? o : 0); return Math.max(o, v); });
    return this;
  }
  line(x0, y0, x1, y1, wd, col, ht) {
    const s = this.s; if (col) { this.x.strokeStyle = col; this.x.lineWidth = Math.max(0.5, wd * s); this.x.beginPath(); this.x.moveTo(x0 * s, y0 * s); this.x.lineTo(x1 * s, y1 * s); this.x.stroke(); }
    if (ht !== undefined && ht !== null) {
      const r = wd / 2, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
      this._hRegion(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (px, py, o) => { let t = ((px - x0) * dx + (py - y0) * dy) / L2; t = clamp(t, 0, 1); const d = Math.hypot(px - x0 - dx * t, py - y0 - dy * t); if (d > r) return; const v = ht >= 0 ? ht * Math.sqrt(1 - (d / r) ** 2) : ht; return ht >= 0 ? Math.max(o, v) : o + v; });
    }
    return this;
  }
  poly(pts, col) { const s = this.s; this.x.fillStyle = col; this.x.beginPath(); pts.forEach((p, i) => (i ? this.x.lineTo(p[0] * s, p[1] * s) : this.x.moveTo(p[0] * s, p[1] * s))); this.x.closePath(); this.x.fill(); return this; }
  grad(x, y, w, h, c0, c1, vert) { const s = this.s, g = vert === false ? this.x.createLinearGradient(x * s, 0, (x + w) * s, 0) : this.x.createLinearGradient(0, y * s, 0, (y + h) * s); g.addColorStop(0, c0); g.addColorStop(1, c1); this.x.fillStyle = g; this.x.fillRect(x * s, y * s, w * s, h * s); return this; }
  // per-pixel albedo modulation by tileable fbm, plus matching height grain
  grain(amt, sc, seed, hamt, period, mask) {
    const W = this.W, H = this.H, img = this.x.getImageData(0, 0, W, H), d = img.data, s = this.s;
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const i = Y * W + X; if (d[i * 4 + 3] < 8) continue;
      if (mask && !mask(X / s - this.p, Y / s - this.p)) continue;
      const u = X / s / sc, v = Y / s / sc, n = fbm(u, v, seed || 7, 3, period ? period / sc : 0) - 0.5, h = hash2(X, Y, seed || 7) - 0.5;
      const m = 1 + n * amt + h * amt * 0.35; d[i * 4] = clamp(d[i * 4] * m, 0, 255); d[i * 4 + 1] = clamp(d[i * 4 + 1] * m, 0, 255); d[i * 4 + 2] = clamp(d[i * 4 + 2] * m, 0, 255);
      if (hamt) this.hb[i] += n * hamt + h * hamt * 0.4;
    }
    this.x.putImageData(img, 0, 0); return this;
  }
  // scattered pebbles / blades / blotches, wrapped for tileable textures
  speck(n, cols, r0, r1, ht, wrapT, kind) {
    const r = this.r, w = this.w, h = this.h;
    for (let i = 0; i < n; i++) {
      const x = r.range(0, w), y = r.range(0, h), rr = r.range(r0, r1), c = r.pick(cols);
      const offs = wrapT ? [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]] : [[0, 0]];
      for (const [ox, oy] of offs) {
        const X = x + ox, Y = y + oy; if (X < -rr * 3 || Y < -rr * 3 || X > w + rr * 3 || Y > h + rr * 3) continue;
        if (kind === 'blade') this.line(X, Y, X + r.range(-0.6, 0.6), Y - rr * 2.4, Math.max(0.35, rr * 0.45), c, ht);
        else if (kind === 'crack') { let px = X, py = Y, a = r.range(0, 6.28); for (let k = 0; k < 5; k++) { const nx = px + Math.cos(a) * rr, ny = py + Math.sin(a) * rr; this.line(px, py, nx, ny, 0.4, c, -ht); px = nx; py = ny; a += r.range(-0.8, 0.8); } }
        else this.ell(X, Y, rr, rr * r.range(0.6, 1), c, ht);
      }
    }
    return this;
  }
  // light + crush. P = palette, o = { dither, light, amb, dif, outline, hs, alphaCut, keepAlpha, hlift }
  finish(P, o) {
    o = o || {}; const s = this.s, W = this.W, H = this.H, w = this.w + 2 * this.p, h = this.h + 2 * this.p;
    const src = this.x.getImageData(0, 0, W, H).data, hb = this.hb, lit = new Float32Array(W * H * 4);
    const L = [-0.48, -0.57, 0.66], k = s * 0.5 * (o.hs === undefined ? 1 : o.hs), amb = o.amb === undefined ? 0.5 : o.amb, dif = o.dif === undefined ? 0.62 : o.dif, doLight = o.light !== false;
    for (let Y = 0; Y < H; Y++) {
      const yu = Y > 0 ? Y - 1 : Y, yd = Y < H - 1 ? Y + 1 : Y;
      for (let X = 0; X < W; X++) {
        const i = Y * W + X, a = src[i * 4 + 3]; if (!a) continue; let l = 1;
        if (doLight) { const xl = X > 0 ? X - 1 : X, xr = X < W - 1 ? X + 1 : X, nx = (hb[Y * W + xl] - hb[Y * W + xr]) * k, ny = (hb[yu * W + X] - hb[yd * W + X]) * k, inv = 1 / Math.sqrt(nx * nx + ny * ny + 1); let d = (nx * L[0] + ny * L[1] + L[2]) * inv; if (d < 0) d = 0; l = amb + dif * d + (o.hlift ? hb[i] * o.hlift : 0); }
        lit[i * 4] = src[i * 4] * l; lit[i * 4 + 1] = src[i * 4 + 1] * l; lit[i * 4 + 2] = src[i * 4 + 2] * l; lit[i * 4 + 3] = a;
      }
    }
    const out = mk(w, h), ox = cx2d(out), img = ox.createImageData(w, h), d = img.data, dith = (o.dither === undefined ? 0.55 : o.dither) * 44, n2 = s * s;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const q = ((y * s + j) * W + x * s + i) * 4, aa = lit[q + 3]; r += lit[q] * aa; g += lit[q + 1] * aa; b += lit[q + 2] * aa; a += aa; }
      const q = (y * w + x) * 4; if (a <= 0) continue; r /= a; g /= a; b /= a; const al = a / n2 / 255, t = bay(x, y);
      if (o.keepAlpha !== true && al < (o.alphaCut === undefined ? 0.5 : o.alphaCut) + t * 0.6) continue;
      const bb = t * dith; const c = P ? P.c[qIdx(P, r + bb, g + bb, b + bb)] : [r, g, b];
      d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = o.keepAlpha === true ? Math.round(al * 255) : 255;
    }
    if (o.outline) {
      const oc = o.outline === true ? (P ? P.dark : [10, 10, 10]) : o.outline, src2 = new Uint8ClampedArray(d);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const q = (y * w + x) * 4; if (src2[q + 3]) continue;
        const on = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && src2[(yy * w + xx) * 4 + 3] > 0;
        if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { d[q] = oc[0]; d[q + 1] = oc[1]; d[q + 2] = oc[2]; d[q + 3] = 255; }
      }
    }
    ox.putImageData(img, 0, 0); out.data = d; out.pad = this.p; return out;
  }
}
// crush an already-drawn canvas into a palette with dither
export function crushCanvas(c, P, dith) {
  const x = cx2d(c), img = x.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width; dith = (dith === undefined ? 0.5 : dith) * 44;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) { d[i + 3] = 0; continue; }
    const p = i >> 2, X = p % w, Y = (p / w) | 0, t = bay(X, Y);
    if (d[i + 3] < 250 && d[i + 3] / 255 < 0.5 + t * 0.8) { d[i + 3] = 0; continue; }
    const c2 = P.c[qIdx(P, d[i] + t * dith, d[i + 1] + t * dith, d[i + 2] + t * dith)]; d[i] = c2[0]; d[i + 1] = c2[1]; d[i + 2] = c2[2]; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
export function flipH(c) { const o = mk(c.width, c.height), x = o.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return o; }
export function silhouette(c, col) { const o = mk(c.width, c.height), x = o.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, o.width, o.height); return o; }
