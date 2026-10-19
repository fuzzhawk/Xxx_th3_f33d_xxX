// Procedural pixel sprites: symmetric monsters (Creature Forge-style), humanoid
// characters with full animation sheets, items and wall textures. Everything is
// seeded, so the same post always produces the same cast.
import { mulberry32 } from '../util.js';

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) { cache.set(key, fn()); if (cache.size > 400) cache.delete(cache.keys().next().value); } return cache.get(key); };

export function themePalette(h) {
  const c = (dh, s, l) => `hsl(${(((h + dh) % 360) + 360) % 360},${s}%,${l}%)`;
  return { bg: c(0, 28, 8), bg2: c(0, 32, 16), ink: c(0, 30, 92), c: [c(0, 82, 58), c(40, 72, 62), c(160, 45, 45), c(-30, 66, 50), c(10, 30, 78), c(200, 42, 52)] };
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.pixel = true; return c; }
function hsl(h, s, l) { return `hsl(${((h % 360) + 360) % 360},${s}%,${l}%)`; }

// ---------------------------------------------------------------- monsters
// Returns { frames: [canvas, canvas], name } — two-frame idle/walk animation.
export function monster(seed, hue = 0, size = 18, tier = 0) {
  return memo(`m${seed}|${hue}|${size}|${tier}`, () => {
    const R = mulberry32(seed);
    const W = size, H = size, half = Math.ceil(W / 2);
    const grid = new Int8Array(W * H); // 0 empty, 1 body, 2 accent, 3 eye white, 4 pupil, 5 mouth, 6 tooth
    const rx = W * (0.26 + R() * 0.2 + tier * 0.02), ry = H * (0.26 + R() * 0.18), cy = H * (0.42 + R() * 0.1);
    const noise = 0.35 + R() * 0.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < half; x++) {
      const d = ((x + 0.5 - W / 2) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (1.15 - d + (R() - 0.5) * noise > 0.45) grid[y * W + x] = R() < 0.18 ? 2 : 1;
    }
    let top = H, bottom = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < half; x++) if (grid[y * W + x]) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    // legs
    const legs = Math.floor(R() * 3) + (tier > 2 ? 1 : 0);
    for (let k = 0; k < legs; k++) { const lx = Math.max(0, half - 2 - k * 2 - Math.floor(R() * 2)); for (let y = bottom; y < Math.min(H - 1, bottom + 2 + Math.floor(R() * 3)); y++) grid[y * W + lx] = 1; }
    // horns / antennae
    if (R() < 0.6 || tier > 1) { let hx = half - 2 - Math.floor(R() * 3), hy = top; for (let i = 0; i < 2 + Math.floor(R() * 3) && hy > 0; i++) { hy--; if (R() < 0.6) hx--; if (hx >= 0) grid[hy * W + hx] = 2; } }
    // arms
    if (R() < 0.5) { const ay = Math.floor(cy); let ax = 0; while (ax < half && !grid[ay * W + ax]) ax++; for (let i = 1; i < 3 && ax - i >= 0; i++) grid[(ay - (i > 1 ? 1 : 0)) * W + ax - i] = 1; }
    // eyes
    const eyeY = Math.max(top + 1, Math.floor(top + (bottom - top) * (0.25 + R() * 0.2)));
    const cyclops = R() < 0.25;
    const ex = cyclops ? half - 1 : Math.max(1, half - 2 - Math.floor(R() * 3));
    grid[eyeY * W + ex] = 3; grid[(eyeY + 1) * W + ex] = 4;
    if (ex - 1 >= 0 && R() < 0.5) grid[eyeY * W + ex - 1] = 3;
    // mouth
    const my = Math.min(H - 2, eyeY + 2 + Math.floor(R() * 2));
    for (let x = Math.max(0, half - 1 - Math.floor(R() * 3)); x < half; x++) if (grid[my * W + x]) grid[my * W + x] = R() < 0.3 ? 6 : 5;
    // mirror
    for (let y = 0; y < H; y++) for (let x = 0; x < half; x++) grid[y * W + (W - 1 - x)] = grid[y * W + x];
    const h0 = hue + R() * 50 - 25, h1 = h0 + 120 + R() * 120;
    const body = (y) => hsl(h0, 55 + tier * 6, 62 - (y / H) * 26);
    const acc = hsl(h1, 70, 55), outline = hsl(h0, 40, 10);
    const draw = (bob, legShift) => {
      const c = canvas(W + 2, H + 2), x = c.getContext('2d');
      const at = (gx, gy) => (gx < 0 || gy < 0 || gx >= W || gy >= H ? 0 : grid[gy * W + gx]);
      for (let y = 0; y < H; y++) for (let gx = 0; gx < W; gx++) {
        const v = at(gx, y);
        const sy = y + 1 + (y < bottom ? bob : 0), sx = gx + 1 + (y > bottom - 1 && legShift ? (gx < half ? -legShift : legShift) : 0);
        if (!v) { if (at(gx - 1, y) || at(gx + 1, y) || at(gx, y - 1) || at(gx, y + 1)) { x.fillStyle = outline; x.fillRect(sx, sy, 1, 1); } continue; }
        x.fillStyle = v === 1 ? body(y) : v === 2 ? acc : v === 3 ? '#fff' : v === 4 ? '#111' : v === 5 ? outline : '#f4f0e0';
        x.fillRect(sx, sy, 1, 1);
      }
      return c;
    };
    return { frames: [draw(0, 0), draw(1, 1)], hue: h0 };
  });
}

