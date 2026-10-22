// Vampire Survivors-style horde game in a cellular-automata cave. Weapons fire on
// their own; you only move. Shots, bombs and the aura chew through the rock, so the
// cave opens up as you fight. Level up to pick upgrades.
// The hero is a Crystal Sprite: runs in 8 directions, shoots the wand, swings the
// whip, casts bombs, flinches when bitten, kneels when nearly dead, cheers on a
// level-up and is knocked down when the horde wins.
import { Game, W, H, drawFit, ready } from './engine.js';
import { Actor, dirOf } from '../crystal/sprites.js';

const C = 10, G = 72, WW = C * G;
const WEAPONS = {
  wand: { name: 'Wand', desc: 'shoots the nearest foe' },
  whip: { name: 'Whip', desc: 'lashes left and right' },
  orbit: { name: 'Orbiters', desc: 'things circle you' },
  aura: { name: 'Stink Aura', desc: 'hurts and erodes rock nearby' },
  bomb: { name: 'Bombs', desc: 'blast foes and tunnels' }
};
const PASSIVE = { speed: 'Boots: move faster', magnet: 'Magnet: grab gems from further', heart: 'Heart: +30 max hp, heal', haste: 'Haste: all weapons faster' };

export class Survivors extends Game {
  static noMods = ['mirror', 'lowg', 'heavy', 'wobble'];
  setup() {
    this.cells = new Uint8Array(G * G);
    let a = Array.from({ length: G * G }, () => (this.rng() < 0.47 ? 1 : 0));
    for (let it = 0; it < 5; it++) {
      const b = a.slice();
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; n += X < 0 || Y < 0 || X >= G || Y >= G ? 1 : a[Y * G + X]; }
        const w = a[y * G + x];
        b[y * G + x] = (w && n >= 4) || (!w && n >= 5) || (n <= 1 && it < 2) ? 1 : 0;
      }
      a = b;
    }
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const edge = x < 1 || y < 1 || x >= G - 1 || y >= G - 1, centre = Math.hypot(x - G / 2, y - G / 2) < 6;
      this.cells[y * G + x] = edge ? 9 : centre ? 0 : a[y * G + x] ? 1 + Math.floor(this.rng() * 3) : 0;
    }
    this.world = Object.assign(document.createElement('canvas'), { width: WW, height: WW });
    this.wx = this.world.getContext('2d');
    this.painted = false;
    this.p = { x: WW / 2, y: WW / 2, hp: 100, max: 100, sp: 70, face: 1, inv: 0 };
    this.weapons = { wand: 1 }; this.passive = {}; this.cd = {};
    // feet sit 9px below the hitbox centre, as the old 24px figure did
    this.hero = new Actor(this.skin.crystal(0, 'Fantasy'), { runSpeed: 50, walkStride: 5, runStride: 7 });
    this.pend = {}; this.dying = 0; this.pickIn = 0;
    this.lvl = 1; this.xp = 0; this.need = 5; this.kills = 0;
    this.foes = []; this.shots = []; this.gems = []; this.booms = []; this.slashes = [];
    this.spawnT = 0; this.flowT = 0; this.dist = new Int16Array(G * G);
    this.pick = null; this.joy = null; this.clock = 0;
  }
  solid(x, y) { const cx = Math.floor(x / C), cy = Math.floor(y / C); return cx < 0 || cy < 0 || cx >= G || cy >= G || this.cells[cy * G + cx] > 0; }
  dig(x, y, dmg = 1) {
    const cx = Math.floor(x / C), cy = Math.floor(y / C), i = cy * G + cx;
    if (cx < 0 || cy < 0 || cx >= G || cy >= G) return;
    const v = this.cells[i];
    if (!v || v === 9) return;
    this.cells[i] = Math.max(0, v - dmg);
    if (!this.cells[i]) { this.paintCell(cx, cy); if (this.rng() < 0.3) this.burst(cx * C + C / 2 - this.camX, cy * C + C / 2 - this.camY, this.col(2), 4, 60); if (this.rng() < 0.04) this.gems.push({ x: cx * C + C / 2, y: cy * C + C / 2, v: 1 }); }
    else this.paintCell(cx, cy);
  }
  digCircle(x, y, r, dmg) { for (let yy = y - r; yy <= y + r; yy += C) for (let xx = x - r; xx <= x + r; xx += C) if (Math.hypot(xx - x, yy - y) <= r) this.dig(xx, yy, dmg); }
  paint() {
    const x = this.wx, floor = this.skin.slots.tile[1] || this.skin.slots.tile[0], rock = this.skin.slots.tile[0];
    this.floorPat = ready(floor) ? x.createPattern(floor, 'repeat') : null;
    this.rockPat = ready(rock) ? x.createPattern(rock, 'repeat') : null;
    for (let cy = 0; cy < G; cy++) for (let cx = 0; cx < G; cx++) this.paintCell(cx, cy);
    this.painted = !!(this.floorPat && this.rockPat) || this.clock > 3;
  }
  paintCell(cx, cy) {
    const x = this.wx, v = this.cells[cy * G + cx], X = cx * C, Y = cy * C;
    if (!v) {
      x.fillStyle = this.pal.bg; x.fillRect(X, Y, C, C);
      if (this.floorPat) { x.globalAlpha = 0.18; x.fillStyle = this.floorPat; x.fillRect(X, Y, C, C); x.globalAlpha = 1; }
      return;
    }
    x.fillStyle = v === 9 ? this.pal.bg : this.col(v === 1 ? 5 : v === 2 ? 2 : 3); x.fillRect(X, Y, C, C);
    if (this.rockPat) { x.globalCompositeOperation = 'multiply'; x.fillStyle = this.rockPat; x.fillRect(X, Y, C, C); x.globalCompositeOperation = 'source-over'; }
    // darker where the rock meets open floor
    x.fillStyle = 'rgba(0,0,0,.35)';
    if (cy + 1 < G && !this.cells[(cy + 1) * G + cx]) x.fillRect(X, Y + C - 3, C, 3);
    if (cy > 0 && !this.cells[(cy - 1) * G + cx]) { x.fillStyle = 'rgba(255,240,220,.18)'; x.fillRect(X, Y, C, 2); }
    if (v < 3 && v !== 9) { x.strokeStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.moveTo(X + 2, Y + 3); x.lineTo(X + 6, Y + 7); x.stroke(); }
  }
  // breadth-first distances from the player, so the horde finds its way through the cave
  flow() {
    const d = this.dist; d.fill(-1);
    const s = Math.floor(this.p.y / C) * G + Math.floor(this.p.x / C), q = [s]; d[s] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % G, y = (i / G) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, j = Y * G + X;
        if (X < 0 || Y < 0 || X >= G || Y >= G || d[j] >= 0 || this.cells[j]) continue;
        d[j] = d[i] + 1; q.push(j);
      }
    }
  }
  spawn() {
    const p = this.p, tier = Math.floor(this.clock / 40);
    for (let k = 0; k < 20; k++) {
      const a = this.r(0, 7), r = this.r(220, 300), x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (this.solid(x, y) || (k < 15 && this.dist[Math.floor(y / C) * G + Math.floor(x / C)] < 0)) continue;
      const kind = this.ri(0, Math.min(5, 1 + tier));
      const big = this.rng() < 0.04 + tier * 0.01;
      this.foes.push({ x, y, hp: (5 + this.clock * 0.08) * (big ? 6 : 1) * (1 + kind * 0.25), sp: this.r(20, 30) + kind * 2, kind, big, ph: this.r(0, 7), r: big ? 12 : 7 });
      return;
    }
  }
  move(x, y) { if (this.joy) { this.joy.x = x; this.joy.y = y; } }
  down(x, y) {
    if (this.pick) { if (this.pickIn > 0) return; const k = Math.floor((y - 120) / 70); if (x > 30 && x < W - 30 && k >= 0 && k < this.pick.length) this.choose(this.pick[k]); return; }
    this.joy = { ox: x, oy: y, x, y };
  }
  up() { this.joy = null; }
  tap(x, y) { this.down(x, y); this.joy = null; }
  levelUp() {
    this.lvl++; this.xp -= this.need; this.need = Math.round(this.need * 1.25 + 3);
    const opts = [...Object.keys(WEAPONS).map((k) => ({ k, w: 1 })), ...Object.keys(PASSIVE).map((k) => ({ k, w: 0 }))].filter((o) => (o.w ? (this.weapons[o.k] || 0) < 6 : (this.passive[o.k] || 0) < 4));
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    this.pick = opts.slice(0, 3); this.pickT = this.r(0.8, 1.5);
    // a short cheer before the upgrade menu comes up
    this.pickIn = 0.9; this.hero.emote('cheer', 0.9);
  }
  choose(o) {
    if (o.w) this.weapons[o.k] = (this.weapons[o.k] || 0) + 1;
    else { this.passive[o.k] = (this.passive[o.k] || 0) + 1; if (o.k === 'heart') { this.p.max += 30; this.p.hp = this.p.max; } }
    this.pick = null;
  }
  autopilot(dt) {
    if (this.pick) { if (this.pickIn > 0) return; this.pickT -= dt; if (this.pickT <= 0) this.choose(this.pick.find((o) => o.w && !this.weapons[o.k]) || this.pick[0]); return; }
    const p = this.p;
    let mx = 0, my = 0;
    for (const f of this.foes) { const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) + 1; if (d < 110) { mx += dx / d * (110 - d) / 30; my += dy / d * (110 - d) / 30; } }
    const g = this.gems.reduce((b, g) => { const d = Math.hypot(g.x - p.x, g.y - p.y); return d < 160 && (!b || d < b.d) ? { g, d } : b; }, null);
    if (g) { mx += (g.g.x - p.x) / g.d * 1.2; my += (g.g.y - p.y) / g.d * 1.2; }
    // prefer open space: sample eight directions
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, cx = Math.cos(a), cy = Math.sin(a); let free = 0; for (let s = 1; s <= 4; s++) if (!this.solid(p.x + cx * s * 12, p.y + cy * s * 12)) free++; else break; mx += cx * (free - 2) * 0.25; my += cy * (free - 2) * 0.25; }
    this.wander = (this.wander || 0) + this.r(-1, 1) * dt * 2;
    mx += Math.cos(this.wander) * 0.4; my += Math.sin(this.wander) * 0.4;
    const m = Math.hypot(mx, my);
    this.autoMove = m > 0.1 ? { x: mx / m, y: my / m } : null;
  }
  nearest(r = 999) { let b = null, bd = r; for (const f of this.foes) { const d = Math.hypot(f.x - this.p.x, f.y - this.p.y); if (d < bd) { bd = d; b = f; } } return b; }
  hit(f, dmg) { f.hp -= dmg; f.flash = 0.08; if (f.hp <= 0 && !f.dead) { f.dead = true; this.kills++; this.score += f.big ? 50 : 5; this.gems.push({ x: f.x, y: f.y, v: f.big ? 8 : 1 }); } }
  step(dt) {
    if (!this.painted && (this.paintT = (this.paintT || 0) - dt) <= 0) { this.paintT = 0.5; this.paint(); }
    if (this.pick || this.dying) {
      this.runPending(this.hero.update(dt, { lowHealth: !this.dying && this.p.hp < this.p.max * 0.25 }));
      if (this.pick && this.pickIn > 0) { this.pickIn -= dt; if (this.hero.a.action !== 'cheer' && this.pickIn > 0.2) this.hero.emote('cheer', this.pickIn); }
      if (this.dying && (this.dying -= dt) <= 0) this.gameOver();
      return;
    }
    this.clock += dt;
    const p = this.p, haste = 1 + (this.passive.haste || 0) * 0.15;
    let mv = this.auto ? this.autoMove : null;
    if (!this.auto && this.joy) { const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy); if (d > 6) mv = { x: dx / d * Math.min(1, d / 30), y: dy / d * Math.min(1, d / 30) }; }
    const ox = p.x, oy = p.y, act = this.hero.a.action;
    if (mv) {
      // a swing or a flinch slows you down; shooting and casting don't
      const sp = p.sp * (1 + (this.passive.speed || 0) * 0.12) * dt * (act === 'attack' ? 0.45 : act === 'flinch' ? 0.6 : 1), r = 5;
      const nx = p.x + mv.x * sp; if (!this.solid(nx + Math.sign(mv.x) * r, p.y - r) && !this.solid(nx + Math.sign(mv.x) * r, p.y + r)) p.x = nx;
      const ny = p.y + mv.y * sp; if (!this.solid(p.x - r, ny + Math.sign(mv.y) * r) && !this.solid(p.x + r, ny + Math.sign(mv.y) * r)) p.y = ny;
      if (Math.abs(mv.x) > 0.2) p.face = Math.sign(mv.x);
      p.walk = (p.walk || 0) + dt;
    }
    this.runPending(this.hero.update(dt, { vx: (p.x - ox) / dt, vy: (p.y - oy) / dt, lowHealth: p.hp < p.max * 0.25 }));
    p.inv -= dt; p.hp = Math.min(p.max, p.hp + dt * (1 + (this.passive.heart || 0)));
    // weapons
    const cd = (k, t) => { this.cd[k] = (this.cd[k] || 0) - dt * haste; if (this.cd[k] <= 0) { this.cd[k] = t; return true; } return false; };
    const L = this.weapons;
    // wand = shoot (bolt leaves on 'fire'), whip = attack (lands on 'hit'), bombs = cast (thrown on 'cast')
    if (L.wand && cd('wand', 1.1 / (1 + L.wand * 0.25)) && this.nearest(260)) {
      const f0 = this.nearest(260); if (!mv) this.hero.face(dirOf(f0.x - p.x, f0.y - p.y));
      this.queue('wand', 'shoot', () => { for (let k = 0; k < Math.ceil(L.wand / 2); k++) { const f = this.nearest(260); if (!f) break; const a = Math.atan2(f.y - p.y, f.x - p.x) + (k ? this.r(-0.3, 0.3) : 0); this.shots.push({ x: p.x, y: p.y - 8, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, a, life: 1.2, dmg: 6 + L.wand * 2, pierce: Math.floor(L.wand / 3) }); } });
    }
    if (L.whip && cd('whip', 1.4 / (1 + L.whip * 0.15))) {
      this.hero.face(p.face < 0 ? 'W' : 'E');
      this.queue('whip', 'attack', () => { for (const s of L.whip > 2 ? [1, -1] : [p.face]) { this.slashes.push({ s, t: 0.2 }); for (const f of this.foes) if (Math.sign(f.x - p.x) === s && Math.abs(f.x - p.x) < 60 + L.whip * 6 && Math.abs(f.y - p.y) < 18) this.hit(f, 10 + L.whip * 4); this.digCircle(p.x + s * 40, p.y, 12, 1); } });
    }
    if (L.orbit) { const n = 1 + L.orbit, R2 = 34 + L.orbit * 3; for (let k = 0; k < n; k++) { const a = this.t * 3 + k * Math.PI * 2 / n, ox = p.x + Math.cos(a) * R2, oy = p.y + Math.sin(a) * R2; for (const f of this.foes) if (Math.hypot(f.x - ox, f.y - oy) < f.r + 7) this.hit(f, 30 * dt * (1 + L.orbit * 0.3)); if (this.rng() < dt * 6) this.dig(ox, oy, 1); } }
    if (L.aura) { const R2 = 30 + L.aura * 6; for (const f of this.foes) if (Math.hypot(f.x - p.x, f.y - p.y) < R2) this.hit(f, (6 + L.aura * 3) * dt); if (this.rng() < dt * 3 * L.aura) { const a = this.r(0, 7); this.dig(p.x + Math.cos(a) * R2, p.y + Math.sin(a) * R2, 1); } }
    if (L.bomb && cd('bomb', 3.2 / (1 + L.bomb * 0.2))) this.queue('bomb', 'cast', () => { const f = this.nearest(200); const a = f ? Math.atan2(f.y - p.y, f.x - p.x) : this.r(0, 7), d = f ? Math.min(140, Math.hypot(f.x - p.x, f.y - p.y)) : 80; this.booms.push({ x: p.x, y: p.y - 14, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d, t: 0.6, r: 34 + L.bomb * 6 }); });
    for (const b of this.shots) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (this.solid(b.x, b.y)) { this.dig(b.x, b.y, 1); b.life = 0; }
      for (const f of this.foes) if (!f.dead && b.life > 0 && Math.hypot(f.x - b.x, f.y - b.y) < f.r + 3) { this.hit(f, b.dmg); if (b.pierce-- <= 0) b.life = 0; }
    }
    for (const b of this.booms) { b.t -= dt; if (b.t <= 0 && !b.done) { b.done = true; b.flash = 0.25; this.digCircle(b.tx, b.ty, b.r, 3); for (const f of this.foes) if (Math.hypot(f.x - b.tx, f.y - b.ty) < b.r) this.hit(f, 25 + L.bomb * 8); this.burst(b.tx - this.camX, b.ty - this.camY, this.col(0), 20, 200); } if (b.done) b.flash -= dt; }
    for (const s of this.slashes) s.t -= dt;
    // horde
    this.flowT -= dt; if (this.flowT <= 0) { this.flowT = 0.35; this.flow(); }
    this.spawnT -= dt;
    const rate = (0.9 + this.clock / 35) * (this.mods.swarm ? 1.6 : 1);
    if (this.spawnT <= 0 && this.foes.length < 160) { this.spawnT = 1 / rate; this.spawn(); }
    for (const f of this.foes) {
      f.ph += dt; f.flash = Math.max(0, (f.flash || 0) - dt);
      const cx = Math.floor(f.x / C), cy = Math.floor(f.y / C), here = this.dist[cy * G + cx];
      let tx = p.x, ty = p.y;
      if (here > 1) {
        let best = here;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const v = this.dist[(cy + dy) * G + cx + dx]; if (v >= 0 && v < best && !this.cells[(cy + dy) * G + cx] && !this.cells[cy * G + cx + dx]) { best = v; tx = (cx + dx + 0.5) * C; ty = (cy + dy + 0.5) * C; } }
      }
      const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) + 0.01;
      let nx = f.x + dx / d * f.sp * dt, ny = f.y + dy / d * f.sp * dt;
      if (this.solid(nx, ny)) { if (here < 0 && this.rng() < dt * 2) this.dig(nx, ny, 1); nx = f.x; ny = f.y; }
      f.x = nx; f.y = ny;
      if (p.inv <= 0 && !this.dying && Math.hypot(f.x - p.x, f.y - p.y) < f.r + 5) { p.hp -= (f.big ? 10 : 5) * (this.mods.glass ? 2 : 1); p.inv = 0.4; if (p.hp <= 0) this.die(); else this.hero.hurt(); }
    }
    // keep the horde from stacking into one blob
    for (let i = 0; i < this.foes.length; i++) for (let j = i + 1; j < this.foes.length; j++) {
      const a = this.foes[i], b = this.foes[j], dx = b.x - a.x, dy = b.y - a.y, m = a.r + b.r;
      if (Math.abs(dx) > m || Math.abs(dy) > m) continue;
      const d = Math.hypot(dx, dy) + 0.01; if (d < m) { const o = (m - d) / 2 / d; if (!this.solid(a.x - dx * o, a.y - dy * o)) { a.x -= dx * o; a.y -= dy * o; } if (!this.solid(b.x + dx * o, b.y + dy * o)) { b.x += dx * o; b.y += dy * o; } }
    }
    const mag = 30 + (this.passive.magnet || 0) * 25;
    for (const g of this.gems) { const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy); if (d < mag) { g.x += dx / d * 180 * dt; g.y += dy / d * 180 * dt; } if (d < 8) { g.got = true; this.xp += g.v; this.score += g.v; } }
    this.gems = this.gems.filter((g) => !g.got);
    this.foes = this.foes.filter((f) => !f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 520);
    this.shots = this.shots.filter((b) => b.life > 0); this.booms = this.booms.filter((b) => !b.done || b.flash > 0); this.slashes = this.slashes.filter((s) => s.t > 0);
    if (this.xp >= this.need) this.levelUp();
  }
  // start a weapon's animation; its effect runs on the matching event, or at once if
  // the animation can't play or gets cut off (a flinch interrupting a swing)
  queue(k, anim, fn) {
    if (this.pend[k]) this.pend[k].fn();
    const ok = anim === 'shoot' ? this.hero.shoot() : anim === 'attack' ? this.hero.attack() : this.hero.cast();
    if (ok) this.pend[k] = { anim, fn }; else { delete this.pend[k]; fn(); }
  }
  runPending(evs) {
    for (const [k, q] of Object.entries(this.pend)) {
      const ev = q.anim === 'shoot' ? 'fire' : q.anim === 'attack' ? 'hit' : 'cast';
      if (evs.includes(ev) || this.hero.a.action !== q.anim) { delete this.pend[k]; q.fn(); if (q.anim === 'cast') this.hero.stopCast(); }
    }
  }
  die() { const p = this.p; this.burst(p.x - this.camX, p.y - this.camY, this.col(0), 30, 200); this.pend = {}; this.hero.ko(); this.dying = 2.2; }
  gameOver() { this.best = Math.max(this.best, this.score); const keep = this.score; this.setup(); this.msg = { s: `DEVOURED · ${keep}`, t: 2.5 }; }
  draw(c) {
    const p = this.p;
    this.camX = Math.max(0, Math.min(WW - W, p.x - W / 2)); this.camY = Math.max(0, Math.min(WW - H, p.y - H / 2));
    c.fillStyle = this.pal.bg; c.fillRect(0, 0, W, H);
    c.drawImage(this.world, this.camX, this.camY, W, H, 0, 0, W, H);
    c.save(); c.translate(-this.camX, -this.camY);
    for (const g of this.gems) { c.fillStyle = g.v > 1 ? this.col(0) : this.col(4); c.beginPath(); c.moveTo(g.x, g.y - 4); c.lineTo(g.x + 3, g.y); c.lineTo(g.x, g.y + 4); c.lineTo(g.x - 3, g.y); c.fill(); }
    const L = this.weapons;
    if (L.aura) { c.fillStyle = this.col(2); c.globalAlpha = 0.12 + Math.sin(this.t * 5) * 0.04; c.beginPath(); c.arc(p.x, p.y, 30 + L.aura * 6, 0, 7); c.fill(); c.globalAlpha = 1; }
    const enemyImgs = this.skin.list('foes', 3, 'enemy', 'monster', 'animal');
    // foes and hero drawn back to front by their feet
    const ents = this.foes.filter((f) => !(f.x < this.camX - 30 || f.x > this.camX + W + 30 || f.y < this.camY - 30 || f.y > this.camY + H + 30)).map((f) => ({ f, y: f.y + f.r }));
    ents.push({ y: p.y + 9 });
    ents.sort((a, b) => a.y - b.y);
    for (const { f } of ents) {
      if (!f) {
        if (this.dying || p.inv <= 0 || Math.floor(this.t * 15) % 2) this.hero.draw(c, p.x, p.y + 9, 1, { alpha: this.dying ? Math.min(1, this.dying / 0.8) : 1 });
        continue;
      }
      const cr = this.skin.creatures[f.kind % 6], im = f.kind >= 3 && enemyImgs[f.kind - 3] ? enemyImgs[f.kind - 3] : cr.frames[Math.floor(f.ph * 4) % 2], s = f.r * 2.6;
      if (f.flash) c.filter = 'brightness(2.5)';
      if (!drawFit(c, im, f.x, f.y + Math.sin(f.ph * 10) * 1, s, s, 0, f.x > p.x)) { c.fillStyle = this.col(f.kind); c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.fill(); }
      c.filter = 'none';
    }
    if (L.orbit) { const n = 1 + L.orbit, R2 = 34 + L.orbit * 3, im = this.skin.pick('orbit', 'item', 'ball', 'prop'); for (let k = 0; k < n; k++) { const a = this.t * 3 + k * Math.PI * 2 / n; if (!drawFit(c, im, p.x + Math.cos(a) * R2, p.y + Math.sin(a) * R2, 14, 14, a)) { c.fillStyle = this.col(1); c.beginPath(); c.arc(p.x + Math.cos(a) * R2, p.y + Math.sin(a) * R2, 5, 0, 7); c.fill(); } } }
    const bim = this.skin.pick('bullet', 'item', 'fx', 'ball');
    for (const b of this.shots) if (!drawFit(c, bim, b.x, b.y, 10, 10, b.a)) { c.fillStyle = this.col(4); c.beginPath(); c.arc(b.x, b.y, 3, 0, 7); c.fill(); }
    for (const b of this.booms) {
      if (!b.done) { const k = 1 - b.t / 0.6, x = b.x + (b.tx - b.x) * k, y = b.y + (b.ty - b.y) * k - Math.sin(k * Math.PI) * 30; drawFit(c, this.skin.pick('bomb', 'item', 'ball'), x, y, 12, 12, k * 8) || (c.fillStyle = this.col(0), c.fillRect(x - 4, y - 4, 8, 8)); }
      else { c.fillStyle = this.col(0); c.globalAlpha = Math.max(0, b.flash * 3); c.beginPath(); c.arc(b.tx, b.ty, b.r, 0, 7); c.fill(); c.globalAlpha = 1; }
    }
    for (const s of this.slashes) { c.strokeStyle = this.pal.ink; c.globalAlpha = s.t * 4; c.lineWidth = 6; c.beginPath(); c.ellipse(p.x + s.s * 40, p.y, 40, 10, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
    c.restore();
    // HUD
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(0, H - 10, W, 10);
    c.fillStyle = this.col(4); c.fillRect(0, H - 10, W * Math.min(1, this.xp / this.need), 10);
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(W - 92, 42, 80, 7); c.fillStyle = this.col(0); c.fillRect(W - 92, 42, 80 * Math.max(0, p.hp / p.max), 7);
    this.text(c, `LV ${this.lvl}  ${Math.floor(this.clock / 60)}:${String(Math.floor(this.clock % 60)).padStart(2, '0')}`, W - 12, 30, 11, this.pal.ink, 'right');
    if (this.pick && this.pickIn <= 0) {
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H);
      this.text(c, 'LEVEL UP', W / 2, 96, 18, this.pal.ink);
      this.pick.forEach((o, k) => {
        const y = 120 + k * 70;
        c.fillStyle = this.pal.bg2; c.fillRect(30, y, W - 60, 60); c.strokeStyle = this.col(k); c.lineWidth = 2; c.strokeRect(30, y, W - 60, 60);
        const name = o.w ? `${WEAPONS[o.k].name} ${(this.weapons[o.k] || 0) + 1}` : PASSIVE[o.k].split(':')[0], desc = o.w ? WEAPONS[o.k].desc : PASSIVE[o.k].split(': ')[1];
        this.text(c, name, 44, y + 22, 14, this.pal.ink, 'left'); this.text(c, desc, 44, y + 42, 10, this.col(4), 'left');
      });
    }
    if (this.msg) { this.msg.t -= 1 / 60; this.text(c, this.msg.s, W / 2, H / 2 - 60, 16, this.pal.ink); if (this.msg.t <= 0) this.msg = null; }
    if (!this.auto && this.joy) { c.strokeStyle = this.pal.ink; c.globalAlpha = 0.3; c.lineWidth = 2; c.beginPath(); c.arc(this.joy.ox, this.joy.oy, 30, 0, 7); c.stroke(); c.globalAlpha = 1; }
  }
  hud() { return `${this.score} · ${this.kills} slain`; }
}
