import { Game, W, H, roundRect, drawFit, drawRectImg, ready } from './engine.js';
import { Fx, Backdrop, SCENE_KEYS, sceneFor, clamp, mix } from './arcadekit.js';

const GY = H - 20, PW = 54;
// each level strings a few designed segments together; later levels draw from everything
const LEVELS = [['pipes', 'stairs', 'movers'], ['zigzag', 'tunnel', 'gates'], ['spinners', 'mines', 'wind'], ['fork', 'movers', 'tunnel']];
const ALL = ['pipes', 'stairs', 'zigzag', 'movers', 'gates', 'tunnel', 'spinners', 'mines', 'wind', 'fork'];
const NAMES = { pipes: 'PIPES', stairs: 'STAIRS', zigzag: 'ZIGZAG', movers: 'MOVING PIPES', gates: 'GATES', tunnel: 'TUNNEL', spinners: 'SPINNERS', mines: 'MINEFIELD', wind: 'WIND', fork: 'FORK' };
const circRect = (cx, cy, r, x, y, w, h) => { const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h); return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r; };
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); };

// ================================================================ Flap
export class Flap extends Game {
  setup() {
    this.fx = new Fx();
    this.grav = 1250 * this.G;
    const set = this.skin.bgSet, R = () => this.rng();
    this.order = set?.length && sceneFor(this.skin.bgGroup, R) === 'sky' ? ['sky', 'hills', 'coast', 'sky', 'alien', 'desert'] : [...SCENE_KEYS];
    for (let i = this.order.length - 1; i > 0; i--) { const j = this.ri(0, i); [this.order[i], this.order[j]] = [this.order[j], this.order[i]]; }
    this.bird = this.skin.pick('bird', 'animal', 'enemy', 'ship');
    this.level = 0; this.restart();
  }
  restart() {
    this.b = { x: 100, y: H / 2 - 20, vy: 0, r: 11, rot: 0, flapT: 0 };
    this.obs = []; this.coins = []; this.guides = []; this.dead = 0; this.score = 0; this.dist = 0;
    this.lvGen = this.level; this.queue = this.plan(this.level); this.genX = W + 30;
    this.mark(this.level, this.genX - 10); this.setBiome(this.level, true);
    this.jit = 0; this.planT = 0;
  }
  plan(lv) {
    const base = LEVELS[lv] ? [...LEVELS[lv]] : Array.from({ length: 3 + (lv > 5 ? 1 : 0) }, () => ALL[this.ri(0, ALL.length - 1)]);
    if (lv === 0) base.unshift('pipes');
    return base;
  }
  diff(lv) { return clamp(lv / 5, 0, 1); }
  setBiome(lv, now) {
    const scene = this.order[lv % this.order.length];
    if (this.bd && !now) { this.old = this.bd; this.fade = 1; }
    this.bd = new Backdrop(this, scene, { imgs: this.skin.bgSet, floor: GY + 2, seed: (this.post.seed || 1) + lv * 7919 });
    this.groundC = mix(this.col(lv + 1), this.pal.bg, 0.35); this.pipeC = this.col(lv + 2); this.rockC = mix(this.col(lv + 4), this.pal.bg, 0.55);
    this.speed = Math.min(186, 140 + lv * 8);
  }
  mark(lv, x) { this.obs.push({ type: 'mark', x, w: 4, lv }); }
  // ---------------------------------------------------------- generation (screen coordinates, scrolled with the world)
  gen() {
    while (this.genX < W + 340) {
      if (!this.queue.length) { this.lvGen++; this.queue = this.plan(this.lvGen); this.genX += 60; this.mark(this.lvGen, this.genX); this.genX += 120; }
      const k = this.queue.shift();
      this.genX = this.seg(k, this.genX, this.diff(this.lvGen)) + this.r(120, 160);
    }
  }
  seg(k, x, d) {
    const gh = 152 - 32 * d, pipe = (o) => this.obs.push({ type: 'pipe', x, w: PW, gh, ...o });
    const coin = (cx, cy) => this.coins.push({ x: cx - 7, w: 14, y: cy });
    const guide = (x0, len, f) => { const ys = []; for (let u = 0; u <= len; u += 10) ys.push(f(u)); this.guides.push({ x: x0, w: len, ys }); };
    const top = 46, bot = GY - 40;
    switch (k) {
      case 'pipes': for (let i = 0; i < 4; i++) { const gy = this.r(top, bot - gh); pipe({ gy }); if (this.rng() < 0.5) coin(x + PW / 2, gy + gh / 2); x += this.r(165, 200); } break;
      case 'stairs': {
        const dir = this.rng() < 0.5 ? 1 : -1, step = this.r(30, 42) * dir; let gy = dir > 0 ? top + 4 : bot - gh - 4;
        for (let i = 0; i < 5; i++) { pipe({ gy }); coin(x + PW / 2, gy + gh / 2); gy = clamp(gy + step, top, bot - gh); x += this.r(145, 160); }
        break;
      }
      case 'zigzag': for (let i = 0; i < 5; i++) { const gy = i % 2 ? bot - gh - this.r(0, 24) : top + this.r(0, 24); pipe({ gy }); x += this.r(178, 196); } break;
      case 'movers': {
        const amp = this.r(30, 52), sp = Math.min(2, 78 / amp), mid = (top + bot - gh) / 2 + this.r(-20, 20);
        for (let i = 0; i < 4; i++) { pipe({ gy: mid, amp, sp, ph: i * this.r(0.8, 1.3) }); x += this.r(175, 200); }
        break;
      }
      case 'gates': for (let i = 0; i < 4; i++) { const g2 = gh * 1.12; this.obs.push({ type: 'pipe', x, w: PW, gh: g2, gy: this.r(top, bot - g2), br: this.r(0.22, 0.3), bs: this.r(1.5, 2.2), ph: this.r(0, 6) }); x += this.r(175, 200); } break;
      case 'tunnel': {
        const len = this.r(700, 980), mid = (GY) / 2, a1 = this.r(45, 70), a2 = this.r(10, 20), p1 = this.r(0, 6), p2 = this.r(0, 6), tops = [], bots = [], step = 12;
        for (let u = 0; u <= len; u += step) {
          const t = u / len, g = 168 - (66 + 8 * d) * Math.min(1, t * 1.25) + (t < 0.08 ? (0.08 - t) * 500 : 0) + (t > 0.94 ? (t - 0.94) * 600 : 0);
          let c = mid + a1 * Math.sin(u / 170 + p1) + a2 * Math.sin(u / 63 + p2);
          c = clamp(c, 24 + g / 2, GY - 24 - g / 2);
          tops.push(c - g / 2); bots.push(c + g / 2);
        }
        this.obs.push({ type: 'tun', x, w: len, step, tops, bots });
        guide(x, len, (u) => { const i = Math.min(tops.length - 1, Math.round(u / step)); return (tops[i] + bots[i]) / 2; });
        for (let u = 60; u < len - 30; u += 64) { const i = Math.round(u / step); coin(x + u, (tops[i] + bots[i]) / 2); }
        x += len; break;
      }
      case 'spinners': {
        const pts = [];
        for (let i = 0; i < 3; i++) {
          const L = this.r(55, 70), high = i % 2 === (this.rng() < 0.5 ? 0 : 1), cy = high ? this.r(125, 160) : this.r(GY - 160, GY - 125);
          const hx = x + L + 10, lane = high ? (cy + L + GY) / 2 : (cy - L) / 2;
          this.obs.push({ type: 'spin', x: hx - L - 6, w: 2 * L + 12, hx, cy, L, a0: this.r(0, 6), om: (this.rng() < 0.5 ? -1 : 1) * this.r(1.5, 2.3) });
          pts.push([hx - L - 30, lane], [hx + L + 30, lane]); coin(hx, lane);
          x = hx + L + this.r(150, 175);
        }
        const x0 = pts[0][0] - 60, x1 = pts[pts.length - 1][0];
        guide(x0, x1 - x0, (u) => { const wx = x0 + u; let y = pts[0][1]; for (let j = 0; j < pts.length; j++) { if (wx >= pts[j][0]) y = pts[j][1]; if (j + 1 < pts.length && wx > pts[j][0] && wx < pts[j + 1][0]) { const t = (wx - pts[j][0]) / (pts[j + 1][0] - pts[j][0]); y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * (t * t * (3 - 2 * t)); } } return y; });
        break;
      }
      case 'mines': {
        const len = this.r(620, 820), ph = this.r(0, 6), lane = (u) => GY / 2 + 92 * Math.sin(u / 150 + ph) * Math.min(1, u / 140);
        guide(x - 60, len + 60, (u) => lane(Math.max(0, u - 60)));
        for (let u = 50; u < len; u += this.r(52, 74)) {
          const amp = this.r(6, 14), off = 12 + 11 + amp + 42 + this.r(0, 40), side = this.rng() < 0.5 ? -1 : 1;
          for (const s of [side, -side]) { const cy = lane(u) + s * off; if (cy > 18 && cy < GY - 18) { this.obs.push({ type: 'mine', x: x + u - 12, w: 24, cy, amp, sp: this.r(1.5, 3), ph: this.r(0, 6), r: 12 }); break; } }
          if (u % 3 < 1.5) coin(x + u, lane(u));
        }
        x += len; break;
      }
      case 'wind': for (let i = 0; i < 4; i++) {
        const gy = this.r(top, bot - gh), f = this.rng() < 0.5 ? -this.r(650, 850) : this.r(450, 650), ww = this.r(70, 96);
        this.obs.push({ type: 'wind', x: x - ww - 18, w: ww, f }); pipe({ gy }); coin(x + PW / 2, gy + gh / 2); x += this.r(185, 210);
      } break;
      case 'fork': {
        const len = this.r(260, 340), yb = this.r(175, 235), up = this.rng() < 0.5, cy = up ? (yb - 5) / 2 : (yb + 5 + GY) / 2;
        this.obs.push({ type: 'bar', x, w: len, y: yb - 5, h: 10 });
        guide(x - 170, len + 170, () => cy);
        for (let u = 40; u < len - 20; u += this.r(80, 110)) { const my = up ? this.r(yb + 40, GY - 30) : this.r(30, yb - 40); this.obs.push({ type: 'mine', x: x + u - 12, w: 24, cy: my, amp: 8, sp: 2, ph: this.r(0, 6), r: 12 }); }
        for (let u = 30; u < len; u += 50) coin(x + u, cy);
        x += len; break;
      }
    }
    return x;
  }
  // ---------------------------------------------------------- physics shared by the game and the autopilot's look-ahead
  gap(o, T) {
    let top = o.gy, gh = o.gh;
    if (o.amp) top += o.amp * Math.sin(o.sp * T + o.ph);
    if (o.br) { const k = o.br * (0.5 + 0.5 * Math.sin(o.bs * T + o.ph)); top += (gh * k) / 2; gh *= 1 - k; }
    return [top, gh];
  }
  tunAt(o, ox, wx) { const u = clamp((wx - ox) / o.step, 0, o.tops.length - 1.001), i = Math.floor(u), f = u - i; return [o.tops[i] + (o.tops[i + 1] - o.tops[i]) * f, o.bots[i] + (o.bots[i + 1] - o.bots[i]) * f]; }
  arm(o, T) { const a = o.a0 + o.om * T; return [Math.cos(a) * o.L, Math.sin(a) * o.L]; }
  phys(q, dt, tau, real) {
    const T = this.t + tau, sh = this.speed * tau, bx = this.b.x, r = this.b.r + (real ? -1 : 1.5);
    let f = 0;
    for (const o of this.obs) if (o.type === 'wind') { const ox = o.x - sh; if (bx > ox && bx < ox + o.w) f += o.f; }
    q.vy += (this.grav + f) * dt; q.y += q.vy * dt;
    if (q.y - r < 0 || q.y + r > GY) return true;
    for (const o of this.obs) {
      const ox = o.x - sh;
      if (ox > bx + r + 2 || ox + o.w < bx - r - 2) continue;
      switch (o.type) {
        case 'pipe': { const [t, g] = this.gap(o, T); if (circRect(bx, q.y, r, ox, -40, o.w, t + 40) || circRect(bx, q.y, r, ox, t + g, o.w, H)) return true; break; }
        case 'tun': for (const dx of [-r * 0.7, 0, r * 0.7]) { const [t, b] = this.tunAt(o, ox, bx + dx); if (q.y - r < t || q.y + r > b) return true; } break;
        case 'spin': { const [ax, ay] = this.arm(o, T), hx = o.hx - sh; if (segDist(bx, q.y, hx - ax, o.cy - ay, hx + ax, o.cy + ay) < r + 3 || Math.hypot(bx - hx, q.y - o.cy) < r + 8) return true; break; }
        case 'mine': if (Math.hypot(bx - ox - 12, q.y - o.cy - o.amp * Math.sin(o.sp * T + o.ph)) < r + o.r - 2) return true; break;
        case 'bar': if (circRect(bx, q.y, r, ox, o.y, o.w, o.h)) return true; break;
      }
    }
    return false;
  }
  // where the autopilot wants to be: the next gap at the moment it gets there, else the segment's guide line
  target(tau) {
    const T = this.t + tau, sh = this.speed * tau, bx = this.b.x;
    let best = null, bd = Infinity;
    for (const o of this.obs) { if (o.type !== 'pipe') continue; const ox = o.x - sh; if (ox + o.w + 12 < bx) continue; if (ox - bx < bd) { bd = ox - bx; best = o; } }
    if (best && bd < 150) { const [t, g] = this.gap(best, T + Math.max(0, (best.x - sh + best.w / 2 - bx) / this.speed)); return t + g / 2; }
    for (const o of this.guides) { const u = bx + 26 - (o.x - sh); if (u >= 0 && u <= o.w) return o.ys[Math.min(o.ys.length - 1, Math.round(u / 10))]; }
    if (best) { const [t, g] = this.gap(best, T + (best.x - sh + best.w / 2 - bx) / this.speed); return t + g / 2; }
    return GY / 2;
  }
  roll(first, hor = 0.85) {
    const q = { y: this.b.y, vy: first ? -360 : this.b.vy }, dt = 1 / 60;
    for (let tau = 0; tau < hor; tau += dt) {
      if (this.phys(q, dt, tau, false)) return { dead: true, t: tau };
      if (q.vy >= 0 && q.y > this.target(tau + dt) + 24 + this.jit) q.vy = -360;
    }
    return { dead: false, t: hor };
  }
  autopilot(dt) {
    if (this.dead || (this.planT -= dt) > 0) return;
    this.planT = 1 / 60;
    const b = this.b, want = b.vy >= 0 && b.y > this.target(0) + 24 + this.jit;
    const a = this.roll(want);
    if (!a.dead) { if (want) this.flap(); return; }
    const o = this.roll(!want);
    if ((!o.dead || o.t > a.t + 0.05) ? !want : want) this.flap();
  }
  flap() {
    if (this.dead) return;
    const b = this.b; b.vy = -360; b.flapT = 0.18; this.jit = this.r(-5, 7);
    this.fx.puff(b.x - 8, b.y + 4, -60, 30, 4, 'rgba(255,255,255,1)', 0.35, 18, 0.35);
  }
  down() { this.flap(); }
  // ---------------------------------------------------------- game step
  step(dt) {
    this.fx.step(dt);
    if (this.fade > 0) { this.fade -= dt * 0.7; if (this.fade <= 0) this.old = null; }
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.restart(); return; }
    const b = this.b, dx = this.speed * dt;
    this.dist += dx;
    for (const l of [this.obs, this.coins, this.guides]) for (const o of l) o.x -= dx;
    this.genX -= dx; this.gen();
    b.flapT -= dt;
    if (this.phys(b, dt, 0, true)) return this.die();
    b.rot += (clamp(b.vy / 500, -0.5, 1.2) - b.rot) * Math.min(1, dt * 12);
    for (const o of this.obs) {
      if (o.passed || o.x + o.w > b.x) continue;
      o.passed = true;
      if (o.type === 'mark') continue;
      if (o.type === 'pipe' || o.type === 'spin') { this.score++; this.fx.sparks(b.x - 4, b.y, 3, this.pal.ink, 80, Math.PI, 1.2, 0.25); }
    }
    for (const o of this.obs) if (o.type === 'mark' && !o.hit && o.x < b.x) { o.hit = true; if (o.lv !== this.level) { this.level = o.lv; this.setBiome(o.lv); this.fx.flash('#fff', 0.25, 0.4); } this.banner(); }
    for (const k of this.coins) if (!k.got && Math.hypot(k.x + 7 - b.x, k.y - b.y) < b.r + 9) { k.got = true; this.score++; this.fx.sparks(k.x + 7, k.y, 7, '#ffe58a', 120, 0, 7, 0.3); this.fx.ring(k.x + 7, k.y, 13, '#ffe58a', 0.25, 2); }
    this.obs = this.obs.filter((o) => o.x + o.w > -60);
    this.coins = this.coins.filter((k) => !k.got && k.x > -30);
    this.guides = this.guides.filter((o) => o.x + o.w > -30);
    for (const o of this.obs) if (o.type === 'wind' && o.x < W && Math.random() < 0.5) this.fx.spark(o.x + this.r(0, o.w), o.f < 0 ? GY - 4 : 4, -this.speed * 0.3, o.f < 0 ? -this.r(160, 260) : this.r(160, 260), o.f < 0 ? 'rgba(190,240,255,.8)' : 'rgba(255,210,190,.8)', 1.6);
  }
  banner() {
    const names = (LEVELS[this.level] || []).map((k) => NAMES[k]).join(' · ');
    this.fx.text(W / 2, H * 0.3, `LEVEL ${this.level + 1}`, this.pal.ink, 26, 1.8, -6);
    if (names) this.fx.text(W / 2, H * 0.3 + 26, names, this.col(this.level + 2), 11, 1.8, -6);
  }
  die() {
    const b = this.b;
    this.dead = 0.9; this.fx.shake(6, 0.35); this.fx.flash('#fff', 0.3, 0.2);
    this.burst(b.x, b.y, this.col(0), 18);
    for (let i = 0; i < 10; i++) this.fx.chip(b.x, b.y, this.r(-200, 120), this.r(-300, -40), this.r(3, 6), this.col(i % 3), 1.2, 700);
  }
  hud() { return `L${this.level + 1} · ${this.score}`; }
  // ---------------------------------------------------------- drawing
  draw(c) {
    this.fx.apply(c);
    const b = this.b, camY = clamp((H / 2 - b.y) * 0.1, -16, 16);
    if (this.mods.trails && this.t > 0.5) { this.clear(c); this.bd.draw(c, this.dist, camY, this.t, 0.3); }
    else { this.bd.draw(c, this.dist, camY, this.t); if (this.old) this.old.draw(c, this.dist, camY, this.t, clamp(this.fade, 0, 1)); }
    if (this.wall) { c.globalAlpha = 0.18; for (const w of this.wall) drawFit(c, w.i, w.x, w.y, w.s, w.s, w.r); c.globalAlpha = 1; }
    const T = this.t, tile = this.skin.pick('pipe', 'tile', 'block');
    for (const o of this.obs) {
      if (o.x > W + 20 || o.x + o.w < -20) continue;
      switch (o.type) {
        case 'wind': {
          const up = o.f < 0, col = up ? '190,240,255' : '255,200,180';
          const g = c.createLinearGradient(o.x, 0, o.x + o.w, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},.14)`); g.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = g; c.fillRect(o.x, 0, o.w, GY);
          c.strokeStyle = `rgba(${col},.45)`; c.lineWidth = 2;
          for (let i = 0; i < 3; i++) { const ax = o.x + o.w * (0.25 + i * 0.25), ay = ((T * 120 * (up ? -1 : 1) + i * 90) % GY + GY) % GY; c.beginPath(); c.moveTo(ax - 6, ay + (up ? 6 : -6)); c.lineTo(ax, ay); c.lineTo(ax + 6, ay + (up ? 6 : -6)); c.stroke(); }
          break;
        }
        case 'pipe': {
          const [t, g] = this.gap(o, T);
          this.pipe(c, o.x, -10, t + 10, tile, false); this.pipe(c, o.x, t + g, GY - t - g, tile, true);
          if (o.br) { c.fillStyle = '#ffd23a'; for (const y of [t - 6, t + g]) { c.fillRect(o.x - 4, y, o.w + 8, 6); c.fillStyle = '#2a2a2a'; for (let i = 0; i < o.w + 8; i += 10) c.fillRect(o.x - 4 + i, y, 5, 6); c.fillStyle = '#ffd23a'; } }
          if (o.amp) { c.fillStyle = 'rgba(255,255,255,.5)'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(o.x + o.w / 2 - 5, t + g / 2 + s * (g / 2 - 14)); c.lineTo(o.x + o.w / 2 + 5, t + g / 2 + s * (g / 2 - 14)); c.lineTo(o.x + o.w / 2, t + g / 2 + s * (g / 2 - 8)); c.fill(); } }
          break;
        }
        case 'tun': this.tunnel(c, o, tile); break;
        case 'spin': {
          const [ax, ay] = this.arm(o, T);
          c.globalAlpha = 0.15; c.fillStyle = this.pal.ink; c.beginPath(); c.arc(o.hx, o.cy, o.L + 4, 0, 7); c.fill(); c.globalAlpha = 1;
          c.lineCap = 'round'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 9; c.beginPath(); c.moveTo(o.hx - ax + 2, o.cy - ay + 3); c.lineTo(o.hx + ax + 2, o.cy + ay + 3); c.stroke();
          c.strokeStyle = this.col(3); c.lineWidth = 7; c.beginPath(); c.moveTo(o.hx - ax, o.cy - ay); c.lineTo(o.hx + ax, o.cy + ay); c.stroke();
          c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.stroke(); c.lineCap = 'butt';
          c.fillStyle = '#3a3f44'; c.beginPath(); c.arc(o.hx, o.cy, 9, 0, 7); c.fill(); c.fillStyle = '#c9d2d8'; c.beginPath(); c.arc(o.hx, o.cy, 4, 0, 7); c.fill();
          break;
        }
        case 'mine': {
          const cy = o.cy + o.amp * Math.sin(o.sp * T + o.ph), cx = o.x + 12;
          c.fillStyle = '#2f3438'; c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + T * 0.5, rr = i % 2 ? o.r * 0.8 : o.r + 4; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.fill();
          c.fillStyle = '#4a5157'; c.beginPath(); c.arc(cx, cy, o.r * 0.75, 0, 7); c.fill();
          c.fillStyle = Math.floor(T * 3 + o.ph) % 2 ? '#ff3a3a' : '#5a1a1a'; c.beginPath(); c.arc(cx, cy, 3, 0, 7); c.fill();
          break;
        }
        case 'bar': {
          c.fillStyle = '#3a3f44'; c.fillRect(o.x, o.y, o.w, o.h); c.fillStyle = '#ffd23a';
          for (let i = 0; i < o.w; i += 16) { c.beginPath(); c.moveTo(o.x + i, o.y + o.h); c.lineTo(o.x + i + 8, o.y); c.lineTo(o.x + i + 14, o.y); c.lineTo(o.x + i + 6, o.y + o.h); c.fill(); }
          break;
        }
        case 'mark': {
          if (o.lv === 0 && this.level === 0 && this.t < 3) break;
          c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(o.x, 24); c.lineTo(o.x, GY); c.stroke(); c.setLineDash([]);
          c.fillStyle = this.col(o.lv + 2); c.beginPath(); c.moveTo(o.x, 24); c.lineTo(o.x + 30, 32); c.lineTo(o.x, 40); c.fill();
          this.text(c, `${o.lv + 1}`, o.x + 10, 32, 9, '#111');
          break;
        }
      }
    }
    for (const k of this.coins) {
      if (k.x > W || k.x < -20) continue;
      const s = Math.abs(Math.cos(T * 5 + k.x * 0.05)), cx = k.x + 7;
      c.fillStyle = '#b8860b'; c.beginPath(); c.ellipse(cx, k.y, 7 * s + 1, 7, 0, 0, 7); c.fill();
      c.fillStyle = '#ffd84a'; c.beginPath(); c.ellipse(cx, k.y, 5.5 * s + 0.5, 5.5, 0, 0, 7); c.fill();
    }
    // ground
    c.fillStyle = this.groundC; c.fillRect(0, GY, W, H - GY);
    c.fillStyle = mix(this.groundC, '#fff', 0.2); c.fillRect(0, GY, W, 3);
    c.fillStyle = mix(this.groundC, '#000', 0.25); for (let x = -(this.dist % 24); x < W; x += 24) c.fillRect(x, GY + 8, 12, 3);
    this.fx.draw(c);
    if (!this.dead) {
      c.save(); c.translate(b.x, b.y); c.rotate(b.rot);
      const sq = b.flapT > 0 ? 1 + b.flapT * 1.2 : 1;
      c.scale(1 / Math.sqrt(sq), sq);
      if (!drawFit(c, this.bird, 0, 0, b.r * 3 * this.S, b.r * 3 * this.S)) {
        c.fillStyle = this.col(0); c.beginPath(); c.arc(0, 0, b.r, 0, 7); c.fill();
        c.fillStyle = this.pal.ink; c.beginPath(); c.arc(4, -3, 3.5, 0, 7); c.fill();
        c.fillStyle = this.pal.bg; c.beginPath(); c.arc(5, -3, 1.6, 0, 7); c.fill();
        c.fillStyle = this.col(1); c.beginPath(); c.moveTo(9, 0); c.lineTo(16, 2); c.lineTo(9, 4); c.fill();
      }
      c.restore();
    }
    this.fx.over(c);
  }
  pipe(c, x, y, h, tile, up) {
    if (h <= 0) return;
    const col = this.pipeC, g = c.createLinearGradient(x, 0, x + PW, 0);
    g.addColorStop(0, mix(col, '#fff', 0.25)); g.addColorStop(0.35, col); g.addColorStop(1, mix(col, '#000', 0.35));
    c.fillStyle = g; c.fillRect(x, y, PW, h);
    if (ready(tile)) { c.globalAlpha = 0.3; drawRectImg(c, tile, x, y, PW, h, true); c.globalAlpha = 1; }
    const ly = up ? y : y + h - 14;
    c.fillStyle = g; roundRect(c, x - 5, ly, PW + 10, 14, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x - 3, ly + 2, PW + 6, 2);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - 5, up ? ly + 14 : ly - 3, PW + 10, 3);
  }
  tunnel(c, o, tile) {
    const i0 = Math.max(0, Math.floor(-o.x / o.step) - 1), i1 = Math.min(o.tops.length - 1, Math.ceil((W - o.x) / o.step) + 1);
    if (i1 <= i0) return;
    const path = (arr, edge) => { c.beginPath(); c.moveTo(o.x + i0 * o.step, edge); for (let i = i0; i <= i1; i++) c.lineTo(o.x + i * o.step, arr[i]); c.lineTo(o.x + i1 * o.step, edge); c.closePath(); };
    for (const [arr, edge] of [[o.tops, -10], [o.bots, GY]]) {
      path(arr, edge); c.fillStyle = this.rockC; c.fill();
      if (ready(tile)) { c.save(); c.clip(); c.globalAlpha = 0.35; drawRectImg(c, tile, o.x + i0 * o.step, -10, (i1 - i0) * o.step, GY + 10, true); c.restore(); c.globalAlpha = 1; }
      c.strokeStyle = mix(this.rockC, '#fff', 0.35); c.lineWidth = 2.5; c.beginPath(); for (let i = i0; i <= i1; i++) c.lineTo(o.x + i * o.step, arr[i] + (edge < 0 ? -1 : 1)); c.stroke();
      c.fillStyle = mix(this.rockC, '#000', 0.25);
      for (let i = i0 - (i0 % 3); i <= i1; i += 3) { if (i < 0) continue; const x = o.x + i * o.step, y = arr[i], s = 5 + ((i * 7) % 5); c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x, y + (edge < 0 ? s : -s)); c.lineTo(x + 4, y); c.fill(); }
    }
  }
}
