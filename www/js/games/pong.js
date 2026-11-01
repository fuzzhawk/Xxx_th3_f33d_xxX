import { Game, W, H, walls, roundRect, circlePeg } from './engine.js';
import { Fx, clamp, mix } from './arcadekit.js';

// power-up orbs float mid-table; whoever hit the ball last gets what it touches
const PU = {
  split: ['M', 'MULTI-BALL', '#47c6ff', 3], grow: ['+', 'BIG PADDLE', '#6fe36f', 2], shrink: ['−', 'SHRINK RAY', '#ff6a8a', 2],
  fire: ['F', 'FIREBALL', '#ff9a2a', 2], freeze: ['I', 'FREEZE', '#9fe8ff', 1.5], shield: ['W', 'SHIELD', '#4fffd2', 1.5],
  portal: ['O', 'PORTALS', '#c77dff', 1.2], bumpers: ['B', 'BUMPERS', '#ffe14f', 1.2], curve: ['C', 'CURVE BALL', '#ff7ae0', 1.5]
};
const PU_KEYS = Object.keys(PU);
const TOP = 52, BOT = H - 56;

// ================================================================ Pong (vertical)
export class Pong extends Game {
  setup() {
    this.fx = new Fx();
    const mk = (y, dir, col, skill) => ({ x: W / 2, px: W / 2, vx: 0, y, dir, col, skill, w: 70, err: 0, aim: 0, frozen: 0, grow: 0, shrink: 0, curve: 0, shield: false, sq: 0 });
    this.top = mk(TOP, -1, this.col(3), 0.62); this.bot = mk(BOT, 1, this.col(0), 0.72);
    this.pads = [this.top, this.bot];
    this.pts = [0, 0]; this.pop = [0, 0];
    this.orbs = []; this.orbT = 3; this.portals = null; this.bumpers = []; this.rally = 0;
    this.serve(1);
  }
  serve(dir) {
    const a = (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + this.r(-0.6, 0.6);
    this.balls = [this.mkBall(W / 2, H / 2, a, 260, dir > 0 ? 0 : 1)];
    this.balls[0].wait = 0.7; this.rally = 0;
    this.fx.ring(W / 2, H / 2, 30, this.pal.ink, 0.6, 2);
  }
  mkBall(x, y, a, sp, owner) { return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, r: 7 * this.S, spin: 0, owner, fire: 0, tp: 0, wait: 0, trail: [] }; }
  fold(x, r) { const span = W - 2 * r, m = (((x - r) % (2 * span)) + 2 * span) % (2 * span); return (m > span ? 2 * span - m : m) + r; }
  // where to send the return: at a power-up orb, or away from the other paddle
  pickAim(p, bx) {
    const o = p === this.top ? this.bot : this.top;
    const orb = this.orbs.length && this.rng() < 0.55 ? this.orbs[this.ri(0, this.orbs.length - 1)] : null;
    const tx = orb ? orb.x : o.x < W / 2 ? this.r(W * 0.62, W - 20) : this.r(20, W * 0.38), ty = orb ? orb.y : o.y;
    return clamp(Math.atan2(tx - bx, Math.abs(ty - p.y)) / 0.9 + this.r(-0.15, 0.15), -0.75, 0.75);
  }
  think(p, dt) {
    if (p.frozen > 0) return;
    let ball = null, bt = Infinity;
    for (const b of this.balls) {
      if (b.wait > 0 || Math.sign(b.vy) !== p.dir) continue;
      const t = (p.y - b.y) / b.vy;
      if (t >= 0 && t < bt) { bt = t; ball = b; }
    }
    let target = W / 2 + (this.balls[0] ? (this.balls[0].x - W / 2) * 0.35 : 0);
    if (ball) {
      const bx = this.fold(ball.x + ball.vx * bt + 0.5 * ball.spin * bt * bt * 0.55, ball.r);
      if (ball !== p.track || p.trackDir !== Math.sign(ball.vy)) { p.track = ball; p.trackDir = Math.sign(ball.vy); p.aim = this.pickAim(p, bx); p.err = this.r(-1, 1) * p.w * 0.55 * (1 - p.skill); }
      if (this.rng() < dt * 1.2) p.err = this.r(-1, 1) * p.w * 0.6 * (1 - p.skill);
      target = bx - p.aim * p.w / 2 + p.err;
    }
    const d = target - p.x;
    p.x += Math.sign(d) * Math.min(Math.abs(d), (170 + p.skill * 230) * dt);
  }
  autopilot(dt) { this.think(this.bot, dt); }
  down(x) { this.bot.x = x; }
  move(x) { if (!this.auto && this.bot.frozen <= 0) this.bot.x = x; }
  step(dt) {
    this.fx.step(dt);
    this.think(this.top, dt);
    for (const p of this.pads) {
      for (const k of ['frozen', 'grow', 'shrink', 'curve']) if (p[k] > 0) p[k] -= dt;
      if (p.frozen > 0) p.x = p.px;
      p.w += (70 * (p.grow > 0 ? 1.6 : 1) * (p.shrink > 0 ? 0.58 : 1) - p.w) * Math.min(1, dt * 8);
      p.x = clamp(p.x, p.w / 2, W - p.w / 2);
      p.vx = (p.x - p.px) / dt; p.px = p.x; p.sq = Math.max(0, p.sq - dt * 5);
    }
    this.pop = this.pop.map((v) => Math.max(0, v - dt * 2));
    // orbs, portals, bumpers
    if ((this.orbT -= dt * (this.mods.swarm ? 1.6 : 1)) <= 0 && this.orbs.length < 2) {
      this.orbT = this.r(3.5, 6.5);
      for (let n = 0; n < 8; n++) {
        const x = this.r(46, W - 46), y = this.r(H * 0.34, H * 0.66);
        if ([...this.bumpers, ...(this.portals || []), ...this.orbs].some((o) => Math.hypot(o.x - x, o.y - y) < 46)) continue;
        let s = this.rng() * PU_KEYS.reduce((a, k) => a + PU[k][3], 0), k = PU_KEYS[0];
        for (const kk of PU_KEYS) { s -= PU[kk][3]; if (s <= 0) { k = kk; break; } }
        this.orbs.push({ x, y, k, age: 0 }); this.fx.ring(x, y, 26, PU[k][2], 0.5, 2); break;
      }
    }
    for (const o of this.orbs) o.age += dt;
    this.orbs = this.orbs.filter((o) => o.age < 14);
    if (this.portals && (this.portals.t -= dt) <= 0) { for (const q of this.portals) this.fx.ring(q.x, q.y, 30, '#c77dff', 0.4, 3); this.portals = null; }
    for (const u of this.bumpers) { u.t -= dt; u.flash = Math.max(0, u.flash - dt * 4); }
    if (this.bumpers.some((u) => u.t <= 0)) { this.bumpers.filter((u) => u.t <= 0).forEach((u) => this.fx.ring(u.x, u.y, 24, '#ffe14f', 0.3, 2)); this.bumpers = this.bumpers.filter((u) => u.t > 0); }
    // balls
    for (const b of this.balls) {
      if (b.wait > 0) { b.wait -= dt; continue; }
      b.tp -= dt;
      b.vx += b.spin * dt; b.spin *= Math.exp(-dt * 1.3);
      const sp = b.sp * (b.fire > 0 ? 1.35 : 1), m = Math.hypot(b.vx, b.vy) || 1;
      b.vx *= sp / m; b.vy *= sp / m;
      if (Math.abs(b.vy) < sp * 0.4) { b.vy = Math.sign(b.vy || 1) * sp * 0.4; b.vx = Math.sign(b.vx || 1) * Math.sqrt(sp * sp - b.vy * b.vy); }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.trail.push(b.x, b.y); if (b.trail.length > 28) b.trail.splice(0, 2);
      if (walls(b, 0, W, null, null, 1)) { b.spin *= -0.4; this.fx.sparks(b.x < W / 2 ? 0 : W, b.y, 5, b.fire > 0 ? '#ffb04a' : this.pads[b.owner].col, 160, b.x < W / 2 ? 0 : Math.PI, 1.5, 0.3); }
      if (b.fire > 0 && Math.random() < 0.6) this.fx.spark(b.x, b.y, this.r(-40, 40) - b.vx * 0.1, this.r(-40, 40) - b.vy * 0.1, Math.random() < 0.5 ? '#ffd24a' : '#ff5a1a', 0.4);
      for (const p of this.pads) this.paddleHit(b, p);
      for (const p of this.pads) if (p.shield && Math.sign(b.vy) === p.dir && Math.abs(b.y - (p.y + p.dir * 30)) < b.r) {
        b.vy = -b.vy; p.shield = false;
        this.fx.ring(b.x, b.y, 60, '#4fffd2', 0.5, 4); this.fx.sparks(b.x, b.y, 24, '#4fffd2', 260, -p.dir * Math.PI / 2, 3, 0.6); this.fx.shake(4, 0.25); this.fx.text(b.x, b.y - p.dir * 18, 'SAVED!', '#4fffd2', 13);
      }
      if (this.portals && b.tp <= 0) for (let i = 0; i < 2; i++) {
        const a = this.portals[i], o = this.portals[1 - i];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 15) {
          const s = Math.hypot(b.vx, b.vy) || 1; b.x = o.x + (b.vx / s) * 18; b.y = o.y + (b.vy / s) * 18; b.tp = 0.5; b.trail = [];
          this.fx.ring(a.x, a.y, 34, '#c77dff', 0.4, 3); this.fx.ring(o.x, o.y, 34, '#ffb3ff', 0.4, 3); this.fx.sparks(o.x, o.y, 14, '#e2a6ff', 200, Math.atan2(b.vy, b.vx), 1.4, 0.4);
          break;
        }
      }
      for (const u of this.bumpers) if (circlePeg(b, u, 1)) { b.sp = Math.min(640, b.sp * 1.04); u.flash = 1; this.fx.ring(u.x, u.y, 30, '#ffe14f', 0.3, 3); this.fx.sparks(b.x, b.y, 8, '#fff2a8', 200, Math.atan2(b.y - u.y, b.x - u.x), 1.6, 0.3); this.fx.shake(2, 0.12); }
      for (const o of this.orbs) if (!o.got && Math.hypot(b.x - o.x, b.y - o.y) < b.r + 14) { o.got = true; this.power(o, b); }
      if (b.y < -20 || b.y > H + 20) { b.dead = true; this.goal(b.y < 0 ? 1 : 0, b); }
    }
    this.orbs = this.orbs.filter((o) => !o.got);
    this.balls = this.balls.filter((b) => !b.dead);
    if (!this.balls.length) this.serve(this.lastGoal === 1 ? -1 : 1);
  }
  paddleHit(b, p) {
    if (Math.sign(b.vy) !== p.dir || Math.abs(b.y - p.y) >= b.r + 5 || Math.abs(b.x - p.x) >= p.w / 2 + b.r) return;
    const off = clamp((b.x - p.x) / (p.w / 2), -1, 1);
    b.sp = Math.min(620, b.sp + 16);
    const a = (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2) + off * 0.9 * (p.dir > 0 ? 1 : -1);
    b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp; b.y = p.y - p.dir * (b.r + 5);
    b.spin = clamp(p.vx * 1.4, -650, 650) + (p.curve > 0 ? (off > 0 ? -1 : 1) * this.r(700, 1000) : 0);
    const was = b.owner; b.owner = this.pads.indexOf(p);
    if (b.fire > 0) {
      if (was !== b.owner) { p.frozen = Math.max(p.frozen, 0.3); this.fx.sparks(b.x, b.y, 22, '#ffb04a', 300, -p.dir * Math.PI / 2, 2.6, 0.5); this.fx.shake(5, 0.25); this.fx.glow(b.x, b.y, 50, '#ff8a2a', 0.3); }
      if (--b.fire <= 0) b.fire = 0;
    }
    p.sq = 1; this.score++; this.rally++;
    const fast = b.sp > 470;
    this.fx.sparks(b.x, b.y, fast ? 14 : 8, p.col, fast ? 260 : 170, -p.dir * Math.PI / 2, 2.2, 0.35);
    this.fx.ring(b.x, b.y, fast ? 26 : 18, mix(p.col, '#fff', 0.4), 0.3, 2.5);
    if (fast) this.fx.shake(2.5, 0.15);
    this.burst(b.x, b.y, p.col, 4, 80);
    if (this.rally >= 6 && this.rally % 4 === 2) this.fx.text(W / 2, H / 2, `RALLY ${this.rally}`, this.pal.ink, 15, 1.1, -12);
  }
  power(o, b) {
    const [, name, col] = PU[o.k], me = this.pads[b.owner], them = this.pads[1 - b.owner];
    this.fx.ring(o.x, o.y, 44, col, 0.5, 4); this.fx.sparks(o.x, o.y, 18, col, 230, 0, 7, 0.5); this.fx.glow(o.x, o.y, 46, col, 0.35);
    this.fx.text(o.x, o.y - 22, name, col, 13, 1.2);
    if (o.k === 'split') { for (const da of [-0.38, 0.38]) if (this.balls.length < 6) { const a = Math.atan2(b.vy, b.vx) + da, n = this.mkBall(b.x, b.y, a, b.sp, b.owner); n.fire = b.fire; this.balls.push(n); } }
    else if (o.k === 'grow') { me.grow = 10; me.shrink = 0; }
    else if (o.k === 'shrink') { them.shrink = 9; them.grow = 0; this.fx.sparks(them.x, them.y, 12, col, 200, 0, 7, 0.4); }
    else if (o.k === 'fire') b.fire = 3;
    else if (o.k === 'freeze') { them.frozen = 1.6; this.fx.sparks(them.x, them.y, 16, '#dff8ff', 160, 0, 7, 0.6); this.fx.ring(them.x, them.y, 40, '#9fe8ff', 0.5, 3); }
    else if (o.k === 'shield') me.shield = true;
    else if (o.k === 'curve') me.curve = 10;
    else if (o.k === 'portal') { const y1 = this.r(H * 0.36, H * 0.46), y2 = this.r(H * 0.54, H * 0.64), l = this.rng() < 0.5; this.portals = [{ x: l ? this.r(50, 120) : this.r(W - 120, W - 50), y: y1 }, { x: l ? this.r(W - 120, W - 50) : this.r(50, 120), y: y2 }]; this.portals.t = 10; }
    else if (o.k === 'bumpers') { this.bumpers = Array.from({ length: 3 }, (_, i) => ({ x: W * (0.25 + i * 0.25) + this.r(-20, 20), y: H / 2 + this.r(-50, 50), r: 13, t: 12, flash: 1 })); }
  }
  goal(side, b) {
    this.pts[side]++; this.pop[side] = 1; this.lastGoal = side; this.rally = 0;
    const col = this.pads[side].col, y = side === 1 ? 6 : H - 6;
    this.fx.flash(col, 0.3, 0.35); this.fx.shake(7, 0.4);
    this.fx.sparks(clamp(b.x, 10, W - 10), y, 36, col, 340, side === 1 ? Math.PI / 2 : -Math.PI / 2, 2.2, 0.8, 300);
    this.fx.glow(clamp(b.x, 10, W - 10), y, 90, col, 0.5);
    this.fx.text(W / 2, side === 1 ? H * 0.3 : H * 0.7, 'GOAL!', col, 26, 1.2, side === 1 ? 20 : -20);
  }
  hud() { return `${this.pts[0]} : ${this.pts[1]}`; }
  draw(c) {
    this.fx.apply(c);
    this.clear(c);
    // table markings and goal glows
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 2; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(W / 2, H / 2, 46, 0, 7); c.stroke();
    for (const p of this.pads) {
      const g = c.createLinearGradient(0, p.dir < 0 ? 0 : H, 0, p.dir < 0 ? 40 : H - 40);
      g.addColorStop(0, mix(p.col, '#000', 0.2)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.35; c.fillStyle = g; c.fillRect(0, p.dir < 0 ? 0 : H - 40, W, 40); c.globalAlpha = 1;
    }
    for (let i = 0; i < 2; i++) this.text(c, String(this.pts[i]), W - 24, H / 2 + (i ? 26 : -26), 22 * (1 + this.pop[i] * 0.6), this.pop[i] > 0 ? this.pads[i].col : 'rgba(255,255,255,.22)');
    // portals and bumpers
    if (this.portals) for (let i = 0; i < 2; i++) {
      const q = this.portals[i], col = i ? '#ffb3ff' : '#c77dff', fade = Math.min(1, this.portals.t);
      c.globalAlpha = fade;
      for (let k = 0; k < 3; k++) { c.strokeStyle = col; c.lineWidth = 2.5 - k * 0.6; c.beginPath(); c.ellipse(q.x, q.y, 16 - k * 4, 16 - k * 4, 0, this.t * (3 + k) * (i ? -1 : 1), this.t * (3 + k) * (i ? -1 : 1) + 4.6); c.stroke(); }
      c.globalAlpha = 1;
      if (Math.random() < 0.3) this.fx.spark(q.x + this.r(-14, 14), q.y + this.r(-14, 14), this.r(-30, 30), this.r(-30, 30), col, 0.3);
    }
    for (const u of this.bumpers) {
      const s = 1 + u.flash * 0.25, a = Math.min(1, u.t);
      c.globalAlpha = a; c.fillStyle = mix('#ffe14f', '#fff', u.flash * 0.7); c.beginPath(); c.arc(u.x, u.y, u.r * s, 0, 7); c.fill();
      c.fillStyle = '#7a5a00'; c.beginPath(); c.arc(u.x, u.y, u.r * 0.45 * s, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(u.x, u.y, u.r * s + 3, 0, 7); c.stroke(); c.globalAlpha = 1;
    }
    // orbs
    for (const o of this.orbs) {
      const [l, , col] = PU[o.k], bob = Math.sin(this.t * 3 + o.x) * 3, a = Math.min(1, o.age * 3, (14 - o.age) * 1.5), y = o.y + bob;
      c.globalAlpha = a * 0.35; c.fillStyle = col; c.beginPath(); c.arc(o.x, y, 17 + Math.sin(this.t * 6) * 2, 0, 7); c.fill();
      c.globalAlpha = a; const g = c.createRadialGradient(o.x - 4, y - 4, 2, o.x, y, 13); g.addColorStop(0, mix(col, '#fff', 0.7)); g.addColorStop(1, col);
      c.fillStyle = g; c.beginPath(); c.arc(o.x, y, 12, 0, 7); c.fill();
      this.text(c, l, o.x, y + 0.5, 12, '#111'); c.globalAlpha = 1;
    }
    // shields
    for (const p of this.pads) if (p.shield) {
      const y = p.y + p.dir * 30; c.globalAlpha = 0.55 + Math.sin(this.t * 8) * 0.2; c.strokeStyle = '#4fffd2'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= W; x += 12) c.lineTo(x, y + Math.sin(x * 0.3 + this.t * 6) * 2); c.stroke(); c.globalAlpha = 1;
    }
    // paddles
    for (const p of this.pads) {
      const sq = p.sq * 3, h = 10 - sq * 0.5, x = p.x - p.w / 2 - sq, w = p.w + sq * 2, y = p.y - h / 2;
      c.globalAlpha = 0.25; c.fillStyle = p.col; roundRect(c, x - 4, y - 4, w + 8, h + 8, 9); c.fill(); c.globalAlpha = 1;
      c.fillStyle = p.frozen > 0 ? '#bfefff' : p.col; roundRect(c, x, y, w, h, 5); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 5, y + 1.5, w - 10, 2);
      if (p.frozen > 0) { c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 4; i++) { const cx = x + w * (0.15 + i * 0.23); c.moveTo(cx - 4, y - 3); c.lineTo(cx + 4, y + h + 3); c.moveTo(cx + 4, y - 3); c.lineTo(cx - 4, y + h + 3); } c.stroke(); }
      if (p.curve > 0) { c.strokeStyle = '#ff7ae0'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, p.w / 2 + 6, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    }
    // balls with trails
    for (const b of this.balls) {
      const tr = b.trail, col = b.fire > 0 ? '#ff8a2a' : this.pads[b.owner].col;
      if (tr.length > 4) {
        c.lineCap = 'round';
        for (let i = 2; i < tr.length; i += 2) { const f = i / tr.length; c.globalAlpha = f * (b.fire > 0 ? 0.7 : 0.4); c.strokeStyle = b.fire > 0 && i % 4 ? '#ffd24a' : col; c.lineWidth = b.r * 2 * f * (b.fire > 0 ? 1.2 : 0.9); c.beginPath(); c.moveTo(tr[i - 2], tr[i - 1]); c.lineTo(tr[i], tr[i + 1]); c.stroke(); }
        c.globalAlpha = 1; c.lineCap = 'butt';
      }
      if (b.sp > 470 && b.wait <= 0) { c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; const s = Math.hypot(b.vx, b.vy) || 1; for (const o of [-1, 1]) { c.beginPath(); c.moveTo(b.x + (o * b.vy / s) * b.r, b.y - (o * b.vx / s) * b.r); c.lineTo(b.x + (o * b.vy / s) * b.r - b.vx * 0.08, b.y - (o * b.vx / s) * b.r - b.vy * 0.08); c.stroke(); } }
      if (b.fire > 0) { const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3.2); g.addColorStop(0, 'rgba(255,200,90,.8)'); g.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = g; c.fillRect(b.x - b.r * 3.2, b.y - b.r * 3.2, b.r * 6.4, b.r * 6.4); }
      if (b.wait > 0) { c.globalAlpha = 0.5 + Math.sin(this.t * 20) * 0.5; }
      this.orb(c, this.skin.pick('pb', 'ball', 'animal', 'item'), b.x, b.y, b.r, this.pal.ink, this.t * 3 + b.spin * 0.002);
      c.globalAlpha = 1;
    }
    this.fx.draw(c);
    this.fx.over(c);
  }
}
