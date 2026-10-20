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
    if (this.tc[v]) return this.tc[v];
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
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export class Arrows extends Game {
  static noMods = NO_MODS;
  setup() { this.level = 1; this.cleared = 0; this.newLevel(); }
  newLevel() {
    const N = this.N = Math.min(9, 4 + this.level);
    this.cs = Math.min(46, 316 / N); this.x0 = (W - this.cs * N) / 2; this.y0 = 76 + (316 - this.cs * N) / 2;
    this.hearts = 3; this.fly = []; this.bump = null; this.doneT = 0; this.failT = 0; this.thinkT = 1.2; this.shake = 0;
    for (let tries = 0; tries < 6; tries++) { this.gen(); if (this.arrows.length >= N * N * 0.25) break; }
  }
  gen() {
    const N = this.N, occ = new Int16Array(N * N).fill(-1), list = [];
    const order = [...Array(N * N).keys()];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const h of order) {
      if (occ[h] >= 0) continue;
      const hx = h % N, hy = Math.floor(h / N), dirs = [0, 1, 2, 3].sort(() => this.rng() - 0.5);
      const lens = this.rng() < 0.35 ? [3, 2, 1] : this.rng() < 0.6 ? [2, 1] : [1, 2];
      let ok = false;
      for (const len of lens) {
        for (const d of dirs) {
          const cells = [];
          for (let k = len - 1; k >= 0; k--) { const x = hx - DX[d] * k, y = hy - DY[d] * k; if (x < 0 || y < 0 || x >= N || y >= N || occ[y * N + x] >= 0) { cells.length = 0; break; } cells.push([x, y]); }
          if (!cells.length) continue;
          const a = { cells, d, col: this.ri(0, 5), id: list.length };
          list.push(a); for (const [x, y] of cells) occ[y * N + x] = a.id;
          if (this.solvable(list, occ)) { ok = true; break; }
          list.pop(); for (const [x, y] of cells) occ[y * N + x] = -1;
        }
        if (ok) break;
      }
    }
    this.arrows = list; this.occ = occ; this.total = list.length;
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
      this.fly.push({ a, k: 0, v: 0 }); this.score += 10 * a.cells.length;
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
    this.fly = this.fly.filter((f) => f.k < this.N + 4);
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
    const pool = oops.length ? oops : free;
    this.pick(pool[Math.floor(this.rng() * pool.length)]);
    this.thinkT = this.rng() < 0.08 ? this.r(1.4, 2.6) : this.r(0.35, 0.9);
  }
  cxy(x, y) { return [this.x0 + (x + 0.5) * this.cs, this.y0 + (y + 0.5) * this.cs]; }
  down(x, y) {
    const cx = Math.floor((x - this.x0) / this.cs), cy = Math.floor((y - this.y0) / this.cs);
    if (cx < 0 || cy < 0 || cx >= this.N || cy >= this.N) return;
    const id = this.occ[cy * this.N + cx];
    if (id >= 0) this.pick(this.arrows[id]);
  }
  drawArrow(c, a, off, alpha = 1, hot = false) {
    const cs = this.cs, w = cs * 0.26, [tx, ty] = a.cells[0], [hx, hy] = a.cells[a.cells.length - 1];
    const ox = DX[a.d] * off * cs, oy = DY[a.d] * off * cs;
    const [x1, y1] = this.cxy(tx, ty), [x2, y2] = this.cxy(hx, hy);
    const ax = x1 + ox - DX[a.d] * cs * 0.3, ay = y1 + oy - DY[a.d] * cs * 0.3, bx = x2 + ox + DX[a.d] * cs * 0.05, by = y2 + oy + DY[a.d] * cs * 0.05;
    const col = hot ? '#ff5a4a' : this.col(a.col);
    c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    const px = -DY[a.d], py = DX[a.d], tipx = bx + DX[a.d] * cs * 0.3, tipy = by + DY[a.d] * cs * 0.3, hw = cs * 0.3;
    c.fillStyle = col; c.beginPath(); c.moveTo(tipx, tipy); c.lineTo(bx + px * hw, by + py * hw); c.lineTo(bx - px * hw, by - py * hw); c.closePath(); c.fill();
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
    for (const f of this.fly) this.drawArrow(c, f.a, f.k, Math.max(0, 1 - f.k / (N + 3)));
    c.restore();
    const msg = this.doneT ? 'CLEARED!' : this.failT ? 'OUT OF HEARTS' : null;
    if (msg) { c.fillStyle = 'rgba(0,0,0,.7)'; roundRect(c, W / 2 - 120, 210, 240, 50, 12); c.fill(); this.text(c, msg, W / 2, 235, 20, this.doneT ? p.c[1] : '#ff7a6a'); }
    else this.text(c, `${this.live().length} left`, W / 2, H - 14, 11, 'rgba(255,255,255,.5)');
  }
  hud() { return `${this.score} · lv ${this.level}`; }
}
