// The garden's world: three realms saved on the phone. The meadows (a big map of meadow, forest,
// flower fields, lakes with islands and rocky hills), the caverns below (reached by cave mouths in
// the hills) and the sky islands above (reached by the Cloud Stair, once you uncover it). Also the
// sprites, the generators, saving, real-time catch-up and the painted map chunks.
import { W, H, noiseMap } from './engine.js';
import { mulberry32 } from '../util.js';
import { idbGet, idbSet } from '../store.js';

export const T = 16, CH = 16, HR = 3600e3, KEY = 'garden-v2', OLD = 'garden-v1';
export const GRASS = 0, WATER = 2, PATH = 3, SAND = 4, STONE = 5, BRIDGE = 6, ROCK = 7, PORTAL = 8, FOREST = 9, FLOWERS = 10, VOID = 11;
export const SIZE = { surface: 128, cave: 64, sky: 64 };
export const REALM_NAME = { surface: 'The meadows', cave: 'The caverns', sky: 'The sky islands' };
export const now = () => Date.now();

// ------------------------------------------------ what grows
export const PLANTS = {
  daisy: { type: 'flower', hours: 2, name: 'Daisy', petal: '#ffffff', mid: '#f6d35b' },
  tulip: { type: 'flower', hours: 3, name: 'Tulip', petal: '#f59ab8', mid: '#fbd3e2', cup: true },
  poppy: { type: 'flower', hours: 2.5, name: 'Poppy', petal: '#ff8a7a', mid: '#4a2f2f' },
  lavender: { type: 'flower', hours: 3, name: 'Lavender', petal: '#b49be8', spike: true },
  bluebell: { type: 'flower', hours: 3, name: 'Bluebell', petal: '#8fb2f0', bell: true },
  cosmos: { type: 'flower', hours: 2.5, name: 'Cosmos', petal: '#f6b3e0', mid: '#f3d27a' },
  sunflower: { type: 'flower', hours: 5, name: 'Sunflower', petal: '#ffd43b', mid: '#7a4b22', tall: true },
  reed: { type: 'flower', hours: 3, name: 'Reeds', petal: '#a07a4a', reed: true },
  berrybush: { type: 'shrub', hours: 8, name: 'Berry bush', leaf: '#5e9e55', fruit: '#d6455e', food: true },
  rosebush: { type: 'shrub', hours: 10, name: 'Rose bush', leaf: '#4f8f4a', bloom: '#f28aa8' },
  hydrangea: { type: 'shrub', hours: 9, name: 'Hydrangea', leaf: '#5a9a62', bloom: '#a9bdf7' },
  fern: { type: 'shrub', hours: 6, name: 'Fern', leaf: '#4f9a5a', fern: true },
  apple: { type: 'tree', hours: 30, name: 'Apple tree', leaf: '#6fb15f', fruit: '#e2453f', food: true },
  cherry: { type: 'tree', hours: 24, name: 'Cherry tree', leaf: '#f5b5cc', blossom: true },
  willow: { type: 'tree', hours: 28, name: 'Willow', leaf: '#8cc27a', willow: true },
  birch: { type: 'tree', hours: 26, name: 'Birch', leaf: '#a9d47f', birch: true },
  oak: { type: 'tree', hours: 40, name: 'Oak', leaf: '#4f8f4a' },
  pine: { type: 'tree', hours: 32, name: 'Pine', leaf: '#3f7a52', pine: true },
  moonflower: { type: 'flower', hours: 3, name: 'Moonflower', petal: '#eef4ff', mid: '#9fd8ff', glow: '#bfe6ff' },
  crystallily: { type: 'flower', hours: 4, name: 'Crystal lily', petal: '#9ff0f0', mid: '#ffffff', glow: '#9ff0f0', crystal: true },
  glowshroom: { type: 'flower', hours: 2, name: 'Glowshroom', petal: '#8ff0d8', mid: '#e8fff8', glow: '#8ff0d8', shroom: true, cave: true },
  skyorchid: { type: 'flower', hours: 3, name: 'Sky orchid', petal: '#d8c8ff', mid: '#fff3a8', glow: '#e8dcff', bell: true },
  lanterntree: { type: 'tree', hours: 20, name: 'Lantern tree', leaf: '#3f6f5a', fruit: '#ffd76a', glow: '#ffd76a', food: true },
  spirittree: { type: 'tree', hours: 36, name: 'Spirit tree', leaf: '#5fc0b0', glow: '#bff7ea' }
};
export const COMMON = ['daisy', 'tulip', 'poppy', 'lavender', 'bluebell', 'cosmos', 'sunflower', 'berrybush', 'rosebush', 'hydrangea', 'apple', 'cherry', 'willow', 'birch', 'oak'];
export const stageOf = (p) => (p.g < 0.12 ? 0 : p.g < 0.4 ? 1 : p.g < 0.8 ? 2 : 3);
export const FRUIT_CAP = { tree: 4, shrub: 5 };

// who lives where, and what draws newcomers (counts of what you planted and found)
export const ANIMALS = {
  butterfly: { realm: 'surface', fly: true, speed: 20, cap: 12, why: 'the flowers', need: (s) => s.bloom >= 2 },
  bee: { realm: 'surface', fly: true, speed: 26, cap: 10, why: 'the blossoms', need: (s) => s.bloom >= 5 },
  songbird: { realm: 'surface', fly: true, speed: 34, cap: 10, why: 'the trees', need: (s) => s.trees >= 1, eats: true },
  rabbit: { realm: 'surface', speed: 30, cap: 10, why: 'the clover and berries', need: (s) => s.plants >= 6 && s.shrubs >= 1, eats: true, hop: true },
  hedgehog: { realm: 'surface', speed: 14, cap: 5, why: 'the shrubs', need: (s) => s.shrubs >= 2 && s.plants >= 10, eats: true },
  squirrel: { realm: 'surface', speed: 36, cap: 6, why: 'the grown trees', need: (s) => s.bigTrees >= 2, eats: true, hop: true },
  duck: { realm: 'surface', speed: 16, cap: 8, why: 'the lake', need: (s) => s.water >= 12, eats: true, water: true },
  frog: { realm: 'surface', speed: 12, cap: 6, why: 'the lake shore', need: (s) => s.water >= 12, hop: true, shore: true },
  deer: { realm: 'surface', speed: 22, cap: 5, why: 'the open meadow', need: (s) => s.trees >= 3, eats: true },
  fox: { realm: 'surface', speed: 30, cap: 3, why: 'all the life here', need: (s) => s.animals >= 14, eats: true },
  owl: { realm: 'surface', fly: true, speed: 18, cap: 3, why: 'the old trees', need: (s) => s.bigTrees >= 3, night: true },
  bat: { realm: 'cave', fly: true, speed: 30, cap: 8, why: 'the dark', need: (s) => s.seen >= 200 },
  glowworm: { realm: 'cave', fly: true, speed: 8, cap: 12, why: 'the glowshrooms', need: (s) => s.bloom >= 2 },
  salamander: { realm: 'cave', speed: 10, cap: 5, why: 'the damp stone', need: (s) => s.water >= 6, eats: true },
  cavefish: { realm: 'cave', speed: 14, cap: 6, why: 'the still pools', need: (s) => s.water >= 6, water: true },
  swallow: { realm: 'sky', fly: true, speed: 40, cap: 8, why: 'the open sky', need: (s) => s.seen >= 120 },
  cloudsheep: { realm: 'sky', speed: 10, cap: 6, why: 'the soft grass', need: (s) => s.plants >= 3, eats: true },
  dragonfly: { realm: 'sky', fly: true, speed: 30, cap: 6, why: 'the sky orchids', need: (s) => s.bloom >= 2 }
};

// ruins: [type, name, lore, rare seed, w, h, solid]
export const RUINS = {
  surface: [
    ['fountain', 'the Moss Fountain', 'Water still trickles from a spring nobody has found.', 'moonflower', 2, 2, 1],
    ['stones', 'the Singing Stones', 'When the wind passes through them they hum one low note.', 'crystallily', 3, 3, 0],
    ['arch', 'the Root Arch', 'Roots have grown through the old stones into a doorway.', 'lanterntree', 2, 1, 1],
    ['statue', 'the Fox Statue', 'A stone fox, worn smooth by many hands.', 'cherry', 1, 1, 1],
    ['shrine', 'the Lantern Shrine', 'A tiny shrine. Its lantern lights itself at dusk.', 'lanterntree', 1, 1, 1],
    ['obelisk', 'the Star Obelisk', 'Carved with constellations that are not ours.', 'spirittree', 1, 1, 1],
    ['well', 'the Wishing Well', 'Coins at the bottom, older than any country.', 'moonflower', 1, 1, 1],
    ['sundial', 'the Sundial of Slow Hours', 'Its shadow moves a little slower than time.', 'crystallily', 1, 1, 1],
    ['hand', 'the Sleeping Giant’s Hand', 'A great stone hand, palm up, cradling moss.', 'spirittree', 2, 1, 1],
    ['glyphs', 'the Glyph Floor', 'Patterned tiles that glow faintly after dark.', 'moonflower', 3, 3, 0],
    ['owlstatue', 'the Owl of the Gate', 'An owl carved from one stone, watching the east.', 'willow', 1, 1, 1],
    ['cloudstair', 'the Cloud Stair', 'White steps that climb into nothing. The wind pulls upward here.', 'skyorchid', 2, 2, 0]
  ],
  cave: [
    ['crystalheart', 'the Crystal Heart', 'A crystal as big as a house, warm to the touch.', 'glowshroom', 2, 2, 1],
    ['bones', 'the Sleeping Dragon', 'The bones of something enormous, curled up as if asleep.', 'spirittree', 3, 2, 1],
    ['moonpool', 'the Moon Pool', 'Still water that shows the night sky, though there is no sky down here.', 'moonflower', 2, 2, 1]
  ],
  sky: [
    ['windtemple', 'the Wind Temple', 'Open on every side. The wind comes here to rest.', 'skyorchid', 2, 2, 1],
    ['starharp', 'the Star Harp', 'Strings of light that hum when clouds drift through.', 'crystallily', 2, 1, 1],
    ['bell', 'the Floating Bell', 'A bronze bell that rings once a year, nobody knows when.', 'lanterntree', 1, 1, 1]
  ]
};

