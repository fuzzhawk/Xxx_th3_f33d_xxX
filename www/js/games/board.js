// Board and card games: chess, dice (Yacht), and a Balatro-style poker roguelike.
import { Game, W, H, roundRect, drawFit } from './engine.js';
import { creatureName } from './creature.js';

// ================================================================ Chess
const VAL = { p: 100, n: 310, b: 330, r: 500, q: 900, k: 20000 };
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const isW = (p) => p && p === p.toUpperCase();
const START = 'rnbqkbnrpppppppp' + '.'.repeat(32) + 'PPPPPPPPRNBQKBNR';

function chessMoves(s, white, legal = true) {
  const out = [], b = s.b;
  const add = (from, to, promo) => out.push({ from, to, promo });
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p === '.' || isW(p) !== white) continue;
    const t = p.toLowerCase(), r = i >> 3, c = i & 7;
    const enemy = (j) => b[j] !== '.' && isW(b[j]) !== white;
    const ray = (dirs, slide) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const j = rr * 8 + cc;
          if (b[j] === '.') add(i, j); else { if (enemy(j)) add(i, j); break; }
          if (!slide) break;
          rr += dr; cc += dc;
        }
      }
    };
    if (t === 'p') {
      const d = white ? -8 : 8, start = white ? 6 : 1, last = white ? 0 : 7;
      if (b[i + d] === '.') { add(i, i + d, ((i + d) >> 3) === last); if (r === start && b[i + 2 * d] === '.') add(i, i + 2 * d); }
      for (const dc of [-1, 1]) { const cc = c + dc; if (cc < 0 || cc > 7) continue; const j = i + d + dc; if (enemy(j) || j === s.ep) add(i, j, (j >> 3) === last); }
    } else if (t === 'n') ray([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]], false);
    else if (t === 'b') ray([[1, 1], [1, -1], [-1, 1], [-1, -1]], true);
    else if (t === 'r') ray([[1, 0], [-1, 0], [0, 1], [0, -1]], true);
    else if (t === 'q') ray([[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]], true);
    else if (t === 'k') {
      ray([[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]], false);
      const row = white ? 56 : 0;
      if (legal && i === row + 4 && !attacked(s, i, !white)) {
        if (s.castle.includes(white ? 'K' : 'k') && b[row + 5] === '.' && b[row + 6] === '.' && !attacked(s, row + 5, !white)) add(i, row + 6);
        if (s.castle.includes(white ? 'Q' : 'q') && b[row + 3] === '.' && b[row + 2] === '.' && b[row + 1] === '.' && !attacked(s, row + 3, !white)) add(i, row + 2);
      }
    }
  }
  if (!legal) return out;
  return out.filter((m) => { const n = applyMove(s, m); return !attacked(n, n.b.indexOf(white ? 'K' : 'k'), !white); });
}
function attacked(s, sq, byWhite) { return chessMoves({ ...s, castle: '' }, byWhite, false).some((m) => m.to === sq); }
function applyMove(s, m) {
  const b = s.b.slice(), p = b[m.from], white = isW(p);
  let ep = -1, castle = s.castle;
  if (p.toLowerCase() === 'p' && m.to === s.ep) b[m.to + (white ? 8 : -8)] = '.';
  if (p.toLowerCase() === 'p' && Math.abs(m.to - m.from) === 16) ep = (m.to + m.from) / 2;
  if (p.toLowerCase() === 'k' && Math.abs(m.to - m.from) === 2) { const row = m.from & 56; if (m.to > m.from) { b[row + 5] = b[row + 7]; b[row + 7] = '.'; } else { b[row + 3] = b[row]; b[row] = '.'; } }
  if (p === 'K') castle = castle.replace(/[KQ]/g, ''); if (p === 'k') castle = castle.replace(/[kq]/g, '');
  for (const [sq, ch] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.from === sq || m.to === sq) castle = castle.replace(ch, '');
  b[m.to] = m.promo ? (white ? 'Q' : 'q') : p; b[m.from] = '.';
  return { b, ep, castle, white: !s.white };
}
function evaluate(s, jitter) {
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i]; if (p === '.') continue;
    const t = p.toLowerCase(), r = i >> 3, c = i & 7, w = isW(p);
    let x = VAL[t];
    const center = 3.5 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c));
    if (t === 'n' || t === 'b') x += center * 8;
    if (t === 'p') x += (w ? 6 - r : r - 1) * 6 + center * 3;
    if (t === 'q') x += center * 2;
    v += w ? x : -x;
  }
  return v + jitter;
}
function search(s, depth, alpha, beta, rng) {
  const moves = chessMoves(s, s.white);
  if (!moves.length) return { v: attacked(s, s.b.indexOf(s.white ? 'K' : 'k'), !s.white) ? (s.white ? -1e6 : 1e6) : 0 };
  if (depth === 0) return { v: evaluate(s, (rng() - 0.5) * 12) };
  moves.sort((a, b) => (s.b[b.to] !== '.' ? VAL[s.b[b.to].toLowerCase()] : 0) - (s.b[a.to] !== '.' ? VAL[s.b[a.to].toLowerCase()] : 0));
  let best = null;
  for (const m of moves) {
    const v = search(applyMove(s, m), depth - 1, alpha, beta, rng).v;
    if (s.white ? v > (best?.v ?? -Infinity) : v < (best?.v ?? Infinity)) best = { v, m };
    if (s.white) alpha = Math.max(alpha, v); else beta = Math.min(beta, v);
    if (beta <= alpha) break;
  }
  return best;
}
export class Chess extends Game {
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'trails', 'swarm', 'glass', 'giant', 'tiny'];
  setup() { this.newGame(); this.wins = [0, 0]; }
  newGame() { this.s = { b: START.split(''), ep: -1, castle: 'KQkq', white: true }; this.sel = -1; this.legal = []; this.wait = 0.8; this.plies = 0; this.lastMove = null; this.msg = ''; this.over = 0; }
  think() {
    const r = search(this.s, this.plies < 6 ? 1 : 2, -Infinity, Infinity, this.rng);
    if (!r?.m) return this.finish();
    this.play(r.m);
  }
  play(m) {
    const cap = this.s.b[m.to] !== '.';
    this.s = applyMove(this.s, m); this.lastMove = m; this.plies++;
    if (cap) { this.score += 10; const x = (m.to & 7) * 42 + 12 + 21, y = (m.to >> 3) * 42 + 40 + 21; this.burst(x, y, this.col(0), 8, 80); }
    if (!chessMoves(this.s, this.s.white).length || this.plies > 160) this.finish();
  }
  finish() {
    const moves = chessMoves(this.s, this.s.white);
    const mate = !moves.length && attacked(this.s, this.s.b.indexOf(this.s.white ? 'K' : 'k'), !this.s.white);
    this.msg = mate ? `${this.s.white ? 'Black' : 'White'} wins` : 'Draw';
    if (mate) this.wins[this.s.white ? 1 : 0]++;
    this.over = 2.5;
  }
  autopilot(dt) { if (this.over) return; this.wait -= dt; if (this.wait <= 0) { this.think(); this.wait = this.r(0.4, 0.9); } }
  step(dt) {
    if (this.over) { this.over -= dt; if (this.over <= 0) this.newGame(); return; }
    if (!this.auto && !this.s.white) { this.wait -= dt; if (this.wait <= 0) { this.think(); this.wait = 0.4; } }
  }
  down(x, y) {
    if (this.auto || this.over || !this.s.white) return;
    const c = Math.floor((x - 12) / 42), r = Math.floor((y - 40) / 42);
    if (c < 0 || c > 7 || r < 0 || r > 7) return;
    const sq = r * 8 + c;
    const mv = this.legal.find((m) => m.to === sq);
    if (mv) { this.play(mv); this.sel = -1; this.legal = []; this.wait = 0.5; return; }
    if (isW(this.s.b[sq])) { this.sel = sq; this.legal = chessMoves(this.s, true).filter((m) => m.from === sq); }
    else { this.sel = -1; this.legal = []; }
  }
  tap(x, y) { this.down(x, y); }
  draw(c) {
    this.clear(c);
    const ox = 12, oy = 40, S = 42;
    for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) {
      const sq = r * 8 + k;
      c.fillStyle = (r + k) % 2 ? this.col(5) : this.pal.c[4];
      c.globalAlpha = (r + k) % 2 ? 0.85 : 0.9;
      c.fillRect(ox + k * S, oy + r * S, S, S);
      if (this.lastMove && (sq === this.lastMove.from || sq === this.lastMove.to)) { c.fillStyle = this.col(1); c.globalAlpha = 0.45; c.fillRect(ox + k * S, oy + r * S, S, S); }
      if (sq === this.sel) { c.fillStyle = this.col(0); c.globalAlpha = 0.5; c.fillRect(ox + k * S, oy + r * S, S, S); }
      c.globalAlpha = 1;
      const p = this.s.b[sq];
      if (p !== '.') {
        c.font = '34px "DejaVu Sans", "Noto Sans Symbols 2", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const g = GLYPH[p.toLowerCase()], cx = ox + k * S + S / 2, cy = oy + r * S + S / 2 + 2;
        c.lineWidth = 3; c.strokeStyle = isW(p) ? '#1a1410' : '#f4ead9'; c.strokeText(g, cx, cy);
        c.fillStyle = isW(p) ? '#fff6e8' : '#1a1410'; c.fillText(g, cx, cy);
      }
    }
    for (const m of this.legal) { const cx = ox + (m.to & 7) * S + S / 2, cy = oy + (m.to >> 3) * S + S / 2; c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(cx, cy, 7, 0, 7); c.fill(); }
    this.text(c, this.over ? this.msg : `${this.s.white ? 'White' : 'Black'} to move`, W / 2, oy + 8 * S + 22, 14);
    this.text(c, `W ${this.wins[0]} · B ${this.wins[1]}`, W / 2, oy + 8 * S + 42, 11, this.col(4));
  }
  hud() { return `move ${Math.ceil(this.plies / 2)}`; }
}

