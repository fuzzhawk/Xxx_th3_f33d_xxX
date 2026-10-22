// Alto's Adventure-style endless downhill: tap to jump, hold in the air to backflip,
// land with your board along the slope. Obstacles are dark rocks and stumps on the snow;
// anything glowing in a bubble is a pick-up: coins, boost, shield and magnet.
// The rider is a Crystal Sprite character: walk/run strides by speed, a crouch into jumps,
// rise/apex/fall frames in the air, a landing on every touch-down, a flinch on a shield save
// or a sloppy landing, a knockdown on a wipeout (revived on restart), cheers for flips and
// pick-ups, and surprise when a power-up bubble comes into view.
import { Game, W, H, drawFit, drawRectImg, ready } from './engine.js';
import { Actor } from '../crystal/sprites.js';

const STEP_X = 16, FLIP = 7.5, TAU = Math.PI * 2;
const wrapA = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };

export class Ski extends Game {
  static noMods = ['mirror', 'giant'];
  setup() {
    this.ys = [0]; this.gap = [false]; this.rocks = []; this.coins = []; this.trees = [];
    this.genX = 0; this.genY = 0; this.slope = 0.3; this.feature = 30;
    this.p = { x: 40, y: 0, v: 160, vx: 0, vy: 0, ang: 0, av: 0, air: false, rot: 0, crash: 0 };
    this.ensure(1200);
    this.p.y = this.groundY(40);
    this.holding = false; this.trail = []; this.combo = 0; this.dist = 0; this.fx = { boost: 0, shield: 0, magnet: 0 };
    this.stats = { crash: 0, flips: 0 };
    this.mtn = [0, 1].map((k) => Array.from({ length: 24 }, () => this.r(0.3, 1)));
    this.msg = null; this.coinRun = 0;
    this.rider = new Actor(this.skin.crystal(0, 'Present day', ['W', 'E']), { mode: 'side', dir: 'E', walkSpeed: 4, runSpeed: 38, walkStride: 5, runStride: 7 });
  }
  ensure(x) {
    while (this.genX < x) {
      const i = this.ys.length;
      this.feature--;
      let gap = false;
      if (this.feature <= 0) {
        const kind = this.rng();
        if (kind < 0.3) this.pending = { gap: this.ri(5, 9) };
        else if (kind < 0.55) this.pending = { kick: 5 };
        else if (kind < 0.8) this.rocks.push({ x: this.genX + STEP_X * 2, kind: this.rng() < 0.65 ? 'rock' : 'stump', s: this.r(18, 28), seed: this.rng() });
        else if (kind < 0.9) for (let k = 0; k < 5; k++) this.coins.push({ x: this.genX + k * 26, dy: -40 - Math.sin(k / 4 * Math.PI) * 30, got: false });
        else this.coins.push({ x: this.genX + 20, dy: -50, got: false, power: ['boost', 'shield', 'magnet'][this.ri(0, 2)] });
        this.feature = this.ri(14, 30);
        this.slope = Math.max(0.15, Math.min(0.55, this.slope + this.r(-0.15, 0.15)));
      }
      let dy = Math.tan(this.slope) * STEP_X + Math.sin(i * 0.37) * 2;
      if (this.pending?.kick) { dy = -this.pending.kick * 3.4; if (--this.pending.kick <= 0) this.pending = null; }
      else if (this.pending?.gap) { gap = true; dy = Math.tan(this.slope) * STEP_X * 1.5; if (--this.pending.gap <= 0) this.pending = null; }
      this.genX += STEP_X; this.genY += dy;
      this.ys.push(this.genY); this.gap.push(gap);
      if (!gap && this.rng() < 0.18) this.trees.push({ x: this.genX, s: this.r(30, 70), i: this.skin.list('trees', 3, 'deco', 'item', 'animal')[this.ri(0, 2)], far: this.rng() < 0.4, pine: this.rng() < 0.7 });
    }
  }
  groundY(x) {
    const f = Math.min(x / STEP_X, this.ys.length - 1.001), i = Math.max(0, Math.floor(f)), t = f - i;
    return this.ys[i] + ((this.ys[i + 1] ?? this.ys[i]) - this.ys[i]) * t;
  }
  isGap(x) { return !!this.gap[Math.floor(x / STEP_X) + 1]; }
  slopeAt(x) { return Math.atan2(this.groundY(x + 6) - this.groundY(x - 6), 12); }

