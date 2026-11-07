// Asteroids, psychedelic. Waves start with a couple of slow rocks and build up: more of
// them, faster, then prisms that split three ways (wave 3) and comets that cut across
// (wave 6); each wave is announced. Colour-cycling trails, kaleidoscopic splits,
// hue-shifting blasts and a slowly warping backdrop, kept dim behind haloed rocks so
// the play stays readable. The ship is a random PNG.
import { Game, W, H, drawFit, ready } from './engine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Rocks extends Game {
  setup() {
    this.wave = 0; this.lives = 3; this.fx = []; this.trail = []; this.hueKick = 0; this.shots = []; this.rocks = []; this.dead = 0; this.next = 0;
    this.stars = Array.from({ length: 46 }, () => ({ x: this.r(0, W), y: this.r(0, H), z: this.r(0.2, 1), p: this.r(0, 7) }));
    this.newShip(); this.startWave();
  }
  newShip() { this.ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2.5 }; this.trail = []; }
  startWave() {
    const w = ++this.wave, n = Math.min(9, 1 + Math.ceil(w * 0.7)) + (this.mods.swarm ? 2 : 0), s = this.ship;
    this.spd = Math.min(1.35, 0.45 + w * 0.09);
    for (let i = 0; i < n; i++) {
      const kind = w >= 6 && i % 4 === 3 ? 'comet' : w >= 3 && i % 3 === 2 ? 'prism' : 'rock';
      let x, y;
      do { const e = this.r(0, 2 * (W + H)); [x, y] = e < W ? [e, 0] : e < W + H ? [W, e - W] : e < 2 * W + H ? [e - W - H, H] : [0, e - 2 * W - H]; } while (Math.hypot(x - s.x, y - s.y) < 140);
      this.rock(x, y, kind === 'comet' ? 13 : 34, kind);
    }
    this.banner = { s: `WAVE ${w}`, sub: w === 1 ? (this.auto ? 'a gentle start' : 'tap to shoot · hold to fly') : w === 3 ? 'PRISMS split three ways' : w === 6 ? 'COMETS incoming' : `${n} rocks`, t: 2.2 };
  }
  rock(x, y, r, kind = 'rock', a = this.r(0, 7)) {
    const sp = (kind === 'comet' ? this.r(110, 140) : this.r(22, 55) * (34 / r) ** 0.6) * this.spd;
    this.rocks.push({ x, y, r: r * this.S, kind, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: this.r(-1.2, 1.2), i: this.skin.any('meteor', 'prop', 'animal', 'item'), h: this.r(0, 360) });
  }
  wrapd(a, b, L) { let d = b - a; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; }
  fire() {
    const s = this.ship; if (this.cool > 0 || this.dead) return;
    this.cool = 0.22;
    this.shots.push({ x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14, vx: Math.cos(s.a) * 420 + s.vx, vy: Math.sin(s.a) * 420 + s.vy, life: 1.0, h: this.t * 200 });
  }
  // shoot the rock that threatens the ship, else keep working on the current one; back off from close calls
  autopilot(dt) {
    const s = this.ship;
    if (this.dead) return;
    let threat = null, tmin = 1.2;
    for (const r of this.rocks) {
      const dx = this.wrapd(s.x, r.x, W), dy = this.wrapd(s.y, r.y, H), rvx = r.vx - s.vx, rvy = r.vy - s.vy;
      const tc = clamp(-(dx * rvx + dy * rvy) / (rvx * rvx + rvy * rvy || 1), 0, 2);
      if (Math.hypot(dx + rvx * tc, dy + rvy * tc) < r.r + 26 && tc < tmin) { tmin = tc; threat = r; }
    }
    if (!this.rocks.includes(this.tgt)) this.tgt = null;
    let t = threat || this.tgt;
    if (!t) { let bd = 1e9; for (const r of this.rocks) { const d = Math.hypot(this.wrapd(s.x, r.x, W), this.wrapd(s.y, r.y, H)); if (d < bd) { bd = d; t = r; } } }
    this.tgt = t;
    if (!t) { this.thrust = 0; return; }
    let dx = this.wrapd(s.x, t.x, W), dy = this.wrapd(s.y, t.y, H);
    const dist = Math.hypot(dx, dy);
    for (let k = 0, tt = dist / 420; k < 2; k++) { dx = this.wrapd(s.x, t.x + t.vx * tt, W); dy = this.wrapd(s.y, t.y + t.vy * tt, H); tt = Math.hypot(dx, dy) / 420; }
    let d = Math.atan2(dy, dx) - s.a;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    s.a += Math.sign(d) * Math.min(Math.abs(d), 4.5 * dt);
    if (Math.abs(d) < 0.12 && dist < 280) this.fire();
    this.thrust = threat && tmin < 0.8 && dist < 130 ? -1 : dist > 210 && Math.abs(d) < 0.4 ? 0.6 : 0;
  }
  down(x, y) { this.aim = { x, y }; this.held = this.t; this.fireAt(x, y); }
  move(x, y) { if (this.aim) this.aim = { x, y }; }
  up() { this.aim = null; this.thrust = 0; }
  fireAt(x, y) { this.ship.a = Math.atan2(y - this.ship.y, x - this.ship.x); this.fire(); }
  blast(x, y, h, n, r, img, rot) {
    // kaleidoscope: n mirrored copies of the rock fly out of the split, with n-fold shards
    this.hueKick += 55;
    this.fx.push({ k: 'ring', x, y, r, h, life: 0.5, max: 0.5 });
    if (img) this.fx.push({ k: 'kal', x, y, r, h, n, img, rot, life: 0.55, max: 0.55 });
    const a0 = this.r(0, 7);
    for (let i = 0; i < n * 3; i++) { const a = a0 + (i % n) * (Math.PI * 2 / n), sp = 50 + Math.floor(i / n) * 45; this.fx.push({ k: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, h: h + (i % n) * (360 / n), life: 0.7, max: 0.7 }); }
  }
  step(dt) {
    this.cool = (this.cool || 0) - dt;
    this.hueKick = Math.max(0, this.hueKick - dt * 60);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    const s = this.ship;
    if (this.dead) {
      this.dead -= dt;
      // come back once the middle is clear
      if (this.dead <= 0) { if (this.lives < 0) { this.over(); return; } if (this.rocks.every((r) => Math.hypot(r.x - W / 2, r.y - H / 2) > r.r + 70)) { this.newShip(); this.dead = 0; } else this.dead = 0.1; }
    }
    if (!this.auto && this.aim && !this.dead) { s.a = Math.atan2(this.aim.y - s.y, this.aim.x - s.x); const hold = this.t - this.held > 0.25; this.thrust = hold ? 1 : 0; if (hold) this.fire(); }
    if (!this.dead) {
      if (this.thrust) { s.vx += Math.cos(s.a) * 240 * this.thrust * dt; s.vy += Math.sin(s.a) * 240 * this.thrust * dt; }
      s.vx *= 0.992; s.vy *= 0.992; s.x = (s.x + s.vx * dt + W) % W; s.y = (s.y + s.vy * dt + H) % H; s.inv -= dt;
      if ((this.trailT = (this.trailT || 0) - dt) <= 0) { this.trailT = 0.025; this.trail.push({ x: s.x, y: s.y }); if (this.trail.length > 26) this.trail.shift(); }
    }
    for (const b of this.shots) { b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H; b.life -= dt; }
    for (const r of this.rocks) { r.x = (r.x + r.vx * dt + W) % W; r.y = (r.y + r.vy * dt + H) % H; r.rot += r.vr * dt; }
    const born = [];
    for (const b of this.shots) for (const r of this.rocks) {
      if (b.life <= 0 || r.dead) continue;
      if (Math.hypot(this.wrapd(b.x, r.x, W), this.wrapd(b.y, r.y, H)) < r.r + 2) {
        b.life = 0; r.dead = true;
        const big = r.r / this.S;
        this.score += r.kind === 'comet' ? 150 : big > 25 ? 20 : big > 15 ? 50 : 100;
        const kids = big > 15 && r.kind !== 'comet' ? (r.kind === 'prism' ? 3 : 2) : 0, a = Math.atan2(r.vy, r.vx);
        this.blast(r.x, r.y, r.h, kids === 3 ? 6 : kids ? 4 : 8, r.r, r.i, r.rot);
        for (let k = 0; k < kids; k++) { this.rock(r.x, r.y, big * (kids === 3 ? 0.55 : 0.58), 'rock', kids === 3 ? a + (k * Math.PI * 2) / 3 : a + (k ? 0.55 : -0.55)); born.push(this.rocks.pop()); }
      }
    }
    if (!this.dead && s.inv <= 0) for (const r of this.rocks) if (!r.dead && Math.hypot(this.wrapd(s.x, r.x, W), this.wrapd(s.y, r.y, H)) < r.r + 8 * this.S) {
      this.dead = 1.4; this.lives--; this.blast(s.x, s.y, this.t * 90, 10, 30, this.skin.vehicle('ship'), s.a); this.trail = [];
      break;
    }
    for (const f of this.fx) { f.life -= dt; if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.98; f.vy *= 0.98; } }
    this.fx = this.fx.filter((f) => f.life > 0).slice(-240);
    this.shots = this.shots.filter((b) => b.life > 0);
    this.rocks = this.rocks.filter((r) => !r.dead).concat(born);
    if (!this.rocks.length && !this.next) { this.next = 1.6; this.score += 100 * this.wave; this.banner = { s: 'WAVE CLEAR', sub: `+${100 * this.wave}`, t: 1.5 }; }
    if (this.next && (this.next -= dt) <= 0) { this.next = 0; this.startWave(); }
  }
  over() { this.banner = { s: 'GAME OVER', sub: `score ${this.score}`, t: 2.5 }; this.wave = 0; this.lives = 3; this.score = 0; this.rocks = []; this.shots = []; this.newShip(); this.dead = 0; this.next = 2.5; }
  // backdrop: theme picture in slowly waving strips, breathing rings and twinkling stars, all dim
  backdrop(c) {
    if (this.mods.trails && this.t > 0.5) { c.fillStyle = this.pal.bg; c.globalAlpha = 0.25; c.fillRect(0, 0, W, H); c.globalAlpha = 1; return; }
    const hue = this.skin.hue + this.t * 12 + this.hueKick, g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.pal.bg2); g.addColorStop(1, this.pal.bg);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const im = this.skin.bg;
    if (!this.bgc && ready(im)) {
      const cv = Object.assign(document.createElement('canvas'), { width: 120, height: 140 }), x = cv.getContext('2d'), k = Math.max(120 / im.naturalWidth, 140 / im.naturalHeight);
      try { x.drawImage(im, (120 - im.naturalWidth * k) / 2, (140 - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k); this.bgc = cv; } catch { this.bgc = null; }
    }
    if (this.bgc) {
      c.globalAlpha = 0.3;
      for (let i = 0; i < 20; i++) c.drawImage(this.bgc, 0, i * 7, 120, 7, Math.sin(this.t * 0.7 + i * 0.45) * 9 - 10, i * 21, W + 20, 21.5);
      c.globalAlpha = 1;
    }
    c.lineWidth = 9;
    for (let k = 0; k < 5; k++) { const rr = (this.t * 16 + k * 52) % 260; c.strokeStyle = `hsla(${hue + k * 40},85%,60%,${0.09 * (1 - rr / 260)})`; c.beginPath(); c.ellipse(W / 2, H / 2, rr * 1.1, rr * (0.9 + 0.1 * Math.sin(this.t + k)), this.t * 0.1, 0, 7); c.stroke(); }
    c.fillStyle = `hsla(${hue},80%,50%,0.07)`; c.fillRect(0, 0, W, H);
    const s = this.ship;
    for (const st of this.stars) {
      const x = (((st.x - s.x * st.z * 0.15) % W) + W) % W, y = (((st.y - s.y * st.z * 0.15) % H) + H) % H;
      c.fillStyle = `hsla(${hue + st.p * 50},70%,${70 + st.z * 25}%,${0.35 + 0.35 * Math.sin(this.t * 2 + st.p)})`; c.fillRect(x, y, 1 + st.z, 1 + st.z);
    }
  }
  draw(c) {
    this.backdrop(c);
    const hue = this.skin.hue + this.t * 90 + this.hueKick;
    for (const f of this.fx) {
      const a = f.life / f.max;
      if (f.k === 'ring') { c.strokeStyle = `hsla(${f.h + this.hueKick},90%,65%,${a})`; c.lineWidth = 3 * a + 1; c.beginPath(); c.arc(f.x, f.y, f.r * (1.6 - a), 0, 7); c.stroke(); }
      else if (f.k === 'kal') { c.globalAlpha = a * 0.55; for (let k = 0; k < f.n; k++) { const ang = f.rot + (k * Math.PI * 2) / f.n, d = f.r * 1.4 * (1 - a); drawFit(c, f.img, f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d, f.r * 1.3 * a + 4, f.r * 1.3 * a + 4, ang, k % 2 === 1); } c.globalAlpha = 1; }
      else { c.fillStyle = `hsla(${f.h + this.t * 200},95%,65%,${a})`; c.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); }
    }
    // rocks with a colour-cycling halo so they read against anything
    for (const r of this.rocks) {
      if (r.kind === 'comet') { const sp = Math.hypot(r.vx, r.vy) || 1, g = c.createLinearGradient(r.x, r.y, r.x - (r.vx / sp) * 50, r.y - (r.vy / sp) * 50); g.addColorStop(0, `hsla(${r.h + this.t * 120},95%,70%,.7)`); g.addColorStop(1, 'hsla(0,0%,100%,0)'); c.strokeStyle = g; c.lineWidth = r.r * 1.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x - (r.vx / sp) * 50, r.y - (r.vy / sp) * 50); c.stroke(); }
      c.strokeStyle = `hsla(${r.h + this.t * 60},90%,65%,.6)`; c.lineWidth = r.kind === 'prism' ? 2.5 : 1.5;
      c.beginPath(); if (r.kind === 'prism') for (let k = 0; k <= 6; k++) { const a = r.rot + (k * Math.PI) / 3; c[k ? 'lineTo' : 'moveTo'](r.x + Math.cos(a) * (r.r + 3), r.y + Math.sin(a) * (r.r + 3)); } else c.arc(r.x, r.y, r.r + 2, 0, 7); c.stroke();
      if (!drawFit(c, r.i, r.x, r.y, r.r * 2.2, r.r * 2.2, r.rot)) { c.fillStyle = this.col(1); c.beginPath(); c.arc(r.x, r.y, r.r, 0, 7); c.fill(); }
    }
    // shots: short rainbow streaks
    c.lineCap = 'round'; c.lineWidth = 3;
    for (const b of this.shots) { c.strokeStyle = `hsl(${b.h + this.t * 400},100%,70%)`; c.beginPath(); c.moveTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025); c.lineTo(b.x, b.y); c.stroke(); }
    const s = this.ship;
    if (!this.dead) {
      // the ship's wake cycles through the spectrum
      c.lineWidth = 4;
      for (let i = 1; i < this.trail.length; i++) { const p = this.trail[i - 1], q = this.trail[i]; if (Math.abs(p.x - q.x) > 40 || Math.abs(p.y - q.y) > 40) continue; c.strokeStyle = `hsla(${hue - i * 14},95%,62%,${(i / this.trail.length) * 0.6})`; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); }
      if (s.inv <= 0 || Math.floor(this.t * 10) % 2) {
        c.fillStyle = `hsla(${hue},90%,60%,.18)`; c.beginPath(); c.arc(s.x, s.y, 20 * this.S, 0, 7); c.fill();
        if (!drawFit(c, this.skin.vehicle('ship'), s.x, s.y, 34 * this.S, 34 * this.S, s.a + Math.PI / 2)) {
          c.save(); c.translate(s.x, s.y); c.rotate(s.a); c.strokeStyle = this.pal.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 0); c.lineTo(-10, -9); c.lineTo(-6, 0); c.lineTo(-10, 9); c.closePath(); c.stroke(); c.restore();
        }
        if (this.thrust) { const k = this.thrust > 0 ? -1 : 1; c.fillStyle = `hsl(${hue + 180},100%,65%)`; c.beginPath(); c.arc(s.x + Math.cos(s.a) * 16 * k, s.y + Math.sin(s.a) * 16 * k, 3 + Math.random() * 3, 0, 7); c.fill(); }
      }
    }
    for (let i = 0; i < Math.max(0, this.lives); i++) { c.fillStyle = `hsl(${hue + i * 40},90%,65%)`; c.beginPath(); c.moveTo(W - 16 - i * 14, 40); c.lineTo(W - 22 - i * 14, 52); c.lineTo(W - 10 - i * 14, 52); c.fill(); }
    if (this.banner) { c.globalAlpha = Math.min(1, this.banner.t * 2); this.text(c, this.banner.s, W / 2, H / 2 - 50, 22, `hsl(${hue},90%,75%)`); this.text(c, this.banner.sub, W / 2, H / 2 - 24, 11, this.pal.ink); c.globalAlpha = 1; }
  }
  hud() { return `${this.score} · wave ${this.wave}`; }
}
