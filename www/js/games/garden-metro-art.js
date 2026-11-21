// The metropolis's pictures, drawn in code and cached like the rest of the garden's art:
//   bldgSprite   the districts' buildings: glass megatowers and needle spires in the centre; brick
//                rowhouses, shops and a clock tower in the old town; factories with sawtooth roofs,
//                warehouses, gasometers, silos, smokestacks, cranes and cooling towers in the
//                ironworks; little houses with gardens in the suburbs; the stations
//   trainSprite  the steam train: locomotive, tender and coaches, side-on (facing right) and from
//                above going up or down the screen
//   worksSprite  the machinery under the city: great gears (eight frames of turning), pistons,
//                boilers, furnaces, valves, tanks, coal carts and heaps, steam vents, gas lamps, safes
// Every building is drawn the way the neon towers are: its roof seen from above, its front below,
// standing on its footprint's front row.
import { mulberry32 } from '../util.js';
import { mk, ell, px, tone, crisp } from './garden-kit.js';

const cache = new Map();
const memo = (key, fn) => { let s = cache.get(key); if (!s) { const cv = fn(); s = { cv, w: cv.width, h: cv.height }; cache.set(key, s); } return s; };
const poly = (c, col, pts) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
const INK = 'rgba(16,12,20,.92)';

// window grids: lit warm, lit cool, or dark (a lit building at dusk shows more of them)
function windows(c, R, x0, y0, w, h, cw, ch, gx, gy, lit, cols = ['#ffe9a8', '#bfe8ff', '#2a2c40']) {
  for (let y = y0; y + ch <= y0 + h; y += ch + gy) for (let x = x0; x + cw <= x0 + w; x += cw + gx) {
    const r = R(), on = r < (lit ? 0.62 : 0.22);
    px(c, x, y, on ? (r < 0.12 ? cols[1] : cols[0]) : cols[2], cw, ch);
    if (on && cw > 1) px(c, x, y, '#ffffff', 1, 1);
  }
}

