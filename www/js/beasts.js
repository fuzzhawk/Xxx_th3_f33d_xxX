// BEASTS — procedural creatures in the spirit of MARROW: a seeded genome picks a
// body plan (quadruped, biped brute, insect, spider, serpent, bird, floater, slime,
// crab, centipede), builds a skeleton of tapered capsules for each pose, and a
// signed-distance rasteriser shades it into pixel art: lit normals quantised to a
// four-tone ramp, near limbs in front of the body and far limbs behind it in a
// darker tone, patterned hide, eyes, selective outline. Poses are procedural:
// gaits with phase-shifted legs, tail and tentacle waves, wing beats, a bite or
// lunge, a hit recoil and a death fall. Some beasts get a dithered, gritty finish.
import { mulberry32 } from './util.js';

const PLANS = ['quad', 'brute', 'insect', 'spider', 'serpent', 'bird', 'floater', 'slime', 'crab', 'centipede'];
const LEGACY = { blob: 'slime', biped: 'brute', quad: 'quad', insect: 'insect', serpent: 'serpent', floater: 'floater', totem: 'crab' };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hsl = (h, s, l) => { h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; };
const ramp = (h, s, l) => [hsl(h + 8, s * 0.9, l * 0.42), hsl(h + 4, s, l * 0.7), hsl(h, s, l), hsl(h - 6, s * 0.8, Math.min(92, l * 1.3))];

// ---------------------------------------------------------------- genome
export function genome(seed, hue = 0, tier = 0, opts = {}) {
  const R = mulberry32((seed ^ 0x6a09e667) >>> 0), r = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length)];
  const plan = LEGACY[opts.plan] || (PLANS.includes(opts.plan) ? opts.plan : pick(PLANS));
  const h = hue + r(-25, 25), sat = r(35, 70), lit = r(38, 60);
  const g = {
    seed, plan, tier,
    len: r(0.9, 1.5), girth: r(0.75, 1.3) * (1 + tier * 0.06), legLen: r(0.7, 1.35), legW: r(0.7, 1.3), neck: r(0, 1), headR: r(0.8, 1.35), snout: r(0, 1), jaw: r(0.3, 1),
    horns: R() < 0.45 + tier * 0.1 ? { n: 1 + Math.floor(R() * 2), len: r(0.5, 1.4) * (1 + tier * 0.15), curve: r(-1, 1) } : null,
    ears: R() < 0.4, spikes: R() < 0.35 + tier * 0.1 ? 2 + Math.floor(R() * 4) : 0, tail: r(0, 1.4), tailR: r(0.4, 1),
    wings: plan === 'bird' || (R() < 0.12 + tier * 0.05 && ['quad', 'brute', 'serpent'].includes(plan)),
    eyes: plan === 'spider' ? 6 : R() < 0.12 ? 3 : R() < 0.1 ? 1 : 2, eyeSize: r(0.8, 1.6), glow: R() < 0.25,
    pattern: pick(['none', 'none', 'stripes', 'spots', 'plates', 'belly']), stripeK: r(5, 12),
    tentacles: 3 + Math.floor(R() * 4), segments: 5 + Math.floor(R() * 6), speed: r(0.8, 1.3),
    pal: { body: ramp(h, sat, lit), belly: ramp(h + r(10, 40), sat * 0.6, Math.min(80, lit * 1.35)), accent: ramp(h + pick([150, 180, 210, 90]), r(50, 85), r(42, 62)), horn: ramp(r(30, 50), 20, r(65, 85)), eye: R() < 0.5 ? [255, 236, 120] : [235, 240, 230], pupil: [18, 12, 10], outline: hsl(h, sat * 0.6, 9) },
    grit: opts.grit ?? (R() < 0.3 ? r(0.5, 1) : 0)
  };
  return g;
}

