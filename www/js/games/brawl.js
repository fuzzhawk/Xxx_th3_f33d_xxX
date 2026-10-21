// Street Brawl: a 2D fighter with MARROW fighters (physically simulated moves,
// cloth and hair). Jabs, kicks, palm strikes, side kicks, sweeps, overheads, flying
// knees and chain punches; specials (uppercut, energy blast, hurricane kick); hit
// reactions, blocks, knockdowns and get-ups; chained combos with a hit counter; a
// super meter that unlocks a cinematic ultra; ultra finishes on the last round.
// On autopilot the crowd bets salt on every match (SaltyBet-style).
import { Game, W, H, roundRect } from './engine.js';
import { humanoid, creatureName } from './creature.js';
import { marrowAnims } from '../marrow/sprites.js';

// frames per animation rendered by MARROW (fractions for single held poses)
// about twice the frames of a typical fighter sheet, so moves read smoothly; guard breathes in and out
const BREATH = [0.02, 0.035, 0.05, 0.065, 0.08, 0.095, 0.11, 0.095, 0.08, 0.065, 0.05, 0.035];
const ANIMS = { guard: BREATH, walk: 12, jump: 12, punch: 10, kick: 11, palm: 10, sidekick: 11, sweep: 11, overhead: 11, flyknee: 12, flurry: 16, uppercut: 12, hadouken: 11, spinkick: 14, hurt: 8, knockdown: 12, block: [0.6, 0.7], dance: 16 };
// gameplay for each attack: duration, when it hits (fraction), reach, damage, hits, effects
const MOVES = {
  punch: { t: 0.32, at: [0.45], reach: 46, dmg: 5, chain: ['punch', 'palm', 'kick'] },
  kick: { t: 0.48, at: [0.5], reach: 58, dmg: 8, chain: ['sidekick', 'uppercut'] },
  palm: { t: 0.42, at: [0.55], reach: 50, dmg: 9, push: 22, chain: ['kick', 'flurry'] },
  sidekick: { t: 0.52, at: [0.5], reach: 66, dmg: 11, push: 30, chain: ['uppercut', 'hadouken'] },
  sweep: { t: 0.55, at: [0.45], reach: 62, dmg: 8, low: 1, down: 1 },
  overhead: { t: 0.58, at: [0.5], reach: 52, dmg: 13, high: 1 },
  flyknee: { t: 0.7, at: [0.4], reach: 56, dmg: 12, lunge: 120 },
  flurry: { t: 0.85, at: [0.2, 0.32, 0.44, 0.56, 0.68], reach: 46, dmg: 3, chain: ['uppercut'] },
  uppercut: { t: 0.8, at: [0.35], reach: 50, dmg: 15, down: 1, special: 1 },
  hadouken: { t: 0.62, at: [0.5], reach: 0, dmg: 12, ball: 1, special: 1 },
  spinkick: { t: 0.9, at: [0.3, 0.45, 0.6, 0.75], reach: 60, dmg: 4, lunge: 90, special: 1 }
};
const ULTRAS = [
  { kind: 'barrage', names: ['Thousand Marrow Palms', 'Nine Hells Barrage', 'Requiem of Fists', 'The Long Goodbye'] },
  { kind: 'beam', names: ['Eclipse Cannon', 'Final Sermon', 'Big Bang of Spite', 'Solar Exorcism'] },
  { kind: 'cyclone', names: ['Ouroboros Cyclone', 'Tempest Waltz', 'Ninefold Hurricane', 'Wheel of Ruin'] }
];
const EPITHETS = ['the Unwashed', 'of the Ninth Circle', 'Jr.', 'the Inevitable', 'Who Shall Not Be Named', 'the Moist', 'from Accounting', 'the Thrice-Banned', 'XXL', 'of Ill Repute', 'the Beige', 'Prime', 'the Damp Knight', '(Mythic Tier)', 'the Unlikely', 'Classic', 'with a Chair'];
const loadSalt = () => { try { return +localStorage.getItem('feed-salt') || 400; } catch { return 400; } };
const saveSalt = (v) => { try { localStorage.setItem('feed-salt', String(v)); } catch { /* private mode */ } };
const SZ = 96, DRAW = 2.1;

