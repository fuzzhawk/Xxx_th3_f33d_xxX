// Sky Fox: an on-rails shooter in flat-shaded polygons after SNES Star Fox, drawn with three.js (loaded on
// demand) into a 192×224 buffer. Each post flies one of seven environments (city, desert, forest, ocean,
// asteroid belt, volcano, glacier) with its own palette, scrolling ground grid and polygon props: arches,
// gates, towers, floating shapes and rings. Fighters, turrets, walkers, boats and mines attack on the way,
// power-ups give twin lasers, bombs and shield, and a boss waits at the end of every stage; the next stage
// moves on to the next environment. Drag to steer, hold to fire, double-tap to barrel roll.
import { Game, W, H, rgbOf } from './engine.js';
import { mulberry32 } from '../util.js';

let T = null, loading = null;
const loadThree = () => (loading ||= import('../vendor/three.module.min.js').then((m) => { T = m; return m; }));

// one renderer for every Sky Fox card at an SNES-like 192×224; scenes are built per game and dropped when old
const RW = 192, RH = 224;
let REN = null;
const live = [];
function renderer() {
  if (REN && !REN.lost) return REN;
  const cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
  const r = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  r.setPixelRatio(1); r.setSize(RW, RH, false); r.autoClear = false;
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r.lost = true; for (const g of [...live]) g.dropGpu(true); });
  REN = r; return r;
}

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const angTo = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const wrap = (v, lo, span) => lo + ((((v - lo) % span) + span) % span);
const hash = (i, j) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// world units; the ship flies +z inside a corridor x ±XM, y Y0..Y1. CH: generation chunk, LEN: stage length
const SPEED = 40, XM = 21, Y0 = 2.6, Y1 = 27, CH = 80, VIEW = 330, LEN = 2000;

// colours: CSS → linear rgb (vertex colours live in linear space)
const s2l = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const LIN = new Map();
const lin = (css) => {
  let c = LIN.get(css);
  if (!c) { const v = css[0] === '#' && css.length === 7 ? [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16)) : rgbOf(css); c = v.map((x) => s2l(x / 255)); LIN.set(css, c); }
  return c;
};
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const WHITE = [1, 1, 1];

const ENVS = {
  city: { label: 'CITY', names: ['Vesta City', 'Corvane Harbor', 'Old Capital', 'Halcyon Metro'], sky: ['#1f4f96', '#5b8fd0', '#b4d2ee'], fog: '#aac6e2', fogD: [70, 320],
    sun: ['#fff2dc', 2.5], hemi: ['#d8e6ff', '#4a4a56', 1.5], ground: ['#4f5662', '#58606d', '#8b9099', '#979ca5', '#5e8a4a'], mark: '#e8e0b0',
    bld: ['#d8d2c4', '#a9b3c2', '#7d8aa0', '#c9875f', '#e6e6ea', '#b8a890'], win: '#34405a', arch: ['#9aa4b4', '#e0503a'], wall: '#8c96a8', float: ['#e0e4ec', '#d04a3a'], rock: '#7d8796',
    foe: ['#d0402c', '#dcdce4', '#ffcc33'], boss: 'carrier', gf: 'walker', hz: ['skyline', '#5a7698'], clouds: 1 },
  desert: { label: 'DESERT', names: ['Sirocco Basin', 'Mirage Flats', 'Dune Sea Kaar', 'Ochre Wastes'], sky: ['#3f78c4', '#8ab6e0', '#f0dcae'], fog: '#ecd4a2', fogD: [60, 300],
    sun: ['#fff0cc', 2.7], hemi: ['#fff0d8', '#8a5a30', 1.3], ground: ['#d9ac68', '#cf9f5c', '#c08c4c', '#e6c080'], stone: '#e2c07c', rock: '#b0663e', rock2: '#cf8a52', cactus: '#4f8a3a',
    arch: ['#c8955a', '#e2c07c'], wall: '#c89a62', float: ['#e8c47a', '#7a4ab0'], foe: ['#6a4ab0', '#cfcfda', '#40e0d0'], boss: 'walker', gf: 'walker', hz: ['mesas', '#b07050'], clouds: 0.4, weather: 'sand' },
  forest: { label: 'FOREST', names: ['Verdant Reach', 'Mossgrove', 'Fernwood Vale', 'Greenhollow'], sky: ['#3a6fb4', '#80b2dc', '#d2e8dc'], fog: '#bcd8c6', fogD: [60, 290],
    sun: ['#fff6d8', 2.4], hemi: ['#dcf0ff', '#3a4a20', 1.4], ground: ['#4c8c3a', '#43803a', '#5f9c40', '#7a6a3a', '#386c2e'], leaf: ['#2e6a2c', '#3c8434', '#58a03c'], trunk: '#6a4a2a', rock: '#8a8a7a',
    arch: ['#7a5a3a', '#6a4a2a'], wall: '#6a7a5a', float: ['#c8e070', '#d05a24'], foe: ['#d05a24', '#e4e0d4', '#ffe040'], boss: 'walker', gf: 'walker', hz: ['hills', '#4f7a5a'], clouds: 1 },
  ocean: { label: 'OCEAN', names: ['Coral Expanse', 'Zephyr Sea', 'Tidewater', 'Azure Shoals'], sky: ['#1f5fb8', '#5aa0e0', '#c0e4f6'], fog: '#b6dcf2', fogD: [70, 330],
    sun: ['#fffbe8', 2.5], hemi: ['#e0f4ff', '#20406a', 1.4], ground: ['#2a62ae', '#2f6cb8', '#3a7cc6'], foam: '#d8ecff', sand: '#e8d29a', rock: '#6e6a74', leaf: ['#2f8a40', '#45a24a'], trunk: '#8a6a3a',
    rig: ['#c8c8cc', '#d4543a', '#5a5a66'], arch: ['#6e6a74', '#8a8690'], wall: '#7a7680', float: ['#f0f0f4', '#e07a1a'], foe: ['#e07a1a', '#44444f', '#ffe040'], boss: 'carrier', gf: 'boat', hz: null, clouds: 1 },
  space: { label: 'ASTEROID BELT', names: ['Sector Kappa', 'The Shard Belt', 'Orion Debris Field', 'Sector Null'], sky: ['#02030a', '#0a0e26', '#191a3c'], fog: '#0c0e20', fogD: [150, 430],
    sun: ['#ffffff', 2.6], hemi: ['#8090c0', '#201830', 1.2], rock: ['#7a6a5a', '#5e554c', '#9a8a70'], metal: ['#a8b0c0', '#5a6478'], arch: ['#a8b0c0', '#40e0ff'], wall: '#7a8296', float: ['#b8c0d8', '#c03ab0'],
    foe: ['#c03ab0', '#d8d8e8', '#40ffb0'], boss: 'core', gf: 'mine', space: true, weather: 'dust' },
  volcano: { label: 'VOLCANO', names: ['Cinder Gorge', 'Mount Pyre', 'Ashfall Rift', 'Magma Reach'], sky: ['#1a0606', '#5a1a10', '#c8541c'], fog: '#7a2e16', fogD: [50, 270],
    sun: ['#ffc890', 2.2], hemi: ['#ff9a60', '#200a06', 1.3], ground: ['#3a2c28', '#32261f', '#46342c'], rock: '#4a3228', rock2: '#5e4032', lava: '#ff7a10', lava2: '#ffd040',
    arch: ['#3e2c26', '#ff7a10'], wall: '#4a3228', float: ['#5e4032', '#ff7a10'], foe: ['#30b0a8', '#c8ccd4', '#a0ffe8'], boss: 'core', gf: 'walker', hz: ['volcanoes', '#3a140c'], weather: 'embers' },
  ice: { label: 'GLACIER', names: ['Frostmere', 'Glacier Rim', 'Boreal Shelf', 'White Hollow'], sky: ['#3a6ab0', '#88b6e4', '#e6f2fb'], fog: '#dce8f4', fogD: [60, 300],
    sun: ['#ffffff', 2.3], hemi: ['#e8f4ff', '#6a7a90', 1.5], ground: ['#eef4fa', '#dfeaf6', '#c6dcef'], crack: '#a8c8e8', ice: ['#a8dcf4', '#7cc0ea', '#d4f0ff'], rock: '#6a7a8c', leaf: ['#2a5a46', '#eef6ff'],
    arch: ['#9cd4f0', '#3aa0e0'], wall: '#b4dcf2', float: ['#d4f0ff', '#7cc0ea'], foe: ['#c8283a', '#3a3a48', '#ffb020'], boss: 'carrier', gf: 'walker', hz: ['peaks', '#8aa4c4'], clouds: 0.6, weather: 'snow' }
};
const ENV_KEYS = Object.keys(ENVS);
const PATS = {
  city: ['towers', 'towers', 'bridge', 'arch', 'gate', 'floaters', 'bar'],
  desert: ['pyramid', 'obelisks', 'arch', 'mesa', 'floaters', 'gate', 'pyramid'],
  forest: ['bigtrees', 'bigtrees', 'logarch', 'hill', 'floaters', 'arch'],
  ocean: ['stacks', 'stacks', 'rig', 'arch', 'floaters', 'bridge'],
  space: ['rocks', 'rocks', 'girder', 'gate', 'bar', 'floaters'],
  volcano: ['spires', 'spires', 'geyser', 'arch', 'bar', 'floaters'],
  ice: ['spikes', 'spikes', 'crystals', 'arch', 'gate', 'floaters']
};
const FOES = {
  dart: { hp: 1, r: 1.5, score: 100, size: 1 }, bat: { hp: 1, r: 1.7, score: 100, size: 1 }, saucer: { hp: 2, r: 1.9, score: 150, size: 1.2 },
  turret: { hp: 3, r: 2.0, score: 150, size: 1.2, ground: true }, walker: { hp: 5, r: 2.4, score: 200, size: 1.5, ground: true },
  boat: { hp: 4, r: 2.3, score: 200, size: 1.4, ground: true }, mine: { hp: 1, r: 1.7, score: 80, size: 0.9 }
};
const ITEMS = { twin: ['#46ff6a', 'TWIN LASER'], bomb: ['#ff5a30', 'BOMB'], shield: ['#5ac8ff', 'SHIELD'] };
const BOSSES = { carrier: 'ATTACK CARRIER', walker: 'TITAN WALKER', core: 'PRISM CORE' };

// ------------------------------------------------------------------ polygon kit (game space: x right, y up, z ahead)
// unit solids, centred: [vertices, faces]; faces are vertex loops, turned outward when added
const BOXS = [[[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]], [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]]];
const OCTS = [[[0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]], [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 3], [1, 3, 4], [1, 4, 2]]];
const TETS = [[[0.5, 0.5, 0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, -0.5], [0.5, -0.5, -0.5]], [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]]];
const PHI = (1 + Math.sqrt(5)) / 2, IK = 0.5 / Math.hypot(1, PHI);
const ICOS = [[[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map((v) => v.map((q) => q * IK)),
  [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]];
const WEDS = [[[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0, 0.5, -0.5], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0, 0.5, 0.5]], [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]];
const HULLF = [[0, 1, 4], [0, 4, 2], [0, 2, 3], [0, 3, 1], [5, 4, 1], [5, 2, 4], [5, 3, 2], [5, 1, 3]]; // nose, top, bottom, left, right, tail
const PRF = WEDS[1];
const CYLS = new Map();
// n-sided prism (k = 1), frustum or cone (k = 0); diameter 1 across the corners, height 1
function cylS(n, k = 1) {
  const key = n * 1000 + Math.round(k * 100);
  let s = CYLS.get(key);
  if (s) return s;
  const v = [], f = [], bot = [], top = [], a0 = Math.PI / n;
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; v.push([Math.cos(a) / 2, -0.5, Math.sin(a) / 2]); bot.push(i); }
  if (k > 0) for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; v.push([(Math.cos(a) * k) / 2, 0.5, (Math.sin(a) * k) / 2]); top.push(n + i); }
  else v.push([0, 0.5, 0]);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; f.push(k > 0 ? [i, j, n + j, n + i] : [i, j, n]); }
  f.push(bot); if (k > 0) f.push(top);
  s = [v, f]; CYLS.set(key, s); return s;
}
// scale, then roll (z), pitch (x) and yaw (y) like three's 'YXZ' order, then move
function xf(x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
  const cy = Math.cos(ry), sny = Math.sin(ry), cx = Math.cos(rx), snx = Math.sin(rx), cz = Math.cos(rz), snz = Math.sin(rz);
  return (q) => {
    let a = q[0] * sx, b = q[1] * sy, c = q[2] * sz, t;
    t = a * cz - b * snz; b = a * snz + b * cz; a = t;
    t = b * cx - c * snx; c = b * snx + c * cx; b = t;
    t = a * cy + c * sny; c = c * cy - a * sny; a = t;
    return [a + x, b + y, c + z];
  };
}
const ID = xf();
const then = (A, B) => (q) => B(A(q));

class Poly {
  constructor() { this.v = []; this.n = []; this.c = []; }
  tri(a, b, c, n, col) { for (const q of [a, b, c]) { this.v.push(q[0], q[1], q[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0], col[1], col[2]); } }
  // a convex solid; col may be (normalY, face) => rgb. j jitters the corners (rocks)
  solid([verts, faces], M = ID, col = WHITE, j = 0, R = null) {
    const P = verts.map((q) => M(j ? [q[0] + (R() - 0.5) * j, q[1] + (R() - 0.5) * j, q[2] + (R() - 0.5) * j] : q));
    const ctr = [0, 0, 0];
    for (const q of P) { ctr[0] += q[0] / P.length; ctr[1] += q[1] / P.length; ctr[2] += q[2] / P.length; }
    faces.forEach((f, fi) => {
      const a = P[f[0]], b = P[f[1]], c = P[f[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let fx = 0, fy = 0, fz = 0;
      for (const i of f) { fx += P[i][0]; fy += P[i][1]; fz += P[i][2]; }
      const flip = nx * (fx / f.length - ctr[0]) + ny * (fy / f.length - ctr[1]) + nz * (fz / f.length - ctr[2]) < 0;
      const n = flip ? [-nx, -ny, -nz] : [nx, ny, nz], cc = typeof col === 'function' ? col(n[1], fi) : col;
      for (let i = 1; i < f.length - 1; i++) { if (flip) this.tri(a, P[f[i + 1]], P[f[i]], n, cc); else this.tri(a, P[f[i]], P[f[i + 1]], n, cc); }
    });
    return this;
  }
  // a flat polygon; with a hint normal it is wound to face that way
  face(pts, col, hint) {
    let n = [0, 1, 0];
    if (hint) {
      const a = pts[0], b = pts[1], c = pts[2];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) { pts = [...pts].reverse(); n = n.map((q) => -q); }
      const l = Math.hypot(...n) || 1; n = n.map((q) => q / l);
    }
    for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], n, col);
    return this;
  }
  flat(x0, z0, x1, z1, y, col) { const a = [x0, y, z0], b = [x0, y, z1], c = [x1, y, z1], d = [x1, y, z0], n = [0, 1, 0]; this.tri(a, b, c, n, col); this.tri(a, c, d, n, col); }
  geo() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.v, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const prism3 = (P, a, b, c, o, col) => P.solid([[a, b, c, ...[a, b, c].map((q) => [q[0] + o[0], q[1] + o[1], q[2] + o[2]])], PRF], ID, col);
// one static primitive (box, cyl, oct, ico, tet, wed or a 'bld' building) into the lit or glow soup
const SOLIDS = { box: BOXS, oct: OCTS, tet: TETS, ico: ICOS, wed: WEDS };
function prim(P, G, o) {
  const tgt = o.g ? G : P;
  if (o.s === 'bld') return bld(P, G, o);
  const c = lin(o.c), t = o.t && lin(o.t), col = t ? (ny) => (ny > 0.6 ? t : c) : c;
  const sh = o.s === 'cyl' ? cylS(o.n || 6, o.k ?? 1) : SOLIDS[o.s];
  tgt.solid(sh, xf(o.x || 0, o.y || 0, o.z || 0, o.w, o.h, o.d ?? o.w, o.ry || 0, o.rx || 0, o.rz || 0), col, o.j || 0, o.j ? mulberry32(o.sd || 1) : null);
}
function bld(P, G, o) {
  const c = lin(o.c), w = lin(o.wc || '#34405a'), y0 = o.y - o.h / 2;
  P.solid(BOXS, xf(o.x, o.y, o.z, o.w, o.h, o.d), (ny) => (ny > 0.6 ? mul(c, 0.82) : c));
  const n = Math.min(9, Math.floor((o.h - 2) / 4.5));
  for (let k = 0; k < n; k++) P.solid(BOXS, xf(o.x, y0 + 3.2 + k * 4.5, o.z, o.w + 0.16, 1.3, o.d + 0.16), w);
  if (o.v > 0.55) P.solid(BOXS, xf(o.x, y0 + o.h + 1.5, o.z, o.w * 0.6, 3, o.d * 0.6), c);
  if (o.v > 0.82 && o.h > 28) { P.solid(BOXS, xf(o.x, y0 + o.h + 7, o.z, 0.4, 10, 0.4), lin('#5a5e68')); G.solid(BOXS, xf(o.x, y0 + o.h + 12.2, o.z, 0.9, 0.6, 0.9), lin('#ff3a2a')); }
}
function ringPoly(P, R, b, d, col, n = 8, M = ID) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + Math.PI / n, a1 = ((i + 1) / n) * TAU + Math.PI / n, v = [];
    for (const a of [a0, a1]) for (const r of [R - b, R]) for (const z of [-d / 2, d / 2]) v.push([Math.cos(a) * r, Math.sin(a) * r, z]);
    P.solid([v, [[0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]], M, col);
  }
  return P;
}
// SNES-ish output: 24 levels per channel with a 4×4 ordered dither
const BAY = 'const float BAYER4[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);\n';
function retro(m) {
  m.onBeforeCompile = (s) => { s.fragmentShader = BAY + s.fragmentShader.replace('#include <dithering_fragment>', '{ ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0)); gl_FragColor.rgb = floor(gl_FragColor.rgb * 24.0 + (BAYER4[q.x + q.y * 4] + 0.5) / 16.0) / 24.0; }'); };
  m.customProgramCacheKey = () => 'retro24';
  return m;
}
const mesh = (geo, mat) => { const m = new T.Mesh(geo, mat); m.userData.mat = mat; return m; };
const flashG = (g, on, white) => g.traverse((c) => { if (c.isMesh && c.userData.mat) c.material = on ? white : c.userData.mat; });
const markI = (m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };

