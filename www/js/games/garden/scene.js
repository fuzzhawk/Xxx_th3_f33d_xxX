// What the GPU holds for the garden, made as it is needed: ground textures per biome and family,
// prop and creature sprites, the block atlas (cliff and canyon faces, waterfalls, walls, bark, city
// facades and roofs), and per chunk a baked ground (in three levels of detail by distance) laid over the
// terrain's heights, its faces where the ground steps down, its blocks and its props. Painting runs from
// a queue with a time budget a frame, so walking into new country never stalls.
import { mk, cx2d, bay, qIdx, clamp, fbm, hash2 } from '../mk/tex.js';
import { renderer, texNew, texSet, texFree, Batch, newBuffer, freeBuffer, atlasGen } from '../mk/gl.js';
import { BIOMES, BIOME_KEYS, FAMILY, ISLES, CAVES, ROOFTOP, UNDER, WALKWAY } from './lands.js';
import { groundTex, facadeTex, paintProp, paintDecal, animalFrames, giantFrames, paintCloud, PROPDEF } from './art.js';
import { TS, CS, NOLO, K_GROUND, K_PATH, K_FLOOR, K_WATER, K_CLIFF, K_WALL, K_BRIDGE, K_TOXIC, K_BLDG, K_STREET, K_TRUNK, K_VOID } from './world.js';

// ------------------------------------------------ the paint queue
const jobs = [], queued = new Set(), done = new Map();
export function want(key, make) { const j = done.get(key); if (j) return j.out; if (!queued.has(key)) { queued.add(key); jobs.push({ key, make }); } return null; }
export function pump(ms) { const t0 = performance.now(); while (jobs.length && performance.now() - t0 < ms) { const j = jobs.shift(); queued.delete(j.key); try { j.out = j.make(); } catch (e) { console.warn('garden paint', j.key, e); j.out = null; } done.set(j.key, j); } return jobs.length; }
export const pending = () => jobs.length;

