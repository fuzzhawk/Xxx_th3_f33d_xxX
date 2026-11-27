// The garden's upper and lower worlds, as big as the country and streamed in chunks the same way.
//   The sky realm (SKY_H up): large floating islands of the dream, the tops of the city's tallest towers made into
//   gardens, and plank bridges joining them all, so it can be walked end to end. Lifts rise to it from towers under
//   the islands and from the towers' feet on the city streets.
//   The deep (DEEP_H down, far below even the canyons): vast caverns with tall rock walls and pillars that rise out of
//   sight, glowing fungus woods, crystal hollows, a black lake, sunken ruins, and under the city the machine deep, its
//   great engines still turning; wide tunnels join them. Great lifts go down from each canyon floor and from the city.
import { RNG, fbm, hash2, clamp, lerp } from '../mk/tex.js';
import { BIOMES, BIOME_KEYS, ISLES } from './lands.js';
import { PROPDEF } from './art.js';

export const SKY_H = 1150, DEEP_H = -1000;
const TS = 16, CS = 16;
const K_GROUND = 0, K_PATH = 1, K_FLOOR = 2, K_WATER = 3, K_WALL = 5, K_BRIDGE = 6, K_TOXIC = 7, K_VOID = 255, NOLO = -32768;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// segments in buckets by chunk (the bridges, the tunnels): nearest one to a point, how far along it
class Segs {
  constructor() { this.b = new Map(); }
  add(x0, y0, x1, y1, w, tag, s0 = 0, s1 = 0) { const s = { x0, y0, x1, y1, w, tag, s0, s1 }, m = w + 3; for (let cy = Math.floor((Math.min(y0, y1) - m) / CS); cy <= Math.floor((Math.max(y0, y1) + m) / CS); cy++) for (let cx = Math.floor((Math.min(x0, x1) - m) / CS); cx <= Math.floor((Math.max(x0, x1) + m) / CS); cx++) { const k = cy * 1000 + cx; let L = this.b.get(k); if (!L) this.b.set(k, (L = [])); L.push(s); } }
  near(x, y) { const L = this.b.get(Math.floor(y / CS) * 1000 + Math.floor(x / CS)); if (!L) return null; let bd = 1e9, bs = null, bt = 0; for (const s of L) { const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy || 1, t = clamp(((x - s.x0) * dx + (y - s.y0) * dy) / l2, 0, 1), d = Math.hypot(x - s.x0 - dx * t, y - s.y0 - dy * t) - s.w; if (d < bd) { bd = d; bs = s; bt = t; } } return bs ? { d: bd, s: bs, t: bt, at: bs.s0 + (bs.s1 - bs.s0) * bt } : null; }
}
function meander(r, pts, depth, amp) {
  if (!depth) return pts; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], mx = (ax + bx) / 2, my = (ay + by) / 2, l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / (l || 1), ny = (bx - ax) / (l || 1), o = r.range(-1, 1) * l * amp; out.push([mx + nx * o, my + ny * o], [bx, by]); }
  return meander(r, out, depth - 1, amp);
}
// a spanning tree over points (by distance), plus a few extra links for loops
function tree(nodes, r, extra = 2) {
  const inT = [0], edges = [];
  while (inT.length < nodes.length) { let best = null, bd = 1e9; for (const i of inT) for (let j = 0; j < nodes.length; j++) { if (inT.includes(j)) continue; const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y); if (d < bd) { bd = d; best = [i, j]; } } inT.push(best[1]); edges.push(best); }
  for (let k = 0; k < extra * 10 && extra > 0; k++) { const i = r.int(0, nodes.length - 1), j = r.int(0, nodes.length - 1); if (i === j || edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue; if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < 220) { edges.push([i, j]); extra--; } }
  return edges;
}

