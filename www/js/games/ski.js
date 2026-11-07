// A calm, Alto's Adventure-style endless downhill. Tap to jump; press and hold again once you are properly
// airborne to backflip (the jump press itself never spins you, and small hops never rotate); land roughly
// along the slope — when you are not flipping the board levels itself toward the landing.
// The hill is one smooth surface (a slowly wandering gradient plus long low waves, Catmull-Rom between
// samples) with occasional kickers, rollers and gaps; every gap is sized so a rider at minimum speed clears
// it, and the far side of a gap is a wall you slide down, never one you pop up onto.
// Obstacles are dark rocks and stumps with red flags; anything glowing is a pick-up: gold coins and
// bubbles (boost, shield, magnet). Scenery: a time-of-day sky with sun or moon, the theme's backdrop group
// (`skin.bgSet`) as a far painted strip (or drifting clouds), ridged mountains, hills with villages, forest,
// and snowfall or blossom. The rider is a Crystal Sprite: walk/run strides by speed, crouch-jump-apex-fall
// frames, a landing on every touch-down, a flinch on a sloppy landing or a shield save, a knockdown on a
// wipeout (revived after), cheers for flips and pick-ups, and surprise when a bubble comes into view.
import { Game, W, H, ready } from './engine.js';
import { Actor } from '../crystal/sprites.js';

const SX = 8, GRAV = 380, JUMP = 210, FLIP = 6.8, HOLD = 0.12, LAND = 1.0, VMIN = 110, VMAX = 320, TAU = Math.PI * 2;
const wrapA = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cosi = (a, b, t) => a + (b - a) * (1 - Math.cos(Math.PI * t)) / 2;
const per = (a, x, P) => { const n = a.length, f = ((x % P + P) % P) / P * n, k = Math.floor(f) % n; return a[k] + (a[(k + 1) % n] - a[k]) * (f - Math.floor(f)); };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
// periodic value noise, normalised to 0..1 (pow > 1 sharpens peaks)
function ridge(R, n, oct, pow) {
  const out = new Float32Array(n);
  for (let o = 0; o < oct; o++) {
    const m = 3 << o, tab = Array.from({ length: m }, R), amp = 0.55 ** o;
    for (let i = 0; i < n; i++) { const f = i / n * m, k = Math.floor(f); out[i] += cosi(tab[k], tab[(k + 1) % m], f - k) * amp; }
  }
  let lo = Infinity, hi = -Infinity; for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return out.map((v) => ((v - lo) / (hi - lo || 1)) ** pow);
}

// gradient top/middle/bottom, sun (or moon) colour and height, clouds, far/mid/near layers, snow and its shade, trees, haze
const SKIES = {
  dawn: { sky: ['#34406e', '#b9809f', '#f7c59f'], sun: '#fff0d8', sunY: 0.33, cloud: '#ffd9cf', far: '#9a8cb4', mid: '#76739f', near: '#575b88', snow: '#f8f2f6', shade: '#c7bfdc', tree: '#3d4270', haze: '#f0c6bd', lit: true },
  day: { sky: ['#4f93da', '#94c8ee', '#e4f3fb'], sun: '#fffbea', sunY: 0.14, cloud: '#ffffff', far: '#a3bfd9', mid: '#7aa2c4', near: '#5a84a6', snow: '#ffffff', shade: '#c6d9ea', tree: '#2f5b5a', haze: '#d9eaf5' },
  golden: { sky: ['#4c6aa0', '#eab184', '#ffe1ac'], sun: '#fff1c4', sunY: 0.27, cloud: '#ffe7c9', far: '#b9a0a6', mid: '#93808f', near: '#6d6177', snow: '#fff7ec', shade: '#e6c6ae', tree: '#47475c', haze: '#f5d2ad' },
  dusk: { sky: ['#1c2150', '#6e4a83', '#ee8a6a'], sun: '#ffd09a', sunY: 0.38, cloud: '#f2a58f', far: '#6c5079', mid: '#4f3c65', near: '#382a4d', snow: '#ebdff0', shade: '#a596bf', tree: '#271e3a', haze: '#c98289', lit: true },
  night: { sky: ['#060a1c', '#122048', '#2b3e6e'], sun: '#f3f1e2', sunY: 0.16, cloud: '#55648f', far: '#243660', mid: '#1b294b', near: '#131d38', snow: '#cfd9ee', shade: '#7f8fb6', tree: '#0d1429', haze: '#2a3b68', lit: true, night: true }
};
const PM = 1500, PH = 1700, PN = 1250; // periods of the mountain, hill and forest layers

export class Ski extends Game {
  static noMods = ['mirror', 'giant'];
  setup() {
    const R = () => this.rng();
    this.tod = ['dawn', 'day', 'day', 'golden', 'dusk', 'night'][this.ri(0, 5)];
    this.sky = SKIES[this.tod];
    this.weather = this.rng() < 0.55 ? 'snow' : this.rng() < 0.7 ? 'blossom' : 'clear';
    this.ys = []; this.gaps = []; this.feats = []; this.rocks = []; this.coins = []; this.trees = []; this.marks = [];
    this.cp = [[0, 0.24], [this.r(500, 900), this.slopePick()]]; this.ci = 0; this.baseY = 0; this.genX = -SX;
    this.nextF = 560; this.lastRock = -1e9; this.lastLip = -1e9;
    this.waves = [[this.r(0.08, 0.14), TAU / this.r(520, 900), this.r(0, TAU)], [this.r(0.03, 0.06), TAU / this.r(220, 360), this.r(0, TAU)]];
    this.forest = [this.r(0, TAU), TAU / this.r(500, 1100)];
    this.ensure(1400);
    const p = this.p = { x: 60, y: 0, v: 150, vx: 0, vy: 0, ang: 0, av: 0, rot: 0, air: false, airT: 0, crash: 0, flipping: false, jumped: false, lipF: null, pit: false };
    p.y = this.groundY(p.x); p.ang = this.slope(p.x);
    this.holding = false; this.pressAir = false; this.holdT = 0; this.buffer = 0; this.ap = {};
    this.fx = { boost: 0, shield: 0, magnet: 0 };
    this.stats = { crash: 0, rock: 0, bad: 0, flips: 0, lands: 0, jumps: 0, pop: 0, wall: 0, hopSpin: 0, pit: 0, carry: 0 };
    this.combo = 0; this.dist = 0; this.msg = null; this.coinRun = 0; this.cheerQ = 0;
    this.puffs = []; this.trail = []; this.track = [];
    this.camX = p.x - W * 0.3; this.camY = p.y - H * 0.5; this.camB = this.camY; this.dyP = 0;
    // scenery: a mountain range, a hill line with pines and villages, a forest edge, clouds, stars, weather
    this.mtn = ridge(R, 160, 5, 1.4); this.hill = ridge(R, 90, 2, 1); this.wood = ridge(R, 90, 3, 1);
    this.midItems = [];
    for (let x = 10; x < PH - 80;) {
      if (this.rng() < 0.14) { const n = this.ri(3, 6); for (let k = 0; k < n; k++) this.midItems.push({ x: x + k * 11, k: k === 1 && this.rng() < 0.5 ? 'church' : 'house', s: this.r(6, 9), lit: this.rng() < 0.75 }); x += n * 11 + 30; }
      else { this.midItems.push({ x, k: 'pine', s: this.r(7, 14) }); x += this.r(5, 42); }
    }
    this.nearItems = [];
    for (let x = 0; x < PN - 30; x += this.r(7, 34)) if (this.rng() < 0.85) this.nearItems.push({ x, k: this.weather === 'blossom' && this.rng() < 0.35 ? 'bloom' : 'pine', s: this.r(13, 26) });
    this.clouds = Array.from({ length: 7 }, (_, k) => ({ x: k * 160 + this.r(0, 90), y: this.r(22, 140), s: this.r(22, 52), n: this.ri(3, 5) }));
    this.stars = this.sky.night ? Array.from({ length: 70 }, () => [this.r(0, W), this.r(0, H * 0.6), this.r(0.4, 1.3), this.r(0, TAU)]) : [];
    this.flakes = this.weather === 'clear' ? [] : Array.from({ length: this.weather === 'snow' ? 60 : 28 }, () => ({ x: this.r(0, W), y: this.r(0, H), z: this.r(0.25, 1), ph: this.r(0, TAU) }));
    this.rider = new Actor(this.skin.crystal(0, 'Present day', ['W', 'E']), { mode: 'side', dir: 'E', walkSpeed: 4, runSpeed: 38, walkStride: 5, runStride: 7 });
  }