// ---------------------------------------------------------------- skeleton for a pose
// pose: { t (cycle 0..1), walk (0/1), atk (0..1 lunge), hurt (0..1), dead (0..1), fly }
function build(g, pose) {
  const P = [], E = [], s = Math.sin, c = Math.cos, TAU = Math.PI * 2;
  const cap = (ax, ay, bx, by, ra, rb, layer, role, u0 = 0, u1 = 1) => P.push({ ax, ay, bx, by, ra, rb, layer, role, u0, u1 });
  const ph = pose.t * TAU, w = pose.walk ? 1 : 0.25, atk = pose.atk || 0, hurt = pose.hurt || 0;
  const G = g.girth, L = g.len;
  // a leg: hip → knee → foot, with gait phase; knee bends forward (k=1) or back (k=-1)
  const leg = (hx, hy, len, rad, phase, layer, k = 1, lift = 1) => {
    const sw = s(ph + phase) * 0.45 * w, up = Math.max(0, c(ph + phase)) * 0.35 * w * lift;
    const fx = hx + sw * len * 0.6, fy = 0 + up * len * 0.4;
    const mx = (hx + fx) / 2 + k * len * 0.22, my = (hy + fy) / 2 + len * 0.05;
    cap(hx, hy, mx, my, rad, rad * 0.8, layer, 'body'); cap(mx, my, fx, fy, rad * 0.8, rad * 0.55, layer, 'body');
    cap(fx, fy, fx + 0.12 * len * (k > 0 ? 1 : 0.6), fy, rad * 0.55, rad * 0.4, layer, 'claw');
  };
  const head = (x, y, R0, ang = 0) => {
    const jaw = (0.08 + atk * 0.6) * g.jaw;
    cap(x, y, x + c(ang) * R0 * (0.4 + g.snout * 0.9), y + s(ang) * R0 * 0.2 - R0 * 0.1, R0, R0 * (0.55 - g.snout * 0.15), 1.5, 'body');
    cap(x + R0 * 0.1, y - R0 * 0.35, x + c(ang - jaw) * R0 * (0.5 + g.snout * 0.8), y - R0 * 0.35 - s(jaw) * R0 * 0.8, R0 * 0.5, R0 * 0.32, 1.45, 'belly');
    if (g.horns) for (let i = 0; i < g.horns.n; i++) { const hx = x - R0 * 0.2 + i * R0 * 0.35, hy = y + R0 * 0.75, hl = R0 * g.horns.len * 1.4; cap(hx, hy, hx + hl * (0.3 + g.horns.curve * 0.4), hy + hl * 0.8, R0 * 0.28, R0 * 0.05, 1.6 - i * 0.2, 'horn'); }
    if (g.ears) cap(x - R0 * 0.35, y + R0 * 0.6, x - R0 * 0.75, y + R0 * 1.25, R0 * 0.3, R0 * 0.08, 1.4, 'accent');
    const ne = g.eyes === 1 ? 1 : Math.min(g.eyes, 3);
    for (let i = 0; i < ne; i++) E.push({ x: x + R0 * (0.35 + i * 0.28), y: y + R0 * (0.3 - (i % 2) * 0.12), r: R0 * 0.24 * g.eyeSize, layer: 1.7 });
    if (g.eyes > 3) for (let i = 0; i < g.eyes - 3; i++) E.push({ x: x + R0 * (0.15 + i * 0.22), y: y + R0 * 0.6, r: R0 * 0.14, layer: 1.7 });
  };
  const tail = (x, y, len, rad, dir = -1) => {
    let px = x, py = y; const n = 5;
    for (let i = 0; i < n; i++) { const a = Math.PI * (dir < 0 ? 1 : 0) + s(ph * g.speed + i * 0.9) * 0.35 + (dir < 0 ? -0.25 : 0.25) + i * 0.08; const nx = px + c(a) * len / n, ny = py + s(a) * len / n * 0.6 + (i === n - 1 ? 0 : 0); cap(px, py, nx, ny, rad * (1 - i / n) + 0.02, rad * (1 - (i + 1) / n) + 0.02, 0.9, 'body', i / n, (i + 1) / n); px = nx; py = ny; }
  };
  const wing = (x, y, span, layer) => {
    const f = s(ph * 2) * 0.8 * (pose.fly ? 1 : 0.4);
    const tx = x - span * 0.5, ty = y + span * (0.5 + f), mx = x - span * 0.2, my = y + span * (0.35 + f * 0.6);
    cap(x, y, mx, my, span * 0.1, span * 0.08, layer, 'accent'); cap(mx, my, tx, ty, span * 0.08, span * 0.03, layer, 'accent');
    cap(x, y, tx + span * 0.1, ty - span * 0.35, span * 0.06, span * 0.18, layer - 0.05, 'accent');
  };
  const lean = atk * 0.35 - hurt * 0.3;
  switch (g.plan) {
    case 'quad': {
      const hy = g.legLen * 0.9 + 0.1 + s(ph * 2) * 0.03 * w, bx = L * 0.5;
      leg(-bx * 0.7, hy, g.legLen, 0.13 * g.legW, Math.PI, 0.5, -1); leg(bx * 0.7, hy, g.legLen, 0.13 * g.legW, 0, 0.5, 1);
      cap(-bx, hy + 0.05, bx, hy + 0.12 + lean * 0.3, 0.32 * G, 0.36 * G, 1, 'body');
      leg(-bx * 0.55, hy, g.legLen, 0.15 * g.legW, 0, 2, -1); leg(bx * 0.6, hy, g.legLen, 0.15 * g.legW, Math.PI, 2, 1);
      const nx = bx + 0.15 + g.neck * 0.35 + atk * 0.4, ny = hy + 0.3 + g.neck * 0.35 - atk * 0.2;
      cap(bx, hy + 0.15, nx, ny, 0.22 * G, 0.17 * G, 1.2, 'body'); head(nx + 0.1, ny, 0.25 * g.headR, -atk * 0.3);
      if (g.tail > 0.15) tail(-bx, hy + 0.15, g.tail * 0.9, 0.1 * g.tailR);
      if (g.wings) wing(0, hy + 0.35, 1.2, 1.3);
      for (let i = 0; i < g.spikes; i++) { const sx = -bx + (i + 0.5) * (2 * bx / g.spikes); cap(sx, hy + 0.35 * G, sx - 0.05, hy + 0.35 * G + 0.25, 0.07, 0.01, 1.05, 'horn'); }
      break;
    }
    case 'brute': {
      const hy = g.legLen * 0.75 + 0.1, ty = hy + 0.7 * L;
      leg(-0.08, hy, g.legLen * 0.85, 0.15 * g.legW, Math.PI, 0.5, 1); cap(-0.15, 0.6 * ty, 0.1 + atk * 0.5, 0.35 * ty, 0.12, 0.1, 0.5, 'body');
      cap(0, hy, 0.05 + lean * 0.4, ty, 0.3 * G, 0.36 * G, 1, 'body'); cap(0.1, hy + 0.1, 0.12, ty - 0.1, 0.18 * G, 0.22 * G, 1.1, 'belly');
      leg(0.08, hy, g.legLen * 0.85, 0.16 * g.legW, 0, 2, 1);
      const ax = 0.15 + atk * 0.8, ay = ty - 0.1 - atk * 0.05 + hurt * 0.3;
      cap(0.05 + lean * 0.4, ty - 0.05, ax, ay - 0.35 + atk * 0.3, 0.13 * G, 0.12 * G, 2, 'body'); cap(ax, ay - 0.35 + atk * 0.3, ax + 0.15 + atk * 0.3, ay - 0.6 + atk * 0.5, 0.12 * G, 0.15 * G, 2, 'body');
      head(0.12 + lean * 0.5, ty + 0.25 * g.headR, 0.27 * g.headR, -0.2 + atk * 0.2);
      if (g.tail > 0.5) tail(-0.2, hy + 0.1, g.tail * 0.7, 0.09 * g.tailR);
      if (g.wings) wing(-0.1, ty, 1.1, 0.7);
      break;
    }
    case 'insect': case 'spider': {
      const spider = g.plan === 'spider', hy = g.legLen * 0.45 + 0.15;
      const pairs = spider ? 4 : 3;
      for (let i = 0; i < pairs; i++) { const x = (i - (pairs - 1) / 2) * 0.22; leg(x, hy, g.legLen * (spider ? 1.1 : 0.8), 0.05, i * 1.7 + Math.PI, 0.5, 1, 1.4); }
      cap(-0.55 * L, hy + 0.15, -0.1, hy + 0.08, spider ? 0.42 * G : 0.3 * G, 0.18 * G, 1, 'body', 0, 0.5);
      cap(-0.1, hy + 0.08, 0.25, hy + 0.1, 0.17 * G, 0.15 * G, 1.1, 'body', 0.5, 1);
      for (let i = 0; i < pairs; i++) { const x = (i - (pairs - 1) / 2) * 0.22 + 0.05; leg(x, hy, g.legLen * (spider ? 1.1 : 0.8), 0.06, i * 1.7, 2, 1, 1.4); }
      head(0.42 + atk * 0.3, hy + 0.12, 0.17 * g.headR, -atk * 0.2);
      if (!spider) { cap(0.5, hy + 0.25, 0.75, hy + 0.65 + s(ph) * 0.05, 0.02, 0.015, 1.8, 'accent'); cap(0.48, hy + 0.25, 0.68, hy + 0.7, 0.02, 0.015, 1.3, 'accent'); }
      if (g.wings) wing(-0.1, hy + 0.3, 0.8, 1.3);
      break;
    }
    case 'serpent': {
      let px = -0.9 * L, py = 0.12; const n = g.segments, seg = 1.8 * L / n;
      for (let i = 0; i < n; i++) { const a = s(ph * g.speed * 1.5 - i * 0.9) * 0.5 * (i / n), nx = px + c(a) * seg, ny = 0.12 + Math.max(0, s(ph * 1.5 - i * 0.9)) * 0.08 + (i / n) * 0.15 * (1 + atk); const rr = 0.14 * G * (0.5 + Math.sin(Math.PI * (i + 1) / (n + 1)) * 0.8); cap(px, py, nx, ny, rr, rr, 1, 'body', i / n, (i + 1) / n); px = nx; py = ny; }
      const hx = px + 0.1 + atk * 0.35, hy2 = py + 0.25 + atk * 0.15; cap(px, py, hx, hy2, 0.13 * G, 0.12 * G, 1.1, 'body'); head(hx + 0.08, hy2, 0.2 * g.headR, -0.1 - atk * 0.3);
      if (g.wings) wing(0, 0.4, 0.9, 1.3);
      break;
    }
    case 'bird': {
      const hy = g.legLen * 0.5 + 0.12 + (pose.fly ? 0.4 + s(ph * 2) * 0.1 : 0);
      leg(-0.05, hy, g.legLen * 0.55, 0.035, Math.PI, 0.5, -1); cap(-0.4, hy + 0.1, 0.25, hy + 0.2, 0.3 * G, 0.25 * G, 1, 'body');
      cap(-0.35, hy + 0.15, -0.8 - g.tail * 0.3, hy + 0.35 + s(ph) * 0.05, 0.1, 0.02, 0.9, 'accent');
      leg(0.05, hy, g.legLen * 0.55, 0.04, 0, 2, -1);
      head(0.38 + atk * 0.25, hy + 0.45, 0.2 * g.headR, -atk * 0.5);
      cap(0.55 + atk * 0.25, hy + 0.45, 0.75 + atk * 0.3 + g.snout * 0.15, hy + 0.38 - atk * 0.1, 0.07, 0.015, 1.9, 'horn');
      wing(0, hy + 0.35, 1, 2.2);
      break;
    }
    case 'floater': {
      const hy = 0.9 + s(ph) * 0.08 - hurt * 0.1, R0 = 0.42 * G;
      for (let i = 0; i < g.tentacles; i++) { let px = -R0 * 0.8 + i * (1.6 * R0 / Math.max(1, g.tentacles - 1)), py = hy - R0 * 0.5; for (let k = 0; k < 4; k++) { const nx = px + s(ph * 1.5 + i + k * 0.8) * 0.06, ny = py - 0.16; cap(px, py, nx, ny, 0.05 - k * 0.01, 0.04 - k * 0.01, i % 2 ? 0.6 : 1.8, 'accent'); px = nx; py = ny; } }
      cap(-0.05, hy, 0.05 + atk * 0.2, hy + 0.05, R0, R0 * 0.95, 1, 'body');
      const ne = Math.max(1, Math.min(3, g.eyes)); for (let i = 0; i < ne; i++) E.push({ x: (i - (ne - 1) / 2) * R0 * 0.55 + 0.1, y: hy + 0.05, r: R0 * 0.28 * g.eyeSize, layer: 1.7 });
      if (g.horns) cap(0, hy + R0 * 0.8, 0.1, hy + R0 * 0.8 + 0.3 * g.horns.len, 0.06, 0.01, 1.2, 'horn');
      break;
    }
    case 'slime': {
      const sq = s(ph * 2) * 0.12 * (0.5 + w), R0 = 0.45 * G;
      cap(-R0 * 0.35, R0 * (0.75 - sq), R0 * 0.35 + atk * 0.3, R0 * (0.75 - sq), R0 * (1 + sq * 0.6), R0 * (1 + sq * 0.6), 1, 'body');
      cap(-R0 * 0.6, 0.05, R0 * 0.6, 0.05, R0 * 0.35, R0 * 0.35, 1.05, 'belly');
      const ne = Math.max(1, Math.min(3, g.eyes)); for (let i = 0; i < ne; i++) E.push({ x: R0 * (0.1 + i * 0.35) + atk * 0.3, y: R0 * (1 - sq), r: R0 * 0.22 * g.eyeSize, layer: 1.7 });
      if (g.horns) cap(0, R0 * 1.6, 0.1, R0 * 1.6 + 0.3 * g.horns.len, 0.06, 0.01, 1.2, 'horn');
      break;
    }
    case 'crab': {
      const hy = g.legLen * 0.4 + 0.15;
      for (let i = 0; i < 3; i++) leg(-0.35 + i * 0.25, hy, g.legLen * 0.65, 0.05, i * 2, 0.5, i < 1 ? -1 : 1, 1.3);
      cap(-0.45 * L, hy + 0.12, 0.45 * L, hy + 0.12, 0.25 * G, 0.25 * G, 1, 'body');
      for (let i = 0; i < 3; i++) leg(-0.3 + i * 0.25, hy, g.legLen * 0.65, 0.06, i * 2 + 1, 2, i < 1 ? -1 : 1, 1.3);
      const cx = 0.55 * L + atk * 0.3, cy = hy + 0.25 + atk * 0.1;
      cap(0.3, hy + 0.1, cx, cy, 0.08, 0.08, 2, 'body'); cap(cx, cy, cx + 0.2, cy + 0.12 + atk * 0.1, 0.14 * G, 0.06, 2.1, 'accent'); cap(cx, cy, cx + 0.22, cy - 0.04 - atk * 0.1, 0.11 * G, 0.04, 2.05, 'accent');
      for (const dx of [0.1, 0.25]) { cap(dx, hy + 0.3, dx + 0.02, hy + 0.55, 0.025, 0.025, 1.3, 'body'); E.push({ x: dx + 0.02, y: hy + 0.58, r: 0.06 * g.eyeSize, layer: 1.7 }); }
      break;
    }
    default: { // centipede
      const n = g.segments + 2, seg = 1.2 * L / n, hy = 0.3;
      for (let i = 0; i < n; i++) { const x = -0.85 * L + i * seg, y = hy + s(ph * 1.5 - i * 0.7) * 0.03; cap(x, y, x + seg, y, 0.19 * G, 0.19 * G, 1, 'body', i / n, (i + 1) / n); leg(x + seg / 2, y, 0.4, 0.04, i * 1.3, 0.5, 1, 1.5); leg(x + seg / 2 + 0.03, y, 0.4, 0.045, i * 1.3 + Math.PI, 2, 1, 1.5); }
      head(-0.85 * L + n * seg + 0.08 + atk * 0.25, hy + 0.08, 0.15 * g.headR, -atk * 0.2);
      cap(-0.85 * L + n * seg + 0.18, hy + 0.15, -0.85 * L + n * seg + 0.35 + atk * 0.2, hy + 0.05, 0.03, 0.01, 2, 'horn');
    }
  }
  return { P, E };
}

