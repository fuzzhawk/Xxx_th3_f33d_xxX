// Rail Raider's pictures: everything painted in code at a low resolution, then sooted (grit, rust and
// soot blotches, colours dulled and dithered to a brass-and-coal palette) so the world reads as one
// gritty, pixelated steampunk piece. Wall and floor textures, billboard props, enemy frames, the far
// skyline layers for each stage. All cached.
import { mulberry32 } from '../util.js';

const cache = new Map();
const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = false; return [cv, c]; };
const px = (c, x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const ell = (c, x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, 7); c.fill(); };
const poly = (c, col, pts) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = (h, k) => { const [r, g, b] = hexRgb(h), f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hs = (x, y, k) => { let q = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
const blot = (x, y, s, k) => { const fx = x / s, fy = y / s, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, a = hs(x0, y0, k), b = hs(x0 + 1, y0, k), c = hs(x0, y0 + 1, k), d = hs(x0 + 1, y0 + 1, k), u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };

// soot: grit in every pixel, rust and soot blotches, colours pulled toward sepia and dithered to a
// coarse palette; glowing pixels (lamps, eyes, fire) keep their light
export function soot(cv, k = 1, seed = 1) {
  const c = cv.getContext('2d', { willReadFrequently: true }), w = cv.width, h = cv.height, im = c.getImageData(0, 0, w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y * w + x) * 4;
    if (d[j + 3] < 8) continue;
    let r = d[j], g = d[j + 1], b = d[j + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 220 && mx - mn > 80) continue;
    const lu = r * 0.3 + g * 0.59 + b * 0.11, t = 0.8 + 0.16 * hs(x, y, seed) + 0.16 * blot(x, y, 3, seed + 5);
    r = (lu + (r - lu) * 0.7) * t * 1.04; g = (lu + (g - lu) * 0.7) * t * 0.98; b = (lu + (b - lu) * 0.7) * t * 0.86;
    const ru = Math.max(0, (blot(x, y, 6, seed + 9) - 0.62) * 2.4) * k, so = Math.max(0, (blot(x, y, 5, seed + 13) - 0.6) * 2.2) * k;
    if (ru > 0) { const q = Math.min(0.6, ru); r += (128 - r) * q; g += (62 - g) * q; b += (28 - b) * q; }
    if (so > 0) { const q = Math.min(0.55, so); r += (22 - r) * q; g += (18 - g) * q; b += (14 - b) * q; }
    const bq = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 16;
    d[j] = Math.max(0, Math.min(255, Math.round((r + bq) / 16) * 16)); d[j + 1] = Math.max(0, Math.min(255, Math.round((g + bq) / 16) * 16)); d[j + 2] = Math.max(0, Math.min(255, Math.round((b + bq) / 16) * 16));
  }
  c.putImageData(im, 0, 0);
  return cv;
}

// ------------------------------------------------ wall, floor and ground textures (64×64, tiling)
export function tex(kind) {
  const key = `t|${kind}`;
  if (cache.has(key)) return cache.get(key);
  const [cv, c] = mk(64, 64), R = mulberry32(kind.length * 977 + kind.charCodeAt(0));
  const fill = (col) => px(c, 0, 0, col, 64, 64);
  if (kind === 'rock' || kind === 'coal') {
    fill(kind === 'coal' ? '#2a2420' : '#5a4a3c');
    for (let q = 0; q < 46; q++) { const x = R() * 64, y = R() * 64, r = 3 + R() * 8; ell(c, x, y, r, r * 0.7, shade(kind === 'coal' ? '#3a3430' : '#6a5a48', (R() - 0.5) * 0.4)); ell(c, x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.35, shade(kind === 'coal' ? '#4a4440' : '#7a6a54', 0.1)); }
    if (kind === 'coal') for (let q = 0; q < 30; q++) px(c, R() * 64, R() * 64, '#8a8a96', 1, 1);
    for (let q = 0; q < 6; q++) { let x = R() * 64, y = R() * 64; for (let s = 0; s < 14; s++) { px(c, x, y, '#1e1812'); x += R() < 0.5 ? 1 : 0; y += 1; } }
  } else if (kind === 'brick' || kind === 'soot') {
    fill('#3a2018');
    for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) { const x = col * 16 + (row % 2 ? 8 : 0), y = row * 8, b = shade(kind === 'soot' ? '#4a3028' : '#8a4a32', (R() - 0.5) * 0.3); px(c, x + 1, y + 1, b, 14, 6); px(c, x + 1, y + 1, shade(b, 0.18), 14, 1); if (x + 16 > 64) px(c, x + 1 - 64, y + 1, b, 14, 6); }
  } else if (kind === 'timber') {
    fill('#5a3e26');
    for (let x = 0; x < 64; x += 16) { px(c, x, 0, '#3a2814', 1, 64); for (let y = 0; y < 64; y += 3) px(c, x + 2 + (R() * 12 | 0), y, shade('#5a3e26', (R() - 0.5) * 0.4), 3, 1); }
    for (let q = 0; q < 5; q++) ell(c, R() * 64, R() * 64, 2, 1.4, '#2a1c10');
  } else if (kind === 'iron' || kind === 'brass') {
    const base = kind === 'iron' ? '#4a4c52' : '#8a6a2a';
    fill(base);
    for (let y = 0; y < 64; y += 32) for (let x = 0; x < 64; x += 32) { px(c, x, y, shade(base, 0.2), 32, 1); px(c, x, y, shade(base, 0.12), 1, 32); px(c, x + 31, y, shade(base, -0.35), 1, 32); px(c, x, y + 31, shade(base, -0.35), 32, 1); for (const [a, b] of [[3, 3], [28, 3], [3, 28], [28, 28], [15, 3], [15, 28]]) { px(c, x + a, y + b, shade(base, 0.45), 2, 2); px(c, x + a + 1, y + b + 1, shade(base, -0.4), 1, 1); } }
    for (let q = 0; q < 8; q++) ell(c, R() * 64, R() * 64, 2 + R() * 4, 1 + R() * 3, kind === 'iron' ? '#6a3a1a' : '#4a5a3a');
  } else if (kind === 'plank') {
    fill('#6a4a2c');
    for (let y = 0; y < 64; y += 8) { px(c, 0, y, '#3a2614', 64, 1); for (let x = 0; x < 64; x += 2) px(c, x, y + 1 + (R() * 6 | 0), shade('#6a4a2c', (R() - 0.5) * 0.3), 2, 1); px(c, (y * 7) % 60, y + 3, '#2a1c10', 2, 2); }
  } else if (kind === 'gravel') {
    fill('#4a443e');
    for (let q = 0; q < 380; q++) px(c, R() * 64, R() * 64, shade('#6a625a', (R() - 0.5) * 0.6), 1 + (R() < 0.3 ? 1 : 0), 1);
  } else if (kind === 'sand') {
    fill('#b88a58');
    for (let q = 0; q < 300; q++) px(c, R() * 64, R() * 64, shade('#b88a58', (R() - 0.5) * 0.35), 2, 1);
    for (let y = 4; y < 64; y += 9) for (let x = 0; x < 64; x++) px(c, x, y + Math.round(Math.sin(x * 0.2 + y) * 1.5), shade('#b88a58', -0.15), 1, 1);
  } else if (kind === 'slag') {
    fill('#2a201c');
    for (let q = 0; q < 40; q++) ell(c, R() * 64, R() * 64, 2 + R() * 5, 1 + R() * 3, shade('#3a2c24', (R() - 0.5) * 0.4));
    for (let q = 0; q < 12; q++) px(c, R() * 64, R() * 64, '#ff7a2a', 2, 1);
  } else if (kind === 'roof') {
    fill('#3a3438');
    for (let y = 0; y < 64; y += 6) for (let x = (y / 6) % 2 ? 4 : 0; x < 64; x += 8) { px(c, x, y, shade('#4a4248', (R() - 0.5) * 0.3), 7, 5); px(c, x, y + 5, '#1e1a1e', 8, 1); }
  } else { fill('#808080'); }
  soot(cv, 1, kind.length * 13);
  cache.set(key, cv);
  return cv;
}