  jump() { const p = this.p; if (p.air || p.crash) return; this.rider.jump(); p.air = true; p.vx = p.v * Math.cos(p.ang) + Math.sin(p.ang) * 240; p.vy = p.v * Math.sin(p.ang) - Math.cos(p.ang) * 240; p.rot = 0; }
  down() { this.holding = true; this.jump(); }
  up() { this.holding = false; }
  tap() { this.jump(); }
  landTime() {
    const p = this.p; let x = p.x, y = p.y, vx = p.vx, vy = p.vy;
    for (let t = 0; t < 4; t += 0.02) { vy += 440 * this.G * 0.02; x += vx * 0.02; y += vy * 0.02; if (y >= this.groundY(x) && !this.isGap(x)) return { t, x }; }
    return { t: 4, x };
  }
  autopilot() {
    const p = this.p;
    if (p.crash) return;
    if (!p.air) {
      this.holding = false;
      const rock = this.rocks.find((r) => r.x - p.x > 0 && r.x - p.x < 30 + p.v * 0.12);
      const gapAhead = [1, 2, 3].some((k) => this.isGap(p.x + 10 + k * 8));
      const coin = this.coins.find((c) => !c.got && c.x - p.x > 0 && c.x - p.x < 60);
      if (rock || gapAhead || coin || this.rng() < 0.004) this.jump();
      return;
    }
    const { t, x } = this.landTime(), land = this.slopeAt(x);
    const remaining = ((p.ang - land) % TAU + TAU) % TAU; // how far still to rotate backwards to be upright
    const canFull = t > TAU / FLIP + 0.3;
    if (remaining < 0.25 || remaining > TAU - 0.25) this.holding = canFull && p.rot > -0.1 ? true : canFull && this.holding;
    else this.holding = FLIP * (t - 0.12) > remaining;
  }
  crash() {
    const p = this.p;
    p.crash = 1.2; this.combo = 0; this.stats.crash++; this.score = Math.max(0, this.score - 50);
    this.burst(W * 0.35, H * 0.55, this.pal.ink, 26, 220);
    this.msg = { s: 'WIPEOUT', t: 1.2 };
    this.rider.ko();
  }
  cheer(s) { if (!this.p.crash) this.rider.emote('cheer', s); }
  step(dt) {
    const p = this.p;
    this.sim(dt);
    // speeds are scaled down so the strides read as skating pushes, not a sprint
    const ev = this.rider.update(dt, { vx: p.crash ? 0 : p.v / 6, grounded: !p.air || !!p.crash, airVy: p.vy });
    if (ev.includes('land')) this.burst(this.sx(p.x), this.sy(p.y), this.pal.ink, 10, 110);
  }
  sim(dt) {
    const p = this.p;
    this.ensure(p.x + 900);
    if (p.crash) {
      p.crash -= dt; p.ang += 9 * dt; p.v = 60;
      if (p.crash <= 0) { p.crash = 0; this.rider.revive(); let x = p.x + 30; while (this.isGap(x) || this.isGap(x + 20)) x += STEP_X; p.x = x; p.y = this.groundY(x); p.air = false; p.ang = this.slopeAt(x); p.v = 120; }
      return;
    }
    if (!p.air) {
      const a = this.slopeAt(p.x);
      p.ang = a;
      p.v += (420 * this.G * Math.sin(a) - p.v * 0.18) * dt;
      p.v = Math.max(110, Math.min(520, p.v));
      const nx = p.x + p.v * Math.cos(a) * dt, ny = this.groundY(nx);
      const fly = p.y + p.v * Math.sin(a) * dt;
      if (this.isGap(nx) || ny - fly > 3) { p.air = true; p.vx = p.v * Math.cos(a); p.vy = p.v * Math.sin(a); p.rot = 0; }
      else { p.x = nx; p.y = ny; }
      if (this.rng() < 0.6) this.particles.push({ x: this.sx(p.x) - 6, y: this.sy(p.y), vx: -this.r(20, 80), vy: -this.r(20, 90), life: 0.4, max: 0.4, color: this.pal.ink, r: this.r(1, 2.5) });
      for (const r of this.rocks) if (!r.hit && Math.abs(r.x - p.x) < r.s * 0.4) { r.hit = true; if (this.fx.shield > 0) { this.fx.shield = 0; this.burst(this.sx(r.x), this.sy(this.groundY(r.x)), this.col(4), 18, 160); this.msg = { s: 'SHIELD SAVED YOU', t: 1 }; this.rider.hurt(); } else { this.crash(); return; } }
      if (this.fx.boost > 0) p.v = Math.max(p.v, 420);
    }
    if (p.air) {
      p.vy += 440 * this.G * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const target = this.holding ? -FLIP : 0;
      p.av += (target - p.av) * (this.holding ? 10 : 6) * dt;
      // gentle assist toward the ground's angle when not flipping
      if (!this.holding) { const d = wrapA(this.slopeAt(p.x) - p.ang); if (Math.abs(d) < 0.9) p.ang += d * 2.2 * dt; }
      p.ang += p.av * dt; p.rot += p.av * dt;
      const g = this.groundY(p.x);
      if (p.y >= g) {
        if (this.isGap(p.x)) { if (p.y > g + 160) this.crash(); }
        else {
          const d = wrapA(p.ang - this.slopeAt(p.x));
          if (Math.abs(d) > 0.65) { this.crash(); return; }
          const flips = Math.floor((-p.rot + 0.7) / TAU);
          p.air = false; p.y = g; p.av = 0;
          p.v = Math.hypot(p.vx, p.vy) * 0.92 + flips * 60;
          if (flips > 0) { this.stats.flips += flips; this.combo += flips; const pts = 100 * flips * this.combo; this.score += pts; this.msg = { s: `${flips > 1 ? flips + '× ' : ''}BACKFLIP +${pts}`, t: 1.2 }; this.cheer(0.5 + 0.25 * Math.min(4, this.combo)); }
          else if (Math.abs(d) < 0.12) { this.score += 20; this.msg = { s: 'CLEAN', t: 0.6 }; }
          else if (Math.abs(d) > 0.35) this.rider.hurt(); // sloppy landing: a wobble
        }
      }
    }
    for (const k of Object.keys(this.fx)) if (k !== 'shield') this.fx[k] = Math.max(0, this.fx[k] - dt);
    for (const c of this.coins) {
      if (c.got) continue;
      if (c.power && !c.seen && c.x - p.x < W * 0.6) { c.seen = true; if (!p.air) this.rider.emote('surprise', 0.4); }
      const cy = this.groundY(c.x) + c.dy;
      if (this.fx.magnet > 0 && !c.power && Math.hypot(c.x - p.x, cy - p.y) < 150) { c.x += (p.x - c.x) * 6 * dt; c.dy += (p.y - 12 - cy) * 6 * dt; }
      if (Math.abs(c.x - p.x) < (c.power ? 22 : 16) && Math.abs(cy - p.y + 12) < (c.power ? 30 : 22)) {
        c.got = true; this.burst(this.sx(c.x), this.sy(cy), c.power ? this.col(4) : '#ffd24a', c.power ? 20 : 8, 140);
        if (c.power) { this.fx[c.power] = c.power === 'shield' ? 1 : 5; this.msg = { s: { boost: 'BOOST!', shield: 'SHIELD UP', magnet: 'COIN MAGNET' }[c.power], t: 1.1 }; this.score += 50; this.cheer(0.7); }
        else { this.score += 25; if (++this.coinRun % 5 === 0) this.cheer(0.5); }
      }
    }
    this.dist = p.x;
    this.score += dt * p.v * 0.02;
    this.trail.push([p.x, p.y]); if (this.trail.length > 14) this.trail.shift();
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    const cut = p.x - 400;
    this.rocks = this.rocks.filter((r) => r.x > cut); this.coins = this.coins.filter((c) => c.x > cut); this.trees = this.trees.filter((t) => t.x > cut);
  }
  // camera: player sits a third of the way across, a little above the middle
  sx(x) { return x - this.camX; }
  sy(y) { return y - this.camY; }
  draw(c) {
    const p = this.p;
    this.camX = p.x - W * 0.32;
    const ty = p.y - H * 0.5;
    this.camY = this.camY == null ? ty : this.camY + (ty - this.camY) * 0.12;
    // sky
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.pal.bg); g.addColorStop(0.6, this.pal.bg2); g.addColorStop(1, this.col(4));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (ready(this.skin.bg)) {
      const i = this.skin.bg, iw = i.naturalWidth || i.width, ih = i.naturalHeight || i.height, h = H * 0.75, w = iw * h / ih, off = ((-this.camX * 0.05) % w + w) % w;
      c.globalAlpha = 0.4; for (let x = off - w; x < W; x += w) c.drawImage(i, x, 0, w, h); c.globalAlpha = 1;
    }
    c.fillStyle = this.pal.ink; c.globalAlpha = 0.8; c.beginPath(); c.arc(W * 0.78, H * 0.18, 22, 0, 7); c.fill(); c.globalAlpha = 1;
    // two mountain layers
    this.mtn.forEach((m, k) => {
      const par = 0.12 + k * 0.15, base = H * (0.55 + k * 0.12), seg = 90 - k * 20;
      c.fillStyle = k ? this.pal.bg : this.pal.bg2; c.globalAlpha = 0.75 + k * 0.2;
      c.beginPath(); c.moveTo(0, H);
      for (let x = -seg; x <= W + seg; x += seg / 2) {
        const wx = x + this.camX * par, i = Math.floor(wx / (seg / 2)), j = ((i % m.length) + m.length) % m.length;
        c.lineTo(x - (wx % (seg / 2)), base - m[j] * (110 - k * 30) * (i % 2 ? 0.6 : 1));
      }
      c.lineTo(W, H); c.closePath(); c.fill(); c.globalAlpha = 1;
    });
    // far trees
    for (const t of this.trees) if (t.far) this.tree(c, t, 0.55);
    // ground
    const i0 = Math.max(0, Math.floor(this.camX / STEP_X) - 1), i1 = Math.min(this.ys.length - 1, i0 + Math.ceil(W / STEP_X) + 3);
    c.beginPath();
    let open = false;
    const runs = [];
    for (let i = i0; i <= i1; i++) {
      if (this.gap[i]) { if (open) { runs.push(open); open = false; } continue; }
      (open ||= []).push([this.sx(i * STEP_X), this.sy(this.ys[i])]);
    }
    if (open) runs.push(open);
    for (const r of runs) {
      c.beginPath(); c.moveTo(r[0][0], H + 10); for (const [x, y] of r) c.lineTo(x, y); c.lineTo(r[r.length - 1][0], H + 10); c.closePath();
      c.fillStyle = this.pal.ink; c.fill();
      c.save(); c.clip();
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.16; drawRectImg(c, this.skin.texFor?.(5) || this.skin.slots.tile[0], 0, 0, W, H, true);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.5;
      const sg = c.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, this.pal.bg2); c.fillStyle = sg; c.fillRect(0, 0, W, H);
      c.restore(); c.globalAlpha = 1;
      c.strokeStyle = this.col(5); c.lineWidth = 2; c.beginPath(); r.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    }
    for (const t of this.trees) if (!t.far) this.tree(c, t, 1);
    for (const r of this.rocks) this.obstacle(c, r);
    for (const k of this.coins) if (!k.got) this.pickup(c, k);
    // scarf trail
    c.strokeStyle = this.col(0); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
    this.trail.forEach(([x, y], k) => { const X = this.sx(x) - (this.trail.length - k) * 2, Y = this.sy(y) - 16 + Math.sin(this.t * 14 + k) * 1.5; k ? c.lineTo(X, Y) : c.moveTo(X, Y); });
    c.stroke();
    // rider
    const x = this.sx(p.x), y = this.sy(p.y);
    // a wipeout tumbles for a moment, then the rider lies along the slope until restarting
    const ang = p.crash && p.crash < 0.85 ? this.slopeAt(p.x) : p.ang;
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = this.col(3); c.fillRect(p.crash ? 4 : -14, -3, 28, 4);
    this.rider.draw(c, 0, -3, 1.25 * this.S);
    c.restore();
    if (this.msg) { c.globalAlpha = Math.min(1, this.msg.t * 2); this.text(c, this.msg.s, W / 2, 70, 18, this.pal.ink); c.globalAlpha = 1; }
    const on = Object.entries(this.fx).filter(([, v]) => v > 0);
    on.forEach(([k, v], i) => this.text(c, `${{ boost: '⚡', shield: '⛨', magnet: 'U' }[k]}${k === 'shield' ? '' : ' ' + v.toFixed(1)}`, W - 40 - i * 52, 34, 12, '#cfefff'));
    if (this.fx.shield > 0) { c.strokeStyle = 'rgba(160,230,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(this.sx(p.x), this.sy(p.y) - 16, 22, 0, 7); c.stroke(); }
  }
  // scenery: pine silhouettes, with the theme's PNGs kept to the far, faded layer so they never read as obstacles
  tree(c, t, k) {
    const x = this.sx(t.x), y = this.sy(this.groundY(t.x)) + (k < 1 ? -4 : 2), h = t.s * k;
    if (k < 1 && !t.pine) { c.globalAlpha = 0.4; drawFit(c, t.i, x, y - h * 0.45, h, h); c.globalAlpha = 1; return; }
    c.fillStyle = k < 1 ? this.pal.bg2 : this.col(2); c.globalAlpha = k < 1 ? 0.6 : 0.85;
    for (let i = 0; i < 3; i++) { const w = h * (0.32 - i * 0.07), yy = y - h * (0.25 + i * 0.25); c.beginPath(); c.moveTo(x, yy - h * 0.32); c.lineTo(x + w, yy + h * 0.08); c.lineTo(x - w, yy + h * 0.08); c.fill(); }
    c.fillRect(x - 1.5, y - h * 0.2, 3, h * 0.2); c.globalAlpha = 1;
  }
  // obstacles: dark, angular, sitting in the snow, with a red warning flag ahead of them
  obstacle(c, r) {
    const x = this.sx(r.x), y = this.sy(this.groundY(r.x)), s = r.s;
    c.save(); c.translate(x, y); c.rotate(this.slopeAt(r.x));
    if (r.kind === 'rock') {
      c.fillStyle = '#2b2622'; c.beginPath(); c.moveTo(-s * 0.6, 2); c.lineTo(-s * 0.45, -s * 0.5); c.lineTo(-s * 0.05, -s * (0.75 + r.seed * 0.2)); c.lineTo(s * 0.35, -s * 0.55); c.lineTo(s * 0.6, 2); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(-s * 0.45, -s * 0.5); c.lineTo(-s * 0.05, -s * (0.75 + r.seed * 0.2)); c.lineTo(-s * 0.1, -s * 0.3); c.fill();
      c.fillStyle = this.pal.ink; c.beginPath(); c.moveTo(-s * 0.2, -s * (0.68 + r.seed * 0.18)); c.lineTo(-s * 0.05, -s * (0.75 + r.seed * 0.2)); c.lineTo(s * 0.15, -s * 0.62); c.fill();
    } else {
      c.fillStyle = '#4a2f1c'; c.fillRect(-s * 0.35, -s * 0.55, s * 0.7, s * 0.6); c.fillStyle = '#c8a070'; c.beginPath(); c.ellipse(0, -s * 0.55, s * 0.35, s * 0.1, 0, 0, 7); c.fill();
      c.strokeStyle = '#7a5030'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -s * 0.55, s * 0.18, s * 0.05, 0, 0, 7); c.stroke();
    }
    c.restore();
    if (!r.hit) { c.strokeStyle = '#d23a2a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - s - 6, y - 2); c.lineTo(x - s - 6, y - 22); c.stroke(); c.fillStyle = '#e8402e'; c.beginPath(); c.moveTo(x - s - 6, y - 22); c.lineTo(x - s + 4, y - 18); c.lineTo(x - s - 6, y - 14); c.fill(); }
  }
  // pick-ups float and glow: gold coins, and bubbles with an icon for power-ups
  pickup(c, k) {
    const x = this.sx(k.x), y = this.sy(this.groundY(k.x) + k.dy) + Math.sin(this.t * 4 + k.x) * 3;
    const glow = c.createRadialGradient(x, y, 2, x, y, k.power ? 26 : 14); glow.addColorStop(0, k.power ? 'rgba(160,230,255,.55)' : 'rgba(255,220,90,.55)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(x, y, k.power ? 26 : 14, 0, 7); c.fill();
    if (!k.power) {
      const sq = Math.abs(Math.cos(this.t * 3 + k.x));
      c.fillStyle = '#f0b830'; c.beginPath(); c.ellipse(x, y, 6 * Math.max(0.2, sq), 6, 0, 0, 7); c.fill();
      c.fillStyle = '#fff2a0'; c.beginPath(); c.ellipse(x - sq, y - 2, 2 * Math.max(0.2, sq), 2, 0, 0, 7); c.fill();
      return;
    }
    c.fillStyle = 'rgba(140,210,255,.25)'; c.strokeStyle = 'rgba(220,245,255,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 14, 0, 7); c.fill(); c.stroke();
    this.text(c, { boost: '⚡', shield: '⛨', magnet: 'U' }[k.power], x, y + 1, 15, '#fff');
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x - 5, y - 6, 2.5, 0, 7); c.fill();
  }
  hud() { return `${Math.floor(this.score)} · ${Math.floor(this.dist / 30)}m`; }
}
