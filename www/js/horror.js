// Horror Forge: gritty monsters for the dark games, built in the round and drawn from eight angles
// like Doom's sprites. It makes shambling zombies, horned demon brutes, spiny imps, hooded wraiths,
// abominations of meat and metal, flayed hellhounds and spider horrors.
//
// Each monster is a set of solids in body space: x forward, y down, z to its right. A frame is drawn
// from one of eight camera angles round it. Front, three-quarter, side, back three-quarter and back
// are rendered; the three left-facing views are mirrors, as in Doom. The drawing is Vitriol's way
// (borrowed from www/ext/vitriol/src/gen/crawlerforge.js):
// - Every solid is painted into albedo + height + glow buffers at 3–4× supersample, with a depth test
//   so parts meet the way solids do. Stains, wounds, eyes and mouths are anchored to points on the
//   body and only show where that point can be seen.
// - Light comes from the height: normals from a Sobel difference, a cavity term from a blurred copy,
//   a tight specular.
// - The picture is crushed down so the grit averages into real pixels.
// - It is then snapped to a small palette, with light along top edges, shade along bottom edges and
//   an ink outline.
// The same genome draws at any size (16 px for a map token, 64 px for a boss).
//
// horror(seed, size, opts) → { frames: [idle a, idle b], walk: [4], attack: [wind-up, strike, recover],
//   hurt, dead (all seen from the side, facing right, as the creature engine's monsters are),
//   view(anim, k, dir), big, anatomy, palette, name, species, element, floats, tier, size, kind, horror: true }.
// view() takes dir 0–7 round the monster: 0 front, 1 front three-quarter facing right, 2 side facing
// right, 3 back three-quarter, 4 back, 5–7 the same mirrored. Canvases are size×size with .pixel set,
// built on first use and kept.
// opts: { kind: one of KINDS, tier: 0–4, glow: GLOWS key }
import { mulberry32 } from './util.js';

export const KINDS = ['zombie', 'demon', 'imp', 'wraith', 'abom', 'hound', 'spider'];
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t;
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const shadeC = (c, a) => (a >= 0 ? c.map((v) => v + (255 - v) * a) : c.map((v) => v * (1 + a)));
function hash3(x, y, z, s) { let h = (x * 374761393 + y * 668265263 + z * 1440662683 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// smooth value noise in body space, so a pattern stays on the body as it turns
function vnoise3(x, y, z, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = x - x0, fy = y - y0, fz = z - z0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (i, j, k) => hash3(x0 + i, y0 + j, z0 + k, s);
  const a = lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v), b = lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v);
  return lerp(a, b, w);
}

// ---------------------------------------------------------------- colour families: [base, light, dark]
// The meats are Vitriol's own palettes. The rest are skins for the dead and the damned, rags, iron and bone.
const MEAT = { raw: ['#8e2f3c', '#b8465a', '#5a1a24'], bile: ['#7a7a2c', '#a9a83e', '#43431a'], necrotic: ['#5c4a63', '#7f6a88', '#332839'], toxic: ['#3d6b3a', '#589a4f', '#22401f'], ember: ['#6b2a1c', '#98402a', '#3a1510'], rust: ['#7a3a24', '#a45636', '#431f13'], void: ['#2a2334', '#453a54', '#16121c'] };
const SKIN = { rot: ['#6f7a5c', '#8a9470', '#4a5240'], bruise: ['#6e5a6e', '#8c7488', '#463a4a'], pallid: ['#a89a88', '#c6b8a4', '#6e6252'], drowned: ['#5a7078', '#7a9298', '#36464c'], hellhide: ['#8a2a1e', '#b0402a', '#4a140e'], char: ['#3a302c', '#5a4a42', '#1e1816'], umber: ['#6a4a32', '#8e6844', '#3a281a'], ash: ['#7a7470', '#9a948e', '#4a4644'] };
const CLOTH = [['#4a4038', '#5e544a', '#2e2824'], ['#3a3c48', '#4c4e5c', '#24252e'], ['#5a2a24', '#74382e', '#341612'], ['#3e4a34', '#505e44', '#262e20'], ['#2a2628', '#3c3638', '#161214']];
const METAL = [['#6d7784', '#9ea8b2', '#383e46'], ['#7a5540', '#a87c5e', '#42301f']];
const BONE = ['#cfc3a6', '#ece2c8', '#8e8268'];
const BLOOD = ['#6a0a12', '#9a1820', '#3a0408'];
const HORN = ['#4a4038', '#7a6e5c', '#221c18'];
export const GLOWS = { fire: '#ffb23a', hell: '#ff5a1a', toxic: '#a8ff4a', cold: '#bfefff', blood: '#ff3040', void: '#c070ff', gold: '#ffe066' };
const C = (h) => h.map(hx);

