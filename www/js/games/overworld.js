// Monster Battle overworld: one seeded region per post — meadows, tall-grass zones, a lake with a shore,
// forest, flowers, dirt paths and bridges, and a village with a spirit shrine (healing), houses, lanterns
// and a torii gate. The ground is painted once, pixel by pixel, into one canvas in a biome drawn from the
// theme palette (summer, autumn, winter, spring blossom, neon night or ink wash); trees and buildings are
// objects drawn row by row with the actors so they overlap properly.
import { noiseMap, rgbOf } from './engine.js';
import { mulberry32 } from '../util.js';

export const TS = 24, N = 40;
export const GR = 0, TALL = 1, PATH = 2, WATER = 3, TREE = 4, FLOWER = 5, SAND = 6, BRIDGE = 7, BUILD = 8, FENCE = 9, ROCK = 10, DOOR = 11;
const OPEN = [1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1];
export const open = (t) => !!OPEN[t];
export const D4 = [[0, 1], [-1, 0], [0, -1], [1, 0]];
const hsl = (h, s, l) => { h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sh = (c, k) => (k < 0 ? mix(c, [12, 8, 24], -k) : mix(c, [255, 250, 230], k));
export const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const hh = (x, y, s = 0) => { let h = Math.imul(x * 374761393 + y * 668265263 + s * 2246822519, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.pixel = true; return c; };

const SEASON = { ice: 'winter', sunset: 'autumn', rust: 'autumn', candy: 'spring', pastel: 'spring', neon: 'night', ink: 'ink' };
const BIOMES = {
  summer: { grass: [96, 46, 47], tall: [122, 50, 30], leaf: [128, 40, 33], trunk: [25, 38, 27], water: [204, 60, 50], sand: [44, 50, 73], path: [34, 32, 60], wall: [38, 34, 80] },
  autumn: { grass: [64, 34, 46], tall: [40, 48, 36], leaf: [20, 74, 48], trunk: [20, 34, 24], water: [198, 40, 42], sand: [38, 40, 68], path: [28, 34, 52], wall: [32, 30, 76] },
  winter: { grass: [205, 24, 90], tall: [188, 22, 56], leaf: [168, 30, 26], trunk: [20, 24, 24], water: [204, 48, 60], sand: [205, 14, 80], path: [212, 16, 73], wall: [30, 20, 82] },
  spring: { grass: [102, 44, 56], tall: [124, 42, 38], leaf: [338, 64, 80], trunk: [350, 22, 30], water: [192, 56, 56], sand: [40, 50, 78], path: [30, 38, 66], wall: [36, 40, 86] },
  night: { grass: [222, 30, 22], tall: [196, 42, 15], leaf: [252, 28, 22], trunk: [260, 20, 14], water: [232, 50, 25], sand: [240, 14, 32], path: [244, 15, 34], wall: [230, 14, 40] },
  ink: { grass: [42, 14, 86], tall: [40, 5, 42], leaf: [0, 0, 26], trunk: [0, 0, 16], water: [200, 8, 70], sand: [40, 12, 80], path: [36, 10, 73], wall: [40, 10, 90] }
};
export function biome(pal) {
  const season = SEASON[pal.scheme] || 'summer', dh = season === 'ink' ? 0 : ((((pal.hue - 100) % 360) + 540) % 360 - 180) * 0.12;
  const B = { season, acc: pal.c.map(rgbOf) };
  for (const [k, v] of Object.entries(BIOMES[season])) B[k] = hsl(v[0] + (k === 'leaf' && season === 'spring' ? 0 : dh), v[1], v[2]);
  B.roofs = season === 'ink' ? [B.acc[0], [40, 40, 44], [70, 66, 60]] : B.acc.slice(0, 4).map((c) => mix(c, [40, 30, 40], 0.25));
  return B;
}
const PRE = ['Moss', 'Fern', 'Cedar', 'Willow', 'Mist', 'Lantern', 'Ember', 'Amber', 'Moon', 'Cherry', 'Pine', 'Kettle', 'Acorn', 'Firefly', 'Cloud', 'Reed'];
const SUF = ['hollow', 'vale', 'brook', 'ridge', 'field', 'wood', 'shore', 'glen', 'moor', 'dell'];

export class Region {
  constructor(seed, pal) {
    const R = mulberry32((seed ^ 0x3c6ef372) >>> 0); this.R = R;
    this.B = biome(pal); this.seed = seed;
    this.name = PRE[Math.floor(R() * PRE.length)] + SUF[Math.floor(R() * SUF.length)];
    this.route = 1 + Math.floor(R() * 29);
    const m = this.map = new Uint8Array(N * N), e = noiseMap(R, N, 3, 3), f = noiseMap(R, N, 3, 3), g = noiseMap(R, N, 3, 4), lake = R() < 0.8;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, edge = Math.min(x, y, N - 1 - x, N - 1 - y) + (f[i] - 0.5) * 3;
      m[i] = edge < 1.6 ? TREE : lake && e[i] < 0.33 ? WATER : f[i] > 0.62 ? TREE : g[i] > 0.55 ? TALL : R() < 0.035 ? FLOWER : R() < 0.012 ? ROCK : GR;
    }
    this.buildTown(R);
    // paths from the town's exits out to the biggest tall-grass patches and the far corners
    let zones = this.zonesOf();
    const goals = zones.slice(0, 4).map((z) => z.mid);
    goals.push([N - 5 - (this.town.x > N / 2 ? N - 10 : 0), N - 5 - (this.town.y > N / 2 ? N - 10 : 0)]);
    this.town.exits.forEach((ex, k) => this.carve(ex, goals[k % goals.length]));
    for (let k = 3; k < goals.length; k++) this.carve(this.town.exits[k % 3], goals[k]);
    // connect every tall-grass patch to the paths, then fix up the shores
    let reach = this.flood(this.town.door);
    for (const z of this.zonesOf()) if (!z.tiles.some((i) => reach[i] >= 0)) { this.carveTo(z.mid, reach); reach = this.flood(this.town.door); }
    for (let i = 0; i < N * N; i++) {
      if (m[i] === WATER || m[i] === BRIDGE) continue;
      const x = i % N, y = (i / N) | 0, wet = D4.some(([a, b]) => m[(y + b) * N + x + a] === WATER);
      if (wet && (m[i] === GR || m[i] === FLOWER || (m[i] === TALL && R() < 0.5))) m[i] = SAND;
    }
    this.reach = this.flood(this.town.door);
    zones = this.zonesOf().filter((z) => z.tiles.some((i) => this.reach[i] >= 0));
    zones.forEach((z, k) => { z.id = k; z.dist = Math.min(...z.tiles.map((i) => this.reach[i]).filter((d) => d >= 0)); for (const i of z.tiles) this.zoneAt[i] = k; });
    this.zones = zones;
    this.placeTrainers(R);
    this.paint();
  }
  at(x, y) { return x < 0 || y < 0 || x >= N || y >= N ? TREE : this.map[y * N + x]; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < N && y < N) this.map[y * N + x] = t; }
  buildTown(R) {
    // a 12×10 clearing away from the lake: shrine, two houses, garden, fence, a torii on the south road
    let best = null;
    for (let k = 0; k < 40; k++) {
      const x = 3 + Math.floor(R() * (N - 18)), y = 3 + Math.floor(R() * (N - 16));
      let s = -Math.hypot(x + 6 - N / 2, y + 5 - N / 2) * 0.6;
      for (let yy = 0; yy < 10; yy++) for (let xx = 0; xx < 12; xx++) s -= this.at(x + xx, y + yy) === WATER ? 4 : 0;
      if (!best || s > best.s) best = { x, y, s };
    }
    const { x: X, y: Y } = best, T = this.town = { x: X, y: Y, w: 12, h: 10 };
    for (let yy = -1; yy <= 10; yy++) for (let xx = -1; xx <= 12; xx++) this.set(X + xx, Y + yy, yy < 0 || xx < 0 || yy > 9 || xx > 11 ? (this.at(X + xx, Y + yy) === WATER ? GR : this.at(X + xx, Y + yy) === TREE ? TREE : GR) : GR);
    const fill = (x0, y0, w, h, t) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.set(X + x0 + xx, Y + y0 + yy, t); };
    fill(0, 4, 12, 1, PATH); fill(5, 4, 1, 6, PATH);
    fill(1, 1, 3, 2, BUILD); this.set(X + 2, Y + 2, DOOR); this.set(X + 2, Y + 3, PATH); this.set(X + 1, Y + 3, BUILD); this.set(X + 3, Y + 3, BUILD);
    fill(7, 2, 3, 2, BUILD); fill(8, 4, 1, 1, PATH);
    fill(8, 6, 3, 2, BUILD); fill(9, 8, 1, 1, PATH); fill(6, 8, 3, 1, PATH);
    fill(1, 6, 3, 3, FLOWER); fill(2, 7, 1, 1, ROCK);
    for (let xx = 0; xx < 12; xx++) if (xx !== 5) this.set(X + xx, Y, FENCE);
    for (let yy = 0; yy < 10; yy++) if (yy !== 4) { this.set(X, Y + yy, FENCE); this.set(X + 11, Y + yy, FENCE); }
    this.set(X + 4, Y + 9, BUILD); this.set(X + 6, Y + 9, BUILD); fill(5, 0, 1, 4, PATH);
    T.door = [X + 2, Y + 2]; T.step = [X + 2, Y + 3];
    T.exits = [[X - 1, Y + 4], [X + 12, Y + 4], [X + 5, Y + 10], [X + 5, Y - 1]];
    T.objs = [{ k: 'shrine', x: X + 1, y: Y + 2, w: 3 }, { k: 'house', x: X + 7, y: Y + 3, w: 3, roof: 0 }, { k: 'house', x: X + 8, y: Y + 7, w: 3, roof: 1 },
      { k: 'torii', x: X + 4, y: Y + 9, w: 3 }, { k: 'lantern', x: X + 1, y: Y + 3, w: 1 }, { k: 'lantern', x: X + 3, y: Y + 3, w: 1 }];
    T.lights = [[X + 1.5, Y + 3.1], [X + 3.5, Y + 3.1], [X + 7.6, Y + 3.2], [X + 9.4, Y + 3.2], [X + 8.6, Y + 7.2], [X + 10.4, Y + 7.2], [X + 2.5, Y + 2.3]];
    T.free = [];
    for (let yy = 1; yy < 9; yy++) for (let xx = 1; xx < 11; xx++) if (open(this.at(X + xx, Y + yy)) && this.at(X + xx, Y + yy) !== DOOR) T.free.push([X + xx, Y + yy]);
  }
  // Dijkstra over tile costs, carving a path (bridges over water)
  carve(a, b) { const p = this.route_(a, (x, y) => x === b[0] && y === b[1]); if (p) for (const [x, y] of p) this.lay(x, y); }
  carveTo(a, reach) { const p = this.route_(a, (x, y) => reach[y * N + x] >= 0); if (p) for (const [x, y] of p) this.lay(x, y); }
  lay(x, y) { const t = this.at(x, y); if (t === WATER) this.set(x, y, BRIDGE); else if (t !== BUILD && t !== DOOR && t !== FENCE && t !== BRIDGE) this.set(x, y, t === TALL && hh(x, y, 5) < 0.35 ? TALL : PATH); }
  route_(a, done) {
    const cost = [1.4, 2.6, 1, 9, 5, 1.4, 1.2, 1, 1e9, 1e9, 6, 1e9], dist = new Float64Array(N * N).fill(1e9), prev = new Int32Array(N * N).fill(-1);
    if (a[0] < 0 || a[1] < 0 || a[0] >= N || a[1] >= N) return null;
    const q = [], push = (d, i) => { q.push([d, i]); let k = q.length - 1; while (k) { const p = (k - 1) >> 1; if (q[p][0] <= q[k][0]) break; [q[p], q[k]] = [q[k], q[p]]; k = p; } };
    const pop = () => { const top = q[0], last = q.pop(); if (q.length) { q[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < q.length && q[l][0] < q[m][0]) m = l; if (r < q.length && q[r][0] < q[m][0]) m = r; if (m === k) break; [q[m], q[k]] = [q[k], q[m]]; k = m; } } return top; };
    push(0, a[1] * N + a[0]); dist[a[1] * N + a[0]] = 0;
    while (q.length) {
      const [d, i] = pop(); if (d > dist[i]) continue;
      const x = i % N, y = (i / N) | 0;
      if (done(x, y)) { const out = []; for (let j = i; j >= 0; j = prev[j]) out.push([j % N, (j / N) | 0]); return out; }
      for (const [dx, dy] of D4) {
        const X = x + dx, Y = y + dy; if (X < 1 || Y < 1 || X > N - 2 || Y > N - 2) continue;
        const j = Y * N + X, nd = d + cost[this.map[j]] + hh(X, Y, 9) * 0.8;
        if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); }
      }
    }
    return null;
  }
  flood(s, blocked) {
    const d = new Int32Array(N * N).fill(-1), q = [s[1] * N + s[0]]; d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % N, y = (i / N) | 0; for (const [a, b] of D4) { const X = x + a, Y = y + b, j = Y * N + X; if (X >= 0 && Y >= 0 && X < N && Y < N && d[j] < 0 && open(this.map[j]) && !blocked?.has(j)) { d[j] = d[i] + 1; q.push(j); } } }
    return d;
  }
  zonesOf() {
    const seen = new Uint8Array(N * N), out = []; this.zoneAt = new Int16Array(N * N).fill(-1);
    for (let i = 0; i < N * N; i++) {
      if (seen[i] || this.map[i] !== TALL) continue;
      const q = [i]; seen[i] = 1;
      for (let h = 0; h < q.length; h++) { const j = q[h], x = j % N, y = (j / N) | 0; for (const [a, b] of D4) { const k = (y + b) * N + x + a; if (!seen[k] && this.map[k] === TALL) { seen[k] = 1; q.push(k); } } }
      if (q.length < 5) continue;
      const mx = q.reduce((s, j) => s + (j % N), 0) / q.length, my = q.reduce((s, j) => s + ((j / N) | 0), 0) / q.length;
      const mid = q.reduce((b, j) => (Math.hypot((j % N) - mx, ((j / N) | 0) - my) < Math.hypot((b % N) - mx, ((b / N) | 0) - my) ? j : b), q[0]);
      out.push({ tiles: q, mid: [mid % N, (mid / N) | 0] });
    }
    return out.sort((a, b) => b.tiles.length - a.tiles.length);
  }
  // trainers stand beside paths, looking across them
  placeTrainers(R) {
    const T = this.town, cand = [];
    for (let i = 0; i < N * N; i++) {
      if (this.map[i] !== PATH || this.reach[i] < 7) continue;
      const x = i % N, y = (i / N) | 0;
      if (x >= T.x - 1 && x <= T.x + 12 && y >= T.y - 1 && y <= T.y + 10) continue;
      for (const [a, b] of D4) { const t = this.at(x + a, y + b); if (t === GR || t === FLOWER || t === SAND) cand.push({ x: x + a, y: y + b, face: [-a, -b], d: this.reach[i] }); }
    }
    this.trainers = [];
    for (let k = 0; k < 40 && this.trainers.length < 4 && cand.length; k++) {
      const c = cand[Math.floor(R() * cand.length)];
      if (this.trainers.some((t) => Math.abs(t.x - c.x) + Math.abs(t.y - c.y) < 9)) continue;
      const blocked = new Set([...this.trainers, c].map((t) => t.y * N + t.x)), f = this.flood(T.door, blocked);
      if (this.zones.some((z) => !z.tiles.some((i) => f[i] >= 0))) continue;
      this.trainers.push(c);
    }
    this.trainers.sort((a, b) => a.d - b.d);
  }
  // ------------------------------------------------------------ painting
  paint() {
    const B = this.B, W = N * TS, img = new ImageData(W, W), D = img.data, m = this.map, wint = B.season === 'winter';
    const put = (x, y, c, a = 1) => { if (x < 0 || y < 0 || x >= W || y >= W) return; const o = (y * W + x) * 4; if (a >= 1) { D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; } else { D[o] += (c[0] - D[o]) * a; D[o + 1] += (c[1] - D[o + 1]) * a; D[o + 2] += (c[2] - D[o + 2]) * a; } D[o + 3] = 255; };
    const deep = new Uint8Array(N * N); // water tiles two away from land
    for (let i = 0; i < N * N; i++) if (m[i] === WATER) { const x = i % N, y = (i / N) | 0; deep[i] = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(([a, b]) => this.at(x + a, y + b) === WATER) ? 1 : 0; }
    const isP = (t) => t === PATH || t === BRIDGE || t === DOOR;
    const ramp = (c) => Array.from({ length: 29 }, (_, i) => sh(c, i / 20 - 0.6)), RG = ramp(B.grass), RT = ramp(B.tall), RW = ramp(B.water), RP = ramp(B.path), RS = ramp(B.sand);
    const tone = (Rm, k) => Rm[Math.max(0, Math.min(28, Math.round((k + 0.6) * 20)))];
    const wr = (o, c) => { D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255; };
    const grass = (px, py, forest) => { const v = hh(px >> 1, py >> 1, 1), lo = Math.sin(px * 0.045 + Math.sin(py * 0.03) * 2) * Math.cos(py * 0.05) * 0.06; return tone(RG, lo - (forest ? 0.22 : 0) + (v < 0.06 ? -0.12 : v > 0.97 ? 0.12 : 0)); };
    const BH = [4, 7, 10, 12, 10, 7, 5, 9], PLANK = [[70, 44, 28], [96, 62, 38]], WOOD = ramp([150, 104, 64]);
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
      const t = m[ty * N + tx], nb = [this.at(tx - 1, ty), this.at(tx + 1, ty), this.at(tx, ty - 1), this.at(tx, ty + 1)], forest = t === TREE;
      const land = nb.map((n) => n !== WATER && n !== BRIDGE), pathEdge = nb.map((n) => (t === SAND ? !(n === SAND || n === WATER || isP(n)) : !(isP(n) || n === SAND))), wet = nb.map((n) => n === WATER);
      const vert = t === BRIDGE && (nb[2] === BRIDGE || nb[3] === BRIDGE || (open(nb[2]) && !open(nb[0])));
      for (let ly = 0; ly < TS; ly++) for (let lx = 0; lx < TS; lx++) {
        const px = tx * TS + lx, py = ty * TS + ly, o = (py * W + px) * 4, ds = [lx, TS - 1 - lx, ly, TS - 1 - ly];
        if (t === TALL) {
          const by = ly % 12, col = (lx + (ly < 12 ? 0 : 4) + tx * 3) % 8, hb = BH[col], hn = BH[(col + 1) % 8], up = 11 - by;
          wr(o, up < hb ? tone(RT, up === hb - 1 ? (wint ? 0.5 : 0.28) : hn < hb && up >= hn ? -0.08 : by > 9 ? -0.1 : 0) : tone(RT, -0.18));
        } else if (t === WATER) {
          let k = deep[ty * N + tx] ? -0.12 : 0;
          for (let q = 0; q < 4; q++) if (ds[q] < 3 && land[q]) { k = bay(px, py) < 0.7 ? (wint ? 0.75 : 0.55) : 0.25; break; }
          if (k <= 0 && hh(px >> 2, py, 3) < 0.03) k += 0.18;
          wr(o, tone(RW, k));
        } else if (t === BRIDGE) {
          const a2 = vert ? lx : ly, b2 = vert ? ly : lx;
          wr(o, a2 < 2 || a2 > 21 ? PLANK[0] : b2 % 6 === 0 ? PLANK[1] : tone(WOOD, hh(tx, (b2 / 6) | 0, 8) * 0.2 - 0.1));
        } else if (isP(t) || t === SAND) {
          const Rm = t === SAND ? RS : RP, h1 = hh(px, py, 4);
          let c = tone(Rm, h1 < 0.06 ? -0.14 : hh(px, py, 6) > 0.975 ? 0.2 : 0);
          for (let q = 0; q < 4; q++) if (ds[q] < 3 && pathEdge[q] && bay(px, py) > ds[q] / 3.2) { c = grass(px, py, false); break; }
          if (t === SAND) for (let q = 0; q < 4; q++) if (ds[q] < 4 && wet[q]) c = tone(RS, -0.18 * (1 - ds[q] / 4));
          wr(o, c);
        } else wr(o, grass(px, py, forest));
      }
    }
    // stamps: grass tufts, flowers, rocks, fences
    const R = mulberry32(this.seed ^ 0x77);
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
      const t = m[ty * N + tx], X = tx * TS, Y = ty * TS;
      if (t === GR || t === FLOWER) for (let k = 0; k < 2; k++) if (R() < 0.7) { const x = X + 3 + Math.floor(R() * 18), y = Y + 4 + Math.floor(R() * 17), d = sh(B.grass, -0.2), l = sh(B.grass, 0.18); put(x - 1, y - 1, d); put(x, y, d); put(x + 1, y - 1, d); put(x + 1, y - 2, l); put(x - 1, y - 2, l); }
      if (t === FLOWER) for (let k = 0; k < 3; k++) {
        const x = X + 4 + Math.floor(R() * 16), y = Y + 4 + Math.floor(R() * 15), c = B.acc[Math.floor(R() * B.acc.length)], ctr = wint ? [255, 255, 255] : [255, 230, 120];
        put(x, y + 2, sh(B.grass, -0.3)); put(x, y + 3, sh(B.grass, -0.3)); for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(x + a, y + b, c); put(x, y, ctr); put(x - 1, y + 1, sh(c, -0.3), 0.6); put(x + 1, y + 1, sh(c, -0.3), 0.6);
      }
      if (t === ROCK) for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) { const dx = (x - 10) / 9.5, dy = (y - 9) / 7.5, d = dx * dx + dy * dy; if (d > 1) continue; const L = 1 - Math.hypot(dx + 0.45, dy + 0.55) / 1.6; const base = B.season === 'night' ? [80, 84, 110] : [140, 134, 126]; put(X + 2 + x, Y + 5 + y, d > 0.8 ? sh(base, -0.6) : sh(base, (L + bay(x, y) * 0.3 - 0.45) * 0.8)); if (wint && dy < -0.4 && d < 0.8) put(X + 2 + x, Y + 5 + y, [240, 246, 255]); }
      if (t === FENCE) {
        const wood = B.season === 'ink' ? [60, 56, 52] : [150, 104, 64], dark = sh(wood, -0.5), L = open(this.at(tx - 1, ty)) || this.at(tx - 1, ty) !== FENCE, Rr = this.at(tx + 1, ty) !== FENCE, vertical = this.at(tx, ty - 1) === FENCE || this.at(tx, ty + 1) === FENCE;
        if (vertical && L && Rr) { for (let y = 0; y < TS; y++) for (let x = 10; x < 14; x++) put(X + x, Y + y, x === 10 ? sh(wood, 0.2) : y % 12 === 0 ? dark : wood); }
        else { for (let x = 0; x < TS; x++) { put(X + x, Y + 9, sh(wood, 0.15)); put(X + x, Y + 10, wood); put(X + x, Y + 11, dark); put(X + x, Y + 15, wood); put(X + x, Y + 16, dark); } for (const px0 of [2, 14]) for (let y = 5; y < 21; y++) for (let x = 0; x < 4; x++) put(X + px0 + x, Y + y, y === 5 ? sh(wood, 0.3) : x === 3 || y === 20 ? dark : wood); }
      }
    }
    this.ground = cv(W, W); this.ground.getContext('2d').putImageData(img, 0, 0);
    // object sprites
    this.trees = [0, 1, 2].map((k) => treeSprite(B, k));
    const rows = this.rows = Array.from({ length: N }, () => []);
    for (let i = 0; i < N * N; i++) if (m[i] === TREE) rows[(i / N) | 0].push({ k: 'tree', x: i % N, s: this.trees[Math.floor(hh(i, 7, 2) * 3)], o: Math.floor(hh(i, 3, 1) * 5) - 2 });
    for (const o of this.town.objs) rows[o.y].push({ ...o, s: o.k === 'shrine' ? shrineSprite(B) : o.k === 'house' ? houseSprite(B, B.roofs[o.roof % B.roofs.length], o.roof) : o.k === 'torii' ? toriiSprite(B) : lanternSprite(B) });
    for (const r of rows) r.sort((a, b) => a.x - b.x);
  }
  // draw the ground under the camera, with shimmer on the water
  drawGround(c, cx, cy, t, w, h) {
    c.drawImage(this.ground, Math.round(cx), Math.round(cy), w, h, 0, 0, w, h);
    const x0 = Math.max(0, Math.floor(cx / TS)), y0 = Math.max(0, Math.floor(cy / TS)), x1 = Math.min(N - 1, Math.floor((cx + w) / TS)), y1 = Math.min(N - 1, Math.floor((cy + h) / TS));
    c.fillStyle = css(sh(this.B.water, 0.45), 0.8);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.map[y * N + x] === WATER) {
      const ph = (t * 0.7 + hh(x, y, 11) * 4) % 4; if (ph > 2) continue;
      const sx = Math.round(x * TS - cx + 4 + hh(x, y, 12) * 10 + ph * 2), sy = Math.round(y * TS - cy + 6 + hh(x, y, 13) * 12);
      c.fillRect(sx, sy, 5 - Math.abs(ph - 1) * 3 | 0, 1); c.fillRect(sx + 3, sy + 6, 3, 1);
    }
  }
  drawObj(c, o, cx, cy, y) {
    const s = o.s, bx = o.x * TS + (o.w || 1) * TS / 2 + (o.o || 0) - cx, by = (y + 1) * TS - cy;
    c.drawImage(s, Math.round(bx - s.width / 2), Math.round(by - s.height + (s.foot || 0)));
  }
}

