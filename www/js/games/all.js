import { Platformer, Racer, Rocks } from './more.js';
import { Doom } from './doom.js';
import { Sling } from './sling.js';
import { Necro } from './necro.js';
import { Chess, Dice, Cards } from './board.js';
import { Monsters, Fighter } from './battle.js';
import { Flight } from './flight.js';
import { Ski } from './ski.js';
import { Robotron } from './robotron.js';
import { Crokinole } from './crokinole.js';
import { Survivors } from './survivors.js';
import { Graves } from './graves.js';
import { Mystery } from './mystery.js';
import { Wordle, Bee, WordSearch, Wheel, Hangman, Vocab, Ladder } from './wordgames.js';
import { Twenty48, Arrows } from './puzzles.js';
import { Game, W, H, circleRect, reflect, circlePeg, walls, roundRect, drawFit, drawRectImg } from './engine.js';

// ================================================================ Plinko
class Plinko extends Game {
  setup() {
    this.pegs = [];
    const rows = this.ri(8, 11), gap = (W - 40) / 9;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? gap / 2 : 0;
      for (let x = 20 + off; x <= W - 20; x += gap) this.pegs.push({ x, y: 70 + r * ((H - 150) / rows), r: 4, hit: 0 });
    }
    const vals = [[50, 20, 10, 5, 2, 5, 10, 20, 50], [100, 25, 5, 1, 0, 1, 5, 25, 100], [5, 10, 20, 50, 100, 50, 20, 10, 5]][this.ri(0, 2)];
    this.slots = vals.map((v, i) => ({ v, x: (i * W) / 9, w: W / 9, flash: 0 }));
    this.balls = [];
    this.next = 0;
    this.gravity = this.r(700, 1000);
  }
  drop(x) {
    if (this.balls.length > 30) return;
    this.balls.push({ x: Math.max(12, Math.min(W - 12, x)), y: 22, vx: this.r(-20, 20), vy: 0, r: 6 * this.S, c: this.col(this.ri(0, 5)), i: this.skin.any('ball', 'item', 'animal', 'enemy'), rot: 0 });
  }
  autopilot(dt) {
    this.next -= dt;
    if (this.next <= 0) { this.drop(W / 2 + this.r(-90, 90)); this.next = this.r(0.35, 0.9); }
  }
  down(x) { this.drop(x); }
  step(dt) {
    const floor = H - 44;
    for (const b of this.balls) {
      b.vy += this.gravity * this.G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      for (const p of this.pegs) if (circlePeg(b, p, 0.5)) { p.hit = 0.25; b.vx += this.r(-12, 12); }
      walls(b, 0, W, null, null, 0.5);
      if (b.y > floor) {
        for (let i = 1; i < 9; i++) { const sx = (i * W) / 9; if (Math.abs(b.x - sx) < b.r + 1.5) { b.x = b.x < sx ? sx - b.r - 1.5 : sx + b.r + 1.5; b.vx *= -0.5; } }
      }
      if (b.y > H - 10 && !b.done) {
        b.done = true;
        const s = this.slots[Math.min(8, Math.max(0, Math.floor(b.x / (W / 9))))];
        s.flash = 0.5; this.score += s.v; this.burst(b.x, H - 14, b.c, 8, 120);
      }
    }
    this.balls = this.balls.filter((b) => !b.done);
    this.pegs.forEach((p) => (p.hit = Math.max(0, p.hit - dt)));
    this.slots.forEach((s) => (s.flash = Math.max(0, s.flash - dt)));
  }
  draw(c) {
    this.clear(c);
    for (const p of this.pegs) {
      c.fillStyle = p.hit ? this.col(0) : this.pal.c[4];
      c.globalAlpha = p.hit ? 1 : 0.55;
      c.beginPath(); c.arc(p.x, p.y, p.r + (p.hit ? 1.5 : 0), 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    this.slots.forEach((s, i) => {
      c.fillStyle = s.flash ? this.col(0) : this.col(i % 2 ? 1 : 3);
      c.globalAlpha = s.flash ? 0.9 : 0.35;
      c.fillRect(s.x + 2, H - 40, s.w - 4, 40);
      c.globalAlpha = 1;
      this.text(c, String(s.v), s.x + s.w / 2, H - 20, 11);
    });
    for (const b of this.balls) { b.rot += b.vx * 0.002; this.orb(c, b.i, b.x, b.y, b.r, b.c, b.rot); }
  }
}

// ================================================================ Breakout
class Breakout extends Game {
  setup() {
    this.paddle = { x: W / 2, y: H - 28, w: 74, h: 10 };
    this.level = 0;
    this.lives = 3;
    this.build();
  }
  build() {
    const rows = this.ri(5, 8), cols = 8, bw = (W - 20) / cols, bh = 16;
    const pattern = this.ri(0, 5);
    this.bricks = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const keep = [true, (r + k) % 2 === 0, Math.abs(k - 3.5) <= r / 1.4, Math.abs(k - 3.5) + Math.abs(r - rows / 2) <= rows / 1.6, this.rng() > 0.25, Math.sin(k * 0.9 + r) > -0.4][pattern];
      if (keep) this.bricks.push({ x: 10 + k * bw + 1.5, y: 54 + r * (bh + 4), w: bw - 3, h: bh, hp: this.rng() < 0.12 ? 2 : 1, c: this.col(r), i: this.skin.pick(`row${r % 3}`, 'tile', 'block') });
    }
    this.serve();
  }
  serve() {
    this.ball = { x: this.paddle.x, y: this.paddle.y - 12, vx: 0, vy: 0, r: 6 * this.S, stuck: 0.6, i: this.skin.pick('bb', 'ball', 'item') };
    this.speed = 300 + this.level * 15;
  }
  autopilot(dt) {
    const b = this.ball;
    if (b.vy > 0 && this.aimFor !== b) { this.aimFor = b; this.offset = this.r(-0.36, 0.36) * this.paddle.w; }
    // predict where the ball reaches the paddle, folding wall bounces
    let tx = b.x;
    if (b.vy > 0) {
      const t = (this.paddle.y - b.y) / b.vy;
      let x = b.x + b.vx * t;
      const span = W - 2 * b.r;
      x = ((((x - b.r) % (2 * span)) + 2 * span) % (2 * span));
      tx = (x > span ? 2 * span - x : x) + b.r;
    }
    const target = tx - (this.offset || 0);
    const d = target - this.paddle.x;
    this.paddle.x += Math.sign(d) * Math.min(Math.abs(d), 460 * dt);
  }
  down(x) { this.paddle.x = x; }
  move(x) { if (!this.auto) this.paddle.x = x; }
  step(dt) {
    const p = this.paddle, b = this.ball;
    p.x = Math.max(p.w / 2, Math.min(W - p.w / 2, p.x));
    if (b.stuck > 0) {
      b.x = p.x; b.y = p.y - 12; b.stuck -= dt;
      if (b.stuck <= 0) { const a = -Math.PI / 2 + this.r(-0.5, 0.5); b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed; }
      return;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    walls(b, 0, W, 0, null, 1);
    if (b.vy > 0 && b.y + b.r >= p.y && b.y < p.y + p.h && Math.abs(b.x - p.x) < p.w / 2 + b.r) {
      const off = (b.x - p.x) / (p.w / 2);
      const a = -Math.PI / 2 + off * 1.05;
      this.speed = Math.min(560, this.speed + 4);
      b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed;
    }
    for (const k of this.bricks) {
      if (k.dead) continue;
      const n = circleRect(b, k);
      if (n) {
        reflect(b, n, 1);
        k.hp--;
        if (k.hp <= 0) { k.dead = true; this.score += 10; this.burst(k.x + k.w / 2, k.y + k.h / 2, k.c, 12); }
        break;
      }
    }
    this.bricks = this.bricks.filter((k) => !k.dead);
    if (!this.bricks.length) { this.level++; this.build(); }
    if (b.y > H + 20) { this.lives--; if (this.lives < 0) { this.lives = 3; this.score = 0; this.level = 0; this.build(); } else this.serve(); }
  }
  hud() { return `${this.score} · ♥${Math.max(0, this.lives)}`; }
  draw(c) {
    this.clear(c);
    for (const k of this.bricks) { c.fillStyle = k.c; c.globalAlpha = k.hp > 1 ? 1 : 0.85; roundRect(c, k.x, k.y, k.w, k.h, 4); c.fill(); if (k.i) { c.globalAlpha = 0.75; c.save(); roundRect(c, k.x, k.y, k.w, k.h, 4); c.clip(); drawRectImg(c, k.i, k.x, k.y, k.w, k.h, true); c.restore(); } c.globalAlpha = 1; if (k.hp > 1) { c.strokeStyle = this.pal.ink; c.lineWidth = 1.5; roundRect(c, k.x, k.y, k.w, k.h, 4); c.stroke(); } }
    c.globalAlpha = 1;
    const p = this.paddle;
    c.fillStyle = this.pal.ink; roundRect(c, p.x - p.w / 2, p.y, p.w, p.h, 5); c.fill();
    this.orb(c, this.ball.i, this.ball.x, this.ball.y, this.ball.r, this.col(0), this.t * 4);
  }
}

// ================================================================ Merge (Suika-like)
const FRUIT = ['🫐', '🍒', '🍓', '🍋', '🍊', '🍎', '🍑', '🍍', '🥥', '🍈', '🍉'];
const RADII = [11, 15, 20, 25, 31, 38, 45, 53, 61, 70, 80];
class Merge extends Game {
  setup() {
    this.balls = [];
    this.L = 22; this.R = W - 22; this.F = H - 18; this.line = 74;
    this.cur = this.ri(0, 3); this.nxt = this.ri(0, 3);
    this.aimX = W / 2; this.cool = 0; this.over = 0; this.useEmoji = this.rng() < 0.35;
    this.lvImg = this.rng() < 0.75 ? this.skin.list('levels', RADII.length, 'animal', 'ball', 'item', 'enemy') : null;
  }
  dropAt(x) {
    if (this.cool > 0) return;
    const r = RADII[this.cur];
    this.balls.push({ x: Math.max(this.L + r, Math.min(this.R - r, x)), y: 44, vx: 0, vy: 0, r, lv: this.cur, age: 0 });
    this.cur = this.nxt; this.nxt = this.ri(0, 3); this.cool = 0.55;
  }
  // pick a target once per drop, glide the dropper there smoothly, pause, then drop
  autopilot(dt) {
    if (this.goalX == null) {
      if (this.cool > 0) return;
      const same = this.balls.filter((b) => b.lv === this.cur && b.age > 0.5).sort((a, b) => a.y - b.y)[0];
      this.goalX = same ? same.x + this.r(-5, 5) : this.cur < 2 ? this.r(this.L + 20, this.R - 20) : this.rng() < 0.5 ? this.L + 40 : this.R - 40;
      this.hold = this.r(0.25, 0.6);
    }
    const d = this.goalX - this.aimX;
    this.aimX += Math.sign(d) * Math.min(Math.abs(d), 260 * dt);
    if (Math.abs(d) < 1) { this.hold -= dt; if (this.hold <= 0) { this.dropAt(this.aimX); this.goalX = null; } }
  }
  down(x) { this.aimX = x; }
  move(x) { this.aimX = x; }
  up(x) { this.aimX = x; this.dropAt(x); }
  step(dt) {
    this.cool -= dt;
    const bs = this.balls;
    for (const b of bs) { b.vy += 900 * this.G * dt; b.vx *= 0.996; b.vy *= 0.999; b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt; }
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i]; if (a.dead) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j]; if (b.dead) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          if (a.lv === b.lv) {
            a.dead = b.dead = true;
            const lv = a.lv + 1;
            this.score += (lv + 1) * 3;
            this.burst((a.x + b.x) / 2, (a.y + b.y) / 2, this.col(lv), 14);
            if (lv < RADII.length) bs.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (a.vx + b.vx) / 2, vy: Math.min(0, (a.vy + b.vy) / 2), r: RADII[lv], lv, age: 0.6 });
            break;
          }
          const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d, ov = rr - d;
          const ma = a.r * a.r, mb = b.r * b.r, t = ma + mb;
          a.x -= nx * ov * (mb / t); a.y -= ny * ov * (mb / t); b.x += nx * ov * (ma / t); b.y += ny * ov * (ma / t);
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) { const imp = (-(1.15) * rv) / (1 / ma + 1 / mb); a.vx -= (imp / ma) * nx; a.vy -= (imp / ma) * ny; b.vx += (imp / mb) * nx; b.vy += (imp / mb) * ny; }
        }
      }
      for (const b of bs) {
        if (b.x - b.r < this.L) { b.x = this.L + b.r; b.vx = Math.abs(b.vx) * 0.3; }
        if (b.x + b.r > this.R) { b.x = this.R - b.r; b.vx = -Math.abs(b.vx) * 0.3; }
        if (b.y + b.r > this.F) { b.y = this.F - b.r; b.vy = -Math.abs(b.vy) * 0.15; b.vx *= 0.97; }
      }
    }
    this.balls = bs.filter((b) => !b.dead);
    const high = this.balls.some((b) => b.age > 2 && b.y - b.r < this.line && Math.abs(b.vy) < 40);
    this.over = high ? this.over + dt : 0;
    if (this.over > 1.6) { this.balls.forEach((b) => this.burst(b.x, b.y, this.col(b.lv), 4)); this.balls = []; this.score = 0; this.over = 0; }
  }
  drawBall(c, x, y, r, lv) {
    const li = this.lvImg?.[lv];
    if (li && drawFit(c, li, x, y, r * 2.15, r * 2.15)) return;
    c.fillStyle = this.col(lv);
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, 7); c.fill();
    if (this.useEmoji) { c.font = `${r * 1.15}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(FRUIT[lv] || '⭐', x, y + r * 0.05); }
    else { c.fillStyle = this.pal.bg; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.05, r * 0.09 + 1, 0, 7); c.arc(x + r * 0.3, y - r * 0.05, r * 0.09 + 1, 0, 7); c.fill(); c.strokeStyle = this.pal.bg; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y + r * 0.12, r * 0.22, 0.2, Math.PI - 0.2); c.stroke(); }
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(this.L, this.line, this.R - this.L, this.F - this.line);
    c.strokeStyle = this.over ? this.col(3) : 'rgba(255,255,255,.12)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(this.L, this.line); c.lineTo(this.R, this.line); c.stroke(); c.setLineDash([]);
    c.fillStyle = this.pal.c[4]; c.globalAlpha = 0.5; c.fillRect(this.L - 4, this.line, 4, this.F - this.line); c.fillRect(this.R, this.line, 4, this.F - this.line); c.fillRect(this.L - 4, this.F, this.R - this.L + 8, 4); c.globalAlpha = 1;
    for (const b of this.balls) this.drawBall(c, b.x, b.y, b.r, b.lv);
    const r = RADII[this.cur], x = Math.max(this.L + r, Math.min(this.R - r, this.aimX));
    c.globalAlpha = this.cool > 0 ? 0.35 : 1; this.drawBall(c, x, 44, r, this.cur); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(x, 44 + r); c.lineTo(x, this.F); c.stroke();
    this.drawBall(c, W - 30, 22, 9, this.nxt);
  }
}

// ================================================================ Dash (side-scrolling runner)
class Dash extends Game {
  setup() {
    this.ground = H - 70;
    this.reset();
    this.hills = Array.from({ length: 8 }, (_, i) => ({ x: i * 70, h: this.r(30, 90) }));
  }
  reset() {
    this.p = { x: 80, y: this.ground - 22, s: 22, vy: 0, on: true, jumps: 0, rot: 0 };
    this.speed = 230; this.obs = []; this.gaps = []; this.dist = 0; this.dead = 0; this.spawnX = W + 60; this.score = 0;
  }
  spawn() {
    const t = this.rng();
    const x = this.spawnX;
    if (t < 0.4) this.obs.push({ type: 'spike', x, w: 22, h: 22 });
    else if (t < 0.55) { this.obs.push({ type: 'spike', x, w: 22, h: 22 }); this.obs.push({ type: 'spike', x: x + 22, w: 22, h: 22 }); }
    else if (t < 0.78) this.obs.push({ type: 'block', x, w: this.r(28, 60), h: this.r(26, 52) });
    else this.gaps.push({ x, w: this.r(55, 100) });
    this.spawnX += this.r(200, 330) + this.speed * 0.25;
  }
  jump() {
    const p = this.p;
    if (this.dead) return;
    if (p.on) { p.vy = -620; p.on = false; p.jumps = 1; }
    else if (p.jumps < 2) { p.vy = -540; p.jumps = 2; }
  }
  overGap(x0, x1) { return this.gaps.some((g) => x0 > g.x + 2 && x1 < g.x + g.w - 2); }
  autopilot() {
    const p = this.p, front = p.x + p.s;
    const next = [...this.obs.map((o) => ({ ...o, k: 'o' })), ...this.gaps.map((g) => ({ ...g, k: 'g' }))].filter((o) => o.x + o.w > p.x).sort((a, b) => a.x - b.x)[0];
    if (!next) return;
    const dx = next.x - front;
    const lead = this.speed * (next.k === 'g' ? 0.06 : next.type === 'block' && next.h > 40 ? 0.26 : 0.2) + (this.jitter || 0);
    if (p.on && dx < lead && dx > -5) { this.jump(); this.jitter = this.r(-8, 10); }
    else if (!p.on && p.jumps === 1 && p.vy > 60 && next.k === 'g' && p.x + p.s / 2 > next.x && p.x < next.x + next.w) this.jump();
  }
  down() { this.jump(); }
  step(dt) {
    const p = this.p;
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    this.speed = Math.min(460, this.speed + dt * 6);
    const dx = this.speed * dt;
    this.dist += dx; this.score = Math.floor(this.dist / 10);
    for (const o of this.obs) o.x -= dx;
    for (const g of this.gaps) g.x -= dx;
    this.spawnX -= dx;
    while (this.spawnX < W + 400) this.spawn();
    this.obs = this.obs.filter((o) => o.x + o.w > -40);
    this.gaps = this.gaps.filter((g) => g.x + g.w > -40);
    this.hills.forEach((h) => { h.x -= dx * 0.25; if (h.x < -80) { h.x += 8 * 70; h.h = this.r(30, 90); } });
    const prevBottom = p.y + p.s;
    p.vy += 1900 * this.G * dt; p.y += p.vy * dt;
    let floor = this.overGap(p.x, p.x + p.s) ? Infinity : this.ground;
    for (const o of this.obs) {
      if (p.x + p.s <= o.x + 2 || p.x >= o.x + o.w - 2) continue;
      if (o.type === 'block') {
        const top = this.ground - o.h;
        if (prevBottom <= top + 2) floor = Math.min(floor, top);
        else if (p.y + p.s > top + 3) return this.die();
      } else if (p.y + p.s > this.ground - o.h * 0.7) {
        const mid = o.x + o.w / 2;
        if (Math.abs(p.x + p.s / 2 - mid) < o.w / 2 + 2) return this.die();
      }
    }
    if (p.y + p.s >= floor) { p.y = floor - p.s; p.vy = 0; p.on = true; p.jumps = 0; p.rot = Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2); }
    else { p.on = false; p.rot += dt * 7; }
    if (p.y > H) this.die();
  }
  die() { this.dead = 0.9; this.burst(this.p.x + 11, this.p.y + 11, this.col(0), 22, 260); }
  draw(c) {
    this.clear(c);
    c.fillStyle = this.pal.c[5]; c.globalAlpha = 0.25;
    for (const h of this.hills) { c.beginPath(); c.moveTo(h.x - 60, this.ground); c.quadraticCurveTo(h.x + 35, this.ground - h.h * 2, h.x + 130, this.ground); c.fill(); }
    c.globalAlpha = 1;
    c.fillStyle = this.pal.c[2];
    let x = -10;
    for (const g of [...this.gaps].sort((a, b) => a.x - b.x)) { c.fillRect(x, this.ground, g.x - x, H - this.ground); x = g.x + g.w; }
    c.fillRect(x, this.ground, W - x + 10, H - this.ground);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, this.ground + 6, W, 3);
    for (const o of this.obs) {
      c.fillStyle = o.type === 'spike' ? this.col(3) : this.col(1);
      if (o.type === 'spike') { const e = this.skin.pick('spike', 'enemy', 'meteor'); if (!drawFit(c, e, o.x + o.w / 2, this.ground - o.h / 2, o.w * 1.2, o.h * 1.2)) { c.beginPath(); c.moveTo(o.x, this.ground); c.lineTo(o.x + o.w / 2, this.ground - o.h); c.lineTo(o.x + o.w, this.ground); c.fill(); } }
      else { roundRect(c, o.x, this.ground - o.h, o.w, o.h, 3); c.fill(); const t = this.skin.pick('blk', 'block', 'tile'); if (t) { c.save(); c.clip(); drawRectImg(c, t, o.x, this.ground - o.h, o.w, o.h, true); c.restore(); } }
    }
    if (!this.dead) {
      const p = this.p;
      c.save(); c.translate(p.x + p.s / 2, p.y + p.s / 2); c.rotate(p.rot);
      const hero = this.skin.pick('hero', 'char', 'animal');
      if (!drawFit(c, hero, 0, 0, p.s * 1.5, p.s * 1.5)) { c.fillStyle = this.col(0); roundRect(c, -p.s / 2, -p.s / 2, p.s, p.s, 4); c.fill(); c.fillStyle = this.pal.bg; c.fillRect(2, -5, 4, 4); }
      c.restore();
    }
  }
}

// ================================================================ Flap
class Flap extends Game {
  setup() { this.gapH = this.r(120, 150); this.reset(); }
  reset() { this.b = { x: 100, y: H / 2, vy: 0, r: 11 }; this.pipes = []; this.nextX = W + 40; this.dead = 0; this.score = 0; this.speed = 140; }
  flap() { if (!this.dead) this.b.vy = -360; }
  autopilot() {
    const b = this.b;
    const p = this.pipes.find((p) => p.x + 54 > b.x - b.r);
    const target = p ? p.gap + this.gapH / 2 + 8 : H / 2;
    if (b.y > target && b.vy > -40) this.flap();
  }
  down() { this.flap(); }
  step(dt) {
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    const b = this.b;
    b.vy += 1250 * this.G * dt; b.y += b.vy * dt;
    for (const p of this.pipes) { p.x -= this.speed * dt; if (!p.passed && p.x + 54 < b.x) { p.passed = true; this.score++; } }
    this.nextX -= this.speed * dt;
    if (this.nextX < W) { this.pipes.push({ x: this.nextX + 60, gap: this.r(60, H - 80 - this.gapH) }); this.nextX += this.r(180, 220); }
    this.pipes = this.pipes.filter((p) => p.x > -60);
    if (b.y + b.r > H - 20 || b.y - b.r < 0) return this.die();
    for (const p of this.pipes) {
      const top = { x: p.x, y: -10, w: 54, h: p.gap + 10 }, bot = { x: p.x, y: p.gap + this.gapH, w: 54, h: H };
      const t = { ...b };
      if (circleRect(t, top) || circleRect(t, bot)) return this.die();
    }
  }
  die() { this.dead = 0.8; this.burst(this.b.x, this.b.y, this.col(0), 18); }
  draw(c) {
    this.clear(c);
    for (const p of this.pipes) {
      c.fillStyle = this.col(2); roundRect(c, p.x, -10, 54, p.gap + 10, 6); c.fill(); roundRect(c, p.x, p.gap + this.gapH, 54, H, 6); c.fill();
      const pt = this.skin.pick('pipe', 'tile', 'block');
      if (pt) { c.globalAlpha = 0.6; drawRectImg(c, pt, p.x, -10, 54, p.gap + 10, true); drawRectImg(c, pt, p.x, p.gap + this.gapH, 54, H, true); c.globalAlpha = 1; }
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(p.x + 8, -10, 6, p.gap + 10); c.fillRect(p.x + 8, p.gap + this.gapH, 6, H);
    }
    c.fillStyle = this.col(1); c.fillRect(0, H - 20, W, 20);
    if (!this.dead) {
      const b = this.b;
      c.save(); c.translate(b.x, b.y); c.rotate(Math.max(-0.5, Math.min(1.2, b.vy / 500)));
      if (!drawFit(c, this.skin.pick('bird', 'animal', 'enemy', 'ship'), 0, 0, b.r * 3 * this.S, b.r * 3 * this.S)) {
        c.fillStyle = this.col(0); c.beginPath(); c.arc(0, 0, b.r, 0, 7); c.fill();
        c.fillStyle = this.pal.ink; c.beginPath(); c.arc(4, -3, 3.5, 0, 7); c.fill();
        c.fillStyle = this.pal.bg; c.beginPath(); c.arc(5, -3, 1.6, 0, 7); c.fill();
        c.fillStyle = this.col(1); c.beginPath(); c.moveTo(9, 0); c.lineTo(16, 2); c.lineTo(9, 4); c.fill();
      }
      c.restore();
    }
  }
}

// ================================================================ Stacker
class Stacker extends Game {
  setup() { this.reset(); }
  reset() {
    this.stack = [{ x: W / 2 - 100, w: 200, y: H - 40 }];
    this.debris = []; this.cam = 0; this.score = 0; this.dir = 1; this.newBlock(); this.over = 0;
  }
  newBlock() {
    const top = this.stack[this.stack.length - 1];
    this.mov = { x: this.dir > 0 ? -top.w : W, w: top.w, y: top.y - 22 };
    this.mspeed = 140 + Math.min(220, this.stack.length * 7);
    this.tol = this.r(0, 1) < 0.25 ? this.r(6, 24) : this.r(0, 5);
  }
  place() {
    if (this.over) return;
    const top = this.stack[this.stack.length - 1], m = this.mov;
    let x0 = Math.max(top.x, m.x), x1 = Math.min(top.x + top.w, m.x + m.w);
    if (Math.abs(m.x - top.x) < 4) { x0 = top.x; x1 = top.x + top.w; this.burst(top.x + top.w / 2, m.y + 11, this.col(0), 16); this.score += 2; }
    if (x1 - x0 <= 2) { this.debris.push({ x: m.x, y: m.y, w: m.w, vy: 0, vx: 0, rot: 0, vr: this.r(-2, 2), c: this.colFor(this.stack.length) }); this.over = 1.2; return; }
    if (m.x < x0) this.debris.push({ x: m.x, y: m.y, w: x0 - m.x, vy: 0, vx: -40, rot: 0, vr: -2, c: this.colFor(this.stack.length) });
    if (m.x + m.w > x1) this.debris.push({ x: x1, y: m.y, w: m.x + m.w - x1, vy: 0, vx: 40, rot: 0, vr: 2, c: this.colFor(this.stack.length) });
    this.stack.push({ x: x0, w: x1 - x0, y: m.y });
    this.score++;
    this.dir = -this.dir;
    this.newBlock();
  }
  colFor(i) { return this.col(Math.floor(i / 3)); }
  autopilot() {
    const top = this.stack[this.stack.length - 1];
    if (Math.abs(this.mov.x - top.x) <= this.tol + 1 && !this.over) this.place();
  }
  down() { this.place(); }
  step(dt) {
    if (this.over) { this.over -= dt; if (this.over <= 0) this.reset(); }
    const m = this.mov;
    if (!this.over) { m.x += this.dir * this.mspeed * dt; if (m.x > W) this.dir = -1; if (m.x + m.w < 0) this.dir = 1; }
    for (const d of this.debris) { d.vy += 900 * this.G * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.rot += d.vr * dt; }
    this.debris = this.debris.filter((d) => d.y - this.cam < H + 100);
    const targetCam = Math.min(0, this.stack[this.stack.length - 1].y - H * 0.55);
    this.cam += (targetCam - this.cam) * Math.min(1, dt * 4);
  }
  draw(c) {
    this.clear(c);
    c.save(); c.translate(0, -this.cam);
    const tex = this.skin.pick('stk', 'tile', 'block');
    this.stack.forEach((s, i) => { c.fillStyle = this.colFor(i); c.fillRect(s.x, s.y, s.w, 22); if (tex) { c.globalAlpha = 0.45; drawRectImg(c, tex, s.x, s.y, s.w, 22, true); c.globalAlpha = 1; } c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(s.x, s.y + 18, s.w, 4); });
    if (!this.over) { c.fillStyle = this.colFor(this.stack.length); c.fillRect(this.mov.x, this.mov.y, this.mov.w, 22); }
    for (const d of this.debris) { c.save(); c.translate(d.x + d.w / 2, d.y + 11); c.rotate(d.rot); c.fillStyle = d.c; c.fillRect(-d.w / 2, -11, d.w, 22); c.restore(); }
    c.restore();
  }
}

// ================================================================ Pong (vertical)
class Pong extends Game {
  setup() {
    this.top = { x: W / 2, w: 70, err: 0 }; this.bot = { x: W / 2, w: 70, err: 0 };
    this.pts = [0, 0];
    this.serve(1);
  }
  serve(dir) {
    const a = (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + this.r(-0.6, 0.6);
    this.speed = 260;
    this.b = { x: W / 2, y: H / 2, r: 7, vx: Math.cos(a) * this.speed, vy: Math.sin(a) * this.speed, wait: 0.6 };
  }
  track(p, dt, toward, skill) {
    if (toward && Math.random() < dt * 2) p.err = this.r(-1, 1) * p.w * (1 - skill);
    const target = toward ? this.b.x + p.err : W / 2;
    const d = target - p.x;
    p.x += Math.sign(d) * Math.min(Math.abs(d), (180 + skill * 220) * dt);
  }
  autopilot(dt) { this.track(this.bot, dt, this.b.vy > 0, 0.72); }
  down(x) { this.bot.x = x; }
  move(x) { if (!this.auto) this.bot.x = x; }
  step(dt) {
    const b = this.b;
    this.track(this.top, dt, b.vy < 0, 0.62);
    [this.top, this.bot].forEach((p) => (p.x = Math.max(p.w / 2, Math.min(W - p.w / 2, p.x))));
    if (b.wait > 0) { b.wait -= dt; return; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    walls(b, 0, W, null, null, 1);
    const hit = (p, y, dir) => {
      if (Math.sign(b.vy) === dir && Math.abs(b.y - y) < b.r + 5 && Math.abs(b.x - p.x) < p.w / 2 + b.r) {
        const off = (b.x - p.x) / (p.w / 2);
        this.speed = Math.min(620, this.speed + 18);
        const a = (dir > 0 ? -Math.PI / 2 : Math.PI / 2) + off * 0.9 * (dir > 0 ? 1 : -1);
        b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed;
        this.burst(b.x, b.y, this.col(0), 6, 90);
        this.score++;
      }
    };
    hit(this.top, 30, -1); hit(this.bot, H - 30, 1);
    if (b.y < -20) { this.pts[1]++; this.serve(-1); }
    if (b.y > H + 20) { this.pts[0]++; this.serve(1); }
  }
  hud() { return `${this.pts[0]} : ${this.pts[1]}`; }
  draw(c) {
    this.clear(c);
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke(); c.setLineDash([]);
    this.text(c, String(this.pts[0]), W - 24, H / 2 - 24, 22, 'rgba(255,255,255,.2)');
    this.text(c, String(this.pts[1]), W - 24, H / 2 + 24, 22, 'rgba(255,255,255,.2)');
    c.fillStyle = this.col(3); roundRect(c, this.top.x - this.top.w / 2, 20, this.top.w, 10, 5); c.fill();
    c.fillStyle = this.col(0); roundRect(c, this.bot.x - this.bot.w / 2, H - 30, this.bot.w, 10, 5); c.fill();
    this.orb(c, this.skin.pick('pb', 'ball', 'animal', 'item'), this.b.x, this.b.y, this.b.r * this.S, this.pal.ink, this.t * 3);
  }
}

// ================================================================ Peg Shot (Peggle-like)
class PegShot extends Game {
  setup() { this.level(); }
  level() {
    this.pegs = [];
    const kind = this.ri(0, 4);
    const add = (x, y) => { if (x > 16 && x < W - 16 && y > 80 && y < H - 60 && !this.pegs.some((p) => Math.hypot(p.x - x, p.y - y) < 18)) this.pegs.push({ x, y, r: 6, lit: false, gone: 0 }); };
    if (kind === 0) for (let r = 0; r < 6; r++) for (let k = 0; k < 9; k++) add(28 + k * 38 + (r % 2) * 19, 110 + r * 42);
    if (kind === 1) for (let a = 0; a < 3; a++) for (let i = 0; i < 16; i++) { const t = (i / 15) * Math.PI; add(W / 2 + Math.cos(t) * (60 + a * 50), 130 + Math.sin(t) * (60 + a * 50)); }
    if (kind === 2) for (let i = 0; i < 70; i++) { const t = i * 0.35, rr = 8 + i * 2.2; add(W / 2 + Math.cos(t) * rr, 220 + Math.sin(t) * rr * 0.9); }
    if (kind === 3) for (let i = 0; i < 60; i++) add(this.r(20, W - 20), this.r(100, H - 70));
    if (kind === 4) for (let r = 0; r < 7; r++) for (let k = 0; k < 10; k++) add(20 + k * 36, 100 + r * 38 + Math.sin(k * 0.8 + r) * 14);
    const n = Math.max(6, Math.round(this.pegs.length * 0.25));
    shuffleWith(this.pegs, this.rng).slice(0, n).forEach((p) => (p.target = true));
    this.shots = 10; this.ball = null; this.angle = Math.PI / 2; this.aimT = 1; this.bucket = { x: W / 2, dir: 1 };
  }
  fire() {
    if (this.ball || this.shots <= 0) return;
    this.ball = { x: W / 2 + Math.cos(this.angle) * 26, y: 34 + Math.sin(this.angle) * 26, vx: Math.cos(this.angle) * 430, vy: Math.sin(this.angle) * 430, r: 6, hits: 0 };
    this.shots--;
  }
  aimAt(x, y) { this.angle = Math.max(0.15, Math.min(Math.PI - 0.15, Math.atan2(y - 34, x - W / 2))); }
  autopilot(dt) {
    if (this.ball) return;
    if (!this.goal) {
      const t = this.pegs.filter((p) => p.target && !p.lit);
      const g = t.length ? t[this.ri(0, t.length - 1)] : this.pegs[0];
      this.goal = g ? Math.max(0.15, Math.min(Math.PI - 0.15, Math.atan2(g.y - 34 - 40, g.x - W / 2) + this.r(-0.08, 0.08))) : Math.PI / 2;
      this.aimT = this.r(0.5, 1.1);
    }
    this.angle += (this.goal - this.angle) * Math.min(1, dt * 5);
    this.aimT -= dt;
    if (this.aimT <= 0) { this.fire(); this.goal = null; }
  }
  down(x, y) { this.aimAt(x, y); }
  move(x, y) { this.aimAt(x, y); }
  up(x, y) { this.aimAt(x, y); this.fire(); }
  step(dt) {
    const bk = this.bucket;
    bk.x += bk.dir * 90 * dt; if (bk.x > W - 40) bk.dir = -1; if (bk.x < 40) bk.dir = 1;
    this.pegs.forEach((p) => p.gone && (p.gone -= dt));
    this.pegs = this.pegs.filter((p) => p.gone === 0 || p.gone > 0);
    const b = this.ball;
    if (!b) { if (this.shots <= 0 || !this.pegs.some((p) => p.target)) { this.score += this.shots * 50; this.level(); } return; }
    b.vy += 480 * this.G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    walls(b, 0, W, 0, null, 0.9);
    for (const p of this.pegs) if (!p.gone && circlePeg(b, p, 0.78)) { if (!p.lit) { p.lit = true; b.hits++; this.score += p.target ? 100 : 10; } }
    if (b.y > H - 18 && Math.abs(b.x - bk.x) < 34) { this.shots++; this.burst(b.x, b.y, this.col(1), 16); this.ball = null; this.clearLit(); return; }
    if (b.y > H + 10) { this.ball = null; this.clearLit(); }
  }
  clearLit() { this.pegs.forEach((p) => { if (p.lit && !p.gone) { p.gone = 0.25; this.burst(p.x, p.y, p.target ? this.col(0) : this.col(5), 5, 80); } }); }
  hud() { return `${this.score} · ${this.shots} balls`; }
  draw(c) {
    this.clear(c);
    for (const p of this.pegs) {
      c.fillStyle = p.target ? this.col(0) : this.col(5);
      c.globalAlpha = p.gone ? Math.max(0, p.gone * 4) : 1;
      const pi = p.target ? this.skin.pick('tgt', 'item', 'enemy') : null;
      if (!pi || !drawFit(c, pi, p.x, p.y, 17, 17)) { c.beginPath(); c.arc(p.x, p.y, p.r + (p.lit ? 1.5 : 0), 0, 7); c.fill(); }
      if (p.lit) { c.strokeStyle = this.pal.ink; c.lineWidth = 2; c.stroke(); }
    }
    c.globalAlpha = 1;
    if (!this.ball && !this.auto) {
      let x = W / 2 + Math.cos(this.angle) * 26, y = 34 + Math.sin(this.angle) * 26, vx = Math.cos(this.angle) * 430, vy = Math.sin(this.angle) * 430;
      c.fillStyle = 'rgba(255,255,255,.3)';
      for (let i = 0; i < 26; i++) { for (let k = 0; k < 4; k++) { vy += 480 / 120; x += vx / 120; y += vy / 120; } c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); }
    }
    c.save(); c.translate(W / 2, 34); c.rotate(this.angle);
    c.fillStyle = this.col(1); roundRect(c, 0, -7, 30, 14, 5); c.fill(); c.restore();
    c.fillStyle = this.col(2); c.beginPath(); c.arc(W / 2, 34, 14, 0, 7); c.fill();
    c.fillStyle = this.col(1); c.globalAlpha = 0.8; roundRect(c, this.bucket.x - 34, H - 16, 68, 14, 6); c.fill(); c.globalAlpha = 1;
    if (this.ball) this.orb(c, this.skin.pick('shot', 'ball', 'item', 'animal'), this.ball.x, this.ball.y, this.ball.r * this.S, this.pal.ink, this.t * 5);
  }
}
function shuffleWith(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ================================================================ Bounce Golf (top-down)
class Golf extends Game {
  setup() { this.strokes = 0; this.hole = 0; this.course(); }
  course() {
    this.rects = [];
    const n = this.ri(2, 5);
    for (let i = 0; i < n; i++) {
      const horiz = this.rng() < 0.5;
      this.rects.push({ x: this.r(30, W - 130), y: this.r(90, H - 140), w: horiz ? this.r(80, 160) : 16, h: horiz ? 16 : this.r(80, 160) });
    }
    this.bumpers = Array.from({ length: this.ri(0, 3) }, () => ({ x: this.r(50, W - 50), y: this.r(100, H - 100), r: this.r(12, 20) }));
    this.sand = this.rng() < 0.6 ? { x: this.r(20, W - 120), y: this.r(60, H - 160), w: this.r(70, 120), h: this.r(50, 90) } : null;
    const free = (x, y, pad) => !this.rects.some((r) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) && !this.bumpers.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + pad);
    do { this.cup = { x: this.r(40, W - 40), y: this.r(50, 160), r: 11 }; } while (!free(this.cup.x, this.cup.y, 20));
    do { this.ball = { x: this.r(40, W - 40), y: this.r(H - 110, H - 40), vx: 0, vy: 0, r: 6 }; } while (!free(this.ball.x, this.ball.y, 14));
    this.sunk = 0; this.think = 0.7; this.drag = null;
  }
  moving() { return Math.hypot(this.ball.vx, this.ball.vy) > 4; }
  physics(b, dt) {
    const inSand = this.sand && b.x > this.sand.x && b.x < this.sand.x + this.sand.w && b.y > this.sand.y && b.y < this.sand.y + this.sand.h;
    const sp = Math.hypot(b.vx, b.vy);
    const dec = (inSand ? 520 : 150) * dt;
    if (sp <= dec) { b.vx = b.vy = 0; } else { b.vx -= (b.vx / sp) * dec; b.vy -= (b.vy / sp) * dec; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    walls(b, 10, W - 10, 10, H - 10, 0.8);
    for (const r of this.rects) { const n = circleRect(b, r); if (n) reflect(b, n, 0.8); }
    for (const p of this.bumpers) circlePeg(b, p, 1.15);
    const d = Math.hypot(b.x - this.cup.x, b.y - this.cup.y);
    return d < this.cup.r && Math.hypot(b.vx, b.vy) < 280;
  }
  shoot(vx, vy) { this.ball.vx = vx; this.ball.vy = vy; this.strokes++; }
  plan() {
    let best = null;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      for (const p of [220, 340, 480, 620]) {
        const b = { x: this.ball.x, y: this.ball.y, vx: Math.cos(a) * p, vy: Math.sin(a) * p, r: 6 };
        let score = 1e9;
        for (let s = 0; s < 360; s++) {
          if (this.physics(b, 1 / 60)) { score = -1000 + s; break; }
          const d = Math.hypot(b.x - this.cup.x, b.y - this.cup.y);
          if (b.vx === 0 && b.vy === 0) { score = d; break; }
          score = d;
        }
        if (!best || score < best.score) best = { score, vx: Math.cos(a) * p, vy: Math.sin(a) * p };
      }
    }
    return best;
  }
  autopilot(dt) {
    if (this.moving() || this.sunk) return;
    this.think -= dt;
    if (this.think > 0) return;
    const p = this.plan();
    const noise = this.r(0.9, 1.08), rot = this.r(-0.05, 0.05);
    this.shoot((p.vx * Math.cos(rot) - p.vy * Math.sin(rot)) * noise, (p.vx * Math.sin(rot) + p.vy * Math.cos(rot)) * noise);
    this.think = this.r(1.1, 2);
  }
  down(x, y) { if (!this.moving()) this.drag = { x, y }; }
  move(x, y) { if (this.drag) this.drag.cx = x, this.drag.cy = y; }
  up(x, y) {
    if (!this.drag) return;
    const dx = this.drag.x - x, dy = this.drag.y - y;
    const k = 4.2, max = 700;
    let vx = dx * k, vy = dy * k;
    const s = Math.hypot(vx, vy);
    if (s > max) { vx *= max / s; vy *= max / s; }
    if (s > 30) this.shoot(vx, vy);
    this.drag = null;
  }
  tap() {}
  step(dt) {
    if (this.sunk) { this.sunk -= dt; if (this.sunk <= 0) { this.hole++; this.course(); } return; }
    if (this.physics(this.ball, dt)) { this.sunk = 1; this.score += Math.max(1, 5 - this.strokes) * 10; this.strokes = 0; this.burst(this.cup.x, this.cup.y, this.col(0), 24); this.ball.vx = this.ball.vy = 0; }
  }
  hud() { return `hole ${this.hole + 1} · ${this.strokes} strokes`; }
  draw(c) {
    c.fillStyle = '#2e3a22'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#35432a'; for (let y = 0; y < H; y += 28) c.fillRect(0, y, W, 14);
    if (this.sand) { c.fillStyle = '#b89a62'; roundRect(c, this.sand.x, this.sand.y, this.sand.w, this.sand.h, 20); c.fill(); }
    c.strokeStyle = this.col(1); c.lineWidth = 6; c.strokeRect(7, 7, W - 14, H - 14);
    c.fillStyle = this.col(3); const gw = this.skin.pick('gwall', 'tile', 'block'); for (const r of this.rects) { roundRect(c, r.x, r.y, r.w, r.h, 4); c.fill(); if (gw) { c.save(); c.clip(); drawRectImg(c, gw, r.x, r.y, r.w, r.h, true); c.restore(); } }
    for (const b of this.bumpers) { if (!drawFit(c, this.skin.pick(`bump${b.r | 0}`, 'item', 'enemy', 'animal'), b.x, b.y, b.r * 2.2, b.r * 2.2)) { c.fillStyle = this.col(0); c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.5, 0, 7); c.fill(); } }
    c.fillStyle = '#0b0a08'; c.beginPath(); c.arc(this.cup.x, this.cup.y, this.cup.r, 0, 7); c.fill();
    c.strokeStyle = this.pal.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(this.cup.x, this.cup.y); c.lineTo(this.cup.x, this.cup.y - 34); c.stroke();
    c.fillStyle = this.col(0); c.beginPath(); c.moveTo(this.cup.x, this.cup.y - 34); c.lineTo(this.cup.x + 18, this.cup.y - 28); c.lineTo(this.cup.x, this.cup.y - 22); c.fill();
    if (this.drag && this.drag.cx != null) {
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(this.ball.x, this.ball.y);
      c.lineTo(this.ball.x + (this.drag.x - this.drag.cx) * 0.6, this.ball.y + (this.drag.y - this.drag.cy) * 0.6); c.stroke(); c.setLineDash([]);
    }
    if (!this.sunk) { c.fillStyle = '#fff'; c.beginPath(); c.arc(this.ball.x, this.ball.y, this.ball.r, 0, 7); c.fill(); }
  }
}

// ================================================================ Juggle
class Juggle extends Game {
  setup() { this.reset(); }
  reset() { this.balls = [this.mk()]; this.score = 0; this.drops = 0; }
  mk() { return { i: this.skin.any('ball', 'animal', 'item', 'enemy'), x: this.r(80, W - 80), y: this.r(60, 140), vx: this.r(-60, 60), vy: 0, r: 22 * this.S, spin: 0, c1: this.col(this.ri(0, 5)), c2: this.col(this.ri(0, 5)), cd: 0 }; }
  kick(b, x) { b.vy = -560 - this.r(0, 60); b.vx += (b.x - x) * 7; b.spin += (b.x - x) * 0.2; b.cd = 0.15; this.score++; this.burst(b.x, b.y + b.r, b.c1, 6, 100); if (this.score % 15 === 0 && this.balls.length < 4) this.balls.push(this.mk()); }
  autopilot() {
    for (const b of this.balls) if (b.vy > 0 && b.y > H * 0.66 && b.cd <= 0) this.kick(b, b.x + this.r(-9, 9));
  }
  down(x, y) {
    const b = this.balls.filter((b) => b.cd <= 0).sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y))[0];
    if (b && Math.hypot(b.x - x, b.y - y) < b.r + 45) this.kick(b, x);
  }
  step(dt) {
    for (const b of this.balls) {
      b.cd -= dt; b.vy += 720 * this.G * dt; b.vx *= 0.999; b.x += b.vx * dt; b.y += b.vy * dt; b.spin *= 0.99;
      walls(b, 0, W, 0, null, 0.8);
      if (b.y - b.r > H) { b.dead = true; this.drops++; }
    }
    this.balls = this.balls.filter((b) => !b.dead);
    if (!this.balls.length) this.reset();
    this.ang = (this.ang || 0) + dt;
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, H * 0.66, W, 2);
    for (const b of this.balls) {
      if (drawFit(c, b.i, b.x, b.y, b.r * 2.2, b.r * 2.2, (this.ang || 0) * b.spin * 0.1 + b.x * 0.02)) continue;
      c.save(); c.translate(b.x, b.y); c.rotate((this.ang || 0) * b.spin * 0.1 + b.x * 0.02);
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? b.c1 : b.c2; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, b.r, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3); c.fill(); }
      c.fillStyle = this.pal.ink; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
      c.restore();
    }
  }
}

export const GAMES = { plinko: Plinko, breakout: Breakout, merge: Merge, dash: Dash, flappy: Flap, stacker: Stacker, pong: Pong, peggle: PegShot, golf: Golf, juggle: Juggle, platformer: Platformer, racer: Racer, raycast: Doom, rocks: Rocks, sling: Sling,
  necro: Necro, chess: Chess, dice: Dice, cards: Cards, monsters: Monsters, fighter: Fighter,
  starfox: Flight, ski: Ski, robotron: Robotron, crokinole: Crokinole, survivors: Survivors, graves: Graves, mystery: Mystery,
  wordle: Wordle, bee: Bee, wordsearch: WordSearch, wheel: Wheel, hangman: Hangman, vocab: Vocab, ladder: Ladder, t2048: Twenty48, arrows: Arrows };
export const GAME_HINT = {
  plinko: 'tap to drop a ball', breakout: 'drag to move the paddle', merge: 'drag to aim, release to drop', dash: 'tap to jump (twice to double-jump)',
  flappy: 'tap to flap', stacker: 'tap to drop the block', pong: 'drag to move your paddle', peggle: 'aim, release to shoot', golf: 'drag back from anywhere, release to putt', juggle: 'tap the balls to keep them up',
  platformer: 'tap to jump, twice to double-jump, stomp enemies', racer: 'hold left or right to steer', raycast: 'drag sideways to turn, up/down to walk, tap to fire, tap the HUD to switch weapons',
  rocks: 'tap to shoot, hold to thrust toward your finger', sling: 'drag down and release to fire upward',
  necro: 'summon skulls, drag matching undead together to merge', chess: 'tap a white piece, then its destination', dice: 'roll, tap dice to hold, tap a row to score',
  cards: 'tap up to five cards, then play or discard', monsters: 'tap a move', fighter: 'buttons: ◀ ▶ jump, punch, kick, special · hold away to block',
  starfox: 'hold and drag to steer, lasers fire while you hold · fly through rings',
  ski: 'tap to jump, hold in the air to backflip, land along the slope',
  robotron: 'left thumb moves, right thumb shoots (one thumb auto-aims) · rescue the humans',
  crokinole: 'touch near the bottom arc to place, drag back and release to flick · hit their discs or lose yours',
  survivors: 'drag anywhere to walk · weapons fire by themselves · tap an upgrade on level up',
  graves: 'tap a grave to raise, drag two alike together to merge, drag or tap to fill orders',
  mystery: 'tap to walk, tap people to question them and furniture to search · accuse when you know',
  wordle: 'type a five-letter word, six tries', bee: 'tap letters to make words with the centre letter', wordsearch: 'drag across letters to circle a word',
  wheel: 'drag through the letters to spell words', hangman: 'tap letters; the clue is the definition', vocab: 'tap the right meaning before time runs out', ladder: 'change one letter at a time to reach the target word',
  t2048: 'swipe to slide the tiles; matching numbers merge', arrows: 'tap an arrow to send it flying; if something is in its way you lose a heart'
};