const FAMS = ['green', 'rust', 'desert', 'ash', 'frost', 'dream', 'cave'], FTEX = ['cliffTop', 'cliffFace', 'wallTop', 'wallFace', 'water', 'bark', 'leaf', 'bridge'];
const spec = (fam, k) => { const F = FAMILY[fam]; if (F.tex[k]) return F.tex[k]; if (k === 'bark') return ['cliffFace', [...F.col.bark, F.col.bark[0]].slice(0, 3)]; if (k === 'leaf') return ['moss', [...F.col.leaf, ...F.col.leaf].slice(0, 4)]; return F.tex.floor; };
export const famTex = (fam, k) => want(`ft|${fam}|${k}`, () => { const [kind, cols] = spec(fam, k); return groundTex(kind, cols, FAMILY[fam].pal, 977 + fam.length * 31 + k.length * 13); });
export const biomeTex = (bi, which) => want(`bt|${bi}|${which}`, () => { const B = BIOMES[BIOME_KEYS[bi]], [kind, cols] = B[which]; return groundTex(kind, cols, FAMILY[B.fam].pal, 4001 + bi * 101 + which.length * 7); });
export const placeDef = (P) => (P.kind === 'cave' ? CAVES[P.key] : P.kind === 'roof' ? ROOFTOP : P.kind === 'under' ? UNDER : P.kind === 'walk' ? WALKWAY[P.roof ? 'roof' : 'sky'] : ISLES[P.key]);
export const placeTex = (P, which) => want(`pt|${P.kind}|${P.key}|${which}`, () => { const L = placeDef(P), [k, cols] = L[which]; return groundTex(k, cols, FAMILY[L.fam].pal, 7001 + P.key.length * 41 + which.length * 7); });
const rockTex = () => want('mt|rock', () => groundTex('gravel', ['#555b5f', '#767c7c', '#9ca09a', '#3a3f44'], FAMILY.green.pal, 991));
const snowTex = () => famTex('frost', 'cliffTop');
export const propSprite = (type, fam, v) => want(`p|${type}|${fam}|${v}`, () => paintProp(type, fam, 31 + v * 991 + type.length * 37 + fam.length * 7));
export const decalSprite = (type, fam, v) => want(`d|${type}|${fam}|${v}`, () => paintDecal(type, fam, 77 + v * 17 + type.length));
export const animalSprites = (k, fam) => want(`a|${k}|${fam}`, () => animalFrames(k, fam, 300 + k.length * 37 + fam.length));
export const giantSprites = (v) => want(`g|${v}`, () => giantFrames(1201 + v * 77));
export const cloudSprite = (v) => want(`c|${v}`, () => paintCloud(5003 + v * 131));
// a glow (for the additive pass): the colour falling off from the middle in four dithered steps
const glows = new Map();
export function glowSprite(c) {
  const key = c.join(','); let cv = glows.get(key); if (cv) return cv;
  cv = mk(48, 48); const x = cv.getContext('2d'), img = x.createImageData(48, 48), d = img.data;
  for (let j = 0; j < 48; j++) for (let i = 0; i < 48; i++) { const q = 1 - Math.hypot(i - 23.5, j - 23.5) / 24; if (q <= 0) continue; const v = Math.min(1, Math.pow(q, 1.7) * 1.25), lv = Math.min(6, Math.floor(v * 6 + bay(i, j))) / 6; if (lv <= 0) continue; const o = (j * 48 + i) * 4; d[o] = c[0] * lv; d[o + 1] = c[1] * lv; d[o + 2] = c[2] * lv; d[o + 3] = 255; }
  x.putImageData(img, 0, 0); glows.set(key, cv); return cv;
}
// a ripple's ring, and a puff of fog (dithered on and off, so it reads as pixel mist)
let ring = null;
export function ringSprite() { if (ring) return ring; ring = mk(32, 32); const x = ring.getContext('2d'), img = x.createImageData(32, 32), d = img.data; for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const rr = Math.hypot(i - 15.5, j - 15.5); if (Math.abs(rr - 14) > 1.1) continue; const o = (j * 32 + i) * 4; d[o] = 224; d[o + 1] = 244; d[o + 2] = 246; d[o + 3] = 255; } x.putImageData(img, 0, 0); return ring; }
const puffs = new Map();
export function puffSprite(c, v) {
  const key = `${c.join(',')}|${v}`; let cv = puffs.get(key); if (cv) return cv;
  const w = 48, h = 30; cv = mk(w, h); const x = cv.getContext('2d'), img = x.createImageData(w, h), d = img.data, ph = v * 1.7;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ex = (i - w / 2) / (w / 2), ey = (j - h / 2) / (h / 2), q = 1 - Math.hypot(ex, ey) - (Math.sin(i * 0.4 + ph) * Math.cos(j * 0.5 + ph)) * 0.12; if (q <= 0) continue; if (Math.min(1, q * 1.7) * 0.9 <= bay(i, j)) continue; const o = (j * w + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
  x.putImageData(img, 0, 0); puffs.set(key, cv); return cv;
}

// ------------------------------------------------ the block atlas: 64 px cells; a row per family, then the city
const ACELL = 64, AW = 512, AH = 1024;
let blocks = null;
function blockAtlas() {
  if (blocks) return blocks;
  blocks = { cv: mk(AW, AH), tex: null, have: new Set(), wanted: new Map(), dirty: false };
  blocks.x = blocks.cv.getContext('2d'); blocks.tex = texNew(AW, AH, blocks.cv);
  return blocks;
}
const FACADES = ['conc', 'brick', 'metal', 'tower', 'tile'], ROOFS = ['roof', 'roofgreen'];
// a cell of a family's block texture, or of a city facade / roof; painted in when it is ready
function cell(col, row, key, src) {
  const A = blockAtlas(); if (!A.have.has(key)) { const cv = src(); if (cv) { A.x.drawImage(cv, col * ACELL, row * ACELL); A.have.add(key); A.dirty = true; A.wanted.delete(key); } else A.wanted.set(key, [col, row, src]); }
  return [(col * ACELL) / AW, (row * ACELL) / AH, ACELL / AW, ACELL / AH];
}
const famCell = (fam, k) => cell(FTEX.indexOf(k), FAMS.indexOf(fam), `${fam}|${k}`, () => famTex(fam, k));
const rockCell = () => cell(0, 7, 'rock', rockTex);
const facCell = (i) => cell(i % 8, 8, `fac${i}`, () => want(`fac|${i}`, () => facadeTex(FACADES[i], 501 + i * 13)));
const roofCell = (i) => cell(i, 9, `roof${i}`, () => want(`roof|${i}`, () => facadeTex(ROOFS[i], 701 + i * 13)));
// (cells asked for before their texture was painted are filled in as soon as it is)
export function blockTex() { const A = blockAtlas(); for (const [key, [col, row, src]] of A.wanted) cell(col, row, key, src); if (A.dirty) { texSet(A.tex, A.cv); A.dirty = false; } return A.tex; }

// faces of a column from height a down to b (south, east, west: the camera never sees the north side)
function faceS(B, X0, X1, Z, a, b, cl, s = 0.76) { B.quad([X0, a, Z], [X1, a, Z], [X1, b, Z], [X0, b, Z], [X0 / 64, (64 - a) / 64], [X1 / 64, (64 - a) / 64], [X1 / 64, (64 - b) / 64], [X0 / 64, (64 - b) / 64], cl, s); }
function faceE(B, X, Z0, Z1, a, b, cl, s = 0.62) { B.quad([X, a, Z1], [X, a, Z0], [X, b, Z0], [X, b, Z1], [Z1 / 64, (64 - a) / 64], [Z0 / 64, (64 - a) / 64], [Z0 / 64, (64 - b) / 64], [Z1 / 64, (64 - b) / 64], cl, s); }
function faceW(B, X, Z0, Z1, a, b, cl, s = 0.9) { B.quad([X, a, Z0], [X, a, Z1], [X, b, Z1], [X, b, Z0], [Z0 / 64, (64 - a) / 64], [Z1 / 64, (64 - a) / 64], [Z1 / 64, (64 - b) / 64], [Z0 / 64, (64 - b) / 64], cl, s); }
function top(B, X0, X1, Z0, Z1, y, cl, s = 1) { B.quad([X0, y, Z0], [X1, y, Z0], [X1, y, Z1], [X0, y, Z1], [X0 / 64, Z0 / 64], [X1 / 64, Z0 / 64], [X1 / 64, Z1 / 64], [X0 / 64, Z1 / 64], cl, s); }
// a thin upright box: a lift's cable, a basket's rope
function shaft(B, x, z, y0, y1, w, cl) { faceS(B, x - w, x + w, z + w, y1, y0, cl, 0.8); faceE(B, x + w, z - w, z + w, y1, y0, cl, 0.6); faceW(B, x - w, z - w, z + w, y1, y0, cl, 0.95); }
// the ground laid over a tile grid's heights: one quad per run of tiles at the same height in a row,
// textured from the baked ground (u, v across the whole grid)
function ground(G, n, ox, oy, hAt, skip) {
  for (let j = 0; j < n; j++) { let i0 = 0; while (i0 < n) { const y = hAt(i0, j); if (skip && skip(i0, j)) { i0++; continue; } let i1 = i0 + 1; while (i1 < n && hAt(i1, j) === y && !(skip && skip(i1, j))) i1++; const X0 = (ox + i0) * TS, X1 = (ox + i1) * TS, Z0 = (oy + j) * TS, Z1 = Z0 + TS; G.quad([X0, y, Z0], [X1, y, Z0], [X1, y, Z1], [X0, y, Z1], [i0 / n, j / n], [i1 / n, j / n], [i1 / n, (j + 1) / n], [i0 / n, (j + 1) / n], [0, 0, -1, 1], 1); i0 = i1; } }
}
const samp = (t, X, Y) => { const q = ((Y & 63) * 64 + (X & 63)) * 4; return [t.data[q], t.data[q + 1], t.data[q + 2]]; };

// ------------------------------------------------ chunk visuals
const LODPX = [16, 8, 4];   // pixels per tile at each level of detail
const WG = 6;               // the water's colour blends between families over this many tiles
export class ChunkVis {
  constructor(W, cx, cy) { this.W = W; this.cx = cx; this.cy = cy; this.lod = -1; this.want = 2; this.tex = null; this.gBuf = null; this.bBuf = null; this.pBuf = null; this.pGen = -1; this.missing = 1; this.used = 0; }
  free() { texFree(this.tex); freeBuffer(this.gBuf); freeBuffer(this.bBuf); freeBuffer(this.pBuf); this.tex = this.gBuf = this.bBuf = this.pBuf = null; }
  // bake (or re-bake at a finer level) once every texture the chunk needs is painted
  update(lod) {
    this.want = lod;
    if (this.lod === -1 || lod < this.lod) { if (this.bakeGround(lod)) { if (this.lod === -1) this.buildBlocks(); this.lod = lod; } }
    if (this.lod >= 0 && (this.pGen !== atlasGen() || this.missing)) this.buildProps();
  }
  bakeGround(lod) {
    const W = this.W, C = W.chunk(this.cx, this.cy), n = C.n, ppt = LODPX[lod], S = CS * ppt, at = (i, j) => (j + 1) * n + i + 1, famOf = (b) => BIOMES[BIOME_KEYS[b]].fam;
    // every texture this chunk uses, painted already?
    const bios = new Set(C.b), fams = new Set([...bios].map(famOf)), tex = {}, ftex = {};
    // the water's family at the corners of a coarse grid, so its colour shades from one to the next
    const tx0 = this.cx * CS, ty0 = this.cy * CS, gx0 = Math.floor((tx0 - 1) / WG), gy0 = Math.floor((ty0 - 1) / WG), gn = Math.ceil((CS + 2) / WG) + 2, wfam = [];
    let wet = false; for (let q = 0; q < C.k.length; q++) if (C.k[q] === K_WATER) { wet = true; break; }
    if (wet) for (let j = 0; j < gn; j++) for (let i = 0; i < gn; i++) { const f = famOf(W.biomeAt((gx0 + i) * WG, (gy0 + j) * WG)); wfam.push(f); fams.add(f); }
    let ok = true;
    for (const b of bios) { const g = biomeTex(b, 'g'), g2 = biomeTex(b, 'g2'), p = biomeTex(b, 'path'); if (!g || !g2 || !p) ok = false; tex[b] = { g, g2, p }; }
    for (const f of fams) { ftex[f] = {}; for (const k of ['water', 'toxic', 'bridge', 'floor']) { const t = famTex(f, k); if (!t) ok = false; ftex[f][k] = t; } }
    const street = biomeTex(BIOMES.crown.i, 'path'); if (!street) ok = false;
    let high = false; for (let q = 0; q < C.e.length; q++) if (C.e[q] >= 130) { high = true; break; }
    const rock = high ? rockTex() : null, snow = high ? snowTex() : null; if (high && (!rock || !snow)) ok = false;
    if (!ok) return false;
    const cv = mk(S, S), x = cv.getContext('2d'), img = x.createImageData(S, S), d = img.data, seed = W.seed, X0 = this.cx * CS * TS, Y0 = this.cy * CS * TS, step = TS / ppt;
    // the blend noise on a 4-pixel grid (as Makhana bakes it): warp offsets, and the two-texture mix
    const NG = (CS * TS) / 4, offX = new Float32Array(NG * NG), offY = new Float32Array(NG * NG), mixF = new Float32Array(NG * NG);
    for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const gx = X0 / 4 + i, gy = Y0 / 4 + j, q = j * NG + i; offX[q] = (fbm(gx / 10, gy / 10, seed + 501, 3) - 0.5) * 18; offY[q] = (fbm(gx / 10, gy / 10, seed + 502, 3) - 0.5) * 18; mixF[q] = fbm(gx / 14, gy / 14, seed + 503, 4); }
    const topQ = (q) => C.e[q] + C.h[q];
    for (let py = 0; py < S; py++) {
      const wy = Y0 + py * step, ty = Math.floor(py / ppt), ly = (py * step) & 15;
      for (let px = 0; px < S; px++) {
        const wx = X0 + px * step, tx = Math.floor(px / ppt), q = at(tx, ty), k = C.k[q], b = C.b[q], fam = famOf(b), t = bay(px, py), ci = ((py * step) >> 2) * NG + ((px * step) >> 2);
        let c, m = 1;
        if (k === K_WATER) {
          // the water's colour, shaded across the families round about
          const gx = wx / TS / WG - gx0, gy = wy / TS / WG - gy0, i = clamp(Math.floor(gx), 0, gn - 2), j = clamp(Math.floor(gy), 0, gn - 2), fx = clamp(gx - i + (t - 0.5) * 0.25, 0, 1), fy = clamp(gy - j + (t - 0.5) * 0.25, 0, 1);
          const f00 = wfam[j * gn + i], f10 = wfam[j * gn + i + 1], f01 = wfam[(j + 1) * gn + i], f11 = wfam[(j + 1) * gn + i + 1];
          if (f00 === f10 && f00 === f01 && f00 === f11) c = samp(ftex[f00].water, wx, wy);
          else { const a = samp(ftex[f00].water, wx, wy), b2 = samp(ftex[f10].water, wx, wy), c2 = samp(ftex[f01].water, wx, wy), d2 = samp(ftex[f11].water, wx, wy); c = [0, 1, 2].map((ch) => (a[ch] * (1 - fx) + b2[ch] * fx) * (1 - fy) + (c2[ch] * (1 - fx) + d2[ch] * fx) * fy); }
          if (C.k[q - n] !== K_WATER && C.k[q - n] !== K_BRIDGE && ly < 3) m = 0.6;
        }
        else if (k === K_TOXIC) { c = samp(ftex[fam].toxic, wx, wy); if (C.k[q - n] !== K_TOXIC && ly < 3) m = 0.55; }
        else if (k === K_BRIDGE) { c = samp(ftex[fam].bridge, wx, wy); if (ly === 0 || ly === 15) m = 0.55; }
        else if (k === K_STREET) c = samp(street, wx, wy);
        else if (k === K_FLOOR) c = samp(ftex[fam].floor, wx, wy);
        else {
          // ground: the biome under a warped point, its two textures mixed by noise, paths soft-edged
          const ox = offX[ci], oy = offY[ci], jx = ox * 2.2 + t * 14, jy = oy * 2.2 - t * 10, bq = at(clamp(Math.floor((px * step + jx) / TS), -1, CS), clamp(Math.floor((py * step + jy) / TS), -1, CS)), bb = C.b[bq], T2 = tex[bb] || tex[b];
          const pq = at(clamp(Math.floor((px * step + ox * 0.3) / TS), -1, CS), clamp(Math.floor((py * step + oy * 0.3) / TS), -1, CS)), pk = C.k[pq];
          if (pk === K_PATH || (k === K_PATH && pk !== K_GROUND)) c = samp(T2.p, wx, wy);
          else { const B = BIOMES[BIOME_KEYS[bb]]; c = samp(mixF[ci] + t * 0.18 > B.mix ? T2.g2 : T2.g, wx, wy); }
          // a mountain's shoulders go to bare rock, its head to snow
          const e0 = C.e[q]; if (high && e0 >= 130 && k === K_GROUND) { const ee = e0 + (mixF[ci] - 0.5) * 60 + t * 14; if (ee >= 205) c = samp(snow, wx, wy); else if (ee >= 150) c = samp(rock, wx, wy); }
          if (e0 < -60) m = 0.84;   // the canyon floors, out of the sun
        }
        // the foot of a rise to the north sits in its shadow
        if (topQ(q - n) > topQ(q) + 6 && ly < 5) m *= 0.55 + ly * 0.08;
        if (m !== 1) { const P = FAMILY[fam].pal, qi = qIdx(P, c[0] * m + t * 20, c[1] * m + t * 20, c[2] * m + t * 20); c = P.c[qi]; }
        const o = (py * S + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // decals (not in the coarsest level)
    if (lod < 2) { const k2 = ppt / TS; for (const D of C.decals) { const s = decalSprite(D.type, D.fam, Math.floor(hash2(D.x, D.y, 5) * 3)); if (!s) continue; const lx = (D.x - this.cx * CS) * TS + Math.floor(hash2(D.x, D.y, 6) * Math.max(1, TS - s.width)), ly2 = (D.y - this.cy * CS) * TS + Math.floor(hash2(D.x, D.y, 7) * Math.max(1, TS - s.height)); x.drawImage(s, lx * k2, ly2 * k2, s.width * k2, s.height * k2); } }
    texFree(this.tex); this.tex = texNew(S, S, cv);
    if (!this.gBuf) {
      const G = new Batch(C.flat ? 6 : 1536), ox = this.cx * CS, oy = this.cy * CS;
      if (C.flat) { const X1 = X0 + CS * TS, Y1 = Y0 + CS * TS, y = C.e[0]; G.quad([X0, y, Y0], [X1, y, Y0], [X1, y, Y1], [X0, y, Y1], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, -1, 1], 1); }
      else {
        ground(G, CS, ox, oy, (i, j) => C.e[at(i, j)]);
        // under a bridge over a canyon, the floor far below
        for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) { const q = at(i, j); if (C.lo[q] === NOLO) continue; const Xa = (ox + i) * TS, Za = (oy + j) * TS, y = C.lo[q]; G.quad([Xa, y, Za], [Xa + TS, y, Za], [Xa + TS, y, Za + TS], [Xa, y, Za + TS], [i / CS, j / CS], [(i + 1) / CS, j / CS], [(i + 1) / CS, (j + 1) / CS], [i / CS, (j + 1) / CS], [0, 0, -1, 1], 0.7); }
      }
      this.gBuf = newBuffer(); this.gN = G.upload(this.gBuf, renderer().gl.STATIC_DRAW);
    }
    return true;
  }
  // the ground's faces where it steps down (canyon walls, terraces, waterfalls), then the blocks on it
  buildBlocks() {
    const W = this.W, C = W.chunk(this.cx, this.cy), n = C.n, B = new Batch(2048), at = (i, j) => (j + 1) * n + i + 1;
    const fl = (q) => (C.lo[q] !== NOLO ? C.lo[q] : C.e[q]), fc = famCell;
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const q = at(i, j), k = C.k[q], e = C.e[q], fam = BIOMES[BIOME_KEYS[C.b[q]]].fam, X0 = (this.cx * CS + i) * TS, X1 = X0 + TS, Z0 = (this.cy * CS + j) * TS, Z1 = Z0 + TS;
      // terrain faces: from this tile's ground down to the neighbour's (a bridge deck is only a plank thick)
      const deck = C.lo[q] !== NOLO, wf = k === K_WATER, face = wf ? fc(fam, 'water') : deck ? fc(fam, 'bark') : e >= 180 ? fc('frost', 'cliffFace') : e >= 130 ? rockCell() : fc(fam, 'cliffFace');
      const lowS = fl(q + n), lowE = fl(q + 1), lowW = fl(q - 1), dk = (b) => (deck ? Math.max(b, e - 6) : b);
      if (lowS < e) faceS(B, X0, X1, Z1, e, dk(lowS), face, wf ? 0.9 : 0.76);
      if (lowE < e) faceE(B, X1, Z0, Z1, e, dk(lowE), face, wf ? 0.8 : 0.62);
      if (lowW < e) faceW(B, X0, Z0, Z1, e, dk(lowW), face, wf ? 0.95 : 0.9);
      // blocks: walls, buildings, the border cliffs, the giant trees' trunks
      const hgt = C.h[q]; if (!hgt) continue; const tp = e + hgt;
      let tc, bf;
      if (k === K_BLDG) { bf = facCell((C.f[q] - 1) % 5); tc = roofCell(hash2(this.cx * 16 + i, this.cy * 16 + j, 3) < 0.2 ? 1 : 0); }
      else if (k === K_WALL && C.f[q] === 2) { bf = facCell(0); tc = fc('ash', 'wallTop'); }
      else if (k === K_TRUNK) { bf = fc('dream', 'bark'); tc = bf; }
      else { tc = fc(fam, k === K_WALL ? 'wallTop' : 'cliffTop'); bf = fc(fam, k === K_WALL ? 'wallFace' : 'cliffFace'); }
      top(B, X0, X1, Z0, Z1, tp, tc, k === K_BLDG ? 0.9 : 1.04);
      const nt = (dq) => C.e[q + dq] + C.h[q + dq];
      const hs = nt(n); if (hs < tp) faceS(B, X0, X1, Z1, tp, Math.max(hs, e), bf);
      const he = nt(1); if (he < tp) faceE(B, X1, Z0, Z1, tp, Math.max(he, e), bf);
      const hw = nt(-1); if (hw < tp) faceW(B, X0, Z0, Z1, tp, Math.max(hw, e), bf);
    }
    // the lifts' cables and ropes
    for (const s of C.shafts) shaft(B, s.x, s.y, s.y0, s.y1, s.rope ? 0.7 : 1.6, s.rope ? fc('dream', 'bark') : fc('rust', 'wallFace'));
    freeBuffer(this.bBuf); this.bBuf = null; this.bN = 0; if (B.n) { this.bBuf = newBuffer(); this.bN = B.upload(this.bBuf, renderer().gl.STATIC_DRAW); }
  }
  buildProps() {
    const C = this.W.chunk(this.cx, this.cy), B = new Batch(1024), K = renderer().K; let missing = 0;
    const far = this.lod >= 2;
    for (const p of C.props) {
      if (far && PROPDEF[p.type].h < 28) continue;   // far away, only the tall things
      if (p.chest && p.chest.found) continue;        // opened chests are drawn by the game
      const s = propSprite(p.type, p.fam, p.v); if (!s) { missing++; continue; }
      B.bb(s, 0, 0, s.width, s.height, p.x, p.y, p.e - 1.5, K, 1, 1);
    }
    this.props = C.props;
    freeBuffer(this.pBuf); this.pBuf = null; this.pN = 0; if (B.n) { this.pBuf = newBuffer(); this.pN = B.upload(this.pBuf, renderer().gl.STATIC_DRAW); }
    this.pGen = atlasGen(); this.missing = missing;
  }
}

