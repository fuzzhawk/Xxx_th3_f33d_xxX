import { Game, W, H, roundRect, drawFit, ready, rgbOf } from './engine.js';
import { Actor, ERAS, drawFrame } from '../crystal/sprites.js';
import { mulberry32 } from '../util.js';
import { art, Backdrop, tAt, sstep } from './platformer-look.js';

// ================================================================ Platformer
// One tap jumps, a second tap in the air double-jumps; the hero runs on its own. The level is built
// segment by segment from themed areas (meadow, caverns, ruins, works, skyway): floors with steps and
// pits, platform towers with ladders, decks over decks, caves under low ceilings, bounce pads and
// springs, conveyors, moving and crumbling platforms, one-way ledges, spikes and foes. Every segment is
// checked against the hero's own physics (the same step function, searched over jump timings from the
// segment's entry at several moving-platform phases, after a respawn and with the speed power-up) and is
// rebuilt or simplified until it can be beaten. The autopilot plans with that same search over the next
// second and a half, so it runs for coins, power-ups and stomps and rarely dies.
// The look (platformer-look.js, platformer-sand.js): a city ending. Greebleworks facades and decks on every
// building the hero runs over, a parallax of greebleworks skies and far cities behind, and between them a
// city of falling sand that flaming spore asteroids blow apart while fungus, flowers and flesh take it over;
// the further the run, the further gone (murky sodium city, burning city, bloom). Gritty: grain, a vignette,
// lights that stutter, figures on the rooftops.
// The hero is a Crystal Sprite: walk into a run, crouch-jump-apex-fall-land, attack or shoot foes in reach,
// climb ladders (back view), flinch, knockdown, kneel after a fall; cheers and surprise play only in the
// air or while standing for a respawn, so emotes never touch the motion.
const TAU = Math.PI * 2;
const SDT = 1 / 60, DEC = 3, TICKS = 6; // search step, search steps per decision, game ticks per decision
const BK = 96, DEEP = 1400, KILL = 560, SAVE = 430, CRUMBLE = 0.45, FMIN = 230, FMAX = 350;
// power-ups: state key, seconds, colour, label
const PWR = { shield: ['sh', 14, '#7fe3ff', 'SHIELD'], magnet: ['mg', 9, '#ff6b7a', 'MAGNET'], wings: ['wg', 9, '#fff3c4', 'WINGS'], speed: ['sp', 6, '#ffc23a', 'SPEED'], star: ['st', 7, '#ffe45e', 'STAR'] };
const AREAS = [
  { id: 'meadow', name: 'SPRAWL', late: 'BLOOM', kinds: { run: 3, gaps: 3, stairs: 2, upper: 3, bounce: 2, tower: 1.5, crumble: 0.6 } },
  { id: 'cave', name: 'UNDERPASS', late: 'ROOT TUNNELS', kinds: { cave: 1 }, ceil: true },
  { id: 'ruins', name: 'RUINS', late: 'OVERGROWTH', kinds: { tower: 3, crumble: 2, stairs: 2, upper: 2, gaps: 1.5 } },
  { id: 'works', name: 'FOUNDRY', late: 'HIVE WORKS', kinds: { belts: 3, movers: 2, crumble: 1, upper: 1 } },
  { id: 'sky', name: 'SKYWAY', late: 'SPORE CANOPY', kinds: { sky: 3, bounce: 2, movers: 1.5, gaps: 1 } }
];
const SURF = { g: 1, o: 1, l: 1, p: 1, c: 1, m: 1 }, NONE = [];
const hash = (x) => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
// the faces and decks each area is built from (keys into platformer-look.js's bakes), and the growth's colours
const LOOK = { meadow: { face: 'street', deck: 'street' }, cave: { face: 'under', deck: 'under' }, ruins: { face: 'ruin', deck: 'ruin' }, works: { face: 'works', deck: 'works' }, sky: { face: 'sky', deck: 'sky' } };
const CORE = [[170, 255, 90], [255, 80, 220], [90, 255, 240]], PET = [[255, 70, 180], [70, 140, 255], [255, 200, 40], [170, 255, 60], [255, 110, 60], [200, 90, 255]];
const rgbS = (c) => `rgb(${c[0]},${c[1]},${c[2]})`, h1s = (x) => { const v = Math.sin(x * 78.233) * 43758.5453; return v - Math.floor(v); };
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
    this.camX = 0; this.camY = 0; this.dead = 0; this.tick = 0; this.want = false; this.buf = 0; this.plan = null; this.fx = []; this.pops = []; this.trail = []; this.shots = []; this.flying = []; this.shake = 0; this.fallen = false; this.pitDeath = false; this.surpriseQ = 0;
    this.coins = 0; this.kills = 0; this.maxX = 0; this.cheerQ = 0; this.banner = { s: AREAS[0].name, t: 2.2 };
    const B = this.mk(this.genX, this.genY, 0, 0);
    this.gnd(B, B.x0, 560, B.y0);
    for (let i = 0; i < 4; i++) this.item(B, 200 + i * 26, B.y0 - 22, 'coin');
    B.x1 = B.x0 + 560; B.y1 = B.y0; this.commit(B);
    while (this.genX < W * 2.2) { const j = this.makeSeg(); let r; do r = j.next(); while (!r.done); this.commit(r.value); }
    const P = this.ph, p = this.p = this.fresh(60, B.y0 - P.h);
    p.on = B.entry; p.real = true; p.ev = []; p.wait = first ? 0.9 : 0.7; p.t = this.t;
    this.hero.revive();
    this.bd?.reset();
    if (first) this.hero.emote('wave', 0.8);
  }
  canJump(s) { return s.wait <= 0 && (!!s.on || !!s.lad || s.coy > 0 || s.j <= (s.wg > 0 ? 3 : 1)); }

  // ---------------------------------------------------------------- world queries
  // each bucket lists everything a hero centred in it can touch (actors reach further: magnet, shots)
  put(grid, o, act) {
    let x0 = o.x - (act ? 190 : 60), x1 = o.x + o.w + (act ? 170 : 60);
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
  foeX(f, t) { if (!f.span) return f.x; const u = (t * f.f + f.ph) % 2; return f.x + f.span * (u < 1 ? u : 2 - u); }
  foeY(f, t) { return f.y - f.hop * Math.abs(Math.sin(t * f.hf + f.ph)) + f.amp * Math.sin(t * f.vf + f.ph); }
  has(o, s) { return o.got || (s.got !== null && s.got.includes(o.id)); }
  isDead(f, s) { return !!f.dead || (s.kill !== null && s.kill.includes(f.id)); }
  crumbled(o, s) {
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
    const os = grid.get(Math.floor((s.x + w / 2) / BK)) || NONE;
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
        if (s.x + w <= sx + 2 || s.x >= sx + sup.w - 2 || (sup.k === 'c' && this.crumbled(sup, s))) sup = null;
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
            if (o.k === 'm') { ox = this.mx(o, s.t); oy = this.my(o, s.t); oy0 = this.my(o, s.t - dt); } else if (o.k === 'c' && this.crumbled(o, s)) continue;
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
    const as = agrid.get(Math.floor((s.x + w / 2) / BK)) || NONE;
    for (const f of as) {
      if (f.k !== 'f' || this.isDead(f, s)) continue;
      const fx = this.foeX(f, s.t), fy = this.foeY(f, s.t);
      if (s.x + w > fx + 2 && s.x < fx + f.w - 2 && s.y + h > fy + 2 && s.y < fy + f.h) {
        if (pvy > 0 && pb <= fy + 8 && !s.lad) { this.kill(f, s, 'stomp'); s.vy = -P.stomp; s.on = null; s.j = 1; }
        else if (s.st > 0 || s.sp > 0) this.kill(f, s, 'smash');
        else this.harm(s);
      }
    }
    if (s.sw > 0) {
      s.sw -= dt;
      if (s.sw <= 0) for (const f of as) if (f.k === 'f' && !this.isDead(f, s)) {
        const g = this.foeX(f, s.t) - (s.x + w);
        if (g > -16 && g < reach + 10 && Math.abs(this.foeY(f, s.t) + f.h - (s.y + h)) < 18) this.kill(f, s, 'hit');
      }
    } else if (s.on && s.cool <= 0) for (const f of as) if (f.k === 'f' && !this.isDead(f, s)) {
      const g = this.foeX(f, s.t) - (s.x + w);
      if (g > -6 && g < reach && Math.abs(this.foeY(f, s.t) + f.h - (s.y + h)) < 16) { s.sw = s.gun ? 0.07 : 0.16; s.cool = 0.6; ev && ev.push(['swing', f]); break; }
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
    let fr = [{ s: s0, a: 0, up: null, v: 0 }], work = 0, far = s0.x, still = 0;
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
      if (o.goal) { let m = -1e9; for (const n of fr) m = Math.max(m, n.s.x); if (m > far + 1) { far = m; still = 0; } else if (++still > 40) return null; }
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
    const it = this.search({ ...this.p, real: false, ev: null }, { layers: 26, beam: 24, items: true, grid: this.grid, agrid: this.agrid });
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
    if (!pl || this.pk >= Math.min(pl.length, 5) || (last && (Math.abs(last[1] - p.x) > 3 || Math.abs(last[2] - p.y) > 3))) this.think();
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
    for (const f of B.foes) this.put(agrid, f, 1);
    this.put(grid, { k: 'g', id: -1, x: B.x1 - 1, y: B.y1, w: 300, h: DEEP });
    const goal = (s) => !!s.on && s.x > B.x1 + 4 && Math.abs(s.y + P.h - B.y1) < 0.5;
    const layers = Math.ceil(((B.x1 - B.x0) / P.run * 1.7 + 3) / (SDT * DEC));
    const tests = [[P.run, 0], [0, 0]];
    if (B.dyn) tests.push([P.run, 0], [P.run * 0.6, 0]);
    if (B.fast) tests.push([P.run * 1.35, 1]);
    for (const [vx, fast] of tests) {
      const s = this.fresh(B.x0 + 2, B.y0 - P.h);
      s.on = B.entry; s.t = this.R(0, 40); s.vx = vx; s.wait = vx ? 0 : 0.6; if (fast) s.sp = 1e9;
      if (!(yield* this.search(s, { layers, beam: 28, grid, agrid, items: false, goal, slice: 300 }))) return false;
    }
    return true;
  }
  commit(B) {
    for (const o of B.solids) this.put(this.grid, o);
    for (const f of B.foes) this.put(this.agrid, f, 1);
    for (const it of B.items) this.put(this.agrid, it, 1);
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
  // ---------------------------------------------------------------- play
  step(dt) {
    const p = this.p, hero = this.hero, P = this.ph;
    this.tick++;
    p.gun = /pistol|rifle/.test(hero.sheet.char?.weapon || '');
    const climb = !!p.lad;
    hero.update(dt, { vx: this.dead > 0 || p.wait > 0 || climb ? 0 : p.vx, vy: climb ? -60 : 0, grounded: !!p.on || climb || p.wait > 0 || this.dead > 0, airVy: p.vy, lowHealth: p.wait > 0.45 && this.fallen });
    this.fxStep(dt);
    if (this.dead > 0) { this.dead -= dt; p.t += dt; if (this.dead <= 0) this.reset(); return; }
    if (p.wait > 0.45 && p.wait - dt <= 0.45 && this.fallen) hero.emote('shake', 0.35);
    let jump = this.want; this.want = false;
    if (this.buf > 0) { this.buf -= dt; if (this.canJump(p)) { jump = true; this.buf = 0; } }
    if (jump && !this.canJump(p)) { this.buf = 0.14; jump = false; }
    p.ev.length = 0;
    this.phys(p, dt, jump);
    for (const e of p.ev) this.event(e);
    if (p.fell) return this.pit();
    if (p.hp <= 0) return this.die();
    this.coins = p.n; this.kills = p.ko; this.maxX = Math.max(this.maxX, p.x);
    this.score = Math.floor(this.maxX / 10) + this.coins * 10 + this.kills * 25;
    for (const d of this.deco) if (d.k === 'flag' && !d.up && p.x + P.w > d.x) { d.up = this.t; this.cheerQ = 1; this.banner = { s: this.areaName(d.a, d.x), t: 2.2 }; this.puff(d.x, d.y - 64, '#ffffff', 12, 120); }
    // emotes only in the air with time to spare, so they never touch the run
    const act = hero.a.action;
    if (!p.on && !p.lad && p.vy < -300 && !act) {
      if (this.cheerQ) { hero.emote('cheer', Math.min(0.55, -p.vy / P.g + 0.12)); this.cheerQ = 0; }
      else if (this.surpriseQ) { hero.emote('surprise', 0.3); this.surpriseQ = 0; }
    }
    if (p.sp > 0 && this.tick % 3 === 0) { this.trail.push([p.x + P.w / 2, p.y + P.h, hero.anim, hero.s.frame]); if (this.trail.length > 5) this.trail.shift(); } else if (p.sp <= 0) this.trail.length = 0;
    for (const s of this.segs) for (const o of s.solids) if (o.sq > 0) o.sq -= dt * 3;
    // camera: ahead of the hero, the floor low on screen when grounded, a dead zone in the air
    this.camX += (p.x + P.w / 2 - 120 + (p.sp > 0 ? 30 : 0) - this.camX) * Math.min(1, dt * 5);
    const feet = p.y + P.h; let ty = this.camY;
    if (p.on || p.lad) ty = feet - 285; else { if (feet - ty > 340) ty = feet - 340; if (feet - ty < 140) ty = feet - 140; }
    this.camY += (Math.min(30, ty) - this.camY) * Math.min(1, dt * (p.on ? 3 : 4.5));
    if (p.x > this.genX - W * 1.1) this.pump(1e9);
    if (this.tick % 120 === 0) this.prune();
  }
  calm() { const a = this.hero.a.action; if (a && a !== 'knockdown' && a !== 'flinch') this.hero.revive(); }
  event(e) {
    const p = this.p, P = this.ph, hero = this.hero, k = e[0], o = e[1], fx = p.x + P.w / 2, fy = p.y + P.h;
    if (k === 'jump') { this.calm(); hero.jump(); this.puff(fx, fy, '#e9e2d4', 5, 50, 0.3); }
    else if (k === 'air') { this.calm(); hero.jump(); this.ring(fx, fy, p.wg > 0 ? PWR.wings[2] : '#ffffff', 14); }
    else if (k === 'land') { if (e[2] > 420) this.puff(fx, fy, '#ddd5c4', 7, 70, 0.35); if (/^(cheer|surprise)$/.test(hero.a.action || '')) this.calm(); }
    else if (k === 'bounce') { o.sq = 1; this.puff(o.x + o.w / 2, o.y, o.spring ? '#ffffff' : this.col(0), 10, 130); if (o.spring) this.surpriseQ = 1; else if (this.rng() < 0.3) this.cheerQ = 1; }
    else if (k === 'grab') this.calm();
    else if (k === 'top') this.puff(fx, fy, '#ffffff', 5, 50, 0.3);
    else if (k === 'kill') {
      o.dt = this.t; o.dx = this.foeX(o, p.t); o.dy = this.foeY(o, p.t);
      this.puff(o.dx + o.w / 2, o.dy + o.h / 2, e[2] === 'stomp' ? '#ffffff' : this.col(3), 12, 150);
      this.popup(o.dx + o.w / 2, o.dy - 6, e[2] === 'stomp' ? 'STOMP' : '+25', this.col(1));
    }
    else if (k === 'swing') { if (p.gun) { hero.shoot(); this.shots.push({ x: p.x + P.w + 4, y: p.y + P.h * 0.42, life: 0.25 }); } else hero.attack(); }
    else if (k === 'hurt') { hero.hurt(); this.shake = 0.3; this.puff(fx, fy - P.h / 2, this.col(0), 12, 160); }
    else if (k === 'pop') { this.ring(fx, fy - P.h / 2, PWR.shield[2], 30); this.popup(fx, p.y - 8, 'BLOCKED', PWR.shield[2]); }
    else if (k === 'save') { this.ring(fx, fy - P.h / 2, PWR.shield[2], 40); this.popup(fx, p.y - 8, 'SAVED!', PWR.shield[2]); this.surpriseQ = 1; }
    else if (k === 'crumble') this.puff(o.x + o.w / 2, o.y + o.h, '#a89880', 4, 40, 0.4);
    else if (k === 'take') {
      const t = o.t;
      if (t === 'coin') { this.puff(o.x, o.y, this.col(1), 4, 60, 0.3); if (Math.abs(o.x - fx) > 24 || Math.abs(o.y - fy + P.h / 2) > 24) this.flying.push({ x: o.x, y: o.y, life: 0.25 }); }
      else if (t === 'gem') { this.ring(o.x, o.y, this.col(3), 18); this.popup(o.x, o.y - 10, '+5', this.col(3)); }
      else if (t === 'heart') { this.ring(o.x, o.y, '#ff5a6e', 18); this.popup(o.x, o.y - 10, '♥', '#ff5a6e'); }
      else { this.ring(fx, fy - P.h / 2, PWR[t][2], 36); this.puff(fx, fy - P.h / 2, PWR[t][2], 16, 160); this.popup(fx, p.y - 12, PWR[t][3], PWR[t][2]); this.cheerQ = 1; }
    }
  }
  pit() {
    const p = this.p;
    if (p.hp <= 1) { p.hp = 0; this.pitDeath = true; return this.die(); }
    p.hp--; this.fallen = true; this.falls = (this.falls || 0) + 1;
    let seg = this.segs[0];
    for (const s of this.segs) if (s.x0 <= p.x) seg = s;
    for (const s of this.segs) if (s.x1 > seg.x0) for (const o of s.solids) if (o.k === 'c') o.tt = null;
    const P = this.ph;
    Object.assign(p, { x: seg.x0 + 4, y: seg.y0 - P.h, vx: 0, vy: 0, on: seg.entry, j: 0, lad: null, coy: 0, lc: 0, inv: 1.6, cool: 0, sw: 0, wait: 0.95, fell: false, sp: 0 });
    this.hero.revive(); this.plan = null; this.trail.length = 0;
    this.ring(p.x + P.w / 2, p.y + P.h / 2, '#ffffff', 26);
  }
  die() { const p = this.p; this.kos = (this.kos || 0) + 1; this.dead = 1.8; p.hp = 0; this.hero.ko(); this.shake = 0.4; this.puff(p.x + this.ph.w / 2, Math.min(p.y + this.ph.h, this.camY + H - 6), this.col(0), 22, 220); }
  prune() {
    const lim = Math.floor((this.camX - 1400) / BK);
    while (this.gmin < lim) { this.grid.delete(this.gmin); this.agrid.delete(this.gmin); this.gmin++; }
    this.segs = this.segs.filter((s) => s.x1 > this.camX - 1500);
    this.deco = this.deco.filter((d) => d.x > this.camX - 400);
  }
  puff(x, y, col, n = 8, sp = 90, life = 0.5) {
    if (this.mods.party) n *= 2;
    for (let i = 0; i < n; i++) { const a = this.r(0, TAU), v = this.r(sp * 0.3, sp); this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: this.r(life * 0.5, life), max: life, c: this.mods.party ? `hsl(${this.r(0, 360) | 0},90%,60%)` : col, r: this.r(1.2, 3) }); }
    if (this.fx.length > 300) this.fx.splice(0, this.fx.length - 300);
  }
  ring(x, y, c, r = 22) { this.fx.push({ ring: 1, x, y, r, c, life: 0.35, max: 0.35 }); }
  popup(x, y, s, c) { this.pops.push({ x, y, s, c, life: 1 }); if (this.pops.length > 8) this.pops.shift(); }
  fxStep(dt) {
    for (const f of this.fx) { f.life -= dt; if (!f.ring) { f.vy += 300 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } }
    this.fx = this.fx.filter((f) => f.life > 0);
    for (const q of this.pops) { q.life -= dt * 0.9; q.y -= 24 * dt; }
    this.pops = this.pops.filter((q) => q.life > 0);
    for (const s of this.shots) { s.x += 700 * dt; s.life -= dt; }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const f of this.flying) f.life -= dt;
    this.flying = this.flying.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt); this.banner.t -= dt;
  }
  hud() { return `${this.score} · ◎${this.coins} · ${'♥'.repeat(Math.max(0, this.p.hp))}`; }
  // ---------------------------------------------------------------- look
  // greebleworks faces and decks on everything solid (platformer-look.js bakes them); the backdrop
  // (sky, far city, the sand city, fog) behind, and cables, weather and the grade in front
  looks() {
    this.A = art();
    this.bd = new Backdrop(this);
    const g = (this.shadeG = this.ctx.createLinearGradient(0, 0, 0, 220));
    g.addColorStop(0, 'rgba(4,3,3,0)'); g.addColorStop(0.12, 'rgba(4,3,3,0.05)'); g.addColorStop(0.55, 'rgba(4,3,3,0.5)'); g.addColorStop(1, 'rgba(3,2,3,0.92)');
  }
  areaName(a, x) { const A = AREAS[a]; return tAt(x) > 0.55 ? A.late : A.name; }
  // the highest walkable top at world x (where a near asteroid lands)
  groundTop(x) {
    let best = null;
    for (const o of this.q(x - 1, x + 1, this.grid, this.qa)) if (((o.k === 'g' && o.st !== 'ceil') || o.k === 'o') && x >= o.x && x <= o.x + o.w && (best === null || o.y < best)) best = o.y;
    return best;
  }
  lamp(c, col, x, y, r, a) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, Math.min(1, a)); this.bd.tintGlow(c, col, x, y, r); c.restore(); }
  draw(c) {
    this.pump(3);
    const p = this.p, P = this.ph, cx = this.camX, cy = this.camY, t = this.t, A = this.A;
    c.imageSmoothingEnabled = false;
    this.bd.back(c);
    c.save();
    c.translate(-Math.round(cx) + (this.shake > 0 ? (this.rng() - 0.5) * 8 * this.shake : 0), -Math.round(cy));
    c.imageSmoothingEnabled = false;
    const x0 = cx - 60, x1 = cx + W + 60, bot = cy + H + 20;
    const vs = [...this.q(x0, x1, this.grid, this.qa)], va = [...this.q(x0 - 200, x1, this.agrid, this.qb)];
    // the back wall of a tunnel
    for (const s of this.segs) if (s.clr && s.x1 > x0 && s.x0 < x1) {
      let lo = -1e9, hi = 1e9; for (const o of s.solids) if (o.h === DEEP) { lo = Math.max(lo, o.y); hi = Math.min(hi, o.y); }
      const bx = Math.max(s.x0, x0), bw = Math.min(s.x1, x1) - bx, by = hi - s.clr - 4, bh = lo - hi + s.clr + 8;
      c.fillStyle = this.bd.pat(c, A.faceOf('under')); c.fillRect(bx, by, bw, bh); c.fillStyle = 'rgba(4,3,3,0.84)'; c.fillRect(bx, by, bw, bh);
    }
    for (const d of this.deco) if (d.x > x0 - 40 && d.x < x1 + 40) this.drawDeco(c, d, t);
    for (const o of vs) if (o.k === 'l') this.drawLadder(c, o);
    for (const o of vs) if (o.k === 'g') this.drawBlock(c, o, bot, x0, x1);
    for (const o of vs) if (o.k !== 'g' && o.k !== 'l') this.drawThing(c, o, t, p.t);
    this.bd.scarsWorld(c, x0, x1);
    for (const o of va) if (o.k === 'i' && !o.got) this.drawItem(c, o, t);
    for (const o of va) if (o.k === 'f') this.drawFoe(c, o, t, p.t);
    this.drawHero(c, t);
    for (const f of this.fx) {
      c.globalAlpha = Math.max(0, f.life / f.max);
      if (f.ring) { c.strokeStyle = f.c; c.lineWidth = 2.5; c.beginPath(); c.arc(f.x, f.y, f.r * (1.4 - f.life / f.max), 0, TAU); c.stroke(); }
      else { c.fillStyle = f.c; c.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r); }
    }
    c.globalAlpha = 1; c.strokeStyle = '#fff6b0'; c.lineWidth = 2;
    for (const s of this.shots) { c.beginPath(); c.moveTo(s.x - 12, s.y); c.lineTo(s.x, s.y); c.stroke(); }
    for (const f of this.flying) { const k = f.life / 0.25, hx = p.x + P.w / 2, hy = p.y + P.h / 2; this.coin(c, hx + (f.x - hx) * k, hy + (f.y - hy) * k, t, 0.8); }
    c.restore();
    this.bd.front(c);
    this.overlay(c);
  }
  // a deck strip along a top: greebleworks' platform tile, repeated
  deckStrip(c, key, x, y, w, vx0, vx1, h = 20) {
    const img = this.A.deckOf(key), tw = img.width, th = img.height, a = Math.max(x, vx0), b = Math.min(vx1, x + w);
    for (let xx = x + Math.max(0, Math.floor((vx0 - x) / tw)) * tw; xx < b; xx += tw) { const ww = Math.min(tw, x + w - xx); c.drawImage(img, 0, 0, ww, th, xx, y - 2, ww, h); }
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(a, y - 3, b - a, 1);
    c.fillStyle = this.lipCol(x); c.fillRect(a, y - 2, b - a, 1.5);
  }
  // the lip's light: the mood's colour where the deck is
  lipCol(x) { const T = tAt(x); return T < 0.25 ? 'rgba(200,225,240,0.55)' : T < 0.6 ? 'rgba(255,190,120,0.55)' : 'rgba(255,170,240,0.55)'; }
  drawBlock(c, o, bot, x0, x1) {
    const A = this.A, bd = this.bd, id = AREAS[o.a || 0].id, L = LOOK[id], st = o.st, y = o.y, deep = o.h === DEEP;
    let hh = Math.min(o.h, bot - y);
    const vx0 = Math.max(o.x, x0), vx1 = Math.min(o.x + o.w, x1);
    if (hh <= 0 || vx1 <= vx0) return;
    if (st === 'crate') {
      c.fillStyle = bd.pat(c, A.faceOf('works')); c.fillRect(o.x, y, o.w, o.h);
      c.fillStyle = 'rgba(12,9,6,0.3)'; c.fillRect(o.x, y, o.w, o.h);
      c.strokeStyle = '#17120e'; c.lineWidth = 2; c.strokeRect(o.x + 1, y + 1, o.w - 2, o.h - 2);
      c.fillStyle = '#9a7418'; for (let x = o.x + 3; x < o.x + o.w - 8; x += 8) { c.beginPath(); c.moveTo(x, y + o.h - 3); c.lineTo(x + 4, y + o.h - 7); c.lineTo(x + 7, y + o.h - 7); c.lineTo(x + 3, y + o.h - 3); c.fill(); }
      c.fillStyle = 'rgba(255,214,160,0.3)'; c.fillRect(o.x, y, o.w, 1.5);
      this.growth(c, o, y, vx0, vx1, false); return;
    }
    if (st === 'stone' || st === 'rock') {
      this.deckStrip(c, 'crum', o.x, y + 2, o.w, vx0, vx1, o.h); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(o.x, y, 1.5, o.h); c.fillRect(o.x + o.w - 1.5, y, 1.5, o.h);
      this.growth(c, o, y, vx0, vx1, false); return;
    }
    if (st === 'ceil') {
      const yb = y + o.h, top = Math.max(y, this.camY - 20);
      c.fillStyle = bd.pat(c, A.faceOf('under')); c.fillRect(vx0, top, vx1 - vx0, yb - top);
      c.fillStyle = 'rgba(5,3,3,0.5)'; c.fillRect(vx0, top, vx1 - vx0, yb - top);
      if (A.ceil) for (let x = o.x + Math.floor((vx0 - o.x) / 64) * 64; x < vx1; x += 64) { const w = Math.min(64, o.x + o.w - x); c.drawImage(A.ceil, 0, 0, w, 44, x, yb - 44, w, 44); }
      c.fillStyle = '#0b0807'; c.fillRect(vx0, yb - 3, vx1 - vx0, 3);
      // drips; tendrils with lit bulbs once the change has come
      for (let x = Math.floor(vx0 / 16) * 16 + 6; x < vx1; x += 16) {
        const k = hash(x), bio = sstep(0.3, 0.85, tAt(x));
        if (k < bio * 0.5) { const len = 6 + k * 40, sw = Math.sin(this.t * 1.4 + x) * 2; c.strokeStyle = '#2a0e22'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, yb); c.quadraticCurveTo(x + sw, yb + len * 0.6, x + sw * 1.5, yb + len); c.stroke(); this.lamp(c, CORE[(x >> 4) % 3], x + sw * 1.5, yb + len, 6, 0.6); }
        else if (k > 0.6) { c.fillStyle = '#0b0807'; c.beginPath(); c.moveTo(x - 4, yb); c.lineTo(x, yb + 5 + (k - 0.6) * 25); c.lineTo(x + 4, yb); c.fill(); }
      }
      return;
    }
    const sky = id === 'sky' && deep;
    if (sky) hh = Math.min(hh, 48);
    c.fillStyle = bd.pat(c, A.faceOf(st === 'tower' ? 'tower' : L.face)); c.fillRect(vx0, y, vx1 - vx0, hh);
    if (hh > 70) this.decals(c, o, y, vx0, vx1);
    this.eyes(c, o, y, hh, vx0, vx1);
    c.save(); c.translate(0, y); c.fillStyle = this.shadeG; c.fillRect(vx0, 0, vx1 - vx0, Math.min(hh, 220)); c.restore();
    if (hh > 220) { c.fillStyle = 'rgba(3,2,3,0.94)'; c.fillRect(vx0, y + 220, vx1 - vx0, hh - 220); }
    if (sky) { c.fillStyle = '#0c0d10'; c.beginPath(); c.moveTo(o.x, y + hh); for (let x = o.x; x <= o.x + o.w; x += 14) c.lineTo(x + 7, y + hh + 8 + hash(x) * 22), c.lineTo(Math.min(o.x + o.w, x + 14), y + hh); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(o.x, y, 2, hh); c.fillRect(o.x + o.w - 2, y, 2, hh);
    this.deckStrip(c, o.belt ? 'works' : st === 'tower' ? 'tower' : L.deck, o.x, y, o.w, vx0, vx1);
    if (o.belt) {
      c.fillStyle = '#17181c'; c.fillRect(o.x, y, o.w, 8); c.fillStyle = '#c8901c';
      const off = ((this.p.t * o.belt) % 14 + 14) % 14, dir = Math.sign(o.belt);
      for (let x = o.x + off - 14; x < o.x + o.w; x += 14) { if (x < o.x + 2 || x > o.x + o.w - 8) continue; c.beginPath(); c.moveTo(x, y + 1.5); c.lineTo(x + 3 + dir * 2, y + 4); c.lineTo(x, y + 6.5); c.lineTo(x + 2, y + 4); c.fill(); }
      c.fillStyle = '#6a625a'; c.beginPath(); c.arc(o.x + 4, y + 4, 4, 0, TAU); c.arc(o.x + o.w - 4, y + 4, 4, 0, TAU); c.fill();
    }
    this.growth(c, o, y, vx0, vx1, true);
  }
  // greebleworks decals on a building face: vents, junction boxes, fire escapes, graffiti, shrines; growth later
  decals(c, o, y, vx0, vx1) {
    const A = this.A; if (!A.decals.length) return;
    for (let k = Math.floor(o.x / 140); k * 140 < o.x + o.w; k++) {
      const dx = k * 140 + 30, hv = hash(k * 3.71 + 0.13);
      if (hv > 0.55 || dx < o.x + 6 || dx + 56 > o.x + o.w - 6 || dx > vx1 || dx + 56 < vx0) continue;
      const bio = sstep(0.3, 0.8, tAt(dx)), list = A.growth.length && hash(k * 9.1) < bio ? A.growth : A.decals;
      c.drawImage(list[Math.floor(hash(k * 1.31) * list.length)], dx, y + 20 + Math.floor(hv * 24));
    }
  }
  // late on, the walls have eyes, and they follow the hero
  eyes(c, o, y, hh, vx0, vx1) {
    if (hh < 90) return;
    for (let k = Math.floor(o.x / 190); k * 190 < o.x + o.w; k++) {
      const ex = k * 190 + 70 + hash(k * 2.3) * 60, bio = sstep(0.45, 0.9, tAt(ex));
      if (bio <= 0 || hash(k * 5.7 + 0.2) > bio * 0.7 || ex < o.x + 14 || ex > o.x + o.w - 14 || ex < vx0 - 20 || ex > vx1 + 20) continue;
      const ey = y + 44 + hash(k * 4.1) * 40, s = 4 + hash(k * 6.6) * 4, p = this.p, hx = p.x + this.ph.w / 2, hy = p.y + this.ph.h / 2;
      const bl = Math.sin(this.t * 0.9 + k * 3.3) > 0.97 ? 0.15 : 1, ang = Math.atan2(hy - ey, hx - ex);
      c.fillStyle = '#1a0610'; c.beginPath(); c.ellipse(ex, ey, s * 1.6, s * 1.05, 0, 0, TAU); c.fill();
      c.fillStyle = '#e8dcc0'; c.beginPath(); c.ellipse(ex, ey, s * 1.25, s * 0.8 * bl, 0, 0, TAU); c.fill();
      if (bl > 0.5) { const ix = ex + Math.cos(ang) * s * 0.45, iy = ey + Math.sin(ang) * s * 0.25; c.fillStyle = rgbS(CORE[k % 3]); c.beginPath(); c.arc(ix, iy, s * 0.5, 0, TAU); c.fill(); c.fillStyle = '#050204'; c.fillRect(ix - 0.6, iy - s * 0.4, 1.2, s * 0.8); }
      this.lamp(c, [255, 60, 90], ex, ey, s * 3, 0.22);
    }
  }
  // the bloom on a top: crust of moss and flesh over the lip, tendrils down the face, mushrooms, flowers
  growth(c, o, y, vx0, vx1, face) {
    if (tAt(vx1) < 0.27) return;
    const t = this.t;
    for (let x = Math.floor(vx0 / 5) * 5; x < vx1; x += 5) {
      if (x < o.x || x > o.x + o.w - 3) continue;
      const bio = sstep(0.28, 0.85, tAt(x)); if (bio < 0.02) continue;
      const h = hash(x * 0.731 + 0.3), w = Math.min(5, o.x + o.w - x);
      if (h < bio * 1.05) { const fl = h < bio * 0.45; c.fillStyle = fl ? (h < bio * 0.2 ? '#5a1438' : '#7a2048') : (h > 0.5 ? '#2f7a3a' : '#1f5a40'); c.fillRect(x, y - 1 - Math.floor(hash(x * 2.1) * 2), w, 3 + Math.floor(h * 3)); }
      if (!face) continue;
      const h2 = hash(x * 1.913 + 0.7);
      if (h2 < bio * 0.1) {
        const len = 8 + hash(x * 3.1) * 28, sw = Math.sin(t * 1.2 + x * 0.1) * 2;
        c.strokeStyle = '#3a1030'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 2, y + 2); c.quadraticCurveTo(x + 2 + sw, y + len * 0.6, x + 2 + sw * 1.6, y + len); c.stroke();
        this.lamp(c, CORE[Math.floor(h2 * 300) % 3], x + 2 + sw * 1.6, y + len, 6, 0.55 + 0.3 * Math.sin(t * 2.5 + x));
      }
      const h3 = hash(x * 2.377 + 1.1);
      if (h3 < bio * 0.05) {
        const sh = 3 + hash(x * 4.4) * 6, col = CORE[Math.floor(h3 * 997) % 3];
        c.fillStyle = '#d6cbb8'; c.fillRect(x + 1.5, y - sh, 1.5, sh);
        c.fillStyle = rgbS(col); c.beginPath(); c.ellipse(x + 2.2, y - sh, 3.4, 2.2, 0, Math.PI, 0); c.fill();
        this.lamp(c, col, x + 2.2, y - sh - 1, 7, 0.45);
      } else if (h3 < bio * 0.1) {
        const sh = 4 + hash(x * 5.9) * 7, col = PET[Math.floor(h3 * 1301) % PET.length], sw = Math.sin(t + x) * 1.5;
        c.strokeStyle = '#2f8a4a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 2, y); c.quadraticCurveTo(x + 4, y - sh * 0.5, x + 2 + sw, y - sh); c.stroke();
        c.fillStyle = rgbS(col); c.fillRect(x + 0.5 + sw, y - sh - 1.5, 3, 3);
        this.lamp(c, col, x + 2 + sw, y - sh, 6, 0.5);
      }
    }
  }
  drawLadder(c, o) {
    c.strokeStyle = '#3e3026'; c.lineWidth = 3; c.beginPath();
    c.moveTo(o.x + 3, o.y - 4); c.lineTo(o.x + 3, o.y + o.h); c.moveTo(o.x + o.w - 3, o.y - 4); c.lineTo(o.x + o.w - 3, o.y + o.h); c.stroke();
    c.strokeStyle = '#7a5e44'; c.lineWidth = 2; c.beginPath();
    for (let y = o.y + 6; y < o.y + o.h; y += 11) { c.moveTo(o.x + 3, y); c.lineTo(o.x + o.w - 3, y); }
    c.stroke();
  }
  drawThing(c, o, t, wt) {
    const id = AREAS[o.a || 0].id, bio = sstep(0.3, 0.8, tAt(o.x));
    if (o.k === 'o') {
      this.deckStrip(c, 'one', o.x, o.y, o.w, o.x, o.x + o.w, 14);
      if (id === 'sky') for (let x = o.x + 8; x < o.x + o.w - 4; x += 22) this.lamp(c, [120, 200, 255], x, o.y + 12, 6, 0.4 + 0.2 * Math.sin(t * 4 + x));
      this.growth(c, o, o.y, o.x, o.x + o.w, false);
    } else if (o.k === 'c') {
      let dy = 0, rot = 0, a = 1;
      if (o.tt != null) { const k = wt - o.tt; if (k > CRUMBLE) { const f = k - CRUMBLE; dy = f * f * 700; rot = f * 2 * (hash(o.x) - 0.5); a = Math.max(0, 1 - f * 1.5); } else dy = Math.sin(t * 70) * 1.2; }
      if (a <= 0) return;
      c.save(); c.globalAlpha = a; c.translate(o.x + o.w / 2, o.y + o.h / 2 + dy); c.rotate(rot);
      c.drawImage(this.A.deckOf('crum'), Math.floor(hash(o.x) * 30), 0, Math.min(34, o.w), 20, -o.w / 2 + 1, -o.h / 2 - 2, o.w - 2, o.h + 4);
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-o.w / 2 + 6, -o.h / 2); c.lineTo(-2, 0); c.lineTo(4, -2); c.lineTo(o.w / 2 - 6, o.h / 2); c.stroke();
      if (o.tt != null) this.lamp(c, [255, 140, 50], 0, 0, 10, 0.3);
      c.restore();
    } else if (o.k === 'm') {
      const mx = this.mx(o, wt), my = this.my(o, wt);
      c.strokeStyle = 'rgba(255,190,120,0.12)'; c.setLineDash([4, 5]); c.lineWidth = 2; c.beginPath();
      c.moveTo(o.x - Math.abs(o.ax) + o.w / 2, o.y - Math.abs(o.ay) + 6); c.lineTo(o.x + Math.abs(o.ax) + o.w / 2, o.y + Math.abs(o.ay) + 6); c.stroke(); c.setLineDash([]);
      c.drawImage(this.A.deckOf('move'), 0, 0, Math.min(64, o.w), 20, mx, my - 2, o.w, o.h + 4);
      for (const k of [8, o.w - 8]) this.lamp(c, bio > 0.5 ? [90, 255, 240] : [255, 150, 60], mx + k, my + o.h + 2, 7 + Math.sin(t * 20 + k) * 1.5, 0.75);
    } else if (o.k === 'p') {
      const s = Math.max(0, o.sq || 0), cxp = o.x + o.w / 2, base = o.y + o.h;
      if (o.spring) {
        const ext = s > 0 ? 10 * s : 0, top = o.y - ext;
        c.strokeStyle = '#8a7a66'; c.lineWidth = 2; c.beginPath(); c.moveTo(cxp - 7, base);
        for (let i = 1; i <= 5; i++) c.lineTo(cxp + (i % 2 ? 7 : -7), base - ((base - top - 4) * i) / 5);
        c.stroke(); c.fillStyle = '#c8501c'; roundRect(c, o.x - 2, top - 2, o.w + 4, 5, 2); c.fill(); c.fillStyle = '#2a2622'; c.fillRect(o.x, base - 3, o.w, 3);
        this.lamp(c, [255, 120, 40], cxp, top, 8, 0.35);
      } else if (bio < 0.5) {
        const sq = 1 - s * 0.45;
        c.fillStyle = '#211e1b'; c.fillRect(o.x - 1, base - 4, o.w + 2, 4); c.fillStyle = '#4a4440'; c.fillRect(o.x + 2, base - 4 - 4 * sq, o.w - 4, 4 * sq);
        c.fillStyle = '#9ef0ff'; c.fillRect(o.x + 4, base - 4 - 4 * sq, o.w - 8, 1.5);
        this.lamp(c, [90, 230, 255], cxp, base - 6, 10 + s * 10, 0.55 + s * 0.45);
      } else {
        const sq = 1 - s * 0.45;
        c.fillStyle = '#d8cfbe'; c.fillRect(cxp - 4, base - 7, 8, 7);
        c.fillStyle = '#c0307a'; c.beginPath(); c.ellipse(cxp, base - 7, o.w / 2 + s * 3, 9 * sq, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#ffd0f0'; for (const k of [-8, 0, 7]) { c.beginPath(); c.arc(cxp + k, base - 10 * sq - (k ? 0 : 3 * sq), 1.8, 0, TAU); c.fill(); }
        this.lamp(c, [255, 80, 200], cxp, base - 10, 14 + s * 10, 0.4 + s * 0.4);
      }
    } else if (o.k === 's') {
      const bone = bio > 0.5;
      c.fillStyle = bone ? '#d8ccb4' : '#6e5c4c'; c.strokeStyle = bone ? '#4a0c18' : '#241c16'; c.lineWidth = 1; c.beginPath();
      for (let x = o.x; x < o.x + o.w - 1; x += 8) { c.moveTo(x, o.y + o.h); c.lineTo(x + 4 + (bone ? Math.sin(x) * 1.5 : 0), o.y); c.lineTo(x + 8, o.y + o.h); }
      c.fill(); c.stroke();
      c.fillStyle = bone ? '#a01428' : '#a8a098'; for (let x = o.x; x < o.x + o.w - 1; x += 8) c.fillRect(x + 3 + (bone ? Math.sin(x) * 1.5 : 0), o.y, 2, 2);
    }
  }
  coin(c, x, y, t, s = 1) {
    const img = this.skin.pick('coin', 'item'), k = Math.abs(Math.cos(t * 3 + x * 0.05));
    c.fillStyle = this.col(1); c.globalAlpha = 0.25; c.beginPath(); c.arc(x, y, 10 * s, 0, TAU); c.fill(); c.globalAlpha = 1;
    if (ready(img)) { c.save(); c.translate(x, y); c.scale(0.35 + 0.65 * k, 1); drawFit(c, img, 0, 0, 16 * s, 16 * s); c.restore(); return; }
    c.fillStyle = '#f2c230'; c.beginPath(); c.ellipse(x, y, 7 * s * (0.3 + 0.7 * k), 7 * s, 0, 0, TAU); c.fill();
    c.strokeStyle = '#9a6a10'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, 4.5 * s * (0.3 + 0.7 * k), 4.5 * s, 0, 0, TAU); c.stroke();
  }
  drawItem(c, o, t) {
    const y = o.y + Math.sin(t * 3 + o.x * 0.1) * 2.5;
    if (o.t === 'coin') return this.coin(c, o.x, y, t);
    if (o.t === 'gem') {
      c.fillStyle = this.col(3); c.beginPath(); c.moveTo(o.x, y - 9); c.lineTo(o.x + 8, y - 2); c.lineTo(o.x, y + 9); c.lineTo(o.x - 8, y - 2); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.moveTo(o.x, y - 9); c.lineTo(o.x + 3, y - 2); c.lineTo(o.x - 4, y - 2); c.fill();
      if (Math.sin(t * 5 + o.x) > 0.8) this.star(c, o.x + 6, y - 7, 3, 1, '#ffffff');
      return;
    }
    if (o.t === 'heart') { const s = 1 + Math.sin(t * 6) * 0.08; c.save(); c.translate(o.x, y); c.scale(s, s); c.fillStyle = '#ff4f66'; c.beginPath(); c.moveTo(0, 7); c.bezierCurveTo(-12, -2, -6, -11, 0, -4); c.bezierCurveTo(6, -11, 12, -2, 0, 7); c.fill(); c.restore(); return; }
    this.bubble(c, o.t, o.x, y, 12, t);
  }
  bubble(c, k, x, y, r, t) {
    const col = PWR[k][2], g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, col); g.addColorStop(1, mixc(col, '#000000', 0.35));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r + 2.5 + Math.sin(t * 6) * 1.2, 0, TAU); c.stroke();
    c.save(); c.translate(x, y); c.fillStyle = '#1b1c26'; c.strokeStyle = '#1b1c26'; const q = r * 0.62;
    if (k === 'shield') { c.beginPath(); c.moveTo(0, -q); c.lineTo(q * 0.85, -q * 0.6); c.quadraticCurveTo(q * 0.8, q * 0.5, 0, q); c.quadraticCurveTo(-q * 0.8, q * 0.5, -q * 0.85, -q * 0.6); c.closePath(); c.fill(); }
    else if (k === 'magnet') { c.lineWidth = q * 0.5; c.beginPath(); c.moveTo(-q * 0.6, -q * 0.8); c.lineTo(-q * 0.6, 0); c.arc(0, 0, q * 0.6, Math.PI, 0, true); c.lineTo(q * 0.6, -q * 0.8); c.stroke(); c.fillStyle = '#ffffff'; c.fillRect(-q * 0.85, -q * 0.95, q * 0.5, q * 0.35); c.fillRect(q * 0.35, -q * 0.95, q * 0.5, q * 0.35); }
    else if (k === 'wings') { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * q * 0.15, q * 0.4); c.quadraticCurveTo(s * q * 1.2, -q * 0.2, s * q * 0.9, -q * 0.9); c.quadraticCurveTo(s * q * 0.6, -q * 0.1, s * q * 0.15, q * 0.4); c.fill(); } }
    else if (k === 'speed') { c.beginPath(); c.moveTo(q * 0.3, -q); c.lineTo(-q * 0.5, q * 0.1); c.lineTo(0, q * 0.1); c.lineTo(-q * 0.3, q); c.lineTo(q * 0.5, -q * 0.15); c.lineTo(0, -q * 0.15); c.closePath(); c.fill(); }
    else this.star(c, 0, 0, q, q * 0.45, '#1b1c26');
    c.restore();
  }
  star(c, x, y, r1, r2, col) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? r2 : r1; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); }
  drawFoe(c, f, t, wt) {
    const m = this.skin.creatures[f.m] || this.skin.creatures[0], z = 30 * this.S ** 0.5;
    if (f.dead) {
      const k = t - (f.dt ?? t); if (k > 0.7) return;
      const img = m?.dead || m?.hurt || m?.frames?.[0];
      c.save(); c.globalAlpha = Math.max(0, 1 - k / 0.7);
      if (f.dead === 'stomp') { c.translate(f.dx + f.w / 2, f.dy + f.h); c.scale(1.2, 0.35); drawFit(c, img, 0, -z / 2, z, z); }
      else { c.translate(f.dx + f.w / 2 + k * 90, f.dy + f.h / 2 - k * 120 + k * k * 300); c.rotate(k * 9); drawFit(c, img, 0, 0, z, z); }
      c.restore(); return;
    }
    const x = this.foeX(f, wt), y = this.foeY(f, wt), dir = f.span ? (((wt * f.f + f.ph) % 2) < 1 ? 1 : -1) : -1;
    const fr = m?.walk?.length ? m.walk[Math.floor(t * 8 + f.id) % m.walk.length] : m?.frames?.[Math.floor(t * 5 + f.id) % 2];
    if (f.kind === 'fly') { c.fillStyle = 'rgba(255,255,255,0.5)'; const k = Math.sin(t * 22) * 5; c.beginPath(); c.ellipse(x + f.w / 2 - 7, y + 2 - k * 0.3, 7, 3 + k * 0.4, -0.5, 0, TAU); c.ellipse(x + f.w / 2 + 7, y + 2 - k * 0.3, 7, 3 + k * 0.4, 0.5, 0, TAU); c.fill(); }
    if (!drawFit(c, fr, x + f.w / 2, y + f.h - z / 2 + 3, z, z, 0, dir < 0)) { c.fillStyle = this.col(3); roundRect(c, x, y, f.w, f.h, 6); c.fill(); }
  }
  drawHero(c, t) {
    const p = this.p, P = this.ph, hero = this.hero, sc = 1.4 * this.S, hx = p.x + P.w / 2;
    const hy = this.dead > 0 && this.pitDeath ? this.camY + H - 2 : p.y + P.h;
    const alpha = this.dead > 0 ? Math.min(1, this.dead / 0.6) : p.inv > 0 && p.wait <= 0 && Math.floor(t * 14) % 2 ? 0.45 : 1;
    for (const [i, tr] of this.trail.entries()) drawFrame(c, hero.sheet, tr[2], 'E', tr[3], tr[0] - (this.trail.length - i) * 2, tr[1], sc, { alpha: 0.12 + i * 0.05 });
    if (p.wg > 0 && !this.dead) {
      const fl = Math.sin(t * (p.on ? 5 : 18)) * 0.45, wy = hy - P.h * 0.75;
      c.fillStyle = PWR.wings[2];
      for (const s of [-1, 1]) { c.save(); c.translate(hx - 3, wy); c.rotate(s * (0.5 + fl) - 0.3); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-14, -10 * s, -22, -3 * s); c.quadraticCurveTo(-12, 2 * s, 0, 2 * s); c.fill(); c.restore(); }
    }
    const filter = p.st > 0 && !this.dead ? `hue-rotate(${Math.floor(t * 720) % 360}deg) saturate(2) brightness(1.25)` : p.sp > 0 ? 'brightness(1.15)' : undefined;
    if (p.lad && hero.sheet.meta?.directions?.includes('N')) drawFrame(c, hero.sheet, 'walk', 'N', hero.s.frame, hx, hy, sc, { alpha, filter });
    else hero.draw(c, hx, hy, sc, { alpha, filter });
    if (this.dead) return;
    const my = hy - P.h / 2 - 2;
    if (p.sh > 0) {
      c.globalAlpha = p.sh < 2 && Math.floor(t * 8) % 2 ? 0.25 : 0.7; c.strokeStyle = PWR.shield[2]; c.lineWidth = 2; c.beginPath(); c.arc(hx, my, 22 * this.S, 0, TAU); c.stroke();
      c.globalAlpha *= 0.25; c.fillStyle = PWR.shield[2]; c.fill(); c.globalAlpha = 0.8; c.strokeStyle = '#ffffff'; c.beginPath(); c.arc(hx, my, 18 * this.S, -2.4 + t * 2, -1.7 + t * 2); c.stroke(); c.globalAlpha = 1;
    }
    if (p.mg > 0) { c.strokeStyle = PWR.magnet[2]; c.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const k = (t * 1.5 + i / 2) % 1; c.globalAlpha = (1 - k) * 0.45; c.beginPath(); c.arc(hx, my, 20 + k * 70, 0, TAU); c.stroke(); } c.globalAlpha = 1; }
    if (p.st > 0) for (let i = 0; i < 3; i++) { const a = t * 5 + (i * TAU) / 3; this.star(c, hx + Math.cos(a) * 20, my + Math.sin(a) * 20, 3.5, 1.4, PWR.star[2]); }
  }
  // props: barrels (some burning), vents, sodium lamps, neon shards, pylons and signs in the city; alien
  // flowers, glowing fungus, spore pods and blooms once the change reaches them (each at its own moment)
  drawDeco(c, d, t) {
    const late = sstep(0.3, 0.8, tAt(d.x)) > d.r * 0.9 + 0.05, fl = 0.8 + 0.2 * Math.sin(t * 17 + d.r * 20);
    if (d.k === 'plant') {
      if (late) {
        for (let i = 0; i < 3; i++) {
          const hh = 10 + d.r * 10 + i * 4 - (i === 1 ? 0 : 3), sx = d.x - 6 + i * 6, sw = Math.sin(t * 1.5 + i + d.r * 9) * 2, col = PET[(i + Math.floor(d.r * 10)) % PET.length];
          c.strokeStyle = '#2a7a4a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(sx, d.y); c.quadraticCurveTo(sx + sw, d.y - hh * 0.6, sx + sw * 1.4, d.y - hh); c.stroke();
          c.fillStyle = rgbS(col); c.beginPath(); c.arc(sx + sw * 1.4, d.y - hh, 2.6, 0, TAU); c.fill(); this.lamp(c, col, sx + sw * 1.4, d.y - hh, 9, 0.5);
        }
      } else if (d.r < 0.55) {
        c.fillStyle = '#3e2618'; roundRect(c, d.x - 7, d.y - 18, 14, 18, 2); c.fill();
        c.fillStyle = '#22150c'; c.fillRect(d.x - 7, d.y - 14, 14, 2); c.fillRect(d.x - 7, d.y - 6, 14, 2); c.fillStyle = '#8a6a18'; c.fillRect(d.x - 4, d.y - 11, 8, 3);
        if (d.r < 0.3) { // a fire in it
          c.fillStyle = '#ff9a30'; for (let i = -1; i <= 1; i++) { const fh = (6 + Math.sin(t * 13 + i * 2 + d.r * 9) * 3) * fl; c.beginPath(); c.moveTo(d.x + i * 4 - 3, d.y - 18); c.lineTo(d.x + i * 4, d.y - 18 - fh); c.lineTo(d.x + i * 4 + 3, d.y - 18); c.fill(); }
          this.lamp(c, [255, 130, 40], d.x, d.y - 22, 30 * fl, 0.55);
        }
      } else {
        c.fillStyle = '#302c28'; c.fillRect(d.x - 6, d.y - 16, 12, 16); c.fillStyle = '#16140f'; for (let y = d.y - 13; y < d.y - 2; y += 3) c.fillRect(d.x - 4, y, 8, 1.5);
        c.fillStyle = '#3a3630'; c.fillRect(d.x - 8, d.y - 18, 16, 3);
        if (Math.sin(t * 3 + d.r * 7) > 0.2) this.lamp(c, [255, 40, 30], d.x + 5, d.y - 19, 5, 0.9);
      }
    } else if (d.k === 'torch') {
      if (late) {
        for (let i = 0; i < 3; i++) { const sh = 6 + i * 4 + d.r * 4, x = d.x - 6 + i * 6, col = CORE[(i + Math.floor(d.r * 5)) % 3]; c.fillStyle = '#d8cfbe'; c.fillRect(x - 0.8, d.y - sh, 1.6, sh); c.fillStyle = rgbS(col); c.beginPath(); c.ellipse(x, d.y - sh, 4, 2.6, 0, Math.PI, 0); c.fill(); this.lamp(c, col, x, d.y - sh, 16, 0.5); }
      } else {
        c.fillStyle = '#2a2420'; c.fillRect(d.x - 1.5, d.y - 54, 3, 54); c.fillRect(d.x - 1.5, d.y - 54, 10, 2.5); c.fillStyle = '#4a4036'; c.fillRect(d.x + 4, d.y - 52, 8, 3);
        const on = Math.sin(t * 5 + d.r * 30) > -0.85 ? fl : 0.15;
        c.fillStyle = on > 0.5 ? '#ffc070' : '#5a4020'; c.fillRect(d.x + 5, d.y - 49, 6, 1.5);
        this.lamp(c, [255, 170, 70], d.x + 8, d.y - 46, 40 * on, 0.5 * on);
      }
    } else if (d.k === 'crystal') {
      if (late) {
        for (let i = -1; i <= 1; i++) { const r = 3.5 + (i ? 0 : 2) + d.r * 2, pu = 0.7 + 0.3 * Math.sin(t * 2.4 + i + d.r * 7); c.fillStyle = '#2a4a1c'; c.beginPath(); c.ellipse(d.x + i * 7, d.y - r, r * 0.9, r, 0, 0, TAU); c.fill(); c.fillStyle = '#b8ff60'; c.beginPath(); c.ellipse(d.x + i * 7, d.y - r - 1, r * 0.45 * pu, r * 0.55 * pu, 0, 0, TAU); c.fill(); this.lamp(c, [170, 255, 90], d.x + i * 7, d.y - r, 12 * pu, 0.45); }
      } else {
        const on = Math.sin(t * 9 + d.r * 40) > -0.7;
        c.lineWidth = 2; c.lineCap = 'round';
        for (let i = -1; i <= 1; i++) { const col = (i + Math.floor(d.r * 3)) & 1 ? [255, 60, 150] : [60, 230, 255]; c.strokeStyle = on ? rgbS(col) : '#3a3036'; c.beginPath(); c.moveTo(d.x + i * 6, d.y); c.lineTo(d.x + i * 7 + 3, d.y - 8 - (i ? 0 : 6) - d.r * 5); c.stroke(); if (on) this.lamp(c, col, d.x + i * 6 + 1, d.y - 6, 10, 0.45); }
        c.lineCap = 'butt';
      }
    } else if (d.k === 'flag') {
      c.fillStyle = '#2c2a28'; c.fillRect(d.x - 1.5, d.y - 70, 3, 70); c.fillStyle = '#16140f'; c.fillRect(d.x - 4, d.y - 4, 8, 4);
      const up = d.up ? Math.min(1, (t - d.up) * 2) : 0, col = up > 0 ? [90, 255, 200] : [255, 50, 50], on = up > 0 || Math.sin(t * 6) > 0;
      c.fillStyle = '#0c0d10'; c.fillRect(d.x + 2, d.y - 68, 24, 15);
      c.fillStyle = on ? rgbS(col) : '#2a1a1a'; for (let i = 0; i < 3; i++) c.fillRect(d.x + 5 + i * 7, d.y - 65 + ((i * 5 + Math.floor(t * 4 * (up ? 1 : 0))) % 3) * 3, 4, 2);
      if (on) this.lamp(c, col, d.x + 14, d.y - 61, 22 + up * 14, 0.5 + up * 0.3);
    } else if (d.k === 'banner') {
      if (late) {
        c.strokeStyle = '#2f8a4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(d.x, d.y); c.quadraticCurveTo(d.x - 4, d.y - 24, d.x + 2, d.y - 40); c.stroke();
        const col = PET[Math.floor(d.r * PET.length)], sp = t * 0.5;
        c.fillStyle = rgbS(col); for (let i = 0; i < 6; i++) { const a = sp + (i * TAU) / 6; c.beginPath(); c.ellipse(d.x + 2 + Math.cos(a) * 6, d.y - 40 + Math.sin(a) * 6, 5, 2.5, a, 0, TAU); c.fill(); }
        c.fillStyle = '#fff4c0'; c.beginPath(); c.arc(d.x + 2, d.y - 40, 2.5, 0, TAU); c.fill(); this.lamp(c, col, d.x + 2, d.y - 40, 24, 0.55);
      } else {
        c.fillStyle = '#2a2826'; c.fillRect(d.x - 1, d.y - 44, 2, 44);
        const on = h1s(Math.floor(t * 8) + d.r * 99) > 0.12, col = d.r > 0.5 ? [255, 60, 140] : [80, 220, 255];
        c.fillStyle = '#0c0b0e'; c.fillRect(d.x + 1, d.y - 48, 22, 11);
        c.fillStyle = on ? rgbS(col) : '#301820'; for (let i = 0; i < 4; i++) c.fillRect(d.x + 3 + i * 5, d.y - 46 + (i % 2) * 2, 3, 5 - (i % 2) * 2);
        if (on) this.lamp(c, col, d.x + 12, d.y - 42, 22, 0.55);
      }
    } else if (d.k === 'gear' || d.k === 'pipe') {
      c.save(); c.translate(d.x, d.y - 26); c.rotate(t * (d.r > 0.5 ? 1 : -1)); c.fillStyle = late ? '#3a2234' : '#4e4034';
      for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.fillRect(-3, -16, 6, 6); }
      c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill(); c.fillStyle = '#1c1610'; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill(); c.restore();
      if (late) this.lamp(c, [255, 80, 200], d.x, d.y - 26, 12, 0.35);
    }
  }
  overlay(c) {
    c.save(); c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const p = this.p; let x = 20;
    if (!this.dead) for (const k in PWR) {
      const v = p[PWR[k][0]]; if (v <= 0) continue;
      this.bubble(c, k, x, H - 22, 10, this.t);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, H - 22, 15, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, v / PWR[k][1])); c.stroke(); x += 36;
    }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const q of this.pops) {
      let sx = q.x - this.camX; const sy = q.y - this.camY; if (this.mods.mirror) sx = W - sx;
      c.globalAlpha = Math.min(1, q.life * 2); c.font = '800 12px ui-monospace, monospace'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeText(q.s, sx, sy); c.fillStyle = q.c; c.fillText(q.s, sx, sy);
    }
    if (this.banner.t > 0) {
      const b = this.banner; c.globalAlpha = Math.max(0, Math.min(1, b.t / 0.4, (2.2 - b.t) / 0.3));
      c.font = '800 17px ui-monospace, monospace'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.55)'; c.strokeText(b.s.split('').join(' '), W / 2, 104); c.fillStyle = this.pal.ink; c.fillText(b.s.split('').join(' '), W / 2, 104);
    }
    c.restore();
  }
}
