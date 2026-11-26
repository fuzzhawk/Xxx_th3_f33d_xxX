// What the GPU holds for the garden, made as it is needed: ground textures per biome and family,
// prop and creature sprites, the block atlas (cliffs, walls, city facades and roofs), and per chunk a
// baked ground (in three levels of detail by distance), its extruded blocks and its props. Painting
// runs from a queue with a time budget a frame, so walking into new country never stalls.
import { mk, cx2d, bay, qIdx, clamp, fbm, hash2 } from '../mk/tex.js';
import { renderer, texNew, texSet, texFree, Batch, newBuffer, freeBuffer, atlasGen } from '../mk/gl.js';
import { BIOMES, BIOME_KEYS, FAMILY, ISLES } from './lands.js';
import { groundTex, facadeTex, paintProp, paintDecal, animalFrames, giantFrames, PROPDEF } from './art.js';
import { TS, CS, K_GROUND, K_PATH, K_FLOOR, K_WATER, K_CLIFF, K_WALL, K_BRIDGE, K_TOXIC, K_BLDG, K_STREET } from './world.js';

// ------------------------------------------------ the paint queue
const jobs = [], done = new Map();
export function want(key, make) { let j = done.get(key); if (j) return j.out; if (!jobs.some((q) => q.key === key)) jobs.push({ key, make }); return null; }
export function pump(ms) { const t0 = performance.now(); while (jobs.length && performance.now() - t0 < ms) { const j = jobs.shift(); try { j.out = j.make(); } catch (e) { console.warn('garden paint', j.key, e); j.out = null; } done.set(j.key, j); } return jobs.length; }
export const pending = () => jobs.length;

const FAMS = ['green', 'rust', 'desert', 'ash', 'frost'], FTEX = ['cliffTop', 'cliffFace', 'wallTop', 'wallFace'];
export const famTex = (fam, k) => want(`ft|${fam}|${k}`, () => { const F = FAMILY[fam], [kind, cols] = F.tex[k]; return groundTex(kind, cols, F.pal, 977 + fam.length * 31 + k.length * 13); });
export const biomeTex = (bi, which) => want(`bt|${bi}|${which}`, () => { const B = BIOMES[BIOME_KEYS[bi]], [kind, cols] = B[which]; return groundTex(kind, cols, FAMILY[B.fam].pal, 4001 + bi * 101 + which.length * 7); });
export const isleTex = (kind, which) => want(`it|${kind}|${which}`, () => { const L = ISLES[kind], [k, cols] = L[which]; return groundTex(k, cols, FAMILY[L.fam].pal, 7001 + kind.length * 41 + which.length * 7); });
export const propSprite = (type, fam, v) => want(`p|${type}|${fam}|${v}`, () => paintProp(type, fam, 31 + v * 991 + type.length * 37 + fam.length * 7));
export const decalSprite = (type, fam, v) => want(`d|${type}|${fam}|${v}`, () => paintDecal(type, fam, 77 + v * 17 + type.length));
export const animalSprites = (k, fam) => want(`a|${k}|${fam}`, () => animalFrames(k, fam, 300 + k.length * 37 + fam.length));
export const giantSprites = (v) => want(`g|${v}`, () => giantFrames(1201 + v * 77));

// ------------------------------------------------ the block atlas: 64 px cells, rows by family, then the city
const ACELL = 64, AW = 512;
let blocks = null;
function blockAtlas() {
  if (blocks) return blocks;
  blocks = { cv: mk(AW, AW), tex: null, have: new Set(), wanted: new Map(), dirty: false };
  blocks.x = blocks.cv.getContext('2d'); blocks.tex = texNew(AW, AW, blocks.cv);
  return blocks;
}
const FACADES = ['conc', 'brick', 'metal', 'tower', 'tile'], ROOFS = ['roof', 'roofgreen'];
// cell of a family's block texture, or of a city facade / roof; paints it in when it is ready
function cell(col, row, key, src) {
  const A = blockAtlas(); if (!A.have.has(key)) { const cv = src(); if (cv) { A.x.drawImage(cv, col * ACELL, row * ACELL); A.have.add(key); A.dirty = true; A.wanted.delete(key); } else A.wanted.set(key, [col, row, src]); }
  return [(col * ACELL) / AW, (row * ACELL) / AW, ACELL / AW, ACELL / AW];
}
const famCell = (fam, k) => cell(FTEX.indexOf(k), FAMS.indexOf(fam), `${fam}|${k}`, () => famTex(fam, k));
const facCell = (i) => cell(i % 8, 5, `fac${i}`, () => want(`fac|${i}`, () => facadeTex(FACADES[i], 501 + i * 13)));
const roofCell = (i) => cell(i, 6, `roof${i}`, () => want(`roof|${i}`, () => facadeTex(ROOFS[i], 701 + i * 13)));
// (cells asked for before their texture was painted are filled in as soon as it is)
export function blockTex() { const A = blockAtlas(); for (const [key, [col, row, src]] of A.wanted) cell(col, row, key, src); if (A.dirty) { texSet(A.tex, A.cv); A.dirty = false; } return A.tex; }

