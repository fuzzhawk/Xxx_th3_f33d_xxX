import { Game, W, H, circleRect, reflect, roundRect, drawFit, drawRectImg, ready } from './engine.js';

// ================================================================ Platformer
export class Platformer extends Game {
  setup() { this.reset(); }
  reset() {
    this.p = { x: 60, y: 200, w: 20, h: 26, vy: 0, on: false, jumps: 0, face: 1 };
    this.camX = 0; this.plats = []; this.coins = []; this.foes = []; this.genX = 0; this.dead = 0; this.score = 0; this.coinsGot = 0;
    this.speed = 150 * this.S ** 0.3;
    this.plat(0, 320, 300);
    while (this.genX < W * 2) this.chunk();
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
  jump() { const p = this.p; if (this.dead) return; const v = 560 * Math.sqrt(this.G); if (p.on) { p.vy = -v; p.on = false; p.jumps = 1; } else if (p.jumps < 2) { p.vy = -v * 0.85; p.jumps = 2; } }
  autopilot() {
    const p = this.p;
    if (!p.on) { if (p.vy > 50 && p.jumps === 1 && !this.ground(p.x + 30, p.x + 30 + p.w, p.y + p.h + 200, p.y + p.h)) this.jump(); return; }
    const ahead = p.x + p.w + 14;
    const under = this.plats.some((pl) => !pl.float && ahead > pl.x && ahead < pl.x + pl.w && Math.abs(pl.y - (p.y + p.h)) < 4);
    const foe = this.foes.find((f) => !f.dead && f.x > p.x && f.x - p.x < 70 && Math.abs(f.y + f.h - (p.y + p.h)) < 10);
    const up = this.plats.find((pl) => pl.y < p.y && pl.x - p.x < 60 && pl.x - p.x > 0 && p.y - pl.y < 110);
    if (!under || foe || (up && this.rng() < 0.03)) this.jump();
  }
  down() { this.jump(); }
  step(dt) {
    const p = this.p;
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    p.x += this.speed * dt; this.score = Math.floor(p.x / 10) + this.coinsGot * 25;
    const prevB = p.y + p.h;
    p.vy += 1500 * this.G * dt; p.y += p.vy * dt;
    const g = p.vy >= 0 ? this.ground(p.x, p.x + p.w, p.y + p.h, prevB) : null;
    if (g) { p.y = g.y - p.h; p.vy = 0; p.on = true; p.jumps = 0; } else p.on = false;
    if (p.y > H + 60) return this.die();
    for (const c of this.coins) if (!c.got && Math.abs(c.x - (p.x + p.w / 2)) < 16 && Math.abs(c.y - (p.y + p.h / 2)) < 20) { c.got = true; this.coinsGot++; this.burst(c.x, c.y, this.col(1), 6, 90); }
    for (const f of this.foes) {
      if (f.dead) continue;
      f.x += f.dir * 40 * dt; if (f.x < f.min || f.x > f.max) f.dir *= -1;
      if (p.x + p.w > f.x && p.x < f.x + f.w && p.y + p.h > f.y && p.y < f.y + f.h) {
        if (p.vy > 0 && prevB <= f.y + 8) { f.dead = true; p.vy = -420 * Math.sqrt(this.G); this.coinsGot += 2; this.burst(f.x + 11, f.y + 11, this.col(3), 14); }
        else return this.die();
      }
    }
    this.camX += (p.x - 110 - this.camX) * Math.min(1, dt * 6);
    while (this.genX < this.camX + W * 2) this.chunk();
    this.plats = this.plats.filter((pl) => pl.x + pl.w > this.camX - 60);
    this.coins = this.coins.filter((c) => c.x > this.camX - 40 && !c.got);
    this.foes = this.foes.filter((f) => f.x > this.camX - 60);
  }
  die() { this.dead = 1; this.burst(this.p.x - this.camX + 10, Math.min(H - 10, this.p.y), this.col(0), 24, 240); }
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
    if (!this.dead) {
      const p = this.p;
      const hero = this.skin.people[0], frame = !p.on ? hero.jump : hero.walk[Math.floor(this.t * 10) % 2];
      if (!drawFit(c, frame, p.x + p.w / 2, p.y + p.h / 2 - 3, 36 * this.S, 40 * this.S)) { c.fillStyle = this.col(0); roundRect(c, p.x, p.y, p.w, p.h, 5); c.fill(); }
    }
    c.restore();
  }
  hud() { return `${this.score} · ◎${this.coinsGot}`; }
}