export const PAL = {
  surface: {
    morning: { grass: ['#b2deae', '#a5d6a3', '#bee6b8'], forest: ['#8cc595', '#80bb8a', '#97cc9d'], dot: ['#ffc4d8', '#fff0b8', '#dccfff', '#ffffff'], wild: ['#86c191', '#72b282', '#5fa274'], blade: '#9cd1a2', path: '#efdcc8', water: '#a9d8f1', water2: '#d4eefa', sand: '#f3e3c8', stone: '#ddd6d0', stone2: '#c6bcb4', moss: '#a6cf9a', rock: '#c9c4cc', rock2: '#a8a2ae', rock3: '#e2dee6', plank: '#d8b894' },
    day: { grass: ['#88cb70', '#7cc265', '#93d27a'], forest: ['#5e9e54', '#56944d', '#66a85b'], dot: ['#ff6b8a', '#ffd23f', '#ffffff', '#b28dff'], wild: ['#5ea55b', '#51974f', '#438843'], blade: '#74b766', path: '#dcc196', water: '#5aaee6', water2: '#9dd6f6', sand: '#ecd7a6', stone: '#bcb5ab', stone2: '#9d958b', moss: '#6ea85c', rock: '#a6a29a', rock2: '#7f7a72', rock3: '#c4c0b8', plank: '#b88a5a' },
    evening: { grass: ['#7ea877', '#73a06d', '#87b07f'], forest: ['#5a8a5e', '#507f55', '#639264'], dot: ['#f0b8d0', '#f8e0a0', '#c8b8f0', '#ffffff'], wild: ['#527f57', '#47734d', '#3c6643'], blade: '#6a9a68', path: '#cfb390', water: '#5f8cc0', water2: '#86afda', sand: '#d9bf98', stone: '#aaa2a8', stone2: '#8c8492', moss: '#5e8a62', rock: '#9a929e', rock2: '#77707c', rock3: '#b4acb8', plank: '#a8805a' }
  },
  cave: { floor: ['#6a5c6c', '#615364', '#736676'], wall: '#241e2c', wall2: '#45394f', wall3: '#76688a', water: '#1c3554', water2: '#2d5680', rubble: ['#6a5e70', '#5a4e62', '#7a6e80'], moss: '#4f6a5a', plank: '#7a5a40', dot: ['#8ff0d8', '#c8a8ff'] },
  sky: {
    morning: { grass: ['#c4ead0', '#b8e4c6', '#d0f0d8'], dot: ['#ffd6e6', '#fff4c8', '#e2d8ff', '#ffffff'], under: '#b89a86', under2: '#8f7464', mist: '#ffffff', cloud: '#fdfdff', bg: ['#f6d6e4', '#d4e6f8'] },
    day: { grass: ['#9fdc8a', '#94d47f', '#aae495'], dot: ['#ffffff', '#ffd23f', '#ff9ac0', '#b8a8ff'], under: '#a8826a', under2: '#7d604e', mist: '#ffffff', cloud: '#ffffff', bg: ['#7fc0f2', '#d6eefc'] },
    evening: { grass: ['#8fb48c', '#86ab83', '#98bd94'], dot: ['#f8c8d8', '#ffe2a8', '#d0c0f8', '#ffffff'], under: '#8a6a62', under2: '#6a4e4c', mist: '#ffe6ee', cloud: '#ffe8f0', bg: ['#f2a07c', '#6c5ca6'] }
  }
};
export const palFor = (realm, mode) => (realm === 'cave' ? PAL.cave : PAL[realm][mode] || PAL[realm].day);

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
export function tone(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), m = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

