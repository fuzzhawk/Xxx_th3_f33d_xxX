// Crokinole: flick discs across a round board ringed with pegs. Sink the centre hole
// for 20, otherwise score by ring. If the other side has discs on the board, your
// shot must hit one or it comes off.
import { Game, W, H, drawFit, ready } from './engine.js';

const CX = W / 2, CY = H / 2 + 14, RB = 160, RINGS = [8, 48, 96, 140], DR = 9, PEGR = 3.2, SHOTS = 6;
const PEGS = Array.from({ length: 8 }, (_, i) => ({ x: CX + Math.cos(i * Math.PI / 4 + Math.PI / 8) * RINGS[1], y: CY + Math.sin(i * Math.PI / 4 + Math.PI / 8) * RINGS[1] }));

// one physics step for a set of discs (shared by play and the AI's look-ahead)
function physics(ds, dt) {
  for (const d of ds) {
    if (d.out) continue;
    const v = Math.hypot(d.vx, d.vy);
    if (v > 0) { const nv = Math.max(0, v - 150 * dt); d.vx *= nv / v; d.vy *= nv / v; }
    d.x += d.vx * dt; d.y += d.vy * dt;
    for (const p of PEGS) {
      const dx = d.x - p.x, dy = d.y - p.y, dd = Math.hypot(dx, dy), m = DR + PEGR;
      if (dd < m && dd > 0) { const nx = dx / dd, ny = dy / dd; d.x = p.x + nx * m; d.y = p.y + ny * m; const vn = d.vx * nx + d.vy * ny; if (vn < 0) { d.vx -= 1.8 * vn * nx; d.vy -= 1.8 * vn * ny; } }
    }
  }
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
    const a = ds[i], b = ds[j];
    if (a.out || b.out) continue;
    const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy);
    if (dd >= DR * 2 || dd === 0) continue;
    const nx = dx / dd, ny = dy / dd, ov = (DR * 2 - dd) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) { const j2 = -(1.9 / 2) * rv; a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny; a.hit = b.hit = true; }
  }
  for (const d of ds) {
    if (d.out) continue;
    const r = Math.hypot(d.x - CX, d.y - CY);
    if (r > RB - DR * 0.3) d.out = 'ditch';
    else if (r < RINGS[0] - 2 && Math.hypot(d.vx, d.vy) < 140) d.out = 'twenty';
  }
}
const ringScore = (d) => { const r = Math.hypot(d.x - CX, d.y - CY); return r < RINGS[1] - DR ? 15 : r < RINGS[2] - DR ? 10 : r < RINGS[3] - DR ? 5 : 0; };