// common to both: the chunk cache and the walk-and-draw interface the ground has (chunk, cell, biomeAt, baseAt)
class Layer {
  constructor(W, key, h) { this.W = W; this.key = key; this.kind = key; this.layer = true; this.h = h; this.i = key; this.chunks = new Map(); this.seed = (W.seed ^ (key === 'sky' ? 0x5c1e : 0xdee9)) >>> 0; this.ways = []; }
  baseAt() { return this.h; }
  chunk(cx, cy) {
    const key = cy * 1000 + cx; let C = this.chunks.get(key); if (C) return C;
    const n = CS + 2, N = n * n, b = new Uint8Array(N), k = new Uint8Array(N), e = new Int16Array(N), h = new Float32Array(N), f = new Uint8Array(N), lo = new Int16Array(N).fill(NOLO), dep = new Float32Array(N), x0 = cx * CS - 1, y0 = cy * CS - 1;
    let open = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const t = this.tileInfo(x0 + i, y0 + j), q = j * n + i; b[q] = t.b; k[q] = t.k; e[q] = t.e; h[q] = t.h; f[q] = t.f; dep[q] = t.dep || 0; if (t.k !== K_VOID) open++; }
    C = { cx, cy, b, k, e, h, f, lo, dep, n, solid: new Uint8Array(CS * CS), props: [], decals: [], lights: [], shafts: [], slabs: [], clouds: [], layer: this, voids: true, empty: !open, flat: false };
    const at = (i, j) => (j + 1) * n + i + 1;
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) { const kk = k[at(i, j)]; if (kk === K_TOXIC || kk === K_VOID) C.solid[j * CS + i] = 1; }
    if (open) this.populate(C, at);
    this.chunks.set(key, C);
    if (this.chunks.size > 900) for (const [kk] of this.chunks) { this.chunks.delete(kk); if (this.chunks.size < 700) break; }
    return C;
  }
  cell(px, py, o) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) { o.t = this.h; o.k = K_VOID; o.s = 1; o.lo = NOLO; return o; }
    const C = this.chunk(Math.floor(tx / CS), Math.floor(ty / CS)), i = tx - C.cx * CS, j = ty - C.cy * CS, Q = (j + 1) * C.n + i + 1;
    o.t = C.e[Q] + C.h[Q]; o.k = C.k[Q]; o.s = C.solid[j * CS + i]; o.lo = NOLO; return o;
  }
  // a prop helper for populate: its footprint made solid, its base the ground under it
  placer(C, at) {
    const X0 = C.cx * CS, Y0 = C.cy * CS, inChunk = (tx, ty) => tx >= X0 && ty >= Y0 && tx < X0 + CS && ty < Y0 + CS;
    const eAt = (tx, ty) => (inChunk(tx, ty) ? C.e[at(tx - X0, ty - Y0)] : this.h);
    const put = (type, x, y, fam, v, extra) => { const D = PROPDEF[type], tx0 = Math.floor(x / TS), ty0 = Math.floor((y - 2) / TS); C.props.push({ type, x, y, fam, v: v ?? Math.floor(hash2(x, y, this.seed + 3) * 3), e: eAt(tx0, ty0), ...extra }); if (D?.foot) { const fw = Math.max(1, Math.ceil(D.foot[0] / TS)), tx = tx0 - X0 - Math.floor((fw - 1) / 2), ty = ty0 - Y0; for (let i = tx; i < tx + fw; i++) if (i >= 0 && i < CS && ty >= 0 && ty < CS) C.solid[ty * CS + i] = 1; } };
    return { X0, Y0, inChunk, eAt, put };
  }
}

