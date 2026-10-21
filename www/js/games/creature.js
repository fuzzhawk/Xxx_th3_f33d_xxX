// Procedural pixel sprites: symmetric monsters (Creature Forge-style), humanoid
// characters with full animation sheets, items and wall textures. Everything is
// seeded, so the same post always produces the same cast.
import { mulberry32 } from '../util.js';
import { marrowSheet } from '../marrow/sprites.js';
import { beast } from '../beasts.js';

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) { cache.set(key, fn()); if (cache.size > 400) cache.delete(cache.keys().next().value); } return cache.get(key); };

// Colour schemes: every theme picks one, so a game's colours hang together.
export const SCHEMES = ['earth', 'neon', 'pastel', 'duotone', 'sunset', 'ice', 'toxic', 'ink', 'candy', 'rust'];
export function themePalette(h, scheme = 'earth') {
  const c = (dh, s2, l) => `hsl(${(((h + dh) % 360) + 360) % 360},${s2}%,${l}%)`;
  const P = {
    earth: [[0, 28, 8], [0, 32, 16], [0, 30, 92], [[0, 82, 58], [40, 72, 62], [160, 45, 45], [-30, 66, 50], [10, 30, 78], [200, 42, 52]]],
    neon: [[0, 60, 6], [20, 70, 13], [0, 40, 95], [[0, 100, 60], [180, 100, 55], [300, 100, 62], [60, 100, 55], [120, 90, 55], [240, 90, 66]]],
    pastel: [[0, 25, 22], [0, 25, 30], [0, 40, 96], [[0, 70, 80], [60, 70, 82], [150, 50, 78], [210, 60, 82], [300, 50, 84], [30, 60, 86]]],
    duotone: [[0, 40, 9], [0, 45, 17], [180, 40, 92], [[0, 80, 58], [180, 70, 55], [0, 60, 40], [180, 55, 38], [0, 50, 78], [180, 45, 75]]],
    sunset: [[260, 45, 10], [290, 45, 18], [40, 60, 92], [[20, 95, 60], [340, 80, 60], [45, 95, 62], [280, 55, 55], [0, 85, 70], [200, 50, 45]]],
    ice: [[210, 40, 8], [205, 40, 16], [190, 40, 95], [[190, 80, 62], [210, 70, 72], [170, 60, 55], [230, 55, 58], [195, 35, 85], [260, 40, 66]]],
    toxic: [[120, 40, 6], [140, 45, 12], [90, 60, 90], [[100, 95, 50], [290, 70, 58], [70, 90, 55], [160, 80, 45], [90, 60, 75], [320, 70, 60]]],
    ink: [[0, 8, 7], [0, 8, 14], [0, 10, 92], [[0, 85, 52], [0, 0, 78], [0, 0, 45], [0, 70, 35], [0, 0, 90], [0, 0, 60]]],
    candy: [[320, 40, 12], [300, 40, 20], [330, 70, 95], [[330, 90, 70], [190, 85, 65], [50, 95, 65], [280, 80, 72], [10, 90, 72], [150, 70, 65]]],
    rust: [[20, 30, 7], [20, 35, 13], [35, 40, 88], [[20, 75, 45], [35, 60, 55], [10, 55, 32], [190, 25, 40], [40, 35, 70], [0, 40, 28]]]
  }[scheme] || null;
  const abs = ['sunset', 'ice', 'toxic', 'candy', 'rust'].includes(scheme);
  const at = (dh, s2, l) => (abs ? `hsl(${dh},${s2}%,${l}%)` : c(dh, s2, l));
  const [bg, bg2, ink, cs] = P;
  // absolute schemes still lean a little toward the theme hue
  const shift = (x) => (abs ? [x[0] + ((h % 40) - 20), x[1], x[2]] : x);
  return { scheme, bg: at(...shift(bg)), bg2: at(...shift(bg2)), ink: at(...shift(ink)), c: cs.map((x) => at(...shift(x))), hue: h };
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.pixel = true; return c; }
function hsl(h, s, l) { return `hsl(${((h % 360) + 360) % 360},${s}%,${l}%)`; }