// ------------------------------------------------ buildings
export const BLDG_H = { glass: [110, 190], spire: [150, 220], brick: [26, 40], shop: [24, 30], clock: [70, 78], factory: [32, 42], warehouse: [22, 28], gasometer: [34, 44], silo: [46, 56], chimney: [70, 90], crane: [56, 64], cooling: [48, 56], villa: [18, 24], station: [52, 56], halt: [22, 24] };
export function bldgSprite(k, v, wT, dT, hPx, lit = 0) {
  return memo(`b|${k}|${v}|${wT}|${dT}|${hPx}|${lit}`, () => {
    const R = mulberry32(v * 7919 + wT * 31 + hPx * 3 + k.length), W = wT * 16, roofH = Math.max(8, dT * 8 - 4), H = hPx + roofH, [cv, c] = mk(W, H + 10);
    const top = 10, face = top + roofH, foot = H + 10;
    const roof = (col, rim = tone(col, 0.35)) => { px(c, 0, top, col, W, roofH); px(c, 0, top, rim, W, 1); px(c, 0, top, tone(col, 0.2), 1, roofH); px(c, W - 1, top, tone(col, -0.15), 1, roofH); };
    const front = (col) => { px(c, 0, face, col, W, hPx); px(c, 0, face, tone(col, 0.18), 1, hPx); px(c, W - 2, face, tone(col, -0.3), 2, hPx); };
    if (k === 'glass' || k === 'spire') {
      // the centre: glass curtain walls with mullions and sky lobbies of light, a crown or a needle
      const sch = [['#2a6a8a', '#5ac8e8', '#9ff0ff'], ['#3a4a8a', '#7a9ae8', '#c8d8ff'], ['#8a6a2a', '#e8c05a', '#fff0b0'], ['#4a5a6a', '#a8b8c8', '#f0f8ff']][v % 4];
      roof(tone(sch[0], 0.3));
      if (k === 'spire') { px(c, W / 2 - 1, 0, '#c8d0d8', 2, top + 2); px(c, W / 2 - 1, 0, '#ff4a4a', 2, 2); }
      else { ell(c, W / 2, top + roofH / 2, Math.min(W / 2 - 3, 9), roofH / 2 - 2, tone(sch[0], 0.5)); ell(c, W / 2, top + roofH / 2, Math.min(W / 2 - 6, 6), Math.max(1, roofH / 2 - 4), tone(sch[0], 0.15)); px(c, 3, 2, '#8a92a0', 1, top); px(c, 2, 1, '#ff4a4a', 3, 2); }
      for (let y = face; y < foot - 8; y++) { const u = (y - face) / hPx; px(c, 0, y, u < 0.5 ? sch[0] : tone(sch[0], -0.12), W, 1); }
      // reflections: diagonal bands of sky across the glass
      for (let b = 0; b < 3; b++) { const y0 = face + 10 + b * (hPx / 3); for (let q = 0; q < W; q++) px(c, q, Math.round(y0 + q * 0.6), sch[1], 1, 6 - b); }
      for (let x = 3; x < W - 2; x += 4) px(c, x, face, tone(sch[0], -0.35), 1, hPx - 8);
      for (let y = face + 4; y < foot - 10; y += 5) for (let x = 1; x < W - 2; x += 4) if (R() < (lit ? 0.5 : 0.15)) px(c, x + 1, y, lit ? '#fff2c0' : sch[2], 2, 2);
      for (let y = face + 26; y < foot - 16; y += 34) { px(c, 0, y, sch[2], W, 2); px(c, 0, y + 2, tone(sch[0], -0.4), W, 1); }
      if (k === 'spire') for (let s = 0; s < 3; s++) px(c, 0, face + 8 + s * 30, '#e8eef6', W, 1);
      px(c, 0, foot - 10, '#1e2430', W, 10); px(c, 2, foot - 8, sch[2], W - 4, 6); px(c, W / 2 - 3, foot - 8, '#0c1018', 6, 8);
      return crisp(cv, INK);
    }
    if (k === 'brick' || k === 'shop' || k === 'clock') {
      const brick = ['#8a3e2a', '#9a5a3a', '#7a4a3a', '#a86a4a', '#6a5a52'][v % 5], slate = ['#4a4a58', '#5a4a48', '#3e4450'][v % 3];
      roof(k === 'clock' ? '#6a6a72' : slate);
      for (let q = 0; q < Math.max(1, wT - 1); q++) { const x = 3 + q * 14 + (R() * 4 | 0); px(c, x, top - 6, brick, 5, 8); px(c, x, top - 7, '#3a2a24', 5, 2); px(c, x + 1, top - 9, '#b86a4a', 1, 2); px(c, x + 3, top - 9, '#b86a4a', 1, 2); }
      if (k === 'clock') {
        // a stone clock tower: the face with its hands, a lantern and a pointed roof
        px(c, 0, face, '#9a9088', W, hPx); px(c, 0, face, '#b8b0a6', 2, hPx); px(c, W - 2, face, '#6a625a', 2, hPx);
        poly(c, '#4a4a58', [[0, face], [W / 2, top - 8], [W, face]]); px(c, W / 2 - 1, top - 12, '#d8b05a', 2, 5);
        ell(c, W / 2, face + 16, 10, 10, '#3a342e'); ell(c, W / 2, face + 16, 8.5, 8.5, '#f4ecd8');
        for (let q = 0; q < 12; q++) { const a = (q / 12) * 6.283; px(c, Math.round(W / 2 + Math.cos(a) * 7), Math.round(face + 16 + Math.sin(a) * 7), '#3a342e', 1, 1); }
        c.strokeStyle = '#2a2420'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(W / 2, face + 16); c.lineTo(W / 2 + 4, face + 13); c.moveTo(W / 2, face + 16); c.lineTo(W / 2 - 1, face + 10); c.stroke();
        for (let y = face + 32; y < foot - 12; y += 12) { px(c, W / 2 - 3, y, lit ? '#ffd98a' : '#2a2c3a', 6, 7); px(c, W / 2 - 4, y - 1, '#c8c0b6', 8, 1); }
        px(c, W / 2 - 4, foot - 12, '#3a2a20', 8, 12); px(c, W / 2 - 5, foot - 13, '#c8c0b6', 10, 1);
        return crisp(cv, INK);
      }
      front(brick);
      for (let y = face + 2; y < foot; y += 3) { px(c, 0, y, tone(brick, -0.25), W, 1); for (let x = (y % 6 ? 0 : 3); x < W; x += 6) px(c, x, y - 2, tone(brick, -0.18), 1, 2); }
      px(c, 0, face, '#e8dcc8', W, 2); px(c, 0, face + 2, tone(brick, -0.4), W, 1);
      const floors = Math.max(1, Math.floor((hPx - (k === 'shop' ? 14 : 10)) / 10));
      for (let f = 0; f < floors; f++) for (let x = 3; x < W - 5; x += 7) { const y = face + 5 + f * 10; px(c, x - 1, y - 1, '#e8dcc8', 6, 8); px(c, x, y, R() < (lit ? 0.7 : 0.3) ? '#ffd98a' : '#2a2c3a', 4, 6); px(c, x + 2, y, '#e8dcc8', 1, 6); px(c, x, y + 3, '#e8dcc8', 4, 1); if (R() < 0.3) px(c, x - 1, y + 6, ['#e86a6a', '#ffd23f', '#7ab86a'][(R() * 3) | 0], 6, 1); }
      if (k === 'shop') {
        const aw = ['#e86a6a', '#5aa8d8', '#e8b040', '#7ab86a'][v % 4];
        for (let x = 0; x < W; x += 4) px(c, x, foot - 14, (x / 4) % 2 ? '#f4ead4' : aw, 4, 4);
        px(c, 0, foot - 10, '#3a2a24', W, 10); px(c, 2, foot - 9, lit ? '#ffe9a8' : '#c8b088', W - 9, 7); px(c, 3, foot - 8, '#fff8e0', 3, 2);
        for (let q = 0; q < 3; q++) ell(c, 5 + q * 4, foot - 3, 1.5, 1.4, ['#e2453f', '#f0b040', '#7ab86a'][q]);
        px(c, W - 6, foot - 9, '#2a1a14', 4, 9);
      } else { px(c, W / 2 - 3, foot - 10, '#3a2418', 6, 10); px(c, W / 2 - 4, foot - 11, '#e8dcc8', 8, 1); px(c, W / 2 - 5, foot - 1, '#a89e94', 10, 1); px(c, W / 2 + 1, foot - 6, '#d8b05a', 1, 1); }
      return crisp(cv, INK);
    }
    if (k === 'factory' || k === 'warehouse') {
      const wall = k === 'factory' ? ['#7a4a38', '#6a6a6e', '#8a5a3a'][v % 3] : ['#8a8e94', '#6a7a8a', '#9a8a6a'][v % 3];
      if (k === 'factory') {
        // a sawtooth roof seen from above: rows of north lights, the glass catching the sky
        px(c, 0, top, '#4a4648', W, roofH);
        for (let x = 0; x < W; x += 8) { poly(c, '#6a6668', [[x, top + roofH], [x, top], [x + 8, top + roofH]]); px(c, x, top, '#9fd0e8', 1, roofH); px(c, x + 1, top + 1, '#7ab0c8', 1, roofH - 2); }
        // its smokestack at one end
        const sx = v % 2 ? W - 9 : 3; px(c, sx, 0, '#6a3424', 6, face - 0); px(c, sx, 0, '#8a4a34', 2, face); px(c, sx - 1, 0, '#3a2a24', 8, 2); for (let y = 6; y < face; y += 7) px(c, sx, y, '#3a2a24', 6, 1);
      } else roof('#7a7e84');
      front(wall);
      if (k === 'warehouse') for (let x = 0; x < W; x += 2) px(c, x, face, tone(wall, x % 4 ? -0.08 : 0.08), 1, hPx);
      else for (let y = face + 3; y < foot; y += 3) px(c, 0, y, tone(wall, -0.22), W, 1);
      // tall gridded windows, a loading door or two
      if (k === 'factory') for (let x = 4; x < W - 6; x += 9) { px(c, x - 1, face + 4, '#2a2420', 7, hPx - 16); for (let y = face + 5; y < foot - 13; y += 3) for (let q = 0; q < 2; q++) px(c, x + q * 3, y, R() < (lit ? 0.6 : 0.2) ? '#ffd98a' : '#8ab0c0', 2, 2); }
      const dn = Math.max(1, Math.floor(wT / 3));
      for (let q = 0; q < dn; q++) { const x = Math.round(((q + 0.5) * W) / dn) - 6; px(c, x, foot - 14, '#3a3a40', 12, 14); for (let y = foot - 13; y < foot; y += 2) px(c, x + 1, y, '#5a5a62', 10, 1); px(c, x, foot - 15, '#e8c020', 12, 1); }
      px(c, 0, foot - 2, '#3a3834', W, 2);
      return crisp(cv, INK);
    }
    if (k === 'gasometer' || k === 'silo' || k === 'cooling') {
      if (k === 'gasometer') {
        // a gas holder: the round tank inside its iron lattice frame
        const r = W / 2 - 3, col = ['#5a7a6a', '#7a6a5a', '#6a6a7a'][v % 3];
        px(c, 3, face - 4, col, W - 6, hPx + 4); px(c, 3, face - 4, tone(col, 0.25), 3, hPx + 4); px(c, W - 8, face - 4, tone(col, -0.3), 5, hPx + 4);
        ell(c, W / 2, face - 4, r, roofH / 2 + 2, tone(col, 0.2)); ell(c, W / 2, face - 4, r - 3, roofH / 2 - 1, tone(col, 0.35));
        for (let y = face + 4; y < foot; y += 8) px(c, 3, y, tone(col, -0.2), W - 6, 1);
        for (let x = 1; x < W; x += Math.max(6, (W / 4) | 0)) { px(c, x, face - 10, '#3a3634', 2, hPx + 10); for (let y = face - 8; y < foot; y += 9) { c.strokeStyle = '#3a3634'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y + 8); c.stroke(); } }
        px(c, 0, face - 10, '#3a3634', W, 2);
        return crisp(cv, INK);
      }
      if (k === 'silo') {
        for (let q = 0; q < Math.max(1, wT); q++) { const x = q * 16 + 2, col = ['#c8c0b0', '#a8a8b0', '#c8a878'][(v + q) % 3]; poly(c, tone(col, -0.2), [[x, face], [x + 6, top - 4], [x + 12, face]]); px(c, x, face, col, 12, hPx); px(c, x, face, tone(col, 0.2), 3, hPx); px(c, x + 9, face, tone(col, -0.25), 3, hPx); for (let y = face + 6; y < foot; y += 9) px(c, x, y, tone(col, -0.15), 12, 1); }
        px(c, 0, face + 6, '#5a5a62', W, 2);
        return crisp(cv, INK);
      }
      // a cooling tower: the waisted concrete curve, its rim from above, stains running down
      ell(c, W / 2, top + roofH / 2, W / 2 - 2, roofH / 2, '#9a9690'); ell(c, W / 2, top + roofH / 2, W / 2 - 5, roofH / 2 - 2, '#3a3634');
      for (let y = face; y < foot; y++) { const u = (y - face) / hPx, hw = (W / 2 - 2) * (0.8 + 0.2 * Math.cos(u * Math.PI * 1.1 - 0.3)) + u * u * 3; px(c, Math.round(W / 2 - hw), y, '#b8b4ac', Math.round(hw * 2), 1); px(c, Math.round(W / 2 - hw), y, '#d0ccc4', 3, 1); px(c, Math.round(W / 2 + hw - 4), y, '#8a8680', 4, 1); }
      for (let q = 0; q < 6; q++) { const x = Math.round(W * 0.2 + R() * W * 0.6); px(c, x, face + 2, 'rgba(90,80,70,.4)', 1, 6 + (R() * hPx * 0.5 | 0)); }
      return crisp(cv, INK);
    }
    if (k === 'chimney') {
      px(c, W / 2 - 4, 0, '#7a3a28', 8, foot); px(c, W / 2 - 4, 0, '#9a5a3a', 2, foot); px(c, W / 2 + 2, 0, '#5a2a1c', 2, foot);
      for (let y = 4; y < foot; y += 3) px(c, W / 2 - 4, y, '#5a2a1c', 8, 1);
      for (const y of [2, 18, foot - 20]) px(c, W / 2 - 5, y, '#3a2a24', 10, 2);
      px(c, W / 2 - 5, foot - 4, '#4a3a34', 10, 4);
      return crisp(cv, INK);
    }
    if (k === 'crane') {
      // a gantry crane: two yellow lattice legs, a beam across, a hook on its cable
      const y0 = top + 2;
      for (const x of [2, W - 5]) { px(c, x, y0, '#e8b020', 3, foot - y0); for (let y = y0 + 4; y < foot; y += 6) px(c, x - 1, y, '#a87a10', 5, 1); }
      px(c, 0, y0, '#e8b020', W, 4); for (let x = 2; x < W - 2; x += 4) px(c, x, y0 + 1, '#a87a10', 1, 2);
      const hx = 6 + ((v * 7) % Math.max(1, W - 14)); px(c, hx, y0 + 4, '#3a3a40', 5, 4); px(c, hx + 2, y0 + 8, '#8a8a94', 1, 18); px(c, hx + 1, y0 + 26, '#3a3a40', 3, 2); px(c, hx + 1, y0 + 28, '#3a3a40', 1, 2);
      if (v % 2) { px(c, hx - 3, y0 + 29, ['#c83a2a', '#2a6ab8', '#3a8a4a'][v % 3], 10, 6); }
      return crisp(cv, INK);
    }
    if (k === 'villa') {
      // a little house in the suburbs: a gabled roof in its own colour, pastel walls, a lit window, a door
      const rf = ['#b84a3a', '#4a5a8a', '#5a7a4a', '#7a5a4a', '#8a3a5a'][v % 5], wl = ['#f0e4d0', '#d8e8f0', '#f0d8d8', '#e8f0d8', '#f4ecc8'][(v >> 1) % 5];
      px(c, 0, top, rf, W, roofH); poly(c, tone(rf, 0.2), [[0, top], [W / 2, top + roofH / 2], [W, top]]); px(c, 0, top + roofH / 2 - 1, tone(rf, -0.2), W, 2); px(c, W / 2 - 1, top - 4, '#8a5a4a', 3, 6);
      front(wl);
      px(c, 0, face, tone(rf, -0.1), W, 3);
      px(c, 4, face + 6, lit ? '#ffd98a' : '#5a7a9a', 6, 6); px(c, 6, face + 6, '#ffffff', 1, 6); px(c, 4, face + 9, '#ffffff', 6, 1);
      if (W > 24) { px(c, W - 12, face + 6, lit ? '#ffd98a' : '#5a7a9a', 6, 6); }
      px(c, W / 2 - 2, foot - 9, ['#8a4a2a', '#2a5a8a', '#3a6a3a'][v % 3], 5, 9); px(c, W / 2 + 1, foot - 5, '#d8b05a', 1, 1);
      return crisp(cv, INK);
    }
    if (k === 'station' || k === 'halt') {
      if (k === 'station') {
        // the central station: a brick front with a great arched train shed of iron and glass behind it
        px(c, 0, top, '#3a3a44', W, roofH);
        for (let x = 2; x < W - 2; x += 6) { px(c, x, top + 1, '#8ad0e8', 4, roofH - 2); px(c, x, top + 1, '#c8f0ff', 1, roofH - 2); }
        for (let x = 0; x < W; x += 6) px(c, x, top, '#5a4a3a', 2, roofH);
        front('#8a4a34');
        for (let y = face + 2; y < foot; y += 3) px(c, 0, y, '#6a3424', W, 1);
        poly(c, '#5a3a2a', [[W / 2 - 22, face], [W / 2, face - 14], [W / 2 + 22, face]]); poly(c, '#c8f0ff', [[W / 2 - 16, face], [W / 2, face - 10], [W / 2 + 16, face]]); for (let q = -2; q <= 2; q++) { c.strokeStyle = '#5a3a2a'; c.beginPath(); c.moveTo(W / 2, face - 10); c.lineTo(W / 2 + q * 8, face); c.stroke(); }
        ell(c, W / 2, face + 10, 7, 7, '#3a2a20'); ell(c, W / 2, face + 10, 5.5, 5.5, '#f4ecd8'); px(c, W / 2, face + 6, '#2a2420', 1, 4); px(c, W / 2, face + 10, '#2a2420', 3, 1);
        for (let x = 6; x < W - 8; x += 12) { px(c, x, face + 20, '#e8dcc8', 3, hPx - 20); px(c, x + 4, face + 22, lit ? '#ffd98a' : '#3a3c52', 6, 12); }
        px(c, W / 2 - 8, foot - 16, '#2a1a14', 16, 16); px(c, W / 2 - 9, foot - 17, '#e8dcc8', 18, 1); px(c, W / 2 - 7, foot - 15, lit ? '#ffe9a8' : '#c8b088', 14, 5);
        return crisp(cv, INK);
      }
      // a country halt: a timber shelter under a canopy, a lamp, a bench
      roof('#6a4a3a');
      for (let x = 0; x < W; x += 3) px(c, x, top + roofH - 2, '#e8dcc8', 2, 2);
      front('#c8a878'); for (let x = 0; x < W; x += 4) px(c, x, face, '#a8885a', 1, hPx);
      px(c, 5, face + 5, lit ? '#ffd98a' : '#5a6a7a', 7, 6); px(c, W - 14, foot - 11, '#5a3a2a', 7, 11);
      px(c, W - 4, face - 4, '#3a3a40', 1, hPx + 4); px(c, W - 6, face - 7, lit ? '#ffd98a' : '#8a8a70', 4, 4);
      return crisp(cv, INK);
    }
    [cv, c] = mk(8, 8); px(c, 0, 0, '#f0f', 8, 8);
    return cv;
  });
}