// ---------------------------------------------------------------- genomes
const NAMES = {
  zombie: [['Rotting', 'Bloated', 'Flayed', 'Hollow', 'Gutted', 'Weeping', 'Cold', 'Drowned'], ['Shambler', 'Rotwalker', 'Husk', 'Corpse', 'Ghoul', 'Lurcher', 'Carcass']],
  demon: [['Pit', 'Brimstone', 'Molten', 'Horned', 'Charred', 'Iron', 'Flayed'], ['Fiend', 'Brute', 'Hellknight', 'Baron', 'Tormentor', 'Butcher']],
  imp: [['Cackling', 'Spined', 'Ember', 'Soot', 'Gibbering'], ['Imp', 'Gremlin', 'Cinderling', 'Spite', 'Fiendling']],
  wraith: [['Hollow', 'Grave', 'Mourning', 'Pale', 'Shrouded'], ['Wraith', 'Shade', 'Revenant', 'Banshee', 'Spectre']],
  abom: [['Writhing', 'Stitched', 'Bolted', 'Festering', 'Many-eyed'], ['Abomination', 'Flesh Weaver', 'Meat Golem', 'Maw', 'Amalgam', 'Gorger']],
  hound: [['Rabid', 'Skinless', 'Burning', 'Gaunt'], ['Hellhound', 'Gorehound', 'Ravager', 'Cur']],
  spider: [['Bloated', 'Eyeless', 'Venom', 'Ossuary', 'Weeping'], ['Broodmother', 'Crawler', 'Webspinner', 'Skitterer']]
};
const ELEMENT = { zombie: 'undead', demon: 'fire', imp: 'fire', wraith: 'undead', abom: 'poison', hound: 'fire', spider: 'poison' };
function genome(seed, opts) {
  const R = mulberry32((seed * 2654435761) >>> 0), r = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length) % a.length];
  const kind = KINDS.includes(opts.kind) ? opts.kind : pick(['zombie', 'zombie', 'demon', 'imp', 'wraith', 'abom', 'hound', 'spider']);
  const tier = clamp(opts.tier ?? 0, 0, 4);
  const g = { seed, kind, tier, R, ns: (seed * 7919) & 0xffff };
  g.skin = C(kind === 'zombie' ? SKIN[pick(['rot', 'rot', 'bruise', 'pallid', 'drowned'])] : kind === 'demon' ? SKIN[pick(['hellhide', 'hellhide', 'char', 'umber'])] : kind === 'imp' ? SKIN[pick(['umber', 'char', 'hellhide', 'ash'])]
    : kind === 'wraith' ? SKIN[pick(['pallid', 'ash', 'drowned'])] : kind === 'abom' ? MEAT[pick(['raw', 'raw', 'bile', 'necrotic', 'toxic', 'rust'])] : kind === 'hound' ? MEAT[pick(['raw', 'ember', 'rust'])] : SKIN[pick(['char', 'umber', 'bruise', 'ash'])]);
  g.cloth = C(pick(CLOTH)); g.metal = C(pick(METAL)); g.bone = C(BONE); g.blood = C(BLOOD); g.horn = C(HORN);
  g.glow = hx(GLOWS[opts.glow] || GLOWS[kind === 'zombie' ? pick(['blood', 'toxic', 'cold']) : kind === 'wraith' ? pick(['cold', 'void', 'toxic']) : kind === 'abom' ? pick(['toxic', 'gold', 'blood']) : kind === 'spider' ? pick(['blood', 'toxic', 'void']) : pick(['fire', 'hell', 'gold'])]);
  g.eyesGlow = kind !== 'zombie' || R() < 0.45;
  // the body plan, in sprite units (0..1 across; feet on the line y = .955)
  const big = 1 + tier * 0.04;
  if (kind === 'zombie') Object.assign(g, { H: r(0.8, 0.88), leg: 0.47, torso: r(0.3, 0.34), headR: r(0.064, 0.074), lean: r(0.22, 0.5), tilt: r(0.1, 0.45), bulk: r(0.95, 1.25) * (R() < 0.2 ? 1.3 : 1), reach: r(1.05, 1.45), stride: 0.3, drag: r(0.3, 0.6), jaw: r(0.1, 0.6), wounds: 2 + Math.floor(R() * 4), shirt: R() < 0.85, tears: r(0.3, 0.55), hair: R() < 0.6, ribs: R() < 0.6 });
  else if (kind === 'demon') Object.assign(g, { H: 0.94 * big, leg: 0.44, torso: 0.33, headR: r(0.05, 0.06), lean: r(0.08, 0.22), tilt: 0.05, bulk: r(1.5, 1.9), reach: r(0.35, 0.6), stride: 0.32, drag: 1, jaw: r(0.2, 0.4), horns: true, spikes: R() < 0.7, tail: R() < 0.8, wings: tier >= 2 && R() < 0.5, digi: true, plates: R() < 0.7 });
  else if (kind === 'imp') Object.assign(g, { H: r(0.6, 0.68), leg: 0.42, torso: 0.3, headR: r(0.085, 0.1), lean: r(0.4, 0.6), tilt: -0.1, bulk: r(0.75, 0.9), reach: r(0.6, 0.9), stride: 0.4, drag: 1, jaw: r(0.3, 0.5), horns: R() < 0.6, spikes: true, tail: true, ears: true, digi: R() < 0.6, wings: R() < 0.25 });
  else if (kind === 'wraith') Object.assign(g, { H: r(0.84, 0.92), leg: 0, torso: 0.36, headR: r(0.06, 0.07), lean: r(0.12, 0.3), tilt: 0.2, bulk: r(0.85, 1), reach: r(0.9, 1.3), jaw: r(0.3, 0.7), hood: R() < 0.7, float: true });
  else if (kind === 'abom') Object.assign(g, { lobes: Array.from({ length: 5 + Math.floor(R() * 4) }, () => ({ a: r(0, TAU), b: r(-0.9, 0.9), d: r(0.05, 0.15), rx: r(0.11, 0.19), ry: r(0.1, 0.16), rz: r(0.11, 0.18) })), eyes: 3 + Math.floor(R() * 5), plates: R() < 0.75, rebar: Math.floor(r(0, 4)), tents: 4 + Math.floor(R() * 4), pust: R() < 0.7, maw: R() < 0.85 });
  else if (kind === 'hound') Object.assign(g, { len: r(0.42, 0.5), bodyY: r(0.56, 0.62), headR: r(0.06, 0.075), spikes: R() < 0.7, ribs: R() < 0.8, tail: R() < 0.9, jaw: r(0.3, 0.6), stride: 0.45 });
  else Object.assign(g, { abd: r(0.17, 0.22), legR: r(0.012, 0.018), eyes: 4 + Math.floor(R() * 5), marks: R() < 0.7, fangs: true });
  const nm = NAMES[kind];
  g.name = `${pick(nm[0])} ${pick(nm[1])}`;
  g.species = nm[1][0];
  return g;
}

