// Doom-style raycaster: generated rooms + corridors, four weapons, pickups, and a
// cast of procedurally generated monsters (melee, ranged, flying, brute).
import { Game, W, H, ready } from './engine.js';
import { creatureName } from './creature.js';

const WEAPONS = [
  { name: 'PISTOL', dmg: 12, rate: 0.38, ammo: null, pellets: 1, spread: 0.02 },
  { name: 'SHOTGUN', dmg: 9, rate: 0.85, ammo: 'shells', pellets: 7, spread: 0.13 },
  { name: 'CHAINGUN', dmg: 8, rate: 0.09, ammo: 'bullets', pellets: 1, spread: 0.05 },
  { name: 'PLASMA', dmg: 30, rate: 0.2, ammo: 'cells', pellets: 0, spread: 0 }
];
const KINDS = [
  { kind: 'imp', hp: 30, speed: 1.1, ranged: true, size: 0.75, color: '#ff8a3a' },
  { kind: 'demon', hp: 55, speed: 2.1, ranged: false, size: 0.8 },
  { kind: 'floater', hp: 40, speed: 0.9, ranged: true, size: 0.7, fly: true, color: '#7ad7ff' },
  { kind: 'brute', hp: 140, speed: 0.7, ranged: true, size: 1.15, color: '#b6ff6a', heavy: true }
];

