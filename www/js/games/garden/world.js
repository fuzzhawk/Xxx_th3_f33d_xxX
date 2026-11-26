// The garden's world: 640 × 640 tiles of 16 px, made from a seed and never stored. A plan is laid out
// first (where each biome's sites sit, the rivers, the villages, the ruined city and its street grid,
// the roads between them, the floating islands with the lifts under them, the giants' walks); then
// any tile can be asked for at any time (tileInfo), and chunks of 16 × 16 tiles are built on demand
// with their props and decals. The islands are small worlds of their own, hanging at a height.
import { RNG, fbm, hash2, clamp, lerp } from '../mk/tex.js';
import { BIOMES, BIOME_KEYS, REGION, ISLES } from './lands.js';
import { PROPDEF } from './art.js';

export const TS = 16, CS = 16, WT = 640, NC = WT / CS;
export const K_GROUND = 0, K_PATH = 1, K_FLOOR = 2, K_WATER = 3, K_CLIFF = 4, K_WALL = 5, K_BRIDGE = 6, K_TOXIC = 7, K_BLDG = 8, K_STREET = 9;
export const SOLIDK = (k) => k === K_CLIFF || k === K_WALL || k === K_WATER || k === K_TOXIC || k === K_BLDG;
const VILLAGE_NAMES = ['Thornwick', 'Lowmarsh', 'Saltgrave', 'Cinderhope', 'Rookhollow', 'Ashby Cross', 'Gallows Fen', 'Kettle', 'Mirefield', 'Coldharbour', 'Wrenmoor', 'Blackwater', 'Tinker’s Rest', 'Stillwater', 'Grey Acre', 'Hollin', 'Rustmouth', 'Dunmore'];
const STYLE = { green: ['cottage', 'shack'], rust: ['shack', 'bunker'], desert: ['adobe', 'shack'], frost: ['loghut', 'cottage'], ash: ['bunker', 'shack'] };

// segments bucketed by chunk, for "how near is the nearest road / river" without looking at them all
class SegIndex {
  constructor() { this.b = new Map(); }
  add(x0, y0, x1, y1, w, tag) { const s = { x0, y0, x1, y1, w, tag }, m = w + 2; for (let cy = Math.floor((Math.min(y0, y1) - m) / CS); cy <= Math.floor((Math.max(y0, y1) + m) / CS); cy++) for (let cx = Math.floor((Math.min(x0, x1) - m) / CS); cx <= Math.floor((Math.max(x0, x1) + m) / CS); cx++) { const k = cy * 1000 + cx; let L = this.b.get(k); if (!L) this.b.set(k, (L = [])); L.push(s); } }
  near(x, y) { // [distance beyond half-width (≤0 inside), the segment]
    const L = this.b.get(Math.floor(y / CS) * 1000 + Math.floor(x / CS)); if (!L) return [1e9, null]; let bd = 1e9, bs = null;
    for (const s of L) { const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy || 1, t = clamp(((x - s.x0) * dx + (y - s.y0) * dy) / l2, 0, 1), d = Math.hypot(x - s.x0 - dx * t, y - s.y0 - dy * t) - s.w; if (d < bd) { bd = d; bs = s; } }
    return [bd, bs];
  }
}
// a wandering line from a to b: midpoints pushed sideways, recursively
function meander(r, pts, depth, amp) {
  if (!depth) return pts; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], mx = (ax + bx) / 2, my = (ay + by) / 2, l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / (l || 1), ny = (bx - ax) / (l || 1), o = r.range(-1, 1) * l * amp; out.push([mx + nx * o, my + ny * o], [bx, by]); }
  return meander(r, out, depth - 1, amp);
}

