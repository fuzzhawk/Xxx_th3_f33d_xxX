// Garden: one shared garden, saved on the phone, that grows in real time. Every garden card opens
// the same garden. Walk your hero about (tap the ground), plant flowers, shrubs and trees, water
// them, feed the animals that move in (fed pairs have young), and clear the tall grass to widen the
// garden and uncover old ruins, which give rare seeds. No enemies. The light follows the feed:
// pastel spring in the morning, lively weather in the day, dusk in the evening. On autopilot the
// gardener only waters, wanders and visits the animals; planting, clearing and digging are yours.
import { Game, W, H, roundRect, noiseMap } from './engine.js';
import { Actor } from '../crystal/sprites.js';
import { mulberry32 } from '../util.js';
import { idbGet, idbSet } from '../store.js';
import { getMode } from '../modes.js';

const T = 16, GW = 72, GH = 72, MID = 36, KEY = 'garden-v1', HR = 3600e3, Z = 1.5, VW = W / Z, VH = H / Z;
const now = () => Date.now();

// ------------------------------------------------ what grows
const PLANTS = {
  daisy: { type: 'flower', hours: 2, name: 'Daisy', petal: '#ffffff', mid: '#f6d35b' },
  tulip: { type: 'flower', hours: 3, name: 'Tulip', petal: '#f59ab8', mid: '#fbd3e2', cup: true },
  poppy: { type: 'flower', hours: 2.5, name: 'Poppy', petal: '#ff8a7a', mid: '#4a2f2f' },
  lavender: { type: 'flower', hours: 3, name: 'Lavender', petal: '#b49be8', spike: true },
  bluebell: { type: 'flower', hours: 3, name: 'Bluebell', petal: '#8fb2f0', bell: true },
  cosmos: { type: 'flower', hours: 2.5, name: 'Cosmos', petal: '#f6b3e0', mid: '#f3d27a' },
  sunflower: { type: 'flower', hours: 5, name: 'Sunflower', petal: '#ffd43b', mid: '#7a4b22', tall: true },
  berrybush: { type: 'shrub', hours: 8, name: 'Berry bush', leaf: '#5e9e55', fruit: '#d6455e', food: true },
  rosebush: { type: 'shrub', hours: 10, name: 'Rose bush', leaf: '#4f8f4a', bloom: '#f28aa8' },
  hydrangea: { type: 'shrub', hours: 9, name: 'Hydrangea', leaf: '#5a9a62', bloom: '#a9bdf7' },
  apple: { type: 'tree', hours: 30, name: 'Apple tree', leaf: '#6fb15f', fruit: '#e2453f', food: true },
  cherry: { type: 'tree', hours: 24, name: 'Cherry tree', leaf: '#f5b5cc', blossom: true },
  willow: { type: 'tree', hours: 28, name: 'Willow', leaf: '#8cc27a', willow: true },
  birch: { type: 'tree', hours: 26, name: 'Birch', leaf: '#a9d47f', birch: true },
  oak: { type: 'tree', hours: 40, name: 'Oak', leaf: '#4f8f4a' },
  moonflower: { type: 'flower', hours: 3, name: 'Moonflower', petal: '#eef4ff', mid: '#9fd8ff', glow: '#bfe6ff' },
  crystallily: { type: 'flower', hours: 4, name: 'Crystal lily', petal: '#9ff0f0', mid: '#ffffff', glow: '#9ff0f0', crystal: true },
  lanterntree: { type: 'tree', hours: 20, name: 'Lantern tree', leaf: '#3f6f5a', fruit: '#ffd76a', glow: '#ffd76a', food: true },
  spirittree: { type: 'tree', hours: 36, name: 'Spirit tree', leaf: '#5fc0b0', glow: '#bff7ea' }
};
const COMMON = ['daisy', 'tulip', 'poppy', 'lavender', 'bluebell', 'cosmos', 'sunflower', 'berrybush', 'rosebush', 'hydrangea', 'apple', 'cherry', 'willow', 'birch', 'oak'];
const stageOf = (p) => (p.g < 0.12 ? 0 : p.g < 0.4 ? 1 : p.g < 0.8 ? 2 : 3);
const FRUIT_CAP = { tree: 4, shrub: 5 };

// who moves in, and what draws them
const ANIMALS = {
  butterfly: { fly: true, speed: 20, cap: 10, why: 'flowers', need: (s) => s.bloom >= 2, eats: false },
  bee: { fly: true, speed: 26, cap: 8, why: 'blossoms', need: (s) => s.bloom >= 5, eats: false },
  songbird: { fly: true, speed: 34, cap: 8, why: 'trees', need: (s) => s.trees >= 1, eats: true },
  rabbit: { speed: 30, cap: 8, why: 'clover and berries', need: (s) => s.plants >= 6 && s.shrubs >= 1, eats: true, hop: true },
  hedgehog: { speed: 14, cap: 4, why: 'the shrubs', need: (s) => s.shrubs >= 2 && s.plants >= 10, eats: true },
  squirrel: { speed: 36, cap: 5, why: 'the grown trees', need: (s) => s.bigTrees >= 2, eats: true, hop: true },
  duck: { speed: 16, cap: 6, why: 'the pond', need: (s) => s.ponds >= 1, eats: true, water: true },
  frog: { speed: 12, cap: 6, why: 'the pond', need: (s) => s.ponds >= 1, eats: false, hop: true, shore: true },
  deer: { speed: 22, cap: 4, why: 'the open meadow', need: (s) => s.trees >= 3 && s.cleared >= 320, eats: true },
  fox: { speed: 30, cap: 2, why: 'all the life here', need: (s) => s.animals >= 12, eats: true },
  owl: { fly: true, speed: 18, cap: 2, why: 'the old trees', need: (s) => s.bigTrees >= 3, eats: false, night: true }
};

// ruins under the overgrowth: [type, name, lore, rare seed, footprint w, h]
const RUINS = [
  ['fountain', 'the Moss Fountain', 'Water still trickles from a spring nobody has found.', 'moonflower', 2, 2],
  ['stones', 'the Singing Stones', 'When the wind passes through them they hum one low note.', 'crystallily', 3, 3],
  ['arch', 'the Root Arch', 'Roots have grown through the old stones into a doorway.', 'lanterntree', 2, 1],
  ['statue', 'the Fox Statue', 'A stone fox, worn smooth by many hands.', 'cherry', 1, 1],
  ['shrine', 'the Lantern Shrine', 'A tiny shrine. Its lantern lights itself at dusk.', 'lanterntree', 1, 1],
  ['obelisk', 'the Star Obelisk', 'Carved with constellations that are not ours.', 'spirittree', 1, 1],
  ['well', 'the Wishing Well', 'Coins at the bottom, older than any country.', 'moonflower', 1, 1],
  ['sundial', 'the Sundial of Slow Hours', 'Its shadow moves a little slower than time.', 'crystallily', 1, 1],
  ['hand', 'the Sleeping Giant’s Hand', 'A great stone hand, palm up, cradling moss.', 'spirittree', 2, 1],
  ['glyphs', 'the Glyph Floor', 'Patterned tiles that glow faintly after dark.', 'moonflower', 3, 3],
  ['owlstatue', 'the Owl of the Gate', 'An owl carved from one stone, watching the east.', 'willow', 1, 1]
];

const PAL = {
  morning: { grass: ['#b2deae', '#a5d6a3', '#bee6b8'], dot: ['#ffc4d8', '#fff0b8', '#dccfff', '#ffffff'], wild: ['#86c191', '#72b282', '#5fa274'], blade: '#9cd1a2', path: '#efdcc8', water: '#a9d8f1', water2: '#d4eefa', sand: '#f3e3c8', stone: '#ddd6d0', stone2: '#c6bcb4', moss: '#a6cf9a' },
  day: { grass: ['#88cb70', '#7cc265', '#93d27a'], dot: ['#ff6b8a', '#ffd23f', '#ffffff', '#b28dff'], wild: ['#5ea55b', '#51974f', '#438843'], blade: '#74b766', path: '#dcc196', water: '#5aaee6', water2: '#9dd6f6', sand: '#ecd7a6', stone: '#bcb5ab', stone2: '#9d958b', moss: '#6ea85c' },
  evening: { grass: ['#7ea877', '#73a06d', '#87b07f'], dot: ['#f0b8d0', '#f8e0a0', '#c8b8f0', '#ffffff'], wild: ['#527f57', '#47734d', '#3c6643'], blade: '#6a9a68', path: '#cfb390', water: '#5f8cc0', water2: '#86afda', sand: '#d9bf98', stone: '#aaa2a8', stone2: '#8c8492', moss: '#5e8a62' }
};

