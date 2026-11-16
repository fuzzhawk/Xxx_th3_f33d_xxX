// Hell Maze: a Build-engine-style shooter (think Duke Nukem 3D, in Quake's and Heretic's colours)
// drawn with three.js at a low resolution. Levels are polygon sectors with their own floor and
// ceiling heights: stairs, ramps, sunken pools, stepped daises, slit windows, doors with keys, secret
// rooms, a bridge over a canal you can walk under, galleries, arenas and courtyards under a
// parallax sky, lit by guttering torches. Monsters come from the horror forge, drawn from eight
// angles like Doom's, and bleed their own colours. Every post rolls its own arsenal.
import { Game, W, H, ready, rgbOf, imagePixels } from './engine.js';
import { horror, viewDir } from '../horror.js';
import { mulberry32 } from '../util.js';

let T = null, loading = null;
const loadThree = () => (loading ||= import('../vendor/three.module.min.js').then((m) => { T = m; return m; }));
// one renderer for every Hell Maze card; scenes are built per game and dropped when old
const VH = H - 34, RW = 240, RH = Math.round((RW * VH) / W);
let RR = null;
const live = [];
function renderer() {
  if (RR && !RR.lost) return RR;
  const cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
  const r = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  r.setPixelRatio(1); r.setSize(RW, RH, false); r.autoClear = false; r.outputColorSpace = T.LinearSRGBColorSpace;
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r.lost = true; for (const g of [...live]) g.dropGpu(true); });
  RR = r; return r;
}

const TAU = Math.PI * 2, CELL = 16, NS = 0.5, GS = 2, TS = 2;
const PR = 0.32, PH = 1.65, EYE = 1.4, STEP = 0.62;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angTo = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const fz = (s, x, y) => s.f.h + s.f.gx * (x - s.f.ox) + s.f.gy * (y - s.f.oy);
const cz = (s, x, y) => s.c.h + s.c.gx * (x - s.c.ox) + s.c.gy * (y - s.c.oy);
const flat = (h) => ({ h, gx: 0, gy: 0, ox: 0, oy: 0 });
function inPoly(p, x, y) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
}
const area = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return a / 2; };
const ccw = (p) => (area(p) < 0 ? [...p].reverse() : p), cw = (p) => (area(p) > 0 ? [...p].reverse() : p);
const ngon = (n, r, a0, cx, cy, sx = 1, sy = 1) => Array.from({ length: n }, (_, k) => [cx + Math.cos(a0 + (k / n) * TAU) * r * sx, cy + Math.sin(a0 + (k / n) * TAU) * r * sy]);
const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// ray from the origin to a polygon's boundary
function rayPoly(P, dx, dy) {
  let best = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j], ex = P[i][0] - ax, ey = P[i][1] - ay, d = dx * ey - dy * ex;
    if (Math.abs(d) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / d, u = (ax * dy - ay * dx) / d;
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
  }
  return best;
}
const rgb01 = (css) => rgbOf(css).map((v) => v / 255);
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------------------------------------------------------------- the arsenal
// Gritty guns (rolled stats, drawn by a modular gun painter) and the old strange ones (their own art).
// Every post rolls its own: each weapon's numbers move ±18% and it may carry one or two affixes.
// carve: how much of a voxel wall a hit chews away; splash: blast radius; shot: what it fires.
const ARMS = {
  pistol: { label: 'PISTOL', names: ['Service Pistol', 'Revolver', 'Hand Cannon', 'Rivet Pistol'], rate: 0.32, dmg: 15, speed: 38, spread: 0.02, n: 1, shot: 'bullet', carve: 0.17, gun: true },
  shotgun: { label: 'SHOTGN', names: ['Double-Barrel', 'Scattergun', 'Boomstick', 'Coach Gun', 'Trench Gun'], rate: 0.9, dmg: 9, speed: 32, spread: 0.12, n: 7, shot: 'pellet', ammo: 24, give: 12, carve: 0.2, gun: true },
  nailgun: { label: 'NAILS', names: ['Nailgun', 'Rivet Driver', 'Spike Thrower', 'Perforator'], rate: 0.1, dmg: 7, speed: 40, spread: 0.035, n: 1, shot: 'nail', ammo: 120, give: 60, carve: 0.14, gun: true },
  rocket: { label: 'ROCKET', names: ['Rocket Launcher', 'Bunker Buster', 'Siege Tube'], rate: 1.05, dmg: 70, speed: 16, n: 1, shot: 'rocket', ammo: 10, give: 5, splash: 3.2, carve: 1.5, gun: true },
  grenade: { label: 'GRENAD', names: ['Grenade Launcher', 'Pipe Lobber', 'Pineapple Mortar'], rate: 0.8, dmg: 60, speed: 13, grav: 9, bounce: 3, fuse: 1.8, n: 1, shot: 'grenade', ammo: 12, give: 6, splash: 3, carve: 1.4, gun: true },
  plasma: { label: 'PLASMA', names: ['Plasma Rifle', 'Arc Caster', 'Ion Projector'], rate: 0.13, dmg: 12, speed: 28, spread: 0.02, n: 1, shot: 'plasma', ammo: 80, give: 40, carve: 0.3, gun: true },
  tooth: { label: 'TOOTH', names: ['Tooth Pistol', 'Molar Popper', 'Fang Derringer', 'Nail Spitter'], rate: 0.3, dmg: 13, speed: 30, spread: 0.025, n: 1, shot: 'tooth', carve: 0.15 },
  chicken: { label: 'CHICKN', names: ['Rubber Chicken Shotgun', 'Squawk Scattergun', 'Poultry Blunderbuss'], rate: 0.9, dmg: 10, speed: 17, spread: 0.13, n: 6, grav: 7, bounce: 2, ammo: 18, give: 10, shot: 'chicken', carve: 0.15 },
  hive: { label: 'HIVE', names: ['Bee-Hive Launcher', 'Apiary Mortar', 'Swarm Bucket'], rate: 1.1, dmg: 12, speed: 12, grav: 9, n: 1, ammo: 5, give: 3, shot: 'hive', carve: 0.4 },
  flail: { label: 'SKULL', names: ['Bouncing Skull Flail', 'Ricochet Cranium', 'Skull on a Chain'], rate: 0.5, dmg: 26, speed: 19, n: 1, bounce: 5, shot: 'skull', carve: 0.3 },
  squid: { label: 'SQUID', names: ['Ink-Squid Cannon', 'Octo-Mortar', 'Cephalopod Cannon'], rate: 0.85, dmg: 22, speed: 15, grav: 3, n: 1, ammo: 8, give: 5, shot: 'squid', carve: 0.6 },
  fork: { label: 'FORK', names: ['Chain-Lightning Tuning Fork', 'Thunder Fork', 'Humming Trident'], rate: 0.5, dmg: 20, n: 1, chain: 4, ammo: 40, give: 25, shot: 'zap', carve: 0.25 },
  marble: { label: 'MARBLE', names: ['Black-Hole Marble', 'Void Marble', 'Event-Horizon Slingshot'], rate: 1.5, dmg: 30, speed: 8, n: 1, ammo: 3, give: 2, shot: 'marble', carve: 1.2 },
  relic: { label: 'RELIC', names: ['Relic Mortar', 'Heirloom Lobber', 'Junk Howitzer'], rate: 0.95, dmg: 45, speed: 14, grav: 8, n: 1, ammo: 8, give: 5, shot: 'relic', splash: 2.6, carve: 1.1 },
  // the second armoury
  chaingun: { label: 'CHAIN', names: ['Chaingun', 'Minigun', 'Bone Mill', 'Ripsaw Gatling'], rate: 0.065, dmg: 8, speed: 42, spread: 0.05, n: 1, shot: 'bullet', ammo: 200, give: 90, carve: 0.12, gun: true },
  flamer: { label: 'FLAME', names: ['Flamethrower', 'Pyre Hose', 'Immolator', 'Hellbreath'], rate: 0.05, dmg: 4, speed: 11, spread: 0.1, n: 1, shot: 'flame', ammo: 220, give: 110, carve: 0.04, burn: 3, gun: true },
  railgun: { label: 'RAIL', names: ['Railgun', 'Gauss Lance', 'Spine Driver'], rate: 1.25, dmg: 95, n: 1, shot: 'rail', ammo: 15, give: 8, carve: 0.8, gun: true },
  stakegun: { label: 'STAKE', names: ['Stake Gun', 'Impaler', 'Pin Launcher'], rate: 0.85, dmg: 55, speed: 30, grav: 2, n: 1, shot: 'stake', ammo: 20, give: 10, pierce: 3, carve: 0.35, gun: true },
  ripper: { label: 'SAWS', names: ['Saw Launcher', 'Ripper', 'Disc Thrower'], rate: 0.45, dmg: 30, speed: 20, n: 1, shot: 'saw', ammo: 30, give: 15, bounce: 4, carve: 0.4, gun: true },
  chainsaw: { label: 'SAW', names: ['Chainsaw', 'Bone Saw', 'Gut Ripper'], rate: 0.08, dmg: 7, n: 1, shot: 'melee', carve: 0.1, gun: true },
  mines: { label: 'MINES', names: ['Mine Layer', 'Toe Popper', 'Proximity Lobber'], rate: 0.7, dmg: 65, speed: 9, grav: 10, n: 1, shot: 'mine', ammo: 12, give: 6, splash: 3, carve: 1.2, gun: true },
  acid: { label: 'BILE', names: ['Bile Spewer', 'Acid Mortar', 'Gallbladder Gun'], rate: 0.7, dmg: 18, speed: 14, grav: 9, n: 1, shot: 'acid', ammo: 25, give: 12, carve: 0.3 },
  soul: { label: 'SOUL', names: ['Soul Cannon', 'Wailing Orb', 'Ghost Engine'], rate: 1.6, dmg: 60, speed: 8, n: 1, shot: 'soul', ammo: 6, give: 3, splash: 4, carve: 1.2 },
  hook: { label: 'HOOK', names: ['Harpoon Gun', 'Meat Hook Launcher', 'Grappler'], rate: 0.9, dmg: 28, speed: 26, n: 1, shot: 'hook', ammo: 16, give: 8, carve: 0.3 }
};
const GRIT = ['shotgun', 'nailgun', 'rocket', 'grenade', 'plasma', 'chaingun', 'flamer', 'railgun', 'stakegun', 'ripper', 'chainsaw', 'mines'], WEIRD = ['chicken', 'hive', 'flail', 'squid', 'fork', 'marble', 'relic', 'acid', 'soul', 'hook'];
const AFFIX = {
  explosive: { name: 'Explosive', fx: (A) => { A.splash = Math.max(A.splash || 0, 1.5); A.carve = (A.carve || 0.2) + 0.5; A.dmg *= 0.9; } },
  ricochet: { name: 'Ricocheting', fx: (A) => { A.bounce = (A.bounce || 0) + 2; } },
  pierce: { name: 'Piercing', fx: (A) => { A.pierce = 2; } },
  burn: { name: 'Burning', fx: (A) => { A.burn = 3.5; } },
  split: { name: 'Splintering', fx: (A) => { A.split = 4; } },
  seek: { name: 'Seeking', fx: (A) => { A.seek = 3.2; } },
  drill: { name: 'Drilling', fx: (A) => { A.carve = (A.carve || 0.2) * 2.4 + 0.2; A.drill = true; } },
  twin: { name: 'Twin', fx: (A) => { A.n = (A.n || 1) * 2; A.spread = (A.spread || 0.03) * 1.5 + 0.02; A.dmg *= 0.7; if (A.ammo) { A.ammo = Math.round(A.ammo * 1.5); A.give = Math.round(A.give * 1.5); } } },
  heavy: { name: 'Heavy', fx: (A) => { A.dmg *= 1.5; A.rate *= 1.35; A.carve = (A.carve || 0.2) * 1.4; } },
  rapid: { name: 'Rapid', fx: (A) => { A.rate *= 0.62; A.dmg *= 0.8; } },
  leech: { name: 'Leeching', fx: (A) => { A.leech = 0.15; } }
};
const AFFIXES = Object.keys(AFFIX), SUFFIX = ['of the Pit', 'of Saint Gnaw', 'of the Flayed', 'of Ruin', 'of Ash', 'Mk II', 'of the Ossuary', 'of Sorrow', 'of the Abattoir', 'Prototype'];
const METALS = [['#3a3c40', '#62666e', '#1a1b1e'], ['#4a3426', '#76503a', '#22160e'], ['#544826', '#86733e', '#2a2210'], ['#2e3832', '#4e5c54', '#141a16'], ['#4a2c2a', '#6e443e', '#221212'], ['#7a7262', '#a49c86', '#3e382c']];
const WOODS = ['#4a2e1a', '#5e3a20', '#2e2218', '#55221a'];
// one weapon, rolled: its numbers jittered, maybe an affix or two, a name to match
function rollArm(R, k, plain) {
  const B = ARMS[k], j = (v) => v * (0.82 + R() * 0.36), A = { ...B, k, rate: j(B.rate), dmg: j(B.dmg), speed: B.speed && j(B.speed), affixes: [], metal: METALS[Math.floor(R() * METALS.length)], wood: WOODS[Math.floor(R() * WOODS.length)], hue: Math.floor(R() * 6), seed: Math.floor(R() * 1e6) };
  if (B.spread) A.spread = j(B.spread);
  const n = plain ? 0 : R() < 0.55 ? 1 : R() < 0.5 ? 2 : 0;
  while (A.affixes.length < n) { const a = AFFIXES[Math.floor(R() * AFFIXES.length)]; if (A.affixes.includes(a) || (a === 'twin' && k === 'fork') || (a === 'split' && (k === 'marble' || k === 'fork'))) continue; A.affixes.push(a); AFFIX[a].fx(A); }
  const nm = B.names[Math.floor(R() * B.names.length)];
  A.name = [A.affixes.map((a) => AFFIX[a].name).join(' '), nm, R() < 0.3 ? SUFFIX[Math.floor(R() * SUFFIX.length)] : ''].filter(Boolean).join(' ');
  return A;
}
// the garrison, from the horror forge: px is how big its sprites are drawn
// (px: sprite size, more for more detail; lvl: the first level a second-wave role can turn up on)
const ROLES = [
  { role: 'grunt', kind: 'zombie', px: 56, hp: 55, speed: 2.5, size: 1.85, melee: 13 },
  { role: 'spitter', kind: 'imp', px: 48, hp: 38, speed: 2.6, size: 1.5, ranged: 10 },
  { role: 'floater', kind: 'wraith', px: 52, hp: 34, speed: 2.4, size: 1.75, ranged: 8, fly: true },
  { role: 'hound', kind: 'hound', px: 48, hp: 28, speed: 4.6, size: 1.45, melee: 8 },
  { role: 'brute', kind: 'demon', px: 72, hp: 190, speed: 1.7, size: 2.9, ranged: 16, melee: 24, heavy: true },
  { role: 'crawler', kind: 'spider', px: 56, hp: 46, speed: 3.6, size: 1.6, melee: 11 },
  // the second wave: each has its own way of killing you
  { role: 'butcher', kind: 'butcher', px: 72, hp: 240, speed: 1.6, size: 3, melee: 30, heavy: true, armor: 0.3, knock: 7, lvl: 1 },
  { role: 'stalker', kind: 'stalker', px: 64, hp: 50, speed: 4.3, size: 2.3, melee: 16, ghost: true, lvl: 1 },
  { role: 'bloater', kind: 'bloater', px: 56, hp: 60, speed: 1.5, size: 2, burst: 34, lvl: 0 },
  { role: 'skitter', kind: 'skitter', px: 32, hp: 12, speed: 5.2, size: 0.85, melee: 5, pack: true, lvl: 0 },
  { role: 'watcher', kind: 'eye', px: 48, hp: 70, speed: 1.6, size: 1.6, beam: 24, fly: true, lvl: 1 },
  { role: 'priest', kind: 'priest', px: 56, hp: 90, speed: 2, size: 2.1, ranged: 9, summon: true, lvl: 2 },
  { role: 'charger', kind: 'charger', px: 64, hp: 160, speed: 2.4, size: 2.4, melee: 18, charge: 34, heavy: true, lvl: 1 },
  { role: 'leaper', kind: 'leaper', px: 52, hp: 45, speed: 3.2, size: 1.8, melee: 14, leap: true, lvl: 0 },
  { role: 'worm', kind: 'worm', px: 56, hp: 120, speed: 3.4, size: 2.6, melee: 20, burrow: true, lvl: 2 },
  { role: 'gunner', kind: 'gunner', px: 64, hp: 150, speed: 1.6, size: 2.5, mortar: 22, ranged: 22, heavy: true, lvl: 1 }
];
// gritty palettes in the manner of Quake's browns and Heretic's mossy stone: three walls, the floor,
// metal, fog, the torches' light, the liquid, and the sky
const MOODS = [
  { k: 'umber', wall: [[0.44, 0.33, 0.23], [0.36, 0.3, 0.24], [0.3, 0.27, 0.22]], floor: [0.3, 0.25, 0.19], metal: [0.4, 0.37, 0.31], fog: [0.075, 0.055, 0.04], lamp: [1, 0.6, 0.26], liq: 'lava', sky: ['#1a0e08', '#5a2c14'] },
  { k: 'slipgate', wall: [[0.3, 0.32, 0.29], [0.37, 0.33, 0.27], [0.25, 0.29, 0.31]], floor: [0.26, 0.27, 0.23], metal: [0.36, 0.4, 0.42], fog: [0.04, 0.05, 0.05], lamp: [0.8, 0.9, 0.62], liq: 'slime', sky: ['#0c1210', '#2a3a30'] },
  { k: 'heretic', wall: [[0.36, 0.38, 0.31], [0.3, 0.34, 0.27], [0.43, 0.41, 0.34]], floor: [0.28, 0.3, 0.23], metal: [0.4, 0.38, 0.33], fog: [0.035, 0.05, 0.035], lamp: [0.95, 0.78, 0.45], liq: 'water', sky: ['#0c140e', '#34402c'] },
  { k: 'flesh', wall: [[0.47, 0.2, 0.16], [0.4, 0.28, 0.24], [0.53, 0.46, 0.38]], floor: [0.33, 0.16, 0.13], metal: [0.42, 0.32, 0.28], fog: [0.09, 0.02, 0.02], lamp: [1, 0.42, 0.22], liq: 'blood', sky: ['#1a0406', '#601018'] },
  { k: 'sulphur', wall: [[0.5, 0.42, 0.24], [0.42, 0.34, 0.2], [0.36, 0.3, 0.22]], floor: [0.38, 0.32, 0.2], metal: [0.44, 0.4, 0.3], fog: [0.09, 0.07, 0.03], lamp: [1, 0.78, 0.32], liq: 'lava', sky: ['#1a1404', '#6a4a10'] },
  { k: 'crypt', wall: [[0.32, 0.3, 0.34], [0.38, 0.36, 0.38], [0.27, 0.25, 0.3]], floor: [0.24, 0.22, 0.24], metal: [0.36, 0.36, 0.4], fog: [0.04, 0.035, 0.05], lamp: [0.65, 0.7, 1], liq: 'slime', sky: ['#08060c', '#2a2438'] }
];
const KEYS = [['RED', '#ff3b2f'], ['BLUE', '#3b8bff'], ['GOLD', '#ffd23b']];

