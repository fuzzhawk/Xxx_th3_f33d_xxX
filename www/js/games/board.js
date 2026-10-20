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
export class Dice extends Game {
  static noAuto = true;
  static noMods = ['mirror', 'wobble', 'swarm', 'glass', 'trails'];
  setup() { this.best = 0; this.newGame(); }
  newGame() { this.card = CATS.map(() => null); this.round = 0; this.newTurn(); this.total = 0; this.score = 0; }
  newTurn() { this.dice = Array.from({ length: 5 }, (_, i) => ({ v: 1 + this.ri(0, 5), held: false, x: 50 + i * 65, y: 110, vx: 0, vy: 0, rot: 0, vr: 0, rolling: 0 })); this.rolls = 0; this.wait = 0.6; this.msg = ''; }
  roll() {
    if (this.rolls >= 3 || this.dice.some((d) => d.rolling > 0)) return;
    this.rolls++;
    for (const d of this.dice) if (!d.held) { d.rolling = this.r(0.6, 1.1); d.vx = this.r(-300, 300); d.vy = this.r(-420, -200); d.vr = this.r(-14, 14); }
  }
  scoreCat(i) {
    if (this.card[i] !== null || this.rolls === 0 || this.dice.some((d) => d.rolling > 0)) return;
    const v = CATS[i][1](this.dice.map((d) => d.v));
    this.card[i] = v; this.msg = `${CATS[i][0]}: +${v}`;
    this.total = sum(this.card.map((x) => x || 0)) + (sum(this.card.slice(0, 6).map((x) => x || 0)) >= 63 ? 35 : 0);
    this.score = this.total;
    this.round++;
    if (this.round >= CATS.length) { this.best = Math.max(this.best, this.total); this.over = 3; } else this.newTurn();
  }
  // simple strategy: chase the most common face, or a straight when four are in a row
  autopilot(dt) {
    if (this.over || this.dice.some((d) => d.rolling > 0)) return;
    this.wait -= dt; if (this.wait > 0) return; this.wait = this.r(0.5, 0.9);
    const d = this.dice.map((x) => x.v);
    if (this.rolls === 0) return this.roll();
    const options = CATS.map((c, i) => [i, this.card[i] === null ? c[1](d) : -1]).filter(([, v]) => v >= 0);
    const bestNow = options.sort((a, b) => b[1] - a[1])[0];
    if (this.rolls === 3 || (bestNow && bestNow[1] >= 30)) {
      const pick = bestNow[1] > 0 ? bestNow : options.sort((a, b) => [12, 0, 1, 11].indexOf(b[0]) - [12, 0, 1, 11].indexOf(a[0]))[0] || bestNow;
      return this.scoreCat(pick[0]);
    }
    const cs = counts(d), face = cs.lastIndexOf(Math.max(...cs));
    const uniq = [...new Set(d)].sort();
    const straightish = uniq.length >= 4 && uniq[3] - uniq[0] === 3 && (this.card[9] === null || this.card[10] === null);
    this.dice.forEach((x, i) => (x.held = straightish ? uniq.includes(x.v) && d.indexOf(x.v) === i : x.v === face));
    this.roll();
  }
  down(x, y) {
    if (this.auto || this.over) return;
    if (y < 175) { const d = this.dice.find((d) => Math.abs(d.x - x) < 30 && Math.abs(d.y - y) < 30); if (d && this.rolls) d.held = !d.held; return; }
    if (y < 210) { this.roll(); return; }
    const col = x < W / 2 ? 0 : 1, row = Math.floor((y - 214) / 28), i = col * 7 + row;
    if (row >= 0 && i < CATS.length) this.scoreCat(i);
  }
  tap(x, y) { this.down(x, y); }
  step(dt) {
    if (this.over) { this.over -= dt; if (this.over <= 0) this.newGame(); return; }
    for (const d of this.dice) {
      if (d.rolling <= 0) continue;
      d.rolling -= dt; d.vy += 1400 * this.G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      if (d.y > 140) { d.y = 140; d.vy *= -0.45; d.vx *= 0.8; d.vr *= 0.7; }
      if (d.x < 34 || d.x > W - 34) { d.vx *= -0.8; d.x = Math.max(34, Math.min(W - 34, d.x)); }
      if (this.rng() < dt * 18) d.v = 1 + this.ri(0, 5);
      if (d.rolling <= 0) { d.rot = 0; d.v = 1 + this.ri(0, 5); }
    }
    // settle dice back into their slots
    this.dice.forEach((d, i) => { if (d.rolling <= 0) { d.x += (50 + i * 65 - d.x) * Math.min(1, dt * 8); d.y += (110 - d.y) * Math.min(1, dt * 8); } });
  }
  drawDie(c, d) {
    const s = 46;
    c.save(); c.translate(d.x, d.y); c.rotate(d.rot);
    c.fillStyle = d.held ? this.col(0) : '#f6efe4'; roundRect(c, -s / 2, -s / 2, s, s, 9); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = d.held ? '#fff' : '#1a1410';
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[d.v];
    for (const [a, b] of P) { c.beginPath(); c.arc(a * 12, b * 12, 4.5, 0, 7); c.fill(); }
    c.restore();
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(0,0,0,.3)'; roundRect(c, 14, 50, W - 28, 125, 16); c.fill();
    for (const d of this.dice) this.drawDie(c, d);
    c.fillStyle = this.rolls >= 3 ? '#4a403a' : this.col(1); roundRect(c, W / 2 - 70, 180, 140, 26, 13); c.fill();
    this.text(c, this.rolls >= 3 ? 'pick a score' : `ROLL (${3 - this.rolls} left)`, W / 2, 193, 12, '#1a1410');
    const d = this.dice.map((x) => x.v);
    CATS.forEach(([name, f], i) => {
      const col = i < 7 ? 0 : 1, row = i < 7 ? i : i - 7, x = 16 + col * (W / 2), y = 214 + row * 28;
      c.fillStyle = this.card[i] !== null ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.12)'; roundRect(c, x, y, W / 2 - 24, 24, 6); c.fill();
      this.text(c, name, x + 8, y + 12, 11, this.pal.ink, 'left');
      const v = this.card[i] !== null ? this.card[i] : this.rolls ? f(d) : '';
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
