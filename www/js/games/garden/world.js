// The garden's world: 1024 × 1024 tiles of 16 px, made from a seed and never stored. A plan is laid out
// first (each biome's sites, the rivers, the villages, the ruined city, the roads, the mountains, the
// canyons and their lifts and caves, the floating islands over their lift towers, the giant trees and
// their canopies, the twelve treasures); then any tile can be asked for at any time (tileInfo), and
// chunks of 16 × 16 tiles are built on demand with their props and decals. The ground rises and falls:
// each tile has an elevation (rolling hills, ridges, terraced mountains, canyon floors far below), and a
// walker can step up or down 24 px at most. The high places and the low ones (islands, canopies, caves)
// are small worlds of their own.
import { RNG, fbm, hash2, clamp, lerp } from '../mk/tex.js';
import { BIOMES, BIOME_KEYS, REGION, ISLES, CAVES, TREASURES, ROOFTOP, UNDER, WALKWAY } from './lands.js';
import { PROPDEF } from './art.js';

export const TS = 16, CS = 16, WT = 1024, NC = WT / CS, STEP = 24, NOLO = -32768;
export const K_GROUND = 0, K_PATH = 1, K_FLOOR = 2, K_WATER = 3, K_CLIFF = 4, K_WALL = 5, K_BRIDGE = 6, K_TOXIC = 7, K_BLDG = 8, K_STREET = 9, K_TRUNK = 10, K_VOID = 255;
export const SWIM = 1, WATERONLY = 2;
const VILLAGE_NAMES = ['Thornwick', 'Lowmarsh', 'Saltgrave', 'Cinderhope', 'Rookhollow', 'Ashby Cross', 'Gallows Fen', 'Kettle', 'Mirefield', 'Coldharbour', 'Wrenmoor', 'Blackwater', 'Tinker’s Rest', 'Stillwater', 'Grey Acre', 'Hollin', 'Rustmouth', 'Dunmore'];
const DREAM_NAMES = ['Honeybrook', 'Willowmere', 'Bellhaven', 'Foxglove', 'Amberleigh', 'Mossbank', 'Lanternwick', 'Clovercombe', 'Starling Hollow', 'Dewberry'];
const STYLE = { green: ['cottage', 'shack'], dream: ['cottage', 'loghut'], rust: ['shack', 'bunker'], desert: ['adobe', 'shack'], frost: ['loghut', 'cottage'], ash: ['bunker', 'shack'] };
const FOREST = new Set(['bluebell', 'elderglade', 'jungle', 'tanglewood', 'oldgrowth', 'emberwood', 'lantern']);
const CAVE_KEYS = ['crystal', 'dragon', 'grotto', 'deep'];
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// segments bucketed by chunk, for "how near is the nearest road / river / canyon" without looking at them all
class SegIndex {
  constructor() { this.b = new Map(); }
  add(x0, y0, x1, y1, w, tag, s0 = 0, s1 = 0) { const s = { x0, y0, x1, y1, w, tag, s0, s1 }, m = w + 3; for (let cy = Math.floor((Math.min(y0, y1) - m) / CS); cy <= Math.floor((Math.max(y0, y1) + m) / CS); cy++) for (let cx = Math.floor((Math.min(x0, x1) - m) / CS); cx <= Math.floor((Math.max(x0, x1) + m) / CS); cx++) { const k = cy * 1000 + cx; let L = this.b.get(k); if (!L) this.b.set(k, (L = [])); L.push(s); } }
  // [distance beyond half-width (≤0 inside), the segment, how far along it]
  near(x, y) {
    const L = this.b.get(Math.floor(y / CS) * 1000 + Math.floor(x / CS)); if (!L) return [1e9, null, 0]; let bd = 1e9, bs = null, bt = 0;
    for (const s of L) { const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy || 1, t = clamp(((x - s.x0) * dx + (y - s.y0) * dy) / l2, 0, 1), d = Math.hypot(x - s.x0 - dx * t, y - s.y0 - dy * t) - s.w; if (d < bd) { bd = d; bs = s; bt = t; } }
    return [bd, bs, bt];
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
    this.bc = new Uint8Array(W * W).fill(255); this.ag = new Float32Array((W / 8 + 2) * (W / 8 + 2)).fill(-1);
    this.mountains = []; this.canyons = []; this.places = []; this.canopies = []; this.treasures = [];
    // the city: a ruined grid at the rust belt's edge
    this.city = { x0: Math.round(W * 0.58), y0: Math.round(W * 0.34), x1: Math.round(W * 0.58) + 120, y1: Math.round(W * 0.34) + 100, grid: 12 };
    this.cityE = Math.round(this.baseAt((this.city.y0 + this.city.y1) / 2) / 8) * 8;   // the city stands level at the height of its country
    // biome sites in their region
    this.sites = [];
    BIOME_KEYS.forEach((k, bi) => { const B = BIOMES[k]; if (k === 'crown') return; const R = REGION[B.reg || B.fam], n = B.fam === 'green' ? 5 : 4; for (let i = 0; i < n; i++) this.sites.push({ x: lerp(R[0], R[2], r.f()) * W, y: lerp(R[1], R[3], r.f()) * W, b: bi }); });
    // the rivers: from the north edge south, wandering
    this.water = new SegIndex(); this.rivers = [];
    for (let i = 0; i < 4; i++) { const x0 = r.range(0.1, 0.9) * W, x1 = clamp(x0 + r.range(-220, 220), 30, W - 30), pts = meander(r, [[x0, -4], [x1, W + 4]], 7, 0.26); this.rivers.push(pts); const w = r.range(1.3, 2.4); for (let k = 1; k < pts.length; k++) this.water.add(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], w, 'river'); }
    // villages: spaced out, off the water and out of the city
    this.villages = []; let nGreen = 0, nDream = 0;
    const fams = ['dream', 'green', 'dream', 'green', 'dream', 'green', 'dream', 'green', 'dream', 'green', 'dream', 'green', 'rust', 'rust', 'rust', 'rust', 'desert', 'desert', 'desert', 'frost', 'frost', 'frost', 'ash', 'ash'];
    for (const fam of fams) for (let t = 0; t < 300; t++) {
      const R = REGION[fam], x = Math.round(lerp(R[0] + 0.03, R[2] - 0.03, r.f()) * W), y = Math.round(lerp(R[1] + 0.03, R[3] - 0.03, r.f()) * W);
      if (this.inCity(x, y, 16) || this.villages.some((v) => Math.hypot(v.x - x, v.y - y) < 70) || this.water.near(x, y)[0] < 9) continue;
      // the village takes after the country it stands in
      const B = BIOMES[BIOME_KEYS[this.biomeAt(x, y)]], vf = B.dream ? 'dream' : B.fam === 'dream' || B.fam === 'cave' ? 'green' : B.fam;
      const name = vf === 'dream' ? DREAM_NAMES[nDream++ % DREAM_NAMES.length] : VILLAGE_NAMES[nGreen++ % VILLAGE_NAMES.length];
      this.villages.push({ x, y, fam: vf, name, rad: r.int(7, 10), seed: r.int(1, 1e9) }); break;
    }
    // roads: a spanning tree over the villages and the city's four gates, plus a few loops
    this.roads = new SegIndex(); const C = this.city, ccx = (C.x0 + C.x1) / 2, ccy = (C.y0 + C.y1) / 2;
    const nodes = [...this.villages.map((v) => [v.x, v.y]), [C.x0 - 2, ccy], [C.x1 + 2, ccy], [ccx, C.y0 - 2], [ccx, C.y1 + 2]], inTree = [0], edges = [];
    while (inTree.length < nodes.length) { let best = null, bd = 1e9; for (const i of inTree) for (let j = 0; j < nodes.length; j++) { if (inTree.includes(j)) continue; const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]); if (d < bd) { bd = d; best = [i, j]; } } inTree.push(best[1]); edges.push(best); }
    for (let k = 0; k < 5; k++) { const i = r.int(0, nodes.length - 1), j = r.int(0, nodes.length - 1); if (i !== j) edges.push([i, j]); }
    for (const [i, j] of edges) { const pts = meander(r, [nodes[i], nodes[j]], 5, 0.12); for (let k = 1; k < pts.length; k++) this.roads.add(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 1.1, 'road'); }
    const clearOf = (x, y, m) => !this.inCity(x, y, m + 6) && !this.villages.some((v) => Math.hypot(v.x - x, v.y - y) < v.rad + m + 4) && x > m + 8 && y > m + 8 && x < W - m - 8 && y < W - m - 8;
    // mountains: terraced cones, snow on their heads, all in the high north (the further north, the taller)
    for (let q = 0; q < 7; q++) for (let t = 0; t < 300; t++) {
      const y = lerp(0.05, 0.5, Math.pow(r.f(), 1.4)) * W, x = lerp(0.05, 0.95, r.f()) * W, rad = r.int(24, 34);
      if (!clearOf(x, y, rad) || this.mountains.some((M) => Math.hypot(M.x - x, M.y - y) < M.rad + rad + 24)) continue;
      this.mountains.push({ x: Math.round(x), y: Math.round(y), rad, peak: r.int(250, 320) + Math.round((1 - y / W) * 70), seed: r.int(1, 1e9), fam: BIOMES[BIOME_KEYS[this.biomeAt(x, y)]].fam }); break;
    }
    // each summit: the highest ground near the middle
    for (const M of this.mountains) { let best = -1; const R = Math.round(M.rad * 0.45); for (let j = -R; j <= R; j += 1) for (let i = -R; i <= R; i += 1) { const e = this.rise(M.x + i, M.y + j, BIOMES.pasture); if (e > best) { best = e; M.top = { x: M.x + i, y: M.y + j }; } } }
    // canyons: long cuts far down, their walls sheer, ramps at both ends; lifts down from the rim, a cave in each
    this.canyonIx = new SegIndex();
    for (const fam of ['desert', 'rust', 'dream', 'desert', 'green']) {
      if (this.canyons.length >= 4) break;
      for (let t = 0; t < 120; t++) {
        const R = REGION[fam], x0 = lerp(R[0], R[2], r.f()) * W, y0 = lerp(R[1], R[3], r.f()) * W, a = r.range(0, 6.283), L0 = r.range(80, 130), w = r.range(3, 4.6);
        const pts = meander(r, [[x0, y0], [x0 + Math.cos(a) * L0, y0 + Math.sin(a) * L0]], 4, 0.16);
        let ok = true; for (let k = 0; k < pts.length && ok; k++) { const [px, py] = pts[k]; if (!clearOf(px, py, w + 2) || this.mountains.some((M) => Math.hypot(M.x - px, M.y - py) < M.rad + w + 4) || this.canyons.some((O) => O.pts.some(([ox, oy]) => Math.hypot(ox - px, oy - py) < 30))) ok = false; }
        if (!ok) continue;
        const Cn = { i: this.canyons.length, pts, w, depth: 240, L: 0, lifts: [], fam };
        let s = 0; for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); this.canyonIx.add(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], w, Cn, s, s + l); s += l; }
        Cn.L = s; this.canyons.push(Cn); break;
      }
    }
    // the floating islands, high up, each over the lift tower that rides straight up to it
    const isleKeys = Object.keys(ISLES).filter((k) => !ISLES[k].canopy), spots = [[0.24, 0.44], [0.36, 0.74], [0.14, 0.86], [0.62, 0.2], [0.86, 0.46], [0.72, 0.84], [0.44, 0.12], [0.5, 0.58]];
    spots.forEach(([fx, fy], i) => {
      const x = Math.round(fx * W + r.range(-40, 40)), y = Math.round(fy * W + r.range(-40, 40)), rad = r.int(14, 21), key = isleKeys[i % isleKeys.length];
      // high over whatever lies under it (the northern heights and their peaks included), by a good way
      let gmax = 0; for (let j = -rad - 4; j <= rad + 4; j += 4) for (let i = -rad - 4; i <= rad + 4; i += 4) gmax = Math.max(gmax, this.rise(x + i, y + j, BIOMES.pasture));
      this.places.push({ i: this.places.length, kind: 'isle', key, x, y, rad, h: Math.max(r.int(560, 760), gmax + r.int(360, 460)), seed: r.int(1, 1e9), lift: null, pad: null, lm: { x: x + r.int(-2, 2), y: y - Math.round(rad * 0.32) } });
    });
    // the giant trees in the forests, their canopies a world of their own up a basket lift
    for (let t = 0; t < 1500 && this.canopies.length < 4; t++) {
      const fam = r.chance(0.7) ? 'dream' : 'green', R = REGION[fam], x = Math.round(lerp(R[0], R[2], r.f()) * W), y = Math.round(lerp(R[1], R[3], r.f()) * W);
      if (!FOREST.has(BIOME_KEYS[this.biomeAt(x, y)]) || !clearOf(x, y, 14) || this.roads.near(x, y)[0] < 6 || this.water.near(x, y)[0] < 6 || this.canyonAt(x, y).d < 8 || this.mountains.some((M) => Math.hypot(M.x - x, M.y - y) < M.rad + 14) || this.canopies.some((P) => Math.hypot(P.x - x, P.y - y) < 120)) continue;
      const P = { i: this.places.length, kind: 'canopy', key: 'canopy', x, y, rad: r.int(10, 13), h: 0, seed: r.int(1, 1e9), lm: { x, y: y - 4 }, nest: { x: x - 4, y: y - 1 } };
      P.lift = { x, y: y + 3 }; P.pad = { x, y: y + 3 }; P.h = this.rise(x, y, BIOMES[BIOME_KEYS[this.biomeAt(x, y)]]) + r.int(250, 290);
      this.places.push(P); this.canopies.push(P);
    }
    // the canyons' lifts and caves (now the islands are known, so their towers stay clear of them)
    for (const Cn of this.canyons) {
      for (const f of [0.3, 0.72]) { const L = this.canyonLift(Cn, f); if (L) Cn.lifts.push(L); }
      const nc = this.places.filter((p) => p.kind === 'cave').length, cave = { i: this.places.length, kind: 'cave', key: CAVE_KEYS[nc % CAVE_KEYS.length], x: W + 40 + nc * 60, y: 40, rad: r.int(15, 19), h: 0, seed: r.int(1, 1e9), canyon: Cn };
      cave.lm = { x: cave.x, y: cave.y - Math.round(cave.rad * 0.35) }; cave.exit = { x: cave.x, y: cave.y + cave.rad - 3 };
      cave.mouth = this.canyonMouth(Cn); if (cave.mouth) { this.places.push(cave); Cn.cave = cave; }
    }
    // island lift towers: on open ground right under each island
    for (const I of this.places) if (I.kind === 'isle') {
      for (let t = 0; t < 200 && !I.lift; t++) { const lx = I.x + r.int(-8, 8), ly = I.y + Math.round(I.rad * 0.25) + r.int(-5, 5), ti = this.tileInfo(lx, ly); if (ti.k === K_GROUND && this.flat(lx, ly, 1) && this.canyonAt(lx, ly).d > 3 && !this.villageAt(lx, ly, 3)) I.lift = { x: lx, y: ly }; }
      I.lift ||= { x: I.x, y: I.y + Math.round(I.rad * 0.25) }; I.pad = { ...I.lift };
    }
    // the twelve treasures
    const tr = RNG(this.seed ^ 0x7eaf);
    TREASURES.forEach(([name, where, land, tag], i) => {
      const T = { i, name, where, land, place: null, lx: 0, ly: 0 };
      if (where === 'ground') {
        const fam = tag === 'dream' ? 'dream' : tr.pick(['rust', 'ash', 'desert']), R = REGION[fam];
        for (let t = 0; t < 600; t++) {
          const x = Math.round(lerp(R[0], R[2], tr.f()) * W), y = Math.round(lerp(R[1], R[3], tr.f()) * W), B = BIOMES[BIOME_KEYS[this.biomeAt(x, y)]];
          if (!!B.dream !== (tag === 'dream') || !clearOf(x, y, 4) || this.roads.near(x, y)[0] < 3 || this.water.near(x, y)[0] < 4 || this.canyonAt(x, y).d < 6 || this.treasures.some((o) => !o.place && Math.hypot(o.lx - x, o.ly - y) < 70) || this.tileInfo(x, y).k !== K_GROUND || !this.flat(x, y, 2)) continue;
          T.lx = x; T.ly = y; break;
        }
        if (!T.lx) { const v = this.villages[i % this.villages.length]; T.lx = v.x + v.rad + 4; T.ly = v.y; }
      } else if (where === 'mountain') { const M = this.mountains.reduce((a, b) => (b.peak > a.peak ? b : a), this.mountains[0]); if (M) { T.lx = M.top.x; T.ly = M.top.y; M.cairn = T; } else { T.lx = this.villages[0].x + 12; T.ly = this.villages[0].y; } }
      else if (where === 'canyon') { const Cn = this.canyons[0]; if (Cn) { const [px, py] = this.canyonPoint(Cn, Cn.L * 0.62); T.lx = Math.round(px); T.ly = Math.round(py); } else { T.lx = this.villages[1].x + 12; T.ly = this.villages[1].y; } }
      else if (where === 'cave') { const P = this.places.find((p) => p.kind === 'cave' && p.key === tag) || this.places.find((p) => p.kind === 'cave' && !p.treasure); if (P) { T.place = P; T.lx = P.lm.x; T.ly = P.lm.y; P.treasure = T; } }
      else if (where === 'isle') { const P = this.places.find((p) => p.kind === 'isle' && p.key === tag); if (P) { T.place = P; T.lx = P.lm.x; T.ly = P.lm.y; P.treasure = T; } }
      else if (where === 'canopy') { const P = this.canopies[0]; if (P) { T.place = P; T.lx = P.nest.x; T.ly = P.nest.y; P.treasure = T; } }
      if (!T.lx && !T.place) { T.lx = this.villages[0].x + 10; T.ly = this.villages[0].y + 6; }
      T.cx = T.lx + 2; T.cy = T.ly + 1;   // the chest, beside its landmark
      this.treasures.push(T);
    });
    // where the walk starts: the first dream village, else the first green one
    const dreamy = (v) => BIOMES[BIOME_KEYS[this.biomeAt(v.x, v.y)]].dream && BIOMES[BIOME_KEYS[this.biomeAt(v.x, v.y + v.rad + 2)]].dream, home = this.villages.find((v) => v.fam === 'dream' && dreamy(v)) || this.villages.find(dreamy) || this.villages.find((v) => v.fam === 'dream') || this.villages[0];
    this.home = home; this.start = { x: home.x * TS + 8, y: (home.y + home.rad + 2) * TS };
    // the giants' country: the greens and the dream, and the rust
    this.giantHome = [[0.05, 0.2, 0.55, 0.95], [0.42, 0.14, 0.78, 0.6]];
    // the sky bridges: a spanning tree over the islands, each bridge a narrow deck sagging between them
    const isles = this.places.filter((p) => p.kind === 'isle'), linked = [isles[0]], walks = [];
    while (linked.length < isles.length) { let best = null, bd = 1e9; for (const A of linked) for (const B of isles) { if (linked.includes(B)) continue; const d = Math.hypot(A.x - B.x, A.y - B.y); if (d < bd) { bd = d; best = [A, B]; } } linked.push(best[1]); walks.push(best); }
    for (const [A, B] of walks) this.makeWalk(A, B, r, { w: 1.5, sag: 30, ea: A.rad * 0.5, eb: B.rad * 0.5, group: 'sky' });
    for (const I of isles) I.group = 'sky';
    // the city's roof gardens, each up a lift on the street, joined to its neighbours by plank bridges
    const C2 = this.city, nx = Math.floor((C2.x1 - C2.x0) / C2.grid), ny = Math.floor((C2.y1 - C2.y0) / C2.grid), lots = [];
    for (let lj = 0; lj < ny - 1; lj++) for (let li = 0; li < nx; li++) { const lot = li * 97 + lj, lr = hash2(lot, 7, this.seed); if (lr >= 0.12 && lr <= 0.82) lots.push({ li, lj, lot, k: hash2(lot, 29, this.seed) }); }
    lots.sort((a, b) => a.k - b.k);
    this.roofLots = new Map(); const roofs = [];
    for (const L of lots) {
      if (roofs.length >= 9) break; if (roofs.some((o) => Math.abs(o.li - L.li) + Math.abs(o.lj - L.lj) < 2)) continue;
      const inset = 1 + Math.floor(hash2(L.lot, 3, this.seed) * 2), lx0 = C2.x0 + L.li * C2.grid, ly0 = C2.y0 + L.lj * C2.grid, x0 = lx0 + 3 + inset, x1 = lx0 + C2.grid - 1 - (inset > 1 ? 1 : 0), y0 = ly0 + 3 + inset, y1 = ly0 + C2.grid - 1;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, tall = 1 - Math.hypot((cx - (C2.x0 + C2.x1) / 2) / (C2.x1 - C2.x0), (cy - (C2.y0 + C2.y1) / 2) / (C2.y1 - C2.y0)) * 1.6, hb = Math.round(48 + clamp(tall, 0, 1) * 110 * (0.5 + hash2(L.lot, 11, this.seed) * 0.8));
      const mx = Math.round(cx), Pr = { i: this.places.length, kind: 'roof', key: 'roof', group: 'roofs', x: mx, y: Math.round(cy), rad: Math.max(x1 - x0, y1 - y0) / 2, x0, y0, x1, y1, hb, h: hb + 1 + this.cityE, seed: r.int(1, 1e9), li: L.li, lj: L.lj, lift: { x: mx, y: y1 + 1 }, pad: { x: mx, y: y1 } };
      Pr.lm = { x: mx, y: Math.round(cy) }; this.places.push(Pr); roofs.push(Pr); this.roofLots.set(L.lot, Pr);
    }
    for (const A of roofs) { const B = roofs.filter((o) => o !== A && !(o.links || []).some((w) => w.a === A || w.b === A)).sort((a, b) => Math.hypot(a.x - A.x, a.y - A.y) - Math.hypot(b.x - A.x, b.y - A.y))[0]; if (B && Math.hypot(B.x - A.x, B.y - A.y) < 34) this.makeWalk(A, B, r, { w: 1.1, sag: 6, ea: A.rad * 0.6, eb: B.rad * 0.6, group: 'roofs', roof: true, straight: true }); }
    // the undercity: brick halls and brass works under the streets, down stairwells at three crossings
    const U = { i: this.places.length, kind: 'under', key: 'under', group: 'under', x: W + 400, y: 40, rad: 36, h: 0, seed: r.int(1, 1e9), gates: [] };
    const gl = [[1, 1], [Math.max(2, nx - 3), 2], [Math.floor(nx / 2), Math.max(3, ny - 2)]];
    gl.forEach(([li, lj], k) => { U.gates.push({ x: C2.x0 + li * C2.grid + 2, y: C2.y0 + lj * C2.grid + 1, cell: [[1, 1], [6, 2], [3, 6]][k] }); });
    this.places.push(U); this.under = U;
    this.chunks = new Map(); this.placeCache = new Map();
  }
  // a walkway between two places (islands or roofs): a polyline sagging between their heights; a place of its own
  makeWalk(A, B, r, o) {
    const dx = B.x - A.x, dy = B.y - A.y, L0 = Math.hypot(dx, dy) || 1, ux = dx / L0, uy = dy / L0, p0 = [A.x + 0.5 + ux * o.ea, A.y + 0.5 + uy * o.ea], p1 = [B.x + 0.5 - ux * o.eb, B.y + 0.5 - uy * o.eb];
    const pts = o.straight ? [p0, p1] : meander(r, [p0, p1], 2, 0.05); let L = 0; const cum = [0]; for (let k = 1; k < pts.length; k++) { L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); cum.push(L); }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = Math.ceil(o.w) + 3, ox = Math.floor(Math.min(...xs)) - m, oy = Math.floor(Math.min(...ys)) - m;
    const Wk = { i: this.places.length, kind: 'walk', key: o.roof ? 'roofwalk' : 'walk', group: o.group, roof: !!o.roof, a: A, b: B, pts, cum, L, w: o.w, sag: o.sag, ox, oy, nw: Math.ceil(Math.max(...xs)) + m - ox, nh: Math.ceil(Math.max(...ys)) + m - oy, x: Math.round((p0[0] + p1[0]) / 2), y: Math.round((p0[1] + p1[1]) / 2), rad: L / 2, seed: r.int(1, 1e9) };
    Wk.h = Math.round((A.h + B.h) / 2); Wk.hAt = (s2) => { const t = clamp(s2 / L, 0, 1); return Math.round(lerp(A.h, B.h, t) - o.sag * Math.sin(Math.PI * t)); };
    this.places.push(Wk); (A.links ||= []).push(Wk); (B.links ||= []).push(Wk); Wk.links = [A, B];
    return Wk;
  }
  // nearest point of a walk's line to (x, y): [distance, arclength, side]
  walkNear(Wk, x, y) { let bd = 1e9, bs = 0, side = 0; const P = Wk.pts; for (let k = 1; k < P.length; k++) { const [ax, ay] = P[k - 1], [bx, by] = P[k], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1), px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; bs = Wk.cum[k - 1] + Math.sqrt(l2) * t; side = Math.sign(dx * (y - ay) - dy * (x - ax)); } } return [bd, bs, side]; }
  inCity(x, y, m = 0) { const C = this.city; return x >= C.x0 - m && x <= C.x1 + m && y >= C.y0 - m && y <= C.y1 + m; }
  villageAt(x, y, m = 0) { for (const v of this.villages) if (Math.hypot(v.x - x, v.y - y) <= v.rad + m) return v; return null; }
  // the biome under a tile: the city's rect, else the nearest site after a warp (cached)
  biomeAt(x, y) {
    x = Number.isFinite(x) ? clamp(Math.floor(x), 0, WT - 1) : 0; y = Number.isFinite(y) ? clamp(Math.floor(y), 0, WT - 1) : 0; const q = y * WT + x, c = this.bc[q]; if (c !== 255) return c;
    let bi = 0;
    if (this.inCity(x, y)) bi = BIOMES.crown.i;
    else { const s = this.seed, wx = x + (fbm(x / 36, y / 36, s + 1, 3) - 0.5) * 72, wy = y + (fbm(x / 36, y / 36, s + 9, 3) - 0.5) * 72; let bd = 1e18; for (const p of this.sites) { const d = (wx - p.x) ** 2 + (wy - p.y) ** 2; if (d < bd) { bd = d; bi = p.b; } } }
    this.bc[q] = bi; return bi;
  }
  // how much the ground rolls here: from the biomes round about, smoothed over an 8-tile grid
  amp(x, y) {
    const N = WT / 8 + 2, gx = clamp(x / 8, 0, N - 2.001), gy = clamp(y / 8, 0, N - 2.001), i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
    const a = (ii, jj) => { const q = jj * N + ii; let v = this.ag[q]; if (v < 0) { const B = BIOMES[BIOME_KEYS[this.biomeAt(ii * 8, jj * 8)]]; v = B.key === 'crown' ? 0 : B.struct === 'hills' ? 76 : B.water ? 8 : B.struct === 'mesa' ? 10 : ({ green: 22, dream: 28, rust: 12, desert: 20, ash: 10, frost: 30 })[B.fam] ?? 12; this.ag[q] = v; } return v; };
    return lerp(lerp(a(i, j), a(i + 1, j), fx), lerp(a(i, j + 1), a(i + 1, j + 1), fx), fy);
  }
  // the ground's rise and fall before the canyons cut it: hills, ridges, mountains; flat by rivers, villages, the city
  // the country's lie: high in the north, falling away to the lowlands and the water in the south
  baseAt(y) { const t = clamp(y / WT, 0, 1); return 168 * Math.pow(1 - t, 1.6); }
  rise(x, y, B) {
    const s = this.seed, north = 1 - clamp(y / WT, 0, 1); let base = this.baseAt(y);
    if (this.inCity(x, y, 14)) { const C = this.city, d = Math.max(C.x0 - x, x - C.x1, C.y0 - y, y - C.y1, 0); base = lerp(this.cityE, base, sstep(0, 14, d)); }
    let e = Math.max(0, fbm(x / 26, y / 26, s + 700, 4) - 0.4) * 2.6 * this.amp(x, y) * (0.5 + north * 1.0), big = false;
    if (B.struct === 'ridges') e += Math.max(0, fbm(x / 10, y / 10, s + 81, 4) - 0.5) * 230;
    for (const M of this.mountains) {
      if (Math.abs(x - M.x) > M.rad * 1.4 || Math.abs(y - M.y) > M.rad * 1.4) continue;
      // a warped outline, ridges running down its flanks, rough ground on top of that
      const wx = x + (fbm(x / 14, y / 14, M.seed + 3, 3) - 0.5) * M.rad * 0.8, wy = y + (fbm(x / 14, y / 14, M.seed + 5, 3) - 0.5) * M.rad * 0.8, d = Math.hypot(wx - M.x, wy - M.y) / M.rad;
      if (d < 1) { const u = 1 - d, ridge = 1 - Math.abs(fbm(x / 9, y / 9, M.seed + 9, 3) * 2 - 1), m = M.peak * Math.pow(u, 1.3) * (0.82 + ridge * 0.26) + (fbm(x / 5, y / 5, M.seed, 3) - 0.5) * 56 * u; if (m > e) { e = m; big = true; } }
    }
    let mask = sstep(1.5, 9, this.water.near(x, y)[0]);
    if (this.inCity(x, y, 10)) { const C = this.city, d = Math.max(C.x0 - x, x - C.x1, C.y0 - y, y - C.y1); mask = Math.min(mask, sstep(0, 10, d)); }
    for (const v of this.villages) { const d = Math.hypot(v.x - x, v.y - y); if (d < v.rad + 9) mask = Math.min(mask, sstep(v.rad + 1, v.rad + 9, d)); }
    e *= mask; const q = big && e > 64 ? 16 : 8;
    return Math.round((base + e) / q) * q;
  }
  canyonAt(x, y) { const [d, s, t] = this.canyonIx.near(x, y); if (!s) return { d: 1e9 }; return { d: d + (fbm(x / 4, y / 4, this.seed + 404, 2) - 0.5) * 1.6, s: s.s0 + (s.s1 - s.s0) * t, C: s.tag }; }
  canyonPoint(Cn, s) { const P = Cn.pts; let acc = 0; for (let k = 1; k < P.length; k++) { const l = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); if (acc + l >= s || k === P.length - 1) { const t = clamp((s - acc) / (l || 1), 0, 1), dx = (P[k][0] - P[k - 1][0]) / (l || 1), dy = (P[k][1] - P[k - 1][1]) / (l || 1); return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t, -dy, dx]; } acc += l; } return [P[0][0], P[0][1], 0, 1]; }
  // a lift on the rim, its cage hanging over the floor beside it
  canyonLift(Cn, f) {
    const [px, py, nx, ny] = this.canyonPoint(Cn, Cn.L * f);
    for (const sg of [1, -1]) {
      const top = { x: Math.round(px + nx * sg * (Cn.w + 1.8)), y: Math.round(py + ny * sg * (Cn.w + 1.8)) }, bot = { x: Math.round(px + nx * sg * (Cn.w - 1.2)), y: Math.round(py + ny * sg * (Cn.w - 1.2)) };
      if (this.canyonAt(top.x, top.y).d < 0.6 || this.canyonAt(bot.x, bot.y).d > -0.8 || this.roads.near(top.x, top.y)[0] < 1 || this.water.near(top.x, top.y)[0] < 2) continue;
      return { top, bot, C: Cn };
    }
    return null;
  }
  // a cave mouth against a wall of the canyon floor (the north wall by choice, so it faces the camera)
  canyonMouth(Cn) {
    let any = null;
    for (const f of [0.5, 0.44, 0.56, 0.38, 0.62, 0.32, 0.68, 0.26, 0.74]) for (const sg of [1, -1]) {
      const [px, py, nx, ny] = this.canyonPoint(Cn, Cn.L * f), x = Math.round(px + nx * sg * (Cn.w - 1)), y = Math.round(py + ny * sg * (Cn.w - 1));
      if (this.canyonAt(x, y).d > -0.5 || this.water.near(x, y)[0] < 2 || this.canyonAt(x + Math.round(nx * sg * 2.5), y + Math.round(ny * sg * 2.5)).d < 0) continue;
      if (ny * sg < -0.5 && this.canyonAt(x, y - 2).d > 0) return { x, y };
      any ||= { x, y };
    }
    return any;
  }
  flat(x, y, r) { const e0 = this.tileInfo(x, y).e; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const t = this.tileInfo(x + i, y + j); if (t.k !== K_GROUND && t.k !== K_PATH || Math.abs(t.e - e0) > 8) return false; } return true; }
  // everything about one tile: biome, kind, ground elevation, block height above it, block texture, the floor under a bridge
  tileInfo(x, y) {
    const out = { b: 0, k: K_GROUND, e: 0, h: 0, f: 0, lo: NOLO };
    if (x < 0 || y < 0 || x >= WT || y >= WT) { out.k = K_CLIFF; out.h = 80; out.e = Math.round(this.baseAt(y) / 8) * 8; out.b = this.biomeAt(x, y); return out; }
    const s = this.seed, b = (out.b = this.biomeAt(x, y)), B = BIOMES[BIOME_KEYS[b]];
    // border: a wall of cliffs round the world's edge
    const ed = Math.min(x, y, WT - 1 - x, WT - 1 - y); if (ed < 2 + fbm(x / 5, y / 5, s + 5, 2) * 3) { out.k = K_CLIFF; out.h = 60 + hash2(x, y, 9) * 30; out.e = Math.round(this.baseAt(y) / 8) * 8; return out; }
    // the city: streets every `grid` tiles, buildings between (some fallen, some gone to green)
    if (this.inCity(x, y)) {
      out.e = this.cityE;
      const C = this.city, gx = (x - C.x0) % C.grid, gy = (y - C.y0) % C.grid, lot = Math.floor((x - C.x0) / C.grid) * 97 + Math.floor((y - C.y0) / C.grid);
      if (gx < 3 || gy < 3) { out.k = K_STREET; return out; }
      const lr = hash2(lot, 7, s), park = lr < 0.12, ruin = lr > 0.82;
      if (park) return out;
      const inset = 1 + Math.floor(hash2(lot, 3, s) * 2);
      if (gx < 3 + inset || gy < 3 + inset || gx > C.grid - 1 - (inset > 1 ? 1 : 0) || gy > C.grid - 1) { out.k = K_FLOOR; return out; }
      if (ruin) { if (hash2(x, y, s + 4) < 0.45) { out.k = K_WALL; out.h = 8 + Math.round(hash2(x, y, s + 5) * 3) * 8; out.f = 2; } else out.k = K_FLOOR; return out; }
      const roof = this.roofLots?.get(lot); if (roof) { out.k = K_BLDG; out.h = roof.hb; out.f = 1 + (Math.floor(hash2(lot, 17, s) * 5)); return out; }
      const tall = 1 - Math.hypot((x - (C.x0 + C.x1) / 2) / (C.x1 - C.x0), (y - (C.y0 + C.y1) / 2) / (C.y1 - C.y0)) * 1.6;
      out.k = K_BLDG; out.h = Math.round(40 + clamp(tall, 0, 1) * 150 * (0.5 + hash2(lot, 11, s) * 0.8) + hash2(lot, 13, s) * 30); out.f = 1 + (Math.floor(hash2(lot, 17, s) * 5));
      if (hash2(lot, 19, s) < 0.3) out.h -= Math.round(hash2(x, y, s + 23) * out.h * 0.4);   // broken tops
      return out;
    }
    const road = this.roads.near(x, y)[0], river = this.water.near(x, y)[0], vil = this.villageAt(x, y, 1);
    let e = this.rise(x, y, B);
    // water: the rivers, and lakes in the wet biomes
    let wet = river <= 0, lakeK = K_WATER;
    if (!wet && B.water && !vil) { const n = fbm(x / 9, y / 9, s + 33, 4), thr = 1 - B.waterAmt * 0.9; if (n > thr) { wet = true; lakeK = B.water === 'toxic' ? K_TOXIC : K_WATER; e = Math.round(this.baseAt(y) / 8) * 8; } else if (n > thr - 0.14) { const bl = this.baseAt(y); e = Math.round((bl + (e - bl) * clamp((thr - n) / 0.14, 0, 1)) / 8) * 8; } }
    // the canyons cut through all of it, ramped at their ends; the rivers fall in, the roads bridge them
    const cn = this.canyonAt(x, y);
    if (cn.d < 0) {
      const f = clamp(Math.min(cn.s, cn.C.L - cn.s) / 18, 0, 1), floor = Math.round(lerp(e, this.baseAt(y) - cn.C.depth, f) / 16) * 16;
      if (road <= 0 && f > 0.3) { out.k = K_BRIDGE; out.e = e; out.lo = floor; return out; }
      out.e = floor; out.k = wet && river <= 0 ? K_WATER : K_GROUND; out.cn = 1; return out;
    }
    out.e = e;
    if (road <= 0) { out.k = wet ? K_BRIDGE : K_PATH; return out; }
    if (wet && !vil) { out.k = river <= 0 ? K_WATER : lakeK; return out; }
    if (vil) { const d = Math.hypot(vil.x - x, vil.y - y); if (d < 2.2 || (Math.abs(vil.x - x) < 1 && d < vil.rad) || (Math.abs(vil.y - y) < 1 && d < vil.rad)) out.k = K_PATH; return out; }
    for (const P of this.canopies) if (Math.abs(x - P.x) <= 1 && Math.abs(y - P.y) <= 1) { out.k = K_TRUNK; out.h = P.h - e; return out; }
    for (const P of this.places) { if (P.lift && Math.abs(P.lift.x - x) <= 2 && Math.abs(P.lift.y - y) <= 2) return out; }
    for (const T of this.treasures) if (!T.place && Math.abs(T.lx - x) <= 2 && Math.abs(T.ly - y) <= 2) return out;
    // the biomes' own structures
    if (road > 2) {
      if (B.struct === 'mesa') { const n = fbm(x / 7, y / 7, s + 77, 4); if (n > 0.6) out.e = e + 64 + Math.floor((n - 0.6) * 6) * 16; }
      else if (B.struct === 'crater') { const n = fbm(x / 12, y / 12, s + 91, 3), ring = Math.abs(n - 0.5); if (ring < 0.05) out.e = e + Math.round(((0.05 - ring) / 0.05) * 3) * 8; }
      else if (B.struct === 'ruins' || B.struct === 'factory') {
        const bx = Math.floor(x / 11), by = Math.floor(y / 11), lx = x - bx * 11, ly = y - by * 11, hr = hash2(bx, by, s + 55);
        if (hr < (B.struct === 'factory' ? 0.55 : 0.3)) { const w = 4 + Math.floor(hash2(bx, by, s + 56) * 5), h = 4 + Math.floor(hash2(bx, by, s + 57) * 4), ox = 1 + Math.floor(hash2(bx, by, s + 58) * 3), oy = 1 + Math.floor(hash2(bx, by, s + 59) * 3);
          if (lx >= ox && ly >= oy && lx < ox + w && ly < oy + h) { const edge = lx === ox || ly === oy || lx === ox + w - 1 || ly === oy + h - 1, door = (lx === ox + (w >> 1) || ly === oy + (h >> 1)); if (edge && !door && hash2(x, y, s + 60) > (B.struct === 'factory' ? 0.12 : 0.3)) { out.k = K_WALL; out.h = B.struct === 'factory' ? 32 : 8 + Math.round(hash2(x, y, s + 61) * 3) * 8; out.f = 0; } else out.k = K_FLOOR; } }
      }
    }
    return out;
  }
  // a chunk: tiles (with a one-tile border, for blending and faces), solidity, props and decals
  chunk(cx, cy) {
    const key = cy * 1000 + cx; let C = this.chunks.get(key); if (C) return C;
    const n = CS + 2, N = n * n, b = new Uint8Array(N), k = new Uint8Array(N), e = new Int16Array(N), h = new Float32Array(N), f = new Uint8Array(N), lo = new Int16Array(N), x0 = cx * CS - 1, y0 = cy * CS - 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const t = this.tileInfo(x0 + i, y0 + j), q = j * n + i; b[q] = t.b; k[q] = t.k; e[q] = t.e; h[q] = t.h; f[q] = t.f; lo[q] = t.lo; }
    C = { cx, cy, b, k, e, h, f, lo, n, solid: new Uint8Array(CS * CS), props: [], decals: [], lights: [], shafts: [] };
    const at = (i, j) => (j + 1) * n + i + 1;
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) { const kk = k[at(i, j)]; if (kk === K_TOXIC || kk === K_BLDG || kk === K_CLIFF || kk === K_TRUNK) C.solid[j * CS + i] = 1; }
    let flat = true; for (let q = 1; q < N; q++) if (e[q] !== e[0]) { flat = false; break; } C.flat = flat;
    this.populate(C, at);
    this.chunks.set(key, C);
    if (this.chunks.size > 1400) for (const [kk] of this.chunks) { this.chunks.delete(kk); if (this.chunks.size < 1100) break; }
    return C;
  }
  // props and decals for a chunk: the biome's own, a village's buildings, the city's furniture, lifts, treasures
  populate(C, at) {
    const s = this.seed, X0 = C.cx * CS, Y0 = C.cy * CS, k = C.k, inChunk = (tx, ty) => tx >= X0 && ty >= Y0 && tx < X0 + CS && ty < Y0 + CS;
    const eAt = (tx, ty) => C.e[at(tx - X0, ty - Y0)] + (C.k[at(tx - X0, ty - Y0)] === K_WALL ? C.h[at(tx - X0, ty - Y0)] : 0);
    const place = (type, x, y, fam, v, extra) => { const D = PROPDEF[type], tx0 = Math.floor(x / TS), ty0 = Math.floor((y - 2) / TS); C.props.push({ type, x, y, fam, v: v ?? Math.floor(hash2(x, y, s + 3) * 3), e: inChunk(tx0, ty0) ? eAt(tx0, ty0) : 0, ...extra }); if (D?.foot) { const fw = Math.max(1, Math.ceil(D.foot[0] / TS)), tx = tx0 - X0 - Math.floor((fw - 1) / 2), ty = ty0 - Y0; for (let i = tx; i < tx + fw; i++) if (i >= 0 && i < CS && ty >= 0 && ty < CS) C.solid[ty * CS + i] = 1; } };
    // an edge: a neighbour more than a step up or down (no trees teetering on the rims)
    const edge = (i, j) => { const q = at(i, j), e0 = C.e[q]; return Math.abs(C.e[q - 1] - e0) > STEP || Math.abs(C.e[q + 1] - e0) > STEP || Math.abs(C.e[q - C.n] - e0) > STEP || Math.abs(C.e[q + C.n] - e0) > STEP; };
    // the ground kept clear round the ways up and down and the treasures
    const keep = new Set(), hold = (t, r) => { if (!t) return; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const x = t.x + i - X0, y = t.y + j - Y0; if (x >= 0 && y >= 0 && x < CS && y < CS) keep.add(y * CS + x); } };
    for (const P of this.places) { hold(P.lift, 2); hold(P.mouth, 2); }
    for (const Cn of this.canyons) for (const L of Cn.lifts) { hold(L.top, 1); hold(L.bot, 1); }
    for (const T of this.treasures) if (!T.place) { hold({ x: T.lx, y: T.ly }, 2); hold({ x: T.cx, y: T.cy }, 1); }
    for (const g of this.under?.gates || []) hold(g, 1);
    const ground = (i, j) => k[at(i, j)] === K_GROUND, free = (i, j) => i >= 0 && j >= 0 && i < CS && j < CS && ground(i, j) && !C.solid[j * CS + i] && !edge(i, j) && !keep.has(j * CS + i);
    // villages whose houses fall in this chunk
    for (const v of this.villages) {
      if (Math.abs(v.x - (X0 + CS / 2)) > CS + v.rad + 4 || Math.abs(v.y - (Y0 + CS / 2)) > CS + v.rad + 4) continue;
      const r = RNG(v.seed), style = STYLE[v.fam], n = r.int(7, 12), out = [];
      for (let q = 0; q < n * 4 && out.length < n; q++) { const a = r.range(0, 6.283), d = r.range(3.5, v.rad - 1), x = Math.round(v.x + Math.cos(a) * d), y = Math.round(v.y + Math.sin(a) * d * 0.8); if (out.some((o) => Math.abs(o.x - x) < 4 && Math.abs(o.y - y) < 3) || Math.abs(x - v.x) < 1.5 || Math.abs(y - v.y) < 1.5) continue; out.push({ x, y, type: r.pick(style) }); }
      const dream = v.fam === 'dream', extras = [['well', v.x + 2, v.y - 2], [v.fam === 'desert' || v.fam === 'rust' ? 'watertower' : 'windpump', v.x - 4, v.y - 3], [dream ? 'lanternshrine' : 'firebarrel', v.x + 1, v.y + 2], ['firebarrel', v.x - 2, v.y + 3], ['laundry', v.x + 4, v.y + 3], ['cart', v.x - 5, v.y + 4], ['fence', v.x - v.rad + 1, v.y + 1], ['fence', v.x + v.rad - 3, v.y - 2], [dream ? 'flowerbush' : 'tent', v.x + 5, v.y - 5]];
      if (dream) extras.push(['blossom', v.x - 6, v.y - 5], ['flowerbush', v.x + 3, v.y + 5], ['flowerbush', v.x - 3, v.y - 6]);
      for (const o of out) extras.push([o.type, o.x, o.y]);
      for (const [type, tx, ty] of extras) { if (!inChunk(tx, ty)) continue; place(type, tx * TS + 8, ty * TS + 14, v.fam, Math.floor(hash2(tx, ty, s) * 3), { vil: v }); const le = eAt(tx, ty); if (type === 'firebarrel') C.lights.push({ x: tx * TS + 8, y: ty * TS + 12, h: le + 12, r: 26, c: [255, 150, 60], fire: 1 }); else if (type === 'lanternshrine') C.lights.push({ x: tx * TS + 8, y: ty * TS + 12, h: le + 22, r: 26, c: [255, 210, 120] }); else if (PROPDEF[type].s === 3 && type !== 'watertower' && type !== 'windpump' && hash2(tx, ty, s + 1) < 0.6) C.lights.push({ x: tx * TS + 8, y: ty * TS + 10, h: le + 10, r: 16, c: [255, 190, 110] }); }
      for (let q = 0; q < 10; q++) { const tx = Math.round(v.x + r.range(-v.rad, v.rad)), ty = Math.round(v.y + r.range(-v.rad, v.rad)); if (inChunk(tx, ty)) C.decals.push({ type: 'crops', x: tx, y: ty, fam: v.fam }); }
    }
    // lifts: towers under the islands (a cable running up out of sight), baskets at the giant trees, cages on the canyon rims
    for (const P of this.places) {
      const L = P.lift; if (!L || !inChunk(L.x, L.y)) continue; const le = eAt(L.x, L.y);
      if (P.kind === 'isle') { place('lifttower', L.x * TS + 8, L.y * TS + 12, ISLES[P.key].fam, 0, { lift: P }); C.lights.push({ x: L.x * TS + 8, y: L.y * TS + 12, h: le + 116, r: 30, c: [255, 190, 110], beacon: 1 }); C.shafts.push({ x: L.x * TS + 8, y: L.y * TS + 10, y0: le + 118, y1: P.h - 40 }); }
      else if (P.kind === 'roof') { place('liftpad', L.x * TS + 8, L.y * TS + 12, 'rust', 0, { lift: P }); C.lights.push({ x: L.x * TS + 8, y: L.y * TS + 12, h: le + 20, r: 22, c: [255, 190, 110], beacon: 1 }); C.shafts.push({ x: L.x * TS + 8, y: L.y * TS + 6, y0: le + 6, y1: P.h + 24 }); }
      else if (P.kind === 'canopy') { place('basket', L.x * TS + 8, L.y * TS + 12, 'dream', 0, { lift: P }); C.lights.push({ x: L.x * TS + 8, y: L.y * TS + 12, h: le + 20, r: 22, c: [255, 210, 120] }); C.shafts.push({ x: L.x * TS + 8, y: L.y * TS + 10, y0: le + 28, y1: P.h, rope: 1 }); }
    }
    for (const Cn of this.canyons) for (const L of Cn.lifts) {
      if (inChunk(L.top.x, L.top.y)) { place('headframe', L.top.x * TS + 8, L.top.y * TS + 12, Cn.fam, 0, { clift: L }); C.lights.push({ x: L.top.x * TS + 8, y: L.top.y * TS + 12, h: eAt(L.top.x, L.top.y) + 40, r: 26, c: [255, 190, 110], beacon: 1 }); }
      if (inChunk(L.bot.x, L.bot.y)) { const be = eAt(L.bot.x, L.bot.y); place('basket', L.bot.x * TS + 8, L.bot.y * TS + 12, Cn.fam, 1, { clift: L }); C.shafts.push({ x: L.bot.x * TS + 8, y: L.bot.y * TS + 10, y0: be + 28, y1: be + Cn.depth + 30, rope: 1 }); C.lights.push({ x: L.bot.x * TS + 8, y: L.bot.y * TS + 12, h: be + 18, r: 22, c: [255, 200, 120] }); }
    }
    for (const g of this.under?.gates || []) if (inChunk(g.x, g.y)) { place('stairs', g.x * TS + 8, g.y * TS + 12, 'rust', 0, { gate: g }); C.lights.push({ x: g.x * TS + 8, y: g.y * TS + 12, h: this.cityE + 20, r: 30, c: [255, 220, 160] }); }
    for (const P of this.places) if (P.kind === 'cave' && P.mouth && inChunk(P.mouth.x, P.mouth.y)) { const m = P.mouth; place('cavemouth', m.x * TS + 8, m.y * TS + 6, 'cave', 0, { mouth: P }); C.lights.push({ x: m.x * TS + 8, y: m.y * TS + 6, h: eAt(m.x, m.y) + 14, r: 30, c: [140, 230, 210] }); }
    // the treasures on the ground: a landmark, and a chest beside it
    for (const T of this.treasures) if (!T.place) {
      if (inChunk(T.lx, T.ly)) { const fam = BIOMES[BIOME_KEYS[C.b[at(T.lx - X0, T.ly - Y0)]]].fam; place(T.land, T.lx * TS + 8, T.ly * TS + 12, T.land === 'cairn' ? 'frost' : fam, 0, { landmark: T }); if (T.land === 'obelisk' || T.land === 'fountain' || T.land === 'foxstatue') C.lights.push({ x: T.lx * TS + 8, y: T.ly * TS + 12, h: eAt(T.lx, T.ly) + 30, r: 30, c: T.land === 'obelisk' ? [160, 200, 255] : [200, 255, 220] }); }
      if (inChunk(T.cx, T.cy)) place('chest', T.cx * TS + 8, T.cy * TS + 12, 'dream', 0, { chest: T });
    }
    // the biomes' own props and decals, tile by tile
    const inCity = this.inCity(X0 + CS / 2, Y0 + CS / 2, CS);
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const x = X0 + i, y = Y0 + j, kk = k[at(i, j)], B = BIOMES[BIOME_KEYS[C.b[at(i, j)]]], fam = B.fam, rr = (q) => hash2(x * 7 + q, y * 13 + q * 3, s + 101);
      if (keep.has(j * CS + i) && (kk === K_STREET || kk === K_FLOOR)) continue;
      if (kk === K_STREET) { if (rr(1) < 0.012) place(B.props.find((p) => p[0] === 'wreck') ? 'wreck' : 'scrap', x * TS + 8, y * TS + 12, fam); else if (rr(2) < 0.006) place('bus', x * TS + 8, y * TS + 12, fam); if (rr(3) < 0.05) C.decals.push({ type: rr(4) < 0.5 ? 'crack' : 'rubble', x, y, fam }); const C2 = this.city; if (((x - C2.x0) % C2.grid === 1) && (y % 6 === 0)) { place('lamp', x * TS + 4, y * TS + 8, fam); if (rr(5) < 0.25) C.lights.push({ x: x * TS + 6, y: y * TS + 8, h: this.cityE + 30, r: 20, c: [255, 200, 130] }); } continue; }
      if (kk === K_FLOOR && inCity) { if (rr(6) < 0.04) place(rr(7) < 0.5 ? 'scrap' : 'burnt', x * TS + 8, y * TS + 12, fam); if (rr(8) < 0.12) C.decals.push({ type: 'rubble', x, y, fam }); continue; }
      if (kk === K_GROUND && inCity && this.inCity(x, y)) { if (rr(9) < 0.08 && free(i, j)) place(rr(10) < 0.6 ? 'tree' : 'burnt', x * TS + 8, y * TS + 14, 'green'); if (rr(11) < 0.15) C.decals.push({ type: 'tuft', x, y, fam: 'green' }); continue; }
      if (kk === K_GROUND) {
        const e0 = C.e[at(i, j)] - this.baseAt(y);   // how high above (or below) the country round about
        if (this.roads.near(x, y)[0] < 1.5 || this.villageAt(x, y, 2)) { if (rr(12) < 0.1) C.decals.push({ type: B.decals[0]?.[0] || 'tuft', x, y, fam }); continue; }
        // high on a mountain: rocks and snowpines only
        if (e0 >= 150) { if (rr(15) < (e0 >= 220 ? 0.02 : 0.05) && free(i, j)) place(rr(16) < 0.5 || e0 >= 220 ? 'rock' : 'snowpine', x * TS + 8, y * TS + 14, e0 >= 200 ? 'frost' : fam); if (rr(17) < 0.08) C.decals.push({ type: 'stones', x, y, fam }); continue; }
        const cl = fbm(x / 6, y / 6, s + 300, 2), deep = e0 < -60;
        for (const [type, dens] of B.props) { if (rr(20 + type.length) >= dens * (0.4 + cl * 1.3) * (deep ? 0.35 : 1)) continue; if (!free(i, j)) break; place(type, x * TS + 8 + (rr(13) - 0.5) * 4, y * TS + 14, fam); break; }
        if (deep && rr(18) < 0.02 && free(i, j)) place(rr(19) < 0.5 ? 'boulder' : 'rock', x * TS + 8, y * TS + 14, fam);
        for (const [type, dens] of B.decals) if (rr(40 + type.length) < dens) C.decals.push({ type, x, y, fam });
      } else if (kk === K_PATH && rr(14) < 0.04) C.decals.push({ type: 'stones', x, y, fam });
    }
    // a landmark or two: statues in the city squares
    if (inCity && hash2(C.cx, C.cy, s + 71) < 0.1) { const tx = X0 + 8, ty = Y0 + 8; if (k[at(8, 8)] === K_STREET || k[at(8, 8)] === K_GROUND) place('statue', tx * TS, ty * TS, 'ash'); }
  }
  // a high or low place: its own tiles, props, the landmark, the lift pad or the way out
  place(P) {
    let M = this.placeCache.get(P.i); if (M) return M;
    if (P.kind === 'walk' || P.kind === 'roof' || P.kind === 'under') { M = P.kind === 'walk' ? this.walkGrid(P) : P.kind === 'roof' ? this.roofGrid(P) : this.underGrid(P); this.placeCache.set(P.i, M); return M; }
    const isle = P.kind === 'isle', cave = P.kind === 'cave', canopy = P.kind === 'canopy', L = cave ? CAVES[P.key] : ISLES[P.key], r = RNG(P.seed), n = P.rad * 2 + 8, ox = P.x - P.rad - 4, oy = P.y - P.rad - 4, N = n * n;
    const kind = new Uint8Array(N).fill(K_VOID), e = new Int16Array(N).fill(P.h), h = new Float32Array(N), solid = new Uint8Array(N).fill(1), props = [], decals = [], lights = [], depth = new Float32Array(N), q = (x, y) => (y - oy) * n + (x - ox);
    const inside = (x, y) => x >= ox && y >= oy && x < ox + n && y < oy + n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = ox + i, y = oy + j, d = Math.hypot((x - P.x) / P.rad, (y - P.y) / (P.rad * (cave ? 0.9 : 0.85))) + (fbm(x / 4, y / 4, P.seed, 3) - 0.5) * (canopy ? 0.7 : 0.5), Q = j * n + i;
      if (d < 1) { kind[Q] = K_GROUND; solid[Q] = 0; }
      else if (cave && d < 1.5) { kind[Q] = K_WALL; const ang = Math.atan2(y - P.y, x - P.x); h[Q] = Math.sin(ang) > 0.35 ? 12 + hash2(x, y, 3) * 8 : 70 + (1 - Math.max(0, Math.sin(ang))) * 40 + hash2(x, y, 4) * 30; }
    }
    const open = (x, y, w = 1) => { for (let j = -w; j <= w; j++) for (let i = -w; i <= w; i++) if (inside(x + i, y + j)) { const Q = q(x + i, y + j); kind[Q] = K_GROUND; solid[Q] = 0; h[Q] = 0; } };
    const mark = (x, y, w = 0) => { for (let j = -w; j <= w; j++) for (let i = -w; i <= w; i++) if (inside(x + i, y + j)) { const Q = q(x + i, y + j); if (kind[Q] === K_GROUND) kind[Q] = K_PATH; } };
    const lm = P.lm, door = cave ? P.exit : P.pad;
    open(lm.x, lm.y, 2); open(door.x, door.y, 1);
    for (let t = 0; t <= 1; t += 0.04) mark(Math.round(lerp(door.x, lm.x, t)), Math.round(lerp(door.y, lm.y, t)), 0);
    // a pond with a stream running off the rim (a waterfall into the haze), on some islands; a pool in some caves
    if ((isle && r.chance(0.6)) || (cave && r.chance(0.7))) {
      const px = P.x + r.int(-4, 4) + (lm.x < P.x ? 4 : -4), py = P.y + r.int(-2, 3), pr = r.range(1.6, 2.8);
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const x = px + i, y = py + j; if (inside(x, y) && Math.hypot(i, j * 1.2) < pr && kind[q(x, y)] === K_GROUND && Math.hypot(x - lm.x, y - lm.y) > 3 && Math.hypot(x - door.x, y - door.y) > 2.5) kind[q(x, y)] = K_WATER; }
      if (isle) { const a = r.chance(0.5) ? 0 : Math.PI; for (let s2 = 0; s2 < P.rad + 4; s2 += 0.5) { const x = Math.round(px + Math.cos(a) * s2), y = Math.round(py + Math.sin(a) * s2 * 0.3); if (!inside(x, y)) break; const Q = q(x, y); if (kind[Q] === K_VOID) break; if (Math.hypot(x - lm.x, y - lm.y) > 3 && Math.hypot(x - door.x, y - door.y) > 2) kind[Q] = K_WATER; } }
    }
    const put = (type, x, y, extra) => { const D = PROPDEF[type], tx = Math.floor(x / TS), ty = Math.floor((y - 2) / TS); props.push({ type, x, y, fam: L.fam, v: r.int(0, 2), e: P.h, ...extra }); if (D?.foot) { const fw = Math.max(1, Math.ceil(D.foot[0] / TS)), t0 = tx - Math.floor((fw - 1) / 2); for (let i = t0; i < t0 + fw; i++) if (inside(i, ty)) solid[q(i, ty)] = 1; } };
    put(L.land, lm.x * TS + 8, lm.y * TS + 12, { landmark: P.treasure || null });
    if (P.treasure) { const T = P.treasure; if (T.land !== L.land) put(T.land, T.lx * TS + 8, T.ly * TS + 12, { landmark: T }); open(T.cx, T.cy, 0); put('chest', T.cx * TS + 8, T.cy * TS + 12, { chest: T }); }
    if (cave) { put('cavemouth', door.x * TS + 8, door.y * TS + 18, { exit: P }); lights.push({ x: door.x * TS + 8, y: door.y * TS + 14, h: P.h + 14, r: 34, c: [255, 230, 180] }); }
    else { put(canopy ? 'basket' : 'liftpad', door.x * TS + 8, door.y * TS + 12, { pad: P }); lights.push({ x: door.x * TS + 8, y: door.y * TS + 12, h: P.h + 20, r: 22, c: [255, 190, 110], beacon: 1 }); }
    const glowLand = { windtemple: [200, 230, 255], starharp: [190, 255, 230], floatbell: [255, 230, 170], crystalheart: [170, 255, 230], moonpool: [190, 200, 255], obelisk: [160, 200, 255], treehouse: [255, 210, 130], shrine: [140, 220, 180], observatory: [255, 220, 160] }[L.land];
    if (glowLand) lights.push({ x: lm.x * TS + 8, y: lm.y * TS + 12, h: P.h + 40, r: 34, c: glowLand });
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = ox + i, y = oy + j, Q = j * n + i; if (kind[Q] !== K_GROUND || solid[Q] || Math.hypot(x - door.x, y - door.y) < 2.5 || Math.hypot(x - lm.x, y - lm.y) < 3.2) continue;
      if (cave && r.chance(0.025)) { kind[Q] = K_WALL; h[Q] = 120; continue; }   // a pillar
      for (const [type, dens] of L.props) if (r.chance(dens)) { put(type, x * TS + 8, y * TS + 14); if ((type === 'crystal' || type === 'glowshroom' || type === 'lanterntree') && r.chance(cave ? 0.6 : 0.3)) lights.push({ x: x * TS + 8, y: y * TS + 10, h: P.h + 12, r: 22, c: type === 'crystal' ? [140, 240, 220] : type === 'lanterntree' ? [255, 210, 120] : [200, 170, 255] }); break; }
      if (r.chance(cave ? 0.12 : 0.18)) decals.push({ type: cave ? r.pick(['stones', 'glowmoss', 'stones']) : r.pick(['tuft', 'stones', 'leaves', 'flowers']), x, y, fam: L.fam });
    }
    // the underside: how far each column hangs (a deep cone under an island, a shallow tangle under a canopy)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const Q = j * n + i; if (kind[Q] === K_VOID) continue; const dd = 1 - Math.hypot(ox + i - P.x, oy + j - P.y) / (P.rad * 1.2); depth[Q] = canopy ? 18 + fbm(i / 2, j / 2, P.seed + 7, 2) * 40 : 40 + fbm(i / 3, j / 3, P.seed + 7, 3) * 190 * Math.max(0.15, dd); }
    // the floating rocks round an island, and its clouds below
    const floaters = [], clouds = [];
    if (isle) { for (let k2 = 0; k2 < 10; k2++) { const a = r.range(0, 6.283), d = P.rad * r.range(1.15, 2) * TS; floaters.push({ x: P.x * TS + Math.cos(a) * d, y: P.y * TS + Math.sin(a) * d * 0.8, h: P.h - r.range(10, 160), v: r.int(0, 2), ph: r.range(0, 6.28) }); } for (let k2 = 0; k2 < 14; k2++) { const a = r.range(0, 6.283), d = P.rad * r.range(0.5, 4.5) * TS; clouds.push({ x: P.x * TS + Math.cos(a) * d, y: P.y * TS + Math.sin(a) * d, h: P.h - r.range(120, 380), v: r.int(0, 3), s: r.range(0.8, 1.8) }); } }
    M = { P, L, n, nw: n, nh: n, ox, oy, kind, e, h, solid, props, decals, lights, depth, floaters, clouds };
    this.placeCache.set(P.i, M);
    return M;
  }
  // a walkway's tiles: the deck, posts with lanterns along both sides, rocks floating under the long ones
  walkGrid(P) {
    const nw = P.nw, nh = P.nh, N = nw * nh, r = RNG(P.seed), kind = new Uint8Array(N).fill(K_VOID), e = new Int16Array(N), h = new Float32Array(N), solid = new Uint8Array(N).fill(1), props = [], lights = [], floaters = [], L = WALKWAY[P.roof ? 'roof' : 'sky'];
    // on the long ones, a few round landings to rest on: a lantern shrine, flowers, a view
    const lands = []; if (!P.roof) { const m = Math.floor(P.L / 85); for (let k = 1; k <= m; k++) { const s0 = (P.L * k) / (m + 1), q2 = P.pts.findIndex((_, q) => q > 0 && P.cum[q] >= s0), a = P.pts[q2 - 1], b = P.pts[q2], t = (s0 - P.cum[q2 - 1]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); lands.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, s: s0 }); } }
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) { const tx = P.ox + i + 0.5, ty = P.oy + j + 0.5, [d, s2] = this.walkNear(P, tx, ty), Q = j * nw + i, Ld = lands.find((l) => Math.hypot(l.x - tx, l.y - ty) < 3.4); if (d <= P.w || Ld) { kind[Q] = K_BRIDGE; solid[Q] = 0; e[Q] = Ld ? P.hAt(Ld.s) : P.hAt(s2); } }
    for (const l of lands) { const hh = P.hAt(l.s); props.push({ type: 'lanternshrine', x: (l.x + 1.6) * TS, y: (l.y - 1.2) * TS, fam: 'dream', v: r.int(0, 2), e: hh }, { type: 'flowerbush', x: (l.x - 2) * TS, y: (l.y + 1.6) * TS, fam: 'dream', v: r.int(0, 2), e: hh }, { type: 'flowerbush', x: (l.x + 2.2) * TS, y: (l.y + 1.8) * TS, fam: 'dream', v: r.int(0, 2), e: hh }); lights.push({ x: (l.x + 1.6) * TS, y: (l.y - 1.2) * TS, h: hh + 24, r: 30, c: [255, 210, 140] }); }
    const step = P.roof ? 4 : 5;
    for (let s2 = step; s2 < P.L - 1; s2 += step) for (const sg of [-1, 1]) {
      const k = P.pts.findIndex((_, q) => q > 0 && P.cum[q] >= s2), a = P.pts[k - 1], b = P.pts[k], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = (s2 - P.cum[k - 1]) / l, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t, nx2 = -(b[1] - a[1]) / l, ny2 = (b[0] - a[0]) / l;
      const x = (px + nx2 * sg * (P.w - 0.35)) * TS, y = (py + ny2 * sg * (P.w - 0.35)) * TS, hh = P.hAt(s2);
      props.push({ type: 'skypost', x, y, fam: L.fam, v: r.int(0, 2), e: hh });
      if ((Math.round(s2 / step) + (sg > 0 ? 1 : 0)) % 2 === 0) lights.push({ x, y, h: hh + 22, r: 20, c: [255, 214, 140] });
      if (!P.roof && sg > 0 && Math.round(s2 / step) % 5 === 2) floaters.push({ x: px * TS + r.range(-30, 30), y: py * TS + r.range(-20, 20), h: hh - r.range(40, 120), v: r.int(0, 2), ph: r.range(0, 6.28) });
    }
    return { P, L, n: nw, nw, nh, ox: P.ox, oy: P.oy, kind, e, h, solid, props, decals: [], lights, depth: new Float32Array(N), floaters, clouds: [] };
  }
  // a roof garden: beds and planters, a water tank, washing, a glasshouse on the big ones, a low parapet round it
  roofGrid(P) {
    const nw = P.x1 - P.x0 + 1, nh = P.y1 - P.y0 + 1, N = nw * nh, r = RNG(P.seed), L = ROOFTOP, ox = P.x0, oy = P.y0, kind = new Uint8Array(N).fill(K_GROUND), e = new Int16Array(N).fill(P.h), h = new Float32Array(N), solid = new Uint8Array(N), props = [], decals = [], lights = [];
    const pad = P.pad, edge = (i, j) => i === 0 || j === 0 || i === nw - 1 || j === nh - 1;
    const walkEnds = (P.links || []).map((Wk) => { const [px, py] = Wk.a === P ? Wk.pts[0] : Wk.pts[Wk.pts.length - 1]; return [px, py]; });
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      const x = ox + i, y = oy + j, Q = j * nw + i, gap = Math.abs(x - pad.x) <= 1 && y === pad.y || walkEnds.some(([wx, wy]) => Math.hypot(x + 0.5 - wx, y + 0.5 - wy) < 2.6);
      if (edge(i, j) && !gap) { kind[Q] = K_WALL; h[Q] = 7; continue; }
      if (Math.abs(x - pad.x) <= 1 && Math.abs(y - pad.y) <= 1) continue;
      if ((i + j) % 3 === 0 && r.chance(0.5)) { kind[Q] = K_PATH; continue; }
      const k = r.f();
      if (k < 0.2) decals.push({ type: 'crops', x, y, fam: 'dream' });
      else if (k < 0.3) props.push({ type: r.pick(['flowerbush', 'bush', 'fern', 'flowerbush']), x: x * TS + 8, y: y * TS + 14, fam: 'dream', v: r.int(0, 2), e: P.h });
      else if (k < 0.34 && i > 1 && j > 1) { props.push({ type: r.pick(['blossom', 'tree', 'birch']), x: x * TS + 8, y: y * TS + 14, fam: 'dream', v: r.int(0, 2), e: P.h }); solid[Q] = 1; }
      else if (k < 0.4) decals.push({ type: 'flowers', x, y, fam: 'dream' });
    }
    const big = nw * nh > 40, spot = (type, x, y) => { const Q = (y - oy) * nw + (x - ox); if (x <= ox || y <= oy || x >= ox + nw - 1 || y >= oy + nh - 1) return; props.push({ type, x: x * TS + 8, y: y * TS + 12, fam: type === 'watertower' ? 'rust' : 'dream', v: r.int(0, 2), e: P.h }); solid[Q] = 1; };
    spot('watertower', ox + 1, oy + 1); if (big) spot('greenhouse', ox + Math.floor(nw / 2), oy + 2); spot('laundry', ox + nw - 3, oy + Math.floor(nh / 2));
    props.push({ type: 'liftpad', x: pad.x * TS + 8, y: pad.y * TS + 12, fam: 'rust', v: 0, e: P.h, pad: P });
    lights.push({ x: pad.x * TS + 8, y: pad.y * TS + 12, h: P.h + 20, r: 22, c: [255, 190, 110], beacon: 1 });
    for (let k = 0; k < 3; k++) lights.push({ x: (ox + 1 + r.f() * (nw - 2)) * TS, y: (oy + 1 + r.f() * (nh - 2)) * TS, h: P.h + 18, r: 26, c: r.pick([[255, 214, 140], [255, 170, 200], [180, 220, 255]]) });
    return { P, L, n: nw, nw, nh, ox, oy, kind, e, h, solid, props, decals, lights, depth: new Float32Array(N), floaters: [], clouds: [] };
  }
  // the undercity: halls three tiles wide joining an 8 × 8 grid of crossings (a maze with loops), some
  // crossings opened into chambers (the night market, the boiler hall, the oil pits and their brass works)
  underGrid(P) {
    const G = 8, CW = 9, n = G * CW, N = n * n, ox = P.x - n / 2, oy = P.y - n / 2, r = RNG(P.seed), L = UNDER;
    const kind = new Uint8Array(N).fill(K_WALL), e = new Int16Array(N), h = new Float32Array(N).fill(64), solid = new Uint8Array(N), props = [], decals = [], lights = [];
    const open = (i, j, k = K_FLOOR) => { if (i < 1 || j < 1 || i >= n - 1 || j >= n - 1) return; const Q = j * n + i; kind[Q] = k; h[Q] = 0; };
    const seen = new Set(), stack = [[0, 0]], links = []; seen.add('0,0');
    while (stack.length) { const [ci, cj] = stack[stack.length - 1], nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [ci + a, cj + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < G && b < G && !seen.has(`${a},${b}`)); if (!nb.length) { stack.pop(); continue; } const nx = nb[Math.floor(r.f() * nb.length)]; seen.add(`${nx[0]},${nx[1]}`); links.push([ci, cj, nx[0], nx[1]]); stack.push(nx); }
    for (let k = 0; k < 14; k++) { const ci = r.int(0, G - 2), cj = r.int(0, G - 2); links.push(r.chance(0.5) ? [ci, cj, ci + 1, cj] : [ci, cj, ci, cj + 1]); }
    const mid = (c) => c * CW + 4;
    for (const [a, b, c, d] of links) { const x0 = Math.min(mid(a), mid(c)), x1 = Math.max(mid(a), mid(c)), y0 = Math.min(mid(b), mid(d)), y1 = Math.max(mid(b), mid(d)); for (let j = y0 - 1; j <= y1 + 1; j++) for (let i = x0 - 1; i <= x1 + 1; i++) open(i, j); }
    const rooms = new Map();
    for (let cj = 0; cj < G; cj++) for (let ci = 0; ci < G; ci++) { const g = P.gates.find((q) => q.cell[0] === ci && q.cell[1] === cj); if (!g && !r.chance(0.3)) continue; const kindR = g ? 'stair' : r.pick(['market', 'market', 'boiler', 'pit', 'works']); rooms.set(`${ci},${cj}`, kindR); for (let j = mid(cj) - 3; j <= mid(cj) + 3; j++) for (let i = mid(ci) - 3; i <= mid(ci) + 3; i++) open(i, j); }
    const put = (type, x, y, fam = L.fam, extra) => { props.push({ type, x: (ox + x) * TS + 8, y: (oy + y) * TS + 12, fam, v: r.int(0, 2), e: P.h, ...extra }); const D = PROPDEF[type]; if (D?.foot) { const fw = Math.max(1, Math.ceil(D.foot[0] / TS)), t0 = x - Math.floor((fw - 1) / 2); for (let i = t0; i < t0 + fw; i++) if (i >= 0 && i < n) solid[y * n + i] = 1; } };
    const light = (x, y, hh, rr, c) => lights.push({ x: (ox + x) * TS + 8, y: (oy + y) * TS + 10, h: P.h + hh, r: rr, c });
    for (const [key, kindR] of rooms) {
      const [ci, cj] = key.split(',').map(Number), cx = mid(ci), cy = mid(cj);
      if (kindR === 'stair') { const g = P.gates.find((q) => q.cell[0] === ci && q.cell[1] === cj); g.ex = ox + cx; g.ey = oy + cy + 1; put('stairs', cx, cy, 'rust', { gate: g }); light(cx, cy, 20, 40, [255, 236, 200]); }
      else if (kindR === 'market') { for (let k = 0; k < 5; k++) { const x = cx - 3 + r.int(0, 6), y = cy - 3 + r.int(0, 1) * 6; put('stall', x, y, 'rust'); light(x, y, 18, 26, r.pick([[255, 190, 110], [255, 140, 200], [140, 220, 255]])); } }
      else if (kindR === 'boiler') { put('boiler', cx, cy - 1, 'rust'); light(cx, cy - 1, 16, 44, [255, 140, 60]); put('pipes', cx - 3, cy + 2); put('pipes', cx + 3, cy + 2); }
      else if (kindR === 'pit') { for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 2; i <= cx + 2; i++) open(i, j, K_TOXIC); put('gear', cx - 3, cy - 2, 'rust'); put('gear', cx + 3, cy - 2, 'rust'); light(cx, cy, 6, 34, [255, 170, 80]); }
      else { put('gear', cx, cy - 2, 'rust'); put('tank', cx - 2, cy + 2); put('drum', cx + 2, cy + 2); light(cx, cy, 20, 30, [255, 200, 130]); }
    }
    // the halls: lamps on the walls, pipes, crates and drums along the way, rubbish and oil underfoot
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const Q = j * n + i; if (kind[Q] !== K_FLOOR || solid[Q]) continue; const nearRoom = [...rooms.keys()].some((k2) => { const [ci, cj] = k2.split(',').map(Number); return Math.abs(i - mid(ci)) <= 3 && Math.abs(j - mid(cj)) <= 3; }); if (nearRoom) { if (r.chance(0.06)) decals.push({ type: 'oil', x: ox + i, y: oy + j, fam: 'rust' }); continue; }
      const wallN = kind[Q - n] === K_WALL; if (wallN && (i + j * 3) % 7 === 0) { put('lamp', i, j, 'rust'); light(i, j, 26, 26, [255, 196, 120]); continue; }
      if (r.chance(0.025)) put(r.pick(['drum', 'scrap', 'pipes', 'drum']), i, j); if (r.chance(0.1)) decals.push({ type: r.pick(['crack', 'oil', 'rubble', 'stones']), x: ox + i, y: oy + j, fam: 'rust' });
    }
    return { P, L, n, nw: n, nh: n, ox, oy, kind, e, h, solid, props, decals, lights, depth: new Float32Array(N), floaters: [], clouds: [], rooms };
  }
  // walking off one place's ground onto a linked one (an island onto its bridge, a bridge onto the far roof)
  standLinked(px, py, from, P, mode) {
    const h = this.stand(px, py, from, P, mode); if (!Number.isNaN(h) || !P?.links) return [h, P];
    if (this.cell(px, py, P).k !== K_VOID) return [NaN, P];
    for (const Q of P.links) { const h2 = this.stand(px, py, from, Q, mode); if (!Number.isNaN(h2)) return [h2, Q]; }
    return [NaN, P];
  }
  // the ground under world px (x, y), on the ground or in place P: [top, kind, solid, floor under a bridge]
  cell(px, py, P, o = this._c || (this._c = { t: 0, k: 0, s: 0, lo: NOLO })) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) { o.t = P ? P.h : 0; o.k = K_VOID; o.s = 1; o.lo = NOLO; return o; }
    if (P) { const M = this.place(P), i = tx - M.ox, j = ty - M.oy; if (i < 0 || j < 0 || i >= M.nw || j >= M.nh) { o.t = P.h; o.k = K_VOID; o.s = 1; o.lo = NOLO; return o; } const Q = j * M.nw + i; o.t = M.e[Q] + M.h[Q]; o.k = M.kind[Q]; o.s = M.solid[Q]; o.lo = NOLO; return o; }
    if (tx < 0 || ty < 0 || tx >= WT || ty >= WT) { o.t = 0; o.k = K_CLIFF; o.s = 1; o.lo = NOLO; return o; }
    const C = this.chunk(Math.floor(tx / CS), Math.floor(ty / CS)), i = tx - C.cx * CS, j = ty - C.cy * CS, Q = (j + 1) * C.n + i + 1;
    o.t = C.e[Q] + C.h[Q]; o.k = C.k[Q]; o.s = C.solid[j * CS + i]; o.lo = C.lo[Q]; return o;
  }
  // can feet stand at (px, py) coming from height `from`? the height they stand at, or NaN
  stand(px, py, from, P, mode = 0) {
    const c = this.cell(px, py, P);
    if (c.s || c.k === K_VOID || c.k === K_TOXIC) return NaN;
    const wet = c.k === K_WATER; if (wet ? !(mode & (SWIM | WATERONLY)) : mode & WATERONLY) return NaN;
    let t = c.t; if (c.lo !== NOLO && Math.abs(c.lo - from) < Math.abs(t - from)) t = c.lo;
    return Math.abs(t - from) > STEP ? NaN : t;
  }
  // the ground height at px (for drawing things that do not walk: shadows, flowers, fliers' shadows)
  heightAt(px, py, P, from) { const c = this.cell(px, py, P); let t = c.t; if (from !== undefined && c.lo !== NOLO && Math.abs(c.lo - from) < Math.abs(t - from)) t = c.lo; return t; }
  isWater(px, py, P) { return this.cell(px, py, P).k === K_WATER; }
  biomeName(px, py) { return BIOMES[BIOME_KEYS[this.biomeAt(Math.floor(px / TS), Math.floor(py / TS))]].name; }
}
