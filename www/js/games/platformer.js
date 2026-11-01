import { Game, W, H, roundRect, drawFit, ready, rgbOf } from './engine.js';
import { Actor, ERAS, drawFrame } from '../crystal/sprites.js';
import { mulberry32 } from '../util.js';

// ================================================================ Platformer
// One tap jumps, a second tap in the air double-jumps; the hero runs on its own. The level is built
// segment by segment from themed areas (meadow, caverns, ruins, works, skyway): floors with steps and
// pits, platform towers with ladders, decks over decks, caves under low ceilings, bounce pads and
// springs, conveyors, moving and crumbling platforms, one-way ledges, spikes and foes. Every segment is
// checked against the hero's own physics (the same step function, searched over jump timings from the
// segment's entry at several moving-platform phases, after a respawn and with the speed power-up) and is
// rebuilt or simplified until it can be beaten. The autopilot plans with that same search over the next
// second and a half, so it runs for coins, power-ups and stomps and rarely dies.
// The hero is a Crystal Sprite: walk into a run, crouch-jump-apex-fall-land, attack or shoot foes in reach,
// climb ladders (back view), flinch, knockdown, kneel after a fall; cheers and surprise play only in the
// air or while standing for a respawn, so emotes never touch the motion.
const TAU = Math.PI * 2;
const SDT = 1 / 60, DEC = 2, TICKS = 4; // search step, search steps per decision, game ticks per decision
const BK = 96, DEEP = 1400, KILL = 560, SAVE = 430, CRUMBLE = 0.45, FMIN = 230, FMAX = 350;
// power-ups: state key, seconds, colour, label
const PWR = { shield: ['sh', 14, '#7fe3ff', 'SHIELD'], magnet: ['mg', 9, '#ff6b7a', 'MAGNET'], wings: ['wg', 9, '#fff3c4', 'WINGS'], speed: ['sp', 6, '#ffc23a', 'SPEED'], star: ['st', 7, '#ffe45e', 'STAR'] };
const AREAS = [
  { id: 'meadow', name: 'MEADOW', kinds: { run: 3, gaps: 3, stairs: 2, upper: 3, bounce: 2, tower: 1.5, crumble: 0.6 } },
  { id: 'cave', name: 'CAVERNS', kinds: { cave: 1 }, ceil: true },
  { id: 'ruins', name: 'RUINS', kinds: { tower: 3, crumble: 2, stairs: 2, upper: 2, gaps: 1.5 } },
  { id: 'works', name: 'WORKS', kinds: { belts: 3, movers: 2, crumble: 1, upper: 1 } },
  { id: 'sky', name: 'SKYWAY', kinds: { sky: 3, bounce: 2, movers: 1.5, gaps: 1 } }
];
const SURF = { g: 1, o: 1, l: 1, p: 1, c: 1, m: 1 };
const mixc = (a, b, t) => { const p = rgbOf(a), q = rgbOf(b); return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(',')})`; };

export class Platformer extends Game {
  setup() {
    const G = this.G, S = this.S, sg = Math.sqrt(G);
    this.ph = { g: 1500 * G, jv: 560 * sg, av: 480 * sg, run: 150 * S ** 0.3, acc: 560, w: Math.round(16 * S), h: Math.round(28 * S), climb: 125,
      pad: Math.sqrt(2 * 1500 * G * 200), spring: Math.sqrt(2 * 1500 * G * 300), stomp: 430 * sg, hurt: 300 * sg, coy: 0.08, step: 12 };
    const P = this.ph, J1 = P.jv * P.jv / (2 * P.g), J2 = J1 + P.av * P.av / (2 * P.g);
    const t1 = (dy) => (P.jv + Math.sqrt(Math.max(0, P.jv * P.jv + 2 * P.g * dy))) / P.g;
    const t2 = (dy) => P.jv / P.g + P.av / P.g + Math.sqrt(Math.max(0, 2 * (J2 + dy) / P.g));
    this.cap = { J1, J2, D1: (dy = 0, v = P.run) => v * t1(dy), D2: (dy = 0, v = P.run) => v * t2(dy) };
    this.maxHp = this.mods.glass ? 1 : 3;
    this.hero = new Actor(this.skin.crystal(0, ERAS[(this.skin.cseed >>> 0) % 3], ['W', 'E', 'N']), { mode: 'side', dir: 'E', walkSpeed: 4, runSpeed: 95, walkStride: 6, runStride: 11 });
    this.qa = []; this.qb = []; this.qn = 0; this.oid = 1;
    this.lr = mulberry32(((this.post.seed || 1) ^ 0x2c1b3c6d) >>> 0);
    this.looks();
    this.reset(true);
  }
  R(a = 0, b = 1) { return a + this.lr() * (b - a); }
  Ri(a, b) { return Math.floor(this.R(a, b + 1)); }
  Rc(p) { return this.lr() < p; }
  Rw(o) { let x = this.lr() * Object.values(o).reduce((a, b) => a + b, 0); for (const k in o) if ((x -= o[k]) <= 0) return k; return Object.keys(o)[0]; }

  // ---------------------------------------------------------------- state
  fresh(x, y) {
    return { x, y, vx: 0, vy: 0, on: null, j: 0, lad: null, t: 0, coy: 0, lc: 0, inv: 0, cool: 0, sw: 0, hp: this.maxHp, sh: 0, mg: 0, wg: 0, sp: 0, st: 0, wait: 0, gun: false,
      kill: null, got: null, cr: null, hurt: 0, fell: false, n: 0, pw: 0, heal: 0, ko: 0, bon: 0, jc: 0, real: false, ev: null };
  }
  reset(first) {
    this.objs = []; this.grid = new Map(); this.agrid = new Map(); this.gmin = -20; this.segs = []; this.deco = []; this.job = null;
    this.genX = -200; this.genY = 320; this.areaI = 0; this.areaLeft = 3; this.segN = 0; this.pwIn = 2; this.fastTill = -1e9; this.heartIn = 6;
    this.camX = 0; this.camY = 0; this.dead = 0; this.tick = 0; this.want = false; this.buf = 0; this.plan = null; this.fx = []; this.pops = []; this.trail = [];
    this.coins = 0; this.kills = 0; this.maxX = 0; this.cheerQ = 0; this.banner = { s: AREAS[0].name, t: 2.2 };
    const B = this.mk(this.genX, this.genY, 0, 0);
    this.gnd(B, B.x0, 560, B.y0);
    for (let i = 0; i < 4; i++) this.item(B, 200 + i * 26, B.y0 - 22, 'coin');
    this.fin(B, 560); this.commit(B);
    while (this.genX < W * 2.2) { const j = this.makeSeg(); let r; do r = j.next(); while (!r.done); this.commit(r.value); }
    const P = this.ph, p = this.p = this.fresh(60, B.y0 - P.h);
    p.on = B.entry; p.real = true; p.ev = []; p.wait = first ? 0.9 : 0.7; p.t = this.t;
    this.hero.revive();
    if (first) this.hero.emote('wave', 0.8);
  }
  canJump(s) { return s.wait <= 0 && (!!s.on || !!s.lad || s.coy > 0 || s.j <= (s.wg > 0 ? 3 : 1)); }

  // ---------------------------------------------------------------- world queries
  put(grid, o) {
    let x0 = o.x, x1 = o.x + o.w;
    if (o.k === 'm') { x0 -= Math.abs(o.ax); x1 += Math.abs(o.ax); }
    if (o.k === 'f') x1 += o.span;
    for (let b = Math.floor(x0 / BK), e = Math.floor(x1 / BK); b <= e; b++) { const a = grid.get(b); if (a) a.push(o); else grid.set(b, [o]); }
  }
  q(x0, x1, grid, out) {
    out.length = 0; const id = ++this.qn;
    for (let b = Math.floor(x0 / BK), e = Math.floor(x1 / BK); b <= e; b++) { const a = grid.get(b); if (a) for (const o of a) if (o.qm !== id) { o.qm = id; out.push(o); } }
    return out;
  }
  mx(o, t) { return o.x + o.ax * Math.sin(t * o.f + o.ph); }
  my(o, t) { return o.y + o.ay * Math.sin(t * o.f + o.ph); }
  fx(f, t) { if (!f.span) return f.x; const u = (t * f.f + f.ph) % 2; return f.x + f.span * (u < 1 ? u : 2 - u); }
  fy(f, t) { return f.y - f.hop * Math.abs(Math.sin(t * f.hf + f.ph)) + f.amp * Math.sin(t * f.vf + f.ph); }
  has(o, s) { return o.got || (s.got !== null && s.got.includes(o.id)); }
  dead(f, s) { return !!f.dead || (s.kill !== null && s.kill.includes(f.id)); }
  fallen(o, s) {
    let tt = o.tt;
    if (tt == null && s.cr) for (let i = 0; i < s.cr.length; i += 2) if (s.cr[i] === o.id) { tt = s.cr[i + 1]; break; }
    return tt != null && s.t > tt + CRUMBLE;
  }
  touch(o, s) {
    if (o.tt != null) return;
    if (s.real) { o.tt = s.t; s.ev.push(['crumble', o]); return; }
    if (s.cr) for (let i = 0; i < s.cr.length; i += 2) if (s.cr[i] === o.id) return;
    s.cr = (s.cr || []).concat(o.id, s.t);
  }
  take(o, s) {
    if (s.real) o.got = true; else s.got = s.got ? s.got.concat(o.id) : [o.id];
    const t = o.t;
    if (t === 'coin') s.n++; else if (t === 'gem') s.n += 5;
    else if (t === 'heart') { if (s.hp < this.maxHp) { s.hp++; s.heal++; } }
    else { s[PWR[t][0]] = PWR[t][1]; s.pw++; }
    s.ev && s.ev.push(['take', o]);
  }
  kill(f, s, how) { if (s.real) f.dead = how; else s.kill = s.kill ? s.kill.concat(f.id) : [f.id]; s.ko++; s.ev && s.ev.push(['kill', f, how]); }
  harm(s) {
    if (s.inv > 0 || s.st > 0) return;
    if (s.sh > 0) { s.sh = 0; s.inv = 0.8; s.ev && s.ev.push(['pop']); return; }
    s.hp--; s.hurt++; s.inv = 1.4; s.vy = -this.ph.hurt; s.vx = -70; s.on = null; s.lad = null; s.j = 1;
    s.ev && s.ev.push(['hurt']);
  }

  // ---------------------------------------------------------------- physics: one step for the hero or a search state
  phys(s, dt, jump, grid = this.grid, agrid = this.agrid, items = true) {
    const P = this.ph, w = P.w, h = P.h, ev = s.ev;
    s.t += dt;
    if (s.wait > 0) { s.wait -= dt; return; }
    s.inv -= dt; s.coy -= dt; s.lc -= dt; s.cool -= dt;
    if (s.sh > 0) s.sh -= dt; if (s.mg > 0) s.mg -= dt; if (s.wg > 0) s.wg -= dt; if (s.sp > 0) s.sp -= dt; if (s.st > 0) s.st -= dt;
    if (jump) {
      if (s.on || s.lad || s.coy > 0) { s.vy = -P.jv; s.j = 1; s.coy = 0; if (s.lad) { s.lad = null; s.lc = 0.3; } s.on = null; s.jc++; ev && ev.push(['jump']); }
      else if (s.j <= (s.wg > 0 ? 3 : 1)) { s.vy = -P.av; s.j++; s.jc++; ev && ev.push(['air']); }
    }
    const os = this.q(s.x - 40, s.x + w + 40, grid, this.qa);
    const pb = s.y + h, pvy = s.vy;
    if (s.lad) {
      const L = s.lad; s.vx = 0; s.vy = 0; s.y -= P.climb * dt;
      if (s.y + h <= L.y) { s.y = L.y - h; s.lad = null; s.lc = 0.3; s.on = L; s.j = 0; ev && ev.push(['top', L]); }
    } else {
      const tv = P.run * (s.sp > 0 ? 1.35 : 1) + ((s.on && s.on.belt) || 0), a = (s.on ? P.acc : P.acc * 0.35) * dt;
      s.vx += Math.max(-a, Math.min(a, tv - s.vx));
      let nx = s.x + s.vx * dt;
      for (const o of os) {
        if (o.k !== 'g' || s.y + h <= o.y + 0.5 || s.y >= o.y + o.h) continue;
        if (s.vx > 0 && s.x + w <= o.x + 0.5 && nx + w > o.x) {
          if (s.on && s.y + h - o.y <= P.step && s.on.k === 'g') { s.y = o.y - h; s.on = o; } else { nx = o.x - w; s.vx = 0; }
        } else if (s.vx < 0 && s.x >= o.x + o.w - 0.5 && nx < o.x + o.w) { nx = o.x + o.w; s.vx = 0; }
      }
      s.x = nx;
      let sup = s.on;
      if (sup) {
        const sx = sup.k === 'm' ? this.mx(sup, s.t) : sup.x;
        if (s.x + w <= sx + 2 || s.x >= sx + sup.w - 2 || (sup.k === 'c' && this.fallen(sup, s))) sup = null;
      }
      if (sup) {
        if (sup.k === 'm') { s.x += this.mx(sup, s.t) - this.mx(sup, s.t - dt); s.y = this.my(sup, s.t) - h; } else s.y = sup.y - h;
        s.vy = 0;
      } else {
        if (s.on) { s.on = null; s.coy = P.coy; if (s.j < 1) s.j = 1; }
        const vy0 = s.vy; s.vy = vy0 + P.g * dt; s.y += (vy0 + s.vy) * 0.5 * dt;
        if (vy0 < 0) for (const o of os) if (o.k === 'g' && s.x + w > o.x + 1 && s.x < o.x + o.w - 1 && s.y < o.y + o.h && pb - h >= o.y + o.h - 1) { s.y = o.y + o.h; s.vy = Math.max(0, s.vy); }
        if (s.vy > 0) {
          let top = 1e9, best = null; const nb = s.y + h;
          for (const o of os) {
            if (!SURF[o.k]) continue;
            let ox = o.x, oy = o.y, oy0 = o.y;
            if (o.k === 'm') { ox = this.mx(o, s.t); oy = this.my(o, s.t); oy0 = this.my(o, s.t - dt); } else if (o.k === 'c' && this.fallen(o, s)) continue;
            if (s.x + w <= ox + 2 || s.x >= ox + o.w - 2) continue;
            if (pb <= oy0 + 1 && nb >= oy && oy < top) { top = oy; best = o; }
          }
          if (best) { s.y = top - h; s.vy = 0; s.on = best; s.j = 0; ev && ev.push(['land', best, pvy]); }
        }
      }
      const cx = s.x + w / 2;
      for (const o of os) if (o.k === 'p' && s.on && cx > o.x - 2 && cx < o.x + o.w + 2 && s.y + h >= o.y - 1 && s.y + h <= o.y + o.h + 3) { s.vy = -o.v; s.on = null; s.j = 1; s.coy = 0; s.bon++; ev && ev.push(['bounce', o]); break; }
      if (s.on && s.on.k === 'c') this.touch(s.on, s);
      if (s.lc <= 0) for (const L of os) if (L.k === 'l' && cx > L.x + 1 && cx < L.x + L.w - 1 && s.y + h > L.y + 6 && s.y + h <= L.y + L.h + 2) {
        s.lad = L; s.on = null; s.x = L.x + L.w / 2 - w / 2; s.vx = 0; s.vy = 0; s.j = 0; ev && ev.push(['grab', L]); break;
      }
    }
    for (const o of os) if (o.k === 's' && s.x + 3 < o.x + o.w - 2 && s.x + w - 3 > o.x + 2 && s.y + h - 2 > o.y + 4 && s.y + 5 < o.y + o.h) this.harm(s);
    // foes: stomp from above, smash with star or speed, otherwise they hurt; the hero's own swing or shot
    const reach = s.gun ? 150 : 64, mr = items && s.mg > 0 ? 110 : 0;
    const as = this.q(s.x - 40 - mr, s.x + w + Math.max(reach, mr) + 20, agrid, this.qb);
    for (const f of as) {
      if (f.k !== 'f' || this.dead(f, s)) continue;
      const fx = this.fx(f, s.t), fy = this.fy(f, s.t);
      if (s.x + w > fx + 2 && s.x < fx + f.w - 2 && s.y + h > fy + 2 && s.y < fy + f.h) {
        if (pvy > 0 && pb <= fy + 8 && !s.lad) { this.kill(f, s, 'stomp'); s.vy = -P.stomp; s.on = null; s.j = 1; }
        else if (s.st > 0 || s.sp > 0) this.kill(f, s, 'smash');
        else this.harm(s);
      }
    }
    if (s.sw > 0) {
      s.sw -= dt;
      if (s.sw <= 0) for (const f of as) if (f.k === 'f' && !this.dead(f, s)) {
        const g = this.fx(f, s.t) - (s.x + w);
        if (g > -16 && g < reach + 10 && Math.abs(this.fy(f, s.t) + f.h - (s.y + h)) < 18) this.kill(f, s, 'hit');
      }
    } else if (s.on && s.cool <= 0) for (const f of as) if (f.k === 'f' && !this.dead(f, s)) {
      const g = this.fx(f, s.t) - (s.x + w);
      if (g > -6 && g < reach && Math.abs(this.fy(f, s.t) + f.h - (s.y + h)) < 16) { s.sw = s.gun ? 0.07 : 0.16; s.cool = 0.6; ev && ev.push(['swing', f]); break; }
    }
    if (items) {
      const cx = s.x + w / 2, cy = s.y + h / 2;
      for (const it of as) {
        if (it.k !== 'i' || this.has(it, s)) continue;
        const dx = Math.abs(it.x - cx), dy = Math.abs(it.y - cy);
        if ((dx < w / 2 + 9 && dy < h / 2 + 9) || (mr && it.t === 'coin' && dx * dx + dy * dy < mr * mr)) this.take(it, s);
      }
    }
    if (s.y > SAVE && s.vy > 0 && s.sh > 0) { s.sh = 0; s.vy = -P.spring; s.j = 1; s.inv = 0.6; ev && ev.push(['save']); }
    if (s.y > KILL) s.fell = true;
  }
  // ---------------------------------------------------------------- search over jump timings: segment checks and the autopilot
  key(s) { return ((Math.round(s.x / 3) * 512 + Math.max(0, Math.min(511, Math.round(s.y / 3) + 300))) * 64 + Math.max(0, Math.min(63, Math.round(s.vy / 50) + 30))) * 32 + s.j * 4 + (s.on ? 2 : 0) + (s.lad ? 1 : 0); }
  value(s) { return s.x + s.n * 40 + s.pw * 400 + s.heal * 300 + s.ko * 30 + s.bon * 20 - s.hurt * 3000 - s.jc * 6; }
  *search(s0, o) {
    let fr = [{ s: s0, a: 0, up: null, v: 0 }], work = 0;
    for (let L = 0; L < o.layers; L++) {
      const nx = new Map();
      for (const nd of fr) for (let a = 0; a < 2; a++) {
        if (a && !this.canJump(nd.s)) continue;
        const s = { ...nd.s };
        for (let k = 0; k < DEC && !s.fell; k++) this.phys(s, SDT, a === 1 && k === 0, o.grid, o.agrid, o.items);
        work++;
        if (s.fell || (o.goal && s.hurt)) continue;
        if (o.goal && o.goal(s)) return { s, a, up: nd };
        const v = o.goal ? s.x - s.j * 6 + (s.on ? 20 : 0) : this.value(s), key = this.key(s), e = nx.get(key);
        if (!e || e.v < v) nx.set(key, { s, a, up: nd, v });
      }
      if (!nx.size) return o.goal ? null : fr;
      fr = [...nx.values()];
      if (fr.length > o.beam) { fr.sort((p, q) => q.v - p.v); fr.length = o.beam; }
      if (o.slice && work > o.slice) { work = 0; yield; }
    }
    return o.goal ? null : fr;
  }
  // how safe a planned end state looks: grounded, or over something to land on with a jump to spare
  leaf(s) {
    if (s.on || s.lad) return 30;
    const P = this.ph, spare = s.j <= (s.wg > 0 ? 3 : 1);
    for (const o of this.q(s.x - 8, s.x + P.w + P.run * 0.8, this.grid, this.qa)) if (SURF[o.k] && o.y + (o.ay || 0) > s.y + P.h - 2 && o.y < FMAX + 60) return spare ? 10 : 0;
    return spare ? -200 : -700;
  }
  think() {
    const it = this.search({ ...this.p, real: false, ev: null }, { layers: 45, beam: 44, items: true, grid: this.grid, agrid: this.agrid });
    let r; do r = it.next(); while (!r.done);
    let best = null, bv = -Infinity;
    for (const nd of r.value || []) { const v = nd.v + this.leaf(nd.s); if (v > bv) { bv = v; best = nd; } }
    const plan = [];
    for (let n = best; n && n.up; n = n.up) plan.push([n.a, n.s.x, n.s.y]);
    this.plan = plan.reverse(); this.pk = 0;
  }
  autopilot() {
    const p = this.p;
    if (this.dead > 0 || p.wait > 0) { this.plan = null; return; }
    if (this.tick % TICKS) return;
    const pl = this.plan, last = pl && pl[this.pk - 1];
    if (!pl || this.pk >= Math.min(pl.length, 6) || (last && (Math.abs(last[1] - p.x) > 3 || Math.abs(last[2] - p.y) > 3))) this.think();
    this.want = !!this.plan[this.pk++]?.[0];
  }
  down() { this.want = true; }

  // ---------------------------------------------------------------- level generation
  mk(x0, y0, area, d) { return { x0, y0, area, d, solids: [], foes: [], items: [], deco: [], dyn: false, entry: null, x1: x0, y1: y0, clr: 0 }; }
  add(B, o) { o.id = this.oid++; o.a = B.area; B.solids.push(o); return o; }
  gnd(B, x, w, y, ex) { const o = this.add(B, { k: 'g', x, y, w, h: DEEP, ...ex }); if (!B.entry) B.entry = o; return o; }
  blk(B, x, y, w, h, st = 'crate') { return this.add(B, { k: 'g', x, y, w, h, st }); }
  one(B, x, y, w) { return this.add(B, { k: 'o', x, y, w, h: 10 }); }
  crum(B, x, y, w) { return this.add(B, { k: 'c', x, y, w, h: 14, tt: null }); }
  mover(B, x, y, w, ax, ay, per) { B.dyn = true; return this.add(B, { k: 'm', x, y, w, h: 12, ax, ay, f: TAU / per, ph: this.R(0, TAU) }); }
  pad(B, x, fy, spring) { return this.add(B, spring ? { k: 'p', x, y: fy - 14, w: 22, h: 14, v: this.ph.spring, spring: true } : { k: 'p', x, y: fy - 9, w: 30, h: 9, v: this.ph.pad }); }
  lad(B, x, top, bot) { return this.add(B, { k: 'l', x, y: top, w: 18, h: bot - top }); }
  spikes(B, x, fy, w) { return this.add(B, { k: 's', x, y: fy - 12, w, h: 12 }); }
  ceil(B, x, w, fy) { if (B.clr) this.blk(B, x, fy - B.clr - 700, w, 700, 'ceil'); }
  out(B, x, y) { this.gnd(B, x, 64, y); this.ceil(B, x, 64, y); B.x1 = x + 64; B.y1 = y; }
  clampY(y) { return Math.max(FMIN, Math.min(FMAX, y)); }
  foe(B, x, fy, span, kind = 'walk') {
    const z = this.S ** 0.5, fw = Math.round(22 * z), fh = Math.round(20 * z);
    const f = { k: 'f', id: this.oid++, x, y: fy - fh, w: fw, h: fh, span: Math.max(0, span), f: 0, ph: this.R(0, 2), hop: 0, hf: 0, amp: 0, vf: 0, m: 1 + this.Ri(0, 4), kind };
    if (f.span) f.f = this.R(26, 46) / f.span;
    if (kind === 'hop') { f.hop = this.R(30, 50); f.hf = this.R(2.2, 3.2); }
    if (kind === 'fly') { f.amp = this.R(14, 28); f.vf = this.R(1.6, 2.6); }
    if (this.mods.swarm && kind === 'walk' && this.Rc(0.5)) B.foes.push({ ...f, id: this.oid++, ph: f.ph + 1 });
    B.dyn = true; B.foes.push(f); return f;
  }
  item(B, x, y, t) { const o = { k: 'i', id: this.oid++, x, y, w: 0, t }; B.items.push(o); return o; }
  row(B, x, y, n, dx = 24) { for (let i = 0; i < n; i++) this.item(B, x + i * dx, y, 'coin'); }
  // coins along the path of a jump (or a bounce) taking off with the hero's left side at x, feet at fy
  arc(B, x, fy, n, vy = -this.ph.jv, vx = this.ph.run) {
    const P = this.ph, T = (2 * -vy) / P.g;
    for (let i = 1; i <= n; i++) { const t = (T * i) / (n + 1); this.item(B, x + P.w / 2 + vx * t, fy - P.h / 2 + vy * t + (P.g * t * t) / 2, 'coin'); }
  }
  dec(B, k, x, y, v = 0) { B.deco.push({ k, x, y, v, r: this.lr(), a: B.area }); }
  reward(B, x, y) {
    if (B.pw) { this.item(B, x, y, B.pw); if (B.pw === 'speed') { B.hasFast = true; B.fastX = x + PWR.speed[1] * this.ph.run * 1.4 + 240; } B.pw = null; }
    else if (B.heart) { this.item(B, x, y, 'heart'); B.heart = false; }
    else if (this.Rc(0.5)) this.item(B, x, y, 'gem'); else this.row(B, x - 24, y, 3);
  }
  furnish(B, x, len, y) {
    const P = this.ph, r = this.lr(), m = x + len * this.R(0.4, 0.6), sky = AREAS[B.area].id === 'sky';
    if (this.Rc(0.7)) this.dec(B, 'plant', x + this.R(8, len - 8), y);
    if (len < 100) { if (this.Rc(0.5)) this.row(B, x + 20, y - 22, Math.floor(len / 30)); return; }
    if (r < 0.2) { const bw = this.R(26, 40), bh = this.R(22, 46); this.blk(B, m - bw / 2, y - bh, bw, bh, 'crate'); this.arc(B, m - bw / 2 - 64, y, 4); }
    else if (r < 0.42) this.foe(B, x + 24, y, len - 70, this.Rc(B.d * 0.3) ? 'hop' : 'walk');
    else if (r < 0.52 && B.d > 0.15) { const sw = this.R(22, 40); this.spikes(B, m - sw / 2, y, sw); this.arc(B, m - sw / 2 - 64, y, 4); }
    else if (r < 0.64 && !B.clr && !sky) { this.pad(B, m - 15, y); this.arc(B, m - P.w / 2, y, 6, -P.pad); }
    else this.row(B, x + 22, y - 22, Math.min(6, Math.floor((len - 30) / 26)));
  }
  b_flat(B) { const x = B.x0, y = B.y0; this.gnd(B, x, 260, y); this.ceil(B, x, 260, y); this.row(B, x + 70, y - 22, 5); this.out(B, x + 260, y); }
  b_run(B) {
    const end = B.x0 + this.R(400, 600);
    let x = B.x0, y = B.y0, first = true;
    while (x < end - 80) {
      const len = Math.min(end - x, first ? this.R(110, 170) : this.R(100, 220));
      this.gnd(B, x, len, y); if (!first) this.furnish(B, x, len, y);
      x += len; first = false;
      if (x >= end - 80) break;
      if (B.d > 0.15 && this.Rc(0.3)) { const ny = this.clampY(y + this.R(-30, 40)), g = this.R(0.3, 0.6) * this.cap.D1(ny - y); this.arc(B, x - this.ph.w, y, 4); x += g; y = ny; }
      else y = this.clampY(y + (this.Rc(0.5) ? -this.R(18, 44) : this.R(18, 70)));
    }
    this.out(B, x, y);
  }
  b_gaps(B) {
    const P = this.ph; let x = B.x0, y = B.y0, len = this.R(100, 150);
    this.gnd(B, x, len, y); x += len;
    for (let n = this.Ri(1, 3), i = 0; i < n; i++) {
      const ny = this.clampY(y + this.R(-48, 64)), dy = ny - y;
      let g = this.R(0.32, 0.55 + 0.3 * B.d) * (this.cap.D2(dy) + P.w - 10);
      if (g > this.cap.D1(dy) * 0.9 && this.Rc(0.5)) {
        const sw = this.R(36, 60), sy = Math.min(y, ny) - this.R(0, 46);
        g = Math.min(g * 1.4, this.cap.D2(dy) * 1.5);
        const sx = x + g / 2 - sw / 2;
        if (this.Rc(0.5)) this.one(B, sx, sy, sw); else this.blk(B, sx, sy, sw, 20, 'stone');
        this.row(B, sx + sw / 2 - 12, sy - 22, 2);
      } else this.arc(B, x - P.w, y, 5);
      if (B.d > 0.4 && this.Rc(0.3)) this.foe(B, x + g / 2 - 11, Math.min(y, ny) - 50, 0, 'fly');
      x += g; y = ny; len = this.R(80, 190);
      this.gnd(B, x, len, y); if (len > 110) this.furnish(B, x, len, y);
      x += len;
    }
    this.out(B, x, y);
  }
  b_stairs(B) {
    const P = this.ph; let x = B.x0, y = B.y0, len = this.R(80, 120);
    this.gnd(B, x, len, y); x += len;
    for (let i = 0, n = this.Ri(2, 4); i < n; i++) { y -= this.R(26, Math.min(56, this.cap.J1 * 0.55)); len = this.R(56, 100); this.gnd(B, x, len, y, { st: 'step' }); if (i === n - 1) this.row(B, x + 12, y - 22, 3); x += len; }
    len = this.R(100, 160); this.gnd(B, x, len, y, { st: 'step' });
    if (len > 130 && this.Rc(0.5)) this.foe(B, x + 24, y, len - 70); else this.reward(B, x + len / 2, y - 50);
    x += len;
    const ty = this.clampY(B.y0 + this.R(-30, 40));
    if (this.Rc(0.5)) for (let i = 0, n = this.Ri(1, 3); i < n; i++) { y += (ty - y) / (n - i); len = this.R(50, 90); this.gnd(B, x, len, y, { st: 'step' }); x += len; }
    else { if (this.Rc(0.4)) { const g = this.R(30, 0.6 * this.cap.D1(ty - y)); this.arc(B, x - P.w, y, 4); x += g; } y = ty; }
    len = this.R(70, 120); this.gnd(B, x, len, y); x += len;
    this.out(B, x, y);
  }
  b_upper(B) {
    const P = this.ph, y = B.y0, x0 = B.x0, len = this.R(560, 760);
    if (B.d > 0.3 && this.Rc(0.5)) { const a = this.R(220, 340), g = this.R(40, 0.55 * this.cap.D1()); this.gnd(B, x0, a, y); this.gnd(B, x0 + a + g, len - a - g, y); }
    else this.gnd(B, x0, len, y);
    const uy = y - this.R(78, 90), ux0 = x0 + this.R(120, 180), ux1 = x0 + len - this.R(100, 150), acc = this.Ri(0, 2);
    if (acc === 0) this.lad(B, ux0 - 18, uy, y); else if (acc === 1) this.pad(B, ux0 - this.R(46, 70), y);
    for (let ux = ux0; ux < ux1 - 40;) { const pw = Math.min(ux1 - ux, this.R(90, 170)); this.one(B, ux, uy, pw); this.row(B, ux + 16, uy - 22, Math.floor((pw - 20) / 26)); ux += pw + this.R(24, 48); }
    if (B.d > 0.2 && this.Rc(0.55)) {
      const ty = uy - this.R(80, 90), tx0 = ux0 + this.R(90, 150), tx1 = Math.min(ux1 - 40, tx0 + this.R(140, 220));
      if (tx1 - tx0 > 80) { this.one(B, tx0, ty, tx1 - tx0); this.reward(B, (tx0 + tx1) / 2, ty - 26); if (this.Rc(0.5)) this.lad(B, tx0 - 18, ty, uy); }
    } else if (B.pw || B.heart) this.reward(B, (ux0 + ux1) / 2, uy - 30);
    if (this.Rc(0.7)) this.foe(B, x0 + len * 0.42, y, len * 0.3);
    if (B.d > 0.35 && this.Rc(0.4)) this.spikes(B, x0 + len * this.R(0.62, 0.74), y, this.R(24, 40));
    this.dec(B, 'plant', x0 + this.R(30, len - 30), y);
    this.out(B, x0 + len, y);
  }
  b_tower(B) {
    const P = this.ph, y = B.y0; let x = B.x0, len = this.R(90, 140);
    this.gnd(B, x, len, y); x += len;
    const th = this.R(this.cap.J2 + 10, this.cap.J2 + 70), tw = this.R(110, 220), top = y - th;
    this.gnd(B, x, tw, top, { st: 'tower' }); this.lad(B, x - 18, top, y);
    this.row(B, x + 16, top - 22, Math.floor((tw - 40) / 26));
    if (tw > 160 && this.Rc(0.45)) this.foe(B, x + 30, top, tw - 80); else this.reward(B, x + tw / 2, top - 48);
    this.dec(B, 'banner', x + tw - 26, top);
    x += tw;
    const ny = this.clampY(y + this.R(-30, 50));
    if (this.Rc(0.45)) { const g = this.R(60, this.cap.D1(ny - top) * 0.8); this.arc(B, x - P.w, top, 5); x += g; }
    else for (let i = 1; i <= 4; i++) this.item(B, x + 4 + i * 18, top - 4 + i * i * 10, 'coin');
    len = this.R(130, 200); this.gnd(B, x, len, ny); x += len;
    this.out(B, x, ny);
  }
  b_cave(B) {
    const P = this.ph; let x = B.x0, y = B.y0, len = this.R(90, 140);
    B.clr = P.h + this.R(62, 96);
    this.gnd(B, x, len, y); this.ceil(B, x, len, y); x += len;
    const end = B.x0 + this.R(460, 640);
    while (x < end - 60) {
      const r = this.lr();
      if (r < 0.3) { const ny = this.clampY(y + this.R(-20, 30)), g = this.R(30, 0.5 * this.cap.D1(ny - y)); this.ceil(B, x, g, Math.min(y, ny)); this.row(B, x + g / 2 - 12, Math.min(y, ny) - 30, 2); x += g; y = ny; }
      else if (r < 0.42 && B.d > 0.25) { const n = this.Ri(3, 5); for (let i = 0; i < n; i++) this.crum(B, x + i * 32, y, 32); this.ceil(B, x, n * 32, y); x += n * 32; }
      len = this.R(90, 200); this.gnd(B, x, len, y); this.ceil(B, x, len, y);
      const q = this.lr();
      if (q < 0.3) this.foe(B, x + 20, y, len - 60);
      else if (q < 0.45 && B.d > 0.2) { const sw = this.R(20, 34); this.spikes(B, x + len / 2 - sw / 2, y, sw); }
      else if (q < 0.6) { const bh = this.R(16, 26); this.blk(B, x + len / 2 - 15, y - bh, 30, bh, 'rock'); }
      this.row(B, x + 20, y - 24 - this.R(0, 18), Math.floor((len - 40) / 28));
      this.dec(B, this.Rc(0.5) ? 'torch' : 'crystal', x + this.R(10, len - 10), y);
      x += len;
    }
    this.out(B, x, y);
  }
  b_bounce(B) {
    const P = this.ph, y = B.y0; let x = B.x0, len = this.R(100, 150);
    this.gnd(B, x, len, y); x += len;
    const v = this.Ri(0, 2);
    if (v === 0) { // a wall too tall to jump, with a pad in front of it
      const run = this.R(50, 80), wx = x + run + 30 + this.R(36, 70), wh = this.R(this.cap.J2 + 10, 190), ww = this.R(100, 170);
      this.gnd(B, x, wx - x, y); this.pad(B, x + run, y); this.arc(B, x + run + 15 - P.w / 2, y, 5, -P.pad);
      this.gnd(B, wx, ww, y - wh, { st: 'tower' }); this.row(B, wx + 14, y - wh - 22, Math.floor((ww - 30) / 26)); this.reward(B, wx + ww / 2, y - wh - 50);
      x = wx + ww;
      const ny = this.clampY(y + this.R(-20, 40)); len = this.R(130, 200); this.gnd(B, x, len, ny); x += len; return this.out(B, x, ny);
    }
    if (v === 1) { // a pit too wide to jump, with a spring at its edge
      const run = this.R(40, 70); this.gnd(B, x, run + 40, y); this.pad(B, x + run, y, true); this.arc(B, x + run + 11 - P.w / 2, y, 7, -P.spring); x += run + 40;
      const ny = this.clampY(y + this.R(-40, 30)), D = this.cap.D2(ny - y), g = this.R(D * 0.95, D * 1.3);
      x += g; len = this.R(150, 220); this.gnd(B, x, len, ny); x += len; return this.out(B, x, ny);
    }
    for (let i = 0, n = this.Ri(2, 3); i < n; i++) { const l = this.R(120, 170); this.gnd(B, x, l, y); this.pad(B, x + l * 0.4, y); this.arc(B, x + l * 0.4 + 15 - P.w / 2, y, 5, -P.pad); x += l; }
    const hx = x - this.R(150, 230), hy = y - this.R(150, 190); this.one(B, hx, hy, this.R(110, 160)); this.reward(B, hx + 50, hy - 26);
    len = this.R(110, 160); this.gnd(B, x, len, y); x += len; this.out(B, x, y);
  }
  b_crumble(B) {
    const P = this.ph, y = B.y0; let x = B.x0, len = this.R(100, 150);
    this.gnd(B, x, len, y); x += len;
    if (this.Rc(0.6)) { const n = this.Ri(5, 9); for (let i = 0; i < n; i++) this.crum(B, x + i * 32, y, 32); this.row(B, x + 8, y - 22, Math.floor((n * 32) / 26)); x += n * 32; }
    else {
      for (let i = 0, n = this.Ri(2, 3); i < n; i++) { x += this.R(40, 0.5 * this.cap.D1()); const sy = y - this.R(0, 50), sw = this.R(40, 64); this.crum(B, x, sy, sw); this.item(B, x + sw / 2, sy - 24, 'coin'); x += sw; }
      x += this.R(40, 0.5 * this.cap.D1());
    }
    len = this.R(110, 180); this.gnd(B, x, len, y); x += len; this.out(B, x, y);
  }
  b_belts(B) {
    const P = this.ph; let x = B.x0, y = B.y0, len = this.R(90, 130);
    this.gnd(B, x, len, y); x += len;
    for (let i = 0, n = this.Ri(2, 3); i < n; i++) {
      const belt = (this.Rc(0.6) ? 1 : -1) * this.R(50, 80), bl = this.R(100, 190), v = P.run + belt;
      this.gnd(B, x, bl, y, { belt, st: 'belt' }); this.row(B, x + 16, y - 22, Math.floor((bl - 30) / 26)); x += bl;
      const r = this.lr();
      if (r < 0.45) { const ny = this.clampY(y + this.R(-30, 40)), g = this.R(0.35, 0.7) * this.cap.D2(ny - y, v); this.arc(B, x - P.w, y, 5, -P.jv, v); x += g; y = ny; }
      else if (r < 0.7 && B.d > 0.2) { len = this.R(110, 150); this.gnd(B, x, len, y); this.spikes(B, x + len * 0.45, y, this.R(22, 36)); this.dec(B, 'gear', x + len * 0.2, y); x += len; }
      else { const g = this.R(this.cap.D2() * 0.8, this.cap.D2() * 1.25), mw = this.R(50, 70); this.mover(B, x + g / 2 - mw / 2, y - this.R(0, 30), mw, this.R(20, 40), 0, this.R(1.8, 2.6)); x += g; }
    }
    len = this.R(100, 150); this.gnd(B, x, len, y); this.dec(B, 'pipe', x + len / 2, y); x += len; this.out(B, x, y);
  }
  b_movers(B) {
    const y = B.y0; let x = B.x0, len = this.R(110, 160);
    this.gnd(B, x, len, y); x += len;
    const ny = this.clampY(y + this.R(-30, 30));
    for (let i = 0, n = this.Ri(1, 2); i < n; i++) {
      const vert = this.Rc(0.4), mw = this.R(52, 76), g = this.R(70, 110), my = Math.min(y, ny) - this.R(0, 30);
      this.mover(B, x + g, my, mw, vert ? 0 : this.R(24, 46), vert ? this.R(24, 44) : 0, this.R(1.6, 2.6));
      this.item(B, x + g + mw / 2, my - 26, 'coin'); x += g + mw;
    }
    x += this.R(60, 100); len = this.R(120, 180); this.gnd(B, x, len, ny); x += len; this.out(B, x, ny);
  }
  b_sky(B) {
    const P = this.ph; let x = B.x0, y = B.y0, len = this.R(90, 130);
    this.gnd(B, x, len, y); x += len;
    for (let i = 0, n = this.Ri(2, 4); i < n; i++) {
      const ny = this.clampY(y + this.R(-60, 60)), g = this.R(0.35, 0.6 + 0.25 * B.d) * this.cap.D2(ny - y);
      if (this.Rc(0.4)) { const cw = this.R(50, 80); this.one(B, x + g * 0.5 - cw / 2, Math.min(y, ny) - this.R(20, 70), cw); } else this.arc(B, x - P.w, y, 5);
      x += g; y = ny; len = this.R(90, 180); this.gnd(B, x, len, y);
      if (len > 120 && this.Rc(0.5)) { this.pad(B, x + len * 0.45, y, true); const hy = y - this.R(220, 260), hx = x + len * 0.45 + 50; this.one(B, hx, hy, 110); this.reward(B, hx + 55, hy - 26); this.row(B, hx + 10, hy - 22, 2); }
      else if (this.Rc(0.35)) this.foe(B, x + 20, y, len - 60, this.Rc(0.5) ? 'hop' : 'walk');
      x += len;
    }
    this.out(B, x, y);
  }
  merge(B) {
    const gs = B.solids.filter((o) => o.k === 'g' && o.h === DEEP && !o.belt).sort((a, b) => a.x - b.x);
    for (let i = 1; i < gs.length; i++) { const a = gs[i - 1], b = gs[i]; if (Math.abs(a.x + a.w - b.x) < 0.5 && a.y === b.y && a.st === b.st) { a.w += b.w; b.gone = 1; gs[i] = a; } }
    B.solids = B.solids.filter((o) => !o.gone);
  }
  pickPw() { return this.Rw({ shield: 1, magnet: 1.2, wings: 1, speed: 0.8, star: 0.7 }); }
  *makeSeg() {
    const i = ++this.segN, d = Math.min(1, Math.max(0, (i - 2) / 22));
    let flag = false;
    if (--this.areaLeft < 0) { let a; do a = this.Ri(0, AREAS.length - 1); while (a === this.areaI); this.areaI = a; this.areaLeft = this.Ri(2, 4); flag = true; }
    const area = AREAS[this.areaI], pw = --this.pwIn <= 0 ? this.pickPw() : null, heart = --this.heartIn <= 0;
    if (pw) this.pwIn = this.Ri(3, 4); if (heart) this.heartIn = this.Ri(6, 9);
    for (let tries = 0; ; tries++) {
      const kind = tries > 5 ? 'flat' : i < 3 ? this.Rw({ run: 2, gaps: 1, upper: 1 }) : this.Rw(area.kinds);
      const B = this.mk(this.genX, this.genY, this.areaI, tries > 5 ? 0 : d * (1 - tries * 0.15));
      if (area.ceil) B.clr = this.ph.h + this.R(70, 100);
      B.pw = pw; B.heart = heart; B.flag = flag; B.kind = kind;
      if (flag) this.dec(B, 'flag', B.x0 + 34, B.y0);
      this['b_' + kind](B);
      if (B.pw || B.heart) this.reward(B, B.x1 - 34, B.y1 - 30);
      this.merge(B);
      B.fast = B.x0 < this.fastTill || !!B.hasFast;
      if (kind === 'flat' || (yield* this.check(B))) { B.tries = tries; return B; }
    }
  }
  // can the hero get from the segment's entry to its exit? (from a run, a respawn, at other phases, with speed)
  *check(B) {
    const P = this.ph, grid = new Map(), agrid = new Map();
    for (const o of B.solids) this.put(grid, o);
    for (const f of B.foes) this.put(agrid, f);
    this.put(grid, { k: 'g', id: -1, x: B.x1 - 1, y: B.y1, w: 300, h: DEEP });
    const goal = (s) => !!s.on && s.x > B.x1 + 4 && Math.abs(s.y + P.h - B.y1) < 0.5;
    const layers = Math.ceil(((B.x1 - B.x0) / P.run * 1.7 + 3) / (SDT * DEC));
    const tests = [[P.run, 0], [0, 0]];
    if (B.dyn) tests.push([P.run, 0], [P.run * 0.6, 0]);
    if (B.fast) tests.push([P.run * 1.35, 1]);
    for (const [vx, fast] of tests) {
      const s = this.fresh(B.x0 + 2, B.y0 - P.h);
      s.on = B.entry; s.t = this.R(0, 40); s.vx = vx; s.wait = vx ? 0 : 0.6; if (fast) s.sp = 1e9;
      if (!(yield* this.search(s, { layers, beam: 40, grid, agrid, items: false, goal, slice: 400 }))) return false;
    }
    return true;
  }
  commit(B) {
    for (const o of B.solids) this.put(this.grid, o);
    for (const f of B.foes) this.put(this.agrid, f);
    for (const it of B.items) this.put(this.agrid, it);
    for (const d of B.deco) this.deco.push(d);
    this.segs.push(B); this.genX = B.x1; this.genY = B.y1;
    if (B.hasFast) this.fastTill = B.fastX;
  }
  // build ahead of the camera a few milliseconds per frame; all at once if the hero gets close
  pump(ms) {
    const t0 = performance.now();
    while (this.genX < this.camX + W * 2.4) {
      this.job ||= this.makeSeg();
      let r; do r = this.job.next(); while (!r.done && performance.now() - t0 < ms);
      if (!r.done) return;
      this.commit(r.value); this.job = null;
      if (performance.now() - t0 >= ms) return;
    }
  }
//@@STEP
}
