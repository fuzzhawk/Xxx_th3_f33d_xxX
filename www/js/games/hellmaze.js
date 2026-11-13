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
  relic: { label: 'RELIC', names: ['Relic Mortar', 'Heirloom Lobber', 'Junk Howitzer'], rate: 0.95, dmg: 45, speed: 14, grav: 8, n: 1, ammo: 8, give: 5, shot: 'relic', splash: 2.6, carve: 1.1 }
};
const GRIT = ['shotgun', 'nailgun', 'rocket', 'grenade', 'plasma'], WEIRD = ['chicken', 'hive', 'flail', 'squid', 'fork', 'marble', 'relic'];
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
const METALS = [['#4a4c52', '#7a7e88', '#26282c'], ['#6a4630', '#9a6a44', '#3a2618'], ['#7a6a3a', '#b8a05a', '#4a3e1e'], ['#3e4a42', '#62746a', '#202a24'], ['#5a3a3a', '#8a5a52', '#2e1c1c'], ['#c8c0ac', '#ece4d0', '#7a7262']];
const WOODS = ['#5a3820', '#7a4a28', '#3a2a1e', '#6a2a1a'];
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
const ROLES = [
  { role: 'grunt', kind: 'zombie', px: 48, hp: 55, speed: 2.5, size: 1.85, melee: 13 },
  { role: 'spitter', kind: 'imp', px: 40, hp: 38, speed: 2.6, size: 1.5, ranged: 10 },
  { role: 'floater', kind: 'wraith', px: 44, hp: 34, speed: 2.4, size: 1.75, ranged: 8, fly: true },
  { role: 'hound', kind: 'hound', px: 40, hp: 28, speed: 4.6, size: 1.45, melee: 8 },
  { role: 'brute', kind: 'demon', px: 64, hp: 190, speed: 1.7, size: 2.9, ranged: 16, melee: 24, heavy: true },
  { role: 'crawler', kind: 'spider', px: 48, hp: 46, speed: 3.6, size: 1.6, melee: 11 }
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

// ---------------------------------------------------------------- level generator (pure data)
// Rooms sit on a coarse grid; each is a polygon (rect, chamfered, octagon, round, cross, L, cave)
// with flat port edges where corridors join. Corridors are runs of quad sectors: flat, ramps,
// stairs, doors and slit windows. Holes in a room are pillars, broken partition walls or nested
// sectors (daises, pools, pits, skylights, a canal); slabs are boxes standing in sectors (bridge,
// railings, steps, doors, a gallery's walkway). The grid grows with the level, with more loops.
const shp = (k, rad, cx, cy) => (k === 'sq' ? ngon(4, rad * 1.25, Math.PI / 4, cx, cy) : k === 'hex' ? ngon(6, rad, 0, cx, cy) : k === 'oct' ? ngon(8, rad, Math.PI / 8, cx, cy) : ngon(12, rad, 0, cx, cy));
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
  for (const rm of rooms) {
    rm.kind = rm === hall ? 'hall' : rm === exit ? 'shrine' : rm === secret ? 'secret' : R() < 0.24 ? 'yard' : 'room';
    // a gallery: a tall square room with a walkway round three sides and a stair up the fourth
    rm.gal = rm.kind === 'room' && R() < 0.26;
    rm.shape = rm.gal || rm.kind === 'hall' ? 'rect' : rm.kind === 'yard' ? pick(['rect', 'cham', 'round', 'cave']) : rm.kind === 'secret' ? 'oct' : pick(['rect', 'cham', 'oct', 'round', 'cross', 'L', 'cave', 'oct', 'cham']);
    const big = rm.kind === 'hall' || rm.kind === 'yard';
    rm.R = big ? r(6.6, 7) : rm.kind === 'secret' ? r(3.8, 4.6) : rm.gal ? r(6, 6.8) : r(5, 6.5);
    const sq = rm.shape === 'rect' || rm.shape === 'cham' || rm.shape === 'L';
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
    const { a, b, R: Rr } = rm;
    switch (rm.shape) {
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
    const sky = rm.kind === 'yard' || (rm.kind === 'hall' && R() < 0.5), ch = sky ? r(5, 7.5) : rm.kind === 'hall' ? r(6, 7) : rm.kind === 'secret' ? 3 : rm.gal ? r(5, 5.8) : r(3.2, 5);
    const S = { poly: P, holes: [], f: flat(h), c: flat(h + ch), sky, light: sky ? r(1, 1.15) : rm.kind === 'shrine' ? 0.62 : rm.kind === 'secret' ? 1 : r(0.55, 0.95), room: rm,
      tex: { wall: rm.kind === 'yard' ? 'wall1' : rm.kind === 'secret' ? 'wall2' : pick(['wall0', 'wall0', 'wall1']), floor: rm.kind === 'yard' ? 'rock' : 'floor0', ceil: 'ceil' } };
    let feat = rm.kind === 'hall' ? 'canal' : rm.kind === 'shrine' ? 'dais' : rm.kind === 'secret' ? 'none' : rm.gal ? pick(['none', 'pool', 'columns', 'pit', 'none']) : rm === start ? pick(['none', 'sky']) : rm.kind === 'yard' ? pick(['blocks', 'pool', 'none', 'blocks', 'baffles']) : pick(['pillars', 'pillars', 'dais', 'pool', 'pit', 'sky', 'none', 'columns', 'baffles', 'baffles']);
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
    if (l.win) run.push({ s, e, h: Math.max(ha, hb) + 1.05, ch: 1.25, win: true });
    else if (Math.abs(dh) <= 0.5) run.push({ s, e, h: Math.abs(dh) <= 0.3 ? ha : (ha + hb) / 2 });
    else if (l.ramp && Math.abs(dh) / len < 0.75) run.push({ s, e, h: ha, g: dh / len });
    else { const m = Math.ceil(Math.abs(dh) / 0.42), n = m - 1; for (let k = 0; k < n; k++) run.push({ s: k ? s + (k * len) / n : s, e: k === n - 1 ? e : s + ((k + 1) * len) / n, h: ha + (dh * (k + 1)) / m, stair: true }); }
    if (tail) run.push(tail);
    for (const q of run) {
      const fp = q.g ? { h: q.h, gx: l.ax === 'x' ? q.g : 0, gy: l.ax === 'y' ? q.g : 0, ox: l.ax === 'x' ? q.s : 0, oy: l.ax === 'y' ? q.s : 0 } : flat(q.h);
      const S = { poly: quad(q.s, q.e), holes: [], f: fp, c: { ...fp, h: q.h + (q.ch || l.ch) }, light: q.win ? l.light + 0.15 : l.light, link: l, win: q.win,
        tex: { wall: l.wall, floor: 'grate', ceil: 'ceil', riser: q.stair ? 'step' : null } };
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
    if (rm.kind === 'yard') continue;
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
    this.crew = ROLES.map((ro, k) => { const m = horror((s * 13 + k * 101) >>> 0, ro.px, { kind: ro.kind, tier: 1 }); return { ...ro, m, fly: ro.fly || !!m.floats, name: m.name }; });
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
    const f = { ...ro, x, y, z: z + (ro.fly ? 1.4 : 0), vz: 0, kx: 0, ky: 0, hp: ro.hp * mul, max: ro.hp * mul, size, rad: Math.min(0.65, size * 0.2), ht: size * 0.78, awake: false, cd: this.r(0.5, 2), anim: this.r(0, 3), face: 1, ang: this.r(0, TAU), actT: 0, hitT: 0, blind: 0, losT: this.r(0, 0.3), los: false, fireAt: 0, sec: this.wd.sAt(x, y, null), id: (this.fid = (this.fid || 0) + 1), hover: this.r(1.1, 2) };
    this.foes.push(f);
    return f;
  }
  spawnAll(L) {
    const wd = this.wd, R = this.rng, pick = (a) => a[Math.floor(R() * a.length)];
    const sd = wd.bfs(wd.nodeAt(this.p.x, this.p.y, this.p.z, 4), false, null, 'spawn').dist;
    const rooms = L.rooms.filter((rm) => rm !== L.start && rm !== L.secret), far = (v) => sd[v] < 0 || sd[v] > 18;
    const n = Math.round((3 + L.rooms.length * 0.55 + this.level * 1.5) * (this.mods.swarm ? 1.7 : 1)), mul = 1 + this.level * 0.15;
    for (let i = 0; i < n; i++) { const v = wd.randomNode(R, pick(rooms), far); if (v >= 0) this.addFoe(this.crew[i % 7 === 6 ? 4 : pick([0, 0, 1, 2, 3, 5, 0, 1])], ...wd.nodeXY(v), mul); }
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
    this.barrels = [];
    const taken = [...this.items, ...this.foes].map((o) => [o.x, o.y]), free = (x, y, r) => taken.every(([a, b]) => Math.hypot(a - x, b - y) > r) && Math.hypot(x - this.p.x, y - this.p.y) > 3;
    for (const rm of L.rooms) {
      if (rm === L.start && R() < 0.5) continue;
      const big = rm.kind === 'yard' || rm.kind === 'hall', nC = big ? 3 : rm.kind === 'room' ? (R() < 0.7 ? 2 : 0) : 0, nB = big ? 2 : rm.kind === 'room' ? (R() < 0.6 ? 1 : 0) : rm.kind === 'shrine' ? 2 : 0;
      for (let k = 0; k < nC; k++) {
        const v = wd.randomNode(R, rm); if (v < 0) continue;
        const [x, y, z] = wd.nodeXY(v), w = R() < 0.3 ? 2 : 1, h = R() < 0.35 ? 2 : 1;
        if (!free(x, y, 1.6) || wd.near(x, y, z, 1.3)) continue;
        taken.push([x, y]); this.addCrate(x - w * 0.5, y - 0.5, z, w, h);
      }
      for (let k = 0; k < nB; k++) {
        const v = wd.randomNode(R, rm); if (v < 0) continue;
        const [x, y, z] = wd.nodeXY(v);
        if (!free(x, y, 1.3) || wd.near(x, y, z, 0.6)) continue;
        taken.push([x, y]);
        const sl = { poly: box(x - 0.3, y - 0.3, x + 0.3, y + 0.3), b: z, t: z + 0.95, tex: 'metal', light: 0.8, barrel: true }, bar = { x, y, z, hp: 16, sl, sec: wd.sAt(x, y, null) };
        sl.barrel = bar; wd.addSlab(sl); this.barrels.push(bar);
      }
      const nd = rm.kind === 'yard' ? 3 : rm.kind === 'hall' || rm.kind === 'shrine' || (rm.kind === 'room' && R() < 0.6) ? 2 : 0;
      for (let k = 0; k < nd; k++) {
        const v = wd.randomNode(R, rm); if (v < 0) continue;
        const [x, y, z] = wd.nodeXY(v), kind = ['corpse', 'corpse', 'candles', 'skulls'][Math.floor(R() * 4)];
        if (!free(x, y, 0.9)) continue;
        this.deco.push({ x, y, z, kind, dir: Math.floor(R() * 8), m: this.crew[Math.floor(R() * this.crew.length)].m, ph: R() * 6, sec: wd.sAt(x, y, null) });
        if (kind === 'corpse') this.pool(x, y, z, this.goreOf(this.crew[0].m), this.r(0.8, 1.5));
      }
    }
    if (this.vox.crates.length || this.barrels.length) wd.buildNav();
    this.lamps = L.lamps.map((l) => ({ ...l, sec: wd.sAt(l.x, l.y, null), ph: this.r(0, 6) }));
    const top = L.exit.top || L.exit.S;
    this.exitPos = { x: L.exit.cx, y: L.exit.cy, z: fz(top, L.exit.cx, L.exit.cy), sec: top };
  }
  exitOK() { return this.foes.filter((f) => f.hp > 0).length <= this.total * 0.3 || this.lvT > 150; }
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
      f.losT -= dt;
      if (f.losT <= 0) { f.losT = 0.25 + this.rng() * 0.15; f.los = !this.dead && dist < 22 && wd.los(f.x, f.y, f.z + f.ht * 0.8, p.x, p.y, pe); if (f.los && dist < 16) f.awake = true; }
      let mx = 0, my = 0;
      if (f.awake && f.actT <= 0 && !this.dead) {
        if (f.blind > 0) { mx = Math.cos(f.anim * 1.7 + f.id); my = Math.sin(f.anim * 1.3 + f.id * 2); }
        else if (f.los && (f.ranged ? dist > 7 : dist > f.rad + PR + 0.3)) { mx = ux; my = uy; }
        else if (f.los && f.ranged) { const sw = Math.sin(f.anim * 0.9 + f.id); mx = -uy * sw - (dist < 4 ? ux : 0); my = ux * sw - (dist < 4 ? uy : 0); }
        else if (!f.los) {
          const v = this.flow ? wd.nodeAt(f.x, f.y, f.fly ? f.z - f.hover : f.z, 2) : -1, nx = v >= 0 && this.flow.dist[v] > 0 ? this.flow.prev[v] : -1;
          if (nx >= 0) { const [tx, ty] = wd.nodeXY(this.flow.prev[nx] >= 0 ? this.flow.prev[nx] : nx); mx = tx - f.x; my = ty - f.y; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; }
          else if (dist < 14) { mx = ux; my = uy; }
        }
      }
      if (f.awake && !this.dead && f.blind <= 0 && f.actT <= 0 && f.cd <= 0) {
        if (f.melee && dist < f.rad + PR + 0.6 && Math.abs(p.z - f.z) < 1.6) { f.actT = 0.5; f.act = 'bite'; f.cd = f.heavy ? 1.3 : 0.85; f.fireAt = this.t + 0.22; }
        else if (f.ranged && f.los && dist < 18 && dist > 1.4) { f.actT = 0.65; f.act = 'spit'; f.cd = this.r(1.5, 2.8) * (f.heavy ? 1.2 : 1); f.fireAt = this.t + 0.3; }
      }
      if (f.fireAt && this.t >= f.fireAt) {
        f.fireAt = 0;
        if (f.act === 'bite') { if (dist < f.rad + PR + 0.9 && Math.abs(p.z - f.z) < 1.8) this.hitPlayer(f.melee * (1 + this.level * 0.1)); }
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
      if (d2 < rr * rr && d2 > 1e-6 && Math.abs(a.z - this.p.z) < 1.5) { const d = Math.sqrt(d2), k = (rr - d) / d; a.x += dx * k; a.y += dy * k; }
    }
  }
  // ------------------------------------------------------------------ weapons and projectiles
  shoot(k, x, y, z, vx, vy, vz, o) { const b = { k, x, y, z, vx, vy, vz, life: 3, r: 0.12, grav: 0, bounce: 0, t: 0, spin: this.r(-9, 9), sec: this.wd.sAt(x, y, this.p.sec), ...o }; this.shots.push(b); return b; }
  autoAim(cone = 0.13) {
    const p = this.p, ez = p.eye - 0.28;
    let best = null, bs = 1e9;
    for (const f of this.foes) {
      if (f.hp <= 0) continue;
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
    this.cool = A.rate; this.flash = 0.08; this.recoil = 1;
    for (const f of this.foes) if (!f.awake && Math.abs(f.x - p.x) < 9 && Math.abs(f.y - p.y) < 9) f.awake = true;
    const aim = this.autoAim(), ez = p.eye - 0.28, ex = p.x + Math.cos(p.a) * 0.3, ey = p.y + Math.sin(p.a) * 0.3;
    if (A.k === 'fork') return this.zap(A, aim, ex, ey, ez);
    const kind = A.shot;
    if (kind === 'rocket' || kind === 'grenade') this.shake = Math.max(this.shake || 0, 0.12);
    for (let n = 0; n < A.n; n++) {
      const a = p.a + (aim ? aim.da : 0) + this.r(-1, 1) * (A.spread || 0), sp = A.speed * this.r(0.92, 1.05), d = aim ? aim.d : 8, t = d / sp;
      let vz = aim ? aim.dz / t : 0;
      if (A.grav) vz += 0.5 * A.grav * this.G * t;
      if (kind === 'marble') vz = -1;
      const life = kind === 'skull' ? 3.5 : kind === 'marble' ? 1.3 : kind === 'grenade' ? A.fuse || 1.8 : kind === 'rocket' ? 4 : 3;
      const r = { chicken: 0.16, tooth: 0.08, bullet: 0.07, pellet: 0.06, nail: 0.07, rocket: 0.16, grenade: 0.14, plasma: 0.13 }[kind] || 0.18;
      const b = this.shoot(kind, ex, ey, ez, Math.cos(a) * sp, Math.sin(a) * sp, vz + this.r(-1, 1) * (A.spread || 0) * sp, { mine: true, dmg: A.dmg, grav: kind === 'marble' ? 10 : A.grav || 0, bounce: A.bounce || 0, life, r, hits: {}, A, pierce: A.pierce || 0 });
      if (kind === 'skull') this.skullOut = b;
    }
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
        this.impact(b, hit.x - b.vx * 0.005, hit.y - b.vy * 0.005, hit.z, hit, null); b.life = 0; continue;
      }
      b.x = nx; b.y = ny; b.z = nz; b.sec = wd.sAt(b.x, b.y, b.sec);
      const fl = wd.floorAt(b.x, b.y, b.z + 0.2, b.sec, 0.2), cl = wd.ceilAt(b.x, b.y, b.z, b.sec);
      if (b.z - b.r < fl && !b.ret) {
        if (b.k === 'marble') { b.z = fl + b.r; b.vz = 0; }
        else if (b.bounce > 0 || b.k === 'bee') { b.z = fl + b.r; b.vz = Math.abs(b.vz) * 0.55; if (b.k !== 'bee') b.bounce--; }
        else { this.impact(b, b.x, b.y, fl + 0.05, null, null); b.life = 0; continue; }
      }
      if (b.z + b.r > cl && !b.ret && !b.sec?.sky) {
        if (b.bounce > 0 || b.k === 'bee' || b.grav) { b.z = cl - b.r; b.vz = -Math.abs(b.vz) * 0.5; }
        else { this.impact(b, b.x, b.y, cl - 0.05, null, null); b.life = 0; continue; }
      }
      if (b.mine) {
        for (const f of this.foes) {
          if (f.hp <= 0 || Math.abs(f.x - b.x) > 1.6 || Math.abs(f.y - b.y) > 1.6) continue;
          if (Math.hypot(f.x - b.x, f.y - b.y) < f.rad + b.r + 0.12 && b.z > f.z - 0.15 && b.z < f.z + f.ht + 0.15 && this.hitFoe(b, f)) break;
        }
      } else if (Math.hypot(p.x - b.x, p.y - b.y) < PR + b.r && b.z > p.z - 0.1 && b.z < p.z + PH + 0.1) {
        this.hitPlayer(b.dmg); b.life = 0; this.puff(b.x, b.y, b.z, b.col, 8, 2);
      }
    }
    this.shots = this.shots.filter((b) => b.life > 0);
    for (const bo of this.bolts) bo.life -= dt;
    this.bolts = this.bolts.filter((bo) => bo.life > 0);
  }
  hitFoe(b, f) {
    const k = b.k;
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
  impact(b, x, y, z, hit, f) {
    const k = b.k, A = b.A;
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
    if (f.hp <= 0) return;
    f.hp -= dmg; f.awake = true; f.hitT = kind === 'pull' ? f.hitT : 0.14;
    const g = this.goreOf(f.m), l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, z = hz ?? f.z + f.ht * 0.6;
    if (kind !== 'pull' || this.rng() < 0.08) this.spray(f.x - ux * f.rad * 0.4, f.y - uy * f.rad * 0.4, z, ux, uy, g, Math.min(28, 5 + dmg * 0.8));
    if (kind !== 'pull' && this.rng() < 0.75) this.wallSplat(f.x, f.y, z, ux, uy, g, 0.45 + Math.min(1, dmg / 35), 3);
    if (kind !== 'pull' && kind !== 'hole') { const kb = Math.min(4, dmg / 8) * (f.heavy ? 0.3 : 1); f.kx += ux * kb; f.ky += uy * kb; }
    if (f.hp <= 0) this.killFoe(f, dmg, ux, uy, kind);
  }
  killFoe(f, dmg, ux, uy, kind) {
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
      const big = f?.heavy || f?.boss, s = { pistol: 1.2, shotgun: d < 6 ? 6.5 : 1.3, nailgun: d < 14 ? 4 : 1.5, rocket: d > 4 ? 5.5 + (big ? 2 : 0) : 0.2, grenade: d > 3 && d < 11 ? 4.6 + (big ? 1 : 0) : 0.3, plasma: d < 14 ? 4.8 : 1.6, tooth: 1, chicken: d < 5 ? 6 : 1.5, hive: d > 3 ? 4 + (big ? 2 : 0) : 0.5, flail: d < 11 ? 4.5 : 1, squid: d > 2.5 && d < 11 ? 4 : 1, fork: d < 15 ? 5 : 1, marble: d > 5 && big ? 7 : d > 5 ? 2.5 : 0, relic: d > 3.5 ? 5 + (big ? 1 : 0) : 0.3 }[A.k] + ((i * 7 + this.level * 3) % 5) * 0.2;
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  }
  pickFoe() {
    const p = this.p, ez = p.eye - 0.1;
    let best = null, bs = 1e9;
    for (const f of this.foes) {
      if (f.hp <= 0) continue;
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
  autopilot(dt) {
    if (!this.wd || this.dead > 0) return;
    const p = this.p, wd = this.wd;
    this.apT -= dt; this.foeT = (this.foeT || 0) - dt;
    if (this.foeT <= 0) { this.foeT = 0.15; this.foe = this.pickFoe(); }
    // stuck: no progress for a while → re-plan and back off
    this.stuck.t += dt;
    if (this.stuck.t > 1.2) { const moved = Math.hypot(p.x - this.stuck.x, p.y - this.stuck.y); if (moved < 0.35 && !this.foe) { this.path = []; this.apT = 0; this.unstick = 0.5; this.ustr = this.rng() < 0.5 ? -1 : 1; if (this.goal >= 0) this.ban.set(this.goal, this.t + 25); } this.stuck = { t: 0, x: p.x, y: p.y }; }
    if (this.unstick > 0) { this.unstick -= dt; this.inF = -2; this.inS = this.ustr * 2.5; return; }
    const f = this.foe;
    if (f && f.hp > 0) {
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
      this.weapon = this.bestWeapon(d, f);
      const off = this.turnTo(Math.atan2(dy, dx) + Math.sin(this.t * 2.3) * 0.03, 4, dt);
      if (off < 0.06 + 0.3 / Math.max(1.5, d)) this.fire();
      this.strT = (this.strT || 0) - dt;
      if (this.strT <= 0) { this.strDir = this.rng() < 0.5 ? -1 : 1; this.strT = this.r(0.5, 1.4); }
      this.inS = this.strDir * 2.4;
      this.inF = d > 8 ? 3 : d < 2.6 && f.melee ? -2.6 : 0;
      this.pitchT = clamp((f.z + f.ht * 0.5 - p.eye) / Math.max(2, d), -0.35, 0.35);
      this.path = []; this.apT = Math.min(this.apT, 0.2);
      return;
    }
    this.pitchT = 0;
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
      ceil: mk('ceil', mixc(Wt[1], [0.42, 0.42, 0.44], 0.5), ph(7)), plank: mk('plank', [0.6, 0.42, 0.24], ph(8)), liquid: mk('liquid', M.lc, null),
      step: mk('panel', mixc(grey, Wt[0], 0.3), ph(3), (x) => { for (let i = 0; i < 64; i += 8) { x.fillStyle = '#e8c020'; x.fillRect(i, 0, 4, 5); x.fillStyle = '#161616'; x.fillRect(i + 4, 0, 4, 5); } }),
      door: mk('door', mixc(grey, Wt[2], 0.4), ph(3)), doorK: mk('door', mixc(grey, Wt[2], 0.4), ph(3), (x) => { x.fillStyle = M.key[1]; x.fillRect(6, 28, 52, 7); x.fillRect(29, 6, 6, 52); })
    };
    const sp = splatAtlas(), st = new T.CanvasTexture(sp); st.magFilter = st.minFilter = T.NearestFilter; st.generateMipmaps = false; gl.textures.push(st); gl.kit.splat = st;
  }
  buildGpu() {
    if (!live.includes(this)) live.push(this);
    const sc = new T.Scene(), fog = this.rgbC(this.mood.fog);
    const gl = (this.gl = { scene: sc, textures: [], tex: new Map(), spr: new Map(), frame: 0 });
    sc.fog = new T.Fog(fog, 2, 27); sc.background = fog;
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
      const L = s.light * 0.8, all = [...s.poly, ...s.holes.flat()], fb = bk(s.liq ? 'liquid' : s.tex.floor), cb = bk(s.tex.ceil), lf = s.liq && glowLiq ? 1.2 : L, ts = s.liq ? 3 : TS;
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
      const b = sl.door ? (sl.geo = { p: [], u: [], c: [] }) : bk(sl.tex), L = sl.light * 0.8, P = sl.poly, b0 = sl.b0 ?? sl.b, t0 = sl.t0 ?? sl.t;
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
    const e = P.e, L = P.s.light * 0.8, pos = [], uv = [], col = [], Rr = P.rows, Cc = P.cols, u0 = (e.ax * e.ux + e.ay * e.uy) / TS;
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
  buildSky(gl) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const t = new T.CanvasTexture(cv); t.wrapS = T.RepeatWrapping; t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.repeat.set(2, 1); gl.textures.push(t);
    const img = this.skin.bgSet?.[this.level % (this.skin.bgSet.length || 1)] || this.skin.bg, fog = this.mood.fog, ph = [this.r(0, 6), this.r(0, 6), this.r(0, 6)];
    const css = (v, k = 1) => `rgb(${v.map((q) => Math.round(clamp(q * k, 0, 1) * 255)).join(',')})`;
    const paint = () => {
      const x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 72), sky = this.mood.sky || [this.pal.bg2, this.col(this.level + 3)];
      g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
      if (ready(img)) { x.globalAlpha = 0.35; x.drawImage(img, 0, 0, 128, 72); x.save(); x.translate(256, 0); x.scale(-1, 1); x.drawImage(img, 0, 0, 128, 72); x.restore(); x.globalAlpha = 1; }
      for (let layer = 0; layer < 2; layer++) {
        x.fillStyle = css(mixc(fog, rgb01(this.col(this.level + 2)), 0.3), layer ? 0.55 : 0.9);
        x.beginPath(); x.moveTo(0, 128);
        for (let i = 0; i <= 256; i += 2) { const a = (i / 256) * TAU; x.lineTo(i, 64 - (layer ? 10 : 18) - Math.sin(a * 3 + ph[0]) * 6 - Math.sin(a * 7 + ph[1]) * 4 * (layer + 1) - Math.abs(Math.sin(a * 13 + ph[2])) * 5); }
        x.lineTo(256, 128); x.fill();
      }
      t.needsUpdate = true;
    };
    paint();
    if (img && !ready(img)) img.addEventListener?.('load', paint, { once: true });
    const m = new T.Mesh(new T.CylinderGeometry(90, 90, 140, 32, 1, true), new T.MeshBasicMaterial({ map: t, side: T.BackSide, fog: false, depthWrite: false }));
    m.renderOrder = -1; gl.scene.add(m); gl.sky = m;
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
      s = new T.Sprite(new T.SpriteMaterial({ map: t, alphaTest: o.add ? 0 : 0.5, transparent: !!o.add, blending: o.add ? T.AdditiveBlending : T.NormalBlending, depthWrite: !o.add, fog: true }));
      s.center.set(0.5, o.mid ? 0.5 : 0); gl.scene.add(s); gl.spr.set(key, s);
    }
    if (s.material.map !== t) s.material.map = t;
    s.position.set(x, z, y); s.scale.set(w * (o.flip ? -1 : 1), h, 1); s.material.rotation = o.rot || 0;
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
    for (const d of this.drips) { d.y += d.v * dt; d.life -= dt; }
    this.drips = this.drips.filter((d) => d.life > 0);
    for (const d of this.decals) if (d.to && d.s < d.to) { d.s = Math.min(d.to, d.s + dt * 0.45); this.decalDirty = true; }
  }
  frameOf(f) {
    const m = f.m;
    if (m.view) {
      // the view of it from where you stand (Doom's eight rotations)
      const d = viewDir(f.ang, Math.atan2(this.p.y - f.y, this.p.x - f.x));
      if (f.hp <= 0) return m.view('dead', 0, d);
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
    const p = this.p, t = this.t, light = (s) => (s ? s.light : 0.8);
    // creature sheets are built lazily: touch one cycle per frame so the first fight does not hitch
    if (!this.warm) {
      this.warm = true;
      const ms = [...this.crew.map((c) => c.m), ...this.foes.filter((f) => f.boss).map((f) => f.m)];
      this.warmList = ms.flatMap((m) => [() => m.anatomy, ...[0, 1, 2, 3, 4].flatMap((d) => [['idle', 0], ['idle', 1], ['walk', 0], ['walk', 1], ['walk', 2], ['walk', 3], ['attack', 0], ['attack', 1], ['attack', 2], ['hurt', 0], ['dead', 0]].map(([a, k]) => () => m.view(a, k, d)))]);
    }
    for (let k = 0; k < 2 && this.warmList.length; k++) this.warmList.shift()();
    if (t > 1 && !gl.refreshed && t < 8 && Math.floor(t) % 2 === 0) { for (const [cv, tx] of gl.tex) if (cv instanceof HTMLCanvasElement) tx.needsUpdate = true; gl.refreshed = Math.floor(t) >= 6; }
    for (const { sl, m } of gl.doors) m.position.y = sl.b - sl.b0;
    if (this.vox) { let n = 4; for (const O of [...this.vox.panels, ...this.vox.crates]) if (O.dirty && n-- > 0) this.voxMesh(gl, O); }
    if (gl.pools?.lamps.length) {
      const L = this.mood.lamp || [1, 0.7, 0.4], c = gl.pools.col;
      gl.pools.lamps.forEach((l, k) => {
        const ph = this.lamps[k]?.ph || 0, f = 0.78 + 0.14 * Math.sin(t * 11 + ph) + 0.08 * Math.sin(t * 23.7 + ph * 2);
        for (let j = 0; j < 2; j++) { const a = f * (j ? 0.5 : 0.34); for (let n = 0; n < 4; n++) c.set([L[0] * a, L[1] * a, L[2] * a], ((k * 2 + j) * 4 + n) * 3); }
      });
      gl.pools.g.attributes.color.needsUpdate = true;
    }
    gl.kit.liquid.offset.set(t * 0.04, Math.sin(t * 0.7) * 0.06);
    this.pitch = (this.pitch || 0) + ((this.pitchT || 0) - (this.pitch || 0)) * Math.min(1, dt * 4);
    const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 3), bob = Math.sin(p.bob * 2) * 0.035 * sp, eye = p.eye + bob, cam = gl.cam;
    const sk = this.shake || 0, jx = (Math.random() - 0.5) * sk * 0.22, jy = (Math.random() - 0.5) * sk * 0.18;
    cam.position.set(p.x + jx, eye + jy, p.y + jx * 0.5); cam.lookAt(p.x + Math.cos(p.a) + jx, eye + this.pitch + jy * 1.6, p.y + Math.sin(p.a));
    gl.sky.position.set(p.x, eye, p.y);
    for (const f of this.foes) {
      if (f.gone) continue;
      const im = this.frameOf(f), L = light(f.sec), dead = f.hp <= 0;
      const col = f.hitT > 0 && !dead ? [1.6, 0.45, 0.4] : f.zapT > 0 ? [0.8, 1.1, 1.8] : f.burnT > this.t && !dead ? [1.5, 0.75, 0.4] : f.blind > 0 ? [L * 0.5, L * 0.5, L * 0.75] : L * (f.boss ? 1.1 : 1);
      this.put(gl, f, im, f.x, f.y, f.z - (dead ? 0.05 : 0) - f.size * 0.04, f.size, f.size, col, { flip: !f.m.view && f.face < 0 });
    }
    for (const it of this.items) {
      if (it.got) continue;
      const bob = Math.sin(t * 3 + it.bob) * 0.08 + 0.15, L = Math.max(0.75, light(it.sec)), k = it.kind;
      if (k === 'health' || k === 'armor') this.put(gl, it, this.art(k), it.x, it.y, it.z + bob, 0.55, k === 'armor' ? 0.64 : 0.43, L);
      else if (k === 'key') this.put(gl, it, this.art('key', this.mood.key[1]), it.x, it.y, it.z + bob + 0.2, 0.5, 0.33, 1.2);
      else {
        const Aw = this.arms[it.w], pi = Aw.gun ? null : { tooth: 'tooth', chicken: 'chicken', hive: 'hive', flail: 'skull', squid: 'squid', fork: 'fork', marble: 'marble', relic: 'relic' }[Aw.k];
        const png = k === 'ammo' ? this.ammoImg[it.w] : null, im = png && ready(png) ? png : pi ? this.art(pi) : this.art('gunicon', Aw.k), iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, h = k === 'gun' ? (Aw.gun ? 0.4 : 0.75) : 0.5;
        this.put(gl, it, im, it.x, it.y, it.z + bob, (h * iw) / ih, h, k === 'gun' ? [L * 1.2, L * 1.1, L * 0.8] : L);
      }
    }
    for (const d of this.deco) {
      if (d.kind === 'corpse') this.put(gl, d, d.m.view('dead', 0, d.dir), d.x, d.y, d.z - 0.06, 1.8, 1.8, light(d.sec) * 0.85);
      else if (d.kind === 'candles') this.put(gl, d, this.art('candles', Math.floor(t * 6 + d.ph) % 2), d.x, d.y, d.z, 0.5, 0.58, 1.3);
      else if (d.kind === 'skulls') this.put(gl, d, this.art('skulls'), d.x, d.y, d.z, 0.72, 0.5, light(d.sec));
    }
    for (const bar of this.barrels || []) if (!bar.gone) this.put(gl, bar, this.art('barrel', t - (bar.hitT ?? -9) < 0.12 ? 1 : 0), bar.x, bar.y, bar.z, 0.74, 0.95, light(bar.sec) * 1.05);
    for (const l of this.lamps) this.put(gl, l, this.art('torch', Math.floor(t * 8 + l.ph) % 2), l.x, l.y, l.z, 0.35, 0.7, 1.35);
    const E = this.exitPos;
    if (E) this.put(gl, E, this.art('exit'), E.x, E.y, E.z + 0.05, 1.3 + Math.sin(t * 4) * 0.08, 2.2, this.exitOK() ? [0.5, 1.4, 1] : [1.4, 0.35, 0.3], { add: true });
    for (const b of this.shots) {
      const k = b.k, spin = t * b.spin;
      if (k === 'hole') this.put(gl, b, this.art('hole'), b.x, b.y, b.z, 1.7 + Math.sin(t * 9) * 0.15, 1.7, 1, { add: true, mid: true, rot: t * 6 });
      else if (k === 'spit') this.put(gl, b, this.art('ball', `rgb(${b.col.map((v) => Math.round(v * 255)).join(',')})`), b.x, b.y, b.z, b.r * 2.4, b.r * 2.4, 1.3, { mid: true });
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
    for (const q of this.gore) {
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
      const pts = [a];
      for (let k = 1; k < 7; k++) { const t = k / 7, j = (Math.random() - 0.5) * 18 * Math.sin(t * Math.PI); pts.push([a[0] + (b[0] - a[0]) * t + j, a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 14 * Math.sin(t * Math.PI)]); }
      pts.push(b);
      for (const [w, col] of [[6, 'rgba(90,170,255,.35)'], [2, '#e8f6ff']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    }
    const s = this.skullOut;
    if (s && s.life > 0) { const q = this.proj(gl, s.x, s.y, s.z); if (q) { const ax = W / 2 + 4, ay = VH - 70; c.fillStyle = '#8a8a90'; for (let k = 1; k < 14; k++) { const t = k / 14; c.fillRect(ax + (q[0] - ax) * t - 1.5, ay + (q[1] - ay) * t - 1.5 + Math.sin(t * Math.PI) * 10, 3, 3); } } }
    c.restore();
  }
  // a pixel-art weapon in a 180×120 buffer, doubled
  drawGun(c) {
    const vm = (this.vm ||= pc(180, 120, () => {})), x = vm.getContext('2d'), A = this.arms[this.weapon], t = this.t, p = this.p;
    x.clearRect(0, 0, 180, 120);
    const mv = Math.min(1, Math.hypot(p.vx, p.vy) / 3), bx = Math.sin(p.bob) * 4 * mv, by = Math.abs(Math.cos(p.bob)) * 3 * mv + this.recoil * 8 + (this.dead > 0 ? 70 : 0);
    const R = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(Math.round(a + bx), Math.round(b + by), w, h); }, dark = '#1d1814', body = this.col(A.hue);
    let mz = [90, 40];
    if (A.gun) mz = this.gritGun(R, A, t);
    else switch (A.k) {
      case 'tooth':
        R(dark, 80, 92, 20, 28); R('#e9dfc8', 82, 90, 16, 30); R('#d8ccb0', 76, 62, 28, 32); R(body, 76, 80, 28, 4); R('#b03a3a', 76, 62, 28, 4);
        for (let k = 0; k < 5; k++) R('#fbf6ea', 77 + k * 5, 55, 4, 8);
        R(dark, 84, 58, 12, 5); R('rgba(0,0,0,.25)', 98, 64, 6, 30); mz = [90, 52]; break;
      case 'chicken':
        R('#6a3c1c', 62, 98, 56, 22); R('#8a5428', 64, 100, 52, 8);
        for (const ox of [66, 92]) { const w = Math.sin(t * 6 + ox) * 2; R('#2c2c32', ox, 44, 22, 58); R('#55555e', ox + 3, 44, 4, 58); R(body, ox, 84, 22, 5); R('#111', ox + 5, 40, 12, 6); R('#f2d23c', ox + 5 + w, 28, 12, 13); R('#e8402a', ox + 8 + w, 24, 5, 4); R('#f08a1c', ox + 17 + w, 33, 5, 3); R('#111', ox + 13 + w, 31, 2, 2); }
        mz = [90, 30]; break;
      case 'hive':
        R('#4a3a28', 74, 70, 32, 50); R('#6a5438', 78, 70, 6, 50); R(body, 74, 100, 32, 5);
        for (let y = 0; y < 34; y++) { const w = Math.round(Math.sin(((y + 1) / 35) * Math.PI) * 22); R(y % 5 < 1 ? '#7a4a14' : '#d9a23a', 90 - w, 38 + y, w * 2, 1); }
        R('#2a1606', 86, 58, 8, 6);
        for (let k = 0; k < 4; k++) { const a = t * 3 + k * 1.6, qx = 88 + Math.cos(a) * 30, qy = 50 + Math.sin(a * 1.3) * 16; R('#f2c81c', qx, qy, 5, 3); R('#111', qx + 2, qy, 1, 3); R('#dde8ff', qx + 1, qy - 2, 3, 2); }
        break;
      case 'flail':
        R('#5a3a1c', 84, 84, 12, 36); R('#7a5228', 86, 84, 4, 36); R('#999', 82, 80, 16, 6); R(body, 84, 100, 12, 4);
        if (!this.skullOut) {
          const sx = 90 + Math.sin(t * 3) * 10, sy = 42 + Math.cos(t * 3) * 4;
          for (let k = 0; k < 8; k++) R('#8a8a90', 89 + ((sx - 90) * k) / 8, 80 + ((sy - 80) * k) / 8, 3, 3);
          R('#efe8d6', sx - 10, sy - 12, 20, 16); R('#efe8d6', sx - 7, sy + 4, 14, 6); R('#c8bea4', sx + 5, sy - 10, 4, 14); R('#1a0d0a', sx - 7, sy - 6, 5, 5); R('#1a0d0a', sx + 2, sy - 6, 5, 5); R('#ff3a1a', sx - 5, sy - 4, 2, 2); R('#ff3a1a', sx + 4, sy - 4, 2, 2); R('#1a0d0a', sx - 4, sy + 5, 2, 4); R('#1a0d0a', sx + 1, sy + 5, 2, 4);
        }
        mz = [90, 70]; break;
      case 'squid':
        for (let k = 0; k < 5; k++) for (let s = 0; s < 6; s++) R(k % 2 ? '#c85a8a' : '#a8406e', 66 + k * 11 + Math.sin(t * 4 + k + s * 0.8) * 3, 44 - s * 4, 4, 5);
        R('#8a2a5a', 62, 46, 56, 12); R('#c85a8a', 66, 58, 48, 62); R('#e88ab4', 72, 58, 8, 62); R('#a8406e', 66, 76, 48, 4); R(body, 66, 96, 48, 4);
        R('#fff', 72, 64, 10, 10); R('#fff', 98, 64, 10, 10); R('#111', 75 + Math.sin(t) * 2, 68, 4, 4); R('#111', 101 + Math.sin(t) * 2, 68, 4, 4);
        mz = [90, 44]; break;
      case 'fork': {
        const j = this.cool > 0 ? (Math.floor(t * 60) % 2) * 2 - 1 : 0;
        R('#6a7a88', 86, 80, 8, 40); R('#8fa6b8', 87, 80, 3, 40); R(body, 85, 100, 10, 4);
        R('#cfe8ff', 74 + j, 22, 7, 54); R('#cfe8ff', 99 - j, 22, 7, 54); R('#cfe8ff', 74, 72, 32, 8); R('#fff', 75 + j, 22, 2, 30); R('#fff', 100 - j, 22, 2, 30);
        if (this.cool > 0) { x.strokeStyle = '#bfe8ff'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k < 6; k++) x.lineTo(82 + bx + (k % 2) * 16, 26 + by + k * 8); x.stroke(); }
        mz = [90, 22]; break;
      }
      case 'marble': {
        R('#5a3a1c', 85, 86, 10, 34);
        for (let k = 0; k < 18; k++) { R('#6e4a26', 85 - k * 1.2, 86 - k * 2, 8, 4); R('#6e4a26', 87 + k * 1.2, 86 - k * 2, 8, 4); }
        const pull = this.cool > 0 ? 0 : 6;
        x.strokeStyle = '#3a2418'; x.lineWidth = 2; x.beginPath(); x.moveTo(66 + bx, 52 + by); x.lineTo(90 + bx, 64 + pull + by); x.lineTo(118 + bx, 52 + by); x.stroke();
        if (this.ammo[this.weapon] > 0 && this.cool < 0.3) { x.fillStyle = '#160c26'; x.beginPath(); x.arc(90 + bx, 62 + pull + by, 6, 0, TAU); x.fill(); x.strokeStyle = '#9a4cff'; x.beginPath(); x.arc(90 + bx, 62 + pull + by, 3.5, t * 4, t * 4 + 3); x.stroke(); R('#e8dcff', 87, 58 + pull, 2, 2); }
        mz = [90, 56]; break;
      }
      default:
        R('#7a5a20', 66, 44, 48, 76); R('#b8893a', 70, 48, 40, 72); R('#d8a95a', 74, 48, 6, 72); R('#7a5a20', 66, 70, 48, 5); R(body, 66, 96, 48, 5); R('#2a1e10', 72, 40, 36, 8);
        if (this.cool < 0.3 && ready(this.relicImg)) { const im = this.relicImg, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, s = 28 / Math.max(iw, ih); x.drawImage(im, 90 + bx - (iw * s) / 2, 40 + by - ih * s, iw * s, ih * s); }
    }
    if (this.flash > 0 && A.k !== 'flail') { x.fillStyle = A.k === 'fork' || A.k === 'plasma' ? '#9fd8ff' : '#ffe8a0'; x.beginPath(); x.arc(mz[0] + bx, mz[1] + by, 9 + Math.random() * 4, 0, TAU); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(mz[0] + bx, mz[1] + by, 4, 0, TAU); x.fill(); }
    c.imageSmoothingEnabled = false; c.drawImage(vm, 0, VH - 240, 360, 240); c.imageSmoothingEnabled = true;
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W / 2 - 6, VH / 2); c.lineTo(W / 2 + 6, VH / 2); c.moveTo(W / 2, VH / 2 - 6); c.lineTo(W / 2, VH / 2 + 6); c.stroke();
  }
  // the gritty guns, built from parts in the weapon's own metal and wood, with what its affixes add
  gritGun(R, A, t) {
    const [m, hi, lo] = A.metal, wd = A.wood, firing = this.cool > A.rate * 0.6, k = A.k, af = A.affixes || [];
    let mz = [90, 40];
    if (k === 'pistol') { R(lo, 82, 92, 16, 28); R(wd, 84, 94, 12, 26); R(m, 78, 60, 24, 34); R(hi, 80, 60, 5, 34); R(lo, 98, 60, 4, 34); R(m, 82, 50, 16, 12); R(lo, 86, 46, 8, 6); R('#111', 88, 46, 4, 3); mz = [90, 46]; }
    else if (k === 'shotgun') { for (const ox of [70, 92]) { R(lo, ox, 26, 18, 76); R(m, ox + 2, 26, 14, 76); R(hi, ox + 3, 26, 4, 76); R('#0c0a08', ox + 4, 22, 10, 6); } R(wd, 66, 70, 48, 18); R('#2a1a10', 66, 84, 48, 4); R(wd, 72, 98, 36, 22); mz = [90, 26]; }
    else if (k === 'nailgun') { const sp = firing ? Math.floor(t * 40) % 4 : 0; R(lo, 64, 64, 52, 56); R(m, 66, 64, 48, 56); R(hi, 68, 66, 6, 52); for (let q = 0; q < 4; q++) { const ox = 70 + ((q + sp) % 4) * 10; R(lo, ox, 24, 8, 42); R(q % 2 ? m : hi, ox + 1, 24, 5, 42); R('#0c0a08', ox + 2, 22, 4, 4); } R(lo, 66, 60, 48, 6); mz = [90, 26]; }
    else if (k === 'rocket') { R(lo, 62, 28, 56, 92); R(m, 64, 28, 52, 92); R(hi, 68, 28, 8, 92); R('#0a0808', 70, 26, 40, 10); R('#c83a20', 64, 70, 52, 5); R(lo, 112, 50, 10, 14); R(hi, 114, 52, 4, 4); mz = [90, 30]; }
    else if (k === 'grenade') { R(lo, 64, 62, 52, 44); R(m, 66, 62, 48, 44); for (let q = 0; q < 3; q++) R('#14110e', 72 + q * 14, 72, 8, 8); R(hi, 68, 64, 4, 40); R(lo, 76, 34, 28, 30); R(m, 78, 34, 24, 30); R('#0c0a08', 80, 30, 20, 6); R(wd, 72, 104, 36, 16); mz = [90, 32]; }
    else {
      const g = 0.6 + 0.4 * Math.sin(t * 9);
      R(lo, 66, 56, 48, 64); R(m, 68, 56, 44, 64); R(hi, 70, 58, 5, 60);
      for (let q = 0; q < 3; q++) R(`rgba(120,220,255,${(0.5 + g * 0.4).toFixed(2)})`, 70, 66 + q * 14, 40, 4);
      R(lo, 78, 32, 24, 26); R('#9fe8ff', 82, 30, 16, 6); R('#ffffff', 86, 31, 8, 3); mz = [90, 32];
    }
    // affixes on the metal: a hazard band, a glow along it, a spinning bit at the muzzle, a seeker's lamp
    if (af.includes('explosive')) for (let q = 0; q < 5; q++) R(q % 2 ? '#e8c020' : '#161616', 70 + q * 8, 96, 8, 4);
    if (af.includes('burn')) R(`rgba(255,${110 + Math.round(Math.sin(t * 13) * 40)},40,.85)`, 72, 100, 36, 3);
    if (af.includes('drill')) { const s2 = Math.floor(t * 30) % 2; for (let q = 0; q < 4; q++) R('#c8ccd0', mz[0] - 4 + ((q + s2) % 2) * 4, mz[1] - 6 - q * 3, 4, 3); }
    if (af.includes('seek')) R(Math.floor(t * 4) % 2 ? '#7aff5a' : '#2a6a20', 108, 62, 4, 4);
    if (af.includes('leech')) R('#8a1020', 74, 92, 32, 3);
    return mz;
  }
  drawOverlay(c) {
    if (this.hurt > 0) { c.fillStyle = `rgba(190,10,10,${Math.min(0.4, this.hurt * 1.4)})`; c.fillRect(0, 0, W, VH); }
    if (this.boomFlash > 0) { c.fillStyle = `rgba(255,150,60,${Math.min(0.35, this.boomFlash * 0.6)})`; c.fillRect(0, 0, W, VH); }
    for (const d of this.drips) { c.globalAlpha = Math.min(1, d.life) * 0.8; c.fillStyle = '#7a0608'; c.fillRect(d.x, d.y - d.l, d.w, d.l); c.beginPath(); c.arc(d.x + d.w / 2, d.y, d.w * 0.7, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    if (this.dead > 0) { c.fillStyle = `rgba(120,0,0,${clamp(0.75 - this.dead * 0.3, 0, 0.75)})`; c.fillRect(0, 0, W, VH); }
    if (this.pickT && this.t - this.pickT < 0.15) { c.fillStyle = 'rgba(255,230,140,.2)'; c.fillRect(0, 0, W, VH); }
    this.msgs.forEach((m, i) => { c.globalAlpha = Math.min(1, m.t * 2); this.text(c, m.text, W / 2 + 1, 63 + i * 16, 12, '#000'); this.text(c, m.text, W / 2, 62 + i * 16, 12, '#ffe2a8'); });
    c.globalAlpha = 1;
    const wd = this.wd, s = 74 / Math.max(wd.mw, wd.mh), ox = W - 80, oy = 34, p = this.p;
    c.save(); c.globalAlpha = 0.75; c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(ox - 3, oy - 3, wd.mw * s + 6, wd.mh * s + 6);
    c.lineWidth = 1; c.strokeStyle = '#d8c8a0'; c.beginPath();
    for (const sec of wd.secs) if (sec.seen) for (const e of sec.edges) if (!e.o || Math.abs(fz(sec, e.ax, e.ay) - fz(e.o, e.ax, e.ay)) > 0.7) { c.moveTo(ox + e.ax * s, oy + e.ay * s); c.lineTo(ox + e.bx * s, oy + e.by * s); }
    c.stroke();
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
  liquid: (x, y) => 0.7 + 0.3 * Math.sin(((x + 4 * Math.sin((y * TAU) / 32)) * TAU) / 16) * Math.sin((y * TAU) / 32)
};
function photoPx(img) {
  if (!img || !ready(img)) return null;
  try { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 64, 64); return x.getImageData(0, 0, 64, 64).data; } catch { return null; }
}