// ---------------------------------------------------------------- pixel art
function pc(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.pixel = true; fn(c.getContext('2d'), w, h); return c; }
const rect = (x, c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
const ART = {
  tooth: () => pc(8, 10, (x) => { rect(x, '#f4efe2', 1, 0, 6, 6); rect(x, '#f4efe2', 1, 6, 2, 4); rect(x, '#f4efe2', 5, 6, 2, 4); rect(x, '#bfb498', 5, 1, 2, 5); rect(x, '#fff', 2, 1, 1, 3); }),
  chicken: () => pc(16, 12, (x) => { rect(x, '#f2d23c', 3, 4, 9, 5); rect(x, '#f2d23c', 10, 1, 4, 5); rect(x, '#f2d23c', 0, 5, 3, 2); rect(x, '#c99a18', 3, 7, 9, 2); rect(x, '#e8402a', 11, 0, 2, 1); rect(x, '#e8402a', 12, 6, 1, 2); rect(x, '#f08a1c', 14, 3, 2, 1); rect(x, '#111', 12, 2, 1, 1); rect(x, '#f08a1c', 6, 9, 1, 3); rect(x, '#f08a1c', 9, 9, 1, 3); }),
  hive: () => pc(12, 14, (x) => { for (let y = 0; y < 14; y++) { const w = Math.max(1, Math.round(Math.sin(((y + 1) / 15) * Math.PI) * 6)); rect(x, y % 3 === 0 ? '#7a4a14' : '#d9a23a', 6 - w, y, w * 2, 1); } rect(x, '#2a1606', 5, 8, 2, 2); }),
  bee: () => pc(8, 7, (x) => { rect(x, '#dde8ff', 2, 0, 4, 2); rect(x, '#f2c81c', 1, 2, 6, 4); rect(x, '#1a1208', 3, 2, 1, 4); rect(x, '#1a1208', 5, 2, 1, 4); rect(x, '#1a1208', 7, 3, 1, 2); }),
  skull: () => pc(12, 12, (x) => { rect(x, '#efe8d6', 2, 0, 8, 8); rect(x, '#efe8d6', 1, 2, 10, 5); rect(x, '#efe8d6', 3, 8, 6, 3); rect(x, '#c8bea4', 8, 1, 2, 7); rect(x, '#1a0d0a', 3, 3, 2, 3); rect(x, '#1a0d0a', 7, 3, 2, 3); rect(x, '#1a0d0a', 5, 6, 2, 1); rect(x, '#1a0d0a', 4, 9, 1, 2); rect(x, '#1a0d0a', 6, 9, 1, 2); rect(x, '#ff3a1a', 3, 4, 1, 1); rect(x, '#ff3a1a', 7, 4, 1, 1); }),
  squid: () => pc(12, 16, (x) => { rect(x, '#e86aa8', 3, 0, 6, 9); rect(x, '#e86aa8', 2, 2, 8, 5); rect(x, '#b8407a', 7, 1, 2, 8); for (let k = 0; k < 5; k++) rect(x, k % 2 ? '#e86aa8' : '#b8407a', 2 + k * 2, 9, 1, 4 + (k % 3)); rect(x, '#fff', 3, 4, 2, 2); rect(x, '#fff', 7, 4, 2, 2); rect(x, '#111', 4, 5, 1, 1); rect(x, '#111', 8, 5, 1, 1); }),
  marble: () => pc(10, 10, (x) => { x.fillStyle = '#160c26'; x.beginPath(); x.arc(5, 5, 5, 0, TAU); x.fill(); x.strokeStyle = '#9a4cff'; x.beginPath(); x.arc(5, 5, 3, 0.5, 3.6); x.stroke(); rect(x, '#e8dcff', 2, 2, 2, 2); }),
  hole: () => pc(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 2, 16, 16, 16); g.addColorStop(0, '#000'); g.addColorStop(0.36, '#000'); g.addColorStop(0.46, '#ffb35a'); g.addColorStop(0.62, 'rgba(150,60,255,.85)'); g.addColorStop(1, 'rgba(60,0,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }),
  fork: () => pc(10, 16, (x) => { rect(x, '#bfe6ff', 1, 0, 2, 9); rect(x, '#bfe6ff', 7, 0, 2, 9); rect(x, '#bfe6ff', 1, 8, 8, 2); rect(x, '#8fb6d0', 4, 10, 2, 6); rect(x, '#fff', 1, 0, 1, 4); }),
  relic: () => pc(12, 12, (x) => { rect(x, '#8a6a3a', 1, 3, 10, 8); rect(x, '#c9a45a', 2, 2, 8, 2); rect(x, '#3a2a14', 4, 0, 4, 3); }),
  health: () => pc(14, 11, (x) => { rect(x, '#e9e4dc', 0, 1, 14, 10); rect(x, '#b9b2a8', 0, 9, 14, 2); rect(x, '#5a5048', 5, 0, 4, 1); rect(x, '#e8241c', 6, 3, 2, 6); rect(x, '#e8241c', 4, 5, 6, 2); }),
  armor: () => pc(12, 14, (x) => { rect(x, '#3b8bff', 1, 0, 10, 9); rect(x, '#3b8bff', 2, 9, 8, 2); rect(x, '#3b8bff', 4, 11, 4, 2); rect(x, '#9cd0ff', 2, 1, 2, 7); rect(x, '#1c4a9a', 8, 1, 2, 9); rect(x, '#ffe27a', 5, 3, 2, 5); }),
  torch: (k) => pc(8, 16, (x) => { rect(x, '#3a2a1a', 3, 9, 2, 7); rect(x, '#ff7a1a', 2, 3 + k, 4, 6 - k); rect(x, '#ffd23b', 3, 5 + k, 2, 4 - k); rect(x, '#fff3c0', 3, 7, 1, 2); rect(x, '#ff4a10', 3 - k, 1 + k * 2, 1, 2); }),
  // a carcass on a hook (three cuts): the chain, the hook, the meat with its ribs showing, dripping
  hang: (v) => pc(16, 40, (x) => {
    for (let y = 0; y < 14 + v * 2; y += 3) { rect(x, '#2a2826', 7, y, 2, 2); rect(x, '#5a5650', 7, y, 1, 1); }
    const y0 = 14 + v * 2; rect(x, '#3a3632', 6, y0, 4, 2); rect(x, '#3a3632', 9, y0 + 2, 2, 3);
    const top = y0 + 4, len = 40 - top - 3;
    for (let y = 0; y < len; y++) { const k = y / len, w = Math.round(3 + Math.sin(Math.min(1, k * 1.3) * Math.PI) * (v === 1 ? 4 : 5)); rect(x, '#5a1a16', 8 - w, top + y, w * 2, 1); rect(x, '#7a2a22', 8 - w + 1, top + y, Math.max(1, w - 1), 1); if (k > 0.25 && k < 0.75 && y % 3 === 0) rect(x, '#c8b090', 8 - w + 1, top + y, w * 2 - 2, 1); rect(x, '#2a0806', 8 + w - 2, top + y, 2, 1); }
    rect(x, '#4a0a0a', 7, 37, 1, 3); rect(x, '#4a0a0a', 9, 36, 1, 2);
  }),
  // a dead tree: a split, twisted trunk and bare black branches (three of them)
  deadtree: (v) => pc(36, 60, (x) => {
    const R = mulberry32(31 + v * 7), lim = (x0, y0, a, len, w, d) => { let px = x0, py = y0; for (let k = 0; k < len; k++) { const ww = Math.max(1, Math.round(w * (1 - k / len))); rect(x, '#1e1814', Math.round(px - ww / 2), Math.round(py), ww, 1); rect(x, '#3a2e26', Math.round(px - ww / 2), Math.round(py), Math.max(1, ww >> 1), 1); px += Math.cos(a) * 1.1; py += Math.sin(a) * 1.1; a += (R() - 0.5) * 0.35; if (d < 3 && k > 3 && R() < 0.12) lim(px, py, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), Math.floor(len * 0.5), ww, d + 1); } };
    for (let y = 60; y > 24; y--) { const t = (60 - y) / 36, w = Math.round(8 - t * 5 + (y > 56 ? 4 : 0)), cx = 18 + Math.sin(y * 0.18 + v) * 2; rect(x, '#1c1612', Math.round(cx - w / 2), y, w, 1); rect(x, '#3e322a', Math.round(cx - w / 2), y, Math.max(1, w >> 2), 1); if (y % 5 === v % 5) rect(x, '#0c0a08', Math.round(cx), y, 1, 2); }
    for (let k = 0; k < 4; k++) lim(18 + (R() - 0.5) * 3, 26 + k * 3, -Math.PI / 2 + (k % 2 ? 0.7 : -0.7) + (R() - 0.5) * 0.4, 14 + Math.floor(R() * 8), 3, 0);
  }),
  // a stake with a head on it, and what ran down
  stake: (v) => pc(10, 38, (x) => {
    rect(x, '#3a2a1c', 4, 10, 3, 28); rect(x, '#5a4430', 4, 10, 1, 28); rect(x, '#2a1c12', 5, 6, 1, 5);
    const sk = ['#c8bca0', '#8a6a5a', '#6a7a5a'][v % 3]; rect(x, sk, 2, 3, 7, 7); rect(x, sk, 3, 2, 5, 9); rect(x, '#0c0806', 3, 5, 2, 2); rect(x, '#0c0806', 6, 5, 2, 2); rect(x, '#2a0606', 4, 8, 3, 1);
    rect(x, '#5a0a0a', 4, 10, 2, 10 + v * 3); rect(x, '#3a0606', 5, 12, 1, 14);
  }),
  stones: (v) => pc(22, 11, (x) => { const R = mulberry32(5 + v); for (let k = 0; k < 7; k++) { const cx = 3 + R() * 16, cy = 5 + R() * 5, rr = 1.5 + R() * 2.5; x.fillStyle = ['#4a443e', '#5a524a', '#3a3530'][k % 3]; x.beginPath(); x.ellipse(cx, cy, rr * 1.3, rr, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,240,220,.18)'; x.fillRect(Math.round(cx - rr * 0.6), Math.round(cy - rr * 0.7), 2, 1); } }),
  eyes: (col) => pc(12, 4, (x) => { rect(x, 'rgba(255,40,10,.35)', 0, 0, 5, 4); rect(x, 'rgba(255,40,10,.35)', 7, 0, 5, 4); rect(x, col, 1, 1, 3, 2); rect(x, col, 8, 1, 3, 2); rect(x, '#ffffff', 2, 1, 1, 1); rect(x, '#ffffff', 9, 1, 1, 1); }),
  stakeS: () => pc(20, 4, (x) => { rect(x, '#5a3e24', 0, 1, 15, 2); rect(x, '#7a5a38', 0, 1, 15, 1); rect(x, '#9aa0a8', 15, 1, 3, 2); rect(x, '#d0d6de', 18, 1, 2, 1); rect(x, '#3a2616', 0, 0, 2, 4); }),
  sawdisc: () => pc(14, 14, (x) => { x.fillStyle = '#8a8e96'; x.beginPath(); x.arc(7, 7, 5.5, 0, TAU); x.fill(); x.fillStyle = '#c8ccd4'; for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; x.fillRect(Math.round(7 + Math.cos(a) * 6) - 1, Math.round(7 + Math.sin(a) * 6) - 1, 2, 2); } x.fillStyle = '#2a2c30'; x.beginPath(); x.arc(7, 7, 1.8, 0, TAU); x.fill(); x.fillStyle = 'rgba(160,20,20,.7)'; x.fillRect(3, 8, 3, 2); }),
  mineS: (on) => pc(14, 9, (x) => { rect(x, '#3a3c34', 1, 3, 12, 5); rect(x, '#5a5c50', 2, 3, 10, 1); rect(x, '#1e201a', 0, 7, 14, 2); rect(x, '#8a8a7a', 6, 1, 2, 2); rect(x, on ? '#ff3020' : '#5a1010', 6, 0, 2, 1); }),
  acidglob: () => pc(10, 10, (x) => { x.fillStyle = '#5a9a1a'; x.beginPath(); x.arc(5, 5, 4.2, 0, TAU); x.fill(); x.fillStyle = '#a8f04a'; x.fillRect(3, 3, 2, 2); x.fillStyle = '#3a6a10'; x.fillRect(5, 6, 3, 2); }),
  soulorb: (k) => pc(20, 20, (x) => { const g = x.createRadialGradient(10, 10, 1, 10, 10, 10); g.addColorStop(0, '#f0fff8'); g.addColorStop(0.4, 'rgba(150,255,200,.8)'); g.addColorStop(1, 'rgba(40,120,90,0)'); x.fillStyle = g; x.fillRect(0, 0, 20, 20); x.fillStyle = 'rgba(10,30,20,.85)'; x.fillRect(6, 7, 3, 3 + k); x.fillRect(11, 7, 3, 3 + k); x.fillRect(8, 12 - k, 4, 3 + k * 2); }),
  hookart: () => pc(12, 12, (x) => { rect(x, '#7a7e86', 0, 5, 7, 2); rect(x, '#a8acb4', 7, 3, 2, 6); rect(x, '#a8acb4', 9, 1, 2, 3); rect(x, '#a8acb4', 9, 8, 2, 3); rect(x, '#d0d4dc', 10, 0, 2, 2); rect(x, '#d0d4dc', 10, 10, 2, 2); }),
  bullet: () => pc(3, 8, (x) => { rect(x, '#fff6c0', 1, 0, 1, 8); rect(x, '#ffc040', 0, 2, 3, 4); }),
  pellet: () => pc(3, 3, (x) => { rect(x, '#ffe0a0', 0, 0, 3, 3); rect(x, '#fff', 1, 1, 1, 1); }),
  nail: () => pc(10, 3, (x) => { rect(x, '#9aa0a8', 0, 1, 8, 1); rect(x, '#d0d6de', 0, 0, 2, 3); rect(x, '#ffd080', 8, 1, 2, 1); }),
  rocket: () => pc(14, 7, (x) => { rect(x, '#5a5e56', 2, 2, 9, 3); rect(x, '#8a8e84', 2, 2, 9, 1); rect(x, '#a83020', 11, 2, 2, 3); rect(x, '#3a3c36', 1, 0, 3, 7); rect(x, '#ffd040', 0, 3, 2, 1); }),
  grenade: () => pc(8, 8, (x) => { x.fillStyle = '#3a4a2a'; x.beginPath(); x.arc(4, 4, 3.6, 0, TAU); x.fill(); rect(x, '#5a6a3a', 2, 2, 2, 2); rect(x, '#8a8a7a', 1, 4, 6, 1); rect(x, '#c83a20', 3, 0, 2, 1); }),
  plasma: () => pc(10, 10, (x) => { const g = x.createRadialGradient(5, 5, 0, 5, 5, 5); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#9fe8ff'); g.addColorStop(0.7, 'rgba(90,120,255,.8)'); g.addColorStop(1, 'rgba(60,40,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 10, 10); }),
  // a fireball in five frames: white core, then yellow, orange, red, dark, dithered as it thins
  boom: (k) => pc(32, 32, (x) => {
    const im = x.createImageData(32, 32), d = im.data, R = mulberry32(77 + k), lump = Array.from({ length: 7 }, () => [R() * TAU, 0.55 + R() * 0.45]);
    for (let y = 0; y < 32; y++) for (let xx = 0; xx < 32; xx++) {
      const dx = (xx - 15.5) / 16, dy = (y - 15.5) / 16, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
      let edge = 0.62 + k * 0.07; for (const [la, ls] of lump) edge += Math.cos(a - la) * 0.05 * ls;
      const q = r / edge, heat = 1 - q - k * 0.17 + (BAYER[(y & 3) * 4 + (xx & 3)] / 16 - 0.5) * 0.22;
      if (q > 1 || heat < 0.02 || (k >= 3 && BAYER[(y & 3) * 4 + (xx & 3)] < k * 2.5)) continue;
      const c = heat > 0.62 ? [255, 250, 220] : heat > 0.42 ? [255, 214, 90] : heat > 0.24 ? [255, 138, 40] : heat > 0.1 ? [196, 56, 20] : [80, 30, 20], i = (y * 32 + xx) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  }),
  smoke: () => pc(24, 24, (x) => { const im = x.createImageData(24, 24), d = im.data; for (let y = 0; y < 24; y++) for (let xx = 0; xx < 24; xx++) { const r = Math.hypot(xx - 11.5, y - 11.5) / 12; if (r > 1 || BAYER[(y & 3) * 4 + (xx & 3)] / 16 > 1.15 - r * 1.1) continue; const v = 58 + (1 - r) * 36, i = (y * 24 + xx) * 4; d[i] = v; d[i + 1] = v * 0.92; d[i + 2] = v * 0.86; d[i + 3] = 255; } x.putImageData(im, 0, 0); }),
  barrel: (hit) => pc(14, 18, (x) => { rect(x, '#5a2a1c', 1, 1, 12, 16); rect(x, hit ? '#ff9a5a' : '#8a3a22', 2, 1, 4, 16); rect(x, '#3a1a10', 10, 1, 3, 16); rect(x, '#2a2420', 0, 0, 14, 2); rect(x, '#2a2420', 0, 8, 14, 2); rect(x, '#2a2420', 0, 16, 14, 2); rect(x, '#e8c020', 4, 11, 6, 3); rect(x, '#161616', 6, 11, 2, 3); }),
  candles: (k) => pc(12, 14, (x) => { for (const [cx, h] of [[2, 7], [6, 10], [9, 6]]) { rect(x, '#d8ccb0', cx, 14 - h, 2, h); rect(x, '#a89a80', cx + 1, 14 - h, 1, h); rect(x, k ? '#ffd040' : '#ff9a30', cx, 12 - h - (k && cx === 6 ? 1 : 0), 2, 2); rect(x, '#fff6c0', cx, 13 - h, 1, 1); } rect(x, '#6a5a48', 0, 13, 12, 1); }),
  skulls: () => pc(16, 11, (x) => { for (const [cx, cy] of [[1, 5], [6, 5], [11, 5], [4, 1], [9, 1]]) { rect(x, '#d8ccb0', cx, cy, 4, 4); rect(x, '#efe6d0', cx, cy, 2, 2); rect(x, '#1a1008', cx + 1, cy + 1, 1, 1); rect(x, '#1a1008', cx + 3, cy + 1, 1, 1); rect(x, '#8a7e66', cx + 1, cy + 3, 2, 1); } }),
  gunicon: (k) => pc(22, 10, (x) => {
    const m = '#5a5c60', h = '#8a8e96', w = '#6a4228';
    if (k === 'shotgun') { rect(x, m, 0, 2, 16, 2); rect(x, m, 0, 4, 16, 1); rect(x, w, 12, 3, 10, 4); rect(x, w, 16, 5, 6, 4); }
    else if (k === 'nailgun') { rect(x, m, 2, 1, 14, 6); rect(x, h, 0, 2, 4, 1); rect(x, h, 0, 4, 4, 1); rect(x, '#3a3c40', 12, 6, 4, 4); }
    else if (k === 'rocket') { rect(x, '#4e5a44', 0, 1, 20, 5); rect(x, '#7a866a', 0, 1, 20, 1); rect(x, '#2a2e26', 8, 6, 4, 4); rect(x, '#c83a20', 18, 2, 2, 3); }
    else if (k === 'grenade') { rect(x, m, 4, 1, 10, 7); rect(x, h, 0, 3, 5, 3); rect(x, w, 14, 4, 7, 4); }
    else if (k === 'plasma') { rect(x, '#4a4e68', 2, 1, 16, 6); rect(x, '#9fe8ff', 4, 3, 10, 2); rect(x, '#2a2c40', 14, 6, 4, 4); }
    else if (k === 'chaingun') { for (let q = 0; q < 3; q++) rect(x, q % 2 ? h : m, 0, 1 + q * 2, 14, 2); rect(x, '#3a3c40', 12, 0, 8, 8); rect(x, '#b89040', 16, 7, 3, 3); }
    else if (k === 'flamer') { rect(x, m, 0, 2, 14, 3); rect(x, '#7a2a1a', 12, 0, 8, 9); rect(x, '#ff8a2a', 0, 3, 2, 1); }
    else if (k === 'railgun') { rect(x, m, 0, 3, 18, 3); rect(x, '#9fe8ff', 2, 2, 14, 1); rect(x, '#3a3c40', 14, 4, 6, 6); }
    else if (k === 'stakegun') { rect(x, m, 2, 2, 12, 4); rect(x, '#7a5a38', 0, 3, 4, 2); rect(x, w, 14, 3, 8, 5); }
    else if (k === 'ripper') { rect(x, m, 4, 3, 14, 6); x.fillStyle = '#c8ccd4'; x.beginPath(); x.arc(6, 4, 3.5, 0, TAU); x.fill(); }
    else if (k === 'chainsaw') { rect(x, '#8a8e96', 0, 3, 12, 3); rect(x, '#c84a1a', 11, 1, 9, 8); rect(x, '#2a2c30', 0, 3, 12, 1); }
    else if (k === 'mines') { rect(x, m, 2, 1, 14, 7); rect(x, '#3a3c34', 0, 2, 4, 5); rect(x, '#ff3020', 1, 3, 1, 1); }
    else { rect(x, m, 6, 2, 10, 3); rect(x, '#3a3226', 12, 4, 4, 6); }
  }),
  exit: () => pc(24, 40, (x) => { for (let k = 0; k < 3; k++) { x.strokeStyle = ['#7affd0', '#ffffff', '#3ad7ff'][k]; x.lineWidth = 2; x.beginPath(); x.ellipse(12, 20, 10 - k * 3, 18 - k * 4, 0, 0, TAU); x.stroke(); } })
};
const keyArt = (col) => pc(12, 8, (x) => { rect(x, col, 0, 0, 12, 8); rect(x, '#000', 2, 2, 3, 3); rect(x, 'rgba(255,255,255,.6)', 7, 1, 4, 1); rect(x, 'rgba(0,0,0,.35)', 6, 5, 5, 2); });
const ball = (col) => pc(8, 8, (x) => { x.fillStyle = col; x.beginPath(); x.arc(4, 4, 3.6, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(2, 2, 2, 2); });
// gibs in a creature's own colours: flesh, hide, organ, gut, bone, eye
function gibArt(an, R) {
  const fl = an.flesh, hide = an.hide, org = an.organs?.length ? an.organs.map((o) => o.col) : ['#8a1a1a', '#6a2a1a'], bl = an.blood;
  return [
    pc(8, 8, (x) => { rect(x, fl, 1, 2, 6, 5); rect(x, fl, 2, 1, 4, 1); rect(x, bl, 2, 3, 2, 2); rect(x, bl, 5, 5, 1, 1); }),
    pc(8, 8, (x) => { rect(x, hide, 1, 1, 6, 5); rect(x, fl, 1, 5, 6, 2); rect(x, bl, 3, 6, 2, 1); }),
    pc(8, 8, (x) => { rect(x, org[Math.floor(R() * org.length)], 1, 1, 6, 6); rect(x, 'rgba(255,255,255,.4)', 2, 2, 2, 1); rect(x, bl, 5, 5, 2, 2); }),
    pc(10, 6, (x) => { const c = org[org.length > 4 ? 4 : 0]; for (let k = 0; k < 9; k++) rect(x, c, k, 2 + Math.round(Math.sin(k * 1.3) * 2), 2, 2); }),
    pc(10, 4, (x) => { rect(x, '#efe6d0', 2, 1, 6, 2); rect(x, '#efe6d0', 0, 0, 2, 4); rect(x, '#efe6d0', 8, 0, 2, 4); }),
    pc(6, 6, (x) => { rect(x, '#f4f0ea', 1, 0, 4, 6); rect(x, '#f4f0ea', 0, 1, 6, 4); rect(x, an.glow || '#2a2a2a', 2, 2, 2, 2); rect(x, bl, 4, 4, 2, 2); })
  ];
}
// four pixel splats (white, tinted per vertex) for blood and ink decals
function splatAtlas() {
  const R = mulberry32(99);
  return pc(64, 64, (x) => {
    x.fillStyle = '#fff';
    for (let k = 0; k < 4; k++) {
      const ox = (k % 2) * 32 + 16, oy = Math.floor(k / 2) * 32 + 16;
      for (let i = 0; i < 9 + k * 3; i++) { const a = R() * TAU, d = i ? 3 + R() * 9 : 0, r = i ? 1 + R() * 3.5 : 6 + R() * 2; x.beginPath(); x.arc(Math.round(ox + Math.cos(a) * d), Math.round(oy + Math.sin(a) * d), r, 0, TAU); x.fill(); }
      for (let i = 0; i < 6; i++) { const a = R() * TAU, d = 10 + R() * 4; x.fillRect(Math.round(ox + Math.cos(a) * d), Math.round(oy + Math.sin(a) * d), 1 + Math.floor(R() * 2), 1 + Math.floor(R() * 2)); }
    }
    const d = x.getImageData(0, 0, 64, 64); for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 100 ? 255 : 0; x.putImageData(d, 0, 0);
  });
}

// ---------------------------------------------------------------- the weapon's look
// parts for the view model: shaded cylinders, bevelled boxes, worn wood, rivets, bores, gloved hands
function gunParts(R) {
  const sh = (col, k) => { const [r, g, b] = rgbOf(col); return `rgb(${clamp(Math.round(r * k), 0, 255)},${clamp(Math.round(g * k), 0, 255)},${clamp(Math.round(b * k), 0, 255)})`; };
  const mixw = (col, k, to = [232, 220, 200]) => { const c = rgbOf(col); return `rgb(${c.map((v, i) => Math.round(v + (to[i] - v) * k)).join(',')})`; };
  const box = (col, a, b, w, h) => { R(sh(col, 1.08), a, b, w, h); R(mixw(col, 0.35), a, b, w, 1); R(sh(col, 1.5), a, b + 1, w, 1); R(sh(col, 1.3), a, b + 1, 1, h - 1); R(sh(col, 0.5), a + w - 2, b + 1, 2, h - 1); R(sh(col, 0.4), a, b + h - 1, w, 1); };
  // lit from the upper left: a hot specular line a third of the way across, deep shade on the far side
  const cyl = (col, a, b, w, h) => {
    for (let i = 0; i < w; i++) { const u = (i + 0.5) / w, k = 0.28 + 1.25 * Math.pow(Math.sin(u * Math.PI), 0.8) * (1.25 - 0.75 * u), hot = Math.max(0, 1 - Math.abs(u - 0.27) / 0.07); R(hot > 0 ? mixw(sh(col, k), hot * 0.5) : sh(col, k), a + i, b, 1, h); }
    R(sh(col, 0.3), a, b + h - 1, w, 1);
  };
  const grain = (col, a, b, w, h) => { box(col, a, b, w, h); for (let q = 1; q < h - 1; q += 2) R(sh(col, 0.8 + ((q * 7) % 5) * 0.05), a + 1 + ((q * 3) % 4), b + q, w - 3 - ((q * 5) % 6), 1); };
  const bore = (a, b, w, h) => { R('#050303', a, b, w, h); R('#22180f', a + 1, b + h - 1, w - 2, 1); };
  const rivet = (a, b) => { R('#0c0907', a, b, 2, 2); R('rgba(255,236,210,.45)', a, b, 1, 1); };
  // worn leather gloves: rounded fingers with a lit top edge and a shadowed underside, knuckles, seams
  const GL = ['#1a110c', '#3e2a1c', '#5a3e2a', '#7a5a40'];
  const finger = (a, b, w, h, vert) => {
    R(GL[0], a - 1, b - 1, w + 2, h + 2); R(GL[1], a, b, w, h);
    if (vert) { R(GL[2], a + 1, b, Math.max(1, w - 3), h - 2); R(GL[3], a + 1, b + 1, 1, h - 4); R(GL[0], a, b + h - 1, w, 1); R(GL[1], a, b - 1, w, 1); }
    else { R(GL[2], a, b + 1, w - 2, Math.max(1, h - 3)); R(GL[3], a + 1, b + 1, w - 6, 1); R(GL[0], a, b + h - 1, w, 1); R(GL[1], a - 1, b, 1, h); }
  };
  // a gloved right hand round a grip (its top at y): four fingers wrapped across it, the thumb up its
  // near side, the forearm in a dark sleeve going off the bottom
  const hand = (cx, top) => {
    for (let y = top + 14; y < 120; y++) { const d = y - top, x0 = cx - 9 + d * 0.5; R(d < 21 ? GL[1] : '#24231e', x0, y, 30 + d * 0.3, 1); R(d < 21 ? GL[2] : '#33322a', x0 + 2, y, 3, 1); if (d === 21) R('#0e0c0a', x0, y, 30 + d * 0.3, 2); }
    R(GL[0], cx - 12, top - 3, 26, 22);
    for (let k = 0; k < 4; k++) { const fy = top - 2 + k * 5, wd = 24 - Math.abs(k - 1.2) * 2; finger(cx - 11, fy, wd, 4, false); R(GL[3], cx + wd - 14, fy + 1, 2, 2); }
    finger(cx - 16, top - 6, 6, 15, true);
  };
  // the left hand on a fore-end: fingers curled over the top, the arm coming in from the lower left
  const handL = (x, y) => {
    for (let yy = y + 14; yy < 120; yy++) { const d = yy - y; R(d < 22 ? GL[1] : '#24231e', x - 20 - d * 0.75, yy, 32, 1); R(d < 22 ? GL[2] : '#33322a', x - 18 - d * 0.75, yy, 3, 1); }
    R(GL[0], x - 4, y + 4, 26, 18);
    for (let k = 0; k < 4; k++) finger(x - 2 + k * 6, y - 2 + Math.abs(k - 1.5) * 1.5, 5, 16, true);
    finger(x - 8, y + 8, 12, 6, false);
  };
  return { sh, box, cyl, grain, bore, rivet, hand, handL };
}
// the grime over a weapon: a field of grit, rust, scratches and old blood (made once per weapon,
// fixed to it), and the pass that lays it on: soot round the silhouette, darker low down, a dark
// outline, and the colours dithered down to a few dirty tones
// the view model's perspective: drawn in 180×120, shown in 180×GUN_H; the far end is GUN_FAR as wide as the near
const GUN_H = 60, GUN_FAR = 0.5;
// where a point of the upright drawing lands in the laid-down one: [x, y, width scale]
// lay the upright drawing down: each row of the result takes the row of the drawing at its depth,
// narrowed to that depth's width (the far, muzzle end GUN_FAR as wide as the near)
function warpGun(src, out) {
  out ||= pc(180, GUN_H, () => {});
  const x = out.getContext('2d');
  x.clearRect(0, 0, 180, GUN_H); x.imageSmoothingEnabled = false;
  for (let j = 0; j < GUN_H; j++) { const t = (j + 0.5) / GUN_H, inv = GUN_FAR + t * (1 - GUN_FAR), v = (1 / GUN_FAR - 1 / inv) / (1 / GUN_FAR - 1), sy = Math.min(119, Math.floor(v * 120)), w = 180 * inv; x.drawImage(src, 0, sy, 180, 1, 90 - w / 2, j, w, 1); }
  return out;
}
function gunWarp(x, y) { const v = clamp(y / 120, 0, 1), inv = 1 / (1 / GUN_FAR - v * (1 / GUN_FAR - 1)); return [90 + (x - 90) * inv, ((inv - GUN_FAR) / (1 - GUN_FAR)) * GUN_H, inv]; }
const grimeFields = new Map();
function grimeField(seed, w, h) {
  let F = grimeFields.get(seed);
  if (F) return F;
  const R = mulberry32(seed ^ 0x6a17), lat = (n) => Float32Array.from({ length: n * n }, () => R());
  const vn = (L, n, x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, a = L[(y0 % n) * n + (x0 % n)], b = L[(y0 % n) * n + ((x0 + 1) % n)], c = L[((y0 + 1) % n) * n + (x0 % n)], d = L[((y0 + 1) % n) * n + ((x0 + 1) % n)]; return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  const L1 = lat(64), L2 = lat(64), L3 = lat(64), tex = new Float32Array(w * h), rust = new Float32Array(w * h), blood = new Float32Array(w * h), scr = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    tex[i] = vn(L1, 64, x / 6, y / 6) * 0.55 + vn(L2, 64, x / 2.2, y / 2.2) * 0.3 + R() * 0.15;
    rust[i] = vn(L3, 64, x / 9, y / 9) * 0.7 + vn(L2, 64, x / 3 + 17, y / 3 + 5) * 0.3;
  }
  for (let k = 0; k < 14; k++) { let x = 60 + R() * 60, y = 20 + R() * 90; const a = R() * TAU, l = 4 + R() * 10; for (let q = 0; q < l; q++) { x += Math.cos(a); y += Math.sin(a) * 0.6; const i = Math.round(y) * w + Math.round(x); if (i >= 0 && i < w * h) scr[i] = 1; } }
  for (let k = 0; k < 2 + Math.floor(R() * 4); k++) {
    const cx = 64 + R() * 52, cy = 40 + R() * 70, r = 1 + R() * 2.6;
    for (let n = 0; n < 10; n++) { const a = R() * TAU, d = R() * r * 2.2, sx = cx + Math.cos(a) * d, sy = cy + Math.sin(a) * d, rr = 0.5 + R() * (n ? r * 0.35 : r * 0.7); for (let y = Math.floor(sy - rr); y <= sy + rr; y++) for (let x = Math.floor(sx - rr); x <= sx + rr; x++) if (x >= 0 && y >= 0 && x < w && y < h && Math.hypot(x - sx, y - sy) <= rr) blood[y * w + x] = Math.max(blood[y * w + x], 0.55 + R() * 0.3); }
    if (R() < 0.7) { const dx = Math.round(cx + (R() - 0.5) * r), l = 4 + R() * 12; for (let q = 0; q < l; q++) { const y = Math.round(cy + q); if (y < h) blood[y * w + dx] = Math.max(blood[y * w + dx], 0.7 - q * 0.03); } }
  }
  F = { tex, rust, blood, scr };
  grimeFields.set(seed, F);
  if (grimeFields.size > 12) grimeFields.delete(grimeFields.keys().next().value);
  return F;
}
function grimeGun(src, seed, out) {
  const w = src.width, h = src.height, F = grimeField(seed, w, h), sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  out ||= pc(w, h, () => {});
  const ox = out.getContext('2d'), im = ox.createImageData(w, h), o = im.data, A = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) A[i] = sd[i * 4 + 3] > 60 ? 1 : 0;
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, j = i * 4;
    if (!A[i]) { if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) { o[j] = 9; o[j + 1] = 6; o[j + 2] = 5; o[j + 3] = 240; } continue; }
    // how near the edge of the silhouette: soot gathers there
    let e = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0]]) if (!op(x + dx, y + dy)) e++;
    let r = sd[j], g = sd[j + 1], b = sd[j + 2];
    const k = (0.8 + 0.34 * F.tex[i]) * (1.05 - 0.3 * (y / h)) * (1 - e * 0.045);
    r *= k; g *= k; b *= k;
    const ru = clamp((F.rust[i] - 0.56) * 2.6 + (y / h - 0.55) * 0.35, 0, 0.7);
    if (ru > 0) { const q = ru * (0.65 + 0.35 * F.tex[i]); r += (92 - r) * q; g += (42 - g) * q; b += (20 - b) * q; }
    if (F.blood[i] > 0) { const q = F.blood[i]; r += (58 - r) * q; g += (5 - g) * q; b += (7 - b) * q; }
    if (F.scr[i] && r + g + b > 90) { r += 34; g += 30; b += 26; }
    // dirtier overall: everything pulled a little toward soot
    r += (24 - r) * 0.08; g += (18 - g) * 0.08; b += (14 - b) * 0.08;
    const lu = r * 0.3 + g * 0.59 + b * 0.11; r = lu + (r - lu) * 0.68; g = lu + (g - lu) * 0.68; b = lu + (b - lu) * 0.68;
    const bq = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 16, Q = (v) => clamp(Math.round((v + bq) / 16) * 16, 0, 255);
    o[j] = Q(r); o[j + 1] = Q(g); o[j + 2] = Q(b); o[j + 3] = 255;
  }
  ox.putImageData(im, 0, 0);
  return out;
}

// the creatures made dirtier: grit in every pixel, blotches of filth and dried blood (thicker low
// down, where it splashes), colours dulled and dithered to the levels' palette, darker toward the
// feet. Eyes and anything glowing keep their light. Done once per frame of each sheet, kept.
const grimed = new WeakMap();
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
function grimeSprite(cv) {
  if (!cv?.getContext) return cv;
  let out = grimed.get(cv);
  if (out) return out;
  const w = cv.width, h = cv.height, sd = cv.getContext('2d').getImageData(0, 0, w, h), d = sd.data, F = gritField(), N = F.N;
  for (let y = 0; y < h; y++) {
    const v = y / h, shade = 1.06 - 0.32 * v, gv = v * 0.18 - 0.7, row = (y % N) * N;
    for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4;
      if (d[j + 3] < 8) continue;
      let r = d[j], g = d[j + 1], b = d[j + 2];
      const mx = r > g ? (r > b ? r : b) : g > b ? g : b, mn = r < g ? (r < b ? r : b) : g < b ? g : b;
      if (mx > 215 && mx - mn > 90) continue;   // a glowing eye or ember: leave it lit
      const i = row + (x % N), lu = r * 0.3 + g * 0.59 + b * 0.11, k = F.tex[i] * shade;
      r = (lu + (r - lu) * 0.62) * k; g = (lu + (g - lu) * 0.62) * k; b = (lu + (b - lu) * 0.62) * k;
      const dt2 = F.dirt[i];
      if (dt2 > 0) { r += (30 - r) * dt2; g += (24 - g) * dt2; b += (18 - b) * dt2; }
      const gr = (F.gore[i] + gv) * 3;
      if (gr > 0) { const q = gr > 0.7 ? 0.7 : gr; r += (74 - r) * q; g += (8 - g) * q; b += (10 - b) * q; }
      const bq = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 14;
      d[j] = clamp(Math.round((r + bq) / 14) * 14, 0, 255); d[j + 1] = clamp(Math.round((g + bq) / 14) * 14, 0, 255); d[j + 2] = clamp(Math.round((b + bq) / 14) * 14, 0, 255);
    }
  }
  melt(d, w, h);
  out = pc(w, h, () => {});
  out.getContext('2d').putImageData(sd, 0, 0);
  grimed.set(cv, out);
  return out;
}
// The meltdown: in about a third of the columns the lower part of each run of body slumps, its pixels
// sorted by brightness so the light sinks to the bottom (pixel sorting, run downward), and now and
// then it runs on past the body as a drip a few pixels long. Glowing pixels (eyes) are left where they are.
function melt(d, w, h) {
  const hs = (a, b) => { let q = (a * 374761393 + b * 668265263 + 0x51ed) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  const lum = (j) => d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11, hot = (j) => { const mx = Math.max(d[j], d[j + 1], d[j + 2]), mn = Math.min(d[j], d[j + 1], d[j + 2]); return mx > 215 && mx - mn > 90; };
  const seg = [];
  for (let x = 0; x < w; x++) {
    if (hs(x, w) > 0.34) continue;
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

// ---------------------------------------------------------------- level generator (pure data)
// Rooms sit on a coarse grid; each is a polygon (rect, chamfered, octagon, round, cross, L, cave)
// with flat port edges where corridors join. Corridors are runs of quad sectors: flat, ramps,
// stairs, doors and slit windows. Holes in a room are pillars, broken partition walls or nested
// sectors (daises, pools, pits, skylights, a canal); slabs are boxes standing in sectors (bridge,
// railings, steps, doors, a gallery's walkway). The grid grows with the level, with more loops.
const shp = (k, rad, cx, cy) => (k === 'sq' ? ngon(4, rad * 1.25, Math.PI / 4, cx, cy) : k === 'hex' ? ngon(6, rad, 0, cx, cy) : k === 'oct' ? ngon(8, rad, Math.PI / 8, cx, cy) : ngon(12, rad, 0, cx, cy));
const dx2 = (a, b) => a.x - b.x, dy2 = (a, b) => a.y - b.y;
function genLevel(seed, lv) {
  const R = mulberry32(seed), r = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(r(a, b + 1)), pick = (a) => a[Math.floor(R() * a.length)];
  const GX = [4, 4, 5, 5][Math.min(3, lv)], GY = [3, 4, 4, 5][Math.min(3, lv)];
  const at = new Map(), K = (i, j) => i + j * 64, rooms = [], links = [], secs = [], slabs = [], doors = [];
  const add = (i, j, par) => { const rm = { i, j, id: rooms.length, cx: (i + 0.5) * CELL, cy: (j + 0.5) * CELL, ports: [], links: [], par, depth: par ? par.depth + 1 : 0 }; rooms.push(rm); at.set(K(i, j), rm); return rm; };
  const link = (a, b, tree) => { const l = { a, b, tree, id: links.length }; links.push(l); a.links.push(l); b.links.push(l); return l; };
  add(ri(0, GX - 1), ri(0, GY - 1), null);
  const want = Math.max(5, Math.round(GX * GY * r(0.62, 0.82)));
  for (let g = 0; rooms.length < want && g < 800; g++) {
    const f = pick(rooms), [di, dj] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]), i = f.i + di, j = f.j + dj;
    if (i < 0 || j < 0 || i >= GX || j >= GY || at.has(K(i, j))) continue;
    link(f, add(i, j, f), true);
  }
  const start = rooms[0], exit = rooms.slice(1).sort((a, b) => b.depth - a.depth)[0];
  const keyRoom = rooms.filter((x) => x !== start && x !== exit).sort((a, b) => b.depth - a.depth)[0];
  const secret = rooms.find((x) => x.links.length === 1 && x !== start && x !== exit && x !== keyRoom && R() < 0.85) || null;
  for (const a of rooms) for (const [di, dj] of [[1, 0], [0, 1]]) {
    const b = at.get(K(a.i + di, a.j + dj));
    if (!b || [a, b].some((x) => x === exit || x === secret) || a.links.some((l) => l.a === b || l.b === b) || R() > 0.52) continue;
    link(a, b, false).loop = true;
  }
  start.h = 0;
  for (const rm of rooms) if (rm.par) rm.h = clamp(rm.par.h + pick([0, 0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2]), -3, 3);
  const hallC = rooms.filter((x) => x !== start && x !== exit && x !== secret && x.links.length >= 2);
  const hall = hallC.length && R() < 0.9 ? pick(hallC) : null;
  const claimed = new Set();
  for (const rm of rooms) {
    const kr = R();
    rm.kind = rm === hall ? 'hall' : rm === exit ? 'shrine' : rm === secret ? 'secret' : kr < 0.2 ? 'yard' : kr < 0.36 ? 'wild' : 'room';
    // open ground spreads into an empty cell next to it, if there is one: a courtyard or a wild place twice the size
    if (rm.kind === 'yard' || rm.kind === 'wild') {
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => { const i = rm.i + di, j = rm.j + dj; return i >= 0 && j >= 0 && i < GX && j < GY && !at.has(K(i, j)) && !claimed.has(K(i, j)); });
      if (opts.length && R() < 0.8) { rm.ext = pick(opts); claimed.add(K(rm.i + rm.ext[0], rm.j + rm.ext[1])); }
    }
    // a gallery: a tall square room with a walkway round three sides and a stair up the fourth
    rm.gal = rm.kind === 'room' && R() < 0.26;
    rm.shape = rm.kind === 'wild' ? 'wild' : rm.ext ? 'ext' : rm.gal || rm.kind === 'hall' ? 'rect' : rm.kind === 'yard' ? pick(['rect', 'cham', 'round', 'cave']) : rm.kind === 'secret' ? 'oct' : pick(['rect', 'cham', 'oct', 'round', 'cross', 'L', 'cave', 'oct', 'cham']);
    const big = rm.kind === 'hall' || rm.kind === 'yard' || rm.kind === 'wild';
    rm.R = big ? r(6.6, 7) : rm.kind === 'secret' ? r(3.8, 4.6) : rm.gal ? r(6, 6.8) : r(5, 6.5);
    const sq = rm.shape === 'rect' || rm.shape === 'cham' || rm.shape === 'L' || rm.shape === 'ext';
    rm.a = rm.R * (sq && !big ? r(rm.gal ? 0.9 : 0.82, 1) : 1); rm.b = rm.R * (sq && !big ? r(rm.gal ? 0.9 : 0.82, 1) : 1);
    rm.t = r(2.8, 3.4); rm.ch = r(0.9, 1.8); rm.qx = pick([-1, 1]); rm.qy = pick([-1, 1]);
    rm.lim = rm.shape === 'cross' ? rm.t - 0.25 : rm.shape === 'L' ? Math.max(3, Math.min(rm.a, rm.b) * 0.5) - 0.3 : 0.55 * Math.min(rm.a, rm.b);
  }
  for (const l of links) {
    if (l.a.i > l.b.i || l.a.j > l.b.j) [l.a, l.b] = [l.b, l.a];
    l.ax = l.a.j === l.b.j ? 'x' : 'y';
    const hw = r(1.15, 1.55), lim = Math.max(0, Math.min(l.a.lim, l.b.lim) - hw), o = r(-1, 1) * Math.min(lim, 1);
    l.lo = o - hw; l.hi = o + hw;
    l.pa = { ax: l.ax, sgn: 1, lo: l.lo, hi: l.hi, link: l }; l.pb = { ax: l.ax, sgn: -1, lo: l.lo, hi: l.hi, link: l };
    l.a.ports.push(l.pa); l.b.ports.push(l.pb);
    l.ch = r(2.7, 3.3); l.light = r(0.42, 0.8); l.wall = pick(['wall2', 'metal', 'wall1']); l.ramp = R() < 0.4;
    const other = (x) => (l.a === x ? l.b : l.a);
    if (l.a === exit || l.b === exit) l.door = { at: l.b === exit ? 'b' : 'a', key: 0 };
    else if (secret && (l.a === secret || l.b === secret)) l.door = { at: l.a === secret ? 'b' : 'a', secret: true, room: other(secret) };
    else if (l.loop) l.win = Math.abs(l.a.h - l.b.h) > 2.2 || R() < 0.5;
    else if (R() < 0.22) l.door = { at: R() < 0.5 ? 'a' : 'b' };
  }
  const base = (rm) => {
    const { a, b, R: Rr } = rm, [di, dj] = rm.ext || [0, 0];
    switch (rm.shape) {
      // a courtyard over two cells: a long rectangle running into the empty one
      case 'ext': return box(di < 0 ? -a - CELL : -a, dj < 0 ? -b - CELL : -b, di > 0 ? a + CELL : a, dj > 0 ? b + CELL : b);
      // a wild place: a rough blob, built as the distance out from this cell's middle in every direction
      // (so it can never fold over itself), over two cells if it spreads
      case 'wild': {
        const ox = (di * CELL) / 2, oy = (dj * CELL) / 2, rx = a + (Math.abs(di) * CELL) / 2 - 0.4, ry = b + (Math.abs(dj) * CELL) / 2 - 0.4, n = 30, ph = r(0, TAU), ph2 = r(0, TAU);
        return Array.from({ length: n }, (_, k) => {
          const t = (k / n) * TAU, c = Math.cos(t), sn = Math.sin(t), A2 = (c / rx) ** 2 + (sn / ry) ** 2, B2 = -2 * ((ox * c) / rx ** 2 + (oy * sn) / ry ** 2), C2 = (ox / rx) ** 2 + (oy / ry) ** 2 - 1;
          const d = (-B2 + Math.sqrt(Math.max(0, B2 * B2 - 4 * A2 * C2))) / (2 * A2), q = d * (0.86 + 0.08 * Math.sin(t * 3 + ph) + 0.05 * Math.sin(t * 7 + ph2));
          return [c * q, sn * q];
        });
      }
      case 'rect': return box(-a, -b, a, b);
      case 'cham': { const c = rm.ch; return [[a, -b + c], [a, b - c], [a - c, b], [-a + c, b], [-a, b - c], [-a, -b + c], [-a + c, -b], [a - c, -b]]; }
      case 'oct': return ngon(8, Rr / Math.cos(Math.PI / 8), Math.PI / 8, 0, 0);
      case 'round': { const n = ri(12, 18); return ngon(n, Rr, Math.PI / n, 0, 0); }
      case 'cave': return Array.from({ length: 18 }, (_, k) => { const t = (k / 18) * TAU, q = Rr * (0.86 + 0.14 * Math.sin(t * 3 + rm.id) * Math.cos(t * 2 - rm.id * 0.7) + r(-0.03, 0.03)); return [Math.cos(t) * q, Math.sin(t) * q]; });
      case 'cross': { const t = rm.t; return [[a, -t], [a, t], [t, t], [t, b], [-t, b], [-t, t], [-a, t], [-a, -t], [-t, -t], [-t, -b], [t, -b], [t, -t]]; }
      default: { const ca = Math.max(3, a * 0.5), cb = Math.max(3, b * 0.5); return [[a, -b], [a, cb], [ca, cb], [ca, b], [-a, b], [-a, -b]].map(([x, y]) => [x * rm.qx, y * rm.qy]); }
    }
  };
  // a star-shaped room outline with a flat edge at every port
  const roomPoly = (rm) => {
    const B = base(rm), ins = [];
    let pts = B.map(([x, y]) => ({ x, y, a: Math.atan2(y, x) }));
    for (const p of rm.ports) {
      const ds = [p.lo, p.hi].map((v) => { const dx = p.ax === 'x' ? p.sgn * 20 : v, dy = p.ax === 'x' ? v : p.sgn * 20, l = Math.hypot(dx, dy); return (rayPoly(B, dx / l, dy / l) * Math.abs(p.ax === 'x' ? dx : dy)) / l; });
      p.d = Math.min(...ds) * 0.995;
      const e = [p.lo, p.hi].map((v) => (p.ax === 'x' ? [p.sgn * p.d, v] : [v, p.sgn * p.d]));
      const mid = p.ax === 'x' ? Math.atan2((p.lo + p.hi) / 2, p.sgn * p.d) : Math.atan2(p.sgn * p.d, (p.lo + p.hi) / 2);
      const w = Math.max(...e.map(([x, y]) => Math.abs(angTo(mid, Math.atan2(y, x))))) + 0.03;
      pts = pts.filter((q) => Math.abs(angTo(mid, q.a)) > w);
      p.w = (p.ax === 'x' ? rm.cx : rm.cy) + p.sgn * p.d;
      p.mid = p.ax === 'x' ? [p.w, rm.cy + (p.lo + p.hi) / 2] : [rm.cx + (p.lo + p.hi) / 2, p.w];
      for (const v of [p.lo, p.hi]) ins.push(p.ax === 'x' ? { X: p.w, Y: rm.cy + v, a: Math.atan2(v, p.sgn * p.d) } : { X: rm.cx + v, Y: p.w, a: Math.atan2(p.sgn * p.d, v) });
    }
    return [...pts.map((q) => ({ X: rm.cx + q.x, Y: rm.cy + q.y, a: q.a })), ...ins].sort((u, v) => u.a - v.a).map((q) => [q.X, q.Y]);
  };
  const rin = (P, cx, cy) => { const L = P.map(([x, y]) => [x - cx, y - cy]); let m = Infinity; for (let k = 0; k < 24; k++) m = Math.min(m, rayPoly(L, Math.cos((k * TAU) / 24 + 0.1), Math.sin((k * TAU) / 24 + 0.1))); return m; };
  const nest = (outer, rings) => {
    let par = outer;
    for (const q of rings) {
      par.holes.push(cw(q.p));
      const s = { poly: ccw(q.p), holes: [], f: flat(q.h), c: q.c || par.c, sky: q.sky ?? par.sky, light: q.light ?? par.light, tex: { ...par.tex, ...(q.tex || {}) }, room: par.room, liq: q.liq };
      secs.push(s); par = s;
    }
    return par;
  };
  for (const rm of rooms) {
    const P = roomPoly(rm), rn = rin(P, rm.cx, rm.cy), h = rm.h;
    // the gallery's stair goes up a side with no doorway in it
    const freeSide = [0, 1, 2, 3].filter((sd) => !rm.ports.some((p) => p.ax === (sd % 2 ? 'y' : 'x') && p.sgn === (sd < 2 ? 1 : -1)));
    if (rm.gal && !freeSide.length) rm.gal = false;
    const wild = rm.kind === 'wild', sky = rm.kind === 'yard' || (wild && R() < 0.85) || (rm.kind === 'hall' && R() < 0.5), ch = sky ? r(wild ? 6.5 : 5, wild ? 9 : 7.5) : wild ? r(4.2, 5.5) : rm.kind === 'hall' ? r(6, 7) : rm.kind === 'secret' ? 3 : rm.gal ? r(5, 5.8) : r(3.2, 5);
    const S = { poly: P, holes: [], f: flat(h), c: flat(h + ch), sky, light: sky ? r(1, 1.15) : wild ? r(0.6, 0.8) : rm.kind === 'shrine' ? 0.62 : rm.kind === 'secret' ? 1 : r(0.55, 0.95), room: rm,
      tex: { wall: wild ? 'cliff' : rm.kind === 'yard' ? 'wall1' : rm.kind === 'secret' ? 'wall2' : pick(['wall0', 'wall0', 'wall1']), floor: wild ? 'dirt' : rm.kind === 'yard' ? 'rock' : 'floor0', ceil: wild ? 'rock' : 'ceil' } };
    let feat = wild ? 'wild' : rm.kind === 'hall' ? 'canal' : rm.kind === 'shrine' ? 'dais' : rm.kind === 'secret' ? 'none' : rm === start ? pick(rm.gal ? ['none', 'none'] : ['none', 'sky']) : rm.gal ? pick(['none', 'pool', 'columns', 'pit', 'none']) : rm.kind === 'yard' ? pick(['blocks', 'pool', 'none', 'blocks', 'baffles']) : pick(['pillars', 'pillars', 'dais', 'pool', 'pit', 'sky', 'none', 'columns', 'baffles', 'baffles']);
    if (feat === 'baffles' && rn < 4.2) feat = 'pillars';
    if (!sky && !rm.gal && rm.kind === 'room' && R() < 0.35) { const g = r(-0.13, 0.13), ax = R() < 0.5; S.c = { h: h + ch + 0.9, gx: ax ? g : 0, gy: ax ? 0 : g, ox: rm.cx, oy: rm.cy }; }
    if (rm.kind === 'room' && !rm.gal && rm !== start && R() < 0.15) { const g = r(-0.07, 0.07), ax = R() < 0.5; S.f = { h, gx: ax ? g : 0, gy: ax ? 0 : g, ox: rm.cx, oy: rm.cy }; if (feat !== 'pillars') feat = 'none'; }
    secs.push(S); rm.S = S; rm.rin = rn; rm.feat = feat;
    const sh = pick(['oct', 'round', 'sq', 'hex']), P2 = (rad) => shp(sh, rad, rm.cx, rm.cy);
    if (feat === 'pillars') { const q = rn * 0.5, pr = clamp(rn * 0.13, 0.4, 0.75); for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) S.holes.push(cw(shp(sh, pr, rm.cx + sx * q, rm.cy + sy * q))); }
    else if (feat === 'columns') S.holes.push(cw(P2(clamp(rn * 0.28, 0.8, 1.8))));
    else if (feat === 'dais') rm.top = nest(S, [{ p: P2(rn * 0.55), h: h + 0.4, tex: { riser: 'step' } }, { p: P2(rn * 0.32), h: h + 0.8, tex: { floor: 'tile' }, light: S.light + 0.15 }]);
    else if (feat === 'pool') { const pool = nest(S, [{ p: P2(rn * 0.5), h: h - 0.35, liq: true, tex: { floor: 'liquid' } }]); if (R() < 0.5) pool.holes.push(cw(P2(0.55))); }
    else if (feat === 'pit') nest(S, [{ p: P2(rn * 0.62), h: h - 0.45, tex: { riser: 'step' } }, { p: P2(rn * 0.42), h: h - 0.9 }, { p: P2(rn * 0.22), h: h - 1.35, liq: true, tex: { floor: 'liquid' } }]);
    else if (feat === 'sky') nest(S, [{ p: P2(rn * 0.45), h, c: flat(cz(S, rm.cx, rm.cy) + 2.5), sky: true, light: S.light + 0.25 }]);
    else if (feat === 'baffles') {
      // broken partition walls across the room: always open at one end, so the room stays whole, but no straight line through it
      const ax = R() < 0.5, n = rn > 5.6 ? 3 : 2, sp = n === 3 ? rn * 0.52 : rn * 0.32, len = rn * 0.45, f0 = R() < 0.5 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const u = n === 3 ? (k - 1) * sp : (k ? sp : -sp), v = f0 * (k % 2 ? 1 : -1) * rn * 0.2, w = 0.6, l = len * r(0.85, 1);
        S.holes.push(cw(ax ? box(rm.cx + u - w, rm.cy + v - l, rm.cx + u + w, rm.cy + v + l) : box(rm.cx + v - l, rm.cy + u - w, rm.cx + v + l, rm.cy + u + w)));
      }
    }
    else if (feat === 'blocks') { const n = ri(2, 3), a0 = r(0, TAU); for (let k = 0; k < n; k++) { const a = a0 + (k * TAU) / n, d = rn * 0.52, s = r(0.8, 1.4); S.holes.push(cw(box(rm.cx + Math.cos(a) * d - s, rm.cy + Math.sin(a) * d - s, rm.cx + Math.cos(a) * d + s, rm.cy + Math.sin(a) * d + s))); } }
    else if (feat === 'wild') {
      // rough ground: rock shelves a step or two up, boulders, a pond; kept clear of the doorways and the middle
      const mouths = rm.ports.map((q) => q.mid), put2 = [], blob = (x, y, rr, n = 12) => { const ph = r(0, TAU); return Array.from({ length: n }, (_, k) => { const t = (k / n) * TAU, q = rr * (0.82 + 0.18 * Math.sin(t * 2 + ph) * Math.cos(t * 3 - ph)); return [x + Math.cos(t) * q, y + Math.sin(t) * q]; }); };
      const [di, dj] = rm.ext || [0, 0], ex0 = rm.cx + (di < 0 ? -rm.a - CELL : -rm.a), ex1 = rm.cx + (di > 0 ? rm.a + CELL : rm.a), ey0 = rm.cy + (dj < 0 ? -rm.b - CELL : -rm.b), ey1 = rm.cy + (dj > 0 ? rm.b + CELL : rm.b);
      const room4 = (x, y, rr) => { for (let k = 0; k < 12; k++) { const t = (k / 12) * TAU; if (!inPoly(P, x + Math.cos(t) * (rr + 1.3), y + Math.sin(t) * (rr + 1.3))) return false; } return mouths.every(([mx, my]) => Math.hypot(mx - x, my - y) > rr + 3.2) && put2.every(([qx, qy, qr]) => Math.hypot(qx - x, qy - y) > rr + qr + 1.8) && Math.hypot(x - rm.cx, y - rm.cy) > rr + 1.6; };
      const spot = (rr) => { for (let t = 0; t < 40; t++) { const x = r(ex0, ex1), y = r(ey0, ey1); if (room4(x, y, rr)) { put2.push([x, y, rr]); return [x, y]; } } return null; };
      const rk = { floor: 'rock', riser: 'cliff', wall: 'cliff' };
      for (let k = 0, n = rm.ext ? ri(2, 3) : ri(1, 2); k < n; k++) { const rr = r(1.7, 2.6), q = spot(rr); if (q) nest(S, R() < 0.55 ? [{ p: blob(q[0], q[1], rr), h: h + 0.45, tex: rk }, { p: blob(q[0], q[1], rr * 0.55, 10), h: h + 0.9, tex: rk }] : [{ p: blob(q[0], q[1], rr), h: h + 0.42, tex: rk }]); }
      for (let k = 0, n = rm.ext ? ri(3, 5) : ri(2, 3); k < n; k++) { const rr = r(0.6, 1.3), q = spot(rr); if (q) S.holes.push(cw(blob(q[0], q[1], rr, 9))); }
      if (R() < 0.55) { const rr = r(1.8, 2.6), q = spot(rr); if (q) nest(S, [{ p: blob(q[0], q[1], rr, 14), h: h - 0.35, liq: true, tex: { floor: 'liquid' }, light: S.light * 0.85 }]); }
      rm.wildSpots = put2;
    }
    else if (feat === 'canal') {
      // room over room: a sunken canal with steps at one end and a railed bridge across it
      const along = R() < 0.5, M = along ? (u, v) => [rm.cx + u, rm.cy + v] : (u, v) => [rm.cx + v, rm.cy + u];
      const w = 2.4, ext = rm.R - 1.6, D = 2.6, yb = r(-2.2, -1.2), bw = 1.2, q = (u0, v0, u1, v1) => ccw([M(u0, v0), M(u1, v0), M(u1, v1), M(u0, v1)]);
      nest(S, [{ p: q(-w, -ext, w, ext), h: h - D, liq: true, tex: { floor: 'liquid' }, light: S.light * 0.7 }]);
      slabs.push({ poly: q(-w - 0.5, yb - bw, w + 0.5, yb + bw), b: h - 0.3, t: h, tex: 'plank', light: S.light });
      for (const s of [-1, 1]) slabs.push({ poly: q(-w, yb + s * bw - 0.07, w, yb + s * bw + 0.07), b: h - 0.3, t: h + 0.85, tex: 'metal', light: S.light, rail: true });
      for (let k = 1; k <= 5; k++) slabs.push({ poly: q(-w, ext - k * 0.65, w, ext - (k - 1) * 0.65), b: h - D, t: h - (k * D) / 6, tex: 'step', light: S.light * 0.8 });
      rm.bridge = { x: M(0, yb)[0], y: M(0, yb)[1], z: h };
    }
    if (rm.ext && rm.kind === 'yard') {
      // a courtyard's far end: a rampart up a stair, railed along its edge, to look out over the yard from
      const [di, dj] = rm.ext, U1 = (di ? rm.a : rm.b) + CELL, V = di ? rm.b : rm.a, M = (u, v) => [rm.cx + di * u - dj * v, rm.cy + dj * u + di * v];
      const q = (u0, v0, u1, v1) => ccw([M(u0, v0), M(u1, v0), M(u1, v1), M(u0, v1)]), dw = 1.7, zt = h + 2.35, zb = zt - 0.25, n = 6, sl = 0.62, lt = S.light;
      slabs.push({ poly: q(U1 - dw, -V, U1, V), b: zb, t: zt, tex: 'plank', light: lt });
      slabs.push({ poly: q(U1 - dw - 0.12, -V + 1.3, U1 - dw, V), b: zb, t: zt + 0.85, tex: 'metal', light: lt, rail: true });
      for (let k = 1; k <= n; k++) slabs.push({ poly: q(U1 - dw - (n - k + 1) * sl, -V, U1 - dw - (n - k) * sl, -V + 1.3), b: h, t: h + (k * (zt - h)) / n, tex: 'step', light: lt * 0.9 });
      rm.walk = { z: zt, x: M(U1 - dw / 2, 0)[0], y: M(U1 - dw / 2, 0)[1] };
    }
    if (rm.gal) {
      // the walkway over two metres up, round three walls with a rail on its inner edge, and a stair up along the fourth
      const sd = pick(freeSide), A = sd % 2 ? rm.b : rm.a, B = sd % 2 ? rm.a : rm.b, cx = rm.cx, cy = rm.cy;
      const M = [(u, v) => [cx + u, cy + v], (u, v) => [cx - v, cy + u], (u, v) => [cx - u, cy - v], (u, v) => [cx + v, cy - u]][sd];
      const q = (u0, v0, u1, v1) => ccw([M(u0, v0), M(u1, v0), M(u1, v1), M(u0, v1)]), gw = 1.4, zt = h + 2.45, zb = zt - 0.25, lt = S.light;   // headroom under it even from a stair's last step
      for (const [u0, v0, u1, v1] of [[-A, -B, A, -B + gw], [-A, B - gw, A, B], [-A, -B + gw, -A + gw, B - gw]]) slabs.push({ poly: q(u0, v0, u1, v1), b: zb, t: zt, tex: 'plank', light: lt });
      for (const [u0, v0, u1, v1] of [[-A + gw, -B + gw - 0.06, A - gw, -B + gw + 0.06], [-A + gw, B - gw - 0.06, A, B - gw + 0.06], [-A + gw - 0.06, -B + gw + 0.06, -A + gw + 0.06, B - gw - 0.06]]) slabs.push({ poly: q(u0, v0, u1, v1), b: zb, t: zt + 0.85, tex: 'metal', light: lt, rail: true });
      const n = 6, sl = 0.68;
      for (let k = 1; k <= n; k++) slabs.push({ poly: q(A - gw, -B + gw + (n - k) * sl, A, -B + gw + (n - k + 1) * sl), b: h, t: h + (k * (zt - h)) / n, tex: 'step', light: lt * 0.9 });
      rm.walk = { z: zt, x: M(-A + gw / 2, 0)[0], y: M(-A + gw / 2, 0)[1] };
    }
    for (const p of rm.ports) p.h = fz(S, ...p.mid);
  }
  for (const l of links) {
    const u0 = l.pa.w, u1 = l.pb.w, base0 = l.ax === 'x' ? l.a.cy : l.a.cx, v0 = base0 + l.lo, v1 = base0 + l.hi;
    const quad = (s, e) => (l.ax === 'x' ? [[s, v0], [e, v0], [e, v1], [s, v1]] : [[v0, s], [v1, s], [v1, e], [v0, e]]);
    const ha = l.pa.h, hb = l.pb.h, D = l.door, run = [];
    let s = u0, e = u1, tail = null;
    if (D && D.at === 'a') { run.push({ s, e: s + 0.5, h: ha, door: true }); s += 0.5; }
    if (D && D.at === 'b') { tail = { s: e - 0.5, e, h: hb, door: true }; e -= 0.5; }
    const dh = hb - ha, len = e - s;
    if (l.win) { const wide = R() < 0.6; run.push({ s, e, h: Math.max(ha, hb) + (wide ? 0.95 : 1.05), ch: wide ? 2.1 : 1.25, win: true }); }
    else if (Math.abs(dh) <= 0.5) run.push({ s, e, h: Math.abs(dh) <= 0.3 ? ha : (ha + hb) / 2 });
    else if (l.ramp && Math.abs(dh) / len < 0.75) run.push({ s, e, h: ha, g: dh / len });
    else { const m = Math.ceil(Math.abs(dh) / 0.42), n = m - 1; for (let k = 0; k < n; k++) run.push({ s: k ? s + (k * len) / n : s, e: k === n - 1 ? e : s + ((k + 1) * len) / n, h: ha + (dh * (k + 1)) / m, stair: true }); }
    if (tail) run.push(tail);
    const open = !D && !l.win && l.a.S?.sky && l.b.S?.sky;
    for (const q of run) {
      const fp = q.g ? { h: q.h, gx: l.ax === 'x' ? q.g : 0, gy: l.ax === 'y' ? q.g : 0, ox: l.ax === 'x' ? q.s : 0, oy: l.ax === 'y' ? q.s : 0 } : flat(q.h);
      const S = { poly: quad(q.s, q.e), holes: [], f: fp, c: { ...fp, h: q.h + (open ? 6 : q.ch || l.ch) }, light: open ? 1.02 : q.win ? l.light + 0.15 : l.light, link: l, win: q.win, sky: open || undefined,
        tex: open ? { wall: 'cliff', floor: 'rock', ceil: 'ceil', riser: q.stair ? 'cliff' : null } : { wall: l.wall, floor: 'grate', ceil: 'ceil', riser: q.stair ? 'step' : null } };
      secs.push(S);
      if (q.door) {
        const t = q.h + l.ch, sl = { poly: S.poly, b: q.h, t, b0: q.h, t0: t, tex: D.secret ? D.room.S.tex.wall : D.key != null ? 'doorK' : 'door', light: l.light, door: { ...D, open: 0, sec: S, x: (S.poly[0][0] + S.poly[2][0]) / 2, y: (S.poly[0][1] + S.poly[2][1]) / 2, z: q.h } };
        slabs.push(sl); doors.push(sl); S.door = sl;
      }
    }
  }
  // portals: an edge shared (reversed) by two sectors joins them
  const ek = (ax, ay, bx, by) => `${Math.round(ax * 1e3)},${Math.round(ay * 1e3)}|${Math.round(bx * 1e3)},${Math.round(by * 1e3)}`, E = new Map();
  for (const s of secs) {
    s.edges = [];
    for (const ring of [s.poly, ...s.holes]) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1e-4) continue;
      const e = { ax: a[0], ay: a[1], bx: b[0], by: b[1], len, ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len, s, o: null };
      s.edges.push(e); E.set(ek(a[0], a[1], b[0], b[1]), e);
    }
  }
  for (const s of secs) for (const e of s.edges) { const m = E.get(ek(e.bx, e.by, e.ax, e.ay)); if (m) e.o = m.s; }
  // torches on solid walls
  const lamps = [];
  for (const rm of rooms) {
    if (rm.kind === 'yard' || (rm.kind === 'wild' && rm.S.sky)) continue;
    const S = rm.S, es = S.edges.filter((e) => !e.o && e.len > 1.4 && S.poly.some((p) => p[0] === e.ax && p[1] === e.ay));
    for (let k = 0; k < (rm.kind === 'shrine' ? 4 : ri(1, 3)) && es.length; k++) {
      const e = es.splice(Math.floor(R() * es.length), 1)[0], x = (e.ax + e.bx) / 2 + e.nx * 0.3, y = (e.ay + e.by) / 2 + e.ny * 0.3;
      lamps.push({ x, y, z: fz(S, x, y) + Math.min(rm.gal ? 3.5 : 2.1, cz(S, x, y) - fz(S, x, y) - 0.6), fz: fz(S, x, y), nx: e.nx, ny: e.ny, room: rm });
    }
  }
  return { secs, slabs, doors, rooms, links, start, exit, keyRoom, secret, lamps, mw: GX * CELL, mh: GY * CELL };
}