// ---------------------------------------------------------------- shared rendering helpers
const isReady = (i) => !!i && (i instanceof HTMLCanvasElement || (i.complete && i.naturalWidth > 0));
// redraw a generated sprite once its texture/head images arrive (canvases update in place)
function whenLoaded(imgs, fn) { for (const i of imgs) if (i && !isReady(i) && i.addEventListener) i.addEventListener('load', fn, { once: true }); }
// Fill the opaque pixels of `c` with a texture photo multiplied over their colours.
function textureFill(c, tex, alpha = 0.85) {
  if (!isReady(tex)) return;
  const x = c.getContext('2d'), w = c.width, h = c.height;
  const keep = canvas(w, h); keep.getContext('2d').drawImage(c, 0, 0);
  x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = alpha; x.imageSmoothingEnabled = true;
  const tw = tex.naturalWidth || tex.width, th = tex.naturalHeight || tex.height, s = Math.max(w / tw, h / th) * 1.4;
  x.drawImage(tex, (w - tw * s) / 2, (h - th * s) / 2, tw * s, th * s);
  x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(keep, 0, 0);
  x.restore();
}
// dark outline around opaque pixels, with a few chips for a worn look
function outline(c, R, col = [18, 12, 9]) {
  const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), o = x.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = (y * w + xx) * 4;
    if (d.data[i + 3]) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = xx + a, Y = y + b; return X >= 0 && Y >= 0 && X < w && Y < h && d.data[(Y * w + X) * 4 + 3] > 40; });
    if (n && R() > 0.08) { o.data[i] = col[0]; o.data[i + 1] = col[1]; o.data[i + 2] = col[2]; o.data[i + 3] = 255; }
  }
  const oc = canvas(w, h); oc.getContext('2d').putImageData(o, 0, 0);
  x.drawImage(oc, 0, 0);
}
// grime: dirt specks, a scratch or two, darker lower half
function weather(c, R, amount = 1) {
  const x = c.getContext('2d'), w = c.width, h = c.height;
  x.save(); x.globalCompositeOperation = 'source-atop';
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,220,.08)'); g.addColorStop(1, 'rgba(20,10,0,.28)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h * 0.04 * amount; i++) { x.fillStyle = R() < 0.75 ? `rgba(30,20,10,${0.25 + R() * 0.4})` : `rgba(255,245,230,${0.15 + R() * 0.2})`; x.fillRect(Math.floor(R() * w), Math.floor(R() * h), 1, 1); }
  for (let i = 0; i < 2 * amount; i++) { x.strokeStyle = 'rgba(255,240,220,.18)'; x.lineWidth = 1; x.beginPath(); const sx = R() * w, sy = R() * h; x.moveTo(sx, sy); x.lineTo(sx + R() * 6 - 3, sy + R() * 6); x.stroke(); }
  x.restore();
}