// retro finish for a sprite: hard pixel edges (no soft alpha) and a dark one-pixel outline
function crisp(cv, outline = 'rgba(38,28,44,.92)') {
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
const spriteCache = new Map();
export function plantSprite(k, st, fruit) {
  const key = `${k}|${st}|${fruit ? 1 : 0}`;
  let s = spriteCache.get(key);
  if (s) return s;
  const P = PLANTS[k], stem = '#5f9a4e', leaf = '#76b35f';
  let cv, c;
  if (st === 0) { [cv, c] = mk(8, 5); ell(c, 4, 3.5, 3.5, 1.6, P.cave ? '#5a4a52' : '#9b7653'); px(c, 3, 2, '#b8936b', 2); px(c, 4, 1, P.cave ? P.petal : '#7fbf68'); }
  else if (P.shroom) {
    const big = st === 3, n = st === 1 ? 1 : big ? 3 : 2;
    [cv, c] = mk(14, big ? 12 : 9);
    for (let i = 0; i < n; i++) { const x = 3 + i * 4, h = (big ? 7 : 5) - i; px(c, x, cv.height - h, '#e8e0d0', 2, h); ell(c, x + 1, cv.height - h, 2.8, 1.8, P.petal); px(c, x, cv.height - h - 1, P.mid); }
  } else if (P.type === 'flower') {
    if (st === 1) { [cv, c] = mk(8, 8); px(c, 4, 3, stem, 1, 5); ell(c, 2.5, 4, 1.8, 1, leaf); ell(c, 5.5, 3, 1.8, 1, leaf); }
    else if (P.reed) {
      const h = st === 3 ? 20 : 12;
      [cv, c] = mk(10, h);
      for (const [x, d] of [[2, 3], [5, 0], [7, 2]]) { px(c, x, d, '#6aa05a', 1, h - d); if (st === 3) px(c, x, d, P.petal, 1, 4); }
    } else {
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
    else if (P.fern) {
      const big = st === 3, w = big ? 18 : 12, h = big ? 12 : 8;
      [cv, c] = mk(w, h);
      for (let i = 0; i < (big ? 7 : 4); i++) { const a = -Math.PI + (i + 0.5) * (Math.PI / (big ? 7 : 4)), L = big ? 8 : 5; for (let k2 = 0; k2 < L; k2++) px(c, Math.round(w / 2 + Math.cos(a) * k2), Math.round(h - 1 + Math.sin(a) * k2 * 0.9), k2 % 2 ? P.leaf : tone(P.leaf, 0.2)); }
    } else {
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
    else if (P.pine) {
      const big = st === 3, w = big ? 26 : 14, h = big ? 44 : 24;
      [cv, c] = mk(w, h);
      px(c, w / 2 - 1, h - (big ? 8 : 5), '#6a4a34', 2, big ? 8 : 5);
      const tiers = big ? 4 : 3;
      for (let i = 0; i < tiers; i++) {
        const tw = (w / 2 - 1) * (1 - i / (tiers + 0.6)), ty = h - (big ? 8 : 5) - i * (big ? 9 : 5.5);
        c.fillStyle = tone(P.leaf, -0.2); c.beginPath(); c.moveTo(w / 2 - tw, ty); c.lineTo(w / 2, ty - (big ? 14 : 8)); c.lineTo(w / 2 + tw, ty); c.fill();
        c.fillStyle = P.leaf; c.beginPath(); c.moveTo(w / 2 - tw + 1, ty - 1); c.lineTo(w / 2, ty - (big ? 14 : 8)); c.lineTo(w / 2 + tw * 0.3, ty - 1); c.fill();
      }
    } else {
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
  const cc = crisp(cv);
  s = { cv: cc, w: cc.width, h: cc.height };
  spriteCache.set(key, s);
  return s;
}

// animals: two frames each, drawn facing right
export function animalSprite(k, f) {
  const key = `a|${k}|${f}`;
  let s = spriteCache.get(key);
  if (s) return s;
  let cv, c;
  const B = '#2a2224';
  switch (k) {
    case 'rabbit': [cv, c] = mk(12, 11); { const up = f ? 1 : 0; ell(c, 5.5, 7 - up, 4.5, 3, '#d9c7b4'); ell(c, 9, 5 - up, 2.6, 2.4, '#d9c7b4'); px(c, 8, 1 - up, '#d9c7b4', 1, 3); px(c, 10, 1 - up, '#cdb8a4', 1, 3); px(c, 8, 2 - up, '#f2c2c8'); ell(c, 1.8, 6.5 - up, 1.4, 1.4, '#ffffff'); px(c, 10, 4 - up, B); px(c, 11, 5 - up, '#e89aa6'); if (f) { px(c, 2, 9, '#c9b6a2', 2, 1); px(c, 7, 9, '#c9b6a2', 2, 1); } else { px(c, 3, 9, '#c9b6a2', 2, 2); px(c, 7, 9, '#c9b6a2', 2, 2); } } break;
    case 'deer': [cv, c] = mk(16, 17); { ell(c, 7, 9, 5.5, 3.2, '#b78456'); for (const x of [3, 5, 9, 11]) px(c, x + (f && (x === 5 || x === 11) ? 1 : 0), 11, '#8f6440', 1, 6); px(c, 11, 3, '#b78456', 2, 6); ell(c, 13, 3, 2.4, 1.8, '#b78456'); px(c, 14, 2, B); px(c, 15, 3, B); px(c, 12, 0, '#8a6a4a', 1, 2); px(c, 13, 0, '#8a6a4a'); ell(c, 2, 8, 1.2, 1.2, '#f4eee6'); for (const x of [5, 8, 6]) px(c, x, 8, '#efe0cc'); } break;
    case 'duck': [cv, c] = mk(11, 9); { ell(c, 5, 6, 4.5, 2.6, '#f4efe6'); ell(c, 8.5, 3, 2, 2, '#4f9a6a'); px(c, 10, 3, '#f0a030'); px(c, 9, 2, B); px(c, 2, 4 + f, '#e6dfd3', 3, 1); } break;
    case 'songbird': [cv, c] = mk(9, 7); { ell(c, 4, 4, 3, 2.2, '#8a6a5a'); ell(c, 5, 4.6, 2, 1.4, '#f07a5a'); ell(c, 6.5, 2.5, 1.6, 1.6, '#8a6a5a'); px(c, 7, 2, B); px(c, 8, 2, '#f0b040'); if (f) px(c, 2, 1, '#6a4e40', 3, 2); else px(c, 1, 4, '#6a4e40', 3, 1); } break;
    case 'swallow': [cv, c] = mk(11, 7); { ell(c, 5, 4, 3.4, 1.6, '#2a3a6a'); ell(c, 6, 4.6, 2, 1, '#f4ece0'); px(c, 8, 3, '#c0503a', 2, 1); px(c, 9, 3, B); px(c, 0, 4, '#2a3a6a', 2, 1); px(c, 0, 5, '#2a3a6a'); if (f) px(c, 3, 0, '#3a4a7a', 4, 3); else px(c, 2, 5, '#3a4a7a', 5, 2); } break;
    case 'butterfly': [cv, c] = mk(9, 7); { const col = ['#f7a8c8', '#ffe08a', '#b9a8f5', '#9fd8f0'][f % 4]; if (f) { ell(c, 2.5, 2.5, 2.3, 2.3, col); ell(c, 6.5, 2.5, 2.3, 2.3, col); ell(c, 3, 5, 1.6, 1.4, tone(col, -0.1)); ell(c, 6, 5, 1.6, 1.4, tone(col, -0.1)); } else { ell(c, 3.5, 3, 1.2, 2.6, col); ell(c, 5.5, 3, 1.2, 2.6, col); } px(c, 4, 1, B, 1, 5); } break;
    case 'dragonfly': [cv, c] = mk(11, 7); { px(c, 1, 3, '#3ac0b0', 8, 1); ell(c, 9, 3.5, 1.4, 1.4, '#2a8a9a'); px(c, 3, f ? 0 : 1, 'rgba(220,250,255,.85)', 3, 2); px(c, 3, f ? 5 : 4, 'rgba(220,250,255,.85)', 3, 2); px(c, 6, f ? 0 : 1, 'rgba(220,250,255,.85)', 2, 2); px(c, 6, f ? 5 : 4, 'rgba(220,250,255,.85)', 2, 2); } break;
    case 'bee': [cv, c] = mk(7, 5); { ell(c, 3.5, 3, 2.6, 1.7, '#f6c445'); px(c, 3, 2, B, 1, 3); px(c, 5, 2, B, 1, 2); px(c, 2 + f, 0, '#e8f4ff', 2, 2); } break;
    case 'hedgehog': [cv, c] = mk(11, 7); { ell(c, 5, 4.5, 4.5, 2.6, '#7a5a40'); for (let i = 1; i < 9; i += 2) px(c, i, 1 + (i % 3 === 0 ? 1 : 0), '#5e4430', 1, 2); ell(c, 9, 5, 1.8, 1.4, '#d8bc98'); px(c, 10, 4, B); px(c, 10, 6, B); px(c, 3 + f, 6, '#5e4430'); } break;
    case 'frog': [cv, c] = mk(8, 6); { ell(c, 4, 4, 3.5, 2 - f * 0.4, '#7cc46a'); px(c, 2, 1, '#7cc46a', 2, 2); px(c, 5, 1, '#7cc46a', 2, 2); px(c, 2, 1, B); px(c, 6, 1, B); px(c, 3, 4, '#5a9a4a', 3, 1); } break;
    case 'fox': [cv, c] = mk(15, 10); { ell(c, 7, 6, 5, 2.6, '#e88a3c'); ell(c, 2, 5, 2.6, 1.8, '#e88a3c'); px(c, 0, 5, '#ffffff', 2, 1); ell(c, 12, 4, 2.6, 2.2, '#e88a3c'); px(c, 11, 1, '#c86a2a', 1, 2); px(c, 13, 1, '#c86a2a', 1, 2); px(c, 13, 4, B); px(c, 14, 5, '#ffffff'); for (const x of [4, 9]) px(c, x + f, 8, '#5a3a2a', 1, 2); } break;
    case 'squirrel': [cv, c] = mk(10, 10); { ell(c, 2.5, 3.5 + f, 2.4, 3.4, '#c0703a'); ell(c, 6, 6, 2.6, 2.4, '#c87a44'); ell(c, 7.5, 3.5, 1.8, 1.8, '#c87a44'); px(c, 8, 3, B); px(c, 7, 1, '#a85a2a'); px(c, 5, 8, '#a85a2a', 2, 1); } break;
    case 'owl': [cv, c] = mk(9, 10); { ell(c, 4.5, 5.5, 3.6, 4.2, '#8a6a52'); ell(c, 4.5, 6.5, 2.4, 2.8, '#c9b096'); px(c, 2, 3, '#ffe9a8', 2, 2); px(c, 5, 3, '#ffe9a8', 2, 2); px(c, 2 + f, 3, B); px(c, 5 + f, 3, B); px(c, 4, 5, '#e0a040'); px(c, 1, 1, '#8a6a52'); px(c, 7, 1, '#8a6a52'); } break;
    case 'bat': [cv, c] = mk(11, 6); { ell(c, 5.5, 3, 1.8, 2, '#3a2e44'); px(c, 4, 0, '#3a2e44'); px(c, 6, 0, '#3a2e44'); px(c, 5, 2, '#ffd0d0'); if (f) { px(c, 0, 1, '#4a3c56', 4, 2); px(c, 7, 1, '#4a3c56', 4, 2); } else { px(c, 1, 3, '#4a3c56', 3, 2); px(c, 7, 3, '#4a3c56', 3, 2); } } break;
    case 'glowworm': [cv, c] = mk(4, 4); { ell(c, 2, 2, 1.6, 1.6, f ? '#d8ffa0' : '#b8f080'); } break;
    case 'salamander': [cv, c] = mk(13, 5); { px(c, 1, 2, '#e8743a', 10, 2); ell(c, 11, 2.5, 1.8, 1.6, '#e8743a'); px(c, 11, 2, B); for (const x of [3, 8]) px(c, x + f, 4, '#c85a2a'); for (const x of [4, 7]) px(c, x, 2, '#3a2a2a'); } break;
    case 'cavefish': [cv, c] = mk(9, 5); { ell(c, 4, 2.5, 3.2, 1.6, '#c8e8f8'); px(c, 0, 1 + f, '#a8d0e8', 1, 2); px(c, 6, 2, '#5a8aa8'); } break;
    case 'cloudsheep': [cv, c] = mk(14, 11); { for (const [x, y, r] of [[4, 5, 3], [7, 4, 3.4], [10, 5, 3], [7, 7, 3.4]]) ell(c, x, y, r, r * 0.8, '#ffffff'); ell(c, 12, 6, 1.8, 1.6, '#4a3e48'); px(c, 12, 5, '#ffffff'); for (const x of [4, 9]) px(c, x + f, 9, '#4a3e48', 1, 2); } break;
    default: [cv, c] = mk(6, 6); ell(c, 3, 3, 2.5, 2.5, '#fff');
  }
  cv = k === 'glowworm' ? cv : crisp(cv);
  s = { cv, w: cv.width, h: cv.height };
  spriteCache.set(key, s);
  return s;
}

export function ruinSprite(type, P) {
  const key = `r|${type}|${P.stone || P.wall2 || P.under}`;
  let s = spriteCache.get(key);
  if (s) return s;
  let cv, c;
  const st = P.stone || '#bcb5ab', dk = P.stone2 || '#8f877e', mo = P.moss || '#6ea85c', wat = P.water || '#5aaee6';
  switch (type) {
    case 'fountain': [cv, c] = mk(32, 22); ell(c, 16, 14, 15, 7, dk); ell(c, 16, 13, 13.5, 5.8, st); ell(c, 16, 13, 11, 4.4, wat); px(c, 15, 2, st, 3, 10); ell(c, 16.5, 3, 3, 1.6, st); px(c, 4, 15, mo, 4, 2); px(c, 24, 9, mo, 3, 1); break;
    case 'stones': [cv, c] = mk(10, 18); px(c, 1, 2, dk, 8, 16); px(c, 2, 1, st, 6, 16); px(c, 2, 1, mo, 3, 2); px(c, 3, 8, dk, 1, 3); break;
    case 'arch': [cv, c] = mk(32, 30); px(c, 2, 6, dk, 7, 24); px(c, 23, 6, dk, 7, 24); px(c, 3, 6, st, 5, 24); px(c, 24, 6, st, 5, 24); px(c, 1, 2, dk, 30, 6); px(c, 2, 1, st, 28, 5); px(c, 6, 1, mo, 8, 2); px(c, 20, 26, mo, 6, 2); for (let i = 0; i < 6; i++) px(c, 8 + i * 3, 6 + (i % 2) * 2, '#7a5a3a', 1, 6); break;
    case 'statue': case 'owlstatue': [cv, c] = mk(16, 24); px(c, 2, 18, dk, 12, 6); px(c, 3, 17, st, 10, 6); if (type === 'statue') { ell(c, 8, 12, 5, 4, st); ell(c, 11, 7, 3, 3, st); px(c, 10, 3, st); px(c, 12, 3, st); ell(c, 3, 10, 2, 3, st); } else { ell(c, 8, 10, 4.5, 6, st); px(c, 5, 6, dk, 2, 2); px(c, 9, 6, dk, 2, 2); px(c, 5, 3, st); px(c, 10, 3, st); } px(c, 4, 15, mo, 4, 2); break;
    case 'shrine': [cv, c] = mk(18, 24); px(c, 3, 10, '#a0563a', 2, 14); px(c, 13, 10, '#a0563a', 2, 14); px(c, 1, 8, '#7a3a2a', 16, 3); px(c, 0, 6, '#c0603a', 18, 2); px(c, 6, 14, '#e8d8b8', 6, 7); px(c, 8, 16, '#ffd76a', 2, 3); break;
    case 'obelisk': [cv, c] = mk(10, 32); c.fillStyle = dk; c.beginPath(); c.moveTo(1, 32); c.lineTo(3, 4); c.lineTo(5, 0); c.lineTo(7, 4); c.lineTo(9, 32); c.fill(); c.fillStyle = st; c.beginPath(); c.moveTo(2, 32); c.lineTo(4, 5); c.lineTo(5, 2); c.lineTo(6, 5); c.lineTo(7, 32); c.fill(); for (let y = 9; y < 28; y += 4) px(c, 4, y, '#9fd8ff', 2, 1); break;
    case 'well': [cv, c] = mk(18, 20); ell(c, 9, 14, 8, 5, dk); ell(c, 9, 13, 7, 4, st); ell(c, 9, 13, 5, 2.6, '#2a3a4a'); px(c, 2, 2, '#8a6446', 2, 12); px(c, 14, 2, '#8a6446', 2, 12); px(c, 1, 1, '#a0563a', 16, 2); break;
    case 'sundial': [cv, c] = mk(14, 14); px(c, 4, 6, dk, 6, 8); px(c, 5, 6, st, 4, 8); ell(c, 7, 5, 6, 2.6, st); c.fillStyle = dk; c.beginPath(); c.moveTo(7, 5); c.lineTo(7, 0); c.lineTo(10, 5); c.fill(); break;
    case 'hand': [cv, c] = mk(30, 18); ell(c, 15, 12, 13, 5, dk); ell(c, 15, 11, 12, 4.4, st); for (let i = 0; i < 4; i++) { px(c, 6 + i * 5, 2 + Math.abs(i - 1.5) * 2, st, 3, 9); px(c, 6 + i * 5, 2 + Math.abs(i - 1.5) * 2, mo, 3, 1); } ell(c, 15, 11, 6, 2, mo); break;
    case 'cloudstair': [cv, c] = mk(32, 40); for (let i = 0; i < 7; i++) { const y = 36 - i * 5, a = 1 - i / 8; c.globalAlpha = a; px(c, 4 + i * 2, y, '#d8d4dc', 24 - i * 2, 4); px(c, 4 + i * 2, y, '#ffffff', 24 - i * 2, 1); } c.globalAlpha = 1; break;
    case 'crystalheart': [cv, c] = mk(32, 36); for (const [x, h2, w2, col] of [[16, 34, 9, '#9ff0f0'], [8, 22, 5, '#b8a8ff'], [24, 24, 6, '#8fd8ff'], [12, 14, 4, '#d8fffa']]) { c.fillStyle = col; c.beginPath(); c.moveTo(x - w2, 36); c.lineTo(x, 36 - h2); c.lineTo(x + w2, 36); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(x - w2 * 0.4, 36); c.lineTo(x, 36 - h2); c.lineTo(x, 36); c.fill(); } break;
    case 'bones': [cv, c] = mk(48, 22); c.strokeStyle = '#e8e0cc'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(10 + i * 6, 16, 3, 9 - Math.abs(i - 2.5), 0, Math.PI, 0); c.stroke(); } px(c, 6, 15, '#e8e0cc', 36, 2); ell(c, 44, 14, 4, 3, '#e8e0cc'); px(c, 45, 13, '#2a2224'); break;
    case 'moonpool': [cv, c] = mk(32, 22); ell(c, 16, 13, 15, 7, '#5a5068'); ell(c, 16, 12, 13, 5.6, '#0e1530'); for (let i = 0; i < 9; i++) px(c, 6 + ((i * 7) % 20), 9 + ((i * 3) % 6), '#ffffff'); ell(c, 21, 11, 2, 2, '#f4f0d0'); break;
    case 'windtemple': [cv, c] = mk(32, 34); c.fillStyle = '#e8e2ec'; c.beginPath(); c.moveTo(0, 10); c.lineTo(16, 0); c.lineTo(32, 10); c.fill(); px(c, 2, 10, '#cfc8d6', 28, 3); for (const x of [4, 13, 22]) { px(c, x, 13, '#f4f0f6', 5, 19); px(c, x, 13, '#d8d0de', 1, 19); } px(c, 1, 31, '#cfc8d6', 30, 3); break;
    case 'starharp': [cv, c] = mk(32, 32); c.strokeStyle = '#d8c070'; c.lineWidth = 3; c.beginPath(); c.arc(16, 30, 14, Math.PI, 0); c.stroke(); for (let i = 0; i < 6; i++) px(c, 6 + i * 4, 18 + Math.abs(i - 2.5) * 1.5, '#fff6c8', 1, 12 - Math.abs(i - 2.5) * 2); break;
    case 'bell': [cv, c] = mk(18, 26); px(c, 1, 2, '#8a6446', 2, 24); px(c, 15, 2, '#8a6446', 2, 24); px(c, 1, 1, '#a0763a', 16, 2); c.fillStyle = '#c99a4a'; c.beginPath(); c.moveTo(4, 18); c.quadraticCurveTo(9, 2, 14, 18); c.fill(); px(c, 8, 18, '#7a5a2a', 2, 2); break;
    default: [cv, c] = mk(8, 8); px(c, 0, 0, st, 8, 8);
  }
  cv = crisp(cv, 'rgba(34,30,38,.85)');
  s = { cv, w: cv.width, h: cv.height };
  spriteCache.set(key, s);
  return s;
}
export function crystalSprite(col) {
  const key = `cr|${col}`;
  let s = spriteCache.get(key);
  if (s) return s;
  const [cv, c] = mk(12, 16);
  for (const [x, h, w] of [[6, 15, 3], [3, 9, 2], [9, 11, 2]]) { c.fillStyle = col; c.beginPath(); c.moveTo(x - w, 16); c.lineTo(x, 16 - h); c.lineTo(x + w, 16); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(x - w * 0.3, 16); c.lineTo(x, 16 - h); c.lineTo(x, 16); c.fill(); }
  const cc = crisp(cv, 'rgba(30,24,40,.9)');
  s = { cv: cc, w: cc.width, h: cc.height };
  spriteCache.set(key, s);
  return s;
}

// ------------------------------------------------ realms
export const ix = (Rm, x, y) => y * Rm.w + x;
export const inside = (Rm, x, y) => x >= 0 && y >= 0 && x < Rm.w && y < Rm.h;
function mkRealm(name, seed) {
  const n = SIZE[name];
  return { name, seed, w: n, h: n, wild: new Uint8Array(n * n), ground: new Uint8Array(n * n), seen: new Uint8Array(n * n), plants: [], animals: [], ruins: [], portals: [], decor: [], hero: { x: (n / 2) * T + 8, y: (n / 2) * T + 12 }, visited: 0 };
}
// value at quantile q of a noise map (so lakes and hills come out the same size on every seed)
function quant(arr, q) { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
const near4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function placeRuins(Rm, R, list, ok, dmin, dmax, cx, cy) {
  for (const r of list) {
    // a preferred distance first (the Cloud Stair sits at a middling one), then anywhere further out
    for (let tries = 0; tries < 900; tries++) {
      const wide = tries >= 400, a = R() * Math.PI * 2, d = wide ? dmin + (dmax + 14 - dmin) * R() : dmin + (dmax - dmin) * (r[0] === 'cloudstair' ? 0.35 + R() * 0.2 : R()), x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (x < 3 || y < 3 || x + r[4] >= Rm.w - 3 || y + r[5] >= Rm.h - 3) continue;
      if (Rm.ruins.some((o) => Math.hypot(o.x - x, o.y - y) < 8)) continue;
      let bad = false;
      for (let yy = y - 1; yy <= y + r[5] && !bad; yy++) for (let xx = x - 1; xx <= x + r[4]; xx++) if (!ok(xx, yy)) { bad = true; break; }
      if (bad) continue;
      Rm.ruins.push({ t: r[0], name: r[1], lore: r[2], seed: r[3], x, y, w: r[4], h: r[5], solid: r[6], found: 0 });
      for (let yy = y; yy < y + r[5]; yy++) for (let xx = x; xx < x + r[4]; xx++) Rm.wild[ix(Rm, xx, yy)] = Math.max(2, Rm.wild[ix(Rm, xx, yy)]);
      break;
    }
  }
}
function natural(Rm, k, x, y, extra = {}) { Rm.plants.push({ k, x, y, g: 1, w: 0, fr: PLANTS[k].food ? 2 : 0, sd: 0, n: 1, ...extra }); }
function critter(G, Rm, k, x, y) { Rm.animals.push({ id: G.nextId++, k, x: x * T + 8, y: y * T + 8, b: now() - 48 * HR, f: 0, baby: 0, n: 1 }); }

// the meadows: meadow, forest, flower fields, lakes with islands, rocky hills with cave mouths
function genSurface(G, R, avoid = () => false) {
  const Rm = mkRealm('surface', G.seed), N = Rm.w, M = N / 2;
  const hN = noiseMap(R, N, 5, 3), mN = noiseMap(R, N, 4, 4), wN = noiseMap(R, N, 4, 6);
  const qWater = quant(hN, 0.15), qSand = quant(hN, 0.18), qRock = quant(hN, 0.88), qForest = quant(mN, 0.72), qFlowers = quant(mN, 0.2);
  const qW1 = quant(wN, 0.42), qW2 = quant(wN, 0.62), qW3 = quant(wN, 0.82);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = ix(Rm, x, y), d = Math.hypot(x - M, y - M), edge = Math.min(x, y, N - 1 - x, N - 1 - y);
    let h = hN[i];
    if (d < 13) h = h + (0.5 - h) * Math.min(1, (1 - d / 13) * 1.4);       // flat ground at the start
    const g = d < 7.5 ? GRASS : edge < 2 ? ROCK : h < qWater ? WATER : h < qSand ? SAND : h > qRock || edge < 4 && R() < 0.7 ? ROCK : mN[i] > qForest ? FOREST : mN[i] < qFlowers ? FLOWERS : GRASS;
    Rm.ground[i] = g;
    const w = wN[i];
    Rm.wild[i] = d < 7 || g === WATER || g === ROCK ? 0 : Math.min(3, (w > qW3 ? 3 : w > qW2 ? 2 : w > qW1 ? 1 : 0) + (g === FOREST && w > qW1 * 0.9 ? 1 : 0));
  }
  // cave mouths: rock faces with open ground in front
  const mouths = [];
  for (let tries = 0; tries < 6000 && mouths.length < 4; tries++) {
    const x = 4 + Math.floor(R() * (N - 8)), y = 4 + Math.floor(R() * (N - 8)), d = Math.hypot(x - M, y - M);
    if (d < 14 || d > 56 || avoid(x, y)) continue;
    if (Rm.ground[ix(Rm, x, y)] !== ROCK || Rm.ground[ix(Rm, x, y - 1)] !== ROCK || Rm.ground[ix(Rm, x - 1, y)] !== ROCK || Rm.ground[ix(Rm, x + 1, y)] !== ROCK) continue;
    const front = Rm.ground[ix(Rm, x, y + 1)];
    if (front === ROCK || front === WATER) continue;
    if (mouths.some((m) => Math.hypot(m.x - x, m.y - y) < 18)) continue;
    Rm.ground[ix(Rm, x, y)] = PORTAL;
    for (let k = 1; k <= 2; k++) { const j = ix(Rm, x, y + k); if (Rm.ground[j] !== WATER) { Rm.wild[j] = 0; if (Rm.ground[j] === ROCK) Rm.ground[j] = GRASS; } }
    mouths.push({ x, y });
  }
  // a little island in the biggest lake, reached by building a bridge
  const land = (x, y) => inside(Rm, x, y) && Rm.ground[ix(Rm, x, y)] !== WATER;
  for (let tries = 0; tries < 3000; tries++) {
    const x = 6 + Math.floor(R() * (N - 12)), y = 6 + Math.floor(R() * (N - 12));
    let deep = true;
    for (let yy = y - 5; yy <= y + 5 && deep; yy++) for (let xx = x - 5; xx <= x + 5; xx++) if (land(xx, yy)) { deep = false; break; }
    if (!deep || avoid(x, y)) continue;
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) { const q = Math.hypot(xx - x, yy - y); if (q <= 2.3) { Rm.ground[ix(Rm, xx, yy)] = q < 1.6 ? GRASS : SAND; Rm.wild[ix(Rm, xx, yy)] = q < 1.6 ? 1 : 0; } }
    natural(Rm, 'willow', x, y);
    Rm.decor.push({ t: 'island', x, y });
    break;
  }
  const ok = (x, y) => inside(Rm, x, y) && ![WATER, ROCK, PORTAL].includes(Rm.ground[ix(Rm, x, y)]) && !avoid(x, y) && Math.hypot(x - M, y - M) > 8;
  placeRuins(Rm, R, RUINS.surface, ok, 10, 50, M, M);
  for (const r of Rm.ruins) for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) Rm.ground[ix(Rm, xx, yy)] = GRASS;
  // what already grows here, and who already lives here
  const free = (x, y) => !Rm.wild[ix(Rm, x, y)] || Rm.wild[ix(Rm, x, y)] < 3;
  const taken = new Set(Rm.plants.map((p) => `${p.x},${p.y}`));
  const trees = new Set();
  const ruinAt = (x, y) => Rm.ruins.some((r) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
  for (let y = 3; y < N - 3; y++) for (let x = 3; x < N - 3; x++) {
    const i = ix(Rm, x, y), g = Rm.ground[i], d = Math.hypot(x - M, y - M);
    if (d < 7 || avoid(x, y) || ruinAt(x, y) || taken.has(`${x},${y}`)) continue;
    const r = R();
    if (g === FOREST && r < 0.2 && free(x, y) && !trees.has(`${x - 1},${y}`) && !trees.has(`${x},${y - 1}`) && !trees.has(`${x - 1},${y - 1}`) && !trees.has(`${x + 1},${y - 1}`)) { natural(Rm, R() < 0.5 ? 'pine' : R() < 0.5 ? 'oak' : 'birch', x, y); trees.add(`${x},${y}`); }
    else if (g === FOREST && r < 0.32) natural(Rm, 'fern', x, y);
    else if ((g === SAND || g === GRASS) && r < 0.2 && near4.some(([dx, dy]) => Rm.ground[ix(Rm, x + dx, y + dy)] === WATER)) natural(Rm, 'reed', x, y);
    else if (g === GRASS && r < 0.012 && d > 10) natural(Rm, R() < 0.5 ? 'apple' : 'cherry', x, y);
    else if (g === FLOWERS && r < 0.06) natural(Rm, COMMON[Math.floor(R() * 7)], x, y);
  }
  const spot = (pred) => { for (let t = 0; t < 2000; t++) { const x = 3 + Math.floor(R() * (N - 6)), y = 3 + Math.floor(R() * (N - 6)); if (Math.hypot(x - M, y - M) > 12 && !avoid(x, y) && pred(Rm.ground[ix(Rm, x, y)], x, y)) return [x, y]; } return null; };
  for (const [k, n, pred] of [['deer', 3, (g) => g === FOREST], ['rabbit', 4, (g) => g === GRASS || g === FLOWERS], ['duck', 4, (g) => g === WATER], ['frog', 2, (g) => g === SAND], ['songbird', 4, (g) => g === FOREST], ['squirrel', 2, (g) => g === FOREST], ['butterfly', 4, (g) => g === FLOWERS]]) {
    for (let i = 0; i < n; i++) { const p = spot(pred); if (p) critter(G, Rm, k, p[0], p[1]); }
  }
  // the start: a few flowers and a young cherry
  for (const [k, x, y, g] of [['daisy', -2, 1, 0.95], ['daisy', -3, 2, 0.9], ['tulip', 2, 2, 0.5], ['cherry', 3, -3, 0.45]]) Rm.plants.push({ k, x: M + x, y: M + y, g, w: 0, fr: 0, sd: 0 });
  critter(G, Rm, 'butterfly', M - 1, M); critter(G, Rm, 'butterfly', M + 2, M - 1);
  Rm.hero = { x: M * T + 8, y: (M + 1) * T + 12 };
  Rm.mouths = mouths;
  return Rm;
}

// the caverns: cellular caves with pools, rubble to clear, glowshrooms and crystals
function genCave(G, R, mouths) {
  const Rm = mkRealm('cave', G.seed ^ 0x5bd1), N = Rm.w;
  let wall = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0; wall[i] = x < 2 || y < 2 || x >= N - 2 || y >= N - 2 || R() < 0.46 ? 1 : 0; }
  for (let it = 0; it < 5; it++) {
    const nw = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; n += xx < 0 || yy < 0 || xx >= N || yy >= N ? 1 : wall[yy * N + xx]; }
      nw[y * N + x] = x < 2 || y < 2 || x >= N - 2 || y >= N - 2 ? 1 : n >= 5 ? 1 : 0;
    }
    wall = nw;
  }
  // keep the largest open region
  const reg = new Int32Array(N * N).fill(-1);
  let best = -1, bestN = 0;
  for (let i = 0; i < N * N; i++) {
    if (wall[i] || reg[i] >= 0) continue;
    const q = [i]; reg[i] = i; let n = 0;
    for (let k = 0; k < q.length; k++) { const c = q[k], x = c % N, y = (c / N) | 0; n++; for (const [dx, dy] of near4) { const j = (y + dy) * N + x + dx; if (!wall[j] && reg[j] < 0) { reg[j] = i; q.push(j); } } }
    if (n > bestN) { bestN = n; best = i; }
  }
  const pN = noiseMap(R, N, 3, 4), rN = noiseMap(R, N, 3, 5), qPool = quant(pN, 0.08), qR = quant(rN, 0.7);
  for (let i = 0; i < N * N; i++) {
    const open = !wall[i] && reg[i] === best;
    Rm.ground[i] = open ? (pN[i] < qPool ? WATER : GRASS) : ROCK;
    Rm.wild[i] = open && Rm.ground[i] === GRASS && rN[i] > qR ? 1 + (rN[i] > quant(rN, 0.85) ? 1 : 0) : 0;
  }
  const floor = [];
  for (let i = 0; i < N * N; i++) if (Rm.ground[i] === GRASS) floor.push(i);
  const pick = (far = []) => { for (let t = 0; t < 500; t++) { const i = floor[Math.floor(R() * floor.length)], x = i % N, y = (i / N) | 0; if (far.every((p) => Math.hypot(p.x - x, p.y - y) > 14)) return { x, y }; } const i = floor[Math.floor(R() * floor.length)]; return { x: i % N, y: (i / N) | 0 }; };
  // one way up for each cave mouth
  const ups = [];
  for (const m of mouths) {
    const p = pick(ups);
    ups.push(p);
    Rm.ground[ix(Rm, p.x, p.y)] = PORTAL;
    for (let yy = p.y - 2; yy <= p.y + 2; yy++) for (let xx = p.x - 2; xx <= p.x + 2; xx++) if (inside(Rm, xx, yy) && Rm.ground[ix(Rm, xx, yy)] !== ROCK) Rm.wild[ix(Rm, xx, yy)] = 0;
    Rm.portals.push({ x: p.x, y: p.y, to: 'surface', tx: m.x, ty: m.y + 1, kind: 'up' });
  }
  const ok = (x, y) => inside(Rm, x, y) && Rm.ground[ix(Rm, x, y)] === GRASS && !ups.some((p) => Math.hypot(p.x - x, p.y - y) < 5);
  placeRuins(Rm, R, RUINS.cave, ok, 6, 40, N / 2, N / 2);
  for (const i of floor) {
    const x = i % N, y = (i / N) | 0, r = R();
    if (Rm.ground[i] !== GRASS || Rm.ruins.some((u) => x >= u.x - 1 && x <= u.x + u.w && y >= u.y - 1 && y <= u.y + u.h) || ups.some((p) => Math.hypot(p.x - x, p.y - y) < 2)) continue;
    if (r < 0.035) natural(Rm, 'glowshroom', x, y);
    else if (r < 0.055) Rm.decor.push({ t: 'crystal', x, y, c: ['#9ff0f0', '#c8a8ff', '#8fd8ff', '#ffb8e8'][Math.floor(R() * 4)] });
  }
  const pools = [];
  for (let q = 0; q < N * N; q++) if (Rm.ground[q] === WATER) pools.push(q);
  for (const [k, n, list] of [['bat', 4, floor], ['salamander', 2, floor], ['cavefish', 3, pools], ['glowworm', 6, floor]]) {
    for (let i = 0; i < n && list.length; i++) { const j = list[Math.floor(R() * list.length)]; critter(G, Rm, k, j % N, (j / N) | 0); }
  }
  Rm.hero = ups.length ? { x: ups[0].x * T + 8, y: (ups[0].y + 1) * T + 12 } : Rm.hero;
  return { Rm, ups };
}

