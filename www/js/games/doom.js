// Doom-style raycaster. Levels mix indoor rooms with open-air courtyards under a
// parallax sky; each game rolls its own arsenal of four weapons that fire the
// theme's PNGs as bullets, and its own cast of generated monsters.
import { Game, W, H, ready } from './engine.js';
import { creatureName } from './creature.js';

const KINDS = [
  { kind: 'imp', hp: 30, speed: 1.1, ranged: true, size: 0.75, color: '#ff8a3a' },
  { kind: 'demon', hp: 55, speed: 2.1, ranged: false, size: 0.8 },
  { kind: 'floater', hp: 40, speed: 0.9, ranged: true, size: 0.7, fly: true, color: '#7ad7ff' },
  { kind: 'brute', hp: 140, speed: 0.7, ranged: true, size: 1.15, color: '#b6ff6a', heavy: true }
];
const ARCH = [
  { arch: 'sidearm', dmg: [10, 16], rate: [0.3, 0.45], pellets: [1, 1], spread: [0.01, 0.03], speed: [13, 17], size: [0.18, 0.24], ammo: null },
  { arch: 'scatter', dmg: [6, 10], rate: [0.7, 1], pellets: [5, 9], spread: [0.09, 0.16], speed: [11, 14], size: [0.12, 0.16], ammo: 'shells' },
  { arch: 'rapid', dmg: [6, 9], rate: [0.07, 0.12], pellets: [1, 1], spread: [0.03, 0.06], speed: [15, 19], size: [0.12, 0.16], ammo: 'bullets' },
  { arch: 'heavy', dmg: [35, 60], rate: [0.6, 0.9], pellets: [1, 1], spread: [0, 0.01], speed: [7, 9], size: [0.32, 0.42], ammo: 'cells', splash: true }
];
const GUN_A = ['Rusty', 'Gnostic', 'Feral', 'Velvet', 'Howling', 'Cursed', 'Hollow', 'Salted', 'Lunar', 'Grim', 'Holy', 'Bent', 'Weeping', 'Sacred', 'Junk'];
const GUN_B = { sidearm: ['Whisperer', 'Pocket Saint', 'Snub', 'Peashooter'], scatter: ['Scattergun', 'Spreader', 'Hailmaker', 'Blunderbuss'], rapid: ['Chatterbox', 'Buzzsaw', 'Hose', 'Rattler'], heavy: ['Thumper', 'Mortar', 'Doombringer', 'Lobber'] };
const R = 0.24; // player radius