// ---------------------------------------------------------------- monsters
const PLANS = ['blob', 'biped', 'quad', 'insect', 'serpent', 'floater', 'totem'];
// Returns { frames: [canvas, canvas], plan } — a two-frame animation.
// opts.tex: texture photo for the skin; opts.head: a PNG used as the head.
export function legacyMonster(seed, hue = 0, size = 18, tier = 0, opts = {}) {
  const key = `m${seed}|${hue}|${size}|${tier}|${opts.tex?.src || ''}|${opts.head?.src || ''}`;
  return memo(key, () => {
    const R0 = mulberry32(seed);
    const plan = opts.plan || PLANS[Math.floor(R0() * PLANS.length)];
    const S = Math.max(16, size + (opts.head ? 8 : 0)), W = S, H = S + 4, half = Math.ceil(W / 2);
    const h0 = hue + R0() * 50 - 25, h1 = h0 + 120 + R0() * 120;
    const body = (y) => hsl(h0, 50 + tier * 6, 64 - (y / H) * 30), acc = hsl(h1, 65, 55);
    const headBox = { x: 0, y: 0, w: 0 };
    const build = (R, frame) => {
      const c = canvas(W, H), x = c.getContext('2d');
      const ell = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, 7); x.fill(); };
      const limb = (x0, y0, x1, y1, w2, col) => { x.strokeStyle = col; x.lineWidth = w2; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
      const sw = frame ? 1 : -1, bob = frame ? 1 : 0, cx = W / 2;
      const bw = W * (0.26 + R() * 0.12), bh = H * (0.2 + R() * 0.1);
      let headY = H * 0.28, headR = W * (0.16 + R() * 0.06);
      if (plan === 'blob') { ell(cx, H * 0.58 + bob, W * 0.38, H * 0.3, body(H * 0.5)); for (let i = 0; i < 6; i++) ell(cx + (R() - 0.5) * W * 0.6, H * 0.6 + (R() - 0.5) * H * 0.4, 2 + R() * 3, 2 + R() * 3, R() < 0.5 ? acc : body(H * 0.6)); headY = H * 0.45 + bob; }
      else if (plan === 'biped') { limb(cx - 3, H * 0.62, cx - 4 - sw, H - 2, 3, body(H)); limb(cx + 3, H * 0.62, cx + 4 + sw, H - 2, 3, body(H)); ell(cx, H * 0.5 + bob, bw, bh, body(H * 0.5)); limb(cx - bw, H * 0.45 + bob, cx - bw - 4, H * 0.6 - sw * 2, 2, body(H * 0.5)); limb(cx + bw, H * 0.45 + bob, cx + bw + 4, H * 0.6 + sw * 2, 2, body(H * 0.5)); headY = H * 0.26 + bob; }
      else if (plan === 'quad') { ell(cx, H * 0.55 + bob, W * 0.42, bh, body(H * 0.5)); for (const lx of [-0.32, -0.14, 0.14, 0.32]) limb(cx + lx * W, H * 0.6, cx + lx * W + (lx < 0 ? -sw : sw), H - 2, 2.5, body(H)); headY = H * 0.36 + bob; }
      else if (plan === 'insect') { for (let k = 0; k < 3; k++) limb(cx - W * 0.1, H * (0.42 + k * 0.1), cx - W * 0.42, H * (0.36 + k * 0.16) + sw * (k % 2 ? 1 : -1), 1.5, outlineCol), limb(cx + W * 0.1, H * (0.42 + k * 0.1), cx + W * 0.42, H * (0.36 + k * 0.16) - sw * (k % 2 ? 1 : -1), 1.5, outlineCol); ell(cx, H * 0.46 + bob, W * 0.16, H * 0.1, body(H * 0.45)); ell(cx, H * 0.7 + bob, W * 0.2, H * 0.17, acc); limb(cx - 2, H * 0.2, cx - 6, H * 0.04, 1, outlineCol); limb(cx + 2, H * 0.2, cx + 6, H * 0.04, 1, outlineCol); headY = H * 0.28 + bob; headR *= 0.8; }
      else if (plan === 'serpent') { for (let k = 0; k < 7; k++) ell(cx + Math.sin(k * 0.9 + frame) * W * 0.22, H * 0.92 - k * H * 0.09, W * (0.18 - k * 0.012), W * 0.12, k % 2 ? acc : body(H - k * 3)); headY = H * 0.24 + bob; }
      else if (plan === 'floater') { for (let k = -2; k <= 2; k++) limb(cx + k * 3, H * 0.55, cx + k * 4 + Math.sin(frame * 2 + k) * 2, H - 2, 1.5, acc); ell(cx, H * 0.42 + bob, W * 0.36, H * 0.26, body(H * 0.4)); headY = H * 0.4 + bob; headR *= 1.2; }
      else { for (let k = 0; k < 3; k++) { x.fillStyle = k % 2 ? acc : body(H * 0.3 + k * 6); x.fillRect(cx - W * (0.3 - k * 0.04), H * (0.2 + k * 0.26), W * (0.6 - k * 0.08), H * 0.24); } headY = H * 0.3; }
      const pngHead = opts.head && isReady(opts.head);
      if (pngHead) { headBox.x = cx - headR * 1.5; headBox.y = headY - headR * 1.5; headBox.w = headR * 3; }
      else if (plan !== 'totem') { ell(cx, headY, headR * 1.2, headR, body(headY)); if (R() < 0.6 || tier > 1) { limb(cx - headR * 0.6, headY - headR * 0.6, cx - headR * 1.6, headY - headR * 2, 1.5, acc); limb(cx + headR * 0.6, headY - headR * 0.6, cx + headR * 1.6, headY - headR * 2, 1.5, acc); } }
      textureFill(c, opts.tex, 0.75);
      // face
      if (!pngHead) {
        const fy = Math.round(plan === 'totem' ? H * 0.28 : headY - 1), ex = Math.max(1, Math.round(headR * 0.55)), cyc = R() < 0.25;
        x.fillStyle = '#fff'; if (cyc) x.fillRect(Math.round(cx) - 1, fy - 1, 3, 3); else { x.fillRect(Math.round(cx - ex) - 1, fy - 1, 2, 2); x.fillRect(Math.round(cx + ex) - 1, fy - 1, 2, 2); }
        x.fillStyle = '#120c08'; if (cyc) x.fillRect(Math.round(cx), fy, 1, 1); else { x.fillRect(Math.round(cx - ex), fy, 1, 1); x.fillRect(Math.round(cx + ex) - 1, fy, 1, 1); }
        x.fillStyle = '#2a1410'; x.fillRect(Math.round(cx - headR * 0.4), fy + 2, Math.max(2, Math.round(headR * 0.8)), 1);
        if (R() < 0.4) { x.fillStyle = '#f4ead8'; x.fillRect(Math.round(cx - 1), fy + 2, 1, 1); x.fillRect(Math.round(cx + 1), fy + 2, 1, 1); }
      }
      outline(c, R);
      weather(c, R, 1 + tier * 0.2);
      if (pngHead) { x.imageSmoothingEnabled = true; const hw = headBox.w, ih = opts.head.naturalHeight || opts.head.height, iw = opts.head.naturalWidth || opts.head.width; const s2 = Math.min(hw / iw, hw / ih); x.drawImage(opts.head, cx - (iw * s2) / 2, headBox.y + (hw - ih * s2) / 2 + bob, iw * s2, ih * s2); }
      return c;
    };
    const outlineCol = '#1a120c';
    const frames = [canvas(W, H), canvas(W, H)];
    const paint = () => frames.forEach((f, k) => { const n = build(mulberry32(seed ^ 0x51ed), k); const x = f.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(n, 0, 0); });
    paint();
    whenLoaded([opts.tex, opts.head], paint);
    return { frames, plan, hue: h0 };
  });
}