export class Doom extends Game {
  static noMods = ['mirror', 'wobble'];
  setup() {
    this.level = 0; this.kills = 0;
    // a unique cast for this game: four monster types, each with its own generated sprite
    this.crew = KINDS.map((k, i) => ({ ...k, m: this.skin.creatures[i + 1], name: creatureName((this.post.seed || 1) + i * 101) }));
    this.newLevel(true);
  }
  newLevel(fresh) {
    const N = 26;
    const m = Array.from({ length: N }, () => Array(N).fill(1));
    const rooms = [];
    for (let tries = 0; tries < 60 && rooms.length < 8 + Math.min(4, this.level); tries++) {
      const w = this.ri(4, 8), h = this.ri(4, 8), x = this.ri(1, N - w - 1), y = this.ri(1, N - h - 1);
      if (rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
      rooms.push({ x, y, w, h, tex: this.ri(1, 4) });
    }
    for (const r of rooms) {
      for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) m[yy][xx] = 0;
      if (r.w >= 6 && r.h >= 6 && this.rng() < 0.6) for (const [px, py] of [[2, 2], [r.w - 3, 2], [2, r.h - 3], [r.w - 3, r.h - 3]]) m[r.y + py][r.x + px] = r.tex;
    }
    const center = (r) => [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];
    for (let i = 1; i < rooms.length; i++) {
      let [x0, y0] = center(rooms[i - 1]); const [x1, y1] = center(rooms[i]);
      const wide = this.rng() < 0.4;
      while (x0 !== x1) { m[y0][x0] = 0; if (wide) m[y0 + 1][x0] = 0; x0 += Math.sign(x1 - x0); }
      while (y0 !== y1) { m[y0][x0] = 0; if (wide) m[y0][x0 + 1] = 0; y0 += Math.sign(y1 - y0); }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y][x] === 1) { const near = rooms.find((r) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h); m[y][x] = near ? near.tex : 1; }
    const last = rooms[rooms.length - 1];
    this.exit = [last.x + last.w - 1, last.y];
    m[this.exit[1]][this.exit[0]] = 0;
    this.map = m; this.N = N; this.rooms = rooms;
    const [sx, sy] = center(rooms[0]);
    this.px = sx + 0.5; this.py = sy + 0.5; this.pa = this.r(0, 6.28);
    if (fresh) { this.hp = this.mods.glass ? 30 : 100; this.armor = 0; this.ammo = { shells: 8, bullets: 40, cells: 0 }; this.owned = [true, true, false, false]; this.weapon = 0; }
    this.cool = 0; this.flash = 0; this.recoil = 0; this.path = []; this.shots = []; this.hurt = 0;
    this.tex = [0, 1, 2, 3, 4].map((k) => this.makeTex(k));
    this.exitTex = this.makeTex(9, true);
    const free = [];
    for (const r of rooms.slice(1)) for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) if (!m[yy][xx]) free.push([xx, yy]);
    const take = () => free.splice(this.ri(0, free.length - 1), 1)[0];
    const n = Math.round((6 + this.level * 2) * (this.mods.swarm ? 1.7 : 1));
    this.foes = [];
    for (let i = 0; i < n && free.length; i++) {
      const [x, y] = take();
      const t = this.crew[i % 7 === 6 ? 3 : this.ri(0, 2)];
      this.foes.push({ ...t, x: x + 0.5, y: y + 0.5, hp: t.hp * (1 + this.level * 0.15), max: t.hp, awake: false, cd: this.r(0.5, 2), hit: 0, anim: this.r(0, 2) });
    }
    const PICKS = ['health', 'armor', 'shells', 'bullets', 'cells', 'shotgun', 'chaingun', 'plasma'];
    this.items = [];
    for (let i = 0; i < 9 && free.length; i++) {
      const [x, y] = take();
      const kind = i < 3 ? PICKS[5 + ((i + this.level) % 3)] : PICKS[this.ri(0, 4)];
      this.items.push({ x: x + 0.5, y: y + 0.5, kind, i: this.skin.pick(`pick-${kind}`, 'item', 'ball'), bob: this.r(0, 6) });
    }
  }
  makeTex(k, exit) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    const paint = () => {
      x.fillStyle = exit ? '#3a0a0a' : this.col(k + 1); x.fillRect(0, 0, 64, 64);
      const t = this.skin.slots.tile[k % this.skin.slots.tile.length];
      if (ready(t) && !exit) { x.globalAlpha = 0.85; x.imageSmoothingEnabled = !t.pixel; x.drawImage(t, 0, 0, 64, 64); x.globalAlpha = 1; }
      x.fillStyle = 'rgba(0,0,0,.28)';
      for (let r = 0; r < 8; r++) for (let q = 0; q < 4; q++) { x.fillRect(q * 16 + (r % 2) * 8, r * 8, 15, 1); x.fillRect(q * 16 + (r % 2) * 8, r * 8, 1, 7); }
      if (exit) { x.fillStyle = '#ff3b2f'; x.font = 'bold 18px monospace'; x.textAlign = 'center'; x.fillText('EXIT', 32, 38); }
      else if (k % 2) { const deco = this.skin.pick(`walldeco${k}`, 'item', 'enemy'); if (ready(deco)) { x.globalAlpha = 0.7; x.drawImage(deco, 20, 18, 24, 24); x.globalAlpha = 1; } }
    };
    paint();
    const t = this.skin.slots.tile[k % this.skin.slots.tile.length];
    if (t && !ready(t)) t.addEventListener?.('load', paint, { once: true });
    return cv;
  }
  cell(x, y) { const X = Math.floor(x), Y = Math.floor(y); return X < 0 || Y < 0 || X >= this.N || Y >= this.N ? 1 : this.map[Y][X]; }
  cast(px, py, a) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy), sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let sdx = (dx < 0 ? px - mx : mx + 1 - px) * ddx, sdy = (dy < 0 ? py - my : my + 1 - py) * ddy, side = 0;
    for (let i = 0; i < 80; i++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
      const w = this.cell(mx + 0.5, my + 0.5);
      if (w) {
        const dist = side ? sdy - ddy : sdx - ddx;
        let hit = side ? px + dist * dx : py + dist * dy; hit -= Math.floor(hit);
        return { dist, side, hit, w, exit: mx === this.exit[0] && my === this.exit[1] };
      }
    }
    return { dist: 80, side: 0, hit: 0, w: 1 };
  }
  los(ax, ay, bx, by) { return this.cast(ax, ay, Math.atan2(by - ay, bx - ax)).dist >= Math.hypot(bx - ax, by - ay) - 0.25; }
  angTo(x, y) { let d = Math.atan2(y - this.py, x - this.px) - this.pa; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  nudge(dx, dy) {
    const m = 0.22;
    if (!this.cell(this.px + dx + Math.sign(dx) * m, this.py)) this.px += dx;
    if (!this.cell(this.px, this.py + dy + Math.sign(dy) * m)) this.py += dy;
  }
  walk(f, strafe, dt) {
    const c = Math.cos(this.pa), s = Math.sin(this.pa);
    this.nudge((c * f - s * strafe) * dt, (s * f + c * strafe) * dt);
  }
  canUse(i) { const w = WEAPONS[i]; return this.owned[i] && (!w.ammo || this.ammo[w.ammo] > 0); }
  fire() {
    if (this.cool > 0) return;
    if (!this.canUse(this.weapon)) { this.weapon = 0; }
    const w = WEAPONS[this.weapon];
    if (w.ammo) this.ammo[w.ammo]--;
    this.cool = w.rate; this.flash = 0.07; this.recoil = 1;
    if (!w.pellets) { this.shots.push({ x: this.px, y: this.py, vx: Math.cos(this.pa) * 9, vy: Math.sin(this.pa) * 9, dmg: w.dmg, mine: true, life: 3 }); return; }
    for (let p = 0; p < w.pellets; p++) {
      const a = this.pa + this.r(-w.spread, w.spread);
      const wall = this.cast(this.px, this.py, a).dist;
      let best = null;
      for (const f of this.foes) {
        if (f.hp <= 0) continue;
        const d = Math.hypot(f.x - this.px, f.y - this.py);
        if (d > wall) continue;
        let da = Math.atan2(f.y - this.py, f.x - this.px) - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) < Math.atan2(0.35 * f.size, d) && (!best || d < best.d)) best = { f, d };
      }
      if (best) this.damage(best.f, w.dmg * (best.d < 2 ? 1.3 : 1));
    }
  }
  damage(f, dmg) {
    f.hp -= dmg; f.hit = 0.12; f.awake = true;
    if (f.hp <= 0) { this.kills++; this.score += Math.round(f.max); this.burst(W / 2, H * 0.45, f.color || this.col(0), 16, 180); }
  }
  bestWeapon(dist, foe) {
    const order = foe?.heavy ? [3, 1, 2, 0] : dist < 2.5 ? [1, 2, 3, 0] : dist < 6 ? [2, 3, 1, 0] : [3, 2, 0, 1];
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
  autopilot(dt) {
    const alive = this.foes.filter((f) => f.hp > 0);
    const vis = alive.filter((f) => Math.hypot(f.x - this.px, f.y - this.py) < 12 && this.los(this.px, this.py, f.x, f.y)).sort((a, b) => Math.hypot(a.x - this.px, a.y - this.py) - Math.hypot(b.x - this.px, b.y - this.py))[0];
    if (vis) {
      const d = this.angTo(vis.x, vis.y), dist = Math.hypot(vis.x - this.px, vis.y - this.py);
      this.weapon = this.bestWeapon(dist, vis);
      this.pa += Math.sign(d) * Math.min(Math.abs(d), 3.6 * dt);
      if (Math.abs(d) < 0.07) this.fire();
      this.strafeT = (this.strafeT || 0) - dt;
      if (this.strafeT <= 0) { this.strafeDir = this.rng() < 0.5 ? -1 : 1; this.strafeT = this.r(0.4, 1.2); }
      this.walk(dist > 4 ? 1.6 : dist < 1.6 && !vis.ranged ? -1.4 : 0, this.strafeDir * 1.3, dt);
      this.path = [];
      return;
    }
    if (!this.path.length) {
      const want = this.hp < 50 ? this.items.find((i) => i.kind === 'health') : null;
      const goal = want || this.items.find((i) => ['shotgun', 'chaingun', 'plasma'].includes(i.kind)) || alive[0] || this.items[0] || { x: this.exit[0] + 0.5, y: this.exit[1] + 0.5 };
      const target = alive.length || goal !== alive[0] ? goal : { x: this.exit[0] + 0.5, y: this.exit[1] + 0.5 };
      this.path = this.bfs(Math.floor(target.x), Math.floor(target.y));
      if (!alive.length && !this.path.length) this.path = this.bfs(this.exit[0], this.exit[1] + 1);
    }
    const wp = this.path[0];
    if (!wp) return;
    const d = this.angTo(wp[0], wp[1]);
    this.pa += Math.sign(d) * Math.min(Math.abs(d), 4 * dt);
    if (Math.abs(d) < 0.6) this.walk(2.2, 0, dt);
    if (Math.hypot(wp[0] - this.px, wp[1] - this.py) < 0.3) this.path.shift();
  }
  // touch controls: drag sideways to turn, up/down to walk, tap to fire, tap the HUD to switch weapons
  down(x, y) { this.drag = { x, y, sx: x, sy: y, t: this.t, moved: false }; if (y > H - 34) { const i = Math.floor((x - 170) / 46); if (i >= 0 && i < 4 && this.owned[i]) this.weapon = i; this.drag = null; } }
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
        this.shots.push({ x: f.x, y: f.y, vx: Math.cos(a) * (f.heavy ? 5 : 4), vy: Math.sin(a) * (f.heavy ? 5 : 4), dmg: f.heavy ? 18 : 9, life: 4, color: f.color });
        f.cd = this.r(1.4, 2.6) * (f.heavy ? 1.3 : 1);
      }
      const want = f.ranged ? (dist > 4 ? 1 : dist < 2.5 ? -0.6 : 0) : 1;
      if (want && dist > 0.6) {
        const a = Math.atan2(this.py - f.y, this.px - f.x) + (f.ranged ? Math.sin(f.anim) * 0.8 : 0), sp = f.speed * want * dt;
        const nx = f.x + Math.cos(a) * sp, ny = f.y + Math.sin(a) * sp;
        if (!this.cell(nx, f.y)) f.x = nx;
        if (!this.cell(f.x, ny)) f.y = ny;
      }
      if (!f.ranged && dist < 0.8 && f.cd <= 0) { this.hitPlayer(f.heavy ? 20 : 12); f.cd = 0.8; }
    }
    for (const s of this.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (this.cell(s.x, s.y)) { s.life = 0; continue; }
      if (s.mine) { for (const f of this.foes) if (f.hp > 0 && Math.hypot(f.x - s.x, f.y - s.y) < 0.4 * f.size) { this.damage(f, s.dmg); s.life = 0; break; } }
      else if (Math.hypot(this.px - s.x, this.py - s.y) < 0.35) { this.hitPlayer(s.dmg); s.life = 0; }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const it of this.items) if (!it.got && Math.hypot(it.x - this.px, it.y - this.py) < 0.5) this.pickup(it);
    this.items = this.items.filter((i) => !i.got);
    const alive = this.foes.some((f) => f.hp > 0);
    if (Math.hypot(this.exit[0] + 0.5 - this.px, this.exit[1] + 0.5 - this.py) < 0.8 && (!alive || !this.auto)) { this.level++; this.score += 500; this.newLevel(false); }
    if (!alive && this.auto && !this.path.length) this.path = this.bfs(this.exit[0], this.exit[1]);
  }
  pickup(it) {
    it.got = true; this.score += 25;
    const k = it.kind;
    if (k === 'health') this.hp = Math.min(this.mods.glass ? 30 : 100, this.hp + 25);
    else if (k === 'armor') this.armor = Math.min(100, this.armor + 50);
    else if (k === 'shells') this.ammo.shells += 8;
    else if (k === 'bullets') this.ammo.bullets += 40;
    else if (k === 'cells') this.ammo.cells += 20;
    else { const i = { shotgun: 1, chaingun: 2, plasma: 3 }[k]; this.owned[i] = true; this.ammo[WEAPONS[i].ammo] += 12; this.weapon = i; }
  }
  hitPlayer(d) {
    const soak = Math.min(this.armor, d * 0.5); this.armor -= soak;
    this.hp -= d - soak; this.hurt = 0.2;
    if (this.hp <= 0) { this.score = Math.max(0, this.score - 300); this.newLevel(true); }
  }
  draw(c) {
    const fov = 1.1, cols = 160, cw = W / cols, horizon = H * 0.46, viewH = H - 34;
    let g = c.createLinearGradient(0, 0, 0, horizon); g.addColorStop(0, this.pal.bg); g.addColorStop(1, this.pal.bg2);
    c.fillStyle = g; c.fillRect(0, 0, W, horizon);
    g = c.createLinearGradient(0, horizon, 0, viewH); g.addColorStop(0, '#120e0b'); g.addColorStop(1, this.col(5)); c.fillStyle = g; c.fillRect(0, horizon, W, viewH - horizon);
    const zbuf = new Float32Array(cols);
    for (let i = 0; i < cols; i++) {
      const ra = this.pa + (i / cols - 0.5) * fov;
      const r = this.cast(this.px, this.py, ra);
      const dist = r.dist * Math.cos(ra - this.pa);
      zbuf[i] = dist;
      const h = Math.min(H * 4, (H * 0.85) / Math.max(0.05, dist));
      const tex = r.exit ? this.exitTex : this.tex[r.w % 5];
      c.drawImage(tex, Math.floor(r.hit * 63), 0, 1, 64, i * cw, horizon - h / 2, cw + 0.6, h);
      c.fillStyle = `rgba(6,4,3,${Math.min(0.85, (r.side ? 0.22 : 0) + dist / 15)})`; c.fillRect(i * cw, horizon - h / 2, cw + 0.6, h);
    }
    const sprites = [
      ...this.foes.filter((f) => f.hp > 0 || f.hit > -0.4).map((f) => ({ s: f, t: 'foe' })),
      ...this.items.map((i) => ({ s: i, t: 'item' })),
      ...this.shots.map((s) => ({ s, t: 'shot' }))
    ].map((o) => ({ ...o, d: Math.hypot(o.s.x - this.px, o.s.y - this.py) })).sort((a, b) => b.d - a.d);
    for (const { s, t, d } of sprites) {
      const ang = this.angTo(s.x, s.y);
      if (Math.abs(ang) > fov * 0.75) continue;
      const dist = d * Math.cos(ang);
      if (dist < 0.15) continue;
      const sx = (ang / fov + 0.5) * W;
      const col = Math.floor(sx / cw);
      if (t === 'shot') {
        if (zbuf[Math.max(0, Math.min(cols - 1, col))] < dist) continue;
        const r = Math.max(1.5, 10 / dist);
        c.fillStyle = s.mine ? '#7ad7ff' : s.color || '#ff8a3a'; c.globalAlpha = 0.9; c.beginPath(); c.arc(sx, horizon, r, 0, 7); c.fill();
        c.globalAlpha = 0.3; c.beginPath(); c.arc(sx, horizon, r * 2, 0, 7); c.fill(); c.globalAlpha = 1;
        continue;
      }
      let im, size;
      if (t === 'foe') {
        const dead = s.hp <= 0;
        im = s.m.frames[Math.floor(s.anim * (s.kind === 'demon' ? 6 : 3)) % 2];
        size = ((H * 0.7) / dist) * s.size * this.S * (dead ? 1 + s.hit : 1);
      } else { im = s.i; size = (H * 0.28) / dist; }
      if (!ready(im)) continue;
      const iw = im.width || im.naturalWidth, ih = im.height || im.naturalHeight, w = size * (iw / ih);
      const floor = horizon + (H * 0.85) / dist / 2;
      const top = t === 'foe' && s.fly ? horizon - size * 0.6 + Math.sin(s.anim * 2) * size * 0.1 : t === 'item' ? floor - size - Math.sin(this.t * 3 + s.bob) * size * 0.1 : floor - size;
      const x0 = sx - w / 2;
      c.imageSmoothingEnabled = !im.pixel;
      for (let k = Math.max(0, Math.floor(x0 / cw)); k < Math.min(cols, Math.ceil((x0 + w) / cw)); k++) {
        if (zbuf[k] < dist) continue;
        const u = (k * cw - x0) / w;
        c.drawImage(im, Math.min(iw - 1, Math.floor(u * iw)), 0, 1, ih, k * cw, top, cw + 0.6, size);
      }
      c.imageSmoothingEnabled = true;
      if (t === 'foe' && s.hit > 0) { c.fillStyle = 'rgba(255,40,20,.35)'; c.fillRect(x0, top, w, size); }
    }
    // weapon
    const w = WEAPONS[this.weapon], bob = Math.sin(this.t * 7) * 3, rec = this.recoil * 14, gx = W / 2, gy = viewH + rec + bob;
    c.fillStyle = '#2a2420'; c.strokeStyle = '#0c0a08'; c.lineWidth = 2;
    if (w.name === 'PISTOL') { c.fillRect(gx - 9, gy - 66, 18, 66); c.fillStyle = '#4a403a'; c.fillRect(gx - 5, gy - 78, 10, 16); }
    else if (w.name === 'SHOTGUN') { c.fillRect(gx - 22, gy - 54, 44, 54); c.fillStyle = '#4a403a'; c.fillRect(gx - 14, gy - 88, 11, 40); c.fillRect(gx + 3, gy - 88, 11, 40); }
    else if (w.name === 'CHAINGUN') { c.fillRect(gx - 26, gy - 50, 52, 50); c.fillStyle = '#4a403a'; for (let k = -2; k <= 2; k++) c.fillRect(gx + k * 8 - 3, gy - 92 + (Math.floor(this.t * 40) % 2) * 2, 6, 46); }
    else { c.fillStyle = '#2a3a44'; c.fillRect(gx - 24, gy - 60, 48, 60); c.fillStyle = '#7ad7ff'; c.fillRect(gx - 8, gy - 84, 16, 28); }
    if (this.flash > 0) { c.fillStyle = w.name === 'PLASMA' ? '#bfeeff' : '#ffd27a'; c.globalAlpha = 0.9; c.beginPath(); c.arc(gx, gy - 96, 16, 0, 7); c.fill(); c.globalAlpha = 1; }
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(gx - 6, horizon); c.lineTo(gx + 6, horizon); c.moveTo(gx, horizon - 6); c.lineTo(gx, horizon + 6); c.stroke();
    if (this.hurt > 0) { c.fillStyle = 'rgba(200,20,10,.32)'; c.fillRect(0, 0, W, viewH); }
    // HUD
    c.fillStyle = '#1b1612'; c.fillRect(0, viewH, W, H - viewH);
    c.fillStyle = '#3a2f27'; c.fillRect(0, viewH, W, 2);
    this.text(c, `${Math.max(0, Math.ceil(this.hp))}%`, 30, viewH + 18, 15, this.hp < 30 ? '#ff5a3a' : '#ffd27a');
    this.text(c, `${Math.ceil(this.armor)}`, 76, viewH + 18, 13, '#7ad7ff');
    const am = w.ammo ? this.ammo[w.ammo] : '∞';
    this.text(c, String(am), 128, viewH + 18, 14, '#f0e6d8');
    WEAPONS.forEach((x, i) => { c.fillStyle = i === this.weapon ? this.col(0) : this.owned[i] ? '#4a403a' : '#241e19'; c.fillRect(170 + i * 46, viewH + 6, 42, 24); this.text(c, x.name.slice(0, 4), 191 + i * 46, viewH + 18, 9, this.owned[i] ? '#fff' : '#665'); });
    // minimap
    const ms = 3;
    c.globalAlpha = 0.65;
    for (let y = 0; y < this.N; y++) for (let x = 0; x < this.N; x++) if (this.map[y][x]) { c.fillStyle = this.col(this.map[y][x]); c.fillRect(W - this.N * ms - 6 + x * ms, 36 + y * ms, ms, ms); }
    c.fillStyle = '#ff3b2f'; c.fillRect(W - this.N * ms - 6 + this.exit[0] * ms, 36 + this.exit[1] * ms, ms, ms);
    c.fillStyle = '#fff'; c.fillRect(W - this.N * ms - 6 + this.px * ms - 1.5, 36 + this.py * ms - 1.5, 3, 3);
    c.globalAlpha = 1;
  }
  hud() { const left = this.foes.filter((f) => f.hp > 0).length; return `${this.score} · lvl ${this.level + 1} · ${left} left`; }
}