// ------------------------------------------------ tiny pixel sprite helpers
function mk(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; }
function ell(c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) c.fillRect(x, y, 1, 1);
  }
}
const px = (c, x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
function tone(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

const spriteCache = new Map();
function plantSprite(k, st, fruit) {
  const key = `${k}|${st}|${fruit ? 1 : 0}`;
  let s = spriteCache.get(key);
  if (s) return s;
  const P = PLANTS[k], stem = '#5f9a4e', leaf = '#76b35f';
  let cv, c;
  if (st === 0) { [cv, c] = mk(8, 5); ell(c, 4, 3.5, 3.5, 1.6, '#9b7653'); px(c, 3, 2, '#b8936b', 2); px(c, 4, 1, '#7fbf68'); }
  else if (P.type === 'flower') {
    if (st === 1) { [cv, c] = mk(8, 8); px(c, 4, 3, stem, 1, 5); ell(c, 2.5, 4, 1.8, 1, leaf); ell(c, 5.5, 3, 1.8, 1, leaf); }
    else {
      const big = st === 3, tall = P.tall && big, h = tall ? 24 : big ? 16 : 11;
      [cv, c] = mk(tall ? 14 : 12, h);
      const cx = Math.floor(cv.width / 2), top = tall ? 5 : big ? 4 : 3;
      px(c, cx, top, stem, 1, h - top);
      ell(c, cx - 2, h - 4, 2, 1, leaf); ell(c, cx + 2.5, h - 6, 2, 1, leaf);
      if (!big) { ell(c, cx + 0.5, top, 1.6, 2, P.petal); }
      else if (P.spike) { for (let i = 0; i < 7; i++) px(c, cx - (i % 2), top - 2 + i, i % 3 ? P.petal : tone(P.petal, -0.2), 2); }
      else if (P.bell) { for (const [dx, dy] of [[-2, 0], [1, 2], [-1, 4]]) { ell(c, cx + dx + 0.5, top + dy + 1, 1.5, 1.4, P.petal); px(c, cx + dx, top + dy + 2, tone(P.petal, -0.25)); } }
      else if (P.cup) { ell(c, cx + 0.5, top + 1, 2.5, 2.4, P.petal); px(c, cx - 1, top - 2, P.petal); px(c, cx + 1, top - 2, P.petal); px(c, cx, top - 1, tone(P.petal, 0.3)); }
      else if (P.crystal) { c.fillStyle = P.petal; c.beginPath(); c.moveTo(cx + 0.5, top - 3); c.lineTo(cx + 3.5, top + 1); c.lineTo(cx + 0.5, top + 4); c.lineTo(cx - 2.5, top + 1); c.fill(); px(c, cx, top, '#fff'); }
      else {
        const r = tall ? 4.6 : 3.2;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ell(c, cx + 0.5 + Math.cos(a) * r * 0.75, top + 1 + Math.sin(a) * r * 0.75, r * 0.45, r * 0.45, P.petal); }
        ell(c, cx + 0.5, top + 1, r * 0.45, r * 0.45, P.mid);
      }
    }
  } else if (P.type === 'shrub') {
    if (st === 1) { [cv, c] = mk(8, 7); ell(c, 4, 4.5, 3, 2.4, P.leaf); }
    else {
      const big = st === 3, w = big ? 18 : 12, h = big ? 14 : 9;
      [cv, c] = mk(w, h);
      ell(c, w / 2, h / 2 + 1, w / 2 - 0.5, h / 2 - 0.5, tone(P.leaf, -0.25));
      ell(c, w / 2, h / 2, w / 2 - 1, h / 2 - 1.2, P.leaf);
      ell(c, w / 2 - 2, h / 2 - 1.5, w / 4, h / 4, tone(P.leaf, 0.2));
      const R = mulberry32(k.length * 97 + st);
      if (big && (P.bloom || (P.fruit && fruit))) for (let i = 0; i < 9; i++) { const x = 2 + R() * (w - 4), y = 2 + R() * (h - 4); px(c, x | 0, y | 0, P.bloom || P.fruit, 2, 2); px(c, x | 0, y | 0, tone(P.bloom || P.fruit, 0.4)); }
    }
  } else {
    if (st === 1) { [cv, c] = mk(8, 12); px(c, 4, 4, '#8a6a4a', 1, 8); ell(c, 2.5, 5, 1.8, 1, leaf); ell(c, 5.5, 3.5, 1.8, 1, P.leaf); }
    else {
      const big = st === 3, w = big ? 34 : 18, h = big ? 46 : 26, tw = big ? 4 : 2, th = big ? 16 : 10;
      [cv, c] = mk(w, h);
      const trunk = P.birch ? '#eeeae2' : '#8a6446';
      px(c, w / 2 - tw / 2, h - th, trunk, tw, th);
      if (P.birch) for (let y = h - th; y < h; y += 3) px(c, w / 2 - tw / 2 + (y % 2), y, '#3a3430', 2, 1);
      else px(c, w / 2 - tw / 2, h - th, tone(trunk, -0.25), 1, th);
      const cy = big ? 17 : 10, rx = big ? 15 : 8, ry = big ? 13 : 7, L = P.leaf;
      ell(c, w / 2, cy + 2, rx, ry, tone(L, -0.28));
      ell(c, w / 2, cy, rx - 1, ry - 1, L);
      if (big) { ell(c, w / 2 - 7, cy + 3, 7, 6, L); ell(c, w / 2 + 7, cy + 3, 7, 6, L); }
      ell(c, w / 2 - rx / 3, cy - ry / 3, rx / 2.2, ry / 2.4, tone(L, 0.22));
      const R = mulberry32(k.length * 131 + st);
      if (P.willow) for (let i = 0; i < (big ? 14 : 7); i++) { const x = (w / 2 - rx + 2 + R() * (rx * 2 - 4)) | 0; px(c, x, cy, tone(L, -0.12), 1, (big ? 14 : 8) + (R() * 6 | 0)); }
      if (P.blossom) for (let i = 0; i < (big ? 26 : 10); i++) px(c, (w / 2 - rx + 2 + R() * (rx * 2 - 4)) | 0, (cy - ry + 2 + R() * (ry * 2 - 3)) | 0, R() < 0.5 ? '#ffffff' : '#ffd6e4', 2, 1);
      if (P.fruit && fruit && big) for (let i = 0; i < 7; i++) { const x = (w / 2 - rx + 3 + R() * (rx * 2 - 6)) | 0, y = (cy - 3 + R() * ry) | 0; px(c, x, y, P.fruit, 2, 2); px(c, x, y, tone(P.fruit, 0.45)); }
      if (P.glow && big && !P.fruit) for (let i = 0; i < 10; i++) px(c, (w / 2 - rx + 3 + R() * (rx * 2 - 6)) | 0, (cy - ry + 3 + R() * (ry * 2 - 4)) | 0, P.glow);
    }
  }
  s = { cv, w: cv.width, h: cv.height };
  spriteCache.set(key, s);
  return s;
}

// animals: two frames each, drawn facing right
function animalSprite(k, f) {
  const key = `a|${k}|${f}`;
  let s = spriteCache.get(key);
  if (s) return s;
  let cv, c;
  const B = '#2a2224';
  switch (k) {
    case 'rabbit': [cv, c] = mk(12, 11); { const up = f ? 1 : 0; ell(c, 5.5, 7 - up, 4.5, 3, '#d9c7b4'); ell(c, 9, 5 - up, 2.6, 2.4, '#d9c7b4'); px(c, 8, 0 - up + 1, '#d9c7b4', 1, 3); px(c, 10, 0 - up + 1, '#cdb8a4', 1, 3); px(c, 8, 1 - up + 1, '#f2c2c8'); ell(c, 1.8, 6.5 - up, 1.4, 1.4, '#ffffff'); px(c, 10, 4 - up, B); px(c, 11, 5 - up, '#e89aa6'); if (f) { px(c, 2, 9, '#c9b6a2', 2, 1); px(c, 7, 9, '#c9b6a2', 2, 1); } else { px(c, 3, 9, '#c9b6a2', 2, 2); px(c, 7, 9, '#c9b6a2', 2, 2); } } break;
    case 'deer': [cv, c] = mk(16, 17); { ell(c, 7, 9, 5.5, 3.2, '#b78456'); for (const x of [3, 5, 9, 11]) px(c, x + (f && (x === 5 || x === 11) ? 1 : 0), 11, '#8f6440', 1, 6); px(c, 11, 3, '#b78456', 2, 6); ell(c, 13, 3, 2.4, 1.8, '#b78456'); px(c, 14, 2, B); px(c, 15, 3, B); px(c, 12, 0, '#8a6a4a', 1, 2); px(c, 13, 0, '#8a6a4a'); ell(c, 2, 8, 1.2, 1.2, '#f4eee6'); for (const x of [5, 8, 6]) px(c, x, 8, '#efe0cc'); } break;
    case 'duck': [cv, c] = mk(11, 9); { ell(c, 5, 6, 4.5, 2.6, '#f4efe6'); ell(c, 8.5, 3, 2, 2, '#4f9a6a'); px(c, 10, 3, '#f0a030', 1, 1); px(c, 9, 2, B); px(c, 2, 4 + f, '#e6dfd3', 3, 1); } break;
    case 'songbird': [cv, c] = mk(9, 7); { ell(c, 4, 4, 3, 2.2, '#8a6a5a'); ell(c, 5, 4.6, 2, 1.4, '#f07a5a'); ell(c, 6.5, 2.5, 1.6, 1.6, '#8a6a5a'); px(c, 7, 2, B); px(c, 8, 2, '#f0b040'); if (f) px(c, 2, 1, '#6a4e40', 3, 2); else px(c, 1, 4, '#6a4e40', 3, 1); } break;
    case 'butterfly': [cv, c] = mk(9, 7); { const cols = ['#f7a8c8', '#ffe08a', '#b9a8f5', '#9fd8f0']; const col = cols[(k.length + f) % 4]; if (f) { ell(c, 2.5, 2.5, 2.3, 2.3, col); ell(c, 6.5, 2.5, 2.3, 2.3, col); ell(c, 3, 5, 1.6, 1.4, tone(col, -0.1)); ell(c, 6, 5, 1.6, 1.4, tone(col, -0.1)); } else { ell(c, 3.5, 3, 1.2, 2.6, col); ell(c, 5.5, 3, 1.2, 2.6, col); } px(c, 4, 1, B, 1, 5); } break;
    case 'bee': [cv, c] = mk(7, 5); { ell(c, 3.5, 3, 2.6, 1.7, '#f6c445'); px(c, 3, 2, B, 1, 3); px(c, 5, 2, B, 1, 2); px(c, 2 + f, 0, '#e8f4ff', 2, 2); } break;
    case 'hedgehog': [cv, c] = mk(11, 7); { ell(c, 5, 4.5, 4.5, 2.6, '#7a5a40'); for (let i = 1; i < 9; i += 2) px(c, i, 1 + (i % 3 === 0 ? 1 : 0), '#5e4430', 1, 2); ell(c, 9, 5, 1.8, 1.4, '#d8bc98'); px(c, 10, 4, B); px(c, 10, 6, B); px(c, 3 + f, 6, '#5e4430'); } break;
    case 'frog': [cv, c] = mk(8, 6); { ell(c, 4, 4, 3.5, 2 - f * 0.4, '#7cc46a'); px(c, 2, 1, '#7cc46a', 2, 2); px(c, 5, 1, '#7cc46a', 2, 2); px(c, 2, 1, B); px(c, 6, 1, B); px(c, 3, 4, '#5a9a4a', 3, 1); } break;
    case 'fox': [cv, c] = mk(15, 10); { ell(c, 7, 6, 5, 2.6, '#e88a3c'); ell(c, 2, 5, 2.6, 1.8, '#e88a3c'); px(c, 0, 5, '#ffffff', 2, 1); ell(c, 12, 4, 2.6, 2.2, '#e88a3c'); px(c, 11, 1, '#c86a2a', 1, 2); px(c, 13, 1, '#c86a2a', 1, 2); px(c, 13, 4, B); px(c, 14, 5, '#ffffff'); for (const x of [4, 9]) px(c, x + f, 8, '#5a3a2a', 1, 2); } break;
    case 'squirrel': [cv, c] = mk(10, 10); { ell(c, 2.5, 3.5 + f, 2.4, 3.4, '#c0703a'); ell(c, 6, 6, 2.6, 2.4, '#c87a44'); ell(c, 7.5, 3.5, 1.8, 1.8, '#c87a44'); px(c, 8, 3, B); px(c, 7, 1, '#a85a2a'); px(c, 5, 8, '#a85a2a', 2, 1); } break;
    case 'owl': [cv, c] = mk(9, 10); { ell(c, 4.5, 5.5, 3.6, 4.2, '#8a6a52'); ell(c, 4.5, 6.5, 2.4, 2.8, '#c9b096'); px(c, 2, 3, '#ffe9a8', 2, 2); px(c, 5, 3, '#ffe9a8', 2, 2); px(c, 2 + f, 3, B); px(c, 5 + f, 3, B); px(c, 4, 5, '#e0a040'); px(c, 1, 1, '#8a6a52'); px(c, 7, 1, '#8a6a52'); } break;
    default: [cv, c] = mk(6, 6); ell(c, 3, 3, 2.5, 2.5, '#fff');
  }
  s = { cv, w: cv.width, h: cv.height };
  spriteCache.set(key, s);
  return s;
}

function ruinSprite(type, P) {
  const key = `r|${type}|${P.stone}`;
  let s = spriteCache.get(key);
  if (s) return s;
  let cv, c;
  const st = P.stone, dk = P.stone2, mo = P.moss;
  switch (type) {
    case 'fountain': [cv, c] = mk(32, 22); ell(c, 16, 14, 15, 7, dk); ell(c, 16, 13, 13.5, 5.8, st); ell(c, 16, 13, 11, 4.4, P.water); px(c, 15, 2, st, 3, 10); ell(c, 16.5, 3, 3, 1.6, st); px(c, 4, 15, mo, 4, 2); px(c, 24, 9, mo, 3, 1); break;
    case 'stones': [cv, c] = mk(10, 18); px(c, 1, 2, dk, 8, 16); px(c, 2, 1, st, 6, 16); px(c, 2, 1, mo, 3, 2); px(c, 3, 8, dk, 1, 3); break;
    case 'arch': [cv, c] = mk(32, 30); px(c, 2, 6, dk, 7, 24); px(c, 23, 6, dk, 7, 24); px(c, 3, 6, st, 5, 24); px(c, 24, 6, st, 5, 24); px(c, 1, 2, dk, 30, 6); px(c, 2, 1, st, 28, 5); px(c, 6, 1, mo, 8, 2); px(c, 20, 26, mo, 6, 2); for (let i = 0; i < 6; i++) px(c, 8 + i * 3, 6 + (i % 2) * 2, '#7a5a3a', 1, 6); break;
    case 'statue': case 'owlstatue': [cv, c] = mk(16, 24); px(c, 2, 18, dk, 12, 6); px(c, 3, 17, st, 10, 6); if (type === 'statue') { ell(c, 8, 12, 5, 4, st); ell(c, 11, 7, 3, 3, st); px(c, 10, 3, st); px(c, 12, 3, st); ell(c, 3, 10, 2, 3, st); } else { ell(c, 8, 10, 4.5, 6, st); px(c, 5, 6, dk, 2, 2); px(c, 9, 6, dk, 2, 2); px(c, 5, 3, st); px(c, 10, 3, st); } px(c, 4, 15, mo, 4, 2); break;
    case 'shrine': [cv, c] = mk(18, 24); px(c, 3, 10, '#a0563a', 2, 14); px(c, 13, 10, '#a0563a', 2, 14); px(c, 1, 8, '#7a3a2a', 16, 3); px(c, 0, 6, '#c0603a', 18, 2); px(c, 6, 14, '#e8d8b8', 6, 7); px(c, 8, 16, '#ffd76a', 2, 3); break;
    case 'obelisk': [cv, c] = mk(10, 32); c.fillStyle = dk; c.beginPath(); c.moveTo(1, 32); c.lineTo(3, 4); c.lineTo(5, 0); c.lineTo(7, 4); c.lineTo(9, 32); c.fill(); c.fillStyle = st; c.beginPath(); c.moveTo(2, 32); c.lineTo(4, 5); c.lineTo(5, 2); c.lineTo(6, 5); c.lineTo(7, 32); c.fill(); for (let y = 9; y < 28; y += 4) px(c, 4, y, '#9fd8ff', 2, 1); break;
    case 'well': [cv, c] = mk(18, 20); ell(c, 9, 14, 8, 5, dk); ell(c, 9, 13, 7, 4, st); ell(c, 9, 13, 5, 2.6, '#2a3a4a'); px(c, 2, 2, '#8a6446', 2, 12); px(c, 14, 2, '#8a6446', 2, 12); px(c, 1, 1, '#a0563a', 16, 2); break;
    case 'sundial': [cv, c] = mk(14, 14); px(c, 4, 6, dk, 6, 8); px(c, 5, 6, st, 4, 8); ell(c, 7, 5, 6, 2.6, st); c.fillStyle = dk; c.beginPath(); c.moveTo(7, 5); c.lineTo(7, 0); c.lineTo(10, 5); c.fill(); break;
    case 'hand': [cv, c] = mk(30, 18); ell(c, 15, 12, 13, 5, dk); ell(c, 15, 11, 12, 4.4, st); for (let i = 0; i < 4; i++) { px(c, 6 + i * 5, 2 + Math.abs(i - 1.5) * 2, st, 3, 9); px(c, 6 + i * 5, 2 + Math.abs(i - 1.5) * 2, mo, 3, 1); } ell(c, 15, 11, 6, 2, mo); break;
    default: [cv, c] = mk(8, 8); px(c, 0, 0, st, 8, 8);
  }
  s = { cv, w: cv.width, h: cv.height };
  spriteCache.set(key, s);
  return s;
}

// ------------------------------------------------ the shared garden (one per phone)
let G = null, loading = null;
const idx = (x, y) => y * GW + x;
function newGarden() {
  const seed = (Math.random() * 2 ** 31) | 0, R = mulberry32(seed);
  const n = noiseMap(R, GW, 4, 3);
  const wild = new Uint8Array(GW * GH), ground = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const d = Math.hypot(x - MID, y - MID), v = n[idx(x, y)];
    wild[idx(x, y)] = d < 6.5 ? 0 : d < 9 ? 1 : v > 0.58 ? 3 : v > 0.42 ? 2 : 1 + (d > 20 ? 1 : 0);
  }
  // ponds, the first one close by
  const ponds = [];
  for (let i = 0; i < 4; i++) {
    const a = R() * Math.PI * 2, d = i === 0 ? 12 : 15 + R() * 20, cx = MID + Math.cos(a) * d, cy = MID + Math.sin(a) * d, rx = 2.2 + R() * (i ? 2.5 : 1.2), ry = 1.8 + R() * (i ? 2 : 1);
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (x < 2 || y < 2 || x >= GW - 2 || y >= GH - 2) continue;
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (q <= 1) ground[idx(x, y)] = 2; else if (q <= 1.7 && ground[idx(x, y)] !== 2) ground[idx(x, y)] = 4;
    }
    ponds.push({ x: Math.round(cx), y: Math.round(cy), found: 0 });
  }
  // ruins, spaced out around the garden
  const ruins = [], order = [...RUINS].sort(() => R() - 0.5);
  for (const [i, r] of order.entries()) {
    for (let tries = 0; tries < 60; tries++) {
      const a = R() * Math.PI * 2, d = 9 + i * 2.4 + R() * 6, x = Math.round(MID + Math.cos(a) * d), y = Math.round(MID + Math.sin(a) * d);
      if (x < 3 || y < 3 || x + r[4] >= GW - 3 || y + r[5] >= GH - 3) continue;
      if (ruins.some((o) => Math.hypot(o.x - x, o.y - y) < 7)) continue;
      let bad = false;
      for (let yy = y - 1; yy <= y + r[5]; yy++) for (let xx = x - 1; xx <= x + r[4]; xx++) if (ground[idx(xx, yy)] === 2) bad = true;
      if (bad) continue;
      ruins.push({ t: r[0], name: r[1], lore: r[2], seed: r[3], x, y, w: r[4], h: r[5], found: 0 });
      for (let yy = y; yy < y + r[5]; yy++) for (let xx = x; xx < x + r[4]; xx++) wild[idx(xx, yy)] = Math.max(2, wild[idx(xx, yy)]);
      break;
    }
  }
  const t = now();
  return {
    v: 1, seed, created: t, saved: t, wild, ground, ruins, ponds,
    plants: [{ k: 'daisy', x: MID - 2, y: MID + 1, g: 0.95, w: 0, fr: 0, sd: 0 }, { k: 'daisy', x: MID - 3, y: MID + 2, g: 0.9, w: 0, fr: 0, sd: 0 }, { k: 'tulip', x: MID + 2, y: MID + 2, g: 0.5, w: 0, fr: 0, sd: 0 }, { k: 'cherry', x: MID + 3, y: MID - 3, g: 0.45, w: 0, fr: 0, sd: 0 }],
    animals: [{ id: 1, k: 'butterfly', x: (MID - 1) * T, y: MID * T, b: t - 30 * HR, f: 0, baby: 0 }, { id: 2, k: 'butterfly', x: (MID + 2) * T, y: (MID - 1) * T, b: t - 30 * HR, f: 0, baby: 0 }],
    nextId: 3,
    inv: { seeds: { daisy: 6, tulip: 4, lavender: 3, sunflower: 2, cosmos: 3, berrybush: 2, apple: 1, birch: 1 }, food: 4, pick: 'daisy' },
    hero: { x: MID * T + 8, y: (MID + 1) * T },
    log: [], firstVisit: 1
  };
}
const pack = (g) => ({ ...g, away: undefined, wild: Array.from(g.wild).join(''), ground: Array.from(g.ground).join('') });
const unpack = (o) => ({ ...o, wild: Uint8Array.from(o.wild, (ch) => +ch), ground: Uint8Array.from(o.ground, (ch) => +ch) });
async function loadGarden() {
  if (G) return G;
  loading ||= (async () => {
    let g = null;
    try { const o = await idbGet('kv', KEY); if (o?.v === 1) g = unpack(o); } catch { /* fresh one */ }
    G = g || newGarden();
    G.away = catchUp(G);
    return G;
  })();
  return loading;
}
let saveTimer = 0, dirty = false;
function saveGarden(soon = false) {
  if (!G) return;
  clearTimeout(saveTimer);
  dirty = true;
  const go = () => { dirty = false; G.saved = now(); idbSet('kv', KEY, pack(G)).catch(() => {}); };
  if (soon) saveTimer = setTimeout(go, 700); else go();
}
// leaving the app: don't lose the last thing planted
addEventListener('visibilitychange', () => { if (document.hidden && dirty) saveGarden(); });
addEventListener('pagehide', () => { if (dirty) saveGarden(); });

