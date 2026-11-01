import { Game, W, H, roundRect, drawFit, drawRectImg, ready } from './engine.js';
import { Fx, Backdrop, SCENE_KEYS, sceneFor, clamp, mix } from './arcadekit.js';

const G = H - 70, S = 22;
// obstacle chunks: [kind, weight, difficulty it starts at]
const KINDS = [['spike', 3, 0], ['block', 2.2, 0], ['gap', 2, 0], ['walker', 1.4, 0], ['saw', 1.6, 0.05], ['stairs', 1, 0.1], ['faller', 1.1, 0.1], ['ceil', 1.2, 0.12],
  ['roller', 1.1, 0.15], ['wire', 1, 0.15], ['laser', 1.2, 0.2], ['crusher', 1, 0.22], ['pad', 0.8, 0.25], ['plats', 0.8, 0.3], ['lava', 0.9, 0.3]];
const POWS = { shield: ['S', 'SHIELD', '#4fd8ff'], magnet: ['M', 'MAGNET', '#ff5a7a'], x2: ['×2', 'DOUBLE SCORE', '#ffd23a'], rocket: ['R', 'ROCKET', '#ff8a2a'] };
const boxHit = (q, x, y, w, h, m) => q.x + S > x - m && q.x < x + w + m && q.y + S > y - m && q.y < y + h + m;
const circHit = (q, cx, cy, r) => { const nx = clamp(cx, q.x, q.x + S), ny = clamp(cy, q.y, q.y + S); return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r; };

