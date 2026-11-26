// The garden, rebuilt on the Makhana engine: one wide weathered world in tilt-shift 3D with depth of
// field, explored on foot. Drag anywhere for a stick (tap to walk to a spot). Villages of patched
// shacks and a ruined city, roads between, the old garden's country gone feral, the wastes beyond;
// floating islands overhead, reached by rusted lift towers, from which the country below lies far off
// in the haze. Villagers and wanderers are Crystal Sprite people; the giant gardeners stride across it
// all, far bigger than anything else. One menu: the map, the graphics, the way home.
import { Game, W, H } from '../engine.js';
import { Actor } from '../../crystal/sprites.js';
import { getMode } from '../../modes.js';
import * as GL from '../mk/gl.js';
import { mk, hex, mix, clamp, lerp, hash2, RNG } from '../mk/tex.js';
import { World, TS, CS, WT, NC, K_PATH, K_STREET } from './world.js';
import { ChunkVis, IsleVis, pump, pending, blockTex, animalSprites, giantSprites, propSprite } from './scene.js';
import { BIOMES, BIOME_KEYS, FAMILY, ISLES } from './lands.js';
import { paintSky, shadowTex, FAUNA } from './art.js';
import { GFX, GROWS, gfxValue, gfxSet, gfxStep } from './gfx.js';
import { Atmos } from './atmos.js';

const SAVE = 'garden3';
const HOUR = {
  morning: { sky: ['#232c38', '#6e7c88', '#c8b8a0', '#f0d8a8'], fog: [176, 184, 190], fogK: 0.55, tint: ['rgba(60,80,100,.10)', 'rgba(255,236,200,.10)'], shade: [0.96, 0.98, 1.03], dark: 0.3 },
  day: { sky: ['#343e48', '#848e92', '#c0bcac', '#f2ead4'], fog: [158, 162, 158], fogK: 0.4, tint: ['rgba(40,50,40,.08)', 'rgba(255,244,220,.07)'], shade: [1, 1, 1], dark: 0.12 },
  evening: { sky: ['#12101c', '#46303c', '#a8583a', '#ffae5c'], fog: [92, 70, 80], fogK: 0.5, tint: ['rgba(40,20,50,.2)', 'rgba(255,140,70,.10)'], shade: [0.9, 0.8, 0.8], dark: 0.85 }
};
const SPEED = { rat: 34, deer: 28, boar: 22, hound: 32, horse: 26, cattle: 12, goat: 22, lizard: 26, beetle: 10, heron: 8, crow: 20, moth: 16 };
const FLIERS = { crow: 1, moth: 1 };
const STICK_R = 40, HERO = 74, ERA = ['Present day', 'Fantasy'];
const DIRS8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

let WORLD = null;
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch { return null; } }
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 4096) s += String.fromCharCode(...u8.subarray(i, i + 4096)); return btoa(s); }
function unb64(s, n) { const u = new Uint8Array(n); try { const t = atob(s); for (let i = 0; i < Math.min(n, t.length); i++) u[i] = t.charCodeAt(i); } catch { /* fresh */ } return u; }

// Crystal people are graded darker and less saturated for the garden's weathered light, a frame at a
// time as it is copied into the frame texture
function grade(cv) {
  const x = cv.getContext('2d', { willReadFrequently: true }), img = x.getImageData(0, 0, cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, n = (((i * 2654435761) >>> 24) & 15) - 7; for (let k = 0; k < 3; k++) d[i + k] = clamp((l + (d[i + k] - l) * 0.72) * 0.9 + 4 + n, 0, 255); }
  x.putImageData(img, 0, 0);
}
// one texture of 42-px slots that the people's current frames are copied into as they change
class ActorTex {
  constructor() { this.S = 512; this.N = 12; this.tex = GL.texNew(this.S, this.S, null); this.cv = mk(40, 40); this.free = Array.from({ length: this.N * this.N }, (_, i) => i).reverse(); this.last = new Map(); }
  take() { return this.free.length ? this.free.pop() : -1; }
  give(s) { if (s >= 0) { this.free.push(s); this.last.delete(s); } }
  rect(slot, sheet, anim, dir, f) {
    const sx = (slot % this.N) * 42 + 1, sy = Math.floor(slot / this.N) * 42 + 1, A = sheet.meta.animations[anim] || sheet.meta.animations.idle;
    let row = A.rows[dir]; if (row === undefined) row = A.rows.S ?? Object.values(A.rows)[0]; const fr = Math.max(0, Math.min(A.frames - 1, f | 0)), key = `${sheet.seed}|${row}|${fr}`;
    if (this.last.get(slot) !== key) { const x = this.cv.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, 40, 40); x.drawImage(sheet.cv, fr * 40, row * 40, 40, 40, 0, 0, 40, 40); grade(this.cv); GL.texSub(this.tex, sx, sy, this.cv); this.last.set(slot, key); }
    return [sx / this.S, sy / this.S, 40 / this.S, 40 / this.S];
  }
}

export class Garden extends Game {
  constructor(canvas, post) { super(canvas, { ...post, mods: [] }); }
  static state() { return Garden.active?.debug(); }
  setup() {
    this.mode = ['morning', 'day', 'evening'].includes(this.post.mode) ? this.post.mode : getMode();
    const s = loadSave(); const seed = s?.seed || ((Date.now() ^ 0x5eed) >>> 0);
    if (!WORLD || WORLD.seed !== seed) WORLD = new World(seed);
    const Wd = this.W = WORLD;
    this.explored = s?.ex ? unb64(s.ex, NC * NC) : new Uint8Array(NC * NC);
    const isle = s && s.isle >= 0 ? Wd.isles[s.isle] : null;
    this.P = { x: s?.x ?? Wd.start.x, y: s?.y ?? Wd.start.y, h: isle ? isle.h : 0, isle, actor: new Actor(this.skin.crystal(0, 'Present day'), { walkSpeed: 7.5, runSpeed: 55, walkStride: 5, runStride: 6.5 }), armed: false, goal: null, stuck: 0 };
    if (Wd.solidAt(this.P.x, this.P.y, isle)) Object.assign(this.P, { x: Wd.start.x, y: Wd.start.y, isle: null, h: 0 });
    this.cam = { x: this.P.x, y: this.P.y, h: this.P.h };
    this.vis = new Map(); this.ivis = new Map(); this.npcs = []; this.beasts = []; this.fx = []; this.toasts = []; this.atmos = new Atmos();
    this.giants = this.makeGiants(); this.ui = null; this.uiS = 0; this.press = null; this.stick = null; this.ride = null; this.t0 = 0; this.frameN = 0; this.saveT = 0; this.spawnT = 0;
    this.fogC = null; this.fogA = 0.2; this.lastPlace = ''; this.placeT = 0; this.mapCv = null; this.mapRow = 0; this.autoT = 0;
    this.autoOK = true;
  }
  debug() { return { x: this.P.x, y: this.P.y, isle: this.P.isle?.i ?? -1, chunks: [...this.vis.values()].filter((v) => v.lod >= 0).length, pending: pending(), beasts: this.beasts.length, npcs: this.npcs.length, giants: this.giants.map((g) => [g.x | 0, g.y | 0]), ride: !!this.ride, ui: this.ui, place: this.lastPlace }; }
  start() { super.start(); Garden.active = this; }
  stop() { this.save(); super.stop(); this.release(); }
  // off screen: give the GPU back its chunk textures, buffers and the people's frame texture (rebuilt on return)
  release() {
    for (const v of this.vis.values()) v.free(); this.vis.clear();
    for (const v of this.ivis.values()) v.free(); this.ivis.clear();
    if (this.actorTex) { GL.texFree(this.actorTex.tex); this.actorTex = null; this.heroSlot = undefined; for (const n of this.npcs) n.slot = -1; }
    if (this.skies) { for (const t of this.skies.values()) GL.texFree(t); this.skies = null; }
  }
  hud() { return ''; }
  save() {
    if (Garden.active !== this) return;
    try { localStorage.setItem(SAVE, JSON.stringify({ seed: this.W.seed, x: Math.round(this.P.x), y: Math.round(this.P.y), isle: this.ride ? -1 : this.P.isle ? this.P.isle.i : -1, ex: b64(this.explored) })); } catch { /* full */ }
  }

