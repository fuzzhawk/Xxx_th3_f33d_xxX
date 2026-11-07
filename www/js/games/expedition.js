// Expeditions: every post is one mission to a different place with one clear goal
// (rescue someone, recover a relic, light the beacons…) in 2–4 plain steps tracked on
// screen. Top-down ¾ view with Crystal Sprite people and spirit creatures. Tap to walk,
// tap people and things to interact. Plays itself and sets off on a new expedition
// after each mission.
import { Game, W, H, drawFit, ready, roundRect, noiseMap, rgbOf } from './engine.js';
import { Actor, S as CS, dirOf } from '../crystal/sprites.js';
import { mulberry32 } from '../util.js';

const T = 24, RW = 11, RH = 9, MW = RW * 3, MH = RH * 3, WH = 14;
const VOID = 0, FLOOR = 1, WALL = 2, BRIDGE = 3, RUG = 4;
const D4 = ['S', 'W', 'N', 'E'];
const walkT = (v) => v === FLOOR || v === BRIDGE || v === RUG;
const mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const hx = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const rgb = (a, f = 1, al = 1) => `rgba(${a.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))).join(',')},${al})`;
const sh = (s, f = 1, al = 1) => rgb(hx(s), f, al);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const px = (tx) => tx * T + T / 2, py = (ty) => ty * T + T / 2 + 5;
const mod = (a, n) => ((a % n) + n) % n;
const ICON = { wave: '♪', cheer: '★', love: '♥', laugh: '♪', surprise: '!', think: '?', sad: '…', angry: '!', nod: '♪', shake: '?' };
const BOOKS = ['#8a2b2b', '#2b4a8a', '#2b7a4a', '#b08a2b', '#6a2b7a', '#c45a2b', '#d8cfb0'];
const NAMES = ['Pip', 'Mara', 'Tobin', 'Odile', 'Bram', 'Juniper', 'Ezra', 'Wren', 'Hazel', 'Otto', 'Nell', 'Rook', 'Ivo', 'Saffi', 'Moss', 'Quill', 'Fen', 'Lark', 'Basil', 'Clem', 'Dot', 'Arlo', 'Bea', 'Cosmo'];
const TREATS = ['honey cake', 'pickled egg', 'warm bun', 'jar of jam', 'fish pie', 'sugar plum'];
const LOOT = ['pocket watch', 'lucky hat', 'golden spoon', 'music box', 'silver bell', 'best teapot'];
const MISSIONS = ['rescue', 'relic', 'beacons', 'deliver', 'escort', 'map', 'thief', 'repair'];

// Places: look (floor, walls, void below, light, weather), props and the words the missions use.
const PLACES = [
  { id: 'manor', names: ['Hollowmere Manor', 'Gloamwood Hall', 'Ravensbury House'], ring: 1, inner: 0.3, void: 'dark', vc: ['#07060b', '#16111f'],
    fl: ['#4e3324', '#6e4a31'], pat: 'planks', rug: ['#5a1c2a', '#8a3040'], rugPat: 'carpet', wl: ['#2a2032', '#5b4363'], ws: 'paper', cliff: '#1a1420',
    dark: 0.74, dc: '10,6,20', tint: 'rgba(110,70,190,.10)', fx: 'wisp', lamp: 'candelabra', lc: '255,190,110', hz: 'spikes', stone: '#9a958c',
    tall: ['shelf', 'clock', 'armchair', 'plant', 'statue', 'shelf'], deco: ['books', 'bones', 'crack', 'leaf'], leaf: '#3f5a3a', burn: 'web',
    N: { gate: 'cellar door', key: 'cellar key', beacon: 'candelabra', brazier: 'hearth', part: 'floorboard', bridge: 'broken landing', shrine: 'ancestor shrine', bar: 'cobwebs', lm: ['grand stair', 'portrait gallery', 'bell tower'], relic: 'the Moon Locket', verb: 'catalogue the attic of', who: 'archivist' } },
  { id: 'swamp', names: ['Mirefen Mangroves', 'Bogwater Hollow', 'the Croaking Fens'], void: 'water', vc: ['#14302a', '#6fa58a'],
    fl: ['#3d5a2a', '#5c7a33'], pat: 'grass', rug: ['#6b5232', '#86683f'], rugPat: 'planks', wl: ['#30402a', '#4a5e36'], ws: 'hedge', cliff: '#3a2c1c',
    dark: 0.42, dc: '8,22,24', tint: 'rgba(60,140,90,.10)', fx: 'firefly', lamp: 'lantern', lc: '255,220,140', hz: 'steam', hc: '190,255,170',
    tall: ['mangrove', 'mangrove', 'mushroom', 'bush', 'rock', 'mangrove'], deco: ['tuft', 'tuft', 'flower', 'lily', 'leaf'], leaf: '#2f5a2c', burn: 'vines',
    N: { gate: 'boathouse gate', key: 'boathouse key', beacon: 'marsh lantern', brazier: 'campfire', part: 'plank', bridge: 'boardwalk', shrine: 'frog shrine', bar: 'thorny vines', lm: ['heron rock', 'sunken boat', 'old willow'], relic: 'the Frog King’s Crown', verb: 'map the reeds of', who: 'cartographer' } },
  { id: 'desert', names: ['the Ruins of Qasr Amun', 'the Dune Temple', 'the Glass Desert Ruins'], inner: 0.8, void: 'chasm', vc: ['#2a140c', '#6a3a1e'],
    fl: ['#d9b16c', '#e8c98a'], pat: 'sand', rug: ['#b98a55', '#d6ad72'], rugPat: 'flag', wl: ['#a8764a', '#c8955f'], ws: 'sandstone', cliff: '#a0643a',
    dark: 0, dc: '0,0,0', tint: 'rgba(255,170,80,.07)', fx: 'dust', sun: 1, lamp: 'brazier', lc: '255,200,120', hz: 'spikes', stone: '#cdb48a',
    tall: ['pillar', 'broken', 'obelisk', 'palm', 'cactus', 'statue', 'pot'], deco: ['pebble', 'bones', 'crack', 'tuft'], leaf: '#5b8a3a', burn: 'vines', no: ['beacons'],
    N: { gate: 'temple door', key: 'scarab key', beacon: 'brazier', brazier: 'fire bowl', part: 'plank', bridge: 'rope bridge', shrine: 'sun shrine', bar: 'thornbush', lm: ['sphinx head', 'old well', 'sun dial'], relic: 'the Sun Disc', verb: 'dig in', who: 'archaeologist' } },
  { id: 'monastery', names: ['the Monastery of Nine Bells', 'Frostpeak Hermitage', 'the Cloud Temple'], inner: 0.5, void: 'sky', vc: ['#4d6481', '#c9d6e6'],
    fl: ['#dfe7f0', '#f5f8fc'], pat: 'snow', rug: ['#7d7a78', '#a19e9a'], rugPat: 'flag', wl: ['#6d6f7a', '#8b8d99'], ws: 'stone', cliff: '#4f5664',
    dark: 0.32, dc: '12,16,40', tint: 'rgba(120,150,255,.08)', fx: 'snow', lamp: 'stonelantern', lc: '255,180,100', hz: 'spikes', stone: '#9a958c', rock: '#7d7f88',
    tall: ['pine', 'pine', 'bell', 'rock', 'statue', 'pine'], deco: ['pebble', 'tuft', 'drift'], leaf: '#2f5a4a', burn: 'ice',
    N: { gate: 'bell-tower gate', key: 'iron key', beacon: 'prayer brazier', brazier: 'temple hearth', part: 'plank', bridge: 'rope bridge', shrine: 'mountain shrine', bar: 'ice wall', lm: ['prayer wheel', 'frozen falls', 'summit cairn'], relic: 'the Bell of Nine Tones', verb: 'ring the bells of', who: 'bell-ringer' } },
  { id: 'library', names: ['the Drowned Athenaeum', 'the Sunken Library', 'the Tidebound Archive'], inner: 0.8, void: 'water', vc: ['#0b2238', '#5fb0d0'],
    fl: ['#8a8578', '#b9b2a0'], pat: 'checker', rug: ['#3b2a5a', '#5d4a8a'], rugPat: 'carpet', wl: ['#4a3324', '#6b4a33'], ws: 'shelf', cliff: '#3d4f5a',
    dark: 0.5, dc: '4,14,30', tint: 'rgba(60,160,220,.12)', fx: 'bubble', lamp: 'jelly', lc: '120,230,255', hz: 'steam', hc: '200,240,255', stone: '#b9b2a0', caustic: 1,
    tall: ['shelf', 'shelf', 'statue', 'pillar', 'plant', 'books'], deco: ['books', 'puddle', 'crack', 'leaf'], leaf: '#2f6a5a', burn: 'vines',
    N: { gate: 'reading-room door', key: 'librarian’s key', beacon: 'lamp', brazier: 'glow-jar', part: 'plank', bridge: 'reading bridge', shrine: 'tide altar', bar: 'kelp tangle', lm: ['great globe', 'map table', 'star dome'], relic: 'the Drowned Codex', verb: 'rescue the books of', who: 'archivist' } },
  { id: 'tower', names: ['the Brass Orrery', 'the Clockwork Spire', 'Tick-Tock Tower'], inner: 0.7, void: 'gears', vc: ['#120c08', '#3a2614'],
    fl: ['#6b5a44', '#8a7556'], pat: 'metal', rug: ['#4a3e30', '#6e5c48'], rugPat: 'grate', wl: ['#6a4a2a', '#a07a3a'], ws: 'pipes', cliff: '#3a2a1a',
    dark: 0.45, dc: '20,10,4', tint: 'rgba(255,160,60,.08)', fx: 'steam', lamp: 'arclamp', lc: '255,200,120', hz: 'steam', hc: '255,255,255',
    tall: ['gear', 'boiler', 'crate', 'barrel', 'gear'], deco: ['bolt', 'crack', 'pebble'], leaf: '#4a5a3a', burn: 'web',
    N: { gate: 'brass hatch', key: 'winding key', beacon: 'arc lamp', brazier: 'furnace', part: 'cog', bridge: 'gear bridge', shrine: 'great clock', bar: 'old cobwebs', lm: ['pendulum', 'orrery', 'bell gear'], relic: 'the Mainspring Heart', verb: 'oil the gears of', who: 'tinker' } },
  { id: 'market', names: ['the Lantern Row Night Market', 'the Moon Bazaar', 'the Canal Night Market'], inner: 0.4, void: 'water', vc: ['#0a1020', '#4a6aa8'],
    fl: ['#5a5560', '#77707c'], pat: 'cobble', rug: ['#6a3a2a', '#844a34'], rugPat: 'brick', wl: ['#3a2a3a', '#5a3a4a'], ws: 'brick', cliff: '#2e2a33',
    dark: 0.6, dc: '6,6,22', tint: 'rgba(255,120,160,.08)', fx: 'spark', lamp: 'paper', lc: '255,160,90', hz: 'flame',
    tall: ['stall', 'stall', 'crate', 'barrel', 'cart', 'stall'], deco: ['pebble', 'leaf', 'crack'], leaf: '#3a6a3a', burn: 'vines',
    N: { gate: 'canal gate', key: 'gate token', beacon: 'paper lantern', brazier: 'noodle stove', part: 'plank', bridge: 'canal bridge', shrine: 'moon shrine', bar: 'tangled bunting', lm: ['clock stall', 'koi bridge', 'tea house'], relic: 'the Jade Lantern', verb: 'sell dumplings at', who: 'dumpling cook' } },
  { id: 'caves', names: ['the Emberdeep Caverns', 'the Cinder Mines', 'the Molten Hollows'], inner: 0.6, void: 'lava', vc: ['#5a0e04', '#ff7a1a'],
    fl: ['#3a2f2e', '#524240'], pat: 'basalt', rug: ['#5a4630', '#6e573a'], rugPat: 'planks', wl: ['#2a2222', '#463838'], ws: 'rock', cliff: '#231b1b',
    dark: 0.7, dc: '14,4,4', tint: 'rgba(255,90,30,.08)', fx: 'ember', lamp: 'crystal', lc: '190,140,255', hz: 'flame', rock: '#5a4a44',
    tall: ['stalagmite', 'crystal', 'rock', 'cart', 'stalagmite', 'mushroom'], deco: ['pebble', 'bones', 'crack'], leaf: '#5a3a6a', burn: 'web',
    N: { gate: 'mine door', key: 'miner’s key', beacon: 'signal brazier', brazier: 'forge', part: 'plank', bridge: 'mine bridge', shrine: 'ember shrine', bar: 'giant cobwebs', lm: ['crystal vein', 'old drill', 'magma falls'], relic: 'the Ember Crown', verb: 'dig for opals in', who: 'miner' } },
  { id: 'sky', names: ['the Floating Isles of Aerie', 'the Skyreach Islands', 'the Windward Isles'], inner: 0.3, void: 'sky', vc: ['#6fa8dc', '#e8f4ff'],
    fl: ['#5d9a3a', '#7fbf4a'], pat: 'grass', rug: ['#b49a6a', '#cbb27e'], rugPat: 'flag', wl: ['#6a7a5a', '#8a9a72'], ws: 'stone', cliff: '#7a5a3a',
    dark: 0, dc: '0,0,0', tint: 'rgba(255,240,200,.06)', fx: 'leaf', sun: 1, lamp: 'lantern', lc: '255,220,140', hz: 'steam', hc: '255,255,255', stone: '#b8b0a0',
    tall: ['tree', 'tree', 'windmill', 'rock', 'bush', 'statue'], deco: ['flower', 'flower', 'tuft', 'pebble'], leaf: '#3f8a3a', burn: 'vines', no: ['beacons'],
    N: { gate: 'wind gate', key: 'feather key', beacon: 'sky beacon', brazier: 'fire pot', part: 'plank', bridge: 'rope bridge', shrine: 'wind shrine', bar: 'thorny vines', lm: ['wind stone', 'eagle nest', 'cloud arch'], relic: 'the Wind Compass', verb: 'chase kites over', who: 'kite maker' } }
];

// ---------------------------------------------------------------- pixel helpers
const E = (x, cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, 7); x.fill(); };
const Rc = (x, a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
const Po = (x, pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); };
const blobs = (x, L, b, k = [0.5, 0.9, 1.3]) => { for (const [a, c, r] of b) E(x, a + 1, c + 2, r, r * 0.86, sh(L, k[0])); for (const [a, c, r] of b) E(x, a, c, r * 0.9, r * 0.8, sh(L, k[1])); for (const [a, c, r] of b) E(x, a - r * 0.3, c - r * 0.35, r * 0.45, r * 0.35, sh(L, k[2])); };

