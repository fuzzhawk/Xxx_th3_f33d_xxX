// Star Fox-style rail shooter over a voxel heightmap (Comanche "voxel space"
// renderer at half resolution). Fly through rings, shoot drones and turrets.
import { Game, W, H, drawFit, ready, rgbOf, noiseMap, imagePixels } from './engine.js';

const N = 256, RW = 180, RH = 210, FAR = 340, D = 14, HS = 120;

export class Flight extends Game {
  static noMods = ['mirror', 'lowg', 'heavy', 'trails'];
  setup() {
    const R = this.rng;
    const hm = noiseMap(R, N, 5, 4), ridge = noiseMap(R, N, 3, 2);
    this.hgt = new Float32Array(N * N);
    this.sea = 14 + R() * 10;
    const amp = 70 + R() * 50;
    for (let i = 0; i < N * N; i++) {
      const r = 1 - Math.abs(ridge[i] * 2 - 1);
      this.hgt[i] = Math.max(this.sea, (hm[i] ** 1.6) * amp + r * r * 40 * this.G);
    }
    this.buildColors();
    this.buf = Object.assign(document.createElement('canvas'), { width: RW, height: RH });
    this.bctx = this.buf.getContext('2d');
    this.img = this.bctx.createImageData(RW, RH);
    this.px = new Uint32Array(this.img.data.buffer);
    this.yb = new Int16Array(RW);
    this.cx = 128; this.cy = 0; this.camH = 60;
    this.ship = { x: 128, h: 60, vx: 0, vh: 0, bank: 0 };
    this.target = { x: 128, h: 60 };
    this.speed = 34;
    this.foes = []; this.shots = []; this.enemyShots = []; this.rings = [];
    this.shield = 100; this.hits = 0; this.spawnT = 1; this.ringT = 3; this.cool = 0; this.shake = 0; this.fireHeld = false;
  }
  buildColors() {
    const p = this.pal, tex = imagePixels(this.skin.slots.tile[0], N, N);
    const bands = [p.c[5], p.c[2], p.c[1], p.c[3], p.c[4], p.ink].map(rgbOf);
    const water = rgbOf(p.c[5]);
    this.colr = new Uint32Array(N * N);
    let max = 0; for (const v of this.hgt) max = Math.max(max, v);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, h = this.hgt[i];
      let c;
      if (h <= this.sea + 0.01) c = water.map((v) => v * 0.6);
      else {
        const t = Math.min(0.999, (h - this.sea) / (max - this.sea)) * (bands.length - 1), k = Math.floor(t), f = t - k;
        const a = bands[Math.min(k, bands.length - 1)], b = bands[Math.min(k + 1, bands.length - 1)];
        c = a.map((v, j) => v + (b[j] - v) * f);
        const slope = this.hgt[y * N + ((x + 1) % N)] - h;
        const lit = Math.max(0.45, Math.min(1.3, 1 - slope * 0.08));
        c = c.map((v) => v * lit);
      }
      if (tex) { const m = 0.55 + (tex[i * 4] + tex[i * 4 + 1] + tex[i * 4 + 2]) / 765 * 0.7; c = c.map((v) => v * m); }
      const g = (x * 13 + y * 7) % 5 === 0 ? 0.92 : 1; // a little dither grit
      this.colr[i] = 0xff000000 | (Math.min(255, c[2] * g) << 16) | (Math.min(255, c[1] * g) << 8) | Math.min(255, c[0] * g);
    }
    this.texDone = !!tex;
  }
  ground(x, y) { return this.hgt[((Math.floor(y) & 255) << 8) | (Math.floor(x) & 255)]; }
  maxAhead(x, y0, y1) { let m = 0; for (let y = y0; y < y1; y += 2) for (const dx of [-3, 0, 3]) m = Math.max(m, this.ground(x + dx, y)); return m; }

  spawn() {
    const y = this.cy + D + this.r(160, 260), kind = this.rng() < 0.25 ? 'turret' : 'drone';
    const x = this.ship.x + this.r(-40, 40);
    const n = kind === 'drone' && this.rng() < 0.5 ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const fx = x + (k - (n - 1) / 2) * 9;
      const g = this.ground(fx, y + k * 6);
      this.foes.push({ kind, x: fx, y: y + k * 6, h: kind === 'turret' ? g + 2 : Math.max(g + 10, this.ship.h + this.r(-15, 20)), ph: this.r(0, 7), hp: kind === 'turret' ? 3 : 2, cool: this.r(1, 2.5),
        i: kind === 'turret' ? this.skin.pick('turret', 'enemy', 'block') : this.skin.list('drones', 4, 'enemy', 'ship', 'animal')[k % 4] || this.skin.creatures[k % 6].frames[0], sz: kind === 'turret' ? 7 : 5.5 * this.S });
    }
  }
  fire() {
    if (this.cool > 0) return;
    this.cool = 0.16;
    const s = this.ship, y = this.cy + D + 2;
    for (const o of [-1.6, 1.6]) this.shots.push({ x: s.x + o, y, h: s.h - 0.5, life: 1.4 });
  }
  hurt(n) { this.shield -= n; this.shake = 0.35; if (this.shield <= 0) { this.burst(W / 2, H * 0.7, this.col(0), 40, 300); this.shield = 100; this.score = Math.max(0, this.score - 300); } }

  autopilot(dt) {
    const s = this.ship, sy = this.cy + D;
    let best = null, bd = 1e9;
    for (const r of this.rings) if (!r.done && r.y - sy > 15 && r.y - sy < 140) { const d = r.y - sy; if (d < bd) { bd = d; best = { x: r.x, h: r.h }; } }
    if (!best) for (const f of this.foes) { const d = f.y - sy; if (d > 20 && d < 200 && d < bd) { bd = d; best = { x: f.x, h: f.h }; } }
    this.target = best ? { x: best.x, h: best.h } : { x: s.x + Math.sin(this.t * 0.4) * 20, h: s.h };
    this.fireHeld = this.foes.some((f) => f.y - sy > 0 && f.y - sy < 180 && Math.abs(f.x - s.x) < 6 && Math.abs(f.h - s.h) < 8);
  }
  down(x, y) { this.aimAt(x, y); this.fireHeld = true; }
  move(x, y) { if (this.fireHeld) this.aimAt(x, y); }
  up() { this.fireHeld = false; }
  aimAt(x, y) {
    this.target = { x: this.cx + (x / W - 0.5) * 2 * D * 1.6, h: 20 + (1 - y / H) * 110 };
  }
  step(dt) {
    const s = this.ship;
    this.cy += this.speed * dt;
    const sy = this.cy + D;
    // keep clear of terrain ahead
    const floor = this.maxAhead(this.target.x, sy, sy + 22) + 5;
    const th = Math.max(floor, Math.min(130, this.target.h));
    const ax = Math.max(-1, Math.min(1, (this.target.x - s.x) / 10)), ah = Math.max(-1, Math.min(1, (th - s.h) / 10));
    s.vx += (ax * 46 - s.vx) * 4 * dt; s.vh += (ah * 36 - s.vh) * 4 * dt;
    s.x += s.vx * dt; s.h += s.vh * dt;
    s.bank += (-s.vx / 45 - s.bank) * 5 * dt;
    const g = this.ground(s.x, sy);
    if (s.h < g + 2) { s.h = g + 4; s.vh = 20; this.hurt(12); this.burst(W / 2, H * 0.75, this.col(3), 14, 160); }
    this.cx += (s.x - this.cx) * 2.2 * dt;
    this.camH += (s.h + 7 - this.camH) * 3 * dt;
    this.cool -= dt; this.shake = Math.max(0, this.shake - dt);
    if (this.fireHeld) this.fire();
    if (!this.texDone && this.t > 0.3 && ready(this.skin.slots.tile[0]) && Math.floor(this.t * 2) % 2 === 0) this.buildColors();
    // spawn
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawn(); this.spawnT = this.r(1.2, 2.6) / (this.mods.swarm ? 1.6 : 1); }
    this.ringT -= dt;
    if (this.ringT <= 0) { const y = sy + 220, x = s.x + this.r(-30, 30); this.rings.push({ x, y, h: Math.max(this.ground(x, y) + 14, s.h + this.r(-15, 15)), done: false }); this.ringT = this.r(4, 8); }
    // shots: a little homing so fights read well
    for (const b of this.shots) {
      b.y += 190 * dt; b.life -= dt;
      const f = this.foes.find((f) => f.y > b.y && f.y - b.y < 60 && Math.abs(f.x - b.x) < 8 && Math.abs(f.h - b.h) < 8);
      if (f) { b.x += Math.sign(f.x - b.x) * Math.min(Math.abs(f.x - b.x), 25 * dt); b.h += Math.sign(f.h - b.h) * Math.min(Math.abs(f.h - b.h), 25 * dt); }
      if (this.ground(b.x, b.y) > b.h) b.life = 0;
      for (const e of this.foes) if (!e.dead && Math.abs(e.y - b.y) < 4 && Math.abs(e.x - b.x) < e.sz * 0.6 && Math.abs(e.h - b.h) < e.sz * 0.6) {
        b.life = 0; e.hp--; e.flash = 0.1;
        if (e.hp <= 0) { e.dead = true; this.hits++; this.score += e.kind === 'turret' ? 150 : 100; this.boom(e); }
      }
    }
    for (const e of this.foes) {
      e.ph += dt; e.flash = Math.max(0, (e.flash || 0) - dt);
      if (e.kind === 'drone') { e.y += this.speed * 0.45 * dt; e.x += Math.sin(e.ph * 1.7) * 12 * dt; e.h += Math.cos(e.ph * 1.3) * 8 * dt; e.h = Math.max(e.h, this.ground(e.x, e.y) + 6); }
      e.cool -= dt;
      const dz = e.y - sy;
      if (e.cool <= 0 && dz > 30 && dz < 170) {
        e.cool = this.r(1.6, 3) / (this.mods.glass ? 1.5 : 1);
        const t = dz / 90;
        this.enemyShots.push({ x: e.x, y: e.y, h: e.h, vx: (s.x - e.x) / t, vy: -(dz / t) + this.speed, vh: (s.h - e.h) / t, life: t * 1.5 });
      }
    }
    for (const b of this.enemyShots) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.h += b.vh * dt; b.life -= dt;
      if (Math.abs(b.y - sy) < 2.5 && Math.abs(b.x - s.x) < 2.5 && Math.abs(b.h - s.h) < 2.5) { b.life = 0; this.hurt(this.mods.glass ? 25 : 10); }
    }
    for (const r of this.rings) if (!r.done && Math.abs(r.y - sy) < 1.5) {
      r.done = true;
      if (Math.hypot(r.x - s.x, r.h - s.h) < 7) { this.score += 250; this.shield = Math.min(100, this.shield + 20); r.ok = 1; this.burst(W / 2, H / 2, this.col(4), 24, 220); }
    }
    this.foes = this.foes.filter((e) => !e.dead && e.y > this.cy + 2);
    this.shots = this.shots.filter((b) => b.life > 0);
    this.enemyShots = this.enemyShots.filter((b) => b.life > 0 && b.y > this.cy);
    this.rings = this.rings.filter((r) => r.y > this.cy - 2);
    this.score += dt * 5;
  }
  boom(e) { const p = this.project(e.x, e.y, e.h); if (p) this.burst(p.x, p.y, this.col(0), 22, 200); }
  project(x, y, h) {
    const z = y - this.cy;
    if (z < 1.5) return null;
    return { x: (x - this.cx) / z * (W / 2) + W / 2, y: ((this.camH - h) / z * HS + this.horizon) * (H / RH), k: (W / 2) / z };
  }
  renderTerrain() {
    const px = this.px, yb = this.yb, hgt = this.hgt, col = this.colr;
    px.fill(0); yb.fill(RH);
    const fog = rgbOf(this.pal.bg2), cx = this.cx, cy = this.cy, ch = this.camH, hor = this.horizon;
    let dz = 1;
    for (let z = 2; z < FAR; z += dz, dz *= 1.012) {
      const f = Math.min(1, (z / FAR) ** 1.4), nf = 1 - f, fr = fog[0] * f, fg = fog[1] * f, fb = fog[2] * f;
      const wy = (Math.floor(cy + z) & 255) << 8, x0 = cx - z, step = (2 * z) / RW, inv = HS / z;
      for (let i = 0; i < RW; i++) {
        const idx = wy | (Math.floor(x0 + step * i) & 255);
        let sy = ((ch - hgt[idx]) * inv + hor) | 0;
        if (sy < 0) sy = 0;
        if (sy >= yb[i]) continue;
        const c = col[idx];
        const v = 0xff000000 | ((((c >> 16) & 255) * nf + fb) << 16) | ((((c >> 8) & 255) * nf + fg) << 8) | ((c & 255) * nf + fr);
        for (let y = sy; y < yb[i]; y++) px[y * RW + i] = v;
        yb[i] = sy;
      }
    }
    this.bctx.putImageData(this.img, 0, 0);
  }
  draw(c) {
    const s = this.ship;
    this.horizon = RH * 0.36 - s.vh * 0.25;
    c.save();
    if (this.shake) c.translate(this.r(-4, 4), this.r(-4, 4));
    c.translate(W / 2, H / 2); c.rotate(s.bank * 0.35); c.translate(-W / 2, -H / 2);
    // sky: theme photo with parallax, washed into the fog colour at the horizon
    const hy = this.horizon * (H / RH);
    const g = c.createLinearGradient(0, -60, 0, hy + 40); g.addColorStop(0, this.pal.bg); g.addColorStop(1, this.pal.bg2);
    c.fillStyle = g; c.fillRect(-60, -60, W + 120, H + 120);
    if (ready(this.skin.bg)) {
      const i = this.skin.bg, iw = i.naturalWidth || i.width, ih = i.naturalHeight || i.height, sc = (hy + 80) / ih, w = iw * sc;
      const off = ((-this.cx * 3) % w + w) % w;
      c.globalAlpha = 0.55;
      for (let x = off - w - 60; x < W + 60; x += w) c.drawImage(i, x, -60, w, hy + 80);
      c.globalAlpha = 1;
      const f = c.createLinearGradient(0, hy - 70, 0, hy + 10); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, this.pal.bg2);
      c.fillStyle = f; c.fillRect(-60, hy - 70, W + 120, 90);
    }
    this.renderTerrain();
    c.imageSmoothingEnabled = false;
    c.drawImage(this.buf, -30, 0, W + 60, H * (RH + 4) / RH);
    c.imageSmoothingEnabled = true;
    // world objects, far to near
    const objs = [];
    for (const r of this.rings) objs.push({ y: r.y, f: () => this.drawRing(c, r) });
    for (const e of this.foes) objs.push({ y: e.y, f: () => this.drawFoe(c, e) });
    for (const b of this.shots) objs.push({ y: b.y, f: () => this.drawShot(c, b, true) });
    for (const b of this.enemyShots) objs.push({ y: b.y, f: () => this.drawShot(c, b, false) });
    objs.sort((a, b) => b.y - a.y).forEach((o) => o.f());
    // shadow + ship
    const sy = this.cy + D, sh = this.project(s.x, sy, this.ground(s.x, sy));
    if (sh) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(sh.x, sh.y, 5 * sh.k * 0.6, 1.6 * sh.k * 0.4, 0, 0, 7); c.fill(); }
    const p = this.project(s.x, sy, s.h);
    if (p) {
      const sz = 6.5 * p.k * this.S, img = this.skin.pick('ship', 'ship', 'hero', 'car');
      if (!drawFit(c, img, p.x, p.y, sz, sz, s.bank * 0.8)) {
        c.save(); c.translate(p.x, p.y); c.rotate(s.bank * 0.8); c.fillStyle = this.col(0);
        c.beginPath(); c.moveTo(0, -sz * 0.3); c.lineTo(sz * 0.5, sz * 0.2); c.lineTo(-sz * 0.5, sz * 0.2); c.closePath(); c.fill(); c.restore();
      }
      c.fillStyle = this.col(4); c.globalAlpha = 0.5 + Math.random() * 0.4;
      c.beginPath(); c.arc(p.x, p.y + sz * 0.3, 3 + Math.random() * 3, 0, 7); c.fill(); c.globalAlpha = 1;
    }
    c.restore();
    // HUD: shield bar + reticle
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(12, H - 22, 104, 10);
    c.fillStyle = this.shield > 35 ? this.col(2) : this.col(0); c.fillRect(14, H - 20, this.shield, 6);
    this.text(c, 'SHIELD', 12, H - 32, 9, this.pal.ink, 'left');
    const rp = this.project(s.x, sy + 60, s.h);
    if (rp) { c.strokeStyle = this.pal.ink; c.globalAlpha = 0.5; c.lineWidth = 1.5; c.strokeRect(rp.x - 8, rp.y - 8, 16, 16); c.globalAlpha = 1; }
  }
  drawRing(c, r) {
    const p = this.project(r.x, r.y, r.h);
    if (!p) return;
    c.strokeStyle = r.ok ? this.col(4) : this.col(1); c.lineWidth = Math.max(1, p.k * 1.2);
    c.globalAlpha = r.done && !r.ok ? 0.3 : 0.9;
    c.beginPath(); c.ellipse(p.x, p.y, 7 * p.k, 7 * p.k, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
  }
  drawFoe(c, e) {
    const p = this.project(e.x, e.y, e.h);
    if (!p || p.k * e.sz < 2) return;
    const sz = e.sz * p.k;
    if (e.flash) c.filter = 'brightness(2.5)';
    if (!drawFit(c, e.i, p.x, p.y, sz, sz, e.kind === 'drone' ? Math.sin(e.ph * 2) * 0.3 : 0)) { c.fillStyle = this.col(3); c.beginPath(); c.arc(p.x, p.y, sz / 2, 0, 7); c.fill(); }
    c.filter = 'none';
  }
  drawShot(c, b, mine) {
    const p = this.project(b.x, b.y, b.h);
    if (!p) return;
    const sz = Math.max(3, (mine ? 1.6 : 2.2) * p.k), img = this.skin.pick(mine ? 'bullet' : 'ebullet', 'item', 'ball');
    c.fillStyle = mine ? this.col(4) : this.col(0);
    c.globalAlpha = 0.6; c.beginPath(); c.arc(p.x, p.y, sz * 0.7, 0, 7); c.fill(); c.globalAlpha = 1;
    drawFit(c, img, p.x, p.y, sz, sz, this.t * 8);
  }
  hud() { return `${Math.floor(this.score)} · ${this.hits} down`; }
}
