import { Game, W, H, circleRect, reflect, walls, roundRect, drawRectImg, ready } from './engine.js';
import { Fx, clamp, mix, canvas } from './arcadekit.js';

// capsules that drop from broken bricks: letter, name, colour, good?, drop weight
const POW = {
  multi: ['M', 'MULTI-BALL', '#47c6ff', 1, 3], wide: ['W', 'WIDE PADDLE', '#6fe36f', 1, 2], laser: ['L', 'LASERS', '#ff4d6d', 1, 2],
  slow: ['S', 'SLOW BALL', '#b38cff', 1, 1.3], fire: ['F', 'FIREBALL', '#ff9a2a', 1, 1.4], catch: ['C', 'CATCH', '#ffe14f', 1, 1.1],
  net: ['N', 'SAFETY NET', '#4fffd2', 1, 1.1], bomb: ['B', 'MEGA BOMB', '#ff6a3d', 1, 1.1], life: ['+', 'EXTRA LIFE', '#ff5fa2', 1, 0.45],
  tiny: ['T', 'TINY PADDLE', '#8f8f8f', 0, 0.9], fast: ['X', 'FAST BALL', '#b9b9b9', 0, 0.9]
};
const POW_KEYS = Object.keys(POW);
// 11×8 invader and other pictures for mosaic levels (u, v in 0..1 over the brick field)
const INV = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
const MASKS = [
  () => true,
  (u, v) => Math.abs(u - 0.5) * 2 < 0.3 + v * 0.75,
  (u, v) => Math.abs(u - 0.5) + Math.abs(v - 0.5) * 0.8 < 0.5,
  (u, v) => { const d = Math.hypot(u - 0.5, (v - 0.5) * 0.75); return d < 0.42 && d > 0.17; },
  (u, v) => Math.sin(u * 13 + v * 4) > -0.45,
  (u, v) => (Math.floor(u * 8) + Math.floor(v * 6)) % 2 === 0,
  (u, v) => INV[Math.min(7, Math.floor(v * 8))][Math.min(10, Math.floor(u * 11))] === '1',
  (u, v) => { const x = (u - 0.5) * 2.4, y = (0.42 - v) * 2.6; return (x * x + y * y - 1) ** 3 - x * x * y * y * y < 0; },
  (u, v) => Math.abs(Math.sin(u * Math.PI * 3)) > v * 0.9 - 0.1,
  (u, v) => Math.floor(u * 8) % 3 !== 1 || v < 0.25,
  (u, v) => v < 0.3 || Math.abs(u - 0.5) > 0.32 || (v > 0.7 && v < 0.9)
];
const SUBS = [[1, 1], [2, 1], [2, 2], [3, 1], [4, 2]];