// ---------------------------------------------------------------- humanoids
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0e0a0', '#a8b8ff', '#d9a0e8'];
const POSES = {
  // shoulder→hand and hip→foot offsets (left, right), relative to a 14×20 sheet cell
  idle: { arms: [[-2, 5], [2, 5]], legs: [[-1, 6], [1, 6]] },
  walk1: { arms: [[-3, 4], [3, 5]], legs: [[-3, 5], [2, 6]] },
  walk2: { arms: [[-1, 5], [1, 4]], legs: [[1, 6], [-2, 5]] },
  jump: { arms: [[-3, -2], [3, -2]], legs: [[-2, 4], [2, 3]] },
  punch: { arms: [[-1, 4], [6, 0]], legs: [[-2, 6], [2, 6]] },
  kick: { arms: [[-3, 2], [2, 3]], legs: [[-1, 6], [6, 1]] },
  special: { arms: [[5, 0], [6, 1]], legs: [[-2, 6], [2, 6]] },
  block: { arms: [[1, 1], [2, 0]], legs: [[-2, 6], [2, 6]] },
  hurt: { arms: [[-3, 1], [-1, 3]], legs: [[-2, 6], [0, 6]], lean: -1 }
};
function line(x, x0, y0, x1, y1, col, w = 1) {
  x.fillStyle = col;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) x.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w);
}
// Returns { idle, walk: [a, b], jump, punch, kick, special, block, hurt } canvases (facing right).
export function humanoid(seed, hue = 0) {
  return memo(`h${seed}|${hue}`, () => {
    const R = mulberry32(seed ^ 0x9e3779b9);
    const skin = SKIN[Math.floor(R() * SKIN.length)];
    const shirt = hsl(hue + R() * 40 - 20, 65, 50), pants = hsl(hue + 180 + R() * 60, 35, 32), hair = hsl(R() * 360, 50, 25 + R() * 30);
    const hat = R() < 0.4, cape = R() < 0.25, bulky = R() < 0.35, outline = '#120d0a';
    const sheet = {};
    for (const [name, p] of Object.entries(POSES)) {
      const c = canvas(16, 22), x = c.getContext('2d');
      const lean = p.lean || 0, cx = 7 + lean;
      if (cape) { x.fillStyle = hsl(hue + 200, 50, 30); x.fillRect(cx - 3, 7, 6, 8); }
      // legs
      p.legs.forEach(([dx, dy], i) => line(x, cx - 1 + i * 2, 13, cx - 1 + i * 2 + dx, 13 + dy, pants, 2));
      // torso
      x.fillStyle = shirt; x.fillRect(cx - (bulky ? 3 : 2), 6, bulky ? 6 : 5, 8);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(cx - 2, 12, 5, 1);
      // arms
      p.arms.forEach(([dx, dy], i) => { const sx = i ? cx + 2 : cx - 3; line(x, sx, 7, sx + dx, 7 + dy, shirt, 2); x.fillStyle = skin; x.fillRect(sx + dx, 7 + dy, 2, 2); });
      // head
      x.fillStyle = skin; x.fillRect(cx - 2, 1, 5, 5);
      x.fillStyle = hair; x.fillRect(cx - 2, 0, 5, 2); x.fillRect(cx - 2, 1, 1, 3);
      if (hat) { x.fillStyle = hsl(hue + 90, 60, 45); x.fillRect(cx - 3, 0, 7, 1); x.fillRect(cx - 2, -1, 5, 1); }
      x.fillStyle = name === 'hurt' ? '#fff' : outline; x.fillRect(cx + 1, 3, 1, 1);
      // outline pass
      const d = x.getImageData(0, 0, 16, 22), o = x.createImageData(16, 22);
      for (let y = 0; y < 22; y++) for (let xx = 0; xx < 16; xx++) {
        const i = (y * 16 + xx) * 4;
        if (d.data[i + 3]) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = xx + a, Y = y + b; return X >= 0 && Y >= 0 && X < 16 && Y < 22 && d.data[(Y * 16 + X) * 4 + 3]; });
        if (n) { o.data[i] = 18; o.data[i + 1] = 13; o.data[i + 2] = 10; o.data[i + 3] = 255; }
      }
      const oc = canvas(16, 22); oc.getContext('2d').putImageData(o, 0, 0); oc.getContext('2d').drawImage(c, 0, 0);
      sheet[name] = oc;
    }
    return { ...sheet, walk: [sheet.walk1, sheet.walk2] };
  });
}