// ------------------------------------------------ the train
// side-on facing right ('h'), or from above going down ('s', its face toward you) or up ('n')
export const LIVERY = [['#2a5a3a', '#c8a040', '#7a2a24'], ['#5a2a3a', '#d8b05a', '#2a3a5a']];
export function trainSprite(part, dir, v = 0, f = 0, lit = 0) {
  return memo(`t|${part}|${dir}|${v}|${f}|${lit}`, () => {
    const [body, brass, red] = LIVERY[v % LIVERY.length];
    let cv, c;
    if (dir === 'h') {
      if (part === 'loco') {
        [cv, c] = mk(36, 26);
        // boiler with brass bands, smokebox, chimney and dome; the cab behind; red spoked wheels
        px(c, 4, 9, body, 22, 9); px(c, 4, 9, tone(body, 0.25), 22, 2); px(c, 4, 16, tone(body, -0.3), 22, 2);
        for (const x of [9, 15, 21]) px(c, x, 9, brass, 1, 9);
        px(c, 24, 8, '#2a2a30', 6, 11); px(c, 29, 10, '#3a3a42', 2, 7); ell(c, 30, 13.5, 1.6, 1.6, '#ffd88a');
        px(c, 25, 1, '#2a2a30', 4, 8); px(c, 24, 0, '#3a3a42', 6, 2); ell(c, 17, 8, 3, 2, brass); px(c, 16, 6, tone(brass, 0.3), 2, 1);
        px(c, 0, 4, body, 6, 15); px(c, 0, 3, '#2a2a30', 7, 2); px(c, 1, 6, lit ? '#ffd98a' : '#9fd0e8', 4, 4);
        px(c, 31, 18, '#3a3a42', 4, 3); for (let q = 0; q < 3; q++) px(c, 31 + q, 21, '#3a3a42', 1, 2);
        for (const [x, r] of [[8, 3.6], [16, 3.6], [24, 2.6]]) { ell(c, x, 21, r, r, red); ell(c, x, 21, r - 1.2, r - 1.2, tone(red, -0.4)); const a = f * 0.8 + x; px(c, Math.round(x + Math.cos(a) * (r - 1)), Math.round(21 + Math.sin(a) * (r - 1)), brass, 1, 1); }
        px(c, 8, 20 + (f % 2), '#c8ccd4', 9, 1);
      } else if (part === 'tender') {
        [cv, c] = mk(22, 24);
        px(c, 1, 8, body, 20, 11); px(c, 1, 8, tone(body, 0.25), 20, 2); px(c, 1, 17, brass, 20, 1);
        for (let x = 2; x < 20; x += 3) ell(c, x + 1, 8, 1.8, 1.5, '#1e1c20');
        for (const x of [6, 15]) { ell(c, x, 20, 3, 3, red); ell(c, x, 20, 1.6, 1.6, tone(red, -0.4)); }
      } else {
        [cv, c] = mk(30, 24);
        px(c, 1, 4, tone(body, 0.12), 28, 3); px(c, 0, 6, body, 30, 11); px(c, 0, 6, tone(body, 0.25), 30, 1); px(c, 0, 15, brass, 30, 1);
        for (let x = 3; x < 27; x += 6) { px(c, x, 8, lit ? '#ffd98a' : '#9fd0e8', 4, 5); px(c, x, 8, lit ? '#fff2c0' : '#d8f4ff', 1, 2); }
        for (const x of [6, 23]) { ell(c, x, 20, 2.8, 2.8, '#3a3a42'); ell(c, x, 20, 1.4, 1.4, red); }
      }
    } else {
      // from above: the roof along the track and the near end's face
      const front = dir === 's';
      if (part === 'loco') {
        [cv, c] = mk(18, 36);
        px(c, 3, 4, body, 12, 24); px(c, 3, 4, tone(body, 0.25), 3, 24); for (const y of [9, 15, 21]) px(c, 3, y, brass, 12, 1);
        if (front) { px(c, 5, 2, '#2a2a30', 8, 6); ell(c, 9, 4, 2.4, 2.4, '#3a3a42'); px(c, 3, 26, '#2a2a30', 12, 9); ell(c, 9, 30, 4.5, 4.5, '#3a3a42'); ell(c, 9, 30, 2, 2, '#ffd88a'); px(c, 4, 34, '#3a3a42', 10, 2); }
        else { ell(c, 9, 7, 2.4, 2.4, '#2a2a30'); px(c, 2, 24, body, 14, 11); px(c, 2, 24, '#2a2a30', 14, 2); px(c, 5, 27, lit ? '#ffd98a' : '#9fd0e8', 8, 4); }
        ell(c, 9, 14, 2.2, 2.2, brass);
      } else if (part === 'tender') {
        [cv, c] = mk(18, 24);
        px(c, 2, 2, body, 14, 18); px(c, 4, 4, '#1e1c20', 10, 12); for (let q = 0; q < 6; q++) px(c, 5 + (q % 3) * 3, 5 + (q >> 1) * 3, '#3a3638', 2, 2);
        px(c, 2, 18, tone(body, -0.2), 14, 4); px(c, 2, 21, brass, 14, 1);
      } else {
        [cv, c] = mk(18, 32);
        px(c, 2, 1, tone(body, 0.12), 14, 24); px(c, 2, 1, tone(body, 0.3), 2, 24); px(c, 8, 1, tone(body, -0.1), 2, 24);
        px(c, 2, 24, body, 14, 7); px(c, 2, 29, brass, 14, 1); px(c, 5, 25, lit ? '#ffd98a' : '#9fd0e8', 8, 3);
      }
    }
    return crisp(cv, INK);
  });
}