// ---------------------------------------------------------------- rasteriser
function rasterise(g, pose, S, fit) {
  const { P, E } = build(g, pose);
  const out = new Uint8ClampedArray(S * S * 4), depth = new Float32Array(S * S).fill(-1);
  const { k, ox, oy } = fit;
  const L = [-0.45, 0.65, 0.62];
  const dead = pose.dead || 0, hurt = pose.hurt || 0;
  // death: the body tips over onto its back; a hit knocks it back a little
  const rot = -dead * Math.PI * 0.5 * (g.plan === 'floater' || g.plan === 'slime' ? 0 : 1), cr = Math.cos(rot), sr = Math.sin(rot), sink = g.plan === 'floater' ? dead * 0.6 : 0, squash = g.plan === 'slime' ? 1 - dead * 0.6 : 1;
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    let x = (px + 0.5 - ox) / k + hurt * 0.12, y = (oy - (py + 0.5)) / k - sink;
    if (rot) { const ax = 0, ay = 0.05; const dx = x - ax, dy = y - ay; x = ax + dx * cr + dy * sr; y = ay - dx * sr + dy * cr; }
    if (squash !== 1) y /= squash;
    let best = null, bz = -1e9, bn = null, bu = 0;
    for (const q of P) {
      const bx = q.bx - q.ax, by = q.by - q.ay, l2 = bx * bx + by * by || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - q.ax) * bx + (y - q.ay) * by) / l2));
      const cx = q.ax + bx * t, cy = q.ay + by * t, rr = q.ra + (q.rb - q.ra) * t, dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const h = Math.sqrt(rr * rr - d2), z = q.layer * 10 + h;
      if (z > bz) { bz = z; best = q; bn = [dx / rr, dy / rr, h / rr]; bu = q.u0 + (q.u1 - q.u0) * t; }
    }
    let col = null;
    if (best) {
      let lum = Math.max(0, bn[0] * L[0] + bn[1] * L[1] + bn[2] * L[2]);
      if (best.layer < 0.8) lum *= 0.55; // far limbs sit in shadow
      let role = best.role;
      if (role === 'body') {
        if (g.pattern === 'stripes' && Math.sin((x * 1.7 + bu * 2) * g.stripeK) > 0.55) role = 'accent';
        else if (g.pattern === 'spots' && (((Math.floor(x * 9) * 73856093) ^ (Math.floor(y * 9) * 19349663)) >>> 0) % 7 === 0) role = 'accent';
        else if (g.pattern === 'plates' && bn[1] > 0.45) role = 'horn';
        else if ((g.pattern === 'belly' || g.plan === 'serpent') && bn[1] < -0.35) role = 'belly';
      }
      const rampC = g.pal[role] || g.pal.body;
      // ordered dithering between tones for the gritty finish
      const dth = g.grit ? (BAYER[(py & 3) * 4 + (px & 3)] / 16 - 0.5) * 0.5 * g.grit : 0;
      const idx = Math.max(0, Math.min(3, Math.floor((lum + dth) * 3.6)));
      col = rampC[idx];
      if (hurt > 0.5) col = col.map((v) => v * 0.5 + 128);
    }
    for (const e of E) {
      const ex = e.x, ey = e.y, d = Math.hypot(x - ex, y - ey);
      if (d < e.r && e.layer * 10 > bz - 12) {
        col = dead > 0.5 ? (d < e.r * 0.5 ? g.pal.pupil : g.pal.body[0]) : d < e.r * 0.45 ? g.pal.pupil : g.glow ? [255, 90, 60] : g.pal.eye;
        if (!dead && d < e.r * 0.25 && x < ex) col = [255, 255, 255];
        best = best || {};
      }
    }
    if (col) { const i = (py * S + px) * 4; out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2]; out[i + 3] = 255; depth[py * S + px] = bz; }
  }
  // selective outline: transparent pixels touching the body take a dark tone; specks for grit
  const R = mulberry32(g.seed + Math.floor((pose.t || 0) * 97));
  const o = out.slice();
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const i = (py * S + px) * 4;
    if (out[i + 3]) { if (g.grit && R() < 0.05 * g.grit) { o[i] *= 0.6; o[i + 1] *= 0.55; o[i + 2] *= 0.5; } continue; }
    const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < S && yy < S && out[(yy * S + xx) * 4 + 3];
    if (n(px - 1, py) || n(px + 1, py) || n(px, py - 1) || n(px, py + 1)) { const oc = g.pal.outline; o[i] = oc[0]; o[i + 1] = oc[1]; o[i + 2] = oc[2]; o[i + 3] = 255; }
  }
  return o;
}
// scale so the rest pose fills the frame, feet on the bottom row
function fitFor(g, S) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const t of [0, 0.25, 0.5, 0.75]) {
    const { P, E } = build(g, { t, walk: 1 });
    for (const q of P) for (const [x, y, r] of [[q.ax, q.ay, q.ra], [q.bx, q.by, q.rb]]) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
    for (const e of E) { y1 = Math.max(y1, e.y + e.r); }
  }
  const k = (S - 3) / Math.max(x1 - x0, y1 - y0) * 0.92;
  return { k, ox: (S - (x1 - x0) * k) / 2 - x0 * k, oy: S - 2 + Math.min(0, y0) * k };
}

