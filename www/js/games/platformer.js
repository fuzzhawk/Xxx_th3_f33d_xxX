import { Game, W, H, circleRect, reflect, roundRect, drawFit, drawRectImg, ready } from './engine.js';
import { Actor, ERAS } from '../crystal/sprites.js';

// ================================================================ Platformer
// The hero is a Crystal Sprite character: it starts idle (kneeling after a fall), walks and
// then runs as it speeds up, crouches into jumps, rises/hangs/falls by vertical speed, lands
// on every touch-down, swings or shoots at foes in reach, flinches when hit, is knocked down
// on the third hit or a pit, cheers at distance milestones and is startled by new foes.
export class Platformer extends Game {
  setup() {
    this.hero = new Actor(this.skin.crystal(0, ERAS[(this.skin.cseed >>> 0) % 3], ['W', 'E']), { mode: 'side', dir: 'E', walkSpeed: 4, runSpeed: 95, walkStride: 6, runStride: 11 });
    this.reset();
  }
  reset() {
    this.p = { x: 60, y: 200, w: 20, h: 26, vy: 0, on: false, jumps: 0, face: 1, hp: 3, inv: 0, v: 0, wait: this.p ? 0.9 : 0.5, cool: 0, pit: false };
    this.camX = 0; this.plats = []; this.coins = []; this.foes = []; this.shots = []; this.genX = 0; this.dead = 0; this.score = 0; this.coinsGot = 0;
    this.speed = 150 * this.S ** 0.3; this.mile = 1; this.emoteT = 0;
    this.plat(0, 320, 300);
    while (this.genX < W * 2) this.chunk();
    this.p.y = 320 - this.p.h; this.p.on = true;
    this.hero.revive();
  }
  plat(x, y, w) { this.plats.push({ x, y, w, h: 18 }); this.genX = Math.max(this.genX, x + w); }
  chunk() {
    const gap = this.r(0, 1) < 0.65 ? this.r(40, 95) : 0;
    const last = this.plats[this.plats.length - 1];
    const y = Math.max(180, Math.min(360, last.y + this.r(-70, 60)));
    const w = this.r(90, 260), x = this.genX + gap;
    this.plat(x, y, w);
    if (this.rng() < 0.45) { const fx = x + this.r(30, w - 30), fy = y - this.r(70, 110); this.plats.push({ x: fx - 40, y: fy, w: 80, h: 14, float: true }); for (let i = 0; i < 3; i++) this.coins.push({ x: fx - 25 + i * 25, y: fy - 24 }); }
    else for (let i = 0; i < this.ri(0, 4); i++) this.coins.push({ x: x + 20 + i * 24, y: y - 30 });
    if (w > 140 && this.rng() < (this.mods.swarm ? 0.85 : 0.55)) this.foes.push({ x: x + w * 0.6, y: y - 22, w: 22, h: 22, min: x + 4, max: x + w - 26, dir: -1, m: this.skin.creatures[1 + this.ri(0, 3)] });
  }
  ground(x0, x1, yb, prevYb) {
    let best = null;
    for (const pl of this.plats) if (x1 > pl.x && x0 < pl.x + pl.w && prevYb <= pl.y + 2 && yb >= pl.y) if (!best || pl.y < best.y) best = pl;
    return best;
  }
  get gunner() { return /pistol|rifle/.test(this.hero.sheet.char?.weapon || ''); }
  jump() {
    const p = this.p; if (this.dead || p.wait > 0) return; const v = 560 * Math.sqrt(this.G);
    if (p.on) { p.vy = -v; p.on = false; p.jumps = 1; this.hero.jump(); } else if (p.jumps < 2) { p.vy = -v * 0.85; p.jumps = 2; }
  }
  // the nearest live foe ahead on the hero's level, within `reach`
  foeAhead(reach) { const p = this.p; return this.foes.find((f) => !f.dead && f.x + f.w > p.x + p.w - 4 && f.x - (p.x + p.w) < reach && Math.abs(f.y + f.h - (p.y + p.h)) < 12); }
  autopilot() {
    const p = this.p;
    if (!p.on) { if (p.vy > 50 && p.jumps === 1 && !this.ground(p.x + 30, p.x + 30 + p.w, p.y + p.h + 200, p.y + p.h)) this.jump(); return; }
    const ahead = p.x + p.w + 14;
    const under = this.plats.some((pl) => !pl.float && ahead > pl.x && ahead < pl.x + pl.w && Math.abs(pl.y - (p.y + p.h)) < 4);
    const foe = this.foes.find((f) => !f.dead && f.x > p.x && f.x - p.x < 70 && Math.abs(f.y + f.h - (p.y + p.h)) < 10);
    // leave close foes to the hero's own swing / shot when it is ready, otherwise hop them
    const handle = foe && p.cool <= 0 && (this.gunner || foe.x - p.x > 30) && foe.fight;
    const up = this.plats.find((pl) => pl.y < p.y && pl.x - p.x < 60 && pl.x - p.x > 0 && p.y - pl.y < 110);
    if (!under || (foe && !handle) || (up && this.rng() < 0.03)) this.jump();
  }
  down() { this.jump(); }
  hit() {
    const p = this.p;
    if (--p.hp <= 0) return this.die();
    p.inv = 1.2; p.vy = -260 * Math.sqrt(this.G); p.on = false; p.v = -40; this.hero.hurt();
    this.burst(p.x + p.w / 2 - this.camX, p.y + p.h / 2, this.col(0), 10, 140);
  }
  step(dt) {
    const p = this.p, hero = this.hero;
    const air = !p.on && !this.dead;
    const evs = hero.update(dt, { vx: this.dead ? 0 : Math.max(0, p.v), vy: 0, grounded: !air, airVy: p.vy, lowHealth: p.hp <= 1 || p.wait > 0.4 });
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    p.inv = Math.max(0, p.inv - dt); p.cool = Math.max(0, p.cool - dt); this.emoteT = Math.max(0, this.emoteT - dt);
    // speed: stand still while getting up, then walk into a run; pause briefly for emotes and swings
    const emoting = /cheer|surprise/.test(hero.anim);
    if (p.wait > 0) { p.wait -= dt; p.v = 0; }
    else p.v = Math.min(this.speed, p.v + this.speed * (emoting ? -4 : hero.anim === 'attack' ? -1.5 : 1.4) * dt);
    p.v = Math.max(emoting ? 0 : -60, p.v);
    p.x += p.v * dt; this.score = Math.floor(p.x / 10) + this.coinsGot * 25;
    const prevB = p.y + p.h;
    p.vy += 1500 * this.G * dt; p.y += p.vy * dt;
    const g = p.vy >= 0 ? this.ground(p.x, p.x + p.w, p.y + p.h, prevB) : null;
    if (g) { p.y = g.y - p.h; p.vy = 0; p.on = true; p.jumps = 0; } else p.on = false;
    if (p.y > H + 60) { p.pit = true; return this.die(); }
    for (const c of this.coins) if (!c.got && Math.abs(c.x - (p.x + p.w / 2)) < 16 && Math.abs(c.y - (p.y + p.h / 2)) < 20) { c.got = true; this.coinsGot++; this.burst(c.x - this.camX, c.y, this.col(1), 6, 90); }
    // milestones: a cheer every 200 m
    if (this.score >= this.mile * 200 && p.on && !this.emoteT) { this.mile++; hero.emote('cheer', 0.7); this.emoteT = 3; this.burst(p.x + p.w / 2 - this.camX, p.y - 6, this.col(1), 16, 160); }
    // a fresh foe coming on screen startles the hero (now and then)
    for (const f of this.foes) if (!f.seen && f.x < this.camX + W - 10) {
      f.seen = true; f.fight = this.rng() < 0.6;
      if (p.on && !this.emoteT && this.rng() < 0.4) { hero.emote('surprise', 0.45); this.emoteT = 3; }
    }
    // the hero's own attack: a swing at a foe in reach, or a shot if it carries a gun
    if (p.on && p.cool <= 0 && !hero.locked) {
      if (this.gunner ? this.foeAhead(150) : this.foeAhead(52)) { if (this.gunner ? hero.shoot() : hero.attack()) p.cool = 1.4; }
    }
    for (const e of evs) {
      if (e === 'hit') { const f = this.foeAhead(30); if (f) this.kill(f); }
      if (e === 'fire') this.shots.push({ x: p.x + p.w + 6, y: p.y + p.h * 0.45, life: 0.8 });
    }
    for (const s of this.shots) {
      s.x += 520 * dt; s.life -= dt;
      const f = this.foes.find((f) => !f.dead && s.x > f.x && s.x < f.x + f.w && s.y > f.y - 4 && s.y < f.y + f.h + 4);
      if (f) { this.kill(f); s.life = 0; }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const f of this.foes) {
      if (f.dead) continue;
      f.x += f.dir * 40 * dt; if (f.x < f.min || f.x > f.max) f.dir *= -1;
      if (p.x + p.w > f.x && p.x < f.x + f.w && p.y + p.h > f.y && p.y < f.y + f.h) {
        if (p.vy > 0 && prevB <= f.y + 8) { this.kill(f); p.vy = -420 * Math.sqrt(this.G); }
        else if (!p.inv) return this.hit();
      }
    }
    this.camX += (p.x - 110 - this.camX) * Math.min(1, dt * 6);
    while (this.genX < this.camX + W * 2) this.chunk();
    this.plats = this.plats.filter((pl) => pl.x + pl.w > this.camX - 60);
    this.coins = this.coins.filter((c) => c.x > this.camX - 40 && !c.got);
    this.foes = this.foes.filter((f) => f.x > this.camX - 60);
  }
  kill(f) { f.dead = true; this.coinsGot += 2; this.burst(f.x + 11 - this.camX, f.y + 11, this.col(3), 14); }
  die() { this.dead = 1.6; this.p.hp = 0; this.hero.ko(); this.burst(this.p.x - this.camX + 10, Math.min(H - 10, this.p.y), this.col(0), 24, 240); }
  draw(c) {
    this.clear(c);
    // parallax hills
    c.fillStyle = this.col(5); c.globalAlpha = 0.18;
    for (let i = -1; i < 6; i++) { const x = i * 120 - ((this.camX * 0.3) % 120); c.beginPath(); c.arc(x, H, 110, Math.PI, 0); c.fill(); }
    c.globalAlpha = 1;
    c.save(); c.translate(-this.camX, 0);
    const t = this.skin.pick('ptile', 'tile', 'block');
    for (const pl of this.plats) {
      c.fillStyle = pl.float ? this.col(1) : this.col(2);
      roundRect(c, pl.x, pl.y, pl.w, pl.float ? pl.h : H - pl.y, 4); c.fill();
      if (t) { c.save(); roundRect(c, pl.x, pl.y, pl.w, pl.float ? pl.h : H - pl.y, 4); c.clip(); c.globalAlpha = 0.8; drawRectImg(c, t, pl.x, pl.y, pl.w, pl.float ? pl.h : 34, true); c.restore(); c.globalAlpha = 1; }
    }
    const coin = this.skin.pick('coin', 'item');
    for (const k of this.coins) if (!drawFit(c, coin, k.x, k.y + Math.sin(this.t * 4 + k.x) * 3, 18, 18)) { c.fillStyle = this.col(1); c.beginPath(); c.arc(k.x, k.y, 6, 0, 7); c.fill(); }
    for (const f of this.foes) if (!f.dead && !drawFit(c, f.m.frames[Math.floor(this.t * 5 + f.x) % 2], f.x + 11, f.y + 11, 30 * this.S, 30 * this.S, 0, f.dir > 0)) { c.fillStyle = this.col(3); c.fillRect(f.x, f.y, f.w, f.h); }
    c.strokeStyle = '#fff6b0'; c.lineWidth = 2;
    for (const s of this.shots) { c.beginPath(); c.moveTo(s.x - 8, s.y); c.lineTo(s.x, s.y); c.stroke(); }
    const p = this.p;
    // feet on the hitbox's bottom; a fall into a pit is shown lying at the bottom edge
    const fy = this.dead && p.pit ? H - 2 : p.y + p.h;
    const blink = p.inv > 0 && !this.dead && Math.floor(this.t * 14) % 2;
    this.hero.draw(c, p.x + p.w / 2, fy, 1.4 * this.S, { alpha: this.dead ? Math.min(1, this.dead / 0.6) : blink ? 0.45 : 1 });
    c.restore();
  }
  hud() { return `${this.score} · ◎${this.coinsGot} · ${'♥'.repeat(Math.max(0, this.p.hp))}`; }
}