// ---------------------------------------------------------------- world: queries, collision, sight, navigation
const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
class World {
  constructor(L) {
    Object.assign(this, L);
    this.stamp = 1; this.buf = {};
    const gw = (this.gw = Math.ceil(this.mw / GS)), gh = (this.gh = Math.ceil(this.mh / GS)), mk = () => Array.from({ length: gw * gh }, () => []);
    this.sg = mk(); this.wg = mk(); this.bg = mk();
    const cells = (P, fn) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } for (let j = Math.max(0, Math.floor(y0 / GS)); j <= Math.min(gh - 1, Math.floor(y1 / GS)); j++) for (let i = Math.max(0, Math.floor(x0 / GS)); i <= Math.min(gw - 1, Math.floor(x1 / GS)); i++) fn(j * gw + i); return [x0, y0, x1, y1]; };
    this.secs.forEach((s, k) => { s.id = k; });
    for (const s of this.secs) {
      s.bb = cells(s.poly, (c) => this.sg[c].push(s));
      for (const e of s.edges) if (!e.o || s.id < e.o.id) cells([[e.ax, e.ay], [e.bx, e.by]], (c) => this.wg[c].push(e));
    }
    for (const b of this.slabs) {
      cells(b.poly, (c) => this.bg[c].push(b));
      const P = b.poly;
      for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]); const e = { ax: a[0], ay: a[1], bx: c[0], by: c[1], len, ux: (c[0] - a[0]) / len, uy: (c[1] - a[1]) / len, nx: (c[1] - a[1]) / len, ny: -(c[0] - a[0]) / len, slab: b }; cells([a, c], (k) => this.wg[k].push(e)); }
    }
    this.buildNav();
  }
  // a crate or a barrel set down after the map is built: into the slab and wall grids
  addSlab(b) {
    const gw = this.gw, cells = (P, fn) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } for (let j = Math.max(0, Math.floor(y0 / GS)); j <= Math.min(this.gh - 1, Math.floor(y1 / GS)); j++) for (let i = Math.max(0, Math.floor(x0 / GS)); i <= Math.min(gw - 1, Math.floor(x1 / GS)); i++) fn(j * gw + i); };
    this.slabs.push(b); cells(b.poly, (c) => this.bg[c].push(b));
    const P = b.poly;
    for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]); const e = { ax: a[0], ay: a[1], bx: c[0], by: c[1], len, ux: (c[0] - a[0]) / len, uy: (c[1] - a[1]) / len, nx: (c[1] - a[1]) / len, ny: -(c[0] - a[0]) / len, slab: b }; cells([a, c], (k) => this.wg[k].push(e)); }
  }
  inSec(s, x, y) { const b = s.bb; return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && inPoly(s.poly, x, y) && !s.holes.some((h) => inPoly(h, x, y)); }
  sAt(x, y, hint) {
    if (hint && this.inSec(hint, x, y)) return hint;
    const i = Math.floor(x / GS), j = Math.floor(y / GS);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) return hint || null;
    for (const s of this.sg[j * this.gw + i]) if (s !== hint && this.inSec(s, x, y)) return s;
    return hint || null;
  }
  slabsAt(x, y) { const i = Math.floor(x / GS), j = Math.floor(y / GS); return i < 0 || j < 0 || i >= this.gw || j >= this.gh ? [] : this.bg[j * this.gw + i]; }
  floorAt(x, y, z, s, st = STEP) { let f = s ? fz(s, x, y) : -99; for (const b of this.slabsAt(x, y)) if (b.t <= z + st + 0.001 && b.t > f && inPoly(b.poly, x, y)) f = b.t; return f; }
  ceilAt(x, y, z, s, noDoor) { let c = s ? cz(s, x, y) : 99; for (const b of this.slabsAt(x, y)) if (!(noDoor && b.door) && b.b >= z + 0.05 && b.b < c && inPoly(b.poly, x, y)) c = b.b; return c; }
  blocks(e, x, y, z, ht, st) {
    if (e.slab) return e.slab.t > z + st && e.slab.b < z + ht;
    if (!e.o) return true;
    const lo = Math.max(fz(e.s, x, y), fz(e.o, x, y)), hi = Math.min(cz(e.s, x, y), cz(e.o, x, y));
    return lo > z + st || hi < Math.max(z, lo) + ht;
  }
  each(x, y, rad, fn) {
    const st = ++this.stamp, gw = this.gw;
    for (let j = Math.max(0, Math.floor((y - rad) / GS)); j <= Math.min(this.gh - 1, Math.floor((y + rad) / GS)); j++)
      for (let i = Math.max(0, Math.floor((x - rad) / GS)); i <= Math.min(gw - 1, Math.floor((x + rad) / GS)); i++)
        for (const e of this.wg[j * gw + i]) { if (e.m === st) continue; e.m = st; if (fn(e)) return true; }
    return false;
  }
  // push a circle out of every wall, ledge, slab and closed door it overlaps
  collide(p, rad, ht, st) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      this.each(p.x, p.y, rad, (e) => {
        const dx = e.bx - e.ax, dy = e.by - e.ay; let t = ((p.x - e.ax) * dx + (p.y - e.ay) * dy) / (dx * dx + dy * dy); t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = e.ax + dx * t, qy = e.ay + dy * t; let ox = p.x - qx, oy = p.y - qy; const d2 = ox * ox + oy * oy;
        if (d2 >= rad * rad || !this.blocks(e, qx, qy, p.z, ht, st)) return false;
        let d = Math.sqrt(d2); if (d < 1e-6) { ox = e.nx; oy = e.ny; d = 1; p.x = qx; p.y = qy; }
        const k = (rad - (d === 1 && ox === e.nx ? 0 : d)) / d; p.x += ox * k; p.y += oy * k; moved = true; return false;
      });
      if (!moved) break;
    }
  }
  near(x, y, z, rad) {
    return this.each(x, y, rad, (e) => {
      if (e.slab?.door) return false;
      const dx = e.bx - e.ax, dy = e.by - e.ay; let t = ((x - e.ax) * dx + (y - e.ay) * dy) / (dx * dx + dy * dy); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = e.ax + dx * t, qy = e.ay + dy * t;
      return (x - qx) ** 2 + (y - qy) ** 2 < rad * rad && this.blocks(e, qx, qy, z, PH, STEP);
    });
  }
  ray(x0, y0, x1, y1, fn) {
    const gw = this.gw, gh = this.gh, dx = x1 - x0, dy = y1 - y0, si = dx > 0 ? 1 : -1, sj = dy > 0 ? 1 : -1, ie = Math.floor(x1 / GS), je = Math.floor(y1 / GS);
    let i = Math.floor(x0 / GS), j = Math.floor(y0 / GS), tx = dx ? ((si > 0 ? (i + 1) * GS : i * GS) - x0) / dx : Infinity, ty = dy ? ((sj > 0 ? (j + 1) * GS : j * GS) - y0) / dy : Infinity;
    const ddx = dx ? GS / Math.abs(dx) : Infinity, ddy = dy ? GS / Math.abs(dy) : Infinity;
    for (let n = 0; n < 400; n++) { if (i >= 0 && j >= 0 && i < gw && j < gh) fn(j * gw + i); if (i === ie && j === je) break; if (tx < ty) { tx += ddx; i += si; } else { ty += ddy; j += sj; } }
  }
  // first wall, ledge or slab a straight line from a to b hits
  hitWall(x0, y0, z0, x1, y1, z1) {
    let best = null, bt = 2;
    const st = ++this.stamp, rx = x1 - x0, ry = y1 - y0;
    this.ray(x0, y0, x1, y1, (c) => {
      for (const e of this.wg[c]) {
        if (e.m === st) continue; e.m = st;
        const sx = e.bx - e.ax, sy = e.by - e.ay, d = rx * sy - ry * sx;
        if (Math.abs(d) < 1e-12) continue;
        const t = ((e.ax - x0) * sy - (e.ay - y0) * sx) / d, u = ((e.ax - x0) * ry - (e.ay - y0) * rx) / d;
        if (t < 0 || t > 1 || u < 0 || u > 1 || t >= bt) continue;
        const hx = x0 + rx * t, hy = y0 + ry * t, hz = z0 + (z1 - z0) * t;
        const hit = e.slab ? hz >= e.slab.b && hz <= e.slab.t : !e.o || hz < Math.max(fz(e.s, hx, hy), fz(e.o, hx, hy)) || hz > Math.min(cz(e.s, hx, hy), cz(e.o, hx, hy));
        if (hit) { bt = t; best = e; }
      }
    });
    return best ? { t: bt, e: best, x: x0 + rx * bt, y: y0 + ry * bt, z: z0 + (z1 - z0) * bt } : null;
  }
  los(ax, ay, az, bx, by, bz) { return !this.hitWall(ax, ay, az, bx, by, bz); }
  // navigation: a 0.5-unit grid with up to two walkable heights per cell (the bridge and the canal under it)
  buildNav() {
    const nx = (this.nx = Math.ceil(this.mw / NS)), ny = (this.ny = Math.ceil(this.mh / NS)), N = nx * ny * 2;
    const nz = (this.nz = new Float32Array(N).fill(NaN)), nd = (this.nd = new Int16Array(N).fill(-1)), top = (this.top = new Float32Array(nx * ny).fill(-99));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * NS, y = (j + 0.5) * NS, s = this.sAt(x, y, null);
      if (!s || s.win) continue;
      const sl = this.slabsAt(x, y).filter((b) => !b.door && inPoly(b.poly, x, y)), zs = [fz(s, x, y), ...sl.filter((b) => !b.rail).map((b) => b.t)].sort((a, b) => a - b);
      top[j * nx + i] = zs[zs.length - 1];
      let k = 0, last = -99;
      for (const z of zs) {
        if (k > 1 || z - last < 0.05) continue;
        if (sl.some((b) => b.t > z + 0.05 && b.b < z + PH) || this.ceilAt(x, y, z, s, true) - z < PH || this.near(x, y, z, 0.4)) continue;
        const v = ((j * nx + i) << 1) | k;
        nz[v] = z; if (s.door) nd[v] = this.doors.indexOf(s.door);
        k++; last = z;
      }
    }
  }
  has(i, j, z) { const c = (j * this.nx + i) << 1; return Math.abs(this.nz[c] - z) < 0.7 || Math.abs(this.nz[c + 1] - z) < 0.7; }
  // breadth-first search over the grid; rev = edges reversed (a field for monsters to walk down)
  bfs(start, rev, door, key) {
    const nx = this.nx, ny = this.ny, nz = this.nz, nd = this.nd, N = nz.length;
    const B = (this.buf[key] ||= { dist: new Int32Array(N), prev: new Int32Array(N) }), dist = B.dist, prev = B.prev, q = (this.q ||= new Int32Array(N));
    dist.fill(-1);
    if (start < 0) return B;
    let h = 0, t = 0; dist[start] = 0; prev[start] = -1; q[t++] = start;
    while (h < t) {
      const u = q[h++], c = u >> 1, i = c % nx, j = (c - i) / nx, z = nz[u], du = dist[u] + 1;
      for (let k = 0; k < 8; k++) {
        const ii = i + DI[k], jj = j + DJ[k];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        for (let l = 0; l < 2; l++) {
          const v = ((jj * nx + ii) << 1) | l, zv = nz[v];
          if (zv !== zv || dist[v] >= 0) continue;
          const up = rev ? z - zv : zv - z;
          if (up > STEP + 0.02 || up < -3.2) continue;
          if (up < -STEP && this.top[(rev ? u : v) >> 1] > (rev ? z : zv) + 0.1) continue;
          if (k >= 4 && !(this.has(ii, j, z) && this.has(i, jj, z))) continue;
          if (nd[v] >= 0 && door && !door(nd[v])) continue;
          dist[v] = du; prev[v] = u; q[t++] = v;
        }
      }
    }
    return B;
  }
  nodeAt(x, y, z, far = 2) {
    const i0 = Math.floor(x / NS), j0 = Math.floor(y / NS);
    let best = -1, bd = 1e9;
    for (let r = 0; r <= far && best < 0; r++) for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || i < 0 || j < 0 || i >= this.nx || j >= this.ny) continue;
      for (let l = 0; l < 2; l++) {
        const v = ((j * this.nx + i) << 1) | l, zv = this.nz[v];
        if (zv !== zv || Math.abs(zv - z) > 1.2) continue;
        const d = Math.abs(zv - z) + Math.hypot((i + 0.5) * NS - x, (j + 0.5) * NS - y);
        if (d < bd) { bd = d; best = v; }
      }
    }
    return best;
  }
  nodeXY(v) { const c = v >> 1, i = c % this.nx; return [(i + 0.5) * NS, ((c - i) / this.nx + 0.5) * NS, this.nz[v]]; }
  straight(x, y, z, tx, ty, door) {
    const n = Math.ceil(Math.hypot(tx - x, ty - y) / 0.3);
    let pz = z;
    for (let k = 1; k <= n; k++) {
      const i = Math.floor((x + ((tx - x) * k) / n) / NS), j = Math.floor((y + ((ty - y) * k) / n) / NS);
      if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return false;
      const c = (j * this.nx + i) << 1; let ok = false;
      for (let l = 0; l < 2 && !ok; l++) { const zv = this.nz[c + l]; if (zv === zv && zv - pz <= STEP && pz - zv <= 0.7 && !(pz - zv > 0.1 && this.top[c >> 1] > zv + 0.1) && !(door && this.nd[c + l] >= 0 && !door(this.nd[c + l]))) { pz = zv; ok = true; } }
      if (!ok) return false;
    }
    return true;
  }
  randomNode(R, rm, pred) {
    for (let g = 0; g < 200; g++) {
      const x = rm.cx + (R() * 2 - 1) * rm.R, y = rm.cy + (R() * 2 - 1) * rm.R, s = this.sAt(x, y, null);
      if (!s || s.room !== rm) continue;
      const v = this.nodeAt(x, y, fz(s, x, y), 0);
      if (v >= 0 && (!pred || pred(v))) return v;
    }
    return -1;
  }
}

// ---------------------------------------------------------------- the voxel layer
// The lower walls of the rooms and halls are clad in a skin of voxels two deep, drawn with the wall's
// own texture, so a whole wall looks as it did. Shots chew it away: a bullet chips a voxel, a rocket
// blows a crater. The rough stone behind shows through, the rubble falls and the dust hangs.
// Crates are whole voxel blocks that come apart; barrels go up.
const VX = 0.25, VD = 2;
function cladWalls(wd, R) {
  const panels = [], cands = [], budget = 34000;
  let used = 0;
  for (const s of wd.secs) {
    if ((!s.room && !s.link) || s.win || s.liq) continue;
    for (const e of s.edges) {
      if (e.o || e.len < 1.1) continue;
      const fa = fz(s, e.ax, e.ay), fb = fz(s, e.bx, e.by), ca = cz(s, e.ax, e.ay), cb = cz(s, e.bx, e.by);
      if (Math.abs(fa - fb) > 0.02 || Math.abs(ca - cb) > 0.02 || ca - fa < 1.2) continue;
      cands.push({ s, e, z0: fa, top: Math.min(ca, cb), k: (s.room ? 1 : 0) + R() * 0.6 });
    }
  }
  // the rooms first, then the corridors as far as the budget goes
  cands.sort((a, b) => b.k - a.k);
  for (const c of cands) {
    const cols = Math.max(1, Math.round(c.e.len / VX)), rows = Math.min(12, Math.floor((c.top - c.z0 - 0.02) / VX)), n = cols * rows * VD;
    if (rows < 3 || used + n > budget) continue;
    used += n;
    const P = { e: c.e, s: c.s, cols, rows, z0: c.z0, du: c.e.len / cols, vox: new Uint8Array(n).fill(1), id: panels.length, dirty: true, tex: c.s.tex.wall };
    c.e.panel = P; panels.push(P);
  }
  return panels;
}

// ---------------------------------------------------------------- the game
const LIQ = { blood: [0.5, 0.03, 0.05], slime: [0.32, 0.78, 0.14], water: [0.14, 0.34, 0.6], lava: [1, 0.42, 0.08] };
const NAME_A = ['Gut', 'Ossuary', 'Velvet', 'Molar', 'Weeping', 'Rust', 'Sulphur', 'Moth', 'Gland', 'Saint', 'Ink', 'Marrow', 'Hive', 'Static'];
const NAME_B = ['Cathedral', 'Aqueduct', 'Abattoir', 'Bathhouse', 'Foundry', 'Cloister', 'Sewers', 'Arcade', 'Catacombs', 'Pumping Station', 'Mall', 'Observatory'];
export class HellMaze extends Game {
  static noMods = ['mirror', 'wobble'];
  setup() {
    const s = this.post.seed || 1;
    this.level = 0; this.kills = 0; this.deaths = 0; this.msgs = []; this.ready = false; this.goreMap = new Map();
    // the arsenal: a sidearm, then four rolled from the gritty guns and the strange ones
    const sh = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const nWeird = this.rng() < 0.35 ? 2 : 1, pool = [...sh(GRIT).slice(0, 4 - nWeird), ...sh(WEIRD).slice(0, nWeird)];
    this.arms = [rollArm(this.rng, this.rng() < 0.75 ? 'pistol' : 'tooth', this.rng() < 0.6), ...sh(pool).map((k) => rollArm(this.rng, k))];
    this.relicImg = this.skin.pick('relic', 'item', 'ball');
    this.ammoImg = this.arms.map((a, i) => this.skin.pick(`ammo${i}`, 'item', 'ball'));
    this.crew = ROLES.map((ro, k) => { let m = null; const c = { ...ro, fly: !!ro.fly }; Object.defineProperty(c, 'm', { get: () => (m ||= horror((s * 13 + k * 101) >>> 0, ro.px, { kind: ro.kind, tier: 1 })), enumerable: true }); Object.defineProperty(c, 'name', { get: () => c.m.name, enumerable: true }); return c; });
    this.knowSecret = this.rng() < 0.6;
    loadThree().then(() => { this.ready = true; }).catch((e) => { this.failed = String(e?.message || e); });
    this.newLevel(true);
  }
  maxHp() { return this.mods.glass ? 30 : 100; }
  say(text, t = 2.5) { this.msgs = this.msgs.filter((m) => m.text !== text); this.msgs.push({ text, t, max: t }); if (this.msgs.length > 3) this.msgs.shift(); }
  newLevel(fresh) {
    const seed = ((this.post.seed || 1) * 7919 + this.level * 104729 + this.deaths * 31) >>> 0, L = genLevel(seed, this.level);
    this.wd = new World(L);
    const lv = this.level, md = MOODS[((this.post.seed || 1) * 7 + lv * 3) % MOODS.length], liq = md.liq;
    this.mood = { ...md, liq, lc: LIQ[liq], key: KEYS[(this.post.seed + lv) % 3], name: `${NAME_A[(seed >>> 4) % NAME_A.length]} ${NAME_B[(seed >>> 9) % NAME_B.length]}` };
    const st = L.start, p = (this.p ||= {});
    Object.assign(p, { x: st.cx, y: st.cy, z: fz(st.S, st.cx, st.cy), vz: 0, vx: 0, vy: 0, a: this.r(0, TAU), sec: st.S, bob: 0, keys: new Set() });
    // the middle of the start room should be open floor; if it is not, the nearest spot that is
    if (this.wd.nodeAt(p.x, p.y, p.z, 0) < 0) { const v = this.wd.nodeAt(p.x, p.y, p.z, 12); if (v >= 0) { const [x, y, z] = this.wd.nodeXY(v); Object.assign(p, { x, y, z, sec: this.wd.sAt(x, y, st.S) }); } }
    p.eye = p.z + EYE;
    if (fresh) { p.hp = this.maxHp(); p.armor = 0; this.owned = [true, false, false, false, false]; this.ammo = this.arms.map((a) => (a.ammo ? 0 : Infinity)); this.weapon = 0; }
    this.foes = []; this.shots = []; this.items = []; this.deco = []; this.gibs = []; this.gore = []; this.decals = []; this.bolts = []; this.drips = []; this.booms = []; this.pending = []; this.shake = 0; this.boomFlash = 0;
    this.cool = 0; this.flash = 0; this.recoil = 0; this.hurt = 0; this.dead = 0; this.path = []; this.apT = 0; this.lvT = 0; this.flowT = 0; this.flow = null;
    this.skullOut = null; this.decalDirty = true; this.stuck = { t: 0, x: p.x, y: p.y }; this.ban = new Map(); this.goal = -1; this.secretFound = false;
    this.vox = { panels: cladWalls(this.wd, mulberry32(seed ^ 0x51ab)), crates: [] };
    const Wt = this.mood.wall, css = (v, k) => `rgb(${v.map((q) => Math.round(clamp(q * k, 0, 1) * 255)).join(',')})`;
    // rubble: chips of the walls' own stone (they fly and bounce like gibs and leave dust where they land)
    this.rubbleG = { blood: mixc(Wt[0], [0.1, 0.09, 0.08], 0.6), glow: null, art: Array.from({ length: 6 }, (_, k) => pc(6, 6, (x) => { const c = Wt[k % 3]; rect(x, css(c, 1.3), 0, 0, 5, 5); rect(x, css(c, 1.7), 0, 0, 3, 2); rect(x, css(c, 0.8), 2, 3, 4, 3); if (k > 2) rect(x, css(c, 1.1), 3, 0, 3, 2); })) };
    this.spawnAll(L);
    if (this.gl) this.dropGpu();
    this.say(`LEVEL ${lv + 1} · ${this.mood.name.toUpperCase()}`, 3.5);
  }
  goreOf(m) {
    let g = this.goreMap.get(m);
    if (!g) {
      const an = m?.anatomy || {}, party = this.mods.party;
      const a = { flesh: an.flesh || '#b0504a', hide: an.hide || this.col(2), blood: an.blood || '#7a0a10', glow: an.glow || null, organs: an.organs || [] };
      g = { blood: rgb01(a.blood), glow: a.glow ? rgb01(a.glow) : null, party, art: gibArt(a, mulberry32(this.goreMap.size * 77 + 5)) };
      this.goreMap.set(m, g);
    }
    return g;
  }
  boss() {
    const s = this.post.seed || 1, kind = ['abom', 'demon', 'spider', 'demon'][(s + this.level) % 4], m = horror((s * 31 + this.level * 977 + 7) >>> 0, 64, { kind, tier: 3 });
    return { role: 'boss', hp: 380, speed: kind === 'spider' ? 2.6 : 1.8, size: kind === 'abom' ? 3.6 : 3.4, ranged: 18, melee: 26, heavy: true, boss: true, fly: !!m.floats, m, name: m.name };
  }
  addFoe(ro, x, y, z, mul = 1) {
    const size = ro.size * this.S;
    const f = { ...ro, x, y, z: z + (ro.fly ? 1.4 : 0), vz: 0, kx: 0, ky: 0, hp: ro.hp * mul, max: ro.hp * mul, size, rise: 1, cst: null, cT: 0, rad: Math.min(0.65, size * 0.2), ht: size * 0.78, awake: false, cd: this.r(0.5, 2), anim: this.r(0, 3), face: 1, ang: this.r(0, TAU), actT: 0, hitT: 0, blind: 0, losT: this.r(0, 0.3), los: false, fireAt: 0, sec: this.wd.sAt(x, y, null), id: (this.fid = (this.fid || 0) + 1), hover: this.r(1.1, 2) };
    this.foes.push(f);
    return f;
  }
  spawnAll(L) {
    const wd = this.wd, R = this.rng, pick = (a) => a[Math.floor(R() * a.length)];
    const sd = wd.bfs(wd.nodeAt(this.p.x, this.p.y, this.p.z, 4), false, null, 'spawn').dist;
    const rooms = L.rooms.filter((rm) => rm !== L.start && rm !== L.secret), far = (v) => sd[v] < 0 || sd[v] > 18;
    const n = Math.round((3 + L.rooms.length * 0.55 + this.level * 1.5) * (this.mods.swarm ? 1.7 : 1)), mul = 1 + this.level * 0.15;
    // who haunts this level: the old garrison and three or four of the second wave (more, deeper down)
    const fresh = ROLES.map((_, k) => k).filter((k) => k >= 6 && ROLES[k].lvl <= this.level + 1);
    for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
    const wave = fresh.slice(0, Math.min(fresh.length, 3 + (this.level >= 2 ? 1 : 0))), cast = [0, 0, 0, 1, 1, 2, 3, 5, ...wave, ...wave];
    this.cast = [...new Set([...cast, 4, ...(wave.includes(11) ? [9] : [])])];
    for (let i = 0; i < n; i++) {
      const v = wd.randomNode(R, pick(rooms), far); if (v < 0) continue;
      const ro = this.crew[i % 7 === 6 ? 4 : pick(cast)], [x, y, z] = wd.nodeXY(v);
      if (ro.pack) { for (let k = 0, m = 3 + Math.floor(R() * 3); k < m; k++) { const f = this.addFoe(ro, x + this.r(-0.8, 0.8), y + this.r(-0.8, 0.8), z, mul); wd.collide(f, f.rad, 0.6, STEP); } }
      else { const f = this.addFoe(ro, x, y, z, mul); if (ro.burrow) f.under = true; }
    }
    const bv = wd.randomNode(R, L.exit); if (bv >= 0) this.addFoe(this.boss(), ...wd.nodeXY(bv), 1 + this.level * 0.25);
    this.total = this.foes.length;
    const item = (kind, v, o) => { if (v < 0) return; const [x, y, z] = wd.nodeXY(v); this.items.push({ kind, x, y, z, bob: this.r(0, 6), sec: wd.sAt(x, y, null), ...o }); };
    item('key', wd.randomNode(R, L.keyRoom), { key: 0 });
    const unowned = [1, 2, 3, 4].filter((i) => !this.owned[i]), path = rooms.filter((rm) => rm !== L.exit).sort((a, b) => a.depth - b.depth);
    unowned.slice(0, this.level ? 2 : 3).forEach((w, k, all) => item('gun', wd.randomNode(R, path[Math.min(path.length - 1, Math.floor(((k + 0.3) / all.length) * path.length))]), { w }));
    const ammoW = [1, 2, 3, 4].filter((i) => this.arms[i].ammo);
    for (let i = 0; i < 2 + rooms.length / 4; i++) item('health', wd.randomNode(R, pick(rooms)));
    for (let i = 0; i < 1 + rooms.length / 9; i++) item('armor', wd.randomNode(R, pick(rooms)));
    for (let i = 0; i < 3 + rooms.length / 2; i++) item('ammo', wd.randomNode(R, pick(rooms)), { w: pick(ammoW) });
    if (L.secret) for (const k of ['armor', 'health', 'ammo', 'ammo']) item(k, wd.randomNode(R, L.secret), { w: pick(ammoW), secret: true });
    // the furniture of the place: crates, barrels, corpses, candles and skulls
    this.barrels = []; this.treeN = 0;
    const roomsReached = () => { const d = wd.bfs(wd.nodeAt(this.p.x, this.p.y, this.p.z, 4), false, null, 'spawn').dist, got = new Set(); for (let k = 0; k < d.length; k++) if (d[k] >= 0) { const [x, y] = wd.nodeXY(k), s = wd.sAt(x, y, null); if (s?.room) got.add(s.room); } return got.size; }, reached = roomsReached();
    const taken = [...this.items, ...this.foes].map((o) => [o.x, o.y]), free = (x, y, r) => taken.every(([a, b]) => Math.hypot(a - x, b - y) > r) && Math.hypot(x - this.p.x, y - this.p.y) > 3;
    // never in a doorway (a crate there would wall off everything beyond it)
    const mouths = L.rooms.flatMap((rm) => rm.ports.map((q) => q.mid)).filter(Boolean), clear = (x, y, r) => mouths.every(([a, b]) => Math.hypot(a - x, b - y) > r);
    for (const rm of L.rooms) {
      if (rm === L.start && R() < 0.5) continue;
      const big = rm.kind === 'yard' || rm.kind === 'hall', nC = big ? 3 : rm.kind === 'room' ? (R() < 0.7 ? 2 : 0) : 0, nB = big ? 2 : rm.kind === 'room' ? (R() < 0.6 ? 1 : 0) : rm.kind === 'shrine' ? 2 : 0;
      for (let k = 0; k < nC; k++) {
        const v = wd.randomNode(R, rm); if (v < 0) continue;
        const [x, y, z] = wd.nodeXY(v), w = R() < 0.3 ? 2 : 1, h = R() < 0.35 ? 2 : 1;
        if (!free(x, y, 1.6) || wd.near(x, y, z, 1.3) || !clear(x, y, 3)) continue;
        taken.push([x, y]); this.addCrate(x - w * 0.5, y - 0.5, z, w, h);
      }
      for (let k = 0; k < nB; k++) {
        const v = wd.randomNode(R, rm); if (v < 0) continue;
        const [x, y, z] = wd.nodeXY(v);
        if (!free(x, y, 1.3) || wd.near(x, y, z, 0.6) || !clear(x, y, 2.2)) continue;
        taken.push([x, y]);
        const sl = { poly: box(x - 0.3, y - 0.3, x + 0.3, y + 0.3), b: z, t: z + 0.95, tex: 'metal', light: 0.8, barrel: true }, bar = { x, y, z, hp: 16, sl, sec: wd.sAt(x, y, null) };
        sl.barrel = bar; wd.addSlab(sl); this.barrels.push(bar);
      }
      const nd = rm.kind === 'yard' ? 3 : rm.kind === 'hall' || rm.kind === 'shrine' || (rm.kind === 'room' && R() < 0.6) ? 2 : 0;
      for (let k = 0; k < nd; k++) {
        const v = wd.randomNode(R, rm); if (v < 0) continue;
        const [x, y, z] = wd.nodeXY(v), kind = ['corpse', 'corpse', 'candles', 'skulls'][Math.floor(R() * 4)];
        if (!free(x, y, 0.9)) continue;
        this.deco.push({ x, y, z, kind, dir: Math.floor(R() * 8), m: this.crew[this.cast[Math.floor(R() * this.cast.length)]].m, ph: R() * 6, sec: wd.sAt(x, y, null) });
        if (kind === 'corpse') this.pool(x, y, z, this.goreOf(this.crew[0].m), this.r(0.8, 1.5));
      }
      // wild places: dead trees (their trunks are in the way), heads on stakes, heaps of stones
      if (rm.kind === 'wild') for (let k = 0, n = 3 + Math.floor(R() * 4); k < n; k++) {
        const v = wd.randomNode(R, rm); if (v < 0) continue;
        const [x, y, z] = wd.nodeXY(v), kind = k < n - 2 ? 'deadtree' : R() < 0.6 ? 'stake' : 'stones';
        if (!free(x, y, 1.4) || !clear(x, y, 2.6) || (kind === 'deadtree' && wd.near(x, y, z, 0.8))) continue;
        taken.push([x, y]);
        const d = { x, y, z, kind, v: Math.floor(R() * 3), sec: wd.sAt(x, y, null), ph: R() * 6 };
        if (kind === 'deadtree') { d.sl = { poly: box(x - 0.22, y - 0.22, x + 0.22, y + 0.22), b: z, t: z + 3.2, tex: 'plank', light: 0.6 }; wd.addSlab(d.sl); this.treeN = (this.treeN || 0) + 1; }
        this.deco.push(d);
      }
      // carcasses on hooks under the ceiling, dripping into a pool
      const S0 = rm.S, nH = !S0.sky && rm !== L.start && rm.kind !== 'secret' ? (R() < 0.55 ? 1 + Math.floor(R() * 3) : 0) : 0;
      for (let k = 0; k < nH; k++) {
        const v = wd.randomNode(R, rm); if (v < 0) continue;
        const [x, y, z] = wd.nodeXY(v), sec = wd.sAt(x, y, null), top = wd.ceilAt(x, y, z, sec, true);
        if (!free(x, y, 0.9) || top - z < 3.1 || top > z + 9) continue;
        taken.push([x, y]); this.deco.push({ x, y, z, top, kind: 'hang', ph: R() * 6, v: Math.floor(R() * 3), sec });
        this.pool(x, y, z, this.goreOf(this.crew[0].m), this.r(0.5, 0.9));
      }
      // old blood smeared on the walls and dragged across the floor
      const g0 = this.goreOf(this.crew[this.cast[Math.floor(R() * this.cast.length)]].m);
      for (let k = 0; k < (rm.kind === 'shrine' ? 5 : 2); k++) { const v = wd.randomNode(R, rm); if (v < 0) continue; const [x, y, z] = wd.nodeXY(v), a = R() * TAU; this.wallSplat(x, y, z + this.r(0.6, 1.8), Math.cos(a), Math.sin(a), { blood: mixc(g0.blood, [0, 0, 0], 0.35) }, this.r(0.7, 1.4), 6); }
      if (R() < 0.35) { const v = wd.randomNode(R, rm); if (v >= 0) { const [x, y, z] = wd.nodeXY(v), a = R() * TAU; for (let q = 0; q < 7; q++) this.decal(x + Math.cos(a) * q * 0.35, y + Math.sin(a) * q * 0.35, z, null, mixc(g0.blood, [0, 0, 0], 0.45), 0.42 - q * 0.03); } }
      // a pair of eyes in a dark corner: they watch, they blink, and they are gone when you come close
      if (rm !== L.start && S0.light < 0.85 && R() < 0.4) {
        const v = wd.randomNode(R, rm, (q) => { const [x, y, z] = wd.nodeXY(q); return wd.near(x, y, z, 0.9); });
        if (v >= 0) { const [x, y, z] = wd.nodeXY(v); this.deco.push({ x, y, z: z + this.r(1.2, 1.9), kind: 'eyes', ph: R() * 6, a: 0, sec: wd.sAt(x, y, null), col: R() < 0.6 ? '#ff2a10' : '#ffd23a' }); }
      }
    }
    if (this.vox.crates.length || this.barrels.length || this.treeN) {
      wd.buildNav();
      // and every room can still be reached: furniture that walls one off goes, the nearest a doorway first
      const near = (o) => Math.min(...mouths.map(([a, b]) => Math.hypot(a - o.x, b - o.y))), stuff = [...this.vox.crates.map((C) => ({ x: C.x0 + C.nx * VX / 2, y: C.y0 + C.ny * VX / 2, o: C })), ...this.barrels.map((q) => ({ x: q.x, y: q.y, o: q })), ...this.deco.filter((d) => d.sl).map((d) => ({ x: d.x, y: d.y, o: d }))].sort((a, b) => near(a) - near(b));
      while (stuff.length && roomsReached() < reached) { const { o } = stuff.shift(); o.gone = true; o.sl.t = o.sl.b = -99; wd.buildNav(); }
    }
    this.lamps = L.lamps.map((l) => ({ ...l, sec: wd.sAt(l.x, l.y, null), ph: this.r(0, 6), dying: this.rng() < 0.28 }));
    const top = L.exit.top || L.exit.S;
    this.exitPos = { x: L.exit.cx, y: L.exit.cy, z: fz(top, L.exit.cx, L.exit.cy), sec: top };
  }
  exitOK() { return this.foes.filter((f) => f.hp > 0 && !f.summoned).length <= this.total * 0.3 || this.lvT > 150; }
  canUse(i) { return this.owned[i] && this.ammo[i] > 0 && !(this.arms[i].k === 'flail' && this.skullOut); }