// ------------------------------------------------ chunk visuals
const LODPX = [16, 8, 4];   // pixels per tile at each level of detail
export class ChunkVis {
  constructor(W, cx, cy) { this.W = W; this.cx = cx; this.cy = cy; this.lod = -1; this.want = 2; this.tex = null; this.gBuf = null; this.bBuf = null; this.pBuf = null; this.pGen = -1; this.missing = 1; this.used = 0; }
  free() { texFree(this.tex); freeBuffer(this.gBuf); freeBuffer(this.bBuf); freeBuffer(this.pBuf); this.tex = this.gBuf = this.bBuf = this.pBuf = null; }
  // bake (or re-bake at a finer level) once every texture the chunk needs is painted
  update(lod) {
    this.want = lod;
    if (this.lod === -1 || lod < this.lod) { if (this.bakeGround(lod)) { this.lod = lod; this.buildBlocks(); } }
    if (this.lod >= 0 && (this.pGen !== atlasGen() || this.missing)) this.buildProps();
  }
  bakeGround(lod) {
    const W = this.W, C = W.chunk(this.cx, this.cy), n = C.n, ppt = LODPX[lod], S = CS * ppt, at = (i, j) => (j + 1) * n + i + 1;
    // every texture this chunk uses, painted already?
    const bios = new Set(C.b), fams = new Set([...bios].map((b) => BIOMES[BIOME_KEYS[b]].fam)), tex = {}, ftex = {};
    let ok = true;
    for (const b of bios) { const g = biomeTex(b, 'g'), g2 = biomeTex(b, 'g2'), p = biomeTex(b, 'path'); if (!g || !g2 || !p) ok = false; tex[b] = { g, g2, p }; }
    for (const f of fams) { ftex[f] = {}; for (const k of ['water', 'toxic', 'bridge', 'floor']) { const t = famTex(f, k); if (!t) ok = false; ftex[f][k] = t; } }
    const street = biomeTex(BIOMES.crown.i, 'path'); if (!street) ok = false;
    if (!ok) return false;
    const cv = mk(S, S), x = cv.getContext('2d'), img = x.createImageData(S, S), d = img.data, seed = W.seed, X0 = this.cx * CS * TS, Y0 = this.cy * CS * TS, step = TS / ppt;
    const samp = (t, X, Y) => { const q = ((Y & 63) * 64 + (X & 63)) * 4; return [t.data[q], t.data[q + 1], t.data[q + 2]]; };
    const famOf = (b) => BIOMES[BIOME_KEYS[b]].fam;
    // the blend noise on a 4-pixel grid (as Makhana bakes it): warp offsets, and the two-texture mix
    const NC = (CS * TS) / 4, offX = new Float32Array(NC * NC), offY = new Float32Array(NC * NC), mixF = new Float32Array(NC * NC);
    for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) { const gx = X0 / 4 + i, gy = Y0 / 4 + j, q = j * NC + i; offX[q] = (fbm(gx / 10, gy / 10, seed + 501, 3) - 0.5) * 18; offY[q] = (fbm(gx / 10, gy / 10, seed + 502, 3) - 0.5) * 18; mixF[q] = fbm(gx / 14, gy / 14, seed + 503, 4); }
    for (let py = 0; py < S; py++) {
      const wy = Y0 + py * step, ty = Math.floor(py / ppt), ly = (py * step) & 15;
      for (let px = 0; px < S; px++) {
        const wx = X0 + px * step, tx = Math.floor(px / ppt), q = at(tx, ty), k = C.k[q], b = C.b[q], fam = famOf(b), t = bay(px, py);
        let c, m = 1;
        if (k === K_WATER || k === K_TOXIC) { c = samp(ftex[fam][k === K_WATER ? 'water' : 'toxic'], wx, wy); const up = C.k[q - n]; if (up !== K_WATER && up !== K_TOXIC && up !== K_BRIDGE && ly < 3) m = 0.55; }
        else if (k === K_BRIDGE) { c = samp(ftex[fam].bridge, wx, wy); if (ly === 0 || ly === 15) m = 0.55; }
        else if (k === K_STREET) c = samp(street, wx, wy);
        else if (k === K_FLOOR) c = samp(ftex[fam].floor, wx, wy);
        else {
          // ground: the biome under a warped point, its two textures mixed by noise, paths soft-edged
          const ci = ((py * step) >> 2) * NC + ((px * step) >> 2), ox = offX[ci], oy = offY[ci];
          const jx = ox * 2.2 + t * 14, jy = oy * 2.2 - t * 10, bq = at(clamp(Math.floor((px * step + jx) / TS), -1, CS), clamp(Math.floor((py * step + jy) / TS), -1, CS)), bb = C.b[bq], T2 = tex[bb] || tex[b];
          const pq = at(clamp(Math.floor((px * step + ox * 0.3) / TS), -1, CS), clamp(Math.floor((py * step + oy * 0.3) / TS), -1, CS)), pk = C.k[pq];
          if (pk === K_PATH || (k === K_PATH && pk !== K_GROUND)) c = samp(T2.p, wx, wy);
          else { const B = BIOMES[BIOME_KEYS[bb]]; c = samp(mixF[ci] + t * 0.18 > B.mix ? T2.g2 : T2.g, wx, wy); }
          const up = C.k[q - n]; if ((up === K_CLIFF || up === K_WALL || up === K_BLDG) && ly < 5) m = 0.55 + ly * 0.08;
        }
        if (m !== 1) { const P = FAMILY[fam].pal, qi = qIdx(P, c[0] * m + t * 20, c[1] * m + t * 20, c[2] * m + t * 20); c = P.c[qi]; }
        const o = (py * S + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // decals (not in the coarsest level)
    if (lod < 2) { const k2 = ppt / TS; for (const D of C.decals) { const s = decalSprite(D.type, D.fam, Math.floor(hash2(D.x, D.y, 5) * 3)); if (!s) continue; const lx = (D.x - this.cx * CS) * TS + Math.floor(hash2(D.x, D.y, 6) * Math.max(1, TS - s.width)), ly2 = (D.y - this.cy * CS) * TS + Math.floor(hash2(D.x, D.y, 7) * Math.max(1, TS - s.height)); x.drawImage(s, lx * k2, ly2 * k2, s.width * k2, s.height * k2); } }
    texFree(this.tex); this.tex = texNew(S, S, cv);
    if (!this.gBuf) { const G = new Batch(6), X1 = X0 + CS * TS, Y1 = Y0 + CS * TS; G.quad([X0, 0, Y0], [X1, 0, Y0], [X1, 0, Y1], [X0, 0, Y1], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, -1, 1], 1); this.gBuf = newBuffer(); this.gN = G.upload(this.gBuf, renderer().gl.STATIC_DRAW); }
    return true;
  }
  buildBlocks() {
    const W = this.W, C = W.chunk(this.cx, this.cy), n = C.n, B = new Batch(2048), at = (i, j) => (j + 1) * n + i + 1;
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const q = at(i, j), hgt = C.h[q]; if (!hgt) continue; const k = C.k[q], fam = BIOMES[BIOME_KEYS[C.b[q]]].fam;
      let top, face;
      if (k === K_BLDG) { face = facCell((C.f[q] - 1) % 5); top = roofCell(hash2(this.cx * 16 + i, this.cy * 16 + j, 3) < 0.2 ? 1 : 0); }
      else if (k === K_WALL && C.f[q] === 2) { face = facCell(0); top = famCell('ash', 'wallTop'); }
      else { top = famCell(fam, k === K_WALL ? 'wallTop' : 'cliffTop'); face = famCell(fam, k === K_WALL ? 'wallFace' : 'cliffFace'); }
      const X0 = (this.cx * CS + i) * TS, X1 = X0 + TS, Z0 = (this.cy * CS + j) * TS, Z1 = Z0 + TS, nb = (dx, dy) => C.h[q + dy * n + dx];
      B.quad([X0, hgt, Z0], [X1, hgt, Z0], [X1, hgt, Z1], [X0, hgt, Z1], [X0 / 64, Z0 / 64], [X1 / 64, Z0 / 64], [X1 / 64, Z1 / 64], [X0 / 64, Z1 / 64], top, k === K_BLDG ? 0.9 : 1.04);
      const hs = nb(0, 1); if (hs < hgt) B.quad([X0, hgt, Z1], [X1, hgt, Z1], [X1, hs, Z1], [X0, hs, Z1], [X0 / 64, (64 - hgt) / 64], [X1 / 64, (64 - hgt) / 64], [X1 / 64, (64 - hs) / 64], [X0 / 64, (64 - hs) / 64], face, 0.76);
      const he = nb(1, 0); if (he < hgt) B.quad([X1, hgt, Z1], [X1, hgt, Z0], [X1, he, Z0], [X1, he, Z1], [Z1 / 64, (64 - hgt) / 64], [Z0 / 64, (64 - hgt) / 64], [Z0 / 64, (64 - he) / 64], [Z1 / 64, (64 - he) / 64], face, 0.62);
      const hw = nb(-1, 0); if (hw < hgt) B.quad([X0, hgt, Z0], [X0, hgt, Z1], [X0, hw, Z1], [X0, hw, Z0], [Z0 / 64, (64 - hgt) / 64], [Z1 / 64, (64 - hgt) / 64], [Z1 / 64, (64 - hw) / 64], [Z0 / 64, (64 - hw) / 64], face, 0.9);
    }
    freeBuffer(this.bBuf); this.bBuf = null; this.bN = 0; if (B.n) { this.bBuf = newBuffer(); this.bN = B.upload(this.bBuf, renderer().gl.STATIC_DRAW); }
  }
  buildProps() {
    const C = this.W.chunk(this.cx, this.cy), B = new Batch(1024), K = renderer().K; let missing = 0;
    const far = this.lod >= 2;
    for (const p of C.props) {
      if (far && PROPDEF[p.type].h < 28) continue;   // far away, only the tall things
      const s = propSprite(p.type, p.fam, p.v); if (!s) { missing++; continue; }
      B.bb(s, 0, 0, s.width, s.height, p.x, p.y, -1.5, K, 1, 1);
    }
    this.props = C.props;
    freeBuffer(this.pBuf); this.pBuf = null; this.pN = 0; if (B.n) { this.pBuf = newBuffer(); this.pN = B.upload(this.pBuf, renderer().gl.STATIC_DRAW); }
    this.pGen = atlasGen(); this.missing = missing;
  }
}