// counts that decide which animals come
function census(g) {
  const s = { plants: g.plants.length, bloom: 0, shrubs: 0, trees: 0, bigTrees: 0, ponds: g.ponds.filter((p) => p.found).length, cleared: 0, animals: g.animals.length };
  for (const p of g.plants) {
    const P = PLANTS[p.k], st = stageOf(p);
    if (P.type === 'flower' && st === 3) s.bloom++;
    if (P.type === 'shrub' && st >= 2) s.shrubs++;
    if (P.type === 'tree' && st >= 2) s.trees++;
    if (P.type === 'tree' && st === 3) s.bigTrees++;
  }
  for (let i = 0; i < g.wild.length; i++) if (!g.wild[i]) s.cleared++;
  return s;
}
const countKind = (g, k) => g.animals.filter((a) => a.k === k).length;

// a free cleared tile near (x, y), for seedlings and newcomers
function freeTile(g, x, y, r, R = Math.random, water = false) {
  for (let i = 0; i < 40; i++) {
    const tx = Math.round(x + (R() * 2 - 1) * r), ty = Math.round(y + (R() * 2 - 1) * r);
    if (tx < 1 || ty < 1 || tx >= GW - 1 || ty >= GH - 1) continue;
    const j = idx(tx, ty);
    if (g.wild[j]) continue;
    if (water ? g.ground[j] !== 2 : g.ground[j] === 2) continue;
    if (!water && g.plants.some((p) => p.x === tx && p.y === ty)) continue;
    if (g.ruins.some((u) => u.found && tx >= u.x && tx < u.x + u.w && ty >= u.y && ty < u.y + u.h)) continue;
    return [tx, ty];
  }
  return null;
}
function addAnimal(g, k, x, y, baby = 0) {
  const a = { id: g.nextId++, k, x, y, b: now(), f: 0, baby };
  g.animals.push(a);
  return a;
}
// newcomers drawn by what has grown: one or a pair per kind
function arrivals(g, max = 2) {
  const s = census(g), out = [];
  for (const [k, A] of Object.entries(ANIMALS)) {
    if (!A.need(s)) continue;
    const have = countKind(g, k);
    if (have >= Math.min(A.cap, 2)) continue;
    const want = Math.min(max, 2 - have);
    let n = 0;
    for (let i = 0; i < want; i++) {
      let pos = null;
      if (A.water) { const pd = g.ponds.find((p) => p.found); if (pd) pos = freeTile(g, pd.x, pd.y, 3, Math.random, true); }
      else pos = freeTile(g, MID, MID, 10);
      if (!pos) continue;
      addAnimal(g, k, pos[0] * T + 8, pos[1] * T + 8); n++;
    }
    const many = k === 'butterfly' ? 'butterflies' : k === 'fox' ? 'foxes' : `${k}s`;
    if (n) out.push(n > 1 ? `A pair of ${many} came for ${A.why}` : `A ${k} came for ${A.why}`);
  }
  return out;
}