// ---------------------------------------------------------------- the painter
// Solids in body space are projected (orthographic) for a camera at angle phi round the vertical axis:
// phi = 0 sees the monster's right side (it faces screen right), phi = 90° sees its face.
// A transform in the body's own forward-up plane (rotation about a pivot, a squash) lays the dead down.
class Paint {
  constructor(n, g, phi) { this.n = n; this.g = g; this.c = Math.cos(phi); this.s = Math.sin(phi); this.A = new Float32Array(n * n * 3); this.Z = new Float32Array(n * n).fill(-1e9); this.E = new Float32Array(n * n * 3); this.P = new Uint8Array(n * n); this.xf = null; }
  T(x, y) {
    const f = this.xf;
    if (!f) return [x, y];
    const dx = x - f.px, dy = (y - f.py) * (f.sy || 1), c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
    return [f.px + dx * c - dy * s + (f.ox || 0), f.py + dx * s + dy * c + (f.oy || 0)];
  }
  // body point → [screen x, screen y, depth toward the camera], all in units
  pr(x, y, z) { [x, y] = this.T(x, y); const X = x - 0.5; return [0.5 + X * this.c - z * this.s, y, X * this.s + z * this.c]; }
  // a screen pixel and its depth back to body space (for patterns that stay on the body as it turns)
  body(px, py, i) { const n = this.n, sx = (px + 0.5) / n - 0.5, d = this.Z[i] / n; return [0.5 + sx * this.c + d * this.s, (py + 0.5) / n, -sx * this.s + d * this.c]; }
  col(m, i, x, y) {
    const g = this.g, [bx, by, bz] = this.body(x, y, i), b = vnoise3(bx * 14, by * 14, bz * 14, g.ns + (m.s || 0)), sp = hash3(x, y, 0, g.ns + 3);
    const v = (0.78 + b * 0.36 + (sp - 0.5) * (m.grit ?? 0.22)) * (m.k || 1);
    this.A[i * 3] = m.c[0] * v; this.A[i * 3 + 1] = m.c[1] * v; this.A[i * 3 + 2] = m.c[2] * v;
  }
  put(i, h, part, m, px, py) { if (h <= this.Z[i]) return; this.Z[i] = h; this.P[i] = part; this.col(m, i, px, py); }
  // an ellipsoid: rx forward, ry up, rz across
  ell(x, y, z, rx, ry, rz, m, part = 1) {
    const n = this.n, [X, Y, D] = this.pr(x, y, z);
    if (this.xf && Math.abs(Math.sin(this.xf.rot || 0)) > 0.7) [rx, ry] = [ry, rx];
    if (this.xf?.sy) ry *= this.xf.sy;
    const RH = Math.hypot(rx * this.c, rz * this.s) * n, RV = ry * n, RD = Math.hypot(rx * this.s, rz * this.c) * n, cx = X * n, cy = Y * n;
    for (let py = Math.max(0, Math.floor(cy - RV)); py <= Math.min(n - 1, Math.ceil(cy + RV)); py++) for (let px = Math.max(0, Math.floor(cx - RH)); px <= Math.min(n - 1, Math.ceil(cx + RH)); px++) {
      const dx = (px + 0.5 - cx) / RH, dy = (py + 0.5 - cy) / RV, q = dx * dx + dy * dy;
      if (q > 1) continue;
      this.put(py * n + px, D * n + RD * Math.sqrt(1 - q), part, m, px, py);
    }
  }
  // a tapered capsule from a to b (body points)
  cap(a, b, r0, r1, m, part = 1) {
    const n = this.n, [x0, y0, d0] = this.pr(...a), [x1, y1, d1] = this.pr(...b);
    const X0 = x0 * n, Y0 = y0 * n, X1 = x1 * n, Y1 = y1 * n, R0 = r0 * n, R1 = r1 * n, dx = X1 - X0, dy = Y1 - Y0, L2 = dx * dx + dy * dy, Rm = Math.max(R0, R1);
    for (let py = Math.max(0, Math.floor(Math.min(Y0, Y1) - Rm)); py <= Math.min(n - 1, Math.ceil(Math.max(Y0, Y1) + Rm)); py++) for (let px = Math.max(0, Math.floor(Math.min(X0, X1) - Rm)); px <= Math.min(n - 1, Math.ceil(Math.max(X0, X1) + Rm)); px++) {
      const t = L2 < 1e-6 ? (d1 > d0 ? 1 : 0) : clamp(((px + 0.5 - X0) * dx + (py + 0.5 - Y0) * dy) / L2, 0, 1), qx = X0 + dx * t - px - 0.5, qy = Y0 + dy * t - py - 0.5, rr = R0 + (R1 - R0) * t, d2 = qx * qx + qy * qy;
      if (d2 > rr * rr) continue;
      this.put(py * n + px, lerp(d0, d1, t) * n + Math.sqrt(rr * rr - d2), part, m, px, py);
    }
  }
  chain(pts, rs, m, part) { for (let k = 0; k < pts.length - 1; k++) this.cap(pts[k], pts[k + 1], rs[k], rs[k + 1], m, part); }
  // a flat triangle (wing membranes), its depth interpolated across it
  tri(a, b, c, m, part = 5) {
    const n = this.n, P = [a, b, c].map((p) => this.pr(...p)).map(([x, y, d]) => [x * n, y * n, d * n]);
    const [[ax, ay, ad], [bx, by, bd], [cx, cy, cd]] = P, den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-6) return;
    for (let py = Math.max(0, Math.floor(Math.min(ay, by, cy))); py <= Math.min(n - 1, Math.ceil(Math.max(ay, by, cy))); py++) for (let px = Math.max(0, Math.floor(Math.min(ax, bx, cx))); px <= Math.min(n - 1, Math.ceil(Math.max(ax, bx, cx))); px++) {
      const qx = px + 0.5, qy = py + 0.5, w0 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / den, w1 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / den, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      this.put(py * n + px, ad * w0 + bd * w1 + cd * w2, part, m, px, py);
    }
  }
  // paint near a body point, on whatever surface is showing there (nothing if that point is hidden)
  at(x, y, z, r, fn, onlyPart = 0) {
    const n = this.n, [X, Y, D] = this.pr(x, y, z), cx = X * n, cy = Y * n, RR = Math.max(0.6, r * n), tol = Math.max(r * n * 1.3, n * 0.03);
    for (let py = Math.max(0, Math.floor(cy - RR)); py <= Math.min(n - 1, Math.ceil(cy + RR)); py++) for (let px = Math.max(0, Math.floor(cx - RR)); px <= Math.min(n - 1, Math.ceil(cx + RR)); px++) {
      const i = py * n + px, d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy) / RR;
      if (d > 1 || this.Z[i] < -1e8 || Math.abs(this.Z[i] - D * n) > tol || (onlyPart && this.P[i] !== onlyPart)) continue;
      fn(i, 1 - d);
    }
  }
  // over every pixel of a part, with its point on the body (clothes, ribs, markings)
  part(id, fn) { const n = this.n; for (let i = 0; i < n * n; i++) if (this.P[i] === id && this.Z[i] > -1e8) fn(i, ...this.body(i % n, (i / n) | 0, i)); }
  tint(i, c, a) { for (let k = 0; k < 3; k++) this.A[i * 3 + k] = lerp(this.A[i * 3 + k], c[k], a); }
  wound(x, y, z, r) {
    const g = this.g, bl = g.blood[0], dk = g.blood[2];
    this.at(x, y, z, r, (i, f) => { this.tint(i, f > 0.55 ? dk : bl, clamp(f * 1.8, 0, 1)); this.Z[i] -= f * r * this.n * 0.5; });
    // and it runs: a few drips down from it
    for (let k = 0; k < 2; k++) { const dx = (g.R() - 0.5) * r * 1.4, len = r * (1 + g.R() * 2.5); for (let s = 0; s < 6; s++) this.at(x + dx * 0.3, y + r * 0.5 + (len * s) / 6, z + dx, r * 0.2, (i) => this.tint(i, bl, 0.75)); }
  }
  // a glowing point (an eye): drawn only if the point itself can be seen
  glow(x, y, z, r, c, a = 1) {
    const n = this.n, [X, Y, D] = this.pr(x, y, z), cx = X * n, cy = Y * n, RR = Math.max(0.7, r * n), ci = clamp(Math.round(cy), 0, n - 1) * n + clamp(Math.round(cx), 0, n - 1);
    if (this.Z[ci] > D * n + Math.max(r * n * 2, n * 0.03)) return;
    for (let py = Math.max(0, Math.floor(cy - RR)); py <= Math.min(n - 1, Math.ceil(cy + RR)); py++) for (let px = Math.max(0, Math.floor(cx - RR)); px <= Math.min(n - 1, Math.ceil(cx + RR)); px++) {
      if (Math.hypot(px + 0.5 - cx, py + 0.5 - cy) > RR) continue;
      const i = py * n + px;
      if (this.Z[i] < -1e8) continue;
      for (let k = 0; k < 3; k++) { this.E[i * 3 + k] = c[k] * a; this.A[i * 3 + k] = c[k]; }
    }
  }
}
const mat = (c, o = {}) => ({ c, ...o });

