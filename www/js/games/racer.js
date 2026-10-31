import { Game, W, H, circleRect, reflect, roundRect, drawFit, drawRectImg, ready } from './engine.js';

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