// ------------------------------------------------ an island's visuals: ground lifted to its height,
// a ragged rock skirt hanging under its rim, its props
export class IsleVis {
  constructor(W, I) { this.W = W; this.I = I; this.tex = null; this.ok = false; this.pGen = -1; this.missing = 1; }
  free() { texFree(this.tex); freeBuffer(this.gBuf); freeBuffer(this.bBuf); freeBuffer(this.pBuf); }
  update() {
    if (!this.ok) this.ok = this.bake();
    if (this.ok && (this.pGen !== atlasGen() || this.missing)) this.buildProps();
  }
  bake() {
    const M = this.W.isle(this.I), L = M.L, P = FAMILY[L.fam].pal, g = isleTex(this.I.kind, 'g'), g2 = isleTex(this.I.kind, 'g2'), p = isleTex(this.I.kind, 'path'), face = famCell(L.fam, 'cliffFace'), top = famCell(L.fam, 'cliffTop');
    if (!g || !g2 || !p || !famTex(L.fam, 'cliffFace')) return false;
    const n = M.n, S = n * TS, cv = mk(S, S), x = cx2d(cv), img = x.createImageData(S, S), d = img.data, H = this.I.h;
    const samp = (t, X, Y) => { const q = ((Y & 63) * 64 + (X & 63)) * 4; return [t.data[q], t.data[q + 1], t.data[q + 2]]; };
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const k = M.kind[Math.floor(py / TS) * n + Math.floor(px / TS)]; if (k === 255) continue;
      const wx = M.ox * TS + px, wy = M.oy * TS + py, t = bay(px, py); let c = k === K_PATH ? samp(p, wx, wy) : samp(fbm(wx / 200, wy / 200, this.I.seed, 3) + t * 0.18 > 0.5 ? g2 : g, wx, wy);
      const up = py >= TS ? M.kind[(Math.floor(py / TS) - 1) * n + Math.floor(px / TS)] : 255; if (up === 255 && (py & 15) < 2) { const qi = qIdx(P, c[0] * 1.25, c[1] * 1.25, c[2] * 1.25); c = P.c[qi]; }
      const o = (py * S + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    for (const D of M.decals) { const s = decalSprite(D.type, D.fam, Math.floor(hash2(D.x, D.y, 5) * 3)); if (s) x.drawImage(s, (D.x - M.ox) * TS + 3, (D.y - M.oy) * TS + 4); }
    this.tex = texNew(S, S, cv);
    const G = new Batch(6), X0 = M.ox * TS, Z0 = M.oy * TS, X1 = X0 + S, Z1 = Z0 + S; G.quad([X0, H, Z0], [X1, H, Z0], [X1, H, Z1], [X0, H, Z1], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, -1, 1], 1);
    this.gBuf = newBuffer(); this.gN = G.upload(this.gBuf, renderer().gl.STATIC_DRAW);
    // the skirt: every rim tile hangs a column of rock down to its depth; inner tiles hang deeper still
    const B = new Batch(4096), inn = (i, j) => i >= 0 && j >= 0 && i < n && j < n && M.kind[j * n + i] !== 255;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (!inn(i, j)) continue; const dep = M.depth[j * n + i], X0b = (M.ox + i) * TS, X1b = X0b + TS, Z0b = (M.oy + j) * TS, Z1b = Z0b + TS, lo = H - dep, D = (ii, jj) => (inn(ii, jj) ? M.depth[jj * n + ii] : 0);
      const ds = D(i, j + 1); if (ds < dep) B.quad([X0b, H - ds, Z1b], [X1b, H - ds, Z1b], [X1b, lo, Z1b], [X0b, lo, Z1b], [X0b / 64, 0], [X1b / 64, 0], [X1b / 64, (dep - ds) / 64], [X0b / 64, (dep - ds) / 64], face, 0.62);
      const de = D(i + 1, j); if (de < dep) B.quad([X1b, H - de, Z1b], [X1b, H - de, Z0b], [X1b, lo, Z0b], [X1b, lo, Z1b], [Z1b / 64, 0], [Z0b / 64, 0], [Z0b / 64, (dep - de) / 64], [Z1b / 64, (dep - de) / 64], face, 0.5);
      const dw = D(i - 1, j); if (dw < dep) B.quad([X0b, H - dw, Z0b], [X0b, H - dw, Z1b], [X0b, lo, Z1b], [X0b, lo, Z0b], [Z0b / 64, 0], [Z1b / 64, 0], [Z1b / 64, (dep - dw) / 64], [Z0b / 64, (dep - dw) / 64], face, 0.74);
      B.quad([X0b, lo, Z1b], [X1b, lo, Z1b], [X1b, lo, Z0b], [X0b, lo, Z0b], [X0b / 64, Z1b / 64], [X1b / 64, Z1b / 64], [X1b / 64, Z0b / 64], [X0b / 64, Z0b / 64], top, 0.35);
    }
    this.bBuf = newBuffer(); this.bN = B.upload(this.bBuf, renderer().gl.STATIC_DRAW);
    return true;
  }
  buildProps() {
    const M = this.W.isle(this.I), B = new Batch(512), K = renderer().K; let missing = 0;
    for (const p of M.props) { const s = propSprite(p.type, p.fam, p.v); if (!s) { missing++; continue; } B.bb(s, 0, 0, s.width, s.height, p.x, p.y, this.I.h - 1.5, K, 1, 1); }
    freeBuffer(this.pBuf); this.pBuf = newBuffer(); this.pN = B.upload(this.pBuf, renderer().gl.STATIC_DRAW); this.pGen = atlasGen(); this.missing = missing;
  }
}
export { K_GROUND };
