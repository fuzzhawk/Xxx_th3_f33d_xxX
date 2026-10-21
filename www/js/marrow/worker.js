// Renders MARROW sprite frames off the main thread. A job names a character
// (seed + options) and the frames wanted per animation; the reply carries raw
// RGBA buffers. Sometimes a character gets a gritty, dithered finish.
import { FACE_DEFAULTS, buildRig, simMove, frameAt, renderSprite, simWear, wearAt, buildFace, simFaceForAnim, faceAt } from './engine.js';
import { randomParams } from './params.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// ordered dithering into fewer tones, plus a few dark specks and chipped edges
function grit(d, W, H, seed, amt) {
  const R = mulberry(seed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i + 3] < 128) continue;
    const b = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 48 * amt;
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] + b) / 32) * 32));
    if (R() < 0.05 * amt) { d[i] *= 0.55; d[i + 1] *= 0.5; d[i + 2] *= 0.45; }
    const a = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : d[(yy * W + xx) * 4 + 3]);
    const edge = a(x - 1, y) < 128 || a(x + 1, y) < 128 || a(x, y - 1) < 128 || a(x, y + 1) < 128;
    if (edge && R() < 0.12 * amt) d[i + 3] = 0;
  }
}
const chars = new Map();
function character(job) {
  const key = `${job.seed}|${JSON.stringify(job.look || {})}|${job.monsters ? 1 : 0}|${job.preset || ''}`;
  let c = chars.get(key);
  if (!c) {
    const { p, skin, scale } = randomParams(job.seed, { look: job.look, monsters: job.monsters, preset: job.preset, skin: job.skin });
    c = { p, skin, scale, R: buildRig(p), anims: {}, wear: {}, faces: {} };
    if (chars.size > 24) chars.delete(chars.keys().next().value);
    chars.set(key, c);
  }
  return c;
}
function frames(job) {
  const c = character(job), out = {}, transfer = [], meta = {};
  const W = job.W, H = job.H, grittyAmt = job.grit ?? 0;
  for (const [id, spec] of Object.entries(job.anims)) {
    const a = c.anims[id] ||= simMove(c.R, c.p, id);
    const wr = c.wear[id] ||= simWear(c.R, a, c.p);
    let fm = null, fa = null;
    if (job.face) { c.faceM ||= buildFace(c.p, Object.fromEntries(Object.keys(FACE_DEFAULTS).map((k) => [k, c.p[k] ?? FACE_DEFAULTS[k]])), c.p, 2); fm = c.faceM; fa = c.faces[id] ||= simFaceForAnim(c.R, fm, a, id, 'auto'); }
    // spec: a frame count (evenly spaced) or a list of fractions of the move
    const times = Array.isArray(spec) ? spec.map((f) => f * (a.duration - 1 / 120)) : Array.from({ length: spec }, (_, i) => (a.loop ? i * a.duration / spec : i * (a.duration - 1 / 120) / Math.max(1, spec - 1)));
    out[id] = times.map((t, k) => {
      const fr = frameAt(a, t), f2 = fr.dx !== undefined ? Object.assign({}, fr, { x: fr.dx }) : fr;
      const wear = { w: c.p, spec: wr.spec, pos: wearAt(a, wr, t), offsets: wr.offsets };
      const face = fa ? (() => { const f = faceAt(a, fa, t); return { M: fm, X: f.X, act: f.act, gaze: f.gaze, ctrl: f.ctrl }; })() : null;
      const r = renderSprite(c.R, f2, { W, H, ppm: H * (job.scale || c.scale), ox: W * (job.anchorX ?? a.anchorX), oy: H * 0.94, mode: 'skin', levels: 4, outline: 'sel', skin: c.skin, shadow: !!job.shadow, wear, face, shiftX: fr.dx !== undefined ? fr.x - fr.dx : 0 });
      const d = new Uint8ClampedArray(r.data);
      if (grittyAmt) grit(d, W, H, job.seed * 31 + k, grittyAmt);
      transfer.push(d.buffer);
      return d;
    });
    meta[id] = { loop: !!a.loop, duration: a.duration, travel: !!a.travel };
  }
  return { out, meta, transfer, outfit: c.p.outfit, skin: c.skin };
}
self.onmessage = (e) => {
  const job = e.data;
  try { const r = frames(job); self.postMessage({ id: job.id, frames: r.out, meta: r.meta, outfit: r.outfit, skin: r.skin }, r.transfer); }
  catch (err) { self.postMessage({ id: job.id, error: String(err && err.message || err) }); }
};