// the sky: islands over a sea of cloud, joined by cloud paths; mist to clear
function genSky(G, R) {
  const Rm = mkRealm('sky', G.seed ^ 0x2c9f), N = Rm.w, nN = noiseMap(R, N, 3, 5);
  Rm.ground.fill(VOID);
  const isl = [];
  for (let t = 0; t < 400 && isl.length < 8; t++) {
    const x = 8 + R() * (N - 16), y = 8 + R() * (N - 16), r = isl.length === 0 ? 6 : 3.5 + R() * 4.5;
    if (isl.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 4)) continue;
    isl.push({ x, y, r });
  }
  for (const o of isl) for (let y = Math.floor(o.y - o.r - 2); y <= o.y + o.r + 2; y++) for (let x = Math.floor(o.x - o.r - 2); x <= o.x + o.r + 2; x++) {
    if (!inside(Rm, x, y)) continue;
    const d = Math.hypot(x - o.x, y - o.y) / o.r + (nN[ix(Rm, x, y)] - 0.5) * 0.7;
    if (d < 1) { Rm.ground[ix(Rm, x, y)] = GRASS; Rm.wild[ix(Rm, x, y)] = d > 0.45 && R() < 0.55 ? 1 + (R() < 0.3 ? 1 : 0) : 0; }
  }
  // cloud paths along a spanning tree of the islands
  const joined = [0];
  while (joined.length < isl.length) {
    let bi = -1, bj = -1, bd = Infinity;
    for (const i of joined) for (let j = 0; j < isl.length; j++) if (!joined.includes(j)) { const d = Math.hypot(isl[i].x - isl[j].x, isl[i].y - isl[j].y); if (d < bd) { bd = d; bi = i; bj = j; } }
    joined.push(bj);
    let x = Math.round(isl[bi].x), y = Math.round(isl[bi].y);
    const tx = Math.round(isl[bj].x), ty = Math.round(isl[bj].y);
    while (x !== tx || y !== ty) {
      if (x !== tx && (y === ty || R() < 0.5)) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      if (Rm.ground[ix(Rm, x, y)] === VOID) Rm.ground[ix(Rm, x, y)] = BRIDGE;
    }
  }
  const home = isl[0], hx = Math.round(home.x), hy = Math.round(home.y);
  Rm.ground[ix(Rm, hx, hy)] = PORTAL;
  for (let yy = hy - 2; yy <= hy + 2; yy++) for (let xx = hx - 2; xx <= hx + 2; xx++) Rm.wild[ix(Rm, xx, yy)] = 0;
  Rm.portals.push({ x: hx, y: hy, to: 'surface', tx: 0, ty: 0, kind: 'down' });
  const ok = (x, y) => inside(Rm, x, y) && Rm.ground[ix(Rm, x, y)] === GRASS && Math.hypot(x - hx, y - hy) > 5;
  placeRuins(Rm, R, RUINS.sky, ok, 8, 40, hx, hy);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Rm.ground[ix(Rm, x, y)] === GRASS && R() < 0.05 && Math.hypot(x - hx, y - hy) > 2 && !Rm.ruins.some((u) => x >= u.x - 1 && x <= u.x + u.w && y >= u.y - 1 && y <= u.y + u.h)) natural(Rm, R() < 0.6 ? 'skyorchid' : 'daisy', x, y);
  for (const [k, n] of [['cloudsheep', 4], ['swallow', 4], ['dragonfly', 3]]) for (let i = 0; i < n; i++) { const o = isl[1 + Math.floor(R() * (isl.length - 1))] || home; critter(G, Rm, k, Math.round(o.x), Math.round(o.y)); }
  Rm.hero = { x: hx * T + 8, y: (hy + 1) * T + 12 };
  return Rm;
}

