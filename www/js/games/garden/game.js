// The garden, on the Makhana engine: one wide world in tilt-shift 3D with depth of field, explored on
// foot. Drag anywhere for a stick (tap to walk to a spot). The dream's healthy country (meadows, bluebell
// woods, lagoons, blossom hills, lantern fungi) runs into the forgotten one (feral pasture, the wastes,
// the rust belt, the ash, the frost); the ground rolls and climbs to snowy summits, and canyons cut far
// down into it, with lifts on their rims and caves in their floors. The floating islands hang high over
// it all, each straight above the lift tower that rides up to it; the giant trees carry canopies of
// their own. Animals, birds and insects everywhere; swimming in the water; twelve treasures to find.
// Villagers and wanderers are Crystal Sprite people; the giant gardeners stride across it all.
import { Game, W, H } from '../engine.js';
import { Actor } from '../../crystal/sprites.js';
import { getMode } from '../../modes.js';
import * as GL from '../mk/gl.js';
import { mk, hex, mix, clamp, lerp, RNG } from '../mk/tex.js';
import { World, TS, CS, WT, NC, SWIM, WATERONLY, K_WATER, K_CLIFF, K_BLDG } from './world.js';
import { ChunkVis, PlaceVis, pump, pending, blockTex, animalSprites, giantSprites, propSprite } from './scene.js';
import { BIOMES, BIOME_KEYS, FAMILY, ISLES, CAVES } from './lands.js';
import { paintSky, shadowTex, FAUNA } from './art.js';
import { GFX, GROWS, gfxValue, gfxSet, gfxStep } from './gfx.js';
import { Atmos } from './atmos.js';

const SAVE = 'garden4';
const HOUR = {
  morning: { sky: ['#232c38', '#6e7c88', '#c8b8a0', '#f0d8a8'], hiSky: ['#283850', '#8aa0c0', '#f0dcd8', '#fff0d8'], fog: [176, 184, 190], fogK: 0.55, tint: ['rgba(60,80,100,.10)', 'rgba(255,236,200,.10)'], shade: [0.96, 0.98, 1.03], dark: 0.3 },
  day: { sky: ['#343e48', '#848e92', '#c0bcac', '#f2ead4'], hiSky: ['#2c4a78', '#8ab0d8', '#eef0f4', '#fffbe8'], fog: [158, 162, 158], fogK: 0.4, tint: ['rgba(40,50,40,.08)', 'rgba(255,244,220,.07)'], shade: [1, 1, 1], dark: 0.12 },
  evening: { sky: ['#12101c', '#46303c', '#a8583a', '#ffae5c'], hiSky: ['#181430', '#5a3a6e', '#e8988c', '#ffd0a0'], fog: [92, 70, 80], fogK: 0.5, tint: ['rgba(40,20,50,.2)', 'rgba(255,140,70,.10)'], shade: [0.9, 0.8, 0.8], dark: 0.85 }
};
const STICK_R = 40, HERO = 74, ERA = ['Present day', 'Fantasy'];
const DIRS8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const FEET = [[-4, -3], [4, -3], [-4, 0], [4, 0]];
const GROUND_AI = { walk: 1, hop: 1, swim: 1, wade: 1, flock: 1 };
const HERD = { cattle: 1, cow: 1, sheep: 1, cloudsheep: 1, goat: 1, deer: 1 };
// who flies over each kind of country, and what crawls and flutters in it
const AIR = { green: ['crow', 'swallow', 'songbird', 'crow'], dream: ['swallow', 'songbird', 'pigeon', 'gull'], rust: ['crow', 'pigeon', 'crow'], desert: ['crow', 'swallow'], ash: ['crow'], frost: ['crow', 'gull'] };
const SOAR = { green: ['eagle'], dream: ['eagle', 'owl'], rust: [], desert: ['eagle'], ash: [], frost: ['eagle', 'owl'] };
const BUGS = { green: ['butterfly', 'bee', 'dragonfly', 'moth'], dream: ['butterfly', 'bee', 'dragonfly', 'butterfly', 'firefly'], rust: ['moth', 'dragonfly'], desert: ['moth', 'bee'], ash: ['moth', 'firefly'], frost: ['moth'] };
const HINT = { ground: { dream: 'somewhere in the dream', forgot: 'out in the forgotten country' }, mountain: 'on the highest summit', canyon: 'deep down a canyon', cave: 'in a cave under a canyon', isle: 'on a floating island', canopy: 'up a giant tree' };

let WORLD = null;
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch { return null; } }
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 4096) s += String.fromCharCode(...u8.subarray(i, i + 4096)); return btoa(s); }
function unb64(s, n) { const u = new Uint8Array(n); try { const t = atob(s); for (let i = 0; i < Math.min(n, t.length); i++) u[i] = t.charCodeAt(i); } catch { /* fresh */ } return u; }
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ss = (u) => u * u * (3 - 2 * u);