// tileable 96×96 floor patterns
function patTile(kind, c1, c2, R) {
  const n = 96, N = noiseMap(R, n, 4, 4), a = hx(c1), b = hx(c2), cv = mk(n, n), x = cv.getContext('2d'), im = x.createImageData(n, n), d = im.data;
  const cell = { flag: 16, cobble: 8, basalt: 24 }[kind] || 0, g = cell ? n / cell : 0, pts = Array.from({ length: g * g }, () => [R(), R()]);
  const hs = (k) => { const v = Math.sin(k * 91.7 + 13.1) * 43758.5; return v - Math.floor(v); };
  for (let y = 0; y < n; y++) for (let X = 0; X < n; X++) {
    const v = N[y * n + X]; let t = v, s = 1;
    if (cell) {
      const cx = Math.floor(X / cell), cy = Math.floor(y / cell); let d1 = 1e9, d2 = 1e9, id = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = (cx + i + g) % g, gy = (cy + j + g) % g, p = pts[gy * g + gx], dd = Math.hypot(X - (cx + i + p[0]) * cell, y - (cy + j + p[1]) * cell);
        if (dd < d1) { d2 = d1; d1 = dd; id = gy * g + gx; } else if (dd < d2) d2 = dd;
      }
      t = hs(id) * 0.75 + v * 0.25;
      s = d2 - d1 < 1.5 ? 0.6 : kind === 'cobble' ? 1.14 - (d1 / cell) * 0.5 : 0.95 + v * 0.12;
    } else switch (kind) {
      case 'grass': t = v * 1.5 - 0.25; s = hs(X * 7.1 + y * 131.3) < 0.07 ? 0.8 : hs(X * 3.7 + y * 71.9) < 0.03 ? 1.14 : 1; break;
      case 'sand': t = 0.5 + 0.5 * Math.sin((y + v * 16) * 0.55 + X * 0.05); s = 0.93 + v * 0.14; break;
      case 'snow': t = v * 1.3 - 0.15; s = hs(X * 5.3 + y * 977.1) < 0.012 ? 1.15 : 1; break;
      case 'planks': { const row = y >> 3, off = Math.floor(hs(row + 1) * 96), seg = Math.floor((X + off) / 48); t = hs(row * 7 + seg) * 0.7 + v * 0.3; s = y % 8 === 0 || (X + off) % 48 === 0 ? 0.6 : 0.92 + 0.08 * Math.sin(X * 0.5 + v * 12); break; }
      case 'checker': { const q = ((X / 12 | 0) + (y / 12 | 0)) % 2; t = q ? 0.9 : 0.1; s = X % 12 === 0 || y % 12 === 0 ? 0.72 : 0.96 + v * 0.1 - (Math.abs(Math.sin(v * 40)) < 0.06 ? 0.12 : 0); break; }
      case 'metal': { const ex = X % 24, ey = y % 24; t = v * 0.5 + hs((X / 24 | 0) + (y / 24 | 0) * 9) * 0.5; s = ex === 0 || ey === 0 ? 0.55 : ex === 23 || ey === 23 ? 1.18 : ((ex - 3) ** 2 + (ey - 3) ** 2 < 3 || (ex - 20) ** 2 + (ey - 20) ** 2 < 3) ? 1.3 : 0.95 + v * 0.1; break; }
      case 'carpet': { const ex = X % 24, ey = y % 24, dm = Math.abs(ex - 12) + Math.abs(ey - 12); t = dm < 5 ? 0.9 : dm === 9 || dm === 10 ? 1 : 0.1; s = 0.92 + v * 0.14; break; }
      case 'grate': { const ex = X % 6, ey = y % 6; s = ex < 2 || ey < 2 ? 1.05 : 0.45; break; }
      case 'brick': { const row = y >> 2, ex = (X + (row % 2) * 4) % 8; t = hs(row * 13 + ((X + (row % 2) * 4) >> 3)) * 0.8; s = y % 4 === 0 || ex === 0 ? 0.6 : 0.95 + v * 0.1; break; }
    }
    t = Math.max(0, Math.min(1, t));
    const k = (y * n + X) * 4;
    for (let c = 0; c < 3; c++) d[k + c] = (a[c] + (b[c] - a[c]) * t) * s;
    d[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return cv;
}
// 64×64 tileable layers for water ripples and lava
function layerCv(R, kind, col) {
  const n = 64, N = noiseMap(R, n, 3, 4), cv = mk(n, n), x = cv.getContext('2d'), im = x.createImageData(n, n), c = hx(col);
  for (let i = 0; i < n * n; i++) {
    const v = N[i];
    if (kind === 'lava') { const t = Math.max(0, Math.min(1, (v - 0.3) * 2.2)), hot = Math.abs(v - 0.55) < 0.035; im.data.set(hot ? [255, 226, 120, 255] : [90 + t * 165, 14 + t * 90, 4 + t * 10, 255], i * 4); }
    else { const a = Math.max(0, Math.min(1, (Math.abs(v - 0.5) < 0.03 ? 0.75 : 0) + (v - 0.66) * 2)); im.data.set([c[0], c[1], c[2], a * 255], i * 4); }
  }
  x.putImageData(im, 0, 0);
  return cv;
}
function gearCv(r, col) {
  const s = r * 2 + 8, cv = mk(s, s), x = cv.getContext('2d'), c = s / 2, n = Math.max(8, Math.round(r / 2.2));
  x.fillStyle = col; x.beginPath();
  for (let k = 0; k < n * 4; k++) { const a = (k / (n * 4)) * Math.PI * 2, rr = k % 4 < 2 ? r + 3 : r; x.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); }
  x.closePath(); x.fill();
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.arc(c, c, r * 0.72, 0, 7); x.fill();
  x.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; x.beginPath(); x.arc(c + Math.cos(a) * r * 0.45, c + Math.sin(a) * r * 0.45, r * 0.17, 0, 7); x.fill(); }
  x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(c, c, r * 0.18, 0, 7); x.fill();
  return cv;
}
function cloudCv(R, col = '255,255,255') {
  const cv = mk(96, 46), x = cv.getContext('2d');
  for (let k = 0; k < 10; k++) {
    const cx = 18 + R() * 60, cy = 22 + R() * 10 - (Math.abs(cx - 48) < 20 ? 6 : 0), r = 10 + R() * 10, g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${col},.9)`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  return cv;
}

// Props: [w, h, painter]. Painters draw into a small canvas (base at bottom centre) and may
// return extras: light, fade (see-through when behind), flames/orb/paper (glow pass), anims.
const PROPS = {
  tree: [34, 46, (x, R, P) => { Rc(x, 15, 28, 5, 16, '#3e2a1c'); Rc(x, 15, 28, 2, 16, '#5c3f2a'); blobs(x, P.leaf, [[17, 17, 11], [9, 21, 8], [25, 21, 8], [17, 9, 8], [10, 13, 6], [24, 13, 6]]); if (R() < 0.4) for (let k = 0; k < 4; k++) E(x, 8 + R() * 18, 10 + R() * 14, 1.3, 1.3, '#f0d24a'); return { fade: 1 }; }],
  pine: [26, 46, (x, R, P) => { Rc(x, 11, 36, 4, 9, '#3e2a1c'); for (let k = 0; k < 3; k++) { const y0 = 3 + k * 9, w = 6 + k * 4; Po(x, [[13, y0], [14 + w, y0 + 15], [12 - w, y0 + 15]], sh(P.leaf, 0.55)); Po(x, [[13, y0], [13 + w - 2, y0 + 13], [13 - w + 1, y0 + 13]], sh(P.leaf, 0.95)); if (P.id === 'monastery') Po(x, [[13, y0], [13 + w * 0.55, y0 + 7], [13 - w * 0.55, y0 + 7]], '#eef4fb'); } return { fade: 1 }; }],
  palm: [36, 48, (x, R, P) => { for (let k = 0; k < 10; k++) { const t = k / 9; E(x, 18 + Math.sin(t * 2.2) * 5 * (1 - t), 46 - t * 31, 2.6, 2.3, k % 2 ? '#7a5a36' : '#94703f'); } const tx = 21, ty = 15; for (let a = 0; a < 7; a++) { const g = -Math.PI / 2 + (a - 3) * 0.7; x.strokeStyle = sh(P.leaf, a % 2 ? 0.7 : 1.05); x.lineWidth = 3; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + Math.cos(g) * 10, ty + Math.sin(g) * 10 - 5, tx + Math.cos(g) * 16, ty + Math.sin(g) * 14 + 6); x.stroke(); } E(x, tx, ty + 2, 3, 2.5, '#5a3a1e'); return { fade: 1 }; }],
  mangrove: [38, 46, (x, R, P) => { x.strokeStyle = '#4a3624'; x.lineWidth = 2; for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(19 + k * 7, 45); x.quadraticCurveTo(19 + k * 4, 33, 19, 27); x.stroke(); } Rc(x, 17, 21, 4, 10, '#4a3624'); blobs(x, P.leaf, [[19, 14, 12], [9, 18, 8], [29, 18, 8], [14, 8, 7], [25, 8, 7]], [0.45, 0.8, 1.15]); x.strokeStyle = 'rgba(160,190,120,.6)'; x.lineWidth = 1; for (let k = 0; k < 6; k++) { const a = 6 + R() * 26; x.beginPath(); x.moveTo(a, 18); x.lineTo(a + 1, 26 + R() * 7); x.stroke(); } return { fade: 1 }; }],
  mushroom: [24, 28, (x, R) => { const c = R() < 0.5 ? '#7fe0c0' : '#e08ad0'; Rc(x, 10, 14, 5, 13, '#e8dcc4'); Rc(x, 13, 14, 2, 13, '#bfb39a'); x.fillStyle = sh(c, 0.6); x.beginPath(); x.ellipse(12, 15, 11, 9, 0, Math.PI, 0); x.fill(); x.fillStyle = c; x.beginPath(); x.ellipse(11, 14, 9, 7.5, 0, Math.PI, 0); x.fill(); for (let k = 0; k < 4; k++) E(x, 5 + R() * 13, 8 + R() * 4, 1.4, 1.1, 'rgba(255,255,255,.6)'); return { light: { r: 46, col: c === '#7fe0c0' ? '120,255,200' : '255,140,230' } }; }],
  rock: [24, 18, (x, R, P) => { const c = P.rock || '#7a7468'; E(x, 12, 11, 11, 7, sh(c, 0.55)); E(x, 11, 9.5, 10, 6.5, sh(c, 0.85)); E(x, 9, 7.5, 6, 3.5, sh(c, 1.15)); x.strokeStyle = sh(c, 0.5); x.beginPath(); x.moveTo(14, 5); x.lineTo(16, 10); x.lineTo(15, 14); x.stroke(); if (P.id === 'monastery') E(x, 11, 5.5, 7, 2.5, '#f2f6fb'); }],
  crystal: [20, 26, (x) => { const c = '#a07bff'; for (const [a, b, w] of [[10, 2, 4], [5, 9, 3], [15, 8, 3]]) { Po(x, [[a, b], [a + w, b + 5], [a + w, 24], [a - w, 24], [a - w, b + 5]], sh(c, 0.6)); Po(x, [[a, b], [a + w * 0.2, b + 5], [a + w * 0.2, 24], [a - w, 24], [a - w, b + 5]], sh(c, 1.1)); Rc(x, a - w + 1, b + 6, 1, 14, 'rgba(255,255,255,.4)'); } return { light: { r: 64, col: '170,130,255' }, orb: [10, 12, '#c8b0ff', 0.5] }; }],
  stalagmite: [16, 30, (x) => { const c = '#5a4a44'; Po(x, [[8, 1], [14, 28], [2, 28]], sh(c, 0.6)); Po(x, [[8, 1], [10, 28], [2, 28]], c); Po(x, [[7, 4], [6, 28], [4, 28]], sh(c, 1.3)); }],
  pillar: [18, 44, (x, R, P) => { const c = P.stone || '#cdb48a'; Rc(x, 1, 36, 16, 6, sh(c, 0.7)); Rc(x, 3, 6, 12, 31, sh(c, 0.85)); for (let k = 0; k < 4; k++) Rc(x, 4 + k * 3, 6, 1, 31, sh(c, k % 2 ? 1.1 : 0.7)); Rc(x, 1, 2, 16, 5, c); Rc(x, 1, 2, 16, 1, sh(c, 1.2)); }],
  broken: [20, 34, (x, R, P) => { const c = P.stone || '#cdb48a'; Rc(x, 2, 26, 16, 6, sh(c, 0.7)); Po(x, [[4, 27], [4, 10], [7, 7], [10, 11], [13, 5], [15, 9], [15, 27]], sh(c, 0.85)); for (let k = 0; k < 3; k++) Rc(x, 6 + k * 3, 12, 1, 15, sh(c, 0.7)); E(x, 17, 30, 3, 2, sh(c, 0.8)); }],
  obelisk: [16, 48, (x, R, P) => { const c = P.stone || '#cdb48a'; Po(x, [[8, 1], [12, 7], [11, 44], [5, 44], [4, 7]], sh(c, 0.75)); Po(x, [[8, 1], [8, 7], [8, 44], [5, 44], [4, 7]], c); for (let k = 0; k < 6; k++) Rc(x, 6, 10 + k * 5, 4, 1, sh(c, 0.5)); Rc(x, 2, 43, 12, 4, sh(c, 0.6)); }],
  statue: [22, 44, (x, R, P) => { const c = P.stone || '#9a958c'; Rc(x, 2, 32, 18, 11, sh(c, 0.7)); Rc(x, 2, 32, 18, 2, sh(c, 1.1)); Rc(x, 4, 35, 14, 1, sh(c, 0.5)); return { art: 1 }; }],
  shelf: [26, 36, (x, R) => { Rc(x, 1, 1, 24, 34, '#3b2618'); Rc(x, 3, 3, 20, 30, '#24160d'); for (let s = 0; s < 3; s++) { let a = 3; while (a < 22) { const w = 2 + (R() * 2 | 0), hh = 6 + (R() * 3 | 0); Rc(x, a, 3 + s * 10 + (9 - hh), Math.min(w, 23 - a), hh, BOOKS[R() * BOOKS.length | 0]); a += w + (R() < 0.15 ? 1 : 0); } Rc(x, 2, 12 + s * 10, 22, 2, '#5a3a22'); } Rc(x, 1, 1, 24, 2, '#6b4a2e'); }],
  clock: [14, 40, (x) => { Rc(x, 1, 3, 12, 36, '#3a2414'); Rc(x, 2, 4, 10, 34, '#5a3820'); E(x, 7, 10, 4.5, 4.5, '#e8dcb8'); Rc(x, 4, 17, 6, 16, '#1e120a'); Rc(x, 0, 2, 14, 3, '#6b4a2e'); x.strokeStyle = '#222'; x.beginPath(); x.moveTo(7, 10); x.lineTo(7, 7); x.moveTo(7, 10); x.lineTo(9, 11); x.stroke(); return { pend: [7, 18] }; }],
  armchair: [20, 20, (x, R) => { const c = ['#6a2a3a', '#2a5a4a', '#5a4a2a'][R() * 3 | 0]; Rc(x, 2, 2, 16, 10, sh(c, 0.8)); Rc(x, 0, 8, 20, 9, sh(c, 0.7)); Rc(x, 3, 9, 14, 6, c); Rc(x, 3, 3, 14, 2, sh(c, 1.3)); Rc(x, 1, 17, 2, 3, '#2a1a10'); Rc(x, 17, 17, 2, 3, '#2a1a10'); }],
  plant: [16, 24, (x, R, P) => { Po(x, [[3, 15], [13, 15], [11, 23], [5, 23]], '#9a5a3a'); Rc(x, 3, 15, 10, 2, '#b8704a'); for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.45; x.strokeStyle = sh(P.leaf, 0.8 + (k % 2) * 0.4); x.lineWidth = 2.5; x.beginPath(); x.moveTo(8, 15); x.quadraticCurveTo(8 + Math.cos(a) * 5, 15 + Math.sin(a) * 9, 8 + Math.cos(a) * 8, 15 + Math.sin(a) * 12 + 3); x.stroke(); } }],
  crate: [18, 18, (x) => { Rc(x, 1, 3, 16, 14, '#6e4a2a'); Rc(x, 1, 1, 16, 4, '#8a6236'); Rc(x, 2, 6, 14, 1, '#4e321c'); Rc(x, 2, 11, 14, 1, '#4e321c'); x.strokeStyle = '#4e321c'; x.beginPath(); x.moveTo(2, 6); x.lineTo(16, 16); x.stroke(); }],
  barrel: [14, 18, (x) => { Rc(x, 1, 4, 12, 13, '#7a4e2a'); Rc(x, 1, 4, 3, 13, '#5a3a1e'); Rc(x, 1, 7, 12, 1, '#3a3a3a'); Rc(x, 1, 13, 12, 1, '#3a3a3a'); E(x, 7, 4, 6, 2.5, '#9a6a3a'); E(x, 7, 4, 4.5, 1.6, '#6a4422'); }],
  pot: [12, 14, (x) => { E(x, 6, 8, 5.5, 5.5, '#a8603a'); E(x, 5, 7, 3.5, 3.5, '#c47a4a'); Rc(x, 3, 1, 6, 3, '#8a4a2a'); Rc(x, 2, 1, 8, 1, '#c47a4a'); }],
  books: [16, 14, (x, R) => { for (let k = 0; k < 4; k++) Rc(x, 1 + R() * 3, 10 - k * 3, 12, 3, BOOKS[R() * BOOKS.length | 0]); }],
  candelabra: [14, 28, (x) => { Rc(x, 6, 8, 2, 18, '#b08a3a'); Rc(x, 3, 25, 8, 2, '#8a6a2a'); Rc(x, 1, 8, 12, 2, '#b08a3a'); for (const a of [1, 6, 11]) Rc(x, a, 4, 2, 4, '#efe6cc'); return { light: { r: 66 }, flames: [[2, 3], [7, 3], [12, 3]] }; }],
  lantern: [14, 34, (x) => { Rc(x, 6, 6, 2, 27, '#3a2a1c'); Rc(x, 6, 5, 7, 2, '#3a2a1c'); Rc(x, 9, 8, 5, 7, '#2a2016'); Rc(x, 10, 9, 3, 5, '#ffd27a'); return { light: { r: 72 }, flames: [[11.5, 12, 0.7]] }; }],
  brazier: [16, 20, (x) => { x.strokeStyle = '#3a2a1c'; x.lineWidth = 2; x.beginPath(); x.moveTo(3, 19); x.lineTo(8, 9); x.lineTo(13, 19); x.stroke(); x.fillStyle = '#5a4a3a'; x.beginPath(); x.ellipse(8, 8, 7, 3.5, 0, 0, Math.PI); x.fill(); Rc(x, 1, 6, 14, 2, '#7a6a5a'); return { light: { r: 82 }, flames: [[8, 5, 1.8]] }; }],
  stonelantern: [14, 24, (x) => { Rc(x, 3, 19, 8, 4, '#7d7a78'); Rc(x, 5, 12, 4, 7, '#8b8885'); Rc(x, 2, 8, 10, 5, '#6d6a68'); Rc(x, 4, 9, 6, 3, '#ffcf80'); Po(x, [[7, 2], [13, 8], [1, 8]], '#5d5a58'); return { light: { r: 66 }, flames: [[7, 11, 0.7]] }; }],
  jelly: [12, 26, (x) => { Rc(x, 5, 8, 2, 17, '#3d4f5a'); Rc(x, 2, 23, 8, 2, '#2d3f4a'); return { light: { r: 72, col: '120,230,255' }, orb: [6, 6, '#8ff0ff', 1] }; }],
  arclamp: [12, 32, (x) => { Rc(x, 5, 6, 2, 25, '#4a4038'); Rc(x, 2, 29, 8, 2, '#3a3028'); Rc(x, 2, 2, 8, 5, '#6a5a40'); return { light: { r: 78, col: '255,210,140' }, orb: [6, 7, '#ffe6a0', 0.8] }; }],
  paper: [20, 36, (x) => { Rc(x, 9, 4, 2, 31, '#3a2a2a'); Rc(x, 2, 4, 16, 1, '#3a2a2a'); return { light: { r: 74, col: '255,150,100' }, paper: [[4, 9, '#ff6a4a'], [16, 9, '#ffb84a']] }; }],
  stall: [32, 34, (x, R, P, g) => { const a = rgb(rgbOf(g.col(R() * 6 | 0))), b = '#efe6d6'; Rc(x, 2, 12, 2, 21, '#4a3020'); Rc(x, 28, 12, 2, 21, '#4a3020'); Rc(x, 1, 22, 30, 11, '#6e4a2e'); Rc(x, 1, 22, 30, 2, '#8a6236'); for (let k = 0; k < 8; k++) { Rc(x, k * 4, 4, 4, 9, k % 2 ? a : b); E(x, k * 4 + 2, 13, 2, 1.6, k % 2 ? a : b); } Rc(x, 0, 3, 32, 2, 'rgba(0,0,0,.35)'); return { goods: 1 }; }],
  gear: [30, 34, (x) => { Rc(x, 13, 16, 4, 17, '#4a3a2a'); Rc(x, 7, 30, 16, 3, '#3a2a1a'); return { gear: [15, 14, 12] }; }],
  boiler: [22, 30, (x) => { Rc(x, 3, 6, 16, 22, '#8a5a2a'); Rc(x, 3, 6, 4, 22, '#6a4220'); Rc(x, 15, 6, 2, 22, '#b07a3a'); E(x, 11, 6, 8, 3, '#a06a32'); for (const yy of [10, 18, 25]) Rc(x, 3, yy, 16, 1, '#4a3018'); E(x, 11, 15, 3, 3, '#e8dcb8'); Rc(x, 17, 1, 3, 6, '#5a4a3a'); return { steam: [18, 1] }; }],
  tent: [36, 28, (x) => { const c = '#c8784a'; Po(x, [[18, 2], [35, 26], [1, 26]], sh(c, 0.7)); Po(x, [[18, 2], [24, 26], [1, 26]], c); Po(x, [[18, 9], [22, 26], [14, 26]], '#3a2414'); Rc(x, 17, 0, 2, 4, '#5a3a22'); }],
  campfire: [18, 12, (x) => { x.strokeStyle = '#5a3a22'; x.lineWidth = 3; x.beginPath(); x.moveTo(3, 10); x.lineTo(15, 5); x.moveTo(3, 5); x.lineTo(15, 10); x.stroke(); for (let k = 0; k < 7; k++) E(x, 9 + Math.cos(k) * 8, 8 + Math.sin(k) * 3, 2, 1.4, '#6a6460'); return { light: { r: 92 }, flames: [[9, 6, 1.8]] }; }],
  bush: [20, 16, (x, R, P) => { blobs(x, P.leaf, [[10, 9, 7], [5, 10, 5], [15, 10, 5]]); if (R() < 0.5) for (let k = 0; k < 3; k++) E(x, 4 + R() * 12, 6 + R() * 6, 1.2, 1.2, '#e05a6a'); }],
  cactus: [16, 26, (x) => { const c = '#4a8a4a'; Rc(x, 6, 4, 5, 21, c); Rc(x, 6, 4, 2, 21, '#6aaa5a'); Rc(x, 1, 10, 3, 8, c); Rc(x, 1, 16, 6, 3, c); Rc(x, 13, 7, 3, 7, c); Rc(x, 10, 12, 5, 3, c); E(x, 8.5, 4, 2.5, 2, '#6aaa5a'); }],
  windmill: [24, 44, (x) => { Po(x, [[8, 12], [16, 12], [19, 42], [5, 42]], '#d8cdb8'); Po(x, [[8, 12], [11, 12], [9, 42], [5, 42]], '#b8ad98'); Po(x, [[6, 12], [12, 4], [18, 12]], '#8a4a3a'); Rc(x, 10, 32, 4, 10, '#5a3a22'); return { mill: [12, 11] }; }],
  bell: [24, 32, (x) => { Rc(x, 2, 4, 3, 27, '#5a3a22'); Rc(x, 19, 4, 3, 27, '#5a3a22'); Rc(x, 0, 2, 24, 4, '#6b4a2e'); Po(x, [[12, 6], [17, 12], [18, 22], [6, 22], [7, 12]], '#a07a3a'); Rc(x, 6, 21, 12, 2, '#c09a4a'); E(x, 12, 24, 1.5, 1.5, '#a07a3a'); }],
  cart: [22, 18, (x) => { Rc(x, 2, 3, 18, 9, '#6a5a4a'); Rc(x, 2, 3, 18, 2, '#8a7a6a'); E(x, 6, 14, 3, 3, '#2a2a2a'); E(x, 16, 14, 3, 3, '#2a2a2a'); E(x, 11, 3, 6, 2, '#a07a5a'); }]
};

export class Expedition extends Game {
  static noMods = ['mirror', 'lowg', 'heavy', 'wobble', 'trails'];
  setup() {
    const sh2 = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    this.pOrder = sh2(PLACES.map((_, i) => i)); this.mOrder = sh2(MISSIONS); this.mi = 0;
    const e = (this.post.seed >>> 2) % 6;
    this.era = e === 4 ? 'Present day' : e === 5 ? 'Sci-fi' : 'Fantasy';
    this.lc = mk(W / 4, H / 4);
    this.vig = mk(W, H); const v = this.vig.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 300);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); v.fillStyle = g; v.fillRect(0, 0, W, H);
    this.cloud = cloudCv(() => this.rng());
    this.n = 0; this.shake = 0; this.irisIn = 0; this.irisOut = 0;
    this.newExpedition();
  }
  // ---------------------------------------------------------------- a new place and mission
  newExpedition() {
    this.n++;
    const pi = this.pOrder[(this.n - 1) % PLACES.length], P = this.place = PLACES[pi];
    let mid = 'rescue';
    for (let k = 0; k < 8; k++) { mid = this.mOrder[this.mi++ % this.mOrder.length]; if (!P.no?.includes(mid)) break; }
    this.name = this.where = P.names[(this.post.seed + this.n) % P.names.length];
    Object.assign(this, { npcs: [], creatures: [], objs: [], props: [], lights: [], amb: [], fx: [], pops: [], prints: [], trail: [], lines: [], line: null, inv: {}, follower: null,
      ending: null, task: null, flash: null, started: false, partsGot: 0, minimap: false, apT: 1, darkGoal: P.dark, darkNow: P.dark, trophy: null });
    const cs = this.skin.creatures, n = this.n;
    this.crFoe = cs[n % 6]; this.crCritter = cs[(n + 2) % 6]; this.crSpecial = cs[(n + 4) % 6]; this.crBoss = cs[(n + 1) % 6];
    this.foeName = (this.crFoe.species || this.crFoe.name || 'shade').toLowerCase();
    this.genMap();
    const R0 = this.R[0], h = this.hero ||= { actor: new Actor(this.skin.crystal(0, this.era), { mode: 'eight', walkSpeed: 10, runSpeed: 70 }), emq: [], h: 32 };
    Object.assign(h, { x: px(R0.cx), y: py(R0.cy), path: [], target: null, max: this.mods.glass ? 2 : 5, invT: 0, ko: 0, kb: null });
    h.hp = h.max; this.used[R0.cy * MW + R0.cx] = 1; this.home = { x: h.x, y: h.y };
    const m = this.m = this['m_' + mid](P, P.N);
    m.id = mid; m.cur = 0;
    this.decorate();
    this.seenT = new Uint8Array(MW * MH); this.mmDirty = 1;
    this.bake();
    this.card = 3.8; this.irisIn = 0.8;
    this.cam = { x: Math.max(0, Math.min(MW * T - W, h.x - W / 2)), y: Math.max(-40, Math.min(MH * T - H + 34, h.y - H / 2)) };
    const R = mulberry32(this.post.seed + n * 31);
    this.clouds = Array.from({ length: 16 }, () => ({ x: R() * (MW * T * 0.5 + W), y: R() * (MH * T * 0.5 + H), s: 0.6 + R() * 0.9, f: R() < 0.5 ? 0.25 : 0.5 }));
    this.vgears = Array.from({ length: 9 }, () => ({ x: R() * (MW * T * 0.5 + W), y: R() * (MH * T * 0.5 + H), r: 30 + R() * 50, sp: (R() - 0.5) * 0.8 }));
    this.cshade = Array.from({ length: 3 }, () => ({ x: R() * MW * T, y: R() * MH * T, r: 90 + R() * 80 }));
    if (P.void === 'gears') this.gearImg = gearCv(70, '#5a3e22');
  }
  // rooms on a 3×3 grid: a chain of four (camp → goal) plus side rooms, joined by corridors or bridges
  genMap() {
    const P = this.place, map = this.map = new Uint8Array(MW * MH);
    this.block = new Uint8Array(MW * MH); this.used = new Uint8Array(MW * MH); this.nearLink = new Uint8Array(MW * MH); this.bdir = new Uint8Array(MW * MH);
    this.gateAt = new Map(); this.hz = new Map();
    const nb = (k) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [k % 3 + dx, (k / 3 | 0) + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < 3 && y < 3).map(([x, y]) => y * 3 + x);
    let chain = null;
    while (!chain) { const c = [this.ri(0, 8)]; while (c.length < 4) { const o = nb(c[c.length - 1]).filter((k) => !c.includes(k)); if (!o.length) break; c.push(o[this.ri(0, o.length - 1)]); } if (c.length === 4) chain = c; }
    const room = (k) => { const X = (k % 3) * RW, Y = (k / 3 | 0) * RH, r = { k, x0: X + 1 + this.ri(0, 1), x1: X + RW - 2 - this.ri(0, 1), y0: Y + 1 + this.ri(0, 1), y1: Y + RH - 2 - this.ri(0, 1) }; r.cx = (r.x0 + r.x1) >> 1; r.cy = (r.y0 + r.y1) >> 1; return r; };
    this.R = chain.map(room); this.sides = [];
    const taken = new Set(chain);
    for (const ci of [1, 2, 1]) {
      if (this.sides.length >= 2 || this.rng() < 0.3) continue;
      const o = nb(chain[ci]).filter((k) => !taken.has(k)); if (!o.length) continue;
      const k = o[this.ri(0, o.length - 1)]; taken.add(k); const r = room(k); r.par = ci; this.sides.push(r);
    }
    this.rooms = [...this.R, ...this.sides];
    const inRoom = (i) => this.rooms.some((r) => i % MW >= r.x0 && i % MW <= r.x1 && (i / MW | 0) >= r.y0 && (i / MW | 0) <= r.y1);
    for (const r of this.rooms) {
      const rx = (r.x1 - r.x0) / 2 + 0.5, ry = (r.y1 - r.y0) / 2 + 0.5, mx = (r.x0 + r.x1) / 2, my = (r.y0 + r.y1) / 2;
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (P.ring || ((x - mx) / rx) ** 2 + ((y - my) / ry) ** 2 < 0.82 + this.rng() * 0.45) map[y * MW + x] = FLOOR;
      r.entry = { x: px(r.cx), y: py(r.cy) };
    }
    this.links = [];
    const link = (A, B) => {
      const hor = (A.k / 3 | 0) === (B.k / 3 | 0), L = { a: A, b: B, hor, tiles: [], gap: [] };
      if (hor) { const Y = (A.k / 3 | 0) * RH + this.ri(3, 5), s = Math.sign(B.cx - A.cx); for (let x = A.cx; x !== B.cx + s; x += s) L.tiles.push(Y * MW + x); }
      else { const X = (A.k % 3) * RW + this.ri(3, 7), s = Math.sign(B.cy - A.cy); for (let y = A.cy; y !== B.cy + s; y += s) L.tiles.push(y * MW + X); }
      for (const i of L.tiles) {
        if (inRoom(i)) map[i] = RUG;
        else { L.gap.push(i); map[i] = P.ring ? FLOOR : BRIDGE; this.bdir[i] = hor ? 1 : 2; }
      }
      const g = L.gap[L.gap.length >> 1];
      B.entry = { x: px(g % MW), y: py(g / MW | 0) };
      this.links.push(L); return L;
    };
    this.L = [link(this.R[0], this.R[1]), link(this.R[1], this.R[2]), link(this.R[2], this.R[3])];
    for (const s of this.sides) link(this.R[s.par], s);
    for (const L of this.links) for (const i of L.gap) for (const d of [0, 1, -1, MW, -MW, MW + 1, MW - 1, -MW + 1, -MW - 1]) if (i + d >= 0 && i + d < MW * MH) this.nearLink[i + d] = 1;
    // drop unreachable scraps, ring the rooms with walls where the place has them
    this.reachN = this.bfs();
    for (let i = 0; i < MW * MH; i++) if (walkT(map[i]) && !this.seen[i]) map[i] = VOID;
    if (P.ring) for (let i = 0; i < MW * MH; i++) {
      if (map[i] !== VOID) continue;
      const x = i % MW, y = i / MW | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < MW && Y < MH && walkT(map[Y * MW + X])) map[i] = WALL; }
    }
    // a few inner wall pieces: ruins, shelves, pipes, rocks
    for (const r of this.rooms.slice(1)) {
      if (this.rng() > (P.inner || 0)) continue;
      const hor = this.rng() < 0.6, len = this.ri(2, 3), x0 = this.ri(r.x0 + 1, r.x1 - 1), y0 = this.ri(r.y0 + 1, r.y1 - 1);
      for (let k = 0; k < len; k++) { const x = hor ? x0 + k : x0, y = hor ? y0 : y0 + k; if (x <= r.x1 && y <= r.y1) this.tryWall(y * MW + x); }
    }
  }
  tryWall(i) {
    if (this.map[i] !== FLOOR || this.nearLink[i] || this.rugNear(i) || i === this.R[0].cy * MW + this.R[0].cx) return false;
    this.map[i] = WALL;
    const n = this.bfs();
    if (n !== this.reachN - 1) { this.map[i] = FLOOR; return false; }
    this.reachN = n; return true;
  }
  rugNear(i) { return [1, -1, MW, -MW].some((d) => this.map[i + d] === RUG || this.map[i + d] === BRIDGE); }
  edgeAt(i) { return [1, -1, MW, -MW].some((d) => !walkT(this.map[i + d])); }
  ok(i, gates = true) {
    if (i < 0 || i >= MW * MH || !walkT(this.map[i]) || this.block[i]) return false;
    if (gates) { const g = this.gateAt.get(i); if (g && !g.open) return false; }
    return true;
  }
  tIdx(x, y) { return Math.floor((y - 5) / T) * MW + Math.floor(x / T); }
  // count tiles reachable from camp (gates open); `this.seen` marks them
  bfs() {
    const seen = this.seen = new Uint8Array(MW * MH), s = this.R[0].cy * MW + this.R[0].cx, q = [s]; seen[s] = 1; let n = 0;
    while (q.length) {
      const i = q.pop(); n++;
      for (const d of [1, -1, MW, -MW]) {
        const j = i + d;
        if (j < 0 || j >= MW * MH || seen[j] || (d === 1 && j % MW === 0) || (d === -1 && i % MW === 0) || !this.ok(j, false)) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return n;
  }
  canBlock(i) {
    this.block[i] = 1;
    const n = this.bfs();
    if (n !== this.reachN - 1) { this.block[i] = 0; return false; }
    this.reachN = n; return true;
  }
  // a free floor tile in a room, scored by what the caller wants (near, far, edge, nearT)
  spot(room, o = {}) {
    if (!room) return null;
    const c = [];
    for (let y = room.y0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) {
      const i = y * MW + x;
      if (this.map[i] !== FLOOR || this.used[i] || this.nearLink[i] || this.hz.has(i) || (o.block && this.rugNear(i))) continue;
      let s = this.rng();
      const ex = px(x), ey = py(y);
      if (o.edge) s += this.edgeAt(i) ? 1 : 0;
      if (o.far) s += (Math.hypot(ex - room.entry.x, ey - room.entry.y) / T) * 0.5;
      if (o.near) { const d = Math.hypot(ex - o.near.x, ey - o.near.y) / T; s -= Math.abs(d - 2) * 0.8; }
      if (o.nearT) { const d = Math.hypot(ex - o.nearT.x, ey - o.nearT.y) / T; s -= d < 1.5 ? 5 : d * 0.6; }
      c.push([s, i]);
    }
    c.sort((a, b) => b[0] - a[0]);
    for (const [, i] of c) {
      if (o.block && !this.canBlock(i)) continue;
      this.used[i] = 1;
      return { tx: i % MW, ty: i / MW | 0, i };
    }
    return null;
  }
  sideOf(ci) { return this.sides.find((r) => r.par === ci) || null; }
  names(n) { const out = []; while (out.length < n) { const s = NAMES[this.ri(0, NAMES.length - 1)]; if (!out.includes(s)) out.push(s); } return out; }
  pickA(a) { return a[this.ri(0, a.length - 1)]; }
  nearest(list) { let b = null, bd = 1e9; for (const o of list) { const d = dist(o, this.hero); if (d < bd) { bd = d; b = o; } } return b; }

  // ---------------------------------------------------------------- characters and things
  npc(room, name, o = {}) {
    const s = o.at || this.spot(room, o); if (!s) return null;
    const k = this.npcs.length + 1 + this.n * 4;
    const n = { kind: 'npc', name, x: px(s.tx), y: py(s.ty), tx: s.tx, ty: s.ty, emq: [], h: 32, kneel: !!o.kneel, grumpy: !!o.grumpy,
      actor: new Actor(this.skin.crystal(k, this.era, D4), { mode: 'four', walkSpeed: 10, runSpeed: 75, dir: 'S' }) };
    this.npcs.push(n); return n;
  }
  creature(kind, cr, room, o = {}) {
    const s = o.at || this.spot(room, o); if (!s) return null;
    const c = { kind, cr, x: px(s.tx), y: py(s.ty), face: this.rng() < 0.5 ? 1 : -1, ph: this.r(0, 2), hp: 1, max: 1, state: 'idle', cd: 0, atkT: 0, hurtT: 0, dead: false, deadT: 0, sc: kind === 'critter' ? 0.95 : 1.3, wt: this.r(0, 3), mv: 0, wph: 0 };
    c.home = { x: c.x, y: c.y };
    this.creatures.push(c); return c;
  }
  foeGroup(room, n, o = {}) {
    const out = [];
    for (let k = 0; k < n * (this.mods.swarm && !o.boss ? 2 : 1); k++) {
      const f = this.creature('foe', o.boss ? this.crBoss : this.crFoe, room, o); if (!f) continue;
      f.hp = f.max = o.boss ? 6 : 2; f.sc = (o.boss ? 2.1 : 1.35) * this.S; f.boss = !!o.boss; f.leash = (o.boss ? 3 : 5) * T;
      f.title = o.boss ? `guardian ${f.cr.name || ''}`.trim() : f.cr.name;
      out.push(f);
    }
    return out;
  }
  obj(kind, room, o = {}, so = {}) {
    const block = o.block !== false, s = so.at || this.spot(room, { block, ...so }); if (!s) return null;
    const ob = { kind, tx: s.tx, ty: s.ty, x: px(s.tx), y: py(s.ty), h: 26, ...o };
    this.objs.push(ob); return ob;
  }
  chest(room, item) { return this.obj('chest', room, { item, h: 22, use: (c) => { if (c.open) return this.bark(this.hero, 'Empty.'); c.open = true; this.give(item, c); } }, { edge: 1, far: 1 }); }
  item(room, item) { return this.obj('item', room, { item, block: false, h: 18, use: (o) => this.pickUp(o) }, { far: 1 }); }
  lever(room, gate) {
    return this.obj('lever', room, { on: false, gate, h: 22, use: (l) => {
      if (l.on) return;
      this.doTask(l, 'attack', 1, () => {
        l.on = true; this.shake = 0.15; this.fxBurst(l.x, l.y - 10, '#e8d8b0', 8, 60);
        const all = this.objs.filter((o) => o.kind === 'lever' && o.gate === gate), on = all.filter((o) => o.on).length;
        if (on === all.length) { this.openGate(gate); this.bark(this.hero, 'Something opened!'); } else this.bark(this.hero, `${on} of ${all.length} levers…`);
      });
    } }, { edge: 1, far: 1 });
  }
  plate(room, gate) { return this.obj('plate', room, { on: false, gate, block: false, h: 8 }, {}); }
  beacon(room, big) {
    const N = this.place.N;
    return this.obj('beacon', room, { lit: false, big, h: big ? 44 : 34, use: (b) => {
      if (b.lit) return;
      if (!this.inv.flame) return this.say(this.hero, `I need fire from the ${N.brazier}.`, 'think');
      this.doTask(b, 'cast', 1, () => {
        b.lit = true; this.lights.push({ x: b.x, y: b.y - (big ? 36 : 26), r: big ? 190 : 120, fl: 1 });
        this.fxBurst(b.x, b.y - (big ? 36 : 26), '#ffd27a', big ? 40 : 22, big ? 170 : 120, { add: 1 }); this.shake = big ? 0.3 : 0.1;
      });
    } }, { far: 1 });
  }
  brazier(room) {
    const b = this.obj('brazier', room, { h: 28, use: () => { if (this.inv.flame) return; this.doTask(b, 'cast', 1, () => this.give({ k: 'flame', name: 'flame' }, b)); } }, { near: this.hero });
    if (b) this.lights.push({ x: b.x, y: b.y - 18, r: 100, fl: 1 });
    return b;
  }
  survey(room, name) {
    return this.obj('survey', room, { name, done: false, h: 30, use: (s) => {
      if (s.done) return;
      this.doTask(s, 'think', 1, () => { s.done = true; this.reveal(s, 9); this.bark(this.hero, `${cap(name)}: mapped!`); this.fxBurst(s.x, s.y - 24, '#ffffff', 14, 80, { add: 1 }); });
    } }, { far: 1 });
  }
  pedestal(room) {
    return this.obj('pedestal', room, { h: 40, use: (p) => {
      if (!p.item) return;
      if (this.creatures.some((c) => c.boss && !c.dead)) return this.say(this.hero, 'The guardian won’t let me near it!', 'surprise');
      this.give(p.item, p); p.item = null;
    } }, { far: 1 });
  }
  shrine(room) { return this.obj('shrine', room, { h: 40, glow: 0 }, { far: 1 }); }
  gate(L, lock) {
    const i = L.gap[L.gap.length >> 1], P = this.place, N = P.N;
    const style = { key: 'door', burn: P.burn, foes: 'barrier', repair: 'broken', guard: 'guard' }[lock] || 'bars';
    const label = { burn: N.bar, foes: 'spirit barrier', repair: N.bridge }[lock] || N.gate;
    const g = { kind: 'gate', lock, style, label, tx: i % MW, ty: i / MW | 0, x: px(i % MW), y: py(i / MW | 0), i, open: false, openT: 0, h: 40, hor: L.hor };
    g.use = (gt) => this.tryGate(gt);
    this.gateAt.set(i, g); this.objs.push(g); return g;
  }
  tryGate(g) {
    if (g.open) return;
    const N = this.place.N, h = this.hero;
    switch (g.lock) {
      case 'key': if (this.inv.key) { this.inv.key--; this.doTask(g, null, 1, () => this.openGate(g)); } else this.say(h, `Locked. I need the ${N.key}.`, 'think'); break;
      case 'burn': if (this.inv.flame) this.doTask(g, 'cast', 1, () => { this.openGate(g); this.fxBurst(g.x, g.y - 14, '#ff9a3a', 36, 140, { add: 1 }); }); else this.say(h, `I could burn the ${N.bar} away… with fire.`, 'think'); break;
      case 'repair': if (this.partsGot >= 3) this.doTask(g, 'attack', 3, () => { this.inv.part = 0; this.openGate(g); }); else this.say(h, `I need ${3 - this.partsGot} more ${N.part}${3 - this.partsGot > 1 ? 's' : ''}.`, 'think'); break;
      case 'lever': this.say(h, 'It won’t budge. A lever must open it.', 'think'); break;
      case 'plates': this.say(h, 'Those pressure plates must open it.', 'think'); break;
      case 'foes': this.say(h, `A spirit barrier! The ${this.foeName}s keep it up.`, 'surprise'); break;
    }
  }
  openGate(g) {
    if (g.open) return;
    g.open = true; g.openT = 0; this.score += 50; this.shake = Math.max(this.shake, 0.18);
    this.fxBurst(g.x, g.y - 12, g.style === 'barrier' ? '#c9a0ff' : g.style === 'ice' ? '#bfefff' : '#cfc0a0', 26, 110, { add: g.style === 'barrier' ? 1 : 0 });
  }
  give(it, from) {
    this.inv[it.k] = (this.inv[it.k] || 0) + 1;
    if (it.k === 'part') this.partsGot++;
    this.pops.push({ it, x: from.x, y: from.y - 20, t: 0 });
    this.emote(this.hero, 'cheer', 0.9); this.bark(this.hero, `Got the ${it.name}!`); this.score += 25; this.apT = 1;
  }
  pickUp(o) { if (o.taken) return; o.taken = true; this.give(o.item, o); }
  doTask(o, verb, n, fn) { this.task = { o, verb, n, k: 0, t: 0, fn }; this.hero.path = []; }
  stepTask(dt) {
    const k = this.task, a = this.hero.actor; k.t += dt;
    if (k.k < k.n && k.t >= 0.5 * k.k) {
      k.k++;
      if (k.verb === 'attack') a.attack(); else if (k.verb === 'cast') a.cast(); else if (k.verb) this.emote(this.hero, k.verb, 0.9);
      if (k.verb === 'attack' && k.o.kind === 'gate') this.fxBurst(k.o.x, k.o.y - 8, '#ffe0a0', 6, 90, { add: 1 });
    }
    if (k.t >= 0.5 * k.n + 0.35) { this.task = null; if (k.verb === 'cast') a.stopCast(); k.fn?.(); }
  }
  hazardStrip(r) {
    const out = this.links.find((l) => l.a === r), hor = out ? out.hor : true, style = this.place.hz;
    let k = 0;
    if (hor) { const X = r.cx + (out ? Math.sign(out.b.cx - r.cx) : 1) * 2; for (let y = r.y0; y <= r.y1; y++) this.addHz(y * MW + X, k++, style); }
    else { const Y = r.cy + (out ? Math.sign(out.b.cy - r.cy) : 1) * 2; for (let x = r.x0; x <= r.x1; x++) this.addHz(Y * MW + x, k++, style); }
  }
  addHz(i, k, style) { if (walkT(this.map[i]) && !this.block[i] && !this.used[i] && !this.gateAt.has(i) && this.map[i] !== BRIDGE) this.hz.set(i, { per: 2.6, on: 1, ph: k * 0.2, style }); }
  hzOn(z) { const m = (this.t + z.ph) % z.per; return m < z.on ? 2 : m > z.per - 0.4 ? 1 : 0; }
  prop(kind, s) {
    if (!s || !PROPS[kind]) return null;
    const [w, h, fn] = PROPS[kind], cv = mk(w, h), x = cv.getContext('2d');
    const ex = fn(x, () => this.rng(), this.place, this) || {};
    const p = { kind: 'prop', pk: kind, tx: s.tx, ty: s.ty, x: px(s.tx), y: py(s.ty) + 1, cv, ax: w / 2, ay: h - 2, ...ex };
    this.props.push(p);
    if (ex.light) this.lights.push({ x: p.x, y: p.y - h * 0.6, r: ex.light.r, col: ex.light.col, fl: !!ex.flames });
    return p;
  }
  decorate() {
    const P = this.place, R0 = this.R[0], h = this.hero;
    if (P.ring || P.void === 'water' && P.id !== 'swamp' || P.id === 'tower') { this.prop('crate', this.spot(R0, { block: 1, edge: 1 })); this.prop('barrel', this.spot(R0, { block: 1, edge: 1 })); }
    else { this.prop('tent', this.spot(R0, { block: 1, edge: 1, near: h })); this.prop('campfire', this.spot(R0, { block: 1, near: h })); }
    for (const r of this.rooms) {
      for (let k = 0, n = r === R0 ? 2 : this.ri(3, 6); k < n; k++) this.prop(this.pickA(P.tall), this.spot(r, { block: 1, edge: 1 }));
      if (P.dark > 0.15) for (let k = 0, n = r === R0 ? 1 : this.ri(1, 2); k < n; k++) this.prop(P.lamp, this.spot(r, { block: 1, edge: 1 }));
    }
    this.hazardStrip(this.R[this.ri(1, 2)]);
    for (let k = 0, n = (this.mods.swarm ? 2 : 1) * this.ri(2, 4); k < n; k++) this.creature('critter', this.crCritter, this.rooms[this.ri(0, this.rooms.length - 1)]);
  }

  // ---------------------------------------------------------------- missions
  m_rescue(P, N) {
    const [gn, ln] = this.names(2);
    const giver = this.npc(this.R[0], gn, { near: this.hero }), lost = this.npc(this.R[3], ln, { far: 1, kneel: true });
    const gate = this.gate(this.L[2], 'key'), kr = this.sideOf(1) || this.sideOf(2) || this.R[1];
    const chest = this.chest(kr, { k: 'key', name: N.key });
    this.foeGroup(this.R[2], 2); if (kr !== this.R[1]) this.foeGroup(kr, 1);
    let freed = false;
    lost.barkNear = 'Help! Is someone there?';
    lost.talk = () => {
      if (freed) return this.say(lost, 'Right behind you!', 'nod');
      freed = true; lost.kneel = false;
      this.say(lost, 'You found me! I thought I’d be stuck here forever.', 'cheer');
      this.say(lost, 'Lead the way back to camp!', 'nod', () => { this.follower = lost; });
    };
    giver.talk = () => this.say(giver, freed ? `Bring ${ln} here!` : `Please find ${ln}!`, freed ? 'wave' : 'sad');
    return {
      goal: `Rescue ${ln} the ${P.N.who}`,
      intro: [[giver, `${ln} the ${N.who} went to ${N.verb} ${this.where} and never came back!`, 'sad'], [giver, `I think ${ln} is behind the ${N.gate}.`, 'think'], [this.hero, `I’ll bring ${ln} home.`, 'nod']],
      steps: [
        { s: `Find the ${N.key}`, done: () => this.inv.key > 0 || gate.open, tg: () => chest },
        { s: `Unlock the ${N.gate}`, done: () => gate.open, tg: () => gate },
        { s: `Free ${ln}`, done: () => this.follower === lost, tg: () => lost },
        { s: `Bring ${ln} back to camp`, done: () => this.follower === lost && dist(lost, giver) < 64, tg: () => giver }
      ],
      fin: () => { this.follower = null; this.say(giver, `${ln}! You’re safe!`, 'love'); this.say(lost, 'All thanks to this brave explorer!', 'cheer'); }
    };
  }
  m_relic(P, N) {
    const [gn] = this.names(1);
    const giver = this.npc(this.R[0], gn, { near: this.hero }), gate = this.gate(this.L[2], 'lever');
    const levers = [this.lever(this.sideOf(1) || this.R[1], gate), this.lever(this.sideOf(2) || this.R[2], gate)].filter(Boolean);
    const ped = this.pedestal(this.R[3]), boss = this.foeGroup(this.R[3], 1, { boss: 1, nearT: ped })[0];
    this.foeGroup(this.R[2], 2);
    const relic = { k: 'relic', name: N.relic.replace(/^the /, ''), img: this.skin.pick('relic' + this.n, 'item') };
    ped.item = relic;
    let back = false;
    giver.talk = () => { if (this.inv.relic) back = true; else this.say(giver, `${cap(N.relic)} is past the ${N.gate}.`, 'think'); };
    return {
      goal: `Recover ${N.relic}`,
      intro: [[giver, `${cap(N.relic)} lies deep in ${this.where}.`, 'think'], [giver, `Two old levers open the ${N.gate}. Beware its guardian!`, 'surprise'], [this.hero, 'I’ll bring it back.', 'nod']],
      steps: [
        { s: () => `Pull both levers (${levers.filter((l) => l.on).length}/2)`, done: () => gate.open, tg: () => this.nearest(levers.filter((l) => !l.on)) },
        { s: 'Defeat the guardian', done: () => !boss || boss.dead, tg: () => boss },
        { s: `Take ${N.relic}`, done: () => this.inv.relic > 0 || back, tg: () => ped },
        { s: `Bring it back to ${gn}`, done: () => back || (this.inv.relic > 0 && dist(this.hero, giver) < 46), tg: () => giver }
      ],
      fin: () => { this.inv.relic = 0; this.trophy = { o: giver, it: relic }; this.say(giver, `${cap(N.relic)}! After all these years!`, 'love'); this.fxBurst(giver.x, giver.y - 40, '#ffe08a', 30, 120, { add: 1 }); }
    };
  }
  m_beacons(P, N) {
    const [gn] = this.names(1);
    const giver = this.npc(this.R[0], gn, { near: this.hero }), braz = this.brazier(this.R[0]), gate = this.gate(this.L[2], 'burn');
    const b = [this.beacon(this.sideOf(1) || this.R[1]), this.beacon(this.R[2]), this.beacon(this.R[3], true)];
    this.foeGroup(this.R[1], 1); this.foeGroup(this.R[2], 2);
    const lit = () => b.slice(0, 2).filter((x) => x.lit).length;
    return {
      goal: `Light the ${N.beacon}s of ${this.where}`,
      intro: [[giver, `The ${N.beacon}s went out and the dark crept in.`, 'sad'], [giver, `Take fire from the ${N.brazier} and light them all!`, 'wave'], [this.hero, 'Lighting them now.', 'nod']],
      steps: [
        { s: `Take fire from the ${N.brazier}`, done: () => this.inv.flame > 0, tg: () => braz },
        { s: () => `Light the ${N.beacon}s (${lit()}/2)`, done: () => lit() === 2, tg: () => this.nearest(b.slice(0, 2).filter((x) => !x.lit)) },
        { s: `Burn away the ${N.bar}`, done: () => gate.open, tg: () => gate },
        { s: `Light the great ${N.beacon}`, done: () => b[2].lit, tg: () => b[2] }
      ],
      fin: () => { this.darkGoal = 0.1; for (const x of b) this.fxBurst(x.x, x.y - 30, '#ffd27a', 24, 140, { add: 1 }); this.say(this.hero, `${cap(this.where)} shines again!`, 'cheer'); }
    };
  }
  m_deliver(P, N) {
    const [gn, rn, kn] = this.names(3), treat = this.pickA(TREATS);
    const giver = this.npc(this.R[0], gn, { near: this.hero }), gate = this.gate(this.L[1], 'guard');
    const guard = this.npc(null, kn, { at: { tx: gate.tx, ty: gate.ty }, grumpy: 1 });
    const chest = this.chest(this.sideOf(1) || this.R[1], { k: 'treat', name: treat }), rec = this.npc(this.R[3], rn, { far: 1 });
    this.foeGroup(this.R[2], 2); this.foeGroup(this.R[3], 1);
    let given = false;
    this.inv.letter = 1;
    guard.talk = () => {
      if (gate.open) return this.say(guard, 'Go on, then.', 'nod');
      if (!this.inv.treat) return this.say(guard, `No one passes! Unless… you have a ${treat}?`, 'angry');
      this.inv.treat = 0;
      this.say(guard, `A ${treat}! For me? Fine, you may pass.`, 'love', () => { this.openGate(gate); this.stepAside(guard, gate); });
    };
    rec.talk = () => { if (given) return this.say(rec, 'Thank you again!', 'wave'); given = true; this.inv.letter = 0; this.say(rec, `A letter from ${gn}? For me?`, 'surprise'); this.say(rec, '…', 'think'); };
    return {
      goal: `Deliver ${gn}’s letter to ${rn}`,
      intro: [[giver, `Please take this letter to ${rn}, across ${this.where}.`, 'wave'], [giver, `${kn} guards the way. Grumpy, but loves a ${treat}.`, 'laugh'], [this.hero, 'Special delivery, coming up.', 'nod']],
      steps: [
        { s: `Find a ${treat} for ${kn}`, done: () => this.inv.treat > 0 || gate.open, tg: () => chest },
        { s: `Give the ${treat} to ${kn}`, done: () => gate.open, tg: () => guard },
        { s: `Deliver the letter to ${rn}`, done: () => given && !this.line && !this.lines.length, tg: () => rec }
      ],
      fin: () => this.say(rec, `${gn} wants to visit! Oh, how wonderful!`, 'love')
    };
  }
  m_escort(P, N) {
    const [gn] = this.names(1);
    const giver = this.npc(this.R[0], gn, { near: this.hero }), sp = this.creature('spirit', this.crSpecial, this.sideOf(1) || this.R[1], { far: 1 });
    const gate = this.gate(this.L[2], 'foes'), grp = gate.group = this.foeGroup(this.R[2], 3), shrine = this.shrine(this.R[3]);
    sp.sc = 1.3; sp.glow = 1;
    sp.use = () => { if (this.follower === sp) return; this.follower = sp; this.emote(sp, 'love', 2); this.say(this.hero, 'There you are, little one. Follow me!', 'wave'); };
    const left = () => grp.filter((f) => !f.dead).length;
    return {
      goal: `Guide a lost spirit home to the ${N.shrine}`,
      intro: [[giver, `A little ${(sp.cr.species || 'spirit').toLowerCase()} spirit wandered off and got lost.`, 'sad'], [giver, `Bring it home to the ${N.shrine}. Mind the ${this.foeName}s!`, 'think'], [this.hero, 'I’ll find it.', 'nod']],
      steps: [
        { s: 'Find the lost spirit', done: () => this.follower === sp, tg: () => sp },
        { s: () => `Chase off the ${this.foeName}s (${grp.length - left()}/${grp.length})`, done: () => !left(), tg: () => this.nearest(grp.filter((f) => !f.dead)) },
        { s: `Lead the spirit to the ${N.shrine}`, done: () => dist(sp, shrine) < 60, tg: () => shrine }
      ],
      fin: () => { this.follower = null; sp.ascend = 0.01; shrine.glow = 1; this.lights.push({ x: shrine.x, y: shrine.y - 20, r: 150 }); this.say(this.hero, 'Welcome home, little one.', 'cheer'); }
    };
  }
  m_map(P, N) {
    const [gn] = this.names(1), lm = N.lm;
    this.npc(this.R[0], gn, { near: this.hero });
    const a = this.survey(this.R[1], lm[0]), b = this.survey(this.sideOf(1) || this.sideOf(2) || this.R[2], lm[1]);
    const gate = this.gate(this.L[2], 'plates'), plates = [this.plate(this.R[2], gate), this.plate(this.R[2], gate)].filter(Boolean);
    const c = this.survey(this.R[3], lm[2]);
    this.foeGroup(this.R[1], 1); this.foeGroup(this.R[2], 1); this.foeGroup(this.R[3], 1);
    this.minimap = true;
    const giver = this.npcs[0];
    return {
      goal: `Map ${this.where}`,
      intro: [[giver, `Nobody has ever mapped ${this.where}!`, 'surprise'], [giver, `Survey the ${lm[0]}, the ${lm[1]} and the ${lm[2]}.`, 'think'], [this.hero, 'Map and pencil ready.', 'nod']],
      steps: [
        { s: `Survey the ${lm[0]}`, done: () => a.done, tg: () => a },
        { s: `Survey the ${lm[1]}`, done: () => b.done, tg: () => b },
        { s: () => `Step on both plates (${plates.filter((p) => p.on).length}/2)`, done: () => gate.open, tg: () => this.nearest(plates.filter((p) => !p.on)) },
        { s: `Survey the ${lm[2]}`, done: () => c.done, tg: () => c }
      ],
      fin: () => { this.reveal(null); this.say(this.hero, 'The map is complete!', 'cheer'); }
    };
  }
  m_thief(P, N) {
    const [gn] = this.names(1), loot = this.pickA(LOOT);
    const giver = this.npc(this.R[0], gn, { near: this.hero }), gate = this.gate(this.L[2], 'lever');
    const lever = this.lever(this.sideOf(2) || this.R[2], gate), th = this.creature('thief', this.crSpecial, this.R[0], { near: giver });
    th.hides = [this.spot(this.R[1]), this.spot(this.R[2], { nearT: gate }), this.spot(this.R[3], { far: 1 })];
    th.stage = -1; th.speed = 105; th.path = [];
    this.foeGroup(this.R[1], 1); this.foeGroup(this.R[3], 1);
    const tn = th.cr.name || 'the thief';
    th.use = () => { if (th.stage >= 2 && !th.caught && !th.path.length) { th.caught = true; this.emote(th, 'sad', 2); this.say(this.hero, `Gotcha! Hand over that ${loot}.`, 'angry'); this.give({ k: 'loot', name: loot }, th); } };
    return {
      goal: `Catch the thief who stole ${gn}’s ${loot}`,
      intro: [[giver, `Stop, thief! That ${(th.cr.species || 'critter').toLowerCase()} stole my ${loot}!`, 'angry'], [th, 'Hee hee!', 'laugh'], [giver, `It’s running into ${this.where}!`, 'surprise']],
      steps: [
        { s: `Chase ${tn}`, done: () => th.stage >= 2, tg: () => th },
        { s: `Pull the lever to open the ${N.gate}`, done: () => gate.open, tg: () => lever },
        { s: `Catch ${tn}`, done: () => th.caught, tg: () => th }
      ],
      fin: () => { this.say(th, 'Sorry… it was just so shiny.', 'sad'); this.say(this.hero, `${gn} will be so happy!`, 'cheer'); }
    };
  }
  m_repair(P, N) {
    const [gn, tn] = this.names(2);
    this.npc(this.R[0], gn, { near: this.hero });
    const giver = this.npcs[0], gate = this.gate(this.L[2], 'repair'), trav = this.npc(this.R[3], tn, { nearT: gate });
    const part = { k: 'part', name: N.part };
    const parts = [this.item(this.R[1], part), this.chest(this.sideOf(1) || this.sideOf(2) || this.R[1], part), this.item(this.R[2], part)].filter(Boolean);
    this.foeGroup(this.R[2], 2, { nearT: parts[2] || this.R[2].entry });
    let met = false;
    trav.barkNear = 'Hello? I’m stranded over here!';
    trav.talk = () => { met = true; this.say(trav, 'You fixed it! I can finally get home.', 'cheer'); };
    const left = () => parts.filter((p) => (p.kind === 'item' ? !p.taken : !p.open));
    return {
      goal: `Repair the ${N.bridge}`,
      intro: [[giver, `The ${N.bridge} broke and ${tn} is stranded on the far side!`, 'surprise'], [giver, `Find three ${N.part}s and fix it.`, 'think'], [this.hero, 'Hammer at the ready.', 'nod']],
      steps: [
        { s: () => `Gather ${N.part}s (${Math.min(3, this.partsGot)}/3)`, done: () => this.partsGot >= 3 || gate.open, tg: () => this.nearest(left()) },
        { s: `Repair the ${N.bridge}`, done: () => gate.open, tg: () => gate },
        { s: `Meet ${tn} across the ${N.bridge}`, done: () => met && !this.line && !this.lines.length, tg: () => trav }
      ],
      fin: () => this.say(trav, 'Three cheers for the bridge builder!', 'cheer')
    };
  }
  stepAside(n, g) {
    const s = this.spot(this.L[1].b, { nearT: g });
    if (!s) return;
    const p = this.findPath(g.tx, g.ty, s.tx, s.ty, 0);
    n.path = p ? p.map((i) => [px(i % MW), py(i / MW | 0)]) : [[px(s.tx), py(s.ty)]];
  }
  reveal(o, r = 3) {
    if (!o) this.seenT.fill(1);
    else { const tx = Math.floor(o.x / T), ty = Math.floor((o.y - 5) / T); for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (x >= 0 && y >= 0 && x < MW && y < MH && (x - tx) ** 2 + (y - ty) ** 2 <= r * r) this.seenT[y * MW + x] = 1; }
    this.mmDirty = 1;
  }

  // ---------------------------------------------------------------- talk and emotes
  say(who, s, emo, then) { this.lines.push({ who, s, emo, then }); }
  bark(o, s, t = 1.8) { if (o) o.bark = { s, t }; }
  emote(o, name, secs = 1.5) {
    if (!o) return;
    if (o.actor) { o.emq = [[name, secs]]; if (CS.animations[o.actor.a.action]?.emote) o.actor.a.revive(); }
    else o.icon = { s: ICON[name] || '!', t: secs, name };
  }
  act(o, vx, vy, dt) {
    const a = o.actor, moving = Math.abs(vx) + Math.abs(vy) > 1;
    if (moving) { if (o.emq.length || CS.animations[a.a.action]?.emote) { o.emq = []; if (CS.animations[a.a.action]?.emote) a.a.revive(); } }
    else if (o.emq.length && !a.a.action) { const [n, s] = o.emq.shift(); a.emote(n, s); }
    return a.update(dt, { vx, vy, lowHealth: !moving && (o === this.hero ? o.hp <= 1 : !!o.kneel) });
  }
  stepLines(dt) {
    const h = this.hero;
    if (!this.line && this.lines.length) {
      const l = this.line = this.lines.shift(); l.t = 0; l.dur = 1.3 + l.s.length * 0.045;
      if (l.emo) this.emote(l.who, l.emo, Math.min(2.4, l.dur));
      if (l.who !== h && l.who.actor) l.who.actor.face(dirOf(h.x - l.who.x, h.y - l.who.y, 'four'));
      if (l.who !== h && dist(l.who, h) < 140 && !h.ko) h.actor.face(dirOf(l.who.x - h.x, l.who.y - h.y));
    }
    if (this.line && (this.line.t += dt) >= this.line.dur) { const f = this.line.then; this.line = null; f?.(); }
  }
  startIntro() {
    const m = this.m;
    m.intro.forEach(([who, s, e], i) => this.say(who, s, e, i === m.intro.length - 1 ? () => { this.started = true; } : null));
  }

  // ---------------------------------------------------------------- movement
  findPath(sx, sy, gx, gy, adj, gates = true) {
    const N = MW * MH, G = this._g ||= new Float32Array(N), from = this._f ||= new Int32Array(N), st = this._s ||= new Uint8Array(N);
    G.fill(1e9); st.fill(0);
    const s = sy * MW + sx, goal = gy * MW + gx;
    const isGoal = (i) => { if (!adj) return i === goal; const dx = Math.abs(i % MW - gx), dy = Math.abs((i / MW | 0) - gy); return i !== goal && (adj === 1 ? dx + dy === 1 : Math.max(dx, dy) === 1); };
    const hf = (i) => { const dx = Math.abs(i % MW - gx), dy = Math.abs((i / MW | 0) - gy); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    G[s] = 0; st[s] = 1; const open = [s];
    while (open.length) {
      let bi = 0, bf = 1e9;
      for (let k = 0; k < open.length; k++) { const f = G[open[k]] + hf(open[k]); if (f < bf) { bf = f; bi = k; } }
      const i = open[bi]; open[bi] = open[open.length - 1]; open.pop(); st[i] = 2;
      if (isGoal(i)) { const out = []; for (let j = i; j !== s; j = from[j]) out.push(j); return out.reverse(); }
      const x = i % MW, y = i / MW | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= MW || Y >= MH) continue;
        const j = Y * MW + X; if (st[j] === 2 || !this.ok(j, gates)) continue;
        if (dx && dy && (!this.ok(y * MW + X, gates) || !this.ok(Y * MW + x, gates))) continue;
        const c = G[i] + (dx && dy ? 1.414 : 1) + (this.hz.has(j) ? 2.5 : 0);
        if (c < G[j]) { G[j] = c; from[j] = i; if (st[j] !== 1) { st[j] = 1; open.push(j); } }
      }
    }
    return null;
  }
  los(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 4);
    for (let s = 1; s <= n; s++) {
      const x = a[0] + ((b[0] - a[0]) * s) / n, y = a[1] + ((b[1] - a[1]) * s) / n - 5;
      for (const [ox, oy] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) { const i = Math.floor((y + oy) / T) * MW + Math.floor((x + ox) / T); if (!this.ok(i) || this.hz.has(i)) return false; }
    }
    return true;
  }
  smooth(p) {
    const pts = p.map((i) => [px(i % MW), py(i / MW | 0)]), out = [];
    let cur = [this.hero.x, this.hero.y], k = 0;
    while (k < pts.length) { let j = k; while (j + 1 < pts.length && this.los(cur, pts[j + 1])) j++; out.push(pts[j]); cur = pts[j]; k = j + 1; }
    return out;
  }
  goTo(o) {
    const h = this.hero, s = this.tIdx(h.x, h.y), sx = s % MW, sy = s / MW | 0;
    const t = o.tx !== undefined && o.kind !== 'npc' ? o.ty * MW + o.tx : this.tIdx(o.x, o.y), tx = t % MW, ty = t / MW | 0;
    const solid = o.kind !== 'plate' && o.kind !== 'item';
    const p = solid ? this.findPath(sx, sy, tx, ty, 1) || this.findPath(sx, sy, tx, ty, 2) : this.findPath(sx, sy, tx, ty, 0);
    if (!p) return false;
    h.path = this.smooth(p); h.target = o; return true;
  }
  creep(o, X, Y, sp, dt, gates = true) {
    const dx = X - o.x, dy = Y - o.y, d = Math.hypot(dx, dy);
    if (d < 1.5) return true;
    const s = Math.min(d, sp * dt), nx = o.x + (dx / d) * s, ny = o.y + (dy / d) * s;
    if (this.ok(this.tIdx(nx, ny), gates)) { o.x = nx; o.y = ny; } else if (this.ok(this.tIdx(nx, o.y), gates)) o.x = nx; else if (this.ok(this.tIdx(o.x, ny), gates)) o.y = ny;
    o.mv = sp; if (Math.abs(dx) > 1) o.face = dx > 0 ? 1 : -1; o.wph += s / 6;
    return false;
  }
  follow(o, dt) {
    const h = this.hero, tr = this.trail;
    if (dist(o, h) > 220) { o.x = h.x; o.y = h.y + 2; return; }
    let tg = null, acc = 0;
    for (let k = tr.length - 1; k > 0; k--) { acc += Math.hypot(tr[k].x - tr[k - 1].x, tr[k].y - tr[k - 1].y); if (acc >= 26) { tg = tr[k - 1]; break; } }
    if (!tg || dist(o, h) < 24) return;
    const d = dist(o, tg); if (d > 2) this.creep(o, tg.x, tg.y, Math.min(130, 40 + d * 4), dt, false);
  }
  hazardAhead(h, wp) {
    const dx = wp[0] - h.x, dy = wp[1] - h.y, d = Math.hypot(dx, dy) || 1, la = Math.min(d, 20);
    const i = this.tIdx(h.x + (dx / d) * la, h.y + (dy / d) * la);
    if (i === this.tIdx(h.x, h.y)) return false;
    const z = this.hz.get(i); if (!z) return false;
    const m = (this.t + z.ph) % z.per; return m < z.on + 0.05 || m > z.per - 0.75;
  }
  hurtHero(src) {
    const h = this.hero; if (h.invT > 0 || h.ko > 0 || this.ending) return;
    h.hp--; h.invT = 1.1; h.actor.hurt();
    const d = Math.hypot(h.x - src.x, h.y - src.y) || 1; h.kb = [((h.x - src.x) / d) * 150, ((h.y - src.y) / d) * 150];
    h.path = []; this.shake = 0.2; this.fxBurst(h.x, h.y - 14, '#ff5a4a', 10, 90);
    if (h.hp <= 0) { h.ko = 2.6; h.actor.ko(); h.target = null; this.task = null; this.bark(h, 'Oof…', 1.5); }
  }
  respawn() {
    const h = this.hero; h.x = this.home.x; h.y = this.home.y; h.hp = h.max; h.kb = null; h.path = []; h.actor.revive(); h.invT = 1.5;
    if (this.follower) { this.follower.x = h.x; this.follower.y = h.y + 3; }
    for (const f of this.creatures) if (f.kind === 'foe') { f.state = 'home'; f.hp = Math.max(f.hp, 1); }
    this.trail = []; this.bark(h, 'Back at camp. Once more!', 2.2);
  }
  landHit() {
    const h = this.hero;
    for (const f of this.creatures) {
      if (f.kind !== 'foe' || f.dead) continue;
      const d = dist(f, h); if (d > 32 + (f.boss ? 14 : 0)) continue;
      f.hp -= this.mods.glass ? 3 : 1; f.hurtT = 0.3; f.atkT = 0; f.state = 'chase';
      const k = f.boss ? 60 : 160; f.kb = [((f.x - h.x) / (d || 1)) * k, ((f.y - h.y) / (d || 1)) * k];
      this.fxBurst(f.x, f.y - 10, '#fff2c0', 8, 120, { add: 1 }); this.shake = Math.max(this.shake, 0.08);
      if (f.hp <= 0) { f.dead = true; f.deadT = 0; this.score += f.boss ? 200 : 40; this.fxBurst(f.x, f.y - 10, f.cr.palette?.glow || '#c8f0ff', 22, 140, { add: 1 }); if (f.boss) this.shake = 0.35; }
    }
  }
  fxBurst(x, y, col, n = 10, sp = 100, o = {}) {
    for (let i = 0; i < n; i++) { const a = this.r(0, 7), s = this.r(sp * 0.3, sp); this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.3, life: this.r(0.4, 0.9), max: 0.9, col, r: this.r(1, 2.6), g: o.g ?? 160, add: o.add }); }
    if (this.fx.length > 320) this.fx.splice(0, this.fx.length - 320);
  }

  // ---------------------------------------------------------------- autopilot and input
  autopilot(dt) {
    const h = this.hero;
    if (this.card > 0 || this.ending || this.line || this.lines.length || h.ko > 0 || this.task || !this.started) return;
    if ((this.apT -= dt) > 0) return;
    this.apT = 0.3;
    let f = null, fd = 100;
    for (const o of this.creatures) if (o.kind === 'foe' && !o.dead && (o.state === 'chase' || o.atkT > 0)) { const d = dist(o, h); if (d < fd) { fd = d; f = o; } }
    if (f) { if (h.target !== f) this.goTo(f) || (h.target = f); return; }
    const tg = this.m.steps[this.m.cur]?.tg();
    if (!tg) return;
    if (h.target === tg && (h.path.length || dist(h, tg) < 40)) {
      const e = h.path[h.path.length - 1];
      if (e && (tg.cr || tg.kind === 'npc') && Math.hypot(e[0] - tg.x, e[1] - tg.y) > 40) this.goTo(tg);
      return;
    }
    if (!this.goTo(tg) && tg.kind === 'thief') h.target = null;
  }
  down(x, y) {
    if (this.card > 0.4) { this.card = 0.4; return; }
    if (this.ending) { if (this.ending.t > 2 && !this.line && !this.lines.length) this.ending.t = Math.max(this.ending.t, 7.2); return; }
    if (this.line) { if (this.line.t > 0.3) this.line.t = this.line.dur; return; }
    if (this.lines.length || this.task || this.hero.ko > 0) return;
    const wx = x + this.cam.x, wy = y + this.cam.y, h = this.hero;
    let best = null, bd = 22;
    for (const o of [...this.npcs, ...this.creatures.filter((c) => !c.dead), ...this.objs.filter((o) => !(o.kind === 'gate' && o.open) && !o.taken)]) {
      const d = Math.hypot(o.x - wx, o.y - 12 - wy); if (d < bd) { bd = d; best = o; }
    }
    if (best) {
      if (best.kind === 'critter') { this.emote(best, 'love', 1.4); return; }
      if (!this.goTo(best)) this.bark(h, 'I can’t get there yet.');
      return;
    }
    const s = this.tIdx(h.x, h.y), tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!this.ok((ty + dy) * MW + tx + dx)) continue;
      const p = this.findPath(s % MW, s / MW | 0, tx + dx, ty + dy, 0);
      if (p) { h.path = this.smooth(p); h.target = null; this.tapMark = { x: px(tx + dx), y: py(ty + dy), t: 0.6 }; return; }
    }
    this.bark(h, 'Can’t walk there.', 1);
  }

  // ---------------------------------------------------------------- simulation
  step(dt) {
    const P = this.place, h = this.hero;
    if (this.irisIn > 0) this.irisIn -= dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.flash && (this.flash.t -= dt) <= 0) this.flash = null;
    if (this.tapMark && (this.tapMark.t -= dt) <= 0) this.tapMark = null;
    if (this.card > 0) { this.card -= dt; if (this.card <= 0) this.startIntro(); }
    this.stepLines(dt);
    if (this.ending) this.stepEnding(dt);
    else if (this.started) this.stepMission();
    this.stepHero(dt);
    for (const n of this.npcs) this.stepNPC(n, dt);
    for (const c of this.creatures) this.stepCreature(c, dt);
    this.creatures = this.creatures.filter((c) => !(c.dead && c.deadT > 1));
    for (const o of this.objs) {
      if (o.kind === 'gate') { if (o.open) o.openT += dt; else if (o.lock === 'foes' && o.group.every((f) => f.dead)) this.openGate(o); }
      else if (o.kind === 'plate' && !o.on && (dist(o, h) < 12 || (this.follower && dist(o, this.follower) < 12))) {
        o.on = true; this.fxBurst(o.x, o.y - 4, '#d8c8a8', 8, 50); this.bark(h, 'Click!', 0.8);
        if (this.objs.filter((p) => p.kind === 'plate' && p.gate === o.gate).every((p) => p.on)) this.openGate(o.gate);
      } else if (o.kind === 'item' && !o.taken && dist(o, h) < 16 && !h.ko) this.pickUp(o);
    }
    for (const o of [h, ...this.npcs, ...this.creatures]) if (o.bark && (o.bark.t -= dt) <= 0) o.bark = null;
    for (const o of this.creatures) if (o.icon && (o.icon.t -= dt) <= 0) o.icon = null;
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1);
    for (const p of this.fx) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.life -= dt; }
    this.fx = this.fx.filter((p) => p.life > 0);
    for (const p of this.prints) p.t += dt;
    this.prints = this.prints.filter((p) => p.t < 7);
    this.stepAmb(dt);
    this.darkNow += (this.darkGoal - this.darkNow) * Math.min(1, dt * 0.8);
    if (this.minimap) { const k = this.tIdx(h.x, h.y); if (k !== this.lastT) { this.lastT = k; this.reveal(h, 3); } }
    for (const c of this.cshade) { c.x += 9 * dt; if (c.x > MW * T + c.r) c.x = -c.r; }
    // camera
    const cx = Math.max(0, Math.min(MW * T - W, h.x - W / 2)), cy = Math.max(-40, Math.min(MH * T - H + 34, h.y - H / 2 - 6)), k = Math.min(1, dt * 4);
    this.cam.x += (cx - this.cam.x) * k; this.cam.y += (cy - this.cam.y) * k;
    // re-bake once the theme's texture photos have loaded
    if (!this.texOK && ready(this.skin.texFor?.(this.n + 2)) && (this.rebakeT = (this.rebakeT || 0) + dt) > 0.5) this.bake();
  }
  stepMission() {
    const m = this.m;
    while (m.cur < m.steps.length && m.steps[m.cur].done()) {
      const st = m.steps[m.cur]; m.cur++; this.score += 100;
      this.flash = { s: `✓ ${typeof st.s === 'function' ? st.s() : st.s}`, t: 2.4 };
    }
    if (m.cur >= m.steps.length && !this.line && !this.lines.length && !this.task) this.finish();
  }
  finish() {
    const h = this.hero, e = this.ending = { t: 0, fw: 0.4, bonus: 500 + h.hp * 50 };
    this.score += e.bonus; h.path = []; h.target = null;
    this.m.fin?.();
    this.emote(h, 'cheer', 2.4);
    for (const n of this.npcs) if (!n.grumpy) this.emote(n, 'cheer', 2);
    this.burst(W / 2, H / 2 - 40, this.col(0), 30, 220);
    e.next = PLACES[this.pOrder[this.n % PLACES.length]].names[(this.post.seed + this.n + 1) % 3];
  }
  stepEnding(dt) {
    const e = this.ending, h = this.hero; e.t += dt;
    if (e.t < 4 && (e.fw -= dt) <= 0) {
      e.fw = 0.45;
      this.fxBurst(h.x + this.r(-110, 110), h.y - this.r(50, 130), this.col(this.ri(0, 5)), 28, 120, { add: 1, g: 40 });
      if (this.rng() < 0.4) this.burst(this.r(40, W - 40), this.r(60, 160), this.col(this.ri(0, 5)), 16, 160);
    }
    if (e.t > 7.2 && !this.line && !this.lines.length) {
      this.irisOut += dt;
      if (this.irisOut > 0.7) { this.irisOut = 0; this.newExpedition(); }
    }
  }
  stepHero(dt) {
    const h = this.hero, A = h.actor; let vx = 0, vy = 0;
    h.invT -= dt;
    if (h.kb) {
      const nx = h.x + h.kb[0] * dt, ny = h.y + h.kb[1] * dt; if (this.ok(this.tIdx(nx, ny))) { h.x = nx; h.y = ny; }
      h.kb[0] *= 0.86; h.kb[1] *= 0.86; if (Math.abs(h.kb[0]) + Math.abs(h.kb[1]) < 5) h.kb = null;
    }
    if (h.ko > 0) { h.ko -= dt; if (h.ko <= 0) this.respawn(); }
    else {
      if (this.task) this.stepTask(dt);
      const frozen = this.card > 0 || this.line || this.lines.length || this.task || this.ending;
      if (!frozen && !A.locked && h.path.length) {
        const wp = h.path[0], dx = wp[0] - h.x, dy = wp[1] - h.y, d = Math.hypot(dx, dy);
        if (!this.hazardAhead(h, wp)) {
          const sp = h.path.length > 1 || d > 50 ? 92 : 64, st = Math.min(d, sp * dt);
          if (d > 0.01) { h.x += (dx / d) * st; h.y += (dy / d) * st; vx = (dx / d) * sp; vy = (dy / d) * sp; }
          if (d <= sp * dt + 0.01) h.path.shift();
        }
      }
      if (!frozen && h.target) this.reach(h);
      if (!frozen && !A.locked && !h.path.length && !h.target) {
        const f = this.creatures.find((o) => o.kind === 'foe' && !o.dead && o.state === 'chase' && dist(o, h) < 26);
        if (f) { A.face(dirOf(f.x - h.x, f.y - h.y)); A.attack(); }
      }
    }
    const z = this.hz.get(this.tIdx(h.x, h.y));
    if (z && this.hzOn(z) === 2 && h.invT <= 0 && h.ko <= 0) { const p = this.trail[this.trail.length - 3] || this.home; this.hurtHero({ x: h.x + (h.x - p.x) * 2 + 0.1, y: h.y + (h.y - p.y) * 2 }); }
    for (const e of this.act(h, vx, vy, dt)) { if (e === 'hit') this.landHit(); else if (e === 'footstep') this.footstep(h, Math.hypot(vx, vy)); }
    const lt = this.trail[this.trail.length - 1];
    if (!lt || Math.hypot(lt.x - h.x, lt.y - h.y) > 6) { this.trail.push({ x: h.x, y: h.y }); if (this.trail.length > 80) this.trail.shift(); }
  }
  reach(h) {
    const o = h.target;
    if (o.dead || o.taken || (o.kind === 'gate' && o.open) || (o.kind === 'thief' && o.caught)) { h.target = null; return; }
    const d = dist(h, o);
    if (o.kind === 'foe') {
      if (d < 28 + (o.boss ? 12 : 0)) { h.path = []; if (!h.actor.locked) { h.actor.face(dirOf(o.x - h.x, o.y - h.y)); h.actor.attack(); } }
      else if (!h.path.length || this.t - (h.rpt || 0) > 0.4) { h.rpt = this.t; if (this.los([h.x, h.y], [o.x, o.y])) h.path = [[o.x, o.y]]; else if (!this.goTo(o)) h.target = null; else h.target = o; }
      return;
    }
    if (h.path.length) {
      if ((o.cr || o.kind === 'npc') && this.t - (h.rpt || 0) > 0.5) { h.rpt = this.t; const e = h.path[h.path.length - 1]; if (Math.hypot(e[0] - o.x, e[1] - o.y) > 36) this.goTo(o); }
      return;
    }
    if (d < (o.kind === 'plate' ? 10 : 40)) {
      h.target = null; h.tries = 0;
      h.actor.face(dirOf(o.x - h.x, o.y - h.y));
      if (o.kind === 'npc') { o.actor.face(dirOf(h.x - o.x, h.y - o.y, 'four')); if (o.talk) o.talk(o); }
      else o.use?.(o);
      this.apT = Math.max(this.apT, 0.5);
    } else if ((h.tries = (h.tries || 0) + 1) > 3 || !this.goTo(o)) { h.target = null; h.tries = 0; }
  }
  footstep(h, sp) {
    const P = this.place;
    if (P.pat === 'snow' || P.pat === 'sand') { this.prints.push({ x: h.x + (this.prints.length % 2 ? 2 : -2), y: h.y, t: 0 }); if (this.prints.length > 50) this.prints.shift(); }
    else if (sp > 80) this.fx.push({ x: h.x, y: h.y - 1, vx: this.r(-10, 10), vy: -8, life: 0.5, max: 0.5, col: 'rgba(200,190,170,.5)', r: 2, g: -10 });
  }
  stepNPC(n, dt) {
    const h = this.hero, ox = n.x, oy = n.y;
    if (n.path?.length) { const [wx, wy] = n.path[0]; if (this.creep(n, wx, wy, 60, dt, true)) n.path.shift(); }
    else if (this.follower === n) this.follow(n, dt);
    else if (!this.line || this.line.who !== n) {
      const d = dist(n, h);
      if (d < 84 && this.card <= 0) {
        if (!n.greeted) { n.greeted = 1; n.actor.face(dirOf(h.x - n.x, h.y - n.y, 'four')); if (!n.kneel && this.started) this.emote(n, n.grumpy ? 'angry' : 'wave', 1.2); if (n.barkNear && this.started) this.bark(n, n.barkNear, 2.4); }
        else if ((n.lt = (n.lt || 0) - dt) <= 0) { n.lt = 0.5; n.actor.face(dirOf(h.x - n.x, h.y - n.y, 'four')); }
      } else if ((n.ft = (n.ft ?? this.r(2, 5)) - dt) <= 0) { n.ft = this.r(3, 7); if (!n.kneel) this.emote(n, this.pickA(n.grumpy ? ['angry', 'shake'] : ['think', 'laugh', 'nod']), 1.2); }
    }
    this.act(n, (n.x - ox) / dt, (n.y - oy) / dt, dt);
  }
  stepCreature(o, dt) {
    o.mv = 0; o.hurtT -= dt;
    if (o.dead) { o.deadT += dt; return; }
    if (o.kb) { const nx = o.x + o.kb[0] * dt, ny = o.y + o.kb[1] * dt; if (this.ok(this.tIdx(nx, ny))) { o.x = nx; o.y = ny; } o.kb[0] *= 0.85; o.kb[1] *= 0.85; if (Math.abs(o.kb[0]) + Math.abs(o.kb[1]) < 5) o.kb = null; }
    const h = this.hero, d = dist(o, h), live = h.ko <= 0 && this.card <= 0 && !this.ending && this.started;
    if (o.kind === 'foe') {
      o.cd -= dt;
      if (o.atkT > 0) { const pt = o.atkT; o.atkT -= dt; if (pt > 0.45 && o.atkT <= 0.45 && d < 20 + o.sc * 6 && live) this.hurtHero(o); return; }
      if (o.state === 'chase') {
        if (!live || d > 7 * T || dist(o, o.home) > o.leash + 2 * T) o.state = 'home';
        else if (d < 14 + o.sc * 5) { if (o.cd <= 0) { o.atkT = 0.8; o.cd = 1.5; o.face = h.x > o.x ? 1 : -1; } }
        else this.creep(o, h.x, h.y, o.boss ? 34 : 44, dt);
      } else if (o.state === 'home') {
        if (this.creep(o, o.home.x, o.home.y, 40, dt)) o.state = 'idle';
        if (live && d < 2.2 * T) o.state = 'chase';
      } else {
        if (live && d < (o.boss ? 3.6 : 3) * T) { o.state = 'chase'; this.emote(o, 'angry', 1); }
        else this.wander(o, dt, 14, 22);
      }
    } else if (o.kind === 'critter') {
      if (d < 44 && h.ko <= 0) { if (!o.fled) { o.fled = 1; this.emote(o, 'surprise', 0.8); } const k = 30 / (d || 1); this.creep(o, o.x + (o.x - h.x) * k, o.y + (o.y - h.y) * k, 70, dt); }
      else { o.fled = 0; this.wander(o, dt, 22, 44, true); }
    } else if (o.kind === 'spirit') {
      if (o.ascend) { o.ascend += dt; o.y -= 18 * dt; }
      else if (this.follower === o) this.follow(o, dt);
      else if ((o.wt -= dt) <= 0) { o.wt = this.r(2, 4); this.emote(o, 'think', 1.2); }
    } else if (o.kind === 'thief') {
      if (o.path.length) { const [wx, wy] = o.path[0]; if (this.creep(o, wx, wy, o.speed, dt, false)) o.path.shift(); }
      else if (this.started && !o.caught && o.stage < 2 && (o.stage < 0 || d < 80)) {
        o.stage++;
        const s = o.hides[o.stage] || { tx: Math.floor(o.x / T), ty: Math.floor((o.y - 5) / T) }, a = this.tIdx(o.x, o.y), p = this.findPath(a % MW, a / MW | 0, s.tx, s.ty, 0, false);
        o.path = p ? p.map((i) => [px(i % MW), py(i / MW | 0)]) : [[px(s.tx), py(s.ty)]];
        this.bark(o, o.stage === 2 ? 'Can’t catch me!' : 'Hee hee!', 1.4); this.emote(o, 'laugh', 1);
      } else if (o.stage >= 2 && !o.caught && d < 64 && !o.cornered) { o.cornered = 1; this.emote(o, 'surprise', 1.5); this.bark(o, 'Eep! Cornered!', 1.6); }
    }
  }
  wander(o, dt, sp, rad, chat) {
    if ((o.wt -= dt) <= 0) {
      o.wt = this.r(1.5, 4); o.goal = { x: o.home.x + this.r(-rad, rad), y: o.home.y + this.r(-rad * 0.7, rad * 0.7) };
      if (chat && this.rng() < 0.3) this.emote(o, this.rng() < 0.5 ? 'love' : 'laugh', 1.2);
    }
    if (o.goal && this.creep(o, o.goal.x, o.goal.y, sp, dt)) o.goal = null;
  }
  stepAmb(dt) {
    const k = this.place.fx, A = this.amb, cam = this.cam;
    const want = { wisp: 9, firefly: 24, dust: 18, snow: 60, bubble: 18, steam: 8, spark: 22, ember: 30, leaf: 14 }[k] || 0;
    while (A.length < want) {
      const p = { k, x: cam.x + this.r(-20, W + 20), y: cam.y + this.r(-20, H + 20), vx: 0, vy: 0, life: this.r(3, 8), max: 8, ph: this.r(0, 7), s: this.r(0.6, 1.4) };
      if (k === 'snow') { p.vy = this.r(16, 34); p.vx = this.r(4, 14); if (this.t > 1) p.y = cam.y - 10; p.life = 20; }
      else if (k === 'ember') { const v = this.voidTiles?.length ? this.voidTiles[this.ri(0, this.voidTiles.length - 1)] : -1; if (v >= 0 && this.rng() < 0.7) { p.x = px(v % MW) + this.r(-10, 10); p.y = (v / MW | 0) * T + this.r(0, T); } p.vy = this.r(-34, -14); p.life = this.r(1.5, 3.5); }
      else if (k === 'bubble') { p.vy = this.r(-16, -6); }
      else if (k === 'leaf') { p.vx = this.r(14, 30); p.vy = this.r(4, 12); p.life = 10; }
      else if (k === 'steam') { p.vy = -12; p.life = this.r(1.5, 3); }
      p.max = p.life; A.push(p);
    }
    for (const p of A) {
      p.life -= dt; p.ph += dt;
      if (k === 'firefly' || k === 'wisp' || k === 'dust' || k === 'spark') { p.vx += Math.sin(p.ph * 1.3) * 8 * dt; p.vy += Math.cos(p.ph * 1.1) * 8 * dt; }
      if (k === 'snow' || k === 'leaf') p.x += Math.sin(p.ph * 2) * 10 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > cam.y + H + 20 || p.x > cam.x + W + 40 || p.x < cam.x - 40 || p.y < cam.y - 60) p.life = 0;
    }
    this.amb = A.filter((p) => p.life > 0);
  }

  // ---------------------------------------------------------------- pre-rendered map
  bake() {
    const P = this.place, map = this.map, R = mulberry32(this.post.seed * 7 + this.n * 77), Wd = MW * T, Ht = MH * T;
    const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH ? VOID : map[ty * MW + tx]);
    const land = (v) => v !== VOID;
    const g = mk(Wd, Ht), x = g.getContext('2d');
    const fp = x.createPattern(patTile(P.pat, P.fl[0], P.fl[1], R), 'repeat'), rp = x.createPattern(patTile(P.rugPat, P.rug[0], P.rug[1], R), 'repeat');
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const v = at(tx, ty); if (v === FLOOR || v === WALL) { x.fillStyle = fp; x.fillRect(tx * T, ty * T, T, T); } else if (v === RUG) { x.fillStyle = rp; x.fillRect(tx * T, ty * T, T, T); }
    }
    // soft blotches and the theme's photo texture, on the ground only
    const lo = mk(MW, MH), lx = lo.getContext('2d');
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { lx.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * 0.2})` : `rgba(255,255,255,${R() * 0.09})`; lx.fillRect(tx, ty, 1, 1); }
    x.save(); x.globalCompositeOperation = 'source-atop'; x.imageSmoothingEnabled = true; x.drawImage(lo, 0, 0, Wd, Ht);
    const tex = this.skin.texFor?.(this.n + 2); this.texOK = !tex || ready(tex);
    if (tex && ready(tex)) { x.globalAlpha = 0.13; x.fillStyle = x.createPattern(tex, 'repeat'); x.fillRect(0, 0, Wd, Ht); x.globalAlpha = 1; }
    x.restore();
    // bridges
    const wood = P.id === 'tower' ? ['#5a5a62', '#74747e'] : P.id === 'library' ? ['#8a8578', '#a8a290'] : ['#6e4c2c', '#8a6238'];
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      if (at(tx, ty) !== BRIDGE) continue;
      const X = tx * T, Y = ty * T, hor = this.bdir[ty * MW + tx] === 1;
      x.fillStyle = 'rgba(0,0,0,.3)'; if (hor) x.fillRect(X, Y + T - 2, T, 6); else x.fillRect(X + 4, Y, T - 6, T + 4);
      if (hor) { for (let k = 0; k < 6; k++) Rc(x, X + k * 4, Y + 5, 3, 15, k % 2 ? wood[0] : wood[1]); Rc(x, X, Y + 3, T, 1, '#c8b088'); Rc(x, X, Y + 20, T, 1, '#8a7050'); Rc(x, X, Y + 1, 2, 4, '#4a3420'); }
      else { for (let k = 0; k < 6; k++) Rc(x, X + 4, Y + k * 4, 16, 3, k % 2 ? wood[0] : wood[1]); Rc(x, X + 3, Y, 1, T, '#c8b088'); Rc(x, X + 20, Y, 1, T, '#8a7050'); }
    }
    // cliff faces under the land's southern edges, shores and rims
    const ch = { water: 5, lava: 9, sky: 20, chasm: 20, gears: 10, dark: 0 }[P.void];
    this.voidTiles = [];
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const v = at(tx, ty), X = tx * T, Y = ty * T;
      if (v === VOID) {
        this.voidTiles.push(ty * MW + tx);
        const up = at(tx, ty - 1);
        if (ch && (up === FLOOR || up === RUG || up === WALL)) {
          const gr = x.createLinearGradient(0, Y, 0, Y + ch);
          gr.addColorStop(0, sh(P.cliff, 1.1)); gr.addColorStop(0.6, sh(P.cliff, 0.7)); gr.addColorStop(1, P.void === 'sky' || P.void === 'chasm' ? sh(P.cliff, 0.5, 0) : sh(P.cliff, 0.45));
          x.fillStyle = gr; x.fillRect(X, Y, T, ch);
          for (let k = 0; k < 3; k++) Rc(x, X + R() * 18, Y + 3 + R() * (ch - 5), 3 + R() * 6, 1, sh(P.cliff, 0.55, 0.8));
          if (P.void === 'water') Rc(x, X, Y + ch, T, 1, 'rgba(255,255,255,.28)');
          if (P.void === 'lava') Rc(x, X, Y + ch - 1, T, 2, '#ffb040');
          if (P.void === 'gears') for (let k = 0; k < 6; k++) Rc(x, X + k * 4, Y, 2, 3, k % 2 ? '#e8b830' : '#2a2a2a');
          if (P.void === 'sky' && R() < 0.5) { x.strokeStyle = sh(P.leaf, 0.6, 0.8); x.beginPath(); const a = X + 4 + R() * 16; x.moveTo(a, Y); x.lineTo(a + 1, Y + ch + 6 * R()); x.stroke(); }
        }
        if (P.deco.includes('lily') && R() < 0.3 && [at(tx - 1, ty), at(tx + 1, ty), at(tx, ty - 1), at(tx, ty + 1)].some((u) => u === FLOOR)) {
          const a = X + 6 + R() * 12, b = Y + 8 + R() * 10; E(x, a, b, 4, 2.6, '#3f7a3a'); E(x, a - 1, b - 0.5, 3, 1.8, '#5a9a4a'); if (R() < 0.4) E(x, a + 1, b - 1, 1.4, 1.2, '#f0a0c0');
        }
        continue;
      }
      if (v !== FLOOR && v !== RUG) continue;
      const nn = at(tx, ty - 1), ss = at(tx, ty + 1), ww = at(tx - 1, ty), ee = at(tx + 1, ty);
      if (!land(nn)) Rc(x, X, Y, T, 1, 'rgba(0,0,0,.35)');
      if (!land(ss)) Rc(x, X, Y + T - 2, T, 2, 'rgba(255,255,255,.18)');
      if (!land(ww)) Rc(x, X, Y, 1, T, 'rgba(0,0,0,.3)');
      if (!land(ee)) Rc(x, X + T - 1, Y, 1, T, 'rgba(0,0,0,.3)');
      if (P.void === 'water') { if (!land(ss)) Rc(x, X, Y + T - 4, T, 2, 'rgba(20,30,10,.3)'); }
      // ambient occlusion under walls
      if (nn === WALL) { const gr = x.createLinearGradient(0, Y, 0, Y + 9); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(X, Y, T, 9); }
      if (ww === WALL) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(X, Y, 4, T); }
      if (ee === WALL) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(X + T - 4, Y, 4, T); }
      // decals
      if (v === FLOOR && R() < 0.32) this.decal(x, this.pickR(R, P.deco), X + 3 + R() * 16, Y + 4 + R() * 15, R, ww === WALL || nn === WALL);
    }
    this.ground = g;
    // walls: one strip per row so they sort with the characters
    this.wrows = [];
    for (let ty = 0; ty < MH; ty++) {
      let cv = null, wx = null;
      for (let tx = 0; tx < MW; tx++) {
        if (at(tx, ty) !== WALL) continue;
        if (!cv) { cv = mk(Wd, T + WH); wx = cv.getContext('2d'); }
        const X = tx * T;
        Rc(wx, X, 0, T, T, P.wl[0]);
        for (let k = 0; k < 5; k++) Rc(wx, X + R() * 22, R() * 22, 2, 2, sh(P.wl[0], R() < 0.5 ? 0.8 : 1.2));
        if (P.id === 'monastery') Rc(wx, X, 0, T, T * 0.6, 'rgba(240,246,252,.7)');
        if (at(tx, ty - 1) !== WALL) Rc(wx, X, 0, T, 2, sh(P.wl[0], 1.6));
        if (at(tx - 1, ty) !== WALL) Rc(wx, X, 0, 2, T, sh(P.wl[0], 1.35));
        if (at(tx + 1, ty) !== WALL) Rc(wx, X + T - 2, 0, 2, T, sh(P.wl[0], 0.7));
        if (at(tx, ty + 1) !== WALL) this.wallFace(wx, X, T, P, R);
      }
      this.wrows[ty] = cv;
    }
    // static light from lava
    this.lmask = null;
    if (P.void === 'lava') {
      const m = this.lmask = mk(Wd / 4, Ht / 4), mx = m.getContext('2d');
      for (const i of this.voidTiles) { const X = px(i % MW) / 4, Y = ((i / MW | 0) * T + 12) / 4, gr = mx.createRadialGradient(X, Y, 0, X, Y, 12); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); mx.fillStyle = gr; mx.fillRect(X - 12, Y - 12, 24, 24); }
    }
    if (!this.layer || this.layerFor !== P.id) {
      const LR = mulberry32(this.n * 13 + 5);
      this.layer = P.void === 'lava' ? layerCv(LR, 'lava') : layerCv(LR, 'water', P.vc[1]); this.layerFor = P.id; this.layerPat = null;
    }
  }
  pickR(R, a) { return a[Math.floor(R() * a.length)]; }
  wallFace(x, X, Y, P, R) {
    const c = P.wl[1];
    Rc(x, X, Y, T, WH, c);
    switch (P.ws) {
      case 'paper': for (let k = 0; k < 6; k++) Rc(x, X + k * 4 + 1, Y, 1, WH - 5, sh(c, 0.8)); Rc(x, X, Y + WH - 5, T, 5, '#3a2418'); Rc(x, X, Y + WH - 6, T, 1, '#8a6d4d'); break;
      case 'hedge': for (let k = 0; k < 10; k++) E(x, X + R() * T, Y + R() * WH, 2.5, 2, sh(c, 0.7 + R() * 0.6)); break;
      case 'shelf': Rc(x, X, Y, T, WH, '#3b2618'); for (let a = X + 1; a < X + T - 1; a += 3) Rc(x, a, Y + 2 + R() * 2, 2, WH - 5, BOOKS[R() * BOOKS.length | 0]); Rc(x, X, Y + WH - 2, T, 2, '#5a3a22'); break;
      case 'pipes': for (let k = 0; k < 3; k++) { Rc(x, X + 2 + k * 8, Y, 4, WH, '#b08a3a'); Rc(x, X + 2 + k * 8, Y, 1, WH, '#e0c070'); } Rc(x, X, Y + 4, T, 1, '#5a3a1a'); break;
      case 'rock': for (let k = 0; k < 6; k++) E(x, X + R() * T, Y + R() * WH, 3 + R() * 3, 2, sh(c, 0.6 + R() * 0.7)); break;
      default: { const bh = P.ws === 'brick' ? 3 : 5, bw = P.ws === 'brick' ? 6 : 8; for (let r = 0; r * bh < WH; r++) { Rc(x, X, Y + r * bh, T, 1, sh(c, 0.62)); for (let a = (r % 2) * (bw / 2); a < T; a += bw) Rc(x, X + a, Y + r * bh, 1, bh, sh(c, 0.62)); } }
    }
    const gr = x.createLinearGradient(0, Y, 0, Y + WH); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = gr; x.fillRect(X, Y, T, WH);
  }
  decal(x, k, a, b, R, byWall) {
    const P = this.place;
    switch (k) {
      case 'tuft': x.strokeStyle = sh(P.fl[0], 0.65); x.lineWidth = 1; x.beginPath(); for (let i = -1; i <= 1; i++) { x.moveTo(a + i * 2, b + 3); x.lineTo(a + i * 3, b - 1); } x.stroke(); break;
      case 'flower': for (let i = 0; i < 3; i++) { const c = rgb(rgbOf(this.col(this.ri(0, 5)))); E(x, a + i * 3, b + (i % 2) * 2, 1.3, 1.3, c); } break;
      case 'pebble': E(x, a, b, 2, 1.4, 'rgba(0,0,0,.25)'); E(x, a - 0.5, b - 0.5, 1.6, 1.1, 'rgba(255,255,255,.25)'); break;
      case 'crack': x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1; x.beginPath(); x.moveTo(a, b); x.lineTo(a + 3, b + 2); x.lineTo(a + 5, b + 1); x.lineTo(a + 8, b + 4); x.stroke(); break;
      case 'leaf': x.save(); x.translate(a, b); x.rotate(R() * 6); E(x, 0, 0, 2.5, 1.2, R() < 0.5 ? '#b0702a' : sh(P.leaf, 1.2)); x.restore(); break;
      case 'bones': if (R() < 0.4) { Rc(x, a, b, 6, 1.5, '#e8e0cc'); E(x, a, b + 0.7, 1.3, 1.3, '#e8e0cc'); E(x, a + 6, b + 0.7, 1.3, 1.3, '#e8e0cc'); } break;
      case 'books': if (byWall || R() < 0.3) for (let i = 0; i < 3; i++) Rc(x, a + R() * 2, b - i * 2, 7, 2, BOOKS[R() * BOOKS.length | 0]); break;
      case 'puddle': E(x, a, b, 5, 2.5, 'rgba(90,160,200,.3)'); E(x, a - 1, b - 1, 2, 0.8, 'rgba(255,255,255,.3)'); break;
      case 'drift': E(x, a, b, 6, 2.5, 'rgba(255,255,255,.6)'); break;
      case 'bolt': E(x, a, b, 1.2, 1.2, '#9a9a9a'); E(x, a + 5, b + 3, 1.2, 1.2, '#9a9a9a'); break;
    }
  }

  // ---------------------------------------------------------------- drawing
  draw(c) {
    const P = this.place, cam = this.cam, h = this.hero;
    const ox = Math.round(cam.x) - (this.shake > 0 ? Math.round(this.r(-2, 2)) : 0), oy = Math.round(cam.y) - (this.shake > 0 ? Math.round(this.r(-2, 2)) : 0);
    c.imageSmoothingEnabled = false;
    this.drawVoid(c);
    c.save(); c.translate(-ox, -oy);
    const sx = Math.max(0, ox), sy = Math.max(0, oy), sw = Math.min(W + 2, MW * T - sx), shh = Math.min(H + 2, MH * T - sy);
    if (sw > 0 && shh > 0) c.drawImage(this.ground, sx, sy, sw, shh, sx, sy, sw, shh);
    this.drawFlat(c);
    const X0 = cam.x - 50, X1 = cam.x + W + 50, Y0 = cam.y - 20, Y1 = cam.y + H + 70, vis = (o) => o.x > X0 && o.x < X1 && o.y > Y0 && o.y < Y1;
    const L = [];
    for (let ty = Math.max(0, Math.floor(Y0 / T)); ty < Math.min(MH, Math.ceil(Y1 / T) + 1); ty++) if (this.wrows[ty]) L.push({ y: ty * T + T, w: ty });
    for (const p of this.props) if (vis(p)) L.push({ y: p.y, p });
    for (const o of this.objs) if (o.kind !== 'plate' && o.kind !== 'item' && vis(o)) L.push({ y: o.kind === 'gate' ? o.ty * T + T : o.y, o });
    for (const n of this.npcs) if (vis(n)) L.push({ y: n.y, n });
    for (const cr of this.creatures) if (vis(cr)) L.push({ y: cr.y, cr });
    L.push({ y: h.y, n: h });
    L.sort((a, b) => a.y - b.y);
    for (const e of L) {
      if (e.w !== undefined) { const cv = this.wrows[e.w], a = Math.max(0, Math.floor(cam.x) - 2), w = Math.min(W + 6, cv.width - a); c.drawImage(cv, a, 0, w, T + WH, a, e.w * T - WH, w, T + WH); }
      else if (e.p) this.drawProp(c, e.p);
      else if (e.o) this.drawObj(c, e.o);
      else if (e.n) this.drawPerson(c, e.n);
      else this.drawCreature(c, e.cr);
    }
    this.drawAmb(c, false);
    if (P.sun) for (const s of this.cshade) { const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r); g.addColorStop(0, 'rgba(20,20,40,.14)'); g.addColorStop(1, 'rgba(20,20,40,0)'); c.fillStyle = g; c.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); }
    for (const p of this.fx) if (!p.add) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.col; c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
    c.globalAlpha = 1;
    c.restore();
    this.drawLight(c);
    c.save(); c.translate(-ox, -oy); this.drawGlow(c); c.restore();
    if (P.caustic && this.layer) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.07; c.fillStyle = this.layerPat ||= c.createPattern(this.layer, 'repeat'); c.translate(mod(-ox * 0.6 + this.t * 6, 64) - 64, mod(-oy * 0.6 + this.t * 4, 64) - 64); c.fillRect(0, 0, W + 128, H + 128); c.restore(); }
    c.fillStyle = P.tint; c.fillRect(0, 0, W, H);
    c.drawImage(this.vig, 0, 0);
    c.save(); c.translate(-ox, -oy); this.drawTalk(c); c.restore();
    this.drawMarker(c, ox, oy);
    this.drawHud(c);
    if (this.minimap) this.drawMinimap(c);
    if (this.card > 0) this.drawCard(c);
    if (this.ending) this.drawEnd(c);
    const ir = this.irisOut > 0 ? 1 - this.irisOut / 0.7 : this.irisIn > 0 ? 1 - this.irisIn / 0.8 : 1;
    if (ir < 1) { const hx2 = h.x - ox, hy2 = h.y - 14 - oy; c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, W, H); c.arc(hx2, hy2, Math.max(0.1, ir * 420), 0, Math.PI * 2, true); c.fill(); }
  }
  patScroll(c, ox, oy, a) { const n = 64; c.save(); c.globalAlpha = a; c.translate(mod(ox, n) - n, mod(oy, n) - n); c.fillStyle = this.layerPat ||= c.createPattern(this.layer, 'repeat'); c.fillRect(0, 0, W + n * 2, H + n * 2); c.restore(); }
  drawVoid(c) {
    const P = this.place, cx = this.cam.x, cy = this.cam.y, t = this.t;
    switch (P.void) {
      case 'water': case 'lava': {
        c.fillStyle = P.vc[0]; c.fillRect(0, 0, W, H);
        const bg = this.skin.bgSet?.[1] || this.skin.bg;
        if (P.void === 'water' && ready(bg)) { const s = Math.max(W / (bg.naturalWidth || bg.width), H / (bg.naturalHeight || bg.height)) * 1.3; c.globalAlpha = 0.12; c.save(); c.translate(-(cx * 0.2) % 60 - 30, H - (cy * 0.2) % 60 + 30); c.scale(s, -s); c.drawImage(bg, 0, 0); c.restore(); c.globalAlpha = 1; }
        if (P.void === 'lava') { this.patScroll(c, -cx + t * 3, -cy + t * 2, 1); c.globalCompositeOperation = 'lighter'; this.patScroll(c, -cx - t * 5 + 20, -cy + 30, 0.25 + Math.sin(t * 2) * 0.1); c.globalCompositeOperation = 'source-over'; }
        else { this.patScroll(c, -cx + t * 7, -cy + t * 3, 0.5); this.patScroll(c, -cx - t * 5 + 30, -cy - t * 4 + 30, 0.3); }
        break;
      }
      case 'sky': {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, P.vc[0]); g.addColorStop(1, P.vc[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
        const far = this.skin.bgSet?.[1] || this.skin.bgSet?.[0];
        if (ready(far)) { const s = Math.max(W / far.naturalWidth, H / far.naturalHeight) * 1.25; c.globalAlpha = 0.35; c.drawImage(far, -cx * 0.08 - 10, -cy * 0.08 - 10, far.naturalWidth * s, far.naturalHeight * s); c.globalAlpha = 1; }
        c.imageSmoothingEnabled = true;
        for (const k of this.clouds) { const span = MW * T * 0.5 + W + 120, x = mod(k.x - cx * k.f + t * 6 * k.f, span) - 100, y = mod(k.y - cy * k.f, MH * T * 0.5 + H + 60) - 50; c.globalAlpha = k.f > 0.3 ? 0.85 : 0.55; c.drawImage(this.cloud, x, y, 96 * k.s, 46 * k.s); }
        c.globalAlpha = 1; c.imageSmoothingEnabled = false;
        c.fillStyle = 'rgba(40,40,60,.5)';
        for (let k = 0; k < 4; k++) { const x = mod(k * 140 + t * 22 - cx * 0.6, W + 80) - 40, y = mod(k * 97 - cy * 0.6, H) + Math.sin(t * 3 + k) * 3, w = Math.sin(t * 8 + k) * 2; c.fillRect(x - 3, y + w, 3, 1); c.fillRect(x, y, 3, 1); }
        break;
      }
      case 'chasm': {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, P.vc[1]); g.addColorStop(1, P.vc[0]); c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.fillStyle = 'rgba(255,220,170,.18)'; for (let k = 0; k < 40; k++) c.fillRect(mod(k * 53 - cx * 0.55, W), mod(k * 89 - cy * 0.55 + t * 2, H), 1, 1);
        break;
      }
      case 'gears': {
        c.fillStyle = P.vc[0]; c.fillRect(0, 0, W, H);
        for (const gg of this.vgears) { const x = mod(gg.x - cx * 0.5, MW * T * 0.5 + W) - 60, y = mod(gg.y - cy * 0.5, MH * T * 0.5 + H) - 60, s = gg.r / 70; c.save(); c.translate(x, y); c.rotate(t * gg.sp); c.globalAlpha = 0.5; c.drawImage(this.gearImg, -74 * s, -74 * s, 148 * s, 148 * s); c.restore(); }
        c.globalAlpha = 1;
        break;
      }
      default: {
        c.fillStyle = P.vc[0]; c.fillRect(0, 0, W, H);
        for (let k = 0; k < 2; k++) { const x = mod(k * 200 + t * 8 - cx * 0.4, W + 200) - 100, g = c.createRadialGradient(x, H * (0.3 + k * 0.4), 0, x, H * (0.3 + k * 0.4), 120); g.addColorStop(0, 'rgba(90,70,130,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      }
    }
  }
  drawFlat(c) {
    const P = this.place, cam = this.cam;
    for (const p of this.prints) { c.globalAlpha = Math.min(0.35, (7 - p.t) / 7); c.fillStyle = P.pat === 'snow' ? '#8aa0c0' : '#9a7a4a'; c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 2); }
    c.globalAlpha = 1;
    for (const [i, z] of this.hz) {
      const X = (i % MW) * T, Y = (i / MW | 0) * T;
      if (X < cam.x - T || X > cam.x + W || Y < cam.y - T || Y > cam.y + H) continue;
      const st = this.hzOn(z);
      Rc(c, X + 3, Y + 3, T - 6, T - 6, 'rgba(0,0,0,.32)'); Rc(c, X + 3, Y + 3, T - 6, 1, 'rgba(255,255,255,.15)');
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const sx = X + 7 + a * 5, sy = Y + 9 + b * 5;
        Rc(c, sx - 1, sy - 1, 2, 2, st === 1 ? (z.style === 'flame' ? '#ff8a3a' : '#555') : '#111');
        if (z.style === 'spikes' && st) { const u = st === 2 ? 1 : 0.35; Po(c, [[sx - 2, sy], [sx, sy - 7 * u], [sx + 2, sy]], P.id === 'monastery' ? '#cfefff' : '#d8d8e0'); Rc(c, sx, sy - 7 * u, 1, 3 * u, '#fff'); }
      }
    }
    for (const o of this.objs) {
      if (o.kind === 'plate') { const X = o.tx * T, Y = o.ty * T; Rc(c, X + 3, Y + 4, 18, 17, 'rgba(0,0,0,.35)'); Rc(c, X + 4, Y + (o.on ? 6 : 4), 16, 14, o.on ? '#7a8a6a' : '#a8a090'); Rc(c, X + 4, Y + (o.on ? 6 : 4), 16, 2, o.on ? '#9aaa8a' : '#c8c0b0'); if (!o.on) { c.fillStyle = 'rgba(255,230,120,.5)'; c.fillRect(X + 10, Y + 9, 4, 4); } }
      else if (o.kind === 'item' && !o.taken) { E(c, o.x, o.y - 1, 6, 2, 'rgba(0,0,0,.3)'); this.icon(c, o.item, o.x, o.y - 10 + Math.sin(this.t * 3 + o.tx) * 2, 1); }
    }
    if (this.tapMark) { c.strokeStyle = `rgba(255,255,255,${this.tapMark.t})`; c.lineWidth = 1; c.beginPath(); c.ellipse(this.tapMark.x, this.tapMark.y - 2, 10 - this.tapMark.t * 6, 4 - this.tapMark.t * 2, 0, 0, 7); c.stroke(); }
    const tg = this.m.steps[this.m.cur]?.tg();
    if (tg && !this.ending) { const a = 0.35 + Math.sin(this.t * 4) * 0.15; c.strokeStyle = `rgba(255,220,90,${a})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(tg.x, tg.y - 1, 13, 5, 0, 0, 7); c.stroke(); }
  }
  drawProp(c, p) {
    const P = this.place, h = this.hero, X = Math.round(p.x - p.ax), Y = Math.round(p.y - p.ay);
    E(c, p.x + (P.sun ? 4 : 0), p.y - 1, p.cv.width * (P.sun ? 0.42 : 0.34), 3, 'rgba(0,0,0,.28)');
    const behind = p.fade && h.y < p.y - 2 && h.y > p.y - p.cv.height + 4 && Math.abs(h.x - p.x) < p.cv.width / 2 + 3;
    if (behind) c.globalAlpha = 0.45;
    c.drawImage(p.cv, X, Y);
    c.globalAlpha = 1;
    if (p.pend) { const a = Math.sin(this.t * 3) * 0.4, x0 = X + p.pend[0], y0 = Y + p.pend[1]; c.strokeStyle = '#c9a04a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.sin(a) * 10, y0 + Math.cos(a) * 10); c.stroke(); E(c, x0 + Math.sin(a) * 10, y0 + Math.cos(a) * 10, 2, 2, '#e0b85a'); }
    if (p.gear) { const [gx, gy, r] = p.gear; p.gimg ||= gearCv(r, '#a07a3a'); c.save(); c.translate(X + gx, Y + gy); c.rotate(this.t * (p.tx % 2 ? 1 : -1)); c.drawImage(p.gimg, -p.gimg.width / 2, -p.gimg.height / 2); c.restore(); }
    if (p.mill) { c.save(); c.translate(X + p.mill[0], Y + p.mill[1]); c.rotate(this.t * 1.2); for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); Rc(c, -1, 0, 2, 14, '#6a4a2a'); Rc(c, 1, 3, 4, 11, '#efe6d6'); } c.restore(); }
    if (p.steam && this.rng() < 0.02) this.fx.push({ x: X + p.steam[0], y: Y + p.steam[1], vx: this.r(-5, 5), vy: -20, life: 1.2, max: 1.2, col: 'rgba(230,230,230,.45)', r: 3, g: -8 });
    if (p.art) {
      p.img ||= this.skin.list('statues', 4, 'item', 'enemy', 'hero')[this.props.indexOf(p) % 4];
      if (!p.artCv && ready(p.img)) { const cv = mk(22, 28), x = cv.getContext('2d'); drawFit(x, p.img, 11, 14, 22, 28); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(165,155,140,.7)'; x.fillRect(0, 0, 22, 28); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(12, 0, 10, 28); p.artCv = cv; }
      if (p.artCv) c.drawImage(p.artCv, X, Y + 4);
      else { const s = P.stone || '#9a958c'; E(c, X + 11, Y + 12, 4, 4, s); Rc(c, X + 7, Y + 16, 8, 14, sh(s, 0.85)); }
    }
    if (p.goods) { const gl = this.skin.list('goods', 6, 'item'); for (let k = 0; k < 2; k++) drawFit(c, gl[(this.props.indexOf(p) + k) % gl.length], X + 9 + k * 14, Y + 18, 11, 11); }
  }
  drawObj(c, o) {
    const x = Math.round(o.x), y = Math.round(o.y), P = this.place, t = this.t;
    switch (o.kind) {
      case 'chest':
        E(c, x, y - 1, 10, 3, 'rgba(0,0,0,.3)'); Rc(c, x - 8, y - 12, 16, 11, '#6e4426'); Rc(c, x - 8, y - 12, 16, 2, '#8a5a32'); Rc(c, x - 8, y - 7, 16, 1, '#c9a04a');
        if (o.open) { Rc(c, x - 8, y - 20, 16, 6, '#5a361e'); Rc(c, x - 7, y - 14, 14, 3, '#1a0f08'); } else { Rc(c, x - 9, y - 17, 18, 6, '#7e4e2c'); Rc(c, x - 9, y - 17, 18, 1, '#a06a3a'); Rc(c, x - 1, y - 13, 3, 4, '#e8c050'); }
        break;
      case 'lever': {
        Rc(c, x - 7, y - 6, 14, 6, '#6a6458'); Rc(c, x - 7, y - 6, 14, 1, '#9a9488');
        const a = o.on ? 0.7 : -0.7; c.strokeStyle = '#3a3a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + Math.sin(a) * 14, y - 5 - Math.cos(a) * 14); c.stroke();
        E(c, x + Math.sin(a) * 14, y - 5 - Math.cos(a) * 14, 2.6, 2.6, o.on ? '#5ac85a' : '#d84a3a');
        break;
      }
      case 'beacon': case 'brazier': {
        const big = o.big ? 1.4 : o.kind === 'brazier' ? 0.8 : 1, s = P.stone || '#8a8478';
        E(c, x, y - 1, 9 * big, 3, 'rgba(0,0,0,.3)');
        Rc(c, x - 5 * big, y - 24 * big, 10 * big, 24 * big, sh(s, 0.8)); Rc(c, x - 5 * big, y - 24 * big, 3 * big, 24 * big, sh(s, 1.05));
        Rc(c, x - 8 * big, y - 28 * big, 16 * big, 5 * big, sh(s, 0.65)); Rc(c, x - 8 * big, y - 28 * big, 16 * big, 1, sh(s, 1.2));
        if (!o.lit && o.kind === 'beacon') { Rc(c, x - 5 * big, y - 29 * big, 10 * big, 2, '#3a2a22'); }
        break;
      }
      case 'survey':
        E(c, x, y - 1, 9, 3, 'rgba(0,0,0,.3)'); E(c, x, y - 4, 8, 4, '#7a746a'); E(c, x, y - 9, 6, 3.5, '#8a847a'); E(c, x, y - 13, 4, 3, '#9a948a');
        Rc(c, x, y - 32, 1, 20, '#4a3a2a'); Po(c, [[x + 1, y - 32], [x + 11, y - 29 + Math.sin(t * 4) * 1], [x + 1, y - 25]], o.done ? '#5ac85a' : '#e8d8b0');
        break;
      case 'pedestal': {
        const s = P.stone || '#a8a090'; E(c, x, y - 1, 9, 3, 'rgba(0,0,0,.3)'); Rc(c, x - 6, y - 18, 12, 18, sh(s, 0.85)); Rc(c, x - 8, y - 21, 16, 4, sh(s, 1.05)); Rc(c, x - 8, y - 3, 16, 3, sh(s, 0.65));
        if (o.item) this.icon(c, o.item, x, y - 32 + Math.sin(t * 2.5) * 2.5, 1.3);
        break;
      }
      case 'shrine': {
        const s = P.stone || '#9a958c'; E(c, x, y - 1, 14, 4, 'rgba(0,0,0,.3)'); Rc(c, x - 12, y - 6, 24, 6, sh(s, 0.75)); Rc(c, x - 10, y - 28, 4, 22, sh(s, 0.9)); Rc(c, x + 6, y - 28, 4, 22, sh(s, 0.9));
        Po(c, [[x - 15, y - 28], [x, y - 40], [x + 15, y - 28]], '#8a3a2a'); Rc(c, x - 15, y - 29, 30, 2, '#5a2a1a'); Rc(c, x - 6, y - 26, 12, 20, 'rgba(0,0,0,.45)');
        break;
      }
      case 'gate': this.drawGate(c, o); break;
    }
  }
  drawGate(c, g) {
    const X = g.tx * T, Y = g.ty * T, P = this.place, t = this.t;
    const a = g.open ? Math.max(0, 1 - g.openT * 1.8) : 1;
    if (a <= 0 || g.style === 'guard') return;
    c.globalAlpha = a;
    switch (g.style) {
      case 'door': Rc(c, X + 1, Y - WH + 2, T - 2, T + WH - 3, '#3a2414'); for (let k = 0; k < 4; k++) Rc(c, X + 3 + k * 5, Y - WH + 4, 4, T + WH - 6, k % 2 ? '#6e4a2a' : '#7a5230'); Rc(c, X + 2, Y - WH + 8, T - 4, 2, '#3a3a3a'); Rc(c, X + 2, Y + 12, T - 4, 2, '#3a3a3a'); Rc(c, X + 10, Y + 2, 5, 6, '#e8c050'); Rc(c, X + 12, Y + 4, 1, 3, '#3a2a10'); break;
      case 'bars': { const off = g.open ? -g.openT * 30 : 0; for (let k = 0; k < 6; k++) Rc(c, X + 1 + k * 4, Y - WH + off, 2, T + WH - 2, '#4a4a52'); Rc(c, X, Y - WH + 4 + off, T, 2, '#5a5a62'); Rc(c, X, Y + 8 + off, T, 2, '#5a5a62'); break; }
      case 'vines': for (let k = 0; k < 9; k++) { c.strokeStyle = k % 2 ? '#2f5a2c' : '#4a7a32'; c.lineWidth = 2; c.beginPath(); c.moveTo(X + (k * 7) % T, Y - WH); c.quadraticCurveTo(X + ((k * 13) % T), Y, X + ((k * 5 + 7) % T), Y + T - 2); c.stroke(); E(c, X + ((k * 11) % T), Y - 6 + (k * 7) % 22, 1.5, 1.5, '#c84a4a'); } break;
      case 'web': c.strokeStyle = 'rgba(235,235,245,.8)'; c.lineWidth = 1; for (let k = 0; k < 7; k++) { c.beginPath(); c.moveTo(X + T / 2, Y + 2); c.lineTo(X + (k / 6) * T, k % 2 ? Y - WH : Y + T - 2); c.stroke(); } for (let r = 4; r < 20; r += 5) { c.beginPath(); c.ellipse(X + T / 2, Y + 2, r, r * 0.9, 0, 0, 7); c.stroke(); } break;
      case 'ice': Rc(c, X + 1, Y - WH, T - 2, T + WH - 2, 'rgba(170,225,255,.75)'); Rc(c, X + 3, Y - WH + 2, 4, T + WH - 8, 'rgba(255,255,255,.55)'); Po(c, [[X + 12, Y - WH + 3], [X + 20, Y - 2], [X + 16, Y - 2]], 'rgba(255,255,255,.4)'); break;
      case 'barrier': for (let k = 0; k < 5; k++) { c.fillStyle = `rgba(190,140,255,${0.25 + 0.15 * Math.sin(t * 4 + k)})`; c.fillRect(X + 1, Y - WH + k * 7 + Math.sin(t * 3 + k) * 2, T - 2, 5); } c.strokeStyle = 'rgba(230,200,255,.8)'; c.strokeRect(X + 1.5, Y - WH + 0.5, T - 3, T + WH - 2); break;
      case 'broken': Rc(c, X, Y + 3, T, T - 4, P.vc[0]); Rc(c, X, Y + 3, T, 3, 'rgba(0,0,0,.4)'); Rc(c, X + 1, Y + 4, 5, 3, '#6e4c2c'); Rc(c, X + 18, Y + 12, 5, 3, '#6e4c2c'); break;
    }
    c.globalAlpha = 1;
    if (!g.open && g.style !== 'broken') this.lockIcon(c, g, X + T / 2, Y - WH - 8 + Math.sin(t * 3) * 1.5);
  }
  lockIcon(c, g, x, y) {
    c.fillStyle = 'rgba(10,8,12,.7)'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill();
    const k = { key: 'key', lever: 'lever', plates: 'plate', burn: 'flame', foes: 'skull' }[g.lock];
    if (k) this.icon(c, { k }, x, y, 0.7);
  }
  icon(c, it, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    switch (it.k) {
      case 'key': c.strokeStyle = '#f0c850'; c.lineWidth = 2; c.beginPath(); c.arc(-3, 0, 3, 0, 7); c.moveTo(0, 0); c.lineTo(6, 0); c.moveTo(4, 0); c.lineTo(4, 3); c.moveTo(6, 0); c.lineTo(6, 3); c.stroke(); break;
      case 'flame': E(c, 0, 1, 3.5, 5, '#ff7a2a'); E(c, 0, 2, 2, 3, '#ffd27a'); break;
      case 'part': if (this.place.id === 'tower') { E(c, 0, 0, 5, 5, '#b08a3a'); E(c, 0, 0, 2, 2, '#5a4020'); } else { Rc(c, -7, -2, 14, 5, '#8a6238'); Rc(c, -7, -2, 14, 1, '#b08050'); Rc(c, -5, 0, 1, 1, '#333'); Rc(c, 4, 0, 1, 1, '#333'); } break;
      case 'letter': Rc(c, -6, -4, 12, 8, '#f4ecd8'); c.strokeStyle = '#a89878'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -4); c.lineTo(0, 1); c.lineTo(6, -4); c.stroke(); E(c, 0, 1, 1.6, 1.6, '#c83a3a'); break;
      case 'treat': Rc(c, -5, -1, 10, 5, '#a8683a'); E(c, 0, -1, 5, 2.5, '#f0a0c0'); E(c, 0, -4, 1.6, 1.6, '#d83a4a'); break;
      case 'loot': E(c, 0, 0, 5, 5, '#e8c050'); E(c, -1, -1, 2, 2, '#fff2b0'); break;
      case 'lever': c.strokeStyle = '#ddd'; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, 4); c.lineTo(3, -4); c.stroke(); E(c, 3, -4, 2, 2, '#d84a3a'); break;
      case 'plate': Rc(c, -5, -2, 10, 5, '#c8c0b0'); Rc(c, -5, 3, 10, 1, '#6a6458'); break;
      case 'skull': E(c, 0, -1, 5, 4.5, '#e8e0d0'); Rc(c, -3, 2, 6, 3, '#e8e0d0'); E(c, -2, -1, 1.3, 1.5, '#222'); E(c, 2, -1, 1.3, 1.5, '#222'); break;
      default: if (!it.img || !drawFit(c, it.img, 0, 0, 16, 16)) { Po(c, [[0, -7], [6, -1], [0, 7], [-6, -1]], '#7ae0ff'); Po(c, [[0, -7], [6, -1], [0, -1]], '#c8f6ff'); }
    }
    c.restore();
  }
  drawPerson(c, o) {
    const x = Math.round(o.x), y = Math.round(o.y);
    E(c, x, y, 7, 2.5, 'rgba(0,0,0,.3)');
    if (o === this.hero && o.invT > 0 && o.ko <= 0 && (this.t * 12 | 0) % 2) return;
    o.actor.draw(c, x, y, 1);
  }
  drawCreature(c, o) {
    const cr = o.cr, s = o.sc, S = cr.size * s, t = this.t;
    let fr = cr.frames[((t * 2 + o.ph) | 0) % 2];
    if (o.dead) fr = cr.dead; else if (o.hurtT > 0) fr = cr.hurt;
    else if (o.atkT > 0) fr = cr.attack[o.atkT > 0.45 ? 0 : o.atkT > 0.3 ? 1 : 2]; else if (o.mv) fr = cr.walk[(o.wph | 0) % 4];
    const lift = cr.floats || o.kind === 'spirit' ? 5 + Math.sin(t * 3 + o.ph) * 2 : 0;
    E(c, o.x, o.y, S * 0.32, 2.5, 'rgba(0,0,0,.28)');
    if (o.kind === 'foe' && o.state === 'chase' && !o.dead) E(c, o.x, o.y, S * 0.42, 3.5, 'rgba(255,60,40,.25)');
    c.globalAlpha = o.dead ? Math.max(0, 1 - o.deadT) : o.ascend ? Math.max(0, 1 - o.ascend / 2.5) : 1;
    if (!(o.hurtT > 0 && (t * 20 | 0) % 2)) drawFit(c, fr, o.x, o.y - S / 2 - lift, S, S, 0, o.face < 0);
    c.globalAlpha = 1;
    if (o.kind === 'foe' && o.hp < o.max && !o.dead) { Rc(c, o.x - 8, o.y - S - lift - 6, 16, 3, 'rgba(0,0,0,.6)'); Rc(c, o.x - 8, o.y - S - lift - 6, (16 * o.hp) / o.max, 3, '#e84a3a'); }
  }
  drawAmb(c, emissive) {
    const k = this.place.fx, em = k === 'firefly' || k === 'ember' || k === 'spark';
    if (em !== emissive) return;
    for (const p of this.amb) {
      const a = Math.min(1, p.life / Math.min(1, p.max), (p.max - p.life) * 2);
      switch (k) {
        case 'snow': c.fillStyle = `rgba(255,255,255,${0.85 * a})`; c.fillRect(p.x, p.y, p.s > 1 ? 2 : 1, p.s > 1 ? 2 : 1); break;
        case 'leaf': c.save(); c.translate(p.x, p.y); c.rotate(p.ph * 2); c.globalAlpha = a; E(c, 0, 0, 2.6, 1.2, p.s > 1 ? '#e8a040' : '#7ac050'); c.restore(); break;
        case 'dust': c.fillStyle = `rgba(255,235,190,${0.4 * a})`; c.fillRect(p.x, p.y, 1, 1); break;
        case 'wisp': { const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9 * p.s); g.addColorStop(0, `rgba(190,210,255,${0.22 * a})`); g.addColorStop(1, 'rgba(190,210,255,0)'); c.fillStyle = g; c.fillRect(p.x - 10 * p.s, p.y - 10 * p.s, 20 * p.s, 20 * p.s); break; }
        case 'bubble': c.strokeStyle = `rgba(200,240,255,${0.5 * a})`; c.lineWidth = 1; c.beginPath(); c.arc(p.x + Math.sin(p.ph * 3) * 2, p.y, 1.5 * p.s, 0, 7); c.stroke(); break;
        case 'steam': c.fillStyle = `rgba(220,220,220,${0.18 * a})`; c.beginPath(); c.arc(p.x, p.y, 3 + (p.max - p.life) * 4, 0, 7); c.fill(); break;
        case 'firefly': { const b = 0.5 + 0.5 * Math.sin(p.ph * 4); c.fillStyle = `rgba(210,255,120,${a * b})`; c.fillRect(p.x - 1, p.y - 1, 2, 2); c.fillStyle = `rgba(210,255,120,${0.2 * a * b})`; c.fillRect(p.x - 3, p.y - 3, 6, 6); break; }
        case 'ember': c.fillStyle = `rgba(255,${120 + (p.ph * 300) % 100 | 0},40,${a})`; c.fillRect(p.x, p.y, 1.5, 1.5); break;
        case 'spark': { const b = Math.max(0, Math.sin(p.ph * 3)); c.fillStyle = `rgba(255,200,150,${a * b})`; c.fillRect(p.x, p.y, 1, 1); c.fillRect(p.x - 1, p.y, 3, 1 * b); break; }
      }
    }
    c.globalAlpha = 1;
  }
  lightList() {
    const P = this.place, h = this.hero, L = this.lights.slice();
    L.push({ x: h.x, y: h.y - 12, r: this.inv.flame ? 104 : 72, fl: !!this.inv.flame });
    for (const o of this.creatures) if (o.kind === 'spirit' && !o.ascend) L.push({ x: o.x, y: o.y - 12, r: 50, col: '180,230,255' });
    for (const [i, z] of this.hz) if (z.style === 'flame' && this.hzOn(z) === 2) L.push({ x: px(i % MW), y: py(i / MW | 0) - 10, r: 46 });
    for (const o of this.objs) if (o.kind === 'pedestal' && o.item) L.push({ x: o.x, y: o.y - 30, r: 50, col: '200,230,255' });
    return L;
  }
  drawLight(c) {
    const P = this.place, d = this.darkNow;
    if (d < 0.03) return;
    const L = this.lc, x = L.getContext('2d'), cam = this.cam, s = 0.25, t = this.t;
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, L.width, L.height);
    x.fillStyle = `rgba(${P.dc},${d})`; x.fillRect(0, 0, L.width, L.height);
    x.globalCompositeOperation = 'destination-out';
    if (this.lmask) x.drawImage(this.lmask, -cam.x * s, -cam.y * s);
    const lights = this.lightList();
    for (const l of lights) {
      const X = (l.x - cam.x) * s, Y = (l.y - cam.y) * s, r = l.r * s * (l.fl ? 1 + Math.sin(t * 13 + l.x) * 0.04 : 1);
      if (X < -r || Y < -r || X > L.width + r || Y > L.height + r) continue;
      const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2);
    }
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(L, 0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const X = l.x - cam.x, Y = l.y - cam.y, r = l.r * 0.8;
      if (X < -r || Y < -r || X > W + r || Y > H + r) continue;
      const g = c.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, `rgba(${l.col || P.lc},${0.22 * d})`); g.addColorStop(1, `rgba(${l.col || P.lc},0)`);
      c.fillStyle = g; c.fillRect(X - r, Y - r, r * 2, r * 2);
    }
    c.restore();
  }
  flame(c, x, y, s = 1) {
    const t = this.t, f = 1 + Math.sin(t * 17 + x) * 0.12 + Math.sin(t * 29 + y) * 0.08;
    E(c, x, y - 1.5 * s * f, 2.2 * s, 3.6 * s * f, 'rgba(255,110,30,.9)');
    E(c, x, y - 0.8 * s, 1.2 * s, 2.2 * s * f, 'rgba(255,225,130,.95)');
  }
  drawGlow(c) {
    const cam = this.cam, t = this.t, vis = (o) => o.x > cam.x - 40 && o.x < cam.x + W + 40 && o.y > cam.y - 20 && o.y < cam.y + H + 60;
    for (const p of this.props) {
      if (!vis(p)) continue;
      const X = Math.round(p.x - p.ax), Y = Math.round(p.y - p.ay);
      if (p.flames) for (const [a, b, s] of p.flames) this.flame(c, X + a, Y + b, s || 0.8);
      if (p.orb) { const [a, b, col, k] = p.orb, r = 3 + Math.sin(t * 2 + p.x) * 0.6; E(c, X + a, Y + b, r * 2.2, r * 2.2, sh(col, 1, 0.18 * (k ?? 1))); E(c, X + a, Y + b, r, r, sh(col, 1, 0.9 * (k ?? 1))); }
      if (p.paper) for (const [a, b, col] of p.paper) { const sw = Math.sin(t * 1.5 + a) * 1; E(c, X + a + sw, Y + b, 3.5, 4.5, col); Rc(c, X + a + sw - 3, Y + b - 1, 6, 1, 'rgba(0,0,0,.2)'); E(c, X + a + sw, Y + b, 6, 7, sh(col, 1, 0.15)); }
    }
    for (const o of this.objs) {
      if (!vis(o)) continue;
      if ((o.kind === 'beacon' && o.lit) || o.kind === 'brazier') { const big = o.big ? 1.4 : o.kind === 'brazier' ? 0.8 : 1; this.flame(c, o.x, o.y - 29 * big, 2.2 * big); if (this.rng() < 0.15) this.fx.push({ x: o.x + this.r(-3, 3), y: o.y - 34 * big, vx: this.r(-8, 8), vy: -30, life: 0.8, max: 0.8, col: '#ffb040', r: 1.2, g: -10, add: 1 }); }
      if (o.kind === 'shrine' && o.glow) { const g = c.createRadialGradient(o.x, o.y - 18, 0, o.x, o.y - 18, 40); g.addColorStop(0, 'rgba(255,240,180,.6)'); g.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g; c.fillRect(o.x - 40, o.y - 58, 80, 80); }
    }
    for (const [i, z] of this.hz) {
      const st = this.hzOn(z); if (!st) continue;
      const X = px(i % MW), Y = (i / MW | 0) * T + 16;
      if (X < cam.x - 30 || X > cam.x + W + 30 || Y < cam.y - 40 || Y > cam.y + H + 30) continue;
      if (z.style === 'flame') { if (st === 2) { for (let k = 0; k < 3; k++) this.flame(c, X - 5 + k * 5, Y - 2, 2.2 + Math.sin(t * 20 + k) * 0.5); } else if (this.rng() < 0.3) Rc(c, X + this.r(-6, 6), Y - this.r(0, 6), 1, 1, '#ffb040'); }
      else if (z.style === 'steam' && st === 2) { const col = this.place.hc || '255,255,255'; for (let k = 0; k < 3; k++) { const ph = (t * 1.6 + k / 3 + z.ph) % 1; E(c, X + Math.sin(k * 2 + t) * 3, Y - 2 - ph * 22, 3 + ph * 5, 3 + ph * 5, `rgba(${col},${0.35 * (1 - ph)})`); } }
    }
    const h = this.hero;
    if (this.inv.flame && h.ko <= 0) { const r = /E/.test(h.actor.dir) ? 1 : /W/.test(h.actor.dir) ? -1 : 0.5; this.flame(c, h.x + r * 7, h.y - 22, 1.3); }
    for (const o of this.creatures) if (o.kind === 'spirit' && !o.dead) { const g = c.createRadialGradient(o.x, o.y - 14, 0, o.x, o.y - 14, 22); g.addColorStop(0, 'rgba(190,235,255,.35)'); g.addColorStop(1, 'rgba(190,235,255,0)'); c.fillStyle = g; c.fillRect(o.x - 22, o.y - 36, 44, 44); }
    c.globalCompositeOperation = 'lighter';
    this.drawAmb(c, true);
    for (const p of this.fx) if (p.add) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.col; c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    for (const p of this.pops) { const k = Math.min(1, p.t / 0.8), e = k * k; this.icon(c, p.it, p.x + (h.x - p.x) * e, p.y - Math.sin(k * Math.PI) * 26 + (h.y - 22 - p.y) * e, 1.4 - k * 0.5); }
    if (this.trophy) { const o = this.trophy.o; this.icon(c, this.trophy.it, o.x, o.y - 46 + Math.sin(t * 3) * 2, 1.4); }
  }
  wrap(c, s, w) {
    const out = []; let line = '';
    for (const word of s.split(' ')) { const tt = line ? `${line} ${word}` : word; if (line && c.measureText(tt).width > w) { out.push(line); line = word; } else line = tt; }
    if (line) out.push(line);
    return out;
  }
  bubble(c, x, y, text, name, small) {
    const cam = this.cam;
    c.font = `600 ${small ? 9 : 10}px ui-monospace, monospace`;
    const lines = this.wrap(c, text, small ? 120 : 160), lh = small ? 11 : 12;
    let w = Math.max(...lines.map((l) => c.measureText(l).width)) + 12;
    if (name) { c.font = '700 8px ui-monospace, monospace'; w = Math.max(w, c.measureText(name.toUpperCase()).width + 12); }
    const hh = lines.length * lh + (name ? 10 : 0) + 7;
    const bx = Math.max(cam.x + 4, Math.min(cam.x + W - w - 4, x - w / 2)), by = Math.max(cam.y + 40, y - hh - 7);
    c.fillStyle = small ? 'rgba(250,246,236,.88)' : 'rgba(252,248,238,.97)'; roundRect(c, bx, by, w, hh, 5); c.fill();
    c.strokeStyle = 'rgba(40,30,20,.55)'; c.lineWidth = 1; c.stroke();
    const tx = Math.max(bx + 6, Math.min(bx + w - 6, x));
    c.fillStyle = small ? 'rgba(250,246,236,.88)' : 'rgba(252,248,238,.97)'; c.beginPath(); c.moveTo(tx - 4, by + hh - 0.5); c.lineTo(tx, by + hh + 5); c.lineTo(tx + 4, by + hh - 0.5); c.fill();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    let yy = by + 3 + lh / 2;
    if (name) { c.font = '700 8px ui-monospace, monospace'; c.fillStyle = '#a0461a'; c.fillText(name.toUpperCase(), bx + 6, by + 8); yy += 10; }
    c.font = `600 ${small ? 9 : 10}px ui-monospace, monospace`; c.fillStyle = '#1e1a16';
    for (const l of lines) { c.fillText(l, bx + 6, yy); yy += lh; }
  }
  headY(o) { return o.cr ? o.y - o.cr.size * o.sc - 4 : o.y - (o.h || 30); }
  drawTalk(c) {
    const h = this.hero;
    for (const o of this.creatures) if (o.icon && !o.dead) {
      const x = o.x, y = this.headY(o) - 4, red = o.icon.name === 'angry';
      c.fillStyle = 'rgba(252,248,238,.95)'; c.beginPath(); c.arc(x, y, 6.5, 0, 7); c.fill(); c.strokeStyle = 'rgba(40,30,20,.5)'; c.stroke();
      this.text(c, o.icon.s, x, y + 0.5, 9, red ? '#d83a2a' : o.icon.name === 'love' ? '#e0508a' : '#3a2a1a');
    }
    for (const o of [h, ...this.npcs, ...this.creatures]) if (o.bark && (!this.line || this.line.who !== o)) { c.globalAlpha = Math.min(1, o.bark.t * 3); this.bubble(c, o.x, this.headY(o), o.bark.s, null, true); c.globalAlpha = 1; }
    if (this.line) { const o = this.line.who; this.bubble(c, o.x, this.headY(o), this.line.s, o === h ? (h.name || this.skin.heroName || 'You') : o.name || (o.cr ? o.cr.name : '')); }
  }
  drawMarker(c, ox, oy) {
    if (this.card > 0 || this.ending || !this.started) return;
    const tg = this.m.steps[this.m.cur]?.tg();
    if (!tg) return;
    const x = tg.x - ox, y = this.headY(tg) - oy - 10 + Math.sin(this.t * 5) * 2.5;
    if (x > 8 && x < W - 8 && y > 44 && y < H - 36) { Po(c, [[x - 6, y - 7], [x + 6, y - 7], [x, y + 1]], '#ffd84a'); Po(c, [[x - 6, y - 7], [x + 6, y - 7], [x, y - 4]], '#fff2a8'); c.strokeStyle = 'rgba(60,40,0,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 6, y - 7); c.lineTo(x + 6, y - 7); c.lineTo(x, y + 1); c.closePath(); c.stroke(); return; }
    const cx = W / 2, cy = H / 2 + 4, a = Math.atan2(y - cy, x - cx), ex = Math.max(16, Math.min(W - 16, cx + Math.cos(a) * 400)), ey = Math.max(50, Math.min(H - 44, cy + Math.sin(a) * 400));
    c.save(); c.translate(ex, ey); c.rotate(a); c.fillStyle = 'rgba(10,8,12,.6)'; c.beginPath(); c.arc(0, 0, 10, 0, 7); c.fill();
    Po(c, [[8, 0], [-4, -6], [-1, 0], [-4, 6]], '#ffd84a'); c.restore();
  }
  drawHud(c) {
    const m = this.m, acc = this.col(0), ink = '#f4ead8';
    c.fillStyle = 'rgba(10,8,12,.68)'; c.fillRect(0, 0, W, 36); c.fillStyle = acc; c.fillRect(0, 36, W, 1);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = '700 8px ui-monospace, monospace'; c.fillStyle = acc; c.fillText(`EXPEDITION ${this.n} · ${this.name.toUpperCase()}`, 8, 10, W - 16);
    c.font = '700 12px ui-monospace, monospace'; c.fillStyle = ink; c.fillText(`GOAL: ${m.goal}`, 8, 25, W - 16);
    c.fillStyle = 'rgba(10,8,12,.72)'; c.fillRect(0, H - 32, W, 32); c.fillStyle = acc; c.fillRect(0, H - 33, W, 1);
    const n = m.steps.length, cur = Math.min(m.cur, n - 1);
    for (let k = 0; k < n; k++) {
      const x = 12 + k * 13, y = H - 23;
      if (k < m.cur) { E(c, x, y, 4.5, 4.5, acc); c.strokeStyle = '#1a1410'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 2.2, y); c.lineTo(x - 0.5, y + 2); c.lineTo(x + 2.5, y - 2); c.stroke(); }
      else { c.strokeStyle = k === m.cur ? ink : 'rgba(244,234,216,.35)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, k === m.cur ? 4 + Math.sin(this.t * 5) * 0.7 : 4, 0, 7); c.stroke(); }
    }
    c.font = '700 8px ui-monospace, monospace'; c.fillStyle = acc; c.textAlign = 'left';
    c.fillText(m.cur >= n ? 'ALL STEPS DONE' : `STEP ${cur + 1} OF ${n}`, 12 + n * 13, H - 23);
    const st = m.steps[cur], lab = m.cur >= n ? 'Mission complete!' : typeof st.s === 'function' ? st.s() : st.s;
    c.font = '700 11px ui-monospace, monospace'; c.fillStyle = ink; c.fillText(`▸ ${lab}`, 8, H - 9, W - 92);
    const h = this.hero;
    for (let k = 0; k < h.max; k++) this.heart(c, W - 12 - k * 12, H - 24, k < h.hp);
    const inv = ['key', 'flame', 'letter', 'treat', 'relic', 'loot', 'part'].filter((k) => this.inv[k] > 0);
    inv.forEach((k, i) => { const it = k === 'relic' ? this.objs.find((o) => o.kind === 'pedestal')?.item || { k } : { k }; if (k === 'relic' && this.m.id === 'relic') it.img = this.skin.pick('relic' + this.n, 'item'); this.icon(c, k === 'relic' ? { k: 'relic', img: it.img } : { k }, W - 14 - i * 18, H - 9, 0.9); if (k === 'part') this.text(c, `${this.inv.part}`, W - 7 - i * 18, H - 6, 7, ink); });
    if (this.flash) { const a = Math.min(1, this.flash.t * 2); c.globalAlpha = a; c.font = '700 10px ui-monospace, monospace'; const w = c.measureText(this.flash.s).width + 16; c.fillStyle = 'rgba(30,60,30,.88)'; roundRect(c, W / 2 - w / 2, 44, w, 18, 9); c.fill(); this.text(c, this.flash.s, W / 2, 53, 10, '#d8ffc8'); c.globalAlpha = 1; }
  }
  heart(c, x, y, full) {
    c.fillStyle = full ? '#e8504a' : 'rgba(255,255,255,.18)';
    c.beginPath(); c.moveTo(x, y + 4); c.bezierCurveTo(x - 6, y, x - 4, y - 4, x, y - 1.5); c.bezierCurveTo(x + 4, y - 4, x + 6, y, x, y + 4); c.fill();
  }
  drawMinimap(c) {
    const s = 2, w = MW * s, hh = MH * s, X = W - w - 6, Y = 42;
    if (this.mmDirty || !this.mm) {
      this.mmDirty = 0; const m = this.mm ||= mk(w, hh), x = m.getContext('2d'); x.clearRect(0, 0, w, hh);
      for (let i = 0; i < MW * MH; i++) if (this.seenT[i]) { const v = this.map[i]; x.fillStyle = v === WALL ? '#5a5060' : walkT(v) ? (v === RUG ? '#e8d8a8' : '#c8bc98') : 'rgba(40,60,90,.7)'; x.fillRect((i % MW) * s, (i / MW | 0) * s, s, s); }
    }
    c.fillStyle = 'rgba(10,8,12,.6)'; c.fillRect(X - 3, Y - 3, w + 6, hh + 6); c.strokeStyle = this.col(0); c.lineWidth = 1; c.strokeRect(X - 2.5, Y - 2.5, w + 5, hh + 5);
    c.drawImage(this.mm, X, Y);
    for (const o of this.objs) if (o.kind === 'survey') { c.fillStyle = o.done ? '#5ac85a' : '#e8504a'; c.fillRect(X + o.tx * s - 1, Y + o.ty * s - 1, 3, 3); }
    if ((this.t * 3 | 0) % 2) { c.fillStyle = '#fff'; c.fillRect(X + (this.hero.x / T) * s - 1, Y + ((this.hero.y - 5) / T) * s - 1, 3, 3); }
  }
  drawCard(c) {
    const a = Math.min(1, this.card / 0.5), m = this.m, acc = this.col(0);
    c.globalAlpha = a; c.fillStyle = 'rgba(6,5,10,.86)'; c.fillRect(0, 0, W, H);
    this.text(c, `EXPEDITION ${this.n}`, W / 2, 92, 10, acc);
    c.font = 'italic 700 23px Georgia, "Times New Roman", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f6ecda';
    const tl = this.wrap(c, this.name, W - 40); tl.forEach((l, i) => c.fillText(l, W / 2, 122 + i * 26));
    let y = 128 + tl.length * 26;
    c.fillStyle = acc; c.fillRect(W / 2 - 40, y - 6, 80, 1);
    this.text(c, 'YOUR GOAL', W / 2, y + 10, 9, acc);
    c.font = '700 14px ui-monospace, monospace'; c.fillStyle = '#f6ecda'; const gl = this.wrap(c, m.goal, W - 50); gl.forEach((l, i) => c.fillText(l, W / 2, y + 30 + i * 18));
    y += 44 + gl.length * 18;
    c.font = '600 10px ui-monospace, monospace'; c.textAlign = 'left';
    const lines = m.steps.map((st, i) => `${i + 1}. ${typeof st.s === 'function' ? st.s() : st.s}`), lw = Math.min(W - 40, Math.max(...lines.map((l) => c.measureText(l).width)));
    lines.forEach((l, i) => { c.fillStyle = 'rgba(246,236,218,.8)'; c.fillText(l, W / 2 - lw / 2, y + i * 15, W - 40); });
    this.text(c, 'tap to begin', W / 2, H - 40, 8, 'rgba(246,236,218,.45)');
    c.globalAlpha = 1;
  }
  drawEnd(c) {
    const e = this.ending; if (e.t < 1.2) return;
    const a = Math.min(1, (e.t - 1.2) * 3), y = 150, acc = this.col(0);
    c.globalAlpha = a; c.fillStyle = 'rgba(8,6,10,.8)'; roundRect(c, 24, y - 6, W - 48, 104, 10); c.fill(); c.strokeStyle = acc; c.lineWidth = 1.5; c.stroke();
    this.text(c, '★ MISSION COMPLETE ★', W / 2, y + 12, 12, acc);
    c.font = '700 11px ui-monospace, monospace'; c.textAlign = 'center'; c.fillStyle = '#f6ecda';
    this.wrap(c, `✓ ${this.m.goal}`, W - 80).slice(0, 2).forEach((l, i) => c.fillText(l, W / 2, y + 34 + i * 14));
    this.text(c, `+${e.bonus} · ${this.hero.hp}♥ left`, W / 2, y + 66, 10, '#ffd84a');
    this.text(c, `Next: ${e.next}`, W / 2, y + 86, 9, 'rgba(246,236,218,.7)');
    c.globalAlpha = 1;
  }
  hud() { return `${Math.floor(this.score)} · expedition ${this.n}`; }
}