// ================================================================ Dash (side-scrolling runner)
export class Dash extends Game {
  setup() {
    this.fx = new Fx();
    this.grav = 1900 * this.G; this.apex = (620 * 620) / (2 * this.grav);
    const set = this.skin.bgSet;
    this.bd = new Backdrop(this, set?.length ? sceneFor(this.skin.bgGroup, () => this.rng()) : SCENE_KEYS.filter((k) => k !== 'sky')[this.ri(0, 5)], { imgs: set, floor: G + 6, noClouds: false });
    this.groundC = mix(this.col(2), this.pal.bg, 0.45); this.edgeC = mix(this.col(2), '#fff', 0.15);
    this.hero = this.skin.pick('hero', 'char', 'animal');
    this.reset();
  }
  reset() {
    this.p = { x: 80, y: G - S, vy: 0, on: true, jumps: 0, rot: 0, sq: 0, shield: false, inv: 0, rocket: 0, magnet: 0, x2: 0, trail: [] };
    this.speed = 230; this.obs = []; this.dist = 0; this.pts = 0; this.coins = 0; this.dead = 0; this.spawnX = W + 60; this.score = 0;
    this.n = 0; this.powIn = this.ri(3, 5); this.lag = this.r(0.05, 0.13); this.planT = 0; this.dustT = 0;
  }
  // ---------------------------------------------------------- level generation
  spawn() {
    const x = this.spawnX, D = clamp(this.dist / 8000, 0, 1), ap = this.apex, rr = () => this.rng();
    const add = (o) => { this.obs.push(o); return o; };
    let tot = 0; for (const [, w, d] of KINDS) if (D >= d) tot += w;
    let s = rr() * tot, kind = 'spike';
    for (const [k, w, d] of KINDS) { if (D < d) continue; s -= w; if (s <= 0) { kind = k; break; } }
    if (this.n++ < 2) kind = this.n === 1 ? 'spike' : 'block';
    let w = 30, arc = rr() < 0.38, line = false;
    switch (kind) {
      case 'spike': { const n = 1 + (rr() < 0.3 + D * 0.3 ? 1 : 0) + (rr() < D * 0.2 ? 1 : 0); add({ type: 'spike', x, w: 22 * n, h: 22 }); w = 22 * n; break; }
      case 'block': { const h = this.r(24, Math.min(56, ap * 0.8)); w = this.r(30, 72); add({ type: 'block', x, w, h }); break; }
      case 'stairs': { const n = this.ri(2, 3); for (let i = 0; i < n; i++) add({ type: 'block', x: x + i * 44, w: 44, h: Math.min(ap * 0.85, 26 + i * 24) * (i + 1 === n ? 1 : 1) }); w = n * 44; break; }
      case 'gap': case 'lava': { w = kind === 'lava' ? this.r(70, 120) : this.r(50, 70 + D * 50); add({ type: 'gap', x, w, lava: kind === 'lava' }); break; }
      case 'saw': {
        const r = this.r(15, 20), v = this.ri(0, 2);
        if (v === 0) { w = 2 * r; add({ type: 'saw', x, w, r, cy: G + 3 }); }
        else if (v === 1) { const ax = this.r(22, 42); w = 2 * r + 2 * ax; add({ type: 'saw', x, w, r, cy: G - r * 0.35, ax, sp: this.r(1.6, 2.6), ph: this.r(0, 6) }); }
        else { const ay = this.r(10, 18); w = 2 * r; add({ type: 'saw', x, w, r, cy: G - S - 10 - ay - r - this.r(0, 14), ay, sp: this.r(2, 3), ph: this.r(0, 6), hang: true }); arc = false; line = true; }
        break;
      }
      case 'ceil': { w = this.r(70, 150); add({ type: 'ceil', x, w, y: G - this.r(48, 58), spiky: rr() < 0.5 }); arc = false; line = true; if (rr() < 0.4) { const sx = x + w + this.r(60, 100); add({ type: 'spike', x: sx, w: 22, h: 22 }); w = sx + 22 - x; } break; }
      case 'crusher': { w = this.r(40, 56); add({ type: 'crusher', x, w, y: G - this.r(64, 74), drop: 0 }); arc = false; line = true; break; }
      case 'laser': { w = 14; add({ type: 'laser', x, w, h: this.r(50, Math.min(92, ap * 0.85)), per: this.r(1.4, 2.2), duty: this.r(0.4, 0.6), ph: this.r(0, 3) }); break; }
      case 'wire': { if (rr() < 0.6) { w = this.r(30, 64); add({ type: 'wire', x, w, y: G - 14, h: 14 }); } else { w = this.r(70, 130); add({ type: 'wire', x, w, y: G - 38, h: 4, high: true }); arc = false; line = true; } break; }
      case 'faller': { w = this.r(30, 48); add({ type: 'faller', x, w, h: this.r(26, Math.min(44, ap * 0.7)), land: this.r(120, 190) }); break; }
      case 'roller': { const r = this.r(14, 19); w = 2 * r; add({ type: 'roller', x, w, r, vr: this.r(50, 110), bounce: rr() < 0.4 ? this.r(18, 34) : 0, ph: this.r(0, 6) }); break; }
      case 'walker': { w = 26; add({ type: 'walker', x, w, h: 26, vr: this.r(15, 45), m: this.skin.creatures[this.ri(1, 4)] || this.skin.creatures[0] }); break; }
      case 'pad': { add({ type: 'pad', x, w: 26, sq: 0 }); const gw = this.r(120, 170); add({ type: 'gap', x: x + 40, w: gw, lava: rr() < 0.5 }); w = 40 + gw; arc = false; break; }
      case 'plats': { const gw = this.r(190, 270), n = gw > 235 ? 2 : 1; add({ type: 'gap', x, w: gw, lava: rr() < 0.4 }); for (let i = 0; i < n; i++) add({ type: 'plat', x: x + (gw * (i + 1)) / (n + 1) - 30, w: 60, y: G - this.r(30, 58) }); w = gw; arc = false; break; }
    }
    if (arc) for (let i = 0; i < 5; i++) add({ type: 'coin', x: x + w / 2 + (i - 2) * 22 - 7, w: 14, y: G - 42 - 52 * (1 - ((i - 2) / 2.6) ** 2) });
    if (line) for (let i = 0; i < 4; i++) add({ type: 'coin', x: x + w / 2 + (i - 1.5) * 20 - 7, w: 14, y: G - 11 });
    const run = this.r(170, 280) * (1 - 0.2 * D) * (this.mods.swarm ? 0.8 : 1) + this.speed * 0.32;
    if (--this.powIn <= 0) { this.powIn = this.ri(6, 10); const ks = Object.keys(POWS); add({ type: 'pow', k: ks[this.ri(0, ks.length - 1)], x: x + w + run * 0.5 - 12, w: 24, y: rr() < 0.6 ? G - 14 : G - 70 }); }
    else if (rr() < 0.25) for (let i = 0; i < 5; i++) add({ type: 'coin', x: x + w + run * 0.3 + i * 20, w: 14, y: G - 11 });
    this.spawnX += w + run;
  }
  // ---------------------------------------------------------- physics shared by the game and the autopilot's look-ahead
  sawPos(o, ox, T) {
    if (o.type === 'roller') return [ox + o.r, G - o.r - (o.bounce ? Math.abs(Math.sin(T * 5 + o.ph)) * o.bounce : 0)];
    return [ox + o.w / 2 + (o.ax ? Math.sin(T * o.sp + o.ph) * o.ax : 0), o.cy + (o.ay ? Math.sin(T * o.sp + o.ph) * o.ay : 0)];
  }
  laserOn(o, T) { return ((T + o.ph) % o.per) / o.per < o.duty; }
  fallY(o, ox, x) { const d = ox - (x + o.land); return d > 0 ? Math.min(700, 1300 * (d / this.speed) ** 2) : 0; }
  // one step for runner q, with the world `tau` seconds ahead; real = the actual game (effects, pickups); returns true when dead
  phys(q, dt, tau, real) {
    const T = this.t + tau, m = real ? -2 : 1.5, x0 = q.x, x1 = q.x + S, prevB = q.y + S;
    q.vy += this.grav * dt; q.y += q.vy * dt;
    let floor = Infinity, ground = true, dead = null, pit = false;
    for (const o of this.obs) {
      if (o.gone || (!real && q.kill?.has(o))) continue;
      const ox = o.x - (this.speed + (o.vr || 0)) * tau;
      if (ox > x1 + 40 || ox + o.w < x0 - 40) continue;
      const hx = x1 > ox + 2 && x0 < ox + o.w - 2;
      switch (o.type) {
        case 'gap': if (x0 > ox + 2 && x1 < ox + o.w - 2) ground = false; break;
        case 'block': case 'faller': {
          const top = G - o.h;
          if (o.type === 'faller') { const f = this.fallY(o, ox, q.x); if (f > 0) { if (boxHit(q, ox, top - f, o.w, o.h, m)) dead = o; break; } }
          if (!hx) break;
          if (prevB <= top + 2) floor = Math.min(floor, top); else if (q.y + S > top + 3) dead = o;
          break;
        }
        case 'plat': if (hx && prevB <= o.y + 2 && q.vy >= 0) floor = Math.min(floor, o.y); break;
        case 'spike': if (boxHit(q, ox + 3, G - o.h * 0.72, o.w - 6, o.h * 0.72, m)) dead = o; break;
        case 'wire': if (boxHit(q, ox, o.y - 1, o.w, o.h, m)) dead = o; break;
        case 'laser': if (this.laserOn(o, T) && boxHit(q, ox + o.w / 2 - 3, G - o.h, 6, o.h, m)) dead = o; break;
        case 'saw': case 'roller': { const [cx, cy] = this.sawPos(o, ox, T); if (circHit(q, cx, cy, o.r - 2 + m)) dead = o; break; }
        case 'ceil': case 'crusher': if (hx && q.y < o.y + m) { if (o.spiky || o.type === 'crusher') dead = o; else { q.y = o.y; if (q.vy < 0) q.vy = 60; } } break;
        case 'walker': if (boxHit(q, ox + 2, G - o.h, o.w - 4, o.h, m)) {
          if (prevB <= G - o.h + 8 && q.vy > 0) { q.vy = -560; q.jumps = 1; q.on = false; if (real) this.stomp(o); else (q.kill ||= new Set()).add(o); } else dead = o;
        } break;
        case 'pad': if (x1 > ox && x0 < ox + o.w && q.y + S >= G - 7 && q.vy >= 0) { q.vy = -940; q.on = false; q.jumps = 1; if (real) { o.sq = 1; this.fx.sparks(ox + 13, G - 6, 8, '#fff', 160, -Math.PI / 2, 1.2, 0.3); } } break;
        case 'coin': case 'pow': if (circHit(q, ox + o.w / 2, o.y, o.w / 2 + 3)) { if (real) this.collect(o); else (q.got ||= new Set()).add(o); } break;
      }
    }
    if (ground) floor = Math.min(floor, G);
    if (q.y + S >= floor) {
      if (floor === G && prevB > G + 4) { pit = true; dead ||= 'wall'; }
      else { if (!q.on && real) this.land(q); q.y = floor - S; q.vy = 0; q.on = true; q.jumps = 0; }
    } else q.on = false;
    if (q.y + S > G + 26) { pit = true; dead ||= 'pit'; }
    if (!dead) return false;
    if (!real) return true;
    return this.hurt(dead, pit);
  }
  hurt(o, pit) {
    const p = this.p;
    if (pit) {
      if (!p.shield || p.y > H) return p.y > H - 10;
      p.shield = false; p.vy = -900; p.y = Math.min(p.y, G - S); this.pop(); return false;
    }
    if (p.inv > 0) return false;
    if (!p.shield) return true;
    p.shield = false; p.inv = 0.7; this.pop();
    if (o && typeof o === 'object' && !['block', 'ceil', 'crusher', 'faller', 'laser'].includes(o.type)) { o.gone = true; this.smash(o); }
    return false;
  }
  doJump(q) { if (q.on) { q.vy = -620; q.on = false; q.jumps = 1; return 1; } if (q.jumps < 2) { q.vy = -540; q.jumps = 2; return 2; } return 0; }
  jump() {
    const p = this.p;
    if (this.dead || p.rocket > 0) return;
    const j = this.doJump(p);
    if (j === 1) { p.sq = -0.6; this.fx.puff(p.x + S / 2, G, 0, -10, 6, this.edgeC, 0.4, 20, 0.5); }
    if (j === 2) { p.sq = -0.4; this.fx.ring(p.x + S / 2, p.y + S, 22, this.pal.ink, 0.3, 2); this.fx.sparks(p.x + S / 2, p.y + S, 8, this.col(1), 150, Math.PI / 2, 1.8, 0.3); }
    if (j) this.lag = this.r(0.05, 0.13);
  }
  // ---------------------------------------------------------- autopilot: try jumps against the same physics a second ahead
  roll(j1, j2, hor = 1.15) {
    const p = this.p, q = { x: p.x, y: p.y, vy: p.vy, on: p.on, jumps: p.jumps, kill: null, got: null }, dt = 1 / 60;
    let air = !q.on, landT = -1;
    for (let tau = 0; tau < hor; tau += dt) {
      if (tau >= j1 - 1e-6) { if (q.on) this.doJump(q); j1 = Infinity; }
      if (tau >= j2 - 1e-6) { if (!q.on && q.jumps < 2) this.doJump(q); j2 = Infinity; }
      if (this.phys(q, dt, tau, false)) return { dead: true, t: tau, got: q.got?.size || 0 };
      if (!q.on) air = true; else if (air && landT < 0 && tau > 0.04) landT = tau;
      if (landT >= 0 && tau > landT + 0.12) break;
    }
    return { dead: false, t: hor, got: q.got?.size || 0 };
  }
  canJump(d) { for (const j2 of [Infinity, 0.14, 0.24, 0.34, 0.44, 0.56]) if (!this.roll(d, d + j2).dead) return true; return false; }
  autopilot(dt) {
    const p = this.p;
    if (this.dead || p.rocket > 0 || (this.planT -= dt) > 0) return;
    this.planT = 1 / 60;
    if (p.on) {
      const stay = this.roll(Infinity, Infinity, 0.8);
      if (stay.dead) {
        const now = this.canJump(0), later = this.canJump(this.lag);
        if ((now && !later) || (!now && !later && stay.t < 0.08)) this.jump();
      } else if ((this.lootT = (this.lootT || 0) - 1 / 60) <= 0) {
        this.lootT = 0.1;
        const j = this.roll(0, Infinity);
        if (!j.dead && j.got >= stay.got + 2) this.jump();
      }
    } else if (p.jumps < 2) {
      const fall = this.roll(Infinity, Infinity);
      if (fall.dead) {
        const now = !this.roll(Infinity, 0).dead, later = !this.roll(Infinity, this.lag).dead;
        if ((now && !later) || (!now && !later && fall.t < 0.1)) this.jump();
      }
    }
  }
  down() { this.jump(); }
  // ---------------------------------------------------------- game step
  step(dt) {
    this.fx.step(dt);
    const p = this.p;
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    this.speed = Math.min(460, this.speed + dt * 6);
    const dx = this.speed * dt, mul = p.x2 > 0 ? 2 : 1;
    this.dist += dx; this.pts += (dx / 10) * mul; this.score = Math.floor(this.pts);
    for (const o of this.obs) o.x -= dx + (o.vr || 0) * dt;
    this.spawnX -= dx;
    while (this.spawnX < W + 400) this.spawn();
    this.obs = this.obs.filter((o) => o.x + o.w > -90 && !o.gone);
    for (const k of ['inv', 'magnet', 'x2']) if (p[k] > 0) p[k] -= dt;
    p.sq += (0 - p.sq) * Math.min(1, dt * 10);
    // the world's own effects
    for (const o of this.obs) {
      if (o.type === 'crusher' && !o.slam && o.x + o.w < p.x - 6) o.slam = 1;
      if (o.slam && o.drop < 1) { o.drop = Math.min(1, o.drop + dt * 7); if (o.drop >= 1) { this.fx.shake(4, 0.2); for (let i = 0; i < 8; i++) this.fx.puff(o.x + o.w / 2 + this.r(-o.w, o.w) / 2, G - 3, this.r(-60, 60), this.r(-40, -10), this.r(4, 8), this.edgeC, 0.6, 20, 0.6); } }
      if (o.type === 'faller' && !o.landed && this.fallY(o, o.x, p.x) <= 0) { o.landed = true; this.fx.shake(3, 0.18); for (let i = 0; i < 6; i++) this.fx.puff(o.x + this.r(0, o.w), G - 2, this.r(-80, 80), this.r(-30, -5), this.r(3, 7), this.edgeC, 0.5, 18, 0.6); }
      if (o.type === 'pad') o.sq = Math.max(0, o.sq - dt * 4);
      if (o.type === 'saw' && !o.hang && o.x < W && Math.random() < 0.3) { const [cx, cy] = this.sawPos(o, o.x, this.t); this.fx.spark(cx, Math.min(cy + o.r, G), this.r(-160, -40), this.r(-120, -30), '#ffd27a', 0.3, 500); }
      if (o.type === 'gap' && o.lava && o.x < W && Math.random() < 0.08) this.fx.spark(o.x + this.r(0, o.w), G + 6, this.r(-20, 20), this.r(-160, -60), '#ffb03a', 0.6, 300);
      if (p.magnet > 0 && o.type === 'coin') { const ddx = p.x + S / 2 - (o.x + 7), ddy = p.y + S / 2 - o.y, d = Math.hypot(ddx, ddy); if (d < 170) { o.x += (ddx / d) * 420 * dt; o.y += (ddy / d) * 420 * dt; } }
    }
    if (p.rocket > 0) {
      p.rocket -= dt; p.y += (G - 165 + Math.sin(this.t * 4) * 8 - p.y) * Math.min(1, dt * 3); p.vy = 0; p.on = false; p.rot = Math.sin(this.t * 6) * 0.12;
      for (const o of this.obs) if ((o.type === 'coin' || o.type === 'pow') && circHit(p, o.x + o.w / 2, o.y, o.w / 2 + 3)) this.collect(o);
      this.fx.puff(p.x + 2, p.y + S, this.r(-140, -80), this.r(20, 60), this.r(3, 6), Math.random() < 0.5 ? '#ffb347' : '#ff6a2a', 0.35, 10, 0.8);
      this.fx.puff(p.x - 6, p.y + S + 4, -this.speed * 0.4, 10, 5, 'rgba(200,200,200,1)', 0.8, 18, 0.25);
      if (p.rocket <= 0) { p.jumps = 1; p.inv = 0.8; }
    } else if (this.phys(p, dt, 0, true)) return this.die();
    if (!p.on && p.rocket <= 0) p.rot += dt * 7 * (p.vy < 0 ? 1 : 1.1);
    // dust, trails, speed lines
    if (p.on && (this.dustT -= dt) <= 0) { this.dustT = 0.07; this.fx.puff(p.x + 3, G - 2, -this.speed * 0.25, this.r(-25, -5), this.r(2, 4), this.edgeC, 0.4, 14, 0.45); }
    if ((this.trT = (this.trT || 0) - dt) <= 0) { this.trT = 0.03; p.trail.push([p.x, p.y, p.rot]); if (p.trail.length > 6) p.trail.shift(); }
    for (const t of p.trail) t[0] -= dx;
    if (this.speed > 360 && Math.random() < (this.speed - 360) / 300) this.fx.spark(W + 10, this.r(30, G - 10), -this.speed * 2.6, 0, 'rgba(255,255,255,.5)', 0.25);
  }
  land(q) {
    const v = q.vy;
    q.sq = clamp(v / 1400, 0.15, 0.6);
    for (const s of [-1, 1]) this.fx.puff(q.x + S / 2 + s * 8, G - 2, s * 70 - this.speed * 0.2, -14, this.r(3, 5), this.edgeC, 0.45, 22, 0.55);
    if (v > 900) this.fx.shake(2, 0.1);
  }
  stomp(o) {
    o.gone = true; this.pts += 20 * (this.p.x2 > 0 ? 2 : 1);
    this.fx.text(o.x + 13, G - 40, 'STOMP!', this.pal.ink, 12, 0.7); this.fx.ring(o.x + 13, G - 13, 26, '#fff', 0.3, 3);
    for (let i = 0; i < 8; i++) this.fx.chip(o.x + 13, G - 13, this.r(-160, 160), this.r(-300, -80), this.r(3, 6), this.col(3), 0.8);
  }
  smash(o) {
    const [cx, cy] = o.type === 'saw' || o.type === 'roller' ? this.sawPos(o, o.x, this.t) : [o.x + o.w / 2, G - (o.h || 20) / 2];
    this.fx.glow(cx, cy, 50, '#ffcf6a', 0.35); this.fx.sparks(cx, cy, 24, '#ffd27a', 300, 0, 7, 0.6, 400); this.fx.shake(5, 0.25);
    for (let i = 0; i < 10; i++) this.fx.chip(cx, cy, this.r(-220, 220), this.r(-360, -60), this.r(3, 6), this.col(3), 1);
  }
  pop() { const p = this.p; this.fx.ring(p.x + S / 2, p.y + S / 2, 46, '#4fd8ff', 0.45, 4); this.fx.sparks(p.x + S / 2, p.y + S / 2, 20, '#bff3ff', 260, 0, 7, 0.5); this.fx.flash('#4fd8ff', 0.25, 0.25); this.fx.text(p.x + 20, p.y - 20, 'SHIELD!', '#4fd8ff', 12, 0.8); }
  collect(o) {
    const p = this.p, cx = o.x + o.w / 2;
    o.gone = true;
    if (o.type === 'coin') { this.coins++; this.pts += 10 * (p.x2 > 0 ? 2 : 1); this.fx.sparks(cx, o.y, 6, '#ffe58a', 120, 0, 7, 0.3); this.fx.ring(cx, o.y, 12, '#ffe58a', 0.25, 2); return; }
    const [, name, col] = POWS[o.k];
    this.fx.text(cx, o.y - 22, name, col, 13, 1.1); this.fx.ring(cx, o.y, 50, col, 0.45, 4); this.fx.glow(cx, o.y, 60, col, 0.4); this.fx.sparks(cx, o.y, 16, col, 220, 0, 7, 0.5);
    if (o.k === 'shield') p.shield = true; else if (o.k === 'magnet') p.magnet = 9; else if (o.k === 'x2') p.x2 = 10; else { p.rocket = 3.5; this.fx.flash(col, 0.2, 0.2); }
  }
  die() {
    const p = this.p;
    this.dead = 1; this.fx.shake(7, 0.4); this.fx.flash('#fff', 0.35, 0.2);
    this.burst(p.x + 11, p.y + 11, this.col(0), 22, 260);
    for (let i = 0; i < 12; i++) this.fx.chip(p.x + 11, p.y + 11, this.r(-260, 160), this.r(-420, -60), this.r(3, 7), this.col(i % 3), 1.1);
    this.fx.glow(p.x + 11, p.y + 11, 60, '#ffffff', 0.3);
  }
  hud() { return `${this.score} · ◎${this.coins}`; }
  // ---------------------------------------------------------- drawing
  draw(c) {
    this.fx.apply(c);
    const p = this.p, camY = clamp((G - S - p.y) * 0.22, 0, 40);
    if (this.mods.trails && this.t > 0.5) { this.clear(c); this.bd.draw(c, this.dist, camY, this.t, 0.3); } else this.bd.draw(c, this.dist, camY, this.t);
    if (this.wall) { c.globalAlpha = 0.18; for (const w of this.wall) drawFit(c, w.i, w.x, w.y, w.s, w.s, w.r); c.globalAlpha = 1; }
    this.drawGround(c);
    for (const o of this.obs) if (o.x < W + 60 && o.x + o.w > -60) this.drawOb(c, o);
    this.fx.draw(c);
    if (!this.dead) this.drawHero(c, p);
    // active powers
    let x = W - 12;
    for (const [k, v, max] of [['x2', p.x2, 10], ['magnet', p.magnet, 9], ['rocket', p.rocket, 3.5]]) if (v > 0) { const col = POWS[k][2]; c.fillStyle = 'rgba(0,0,0,.45)'; roundRect(c, x - 30, H - 22, 30, 12, 6); c.fill(); c.fillStyle = col; roundRect(c, x - 29, H - 21, 28 * (v / max), 10, 5); c.fill(); this.text(c, POWS[k][0], x - 15, H - 15.5, 8, '#111'); x -= 36; }
    this.fx.over(c);
  }
  drawGround(c) {
    const gaps = this.obs.filter((o) => o.type === 'gap').sort((a, b) => a.x - b.x), segs = [];
    let x = -20;
    for (const g of gaps) { if (g.x > x) segs.push([x, g.x]); x = Math.max(x, g.x + g.w); }
    segs.push([x, W + 20]);
    for (const g of gaps) {
      if (g.x > W || g.x + g.w < 0) continue;
      const gr = c.createLinearGradient(0, G, 0, H);
      if (g.lava) { gr.addColorStop(0, '#ffdf6a'); gr.addColorStop(0.15, '#ff7a1a'); gr.addColorStop(1, '#7a1405'); } else { gr.addColorStop(0, mix(this.groundC, '#000', 0.55)); gr.addColorStop(1, '#000'); }
      c.fillStyle = gr; c.fillRect(g.x, g.lava ? G + 10 : G, g.w, H - G);
      if (g.lava) { c.fillStyle = 'rgba(255,220,120,.8)'; for (let i = 0; i < g.w; i += 9) c.fillRect(g.x + i, G + 10 + Math.sin(this.t * 4 + (g.x + i) * 0.2) * 2, 6, 2); c.globalAlpha = 0.25; c.fillStyle = '#ff9a3a'; c.fillRect(g.x, G - 20, g.w, 30); c.globalAlpha = 1; }
    }
    const tile = this.skin.pick('blk', 'block', 'tile');
    for (const [a, b] of segs) {
      if (b < 0 || a > W) continue;
      c.fillStyle = this.groundC; c.fillRect(a, G, b - a, H - G);
      if (ready(tile)) { c.save(); c.beginPath(); c.rect(a, G, b - a, H - G); c.clip(); c.globalAlpha = 0.3; c.translate(-(this.dist % 64), 0); drawRectImg(c, tile, a - 64, G, b - a + 128, H - G, true); c.restore(); c.globalAlpha = 1; }
      c.fillStyle = this.edgeC; c.fillRect(a, G, b - a, 4);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(a, G + 4, b - a, 3);
      if (a > -10) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(a, G, 3, H - G); }
      if (b < W + 10) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(b - 3, G, 3, H - G); }
    }
    // pebbles and tufts scroll at ground speed
    c.fillStyle = mix(this.groundC, '#000', 0.3);
    for (let i = 0; i < 9; i++) { const px = i * 48 - (this.dist % 48) + ((i * 37) % 20); if (segs.some(([a, b]) => px > a && px < b)) c.fillRect(px, G + 12 + ((i * 13) % 30), 4, 2); }
  }
  drawOb(c, o) {
    const t = this.t;
    switch (o.type) {
      case 'spike': {
        const n = Math.round(o.w / 22);
        for (let i = 0; i < n; i++) { const x = o.x + i * 22; c.fillStyle = this.col(3); c.beginPath(); c.moveTo(x, G); c.lineTo(x + 11, G - o.h); c.lineTo(x + 22, G); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(x + 11, G - o.h); c.lineTo(x + 14, G); c.lineTo(x + 11, G); c.fill(); }
        break;
      }
      case 'block': case 'faller': {
        const f = o.type === 'faller' ? this.fallY(o, o.x, this.p.x) : 0, y = G - o.h - f;
        if (f > 0) { c.globalAlpha = clamp(1 - f / 300, 0.15, 0.6); c.fillStyle = '#000'; c.beginPath(); c.ellipse(o.x + o.w / 2, G + 2, o.w * 0.6 * (1 - f / 900), 4, 0, 0, 7); c.fill(); c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.25)'; c.beginPath(); for (const k of [0.25, 0.75]) { c.moveTo(o.x + o.w * k, y - 6); c.lineTo(o.x + o.w * k, y - 30); } c.stroke(); }
        c.fillStyle = o.type === 'faller' ? this.col(4) : this.col(1); roundRect(c, o.x, y, o.w, o.h, 3); c.fill();
        const tl = this.skin.pick('blk', 'block', 'tile'); if (ready(tl)) { c.save(); roundRect(c, o.x, y, o.w, o.h, 3); c.clip(); c.globalAlpha = 0.55; drawRectImg(c, tl, o.x, y, o.w, o.h, true); c.restore(); c.globalAlpha = 1; }
        c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(o.x + 2, y + 1, o.w - 4, 3);
        if (o.type === 'faller') { c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.5; c.strokeRect(o.x + 4, y + 4, o.w - 8, o.h - 8); }
        break;
      }
      case 'plat': {
        c.fillStyle = this.col(5); roundRect(c, o.x, o.y, o.w, 9, 4); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(o.x + 3, o.y + 1, o.w - 6, 2);
        c.globalAlpha = 0.4 + Math.sin(t * 8) * 0.2; c.fillStyle = this.col(1); for (const k of [0.25, 0.75]) { c.beginPath(); c.ellipse(o.x + o.w * k, o.y + 12, 6, 2.5, 0, 0, 7); c.fill(); } c.globalAlpha = 1;
        break;
      }
      case 'saw': case 'roller': {
        const [cx, cy] = this.sawPos(o, o.x, t), rot = o.type === 'roller' ? -(this.dist + o.vr * t) / o.r : t * 14;
        if (o.hang) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, cy); c.stroke(); }
        if (o.ax) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(o.x + o.r - 2, G - 2, o.w - 2 * o.r + 4, 4); }
        c.save(); c.translate(cx, cy); c.rotate(rot);
        if (o.type === 'roller') {
          c.fillStyle = mix(this.col(1), '#5a4a3a', 0.5); c.beginPath(); c.arc(0, 0, o.r, 0, 7); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-o.r * 0.6, -o.r * 0.2); c.lineTo(o.r * 0.1, o.r * 0.3); c.lineTo(o.r * 0.5, -o.r * 0.4); c.stroke();
          c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(-o.r * 0.3, -o.r * 0.3, o.r * 0.4, 0, 7); c.fill();
        } else {
          c.fillStyle = '#c9d2d8'; c.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, rr = i % 2 ? o.r * 0.78 : o.r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill();
          c.fillStyle = '#7d8890'; c.beginPath(); c.arc(0, 0, o.r * 0.55, 0, 7); c.fill(); c.fillStyle = '#e9eef1'; c.beginPath(); c.arc(0, 0, o.r * 0.18, 0, 7); c.fill();
        }
        c.restore();
        if (!o.hang && o.type === 'saw') { c.fillStyle = this.groundC; c.fillRect(cx - o.r - 2, G + 1, o.r * 2 + 4, 8); c.fillStyle = this.edgeC; c.fillRect(cx - o.r - 2, G, o.r * 2 + 4, 3); }
        break;
      }
      case 'ceil': case 'crusher': {
        const y = o.type === 'crusher' ? o.y + (G - o.y) * (o.drop || 0) : o.y, x = o.x;
        if (o.type === 'crusher') {
          c.strokeStyle = 'rgba(200,200,200,.6)'; c.lineWidth = 3; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(x + o.w / 2, 0); c.lineTo(x + o.w / 2, y - 40); c.stroke(); c.setLineDash([]);
          c.fillStyle = '#5b6168'; roundRect(c, x, y - 40, o.w, 40, 3); c.fill();
          c.fillStyle = '#ffd23a'; for (let i = 0; i < o.w - 6; i += 10) { c.beginPath(); c.moveTo(x + 3 + i, y - 40); c.lineTo(x + 8 + i, y - 40); c.lineTo(x + 3 + i, y - 30); c.fill(); }
          c.fillStyle = '#3a3f44'; for (let i = 0; i < o.w; i += 8) { c.beginPath(); c.moveTo(x + i, y - 2); c.lineTo(x + i + 4, y + 3); c.lineTo(x + i + 8, y - 2); c.fill(); }
        } else {
          c.fillStyle = mix(this.groundC, '#000', 0.2); c.fillRect(x, -10, o.w, y + 10);
          const tl = this.skin.pick('blk', 'block', 'tile'); if (ready(tl)) { c.globalAlpha = 0.35; drawRectImg(c, tl, x, -10, o.w, y + 10, true); c.globalAlpha = 1; }
          c.fillStyle = this.edgeC; c.fillRect(x, y - 3, o.w, 3);
          if (o.spiky) { c.fillStyle = this.col(3); for (let i = 0; i + 10 <= o.w; i += 10) { c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i + 5, y + 9); c.lineTo(x + i + 10, y); c.fill(); } }
        }
        break;
      }
      case 'laser': {
        const on = this.laserOn(o, t), ph = ((t + o.ph) % o.per) / o.per, warn = !on && ph > 1 - 0.25 / o.per * 1.5, bx = o.x + o.w / 2;
        c.fillStyle = '#3a3f44'; roundRect(c, o.x, G - 8, o.w, 8, 2); c.fill(); c.fillRect(o.x + 2, G - o.h - 6, o.w - 4, 6);
        c.fillStyle = on ? '#ff3a5a' : warn && Math.floor(t * 20) % 2 ? '#ff8a9a' : '#5a2a32'; c.fillRect(o.x + 4, G - 6, o.w - 8, 3); c.fillRect(o.x + 4, G - o.h - 3, o.w - 8, 2);
        if (on) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35; c.fillStyle = '#ff2a4a'; c.fillRect(bx - 5, G - o.h, 10, o.h - 8); c.globalAlpha = 1; c.fillStyle = '#ffd6de'; c.fillRect(bx - 1.2, G - o.h, 2.4, o.h - 8); c.globalCompositeOperation = 'source-over'; }
        else if (warn) { c.globalAlpha = 0.4; c.strokeStyle = '#ff6a7a'; c.lineWidth = 1; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(bx, G - o.h); c.lineTo(bx, G - 8); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
        break;
      }
      case 'wire': {
        const y = o.y, flick = 0.75 + Math.sin(t * 40 + o.x) * 0.25;
        c.fillStyle = '#3a3f44';
        if (o.high) { for (const x of [o.x - 3, o.x + o.w - 3]) { c.fillRect(x, y - 10, 6, 14); c.fillStyle = 'rgba(200,200,200,.5)'; c.fillRect(x + 2, 0, 2, y - 10); c.fillStyle = '#3a3f44'; } }
        else for (const x of [o.x - 3, o.x + o.w - 3]) c.fillRect(x, y - 4, 6, G - y + 4);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.4 * flick; c.fillStyle = '#ff2a4a'; c.fillRect(o.x, y - 3, o.w, 6); c.globalAlpha = flick; c.fillStyle = '#ffc2cc'; c.fillRect(o.x, y - 0.8, o.w, 1.6); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        break;
      }
      case 'walker': {
        const m = o.m, fr = m?.walk?.[Math.floor(t * 8) % (m.walk.length || 1)] || m?.frames?.[0];
        if (!drawFit(c, fr, o.x + 13, G - 15, 34 * this.S, 34 * this.S, 0, true)) { c.fillStyle = this.col(3); roundRect(c, o.x, G - o.h, o.w, o.h, 8); c.fill(); c.fillStyle = '#fff'; c.fillRect(o.x + 5, G - o.h + 7, 5, 5); c.fillStyle = '#000'; c.fillRect(o.x + 5, G - o.h + 9, 2.5, 2.5); }
        break;
      }
      case 'pad': {
        const sq = o.sq * 7, top = G - 12 + sq;
        c.fillStyle = '#3a3f44'; c.fillRect(o.x, G - 4, o.w, 4);
        c.strokeStyle = '#c9d2d8'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 4; i++) c.lineTo(o.x + (i % 2 ? 6 : o.w - 6), G - 4 - ((G - 4 - top) * i) / 4); c.stroke();
        c.fillStyle = '#ffd23a'; roundRect(c, o.x - 2, top - 4, o.w + 4, 5, 2); c.fill();
        break;
      }
      case 'coin': {
        const s = Math.abs(Math.cos(t * 5 + o.x * 0.05)), cx = o.x + 7;
        c.fillStyle = '#b8860b'; c.beginPath(); c.ellipse(cx, o.y, 7 * s + 1, 7, 0, 0, 7); c.fill();
        c.fillStyle = '#ffd84a'; c.beginPath(); c.ellipse(cx, o.y, 5.5 * s + 0.5, 5.5, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(cx - 1 * s, o.y - 4, 2 * s, 3);
        break;
      }
      case 'pow': {
        const [l, , col] = POWS[o.k], y = o.y + Math.sin(t * 4 + o.x) * 3, cx = o.x + 12;
        c.globalAlpha = 0.3; c.fillStyle = col; c.beginPath(); c.arc(cx, y, 16 + Math.sin(t * 7) * 2, 0, 7); c.fill(); c.globalAlpha = 1;
        const g = c.createRadialGradient(cx - 3, y - 3, 1, cx, y, 12); g.addColorStop(0, mix(col, '#fff', 0.7)); g.addColorStop(1, col);
        c.fillStyle = g; c.beginPath(); c.arc(cx, y, 12, 0, 7); c.fill();
        this.text(c, l, cx, y + 0.5, l.length > 1 ? 9 : 11, '#111');
        break;
      }
    }
  }
  drawHero(c, p) {
    const sq = p.sq, sx = 1 + sq * 0.5, sy = 1 - sq * 0.5, fast = this.speed > 380 || p.rocket > 0;
    const body = (x, y, rot, a) => {
      c.save(); c.globalAlpha = a; c.translate(x + S / 2, y + S); c.scale(sx, sy); c.translate(0, -S / 2); c.rotate(rot);
      if (!drawFit(c, this.hero, 0, 0, S * 1.5, S * 1.5)) { c.fillStyle = this.col(0); roundRect(c, -S / 2, -S / 2, S, S, 4); c.fill(); c.fillStyle = this.pal.bg; c.fillRect(2, -5, 4, 4); }
      c.restore();
    };
    if (fast) p.trail.forEach(([x, y, r], i) => body(x, y, r, ((i + 1) / p.trail.length) * 0.25));
    if (p.rocket > 0) { const g = c.createRadialGradient(p.x + S / 2, p.y + S + 4, 1, p.x + S / 2, p.y + S + 8, 18); g.addColorStop(0, 'rgba(255,240,180,.95)'); g.addColorStop(0.4, 'rgba(255,140,40,.7)'); g.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = g; c.fillRect(p.x - 10, p.y + S - 8, S + 20, 34); }
    const blink = p.inv > 0 && Math.floor(this.t * 16) % 2;
    body(p.x, p.y, p.on ? 0 : p.rot, blink ? 0.4 : 1);
    if (p.shield) { c.globalAlpha = 0.35 + Math.sin(this.t * 6) * 0.1; c.strokeStyle = '#4fd8ff'; c.lineWidth = 2; c.fillStyle = 'rgba(79,216,255,.12)'; c.beginPath(); c.arc(p.x + S / 2, p.y + S / 2, S * 0.95, 0, 7); c.fill(); c.stroke(); c.globalAlpha = 1; }
    if (p.magnet > 0) { c.strokeStyle = 'rgba(255,90,122,.45)'; c.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const r = ((this.t * 60 + i * 30) % 60) + 14; c.globalAlpha = 1 - (r - 14) / 60; c.beginPath(); c.arc(p.x + S / 2, p.y + S / 2, r, 0, 7); c.stroke(); } c.globalAlpha = 1; }
    if (p.x2 > 0) this.text(c, '×2', p.x + S / 2, p.y - 12, 10, '#ffd23a');
  }
}