// ---------------------------------------------------------------- bodies
// a two-legged skeleton from a pose: joints are [x, y, z] body points; legs and arms swing in the
// forward-up plane, set apart across the body by the hips and shoulders
function biped(g, P) {
  const H = g.H, yg = 0.955, L = g.leg * H, L1 = L * (g.digi ? 0.4 : 0.5), L2 = L * (g.digi ? 0.42 : 0.5), L3 = L * 0.22, bk = g.bulk;
  const leg = (a, k) => {
    const kn = [Math.sin(a) * L1, Math.cos(a) * L1], b = a - k, an = [kn[0] + Math.sin(b) * L2, kn[1] + Math.cos(b) * L2];
    if (!g.digi) return [kn, an, [an[0] + L3 * 0.55, an[1]]];
    const c = b + k * 1.25;
    return [kn, an, [an[0] + Math.sin(c) * L3, an[1] + Math.cos(c) * L3]];
  };
  const lN = leg(P.thN + (g.digi ? 0.35 : 0), P.knN + (g.digi ? 0.9 : 0)), lF = leg(P.thF + (g.digi ? 0.35 : 0), P.knF + (g.digi ? 0.9 : 0));
  const low = Math.max(lN[2][1], lF[2][1], lN[1][1], lF[1][1]), hx0 = 0.5 - Math.sin(P.lean) * g.torso * H * 0.25;
  const hip = [hx0, (g.float ? yg - H * 0.42 : yg - low) - P.bob, 0], hw = 0.06 * H * Math.sqrt(bk), sw = (g.kind === 'demon' ? 0.13 : 0.1) * H * Math.sqrt(bk);
  const at = (o, z) => [hip[0] + o[0], hip[1] + o[1], z];
  const T = g.torso * H, top = [hip[0] + Math.sin(P.lean) * T, hip[1] - Math.cos(P.lean) * T, 0];
  const sh = [lerp(hip[0], top[0], 0.86), lerp(hip[1], top[1], 0.86), 0], hd = g.headR + 0.03 * H, ht = P.lean + P.tilt;
  const head = [top[0] + Math.sin(ht) * hd, top[1] - Math.cos(ht) * hd, 0];
  const lk = g.kind === 'imp' || g.kind === 'wraith' ? 1.15 : 1, A1 = H * 0.2 * lk, A2 = H * 0.19 * lk;
  const arm = (s, e, z) => { const o = [sh[0], sh[1], z], el = [o[0] + Math.sin(s) * A1, o[1] + Math.cos(s) * A1, z * 1.1], c = s + e; return [o, el, [el[0] + Math.sin(c) * A2, el[1] + Math.cos(c) * A2, z * 1.05]]; };
  const aN = arm(P.shN, P.elN, sw), aF = arm(P.shF, P.elF, -sw);
  return { hip, top, sh, head, ht, hw, sw, hipN: [hip[0], hip[1], hw], hipF: [hip[0], hip[1], -hw], kN: at(lN[0], hw), fN: at(lN[1], hw), tN: at(lN[2], hw), kF: at(lF[0], -hw), fF: at(lF[1], -hw), tF: at(lF[2], -hw), sN: aN[0], eN: aN[1], hN: aN[2], sF: aF[0], eF: aF[1], hF: aF[2], yg };
}
// a hand of claws at the end of a forearm, fanned across
function claws(p, from, to, len, r, m, n = 3) {
  const dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy) || 1;
  for (let k = 0; k < n; k++) { const s = k - (n - 1) / 2; p.cap(to, [to[0] + (dx / l) * len - s * (dy / l) * len * 0.25, to[1] + (dy / l) * len + s * (dx / l) * len * 0.25, to[2] + s * len * 0.35], r, r * 0.25, m, 4); }
}
function humanoid(p, g, P) {
  const S = biped(g, P), H = g.H, bk = g.bulk, kind = g.kind, sk = mat(g.skin[0]), skB = mat(g.skin[0], { k: 0.86 });
  const thR = 0.052 * H * Math.sqrt(bk), shR = 0.04 * H * Math.sqrt(bk), uaR = 0.036 * H * bk, faR = 0.031 * H * bk, claw = mat(kind === 'zombie' ? g.bone[2] : g.horn[0]);
  const pants = kind === 'zombie' ? mat(g.cloth[0]) : null, horn = mat(g.horn[1]);
  // wings: a membrane on finger bones spreading out and back from each shoulder blade
  if (g.wings) for (const s of [1, -1]) {
    const f = P.wing || 0, base = [S.sh[0] - 0.03 * H, S.sh[1] + 0.02 * H, s * 0.06 * H];
    const tips = [[-0.12, -0.32 - f * 0.08, 0.3], [-0.24, -0.08 + f * 0.04, 0.42], [-0.16, 0.12 + f * 0.06, 0.3]].map(([dx, dy, dz]) => [base[0] + dx * H, base[1] + dy * H, s * dz * H]);
    const mem = mat(g.skin[2], { grit: 0.3 });
    p.tri(base, tips[0], tips[1], mem); p.tri(base, tips[1], tips[2], mem);
    for (const t of tips) p.cap(base, t, 0.012 * H, 0.004 * H, mat(g.horn[0]), 5);
  }
  if (g.tail) { const w = Math.sin(P.tail || 0) * 0.05 * H, b = [S.hip[0] - 0.03, S.hip[1] - 0.02, 0], m1 = [b[0] - 0.14 * H, b[1] + 0.08 * H, w], e = [m1[0] - 0.12 * H, m1[1] - 0.06 * H, w * 2.2]; p.chain([b, m1, e], [0.03 * H, 0.018 * H, 0.006 * H], skB, 6); }
  // legs and arms (both sides: the depth test sorts out which is in front)
  if (!g.float) for (const [hp, k, f, t] of [[S.hipN, S.kN, S.fN, S.tN], [S.hipF, S.kF, S.fF, S.tF]]) {
    p.chain([hp, k, f, t], [thR, shR, shR * 0.8, shR * 0.6], pants || sk, 3);
    if (g.digi) p.ell(t[0] + 0.01, t[1] - 0.005, t[2], 0.03 * H, 0.016 * H, 0.022 * H, mat(g.horn[2]), 3);
  }
  for (const [s, e, h, near] of [[S.sN, S.eN, S.hN, 1], [S.sF, S.eF, S.hF, 0]]) {
    p.chain([s, e, h], [uaR * (near ? 1.05 : 1), faR, faR * 0.85], sk, 4);
    claws(p, e, h, 0.05 * H * (kind === 'wraith' ? 1.8 : kind === 'demon' ? 1.3 : 1), 0.009 * H * Math.sqrt(bk), claw);
  }
  if (P.fire) p.glow(S.hN[0] + 0.02, S.hN[1], S.hN[2], 0.05 * H, g.glow);
  // a wraith trails a tattered shroud in place of legs: a flaring hem hung with ragged strips
  if (g.float) {
    const m = mat(g.cloth[0], { grit: 0.35 }), w = 0.11 * H;
    p.cap([S.top[0], S.top[1] + 0.02, 0], [S.hip[0] - 0.01, S.hip[1] + 0.1 * H, 0], w * 0.75, w * 1.05, m, 2);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU, sway = Math.sin((P.wave || 0) + k * 2.1) * 0.03 * H, b = [S.hip[0] + Math.cos(a) * w * 0.8, S.hip[1] + 0.1 * H, Math.sin(a) * w * 0.8];
      p.cap(b, [b[0] + Math.cos(a) * 0.02 - 0.03 * H + sway, b[1] + (0.12 + (k % 3) * 0.05) * H, b[2] + Math.sin(a) * 0.02], w * 0.32, w * 0.06, m, 2);
    }
    if (g.hood) p.ell(S.head[0] - 0.012, S.head[1] - 0.005, 0, g.headR * 1.4, g.headR * 1.45, g.headR * 1.4, mat(g.cloth[2]), 2);
  }
  // the body
  const chest = [lerp(S.hip[0], S.top[0], 0.62), lerp(S.hip[1], S.top[1], 0.62), 0], dep = (kind === 'demon' ? 0.12 : 0.065) * H * bk ** 0.5, wid = (kind === 'demon' ? 0.16 : 0.11) * H * bk ** 0.6;
  p.cap(S.hip, S.top, dep * 0.95, dep * 1.05, sk, 1);
  p.ell(chest[0] + 0.008, chest[1], 0, dep * 1.1, dep * 1.25, wid, sk, 1);
  p.ell(S.hip[0], S.hip[1] - 0.01, 0, dep * 0.95, dep, S.hw * 1.6, pants || sk, 1);
  if (kind === 'demon') p.ell(S.sh[0] - 0.015, S.sh[1] + 0.01, 0, dep * 0.9, dep * 0.8, S.sw * 1.15, sk, 1);
  if (g.plates) for (let k = 0; k < 4; k++) { const u = 0.15 + k * 0.17; p.at(lerp(S.hip[0], S.top[0], u) + dep, lerp(S.hip[1], S.top[1], u), 0, wid * 0.55, (i, f) => { if (f > 0.25) p.tint(i, g.skin[2], 0.5); }, 1); }
  if (g.spikes) for (let k = 0; k < 4; k++) { const u = 0.35 + k * 0.17, b = [lerp(S.hip[0], S.top[0], u) - dep * 0.9, lerp(S.hip[1], S.top[1], u), 0]; p.cap(b, [b[0] - 0.06 * H, b[1] - 0.03 * H, 0], 0.014 * H, 0.002 * H, mat(g.horn[0]), 1); }
  // clothes and what shows through their tears: patterns in body space, so they turn with it
  if (kind === 'zombie') {
    const cl = g.cloth[0];
    if (g.shirt) p.part(1, (i, x, y, z) => { if (y > S.hip[1] - 0.02) return; const v = vnoise3(x * 16, y * 16, z * 16, g.ns + 9); if (v > g.tears) p.tint(i, cl, 0.92); else if (g.ribs && v < g.tears - 0.1 && Math.floor(y * 80) % 3 === 0) { p.tint(i, g.bone[0], 0.85); p.Z[i] += 0.008 * p.n; } });
    p.part(3, (i, x, y, z) => { if (vnoise3(x * 18, y * 18, z * 18, g.ns + 2) < 0.34 && y > S.hip[1] + 0.2 * H) p.tint(i, g.skin[0], 0.9); });
    for (let k = 0; k < g.wounds; k++) { const u = g.R(), a = g.R() * TAU; p.wound(lerp(S.hip[0], S.top[0], u) + Math.cos(a) * dep, lerp(S.hip[1], S.top[1], u), Math.sin(a) * wid, 0.018 * H + g.R() * 0.02 * H); }
  }
  if (kind === 'wraith') p.part(1, (i, x, y, z) => { if (vnoise3(x * 12, y * 12, z * 12, g.ns + 4) > 0.42) p.tint(i, g.cloth[0], 0.9); });
  // the head
  const hr = g.headR, hc = S.head, fwd = (d, up, z = 0) => [hc[0] + d * hr, hc[1] + up * hr, z * hr];
  if (kind === 'demon' || kind === 'imp') {
    p.ell(hc[0], hc[1], 0, hr * 1.05, hr * 0.95, hr * 0.95, sk, 2);
    p.ell(...fwd(0.55, 0.3), hr * 0.55, hr * 0.45, hr * 0.6, sk, 2);
    if (g.horns) for (const s of [1, -1]) { const b = fwd(-0.1, -0.6, s * 0.45), c1 = [b[0] - hr * 0.5, b[1] - hr * 1.1, s * hr * 0.9], c2 = [c1[0] - hr * 0.8, c1[1] + hr * 0.1, s * hr * 1.2]; p.chain([b, c1, c2], [hr * 0.3, hr * 0.18, hr * 0.05], horn, 2); }
    if (g.ears) for (const s of [1, -1]) p.cap(fwd(-0.3, -0.2, s * 0.7), fwd(-1.3, -1.1, s * 1.4), hr * 0.28, hr * 0.05, sk, 2);
  } else {
    // a skull's shape under the skin; the jaw hangs
    const sm = kind === 'wraith' ? mat(g.bone[0]) : sk;
    p.ell(hc[0], hc[1], 0, hr, hr * 1.08, hr * 0.9, sm, 2);
    p.cap(fwd(0.35, 0.45), [hc[0] + hr * 0.85 * Math.cos(P.jaw * 0.5), hc[1] + hr * (0.6 + P.jaw * 0.7), 0], hr * 0.34, hr * 0.27, sm, 2);
    if (kind === 'zombie' && g.hair) for (let k = 0; k < 6; k++) { const a = -2.3 + (k % 3) * 0.4, z = (k < 3 ? 1 : -1) * 0.5; p.cap([hc[0] + Math.cos(a) * hr * 0.9, hc[1] + Math.sin(a) * hr * 0.9, z * hr], [hc[0] + Math.cos(a) * hr * 1.25 - 0.02, hc[1] + Math.sin(a) * hr * 1.05 + 0.03, z * hr * 1.3], hr * 0.12, hr * 0.05, mat(g.cloth[2]), 2); }
    if (kind === 'zombie' && g.R() < 0.6) p.wound(...fwd(-0.1, -0.85, 0.3), hr * 0.45);
  }
  // mouth, teeth and eyes on the front of the face
  const mo = fwd(0.95, kind === 'demon' || kind === 'imp' ? 0.42 : 0.5);
  p.at(...mo, hr * (0.25 + P.jaw * 0.22), (i, f) => { p.tint(i, [20, 8, 8], clamp(f * 2, 0, 1)); p.Z[i] -= f * hr * p.n * 0.25; }, 2);
  for (let k = 0; k < 4; k++) p.at(mo[0], mo[1] - hr * 0.12, (k - 1.5) * hr * 0.17, hr * 0.07, (i) => { p.tint(i, g.bone[1], 1); p.Z[i] += hr * p.n * 0.15; }, 2);
  for (const s of [1, -1]) {
    const e = fwd(0.82, -0.2, s * 0.38);
    p.at(...e, hr * 0.26, (i, f) => { p.tint(i, [12, 8, 8], clamp(f * 1.6, 0, 0.95)); p.Z[i] -= f * hr * p.n * 0.2; }, 2);
    if (P.dead) continue;
    if (g.eyesGlow) p.glow(...e, hr * 0.12, g.glow, s > 0 ? 1 : 0.85);
    else p.at(...e, hr * 0.1, (i) => p.tint(i, [220, 214, 190], 1), 2);
  }
  if (kind === 'zombie' && g.wounds > 3) p.wound(S.eN[0], S.eN[1], S.eN[2] + 0.02 * H, 0.016 * H);
}
// an abomination: a heap of lobes, bolted plates, eyes, a maw, tentacles to drag itself along
function abomination(p, g, P) {
  const cx = 0.5, cy = 0.6, pulse = P.pulse || 0, sk = mat(g.skin[0], { grit: 0.3 }), skD = mat(g.skin[0], { k: 0.78 });
  // tentacles splay out under it all round and drag on the ground
  for (let k = 0; k < g.tents; k++) {
    const a = (k / g.tents) * TAU + 0.3, ph = (P.wig || 0) + k * 1.7, ca = Math.cos(a), sa = Math.sin(a), b = [cx + ca * 0.1, cy + 0.1, sa * 0.1];
    const m1 = [b[0] + ca * 0.12 + Math.sin(ph) * 0.03, b[1] + 0.12 + Math.cos(ph) * 0.02, b[2] + sa * 0.12], e = [m1[0] + ca * 0.13 + Math.sin(ph * 1.3) * 0.04, 0.93 - Math.abs(Math.sin(ph)) * 0.04, m1[2] + sa * 0.13];
    const lash = P.lash && k === 0;
    p.chain(lash ? [b, [b[0] + 0.18, b[1] - 0.05, b[2]], [b[0] + 0.4, b[1] - 0.02, b[2]]] : [b, m1, e], [0.05, 0.035, 0.012], k % 2 ? skD : sk, 3);
  }
  const lobeAt = (L, s = 1) => [cx + Math.cos(L.a) * Math.cos(L.b) * L.d * s, cy + Math.sin(L.b) * L.d * 0.8 * s, Math.sin(L.a) * Math.cos(L.b) * L.d * s];
  for (const L of g.lobes) {
    const s = 1 + Math.sin(pulse + L.a * 3) * 0.04, [x, y, z] = lobeAt(L);
    p.ell(x, y, z, L.rx * s * (P.squash ? 1.25 : 1), L.ry * s * (P.squash ? 0.6 : 1), L.rz * s * (P.squash ? 1.25 : 1), sk, 1);
  }
  if (g.plates) for (let k = 0; k < 3; k++) { const L = g.lobes[k], [x, y, z] = lobeAt(L, 1.6); p.ell(x, y - 0.03, z, 0.06, 0.045, 0.06, mat(g.metal[0], { grit: 0.15 }), 6); for (let b = 0; b < 3; b++) p.at(x, y - 0.05, z + (b - 1) * 0.035, 0.008, (i) => { p.tint(i, g.metal[1], 1); p.Z[i] += 0.008 * p.n; }, 6); }
  for (let k = 0; k < g.rebar; k++) { const a = k * 2.1 + 0.4, b = [cx + Math.cos(a) * 0.08, cy - 0.06, Math.sin(a) * 0.08]; p.cap(b, [b[0] + Math.cos(a) * 0.18, b[1] - 0.2, b[2] + Math.sin(a) * 0.18], 0.012, 0.008, mat(g.metal[1]), 6); }
  if (g.pust) for (let k = 0; k < 8; k++) { const a = g.R() * TAU, b = g.R() * 1.6 - 0.8; p.at(cx + Math.cos(a) * Math.cos(b) * 0.2, cy + Math.sin(b) * 0.15, Math.sin(a) * Math.cos(b) * 0.2, 0.02, (i, f) => { p.tint(i, shadeC(g.skin[1], 0.35), f); p.Z[i] += f * 0.012 * p.n; }, 1); }
  p.part(1, (i, x, y, z) => { const v = vnoise3(x * 30, y * 30, z * 30, g.ns + 11); if (v > 0.47 && v < 0.5) p.tint(i, g.skin[2], 0.85); });
  // the maw at the front, ringed with teeth
  if (g.maw) {
    const mx = cx + 0.21, my = cy + 0.02, open = 0.04 + (P.maw || 0) * 0.05;
    p.at(mx, my, 0, open + 0.03, (i, f) => { p.tint(i, [18, 6, 8], clamp(f * 2.4, 0, 1)); p.Z[i] -= f * 0.04 * p.n; });
    for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU; p.at(mx, my + Math.sin(a) * open * 0.8, Math.cos(a) * open, 0.009, (i) => { p.tint(i, g.bone[1], 1); p.Z[i] += 0.01 * p.n; }); }
  }
  // eyes over the front of it: some glow, some are only wet and staring
  for (let k = 0; k < g.eyes; k++) {
    const a = (k / Math.max(1, g.eyes - 1) - 0.5) * 1.8, b = -0.4 - Math.cos(k * 3.1) * 0.25, r = 0.016 + (k % 3) * 0.006, R0 = 0.19;
    const e = [cx + Math.cos(a) * Math.cos(b) * R0, cy - 0.02 + Math.sin(b) * R0 * 0.8, Math.sin(a) * Math.cos(b) * R0];
    p.at(...e, r * 1.4, (i, f) => p.tint(i, g.skin[2], f), 1);
    if (P.dead) continue;
    if (k % 2 === 0) p.glow(...e, r * 0.7, g.glow);
    else { p.at(...e, r, (i) => { p.tint(i, [226, 220, 196], 1); p.Z[i] += 0.008 * p.n; }); p.at(e[0] + r * 0.4, e[1], e[2], r * 0.45, (i) => p.tint(i, [16, 10, 10], 1)); }
  }
}
// a hellhound: flayed, spined, jaws open, on four legs
function hound(p, g, P) {
  const L = g.len, by = g.bodyY - (P.bob || 0), cx = 0.48, sk = mat(g.skin[0]), legL = 0.955 - by, w = 0.09, s = P.gait || 0;
  const leg = (x, a, z, back) => { const top = [x, by, z], k1 = [x + Math.sin(a) * legL * 0.5 + (back ? -0.02 : 0.01), by + Math.cos(a) * legL * 0.5, z * 1.15], k2 = [k1[0] + Math.sin(a * 0.4 + (back ? 0.5 : -0.2)) * legL * 0.5, 0.94, z * 1.2], ft = [k2[0] + 0.03, 0.95, z * 1.2]; p.chain([top, k1, k2, ft], [0.042, 0.03, 0.022, 0.016], sk, 3); };
  leg(cx + L * 0.36, s * 0.5, w, false); leg(cx + L * 0.36, -s * 0.5, -w, false); leg(cx - L * 0.4, -s * 0.5, w, true); leg(cx - L * 0.4, s * 0.5, -w, true);
  if (g.tail) { const t = Math.sin(P.tail || 0) * 0.05; p.chain([[cx - L * 0.5, by - 0.04, 0], [cx - L * 0.75, by - 0.1, t], [cx - L * 0.92, by - 0.06, t * 2]], [0.025, 0.014, 0.004], mat(g.skin[0], { k: 0.85 }), 6); }
  p.ell(cx - L * 0.22, by, 0, L * 0.32, 0.085, 0.11, sk, 1);
  p.ell(cx + L * 0.25, by - 0.01, 0, 0.12, 0.105, 0.13, sk, 1);
  if (g.ribs) p.part(1, (i, x, y, z) => { if (Math.abs(z) > 0.04 && x > cx - L * 0.15 && x < cx + L * 0.3 && Math.floor(x * 110) % 4 === 0 && y > by - 0.05) { p.tint(i, g.bone[0], 0.8); p.Z[i] += 0.008 * p.n; } });
  if (g.spikes) for (let k = 0; k < 5; k++) { const x = cx - L * 0.35 + k * L * 0.15; p.cap([x, by - 0.08, 0], [x - 0.03, by - 0.15, 0], 0.012, 0.002, mat(g.horn[0]), 1); }
  // head: skull, snout, jaw open, ears
  const nk = [cx + L * 0.45, by - 0.08, 0], hc = [nk[0] + 0.06, nk[1] - 0.01 + (P.lunge || 0) * 0.04, 0], hr = g.headR, jaw = g.jaw + (P.bite || 0) * 0.5;
  p.cap([cx + L * 0.3, by - 0.03, 0], nk, 0.07, 0.05, sk, 2);
  p.ell(hc[0], hc[1], 0, hr * 1.1, hr, hr * 1.15, sk, 2);
  p.cap(hc, [hc[0] + hr * 1.6, hc[1] + hr * 0.15, 0], hr * 0.5, hr * 0.35, sk, 2);
  p.cap([hc[0] + hr * 0.2, hc[1] + hr * 0.5, 0], [hc[0] + hr * 1.4, hc[1] + hr * (0.4 + jaw * 1.2), 0], hr * 0.35, hr * 0.22, sk, 2);
  for (let k = 0; k < 4; k++) for (const s2 of [1, -1]) p.at(hc[0] + hr * (0.6 + k * 0.25), hc[1] + hr * (0.4 + (jaw * 0.3 * k) / 3), s2 * hr * 0.3, hr * 0.08, (i) => { p.tint(i, g.bone[1], 1); p.Z[i] += hr * p.n * 0.15; }, 2);
  for (const s2 of [1, -1]) {
    p.cap([hc[0] - hr * 0.3, hc[1] - hr * 0.6, s2 * hr * 0.5], [hc[0] - hr * 0.8, hc[1] - hr * 1.4, s2 * hr * 0.7], hr * 0.3, hr * 0.05, sk, 2);
    if (!P.dead) p.glow(hc[0] + hr * 0.55, hc[1] - hr * 0.25, s2 * hr * 0.45, hr * 0.15, g.glow);
  }
  for (let k = 0; k < 2; k++) { const a = g.R() * TAU; p.wound(cx - L * 0.2 + g.R() * L * 0.5, by - 0.02 + g.R() * 0.06, Math.sin(a) * 0.09, 0.025); }
}
// a spider horror: a swollen abdomen, a cluster of lit eyes, eight jointed legs
function spider(p, g, P) {
  const A = g.abd, cx = 0.48, cy = 0.62 - (P.bob || 0), sk = mat(g.skin[0]), lr = g.legR;
  for (const side of [1, -1]) for (let k = 0; k < 4; k++) {
    const t = (k / 3) * 2 - 1, ph = (P.gait || 0) + k * 1.6 + (side > 0 ? 0 : Math.PI), lift = Math.max(0, Math.sin(ph)) * 0.05 * (P.walk ? 1 : 0);
    const b = [cx + 0.06 + t * 0.05, cy - 0.02, side * 0.05], kn = [b[0] + t * 0.12 + 0.02, P.curl ? cy - 0.05 : cy - 0.2 - lift, side * 0.2], ft = [b[0] + t * 0.24 + 0.02, P.curl ? cy - 0.02 : 0.95 - lift * 0.5, side * (P.curl ? 0.12 : 0.32)];
    p.chain([b, kn, ft], [lr * 1.6, lr, lr * 0.5], sk, 3);
  }
  p.ell(cx - A * 0.75, cy - 0.04, 0, A, A * 0.85, A * 0.9, sk, 1);
  if (g.marks) p.part(1, (i, x, y, z) => { if (x < cx - A * 0.3 && y < cy - 0.02 && vnoise3(x * 24, y * 24, z * 24, g.ns + 7) > 0.56) p.tint(i, g.bone[0], 0.8); });
  p.ell(cx + 0.07, cy + 0.01, 0, 0.075, 0.06, 0.065, sk, 2);
  for (let k = 0; k < g.eyes; k++) { const z = ((k % 3) - 1) * 0.022, y = cy - 0.02 + Math.floor(k / 3) * 0.02; if (!P.dead) p.glow(cx + 0.14, y, z, 0.009 + (k === 1 ? 0.004 : 0), g.glow); }
  if (g.fangs) for (const s of [1, -1]) p.cap([cx + 0.13, cy + 0.04, s * 0.015], [cx + 0.15, cy + 0.08 + (P.bite || 0) * 0.02, s * 0.02], 0.008, 0.002, mat(g.bone[1]), 2);
}