// ================================================================ Dice (Yacht)
const CATS = [['1s', (d) => sum(d.filter((x) => x === 1))], ['2s', (d) => sum(d.filter((x) => x === 2))], ['3s', (d) => sum(d.filter((x) => x === 3))], ['4s', (d) => sum(d.filter((x) => x === 4))], ['5s', (d) => sum(d.filter((x) => x === 5))], ['6s', (d) => sum(d.filter((x) => x === 6))],
  ['3 kind', (d) => (maxCount(d) >= 3 ? sum(d) : 0)], ['4 kind', (d) => (maxCount(d) >= 4 ? sum(d) : 0)], ['Full house', (d) => { const c = counts(d).filter(Boolean).sort(); return c.length === 2 && c[0] === 2 ? 25 : 0; }],
  ['Sm straight', (d) => (['1234', '2345', '3456'].some((s) => s.split('').every((x) => d.includes(+x))) ? 30 : 0)], ['Lg straight', (d) => (['12345', '23456'].includes([...new Set(d)].sort().join('')) ? 40 : 0)],
  ['Yacht', (d) => (maxCount(d) === 5 ? 50 : 0)], ['Chance', (d) => sum(d)]];
const sum = (a) => a.reduce((s, x) => s + x, 0);
const counts = (d) => [0, 1, 2, 3, 4, 5, 6].map((v) => d.filter((x) => x === v).length);
const maxCount = (d) => Math.max(...counts(d));
// The cup sits upside down at the left, hiding the dice. Rolling slides the loose dice under it, flips it upright,
// shakes it (rattle), tips it over to spill the dice, and it rolls back over onto its mouth. Held dice stay put.
const SLOT = (i) => 122 + i * 50, SY = 112, HX = 52, HY = 112, CL = 76, CM = 29, CB = 21, A_TIP = 2.35, ZH = 34;
const easeIO = (k) => k * k * (3 - 2 * k), easeOut = (k) => 1 - (1 - k) * (1 - k);
export class Dice extends Game {
  static noAuto = true;
  static noMods = ['mirror', 'wobble', 'swarm', 'glass', 'trails'];
  setup() { this.best = 0; this.cup = { ph: 'idle', k: 0, x: HX, y: HY, a: Math.PI, T: 0.6 }; this.dice = null; this.sweep = []; this.newGame(); }
  newGame() { this.card = CATS.map(() => null); this.round = 0; this.msg = ''; this.newTurn(); this.total = 0; this.score = 0; }
  newTurn() {
    // last turn's dice are scooped back under the cup; the new ones wait there, unseen
    this.sweep = (this.dice || []).filter((d) => !d.hid).map((d) => ({ x: d.x, y: d.y, v: d.v, k: 0, sx: d.x, sy: d.y, z: 0, sc: 1, rot: 0 }));
    this.dice = Array.from({ length: 5 }, () => ({ v: 1 + this.ri(0, 5), held: false, x: HX, y: HY, z: 0, rot: 0, rolling: 0, hid: true, sc: 1 }));
    this.rolls = 0; this.wait = 0.6; this.picked = false; this.msg = this.msg || '';
  }
  busy() { return this.cup.ph !== 'idle' || this.dice.some((d) => d.rolling > 0); }
  roll() {
    if (this.rolls >= 3 || this.busy() || this.dice.every((d) => d.held)) return;
    this.rolls++; this.picked = false; this.msg = '';
    const c = this.cup, loose = this.dice.filter((d) => !d.held && !d.hid);
    loose.forEach((d, j) => { d.into = true; d.sx = d.x; d.sy = d.y; d.lag = j * 0.07; });
    c.ph = loose.length ? 'gather' : 'flip'; c.k = 0; c.T = this.r(0.5, 0.75);
  }
  spill() {
    const c = this.cup, mx = c.x + CL / 2 * Math.sin(c.a), my = c.y - CL / 2 * Math.cos(c.a), zs = Math.min(2, 1 / Math.sqrt(this.G));
    this.dice.map((d, i) => [d, i]).filter(([d]) => d.hid).sort((a, b) => b[1] - a[1]).forEach(([d, i], j) => {
      Object.assign(d, { sx: mx, sy: my + ZH * zs, tx: SLOT(i), ty: SY, age: -j * 0.07, T: this.r(0.55, 0.75) + (SLOT(i) - mx) / 900, zs, rolling: 1, rot0: (this.rng() < 0.5 ? -1 : 1) * this.r(5, 11), fv: 1 + this.ri(0, 5) });
    });
    this.burst(mx, my, this.col(4), 6, 60);
  }
  scoreCat(i) {
    if (this.card[i] !== null || this.rolls === 0 || this.busy()) return;
    const v = CATS[i][1](this.dice.map((d) => d.v));
    this.card[i] = v;
    this.total = sum(this.card.map((x) => x || 0)) + (sum(this.card.slice(0, 6).map((x) => x || 0)) >= 63 ? 35 : 0);
    this.score = this.total;
    this.round++;
    if (this.round >= CATS.length) { this.best = Math.max(this.best, this.total); this.over = 3; this.msg = `${CATS[i][0]}: +${v}`; } else { this.msg = ''; this.newTurn(); this.msg = `${CATS[i][0]}: +${v}`; }
  }
  // simple strategy: chase the most common face, or a straight when four are in a row
  autopilot(dt) {
    if (this.over || this.busy()) return;
    this.wait -= dt; if (this.wait > 0) return;
    const d = this.dice.map((x) => x.v);
    if (this.rolls === 0) { this.wait = this.r(0.4, 0.8); return this.roll(); }
    const options = CATS.map((c, i) => [i, this.card[i] === null ? c[1](d) : -1]).filter(([, v]) => v >= 0);
    const bestNow = options.sort((a, b) => b[1] - a[1])[0];
    const score = () => { const pick = bestNow[1] > 0 ? bestNow : options.sort((a, b) => [12, 0, 1, 11].indexOf(b[0]) - [12, 0, 1, 11].indexOf(a[0]))[0] || bestNow; this.wait = this.r(0.6, 1); return this.scoreCat(pick[0]); };
    if (this.rolls === 3 || (bestNow && bestNow[1] >= 30)) return score();
    if (!this.picked) {
      const cs = counts(d), face = cs.lastIndexOf(Math.max(...cs));
      const uniq = [...new Set(d)].sort();
      const straightish = uniq.length >= 4 && uniq[3] - uniq[0] === 3 && (this.card[9] === null || this.card[10] === null);
      this.dice.forEach((x, i) => (x.held = straightish ? uniq.includes(x.v) && d.indexOf(x.v) === i : x.v === face));
      if (this.dice.every((x) => x.held)) return score();
      this.picked = true; this.wait = this.r(0.45, 0.8); return;
    }
    this.wait = this.r(0.3, 0.6); this.roll();
  }
  down(x, y) {
    if (this.auto || this.over) return;
    if (y < 175) {
      const d = this.rolls && !this.busy() && this.dice.find((d) => !d.hid && Math.abs(d.x - x) < 26 && Math.abs(d.y - y) < 30);
      if (d) d.held = !d.held; else if (Math.abs(x - HX) < 40 && Math.abs(y - HY) < 46) this.roll();
      return;
    }
    if (y < 210) { this.roll(); return; }
    const col = x < W / 2 ? 0 : 1, row = Math.floor((y - 214) / 28), i = col * 7 + row;
    if (row >= 0 && i < CATS.length) this.scoreCat(i);
  }
  tap(x, y) { this.down(x, y); }
  stepCup(dt) {
    const c = this.cup, P = Math.PI;
    if (c.ph === 'idle') return;
    c.k += dt;
    if (c.ph === 'gather') {
      const k = Math.min(1, c.k / 0.32);
      for (const d of this.dice) if (d.into) {
        const q = easeIO(Math.max(0, Math.min(1, (k - d.lag) / (1 - d.lag))));
        d.x = d.sx + (HX - d.sx) * q; d.y = d.sy + (HY + 14 - d.sy) * q; d.z = 18 * Math.sin(q * P); d.sc = 1 - 0.3 * q;
        if (q >= 1) { d.hid = true; d.into = false; d.sc = 1; d.z = 0; d.held = false; }
      }
      if (k >= 1 && !this.dice.some((d) => d.into)) { c.ph = 'flip'; c.k = 0; }
    } else if (c.ph === 'flip') {
      const k = Math.min(1, c.k / 0.26);
      c.a = P + P * easeIO(k); c.x = HX; c.y = HY - 22 * Math.sin(k * P);
      if (k >= 1) { c.ph = 'shake'; c.k = 0; }
    } else if (c.ph === 'shake') {
      const t = c.k;
      c.a = 2 * P + Math.sin(t * 72) * 0.17; c.x = HX + Math.sin(t * 97) * 5 + Math.sin(t * 41) * 2; c.y = HY - 12 + Math.sin(t * 83) * 4;
      if (this.rng() < dt * 14) this.burst(c.x + this.r(-10, 10), c.y - CL / 2, '#fff', 1, 45);
      if (t >= c.T) { c.ph = 'tip'; c.k = 0; c.spilled = false; }
    } else if (c.ph === 'tip') {
      const k = Math.min(1, c.k / 0.5), e = easeIO(k);
      c.a = 2 * P + A_TIP * e; c.x = HX + 14 * e; c.y = HY - 12 + 8 * e;
      if (!c.spilled && k >= 0.58) { c.spilled = true; this.spill(); }
      if (k >= 1) { c.ph = 'settle'; c.k = 0; }
    } else if (c.ph === 'settle') {
      const k = Math.min(1, c.k / 0.36), e = easeOut(k);
      c.a = 2 * P + A_TIP + (P - A_TIP) * e; c.x = HX + 14 * (1 - e); c.y = HY - 4 * (1 - e);
      if (k >= 1) { c.ph = 'idle'; c.a = P; c.x = HX; c.y = HY; }
    }
  }
  step(dt) {
    if (this.over) { this.over -= dt; if (this.over <= 0) this.newGame(); return; }
    this.stepCup(dt);
    for (const s of this.sweep) { s.k += dt / 0.4; const q = easeIO(Math.min(1, s.k)); s.x = s.sx + (HX - s.sx) * q; s.y = s.sy + (HY + 14 - s.sy) * q; s.z = 16 * Math.sin(q * Math.PI); s.sc = 1 - 0.3 * q; }
    this.sweep = this.sweep.filter((s) => s.k < 1);
    for (const d of this.dice) {
      if (d.pop > 0) { d.pop -= dt; d.sc = 1 + 0.16 * Math.sin(Math.max(0, d.pop) / 0.18 * Math.PI); }
      if (d.rolling <= 0) continue;
      d.age += dt;
      if (d.age < 0) continue;
      d.hid = false;
      const k = Math.min(1, d.age / d.T), e = 1 - (1 - k) ** 2.2;
      d.x = d.sx + (d.tx - d.sx) * e; d.y = d.sy + (d.ty - d.sy) * e;
      d.z = ZH * d.zs * (1 - k) ** 2 * Math.abs(Math.cos(2 * Math.PI * (0.85 * k + 0.7 * k * k)));
      d.rot = d.rot0 * (1 - k) ** 2;
      if (k < 0.8 && this.rng() < dt * 22) d.v = 1 + this.ri(0, 5);
      if (k >= 1) { d.rolling = 0; d.v = d.fv; d.z = 0; d.rot = 0; d.x = d.tx; d.y = d.ty; d.pop = 0.18; this.burst(d.x, d.y + 16, 'rgba(255,255,255,.6)', 3, 40); }
    }
  }
  drawDie(c, d) {
    const s = 42 * (d.sc || 1), held = d.held && !d.into, lift = held ? 5 : 0;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(d.x + 3, d.y + 5 + 14, s * 0.46 * (1 - d.z / 120), s * 0.16, 0, 0, 7); c.fill();
    c.save(); c.translate(d.x, d.y - d.z - lift); c.rotate(d.rot);
    c.fillStyle = held ? this.col(0) : '#f6efe4'; roundRect(c, -s / 2, -s / 2, s, s, 9); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = held ? '#fff' : '#1a1410';
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[d.v];
    for (const [a, b] of P) { c.beginPath(); c.arc(a * s * 0.26, b * s * 0.26, s * 0.1, 0, 7); c.fill(); }
    c.restore();
    if (held) this.text(c, 'HOLD', d.x, d.y + 32, 9, this.col(0));
  }
  drawCup(c) {
    const { x, y, a, ph } = this.cup, h = CL / 2, lift = Math.max(0, HY - y), up = Math.cos(a) > -0.3;
    // the shadow stays on the table while the cup lifts
    c.fillStyle = `rgba(0,0,0,${0.3 * (1 - Math.min(1, lift / 40))})`; c.beginPath(); c.ellipse(HX + 4, HY + h + 3, CM + 5, 7, 0, 0, 7); c.fill();
    c.save(); c.translate(x, y); c.rotate(a);
    const leather = '#7b4a2c', trace = () => { c.beginPath(); c.moveTo(-CM, -h); c.quadraticCurveTo(-(CB + CM) / 2 - 2, 0, -CB, h); c.lineTo(CB, h); c.quadraticCurveTo((CB + CM) / 2 + 2, 0, CM, -h); c.closePath(); };
    c.fillStyle = leather; trace(); c.fill();
    c.beginPath(); c.ellipse(0, h, CB, 5, 0, 0, 7); c.ellipse(0, -h, CM, 6, 0, 0, 7); c.fill();
    c.save(); trace(); c.clip();
    const g = c.createLinearGradient(-CM, 0, CM, 0);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(0.22, 'rgba(255,255,255,.26)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.82, 'rgba(0,0,0,.14)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = g; c.fillRect(-CM - 2, -h - 8, CM * 2 + 4, CL + 16);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(-CM - 2, -h, CM * 2 + 4, 10);
    c.restore();
    c.strokeStyle = this.col(1); c.lineWidth = 2; c.globalAlpha = 0.9;
    c.beginPath(); c.moveTo(-CM + 0.5, -h + 10); c.lineTo(CM - 0.5, -h + 10); c.moveTo(-CB - 1.5, h - 9); c.lineTo(CB + 1.5, h - 9); c.stroke();
    c.globalAlpha = 1; c.strokeStyle = 'rgba(255,235,200,.4)'; c.lineWidth = 1.2; c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(-CM * 0.42, -h + 16); c.lineTo(-CB * 0.42, h - 14); c.stroke(); c.setLineDash([]);
    // the face that points up: the dark mouth when the cup is upright, the leather base when it is upside down
    c.beginPath(); c.ellipse(0, up ? -h : h, up ? CM : CB, up ? 6 : 5, 0, 0, 7);
    c.fillStyle = up ? 'rgba(18,10,6,.92)' : '#8a5834'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.2; c.stroke();
    c.restore();
    if (ph === 'shake') {
      // rattle marks either side of the cup
      c.strokeStyle = this.pal.ink; c.lineWidth = 2; c.lineCap = 'round';
      const f = Math.floor(this.t * 26) % 2;
      for (const s of [-1, 1]) for (let r = 0; r < 2; r++) { c.globalAlpha = 0.6 - r * 0.2; c.beginPath(); c.arc(x, y, 50 + r * 9 + f * 4, s > 0 ? -0.5 : Math.PI - 0.5 + 0.0, s > 0 ? 0.5 : Math.PI + 0.5); c.stroke(); }
      c.globalAlpha = 1;
    }
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(0,0,0,.3)'; roundRect(c, 14, 50, W - 28, 125, 16); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1.5; roundRect(c, 17, 53, W - 34, 119, 13); c.stroke();
    // dice going under the cup are drawn first so the cup hides them; dice on the table and tumbling out come after it
    for (const s of this.sweep) this.drawDie(c, s);
    for (const d of this.dice) if (d.into) this.drawDie(c, d);
    this.drawCup(c);
    for (const d of this.dice) if (!d.hid && !d.into) this.drawDie(c, d);
    if (!this.rolls && this.cup.ph === 'idle' && !this.over && !(this.auto && this.autoOK)) this.text(c, 'tap to shake', HX, HY + 52, 10, 'rgba(255,255,255,.55)');
    const idle = !this.busy() && this.rolls < 3;
    c.fillStyle = idle ? this.col(1) : '#4a403a'; roundRect(c, W / 2 - 70, 180, 140, 26, 13); c.fill();
    this.text(c, this.rolls >= 3 && !this.busy() ? 'pick a score' : this.busy() ? 'rolling…' : `ROLL (${3 - this.rolls} left)`, W / 2, 193, 12, idle ? '#1a1410' : '#cfc6b8');
    const d = this.dice.map((x) => x.v), shown = this.rolls && !this.busy();
    CATS.forEach(([name, f], i) => {
      const col = i < 7 ? 0 : 1, row = i < 7 ? i : i - 7, x = 16 + col * (W / 2), y = 214 + row * 28;
      c.fillStyle = this.card[i] !== null ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.12)'; roundRect(c, x, y, W / 2 - 24, 24, 6); c.fill();
      this.text(c, name, x + 8, y + 12, 11, this.pal.ink, 'left');
      const v = this.card[i] !== null ? this.card[i] : shown ? f(d) : '';
      this.text(c, String(v), x + W / 2 - 34, y + 12, 12, this.card[i] !== null ? this.col(4) : this.col(0), 'right');
    });
    this.text(c, this.over ? `Final ${this.total} · best ${this.best}` : this.msg || `Round ${this.round + 1}/13`, W / 2, 30, 13);
  }
  hud() { return `${this.total || 0} pts`; }
}