// ------------------------------------------------ machinery under the city
// a gear seen face-on: teeth, spokes, a hub; frame f of 8 turns it by an eighth of a tooth
function gear(c, cx, cy, r, teeth, f, col) {
  const a0 = ((f / 8) * 6.2832) / teeth;
  c.fillStyle = tone(col, -0.3);
  for (let t = 0; t < teeth; t++) { const a = a0 + (t / teeth) * 6.2832; c.save(); c.translate(cx, cy); c.rotate(a); c.fillRect(r - 2, -1.6, 4.5, 3.2); c.restore(); }
  ell(c, cx, cy, r, r, col); ell(c, cx, cy, r - 2.5, r - 2.5, tone(col, -0.18)); ell(c, cx - 1, cy - 1, r - 3.5, r - 3.5, tone(col, 0.05));
  c.fillStyle = tone(col, -0.45);
  for (let s = 0; s < 5; s++) { const a = a0 * 3 + (s / 5) * 6.2832; c.save(); c.translate(cx, cy); c.rotate(a); c.fillRect(2, -1.5, r - 5, 3); c.restore(); }
  ell(c, cx, cy, 3, 3, tone(col, 0.25)); ell(c, cx, cy, 1.4, 1.4, '#2a2018');
  c.fillStyle = tone(col, 0.35); c.fillRect(Math.round(cx - r * 0.6), Math.round(cy - r * 0.7), 3, 1);
}
export function worksSprite(k, f = 0, v = 0, lit = 0) {
  return memo(`w|${k}|${f}|${v}|${lit}`, () => {
    let cv, c, raw = false;
    if (k === 'gear') {
      const r = [12, 16, 20][v % 3], s = r * 2 + 10;
      [cv, c] = mk(s, s + 14);
      px(c, s / 2 - 3, s / 2, '#3a2e22', 6, s / 2 + 14); px(c, s / 2 - 8, s + 10, '#2a2018', 16, 4);
      gear(c, s / 2, s / 2, r, Math.round(r * 0.75), f, ['#b8903a', '#a87a3a', '#8a8a94'][v % 3]);
      return crisp(cv, INK);
    }
    if (k === 'twin') {
      [cv, c] = mk(46, 40);
      px(c, 6, 30, '#2a2018', 34, 10);
      gear(c, 15, 19, 12, 9, f, '#b8903a'); gear(c, 33, 15, 9, 7, 7 - f, '#a8a8b0');
      return crisp(cv, INK);
    }
    if (k === 'piston') {
      [cv, c] = mk(22, 44);
      const y = [0, 4, 8, 4][f % 4];
      px(c, 3, 24, '#4a3a2a', 16, 18); px(c, 3, 24, '#6a5a3a', 16, 2); for (let q = 0; q < 3; q++) px(c, 3, 28 + q * 5, '#2a2018', 16, 1);
      px(c, 9, 4 + y, '#c8ccd4', 4, 22 - y); px(c, 9, 4 + y, '#ffffff', 1, 22 - y); px(c, 5, y, '#b8903a', 12, 6); px(c, 5, y, '#e0c070', 12, 1);
      px(c, 1, 40, '#2a2018', 20, 4);
      return crisp(cv, INK);
    }
    if (k === 'boiler') {
      [cv, c] = mk(26, 42);
      px(c, 3, 6, '#7a4a2a', 20, 32); px(c, 3, 6, '#9a6a3a', 4, 32); px(c, 19, 6, '#5a3420', 4, 32);
      ell(c, 13, 6, 10, 4, '#b8743a'); ell(c, 13, 5, 7, 2.5, '#d8945a'); px(c, 11, 0, '#5a3420', 4, 5);
      for (const y of [12, 22, 32]) { px(c, 3, y, '#c89a4a', 20, 2); for (let x = 5; x < 22; x += 4) px(c, x, y, '#fff0c0', 1, 1); }
      ell(c, 9, 17, 3.2, 3.2, '#2a2420'); ell(c, 9, 17, 2.4, 2.4, '#f0e8d8'); px(c, 9, 15, '#c83a2a', 1, 2);
      px(c, 7, 34, '#2a1a12', 12, 6); px(c, 8, 35, lit ? '#ffb24a' : '#a84a1a', 10, 4);
      return crisp(cv, INK);
    }
    if (k === 'furnace') {
      [cv, c] = mk(34, 34);
      px(c, 2, 6, '#4a2018', 30, 26); for (let y = 8; y < 32; y += 3) { px(c, 2, y, '#2a120c', 30, 1); for (let x = (y % 6 ? 0 : 4); x < 30; x += 8) px(c, 2 + x, y - 2, '#2a120c', 1, 2); }
      px(c, 0, 4, '#3a3438', 34, 3); px(c, 12, 0, '#2a2428', 10, 6);
      ell(c, 17, 22, 9, 7, '#1a0a06'); ell(c, 17, 24, 8, 5, f ? '#ffb24a' : '#ff6a1a'); ell(c, 17, 25, 5, 3, f ? '#fff0b0' : '#ffd24a');
      px(c, 6, 30, '#1a0a06', 22, 2);
      return crisp(cv, INK);
    }
    if (k === 'valve') {
      [cv, c] = mk(22, 24);
      px(c, 0, 14, '#b8743a', 22, 4); px(c, 0, 14, '#e0a05a', 22, 1); px(c, 9, 12, '#8a5a2a', 4, 12);
      ell(c, 11, 8, 7, 7, '#a82a1a'); ell(c, 11, 8, 5, 5, 'rgba(0,0,0,0)'); c.clearRect(7, 4, 9, 9); ell(c, 11, 8, 7, 7, '#a82a1a'); ell(c, 11, 8, 4.5, 4.5, '#3a2a20');
      for (let q = 0; q < 4; q++) { const a = (q / 4) * 6.2832 + f * 0.4; px(c, Math.round(11 + Math.cos(a) * 4), Math.round(8 + Math.sin(a) * 4), '#e86a4a', 2, 2); }
      ell(c, 11, 8, 1.6, 1.6, '#d8b05a');
      return crisp(cv, INK);
    }
    if (k === 'tank') {
      [cv, c] = mk(24, 34);
      px(c, 3, 6, '#b8743a', 18, 24); px(c, 3, 6, '#e0a05a', 3, 24); px(c, 18, 6, '#7a4a24', 3, 24);
      ell(c, 12, 6, 9, 3.4, '#d8945a'); for (const y of [10, 20]) px(c, 3, y, '#7a4a24', 18, 1);
      ell(c, 12, 15, 3, 3, '#2a2420'); ell(c, 12, 15, 2.2, 2.2, '#f0e8d8'); px(c, 12, 13, '#c83a2a', 1, 2);
      px(c, 4, 30, '#3a2a20', 3, 4); px(c, 17, 30, '#3a2a20', 3, 4);
      return crisp(cv, INK);
    }
    if (k === 'cart') {
      [cv, c] = mk(22, 18);
      poly(c, '#5a4a3a', [[1, 4], [21, 4], [18, 14], [4, 14]]); px(c, 1, 4, '#8a7a6a', 20, 2);
      for (let q = 0; q < 7; q++) ell(c, 4 + q * 2.4, 4, 2, 1.6, q % 2 ? '#1e1c20' : '#2e2c30');
      for (const x of [6, 16]) { ell(c, x, 15, 2.6, 2.6, '#3a3a42'); ell(c, x, 15, 1, 1, '#8a8a94'); }
      return crisp(cv, INK);
    }
    if (k === 'coal') {
      [cv, c] = mk(26, 14); const R = mulberry32(v + 5);
      for (let q = 0; q < 30; q++) { const a = R() * 3.14, d = R(); ell(c, 13 + Math.cos(a) * d * 11, 12 - Math.sin(a) * d * 9, 2.2, 1.8, R() < 0.5 ? '#1e1c20' : '#34323a'); }
      for (let q = 0; q < 6; q++) px(c, 5 + (R() * 16 | 0), 4 + (R() * 8 | 0), '#6a6a78', 1, 1);
      return crisp(cv, INK);
    }
    if (k === 'vent') {
      [cv, c] = mk(18, 10); raw = true;
      ell(c, 9, 5, 8, 4, '#2a2420'); ell(c, 9, 5, 6.5, 3, '#4a3a30'); for (let q = 0; q < 4; q++) px(c, 4, 3 + q * 1.5 | 0, '#1a1410', 10, 1);
      return cv;
    }
    if (k === 'gaslamp') {
      [cv, c] = mk(12, 32);
      px(c, 5, 10, '#2a2420', 2, 20); px(c, 3, 29, '#2a2420', 6, 3); px(c, 4, 18, '#3a3430', 4, 1);
      poly(c, '#2a2420', [[2, 3], [10, 3], [8, 0], [4, 0]]); px(c, 3, 3, lit ? '#ffd88a' : '#8a7a5a', 6, 7); if (lit) px(c, 5, 5, '#fff6d8', 2, 3); px(c, 2, 10, '#2a2420', 8, 1);
      return crisp(cv, INK);
    }
    if (k === 'safe') {
      [cv, c] = mk(18, 18);
      px(c, 1, 3, '#5a5a62', 16, 15); px(c, 1, 3, '#7a7a84', 16, 2); px(c, 15, 3, '#3a3a42', 2, 15);
      if (f) { px(c, 3, 5, '#1e1c20', 11, 11); px(c, 4, 9, '#ffd24a', 9, 6); px(c, 5, 8, '#fff6c8', 3, 2); px(c, 0, 4, '#4a4a52', 3, 13); }
      else { ell(c, 9, 10, 4, 4, '#b8903a'); ell(c, 9, 10, 2.4, 2.4, '#3a2a20'); px(c, 9, 7, '#fff0c0', 1, 2); for (const y of [6, 14]) px(c, 14, y, '#b8903a', 2, 2); }
      return crisp(cv, INK);
    }
    if (k === 'clockface') {
      [cv, c] = mk(40, 46);
      px(c, 17, 36, '#3a2e22', 6, 10);
      ell(c, 20, 20, 19, 19, '#5a4428'); ell(c, 20, 20, 17, 17, '#d8b05a'); ell(c, 20, 20, 15, 15, '#f4ecd8');
      for (let q = 0; q < 12; q++) { const a = (q / 12) * 6.2832; px(c, Math.round(20 + Math.cos(a) * 13), Math.round(20 + Math.sin(a) * 13), '#3a2e22', 2, 2); }
      const a1 = (f / 8) * 6.2832, a2 = (f / 96) * 6.2832; c.strokeStyle = '#2a2018'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(20, 20); c.lineTo(20 + Math.sin(a1) * 12, 20 - Math.cos(a1) * 12); c.moveTo(20, 20); c.lineTo(20 + Math.sin(a2) * 8, 20 - Math.cos(a2) * 8); c.stroke();
      ell(c, 20, 20, 2, 2, '#b8903a');
      return crisp(cv, INK);
    }
    [cv, c] = mk(8, 8); px(c, 0, 0, '#f0f', 8, 8);
    return raw ? cv : crisp(cv, INK);
  });
}