// ---------------------------------------------------------------- poses
function pose(g, type, t) {
  const P = { lean: g.lean ?? 0, tilt: g.tilt ?? 0, bob: 0, thN: 0, knN: 0.15, thF: 0.02, knF: 0.2, shN: g.reach ?? 0.4, elN: 0.3, shF: (g.reach ?? 0.4) * (g.kind === 'zombie' ? 0.75 : -0.25), elF: 0.4, jaw: g.jaw ?? 0.3, wing: 0, tail: 0, wave: 0, pulse: 0, wig: 0, gait: 0 };
  const zomb = g.kind === 'zombie';
  if (type === 'idle') { P.bob = t ? 0.006 : 0; P.shN += t ? 0.06 : -0.03; P.shF += t ? -0.05 : 0.03; P.lean += t ? 0.02 : 0; P.jaw += t ? 0.1 : 0; P.wing = t; P.tail = t * 1.5; P.wave = t * 1.6; P.pulse = t * 1.6; P.wig = t * 0.9; }
  else if (type === 'walk') {
    const s = Math.sin(t * TAU), c = Math.cos(t * TAU), a = g.stride ?? 0.3;
    P.thN = s * a; P.knN = 0.15 + Math.max(0, -c) * 1.2 * a; P.thF = -s * a * (g.drag ?? 1); P.knF = 0.15 + Math.max(0, c) * 1.1 * a * (g.drag ?? 1);
    P.shN = (g.reach ?? 0.4) + (zomb ? s * 0.12 : -s * 0.45); P.shF += zomb ? -s * 0.12 : s * 0.5; P.bob = Math.abs(c) * 0.014;
    P.lean += s * 0.03; P.tail = t * TAU; P.wave = t * TAU; P.pulse = t * TAU; P.wig = t * TAU; P.gait = s; P.walk = true; P.wing = Math.abs(s);
  } else if (type === 'attack') {
    const demon = g.kind === 'demon';
    if (t === 1) { P.shN = demon ? 2.7 : -0.5; P.elN = demon ? 0.3 : 0.8; P.shF = demon ? 2.5 : P.shF; P.lean -= 0.12; P.jaw += 0.25; P.maw = 0.4; P.bite = 0.3; P.fire = g.kind === 'imp'; P.wing = 1; }
    else if (t === 2) { P.shN = demon ? 1.2 : 1.55; P.elN = 0.05; P.shF = demon ? 1.3 : P.shF + 0.3; P.lean += 0.28; P.thN = 0.35; P.jaw += 0.55; P.maw = 1; P.lash = true; P.bite = 1; P.lunge = 1; P.fire = g.kind === 'imp'; }
    else { P.shN = 0.9; P.elN = 0.25; P.lean += 0.1; P.jaw += 0.2; P.maw = 0.5; P.bite = 0.4; }
  } else if (type === 'hurt') { P.lean -= 0.35; P.tilt -= 0.35; P.shN = 1.9; P.shF = 1.5; P.elN = 0.9; P.jaw += 0.45; P.knN = 0.45; P.knF = 0.5; P.squash = true; P.maw = 0.8; P.bite = 0.6; }
  else if (type === 'dead') { P.dead = true; P.shN = 1.2; P.shF = 0.9; P.elN = 0.3; P.jaw += 0.6; P.knN = 0.3; P.knF = 0.5; P.curl = true; P.squash = true; P.lean = 0; P.tilt = 0.4; }
  return P;
}
function paintFrame(g, n, type, t, phi) {
  const p = new Paint(n, g, phi), P = pose(g, type, t), k = g.kind;
  if (P.dead) {
    // laid down: bipeds on their backs, beasts on their backs with their legs curled, heaps and shrouds squashed flat
    if (k === 'abom' || k === 'wraith') p.xf = { px: 0.5, py: 0.955, sy: k === 'abom' ? 0.5 : 0.4 };
    else if (k === 'hound' || k === 'spider') p.xf = { px: 0.5, py: 0.66, rot: Math.PI, oy: 0.14 };
    else p.xf = { px: 0.5, py: 0.5, rot: -Math.PI / 2, oy: 0.37 };
    const xf = p.xf; p.xf = null; p.ell(0.5, 0.945, 0, 0.36, 0.03, 0.3, mat(g.blood[2], { grit: 0.2 }), 7); p.xf = xf;
  }
  if (k === 'abom') abomination(p, g, P); else if (k === 'hound') hound(p, g, P); else if (k === 'spider') spider(p, g, P); else humanoid(p, g, P);
  return p;
}