// ================================================================ Joker Hands (Balatro-like)
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const HANDS = { 'High card': [5, 1], Pair: [10, 2], 'Two pair': [20, 2], 'Three of a kind': [30, 3], Straight: [30, 4], Flush: [35, 4], 'Full house': [40, 4], 'Four of a kind': [60, 7], 'Straight flush': [100, 8] };
const JOKERS = [
  { t: '+4 Mult', f: (h, ctx) => { ctx.mult += 4; } },
  { t: '+30 Chips on a Pair', f: (h, ctx) => { if (/Pair|Two|Full|Four|Three/.test(h.name)) ctx.chips += 30; } },
  { t: '×2 Mult on a Flush', f: (h, ctx) => { if (/Flush/.test(h.name)) ctx.mult *= 2; } },
  { t: '+3 Mult per ♥ scored', f: (h, ctx) => { ctx.mult += 3 * h.cards.filter((c) => c.s === 1).length; } },
  { t: '×1.5 Mult with a face card', f: (h, ctx) => { if (h.cards.some((c) => c.r >= 9 && c.r <= 11)) ctx.mult *= 1.5; } },
  { t: '+50 Chips if 3 cards or fewer', f: (h, ctx) => { if (h.played.length <= 3) ctx.chips += 50; } },
  { t: '+2 Mult per Ace', f: (h, ctx) => { ctx.mult += 2 * h.cards.filter((c) => c.r === 12).length; } },
  { t: '×3 Mult on a Straight', f: (h, ctx) => { if (/Straight/.test(h.name)) ctx.mult *= 3; } },
  { t: '+8 Mult on Three of a kind', f: (h, ctx) => { if (/Three|Full/.test(h.name)) ctx.mult += 8; } },
  { t: '+1 Mult per discard left', f: (h, ctx, g) => { ctx.mult += g.discards; } },
  { t: '+15 Chips per even card', f: (h, ctx) => { ctx.chips += 15 * h.cards.filter((c) => c.r <= 8 && (c.r + 2) % 2 === 0).length; } },
  { t: '×2 Mult on your last hand', f: (h, ctx, g) => { if (g.hands === 1) ctx.mult *= 2; } }
];
function classify(cards) {
  const rs = cards.map((c) => c.r).sort((a, b) => a - b);
  const cnt = {}; rs.forEach((r) => (cnt[r] = (cnt[r] || 0) + 1));
  const groups = Object.entries(cnt).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.length === 5 && cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(rs)];
  const straight = cards.length === 5 && uniq.length === 5 && (rs[4] - rs[0] === 4 || rs.join() === '0,1,2,3,12');
  const pick = (n) => cards.filter((c) => groups.slice(0, n).some(([r]) => +r === c.r));
  if (straight && flush) return { name: 'Straight flush', cards };
  if (groups[0][1] === 4) return { name: 'Four of a kind', cards: pick(1) };
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return { name: 'Full house', cards };
  if (flush) return { name: 'Flush', cards };
  if (straight) return { name: 'Straight', cards };
  if (groups[0][1] === 3) return { name: 'Three of a kind', cards: pick(1) };
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return { name: 'Two pair', cards: pick(2) };
  if (groups[0][1] === 2) return { name: 'Pair', cards: pick(1) };
  return { name: 'High card', cards: [cards.reduce((a, b) => (b.r > a.r ? b : a))] };
}
export class Cards extends Game {
  static noAuto = true;
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'swarm', 'trails'];
  setup() { this.ante = 1; this.jokers = []; this.addJoker(); this.addJoker(); this.newBlind(); }
  addJoker() {
    const free = JOKERS.filter((j) => !this.jokers.some((x) => x.t === j.t));
    const j = free[this.ri(0, free.length - 1)];
    if (j && this.jokers.length < 5) this.jokers.push({ ...j, name: `The ${creatureName((this.post.seed || 1) + this.jokers.length * 31 + this.ante)}`, face: this.skin.any('enemy', 'hero', 'item') });
  }
  newBlind() {
    this.target = Math.round(300 * Math.pow(1.6, this.ante - 1) * (this.mods.glass ? 1.5 : 1));
    this.round = 0; this.hands = 4; this.discards = 3; this.msg = `Ante ${this.ante} · reach ${this.target}`;
    this.deck = []; for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) this.deck.push({ r, s });
    for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; }
    this.hand = []; this.draw8(); this.sel = new Set(); this.wait = 1; this.anim = null;
  }
  draw8() { while (this.hand.length < 8 && this.deck.length) this.hand.push(this.deck.pop()); this.hand.sort((a, b) => b.r - a.r || a.s - b.s); }
  scoreOf(played) {
    const h = classify(played);
    const [chips, mult] = HANDS[h.name];
    const ctx = { chips: chips + h.cards.reduce((s, c) => s + (c.r === 12 ? 11 : c.r >= 9 ? 10 : c.r + 2), 0), mult };
    for (const j of this.jokers) j.f({ ...h, played }, ctx, this);
    return { ...h, chips: Math.round(ctx.chips), mult: Math.round(ctx.mult * 10) / 10, total: Math.round(ctx.chips * ctx.mult) };
  }
  play(cards, discard) {
    if (this.anim) return;
    if (discard) { if (!this.discards) return; this.discards--; this.hand = this.hand.filter((c) => !cards.includes(c)); this.draw8(); this.sel.clear(); return; }
    if (!this.hands || !cards.length) return;
    this.hands--;
    const s = this.scoreOf(cards);
    this.round += s.total; this.score += s.total;
    this.anim = { s, t: 1.4, cards };
    this.hand = this.hand.filter((c) => !cards.includes(c)); this.sel.clear();
  }
  bestPlay() {
    let best = null;
    const n = this.hand.length;
    for (let m = 1; m < 1 << n; m++) {
      const bits = m.toString(2).split('').filter((x) => x === '1').length;
      if (bits > 5) continue;
      const cards = this.hand.filter((_, i) => m & (1 << i));
      const s = this.scoreOf(cards);
      if (!best || s.total > best.s.total || (s.total === best.s.total && cards.length < best.cards.length)) best = { s, cards };
    }
    return best;
  }
  autopilot(dt) {
    if (this.anim || this.over) return;
    this.wait -= dt; if (this.wait > 0) return; this.wait = this.r(0.9, 1.4);
    const b = this.bestPlay();
    const need = this.target - this.round;
    if (this.discards && b.s.total * this.hands < need && b.s.total < need) {
      const keep = new Set(b.cards);
      const toss = this.hand.filter((c) => !keep.has(c)).sort((a, x) => a.r - x.r).slice(0, 5);
      if (toss.length) { toss.forEach((c) => this.sel.add(c)); setTimeout(() => this.play(toss, true), 350); return; }
    }
    b.cards.forEach((c) => this.sel.add(c));
    setTimeout(() => this.play(b.cards), 350);
  }
  down(x, y) {
    if (this.auto || this.anim || this.over) return;
    if (y > H - 46) { if (x < W / 2) this.play([...this.sel]); else this.play([...this.sel], true); return; }
    const i = this.hand.findIndex((_, k) => Math.abs(this.cardX(k) - x) < 20 && y > 248 && y < 340);
    if (i >= 0) { const c = this.hand[i]; if (this.sel.has(c)) this.sel.delete(c); else if (this.sel.size < 5) this.sel.add(c); }
  }
  tap(x, y) { this.down(x, y); }
  cardX(k) { return 30 + k * ((W - 60) / Math.max(1, this.hand.length - 1)); }
  step(dt) {
    if (this.over) { this.over -= dt; if (this.over <= 0) { this.ante = 1; this.jokers = []; this.addJoker(); this.addJoker(); this.newBlind(); } return; }
    if (this.anim) {
      this.anim.t -= dt;
      if (this.anim.t <= 0) {
        this.anim = null; this.draw8();
        if (this.round >= this.target) { this.msg = 'Blind beaten! New joker.'; this.ante++; this.addJoker(); this.burst(W / 2, 120, this.col(1), 30, 220); setTimeout(() => this.newBlind(), 900); this.anim = { t: 1, s: null, cards: [] }; }
        else if (!this.hands) { this.msg = `Busted at ante ${this.ante}`; this.over = 2.5; }
      }
    }
  }
  drawCard(c, card, x, y, up) {
    c.save(); c.translate(x, y - (up ? 14 : 0));
    c.fillStyle = '#f7f1e6'; roundRect(c, -19, -30, 38, 60, 5); c.fill();
    c.strokeStyle = up ? this.col(0) : 'rgba(0,0,0,.3)'; c.lineWidth = up ? 3 : 1; c.stroke();
    const red = card.s === 1 || card.s === 2;
    this.text(c, RANKS[card.r], -10, -19, 12, red ? '#c0392b' : '#1a1410');
    this.text(c, SUITS[card.s], 0, 6, 20, red ? '#c0392b' : '#1a1410');
    c.restore();
  }
  draw(c) {
    // swirling backdrop
    const g = c.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 300);
    g.addColorStop(0, this.pal.bg2); g.addColorStop(1, this.pal.bg); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = 0.12; c.strokeStyle = this.col(0); c.lineWidth = 18;
    for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(W / 2, H / 2, 40 + k * 50 + Math.sin(this.t + k) * 10, this.t * 0.3 + k, this.t * 0.3 + k + 2.4); c.stroke(); }
    c.globalAlpha = 1;
    this.jokers.forEach((j, i) => {
      const x = 14 + i * 68;
      c.fillStyle = 'rgba(0,0,0,.45)'; roundRect(c, x, 34, 62, 84, 7); c.fill();
      c.strokeStyle = this.col(i + 1); c.lineWidth = 2; c.stroke();
      drawFit(c, j.face, x + 31, 62, 40, 36);
      c.font = '700 8px ui-monospace, monospace'; c.fillStyle = this.pal.ink; c.textAlign = 'center';
      const words = j.t.split(' '); let line = '', ly = 92;
      for (const w of words) { if ((line + ' ' + w).length > 12) { c.fillText(line, x + 31, ly); line = w; ly += 9; } else line = (line + ' ' + w).trim(); }
      c.fillText(line, x + 31, ly);
    });
    this.text(c, this.msg, W / 2, 134, 12, this.col(4));
    this.text(c, `${this.round} / ${this.target}`, W / 2, 158, 22, this.round >= this.target ? this.col(1) : this.pal.ink);
    c.fillStyle = 'rgba(255,255,255,.08)'; roundRect(c, 40, 172, W - 80, 8, 4); c.fill();
    c.fillStyle = this.col(0); roundRect(c, 40, 172, (W - 80) * Math.min(1, this.round / this.target), 8, 4); c.fill();
    if (this.anim?.s) {
      const s = this.anim.s;
      this.text(c, s.name, W / 2, 200, 16, this.col(1));
      this.text(c, `${s.chips} × ${s.mult} = ${s.total}`, W / 2, 222, 14);
      this.anim.cards.forEach((card, i) => this.drawCard(c, card, W / 2 - (this.anim.cards.length - 1) * 22 + i * 44, 200 - 70 * (1.4 - this.anim.t) + 60, false));
    } else if (this.sel.size) { const s = this.scoreOf([...this.sel]); this.text(c, `${s.name}: ${s.chips} × ${s.mult}`, W / 2, 214, 13, this.col(4)); }
    this.hand.forEach((card, k) => this.drawCard(c, card, this.cardX(k), 296, this.sel.has(card)));
    c.fillStyle = this.col(0); roundRect(c, 20, H - 40, W / 2 - 30, 30, 8); c.fill();
    c.fillStyle = this.col(3); roundRect(c, W / 2 + 10, H - 40, W / 2 - 30, 30, 8); c.fill();
    this.text(c, `PLAY (${this.hands})`, W / 4 + 5, H - 25, 12, '#1a1410');
    this.text(c, `DISCARD (${this.discards})`, (3 * W) / 4 - 5, H - 25, 12, '#fff');
  }
  hud() { return `ante ${this.ante} · ${this.jokers.length} jokers`; }
}
