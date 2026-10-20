// Turn-based monster battles (Pokémon-style) and a 2D fighting game, both with
// procedurally generated casts.
import { Game, W, H, roundRect, drawFit } from './engine.js';
import { monster, humanoid, creatureName } from './creature.js';

// ================================================================ Monster battle
const TYPES = ['Ember', 'Tide', 'Moss', 'Volt', 'Psy', 'Void'];
const TCOL = { Ember: '#ff7a3a', Tide: '#4fa3ff', Moss: '#7cc96a', Volt: '#ffd23a', Psy: '#e07ad8', Void: '#9a8cff' };
const BEATS = { Ember: ['Moss'], Tide: ['Ember'], Moss: ['Tide', 'Volt'], Volt: ['Tide'], Psy: ['Void'], Void: ['Psy', 'Ember'] };
const MOVE_A = { Ember: ['Cinder', 'Blaze', 'Scorch', 'Flare'], Tide: ['Surge', 'Brine', 'Torrent', 'Drizzle'], Moss: ['Spore', 'Thorn', 'Bloom', 'Vine'], Volt: ['Spark', 'Arc', 'Static', 'Jolt'], Psy: ['Mind', 'Dream', 'Hex', 'Echo'], Void: ['Null', 'Rift', 'Shade', 'Abyss'] };
const MOVE_B = ['Lash', 'Burst', 'Fang', 'Wave', 'Strike', 'Pulse', 'Crash', 'Bite', 'Storm', 'Ray'];