// ================================================================ Breakout
export class Breakout extends Game {
  setup() {
    this.fx = new Fx();
    this.paddle = { x: W / 2, px: W / 2, y: H - 58, w: 74, h: 10, sq: 0 };
    this.level = 0; this.lives = this.mods.glass ? 1 : 3;
    this.tex = [0, 1, 2].map((k) => this.skin.pick(`row${k}`, 'tile', 'block'));
    this.build();
  }
  build() {
    const lv = this.level, cols = 8, cw = (W - 20) / cols, ch = 20, y0 = 64;
    const rows = this.ri(5, 7) + (lv > 2 ? 1 : 0);
    const mode = lv === 0 ? this.ri(0, 2) : this.ri(0, 5), mask = MASKS[lv === 0 ? this.ri(0, 5) : this.ri(0, MASKS.length - 1)];
    const hue = this.ri(0, 4), ca = this.ri(0, 5), cb = this.ri(0, 5), sub = [];
    for (let r = 0; r < rows; r++) sub.push(this.ri(0, 4));
    const pick = (r, k) => SUBS[
      mode === 0 ? [0, 0, 0, 0, 1, 1, 2, 2, 3, 4][this.ri(0, 9)]                   // mixed sizes
      : mode === 1 ? sub[r]                                                          // a size per row
      : mode === 2 ? Math.min(4, Math.floor(((rows - 1 - r) / rows) * 5))            // small at the top, big below
      : mode === 3 ? (this.rng() < 0.85 ? 4 : 2)                                     // mosaic of tiny bricks
      : mode === 4 ? (Math.hypot(k - 3.5, (r - rows / 2) * 1.6) < 2.6 ? 4 : 0)       // a cluster of small ones in big ones
      : [0, 2, 4, 1, 1, 4, 2, 0][k]];                                                 // a size per column
    this.bricks = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const [nx, ny] = pick(r, k), w = cw / nx, h = ch / ny, gap = nx * ny > 2 ? 2 : 3, big = nx * ny === 1;
      for (let j = 0; j < nx; j++) for (let i = 0; i < ny; i++) {
        const x = 10 + k * cw + j * w, y = y0 + r * ch + i * h, u = (x + w / 2 - 10) / (W - 20), v = (y + h / 2 - y0) / (rows * ch);
        if (!mask(u, v)) continue;
        const ci = [r, k, r + k, nx * ny, 0][hue];
        const c = hue === 4 ? mix(this.col(ca), this.col(cb === ca ? ca + 1 : cb), v) : this.col(ci + ca);
        const hp = big ? 1 + (this.rng() < 0.14 + lv * 0.03 ? 1 : 0) + (this.rng() < 0.04 + lv * 0.02 ? 1 : 0) : 1;
        this.bricks.push({ x: x + gap / 2, y: y + gap / 2, w: w - gap, h: h - gap, hp, max: hp, c, big, pts: big ? 10 : Math.round(12 / Math.sqrt(nx * ny)) + 1, t: r % 3,
          tnt: this.rng() < (big ? 0.04 : 0.012), gift: this.rng() < 0.08, steel: false, flash: 0 });
      }
    }
    if (!this.bricks.length) return this.build();
    // steel (only bombs break it) on some later levels, never more than a fifth of the big bricks
    if (lv > 0 && this.rng() < 0.4) { const bigs = this.bricks.filter((b) => b.big && !b.tnt), n = Math.floor(bigs.length * this.r(0.08, 0.2)); for (let i = 0; i < n; i++) Object.assign(bigs[this.ri(0, bigs.length - 1)], { steel: true, gift: false, hp: 1, max: 1 }); }
    if (!this.bricks.some((b) => b.tnt)) this.bricks[this.ri(0, this.bricks.length - 1)].tnt = true;
    this.bricks.forEach((b) => { if (b.steel) b.tnt = false; });
    this.left = this.bricks.filter((b) => !b.steel).length;
    this.fieldB = Math.max(...this.bricks.map((b) => b.y + b.h)) + 4;
    this.cache = canvas(W, this.fieldB + 4, 2); this.texOK = this.tex.map((t) => ready(t)); this.paint();
    this.reveal = 0; this.balls = []; this.caps = []; this.shots = []; this.booms = [];
    this.pw = { wide: 0, tiny: 0, laser: 0, slow: 0, fast: 0, fire: 0, catch: 0, net: 0 }; this.bombs = 0;
    this.pause = 0; this.serve();
  }
  // ---------------------------------------------------------- brick cache: repainted per brick, not per frame
  paint() { const c = this.cache.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, W, this.fieldB + 4); for (const k of this.bricks) if (!k.dead) this.drawBrick(c, k); }
  repaint(k) { const c = this.cache.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(k.x - 0.6, k.y - 0.6, k.w + 1.2, k.h + 1.2); if (!k.dead) this.drawBrick(c, k); }
  drawBrick(c, k) {
    const r = Math.min(3.5, k.h * 0.3, k.w * 0.3);
    if (k.steel) {
      const g = c.createLinearGradient(0, k.y, 0, k.y + k.h); g.addColorStop(0, '#eef3f6'); g.addColorStop(0.45, '#9aa6b0'); g.addColorStop(1, '#58626b');
      c.fillStyle = g; roundRect(c, k.x, k.y, k.w, k.h, r); c.fill();
      c.fillStyle = '#3c444b'; for (const [dx, dy] of [[3, 3], [k.w - 3, 3], [3, k.h - 3], [k.w - 3, k.h - 3]]) { c.beginPath(); c.arc(k.x + dx, k.y + dy, 1.1, 0, 7); c.fill(); }
      return;
    }
    c.fillStyle = k.tnt ? '#c8321f' : k.c; roundRect(c, k.x, k.y, k.w, k.h, r); c.fill();
    const t = this.tex[k.t];
    if (k.big && !k.tnt && ready(t)) { c.save(); roundRect(c, k.x, k.y, k.w, k.h, r); c.clip(); c.globalAlpha = 0.45; drawRectImg(c, t, k.x, k.y, k.w, k.h, true); c.restore(); }
    const hl = Math.max(1, k.h * 0.22);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(k.x + r * 0.6, k.y + 0.8, k.w - r * 1.2, hl);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(k.x + r * 0.6, k.y + k.h - hl, k.w - r * 1.2, hl - 0.4);
    if (k.tnt) {
      c.strokeStyle = '#2a0a05'; c.lineWidth = 1.4; c.beginPath();
      if (k.big) { c.font = '900 8px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffe9c4'; c.fillText('TNT', k.x + k.w / 2, k.y + k.h / 2 + 0.5); }
      else { c.moveTo(k.x + 2, k.y + 2); c.lineTo(k.x + k.w - 2, k.y + k.h - 2); c.moveTo(k.x + k.w - 2, k.y + 2); c.lineTo(k.x + 2, k.y + k.h - 2); c.stroke(); }
    }
    if (k.gift) { const cx = k.x + k.w / 2, cy = k.y + k.h / 2, s = Math.min(k.w, k.h) * 0.42; c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, d = i % 2 ? s * 0.38 : s; c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); } c.fill(); }
    if (k.max > 1) {
      c.strokeStyle = this.pal.ink; c.lineWidth = k.max > 2 ? 2 : 1.4; roundRect(c, k.x + 0.7, k.y + 0.7, k.w - 1.4, k.h - 1.4, r); c.stroke();
      if (k.hp < k.max) { c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1; c.beginPath(); const cx = k.x + k.w * 0.55; c.moveTo(cx - 6, k.y + 1); c.lineTo(cx - 1, k.y + k.h * 0.5); c.lineTo(cx - 5, k.y + k.h - 1); c.moveTo(cx - 1, k.y + k.h * 0.5); c.lineTo(cx + 7, k.y + k.h * 0.35); if (k.hp < k.max - 1) { c.moveTo(k.x + 4, k.y + k.h * 0.4); c.lineTo(k.x + 12, k.y + k.h * 0.6); } c.stroke(); }
    }
  }
  // ---------------------------------------------------------- balls
  serve() {
    const p = this.paddle;
    this.balls = [this.mkBall(p.x, p.y - 8, 0, 0, 0.7)];
    this.speed = Math.min(430, 305 + this.level * 14);
  }
  mkBall(x, y, vx, vy, stuck = 0) { return { x, y, vx, vy, r: 6 * this.S, stuck, off: this.r(-0.3, 0.3), trail: [], i: this.skin.pick('bb', 'ball', 'item') }; }
  spd() { return this.speed * (this.pw.slow > 0 ? 0.72 : 1) * (this.pw.fast > 0 ? 1.3 : 1); }
  launch(b) { const a = -Math.PI / 2 + clamp(b.off, -0.85, 0.85) * 1.05, s = this.spd(); b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.stuck = 0; this.fx.sparks(b.x, b.y, 5, '#fff', 140, -Math.PI / 2, 1.2, 0.25); }
  fold(x, r) { const span = W - 2 * r, m = (((x - r) % (2 * span)) + 2 * span) % (2 * span); return (m > span ? 2 * span - m : m) + r; }
  // ---------------------------------------------------------- autopilot: meet the first ball, aim at good bricks, fetch good capsules, dodge bad ones
  autopilot(dt) {
    const p = this.paddle, sp = 520;
    let ball = null, bt = Infinity;
    for (const b of this.balls) {
      if (b.stuck > 0) continue;
      if (b.vy > 0) { const t = (p.y - b.r - b.y) / b.vy; if (t > -0.03 && t < bt) { bt = t; ball = b; } }
    }
    let target = null;
    if (ball) {
      const bx = this.fold(ball.x + ball.vx * Math.max(0, bt), ball.r);
      if (this.aimFor !== ball || this.aimAt !== this.balls.length) { this.aimFor = ball; this.aimAt = this.balls.length; this.aimOff = this.chooseOff(bx); }
      target = bx - this.aimOff * p.w / 2;
      // dodge a bad capsule that would land on the paddle, if the ball still gets hit
      for (const q of this.caps) if (!POW[q.k][3] && q.y < p.y && (p.y - q.y) / q.vy < 0.7 && Math.abs(q.x - target) < p.w / 2 + 10) {
        const alt = bx + Math.sign(bx - q.x || 1) * p.w * 0.4;
        if (Math.abs(q.x - alt) > p.w / 2 + 8) target = alt;
      }
    }
    // a good capsule that lands before the ball needs us, with time to get back
    let best = Infinity;
    for (const q of this.caps) {
      if (!POW[q.k][3] || q.y > p.y) continue;
      const tq = (p.y - 6 - q.y) / q.vy, reach = Math.abs(q.x - p.x) / sp;
      if (reach > tq + 0.1 || tq > best) continue;
      if (ball && tq + Math.abs((target ?? q.x) - q.x) / sp > bt - 0.06) continue;
      best = tq; target = q.x;
    }
    if (target == null) { const b = this.balls[0]; target = b ? b.x + Math.sin(this.t * 0.7) * 20 : W / 2; }
    const d = target - p.x;
    p.x += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
    for (const b of this.balls) if (b.stuck > 0 && b.stuck < 0.35) b.stuck = Math.min(b.stuck, 0.05);
  }
  // paddle offset (-1..1) that sends the ball toward a brick worth hitting
  chooseOff(bx) {
    if (!this.bricks.length || this.pw.fire > 0) return this.r(-0.4, 0.4);
    let best = null, bs = -Infinity;
    for (let n = 0; n < 12; n++) {
      const k = this.bricks[this.ri(0, this.bricks.length - 1)];
      if (k.dead || k.steel) continue;
      const s = (k.tnt ? 2.5 : 0) + (k.gift ? 2 : 0) + k.y / 80 + this.r(0, 1.2);
      if (s > bs) { bs = s; best = k; }
    }
    if (!best) return this.r(-0.4, 0.4);
    const a = Math.atan2(best.y + best.h / 2 - this.paddle.y, best.x + best.w / 2 - bx);
    return clamp((a + Math.PI / 2) / 1.05 + this.r(-0.06, 0.06), -0.8, 0.8);
  }
  down(x) { this.paddle.x = x; }
  move(x) { if (!this.auto) this.paddle.x = x; }
  up() { for (const b of this.balls) if (b.stuck > 0) b.stuck = Math.min(b.stuck, 0.01); }
  // ---------------------------------------------------------- simulation
  step(dt) {
    const p = this.paddle;
    this.fx.step(dt);
    for (const k in this.pw) if (this.pw[k] > 0) this.pw[k] -= dt;
    p.w += (74 * (this.pw.wide > 0 ? 1.55 : 1) * (this.pw.tiny > 0 ? 0.6 : 1) - p.w) * Math.min(1, dt * 8);
    p.x = clamp(p.x, p.w / 2, W - p.w / 2); p.sq = Math.max(0, p.sq - dt * 5);
    this.reveal = Math.min(1, this.reveal + dt * 1.6);
    for (const k of this.bricks) if (k.flash > 0) k.flash -= dt * 5;
    if (this.texOK.some((ok, i) => !ok && ready(this.tex[i]))) { this.texOK = this.tex.map((t) => ready(t)); this.paint(); }
    if (this.pause > 0) {
      if ((this.pause -= dt) <= 0) { if (this.over) { this.over = false; this.level = 0; this.score = 0; this.lives = this.mods.glass ? 1 : 3; } else this.level++; this.build(); }
      return;
    }
    // lasers
    if (this.pw.laser > 0 && (this.laserT = (this.laserT || 0) - dt) <= 0) {
      this.laserT = 0.32;
      for (const s of [-1, 1]) { this.shots.push({ x: p.x + s * (p.w / 2 - 5), y: p.y - 4 }); this.fx.glow(p.x + s * (p.w / 2 - 5), p.y - 4, 10, '#ff4d6d', 0.12); }
    }
    for (const s of this.shots) {
      s.y -= 760 * dt;
      if (s.y < -10) s.dead = true;
      else if (s.y < this.fieldB) for (const k of this.bricks) if (!k.dead && s.x > k.x - 1 && s.x < k.x + k.w + 1 && s.y < k.y + k.h && s.y > k.y - 8) { s.dead = true; this.hit(k, 'laser'); this.fx.sparks(s.x, k.y + k.h, 4, '#ff8a9a', 120, Math.PI / 2, 1.5, 0.25); break; }
    }
    this.shots = this.shots.filter((s) => !s.dead);
    // balls
    const spd = this.spd(), fire = this.pw.fire > 0, tick = (this.tick = (this.tick || 0) + 1) % 2 === 0;
    for (const b of this.balls) {
      if (b.stuck > 0) { b.x = clamp(p.x + b.off * p.w / 2, b.r, W - b.r); b.y = p.y - b.r - 1; if ((b.stuck -= dt) <= 0) this.launch(b); continue; }
      const m = Math.hypot(b.vx, b.vy) || 1; b.vx *= spd / m; b.vy *= spd / m;
      if (Math.abs(b.vy) < spd * 0.28) { b.vy = Math.sign(b.vy || -1) * spd * 0.28; b.vx = Math.sign(b.vx) * Math.sqrt(spd * spd - b.vy * b.vy); }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (tick) { b.trail.push(b.x, b.y); if (b.trail.length > 16) b.trail.splice(0, 2); }
      if (walls(b, 0, W, 0, null, 1)) this.fx.sparks(b.x, b.y, 3, fire ? '#ffb04a' : this.pal.ink, 90, Math.atan2(-b.vy, -b.vx), 2, 0.2);
      if (fire && Math.random() < 0.5) this.fx.spark(b.x, b.y, this.r(-30, 30), this.r(-30, 30), Math.random() < 0.5 ? '#ffcf4a' : '#ff6a2a', 0.35, -60);
      if (this.pw.net > 0 && b.vy > 0 && b.y + b.r > H - 26) { b.vy = -Math.abs(b.vy); this.fx.ring(b.x, H - 26, 26, '#4fffd2', 0.35, 2); this.fx.sparks(b.x, H - 26, 6, '#4fffd2', 160, -Math.PI / 2, 1.8, 0.3); }
      // paddle: the hit offset sets the angle; catch holds the ball
      if (b.vy > 0 && b.y + b.r >= p.y && b.y < p.y + p.h && Math.abs(b.x - p.x) < p.w / 2 + b.r) {
        const off = clamp((b.x - p.x) / (p.w / 2), -1, 1);
        this.speed = Math.min(540, this.speed + 3);
        p.sq = 1; this.fx.sparks(b.x, p.y, 5, this.col(0), 150, -Math.PI / 2, 1.6, 0.25);
        if (this.pw.catch > 0) { b.stuck = 0.6; b.off = off; this.fx.ring(b.x, p.y, 14, '#ffe14f', 0.3, 2); }
        else { b.off = off; const a = -Math.PI / 2 + off * 1.05, s = this.spd(); b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.y = p.y - b.r; }
      }
      // bricks
      if (b.y - b.r < this.fieldB) for (const k of this.bricks) {
        if (k.dead || b.x + b.r < k.x || b.x - b.r > k.x + k.w || b.y + b.r < k.y || b.y - b.r > k.y + k.h) continue;
        if (fire && !k.steel) { this.hit(k, 'fire', b); continue; }
        const n = circleRect(b, k);
        if (!n) continue;
        reflect(b, n, 1);
        if (this.bombs > 0 && !k.dead) { this.bombs--; this.boom(k.x + k.w / 2, k.y + k.h / 2, 74, true); }
        this.hit(k, 'ball', b);
        break;
      }
      if (b.y > H + 20) b.dead = true;
    }
    if (this.balls.some((b) => b.dead)) {
      this.balls = this.balls.filter((b) => !b.dead);
      if (!this.balls.length) {
        this.lives--; this.fx.flash('#ff2a2a', 0.3, 0.35); this.fx.shake(6, 0.35); this.caps = [];
        for (const k in this.pw) this.pw[k] = 0;
        if (this.lives < 0) { this.over = true; this.pause = 1.6; this.fx.text(W / 2, H / 2, 'GAME OVER', this.pal.ink, 24, 1.6, -8); }
        else this.serve();
      }
    }
    // capsules
    for (const q of this.caps) {
      q.y += q.vy * dt; q.ph += dt * 6;
      if (q.y + 6 > p.y && q.y - 6 < p.y + p.h && Math.abs(q.x - p.x) < p.w / 2 + 12) { q.dead = true; this.power(q.k); }
      else if (q.y > H + 12) q.dead = true;
    }
    this.caps = this.caps.filter((q) => !q.dead);
    // delayed blasts (chains of TNT, the bomb's ripple)
    for (const e of this.booms) if ((e.t -= dt) <= 0) { e.done = true; if (!e.k.dead) this.hit(e.k, 'boom'); }
    this.booms = this.booms.filter((e) => !e.done);
    if (this.left <= 0) {
      this.pause = 1.5; this.balls = []; this.caps = []; this.shots = [];
      this.fx.text(W / 2, H / 2 - 10, `LEVEL ${this.level + 1} CLEAR`, this.pal.ink, 20, 1.5, -10);
      for (let i = 0; i < 5; i++) { const x = this.r(40, W - 40), y = this.r(60, 220); this.fx.sparks(x, y, 22, this.col(i), 220, 0, 7, 0.9, 200); this.fx.glow(x, y, 40, this.col(i), 0.5); }
    }
  }
  hit(k, how, b) {
    if (k.steel && how !== 'boom') { this.fx.sparks(b ? b.x : k.x + k.w / 2, b ? b.y : k.y + k.h, 5, '#dfe7ee', 160, b ? Math.atan2(-b.vy, -b.vx) : Math.PI / 2, 1.6, 0.25); k.flash = 1; return; }
    k.flash = 1; k.hp--;
    if (k.hp > 0 && how !== 'boom' && how !== 'fire') { this.repaint(k); this.fx.sparks(k.x + k.w / 2, k.y + k.h / 2, 4, k.c, 120, 0, 7, 0.3); return; }
    k.dead = true; this.repaint(k); if (!k.steel) this.left--;
    this.score += k.pts * (k.max > 1 ? 2 : 1);
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2, n = k.big ? 7 : 3;
    for (let i = 0; i < n; i++) this.fx.chip(cx + this.r(-k.w / 3, k.w / 3), cy, this.r(-90, 90) + (b ? b.vx * 0.15 : 0), this.r(-160, 20), k.big ? this.r(3, 6) : this.r(2, 3.5), k.steel ? '#aab4bd' : k.tnt ? '#e8452c' : k.c, 0.9);
    this.fx.glow(cx, cy, k.big ? 22 : 12, k.c, 0.18);
    if (k.tnt) this.boom(cx, cy, 52);
    if ((k.gift || this.rng() < (k.big ? 0.13 : 0.05) * (this.mods.swarm ? 1.6 : 1)) && this.caps.length < 4) this.drop(cx, cy);
  }
  boom(x, y, rad, mega = false) {
    this.fx.glow(x, y, rad * 1.5, mega ? '#ffd27a' : '#ff9a3c', 0.45); this.fx.ring(x, y, rad, '#fff3d6', 0.4, 4); this.fx.ring(x, y, rad * 0.6, '#ff7a2a', 0.3, 3);
    this.fx.sparks(x, y, mega ? 36 : 22, '#ffcf6a', 300, 0, 7, 0.6, 300); this.fx.shake(mega ? 8 : 5, 0.35); this.fx.flash('#ffd9a0', mega ? 0.3 : 0.18, 0.2);
    let n = 0;
    for (const k of this.bricks) {
      if (k.dead) continue;
      const d = Math.hypot(k.x + k.w / 2 - x, (k.y + k.h / 2 - y) * 1.3);
      if (d < rad && !this.booms.some((e) => e.k === k)) { this.booms.push({ k, t: d / 500 + 0.02 }); n++; }
    }
    if (n > 2) this.fx.text(x, y - 12, `${n}×`, '#ffe9c4', 14, 0.8);
  }
  drop(x, y) {
    let s = POW_KEYS.reduce((a, k) => a + POW[k][4], 0) * this.rng(), k = POW_KEYS[0];
    for (const kk of POW_KEYS) { s -= POW[kk][4]; if (s <= 0) { k = kk; break; } }
    this.caps.push({ x, y, k, vy: this.r(85, 115), ph: 0 });
  }
  power(k) {
    const [, name, color, good] = POW[k], p = this.paddle;
    this.fx.text(p.x, p.y - 26, name, color, 13, 1.1); this.fx.ring(p.x, p.y, 40, color, 0.4, 3); this.fx.sparks(p.x, p.y, 12, color, 200, -Math.PI / 2, 2.4, 0.4);
    if (!good) this.fx.shake(2, 0.15);
    this.score += 5;
    if (k === 'multi') {
      const add = [];
      for (const b of this.balls) {
        if (b.stuck > 0) this.launch(b);
        for (const da of [-0.4, 0.4]) { if (this.balls.length + add.length >= 9) break; const a = Math.atan2(b.vy, b.vx) + da, s = Math.hypot(b.vx, b.vy) || this.spd(); add.push(this.mkBall(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s)); }
      }
      this.balls.push(...add);
    } else if (k === 'life') this.lives = Math.min(6, this.lives + 1);
    else if (k === 'bomb') this.bombs = Math.min(3, this.bombs + 1);
    else {
      const dur = { wide: 14, tiny: 9, laser: 9, slow: 10, fast: 8, fire: 7, catch: 12, net: 14 }[k];
      this.pw[k] = dur;
      if (k === 'wide') this.pw.tiny = 0; if (k === 'tiny') this.pw.wide = 0; if (k === 'slow') this.pw.fast = 0; if (k === 'fast') this.pw.slow = 0;
    }
  }
  hud() { return `L${this.level + 1} · ${this.score} · ♥${Math.max(0, this.lives)}`; }
  // ---------------------------------------------------------- drawing
  draw(c) {
    this.fx.apply(c);
    this.clear(c);
    const p = this.paddle, rv = this.reveal;
    if (rv < 1) { c.save(); c.beginPath(); c.rect(0, 0, W, this.fieldB * rv + 10); c.clip(); c.drawImage(this.cache, 0, 0, W, this.fieldB + 4); c.restore(); }
    else c.drawImage(this.cache, 0, 0, W, this.fieldB + 4);
    for (const k of this.bricks) if (k.flash > 0) { c.globalAlpha = Math.min(1, k.flash) * (k.dead ? 0.7 : 0.45); c.fillStyle = '#fff'; c.fillRect(k.x, k.y, k.w, k.h); }
    c.globalAlpha = 1;
    // lasers
    c.globalCompositeOperation = 'lighter';
    for (const s of this.shots) { c.strokeStyle = '#ff4d6d'; c.lineWidth = 4; c.globalAlpha = 0.35; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x, s.y + 14); c.stroke(); c.strokeStyle = '#ffe0e6'; c.lineWidth = 1.5; c.globalAlpha = 1; c.stroke(); }
    c.globalCompositeOperation = 'source-over';
    // capsules
    for (const q of this.caps) {
      const [l, , col, good] = POW[q.k], sx = Math.abs(Math.cos(q.ph * 0.5)) * 0.25 + 0.75;
      c.save(); c.translate(q.x, q.y); c.scale(1, sx);
      c.fillStyle = 'rgba(0,0,0,.35)'; roundRect(c, -13, -5, 28, 13, 6.5); c.fill();
      const g = c.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, mix(col, '#fff', 0.55)); g.addColorStop(0.5, col); g.addColorStop(1, mix(col, '#000', 0.35));
      c.fillStyle = g; roundRect(c, -14, -7, 28, 14, 7); c.fill();
      if (!good) { c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.5; c.stroke(); }
      c.font = '900 10px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = good ? '#111' : '#2b2b2b'; c.fillText(l, 0, 0.5);
      c.restore();
    }
    // safety net
    if (this.pw.net > 0) { const a = this.pw.net < 2 ? (Math.floor(this.t * 8) % 2 ? 0.25 : 0.8) : 0.8; c.globalAlpha = a; c.strokeStyle = '#4fffd2'; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(0, H - 26); c.lineTo(W, H - 26); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
    // paddle
    const pc = this.pw.tiny > 0 ? '#9a9a9a' : this.pw.wide > 0 ? '#6fe36f' : this.pal.ink, sq = p.sq * 2.5;
    c.fillStyle = 'rgba(0,0,0,.3)'; roundRect(c, p.x - p.w / 2 + 3, p.y + 4, p.w, p.h, 5); c.fill();
    c.fillStyle = pc; roundRect(c, p.x - p.w / 2 - sq, p.y + sq * 0.4, p.w + sq * 2, p.h - sq * 0.4, 5); c.fill();
    c.fillStyle = this.col(0); c.fillRect(p.x - p.w / 2 + 6, p.y + p.h - 3.5, p.w - 12, 2);
    if (this.pw.catch > 0) { c.fillStyle = '#ffe14f'; c.fillRect(p.x - p.w / 2 + 4, p.y - 1, p.w - 8, 2.5); }
    if (this.pw.laser > 0) { c.fillStyle = '#ff4d6d'; for (const s of [-1, 1]) c.fillRect(p.x + s * (p.w / 2 - 5) - 2.5, p.y - 5, 5, 6); }
    // balls with trails
    const fire = this.pw.fire > 0;
    for (const b of this.balls) {
      const tr = b.trail;
      for (let i = 0; i < tr.length; i += 2) { const f = (i + 2) / (tr.length + 2); c.globalAlpha = f * (fire ? 0.6 : 0.3); c.fillStyle = fire ? (i % 4 ? '#ffcf4a' : '#ff6a2a') : this.col(0); c.beginPath(); c.arc(tr[i], tr[i + 1], b.r * (fire ? 1.2 : 0.8) * f, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      if (fire || this.bombs > 0) { const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3); g.addColorStop(0, fire ? 'rgba(255,190,80,.7)' : 'rgba(255,90,40,.6)'); g.addColorStop(1, 'rgba(255,90,40,0)'); c.fillStyle = g; c.fillRect(b.x - b.r * 3, b.y - b.r * 3, b.r * 6, b.r * 6); }
      this.orb(c, b.i, b.x, b.y, b.r, fire ? '#ffb347' : this.col(0), this.t * 4);
    }
    this.fx.draw(c);
    // active power-up timers along the bottom
    let x = 8;
    for (const k in this.pw) if (this.pw[k] > 0) { const col = POW[k][2]; c.fillStyle = 'rgba(0,0,0,.45)'; roundRect(c, x, H - 14, 30, 9, 4.5); c.fill(); c.fillStyle = col; roundRect(c, x + 1, H - 13, 28 * Math.min(1, this.pw[k] / 10), 7, 3.5); c.fill(); this.text(c, POW[k][0], x + 15, H - 9.5, 7, '#111'); x += 34; }
    for (let i = 0; i < this.bombs; i++) { c.fillStyle = '#ff6a3d'; c.beginPath(); c.arc(W - 12 - i * 14, H - 10, 5, 0, 7); c.fill(); }
    this.fx.over(c);
  }
}