export class Fighter extends Game {
  static noMods = ['mirror', 'wobble', 'swarm', 'giant', 'tiny'];
  setup() { this.matchN = 0; this.salt = loadSalt(); this.fx = []; this.newMatch(); }
  newMatch() {
    const s = (this.post.seed || 1) * 13 + this.matchN * 7919; this.matchN++;
    this.roster = [0, 1].map((k) => {
      const seed = s * 31 + k * 977, id = ((seed >>> 0) * 2654435761 >>> 0) % 120 + 1;
      const ultra = ULTRAS[(seed >>> 4) % 3];
      return { id, sheet: humanoid(seed), anims: marrowAnims(id, ANIMS, { size: SZ, face: true, scale: 0.3 }), name: `${creatureName(seed)}${this.rng() < 0.6 ? ` ${EPITHETS[this.ri(0, EPITHETS.length - 1)]}` : ''}`, pow: this.r(0.8, 1.3), spd: this.r(0.8, 1.25), tough: this.r(0.85, 1.25), ultra: { ...ultra, name: ultra.names[(seed >>> 7) % 4] } };
    });
    this.roster.forEach((r) => r.anims.ready.then(() => { r.ready = true; }));
    this.names = this.roster.map((r) => r.name);
    const rate = (r) => r.pow * r.spd * r.tough * this.r(0.8, 1.25), ra = rate(this.roster[0]), rb = rate(this.roster[1]), crowd = 3000 + this.ri(0, 12000);
    this.pool = [Math.round(crowd * ra / (ra + rb)), Math.round(crowd * rb / (ra + rb))];
    this.bet = null; this.betT = 8; this.wins = [0, 0]; this.round = 1; this.resetRound();
  }
  resetRound() {
    this.p = [this.mk(0, 100, 1), this.mk(1, W - 100, -1)];
    this.timer = 60; this.balls = []; this.pause = Math.max(this.pause || 0, 1.2); this.banner = `ROUND ${this.round}`; this.cine = null; this.slow = 1; this.freeze = 0; this.shake = 0; this.roundOver = null;
  }
  mk(i, x, face) { const r = this.roster[i], max = Math.round((this.mods.glass ? 40 : 100) * r.tough); return { i, x, y: 0, vx: 0, vy: 0, face, hp: max, max, act: null, at: 0, hits: 0, stun: 0, down: 0, block: 0, ai: 0, combo: 0, comboT: 0, meter: 0, crouch: false, pow: r.pow, spd: r.spd, r }; }
  // ---------------------------------------------------------------- betting (autopilot only)
  autoTap(x, y) {
    if (!(this.betT > 0) || y < 150 || y > 360) return false;
    const side = x < W / 2 ? 0 : 1, step = Math.max(10, Math.round(this.salt * 0.1));
    if (this.bet && this.bet.side !== side) { this.salt += this.bet.amt; this.bet = null; }
    const amt = Math.min(this.salt, step);
    if (amt <= 0) return true;
    this.salt -= amt; this.bet = { side, amt: (this.bet?.amt || 0) + amt }; saveSalt(this.salt);
    return true;
  }
  settle(w) {
    if (!this.bet) { this.result = `${this.names[w]} wins`; return; }
    const total = this.pool[0] + this.pool[1] + this.bet.amt, mine = this.pool[this.bet.side] + this.bet.amt;
    if (this.bet.side === w) { const pay = Math.floor(this.bet.amt * total / mine); this.salt += pay; this.result = `You win $${pay - this.bet.amt}!`; this.score += pay - this.bet.amt; }
    else this.result = `You lose $${this.bet.amt}`;
    if (this.salt < 10) { this.salt = 100; this.result += ' · bailout: $100'; }
    saveSalt(this.salt);
  }
  // ---------------------------------------------------------------- moves
  floor() { return H - 72; }
  can(f) { return !f.act && f.stun <= 0 && f.down <= 0 && f.hp > 0 && !this.cine; }
  doMove(f, a) {
    if (a === 'jump') { if (this.can(f) && f.y === 0) { f.vy = -600 * Math.sqrt(this.G); f.air = 0; } return; }
    if (f.y < 0 && (a === 'kick' || a === 'punch')) a = a === 'kick' ? 'flyknee' : 'overhead';
    if (f.crouch) a = a === 'kick' ? 'sweep' : a === 'punch' ? 'uppercut' : a;
    // chaining: an attack can cancel into its listed follow-ups right after it connects
    const cancel = f.act && f.landed && MOVES[f.act].chain?.includes(a) && f.at > MOVES[f.act].t * 0.45;
    if (!this.can(f) && !cancel) return;
    if (a === 'special') { const d = Math.abs(this.p[1 - f.i].x - f.x); a = d > 150 ? 'hadouken' : d < 70 ? 'uppercut' : 'spinkick'; }
    f.act = a; f.at = 0; f.hits = 0; f.landed = false;
  }
  ultra(f) {
    if (f.meter < 100 || !this.can(f) || this.cine) return;
    f.meter = 0; const o = this.p[1 - f.i];
    this.cine = { f, o, kind: f.r.ultra.kind, name: f.r.ultra.name, t: 0, hits: 0 };
    this.freeze = 0.9; this.shake = 0.3;
  }
  hit(att, o, dmg, opts = {}) {
    const m = opts.move || {};
    const blocked = o.block > 0 && !o.act && o.down <= 0 && !(m.low && !o.crouch) && !(m.high && o.crouch) && !opts.unblockable;
    const scale = Math.max(0.35, 1 - att.combo * 0.08); // combo damage scaling
    const d = Math.round(dmg * att.pow * (blocked ? 0.15 : scale));
    o.hp = Math.max(0, o.hp - d);
    att.meter = Math.min(100, att.meter + (blocked ? 3 : 8)); o.meter = Math.min(100, o.meter + 5);
    const x = (att.x + o.x) / 2, y = this.floor() - 70 + o.y;
    this.fx.push({ kind: 'num', x: o.x, y: y - 30, s: blocked ? 'BLOCK' : `${d}`, t: 0.8, big: d > 12 });
    if (blocked) { o.x += att.face * 6; this.spark(x, y, '#9ad', 6); return; }
    att.landed = true; att.combo = att.comboT > 0 ? att.combo + 1 : 1; att.comboT = 0.9;
    if (att.combo >= 2) this.comboShow = { f: att.i, n: att.combo, t: 1.2 };
    o.act = null; o.combo = 0;
    if (m.down || o.hp <= 0 || opts.launch) { o.down = o.hp <= 0 ? 99 : 1.4; o.downT = 0; o.stun = 0; o.vx = att.face * (opts.launch || 140); o.vy = -(opts.lift || 260); }
    else { o.stun = m.ball ? 0.45 : 0.35; o.hurtT = 0; o.x += att.face * (m.push || 10); }
    this.freeze = Math.min(0.12, 0.04 + d * 0.004); this.shake = Math.min(0.4, 0.08 + d * 0.01);
    this.spark(x, y, this.col(att.i ? 0 : 3), 10 + d);
  }
  spark(x, y, col, n) { this.burst(x, y, col, n, 220); this.fx.push({ kind: 'ring', x, y, t: 0.25, col }); }
  // ---------------------------------------------------------------- AI
  ai(f, o, dt) {
    f.ai -= dt;
    const dist = Math.abs(o.x - f.x);
    f.block = o.act && dist < 90 && this.rng() < 0.55 ? 0.3 : Math.max(0, f.block - dt);
    f.crouch = false;
    if (f.meter >= 100 && dist < 140 && this.rng() < 0.6) return this.ultra(f);
    // follow a hit with its chain
    if (f.act && f.landed && MOVES[f.act].chain && this.rng() < 0.08) { this.doMove(f, MOVES[f.act].chain[this.ri(0, MOVES[f.act].chain.length - 1)]); return; }
    if (f.ai > 0) return;
    f.ai = this.r(0.12, 0.3) / f.spd;
    if (dist > 170 && this.rng() < 0.3) return this.doMove(f, 'hadouken');
    if (dist > 62) { f.vx = Math.sign(o.x - f.x) * 125 * f.spd; if (this.rng() < 0.07) this.doMove(f, 'jump'); if (dist < 110 && this.rng() < 0.15) this.doMove(f, 'flyknee'); return; }
    f.vx = 0;
    const roll = this.rng();
    if (roll < 0.12) { f.crouch = true; this.doMove(f, 'kick'); }
    else if (roll < 0.2) this.doMove(f, 'overhead');
    else if (roll < 0.3) this.doMove(f, 'special');
    else this.doMove(f, ['punch', 'punch', 'kick', 'palm', 'sidekick', 'flurry'][this.ri(0, 5)]);
    if (this.rng() < 0.12) f.vx = -Math.sign(o.x - f.x) * 150;
  }
  autopilot(dt) { this.ai(this.p[0], this.p[1], dt); }
  // buttons along the bottom: ◀ ▶ ▲ ▼ P K S; ULTRA appears when the meter is full
  down(x, y) {
    const f = this.p[0];
    if (f.meter >= 100 && y > 84 && y < 120 && Math.abs(x - 80) < 70) { this.ultra(f); return; }
    if (y < H - 52) { this.doMove(f, 'punch'); return; }
    const b = Math.floor(x / (W / 7));
    if (b === 0) { f.vx = -140 * f.spd; f.hold = -1; } else if (b === 1) { f.vx = 140 * f.spd; f.hold = 1; } else if (b === 2) this.doMove(f, 'jump'); else if (b === 3) f.crouch = true;
    else this.doMove(f, ['punch', 'kick', 'special'][b - 4]);
  }
  up() { const f = this.p[0]; if (f.hold) { f.vx = 0; f.hold = 0; } f.crouch = false; }
  tap(x, y) { this.down(x, y); this.up(); }
  // ---------------------------------------------------------------- simulation
  step(dt) {
    for (const e of this.fx) e.t -= dt; this.fx = this.fx.filter((e) => e.t > 0);
    if (this.comboShow && (this.comboShow.t -= dt) <= 0) this.comboShow = null;
    this.shake = Math.max(0, this.shake - dt);
    if (this.pause > 0) { this.pause -= dt; if (this.pause <= 0) this.banner = ''; return; }
    if (!this.auto) this.betT = 0;
    if (this.betT > 0) { this.betT -= dt; if (this.betT <= 0) { this.pause = 1; this.banner = 'ROUND 1'; } return; }
    if (this.freeze > 0) { this.freeze -= dt; return; }
    dt *= this.slow;
    if (this.roundOver) { this.stepRoundOver(dt); return; }
    if (this.cine) { this.stepUltra(dt); return; }
    const [a, b] = this.p;
    this.ai(b, a, dt);
    if (!this.auto) a.block = (a.hold && Math.sign(b.x - a.x) === -a.hold) ? 0.2 : 0;
    this.timer -= dt;
    for (const f of this.p) {
      const o = this.p[1 - f.i];
      if (!f.act && f.down <= 0) f.face = Math.sign(o.x - f.x) || f.face;
      f.stun -= dt; f.hurtT = (f.hurtT || 0) + dt; f.comboT -= dt; if (f.comboT <= 0) f.combo = 0;
      if (f.down > 0) {
        f.downT += dt; f.down -= dt;
        f.x += f.vx * dt; f.vx *= 0.92; f.vy += 1500 * this.G * dt; f.y = Math.min(0, f.y + f.vy * dt);
        if (f.down <= 0 && f.hp > 0) { f.getup = 0.5; }
        f.x = Math.max(28, Math.min(W - 28, f.x));
        continue;
      }
      if (f.getup > 0) { f.getup -= dt; continue; }
      if (f.act) {
        const m = MOVES[f.act]; f.at += dt * (m.special ? 1 : f.spd);
        if (m.lunge) f.x += f.face * m.lunge * dt;
        while (f.hits < m.at.length && f.at >= m.at[f.hits] * m.t) {
          f.hits++;
          if (m.ball) this.balls.push({ x: f.x + f.face * 40, y: this.floor() - 62, vx: f.face * 300, owner: f.i, dmg: m.dmg, t: 0 });
          else if (Math.abs(o.x - f.x) < m.reach + 10 && Math.abs(o.y - f.y) < 70 && o.down <= 0) this.hit(f, o, m.dmg, { move: m });
        }
        if (f.at >= m.t) { f.act = null; f.landed = false; }
      }
      if (f.stun <= 0 && !f.act && !f.crouch) f.x += f.vx * dt; else if (!f.act) f.x += f.vx * 0.2 * dt;
      f.vy += 1500 * this.G * dt; f.y = Math.min(0, f.y + f.vy * dt); if (f.y === 0) f.vy = 0;
      f.x = Math.max(28, Math.min(W - 28, f.x));
    }
    if (Math.abs(a.x - b.x) < 34 && a.down <= 0 && b.down <= 0) { const push = (34 - Math.abs(a.x - b.x)) / 2 * Math.sign(a.x - b.x || 1); a.x += push; b.x -= push; }
    for (const ball of this.balls) {
      ball.x += ball.vx * dt; ball.t += dt;
      const o = this.p[1 - ball.owner];
      if (Math.abs(ball.x - o.x) < 26 && o.y > -60 && o.down <= 0) { this.hit(this.p[ball.owner], o, ball.dmg * (ball.big || 1), { move: { ball: 1, push: 20 } }); ball.dead = !ball.big; if (ball.big) ball.big -= 0.25; }
      if (ball.x < -40 || ball.x > W + 40) ball.dead = true;
    }
    this.balls = this.balls.filter((x) => !x.dead);
    this.checkRound();
  }
  checkRound() {
    const [a, b] = this.p;
    if (this.roundOver || !(a.hp <= 0 || b.hp <= 0 || this.timer <= 0)) return;
    const w = a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1;
    if (w >= 0) { this.wins[w]++; this.p[w].victory = true; this.p[w].act = null; }
    this.banner = w < 0 ? 'DRAW' : this.lastUltra && this.lastUltra.f.i === w ? 'ULTRA FINISH' : (this.p[1 - w].hp <= 0 ? 'K.O.' : 'TIME');
    this.roundOver = { t: this.lastUltra ? 3 : 2.2, match: this.wins[0] >= 2 || this.wins[1] >= 2 };
    this.lastUltra = null;
  }
  // the KO plays out (the loser falls, the winner celebrates) before the next round
  stepRoundOver(dt) {
    const ro = this.roundOver; ro.t -= dt; this.slow = Math.min(1, this.slow + dt * 0.4);
    for (const f of this.p) if (f.down > 0 || f.hp <= 0) { f.downT = (f.downT || 0) + dt; f.x = Math.max(28, Math.min(W - 28, f.x + f.vx * dt)); f.vx *= 0.92; f.vy += 1500 * dt; f.y = Math.min(0, f.y + f.vy * dt); }
    if (ro.t > 0) return;
    this.roundOver = null; this.slow = 1;
    if (ro.match) { const mw = this.wins[0] >= 2 ? 0 : 1; this.settle(mw); this.newMatch(); this.pause = 2.5; this.banner = this.result; return; }
    this.round++; this.resetRound();
  }
  // ---------------------------------------------------------------- ultras: scripted sequences with camera effects
  stepUltra(dt) {
    const c = this.cine, f = c.f, o = c.o; c.t += dt;
    const lethal = () => o.hp <= 0;
    if (c.kind === 'barrage') {
      if (c.t < 0.3) f.x += f.face * 420 * dt;
      f.act = c.t < 1.5 ? 'flurry' : 'uppercut'; f.at = c.t < 1.5 ? (c.t % 0.85) : c.t - 1.5;
      if (c.t > 0.35 && c.t < 1.5 && c.t * 10 > c.hits + 4) { c.hits++; this.hit(f, o, 2.5, { unblockable: 1, move: { push: 2 } }); o.stun = 0.4; this.freeze = 0.02; }
      if (c.t > 1.75 && !c.fin) { c.fin = 1; this.hit(f, o, 18, { unblockable: 1, launch: 260, lift: 520, move: { down: 1 } }); this.finishFx(f, o); }
      if (c.t > 2.4) this.endUltra();
    } else if (c.kind === 'beam') {
      f.act = 'hadouken'; f.at = Math.min(MOVES.hadouken.t * 0.6, c.t * 0.6);
      if (c.t > 0.6 && !c.fired) { c.fired = 1; this.balls.push({ x: f.x + f.face * 40, y: this.floor() - 62, vx: f.face * 380, owner: f.i, dmg: 7, big: 1.6, t: 0, beam: 1 }); this.shake = 0.6; }
      if (c.t > 0.6 && this.balls.some((b) => b.beam)) for (const b of this.balls) if (b.beam) { b.x += b.vx * dt; if (Math.abs(b.x - o.x) < 30 && b.cool !== Math.floor(c.t * 8)) { b.cool = Math.floor(c.t * 8); this.hit(f, o, 4, { unblockable: 1, move: { push: 6 } }); o.stun = 0.4; } if (b.x < -60 || b.x > W + 60) b.dead = true; }
      this.balls = this.balls.filter((b) => !b.dead);
      if (c.t > 2 && !c.fin) { c.fin = 1; this.hit(f, o, 10, { unblockable: 1, launch: 300, lift: 420, move: { down: 1 } }); this.finishFx(f, o); }
      if (c.t > 2.6) this.endUltra();
    } else {
      f.act = c.t < 1.6 ? 'spinkick' : 'overhead'; f.at = c.t < 1.6 ? (c.t % 0.9) : c.t - 1.6;
      if (c.t < 1.6) { f.x += f.face * 160 * dt * (Math.abs(o.x - f.x) > 40 ? 1 : 0); f.y = -Math.abs(Math.sin(c.t * 4)) * 30; }
      if (c.t < 1.6 && c.t * 7 > c.hits + 1) { c.hits++; this.hit(f, o, 3, { unblockable: 1, move: { push: 4 } }); o.stun = 0.4; }
      if (c.t > 1.9 && !c.fin) { c.fin = 1; f.y = 0; this.hit(f, o, 16, { unblockable: 1, launch: 200, lift: 380, move: { down: 1 } }); this.finishFx(f, o); }
      if (c.t > 2.5) this.endUltra();
    }
    if (o.down > 0) { o.x += o.vx * dt; o.vy += 1500 * dt; o.y = Math.min(0, o.y + o.vy * dt); o.downT = (o.downT || 0) + dt; }
    if (lethal()) this.slow = 0.35;
  }
  finishFx(f, o) {
    this.shake = 0.8; this.freeze = 0.25;
    for (let k = 0; k < 4; k++) this.fx.push({ kind: 'ring', x: o.x, y: this.floor() - 60, t: 0.4 + k * 0.15, col: this.col(k), big: 1 });
    this.burst(o.x, this.floor() - 60, this.col(0), 60, 420); this.burst(o.x, this.floor() - 60, '#fff', 30, 300);
    if (o.hp <= 0) { this.lastUltra = this.cine; this.fx.push({ kind: 'flash', t: 0.6 }); this.slow = 0.3; }
  }
  endUltra() { const c = this.cine; c.f.act = null; c.f.y = 0; this.cine = null; this.slow = this.lastUltra ? 0.3 : 1; this.checkRound(); }
  // ---------------------------------------------------------------- drawing
  frameOf(f) {
    const A = f.r.anims, pick = (name, k) => { const l = A[name]; return l?.[Math.max(0, Math.min(l.length - 1, Math.floor(k * l.length)))]; };
    if (f.down > 0 || (f.hp <= 0)) return pick('knockdown', Math.min(1, (f.downT || 0) / 0.9));
    if (f.getup > 0) return pick('knockdown', f.getup / 0.5);
    if (f.victory) return pick('dance', (this.t * 0.8) % 1);
    if (f.stun > 0) return pick('hurt', Math.min(1, (f.hurtT || 0) / 0.4));
    if (f.act) return pick(f.act, f.at / MOVES[f.act].t);
    if (f.block > 0) return A.block[A.block.length - 1];
    if (f.y < 0) return pick('jump', 0.35 + Math.min(0.4, -f.vy / 2000));
    if (Math.abs(f.vx) > 1) return pick('walk', (this.t * 1.2) % 1);
    return pick('guard', (this.t * 0.7) % 1);
  }
  legacyFrame(f) {
    const s = f.r.sheet;
    if (f.down > 0 || f.hp <= 0) return s.ko; if (f.stun > 0) return s.hurt; if (f.act) return ['punch', 'palm', 'flurry', 'uppercut', 'overhead'].includes(f.act) ? s.punch : f.act === 'hadouken' ? s.special : s.kick;
    if (f.block > 0) return s.block; if (f.y < 0) return s.jump; if (Math.abs(f.vx) > 1) return s.walk[Math.floor(this.t * 8) % 2]; return s.idle;
  }
  draw(c) {
    c.save();
    if (this.shake) c.translate(this.r(-1, 1) * this.shake * 14, this.r(-1, 1) * this.shake * 10);
    this.clear(c);
    const fl = this.floor(), cine = this.cine;
    if (cine) { c.fillStyle = `rgba(5,2,10,${Math.min(0.75, cine.t * 2)})`; c.fillRect(-20, -20, W + 40, H + 40); for (let i = 0; i < 14; i++) { c.strokeStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.1})`; c.lineWidth = 2; const y = Math.random() * H; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + this.r(-20, 20)); c.stroke(); } }
    c.fillStyle = this.col(2); c.globalAlpha = 0.8; c.fillRect(-20, fl, W + 40, H - fl + 20); c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < W; x += 30) c.fillRect(x, fl, 1, H - fl);
    for (const f of [...this.p].sort((a, b) => (a.act ? 1 : 0) - (b.act ? 1 : 0))) {
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(f.x, fl + 2, 26, 5, 0, 0, 7); c.fill();
      const fr = f.r.ready ? this.frameOf(f) : null, aura = cine && cine.f === f;
      c.save(); c.translate(f.x, fl + f.y + 4); if (f.face < 0) c.scale(-1, 1);
      c.imageSmoothingEnabled = false;
      if (aura) { c.shadowColor = this.col(0); c.shadowBlur = 18 + Math.sin(this.t * 30) * 8; }
      if (fr) c.drawImage(fr, -SZ * DRAW / 2, -SZ * DRAW * 0.94, SZ * DRAW, SZ * DRAW);
      else { const lf = this.legacyFrame(f); c.drawImage(lf, -36, -96, 72, 96); }
      c.restore();
    }
    for (const b of this.balls) {
      const r = (b.beam ? 34 : 12) + Math.sin(b.t * 30) * 3;
      const g = c.createRadialGradient(b.x, b.y, 2, b.x, b.y, r * 1.6); g.addColorStop(0, '#fff'); g.addColorStop(0.35, this.col(1)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, r * 1.6, 0, 7); c.fill();
      if (b.beam) { c.fillStyle = this.col(1); c.globalAlpha = 0.5; c.fillRect(Math.min(b.x, this.cine?.f.x ?? b.x), b.y - r * 0.6, Math.abs(b.x - (this.cine?.f.x ?? b.x)), r * 1.2); c.globalAlpha = 1; }
    }
    for (const e of this.fx) {
      if (e.kind === 'ring') { c.strokeStyle = e.col; c.globalAlpha = Math.min(1, e.t * 4); c.lineWidth = e.big ? 6 : 3; c.beginPath(); c.arc(e.x, e.y, Math.max(2, (e.big ? 180 : 40) * (1 - e.t * (e.big ? 1.6 : 4)) + 6), 0, 7); c.stroke(); c.globalAlpha = 1; }
      else if (e.kind === 'num') { c.globalAlpha = Math.min(1, e.t * 2); this.text(c, e.s, e.x, e.y - (0.8 - e.t) * 40, e.big ? 20 : 14, e.s === 'BLOCK' ? '#9ad' : '#ffd23a'); c.globalAlpha = 1; }
      else if (e.kind === 'flash') { c.fillStyle = `rgba(255,255,255,${e.t})`; c.fillRect(-20, -20, W + 40, H + 40); }
    }
    c.restore();
    // ultra cut-in: a slanted banner with the move's name and the fighter's face
    if (cine && cine.t < 1.1) {
      const k = Math.min(1, cine.t * 4), y = 150;
      c.save(); c.translate((1 - k) * (cine.f.i ? W : -W), 0);
      c.fillStyle = cine.f.i ? '#3a6bd8' : '#d83a3a'; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y - 26); c.lineTo(W, y + 54); c.lineTo(0, y + 80); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y + 40, W, 3);
      const face = cine.f.r.anims.guard?.[0];
      if (face && cine.f.r.ready) { c.imageSmoothingEnabled = false; c.save(); c.beginPath(); c.rect(8, y - 18, 110, 96); c.clip(); c.drawImage(face, -60, y - 40, SZ * 3, SZ * 3); c.restore(); }
      this.text(c, 'ULTRA', 200, y + 6, 14, '#ffd23a'); this.text(c, cine.name.toUpperCase(), 230, y + 30, 16, '#fff');
      c.restore();
    }
    // health, meters, timer
    this.p.forEach((f, i) => {
      const x = i ? W / 2 + 22 : 12, w = W / 2 - 34;
      c.fillStyle = '#2a1e18'; c.fillRect(x, 36, w, 12);
      c.fillStyle = f.hp > f.max * 0.3 ? '#ffd23a' : '#ff5a3a'; const hw = (w * f.hp) / f.max; c.fillRect(i ? x + w - hw : x, 36, hw, 12);
      c.fillStyle = '#1a1420'; c.fillRect(x, 52, w * 0.7, 5); c.fillStyle = f.meter >= 100 ? `hsl(${(this.t * 400) % 360},90%,60%)` : '#8a6cff'; c.fillRect(i ? x + w - w * 0.7 * f.meter / 100 : x, 52, w * 0.7 * f.meter / 100, 5);
      this.text(c, this.names[i].length > 22 ? `${this.names[i].slice(0, 21)}…` : this.names[i], i ? x + w : x, 66, 10, this.pal.ink, i ? 'right' : 'left');
      this.text(c, '●'.repeat(this.wins[i]), i ? x + w - 60 : x + 70, 66, 10, this.col(0));
    });
    this.text(c, String(Math.max(0, Math.ceil(this.timer))), W / 2, 42, 16, this.pal.ink);
    if (this.comboShow) { const cs = this.comboShow; c.globalAlpha = Math.min(1, cs.t * 2); this.text(c, `${cs.n} HIT COMBO!`, cs.f ? W - 80 : 80, 110, 16 + Math.min(10, cs.n), cs.n >= 5 ? '#ff5a3a' : '#ffd23a'); c.globalAlpha = 1; }
    if (this.auto) this.text(c, `$${this.salt}${this.bet ? ` · $${this.bet.amt} on ${this.names[this.bet.side].split(' ')[0]}` : ''}`, W / 2, 80, 10, '#ffd23a');
    if (this.banner) this.text(c, this.banner, W / 2, H / 2 - 50, this.banner.length > 10 ? 22 : 32, this.banner === 'ULTRA FINISH' ? `hsl(${(this.t * 500) % 360},90%,62%)` : this.col(1));
    if (this.betT > 0 && this.auto) this.betPanel(c);
    if (!this.auto) {
      ['◀', '▶', '▲', '▼', 'P', 'K', 'S'].forEach((t, i) => { c.fillStyle = 'rgba(0,0,0,.45)'; roundRect(c, i * (W / 7) + 3, H - 48, W / 7 - 6, 42, 8); c.fill(); this.text(c, t, i * (W / 7) + W / 14, H - 27, 15, '#fff'); });
      if (this.p[0].meter >= 100) { c.fillStyle = `hsl(${(this.t * 300) % 360},80%,45%)`; roundRect(c, 14, 88, 132, 30, 10); c.fill(); this.text(c, 'ULTRA!', 80, 103, 15, '#fff'); }
    }
    if (this.p.some((f) => !f.r.ready)) this.text(c, 'warming up the fighters…', W / 2, H - 60, 10, 'rgba(255,255,255,.6)');
  }
  betPanel(c) {
    c.fillStyle = 'rgba(8,6,5,.88)'; roundRect(c, 8, 84, W - 16, 290, 12); c.fill();
    this.text(c, 'PLACE YOUR BETS', W / 2, 104, 14, '#ffd23a');
    c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(30, 118, W - 60, 4); c.fillStyle = '#ffd23a'; c.fillRect(30, 118, (W - 60) * (this.betT / 8), 4);
    const total = this.pool[0] + this.pool[1] + (this.bet?.amt || 0);
    this.roster.forEach((r, i) => {
      const cx = i ? W * 0.75 : W * 0.25, col = i ? '#4f8cff' : '#ff4f4f', mine = this.bet?.side === i;
      c.fillStyle = mine ? col : 'rgba(255,255,255,.06)'; c.globalAlpha = mine ? 0.35 : 1; roundRect(c, cx - 78, 130, 156, 236, 10); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = col; c.lineWidth = 2; roundRect(c, cx - 78, 130, 156, 236, 10); c.stroke();
      c.save(); c.translate(cx, 238); if (i) c.scale(-1, 1); c.imageSmoothingEnabled = false;
      const fr = r.ready ? r.anims.guard[0] : r.sheet.idle; if (r.ready) c.drawImage(fr, -SZ * 0.6, -SZ * 1.15, SZ * 1.2, SZ * 1.2); else c.drawImage(fr, -30, -88, 60, 80);
      c.restore();
      this.text(c, r.name.length > 20 ? `${r.name.slice(0, 19)}…` : r.name, cx, 256, 10, '#fff');
      [['POW', r.pow], ['SPD', r.spd], ['TUF', r.tough]].forEach(([k, v], j) => { const y = 274 + j * 14; this.text(c, k, cx - 66, y, 9, '#aaa', 'left'); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(cx - 38, y - 3, 100, 6); c.fillStyle = col; c.fillRect(cx - 38, y - 3, 100 * (v - 0.75) / 0.6, 6); });
      const pool = this.pool[i] + (mine ? this.bet.amt : 0);
      this.text(c, `$${pool.toLocaleString()} · ${(total / pool).toFixed(2)}×`, cx, 326, 11, col);
      this.text(c, mine ? `your bet $${this.bet.amt}` : 'tap to bet', cx, 346, 10, mine ? '#ffd23a' : '#ccc');
    });
    this.text(c, `wallet $${this.salt} · tap again to raise · tap outside to play yourself`, W / 2, 384, 9, '#bbb');
  }
  hud() { return `round ${this.round} · $${this.salt}`; }
}