// ---------------------------------------------------------------- light, crush, palette snap, outline (Vitriol's pipeline)
function blur(src, n, r) {
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n), R = Math.max(1, r | 0), k = 1 / (R * 2 + 1);
  for (let y = 0; y < n; y++) { let a = 0; for (let x = -R; x <= R; x++) a += src[y * n + clamp(x, 0, n - 1)]; for (let x = 0; x < n; x++) { tmp[y * n + x] = a * k; a += src[y * n + clamp(x + R + 1, 0, n - 1)] - src[y * n + clamp(x - R, 0, n - 1)]; } }
  for (let x = 0; x < n; x++) { let a = 0; for (let y = -R; y <= R; y++) a += tmp[clamp(y, 0, n - 1) * n + x]; for (let y = 0; y < n; y++) { out[y * n + x] = a * k; a += tmp[clamp(y + R + 1, 0, n - 1) * n + x] - tmp[clamp(y - R, 0, n - 1) * n + x]; } }
  return out;
}
function light(p) {
  const { n, A, Z, E } = p, out = new Float32Array(n * n * 3), Zc = new Float32Array(n * n);
  let lo = Infinity;
  for (let i = 0; i < n * n; i++) if (Z[i] > -1e8 && Z[i] < lo) lo = Z[i];
  for (let i = 0; i < n * n; i++) Zc[i] = Z[i] > -1e8 ? Z[i] : lo - n * 0.05;
  const cav = blur(Zc, n, Math.max(2, n * 0.05)), lx = -0.55, ly = -0.62, lz = 0.72, rel = 1.15, hl = Math.hypot(lx, ly, lz + 1);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    if (Z[i] < -1e8) continue;
    const g = (q) => (Z[q] > -1e8 ? Z[q] : Z[i]);
    let nx = (g(x > 0 ? i - 1 : i) - g(x < n - 1 ? i + 1 : i)) * rel * 0.5, ny = (g(y > 0 ? i - n : i) - g(y < n - 1 ? i + n : i)) * rel * 0.5, nz = 1;
    const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
    const lam = clamp(nx * lx + ny * ly + nz * lz, 0, 1), ao = clamp(0.62 + ((Zc[i] - cav[i]) / n) * 9, 0.32, 1.15);
    const sp = Math.pow(clamp((nx * lx + ny * ly + nz * (lz + 1)) / hl, 0, 1), 18) * 0.5;
    const k = (0.5 + 0.72 * lam) * ao, e = E[i * 3] + E[i * 3 + 1] + E[i * 3 + 2] > 0;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = e ? E[i * 3 + c] : clamp(A[i * 3 + c] * k + sp * 190, 0, 255);
  }
  return out;
}
// the palette: every family the genome uses, five shades each, its glow unshaded, and the ink
function paletteOf(g) {
  const fams = [g.skin, g.cloth, g.metal, g.bone, g.blood, g.horn], list = [];
  fams.forEach((f, fi) => { const [b, l, d] = f; [shadeC(d, -0.35), d, b, l, shadeC(l, 0.22)].forEach((c, k) => list.push({ c, f: fi, k })); });
  list.push({ c: g.glow, f: 99, k: 2 }, { c: shadeC(g.glow, 0.5), f: 99, k: 3 });
  const idx = (f, k) => list.findIndex((q) => q.f === f && q.k === k);
  for (const q of list) { q.up = q.f === 99 ? list.indexOf(q) : idx(q.f, Math.min(4, q.k + 1)); q.dn = q.f === 99 ? list.indexOf(q) : idx(q.f, Math.max(0, q.k - 1)); }
  return { list, ink: [11, 8, 9], cache: new Map() };
}
function snap(pal, r, g, b) {
  const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
  let ci = pal.cache.get(key);
  if (ci === undefined) {
    let bd = 1e9; ci = 0;
    pal.list.forEach((q, k) => { const dr = q.c[0] - r, dg = q.c[1] - g, db = q.c[2] - b, d = dr * dr * 0.35 + dg * dg * 0.5 + db * db * 0.15; if (d < bd) { bd = d; ci = k; } });
    pal.cache.set(key, ci);
  }
  return ci;
}
function bake(g, p, size, smooth = false) {
  const n = p.n, ss = n / size, L = light(p), cv = document.createElement('canvas');
  cv.width = cv.height = size; cv.pixel = !smooth;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data, idx = new Int16Array(size * size).fill(-1), pal = (g.pal ||= paletteOf(g));
  // crush: average each block of supersamples; keep it if enough of the block is covered
  const cols = new Float32Array(size * size * 3), glow = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let cnt = 0, r = 0, gg = 0, b = 0, e = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) { const i = Math.floor(y * ss + sy) * n + Math.floor(x * ss + sx); if (p.Z[i] < -1e8) continue; cnt++; r += L[i * 3]; gg += L[i * 3 + 1]; b += L[i * 3 + 2]; if (p.E[i * 3] + p.E[i * 3 + 1] + p.E[i * 3 + 2] > 0) e++; }
    const o = y * size + x;
    if (cnt < ss * ss * 0.45) continue;
    cols[o * 3] = r / cnt; cols[o * 3 + 1] = gg / cnt; cols[o * 3 + 2] = b / cnt; glow[o] = e * 3 >= cnt ? 1 : 0;
    idx[o] = 0;
  }
  if (smooth) {
    // the big portrait keeps its lit colours (no snap), with a soft ink edge
    for (let o = 0; o < size * size; o++) if (idx[o] >= 0) { d[o * 4] = cols[o * 3]; d[o * 4 + 1] = cols[o * 3 + 1]; d[o * 4 + 2] = cols[o * 3 + 2]; d[o * 4 + 3] = 255; }
  } else {
    for (let o = 0; o < size * size; o++) if (idx[o] >= 0) idx[o] = glow[o] ? pal.list.length - 2 : snap(pal, cols[o * 3], cols[o * 3 + 1], cols[o * 3 + 2]);
    const src = Int16Array.from(idx);
    // edge shading: light along top edges, shade along bottom edges
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const o = y * size + x; if (src[o] < 0 || glow[o]) continue; if (y > 0 && src[o - size] < 0) idx[o] = pal.list[src[o]].up; else if (y < size - 1 && src[o + size] < 0) idx[o] = pal.list[src[o]].dn; }
    for (let o = 0; o < size * size; o++) if (idx[o] >= 0) { const c = pal.list[idx[o]].c; d[o * 4] = c[0]; d[o * 4 + 1] = c[1]; d[o * 4 + 2] = c[2]; d[o * 4 + 3] = 255; }
  }
  // the ink outline
  if (size >= 12) {
    const solid = new Uint8Array(size * size);
    for (let o = 0; o < size * size; o++) solid[o] = d[o * 4 + 3] ? 1 : 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const o = y * size + x;
      if (solid[o]) continue;
      if ((x > 0 && solid[o - 1]) || (x < size - 1 && solid[o + 1]) || (y > 0 && solid[o - size]) || (y < size - 1 && solid[o + size])) { d[o * 4] = pal.ink[0]; d[o * 4 + 1] = pal.ink[1]; d[o * 4 + 2] = pal.ink[2]; d[o * 4 + 3] = smooth ? 200 : 255; }
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
const mirror = (cv) => { const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; o.pixel = cv.pixel; const c = o.getContext('2d'); c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0); return o; };