  // ------------------------------------------------ the giants: three, in the green and the rust
  makeGiants() {
    const r = RNG(this.W.seed ^ 0x61a7), out = [];
    for (let i = 0; i < 3; i++) { const R = this.W.giantHome[i % 2]; const x = lerp(R[0], R[2], r.f()) * WT * TS, y = lerp(R[1], R[3], r.f()) * WT * TS; out.push({ v: i, x, y, tx: x, ty: y, dir: 1, f: 0, ft: 0, wait: 0 }); }
    // one of them not far off, so the first walk sees one
    const g = out[0]; g.x = this.P.x - 900 + r.f() * 300; g.y = this.P.y - 700 - r.f() * 200; g.tx = this.P.x + 400; g.ty = this.P.y - 300;
    return out;
  }
  stepGiants(dt) {
    for (const g of this.giants) {
      if (g.wait > 0) { g.wait -= dt; continue; }
      const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
      if (d < 20) { const R = this.W.giantHome[g.v % 2]; g.tx = lerp(R[0], R[2], Math.random()) * WT * TS; g.ty = lerp(R[1], R[3], Math.random()) * WT * TS; g.wait = 4 + Math.random() * 8; continue; }
      const sp = 10; g.x += (dx / d) * sp * dt; g.y += (dy / d) * sp * dt; g.dir = dx >= 0 ? 1 : -1;
      if ((g.ft += dt) > 0.7) { g.ft = 0; g.f = (g.f + 1) % 4; if (g.f % 2 === 0 && Math.hypot(g.x - this.P.x, g.y - this.P.y) < 500) for (let k = 0; k < 8; k++) this.fx.push({ k: 'dust', x: g.x + (Math.random() - 0.5) * 40, y: g.y + (Math.random() - 0.5) * 10, h: 2, vx: (Math.random() - 0.5) * 30, vh: 10 + Math.random() * 20, t: 0, life: 1.2 }); }
    }
  }

  // ------------------------------------------------ input: the menu first, then a stick or a tap
  uiHit(x, y) { return Math.hypot(x - (W - 24), y - 24) < 20; }
  down(x, y) {
    if (this.auto) this.setAuto(false);
    if (this.ui) { this.uiPress = { x, y, sy: y, s: this.uiS, moved: 0, drag: null }; this.uiDown(x, y); return; }
    if (this.uiHit(x, y)) { this.ui = 'menu'; return; }
    this.press = { x, y, t: performance.now(), moved: 0, lx: x, ly: y };
  }
  move(x, y) {
    if (this.ui) { this.uiMove(x, y); return; }
    const p = this.press; if (!p) return;
    p.moved += Math.abs(x - p.lx) + Math.abs(y - p.ly); p.lx = x; p.ly = y;
    if (!this.stick && p.moved > 8) { this.stick = { ox: p.x, oy: p.y, x, y }; this.P.goal = null; }
    if (this.stick) { const s = this.stick, dx = x - s.ox, dy = y - s.oy, d = Math.hypot(dx, dy); if (d > STICK_R) { s.ox = x - (dx / d) * STICK_R; s.oy = y - (dy / d) * STICK_R; } s.x = x; s.y = y; }
  }
  up(x, y) {
    if (this.ui) { this.uiUp(x, y); return; }
    const p = this.press; this.press = null;
    if (this.stick) { this.stick = null; return; }
    if (p && p.moved < 10 && performance.now() - p.t < 450) this.tapWorld(x, y);
  }
  tapWorld(x, y) {
    const v = this.view; if (!v || this.ride) return;
    const sx = (x / W) * v.VW, sy = (y / H) * v.VH, P = this.P, base = P.isle ? P.isle.h : 0;
    // a person under the finger turns and greets you
    for (const n of this.npcs) { if (n.isle !== P.isle) continue; const [nx, ny] = v.PJ(n.x, n.y, 18, base); if (Math.abs(nx - sx) < 10 && Math.abs(ny - sy) < 16) { n.actor.face(this.faceTo(n, P)); n.actor.emote(Math.random() < 0.5 ? 'wave' : 'nod', 1.4); n.wait = 2.5; n.goal = null; return; } }
    const g = GL.unproject(sx, sy, base); if (!g) return;
    P.goal = { x: g[0], y: g[1] }; P.stuck = 0;
  }
  faceTo(a, b) { const ang = Math.atan2(b.y - a.y, b.x - a.x); return DIRS8[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8]; }