const toCanvas = (data, S) => { const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').putImageData(new ImageData(data, S, S), 0, 0); c.pixel = true; return c; };
// A beast: { frames: [a, b], walk: [4], attack: [3], hurt, dead, plan, hue, genome }
export function beast(seed, hue = 0, size = 24, tier = 0, opts = {}) {
  const g = genome(seed, hue, tier, opts), S = Math.max(16, Math.round(size * 1.35)), fit = fitFor(g, S);
  const fly = g.plan === 'bird' && opts.fly;
  const fr = (pose) => toCanvas(rasterise(g, { fly, ...pose }, S, fit), S);
  const walk = [0, 0.25, 0.5, 0.75].map((t) => fr({ t, walk: 1 }));
  // dead: legged beasts flop onto their backs, legs in the air; floaters sink and slimes splat
  let dead;
  if (g.plan === 'floater' || g.plan === 'slime') dead = fr({ t: 0.2, dead: 1 });
  else {
    const src = toCanvas(rasterise(g, { t: 0.15, walk: 0 }, S, fit), S);
    dead = document.createElement('canvas'); dead.width = dead.height = S; dead.pixel = true;
    const x = dead.getContext('2d'), d = src.getContext('2d').getImageData(0, 0, S, S).data;
    let top = S; for (let i = 3; i < d.length; i += 4) if (d[i]) { top = Math.floor((i >> 2) / S); break; }
    x.translate(0, S - 1 + top); x.scale(1, -1); x.drawImage(src, 0, 0);
  }
  return { frames: [walk[0], walk[2]], walk, attack: [0.3, 0.8, 0.4].map((a) => fr({ t: 0.1, atk: a })), hurt: fr({ t: 0.2, hurt: 0.7 }), dead, plan: g.plan, hue, genome: g };
}
export const BEAST_PLANS = PLANS;