export class Doom extends Game {
  static noMods = ['mirror', 'wobble'];
  setup() {
    this.level = 0; this.kills = 0;
    const seed = this.post.seed || 1;
    this.crew = KINDS.map((k, i) => ({ ...k, m: this.skin.creatures[i + 1], name: creatureName(seed + i * 101) }));
    // this game's arsenal
    this.guns = ARCH.map((a) => {
      const v = (r) => this.r(r[0], r[1]);
      return { ...a, name: `${GUN_A[this.ri(0, GUN_A.length - 1)]} ${GUN_B[a.arch][this.ri(0, 3)]}`, dmg: v(a.dmg), rate: v(a.rate), pellets: Math.round(v(a.pellets)), spread: v(a.spread), speed: v(a.speed), size: v(a.size), bullet: this.skin.pick(`bullet-${a.arch}`, 'item', 'ball'), hue: this.ri(0, 5) };
    });
    this.sky = this.skin.bg;
    this.newLevel(true);
  }
  newLevel(fresh) {
    const N = 28;
    const m = Array.from({ length: N }, () => Array(N).fill(1));
    const out = Array.from({ length: N }, () => Array(N).fill(false));
    const rooms = [];
    for (let tries = 0; tries < 80 && rooms.length < 8 + Math.min(4, this.level); tries++) {
      const outdoor = this.rng() < 0.38;
      const w = this.ri(outdoor ? 6 : 4, outdoor ? 10 : 8), h = this.ri(outdoor ? 6 : 4, outdoor ? 10 : 8), x = this.ri(1, N - w - 1), y = this.ri(1, N - h - 1);
      if (rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
      rooms.push({ x, y, w, h, outdoor, tex: this.ri(1, 4) });
    }
    if (rooms[0]) rooms[0].outdoor = false;
    for (const r of rooms) {
      for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) { m[yy][xx] = 0; out[yy][xx] = r.outdoor; }
      if (!r.outdoor && r.w >= 6 && r.h >= 6 && this.rng() < 0.6) for (const [px, py] of [[2, 2], [r.w - 3, 2], [2, r.h - 3], [r.w - 3, r.h - 3]]) m[r.y + py][r.x + px] = r.tex;
    }
    const center = (r) => [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];
    for (let i = 1; i < rooms.length; i++) {
      let [x0, y0] = center(rooms[i - 1]); const [x1, y1] = center(rooms[i]);
      const wide = this.rng() < 0.5;
      while (x0 !== x1) { m[y0][x0] = 0; if (wide) m[y0 + 1][x0] = 0; x0 += Math.sign(x1 - x0); }
      while (y0 !== y1) { m[y0][x0] = 0; if (wide) m[y0][x0 + 1] = 0; y0 += Math.sign(y1 - y0); }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y][x] === 1) { const near = rooms.find((r) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h); m[y][x] = near ? near.tex : 1; }
    const last = rooms[rooms.length - 1];
    this.exit = [last.x + Math.floor(last.w / 2), last.y + Math.floor(last.h / 2)];
    this.map = m; this.out = out; this.N = N; this.rooms = rooms;
    const [sx, sy] = center(rooms[0]);
    this.px = sx + 0.5; this.py = sy + 0.5; this.pa = this.r(0, 6.28);
    if (fresh) { this.hp = this.mods.glass ? 30 : 100; this.armor = 0; this.ammo = { shells: 10, bullets: 60, cells: 4 }; this.owned = [true, true, false, false]; this.weapon = 0; }
    this.cool = 0; this.flash = 0; this.recoil = 0; this.path = []; this.shots = []; this.hurt = 0; this.stuck = 0; this.lastPos = [this.px, this.py];
    this.tex = [0, 1, 2, 3, 4].map((k) => this.makeTex(k));
    const free = [], deco = [];
    for (const r of rooms.slice(1)) for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) if (!m[yy][xx]) free.push([xx, yy]);
    const take = () => free.splice(this.ri(0, free.length - 1), 1)[0];
    const n = Math.round((6 + this.level * 2) * (this.mods.swarm ? 1.7 : 1));
    this.foes = [];
    for (let i = 0; i < n && free.length; i++) {
      const [x, y] = take();
      const t = this.crew[i % 7 === 6 ? 3 : this.ri(0, 2)];
      this.foes.push({ ...t, x: x + 0.5, y: y + 0.5, hp: t.hp * (1 + this.level * 0.15), max: t.hp, awake: false, cd: this.r(0.5, 2), hit: 0, anim: this.r(0, 2) });
    }
    const PICKS = ['health', 'armor', 'shells', 'bullets', 'cells', 'gun2', 'gun3'];
    this.items = [];
    for (let i = 0; i < 9 && free.length; i++) {
      const [x, y] = take();
      const kind = i < 2 ? PICKS[5 + i] : PICKS[this.ri(0, 4)];
      this.items.push({ x: x + 0.5, y: y + 0.5, kind, i: kind.startsWith('gun') ? this.guns[+kind[3]].bullet : this.skin.pick(`pick-${kind}`, 'item', 'ball'), bob: this.r(0, 6) });
    }
    // scenery in the courtyards (no collision)
    for (const r of rooms.filter((r) => r.outdoor)) for (let k = 0; k < 3; k++) deco.push({ x: r.x + this.r(0.6, r.w - 0.6), y: r.y + this.r(0.6, r.h - 0.6), i: this.skin.pick(`deco${k}`, 'item', 'enemy'), big: this.r(0.6, 1.1) });
    this.deco = deco;
  }
  makeTex(k) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    const paint = () => {
      x.fillStyle = this.col(k + 1); x.fillRect(0, 0, 64, 64);
      const t = this.skin.slots.tile[k % this.skin.slots.tile.length];
      if (ready(t)) { x.imageSmoothingEnabled = !t.pixel; x.drawImage(t, 0, 0, 64, 64); x.globalCompositeOperation = 'multiply'; x.fillStyle = this.col(k + 1); x.globalAlpha = 0.35; x.fillRect(0, 0, 64, 64); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
      x.fillStyle = 'rgba(0,0,0,.25)';
      for (let r = 0; r < 8; r++) for (let q = 0; q < 4; q++) { x.fillRect(q * 16 + (r % 2) * 8, r * 8, 15, 1); x.fillRect(q * 16 + (r % 2) * 8, r * 8, 1, 7); }
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${this.r(0.05, 0.25)})`; x.fillRect(this.r(0, 64), this.r(0, 64), this.r(1, 4), this.r(1, 3)); }
    };
    paint();
    const t = this.skin.slots.tile[k % this.skin.slots.tile.length];
    if (t && !ready(t)) t.addEventListener?.('load', paint, { once: true });
    return cv;
  }
  cell(x, y) { const X = Math.floor(x), Y = Math.floor(y); return X < 0 || Y < 0 || X >= this.N || Y >= this.N ? 1 : this.map[Y][X]; }
  blocked(x, y) { return this.cell(x - R, y - R) || this.cell(x + R, y - R) || this.cell(x - R, y + R) || this.cell(x + R, y + R); }
  rayCast(px, py, a) {
    const dx = Math.cos(a) || 1e-6, dy = Math.sin(a) || 1e-6;
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy), sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let sdx = (dx < 0 ? px - mx : mx + 1 - px) * ddx, sdy = (dy < 0 ? py - my : my + 1 - py) * ddy, side = 0;
    let open = !!this.out[my]?.[mx];
    for (let i = 0; i < 90; i++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
      const w = this.cell(mx + 0.5, my + 0.5);
      if (w) {
        const dist = Math.max(0.02, side ? sdy - ddy : sdx - ddx);
        let hit = side ? px + dist * dx : py + dist * dy; hit -= Math.floor(hit);
        return { dist, side, hit, w, open };
      }
      if (this.out[my]?.[mx]) open = true;
    }
    return { dist: 90, side: 0, hit: 0, w: 1, open };
  }
  los(ax, ay, bx, by) { return this.rayCast(ax, ay, Math.atan2(by - ay, bx - ax)).dist >= Math.hypot(bx - ax, by - ay) - 0.25; }
  angTo(x, y) { let d = Math.atan2(y - this.py, x - this.px) - this.pa; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  nudge(dx, dy) {
    if (!this.blocked(this.px + dx, this.py)) this.px += dx;
    if (!this.blocked(this.px, this.py + dy)) this.py += dy;
  }
  walk(f, strafe, dt) {
    const c = Math.cos(this.pa), s = Math.sin(this.pa);
    this.nudge((c * f - s * strafe) * dt, (s * f + c * strafe) * dt);
  }
  canUse(i) { const g = this.guns[i]; return this.owned[i] && (!g.ammo || this.ammo[g.ammo] > 0); }
  fire() {
    if (this.cool > 0) return;
    if (!this.canUse(this.weapon)) this.weapon = 0;
    const g = this.guns[this.weapon];
    if (g.ammo) this.ammo[g.ammo]--;
    this.cool = g.rate; this.flash = 0.07; this.recoil = 1;
    for (let p = 0; p < g.pellets; p++) {
      const a = this.pa + this.r(-g.spread, g.spread);
      this.shots.push({ x: this.px + Math.cos(a) * 0.3, y: this.py + Math.sin(a) * 0.3, vx: Math.cos(a) * g.speed, vy: Math.sin(a) * g.speed, dmg: g.dmg, mine: true, life: 2.5, img: g.bullet, size: g.size, splash: g.splash, spin: this.r(-8, 8) });
    }
  }
  damage(f, dmg) {
    f.hp -= dmg; f.hit = 0.12; f.awake = true;
    if (f.hp <= 0) { this.kills++; this.score += Math.round(f.max); this.burst(W / 2, H * 0.45, f.color || this.col(0), 16, 180); }
  }
  bestWeapon(dist, foe) {
    const order = foe?.heavy ? [3, 1, 2, 0] : dist < 2.5 ? [1, 2, 3, 0] : dist < 6 ? [2, 0, 1, 3] : [0, 2, 3, 1];
    return order.find((i) => this.canUse(i)) ?? 0;
  }
  bfs(tx, ty) {
    const N = this.N, prev = new Map(), key = (x, y) => y * N + x, start = [Math.floor(this.px), Math.floor(this.py)];
    const q = [start]; prev.set(key(...start), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!this.map[ny]?.[nx] && !prev.has(key(nx, ny))) { prev.set(key(nx, ny), [x, y]); q.push([nx, ny]); } }
    }
    if (!prev.has(key(tx, ty))) return [];
    const path = []; let cur = [tx, ty];
    while (cur) { path.unshift(cur); cur = prev.get(key(...cur)); }
    return path.slice(1).map(([x, y]) => [x + 0.5, y + 0.5]);
  }
  turnTo(target, rate, dt) { const d = target; this.pa += Math.sign(d) * Math.min(Math.abs(d), rate * dt); return Math.abs(d); }
  autopilot(dt) {
    // stuck? (no progress for a second) → re-plan and wiggle
    this.stuckT = (this.stuckT || 0) + dt;
    if (this.stuckT > 1) {
      const moved = Math.hypot(this.px - this.lastPos[0], this.py - this.lastPos[1]);
      if (moved < 0.15 && !this.target) { this.path = []; this.pa += this.r(-1.2, 1.2); }
      this.lastPos = [this.px, this.py]; this.stuckT = 0;
    }
    const alive = this.foes.filter((f) => f.hp > 0);
    const vis = alive.filter((f) => Math.hypot(f.x - this.px, f.y - this.py) < 12 && this.los(this.px, this.py, f.x, f.y)).sort((a, b) => Math.hypot(a.x - this.px, a.y - this.py) - Math.hypot(b.x - this.px, b.y - this.py))[0];
    this.target = vis;
    if (vis) {
      const dist = Math.hypot(vis.x - this.px, vis.y - this.py);
      this.weapon = this.bestWeapon(dist, vis);
      if (this.turnTo(this.angTo(vis.x, vis.y), 3.4, dt) < 0.07) this.fire();
      this.strafeT = (this.strafeT || 0) - dt;
      if (this.strafeT <= 0) { this.strafeDir = this.rng() < 0.5 ? -1 : 1; this.strafeT = this.r(0.5, 1.3); }
      this.walk(dist > 4 ? 1.5 : dist < 1.6 && !vis.ranged ? -1.3 : 0, this.strafeDir * 1.1, dt);
      this.path = [];
      return;
    }
    if (!this.path.length) {
      const want = this.hp < 50 ? this.items.find((i) => i.kind === 'health') : null;
      const goal = want || this.items.find((i) => i.kind.startsWith('gun')) || alive[0] || this.items[0];
      const target = goal || { x: this.exit[0] + 0.5, y: this.exit[1] + 0.5 };
      this.path = this.bfs(Math.floor(target.x), Math.floor(target.y));
    }
    const wp = this.path[0];
    if (!wp) return;
    const off = this.turnTo(this.angTo(wp[0], wp[1]), 4.2, dt);
    // only walk once roughly facing the next cell centre, so we don't clip corners
    if (off < 0.35) this.walk(2.1, 0, dt);
    if (Math.hypot(wp[0] - this.px, wp[1] - this.py) < 0.28) this.path.shift();
  }
  // touch: drag sideways to turn, up/down to walk, tap to fire, tap the HUD to switch weapons
  down(x, y) { this.drag = { x, y, sx: x, sy: y, t: this.t, moved: false }; if (y > H - 34) { const i = Math.floor((x - 150) / 52); if (i >= 0 && i < 4 && this.owned[i]) this.weapon = i; this.drag = null; } }
  move(x, y) { if (!this.drag) return; const dx = x - this.drag.x; if (Math.abs(x - this.drag.sx) + Math.abs(y - this.drag.sy) > 8) this.drag.moved = true; this.pa += dx * 0.012; this.drag.x = x; this.drag.cy = y; }
  up() { if (this.drag && !this.drag.moved && this.t - this.drag.t < 0.3) this.fire(); this.drag = null; }
  tap(x, y) { this.down(x, y); this.up(); }
  step(dt) {
    this.cool -= dt; this.flash -= dt; this.recoil = Math.max(0, this.recoil - dt * 5); this.hurt -= dt;
    if (!this.auto && this.drag) { const dy = (this.drag.cy ?? this.drag.sy) - this.drag.sy; if (Math.abs(dy) > 12) this.walk(-dy / 40, 0, dt); else if (this.t - this.drag.t > 0.35 && !this.drag.moved) this.fire(); }
    for (const f of this.foes) {
      f.hit -= dt; f.anim += dt;
      if (f.hp <= 0) continue;
      const dist = Math.hypot(f.x - this.px, f.y - this.py);
      if (!f.awake && dist < 9 && this.los(f.x, f.y, this.px, this.py)) f.awake = true;
      if (!f.awake) continue;
      f.cd -= dt;
      const seen = this.los(f.x, f.y, this.px, this.py);
      if (f.ranged && seen && dist < 11 && f.cd <= 0) {
        const a = Math.atan2(this.py - f.y, this.px - f.x) + this.r(-0.08, 0.08);
        this.shots.push({ x: f.x, y: f.y, vx: Math.cos(a) * (f.heavy ? 5 : 4), vy: Math.sin(a) * (f.heavy ? 5 : 4), dmg: f.heavy ? 16 : 8, life: 4, color: f.color, size: f.heavy ? 0.3 : 0.2 });
        f.cd = this.r(1.5, 2.8) * (f.heavy ? 1.3 : 1);
      }
      const want = f.ranged ? (dist > 4 ? 1 : dist < 2.5 ? -0.6 : 0) : 1;
      if (want && dist > 0.6) {
        const a = Math.atan2(this.py - f.y, this.px - f.x) + (f.ranged ? Math.sin(f.anim) * 0.8 : 0), sp = f.speed * want * dt;
        const nx = f.x + Math.cos(a) * sp, ny = f.y + Math.sin(a) * sp;
        if (!this.cell(nx, f.y)) f.x = nx;
        if (!this.cell(f.x, ny)) f.y = ny;
      }
      if (!f.ranged && dist < 0.8 && f.cd <= 0) { this.hitPlayer(f.heavy ? 18 : 10); f.cd = 0.9; }
    }
    for (const s of this.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (this.cell(s.x, s.y)) { s.life = 0; if (s.splash) this.splash(s); continue; }
      if (s.mine) { for (const f of this.foes) if (f.hp > 0 && Math.hypot(f.x - s.x, f.y - s.y) < 0.4 * f.size + s.size * 0.5) { this.damage(f, s.dmg); s.life = 0; if (s.splash) this.splash(s); break; } }
      else if (Math.hypot(this.px - s.x, this.py - s.y) < 0.35) { this.hitPlayer(s.dmg); s.life = 0; }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const it of this.items) if (!it.got && Math.hypot(it.x - this.px, it.y - this.py) < 0.5) this.pickup(it);
    this.items = this.items.filter((i) => !i.got);
    const alive = this.foes.some((f) => f.hp > 0);
    if (Math.hypot(this.exit[0] + 0.5 - this.px, this.exit[1] + 0.5 - this.py) < 0.8 && (!alive || !this.auto)) { this.level++; this.score += 500; this.newLevel(false); }
    if (!alive && this.auto && !this.path.length && !this.items.length) this.path = this.bfs(this.exit[0], this.exit[1]);
  }
  splash(s) { for (const f of this.foes) if (f.hp > 0 && Math.hypot(f.x - s.x, f.y - s.y) < 1.4) this.damage(f, s.dmg * 0.5); }
  pickup(it) {
    it.got = true; this.score += 25;
    const k = it.kind;
    if (k === 'health') this.hp = Math.min(this.mods.glass ? 30 : 100, this.hp + 25);
    else if (k === 'armor') this.armor = Math.min(100, this.armor + 50);
    else if (k === 'shells') this.ammo.shells += 8;
    else if (k === 'bullets') this.ammo.bullets += 40;
    else if (k === 'cells') this.ammo.cells += 6;
    else { const i = +k[3]; this.owned[i] = true; this.ammo[this.guns[i].ammo] += 12; this.weapon = i; }
  }
  hitPlayer(d) {
    const soak = Math.min(this.armor, d * 0.5); this.armor -= soak;
    this.hp -= d - soak; this.hurt = 0.2;
    if (this.hp <= 0) { this.score = Math.max(0, this.score - 300); this.newLevel(true); }
  }
  drawSky(c, horizon) {
    const g = c.createLinearGradient(0, 0, 0, horizon); g.addColorStop(0, this.pal.bg2); g.addColorStop(1, this.col(4)); c.fillStyle = g; c.fillRect(0, 0, W, horizon);
    if (ready(this.sky)) {
      // panorama scrolls with the view angle
      const iw = this.sky.naturalWidth || this.sky.width, ih = this.sky.naturalHeight || this.sky.height;
      const sh = horizon, sw = (iw / ih) * sh * 1.6, off = (((this.pa / (Math.PI * 2)) * sw * 2) % sw + sw) % sw;
      c.globalAlpha = 0.85;
      for (let x = -off; x < W; x += sw) c.drawImage(this.sky, x, 0, sw, sh);
      c.globalAlpha = 1;
    } else {
      c.fillStyle = 'rgba(255,255,255,.18)';
      for (let k = 0; k < 7; k++) { const x = ((k * 97 - this.pa * 120) % (W + 120) + W + 120) % (W + 120) - 60; c.beginPath(); c.ellipse(x, 30 + (k % 3) * 22, 50, 12, 0, 0, 7); c.fill(); }
    }
  }
  draw(c) {
    const fov = 1.1, cols = 160, cw = W / cols, horizon = H * 0.46, viewH = H - 34;
    this.drawSky(c, horizon);
    const floorIn = c.createLinearGradient(0, horizon, 0, viewH); floorIn.addColorStop(0, '#120e0b'); floorIn.addColorStop(1, this.col(5));
    const floorOut = c.createLinearGradient(0, horizon, 0, viewH); floorOut.addColorStop(0, this.col(2)); floorOut.addColorStop(1, '#1a1410');
    const ceil = c.createLinearGradient(0, 0, 0, horizon); ceil.addColorStop(0, '#0b0807'); ceil.addColorStop(1, this.pal.bg);
    const zbuf = new Float32Array(cols);
    for (let i = 0; i < cols; i++) {
      const ra = this.pa + (i / cols - 0.5) * fov;
      const r = this.rayCast(this.px, this.py, ra);
      const dist = r.dist * Math.cos(ra - this.pa);
      zbuf[i] = dist;
      const h = Math.min(H * 3, (H * 0.85) / Math.max(0.06, dist)), top = horizon - h / 2, x = i * cw;
      // indoor columns get a ceiling; columns looking into a courtyard keep the sky
      if (!r.open) { c.fillStyle = ceil; c.fillRect(x, 0, cw + 0.6, Math.max(0, top)); }
      c.fillStyle = r.open ? floorOut : floorIn; c.fillRect(x, top + h, cw + 0.6, viewH - top - h);
      c.drawImage(this.tex[r.w % 5], Math.floor(r.hit * 63), 0, 1, 64, x, top, cw + 0.6, h);
      c.fillStyle = `rgba(6,4,3,${Math.min(0.85, (r.side ? 0.22 : 0) + dist / (r.open ? 22 : 14))})`; c.fillRect(x, top, cw + 0.6, h);
    }
    const sprites = [
      ...this.foes.filter((f) => f.hp > 0 || f.hit > -0.4).map((f) => ({ s: f, t: 'foe' })),
      ...this.items.map((i) => ({ s: i, t: 'item' })),
      ...this.deco.map((d) => ({ s: d, t: 'deco' })),
      ...this.shots.map((s) => ({ s, t: 'shot' })),
      { s: { x: this.exit[0] + 0.5, y: this.exit[1] + 0.5 }, t: 'exit' }
    ].map((o) => ({ ...o, d: Math.hypot(o.s.x - this.px, o.s.y - this.py) })).sort((a, b) => b.d - a.d);
    for (const { s, t, d } of sprites) {
      const ang = this.angTo(s.x, s.y);
      if (Math.abs(ang) > fov * 0.75) continue;
      const dist = d * Math.cos(ang);
      if (dist < 0.15) continue;
      const sx = (ang / fov + 0.5) * W, floor = horizon + (H * 0.85) / dist / 2;
      if (t === 'exit') {
        if (zbuf[Math.max(0, Math.min(cols - 1, Math.floor(sx / cw)))] < dist) continue;
        const r = (H * 0.35) / dist, pulse = 1 + Math.sin(this.t * 4) * 0.08;
        c.strokeStyle = this.foes.some((f) => f.hp > 0) ? 'rgba(255,60,40,.55)' : 'rgba(120,255,200,.85)'; c.lineWidth = Math.max(1.5, r * 0.12);
        c.beginPath(); c.ellipse(sx, floor - r * 0.9, r * 0.5 * pulse, r * 0.9 * pulse, 0, 0, 7); c.stroke();
        continue;
      }
      if (t === 'shot') {
        if (zbuf[Math.max(0, Math.min(cols - 1, Math.floor(sx / cw)))] < dist) continue;
        const r = Math.max(2, ((s.size || 0.2) * H * 0.6) / dist);
        if (s.img && ready(s.img)) { c.save(); c.translate(sx, horizon + r * 0.2); c.rotate(this.t * (s.spin || 0)); c.drawImage(s.img, -r, -r, r * 2, r * 2); c.restore(); }
        else { c.fillStyle = s.color || '#ff8a3a'; c.globalAlpha = 0.9; c.beginPath(); c.arc(sx, horizon, r, 0, 7); c.fill(); c.globalAlpha = 1; }
        continue;
      }
      let im, size, top;
      if (t === 'foe') {
        const dead = s.hp <= 0;
        im = s.m.frames[Math.floor(s.anim * (s.kind === 'demon' ? 6 : 3)) % 2];
        size = ((H * 0.7) / dist) * s.size * this.S * (dead ? 1 + s.hit : 1);
        top = s.fly ? horizon - size * 0.6 + Math.sin(s.anim * 2) * size * 0.1 : floor - size;
      } else if (t === 'deco') { im = s.i; size = ((H * 0.75) / dist) * s.big; top = floor - size; }
      else { im = s.i; size = (H * 0.28) / dist; top = floor - size - Math.sin(this.t * 3 + s.bob) * size * 0.1; }
      if (!ready(im)) continue;
      const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, w = size * (iw / ih), x0 = sx - w / 2;
      c.imageSmoothingEnabled = !im.pixel;
      for (let k = Math.max(0, Math.floor(x0 / cw)); k < Math.min(cols, Math.ceil((x0 + w) / cw)); k++) {
        if (zbuf[k] < dist) continue;
        const u = (k * cw - x0) / w;
        c.drawImage(im, Math.min(iw - 1, Math.floor(u * iw)), 0, 1, ih, k * cw, top, cw + 0.6, size);
      }
      c.imageSmoothingEnabled = true;
      if (t === 'foe' && s.hit > 0) { c.fillStyle = 'rgba(255,40,20,.35)'; c.fillRect(x0, top, w, size); }
    }
    this.drawGun(c, viewH, horizon);
    if (this.hurt > 0) { c.fillStyle = 'rgba(200,20,10,.32)'; c.fillRect(0, 0, W, viewH); }
    this.drawHud(c, viewH);
  }
  drawGun(c, viewH, horizon) {
    const g = this.guns[this.weapon], bob = Math.sin(this.t * 7) * 3, rec = this.recoil * 14, gx = W / 2, gy = viewH + rec + bob;
    const body = this.col(g.hue), dark = '#1d1814';
    const len = { sidearm: 70, scatter: 82, rapid: 88, heavy: 74 }[g.arch], wid = { sidearm: 18, scatter: 40, rapid: 46, heavy: 54 }[g.arch];
    c.fillStyle = dark; c.fillRect(gx - wid / 2 - 3, gy - len + 8, wid + 6, len);
    c.fillStyle = body; c.fillRect(gx - wid / 2, gy - len + 10, wid, len - 10);
    c.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 4; k++) c.fillRect(gx - wid / 2, gy - len + 22 + k * 12, wid, 2);
    if (g.arch === 'scatter' || g.arch === 'rapid') { c.fillStyle = dark; const n = g.arch === 'rapid' ? 4 : 2; for (let k = 0; k < n; k++) c.fillRect(gx - wid / 2 + 4 + k * ((wid - 8) / n), gy - len - 14, (wid - 8) / n - 3, 28); }
    if (ready(g.bullet)) { c.globalAlpha = 0.9; c.drawImage(g.bullet, gx - 10, gy - len - 4, 20, 20); c.globalAlpha = 1; }
    if (this.flash > 0) { c.fillStyle = '#ffd27a'; c.globalAlpha = 0.85; c.beginPath(); c.arc(gx, gy - len - 18, 16, 0, 7); c.fill(); c.globalAlpha = 1; }
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(gx - 6, horizon); c.lineTo(gx + 6, horizon); c.moveTo(gx, horizon - 6); c.lineTo(gx, horizon + 6); c.stroke();
  }
  drawHud(c, viewH) {
    c.fillStyle = '#1b1612'; c.fillRect(0, viewH, W, H - viewH);
    c.fillStyle = '#3a2f27'; c.fillRect(0, viewH, W, 2);
    this.text(c, `${Math.max(0, Math.ceil(this.hp))}%`, 26, viewH + 18, 14, this.hp < 30 ? '#ff5a3a' : '#ffd27a');
    this.text(c, `${Math.ceil(this.armor)}`, 66, viewH + 18, 12, '#7ad7ff');
    const g = this.guns[this.weapon];
    this.text(c, String(g.ammo ? this.ammo[g.ammo] : '∞'), 112, viewH + 18, 13, '#f0e6d8');
    this.guns.forEach((x, i) => {
      c.fillStyle = i === this.weapon ? this.col(0) : this.owned[i] ? '#4a403a' : '#241e19';
      c.fillRect(150 + i * 52, viewH + 6, 48, 24);
      this.text(c, x.name.split(' ')[1].slice(0, 7), 174 + i * 52, viewH + 18, 8, this.owned[i] ? '#fff' : '#665');
    });
    const ms = 3;
    c.globalAlpha = 0.6;
    for (let y = 0; y < this.N; y++) for (let x = 0; x < this.N; x++) {
      if (this.map[y][x]) { c.fillStyle = this.col(this.map[y][x]); c.fillRect(W - this.N * ms - 6 + x * ms, 36 + y * ms, ms, ms); }
      else if (this.out[y][x]) { c.fillStyle = 'rgba(140,200,120,.35)'; c.fillRect(W - this.N * ms - 6 + x * ms, 36 + y * ms, ms, ms); }
    }
    c.fillStyle = '#ff3b2f'; c.fillRect(W - this.N * ms - 6 + this.exit[0] * ms, 36 + this.exit[1] * ms, ms, ms);
    c.fillStyle = '#fff'; c.fillRect(W - this.N * ms - 6 + this.px * ms - 1.5, 36 + this.py * ms - 1.5, 3, 3);
    c.globalAlpha = 1;
    this.text(c, g.name, W / 2, viewH - 10, 10, 'rgba(255,255,255,.7)');
  }
  hud() { const left = this.foes.filter((f) => f.hp > 0).length; return `${this.score} · lvl ${this.level + 1} · ${left} left`; }
}