export class Flight extends Game {
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'trails'];
  setup() {
    const s = this.post.seed || 1;
    this.env0 = (s >>> 4) % ENV_KEYS.length;
    this.accent = this.pal.c[0] || '#3a6ae0';
    this.stageN = 0; this.lives = 2; this.hits = 0; this.bombs = 2; this.laser = 0;
    this.ready = false; this.firing = false; this.drag = null; this.lastTap = null; this.hint = 0;
    this.newStage();
    loadThree().then(() => { this.ready = true; }).catch((e) => { this.failed = String(e?.message || e); });
  }
  hud() { return `${Math.floor(this.score)} · ${this.hits} down`; }

  // ------------------------------------------------------------------ stage flow
  newStage(again = false) {
    if (!again) this.stageN++;
    this.envKey = ENV_KEYS[(this.env0 + this.stageN - 1) % ENV_KEYS.length];
    this.E = ENVS[this.envKey];
    const R = mulberry32(((this.post.seed || 1) * 977 + this.stageN * 131) >>> 0);
    this.stageName = this.E.names[Math.floor(R() * this.E.names.length)];
    this.tileSeed = Math.floor(R() * 1000);
    this.foeCols = this.E.foe.map(lin).concat([lin('#ffb040'), lin('#fff0c0')]);
    this.len = LEN + Math.min(3, this.stageN - 1) * 200;
    this.z = 0; this.genZ = 0; this.sHits = 0;
    this.chunks = new Map(); this.cols = []; this.waves = [];
    this.foes = []; this.shots = []; this.eshots = []; this.rings = []; this.items = []; this.bombsF = [];
    this.debris = []; this.flashes = []; this.pops = [];
    this.boss = null; this.clear = 0; this.over = 0; this.fade = this.stageN > 1 || again ? 1 : 0;
    this.ship = { x: 0, y: 10, vx: 0, vy: 0, bank: 0, pitch: 0, dead: 0, roll: 0, rollDir: 1 };
    this.aim = { x: 0, y: 10 }; this.ap = { x: 0, y: 10 };
    this.apT = 0; this.fireHold = 0; this.apBomb = 3; this.rollCd = 0; this.lock = false;
    this.shield = 100; this.inv = 1.5; this.blink = 0; this.cool = 0; this.bombT = 0; this.shake = 0; this.hurtT = 0; this.whiteT = 0;
    this.msg = { a: `STAGE ${this.stageN}`, b: this.stageName.toUpperCase(), c: this.E.label, t: 3.4 };
    if (this.gl) this.dropGpu();
  }
  step(dt) {
    if (!this.ready) return;
    this.fade = Math.max(0, this.fade - dt * 1.4);
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    if (this.clear && (this.clear += dt) > 5.6) { this.newStage(); return; }
    if (this.over && (this.over -= dt) <= 0) { this.score = 0; this.hits = 0; this.lives = 2; this.bombs = 2; this.laser = 0; this.newStage(true); return; }
    this.z += SPEED * dt;
    while (this.genZ < this.z + 420) { this.chunk(Math.floor(this.genZ / CH)); this.genZ += CH; }
    for (const i of this.chunks.keys()) if ((i + 1) * CH < this.z - 40) this.chunks.delete(i);
    if (Math.floor(this.t * 4) !== Math.floor((this.t - dt) * 4)) this.cols = this.cols.filter((o) => o.z1 > this.z - 6);
    while (this.waves.length && this.waves[0].z <= this.z) this.spawnWave(this.waves.shift());
    if (!this.boss && !this.clear && this.z >= this.len) this.spawnBoss();
    this.stepShip(dt);
    this.stepFoes(dt);
    if (this.boss) this.stepBoss(dt);
    this.stepShots(dt);
    this.stepPickups(dt);
    this.stepFx(dt);
  }

  // ------------------------------------------------------------------ world data (no GPU)
  addCol(o) { const e = o.t === 'box' ? o.d / 2 : o.t === 'bar' ? o.th / 2 : o.r; o.z0 = o.z - e; o.z1 = o.z + e; this.cols.push(o); return o; }
  geyH(o, t) { return (Math.max(0, Math.sin(t * o.f + o.p) - 0.15) / 0.85) * o.h; }
  hitCol(o, x, y, z, m, t) {
    if (z < o.z0 - m || z > o.z1 + m) return false;
    switch (o.t) {
      case 'box': return Math.abs(x - o.x) < o.w / 2 + m && Math.abs(y - o.y) < o.h / 2 + m;
      case 'sph': { const dx = x - o.x - (o.mx ? Math.sin(t * o.mf + o.mp) * o.mx : 0), dy = y - o.y - (o.my ? Math.cos(t * o.mf + o.mp) * o.my : 0), dz = z - o.z; return dx * dx + dy * dy + dz * dz < (o.r + m) ** 2; }
      case 'cyl': return y < o.y1 + m && y > o.y0 - m && (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + m) ** 2;
      case 'cone': { if (y > o.y1 + m || y < o.y0 - m) return false; const rr = o.r * clamp((o.y1 - y) / (o.y1 - o.y0), 0, 1); return (x - o.x) ** 2 + (z - o.z) ** 2 < (rr + m) ** 2; }
      case 'bar': { const a = o.a0 + t * o.w, dx = x - o.x, dy = y - o.y, al = dx * Math.cos(a) + dy * Math.sin(a), pe = dy * Math.cos(a) - dx * Math.sin(a); return Math.abs(al) < o.len / 2 + m && Math.abs(pe) < o.th / 2 + m; }
      case 'gey': return (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + m) ** 2 && y < this.geyH(o, t) + m;
    }
    return false;
  }
  freeAt(x, y, z, m) { for (const o of this.cols) if (this.hitCol(o, x, y, z, m, 0)) return false; return true; }
  chunk(i) {
    if (this.chunks.has(i)) return;
    const c = { st: [], mv: [] }, z0 = i * CH;
    this.chunks.set(i, c);
    const R = mulberry32((((this.post.seed || 1) * 7919) ^ (this.stageN * 104729) ^ Math.imul(i + 1, 2654435761)) >>> 0), pick = (a) => a[Math.floor(R() * a.length)];
    this.scenery(R, c, z0);
    if (i < 1 || z0 + CH > this.len - 20) return; // a clear runway at the start and an arena for the boss
    const roll = R();
    if (i === 1) this.ringRow(R, z0 + 34);
    else if (roll < 0.68) this.obstacle(R, c, z0 + 12 + R() * 36);
    else if (roll < 0.86) this.ringRow(R, z0 + 8 + R() * 24);
    const waves = [];
    if (i === 1) waves.push({ z: z0 - 32, k: 'v' });
    else if (R() < 0.8) waves.push({ z: z0 - 40 + R() * 50, k: pick(['v', 'v', 'cross', 'chase', 'swoop', 'pair']) });
    if (i % 6 === 4) waves.push({ z: z0 - 20 + R() * 30, k: 'carrier', item: pick(['twin', 'bomb', 'shield', 'twin']) });
    waves.sort((a, b) => a.z - b.z); this.waves.push(...waves);
    if (i >= 2 && R() < 0.45) this.groundFoes(R, z0);
    if (i % 5 === 2) { const it = { k: pick(['twin', 'shield', 'bomb', 'shield']), x: (R() - 0.5) * 26, y: 6 + R() * 14, z: z0 + 10 + R() * 60, t: 0 }; if (this.freeAt(it.x, it.y, it.z, 3)) this.items.push(it); }
  }
  ringRow(R, z) {
    let x = (R() - 0.5) * 24, y = 6 + R() * 14;
    const n = 3 + Math.floor(R() * 3), gold = R() < 0.3;
    for (let i = 0; i < n; i++) { this.rings.push({ x, y, z: z + i * 15, r: 4, gold }); x = clamp(x + (R() - 0.5) * 10, -15, 15); y = clamp(y + (R() - 0.5) * 7, 6, 21); }
  }
  groundFoes(R, z0) {
    const gf = this.E.gf, n = 1 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const x = (R() - 0.5) * 34, z = z0 + R() * CH;
      if (gf === 'mine') { const y = 5 + R() * 18; if (this.freeAt(x, y, z, 3)) this.addFoe({ kind: 'mine', ai: 'mine', x, y, z }); continue; }
      if (!this.freeAt(x, 2, z, 3)) continue;
      if (gf === 'boat') this.addFoe({ kind: 'boat', ai: 'boat', x, y: 1.4, z, base: 0 });
      else if (R() < 0.5) this.addFoe({ kind: 'turret', ai: 'turret', x, y: 2.4, z, base: 0 });
      else this.addFoe({ kind: 'walker', ai: 'walker', x, y: 3.8, z, x0: x, dir: R() < 0.5 ? -1 : 1 });
    }
  }
  addFoe(o) { const F = FOES[o.kind]; const e = Object.assign({ hp: F.hp, r: F.r, t: 0, cool: 0.8 + this.rng() * 1.4, vx: 0, vy: 0, vz: 0, flash: 0, ph: this.rng() * TAU, ground: !!F.ground }, o); this.foes.push(e); return e; }
  pine(st, x, z, s, R, snow) {
    const E = this.E, c = snow ? E.leaf[0] : E.leaf[Math.floor(R() * 2)];
    st.push({ s: 'box', x, y: 1.2 * s, z, w: 0.7 * s, h: 2.4 * s, d: 0.7 * s, c: E.trunk || '#5a4030' });
    for (let i = 0; i < 3; i++) st.push({ s: 'cyl', n: 6, k: 0, x, y: (3.4 + i * 2.3) * s, z, w: (5 - i * 1.3) * s, h: 3.6 * s, ry: R() * 2, c: snow && i === 2 ? snow : c });
  }
  palm(st, x, z, R) {
    const E = this.E, h = 6 + R() * 4, lean = (R() - 0.5) * 0.5, tx = x + Math.sin(lean) * h;
    st.push({ s: 'cyl', n: 5, k: 0.7, x: x + (Math.sin(lean) * h) / 2, y: h / 2, z, w: 0.7, h, rz: -lean, c: E.trunk });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + R(); st.push({ s: 'box', x: tx + Math.cos(a) * 1.8, y: h - 0.4, z: z + Math.sin(a) * 1.8, w: 3.6, h: 0.2, d: 1.1, ry: -a, rz: -0.35, c: E.leaf[i % 2] }); }
  }
  // side scenery, outside the corridor (no colliders: the ship cannot get there)
  scenery(R, c, z0) {
    const E = this.E, st = c.st, k = this.envKey, pick = (a) => a[Math.floor(R() * a.length)], sd = () => Math.floor(R() * 1e9);
    const out = (a, b) => (R() < 0.5 ? -1 : 1) * (a + Math.pow(R(), 1.3) * (b - a));
    if (k === 'city') {
      for (const s of [-1, 1]) {
        for (let z = z0 + 13; z < z0 + 78;) { const d = 8 + R() * 8, w = 8 + R() * 9, h = 10 + R() * 34; if (z + d > z0 + 79) break; st.push({ s: 'bld', x: s * (29 + w / 2), y: h / 2, z: z + d / 2, w, h, d, c: pick(E.bld), wc: E.win, v: R() }); z += d + 1.5 + R() * 3; }
        for (let q = 0; q < 4; q++) { const w = 10 + R() * 14, d = 10 + R() * 14, h = 18 + R() * 62; st.push({ s: 'bld', x: s * (50 + R() * 95), y: h / 2, z: z0 + 13 + d / 2 + R() * (64 - d), w, h, d, c: pick(E.bld), wc: E.win, v: R() }); }
        for (let z = z0 + 6; z < z0 + 80; z += 20) st.push({ s: 'box', x: s * 24.6, y: 3.2, z, w: 0.35, h: 6.4, d: 0.35, c: '#3c414c' }, { s: 'box', x: s * 23.8, y: 6.4, z, w: 1.8, h: 0.3, d: 0.5, c: '#3c414c' }, { s: 'box', x: s * 23.2, y: 6.15, z, w: 0.7, h: 0.25, d: 0.55, c: '#fff4c8', g: 1 });
      }
    } else if (k === 'desert') {
      for (let q = 0; q < 8; q++) {
        const x = out(28, 160), z = z0 + R() * CH, r = R(), ax = Math.abs(x);
        if (r < 0.34) { const h = 3 + R() * 6; st.push({ s: 'cyl', n: 5, k: 0, x, y: h / 2, z, w: 22 + R() * 30, h, d: 16 + R() * 24, ry: R() * 3, j: 0.14, sd: sd(), c: pick(E.ground.slice(1)) }); }
        else if (r < 0.52 && ax > 50) { const w = 18 + R() * 22, h = 16 + R() * 26; st.push({ s: 'cyl', n: 7, k: 0.86, x, y: h / 2, z, w, h, ry: R() * 3, j: 0.08, sd: sd(), c: E.rock, t: E.rock2 }, { s: 'cyl', n: 7, k: 0.9, x, y: h * 0.42, z, w: w * 1.05, h: h * 0.16, ry: R() * 3, c: E.rock2 }); }
        else if (r < 0.66 && ax > 40) { const w = 22 + R() * 26; st.push({ s: 'cyl', n: 4, k: 0, x, y: w * 0.33, z, w: w * 1.41, h: w * 0.66, ry: Math.PI / 4 + R() * 0.4, c: E.stone }); }
        else if (r < 0.84 && ax < 70) { const h = 4 + R() * 4; st.push({ s: 'box', x, y: h / 2, z, w: 0.9, h, d: 0.9, c: E.cactus }, { s: 'box', x: x + 0.9, y: h * 0.6, z, w: 1.8, h: 0.6, d: 0.6, c: E.cactus }, { s: 'box', x: x + 1.5, y: h * 0.75, z, w: 0.6, h: 2, d: 0.6, c: E.cactus }); }
        else { const s = 2 + R() * 5; st.push({ s: 'ico', x, y: s * 0.3, z, w: s * 1.4, h: s, d: s * 1.2, j: 0.3, sd: sd(), c: E.rock }); }
      }
    } else if (k === 'forest') {
      for (let q = 0; q < 16; q++) {
        const x = out(26, 150), z = z0 + R() * CH, s = (0.8 + R() * 0.7) * (Math.abs(x) > 60 ? 1.5 : 1);
        if (R() < 0.6) this.pine(st, x, z, s, R);
        else st.push({ s: 'box', x, y: 2 * s, z, w: 0.8 * s, h: 4 * s, d: 0.8 * s, c: E.trunk }, { s: 'ico', x, y: 5.6 * s, z, w: 6 * s, h: 5 * s, d: 6 * s, j: 0.25, sd: sd(), c: pick(E.leaf) });
      }
      if (R() < 0.7) { const w = 40 + R() * 50, h = 12 + R() * 22; st.push({ s: 'cyl', n: 7, k: 0.3, x: out(60, 160), y: h / 2, z: z0 + R() * CH, w, h, ry: R() * 3, j: 0.16, sd: sd(), c: E.ground[4], t: E.ground[2] }); }
    } else if (k === 'ocean') {
      for (let q = 0; q < 5; q++) {
        const x = out(30, 160), z = z0 + R() * CH, r = R();
        if (r < 0.3) { const w = 16 + R() * 26; st.push({ s: 'cyl', n: 8, k: 0.8, x, y: 0.5, z, w, h: 1.6, ry: R(), j: 0.1, sd: sd(), c: E.sand }); for (let p = 0; p < 1 + R() * 3; p++) this.palm(st, x + (R() - 0.5) * w * 0.4, z + (R() - 0.5) * w * 0.4, R); }
        else if (r < 0.65) { const w = 5 + R() * 8, h = 8 + R() * 26; st.push({ s: 'cyl', n: 6, k: 0.6, x, y: h / 2 - 1, z, w, h, ry: R() * 3, j: 0.2, sd: sd(), c: E.rock, t: E.leaf[0] }); }
        else if (r < 0.85 && Math.abs(x) < 60) st.push({ s: 'cyl', n: 6, k: 0.7, x, y: 0.8, z, w: 1.4, h: 1.8, c: '#e04030' }, { s: 'cyl', n: 6, k: 0, x, y: 2.1, z, w: 1, h: 0.9, c: '#f0f0f0' });
        else st.push({ s: 'ico', x, y: 0.4, z, w: 4 + R() * 6, h: 2 + R() * 3, d: 4 + R() * 6, j: 0.3, sd: sd(), c: E.rock });
      }
    } else if (k === 'space') {
      for (let q = 0; q < 14; q++) {
        let x, y;
        do { x = (R() - 0.5) * 320; y = -70 + R() * 170; } while (Math.abs(x) < 30 && y > -12 && y < 40);
        const s = 3 + R() * R() * 16;
        st.push({ s: 'ico', x, y, z: z0 + R() * CH, w: s, h: s * (0.7 + R() * 0.4), d: s, ry: R() * 6, rx: R() * 6, j: 0.35, sd: sd(), c: pick(E.rock) });
      }
      if (R() < 0.3) { const x = out(60, 150), y = 10 + R() * 40, z = z0 + R() * CH; st.push({ s: 'cyl', n: 8, x, y, z, w: 8, h: 26, rz: Math.PI / 2, c: E.metal[0] }, { s: 'box', x, y, z, w: 40, h: 0.6, d: 7, c: E.metal[1] }, { s: 'box', x, y: y + 4.2, z, w: 3, h: 0.4, d: 2, c: E.arch[1], g: 1 }); }
    } else if (k === 'volcano') {
      for (let q = 0; q < 7; q++) {
        const x = out(28, 160), z = z0 + R() * CH, r = R();
        if (r < 0.22 && Math.abs(x) > 55) { const w = 40 + R() * 40, h = 22 + R() * 28; st.push({ s: 'cyl', n: 7, k: 0.22, x, y: h / 2, z, w, h, ry: R() * 3, j: 0.12, sd: sd(), c: E.rock }, { s: 'cyl', n: 7, x, y: h + 0.15, z, w: w * 0.2, h: 0.4, c: E.lava, g: 1 }); }
        else if (r < 0.55) { const w = 4 + R() * 6, h = 10 + R() * 26; st.push({ s: 'cyl', n: 5, k: 0.25, x, y: h / 2, z, w, h, ry: R() * 3, j: 0.2, sd: sd(), c: pick([E.rock, E.rock2]) }); }
        else if (r < 0.75 && Math.abs(x) < 80) { const w = 8 + R() * 16; st.push({ s: 'cyl', n: 7, x, y: 0.06, z, w, h: 0.1, d: w * 0.7, ry: R() * 3, j: 0.1, sd: sd(), c: E.lava, g: 1 }); }
        else st.push({ s: 'ico', x, y: 0.6, z, w: 3 + R() * 5, h: 2 + R() * 3, d: 3 + R() * 5, j: 0.3, sd: sd(), c: E.rock2 });
      }
    } else if (k === 'ice') {
      for (let q = 0; q < 10; q++) {
        const x = out(26, 160), z = z0 + R() * CH, r = R();
        if (r < 0.45) this.pine(st, x, z, 0.9 + R() * 0.8, R, E.leaf[1]);
        else if (r < 0.7) { const w = 3 + R() * 4, h = 8 + R() * 18; st.push({ s: 'cyl', n: 4, k: 0, x, y: h / 2, z, w, h, ry: R() * 3, j: 0.12, sd: sd(), c: pick(E.ice) }); }
        else { const w = 20 + R() * 40, h = 8 + R() * 22; st.push({ s: 'cyl', n: 6, k: 0.35, x: Math.sign(x) * Math.max(Math.abs(x), 45), y: h / 2, z, w, h, ry: R() * 3, j: 0.18, sd: sd(), c: E.ice[1], t: E.ice[2] }); }
      }
    }
  }
  // something to fly through, over or around (with colliders)
  obstacle(R, c, z) {
    const E = this.E, st = c.st, pick = (a) => a[Math.floor(R() * a.length)], sd = () => Math.floor(R() * 1e9);
    const B = (x, y, zz, w, h, d, col, o) => { st.push({ s: 'box', x, y, z: zz, w, h, d, c: col, ...o }); this.addCol({ t: 'box', x, y, z: zz, w, h, d }); };
    const slots = [-15.5, -5.2, 5.2, 15.5].sort(() => R() - 0.5), p = pick(PATS[this.envKey]);
    if (p === 'arch' || p === 'logarch') {
      const ow = 15 + R() * 4, oh = 12 + R() * 5, ax = (R() - 0.5) * 12, pw = 3.6, [ca, cb] = E.arch;
      if (p === 'logarch') {
        for (const s of [-1, 1]) { const x = ax + s * (ow / 2 + pw / 2); st.push({ s: 'cyl', n: 6, x, y: oh / 2, z, w: pw, h: oh, c: ca }); this.addCol({ t: 'box', x, y: oh / 2, z, w: pw, h: oh, d: pw }); }
        st.push({ s: 'cyl', n: 6, x: ax, y: oh + 1.6, z, w: 3.2, h: ow + pw * 2 + 2, rz: Math.PI / 2, c: cb }); this.addCol({ t: 'box', x: ax, y: oh + 1.6, z, w: ow + pw * 2 + 2, h: 3.2, d: 3.2 });
      } else { B(ax - ow / 2 - pw / 2, oh / 2, z, pw, oh, 4, ca); B(ax + ow / 2 + pw / 2, oh / 2, z, pw, oh, 4, ca); B(ax, oh + 1.8, z, ow + pw * 2 + 1.5, 3.6, 4.6, cb); }
      if (R() < 0.4) this.rings.push({ x: ax, y: oh / 2 + 1, z, r: 4, gold: R() < 0.4 });
    } else if (p === 'gate') {
      const hx = (R() - 0.5) * 20, hy = 8.5 + R() * 10, hw = 14, hh = 11, d = 3, col = E.wall, X0 = -36, X1 = 36, top = 36, b = E.space ? -14 : 0;
      B((X0 + hx - hw / 2) / 2, (b + top) / 2, z, hx - hw / 2 - X0, top - b, d, col);
      B((hx + hw / 2 + X1) / 2, (b + top) / 2, z, X1 - hx - hw / 2, top - b, d, col);
      B(hx, (b + hy - hh / 2) / 2, z, hw, hy - hh / 2 - b, d, col);
      B(hx, (hy + hh / 2 + top) / 2, z, hw, top - hy - hh / 2, d, col);
      for (const [x, y, w, h] of [[hx, hy - hh / 2 - 0.3, hw + 1.2, 0.6], [hx, hy + hh / 2 + 0.3, hw + 1.2, 0.6], [hx - hw / 2 - 0.3, hy, 0.6, hh], [hx + hw / 2 + 0.3, hy, 0.6, hh]]) st.push({ s: 'box', x, y, z: z - 1.6, w, h, d: 0.4, c: E.arch[1], g: 1 });
      if (R() < 0.5) this.rings.push({ x: hx, y: hy, z: z - 5, r: 4, gold: true });
    } else if (['towers', 'obelisks', 'stacks', 'spires', 'spikes', 'bigtrees'].includes(p)) {
      const n = p === 'bigtrees' ? 2 : 2 + (R() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const x = slots[i] + (R() - 0.5) * 3, zz = z + i * (14 + R() * 6);
        if (p === 'towers') { const w = 7 + R() * 3, d = 7 + R() * 4, h = 34 + R() * 26; st.push({ s: 'bld', x, y: h / 2, z: zz, w, h, d, c: pick(E.bld), wc: E.win, v: R() }); this.addCol({ t: 'box', x, y: h / 2, z: zz, w, h, d }); }
        else if (p === 'obelisks') { const h = 22 + R() * 12; B(x, h / 2, zz, 3, h, 3, E.stone); st.push({ s: 'cyl', n: 4, k: 0, x, y: h + 1.4, z: zz, w: 4.24, h: 2.8, c: E.rock2 }); }
        else if (p === 'stacks') { const w = 6 + R() * 4, h = 20 + R() * 16; st.push({ s: 'cyl', n: 6, k: 0.65, x, y: h / 2 - 1, z: zz, w, h, ry: R() * 3, j: 0.16, sd: sd(), c: E.rock, t: E.leaf[0] }); this.addCol({ t: 'cyl', x, z: zz, r: w * 0.45, y0: -1, y1: h - 1 }); }
        else if (p === 'spires') { const w = 7 + R() * 4, h = 28 + R() * 14; st.push({ s: 'cyl', n: 5, k: 0.2, x, y: h / 2, z: zz, w, h, ry: R() * 3, j: 0.14, sd: sd(), c: pick([E.rock, E.rock2]) }); this.addCol({ t: 'cone', x, z: zz, r: w * 0.48, y0: 0, y1: h }); }
        else if (p === 'spikes') { const w = 7 + R() * 4, h = 26 + R() * 14; st.push({ s: 'cyl', n: 4, k: 0, x, y: h / 2, z: zz, w: w * 1.41, h, ry: R() * 3, j: 0.08, sd: sd(), c: pick(E.ice) }); this.addCol({ t: 'cone', x, z: zz, r: w * 0.55, y0: 0, y1: h }); }
        else { const s = 2.6 + R() * 0.6; this.pine(st, x, zz, s, R); this.addCol({ t: 'cyl', x, z: zz, r: 0.45 * s, y0: 0, y1: 2.4 * s }); this.addCol({ t: 'cone', x, z: zz, r: 2.5 * s, y0: 1.6 * s, y1: 9.8 * s }); }
      }
    } else if (p === 'floaters' || p === 'crystals' || p === 'rocks') {
      const n = 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const r = p === 'rocks' ? 2.4 + R() * 2.6 : 1.8 + R() * 1.6, x = (R() - 0.5) * 36, y = 4 + R() * 20, zz = z + i * (10 + R() * 6), mv = R() < 0.5;
        const shape = p === 'rocks' ? 'ico' : p === 'crystals' ? 'oct' : pick(['oct', 'box', 'tet', 'ico', 'oct']);
        const col = this.addCol({ t: 'sph', x, y, z: zz, r: r * 0.92, mx: mv ? 3 + R() * 6 : 0, my: mv ? R() * 3 : 0, mf: 0.6 + R() * 0.8, mp: R() * TAU });
        const sz = r * (shape === 'box' ? 1.45 : shape === 'tet' ? 2.1 : 2.05);
        c.mv.push({ col, sp: [R() * 2 - 1, R() * 2 - 1, R() - 0.5].map((v) => v * 1.4), vis: { s: shape, w: sz, h: p === 'crystals' ? sz * 1.5 : sz, d: sz, c: p === 'rocks' ? pick(E.rock) : E.float[i % 2], j: p === 'rocks' ? 0.3 : 0, sd: sd() } });
      }
    } else if (p === 'bar') {
      const x = (R() - 0.5) * 8, col = this.addCol({ t: 'bar', x, y: 14, z, len: 40, th: 2.8, w: (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.5), a0: R() * TAU });
      c.mv.push({ col, vis: { s: 'box', w: 40, h: 2.8, d: 2.8, c: E.arch[0] } });
      st.push({ s: 'cyl', n: 8, x, y: 14, z, w: 4.4, h: 3.6, rx: Math.PI / 2, c: E.wall }); this.addCol({ t: 'sph', x, y: 14, z, r: 2.4 });
      if (!E.space) B(x, 6, z + 2.8, 1.6, 12, 1.6, E.wall);
    } else if (p === 'bridge' || p === 'girder') {
      const n = 1 + (R() < 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const y = 7 + R() * 13, zz = z + i * 22;
        if (p === 'girder') {
          st.push({ s: 'box', x: 0, y, z: zz, w: 64, h: 1.4, d: 2.4, c: E.metal[0] }, { s: 'box', x: 0, y: y + 4.4, z: zz, w: 64, h: 0.7, d: 1.4, c: E.metal[0] });
          for (let q = 0; q < 10; q++) st.push({ s: 'box', x: -27 + q * 6, y: y + 2.2, z: zz, w: 0.5, h: 5.4, d: 0.5, rz: q % 2 ? 0.75 : -0.75, c: E.metal[1] });
          this.addCol({ t: 'box', x: 0, y: y + 1.9, z: zz, w: 64, h: 6.4, d: 2.4 });
          if (R() < 0.5) { const gx = (R() - 0.5) * 24; B(gx, 12, zz + 9, 2.4, 60, 2.4, E.metal[1]); }
        } else {
          B(0, y, zz, 64, 2.6, 4.5, E.wall);
          st.push({ s: 'box', x: 0, y: y - 1.4, z: zz - 2.3, w: 64, h: 0.3, d: 0.2, c: E.arch[1], g: 1 });
        }
      }
    } else if (p === 'pyramid') {
      const b = 16 + R() * 8, h = b * 0.62, x = (R() - 0.5) * 22;
      st.push({ s: 'cyl', n: 4, k: 0, x, y: h / 2, z, w: b * 1.41, h, ry: (R() - 0.5) * 0.3, c: E.stone });
      this.addCol({ t: 'cone', x, z, r: b * 0.6, y0: 0, y1: h });
      if (R() < 0.35) this.rings.push({ x, y: Math.min(22, h + 5.5), z, r: 4, gold: false });
    } else if (p === 'mesa') {
      const w = 14 + R() * 5, h = 30 + R() * 10, x = (R() - 0.5) * 20;
      st.push({ s: 'cyl', n: 7, k: 0.88, x, y: h / 2, z, w, h, ry: R() * 3, j: 0.06, sd: sd(), c: E.rock, t: E.rock2 }, { s: 'cyl', n: 7, k: 0.9, x, y: h * 0.4, z, w: w * 1.04, h: h * 0.14, c: E.rock2 });
      this.addCol({ t: 'cyl', x, z, r: w * 0.5, y0: 0, y1: h });
    } else if (p === 'hill') {
      const w = 26 + R() * 10, h = 10 + R() * 5, x = (R() - 0.5) * 16;
      st.push({ s: 'cyl', n: 7, k: 0.3, x, y: h / 2, z, w, h, ry: R() * 3, j: 0.12, sd: sd(), c: E.ground[4], t: E.ground[2] });
      this.addCol({ t: 'cone', x, z, r: w * 0.5, y0: 0, y1: h * 1.15 });
      if (R() < 0.4) this.rings.push({ x, y: Math.min(22, h * 1.15 + 5.5), z, r: 4, gold: R() < 0.3 });
    } else if (p === 'rig') {
      const x = (R() - 0.5) * 12, dy = 11 + R() * 4, [c1, c2, c3] = E.rig;
      B(x, dy, z, 24, 2.2, 14, c1);
      st.push({ s: 'box', x, y: dy + 1.25, z, w: 22, h: 0.3, d: 12, c: c3 });
      for (const [lx, lz] of [[-10, -5], [10, -5], [-10, 5], [10, 5]]) { st.push({ s: 'cyl', n: 6, x: x + lx, y: dy / 2 - 0.5, z: z + lz, w: 1.6, h: dy + 1, c: c2 }); this.addCol({ t: 'cyl', x: x + lx, z: z + lz, r: 0.9, y0: -1, y1: dy }); }
      st.push({ s: 'cyl', n: 4, k: 0.2, x: x - 5, y: dy + 8, z, w: 7, h: 14, c: c2 }); this.addCol({ t: 'box', x: x - 5, y: dy + 8, z, w: 5, h: 14, d: 5 });
      st.push({ s: 'cyl', n: 8, x: x + 6, y: dy + 1.45, z, w: 7, h: 0.2, c: '#3a8a4a' });
      this.addFoe({ kind: 'turret', ai: 'turret', x: x + 6, y: dy + 1.1 + 2.4, z, base: dy + 1.1 });
    } else if (p === 'geyser') {
      for (let i = 0; i < 2; i++) {
        const x = slots[i] + (R() - 0.5) * 3, zz = z + i * 16, col = this.addCol({ t: 'gey', x, z: zz, r: 2.8, h: 34, f: 1.1 + R() * 0.6, p: R() * TAU });
        c.mv.push({ col, vis: { s: 'cyl', n: 6, k: 0.6, w: 5.6, h: 34, c: E.lava, g: 1 } });
        st.push({ s: 'cyl', n: 7, k: 0.7, x, y: 0.6, z: zz, w: 9, h: 1.2, c: E.rock2 }, { s: 'cyl', n: 7, x, y: 1.25, z: zz, w: 6, h: 0.1, c: E.lava2, g: 1 });
      }
    }
  }
  spawnWave(w) {
    const z = this.z, sw = this.mods.swarm ? 1.5 : 1, r = (a, b) => this.r(a, b);
    if (w.k === 'v') {
      const n = Math.round(5 * sw), cx = r(-9, 9), cy = r(7, 19), hold = r(52, 70);
      for (let i = 0; i < n; i++) { const o = i - (n - 1) / 2; this.addFoe({ kind: 'dart', ai: 'hold', x: cx + o * 3.4, y: cy + Math.abs(o) * 1.1, z: z + 210 + Math.abs(o) * 7, hold: hold + Math.abs(o) * 5, holdT: r(2.6, 4.2), wa: 2.5, wf: r(1, 1.6), side: Math.sign(o) || 1 }); }
    } else if (w.k === 'cross') {
      const n = Math.round(3 * sw), dir = this.rng() < 0.5 ? 1 : -1, y = r(6, 20), rel = r(70, 100);
      for (let i = 0; i < n; i++) this.addFoe({ kind: 'saucer', ai: 'cross', x: -dir * (48 + i * 9), y: y + (i % 2) * 3, z: z + rel + i * 4, dir, rel: rel + i * 4 });
    } else if (w.k === 'chase') {
      const n = Math.round(3 * sw), cx = r(-8, 8), cy = r(8, 18);
      for (let i = 0; i < n; i++) this.addFoe({ kind: 'dart', ai: 'chase', x: cx + (i - 1) * 6, y: cy + (i % 2) * 2.5, z: z - 22 - i * 6, hold: r(48, 64) + i * 6, holdT: r(2.5, 4), wa: 3, wf: r(0.9, 1.4), side: i % 2 ? 1 : -1 });
    } else if (w.k === 'swoop') {
      const n = Math.round(4 * sw), side = this.rng() < 0.5 ? -1 : 1;
      for (let i = 0; i < n; i++) this.addFoe({ kind: 'bat', ai: 'swoop', x0: side * r(4, 16), x: side * 10, y: 60, z: z + 170 + i * 16, ty: r(5, 20), side, delay: i * 0.25 });
    } else if (w.k === 'pair') {
      for (let i = 0; i < 2; i++) this.addFoe({ kind: 'saucer', ai: 'hold', x: i ? 12 : -12, y: r(8, 18), z: z + 200, hold: r(55, 70), holdT: r(4, 6), wa: 3.5, wf: 0.8, side: i ? 1 : -1 });
    } else if (w.k === 'carrier') this.addFoe({ kind: 'saucer', ai: 'hold', x: r(-10, 10), y: r(8, 18), z: z + 200, hold: 70, holdT: 5, wa: 4, wf: 0.7, side: 1, item: w.item, gold: true });
  }

  // ------------------------------------------------------------------ ship
  stepShip(dt) {
    const s = this.ship;
    this.inv = Math.max(0, this.inv - dt); this.blink = Math.max(0, this.blink - dt); this.hurtT = Math.max(0, this.hurtT - dt); this.whiteT = Math.max(0, this.whiteT - dt);
    this.shake = Math.max(0, this.shake - dt); this.cool -= dt; this.bombT -= dt; this.rollCd -= dt; this.hint = Math.max(0, this.hint - dt);
    if (s.dead > 0) {
      if (this.over) return;
      if ((s.dead -= dt) <= 0) {
        if (this.lives < 0) { this.over = 3.2; this.msg = { a: 'GAME OVER', b: `SCORE ${Math.floor(this.score)}`, t: 3 }; s.dead = 99; return; }
        s.dead = 0; this.shield = 100; this.inv = 2.2; this.blink = 2.2; Object.assign(s, { x: 0, y: 10, vx: 0, vy: 0, roll: 0 }); this.aim = { x: 0, y: 10 }; this.ap = { x: 0, y: 10 };
      }
      return;
    }
    const ax = clamp(this.aim.x, -XM, XM), ay = clamp(this.aim.y, Y0, Y1);
    const wx = clamp((ax - s.x) / 0.07, -55, 55), wy = clamp((ay - s.y) / 0.07, -45, 45);
    s.vx += clamp(wx - s.vx, -700 * dt, 700 * dt); s.vy += clamp(wy - s.vy, -600 * dt, 600 * dt);
    s.x = clamp(s.x + s.vx * dt, -XM, XM); s.y = clamp(s.y + s.vy * dt, Y0, Y1);
    const k = 1 - Math.exp(-dt * 12);
    s.bank += (clamp(-s.vx * 0.016, -0.6, 0.6) - s.bank) * k; s.pitch += (clamp(s.vy * 0.012, -0.35, 0.35) - s.pitch) * k;
    if (s.roll > 0) s.roll = Math.max(0, s.roll - dt);
    if (this.firing) this.fire();
    const m = 0.9 * this.S;
    for (const o of this.cols) if (this.z > o.z0 - 2 && this.z < o.z1 + 2 && this.hitCol(o, s.x, s.y, this.z, m, this.t)) { this.scrape(o, m); break; }
  }
  // knocked out of an obstacle to the nearest free spot, shield damaged
  scrape(o, m) {
    const s = this.ship;
    let nx = s.x, ny = Y1;
    search: for (let d = 0.6; d < 30; d += 0.6) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = s.x + dx * d, y = s.y + dy * d;
      if (x < -XM || x > XM || y < Y0 || y > Y1) continue;
      if (!this.hitCol(o, x, y, this.z, m + 0.2, this.t)) { nx = x; ny = y; break search; }
    }
    this.aim.x += nx - s.x; this.aim.y += ny - s.y; this.ap.x += nx - s.x; this.ap.y += ny - s.y;
    s.vx = (nx - s.x) * 8; s.vy = (ny - s.y) * 8; s.x = nx; s.y = ny;
    this.spark(s.x, s.y, this.z + 1, 6);
    this.hurt(14);
  }
  hurt(n) {
    const s = this.ship;
    if (s.dead > 0 || this.inv > 0 || this.clear) return;
    this.shield -= n * (this.mods.glass ? 1.8 : 1); this.inv = 0.45; this.hurtT = 0.3; this.shake = Math.max(this.shake, 0.3);
    if (this.shield <= 0) {
      this.shield = 0; this.boom(s.x, s.y, this.z, 2.4, [lin('#e8eaf2'), lin(this.accent), lin('#ffb040'), lin('#fff0c0')]);
      s.dead = 2.2; this.lives--; this.laser = Math.max(0, this.laser - 1); this.firing = false;
      if (this.lives >= 0) this.msg = { a: 'SHIP DOWN', b: `${this.lives + 1} LEFT`, t: 2 };
    }
  }
  fire() {
    const s = this.ship;
    if (this.cool > 0 || s.dead > 0) return;
    this.cool = this.laser === 2 ? 0.11 : 0.13;
    const cb = Math.cos(s.bank), sb = Math.sin(s.bank);
    for (const o of this.laser ? [-1.25, 1.25] : [0]) this.shots.push({ x: s.x + o * cb, y: s.y + o * sb - 0.1, z: this.z + 1.6, vx: s.vx * 0.25, vy: s.vy * 0.25, life: 1.2, dmg: this.laser === 2 ? 2 : 1 });
  }
  bomb() {
    const s = this.ship;
    if (this.bombs <= 0 || this.bombT > 0 || s.dead > 0 || !this.ready || this.clear) return;
    this.bombs--; this.bombT = 0.9;
    this.bombsF.push({ x: s.x, y: s.y, z: this.z + 2, life: 0.8 });
  }
  barrel() { const s = this.ship; if (s.dead > 0 || s.roll > 0 || this.rollCd > 0) return; s.roll = 0.55; s.rollDir = s.vx > 0 ? -1 : 1; this.rollCd = 0.9; }

  // ------------------------------------------------------------------ enemies
  stepFoes(dt) {
    const s = this.ship, z = this.z, diff = (1 + (this.stageN - 1) * 0.18) * (this.mods.glass ? 1.25 : 1), alive = s.dead <= 0;
    for (const e of this.foes) {
      if (e.dead) continue;
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.flare = Math.max(0, (e.flare || 0) - dt);
      const px = e.x, py = e.y, pz = e.z;
      if (e.ai === 'hold' || e.ai === 'chase') {
        const rel = e.z - z;
        if (!e.st) e.st = 'in';
        if (e.st === 'in') {
          e.z += (e.ai === 'chase' ? SPEED + 34 : SPEED - 38) * dt;
          if (e.ai === 'chase' ? rel >= e.hold : rel <= e.hold) { e.st = 'hold'; e.t0 = e.t; e.x0 = e.x; e.y0 = e.y; e.h0 = rel; }
        } else if (e.st === 'hold') {
          const u = e.t - e.t0;
          e.z = z + e.h0 + Math.sin(u * 0.9) * 3;
          e.x = clamp(e.x0 + Math.sin(u * e.wf) * e.wa * 2, -26, 26); e.y = clamp(e.y0 + Math.sin(u * e.wf * 1.3) * e.wa * 0.7, 3, 30);
          if (u > e.holdT) e.st = 'out';
        } else { e.vo = (e.vo || 0) + e.side * 60 * dt; e.x += e.vo * dt; e.y += 14 * dt; e.z += (SPEED + 20) * dt; }
      } else if (e.ai === 'cross') { e.z = z + e.rel; e.x += e.dir * 27 * dt; e.y += Math.sin(e.t * 2 + e.ph) * 3 * dt; if (e.x * e.dir > 60) e.gone = true; }
      else if (e.ai === 'swoop') {
        if (e.t < e.delay) e.z += SPEED * dt;
        else { const u = e.t - e.delay; e.z += (SPEED - 70) * dt; e.y = lerp(60, e.ty, clamp(u / 1.6, 0, 1) ** 0.6); e.x = e.x0 + e.side * Math.sin(u * 1.4) * 9; }
      } else if (e.ai === 'walker') { e.x += e.dir * 3.5 * dt; if (Math.abs(e.x - e.x0) > 5) e.dir = -e.dir; }
      else if (e.ai === 'boat') { e.z -= 7 * dt; e.x += Math.sin(e.t * 0.8 + e.ph) * 4 * dt; }
      else if (e.ai === 'mine') e.y += Math.sin(e.t * 1.3 + e.ph) * 1.2 * dt;
      e.vx = (e.x - px) / dt; e.vy = (e.y - py) / dt; e.vz = (e.z - pz) / dt;
      const rel = e.z - z;
      if (alive && e.kind !== 'mine' && e.st !== 'out' && rel > 24 && rel < 175 && !e.gone && !this.clear) {
        if ((e.cool -= dt) <= 0) {
          e.cool = ((e.kind === 'turret' ? 1.9 : e.kind === 'walker' ? 2.4 : 2.6) * (0.75 + this.rng() * 0.5)) / diff;
          this.enemyFire(e.x, e.y, e.z - e.r * 0.5); e.flare = 0.12;
          if (e.kind === 'walker' || e.kind === 'saucer' || e.kind === 'boat') e.bt = 0.18;
        }
        if (e.bt > 0 && (e.bt -= dt) <= 0) { this.enemyFire(e.x, e.y, e.z - e.r * 0.5); e.flare = 0.12; }
      }
      if (alive) {
        const dx = e.x - s.x, dy = e.y - s.y, dz = e.z - z, rr = e.r + 0.9 * this.S;
        if (dx * dx + dy * dy + dz * dz < rr * rr) { this.hurt(e.kind === 'mine' ? 14 : 12); this.kill(e, true); }
      }
    }
    this.foes = this.foes.filter((e) => !e.dead && !e.gone && e.z > z - (e.ai === 'chase' && e.st === 'in' ? 60 : 16) && e.y < 80 && Math.abs(e.x) < 90);
  }
  enemyFire(x, y, z, spread = 0, sp = 62) {
    const s = this.ship, dz = this.z - z, tt = Math.max(0.5, Math.hypot(s.x - x, s.y - y, dz) / sp);
    const tx = s.x + s.vx * tt * 0.5 + this.r(-1, 1) + spread * Math.abs(dz), ty = s.y + s.vy * tt * 0.4 + this.r(-0.8, 0.8);
    this.eshots.push({ x, y, z, vx: (tx - x) / tt, vy: (ty - y) / tt, vz: dz / tt + SPEED, life: tt * 1.7 + 0.4 });
  }
  damage(e, n) { e.hp -= n * (this.mods.glass ? 2 : 1); e.flash = 0.07; if (e.hp <= 0) this.kill(e, true); }
  kill(e, scored) {
    if (e.dead) return;
    e.dead = true;
    const F = FOES[e.kind];
    if (scored) { this.hits++; this.sHits++; this.score += F.score; this.pop(e.x, e.y + 2.5, e.z, `${F.score}`); }
    this.boom(e.x, e.y, e.z, F.size, this.foeCols);
    if (e.item) this.items.push({ k: e.item, x: clamp(e.x, -18, 18), y: clamp(e.y, Y0 + 2, Y1 - 2), z: Math.max(e.z, this.z + 20) + 22, t: 0 });
  }

  // ------------------------------------------------------------------ boss
  spawnBoss() {
    const type = this.E.boss, k = 1 + (this.stageN - 1) * 0.35;
    const B = { type, x: 0, y: type === 'walker' ? 0 : 13, z: this.z + 240, t: 0, parts: [], launch: 6, spin: 0, openK: 0 };
    const P = (o) => { o.max = o.hp = Math.round((o.hp || 0) * k); o.flash = 0; o.cool = this.r(1.5, 3); o.x = 0; o.y = 0; o.z = 0; B.parts.push(o); };
    if (type === 'carrier') {
      P({ id: 'podL', ox: -12.5, oy: -0.5, oz: -1, r: 2.9, hp: 24, gun: 'burst' }); P({ id: 'podR', ox: 12.5, oy: -0.5, oz: -1, r: 2.9, hp: 24, gun: 'burst' });
      P({ id: 'core', ox: 0, oy: 3.2, oz: -1.5, r: 2.9, hp: 45, gun: 'fan', core: true });
      P({ id: 'hull', ox: 0, oy: 0, oz: 0, r: 8, hull: true, hw: 13.5, hh: 2.3, hd: 8.5 });
    } else if (type === 'walker') {
      P({ id: 'armL', ox: -8.2, oy: 18.5, oz: -3, r: 2.5, hp: 20, gun: 'burst' }); P({ id: 'armR', ox: 8.2, oy: 18.5, oz: -3, r: 2.5, hp: 20, gun: 'burst' });
      P({ id: 'head', ox: 0, oy: 24.4, oz: -1.4, r: 2.4, hp: 16, gun: 'aim' });
      P({ id: 'core', ox: 0, oy: 20, oz: -4.6, r: 2.5, hp: 45, gun: 'fan', core: true });
      P({ id: 'hull', ox: 0, oy: 20, oz: 0, r: 5.8, hull: true, hw: 6.4, hh: 3.3, hd: 4.2 });
    } else {
      for (let i = 0; i < 4; i++) P({ id: 'pan' + i, a: (i * Math.PI) / 2, ox: 0, oy: 0, oz: -1, r: 3.2, hp: 12, gun: 'aim', panel: true });
      P({ id: 'core', ox: 0, oy: 0, oz: 0, r: 4.6, hp: 60, gun: 'ring', core: true });
    }
    B.max = B.parts.reduce((a, p) => a + p.max, 0);
    this.boss = B;
    this.msg = { a: 'WARNING', b: BOSSES[type], t: 2.8, warn: true };
  }
  stepBoss(dt) {
    const B = this.boss, z = this.z;
    B.t += dt;
    const want = B.type === 'walker' ? 70 : 62, rel = B.z - z;
    B.z += (SPEED + clamp((want - rel) * 1.2, -60, 20)) * dt;
    B.x = Math.sin(B.t * 0.42) * (B.type === 'walker' ? 6 : 10);
    if (B.type !== 'walker') B.y = 13 + Math.sin(B.t * 0.63) * 4;
    B.spin += dt * 0.8; B.openK += ((B.type === 'core' && Math.sin(B.t * 0.7) > 0.45 ? 1 : 0) - B.openK) * Math.min(1, dt * 3);
    const guards = B.parts.filter((p) => !p.dead && !p.hull && !p.core).length;
    for (const p of B.parts) {
      if (p.panel) { const rr = lerp(7.6, 12.5, B.openK), a = p.a + B.spin; p.ox = Math.cos(a) * rr; p.oy = Math.sin(a) * rr; }
      p.x = B.x + p.ox; p.y = B.y + p.oy; p.z = B.z + p.oz;
      p.flash = Math.max(0, p.flash - dt);
      p.armored = p.hull || (p.core && guards > 0 && !(B.type === 'core' && B.openK > 0.5));
    }
    if (B.dying) {
      B.dying -= dt;
      if ((B.bt = (B.bt || 0) - dt) <= 0) { B.bt = 0.13; const p = B.parts[Math.floor(this.rng() * B.parts.length)]; this.boom(p.x + this.r(-3, 3), p.y + this.r(-3, 3), p.z, 1.6, this.foeCols); }
      if (B.dying <= 0) {
        for (const p of B.parts) this.boom(p.x, p.y, p.z, 2.6, this.foeCols);
        this.flashes.push({ x: B.x, y: B.y + (B.type === 'walker' ? 18 : 0), z: B.z, r: 30, life: 0.8, max: 0.8, c: [1, 0.85, 0.6] });
        const bonus = this.sHits * 10 + Math.round(this.shield) * 10;
        this.score += bonus; this.boss = null; this.clear = 0.001; this.whiteT = 0.35;
        this.msg = { a: 'STAGE CLEAR', b: `${this.sHits} HITS · BONUS ${bonus}`, c: this.E.label, t: 4.6 };
      }
      return;
    }
    if (rel > want + 30) return; // still flying in
    for (const p of B.parts) {
      if (p.dead || !p.gun || this.ship.dead > 0) continue;
      if (p.burst > 0 && (p.bt -= dt) <= 0) { this.enemyFire(p.x, p.y, p.z - p.r, 0, 66); p.burst--; p.bt = 0.15; }
      if ((p.cool -= dt) > 0) continue;
      if (p.gun === 'aim') { this.enemyFire(p.x, p.y, p.z - p.r, 0, 70); p.cool = 1.6; }
      else if (p.gun === 'burst') { p.burst = 3; p.bt = 0; p.cool = 2.6; }
      else if (p.gun === 'fan') { for (let i = -2; i <= 2; i++) this.enemyFire(p.x, p.y, p.z - p.r, i * 0.12, 56); p.cool = 3; }
      else if (p.gun === 'ring') { for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + B.t; this.eshots.push({ x: p.x, y: p.y, z: p.z - 2, vx: Math.cos(a) * 13, vy: Math.sin(a) * 13, vz: SPEED - 46, life: 3.4, big: 1 }); } p.cool = 3.4; }
      p.cool /= 1 + (this.stageN - 1) * 0.12;
    }
    if (B.type === 'carrier' && (B.launch -= dt) <= 0) {
      B.launch = 7;
      for (const sd of [-1, 1]) this.addFoe({ kind: 'dart', ai: 'hold', st: 'in', x: B.x + sd * 6, y: B.y - 2, z: B.z - 6, hold: this.r(36, 50), holdT: this.r(2.5, 3.5), wa: 2.5, wf: 1.2, side: sd });
    }
  }
  hitPart(p, n) {
    const B = this.boss;
    if (!B || p.dead || B.dying) return;
    p.flash = 0.06;
    if (p.armored) return;
    p.hp -= n * (this.mods.glass ? 2 : 1);
    if (p.hp > 0) return;
    p.dead = true; this.score += 300; this.pop(p.x, p.y + 3, p.z, '300'); this.boom(p.x, p.y, p.z, 2, this.foeCols);
    if (p.core) { B.dying = 2.8; this.hits++; this.sHits++; this.score += 1500 + 500 * this.stageN; this.pop(B.x, B.y + 8, B.z, 'DESTROYED'); }
  }
  bossParts() { return this.boss ? this.boss.parts.filter((p) => !p.dead).sort((a, b) => (a.hull ? 1 : 0) - (b.hull ? 1 : 0)) : []; }
  bossTarget() {
    const B = this.boss;
    if (!B || B.dying) return null;
    let best = null, bd = 1e9;
    for (const p of B.parts) if (!p.dead && !p.armored) { const d = Math.hypot(p.x - this.ship.x, p.y - this.ship.y) + (p.core ? 0 : 2); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  // ------------------------------------------------------------------ shots, pickups, effects
  stepShots(dt) {
    const z = this.z, parts = this.bossParts();
    for (const b of this.shots) {
      const z0 = b.z;
      let tgt = null, td = 1e9;
      for (const e of this.foes) { if (e.dead) continue; const dz = e.z - b.z; if (dz < 0 || dz > 100) continue; if (Math.hypot(e.x - b.x, e.y - b.y) < (e.ground ? 2.6 : 2.2) + dz * (e.ground ? 0.06 : 0.05) && dz < td) { td = dz; tgt = e; } }
      if (!tgt) for (const p of parts) { if (p.armored) continue; const dz = p.z - b.z; if (dz > 0 && dz < 110 && Math.hypot(p.x - b.x, p.y - b.y) < p.r + 1 + dz * 0.04) { tgt = p; break; } }
      if (tgt) { b.vx += clamp((tgt.x - b.x) * 14, -90, 90) * dt; b.vy += clamp((tgt.y - b.y) * 14, -90, 90) * dt; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += (SPEED + 230) * dt; b.life -= dt;
      for (const o of this.cols) if (b.z > o.z0 && z0 < o.z1 && this.hitCol(o, b.x, b.y, b.z, 0, this.t)) { b.life = 0; this.spark(b.x, b.y, b.z - 1, 2); break; }
      if (b.life <= 0) continue;
      for (const e of this.foes) { if (e.dead || e.z + e.r < z0 || e.z - e.r > b.z) continue; if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < (e.r + 0.4) ** 2) { b.life = 0; this.damage(e, b.dmg); break; } }
      if (b.life <= 0) continue;
      for (const p of parts) {
        if (p.hull) { if (Math.abs(b.x - p.x) < p.hw && Math.abs(b.y - p.y) < p.hh && b.z > p.z - p.hd && z0 < p.z + p.hd) { b.life = 0; this.spark(b.x, b.y, p.z - p.hd, 2); break; } continue; }
        if (p.z + p.r < z0 || p.z - p.r > b.z) continue; if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (p.r + 0.4) ** 2) { b.life = 0; if (p.armored) this.spark(b.x, b.y, p.z - p.r, 2); this.hitPart(p, b.dmg); break; } }
    }
    this.shots = this.shots.filter((b) => b.life > 0);
    const s = this.ship, rad = 1.15 * this.S + 0.55;
    for (const b of this.eshots) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
      if (s.dead > 0 || b.back) continue;
      const dx = b.x - s.x, dy = b.y - s.y, dz = b.z - z;
      if (dx * dx + dy * dy + dz * dz < rad * rad) {
        if (s.roll > 0) { b.back = 1; b.vx = -b.vx + this.r(-20, 20); b.vy = this.r(8, 24); b.vz = SPEED + 70; this.spark(b.x, b.y, b.z, 2); }
        else { b.life = 0; this.spark(b.x, b.y, b.z, 3); this.hurt(9); }
      }
    }
    this.eshots = this.eshots.filter((b) => b.life > 0 && b.z > z - 15);
    for (const b of this.bombsF) {
      b.z += (SPEED + 95) * dt; b.life -= dt;
      let hit = b.life <= 0;
      if (!hit) for (const e of this.foes) if (!e.dead && Math.abs(e.z - b.z) < 3 && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 1.5) { hit = true; break; }
      if (!hit) for (const p of parts) if (Math.abs(p.z - b.z) < p.r + 1 && Math.hypot(p.x - b.x, p.y - b.y) < p.r + 1.5) { hit = true; break; }
      if (!hit) for (const o of this.cols) if (this.hitCol(o, b.x, b.y, b.z, 0.5, this.t)) { hit = true; break; }
      if (hit) { b.life = -1; this.blast(b.x, b.y, b.z); }
    }
    this.bombsF = this.bombsF.filter((b) => b.life > -0.5);
  }
  blast(x, y, z) {
    const R2 = 26;
    this.flashes.push({ x, y, z, r: R2 * 0.8, life: 0.7, max: 0.7, c: [0.75, 0.35, 0.65] });
    for (const e of this.foes) if (!e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 + (e.z - z) ** 2 < R2 * R2) this.damage(e, 6);
    for (const p of this.bossParts()) if (!p.armored && (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 < (R2 + p.r) ** 2) this.hitPart(p, 8);
    this.eshots = this.eshots.filter((b) => (b.x - x) ** 2 + (b.y - y) ** 2 + (b.z - z) ** 2 > (R2 + 6) ** 2);
    this.shake = 0.5; this.whiteT = 0.22;
  }
  stepPickups(dt) {
    const s = this.ship, z = this.z;
    for (const g of this.rings) {
      if (g.done) { g.tt += dt; continue; }
      if (z < g.z) continue;
      g.done = true; g.tt = 0;
      if (s.dead <= 0 && Math.hypot(s.x - g.x, s.y - g.y) < g.r + 0.3) { g.ok = true; const v = g.gold ? 100 : 50; this.score += v; this.shield = Math.min(100, this.shield + (g.gold ? 10 : 5)); this.pop(g.x, g.y + g.r + 1.5, g.z + 6, g.gold ? `GOLD +${v}` : `+${v}`); }
    }
    this.rings = this.rings.filter((g) => g.z > z - 8);
    for (const it of this.items) {
      it.t += dt;
      if (s.dead > 0 || Math.abs(it.z - z) > 2.4 || Math.hypot(it.x - s.x, it.y - s.y) > 2.8) continue;
      it.got = true;
      if (it.k === 'twin') { this.laser = Math.min(2, this.laser + 1); this.pop(it.x, it.y + 2.5, it.z + 8, this.laser === 2 ? 'HYPER LASER' : 'TWIN LASER'); }
      else if (it.k === 'bomb') { this.bombs = Math.min(9, this.bombs + 1); this.pop(it.x, it.y + 2.5, it.z + 8, 'BOMB +1'); }
      else { this.shield = Math.min(100, this.shield + 45); this.pop(it.x, it.y + 2.5, it.z + 8, 'SHIELD'); }
      this.score += 100;
    }
    this.items = this.items.filter((it) => !it.got && it.z > z - 8);
  }
  boom(x, y, z, size = 1, cols) {
    const n = Math.round((8 + size * 6) * (this.mods.party ? 1.8 : 1));
    for (let i = 0; i < n; i++) this.debris.push({ x, y, z, vx: this.r(-14, 14) * size, vy: this.r(-6, 18) * size, vz: SPEED * 0.6 + this.r(-12, 12) * size, rx: this.r(0, TAU), ry: this.r(0, TAU), sx: this.r(-9, 9), sy: this.r(-9, 9), s: this.r(0.3, 0.8) * Math.sqrt(size), life: this.r(0.7, 1.4), c: this.mods.party ? [this.rng(), this.rng(), this.rng()] : cols[i % cols.length] });
    this.flashes.push({ x, y, z, r: 1.5 * size, life: 0.36, max: 0.36, c: [0.95, 0.6, 0.25] });
    if (this.debris.length > 300) this.debris.splice(0, this.debris.length - 300);
    this.shake = Math.max(this.shake, Math.min(0.35, 0.08 * size));
  }
  spark(x, y, z, n = 3) {
    for (let i = 0; i < n; i++) this.debris.push({ x, y, z, vx: this.r(-10, 10), vy: this.r(-4, 12), vz: SPEED * 0.8 + this.r(-6, 6), rx: 0, ry: 0, sx: 12, sy: 9, s: 0.25, life: this.r(0.25, 0.5), c: [1, 0.9, 0.5] });
    this.flashes.push({ x, y, z, r: 0.9, life: 0.15, max: 0.15, c: [1, 0.95, 0.7] });
  }
  pop(x, y, z, txt) { this.pops.push({ x, y, z, txt, life: 1 }); if (this.pops.length > 12) this.pops.shift(); }
  stepFx(dt) {
    const floor = !this.E.space;
    for (const d of this.debris) {
      d.vy -= 32 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.life -= dt;
      if (floor && d.y < 0.2) { d.y = 0.2; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; d.sx *= 0.7; d.sy *= 0.7; }
    }
    this.debris = this.debris.filter((d) => d.life > 0);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);
    for (const p of this.pops) { p.life -= dt * 1.1; p.z += SPEED * dt; }
    this.pops = this.pops.filter((p) => p.life > 0);
  }

  // ------------------------------------------------------------------ autopilot: dodge, line up, shoot
  autopilot(dt) {
    const s = this.ship;
    if (!this.ready || s.dead > 0 || this.clear) { this.firing = false; return; }
    if ((this.apT -= dt) <= 0) { this.apT = 0.1; this.plan(); }
    this.aim.x += clamp(this.ap.x - this.aim.x, -42 * dt, 42 * dt);
    this.aim.y += clamp(this.ap.y - this.aim.y, -34 * dt, 34 * dt);
    let want = false;
    for (const e of this.foes) {
      if (e.dead) continue;
      const rel = e.z - this.z, tol = e.r + 1.2 + rel * 0.025;
      if (rel > 6 && rel < 170 && Math.abs(e.x - s.x) < tol && Math.abs(e.y - s.y) < tol + (e.ground ? 2 : 0)) { want = true; break; }
    }
    const bt = this.bossTarget();
    if (bt && bt.z - this.z < 140 && Math.hypot(bt.x - s.x, bt.y - s.y) < bt.r + 2.5) want = true;
    if (want) this.fireHold = 0.3 + this.rng() * 0.2;
    this.fireHold -= dt; this.firing = this.fireHold > 0;
    this.apBomb -= dt;
    if (this.bombs > 0 && this.apBomb <= 0) {
      const near = this.foes.filter((e) => !e.dead && e.z - this.z > 15 && e.z - this.z < 90).length;
      const threats = this.eshots.filter((b) => !b.back && b.z - this.z > 0 && b.z - this.z < 40).length;
      if (near >= 4 || (bt && this.bombs > 1 && bt.z - this.z < 95 && this.rng() < 0.01) || (this.shield < 35 && threats >= 3)) { this.bomb(); this.apBomb = 6; }
    }
  }
  plan() {
    const s = this.ship, z = this.z, t0 = this.t, horizon = z + SPEED * 1.3 + 8;
    const cols = this.cols.filter((o) => o.z1 > z - 3 && o.z0 < horizon);
    const shots = this.eshots.filter((b) => !b.back && b.z > z - 4 && b.z < z + 140);
    const foes = this.foes.filter((e) => !e.dead && e.z > z - 6 && e.z < z + 200);
    const TS = [0.08, 0.2, 0.35, 0.5, 0.7, 0.9, 1.15], bt = this.bossTarget();
    let best = null, bc = 1e9, threat = false;
    const tryC = (cx, cy, cur) => {
      let cost = 0;
      const dx = cx - s.x, dy = cy - s.y, dist = Math.hypot(dx, dy) || 1e-6;
      for (const t of TS) {
        const k = Math.min(dist, 40 * Math.max(0, t - 0.04)) / dist, px = s.x + dx * k, py = s.y + dy * k, pz = z + SPEED * t, w = 1.3 - t * 0.7;
        for (const o of cols) if (pz > o.z0 - 2 && pz < o.z1 + 2 && this.hitCol(o, px, py, pz, 1.6, t0 + t)) { cost += 80 * w; break; }
        for (const b of shots) { const bx = b.x + b.vx * t - px, by = b.y + b.vy * t - py, bz = b.z + b.vz * t - pz; if (bx * bx + by * by + bz * bz < 7) { cost += 30 * w; if (cur && t < 0.45) threat = true; } }
        for (const e of foes) { const ex = e.x + e.vx * t - px, ey = e.y + e.vy * t - py, ez = e.z + e.vz * t - pz, rr = e.r + 2; if (ex * ex + ey * ey + ez * ez < rr * rr) cost += 25 * w; }
      }
      const at = (t) => { const k = Math.min(dist, 40 * Math.max(0, t - 0.04)) / dist; return [s.x + dx * k, s.y + dy * k]; };
      for (const g of this.rings) { if (g.done) continue; const t = (g.z - z) / SPEED; if (t < 0.12 || t > 1.7) continue; const [px, py] = at(t); if (Math.hypot(px - g.x, py - g.y) < 2.8) cost -= g.gold ? 18 : 13; }
      for (const it of this.items) { const t = (it.z - z) / SPEED; if (t < 0.12 || t > 1.8) continue; const [px, py] = at(t); if (Math.hypot(px - it.x, py - it.y) < 2.2) cost -= 22; }
      for (const e of foes) { const rel = e.z - z; if (rel < 12 || rel > 150 || e.st === 'out') continue; const ex = e.x + (e.vx * rel) / 230, ey = e.y + (e.vy * rel) / 230; if (Math.abs(cx - ex) < 2.6 && Math.abs(cy - ey) < (e.ground ? 4 : 2.6)) cost -= (e.ground ? 5 : 7) * (1 - rel / 200); }
      if (bt) { const d = Math.hypot(cx - bt.x, cy - bt.y); cost += d < bt.r ? -9 : d * 0.12; }
      cost += dist * 0.05 + Math.hypot(cx - this.ap.x, cy - this.ap.y) * 0.04 + Math.abs(cx) * 0.012 + Math.abs(cy - 12) * 0.02;
      if (cost < bc) { bc = cost; best = { x: cx, y: cy }; }
    };
    tryC(this.ap.x, this.ap.y, true);
    for (let x = -XM; x <= XM + 0.01; x += 3) for (let y = Y0 + 0.4; y <= Y1; y += 3) tryC(x, y, false);
    tryC(s.x, s.y, false);
    this.ap = { x: clamp(best.x + this.r(-0.3, 0.3), -XM, XM), y: clamp(best.y + this.r(-0.3, 0.3), Y0, Y1) };
    if (threat && this.rollCd <= 0 && this.rng() < 0.6) this.barrel();
  }

  // ------------------------------------------------------------------ input: drag to steer (relative), hold to fire
  bombBtn(x, y) { return !this.auto && Math.hypot(x - (W - 38), y - (H - 44)) < 27; }
  down(x, y, id) {
    if (this.bombBtn(x, y)) { this.bomb(); return; }
    if (this.drag) return;
    const lt = this.lastTap;
    if (lt && this.t - lt.t < 0.32 && Math.hypot(x - lt.x, y - lt.y) < 40) { this.barrel(); this.lastTap = null; }
    this.drag = { id, x, y, t: this.t, moved: 0 };
    this.firing = true;
  }
  move(x, y, id) {
    const d = this.drag;
    if (!d || (id !== undefined && d.id !== undefined && id !== d.id)) return;
    const dx = x - d.x, dy = y - d.y;
    d.x = x; d.y = y; d.moved += Math.abs(dx) + Math.abs(dy);
    this.aim.x = clamp(this.aim.x + dx * 0.16, -XM, XM); this.aim.y = clamp(this.aim.y - dy * 0.13, Y0, Y1);
  }
  up(x, y, id) {
    const d = this.drag;
    if (!d || (id !== undefined && d.id !== undefined && id !== d.id)) return;
    if (d.moved < 12 && this.t - d.t < 0.3) this.lastTap = { t: this.t, x, y };
    this.drag = null; this.firing = false;
  }
  setAuto(a) { super.setAuto(a); this.drag = null; this.firing = false; this.lastTap = null; if (!a) this.hint = 3.5; }

  // ------------------------------------------------------------------ GPU side
  start() {
    const i = live.indexOf(this); if (i >= 0) live.splice(i, 1); live.push(this);
    while (live.length > 2) { const old = live.find((g) => g !== this && !g.running); if (!old) break; old.dropGpu(); }
    super.start();
  }
  dropGpu(lost = false) {
    const i = live.indexOf(this); if (i >= 0) live.splice(i, 1);
    const gl = this.gl; this.gl = null;
    for (const e of this.foes) { e.m = null; e.legs = null; e.barrel = null; }
    for (const g of this.rings) g.m = null;
    for (const it of this.items) it.m = null;
    if (this.boss) { this.boss.m = null; for (const p of this.boss.parts) p.m = null; }
    for (const c of this.chunks.values()) for (const m of c.mv) m.m = null;
    if (!gl || lost) return;
    const seen = new Set(), free = (o) => { if (!o || seen.has(o)) return; seen.add(o); if (o.dispose) o.dispose(); else if (typeof o === 'object') for (const v of Object.values(o)) free(v); };
    gl.scene.traverse((o) => free(o.geometry));
    free(gl.geo); free(gl.mats);
  }
  buildGpu() {
    if (!live.includes(this)) live.push(this);
    const E = this.E, sc = new T.Scene();
    const gl = { scene: sc, geo: {}, mats: [], chunks: new Map(), ents: new Set() };
    this.gl = gl;
    const fog = new T.Color(E.fog);
    sc.fog = new T.Fog(fog, E.fogD[0], E.fogD[1]); sc.background = fog;
    gl.cam = new T.PerspectiveCamera(56, RW / RH, 0.5, 1400);
    sc.add(new T.HemisphereLight(E.hemi[0], E.hemi[1], E.hemi[2]));
    const sun = new T.DirectionalLight(E.sun[0], E.sun[1]); sun.position.set(-0.45, 0.8, 0.4); sc.add(sun);
    gl.root = new T.Group(); gl.root.scale.z = -1; sc.add(gl.root); // game space has z ahead; three looks down -z
    gl.lit = retro(new T.MeshLambertMaterial({ vertexColors: true }));
    gl.glow = retro(new T.MeshBasicMaterial({ vertexColors: true }));
    gl.hot = new T.MeshBasicMaterial({ vertexColors: true, fog: false });
    gl.white = new T.MeshBasicMaterial({ color: '#ffffff', fog: false });
    gl.mats.push(gl.lit, gl.glow, gl.hot, gl.white);
    gl.tm = new T.Matrix4(); gl.tq = new T.Quaternion(); gl.te = new T.Euler(); gl.tv = new T.Vector3(); gl.ts = new T.Vector3(); gl.tc = new T.Color();
    gl.cLaser = new T.Color('#62ff5a'); gl.cHyper = new T.Color('#7ad8ff'); gl.cShotA = new T.Color('#ff3a8a'); gl.cShotB = new T.Color('#ffd040');
    this.buildSky(gl); this.buildGround(gl); this.buildModels(gl); this.buildPools(gl); this.buildWeather(gl);
  }
  buildSky(gl) {
    const E = this.E, sky = new T.Group(), P = new Poly(), Rr = 900, rows = 9, n = 20;
    const top = lin(E.sky[0]), mid = lin(E.sky[1]), hor = lin(E.sky[2]), fog = lin(E.fog);
    const pt = (az, el, r = Rr) => [Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r];
    const band = (u) => (u < 0.5 ? mix(hor, mid, u * 2) : mix(mid, top, u * 2 - 1));
    for (let r = -1; r < rows; r++) {
      const e0 = r < 0 ? -Math.PI / 2 : ((r / rows) ** 1.6 * Math.PI) / 2, e1 = (((r + 1) / rows) ** 1.6 * Math.PI) / 2, col = r < 0 ? fog : band(r / (rows - 1));
      for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; P.face([pt(a0, e0), pt(a1, e0), pt(a1, e1), pt(a0, e1)], col); }
    }
    const dome = mesh(P.geo(), new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, fog: false, depthWrite: false }));
    dome.renderOrder = -4; sky.add(dome); gl.mats.push(dome.material);
    const R = mulberry32(this.tileSeed * 7 + 3), back = new Poly(), backG = new Poly();
    // clouds: flat polygons pinned to the sky
    for (let q = 0; q < Math.round((E.clouds || 0) * 12); q++) {
      const az = (R() - 0.5) * 2.4, el = 0.05 + R() * 0.3, w = 40 + R() * 90, h = 12 + R() * 20, c = pt(az, el, 860), rx = Math.cos(az), rz = -Math.sin(az), col = mix(band(Math.min(1, el * 2.5)), WHITE, 0.6);
      back.face(Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * TAU, k = 0.75 + R() * 0.35; return [c[0] + rx * Math.cos(a) * w * k, c[1] + Math.sin(a) * h * k, c[2] + rz * Math.cos(a) * w * k]; }), col);
    }
    // horizon silhouettes: skyline, mesas, hills, peaks or volcanoes
    if (E.hz) {
      const [kind, hex] = E.hz, base = mix(hor, lin(hex), 0.55), N = 90, hs = [];
      let run = 0, h = 0;
      for (let i = 0; i < N; i++) {
        if (kind === 'skyline') { if (run-- <= 0) { run = 1 + Math.floor(R() * 3); h = R() < 0.2 ? 0.004 : 0.012 + R() * 0.05; } }
        else if (kind === 'mesas') { if (run-- <= 0) { run = 1 + Math.floor(R() * 5); h = R() < 0.45 ? 0.004 : 0.02 + R() * 0.035; } }
        else if (kind === 'hills') h = 0.014 + 0.016 * (Math.sin(i * 0.31 + this.tileSeed) + 1) + 0.008 * Math.sin(i * 0.87);
        else if (kind === 'peaks') h = 0.015 + (i % 2 ? R() * 0.07 : R() * 0.02);
        else h = 0.006 + R() * 0.012;
        hs.push(h);
      }
      const stepped = kind === 'skyline' || kind === 'mesas';
      for (let i = 0; i < N; i++) { const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU; back.face([pt(a0, -0.03, 820), pt(a1, -0.03, 820), pt(a1, stepped ? hs[i] : hs[(i + 1) % N], 820), pt(a0, hs[i], 820)], mul(base, 0.94 + R() * 0.1)); }
      if (kind === 'volcanoes') for (let q = 0; q < 6; q++) { const a = (R() - 0.5) * 3, w = 0.08 + R() * 0.06, hh = 0.05 + R() * 0.05; back.face([pt(a - w, -0.03, 815), pt(a + w, -0.03, 815), pt(a + w * 0.18, hh, 815), pt(a - w * 0.18, hh, 815)], mul(base, 0.8)); backG.face([pt(a - w * 0.18, hh, 814), pt(a + w * 0.18, hh, 814), pt(a + w * 0.1, hh + 0.008, 814), pt(a - w * 0.1, hh + 0.008, 814)], lin(E.lava)); }
    }
    if (back.v.length) { const m = mesh(back.geo(), new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, fog: false, depthWrite: false })); m.renderOrder = -3; sky.add(m); gl.mats.push(m.material); }
    if (backG.v.length) { const m = mesh(backG.geo(), new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, fog: false, depthWrite: false })); m.renderOrder = -3; sky.add(m); gl.mats.push(m.material); }
    if (E.space) {
      const sp = [];
      for (let i = 0; i < 420; i++) { const az = R() * TAU, el = Math.asin(R() * 2 - 1), p = pt(az, el, 880); sp.push(...p); }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
      const stars = new T.Points(sg, new T.PointsMaterial({ color: '#dfe6ff', size: 1.5, sizeAttenuation: false, fog: false, depthWrite: false }));
      stars.renderOrder = -3; sky.add(stars); gl.mats.push(stars.material);
      // a banded gas giant with a ring
      const pl = new Poly(), bands = ['#c8794a', '#e0a46a', '#a85a3a', '#d89060', '#b86a44'].map(lin), cpos = [230, 150, 640], rad = 120;
      for (let a = 0; a < 8; a++) for (let b = 0; b < 14; b++) {
        const e0 = -Math.PI / 2 + (a / 8) * Math.PI, e1 = -Math.PI / 2 + ((a + 1) / 8) * Math.PI, z0 = (b / 14) * TAU, z1 = ((b + 1) / 14) * TAU;
        const q = (az, el) => { const v = pt(az, el, rad); return [v[0] + cpos[0], v[1] + cpos[1], v[2] + cpos[2]]; };
        const c = pt((z0 + z1) / 2, (e0 + e1) / 2, 1);
        pl.face(a === 0 || a === 7 ? [q(z0, e0 + (a ? 0 : 1e-3)), q(z1, a ? e0 : e1), q(a ? z0 : z1, e1 - (a ? 1e-3 : 0))] : [q(z0, e0), q(z1, e0), q(z1, e1), q(z0, e1)], bands[a % bands.length], c);
      }
      const ringM = then(xf(0, 0, 0, 1, 1, 1, 0, Math.PI / 2 - 0.35, 0.3), xf(cpos[0], cpos[1], cpos[2]));
      ringPoly(pl, 230, 60, 2, lin('#e6c08a'), 24, ringM);
      const planet = mesh(pl.geo(), retro(new T.MeshLambertMaterial({ vertexColors: true, fog: false, depthWrite: false, side: T.DoubleSide })));
      planet.renderOrder = -2; sky.add(planet); gl.mats.push(planet.material);
    }
    gl.root.add(sky); gl.sky = sky;
  }
  groundTile(i, j) {
    const h = hash(i + this.tileSeed, j), k = this.envKey, ch = (i + j) & 1;
    if (k === 'city') { if (i >= -2 && i <= 1) return j % 2; if (i === -3 || i === 2) return 2; if (j === 0) return 0; return h < 0.12 ? 4 : ch ? 2 : 3; }
    if (k === 'desert') return h < 0.08 ? 2 : h > 0.95 ? 3 : ch;
    if (k === 'forest') { const f = [0, 1, 2, 4, 0, 1, 3][Math.floor(hash((i >> 1) + this.tileSeed, j >> 1) * 7)]; return f === 0 && ch ? 1 : f; }
    if (k === 'ocean') return h < 0.05 ? 2 : ch;
    return h < 0.06 ? 2 : ch;
  }
  buildGround(gl) {
    const E = this.E;
    if (E.space) return;
    const P = new Poly(), G = new Poly(), gc = E.ground.map(lin), per = 8, n = 6 * per, k = this.envKey;
    for (let j = 0; j < n; j++) {
      const jj = j % per, z0 = j * 10;
      for (let i = -20; i < 20; i++) {
        const x0 = i * 10, h = hash(i * 3 + this.tileSeed, jj + 17);
        P.flat(x0, z0, x0 + 10, z0 + 10, 0, gc[this.groundTile(i, jj)]);
        if (k === 'ocean' && h > 0.82) { const cx = x0 + 5, cz = z0 + 5, fc = lin(E.foam); P.face([[cx - 2.4, 0.04, cz - 0.8], [cx, 0.04, cz + 0.6], [cx, 0.04, cz + 1.1], [cx - 2.4, 0.04, cz - 0.3]], fc, [0, 1, 0]); P.face([[cx, 0.04, cz + 0.6], [cx + 2.4, 0.04, cz - 0.8], [cx + 2.4, 0.04, cz - 0.3], [cx, 0.04, cz + 1.1]], fc, [0, 1, 0]); }
        if (k === 'volcano' && h < 0.2 && Math.abs(i * 10 + 5) > 6) { if (h < 0.04) G.flat(x0 + 1, z0 + 1, x0 + 9, z0 + 9, 0.03, lin(E.lava)); else if (h < 0.12) G.flat(x0, z0 + 4.7, x0 + 10, z0 + 5.3, 0.03, lin(E.lava)); else G.flat(x0 + 4.7, z0, x0 + 5.3, z0 + 10, 0.03, lin(E.lava)); }
        if (k === 'ice' && h < 0.14) { if (h < 0.07) P.flat(x0, z0 + 4.8, x0 + 10, z0 + 5.2, 0.03, lin(E.crack)); else P.flat(x0 + 4.8, z0, x0 + 5.2, z0 + 10, 0.03, lin(E.crack)); }
      }
      if (k === 'city' && jj % 2 === 0) for (const x of [-10, 0, 10]) P.flat(x - 0.35, z0 + 2, x + 0.35, z0 + 7, 0.03, lin(E.mark));
      if (k === 'city' && jj === 0) for (const s of [-1, 1]) for (let q = 0; q < 4; q++) P.flat(s * 21 + q * 1.4 * s - 0.4, z0 + 1, s * 21 + q * 1.4 * s + 0.4, z0 + 9, 0.03, lin('#c8ccd2'));
    }
    const g = new T.Group();
    g.add(mesh(P.geo(), gl.lit));
    if (G.v.length) g.add(mesh(G.geo(), gl.glow));
    gl.root.add(g); gl.ground = g;
  }
  geoPair(P, G) { return [P.geo(), G && G.v.length ? G.geo() : null]; }
  buildModels(gl) {
    const geo = gl.geo, [c0, c1, c2] = this.E.foe.map(lin), dark = lin('#3a3e48');
    // the player's ship: white fuselage, swept wings, upturned wingtip blades in the theme's accent
    {
      const S = new Poly(), Sg = new Poly(), body = lin('#e8eaf2'), wing = lin('#c3c9d8'), acc = lin(this.accent), glass = lin('#2a50c0');
      S.solid([[[0, 0.05, 2.5], [0, 0.55, -0.3], [0, -0.38, -0.25], [-0.62, 0.02, -0.55], [0.62, 0.02, -0.55], [0, 0.12, -1.75]], HULLF], ID, (ny, f) => (f < 4 ? body : mul(body, 0.9)));
      S.solid(OCTS, xf(0, 0.4, 0.3, 0.55, 0.5, 1.7), glass);
      S.solid(BOXS, xf(0, 0.38, -0.95, 0.3, 0.14, 0.9), acc);
      for (const sd of [-1, 1]) {
        prism3(S, [sd * 0.35, 0.07, 0.55], [sd * 0.5, 0.07, -1.15], [sd * 2.55, -0.25, -1.1], [0, -0.12, 0], wing);
        prism3(S, [sd * 2.4, -0.28, -0.5], [sd * 2.5, -0.33, -1.25], [sd * 2.68, 0.6, -1.4], [sd * 0.1, 0, 0], acc);
      }
      S.solid(BOXS, xf(0, 0.12, -1.72, 0.5, 0.3, 0.24), dark);
      Sg.solid(BOXS, xf(0, 0.12, -1.85, 0.3, 0.16, 0.04), lin('#c8f8ff'));
      geo.ship = this.geoPair(S, Sg);
      const F = new Poly(); F.solid(cylS(5, 0), xf(0, 0, -0.45, 0.26, 0.9, 0.18, 0, -Math.PI / 2), lin('#a8f0ff')); geo.flame = F.geo();
      const Sh = new Poly(); Sh.face([[0, 0, 2.2], [2.6, 0, -1.1], [0, 0, -1.6], [-2.6, 0, -1.1]], WHITE, [0, 1, 0]); geo.shadow = Sh.geo();
      const g = new T.Group(); g.rotation.order = 'YXZ';
      g.add(mesh(geo.ship[0], gl.lit), mesh(geo.ship[1], gl.glow));
      gl.flame = mesh(geo.flame, gl.hot); gl.flame.position.set(0, 0.12, -1.9); g.add(gl.flame);
      gl.ship = g; gl.root.add(g);
      gl.shadow = new T.Mesh(geo.shadow, new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false, side: T.DoubleSide }));
      gl.mats.push(gl.shadow.material); gl.root.add(gl.shadow);
    }
    const P = () => new Poly();
    let A, B;
    // dart fighter
    A = P(); B = P();
    A.solid([[[0, 0, 1.9], [0, 0.42, -0.2], [0, -0.3, -0.2], [-0.5, 0, -0.4], [0.5, 0, -0.4], [0, 0.05, -1.3]], HULLF], ID, c0);
    for (const sd of [-1, 1]) prism3(A, [sd * 0.3, 0.05, 0.7], [sd * 0.4, 0.05, -0.9], [sd * 2.2, 0.4, -1.25], [0, -0.1, 0], c1);
    prism3(A, [-0.04, 0.3, -0.3], [-0.04, 0.3, -1.25], [-0.04, 1.1, -1.35], [0.08, 0, 0], c1);
    B.solid(BOXS, xf(0, 0.26, 0.6, 0.3, 0.14, 0.5), c2);
    geo.dart = this.geoPair(A, B);
    // saucer
    A = P(); B = P();
    A.solid(cylS(8, 0.72), xf(0, -0.05, 0, 3.8, 0.5, 3.8), c1);
    A.solid(cylS(8, 0.45), xf(0, 0.5, 0, 2, 0.65, 2), c0);
    A.solid(cylS(8, 0), xf(0, -0.6, 0, 2.6, 0.6, 2.6, 0, Math.PI), c0);
    B.solid(cylS(8, 1), xf(0, -0.08, 0, 3.86, 0.14, 3.86), c2);
    geo.saucer = this.geoPair(A, B);
    // bat
    A = P(); B = P();
    A.solid([[[0, 0, 1.4], [0, 0.4, -0.2], [0, -0.3, -0.1], [-0.55, 0, -0.3], [0.55, 0, -0.3], [0, 0.05, -1.1]], HULLF], ID, c0);
    for (const sd of [-1, 1]) { prism3(A, [sd * 0.4, 0.05, 0.5], [sd * 0.5, 0.05, -0.8], [sd * 2.4, 0.3, -0.2], [0, -0.1, 0], c1); prism3(A, [sd * 2.4, 0.3, -0.2], [sd * 2.2, 0.3, -0.9], [sd * 3.1, -0.7, -0.9], [0, -0.1, 0], c1); }
    for (const sd of [-1, 1]) B.solid(BOXS, xf(sd * 0.22, 0.14, 1.0, 0.18, 0.12, 0.2), c2);
    geo.bat = this.geoPair(A, B);
    // turret (origin on the ground) and its barrel
    A = P(); B = P();
    A.solid(cylS(8, 0.8), xf(0, 0.6, 0, 3.4, 1.2, 3.4), dark);
    A.solid(cylS(8, 0.45), xf(0, 1.65, 0, 2.6, 1.0, 2.6), c0);
    geo.turret = this.geoPair(A, null);
    A = P(); B = P();
    A.solid(BOXS, xf(0, 0, 1.1, 0.4, 0.4, 2.2), dark); B.solid(BOXS, xf(0, 0, 2.25, 0.3, 0.3, 0.1), c2);
    geo.barrel = this.geoPair(A, B);
    // walker body (origin on the ground) and one leg (origin at the hip)
    A = P(); B = P();
    A.solid(BOXS, xf(0, 4.7, 0, 2.6, 1.5, 2.4), c0);
    A.solid(WEDS, xf(0, 4.7, 1.55, 2.4, 1.0, 1.3, 0, Math.PI / 2), c1);
    for (const sd of [-1, 1]) A.solid(BOXS, xf(sd * 0.95, 4.0, 1.4, 0.35, 0.35, 1.4), dark);
    B.solid(BOXS, xf(0, 5.1, 1.25, 1.4, 0.3, 0.3), c2);
    geo.walker = this.geoPair(A, B);
    A = P();
    A.solid(BOXS, xf(0, -1.0, 0, 0.55, 2.1, 0.6), c1); A.solid(BOXS, xf(0, -2.9, -0.2, 0.45, 2.0, 0.45), c0); A.solid(BOXS, xf(0, -3.85, 0.25, 0.95, 0.3, 1.5), dark);
    geo.leg = this.geoPair(A, null);
    // gunboat (origin at the waterline)
    A = P(); B = P();
    A.solid(BOXS, xf(0, 0.45, -0.4, 2.6, 1.1, 4.4), c1);
    A.solid([[[-1.3, 1.0, 1.8], [1.3, 1.0, 1.8], [0, 1.0, 3.7], [-1.0, -0.1, 1.8], [1.0, -0.1, 1.8], [0, 0.3, 3.4]], PRF], ID, c1);
    A.solid(BOXS, xf(0, 1.55, -1, 1.6, 1.1, 1.8), c0); A.solid(BOXS, xf(0, 2.2, 0.6, 0.3, 0.3, 1.8), dark);
    B.solid(BOXS, xf(0, 1.75, -0.08, 1.4, 0.25, 0.08), c2);
    geo.boat = this.geoPair(A, B);
    // spiked mine
    A = P(); B = P();
    A.solid(ICOS, xf(0, 0, 0, 2.2, 2.2, 2.2), c0);
    for (const [rx, rz] of [[0, 0], [Math.PI, 0], [0, Math.PI / 2], [0, -Math.PI / 2], [Math.PI / 2, 0], [-Math.PI / 2, 0]]) A.solid(cylS(4, 0), then(xf(0, 1.45, 0, 0.6, 1.0, 0.6), xf(0, 0, 0, 1, 1, 1, 0, rx, rz)), c1);
    B.solid(cylS(8, 1), xf(0, 0, 0, 2.3, 0.25, 2.3), c2);
    geo.mine = this.geoPair(A, B);
    // rings and power-ups
    for (const gold of [0, 1]) geo['ring' + gold] = ringPoly(P(), 4.6, 0.8, 0.7, lin(gold ? '#ffd23a' : '#f4f7fc')).geo();
    for (const k of Object.keys(ITEMS)) { const c = lin(ITEMS[k][0]); A = P(); B = P(); A.solid(OCTS, xf(0, 0, 0, 2.0, 2.8, 2.0), (ny) => (ny > 0 ? c : mul(c, 0.7))); B.solid(cylS(8, 1), xf(0, 0, 0, 2.7, 0.3, 2.7), mix(c, WHITE, 0.5)); geo['item' + k] = this.geoPair(A, B); }
  }
  bossGeo(type) {
    const [c0, c1, c2] = this.E.foe.map(lin), dark = lin('#3a3e48'), out = {}, P = () => new Poly();
    let A, B;
    if (type === 'carrier') {
      A = P(); B = P();
      A.solid(cylS(6, 0.78), xf(0, 0, 0, 28, 3.6, 18), c1);
      A.solid(cylS(6, 0.55), xf(0, 2.4, 1.5, 15, 1.4, 10), mul(c1, 0.85));
      A.solid(cylS(6, 0), xf(0, -3.3, 0, 20, 3, 13, 0, Math.PI), mul(c1, 0.7));
      A.solid(BOXS, xf(0, 4.2, 4.5, 3.4, 3.4, 4), c1);
      for (const sd of [-1, 1]) { A.solid(BOXS, xf(sd * 9, 2.6, 5, 0.5, 3.4, 5), c0); B.solid(BOXS, xf(sd * 6, 0.2, -7.9, 3, 0.5, 0.2), c2); }
      B.solid(BOXS, xf(0, 4.6, 2.45, 2.6, 0.6, 0.1), c2);
      out.hull = this.geoPair(A, B);
      A = P(); B = P();
      A.solid(cylS(8, 1), xf(0, 0, 0, 4.4, 9, 4.4, 0, Math.PI / 2), c0); A.solid(cylS(8, 0), xf(0, 0, -5.6, 4.4, 2.2, 4.4, 0, -Math.PI / 2), c0);
      B.solid(OCTS, xf(0, 0, -6.5, 1.4, 1.4, 1.4), c2);
      out.pod = this.geoPair(A, B);
      A = P(); B = P();
      A.solid(cylS(8, 0.45), xf(0, 0, 0, 6, 2.8, 6), c0); B.solid(OCTS, xf(0, 0.4, -2.4, 1.8, 1.4, 1.4), c2);
      out.core = this.geoPair(A, B);
    } else if (type === 'walker') {
      A = P();
      A.solid(BOXS, xf(0, 20, 0, 12, 6, 8), c1); A.solid(BOXS, xf(0, 16.4, 0.5, 8, 2, 5), dark);
      for (const sd of [-1, 1]) { A.solid(BOXS, xf(sd * 6.6, 22.4, 0, 3, 2, 5), c0); A.solid(cylS(6, 1), xf(sd * 3, 25, 3, 1.2, 4, 1.2), dark); }
      out.hull = this.geoPair(A, null);
      A = P(); B = P(); A.solid(BOXS, xf(0, 0, 0, 4.4, 2.8, 4.4), c0); B.solid(BOXS, xf(0, 0.2, -2.25, 3.2, 0.7, 0.12), c2); out.head = this.geoPair(A, B);
      A = P(); B = P(); A.solid(BOXS, xf(0, 0, 0, 2.8, 2.8, 8), c0); A.solid(BOXS, xf(0, -0.4, -5, 0.9, 0.9, 2.2), dark); B.solid(BOXS, xf(0, -0.4, -6.15, 0.7, 0.7, 0.1), c2); out.arm = this.geoPair(A, B);
      A = P(); B = P(); A.solid(BOXS, xf(0, 0, 0.6, 4.4, 4.4, 1), dark); B.solid(OCTS, xf(0, 0, 0, 3.4, 3.4, 2.2), c2); out.core = this.geoPair(A, B);
      A = P(); A.solid(BOXS, xf(0, -4.5, 0, 2.4, 9, 2.4), c1); A.solid(BOXS, xf(0, -9.4, 0.8, 2.6, 1.4, 2.6), dark); A.solid(BOXS, xf(0, -12.6, 0, 2.0, 6.4, 2.0), c0); A.solid(BOXS, xf(0, -15.4, -1, 4.4, 1.2, 6.5), dark);
      out.leg = this.geoPair(A, null);
    } else {
      A = P(); B = P(); A.solid(ICOS, xf(0, 0, 0, 9.5, 9.5, 9.5), c0); B.solid(OCTS, xf(0, 0, -4.5, 3, 3, 1.6), c2); out.core = this.geoPair(A, B);
      A = P(); B = P(); A.solid(BOXS, xf(0, 0, 0, 6.4, 6.4, 1.4), c1); B.solid(BOXS, xf(0, 0, -0.75, 4.4, 0.6, 0.1), c2); out.panel = this.geoPair(A, B);
      out.halo = ringPoly(P(), 14, 0.7, 0.5, c2, 12).geo();
    }
    return out;
  }
  pool(gl, geo, mat, n) { const m = new T.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; gl.root.add(m); gl.mats.push(mat); gl.geo['pool' + gl.mats.length] = geo; return m; }
  buildPools(gl) {
    gl.lasers = this.pool(gl, new Poly().solid(BOXS, xf(0, 0, 0, 0.24, 0.24, 3.6)).geo(), new T.MeshBasicMaterial({ fog: false }), 96);
    gl.eshotM = this.pool(gl, new Poly().solid(OCTS, xf(0, 0, 0, 1.3, 1.3, 1.3)).geo(), new T.MeshBasicMaterial({ fog: false }), 220);
    gl.debrisM = this.pool(gl, new Poly().solid(TETS).geo(), retro(new T.MeshLambertMaterial()), 320);
    gl.flashM = this.pool(gl, new Poly().solid(ICOS).geo(), new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }), 40);
    gl.bombM = this.pool(gl, new Poly().solid(OCTS, xf(0, 0, 0, 1.4, 1.4, 1.4)).geo(), new T.MeshBasicMaterial({ color: '#ffd0e8', fog: false }), 8);
  }
  buildWeather(gl) {
    const k = this.E.weather;
    if (!k) return;
    const streak = k === 'dust' || k === 'sand', n = streak ? 160 : 240;
    gl.wx = { k, n, streak, p: Array.from({ length: n }, () => [(Math.random() - 0.5) * 90, Math.random() * 46, this.z + Math.random() * 150]) };
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(n * (streak ? 6 : 3)), 3));
    const col = { dust: '#9aa8d8', sand: '#f4e0b0', snow: '#ffffff', embers: '#ffa040' }[k];
    gl.wmesh = streak ? new T.LineSegments(g, new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.65, fog: false })) : new T.Points(g, new T.PointsMaterial({ color: col, size: k === 'snow' ? 2 : 1.6, sizeAttenuation: false, fog: false }));
    gl.wmesh.frustumCulled = false; gl.root.add(gl.wmesh); gl.mats.push(gl.wmesh.material);
  }
  buildChunk(gl, c) {
    const g = new T.Group(), P = new Poly(), G = new Poly();
    for (const o of c.st) prim(P, G, o);
    if (P.v.length) g.add(mesh(P.geo(), gl.lit));
    if (G.v.length) g.add(mesh(G.geo(), gl.glow));
    for (const m of c.mv) {
      const Q = new Poly();
      prim(Q, Q, { ...m.vis, x: 0, y: 0, z: 0, g: 0 });
      m.m = mesh(Q.geo(), m.vis.g ? gl.hot : gl.lit); m.m.rotation.order = 'YXZ'; g.add(m.m);
    }
    g.userData.mv = c.mv;
    gl.root.add(g);
    return g;
  }
  mkFoe(gl, e) {
    const g = new T.Group(), [a, b] = gl.geo[e.kind];
    g.rotation.order = 'YXZ';
    g.add(mesh(a, gl.lit)); if (b) g.add(mesh(b, gl.glow));
    if (e.kind === 'walker') e.legs = [-1, 1].map((sd) => { const l = mesh(gl.geo.leg[0], gl.lit); l.position.set(sd * 1.0, 3.95, 0); g.add(l); return l; });
    if (e.kind === 'turret') { const br = new T.Group(); br.rotation.order = 'YXZ'; br.add(mesh(gl.geo.barrel[0], gl.lit), mesh(gl.geo.barrel[1], gl.glow)); br.position.set(0, 1.9, 0); g.add(br); e.barrel = br; }
    if (e.gold) g.scale.setScalar(1.25);
    return g;
  }
  mkBoss(gl, B) {
    const geo = (gl.geo['boss-' + B.type] ||= this.bossGeo(B.type)), g = new T.Group(), add = (pair, parent = g) => { const q = new T.Group(); q.add(mesh(pair[0], gl.lit)); if (pair[1]) q.add(mesh(pair[1], gl.glow)); parent.add(q); return q; };
    if (geo.hull) add(geo.hull);
    if (B.type === 'walker') B.legs = [-1, 1].map((sd) => { const l = add(geo.leg); l.position.set(sd * 3.2, 16, 0); return l; });
    if (geo.halo) { B.halo = mesh(geo.halo, gl.glow); g.add(B.halo); }
    for (const p of B.parts) {
      if (p.hull) continue;
      const pair = p.panel ? geo.panel : p.core ? geo.core : B.type === 'carrier' ? geo.pod : p.id === 'head' ? geo.head : geo.arm;
      p.m = add(pair); p.eye = p.core && pair[1] ? p.m.children[1] : null;
    }
    B.m = g; gl.root.add(g);
  }
  syncChunks(gl) {
    const lo = Math.floor((this.z - 40) / CH), hi = Math.floor((this.z + VIEW) / CH);
    for (const [i, g] of gl.chunks) if (i < lo || i > hi) { gl.root.remove(g); g.traverse((o) => o.geometry?.dispose()); gl.chunks.delete(i); }
    let built = 0;
    for (let i = lo; i <= hi && built < (gl.warm ? 2 : 9); i++) if (!gl.chunks.has(i) && this.chunks.has(i)) { gl.chunks.set(i, this.buildChunk(gl, this.chunks.get(i))); built++; }
    gl.warm = true;
  }
  sync(gl) {
    const t = this.t, s = this.ship, seen = new Set(), white = gl.white;
    this.syncChunks(gl);
    for (const g of gl.chunks.values()) for (const m of g.userData.mv) {
      const o = m.col, q = m.m;
      if (!q) continue;
      if (o.t === 'sph') { q.position.set(o.x + (o.mx ? Math.sin(t * o.mf + o.mp) * o.mx : 0), o.y + (o.my ? Math.cos(t * o.mf + o.mp) * o.my : 0), o.z); q.rotation.set(t * m.sp[0], t * m.sp[1], t * m.sp[2]); }
      else if (o.t === 'bar') { q.position.set(o.x, o.y, o.z); q.rotation.set(0, 0, o.a0 + t * o.w); }
      else if (o.t === 'gey') { const h = this.geyH(o, t); q.visible = h > 0.3; q.position.set(o.x, h / 2, o.z); q.scale.set(1 + Math.sin(t * 20) * 0.08, Math.max(0.01, h / o.h), 1); }
    }
    if (gl.ground) gl.ground.position.z = Math.floor((this.z - 30) / CH) * CH;
    for (const e of this.foes) {
      if (e.dead || e.z - this.z > VIEW + 30) continue;
      if (!e.m) { e.m = this.mkFoe(gl, e); gl.root.add(e.m); }
      const m = e.m; seen.add(m);
      flashG(m, e.flash > 0, white);
      if (e.kind === 'turret') {
        m.position.set(e.x, e.base, e.z);
        const dx = s.x - e.x, dz = this.z - e.z, dy = s.y - (e.base + 1.9);
        e.barrel.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0);
      } else if (e.kind === 'walker') {
        m.position.set(e.x, Math.abs(Math.sin(e.t * 5)) * 0.25, e.z); m.rotation.set(0, Math.PI + clamp(e.dir * 0.4, -0.4, 0.4), 0);
        e.legs[0].rotation.x = Math.sin(e.t * 5) * 0.5; e.legs[1].rotation.x = -Math.sin(e.t * 5) * 0.5;
      } else if (e.kind === 'boat') { m.position.set(e.x, Math.sin(e.t * 2 + e.ph) * 0.2, e.z); m.rotation.set(Math.sin(e.t * 1.6) * 0.05, Math.PI + clamp(e.vx * 0.05, -0.3, 0.3), Math.sin(e.t * 1.3) * 0.06); }
      else if (e.kind === 'mine') { m.position.set(e.x, e.y, e.z); m.rotation.set(t * 0.7 + e.ph, t * 1.1, 0); m.children[1].visible = Math.floor(t * 3 + e.ph) % 2 === 0; }
      else {
        const ty = Math.atan2(e.vx * 0.6, e.vz - SPEED - 20);
        e.yaw = e.yaw == null ? ty : e.yaw + angTo(e.yaw, ty) * 0.15;
        m.position.set(e.x, e.y, e.z);
        m.rotation.set(-clamp(e.vy * 0.03, -0.6, 0.6), e.yaw + (e.kind === 'saucer' ? t * 2 : 0), e.kind === 'saucer' ? 0 : -clamp(e.vx * Math.cos(e.yaw) * 0.03, -0.8, 0.8));
        if (e.gold) flashG(m, e.flash > 0 || Math.floor(t * 6) % 3 === 0, white);
      }
    }
    for (const g of this.rings) {
      if (g.z - this.z > VIEW || g.z < this.z - 2 || (g.ok && g.tt > 0.08)) continue;
      if (!g.m) { g.m = mesh(gl.geo['ring' + (g.gold ? 1 : 0)], gl.lit); gl.root.add(g.m); }
      seen.add(g.m);
      g.m.position.set(g.x, g.y, g.z); g.m.rotation.z = t * 0.8;
      flashG(g.m, g.ok, white);
    }
    for (const it of this.items) {
      if (it.z - this.z > VIEW) continue;
      if (!it.m) { const q = new T.Group(), [a, b] = gl.geo['item' + it.k]; q.add(mesh(a, gl.lit), mesh(b, gl.glow)); it.m = q; gl.root.add(q); }
      seen.add(it.m); it.m.position.set(it.x, it.y + Math.sin(it.t * 3) * 0.4, it.z); it.m.rotation.set(0, it.t * 2.4, 0.3);
    }
    const B = this.boss;
    if (B) {
      if (!B.m) this.mkBoss(gl, B);
      seen.add(B.m);
      const sh = B.dying ? 0.6 : 0, ph = B.t * 2.2;
      B.m.position.set(B.x + (sh ? (Math.random() - 0.5) * sh : 0), B.y + (B.type === 'walker' ? Math.abs(Math.sin(ph)) * 0.6 - (B.dying ? (2.8 - B.dying) * 1.5 : 0) : 0), B.z);
      B.m.rotation.z = B.dying ? (2.8 - B.dying) * 0.08 : 0;
      for (const p of B.parts) {
        if (!p.m) continue;
        p.m.visible = !p.dead; p.m.position.set(p.ox, p.oy, p.oz);
        if (p.panel) p.m.rotation.z = p.a + B.spin;
        if (p.core && B.type === 'core') p.m.rotation.set(t * 0.4, t * 0.6, 0);
        flashG(p.m, p.flash > 0, white);
        if (p.eye) p.eye.visible = !p.armored || Math.floor(t * 4) % 2 === 0;
      }
      if (B.legs) { B.legs[0].rotation.x = Math.sin(ph) * 0.35; B.legs[1].rotation.x = -Math.sin(ph) * 0.35; }
      if (B.halo) B.halo.rotation.z = t * 0.6;
    }
    for (const o of gl.ents) if (!seen.has(o)) gl.root.remove(o);
    gl.ents = seen;
    // the ship, its flame and shadow
    const show = s.dead <= 0 && !(this.blink > 0 && Math.floor(t * 16) % 2 === 0);
    gl.ship.visible = show; gl.shadow.visible = show && !this.E.space;
    gl.ship.position.set(s.x, s.y, this.z);
    gl.ship.rotation.set(-s.pitch, s.vx * 0.006, s.bank + (s.roll > 0 ? s.rollDir * TAU * (1 - s.roll / 0.55) : 0));
    gl.ship.scale.setScalar(this.S);
    flashG(gl.ship, this.hurtT > 0.15, white);
    gl.flame.scale.set(1, 1, 0.7 + Math.random() * 0.6);
    gl.shadow.position.set(s.x, 0.06, this.z); gl.shadow.scale.setScalar(this.S * (1 + s.y * 0.02));
    gl.shadow.material.opacity = Math.max(0.08, 0.32 - s.y * 0.008);
    this.fillPools(gl);
  }
  fillPools(gl) {
    const M = gl.tm, Q = gl.tq, E = gl.te, V = gl.tv, S = gl.ts, C = gl.tc, t = this.t;
    let n = 0;
    for (const b of this.shots) { if (n >= 96) break; V.set(b.x, b.y, b.z - 1.4); Q.identity(); S.set(b.dmg > 1 ? 1.7 : 1, b.dmg > 1 ? 1.7 : 1, 1); M.compose(V, Q, S); gl.lasers.setMatrixAt(n, M); gl.lasers.setColorAt(n, b.dmg > 1 ? gl.cHyper : gl.cLaser); n++; }
    gl.lasers.count = n; markI(gl.lasers);
    n = 0;
    for (const b of this.eshots) { if (n >= 220) break; V.set(b.x, b.y, b.z); E.set(t * 5 + n, t * 7, 0); Q.setFromEuler(E); S.setScalar(b.big ? 1.5 : 1); M.compose(V, Q, S); gl.eshotM.setMatrixAt(n, M); gl.eshotM.setColorAt(n, (Math.floor(t * 14) + n) % 2 ? gl.cShotA : gl.cShotB); n++; }
    gl.eshotM.count = n; markI(gl.eshotM);
    n = 0;
    for (const d of this.debris) { if (n >= 320) break; const age = 1.5 - d.life; V.set(d.x, d.y, d.z); E.set(d.rx + d.sx * age, d.ry + d.sy * age, 0); Q.setFromEuler(E); S.setScalar(d.s * Math.min(1, d.life * 3)); M.compose(V, Q, S); gl.debrisM.setMatrixAt(n, M); gl.debrisM.setColorAt(n, C.setRGB(d.c[0], d.c[1], d.c[2])); n++; }
    gl.debrisM.count = n; markI(gl.debrisM);
    n = 0;
    for (const f of this.flashes) { if (n >= 40) break; const k = f.life / f.max; V.set(f.x, f.y, f.z); Q.identity(); S.setScalar(f.r * 2 * (0.5 + (1 - k) * 0.5)); M.compose(V, Q, S); gl.flashM.setMatrixAt(n, M); gl.flashM.setColorAt(n, C.setRGB(f.c[0] * k, f.c[1] * k * k, f.c[2] * k * k)); n++; }
    gl.flashM.count = n; markI(gl.flashM);
    n = 0;
    for (const b of this.bombsF) { if (n >= 8 || b.life < 0) continue; V.set(b.x, b.y, b.z); E.set(t * 9, t * 6, 0); Q.setFromEuler(E); S.setScalar(1 + Math.sin(t * 40) * 0.2); M.compose(V, Q, S); gl.bombM.setMatrixAt(n++, M); }
    gl.bombM.count = n; markI(gl.bombM);
  }
  weather(gl, fdt) {
    const w = gl.wx;
    if (!w) return;
    const A = gl.wmesh.geometry.attributes.position.array, cx = this.ship.x * 0.8, cz = this.z - 13, sp = this.E.space;
    for (let i = 0; i < w.n; i++) {
      const p = w.p[i];
      if (w.k === 'snow') { p[1] -= 5 * fdt; p[0] += Math.sin(this.t + i) * 2 * fdt; }
      else if (w.k === 'embers') { p[1] += 4 * fdt; p[0] += Math.sin(this.t * 0.7 + i) * 2 * fdt; }
      else if (w.k === 'sand') p[0] -= 26 * fdt;
      p[0] = wrap(p[0], cx - 45, 90); p[1] = sp ? wrap(p[1], -14, 60) : wrap(p[1], 0, 42); p[2] = wrap(p[2], cz + 2, 150);
      if (w.streak) { const o = i * 6; A[o] = p[0]; A[o + 1] = p[1]; A[o + 2] = p[2]; A[o + 3] = p[0] + (sp ? 0 : 2.5); A[o + 4] = p[1]; A[o + 5] = p[2] - (sp ? 3 : 0.3); }
      else { A[i * 3] = p[0]; A[i * 3 + 1] = p[1]; A[i * 3 + 2] = p[2]; }
    }
    gl.wmesh.geometry.attributes.position.needsUpdate = true;
  }
  camera(gl) {
    const s = this.ship, cam = gl.cam, sh = this.shake * 1.1;
    const cx = s.x * 0.8, cy = 6.2 + s.y * 0.78, cz = this.z - 13;
    cam.position.set(cx + (sh ? (Math.random() - 0.5) * sh : 0), cy + (sh ? (Math.random() - 0.5) * sh : 0), -cz);
    cam.lookAt(s.x * 0.86, s.y * 0.7 - 1, -(this.z + 40));
    cam.rotateZ(s.bank * 0.06); // a hint of roll only
    gl.sky.position.set(cx, cy, cz);
  }
  draw(c) {
    c.fillStyle = '#0b0d14'; c.fillRect(0, 0, W, H);
    if (this.failed) { this.text(c, '3D unavailable on this device', W / 2, H / 2, 13); return; }
    if (!this.ready || !T) { this.text(c, 'loading…', W / 2, H / 2, 14, '#c9d4e0'); return; }
    let r;
    try { r = renderer(); } catch (e) { this.failed = String(e?.message || e); return; }
    if (!this.gl) this.buildGpu();
    const gl = this.gl, fdt = Math.min(0.05, Math.max(0, this.t - (gl.lastT ?? this.t)));
    gl.lastT = this.t;
    this.camera(gl); this.sync(gl); this.weather(gl, fdt);
    r.setClearColor(gl.scene.background, 1); r.clear();
    r.render(gl.scene, gl.cam);
    c.imageSmoothingEnabled = false;
    c.drawImage(r.domElement, 0, 0, W, H);
    c.imageSmoothingEnabled = true;
    this.drawHud(c);
  }
  proj(x, y, z) {
    const v = (this._pv ||= new T.Vector3()).set(x, y, -z).project(this.gl.cam);
    return { x: ((v.x + 1) * W) / 2, y: ((1 - v.y) * H) / 2, ok: v.z < 1 && v.z > -1 };
  }
  label(c, s, x, y, size, col, align = 'center') { this.text(c, s, x + 1, y + 1, size, 'rgba(0,0,0,.7)', align); this.text(c, s, x, y, size, col, align); }
  drawHud(c) {
    const s = this.ship;
    c.save();
    if (this.hurtT > 0) { c.fillStyle = `rgba(255,40,30,${this.hurtT})`; c.fillRect(0, 0, W, H); }
    if (this.whiteT > 0) { c.fillStyle = `rgba(255,244,255,${Math.min(0.8, this.whiteT * 3)})`; c.fillRect(0, 0, W, H); }
    // reticle: two boxes down the line of fire, red when something is lined up
    if (s.dead <= 0 && !this.clear) {
      const lock = this.foes.some((e) => !e.dead && e.z - this.z > 6 && e.z - this.z < 170 && Math.hypot(e.x - s.x, e.y - s.y) < e.r + 1 + (e.z - this.z) * 0.02) || (this.bossTarget() && Math.hypot(this.bossTarget().x - s.x, this.bossTarget().y - s.y) < this.bossTarget().r + 1);
      c.strokeStyle = lock ? '#ff5a4a' : 'rgba(120,255,140,.8)'; c.lineWidth = 1.5;
      for (const [d, sz] of [[30, 7], [64, 4.5]]) { const p = this.proj(s.x + s.vx * 0.006 * d, s.y + s.vy * 0.006 * d, this.z + d); if (p.ok) c.strokeRect(p.x - sz, p.y - sz, sz * 2, sz * 2); }
    }
    for (const p of this.pops) { const q = this.proj(p.x, p.y, p.z); if (!q.ok) continue; c.globalAlpha = Math.min(1, p.life * 2); this.label(c, p.txt, q.x, q.y - (1 - p.life) * 14, 10, '#fff2a8'); }
    c.globalAlpha = 1;
    for (const it of this.items) { const d = it.z - this.z; if (d < 8 || d > 150) continue; const q = this.proj(it.x, it.y + 2.6, it.z); if (q.ok) this.label(c, ITEMS[it.k][1], q.x, q.y, 8, ITEMS[it.k][0]); }
    // boss health
    const B = this.boss;
    if (B && !B.dying && B.z - this.z < 200) {
      const hp = B.parts.reduce((a, p) => a + (p.hull ? 0 : Math.max(0, p.hp)), 0);
      this.label(c, BOSSES[B.type], W / 2, 46, 9, '#ffd8c0');
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(W / 2 - 80, 53, 160, 7);
      c.fillStyle = '#ff5a3a'; c.fillRect(W / 2 - 79, 54, (158 * hp) / B.max, 5);
    }
    // shield, lives, bombs, laser
    const sh = Math.max(0, this.shield);
    this.label(c, this.laser ? (this.laser === 2 ? 'SHIELD · HYPER' : 'SHIELD · TWIN') : 'SHIELD', 12, H - 34, 8, '#e8f0ff', 'left');
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(12, H - 27, 104, 9);
    c.fillStyle = sh > 50 ? '#5ad8ff' : sh > 25 ? '#ffd040' : '#ff4a3a'; c.fillRect(14, H - 25, sh, 5);
    for (let i = 0; i < Math.max(0, this.lives); i++) { const x = 16 + i * 13, y = H - 48; c.fillStyle = '#e8eaf2'; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 5, y + 3); c.lineTo(x - 5, y + 3); c.closePath(); c.fill(); }
    for (let i = 0; i < Math.min(5, this.bombs); i++) { c.fillStyle = '#ff6a40'; c.beginPath(); c.arc(16 + (Math.max(0, this.lives) + i) * 13 + 4, H - 47, 3.5, 0, TAU); c.fill(); }
    // banners
    const m = this.msg;
    if (m) {
      const a = Math.min(1, m.t * 2);
      c.globalAlpha = m.warn ? a * (0.55 + 0.45 * Math.sin(this.t * 12)) : a;
      this.label(c, m.a, W / 2, H * 0.3, m.warn ? 22 : 20, m.warn ? '#ff5a3a' : '#fff4c8');
      if (m.b) this.label(c, m.b, W / 2, H * 0.3 + 22, 11, '#ffffff');
      if (m.c) this.label(c, m.c, W / 2, H * 0.3 + 38, 9, '#bfe4ff');
      c.globalAlpha = 1;
    }
    // play-mode controls
    if (!this.auto) {
      c.fillStyle = this.bombs > 0 ? 'rgba(255,90,48,.35)' : 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(W - 38, H - 44, 22, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5; c.stroke();
      this.label(c, `✸${this.bombs}`, W - 38, H - 43, 12, '#ffffff');
      if (this.hint > 0) { c.globalAlpha = Math.min(1, this.hint); this.label(c, 'drag to steer · hold to fire · double-tap to roll', W / 2, H - 70, 9, '#e8f4ff'); c.globalAlpha = 1; }
    }
    const fade = this.clear > 4.6 ? Math.min(1, (this.clear - 4.6) / 0.9) : this.fade;
    if (fade > 0) { c.fillStyle = `rgba(0,0,0,${fade})`; c.fillRect(0, 0, W, H); }
    c.restore();
  }
}