export class World {
  constructor(seed) {
    this.seed = seed >>> 0; const r = RNG(this.seed ^ 0x9a7d), W = WT;
    // the city: a ruined grid in the ash country's edge, and its biome sites around it
    this.city = { x0: Math.round(W * 0.56), y0: Math.round(W * 0.33), x1: Math.round(W * 0.56) + 104, y1: Math.round(W * 0.33) + 88, grid: 12 };
    // biome sites in their family's region
    this.sites = [];
    BIOME_KEYS.forEach((k, bi) => { const B = BIOMES[k]; if (k === 'crown') return; const R = REGION[B.fam], n = B.fam === 'green' ? 4 : 3; for (let i = 0; i < n; i++) this.sites.push({ x: lerp(R[0], R[2], r.f()) * W, y: lerp(R[1], R[3], r.f()) * W, b: bi }); });
    // the rivers: from the north edge south, wandering
    this.water = new SegIndex(); this.rivers = [];
    for (let i = 0; i < 3; i++) { const x0 = r.range(0.12, 0.88) * W, x1 = clamp(x0 + r.range(-160, 160), 20, W - 20), pts = meander(r, [[x0, -4], [x1, W + 4]], 6, 0.28); this.rivers.push(pts); const w = r.range(1.2, 2.2); for (let k = 1; k < pts.length; k++) this.water.add(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], w, 'river'); }
    // villages: spaced out, off the water and out of the city
    this.villages = []; const fams = ['green', 'green', 'green', 'green', 'green', 'green', 'rust', 'rust', 'rust', 'desert', 'desert', 'desert', 'frost', 'frost', 'ash'];
    for (const fam of fams) for (let t = 0; t < 200; t++) {
      const R = REGION[fam], x = Math.round(lerp(R[0] + 0.03, R[2] - 0.03, r.f()) * W), y = Math.round(lerp(R[1] + 0.03, R[3] - 0.03, r.f()) * W);
      if (this.inCity(x, y, 14) || this.villages.some((v) => Math.hypot(v.x - x, v.y - y) < 58) || this.water.near(x, y)[0] < 8) continue;
      this.villages.push({ x, y, fam, name: VILLAGE_NAMES[this.villages.length % VILLAGE_NAMES.length], rad: r.int(7, 10), seed: r.int(1, 1e9) }); break;
    }
    // roads: a spanning tree over the villages and the city's four gates, plus a few loops
    this.roads = new SegIndex(); const C = this.city, cx = (C.x0 + C.x1) / 2, cy = (C.y0 + C.y1) / 2;
    const nodes = [...this.villages.map((v) => [v.x, v.y]), [C.x0 - 2, cy], [C.x1 + 2, cy], [cx, C.y0 - 2], [cx, C.y1 + 2]], inTree = [0], edges = [];
    while (inTree.length < nodes.length) { let best = null, bd = 1e9; for (const i of inTree) for (let j = 0; j < nodes.length; j++) { if (inTree.includes(j)) continue; const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]); if (d < bd) { bd = d; best = [i, j]; } } inTree.push(best[1]); edges.push(best); }
    for (let k = 0; k < 4; k++) { const i = r.int(0, nodes.length - 1), j = r.int(0, nodes.length - 1); if (i !== j) edges.push([i, j]); }
    for (const [i, j] of edges) { const pts = meander(r, [nodes[i], nodes[j]], 5, 0.12); for (let k = 1; k < pts.length; k++) this.roads.add(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 1.1, 'road'); }
    // the islands, high over the country, each with a lift tower on the ground under its south side
    this.isles = []; const kinds = Object.keys(ISLES), spots = [[0.2, 0.4], [0.32, 0.72], [0.15, 0.85], [0.62, 0.18], [0.82, 0.48], [0.7, 0.82], [0.4, 0.1]];
    spots.forEach(([fx, fy], i) => {
      const x = Math.round(fx * W + r.range(-30, 30)), y = Math.round(fy * W + r.range(-30, 30)), rad = r.int(10, 15), kind = kinds[i % kinds.length], h = r.int(170, 300);
      let lift = null; for (let t = 0; t < 60 && !lift; t++) { const lx = x + r.int(-6, 6), ly = y + rad + r.int(3, 8); if (!this.inCity(lx, ly, 3) && this.water.near(lx, ly)[0] > 3) lift = { x: lx, y: ly }; }
      lift ||= { x, y: y + rad + 4 };
      this.isles.push({ i, x, y, rad, kind, h, seed: r.int(1, 1e9), lift, pad: { x, y: y + Math.round(rad * 0.55) } });
    });
    // where the walk starts: the first green village
    const home = this.villages.find((v) => v.fam === 'green') || this.villages[0];
    this.start = { x: home.x * TS + 8, y: (home.y + home.rad + 2) * TS };
    // the giants' country: the greens and the rust
    this.giantHome = [[0.05, 0.2, 0.55, 0.95], [0.42, 0.14, 0.78, 0.6]];
    this.chunks = new Map(); this.isleCache = new Map();
  }
  inCity(x, y, m = 0) { const C = this.city; return x >= C.x0 - m && x <= C.x1 + m && y >= C.y0 - m && y <= C.y1 + m; }
  villageAt(x, y, m = 0) { for (const v of this.villages) if (Math.hypot(v.x - x, v.y - y) <= v.rad + m) return v; return null; }
  // the biome under a tile: the city's rect, else the nearest site after a warp
  biomeAt(x, y) {
    if (this.inCity(x, y)) return BIOMES.crown.i;
    const s = this.seed, wx = x + (fbm(x / 24, y / 24, s + 1, 3) - 0.5) * 46, wy = y + (fbm(x / 24, y / 24, s + 9, 3) - 0.5) * 46; let bd = 1e18, bi = 0;
    for (const p of this.sites) { const d = (wx - p.x) ** 2 + (wy - p.y) ** 2; if (d < bd) { bd = d; bi = p.b; } }
    return bi;
  }
  // everything about one tile: biome, kind, block height, block texture (0 none)
  tileInfo(x, y) {
    const out = { b: 0, k: K_GROUND, h: 0, f: 0 };
    if (x < 0 || y < 0 || x >= WT || y >= WT) { out.k = K_CLIFF; out.h = 60; out.b = this.biomeAt(clamp(x, 0, WT - 1), clamp(y, 0, WT - 1)); return out; }
    const s = this.seed, b = (out.b = this.biomeAt(x, y)), B = BIOMES[BIOME_KEYS[b]];
    // border: a wall of cliffs round the world's edge
    const e = Math.min(x, y, WT - 1 - x, WT - 1 - y); if (e < 2 + fbm(x / 5, y / 5, s + 5, 2) * 3) { out.k = K_CLIFF; out.h = 40 + hash2(x, y, 9) * 24; return out; }
    // the city: streets every `grid` tiles, buildings between (some fallen, some gone to green)
    if (this.inCity(x, y)) {
      const C = this.city, gx = (x - C.x0) % C.grid, gy = (y - C.y0) % C.grid, lot = Math.floor((x - C.x0) / C.grid) * 97 + Math.floor((y - C.y0) / C.grid);
      if (gx < 3 || gy < 3) { out.k = K_STREET; return out; }
      const lr = hash2(lot, 7, s), park = lr < 0.12, ruin = lr > 0.82;
      if (park) return out;
      const inset = 1 + Math.floor(hash2(lot, 3, s) * 2);
      if (gx < 3 + inset || gy < 3 + inset || gx > C.grid - 1 - (inset > 1 ? 1 : 0) || gy > C.grid - 1) { out.k = K_FLOOR; return out; }
      if (ruin) { if (hash2(x, y, s + 4) < 0.45) { out.k = K_WALL; out.h = 8 + hash2(x, y, s + 5) * 20; out.f = 2; } else out.k = K_FLOOR; return out; }
      const tall = 1 - Math.hypot((x - (C.x0 + C.x1) / 2) / (C.x1 - C.x0), (y - (C.y0 + C.y1) / 2) / (C.y1 - C.y0)) * 1.6;
      out.k = K_BLDG; out.h = Math.round(40 + clamp(tall, 0, 1) * 150 * (0.5 + hash2(lot, 11, s) * 0.8) + hash2(lot, 13, s) * 30); out.f = 1 + (Math.floor(hash2(lot, 17, s) * 5));
      if (hash2(lot, 19, s) < 0.3) out.h -= Math.round(hash2(x, y, s + 23) * out.h * 0.4);   // broken tops
      return out;
    }
    const road = this.roads.near(x, y)[0], river = this.water.near(x, y)[0], vil = this.villageAt(x, y, 1);
    // water: the rivers, and lakes in the wet biomes
    let wet = river <= 0, lakeK = K_WATER;
    if (!wet && B.water && !vil) { const n = fbm(x / 9, y / 9, s + 33, 4); if (n > 1 - B.waterAmt * 0.9) { wet = true; lakeK = B.water === 'toxic' ? K_TOXIC : K_WATER; } }
    if (road <= 0) { out.k = wet ? K_BRIDGE : K_PATH; return out; }
    if (wet && !vil) { out.k = river <= 0 ? K_WATER : lakeK; return out; }
    if (vil) { const d = Math.hypot(vil.x - x, vil.y - y); if (d < 2.2 || (Math.abs(vil.x - x) < 1 && d < vil.rad) || (Math.abs(vil.y - y) < 1 && d < vil.rad)) out.k = K_PATH; return out; }
    for (const I of this.isles) if (Math.hypot(I.lift.x - x, I.lift.y - y) < 4) return out;
    // the biomes' own structures
    if (road > 2) {
      if (B.struct === 'mesa') { const n = fbm(x / 7, y / 7, s + 77, 4); if (n > 0.6) { out.k = K_CLIFF; out.h = 26 + (n - 0.6) * 160 + hash2(x, y, 9) * 8; } }
      else if (B.struct === 'ridges') { const n = fbm(x / 10, y / 10, s + 81, 4); if (n > 0.66) { out.k = K_CLIFF; out.h = 20 + (n - 0.66) * 140 + hash2(x, y, 9) * 6; } }
      else if (B.struct === 'crater') { const n = fbm(x / 12, y / 12, s + 91, 3), ring = Math.abs(n - 0.5); if (ring < 0.03) { out.k = K_CLIFF; out.h = 18 + hash2(x, y, 9) * 16; } }
      else if (B.struct === 'ruins' || B.struct === 'factory') {
        const bx = Math.floor(x / 11), by = Math.floor(y / 11), lx = x - bx * 11, ly = y - by * 11, hr = hash2(bx, by, s + 55);
        if (hr < (B.struct === 'factory' ? 0.55 : 0.3)) { const w = 4 + Math.floor(hash2(bx, by, s + 56) * 5), h = 4 + Math.floor(hash2(bx, by, s + 57) * 4), ox = 1 + Math.floor(hash2(bx, by, s + 58) * 3), oy = 1 + Math.floor(hash2(bx, by, s + 59) * 3);
          if (lx >= ox && ly >= oy && lx < ox + w && ly < oy + h) { const edge = lx === ox || ly === oy || lx === ox + w - 1 || ly === oy + h - 1, door = (lx === ox + (w >> 1) || ly === oy + (h >> 1)); if (edge && !door && hash2(x, y, s + 60) > (B.struct === 'factory' ? 0.12 : 0.3)) { out.k = K_WALL; out.h = B.struct === 'factory' ? 30 : 10 + hash2(x, y, s + 61) * 18; out.f = 0; } else out.k = K_FLOOR; } }
      }
    }
    return out;
  }
  // a chunk: tiles (with a one-tile border, for blending), solidity, props and decals
  chunk(cx, cy) {
    const key = cy * 1000 + cx; let C = this.chunks.get(key); if (C) return C;
    const n = CS + 2, b = new Uint8Array(n * n), k = new Uint8Array(n * n), h = new Float32Array(n * n), f = new Uint8Array(n * n), x0 = cx * CS - 1, y0 = cy * CS - 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const t = this.tileInfo(x0 + i, y0 + j), q = j * n + i; b[q] = t.b; k[q] = t.k; h[q] = t.h; f[q] = t.f; }
    C = { cx, cy, b, k, h, f, n, solid: new Uint8Array(CS * CS), props: [], decals: [], lights: [] };
    const at = (i, j) => (j + 1) * n + i + 1;
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) if (SOLIDK(k[at(i, j)])) C.solid[j * CS + i] = 1;
    this.populate(C, at);
    this.chunks.set(key, C);
    if (this.chunks.size > 900) for (const [kk] of this.chunks) { this.chunks.delete(kk); if (this.chunks.size < 700) break; }
    return C;
  }
  // props and decals for a chunk: the biome's own, a village's buildings, the city's furniture, lifts
  populate(C, at) {
    const s = this.seed, X0 = C.cx * CS, Y0 = C.cy * CS, k = C.k, place = (type, x, y, fam, v, extra) => { const D = PROPDEF[type]; C.props.push({ type, x, y, fam, v: v ?? Math.floor(hash2(x, y, s + 3) * 3), ...extra }); if (D?.foot) { const fw = Math.max(1, Math.ceil(D.foot[0] / TS)), tx = Math.floor(x / TS) - X0 - Math.floor((fw - 1) / 2), ty = Math.floor((y - 2) / TS) - Y0; for (let i = tx; i < tx + fw; i++) if (i >= 0 && i < CS && ty >= 0 && ty < CS) C.solid[ty * CS + i] = 1; } };
    const ground = (i, j) => k[at(i, j)] === K_GROUND, free = (i, j) => i >= 0 && j >= 0 && i < CS && j < CS && ground(i, j) && !C.solid[j * CS + i];
    // villages whose houses fall in this chunk
    for (const v of this.villages) {
      if (Math.abs(v.x - (X0 + CS / 2)) > CS + v.rad + 4 || Math.abs(v.y - (Y0 + CS / 2)) > CS + v.rad + 4) continue;
      const r = RNG(v.seed), style = STYLE[v.fam], n = r.int(7, 12), out = [];
      for (let q = 0; q < n * 4 && out.length < n; q++) { const a = r.range(0, 6.283), d = r.range(3.5, v.rad - 1), x = Math.round(v.x + Math.cos(a) * d), y = Math.round(v.y + Math.sin(a) * d * 0.8); if (out.some((o) => Math.abs(o.x - x) < 4 && Math.abs(o.y - y) < 3) || Math.abs(x - v.x) < 1.5 || Math.abs(y - v.y) < 1.5) continue; out.push({ x, y, type: r.pick(style) }); }
      const extras = [['well', v.x + 2, v.y - 2], [v.fam === 'desert' || v.fam === 'rust' ? 'watertower' : 'windpump', v.x - 4, v.y - 3], ['firebarrel', v.x + 1, v.y + 2], ['firebarrel', v.x - 2, v.y + 3], ['laundry', v.x + 4, v.y + 3], ['cart', v.x - 5, v.y + 4], ['fence', v.x - v.rad + 1, v.y + 1], ['fence', v.x + v.rad - 3, v.y - 2], ['tent', v.x + 5, v.y - 5]];
      for (const o of out) extras.push([o.type, o.x, o.y]);
      for (const [type, tx, ty] of extras) { if (tx < X0 || ty < Y0 || tx >= X0 + CS || ty >= Y0 + CS) continue; place(type, tx * TS + 8, ty * TS + 14, v.fam, Math.floor(hash2(tx, ty, s) * 3), { vil: v }); if (type === 'firebarrel') C.lights.push({ x: tx * TS + 8, y: ty * TS + 12, h: 12, r: 26, c: [255, 150, 60], fire: 1 }); else if (type !== 'well' && type !== 'fence' && type !== 'laundry' && type !== 'cart' && type !== 'tent' && type !== 'watertower' && type !== 'windpump' && hash2(tx, ty, s + 1) < 0.6) C.lights.push({ x: tx * TS + 8, y: ty * TS + 10, h: 10, r: 16, c: [255, 190, 110] }); }
      for (let q = 0; q < 10; q++) { const tx = Math.round(v.x + r.range(-v.rad, v.rad)), ty = Math.round(v.y + r.range(-v.rad, v.rad)); if (tx >= X0 && ty >= Y0 && tx < X0 + CS && ty < Y0 + CS) C.decals.push({ type: 'crops', x: tx, y: ty, fam: v.fam }); }
    }
    // lifts under the islands
    for (const I of this.isles) { const L = I.lift; if (L.x >= X0 && L.y >= Y0 && L.x < X0 + CS && L.y < Y0 + CS) { place('lifttower', L.x * TS + 8, L.y * TS + 12, ISLES[I.kind].fam, 0, { lift: I }); C.lights.push({ x: L.x * TS + 8, y: L.y * TS + 12, h: 116, r: 30, c: [255, 180, 80], beacon: 1 }); } }
    // the biomes' own props and decals, tile by tile
    const inCity = this.inCity(X0 + CS / 2, Y0 + CS / 2, CS);
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const x = X0 + i, y = Y0 + j, kk = k[at(i, j)], B = BIOMES[BIOME_KEYS[C.b[at(i, j)]]], fam = B.fam, rr = (q) => hash2(x * 7 + q, y * 13 + q * 3, s + 101);
      if (kk === K_STREET) { if (rr(1) < 0.012) place(B.props.find((p) => p[0] === 'wreck') ? 'wreck' : 'scrap', x * TS + 8, y * TS + 12, fam); else if (rr(2) < 0.006) place('bus', x * TS + 8, y * TS + 12, fam); if (rr(3) < 0.05) C.decals.push({ type: rr(4) < 0.5 ? 'crack' : 'rubble', x, y, fam }); const C2 = this.city; if (((x - C2.x0) % C2.grid === 1) && (y % 6 === 0)) { place('lamp', x * TS + 4, y * TS + 8, fam); if (rr(5) < 0.25) C.lights.push({ x: x * TS + 6, y: y * TS + 8, h: 30, r: 20, c: [255, 200, 130] }); } continue; }
      if (kk === K_FLOOR && inCity) { if (rr(6) < 0.04) place(rr(7) < 0.5 ? 'scrap' : 'burnt', x * TS + 8, y * TS + 12, fam); if (rr(8) < 0.12) C.decals.push({ type: 'rubble', x, y, fam }); continue; }
      if (kk === K_GROUND && inCity && this.inCity(x, y)) { if (rr(9) < 0.08 && free(i, j)) place(rr(10) < 0.6 ? 'tree' : 'burnt', x * TS + 8, y * TS + 14, 'green'); if (rr(11) < 0.15) C.decals.push({ type: 'tuft', x, y, fam: 'green' }); continue; }
      if (kk === K_GROUND) {
        if (this.roads.near(x, y)[0] < 1.5 || this.villageAt(x, y, 2)) { if (rr(12) < 0.1) C.decals.push({ type: B.decals[0]?.[0] || 'tuft', x, y, fam }); continue; }
        const cl = fbm(x / 6, y / 6, s + 300, 2);
        for (const [type, dens] of B.props) { if (rr(20 + type.length) >= dens * (0.4 + cl * 1.3)) continue; if (!free(i, j)) break; place(type, x * TS + 8 + (rr(13) - 0.5) * 4, y * TS + 14, fam); break; }
        for (const [type, dens] of B.decals) if (rr(40 + type.length) < dens) C.decals.push({ type, x, y, fam });
      } else if (kk === K_PATH && rr(14) < 0.04) C.decals.push({ type: 'stones', x, y, fam });
    }
    // a landmark or two: statues in the city squares, a radio mast out on the steppe
    if (inCity && hash2(C.cx, C.cy, s + 71) < 0.1) { const tx = X0 + 8, ty = Y0 + 8; if (k[at(8, 8)] === K_STREET || k[at(8, 8)] === K_GROUND) place('statue', tx * TS, ty * TS, 'ash'); }
  }
  // an island: its own tiles (a ragged disc), props, the landmark and the lift pad
  isle(I) {
    let M = this.isleCache.get(I.i); if (M) return M;
    const L = ISLES[I.kind], r = RNG(I.seed), n = I.rad * 2 + 6, ox = I.x - I.rad - 3, oy = I.y - I.rad - 3, kind = new Uint8Array(n * n), solid = new Uint8Array(n * n), props = [], decals = [], lights = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = ox + i, y = oy + j, d = Math.hypot((x - I.x) / I.rad, (y - I.y) / (I.rad * 0.85)) + (fbm(x / 4, y / 4, I.seed, 3) - 0.5) * 0.5; kind[j * n + i] = d < 1 ? K_GROUND : 255; if (d >= 1) solid[j * n + i] = 1; }
    const pad = I.pad, mark = (x, y, w = 1) => { for (let j = -w; j <= w; j++) for (let i = -w; i <= w; i++) { const q = (y - oy + j) * n + (x - ox + i); if (kind[q] === K_GROUND) kind[q] = K_PATH; } };
    // a path from the pad to the landmark
    const lm = { x: I.x + r.int(-2, 2), y: I.y - Math.round(I.rad * 0.3) };
    for (let t = 0; t <= 1; t += 0.05) mark(Math.round(lerp(pad.x, lm.x, t)), Math.round(lerp(pad.y, lm.y, t)), 0);
    const place = (type, x, y, extra) => { const D = PROPDEF[type]; props.push({ type, x, y, fam: L.fam, v: r.int(0, 2), ...extra }); if (D?.foot) { const fw = Math.max(1, Math.ceil(D.foot[0] / TS)), tx = Math.floor(x / TS) - ox - Math.floor((fw - 1) / 2), ty = Math.floor((y - 2) / TS) - oy; for (let i = tx; i < tx + fw; i++) if (i >= 0 && i < n && ty >= 0 && ty < n) solid[ty * n + i] = 1; } };
    place(L.land, lm.x * TS + 8, lm.y * TS + 12, { landmark: 1 });
    place('liftpad', pad.x * TS + 8, pad.y * TS + 12, { pad: I });
    lights.push({ x: pad.x * TS + 8, y: pad.y * TS + 12, h: 20, r: 22, c: [255, 180, 80], beacon: 1 });
    if (L.land === 'shrine') lights.push({ x: lm.x * TS + 8, y: lm.y * TS + 12, h: 40, r: 26, c: [140, 220, 180] });
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = ox + i, y = oy + j; if (kind[j * n + i] !== K_GROUND || solid[j * n + i] || Math.hypot(x - pad.x, y - pad.y) < 2.5 || Math.hypot(x - lm.x, y - lm.y) < 3) continue;
      for (const [type, dens] of L.props) if (r.chance(dens)) { place(type, x * TS + 8, y * TS + 14); break; }
      if (r.chance(0.18)) decals.push({ type: r.pick(['tuft', 'stones', 'leaves']), x, y, fam: L.fam });
    }
    // the rocky underside: how deep each edge column hangs
    const depth = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (kind[j * n + i] !== 255) depth[j * n + i] = 24 + fbm(i / 3, j / 3, I.seed + 7, 3) * 70 * (1 - Math.hypot(ox + i - I.x, oy + j - I.y) / (I.rad * 1.2));
    M = { I, L, n, ox, oy, kind, solid, props, decals, lights, depth };
    this.isleCache.set(I.i, M);
    return M;
  }
  // can feet stand at world px (x, y)? on the ground, or on island I
  solidAt(px, py, isle) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    if (isle) { const M = this.isle(isle), i = tx - M.ox, j = ty - M.oy; return i < 0 || j < 0 || i >= M.n || j >= M.n || !!M.solid[j * M.n + i]; }
    if (tx < 0 || ty < 0 || tx >= WT || ty >= WT) return true;
    const C = this.chunk(Math.floor(tx / CS), Math.floor(ty / CS)); return !!C.solid[(ty - C.cy * CS) * CS + (tx - C.cx * CS)];
  }
  biomeName(px, py) { return BIOMES[BIOME_KEYS[this.biomeAt(Math.floor(px / TS), Math.floor(py / TS))]].name; }
}