// ---------------------------------------------------------------- the monster
const GEN = new Map(), MEMO = new Map();
const ANIM = { idle: [0, 1], walk: [0, 0.25, 0.5, 0.75], attack: [1, 2, 3], hurt: [0], dead: [0] };
// the camera angle for each of the five drawn views (dir 0 front … 4 back)
const PHI = [Math.PI / 2, Math.PI / 4, 0, -Math.PI / 4, -Math.PI / 2];
export function horror(seed, size = 32, opts = {}) {
  const S = Math.max(12, Math.round(size)), key = `${seed}|${S}|${opts.kind || ''}|${opts.tier ?? ''}|${opts.glow || ''}`;
  if (MEMO.has(key)) return MEMO.get(key);
  const gk = `${seed}|${opts.kind || ''}|${opts.tier ?? ''}|${opts.glow || ''}`;
  let g = GEN.get(gk);
  if (!g) { g = genome(seed, opts); GEN.set(gk, g); if (GEN.size > 200) GEN.delete(GEN.keys().next().value); }
  // supersample: 4× for small sprites, 3× for big ones (the grit comes out of the crush either way).
  // Details (wounds, drips, pustules) come from one stream, the same for every frame, so they stay put.
  const ss = S >= 40 ? 3 : 4, cache = new Map();
  const draw = (type, t, dir) => { g.R = mulberry32((seed * 31 + 5) >>> 0); return bake(g, paintFrame(g, S * ss, type, t, PHI[dir]), S); };
  const view = (anim, k = 0, dir = 2) => {
    const fr = ANIM[anim] || ANIM.idle, kk = clamp(k | 0, 0, fr.length - 1), d = ((dir | 0) % 8 + 8) % 8, ck = `${anim}|${kk}|${d}`;
    let cv = cache.get(ck);
    if (!cv) { cv = d > 4 ? mirror(view(anim, kk, 8 - d)) : draw(anim, fr[kk], d); cache.set(ck, cv); }
    return cv;
  };
  const hide = toHex(g.skin[0]);
  const out = { view, dirs: 8, frames: [view('idle', 0), view('idle', 1)], name: g.name, species: g.species, element: ELEMENT[g.kind], kind: g.kind, floats: !!g.float, tier: g.tier, size: S, horror: true, hue: 0, genome: g,
    palette: { body: hide, shade: toHex(g.skin[2]), dark: toHex(shadeC(g.skin[2], -0.3)), light: toHex(g.skin[1]), belly: toHex(g.skin[1]), accent: toHex(g.horn[1]), glow: toHex(g.glow), glowDeep: toHex(shadeC(g.glow, -0.4)), eye: toHex(g.glow), outline: '#0b0809', colors: [g.skin[0], g.skin[1], g.cloth[0], g.bone[0], g.blood[1]].map(toHex) } };
  const lazy = (k, fn) => { let v; Object.defineProperty(out, k, { get: () => v || (v = fn()), enumerable: true }); };
  lazy('walk', () => ANIM.walk.map((_, k) => view('walk', k)));
  lazy('attack', () => ANIM.attack.map((_, k) => view('attack', k)));
  lazy('hurt', () => view('hurt'));
  lazy('dead', () => view('dead'));
  lazy('big', () => { g.R = mulberry32(seed * 31 + 5); return bake(g, paintFrame(g, 320, 'idle', 0, PHI[1]), 160, true); });
  lazy('anatomy', () => {
    const fl = g.kind === 'abom' || g.kind === 'hound' ? g.skin[1] : shadeC([170, 70, 66], -0.1), dem = g.kind === 'demon' || g.kind === 'imp';
    return { hide, fur: toHex(g.skin[1]), flesh: toHex(fl), blood: toHex(dem ? [70, 6, 10] : g.kind === 'zombie' ? [76, 20, 14] : g.blood[0]), glow: g.kind === 'wraith' ? toHex(g.glow) : dem && (g.seed & 1) ? toHex(g.glow) : null, spirit: false, horror: true,
      organs: [{ kind: 'heart', col: '#7a1018', size: 1 }, { kind: 'liver', col: '#4a1a12', size: 1.1 }, { kind: 'lungs', col: '#9a5a5a', size: 1 }, { kind: 'gut', col: g.kind === 'zombie' ? '#6a6a3a' : '#8a4a4a', size: 1.3 }, { kind: 'bone', col: toHex(g.bone[0]), size: 0.9 }, { kind: 'eye', col: '#e8e0c8', size: 0.5 }] };
  });
  MEMO.set(key, out);
  if (MEMO.size > 160) MEMO.delete(MEMO.keys().next().value);
  return out;
}
// the same monster at several sizes at once (16 px for a map, 32 for the field, 64 for a boss)
export const horrorSet = (seed, sizes = [16, 32, 64], opts = {}) => Object.fromEntries(sizes.map((s) => [s, horror(seed, s, opts)]));
export const horrorName = (seed, kind) => genome(seed, { kind }).name;
// which of the eight views to show: the monster faces `facing` (radians, the game's own convention),
// the camera is at angle `toCamera` from it. Returns 0 (face on) … 4 (from behind) … 7.
export const viewDir = (facing, toCamera) => { let d = (toCamera - facing) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return ((Math.round(d / (Math.PI / 4)) % 8) + 8) % 8; };