// ------------------------------------------------ the sky realm
export class SkyLayer extends Layer {
  constructor(W, r) {
    super(W, 'sky', SKY_H); this.name = 'The Sky Realm';
    const Wt = 1024, C = W.city, ccx = (C.x0 + C.x1) / 2, ccy = (C.y0 + C.y1) / 2, kinds = Object.keys(ISLES).filter((k) => !ISLES[k].canopy);
    // the islands: a ring of them round the city's towers, the rest out over the dream and the north
    const want = [[ccx - 95, ccy - 40], [ccx + 100, ccy - 20], [ccx - 20, ccy - 105], [ccx + 30, ccy + 105], [ccx - 260, ccy + 20], [ccx - 330, ccy + 230], [ccx - 380, ccy - 160], [ccx - 140, ccy + 300], [ccx + 260, ccy - 170], [ccx - 180, ccy - 230]];
    this.islands = [];
    want.forEach(([fx, fy], i) => {
      for (let t = 0; t < 40; t++) {
        const rad = r.int(28, 48), x = Math.round(clamp(fx + r.range(-40, 40), rad + 20, Wt - rad - 20)), y = Math.round(clamp(fy + r.range(-40, 40), rad + 20, Wt - rad - 20));
        if (this.islands.some((o) => Math.hypot(o.x - x, o.y - y) < o.rad + rad + 26) || W.towersNear(x, y, rad + 6)) continue;
        const key = kinds[i % kinds.length], I = { i, x, y, rad, key, b: BIOMES['sky_' + key].i, seed: r.int(1, 1e9), name: ISLES[key].name };
        I.lm = { x: x + r.int(-3, 3), y: y - Math.round(rad * 0.35) }; this.islands.push(I); break;
      }
    });
    // the bridges: a spanning tree over the islands and the tower tops, and a few more for loops
    const nodes = [...this.islands.map((I) => ({ x: I.x, y: I.y, I })), ...W.skyTowers.map((T) => ({ x: (T.x0 + T.x1) / 2, y: (T.y0 + T.y1) / 2, T }))];
    this.bridges = new Segs(); this.spans = [];
    for (const [a, b] of tree(nodes, r, 3)) {
      const A = nodes[a], B = nodes[b], pts = meander(r, [[A.x + 0.5, A.y + 0.5], [B.x + 0.5, B.y + 0.5]], 2, A.T && B.T ? 0 : 0.05);
      let L = 0; const cum = [0]; for (let k = 1; k < pts.length; k++) { L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); cum.push(L); }
      const sp = { A, B, pts, L, w: A.T || B.T ? 1.3 : 1.6, sag: Math.min(40, L * 0.08), hA: this.h, hB: this.h };
      for (let k = 1; k < pts.length; k++) this.bridges.add(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], sp.w, sp, cum[k - 1], cum[k]);
      this.spans.push(sp);
    }
    // lifts up from the ground: a tower right under the south of each island (where the ground is open)
    for (const I of this.islands) {
      let spot = null; for (let t = 0; t < 120 && !spot; t++) { const x = I.x + r.int(-10, 10), y = I.y + Math.round(I.rad * 0.4) + r.int(-6, 6); if (this.isleAt(x, y)?.d < 0.75 && W.tileInfo(x, y).k === K_GROUND && W.flat(x, y, 1) && W.canyonAt(x, y).d > 3 && !W.villageAt(x, y, 3)) spot = { x, y }; }
      if (spot) this.ways.push({ kind: 'isle', gx: spot.x, gy: spot.y, lx: spot.x, ly: spot.y, layer: this, name: I.name, I });
    }
    for (const T of W.skyTowers) this.ways.push({ kind: 'tower', gx: T.mx, gy: T.y1 + 1, lx: T.mx, ly: T.y1, layer: this, name: 'A Sky Garden', T });
  }
  isleAt(x, y) {
    for (const I of this.islands) { if (Math.abs(x - I.x) > I.rad * 1.4 || Math.abs(y - I.y) > I.rad * 1.4) continue; const d = Math.hypot((x - I.x) / I.rad, (y - I.y) / (I.rad * 0.8)) + (fbm(x / 7, y / 7, I.seed, 3) - 0.5) * 0.45; if (d < 1) return { I, d }; }
    return null;
  }
  // the island under a point (for the names, and for the creatures that circle them)
  islandNear(x, y) { let best = null, bd = 1e9; for (const I of this.islands) { const d = Math.hypot(I.x - x, I.y - y) - I.rad; if (d < bd) { bd = d; best = I; } } return best; }
  biomeAt(x, y) { const a = this.isleAt(x, y); return a ? a.I.b : this.W.towerAt(x, y) ? BIOMES.sky_garden.i : BIOMES.sky_windtemple.i; }
  tileInfo(x, y) {
    const out = { b: BIOMES.sky_windtemple.i, k: K_VOID, e: this.h, h: 0, f: 0, lo: NOLO, dep: 0 }, s = this.seed;
    const a = this.isleAt(x, y);
    if (a) {
      const { I, d } = a; out.b = I.b; out.k = K_GROUND;
      out.e = this.h + Math.round(Math.max(0, fbm(x / 14, y / 14, I.seed + 3, 3) - 0.42) * 2.4 * 44 * clamp((1 - d) * 2, 0, 1) / 8) * 8;
      if (d < 0.75 && fbm(x / 8, y / 8, I.seed + 9, 3) > 0.7 && Math.hypot(x - I.lm.x, y - I.lm.y) > 4) { out.k = K_WATER; out.e = this.h; }
      else if (Math.abs(fbm(x / 10, y / 10, I.seed + 21, 2) - 0.5) < 0.025) out.k = K_PATH;
      out.dep = 50 + fbm(x / 5, y / 5, I.seed + 7, 3) * 280 * Math.max(0.12, 1 - d);
      return out;
    }
    const T = this.W.towerAt(x, y);
    if (T) {
      out.b = BIOMES.sky_garden.i; out.k = K_GROUND; out.e = this.h;
      const edge = x === T.x0 || x === T.x1 || y === T.y0 || y === T.y1, br = this.bridges.near(x + 0.5, y + 0.5), gap = (br && br.d < 0.8) || (x === T.mx && y === T.y1) || (Math.abs(x - T.mx) <= 1 && y === T.y1);
      if (edge && !gap) { out.k = K_WALL; out.h = 8; } else if ((x + y) % 5 === 0) out.k = K_PATH;
      return out;
    }
    const br = this.bridges.near(x + 0.5, y + 0.5);
    if (br && br.d <= 0) { const sp = br.s.tag, t = clamp(br.at / sp.L, 0, 1); out.k = K_BRIDGE; out.e = Math.round(lerp(sp.hA, sp.hB, t) - sp.sag * Math.sin(Math.PI * t)); out.dep = 6; out.b = BIOMES.sky_windtemple.i; void s; }
    return out;
  }
  populate(C, at) {
    const { X0, Y0, inChunk, eAt, put } = this.placer(C, at), s = this.seed, rr = (x, y, q) => hash2(x * 7 + q, y * 13 + q * 3, s + 101);
    // the ways down, and the landmarks and treasures of the islands
    for (const w of this.ways) if (inChunk(w.lx, w.ly)) { put('liftpad', w.lx * TS + 8, w.ly * TS + 12, 'rust', 0, { way: w }); C.lights.push({ x: w.lx * TS + 8, y: w.ly * TS + 12, h: eAt(w.lx, w.ly) + 20, r: 24, c: [255, 190, 110], beacon: 1 }); }
    for (const I of this.islands) if (inChunk(I.lm.x, I.lm.y)) { const L = ISLES[I.key], T = I.treasure; put(L.land, I.lm.x * TS + 8, I.lm.y * TS + 12, L.fam, 0, { landmark: T || null }); C.lights.push({ x: I.lm.x * TS + 8, y: I.lm.y * TS + 12, h: eAt(I.lm.x, I.lm.y) + 44, r: 40, c: [220, 230, 255] }); }
    for (const T of this.W.treasures) if (T.place === this && inChunk(T.cx, T.cy)) put('chest', T.cx * TS + 8, T.cy * TS + 12, 'dream', 0, { chest: T });
    const keep = (x, y) => this.ways.some((w) => Math.abs(w.lx - x) <= 1 && Math.abs(w.ly - y) <= 1) || this.islands.some((I) => Math.abs(I.lm.x - x) <= 3 && Math.abs(I.lm.y - y) <= 3) || this.W.treasures.some((T) => T.place === this && Math.abs(T.cx - x) <= 1 && Math.abs(T.cy - y) <= 1);
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const x = X0 + i, y = Y0 + j, q = at(i, j), k = C.k[q]; if (k === K_VOID) continue;
      const B = BIOMES[BIOME_KEYS[C.b[q]]];
      if (k === K_BRIDGE) {
        // posts with lanterns along the rails
        const br = this.bridges.near(x + 0.5, y + 0.5); if (br && Math.round(br.at) % 5 === 0 && rr(x, y, 1) < 0.5) { put('skypost', x * TS + 8, y * TS + 8, 'dream', 0); if (rr(x, y, 2) < 0.5) C.lights.push({ x: x * TS + 8, y: y * TS + 8, h: C.e[q] + 22, r: 20, c: [255, 214, 140] }); }
        continue;
      }
      if (keep(x, y) || C.solid[j * CS + i]) continue;
      if (B.key === 'sky_garden') {
        if (k !== K_GROUND) continue; const v = rr(x, y, 3);
        if (v < 0.16) C.decals.push({ type: 'crops', x, y, fam: 'dream' }); else if (v < 0.26) put(rr(x, y, 4) < 0.5 ? 'flowerbush' : 'bush', x * TS + 8, y * TS + 14, 'dream'); else if (v < 0.29) put(rr(x, y, 5) < 0.5 ? 'blossom' : 'tree', x * TS + 8, y * TS + 14, 'dream'); else if (v < 0.3) put('greenhouse', x * TS + 8, y * TS + 14, 'dream'); else if (v < 0.31) { put('lanternshrine', x * TS + 8, y * TS + 12, 'dream'); C.lights.push({ x: x * TS + 8, y: y * TS + 12, h: C.e[q] + 22, r: 26, c: [255, 210, 140] }); } else if (v < 0.4) C.decals.push({ type: 'flowers', x, y, fam: 'dream' });
        continue;
      }
      if (k !== K_GROUND) continue;
      for (const [type, dens] of B.props) if (rr(x, y, 20 + type.length) < dens) { put(type, x * TS + 8 + (rr(x, y, 13) - 0.5) * 4, y * TS + 14, B.fam); if ((type === 'lanterntree' || type === 'glowshroom' || type === 'crystal') && rr(x, y, 31) < 0.4) C.lights.push({ x: x * TS + 8, y: y * TS + 10, h: C.e[q] + 14, r: 22, c: type === 'crystal' ? [160, 240, 230] : [255, 210, 140] }); break; }
      for (const [type, dens] of B.decals) if (rr(x, y, 40 + type.length) < dens) C.decals.push({ type, x, y, fam: B.fam });
    }
    // rocks floating under the islands, and the cloud deck far below them
    for (let k2 = 0; k2 < 3; k2++) { const x = (X0 + hash2(C.cx, C.cy + k2, s + 5) * CS) * TS, y = (Y0 + hash2(C.cx + k2, C.cy, s + 6) * CS) * TS, a = this.isleAt(x / TS, y / TS); if (a && a.d > 0.6 && hash2(C.cx, C.cy, s + 9 + k2) < 0.5) C.props.push({ type: 'floatrock', x, y, fam: ISLES[a.I.key].fam, v: k2 % 3, e: this.h - 60 - hash2(C.cx, k2, s) * 200, float: 1 }); }
    if (hash2(C.cx, C.cy, s + 77) < 0.55) C.clouds.push({ x: (X0 + 8) * TS, y: (Y0 + 8) * TS, h: this.h - 380 - hash2(C.cx, C.cy, s + 78) * 260, v: Math.floor(hash2(C.cx, C.cy, s + 79) * 4), s: 1.6 + hash2(C.cy, C.cx, s) * 1.6 });
  }
  biomeOf(C, q) { return C.b[q]; }
  // what to call where you stand
  nameAt(x, y) { const a = this.isleAt(x, y); if (a) return a.I.name; if (this.W.towerAt(x, y)) return 'A Sky Garden'; return 'The Sky Bridges'; }
}