function mon(seed, level, hue, skin) {
  const R = (n) => ((Math.sin(seed * 9301 + n * 49297) + 1) / 2);
  const type = TYPES[Math.floor(R(1) * TYPES.length)];
  const base = 40 + Math.floor(R(2) * 30);
  const moves = [0, 1, 2, 3].map((k) => {
    const t = k === 3 ? 'Normal' : k === 2 ? TYPES[Math.floor(R(10 + k) * TYPES.length)] : type;
    return { name: k === 3 ? `Body ${MOVE_B[Math.floor(R(20) * MOVE_B.length)]}` : `${(MOVE_A[t] || MOVE_A.Void)[Math.floor(R(30 + k) * 4)]} ${MOVE_B[Math.floor(R(40 + k) * MOVE_B.length)]}`, type: t, power: [55, 75, 90, 45][k], acc: [1, 0.92, 0.8, 1][k] };
  });
  const hp = Math.round(base * 2 + level * 6);
  return { seed, name: creatureName(seed), type, level, hp, max: hp, atk: 10 + level * 2 + Math.floor(R(3) * 8), def: 8 + level * 2 + Math.floor(R(4) * 8), spd: 5 + Math.floor(R(5) * 10), moves, sprite: monster(seed, hue + TYPES.indexOf(type) * 60, 24, Math.min(4, Math.floor(level / 3)), { tex: skin?.texFor?.(seed % 9), head: skin && (seed % 3 === 0) ? skin.slots.enemy[seed % Math.max(1, skin.slots.enemy.length)] : null }) };
}
export class Monsters extends Game {
  static noMods = ['mirror', 'wobble', 'swarm', 'lowg', 'heavy', 'trails'];
  setup() {
    const s = this.post.seed || 1;
    this.team = [0, 1, 2].map((k) => mon(s * 7 + k * 131, 5, this.skin.hue, this.skin));
    this.trainer = 0; this.newFoe();
  }
  newFoe() {
    const s = (this.post.seed || 1) * 13 + this.trainer * 977;
    this.foes = [0, 1].map((k) => mon(s + k * 61, 4 + this.trainer * 2, this.skin.hue + 180, this.skin));
    this.foe = this.foes[0]; this.me = this.team.find((m) => m.hp > 0) || this.team[0];
    this.queue = [`A wild ${this.foe.name} appears!`]; this.busy = 1.2; this.shake = null; this.lunge = null; this.choice = null;
  }
  eff(t, target) { return BEATS[t]?.includes(target.type) ? 2 : BEATS[target.type]?.includes(t) ? 0.5 : 1; }
  attack(a, d, mv, side) {
    if (this.rng() > mv.acc) { this.queue.push(`${a.name}'s ${mv.name} missed!`); return; }
    const e = this.eff(mv.type, d), crit = this.rng() < 0.08 ? 1.5 : 1;
    const dmg = Math.max(1, Math.round(((2 * a.level / 5 + 2) * mv.power * (a.atk / d.def) / 50 + 2) * e * crit * (mv.type === a.type ? 1.3 : 1) * this.r(0.85, 1)));
    d.hp = Math.max(0, d.hp - dmg);
    this.queue.push(`${a.name} used ${mv.name}!${e > 1 ? ' It\'s super effective!' : e < 1 ? ' Not very effective…' : ''}${crit > 1 ? ' Critical hit!' : ''}`);
    this.lunge = { side, t: 0.35 }; this.shake = { side: 1 - side, t: 0.4 };
    this.burst(side ? 110 : 260, side ? 280 : 120, TCOL[mv.type] || '#fff', 14, 160);
  }
  turn(i) {
    const mv = this.me.moves[i], fm = this.foe.moves[this.ri(0, 3)];
    const first = this.me.spd >= this.foe.spd;
    const order = first ? [[this.me, this.foe, mv, 0], [this.foe, this.me, fm, 1]] : [[this.foe, this.me, fm, 1], [this.me, this.foe, mv, 0]];
    this.steps = order; this.busy = 0.01;
  }
  bestMove() {
    let best = 0, bv = -1;
    this.me.moves.forEach((m, i) => { const v = m.power * m.acc * this.eff(m.type, this.foe) * (m.type === this.me.type ? 1.3 : 1) * this.r(0.8, 1.2); if (v > bv) { bv = v; best = i; } });
    return best;
  }
  autopilot() { if (!this.busy && !this.steps) this.turn(this.bestMove()); }
  down(x, y) { if (this.auto || this.busy || this.steps) return; if (y > H - 96) { const i = (y > H - 48 ? 2 : 0) + (x > W / 2 ? 1 : 0); this.turn(i); } }
  tap(x, y) { this.down(x, y); }
  step(dt) {
    if (this.lunge) { this.lunge.t -= dt; if (this.lunge.t <= 0) this.lunge = null; }
    if (this.shake) { this.shake.t -= dt; if (this.shake.t <= 0) this.shake = null; }
    if (this.busy) { this.busy -= dt; if (this.busy > 0) return; this.busy = 0; if (this.queue.length > 1) { this.queue.shift(); this.busy = 1; return; } }
    if (this.steps) {
      const [a, d, mv, side] = this.steps.shift();
      if (a.hp > 0 && d.hp > 0) this.attack(a, d, mv, side);
      if (!this.steps.length) this.steps = null;
      this.busy = 1.1;
      if (this.foe.hp <= 0) {
        this.queue.push(`${this.foe.name} fainted!`); this.score += 100 * this.foe.level; this.steps = null;
        this.me.level++; this.me.max += 6; this.me.hp = Math.min(this.me.max, this.me.hp + 12);
        const next = this.foes.find((f) => f.hp > 0);
        if (next) { this.foe = next; this.queue.push(`Foe sends out ${next.name}!`); }
        else { this.trainer++; this.team.forEach((m) => (m.hp = Math.max(m.hp, Math.round(m.max * 0.6)))); setTimeout(() => this.newFoe(), 1600); this.busy = 1.6; }
      } else if (this.me.hp <= 0) {
        this.queue.push(`${this.me.name} fainted!`); this.steps = null;
        const next = this.team.find((m) => m.hp > 0);
        if (next) { this.me = next; this.queue.push(`Go, ${next.name}!`); }
        else { this.queue.push('Your team blacked out…'); this.team.forEach((m) => (m.hp = m.max)); this.trainer = Math.max(0, this.trainer - 1); setTimeout(() => this.newFoe(), 1800); this.busy = 1.8; }
      }
    }
  }
  bar(c, m, x, y) {
    c.fillStyle = 'rgba(0,0,0,.55)'; roundRect(c, x, y, 160, 44, 8); c.fill();
    this.text(c, `${m.name}`, x + 10, y + 13, 12, '#fff', 'left');
    this.text(c, `Lv${m.level}`, x + 150, y + 13, 10, '#ddd', 'right');
    c.fillStyle = TCOL[m.type]; roundRect(c, x + 10, y + 22, 40, 12, 4); c.fill(); this.text(c, m.type, x + 30, y + 28, 8, '#111');
    c.fillStyle = '#333'; c.fillRect(x + 56, y + 25, 94, 7);
    const f = m.hp / m.max; c.fillStyle = f > 0.5 ? '#6fd36a' : f > 0.2 ? '#ffd23a' : '#ff5a3a'; c.fillRect(x + 56, y + 25, 94 * f, 7);
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.ellipse(262, 158, 72, 16, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(104, 296, 90, 20, 0, 0, 7); c.fill();
    const lf = (side) => (this.lunge?.side === side ? Math.sin((0.35 - this.lunge.t) * 9) * 18 : 0);
    const sh = (side) => (this.shake?.side === side ? Math.sin(this.t * 60) * 5 : 0);
    if (this.foe.hp > 0) drawFit(c, this.foe.sprite.frames[Math.floor(this.t * 2) % 2], 262 - lf(1) + sh(1), 122 + lf(1) * 0.5, 104, 104);
    if (this.me.hp > 0) drawFit(c, this.me.sprite.frames[Math.floor(this.t * 2 + 1) % 2], 104 + lf(0) + sh(0), 250 - lf(0) * 0.5, 140, 140, 0, true);
    this.bar(c, this.foe, 14, 36); this.bar(c, this.me, W - 174, 214);
    c.fillStyle = 'rgba(10,8,6,.85)'; roundRect(c, 8, H - 146, W - 16, 46, 8); c.fill();
    c.font = '12px ui-monospace, monospace'; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle';
    const msg = this.queue[0] || '';
    const words = msg.split(' '); let line = '', ly = H - 130;
    for (const w of words) { if (c.measureText(line + ' ' + w).width > W - 40) { c.fillText(line, 18, ly); line = w; ly += 15; } else line = (line + ' ' + w).trim(); }
    c.fillText(line, 18, ly);
    this.me.moves.forEach((m, i) => {
      const x = 8 + (i % 2) * (W / 2 - 4), y = H - 94 + Math.floor(i / 2) * 46;
      c.fillStyle = TCOL[m.type] || '#ccc'; c.globalAlpha = this.busy || this.steps ? 0.4 : 0.9; roundRect(c, x, y, W / 2 - 12, 40, 8); c.fill(); c.globalAlpha = 1;
      this.text(c, m.name, x + (W / 2 - 12) / 2, y + 15, 11, '#111');
      this.text(c, `${m.type} · ${m.power}`, x + (W / 2 - 12) / 2, y + 29, 9, '#222');
    });
  }
  hud() { return `trainer ${this.trainer + 1} · ${this.score}`; }
}

// ================================================================ Fighter
const MOVES = { punch: { t: 0.28, hitAt: 0.1, range: 30, dmg: 6, h: 0 }, kick: { t: 0.4, hitAt: 0.18, range: 40, dmg: 9, h: 10 }, special: { t: 0.55, hitAt: 0.3, range: 0, dmg: 12 } };
export class Fighter extends Game {
  static noMods = ['mirror', 'wobble', 'swarm'];
  setup() { this.matchN = 0; this.salt = loadSalt(); this.newMatch(); }
  // each match: two fresh fighters with their own stats, and (on autopilot) a betting window first
  newMatch() {
    const s = (this.post.seed || 1) * 13 + this.matchN * 7919; this.matchN++;
    this.roster = [0, 1].map((k) => {
      const seed = s * 31 + k * 977, head = this.rng() < 0.45 ? this.skin.any('enemy', 'hero', 'item') : null;
      return { sheet: this.matchN === 1 ? this.skin.people[k] : humanoid(seed, this.ri(0, 359), { tex: this.skin.texFor?.(seed % 23), head }), name: `${creatureName(seed)}${this.rng() < 0.6 ? ` ${EPITHETS[this.ri(0, EPITHETS.length - 1)]}` : ''}`, pow: this.r(0.75, 1.35), spd: this.r(0.75, 1.3), tough: this.r(0.8, 1.3) };
    });
    this.names = this.roster.map((r) => r.name);
    const rate = (r) => r.pow * r.spd * r.tough * this.r(0.8, 1.25), ra = rate(this.roster[0]), rb = rate(this.roster[1]), crowd = 3000 + this.ri(0, 12000);
    this.pool = [Math.round(crowd * ra / (ra + rb)), Math.round(crowd * rb / (ra + rb))];
    this.bet = null; this.betT = 8; this.wins = [0, 0]; this.round = 1; this.resetRound();
  }
  resetRound() { this.p = [this.mk(0, 90, 1), this.mk(1, W - 90, -1)]; this.timer = 60; this.balls = []; this.pause = Math.max(this.pause || 0, 1.2); this.banner = `ROUND ${this.round}`; }
  mk(i, x, face) { const r = this.roster[i], max = Math.round((this.mods.glass ? 40 : 100) * r.tough); return { i, x, y: 0, vx: 0, vy: 0, face, hp: max, max, act: null, at: 0, block: false, stun: 0, ai: 0, sheet: r.sheet, pow: r.pow, spd: r.spd }; }
  // taps on the betting panel while the autopilot fights
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
  floor() { return H - 70; }
  doMove(f, a) { if (f.act || f.stun > 0 || f.hp <= 0) return; if (a === 'jump') { if (f.y === 0) f.vy = -560 * Math.sqrt(this.G); return; } f.act = a; f.at = 0; f.hit = false; }
  ai(f, o, dt) {
    f.ai -= dt;
    const dist = Math.abs(o.x - f.x);
    f.block = !!o.act && dist < 70 && this.rng() < 0.6;
    if (f.ai > 0) return;
    f.ai = this.r(0.12, 0.35);
    if (dist > 140 && this.rng() < 0.25) return this.doMove(f, 'special');
    if (dist > 46) { f.vx = Math.sign(o.x - f.x) * 130 * (f.spd || 1); if (this.rng() < 0.08) this.doMove(f, 'jump'); }
    else { f.vx = 0; this.doMove(f, this.rng() < 0.55 ? 'punch' : 'kick'); if (this.rng() < 0.15) f.vx = -Math.sign(o.x - f.x) * 160; }
  }
  autopilot(dt) { this.ai(this.p[0], this.p[1], dt); }
  // buttons along the bottom: ◀ ▶ ▲ P K S, plus hold ◀ (away) to block
  down(x, y) {
    if (y < H - 52) { this.doMove(this.p[0], 'punch'); return; }
    const b = Math.floor(x / (W / 6));
    const f = this.p[0];
    if (b === 0) { f.vx = -140; f.hold = -1; } else if (b === 1) { f.vx = 140; f.hold = 1; } else if (b === 2) this.doMove(f, 'jump');
    else this.doMove(f, ['punch', 'kick', 'special'][b - 3]);
  }
  up() { const f = this.p[0]; if (f.hold) { f.vx = 0; f.hold = 0; } }
  tap(x, y) { this.down(x, y); this.up(); }
  step(dt) {
    if (this.pause > 0) { this.pause -= dt; if (this.pause <= 0) this.banner = ''; return; }
    if (!this.auto) this.betT = 0;
    if (this.betT > 0) { this.betT -= dt; if (this.betT <= 0) { this.pause = 1; this.banner = 'ROUND 1'; } return; }
    const [a, b] = this.p;
    this.ai(b, a, dt);
    if (!this.auto) a.block = a.hold === -a.face || (a.hold && Math.sign(b.x - a.x) === -a.hold);
    this.timer -= dt;
    for (const f of this.p) {
      const o = this.p[1 - f.i];
      f.face = Math.sign(o.x - f.x) || f.face;
      f.stun -= dt;
      if (f.act) {
        const m = MOVES[f.act]; f.at += dt;
        if (!f.hit && f.at >= m.hitAt) {
          f.hit = true;
          if (f.act === 'special') this.balls.push({ x: f.x + f.face * 24, y: this.floor() - 48, vx: f.face * 260, owner: f.i, pow: f.pow || 1 });
          else if (Math.abs(o.x - f.x) < m.range + 14 && Math.abs(o.y - f.y) < 50) this.hitF(o, m.dmg * (f.pow || 1), f.face);
        }
        if (f.at >= m.t) f.act = null;
      }
      if (f.stun <= 0 && !f.act) f.x += f.vx * dt; else f.x += f.vx * 0.2 * dt;
      f.vy += 1500 * this.G * dt; f.y = Math.min(0, f.y + f.vy * dt); if (f.y === 0) f.vy = 0;
      f.x = Math.max(24, Math.min(W - 24, f.x));
    }
    if (Math.abs(a.x - b.x) < 30) { const push = (30 - Math.abs(a.x - b.x)) / 2 * Math.sign(a.x - b.x || 1); a.x += push; b.x -= push; }
    for (const ball of this.balls) {
      ball.x += ball.vx * dt;
      const o = this.p[1 - ball.owner];
      if (Math.abs(ball.x - o.x) < 20 && o.y > -50) { this.hitF(o, MOVES.special.dmg * ball.pow, Math.sign(ball.vx)); ball.dead = true; }
      if (ball.x < -20 || ball.x > W + 20) ball.dead = true;
    }
    this.balls = this.balls.filter((x) => !x.dead);
    if (a.hp <= 0 || b.hp <= 0 || this.timer <= 0) {
      const w = a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1;
      if (w >= 0) this.wins[w]++;
      this.banner = w < 0 ? 'DRAW' : `${this.names[w]} WINS`;
      if (this.wins[0] >= 2 || this.wins[1] >= 2) { const mw = this.wins[0] >= 2 ? 0 : 1; this.settle(mw); this.banner = `${this.names[mw]} WINS`; this.pause = 3; this.newMatch(); this.banner = this.result; return; }
      this.round++; this.pause = 2; const bn = this.banner; this.resetRound(); this.banner = bn;
      setTimeout(() => { if (!this.banner.includes('WINS') && this.banner !== 'DRAW') return; this.banner = `ROUND ${this.round}`; }, 1000);
    }
  }
  hitF(o, dmg, dir) {
    const blocked = o.block && !o.act;
    o.hp = Math.max(0, o.hp - (blocked ? dmg * 0.2 : dmg));
    o.stun = blocked ? 0.1 : 0.3; o.act = null; o.x += dir * (blocked ? 6 : 16);
    this.score += blocked ? 1 : dmg;
    this.burst(o.x, this.floor() - 50 + o.y, blocked ? '#9ad' : this.col(0), blocked ? 4 : 10, 140);
  }
  frameFor(f) {
    const s = f.sheet;
    if (f.hp <= 0 || f.stun > 0) return s.hurt;
    if (f.act) return s[f.act];
    if (f.y < 0) return s.jump;
    if (f.block) return s.block;
    if (Math.abs(f.vx) > 1) return s.walk[Math.floor(this.t * 8) % 2];
    return s.idle;
  }
  draw(c) {
    this.clear(c);
    const fl = this.floor();
    c.fillStyle = this.col(2); c.globalAlpha = 0.8; c.fillRect(0, fl, W, H - fl); c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < W; x += 30) c.fillRect(x, fl, 1, H - fl);
    for (const f of this.p) {
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(f.x, fl + 2, 22, 5, 0, 0, 7); c.fill();
      drawFit(c, this.frameFor(f), f.x, fl - 44 + f.y, 72 * this.S, 99 * this.S, 0, f.face < 0);
    }
    for (const b of this.balls) { c.fillStyle = this.col(1); c.globalAlpha = 0.9; c.beginPath(); c.arc(b.x, b.y, 9, 0, 7); c.fill(); c.globalAlpha = 0.35; c.beginPath(); c.arc(b.x - Math.sign(b.vx) * 10, b.y, 12, 0, 7); c.fill(); c.globalAlpha = 1; }
    // health bars
    this.p.forEach((f, i) => {
      const x = i ? W / 2 + 22 : 12, w = W / 2 - 34;
      c.fillStyle = '#2a1e18'; c.fillRect(x, 36, w, 12);
      c.fillStyle = f.hp > f.max * 0.3 ? '#ffd23a' : '#ff5a3a'; const hw = (w * f.hp) / f.max; c.fillRect(i ? x + w - hw : x, 36, hw, 12);
      this.text(c, this.names[i], i ? x + w : x, 58, 10, this.pal.ink, i ? 'right' : 'left');
      this.text(c, '●'.repeat(this.wins[i]), i ? x + w - 60 : x + 70, 58, 10, this.col(0));
    });
    this.text(c, String(Math.max(0, Math.ceil(this.timer))), W / 2, 42, 16, this.pal.ink);
    if (this.banner) this.text(c, this.banner, W / 2, H / 2 - 40, 26, this.col(1));
    if (this.auto) this.text(c, `$${this.salt}${this.bet ? ` · $${this.bet.amt} on ${this.names[this.bet.side].split(' ')[0]}` : ''}`, W / 2, 72, 10, '#ffd23a');
    if (this.betT > 0 && this.auto) this.betPanel(c);
    if (!this.auto) ['◀', '▶', '▲', 'P', 'K', 'S'].forEach((t, i) => { c.fillStyle = 'rgba(0,0,0,.45)'; roundRect(c, i * (W / 6) + 4, H - 48, W / 6 - 8, 42, 8); c.fill(); this.text(c, t, i * (W / 6) + W / 12, H - 27, 16, '#fff'); });
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
      drawFit(c, r.sheet.idle, cx, 196, 72, 96, 0, i === 1);
      this.text(c, r.name.length > 20 ? `${r.name.slice(0, 19)}…` : r.name, cx, 256, 10, '#fff');
      [['POW', r.pow], ['SPD', r.spd], ['TUF', r.tough]].forEach(([k, v], j) => { const y = 274 + j * 14; this.text(c, k, cx - 66, y, 9, '#aaa', 'left'); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(cx - 38, y - 3, 100, 6); c.fillStyle = col; c.fillRect(cx - 38, y - 3, 100 * (v - 0.7) / 0.7, 6); });
      const pool = this.pool[i] + (mine ? this.bet.amt : 0);
      this.text(c, `$${pool.toLocaleString()} · ${(total / pool).toFixed(2)}×`, cx, 326, 11, col);
      this.text(c, mine ? `your bet $${this.bet.amt}` : 'tap to bet', cx, 346, 10, mine ? '#ffd23a' : '#ccc');
    });
    this.text(c, `wallet $${this.salt} · tap again to raise · tap outside to play yourself`, W / 2, 384, 9, '#bbb');
  }
  hud() { return `round ${this.round} · $${this.salt}`; }
}
const EPITHETS = ['the Unwashed', 'of the Ninth Circle', 'Jr.', 'the Inevitable', 'Who Shall Not Be Named', 'the Moist', 'from Accounting', 'the Thrice-Banned', 'XXL', 'of Ill Repute', 'the Beige', 'Prime', 'the Damp Knight', '(Mythic Tier)', 'the Unlikely', 'Classic', 'with a Chair'];
const loadSalt = () => { try { return +localStorage.getItem('feed-salt') || 400; } catch { return 400; } };
const saveSalt = (v) => { try { localStorage.setItem('feed-salt', String(v)); } catch { /* private mode */ } };