  // ------------------------------------------------------------------ simulation
  step(dt) {
    if (!this.wd) return;
    if (this.pending?.length) { const due = this.pending.filter((q) => q.at <= this.t); if (due.length) { this.pending = this.pending.filter((q) => q.at > this.t); due.forEach((q) => q.fn()); } }
    this.lvT += dt; this.cool -= dt; this.flash -= dt; this.recoil = Math.max(0, this.recoil - dt * 5); this.hurt -= dt;
    for (const m of this.msgs) m.t -= dt;
    this.msgs = this.msgs.filter((m) => m.t > 0);
    if (this.dead > 0) { this.dead -= dt; this.p.eye = Math.max(this.p.z + 0.25, this.p.eye - dt * 2); if (this.dead <= 0) { this.deaths++; this.score = Math.max(0, this.score - 300); this.newLevel(true); } return; }
    if (!this.auto && this.drag) { const dy = (this.drag.cy ?? this.drag.sy) - this.drag.sy; if (Math.abs(dy) > 12) this.inF = clamp(-dy / 14, -4.5, 4.5); else if (this.t - this.drag.t > 0.35 && !this.drag.moved) this.fire(); }
    this.movePlayer(dt);
    this.doDoors(dt);
    this.stepFoes(dt);
    this.stepShots(dt);
    const p = this.p;
    for (const it of this.items) if (!it.got && Math.abs(it.x - p.x) < 0.8 && Math.abs(it.y - p.y) < 0.8 && Math.abs(it.z - p.z) < 1.2) this.pickup(it);
    const E = this.exitPos;
    if (E && Math.hypot(E.x - p.x, E.y - p.y) < 1 && Math.abs(E.z - p.z) < 1.2 && (!this.auto || this.exitOK())) { this.level++; this.score += 500; this.newLevel(false); }
  }
  movePlayer(dt) {
    const p = this.p, wd = this.wd, c = Math.cos(p.a), s = Math.sin(p.a), f = this.inF || 0, st = this.inS || 0, k = Math.min(1, dt * 9);
    p.vx += (c * f - s * st - p.vx) * k; p.vy += (s * f + c * st - p.vy) * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
    wd.collide(p, PR, PH, STEP);
    p.sec = wd.sAt(p.x, p.y, p.sec);
    const fl = wd.floorAt(p.x, p.y, p.z, p.sec);
    if (p.z <= fl + 0.001 || (p.z - fl < 0.45 && p.vz > -0.5)) { p.z = fl; p.vz = 0; }
    else { p.vz -= 20 * this.G * dt; p.z = Math.max(fl, p.z + p.vz * dt); }
    p.bob += Math.hypot(p.vx, p.vy) * dt * 2.2;
    p.eye += (p.z + EYE - p.eye) * Math.min(1, dt * 14);
    if (p.sec && !p.sec.seen) { p.sec.seen = true; for (const e of p.sec.edges) if (e.o) e.o.seen = true; }
    this.inF = this.inS = 0;
  }
  doDoors(dt) {
    const p = this.p;
    for (const sl of this.wd.doors) {
      const d = sl.door, h = sl.t0 - sl.b0;
      if (d.opening) { if (d.open < 1) { d.open = Math.min(1, d.open + dt * 1.3); sl.b = sl.b0 + d.open * h; sl.t = sl.t0 + d.open * h; } continue; }
      const near = (x, y, z, r) => Math.abs(x - d.x) < r && Math.abs(y - d.y) < r && Math.abs(z - d.z) < 1.5;
      if (near(p.x, p.y, p.z, d.secret ? 1 : 1.9)) {
        if (d.key != null && !p.keys.has(d.key)) { if (!(this.t < this.lockT)) { this.say(`You need the ${this.mood.key[0]} key`, 2); this.lockT = this.t + 3; } }
        else { d.opening = true; if (d.secret) { this.say('A SECRET!', 2.5); this.score += 250; this.secretFound = true; } }
      } else if (!d.secret && d.key == null && this.foes.some((f) => f.awake && f.hp > 0 && near(f.x, f.y, f.z, 1.4))) d.opening = true;
    }
  }
  stepFoes(dt) {
    const p = this.p, wd = this.wd, pe = p.eye - 0.1, foes = this.foes;
    this.flowT -= dt;
    if (this.flowT <= 0 && foes.some((f) => f.awake && f.hp > 0)) {
      this.flowT = 0.4;
      const v = wd.nodeAt(p.x, p.y, p.z, 3);
      if (v >= 0) this.flow = wd.bfs(v, true, (k) => { const d = wd.doors[k].door; return d.opening || (!d.secret && d.key == null); }, 'flow');
    }
    for (const f of foes) {
      f.hitT -= dt; f.anim += dt; f.actT -= dt; f.blind -= dt; f.cd -= dt; f.zapT = (f.zapT || 0) - dt;
      const kd = Math.pow(0.03, dt); f.kx *= kd; f.ky *= kd;
      if (f.hp <= 0) {
        if (f.spurt > this.t && !f.gone && this.rng() < dt * 30) { const g = this.goreOf(f.m); this.spray(f.x, f.y, f.z + 0.25, this.r(-0.3, 0.3), this.r(-0.3, 0.3), g, 2, false); }
        if (!f.fly || f.gone) { const fl = wd.floorAt(f.x, f.y, f.z, f.sec); if (f.z > fl) { f.vz -= 18 * dt; f.z = Math.max(fl, f.z + f.vz * dt); } }
        else { f.fly = false; f.vz = 0; }
        continue;
      }
      if (f.burnT > this.t) {
        // on fire: it burns down, shedding flame
        f.hp -= dt * 8; if (this.rng() < dt * 26) this.puff(f.x + this.r(-0.3, 0.3), f.y + this.r(-0.3, 0.3), f.z + f.ht * this.r(0.2, 0.9), [1, this.r(0.35, 0.7), 0.15], 2, 1.2, true);
        if (f.hp <= 0) { this.killFoe(f, 12, 0, 0, 'fire'); continue; }
      }
      const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy) || 0.01, ux = dx / dist, uy = dy / dist;
      if (f.under || f.charge || f.leap || f.beam || f.summon || f.burst) { if (this.foeSpecial(f, dt, dist, ux, uy)) continue; }
      f.losT -= dt;
      if (f.losT <= 0) { f.losT = 0.25 + this.rng() * 0.15; f.los = !this.dead && dist < 22 && wd.los(f.x, f.y, f.z + f.ht * 0.8, p.x, p.y, pe); if (f.los && dist < 16) f.awake = true; }
      let mx = 0, my = 0;
      if (f.awake && f.actT <= 0 && !this.dead) {
        if (f.blind > 0) { mx = Math.cos(f.anim * 1.7 + f.id); my = Math.sin(f.anim * 1.3 + f.id * 2); }
        else if (f.los && (f.ranged ? dist > (f.mortar || f.summon ? 10 : 7) : dist > f.rad + PR + 0.3)) { mx = ux; my = uy; }
        else if (f.los && f.ranged) { const sw = Math.sin(f.anim * 0.9 + f.id); mx = -uy * sw - (dist < 4 ? ux : 0); my = ux * sw - (dist < 4 ? uy : 0); }
        else if (!f.los) {
          const v = this.flow ? wd.nodeAt(f.x, f.y, f.fly ? f.z - f.hover : f.z, 2) : -1, nx = v >= 0 && this.flow.dist[v] > 0 ? this.flow.prev[v] : -1;
          if (nx >= 0) { const [tx, ty] = wd.nodeXY(this.flow.prev[nx] >= 0 ? this.flow.prev[nx] : nx); mx = tx - f.x; my = ty - f.y; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; }
          else if (dist < 14) { mx = ux; my = uy; }
        }
      }
      if (f.awake && !this.dead && f.blind <= 0 && f.actT <= 0 && f.cd <= 0) {
        if (f.burst && dist < 2.1 && Math.abs(p.z - f.z) < 1.4 && f.los) { f.actT = 0.7; f.act = 'swell'; f.cd = 9; f.fireAt = this.t + 0.6; }
        else if (f.melee && dist < f.rad + PR + 0.6 && Math.abs(p.z - f.z) < 1.6) { f.actT = 0.5; f.act = 'bite'; f.cd = f.heavy ? 1.3 : 0.85; f.fireAt = this.t + 0.22; }
        else if (f.ranged && f.los && dist < 18 && dist > 1.4) { f.actT = 0.65; f.act = 'spit'; f.cd = this.r(1.5, 2.8) * (f.heavy ? 1.2 : 1); f.fireAt = this.t + 0.3; }
      }
      if (f.fireAt && this.t >= f.fireAt) {
        f.fireAt = 0;
        if (f.act === 'bite') { if (dist < f.rad + PR + 0.9 && Math.abs(p.z - f.z) < 1.8) { this.hitPlayer(f.melee * (1 + this.level * 0.1)); if (f.knock) { p.vx += ux * f.knock; p.vy += uy * f.knock; this.shake = Math.max(this.shake || 0, 0.3); } } }
        else if (f.act === 'swell') { this.burstFoe(f); continue; }
        else if (f.mortar) this.lob(f, dist);
        else {
          const g = this.goreOf(f.m), col = g.glow || mixc(g.blood, [1, 0.9, 0.4], 0.35), sz = f.z + f.ht * 0.7, n = f.heavy ? 3 : 1;
          for (let k = 0; k < n; k++) {
            const a = Math.atan2(dy, dx) + (k - (n - 1) / 2) * 0.12 + this.r(-0.05, 0.05), sp = f.heavy ? 8 : 9.5, t = dist / sp;
            this.shoot('spit', f.x + ux * f.rad, f.y + uy * f.rad, sz, Math.cos(a) * sp, Math.sin(a) * sp, (pe - 0.25 - sz) / t, { dmg: f.ranged * (1 + this.level * 0.1), col, r: f.heavy ? 0.22 : 0.16, life: 4, grav: 0, bounce: 0 });
          }
        }
      }
      const sp = f.speed * (f.blind > 0 ? 0.45 : 1) * (f.actT > 0 ? 0.2 : 1), vx = mx * sp + f.kx, vy = my * sp + f.ky;
      f.moving = Math.abs(mx) + Math.abs(my) > 0.1;
      if (f.moving) { const side = -mx * Math.sin(p.a) + my * Math.cos(p.a); if (Math.abs(side) > 0.2) f.face = side > 0 ? 1 : -1; }
      else if (f.los) { const side = -ux * Math.sin(p.a) + uy * Math.cos(p.a); if (Math.abs(side) > 0.3) f.face = side > 0 ? 1 : -1; }
      // its heading, for which of its eight views to show: it turns toward where it walks, or toward you
      const want = f.actT > 0 || (!f.moving && f.los) ? Math.atan2(uy, ux) : f.moving ? Math.atan2(my, mx) : f.ang;
      f.ang += angTo(f.ang, want) * Math.min(1, dt * 7);
      if (vx || vy) { f.x += vx * dt; f.y += vy * dt; wd.collide(f, f.rad, f.fly ? 0.6 : Math.min(f.ht, PH), f.fly ? 0.3 : STEP); f.sec = wd.sAt(f.x, f.y, f.sec); }
      const fl = wd.floorAt(f.x, f.y, f.z, f.sec, f.fly ? 0.3 : STEP);
      if (f.fly) { const cl = wd.ceilAt(f.x, f.y, f.z, f.sec), want = Math.min(fl + f.hover + Math.sin(f.anim * 2) * 0.15, cl - 0.7); f.z += (want - f.z) * Math.min(1, dt * 2.5); }
      else if (f.z <= fl + 0.001 || f.z - fl < 0.45) f.z = fl;
      else { f.vz -= 18 * dt; f.z = Math.max(fl, f.z + f.vz * dt); if (f.z === fl) f.vz = 0; }
    }
    for (let i = 0; i < foes.length; i++) {
      const a = foes[i]; if (a.hp <= 0) continue;
      for (let j = i + 1; j < foes.length; j++) {
        const b = foes[j]; if (b.hp <= 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.rad + b.rad, d2 = dx * dx + dy * dy;
        if (d2 > rr * rr || d2 < 1e-6 || Math.abs(a.z - b.z) > 1.5) continue;
        const d = Math.sqrt(d2), k = (rr - d) / d / 2; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k;
      }
      const dx = a.x - this.p.x, dy = a.y - this.p.y, rr = a.rad + PR, d2 = dx * dx + dy * dy;
      if (!a.under && d2 < rr * rr && d2 > 1e-6 && Math.abs(a.z - this.p.z) < 1.5) { const d = Math.sqrt(d2), k = (rr - d) / d; a.x += dx * k; a.y += dy * k; }
    }
  }
  // ------------------------------------------------------------------ the second wave's own ways
  // true when the foe's whole turn was handled here
  foeSpecial(f, dt, dist, ux, uy) {
    const p = this.p, wd = this.wd, sees = () => (f.losT2 = (f.losT2 || 0) - dt) > 0 ? f.los2 : (f.losT2 = 0.25, f.los2 = wd.los(f.x, f.y, f.z + f.ht * 0.7, p.x, p.y, p.eye - 0.1));
    const move = (vx, vy, st = STEP) => { f.x += vx * dt; f.y += vy * dt; const ox = f.x, oy = f.y; wd.collide(f, f.rad, Math.min(f.ht, PH), st); f.sec = wd.sAt(f.x, f.y, f.sec); return Math.hypot(f.x - ox, f.y - oy) > Math.hypot(vx, vy) * dt * 0.5; };
    const ground = () => { const fl = wd.floorAt(f.x, f.y, f.z, f.sec); if (f.z <= fl + 0.001 || (f.z - fl < 0.45 && f.vz <= 0)) { f.z = fl; f.vz = 0; return true; } f.vz -= 18 * dt; f.z = Math.max(fl, f.z + f.vz * dt); return false; };
    // the worm: under the floor it goes where it likes, only a stir of dust to show; near you it bursts up
    if (f.burrow) {
      if (f.under) {
        if (!f.awake) { if (dist < 16 && this.rng() < dt * 2) f.awake = true; return true; }
        f.rise = Math.max(0, f.rise - dt * 2.4);
        f.cT -= dt;
        if (dist < 2.3 && f.cT <= 0 && Math.abs(p.z - f.z) < 1.2 && this.dead <= 0) { f.under = false; f.cst = 'up'; f.cT = 3.4; f.ang = Math.atan2(uy, ux); this.puff(f.x, f.y, f.z + 0.2, [0.3, 0.24, 0.18], 30, 4); this.decal(f.x, f.y, f.z, null, [0.08, 0.06, 0.05], 1.6); this.shake = Math.max(this.shake || 0, 0.25); return true; }
        const v = this.flow ? wd.nodeAt(f.x, f.y, f.z, 2) : -1, nx = v >= 0 && this.flow.dist[v] > 0 ? this.flow.prev[v] : -1;
        let mx = ux, my = uy;
        if (nx >= 0 && dist > 3) { const [tx, ty, tz] = wd.nodeXY(this.flow.prev[nx] >= 0 ? this.flow.prev[nx] : nx); mx = tx - f.x; my = ty - f.y; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; f.z += (tz - f.z) * Math.min(1, dt * 6); }
        move(mx * f.speed * 1.3, my * f.speed * 1.3, 1.2);
        if (this.rng() < dt * 9) this.puff(f.x + this.r(-0.3, 0.3), f.y + this.r(-0.3, 0.3), f.z + 0.05, [0.28, 0.22, 0.17], 2, 1.2);
        return true;
      }
      f.rise = Math.min(1, f.rise + dt * 2.2); f.cT -= dt;
      f.ang += angTo(f.ang, Math.atan2(uy, ux)) * Math.min(1, dt * 5);
      if (f.cT <= 0 || (dist > 6 && f.cT < 2.4)) { f.under = true; f.cT = 1.6; f.actT = 0; this.puff(f.x, f.y, f.z + 0.2, [0.3, 0.24, 0.18], 18, 3); return true; }
      if (f.rise >= 1 && f.actT <= 0 && f.cd <= 0 && dist < f.rad + PR + 1.1) { f.actT = 0.5; f.act = 'bite'; f.cd = 0.9; f.fireAt = this.t + 0.25; }
      if (f.fireAt && this.t >= f.fireAt) { f.fireAt = 0; if (dist < f.rad + PR + 1.4) this.hitPlayer(f.melee * (1 + this.level * 0.1)); }
      return true;
    }
    if (!f.awake || this.dead > 0) return false;
    // the charger: a stamp and a lowered head, then a straight run; a wall stops it cold
    if (f.charge) {
      if (f.cst === 'wind') { f.cT -= dt; f.actT = 0.2; f.act = 'bite'; if (f.cT <= 0) { f.cst = 'run'; f.cT = 1.5; } return true; }
      if (f.cst === 'run') {
        f.cT -= dt; f.moving = true; f.anim += dt * 1.6;
        const free = move(f.cdx * 9.5, f.cdy * 9.5); ground();
        if (this.rng() < dt * 20) this.puff(f.x, f.y, f.z + 0.1, [0.3, 0.25, 0.2], 2, 1.5);
        if (dist < f.rad + PR + 0.45 && Math.abs(p.z - f.z) < 1.5) { this.hitPlayer(f.charge * (1 + this.level * 0.1)); p.vx += f.cdx * 10; p.vy += f.cdy * 10; this.shake = Math.max(this.shake || 0, 0.5); f.cst = 'rest'; f.cT = 0.8; f.cd = 3; }
        else if (!free) { f.cst = 'stun'; f.cT = 1.3; f.cd = 3; this.shake = Math.max(this.shake || 0, 0.2); this.puff(f.x + f.cdx * f.rad, f.y + f.cdy * f.rad, f.z + f.ht * 0.5, [0.5, 0.45, 0.4], 14, 3); }
        else if (f.cT <= 0) { f.cst = 'rest'; f.cT = 0.6; f.cd = 2.5; }
        return true;
      }
      if (f.cst === 'stun' || f.cst === 'rest') { f.cT -= dt; f.moving = false; f.hitT = f.cst === 'stun' ? Math.max(f.hitT, 0.05) : f.hitT; ground(); if (f.cT <= 0) f.cst = null; return true; }
      if (f.cd <= 0 && dist > 3.5 && dist < 15 && Math.abs(p.z - f.z) < 1 && sees()) { f.cst = 'wind'; f.cT = 0.55; f.cdx = ux; f.cdy = uy; f.ang = Math.atan2(uy, ux); return true; }
      return false;
    }
    // the leaper: a crouch, then a long arc down onto you
    if (f.leap) {
      if (f.cst === 'crouch') { f.cT -= dt; f.actT = 0.3; f.act = 'bite'; if (f.cT <= 0) { const T = clamp(dist / 7.5, 0.45, 1.2); f.cst = 'air'; f.lvx = (dx2(p, f) / T); f.lvy = (dy2(p, f) / T); f.vz = (p.z - f.z + 0.5 * 18 * T * T) / T; f.z += 0.06; } return true; }
      if (f.cst === 'air') {
        f.actT = 0.2; move(f.lvx, f.lvy, 0.3);
        if (ground()) { f.cst = null; f.cd = 2.6; this.puff(f.x, f.y, f.z + 0.1, [0.3, 0.25, 0.2], 10, 2.5); if (dist < f.rad + PR + 0.9 && Math.abs(p.z - f.z) < 1.4) { this.hitPlayer(f.melee * 1.4 * (1 + this.level * 0.1)); this.shake = Math.max(this.shake || 0, 0.25); } }
        return true;
      }
      if (f.cd <= 0 && dist > 3.5 && dist < 9.5 && Math.abs(p.z - f.z) < 2 && sees()) { f.cst = 'crouch'; f.cT = 0.35; f.ang = Math.atan2(uy, ux); return true; }
      return false;
    }
    // the watcher: it fixes on you, a red thread drawn tight while it charges, then the beam
    if (f.beam) {
      if (f.cst === 'aim') {
        f.cT -= dt; f.actT = 0.3; f.act = 'spit';
        const ex = f.x + Math.cos(f.ang) * f.rad, ey = f.y + Math.sin(f.ang) * f.rad, ez = f.z + f.ht * 0.6;
        if (f.cT > 0.35) { f.aim = [p.x + p.vx * 0.15, p.y + p.vy * 0.15, p.eye - 0.25]; f.ang = Math.atan2(f.aim[1] - f.y, f.aim[0] - f.x); }
        const a = f.aim, L = Math.hypot(a[0] - ex, a[1] - ey, a[2] - ez) || 1, far = [ex + ((a[0] - ex) / L) * 26, ey + ((a[1] - ey) / L) * 26, ez + ((a[2] - ez) / L) * 26], h = wd.hitWall(ex, ey, ez, ...far), end = h ? [h.x, h.y, h.z] : far;
        this.bolts.push({ pts: [[ex, ey, ez], end], life: dt * 1.5, beam: true, col: f.cT < 0.25 ? 'rgba(255,60,40,.95)' : 'rgba(255,30,20,.45)', w: f.cT < 0.25 ? 2 : 1 });
        if (f.cT <= 0) {
          f.cst = null; f.cd = this.r(3, 4.5);
          this.bolts.push({ pts: [[ex, ey, ez], end], life: 0.18, beam: true, col: '#ffd0b0', w: 4 });
          // did it catch you? the nearest point of the beam to your chest
          const vx = end[0] - ex, vy = end[1] - ey, l2 = vx * vx + vy * vy || 1, tq = clamp(((p.x - ex) * vx + (p.y - ey) * vy) / l2, 0, 1), qx = ex + vx * tq, qy = ey + vy * tq;
          if (Math.hypot(p.x - qx, p.y - qy) < PR + 0.3 && this.dead <= 0) { this.hitPlayer(f.beam * (1 + this.level * 0.1)); this.puff(p.x, p.y, p.eye - 0.4, [1, 0.3, 0.2], 12, 3, true); }
          this.puff(...end, [1, 0.5, 0.3], 10, 3, true); if (h) this.decal(...end, h, [0.1, 0.02, 0.02], 0.4);
        }
        return true;
      }
      if (f.cd <= 0 && dist < 20 && f.los && sees()) { f.cst = 'aim'; f.cT = 1.0; return true; }
      return false;
    }
    // the priest: raises a fallen one near it, or calls up skitters, then backs away
    if (f.summon) {
      if (f.cst === 'chant') {
        f.cT -= dt; f.actT = 0.3; f.act = 'spit';
        if (this.rng() < dt * 30) this.puff(f.x + this.r(-0.4, 0.4), f.y + this.r(-0.4, 0.4), f.z + f.ht * this.r(0.3, 1), [0.7, 0.4, 1], 1, 1, true);
        if (f.cT <= 0) {
          f.cst = null; f.cd = this.r(7, 10);
          const dead = this.foes.find((o) => o.hp <= 0 && !o.gone && !o.boss && !o.raised && o !== f && Math.hypot(o.x - f.x, o.y - f.y) < 10);
          if (dead) { dead.raised = true; dead.hp = dead.max * 0.6; dead.awake = true; dead.hitT = 0.4; dead.spurt = 0; dead.under = false; dead.summoned = true; this.puff(dead.x, dead.y, dead.z + dead.ht * 0.5, [0.8, 0.4, 1], 28, 3, true); this.say('THE DEAD RISE', 1.6); }
          else if (this.foes.filter((o) => o.hp > 0 && o.summoned).length < 6) for (let k = 0; k < 2; k++) { const a = this.r(0, TAU), o = this.addFoe(this.crew[9], f.x + Math.cos(a) * 1.2, f.y + Math.sin(a) * 1.2, f.z, 1 + this.level * 0.15); o.awake = true; o.summoned = true; wd.collide(o, o.rad, 0.6, STEP); o.sec = wd.sAt(o.x, o.y, f.sec); this.puff(o.x, o.y, o.z + 0.3, [0.6, 0.3, 0.9], 14, 2, true); }
        }
        return true;
      }
      if (f.cd <= 0 && dist < 18 && f.los && sees()) { f.cst = 'chant'; f.cT = 1.1; return true; }
      return false;
    }
    return false;
  }
  // a bloater bursts: acid over everything near, it and its own kind included
  burstFoe(f) {
    if (f.burstDone) return;
    f.burstDone = true;
    const p = this.p, d = Math.hypot(p.x - f.x, p.y - f.y), g = { blood: [0.42, 0.62, 0.12], glow: [0.6, 0.95, 0.2], art: this.goreOf(f.m).art };
    if (d < 3 && Math.abs(p.z - f.z) < 1.8 && this.dead <= 0) this.hitPlayer(f.burst * (1 - d / 4.2) * (1 + this.level * 0.1));
    for (const o of this.foes) if (o !== f && o.hp > 0 && !o.under && Math.hypot(o.x - f.x, o.y - f.y) < 3) this.hurtFoe(o, f.burst * 0.8, o.x - f.x, o.y - f.y, o.z + o.ht * 0.5, 'ink');
    this.puff(f.x, f.y, f.z + f.ht * 0.5, [0.55, 0.85, 0.15], 46, 5, true); this.puff(f.x, f.y, f.z + f.ht * 0.5, [0.3, 0.42, 0.08], 24, 3);
    for (let k = 0; k < 6; k++) { const a = this.r(0, TAU); this.wallSplat(f.x, f.y, f.z + f.ht * this.r(0.2, 0.8), Math.cos(a), Math.sin(a), g, this.r(0.8, 1.4), 4); }
    this.pool(f.x, f.y, f.z, g, 2.4);
    this.shake = Math.max(this.shake || 0, clamp(0.5 - d / 12, 0, 0.5));
    if (f.hp > 0) { f.hp = 0; this.kills++; this.score += Math.round(f.max); }
    this.gib(f, 0, 0);
  }
  // a gunner's mortar: lobbed to land where you will be
  lob(f, dist) {
    const p = this.p, T = clamp(dist / 9, 0.7, 1.6), tx = p.x + p.vx * T * 0.6, ty = p.y + p.vy * T * 0.6, sz = f.z + f.ht * 0.75, G = 14;
    this.shoot('mortar', f.x + Math.cos(f.ang) * f.rad, f.y + Math.sin(f.ang) * f.rad, sz, (tx - f.x) / T, (ty - f.y) / T, (p.z + 0.2 - sz + 0.5 * G * T * T) / T, { dmg: f.mortar * (1 + this.level * 0.1), col: [1, 0.55, 0.2], r: 0.22, life: 4, grav: G, bounce: 0, splash: 2.6 });
  }