// what happened while you were away (real time)
function catchUp(g) {
  const dtH = Math.min(168, (now() - (g.saved || now())) / HR);
  if (dtH < 0.05) return [];
  const msg = [], R = Math.random;
  let bloomed = 0, fruited = 0, sown = 0, born = 0, grew = 0;
  for (const p of g.plants) {
    const P = PLANTS[p.k], before = stageOf(p);
    p.g = Math.min(1, p.g + dtH / P.hours);
    if (before < 3 && stageOf(p) === 3) bloomed++;
    if (P.food && stageOf(p) === 3) { const f0 = p.fr; p.fr = Math.min(FRUIT_CAP[P.type] || 3, p.fr + Math.floor(dtH / 1.5)); if (p.fr > f0) fruited++; }
  }
  // flowers seed themselves
  if (g.plants.length < 240) for (const p of [...g.plants]) {
    if (PLANTS[p.k].type !== 'flower' || stageOf(p) < 3 || R() > dtH / 10) continue;
    const t = freeTile(g, p.x, p.y, 2);
    if (t) { g.plants.push({ k: p.k, x: t[0], y: t[1], g: 0.05 + R() * 0.3, w: 0, fr: 0, sd: 0 }); sown++; }
  }
  // the young grow up; fed pairs have young
  for (const a of g.animals) if (a.baby && now() - a.b > 24 * HR) { a.baby = 0; grew++; }
  for (const [k, A] of Object.entries(ANIMALS)) {
    const adults = g.animals.filter((a) => a.k === k && !a.baby), fed = adults.some((a) => a.f && g.saved - a.f < 24 * HR);
    if (adults.length < 2 || !(fed || !A.eats)) continue;
    let n = Math.min(A.cap - countKind(g, k), Math.floor(dtH / 8 * Math.floor(adults.length / 2) + (dtH > 6 ? 1 : 0)));
    while (n-- > 0) { const p = adults[Math.floor(R() * adults.length)]; addAnimal(g, k, p.x + 6, p.y + 4, 1); born++; }
  }
  const arr = arrivals(g, 2);
  if (bloomed) msg.push(`${bloomed} ${bloomed > 1 ? 'plants' : 'plant'} grew up or bloomed`);
  if (sown) msg.push(`${sown} seedlings sprouted on their own`);
  if (fruited) msg.push('There is fruit to pick');
  if (born) msg.push(`${born} ${born > 1 ? 'babies were' : 'baby was'} born`);
  if (grew) msg.push(`${grew} of the young ones grew up`);
  msg.push(...arr);
  g.saved = now();
  return msg;
}

