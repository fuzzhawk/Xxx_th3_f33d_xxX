// Turn-based monster battles (Pokémon-style) with a procedurally generated cast.
// (The fighting game lives in brawl.js.)
import { Game, W, H, roundRect, drawFit } from './engine.js';
import { monster, creatureName } from './creature.js';

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