export class Crokinole extends Game {
  static noAuto = true;
  static noMods = ['mirror', 'lowg', 'heavy', 'giant', 'tiny', 'wobble'];
  setup() { this.stats = { foul: [0, 0], shots: [0, 0], pts: [0, 0] }; this.totals = [0, 0]; this.round = 0; this.newRound(); }
  newRound() {
    this.round++; this.discs = []; this.twenties = [0, 0]; this.shot = 0; this.turn = this.round % 2; this.phase = 'aim'; this.think = 1; this.aim = null; this.msg = null;
    this.left = [SHOTS, SHOTS];
  }
  // side 0 shoots from the bottom quarter, side 1 from the top
  spot(side, u) { const a = (side ? -Math.PI / 2 : Math.PI / 2) + (u - 0.5) * (Math.PI / 2.2); return { x: CX + Math.cos(a) * RINGS[3], y: CY + Math.sin(a) * RINGS[3] }; }
  shoot(side, u, ang, pow) {
    const s = this.spot(side, u);
    const d = { x: s.x, y: s.y, vx: Math.cos(ang) * pow, vy: Math.sin(ang) * pow, side, shot: true, i: side ? this.skin.pick('them', 'enemy', 'monster') : this.skin.pick('us', 'hero', 'item') };
    for (const o of this.discs) o.hit = false;
    this.stats.shots[side]++;
    this.discs.push(d); this.left[side]--; this.phase = 'roll'; this.rollT = 0; this.needHit = this.discs.some((o) => !o.out && o.side !== side);
    return d;
  }
  // try a spread of shots in a copy of the board, keep the best
  plan(side) {
    let best = null;
    const opp = this.discs.filter((d) => !d.out && d.side !== side);
    for (let k = 0; k < 48; k++) {
      const u = this.rng(), s = this.spot(side, u);
      let tx = CX, ty = CY;
      if (opp.length && this.rng() < 0.8) { const o = opp[Math.floor(this.rng() * opp.length)]; tx = o.x; ty = o.y; }
      const ang = Math.atan2(ty - s.y, tx - s.x) + this.r(-0.06, 0.06), dist = Math.hypot(tx - s.x, ty - s.y);
      const pow = Math.sqrt(2 * 150 * dist) * this.r(opp.length ? 1.05 : 0.92, opp.length ? 1.5 : 1.08);
      const ds = this.discs.map((d) => ({ ...d, shot: false, hit: false })), me = { x: s.x, y: s.y, vx: Math.cos(ang) * pow, vy: Math.sin(ang) * pow, side, shot: true };
      ds.push(me);
      for (let t = 0; t < 5; t += 1 / 60) { physics(ds, 1 / 60); if (ds.every((d) => d.out || Math.hypot(d.vx, d.vy) < 1)) break; }
      if (opp.length && !ds.some((d) => d.side !== side && d.hit)) me.out = 'foul';
      if (!opp.length && !me.out && ringScore(me) < 15) me.out = 'foul';
      let v = 0;
      for (const d of ds) { const sc = d.out === 'twenty' ? 20 : d.out ? 0 : ringScore(d); v += d.side === side ? sc : -sc; }
      v += this.r(0, 3);
      if (!best || v > best.v) best = { v, u, ang, pow };
    }
    return best;
  }
  ai(dt) {
    if (this.phase !== 'aim') return;
    this.think -= dt;
    if (this.think > 0) return;
    if (!this.pending) { this.pending = this.plan(this.turn); this.think = 0.5; this.aim = { u: this.pending.u, ang: this.pending.ang, pow: this.pending.pow }; return; }
    const p = this.pending; this.pending = null; this.aim = null;
    this.shoot(this.turn, p.u, p.ang + this.r(-0.02, 0.02), p.pow * this.r(0.97, 1.03));
  }
  down(x, y) {
    if (this.phase !== 'aim' || this.turn !== 0) return;
    const a = Math.atan2(y - CY, x - CX), u = Math.max(0, Math.min(1, (a - Math.PI / 2) / (Math.PI / 2.2) + 0.5));
    this.drag = { u: Math.hypot(x - CX, y - CY) > RINGS[2] && y > CY ? u : this.aim?.u ?? 0.5, x, y };
    this.aim = { u: this.drag.u, ang: -Math.PI / 2, pow: 0 };
  }
  move(x, y) {
    if (!this.drag) return;
    const s = this.spot(0, this.drag.u), dx = s.x - x, dy = s.y - y;
    this.aim = { u: this.drag.u, ang: Math.atan2(dy, dx), pow: Math.min(520, Math.hypot(dx, dy) * 4) };
  }
  up() { if (!this.drag) return; this.drag = null; if (this.aim?.pow > 40) { const a = this.aim; this.aim = null; this.shoot(0, a.u, a.ang, a.pow); } }
  tap() {}
  step(dt) {
    if (this.phase === 'aim' && (this.turn === 1 || (this.auto && this.autoOK))) this.ai(dt);
    if (this.phase === 'roll') {
      physics(this.discs, dt); this.rollT += dt;
      for (const d of this.discs) if (d.out === 'twenty' && !d.counted) { d.counted = true; this.twenties[d.side]++; this.burst(CX, CY, this.col(1), 18, 160); this.msg = { s: '20!', t: 1 }; }
      if (this.discs.every((d) => d.out || Math.hypot(d.vx, d.vy) < 1) || this.rollT > 8) {
        const s = this.discs.find((d) => d.shot);
        if (s) {
          s.shot = false;
          const foul = !s.out && ((this.needHit && !this.discs.some((o) => o.side !== s.side && o.hit)) || (!this.needHit && ringScore(s) < 15));
          if (foul) { this.stats.foul[s.side]++; s.out = 'foul'; this.msg = { s: this.needHit ? 'MISSED — DISC OFF' : 'SHORT — DISC OFF', t: 1 }; }
        }
        this.discs = this.discs.filter((d) => !d.out);
        this.shot++;
        if (!this.left[0] && !this.left[1]) { this.phase = 'done'; this.doneT = 2.5; this.tally(); }
        else { this.turn = this.left[1 - this.turn] ? 1 - this.turn : this.turn; this.phase = 'aim'; this.think = this.r(0.6, 1.2); }
      }
    } else if (this.phase === 'done' && (this.doneT -= dt) <= 0) this.newRound();
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
  }
  tally() {
    const pts = [0, 1].map((s) => this.twenties[s] * 20 + this.discs.filter((d) => d.side === s).reduce((a, d) => a + ringScore(d), 0));
    this.stats.pts[0] += pts[0]; this.stats.pts[1] += pts[1];
    // only the difference counts, like the real game
    const w = pts[0] > pts[1] ? 0 : 1, diff = Math.abs(pts[0] - pts[1]);
    this.totals[w] += diff;
    this.score = this.totals[0];
    this.msg = { s: diff ? `${w ? 'THEY' : 'YOU'} TAKE ${diff}  (${pts[0]}–${pts[1]})` : `TIED ${pts[0]}–${pts[1]}`, t: 2.4 };
  }
  draw(c) {
    this.clear(c);
    // board: a disc of wood (texture photo) with a ditch around it
    c.fillStyle = this.pal.bg; c.beginPath(); c.arc(CX, CY, RB + 12, 0, 7); c.fill();
    c.save(); c.beginPath(); c.arc(CX, CY, RB, 0, 7); c.clip();
    c.fillStyle = this.col(4); c.fillRect(0, 0, W, H);
    const tex = this.skin.slots.tile[0];
    if (ready(tex)) { c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.8; const pat = c.createPattern(tex, 'repeat'); c.fillStyle = pat; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.arc(CX, CY, RINGS[1], 0, 7); c.fill();
    c.restore();
    c.strokeStyle = this.pal.bg; c.lineWidth = 1.5;
    for (const r of RINGS.slice(1)) { c.beginPath(); c.arc(CX, CY, r, 0, 7); c.stroke(); }
    for (const a of [Math.PI / 4, 3 * Math.PI / 4]) { c.beginPath(); c.moveTo(CX + Math.cos(a) * RINGS[2], CY + Math.sin(a) * RINGS[2]); c.lineTo(CX + Math.cos(a) * RINGS[3], CY + Math.sin(a) * RINGS[3]); c.moveTo(CX - Math.cos(a) * RINGS[2], CY - Math.sin(a) * RINGS[2]); c.lineTo(CX - Math.cos(a) * RINGS[3], CY - Math.sin(a) * RINGS[3]); c.stroke(); }
    c.fillStyle = this.pal.bg; c.beginPath(); c.arc(CX, CY, RINGS[0], 0, 7); c.fill();
    for (const p of PEGS) { c.fillStyle = this.col(2); c.beginPath(); c.arc(p.x, p.y, PEGR, 0, 7); c.fill(); }
    for (const d of this.discs) this.disc(c, d.x, d.y, d.side, d.i);
    // aim line
    if (this.aim && this.phase === 'aim') {
      const s = this.spot(this.turn, this.aim.u);
      this.disc(c, s.x, s.y, this.turn, this.turn ? this.skin.pick('them', 'enemy', 'monster') : this.skin.pick('us', 'hero', 'item'), 0.7);
      c.strokeStyle = this.pal.ink; c.globalAlpha = 0.5; c.setLineDash([4, 4]); c.lineWidth = 1.5;
      const L = 30 + this.aim.pow * 0.2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + Math.cos(this.aim.ang) * L, s.y + Math.sin(this.aim.ang) * L); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    // discs left
    for (let s = 0; s < 2; s++) for (let k = 0; k < this.left[s]; k++) this.disc(c, 16 + k * 14, s ? 44 : H - 14, s, null, 0.8, 5);
    this.text(c, `YOU ${this.totals[0]}  ·  THEM ${this.totals[1]}`, W - 10, H - 14, 11, this.pal.ink, 'right');
    if (this.msg) { c.globalAlpha = Math.min(1, this.msg.t * 2); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, CY - 16, W, 32); this.text(c, this.msg.s, W / 2, CY, 15, this.pal.ink); c.globalAlpha = 1; }
  }
  disc(c, x, y, side, img, a = 1, r = DR) {
    c.globalAlpha = a;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x + 1.5, y + 2, r, 0, 7); c.fill();
    c.fillStyle = side ? this.col(0) : this.col(5); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r * 0.65, 0, 7); c.stroke();
    if (img) drawFit(c, img, x, y, r * 1.4, r * 1.4);
    c.globalAlpha = 1;
  }
  hud() { return `${this.totals[0]}–${this.totals[1]} · round ${this.round}`; }
}