  // ------------------------------------------------ walking, with feet that slide along walls
  blocked(x, y, isle) { const Wd = this.W; return Wd.solidAt(x - 4, y - 3, isle) || Wd.solidAt(x + 4, y - 3, isle) || Wd.solidAt(x - 4, y, isle) || Wd.solidAt(x + 4, y, isle); }
  walk(e, dx, dy) { let moved = 0; if (dx && !this.blocked(e.x + dx, e.y, e.isle)) { e.x += dx; moved += Math.abs(dx); } if (dy && !this.blocked(e.x, e.y + dy, e.isle)) { e.y += dy; moved += Math.abs(dy); } return moved; }
  step(dt) {
    const P = this.P, Wd = this.W;
    this.t0 += dt;
    if (this.ride) this.stepRide(dt);
    else {
      let vx = 0, vy = 0;
      if (this.stick && !this.ui) { const s = this.stick, dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy); if (d > 4) { const k = Math.min(1, d / STICK_R); vx = (dx / d) * HERO * (0.35 + k * 0.85); vy = (dy / d) * HERO * (0.35 + k * 0.85); } }
      else if (P.goal) {
        const dx = P.goal.x - P.x, dy = P.goal.y - P.y, d = Math.hypot(dx, dy);
        // no nearer for two seconds: give up on it (the autopilot picks somewhere else)
        if (P.goal.best === undefined || d < P.goal.best - 4) { P.goal.best = d; P.goal.bt = 0; } else if ((P.goal.bt += dt) > 2) { P.goal = null; P.stuck = 9; }
        if (P.goal) { if (d < 6) P.goal = null; else { vx = (dx / d) * HERO; vy = (dy / d) * HERO; } }
      }
      if (vx || vy) {
        let m = this.walk(P, vx * dt, vy * dt);
        // blocked: try round it
        if (m < Math.hypot(vx, vy) * dt * 0.3) { const a = Math.atan2(vy, vx), sp = Math.hypot(vx, vy) * dt; for (const da of [0.6, -0.6, 1.2, -1.2]) { m = this.walk(P, Math.cos(a + da) * sp, Math.sin(a + da) * sp); if (m > sp * 0.4) break; } } else if (P.stuck < 9) P.stuck = 0;
      }
      P.actor.update(dt, { vx, vy });
      this.checkLifts();
    }
    // the world round the walker
    this.stepGiants(dt); this.stepBeasts(dt); this.stepNPCs(dt);
    for (const f of this.fx) { f.t += dt; f.x += (f.vx || 0) * dt; f.h = Math.max(0, f.h + (f.vh || 0) * dt); f.vh = (f.vh || 0) - 30 * dt; } this.fx = this.fx.filter((f) => f.t < f.life);
    if ((this.spawnT -= dt) <= 0) { this.spawnT = 0.5; this.spawn(); this.markExplored(); this.place(); }
    for (const t of this.toasts) t.t += dt; this.toasts = this.toasts.filter((t) => t.t < 4.5);
    if ((this.saveT += dt) > 10) { this.saveT = 0; this.save(); }
  }
  // the autopilot: wander from place to place, sometimes up a lift and back down
  autopilot(dt) {
    const P = this.P, Wd = this.W; if (this.ride || this.ui) return;
    this.autoT += dt;
    if (P.goal && this.autoT < 40) return;
    if (!P.goal && P.stuck < 9 && (this.idleT = (this.idleT || 0) + dt) < 1.5 + Math.random() * 3) return;   // a pause between walks
    this.autoT = 0; this.idleT = 0; P.stuck = 0; const r = Math.random;
    if (P.isle) { if (r() < 0.45) { const pd = P.isle.pad; P.goal = { x: pd.x * TS + 8, y: pd.y * TS + 16 }; } else { const a = r() * 6.283, d = r() * P.isle.rad * 0.6 * TS; P.goal = { x: P.isle.x * TS + Math.cos(a) * d, y: P.isle.y * TS + Math.sin(a) * d }; } return; }
    const tx = P.x / TS, ty = P.y / TS;
    if (r() < 0.25) { const I = Wd.isles.reduce((b, I2) => (Math.hypot(I2.lift.x - tx, I2.lift.y - ty) < Math.hypot(b.lift.x - tx, b.lift.y - ty) ? I2 : b)); if (Math.hypot(I.lift.x - tx, I.lift.y - ty) < 70) { P.goal = { x: I.lift.x * TS + 8, y: I.lift.y * TS + 14 }; P.armed = true; return; } }
    if (r() < 0.35) { const V = Wd.villages.filter((v) => Math.hypot(v.x - tx, v.y - ty) > 6).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[Math.floor(r() * 2)]; if (V && Math.hypot(V.x - tx, V.y - ty) < 90) { P.goal = { x: V.x * TS + 8, y: (V.y + 2) * TS }; return; } }
    for (let k = 0; k < 20; k++) { const a = r() * 6.283, d = (8 + r() * 16) * TS, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d * 0.8; if (!this.blocked(x, y, null)) { P.goal = { x, y }; return; } }
  }

  // ------------------------------------------------ lifts: walk into the cage and up you go
  checkLifts() {
    const P = this.P, Wd = this.W;
    if (P.isle) { const pd = P.isle.pad, d = Math.hypot(P.x - (pd.x * TS + 8), P.y - (pd.y * TS + 14)); if (d > 30) P.armed = true; else if (d < 12 && P.armed) this.startRide(P.isle, false); return; }
    for (const I of Wd.isles) { const L = I.lift, d = Math.hypot(P.x - (L.x * TS + 8), P.y - (L.y * TS + 14)); if (d > 900) continue; if (d > 40) { if (d < 140) P.armed = true; continue; } if (d < 18 && P.armed) { this.startRide(I, true); return; } }
  }
  startRide(I, up) {
    const P = this.P, L = I.lift, pd = I.pad, from = up ? { x: L.x * TS + 8, y: L.y * TS + 14, h: 0 } : { x: pd.x * TS + 8, y: pd.y * TS + 14, h: I.h }, to = up ? { x: pd.x * TS + 8, y: pd.y * TS + 22, h: I.h } : { x: L.x * TS + 8, y: L.y * TS + 24, h: 0 };
    this.ride = { I, up, t: 0, dur: 4.2, from, to }; P.goal = null; this.stick = null; P.isle = null; P.actor.face('S');
  }
  stepRide(dt) {
    const R = this.ride, P = this.P; R.t += dt; const u = clamp(R.t / R.dur, 0, 1), e = u * u * (3 - 2 * u), m = clamp((u - 0.1) / 0.8, 0, 1), em = m * m * (3 - 2 * m);
    P.x = lerp(R.from.x, R.to.x, em); P.y = lerp(R.from.y, R.to.y, em); P.h = lerp(R.from.h, R.to.h, e); P.actor.update(dt, { vx: 0, vy: 0 });
    if (u >= 1) { P.isle = R.up ? R.I : null; P.h = R.up ? R.I.h : 0; P.armed = false; this.ride = null; if (R.up) this.toast(ISLES[R.I.kind].name); }
  }

  // ------------------------------------------------ the living: beasts, villagers, wanderers
  spawn() {
    const P = this.P, Wd = this.W, r = Math.random, ptx = P.x / TS, pty = P.y / TS;
    // beasts: keep a dozen or so near, of the country's kinds
    this.beasts = this.beasts.filter((b) => Math.hypot(b.x - P.x, b.y - P.y) < 30 * TS && b.isle === P.isle);
    const want = P.isle ? 3 : 14;
    for (let k = 0; k < 3 && this.beasts.length < want; k++) {
      const a = r() * 6.283, d = (10 + r() * 9) * TS, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
      if (this.blocked(x, y, P.isle)) continue;
      const B = P.isle ? null : BIOMES[BIOME_KEYS[Wd.biomeAt(Math.floor(x / TS), Math.floor(y / TS))]], kind = P.isle ? (r() < 0.5 ? 'crow' : 'moth') : B.fauna[Math.floor(r() * B.fauna.length)], fam = P.isle ? ISLES[P.isle.kind].fam : B.fam;
      const n = kind === 'crow' ? 2 + Math.floor(r() * 4) : kind === 'cattle' || kind === 'goat' || kind === 'deer' ? 1 + Math.floor(r() * 3) : 1;
      for (let q = 0; q < n; q++) { const bx = x + (r() - 0.5) * 30, by = y + (r() - 0.5) * 20; if (!this.blocked(bx, by, P.isle)) this.beasts.push({ k: kind, fam, x: bx, y: by, isle: P.isle, dir: r() < 0.5 ? 1 : -1, f: r() * 4, wait: r() * 3, tx: bx, ty: by, alt: kind === 'moth' ? 14 + r() * 14 : 0, flee: 0 }); }
    }
    // villagers in the villages near you, a few wanderers on the roads, scavengers in the city
    const AT = this.actorTex;
    const drop = (n) => { if (AT) AT.give(n.slot); };
    this.npcs = this.npcs.filter((n) => { const keep = n.isle === P.isle && Math.hypot(n.x - P.x, n.y - P.y) < 46 * TS; if (!keep) drop(n); return keep; });
    if (!P.isle) {
      for (const v of Wd.villages) {
        if (Math.hypot(v.x - ptx, v.y - pty) > 34 || this.npcs.some((n) => n.home === v)) continue;
        const rr = RNG(v.seed ^ 0x77), cnt = rr.int(3, 5);
        for (let i = 0; i < cnt; i++) for (let t = 0; t < 12; t++) { const x = (v.x + rr.range(-v.rad, v.rad)) * TS, y = (v.y + rr.range(-v.rad, v.rad)) * TS; if (!this.blocked(x, y, null)) { this.addNPC(x, y, v, (v.seed + i * 7) >>> 0); break; } }
      }
      const C = Wd.city; if (Wd.inCity(ptx, pty, 20) && this.npcs.filter((n) => n.home === C).length < 4) for (let t = 0; t < 10; t++) { const x = (C.x0 + r() * (C.x1 - C.x0)) * TS, y = (C.y0 + r() * (C.y1 - C.y0)) * TS; if (Math.hypot(x - P.x, y - P.y) < 30 * TS && !this.blocked(x, y, null)) { this.addNPC(x, y, C, (Math.random() * 1e9) >>> 0); break; } }
      if (this.npcs.filter((n) => n.road).length < 2) for (let t = 0; t < 10; t++) { const a = r() * 6.283, d = (14 + r() * 10) * TS, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d; if (Wd.roads.near(x / TS, y / TS)[0] < 0 && !this.blocked(x, y, null)) { this.addNPC(x, y, null, (Math.random() * 1e9) >>> 0, true); break; } }
    }
  }
  addNPC(x, y, home, seed, road = false) {
    const era = ERA[seed % 2], actor = new Actor(this.skin.crystal(1 + (seed % 89), era), { walkSpeed: 7.5, runSpeed: 55, walkStride: 5, runStride: 6.5 });
    this.npcs.push({ x, y, home, road, isle: null, actor, slot: this.actorTex ? this.actorTex.take() : -1, wait: Math.random() * 3, goal: null, sp: 26 + Math.random() * 12 });
  }
  stepNPCs(dt) {
    const P = this.P, Wd = this.W, r = Math.random;
    for (const n of this.npcs) {
      let vx = 0, vy = 0;
      if (n.wait > 0) n.wait -= dt;
      else if (!n.goal) {
        if (n.road) { const a = r() * 6.283; for (let k = 0; k < 8; k++) { const x = n.x + Math.cos(a + k * 0.8) * 6 * TS, y = n.y + Math.sin(a + k * 0.8) * 6 * TS; if (Wd.roads.near(x / TS, y / TS)[0] < 0.5) { n.goal = { x, y }; break; } } }
        else if (n.home) { const h = n.home, cx = h.x !== undefined && h.rad ? h.x : (h.x0 + h.x1) / 2, cy = h.rad ? h.y : (h.y0 + h.y1) / 2, rad = h.rad || 30; n.goal = { x: (cx + (r() - 0.5) * 2 * rad) * TS, y: (cy + (r() - 0.5) * 2 * rad) * TS }; }
        n.wait = 0;
        if (!n.goal) n.wait = 2;
      } else {
        const dx = n.goal.x - n.x, dy = n.goal.y - n.y, d = Math.hypot(dx, dy);
        if (d < 6) { n.goal = null; n.wait = 2 + r() * 5; if (r() < 0.25) n.actor.emote(['nod', 'think', 'wave'][Math.floor(r() * 3)], 1.2); }
        else { vx = (dx / d) * n.sp; vy = (dy / d) * n.sp; const m = this.walk(n, vx * dt, vy * dt); if (m < 0.05) { n.goal = null; n.wait = 1; vx = vy = 0; } }
      }
      if (!vx && !vy && Math.hypot(P.x - n.x, P.y - n.y) < 40 && n.wait > 0) n.actor.face(this.faceTo(n, P));
      n.actor.update(dt, { vx, vy });
    }
  }
  stepBeasts(dt) {
    const P = this.P, r = Math.random;
    for (const b of this.beasts) {
      const dP = Math.hypot(P.x - b.x, P.y - b.y), sp = SPEED[b.k] || 20;
      if (FLIERS[b.k]) {
        if (b.k === 'crow') { if (dP < 5 * TS && !b.flee) { b.flee = 1; b.tx = b.x + (b.x - P.x) * 6 + (r() - 0.5) * 200; b.ty = b.y + (b.y - P.y) * 6 - 100; } if (b.flee) { b.alt = Math.min(60, b.alt + 40 * dt); const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1; b.x += (dx / d) * 70 * dt; b.y += (dy / d) * 70 * dt; b.dir = dx >= 0 ? 1 : -1; b.f += dt * 10; continue; } }
        if (b.k === 'moth') { b.f += dt * 12; b.x += Math.cos(this.t0 * 0.7 + b.tx) * 14 * dt; b.y += Math.sin(this.t0 * 0.9 + b.ty) * 10 * dt; b.alt = 18 + Math.sin(this.t0 * 2 + b.tx) * 6; b.dir = Math.cos(this.t0 * 0.7 + b.tx) >= 0 ? 1 : -1; continue; }
      }
      if (!b.flee && dP < 3.5 * TS && b.k !== 'cattle' && b.k !== 'beetle' && b.k !== 'heron') { b.flee = 1.6; const a = Math.atan2(b.y - P.y, b.x - P.x); b.tx = b.x + Math.cos(a) * 6 * TS; b.ty = b.y + Math.sin(a) * 6 * TS; b.wait = 0; }
      if (b.flee > 0) b.flee = Math.max(0, b.flee - dt);
      if (b.wait > 0) { b.wait -= dt; if (b.k === 'crow') b.f = 2 + ((this.t0 * 3 + b.tx) % 2 > 1 ? 1 : 0); continue; }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      if (d < 4) { b.wait = 1 + r() * 4; const a = r() * 6.283, dd = r() * 4 * TS; b.tx = b.x + Math.cos(a) * dd; b.ty = b.y + Math.sin(a) * dd * 0.7; continue; }
      const v = sp * (b.flee ? 2.4 : 1), m = this.walk(b, (dx / d) * v * dt, (dy / d) * v * dt); if (m < 0.05) { b.tx = b.x; b.ty = b.y; }
      b.dir = dx >= 0 ? 1 : -1; b.f += dt * v * 0.18;
    }
  }

  // ------------------------------------------------ where you are: explored chunks, names
  markExplored() { if (this.P.isle) return; const cx = Math.floor(this.P.x / (CS * TS)), cy = Math.floor(this.P.y / (CS * TS)); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = cx + i, y = cy + j; if (x >= 0 && y >= 0 && x < NC && y < NC) this.explored[y * NC + x] = 1; } }
  place() {
    const P = this.P, Wd = this.W; if (this.ride) return;
    let name = P.isle ? ISLES[P.isle.kind].name : '';
    if (!P.isle) { const v = Wd.villageAt(P.x / TS, P.y / TS, 2); name = v ? v.name : Wd.inCity(P.x / TS, P.y / TS) ? 'The Ruined City' : Wd.biomeName(P.x, P.y); }
    if (name !== this.pend) { this.pend = name; this.pendT = 0; } else if ((this.pendT += 0.5) >= 1 && name !== this.lastPlace) { this.lastPlace = name; this.toast(name); }
  }
  toast(s) { this.toasts = this.toasts.filter((t) => t.s !== s); this.toasts.push({ s, t: 0 }); }

  // ------------------------------------------------ drawing
  draw(c) {
    this.frameN++;
    if (GFX.fps === 30 && this.frameN % 2 && this.view) return;
    const R = GL.renderer();
    if (!R || GL.glLost()) { c.fillStyle = '#0b0d0a'; c.fillRect(0, 0, W, H); c.fillStyle = '#9ca09a'; c.font = '13px ui-monospace, monospace'; c.fillText('the garden needs WebGL', 20, 40); return; }
    this.actorTex ||= new ActorTex(); for (const n of this.npcs) if (n.slot < 0) n.slot = this.actorTex.take();
    if (this.heroSlot === undefined) this.heroSlot = this.actorTex.take();
    const P = this.P, Wd = this.W, hour = HOUR[this.mode] || HOUR.day;
    const K = GL.setLens(GFX.pitch, GFX.fov), VW = Math.round(GFX.zoom), VH = Math.round((VW * H) / W);
    // the camera follows, lifting with the ride
    const cam = this.cam, base = P.h; cam.x += (P.x - cam.x) * 0.12; cam.y += (P.y - cam.y) * 0.12; cam.h += (base - cam.h) * 0.2;
    const hi = clamp(cam.h / 160, 0, 1), far = lerp(6, 10, hi), fogR = [lerp(0.95, 1.7, hi), lerp(1.9, 6.5, hi)];
    const PJ = GL.camSetup(VW, VH, Math.round(cam.x), cam.h, Math.round(cam.y), VH * 0.56, far);
    const prev = this.view; this.view = { VW, VH, PJ };
    // fog and sky follow the country you are in, and the hour
    const B = P.isle ? null : BIOMES[BIOME_KEYS[Wd.biomeAt(Math.floor(P.x / TS), Math.floor(P.y / TS))]], fam = P.isle ? ISLES[P.isle.kind].fam : B.fam, bf = hex(P.isle ? '#9aa4a8' : B.fog[0]);
    const fogT = mix(bf, hour.fog, hour.fogK), fogAT = (P.isle ? 0.12 : B.fog[1]) + 0.1;
    this.fogC = this.fogC ? mix(this.fogC, fogT, 0.03) : fogT; this.fogA += (fogAT - this.fogA) * 0.03;
    const sky = this.sky(fam, hour);
    const PF = globalThis.GPROF, pt = (k) => { if (PF) { const n = performance.now(); PF[k] = (PF[k] || 0) + n - (PF._t || n); PF._t = n; } }; pt('_start'); if (PF) PF._t = performance.now();
    // build and stream what can be seen
    const budget = this.vis.size < 4 ? 16 : 7, t0 = performance.now();
    const need = this.visible(VW, VH, cam);
    for (const v of need) { if (performance.now() - t0 > budget) break; v.update(v.wantLod); }
    pump(Math.max(2, budget - (performance.now() - t0)));
    pt('stream');
    // islands near enough to be seen (or stood on)
    const isles = Wd.isles.filter((I) => I === P.isle || (this.ride && this.ride.I === I) || Math.hypot(I.x * TS - cam.x, I.y * TS - cam.y) < 1400);
    for (const I of isles) { let iv = this.ivis.get(I.i); if (!iv) this.ivis.set(I.i, (iv = new IsleVis(Wd, I))); iv.update(); }
    // ---- the 3D pass
    GL.glBegin(VW, VH, GFX.scale, this.fogC); GL.glScreen(sky, null, GFX);
    GL.glMain(this.fogC, this.fogA * 2.2, GFX, fogR, hour.shade, lerp(3, 7, hi));
    pt('isles+sky');
    const bt = blockTex(), atlas = GL.atlasTex();
    for (const v of need) if (v.lod >= 0) GL.glDraw(v.gBuf, v.gN, v.tex);
    for (const v of need) if (v.bN) GL.glDraw(v.bBuf, v.bN, bt);
    // props near the walker are drawn each frame instead, so the ones between you and the camera can thin out
    const pcx = P.x / (CS * TS), pcy = P.y / (CS * TS), nearV = need.filter((v) => !P.isle && Math.abs(v.cx + 0.5 - pcx) < 1.6 && Math.abs(v.cy + 0.5 - pcy) < 1.6 && v.props);
    for (const v of need) if (v.pN && !nearV.includes(v)) GL.glDraw(v.pBuf, v.pN, atlas);
    for (const I of isles) { const iv = this.ivis.get(I.i); if (!iv?.ok) continue; GL.glDraw(iv.gBuf, iv.gN, iv.tex); GL.glDraw(iv.bBuf, iv.bN, bt); if (iv.pN) GL.glDraw(iv.pBuf, iv.pN, atlas); }
    // the living, as billboards (people from their own frame texture)
    this.bat ||= { m: new GL.Batch(2048), s: new GL.Batch(512), a: new GL.Batch(512), g: new GL.Batch(64), bm: GL.newBuffer(), bs: GL.newBuffer(), ba: GL.newBuffer(), bg: GL.newBuffer() };
    const BM = this.bat.m, BS = this.bat.s, BA = this.bat.a, BG = this.bat.g; BM.reset(); BS.reset(); BA.reset(); BG.reset(); this.BG = BG;
    const sinP = Math.sin((GFX.pitch * Math.PI) / 180);
    for (const v of nearV) for (const p of v.props) {
      const sp = propSprite(p.type, p.fam, p.v); if (!sp) continue; const dz = p.y - P.y, dx = Math.abs(p.x - P.x);
      const cover = dz > 2 && dz < (sp.height * 1.05) / Math.max(0.15, sinP) && dx < sp.width / 2 + 7;
      BM.bb(sp, 0, 0, sp.width, sp.height, p.x, p.y, -1.5, K, 1, cover ? 0.3 : 1);
    }
    pt('static');
    const lights = this.entities(BM, BS, BA, K, PJ, cam);
    pt('entities');
    const nS = BS.upload(this.bat.bs), nM = BM.upload(this.bat.bm), nA = BA.upload(this.bat.ba);
    GL.glDraw(this.bat.bs, nS, GL.atlasTex(), true); GL.glDraw(this.bat.bm, nM, GL.atlasTex()); GL.glDraw(this.bat.ba, nA, this.actorTex.tex);
    // the giants loom out of the haze: drawn with a thinner fog, so they are seen from far off
    const nG = BG.upload(this.bat.bg); if (nG) { GL.glMain(this.fogC, this.fogA * 0.8, GFX, [fogR[0] * 1.8, fogR[1] * 2.6], hour.shade, lerp(3, 7, hi) * 2.4); GL.glDraw(this.bat.bg, nG, GL.atlasTex()); }
    const out = GL.glEnd({ band: GFX.band, max: GFX.blur, sat: GFX.sat, focus: GFX.focus, depthSpan: lerp(3, 7, hi) }, GFX);
    pt('glsubmit');
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(out, 0, 0, W, H);
    pt('present');
    // ---- the air, in view pixels
    c.scale(W / VW, H / VH);
    const dcx = prev ? (cam.x - (this.lastCam?.x ?? cam.x)) : 0, dcy = prev ? (cam.y - (this.lastCam?.y ?? cam.y)) : 0; this.lastCam = { x: cam.x, y: cam.y };
    const motes = P.isle ? (this.mode === 'evening' ? 'fireflies' : 'haze') : B.motes;
    this.atmos.update(1 / 60, motes, VW, VH, dcx, dcy);
    this.atmos.lights(c, lights, hour.dark);
    for (const [x, y, a] of this.dustPts || []) { c.fillStyle = `rgba(200,190,170,${(a * 0.5).toFixed(2)})`; c.fillRect(Math.round(x), Math.round(y), 2, 1); }
    this.atmos.draw(c, VW, VH, cam.x, cam.y, this.fogC, this.fogA, motes, hour.tint);
    c.restore();
    pt('overlay');
    this.drawUI(c);
  }
  // which chunks the view needs, and at what level of detail (the camera's footprint on the ground)
  visible(VW, VH, cam) {
    const pts = []; for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) { const g = GL.unproject((i / 4) * VW, (j / 4) * VH, 0); if (g) pts.push(g); }
    const D = GL.camD(), maxd = D * (cam.h > 40 ? 8 : 4.2);
    let x0 = cam.x - 200, x1 = cam.x + 200, y0 = cam.y - 200, y1 = cam.y + 120;
    for (const [x, y] of pts) { const dx = x - cam.x, dy = y - cam.y, d = Math.hypot(dx, dy), k = d > maxd ? maxd / d : 1; const X = cam.x + dx * k, Y = cam.y + dy * k; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    const S = CS * TS, cx0 = Math.max(0, Math.floor(x0 / S) - 1), cx1 = Math.min(NC - 1, Math.floor(x1 / S) + 1), cy0 = Math.max(0, Math.floor(y0 / S) - 1), cy1 = Math.min(NC - 1, Math.floor(y1 / S) + 1);
    const g0 = GL.unproject(VW / 2, VH * 0.56, 0) || [cam.x, cam.y], fx = cam.h > 40 ? g0[0] : cam.x, fy = cam.h > 40 ? g0[1] : cam.y, out = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * 1000 + cx; let v = this.vis.get(key); if (!v) this.vis.set(key, (v = new ChunkVis(this.W, cx, cy)));
      const d = Math.hypot((cx + 0.5) * S - fx, (cy + 0.5) * S - fy) / S; v.wantLod = d < 1.6 ? 0 : d < 3.2 ? 1 : 2; v.d = d; v.used = this.frameN; out.push(v);
    }
    out.sort((a, b) => a.d - b.d);
    if (this.vis.size > 120) for (const [k, v] of [...this.vis].sort((a, b) => a[1].used - b[1].used)) { if (this.vis.size <= 90) break; if (v.used < this.frameN - 30) { v.free(); this.vis.delete(k); } }
    return out;
  }
  // sky textures, per family and hour
  sky(fam, hour) {
    this.skies ||= new Map(); const key = `${fam}|${this.mode}`; let s = this.skies.get(key);
    if (!s) { const f = FAMILY[fam].pal, low = hour.sky[2]; s = GL.texNew(256, 160, paintSky(256, 160, hour.sky[0], hour.sky[1], low, hour.sky[3], this.W.seed % 97, 4), false, true); this.skies.set(key, s); }
    return s;
  }
  // billboards for everything alive; returns the lights to glow in the overlay
  entities(BM, BS, BA, K, PJ, cam) {
    const P = this.P, lights = [], near = (x, y, r = 520) => Math.abs(x - cam.x) < r && y > cam.y - r * 1.6 && y < cam.y + 220, AT = this.actorTex;
    const person = (actor, slot, x, y, base, scale = 1) => { const sh = actor.sheet; if (!sh?.ok || slot < 0) return; const r = AT.rect(slot, sh, actor.anim, actor.dir, actor.s.frame); BS.gd(shadowTex(14, 5), x, y, 14, 5, base + 0.4); BA.bbr(r, 40, 40, x, y, base - 3 * K * scale, K, 1, 1, scale); };
    // the walker (and the lift platform under them on a ride)
    if (this.ride) { const s = propSprite('liftpad', 'rust', 0); if (s) BM.bb(s, 0, 0, s.width, s.height, P.x, P.y + 4, P.h - 6, K, 1, 1); lights.push([...PJ(P.x, P.y, 20, P.h).slice(0, 2), 26, [255, 180, 90], 0.9]); }
    person(P.actor, this.heroSlot, P.x, P.y, P.h);
    for (const n of this.npcs) if (n.isle === P.isle && near(n.x, n.y)) person(n.actor, n.slot, n.x, n.y, P.isle ? P.isle.h : 0);
    // beasts
    for (const b of this.beasts) {
      if (!near(b.x, b.y)) continue; const fr = animalSprites(b.k, b.fam); if (!fr) continue; const base = b.isle ? b.isle.h : 0, F = fr[Math.floor(b.f) % 4] || fr[0], s = b.dir >= 0 ? F.r : F.l;
      if (!b.alt) BS.gd(shadowTex(s.width < 16 ? 10 : 20, s.width < 16 ? 4 : 6), b.x, b.y, s.width * 0.8, 5, base + 0.4);
      BM.bb(s, 0, 0, s.width, s.height, b.x, b.y, base + b.alt * K, K, 1, 1);
      if (b.k === 'moth' && FAUNA.moth.glow) lights.push([...PJ(b.x, b.y, b.alt + 6, base).slice(0, 2), 12, [230, 210, 120], 0.6]);
    }
    // the giants: huge, and seen from far
    for (const g of this.giants) {
      if (Math.abs(g.x - cam.x) > 1100 || g.y < cam.y - 1900 || g.y > cam.y + 400) continue; const fr = giantSprites(g.v % 2); if (!fr) continue; const s = g.dir >= 0 ? fr[g.f].r : fr[g.f].l, sc = 1.7;
      BS.gd(shadowTex(30, 9), g.x, g.y, 110, 26, 0.4); this.BG.bb(s, 0, 0, s.width, s.height, g.x, g.y, -2, K, 1, 1, undefined, 0, sc);
      lights.push([...PJ(g.x - g.dir * 19 * sc, g.y, 38 * sc, 0).slice(0, 2), 30, [255, 200, 110], 0.8]);   // the lantern
    }
    // dust and footfalls, drawn in the overlay
    this.dustPts = this.fx.map((f) => { const [x, y] = PJ(f.x, f.y, f.h); return [x, y, 1 - f.t / f.life]; });
    // lights from the chunks in view: fires, windows, lamps, lift beacons
    for (const v of this.vis.values()) { if (v.used !== this.frameN || v.lod < 0) continue; const C = this.W.chunk(v.cx, v.cy); for (const L of C.lights) { if (!near(L.x, L.y, 700)) continue; const [x, y] = PJ(L.x, L.y, L.h, 0), fl = L.fire ? 0.8 + Math.sin(this.t0 * 9 + L.x) * 0.15 : L.beacon ? 0.6 + 0.4 * (Math.sin(this.t0 * 3) > 0 ? 1 : 0) : 1; lights.push([x, y, L.r, L.c, fl]); } }
    if (P.isle || this.ride) for (const I of this.W.isles) { const M = this.W.isle(I); for (const L of M.lights) { const [x, y] = PJ(L.x, L.y, L.h, I.h); lights.push([x, y, L.r, L.c, L.beacon ? 0.6 + 0.4 * (Math.sin(this.t0 * 3) > 0 ? 1 : 0) : 1]); } }
    return lights;
  }

  // ------------------------------------------------ the one menu: map, graphics, the way home
  drawUI(c) {
    // the menu button
    c.save(); c.globalAlpha = this.ui ? 0.3 : 0.75; c.fillStyle = 'rgba(12,10,8,.55)'; c.beginPath(); c.arc(W - 24, 24, 15, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(232,220,196,.5)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#e8dcc4'; for (let k = -1; k <= 1; k++) c.fillRect(W - 31, 23 + k * 5, 14, 1.6); c.restore();
    // place names, quietly
    c.save(); c.font = '600 11px ui-monospace, Menlo, monospace'; c.textBaseline = 'top';
    this.toasts.forEach((t, i) => { const a = clamp(Math.min(t.t / 0.6, (4.5 - t.t) / 1.2), 0, 1) * 0.85; c.globalAlpha = a; c.fillStyle = '#000'; c.fillText(t.s.toUpperCase(), 15, 15 + i * 16); c.fillStyle = '#e8dcc4'; c.fillText(t.s.toUpperCase(), 14, 14 + i * 16); });
    c.restore();
    // the stick
    if (this.stick) { const s = this.stick; c.save(); c.globalAlpha = 0.35; c.strokeStyle = '#e8dcc4'; c.lineWidth = 1.5; c.beginPath(); c.arc(s.ox, s.oy, STICK_R, 0, 6.3); c.stroke(); c.globalAlpha = 0.6; c.fillStyle = '#e8dcc4'; c.beginPath(); c.arc(s.x, s.y, 9, 0, 6.3); c.fill(); c.restore(); }
    if (!this.ui) return;
    c.save(); c.fillStyle = 'rgba(8,7,6,.78)'; c.fillRect(0, 0, W, H); c.textBaseline = 'middle';
    const head = (s) => { c.font = '600 15px ui-monospace, Menlo, monospace'; c.fillStyle = '#e8dcc4'; c.fillText(s, 22, 34); c.fillStyle = 'rgba(232,220,196,.25)'; c.fillRect(22, 48, W - 44, 1); };
    this.uiR = [];
    if (this.ui === 'menu') {
      head('THE GARDEN'); const home = this.homeVillage();
      const items = [['map', 'Map'], ['gfx', 'Graphics'], ['home', `Back to ${home.name}`], ['close', 'Close']];
      c.font = '14px ui-monospace, Menlo, monospace';
      items.forEach(([k, s], i) => { const y = 84 + i * 46; c.fillStyle = 'rgba(232,220,196,.08)'; c.fillRect(22, y - 18, W - 44, 36); c.fillStyle = '#e8dcc4'; c.fillText(s, 36, y); this.uiR.push({ k, x: 22, y: y - 18, w: W - 44, h: 36 }); });
      c.fillStyle = 'rgba(232,220,196,.45)'; c.font = '11px ui-monospace, Menlo, monospace'; c.fillText(`${this.lastPlace || ''}`, 22, H - 24);
    } else if (this.ui === 'map') this.drawMap(c, head);
    else if (this.ui === 'gfx') this.drawGfx(c, head);
    c.restore();
  }
  homeVillage() { const Wd = this.W, tx = Wd.start.x / TS, ty = Wd.start.y / TS; return Wd.villages.reduce((b, v) => (Math.hypot(v.x - tx, v.y - ty) < Math.hypot(b.x - tx, b.y - ty) ? v : b)); }
  uiDown(x, y) {
    if (this.ui === 'gfx') { const r = (this.uiR || []).find((q) => y >= q.y && y < q.y + q.h && x >= q.x && x < q.x + q.w); if (r?.slider && x >= r.sx - 6) { this.uiPress.drag = r; this.slide(r, x); } }
  }
  uiMove(x, y) { const p = this.uiPress; if (!p) return; p.moved += Math.abs(y - p.sy); if (p.drag) { this.slide(p.drag, x); return; } if (this.ui === 'gfx' && p.moved > 6) this.uiS = Math.max(0, Math.min(this.uiSMax || 0, p.s - (y - p.sy))); }
  uiUp(x, y) {
    const p = this.uiPress; this.uiPress = null; if (!p || p.drag || p.moved > 8) return;
    const r = (this.uiR || []).find((q) => y >= q.y && y < q.y + q.h && x >= q.x && x < q.x + q.w);
    if (this.ui === 'menu') { if (!r) return; if (r.k === 'close') this.ui = null; else if (r.k === 'home') { const v = this.homeVillage(); Object.assign(this.P, { x: v.x * TS + 8, y: (v.y + v.rad + 2) * TS, isle: null, h: 0, goal: null }); this.cam = { x: this.P.x, y: this.P.y, h: 0 }; this.ui = null; this.toast(v.name); } else { this.ui = r.k; this.uiS = 0; } return; }
    if (this.ui === 'map') { this.ui = 'menu'; return; }
    if (this.ui === 'gfx') { if (!r) return; if (r.k === 'back') { this.ui = 'menu'; return; } const R = GROWS[r.i]; if (R.type === 'choice') gfxStep(R, x < r.x + r.w * 0.75 ? -1 : 1); else if (R.type === 'button') gfxStep(R, 0); }
  }
  slide(r, x) { const R = GROWS[r.i]; gfxSet(R.k, R.min + clamp((x - r.sx) / r.sw, 0, 1) * (R.max - R.min)); }
  drawGfx(c, head) {
    head('GRAPHICS'); const top = 60, rh = 30, x0 = 22, w = W - 44, sx = 150, sw = w - (sx - x0) - 52;
    this.uiSMax = Math.max(0, (GROWS.length + 1) * rh - (H - top - 20));
    c.save(); c.beginPath(); c.rect(0, top, W, H - top - 8); c.clip();
    [...GROWS, { k: 'back', label: 'Back', type: 'button' }].forEach((R, i) => {
      const y = top + i * rh - this.uiS; if (y < top - rh || y > H) return; const cy = y + rh / 2;
      c.font = '12px ui-monospace, Menlo, monospace'; c.fillStyle = R.type === 'button' ? '#f0d08a' : '#cfc3ac'; c.fillText(R.label, x0, cy);
      if (R.type === 'choice') { c.textAlign = 'right'; c.fillStyle = '#f0d08a'; c.fillText(`‹ ${String(gfxValue(R))} ›`, x0 + w, cy); c.textAlign = 'left'; this.uiR.push({ i, k: R.k, x: x0, y, w, h: rh }); }
      else if (R.type === 'button') this.uiR.push({ i, k: R.k, x: x0, y, w, h: rh });
      else { const f = (GFX[R.k] - R.min) / (R.max - R.min); c.fillStyle = 'rgba(232,220,196,.18)'; c.fillRect(sx, cy - 1, sw, 2); c.fillStyle = '#b8955a'; c.fillRect(sx, cy - 1, sw * f, 2); c.fillStyle = '#f0d08a'; c.fillRect(sx + sw * f - 3, cy - 7, 6, 14); c.textAlign = 'right'; c.fillStyle = '#cfc3ac'; c.fillText(R.fmt(GFX[R.k]), x0 + w, cy); c.textAlign = 'left'; this.uiR.push({ i, k: R.k, x: x0, y, w, h: rh, slider: true, sx, sw }); }
    });
    c.restore();
  }
  // the map: the country as far as you have walked it, villages, the city, the islands, the giants
  drawMap(c, head) {
    head('MAP'); const Wd = this.W, N = 160, S = W - 44, ox = 22, oy = 60;
    if (!this.mapCv) { this.mapCv = mk(N, N); this.mapRow = 0; }
    const mx = this.mapCv.getContext('2d'), t0 = performance.now();
    while (this.mapRow < N && performance.now() - t0 < 12) { const y = this.mapRow++; for (let x = 0; x < N; x++) { const tx = x * 4 + 2, ty = y * 4 + 2, t = Wd.tileInfo(tx, ty), B = BIOMES[BIOME_KEYS[t.b]]; let col = B.g[1][0]; if (t.k === 3 || t.k === 7) col = B.fam === 'ash' ? '#24202a' : '#2c4a50'; else if (t.k === 4) col = '#4a4238'; else if (t.k === 8) col = '#5a5a62'; else if (t.k === 9 || t.k === 1 || t.k === 6) col = '#8c765a'; mx.fillStyle = col; mx.fillRect(x, y, 1, 1); } }
    c.imageSmoothingEnabled = false; c.drawImage(this.mapCv, ox, oy, S, S);
    // the unwalked country, dimmed
    // the unwalked country, dimmed: one pixel per chunk, scaled up in one go (no seams)
    this.fogMap ||= mk(NC, NC); const fx2 = this.fogMap.getContext('2d'), fimg = fx2.createImageData(NC, NC); for (let q = 0; q < NC * NC; q++) { fimg.data[q * 4 + 3] = this.explored[q] ? 0 : 184; fimg.data[q * 4] = 8; fimg.data[q * 4 + 1] = 7; fimg.data[q * 4 + 2] = 6; } fx2.putImageData(fimg, 0, 0); c.drawImage(this.fogMap, ox, oy, S, S);
    const at = (x, y) => [ox + (x / WT) * S, oy + (y / WT) * S];
    c.font = '9px ui-monospace, Menlo, monospace'; c.textBaseline = 'middle';
    for (const v of Wd.villages) { const [x, y] = at(v.x, v.y), seen = this.explored[Math.floor(v.y / CS) * NC + Math.floor(v.x / CS)]; c.fillStyle = seen ? '#f0d08a' : 'rgba(240,208,138,.35)'; c.fillRect(x - 1.5, y - 1.5, 3, 3); if (seen) { c.fillStyle = '#e8dcc4'; c.fillText(v.name, x + 4, y); } }
    for (const I of Wd.isles) { const [x, y] = at(I.x, I.y); c.strokeStyle = 'rgba(200,220,230,.55)'; c.beginPath(); c.arc(x, y, (I.rad / WT) * S, 0, 6.3); c.stroke(); }
    for (const g of this.giants) { const [x, y] = at(g.x / TS, g.y / TS); c.fillStyle = 'rgba(160,200,120,.8)'; c.fillRect(x - 1, y - 2, 2, 4); }
    const [px, py] = at(this.P.x / TS, this.P.y / TS); c.fillStyle = '#ff7a3a'; c.beginPath(); c.arc(px, py, 3, 0, 6.3); c.fill(); c.strokeStyle = '#000'; c.stroke();
    c.fillStyle = 'rgba(232,220,196,.5)'; c.font = '10px ui-monospace, Menlo, monospace'; c.fillText('tap to go back', ox, oy + S + 16);
  }
}
