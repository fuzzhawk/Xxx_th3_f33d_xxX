// Necromancer merge: summon skulls, merge matching undead into stronger tiers,
// and hold the line against waves of heroes marching on your crypt.
import { Game, W, H, roundRect, drawFit } from './engine.js';
import { monster } from './creature.js';
import { Actor } from '../crystal/sprites.js';

const TIERS = ['Skull', 'Skeleton', 'Zombie', 'Ghoul', 'Wraith', 'Lich', 'Bone Golem', 'Dracolich'];
// invaders: Crystal Sprite heroes drawn by their feet (scale matches the old 34×44 / 54×70 boxes)
const HS = 1.45, BS = 2.4, HFEET = 21, BFEET = 36;
const COLS = 5, ROWS = 4, CW = 64, CH = 44, GX = (W - COLS * CW) / 2, GY = 196;

export class Necro extends Game {
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy'];
  setup() {
    const s = this.post.seed || 1;
    this.art = TIERS.map((_, t) => monster(s * 11 + t * 7919, 270 + this.skin.hue * 0.2 + t * 12, 14 + t * 2, t, { tex: this.skin.texFor?.(t), plan: ['blob', 'biped', 'biped', 'quad', 'floater', 'biped', 'totem', 'serpent'][t] }));
    // a varied party of Crystal heroes (never role 0, your own hero, who is on your side)
    this.heroArt = [1, 2, 3, 4, 5, 6].map((k) => this.skin.crystal(k, 'Fantasy'));
    this.bossArt = this.skin.crystal(7, 'Fantasy');
    this.reset();
  }
  reset() {
    this.grid = Array(COLS * ROWS).fill(-1);
    this.souls = 40; this.cost = 8; this.lives = 5; this.wave = 0; this.heroes = []; this.fallen = []; this.vn = 0; this.bolts = []; this.spawnT = 2; this.toSpawn = 0; this.drag = null; this.cool = new Float32Array(COLS * ROWS);
    for (let i = 0; i < 2; i++) this.summon();
  }
  summon() {
    const free = this.grid.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0);
    if (!free.length || this.souls < this.cost) return false;
    this.souls -= this.cost; this.cost = Math.round(this.cost * 1.06 + 0.5);
    this.grid[free[this.ri(0, free.length - 1)]] = 0;
    return true;
  }
  merge(a, b) {
    if (a === b || this.grid[a] < 0 || this.grid[a] !== this.grid[b] || this.grid[a] >= TIERS.length - 1) return false;
    this.grid[b]++; this.grid[a] = -1;
    const [x, y] = this.cellXY(b); this.burst(x, y, this.col(this.grid[b]), 16, 140);
    this.score += 10 * 2 ** this.grid[b];
    return true;
  }
  cellXY(i) { return [GX + (i % COLS) * CW + CW / 2, GY + Math.floor(i / COLS) * CH + CH / 2]; }
  cellAt(x, y) { const c = Math.floor((x - GX) / CW), r = Math.floor((y - GY) / CH); return c >= 0 && c < COLS && r >= 0 && r < ROWS ? r * COLS + c : -1; }
  autopilot(dt) {
    this.thinkT = (this.thinkT || 0) - dt;
    if (this.thinkT > 0) return;
    this.thinkT = this.r(0.25, 0.6);
    for (let t = 0; t < TIERS.length - 1; t++) {
      const cells = this.grid.map((v, i) => (v === t ? i : -1)).filter((i) => i >= 0);
      if (cells.length >= 2) { this.anim = { from: cells[0], to: cells[1], t: 0.25 }; return; }
    }
    this.summon();
  }
  down(x, y) {
    if (y > H - 38) { this.summon(); return; }
    const i = this.cellAt(x, y);
    if (i >= 0 && this.grid[i] >= 0) this.drag = { i, x, y };
  }
  move(x, y) { if (this.drag) { this.drag.x = x; this.drag.y = y; } }
  up(x, y) { if (!this.drag) return; const j = this.cellAt(x, y); if (j >= 0 && j !== this.drag.i) { if (!this.merge(this.drag.i, j) && this.grid[j] < 0) { this.grid[j] = this.grid[this.drag.i]; this.grid[this.drag.i] = -1; } } this.drag = null; }
  tap(x, y) { this.down(x, y); this.drag = null; }
  step(dt) {
    if (this.anim) { this.anim.t -= dt; if (this.anim.t <= 0) { this.merge(this.anim.from, this.anim.to); this.anim = null; } }
    this.souls += dt * (2.5 + this.wave * 0.4);
    // waves
    if (!this.heroes.length && !this.toSpawn) { this.wave++; this.toSpawn = Math.round((3 + this.wave) * (this.mods.swarm ? 1.4 : 1)); this.spawnT = 3; }
    this.spawnT -= dt;
    if (this.toSpawn && this.spawnT <= 0) {
      this.toSpawn--; this.spawnT = this.r(1, 2);
      const boss = this.wave % 5 === 0 && this.toSpawn === 0;
      const hp = (12 + this.wave * 6 + this.wave ** 1.85) * (boss ? 4 : 1);
      const h = { x: this.r(30, W - 30), y: 30, hp, max: hp, speed: this.r(9, 15) * (boss ? 0.6 : 1) * (1 + this.wave * 0.015), art: this.heroArt[this.ri(0, 2)], boss };
      // presentation only (no game rng): who they are and how they act
      const v = this.vis();
      h.actor = new Actor(boss ? this.bossArt : this.heroArt[(this.heroArt.indexOf(h.art) + 3 * (v % 2) + (v >> 3)) % this.heroArt.length], { dir: 'S', walkSpeed: 4, walkStride: 5 * (boss ? BS : HS) });
      h.hurtT = 0; h.castT = boss ? 1 : 1e9;
      if (boss || v % 3 === 0) h.actor.emote('angry', boss ? 0.9 : 0.8);
      this.heroes.push(h);
    }
    for (const h of this.heroes) {
      h.y += h.speed * dt;
      h.hurtT -= dt;
      if (h.boss && (h.castT -= dt) <= 0) { if (h.actor.cast()) { h.castT = 3 + (this.vis() % 3); h.chan = 0.9; } else h.castT = 0.2; } // the boss channels dark spells
      if (h.chan > 0 && (h.chan -= dt) <= 0) h.actor.stopCast();
      h.actor.update(dt, { vx: 0, vy: h.speed });
      if (h.y > GY - 16) { h.dead = true; this.fall(h, true); this.lives--; this.burst(h.x, GY - 10, '#ff5a3a', 20, 200); if (this.lives <= 0) { this.score = Math.max(0, this.score - 500); this.reset(); return; } }
    }
    // minions fire bone bolts at the nearest hero
    this.grid.forEach((t, i) => {
      if (t < 0) return;
      this.cool[i] -= dt;
      if (this.cool[i] > 0) return;
      const [x, y] = this.cellXY(i);
      const target = this.heroes.filter((h) => !h.dead).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (!target) return;
      this.cool[i] = Math.max(0.3, 1 - t * 0.1);
      const a = Math.atan2(target.y - y, target.x - x);
      this.bolts.push({ x, y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, dmg: 6 * 2 ** t, t, life: 1.2 });
    });
    for (const b of this.bolts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      for (const h of this.heroes) if (!h.dead && Math.hypot(h.x - b.x, h.y - b.y) < (h.boss ? 22 : 14)) { h.hp -= b.dmg; b.life = 0; if (h.hp > 0 && h.hurtT <= 0) { h.hurtT = h.boss ? 2.5 : 0.7; h.actor.hurt(); } if (h.hp <= 0) { h.dead = true; this.fall(h, false); this.souls += h.boss ? 80 : 8 + this.wave * 1.5; this.score += h.boss ? 400 : 30; this.burst(h.x, h.y, this.col(4), 12, 150); } break; }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
    this.heroes = this.heroes.filter((h) => !h.dead);
    for (const f of this.fallen) { f.t -= dt; f.h.actor.update(dt); }
    this.fallen = this.fallen.filter((f) => f.t > 0);
  }
  vis() { this.vn = (this.vn * 1103515245 + 12345 + (this.post.seed || 1)) >>> 0; return this.vn >>> 16; }
  // a hero leaves the field: struck down (knockdown, prone, fade) or smashing the crypt door (attack, fade)
  fall(h, crypt) {
    if (crypt) { h.actor.stopCast(); h.actor.attack(); } else h.actor.ko();
    this.fallen.push({ h, t: crypt ? 0.9 : 1.6, crypt });
    if (!crypt) { const near = this.heroes.find((o) => !o.dead && o !== h && Math.hypot(o.x - h.x, o.y - h.y) < 90); if (near && this.vis() % 2) near.actor.emote('surprise', 0.7); }
  }
  draw(c) {
    this.clear(c);
    // the road the heroes march down, and the crypt line
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 22, W, GY - 30);
    c.fillStyle = '#5a1a2a'; c.fillRect(0, GY - 14, W, 6);
    const list = [...this.fallen.map((f) => ({ h: f.h, a: Math.min(1, f.t / 0.5) })), ...this.heroes.map((h) => ({ h, a: 1 }))].sort((p, q) => p.h.y - q.h.y);
    for (const { h, a } of list) {
      const fy = h.y + (h.boss ? BFEET : HFEET);
      c.globalAlpha = 0.35 * a; c.fillStyle = '#000'; c.beginPath(); c.ellipse(h.x, fy - 1, h.boss ? 15 : 9, h.boss ? 5 : 3, 0, 0, 7); c.fill(); c.globalAlpha = 1;
      h.actor.draw(c, h.x, fy, h.boss ? BS : HS, { alpha: a });
    }
    for (const h of this.heroes) { const by = h.y - (h.boss ? 44 : 26); c.fillStyle = '#300'; c.fillRect(h.x - 14, by, 28, 4); c.fillStyle = '#ff5a3a'; c.fillRect(h.x - 14, by, 28 * (h.hp / h.max), 4); }
    for (const b of this.bolts) { c.fillStyle = this.col(4 + (b.t % 2)); c.beginPath(); c.arc(b.x, b.y, 2.5 + b.t * 0.5, 0, 7); c.fill(); }
    for (let i = 0; i < COLS * ROWS; i++) {
      const [x, y] = this.cellXY(i);
      c.fillStyle = 'rgba(255,255,255,.05)'; roundRect(c, x - CW / 2 + 3, y - CH / 2 + 3, CW - 6, CH - 6, 8); c.fill();
      const t = this.grid[i];
      if (t < 0 || this.drag?.i === i || this.anim?.from === i) continue;
      drawFit(c, this.art[t].frames[Math.floor(this.t * 2 + i) % 2], x, y, 30 + t * 4, 30 + t * 4);
      this.text(c, String(t + 1), x + CW / 2 - 10, y - CH / 2 + 10, 9, this.col(t));
    }
    if (this.drag) { const t = this.grid[this.drag.i]; drawFit(c, this.art[t].frames[0], this.drag.x, this.drag.y, 40 + t * 4, 40 + t * 4); }
    if (this.anim) { const [x0, y0] = this.cellXY(this.anim.from), [x1, y1] = this.cellXY(this.anim.to), k = 1 - this.anim.t / 0.25; drawFit(c, this.art[this.grid[this.anim.from]].frames[0], x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 36, 36); }
    const can = this.souls >= this.cost && this.grid.includes(-1);
    c.fillStyle = can ? this.col(0) : '#3a302a'; roundRect(c, 14, H - 34, W - 28, 26, 9); c.fill();
    this.text(c, `SUMMON SKULL · ${this.cost} souls`, W / 2, H - 21, 11, can ? '#1a1410' : '#998');
    this.text(c, `☠ ${Math.floor(this.souls)}   ♥ ${this.lives}   wave ${this.wave}`, W / 2, GY - 24, 11, this.pal.ink);
    const top = Math.max(-1, ...this.grid);
    if (top >= 0) this.text(c, `strongest: ${TIERS[top]}`, W / 2, GY - 38, 10, this.col(4));
  }
  hud() { return `${this.score} · wave ${this.wave}`; }
}
