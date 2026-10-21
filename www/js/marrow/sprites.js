// MARROW characters for the games. Sheets come back at once as canvases showing a
// quick stand-in, and are repainted in place when the worker has simulated and
// rendered the real frames. Finished frames are kept in IndexedDB, so each
// character is only ever built once.
import { idbGet, idbSet } from '../store.js';

const VER = 'm3';
let worker = null, nextId = 1;
const pending = new Map(), queue = [];
let busy = false;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => { const j = pending.get(e.data.id); pending.delete(e.data.id); busy = false; j?.(e.data); pump(); };
  worker.onerror = () => { busy = false; for (const j of pending.values()) j({ error: 'worker failed' }); pending.clear(); };
  return worker;
}
function pump() {
  if (busy || !queue.length) return;
  // most recently requested first: whatever is on screen now
  const job = queue.pop(); busy = true;
  pending.set(job.id, job.done);
  getWorker().postMessage(job.msg);
}
function render(msg) {
  return new Promise((resolve) => { const id = nextId++; queue.push({ id, msg: { ...msg, id }, done: resolve }); pump(); });
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.pixel = true; return c; };
function paint(c, data, w, h) { c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0); c.marrow = true; }

// some characters get a gritty, dithered finish
const gritFor = (seed) => (((seed * 2654435761) >>> 0) % 100 < 30 ? 0.6 + (((seed >>> 3) % 5) / 10) : 0);

// fetch frames (memory → IndexedDB as PNGs → worker) and paint them into the given canvases
const mem = new Map();
async function fill(key, msg, targets) {
  let got = mem.get(key), fresh = false;
  if (!got) { try { const rec = await idbGet('kv', key); if (rec?.blobs) got = rec; } catch { /* no cache */ } }
  if (!got) {
    const r = await render(msg);
    if (r.error) { console.warn('marrow:', r.error); return null; }
    got = { frames: r.frames, meta: r.meta, outfit: r.outfit }; fresh = true;
  }
  mem.set(key, got); if (mem.size > 60) mem.delete(mem.keys().next().value);
  const jobs = [];
  for (const [name, list] of Object.entries(targets)) list.forEach((c, i) => {
    if (got.frames?.[name]?.[i]) paint(c, got.frames[name][i], msg.W, msg.H);
    else if (got.blobs?.[name]?.[i]) jobs.push(createImageBitmap(got.blobs[name][i]).then((bm) => { c.width = msg.W; c.height = msg.H; const x = c.getContext('2d'); x.clearRect(0, 0, msg.W, msg.H); x.drawImage(bm, 0, 0); c.marrow = true; }).catch(() => {}));
  });
  await Promise.all(jobs);
  if (fresh) {
    const blobs = {};
    await Promise.all(Object.entries(targets).map(async ([name, list]) => { blobs[name] = await Promise.all(list.map((c) => new Promise((res) => c.toBlob(res, 'image/png')))); }));
    idbSet('kv', key, { blobs, meta: got.meta, outfit: got.outfit }).catch(() => {});
  }
  return got;
}

const W0 = 36, H0 = 48, SCALE0 = 0.47;
// The generic sheet every game uses: { idle, walk: [a, b], walkCycle, jump, punch, kick, special, block, hurt, ko }
const PICK = { walk: 8, turn: [0.04], jump: [0.42], punch: [0.5], kick: [0.5], hadouken: [0.55], block: [0.85], hurt: [0.25] };
export function marrowSheet(seed, opts = {}, placeholder = null) {
  const look = opts.look || null, g = opts.grit ?? gritFor(seed);
  const key = `${VER}|sheet|${seed}|${JSON.stringify(look)}|${opts.monsters ? 1 : 0}|${g}`;
  const mk = (src) => { const c = canvas(W0, H0); if (src) { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 6, 8, 24, 32); } return c; };
  const ph = placeholder || {};
  const walkCycle = Array.from({ length: 8 }, (_, i) => mk(ph.walk?.[i % 2] || ph.idle));
  const one = (n) => [mk(ph[n] || ph.idle)];
  const t = { walk: walkCycle, turn: one('idle'), jump: one('jump'), punch: one('punch'), kick: one('kick'), hadouken: one('special'), block: one('block'), hurt: one('hurt') };
  const ko = mk(ph.hurt || ph.idle);
  const sheet = { idle: t.turn[0], walk: [walkCycle[1], walkCycle[5]], walk1: walkCycle[1], walk2: walkCycle[5], walkCycle, jump: t.jump[0], punch: t.punch[0], kick: t.kick[0], special: t.hadouken[0], block: t.block[0], hurt: t.hurt[0], ko, outfit: 'marrow' };
  sheet.ready = fill(key, { seed, look, monsters: opts.monsters, W: W0, H: H0, anims: PICK, grit: g, shadow: false, anchorX: 0.5, scale: SCALE0 }, t).then((r) => {
    if (r) { sheet.outfit = r.outfit; const x = ko.getContext('2d'); x.clearRect(0, 0, W0, H0); x.save(); x.translate(W0 / 2, H0 - 3); x.rotate(-Math.PI / 2); x.scale(0.75, 0.75); x.drawImage(t.hurt[0], -12, -24); x.restore(); }
    return sheet;
  });
  return sheet;
}

// Full animations for the brawler: { name: [canvas…] } at a bigger size, with faces.
export function marrowAnims(seed, anims, opts = {}) {
  const size = opts.size || 64, look = opts.look || null, g = opts.grit ?? gritFor(seed);
  const key = `${VER}|anims|${seed}|${JSON.stringify(look)}|${size}|${JSON.stringify(anims)}|${g}`;
  const out = {};
  for (const [n, spec] of Object.entries(anims)) out[n] = Array.from({ length: Array.isArray(spec) ? spec.length : spec }, () => canvas(size, size));
  out.ready = fill(key, { seed, look, monsters: opts.monsters, W: size, H: size, anims, grit: g, face: opts.face !== false, shadow: false, scale: opts.scale || 0.34, anchorX: 0.5 }, { ...out }).then((r) => { if (r) out.meta = r.meta; return out; });
  return out;
}