// ================================================================ Retro racer (pseudo-3D road)
export class Racer extends Game {
  setup() {
    this.segLen = 200; this.roadW = 2000; this.camH = 1000; this.depth = 1 / Math.tan((100 / 2) * Math.PI / 180); this.drawN = 110;
    this.segs = [];
    let y = 0;
    while (this.segs.length < 700) {
      const n = this.ri(25, 90), curve = this.rng() < 0.3 ? 0 : this.r(-6, 6), hill = this.rng() < 0.4 ? 0 : this.r(-40, 40) * this.segLen / 10;
      const y0 = y;
      for (let i = 0; i < n; i++) {
        const t = i / n, ease = (1 - Math.cos(t * Math.PI)) / 2;
        const yy = y0 + hill * ease;
        this.segs.push({ i: this.segs.length, y1: this.segs.length ? this.segs[this.segs.length - 1].y2 : 0, y2: yy, curve: curve * Math.sin(t * Math.PI), sprites: [] });
      }
      y = y0 + hill;
    }
    // return to height 0 at the loop seam
    const last = this.segs[this.segs.length - 1].y2;
    const tail = 60;
    for (let i = 0; i < tail; i++) { const s = this.segs[this.segs.length - tail + i]; s.y2 -= last * ((i + 1) / tail); s.y1 = i ? this.segs[this.segs.length - tail + i - 1].y2 : s.y1; }
    this.len = this.segs.length * this.segLen;
    const roadside = Array.from({ length: 5 }, () => this.skin.any('road', 'deco', 'item', 'tile'));
    for (let i = 10; i < this.segs.length; i += this.ri(3, 9)) {
      const side = this.rng() < 0.5 ? -1 : 1;
      this.segs[i].sprites.push({ i: this.rng() < 0.25 ? this.skin.prop() : roadside[this.ri(0, 4)], off: side * this.r(1.15, 2.6), s: this.r(0.8, 1.6) });
    }
    this.cars = Array.from({ length: 16 }, () => ({ z: this.r(2000, this.len), off: this.r(-0.75, 0.75), speed: this.r(4000, 8000), i: this.skin.any('car', 'animal', 'prop') }));
    this.carImg = this.skin.vehicle('car');
    this.pos = 0; this.speed = 0; this.max = 12000 * (this.T > 1 ? 1.2 : 1); this.px = 0; this.steer = 0; this.target = 0; this.laps = 0;
    this.sky = [this.r(0, 360) | 0, this.rng() < 0.5];
  }
  seg(z) { return this.segs[Math.floor(z / this.segLen) % this.segs.length]; }
  autopilot() {
    const ahead = this.cars.filter((c) => { const d = (c.z - this.pos + this.len) % this.len; return d > 0 && d < 3500; });
    const block = ahead.find((c) => Math.abs(c.off - this.target) < 0.38);
    if (block) this.target = [-0.62, 0, 0.62].sort((a, b) => Math.abs(a - this.px) - Math.abs(b - this.px)).find((l) => !ahead.some((c) => Math.abs(c.off - l) < 0.38)) ?? this.target;
    const s = this.seg(this.pos + 1500);
    const want = this.target + s.curve * 0.05;
    this.steer = Math.max(-1, Math.min(1, (want - this.px) * 4));
  }
  down(x) { this.steer = x < W / 2 ? -1 : 1; }
  move(x) { if (this.pointer.down) this.steer = Math.max(-1, Math.min(1, (x - W / 2) / (W / 3))); }
  up() { this.steer = 0; }
  tap() {}
  step(dt) {
    const sp = this.speed / this.max;
    const offroad = Math.abs(this.px) > 1;
    this.speed += (offroad ? -6000 : 4000) * dt;
    this.speed = Math.max(0, Math.min(offroad ? this.max * 0.35 : this.max, this.speed));
    const before = this.pos;
    this.pos = (this.pos + this.speed * dt) % this.len;
    if (this.pos < before) this.laps++;
    this.score = Math.floor((this.laps * this.len + this.pos) / 1000);
    const s = this.seg(this.pos);
    this.px += this.steer * dt * 2.2 * sp - s.curve * sp * sp * dt * 0.33;
    this.px = Math.max(-2.2, Math.min(2.2, this.px));
    for (const car of this.cars) {
      car.z = (car.z + car.speed * dt) % this.len;
      const d = (car.z - this.pos + this.len) % this.len;
      if (d < 260 && d > 0 && Math.abs(car.off - this.px) < 0.3 && this.speed > car.speed) { this.speed = car.speed * 0.6; this.burst(W / 2, H - 50, this.col(0), 12); }
    }
  }
  project(z, y, camX, camY, camZ) {
    const sc = this.depth / (z - camZ);
    return { x: W / 2 - sc * camX * W / 2, y: H / 2 - sc * (y - camY) * H / 2, w: sc * this.roadW * W / 2, sc };
  }
  draw(c) {
    const [hue, night] = this.sky;
    const g = c.createLinearGradient(0, 0, 0, H / 2);
    g.addColorStop(0, night ? `hsl(${hue},45%,10%)` : `hsl(${hue},55%,45%)`); g.addColorStop(1, night ? `hsl(${hue + 40},55%,32%)` : `hsl(${hue + 30},75%,75%)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const base = this.seg(this.pos);
    const bp = (this.pos % this.segLen) / this.segLen;
    // distant sun + mountains, shifted by curvature
    c.fillStyle = night ? '#ffd2a0' : '#fff2c4'; c.beginPath(); c.arc(W * 0.7, H * 0.32, 26, 0, 7); c.fill();
    c.fillStyle = `hsl(${hue + 180},20%,${night ? 12 : 30}%)`;
    for (let i = -1; i < 8; i++) { const x = i * 70 - ((this.px * 30 + base.curve * 10 + this.pos * 0.0005) % 70); c.beginPath(); c.moveTo(x - 50, H / 2 + 6); c.lineTo(x + 10, H / 2 - 30 - (i * 37 % 25)); c.lineTo(x + 70, H / 2 + 6); c.fill(); }
    const camY = this.camH + base.y1 + (base.y2 - base.y1) * bp;
    let x = 0, dx = -(base.curve * bp), maxy = H;
    const drawn = [];
    for (let n = 0; n < this.drawN; n++) {
      const s = this.segs[(base.i + n) % this.segs.length];
      const loop = s.i < base.i ? this.len : 0;
      const z1 = s.i * this.segLen + loop, z2 = z1 + this.segLen;
      const p1 = this.project(z1, s.y1, this.px * this.roadW - x, camY, this.pos);
      const p2 = this.project(z2, s.y2, this.px * this.roadW - x - dx, camY, this.pos);
      x += dx; dx += s.curve;
      if (z1 - this.pos <= this.depth || p2.y >= p1.y || p2.y >= maxy) { drawn.push(null); continue; }
      const dark = Math.floor(s.i / 3) % 2;
      c.fillStyle = dark ? this.col(2) : this.pal.bg2; c.fillRect(0, p2.y, W, p1.y - p2.y + 1);
      const quad = (x1, y1, w1, x2, y2, w2, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x1 - w1, y1); c.lineTo(x2 - w2, y2); c.lineTo(x2 + w2, y2); c.lineTo(x1 + w1, y1); c.fill(); };
      quad(p1.x, p1.y, p1.w * 1.15, p2.x, p2.y, p2.w * 1.15, dark ? '#e8e2d6' : this.col(3));
      quad(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, dark ? '#3b3632' : '#433d38');
      if (dark) for (const l of [-1 / 3, 1 / 3]) quad(p1.x + p1.w * l * 2, p1.y, p1.w * 0.02, p2.x + p2.w * l * 2, p2.y, p2.w * 0.02, '#d8d0c0');
      maxy = p1.y;
      drawn.push({ s, p1, clip: maxy });
    }
    // sprites and cars, back to front
    for (let n = drawn.length - 1; n > 0; n--) {
      const d = drawn[n]; if (!d) continue;
      const { s, p1 } = d;
      for (const sp of s.sprites) {
        const w = p1.sc * 900 * sp.s * W / 2, sx = p1.x + p1.w * sp.off;
        if (w > 1.5) drawFit(c, sp.i, sx, p1.y - w / 2, w, w);
      }
      for (const car of this.cars) {
        if (Math.floor(car.z / this.segLen) % this.segs.length !== s.i) continue;
        const w = p1.sc * 700 * W / 2, sx = p1.x + p1.w * car.off;
        if (w > 1.5 && !drawFit(c, car.i, sx, p1.y - w * 0.4, w, w * 0.8)) { c.fillStyle = this.col(4); c.fillRect(sx - w / 2, p1.y - w * 0.5, w, w * 0.5); }
      }
    }
    // the player
    const bounce = Math.sin(this.t * 30) * (this.speed / this.max) * 1.5;
    const tilt = this.steer * 0.12;
    if (!drawFit(c, this.carImg, W / 2, H - 46 + bounce, 92 * this.S, 64 * this.S, tilt)) {
      c.save(); c.translate(W / 2, H - 40 + bounce); c.rotate(tilt);
      c.fillStyle = this.col(0); roundRect(c, -34, -18, 68, 30, 8); c.fill(); c.fillStyle = '#111'; c.fillRect(-30, 8, 14, 8); c.fillRect(16, 8, 14, 8);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-18, -14, 36, 10); c.restore();
    }
    this.text(c, `${Math.round(this.speed / 60)} km/h`, W - 50, H - 16, 12);
  }
  hud() { return `${this.score} km · lap ${this.laps + 1}`; }
}

// ================================================================ Raycaster shooter
export class Raycast extends Game {
  setup() { this.level = 0; this.newLevel(); }
  newLevel() {
    const N = 15;
    const m = Array.from({ length: N }, () => Array(N).fill(1));
    const stack = [[1, 1]]; m[1][1] = 0;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const opts = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => x + dx > 0 && x + dx < N - 1 && y + dy > 0 && y + dy < N - 1 && m[y + dy][x + dx] === 1);
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = opts[this.ri(0, opts.length - 1)];
      m[y + dy / 2][x + dx / 2] = 0; m[y + dy][x + dx] = 0; stack.push([x + dx, y + dy]);
    }
    for (let i = 0; i < 26; i++) { const x = this.ri(1, N - 2), y = this.ri(1, N - 2); if (m[y][x]) m[y][x] = 0; }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y][x]) m[y][x] = this.ri(1, 4);
    this.map = m; this.N = N;
    this.px = 1.5; this.py = 1.5; this.pa = 0; this.hp = 5; this.cool = 0; this.flash = 0; this.path = []; this.kills = this.kills || 0;
    this.tex = [0, 1, 2, 3].map((k) => this.makeTex(k));
    const free = [];
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) if (!m[y][x] && x + y > 6) free.push([x, y]);
    const pick = () => free.splice(this.ri(0, free.length - 1), 1)[0];
    this.foes = Array.from({ length: Math.min(free.length, 7 + this.level) }, () => { const [x, y] = pick(); return { x: x + 0.5, y: y + 0.5, hp: 2, i: this.skin.any('enemy', 'char', 'animal', 'prop'), hit: 0 }; });
    this.items = Array.from({ length: Math.min(free.length, 5) }, () => { const [x, y] = pick(); return { x: x + 0.5, y: y + 0.5, i: this.skin.any('item', 'prop'), item: true }; });
  }
  makeTex(k) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = this.col(k + 1); x.fillRect(0, 0, 64, 64);
    const t = this.skin.pick(`wall${k}`, 'tile', 'block', 'bg');
    const paint = () => {
      x.fillStyle = this.col(k + 1); x.fillRect(0, 0, 64, 64);
      if (ready(t)) { x.globalAlpha = 0.9; x.drawImage(t, 0, 0, 64, 64); x.globalAlpha = 1; }
      else { x.fillStyle = 'rgba(0,0,0,.25)'; for (let r = 0; r < 8; r++) for (let q = 0; q < 4; q++) x.fillRect(q * 16 + (r % 2) * 8, r * 8, 15, 1), x.fillRect(q * 16 + (r % 2) * 8, r * 8, 1, 7); }
      if (this.rng() < 0.3) { const pr = this.skin.prop(); if (ready(pr)) x.drawImage(pr, 16, 16, 32, 32); }
    };
    paint();
    if (t && !ready(t)) t.addEventListener('load', paint, { once: true });
    return cv;
  }
  cell(x, y) { const X = Math.floor(x), Y = Math.floor(y); return X < 0 || Y < 0 || X >= this.N || Y >= this.N ? 1 : this.map[Y][X]; }
  cast(a) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let mx = Math.floor(this.px), my = Math.floor(this.py);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let sdx = (dx < 0 ? this.px - mx : mx + 1 - this.px) * ddx, sdy = (dy < 0 ? this.py - my : my + 1 - this.py) * ddy, side = 0;
    for (let i = 0; i < 64; i++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
      const w = this.cell(mx + 0.5, my + 0.5);
      if (w) {
        const dist = side ? sdy - ddy : sdx - ddx;
        let hit = side ? this.px + dist * dx : this.py + dist * dy; hit -= Math.floor(hit);
        return { dist, side, hit, w };
      }
    }
    return { dist: 64, side: 0, hit: 0, w: 1 };
  }
  los(x, y) { const a = Math.atan2(y - this.py, x - this.px); return this.cast(a).dist >= Math.hypot(x - this.px, y - this.py) - 0.2; }
  angTo(x, y) { let d = Math.atan2(y - this.py, x - this.px) - this.pa; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  tryMove(f, dt) {
    const nx = this.px + Math.cos(this.pa) * f * dt, ny = this.py + Math.sin(this.pa) * f * dt, m = 0.22;
    if (!this.cell(nx + Math.sign(Math.cos(this.pa)) * m, this.py)) this.px = nx;
    if (!this.cell(this.px, ny + Math.sign(Math.sin(this.pa)) * m)) this.py = ny;
  }
  shoot() {
    if (this.cool > 0) return;
    this.cool = 0.35; this.flash = 0.08;
    let best = null;
    for (const f of this.foes) { if (f.hp <= 0) continue; const d = this.angTo(f.x, f.y), dist = Math.hypot(f.x - this.px, f.y - this.py); if (Math.abs(d) < 0.12 + 0.2 / dist && this.los(f.x, f.y) && (!best || dist < best.dist)) best = { f, dist }; }
    if (best) { best.f.hp--; best.f.hit = 0.15; if (best.f.hp <= 0) { this.kills++; this.score += 100; this.burst(W / 2, H / 2, this.col(0), 20, 200); } }
  }
  bfs(tx, ty) {
    const N = this.N, prev = new Map(), start = [Math.floor(this.px), Math.floor(this.py)], key = (x, y) => y * N + x;
    const q = [start]; prev.set(key(...start), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!this.map[ny]?.[nx] && !prev.has(key(nx, ny))) { prev.set(key(nx, ny), [x, y]); q.push([nx, ny]); } }
    }
    const path = []; let cur = [tx, ty];
    if (!prev.has(key(tx, ty))) return [];
    while (cur) { path.unshift(cur); cur = prev.get(key(...cur)); }
    return path.slice(1).map(([x, y]) => [x + 0.5, y + 0.5]);
  }
  autopilot(dt) {
    const alive = this.foes.filter((f) => f.hp > 0);
    const vis = alive.filter((f) => this.los(f.x, f.y)).sort((a, b) => Math.hypot(a.x - this.px, a.y - this.py) - Math.hypot(b.x - this.px, b.y - this.py))[0];
    if (vis) {
      const d = this.angTo(vis.x, vis.y);
      this.pa += Math.sign(d) * Math.min(Math.abs(d), 3.2 * dt);
      if (Math.abs(d) < 0.08) this.shoot();
      if (Math.hypot(vis.x - this.px, vis.y - this.py) > 2.5) this.tryMove(1.6, dt);
      this.path = [];
      return;
    }
    if (!this.path.length) {
      const goal = alive[this.ri(0, Math.max(0, alive.length - 1))] || this.items[0];
      if (goal) this.path = this.bfs(Math.floor(goal.x), Math.floor(goal.y));
    }
    const wp = this.path[0];
    if (!wp) return;
    const d = this.angTo(wp[0], wp[1]);
    this.pa += Math.sign(d) * Math.min(Math.abs(d), 3.5 * dt);
    if (Math.abs(d) < 0.5) this.tryMove(2, dt);
    if (Math.hypot(wp[0] - this.px, wp[1] - this.py) < 0.25) this.path.shift();
  }
  down(x, y) { this.drag = { x, y, t: this.t, moved: false }; }
  move(x) { if (!this.drag) return; const dx = x - this.drag.x; if (Math.abs(dx) > 3) this.drag.moved = true; this.pa += dx * 0.012; this.drag.x = x; }
  up() { if (this.drag && !this.drag.moved && this.t - this.drag.t < 0.3) this.shoot(); this.drag = null; }
  tap() { this.shoot(); }
  step(dt) {
    this.cool -= dt; this.flash -= dt;
    if (!this.auto && this.drag && this.t - this.drag.t > 0.25) this.tryMove(2.2, dt);
    for (const f of this.foes) {
      f.hit -= dt;
      if (f.hp <= 0) continue;
      const dist = Math.hypot(f.x - this.px, f.y - this.py);
      if (dist < 6 && dist > 0.7 && this.los(f.x, f.y)) {
        const a = Math.atan2(this.py - f.y, this.px - f.x), sp = 0.7 * this.T ** 0 * dt;
        const nx = f.x + Math.cos(a) * sp, ny = f.y + Math.sin(a) * sp;
        if (!this.cell(nx, ny)) { f.x = nx; f.y = ny; }
      }
      if (dist < 0.75 && this.rng() < dt * 1.2) { this.hp--; this.hurt = 0.2; if (this.hp <= 0) { this.score = Math.max(0, this.score - 200); this.newLevel(); return; } }
    }
    this.hurt = (this.hurt || 0) - dt;
    for (const it of this.items) if (!it.got && Math.hypot(it.x - this.px, it.y - this.py) < 0.5) { it.got = true; this.score += 25; this.hp = Math.min(5, this.hp + 1); }
    if (!this.foes.some((f) => f.hp > 0)) { this.level++; this.newLevel(); }
  }
  draw(c) {
    const fov = 1.15, cols = 120, cw = W / cols, horizon = H / 2;
    let g = c.createLinearGradient(0, 0, 0, horizon); g.addColorStop(0, this.pal.bg); g.addColorStop(1, this.pal.bg2);
    c.fillStyle = g; c.fillRect(0, 0, W, horizon);
    g = c.createLinearGradient(0, horizon, 0, H); g.addColorStop(0, '#15110e'); g.addColorStop(1, this.col(5)); c.fillStyle = g; c.fillRect(0, horizon, W, H - horizon);
    const zbuf = new Float32Array(cols);
    for (let i = 0; i < cols; i++) {
      const ra = this.pa + (i / cols - 0.5) * fov;
      const r = this.cast(ra);
      const dist = r.dist * Math.cos(ra - this.pa);
      zbuf[i] = dist;
      const h = Math.min(H * 4, (H * 0.9) / Math.max(0.05, dist));
      const tex = this.tex[(r.w - 1) % 4];
      c.drawImage(tex, Math.floor(r.hit * 63), 0, 1, 64, i * cw, horizon - h / 2, cw + 0.6, h);
      const shade = Math.min(0.8, (r.side ? 0.25 : 0) + dist / 14);
      c.fillStyle = `rgba(8,6,5,${shade})`; c.fillRect(i * cw, horizon - h / 2, cw + 0.6, h);
    }
    const sprites = [...this.foes.filter((f) => f.hp > 0), ...this.items.filter((i) => !i.got)].map((s) => ({ s, d: Math.hypot(s.x - this.px, s.y - this.py) })).sort((a, b) => b.d - a.d);
    for (const { s, d } of sprites) {
      const ang = this.angTo(s.x, s.y);
      if (Math.abs(ang) > fov) continue;
      const dist = d * Math.cos(ang);
      if (dist < 0.2) continue;
      const size = (H * (s.item ? 0.4 : 0.75)) / dist * this.S;
      const sx = (ang / fov + 0.5) * W, top = horizon + (H * 0.9) / dist / 2 - size;
      const im = s.i;
      if (!ready(im)) continue;
      const iw = im.naturalWidth, ar = im.naturalHeight / iw, w = size / ar > size * 1.4 ? size * 1.4 : size / ar;
      const x0 = sx - w / 2;
      for (let col = Math.max(0, Math.floor(x0 / cw)); col < Math.min(cols, Math.ceil((x0 + w) / cw)); col++) {
        if (zbuf[col] < dist) continue;
        const u = (col * cw - x0) / w;
        c.drawImage(im, Math.floor(u * iw), 0, Math.max(1, iw / (w / cw)), im.naturalHeight, col * cw, top, cw + 0.6, size);
      }
      if (s.hit > 0) { c.fillStyle = 'rgba(255,60,30,.35)'; c.fillRect(x0, top, w, size); }
    }
    // weapon
    const bob = Math.sin(this.t * 8) * 4;
    c.fillStyle = '#2b2622'; c.beginPath(); c.moveTo(W / 2 - 26, H); c.lineTo(W / 2 - 14, H - 70 + bob); c.lineTo(W / 2 + 14, H - 70 + bob); c.lineTo(W / 2 + 26, H); c.fill();
    c.fillStyle = this.col(0); c.fillRect(W / 2 - 5, H - 82 + bob, 10, 16);
    if (this.flash > 0) { c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(W / 2, H - 90 + bob, 16, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W / 2 - 7, horizon); c.lineTo(W / 2 + 7, horizon); c.moveTo(W / 2, horizon - 7); c.lineTo(W / 2, horizon + 7); c.stroke();
    if (this.hurt > 0) { c.fillStyle = 'rgba(200,20,10,.3)'; c.fillRect(0, 0, W, H); }
    // minimap
    const ms = 4;
    c.globalAlpha = 0.7;
    for (let y = 0; y < this.N; y++) for (let x = 0; x < this.N; x++) if (this.map[y][x]) { c.fillStyle = this.col(this.map[y][x]); c.fillRect(W - this.N * ms - 8 + x * ms, 30 + y * ms, ms, ms); }
    c.fillStyle = '#fff'; c.fillRect(W - this.N * ms - 8 + this.px * ms - 1.5, 30 + this.py * ms - 1.5, 3, 3);
    c.globalAlpha = 1;
  }
  hud() { return `${this.score} · ♥${this.hp} · lvl ${this.level + 1}`; }
}

// ================================================================ Asteroids
export class Rocks extends Game {
  setup() { this.wave = 0; this.reset(); }
  reset() { this.ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2 }; this.shots = []; this.rocks = []; this.spawnWave(); this.dead = 0; }
  spawnWave() { for (let i = 0; i < 3 + this.wave; i++) this.rock(this.rng() < 0.5 ? 0 : W, this.r(0, H), 34); }
  rock(x, y, r) { const a = this.r(0, 7); this.rocks.push({ x, y, r: r * this.S, vx: Math.cos(a) * this.r(20, 70) * (40 / r), vy: Math.sin(a) * this.r(20, 70) * (40 / r), rot: 0, vr: this.r(-1.5, 1.5), i: this.skin.any('meteor', 'prop', 'animal', 'item') }); }
  wrapd(a, b, L) { let d = b - a; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; }
  fire() { const s = this.ship; if (this.cool > 0 || this.dead) return; this.cool = 0.22; this.shots.push({ x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14, vx: Math.cos(s.a) * 420 + s.vx, vy: Math.sin(s.a) * 420 + s.vy, life: 1.1 }); }
  autopilot(dt) {
    const s = this.ship;
    const t = this.rocks.map((r) => ({ r, dx: this.wrapd(s.x, r.x, W), dy: this.wrapd(s.y, r.y, H) })).sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy))[0];
    if (!t) return;
    const dist = Math.hypot(t.dx, t.dy), lead = dist / 420;
    let d = Math.atan2(t.dy + t.r.vy * lead, t.dx + t.r.vx * lead) - s.a;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    s.a += Math.sign(d) * Math.min(Math.abs(d), 4 * dt);
    if (Math.abs(d) < 0.15) this.fire();
    this.thrust = dist > 170 && Math.abs(d) < 0.5 ? 1 : dist < t.r.r + 50 ? -1 : 0;
  }
  down(x, y) { this.aim = { x, y }; this.held = this.t; this.fireAt(x, y); }
  move(x, y) { if (this.aim) this.aim = { x, y }; }
  up() { this.aim = null; this.thrust = 0; }
  fireAt(x, y) { this.ship.a = Math.atan2(y - this.ship.y, x - this.ship.x); this.fire(); }
  step(dt) {
    this.cool = (this.cool || 0) - dt;
    const s = this.ship;
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) { this.ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2 }; this.dead = 0; } }
    if (!this.auto && this.aim) { s.a = Math.atan2(this.aim.y - s.y, this.aim.x - s.x); this.thrust = this.t - this.held > 0.25 ? 1 : 0; if (this.t - this.held > 0.25) this.fire(); }
    if (!this.dead) {
      if (this.thrust) { s.vx += Math.cos(s.a) * 260 * this.thrust * dt; s.vy += Math.sin(s.a) * 260 * this.thrust * dt; }
      s.vx *= 0.992; s.vy *= 0.992; s.x = (s.x + s.vx * dt + W) % W; s.y = (s.y + s.vy * dt + H) % H; s.inv -= dt;
    }
    for (const b of this.shots) { b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H; b.life -= dt; }
    for (const r of this.rocks) { r.x = (r.x + r.vx * dt + W) % W; r.y = (r.y + r.vy * dt + H) % H; r.rot += r.vr * dt; }
    for (const b of this.shots) for (const r of this.rocks) {
      if (b.life <= 0 || r.dead) continue;
      if (Math.hypot(this.wrapd(b.x, r.x, W), this.wrapd(b.y, r.y, H)) < r.r) {
        b.life = 0; r.dead = true; this.score += Math.round(60 - r.r); this.burst(r.x, r.y, this.col(this.ri(0, 5)), 12);
        if (r.r > 14) for (let k = 0; k < 2; k++) this.rock(r.x, r.y, r.r / this.S * 0.58);
      }
    }
    if (!this.dead && s.inv <= 0) for (const r of this.rocks) if (!r.dead && Math.hypot(this.wrapd(s.x, r.x, W), this.wrapd(s.y, r.y, H)) < r.r + 8) { this.dead = 1.2; this.burst(s.x, s.y, this.col(0), 30, 260); this.score = Math.max(0, this.score - 100); break; }
    this.shots = this.shots.filter((b) => b.life > 0);
    this.rocks = this.rocks.filter((r) => !r.dead);
    if (!this.rocks.length) { this.wave++; this.spawnWave(); }
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 40; i++) c.fillRect((i * 97) % W, (i * 57) % H, 1.5, 1.5);
    for (const r of this.rocks) if (!drawFit(c, r.i, r.x, r.y, r.r * 2.2, r.r * 2.2, r.rot)) { c.strokeStyle = this.col(1); c.lineWidth = 2; c.beginPath(); c.arc(r.x, r.y, r.r, 0, 7); c.stroke(); }
    c.fillStyle = this.col(1); for (const b of this.shots) { c.beginPath(); c.arc(b.x, b.y, 2.5, 0, 7); c.fill(); }
    const s = this.ship;
    if (!this.dead && (s.inv <= 0 || Math.floor(this.t * 10) % 2)) {
      if (!drawFit(c, this.skin.vehicle('ship'), s.x, s.y, 34 * this.S, 34 * this.S, s.a + Math.PI / 2)) {
        c.save(); c.translate(s.x, s.y); c.rotate(s.a); c.strokeStyle = this.pal.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 0); c.lineTo(-10, -9); c.lineTo(-6, 0); c.lineTo(-10, 9); c.closePath(); c.stroke(); c.restore();
      }
      if (this.thrust > 0) { c.fillStyle = this.col(0); c.beginPath(); c.arc(s.x - Math.cos(s.a) * 16, s.y - Math.sin(s.a) * 16, 4 + Math.random() * 3, 0, 7); c.fill(); }
    }
  }
  hud() { return `${this.score} · wave ${this.wave + 1}`; }
}

// ================================================================ Slingshot topple
export class Sling extends Game {
  setup() { this.levelN = 0; this.build(); }
  build() {
    this.floor = H - 28; this.boxes = []; this.ball = null; this.shotsLeft = 4; this.aimT = 1.2; this.home = { x: 64, y: H - 120 };
    const mats = Array.from({ length: 3 }, (_, k) => this.skin.pick(`mat${k}`, 'block', 'tile'));
    const towers = this.ri(1, 3);
    for (let t = 0; t < towers; t++) {
      const bx = 170 + t * (170 / towers) + this.r(-10, 10), cols = this.ri(1, 3), rows = this.ri(2, 4), bw = this.r(18, 30), bh = this.r(26, 44);
      let y = this.floor;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) this.box(bx + k * (bw + 16), y - bh, bw, bh, mats[(r + t) % 3]);
        const span = cols * (bw + 16) - 16;
        this.box(bx - 6, y - bh - 12, span + 12, 12, mats[(r + 1) % 3]);
        y -= bh + 12;
      }
      this.box(bx + (cols * (bw + 16) - 16) / 2 - 13, y - 26, 26, 26, null, true);
    }
  }
  box(x, y, w, h, img, target) { this.boxes.push({ x, y, w, h, vx: 0, vy: 0, img, target, i: target ? this.skin.any('enemy', 'animal', 'prop') : null, m: w * h }); }
  launch(vx, vy) { if (this.ball || this.shotsLeft <= 0) return; this.shotsLeft--; this.ball = { x: this.home.x, y: this.home.y, vx, vy, r: 10 * this.S, i: this.skin.any('ball', 'prop', 'animal'), life: 6, rot: 0 }; }
  autopilot(dt) {
    if (this.ball) return;
    this.aimT -= dt;
    const t = this.boxes.filter((b) => b.target && !b.dead)[0];
    if (!t) return;
    const v = 520, g = 600 * this.G, dx = t.x + t.w / 2 - this.home.x, dy = this.home.y - (t.y + t.h / 2);
    const disc = v ** 4 - g * (g * dx * dx + 2 * dy * v * v);
    const a = disc > 0 ? Math.atan((v * v - Math.sqrt(disc) * (this.rng() < 0.4 ? -1 : 1)) / (g * dx)) : Math.PI / 4;
    this.aimA = a + this.r(-0.05, 0.05);
    if (this.aimT <= 0) { this.launch(Math.cos(this.aimA) * v, -Math.sin(this.aimA) * v); this.aimT = 1.4; }
  }
  down(x, y) { if (!this.ball) this.pull = { x, y, cx: x, cy: y }; }
  move(x, y) { if (this.pull) { this.pull.cx = x; this.pull.cy = y; } }
  up(x, y) { if (!this.pull) return; const vx = (this.pull.x - x) * 4.5, vy = (this.pull.y - y) * 4.5; const s = Math.hypot(vx, vy); if (s > 40) { const k = Math.min(1, 720 / s); this.launch(vx * k, vy * k); } this.pull = null; }
  tap() {}
  step(dt) {
    const g = 600 * this.G;
    const bs = this.boxes;
    for (const b of bs) { if (b.dead) continue; b.vy += g * dt; b.vx *= 0.995; b.x += b.vx * dt; b.y += b.vy * dt; }
    for (let it = 0; it < 4; it++) {
      for (const b of bs) {
        if (b.dead) continue;
        if (b.y + b.h > this.floor) { b.y = this.floor - b.h; if (b.vy > 0) b.vy = -b.vy * 0.15; b.vx *= 0.8; }
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.3; } if (b.x + b.w > W) { b.x = W - b.w; b.vx = -Math.abs(b.vx) * 0.3; }
      }
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        if (a.dead || b.dead) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox <= 0 || oy <= 0) continue;
        const ta = b.m / (a.m + b.m), tb = a.m / (a.m + b.m);
        if (oy < ox) {
          const s = a.y < b.y ? -1 : 1;
          a.y += s * oy * ta; b.y -= s * oy * tb;
          const v = (a.vy * a.m + b.vy * b.m) / (a.m + b.m); a.vy = b.vy = v;
          const f = (a.vx - b.vx) * 0.1; a.vx -= f; b.vx += f;
        } else {
          const s = a.x < b.x ? -1 : 1;
          a.x += s * ox * ta; b.x -= s * ox * tb;
          const v = (a.vx * a.m + b.vx * b.m) / (a.m + b.m); a.vx = b.vx = v * 0.9;
        }
      }
    }
    for (const b of bs) if (b.target && !b.dead && (Math.hypot(b.vx, b.vy) > 260 || b.y + b.h >= this.floor - 1 && b.fell)) { b.dead = true; this.score += 500; this.burst(b.x + b.w / 2, b.y + b.h / 2, this.col(0), 26, 220); }
    for (const b of bs) if (b.target && b.y + b.h < this.floor - 30) b.fell = true;
    const ball = this.ball;
    if (ball) {
      ball.vy += g * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.life -= dt; ball.rot += ball.vx * 0.01 * dt;
      if (ball.y + ball.r > this.floor) { ball.y = this.floor - ball.r; ball.vy *= -0.35; ball.vx *= 0.8; }
      for (const b of bs) {
        if (b.dead) continue;
        const n = circleRect(ball, b);
        if (n) {
          const rel = Math.hypot(ball.vx, ball.vy);
          const k = Math.min(1.5, 900 / b.m);
          b.vx += ball.vx * k * 0.6; b.vy += ball.vy * k * 0.4;
          reflect(ball, n, 0.35);
          if (b.target && rel > 160) { b.dead = true; this.score += 500; this.burst(b.x + b.w / 2, b.y + b.h / 2, this.col(0), 26, 220); }
          else this.score += 5;
        }
      }
      if (ball.life <= 0 || ball.x > W + 40 || ball.x < -40 || Math.hypot(ball.vx, ball.vy) < 12) this.ball = null;
    }
    this.boxes = bs.filter((b) => !b.dead);
    if (!this.ball && (!this.boxes.some((b) => b.target) || this.shotsLeft <= 0)) { this.waitNext = (this.waitNext || 0) + dt; if (this.waitNext > 1.2) { this.waitNext = 0; this.levelN++; this.build(); } }
  }
  draw(c) {
    this.clear(c);
    c.fillStyle = this.col(2); c.fillRect(0, this.floor, W, H - this.floor);
    for (const b of this.boxes) {
      if (b.target) { if (!drawFit(c, b.i, b.x + b.w / 2, b.y + b.h / 2, b.w * 1.4, b.h * 1.4)) { c.fillStyle = this.col(0); c.beginPath(); c.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, 7); c.fill(); } continue; }
      c.fillStyle = this.col(1); c.fillRect(b.x, b.y, b.w, b.h);
      if (b.img) drawRectImg(c, b.img, b.x, b.y, b.w, b.h, false);
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    }
    // slingshot
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 6; c.beginPath(); c.moveTo(this.home.x, this.floor); c.lineTo(this.home.x, this.home.y + 18); c.lineTo(this.home.x - 12, this.home.y); c.moveTo(this.home.x, this.home.y + 18); c.lineTo(this.home.x + 12, this.home.y); c.stroke();
    if (!this.ball) {
      let bx = this.home.x, by = this.home.y;
      if (this.pull?.cx != null) { bx += Math.max(-60, Math.min(60, this.pull.cx - this.pull.x)); by += Math.max(-60, Math.min(60, this.pull.cy - this.pull.y)); }
      else if (this.auto && this.aimA != null) { bx -= Math.cos(this.aimA) * 30 * (1.2 - this.aimT); by += Math.sin(this.aimA) * 30 * (1.2 - this.aimT); }
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(this.home.x - 12, this.home.y); c.lineTo(bx, by); c.lineTo(this.home.x + 12, this.home.y); c.stroke();
      if (this.shotsLeft > 0) this.orb(c, this.skin.pick('ammo', 'ball', 'prop'), bx, by, 10 * this.S, this.col(3));
    } else this.orb(c, this.ball.i, this.ball.x, this.ball.y, this.ball.r, this.col(3), this.ball.rot);
  }
  hud() { return `${this.score} · ${this.shotsLeft} shots`; }
}