// ---------------------------------------------------------------- humanoids
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0e0a0', '#a8b8ff', '#d9a0e8', '#7a5a4a', '#e8d0b8'];
const POSES = {
  idle: { arms: [[-3, 7], [3, 7]], legs: [[-1, 9], [1, 9]] },
  walk1: { arms: [[-4, 6], [4, 7]], legs: [[-4, 8], [3, 9]] },
  walk2: { arms: [[-1, 7], [1, 6]], legs: [[2, 9], [-3, 8]] },
  jump: { arms: [[-4, -3], [4, -3]], legs: [[-3, 6], [3, 5]] },
  punch: { arms: [[-1, 6], [9, 0]], legs: [[-3, 9], [3, 9]] },
  kick: { arms: [[-4, 3], [3, 4]], legs: [[-1, 9], [9, 2]] },
  special: { arms: [[8, 0], [9, 1]], legs: [[-3, 9], [3, 9]] },
  block: { arms: [[2, 1], [3, 0]], legs: [[-3, 9], [3, 9]] },
  hurt: { arms: [[-4, 1], [-2, 4]], legs: [[-3, 9], [0, 9]], lean: -1 }
};
const OUTFITS = ['shirt', 'robe', 'armor', 'coat', 'dress', 'rags'];
// Returns { idle, walk: [a, b], jump, punch, kick, special, block, hurt } canvases (facing right, 24×32).
export const LOOK = { skins: SKIN.length, outfits: OUTFITS };
// the old hand-drawn pixel people, now only a stand-in while MARROW renders the real ones
export function legacyHumanoid(seed, hue = 0, opts = {}) {
  const L = opts.look || {};
  const key = `h${seed}|${hue}|${opts.tex?.src || ''}|${opts.tex2?.src || ''}|${opts.head?.src || ''}|${JSON.stringify(L)}`;
  return memo(key, () => {
    const R = mulberry32(seed ^ 0x9e3779b9);
    // opts.look overrides any part (used by the character creator)
    const pickOr = (v, d) => (v ?? d);
    const skin = SKIN[pickOr(L.skin, Math.floor(R() * SKIN.length))];
    const sh = R() * 40 - 20, ph = R() * 60, hh = R() * 360, hl = 22 + R() * 30;
    const shirt = hsl(pickOr(L.shirt, hue + sh), 55, 48), pants = hsl(pickOr(L.pants, hue + 180 + ph), 30, 30), hair = hsl(pickOr(L.hair, hh), 45, hl);
    const outfit = OUTFITS[pickOr(L.outfit, Math.floor(R() * OUTFITS.length))], build = pickOr(L.build, 0.8 + R() * 0.6), tall = pickOr(L.tall, R() < 0.3);
    const hat = pickOr(L.hat, R() < 0.45 ? Math.floor(R() * 4) : -1), cape = pickOr(L.cape, R() < 0.25), prop = pickOr(L.prop, R() < 0.35 ? Math.floor(R() * 3) : -1), beard = pickOr(L.beard, R() < 0.2);
    const sheet = {};
    const frames = {};
    for (const [name, p] of Object.entries(POSES)) {
      frames[name] = canvas(24, 32);
      const draw = () => {
        const c = canvas(24, 32), x = c.getContext('2d');
        const lean = p.lean || 0, cx = 11 + lean, top = tall ? 2 : 4;
        const ln = (x0, y0, x1, y1, col, w2) => { x.strokeStyle = col; x.lineWidth = w2; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
        if (cape) { x.fillStyle = hsl(pickOr(L.capeHue, hue + 200), 45, 28); x.beginPath(); x.moveTo(cx - 3, top + 9); x.lineTo(cx + 3, top + 9); x.lineTo(cx + 5, top + 24); x.lineTo(cx - 6, top + 24); x.fill(); }
        // legs
        if (outfit !== 'robe' && outfit !== 'dress') p.legs.forEach(([dx, dy], i) => ln(cx - 1.5 + i * 3, top + 18, cx - 1.5 + i * 3 + dx, top + 18 + dy, pants, 3 * build));
        else p.legs.forEach(([dx, dy], i) => ln(cx - 1.5 + i * 3, top + 22, cx - 1.5 + i * 3 + dx * 0.5, top + 18 + dy, '#2a1e18', 2));
        // body
        x.fillStyle = shirt;
        const tw = 4 * build;
        if (outfit === 'robe' || outfit === 'dress') { x.beginPath(); x.moveTo(cx - tw, top + 8); x.lineTo(cx + tw, top + 8); x.lineTo(cx + tw + (outfit === 'dress' ? 4 : 2), top + 24); x.lineTo(cx - tw - (outfit === 'dress' ? 4 : 2), top + 24); x.fill(); }
        else { x.fillRect(cx - tw, top + 8, tw * 2, 11); if (outfit === 'coat') x.fillRect(cx - tw - 1, top + 16, tw * 2 + 2, 6); }
        if (outfit === 'armor') { x.fillStyle = hsl(hue, 10, 60); x.fillRect(cx - tw - 2, top + 8, 3, 3); x.fillRect(cx + tw - 1, top + 8, 3, 3); }
        // arms
        p.arms.forEach(([dx, dy], i) => { const sx = i ? cx + tw - 1 : cx - tw + 1; ln(sx, top + 9, sx + dx, top + 9 + dy, shirt, 2.5); x.fillStyle = skin; x.fillRect(sx + dx - 1, top + 9 + dy - 1, 3, 3); });
        if (prop >= 0) { const [dx, dy] = p.arms[1], hx = cx + tw - 1 + dx, hy = top + 9 + dy; ln(hx, hy + (prop === 0 ? 6 : 0), hx + (prop === 1 ? 5 : 0), hy - 8, prop === 2 ? '#c9a24a' : '#5a3a22', prop === 1 ? 1.5 : 1.8); }
        textureFill(c, opts.tex, 0.7);
        // head
        if (!(opts.head && isReady(opts.head))) {
          x.fillStyle = skin; x.fillRect(cx - 3, top, 7, 7);
          x.fillStyle = hair; x.fillRect(cx - 3, top - 1, 7, 2); x.fillRect(cx - 3, top, 1, 4);
          if (beard) { x.fillStyle = hair; x.fillRect(cx - 2, top + 5, 6, 3); }
          x.fillStyle = name === 'hurt' ? '#fff' : '#120d0a'; x.fillRect(cx + 2, top + 3, 1, 1);
          if (hat === 0) { x.fillStyle = hsl(hue + 90, 50, 35); x.fillRect(cx - 4, top - 1, 9, 1); x.fillRect(cx - 2, top - 4, 5, 3); }
          else if (hat === 1) { x.fillStyle = hsl(hue + 30, 60, 45); x.beginPath(); x.moveTo(cx - 4, top); x.lineTo(cx + 1, top - 8); x.lineTo(cx + 5, top); x.fill(); }
          else if (hat === 2) { x.fillStyle = '#d8c070'; x.fillRect(cx - 3, top - 2, 7, 2); x.fillRect(cx - 3, top - 4, 1, 2); x.fillRect(cx, top - 4, 1, 2); x.fillRect(cx + 3, top - 4, 1, 2); }
          else if (hat === 3) { x.fillStyle = hsl(hue + 200, 40, 30); x.fillRect(cx - 4, top - 2, 9, 3); }
        }
        outline(c, R);
        weather(c, R, outfit === 'rags' ? 2 : 1);
        if (opts.head && isReady(opts.head)) { const ih = opts.head.naturalHeight || opts.head.width, iw = opts.head.naturalWidth || opts.head.width, s2 = Math.min(11 / iw, 11 / ih); x.drawImage(opts.head, cx - (iw * s2) / 2 + 0.5, top + 4 - (ih * s2) / 2 - 1, iw * s2, ih * s2); }
        const f = frames[name], fx = f.getContext('2d'); fx.clearRect(0, 0, 24, 32); fx.drawImage(c, 0, 0);
      };
      draw();
      whenLoaded([opts.tex, opts.head], draw);
      sheet[name] = frames[name];
    }
    return { ...sheet, walk: [sheet.walk1, sheet.walk2], outfit };
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

// People: MARROW characters (physically simulated bodies, cloth and hair, pixel
// renders). Theme seeds share a pool of 120 characters so each is built once.
export function humanoid(seed, hue = 0, opts = {}) {
  const ph = legacyHumanoid(seed, hue, opts);
  if (typeof Worker === 'undefined' || opts.legacy) return ph;
  const id = opts.marrow ? seed : (((seed >>> 0) * 2654435761) >>> 0) % 120 + 1;
  return memo(`mh${id}|${JSON.stringify(opts.marrow || null)}|${opts.monsters ? 1 : 0}`, () => marrowSheet(id, { look: opts.marrow, monsters: opts.monsters }, ph));
}

// Creatures: BEASTS (skeleton + signed-distance pixel renderer, procedural poses).
// Returns { frames: [a, b], walk, attack, hurt, dead, plan, hue }.
export function monster(seed, hue = 0, size = 18, tier = 0, opts = {}) {
  return memo(`b${seed}|${Math.round(hue)}|${size}|${tier}|${opts.plan || ''}`, () => beast(seed, hue, size, tier, { plan: opts.plan, grit: opts.grit }));
}
