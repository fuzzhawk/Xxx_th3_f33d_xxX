// Hell Maze's grime for monster sprites, over raw RGBA pixels: shared by the game and by the horror
// forge's worker (which draws monster frames off the main thread), so it lives in its own module.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// the creatures made dirtier: grit in every pixel, blotches of filth and dried blood (thicker low
// down, where it splashes), colours dulled and dithered to the levels' palette, darker toward the
// feet. Eyes and anything glowing keep their light. Done once per frame of each sheet, kept.
// the noise is worked out once (128×128, more than any sheet's frame) and only looked up after
let GRIT_F = null;
function gritField() {
  if (GRIT_F) return GRIT_F;
  const N = 128, hs = (x, y, k) => { let q = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  const blot = (x, y, sz, k) => { const fx = x / sz, fy = y / sz, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, a = hs(x0, y0, k), b = hs(x0 + 1, y0, k), c = hs(x0, y0 + 1, k), e = hs(x0 + 1, y0 + 1, k); return a + (b - a) * tx + (c - a) * ty + (a - b - c + e) * tx * ty; };
  const tex = new Float32Array(N * N), dirt = new Float32Array(N * N), gore = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; tex[i] = 0.78 + 0.2 * hs(x, y, 7) + 0.22 * blot(x, y, 3, 11); dirt[i] = clamp((blot(x, y, 5, 23) - 0.6) * 2.6, 0, 0.55); gore[i] = blot(x, y, 4, 37); }
  return (GRIT_F = { N, tex, dirt, gore });
}
// the grime and the meltdown over raw RGBA pixels, in place
// o (all optional, Hell Maze's monsters use the defaults): gore (dried blood, 1), sat (how much colour
// is kept, 0.62), levels (the colour steps, 14), shade (darker toward the foot, 1), melt (the share of
// columns that slump, 0.34). Bladeview's walls use it with no gore and a thinner melt.
export function grimePixels(d, w, h, o = {}) {
  const F = gritField(), N = F.N, gk = o.gore ?? 1, sat = o.sat ?? 0.62, lv = o.levels ?? 14, sk = o.shade ?? 1;
  for (let y = 0; y < h; y++) {
    const v = y / h, shade = 1 + (0.06 - 0.32 * v) * sk, gv = v * 0.18 - 0.7, row = (y % N) * N;
    for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4;
      if (d[j + 3] < 8) continue;
      let r = d[j], g = d[j + 1], b = d[j + 2];
      const mx = r > g ? (r > b ? r : b) : g > b ? g : b, mn = r < g ? (r < b ? r : b) : g < b ? g : b;
      if (mx > 215 && mx - mn > 90) continue;   // a glowing eye or ember: leave it lit
      const i = row + (x % N), lu = r * 0.3 + g * 0.59 + b * 0.11, k = F.tex[i] * shade;
      r = (lu + (r - lu) * sat) * k; g = (lu + (g - lu) * sat) * k; b = (lu + (b - lu) * sat) * k;
      const dt2 = F.dirt[i];
      if (dt2 > 0) { r += (30 - r) * dt2; g += (24 - g) * dt2; b += (18 - b) * dt2; }
      const gr = (F.gore[i] + gv) * 3 * gk;
      if (gr > 0) { const q = gr > 0.7 ? 0.7 : gr; r += (74 - r) * q; g += (8 - g) * q; b += (10 - b) * q; }
      const bq = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 14;
      d[j] = clamp(Math.round((r + bq) / lv) * lv, 0, 255); d[j + 1] = clamp(Math.round((g + bq) / lv) * lv, 0, 255); d[j + 2] = clamp(Math.round((b + bq) / lv) * lv, 0, 255);
    }
  }
  melt(d, w, h, o.melt ?? 0.34);
}
// The meltdown: in about a third of the columns the lower part of each run of body slumps, its pixels
// sorted by brightness so the light sinks to the bottom (pixel sorting, run downward), and now and
// then it runs on past the body as a drip a few pixels long. Glowing pixels (eyes) are left where they are.
function melt(d, w, h, share = 0.34) {
  const hs = (a, b) => { let q = (a * 374761393 + b * 668265263 + 0x51ed) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  const lum = (j) => d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11, hot = (j) => { const mx = Math.max(d[j], d[j + 1], d[j + 2]), mn = Math.min(d[j], d[j + 1], d[j + 2]); return mx > 215 && mx - mn > 90; };
  const seg = [];
  for (let x = 0; x < w; x++) {
    if (hs(x, w) > share) continue;
    let y = 0, run = 0;
    while (y < h) {
      while (y < h && d[(y * w + x) * 4 + 3] < 8) y++;
      const y0 = y;
      while (y < h && d[(y * w + x) * 4 + 3] >= 8) y++;
      const y1 = y, len = y1 - y0;
      run++;
      if (len < 5) continue;
      const s0 = y0 + Math.floor(len * (0.3 + 0.45 * hs(x, run * 7 + y0))), s1 = y1 - 1;   // the last pixel is the outline: it stays at the edge
      if (s1 - s0 < 3) continue;
      seg.length = 0;
      let skip = false;
      for (let q = s0; q < s1; q++) { const j = (q * w + x) * 4; if (hot(j)) { skip = true; break; } seg.push([lum(j), d[j], d[j + 1], d[j + 2]]); }
      if (skip) continue;
      seg.sort((a, b) => a[0] - b[0]);
      for (let q = s0; q < s1; q++) { const j = (q * w + x) * 4, c = seg[q - s0]; d[j] = c[1]; d[j + 1] = c[2]; d[j + 2] = c[3]; }
      // a drip off the bottom of it, darker as it goes, ending in ink
      if (y1 < h * 0.86 && hs(x, y1 * 3 + run) < 0.45) {
        const n = 1 + Math.floor(hs(x + 11, y1) * 4), c = seg[seg.length - 1];
        for (let k = 0; k < n && y1 + k < h; k++) { const j = ((y1 + k) * w + x) * 4; if (d[j + 3] >= 8) break; const f = k === n - 1 ? 0.18 : 0.75 - k * 0.12; d[j] = c[1] * f; d[j + 1] = c[2] * f; d[j + 2] = c[3] * f; d[j + 3] = 255; }
      }
    }
  }
}