// ------------------------------------------------ a place's visuals: an island's ground at its height with a deep
// ragged rock cone under it (waterfalls off its rim), floating rocks and clouds round it; a canopy's leafy floor; a cave's
// or the undercity's floor and walls; a roof garden; a walkway's planks, posts and rails
export class PlaceVis {
  constructor(W, P) { this.W = W; this.P = P; this.tex = null; this.ok = false; this.pGen = -1; this.missing = 1; }
  free() { texFree(this.tex); freeBuffer(this.gBuf); freeBuffer(this.bBuf); freeBuffer(this.pBuf); freeBuffer(this.cBuf); this.tex = null; this.gBuf = this.bBuf = this.pBuf = this.cBuf = null; }
  update() {
    if (!this.ok) this.ok = this.P.kind === 'walk' ? this.bakeWalk() : this.bake();
    if (this.ok && (this.pGen !== atlasGen() || this.missing)) this.buildProps();
  }
  // a walkway needs no texture of its own: planks from the block atlas, a thin deck, rails along its edges
  bakeWalk() {
    const M = this.W.place(this.P), fam = M.L.fam, plank = famCell(fam, 'bridge'), side = famCell(fam, 'bark'), nw = M.nw, nh = M.nh, B = new Batch(4096);
    if (!famTex(fam, 'bridge') || !famTex(fam, 'bark')) return false;
    blockTex();
    const deck = (i, j) => i >= 0 && j >= 0 && i < nw && j < nh && M.kind[j * nw + i] !== K_VOID;
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      if (!deck(i, j)) continue; const Q = j * nw + i, y = M.e[Q], X0 = (M.ox + i) * TS, X1 = X0 + TS, Z0 = (M.oy + j) * TS, Z1 = Z0 + TS;
      top(B, X0, X1, Z0, Z1, y, plank, 1);
      const hn = (ii, jj) => (deck(ii, jj) ? M.e[jj * nw + ii] : -1e9);
      if (hn(i, j + 1) < y) { faceS(B, X0, X1, Z1, y, Math.max(hn(i, j + 1), y - 5), side, 0.7); if (!deck(i, j + 1)) faceS(B, X0, X1, Z1 - 1, y + 11, y + 9, side, 0.9); }
      if (hn(i + 1, j) < y) { faceE(B, X1, Z0, Z1, y, Math.max(hn(i + 1, j), y - 5), side, 0.55); if (!deck(i + 1, j)) faceE(B, X1 - 1, Z0, Z1, y + 11, y + 9, side, 0.7); }
      if (hn(i - 1, j) < y) { faceW(B, X0, Z0, Z1, y, Math.max(hn(i - 1, j), y - 5), side, 0.85); if (!deck(i - 1, j)) faceW(B, X0 + 1, Z0, Z1, y + 11, y + 9, side, 0.95); }
      if (!deck(i, j - 1)) faceS(B, X0, X1, Z0 + 1, y + 11, y + 9, side, 0.8);
      top(B, X0, X1, Z1, Z0, y - 5, side, 0.4);
    }
    this.bBuf = newBuffer(); this.bN = B.upload(this.bBuf, renderer().gl.STATIC_DRAW); this.gN = 0;
    return true;
  }
  bake() {
    const M = this.W.place(this.P), P = this.P, L = M.L, fam = L.fam, Pal = FAMILY[fam].pal, cave = P.kind === 'cave' || P.kind === 'under', canopy = P.kind === 'canopy', hangs = P.kind === 'isle' || canopy;
    const g = placeTex(P, 'g'), g2 = placeTex(P, 'g2'), p = placeTex(P, 'path'), wt = famTex(fam, 'water'), wallT = famTex(fam, cave ? 'cliffTop' : 'wallTop'), tox = famTex(fam, 'toxic');
    for (const k of ['cliffFace', 'cliffTop', 'water', 'wallTop', 'wallFace', canopy ? 'leaf' : 'bark']) famCell(fam, k);
    if (!g || !g2 || !p || !wt || !wallT || !tox || !famTex(fam, 'cliffFace') || !famTex(fam, 'wallFace') || !famTex(fam, canopy ? 'leaf' : 'bark')) return false;
    blockTex();
    const nw = M.nw, nh = M.nh, ppt = nw * nh > 2600 ? 8 : 16, st = TS / ppt, SW = nw * ppt, SH = nh * ppt, cv = mk(SW, SH), x = cx2d(cv), img = x.createImageData(SW, SH), d = img.data, H = P.h;
    for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) {
      const Q = Math.floor(py / ppt) * nw + Math.floor(px / ppt), k = M.kind[Q]; if (k === K_VOID) continue;
      const wx = M.ox * TS + px * st, wy = M.oy * TS + py * st, t = bay(px, py), ly = (py * st) & 15;
      let c = k === K_WATER ? samp(wt, wx, wy) : k === K_TOXIC ? samp(tox, wx, wy) : k === K_WALL ? samp(wallT, wx, wy) : k === K_PATH || k === K_FLOOR && P.kind === 'under' && fbm(wx / 90, wy / 90, P.seed, 2) > 0.55 ? samp(p, wx, wy) : samp(fbm(wx / 200, wy / 200, P.seed, 3) + t * 0.18 > 0.5 ? g2 : g, wx, wy);
      const up = Q >= nw ? M.kind[Q - nw] : K_VOID; let m = 1;
      if (hangs && up === K_VOID && ly < 2) m = 1.25;
      if (k !== K_WALL && up === K_WALL && ly < 6) m = 0.5 + ly * 0.08;
      if (m !== 1) { const qi = qIdx(Pal, c[0] * m + t * 16, c[1] * m + t * 16, c[2] * m + t * 16); c = Pal.c[qi]; }
      const o = (py * SW + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const k2 = ppt / TS; for (const D of M.decals) { const s2 = decalSprite(D.type, D.fam, Math.floor(hash2(D.x, D.y, 5) * 3)); if (s2) x.drawImage(s2, ((D.x - M.ox) * TS + 3) * k2, ((D.y - M.oy) * TS + 4) * k2, s2.width * k2, s2.height * k2); }
    this.tex = texNew(SW, SH, cv);
    const G = new Batch(1024), n2 = Math.max(nw, nh);
    // the ground (its quads' texture coordinates run over the whole grid)
    for (let j = 0; j < nh; j++) { let i0 = 0; while (i0 < nw) { if (M.kind[j * nw + i0] === K_VOID) { i0++; continue; } let i1 = i0 + 1; while (i1 < nw && M.kind[j * nw + i1] !== K_VOID) i1++; const X0 = (M.ox + i0) * TS, X1 = (M.ox + i1) * TS, Z0 = (M.oy + j) * TS, Z1 = Z0 + TS; G.quad([X0, H, Z0], [X1, H, Z0], [X1, H, Z1], [X0, H, Z1], [i0 / nw, j / nh], [i1 / nw, j / nh], [i1 / nw, (j + 1) / nh], [i0 / nw, (j + 1) / nh], [0, 0, -1, 1], 1); i0 = i1; } }
    void n2;
    this.gBuf = newBuffer(); this.gN = G.upload(this.gBuf, renderer().gl.STATIC_DRAW);
    const B = new Batch(4096), inn = (i, j) => i >= 0 && j >= 0 && i < nw && j < nh && M.kind[j * nw + i] !== K_VOID;
    const face = famCell(fam, 'cliffFace'), topC = famCell(fam, 'cliffTop'), wface = famCell(fam, 'water'), leaf = canopy ? famCell(fam, 'leaf') : null, wallF = famCell(fam, cave ? 'cliffFace' : 'wallFace'), wallTop = famCell(fam, cave ? 'cliffTop' : 'wallTop');
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      if (!inn(i, j)) continue; const Q = j * nw + i, X0 = (M.ox + i) * TS, X1 = X0 + TS, Z0 = (M.oy + j) * TS, Z1 = Z0 + TS;
      // walls: a cave's, the undercity's halls, a roof's parapet
      if (M.h[Q]) { const tp = H + M.h[Q], nt = (ii, jj) => (inn(ii, jj) ? H + M.h[jj * nw + ii] : P.kind === 'roof' ? H - 2000 : H); top(B, X0, X1, Z0, Z1, tp, wallTop, 0.85); const hs = nt(i, j + 1), he = nt(i + 1, j), hw = nt(i - 1, j); if (hs < tp) faceS(B, X0, X1, Z1, tp, Math.max(hs, H), wallF, 0.72); if (he < tp) faceE(B, X1, Z0, Z1, tp, Math.max(he, H), wallF, 0.56); if (hw < tp) faceW(B, X0, Z0, Z1, tp, Math.max(hw, H), wallF, 0.86); }
      if (!hangs) continue;
      // the underside: every column hangs to its depth (water off the rim falls far into the haze)
      const wet = M.kind[Q] === K_WATER, dep = wet && (!inn(i, j + 1) || !inn(i + 1, j) || !inn(i - 1, j)) ? 520 : M.depth[Q], lo = H - dep, Dp = (ii, jj) => (inn(ii, jj) ? M.depth[jj * nw + ii] : 0), fc = wet ? wface : canopy ? leaf : face;
      const ds = Dp(i, j + 1); if (ds < dep) faceS(B, X0, X1, Z1, H - ds, lo, fc, wet ? 0.95 : 0.62);
      const de = Dp(i + 1, j); if (de < dep) faceE(B, X1, Z0, Z1, H - de, lo, fc, wet ? 0.85 : 0.5);
      const dw = Dp(i - 1, j); if (dw < dep) faceW(B, X0, Z0, Z1, H - dw, lo, fc, wet ? 0.95 : 0.74);
      if (!wet) top(B, X0, X1, Z1, Z0, lo, canopy ? leaf : topC, 0.35);
    }
    this.bBuf = newBuffer(); this.bN = B.upload(this.bBuf, renderer().gl.STATIC_DRAW);
    return true;
  }
  buildProps() {
    const M = this.W.place(this.P), B = new Batch(512), Cl = new Batch(128), K = renderer().K; let missing = 0;
    for (const p of M.props) { if (p.chest && p.chest.found) continue; const s2 = propSprite(p.type, p.fam, p.v); if (!s2) { missing++; continue; } B.bb(s2, 0, 0, s2.width, s2.height, p.x, p.y, p.e - 1.5, K, 1, 1); }
    for (const f of M.floaters) { const s2 = propSprite('floatrock', M.L.fam, f.v); if (!s2) { missing++; continue; } B.bb(s2, 0, 0, s2.width, s2.height, f.x, f.y, f.h, K, 0.92, 1); }
    for (const c of M.clouds) { const s2 = cloudSprite(c.v); if (!s2) { missing++; continue; } Cl.gd(s2, c.x, c.y, s2.width * 2.2 * c.s, s2.height * 2.2 * c.s, c.h, 0.62); }
    freeBuffer(this.pBuf); this.pBuf = null; this.pN = 0; if (B.n) { this.pBuf = newBuffer(); this.pN = B.upload(this.pBuf, renderer().gl.STATIC_DRAW); }
    freeBuffer(this.cBuf); this.cBuf = null; this.cN = 0; if (Cl.n) { this.cBuf = newBuffer(); this.cN = Cl.upload(this.cBuf, renderer().gl.STATIC_DRAW); }
    this.props = M.props; this.pGen = atlasGen(); this.missing = missing;
  }
}
export { K_GROUND };