  // ---------------------------------------------------------------- terrain
  slopePick() { const k = this.rng(); return k < 0.35 ? this.r(0.12, 0.22) : k < 0.8 ? this.r(0.22, 0.34) : this.r(0.34, 0.44); }
  // the base gradient (dy/dx, downhill positive): control points eased into each other plus two long, low waves
  bs(x) {
    const cp = this.cp; let i = this.ci;
    while (cp[i + 1][0] < x) i++;
    const [x0, s0] = cp[i], [x1, s1] = cp[i + 1];
    let s = cosi(s0, s1, clamp((x - x0) / (x1 - x0), 0, 1));
    for (const [a, k, ph] of this.waves) s += a * Math.sin(k * x + ph);
    return s;
  }
  ensure(x) {
    while (this.cp[this.cp.length - 1][0] < x + 3000) this.cp.push([this.cp[this.cp.length - 1][0] + this.r(700, 1600), this.slopePick()]);
    while (this.genX < x) {
      const i = this.ys.length, X = i * SX;
      while (this.cp[this.ci + 1][0] < X) this.ci++;
      if (X >= this.nextF) this.feature(X);
      if (i) this.baseY += this.bs(X - SX / 2) * SX;
      let off = 0, gap = 0;
      for (const f of this.feats) if (f.off && X >= f.x0 && X <= f.x1) { off += f.off(X); if (f.g0 != null && X >= f.g0 && X < f.g1) gap = 1; }
      this.ys.push(this.baseY + off); this.gaps.push(gap); this.genX = X;
      for (const f of this.feats) if (!f.sp && X > f.x1 + SX * 2) { f.sp = true; f.spawn?.(f); }
      // trees and the odd cabin, only on the quiet stretches between features
      const last = this.feats[this.feats.length - 1];
      if (!last || X > last.x1 + 40) {
        const d = 0.5 + 0.5 * Math.sin(X * this.forest[1] + this.forest[0]);
        if (this.rng() < 0.07 * d * d) this.trees.push({ x: X, s: this.r(26, 58), k: this.weather === 'blossom' && this.rng() < 0.45 ? 'bloom' : 'pine', far: this.rng() < 0.4 });
        else if (this.rng() < 0.0035) this.trees.push({ x: X, s: this.r(26, 34), k: 'cabin' });
      }
    }
  }
  feature(x0) {
    const k = this.rng();
    let f;
    if (k < 0.24) f = this.kicker(x0, false);
    else if (k < 0.4) f = this.kicker(x0, true);
    else if (k < 0.55) f = this.rollers(x0);
    else if (k < 0.7 && x0 - this.lastRock > 900 && x0 - this.lastLip > 650) f = this.rockF(x0);
    else if (k < 0.85) f = this.coinF(x0);
    else if (k < 0.94) f = this.powerF(x0);
    else f = { x0, x1: x0 + this.r(200, 400) }; // a quiet stretch
    this.feats.push(f);
    this.nextF = Math.ceil((f.x1 + this.r(220, 520)) / SX) * SX;
  }
  // a concave ramp up to a lip, then a long landing slope easing back into the hill (optionally a gap after the lip)
  kicker(x0, gap) {
    const L = Math.round(this.r(90, 140) / SX) * SX, h = this.r(0.55, 0.8) * L / 2, lip = x0 + L, D = gap ? this.r(220, 300) : this.r(170, 250);
    const off = (X) => (X <= lip ? -h * ((X - x0) / L) ** 2 : -h * (1 + Math.cos(Math.PI * Math.min(1, (X - lip) / D))) / 2);
    const f = { x0, x1: lip + D, lip, off, kind: 'kick', la: Math.atan(this.bs(lip) - 2 * h / L) };
    if (gap) {
      // where a rider launched at the slowest lip speed (150) lands, measured from the lip; leave 40px to spare
      const w = Math.min(120, Math.floor((this.reach(f, 150) - 40) / SX) * SX);
      if (w >= 40) { f.g0 = lip; f.g1 = lip + w; f.kind = 'gap'; }
    }
    this.lastLip = lip;
    if (this.rng() < 0.55) { f.coins = true; f.spawn = () => this.lipCoins(f); }
    return f;
  }
  reach(f, v) {
    const g = GRAV * this.G, vx = v * Math.cos(f.la), vy = v * Math.sin(f.la);
    let T = 0;
    for (let d = 4; d < 600; d += 4) {
      T += this.bs(f.lip + d - 2) * 4;
      const t = d / vx;
      if (vy * t + 0.5 * g * t * t >= T + f.off(Math.min(f.x1, f.lip + d)) - f.off(f.lip)) return d;
    }
    return 600;
  }
  rollers(x0) {
    const n = this.ri(2, 4), L = this.r(120, 170), h = this.r(8, 15);
    const f = { x0, x1: x0 + n * L, kind: 'roll', off: (X) => -h * (1 - Math.cos(TAU * (X - x0) / L)) / 2 };
    if (this.rng() < 0.4) f.spawn = () => { for (let k = 0; k < n; k++) this.coins.push({ x: x0 + (k + 0.5) * L, y: this.groundY(x0 + (k + 0.5) * L) - 18 }); };
    return f;
  }
  rockF(x0) {
    this.lastRock = x0;
    return {
      x0, x1: x0 + 120, kind: 'rock',
      spawn: () => {
        const kind = this.rng() < 0.6 ? 'rock' : 'stump', s = this.r(16, 23), r = { x: x0 + 50, kind, s, h: s * (kind === 'rock' ? 0.8 : 0.6), seed: this.rng() };
        this.rocks.push(r); this.marks.push({ x: r.x, kind: 'rock', r });
        if (this.rng() < 0.5) for (let k = -1; k <= 1; k++) this.coins.push({ x: r.x + k * 20, y: this.groundY(r.x + k * 20) - 50 + Math.abs(k) * 8 });
      }
    };
  }
  coinF(x0) {
    const n = this.ri(5, 7), hop = this.rng() < 0.5;
    return {
      x0, x1: x0 + n * 22 + 20, kind: 'coins',
      spawn: () => {
        for (let k = 0; k < n; k++) { const x = x0 + k * 22; this.coins.push({ x, y: this.groundY(x) - 18 - (hop ? Math.sin(k / (n - 1) * Math.PI) * 40 : 0) }); }
        if (hop) this.marks.push({ x: x0 + (n - 1) * 11, kind: 'arc' });
      }
    };
  }
  powerF(x0) {
    return { x0, x1: x0 + 90, kind: 'power', spawn: () => { const x = x0 + 40, c = { x, y: this.groundY(x) - 46, power: ['boost', 'shield', 'magnet'][this.ri(0, 2)] }; this.coins.push(c); this.marks.push({ x, kind: 'bubble' }); } };
  }
  // coins along the flight from a lip at an average speed, no jump
  lipCoins(f) {
    const g = GRAV * this.G, v = 185;
    let x = f.lip, y = this.groundY(f.lip), vx = v * Math.cos(f.la), vy = v * Math.sin(f.la), n = 0;
    for (let t = 0; t < 3 && n < 7; t += 1 / 60) {
      vy += g / 60; x += vx / 60; y += vy / 60;
      if (this.groundY(x) - y < 12) break;
      if (Math.round(t * 60) % 7 === 6) { this.coins.push({ x, y: y - 14 }); n++; }
    }
  }
  groundY(x) {
    const ys = this.ys, f = clamp(x / SX, 0, ys.length - 2.001), i = Math.floor(f), t = f - i;
    const y1 = ys[i], y2 = ys[i + 1], y0 = i ? ys[i - 1] : y1, y3 = ys[i + 2] ?? y2;
    return y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0)));
  }
  isGap(x) { return !!this.gaps[Math.floor(x / SX)]; }
  slope(x) { return Math.atan2(this.groundY(x + 3) - this.groundY(x - 3), 6); }
  gapAt(x) { return this.feats.find((f) => f.g0 != null && x >= f.g0 - 4 && x <= f.g1 + 4); }

  // ---------------------------------------------------------------- input
  launch(vx, vy, lipF = null) {
    const p = this.p;
    Object.assign(p, { air: true, vx, vy, airT: 0, rot: 0, av: 0, flipping: false, jumped: false, lipF });
    this.ap = {};
  }
  // a jump never slows you: the push is up from the board plus any forward part of it
  jump() {
    const p = this.p;
    if (p.crash) return false;
    const coyote = p.air && !p.jumped && p.airT < 0.12;
    if (p.air && !coyote) return false;
    const a = p.lipF ? 0 : p.ang;
    if (!p.air) this.launch(p.v * Math.cos(p.ang), p.v * Math.sin(p.ang));
    p.vx += Math.max(0, Math.sin(a)) * JUMP; p.vy -= Math.cos(a) * JUMP;
    p.jumped = true; this.stats.jumps++;
    this.rider.jump();
    return true;
  }
  press() {
    const p = this.p;
    this.holding = true; this.holdT = 0;
    if (this.jump()) { this.pressAir = false; return; }
    this.pressAir = p.air && !p.crash; // only a press that starts in the air can turn into a backflip
    if (p.air && !p.crash && this.airLeft().t < 0.14) this.buffer = 0.16; // a tap just before touchdown jumps on landing
  }
  down() { this.press(); }
  up() { this.holding = false; }
  // ballistic flight from the current state: time and place of touchdown
  airLeft() {
    const p = this.p, g = GRAV * this.G;
    let x = p.x, y = p.y, vx = p.vx, vy = p.vy, t = 0;
    for (; t < 3; t += 1 / 50) {
      vy += g / 50; x += vx / 50; y += vy / 50;
      if (!this.isGap(x) && y >= this.groundY(x)) break;
    }
    return { t, x };
  }
  simJump() {
    const p = this.p, a = p.ang, g = GRAV * this.G;
    let x = p.x, y = p.y, vx = p.v * Math.cos(a) + Math.max(0, Math.sin(a)) * JUMP, vy = p.v * Math.sin(a) - Math.cos(a) * JUMP, peak = 0, px = x;
    const pts = [];
    for (let t = 0; t < 3; t += 1 / 60) {
      vy += g / 60; x += vx / 60; y += vy / 60;
      const gy = this.groundY(x);
      if (t > 0.05 && !this.isGap(x) && y >= gy) break;
      pts.push([x, gy - y]); if (gy - y > peak) { peak = gy - y; px = x; }
    }
    return { pts, px: px - p.x, land: x };
  }
  // calm, competent play: hop rocks with the top of the arc over them, hop for coin arcs and bubbles,
  // pop off most lips, and backflip only when the flight is long enough to land it
  autopilot() {
    const p = this.p, ap = this.ap;
    if (p.crash) { this.holding = false; return; }
    if (!p.air) {
      this.holding = false;
      const m = this.marks.find((m) => !m.done && m.x > p.x + 2);
      if (m && m.x - p.x < 340) {
        const s = this.simJump();
        if (m.x - p.x <= s.px + 4) { m.done = true; if (m.kind === 'rock' || this.rng() < 0.9) this.press(); }
      } else if (this.rng() < 0.0015 && !this.feats.some((f) => f.lip > p.x && f.lip < p.x + 260)) this.press();
      return;
    }
    if (this.holding && !ap.flip) this.holding = false;
    if (p.lipF && !p.jumped && p.airT < 0.08) {
      ap.lipJump ??= !p.lipF.coins && this.rng() < 0.8;
      if (ap.lipJump) { this.press(); this.holding = false; }
    }
    if (!ap.plan && p.airT > 0.14) {
      ap.plan = true;
      const t = this.airLeft().t;
      ap.n = t > 2.4 && this.rng() < 0.5 ? 2 : t > 1.4 && this.rng() < 0.8 ? 1 : 0;
      if (ap.n) { this.press(); ap.flip = true; }
    }
    if (ap.flip && this.holding && (-p.rot >= ap.n * TAU - 0.75 || (!p.flipping && p.airT > 0.6))) { this.holding = false; ap.flip = false; }
  }

  // ---------------------------------------------------------------- simulation
  step(dt) {
    const p = this.p;
    this.ensure(p.x + 1000);
    if (this.holding) this.holdT += dt;
    if (this.buffer > 0) this.buffer -= dt;
    const cx = this.camX, cy = this.camY;
    this.phys(dt);
    const ev = this.rider.update(dt, { vx: p.crash ? 0 : p.v / 6, grounded: !p.air || !!p.crash || (!p.jumped && !p.lipF && p.airT < 0.2), airVy: p.vy });
    if (ev.includes('land') && !p.crash) this.puff(p.x, p.y, 6, 60);
    if (this.cheerQ && !p.air && !p.crash) { this.rider.emote('cheer', this.cheerQ); this.cheerQ = 0; }
    // camera: rider a third of the way across, looking a little down the hill; far layers lag behind drops
    this.camX = p.x - W * 0.3;
    const ty = (p.pit ? this.groundY(p.x - 40) : p.y) * 0.55 + this.groundY(p.x + 150) * 0.45 - H * 0.5;
    this.camY += (ty - this.camY) * Math.min(1, 3 * dt);
    this.camB += (this.camY - this.camB) * Math.min(1, 0.5 * dt);
    this.dyP = clamp(this.camY - this.camB, -60, 90);
    // particles in the world, weather on the screen (drifting against the camera by depth)
    for (const q of this.puffs) { q.vy += 120 * dt; q.vx *= 1 - 1.5 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    if (this.puffs.length && this.puffs[0].life <= 0) this.puffs = this.puffs.filter((q) => q.life > 0);
    const dx = this.camX - cx, dy = this.camY - cy, bl = this.weather === 'blossom';
    for (const f of this.flakes) {
      f.x += (Math.sin(this.t * (bl ? 1.3 : 0.8) + f.ph) * (bl ? 16 : 8) - 8) * dt - dx * f.z * 0.6;
      f.y += (bl ? 10 + 14 * f.z : 14 + 28 * f.z) * dt - dy * f.z * 0.6;
      if (f.x < -10) f.x += W + 20; else if (f.x > W + 10) f.x -= W + 20;
      if (f.y > H + 10) f.y -= H + 20; else if (f.y < -10) f.y += H + 20;
    }
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) {
      const cut = p.x - 420;
      this.rocks = this.rocks.filter((r) => r.x > cut); this.coins = this.coins.filter((c) => c.x > cut && !c.got);
      this.trees = this.trees.filter((t) => t.x > cut); this.marks = this.marks.filter((m) => m.x > cut);
      this.feats = this.feats.filter((f) => f.x1 > cut || !f.sp);
    }
  }
  phys(dt) {
    const p = this.p, g = GRAV * this.G;
    this.fx.boost = Math.max(0, this.fx.boost - dt); this.fx.magnet = Math.max(0, this.fx.magnet - dt);
    if (p.crash) {
      p.crash -= dt;
      if (p.pit) p.y += 160 * dt;
      else {
        // slide to a stop along the snow, never over a lip
        p.v *= Math.exp(-2.4 * dt);
        const nx = p.x + p.v * dt;
        if (!this.isGap(nx + 8) && !this.feats.some((f) => f.lip != null && nx >= f.lip - 12 && p.x < f.lip)) { p.x = nx; p.y = this.groundY(nx); }
        p.ang = this.slope(p.x);
      }
      if (p.crash <= 0) this.revive();
      return;
    }
    if (!p.air) this.ride(dt, g); else this.fly(dt, g);
    if (p.crash) return;
    for (const r of this.rocks) {
      if (r.hit || Math.abs(r.x - p.x) > r.s * 0.45 || this.groundY(r.x) - p.y > r.h * 0.75) continue;
      r.hit = true;
      if (this.fx.shield > 0) { this.fx.shield = 0; this.puff(r.x, this.groundY(r.x) - 8, 16, 120, '#bfefff'); this.msg = { s: 'SHIELD SAVED YOU', t: 1.2 }; this.rider.hurt(); }
      else { this.stats.rock++; return this.crash(); }
    }
    for (const c of this.coins) {
      if (c.got) continue;
      if (c.power && !c.seen && c.x - p.x < W * 0.6) { c.seen = true; if (!p.air) this.rider.emote('surprise', 0.4); }
      if (this.fx.magnet > 0 && !c.power) { const ex = p.x - c.x, ey = p.y - 14 - c.y; if (ex * ex + ey * ey < 150 * 150) { c.x += ex * 5 * dt; c.y += ey * 5 * dt; } }
      if (Math.abs(c.x - p.x) < (c.power ? 20 : 14) && Math.abs(c.y - (p.y - 14)) < (c.power ? 26 : 20)) {
        c.got = true; this.puff(c.x, c.y, c.power ? 14 : 6, 90, c.power ? '#bfefff' : '#ffd24a');
        if (c.power) { this.fx[c.power] = c.power === 'shield' ? 1 : 5; this.msg = { s: { boost: 'BOOST', shield: 'SHIELD UP', magnet: 'COIN MAGNET' }[c.power], t: 1.2 }; this.score += 50; this.cheerQ = 0.7; }
        else { this.score += 10; if (++this.coinRun % 6 === 0) this.cheerQ = 0.5; }
      }
    }
    this.dist = p.x;
    this.score += dt * p.v * 0.01;
    if (Math.floor(this.t * 60) % 2 === 0) { this.trail.unshift([p.x + Math.sin(p.ang) * 20 * this.S, p.y - Math.cos(p.ang) * 20 * this.S]); if (this.trail.length > 9) this.trail.pop(); }
  }
  ride(dt, g) {
    const p = this.p, a = this.slope(p.x);
    p.ang = a;
    p.v += (320 * this.G * Math.sin(a) - 0.55 * (p.v - 40)) * dt;
    p.v = clamp(p.v, VMIN, this.fx.boost > 0 ? VMAX + 40 : VMAX);
    if (this.fx.boost > 0) p.v = Math.max(p.v, 300);
    const vx = p.v * Math.cos(a), vy = p.v * Math.sin(a), nx = p.x + vx * dt;
    const lip = this.feats.find((f) => f.lip != null && !f.used && nx >= f.lip - 10 && p.x < f.lip + 20);
    if (lip) {
      lip.used = true;
      const v = Math.max(p.v, lip.g0 != null ? 150 : 0);
      p.x = lip.lip; p.y = this.groundY(lip.lip);
      this.launch(v * Math.cos(lip.la), v * Math.sin(lip.la), lip); this.track.push(null);
      return;
    }
    const by = p.y + vy * dt + 0.5 * g * dt * dt, gy = this.groundY(nx);
    if (this.isGap(nx) || gy > by + 0.05) { p.x = nx; p.y = by; this.launch(vx, vy + g * dt); this.track.push(null); return; }
    if (p.y - gy > 5) this.stats.pop++;
    p.x = nx; p.y = gy;
    const last = this.track[this.track.length - 1];
    if (!last || p.x - last[0] > 6) { this.track.push([p.x, p.y]); if (this.track.length > 80) this.track.shift(); }
    if (this.rng() < 0.25 + p.v / 800) this.puffs.push({ x: p.x - 10 * Math.cos(a), y: p.y - 1, vx: vx * 0.35 - this.r(0, 40), vy: -this.r(15, 70), life: 0.5, max: 0.5, r: this.r(1, 2.4), c: this.sky.snow });
  }
  fly(dt, g) {
    const p = this.p;
    p.airT += dt;
    // a backflip needs a fresh hold that began after takeoff, held for a moment, with real airtime still ahead
    if (this.holding && this.pressAir && this.holdT >= HOLD && !p.flipping && p.airT > 0.1 && this.airLeft().t > 0.55) p.flipping = true;
    if (p.flipping && !this.holding) p.flipping = false;
    if (p.flipping) p.av += (-FLIP - p.av) * Math.min(1, 9 * dt);
    else {
      // the board settles toward the slope it will land on
      p.av *= Math.exp(-10 * dt);
      const d = wrapA(this.slope(this.airLeft().x) - p.ang);
      p.ang += clamp(d * 4 * dt, -4.5 * dt, 4.5 * dt);
    }
    p.ang += p.av * dt; p.rot += p.av * dt;
    p.vy += g * dt;
    // a rider who took off early (before a gap's lip) is carried gently across rather than dropped in
    const gf = this.feats.find((f) => f.g0 != null && p.x > f.g0 - 160 && p.x < f.g1);
    if (gf) {
      const fy = this.groundY(gf.g1 + 8) - p.y, disc = p.vy * p.vy + 2 * g * fy;
      if (fy > 0 && disc > 0) { const need = (gf.g1 + 30 - p.x) * g / (Math.sqrt(disc) - p.vy); if (p.vx < need) { p.vx = Math.min(need, p.vx + 500 * dt); this.stats.carry++; } }
    }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (this.isGap(nx)) { p.x = nx; p.y = ny; if (ny > this.groundY(nx) + 140) this.crash(true); return; }
    const gy = this.groundY(nx);
    if (ny < gy) { p.x = nx; p.y = ny; return; }
    // touching the hill: from inside a gap it is a wall to slide down, never a ledge to pop up onto
    if (this.isGap(p.x) && p.y > gy + 3) { this.stats.wall++; p.vx = 0; p.y = ny; return; }
    p.x = nx; p.y = gy;
    this.land();
  }
  land() {
    const p = this.p, sa = this.slope(p.x), d = wrapA(p.ang - sa), flips = Math.floor((-p.rot + LAND) / TAU);
    if (p.airT < 0.6 && Math.abs(p.rot) > 0.3) this.stats.hopSpin++;
    const speed = Math.hypot(p.vx, p.vy), along = p.vx * Math.cos(sa) + p.vy * Math.sin(sa);
    p.air = false; p.av = 0; p.flipping = false; p.lipF = null;
    p.v = clamp(Math.max(along, speed * 0.7), VMIN, VMAX);
    if (Math.abs(d) > LAND) {
      if (this.fx.shield <= 0) { this.stats.bad++; return this.crash(); }
      this.fx.shield = 0; this.msg = { s: 'SHIELD SAVED YOU', t: 1.2 }; this.rider.hurt();
    }
    p.ang = sa; this.stats.lands++;
    this.puff(p.x, p.y, Math.min(14, 4 + p.airT * 8), 70);
    if (flips > 0) {
      this.stats.flips += flips; this.combo += flips;
      const pts = 100 * flips * this.combo;
      this.score += pts; p.v = Math.min(VMAX, p.v + 25 * flips);
      this.msg = { s: `${flips > 1 ? flips + '× ' : ''}BACKFLIP +${pts}`, t: 1.4 };
      this.cheerQ = 0.5 + 0.25 * Math.min(4, this.combo);
    } else if (p.airT > 0.5 && Math.abs(d) < 0.15) { this.score += 10; this.msg ||= { s: 'SMOOTH', t: 0.7 }; }
    else if (Math.abs(d) > 0.6) this.rider.hurt(); // a wobble
    if (this.buffer > 0) { this.buffer = 0; this.jump(); this.pressAir = false; }
  }
  crash(pit = false) {
    const p = this.p;
    Object.assign(p, { crash: pit ? 1.4 : 1.9, pit, air: false, flipping: false, av: 0, lipF: null });
    this.pressAir = false; this.combo = 0; this.stats.crash++; if (pit) this.stats.pit++;
    this.msg = { s: pit ? 'TOO SHORT' : 'WIPEOUT', t: 1.5 };
    this.rider.ko();
    if (!pit) { p.y = this.groundY(p.x); p.ang = this.slope(p.x); p.v = Math.max(70, p.v * 0.6); this.puff(p.x, p.y - 6, 18, 130); }
  }
  revive() {
    const p = this.p;
    if (p.pit) { const f = this.gapAt(p.x); p.x = (f ? f.g1 : p.x) + 60; }
    Object.assign(p, { pit: false, crash: 0, air: false, v: VMIN, y: this.groundY(p.x), ang: this.slope(p.x) });
    for (const r of this.rocks) if (Math.abs(r.x - p.x) < 60) r.hit = true;
    this.track.push(null);
    this.rider.revive();
  }
  puff(x, y, n, spd, c = this.sky.snow) {
    for (let i = 0; i < n; i++) { const a = this.r(Math.PI, TAU); this.puffs.push({ x, y, vx: Math.cos(a) * this.r(0.3, 1) * spd, vy: Math.sin(a) * this.r(0.3, 1) * spd, life: this.r(0.4, 0.8), max: 0.8, r: this.r(1.2, 3), c }); }
    if (this.puffs.length > 220) this.puffs.splice(0, this.puffs.length - 220);
  }

  // ---------------------------------------------------------------- drawing
  draw(c) {
    const s = this.sky, p = this.p;
    if (!this.gr) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, s.sky[0]); g.addColorStop(0.55, s.sky[1]); g.addColorStop(1, s.sky[2]);
      const sn = c.createLinearGradient(0, H * 0.3, 0, H); sn.addColorStop(0, s.snow); sn.addColorStop(1, s.shade);
      const w = c.createLinearGradient(0, 0, 0, 300); w.addColorStop(0, rgba(s.sky[0], s.night ? 0.6 : 0.28)); w.addColorStop(0.6, rgba(s.sky[1], s.night ? 0.5 : 0.18)); w.addColorStop(1, rgba(s.haze, 0.7));
      this.gr = { sky: g, snow: sn, wash: w };
    }
    c.fillStyle = this.gr.sky; c.fillRect(0, 0, W, H);
    const strip = this.farStrip();
    if (strip) {
      const P = strip.P, off = ((this.camX * 0.025 + this.t * 3) % P + P) % P, y0 = -8 - this.dyP * 0.05;
      c.globalAlpha = 0.9; c.drawImage(strip.cv, -off, y0); if (P - off < W) c.drawImage(strip.cv, P - off, y0); c.globalAlpha = 1;
      c.save(); c.translate(0, y0); c.fillStyle = this.gr.wash; c.fillRect(0, 0, W, 300); c.restore();
    }
    for (const [x, y, r, ph] of this.stars) { c.globalAlpha = (strip ? 0.45 : 0.8) * (0.6 + 0.4 * Math.sin(this.t * 1.5 + ph)); c.fillStyle = '#fff'; c.fillRect(x, y, r, r); }
    c.globalAlpha = 1;
    this.sun(c);
    if (!strip) this.cloudLayer(c);
    this.range(c);
    this.hills(c, this.hill, PH, 0.16, H * 0.64, 56, s.mid, this.midItems);
    this.haze(c, H * 0.62, 0.25);
    this.hills(c, this.wood, PN, 0.34, H * 0.73, 46, s.near, this.nearItems);
    this.ground(c);
    for (const r of this.rocks) this.obstacle(c, r);
    for (const k of this.coins) if (!k.got) this.pickup(c, k);
    for (const q of this.puffs) { c.globalAlpha = Math.max(0, q.life / q.max) * 0.9; c.fillStyle = q.c; c.beginPath(); c.arc(q.x - this.camX, q.y - this.camY, q.r, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    this.drawRider(c);
    this.weatherLayer(c);
    if (this.msg) {
      c.globalAlpha = Math.min(1, this.msg.t * 2);
      this.text(c, this.msg.s, W / 2 + 1, 67, 15, 'rgba(0,0,0,.35)'); this.text(c, this.msg.s, W / 2, 66, 15, '#fff');
      c.globalAlpha = 1;
    }
    Object.entries(this.fx).filter(([, v]) => v > 0).forEach(([k, v], i) => this.text(c, `${{ boost: '⚡', shield: '⛨', magnet: 'U' }[k]}${k === 'shield' ? '' : ' ' + v.toFixed(1)}`, W - 40 - i * 52, 34, 12, '#eaf8ff'));
    if (this.fx.shield > 0 && !p.crash) { c.strokeStyle = 'rgba(170,235,255,.75)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x - this.camX, p.y - this.camY - 16, 22, 0, TAU); c.stroke(); }
  }
  // the theme's backdrop group laid end to end, cross-faded, as one long distant strip
  farStrip() {
    if (this.strip !== undefined) return this.strip;
    const set = this.skin.bgSet || [];
    if (!set.length) return (this.strip = null);
    if (!set.every(ready) && this.t < 4) return null;
    const imgs = set.filter(ready);
    if (!imgs.length) return (this.strip = null);
    const h = 300, ov = 60, ws = imgs.map((i) => Math.max(200, Math.round((i.naturalWidth || i.width) * h / (i.naturalHeight || i.height))));
    const P = ws.reduce((a, b) => a + b - ov, 0), cv = document.createElement('canvas'), tmp = document.createElement('canvas');
    cv.width = P + ws[0]; cv.height = tmp.height = h;
    const g = cv.getContext('2d');
    let x = 0;
    [...imgs, imgs[0]].forEach((im, k) => {
      const w = ws[k % imgs.length];
      if (!k) g.drawImage(im, 0, 0, w, h);
      else {
        tmp.width = w; const t = tmp.getContext('2d'); t.drawImage(im, 0, 0, w, h);
        t.globalCompositeOperation = 'destination-in'; const f = t.createLinearGradient(0, 0, ov, 0); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, '#000'); t.fillStyle = f; t.fillRect(0, 0, w, h);
        g.drawImage(tmp, x, 0);
      }
      x += w - ov;
    });
    g.drawImage(cv, P, 0, ov, h, 0, 0, ov, h); // the wrap seam matches the start
    return (this.strip = { cv, P });
  }
  sun(c) {
    const s = this.sky, x = W * 0.74, y = H * s.sunY - this.dyP * 0.03, r = s.night ? 13 : 17;
    const g = c.createRadialGradient(x, y, r * 0.5, x, y, r * 5); g.addColorStop(0, rgba(s.sun, s.night ? 0.3 : 0.5)); g.addColorStop(1, rgba(s.sun, 0));
    c.fillStyle = g; c.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    c.fillStyle = s.sun; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (s.night) { c.fillStyle = 'rgba(120,130,160,.25)'; for (const [dx, dy, rr] of [[-4, -3, 3], [4, 3, 2.2], [2, -6, 1.5]]) { c.beginPath(); c.arc(x + dx, y + dy, rr, 0, TAU); c.fill(); } }
  }
  cloudLayer(c) {
    c.fillStyle = this.sky.cloud;
    for (const k of this.clouds) {
      const x = ((k.x - this.camX * 0.05 - this.t * 5) % 1120 + 1120) % 1120 - 120, y = k.y - this.dyP * 0.04;
      if (x > W + 80) continue;
      c.globalAlpha = this.sky.night ? 0.25 : 0.55;
      for (let i = 0; i < k.n; i++) { c.beginPath(); c.ellipse(x + i * k.s * 0.55, y - Math.sin(i / (k.n - 1) * Math.PI) * k.s * 0.3, k.s * 0.5, k.s * 0.32, 0, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  // ridged mountains with snow above a ragged snowline, then haze at their feet
  range(c) {
    const s = this.sky, off = this.camX * 0.06, base = H * 0.58 - this.dyP * 0.1, amp = 120, snow = base - amp * 0.6;
    const top = [];
    for (let x = 0; x <= W + 6; x += 6) top.push([x, base - amp * per(this.mtn, x + off, PM)]);
    c.fillStyle = s.far; c.beginPath(); c.moveTo(0, H); for (const [x, y] of top) c.lineTo(x, y); c.lineTo(W, H); c.fill();
    c.fillStyle = rgba(s.snow, s.night ? 0.35 : 0.6); c.beginPath();
    top.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    for (let i = top.length - 1; i >= 0; i--) { const [x, y] = top[i]; c.lineTo(x, Math.max(y, snow + Math.sin((x + off) * 0.07) * 5 + Math.sin((x + off) * 0.023) * 7)); }
    c.fill();
    this.haze(c, base, 0.45);
  }
  haze(c, y, a) {
    const g = c.createLinearGradient(0, y - 50, 0, y + 40); g.addColorStop(0, rgba(this.sky.haze, 0)); g.addColorStop(0.6, rgba(this.sky.haze, a)); g.addColorStop(1, rgba(this.sky.haze, 0));
    c.fillStyle = g; c.fillRect(0, y - 50, W, 90);
  }
  hills(c, arr, P, par, base, amp, col, items) {
    const off = this.camX * par, yb = base - this.dyP * par * 0.6;
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W + 6; x += 6) c.lineTo(x, yb - amp * per(arr, x + off, P));
    c.lineTo(W, H); c.fill();
    for (const it of items) {
      let x = ((it.x - off) % P + P) % P; if (x > W + 30) x -= P;
      if (x < -30) continue;
      this.item(c, it, x, yb - amp * per(arr, x + off, P) + 2, col);
    }
  }
  item(c, it, x, y, col) {
    const s = this.sky, h = it.s;
    if (it.k === 'pine') { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - h * 1.6); c.lineTo(x + h * 0.45, y); c.lineTo(x - h * 0.45, y); c.fill(); return; }
    if (it.k === 'bloom') {
      c.fillStyle = col; c.fillRect(x - 1, y - h * 0.6, 2, h * 0.6);
      c.fillStyle = s.night ? '#6e4a6a' : '#e9a3bd'; c.globalAlpha = 0.85; c.beginPath(); c.arc(x, y - h * 0.8, h * 0.42, 0, TAU); c.arc(x - h * 0.3, y - h * 0.6, h * 0.3, 0, TAU); c.arc(x + h * 0.3, y - h * 0.62, h * 0.3, 0, TAU); c.fill(); c.globalAlpha = 1;
      return;
    }
    const tall = it.k === 'church';
    c.fillStyle = col; c.fillRect(x - h * 0.5, y - h * (tall ? 1.1 : 0.8), h, h * (tall ? 1.1 : 0.8));
    c.beginPath(); c.moveTo(x - h * 0.65, y - h * (tall ? 1.1 : 0.8)); c.lineTo(x, y - h * (tall ? 1.7 : 1.3)); c.lineTo(x + h * 0.65, y - h * (tall ? 1.1 : 0.8)); c.fill();
    if (tall) c.fillRect(x - 0.6, y - h * 2.3, 1.2, h * 0.7);
    c.fillStyle = rgba(s.snow, 0.55); c.beginPath(); c.moveTo(x - h * 0.65, y - h * (tall ? 1.1 : 0.8)); c.lineTo(x, y - h * (tall ? 1.7 : 1.3)); c.lineTo(x, y - h * (tall ? 1.5 : 1.12)); c.fill();
    if (s.lit && it.lit) { c.fillStyle = '#ffd27a'; c.fillRect(x - h * 0.25, y - h * 0.5, 1.6, 1.6); c.fillRect(x + h * 0.12, y - h * 0.5, 1.6, 1.6); }
  }
  ground(c) {
    const s = this.sky, i0 = Math.max(1, Math.floor(this.camX / SX) - 1), i1 = Math.min(this.ys.length - 3, i0 + Math.ceil(W / SX) + 3);
    const runs = []; let run = null;
    for (let i = i0; i <= i1; i++) {
      if (this.gaps[i - 1] && this.gaps[i]) continue;
      (run ||= []).push([i * SX - this.camX, this.ys[i] - this.camY]);
      if (this.gaps[i]) { runs.push(run); run = null; }
    }
    if (run) runs.push(run);
    // gaps: a dark crevasse between the lip and the far wall
    for (let k = 0; k + 1 < runs.length; k++) {
      const a = runs[k][runs[k].length - 1], b = runs[k + 1][0], g = c.createLinearGradient(0, Math.min(a[1], b[1]), 0, H);
      g.addColorStop(0, s.near); g.addColorStop(1, s.tree);
      c.fillStyle = g; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0] + 6, H); c.lineTo(b[0] - 6, H); c.lineTo(b[0], b[1]); c.fill();
    }
    for (const r of runs) {
      c.fillStyle = this.gr.snow; c.beginPath(); c.moveTo(r[0][0], H + 4); for (const [x, y] of r) c.lineTo(x, y); c.lineTo(r[r.length - 1][0], H + 4); c.fill();
      c.strokeStyle = s.shade; c.globalAlpha = 0.45; c.lineWidth = 6; c.beginPath(); r.forEach(([x, y], k) => (k ? c.lineTo(x, y + 4) : c.moveTo(x, y + 4))); c.stroke();
      c.globalAlpha = 0.9; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); r.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      c.globalAlpha = 1;
    }
    for (const t of this.trees) if (t.x - this.camX > -60 && t.x - this.camX < W + 60) this.tree(c, t);
    // the board's line in the snow
    c.strokeStyle = s.shade; c.lineWidth = 1.2; c.globalAlpha = 0.8; c.beginPath();
    let pen = false;
    for (const q of this.track) { if (!q) { pen = false; continue; } const x = q[0] - this.camX, y = q[1] - this.camY + 1.5; pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; }
    c.stroke(); c.globalAlpha = 1;
  }
  tree(c, t) {
    const s = this.sky, x = t.x - this.camX, y = this.groundY(t.x) - this.camY + 2, h = t.s * (t.far ? 0.7 : 1);
    c.globalAlpha = t.far ? 0.7 : 0.95;
    if (t.k === 'cabin') {
      const w = h, top = y - w * 0.55;
      c.fillStyle = '#7a5038'; c.fillRect(x - w / 2, top, w, w * 0.55);
      c.fillStyle = '#5a3828'; c.fillRect(x + w * 0.2, top - w * 0.45, w * 0.12, w * 0.3);
      c.fillStyle = s.snow; c.beginPath(); c.moveTo(x - w * 0.62, top + 2); c.lineTo(x, top - w * 0.4); c.lineTo(x + w * 0.62, top + 2); c.fill();
      c.fillStyle = s.lit ? '#ffd27a' : '#3a2a22'; c.fillRect(x - w * 0.25, top + w * 0.18, w * 0.18, w * 0.16); c.fillRect(x + w * 0.08, top + w * 0.18, w * 0.18, w * 0.16);
      c.fillStyle = rgba(s.snow, 0.5);
      for (let i = 0; i < 4; i++) { const k = (this.t * 0.4 + i / 4) % 1; c.globalAlpha = 0.6 * (1 - k); c.beginPath(); c.arc(x + w * 0.26 + k * 14, top - w * 0.5 - k * 30, 2 + k * 5, 0, TAU); c.fill(); }
      c.globalAlpha = 1; return;
    }
    if (t.k === 'bloom') {
      c.fillStyle = s.tree; c.fillRect(x - 1.5, y - h * 0.55, 3, h * 0.55);
      const pink = s.night ? ['#7d5378', '#94668c'] : ['#ee9bb6', '#f7c0d0'];
      for (const [dx, dy, r, k] of [[0, -0.75, 0.32, 0], [-0.25, -0.58, 0.24, 1], [0.26, -0.6, 0.25, 0], [0.05, -0.92, 0.2, 1]]) { c.fillStyle = pink[k]; c.beginPath(); c.arc(x + dx * h, y + dy * h, r * h, 0, TAU); c.fill(); }
      c.globalAlpha = 1; return;
    }
    c.fillStyle = s.tree; c.fillRect(x - 1.5, y - h * 0.2, 3, h * 0.2);
    for (let i = 0; i < 3; i++) {
      const w = h * (0.32 - i * 0.07), yy = y - h * (0.22 + i * 0.25);
      c.fillStyle = s.tree; c.beginPath(); c.moveTo(x, yy - h * 0.34); c.lineTo(x + w, yy + h * 0.08); c.lineTo(x - w, yy + h * 0.08); c.fill();
      c.fillStyle = rgba(s.snow, 0.7); c.beginPath(); c.moveTo(x, yy - h * 0.34); c.lineTo(x + w * 0.55, yy - h * 0.1); c.lineTo(x - w * 0.4, yy - h * 0.14); c.fill();
    }
    c.globalAlpha = 1;
  }
  // obstacles: dark, angular, half-buried in the snow, with a red warning flag ahead of them
  obstacle(c, r) {
    const x = r.x - this.camX, y = this.groundY(r.x) - this.camY, s = r.s;
    if (x < -40 || x > W + 40) return;
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x + 3, y + 1, s * 0.75, 3, 0, 0, TAU); c.fill();
    c.save(); c.translate(x, y); c.rotate(this.slope(r.x));
    if (r.kind === 'rock') {
      const t = s * (0.75 + r.seed * 0.2);
      c.fillStyle = '#2b2622'; c.beginPath(); c.moveTo(-s * 0.6, 2); c.lineTo(-s * 0.45, -s * 0.5); c.lineTo(-s * 0.05, -t); c.lineTo(s * 0.35, -s * 0.55); c.lineTo(s * 0.6, 2); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(-s * 0.45, -s * 0.5); c.lineTo(-s * 0.05, -t); c.lineTo(-s * 0.1, -s * 0.3); c.fill();
      c.fillStyle = this.sky.snow; c.beginPath(); c.moveTo(-s * 0.3, -s * 0.62); c.lineTo(-s * 0.05, -t); c.lineTo(s * 0.22, -s * 0.62); c.quadraticCurveTo(0, -s * 0.52, -s * 0.3, -s * 0.62); c.fill();
    } else {
      c.fillStyle = '#4a2f1c'; c.fillRect(-s * 0.35, -s * 0.55, s * 0.7, s * 0.6);
      c.fillStyle = '#c8a070'; c.beginPath(); c.ellipse(0, -s * 0.55, s * 0.35, s * 0.1, 0, 0, TAU); c.fill();
      c.strokeStyle = '#7a5030'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -s * 0.55, s * 0.18, s * 0.05, 0, 0, TAU); c.stroke();
      c.fillStyle = this.sky.snow; c.beginPath(); c.ellipse(-s * 0.08, -s * 0.6, s * 0.28, s * 0.07, 0, 0, TAU); c.fill();
    }
    c.restore();
    if (!r.hit) {
      const fx = x - s - 6, fy = this.groundY(r.x - s - 6) - this.camY;
      c.strokeStyle = '#d23a2a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 22); c.stroke();
      c.fillStyle = '#e8402e'; c.beginPath(); c.moveTo(fx, fy - 22); c.lineTo(fx + 10 + Math.sin(this.t * 5) * 1.5, fy - 18); c.lineTo(fx, fy - 14); c.fill();
    }
  }
  // pick-ups float and glow: gold coins, and bubbles with an icon for power-ups
  pickup(c, k) {
    const x = k.x - this.camX, y = k.y - this.camY + Math.sin(this.t * 3 + k.x) * 2.5;
    if (x < -30 || x > W + 30) return;
    const R = k.power ? 26 : 13, glow = c.createRadialGradient(x, y, 2, x, y, R);
    glow.addColorStop(0, k.power ? 'rgba(160,230,255,.55)' : 'rgba(255,220,90,.55)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill();
    if (!k.power) {
      const sq = Math.max(0.2, Math.abs(Math.cos(this.t * 2.5 + k.x)));
      c.fillStyle = '#f0b830'; c.beginPath(); c.ellipse(x, y, 6 * sq, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff2a0'; c.beginPath(); c.ellipse(x - sq, y - 2, 2 * sq, 2, 0, 0, TAU); c.fill();
      return;
    }
    c.fillStyle = 'rgba(140,210,255,.25)'; c.strokeStyle = 'rgba(220,245,255,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 14, 0, TAU); c.fill(); c.stroke();
    this.text(c, { boost: '⚡', shield: '⛨', magnet: 'U' }[k.power], x, y + 1, 15, '#fff');
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x - 5, y - 6, 2.5, 0, TAU); c.fill();
  }
  drawRider(c) {
    const p = this.p, x = p.x - this.camX, y = p.y - this.camY, S = 1.25 * this.S;
    if (p.pit && y > H + 40) return;
    // scarf: a ribbon trailing from the neck through its recent positions
    if (this.trail.length > 2 && !p.crash) {
      c.strokeStyle = this.col(0); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
      this.trail.forEach(([tx, ty], k) => { const X = tx - this.camX - k * 1.5, Y = ty - this.camY + Math.sin(this.t * 13 + k) * k * 0.4; k ? c.lineTo(X, Y) : c.moveTo(X, Y); });
      c.stroke();
    }
    c.save(); c.translate(x, y); c.rotate(p.ang);
    c.fillStyle = this.col(3); c.beginPath(); c.ellipse(p.crash ? 14 : 0, -1, 15, 2.4, 0, 0, TAU); c.fill();
    this.rider.draw(c, 0, -3, S);
    c.restore();
  }
  weatherLayer(c) {
    if (!this.flakes.length) return;
    const bl = this.weather === 'blossom';
    for (const f of this.flakes) {
      c.globalAlpha = 0.35 + 0.5 * f.z;
      if (bl) {
        c.fillStyle = f.z > 0.6 ? '#f7b9cc' : '#f2a2bb';
        c.beginPath(); c.ellipse(f.x, f.y, 2.6 * f.z + 0.8, 1.3 * f.z + 0.5, this.t * 2 + f.ph, 0, TAU); c.fill();
      } else { c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, 0.6 + 1.6 * f.z, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  hud() { return `${Math.floor(this.score)} · ${Math.floor(this.dist / 30)}m`; }
}