// ---------------------------------------------------------------- sprites
function sprite(w, h, fn) { const c = cv(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), D = img.data; const put = (px, py, col, a = 255) => { if (px < 0 || py < 0 || px >= w || py >= h) return; const o = (py * w + px) * 4; D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = a; }; fn(put, (px, py) => D[(py * w + px) * 4 + 3] > 0); x.putImageData(img, 0, 0); return c; }
function outlineIt(c, col) { const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), o = new Uint8ClampedArray(d.data); for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const i = (y * w + xx) * 4; if (d.data[i + 3]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = xx + a, Y = y + b; return X >= 0 && Y >= 0 && X < w && Y < h && d.data[(Y * w + X) * 4 + 3] > 0; })) { o[i] = col[0]; o[i + 1] = col[1]; o[i + 2] = col[2]; o[i + 3] = 255; } } x.putImageData(new ImageData(o, w, h), 0, 0); return c; }
function treeSprite(B, k) {
  const pine = B.season === 'winter', leaf = B.season === 'autumn' && k === 1 ? sh(hsl(4, 62, 44), 0) : B.leaf, ink = B.season === 'ink';
  const tones = [sh(leaf, -0.42), sh(leaf, -0.2), leaf, sh(leaf, 0.22), sh(leaf, 0.42)];
  const c = sprite(32, 44, (put, has) => {
    const trunk = B.trunk;
    for (let y = 30; y < 42; y++) for (let x = 13; x < 19; x++) put(x, y, x === 13 ? sh(trunk, 0.25) : x > 16 ? sh(trunk, -0.3) : trunk);
    if (pine) {
      for (let tier = 0; tier < 3; tier++) { const top = 2 + tier * 9, hgt = 14; for (let y = 0; y < hgt; y++) { const hw = 3 + y * (0.62 + tier * 0.1); for (let x = Math.round(16 - hw); x <= Math.round(16 + hw); x++) { const L = (16 - x) / hw * 0.5 - y / hgt * 0.4 + 0.25 + bay(x, y + top) * 0.35; const snow = y < 3 + (x % 3 === 0 ? 1 : 0) || (y === hgt - 1 && hh(x, tier) < 0.5); put(x, top + y, snow ? [236, 244, 255] : tones[Math.max(0, Math.min(4, Math.floor(L * 4)))]); } } }
      return;
    }
    const blobs = [[16, 17, 12.5], [8, 20, 7.5], [24, 20, 7.5], [16, 8, 8], [10 + k * 3, 12, 6.5], [22 - k * 2, 11, 6.5]];
    for (let y = 0; y < 34; y++) for (let x = 0; x < 32; x++) {
      if (!blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 < r * r)) continue;
      const L = 1 - Math.hypot(x - 11, y - 7) / 26 - (y > 24 ? 0.15 : 0);
      let c2 = tones[Math.max(0, Math.min(4, Math.floor(L * 4.2 + bay(x, y) * 0.9 - 0.4)))];
      if (B.season === 'spring' && hh(x, y, k) < 0.05) c2 = [255, 246, 250];
      if (B.season === 'autumn' && hh(x, y, k + 3) < 0.04) c2 = sh(hsl(42, 80, 55), 0);
      if (ink && hh(x, y, 2) < 0.25) c2 = sh(c2, 0.3);
      put(x, y, c2);
    }
  });
  outlineIt(c, ink ? [10, 10, 10] : sh(leaf, -0.7)); c.foot = 2;
  return c;
}
function block(put, x0, y0, w, h, col, lit = 0) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x0 + x, y0 + y, lit && y === 0 ? sh(col, 0.25) : col); }
function houseSprite(B, roof, k) {
  const wall = B.wall, ink = B.season === 'ink', night = B.season === 'night';
  const c = sprite(78, 76, (put) => {
    block(put, 6, 34, 66, 40, wall);
    for (let y = 40; y < 74; y += 6) block(put, 6, y, 66, 1, sh(wall, -0.12));
    block(put, 6, 72, 66, 2, sh(wall, -0.4));
    for (const wx of [12, 52]) { block(put, wx, 44, 14, 12, sh(wall, -0.5)); block(put, wx + 1, 45, 12, 10, night ? [255, 214, 120] : [150, 196, 230]); block(put, wx + 1, 45, 5, 4, night ? [255, 240, 190] : [220, 240, 255]); block(put, wx + 6, 45, 1, 10, sh(wall, -0.5)); }
    block(put, 32, 50, 14, 24, sh([120, 76, 46], ink ? -0.5 : 0)); block(put, 33, 51, 12, 22, sh([150, 98, 58], ink ? -0.5 : 0)); put(43, 62, [250, 220, 120]);
    for (let y = 0; y < 34; y++) { const hw = 22 + y * 0.52; for (let x = Math.round(39 - hw); x <= Math.round(39 + hw); x++) { const band = (y + (k ? 0 : 2)) % 5 === 0, L = (y < 3 ? 0.25 : 0) + (band ? -0.2 : 0) + ((x + y) % 7 === 0 ? 0.06 : 0) + (y > 30 ? -0.3 : 0); put(x, 4 + y, sh(roof, L)); } }
    block(put, 54, 0, 7, 12, sh(wall, -0.3)); block(put, 53, 0, 9, 2, sh(wall, -0.5));
  });
  outlineIt(c, ink ? [12, 12, 12] : sh(roof, -0.75)); c.foot = 2;
  return c;
}
function shrineSprite(B) {
  const red = B.season === 'ink' ? [200, 40, 36] : [206, 58, 44], roof = B.season === 'ink' ? [36, 36, 40] : sh(B.roofs[2] || [60, 70, 90], -0.35), gold = [240, 196, 80], paper = [244, 236, 214];
  const c = sprite(88, 86, (put) => {
    block(put, 4, 80, 80, 6, [150, 146, 140], 1);
    block(put, 12, 46, 64, 34, sh([92, 54, 36], -0.1));
    for (const px0 of [16, 34, 48]) { block(put, px0, 50, 10 + (px0 === 34 ? 6 : 0), 26, px0 === 34 ? [30, 20, 18] : paper); if (px0 !== 34) for (let y = 50; y < 76; y += 6) block(put, px0, y, 10, 1, sh(paper, -0.2)); }
    for (const px0 of [10, 74]) block(put, px0, 40, 5, 40, red, 0);
    for (let y = 0; y < 26; y++) { const hw = 28 + y * 0.6 + (y > 21 ? (y - 21) * 1.5 : 0); for (let x = Math.round(44 - hw); x <= Math.round(44 + hw); x++) { const end = Math.abs(x - 44) > hw - 4 && y > 18; put(x, 18 + y - (end ? 3 : 0), sh(roof, y < 2 ? 0.3 : y % 4 === 0 ? -0.18 : y > 22 ? -0.35 : 0)); } }
    for (let y = 0; y < 12; y++) { const hw = 12 + y * 0.8; for (let x = Math.round(44 - hw); x <= Math.round(44 + hw); x++) put(x, 6 + y, sh(roof, y < 2 ? 0.3 : y % 4 === 0 ? -0.18 : 0)); }
    block(put, 30, 4, 28, 2, gold);
    for (let x = 14; x < 74; x++) { const yy = 44 + Math.round(Math.sin((x - 14) / 60 * Math.PI) * 3); put(x, yy, [210, 180, 120]); put(x, yy + 1, [170, 140, 90]); }
    for (const sx of [22, 36, 52, 66]) for (let y = 0; y < 8; y++) put(sx + (y % 4 < 2 ? 0 : 1), 47 + y, [255, 255, 255]);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x - 4) ** 2 + (y - 4) ** 2 < 18) put(40 + x, 22 + y, (x - 4) ** 2 + (y - 4) ** 2 < 6 ? [255, 250, 220] : gold);
  });
  outlineIt(c, [24, 16, 20]); c.foot = 2;
  return c;
}
function toriiSprite(B) {
  const red = B.season === 'ink' ? [190, 36, 34] : [214, 60, 40], blk = [30, 24, 28];
  const c = sprite(80, 70, (put) => {
    for (const px0 of [12, 64]) block(put, px0, 14, 5, 56, red);
    for (const px0 of [12, 64]) block(put, px0 - 1, 64, 7, 6, blk);
    block(put, 4, 22, 72, 4, red); block(put, 38, 14, 4, 8, red);
    for (let x = 0; x < 80; x++) { const lift = Math.round(((x - 40) / 40) ** 4 * 4); block(put, x, 6 - lift, 1, 3, blk); block(put, x, 9 - lift, 1, 3, red); }
  });
  outlineIt(c, [24, 14, 16]); c.foot = 0;
  return c;
}
function lanternSprite(B) {
  const st = B.season === 'night' ? [110, 112, 130] : [168, 162, 150];
  const c = sprite(16, 34, (put) => {
    block(put, 2, 30, 12, 4, sh(st, -0.2)); block(put, 6, 18, 4, 12, st); block(put, 3, 10, 10, 8, st);
    block(put, 5, 12, 6, 4, [255, 210, 110]); block(put, 1, 6, 14, 4, sh(st, -0.1), 1); block(put, 6, 2, 4, 4, st);
  });
  outlineIt(c, [30, 28, 30]); c.foot = 2;
  return c;
}