  // ------------------------------------------------------------------ weapons and projectiles
  shoot(k, x, y, z, vx, vy, vz, o) { const b = { k, x, y, z, vx, vy, vz, life: 3, r: 0.12, grav: 0, bounce: 0, t: 0, spin: this.r(-9, 9), sec: this.wd.sAt(x, y, this.p.sec), ...o }; this.shots.push(b); return b; }
  autoAim(cone = 0.13) {
    const p = this.p, ez = p.eye - 0.28;
    let best = null, bs = 1e9;
    for (const f of this.foes) {
      if (f.hp <= 0 || f.under) continue;
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy), da = angTo(p.a, Math.atan2(dy, dx));
      if (d > 22 || Math.abs(da) > cone + 0.3 / Math.max(1, d)) continue;
      const sc = Math.abs(da) * 8 + d * 0.1;
      if (sc < bs && this.wd.los(p.x, p.y, ez, f.x, f.y, f.z + f.ht * 0.6)) { bs = sc; best = { f, da: clamp(da, -cone, cone), d, dz: f.z + f.ht * 0.55 - ez }; }
    }
    return best;
  }
  fire() {
    if (this.cool > 0 || this.dead > 0 || !this.wd) return;
    if (!this.canUse(this.weapon)) { if (this.arms[this.weapon].k === 'flail' && this.skullOut) return; this.weapon = 0; }
    const i = this.weapon, A = this.arms[i], p = this.p;
    if (this.ammo[i] !== Infinity) this.ammo[i]--;
    this.cool = A.rate; this.flash = A.shot === 'melee' || A.shot === 'flame' ? 0 : 0.08; this.recoil = A.k === 'chaingun' ? 0.35 : A.k === 'flamer' ? 0.15 : A.k === 'chainsaw' ? 0.25 : A.k === 'railgun' ? 1.6 : 1; this.fireT = this.t;
    for (const f of this.foes) if (!f.awake && Math.abs(f.x - p.x) < 9 && Math.abs(f.y - p.y) < 9) f.awake = true;
    const aim = this.autoAim(), ez = p.eye - 0.28, ex = p.x + Math.cos(p.a) * 0.3, ey = p.y + Math.sin(p.a) * 0.3;
    if (A.k === 'fork') return this.zap(A, aim, ex, ey, ez);
    if (A.shot === 'rail') return this.rail(A, aim, ex, ey, ez);
    if (A.shot === 'melee') return this.sawHit(A, aim, ex, ey, ez);
    const kind = A.shot;
    if (kind === 'rocket' || kind === 'grenade') this.shake = Math.max(this.shake || 0, 0.12);
    for (let n = 0; n < A.n; n++) {
      const a = p.a + (aim ? aim.da : 0) + this.r(-1, 1) * (A.spread || 0), sp = A.speed * this.r(0.92, 1.05), d = aim ? aim.d : 8, t = d / sp;
      let vz = aim ? aim.dz / t : 0;
      if (A.grav) vz += 0.5 * A.grav * this.G * t;
      if (kind === 'marble') vz = -1;
      const life = kind === 'skull' ? 3.5 : kind === 'marble' ? 1.3 : kind === 'grenade' ? A.fuse || 1.8 : kind === 'rocket' ? 4 : kind === 'flame' ? this.r(0.45, 0.6) : kind === 'soul' ? 5 : kind === 'mine' ? 4 : 3;
      const r = { chicken: 0.16, tooth: 0.08, bullet: 0.07, pellet: 0.06, nail: 0.07, rocket: 0.16, grenade: 0.14, plasma: 0.13, flame: 0.22, stake: 0.08, saw: 0.16, mine: 0.12, acid: 0.14, soul: 0.3, hook: 0.1 }[kind] || 0.18;
      const b = this.shoot(kind, ex, ey, ez, Math.cos(a) * sp, Math.sin(a) * sp, vz + this.r(-1, 1) * (A.spread || 0) * sp, { mine: true, dmg: A.dmg, grav: kind === 'marble' ? 10 : A.grav || 0, bounce: A.bounce || 0, life, r, hits: {}, A, pierce: A.pierce || 0 });
      if (kind === 'skull') this.skullOut = b;
      if (kind === 'hook') this.hookOut = b;
    }
  }
  // the railgun: one instant line through everything in it, to the wall
  rail(A, aim, ex, ey, ez) {
    const p = this.p, a = p.a + (aim ? aim.da : 0), sl = aim ? aim.dz / Math.max(1, aim.d) : this.pitch || 0, far = [ex + Math.cos(a) * 34, ey + Math.sin(a) * 34, ez + sl * 34];
    const h = this.wd.hitWall(ex, ey, ez, ...far), end = h ? [h.x, h.y, h.z] : far, L = Math.hypot(end[0] - ex, end[1] - ey) || 1;
    for (const f of this.foes) {
      if (f.hp <= 0 || f.under) continue;
      const t = ((f.x - ex) * (end[0] - ex) + (f.y - ey) * (end[1] - ey)) / (L * L), qx = ex + (end[0] - ex) * t, qy = ey + (end[1] - ey) * t, qz = ez + (end[2] - ez) * t;
      if (t < 0 || t > 1 || Math.hypot(f.x - qx, f.y - qy) > f.rad + 0.25 || qz < f.z - 0.2 || qz > f.z + f.ht + 0.2) continue;
      this.hurtFoe(f, A.dmg, Math.cos(a), Math.sin(a), qz, 'rail');
    }
    this.bolts.push({ pts: [[ex, ey, ez], end], life: 0.32, beam: true, col: 'rgba(90,170,255,.55)', w: 6 }, { pts: [[ex, ey, ez], end], life: 0.24, beam: true, col: '#f0f8ff', w: 2 });
    for (let k = 1; k < 8; k++) { const u = k / 8; this.puff(ex + (end[0] - ex) * u, ey + (end[1] - ey) * u, ez + (end[2] - ez) * u, [0.6, 0.8, 1], 2, 0.6, true); }
    this.puff(...end, [0.7, 0.9, 1], 14, 4, true);
    if (h) { this.decal(...end, h, [0.06, 0.08, 0.14], 0.5); this.carve(...end, A.carve, h); }
    this.shake = Math.max(this.shake || 0, 0.2);
  }
  // the chainsaw: whatever is in reach in front of you, chewed
  sawHit(A, aim, ex, ey, ez) {
    const p = this.p;
    let best = null, bd = 2;
    for (const f of this.foes) { if (f.hp <= 0 || f.under) continue; const d = Math.hypot(f.x - p.x, f.y - p.y) - f.rad, da = Math.abs(angTo(p.a, Math.atan2(f.y - p.y, f.x - p.x))); if (d < bd && da < 0.65 && Math.abs(f.z - p.z) < 1.7) { bd = d; best = f; } }
    this.shake = Math.max(this.shake || 0, 0.05);
    if (best) { this.hurtFoe(best, A.dmg, best.x - p.x, best.y - p.y, best.z + best.ht * 0.55, 'saw'); best.kx *= 0.3; best.ky *= 0.3; return; }
    const hx = ex + Math.cos(p.a) * 1.3, hy = ey + Math.sin(p.a) * 1.3, h = this.wd.hitWall(ex, ey, ez, hx, hy, ez);
    if (h) { this.puff(h.x, h.y, h.z, [1, 0.85, 0.5], 3, 2, true); if (this.rng() < 0.3) this.carve(h.x, h.y, h.z, A.carve, h); }
  }
  zap(A, aim, ex, ey, ez) {
    const p = this.p, start = [ex, ey, ez];
    let f = aim?.f || this.autoAim(0.3)?.f || null;
    if (!f) {
      const hx = p.x + Math.cos(p.a) * 14, hy = p.y + Math.sin(p.a) * 14, h = this.wd.hitWall(ex, ey, ez, hx, hy, ez), q = h ? [h.x, h.y, h.z] : [hx, hy, ez];
      this.bolts.push({ pts: [start, q], life: 0.18 }); this.puff(...q, [0.7, 0.9, 1], 8, 3, true); return;
    }
    const done = new Set();
    let dmg = A.dmg, cur = start;
    for (let n = 0; n <= A.chain && f; n++) {
      done.add(f);
      const q = [f.x, f.y, f.z + f.ht * 0.6];
      this.bolts.push({ pts: [cur, q], life: 0.24 }); this.hurtFoe(f, dmg, q[0] - cur[0], q[1] - cur[1], q[2], 'zap'); f.zapT = 0.3; this.puff(...q, [0.75, 0.9, 1], 6, 3, true);
      dmg *= 0.8; cur = q;
      let best = null, bd = 6.5;
      for (const o of this.foes) if (o.hp > 0 && !done.has(o)) { const d = Math.hypot(o.x - q[0], o.y - q[1]); if (d < bd && this.wd.los(q[0], q[1], q[2], o.x, o.y, o.z + o.ht * 0.6)) { bd = d; best = o; } }
      f = best;
    }
  }
  stepShots(dt) {
    const wd = this.wd, p = this.p;
    for (const b of this.shots) {
      b.life -= dt; b.t += dt;
      if (b.k === 'hole') { this.holeStep(b, dt); continue; }
      if (b.k === 'mineSet') {
        if (b.life <= 0 || (this.t > b.arm && this.foes.some((f) => f.hp > 0 && !f.under && Math.hypot(f.x - b.x, f.y - b.y) < 1.7 && Math.abs(f.z - b.z) < 1.6))) { this.explode(b.x, b.y, b.z + 0.2, b.A?.splash || 3, b.dmg, {}); b.life = 0; }
        continue;
      }
      if (b.k === 'flame') { b.vx *= 1 - dt * 1.2; b.vy *= 1 - dt * 1.2; b.vz += dt * 2.2; b.r = 0.22 + b.t * 0.9; }
      if (b.k === 'soul' && (b.zapT = (b.zapT || 0) - dt) <= 0) {
        b.zapT = 0.22;
        let best = null, bd = 5.5;
        for (const f of this.foes) if (f.hp > 0 && !f.under) { const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd && this.wd.los(b.x, b.y, b.z, f.x, f.y, f.z + f.ht * 0.6)) { bd = d; best = f; } }
        if (best) { const q = [best.x, best.y, best.z + best.ht * 0.6]; this.bolts.push({ pts: [[b.x, b.y, b.z], q], life: 0.16, col: ['rgba(140,255,200,.4)', '#e8fff0'] }); this.hurtFoe(best, b.dmg * 0.18, q[0] - b.x, q[1] - b.y, q[2], 'zap'); best.zapT = 0.2; }
      }
      if (b.life <= 0) { this.expire(b); continue; }
      if (b.k === 'bee') this.beeSteer(b, dt);
      if (b.k === 'rocket' && (b.trail = (b.trail || 0) - dt) <= 0) { b.trail = 0.035; this.booms.push({ kind: 'smoke', x: b.x - b.vx * 0.02, y: b.y - b.vy * 0.02, z: b.z, vz: 0.4, t: 0, life: 0.7, s: 0.28, id: (this.bid = (this.bid || 0) + 1) }); this.puff(b.x, b.y, b.z, [1, 0.7, 0.3], 1, 1, true); }
      if (b.A?.seek && b.mine) this.seekSteer(b, dt);
      if (b.k === 'skull' && (b.ret || b.t > 1.4 || b.bounce <= 0)) {
        b.ret = true;
        const dx = p.x - b.x, dy = p.y - b.y, dz = p.eye - 0.3 - b.z, d = Math.hypot(dx, dy, dz);
        if (d < 0.8) { b.life = 0; this.skullOut = null; continue; }
        const s = 22 / d; b.vx = dx * s; b.vy = dy * s; b.vz = dz * s;
      }
      b.vz -= b.grav * this.G * dt;
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt, nz = b.z + b.vz * dt, hit = b.ret ? null : wd.hitWall(b.x, b.y, b.z, nx, ny, nz);
      if (hit) {
        if (b.bounce > 0 || b.k === 'bee' || b.k === 'marble') {
          let wx = hit.e.nx, wy = hit.e.ny;
          if (b.vx * wx + b.vy * wy > 0) { wx = -wx; wy = -wy; }
          const dot = b.vx * wx + b.vy * wy; b.vx = (b.vx - 2 * dot * wx) * 0.85; b.vy = (b.vy - 2 * dot * wy) * 0.85;
          b.x = hit.x + wx * 0.06; b.y = hit.y + wy * 0.06; b.z = hit.z;
          if (b.k === 'chicken' || b.k === 'skull') { b.bounce--; this.puff(b.x, b.y, b.z, b.k === 'chicken' ? [1, 0.9, 0.4] : [0.95, 0.92, 0.85], 4, 2); }
          continue;
        }
        if (hit.e.slab?.barrel && b.mine) this.barrelHit(hit.e.slab.barrel, b.dmg);
        if (b.k === 'flame') { if (this.rng() < 0.15) this.decal(hit.x, hit.y, hit.z, hit, [0.05, 0.04, 0.03], 0.35); b.life = 0; continue; }
        if (b.k === 'mine') { Object.assign(b, { k: 'mineSet', x: hit.x - b.vx * 0.01, y: hit.y - b.vy * 0.01, z: hit.z, vx: 0, vy: 0, vz: 0, arm: this.t + 0.6, life: 25 }); continue; }
        this.impact(b, hit.x - b.vx * 0.005, hit.y - b.vy * 0.005, hit.z, hit, null); b.life = 0; continue;
      }
      b.x = nx; b.y = ny; b.z = nz; b.sec = wd.sAt(b.x, b.y, b.sec);
      const fl = wd.floorAt(b.x, b.y, b.z + 0.2, b.sec, 0.2), cl = wd.ceilAt(b.x, b.y, b.z, b.sec);
      if (b.z - b.r < fl && !b.ret) {
        if (b.k === 'marble') { b.z = fl + b.r; b.vz = 0; }
        else if (b.bounce > 0 || b.k === 'bee') { b.z = fl + b.r; b.vz = Math.abs(b.vz) * 0.55; if (b.k !== 'bee') b.bounce--; }
        else if (b.k === 'mine') { Object.assign(b, { k: 'mineSet', z: fl + 0.05, vx: 0, vy: 0, vz: 0, arm: this.t + 0.6, life: 25 }); continue; }
        else if (b.k === 'flame') { b.z = fl + b.r; b.vz = Math.abs(b.vz) * 0.3; }
        else { this.impact(b, b.x, b.y, fl + 0.05, null, null); b.life = 0; continue; }
      }
      if (b.z + b.r > cl && !b.ret && !b.sec?.sky) {
        if (b.bounce > 0 || b.k === 'bee' || b.grav) { b.z = cl - b.r; b.vz = -Math.abs(b.vz) * 0.5; }
        else { this.impact(b, b.x, b.y, cl - 0.05, null, null); b.life = 0; continue; }
      }
      if (b.mine) {
        for (const f of this.foes) {
          if (f.hp <= 0 || f.under || Math.abs(f.x - b.x) > 1.6 || Math.abs(f.y - b.y) > 1.6) continue;
          if (Math.hypot(f.x - b.x, f.y - b.y) < f.rad + b.r + 0.12 && b.z > f.z - 0.15 && b.z < f.z + f.ht + 0.15 && this.hitFoe(b, f)) break;
        }
      } else if (Math.hypot(p.x - b.x, p.y - b.y) < PR + b.r && b.z > p.z - 0.1 && b.z < p.z + PH + 0.1) {
        if (b.k === 'mortar') { this.shellBurst(b); b.life = 0; continue; }
        this.hitPlayer(b.dmg); b.life = 0; this.puff(b.x, b.y, b.z, b.col, 8, 2);
      }
      if (b.k === 'mortar' && this.rng() < dt * 30) this.puff(b.x, b.y, b.z, [1, 0.5, 0.15], 1, 0.6, true);
    }
    this.shots = this.shots.filter((b) => b.life > 0);
    for (const q of this.acids || []) {
      q.life -= dt;
      for (const f of this.foes) if (f.hp > 0 && !f.under && !f.fly && Math.hypot(f.x - q.x, f.y - q.y) < q.r && Math.abs(f.z - q.z) < 0.8) this.hurtFoe(f, 12 * dt, 0, 0, f.z + 0.3, 'pull');
      if (this.rng() < dt * 10) this.puff(q.x + this.r(-q.r, q.r) * 0.7, q.y + this.r(-q.r, q.r) * 0.7, q.z + 0.05, [0.5, 0.9, 0.2], 1, 0.6, true);
    }
    if (this.acids) this.acids = this.acids.filter((q) => q.life > 0);
    for (const f of this.foes) {
      if (!(f.hookT > 0) || f.hp <= 0) continue;
      f.hookT -= dt;
      const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1, pull = f.boss ? 2 : f.heavy ? 4 : 10;
      f.kx = (dx / d) * pull; f.ky = (dy / d) * pull;
      this.bolts.push({ pts: [[p.x + Math.cos(p.a) * 0.4, p.y + Math.sin(p.a) * 0.4, p.eye - 0.35], [f.x, f.y, f.z + f.ht * 0.55]], life: dt * 1.5, beam: true, col: '#6a6460', w: 2 });
      if (d < f.rad + 1.2) { f.hookT = 0; this.hurtFoe(f, 18, -dx, -dy, f.z + f.ht * 0.5, 'saw'); }
    }
    const hb = this.hookOut;
    if (hb && hb.life > 0) this.bolts.push({ pts: [[p.x + Math.cos(p.a) * 0.4, p.y + Math.sin(p.a) * 0.4, p.eye - 0.35], [hb.x, hb.y, hb.z]], life: dt * 1.5, beam: true, col: '#6a6460', w: 2 }); else this.hookOut = null;
    for (const bo of this.bolts) bo.life -= dt;
    this.bolts = this.bolts.filter((bo) => bo.life > 0);
  }
  hitFoe(b, f) {
    const k = b.k;
    if (k === 'flame') { if (b.hits[f.id]) return false; b.hits[f.id] = 1; this.hurtFoe(f, b.dmg, b.vx, b.vy, b.z, 'fire'); if (f.hp > 0) f.burnT = this.t + (b.A?.burn || 3); return false; }
    if (k === 'saw') { if ((b.hits[f.id] || 0) > this.t) return false; b.hits[f.id] = this.t + 0.3; this.hurtFoe(f, b.dmg, b.vx, b.vy, b.z, 'saw'); b.dmg *= 0.85; return false; }
    if (k === 'hook') { this.hurtFoe(f, b.dmg, b.vx, b.vy, b.z, 'saw'); if (f.hp > 0) f.hookT = 0.9; b.life = 0; this.hookOut = null; return true; }
    if (k === 'soul') { this.impact(b, b.x, b.y, b.z, null, f); b.life = 0; return true; }
    // a piercing round goes on through, once per foe
    if (b.pierce > 0 && b.mine && k !== 'rocket' && k !== 'grenade') { if (b.hits[f.id]) return false; b.hits[f.id] = 1; b.pierce--; this.hurtFoe(f, b.dmg, b.vx, b.vy, b.z, k); this.affix(b, b.x, b.y, b.z, null, f); return false; }
    if (k === 'skull') { if ((b.hits[f.id] || 0) > this.t) return false; b.hits[f.id] = this.t + 0.35; this.hurtFoe(f, b.dmg, b.vx, b.vy, b.z, k); return false; }
    if (k === 'bee') { if ((b.cdS || 0) > this.t) return false; b.cdS = this.t + 0.5; this.hurtFoe(f, b.dmg, b.vx, b.vy, b.z, k); b.vx = -b.vx + this.r(-3, 3); b.vy = -b.vy + this.r(-3, 3); return false; }
    if (k === 'chicken') { this.hurtFoe(f, b.dmg, b.vx, b.vy, b.z, k); f.kx += b.vx * 0.25; f.ky += b.vy * 0.25; b.vx *= -0.45; b.vy *= -0.45; b.vz = 3; if (--b.bounce < 0) { b.life = 0; this.puff(b.x, b.y, b.z, [1, 0.92, 0.5], 10, 3); } return true; }
    if (k === 'marble') { this.makeHole(b, b.x, b.y, b.z); return true; }
    if (k === 'grenade' || k === 'rocket') { this.impact(b, b.x, b.y, b.z, null, f); b.life = 0; return true; }
    this.impact(b, b.x, b.y, b.z, null, f); b.life = 0;
    return true;
  }
  // where an enemy shell lands: fire, and you hurt if you are in it
  shellBurst(b) {
    const p = this.p, d = Math.hypot(p.x - b.x, p.y - b.y), rad = b.splash || 2.4;
    this.explode(b.x, b.y, b.z, rad, b.dmg * 0.5, { small: true });
    if (d < rad && Math.abs(p.z + 0.8 - b.z) < rad && this.dead <= 0) this.hitPlayer(b.dmg * (1 - (d / rad) * 0.6));
  }
  impact(b, x, y, z, hit, f) {
    const k = b.k, A = b.A;
    if (k === 'mortar') { b.x = x; b.y = y; b.z = z; this.shellBurst(b); return; }
    if (k === 'soul') { this.explode(x, y, z, A?.splash || 4, b.dmg, { hit }); this.puff(x, y, z, [0.6, 1, 0.8], 30, 6, true); return; }
    if (k === 'acid') { const fl = this.wd.floorAt(x, y, z + 0.3, this.wd.sAt(x, y, b.sec)); (this.acids ||= []).push({ x, y, z: fl, r: 1.7, life: 4.5 }); this.pool(x, y, fl, { blood: [0.35, 0.65, 0.1], glow: true }, 1.6); this.puff(x, y, z, [0.55, 0.95, 0.2], 18, 3, true); if (hit) this.decal(x, y, z, hit, [0.3, 0.6, 0.1], 0.6, true); this.blast(x, y, z, 1.4, b.dmg, 'ink'); this.carve(x, y, z, A?.carve || 0.3, hit); return; }
    if (k === 'hive') { for (let i = 0; i < 7; i++) this.shoot('bee', x, y, z + 0.2, this.r(-4, 4), this.r(-4, 4), this.r(1, 4), { mine: true, dmg: 6, life: this.r(4.5, 6.5), r: 0.1, sec: b.sec }); this.puff(x, y, z, [0.85, 0.6, 0.2], 14, 3); this.carve(x, y, z, 0.4, hit); }
    else if (k === 'squid') { this.blast(x, y, z, 2.8, b.dmg, 'ink'); this.ink(x, y, z, hit); this.carve(x, y, z, 0.6, hit); }
    else if (k === 'relic' || k === 'rocket' || k === 'grenade') this.explode(x, y, z, A?.splash || 2.8, b.dmg, { hit });
    else if (k === 'marble') { this.makeHole(b, x, y, z); return; }
    else {
      if (f) this.hurtFoe(f, b.dmg, b.vx, b.vy, b.z, k);
      const sparks = k === 'spit' ? b.col : k === 'plasma' ? [0.5, 0.85, 1] : k === 'chicken' ? [1, 0.92, 0.5] : k === 'bullet' || k === 'nail' || k === 'pellet' ? [1, 0.85, 0.5] : [0.95, 0.92, 0.85];
      this.puff(x, y, z, sparks, k === 'pellet' ? 3 : 6, k === 'plasma' ? 3 : 2, k === 'plasma' || k === 'bullet' || k === 'nail');
      if (hit && !f) { this.decal(x, y, z, hit, k === 'spit' ? b.col : k === 'plasma' ? [0.08, 0.12, 0.2] : [0.1, 0.08, 0.07], k === 'spit' ? 0.55 : 0.3); if (b.mine || k === 'spit') this.carve(x, y, z, A?.carve || 0.15, hit); }
    }
    this.affix(b, x, y, z, hit, f);
  }
  // what a weapon's affixes add to a hit
  affix(b, x, y, z, hit, f) {
    const A = b.A;
    if (!A || !b.mine) return;
    if (A.splash && !['rocket', 'grenade', 'relic'].includes(b.k)) this.explode(x, y, z, A.splash, b.dmg * 0.6, { small: true, hit });
    if (A.split && !b.frag) {
      const back = Math.atan2(-b.vy, -b.vx);
      for (let q = 0; q < A.split; q++) { const a = back + this.r(-1.1, 1.1); this.shoot('pellet', x + Math.cos(back) * 0.12, y + Math.sin(back) * 0.12, z, Math.cos(a) * 18, Math.sin(a) * 18, this.r(-3, 3), { mine: true, dmg: b.dmg * 0.4, r: 0.05, life: 0.6, frag: true, hits: {} }); }
    }
    if (A.burn && f && f.hp > 0) f.burnT = this.t + A.burn;
    if (A.leech && f) this.p.hp = Math.min(this.maxHp(), this.p.hp + b.dmg * A.leech);
  }
  // an explosion: the blast, corpses coming apart, the walls chewed, fire, smoke, sparks, a flash, a scorch
  explode(x, y, z, rad, dmg, o = {}) {
    this.blast(x, y, z, rad, dmg, 'fire');
    for (const f of this.foes) if (f.hp <= 0 && !f.gone && Math.hypot(f.x - x, f.y - y) < rad * 0.8) this.gib(f, f.x - x, f.y - y);
    this.carve(x, y, z, rad * (o.small ? 0.38 : 0.5), o.hit, true);
    this.barrelsNear(x, y, z, rad);
    const n = o.small ? 3 : 6, R = (a, b2) => this.r(a, b2), id = () => (this.bid = (this.bid || 0) + 1);
    for (let k = 0; k < n; k++) this.booms.push({ kind: 'fire', x: x + R(-0.5, 0.5) * rad * 0.35, y: y + R(-0.5, 0.5) * rad * 0.35, z: z + R(-0.1, 0.5), t: -k * 0.035, life: R(0.36, 0.56), s: rad * (o.small ? 0.55 : 0.8) * R(0.6, 1.1), id: id() });
    for (let k = 0; k < n + 2; k++) this.booms.push({ kind: 'smoke', x: x + R(-0.5, 0.5) * rad * 0.4, y: y + R(-0.5, 0.5) * rad * 0.4, z: z + R(0, 0.4), vz: R(0.5, 1.3), t: -0.12 - k * 0.05, life: R(1.4, 2.6), s: rad * R(0.35, 0.6), id: id() });
    if (this.booms.length > 90) this.booms.splice(0, this.booms.length - 90);
    this.puff(x, y, z, [1, 0.72, 0.32], o.small ? 16 : 40, o.small ? 5 : 8, true);
    this.puff(x, y, z, [0.22, 0.18, 0.16], o.small ? 6 : 16, 3);
    this.decal(x, y, z, o.hit || null, [0.05, 0.04, 0.03], rad * (o.small ? 0.4 : 0.6));
    const d = Math.hypot(this.p.x - x, this.p.y - y);
    this.shake = Math.max(this.shake || 0, clamp((o.small ? 0.28 : 0.7) * (1 - d / 16), 0, 0.7));
    this.boomFlash = Math.max(this.boomFlash || 0, clamp(1 - d / 13, 0, 1) * (o.small ? 0.22 : 0.5));
  }
  seekSteer(b, dt) {
    if (!b.tg || b.tg.hp <= 0 || (b.reT = (b.reT || 0) - dt) <= 0) { b.reT = 0.25; b.tg = null; let bd = 14; for (const f of this.foes) if (f.hp > 0) { const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd) { bd = d; b.tg = f; } } }
    const f = b.tg;
    if (!f) return;
    const sp = Math.hypot(b.vx, b.vy, b.vz) || 1, tx = f.x - b.x, ty = f.y - b.y, tz = f.z + f.ht * 0.55 - b.z, l = Math.hypot(tx, ty, tz) || 1, k = Math.min(1, dt * b.A.seek);
    b.vx += ((tx / l) * sp - b.vx) * k; b.vy += ((ty / l) * sp - b.vy) * k; b.vz += ((tz / l) * sp - b.vz) * k;
  }
  expire(b) {
    if (b.k === 'soul' || b.k === 'mineSet') { if (b.k === 'mineSet') this.explode(b.x, b.y, b.z + 0.2, b.A?.splash || 3, b.dmg, {}); else this.impact(b, b.x, b.y, b.z, null, null); return; }
    if (b.k === 'hook') { this.hookOut = null; return; }
    if (b.k === 'hive' || b.k === 'squid' || b.k === 'relic' || b.k === 'rocket' || b.k === 'grenade') this.impact(b, b.x, b.y, b.z, null, null);
    else if (b.k === 'marble') { this.makeHole(b, b.x, b.y, b.z); b.life = 3.2; }
    else if (b.k === 'skull') this.skullOut = null;
  }
  makeHole(b, x, y, z) { Object.assign(b, { k: 'hole', x, y, z: Math.max(z, this.wd.floorAt(x, y, z, b.sec) + 1.1), vx: 0, vy: 0, vz: 0, life: 3.2, r: 0.5, mine: true }); this.puff(x, y, z, [0.6, 0.3, 1], 16, 3, true); }
  holeStep(b, dt) {
    for (const f of this.foes) {
      if (f.hp <= 0) continue;
      const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy) || 0.01;
      if (d > 7.5) continue;
      const pull = (14 / (d + 0.6)) * dt * (f.boss ? 0.25 : f.heavy ? 0.4 : 1); f.kx += (dx / d) * pull * 6; f.ky += (dy / d) * pull * 6; f.awake = true;
      if (d < 1.7) this.hurtFoe(f, b.dmg * 1.6 * dt, dx, dy, f.z + f.ht * 0.5, d < 0.7 ? 'hole' : 'pull');
    }
    for (const g of this.gibs) { const dx = b.x - g.x, dy = b.y - g.y, d = Math.hypot(dx, dy); if (d < 6) { g.rest = false; g.vx += (dx / d) * dt * 30; g.vy += (dy / d) * dt * 30; g.vz += dt * 8; if (d < 0.5) g.life = 0; } }
    if (b.life <= 0) { this.blast(b.x, b.y, b.z, 3.4, 42, 'hole'); this.puff(b.x, b.y, b.z, [0.65, 0.35, 1], 40, 7, true); this.puff(b.x, b.y, b.z, [1, 0.7, 0.3], 20, 5, true); }
  }
  beeSteer(b, dt) {
    if (!b.tg || b.tg.hp <= 0 || (b.reT = (b.reT || 0) - dt) <= 0) {
      b.reT = 0.3; b.tg = null; let bd = 14;
      for (const f of this.foes) if (f.hp > 0) { const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd) { bd = d; b.tg = f; } }
    }
    const f = b.tg, j = Math.sin(b.t * 17 + b.spin) * 3;
    const tx = f ? f.x - b.x : Math.cos(b.t * 2 + b.spin), ty = f ? f.y - b.y : Math.sin(b.t * 2 + b.spin), tz = f ? f.z + f.ht * 0.6 - b.z : 0, l = Math.hypot(tx, ty, tz) || 1;
    const k = Math.min(1, dt * 3.5);
    b.vx += ((tx / l) * 8 - ty / l * j - b.vx) * k; b.vy += ((ty / l) * 8 + tx / l * j - b.vy) * k; b.vz += ((tz / l) * 8 + Math.cos(b.t * 13) * 2 - b.vz) * k;
  }
  blast(x, y, z, rad, dmg, kind) {
    for (const f of this.foes) {
      if (f.hp <= 0) continue;
      const dx = f.x - x, dy = f.y - y, dz = f.z + f.ht * 0.5 - z, d = Math.hypot(dx, dy, dz * 0.6);
      if (d > rad + f.rad || !this.wd.los(x, y, z + 0.1, f.x, f.y, f.z + f.ht * 0.5)) continue;
      const k = 1 - Math.min(1, d / (rad + f.rad)) * 0.6;
      if (kind === 'ink') f.blind = 4.5;
      f.kx += (dx / (d || 1)) * 5 * k * (f.heavy ? 0.3 : 1); f.ky += (dy / (d || 1)) * 5 * k * (f.heavy ? 0.3 : 1);
      this.hurtFoe(f, dmg * k, dx, dy, f.z + f.ht * 0.5, kind === 'fire' ? 'relic' : kind);
    }
  }
  ink(x, y, z, hit) {
    const g = { blood: [0.06, 0.04, 0.12], glow: null };
    this.spray(x, y, z, 0, 0, g, 46, true);
    if (hit) this.decal(x, y, z, hit, [0.04, 0.03, 0.08], 1.6);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + this.r(0, 0.6); this.wallSplat(x, y, z, Math.cos(a), Math.sin(a), g, this.r(0.7, 1.3), 2.8); }
    this.pool(x, y, z, g, 1.5);
  }
  // ------------------------------------------------------------------ damage and gore
  hurtFoe(f, dmg, dx, dy, hz, kind) {
    if (f.hp <= 0 || f.under) return;
    if (f.armor) dmg *= 1 - f.armor;
    if (f.cst === 'stun') dmg *= 1.5;
    f.hp -= dmg; f.awake = true; f.hitT = kind === 'pull' ? f.hitT : 0.14;
    const g = this.goreOf(f.m), l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, z = hz ?? f.z + f.ht * 0.6;
    if (kind !== 'pull' || this.rng() < 0.08) this.spray(f.x - ux * f.rad * 0.4, f.y - uy * f.rad * 0.4, z, ux, uy, g, Math.min(28, 5 + dmg * 0.8));
    if (kind !== 'pull' && this.rng() < 0.75) this.wallSplat(f.x, f.y, z, ux, uy, g, 0.45 + Math.min(1, dmg / 35), 3);
    if (kind !== 'pull' && kind !== 'hole') { const kb = Math.min(4, dmg / 8) * (f.heavy ? 0.3 : 1); f.kx += ux * kb; f.ky += uy * kb; }
    if (f.hp <= 0) this.killFoe(f, dmg, ux, uy, kind);
  }
  killFoe(f, dmg, ux, uy, kind) {
    if (f.burst) { this.burstFoe(f); return; }
    this.kills++; this.score += Math.round(f.max) + (f.boss ? 500 : 0);
    const g = this.goreOf(f.m), gib = !f.boss && (dmg > f.max * 0.45 || ['relic', 'hole', 'ink'].includes(kind) || this.rng() < 0.35);
    f.dieT = this.t;
    if (gib) { this.gib(f, ux, uy); return; }
    // it drops, bleeding: a spray, a few pieces, a spreading pool, and it keeps pumping for a moment
    this.spray(f.x, f.y, f.z + f.ht * 0.5, ux, uy, g, 48, true);
    for (let i = 0, n = this.ri(3, 5); i < n; i++) this.gibs.push({ x: f.x, y: f.y, z: f.z + f.ht * this.r(0.3, 0.8), vx: ux * 2.5 + this.r(-3, 3), vy: uy * 2.5 + this.r(-3, 3), vz: this.r(2, 6.5), k: this.ri(0, 5), g, life: 25, sec: f.sec, spin: this.r(-12, 12), s: this.r(0.26, 0.42) * (f.heavy ? 1.4 : 1) });
    this.pool(f.x, f.y, f.z, g, 1.6 * (f.heavy ? 1.4 : 1));
    for (let k = 0; k < 3; k++) { const a = this.r(0, TAU); this.wallSplat(f.x, f.y, f.z + f.ht * this.r(0.2, 0.9), Math.cos(a), Math.sin(a), g, this.r(0.6, 1.2), 3.5); }
    f.spurt = this.t + 1.8;
    if (f.boss) { this.say(`${f.name.toUpperCase()} IS DEAD`, 3); this.explode(f.x, f.y, f.z + f.ht * 0.4, 3.4, 0, {}); for (let k = 0; k < 3; k++) this.later(0.25 + k * 0.3, () => { this.explode(f.x + this.r(-1, 1), f.y + this.r(-1, 1), f.z + f.ht * this.r(0.2, 0.8), 2, 0, { small: true }); this.spray(f.x, f.y, f.z + f.ht * 0.6, 0, 0, g, 40, true); }); }
  }
  // blown apart: a burst of red, many pieces flung wide, a great pool, splashes on every wall near
  gib(f, ux, uy) {
    const g = this.goreOf(f.m), l = Math.hypot(ux, uy) || 1;
    ux /= l; uy /= l;
    this.spray(f.x, f.y, f.z + f.ht * 0.5, ux, uy, g, 90, true);
    this.puff(f.x, f.y, f.z + f.ht * 0.5, g.blood, 26, 3);
    for (let i = 0, n = Math.round(this.ri(14, 22) * (f.heavy ? 1.4 : 1)); i < n; i++) this.gibs.push({ x: f.x, y: f.y, z: f.z + f.ht * this.r(0.2, 0.9), vx: ux * 3 + this.r(-4.5, 4.5), vy: uy * 3 + this.r(-4.5, 4.5), vz: this.r(2.5, 9.5), k: this.ri(0, 5), g, life: 28, sec: f.sec, spin: this.r(-14, 14), s: this.r(0.26, 0.5) * (f.heavy ? 1.5 : 1) });
    if (this.gibs.length > 110) this.gibs.splice(0, this.gibs.length - 110);
    this.pool(f.x, f.y, f.z, g, 2.3 * (f.heavy ? 1.5 : 1));
    for (let k = 0; k < 7; k++) { const a = this.r(0, TAU); this.wallSplat(f.x, f.y, f.z + f.ht * this.r(0.1, 1), Math.cos(a), Math.sin(a), g, this.r(0.7, 1.5), 4); }
    f.gone = true;
  }
  later(s, fn) { (this.pending ||= []).push({ at: this.t + s, fn }); }
  // a crate (or a stack, or a pair): a voxel block with a slab to bump into
  addCrate(x0, y0, z0, w, h) {
    const n = Math.round(1 / VX), C = { x0, y0, z0, nx: n * w, ny: n, nz: n * h, dirty: true, id: this.vox.crates.length };
    C.vox = new Uint8Array(C.nx * C.ny * C.nz).fill(1); C.left = C.vox.length;
    C.sl = { poly: box(x0, y0, x0 + w, y0 + 1), b: z0, t: z0 + h, tex: 'plank', light: 0.8, crate: C };
    this.wd.addSlab(C.sl); this.vox.crates.push(C);
  }
  // chew the voxels near a point: a shot takes the face it hits, a blast a ball of them
  carve(x, y, z, rad, hit, boom) {
    if (!this.vox) return;
    const rub = [];
    for (const P of this.vox.panels) {
      const e = P.e, rx = x - e.ax, ry = y - e.ay, u = rx * e.ux + ry * e.uy, wn = rx * e.nx + ry * e.ny;
      if (u < -rad || u > e.len + rad || wn > rad + 0.08 || wn < -VD * VX - rad || z < P.z0 - rad || z > P.z0 + P.rows * VX + rad) continue;
      const c0 = Math.max(0, Math.floor((u - rad) / P.du)), c1 = Math.min(P.cols - 1, Math.floor((u + rad) / P.du)), r0 = Math.max(0, Math.floor((z - P.z0 - rad) / VX)), r1 = Math.min(P.rows - 1, Math.floor((z - P.z0 + rad) / VX));
      let hitAny = false;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const dd = Math.hypot((c + 0.5) * P.du - u, P.z0 + (r + 0.5) * VX - z);
        if (dd > rad + VX * 0.45) continue;
        for (let d = 0; d < VD; d++) {
          const i = (d * P.rows + r) * P.cols + c;
          if (!P.vox[i]) continue;
          if (boom && Math.hypot(dd, -(d + 0.5) * VX - wn) > rad * (0.8 + this.rng() * 0.35)) break;
          P.vox[i] = 0; hitAny = true;
          if (rub.length < 14) rub.push([e.ax + e.ux * (c + 0.5) * P.du + e.nx * 0.15, e.ay + e.uy * (c + 0.5) * P.du + e.ny * 0.15, P.z0 + (r + 0.5) * VX, e.nx, e.ny]);
          if (!boom) break;
        }
      }
      if (hitAny) P.dirty = true;
    }
    for (const C of this.vox.crates) {
      if (C.gone || x < C.x0 - rad - 0.2 || x > C.x0 + C.nx * VX + rad + 0.2 || y < C.y0 - rad - 0.2 || y > C.y0 + C.ny * VX + rad + 0.2 || z < C.z0 - rad || z > C.z0 + C.nz * VX + rad) continue;
      const rr = boom ? rad : rad + VX * 0.7;
      for (let k = 0; k < C.nz; k++) for (let j = 0; j < C.ny; j++) for (let i = 0; i < C.nx; i++) {
        const q = (k * C.ny + j) * C.nx + i;
        if (!C.vox[q]) continue;
        const vx = C.x0 + (i + 0.5) * VX, vy = C.y0 + (j + 0.5) * VX, vz = C.z0 + (k + 0.5) * VX;
        if (Math.hypot(vx - x, vy - y, vz - z) > rr * (boom ? 0.8 + this.rng() * 0.35 : 1)) continue;
        C.vox[q] = 0; C.left--; C.dirty = true;
        if (rub.length < 16) rub.push([vx, vy, vz, vx - x, vy - y, true]);
      }
      // too little left to stand: it collapses into planks and splinters
      if (C.left < C.vox.length * 0.35) { C.gone = true; C.sl.t = C.sl.b = -99; for (let q = 0; q < 6; q++) rub.push([C.x0 + this.r(0, C.nx * VX), C.y0 + this.r(0, C.ny * VX), C.z0 + this.r(0, C.nz * VX), this.r(-1, 1), this.r(-1, 1), true]); }
    }
    // the rubble flies, the dust hangs
    for (const [rx, ry, rz, ux, uy, wood] of rub) {
      this.gibs.push({ x: rx, y: ry, z: rz, vx: ux * this.r(1, 3.5) + this.r(-1.2, 1.2), vy: uy * this.r(1, 3.5) + this.r(-1.2, 1.2), vz: this.r(0.5, boom ? 5 : 2.5), k: this.ri(0, 5), g: wood ? this.splinterG() : this.rubbleG, life: 14, sec: this.wd.sAt(rx, ry, null), spin: this.r(-10, 10), s: this.r(0.12, 0.22) });
      if (this.rng() < 0.5) this.puff(rx, ry, rz, mixc(this.rubbleG.blood, [0.5, 0.48, 0.45], 0.4), 3, 1.2);
    }
    if (this.gibs.length > 140) this.gibs.splice(0, this.gibs.length - 140);
    if (rub.length) { const before = this.decals.length; this.decals = this.decals.filter((d) => !d.wall || Math.hypot(d.x - x, d.y - y, d.z - z) > rad + 0.15); if (this.decals.length !== before) this.decalDirty = true; }
  }
  splinterG() { return (this.splG ||= { blood: [0.16, 0.1, 0.06], glow: null, art: Array.from({ length: 6 }, (_, k) => pc(7, 4, (x) => { rect(x, k % 2 ? '#7a5228' : '#5a3a1c', 0, 1, 6 - (k % 3), 2); rect(x, '#a8743c', 0, 1, 3, 1); })) }); }
  // a barrel is hit: it goes up a moment later, and takes its neighbours with it
  barrelHit(bar, dmg) {
    if (bar.gone || (bar.hp -= dmg) > 0) { if (!bar.gone) bar.hitT = this.t; return; }
    bar.gone = true;
    this.later(0.12 + this.rng() * 0.12, () => { bar.sl.t = bar.sl.b = -99; this.explode(bar.x, bar.y, bar.z + 0.5, 3.2, 75, {}); this.score += 15; });
  }
  barrelsNear(x, y, z, rad) { for (const bar of this.barrels || []) if (!bar.gone && Math.hypot(bar.x - x, bar.y - y) < rad * 0.9 && Math.abs(bar.z - z) < rad) this.barrelHit(bar, 99); }
  bloodCol(g) { return g.party ? [this.rng(), this.rng(), this.rng()] : g.glow && this.rng() < 0.45 ? g.glow : mixc(g.blood, [0, 0, 0], this.rng() * 0.35); }
  spray(x, y, z, ux, uy, g, n, wide) {
    const fl = this.wd.floorAt(x, y, z, this.wd.sAt(x, y, null));
    for (let i = 0; i < n; i++) {
      const sp = this.r(1, 5.5), w = wide ? 3 : 1.6;
      this.gore.push({ x, y, z, vx: ux * sp + this.r(-w, w), vy: uy * sp + this.r(-w, w), vz: this.r(0, 4.5), c: this.bloodCol(g), glow: !!g.glow && this.rng() < 0.5, life: this.r(0.8, 2.2), fl, g });
    }
    if (this.gore.length > 720) this.gore.splice(0, this.gore.length - 720);
  }
  puff(x, y, z, c, n, sp, glow) { for (let i = 0; i < n; i++) this.gore.push({ x, y, z, vx: this.r(-sp, sp), vy: this.r(-sp, sp), vz: this.r(-sp * 0.3, sp), c, glow: !!glow, life: this.r(0.3, 0.8), fl: z - 3, air: true }); }
  wallSplat(x, y, z, ux, uy, g, s, range = 3) {
    const h = this.wd.hitWall(x, y, z, x + ux * range, y + uy * range, z - 0.4 * range * this.rng());
    if (h && !h.e.slab?.door) this.decal(h.x, h.y, h.z, h, g.party ? [this.rng(), this.rng(), this.rng()] : g.glow && this.rng() < 0.5 ? g.glow : g.blood, s, !!g.glow);
  }
  decal(x, y, z, hit, c, s, glow) {
    let nx = 0, ny = 0;
    if (hit) { nx = hit.e.nx; ny = hit.e.ny; const vx = x - (hit.e.ax + hit.e.bx) / 2, vy = y - (hit.e.ay + hit.e.by) / 2; if (hit.e.slab ? vx * nx + vy * ny < 0 : false) { nx = -nx; ny = -ny; } }
    this.decals.push({ x, y, z: hit ? z : this.wd.floorAt(x, y, z + 0.3, this.wd.sAt(x, y, null)) + 0.02, nx, ny, wall: !!hit, s, c, k: this.ri(0, 3), rot: this.r(0, TAU), glow });
    if (this.decals.length > 240) this.decals.shift();
    this.decalDirty = true;
  }
  pool(x, y, z, g, s) {
    const d = { x, y, z: this.wd.floorAt(x, y, z + 0.3, this.wd.sAt(x, y, null)) + 0.015, nx: 0, ny: 0, wall: false, s: 0.2, to: s, c: mixc(g.blood, [0, 0, 0], 0.25), k: this.ri(0, 3), rot: this.r(0, TAU), glow: !!g.glow };
    this.decals.push(d); if (this.decals.length > 240) this.decals.shift(); this.decalDirty = true;
  }
  hitPlayer(d) {
    if (this.dead > 0) return;
    const p = this.p, soak = Math.min(p.armor, d * 0.5);
    p.armor -= soak; p.hp -= d - soak; this.hurt = 0.25;
    for (let k = 0; k < 1 + d / 6; k++) this.drips.push({ x: this.r(0, W), y: this.r(-20, VH * 0.35), l: this.r(8, 40), v: this.r(6, 24), w: this.r(2, 6), life: this.r(1.5, 3) });
    if (this.drips.length > 40) this.drips.splice(0, this.drips.length - 40);
    if (p.hp <= 0) { p.hp = 0; this.dead = 1.8; this.say('YOU DIED', 1.8); }
  }
  pickup(it) {
    const p = this.p, k = it.kind, A = this.arms[it.w ?? 0];
    if (k === 'health') { if (p.hp >= this.maxHp()) return; p.hp = Math.min(this.maxHp(), p.hp + 25); }
    else if (k === 'armor') { if (p.armor >= 100) return; p.armor = Math.min(100, p.armor + 50); }
    else if (k === 'ammo') { if (this.ammo[it.w] >= A.ammo * 3) return; this.ammo[it.w] = Math.min(A.ammo * 3, this.ammo[it.w] + A.give); }
    else if (k === 'gun') { this.owned[it.w] = true; if (A.ammo) this.ammo[it.w] += A.ammo; this.weapon = it.w; this.say(A.name.toUpperCase(), 2.5); }
    else if (k === 'key') { p.keys.add(it.key); this.say(`${this.mood.key[0]} KEY`, 2); }
    it.got = true; this.score += 25; this.pickT = this.t;
  }

  // ------------------------------------------------------------------ autopilot
  doorOK(k) { const d = this.wd.doors[k].door; return d.opening || (d.key == null || this.p.keys.has(d.key)) && (!d.secret || this.knowSecret); }
  bestWeapon(d, f) {
    let best = 0, bs = -1;
    this.arms.forEach((A, i) => {
      if (!this.canUse(i)) return;
      const big = f?.heavy || f?.boss, s = { pistol: 1.2, shotgun: d < 6 ? 6.5 : 1.3, nailgun: d < 14 ? 4 : 1.5, rocket: d > 4 ? 5.5 + (big ? 2 : 0) : 0.2, grenade: d > 3 && d < 11 ? 4.6 + (big ? 1 : 0) : 0.3, plasma: d < 14 ? 4.8 : 1.6, tooth: 1, chicken: d < 5 ? 6 : 1.5, hive: d > 3 ? 4 + (big ? 2 : 0) : 0.5, flail: d < 11 ? 4.5 : 1, squid: d > 2.5 && d < 11 ? 4 : 1, fork: d < 15 ? 5 : 1, marble: d > 5 && big ? 7 : d > 5 ? 2.5 : 0, relic: d > 3.5 ? 5 + (big ? 1 : 0) : 0.3,
        chaingun: d < 16 ? 5.2 : 2, flamer: d < 4.5 ? 7 : 0.2, railgun: d > 4 ? 6 + (big ? 2 : 0) : 1.5, stakegun: d < 18 ? 4.6 + (big ? 1 : 0) : 1.5, ripper: d < 12 ? 4.8 : 1.4, chainsaw: d < 1.8 ? 8 : 0.05,
        mines: d > 2.5 && d < 7 ? 3.6 : 0.3, acid: d > 3 && d < 11 ? 4.3 : 0.5, soul: d > 4.5 ? 6 + (big ? 2 : 0) : 0.2, hook: d > 2.5 && d < 14 ? 4.4 : 0.6 }[A.k] + ((i * 7 + this.level * 3) % 5) * 0.2;
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  }
  pickFoe() {
    const p = this.p, ez = p.eye - 0.1;
    let best = null, bs = 1e9;
    for (const f of this.foes) {
      if (f.hp <= 0 || f.under) continue;
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d > 18 || (!f.awake && d > 12)) continue;
      const s = d + Math.abs(angTo(p.a, Math.atan2(f.y - p.y, f.x - p.x))) * 3;
      if (s < bs && this.wd.los(p.x, p.y, ez, f.x, f.y, f.z + f.ht * 0.6)) { bs = s; best = f; }
    }
    return best;
  }
  plan() {
    const wd = this.wd, p = this.p, start = wd.nodeAt(p.x, p.y, p.z, 3);
    this.path = [];
    if (start < 0) return;
    const { dist, prev } = wd.bfs(start, false, (k) => this.doorOK(k), 'player');
    const hp = p.hp / this.maxHp(), needKey = !p.keys.has(0) && this.wd.doors.some((s) => s.door.key != null && !s.door.opening);
    let goal = -1, gs = 1e9;
    const consider = (v, w) => { if (v >= 0 && dist[v] >= 0 && dist[v] * w < gs && !(this.ban.get(v) > this.t)) { gs = dist[v] * w; goal = v; } };
    for (const it of this.items) {
      if (it.got) continue;
      it.node ??= wd.nodeAt(it.x, it.y, it.z, 2);
      const k = it.kind, A = this.arms[it.w ?? 0];
      const w = k === 'health' ? (hp < 0.5 ? 0.25 : hp < 1 ? 1.6 : 0) : k === 'gun' ? 0.45 : k === 'key' ? (needKey ? 0.6 : 0) : k === 'armor' ? (p.armor < 100 ? 1.1 : 0) : k === 'ammo' ? (this.ammo[it.w] < A.ammo * 3 ? (this.owned[it.w] ? 1 : 1.8) : 0) : 0;
      if (w) consider(it.node, w * (it.secret ? 0.8 : 1));
    }
    if (!this.exitOK()) for (const f of this.foes) if (f.hp > 0) consider(wd.nodeAt(f.x, f.y, f.fly ? f.z - f.hover : f.z, 2), 1.3);
    if (this.exitOK() || goal < 0) consider(wd.nodeAt(this.exitPos.x, this.exitPos.y, this.exitPos.z, 2), this.exitOK() ? 0.5 : 3);
    this.goal = goal;
    if (goal < 0) return;
    const nodes = [];
    for (let v = goal; v >= 0 && v !== start && nodes.length < 4000; v = prev[v]) nodes.push(v);
    this.path = nodes.reverse().map((v) => wd.nodeXY(v));
  }
  turnTo(a, rate, dt) { const d = angTo(this.p.a, a); this.p.a += Math.sign(d) * Math.min(Math.abs(d), rate * dt); return Math.abs(d); }
  // can the player walk a little way in this direction (no wall, no ledge to fall from, no closed door)?
  canGo(ux, uy, d = 1.1) { const p = this.p; return this.wd.straight(p.x, p.y, p.z, p.x + ux * d, p.y + uy * d, (k) => this.doorOK(k)); }
  // the spit most likely to hit in the next moment, and which way to step out of its line
  dodgeDir() {
    const p = this.p;
    let best = null, bt = 9;
    for (const b of this.shots) {
      if (b.k !== 'spit' || b.life <= 0) continue;
      const rx = b.x - p.x, ry = b.y - p.y, v2 = b.vx * b.vx + b.vy * b.vy;
      if (v2 < 1) continue;
      const tc = -(rx * b.vx + ry * b.vy) / v2;
      if (tc < 0 || tc > 0.85 || tc > bt) continue;
      const cx = rx + b.vx * tc, cy = ry + b.vy * tc;
      if (Math.hypot(cx, cy) > 0.85 || Math.abs(b.z - p.eye + 0.6) > 1.4) continue;
      bt = tc; const v = Math.sqrt(v2), side = cx * -b.vy + cy * b.vx > 0 ? -1 : 1;
      best = [(-b.vy / v) * side, (b.vx / v) * side];
    }
    if (best) return best;
    // a shell coming down near you: away from where it will land
    for (const b of this.shots) {
      if (b.k !== 'mortar' || b.life <= 0) continue;
      const G = b.grav || 14, dz = b.z - p.z, tl = (b.vz + Math.sqrt(Math.max(0, b.vz * b.vz + 2 * G * dz))) / G, lx = b.x + b.vx * tl, ly = b.y + b.vy * tl, d = Math.hypot(p.x - lx, p.y - ly);
      if (d < 3 && tl < 1.4) return d > 0.2 ? [(p.x - lx) / d, (p.y - ly) / d] : [Math.cos(p.a + Math.PI / 2), Math.sin(p.a + Math.PI / 2)];
    }
    // a watcher about to fire, a charger coming: out of the line
    for (const f of this.foes) {
      if (f.hp <= 0 || !(f.cst === 'aim' && f.cT < 0.7) && !(f.cst === 'wind' || f.cst === 'run')) continue;
      const lx = f.cst === 'aim' ? p.x - f.x : f.cdx, ly = f.cst === 'aim' ? p.y - f.y : f.cdy, l = Math.hypot(lx, ly) || 1, side = (p.x - f.x) * -ly + (p.y - f.y) * lx > 0 ? 1 : -1;
      if (Math.hypot(f.x - p.x, f.y - p.y) < 16) return [(-ly / l) * side, (lx / l) * side];
    }
    return null;
  }
  // a way to the nearest health (or armour) the player can reach, for falling back when hurt
  planHeal() {
    const wd = this.wd, p = this.p, start = wd.nodeAt(p.x, p.y, p.z, 3);
    this.healPath = [];
    if (start < 0) return;
    const { dist, prev } = wd.bfs(start, false, (k) => this.doorOK(k), 'heal');
    let goal = -1, gs = 1e9;
    for (const it of this.items) {
      if (it.got || (it.kind !== 'health' && (it.kind !== 'armor' || p.armor > 60))) continue;
      it.node ??= wd.nodeAt(it.x, it.y, it.z, 2);
      const v = it.node;
      if (v >= 0 && dist[v] >= 0 && dist[v] < gs && dist[v] < 90) { gs = dist[v]; goal = v; }
    }
    const nodes = [];
    for (let v = goal; v >= 0 && v !== start && nodes.length < 4000; v = prev[v]) nodes.push(v);
    this.healPath = nodes.reverse().map((v) => wd.nodeXY(v));
  }
  autopilot(dt) {
    if (!this.wd || this.dead > 0) return;
    const p = this.p, wd = this.wd, hp = p.hp / this.maxHp();
    this.apT -= dt; this.foeT = (this.foeT || 0) - dt; this.healT = (this.healT || 0) - dt;
    if (this.foeT <= 0) { this.foeT = 0.15; this.foe = this.pickFoe(); }
    // stuck: no progress for a while → re-plan and back off (in a fight, just turn the other way)
    this.stuck.t += dt;
    if (this.stuck.t > 1.2) {
      const moved = Math.hypot(p.x - this.stuck.x, p.y - this.stuck.y);
      if (moved < 0.35 && !this.foe) { this.path = []; this.apT = 0; this.unstick = 0.5; this.ustr = this.rng() < 0.5 ? -1 : 1; if (this.goal >= 0) this.ban.set(this.goal, this.t + 25); }
      else if (moved < 0.25 && this.foe) this.strDir = -(this.strDir || 1);
      this.stuck = { t: 0, x: p.x, y: p.y };
    }
    if (this.unstick > 0) { this.unstick -= dt; this.inF = -2; this.inS = this.ustr * 2.5; return; }
    // where to go, in the world (the feet move on their own while the eyes stay on the target)
    let mx = 0, my = 0;
    const go = (vx, vy) => { const c = Math.cos(p.a), s = Math.sin(p.a); this.inF = vx * c + vy * s; this.inS = -vx * s + vy * c; };
    const walkTo = (wp, sp) => { const dx = wp[0] - p.x, dy = wp[1] - p.y, d = Math.hypot(dx, dy) || 1; return [(dx / d) * sp, (dy / d) * sp]; };
    const dodge = this.dodgeDir();
    const f = this.foe;
    if (f && f.hp > 0) {
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 0.01, ux = dx / d, uy = dy / d;
      this.weapon = this.bestWeapon(d, f);
      const off = this.turnTo(Math.atan2(dy, dx) + Math.sin(this.t * 2.3) * 0.03, 4.5, dt);
      if (off < 0.06 + 0.3 / Math.max(1.5, d)) this.fire();
      this.pitchT = clamp((f.z + f.ht * 0.5 - p.eye) / Math.max(2, d), -0.35, 0.35);
      this.path = []; this.apT = Math.min(this.apT, 0.2);
      // hurt: fall back toward the nearest health, still facing the fight
      if (hp < 0.4) { if (this.healT <= 0) { this.healT = 0.6; this.planHeal(); } } else this.healPath = [];
      const hpth = this.healPath;
      while (hpth?.length > 1 && Math.hypot(hpth[0][0] - p.x, hpth[0][1] - p.y) < 0.4) hpth.shift();
      // how far to stand: biters at arm's length and more, spitters at middle distance
      const keep = f.melee && !f.ranged ? (f.speed > 4 ? 5 : 4) : f.boss || f.heavy ? 7 : 6, far = f.melee && !f.ranged ? 10 : 12;
      let want = d < keep ? -1 : d > far ? 0.8 : 0;
      if (hp < 0.4) want = Math.min(want, d < keep + 3 ? -1 : 0);
      this.strT = (this.strT || 0) - dt;
      if (this.strT <= 0) { this.strDir = this.rng() < 0.5 ? -1 : 1; this.strT = this.r(0.5, 1.3); }
      let sx = -uy * this.strDir, sy = ux * this.strDir;
      if (!this.canGo(sx, sy, 0.9)) { this.strDir = -this.strDir; sx = -sx; sy = -sy; if (!this.canGo(sx, sy, 0.9)) sx = sy = 0; }
      if (dodge && this.canGo(dodge[0], dodge[1], 0.9)) { mx = dodge[0] * 4.4; my = dodge[1] * 4.4; }
      else if (hp < 0.4 && hpth?.length && d > 2.5) { [mx, my] = walkTo(hpth[0], 3.6); mx += sx * 1.2; my += sy * 1.2; }
      else {
        let bx = ux * want, by = uy * want;
        if (want < 0 && !this.canGo(bx / Math.abs(want), by / Math.abs(want), 1.2)) bx = by = 0;   // no backing into a wall or off a ledge
        mx = bx * 3.4 + sx * 2.6; my = by * 3.4 + sy * 2.6;
      }
      go(mx, my);
      return;
    }
    this.pitchT = 0;
    if (dodge && this.canGo(dodge[0], dodge[1], 0.9)) { go(dodge[0] * 4.4, dodge[1] * 4.4); return; }
    if (this.apT <= 0 || !this.path.length) { this.apT = 0.7; this.plan(); }
    for (let k = 0; k < 3 && this.path.length > 1 && wd.straight(p.x, p.y, p.z, this.path[1][0], this.path[1][1], (q) => this.doorOK(q)); k++) this.path.shift();
    const wp = this.path[0];
    if (!wp) { this.p.a += dt * 0.8; return; }
    const off = this.turnTo(Math.atan2(wp[1] - p.y, wp[0] - p.x), 4.5, dt);
    if (off < 0.7) this.inF = off < 0.3 ? 4.2 : 2;
    if (Math.hypot(wp[0] - p.x, wp[1] - p.y) < 0.35) this.path.shift();
  }

  // ------------------------------------------------------------------ touch: drag sideways to turn, up/down to walk, tap to fire, tap the HUD to switch weapons
  down(x, y) {
    if (y > H - 34) { const i = Math.floor((x - 150) / 42); if (i >= 0 && i < 5 && this.owned[i]) this.weapon = i; this.drag = null; return; }
    this.drag = { x, y, sx: x, sy: y, t: this.t, moved: false };
  }
  move(x, y) { if (!this.drag) return; const dx = x - this.drag.x; if (Math.abs(x - this.drag.sx) + Math.abs(y - this.drag.sy) > 8) this.drag.moved = true; this.p.a += dx * 0.012; this.drag.x = x; this.drag.cy = y; }
  up() { if (this.drag && !this.drag.moved && this.t - this.drag.t < 0.3) this.fire(); this.drag = null; }
  tap(x, y) { this.down(x, y); this.up(); }
  hud() { return `${Math.floor(this.score)} · lvl ${this.level + 1} · ${this.foes ? this.foes.filter((f) => f.hp > 0).length : 0} left`; }

  // ------------------------------------------------------------------ GPU side
  start() {
    const i = live.indexOf(this); if (i >= 0) live.splice(i, 1); live.push(this);
    while (live.length > 2) { const old = live.find((g) => g !== this && !g.running) || null; if (!old) break; old.dropGpu(); }
    super.start();
  }
  dropGpu(lost = false) {
    const i = live.indexOf(this); if (i >= 0) live.splice(i, 1);
    const gl = this.gl; this.gl = null;
    if (!gl || lost) return;
    const seen = new Set(), free = (o) => { if (!o || seen.has(o)) return; seen.add(o); o.dispose?.(); };
    gl.scene.traverse((o) => { free(o.geometry); free(o.material); });
    for (const t of gl.textures) free(t);
    for (const t of gl.tex.values()) free(t);
  }
  rgbC(v) { return new T.Color().setRGB(v[0], v[1], v[2]); }
  paintKit(gl) {
    const M = this.mood, sk = this.skin, lv = this.level, tiles = sk.slots.tile, ph = (k) => sk.texFor?.(k + lv * 5) || tiles[(k + lv) % tiles.length];
    const mk = (kind, tint, photo, over) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const t = new T.CanvasTexture(cv); t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = T.RepeatWrapping; gl.textures.push(t);
      const seed = (kind.length * 131 + lv * 17 + tint[0] * 999) | 0, hsh = (a, b) => ((((a * 73856093) ^ (b * 19349663) ^ seed) >>> 0) % 997) / 997;
      const paint = () => {
        const px = photoPx(photo), x = cv.getContext('2d'), im = x.createImageData(64, 64), d = im.data, pat = PAT[kind];
        const streaks = kind !== 'liquid' && kind !== 'ceil';
        for (let y = 0; y < 64; y++) for (let xx = 0; xx < 64; xx++) {
          const i = (y * 64 + xx) * 4, L = px ? (px[i] * 0.3 + px[i + 1] * 0.55 + px[i + 2] * 0.15) / 255 : 0.42 + hsh(xx >> 2, y >> 2) * 0.22;
          // grime: big blotches, fine grit, and dark streaks run down from the joints (rust, soot, old blood)
          const blot = 0.8 + 0.3 * hsh(xx >> 4, y >> 4) * (0.6 + 0.4 * hsh((xx + 7) >> 3, (y + 3) >> 3)), run = streaks && hsh(xx >> 1, 33) > 0.84 && y > hsh(xx >> 1, 34) * 40 ? 0.74 : 1;
          const v = (0.5 + 0.55 * L) * pat(xx, y, hsh) * blot * run, b = (BAYER[(y & 3) * 4 + (xx & 3)] / 16 - 0.5) * 0.1;
          for (let c = 0; c < 3; c++) d[i + c] = clamp(Math.round((tint[c] * v * 1.45 + b) * 6) / 6, 0, 1) * 255;
          d[i + 3] = 255;
        }
        x.putImageData(im, 0, 0); over?.(x); t.needsUpdate = true;
      };
      paint();
      if (photo && !ready(photo)) photo.addEventListener?.('load', paint, { once: true });
      return t;
    };
    const Wt = M.wall, F = M.floor, grey = M.metal || [0.42, 0.4, 0.38];
    gl.kit = {
      wall0: mk('brick', Wt[0], ph(1)), wall1: mk('stone', Wt[1], ph(2)), wall2: mk('panel', Wt[2], tiles[lv % tiles.length]), metal: mk('panel', mixc(grey, Wt[2], 0.3), ph(3)),
      floor0: mk('tile', F, ph(4)), tile: mk('tile', mixc(F, [0.95, 0.82, 0.6], 0.45), ph(4)), rock: mk('rock', mixc(F, [0.42, 0.46, 0.3], 0.5), ph(5)), grate: mk('grate', mixc(grey, F, 0.35), ph(6)),
      ceil: mk('ceil', mixc(Wt[1], [0.42, 0.42, 0.44], 0.5), ph(7)), cliff: mk('cliff', mixc(Wt[1], [0.5, 0.42, 0.34], 0.45), ph(5)), dirt: mk('dirt', mixc(F, [0.4, 0.32, 0.22], 0.5), ph(4)), plank: mk('plank', [0.6, 0.42, 0.24], ph(8)), liquid: mk('liquid', M.lc, null),
      step: mk('panel', mixc(grey, Wt[0], 0.3), ph(3), (x) => { for (let i = 0; i < 64; i += 8) { x.fillStyle = '#e8c020'; x.fillRect(i, 0, 4, 5); x.fillStyle = '#161616'; x.fillRect(i + 4, 0, 4, 5); } }),
      door: mk('door', mixc(grey, Wt[2], 0.4), ph(3)), doorK: mk('door', mixc(grey, Wt[2], 0.4), ph(3), (x) => { x.fillStyle = M.key[1]; x.fillRect(6, 28, 52, 7); x.fillRect(29, 6, 6, 52); })
    };
    const sp = splatAtlas(), st = new T.CanvasTexture(sp); st.magFilter = st.minFilter = T.NearestFilter; st.generateMipmaps = false; gl.textures.push(st); gl.kit.splat = st;
  }
  buildGpu() {
    if (!live.includes(this)) live.push(this);
    const sc = new T.Scene(), fog = this.rgbC(this.mood.fog);
    const gl = (this.gl = { scene: sc, textures: [], tex: new Map(), spr: new Map(), frame: 0 });
    sc.fog = new T.Fog(fog, 1.5, 22); sc.background = fog;
    gl.cam = new T.PerspectiveCamera(72, RW / RH, 0.05, 200);
    this.paintKit(gl); this.buildWorld(gl); this.buildSky(gl);
    const pts = (add) => {
      const N = 900, g = new T.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setDrawRange(0, 0);
      const m = new T.Points(g, new T.PointsMaterial({ size: add ? 0.1 : 0.08, vertexColors: true, sizeAttenuation: true, transparent: add, blending: add ? T.AdditiveBlending : T.NormalBlending, depthWrite: !add }));
      m.frustumCulled = false; sc.add(m); return { g, pos, col, N };
    };
    gl.gore = pts(false); gl.glow = pts(true);
    const D = 240, dg = new T.BufferGeometry(), idx = new Uint16Array(D * 6);
    for (let i = 0; i < D; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    gl.dec = { g: dg, pos: new Float32Array(D * 12), uv: new Float32Array(D * 8), col: new Float32Array(D * 12), D };
    dg.setAttribute('position', new T.BufferAttribute(gl.dec.pos, 3)); dg.setAttribute('uv', new T.BufferAttribute(gl.dec.uv, 2)); dg.setAttribute('color', new T.BufferAttribute(gl.dec.col, 3)); dg.setIndex(new T.BufferAttribute(idx, 1)); dg.setDrawRange(0, 0);
    const dm = new T.Mesh(dg, new T.MeshBasicMaterial({ map: gl.kit.splat, vertexColors: true, alphaTest: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: T.DoubleSide }));
    dm.frustumCulled = false; dm.renderOrder = 1; sc.add(dm);
    this.decalDirty = true;
  }
  buildWorld(gl) {
    const B = new Map(), bk = (k) => { let b = B.get(k); if (!b) B.set(k, (b = { p: [], u: [], c: [] })); return b; }, M = this.mood, wd = this.wd;
    const tri = (b, A, Bv, Cv, n) => {
      const ux = Bv[0] - A[0], uy = Bv[1] - A[1], uz = Bv[2] - A[2], vx = Cv[0] - A[0], vy = Cv[1] - A[1], vz = Cv[2] - A[2];
      const ok = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] >= 0;
      for (const P of ok ? [A, Bv, Cv] : [A, Cv, Bv]) { b.p.push(P[0], P[1], P[2]); b.u.push(P[3], P[4]); b.c.push(P[5], P[5] * 0.95, P[5] * 0.88); }
    };
    const wall = (b, e, za0, zb0, za1, zb1, L, anchor) => {
      za1 = Math.max(za1, za0); zb1 = Math.max(zb1, zb0);
      if (za1 - za0 < 0.004 && zb1 - zb0 < 0.004) return;
      const u0 = (e.ax * e.ux + e.ay * e.uy) / TS, u1 = u0 + e.len / TS, sh = L * (0.78 + 0.22 * Math.abs(e.nx)), V = (z, zt) => (anchor ? 1 + (z - zt) / TS : z / TS);
      const A = [e.ax, za0, e.ay, u0, V(za0, za1), sh * 0.7], Bv = [e.bx, zb0, e.by, u1, V(zb0, zb1), sh * 0.7], Cv = [e.bx, zb1, e.by, u1, V(zb1, zb1), sh], D = [e.ax, za1, e.ay, u0, V(za1, za1), sh], n = [e.nx, 0, e.ny];
      tri(b, A, Bv, Cv, n); tri(b, A, Cv, D, n);
    };
    const V2 = (P) => P.map(([x, y]) => new T.Vector2(x, y)), glowLiq = M.liq === 'lava' || M.liq === 'slime';
    for (const s of wd.secs) {
      const L = s.light * (s.sky ? 0.8 : 0.72), all = [...s.poly, ...s.holes.flat()], fb = bk(s.liq ? 'liquid' : s.tex.floor), cb = bk(s.tex.ceil), lf = s.liq && glowLiq ? 1.2 : L, ts = s.liq ? 3 : TS;
      for (const [i, j, k] of T.ShapeUtils.triangulateShape(V2(s.poly), s.holes.map(V2))) {
        const Fv = (q) => { const [x, y] = all[q]; return [x, fz(s, x, y), y, x / ts, y / ts, lf]; }, Cv = (q) => { const [x, y] = all[q]; return [x, cz(s, x, y), y, x / TS, y / TS, L * 0.8]; };
        tri(fb, Fv(i), Fv(j), Fv(k), [0, 1, 0]);
        if (!s.sky) tri(cb, Cv(i), Cv(j), Cv(k), [0, -1, 0]);
      }
      for (const e of s.edges) {
        const fa = fz(s, e.ax, e.ay), fb2 = fz(s, e.bx, e.by), ca = cz(s, e.ax, e.ay), cb2 = cz(s, e.bx, e.by), o = e.o;
        if (!o && e.panel) {
          const P = e.panel, zt = P.z0 + P.rows * VX, back = VD * VX, e2 = { ...e, ax: e.ax - e.nx * back, ay: e.ay - e.ny * back, bx: e.bx - e.nx * back, by: e.by - e.ny * back };
          wall(bk(s.tex.wall), e, zt, zt, ca, cb2, L); wall(bk('rock'), e2, fa, fb2, zt, zt, L * 0.55);
          continue;
        }
        if (!o) { wall(bk(s.tex.wall), e, fa, fb2, ca, cb2, L); continue; }
        const ofa = fz(o, e.ax, e.ay), ofb = fz(o, e.bx, e.by), oca = cz(o, e.ax, e.ay), ocb = cz(o, e.bx, e.by);
        if (ofa > fa + 0.001 || ofb > fb2 + 0.001) wall(bk(o.tex.riser || s.tex.wall), e, fa, fb2, Math.min(ofa, ca), Math.min(ofb, cb2), L, !!o.tex.riser);
        if (!(s.sky && o.sky) && (oca < ca - 0.001 || ocb < cb2 - 0.001)) wall(bk(s.tex.wall), e, Math.max(oca, fa), Math.max(ocb, fb2), ca, cb2, L);
      }
    }
    for (const sl of wd.slabs) {
      const b = sl.door ? (sl.geo = { p: [], u: [], c: [] }) : bk(sl.tex), L = sl.light * 0.72, P = sl.poly, b0 = sl.b0 ?? sl.b, t0 = sl.t0 ?? sl.t;
      for (const [i, j, k] of T.ShapeUtils.triangulateShape(V2(P), [])) {
        const Q = (q, z, l) => [P[q][0], z, P[q][1], P[q][0] / TS, P[q][1] / TS, l];
        tri(b, Q(i, t0, L), Q(j, t0, L), Q(k, t0, L), [0, 1, 0]); tri(b, Q(i, b0, L * 0.6), Q(j, b0, L * 0.6), Q(k, b0, L * 0.6), [0, -1, 0]);
      }
      for (let i = 0; i < P.length; i++) {
        const a = P[i], c = P[(i + 1) % P.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]), ux = (c[0] - a[0]) / len, uy = (c[1] - a[1]) / len;
        wall(b, { ax: a[0], ay: a[1], bx: c[0], by: c[1], len, ux, uy, nx: uy, ny: -ux }, b0, b0, t0, t0, L, true);
      }
    }
    const mesh = (b, map) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(b.p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(b.u, 2)); g.setAttribute('color', new T.Float32BufferAttribute(b.c, 3));
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ map, vertexColors: true })); gl.scene.add(m); return m;
    };
    for (const [k, b] of B) mesh(b, gl.kit[k] || gl.kit.wall0);
    gl.doors = wd.doors.map((sl) => ({ sl, m: mesh(sl.geo, gl.kit[sl.tex] || gl.kit.door) }));
    this.buildPools(gl);
    this.buildVox(gl);
  }
  // the voxel skin and the crates as meshes of their exposed faces, rebuilt when they are chewed
  buildVox(gl) {
    gl.vox = new Map(); gl.voxMat = new Map();
    for (const P of this.vox?.panels || []) { P.dirty = true; this.voxMesh(gl, P); }
    for (const C of this.vox?.crates || []) { C.dirty = true; this.voxMesh(gl, C); }
  }
  voxMesh(gl, O) {
    O.dirty = false;
    const crate = !!O.nx, tex = crate ? 'plank' : O.tex, geo = crate ? this.crateGeo(O) : this.panelGeo(O);
    let mt = gl.voxMat.get(tex);
    if (!mt) { mt = new T.MeshBasicMaterial({ map: gl.kit[tex] || gl.kit.wall0, vertexColors: true, side: T.DoubleSide }); gl.voxMat.set(tex, mt); }
    let m = gl.vox.get(O);
    if (!geo) { if (m) { gl.scene.remove(m); m.geometry.dispose(); gl.vox.delete(O); } return; }
    if (!m) { m = new T.Mesh(geo, mt); gl.scene.add(m); gl.vox.set(O, m); } else { m.geometry.dispose(); m.geometry = geo; }
  }
  geoOf(pos, uv, col) {
    if (!pos.length) return null;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return g;
  }
  panelGeo(P) {
    const e = P.e, L = P.s.light * (P.s.sky ? 0.8 : 0.72), pos = [], uv = [], col = [], Rr = P.rows, Cc = P.cols, u0 = (e.ax * e.ux + e.ay * e.uy) / TS;
    const has = (c, r, d) => c >= 0 && c < Cc && r >= 0 && r < Rr && d >= 0 && d < VD && P.vox[(d * Rr + r) * Cc + c];
    const at = (u, z, w) => [e.ax + e.ux * u - e.nx * w, P.z0 + z, e.ay + e.uy * u - e.ny * w], tu = (q) => u0 + q / TS, tv = (q) => (P.z0 + q) / TS;
    const quad = (A, B, C2, D, ta, tb, tc, td, k) => { for (const [q, t2] of [[A, ta], [B, tb], [C2, tc], [A, ta], [C2, tc], [D, td]]) { pos.push(q[0], q[1], q[2]); uv.push(t2[0], t2[1]); col.push(k, k * 0.95, k * 0.88); } };
    for (let d = 0; d < VD; d++) for (let r = 0; r < Rr; r++) for (let c = 0; c < Cc; c++) {
      if (!P.vox[(d * Rr + r) * Cc + c]) continue;
      const u = c * P.du, U = u + P.du, z = r * VX, Z = z + VX, w = d * VX, Wd = w + VX, j = (0.95 + 0.07 * (((c * 7 + r * 13 + d * 5) % 7) / 7)) * L * (d ? 0.7 : 1);
      if (!has(c, r, d - 1)) quad(at(u, z, w), at(U, z, w), at(U, Z, w), at(u, Z, w), [tu(u), tv(z)], [tu(U), tv(z)], [tu(U), tv(Z)], [tu(u), tv(Z)], j);
      if (r < Rr - 1 && !has(c, r + 1, d)) quad(at(u, Z, w), at(U, Z, w), at(U, Z, Wd), at(u, Z, Wd), [tu(u), tv(Z)], [tu(U), tv(Z)], [tu(U), tv(Z + VX)], [tu(u), tv(Z + VX)], j * 0.86);
      if (r > 0 && !has(c, r - 1, d)) quad(at(u, z, w), at(U, z, w), at(U, z, Wd), at(u, z, Wd), [tu(u), tv(z)], [tu(U), tv(z)], [tu(U), tv(z - VX)], [tu(u), tv(z - VX)], j * 0.48);
      if (c > 0 && !has(c - 1, r, d)) quad(at(u, z, w), at(u, z, Wd), at(u, Z, Wd), at(u, Z, w), [tu(u), tv(z)], [tu(u + VX), tv(z)], [tu(u + VX), tv(Z)], [tu(u), tv(Z)], j * 0.66);
      if (c < Cc - 1 && !has(c + 1, r, d)) quad(at(U, z, w), at(U, z, Wd), at(U, Z, Wd), at(U, Z, w), [tu(U), tv(z)], [tu(U + VX), tv(z)], [tu(U + VX), tv(Z)], [tu(U), tv(Z)], j * 0.66);
    }
    return this.geoOf(pos, uv, col);
  }
  crateGeo(C) {
    if (C.gone) return null;
    const L = (this.wd.sAt(C.x0 + 0.5, C.y0 + 0.5, null)?.light ?? 0.8) * 0.85, pos = [], uv = [], col = [], n = Math.round(1 / VX);
    const has = (i, j, k) => i >= 0 && i < C.nx && j >= 0 && j < C.ny && k >= 0 && k < C.nz && C.vox[(k * C.ny + j) * C.nx + i];
    const at = (i, j, k) => [C.x0 + i * VX, C.z0 + k * VX, C.y0 + j * VX];
    const quad = (A, B, C2, D, k) => { const t2 = [[0, 0], [0.125, 0], [0.125, 0.125], [0, 0.125]].map(([a, b]) => [a + A[0] * 0.5, b + A[1] * 0.5 + A[2] * 0.5]); for (const [q, t] of [[A, t2[0]], [B, t2[1]], [C2, t2[2]], [A, t2[0]], [C2, t2[2]], [D, t2[3]]]) { pos.push(q[0], q[1], q[2]); uv.push(t[0], t[1]); col.push(k, k * 0.92, k * 0.82); } };
    for (let k = 0; k < C.nz; k++) for (let j = 0; j < C.ny; j++) for (let i = 0; i < C.nx; i++) {
      if (!has(i, j, k)) continue;
      // the frame of each crate is darker than its boards
      const frame = (i % n === 0 || i % n === n - 1 ? 1 : 0) + (k % n === 0 || k % n === n - 1 ? 1 : 0) + (j === 0 || j === C.ny - 1 ? 1 : 0) >= 2, b = L * (frame ? 0.62 : 1);
      if (!has(i, j, k + 1)) quad(at(i, j, k + 1), at(i + 1, j, k + 1), at(i + 1, j + 1, k + 1), at(i, j + 1, k + 1), b);
      if (!has(i, j, k - 1)) quad(at(i, j, k), at(i + 1, j, k), at(i + 1, j + 1, k), at(i, j + 1, k), b * 0.4);
      if (!has(i - 1, j, k)) quad(at(i, j, k), at(i, j + 1, k), at(i, j + 1, k + 1), at(i, j, k + 1), b * 0.72);
      if (!has(i + 1, j, k)) quad(at(i + 1, j, k), at(i + 1, j + 1, k), at(i + 1, j + 1, k + 1), at(i + 1, j, k + 1), b * 0.8);
      if (!has(i, j - 1, k)) quad(at(i, j, k), at(i + 1, j, k), at(i + 1, j, k + 1), at(i, j, k + 1), b * 0.9);
      if (!has(i, j + 1, k)) quad(at(i, j + 1, k), at(i + 1, j + 1, k), at(i + 1, j + 1, k + 1), at(i, j + 1, k + 1), b * 0.66);
    }
    return this.geoOf(pos, uv, col);
  }
  // torchlight: a warm pool on the floor under each torch and a glow on the wall it hangs on, added
  // over the scene (they gutter: see sync)
  buildPools(gl) {
    const rad = pc(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    const rt = new T.CanvasTexture(rad); gl.textures.push(rt);
    const lamps = this.lamps || [], Q = lamps.length * 2, pos = new Float32Array(Q * 12), uv = new Float32Array(Q * 8), col = new Float32Array(Q * 12), idx = new Uint16Array(Q * 6);
    lamps.forEach((l, k) => {
      const fr = 3.6, wr = 1.7, z = (l.fz ?? l.z - 1.6) + 0.03, nx = l.nx || 0, ny = l.ny || 0, wx = l.x - nx * 0.27, wy = l.y - ny * 0.27, ax = -ny, ay = nx;
      [[[l.x - fr, z, l.y - fr], [l.x + fr, z, l.y - fr], [l.x + fr, z, l.y + fr], [l.x - fr, z, l.y + fr]],
        [[wx - ax * wr, l.z - wr, wy - ay * wr], [wx + ax * wr, l.z - wr, wy + ay * wr], [wx + ax * wr, l.z + wr, wy + ay * wr], [wx - ax * wr, l.z + wr, wy - ay * wr]]].forEach((q, j) => {
        const b = k * 2 + j;
        q.forEach((v, n) => pos.set(v, (b * 4 + n) * 3));
        uv.set([0, 0, 1, 0, 1, 1, 0, 1], b * 8); idx.set([b * 4, b * 4 + 1, b * 4 + 2, b * 4, b * 4 + 2, b * 4 + 3], b * 6);
      });
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(new T.BufferAttribute(idx, 1));
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: rt, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    m.frustumCulled = false; m.renderOrder = 2; gl.scene.add(m);
    gl.pools = { g, col, lamps };
  }
  // The sky over the open yards and halls, in three layers. Yards are walled about six metres up, so
  // all of it lives between roughly 25° and 60° above the horizon. Far: a dark gradient, stars and a
  // moon (pale, bloody, or a black sun with a burning corona), fixed in the world. Then clouds, lit
  // from below by the fires, drifting. Near: enormous spires and a hooded colossus with a few lit
  // windows, looming over the walls; it is centred a little behind you, so it shifts as you walk
  // (true parallax). Now and then lightning: a bolt, the sky flaring, the yard lit white.
  buildSky(gl) {
    const M = this.mood, R = mulberry32(((this.post.seed || 1) * 31 + this.level * 7919) >>> 0), fog = M.fog, lamp = M.lamp, sky = M.sky;
    const rgb = (v, k = 1) => v.map((q) => clamp(Math.round(q * k * 255), 0, 255));
    const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    const lat = (n) => Float32Array.from({ length: n * n }, () => R());
    const vnw = (L, n, x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, X = (q) => ((q % n) + n) % n, a2 = L[X(y0) * n + X(x0)], b2 = L[X(y0) * n + X(x0 + 1)], c2 = L[X(y0 + 1) * n + X(x0)], d2 = L[X(y0 + 1) * n + X(x0 + 1)], sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return a2 + (b2 - a2) * sx + (c2 - a2) * sy + (a2 - b2 - c2 + d2) * sx * sy; };
    const layer = (w, h, rad, y0, y1, rep2, paint, order, cut) => {
      const cv = pc(w, h, paint), t = new T.CanvasTexture(cv); t.wrapS = T.RepeatWrapping; t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.repeat.set(rep2, 1); gl.textures.push(t);
      const geo = new T.CylinderGeometry(rad, rad, y1 - y0, 48, 1, true); geo.translate(0, (y0 + y1) / 2, 0);
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: t, side: T.BackSide, fog: false, depthWrite: false, alphaTest: cut ? 0.5 : 0 }));
      m.renderOrder = order; gl.scene.add(m); return m;
    };
    const dith = (x2, w, h, top) => { const im = x2.getImageData(0, 0, w, h), d = im.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, bq = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * top; for (let c = 0; c < 3; c++) d[i + c] = clamp(Math.round((d[i + c] + bq) / top) * top, 0, 255); } x2.putImageData(im, 0, 0); };
    // far: radius 120, from 20 below the eye to 200 above; the horizon sits at v = 20/220
    const far = layer(512, 256, 120, -20, 200, 1, (x, w, h) => {
      const hz = h * (1 - 20 / 220), g = x.createLinearGradient(0, 0, 0, hz), top = rgb(fog, 0.7), lo = hexRGB(sky[1]), mid = hexRGB(sky[0]);
      g.addColorStop(0, `rgb(${top})`); g.addColorStop(0.55, `rgb(${mid})`); g.addColorStop(1, `rgb(${lo.map((v) => Math.round(v * 0.8))})`);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 320; k++) { const sx = Math.floor(R() * w), sy = Math.floor(R() * hz * 0.75), b2 = 120 + R() * 135; x.fillStyle = `rgba(${b2},${b2 * 0.92},${b2 * 0.86},${(0.3 + R() * 0.7).toFixed(2)})`; x.fillRect(sx, sy, R() < 0.08 ? 2 : 1, 1); }
      // the moon, about 40° up
      const kind = R(), cx = 60 + R() * (w - 120), cy = Math.round(h * (1 - (100 + 20) / 220)), rr = 15 + R() * 6;
      if (kind < 0.34) {   // a black sun: a dark disc in a burning ring
        for (let k = 3; k >= 0; k--) { x.fillStyle = `rgba(${Math.round(lamp[0] * 255)},${Math.round(lamp[1] * 150)},${Math.round(lamp[2] * 90)},${(0.12 + (3 - k) * 0.12).toFixed(2)})`; x.beginPath(); x.arc(cx, cy, rr + 3 + k * 4, 0, TAU); x.fill(); }
        x.fillStyle = '#ffe6b0'; x.beginPath(); x.arc(cx, cy, rr + 1.5, 0, TAU); x.fill(); x.fillStyle = '#050304'; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fill();
      } else {
        const bloody = kind < 0.67, base = bloody ? [176, 52, 40] : [214, 206, 186];
        x.fillStyle = `rgba(${base},0.1)`; x.beginPath(); x.arc(cx, cy, rr * 1.9, 0, TAU); x.fill();
        for (let y = -rr; y <= rr; y++) for (let xx = -rr; xx <= rr; xx++) { const d2 = Math.hypot(xx, y) / rr; if (d2 > 1) continue; const sh = 0.6 + 0.4 * (1 - Math.max(0, (xx + y * 0.4) / rr)) - (R() < 0.08 ? 0.08 : 0); x.fillStyle = `rgb(${base.map((v) => Math.round(v * sh)).join(',')})`; x.fillRect(Math.round(cx + xx), Math.round(cy + y), 1, 1); }
        for (let k = 0; k < 5; k++) { const a2 = R() * TAU, d2 = R() * rr * 0.6; x.fillStyle = `rgba(0,0,0,${(0.1 + R() * 0.1).toFixed(2)})`; x.beginPath(); x.arc(cx + Math.cos(a2) * d2, cy + Math.sin(a2) * d2, 1 + R() * 2, 0, TAU); x.fill(); }
      }
      dith(x, w, h, 10);
    }, -3, false);
    // clouds: radius 100, from 10 below to 160 above; banks between about 28° and 58°
    const L1 = lat(32), L2 = lat(32), cloudLit = [Math.round(lamp[0] * 120 + 30), Math.round(lamp[1] * 70 + 20), Math.round(lamp[2] * 40 + 20)], cloudDark = rgb(fog, 1.6);
    const clouds = layer(512, 128, 100, -10, 160, 1, (x, w, h) => {
      const im = x.createImageData(w, h), d = im.data, ty = (v) => h * (1 - (v + 10) / 170), yHi = ty(160), yLo = ty(53);
      const n = (xx, y) => vnw(L1, 32, (xx / w) * 32 * 0.999 * 0 + (xx / w) * 32, y / 14) * 0.65 + vnw(L2, 32, (xx / w) * 32 * 2, y / 6) * 0.35;
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
        const band = clamp(Math.min((y - yHi) / 14, (yLo - y) / 10), 0, 1);
        const v = n(xx, y) * band, edge = (BAYER[(y & 3) * 4 + (xx & 3)] / 16) * 0.16;
        if (v < 0.42 + edge) continue;
        const under = clamp((n(xx, y) - n(xx, y + 3)) * 4 + 0.3, 0, 1), i = (y * w + xx) * 4;
        for (let c = 0; c < 3; c++) d[i + c] = Math.round(cloudDark[c] + (cloudLit[c] - cloudDark[c]) * under * 0.7);
        d[i + 3] = 255;
      }
      x.putImageData(im, 0, 0);
    }, -2, true);
    // the near skyline: radius 70, from 10 below to 80 above; towers up to about 45°
    const ink = rgb(fog, 0.45), win = `rgb(${rgb(lamp, 0.95)})`;
    const near = layer(512, 256, 70, -10, 80, 2, (x, w, h) => {
      const ty = (v) => Math.round(h * (1 - (v + 10) / 90)), base = ty(0);
      x.fillStyle = `rgb(${ink})`;
      // a broken ridge at the foot
      for (let xx = 0; xx < w; xx++) { const t2 = ty(10 + vnw(L1, 32, (xx / w) * 32, 3) * 18); x.fillRect(xx, t2, 1, h - t2); }
      const tower = (cx, wd2, top) => {
        const yT = ty(top);
        x.fillRect(cx - wd2 / 2, yT, wd2, base - yT);
        for (const s2 of [-1, 1]) for (let k = 0; k < 3; k++) { const by2 = yT + (base - yT) * (0.35 + k * 0.2); x.fillRect(cx + s2 * (wd2 / 2) - (s2 < 0 ? 3 : 0), by2, 3, base - by2); }
        const sp = Math.max(6, wd2 * 0.9);
        for (let k = 0; k < sp; k++) { const ww = Math.max(1, Math.round((wd2 * (sp - k)) / sp)); x.fillRect(Math.round(cx - ww / 2), yT - k, ww, 1); }
        if (R() < 0.6) { x.fillRect(cx - 0.5, yT - sp - 7, 1, 7); x.fillRect(cx - 2.5, yT - sp - 5, 5, 1); }
        else { x.fillRect(cx - 3, yT - sp - 3, 1, 3); x.fillRect(cx + 2, yT - sp - 3, 1, 3); }
        x.fillStyle = win;
        for (let k = 0; k < 2 + Math.floor(R() * 4); k++) if (R() < 0.75) x.fillRect(Math.round(cx - wd2 / 2 + 2 + R() * (wd2 - 4)), Math.round(yT + 6 + R() * (base - yT - 14)), 1, 2);
        x.fillStyle = `rgb(${ink})`;
      };
      const nT = 6 + Math.floor(R() * 4);
      for (let k = 0; k < nT; k++) tower(Math.round((k + 0.2 + R() * 0.6) * (w / nT)), 6 + Math.floor(R() * 14), 38 + R() * 34);
      // a hooded colossus, eyes lit
      const cx = Math.round(R() * w), hTop = ty(66), hw = 26;
      for (let y = hTop; y < base; y++) { const k = (y - hTop) / (base - hTop), ww = k < 0.22 ? hw * (0.55 + k * 1.6) : hw * (0.9 + k * 1.6); x.fillRect(Math.round(cx - ww / 2), y, Math.round(ww), 1); }
      x.fillStyle = '#ff3a1a'; x.fillRect(cx - 4, hTop + 9, 2, 1); x.fillRect(cx + 2, hTop + 9, 2, 1);
    }, -1, true);
    near.material.color.setScalar(0.9);
    // the bolt: drawn afresh for each strike, standing out in the sky in the strike's direction
    const bc = pc(48, 128, () => {}), bt = new T.CanvasTexture(bc); bt.magFilter = bt.minFilter = T.NearestFilter; bt.generateMipmaps = false; gl.textures.push(bt);
    const bolt = new T.Sprite(new T.SpriteMaterial({ map: bt, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    bolt.renderOrder = -1; bolt.visible = false; gl.scene.add(bolt);
    const open = this.wd.secs.filter((q) => q.sky);
    gl.sky = { far, clouds, near, bolt, bc, bt, on: open.length > 0, open };
  }
  strike(gl) {
    const S = gl.sky, x = S.bc.getContext('2d'), R = this.rng;
    x.clearRect(0, 0, 48, 128);
    const zig = (x0, y0, len, a, w) => { let px = x0, py = y0; for (let k = 0; k < len; k++) { const nx = px + Math.round((R() - 0.5) * 6 + Math.sin(a) * 2), ny = py + 3 + Math.round(R() * 3); x.fillStyle = 'rgba(120,150,255,.5)'; x.fillRect(Math.min(px, nx) - w, py, Math.abs(nx - px) + w * 2 + 1, ny - py + 1); x.fillStyle = '#eef4ff'; x.fillRect(Math.min(px, nx), py, Math.abs(nx - px) + 1, ny - py); if (R() < 0.12 && len - k > 4) zig(nx, ny, Math.floor((len - k) * 0.5), a + (R() - 0.5) * 2, 0); px = nx; py = ny; if (py > 124) break; } };
    zig(24, 0, 40, (R() - 0.5) * 0.6, 2);
    S.bt.needsUpdate = true;
    const p = this.p, a = p.a + (R() - 0.5) * 1.6;
    S.bolt.position.set(p.x + Math.cos(a) * 88, p.eye + 70, p.y + Math.sin(a) * 88); S.bolt.scale.set(22, 60, 1);
  }
  tex(gl, cv) {
    let t = gl.tex.get(cv);
    if (!t) { t = new T.Texture(cv); t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; gl.tex.set(cv, t); }
    return t;
  }
  put(gl, key, img, x, y, z, w, h, l, o = {}) {
    if (!img || !ready(img)) return null;
    const t = this.tex(gl, img);
    let s = gl.spr.get(key);
    if (!s) {
      s = new T.Sprite(new T.SpriteMaterial({ map: t, alphaTest: o.add ? 0 : 0.5, transparent: !!o.add || o.op != null, blending: o.add ? T.AdditiveBlending : T.NormalBlending, depthWrite: !o.add, fog: true }));
      s.center.set(0.5, o.mid ? 0.5 : 0); gl.scene.add(s); gl.spr.set(key, s);
    }
    if (s.material.map !== t) s.material.map = t;
    s.position.set(x, z, y); s.scale.set(w * (o.flip ? -1 : 1), h, 1); s.material.rotation = o.rot || 0;
    if (o.op != null || s.material.opacity !== 1) { if (!s.material.transparent) { s.material.transparent = true; s.material.needsUpdate = true; } s.material.opacity = o.op ?? 1; }
    if (Array.isArray(l)) s.material.color.setRGB(l[0], l[1], l[2]); else s.material.color.setRGB(l, l, l);
    s.f = gl.frame;
    return s;
  }
  art(k, ...a) { const m = (this.artM ||= new Map()), key = k + a.join(); if (!m.has(key)) m.set(key, k === 'key' ? keyArt(...a) : k === 'ball' ? ball(...a) : ART[k](...a)); return m.get(key); }
  // visual-only motion (blood, gibs, pools, screen drips) at the frame rate
  fx(dt) {
    const G = this.G, wd = this.wd, holes = this.shots.filter((b) => b.k === 'hole');
    for (const q of this.gore) {
      q.life -= dt; q.vz -= 14 * G * dt;
      for (const h of holes) { const dx = h.x - q.x, dy = h.y - q.y, dz = h.z - q.z, d = Math.hypot(dx, dy, dz); if (d < 5) { const k = (dt * 25) / (d + 0.3); q.vx += dx * k; q.vy += dy * k; q.vz += dz * k + 14 * G * dt; if (d < 0.35) q.life = 0; } }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.z <= q.fl) { q.life = 0; if (!q.air && q.g && this.rng() < 0.07) this.decal(q.x, q.y, q.fl, null, q.c, this.r(0.12, 0.3), q.glow); }
    }
    this.gore = this.gore.filter((q) => q.life > 0);
    for (const g of this.gibs) {
      g.life -= dt; g.rot = (g.rot || 0) + g.spin * dt * (g.rest ? 0 : 1);
      if (g.rest) continue;
      g.vz -= 16 * G * dt;
      const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt, nz = g.z + g.vz * dt, h = wd.hitWall(g.x, g.y, g.z, nx, ny, nz);
      if (h) { let wx = h.e.nx, wy = h.e.ny; if (g.vx * wx + g.vy * wy > 0) { wx = -wx; wy = -wy; } const d = g.vx * wx + g.vy * wy; g.vx = (g.vx - 2 * d * wx) * 0.4; g.vy = (g.vy - 2 * d * wy) * 0.4; if (this.rng() < 0.6) this.decal(h.x, h.y, h.z, h, g.g.blood, this.r(0.3, 0.6), !!g.g.glow); }
      else { g.x = nx; g.y = ny; g.z = nz; }
      g.sec = wd.sAt(g.x, g.y, g.sec);
      const fl = wd.floorAt(g.x, g.y, g.z + 0.3, g.sec);
      if (g.z <= fl) { g.z = fl; if (g.vz < -2.5) { g.vz *= -0.35; g.vx *= 0.6; g.vy *= 0.6; } else { g.rest = true; this.decal(g.x, g.y, fl, null, g.g.blood, this.r(0.25, 0.55), !!g.g.glow); } }
      else if (this.rng() < 0.4) this.gore.push({ x: g.x, y: g.y, z: g.z, vx: 0, vy: 0, vz: 0, c: this.bloodCol(g.g), glow: !!g.g.glow, life: 1, fl, g: g.g });
    }
    this.gibs = this.gibs.filter((g) => g.life > 0);
    for (const b of this.booms) { b.t += dt; if (b.kind === 'smoke' && b.t > 0) { b.z += b.vz * dt; b.vz *= 1 - dt * 0.6; } }
    this.booms = this.booms.filter((b) => b.t < b.life);
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.6); this.boomFlash = Math.max(0, (this.boomFlash || 0) - dt * 2.2);
    const p = this.p, open = !!p.sec?.sky, ms = (this.motes ||= []);
    if (ms.length < (open ? 70 : 26) && this.rng() < dt * (open ? 40 : 12)) {
      const a = this.r(0, TAU), d = this.r(0.6, 6), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, ember = open && this.rng() < 0.3, lc = this.mood.lamp;
      ms.push({ x, y, z: ember ? p.z + this.r(-0.2, 1) : p.eye + this.r(-1, 2.5), vx: this.r(-0.15, 0.15), vy: this.r(-0.15, 0.15), vz: ember ? this.r(0.3, 0.8) : open ? this.r(-0.45, -0.2) : this.r(-0.06, 0.06), life: this.r(3, 7), ph: this.r(0, 6), c: ember ? [lc[0] * 1.1, lc[1] * 0.6, lc[2] * 0.3] : open ? [0.32, 0.3, 0.29] : [0.4, 0.36, 0.3], glow: ember });
    }
    for (const q of ms) { q.life -= dt; q.x += (q.vx + Math.sin(this.t * 0.9 + q.ph) * 0.12) * dt; q.y += (q.vy + Math.cos(this.t * 0.7 + q.ph) * 0.12) * dt; q.z += q.vz * dt; if (Math.hypot(q.x - p.x, q.y - p.y) > 8) q.life = 0; }
    this.motes = ms.filter((q) => q.life > 0);
    for (const d of this.drips) { d.y += d.v * dt; d.life -= dt; }
    this.drips = this.drips.filter((d) => d.life > 0);
    for (const d of this.decals) if (d.to && d.s < d.to) { d.s = Math.min(d.to, d.s + dt * 0.45); this.decalDirty = true; }
  }
  frameOf(f) { return grimeSprite(this.rawFrame(f)); }
  rawFrame(f) {
    const m = f.m;
    if (m.view) {
      // the view of it from where you stand (Doom's eight rotations)
      const d = viewDir(f.ang, Math.atan2(this.p.y - f.y, this.p.x - f.x));
      if (f.hp <= 0) return m.view('dead', 0, d);
      if (f.cst === 'run') return m.view('walk', Math.floor(f.anim * 12) % 4, d);
      if (f.cst === 'wind' || f.cst === 'crouch' || f.cst === 'aim' || f.cst === 'chant') return m.view('attack', f.cst === 'aim' && f.cT < 0.3 ? 2 : 1, d);
      if (f.cst === 'air') return m.view('attack', 2, d);
      if (f.cst === 'stun') return m.view('hurt', 0, d);
      if (f.actT > 0) return m.view('attack', clamp(Math.floor((1 - f.actT / (f.act === 'bite' ? 0.5 : 0.65)) * 3), 0, 2), d);
      if (f.hitT > 0) return m.view('hurt', 0, d);
      if (f.moving) return m.view('walk', Math.floor(f.anim * (f.speed > 3.5 ? 9 : 6)) % 4, d);
      return m.view('idle', Math.floor(f.anim * 2.4) % 2, d);
    }
    if (f.hp <= 0) return m.dead || m.hurt || m.frames[0];
    if (f.actT > 0 && m.attack) return m.attack[clamp(Math.floor((1 - f.actT / (f.act === 'bite' ? 0.5 : 0.65)) * 3), 0, 2)];
    if (f.hitT > 0 && m.hurt) return m.hurt;
    if (f.moving && m.walk) return m.walk[Math.floor(f.anim * (f.speed > 3.5 ? 9 : 6)) % 4];
    return m.frames[Math.floor(f.anim * 2.4) % 2];
  }
  sync(gl, dt) {
    gl.frame++;
    const p = this.p, t = this.t, light = (s) => (s ? s.light * (s.sky ? 0.95 : 0.86) : 0.72);
    // creature sheets are built lazily: touch one cycle per frame so the first fight does not hitch
    if (!this.warm) {
      this.warm = true;
      const ms = [...new Set(this.foes.map((f) => f.m))];
      this.warmList = ms.flatMap((m) => [() => m.anatomy, ...[0, 1, 2, 3, 4].flatMap((d) => [['idle', 0], ['idle', 1], ['walk', 0], ['walk', 1], ['walk', 2], ['walk', 3], ['attack', 0], ['attack', 1], ['attack', 2], ['hurt', 0], ['dead', 0]].map(([a, k]) => () => grimeSprite(m.view(a, k, d))))]);
    }
    if (this.warmList.length) this.warmList.shift()();   // one a frame: each is a sheet frame drawn, read back and grimed
    if (t > 1 && !gl.refreshed && t < 8 && Math.floor(t) % 2 === 0) { for (const [cv, tx] of gl.tex) if (cv instanceof HTMLCanvasElement) tx.needsUpdate = true; gl.refreshed = Math.floor(t) >= 6; }
    for (const { sl, m } of gl.doors) m.position.y = sl.b - sl.b0;
    if (this.vox) { let n = 4; for (const O of [...this.vox.panels, ...this.vox.crates]) if (O.dirty && n-- > 0) this.voxMesh(gl, O); }
    if (gl.pools?.lamps.length) {
      const L = this.mood.lamp || [1, 0.7, 0.4], c = gl.pools.col;
      gl.pools.lamps.forEach((l, k) => {
        const lm = this.lamps[k], ph = lm?.ph || 0;
        let f = 0.78 + 0.14 * Math.sin(t * 11 + ph) + 0.08 * Math.sin(t * 23.7 + ph * 2);
        if (lm?.dying && Math.sin(t * 2.3 + ph * 3) > 0.55) f *= Math.sin(t * 41 + ph) > 0.2 ? 0.12 : 0.7;   // a dying torch gutters and nearly goes out
        if (lm) lm.f = f;
        for (let j = 0; j < 2; j++) { const a = f * (j ? 0.62 : 0.42); for (let n = 0; n < 4; n++) c.set([L[0] * a, L[1] * a, L[2] * a], ((k * 2 + j) * 4 + n) * 3); }
      });
      gl.pools.g.attributes.color.needsUpdate = true;
    }
    gl.kit.liquid.offset.set(t * 0.04, Math.sin(t * 0.7) * 0.06);
    this.pitch = (this.pitch || 0) + ((this.pitchT || 0) - (this.pitch || 0)) * Math.min(1, dt * 4);
    const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 3), bob = Math.sin(p.bob * 2) * 0.035 * sp, eye = p.eye + bob, cam = gl.cam;
    const sk = this.shake || 0, jx = (Math.random() - 0.5) * sk * 0.22, jy = (Math.random() - 0.5) * sk * 0.18;
    cam.position.set(p.x + jx, eye + jy, p.y + jx * 0.5); cam.lookAt(p.x + Math.cos(p.a) + jx, eye + this.pitch + jy * 1.6, p.y + Math.sin(p.a));
    const S = gl.sky;
    // the sky is only drawn when an open yard or hall is near enough to be seen (it costs a full screen of fill)
    if (gl.frame % 10 === 0) S.vis = S.open.some((q) => { const b = q.bb; return p.x > b[0] - 22 && p.x < b[2] + 22 && p.y > b[1] - 22 && p.y < b[3] + 22; });
    S.far.visible = S.clouds.visible = S.near.visible = !!S.vis;
    S.far.position.set(p.x, eye, p.y); S.clouds.position.set(p.x, eye, p.y); S.clouds.rotation.y = t * 0.006; S.near.position.set(p.x * 0.82, eye, p.y * 0.82);
    if (S.on) {
      this.boltT = (this.boltT ?? this.r(4, 10)) - dt;
      if (this.boltT <= 0) { this.boltT = this.r(7, 19); this.flashS = 1; this.strike(gl); }
      this.flashS = Math.max(0, (this.flashS || 0) - dt * 3.2);
      const fl = this.flashS > 0 ? this.flashS * (0.55 + 0.45 * Math.abs(Math.sin(this.flashS * 19))) : 0;
      S.far.material.color.setScalar(1 + fl * 2.2); S.clouds.material.color.setScalar(1 + fl * 2.8); S.near.material.color.setScalar(0.9 + fl * 0.5);
      S.bolt.visible = fl > 0.08; S.bolt.material.opacity = Math.min(1, fl * 1.6);
    }
    for (const f of this.foes) {
      if (f.gone || (f.under && f.rise <= 0.01)) continue;
      const im = this.frameOf(f), L = light(f.sec), dead = f.hp <= 0;
      const col = f.hitT > 0 && !dead ? [1.6, 0.45, 0.4] : f.zapT > 0 ? [0.8, 1.1, 1.8] : f.burnT > this.t && !dead ? [1.5, 0.75, 0.4] : f.blind > 0 ? [L * 0.5, L * 0.5, L * 0.75] : L * (f.boss ? 1.1 : 1);
      // a stalker is hardly there until it is close (or hurt, or striking): a shimmer in the dark
      const near = Math.hypot(f.x - p.x, f.y - p.y), op = f.ghost && !dead ? (near < 4 || f.hitT > 0 || f.actT > 0 ? 1 : clamp(0.08 + (Math.random() < 0.06 ? 0.3 : 0) + Math.max(0, 1 - (near - 4) / 3) * 0.6, 0.06, 0.9)) : null;
      // a worm comes up out of the floor (the floor hides what is still below it)
      const sink = f.burrow ? (1 - f.rise) * f.size * 0.95 : 0;
      this.put(gl, f, im, f.x, f.y, f.z - (dead ? 0.05 : 0) - f.size * 0.04 - sink, f.size, f.size, col, { flip: !f.m.view && f.face < 0, op });
    }
    for (const it of this.items) {
      if (it.got) continue;
      const bob = Math.sin(t * 3 + it.bob) * 0.08 + 0.15, L = Math.max(0.75, light(it.sec)), k = it.kind;
      if (k === 'health' || k === 'armor') this.put(gl, it, this.art(k), it.x, it.y, it.z + bob, 0.55, k === 'armor' ? 0.64 : 0.43, L);
      else if (k === 'key') this.put(gl, it, this.art('key', this.mood.key[1]), it.x, it.y, it.z + bob + 0.2, 0.5, 0.33, 1.2);
      else {
        const Aw = this.arms[it.w], pi = Aw.gun ? null : { tooth: 'tooth', chicken: 'chicken', hive: 'hive', flail: 'skull', squid: 'squid', fork: 'fork', marble: 'marble', relic: 'relic', acid: 'acidglob', soul: 'soulorb', hook: 'hookart' }[Aw.k];
        const png = k === 'ammo' ? this.ammoImg[it.w] : null, im = png && ready(png) ? png : pi ? this.art(pi) : this.art('gunicon', Aw.k), iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, h = k === 'gun' ? (Aw.gun ? 0.4 : 0.75) : 0.5;
        this.put(gl, it, im, it.x, it.y, it.z + bob, (h * iw) / ih, h, k === 'gun' ? [L * 1.2, L * 1.1, L * 0.8] : L);
      }
    }
    for (const d of this.deco) {
      if (d.kind === 'corpse') this.put(gl, d, grimeSprite(d.m.view('dead', 0, d.dir)), d.x, d.y, d.z - 0.06, 1.8, 1.8, light(d.sec) * 0.85);
      else if (d.kind === 'candles') this.put(gl, d, this.art('candles', Math.floor(t * 6 + d.ph) % 2), d.x, d.y, d.z, 0.5, 0.58, 1.3);
      else if (d.kind === 'skulls') this.put(gl, d, this.art('skulls'), d.x, d.y, d.z, 0.72, 0.5, light(d.sec));
      else if (d.kind === 'deadtree' && !d.gone) this.put(gl, d, grimeSprite(this.art('deadtree', d.v)), d.x, d.y, d.z - 0.05, 2.6, 4.4, light(d.sec) * 0.9);
      else if (d.kind === 'stake') this.put(gl, d, grimeSprite(this.art('stake', d.v)), d.x, d.y, d.z, 0.55, 2.1, light(d.sec));
      else if (d.kind === 'stones') this.put(gl, d, this.art('stones', d.v), d.x, d.y, d.z, 1.1, 0.55, light(d.sec));
      else if (d.kind === 'hang') { const sw = Math.sin(t * 0.9 + d.ph) * 0.05, h = Math.min(2.6, d.top - d.z - 0.7); this.put(gl, d, grimeSprite(this.art('hang', d.v)), d.x + sw, d.y - sw * 0.6, d.top - h, h * 0.42, h, light(d.sec) * 0.95); }
      else if (d.kind === 'eyes' && !d.gone) {
        const dd = Math.hypot(d.x - p.x, d.y - p.y), see = dd > 7.5 && dd < 22 && this.wd.los(p.x, p.y, p.eye, d.x, d.y, d.z);
        if (dd < 6.5 && d.a > 0.2) d.leaving = true;
        d.a = clamp(d.a + (see && !d.leaving ? 0.6 : -2.5) * dt, 0, 1);
        if (d.leaving && d.a <= 0) d.gone = true;
        const blink = Math.sin(t * 0.7 + d.ph * 5) > 0.97 ? 0 : 1;
        if (d.a > 0.02 && blink) this.put(gl, d, this.art('eyes', d.col), d.x, d.y, d.z, 0.34, 0.1, d.a * 1.4, { add: true, mid: true });
      }
    }
    for (const bar of this.barrels || []) if (!bar.gone) this.put(gl, bar, this.art('barrel', t - (bar.hitT ?? -9) < 0.12 ? 1 : 0), bar.x, bar.y, bar.z, 0.74, 0.95, light(bar.sec) * 1.05);
    for (const l of this.lamps) this.put(gl, l, this.art('torch', Math.floor(t * 8 + l.ph) % 2), l.x, l.y, l.z, 0.35, 0.7, 0.3 + (l.f ?? 1) * 1.1);
    const E = this.exitPos;
    if (E) this.put(gl, E, this.art('exit'), E.x, E.y, E.z + 0.05, 1.3 + Math.sin(t * 4) * 0.08, 2.2, this.exitOK() ? [0.5, 1.4, 1] : [1.4, 0.35, 0.3], { add: true });
    for (const b of this.shots) {
      const k = b.k, spin = t * b.spin;
      if (k === 'hole') this.put(gl, b, this.art('hole'), b.x, b.y, b.z, 1.7 + Math.sin(t * 9) * 0.15, 1.7, 1, { add: true, mid: true, rot: t * 6 });
      else if (k === 'spit') this.put(gl, b, this.art('ball', `rgb(${b.col.map((v) => Math.round(v * 255)).join(',')})`), b.x, b.y, b.z, b.r * 2.4, b.r * 2.4, 1.3, { mid: true });
      else if (k === 'flame') { const u = b.t / Math.max(0.01, b.t + b.life), s2 = 0.35 + b.t * 1.8; this.put(gl, b, this.art('boom', Math.min(4, Math.floor(u * 5))), b.x, b.y, b.z, s2, s2, 1, { add: true, mid: true, rot: b.spin * b.t }); }
      else if (k === 'stake') this.put(gl, b, this.art('stakeS'), b.x, b.y, b.z, 0.62, 0.12, light(b.sec) + 0.2, { mid: true, flip: b.vx * -Math.sin(p.a) + b.vy * Math.cos(p.a) < 0 });
      else if (k === 'saw') this.put(gl, b, this.art('sawdisc'), b.x, b.y, b.z, 0.34, 0.34, light(b.sec) + 0.4, { mid: true, rot: t * 30 });
      else if (k === 'mine' || k === 'mineSet') this.put(gl, b, this.art('mineS', k === 'mineSet' && this.t > b.arm && Math.floor(t * 4) % 2 ? 1 : 0), b.x, b.y, b.z, 0.32, 0.2, light(b.sec) + 0.2, { mid: k === 'mine' });
      else if (k === 'acid') this.put(gl, b, this.art('acidglob'), b.x, b.y, b.z, 0.3, 0.3, 1.2, { mid: true, rot: spin });
      else if (k === 'soul') this.put(gl, b, this.art('soulorb', Math.floor(t * 8) % 2), b.x, b.y, b.z, 0.9, 0.9, 1, { add: true, mid: true });
      else if (k === 'hook') this.put(gl, b, this.art('hookart'), b.x, b.y, b.z, 0.36, 0.36, light(b.sec) + 0.2, { mid: true, rot: Math.atan2(b.vz, Math.hypot(b.vx, b.vy)) });
      else if (k === 'mortar') this.put(gl, b, this.art('plasma'), b.x, b.y, b.z, 0.6, 0.6, [1.6, 0.7, 0.25], { add: true, mid: true });
      else if (k === 'relic') this.put(gl, b, ready(this.relicImg) ? this.relicImg : this.art('relic'), b.x, b.y, b.z, 0.45, 0.45, 1, { mid: true, rot: spin });
      else if (k === 'plasma') this.put(gl, b, this.art('plasma'), b.x, b.y, b.z, 0.42, 0.42, 1, { add: true, mid: true });
      else if (k === 'bullet' || k === 'pellet' || k === 'nail' || k === 'rocket' || k === 'grenade') {
        const s = { bullet: [0.08, 0.2], pellet: [0.07, 0.07], nail: [0.3, 0.09], rocket: [0.5, 0.25], grenade: [0.26, 0.26] }[k], side = b.vx * -Math.sin(p.a) + b.vy * Math.cos(p.a);
        this.put(gl, b, this.art(k), b.x, b.y, b.z, s[0], s[1], k === 'rocket' || k === 'grenade' ? light(b.sec) + 0.3 : 1.4, { mid: true, flip: side < 0, rot: k === 'grenade' ? spin : 0 });
      }
      else { const s = { tooth: 0.16, chicken: 0.42, hive: 0.42, bee: 0.17, skull: 0.42, squid: 0.42, marble: 0.26 }[k] || 0.3; this.put(gl, b, this.art(k), b.x, b.y, b.z, s * (k === 'chicken' ? 1.3 : 1), s, 1, { mid: true, rot: k === 'bee' ? 0 : spin, flip: k === 'bee' && b.vx * -Math.sin(p.a) + b.vy * Math.cos(p.a) < 0 }); }
    }
    for (const b of this.booms) {
      if (b.t < 0) continue;
      const u = b.t / b.life;
      if (b.kind === 'fire') this.put(gl, b, this.art('boom', Math.min(4, Math.floor(u * 5))), b.x, b.y, b.z, b.s * (0.7 + u * 0.7), b.s * (0.7 + u * 0.7), 1, { add: true, mid: true, rot: b.id });
      else { const L = light(this.wd.sAt(b.x, b.y, null)) * 0.7 * (1 - u * 0.6); this.put(gl, b, this.art('smoke'), b.x, b.y, b.z, b.s * (0.8 + u * 1.4), b.s * (0.8 + u * 1.4), [L, L * 0.95, L * 0.9], { mid: true, rot: b.id * 0.7 + u }); }
    }
    for (const g of this.gibs) { const im = g.g.art[g.k]; this.put(gl, g, im, g.x, g.y, g.z, (g.s * im.width) / 8, (g.s * im.height) / 8, light(g.sec), { rot: g.rot }); }
    for (const [k, s] of gl.spr) if (s.f !== gl.frame) { gl.scene.remove(s); s.material.dispose(); gl.spr.delete(k); }
    // blood and sparks
    for (const P of [gl.gore, gl.glow]) P.n = 0;
    for (const q of this.motes ? [...this.gore, ...this.motes] : this.gore) {
      const P = q.glow ? gl.glow : gl.gore;
      if (P.n >= P.N) continue;
      const i = P.n++ * 3; P.pos[i] = q.x; P.pos[i + 1] = q.z; P.pos[i + 2] = q.y; P.col[i] = q.c[0]; P.col[i + 1] = q.c[1]; P.col[i + 2] = q.c[2];
    }
    for (const P of [gl.gore, gl.glow]) { P.g.setDrawRange(0, P.n); P.g.attributes.position.needsUpdate = true; P.g.attributes.color.needsUpdate = true; }
    if (this.decalDirty) {
      this.decalDirty = false;
      const D = gl.dec, n = Math.min(D.D, this.decals.length);
      for (let i = 0; i < n; i++) {
        const d = this.decals[i], s = d.s / 2, c = Math.cos(d.rot), sn = Math.sin(d.rot);
        let U, Vv;
        if (d.wall) { const ax = -d.ny, ay = d.nx; U = [ax * c, sn, ay * c]; Vv = [-ax * sn, c, -ay * sn]; } else { U = [c, 0, sn]; Vv = [-sn, 0, c]; }
        const cx = d.x + (d.wall ? d.nx * 0.02 : 0), cy = d.z, cz2 = d.y + (d.wall ? d.ny * 0.02 : 0), u0 = (d.k % 2) * 0.5, v0 = Math.floor(d.k / 2) * 0.5;
        const L = d.glow ? 1.3 : (d.L ??= this.wd.sAt(d.x + d.nx * 0.1, d.y + d.ny * 0.1, null)?.light ?? 0.8);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], k) => {
          D.pos.set([cx + (U[0] * a + Vv[0] * b) * s, cy + (U[1] * a + Vv[1] * b) * s, cz2 + (U[2] * a + Vv[2] * b) * s], (i * 4 + k) * 3);
          D.uv.set([u0 + (a > 0 ? 0.5 : 0), v0 + (b > 0 ? 0.5 : 0)], (i * 4 + k) * 2);
          D.col.set([d.c[0] * L, d.c[1] * L, d.c[2] * L], (i * 4 + k) * 3);
        });
      }
      D.g.setDrawRange(0, n * 6); for (const a of ['position', 'uv', 'color']) D.g.attributes[a].needsUpdate = true;
    }
  }
  draw(c) {
    c.fillStyle = '#0c0a09'; c.fillRect(0, 0, W, H);
    if (this.failed) { this.text(c, '3D unavailable on this device', W / 2, H / 2, 13); return; }
    if (!this.ready || !T) { this.text(c, 'loading…', W / 2, H / 2, 14, '#c9b8a0'); return; }
    let r;
    try { r = renderer(); } catch (e) { this.failed = String(e?.message || e); return; }
    if (!this.gl) this.buildGpu();
    const gl = this.gl, now = performance.now(), dt = Math.min(0.05, (now - (gl.last || now)) / 1000) * this.T;
    gl.last = now;
    this.fx(dt); this.sync(gl, dt);
    r.setClearColor(gl.scene.background, 1); r.clear(); r.render(gl.scene, gl.cam);
    c.imageSmoothingEnabled = false; c.drawImage(r.domElement, 0, 0, W, VH); c.imageSmoothingEnabled = true;
    this.drawBolts(c, gl); this.drawGun(c); this.drawOverlay(c); this.drawHud(c);
  }
  proj(gl, x, y, z) { const v = (gl.v ||= new T.Vector3()).set(x, z, y).project(gl.cam); return v.z > 1 ? null : [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * VH]; }
  drawBolts(c, gl) {
    c.save(); c.lineCap = 'round';
    for (const bo of this.bolts) {
      const a = this.proj(gl, ...bo.pts[0]), b = this.proj(gl, ...bo.pts[1]);
      if (!a || !b) continue;
      if (bo.beam) { c.strokeStyle = bo.col; c.lineWidth = bo.w || 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); continue; }
      const pts = [a];
      for (let k = 1; k < 7; k++) { const t = k / 7, j = (Math.random() - 0.5) * 18 * Math.sin(t * Math.PI); pts.push([a[0] + (b[0] - a[0]) * t + j, a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 14 * Math.sin(t * Math.PI)]); }
      pts.push(b);
      for (const [w, col] of [[6, bo.col?.[0] || 'rgba(90,170,255,.35)'], [2, bo.col?.[1] || '#e8f6ff']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    }
    const s = this.skullOut;
    if (s && s.life > 0) { const q = this.proj(gl, s.x, s.y, s.z); if (q) { const ax = W / 2 + 4, ay = VH - 70; c.fillStyle = '#8a8a90'; for (let k = 1; k < 14; k++) { const t = k / 14; c.fillRect(ax + (q[0] - ax) * t - 1.5, ay + (q[1] - ay) * t - 1.5 + Math.sin(t * Math.PI) * 10, 3, 3); } } }
    c.restore();
  }
  // The weapon in your hands. It is drawn part by part (barrels turned like cylinders, cast and
  // bevelled boxes, worn wood, gloved hands) into a 180×120 buffer, then grimed: grit, rust, soot
  // round its edges, scratches, old blood, a dark outline, all dithered down to a few dirty tones.
  // That is only redone when the weapon changes (or, for the strange ones that move, a dozen times a
  // second). On the card it takes the light of where you stand and the flash of its own shots.
  drawGun(c) {
    const A = this.arms[this.weapon], t = this.t, p = this.p, spin = t - (this.fireT ?? -9) < 0.3, anim = !A.gun || (['nailgun', 'chaingun', 'chainsaw', 'ripper'].includes(A.k) && spin);
    const tq = anim ? Math.floor(t * 12) / 12 : 0, cs = A.k === 'fork' ? (this.cool > 0 ? Math.floor(t * 30) % 2 : 2) : A.k === 'marble' || A.k === 'relic' ? (this.cool > 0 ? 1 : 0) + (this.cool < 0.3 ? 2 : 0) + (this.ammo[this.weapon] > 0 ? 4 : 0) : ['stakegun', 'ripper', 'hook', 'mines'].includes(A.k) ? (this.cool < A.rate * 0.4 && this.ammo[this.weapon] > 0 ? 1 : 0) + (A.k === 'hook' && this.hookOut ? 2 : 0) : 0;
    const key = `${this.weapon}|${A.seed}|${tq}|${cs}|${this.skullOut ? 1 : 0}|${ready(this.relicImg) ? 1 : 0}`;
    if (key !== this.vmKey) { this.vmKey = key; this.vmMz = this.buildGun(A, tq); this.vmG = grimeGun(this.vm, A.seed, this.vmG); this.vmW = warpGun(this.vmG, this.vmW); }
    // lit and glowing in its laid-down form (G puts a glow given in the upright drawing's terms where it lands)
    const mz0 = this.vmMz, fw = gunWarp(mz0[0], mz0[1]), mz = [fw[0], fw[1]], vl = (this.vmL ||= pc(180, GUN_H, () => {})), x = vl.getContext('2d');
    const G = (col, x0, y0, w0, h0) => { const a = gunWarp(x0, y0), b = gunWarp(x0 + w0, y0 + h0); x.fillStyle = col; x.fillRect(Math.round(a[0]), Math.round(a[1]), Math.max(1, Math.round(b[0] - a[0])), Math.max(1, Math.round(b[1] - a[1]))); };
    const mv = Math.min(1, Math.hypot(p.vx, p.vy) / 3), bx = Math.sin(p.bob) * 4 * mv, by = Math.abs(Math.cos(p.bob)) * 3 * mv + this.recoil * 8 + (this.dead > 0 ? 70 : 0);
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, 180, GUN_H); x.drawImage(this.vmW, 0, 0);
    // the light where you stand: the room's own, guttering, warmer near a torch; then the shot's flash
    let warm = 0;
    for (const l of this.lamps || []) { const d = Math.hypot(l.x - p.x, l.y - p.y); if (d < 5) warm = Math.max(warm, 1 - d / 5); }
    const L = clamp((p.sec?.light ?? 0.8) * (0.92 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 17.1)) + warm * 0.25, 0.45, 1);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = `rgba(5,3,2,${((1 - L) * 0.6).toFixed(3)})`; x.fillRect(0, 0, 180, GUN_H);
    if (warm > 0) { const lc = this.mood.lamp; x.fillStyle = `rgba(${Math.round(lc[0] * 255)},${Math.round(lc[1] * 200)},${Math.round(lc[2] * 150)},${(warm * 0.16).toFixed(3)})`; x.fillRect(0, 0, 180, GUN_H); }
    if (this.flash > 0 && A.k !== 'flail') {
      const k = clamp(this.flash / 0.06, 0, 1), cool = A.k === 'fork' || A.k === 'plasma' || A.k === 'railgun', g = x.createRadialGradient(mz[0], mz[1], 1, mz[0], mz[1], 46);
      g.addColorStop(0, cool ? `rgba(150,215,255,${0.38 * k})` : `rgba(255,205,120,${0.38 * k})`); g.addColorStop(1, 'rgba(255,140,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 180, GUN_H);
    }
    x.globalCompositeOperation = 'source-over';
    // what glows on it glows whatever the light: the plasma's coils and the seeker's lamp
    if (A.k === 'plasma') { const gl2 = 0.55 + 0.45 * Math.sin(t * 9); for (let q = 0; q < 3; q++) G(`rgba(110,215,255,${(0.35 + gl2 * 0.45).toFixed(2)})`, 71, 67 + q * 14, 38, 2); G(`rgba(190,240,255,${(0.6 + gl2 * 0.4).toFixed(2)})`, 83, 29, 14, 3); }
    if (A.affixes?.includes('seek') && Math.floor(t * 4) % 2) G('#7aff5a', 108, 62, 3, 3);
    if (A.k === 'flamer') { const f2 = Math.random(); G('rgba(90,150,255,.85)', 87, 19 - Math.round(f2 * 2), 6, 3); G('rgba(255,170,60,.9)', 88, 16 - Math.round(f2 * 3), 4, 3); if (this.t - (this.fireT ?? -9) < 0.1) for (let q = 0; q < 6; q++) G('rgba(255,200,90,.9)', 84 + Math.random() * 12, 6 + Math.random() * 12, 3, 3); }
    if (A.k === 'railgun') { const gl2 = clamp((this.t - (this.fireT ?? -9)) / A.rate, 0, 1); for (let q = 0; q < 8; q++) G(`rgba(120,210,255,${(0.25 + gl2 * 0.6).toFixed(2)})`, 77, 20 + q * 10, 26, 2); G(`rgba(200,240,255,${(0.3 + gl2 * 0.6).toFixed(2)})`, 82, 14, 16, 2); }
    if (A.k === 'soul') { const gl2 = 0.5 + 0.5 * Math.sin(t * 5); G(`rgba(150,255,200,${(0.35 + gl2 * 0.4).toFixed(2)})`, 80, 44, 20, 26); G('rgba(10,30,20,.9)', 83, 50, 4, 5); G('rgba(10,30,20,.9)', 93, 50, 4, 5); G('rgba(10,30,20,.9)', 86, 58 + Math.round(gl2 * 2), 8, 6); }
    if (A.k === 'mines' && Math.floor(t * 3) % 2) G('#ff3020', 89, 42, 3, 2);
    if (A.affixes?.includes('burn')) G(`rgba(255,${110 + Math.round(Math.sin(t * 13) * 40)},40,.8)`, 72, 100, 36, 2);
    c.imageSmoothingEnabled = false; c.drawImage(vl, Math.round(bx) * 2, VH - GUN_H * 2 + Math.round(by) * 2, 360, GUN_H * 2);
    // the muzzle flash: a ragged pixel star, white-hot in the middle, as far off as the muzzle is
    if (this.flash > 0 && A.k !== 'flail') {
      const fx = (fw[0] + Math.round(bx)) * 2, fy = VH - GUN_H * 2 + (fw[1] + Math.round(by)) * 2, cool = A.k === 'fork' || A.k === 'plasma' || A.k === 'railgun', R2 = this.rng, fk = 0.55 + fw[2] * 0.6;
      for (const [r0, col] of [[22, cool ? '#3a8cff' : '#c8401a'], [15, cool ? '#9fd8ff' : '#ffa030'], [8, cool ? '#e8f8ff' : '#ffe8a0'], [3, '#ffffff']]) {
        const r = r0 * fk;
        c.fillStyle = col;
        for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + R2() * 0.5, l = r * (0.6 + R2() * 0.6); for (let q = 0; q < l; q += 3) c.fillRect(Math.round(fx + Math.cos(a) * q - 2), Math.round(fy + Math.sin(a) * q * 0.8 - 2), 4, 4); }
        c.fillRect(fx - r / 2, fy - r / 2.4, r, r / 1.2);
      }
    }
    c.imageSmoothingEnabled = true;
    c.strokeStyle = 'rgba(255,240,220,.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W / 2 - 6, VH / 2); c.lineTo(W / 2 - 2, VH / 2); c.moveTo(W / 2 + 2, VH / 2); c.lineTo(W / 2 + 6, VH / 2); c.moveTo(W / 2, VH / 2 - 6); c.lineTo(W / 2, VH / 2 - 2); c.moveTo(W / 2, VH / 2 + 2); c.lineTo(W / 2, VH / 2 + 6); c.stroke();
  }
  // draw the weapon's parts (no bob, no light) into the 180×120 buffer; returns where its muzzle is
  buildGun(A, t) {
    const vm = (this.vm ||= pc(180, 120, () => {})), x = vm.getContext('2d'), bx = 0, by = 0;
    x.clearRect(0, 0, 180, 120);
    const R = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), w, h); }, dark = '#1d1814', body = this.col(A.hue);
    const P = gunParts(R);
    let mz = [90, 40];
    if (A.gun) mz = this.gritGun(R, P, A, t);
    else switch (A.k) {
      case 'tooth':
        P.hand(90, 98);
        R(dark, 80, 92, 20, 6); P.cyl('#a8987a', 76, 62, 28, 32); for (let q = 0; q < 4; q++) R(P.sh('#a8987a', 0.6), 77, 68 + q * 6, 26, 1); R(P.sh(body, 0.55), 76, 82, 28, 3); R('#5a1a16', 76, 62, 28, 4); R('#3a0e0c', 76, 65, 28, 1);
        for (let k = 0; k < 5; k++) { P.cyl('#c8bc9c', 77 + k * 5, 54 - (k % 2) * 2, 4, 9 + (k % 2) * 2); R('#3a2a1a', 77 + k * 5, 62, 4, 1); R('#6a5a3a', 78 + k * 5, 54 - (k % 2) * 2, 1, 2); }
        R(dark, 84, 58, 12, 5); P.rivet(79, 72); P.rivet(99, 72); mz = [90, 52]; break;
      case 'chicken':
        P.grain('#4a2e18', 62, 98, 56, 22); P.hand(104, 102);
        for (const ox of [66, 92]) { const w = Math.sin(t * 6 + ox) * 2; P.cyl('#2c2c32', ox, 44, 22, 58); R(body, ox, 84, 22, 5); R('#111', ox + 5, 40, 12, 6); P.box('#c8aa30', ox + 5 + w, 28, 12, 13); R('#a8301e', ox + 8 + w, 24, 5, 4); R('#c86a14', ox + 17 + w, 33, 5, 3); R('#111', ox + 13 + w, 31, 2, 2); }
        mz = [90, 30]; break;
      case 'hive':
        P.grain('#3a2c1e', 74, 70, 32, 50); R(body, 74, 100, 32, 5); P.hand(98, 104);
        for (let y = 0; y < 34; y++) { const w = Math.round(Math.sin(((y + 1) / 35) * Math.PI) * 22); R(y % 5 < 1 ? '#5a3410' : '#b0802c', 90 - w, 38 + y, w * 2, 1); R('rgba(0,0,0,.35)', 90 + w - 6, 38 + y, 6, 1); }
        R('#1a0e04', 86, 58, 8, 6);
        for (let k = 0; k < 4; k++) { const a = t * 3 + k * 1.6, qx = 88 + Math.cos(a) * 30, qy = 50 + Math.sin(a * 1.3) * 16; R('#c8a018', qx, qy, 5, 3); R('#111', qx + 2, qy, 1, 3); R('#a8b0c8', qx + 1, qy - 2, 3, 2); }
        break;
      case 'flail':
        P.grain('#4a2e16', 84, 84, 12, 36); P.box('#6a6a70', 82, 80, 16, 6); R(body, 84, 100, 12, 4); P.hand(90, 96);
        if (!this.skullOut) {
          const sx = 90 + Math.sin(t * 3) * 10, sy = 42 + Math.cos(t * 3) * 4;
          for (let k = 0; k < 8; k++) R('#5a5a60', 89 + ((sx - 90) * k) / 8, 80 + ((sy - 80) * k) / 8, 3, 3);
          P.box('#d8ccb0', sx - 10, sy - 12, 20, 16); R('#d8ccb0', sx - 7, sy + 4, 14, 6); R('#1a0d0a', sx - 7, sy - 6, 5, 5); R('#1a0d0a', sx + 2, sy - 6, 5, 5); R('#ff3a1a', sx - 5, sy - 4, 2, 2); R('#ff3a1a', sx + 4, sy - 4, 2, 2); R('#1a0d0a', sx - 4, sy + 5, 2, 4); R('#1a0d0a', sx + 1, sy + 5, 2, 4);
        }
        mz = [90, 70]; break;
      case 'squid':
        for (let k = 0; k < 5; k++) for (let s2 = 0; s2 < 6; s2++) R(k % 2 ? '#9a4268' : '#7a2e52', 66 + k * 11 + Math.sin(t * 4 + k + s2 * 0.8) * 3, 44 - s2 * 4, 4, 5);
        R('#5a1a3a', 62, 46, 56, 12); P.cyl('#9a4268', 66, 58, 48, 62); R(body, 66, 96, 48, 4); P.hand(104, 104);
        R('#d8d0c0', 72, 64, 10, 10); R('#d8d0c0', 98, 64, 10, 10); R('#111', 75 + Math.sin(t) * 2, 68, 4, 4); R('#111', 101 + Math.sin(t) * 2, 68, 4, 4);
        mz = [90, 44]; break;
      case 'fork': {
        const j = this.cool > 0 ? (Math.floor(t * 60) % 2) * 2 - 1 : 0;
        P.cyl('#4a5864', 86, 80, 8, 40); R(body, 85, 100, 10, 4); P.hand(90, 96);
        P.cyl('#9ab4c8', 74 + j, 22, 7, 54); P.cyl('#9ab4c8', 99 - j, 22, 7, 54); P.box('#9ab4c8', 74, 72, 32, 8);
        if (this.cool > 0) { x.strokeStyle = '#bfe8ff'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k < 6; k++) x.lineTo(82 + bx + (k % 2) * 16, 26 + by + k * 8); x.stroke(); }
        mz = [90, 22]; break;
      }
      case 'marble': {
        P.grain('#4a2e16', 85, 86, 10, 34); P.hand(90, 98);
        for (let k = 0; k < 18; k++) { R('#5a3a1e', 85 - k * 1.2, 86 - k * 2, 8, 4); R('#5a3a1e', 87 + k * 1.2, 86 - k * 2, 8, 4); }
        const pull = this.cool > 0 ? 0 : 6;
        x.strokeStyle = '#2a1810'; x.lineWidth = 2; x.beginPath(); x.moveTo(66 + bx, 52 + by); x.lineTo(90 + bx, 64 + pull + by); x.lineTo(118 + bx, 52 + by); x.stroke();
        if (this.ammo[this.weapon] > 0 && this.cool < 0.3) { x.fillStyle = '#160c26'; x.beginPath(); x.arc(90 + bx, 62 + pull + by, 6, 0, TAU); x.fill(); x.strokeStyle = '#9a4cff'; x.beginPath(); x.arc(90 + bx, 62 + pull + by, 3.5, t * 4, t * 4 + 3); x.stroke(); R('#e8dcff', 87, 58 + pull, 2, 2); }
        mz = [90, 56]; break;
      }
      case 'acid': {
        // a swollen bladder of bile in a frame of tubes, dripping
        P.cyl('#5a7a22', 66, 50, 48, 52); for (let q = 0; q < 6; q++) R('#3a5a12', 70 + q * 7, 54 + (q % 3) * 12, 3, 22); R('#8ab43a', 72, 54, 6, 30);
        P.cyl(P.sh('#4a4e3a', 1), 82, 26, 16, 28); P.bore(85, 24, 10, 4); R('#a8f04a', 86, 25, 8, 2);
        for (let q = 0; q < 3; q++) { const dy2 = (t * 18 + q * 9) % 26; R('#7ab42a', 74 + q * 14, 100 + dy2 * 0.4, 2, 3); }
        P.grain('#3a2a1a', 74, 100, 32, 20); P.hand(92, 102); mz = [90, 26]; break;
      }
      case 'soul': {
        // an iron cage with something pale and wailing inside it
        P.cyl('#3a3c40', 66, 80, 48, 40); P.box('#2a2c30', 70, 38, 40, 8); P.box('#2a2c30', 70, 74, 40, 8);
        for (let q = 0; q < 6; q++) P.cyl('#4a4e54', 70 + q * 7, 44, 4, 32);
        P.hand(92, 100); mz = [90, 36]; break;
      }
      case 'hook': {
        // a harpoon gun: the tube, a coil of chain on the side, the barbed hook sitting ready
        P.cyl('#4a4e54', 80, 34, 20, 70); for (let q = 0; q < 3; q++) P.box('#2a2c30', 78, 44 + q * 18, 24, 4);
        if (this.cool < 0.4 && !this.hookOut) { P.cyl('#8a8e96', 88, 16, 4, 20); R('#c8ccd4', 84, 12, 2, 6); R('#c8ccd4', 94, 12, 2, 6); R('#c8ccd4', 86, 10, 8, 3); }
        for (let q = 0; q < 6; q++) { R('#5a5650', 104, 60 + q * 6, 8, 4); R('#8a8680', 105, 61 + q * 6, 6, 1); }
        P.grain('#4a2e18', 72, 98, 36, 22); P.handL(64, 66); P.hand(92, 102); mz = [90, 22]; break;
      }
      default:
        P.cyl('#5a4218', 66, 44, 48, 76); R('#3a2a10', 66, 70, 48, 5); R(body, 66, 96, 48, 5); R('#1a120a', 72, 40, 36, 8); P.hand(104, 102);
        if (this.cool < 0.3 && ready(this.relicImg)) { const im = this.relicImg, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, s2 = 28 / Math.max(iw, ih); x.drawImage(im, 90 + bx - (iw * s2) / 2, 40 + by - ih * s2, iw * s2, ih * s2); }
    }
    return mz;
  }
  // the gritty guns, built from parts in the weapon's own metal and wood, with what its affixes add
  gritGun(R, P, A, t) {
    const [m, hi, lo] = A.metal, wd = A.wood, firing = this.t - (this.fireT ?? -9) < 0.3, k = A.k, af = A.affixes || [], loaded = this.cool < A.rate * 0.4 && this.ammo[this.weapon] > 0;
    let mz = [90, 40];
    if (k === 'pistol') {
      P.cyl(lo, 82, 44, 16, 14); P.bore(86, 44, 8, 5); R(hi, 88, 40, 4, 4);
      P.cyl(m, 78, 56, 24, 38); for (let q = 0; q < 5; q++) R(P.sh(m, 0.45), 79, 80 + q * 3, 22, 1);
      P.rivet(80, 60); P.rivet(98, 60); R(lo, 86, 90, 8, 6);
      P.grain(wd, 82, 94, 16, 26); P.hand(90, 96); mz = [90, 44];
    } else if (k === 'shotgun') {
      for (const ox of [70, 92]) { P.cyl(m, ox, 22, 18, 76); P.bore(ox + 4, 19, 10, 7); }
      R(lo, 88, 22, 4, 70); R(P.sh(hi, 1.1), 89, 22, 1, 70);
      P.grain(wd, 62, 64, 56, 22); for (let q = 0; q < 4; q++) R(P.sh(wd, 0.55), 66 + q * 13, 66, 2, 18);
      P.box(lo, 70, 86, 40, 14); P.rivet(73, 89); P.rivet(105, 89);
      P.grain(wd, 76, 100, 28, 20); P.handL(66, 66); P.hand(92, 102); mz = [90, 22];
    } else if (k === 'nailgun') {
      const sp = firing ? Math.floor(t * 40) % 4 : 0;
      for (let q = 0; q < 4; q++) { const ox = 70 + ((q + sp) % 4) * 10; P.cyl(q % 2 ? m : hi, ox, 24, 8, 42); P.bore(ox + 2, 21, 4, 4); }
      P.box(lo, 66, 58, 48, 7); P.cyl(m, 64, 64, 52, 56); P.cyl(lo, 110, 70, 14, 26); for (let q = 0; q < 5; q++) R(P.sh(lo, 0.5), 110, 72 + q * 5, 14, 1);
      for (let q = 0; q < 4; q++) { P.rivet(67, 70 + q * 12); P.rivet(105, 70 + q * 12); }
      for (let q = 0; q < 6; q++) R(q % 2 ? '#8a7018' : '#141210', 68 + q * 6, 108, 6, 4);
      P.hand(98, 100); mz = [90, 26];
    } else if (k === 'rocket') {
      P.cyl(m, 66, 26, 48, 94); R('#050303', 71, 25, 38, 7); R('#050303', 74, 23, 32, 2); R(hi, 69, 24, 42, 1); R(P.sh(m, 0.5), 69, 32, 42, 2);
      R('#5a160c', 66, 70, 48, 5); for (let q = 0; q < 4; q++) R('#c8b48a', 74 + q * 9, 71, 5, 3);
      P.box(lo, 112, 50, 11, 15); R('#7a1a0e', 115, 53, 5, 4); R('#ff5a3a', 116, 54, 2, 1);
      for (let q = 0; q < 3; q++) P.rivet(68, 40 + q * 22);
      P.handL(58, 60); P.hand(92, 104); mz = [90, 28];
    } else if (k === 'grenade') {
      P.cyl(m, 76, 30, 28, 32); P.bore(80, 27, 20, 8);
      P.cyl(m, 62, 60, 56, 46); for (let q = 0; q < 4; q++) { R('#080605', 69 + q * 12, 70, 9, 9); R(P.sh(m, 1.3), 69 + q * 12, 79, 9, 1); }
      for (let q = 0; q < 3; q++) R(P.sh(m, 0.55), 62, 90 + q * 5, 56, 1);
      P.grain(wd, 72, 104, 36, 16); P.handL(58, 64); P.hand(92, 102); mz = [90, 30];
    } else if (k === 'chaingun') {
      // six barrels round a hub (three show), turning while it fires; a belt of brass feeding in
      const sp = firing ? Math.floor(t * 50) % 3 : 0;
      for (let q = 0; q < 5; q++) { const ox = 66 + q * 10, sh2 = (q + sp) % 3; P.cyl(sh2 === 0 ? hi : sh2 === 1 ? m : lo, ox, 22, 8, 44); P.bore(ox + 2, 19, 4, 4); }
      P.box(lo, 62, 56, 56, 8); P.box(lo, 62, 26, 56, 4); P.cyl(m, 60, 64, 60, 56); for (let q = 0; q < 4; q++) P.rivet(64, 70 + q * 11);
      for (let q = 0; q < 6; q++) { R('#8a6a2a', 114 + (q % 2), 66 + q * 6, 7, 4); R('#c8a04a', 114 + (q % 2), 66 + q * 6, 7, 1); }
      P.handL(56, 70); P.hand(96, 100); mz = [90, 20];
    } else if (k === 'flamer') {
      // a fuel tank slung on the left, a hose, the long nozzle tube with its pilot flame
      P.cyl('#6a2418', 58, 62, 26, 54); for (let q = 0; q < 3; q++) R(P.sh('#6a2418', 0.5), 58, 70 + q * 14, 26, 2); R('#c8b48a', 63, 84, 14, 4);
      P.cyl(m, 82, 24, 18, 82); P.box(lo, 80, 20, 22, 8); P.bore(85, 18, 10, 4); for (let q = 0; q < 4; q++) P.box(lo, 81, 40 + q * 14, 20, 3);
      for (let q = 0; q < 5; q++) R(q % 2 ? '#2a2420' : '#3a322c', 76 - q, 70 + q * 4, 8, 4);
      P.hand(94, 100); mz = [90, 16];
    } else if (k === 'railgun') {
      // a long slim barrel ringed with coils, a capacitor box behind it
      P.cyl(m, 82, 14, 16, 92); for (let q = 0; q < 8; q++) P.box(lo, 76, 20 + q * 10, 28, 4); P.bore(86, 12, 8, 3);
      P.box(lo, 68, 88, 44, 30); P.box(m, 72, 92, 12, 10); R('#16323e', 74, 94, 8, 6); P.rivet(104, 94);
      P.handL(62, 70); P.hand(94, 104); mz = [90, 12];
    } else if (k === 'stakegun') {
      // a heavy tube and a wooden stock; a sharpened stake waits in the mouth
      P.cyl(m, 78, 30, 24, 70); for (let q = 0; q < 3; q++) P.box(lo, 76, 40 + q * 18, 28, 4); P.bore(83, 28, 14, 4);
      if (loaded) { R(wd, 87, 12, 6, 20); R(P.sh(wd, 1.3), 87, 12, 2, 20); R('#9aa0a8', 88, 6, 4, 6); R('#d0d6de', 89, 3, 2, 3); }
      P.grain(wd, 72, 98, 36, 22); P.box(lo, 70, 84, 40, 14);
      P.handL(62, 64); P.hand(92, 102); mz = [90, 24];
    } else if (k === 'ripper') {
      // a flat housing with a saw disc sitting in the top, spinning while it fires
      P.box(m, 60, 58, 60, 42); P.box(lo, 64, 48, 52, 12); for (let q = 0; q < 4; q++) P.rivet(64 + q * 16, 62);
      if (loaded || firing) { const cx = 90, cy = 46, rr = 18, sp = firing ? Math.floor(t * 40) % 4 : 0; for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) { const d = Math.hypot(xx, yy); if (d > rr || yy > 4) continue; const a = Math.atan2(yy, xx) + sp * 0.4, tooth = d > rr - 3 && Math.floor(((a + Math.PI) / TAU) * 24) % 2 === 0; if (d > rr - 3 && !tooth) continue; R(d < 4 ? lo : tooth ? hi : P.sh(hi, 0.8 - (d / rr) * 0.25), cx + xx, cy + yy, 1, 1); } }
      P.grain(wd, 74, 100, 32, 20); P.hand(92, 102); mz = [90, 30];
    } else if (k === 'chainsaw') {
      // the engine, a front handle, the long guide bar and its chain, running while it cuts
      const sp = firing ? Math.floor(t * 40) % 2 : 0;
      P.box('#7e8288', 82, 10, 16, 72); R('#4a4e54', 83, 12, 14, 68);
      for (let q = 0; q < 24; q++) { const yy = 10 + q * 3 + sp; R(q % 2 ? '#2a2c30' : '#c8ccd2', 80, yy, 2, 2); R(q % 2 ? '#c8ccd2' : '#2a2c30', 98, yy, 2, 2); }
      R('#c8ccd2', 84, 8, 12, 2);
      P.box('#b8401a', 64, 78, 52, 40); for (let q = 0; q < 5; q++) R(P.sh('#b8401a', 0.5), 68, 84 + q * 6, 18, 2); P.box(lo, 92, 82, 20, 14);
      P.box(lo, 60, 70, 60, 5); P.box(lo, 60, 70, 5, 20); P.box(lo, 115, 70, 5, 20);
      P.handL(58, 66); P.hand(98, 102); mz = [90, 12];
    } else if (k === 'mines') {
      // a squat launcher with a drum of mines, one sitting in the mouth
      P.cyl(m, 64, 50, 52, 60); P.box(lo, 70, 38, 40, 14); P.bore(76, 36, 28, 6);
      if (loaded) { R('#3a3c34', 80, 32, 20, 8); R('#5a5c50', 82, 32, 16, 2); }
      for (let q = 0; q < 4; q++) { R('#14120e', 70 + q * 11, 68, 8, 8); R('#5a5c50', 71 + q * 11, 69, 6, 6); }
      P.grain(wd, 74, 100, 32, 20); P.handL(58, 62); P.hand(94, 102); mz = [90, 36];
    } else {
      P.cyl(m, 66, 54, 48, 66); for (let q = 0; q < 3; q++) { R('#06080a', 70, 66 + q * 14, 40, 4); R('#1a3a48', 71, 67 + q * 14, 38, 2); }
      P.cyl(lo, 78, 30, 24, 28); R('#16323e', 82, 28, 16, 6); for (let q = 0; q < 4; q++) P.rivet(69, 58 + q * 14);
      P.hand(98, 104); mz = [90, 30];
    }
    // affixes on the metal: a hazard band, a spinning bit at the muzzle, a bloodied grip
    if (af.includes('explosive')) for (let q = 0; q < 5; q++) R(q % 2 ? '#a88a18' : '#121210', 70 + q * 8, 96, 8, 4);
    if (af.includes('drill')) { const s2 = Math.floor(t * 30) % 2; for (let q = 0; q < 4; q++) R('#9a9ea4', mz[0] - 4 + ((q + s2) % 2) * 4, mz[1] - 6 - q * 3, 4, 3); }
    if (af.includes('seek')) R('#1a3a14', 108, 62, 3, 3);
    if (af.includes('leech')) R('#5a0a14', 74, 92, 32, 3);
    return mz;
  }
  drawOverlay(c) {
    // the picture's grain and a heavy vignette, baked together into four small frames made once and
    // cycled (one plain draw a frame: cheap even where the canvas is drawn in software)
    const film = (this.filmCv ||= Array.from({ length: 4 }, (_, k) => pc(180, Math.ceil(VH / 2), (x, w, h) => {
      const im = x.createImageData(w, h), d = im.data, R = mulberry32(k * 977 + 3);
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
        const i = (y * w + xx) * 4, dx = (xx - w / 2) / (w / 2), dy = (y - h * 0.46) / (h * 0.6), r = Math.hypot(dx * 0.92, dy), v = clamp((r - 0.42) / 0.75, 0, 1), va = v * v * 0.82 + (BAYER[(y & 3) * 4 + (xx & 3)] / 16 - 0.5) * 0.04, g = R();
        if (g > 0.975) { d[i] = 200; d[i + 1] = 190; d[i + 2] = 176; d[i + 3] = Math.round((0.045 + va * 0.1) * 255); }
        else if (g < 0.14) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = Math.round(Math.max(va, 0.075) * 255); }
        else { d[i] = 5; d[i + 1] = 2; d[i + 2] = 2; d[i + 3] = Math.round(Math.max(0, va) * 255); }
      }
      x.putImageData(im, 0, 0);
    })));
    const vig = film[Math.floor(this.t * 24) % 4];
    c.imageSmoothingEnabled = false; c.drawImage(vig, 0, 0, W, VH); c.imageSmoothingEnabled = true;
    const hp = this.p.hp / this.maxHp();
    if (hp < 0.35 && this.dead <= 0) { const beat = Math.pow(Math.max(0, Math.sin(this.t * 2 * Math.PI * (1 + (0.35 - hp) * 2))), 12); c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.25 + beat * 0.45; c.fillStyle = '#7a0a08'; c.fillRect(0, 0, W, VH); c.restore(); c.globalAlpha = (0.3 + beat * 0.5) * (1 - hp / 0.35); c.drawImage(vig, 0, 0); c.globalAlpha = 1; }
    if (this.flashS > 0 && this.p.sec?.sky) { c.fillStyle = `rgba(210,220,255,${(this.flashS * 0.22).toFixed(3)})`; c.fillRect(0, 0, W, VH); }
    if (this.hurt > 0) { c.fillStyle = `rgba(190,10,10,${Math.min(0.4, this.hurt * 1.4)})`; c.fillRect(0, 0, W, VH); }
    if (this.boomFlash > 0) { c.fillStyle = `rgba(255,150,60,${Math.min(0.35, this.boomFlash * 0.6)})`; c.fillRect(0, 0, W, VH); }
    for (const d of this.drips) { c.globalAlpha = Math.min(1, d.life) * 0.8; c.fillStyle = '#7a0608'; c.fillRect(d.x, d.y - d.l, d.w, d.l); c.beginPath(); c.arc(d.x + d.w / 2, d.y, d.w * 0.7, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    if (this.dead > 0) { c.fillStyle = `rgba(120,0,0,${clamp(0.75 - this.dead * 0.3, 0, 0.75)})`; c.fillRect(0, 0, W, VH); }
    if (this.pickT && this.t - this.pickT < 0.15) { c.fillStyle = 'rgba(255,230,140,.2)'; c.fillRect(0, 0, W, VH); }
    this.msgs.forEach((m, i) => { c.globalAlpha = Math.min(1, m.t * 2); this.text(c, m.text, W / 2 + 1, 63 + i * 16, 12, '#000'); this.text(c, m.text, W / 2, 62 + i * 16, 12, '#ffe2a8'); });
    c.globalAlpha = 1;
    const wd = this.wd, s = 74 / Math.max(wd.mw, wd.mh), ox = W - 80, oy = 34, p = this.p;
    // the map of what you have seen: drawn again only when there is more of it
    const nSeen = wd.secs.reduce((a, q) => a + (q.seen ? 1 : 0), 0), MS = 2;
    if (!this.mapCv || this.mapCv.wd !== wd || this.mapCv.n !== nSeen) {
      const cv = (this.mapCv ||= document.createElement('canvas')); cv.width = Math.ceil((wd.mw * s + 6) * MS); cv.height = Math.ceil((wd.mh * s + 6) * MS); cv.wd = wd; cv.n = nSeen;
      const m = cv.getContext('2d'); m.scale(MS, MS); m.fillStyle = 'rgba(0,0,0,.35)'; m.fillRect(0, 0, wd.mw * s + 6, wd.mh * s + 6);
      m.lineWidth = 1; m.strokeStyle = '#d8c8a0'; m.beginPath();
      for (const sec of wd.secs) if (sec.seen) for (const e of sec.edges) if (!e.o || Math.abs(fz(sec, e.ax, e.ay) - fz(e.o, e.ax, e.ay)) > 0.7) { m.moveTo(3 + e.ax * s, 3 + e.ay * s); m.lineTo(3 + e.bx * s, 3 + e.by * s); }
      m.stroke();
    }
    c.save(); c.globalAlpha = 0.75; c.drawImage(this.mapCv, ox - 3, oy - 3, wd.mw * s + 6, wd.mh * s + 6);
    if (this.exitPos.sec.seen) { c.fillStyle = '#7affd0'; c.fillRect(ox + this.exitPos.x * s - 2, oy + this.exitPos.y * s - 2, 4, 4); }
    c.fillStyle = '#fff'; c.fillRect(ox + p.x * s - 1.5, oy + p.y * s - 1.5, 3, 3);
    c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(ox + p.x * s, oy + p.y * s); c.lineTo(ox + (p.x + Math.cos(p.a) * 4) * s, oy + (p.y + Math.sin(p.a) * 4) * s); c.stroke();
    c.restore();
  }
  drawHud(c) {
    const p = this.p, vh = VH;
    c.fillStyle = '#1b1612'; c.fillRect(0, vh, W, H - vh); c.fillStyle = '#3a2f27'; c.fillRect(0, vh, W, 2);
    this.text(c, `${Math.max(0, Math.ceil(p.hp))}%`, 24, vh + 18, 14, p.hp < 30 ? '#ff5a3a' : '#ffd27a');
    this.text(c, `${Math.ceil(p.armor)}`, 62, vh + 18, 12, '#7ad7ff');
    const am = this.ammo[this.weapon];
    this.text(c, am === Infinity ? '∞' : String(am), 98, vh + 18, 13, '#f0e6d8');
    if (p.keys.has(0)) { c.fillStyle = this.mood.key[1]; c.fillRect(124, vh + 11, 15, 11); c.fillStyle = '#000'; c.fillRect(127, vh + 14, 4, 4); }
    this.arms.forEach((A, i) => {
      c.fillStyle = i === this.weapon ? this.col(0) : this.owned[i] ? '#4a403a' : '#241e19'; c.fillRect(150 + i * 42, vh + 6, 39, 24);
      this.text(c, A.label, 169.5 + i * 42, vh + 14, 7, this.owned[i] ? '#fff' : '#665');
      if (this.owned[i]) this.text(c, A.ammo ? String(this.ammo[i]) : '∞', 169.5 + i * 42, vh + 24, 7, '#ffd27a');
    });
    this.text(c, this.arms[this.weapon].name, W / 2, vh - 10, 9, 'rgba(255,255,255,.7)');
  }
}