// ------------------------------------------------ painted world layers, shared per mode
const layers = {};
function tileRand(x, y, k = 0) { return mulberry32((x * 7919 + y * 104729 + k * 31337) | 0); }
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), m = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
function paintGround(L, x, y) {
  const c = L.g, P = L.P, i = idx(x, y), R = tileRand(x, y), X = x * T, Y = y * T;
  const gr = G.ground[i];
  if (gr === 2) {
    c.fillStyle = P.water; c.fillRect(X, Y, T, T);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || G.ground[idx(nx, ny)] === 2) continue;
      c.fillStyle = P.water2; c.fillRect(X + (dx === 1 ? T - 3 : 0), Y + (dy === 1 ? T - 3 : 0), dx ? 3 : T, dy ? 3 : T);
    }
    return;
  }
  // grass tones drift smoothly across the garden, so tiles don't show
  const n = L.noise[i];
  c.fillStyle = gr === 4 ? P.sand : gr === 3 ? P.path : gr === 5 ? P.stone : mixHex(P.grass[1], P.grass[n > 0.5 ? 2 : 0], Math.abs(n - 0.5) * 1.6);
  c.fillRect(X, Y, T, T);
  if (gr === 5) { c.fillStyle = P.stone2; c.fillRect(X, Y + T - 1, T, 1); c.fillRect(X + T - 1, Y, 1, T); if (R() < 0.5) { c.fillStyle = P.moss; c.fillRect(X + (R() * 10 | 0), Y + (R() * 10 | 0), 4, 2); } return; }
  if (gr === 0) {
    for (let k = 0; k < 9; k++) { c.fillStyle = R() < 0.5 ? P.grass[0] : P.grass[2]; c.fillRect(X + (R() * 16 | 0), Y + (R() * 15 | 0), 1, 2); }
    if (R() < 0.22) { const col = P.dot[Math.floor(R() * P.dot.length)], fx = X + 2 + (R() * 11 | 0), fy = Y + 2 + (R() * 11 | 0); c.fillStyle = col; c.fillRect(fx - 1, fy, 3, 1); c.fillRect(fx, fy - 1, 1, 3); c.fillStyle = '#f6d35b'; c.fillRect(fx, fy, 1, 1); }
    // the tall grass above casts a soft shadow
    if (y > 0 && G.wild[idx(x, y - 1)]) { c.fillStyle = 'rgba(30,60,30,.16)'; c.fillRect(X, Y, T, 4); c.fillStyle = 'rgba(30,60,30,.08)'; c.fillRect(X, Y + 4, T, 3); }
  } else for (let k = 0; k < 5; k++) { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(X + (R() * 15 | 0), Y + (R() * 15 | 0), 2, 1); }
}
function paintWild(L, x, y) {
  const d = G.wild[idx(x, y)];
  if (!d) return;
  const c = L.w, P = L.P, R = tileRand(x, y, 3), X = x * T, Y = y * T;
  c.fillStyle = P.wild[Math.min(2, d)]; c.fillRect(X, Y, T, T);
  // clumps of meadow grass, lit from the top left
  for (let k = 0; k < 2 + d; k++) {
    const cx = X + 3 + R() * 10, cy = Y + 4 + R() * 10, rx = 3.5 + d + R() * 2, ry = 3 + d * 0.6;
    c.fillStyle = P.wild[Math.min(2, d)]; c.beginPath(); c.ellipse(cx, cy + 1.5, rx, ry, 0, 0, 7); c.fill();
    c.fillStyle = P.wild[d - 1]; c.beginPath(); c.ellipse(cx, cy, rx - 0.5, ry - 0.5, 0, 0, 7); c.fill();
    c.fillStyle = P.blade; c.beginPath(); c.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.45, ry * 0.4, 0, 0, 7); c.fill();
  }
  // blades poking up, leaning into the row above
  for (let k = 0; k < 3 + d * 2; k++) {
    const bx = X + (R() * T | 0), h = 4 + d * 2 + (R() * 4 | 0), by = Y + 4 + (R() * 10 | 0);
    c.fillStyle = R() < 0.6 ? P.blade : P.wild[0]; c.fillRect(bx, by - h, 1, h);
  }
  if (R() < 0.45) { const col = P.dot[Math.floor(R() * P.dot.length)], fx = X + 2 + (R() * 12 | 0), fy = Y + (R() * 10 | 0); c.fillStyle = col; c.fillRect(fx - 1, fy, 3, 2); c.fillRect(fx, fy - 1, 1, 4); }
}
function layerFor(mode) {
  let L = layers[mode];
  if (L) return L;
  const P = PAL[mode] || PAL.day, [gc, g] = mk(GW * T, GH * T), [wc, w] = mk(GW * T, GH * T);
  L = layers[mode] = { P, gc, g, wc, w, noise: noiseMap(mulberry32(G.seed ^ 77), GW, 3, 4) };
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) paintGround(L, x, y);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) paintWild(L, x, y);
  return L;
}
// repaint tiles x0..x1, y0..y1 in every painted mode (tall grass leans into the row above)
function repaint(x0, y0, x1, y1) {
  for (const L of Object.values(layers)) {
    for (let y = y0; y <= y1 + 1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < GW && y < GH) paintGround(L, x, y);
    const cx0 = Math.max(0, x0 - 1) * T, cy0 = Math.max(0, y0 - 1) * T, cw = (x1 - x0 + 3) * T, ch = (y1 - y0 + 3) * T;
    L.w.save(); L.w.beginPath(); L.w.rect(cx0, cy0, cw, ch); L.w.clip(); L.w.clearRect(cx0, cy0, cw, ch);
    for (let y = y0 - 1; y <= y1 + 2; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (x >= 0 && y >= 0 && x < GW && y < GH) paintWild(L, x, y);
    L.w.restore();
  }
}

// ------------------------------------------------ the game
export class Garden extends Game {
  constructor(canvas, post) { super(canvas, { ...post, mods: [] }); }
  static state() { return G; }      // for tests
  static repaintAll() { repaint(0, 0, GW - 1, GH - 1); }
  setup() {
    this.mode = PAL[this.post.mode] ? this.post.mode : getMode();
    this.ready = false;
    this.cam = { x: MID * T, y: MID * T };
    this.msgs = [];
    this.fx = [];
    this.weather = { kind: 'calm', t: 0, until: 8 + Math.random() * 10, rain: [], wind: 1 };
    this.pending = [];
    this.autoWait = 1.5;
    this.lastArrival = 0;
    this.lastSeed = 0;
    this.amb = Array.from({ length: this.mode === 'evening' ? 26 : 18 }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 6.28, s: 0.5 + Math.random() }));
    this.hero = { actor: new Actor(this.skin.crystal(0, 'Fantasy'), { mode: 'eight', walkSpeed: 10, runSpeed: 70 }), path: [], task: null, busy: 0 };
    loadGarden().then((g) => {
      this.L = layerFor(this.mode);
      this.hero.x = g.hero.x; this.hero.y = g.hero.y;
      this.cam.x = this.hero.x; this.cam.y = this.hero.y;
      for (const a of g.animals) this.brain(a);
      this.computeBlock();
      this.ready = true;
      if (g.firstVisit) { this.say('Welcome to your garden'); this.say('Tap the ground to plant · tap tall grass to clear it'); this.say('Tap animals to feed them · the seed button picks what you plant'); g.firstVisit = 0; }
      else if (g.away?.length) { this.say('While you were away…'); for (const m of g.away) this.say(m); g.away = []; }
      else if (this.mode === 'morning') this.say(['Good morning, garden', 'Dew on everything', 'The bees are up early'][Math.floor(Math.random() * 3)]);
      else if (this.mode === 'evening') this.say(['The garden at dusk', 'Fireflies are out', 'Everything is settling down'][Math.floor(Math.random() * 3)]);
    });
  }
  start() {
    super.start();
    // back to the garden after a while away in this session: time has passed out there too
    if (this.ready && Garden.active !== this && now() - G.saved > 5 * 60e3) { const m = catchUp(G); if (m.length) { this.say('Since you last looked…'); m.forEach((x) => this.say(x)); } this.hero.x = G.hero.x; this.hero.y = G.hero.y; }
    Garden.active = this;
  }
  stop() { const live = this.live; super.stop(); if (this.ready && live) { G.hero = { x: this.hero.x, y: this.hero.y }; saveGarden(); } }
  get live() { return this.ready && Garden.active === this; }
  hud() {
    if (!this.ready) return 'waking the garden…';
    return `✿ ${G.plants.length} · 🐾 ${G.animals.length} · ◈ ${G.ruins.filter((r) => r.found).length}/${G.ruins.length}`;
  }
  say(text) { this.msgs.push({ text, t: 0 }); if (this.msgs.length > 6) this.msgs.splice(0, this.msgs.length - 6); }

  // ---------------------------------------------- map helpers
  computeBlock() {
    const b = new Uint8Array(GW * GH);
    for (const p of G.plants) if (PLANTS[p.k].type === 'tree' && stageOf(p) >= 2) b[idx(p.x, p.y)] = 1;
    for (const r of G.ruins) if (r.found && r.t !== 'glyphs' && r.t !== 'stones') for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) b[idx(x, y)] = 1;
    for (const r of G.ruins) if (r.found && r.t === 'stones') for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) b[idx(r.x + dx, r.y + dy)] = 1;
    this.block = b;
  }
  open(x, y) { if (x < 0 || y < 0 || x >= GW || y >= GH) return false; const i = idx(x, y); return !G.wild[i] && G.ground[i] !== 2 && !this.block[i]; }
  // breadth-first path to a tile from which `goal(x, y)` holds
  path(goal, maxN = 5184) {
    const sx = Math.floor(this.hero.x / T), sy = Math.floor((this.hero.y - 2) / T);
    const prev = new Int32Array(GW * GH).fill(-2), q = [idx(sx, sy)];
    prev[q[0]] = -1;
    for (let qi = 0; qi < q.length && qi < maxN; qi++) {
      const cur = q[qi], cx = cur % GW, cy = (cur / GW) | 0;
      if (goal(cx, cy)) { const out = []; for (let c = cur; c !== -1; c = prev[c]) out.push([c % GW, (c / GW) | 0]); return out.reverse(); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.open(nx, ny) || prev[idx(nx, ny)] !== -2) continue;
        if (dx && dy && (!this.open(cx + dx, cy) || !this.open(cx, cy + dy))) continue;
        prev[idx(nx, ny)] = cur; q.push(idx(nx, ny));
      }
    }
    return null;
  }
  near(tx, ty, r = 1) { return (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= r; }
  goTo(goal, task) {
    const p = this.path(goal);
    if (!p) { this.say('Can’t get there yet: clear a path through the grass'); return false; }
    this.hero.path = p.slice(1).map(([x, y]) => [x * T + 8, y * T + 12]);
    this.hero.task = task;
    return true;
  }

  // ---------------------------------------------- input
  tap(x, y) {
    if (!this.ready) return;
    if (this.uiTap(x, y)) return;
    const wx = x / Z + this.cam.x - VW / 2, wy = y / Z + this.cam.y - VH / 2, tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (tx < 0 || ty < 0 || tx >= GW || ty >= GH) return;
    this.tapFx(wx, wy);
    // an animal under the finger?
    const a = G.animals.filter((o) => Math.hypot(o.x - wx, o.y - 4 - wy) < 14).sort((p, q) => Math.hypot(p.x - wx, p.y - wy) - Math.hypot(q.x - wx, q.y - wy))[0];
    if (a) { this.goTo(this.near(Math.floor(a.x / T), Math.floor(a.y / T), 1), { kind: 'animal', a }); return; }
    const i = idx(tx, ty), plant = G.plants.find((p) => p.x === tx && p.y === ty) || G.plants.find((p) => PLANTS[p.k].type === 'tree' && stageOf(p) === 3 && Math.abs(p.x - tx) <= 1 && ty <= p.y && ty >= p.y - 2);
    const ruin = G.ruins.find((r) => r.found && tx >= r.x && tx < r.x + r.w && ty >= r.y - 1 && ty < r.y + r.h);
    if (plant) { this.goTo(this.near(plant.x, plant.y, 1), { kind: 'plant', p: plant }); return; }
    if (ruin) { this.goTo(this.near(ruin.x, ruin.y, 2), { kind: 'ruin', r: ruin }); return; }
    if (G.wild[i]) {
      // clear the nearest overgrown tile on the way to the tap
      const p = this.path((x0, y0) => this.frontierToward(x0, y0, tx, ty));
      if (!p) { this.say('Can’t reach that yet'); return; }
      const [ex, ey] = p[p.length - 1], t = this.frontierToward(ex, ey, tx, ty);
      this.hero.path = p.slice(1).map(([x0, y0]) => [x0 * T + 8, y0 * T + 12]);
      this.hero.task = { kind: 'clear', x: t[0], y: t[1] };
      return;
    }
    if (G.ground[i] === 2) { this.say('The water is cool and clear'); return; }
    this.goTo(this.near(tx, ty, 1), { kind: 'plant-here', x: tx, y: ty });
  }
  // from (x, y), the wild neighbour that points most toward (tx, ty)
  frontierToward(x, y, tx, ty) {
    let best = null, bd = Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || !G.wild[idx(nx, ny)]) continue;
      const d = Math.hypot(nx - tx, ny - ty);
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    return best && bd <= Math.hypot(x - tx, y - ty) + 0.01 ? best : null;
  }
  uiTap(x, y) {
    const b = this.ui?.seed;
    if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      const kinds = Object.keys(G.inv.seeds).filter((k) => G.inv.seeds[k] > 0);
      if (!kinds.length) { this.say('No seeds: gather them from blooming flowers'); return true; }
      const i = kinds.indexOf(G.inv.pick);
      G.inv.pick = kinds[(i + 1) % kinds.length];
      this.say(`Planting ${PLANTS[G.inv.pick].name.toLowerCase()} (${G.inv.seeds[G.inv.pick]} seeds)`);
      return true;
    }
    const r = this.ui?.ruins;
    if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      const hx = this.hero.x / T, hy = this.hero.y / T, left = G.ruins.filter((u) => !u.found).sort((p, q) => Math.hypot(p.x - hx, p.y - hy) - Math.hypot(q.x - hx, q.y - hy));
      if (!left.length) this.say('Every ruin has been found');
      else { const u = left[0], dir = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round(((Math.atan2(u.y - hy, u.x - hx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8]; this.say(`Something old lies to the ${dir}, under the grass`); }
      return true;
    }
    return false;
  }
  tapFx(x, y) { this.fx.push({ kind: 'ring', x, y, t: 0, life: 0.5 }); }

  // ---------------------------------------------- doing things
  act(task) {
    const h = this.hero, a = h.actor, t = now();
    if (task.kind === 'clear') {
      a.attack(); h.busy = 0.45;
      this.later(0.35, () => this.clear(task.x, task.y));
    } else if (task.kind === 'plant-here') {
      const k = G.inv.pick, P = PLANTS[k];
      if (!G.inv.seeds[k]) { this.say('Out of those seeds: tap the seed button to pick others'); return; }
      if (G.plants.some((p) => p.x === task.x && p.y === task.y) || !this.open(task.x, task.y) || G.ground[idx(task.x, task.y)] >= 4) { this.say('Can’t plant just there'); return; }
      if (P.type === 'tree' && G.plants.some((p) => PLANTS[p.k].type === 'tree' && Math.hypot(p.x - task.x, p.y - task.y) < 2.5)) { this.say('Trees need a little more room'); return; }
      a.cast(); h.busy = 0.5;
      this.later(0.4, () => {
        G.plants.push({ k, x: task.x, y: task.y, g: 0.02, w: t, fr: 0, sd: 0 });
        G.inv.seeds[k]--;
        this.puff(task.x * T + 8, task.y * T + 12, '#a7835a', 8);
        this.say(`Planted a ${P.name.toLowerCase()}`);
        this.computeBlock(); saveGarden(true);
      });
    } else if (task.kind === 'plant') {
      const p = task.p, P = PLANTS[p.k], st = stageOf(p);
      a.cast(); h.busy = 0.5;
      this.later(0.35, () => {
        if (P.food && st === 3 && p.fr > 0) {
          G.inv.food += p.fr; this.say(`Picked ${p.fr} ${P.type === 'tree' && p.k !== 'lanterntree' ? 'apples' : p.k === 'lanterntree' ? 'lantern fruits' : 'handfuls of berries'}`);
          if (Math.random() < 0.35) { G.inv.seeds[p.k] = (G.inv.seeds[p.k] || 0) + 1; this.say(`…and a ${P.name.toLowerCase()} seed`); }
          p.fr = 0; this.puff(p.x * T + 8, p.y * T, P.fruit, 10);
        } else if (P.type !== 'tree' && st === 3 && t - (p.sd || 0) > 2 * HR) {
          const n = 1 + (Math.random() < 0.5 ? 1 : 0); G.inv.seeds[p.k] = (G.inv.seeds[p.k] || 0) + n; p.sd = t;
          this.say(`Gathered ${n} ${P.name.toLowerCase()} seed${n > 1 ? 's' : ''}`); this.puff(p.x * T + 8, p.y * T + 4, '#e8d8a8', 8);
        } else this.water(p);
        saveGarden(true);
      });
    } else if (task.kind === 'water') {
      a.cast(); h.busy = 0.5; this.later(0.35, () => this.water(task.p, true));
    } else if (task.kind === 'animal') {
      const o = task.a, A = ANIMALS[o.k];
      a.face(o.x < h.x ? 'W' : 'E');
      if (A.eats && G.inv.food > 0) {
        a.emote('love', 1.2); h.busy = 0.6; G.inv.food--; o.f = t; o.st = 'eat'; o.wait = 1.5;
        this.hearts(o.x, o.y - 10);
        this.say(`You fed the ${o.baby ? `baby ${o.k}` : o.k}`);
        this.breed(o);
      } else {
        a.emote(A.eats ? 'wave' : 'love', 1.2); h.busy = 0.5; o.wait = 1.2; this.hearts(o.x, o.y - 8);
        if (A.eats && !G.inv.food) this.say('No food left: pick berries or apples');
      }
      saveGarden(true);
    } else if (task.kind === 'ruin') {
      a.emote('think', 1.4); h.busy = 0.6; this.say(`${task.r.name[0].toUpperCase()}${task.r.name.slice(1)}. ${task.r.lore}`);
    } else if (task.kind === 'pet') {
      a.emote('love', 1); h.busy = 0.4; this.hearts(task.a.x, task.a.y - 8); task.a.wait = 1;
    }
  }
  later(s, fn) { this.pending.push({ at: this.t + s, fn }); }
  water(p, quiet = false) {
    const P = PLANTS[p.k], before = stageOf(p), t = now();
    const boost = t - (p.w || 0) < 30e3 ? 0.01 : P.type === 'tree' ? 0.05 : P.type === 'shrub' ? 0.08 : 0.12;
    p.g = Math.min(1, p.g + boost); p.w = t;
    for (let i = 0; i < 8; i++) this.fx.push({ kind: 'drop', x: p.x * T + 8 + (Math.random() - 0.5) * 10, y: p.y * T - 6, vy: 20 + Math.random() * 30, t: 0, life: 0.6 });
    if (stageOf(p) > before) {
      this.puff(p.x * T + 8, p.y * T, P.petal || P.bloom || P.leaf || '#9fd88a', 12);
      this.say(stageOf(p) === 3 ? `The ${P.name.toLowerCase()} ${P.type === 'flower' ? 'bloomed' : 'is fully grown'}!` : `The ${P.name.toLowerCase()} grew`);
      if (stageOf(p) === 3) this.hero.actor.emote('cheer', 1.2);
      this.computeBlock();
    } else if (!quiet && boost < 0.02) this.say('Already watered: it needs time now');
  }
  clear(x, y) {
    if (!G.wild[idx(x, y)]) return;
    const R = Math.random;
    G.wild[idx(x, y)] = 0;
    // light meadow next to it goes too, so each swing opens a little space
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx > 0 && ny > 0 && nx < GW - 1 && ny < GH - 1 && G.wild[idx(nx, ny)] === 1 && R() < 0.6) G.wild[idx(nx, ny)] = 0; }
    for (let i = 0; i < 10; i++) this.fx.push({ kind: 'leaf', x: x * T + 8, y: y * T + 6, vx: (R() - 0.5) * 70, vy: -30 - R() * 50, t: 0, life: 0.9, c: this.L.P.wild[(R() * 3) | 0] });
    // a pond?
    if (G.ground[idx(x, y)] === 2 || G.ground[idx(x, y)] === 4) {
      const pd = G.ponds.find((p) => !p.found && Math.hypot(p.x - x, p.y - y) < 7);
      if (pd) {
        pd.found = 1;
        for (let yy = pd.y - 7; yy <= pd.y + 7; yy++) for (let xx = pd.x - 7; xx <= pd.x + 7; xx++) if (xx > 0 && yy > 0 && xx < GW && yy < GH && (G.ground[idx(xx, yy)] === 2 || G.ground[idx(xx, yy)] === 4)) G.wild[idx(xx, yy)] = 0;
        repaint(pd.x - 8, pd.y - 8, pd.x + 8, pd.y + 8);
        this.say('You found a pond!'); this.hero.actor.emote('surprise', 1.2);
      }
    }
    // a ruin?
    const r = G.ruins.find((u) => !u.found && x >= u.x - 1 && x <= u.x + u.w && y >= u.y - 1 && y <= u.y + u.h);
    if (r) {
      r.found = 1;
      for (let yy = r.y - 1; yy <= r.y + r.h; yy++) for (let xx = r.x - 1; xx <= r.x + r.w; xx++) { G.wild[idx(xx, yy)] = 0; if (G.ground[idx(xx, yy)] !== 2) G.ground[idx(xx, yy)] = r.t === 'glyphs' || (yy >= r.y && yy < r.y + r.h && xx >= r.x && xx < r.x + r.w) ? 5 : 3; }
      G.plants = G.plants.filter((p) => !(p.x >= r.x - 1 && p.x <= r.x + r.w && p.y >= r.y - 1 && p.y <= r.y + r.h));
      G.inv.seeds[r.seed] = (G.inv.seeds[r.seed] || 0) + 3;
      repaint(r.x - 2, r.y - 2, r.x + r.w + 1, r.y + r.h + 1);
      this.say(`You uncovered ${r.name}!`); this.say(r.lore); this.say(`Inside: 3 ${PLANTS[r.seed].name.toLowerCase()} seeds`);
      this.hero.actor.emote('surprise', 1.5);
      this.puff(r.x * T + r.w * 8, r.y * T + r.h * 8, '#fff2b0', 24);
    } else if (R() < 0.16) {
      const k = COMMON[(R() * 7) | 0]; G.inv.seeds[k] = (G.inv.seeds[k] || 0) + 1; this.say(`Found a ${PLANTS[k].name.toLowerCase()} seed in the grass`);
    }
    repaint(x - 1, y - 1, x + 1, y + 1);
    this.computeBlock();
    saveGarden(true);
  }
  breed(o) {
    const A = ANIMALS[o.k];
    if (o.baby || countKind(G, o.k) >= A.cap) return;
    const mate = G.animals.find((m) => m !== o && m.k === o.k && !m.baby && m.f && now() - m.f < 6 * HR);
    if (!mate) { if (countKind(G, o.k) >= 2) this.say(`Feed another ${o.k} too and they may have young`); return; }
    this.say(`The ${o.k}s seem very happy together ♥`);
    this.hearts((o.x + mate.x) / 2, (o.y + mate.y) / 2 - 12);
    this.later(14 + Math.random() * 8, () => {
      if (countKind(G, o.k) >= A.cap) return;
      const b = addAnimal(G, o.k, o.x + 6, o.y + 3, 1); this.brain(b);
      this.say(`A baby ${o.k} was born!`); this.hearts(b.x, b.y - 8); this.hero.actor.emote('cheer', 1.4);
      saveGarden(true);
    });
  }
  hearts(x, y) { for (let i = 0; i < 4; i++) this.fx.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 12, y, vy: -18 - Math.random() * 10, t: -i * 0.12, life: 1.2 }); }
  puff(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 20 + Math.random() * 40; this.fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0, life: 0.7, c }); } }

  // ---------------------------------------------- animal behaviour
  brain(a) {
    a.tx = a.x; a.ty = a.y; a.wait = Math.random() * 2; a.ph = Math.random() * 6.28; a.dir = Math.random() < 0.5 ? 1 : -1;
  }
  okFor(a, x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < 1 || ty < 1 || tx >= GW - 1 || ty >= GH - 1) return false;
    const A = ANIMALS[a.k], i = idx(tx, ty);
    if (A.fly) return true;
    if (A.water) return G.ground[i] === 2 || G.ground[i] === 4;
    if (A.shore) return !G.wild[i] && (G.ground[i] === 4 || G.ground[i] === 0) && G.ponds.some((p) => p.found && Math.hypot(p.x - tx, p.y - ty) < 6);
    return !G.wild[i] && G.ground[i] !== 2 && !this.block[i];
  }
  stepAnimal(a, dt) {
    const A = ANIMALS[a.k], lively = this.mode === 'day' ? 1.35 : this.mode === 'evening' ? 0.75 : 1;
    if (A.night && this.mode !== 'evening') return;
    a.ph += dt * (A.fly ? 9 : 5) * lively;
    if (a.wait > 0) { a.wait -= dt; return; }
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (d < 2) {
      // a new aim: near flowers for insects, perches for birds, a short wander otherwise
      a.wait = (A.fly ? 0.3 : 0.8) + Math.random() * (A.fly ? 1.5 : 3) / lively;
      let nx = a.x + (Math.random() - 0.5) * (A.fly ? 120 : 90), ny = a.y + (Math.random() - 0.5) * (A.fly ? 100 : 70);
      if ((a.k === 'butterfly' || a.k === 'bee') && G.plants.length) { const p = G.plants[(Math.random() * G.plants.length) | 0]; if (Math.hypot(p.x * T - a.x, p.y * T - a.y) < 220) { nx = p.x * T + 8; ny = p.y * T - 4; } }
      if ((a.k === 'songbird' || a.k === 'owl' || a.k === 'squirrel') && Math.random() < 0.5) { const tr = G.plants.filter((p) => PLANTS[p.k].type === 'tree' && stageOf(p) >= 2); const p = tr[(Math.random() * tr.length) | 0]; if (p) { nx = p.x * T + 8 + (Math.random() - 0.5) * 10; ny = p.y * T - (stageOf(p) === 3 ? 30 : 16); } }
      // in the day the animals play: chase a friend now and then
      if (this.mode === 'day' && !A.fly && Math.random() < 0.25) { const f = G.animals.find((o) => o !== a && o.k === a.k); if (f) { nx = f.x + (Math.random() - 0.5) * 20; ny = f.y + (Math.random() - 0.5) * 20; a.wait = 0; } }
      if (this.okFor(a, nx, ny)) { a.tx = nx; a.ty = ny; }
      return;
    }
    const sp = A.speed * lively * (a.baby ? 0.85 : 1) * (A.fly ? 1 + Math.sin(a.ph) * 0.3 : 1);
    const mx = (dx / d) * Math.min(d, sp * dt), my = (dy / d) * Math.min(d, sp * dt);
    if (!A.fly && !this.okFor(a, a.x + mx, a.y + my)) { a.tx = a.x; a.ty = a.y; return; }
    a.x += mx; a.y += my;
    if (Math.abs(mx) > 0.01) a.dir = mx > 0 ? 1 : -1;
  }

  // ---------------------------------------------- the loop
  step(dt) {
    if (!this.ready) return;
    const h = this.hero;
    for (const m of this.msgs) m.t += dt;
    while (this.msgs.length && this.msgs[0].t > 4.2 + (this.msgs.length > 1 ? 0 : 1.5)) { this.msgs.shift(); if (this.msgs[0]) this.msgs[0].t = 0; }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
    const due = this.pending.filter((p) => p.at <= this.t);
    if (due.length) { this.pending = this.pending.filter((p) => p.at > this.t); due.forEach((p) => p.fn()); }
    // hero walking
    let vx = 0, vy = 0;
    if (h.busy > 0) h.busy -= dt;
    else if (h.path.length) {
      const [px0, py0] = h.path[0], dx = px0 - h.x, dy = py0 - h.y, d = Math.hypot(dx, dy), sp = this.auto ? 46 : 64;
      if (d < 1.5) h.path.shift();
      else { const stp = Math.min(d, sp * dt); vx = (dx / d) * sp; vy = (dy / d) * sp; h.x += (dx / d) * stp; h.y += (dy / d) * stp; }
    } else if (h.task) { const t = h.task; h.task = null; this.act(t); }
    h.actor.update(dt, { vx, vy });
    // camera eases after the hero
    this.cam.x += (h.x - this.cam.x) * Math.min(1, dt * 3);
    this.cam.y += (h.y - 16 - this.cam.y) * Math.min(1, dt * 3);
    this.cam.x = Math.max(VW / 2, Math.min(GW * T - VW / 2, this.cam.x));
    this.cam.y = Math.max(VH / 2, Math.min(GH * T - VH / 2, this.cam.y));
    if (!this.live) return;
    // the world goes on (only in the card that is on screen)
    for (const a of G.animals) this.stepAnimal(a, dt);
    for (const p of G.plants) {
      const P = PLANTS[p.k], before = stageOf(p);
      p.g = Math.min(1, p.g + dt / (P.hours * 3600));
      if (P.food && before === 3 && Math.random() < dt / 5400) p.fr = Math.min(FRUIT_CAP[P.type] || 3, p.fr + 1);
      if (stageOf(p) > before) { this.say(`The ${P.name.toLowerCase()} ${stageOf(p) === 3 ? 'bloomed' : 'grew'}`); this.computeBlock(); }
    }
    if (this.t - this.lastArrival > 25) {
      this.lastArrival = this.t;
      for (const m of arrivals(G, 1)) { this.say(m); for (const a of G.animals) if (a.tx === undefined) this.brain(a); }
    }
    if (this.t - this.lastSeed > 40) {
      this.lastSeed = this.t;
      const fl = G.plants.filter((p) => PLANTS[p.k].type === 'flower' && stageOf(p) === 3);
      if (fl.length && G.plants.length < 240 && Math.random() < 0.3) { const p = fl[(Math.random() * fl.length) | 0], t = freeTile(G, p.x, p.y, 2); if (t) { G.plants.push({ k: p.k, x: t[0], y: t[1], g: 0.05, w: 0, fr: 0, sd: 0 }); this.say(`A ${PLANTS[p.k].name.toLowerCase()} seeded itself`); } }
    }
    this.stepWeather(dt);
    if (Math.floor(this.t / 12) !== Math.floor((this.t - dt) / 12)) { G.hero = { x: h.x, y: h.y }; saveGarden(); }
  }
  stepWeather(dt) {
    const w = this.weather;
    w.t += dt;
    if (this.mode === 'day' && w.t > w.until) {
      // lively days: gusts, passing showers with a rainbow after, bright spells
      const next = w.kind === 'rain' ? 'rainbow' : ['gust', 'rain', 'sun', 'gust', 'calm'][Math.floor(Math.random() * 5)];
      w.kind = next; w.t = 0; w.until = next === 'rain' ? 14 : next === 'rainbow' ? 9 : next === 'gust' ? 7 : 12 + Math.random() * 10;
      if (next === 'rain') this.say('A spring shower passes over');
      if (next === 'rainbow') this.say('A rainbow!');
      if (next === 'gust') for (const a of G.animals) if (ANIMALS[a.k].fly) a.wait = 0;
    }
    const target = this.mode === 'evening' ? 0.5 : this.mode === 'morning' ? 0.8 : w.kind === 'gust' ? 3 : w.kind === 'rain' ? 1.6 : 1.1;
    w.wind += (target - w.wind) * Math.min(1, dt * 0.8);
    if (w.kind === 'rain' && this.mode === 'day') {
      for (let i = 0; i < 6; i++) w.rain.push({ x: Math.random() * (W + 60) - 30, y: -10, v: 260 + Math.random() * 120 });
      for (const r of w.rain) r.y += r.v * dt;
      w.rain = w.rain.filter((r) => r.y < H);
    } else if (w.rain.length) { for (const r of w.rain) r.y += r.v * dt; w.rain = w.rain.filter((r) => r.y < H); }
    for (const p of this.amb) { p.p += dt * p.s; p.x += Math.sin(p.p) * 6 * dt + w.wind * (this.mode === 'evening' ? 2 : 10) * dt; p.y += (this.mode === 'evening' ? Math.cos(p.p * 0.7) * 5 : 9 + p.s * 6) * dt; if (p.x > W + 8) p.x = -8; if (p.y > H + 8) { p.y = -8; p.x = Math.random() * W; } }
  }
  autopilot(dt) {
    if (!this.ready || this.hero.path.length || this.hero.task || this.hero.busy > 0) return;
    this.autoWait -= dt;
    if (this.autoWait > 0) return;
    this.autoWait = 1.5 + Math.random() * 2.5;
    const h = this.hero, hx = h.x / T, hy = h.y / T, t = now();
    // tend: water what is thirsty and close; otherwise visit an animal, a ruin, or wander
    const thirsty = G.plants.filter((p) => t - (p.w || 0) > 15 * 60e3 && stageOf(p) < 3 && Math.hypot(p.x - hx, p.y - hy) < 10).sort((p, q) => Math.hypot(p.x - hx, p.y - hy) - Math.hypot(q.x - hx, q.y - hy));
    const roll = Math.random();
    if (thirsty.length && roll < 0.6) { this.goTo(this.near(thirsty[0].x, thirsty[0].y, 1), { kind: 'water', p: thirsty[0] }); return; }
    const pets = G.animals.filter((a) => !ANIMALS[a.k].fly && !ANIMALS[a.k].water && Math.hypot(a.x / T - hx, a.y / T - hy) < 8);
    if (pets.length && roll < 0.8) { const a = pets[(Math.random() * pets.length) | 0]; this.goTo(this.near(Math.floor(a.x / T), Math.floor(a.y / T), 1), { kind: 'pet', a }); return; }
    const found = G.ruins.filter((r) => r.found);
    if (found.length && roll < 0.88) { const r = found[(Math.random() * found.length) | 0]; this.goTo(this.near(r.x, r.y, 2), null); return; }
    for (let i = 0; i < 8; i++) {
      const tx = Math.round(hx + (Math.random() - 0.5) * 10), ty = Math.round(hy + (Math.random() - 0.5) * 8);
      if (this.open(tx, ty)) { this.goTo((x, y) => x === tx && y === ty, null); return; }
    }
  }

  // ---------------------------------------------- drawing
  draw(c) {
    c.imageSmoothingEnabled = false;
    if (!this.ready) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, this.mode === 'evening' ? '#3a2a3a' : '#e8f4ea'); g.addColorStop(1, this.mode === 'evening' ? '#1a1418' : '#cfe8d2');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      this.text(c, 'waking the garden…', W / 2, H / 2, 14, this.mode === 'evening' ? '#e8d8c8' : '#4a6a4e');
      return;
    }
    const L = this.L, cx = Math.round(this.cam.x - VW / 2), cy = Math.round(this.cam.y - VH / 2), t = this.t, wind = this.weather.wind;
    c.save(); c.scale(Z, Z);
    c.drawImage(L.gc, cx, cy, VW, VH, 0, 0, VW, VH);
    // water shimmer
    c.fillStyle = 'rgba(255,255,255,.55)';
    const tx0 = Math.floor(cx / T), ty0 = Math.floor(cy / T);
    for (let ty = ty0; ty <= ty0 + VH / T + 1; ty++) for (let tx = tx0; tx <= tx0 + VW / T + 1; tx++) {
      if (tx < 0 || ty < 0 || tx >= GW || ty >= GH || G.ground[idx(tx, ty)] !== 2 || G.wild[idx(tx, ty)]) continue;
      const s = Math.sin(t * 1.4 + tx * 1.7 + ty * 2.3);
      if (s > 0.3) c.fillRect(tx * T - cx + 3 + ((t * 6 + tx * 5) % 9), ty * T - cy + 6 + (ty % 3) * 3, 4, 1);
    }
    // tall grass swaying in strips
    for (let y = 0; y < VH; y += 4) {
      const off = Math.sin(t * 1.7 + (cy + y) * 0.05) * wind * 0.9 + Math.sin(t * 0.6 + (cy + y) * 0.013) * wind * 0.6;
      c.drawImage(L.wc, cx, cy + y, VW, 4, Math.round(off), y, VW, 4);
    }
    // things, back to front
    const vis = (x, y, m = 48) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m * 2;
    const items = [];
    for (const r of G.ruins) if (r.found) {
      if (r.t === 'stones') { for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) { const x = (r.x + dx) * T + 8, y = (r.y + dy) * T + 14; if (vis(x, y)) items.push([y, 'ruin', { t: 'stones', x, y, r }]); } }
      else if (r.t !== 'glyphs') { const x = r.x * T + r.w * 8, y = (r.y + r.h) * T - 1; if (vis(x, y)) items.push([y, 'ruin', { t: r.t, x, y, r }]); }
    }
    for (const p of G.plants) { const x = p.x * T + 8, y = p.y * T + 14; if (vis(x, y)) items.push([y, 'plant', p]); }
    for (const a of G.animals) { if (ANIMALS[a.k].night && this.mode !== 'evening') continue; if (vis(a.x, a.y)) items.push([a.y + (ANIMALS[a.k].fly ? 30 : 0), 'animal', a]); }
    items.push([this.hero.y, 'hero']);
    items.sort((p, q) => p[0] - q[0]);
    for (const [, kind, o] of items) {
      if (kind === 'plant') {
        const st = stageOf(o), s = plantSprite(o.k, st, o.fr > 0), x = o.x * T + 8 - cx, y = o.y * T + 14 - cy;
        const sway = st === 0 ? 0 : Math.sin(t * 2 + o.x * 0.7 + o.y * 0.3) * 0.05 * wind * (PLANTS[o.k].type === 'tree' ? 0.4 : 1);
        c.save(); c.translate(x, y); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(s.cv, -Math.floor(s.w / 2), -s.h); c.restore();
      } else if (kind === 'ruin') {
        const s = ruinSprite(o.t, L.P);
        c.drawImage(s.cv, Math.round(o.x - cx - s.w / 2), Math.round(o.y - cy - s.h));
      } else if (kind === 'animal') {
        const A = ANIMALS[o.k], f = (Math.sin(o.ph) > 0) ? 1 : 0, s = animalSprite(o.k, A.fly || A.hop || o.wait <= 0 ? f : 0), k = o.baby ? 0.65 : 1;
        const hop = A.hop && o.wait <= 0 ? Math.abs(Math.sin(o.ph)) * (this.mode === 'day' ? 4 : 2.5) : 0, fly = A.fly ? 10 + Math.sin(o.ph * 0.5) * 3 : 0;
        const x = o.x - cx, y = o.y - cy;
        if (!A.fly && !A.water) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(x, y, 5 * k, 1.8 * k, 0, 0, 7); c.fill(); }
        c.save(); c.translate(Math.round(x), Math.round(y - hop - fly)); if (o.dir < 0) c.scale(-1, 1); c.scale(k, k);
        c.drawImage(s.cv, -Math.floor(s.w / 2), -s.h); c.restore();
      } else if (kind === 'hero') {
        c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(this.hero.x - cx, this.hero.y - cy, 7, 2.5, 0, 0, 7); c.fill();
        this.hero.actor.draw(c, Math.round(this.hero.x - cx), Math.round(this.hero.y - cy), 1);
      }
    }
    // effects
    for (const f of this.fx) {
      const k = f.t / f.life, x = f.x - cx + (f.vx || 0) * f.t, y = f.y - cy + (f.vy || 0) * f.t + (f.kind === 'leaf' || f.kind === 'dot' ? 60 * f.t * f.t : 0);
      if (f.t < 0) continue;
      c.globalAlpha = Math.max(0, 1 - k);
      if (f.kind === 'ring') { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, 4 + k * 10, 2 + k * 5, 0, 0, 7); c.stroke(); }
      else if (f.kind === 'heart') { c.fillStyle = '#ff7a9a'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('♥', x, y); }
      else if (f.kind === 'drop') { c.fillStyle = '#7ac8f0'; c.fillRect(x, y, 1, 3); }
      else { c.fillStyle = f.c || '#fff'; c.fillRect(x, y, 2, 2); }
    }
    c.globalAlpha = 1;
    c.restore();
    this.drawLight(c, cx, cy);
    this.drawUI(c);
  }
  drawLight(c, cx, cy) {
    const t = this.t, w = this.weather;
    if (this.mode === 'morning') {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, 'rgba(255,200,220,.16)'); g.addColorStop(0.5, 'rgba(255,240,220,0)'); g.addColorStop(1, 'rgba(190,220,255,.12)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // low mist and drifting blossom
      for (let i = 0; i < 3; i++) { const y = ((i * 151 + t * 5) % (H + 80)) - 40; c.fillStyle = 'rgba(255,255,255,.06)'; c.beginPath(); c.ellipse(W / 2 + Math.sin(t * 0.2 + i) * 80, y, 220, 14, 0, 0, 7); c.fill(); }
      for (const [i, p] of this.amb.entries()) { if (i % 2) continue; c.fillStyle = p.s > 1 ? '#ffc4d8' : '#fff4f8'; c.globalAlpha = 0.9; c.fillRect(p.x, p.y, 2, 2); }
      c.globalAlpha = 1;
    } else if (this.mode === 'evening') {
      c.globalCompositeOperation = 'multiply';
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#ffc7a0'); g.addColorStop(0.5, '#efa9c6'); g.addColorStop(1, '#8f88d8');
      c.globalAlpha = 0.8; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      c.globalCompositeOperation = 'overlay';
      const tint = c.createLinearGradient(0, 0, 0, H);
      tint.addColorStop(0, 'rgba(255,140,150,.22)'); tint.addColorStop(1, 'rgba(90,70,190,.22)');
      c.fillStyle = tint; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'screen';
      const sun = c.createRadialGradient(W * 0.8, -20, 10, W * 0.8, -20, 300);
      sun.addColorStop(0, 'rgba(255,160,110,.32)'); sun.addColorStop(1, 'rgba(255,160,110,0)');
      c.fillStyle = sun; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      // glows: lantern trees, moonflowers, shrines, the glyph floor, fireflies, and the gardener’s lantern
      const glow = (x, y, r, col, a) => { const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col.replace('A', a)); rg.addColorStop(1, col.replace('A', 0)); c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2); };
      for (const p of G.plants) { const P = PLANTS[p.k]; if (!P.glow || stageOf(p) < 2) continue; const x = (p.x * T + 8 - cx) * Z, y = (p.y * T + 14 - cy - (P.type === 'tree' ? 22 : 8)) * Z; if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue; glow(x, y, P.type === 'tree' ? 30 : 14, 'rgba(255,230,160,A)', 0.35 + Math.sin(t * 2 + p.x) * 0.08); }
      for (const r of G.ruins) { if (!r.found || !['shrine', 'obelisk', 'glyphs', 'fountain', 'well'].includes(r.t)) continue; const x = (r.x * T + r.w * 8 - cx) * Z, y = (r.y * T + r.h * 8 - cy) * Z; glow(x, y, 40, r.t === 'shrine' ? 'rgba(255,210,120,A)' : 'rgba(150,210,255,A)', 0.3 + Math.sin(t * 1.3 + r.x) * 0.08); }
      glow((this.hero.x - cx) * Z, (this.hero.y - cy - 12) * Z, 36, 'rgba(255,220,150,A)', 0.25);
      for (const p of this.amb) { const a = 0.4 + Math.sin(p.p * 3) * 0.4; if (a < 0.1) continue; glow(p.x, p.y, 6, 'rgba(220,255,140,A)', a); c.fillStyle = `rgba(240,255,190,${a})`; c.fillRect(p.x, p.y, 1.5, 1.5); }
      c.globalCompositeOperation = 'source-over';
    } else {
      // the day: cloud shadows, rain, rainbows, bright spells
      c.fillStyle = 'rgba(30,40,60,.07)';
      for (let i = 0; i < 3; i++) { const x = ((i * 190 + t * 12) % (W + 300)) - 150; c.beginPath(); c.ellipse(x, 80 + i * 130, 120, 50, 0.2, 0, 7); c.fill(); }
      if (w.kind === 'rain') { c.fillStyle = `rgba(40,60,90,${Math.min(0.18, w.t * 0.04)})`; c.fillRect(0, 0, W, H); }
      c.strokeStyle = 'rgba(210,230,255,.7)'; c.lineWidth = 1;
      c.beginPath(); for (const r of w.rain) { c.moveTo(r.x, r.y); c.lineTo(r.x - 3, r.y + 7); } c.stroke();
      if (w.kind === 'rainbow') {
        const a = Math.min(1, w.t / 2, (w.until - w.t) / 2) * 0.35;
        ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'].forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = a; c.lineWidth = 5; c.beginPath(); c.arc(W * 0.7, H * 0.95, 300 - i * 5, Math.PI * 1.1, Math.PI * 1.75); c.stroke(); });
        c.globalAlpha = 1;
      }
      if (w.kind === 'sun') { const g = c.createRadialGradient(W * 0.85, 0, 10, W * 0.85, 0, 320); g.addColorStop(0, `rgba(255,240,180,${Math.min(0.3, w.t * 0.1)})`); g.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      if (w.kind === 'gust') for (const p of this.amb) { c.fillStyle = '#9ccf7a'; c.fillRect(p.x, p.y, 3, 2); }
    }
  }
  drawUI(c) {
    const ink = this.mode === 'evening' ? '#f3e6d4' : '#3c3430', bg = this.mode === 'evening' ? 'rgba(30,20,30,.72)' : this.mode === 'morning' ? 'rgba(255,250,246,.86)' : 'rgba(255,255,255,.84)';
    // messages
    const m = this.msgs[0];
    if (m) {
      c.font = '600 11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = Math.min(W - 24, c.measureText(m.text).width + 22), a = Math.min(1, m.t * 4, (5.5 - m.t) * 2);
      c.globalAlpha = Math.max(0, a); c.fillStyle = bg; roundRect(c, W / 2 - w / 2, 46, w, 22, 11); c.fill();
      c.fillStyle = ink; c.fillText(m.text.length > 60 ? `${m.text.slice(0, 58)}…` : m.text, W / 2, 57); c.globalAlpha = 1;
    }
    // seed button, food, ruins
    const k = G.inv.pick, n = G.inv.seeds[k] || 0, sb = { x: 8, y: H - 42, w: 150, h: 34 };
    c.fillStyle = bg; roundRect(c, sb.x, sb.y, sb.w, sb.h, 17); c.fill();
    if (PLANTS[k]) { const s = plantSprite(k, 3, true), sc = Math.min(1.2, 26 / s.h); c.save(); c.translate(sb.x + 20, sb.y + 30); c.scale(sc, sc); c.drawImage(s.cv, -s.w / 2, -s.h); c.restore(); }
    c.fillStyle = ink; c.font = '700 11px system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(PLANTS[k]?.name || 'Seeds', sb.x + 38, sb.y + 12);
    c.font = '500 10px system-ui, sans-serif'; c.globalAlpha = 0.75; c.fillText(`${n} seed${n === 1 ? '' : 's'} · tap to change`, sb.x + 38, sb.y + 24); c.globalAlpha = 1;
    const fb = { x: sb.x + sb.w + 6, y: sb.y, w: 62, h: 34 };
    c.fillStyle = bg; roundRect(c, fb.x, fb.y, fb.w, fb.h, 17); c.fill();
    c.fillStyle = '#e2453f'; c.beginPath(); c.arc(fb.x + 17, fb.y + 18, 6, 0, 7); c.fill(); c.fillStyle = '#5f9a4e'; c.fillRect(fb.x + 17, fb.y + 9, 2, 4);
    c.fillStyle = ink; c.font = '700 12px system-ui, sans-serif'; c.fillText(`×${G.inv.food}`, fb.x + 28, fb.y + 18);
    const rb = { x: W - 74, y: sb.y, w: 66, h: 34 }, found = G.ruins.filter((r) => r.found).length;
    c.fillStyle = bg; roundRect(c, rb.x, rb.y, rb.w, rb.h, 17); c.fill();
    c.fillStyle = ink; c.font = '700 12px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(`◈ ${found}/${G.ruins.length}`, rb.x + rb.w / 2, rb.y + 13);
    c.font = '500 9px system-ui, sans-serif'; c.globalAlpha = 0.75; c.fillText('ruins · hint', rb.x + rb.w / 2, rb.y + 25); c.globalAlpha = 1;
    this.ui = { seed: sb, ruins: rb };
  }
}