// Crystal people are graded darker and less saturated for the garden's weathered light, a frame at a
// time as it is copied into the frame texture
function grade(cv) {
  const x = cv.getContext('2d', { willReadFrequently: true }), img = x.getImageData(0, 0, cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, n = (((i * 2654435761) >>> 24) & 15) - 7; for (let k = 0; k < 3; k++) d[i + k] = clamp((l + (d[i + k] - l) * 0.78) * 0.92 + 4 + n, 0, 255); }
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
    this.worlds = s?.worlds || 1;
    this.explored = s?.ex ? unb64(s.ex, NC * NC) : new Uint8Array(NC * NC);
    this.found = s?.found || 0; Wd.treasures.forEach((T, i) => { T.found = !!(this.found & (1 << i)); });
    const place = s && s.place >= 0 ? Wd.places[s.place] || null : null;
    this.P = { x: s?.x ?? Wd.start.x, y: s?.y ?? Wd.start.y, h: 0, hv: 0, place, actor: new Actor(this.skin.crystal(0, 'Present day'), { walkSpeed: 7.5, runSpeed: 55, walkStride: 5, runStride: 6.5 }), armed: false, goal: null, stuck: 0, swim: false };
    const P = this.P; P.h = Wd.heightAt(P.x, P.y, place, s?.h ?? 0);
    if (Number.isNaN(Wd.stand(P.x, P.y, P.h, place, SWIM))) Object.assign(P, { x: Wd.start.x, y: Wd.start.y, place: null, h: Wd.heightAt(Wd.start.x, Wd.start.y, null) });
    P.hv = P.h;
    this.cam = { x: P.x, y: P.y, h: P.h };
    this.vis = new Map(); this.pvis = new Map(); this.npcs = []; this.beasts = []; this.fx = []; this.toasts = []; this.atmos = new Atmos();
    this.giants = this.makeGiants(); this.ui = null; this.uiS = 0; this.press = null; this.stick = null; this.ride = null; this.fade = null; this.t0 = 0; this.frameN = 0; this.saveT = 0; this.spawnT = 0; this.findT = 0;
    this.fogC = null; this.fogA = 0.2; this.lastPlace = ''; this.placeT = 0; this.mapCv = null; this.mapRow = 0; this.autoT = 0;
    this.autoOK = true;
  }
  debug() {
    const kinds = {}; for (const b of this.beasts) kinds[b.k] = (kinds[b.k] || 0) + 1;
    return { x: Math.round(this.P.x), y: Math.round(this.P.y), h: this.P.h, swim: this.P.swim, place: this.P.place ? `${this.P.place.kind}:${this.P.place.key}` : '', chunks: [...this.vis.values()].filter((v) => v.lod >= 0).length, pending: pending(), beasts: this.beasts.length, flying: this.beasts.filter((b) => b.st === 'fly').length, kinds, npcs: this.npcs.length, giants: this.giants.map((g) => [g.x | 0, g.y | 0]), ride: !!this.ride, fade: !!this.fade, ui: this.ui, name: this.lastPlace, found: this.W.treasures.filter((T) => T.found).length };
  }
  start() { super.start(); Garden.active = this; }
  stop() { this.save(); super.stop(); this.release(); }
  // off screen: give the GPU back its chunk textures, buffers and the people's frame texture (rebuilt on return)
  release() {
    for (const v of this.vis.values()) v.free(); this.vis.clear();
    for (const v of this.pvis.values()) v.free(); this.pvis.clear();
    if (this.actorTex) { GL.texFree(this.actorTex.tex); this.actorTex = null; this.heroSlot = undefined; for (const n of this.npcs) n.slot = -1; }
    if (this.skies) { for (const t of this.skies.values()) GL.texFree(t); this.skies = null; }
  }
  hud() { return ''; }
  save() {
    if (Garden.active !== this) return;
    const P = this.P, at = this.ride ? this.ride.from : P, pl = this.ride ? this.ride.fromPlace : P.place;
    try { localStorage.setItem(SAVE, JSON.stringify({ seed: this.W.seed, x: Math.round(at.x), y: Math.round(at.y), h: Math.round(at.h), place: pl ? pl.i : -1, ex: b64(this.explored), found: this.found, worlds: this.worlds })); } catch { /* full */ }
  }
  // all twelve found: a new world from a new seed
  newWorld() {
    this.release(); const seed = ((Date.now() * 2654435761) ^ 0x5eed) >>> 0;
    try { localStorage.setItem(SAVE, JSON.stringify({ seed, worlds: (this.worlds || 1) + 1 })); } catch { /* full */ }
    this.setup(); this.toast(`A new world: ${this.W.home.name}`);
  }

  // ------------------------------------------------ the giants: three, in the green and the dream, and the rust
  makeGiants() {
    const r = RNG(this.W.seed ^ 0x61a7), out = [];
    for (let i = 0; i < 3; i++) { const R = this.W.giantHome[i % 2]; const x = lerp(R[0], R[2], r.f()) * WT * TS, y = lerp(R[1], R[3], r.f()) * WT * TS; out.push({ v: i, x, y, tx: x, ty: y, dir: 1, f: 0, ft: 0, wait: 0, base: 0 }); }
    const g = out[0]; g.x = this.P.x - 900 + r.f() * 300; g.y = this.P.y - 700 - r.f() * 200; g.tx = this.P.x + 400; g.ty = this.P.y - 300;   // one not far off, so the first walk sees one
    return out;
  }
  stepGiants(dt) {
    for (const g of this.giants) {
      g.base += (Math.max(-20, this.W.heightAt(g.x, g.y, null)) - g.base) * Math.min(1, dt * 1.5);
      if (g.wait > 0) { g.wait -= dt; continue; }
      const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
      if (d < 20) { const R = this.W.giantHome[g.v % 2]; g.tx = lerp(R[0], R[2], Math.random()) * WT * TS; g.ty = lerp(R[1], R[3], Math.random()) * WT * TS; g.wait = 4 + Math.random() * 8; continue; }
      const sp = 10; g.x += (dx / d) * sp * dt; g.y += (dy / d) * sp * dt; g.dir = dx >= 0 ? 1 : -1;
      if ((g.ft += dt) > 0.7) { g.ft = 0; g.f = (g.f + 1) % 4; if (g.f % 2 === 0 && !this.P.place && Math.hypot(g.x - this.P.x, g.y - this.P.y) < 500) for (let k = 0; k < 8; k++) this.fx.push({ k: 'dust', x: g.x + (Math.random() - 0.5) * 40, y: g.y + (Math.random() - 0.5) * 10, h: g.base + 2, vx: (Math.random() - 0.5) * 30, vh: 10 + Math.random() * 20, t: 0, life: 1.2 }); }
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
    const v = this.view; if (!v || this.ride || this.fade) return;
    const sx = (x / W) * v.VW, sy = (y / H) * v.VH, P = this.P;
    // a person under the finger turns and greets you
    for (const n of this.npcs) { if (P.place) break; const [nx, ny] = v.PJ(n.x, n.y, 18, n.h); if (Math.abs(nx - sx) < 10 && Math.abs(ny - sy) < 16) { n.actor.face(this.faceTo(n, P)); n.actor.emote(Math.random() < 0.5 ? 'wave' : 'nod', 1.4); n.wait = 2.5; n.goal = null; return; } }
    const g = GL.unproject(sx, sy, P.h); if (!g) return;
    P.goal = { x: g[0], y: g[1] }; P.stuck = 0;
  }
  faceTo(a, b) { const ang = Math.atan2(b.y - a.y, b.x - a.x); return DIRS8[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8]; }

  // ------------------------------------------------ walking: up and down steps of the ground, into the water
  // (NaN where the feet cannot go: a drop or a climb of more than a step, a wall, deep water for the dry)
  feetAt(e, x, y, mode) { const Wd = this.W; for (const [ox, oy] of FEET) if (Number.isNaN(Wd.stand(x + ox, y + oy, e.h, e.place, mode))) return NaN; return Wd.stand(x, y, e.h, e.place, mode); }
  blocked(x, y, place, h, mode = 0) { return Number.isNaN(this.feetAt({ h, place }, x, y, mode)); }
  walk(e, dx, dy, mode = 0) {
    let moved = 0;
    if (dx) { const h = this.feetAt(e, e.x + dx, e.y, mode); if (!Number.isNaN(h)) { e.x += dx; e.h = h; moved += Math.abs(dx); } }
    if (dy) { const h = this.feetAt(e, e.x, e.y + dy, mode); if (!Number.isNaN(h)) { e.y += dy; e.h = h; moved += Math.abs(dy); } }
    return moved;
  }
  step(dt) {
    const P = this.P, Wd = this.W;
    this.t0 += dt;
    if (this.fade) this.stepFade(dt);
    if (this.ride) this.stepRide(dt);
    else if (!this.fade) {
      let vx = 0, vy = 0; const sp = HERO * (P.swim ? 0.62 : 1);
      if (this.stick && !this.ui) { const s = this.stick, dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy); if (d > 4) { const k = Math.min(1, d / STICK_R); vx = (dx / d) * sp * (0.35 + k * 0.85); vy = (dy / d) * sp * (0.35 + k * 0.85); } }
      else if (P.goal) {
        const dx = P.goal.x - P.x, dy = P.goal.y - P.y, d = Math.hypot(dx, dy);
        // no nearer for two seconds: give up on it (the autopilot picks somewhere else)
        if (P.goal.best === undefined || d < P.goal.best - 4) { P.goal.best = d; P.goal.bt = 0; } else if ((P.goal.bt += dt) > 2) { P.goal = null; P.stuck = 9; }
        if (P.goal) { if (d < 6) P.goal = null; else { vx = (dx / d) * sp; vy = (dy / d) * sp; } }
      }
      if (vx || vy) {
        let m = this.walk(P, vx * dt, vy * dt, SWIM);
        // blocked: try round it
        if (m < Math.hypot(vx, vy) * dt * 0.3) { const a = Math.atan2(vy, vx), s2 = Math.hypot(vx, vy) * dt; for (const da of [0.6, -0.6, 1.2, -1.2]) { m = this.walk(P, Math.cos(a + da) * s2, Math.sin(a + da) * s2, SWIM); if (m > s2 * 0.4) break; } } else if (P.stuck < 9) P.stuck = 0;
      }
      const sw = Wd.isWater(P.x, P.y, P.place); if (sw && !P.swim) this.splash(P.x, P.y, P.h); P.swim = sw;
      P.actor.update(dt, { vx, vy, swim: P.swim });
      this.checkWays();
    }
    P.hv = this.ride ? P.h : P.hv + (P.h - P.hv) * Math.min(1, dt * 14);
    // the world round the walker
    this.safe('giants', () => this.stepGiants(dt)); this.safe('beasts', () => this.stepBeasts(dt), () => { this.beasts = []; }); this.safe('npcs', () => this.stepNPCs(dt), () => { for (const n of this.npcs) this.actorTex?.give(n.slot); this.npcs = []; });
    for (const f of this.fx) { f.t += dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt; f.h += (f.vh || 0) * dt; f.vh = (f.vh || 0) - (f.g ?? 30) * dt; } this.fx = this.fx.filter((f) => f.t < f.life);
    if ((this.spawnT -= dt) <= 0) { this.spawnT = 0.5; this.safe('spawn', () => this.spawn()); this.markExplored(); this.safe('place', () => this.place()); }
    if ((this.findT -= dt) <= 0) { this.findT = 0.2; this.safe('treasure', () => this.lookForTreasure()); }
    for (const t of this.toasts) t.t += dt; this.toasts = this.toasts.filter((t) => t.t < 4.5);
    if ((this.saveT += dt) > 10) { this.saveT = 0; this.save(); }
  }
  // run a part of the world; if it throws, note it once and carry on (optionally clearing what went wrong)
  safe(what, fn, reset) { try { fn(); } catch (e) { this.oops(what, e); if (reset) reset(); } }
  oops(what, e) { this.oopsSeen ||= new Set(); if (!this.oopsSeen.has(what)) { this.oopsSeen.add(what); console.warn(`garden: ${what}`, e); } }
  splash(x, y, h) { for (let k = 0; k < 10; k++) this.fx.push({ k: 'drop', x: x + (Math.random() - 0.5) * 10, y, h: h + 2, vx: (Math.random() - 0.5) * 40, vh: 30 + Math.random() * 40, g: 160, t: 0, life: 0.6 }); }
  // the autopilot: wander from place to place, sometimes up a lift, down a canyon or into a cave, and back
  autopilot(dt) {
    const P = this.P, Wd = this.W; if (this.ride || this.ui || this.fade) return;
    this.autoT += dt;
    if (P.goal && this.autoT < 40) return;
    if (!P.goal && P.stuck < 9 && (this.idleT = (this.idleT || 0) + dt) < 1.5 + Math.random() * 3) return;   // a pause between walks
    this.autoT = 0; this.idleT = 0; P.stuck = 0; const r = Math.random, here = P.place;
    if (here) {
      this.inT = (this.inT || 0) + 1;
      const door = here.kind === 'cave' ? here.exit : here.pad;
      if (r() < 0.12 + this.inT * 0.06) { P.goal = { x: door.x * TS + 8, y: door.y * TS + 12 }; return; }
      const a = r() * 6.283, d = r() * here.rad * 0.6 * TS; P.goal = { x: here.x * TS + Math.cos(a) * d, y: here.y * TS + Math.sin(a) * d }; return;
    }
    this.inT = 0;
    const tx = P.x / TS, ty = P.y / TS;
    if (r() < 0.3) {
      const ways = [];
      for (const Pl of Wd.places) { if (Pl.lift) ways.push(Pl.lift); if (Pl.mouth) ways.push(Pl.mouth); }
      for (const Cn of Wd.canyons) for (const L of Cn.lifts) ways.push(P.h < -100 ? L.bot : L.top);
      const w = ways.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[0];
      if (w && Math.hypot(w.x - tx, w.y - ty) < 70) { P.goal = { x: w.x * TS + 8, y: w.y * TS + 12 }; P.armed = true; return; }
    }
    if (r() < 0.35) { const V = Wd.villages.filter((v) => Math.hypot(v.x - tx, v.y - ty) > 6).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[Math.floor(r() * 2)]; if (V && Math.hypot(V.x - tx, V.y - ty) < 90) { P.goal = { x: V.x * TS + 8, y: (V.y + 2) * TS }; return; } }
    for (let k = 0; k < 20; k++) { const a = r() * 6.283, d = (8 + r() * 16) * TS, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d * 0.8; if (Math.abs(Wd.heightAt(x, y, null) - P.h) < 40 && !Wd.isWater(x, y, null)) { P.goal = { x, y }; return; } }
  }

  // ------------------------------------------------ the ways up and down: lift towers, baskets, canyon cages, caves
  checkWays() {
    const P = this.P, Wd = this.W, here = P.place, dist = (t, oy = 12) => Math.hypot(P.x - (t.x * TS + 8), P.y - (t.y * TS + oy));
    if (here) {
      const door = here.kind === 'cave' ? here.exit : here.pad, d = dist(door);
      if (d > 30) P.armed = true; else if (d < 11 && P.armed) { if (here.kind === 'cave') this.leaveCave(here); else this.rideDown(here); }
      return;
    }
    let any = false;
    for (const Pl of Wd.places) {
      if (Pl.lift) { const d = dist(Pl.lift); if (d < 30) any = true; if (d < 11 && P.armed) { this.rideUp(Pl); return; } }
      if (Pl.mouth) { const d = dist(Pl.mouth, 14); if (d < 30) any = true; if (d < 11 && P.armed) { this.enterCave(Pl); return; } }
    }
    for (const Cn of Wd.canyons) for (const L of Cn.lifts) {
      const dt = dist(L.top), db = dist(L.bot); if (dt < 30 || db < 30) any = true;
      if (P.armed && dt < 11 && P.h > -60) { this.rideCanyon(L, true); return; }
      if (P.armed && db < 11 && P.h < -60) { this.rideCanyon(L, false); return; }
    }
    if (!any) P.armed = true;
  }
  // a ride: straight segments eased one after the other; the platform rides with you
  startRide(segs, toPlace, prop, name) {
    const P = this.P; this.ride = { segs, i: 0, t: 0, toPlace, prop, name, from: { ...segs[0].a }, fromPlace: P.place };
    P.goal = null; this.stick = null; P.place = null; P.actor.face('S'); P.swim = false;
  }
  rideUp(Pl) { const P = this.P, L = Pl.lift, a = { x: L.x * TS + 8, y: L.y * TS + 12, h: P.h }, b = { ...a, h: Pl.h }; this.startRide([{ a, b, dur: 2.2 + (Pl.h - P.h) / 200 }], Pl, Pl.kind === 'canopy' ? 'basket' : 'liftpad', Pl.kind === 'canopy' ? 'The Canopy' : ISLES[Pl.key].name); }
  rideDown(Pl) { const L = Pl.lift, a = { x: L.x * TS + 8, y: L.y * TS + 12, h: Pl.h }, b = { ...a, h: this.W.heightAt(a.x, a.y, null) }; this.startRide([{ a, b, dur: 2.2 + (a.h - b.h) / 200 }], null, Pl.kind === 'canopy' ? 'basket' : 'liftpad'); }
  rideCanyon(L, down) {
    const Wd = this.W, T = { x: L.top.x * TS + 8, y: L.top.y * TS + 12 }, B = { x: L.bot.x * TS + 8, y: L.bot.y * TS + 12 }; T.h = Wd.heightAt(T.x, T.y, null); B.h = Wd.heightAt(B.x, B.y, null, -999);
    const over = { x: B.x, y: B.y, h: T.h };
    this.startRide(down ? [{ a: T, b: over, dur: 0.8, flat: 1 }, { a: over, b: B, dur: 3.2 }] : [{ a: B, b: over, dur: 3.2 }, { a: over, b: T, dur: 0.8, flat: 1 }], null, 'basket', down ? 'Down into the canyon' : '');
  }
  stepRide(dt) {
    const R = this.ride, P = this.P, S = R.segs[R.i]; R.t += dt; const u = clamp(R.t / S.dur, 0, 1), e = ss(u);
    P.x = lerp(S.a.x, S.b.x, e); P.y = lerp(S.a.y, S.b.y, e); P.h = lerp(S.a.h, S.b.h, e); P.actor.update(dt, { vx: S.flat ? 1 : 0, vy: 0 });
    if (u >= 1) { if (R.i < R.segs.length - 1) { R.i++; R.t = 0; return; } P.place = R.toPlace; P.h = S.b.h; P.armed = false; this.ride = null; if (R.name) this.toast(R.name); }
  }
  // the caves: walk into the mouth, the world goes dark a moment, and you are inside
  enterCave(C) { this.fade = { t: 0, dur: 1, go: () => { const P = this.P; P.place = C; P.x = C.exit.x * TS + 8; P.y = (C.exit.y - 1.6) * TS; P.h = C.h; P.armed = false; P.goal = null; this.cam = { x: P.x, y: P.y, h: P.h }; P.hv = P.h; this.toast(CAVES[C.key].name); } }; this.P.goal = null; this.stick = null; }
  leaveCave(C) { this.fade = { t: 0, dur: 1, go: () => { const P = this.P, m = C.mouth; P.place = null; P.x = m.x * TS + 8; P.y = (m.y + 1.8) * TS; P.h = this.W.heightAt(P.x, P.y, null, -999); P.hv = P.h; P.armed = false; P.goal = null; this.cam = { x: P.x, y: P.y, h: P.h }; this.lastPlace = ''; } }; this.P.goal = null; this.stick = null; }
  stepFade(dt) { const F = this.fade; F.t += dt; if (!F.swapped && F.t >= F.dur / 2) { F.swapped = true; F.go(); this.beasts = []; for (const n of this.npcs) this.actorTex?.give(n.slot); this.npcs = []; } if (F.t >= F.dur) this.fade = null; }

  // ------------------------------------------------ the treasures: walk up to a chest and it opens
  lookForTreasure() {
    const P = this.P; if (this.ride || this.fade) return;
    for (const T of this.W.treasures) {
      if (T.found || T.place !== P.place) continue;
      const d = Math.hypot(P.x - (T.cx * TS + 8), P.y - (T.cy * TS + 12)); if (d > 22) continue;
      T.found = true; this.found |= 1 << T.i; const n = this.W.treasures.filter((t) => t.found).length;
      this.toast(`Treasure ${n} of 12: ${T.name}`);
      for (let k = 0; k < 24; k++) this.fx.push({ k: 'spark', x: T.cx * TS + 8 + (Math.random() - 0.5) * 8, y: T.cy * TS + 12, h: P.h + 6, vx: (Math.random() - 0.5) * 50, vh: 30 + Math.random() * 50, g: 50, t: 0, life: 1.4 });
      if (n === 12) this.toast('All twelve found. A new world waits in the menu');
      for (const v of this.vis.values()) v.missing = 1; for (const v of this.pvis.values()) v.missing = 1;
      this.save();
    }
  }

  // ------------------------------------------------ the living: beasts, birds and bugs, villagers, wanderers
  faunaHere() {
    const P = this.P, here = P.place, ev = this.mode === 'evening';
    if (here?.kind === 'cave') return { fam: 'cave', ground: ['salamander', 'snail', 'crab', 'mossling', 'axolotl', 'salamander'], bugs: ['firefly', 'moth', 'firefly'], air: [], soar: [], sky: here.key === 'grotto' || here.key === 'crystal' ? ['jelly'] : [], rare: ['spiritfox'], bats: 1, dream: true };
    if (here?.kind === 'canopy') return { fam: 'dream', ground: ['squirrel', 'songbird', 'parrot', 'treefrog', 'redpanda', 'snail', 'squirrel'], bugs: ['butterfly', 'moth', 'bee', ev ? 'firefly' : 'butterfly'], air: ['songbird', 'parrot', 'swallow'], soar: ['owl'], sky: ['koi'], rare: ['spiritfox', 'mossling'], dream: true };
    if (here) {
      const fam = ISLES[here.key].fam;
      if (fam === 'dream') return { fam, ground: ['rabbit', 'moonhare', 'cloudsheep', 'sheep', 'songbird', 'fox', 'cloudsheep'], bugs: ['butterfly', 'bee', ev ? 'firefly' : 'butterfly', 'dragonfly'], air: ['swallow', 'songbird', 'gull'], soar: ['eagle', 'emberbird'], sky: ['jelly', 'koi', 'manta', 'whale', 'koi', 'jelly', 'manta'], rare: ['kirin', 'spiritfox', 'stag'], dream: true };
      return { fam, ground: fam === 'rust' ? ['crow', 'rat', 'pigeon'] : fam === 'frost' ? ['goat', 'fox', 'rabbit'] : ['goat', 'crow', 'rabbit', 'sheep'], bugs: ['moth', 'butterfly'], air: AIR[fam] || ['crow'], soar: ['eagle'], sky: ['manta', 'whale', 'jelly'], rare: [], dream: false };
    }
    const B = BIOMES[BIOME_KEYS[this.W.biomeAt(P.x / TS, P.y / TS)]], fam = B.fam === 'cave' ? 'dream' : B.fam, F = B.fauna;
    return { fam: B.fam, B, ground: F.filter((k) => GROUND_AI[FAUNA[k]?.ai]), bugs: [...F.filter((k) => FAUNA[k]?.ai === 'flutter'), ...(BUGS[fam] || [])], air: AIR[fam] || ['crow'], soar: [...F.filter((k) => FAUNA[k]?.ai === 'soar'), ...(SOAR[fam] || [])], sky: B.dream ? ['koi', 'jelly'] : [], rare: B.rare || [], dream: !!B.dream };
  }
  addBeast(kind, x, y, fam, extra) {
    const A = FAUNA[kind]; if (!A) return null; const P = this.P, r = Math.random, h = this.W.heightAt(x, y, P.place);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(h)) return null;
    const b = { k: kind, A, fam, x, y, h, base: h, alt: 0, place: P.place, dir: r() < 0.5 ? 1 : -1, f: r() * 4, wait: r() * 2, tx: x, ty: y, hx: x, hy: y, st: 'idle', t: 0, ph: r() * 6.283, flee: 0, ...extra };
    // whatever list it came from (a rare jellyfish among the ground animals, say), it gets what its kind needs to move
    const ai = A.ai, had = (k) => extra && extra[k] !== undefined;
    if (ai === 'drift') { b.st = 'air'; if (!had('heading')) b.heading = r() * 6.283; if (!had('alt')) b.alt = P.place?.kind === 'isle' ? -60 - r() * 160 : 30 + r() * 80; if (!had('base')) b.base = P.place ? P.place.h : h; }
    else if (ai === 'soar') { b.st = 'air'; if (!had('R')) b.R = 60 + r() * 90; if (!had('ang')) b.ang = r() * 6.283; if (!had('alt')) b.alt = 110 + r() * 60; }
    else if (ai === 'flutter') { b.st = 'air'; if (!had('alt')) b.alt = 6 + r() * 16; }
    else if (ai === 'bat') { b.st = 'air'; if (!had('alt')) b.alt = 24 + r() * 30; }
    this.beasts.push(b); return b;
  }
  spawn() {
    const P = this.P, Wd = this.W, r = Math.random, here = P.place, ev = this.mode === 'evening', L = this.faunaHere(), fam = L.fam;
    const far = (b) => Math.hypot(b.x - P.x, b.y - P.y) / TS;
    this.beasts = this.beasts.filter((b) => !b.gone && b.place === here && far(b) < (b.st === 'fly' ? 48 : b.A.ai === 'soar' || b.A.ai === 'drift' ? 60 : 34));
    const count = (f) => { let n = 0; for (const b of this.beasts) if (f(b)) n++; return n; };
    const spot = (d0, d1) => { const a = r() * 6.283, d = (d0 + r() * (d1 - d0)) * TS; return [P.x + Math.cos(a) * d, P.y + Math.sin(a) * d]; };
    const ok = (x, y, mode) => { const h = Wd.heightAt(x, y, here); return !Number.isNaN(Wd.stand(x, y, h, here, mode)); };
    // the ones on the ground (and in the water)
    const wantG = here ? (here.kind === 'cave' ? 5 : 6) : 12;
    for (let k = 0; k < 3 && count((b) => GROUND_AI[b.A.ai] && b.st !== 'fly') < wantG; k++) {
      let kind = pick(L.ground); if (L.rare.length && r() < 0.07) kind = pick(L.rare); const A = FAUNA[kind]; if (!A) continue;
      const mode = A.ai === 'swim' ? WATERONLY : A.ai === 'wade' ? SWIM : 0;
      let [x, y] = spot(9, 19); if (!ok(x, y, mode)) { if (A.ai !== 'swim') continue; [x, y] = spot(5, 16); if (!ok(x, y, mode)) continue; }
      const n = A.ai === 'flock' ? 3 + Math.floor(r() * 4) : HERD[kind] ? 1 + Math.floor(r() * 3) : 1;
      for (let q = 0; q < n; q++) { const bx = x + (r() - 0.5) * 34, by = y + (r() - 0.5) * 22; if (ok(bx, by, mode)) this.addBeast(kind, bx, by, fam); }
    }
    // insects round about (more in the dream, fireflies and moths at dusk)
    const wantB = (L.dream ? 8 : 4) + (ev ? 3 : 0);
    if (L.bugs.length) for (let k = 0; k < 2 && count((b) => b.A.ai === 'flutter') < wantB; k++) {
      const kind = ev && r() < 0.5 ? pick(['firefly', 'moth']) : pick(L.bugs), [x, y] = spot(3, 12); if (here && !ok(x, y, SWIM)) continue;
      const n = kind === 'firefly' ? 3 + Math.floor(r() * 4) : kind === 'bee' ? 2 : 1;
      for (let q = 0; q < n; q++) this.addBeast(kind, x + (r() - 0.5) * 30, y + (r() - 0.5) * 20, fam, { st: 'air', alt: 6 + r() * 16 });
    }
    // birds over: a flock passing, a hawk or an owl circling high, bats at dusk
    if (L.air.length && count((b) => b.pass) < 7 && r() < (here?.kind === 'cave' ? 0 : 0.14)) {
      const kind = pick(L.air), a = r() * 6.283, d = 22 * TS, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d * 0.8, toA = Math.atan2(P.y - y, P.x - x) + (r() - 0.5) * 0.8, n = 3 + Math.floor(r() * 5), cr = 70 + r() * 60;
      for (let q = 0; q < n; q++) { const b = this.addBeast(kind, x + (r() - 0.5) * 60, y + (r() - 0.5) * 40, fam, { st: 'fly', pass: true, alt: cr + (r() - 0.5) * 20, cruise: cr }); if (b) { const sp = b.A.speed; b.vx = Math.cos(toA) * sp; b.vy = Math.sin(toA) * sp * 0.8; b.base = here ? here.h : 0; } }
    }
    if (L.soar.length && count((b) => b.A.ai === 'soar') < 1 && r() < 0.06) { const kind = ev && L.soar.includes('owl') ? 'owl' : pick(L.soar), [x, y] = spot(4, 12); this.addBeast(kind, x, y, fam, { st: 'air', R: 60 + r() * 90, ang: r() * 6.283, alt: 110 + r() * 60 }); }
    if ((ev || L.bats) && count((b) => b.k === 'bat') < (L.bats ? 4 : 3) && r() < 0.2) { const [x, y] = spot(3, 10); for (let q = 0; q < 2; q++) this.addBeast('bat', x + (r() - 0.5) * 40, y, fam, { st: 'air', alt: 24 + r() * 30 }); }
    // the sky's own creatures: round the islands (and below them), now and then over the dream
    const wantS = here?.kind === 'isle' ? 5 : L.sky.length ? 1 : 0;
    if (L.sky.length && count((b) => b.A.ai === 'drift') < wantS && r() < (here ? 0.35 : 0.04)) {
      const kind = pick(L.sky), [x, y] = spot(here ? 6 : 10, here ? 22 : 18), A = FAUNA[kind], hi = here?.kind === 'isle';
      this.addBeast(kind, x, y, fam, { st: 'air', alt: hi ? -60 - r() * (kind === 'whale' ? 260 : 180) + (r() < 0.3 ? 120 : 0) : 30 + r() * 80, heading: r() * 6.283, base: here ? here.h : Wd.heightAt(x, y, null) });
      if (A.ai === 'drift' && kind === 'koi') for (let q = 0; q < 2; q++) this.addBeast(kind, x + (r() - 0.5) * 40, y + (r() - 0.5) * 30, fam, { st: 'air', alt: (hi ? -50 : 40) + r() * 30, heading: r() * 6.283, base: here ? here.h : Wd.heightAt(x, y, null) });
    }
    // villagers in the villages near you, a few wanderers on the roads, scavengers in the city
    const AT = this.actorTex, ptx = P.x / TS, pty = P.y / TS;
    this.npcs = this.npcs.filter((n) => { const keep = !here && Math.hypot(n.x - P.x, n.y - P.y) < 46 * TS; if (!keep && AT) AT.give(n.slot); return keep; });
    if (!here) {
      for (const v of Wd.villages) {
        if (Math.hypot(v.x - ptx, v.y - pty) > 34 || this.npcs.some((n) => n.home === v)) continue;
        const rr = RNG(v.seed ^ 0x77), cnt = rr.int(3, 5);
        for (let i = 0; i < cnt; i++) for (let t = 0; t < 12; t++) { const x = (v.x + rr.range(-v.rad, v.rad)) * TS, y = (v.y + rr.range(-v.rad, v.rad)) * TS, h = Wd.heightAt(x, y, null); if (!this.blocked(x, y, null, h)) { this.addNPC(x, y, h, v, (v.seed + i * 7) >>> 0); break; } }
      }
      const C = Wd.city; if (Wd.inCity(ptx, pty, 20) && this.npcs.filter((n) => n.home === C).length < 4) for (let t = 0; t < 10; t++) { const x = (C.x0 + r() * (C.x1 - C.x0)) * TS, y = (C.y0 + r() * (C.y1 - C.y0)) * TS, h = Wd.heightAt(x, y, null); if (Math.hypot(x - P.x, y - P.y) < 30 * TS && !this.blocked(x, y, null, h)) { this.addNPC(x, y, h, C, (Math.random() * 1e9) >>> 0); break; } }
      if (this.npcs.filter((n) => n.road).length < 2) for (let t = 0; t < 10; t++) { const [x, y] = spot(14, 24), h = Wd.heightAt(x, y, null); if (Wd.roads.near(x / TS, y / TS)[0] < 0 && !this.blocked(x, y, null, h)) { this.addNPC(x, y, h, null, (Math.random() * 1e9) >>> 0, true); break; } }
    }
  }
  addNPC(x, y, h, home, seed, road = false) {
    const era = ERA[seed % 2], actor = new Actor(this.skin.crystal(1 + (seed % 89), era), { walkSpeed: 7.5, runSpeed: 55, walkStride: 5, runStride: 6.5 });
    this.npcs.push({ x, y, h, home, road, place: null, actor, slot: this.actorTex ? this.actorTex.take() : -1, wait: Math.random() * 3, goal: null, sp: 26 + Math.random() * 12 });
  }
  stepNPCs(dt) {
    const P = this.P, Wd = this.W, r = Math.random;
    for (const n of this.npcs) {
      let vx = 0, vy = 0;
      if (n.wait > 0) n.wait -= dt;
      else if (!n.goal) {
        if (n.road) { const a = r() * 6.283; for (let k = 0; k < 8; k++) { const x = n.x + Math.cos(a + k * 0.8) * 6 * TS, y = n.y + Math.sin(a + k * 0.8) * 6 * TS; if (Wd.roads.near(x / TS, y / TS)[0] < 0.5) { n.goal = { x, y }; break; } } }
        else if (n.home) { const h = n.home, cx = h.rad ? h.x : (h.x0 + h.x1) / 2, cy = h.rad ? h.y : (h.y0 + h.y1) / 2, rad = h.rad || 30; n.goal = { x: (cx + (r() - 0.5) * 2 * rad) * TS, y: (cy + (r() - 0.5) * 2 * rad) * TS }; }
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
  // the animals: each to its own way of going
  stepBeasts(dt) {
    const P = this.P, Wd = this.W, r = Math.random;
    for (const b of this.beasts) {
      try { this.stepBeast(b, dt, P, Wd, r); } catch (e) { b.gone = true; this.oops('beast', e); }
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.alt) || !Number.isFinite(b.base)) b.gone = true;
    }
    this.beasts = this.beasts.filter((b) => !b.gone);
  }
  stepBeast(b, dt, P, Wd, r) {
    {
      const A = b.A, ai = A.ai, dP = Math.hypot(P.x - b.x, P.y - b.y), sp = A.speed || 20; b.t += dt;
      const groundBase = () => (b.place ? b.place.h : Wd.heightAt(b.x, b.y, null));
      if (b.st === 'fly') {
        // flying off (or passing over): it keeps going, climbing to its height, until it is far away and gone
        b.alt += ((b.cruise || 90) - b.alt) * Math.min(1, dt * 0.9); b.x += b.vx * dt; b.y += b.vy * dt;
        const a = Math.atan2(b.vy, b.vx) + Math.sin(b.t * 1.3 + b.ph) * 0.25 * dt; const v = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v;
        b.dir = b.vx >= 0 ? 1 : -1; b.f += dt * (A.big ? 4 : 11); if (b.t > 45) b.gone = true;
        return;
      }
      switch (ai) {
        case 'flock': {
          // pecking about on the ground, until you come near: then up and away, all of them
          if (dP < 5 * TS || b.spook) { const a = Math.atan2(b.y - P.y, b.x - P.x) + (r() - 0.5) * 0.9; b.st = 'fly'; b.cruise = 60 + r() * 70; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp * 0.8; b.t = 0; b.base = groundBase(); for (const o of this.beasts) if (o !== b && o.k === b.k && o.st !== 'fly' && Math.hypot(o.x - b.x, o.y - b.y) < 4 * TS) o.spook = 1; break; }
          if (b.wait > 0) { b.wait -= dt; b.f = 2 + ((b.t * 3 + b.ph) % 2 > 1 ? 1 : 0); break; }
          const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
          if (d < 3) { b.wait = 0.6 + r() * 2.5; const a = r() * 6.283; b.tx = b.x + Math.cos(a) * 20; b.ty = b.y + Math.sin(a) * 14; break; }
          if (this.walk(b, (dx / d) * 14 * dt, (dy / d) * 14 * dt) < 0.02) { b.tx = b.x; b.ty = b.y; }
          b.dir = dx >= 0 ? 1 : -1; b.f = 3; break;
        }
        case 'flutter': {
          // wandering about its patch, low, never still for long
          if (b.wait > 0 && A.bug === 'dragonfly') { b.wait -= dt; b.f += dt * 20; break; }
          const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
          if (d < 4 || dP < 1.2 * TS) { const a = r() * 6.283, rr = (dP < 1.2 * TS ? 3 : 2) * TS; b.tx = b.hx + Math.cos(a) * rr; b.ty = b.hy + Math.sin(a) * rr * 0.7; if (A.bug === 'dragonfly') b.wait = r() * 1.2; }
          else { const v = sp * (A.bug === 'dragonfly' ? 2.4 : 1); b.x += (dx / d) * v * dt + Math.sin(b.t * 7 + b.ph) * 6 * dt; b.y += (dy / d) * v * dt; b.dir = dx >= 0 ? 1 : -1; }
          b.alt = (A.bug === 'bee' ? 6 : A.bug === 'firefly' ? 10 : 9) + (1 + Math.sin(b.t * 2.2 + b.ph)) * (A.bug === 'moth' ? 12 : 7);
          b.base += (groundBase() - b.base) * Math.min(1, dt * 3); b.f += dt * (A.bug === 'butterfly' ? 9 : 22); break;
        }
        case 'soar': {
          // circling high, the circle drifting slowly over the country
          b.ang += dt * (sp / b.R); b.hx += Math.cos(b.t * 0.05 + b.ph) * 6 * dt; b.hy += Math.sin(b.t * 0.04 + b.ph) * 4 * dt;
          const nx = b.hx + Math.cos(b.ang) * b.R, ny = b.hy + Math.sin(b.ang) * b.R * 0.6; b.dir = nx >= b.x ? 1 : -1; b.x = nx; b.y = ny;
          b.base += (groundBase() - b.base) * Math.min(1, dt * 0.5); b.f = Math.sin(b.t * 0.7 + b.ph) > 0.85 ? b.t * 6 : 0; break;
        }
        case 'drift': {
          // the sky's creatures go slowly, turning a little, rising and falling
          b.heading += Math.sin(b.t * 0.21 + b.ph) * 0.12 * dt; b.x += Math.cos(b.heading) * sp * dt; b.y += Math.sin(b.heading) * sp * dt * 0.7; b.dir = Math.cos(b.heading) >= 0 ? 1 : -1;
          b.alt += Math.sin(b.t * 0.6 + b.ph) * 6 * dt; if (!b.place) b.base += (Math.max(0, Wd.heightAt(b.x, b.y, null)) - b.base) * Math.min(1, dt * 0.3); b.f += dt * 3; break;
        }
        case 'bat': {
          const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
          if (d < 5) { const a = r() * 6.283; b.tx = b.hx + Math.cos(a) * 3 * TS; b.ty = b.hy + Math.sin(a) * 2 * TS; }
          else { b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt; b.dir = dx >= 0 ? 1 : -1; }
          b.alt = 28 + Math.sin(b.t * 3 + b.ph) * 12; b.base += (groundBase() - b.base) * Math.min(1, dt * 2); b.f += dt * 16; break;
        }
        default: {
          // walking, hopping, swimming, wading: wander and graze; most shy away from you
          const mode = ai === 'swim' ? WATERONLY : ai === 'wade' ? SWIM : 0;
          if (!b.flee && !A.calm && dP < (ai === 'wade' ? 3 : 3.5) * TS) { b.flee = 1.6; const a = Math.atan2(b.y - P.y, b.x - P.x); b.tx = b.x + Math.cos(a) * 6 * TS; b.ty = b.y + Math.sin(a) * 6 * TS; b.wait = 0; }
          if (b.flee > 0) b.flee = Math.max(0, b.flee - dt);
          if (ai === 'hop') b.alt = Math.max(0, b.alt - dt * 30);
          if (b.wait > 0) { b.wait -= dt; b.f = ai === 'swim' ? b.f + dt * 2 : 0; break; }
          const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
          if (d < 4) { b.wait = 1 + r() * 4; const a = r() * 6.283, dd = r() * 4 * TS; b.tx = b.x + Math.cos(a) * dd; b.ty = b.y + Math.sin(a) * dd * 0.7; break; }
          const v = sp * (b.flee ? 2.4 : 1) * (ai === 'hop' ? (Math.sin(b.t * 9) > -0.2 ? 1.6 : 0) : 1), m = this.walk(b, (dx / d) * v * dt, (dy / d) * v * dt, mode); if (v && m < 0.02) { b.tx = b.x; b.ty = b.y; }
          if (ai === 'hop' && v) b.alt = Math.abs(Math.sin(b.t * 9)) * 4;
          b.base = b.h; b.dir = dx >= 0 ? 1 : -1; b.f += dt * v * 0.18;
        }
      }
    }
  }

  // ------------------------------------------------ where you are: explored chunks, names
  markExplored() { const P = this.P, here = P.place; const ax = here ? (here.kind === 'cave' ? here.mouth.x * TS : here.x * TS) : P.x, ay = here ? (here.kind === 'cave' ? here.mouth.y * TS : here.y * TS) : P.y, cx = Math.floor(ax / (CS * TS)), cy = Math.floor(ay / (CS * TS)); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = cx + i, y = cy + j; if (x >= 0 && y >= 0 && x < NC && y < NC) this.explored[y * NC + x] = 1; } }
  place() {
    const P = this.P, Wd = this.W; if (this.ride || this.fade) return;
    let name = P.place ? (P.place.kind === 'cave' ? CAVES[P.place.key].name : P.place.kind === 'canopy' ? 'The Canopy' : ISLES[P.place.key].name) : '';
    if (!P.place) { const v = Wd.villageAt(P.x / TS, P.y / TS, 2); name = v ? v.name : Wd.inCity(P.x / TS, P.y / TS) ? 'The Ruined City' : P.h < -100 ? 'The Canyon Floor' : P.h >= 220 ? 'The Summit' : Wd.biomeName(P.x, P.y); }
    if (name !== this.pend) { this.pend = name; this.pendT = 0; } else if ((this.pendT += 0.5) >= 1 && name !== this.lastPlace) { this.lastPlace = name; this.toast(name); }
  }
  toast(s) { this.toasts = this.toasts.filter((t) => t.s !== s); this.toasts.push({ s, t: 0 }); if (this.toasts.length > 3) this.toasts.shift(); }

  // ------------------------------------------------ drawing
  draw(c) {
    this.frameN++;
    if (GFX.fps === 30 && this.frameN % 2 && this.view) return;
    const R = GL.renderer();
    if (!R || GL.glLost()) { c.fillStyle = '#0b0d0a'; c.fillRect(0, 0, W, H); c.fillStyle = '#9ca09a'; c.font = '13px ui-monospace, monospace'; c.fillText('the garden needs WebGL', 20, 40); return; }
    this.actorTex ||= new ActorTex(); for (const n of this.npcs) if (n.slot < 0) n.slot = this.actorTex.take();
    if (this.heroSlot === undefined) this.heroSlot = this.actorTex.take();
    const P = this.P, Wd = this.W, hour = HOUR[this.mode] || HOUR.day, here = P.place, cave = here?.kind === 'cave';
    const K = GL.setLens(GFX.pitch, GFX.fov), VW = Math.round(GFX.zoom), VH = Math.round((VW * H) / W);
    // the camera follows, lifting with the ground and the rides
    const cam = this.cam; cam.x += (P.x - cam.x) * 0.12; cam.y += (P.y - cam.y) * 0.12; cam.h += (P.hv - cam.h) * (this.ride ? 0.35 : 0.2);
    const hi = cave ? 0 : clamp((cam.h - 60) / 420, 0, 1), far = lerp(6, 16, hi), fogR = cave ? [0.7, 1.7] : [lerp(0.95, 1.8, hi), lerp(1.9, 8.5, hi)];
    const PJ = GL.camSetup(VW, VH, Math.round(cam.x), cam.h, Math.round(cam.y), VH * 0.56, far);
    const prev = this.view; this.view = { VW, VH, PJ };
    // fog and sky follow the country you are in, the height and the hour
    const B = here ? null : BIOMES[BIOME_KEYS[Wd.biomeAt(P.x / TS, P.y / TS)]], fam = cave ? 'cave' : here ? (here.kind === 'canopy' ? 'dream' : ISLES[here.key].fam) : B.fam, high = !cave && (hi > 0.3 || (here && here.kind !== 'cave'));
    let fogT, fogAT;
    if (cave) { fogT = [10, 12, 20]; fogAT = 0.5; }
    else if (high) { fogT = mix(hex(hour.hiSky[2]), hour.fog, 0.3); fogAT = 0.2 + hi * 0.08; }
    else { fogT = mix(hex(B.fog[0]), hour.fog, hour.fogK * (B.dream ? 0.6 : 1)); fogAT = B.fog[1] + (B.dream ? 0.05 : 0.1); }
    this.fogC = this.fogC ? mix(this.fogC, fogT, this.fade ? 1 : 0.03) : fogT; this.fogA += (fogAT - this.fogA) * (this.fade ? 1 : 0.03);
    const sky = this.sky(fam, hour, cave ? 'cave' : high ? 'hi' : B.dream ? 'dream' : '');
    const PF = globalThis.GPROF, pt = (k) => { if (PF) { const n = performance.now(); PF[k] = (PF[k] || 0) + n - (PF._t || n); PF._t = n; } }; pt('_start'); if (PF) PF._t = performance.now();
    // build and stream what can be seen
    const budget = this.vis.size < 4 ? 16 : 7, t0 = performance.now();
    const need = cave ? [] : this.visible(VW, VH, cam);
    for (const v of need) { if (performance.now() - t0 > budget) break; v.update(v.wantLod); }
    pump(Math.max(2, budget - (performance.now() - t0)));
    pt('stream');
    // the high places near enough to be seen (or stood in)
    const rideTo = this.ride?.toPlace || this.ride?.fromPlace;
    const places = cave ? [here] : Wd.places.filter((Q) => Q === here || Q === rideTo || (Q.kind !== 'cave' && Math.hypot(Q.x * TS - cam.x, Q.y * TS - cam.y) < (Q.kind === 'isle' ? 2400 : 1500)));
    let bakes = 0; for (const Q of places) { let pv = this.pvis.get(Q.i); if (!pv) this.pvis.set(Q.i, (pv = new PlaceVis(Wd, Q))); if (!pv.ok && Q !== here && bakes++ > 0) continue; pv.update(); }
    for (const [i, pv] of this.pvis) if (!places.includes(pv.P) && this.frameN % 120 === 0) { pv.free(); this.pvis.delete(i); }
    // ---- the 3D pass
    GL.glBegin(VW, VH, GFX.scale, this.fogC); GL.glScreen(sky, null, GFX);
    const tint = cave ? [0.72, 0.74, 0.86] : high ? [hour.shade[0] * 1.04, hour.shade[1] * 1.03, hour.shade[2] * 1.06] : B.dream ? [hour.shade[0] * 1.04, hour.shade[1] * 1.05, hour.shade[2]] : hour.shade;
    GL.glMain(this.fogC, this.fogA * 2.2, GFX, fogR, tint, lerp(3, 7, hi));
    pt('places+sky');
    const bt = blockTex(), atlas = GL.atlasTex();
    for (const v of need) if (v.lod >= 0) GL.glDraw(v.gBuf, v.gN, v.tex);
    for (const v of need) if (v.bN) GL.glDraw(v.bBuf, v.bN, bt);
    // props near the walker are drawn each frame instead, so the ones between you and the camera can thin out
    const pcx = P.x / (CS * TS), pcy = P.y / (CS * TS), nearV = need.filter((v) => !here && Math.abs(v.cx + 0.5 - pcx) < 1.6 && Math.abs(v.cy + 0.5 - pcy) < 1.6 && v.props);
    for (const v of need) if (v.pN && !nearV.includes(v)) GL.glDraw(v.pBuf, v.pN, atlas);
    for (const Q of places) { const pv = this.pvis.get(Q.i); if (!pv?.ok) continue; GL.glDraw(pv.gBuf, pv.gN, pv.tex); GL.glDraw(pv.bBuf, pv.bN, bt); if (pv.pN) GL.glDraw(pv.pBuf, pv.pN, atlas); }
    // the living, as billboards (people from their own frame texture)
    this.bat ||= { m: new GL.Batch(2048), s: new GL.Batch(512), a: new GL.Batch(512), g: new GL.Batch(64), bm: GL.newBuffer(), bs: GL.newBuffer(), ba: GL.newBuffer(), bg: GL.newBuffer() };
    const BM = this.bat.m, BS = this.bat.s, BA = this.bat.a, BG = this.bat.g; BM.reset(); BS.reset(); BA.reset(); BG.reset(); this.BG = BG;
    const sinP = Math.sin((GFX.pitch * Math.PI) / 180);
    for (const v of nearV) for (const p of v.props) {
      if (p.chest && p.chest.found) continue;
      const sp = propSprite(p.type, p.fam, p.v); if (!sp) continue; const dz = p.y - P.y, dx = Math.abs(p.x - P.x);
      const cover = dz > 2 && dz < (sp.height * 1.05) / Math.max(0.15, sinP) && dx < sp.width / 2 + 7 && p.e >= P.h - 30;
      BM.bb(sp, 0, 0, sp.width, sp.height, p.x, p.y, p.e - 1.5, K, 1, cover ? 0.3 : 1);
    }
    pt('static');
    let lights = []; this.safe('entities', () => { lights = this.entities(BM, BS, BA, K, PJ, cam); });
    pt('entities');
    const nS = BS.upload(this.bat.bs), nM = BM.upload(this.bat.bm), nA = BA.upload(this.bat.ba);
    GL.glDraw(this.bat.bs, nS, GL.atlasTex(), true); GL.glDraw(this.bat.bm, nM, GL.atlasTex()); GL.glDraw(this.bat.ba, nA, this.actorTex.tex);
    // clouds under the islands, laid flat and see-through
    for (const Q of places) { const pv = this.pvis.get(Q.i); if (pv?.cN) GL.glDraw(pv.cBuf, pv.cN, atlas); }
    // the giants loom out of the haze: drawn with a thinner fog, so they are seen from far off
    const nG = BG.upload(this.bat.bg); if (nG) { GL.glMain(this.fogC, this.fogA * 0.8, GFX, [fogR[0] * 1.8, fogR[1] * 2.6], tint, lerp(3, 7, hi) * 2.4); GL.glDraw(this.bat.bg, nG, GL.atlasTex()); }
    const out = GL.glEnd({ band: GFX.band, max: GFX.blur, sat: GFX.sat * (B?.dream || (high && fam === 'dream') ? 1.08 : 1), focus: GFX.focus, depthSpan: lerp(3, 7, hi) }, GFX);
    pt('glsubmit');
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(out, 0, 0, W, H);
    pt('present');
    // ---- the air, in view pixels
    c.scale(W / VW, H / VH);
    const dcx = prev ? (cam.x - (this.lastCam?.x ?? cam.x)) : 0, dcy = prev ? (cam.y - (this.lastCam?.y ?? cam.y)) : 0; this.lastCam = { x: cam.x, y: cam.y };
    const motes = cave ? (here.key === 'grotto' || here.key === 'crystal' ? 'glitter' : 'drips') : here ? (here.kind === 'canopy' ? (this.mode === 'evening' ? 'fireflies' : 'leaves') : this.mode === 'evening' && ISLES[here.key].fam === 'dream' ? 'fireflies' : ISLES[here.key].motes) : this.mode === 'evening' && B.dream ? 'fireflies' : B.motes;
    this.atmos.update(1 / 60, motes, VW, VH, dcx, dcy);
    this.atmos.lights(c, lights, cave ? 1 : hour.dark);
    for (const [x, y, a, k] of this.dustPts || []) { c.fillStyle = k === 'spark' ? `rgba(255,236,150,${a.toFixed(2)})` : k === 'drop' ? `rgba(200,230,240,${(a * 0.8).toFixed(2)})` : `rgba(200,190,170,${(a * 0.5).toFixed(2)})`; c.fillRect(Math.round(x), Math.round(y), k === 'dust' ? 2 : 1, 1); }
    this.atmos.draw(c, VW, VH, cam.x, cam.y, this.fogC, this.fogA * (cave ? 0.4 : 1), motes, cave ? ['rgba(10,14,30,.18)', 'rgba(120,200,220,.05)'] : hour.tint);
    c.restore();
    pt('overlay');
    if (this.fade) { const u = this.fade.t / this.fade.dur, a = 1 - Math.abs(u * 2 - 1); c.fillStyle = `rgba(0,0,0,${clamp(a * 1.4, 0, 1).toFixed(3)})`; c.fillRect(0, 0, W, H); }
    this.drawUI(c);
  }
  // which chunks the view needs, and at what level of detail (the camera's footprint on the ground)
  visible(VW, VH, cam) {
    const pts = [], low = Math.min(0, cam.h); for (const pl of cam.h > 40 ? [cam.h, low] : [low]) for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) { const g = GL.unproject((i / 4) * VW, (j / 4) * VH, pl); if (g) pts.push(g); }
    const D = GL.camD(), maxd = D * (cam.h > 40 ? 10 : 4.2);
    let x0 = cam.x - 200, x1 = cam.x + 200, y0 = cam.y - 200, y1 = cam.y + 140;
    for (const [x, y] of pts) { const dx = x - cam.x, dy = y - cam.y, d = Math.hypot(dx, dy), k = d > maxd ? maxd / d : 1; const X = cam.x + dx * k, Y = cam.y + dy * k; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    const S = CS * TS, cx0 = Math.max(0, Math.floor(x0 / S) - 1), cx1 = Math.min(NC - 1, Math.floor(x1 / S) + 1), cy0 = Math.max(0, Math.floor(y0 / S) - 1), cy1 = Math.min(NC - 1, Math.floor(y1 / S) + 1);
    const g0 = GL.unproject(VW / 2, VH * 0.56, low) || [cam.x, cam.y], fx = cam.h > 40 ? g0[0] : cam.x, fy = cam.h > 40 ? g0[1] : cam.y, out = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * 1000 + cx; let v = this.vis.get(key); if (!v) this.vis.set(key, (v = new ChunkVis(this.W, cx, cy)));
      const d = Math.min(Math.hypot((cx + 0.5) * S - fx, (cy + 0.5) * S - fy), Math.hypot((cx + 0.5) * S - cam.x, (cy + 0.5) * S - cam.y)) / S; v.wantLod = d < 1.6 ? 0 : d < 3.2 ? 1 : 2; v.d = d; v.used = this.frameN; out.push(v);
    }
    out.sort((a, b) => a.d - b.d);
    if (this.vis.size > 260) for (const [k, v] of [...this.vis].sort((a, b) => a[1].used - b[1].used)) { if (this.vis.size <= 200) break; if (v.used < this.frameN - 30) { v.free(); this.vis.delete(k); } }
    return out;
  }
  // sky textures, per family, hour and height (the dream's skies clearer, the islands' higher and paler)
  sky(fam, hour, kind) {
    this.skies ||= new Map(); const key = `${fam}|${this.mode}|${kind}`; let s = this.skies.get(key);
    if (!s) {
      let cv; if (kind === 'cave') { cv = mk(16, 16); const x = cv.getContext('2d'); x.fillStyle = '#05060a'; x.fillRect(0, 0, 16, 16); }
      else { const S = kind === 'hi' ? hour.hiSky : kind === 'dream' ? hour.sky.map((c2, i) => (i < 2 ? c2 : hour.hiSky[i])) : hour.sky; cv = paintSky(256, 160, S[0], S[1], S[2], S[3], this.W.seed % 97, kind === 'hi' ? 6 : 4); }
      s = GL.texNew(cv.width, cv.height, cv, false, true); this.skies.set(key, s);
    }
    return s;
  }
  // billboards for everything alive; returns the lights to glow in the overlay
  entities(BM, BS, BA, K, PJ, cam) {
    const P = this.P, Wd = this.W, here = P.place, lights = [], near = (x, y, r = 560) => Math.abs(x - cam.x) < r && y > cam.y - r * 1.7 && y < cam.y + 240, AT = this.actorTex, ev = this.mode === 'evening';
    const person = (actor, slot, x, y, base, scale = 1, swim = false) => { const sh = actor.sheet; if (!sh?.ok || slot < 0) return; const r = AT.rect(slot, sh, actor.anim, actor.dir, actor.s.frame); if (!swim) BS.gd(shadowTex(14, 5), x, y, 14, 5, base + 0.4); BA.bbr(r, 40, 40, x, y, base - 3 * K * scale - (swim ? 11 : 0), K, 1, 1, scale); };
    // the walker (and the lift platform under them on a ride)
    if (this.ride) { const s = propSprite(this.ride.prop, 'rust', 0); if (s) BM.bb(s, 0, 0, s.width, s.height, P.x, P.y + 4, P.h - 6, K, 1, 1); lights.push([...PJ(P.x, P.y, 0, P.h + 20).slice(0, 2), 26, [255, 190, 110], 0.9]); }
    person(P.actor, this.heroSlot, P.x, P.y, P.hv, 1, P.swim);
    if (P.swim) for (let k = 0; k < 2; k++) { const a = this.t0 * 2 + k * 3.1; BS.gd(shadowTex(18, 6), P.x + Math.cos(a) * 2, P.y + 1, 20 + k * 6, 6 + k * 2, P.hv + 0.6); }
    if (!here) for (const n of this.npcs) if (near(n.x, n.y)) person(n.actor, n.slot, n.x, n.y, n.h);
    // the animals, birds, insects and sky creatures
    for (const b of this.beasts) {
      if (!near(b.x, b.y, b.A.ai === 'drift' || b.st === 'fly' ? 900 : 560)) continue; const fr = animalSprites(b.k, b.fam); if (!fr) continue;
      const A = b.A, bird = A.kind === 'bird', fi = bird ? (b.st === 'fly' || A.ai === 'soar' ? (b.f | 0) % 2 : A.swim ? 2 + ((b.f | 0) % 2) : (b.f | 0) % 4 >= 2 ? (b.f | 0) % 4 : 2) : (b.f | 0) % 4, F = fr[fi] || fr[0], s = b.dir >= 0 ? F.r : F.l, sc = A.scale || 1;
      const base = A.ai === 'swim' ? b.h - (bird ? 2 : 4) : b.base;
      if (b.alt < 50 && A.ai !== 'drift' && A.ai !== 'swim') BS.gd(shadowTex(s.width < 16 ? 10 : 20, s.width < 16 ? 4 : 6), b.x, b.y, s.width * 0.8 * sc, 5, (A.ai === 'flutter' || A.ai === 'bat' || b.st === 'fly' ? b.base : b.h) + 0.4, 1 - b.alt / 60);
      BM.bb(s, 0, 0, s.width, s.height, b.x, b.y, base + b.alt, K, 1, 1, undefined, 0, sc);
      if (A.glow && (ev || here?.kind === 'cave' || A.ai === 'drift' || A.bug === 'firefly')) { const g = hex(A.glow); lights.push([...PJ(b.x, b.y, 0, base + b.alt + 4 * sc).slice(0, 2), A.bug === 'firefly' ? 7 : 14 * sc, g, A.bug === 'firefly' ? (Math.sin(b.t * 2.6 + b.ph) > 0 ? 0.9 : 0.2) : 0.55]); }
    }
    // the chests already opened, and a glint on those still waiting
    for (const T of Wd.treasures) {
      if (T.place !== here) continue; const x = T.cx * TS + 8, y = T.cy * TS + 12; if (!near(x, y)) continue; const h = Wd.heightAt(x, y, here);
      if (T.found) { const s = propSprite('chestopen', 'dream', 0); if (s) BM.bb(s, 0, 0, s.width, s.height, x, y, h - 1.5, K, 1, 1); }
      else if (Math.sin(this.t0 * 2 + T.i) > 0.6) lights.push([...PJ(x, y, 0, h + 10).slice(0, 2), 12, [255, 230, 150], 0.9]);
    }
    // the giants: huge, and seen from far
    if (!here) for (const g of this.giants) {
      if (Math.abs(g.x - cam.x) > 1100 || g.y < cam.y - 1900 || g.y > cam.y + 400) continue; const fr = giantSprites(g.v % 2); if (!fr) continue; const s = g.dir >= 0 ? fr[g.f].r : fr[g.f].l, sc = 1.7;
      BS.gd(shadowTex(30, 9), g.x, g.y, 110, 26, g.base + 0.4); this.BG.bb(s, 0, 0, s.width, s.height, g.x, g.y, g.base - 2, K, 1, 1, undefined, 0, sc);
      lights.push([...PJ(g.x - g.dir * 19 * sc, g.y, 38 * sc, g.base).slice(0, 2), 30, [255, 200, 110], 0.8]);   // the lantern
    }
    // dust, splashes and sparkles, drawn in the overlay
    this.dustPts = this.fx.map((f) => { const [x, y] = PJ(f.x, f.y, 0, f.h); return [x, y, 1 - f.t / f.life, f.k]; });
    // lights from the chunks in view (fires, windows, lamps, lift beacons) and from the places
    const blink = 0.6 + 0.4 * (Math.sin(this.t0 * 3) > 0 ? 1 : 0);
    if (here?.kind !== 'cave') for (const v of this.vis.values()) { if (v.used !== this.frameN || v.lod < 0) continue; const C = Wd.chunk(v.cx, v.cy); for (const L of C.lights) { if (!near(L.x, L.y, 760)) continue; const [x, y] = PJ(L.x, L.y, 0, L.h), fl = L.fire ? 0.8 + Math.sin(this.t0 * 9 + L.x) * 0.15 : L.beacon ? blink : 1; lights.push([x, y, L.r, L.c, fl]); } }
    for (const pv of this.pvis.values()) { if (!pv.ok) continue; const M = Wd.place(pv.P); if ((pv.P.kind === 'cave') !== (here?.kind === 'cave')) continue; for (const L of M.lights) { const [x, y] = PJ(L.x, L.y, 0, L.h); lights.push([x, y, L.r, L.c, L.beacon ? blink : 1]); } }
    return lights;
  }

  // ------------------------------------------------ the one menu: map, treasures, graphics, the way home
  drawUI(c) {
    // the menu button
    c.save(); c.globalAlpha = this.ui ? 0.3 : 0.75; c.fillStyle = 'rgba(12,10,8,.55)'; c.beginPath(); c.arc(W - 24, 24, 15, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(232,220,196,.5)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#e8dcc4'; for (let k = -1; k <= 1; k++) c.fillRect(W - 31, 23 + k * 5, 14, 1.6); c.restore();
    // place names, quietly
    c.save(); c.font = '600 11px ui-monospace, Menlo, monospace'; c.textBaseline = 'top';
    this.toasts.forEach((t, i) => { const a = clamp(Math.min(t.t / 0.6, (4.5 - t.t) / 1.2), 0, 1) * 0.85; c.globalAlpha = a; c.fillStyle = '#000'; c.fillText(t.s.toUpperCase(), 15, 15 + i * 16); c.fillStyle = t.s.startsWith('Treasure') || t.s.startsWith('All twelve') ? '#f0d08a' : '#e8dcc4'; c.fillText(t.s.toUpperCase(), 14, 14 + i * 16); });
    c.restore();
    // the stick
    if (this.stick) { const s = this.stick; c.save(); c.globalAlpha = 0.35; c.strokeStyle = '#e8dcc4'; c.lineWidth = 1.5; c.beginPath(); c.arc(s.ox, s.oy, STICK_R, 0, 6.3); c.stroke(); c.globalAlpha = 0.6; c.fillStyle = '#e8dcc4'; c.beginPath(); c.arc(s.x, s.y, 9, 0, 6.3); c.fill(); c.restore(); }
    if (!this.ui) return;
    c.save(); c.fillStyle = 'rgba(8,7,6,.8)'; c.fillRect(0, 0, W, H); c.textBaseline = 'middle';
    const head = (s) => { c.font = '600 15px ui-monospace, Menlo, monospace'; c.fillStyle = '#e8dcc4'; c.fillText(s, 22, 34); c.fillStyle = 'rgba(232,220,196,.25)'; c.fillRect(22, 48, W - 44, 1); };
    this.uiR = [];
    if (this.ui === 'menu') {
      head('THE GARDEN'); const home = this.W.home, nf = this.W.treasures.filter((T) => T.found).length;
      const items = [['map', 'Map'], ['loot', `Treasures  ${nf} of 12`], ['gfx', 'Graphics'], ['home', `Back to ${home.name}`]];
      if (nf === 12) items.push(['new', 'Begin a new world']);
      items.push(['close', 'Close']);
      c.font = '14px ui-monospace, Menlo, monospace';
      items.forEach(([k, s], i) => { const y = 84 + i * 46; c.fillStyle = k === 'new' ? 'rgba(240,208,138,.18)' : 'rgba(232,220,196,.08)'; c.fillRect(22, y - 18, W - 44, 36); c.fillStyle = k === 'new' ? '#f0d08a' : '#e8dcc4'; c.fillText(s, 36, y); this.uiR.push({ k, x: 22, y: y - 18, w: W - 44, h: 36 }); });
      c.fillStyle = 'rgba(232,220,196,.45)'; c.font = '11px ui-monospace, Menlo, monospace'; c.fillText(`${this.lastPlace || ''}`, 22, H - 24);
    } else if (this.ui === 'map') this.drawMap(c, head);
    else if (this.ui === 'loot') this.drawLoot(c, head);
    else if (this.ui === 'gfx') this.drawGfx(c, head);
    c.restore();
  }
  uiDown(x, y) {
    if (this.ui === 'gfx') { const r = (this.uiR || []).find((q) => y >= q.y && y < q.y + q.h && x >= q.x && x < q.x + q.w); if (r?.slider && x >= r.sx - 6) { this.uiPress.drag = r; this.slide(r, x); } }
  }
  uiMove(x, y) { const p = this.uiPress; if (!p) return; p.moved += Math.abs(y - p.sy); if (p.drag) { this.slide(p.drag, x); return; } if (this.ui === 'gfx' && p.moved > 6) this.uiS = Math.max(0, Math.min(this.uiSMax || 0, p.s - (y - p.sy))); }
  uiUp(x, y) {
    const p = this.uiPress; this.uiPress = null; if (!p || p.drag || p.moved > 8) return;
    const r = (this.uiR || []).find((q) => y >= q.y && y < q.y + q.h && x >= q.x && x < q.x + q.w);
    if (this.ui === 'menu') {
      if (!r) return;
      if (r.k === 'close') this.ui = null;
      else if (r.k === 'new') { this.ui = null; this.newWorld(); }
      else if (r.k === 'home') { const v = this.W.home, P = this.P; this.ride = null; this.fade = null; Object.assign(P, { x: v.x * TS + 8, y: (v.y + v.rad + 2) * TS, place: null, goal: null, swim: false }); P.h = P.hv = this.W.heightAt(P.x, P.y, null); this.cam = { x: P.x, y: P.y, h: P.h }; this.beasts = []; this.ui = null; this.toast(v.name); }
      else { this.ui = r.k; this.uiS = 0; }
      return;
    }
    if (this.ui === 'map' || this.ui === 'loot') { this.ui = 'menu'; return; }
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
  // the twelve treasures: the ones found by name, the rest as a hint of where to look
  drawLoot(c, head) {
    head('TREASURES'); c.font = '12px ui-monospace, Menlo, monospace';
    this.W.treasures.forEach((T, i) => {
      const y = 70 + i * 25; c.fillStyle = T.found ? '#f0d08a' : 'rgba(232,220,196,.4)'; c.fillText(T.found ? '★' : '·', 24, y);
      const h = T.where === 'ground' ? HINT.ground[TREASURES_TAG(T)] : HINT[T.where]; c.fillStyle = T.found ? '#e8dcc4' : 'rgba(232,220,196,.55)'; c.fillText(T.found ? T.name : `? ${h}`, 40, y);
    });
    c.fillStyle = 'rgba(232,220,196,.5)'; c.font = '10px ui-monospace, Menlo, monospace'; c.fillText(this.W.treasures.every((T) => T.found) ? 'all found: begin a new world from the menu' : 'tap to go back', 22, H - 22);
  }
  // the map: the country as far as you have walked it, villages, the city, the heights, the canyons,
  // the islands and the giant trees, the treasures found, the giants
  drawMap(c, head) {
    head('MAP'); const Wd = this.W, N = 160, S = W - 44, ox = 22, oy = 60, step = WT / N;
    if (!this.mapCv) { this.mapCv = mk(N, N); this.mapRow = 0; }
    const mx = this.mapCv.getContext('2d'), t0 = performance.now();
    while (this.mapRow < N && performance.now() - t0 < 12) {
      const y = this.mapRow++;
      for (let x = 0; x < N; x++) {
        const tx = Math.floor((x + 0.5) * step), ty = Math.floor((y + 0.5) * step), t = Wd.tileInfo(tx, ty), B = BIOMES[BIOME_KEYS[t.b]];
        let col = hex(B.g[1][0]);
        if (t.k === K_WATER || t.k === 7) col = B.fam === 'ash' ? [36, 32, 42] : B.dream ? [58, 154, 184] : [44, 74, 80];
        else if (t.k === K_CLIFF) col = [74, 66, 56]; else if (t.k === K_BLDG) col = [90, 90, 98]; else if (t.k === 9 || t.k === 1 || t.k === 6) col = [140, 118, 90];
        if (t.e >= 200) col = [232, 238, 240]; else if (t.e > 0) col = col.map((v) => Math.min(255, v * (1 + t.e / 300))); else if (t.e < -40) col = col.map((v) => v * 0.45);
        mx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; mx.fillRect(x, y, 1, 1);
      }
    }
    c.imageSmoothingEnabled = false; c.drawImage(this.mapCv, ox, oy, S, S);
    // the unwalked country, dimmed: one pixel per chunk, scaled up in one go (no seams)
    this.fogMap ||= mk(NC, NC); const fx2 = this.fogMap.getContext('2d'), fimg = fx2.createImageData(NC, NC); for (let q = 0; q < NC * NC; q++) { fimg.data[q * 4 + 3] = this.explored[q] ? 0 : 184; fimg.data[q * 4] = 8; fimg.data[q * 4 + 1] = 7; fimg.data[q * 4 + 2] = 6; } fx2.putImageData(fimg, 0, 0); c.drawImage(this.fogMap, ox, oy, S, S);
    const at = (x, y) => [ox + (x / WT) * S, oy + (y / WT) * S], seen = (x, y) => this.explored[clamp(Math.floor(y / CS), 0, NC - 1) * NC + clamp(Math.floor(x / CS), 0, NC - 1)];
    c.font = '9px ui-monospace, Menlo, monospace'; c.textBaseline = 'middle';
    for (const v of Wd.villages) { const [x, y] = at(v.x, v.y), sn = seen(v.x, v.y); c.fillStyle = sn ? '#f0d08a' : 'rgba(240,208,138,.35)'; c.fillRect(x - 1.5, y - 1.5, 3, 3); if (sn) { c.fillStyle = '#e8dcc4'; c.fillText(v.name, x + 4, y); } }
    for (const Q of Wd.places) {
      if (Q.kind === 'isle') { const [x, y] = at(Q.x, Q.y); c.strokeStyle = 'rgba(200,220,240,.6)'; c.beginPath(); c.arc(x, y, (Q.rad / WT) * S, 0, 6.3); c.stroke(); }
      else if (Q.kind === 'canopy') { const [x, y] = at(Q.x, Q.y); c.fillStyle = 'rgba(120,200,110,.85)'; c.beginPath(); c.arc(x, y, 2.4, 0, 6.3); c.fill(); }
      else if (Q.mouth && seen(Q.mouth.x, Q.mouth.y)) { const [x, y] = at(Q.mouth.x, Q.mouth.y); c.fillStyle = '#6ad0b0'; c.fillRect(x - 1, y - 1, 2, 2); }
    }
    for (const T of Wd.treasures) { const ax = T.place ? (T.place.kind === 'cave' ? T.place.mouth.x : T.place.x) : T.lx, ay = T.place ? (T.place.kind === 'cave' ? T.place.mouth.y : T.place.y) : T.ly, [x, y] = at(ax, ay); if (T.found) { c.fillStyle = '#ffd860'; c.fillText('★', x - 3, y); } }
    for (const g of this.giants) { const [x, y] = at(g.x / TS, g.y / TS); c.fillStyle = 'rgba(160,200,120,.8)'; c.fillRect(x - 1, y - 2, 2, 4); }
    const here = this.P.place, px0 = here ? (here.kind === 'cave' ? here.mouth.x * TS : here.x * TS) : this.P.x, py0 = here ? (here.kind === 'cave' ? here.mouth.y * TS : here.y * TS) : this.P.y, [px, py] = at(px0 / TS, py0 / TS);
    c.fillStyle = '#ff7a3a'; c.beginPath(); c.arc(px, py, 3, 0, 6.3); c.fill(); c.strokeStyle = '#000'; c.stroke();
    c.fillStyle = 'rgba(232,220,196,.5)'; c.font = '10px ui-monospace, Menlo, monospace'; c.fillText('tap to go back', ox, oy + S + 16);
  }
}
const TREASURES_TAG = (T) => (T.land === 'obelisk' ? 'forgot' : 'dream');