// ------------------------------------------------ billboards: props and enemies (canvas per frame)
const ink = (c, cv) => {
  // a crisp dark outline round everything drawn
  const w = cv.width, h = cv.height, im = c.getImageData(0, 0, w, h), d = im.data, a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (a[i]) continue; if ((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) { d[i * 4] = 14; d[i * 4 + 1] = 10; d[i * 4 + 2] = 8; d[i * 4 + 3] = 255; } }
  c.putImageData(im, 0, 0);
};
export function sprite(kind, f = 0, v = 0) {
  const key = `s|${kind}|${f}|${v}`;
  if (cache.has(key)) return cache.get(key);
  let cv, c;
  const R = mulberry32(kind.length * 131 + v * 17 + 3), lit = (col) => col;
  switch (kind) {
    // ---- enemies
    case 'soldier': {
      // a clockwork trooper: brass helmet with a red lens, a greatcoat, a steam rifle
      [cv, c] = mk(26, 42);
      const coat = ['#3a4a32', '#4a3a2a', '#2e3a48'][v % 3];
      px(c, 8, 26, '#2a2420', 4, 14); px(c, 14, 26, '#2a2420', 4, 14); px(c, 7, 39, '#1a1410', 6, 3); px(c, 13, 39, '#1a1410', 6, 3);
      px(c, 6, 12, coat, 14, 16); px(c, 6, 12, shade(coat, 0.2), 2, 16); px(c, 6, 24, shade(coat, -0.2), 14, 4); px(c, 12, 12, '#c89a3a', 2, 14);
      for (const y of [15, 19, 23]) px(c, 10, y, '#e0c070', 1, 1);
      ell(c, 13, 7, 5.5, 6, '#b8903a'); px(c, 8, 9, '#8a6a2a', 11, 2); ell(c, 15, 7, 2, 2, '#ff3a2a'); px(c, 15, 6, '#ffd0a0');
      px(c, 12, 0, '#8a6a2a', 2, 2);
      if (f === 0) { px(c, 3, 14, coat, 4, 10); px(c, 1, 20, '#3a3430', 3, 12); }
      else { px(c, 18, 14, coat, 4, 4); px(c, 16, 16, '#3a3430', 10, 3); px(c, 24, 15, '#5a5a62', 2, 2); if (f === 2) { ell(c, 25, 16, 3, 3, '#ffe08a'); px(c, 24, 15, '#ffffff', 2, 2); } }
      break;
    }
    case 'bomber': {
      [cv, c] = mk(26, 42);
      px(c, 8, 26, '#3a2a20', 4, 14); px(c, 14, 26, '#3a2a20', 4, 14);
      px(c, 6, 12, '#5a3a24', 14, 16); px(c, 6, 12, '#7a5434', 2, 16); px(c, 6, 20, '#3a2418', 14, 2);
      ell(c, 13, 7, 5, 5.5, '#c8a07a'); px(c, 8, 2, '#3a2a1a', 11, 4); px(c, 6, 5, '#3a2a1a', 15, 1); px(c, 9, 7, '#2a1a10', 9, 2); px(c, 15, 7, '#ffd08a');
      if (f) { px(c, 18, 4, '#5a3a24', 3, 9); px(c, 18, 0, '#c82a1a', 4, 6); px(c, 20, -1, '#ffe08a', 1, 2); } else { px(c, 19, 14, '#5a3a24', 3, 8); px(c, 19, 20, '#c82a1a', 3, 6); }
      break;
    }
    case 'drone': {
      // a steam drone: a copper boiler-sphere with a red eye, a propeller turning over it
      [cv, c] = mk(30, 24);
      ell(c, 15, 15, 9, 8, '#a8643a'); ell(c, 13, 13, 6, 5, '#c8844a'); for (const y of [11, 18]) px(c, 6, y, '#6a3a1a', 18, 1);
      ell(c, 15, 16, 3, 3, '#2a1a12'); ell(c, 15, 16, 2, 2, '#ff3a2a'); px(c, 15, 15, '#ffd0a0');
      px(c, 14, 3, '#3a3430', 2, 5);
      const a = f * 0.9; for (let q = 0; q < 2; q++) { const an = a + q * Math.PI; px(c, 15 + Math.cos(an) * 12 - 3, 3 + Math.sin(an) * 1.5, '#8a8a94', 7, 2); }
      px(c, 4, 22, '#6a3a1a', 3, 2); px(c, 23, 22, '#6a3a1a', 3, 2);
      break;
    }
    case 'bat': {
      [cv, c] = mk(22, 14);
      ell(c, 11, 7, 3, 3.4, '#3a3430'); px(c, 10, 6, '#ff3a2a'); px(c, 12, 6, '#ff3a2a');
      if (f) { poly(c, '#5a4a3a', [[9, 7], [0, 1], [3, 9]]); poly(c, '#5a4a3a', [[13, 7], [22, 1], [19, 9]]); }
      else { poly(c, '#5a4a3a', [[9, 7], [0, 12], [4, 6]]); poly(c, '#5a4a3a', [[13, 7], [22, 12], [18, 6]]); }
      for (const x of [3, 19]) px(c, x, f ? 3 : 9, '#c89a3a', 1, 1);
      break;
    }
    case 'turret': {
      [cv, c] = mk(28, 26);
      px(c, 2, 14, '#3a3430', 24, 12); px(c, 2, 14, '#5a5458', 24, 2); ell(c, 14, 12, 8, 7, '#8a6a2a'); ell(c, 12, 10, 5, 4, '#b8903a');
      for (let q = 0; q < 3; q++) { const y = 9 + q * 3 + (f % 2); px(c, 18, y, '#4a4a52', 10, 2); }
      ell(c, 11, 12, 2, 2, '#ff3a2a');
      if (f === 2) { ell(c, 27, 12, 3, 4, '#ffe08a'); }
      break;
    }
    case 'handcar': {
      // a goon pumping a handcar along the next track over, a pistol in the other hand
      [cv, c] = mk(44, 36);
      px(c, 2, 24, '#3a2a1a', 40, 5); px(c, 2, 24, '#5a4028', 40, 1);
      for (const x of [8, 34]) { ell(c, x, 31, 4, 4, '#3a3430'); ell(c, x, 31, 1.5, 1.5, '#8a8a94'); }
      px(c, 20, 14, '#2a2420', 2, 10); const up = f % 2 ? -4 : 3; px(c, 10, 14 + up, '#5a5a62', 22, 2);
      px(c, 26, 8, '#5a3a24', 8, 14); ell(c, 30, 5, 4, 4, '#c8a07a'); px(c, 26, 2, '#2a1a10', 9, 3); px(c, 31, 5, '#ffd08a');
      px(c, 33, 12, '#5a3a24', 6, 3); px(c, 38, 11, '#4a4a52', 4, 2); if (f === 2) ell(c, 43, 12, 2, 2, '#ffe08a');
      break;
    }
    case 'dynamite': { [cv, c] = mk(10, 10); px(c, 2, 4, '#c82a1a', 6, 4); px(c, 2, 4, '#e84a3a', 6, 1); px(c, 5, 1, '#3a3430', 1, 3); px(c, 4 + f, 0, '#ffe08a', 2, 2); break; }
    case 'bolt': { [cv, c] = mk(12, 12); ell(c, 6, 6, 5, 5, f ? '#ff8a2a' : '#ffb24a'); ell(c, 6, 6, 3, 3, '#ffe8a0'); px(c, 5, 5, '#ffffff', 2, 2); return (cache.set(key, cv), cv); }
    case 'core': { [cv, c] = mk(16, 16); ell(c, 8, 8, 7.5, 7.5, '#3a2a1a'); ell(c, 8, 8, 6, 6, f ? '#ffb24a' : '#ff6a1a'); ell(c, 8, 8, 3.5, 3.5, '#ffe8a0'); px(c, 7, 6, '#ffffff', 2, 2); return (cache.set(key, cv), cv); }
    // ---- bosses (their glowing cores are separate targets)
    case 'ironclad': {
      // an armoured locomotive: riveted plate, a ram, a turret on top, three boilers glowing through
      [cv, c] = mk(140, 76);
      px(c, 8, 26, '#3a3c42', 124, 34); px(c, 8, 26, '#5a5c62', 124, 3); for (let x = 12; x < 130; x += 10) for (const y of [30, 40, 50]) px(c, x, y, '#8a8c92', 2, 2);
      poly(c, '#2a2c30', [[132, 30], [140, 60], [124, 60]]); px(c, 56, 8, '#4a4c52', 30, 18); px(c, 82, 14, '#3a3c42', 30, 5); px(c, 22, 6, '#2a2420', 10, 20); px(c, 20, 4, '#3a3430', 14, 3);
      for (let x = 14; x < 132; x += 18) { ell(c, x, 64, 9, 9, '#2a2420'); ell(c, x, 64, 6, 6, '#a82a1a'); ell(c, x, 64, 2, 2, '#c8c8d0'); }
      px(c, 8, 58, '#5a5c62', 124, 2); if (f) for (let q = 0; q < 6; q++) px(c, 112 + q * 3, 14 + (q % 2), '#ffe08a', 2, 2);
      break;
    }
    case 'spider': {
      [cv, c] = mk(128, 92);
      for (const s of [-1, 1]) for (let l = 0; l < 3; l++) { const x0 = 64 + s * 20, y0 = 40, x1 = 64 + s * (44 + l * 10), y1 = 14 + l * 6, x2 = 64 + s * (52 + l * 8), y2 = 88 - (f && l === 1 ? 6 : 0); c.strokeStyle = '#4a4448'; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = '#8a6a2a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
      ell(c, 64, 46, 30, 22, '#3a3c42'); ell(c, 60, 40, 24, 14, '#5a5c62'); for (let x = 40; x < 90; x += 8) px(c, x, 54, '#8a8c92', 2, 2);
      ell(c, 64, 30, 14, 10, '#4a4c52'); px(c, 52, 28, '#ff3a2a', 24, 3); px(c, 62, 16, '#2a2420', 4, 14);
      break;
    }
    case 'airship': {
      [cv, c] = mk(160, 80);
      ell(c, 80, 26, 72, 22, '#6a5a48'); ell(c, 76, 20, 64, 14, '#8a7a62'); for (let x = 14; x < 150; x += 12) px(c, x, 8, '#4a3e30', 1, 36);
      poly(c, '#4a3e30', [[8, 26], [0, 10], [0, 42]]); px(c, 40, 46, '#3a2a1a', 80, 18); px(c, 40, 46, '#5a4028', 80, 2);
      for (let x = 46; x < 116; x += 12) px(c, x, 52, f ? '#ffe08a' : '#2a2c3a', 6, 5);
      for (const x of [44, 108]) { px(c, x, 62, '#4a4a52', 4, 10); }
      const a = f * 1.3; for (const x of [152]) for (let q = 0; q < 2; q++) px(c, x - 2, 26 + Math.sin(a + q * 3) * 14 - 2, '#8a8a94', 6, 3);
      break;
    }
    // ---- props
    case 'lantern': { [cv, c] = mk(12, 32); px(c, 5, 10, '#2a2420', 2, 22); px(c, 3, 30, '#2a2420', 6, 2); poly(c, '#2a2420', [[2, 3], [10, 3], [8, 0], [4, 0]]); px(c, 3, 3, '#ffd88a', 6, 7); px(c, 5, 5, '#fff6d8', 2, 3); px(c, 2, 10, '#2a2420', 8, 1); break; }
    case 'minecart': { [cv, c] = mk(30, 22); poly(c, '#5a4a3a', [[1, 6], [29, 6], [25, 18], [5, 18]]); px(c, 1, 6, '#8a7a6a', 28, 2); for (let q = 0; q < 9; q++) ell(c, 5 + q * 2.5, 6, 2.4, 2, q % 2 ? '#1e1c20' : '#34323a'); for (const x of [8, 22]) { ell(c, x, 19, 3, 3, '#3a3a42'); ell(c, x, 19, 1, 1, '#8a8a94'); } break; }
    case 'crate': { [cv, c] = mk(18, 18); px(c, 1, 1, '#7a5430', 16, 16); px(c, 1, 1, '#9a7448', 16, 2); for (const y of [6, 11]) px(c, 1, y, '#4a3018', 16, 1); c.strokeStyle = '#4a3018'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(2, 2); c.lineTo(16, 16); c.stroke(); const mark = ['#d82a2a', '#3a8ad8', '#e8c020', '#7ad04a'][v % 4]; ell(c, 9, 9, 3.5, 3.5, mark); px(c, 8, 7, '#ffffff', 2, 4); px(c, 7, 8, '#ffffff', 4, 2); break; }
    case 'barrel': { [cv, c] = mk(16, 20); px(c, 2, 2, '#5a2a1c', 12, 17); px(c, 3, 2, '#8a3a22', 4, 17); for (const y of [3, 10, 17]) px(c, 1, y, '#2a2420', 14, 2); px(c, 5, 12, '#e8c020', 6, 3); px(c, 7, 12, '#161616', 2, 3); break; }
    case 'pillar': { [cv, c] = mk(24, 72); px(c, 6, 0, '#4a4c52', 12, 72); px(c, 6, 0, '#6a6c72', 3, 72); px(c, 15, 0, '#2a2c30', 3, 72); for (let y = 6; y < 72; y += 14) { px(c, 4, y, '#8a6a2a', 16, 3); for (const x of [6, 11, 16]) px(c, x, y + 1, '#e0c070', 1, 1); } px(c, 18, 10, '#b8743a', 4, 60); px(c, 18, 10, '#e0a05a', 1, 60); break; }
    case 'gear': { [cv, c] = mk(48, 48); const r = 20, n = 12; c.fillStyle = '#6a5228'; for (let t = 0; t < n; t++) { c.save(); c.translate(24, 24); c.rotate((t / n) * 6.2832); c.fillRect(r - 3, -3, 7, 6); c.restore(); } ell(c, 24, 24, r, r, '#a8803a'); ell(c, 24, 24, r - 4, r - 4, '#8a6a2a'); for (let s = 0; s < 5; s++) { c.save(); c.translate(24, 24); c.rotate((s / 5) * 6.2832); c.fillStyle = '#5a4420'; c.fillRect(4, -2.5, r - 8, 5); c.restore(); } ell(c, 24, 24, 5, 5, '#d8b05a'); ell(c, 24, 24, 2, 2, '#2a2018'); break; }
    case 'piston': { [cv, c] = mk(22, 56); const y = [0, 6, 12, 6][f % 4]; px(c, 3, 30, '#4a3a2a', 16, 24); px(c, 3, 30, '#6a5a3a', 16, 2); px(c, 9, 6 + y, '#c8ccd4', 4, 26 - y); px(c, 9, 6 + y, '#ffffff', 1, 26 - y); px(c, 5, y, '#b8903a', 12, 7); px(c, 1, 52, '#2a2018', 20, 4); break; }
    case 'boiler': { [cv, c] = mk(32, 52); px(c, 4, 8, '#7a4a2a', 24, 40); px(c, 4, 8, '#9a6a3a', 5, 40); px(c, 23, 8, '#5a3420', 5, 40); ell(c, 16, 8, 12, 5, '#b8743a'); px(c, 14, 0, '#5a3420', 4, 6); for (const y of [16, 28, 40]) { px(c, 4, y, '#c89a4a', 24, 2); } ell(c, 11, 22, 3.6, 3.6, '#f0e8d8'); px(c, 11, 20, '#c83a2a', 1, 2); px(c, 9, 42, '#2a1a12', 14, 6); px(c, 10, 43, '#ffb24a', 12, 4); break; }
    case 'chimney': { [cv, c] = mk(24, 110); px(c, 6, 0, '#6a3424', 12, 110); px(c, 6, 0, '#8a4a34', 3, 110); px(c, 15, 0, '#4a2418', 3, 110); for (let y = 4; y < 110; y += 4) px(c, 6, y, '#4a2418', 12, 1); px(c, 4, 0, '#2a2420', 16, 4); px(c, 4, 20, '#2a2420', 16, 3); break; }
    case 'facade': {
      // a sooty brick block of the smog city, its windows lit or dark, a water tank or a chimney on top
      [cv, c] = mk(64, 128); const b = ['#6a3a2a', '#5a4a3a', '#7a4a32', '#4a4048'][v % 4];
      px(c, 0, 16, b, 64, 112); for (let y = 18; y < 128; y += 3) px(c, 0, y, shade(b, -0.2), 64, 1);
      for (let y = 24; y < 120; y += 14) for (let x = 6; x < 58; x += 12) { px(c, x - 1, y - 1, '#c8b8a0', 8, 10); px(c, x, y, R() < 0.35 ? '#ffd88a' : '#1e1c24', 6, 8); px(c, x + 3, y, '#c8b8a0', 1, 8); }
      if (v % 2) { px(c, 40, 2, '#5a4a3a', 14, 14); px(c, 42, 0, '#3a3430', 10, 3); for (const x of [41, 51]) px(c, x, 16, '#3a3430', 2, 4); } else { px(c, 10, 0, '#6a3424', 8, 18); px(c, 8, 0, '#2a2420', 12, 3); }
      px(c, 0, 16, shade(b, 0.2), 64, 2);
      break;
    }
    case 'skyship': { [cv, c] = mk(80, 36); ell(c, 40, 13, 34, 11, '#5a5048'); ell(c, 38, 10, 30, 7, '#7a6a5a'); px(c, 24, 24, '#3a2a1a', 30, 8); for (let x = 27; x < 52; x += 6) px(c, x, 27, '#ffd88a', 3, 3); poly(c, '#4a3e30', [[6, 13], [0, 4], [0, 22]]); break; }
    case 'mesa': { [cv, c] = mk(64, 80); poly(c, '#a8583a', [[6, 80], [12, 14], [52, 10], [58, 80]]); px(c, 12, 10, '#c8784a', 40, 6); for (let y = 20; y < 80; y += 9) px(c, 10, y, '#8a4a2a', 46, 2); break; }
    case 'cactus': { [cv, c] = mk(18, 34); px(c, 7, 2, '#4a7a3a', 5, 32); px(c, 7, 2, '#6a9a5a', 2, 32); px(c, 2, 10, '#4a7a3a', 3, 10); px(c, 2, 18, '#4a7a3a', 7, 3); px(c, 13, 6, '#4a7a3a', 3, 10); px(c, 10, 14, '#4a7a3a', 6, 3); break; }
    case 'spire': { [cv, c] = mk(32, 72); poly(c, '#7a4a32', [[4, 72], [12, 8], [20, 2], [28, 72]]); poly(c, '#9a5a3a', [[8, 72], [14, 10], [16, 72]]); for (let y = 16; y < 72; y += 10) px(c, 8, y, '#5a3420', 18, 2); break; }
    case 'chains': { [cv, c] = mk(10, 80); for (let y = 0; y < 80; y += 5) { ell(c, 5, y + 2, 2.6, 2.4, '#6a6a72'); ell(c, 5, y + 2, 1.2, 1, '#2a2a30'); } break; }
    case 'smoke': { [cv, c] = mk(32, 32); for (let q = 0; q < 6; q++) ell(c, 10 + R() * 12, 10 + R() * 12, 6 + R() * 5, 5 + R() * 4, `rgba(${60 + (R() * 30 | 0)},${56 + (R() * 26 | 0)},${50 + (R() * 20 | 0)},.55)`); return (cache.set(key, cv), cv); }
    case 'flash': { [cv, c] = mk(24, 24); ell(c, 12, 12, 11, 11, 'rgba(255,170,60,.6)'); ell(c, 12, 12, 7, 7, '#ffd88a'); ell(c, 12, 12, 3, 3, '#ffffff'); return (cache.set(key, cv), cv); }
    case 'scrap': { [cv, c] = mk(8, 8); px(c, 1, 2, ['#b8903a', '#5a5a62', '#8a6a2a'][v % 3], 5, 3); px(c, 3, 1, '#d8b05a', 2, 5); return (cache.set(key, cv), cv); }
    default: [cv, c] = mk(8, 8); px(c, 0, 0, '#f0f', 8, 8);
  }
  void lit;
  soot(cv, 0.8, kind.length * 7 + v);
  ink(c, cv);
  cache.set(key, cv);
  return cv;
}

// ------------------------------------------------ far layers: a ring of skyline round each stage
// (panoramas 512 wide, tiling round the horizon; transparent above the silhouettes)
export function pano(theme, layer) {
  const key = `p|${theme}|${layer}`;
  if (cache.has(key)) return cache.get(key);
  const [cv, c] = mk(512, 128), R = mulberry32(theme.length * 101 + layer * 7);
  const far = layer === 0, col = { city: ['#5a5a48', '#3e3e34', '#2a2a24'], canyon: ['#c8906a', '#a8664a', '#7a4430'], foundry: ['#4a2418', '#3a1a10', '#2a120a'], mine: ['#2a201a', '#201812', '#18120e'], clock: ['#4a3a1a', '#3a2c14', '#2a200e'] }[theme][layer];
  if (theme === 'canyon') {
    // buttes and mesas: flat tops, sheer sides with ledges, a band of lighter rock near the top
    let y = 92 - layer * 8;
    for (let x = 0; x < 512; x += 2) { y += (R() - 0.5) * 3; y = Math.max(70, Math.min(110, y)); px(c, x, y, col, 2, 128 - y); }
    for (let q = 0; q < 6 - layer; q++) {
      const x = R() * 470, w = 30 + R() * 70, t = 26 + R() * 34 + layer * 8;
      for (let xx = 0; xx < w; xx++) { const e = Math.min(xx, w - xx), tt = t + (e < 6 ? (6 - e) * 3 : 0) + (R() < 0.08 ? 2 : 0); px(c, x + xx, tt, col, 1, 128 - tt); }
      px(c, x + 6, t, shade(col, 0.18), w - 12, 2); for (let k = 0; k < 3; k++) px(c, x + 4, t + 10 + k * 12, shade(col, -0.12), w - 8, 1);
    }
  } else if (theme === 'city') {
    // smokestacks, roofs, gasometers and a crane against the smog
    for (let x = 0; x < 512;) { const w = 14 + R() * 30, t = 40 + R() * 50 - (far ? 0 : 10); px(c, x, t, col, w, 128); if (R() < 0.4) { const sx = x + R() * w; px(c, sx, t - 30 - R() * 30, col, 5, 60); } if (R() < 0.15) { ell(c, x + w / 2, t, w / 2, 6, col); } for (let q = 0; q < (far ? 3 : 6); q++) if (R() < 0.5) px(c, x + 3 + R() * (w - 6), t + 6 + R() * 50, far ? '#8a7a4a' : '#c8a050', 2, 2); x += w + R() * 4; }
  } else {
    // underground: no sky; the far dark is broken by girders and the glow of furnaces
    for (let x = 0; x < 512; x += 20 + R() * 30) { px(c, x, 0, col, 6, 128); px(c, x - 4, 0, col, 14, 6); }
    for (let q = 0; q < 6; q++) ell(c, R() * 512, 100 + R() * 20, 20 + R() * 30, 6, theme === 'mine' ? 'rgba(120,80,40,.25)' : 'rgba(255,110,40,.35)');
  }
  cache.set(key, cv);
  return cv;
}
export { shade };