// ---------------------------------------------------------------- items and textures
export function item(seed, hue = 0) {
  return memo(`i${seed}|${hue}`, () => {
    const R = mulberry32(seed ^ 0x51ed27);
    const c = canvas(12, 12), x = c.getContext('2d');
    const kind = Math.floor(R() * 4), col = hsl(hue + R() * 80 - 40, 80, 58), hi = hsl(hue, 90, 85), dk = hsl(hue, 50, 22);
    x.fillStyle = dk;
    if (kind === 0) { x.beginPath(); x.arc(6, 6, 5.5, 0, 7); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(6, 6, 4.5, 0, 7); x.fill(); }
    else if (kind === 1) { x.beginPath(); x.moveTo(6, 0); x.lineTo(12, 6); x.lineTo(6, 12); x.lineTo(0, 6); x.fill(); x.fillStyle = col; x.beginPath(); x.moveTo(6, 1.5); x.lineTo(10.5, 6); x.lineTo(6, 10.5); x.lineTo(1.5, 6); x.fill(); }
    else if (kind === 2) { x.fillRect(1, 1, 10, 10); x.fillStyle = col; x.fillRect(2, 2, 8, 8); x.fillStyle = dk; x.fillRect(5, 2, 2, 8); }
    else { for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; x.fillStyle = col; x.fillRect(6 + Math.cos(a) * 4 - 1, 6 + Math.sin(a) * 4 - 1, 3, 3); } x.fillRect(4, 4, 4, 4); }
    x.fillStyle = hi; x.fillRect(4, 3, 2, 1);
    return c;
  });
}
export function texture(seed, hue = 0) {
  return memo(`t${seed}|${hue}`, () => {
    const R = mulberry32(seed ^ 0x7f4a7c15);
    const c = canvas(32, 32), x = c.getContext('2d');
    const base = hsl(hue, 30 + R() * 30, 25 + R() * 15), line2 = hsl(hue, 30, 12), hi = hsl(hue, 40, 45);
    x.fillStyle = base; x.fillRect(0, 0, 32, 32);
    const kind = Math.floor(R() * 4);
    if (kind === 0) { x.fillStyle = line2; for (let r = 0; r < 4; r++) { x.fillRect(0, r * 8, 32, 1); for (let q = 0; q < 3; q++) x.fillRect(((q * 12 + (r % 2) * 6) % 32), r * 8, 1, 8); } }
    else if (kind === 1) { for (let i = 0; i < 90; i++) { x.fillStyle = R() < 0.5 ? line2 : hi; x.fillRect(Math.floor(R() * 32), Math.floor(R() * 32), 1 + Math.floor(R() * 2), 1); } }
    else if (kind === 2) { x.fillStyle = line2; x.fillRect(0, 0, 32, 2); x.fillRect(0, 16, 32, 2); x.fillRect(0, 0, 2, 32); x.fillRect(16, 0, 2, 32); x.fillStyle = hi; x.fillRect(4, 4, 3, 3); x.fillRect(20, 20, 3, 3); }
    else { x.strokeStyle = line2; for (let i = -32; i < 64; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 32); x.stroke(); } }
    return c;
  });
}

const SYL = ['zor', 'ka', 'mu', 'bli', 'gor', 'nax', 'pip', 'ul', 'thra', 'vee', 'mo', 'quix', 'sna', 'drak', 'lo', 'fen', 'gib', 'yar', 'oob', 'tik', 'wum', 'sel', 'kra', 'nib'];
export function creatureName(seed) {
  const R = mulberry32(seed ^ 0x2545f491);
  const n = 2 + Math.floor(R() * 2);
  let s = '';
  for (let i = 0; i < n; i++) s += SYL[Math.floor(R() * SYL.length)];
  return s[0].toUpperCase() + s.slice(1);
}
