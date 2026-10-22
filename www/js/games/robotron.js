// Robotron-style twin-stick arena: left thumb moves, right thumb shoots.
// Grunts march, hulks can't be killed, spawners breed, electrodes zap, and the
// last stray humans are worth rescuing.
// Hero and humans are Crystal Sprites: the hero runs in 8 directions and shoots
// (strafing), flinches and drops when killed, cheers on a rescue or a cleared wave;
// the humans wander, wave or start when you come near, and fall when a hulk gets them.
import { Game, W, H, drawFit } from './engine.js';
import { Actor, drawFrame, dirOf } from '../crystal/sprites.js';

const TOP = 34, PAD = 8;

export class Robotron extends Game {
  static noMods = ['lowg', 'heavy', 'mirror'];
  setup() {
    this.wave = 0; this.lives = 3; this.sticks = {}; this.bullets = []; this.eShots = [];
    this.newWave();
  }
  newWave() {
    this.wave++;
    const p = { x: W / 2, y: (TOP + H) / 2, inv: 2, face: 0 };
    this.p = p; this.dying = 0; this.clearT = 0; this.shootT = 0;
    this.hero = new Actor(this.skin.crystal(0, 'Sci-fi'), { runSpeed: 60, runStride: 7 }); this.bullets = []; this.eShots = []; this.cool = 0; this.saved = 0;
    this.foes = []; this.humans = []; this.zaps = [];
    const sw = this.mods.swarm ? 1.5 : 1, n = Math.round((6 + this.wave * 3) * sw);
    const away = () => { let x, y; do { x = this.r(PAD + 10, W - PAD - 10); y = this.r(TOP + 10, H - PAD - 10); } while (Math.hypot(x - p.x, y - p.y) < 90); return { x, y }; };
    for (let i = 0; i < n; i++) this.foes.push({ kind: 'grunt', ...away(), hp: 1, sp: this.r(24, 36) + this.wave * 3, i: this.skin.list('grunts', 3, 'enemy', 'monster')[i % 3] });
    for (let i = 0; i < Math.min(5, Math.floor(this.wave / 2)); i++) this.foes.push({ kind: 'hulk', ...away(), hp: 1e9, sp: 18, dir: this.r(0, 7), i: this.skin.creatures[4].frames[0], i2: this.skin.creatures[4].frames[1] });
    for (let i = 0; i < Math.min(4, Math.floor((this.wave - 1) / 2)); i++) this.foes.push({ kind: 'spawner', ...away(), hp: 3, sp: 40, dir: this.r(0, 7), cd: this.r(2, 4), i: this.skin.creatures[5].frames[0], i2: this.skin.creatures[5].frames[1] });
    for (let i = 0; i < Math.min(3, Math.floor(this.wave / 3)); i++) this.foes.push({ kind: 'tank', ...away(), hp: 2, sp: 20, dir: this.r(0, 7), cd: this.r(1, 3), i: this.skin.pick('tank', 'car', 'ship', 'enemy') });
    for (let i = 0; i < 4 + this.wave; i++) this.zaps.push({ ...away(), i: this.skin.pick('zap', 'item', 'fx', 'deco'), ph: this.r(0, 7) });
    for (let i = 0; i < 3; i++) { const k = 1 + ((this.wave + i) % 6); this.humans.push({ ...away(), k, dir: this.r(0, 7), a: new Actor(this.skin.crystal(k, 'Present day'), { runStride: 6 }), greet: 0 }); }
  }
  // twin sticks: each pointer that starts on a half of the screen owns that stick
  down(x, y, id = 0) { const side = x < W / 2 ? 'move' : 'fire'; this.sticks[side] = { id, ox: x, oy: y, x, y }; }
  move(x, y, id = 0) { for (const s of Object.values(this.sticks)) if (s && s.id === id) { s.x = x; s.y = y; } }
  up(x, y, id = 0) { for (const k of Object.keys(this.sticks)) if (this.sticks[k]?.id === id) this.sticks[k] = null; }
  tap() {}
  stick(s) {
    if (!s) return null;
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
    return d < 6 ? null : { x: dx / d, y: dy / d, m: Math.min(1, d / 40) };
  }
  autopilot() {
    const p = this.p;
    let mx = 0, my = 0;
    for (const f of this.foes) { const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) + 1, w = (f.kind === 'hulk' ? 2.2 : 1) / (d * d); if (d < 150) { mx += dx * w * 60; my += dy * w * 60; } }
    for (const z of this.zaps) { const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy) + 1; if (d < 40) { mx += dx / d / d * 30; my += dy / d / d * 30; } }
    for (const b of this.eShots) { const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) + 1; if (d < 60) { mx += dx / d / d * 50; my += dy / d / d * 50; } }
    const h = this.humans.filter((x) => !x.out).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (h) { const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy) + 1; mx += dx / d * 0.6; my += dy / d * 0.6; }
    mx += (W / 2 - p.x) * 0.002; my += ((TOP + H) / 2 - p.y) * 0.002;
    const md = Math.hypot(mx, my);
    this.autoMove = md > 0.05 ? { x: mx / md, y: my / md, m: Math.min(1, md) } : null;
    const t = this.foes.filter((f) => f.kind !== 'hulk').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (t) { const d = Math.hypot(t.x - p.x, t.y - p.y), lead = d / 360, a = Math.atan2(t.y + (t.vy || 0) * lead - p.y, t.x + (t.vx || 0) * lead - p.x); this.autoFire = { x: Math.cos(a), y: Math.sin(a), m: 1 }; }
    else this.autoFire = null;
  }
  // hit: flinch, then knockdown; the wave restarts once the body has hit the floor
  die() {
    if (this.dying) return;
    this.dying = 1.9; this.hero.hurt(); this.burst(this.p.x, this.p.y, this.col(0), 24, 220);
    for (const h of this.humans) if (!h.out) h.a.emote('sad', 1.9);
  }
  finishDeath() {
    this.lives--; this.burst(this.p.x, this.p.y, this.col(0), 40, 280); this.score = Math.max(0, this.score - 200);
    if (this.lives < 0) { this.lives = 3; this.wave = 1; this.score = 0; }
    this.wave--; this.newWave();
  }
  stepHumans(dt, frozen) {
    const p = this.p;
    for (const h of this.humans) {
      let vx = 0, vy = 0;
      if (h.out) h.out -= dt; // rescued (waving, fading) or knocked down
      else if (!frozen) {
        const d = Math.hypot(h.x - p.x, h.y - p.y);
        // spotting the hero: wave, or jump in surprise, and turn to face them
        if ((h.greet -= dt) <= 0 && d < 60 && !this.dying) { h.greet = 4; h.a.face(dirOf(p.x - h.x, p.y - h.y)); h.a.emote(this.rng() < 0.5 ? 'wave' : 'surprise', 0.9); }
        if (!h.a.a.action) {
          if (this.rng() < dt) h.dir += this.r(-2, 2);
          const ox = h.x, oy = h.y;
          h.x = Math.max(PAD + 8, Math.min(W - PAD - 8, h.x + Math.cos(h.dir) * 16 * dt)); h.y = Math.max(TOP + 8, Math.min(H - PAD - 8, h.y + Math.sin(h.dir) * 16 * dt));
          vx = (h.x - ox) / dt; vy = (h.y - oy) / dt;
        }
      }
      h.a.update(dt, { vx, vy });
    }
    this.humans = this.humans.filter((h) => !(h.out !== undefined && h.out <= 0));
  }
  step(dt) {
    const p = this.p;
    if (this.dying || this.clearT) {
      const evs = this.hero.update(dt);
      if (this.dying) { if (evs.includes('done:flinch') || (this.dying < 1.5 && !this.hero.isKO)) this.hero.ko(); if ((this.dying -= dt) <= 0) this.finishDeath(); }
      else if ((this.clearT -= dt) <= 0) this.newWave();
      this.stepHumans(dt, true);
      for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
      this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > PAD && b.x < W - PAD && b.y > TOP && b.y < H - PAD);
      if (this.pop && (this.pop.t -= dt) <= 0) this.pop = null;
      return;
    }
    const mv = this.auto ? this.autoMove : this.stick(this.sticks.move);
    let fr = this.auto ? this.autoFire : this.stick(this.sticks.fire);
    // one thumb only: auto-aim at the nearest robot
    if (!this.auto && mv && !this.sticks.fire) { const t = this.foes.filter((f) => f.kind !== 'hulk').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; if (t) { const a = Math.atan2(t.y - p.y, t.x - p.x); fr = { x: Math.cos(a), y: Math.sin(a) }; } }
    const sp = 120 * this.S ** 0.3;
    const ox = p.x, oy = p.y;
    if (mv) { p.x += mv.x * sp * mv.m * dt; p.y += mv.y * sp * mv.m * dt; p.face = mv.x < 0 ? 1 : 0; }
    p.x = Math.max(PAD + 8, Math.min(W - PAD - 8, p.x)); p.y = Math.max(TOP + 10, Math.min(H - PAD - 10, p.y));
    p.inv -= dt; this.cool -= dt; this.shootT -= dt;
    this.hero.update(dt, { vx: (p.x - ox) / dt, vy: (p.y - oy) / dt });
    // shoot doesn't lock, so legs keep running; the gun pose plays every other beat
    // (bullets stream faster than the 4-frame animation) and the hero turns to the aim
    if (fr && this.hero.anim === 'shoot') this.hero.face(dirOf(fr.x, fr.y));
    if (fr && this.cool <= 0) {
      this.cool = this.mods.glass ? 0.07 : 0.11;
      if (this.shootT <= 0 && this.hero.a.action !== 'cheer' && this.hero.shoot()) { this.shootT = 0.5; this.hero.face(dirOf(fr.x, fr.y)); }
      const a = Math.atan2(fr.y, fr.x) + this.r(-0.04, 0.04);
      this.bullets.push({ x: p.x, y: p.y - 6 * this.S, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, a, life: 1.2 });
    }
    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.x < PAD || b.x > W - PAD || b.y < TOP || b.y > H - PAD) b.life = 0; }
    for (const b of this.eShots) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (Math.hypot(b.x - p.x, b.y - p.y) < 8 && p.inv <= 0) { this.die(); return; } }
    const born = [];
    for (const f of this.foes) {
      f.ph = (f.ph || 0) + dt;
      if (f.kind === 'grunt') {
        const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) + 1, s = f.sp * (1 + Math.sin(f.ph * 9) * 0.4);
        f.vx = dx / d * s; f.vy = dy / d * s;
      } else {
        if (this.rng() < dt * 0.8) f.dir += this.r(-1.5, 1.5);
        if (f.kind === 'hulk') { const a = Math.atan2(p.y - f.y, p.x - f.x); f.dir += Math.sin(a - f.dir) * dt * 0.8; }
        f.vx = Math.cos(f.dir) * f.sp; f.vy = Math.sin(f.dir) * f.sp;
        if (f.kind === 'spawner' && (f.cd -= dt) <= 0) { f.cd = this.r(3, 5); born.push({ kind: 'grunt', x: f.x, y: f.y, hp: 1, sp: this.r(30, 44), i: this.skin.list('grunts', 3, 'enemy', 'monster')[0] }); }
        if (f.kind === 'tank' && (f.cd -= dt) <= 0) { f.cd = this.r(1.5, 3); const a = Math.atan2(p.y - f.y, p.x - f.x); this.eShots.push({ x: f.x, y: f.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, life: 3, a }); }
      }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < PAD + 8 || f.x > W - PAD - 8) { f.dir = Math.PI - (f.dir || 0); f.x = Math.max(PAD + 8, Math.min(W - PAD - 8, f.x)); }
      if (f.y < TOP + 8 || f.y > H - PAD - 8) { f.dir = -(f.dir || 0); f.y = Math.max(TOP + 8, Math.min(H - PAD - 8, f.y)); }
      if (p.inv <= 0 && Math.hypot(f.x - p.x, f.y - p.y) < 13) { this.die(); return; }
      for (const b of this.bullets) if (b.life > 0 && Math.hypot(b.x - f.x, b.y - f.y) < 11) {
        b.life = 0;
        if (f.kind === 'hulk') { f.x += b.vx * 0.02; f.y += b.vy * 0.02; continue; }
        if (--f.hp <= 0) { f.dead = true; this.score += f.kind === 'grunt' ? 100 : 300; this.burst(f.x, f.y, this.col(this.ri(0, 4)), 12, 160); }
      }
      // hulks crush the humans
      if (f.kind === 'hulk') for (const h of this.humans) if (!h.out && Math.hypot(h.x - f.x, h.y - f.y) < 14) { h.out = 1.6; h.fall = true; h.a.face(dirOf(h.x - f.x, h.y - f.y)); h.a.ko(); this.burst(h.x, h.y, this.col(3), 10, 90); }
    }
    for (const z of this.zaps) {
      z.ph += dt;
      for (const b of this.bullets) if (b.life > 0 && Math.hypot(b.x - z.x, b.y - z.y) < 9) { b.life = 0; z.dead = true; this.score += 25; this.burst(z.x, z.y, this.col(1), 8, 100); }
      for (const f of this.foes) if (f.kind === 'grunt' && Math.hypot(f.x - z.x, f.y - z.y) < 10) { f.dead = true; z.dead = true; }
      if (!z.dead && p.inv <= 0 && Math.hypot(z.x - p.x, z.y - p.y) < 11) { this.die(); return; }
    }
    this.stepHumans(dt);
    for (const h of this.humans) {
      if (!h.out && Math.hypot(h.x - p.x, h.y - p.y) < 14) { h.out = 0.9; h.a.face(dirOf(p.x - h.x, p.y - h.y)); h.a.emote('wave', 0.9); this.hero.emote('cheer', 0.7); this.saved++; const pts = 1000 * this.saved; this.score += pts; this.burst(h.x, h.y, this.pal.ink, 14, 120); this.pop = { x: h.x, y: h.y, s: `+${pts}`, t: 1 }; }
    }
    this.foes = this.foes.filter((f) => !f.dead).concat(born);
    this.zaps = this.zaps.filter((z) => !z.dead);
    this.bullets = this.bullets.filter((b) => b.life > 0); this.eShots = this.eShots.filter((b) => b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H);
    if (this.pop && (this.pop.t -= dt) <= 0) this.pop = null;
    if (!this.foes.some((f) => f.kind !== 'hulk')) { this.score += 500 * this.wave; this.clearT = 1.3; this.hero.emote('cheer', 1.3); for (const h of this.humans) if (!h.out) h.a.emote('cheer', 1.3); }
  }
  draw(c) {
    this.clear(c);
    // arena border pulses through the palette, like the original
    c.strokeStyle = this.col(Math.floor(this.t * 6)); c.lineWidth = 4; c.strokeRect(PAD - 2, TOP - 2, W - PAD * 2 + 4, H - TOP - PAD + 4);
    for (const z of this.zaps) { const s = 14 + Math.sin(z.ph * 6) * 2; if (!drawFit(c, z.i, z.x, z.y, s, s, z.ph)) { c.strokeStyle = this.col(1); c.lineWidth = 2; c.strokeRect(z.x - 5, z.y - 5, 10, 10); } }
    // humans, robots and the hero, back to front by their feet
    const p = this.p, ents = [];
    for (const h of this.humans) ents.push({ y: h.y + 12, d: () => h.a.draw(c, h.x, h.y + 12, 1, { alpha: h.out && !h.fall ? Math.min(1, h.out / 0.5) : h.out ? Math.min(1, h.out / 0.6) : 1 }) });
    for (const f of this.foes) {
      const s = (f.kind === 'hulk' ? 30 : f.kind === 'grunt' ? 20 : 24) * this.S;
      ents.push({ y: f.y + s / 2, d: () => {
        const im = f.i2 && Math.floor(f.ph * 4) % 2 ? f.i2 : f.i;
        if (!drawFit(c, im, f.x, f.y + Math.sin(f.ph * 12) * (f.kind === 'grunt' ? 1.5 : 0), s, s, 0, f.vx < 0)) { c.fillStyle = this.col(f.kind === 'hulk' ? 2 : 0); c.fillRect(f.x - s / 3, f.y - s / 3, s / 1.5, s / 1.5); }
      } });
    }
    if (this.dying || p.inv <= 0 || Math.floor(this.t * 12) % 2) ents.push({ y: p.y + 13 * this.S, d: () => this.hero.draw(c, p.x, p.y + 13 * this.S, this.S, { alpha: this.dying ? Math.min(1, this.dying / 0.6) : 1 }) });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.d();
    const bimg = this.skin.pick('bullet', 'item', 'ball', 'fx');
    for (const b of this.bullets) { c.fillStyle = this.col(4); c.globalAlpha = 0.5; c.beginPath(); c.arc(b.x, b.y, 4, 0, 7); c.fill(); c.globalAlpha = 1; drawFit(c, bimg, b.x, b.y, 9, 9, b.a); }
    for (const b of this.eShots) { c.fillStyle = this.col(0); c.beginPath(); c.arc(b.x, b.y, 3.5, 0, 7); c.fill(); }
    if (this.pop) this.text(c, this.pop.s, this.pop.x, this.pop.y - 16 - (1 - this.pop.t) * 20, 11, this.pal.ink);
    // lives, top right
    for (let i = 0; i < this.lives; i++) drawFrame(c, this.hero.sheet, 'idle', 'S', 0, W - 18 - i * 16, 26, 0.6);
    if (!this.auto) for (const s of Object.values(this.sticks)) if (s) {
      c.strokeStyle = this.pal.ink; c.globalAlpha = 0.35; c.lineWidth = 2;
      c.beginPath(); c.arc(s.ox, s.oy, 30, 0, 7); c.stroke(); c.beginPath(); c.arc(s.ox + Math.max(-30, Math.min(30, s.x - s.ox)), s.oy + Math.max(-30, Math.min(30, s.y - s.oy)), 10, 0, 7); c.fill(); c.globalAlpha = 1;
    }
  }
  hud() { return `${this.score} · wave ${this.wave}`; }
}
