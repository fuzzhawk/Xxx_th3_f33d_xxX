// Crystal Sprite Engine characters for the games. crystalSheet() returns at once
// with a sheet canvas that is painted when the worker has baked it (PNG-cached in
// IndexedDB, so each character is baked once). Actor wraps the engine's animator:
// feed it movement each tick, call its verbs (jump, attack, shoot, cast, hurt, ko,
// emote…), read the events it returns, and draw it by its feet.
import './engine.js';
import { idbGet, idbSet } from '../store.js';

export const S = globalThis.FF5Sprites;
export const FW = 40, FH = 40, AX = 20, AY = 37;
export const ERAS = ['Fantasy', 'Present day', 'Sci-fi'];
const VER = 'c1';
const ANIM_NAMES = Object.keys(S.animations);
const ALL_DIRS = S.directions.slice();

let worker = null, nextId = 1, busy = false;
const pending = new Map(), queue = [];
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => { const j = pending.get(e.data.id); pending.delete(e.data.id); busy = false; j?.(e.data); pump(); };
  worker.onerror = () => { busy = false; for (const j of pending.values()) j({ error: 'worker failed' }); pending.clear(); };
  return worker;
}
function pump() {
  if (busy || !queue.length) return;
  const job = queue.pop(); busy = true; // newest first: whatever is on screen now
  pending.set(job.id, job.done);
  getWorker().postMessage(job.msg);
}
const bake = (msg) => new Promise((resolve) => { const id = nextId++; queue.push({ id, msg: { ...msg, id }, done: resolve }); pump(); });

// rows run animation × direction, in engine order, for the directions baked
function layout(dirs) {
  const animations = {};
  ANIM_NAMES.forEach((n, ai) => { animations[n] = { ...S.animations[n], rows: Object.fromEntries(dirs.map((d, di) => [d, ai * dirs.length + di])) }; });
  return { frameWidth: FW, frameHeight: FH, anchor: { x: AX, y: AY }, directions: dirs, animations };
}

const mem = new Map();
// A sheet: { cv, meta, char, ready, ok }. `char` is a full character object, or
// omitted for a random one from `era`. Seeds are folded into a pool so that the
// cache fills up and later games start instantly.
export function crystalSheet(seed, opts = {}) {
  const dirs = opts.dirs || ALL_DIRS, era = opts.char ? '' : (opts.era || '');
  const key = `${VER}|${seed}|${era}|${opts.char ? JSON.stringify(opts.char) : ''}|${dirs.join('')}`;
  if (mem.has(key)) return mem.get(key);
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; cv.pixel = true;
  const sheet = { cv, meta: layout(dirs), char: opts.char || null, ok: false, seed };
  sheet.ready = (async () => {
    try { const rec = await idbGet('kv', key); if (rec?.blob) { const bm = await createImageBitmap(rec.blob); cv.width = bm.width; cv.height = bm.height; cv.getContext('2d').drawImage(bm, 0, 0); sheet.char = rec.char; sheet.ok = true; return sheet; } } catch { /* no cache */ }
    const r = await bake({ seed, era, char: opts.char, dirs });
    if (r.error) { console.warn('crystal:', r.error); return sheet; }
    cv.width = r.w; cv.height = r.h; cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.data.buffer), r.w, r.h), 0, 0);
    sheet.meta = r.meta; sheet.char = r.char; sheet.ok = true;
    cv.toBlob((blob) => blob && idbSet('kv', key, { blob, char: r.char }).catch(() => {}), 'image/png');
    return sheet;
  })();
  mem.set(key, sheet); if (mem.size > 80) mem.delete(mem.keys().next().value);
  return sheet;
}
// a random character from a pool of 90 per era (quick once cached)
export const crystalPool = (seed, era, dirs) => crystalSheet((((seed >>> 0) * 2654435761) >>> 0) % 90 + 1, { era, dirs });

// draw one frame with its feet at (x, y)
export function drawFrame(ctx, sheet, anim, dir, frame, x, y, scale = 1, o = {}) {
  if (!sheet?.ok) { // stand-in until baked: a little shadowed figure
    ctx.save(); ctx.globalAlpha = (o.alpha ?? 1) * 0.5; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y - 1, 7 * scale, 2.5 * scale, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#9aa'; ctx.fillRect(x - 4 * scale, y - 22 * scale, 8 * scale, 20 * scale); ctx.restore(); return;
  }
  const A = sheet.meta.animations[anim] || sheet.meta.animations.idle;
  let row = A.rows[dir];
  if (row === undefined) row = A.rows[sheet.meta.directions.includes('E') && /E/.test(dir) ? 'E' : sheet.meta.directions.includes('W') && /W/.test(dir) ? 'W' : sheet.meta.directions[0]];
  const f = Math.max(0, Math.min(A.frames - 1, frame | 0));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.filter) ctx.filter = o.filter;
  const w = FW * scale, h = FH * scale;
  ctx.drawImage(sheet.cv, f * FW, row * FH, FW, FH, Math.round(x - AX * scale), Math.round(y - AY * scale), w, h);
  ctx.restore();
}

// the facing that best matches a vector, limited to what a sheet has
export const dirOf = (vx, vy, mode = 'eight') => S.dirFromVector(vx, vy, mode);

export class Actor {
  constructor(sheet, opts = {}) {
    this.sheet = sheet;
    this.mode = opts.mode || 'eight';
    this.a = S.createAnimator({ mode: this.mode, walkSpeed: opts.walkSpeed ?? 4, runSpeed: opts.runSpeed ?? 50, walkStride: opts.walkStride, runStride: opts.runStride });
    if (opts.dir) this.a.face(opts.dir);
    this.s = { anim: 'idle', dir: opts.dir || (this.mode === 'side' ? 'E' : 'S'), frame: 0, events: [] };
    this.flash = 0;
  }
  // dt in seconds; st: { vx, vy, grounded, airVy, lowHealth }. Returns the events.
  update(dt, st = {}) {
    this.s = this.a.update(dt, { vx: 0, vy: 0, grounded: true, ...st });
    if (this.flash > 0) this.flash -= dt;
    return this.s.events;
  }
  get anim() { return this.s.anim; }
  get dir() { return this.s.dir; }
  get locked() { return !!S.animations[this.a.action]?.lock; }
  get isKO() { return !!this.a.isKO; }
  jump() { return this.a.jump(); }
  attack() { return this.a.attack(); }
  shoot() { return this.a.shoot(); }
  cast() { return this.a.cast(); }
  stopCast() { return this.a.stopCast?.(); }
  hurt() { this.flash = 0.18; return this.a.hurt(); }
  ko() { this.flash = 0.18; return this.a.ko(); }
  revive() { return this.a.revive(); }
  emote(name, secs = 1.5) { return this.a.emote(name, secs); }
  face(dir) { this.a.face(dir); this.s = { ...this.s, dir }; }
  draw(ctx, x, y, scale = 1, o = {}) {
    drawFrame(ctx, this.sheet, this.s.anim, this.s.dir, this.s.frame, x, y, scale, o);
    if (this.flash > 0 && this.sheet.ok) drawFrame(ctx, this.sheet, this.s.anim, this.s.dir, this.s.frame, x, y, scale, { ...o, filter: 'brightness(3)', alpha: 0.7 * (o.alpha ?? 1) });
  }
}
