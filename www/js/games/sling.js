// Side-view slingshot: the sling on the left, castles of wood, stone, glass and ice off
// to the right in a level wider than the screen. The camera surveys the castle, comes
// back to the sling, follows each shot and returns. Drag back from the sling and let
// go to fire; tap in flight for the shot's trick; drag the sky to look around.
// Targets are spirits from the creature engine; the shots are the hero spirit in a bubble.
import { Game, W, H, drawFit, ready } from './engine.js';
import { World, Body, box } from './rigid.js';
import { mulberry32 } from '../util.js';

const POUCH = { x: 0, y: -50 }, GS = 54, PULL = 72; // GS: the ground line's height above the screen bottom
const MAT = {
  wood: { d: 1, f: 0.75, e: 0.08, hp: 260, c: '#bb8549', c2: '#6b4220', pts: 50 },
  stone: { d: 2.4, f: 0.85, e: 0.04, hp: 440, c: '#a7a59e', c2: '#55544f', pts: 100 },
  glass: { d: 0.7, f: 0.35, e: 0.1, hp: 110, c: '#aee9f4', c2: '#3b97b0', pts: 30 },
  ice: { d: 0.85, f: 0.07, e: 0.05, hp: 160, c: '#e4f7ff', c2: '#7fb8d6', pts: 40 },
  tnt: { d: 0.9, f: 0.6, e: 0.1, hp: 70, c: '#d4462c', c2: '#5f170c', pts: 150 }
};
const SHOT = {
  basic: { r: 8, d: 3, c: '#ff6b4a', tip: '' },
  split: { r: 7, d: 3, c: '#ffd23f', tip: 'SPLIT' },
  bomb: { r: 9, d: 3.2, c: '#3d3b4a', tip: 'BOOM' },
  heavy: { r: 10.5, d: 9, c: '#8d939c', tip: 'SLAM' },
  boost: { r: 7.5, d: 3, c: '#46b4ff', tip: 'BOOST' }
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Sling extends Game {
  static noMods = ['mirror', 'wobble', 'trails'];
  setup() { this.levelN = 0; this.cam = { x: 400, z: 0.6 }; this.shake = 0; this.pats = {}; this.build(); }

  // ---------------------------------------------------------------- level
  build() {
    const R = mulberry32(((this.post.seed || 1) * 977 + this.levelN * 7919) >>> 0);
    this.R = R; this.lr = (a, b) => a + R() * (b - a); this.li = (a, b) => Math.floor(this.lr(a, b + 1));
    const w = this.world = new World(600 * this.G);
    w.onImpact = (a, b, J) => this.impact(a, b, J);
    this.vmax = 880 * Math.sqrt(this.G);
    this.spots = []; this.shots = []; this.fx = []; this.pops = []; this.trail = []; this.plan = null; this.planQ = null; this.manual = null;
    this.stat(box(4400, 400), 1500, 200, 'ground');
    const L = this.levelN;
    // a castle style, with early levels in the weaker materials
    const styles = [{ col: 'wood', beam: 'wood', fill: 'wood', alt: 'glass' }, { col: 'glass', beam: 'wood', fill: 'ice', alt: 'wood' }, { col: 'ice', beam: 'ice', fill: 'ice', alt: 'glass' },
      { col: 'wood', beam: 'stone', fill: 'stone', alt: 'glass' }, { col: 'stone', beam: 'wood', fill: 'stone', alt: 'wood' }, { col: 'stone', beam: 'stone', fill: 'wood', alt: 'glass' }];
    const M = styles[this.li(0, Math.min(5, 2 + L))];
    this.m = (k) => (R() < 0.2 ? M.alt : M[k]);
    let x = this.x0 = this.lr(360, 420) + Math.min(L, 6) * 12, plat = null;
    if (L > 0 && R() < 0.45) {
      const px = x + this.lr(0, 110), pw = this.lr(180, 290), ph = this.lr(28, 64);
      this.stat({ v: [[px, 0], [px + 28, -ph], [px + pw - 28, -ph], [px + pw, 0]] }, 0, 0, 'hill');
      plat = { a: px, x0: px + 30, x1: px + pw - 30, b: px + pw, y: -ph };
    }
    const pool = ['frames', 'tower', 'stilts', 'bunker', ...(L > 0 ? ['frames', 'tower', 'arch', 'wall'] : []), ...(L > 1 ? ['pyramid', 'arch', 'frames'] : [])];
    const nm = Math.min(5, 2 + ((L + 1) >> 1) + (L > 1 ? this.li(0, 1) : 0));
    for (let k = 0; k < nm && x < 1000; k++) {
      let y = 0, mw = 1080 - x;
      if (plat) {
        if (x < plat.a) { mw = plat.a - x - 4; if (mw < 60) x = plat.x0; }
        if (x >= plat.a && x < plat.x0) x = plat.x0;
        if (x >= plat.x0 && x < plat.x1) { y = plat.y; mw = plat.x1 - x; if (mw < 60) { x = plat.b + 6; y = 0; mw = 1080 - x; } }
        else if (x >= plat.x1 && x < plat.b + 6) { x = plat.b + 6; mw = 1080 - x; }
      }
      const kind = k === 0 && L > 2 && R() < 0.4 ? 'wall' : pool[this.li(0, pool.length - 1)];
      x = this[kind](x, y, Math.min(mw, 120)) + this.lr(10, 30);
      const top = plat && x >= plat.x0 && x + 18 <= plat.x1;
      if (L > 0 && R() < 0.22 && x < 1040 && (top || !plat || x + 18 < plat.a || x > plat.b)) { this.blk(x + 9, (top ? plat.y : 0) - 9, 18, 18, 'tnt'); x += 26; }
    }
    this.x1 = Math.max(x, this.x0 + 120, plat ? plat.b : 0);
    // targets: rooms first, then roofs, then the ground behind the castle
    const sp = this.spots.filter((s) => Math.min(s.w, s.h) >= 13);
    for (let i = sp.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [sp[i], sp[j]] = [sp[j], sp[i]]; }
    sp.sort((a, b) => (a.top || 0) - (b.top || 0));
    const want = Math.min(7, 2 + Math.floor(L * 0.6) + (this.mods.swarm ? 2 : 0));
    let n = 0;
    for (const s of sp) {
      if (n >= want) break;
      const boss = L > 2 && n === 0 && s.h > 28 && s.w > 28, r = Math.min(boss ? 14 : 11, s.w / 2 - 1, s.h / 2 - 1);
      this.target(s.x, s.y - r, r, boss); n++;
    }
    for (let k = 0; n < 2; k++, n++) this.target(this.x1 + 14 + k * 26, -9, 9); // the plateau, if any, ends before x1
    this.wl = -170; this.wr = this.x1 + 170;
    const types = ['basic', 'split', 'bomb', 'heavy', 'boost'];
    this.queue = Array.from({ length: Math.min(5, 3 + Math.floor(L / 3)) }, (_, k) => (!k ? 'basic' : L === 0 && k === 2 ? 'split' : types[this.li(0, 4)]));
    this.total = n; this.state = 'intro'; this.stT = 0;
    this.cam.x = (this.x0 + this.x1) / 2; this.cam.z = this.fitZ();
  }
  stat(shape, x, y, kind) { return this.world.add(new Body(shape, x, y, 0, { friction: 0.9, rest: 0.05, data: { kind } })); }
  blk(cx, cy, w, h, mat, data) {
    const m = MAT[mat];
    return this.world.add(new Body(data?.tri ? { v: [[-w / 2, h / 2], [w / 2, h / 2], [0, -h / 2]] } : box(w, h), cx, cy, m.d, { friction: m.f, rest: m.e, awake: false, data: { mat, hp: m.hp * (this.mods.glass ? 0.6 : 1), dmg: 0, bw: w, bh: h, ...data } }));
  }
  target(x, y, r, boss) {
    const m = this.skin.creatures[boss ? 5 : 1 + (this.world.bodies.length % 4)];
    this.world.add(new Body({ r }, x, y, 1, { friction: 0.8, rest: 0.2, awake: false, data: { target: true, m, hp: boss ? 320 : 150, dmg: 0, ph: this.R() * 2, hurtT: 0 } }));
  }
  // columns with a beam across: one storey of a frame; returns the beam's top
  storey(x, y, w, h, cols = 2) {
    const cw = 8, xs = cols === 3 ? [x + cw / 2, x + w / 2, x + w - cw / 2] : [x + cw / 2, x + w - cw / 2], col = this.m('col');
    for (const cx of xs) this.blk(cx, y - h / 2, cw, h, col);
    for (let i = 0; i < xs.length - 1; i++) this.spots.push({ x: (xs[i] + xs[i + 1]) / 2, y, w: xs[i + 1] - xs[i] - cw, h });
    this.blk(x + w / 2, y - h - 4, w, 8, this.m('beam'));
    return y - h - 8;
  }
  roof(x, y, w) {
    const k = this.R();
    if (k < 0.45) this.blk(x + w / 2, y - Math.min(34, w * 0.45) / 2, w * 0.92, Math.min(34, w * 0.45), this.m('fill'), { tri: true });
    else if (k < 0.7 && w > 50) { for (const s of [-1, 1]) this.blk(x + w / 2 + s * (w / 2 - 7), y - 7, 14, 14, this.m('fill')); this.spots.push({ x: x + w / 2, y, w: w - 30, h: 40, top: 1 }); }
    else this.spots.push({ x: x + w / 2, y, w, h: 40, top: 1 });
  }
  frames(x, y, mw) {
    let w = Math.min(mw, this.lr(66, 104)), lx = x;
    const W0 = w, n = this.li(1, Math.min(4, 2 + (this.levelN >> 1)));
    for (let k = 0; k < n; k++) {
      y = this.storey(lx, y, w, this.lr(32, 42), w > 92 ? 3 : 2);
      if (k < n - 1 && this.R() < 0.5 && w > 64) { lx += 8; w -= 16; }
    }
    this.roof(lx, y, w);
    return x + W0;
  }
  tower(x, y, mw) {
    const w = Math.min(mw, this.lr(38, 50)), n = this.li(2, Math.min(6, 3 + (this.levelN >> 1)));
    for (let k = 0; k < n; k++) y = this.storey(x, y, w, this.lr(28, 36));
    if (this.R() < 0.6) this.blk(x + w / 2, y - 15, w + 6, 30, this.m('fill'), { tri: true }); else this.spots.push({ x: x + w / 2, y, w, h: 40, top: 1 });
    return x + w;
  }
  pyramid(x, y, mw) {
    const s = this.lr(20, 25), n = Math.min(this.li(3, 5), Math.floor(mw / s)), mat = this.m('fill');
    for (let r = 0; r < n; r++) for (let k = 0; k < n - r; k++) this.blk(x + s / 2 + k * s + r * s / 2, y - s / 2 - r * s, s, s, mat);
    this.spots.push({ x: x + (n * s) / 2, y: y - n * s, w: s, h: 40, top: 1 });
    return x + n * s;
  }
  // a running-bond brick wall in front of whatever comes next
  wall(x, y, mw) {
    const bw = 24, bh = 12, c = Math.min(this.li(2, 3), Math.floor(mw / bw)), rows = this.li(3, 6), mat = this.m('fill');
    for (let r = 0; r < rows; r++) {
      const cy = y - bh / 2 - r * bh;
      if (r % 2 === 0) for (let k = 0; k < c; k++) this.blk(x + bw / 2 + k * bw, cy, bw, bh, mat);
      else { this.blk(x + bw / 4, cy, bw / 2, bh, mat); for (let k = 0; k < c - 1; k++) this.blk(x + bw + k * bw, cy, bw, bh, mat); this.blk(x + c * bw - bw / 4, cy, bw / 2, bh, mat); }
    }
    this.spots.push({ x: x + (c * bw) / 2, y: y - rows * bh, w: c * bw, h: 40, top: 1 });
    return x + c * bw;
  }
  // piers and an arched lintel, maybe with a storey on top
  arch(x, y, mw) {
    const span = Math.min(mw - 28, this.lr(30, 46)), ph = this.li(3, 4) * 12, mat = this.m('fill');
    for (const px of [x + 7, x + span + 21]) for (let k = 0; k < ph / 12; k++) this.blk(px, y - 6 - k * 12, 14, 12, mat);
    this.spots.push({ x: x + 14 + span / 2, y, w: span, h: ph });
    this.blk(x + 14 + span / 2, y - ph - 8, span + 28, 16, mat, { arch: true });
    const top = y - ph - 16;
    if (this.R() < 0.55) this.roof(x + 4, this.storey(x + 4, top, span + 20, this.lr(30, 36)), span + 20); else this.spots.push({ x: x + 14 + span / 2, y: top, w: span, h: 40, top: 1 });
    return x + span + 28;
  }
  // a platform on thin legs: knock the legs out
  stilts(x, y, mw) {
    const w = Math.min(mw, this.lr(48, 66)), h = this.lr(54, 86), mat = this.R() < 0.5 ? 'glass' : 'wood';
    for (const lx of [x + 3, x + w - 3]) this.blk(lx, y - h / 2, 6, h, mat);
    this.blk(x + w / 2, y - h - 4, w, 8, this.m('beam'));
    if (this.R() < 0.5) this.roof(x + 6, this.storey(x + 6, y - h - 8, w - 12, 30), w - 12); else this.spots.push({ x: x + w / 2, y: y - h - 8, w, h: 40, top: 1 });
    return x + w;
  }
  bunker(x, y, mw) {
    const mat = this.R() < 0.6 ? 'stone' : 'ice', gap = Math.min(mw - 30, this.lr(26, 32));
    for (const bx of [x + 7, x + gap + 21]) this.blk(bx, y - 12, 14, 24, mat);
    this.spots.push({ x: x + 14 + gap / 2, y, w: gap, h: 24 });
    this.blk(x + 14 + gap / 2, y - 28, gap + 30, 8, mat);
    if (this.R() < 0.5) this.spots.push({ x: x + 14 + gap / 2, y: y - 32, w: gap + 26, h: 40, top: 1 });
    return x + gap + 28;
  }
  fitZ() { return clamp((W * 0.9) / (this.x1 - this.x0 + 90), 0.45, 0.88); }
  targets() { return this.world.bodies.filter((b) => b.target); }

  // ---------------------------------------------------------------- damage
  impact(a, b, J) {
    for (const [p, q] of [[a, b], [b, a]]) {
      if (!p.invM || p.gone) continue;
      if (p.shot) { p.hitT ??= this.t; continue; }
      const dv = J * p.invM * (q.shot === 'heavy' ? 1.3 : 1);
      if (dv < 32) continue;
      if (p.target) this.hurt(p, dv - 20); else if (p.mat) this.damage(p, dv - 24);
      if (q.shot) this.focus = p.x;
    }
  }
  damage(b, d) { if (b.gone) return; b.dmg += d; if (b.dmg >= b.hp) this.smash(b); }
  smash(b) {
    this.world.remove(b);
    const m = MAT[b.mat];
    this.score += m.pts; this.pop(b.x, b.y, `+${m.pts}`, 9);
    for (let i = 0; i < 8; i++) this.fx.push({ k: 'shard', x: b.x + this.r(-b.bw, b.bw) / 2, y: b.y + this.r(-b.bh, b.bh) / 2, vx: this.r(-90, 90) + b.vx * 0.4, vy: this.r(-160, 20) + b.vy * 0.4, a: this.r(0, 6), va: this.r(-12, 12), w: this.r(3, 7), h: this.r(2, 4), c: m.c, life: this.r(0.6, 1.1) });
    if (b.mat === 'tnt') this.boom(b.x, b.y, 84, 640);
  }
  hurt(t, d) { if (t.gone) return; t.dmg += d; t.hurtT = 0.6; if (t.dmg >= t.hp) this.kill(t); }
  kill(t) {
    if (t.gone) return;
    this.world.remove(t); this.score += 500; this.pop(t.x, t.y - 10, '+500', 12);
    this.fx.push({ k: 'ghost', x: t.x, y: t.y, m: t.m, r: t.r, life: 0.8 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.fx.push({ k: 'puff', x: t.x, y: t.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 30, life: 0.5, s: this.r(3, 6), c: this.col(i) }); }
  }
  boom(x, y, R, P) {
    this.shake = Math.max(this.shake, 7);
    this.fx.push({ k: 'ring', x, y, r: R, life: 0.45 });
    for (let i = 0; i < 16; i++) { const a = this.r(0, 7), s = this.r(60, 260); this.fx.push({ k: 'puff', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: this.r(0.3, 0.7), s: this.r(3, 7), c: i % 3 ? '#ffb347' : '#fff1a8' }); }
    for (const b of [...this.world.bodies]) {
      if (!b.invM || b.gone) continue;
      const dx = b.x - x, dy = b.y - y, n = Math.hypot(dx, dy) || 1, d = Math.max(0, n - b.br * 0.5);
      if (d > R) continue;
      const f = 1 - d / R, k = P * f * Math.min(1.6, Math.sqrt(700 / b.mass));
      b.wake(); b.vx += (dx / n) * k; b.vy += (dy / n) * k - 80 * f; b.av += this.r(-5, 5) * f;
      if (b.target) this.hurt(b, 260 * f); else if (b.mat && !b.shot) this.damage(b, (b.mat === 'stone' ? 210 : 340) * f);
    }
  }
  pop(x, y, s, size) { this.pops.push({ x, y, s, size, t: 1 }); }

  // ---------------------------------------------------------------- shooting
  fire(vx, vy) {
    const type = this.queue.shift(), S = SHOT[type];
    const b = this.world.add(new Body({ r: S.r * this.S }, POUCH.x, POUCH.y, S.d, { friction: 0.6, rest: 0.3, data: { shot: type, life: 0, slow: 0 } }));
    b.vx = vx; b.vy = vy;
    this.shots.push(b); this.lead = b; this.used = false; this.trail = []; this.trailT = 0;
    this.state = 'fly'; this.stT = 0; this.pull = null; this.manual = null; this.focus = null;
  }
  ability() {
    const b = this.lead;
    if (!b || b.gone || this.used || (b.hitT && b.shot !== 'bomb')) return;
    this.used = true;
    const g = Math.sqrt(this.G);
    if (b.shot === 'split') {
      b.group = b.id;
      for (const da of [-0.2, 0.2]) {
        const c = Math.cos(da), s = Math.sin(da), nb = this.world.add(new Body({ r: b.r * 0.8 }, b.x, b.y, 3, { friction: 0.6, rest: 0.3, data: { shot: 'split', life: b.life, slow: 0, group: b.id } }));
        nb.vx = b.vx * c - b.vy * s; nb.vy = b.vx * s + b.vy * c; this.shots.push(nb);
      }
    } else if (b.shot === 'boost') { const v = Math.hypot(b.vx, b.vy) || 1, s = Math.max(v * 1.7, 950 * g); b.vx *= s / v; b.vy *= s / v; this.boosted = 0.5; }
    else if (b.shot === 'heavy') { b.vx *= 0.25; b.vy = Math.max(0, b.vy) + 900 * g; }
    else if (b.shot === 'bomb') { b.done = true; this.world.remove(b); this.boom(b.x, b.y, 80, 640); }
    else return;
    for (let i = 0; i < 10; i++) { const a = this.r(0, 7); this.fx.push({ k: 'puff', x: b.x, y: b.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.4, s: 3, c: SHOT[b.shot].c }); }
  }

  // ---------------------------------------------------------------- autopilot: simulate shots at targets and weak points
  trace(vx, vy, r) {
    let x = POUCH.x, y = POUCH.y;
    const g = this.world.g, dt = 1 / 120;
    for (let t = 0; t < 5; t += dt) {
      vy += g * dt; x += vx * dt; y += vy * dt;
      if ((x > this.bx0 - r && y > this.by0 - r) || y + r > 0) { const b = this.world.query(x, y, r); if (b) return { b, x, y, vx, vy, t }; }
      if (x > this.wr + 100) return null;
    }
    return null;
  }
  planStart() {
    const ts = this.targets(), pts = [], bs = this.world.bodies.filter((b) => b.mat || b.target || b.kind === 'hill');
    this.bx0 = Math.min(...bs.map((b) => b.minX)); this.by0 = Math.min(...bs.map((b) => b.minY));
    for (const t of ts) {
      pts.push({ x: t.x, y: t.y });
      const under = this.world.query(t.x, t.y + t.r + 3, 2, t);
      if (under?.mat) pts.push({ x: under.x, y: under.minY + 3, b: under });
      const over = this.world.bodies.find((b) => b.mat && b.maxY < t.y && b.maxY > t.y - 60 && b.minX < t.x && b.maxX > t.x);
      if (over) pts.push({ x: over.minX + 4, y: over.y, b: over });
    }
    for (const b of this.world.bodies) if (b.mat === 'tnt' || (b.mat === 'glass' && this.rng() < 0.4)) pts.push({ x: b.x, y: b.y, b });
    const top = this.world.bodies.filter((b) => b.mat).sort((a, b) => a.minY - b.minY)[0];
    if (top) pts.push({ x: top.x, y: top.minY + 4, b: top });
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    this.planQ = [];
    for (const p of pts.slice(0, 10)) for (const k of [0.6, 0.68, 0.76, 0.84, 0.92, 1]) for (const hi of [0, 1]) this.planQ.push([p, k * this.vmax, hi]);
    this.planBest = null; this.aimT = 0;
  }
  planWork(n) {
    const g = this.world.g, type = this.queue[0], r = SHOT[type].r * this.S;
    while (n-- > 0 && this.planQ.length) {
      const [p, v, hi] = this.planQ.pop(), dx = p.x - POUCH.x, dy = POUCH.y - p.y, d = v ** 4 - g * (g * dx * dx + 2 * dy * v * v);
      if (d < 0 || dx <= 0) continue;
      const th = Math.atan((v * v + (hi ? 1 : -1) * Math.sqrt(d)) / (g * dx)), vx = Math.cos(th) * v, vy = -Math.sin(th) * v;
      const h = this.trace(vx, vy, r), s = this.rate(h, p, type, r) + this.r(0, 8);
      if (!this.planBest || s > this.planBest.s) this.planBest = { vx, vy, s, h };
    }
    if (!this.planQ.length) {
      const p = this.planBest || { vx: this.vmax * 0.7, vy: -this.vmax * 0.7 };
      // a human hand: a little off now and then
      this.plan = { ...p, vx: p.vx * this.r(0.985, 1.015), vy: p.vy * this.r(0.985, 1.015) };
      this.planQ = null;
    }
  }
  rate(h, p, type, r) {
    if (!h) return -100;
    let s = 0;
    for (const t of this.targets()) { const d = Math.hypot(t.x - h.x, t.y - h.y); s += 40 * Math.exp(-d / (type === 'bomb' ? 60 : 38)); }
    const b = h.b, sp = Math.hypot(h.vx, h.vy) * (type === 'boost' ? 1.5 : 1);
    if (b.target) s += 120;
    else if (b.mat) {
      const mp = SHOT[type].d * Math.PI * r * r, meff = 1 / (1 / b.mass + 1 / mp), brk = (meff * sp * 0.7) / b.mass / Math.max(20, b.hp - b.dmg);
      s += Math.min(1.5, brk) * 30 + (b.mat === 'tnt' ? 70 : 0) + (p.b === b ? 20 : 0);
    } else s -= 30;
    return s;
  }
  autopilot(dt) {
    if (this.state === 'aim' && this.queue.length) {
      if (!this.plan && !this.planQ) this.planStart();
      if (this.planQ) { this.planWork(16); return; }
      this.aimT += dt;
      if (this.aimT > 1.3) this.fire(this.plan.vx, this.plan.vy);
    } else if (this.state === 'fly' && !this.used && this.plan?.h) {
      const b = this.lead, h = this.plan.h;
      if (!b || b.gone) return;
      const d = Math.hypot(b.x - h.x, b.y - h.y);
      if (b.shot === 'bomb' ? (b.hitT && this.t - b.hitT > 0.05) || d < 12 : b.shot === 'split' ? d < 150 && b.life > 0.3 : b.shot === 'boost' ? d < 140 : false) this.ability();
    }
  }

  // ---------------------------------------------------------------- input
  scr(x, y) { return { x: (x - this.cam.x) * this.cam.z + W / 2, y: y * this.cam.z + H - GS }; }
  down(x, y) {
    if (this.state === 'fly') { this.ability(); return; }
    if (this.state === 'intro') { this.state = 'aim'; this.stT = 0; }
    if (this.state !== 'aim' || !this.queue.length) return;
    const p = this.scr(POUCH.x, POUCH.y);
    if (Math.hypot(x - p.x, y - p.y) < 62) this.pull = { ox: x, oy: y, x, y };
    else this.pan = { x, cx: this.cam.x, moved: 0 };
  }
  move(x, y) {
    if (this.pull) { this.pull.x = x; this.pull.y = y; }
    else if (this.pan) { this.pan.moved = Math.max(this.pan.moved, Math.abs(x - this.pan.x)); this.manual = { x: this.pan.cx - (x - this.pan.x) / this.cam.z }; }
  }
  up() {
    if (this.pull) { const f = this.pullVec(); this.pull = null; if (f.m > 0.15) this.fire(-f.x * this.vmax, -f.y * this.vmax); }
    if (this.pan) { if (this.pan.moved < 6) this.manual = null; this.pan = null; }
  }
  tap() {}
  pullVec() {
    if (this.pull) { const dx = this.pull.x - this.pull.ox, dy = this.pull.y - this.pull.oy, d = Math.hypot(dx, dy), m = Math.min(1, d / PULL); return d < 1 ? { x: 0, y: 0, m: 0 } : { x: (dx / d) * m, y: (dy / d) * m, m }; }
    if (this.auto && this.plan && this.state === 'aim') { const k = clamp((this.aimT - 0.25) / 0.75, 0, 1); return { x: (-this.plan.vx / this.vmax) * k, y: (-this.plan.vy / this.vmax) * k, m: k }; }
    return { x: 0, y: 0, m: 0 };
  }

  // ---------------------------------------------------------------- simulation
  step(dt) {
    this.stT += dt;
    this.world.step(dt);
    for (const t of this.world.bodies) if (t.target) { t.hurtT -= dt; if (t.y > 150 || t.x < -300 || t.x > this.wr + 300) this.kill(t); }
    for (const b of this.world.bodies) if (b.mat && b.y > 300) this.world.remove(b);
    for (const b of this.shots) {
      if (b.gone) continue;
      b.life += dt; b.slow = Math.hypot(b.vx, b.vy) < 18 || !b.awake ? b.slow + dt : 0;
      if (b.shot === 'bomb' && b.hitT && !b.done && this.t - b.hitT > 1.3) { this.used = true; b.done = true; this.world.remove(b); this.boom(b.x, b.y, 80, 640); }
      if (b.x > this.wr + 200 || b.x < -400 || b.y > 200 || b.life > 9) this.world.remove(b);
    }
    const lead = this.lead;
    if (this.state === 'fly' && lead && !lead.gone && !lead.hitT && (this.trailT -= dt) <= 0) { this.trailT = 0.035; this.trail.push({ x: lead.x, y: lead.y, s: this.boosted > 0 ? 2.6 : 1.6 }); }
    this.boosted = (this.boosted || 0) - dt;
    if (this.boosted > 0 && lead && !lead.gone) this.fx.push({ k: 'puff', x: lead.x, y: lead.y, vx: -lead.vx * 0.1 + this.r(-20, 20), vy: -lead.vy * 0.1 + this.r(-20, 20), life: 0.35, s: this.r(2, 4), c: this.r() < 0.5 ? '#ffd166' : '#ff7b39' });
    const left = this.targets().length;
    const st = this.state;
    if (st === 'intro' && this.stT > 2.6) { this.state = 'aim'; this.stT = 0; }
    else if (st === 'fly' && (!this.shots.some((b) => !b.gone && b.slow < 0.5) || this.stT > 10)) { this.state = 'settle'; this.stT = 0; }
    else if (st === 'settle' && ((this.stT > 1.2 && this.world.asleep()) || this.stT > 5)) {
      for (const b of this.shots) if (!b.gone) { this.world.remove(b); for (let i = 0; i < 6; i++) this.fx.push({ k: 'puff', x: b.x, y: b.y, vx: this.r(-40, 40), vy: this.r(-60, 0), life: 0.4, s: 3, c: '#ffffff' }); }
      this.shots = []; this.plan = null; this.planQ = null; this.stT = 0;
      if (!left) { this.state = 'clear'; for (const q of this.queue) { this.score += 1000; } this.bonus = this.queue.length * 1000; }
      else this.state = this.queue.length ? 'aim' : 'fail';
    } else if ((st === 'clear' || st === 'fail') && this.stT > 2.6) { if (st === 'clear' || this.auto) this.levelN++; this.build(); return; }
    for (const f of this.fx) {
      f.life -= dt;
      if (f.k === 'shard' || f.k === 'puff') { f.vy += (f.k === 'shard' ? 600 : 120) * this.G * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.k === 'shard') { f.a += f.va * dt; if (f.y > 0) { f.y = 0; f.vy *= -0.3; f.vx *= 0.6; } } }
      else if (f.k === 'ghost') f.y -= 30 * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0).slice(-320);
    for (const p of this.pops) { p.t -= dt * 0.8; p.y -= 24 * dt; }
    this.pops = this.pops.filter((p) => p.t > 0);
    this.shake = Math.max(0, this.shake - dt * 18);
    this.camera(dt);
  }
  camera(dt) {
    const c = this.cam, mid = (this.x0 + this.x1) / 2, fz = this.fitZ(), az = 0.74, aim = (W / 2 - 66) / az;
    let tx = aim, tz = az, k = 2.4;
    const st = this.state, b = this.lead;
    if (st === 'intro') { if (this.stT < 1.3) { tx = mid; tz = fz; } }
    else if (st === 'aim' && this.manual) { tx = this.manual.x; tz = c.z; k = 12; }
    else if (st === 'fly' && b) {
      tx = b.x + clamp(b.vx * 0.25, -40, 150); tz = clamp((H - GS - 60) / Math.max(1, 40 - b.y), 0.36, az); k = 5;
      if (b.hitT) { tx = Math.max(tx, (this.focus ?? b.x) - 40); tz = Math.min(tz, Math.max(fz, 0.6)); }
    } else if (st === 'settle' || st === 'clear' || st === 'fail') { tx = st === 'settle' && this.focus != null ? (this.focus + mid) / 2 : mid; tz = Math.max(fz, 0.6); }
    c.x += (tx - c.x) * Math.min(1, dt * k); c.z += (tz - c.z) * Math.min(1, dt * 2.5);
    const half = W / 2 / c.z;
    c.x = this.wr - this.wl < half * 2 ? (this.wl + this.wr) / 2 : clamp(c.x, this.wl + half, this.wr - half);
  }

  // ---------------------------------------------------------------- drawing
  draw(c) {
    const cam = this.cam, z = cam.z, sx = this.shake ? this.r(-1, 1) * this.shake : 0, sy = this.shake ? this.r(-1, 1) * this.shake : 0;
    this.sky(c);
    c.save(); c.translate(W / 2 + sx, H - GS + sy); c.scale(z, z); c.translate(-cam.x, 0);
    const h = this.skin.hue;
    // ground and hills
    c.fillStyle = `hsl(${h + 30},28%,26%)`; c.fillRect(this.wl - 800, 0, this.wr - this.wl + 1600, 400);
    this.texture(c, 'ground', this.wl - 800, 0, this.wr - this.wl + 1600, 400);
    c.fillStyle = `hsl(${h + 100},40%,40%)`; c.fillRect(this.wl - 800, 0, this.wr - this.wl + 1600, 5);
    for (const b of this.world.bodies) if (b.kind === 'hill') {
      this.path(c, b.wv); c.fillStyle = `hsl(${h + 25},16%,36%)`; c.fill(); this.texture(c, 'stone', b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY, true);
      c.strokeStyle = `hsl(${h + 100},40%,40%)`; c.lineWidth = 5; c.beginPath(); c.moveTo(b.wv[1][0], b.wv[1][1]); c.lineTo(b.wv[2][0], b.wv[2][1]); c.stroke();
    }
    // the shots still to come wait behind the sling
    const aiming = this.state === 'aim';
    this.queue.forEach((t, i) => { if (i || !aiming) this.bubble(c, t, -26 - (i - (aiming ? 1 : 0)) * 20, -SHOT[t].r * this.S, SHOT[t].r * this.S, 0); });
    // sling: back post and band, then the loaded shot, then the front
    const pv = this.pullVec(), loaded = this.state === 'aim' && this.queue.length, px = POUCH.x + pv.x * 56, py = POUCH.y + pv.y * 56;
    c.lineCap = 'round';
    c.strokeStyle = '#5b3a1e'; c.lineWidth = 7; c.beginPath(); c.moveTo(2, 0); c.lineTo(2, -30); c.lineTo(9, -52); c.stroke();
    c.strokeStyle = '#3a2412'; c.lineWidth = 3;
    if (loaded) { c.beginPath(); c.moveTo(9, -50); c.lineTo(px, py); c.stroke(); }
    for (const p of this.trail) { c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.fill(); }
    for (const b of this.world.bodies) if (b.kind !== 'ground' && b.kind !== 'hill') this.body(c, b);
    if (loaded) this.bubble(c, this.queue[0], px, py, SHOT[this.queue[0]].r * this.S, 0);
    c.strokeStyle = '#3a2412'; c.lineWidth = 3;
    if (loaded) { c.beginPath(); c.moveTo(-8, -50); c.lineTo(px, py); c.stroke(); } else { c.beginPath(); c.moveTo(-8, -50); c.quadraticCurveTo(0, -44, 9, -50); c.stroke(); }
    c.strokeStyle = '#6b4626'; c.lineWidth = 7; c.beginPath(); c.moveTo(-2, 0); c.lineTo(-2, -30); c.lineTo(-8, -52); c.stroke();
    // aiming guide while you pull
    if (this.pull && pv.m > 0.15) {
      let x = POUCH.x, y = POUCH.y, vx = -pv.x * this.vmax, vy = -pv.y * this.vmax;
      const g = this.world.g;
      c.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 1; i <= 130; i++) { vy += g / 120; x += vx / 120; y += vy / 120; if (i % 7 === 0) { c.globalAlpha = 1 - i / 150; c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); } if (y > 0) break; }
      c.globalAlpha = 1;
    }
    for (const f of this.fx) this.effect(c, f);
    c.restore();
    for (const p of this.pops) { const s = this.scr(p.x, p.y); this.label(c, p.s, s.x, s.y, p.size, p.t); }
    this.overlay(c);
  }
  sky(c) {
    const h = this.skin.hue, set = this.skin.bgSet, cam = this.cam;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `hsl(${h + 200},42%,60%)`); g.addColorStop(1, `hsl(${h + 170},48%,86%)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const im = set?.[0];
    if (ready(im)) {
      const ih = H - GS + 10, iw = (im.naturalWidth / im.naturalHeight) * ih, off = -(((cam.x * cam.z * 0.12) % iw) + iw) % iw;
      c.globalAlpha = 0.9; for (let x = off; x < W; x += iw) c.drawImage(im, x, 0, iw, ih); c.globalAlpha = 1;
      const hz = c.createLinearGradient(0, H * 0.45, 0, H - GS); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, 'rgba(255,255,255,.35)'); c.fillStyle = hz; c.fillRect(0, H * 0.45, W, H * 0.55);
    } else {
      c.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 6; i++) { const x = ((((i * 173 - cam.x * cam.z * 0.1 + this.t * 4) % 560) + 560) % 560) - 100, y = 40 + ((i * 67) % 120); c.beginPath(); c.ellipse(x, y, 36, 11, 0, 0, 7); c.ellipse(x + 18, y - 7, 20, 10, 0, 0, 7); c.fill(); }
    }
    // two layers of hills drifting behind
    for (const [k, par, base, amp, l] of [[0, 0.25, H - GS - 34, 34, 58], [1, 0.5, H - GS - 8, 20, 44]]) {
      c.fillStyle = `hsla(${h + 90 + k * 25},${24 + k * 8}%,${l}%,.9)`; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W + 12; x += 12) { const u = x + cam.x * cam.z * par; c.lineTo(x, base - amp * (0.6 * Math.sin(u * 0.012 + k * 2) + 0.4 * Math.sin(u * 0.029 + k))); }
      c.lineTo(W, H); c.fill();
    }
  }
  pattern(c, k) {
    if (this.pats[k]) return this.pats[k];
    const tiles = this.skin.slots.tile || [], im = tiles[{ wood: 0, stone: 1, ground: 2, ice: 1 }[k] % Math.max(1, tiles.length)];
    if (!ready(im)) return null;
    try { this.pats[k] = c.createPattern(im, 'repeat'); } catch { this.pats[k] = null; }
    return this.pats[k];
  }
  texture(c, k, x, y, w, h, clip) {
    const p = this.pattern(c, k); if (!p) return;
    c.save(); if (clip) c.clip(); c.globalAlpha = 0.3; c.globalCompositeOperation = 'multiply'; c.fillStyle = p; c.fillRect(x, y, w, h); c.restore();
  }
  path(c, v) { c.beginPath(); v.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  body(c, b) {
    c.save(); c.translate(b.x, b.y); c.rotate(b.a);
    if (b.target) {
      const m = b.m, f = b.hurtT > 0 && m.hurt ? m.hurt : m.frames[Math.floor(this.t * 2.5 + b.ph) % 2], s = b.r * 2.8;
      if (!drawFit(c, f, 0, -b.r * 0.12, s, s, 0, true)) { c.fillStyle = this.col(2); c.beginPath(); c.arc(0, 0, b.r, 0, 7); c.fill(); }
    } else if (b.shot) this.bubble(c, b.shot, 0, 0, b.r, 0, b);
    else this.block(c, b);
    c.restore();
  }
  block(c, b) {
    const m = MAT[b.mat], w = b.bw, h = b.bh;
    if (b.arch) {
      const ar = Math.min(w / 2 - 14, h * 0.75);
      c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2, h / 2); c.lineTo(ar, h / 2); c.arc(0, h / 2, ar, 0, Math.PI, true); c.lineTo(-w / 2, h / 2); c.closePath();
    } else this.path(c, b.v);
    c.fillStyle = m.c; c.globalAlpha = b.mat === 'glass' ? 0.55 : 1; c.fill(); c.globalAlpha = 1;
    if (b.mat === 'wood' || b.mat === 'stone') this.texture(c, b.mat, -w, -h, w * 2, h * 2, true);
    c.strokeStyle = m.c2; c.lineWidth = 1;
    const long = w > h, L = long ? w : h;
    if (b.mat === 'wood' && !b.tri) { c.globalAlpha = 0.35; c.beginPath(); for (const k of [-0.2, 0.18]) { if (long) { c.moveTo(-w / 2 + 3, k * h); c.lineTo(w / 2 - 3, k * h + 0.6); } else { c.moveTo(k * w, -h / 2 + 3); c.lineTo(k * w + 0.6, h / 2 - 3); } } c.stroke(); c.globalAlpha = 1; }
    else if (b.mat === 'stone' && !b.tri) { c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, 2); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-w / 2 + 1, h / 2 - 3, w - 2, 2); if (L > 30 && !b.arch) { c.globalAlpha = 0.4; c.beginPath(); if (long) { c.moveTo(0, -h / 2); c.lineTo(0, h / 2); } else { c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); } c.stroke(); c.globalAlpha = 1; } }
    else if (b.mat === 'glass') { c.strokeStyle = 'rgba(255,255,255,.8)'; c.beginPath(); if (long) { c.moveTo(-w / 2 + 3, -h / 2 + 2); c.lineTo(-w / 2 + 9, -h / 2 + 2); } else { c.moveTo(-w / 2 + 1.5, -h / 2 + 3); c.lineTo(-w / 2 + 1.5, -h / 2 + Math.min(h - 4, 16)); } c.stroke(); c.strokeStyle = m.c2; }
    else if (b.mat === 'ice') { c.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 3; i++) c.fillRect(((i * 37) % 10) / 10 * w - w / 2 + 1, ((i * 53) % 10) / 10 * h - h / 2 + 1, 1.5, 1.5); }
    else if (b.mat === 'tnt') { c.fillStyle = m.c2; c.fillRect(-w / 2, -h / 2 + 3, w, 2); c.fillRect(-w / 2, h / 2 - 5, w, 2); c.fillStyle = '#ffe9a8'; c.font = '700 6px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TNT', 0, 0.5); }
    if (b.arch) { const ar = Math.min(w / 2 - 14, h * 0.75); c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2, h / 2); c.lineTo(ar, h / 2); c.arc(0, h / 2, ar, 0, Math.PI, true); c.lineTo(-w / 2, h / 2); c.closePath(); } else this.path(c, b.v);
    c.lineWidth = 1.3; c.strokeStyle = m.c2; c.stroke();
    // cracks as it takes damage
    if (b.dmg > b.hp * 0.3) {
      b.cracks ||= Array.from({ length: 3 }, () => { let x = this.r(-w / 2, w / 2) * 0.8, y = this.r(-h / 2, h / 2) * 0.8; return Array.from({ length: 4 }, () => [x += this.r(-L, L) * 0.18, y += this.r(-L, L) * 0.18]); });
      c.strokeStyle = 'rgba(20,12,8,.65)'; c.lineWidth = 0.9; c.beginPath();
      for (const cr of b.cracks.slice(0, b.dmg > b.hp * 0.65 ? 3 : 1)) cr.forEach(([x, y], i) => (i ? c.lineTo(clamp(x, -w / 2, w / 2), clamp(y, -h / 2, h / 2)) : c.moveTo(clamp(x, -w / 2, w / 2), clamp(y, -h / 2, h / 2))));
      c.stroke();
    }
  }
  // a shot: the hero spirit in a coloured bubble
  bubble(c, type, x, y, r, rot, b) {
    const S = SHOT[type], g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, S.c); g.addColorStop(1, S.c);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.stroke();
    drawFit(c, this.skin.creatures[0]?.frames[0], x, y + r * 0.08, r * 1.6, r * 1.6);
    if (type === 'bomb' && !b?.done) { c.strokeStyle = '#2a2a2a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + 3, y - r - 4); c.stroke(); c.fillStyle = Math.floor(this.t * 12) % 2 ? '#ffd166' : '#ff5e3a'; c.beginPath(); c.arc(x + 3, y - r - 5, 1.8, 0, 7); c.fill(); }
    if (type === 'heavy') { c.strokeStyle = 'rgba(40,44,52,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r - 1, 0, 7); c.stroke(); }
  }
  effect(c, f) {
    if (f.k === 'shard') { c.save(); c.translate(f.x, f.y); c.rotate(f.a); c.globalAlpha = Math.min(1, f.life * 2); c.fillStyle = f.c; c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); c.restore(); }
    else if (f.k === 'puff') { c.globalAlpha = Math.min(1, f.life * 2.5); c.fillStyle = f.c; c.beginPath(); c.arc(f.x, f.y, f.s, 0, 7); c.fill(); }
    else if (f.k === 'ring') { const k = 1 - f.life / 0.45; c.globalAlpha = f.life / 0.45; c.strokeStyle = '#fff3c4'; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, 7); c.stroke(); c.fillStyle = 'rgba(255,190,90,.35)'; c.fill(); }
    else if (f.k === 'ghost') { c.globalAlpha = Math.min(1, f.life * 1.6); drawFit(c, f.m.dead || f.m.frames[0], f.x, f.y, f.r * 2.8, f.r * 2.8, 0, true); }
    c.globalAlpha = 1;
  }
  label(c, s, x, y, size, a = 1) {
    c.globalAlpha = Math.min(1, a * 2); c.font = `800 ${size}px ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = Math.max(2, size / 5); c.strokeStyle = 'rgba(20,14,10,.85)'; c.strokeText(s, x, y); c.fillStyle = '#fffaf0'; c.fillText(s, x, y); c.globalAlpha = 1;
  }
  overlay(c) {
    const st = this.state;
    if (st === 'intro') { const a = Math.min(1, (2.6 - this.stT) * 2); this.label(c, `LEVEL ${this.levelN + 1}`, W / 2, 128, 22, a); this.label(c, `${this.total} spirits · ${this.queue.length} shots`, W / 2, 154, 11, a); }
    else if (st === 'clear') { this.label(c, 'CASTLE CLEARED', W / 2, 128, 20); if (this.bonus) this.label(c, `+${this.bonus} for unused shots`, W / 2, 154, 11); }
    else if (st === 'fail') this.label(c, 'OUT OF SHOTS', W / 2, 128, 20);
    else if (st === 'aim' && !this.auto && this.queue.length) {
      const tip = SHOT[this.queue[0]].tip;
      this.label(c, tip ? `${this.queue[0].toUpperCase()} · tap in flight to ${tip.toLowerCase()}` : 'drag back from the sling', W / 2, H - 16, 10);
    }
    // where the castle is when it's off screen
    const e = this.scr(this.x0, -40);
    if (st === 'aim' && e.x > W + 10) { this.label(c, '▶', W - 12, H / 2, 14, 0.5 + Math.sin(this.t * 4) * 0.25); }
  }
  hud() { return `${this.score} · lv ${this.levelN + 1} · ${this.targets().length} left · ${this.queue.length} shots`; }
}
