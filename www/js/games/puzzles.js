// Puzzles: 2048 (expectimax autopilot) and an arrows-escape board (always solvable).
import { Game, W, H, drawFit, ready, roundRect, rgbOf } from './engine.js';

const NO_MODS = ['mirror', 'wobble', 'lowg', 'heavy', 'giant', 'tiny', 'trails', 'swarm', 'glass'];
const mix = (a, b, k) => { const p = rgbOf(a), q = rgbOf(b); return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(',')})`; };
const lum = (a) => { const [r, g, b] = rgbOf(a); return (r * 0.299 + g * 0.587 + b * 0.114) / 255; };
const ease = (k) => 1 - (1 - k) * (1 - k);

// ================================================================ 2048
// rows are 16-bit ints of four 4-bit exponents, cell 0 in the low nibble
const ROWL = new Uint16Array(65536), ROWR = new Uint16Array(65536), RSC = new Float64Array(65536), HEUR = new Float64Array(65536);
const rev = (r) => ((r & 15) << 12) | (((r >> 4) & 15) << 8) | (((r >> 8) & 15) << 4) | (r >> 12);
for (let r = 0; r < 65536; r++) {
  const l = [r & 15, (r >> 4) & 15, (r >> 8) & 15, r >> 12];
  let sum = 0, empty = 0, merges = 0, prev = 0, cnt = 0, ml = 0, mr = 0;
  for (const v of l) { sum += Math.pow(v, 3.5); if (!v) empty++; else { if (prev === v) cnt++; else if (cnt) { merges += 1 + cnt; cnt = 0; } prev = v; } }
  if (cnt) merges += 1 + cnt;
  for (let i = 1; i < 4; i++) { if (l[i - 1] > l[i]) ml += Math.pow(l[i - 1], 4) - Math.pow(l[i], 4); else mr += Math.pow(l[i], 4) - Math.pow(l[i - 1], 4); }
  HEUR[r] = 200000 + 270 * empty + 700 * merges - 47 * Math.min(ml, mr) - 11 * sum;
  const t = l.filter((v) => v), o = []; let sc = 0;
  for (let i = 0; i < t.length; i++) { if (t[i] === t[i + 1] && t[i] < 15) { o.push(t[i] + 1); sc += 1 << (t[i] + 1); i++; } else o.push(t[i]); }
  while (o.length < 4) o.push(0);
  ROWL[r] = o[0] | (o[1] << 4) | (o[2] << 8) | (o[3] << 12); RSC[r] = sc;
}
for (let r = 0; r < 65536; r++) ROWR[r] = rev(ROWL[rev(r)]);
const toB = (g) => [0, 1, 2, 3].map((y) => g[y * 4] | (g[y * 4 + 1] << 4) | (g[y * 4 + 2] << 8) | (g[y * 4 + 3] << 12));
const tr = (b) => [0, 1, 2, 3].map((x) => [0, 1, 2, 3].reduce((s, y) => s | (((b[y] >> (x * 4)) & 15) << (y * 4)), 0));
function shift(b, d) { // 0 left 1 right 2 up 3 down
  const v = d >= 2 ? tr(b) : b, T = d === 0 || d === 2 ? ROWL : ROWR, o = v.map((r) => T[r]);
  return d >= 2 ? tr(o) : o;
}
const evalB = (b) => { const t = tr(b); return HEUR[b[0]] + HEUR[b[1]] + HEUR[b[2]] + HEUR[b[3]] + HEUR[t[0]] + HEUR[t[1]] + HEUR[t[2]] + HEUR[t[3]]; };
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
function chance(b, depth, p, memo) {
  if (depth <= 0 || p < 0.0002) return evalB(b);
  const key = b.join(',') + ':' + depth, m = memo.get(key);
  if (m !== undefined) return m;
  let tot = 0, n = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    if ((b[y] >> (x * 4)) & 15) continue;
    n++;
    for (const [e, q] of [[1, 0.9], [2, 0.1]]) { const nb = b.slice(); nb[y] |= e << (x * 4); tot += q * maxNode(nb, depth - 1, p * q, memo); }
  }
  const v = n ? tot / n : evalB(b);
  memo.set(key, v);
  return v;
}
function maxNode(b, depth, p, memo) {
  let best = 0;
  for (let d = 0; d < 4; d++) { const nb = shift(b, d); if (!same(nb, b)) best = Math.max(best, chance(nb, depth, p, memo)); }
  return best;
}
function bestMove(g) {
  const b = toB(g), distinct = new Set(g.filter((v) => v)).size, empty = g.filter((v) => !v).length;
  const depth = empty <= 3 && distinct >= 8 ? 3 : 2;
  let bd = -1, bv = -1; const memo = new Map();
  for (let d = 0; d < 4; d++) { const nb = shift(b, d); if (same(nb, b)) continue; const v = chance(nb, depth - 1, 1, memo); if (v > bv) { bv = v; bd = d; } }
  return bd;
}

export class Twenty48 extends Game {
  static noMods = NO_MODS;
  setup() { this.bestTile = 0; this.games = 0; this.icons = this.skin.list('tiles2048', 11, 'item', 'enemy', 'prop'); this.reset(); }
  reset() {
    this.cells = Array(16).fill(null); this.tiles = []; this.animT = 0; this.overT = 0; this.thinkT = 0.8; this.swipe = null; this.score = 0; this.moves = 0;
    this.spawn(); this.spawn();
  }
  spawn() {
    const free = this.cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
    if (!free.length) return;
    const i = free[Math.floor(this.rng() * free.length)], t = { v: this.rng() < 0.9 ? 1 : 2, i, from: i, grow: 0, pop: 0 };
    this.cells[i] = t; this.tiles.push(t);
  }
  grid() { return this.cells.map((t) => (t ? t.v : 0)); }
  canMove() { const b = toB(this.grid()); return [0, 1, 2, 3].some((d) => !same(shift(b, d), b)); }
  slide(d) {
    if (this.animT > 0 || this.overT) return false;
    this.finish();
    const at = (l, k) => (d === 0 ? l * 4 + k : d === 1 ? l * 4 + 3 - k : d === 2 ? k * 4 + l : (3 - k) * 4 + l);
    const nc = Array(16).fill(null); let moved = false;
    for (const t of this.tiles) t.from = t.i;
    for (let l = 0; l < 4; l++) {
      let k = 0, last = null;
      for (let j = 0; j < 4; j++) {
        const t = this.cells[at(l, j)];
        if (!t) continue;
        if (last && last.v === t.v && !last.merged) {
          t.i = last.i; t.dead = true; last.dead = true;
          const m = { v: t.v + 1, i: last.i, from: last.i, grow: 1, pop: 0, merged: true, late: true };
          nc[last.i] = m; this.tiles.push(m); last = m; this.score += 1 << m.v; moved = true;
        } else { const ni = at(l, k++); if (ni !== t.i) moved = true; t.i = ni; nc[ni] = t; last = t; }
      }
    }
    if (!moved) { for (const t of this.tiles) t.from = t.i; return false; }
    this.cells = nc; this.animT = 0.11; this.moves++;
    return true;
  }
  finish() {
    this.tiles = this.tiles.filter((t) => !t.dead);
    for (const t of this.tiles) { t.from = t.i; if (t.late) { t.late = false; t.pop = 1; } t.merged = false; }
  }
  step(dt) {
    for (const t of this.tiles) { t.grow = Math.max(0, t.grow - dt * 7); t.pop = Math.max(0, t.pop - dt * 6); }
    if (this.animT > 0 && (this.animT -= dt) <= 0) {
      this.animT = 0;
      for (const t of this.tiles) if (t.late) { const [x, y] = this.pos(t.i); this.burst(x, y, this.tileCol(t.v), t.v >= 7 ? 14 : 5, 90 + t.v * 10); if (t.v > this.bestTile) this.bestTile = t.v; }
      this.finish(); this.spawn();
      for (const t of this.tiles) if (t.v > this.bestTile) this.bestTile = t.v;
      if (!this.canMove()) this.overT = 3;
    }
    if (this.overT && (this.overT -= dt) <= 0) { this.overT = 0; this.games++; this.reset(); }
  }
  autopilot(dt) {
    if (this.animT > 0 || this.overT) return;
    if ((this.thinkT -= dt) > 0) return;
    const d = bestMove(this.grid());
    if (d >= 0) this.slide(d);
    this.thinkT = this.rng() < 0.04 ? this.r(0.8, 1.6) : this.r(0.12, 0.3);
  }
  down(x, y) { this.swipe = { x, y }; }
  up(x, y) {
    if (!this.swipe) return;
    const dx = x - this.swipe.x, dy = y - this.swipe.y; this.swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    this.slide(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : dy < 0 ? 2 : 3);
  }
  tap() {}
  pos(i) { const s = 70, g = 8, x0 = (W - (s * 4 + g * 5)) / 2 + g, y0 = 88 + g; return [x0 + (i % 4) * (s + g) + s / 2, y0 + Math.floor(i / 4) * (s + g) + s / 2]; }
  tileCol(v) {
    this.tc ||= {};
    if (this.tc[v]) return this.tc[v][0];
    const p = this.pal, base = p.c[(v - 1) % p.c.length], col = v <= 6 ? mix(base, p.bg, 0.12) : mix(base, '#fff', Math.min(0.55, (v - 6) * 0.11));
    return (this.tc[v] = [col, lum(col) > 0.55 ? p.bg : '#fff'])[0];
  }
  draw(c) {
    const p = this.pal, s = 70, g = 8, bw = s * 4 + g * 5, bx = (W - bw) / 2, by = 88;
    this.clear(c);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, 0, W, H);
    this.text(c, `${this.score}`, bx + 4, 70, 18, p.ink, 'left');
    this.text(c, `best ${1 << Math.max(1, this.bestTile)}`, bx + bw - 4, 70, 12, p.c[1], 'right');
    c.fillStyle = 'rgba(0,0,0,.35)'; roundRect(c, bx, by, bw, bw, 12); c.fill();
    for (let i = 0; i < 16; i++) { const [x, y] = this.pos(i); c.fillStyle = 'rgba(255,255,255,.07)'; roundRect(c, x - s / 2, y - s / 2, s, s, 8); c.fill(); }
    const k = ease(1 - this.animT / 0.11);
    for (const t of this.tiles) {
      if (t.late && this.animT > 0) continue;
      const [x1, y1] = this.pos(t.from), [x2, y2] = this.pos(t.i), x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k;
      const sc = (1 - t.grow) * (1 + Math.sin(t.pop * Math.PI) * 0.14), w = s * sc, col = this.tileCol(t.v);
      if (w < 1) continue;
      c.fillStyle = col; roundRect(c, x - w / 2, y - w / 2, w, w, 8 * sc); c.fill();
      c.fillStyle = 'rgba(255,255,255,.12)'; roundRect(c, x - w / 2, y - w / 2, w, w * 0.45, 8 * sc); c.fill();
      const ic = this.icons[(t.v - 1) % this.icons.length];
      if (ready(ic)) { c.globalAlpha = 0.9; drawFit(c, ic, x + w * 0.3, y - w * 0.3, w * 0.28, w * 0.28); c.globalAlpha = 1; }
      const n = 1 << t.v, str = `${n}`;
      this.text(c, str, x, y + 2, sc * (str.length <= 2 ? 30 : str.length === 3 ? 25 : str.length === 4 ? 20 : 16), this.tc[t.v][1]);
    }
    if (this.overT) {
      c.fillStyle = 'rgba(0,0,0,.6)'; roundRect(c, bx, by, bw, bw, 12); c.fill();
      this.text(c, 'NO MOVES', W / 2, by + bw / 2 - 12, 26, p.ink);
      this.text(c, `best tile ${1 << this.bestTile}`, W / 2, by + bw / 2 + 20, 13, p.c[1]);
    }
  }
  hud() { return `${this.score} · ${1 << Math.max(1, Math.max(...this.tiles.map((t) => t.v), 1))}`; }
}

// ================================================================ Arrows escape
// Arrows are snakes on a grid: a body of cells (tail first) whose head points straight ahead along its last step. Tapping
// one slides it out head first along its own body, then straight off the board; it is blocked if any cell ahead of the
// head, out to the edge, is taken. Boards are built by placing arrows in reverse removal order, so they can always be cleared.
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const bends = (cells) => cells.some((c, i) => i > 1 && (c[0] - cells[i - 1][0] !== cells[i - 1][0] - cells[i - 2][0] || c[1] - cells[i - 1][1] !== cells[i - 1][1] - cells[i - 2][1]));
// the track an arrow slides along (cell units): a short tail, the body with its bends rounded, then straight out past the board
function railOf(a, N) {
  const n = a.cells.length, [hx, hy] = a.cells[n - 1], [ux, uy] = n > 1 ? [a.cells[1][0] - a.cells[0][0], a.cells[1][1] - a.cells[0][1]] : [DX[a.d], DY[a.d]], far = N + n + 3;
  const raw = [[a.cells[0][0] - ux * 0.3, a.cells[0][1] - uy * 0.3], ...a.cells, [hx + DX[a.d] * far, hy + DY[a.d] * far]], p = [raw[0]], s = [0];
  const push = (x, y) => { const q = p[p.length - 1]; p.push([x, y]); s.push(s[s.length - 1] + Math.hypot(x - q[0], y - q[1])); };
  let head = 0;
  for (let i = 1; i < raw.length - 1; i++) {
    const [x, y] = raw[i], ix = Math.sign(x - raw[i - 1][0]), iy = Math.sign(y - raw[i - 1][1]), ox = Math.sign(raw[i + 1][0] - x), oy = Math.sign(raw[i + 1][1] - y);
    if (ix === ox && iy === oy) push(x, y);
    else for (let t = 0; t <= 6; t++) { const k = t / 6, m = (1 - k) * (1 - k), q = 2 * k * (1 - k), e = k * k; push(m * (x - ix * 0.34) + q * x + e * (x + ox * 0.34), m * (y - iy * 0.34) + q * y + e * (y + oy * 0.34)); }
    if (i === n) head = s[s.length - 1];
  }
  push(raw[raw.length - 1][0], raw[raw.length - 1][1]);
  return { p, s, head };
}
// the part of a track between two arc lengths, as points
function railSlice(R, s0, s1) {
  const { p, s } = R, at = (j, v) => { const t = (v - s[j]) / (s[j + 1] - s[j] || 1); return [p[j][0] + (p[j + 1][0] - p[j][0]) * t, p[j][1] + (p[j + 1][1] - p[j][1]) * t]; };
  let i = 0; while (i < s.length - 2 && s[i + 1] <= s0) i++;
  const out = [at(i, s0)];
  let j = i + 1; for (; j < s.length - 1 && s[j] < s1; j++) out.push(p[j]);
  out.push(at(j - 1, Math.min(s1, s[s.length - 1])));
  return out;
}
export class Arrows extends Game {
  static noMods = NO_MODS;
  setup() { this.level = 1; this.cleared = 0; this.newLevel(); }
  newLevel() {
    const N = this.N = Math.min(9, 4 + Math.ceil((this.level + 1) / 2));
    this.cs = Math.min(46, 316 / N); this.x0 = (W - this.cs * N) / 2; this.y0 = 76 + (316 - this.cs * N) / 2;
    this.hearts = 3; this.fly = []; this.bump = null; this.doneT = 0; this.failT = 0; this.thinkT = 1.2; this.shake = 0; this.lastPick = null;
    this.gen();
  }
  // a few boards, keep the one that takes the most rounds of peeling to clear (the deepest chains of blockers)
  gen() {
    const N = this.N;
    let best = null;
    for (let k = 0; k < 6 + Math.min(6, this.level); k++) {
      const b = this.build(N, this.level);
      if (!b.list.length || !this.solvable(b.list, b.occ)) continue;
      const score = this.rounds(b.list, b.occ) + (b.occ.reduce((s, v) => s + (v >= 0), 0) / (N * N)) * 8;
      if (!best || score > best.score) best = { ...b, score };
    }
    if (!best) { const occ = new Int16Array(N * N).fill(-1), c = (N >> 1) * N + (N >> 1); occ[c] = 0; best = { list: [{ cells: [[N >> 1, N >> 1]], d: 0, col: 0, id: 0 }], occ }; }
    this.arrows = best.list; this.occ = best.occ; this.total = best.list.length;
    for (const a of this.arrows) a.R = railOf(a, N);
  }
  // reverse placement: a new arrow only needs a clear run from its head to the edge among the arrows already down, so
  // lifting them off in the opposite order always works. Later arrows may lie across earlier ones' runs: those are the blockers.
  build(N, lv) {
    const occ = new Int16Array(N * N).fill(-1), lane = new Uint8Array(N * N), list = [], inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
    const runFree = (x, y, d) => { for (x += DX[d], y += DY[d]; inb(x, y); x += DX[d], y += DY[d]) if (occ[y * N + x] >= 0) return false; return true; };
    const pBend = Math.min(0.92, 0.35 + 0.08 * lv), maxLen = Math.min(7, 4 + (lv >> 1)), wb = Math.min(2.5, 0.6 + 0.25 * lv);
    const snake = (hx, hy, crook, cap) => {
      let fb = null;
      for (const d of [0, 1, 2, 3].filter((o) => runFree(hx, hy, o)).sort(() => this.rng() - 0.5)) {
        const len = crook ? 3 + Math.floor(this.rng() ** 1.5 * (Math.max(3, Math.min(maxLen, cap)) - 2)) : this.ri(1, Math.min(cap, 3 + (lv > 4 ? 1 : 0))), ahead = new Set(), seen = new Set([hy * N + hx]), body = [[hx, hy]];
        for (let x = hx + DX[d], y = hy + DY[d]; inb(x, y); x += DX[d], y += DY[d]) ahead.add(y * N + x);
        let dir = (d + 2) % 4;
        for (let k = 1; k < len; k++) {
          const [x, y] = body[body.length - 1], l = (dir + 3) % 4, r = (dir + 1) % 4;
          const opts = !crook || k === 1 ? [dir] : this.rng() < 0.55 ? (this.rng() < 0.5 ? [l, r, dir] : [r, l, dir]) : [dir, l, r];
          const nd = opts.find((o) => { const nx = x + DX[o], ny = y + DY[o], i = ny * N + nx; return inb(nx, ny) && occ[i] < 0 && !seen.has(i) && !ahead.has(i); });
          if (nd === undefined) break;
          dir = nd; body.push([x + DX[nd], y + DY[nd]]); seen.add((y + DY[nd]) * N + x + DX[nd]);
        }
        const a = { cells: body.reverse(), d };
        if (!crook || bends(a.cells)) return a;
        fb ||= a;
      }
      return fb;
    };
    const put = (a) => {
      a.id = list.length; a.col = this.ri(0, 5); list.push(a);
      for (const [x, y] of a.cells) occ[y * N + x] = a.id;
      const [hx, hy] = a.cells[a.cells.length - 1];
      for (let x = hx + DX[a.d], y = hy + DY[a.d]; inb(x, y); x += DX[a.d], y += DY[a.d]) lane[y * N + x]++;
    };
    // heads are tried from the middle outward (more jumbled on later levels)
    const order = [...Array(N * N).keys()].map((i) => { const x = i % N, y = (i / N) | 0; return [i, Math.min(x, y, N - 1 - x, N - 1 - y) + this.rng() * N * (0.3 + 0.04 * lv)]; }).sort((a, b) => b[1] - a[1]).map((o) => o[0]);
    for (const h of order) {
      if (occ[h] >= 0) continue;
      let best = null;
      for (let k = 0; k < (lv > 3 ? 6 : 4); k++) {
        const a = snake(h % N, (h / N) | 0, this.rng() < pBend, maxLen);
        if (!a) continue;
        a.sc = a.cells.reduce((s, [x, y]) => s + lane[y * N + x], 0) * wb + a.cells.length * 0.4 + this.rng() * 0.6;
        if (!best || a.sc > best.sc) best = a;
      }
      if (best) put(best);
    }
    for (const h of order) if (occ[h] < 0) { const a = snake(h % N, (h / N) | 0, lv > 1 && this.rng() < 0.4, 3); if (a) put(a); }
    return { list, occ };
  }
  // rounds of "take off everything that is free" needed to clear the board
  rounds(list, occ0) {
    const occ = occ0.slice(); let left = list.slice(), r = 0;
    while (left.length) {
      const free = left.filter((a) => !this.clearPath(a, occ));
      if (!free.length) return 99;
      for (const a of free) for (const [x, y] of a.cells) occ[y * this.N + x] = -1;
      left = left.filter((a) => !free.includes(a)); r++;
    }
    return r;
  }
  clearPath(a, occ) {
    const N = this.N, [hx, hy] = a.cells[a.cells.length - 1];
    for (let x = hx + DX[a.d], y = hy + DY[a.d]; x >= 0 && y >= 0 && x < N && y < N; x += DX[a.d], y += DY[a.d]) if (occ[y * N + x] >= 0 && occ[y * N + x] !== a.id) return [x, y];
    return null;
  }
  solvable(list, occ0) {
    const occ = occ0.slice(); let left = list.filter(Boolean), go = true;
    while (left.length && go) {
      go = false;
      left = left.filter((a) => { if (this.clearPath(a, occ)) return true; for (const [x, y] of a.cells) occ[y * this.N + x] = -1; go = true; return false; });
    }
    return !left.length;
  }
  live() { return this.arrows.filter((a) => a && !a.gone); }
  pick(a) {
    if (!a || this.bump || this.doneT || this.failT) return;
    const blk = this.clearPath(a, this.occ);
    if (!blk) {
      a.gone = true; for (const [x, y] of a.cells) this.occ[y * this.N + x] = -1;
      this.fly.push({ a, k: 0, v: 0, end: this.N + a.cells.length + 2.5 }); this.score += 10 * a.cells.length;
      if (!this.live().length) { this.doneT = 2.2; this.cleared++; this.score += 100 * this.level; }
    } else {
      const [hx, hy] = a.cells[a.cells.length - 1], dist = Math.abs(blk[0] - hx) + Math.abs(blk[1] - hy) - 1;
      this.bump = { a, k: 0, dist, blk: this.occ[blk[1] * this.N + blk[0]] };
      this.hearts--; this.shake = 0.3;
    }
  }
  step(dt) {
    this.shake = Math.max(0, this.shake - dt);
    for (const f of this.fly) { f.v += dt * 30; f.k += f.v * dt; }
    this.fly = this.fly.filter((f) => f.k < f.end);
    if (this.bump) {
      const b = this.bump; b.k += dt * 3.2;
      if (b.k >= 0.5 && !b.hit) { b.hit = true; const [hx, hy] = b.a.cells[b.a.cells.length - 1], [x, y] = this.cxy(hx + DX[b.a.d] * (b.dist + 0.5), hy + DY[b.a.d] * (b.dist + 0.5)); this.burst(x, y, '#ff5a4a', 10, 120); }
      if (b.k >= 1) { this.bump = null; if (this.hearts <= 0) this.failT = 2.2; }
    }
    if (this.doneT && (this.doneT -= dt) <= 0) { this.doneT = 0; this.level++; this.newLevel(); }
    if (this.failT && (this.failT -= dt) <= 0) { this.failT = 0; this.newLevel(); }
  }
  autopilot(dt) {
    if (this.bump || this.doneT || this.failT) return;
    if ((this.thinkT -= dt) > 0) return;
    const live = this.live(), free = live.filter((a) => !this.clearPath(a, this.occ));
    const oops = this.hearts > 1 && this.rng() < 0.04 ? live.filter((a) => this.clearPath(a, this.occ)) : [];
    const pool = oops.length ? oops : free, ref = this.lastPick, head = (a) => a.cells[a.cells.length - 1];
    let a = pool[Math.floor(this.rng() * pool.length)];
    if (ref && this.rng() < 0.6) { // people tend to carry on near where they just tapped
      const near = (o) => Math.hypot(head(o)[0] - head(ref)[0], head(o)[1] - head(ref)[1]);
      for (let k = 0; k < 2; k++) { const o = pool[Math.floor(this.rng() * pool.length)]; if (near(o) < near(a)) a = o; }
    }
    this.pick(a); this.lastPick = a;
    this.thinkT = (this.rng() < 0.08 ? this.r(1.4, 2.6) : this.r(0.35, 0.9)) * Math.max(0.55, Math.min(1, 14 / live.length));
  }
  cxy(x, y) { return [this.x0 + (x + 0.5) * this.cs, this.y0 + (y + 0.5) * this.cs]; }
  down(x, y) {
    const cx = Math.floor((x - this.x0) / this.cs), cy = Math.floor((y - this.y0) / this.cs);
    if (cx < 0 || cy < 0 || cx >= this.N || cy >= this.N) return;
    const id = this.occ[cy * this.N + cx];
    if (id >= 0) this.pick(this.arrows[id]);
  }
  // off = how far the arrow has slid along its track (in cells)
  drawArrow(c, a, off, alpha = 1, hot = false) {
    const cs = this.cs, w = cs * (a.cells.length > 1 ? 0.24 : 0.27), pts = railSlice(a.R, off, off + a.R.head + 0.05).map(([x, y]) => this.cxy(x, y));
    const col = hot ? '#ff5a4a' : this.col(a.col), [bx, by] = pts[pts.length - 1], dx = DX[a.d], dy = DY[a.d], hw = cs * 0.3;
    c.globalAlpha = alpha; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = w + 3; c.stroke();
    c.strokeStyle = col; c.lineWidth = w; c.stroke();
    c.beginPath(); c.moveTo(bx + dx * cs * 0.3, by + dy * cs * 0.3); c.lineTo(bx - dy * hw, by + dx * hw); c.lineTo(bx + dy * hw, by - dx * hw); c.closePath();
    c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 3; c.stroke(); c.fill();
    c.globalAlpha = 1;
  }
  draw(c) {
    const p = this.pal, N = this.N, cs = this.cs;
    this.clear(c);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, 0, W, H);
    this.text(c, `LEVEL ${this.level}`, this.x0, 64, 14, p.ink, 'left');
    for (let i = 0; i < 3; i++) this.text(c, '♥', this.x0 + cs * N - 6 - i * 20, 64, 18, i < this.hearts ? '#ff5a4a' : 'rgba(255,255,255,.18)', 'right');
    c.save();
    if (this.shake) c.translate(Math.sin(this.t * 90) * this.shake * 14, 0);
    c.fillStyle = 'rgba(0,0,0,.32)'; roundRect(c, this.x0 - 6, this.y0 - 6, cs * N + 12, cs * N + 12, 10); c.fill();
    c.fillStyle = 'rgba(255,255,255,.08)';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const [px, py] = this.cxy(x, y); c.beginPath(); c.arc(px, py, 2, 0, Math.PI * 2); c.fill(); }
    const b = this.bump;
    for (const a of this.arrows) if (a && !a.gone) {
      const off = b && b.a === a ? Math.sin(Math.min(1, b.k) * Math.PI) * (b.dist + 0.25) : 0;
      this.drawArrow(c, a, off, 1, (b && b.a === a) || (b && b.hit && b.blk === a.id && b.k < 0.9));
    }
    for (const f of this.fly) this.drawArrow(c, f.a, f.k, Math.max(0, 1 - f.k / f.end));
    c.restore();
    const msg = this.doneT ? 'CLEARED!' : this.failT ? 'OUT OF HEARTS' : null;
    if (msg) { c.fillStyle = 'rgba(0,0,0,.7)'; roundRect(c, W / 2 - 120, 210, 240, 50, 12); c.fill(); this.text(c, msg, W / 2, 235, 20, this.doneT ? p.c[1] : '#ff7a6a'); }
    else this.text(c, `${this.live().length} left`, W / 2, H - 14, 11, 'rgba(255,255,255,.5)');
  }
  hud() { return `${this.score} · lv ${this.level}`; }
}
