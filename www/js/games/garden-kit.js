// Shared pixel-art helpers for the garden: small canvases, crisp ellipses, colour maths, the retro
// outline, and hash noise. Used by the world (garden-world.js), the art (garden-art.js) and the
// dream additions (garden-dream.js).
// smooth value noise from a hash (no tables): for wiggling the borders between kinds of country
export function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function mk(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; }
export function ell(c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) c.fillRect(x, y, 1, 1);
  }
}
export const px = (c, x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
// colours as #rrggbb in and out (rgb(...) is read too), so tints can be chained
export const rgbOf = (c) => (c[0] === '#' ? (() => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; })() : c.match(/\d+/g).slice(0, 3).map(Number));
export const hexOf = (r, g, b) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
export function tone(c, f) {
  const m = (v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return hexOf(...rgbOf(c).map(m));
}
export function mixHex(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  return hexOf(...A.map((v, k) => Math.round(v * (1 - t) + B[k] * t)));
}

// retro finish for a sprite: hard pixel edges (no soft alpha) and a dark one-pixel outline
export function crisp(cv, outline = 'rgba(38,28,44,.92)') {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, src = c.getImageData(0, 0, w, h), d = src.data;
  const big = mk(w + 2, h + 2), out = big[1].createImageData(w + 2, h + 2), o = out.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] >= 110;
  const [or, og, ob, oa] = outline.match(/[\d.]+/g).map(Number);
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const j = ((y + 1) * (w + 2) + (x + 1)) * 4;
    if (solid(x, y)) { const i = (y * w + x) * 4; o[j] = d[i]; o[j + 1] = d[i + 1]; o[j + 2] = d[i + 2]; o[j + 3] = 255; }
    else {
      // selective outline: a deep shade of whatever it borders, pulled toward the ink colour, so thin stems stay green
      let n = 0, r = 0, g = 0, bl = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (solid(x + dx, y + dy)) { const i = ((y + dy) * w + x + dx) * 4; r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; }
      if (!n) continue;
      o[j] = Math.round(r / n * 0.3 + or * 0.45); o[j + 1] = Math.round(g / n * 0.3 + og * 0.45); o[j + 2] = Math.round(bl / n * 0.3 + ob * 0.45); o[j + 3] = Math.round((oa ?? 1) * 255);
    }
  }
  big[1].putImageData(out, 0, 0);
  return big[0];
}
// a soft round glow, cached by colour and radius: drawn with 'lighter' it is a light in the world
// (far cheaper than a new gradient every frame)
const glows = new Map();
export function glowSprite(col, r) {
  r = Math.max(4, Math.round(r / 4) * 4);
  const key = `${col}|${r}`;
  let cv = glows.get(key);
  if (cv) return cv;
  let c; [cv, c] = mk(r * 2, r * 2);
  const [R, G, B] = rgbOf(col), g = c.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `rgba(${R},${G},${B},.85)`); g.addColorStop(0.35, `rgba(${R},${G},${B},.38)`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
  c.fillStyle = g; c.fillRect(0, 0, r * 2, r * 2);
  glows.set(key, cv);
  if (glows.size > 240) glows.delete(glows.keys().next().value);
  return cv;
}
// more colour: push a colour's saturation (k > 0) keeping its lightness
export function vivid(col, k) {
  const [r, g, b] = rgbOf(col), m = (r + g + b) / 3, f = (v) => Math.max(0, Math.min(255, Math.round(m + (v - m) * (1 + k))));
  return hexOf(f(r), f(g), f(b));
}