function newGarden(avoid) {
  const seed = (Math.random() * 2 ** 31) | 0, R = mulberry32(seed), t = now();
  const G = { v: 2, seed, created: t, saved: t, realm: 'surface', nextId: 1, R: {},
    inv: { seeds: { daisy: 6, tulip: 4, lavender: 3, sunflower: 2, cosmos: 3, berrybush: 2, apple: 1, birch: 1 }, food: 4, pick: 'daisy' }, log: [], firstVisit: 1 };
  const S = genSurface(G, R, avoid);
  const { Rm: C } = genCave(G, R, S.mouths);
  S.mouths.forEach((m, i) => S.portals.push({ x: m.x, y: m.y, to: 'cave', tx: C.portals[i].x, ty: C.portals[i].y, kind: 'mouth' }));
  delete S.mouths;
  const K = genSky(G, R);
  const stair = S.ruins.find((r) => r.t === 'cloudstair');
  if (stair) { S.portals.push({ x: stair.x, y: stair.y + 1, to: 'sky', tx: K.portals[0].x, ty: K.portals[0].y, kind: 'stair', ruin: 1 }); K.portals[0].tx = stair.x; K.portals[0].ty = stair.y + 2; }
  G.R = { surface: S, cave: C, sky: K };
  return G;
}

