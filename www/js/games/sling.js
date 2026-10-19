// Portrait slingshot: towers of rigid blocks on floating ledges, the sling at the
// bottom. Drag down anywhere and release to fire upward.
import { Game, W, H, drawFit, drawRectImg, roundRect } from './engine.js';
import { World, Body } from './physics.js';

export class Sling extends Game {
  static noMods = ['mirror', 'wobble'];
  setup() { this.levelN = 0; this.build(); }
  build() {
    this.world = new World(520 * this.G);
    this.home = { x: W / 2, y: H - 70 };
    this.shotsLeft = 5; this.ball = null; this.aimT = 1.6; this.wait = 0; this.grace = 1.2;
    this.world.add(new Body(W / 2, H + 10, W * 2, 40, 0, { data: { ground: true } }));
    const ledges = this.ri(1, 2);
    this.ledges = [];
    for (let i = 0; i < ledges; i++) {
      // ledges sit to the sides so shots can rise through the middle and drop onto the towers
      const side = ledges === 1 ? (this.rng() < 0.5 ? -1 : 1) : i ? 1 : -1;
      const lw = this.r(96, 124), lx = W / 2 + side * this.r(92, 112), ly = this.r(170, 240);
      this.ledges.push(this.world.add(new Body(lx, ly, lw, 12, 0, { friction: 0.8, data: { ledge: true } })));
    }
    this.targets = 0;
    const tex = this.skin.slots.tile;
    for (const L of this.ledges) {
      const cols = 2, bw = 14, gap = L.w - 20;
      const bh = this.r(28, 40), rows = this.ri(1, 3);
      let y = L.y - 6;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) this.block(L.x - L.w / 2 + 10 + k * gap, y - bh / 2, bw, bh, tex[(r + k) % tex.length]);
        this.block(L.x, y - bh - 5, L.w - 8, 10, tex[r % tex.length]);
        // a creature on each storey
        const m = this.skin.creatures[1 + ((r + this.targets) % 4)];
        const tx = L.x - L.w / 2 + 10 + gap * 0.5;
        this.world.add(new Body(tx, y - 11, 18, 18, 0.8, { data: { target: true, m, home: [tx, y - 11] } }));
        this.targets++;
        y -= bh + 10;
      }
    }
    this.world.onImpact = (a, b, p) => {
      if (this.grace > 0) return;
      for (const t of [a, b]) if (t.target && !t.dead && ((a.ball || b.ball) ? p > 900 : p > 6000)) this.kill(t);
    };
  }
  block(x, y, w, h, img) { return this.world.add(new Body(x, y, w, h, 1, { friction: 0.7, data: { img } })); }
  kill(t) { t.dead = true; this.score += 500; this.burst(t.x, t.y, this.col(0), 24, 200); this.world.remove(t); }
  launch(vx, vy) {
    if (this.ball || this.shotsLeft <= 0) return;
    this.shotsLeft--;
    const s = 18 * this.S;
    this.ball = this.world.add(new Body(this.home.x, this.home.y, s, s, 5, { friction: 0.4, data: { ball: true, i: this.skin.any('item', 'hero'), life: 6 } }));
    this.ball.vx = vx; this.ball.vy = vy; this.ball.av = vx * 0.02;
  }
  // ballistic aim at a target point: try a fan of angles/powers ignoring collisions
  plan(t) {
    let best = null;
    const g = 520 * this.G;
    for (let a = -Math.PI + 0.3; a < -0.3; a += 0.03) for (const v of [560, 620, 680, 740]) {
      let x = this.home.x, y = this.home.y, vx = Math.cos(a) * v, vy = Math.sin(a) * v, d = 1e9, blocked = false, falling = false;
      for (let s = 0; s < 420; s++) {
        vy += g / 120; vx *= 0.999; vy *= 0.999; x += vx / 120; y += vy / 120;
        // a shot that clips a ledge on the way is useless
        const dd = Math.hypot(x - t.x, y - t.y);
        if (dd > 40 && this.ledges.some((L) => Math.abs(x - L.x) < L.w / 2 + 8 && Math.abs(y - L.y) < L.h / 2 + 8)) { blocked = true; break; }
        if (dd < d) { d = dd; falling = vy > 0; }
        if (y > H || x < -20 || x > W + 20) break;
      }
      if (blocked && d > 14) continue;
      const score = d + (falling ? 0 : 25);
      if (!best || score < best.score) best = { d, score, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
    }
    return best || { vx: 0, vy: -700, d: 999 };
  }
  autopilot(dt) {
    if (this.ball) return;
    this.aimT -= dt;
    if (!this.goal) {
      const ts = this.world.bodies.filter((b) => b.target && !b.dead);
      if (!ts.length) return;
      // aim at the top of a tower: the collapse does the rest
      const t = ts[this.ri(0, ts.length - 1)];
      const top = Math.min(...this.world.bodies.filter((b) => b.invM && !b.ball && Math.abs(b.x - t.x) < 40).map((b) => b.y - b.h / 2));
      this.goal = this.plan({ x: t.x + this.r(-10, 10), y: top - 4 });
    }
    if (this.aimT <= 0 && this.goal) { this.launch(this.goal.vx * this.r(0.96, 1.04), this.goal.vy); this.goal = null; this.aimT = 1.6; }
  }
  down(x, y) { if (!this.ball) this.pull = { x, y, cx: x, cy: y }; }
  move(x, y) { if (this.pull) { this.pull.cx = x; this.pull.cy = y; } }
  up(x, y) {
    if (!this.pull) return;
    const vx = (this.pull.x - x) * 5, vy = (this.pull.y - y) * 5, s = Math.hypot(vx, vy);
    if (s > 60) { const k = Math.min(1, 760 / s); this.launch(vx * k, vy * k); }
    this.pull = null;
  }
  tap() {}
  step(dt) {
    this.grace -= dt;
    this.world.step(dt);
    if (this.grace <= 0) for (const b of [...this.world.bodies]) if (b.target && !b.dead && (b.y > H - 30 || Math.hypot(b.x - b.home[0], b.y - b.home[1]) > 16 || Math.abs(b.a) > 1)) this.kill(b);
    for (const b of [...this.world.bodies]) if (b.invM && (b.y > H + 80 || b.x < -100 || b.x > W + 100)) this.world.remove(b);
    const ball = this.ball;
    if (ball) { ball.life -= dt; if (ball.life <= 0 || !this.world.bodies.includes(ball) || (Math.hypot(ball.vx, ball.vy) < 15 && ball.life < 4.5)) { this.world.remove(ball); this.ball = null; } }
    const left = this.world.bodies.filter((b) => b.target).length;
    if (!this.ball && (!left || this.shotsLeft <= 0)) { this.wait += dt; if (this.wait > 1.4) { if (!left) this.score += this.shotsLeft * 200; this.levelN++; this.build(); } }
  }
  draw(c) {
    this.clear(c);
    for (const b of this.world.bodies) {
      c.save(); c.translate(b.x, b.y); c.rotate(b.a);
      if (b.ground) { c.fillStyle = this.col(2); c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); }
      else if (b.ledge) { c.fillStyle = this.col(5); roundRect(c, -b.w / 2, -b.h / 2, b.w, b.h, 5); c.fill(); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-b.w / 2 + 3, -b.h / 2 + 2, b.w - 6, 2); }
      else if (b.target) { const f = b.m.frames[Math.floor(this.t * 3) % 2]; if (!drawFit(c, f, 0, 0, b.w * 1.6, b.h * 1.6)) { c.fillStyle = this.col(0); c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); } }
      else if (b.ball) { if (!drawFit(c, b.i, 0, 0, b.w * 1.4, b.h * 1.4)) { c.fillStyle = this.col(3); c.beginPath(); c.arc(0, 0, b.w / 2, 0, 7); c.fill(); } }
      else { c.fillStyle = this.col(1); c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); if (b.img) { c.globalAlpha = 0.85; drawRectImg(c, b.img, -b.w / 2, -b.h / 2, b.w, b.h, true); c.globalAlpha = 1; } c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.strokeRect(-b.w / 2 + 0.5, -b.h / 2 + 0.5, b.w - 1, b.h - 1); }
      c.restore();
    }
    // sling
    const { x: hx, y: hy } = this.home;
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx, H); c.lineTo(hx, hy + 24); c.lineTo(hx - 18, hy); c.moveTo(hx, hy + 24); c.lineTo(hx + 18, hy); c.stroke();
    if (!this.ball && this.shotsLeft > 0) {
      let bx = hx, by = hy;
      if (this.pull?.cx != null) { bx += Math.max(-70, Math.min(70, this.pull.cx - this.pull.x)); by += Math.max(-10, Math.min(70, this.pull.cy - this.pull.y)); }
      else if (this.auto && this.goal) { const k = Math.min(1, 1.2 - this.aimT); bx -= (this.goal.vx / 700) * 40 * k; by -= (this.goal.vy / 700) * 40 * k; }
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(hx - 18, hy); c.lineTo(bx, by); c.lineTo(hx + 18, hy); c.stroke();
      this.orb(c, this.skin.pick('ammo', 'item', 'hero'), bx, by, 10 * this.S, this.col(3));
      if (this.pull?.cx != null) { // trajectory preview
        let x = hx, y = hy, vx = (this.pull.x - this.pull.cx) * 5, vy = (this.pull.y - this.pull.cy) * 5;
        const s = Math.hypot(vx, vy), k = Math.min(1, 760 / Math.max(1, s)); vx *= k; vy *= k;
        c.fillStyle = 'rgba(255,255,255,.35)';
        for (let i = 0; i < 30; i++) { for (let j = 0; j < 4; j++) { vy += (520 * this.G) / 120; vx *= 0.999; vy *= 0.999; x += vx / 120; y += vy / 120; } c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); }
      }
    }
    this.text(c, '●'.repeat(Math.max(0, this.shotsLeft)), W - 40, H - 16, 12, this.col(3));
  }
  hud() { const left = this.world.bodies.filter((b) => b.target).length; return `${this.score} · ${left} left · ${this.shotsLeft} shots`; }
}