// texture patterns: brightness multipliers over a tinted, dithered photo
const PAT = {
  brick: (x, y, h) => { const r = y >> 3, o = (r & 1) * 8; if ((y & 7) === 0 || ((x + o) & 15) === 0) return 0.45; return 0.82 + h((x + o) >> 4, r) * 0.32 - ((y & 7) === 7 ? 0.12 : 0); },
  stone: (x, y, h) => { const r = y >> 4, o = (r & 1) * 16, u = (x + o) & 31, v = y & 15; if (u === 0 || v === 0) return 0.42; if (u === 1 || v === 1) return 1.22; if (u === 31 || v === 15) return 0.7; return 0.82 + h((x + o) >> 5, r) * 0.3; },
  panel: (x, y, h) => { const u = x & 31, v = y & 31; if (u === 0 || v === 0) return 0.4; if (u === 1 || v === 1) return 1.25; if ((u === 4 || u === 27) && (v === 4 || v === 27)) return 1.45; return 0.92 + h(x >> 5, y >> 5) * 0.14; },
  tile: (x, y, h) => { const u = x & 15, v = y & 15; if (u === 0 || v === 0) return 0.5; return (((x >> 4) + (y >> 4)) & 1 ? 0.88 : 1.04) + h(x >> 4, y >> 4) * 0.12; },
  grate: (x, y) => ((x & 7) < 2 || (y & 15) < 2 ? 0.32 : (x & 7) === 2 ? 1.25 : 1),
  plank: (x, y, h) => { const r = y >> 3, o = Math.floor(h(r, 1) * 64); if ((y & 7) === 0) return 0.4; if (((x + o) & 31) === 0) return 0.55; return 0.85 + h(r, 7) * 0.25 + Math.sin((x * TAU) / 16 + r) * 0.05; },
  ceil: (x, y, h) => { const u = x & 31, v = y & 31; if (u === 0 || v === 0) return 0.55; if (u > 11 && u < 21 && v > 11 && v < 21 && h(x >> 5, y >> 5) > 0.55) return 1.9; return 0.78; },
  rock: (x, y, h) => 0.68 + h(x >> 3, y >> 3) * 0.45 + h(x >> 1, y >> 1) * 0.12 - ((x * 3 + y * 5) % 17 === 0 ? 0.3 : 0),
  door: (x, y) => { if (x < 3 || x > 60 || y < 2) return 0.4; if (x > 30 && x < 34) return 0.5; if ((y & 15) === 8 && (x & 7) === 4) return 1.4; return 0.9 + ((y >> 3) & 1) * 0.06; },
  cliff: (x, y, h) => { const band = Math.sin((y + h(x >> 4, 3) * 9) * 0.45) * 0.12 + Math.sin(y * 1.7 + (x >> 3)) * 0.04, crack = ((x + Math.floor(h(y >> 3, 5) * 13)) & 15) === 0 ? 0.55 : 1; return (0.7 + band + h(x >> 2, y >> 3) * 0.32) * crack - ((y & 7) === 0 && h(x >> 3, y >> 3) > 0.6 ? 0.25 : 0); },
  dirt: (x, y, h) => 0.66 + h(x >> 2, y >> 2) * 0.3 + h(x, y) * 0.16 - (h(x >> 1, y >> 1) > 0.9 ? 0.3 : 0) + (h(x >> 1, (y >> 1) + 9) > 0.94 ? 0.35 : 0),
  liquid: (x, y) => 0.7 + 0.3 * Math.sin(((x + 4 * Math.sin((y * TAU) / 32)) * TAU) / 16) * Math.sin((y * TAU) / 32)
};
function photoPx(img) {
  if (!img || !ready(img)) return null;
  try { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 64, 64); return x.getImageData(0, 0, 64, 64).data; } catch { return null; }
}