// ------------------------------------------------ the deep
const CAVERN = { machine: { name: 'The Machine Deep', b: 'deep_machine' }, fungus: { name: 'The Glowing Wood', b: 'deep_fungus' }, crystal: { name: 'The Crystal Hollows', b: 'deep_crystal' }, lake: { name: 'The Black Lake', b: 'deep_lake' }, ruins: { name: 'The Sunken Works', b: 'deep_ruins' }, tunnel: { name: 'The Deep Ways', b: 'deep_rock' } };
export class DeepLayer extends Layer {
  constructor(W, r) {
    super(W, 'deep', DEEP_H); this.name = 'The Deep';
    const C = W.city, ccx = (C.x0 + C.x1) / 2, ccy = (C.y0 + C.y1) / 2;
    // the caverns: the machine deep under the city's heart, a chain of halls under each canyon, others between
    this.caverns = [{ x: ccx, y: ccy, rx: 78, ry: 62, kind: 'machine', seed: r.int(1, 1e9) }];
    const groups = [this.caverns[0]];
    W.canyons.forEach((Cn, ci) => {
      const kind = ['fungus', 'crystal', 'lake', 'fungus', 'ruins'][ci % 5]; let first = null;
      for (let s = 0; s <= Cn.L; s += 14) { const [px, py] = W.canyonPoint(Cn, s), cv = { x: px, y: py, rx: r.range(16, 24), ry: r.range(13, 18), kind, seed: r.int(1, 1e9) }; this.caverns.push(cv); first ||= cv; }
      groups.push(first);
    });
    for (const [kind, n] of [['fungus', 2], ['crystal', 1], ['lake', 1], ['ruins', 1]]) for (let q = 0; q < n; q++) for (let t = 0; t < 60; t++) {
      const x = r.range(120, 900), y = r.range(200, 900), rx = r.range(34, 56); if (this.caverns.some((o) => Math.hypot(o.x - x, o.y - y) < o.rx + rx + 30)) continue;
      const cv = { x, y, rx, ry: rx * r.range(0.65, 0.9), kind, seed: r.int(1, 1e9) }; this.caverns.push(cv); groups.push(cv); break;
    }
    // the tunnels: wide, winding ways between them
    this.tunnels = new Segs();
    for (const [a, b] of tree(groups, r, 2)) { const A = groups[a], B = groups[b], pts = meander(r, [[A.x, A.y], [B.x, B.y]], 4, 0.14), w = r.range(2.6, 3.6); for (let k = 1; k < pts.length; k++) this.tunnels.add(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], w, 'tunnel'); }
    // the ways down: a great lift in each canyon's floor, and three in the city's heart
    W.canyons.forEach((Cn) => { const [px, py] = W.canyonPoint(Cn, Cn.L * 0.4), x = Math.round(px), y = Math.round(py); this.ways.push({ kind: 'chasm', gx: x, gy: y, lx: x, ly: y, layer: this, name: 'The Deep', Cn }); });
    for (const [gx, gy] of W.greatLifts) this.ways.push({ kind: 'great', gx, gy, lx: gx, ly: gy, layer: this, name: 'The Machine Deep' });
  }
  cavernAt(x, y) { for (const cv of this.caverns) { if (Math.abs(x - cv.x) > cv.rx * 1.3 || Math.abs(y - cv.y) > cv.ry * 1.3) continue; const d = Math.hypot((x - cv.x) / cv.rx, (y - cv.y) / cv.ry) + (fbm(x / 9, y / 9, cv.seed, 3) - 0.5) * 0.5; if (d < 1) return { cv, d }; } return null; }
  openAt(x, y) { const a = this.cavernAt(x, y); if (a) return a; const t = this.tunnels.near(x, y); if (t && t.d + (fbm(x / 5, y / 5, this.seed, 2) - 0.5) * 1.6 < 0) return { cv: null, d: 1 }; for (const w of this.ways) if (Math.abs(w.lx - x) <= 3 && Math.abs(w.ly - y) <= 3) return { cv: null, d: 1 }; return null; }
  kindAt(x, y) { const a = this.openAt(x, y); return a?.cv ? a.cv.kind : 'tunnel'; }
  biomeAt(x, y) { return BIOMES[CAVERN[this.kindAt(x, y)].b].i; }
  tileInfo(x, y) {
    const out = { b: BIOMES.deep_rock.i, k: K_VOID, e: this.h, h: 0, f: 0, lo: NOLO, dep: 0 }, s = this.seed;
    const a = this.openAt(x, y);
    if (a) {
      const kind = a.cv ? a.cv.kind : 'tunnel'; out.b = BIOMES[CAVERN[kind].b].i; out.k = K_GROUND;
      out.e = this.h + Math.round((fbm(x / 12, y / 12, s + 3, 3) - 0.5) * 40 / 8) * 8;
      const nearWay = this.ways.some((w) => Math.abs(w.lx - x) <= 3 && Math.abs(w.ly - y) <= 3);
      if (nearWay) { out.e = this.h; return out; }
      if (kind === 'lake' && a.d < 0.85 && fbm(x / 10, y / 10, a.cv.seed + 5, 3) > 0.45) { out.k = K_WATER; out.e = this.h - 8; }
      else if (kind === 'machine' && Math.abs(Math.sin((x - a.cv.x) / 9) * 6 + (a.cv.y - y) * 0.4 + 10) < 1.2 && a.d < 0.85) { out.k = K_TOXIC; out.e = this.h - 8; }   // a channel of molten slag
      else if (a.cv && a.d < 0.8 && hash2(x, y, s + 11) < 0.004) { out.k = K_WALL; out.h = 560 + hash2(x, y, s + 12) * 240; }   // a pillar up into the dark
      else if (kind === 'machine' && hash2(Math.floor(x / 6), Math.floor(y / 6), s + 31) < 0.08 && x % 6 > 1 && y % 6 > 1) { out.k = K_FLOOR; }
      else if (Math.abs(fbm(x / 9, y / 9, s + 41, 2) - 0.5) < 0.02) out.k = K_PATH;
      return out;
    }
    // rock: a wall wherever it meets open ground, rising far up (the interior rock is never seen)
    let edge = false; for (let j = -1; j <= 1 && !edge; j++) for (let i = -1; i <= 1; i++) if ((i || j) && this.openAt(x + i, y + j)) { edge = true; break; }
    if (edge) { out.k = K_WALL; out.h = 300 + fbm(x / 6, y / 6, s + 51, 3) * 260; out.e = this.h; }
    return out;
  }
  populate(C, at) {
    const { X0, Y0, inChunk, eAt, put } = this.placer(C, at), s = this.seed, rr = (x, y, q) => hash2(x * 7 + q, y * 13 + q * 3, s + 101);
    for (const w of this.ways) if (inChunk(w.lx, w.ly)) { put('liftpad', w.lx * TS + 8, w.ly * TS + 12, 'rust', 0, { way: w }); C.lights.push({ x: w.lx * TS + 8, y: w.ly * TS + 12, h: eAt(w.lx, w.ly) + 24, r: 40, c: [255, 210, 150] }); C.shafts.push({ x: w.lx * TS + 8, y: w.ly * TS + 6, y0: eAt(w.lx, w.ly) + 6, y1: eAt(w.lx, w.ly) + 700 }); }
    const keep = (x, y) => this.ways.some((w) => Math.abs(w.lx - x) <= 2 && Math.abs(w.ly - y) <= 2);
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const x = X0 + i, y = Y0 + j, q = at(i, j), k = C.k[q]; if (k === K_VOID || k === K_WALL || keep(x, y) || C.solid[j * CS + i]) continue;
      const kind = this.kindAt(x, y), e0 = C.e[q], light = (hh, rad, c) => C.lights.push({ x: x * TS + 8, y: y * TS + 10, h: e0 + hh, r: rad, c }), v = rr(x, y, 1);
      if (k === K_TOXIC) { if (v < 0.25) light(8, 30, [255, 120, 40]); continue; }
      if (k === K_WATER) { if (v < 0.05) light(6, 26, [120, 200, 255]); continue; }
      if (kind === 'machine') {
        if (v < 0.012) put('gear', x * TS + 8, y * TS + 14, 'rust'); else if (v < 0.018) { put('boiler', x * TS + 8, y * TS + 14, 'rust'); light(16, 46, [255, 140, 60]); } else if (v < 0.026) put(rr(x, y, 2) < 0.5 ? 'pipes' : 'tank', x * TS + 8, y * TS + 14, 'rust'); else if (v < 0.03) put('automaton', x * TS + 8, y * TS + 14, 'rust'); else if (v < 0.034) put('piston', x * TS + 8, y * TS + 14, 'rust'); else if (v < 0.037) put('chimney', x * TS + 8, y * TS + 14, 'rust'); else if (v < 0.045) { put('lamp', x * TS + 6, y * TS + 10, 'rust'); light(28, 30, [255, 196, 120]); } else if (v < 0.05) put('drum', x * TS + 8, y * TS + 14, 'rust');
        if (rr(x, y, 9) < 0.12) C.decals.push({ type: rr(x, y, 10) < 0.5 ? 'oil' : 'rubble', x, y, fam: 'rust' });
      } else if (kind === 'fungus') {
        if (v < 0.03) put('bigshroom', x * TS + 8, y * TS + 14, 'cave'); else if (v < 0.09) { put('glowshroom', x * TS + 8, y * TS + 14, 'dream'); if (rr(x, y, 3) < 0.35) light(12, 24, rr(x, y, 4) < 0.5 ? [160, 255, 200] : [200, 160, 255]); } else if (v < 0.13) put('fungus', x * TS + 8, y * TS + 14, 'cave'); else if (v < 0.135) { put('lanterntree', x * TS + 8, y * TS + 14, 'dream'); light(20, 30, [255, 210, 140]); }
        if (rr(x, y, 9) < 0.18) C.decals.push({ type: 'glowmoss', x, y, fam: 'cave' });
      } else if (kind === 'crystal') {
        if (v < 0.06) { put('crystal', x * TS + 8, y * TS + 14, 'cave'); if (rr(x, y, 3) < 0.4) light(14, 26, rr(x, y, 4) < 0.5 ? [140, 240, 230] : [200, 150, 255]); } else if (v < 0.065) { put('crystalheart', x * TS + 8, y * TS + 14, 'cave'); light(30, 50, [170, 255, 230]); } else if (v < 0.08) put('rock', x * TS + 8, y * TS + 14, 'cave');
        if (rr(x, y, 9) < 0.1) C.decals.push({ type: 'stones', x, y, fam: 'cave' });
      } else if (kind === 'lake') {
        if (v < 0.04) { put('glowshroom', x * TS + 8, y * TS + 14, 'dream'); light(12, 22, [160, 230, 255]); } else if (v < 0.07) put('mossrock', x * TS + 8, y * TS + 14, 'cave');
        if (rr(x, y, 9) < 0.2) C.decals.push({ type: 'glowmoss', x, y, fam: 'cave' });
      } else if (kind === 'ruins') {
        if (v < 0.025) put('pillar', x * TS + 8, y * TS + 14, 'cave'); else if (v < 0.03) put('gear', x * TS + 8, y * TS + 14, 'rust'); else if (v < 0.034) put('automaton', x * TS + 8, y * TS + 14, 'rust'); else if (v < 0.037) { put('obelisk', x * TS + 8, y * TS + 14, 'cave'); light(40, 40, [160, 200, 255]); } else if (v < 0.05) put('scrap', x * TS + 8, y * TS + 14, 'rust');
        if (rr(x, y, 9) < 0.12) C.decals.push({ type: 'rubble', x, y, fam: 'cave' });
      } else {
        if (v < 0.02) put(rr(x, y, 2) < 0.5 ? 'rock' : 'boulder', x * TS + 8, y * TS + 14, 'cave'); else if (v < 0.03) { put('glowshroom', x * TS + 8, y * TS + 14, 'dream'); light(10, 20, [160, 255, 200]); } else if (v < 0.033) { put('lamp', x * TS + 6, y * TS + 10, 'rust'); light(28, 26, [255, 196, 120]); }
      }
    }
  }
  nameAt(x, y) { return CAVERN[this.kindAt(x, y)].name; }
}
export { CAVERN };