// the first garden (one 72×72 meadow) moves into the middle of the new meadows, as it was
function migrate(o) {
  const O = 28, inOld = (x, y) => x >= O - 2 && y >= O - 2 && x < O + 74 && y < O + 74;
  const G = newGarden(inOld), S = G.R.surface, ow = Uint8Array.from(o.wild, (ch) => +ch), og = Uint8Array.from(o.ground, (ch) => +ch);
  for (let y = 0; y < 72; y++) for (let x = 0; x < 72; x++) { const i = ix(S, x + O, y + O); S.wild[i] = ow[y * 72 + x]; S.ground[i] = og[y * 72 + x] === 1 ? GRASS : og[y * 72 + x]; S.seen[i] = S.wild[i] ? 0 : 1; }
  S.plants = S.plants.filter((p) => !inOld(p.x, p.y)).concat(o.plants.map((p) => ({ ...p, x: p.x + O, y: p.y + O })));
  S.animals = S.animals.filter((a) => !inOld(Math.floor(a.x / T), Math.floor(a.y / T))).concat(o.animals.map((a) => ({ ...a, x: a.x + O * T, y: a.y + O * T })));
  const keep = S.ruins.filter((r) => r.t === 'cloudstair');
  S.ruins = keep.concat(o.ruins.map((r) => ({ ...r, x: r.x + O, y: r.y + O, solid: !['glyphs', 'stones'].includes(r.t) ? 1 : 0 })));
  S.hero = { x: o.hero.x + O * T, y: o.hero.y + O * T };
  Object.assign(G, { seed: o.seed, created: o.created, saved: o.saved, nextId: Math.max(G.nextId, o.nextId || 0) + 1, inv: o.inv, log: o.log || [], firstVisit: 0 });
  G.migrated = 1;
  return G;
}

// ------------------------------------------------ saving
const packR = (Rm) => ({ ...Rm, tone: undefined, cv: undefined, mini: undefined, wild: Array.from(Rm.wild).join(','), ground: Array.from(Rm.ground).join(','), seen: Array.from(Rm.seen).join('') });
const unpackR = (o) => ({ ...o, wild: Uint8Array.from(o.wild.split(','), Number), ground: Uint8Array.from(o.ground.split(','), Number), seen: Uint8Array.from(o.seen, (ch) => +ch) });
export let G = null;
let loading = null, saveTimer = 0, dirty = false;
export async function loadGarden() {
  if (G) return G;
  loading ||= (async () => {
    let g = null;
    try { const o = await idbGet('kv', KEY); if (o?.v === 2) g = { ...o, R: Object.fromEntries(Object.entries(o.R).map(([k, v]) => [k, unpackR(v)])) }; } catch { /* a fresh one */ }
    if (!g) { try { const o = await idbGet('kv', OLD); if (o?.v === 1) g = migrate(o); } catch { /* a fresh one */ } }
    G = g || newGarden();
    G.away = catchUp(G);
    saveGarden(true);
    return G;
  })();
  return loading;
}
export function saveGarden(soon = false) {
  if (!G) return;
  clearTimeout(saveTimer);
  dirty = true;
  const go = () => { dirty = false; G.saved = now(); idbSet('kv', KEY, { ...G, away: undefined, R: Object.fromEntries(Object.entries(G.R).map(([k, v]) => [k, packR(v)])) }).catch(() => {}); };
  if (soon) saveTimer = setTimeout(go, 700); else go();
}
addEventListener('visibilitychange', () => { if (document.hidden && dirty) saveGarden(); });
addEventListener('pagehide', () => { if (dirty) saveGarden(); });

// ------------------------------------------------ growth, newcomers, time away
export function census(Rm) {
  const s = { plants: 0, bloom: 0, shrubs: 0, trees: 0, bigTrees: 0, water: 0, seen: 0, animals: Rm.animals.length };
  for (const p of Rm.plants) {
    if (p.n) continue;
    s.plants++;
    const P = PLANTS[p.k], st = stageOf(p);
    if (P.type === 'flower' && st === 3) s.bloom++;
    if (P.type === 'shrub' && st >= 2) s.shrubs++;
    if (P.type === 'tree' && st >= 2) s.trees++;
    if (P.type === 'tree' && st === 3) s.bigTrees++;
  }
  for (let i = 0; i < Rm.seen.length; i++) if (Rm.seen[i]) { s.seen++; if (Rm.ground[i] === WATER) s.water++; }
  return s;
}
export const countKind = (Rm, k) => Rm.animals.filter((a) => a.k === k).length;
export function walkable(Rm, x, y) { if (!inside(Rm, x, y)) return false; const i = ix(Rm, x, y), g = Rm.ground[i]; return !Rm.wild[i] && g !== WATER && g !== ROCK && g !== VOID; }
export function freeTile(Rm, x, y, r, water = false) {
  for (let i = 0; i < 50; i++) {
    const tx = Math.round(x + (Math.random() * 2 - 1) * r), ty = Math.round(y + (Math.random() * 2 - 1) * r);
    if (!inside(Rm, tx, ty) || tx < 1 || ty < 1 || tx >= Rm.w - 1 || ty >= Rm.h - 1) continue;
    const j = ix(Rm, tx, ty), g = Rm.ground[j];
    if (Rm.wild[j]) continue;
    if (water ? g !== WATER : (g === WATER || g === ROCK || g === VOID || g === PORTAL || g === BRIDGE)) continue;
    if (!water && Rm.plants.some((p) => p.x === tx && p.y === ty)) continue;
    if (Rm.ruins.some((u) => u.found && tx >= u.x && tx < u.x + u.w && ty >= u.y && ty < u.y + u.h)) continue;
    return [tx, ty];
  }
  return null;
}
export function addAnimal(Rm, k, x, y, baby = 0) {
  const a = { id: G.nextId++, k, x, y, b: now(), f: 0, baby };
  Rm.animals.push(a);
  return a;
}
const plural = (k) => (k === 'butterfly' ? 'butterflies' : k === 'fox' ? 'foxes' : k === 'cloudsheep' ? 'cloud sheep' : k === 'cavefish' ? 'cave fish' : `${k}s`);
export function arrivals(Rm, max = 2, near = null) {
  const s = census(Rm), out = [];
  for (const [k, A] of Object.entries(ANIMALS)) {
    if (A.realm !== Rm.name || !A.need(s)) continue;
    const have = countKind(Rm, k), room = Math.min(A.cap, have + 2) - have;
    if (room <= 0 || have >= A.cap) continue;
    let n = 0;
    for (let i = 0; i < Math.min(max, room); i++) {
      const c = near || { x: Rm.hero.x / T, y: Rm.hero.y / T };
      const pos = A.water ? freeTile(Rm, c.x, c.y, 14, true) : freeTile(Rm, c.x, c.y, 8);
      if (!pos) continue;
      addAnimal(Rm, k, pos[0] * T + 8, pos[1] * T + 8); n++;
    }
    if (n) out.push(n > 1 ? `A pair of ${plural(k)} came for ${A.why}` : `${k === 'owl' ? 'An' : 'A'} ${k === 'cloudsheep' ? 'cloud sheep' : k === 'cavefish' ? 'cave fish' : k} came for ${A.why}`);
  }
  return out;
}
function catchUpRealm(Rm, dtH, tally) {
  for (const p of Rm.plants) {
    const P = PLANTS[p.k], before = stageOf(p);
    p.g = Math.min(1, p.g + dtH / P.hours);
    if (!p.n && before < 3 && stageOf(p) === 3) tally.bloomed++;
    if (P.food && stageOf(p) === 3) { const f0 = p.fr; p.fr = Math.min(FRUIT_CAP[P.type] || 3, p.fr + Math.floor(dtH / 1.5)); if (p.fr > f0 && !p.n) tally.fruited++; }
  }
  if (Rm.plants.length < 4000) for (const p of Rm.plants.filter((q) => !q.n && PLANTS[q.k].type === 'flower' && stageOf(q) === 3)) {
    if (Math.random() > dtH / 10) continue;
    const t = freeTile(Rm, p.x, p.y, 2);
    if (t) { Rm.plants.push({ k: p.k, x: t[0], y: t[1], g: 0.05 + Math.random() * 0.3, w: 0, fr: 0, sd: 0 }); tally.sown++; }
  }
  for (const a of Rm.animals) if (a.baby && now() - a.b > 24 * HR) { a.baby = 0; tally.grew++; }
  for (const [k, A] of Object.entries(ANIMALS)) {
    if (A.realm !== Rm.name) continue;
    const adults = Rm.animals.filter((a) => a.k === k && !a.baby), fed = adults.filter((a) => a.f && (G?.saved || now()) - a.f < 24 * HR).length;
    if (adults.length < 2 || fed < 2 && A.eats) continue;
    let n = Math.min(A.cap - countKind(Rm, k), Math.floor(dtH / 8) + (dtH > 6 ? 1 : 0));
    while (n-- > 0) { const p = adults[Math.floor(Math.random() * adults.length)]; addAnimal(Rm, k, p.x + 6, p.y + 4, 1); tally.born++; }
  }
  if (Rm.visited) tally.arr.push(...arrivals(Rm, 2));
}
export function catchUp(g) {
  const dtH = Math.min(168, (now() - (g.saved || now())) / HR);
  if (dtH < 0.05) return [];
  const t = { bloomed: 0, sown: 0, fruited: 0, born: 0, grew: 0, arr: [] };
  for (const Rm of Object.values(g.R)) catchUpRealm(Rm, dtH, t);
  const msg = [];
  if (t.bloomed) msg.push(`${t.bloomed} ${t.bloomed > 1 ? 'plants' : 'plant'} grew up or bloomed`);
  if (t.sown) msg.push(`${t.sown} seedlings sprouted on their own`);
  if (t.fruited) msg.push('There is fruit to pick');
  if (t.born) msg.push(`${t.born} ${t.born > 1 ? 'babies were' : 'baby was'} born`);
  if (t.grew) msg.push(`${t.grew} of the young ones grew up`);
  msg.push(...t.arr);
  g.saved = now();
  return msg;
}

// ------------------------------------------------ painted map chunks (painted on demand, kept per realm and mode)
const chunks = new Map(), CHUNK_MAX = 54;
function tileRand(x, y, k = 0) { return mulberry32((x * 7919 + y * 104729 + k * 31337) | 0); }
function toneOf(Rm, i) { Rm.tone ||= noiseMap(mulberry32(Rm.seed ^ 77), Rm.w, 3, 4); return Rm.tone[i]; }
function paintGround(c, Rm, P, x, y, X, Y) {
  const i = ix(Rm, x, y), R = tileRand(x, y), g = Rm.ground[i], realm = Rm.name, at = (dx, dy) => (inside(Rm, x + dx, y + dy) ? Rm.ground[ix(Rm, x + dx, y + dy)] : realm === 'sky' ? VOID : ROCK);
  if (realm === 'sky') {
    if (g === VOID) {
      // the earthy underside of an island hangs below its edge
      if (at(0, -1) !== VOID && at(0, -1) !== BRIDGE) { c.fillStyle = P.under; c.fillRect(X, Y, T, 7 + (R() * 5 | 0)); c.fillStyle = P.under2; c.fillRect(X + 2, Y + 8, T - 4, 4 + (R() * 6 | 0)); c.fillRect(X + 6, Y + 12, 4, 3 + (R() * 3 | 0)); }
      return;
    }
    if (g === BRIDGE) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(X, Y, T, T); for (let k = 0; k < 3; k++) { c.fillStyle = P.cloud; c.beginPath(); c.ellipse(X + 3 + k * 5, Y + 7 + (k % 2) * 3, 5, 4, 0, 0, 7); c.fill(); } return; }
    c.fillStyle = mixHex(P.grass[1], P.grass[toneOf(Rm, i) > 0.5 ? 2 : 0], Math.abs(toneOf(Rm, i) - 0.5) * 1.6); c.fillRect(X, Y, T, T);
    for (let k = 0; k < 7; k++) { c.fillStyle = R() < 0.5 ? P.grass[0] : P.grass[2]; c.fillRect(X + (R() * 16 | 0), Y + (R() * 15 | 0), 1, 2); }
    if (R() < 0.25) { c.fillStyle = P.dot[Math.floor(R() * P.dot.length)]; c.fillRect(X + 2 + (R() * 12 | 0), Y + 2 + (R() * 12 | 0), 2, 2); }
    if (at(0, 1) === VOID) { c.fillStyle = P.under; c.fillRect(X, Y + T - 3, T, 3); }
    if (g === PORTAL) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(X + 8, Y + 9, 7, 4, 0, 0, 7); c.stroke(); c.beginPath(); c.ellipse(X + 8, Y + 9, 4, 2, 0, 0, 7); c.stroke(); }
    return;
  }
  if (realm === 'cave') {
    if (g === ROCK) {
      c.fillStyle = P.wall; c.fillRect(X, Y, T, T);
      if (at(0, 1) !== ROCK) { c.fillStyle = P.wall2; c.fillRect(X, Y + 6, T, 10); c.fillStyle = P.wall3; c.fillRect(X, Y + 6, T, 2); for (let k = 0; k < 3; k++) { c.fillStyle = P.wall; c.fillRect(X + (R() * 14 | 0), Y + 9, 1, 6); } }
      return;
    }
    if (g === WATER) { c.fillStyle = P.water; c.fillRect(X, Y, T, T); for (const [dx, dy] of near4) if (at(dx, dy) !== WATER) { c.fillStyle = P.water2; c.fillRect(X + (dx === 1 ? T - 2 : 0), Y + (dy === 1 ? T - 2 : 0), dx ? 2 : T, dy ? 2 : T); } return; }
    c.fillStyle = mixHex(P.floor[1], P.floor[toneOf(Rm, i) > 0.5 ? 2 : 0], Math.abs(toneOf(Rm, i) - 0.5) * 1.6); c.fillRect(X, Y, T, T);
    for (let k = 0; k < 4; k++) { c.fillStyle = R() < 0.5 ? P.floor[0] : P.floor[2]; c.fillRect(X + (R() * 15 | 0), Y + (R() * 15 | 0), 2, 1); }
    if (R() < 0.12) { c.fillStyle = P.moss; c.fillRect(X + (R() * 12 | 0), Y + (R() * 12 | 0), 3, 2); }
    if (g === BRIDGE) { c.fillStyle = P.water; c.fillRect(X, Y, T, T); c.fillStyle = P.plank; for (let k = 0; k < 4; k++) c.fillRect(X + 1, Y + 1 + k * 4, T - 2, 3); }
    if (g === PORTAL) { c.fillStyle = 'rgba(255,240,200,.25)'; c.beginPath(); c.ellipse(X + 8, Y + 8, 8, 6, 0, 0, 7); c.fill(); c.fillStyle = '#8a6a4a'; c.fillRect(X + 5, Y - 2, 1, 14); c.fillRect(X + 11, Y - 2, 1, 14); for (let k = 0; k < 4; k++) c.fillRect(X + 5, Y + k * 3, 7, 1); }
    return;
  }
  // the meadows
  if (g === WATER || g === BRIDGE) {
    c.fillStyle = P.water; c.fillRect(X, Y, T, T);
    for (const [dx, dy] of near4) { const n = at(dx, dy); if (n === WATER || n === BRIDGE) continue; c.fillStyle = P.water2; c.fillRect(X + (dx === 1 ? T - 3 : 0), Y + (dy === 1 ? T - 3 : 0), dx ? 3 : T, dy ? 3 : T); }
    if (g === WATER && R() < 0.05) { c.fillStyle = '#6aa860'; c.beginPath(); c.arc(X + 4 + R() * 8, Y + 4 + R() * 8, 2.5, 0.4, Math.PI * 2); c.fill(); }
    if (g === BRIDGE) { c.fillStyle = tone(P.plank, -0.3); c.fillRect(X, Y + 1, T, 14); c.fillStyle = P.plank; for (let k = 0; k < 4; k++) c.fillRect(X + k * 4, Y + 1, 3, 13); }
    return;
  }
  if (g === ROCK || g === PORTAL) {
    // rocky highland: tone drift, boulders lit from the top left, cracks
    const n = toneOf(Rm, i);
    c.fillStyle = mixHex(P.rock, n > 0.5 ? P.rock3 : P.rock2, Math.abs(n - 0.5) * 0.9); c.fillRect(X, Y, T, T);
    for (let k = 0; k < 2; k++) {
      const bx = X + 3 + R() * 10, by = Y + 3 + R() * 9, r = 2 + R() * 3;
      c.fillStyle = P.rock2; c.beginPath(); c.ellipse(bx, by + 1, r, r * 0.75, 0, 0, 7); c.fill();
      c.fillStyle = P.rock3; c.beginPath(); c.ellipse(bx - 0.6, by - 0.4, r * 0.7, r * 0.5, 0, 0, 7); c.fill();
    }
    c.fillStyle = tone(P.rock2, -0.15); c.fillRect(X + (R() * 12 | 0), Y + (R() * 12 | 0), 3, 1);
    if (R() < 0.12) { c.fillStyle = P.moss; c.fillRect(X + (R() * 12 | 0), Y + (R() * 12 | 0), 3, 2); }
    const s = at(0, 1);
    if (s !== ROCK && s !== PORTAL) { c.fillStyle = P.rock2; c.fillRect(X, Y + 8, T, 8); for (let k = 0; k < 3; k++) { c.fillStyle = tone(P.rock2, -0.2); c.fillRect(X + (R() * 14 | 0), Y + 9, 1, 6); } }
    if (g === PORTAL) {
      // a cave mouth: a dark arch framed in lighter stone, a little moss and a vine
      c.fillStyle = P.rock3; c.beginPath(); c.ellipse(X + 8, Y + 16, 9, 13, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#120e14'; c.beginPath(); c.ellipse(X + 8, Y + 16, 7, 11, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#2a2230'; c.beginPath(); c.ellipse(X + 8, Y + 16, 4, 7, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#6aa860'; c.fillRect(X + 1, Y + 3, 3, 2); c.fillRect(X + 12, Y + 5, 3, 2); c.fillRect(X + 13, Y + 6, 1, 6);
    }
    return;
  }
  const n = toneOf(Rm, i), base = g === FOREST ? P.forest : P.grass;
  c.fillStyle = g === SAND ? P.sand : g === PATH ? P.path : g === STONE ? P.stone : mixHex(base[1], base[n > 0.5 ? 2 : 0], Math.abs(n - 0.5) * 1.6);
  c.fillRect(X, Y, T, T);
  if (g === STONE) { c.fillStyle = P.stone2; c.fillRect(X, Y + T - 1, T, 1); c.fillRect(X + T - 1, Y, 1, T); if (R() < 0.5) { c.fillStyle = P.moss; c.fillRect(X + (R() * 10 | 0), Y + (R() * 10 | 0), 4, 2); } return; }
  if (g === GRASS || g === FOREST || g === FLOWERS) {
    for (let k = 0; k < 9; k++) { c.fillStyle = R() < 0.5 ? base[0] : base[2]; c.fillRect(X + (R() * 16 | 0), Y + (R() * 15 | 0), 1, 2); }
    if (g === FOREST) for (let k = 0; k < 3; k++) { c.fillStyle = R() < 0.5 ? '#b08a50' : '#8a6a3a'; c.fillRect(X + (R() * 15 | 0), Y + (R() * 15 | 0), 2, 1); }
    const nf = g === FLOWERS ? (R() < 0.75 ? 1 + (R() * 2 | 0) : 0) : R() < 0.22 ? 1 : 0;
    for (let k = 0; k < nf; k++) { const col = P.dot[Math.floor(R() * P.dot.length)], fx = X + 2 + (R() * 11 | 0), fy = Y + 2 + (R() * 11 | 0); c.fillStyle = col; c.fillRect(fx - 1, fy, 3, 1); c.fillRect(fx, fy - 1, 1, 3); c.fillStyle = '#f6d35b'; c.fillRect(fx, fy, 1, 1); }
    if (y > 0 && Rm.wild[ix(Rm, x, y - 1)]) { c.fillStyle = 'rgba(30,60,30,.16)'; c.fillRect(X, Y, T, 4); c.fillStyle = 'rgba(30,60,30,.08)'; c.fillRect(X, Y + 4, T, 3); }
  } else for (let k = 0; k < 5; k++) { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(X + (R() * 15 | 0), Y + (R() * 15 | 0), 2, 1); }
}
function paintWild(c, Rm, P, x, y, X, Y) {
  if (!inside(Rm, x, y)) return;
  const d = Rm.wild[ix(Rm, x, y)];
  if (!d) return;
  const R = tileRand(x, y, 3);
  if (Rm.name === 'cave') {
    // rubble and fallen stone
    for (let k = 0; k < 2 + d * 2; k++) { const cx = X + 2 + R() * 12, cy = Y + 3 + R() * 11, r = 2 + R() * (1.5 + d); c.fillStyle = P.rubble[2]; c.beginPath(); c.ellipse(cx, cy + 1, r, r * 0.8, 0, 0, 7); c.fill(); c.fillStyle = P.rubble[R() < 0.5 ? 0 : 1]; c.beginPath(); c.ellipse(cx - 0.5, cy, r - 0.6, r * 0.7, 0, 0, 7); c.fill(); }
    return;
  }
  if (Rm.name === 'sky') {
    // drifting mist
    // cloud banks: big soft puffs that run into their neighbours
    for (let k = 0; k < 2; k++) { c.fillStyle = k ? P.mist : 'rgba(255,255,255,.92)'; c.beginPath(); c.ellipse(X + 4 + R() * 8, Y + 5 + R() * 6, 7 + d * 1.5, 5 + d, 0, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(200,215,235,.35)'; c.beginPath(); c.ellipse(X + 8, Y + 13, 8 + d, 2.5, 0, 0, 7); c.fill();
    return;
  }
  const forest = Rm.ground[ix(Rm, x, y)] === FOREST, wild = forest ? [tone(P.wild[0], -0.12), tone(P.wild[1], -0.12), tone(P.wild[2], -0.14)] : P.wild;
  c.fillStyle = wild[Math.min(2, d)]; c.fillRect(X, Y, T, T);
  for (let k = 0; k < 2 + d; k++) {
    const cx = X + 3 + R() * 10, cy = Y + 4 + R() * 10, rx = 3.5 + d + R() * 2, ry = 3 + d * 0.6;
    c.fillStyle = wild[Math.min(2, d)]; c.beginPath(); c.ellipse(cx, cy + 1.5, rx, ry, 0, 0, 7); c.fill();
    c.fillStyle = wild[d - 1]; c.beginPath(); c.ellipse(cx, cy, rx - 0.5, ry - 0.5, 0, 0, 7); c.fill();
    c.fillStyle = P.blade; c.beginPath(); c.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.45, ry * 0.4, 0, 0, 7); c.fill();
  }
  if (R() < (forest ? 0.2 : 0.45)) { const col = P.dot[Math.floor(R() * P.dot.length)], fx = X + 2 + (R() * 12 | 0), fy = Y + (R() * 10 | 0); c.fillStyle = col; c.fillRect(fx - 1, fy, 3, 2); c.fillRect(fx, fy - 1, 1, 4); }
}
// the blades of grass standing on a tile: [x, y, height, shade] in tile pixels (drawn live, they bend)
export function bladesFor(Rm, x, y) {
  const i = ix(Rm, x, y), d = Rm.wild[i], g = Rm.ground[i];
  if (Rm.name === 'cave') return null;
  const tall = d > 0, grassy = g === 0 || g === FOREST || g === FLOWERS;
  if (!tall && !grassy) return null;
  const R = tileRand(x, y, 9), out = [];
  if (tall) {
    const n = Rm.name === 'sky' ? 0 : 3 + d * 2;
    for (let k = 0; k < n; k++) out.push([R() * T | 0, 6 + (R() * 10 | 0), 5 + d * 2 + (R() * 4 | 0), R() < 0.6 ? 1 : 0]);
    return out;
  }
  // short meadow grass grows in little clumps: most tiles have one, a few have two, some are bare
  const clumps = R() < 0.25 ? 0 : R() < 0.7 ? 1 : 2;
  for (let c = 0; c < clumps; c++) {
    const cx = 2 + (R() * 11 | 0), cy = 5 + (R() * 10 | 0), n = 3 + (R() * 3 | 0);
    for (let k = 0; k < n; k++) { const mid = 1 - Math.abs(k - (n - 1) / 2) / n; out.push([cx + k - (n >> 1), cy + (R() < 0.3 ? 1 : 0), 2 + Math.round(mid * 3 + R() * 1.5), k % 2]); }
  }
  return out;
}
export function chunk(Rm, mode, cx, cy) {
  const key = `${Rm.name}|${Rm.name === 'cave' ? '' : mode}|${cx},${cy}`, ver = (Rm.cv ||= new Map()).get(`${cx},${cy}`) || 0;
  let k = chunks.get(key);
  if (k && k.ver === ver) { chunks.delete(key); chunks.set(key, k); return k; }
  if (!k) { const [gc, g] = mk(CH * T, CH * T), [wc, w] = mk(CH * T, CH * T); k = { gc, g, wc, w }; }
  const P = palFor(Rm.name, mode), X0 = cx * CH, Y0 = cy * CH;
  k.g.clearRect(0, 0, CH * T, CH * T); k.w.clearRect(0, 0, CH * T, CH * T);
  for (let y = Y0; y < Y0 + CH; y++) for (let x = X0; x < X0 + CH; x++) if (inside(Rm, x, y)) paintGround(k.g, Rm, P, x, y, (x - X0) * T, (y - Y0) * T);
  // tall grass leans into the row above and over its sides, so paint a ring of neighbours too
  for (let y = Y0; y <= Y0 + CH; y++) for (let x = X0 - 1; x <= X0 + CH; x++) paintWild(k.w, Rm, P, x, y, (x - X0) * T, (y - Y0) * T);
  k.ver = ver;
  chunks.delete(key); chunks.set(key, k);
  while (chunks.size > CHUNK_MAX) chunks.delete(chunks.keys().next().value);
  return k;
}
// tiles changed: their chunks (and the neighbours that overlap them) repaint next time they are drawn
export function invalidate(Rm, x0, y0, x1, y1) {
  const cv = (Rm.cv ||= new Map());
  for (let cy = Math.floor((y0 - 2) / CH); cy <= Math.floor((y1 + 2) / CH); cy++) for (let cx = Math.floor((x0 - 2) / CH); cx <= Math.floor((x1 + 2) / CH); cx++) cv.set(`${cx},${cy}`, (cv.get(`${cx},${cy}`) || 0) + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) miniPaint(Rm, x, y);
}

// ------------------------------------------------ minimap (explored tiles only)
export function minimap(Rm) {
  if (Rm.mini) return Rm.mini;
  const [cv, c] = mk(Rm.w, Rm.h);
  Rm.mini = { cv, c };
  c.fillStyle = Rm.name === 'cave' ? '#100c14' : Rm.name === 'sky' ? '#9cc8ec' : '#2a3a2c';
  c.fillRect(0, 0, Rm.w, Rm.h);
  for (let y = 0; y < Rm.h; y++) for (let x = 0; x < Rm.w; x++) if (Rm.seen[ix(Rm, x, y)]) miniPaint(Rm, x, y);
  return Rm.mini;
}
const MINI = { [GRASS]: '#8fcf7a', [WATER]: '#5aa8e0', [PATH]: '#d8c098', [SAND]: '#e8d6a6', [STONE]: '#c8c0b8', [BRIDGE]: '#c09060', [ROCK]: '#8a8690', [PORTAL]: '#20181c', [FOREST]: '#5a9a58', [FLOWERS]: '#c8d890', [VOID]: '#b8d8f4' };
export function miniPaint(Rm, x, y) {
  if (!Rm.mini || !inside(Rm, x, y)) return;
  const i = ix(Rm, x, y), g = Rm.ground[i], c = Rm.mini.c;
  if (!Rm.seen[i]) return;
  c.fillStyle = Rm.name === 'cave' ? (g === ROCK ? '#3a3044' : g === WATER ? '#2d5680' : g === PORTAL ? '#ffe8a8' : Rm.wild[i] ? '#7a6e80' : '#a898b0') : g === PORTAL ? (Rm.name === 'sky' ? '#ffffff' : '#20181c') : Rm.wild[i] ? (Rm.name === 'sky' ? '#f4f8ff' : '#4f8a4c') : Rm.name === 'sky' && g === GRASS ? '#a8e090' : MINI[g] || '#888';
  c.fillRect(x, y, 1, 1);
}
