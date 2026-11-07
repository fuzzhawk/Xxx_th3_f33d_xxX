// Monster Battle: catch-and-collect. Your Crystal Sprite trainer and lead spirit wander a seeded region
// (overworld.js), meet wild spirits in the tall grass, battle with anime flair (animefx.js) using elements,
// moves and status from moves.js, weaken and catch them, raise a team of six that levels up and evolves,
// beat the route's trainers, heal at the shrine and fill the dex. Self-plays; tap to walk, talk and fight.
// (The fighting game lives in brawl.js.)
import { Game, W, H, roundRect, ready } from './engine.js';
import { Actor, drawFrame } from '../crystal/sprites.js';
import { creatureName } from './creature.js';
import { genome } from '../spirits.js';
import { mulberry32 } from '../util.js';
import { Region, TS, N, TALL, DOOR, open, D4, css } from './overworld.js';
import { ELEMENTS, ECOL, EKAN, eff, STATUS, WEATHER, wordFor, ultFor, makeMon, calc, need, sprite, mini, stageMul, formName, tierAt } from './moves.js';
import { Fx, silhouette, JFONT } from './animefx.js';

const D4N = ['S', 'W', 'N', 'E'], TAU = Math.PI * 2;
const dirOf = (dx, dy) => (dy > 0 ? 'S' : dy < 0 ? 'N' : dx < 0 ? 'W' : 'E');
const POS = [[118, 268], [264, 156]], SC = 2, BX = W - 36, BY = H - 115;
const STAT = { atk: 'Attack', def: 'Defense', sat: 'Sp. Atk', sdf: 'Sp. Def', spd: 'Speed', acc: 'accuracy', eva: 'evasion' };
const TITLE = ['Bug Catcher', 'Shrine Maiden', 'Hiker', 'Ace Trainer', 'Mystic', 'Ranger', 'Fisher', 'Lass'];
const HELLO = ['Our eyes met! That means a battle!', 'My spirits are itching for a fight!', 'You look strong. Show me!', "I've trained here all day!"];
const BYE = ['Wow… you two are in sync.', 'My spirits need a rest…', "I'll train harder. See you!", 'What a battle! Rest up at the shrine.'];
const CHAT = ['The tall grass is full of spirits!', 'Weaken a spirit before you throw an orb.', 'Rest at the shrine when your team is tired.', 'Trainers on the road battle anyone they spot!', 'Spirits evolve when they grow strong.'];
const WXON = { sun: 'The sunlight turned harsh!', rain: 'It started to rain!', sand: 'A sandstorm kicked up!', bloom: 'Flowers burst into bloom!', eclipse: 'The sun was eclipsed!', aurora: 'An aurora shimmers overhead!' };
const WXOFF = { sun: 'The sunlight faded.', rain: 'The rain stopped.', sand: 'The sandstorm subsided.', bloom: 'The blossoms scattered.', eclipse: 'The eclipse passed.', aurora: 'The aurora faded.' };
const STON = { brn: ['was burned!', '火傷', 'fire'], psn: ['was poisoned!', '毒', 'shadow'], slp: ['fell asleep!', '眠り', 'spirit'], par: ['is paralysed! It may be unable to move!', '麻痺', 'beast'] };
const ACTS = [['FIGHT', 'たたかう', '#ff7a5a'], ['ORB', 'つかまえる', '#ff6ab8'], ['TEAM', 'なかま', '#62d85e'], ['RUN', 'にげる', '#56a8ff']];
const SEASON_KAN = { summer: '夏', autumn: '秋', winter: '冬', spring: '春', night: '夜', ink: '墨' };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const ease = (k) => 1 - (1 - k) ** 3, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tone = (c, k) => css(c.map((v) => (k < 0 ? v * (1 + k) : v + (255 - v) * k)));

export class Monsters extends Game {
  static noMods = ['mirror', 'wobble', 'swarm', 'lowg', 'heavy', 'trails', 'giant', 'tiny'];
  setup() {
    const s = this.post.seed || 1, R = (this.region = new Region(s, this.skin.pal)), T = R.town;
    this.night = R.B.season === 'night' || s % 6 === 5; this.dusk = !this.night && s % 5 === 2;
    this.fx = new Fx(W, H); this.wfx = new Fx(W, H);
    this.pickSpecies(s);
    this.team = [makeMon(this.starter, 6)]; this.caught = new Set([this.starter]); this.seen = new Set([this.starter]); this.box = [];
    this.orbs = 6; this.steps = 0; this.grace = 2; this.encs = 0; this.hunt = 0; this.pauseT = 0; this.banner = 3.4;
    this.mode = 'world'; this.menu = null; this.msg = ''; this.msgT = 0; this.script = null; this.wait = 0;
    this.me = this.walker(T.step[0], T.step[1], 'S', this.skin.crystal(0, 'Fantasy', D4N));
    this.fol = { x: T.step[0], y: T.step[1], px: 0, py: 0, mv: null, face: 1, dist: 0 }; this.place(this.fol);
    this.npcs = R.trainers.map((t, k) => {
      const w = this.walker(t.x, t.y, dirOf(...t.face), this.skin.crystal(2 + k, k % 3 === 1 ? 'Present day' : 'Fantasy', D4N)), RR = mulberry32(s * 31 + k);
      Object.assign(w, { kind: 'trainer', k, face: t.face, home: [t.x, t.y], lv: 5 + k * 2, beaten: false, name: `${TITLE[(s + k * 3) % TITLE.length]} ${creatureName(s * 7 + k * 13).slice(0, 6)}` });
      w.team = Array.from({ length: [1, 2, 2, 3][k] || 2 }, (_, i) => makeMon(this.pool[Math.floor(RR() * this.pool.length)], w.lv - 1 + i));
      return w;
    });
    for (let k = 0; k < 2 && T.free.length; k++) { const [x, y] = T.free[(s * 7 + k * 11) % T.free.length]; if (!this.free(x, y)) continue; const w = this.walker(x, y, 'S', this.skin.crystal(8 + k, k ? 'Present day' : 'Fantasy', D4N)); Object.assign(w, { kind: 'villager', k, idle: 1 + k }); this.npcs.push(w); }
    this.cam = { x: clamp(this.me.px - W / 2, 0, N * TS - W), y: clamp(this.me.py - H / 2, 0, N * TS - H) };
    this.amb = Array.from({ length: 22 }, () => ({ x: this.r(0, W), y: this.r(0, H), ph: this.r(0, TAU), s: this.r(0.6, 1.4) }));
  }
  // a starter from the classic fire/water/leaf triangle and a regional pool that covers the eight elements
  pickSpecies(s) {
    const R = mulberry32((s ^ 0x1f2e3d) >>> 0), find = (el, avoid) => { for (let k = 0; k < 500; k++) { const sd = Math.floor(R() * 1e9) + 1; if (!avoid.includes(sd) && (!el || genome(sd, 0, 0).element === el)) return sd; } return Math.floor(R() * 1e9) + 1; };
    this.starter = find(['fire', 'water', 'leaf'][s % 3], []);
    const els = [...ELEMENTS]; for (let i = els.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [els[i], els[j]] = [els[j], els[i]]; }
    this.pool = [];
    for (const el of [...els, null]) this.pool.push(find(el, [this.starter, ...this.pool]));
    const P = this.pool, n = P.length;
    const cnt = clamp(Math.ceil(n / Math.max(1, this.region.zones.length)) + 1, 3, 5);
    this.zones = this.region.zones.map((z, k) => ({ ...z, sp: Array.from({ length: cnt }, (_, j) => P[(k * (cnt - 1) + j) % n]), lv: 3 + Math.floor(z.dist / 6) }));
    if (!this.zones.length) this.zones = [{ id: 0, tiles: [], mid: this.region.town.step, dist: 6, sp: P.slice(0, 5), lv: 4 }];
    this.dexTotal = new Set([this.starter, ...this.zones.flatMap((z) => z.sp)]).size;
  }
  walker(x, y, dir, sheet) { const w = { x, y, px: 0, py: 0, mv: null, path: [], actor: new Actor(sheet, { mode: 'four', dir, walkSpeed: 4, runSpeed: 115, walkStride: 7, runStride: 11 }) }; this.place(w); return w; }
  place(w) { w.px = w.x * TS + TS / 2; w.py = w.y * TS + TS - 4; }
  free(x, y) { return open(this.region.at(x, y)) && !this.npcs?.some((n) => n.x === x && n.y === y); }
  lead() { return this.team.find((m) => m.hp > 0) || this.team[0]; }
  path(w, tx, ty) {
    if (!open(this.region.at(tx, ty))) return null;
    const prev = new Int32Array(N * N).fill(-1), s = w.y * N + w.x, g = ty * N + tx, q = [s]; prev[s] = s;
    for (let h = 0; h < q.length && prev[g] < 0; h++) { const i = q[h], x = i % N, y = (i / N) | 0; for (const [a, b] of D4) { const X = x + a, Y = y + b, j = Y * N + X; if (X >= 0 && Y >= 0 && X < N && Y < N && prev[j] < 0 && (j === g || this.free(X, Y))) { prev[j] = i; q.push(j); } } }
    if (prev[g] < 0) return null;
    const out = []; for (let i = g; i !== s; i = prev[i]) out.unshift([i % N, (i / N) | 0]); return out;
  }
  goTo(t, walk = 0) { const p = this.path(this.me, t[0], t[1]); this.me.path = p || []; this.me.walkMode = walk; if (!p) this.pauseT = 0.6; }
  // ---------------------------------------------------------------- scripts (generators: `yield s` waits s seconds)
  run(g) { this.script = g; this.wait = 0; }
  tickScript(dt) {
    if (!this.script) return;
    this.wait -= dt; if (this.wait > 0) return;
    try { const r = this.script.next(); if (r.done) this.script = null; else this.wait = r.value || 0; } catch (e) { console.error(e); this.script = null; this.recover(); }
  }
  recover() { this.mode = 'world'; this.menu = null; this.msg = ''; this.bt = null; this.trans = null; this.ball = null; this.evo = null; this.card = null; this.fx.clear(); }
  *say(text, hold = 0.75) { this.msg = text; this.msgT = 0; this.skip = 0; const T = text.length / 110 + hold * (this.auto ? 0.75 : 1.3); for (let t = 0; t < T && !this.skip; t += 0.05) yield 0.05; this.skip = 0; }
  // ---------------------------------------------------------------- frame
  step(dt) {
    if (this.msg && this.msgT < this.msg.length) this.msgT += dt * 110;
    if (this.trans) { this.trans.t += dt; if (this.trans.t >= this.trans.dur) this.trans = null; }
    if (this.card) this.card.t += dt;
    if (this.fx.stop > 0) { this.fx.stop -= dt; this.fx.update(dt * 0.15); return; }
    this.fx.update(dt); this.wfx.update(dt);
    this.tickScript(dt);
    if (this.mode === 'world') this.worldStep(dt);
    else if (this.mode === 'battle' && this.bt) this.battleStep(dt);
    else if (this.mode === 'evo' && this.evo) { this.evo.t += dt; this.me.actor.update(dt, {}); }
  }
  autopilot(dt) {
    if (this.mode === 'world') { if (this.pauseT > 0) this.pauseT -= dt; else if (!this.script && !this.me.mv && !this.me.path.length) this.plan(); }
    else if (this.mode === 'battle' && this.menu && !this.pick) this.autoPick(dt);
  }
  // ---------------------------------------------------------------- overworld
  worldStep(dt) {
    const P = this.me;
    for (const w of [P, ...this.npcs]) this.moveW(w, dt);
    this.moveF(dt);
    if (!this.script) {
      if (this.banner > 0) this.banner -= dt;
      if (!P.mv && P.path.length) this.stepP();
      for (const n of this.npcs) if (n.kind === 'villager' && !n.mv && (n.idle -= dt) < 0) {
        n.idle = this.r(1.5, 4); const [a, b] = D4[this.ri(0, 3)], x = n.x + a, y = n.y + b, T = this.region.town;
        if (x > T.x && x < T.x + 11 && y > T.y && y < T.y + 9 && this.free(x, y) && !(x === P.x && y === P.y) && !(x === this.fol.x && y === this.fol.y)) this.go(n, x, y, 2.2);
      }
    }
    const tx = clamp(P.px - W / 2, 0, N * TS - W), ty = clamp(P.py - H / 2 - 12, 0, N * TS - H), k = Math.min(1, dt * 7);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
  }
  go(w, x, y, sp) { w.mv = { fx: w.x, fy: w.y, t: 0, sp }; w.x = x; w.y = y; }
  moveW(w, dt) {
    if (w.mv) {
      const m = w.mv; m.t = Math.min(1, m.t + dt * m.sp);
      w.px = (m.fx + (w.x - m.fx) * m.t) * TS + TS / 2; w.py = (m.fy + (w.y - m.fy) * m.t) * TS + TS - 4;
      if (m.t >= 1) { w.mv = null; if (w === this.me) { this.arrive(); if (!this.script && w.path.length) this.stepP(); } }
    }
    const m = w.mv;
    w.actor.update(dt, m ? { vx: (w.x - m.fx) * m.sp * TS, vy: (w.y - m.fy) * m.sp * TS } : {});
  }
  moveF(dt) {
    const F = this.fol, m = F.mv; if (!m) return;
    m.t = Math.min(1, m.t + dt * m.sp); F.dist += dt * m.sp * TS;
    F.px = (m.fx + (F.x - m.fx) * m.t) * TS + TS / 2; F.py = (m.fy + (F.y - m.fy) * m.t) * TS + TS - 6;
    if (m.t >= 1) F.mv = null;
  }
  stepP() {
    const P = this.me, [nx, ny] = P.path[0];
    if (Math.abs(nx - P.x) + Math.abs(ny - P.y) !== 1 || !this.free(nx, ny)) { P.path = []; return; }
    P.path.shift();
    const ox = P.x, oy = P.y, sp = P.walkMode || (P.path.length >= 2 ? 6.2 : 3.8);
    this.go(P, nx, ny, sp);
    const F = this.fol; // the lead spirit takes the tile we left
    if (Math.abs(F.x - ox) + Math.abs(F.y - oy) === 1) { if (ox !== F.x) F.face = ox > F.x ? 1 : -1; F.mv = { fx: F.x, fy: F.y, t: 0, sp }; F.x = ox; F.y = oy; }
    else if (F.x !== ox || F.y !== oy) { F.x = ox; F.y = oy; F.mv = null; this.place(F); F.py -= 2; }
  }
  arrive() {
    const P = this.me, R = this.region, t = R.at(P.x, P.y); this.steps++;
    if (t === TALL) this.wfx.emit('leaf', P.px, P.py - 3, 5, 60, { dir: -Math.PI / 2, spread: 1.8 });
    if (t === DOOR) { P.path = []; this.run(this.healAt()); return; }
    for (const n of this.npcs) if (n.kind === 'trainer' && !n.beaten && this.sees(n)) { P.path = []; this.run(this.trainer(n)); return; }
    if (P.talk && !P.path.length && Math.abs(P.talk.x - P.x) + Math.abs(P.talk.y - P.y) === 1) { const n = P.talk; P.talk = null; this.run(this.talk(n)); return; }
    if (t === TALL && this.steps > this.grace && (this.rng() < (this.encs ? 0.1 : 0.2) || this.steps > this.grace + 16)) { P.path = []; this.run(this.wild()); return; }
    for (const n of this.npcs) if (n.kind === 'villager' && !n.mv && Math.abs(n.x - P.x) + Math.abs(n.y - P.y) <= 2 && this.t > (n.greet || 0)) {
      n.greet = this.t + 14; n.actor.face(dirOf(P.x - n.x, P.y - n.y)); n.actor.emote('wave', 1.5);
      if (this.auto) { P.path = []; this.pauseT = 1.4; P.actor.face(dirOf(n.x - P.x, n.y - P.y)); P.actor.emote('wave', 1.3); }
    }
  }
  sees(n) {
    const P = this.me, [fx, fy] = n.face, dx = P.x - n.x, dy = P.y - n.y, d = dx * fx + dy * fy;
    if (dx * fy - dy * fx !== 0 || d < 1 || d > 4) return false;
    for (let i = 1; i < d; i++) if (!this.free(n.x + fx * i, n.y + fy * i)) return false;
    return true;
  }
  zoneAt(x, y) { const i = this.region.zoneAt[y * N + x]; return this.zones.find((z) => z.id === i) || this.zones[0]; }
  // autopilot: heal when hurt, challenge trainers when strong enough, otherwise hunt where new species live
  plan() {
    const P = this.me, R = this.region, T = R.town, hp = this.team.reduce((s, m) => s + m.hp / m.max, 0) / this.team.length, L = this.team[0];
    if (this.team.some((m) => m.hp <= 0) || hp < 0.5 || L.hp < L.max * 0.3 || (!this.orbs && this.caught.size < this.dexTotal)) return this.goTo(T.door);
    const top = Math.max(...this.team.map((m) => m.lv));
    for (const n of this.npcs) if (n.kind === 'trainer' && n.beaten && this.t > n.rematch) { n.beaten = false; n.lv += 3; for (const m of n.team) { m.lv += 3; m.tier = tierAt(m.sp, m.lv); m.name = formName(m.sp, m.tier); calc(m, true); } }
    const ready = this.encs >= 3 && (this.caught.size >= 3 || this.team.length >= 3 || this.encs >= 8);
    const tr = ready && this.npcs.find((n) => n.kind === 'trainer' && !n.beaten && top >= n.lv - 1 && hp > 0.7);
    if (tr) {
      let best = null;
      for (let d = 4; d >= 1; d--) { const x = tr.x + tr.face[0] * d, y = tr.y + tr.face[1] * d; if (!this.free(x, y)) { best = null; continue; } const p = this.path(P, x, y); if (p && (!best || p.length < best.length)) best = p; }
      if (best?.length) { P.path = best; P.walkMode = 0; return; }
    }
    if (R.at(P.x, P.y) === TALL && this.hunt > 0) {
      this.hunt--;
      const opts = D4.map(([a, b]) => [P.x + a, P.y + b]).filter(([x, y]) => R.at(x, y) === TALL && this.free(x, y) && !(x === this.fol.x && y === this.fol.y));
      if (opts.length) { P.path = [opts[Math.floor(this.rng() * opts.length)]]; P.walkMode = 3.3; return; }
    }
    const want = this.zones.filter((z) => z.tiles.length && z.sp.some((sd) => !this.caught.has(sd))), list = want.length ? want : this.zones.filter((z) => z.tiles.length);
    if (!list.length) return this.goTo(T.exits[this.ri(0, 3)]);
    const score = (z) => Math.abs(z.lv - top + 1) * 2 + (Math.abs(z.mid[0] - P.x) + Math.abs(z.mid[1] - P.y)) * 0.15 + this.r(0, 3);
    const z = list.reduce((a, b) => (score(b) < score(a) ? b : a)), i = z.tiles[Math.floor(this.rng() * z.tiles.length)];
    this.hunt = this.ri(6, 14); this.goTo([i % N, (i / N) | 0]);
  }
  *healAt() {
    const P = this.me; P.actor.face('N');
    yield* this.say('The shrine spirits hum softly…', 0.3);
    for (const m of this.team) { m.hp = m.max; m.status = null; }
    this.orbs = Math.max(this.orbs, 6);
    this.wfx.emit('spirit', P.px, P.py - 16, 30, 120); this.wfx.ring(P.px, P.py - 10, '#ffe8a0', 6, 46, 0.7, 3); P.actor.emote('cheer', 1.4);
    yield* this.say('Your team is fully healed! Catch orbs restocked.', 0.5);
    P.path = [this.region.town.step]; P.walkMode = 3.4; this.grace = this.steps + 2;
  }
  *talk(n) {
    const P = this.me; P.actor.face(dirOf(n.x - P.x, n.y - P.y)); n.actor.face(dirOf(P.x - n.x, P.y - n.y));
    if (n.kind === 'trainer' && !n.beaten) return yield* this.trainer(n, true);
    n.actor.emote(n.kind === 'trainer' ? 'laugh' : 'wave', 1.5); P.actor.emote('wave', 1.2);
    yield* this.say(n.kind === 'trainer' ? `${n.name}: ${BYE[n.k % BYE.length]}` : CHAT[this.ri(0, CHAT.length - 1)], 0.9);
  }
  *trainer(n, talked) {
    const P = this.me;
    n.alert = 1; n.actor.emote('surprise', 0.8); yield 0.75; n.alert = 0;
    if (!talked) { const p = this.path(n, P.x, P.y) || []; p.pop(); for (const [x, y] of p) { this.go(n, x, y, 5); while (n.mv) yield 0; } }
    n.actor.face(dirOf(P.x - n.x, P.y - n.y)); P.actor.face(dirOf(n.x - P.x, n.y - P.y)); n.actor.emote('angry', 1.2);
    yield* this.say(`${n.name}: ${HELLO[n.k % HELLO.length]}`, 0.6);
    const res = yield* this.battle(n.team, n);
    if (res === 'won') {
      n.beaten = true; n.rematch = this.t + 150; this.orbs += 2; this.score += 200;
      yield* this.say(`${n.name}: ${BYE[n.k % BYE.length]}`, 0.6); yield* this.say('You received 2 catch orbs!', 0.4);
    }
    for (const m of n.team) { m.hp = m.max; m.status = null; }
  }
  *wild() {
    const z = this.zoneAt(this.me.x, this.me.y), L = z.sp.length; let roll = this.rng() * ((L * (L + 1)) / 2), j = 0;
    while (roll >= L - j && j < L - 1) roll -= L - j++;
    const sd = z.sp[j];
    const beaten = this.npcs.filter((n) => n.beaten).length, lv = Math.max(2, z.lv + this.ri(-1, 1) + Math.floor(beaten * 0.7));
    this.me.actor.emote('surprise', 0.6);
    yield* this.battle([makeMon(sd, lv)], null);
  }
  // ---------------------------------------------------------------- battle flow
  *battle(foes, tr) {
    const lead = this.team.find((m) => m.hp > 0); if (!lead) return 'lost';
    this.encs++;
    this.trans = { k: tr ? 'vs' : 'wild', t: 0, dur: tr ? 2.1 : 1.2, tr, lead };
    for (const m of [...foes, lead]) { const s = sprite(m); yield 0; void s.attack; yield 0; void s.hurt; yield 0; void s.dead; }
    while (this.trans && this.trans.t < this.trans.dur - 0.03) yield 0;
    this.mode = 'battle'; this.trans = { k: 'in', t: 0, dur: 0.5 }; this.fx.clear(); this.msg = '';
    this.bt = { foes, tr, wx: null, turn: 0, orbsUsed: 0, swapped: 0, trOff: tr ? 0 : 200, bg: this.battleBg(!!tr), moved: [0, 0] };
    this.bs = [this.side(lead), this.side(foes[0])]; this.bs[0].hidden = true; this.bs[1].slide = 1; if (tr) this.bs[1].hidden = true;
    this.me.actor.face('E'); if (tr) tr.actor.face('W');
    for (const m of foes) this.seen.add(m.seed);
    const res = yield* this.fight();
    const P = this.me;
    if (res === 'won' || res === 'caught') P.actor.emote('cheer', 1.6);
    if (res === 'won' && tr) { this.bt.trBack = 1; tr.actor.emote('sad', 2); }
    if (res === 'lost') { P.actor.emote('sad', 2.5); yield* this.say('You have no spirits left that can fight!', 0.7); yield* this.say('You hurried back to the shrine…', 0.4); }
    yield 0.5;
    this.trans = { k: 'fade', t: 0, dur: 0.8 }; yield 0.4;
    this.mode = 'world'; this.menu = null; this.msg = ''; this.bt = null; this.ball = null; this.fx.clear();
    for (const m of this.team) { m.st = null; m.daze = 0; }
    if (tr) { tr.x = tr.home[0]; tr.y = tr.home[1]; this.place(tr); tr.actor.face(dirOf(...tr.face)); }
    if (res === 'lost') { const T = this.region.town; P.x = T.step[0]; P.y = T.step[1]; P.path = []; this.place(P); Object.assign(this.fol, { x: P.x, y: P.y - 1, mv: null }); this.place(this.fol); for (const m of this.team) { m.hp = m.max; m.status = null; } }
    if (this.auto) this.team.sort((a, b) => (b.hp > 0) - (a.hp > 0) || b.lv - a.lv);
    this.steps = 0; this.grace = 3;
    yield 0.4;
    for (const m of this.team) if (m.evolve && m.hp > 0) yield* this.evolve(m);
    if (res === 'lost') yield* this.say('The shrine spirits healed your team.', 0.6);
    return res;
  }
  side(m) { this.reset(m); return { m, lungeT: 0, lungeD: 0, lungeK: 1, atk: 0, hurt: 0, faint: 0, enter: 1, white: 0, scale: 1, hidden: false, slide: 0, dodge: 0, hop: 0, out: false }; }
  reset(m) { m.st = { atk: 0, def: 0, sat: 0, sdf: 0, spd: 0, acc: 0, eva: 0 }; m.daze = 0; m.flinch = 0; m.hpShow = m.hp; }
  nm(s) { const m = this.bs[s].m; return s ? `${this.bt.tr ? 'Foe' : 'Wild'} ${m.name}` : m.name; }
  mid(s) { const m = this.bs[s].m, sz = sprite(m).size * SC; return [POS[s][0], POS[s][1] - sz * 0.42 - (sprite(m).floats ? 8 : 0)]; }
  *fight() {
    const bt = this.bt, foe = bt.foes[0];
    yield 0.45;
    if (!bt.tr) { this.bs[1].hop = 0.4; this.fx.ring(...this.mid(1), ECOL[foe.el], 10, 70, 0.45, 3); }
    yield* this.say(bt.tr ? `${bt.tr.name} wants to battle!` : `A wild ${foe.name} appeared!`, 0.5);
    if (bt.tr) { bt.trGo = 1; yield* this.sendOut(1, foe); }
    yield* this.sendOut(0, this.bs[0].m);
    for (;;) {
      const act = yield* this.choose();
      const res = yield* this.turn(act);
      if (res) return res;
    }
  }
  *sendOut(s, m) {
    const S = this.bs[s]; S.m = m; this.reset(m); S.hidden = true; S.faint = 0; S.out = false;
    if (s === 0) { this.me.actor.attack(); yield* this.say(`Go! ${m.name}!`, 0.05); } else yield* this.say(`${this.bt.tr.name} sent out ${m.name}!`, 0.05);
    const [x, y] = POS[s], from = s ? [W + 10, 70] : [44, 214];
    this.fx.add({ dur: 0.35, draw: (c, k) => this.drawOrb(c, from[0] + (x - from[0]) * k, from[1] + (y - 40 - from[1]) * k - Math.sin(k * Math.PI) * 50, 7, k * 14) });
    yield 0.35;
    this.fx.flash('#fff', 0.15); this.fx.ring(x, y - 34, '#fff', 6, 70, 0.4); this.fx.emit('spirit', x, y - 34, 16, 150); this.fx.word(EKAN[m.el], x, y - 92, ECOL[m.el], 30, '', 0.7);
    S.hidden = false; S.enter = 0; this.seen.add(m.seed);
    yield 0.5;
  }
  *choose() {
    this.menu = 'act'; this.pick = null; this.cursor = null; this.ap = null; this.forced = false;
    this.msg = `What will ${this.bs[0].m.name} do?`; this.msgT = 99; this.me.actor.emote('think', 1.4);
    while (!this.pick) yield 0;
    const p = this.pick; this.menu = null; this.pick = null; this.cursor = null;
    return p;
  }
  *chooseSwap() {
    this.menu = 'team'; this.forced = true; this.pick = null; this.cursor = null; this.ap = null; this.msg = 'Choose your next spirit!'; this.msgT = 99;
    while (!this.pick) yield 0;
    const i = this.pick.i; this.menu = null; this.pick = null; this.forced = false; this.cursor = null;
    return i;
  }
  *turn(act) {
    const bt = this.bt; bt.turn++; bt.moved = [0, 0];
    const fm = this.foeMove();
    if (act.kind === 'run') { if (this.rng() < 0.5 + (0.3 * this.bs[0].m.spd) / this.bs[1].m.spd) { yield* this.say('Got away safely!', 0.4); return 'ran'; } yield* this.say("Couldn't get away!", 0.4); }
    else if (act.kind === 'swap') yield* this.swap(act.i);
    else if (act.kind === 'orb' && (yield* this.throwOrb())) return 'caught';
    const spd = (m) => m.spd * stageMul(m.st.spd) * (m.status === 'par' ? 0.5 : 1);
    const order = [[1, fm, this.bs[1].m]]; if (act.kind === 'move') order.push([0, act.mv, this.bs[0].m]);
    order.sort((a, b) => (b[1].pri || 0) - (a[1].pri || 0) || spd(b[2]) - spd(a[2]) || b[0] - a[0]);
    for (const [s, mv, m] of order) {
      if (this.bs[s].m !== m || m.hp <= 0 || this.bs[1 - s].m.hp <= 0) continue;
      yield* this.useMove(s, mv); bt.moved[s] = 1;
      const r = yield* this.faints(); if (r) return r;
    }
    yield* this.endTurn();
    return yield* this.faints();
  }
  foeMove() { const m = this.bs[1].m; return m.gauge >= 1 && (this.bt.tr || this.rng() < 0.4) ? ultFor(m) : this.bestMove(m, this.bs[0].m, this.bt.tr ? 25 : 80); }
  *useMove(s, mv) {
    const a = this.bs[s].m, d = this.bs[1 - s].m, fx = this.fx, [ax, ay] = this.mid(s), [dx, dy] = this.mid(1 - s);
    if (a.status === 'slp') { if (--a.slp > 0) { fx.word('Zzz…', ax + 24, ay - 40, '#cfe0ff', 24); yield* this.say(`${this.nm(s)} is fast asleep.`, 0.45); return; } a.status = null; yield* this.say(`${this.nm(s)} woke up!`, 0.35); }
    if (a.status === 'par' && this.rng() < 0.25) { fx.emit('beast', ax, ay, 14, 160); fx.shake = 5; yield* this.say(`${this.nm(s)} is paralysed! It can't move!`, 0.45); return; }
    if (a.flinch) { a.flinch = 0; fx.word('ひるみ', ax, ay - 50, '#fff', 24, 'FLINCH'); yield* this.say(`${this.nm(s)} flinched!`, 0.4); return; }
    if (a.daze > 0) {
      if (--a.daze === 0) yield* this.say(`${this.nm(s)} snapped out of its daze!`, 0.3);
      else { fx.emit('spirit', ax, ay - 34, 6, 60); yield* this.say(`${this.nm(s)} is dazed…`, 0.25); if (this.rng() < 0.33) { this.hurt(s, this.dmgCalc(a, a, { p: 40, k: 'p', e: 'none' }, false, 1), 0.3); yield* this.say('It hurt itself in its daze!', 0.45); return; } }
    }
    if (mv.ult) { a.gauge = 0; fx.cutin(sprite(a).big, mv.n, mv.kan, ECOL[a.el], s, 1.3); yield 1.25; }
    yield* this.say(`${this.nm(s)} used ${mv.n}!`, 0.12);
    if (mv.a && this.rng() > mv.a * stageMul(a.st.acc - d.st.eva) ** 0.5) { this.bs[1 - s].dodge = 0.45; fx.word('ミス!', dx, dy - 56, '#cfe0ff', 26, 'MISS'); yield 0.3; yield* this.say(`${this.nm(s)}'s attack missed!`, 0.4); return; }
    if (mv.k === 't') return yield* this.statusMove(s, mv);
    const e = eff(mv.e, d.el);
    if (e === 0) { yield* this.play(mv, s); yield* this.say(`It doesn't affect ${this.nm(1 - s)}…`, 0.5); return; }
    const hits = mv.hits ? this.ri(mv.hits[0], mv.hits[1]) : 1;
    let total = 0, n = 0, crit1 = false;
    for (let h = 0; h < hits && d.hp > 0; h++) {
      if (h === 0) yield* this.play(mv, s); else yield* this.playHit(mv, s);
      const crit = this.rng() < [1 / 16, 1 / 8, 1 / 2][Math.min(2, mv.crit || 0)], dm = this.dmg(a, d, mv, crit);
      total += dm; n++; crit1 ||= crit;
      this.hurt(1 - s, dm, crit || e > 1 || mv.p >= 90 || mv.ult ? 1 : 0.45, mv, crit);
      a.gauge = Math.min(1, a.gauge + (dm / d.max) * 0.45); d.gauge = Math.min(1, d.gauge + (dm / d.max) * 0.55);
      yield hits > 1 ? 0.2 : 0.45;
    }
    if (hits > 1) yield* this.say(`Hit ${n} time${n > 1 ? 's' : ''}!`, 0.3);
    if (crit1) { fx.word('会心!', dx - 26, dy - 74, '#ff5a3a', 38, 'CRITICAL HIT'); yield* this.say('A critical hit!', 0.35); }
    if (e > 1) { fx.word('効果抜群!', W / 2, 120, '#ffe14a', 36, "IT'S SUPER EFFECTIVE"); yield* this.say("It's super effective!", 0.45); }
    else if (e < 1) yield* this.say("It's not very effective…", 0.4);
    if (mv.drain && total > 0) {
      for (let i = 0; i < 10; i++) fx.add({ dur: 0.5 + i * 0.03, draw: (c, k) => { const q = ease(k), x = dx + (ax - dx) * q, y = dy + (ay - dy) * q - Math.sin(q * Math.PI) * (30 + i * 4); c.fillStyle = '#9dffb8'; c.globalAlpha = 1 - k * 0.5; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); c.globalAlpha = 1; } });
      yield 0.45; this.heal(s, Math.max(1, Math.round(total * mv.drain))); yield* this.say(`${this.nm(1 - s)} had its energy drained!`, 0.35);
    }
    if (mv.recoil && total > 0 && a.hp > 0) { this.hurt(s, Math.max(1, Math.round(total * mv.recoil)), 0.3); yield* this.say(`${this.nm(s)} is hit with recoil!`, 0.35); }
    if (d.hp > 0) yield* this.secondary(s, mv);
  }
  hurt(s, dm, power = 0.4, mv, crit) {
    const S = this.bs[s], m = S.m, [x, y] = this.mid(s);
    m.hp = Math.max(0, m.hp - dm); S.hurt = 0.4;
    this.fx.hit(x, y, power); this.fx.num(dm, x + (s ? -34 : 34), y - 30, crit ? '#ffe14a' : '#fff');
    if (mv) { this.fx.emit(mv.e, x, y, 16, 190); this.fx.ring(x, y, ECOL[mv.e], 8, 64, 0.35); if (power >= 1 || this.rng() < 0.5) this.fx.word(wordFor(mv, this.rng), x + this.r(-24, 24), y - 36, '#fff', 30); }
  }
  heal(s, h) { const m = this.bs[s].m, [x, y] = this.mid(s); m.hp = Math.min(m.max, m.hp + h); this.fx.heal(x, y, 0.8); }
  canStatus(m, st) { return !m.status && !(st === 'brn' && m.el === 'fire') && !(st === 'psn' && m.el === 'shadow') && this.bt.wx?.k !== 'aurora'; }
  *inflict(s, st) {
    const m = this.bs[s].m, [x, y] = this.mid(s), S = STON[st];
    m.status = st; if (st === 'slp') m.slp = this.ri(2, 4);
    this.fx.word(S[1], x, y - 56, STATUS[st][1], 30, STATUS[st][0]); this.fx.emit(S[2], x, y, 14, 120);
    yield* this.say(`${this.nm(s)} ${S[0]}`, 0.45);
  }
  *stages(s, ch) {
    const m = this.bs[s].m, [x, y] = this.mid(s);
    for (const [k, v] of Object.entries(ch)) {
      const old = m.st[k]; m.st[k] = clamp(old + v, -6, 6);
      if (m.st[k] === old) { yield* this.say(`${this.nm(s)}'s ${STAT[k]} won't go any ${v > 0 ? 'higher' : 'lower'}!`, 0.35); continue; }
      if (v > 0) this.fx.arrows(x, y, true, '#ffb040'); else this.fx.arrows(x, y, false, '#6aa8ff');
      yield* this.say(`${this.nm(s)}'s ${STAT[k]} ${v > 1 ? 'rose sharply!' : v > 0 ? 'rose!' : v < -1 ? 'harshly fell!' : 'fell!'}`, 0.35);
    }
  }
  *secondary(s, mv) {
    const d = this.bs[1 - s].m;
    if (mv.st && this.rng() < mv.st[1] && this.canStatus(d, mv.st[0])) yield* this.inflict(1 - s, mv.st[0]);
    if (mv.foe && this.rng() < (mv.fc ?? 1)) yield* this.stages(1 - s, mv.foe);
    if (mv.flinch && !this.bt.moved[1 - s] && this.rng() < mv.flinch) d.flinch = 1;
    if (mv.daze && !d.daze && this.rng() < mv.daze) { d.daze = this.ri(2, 4); const [x, y] = this.mid(1 - s); this.fx.word('混乱', x, y - 56, '#ff9ae8', 30, 'DAZED'); yield* this.say(`${this.nm(1 - s)} became dazed!`, 0.4); }
  }
  *statusMove(s, mv) {
    const a = this.bs[s].m, d = this.bs[1 - s].m, [ax, ay] = this.mid(s), fail = () => this.say('But it failed!', 0.4);
    yield* this.play(mv, s);
    if (mv.wx) {
      if (this.bt.wx?.k === mv.wx) return yield* fail();
      const w = WEATHER[mv.wx]; this.bt.wx = { k: mv.wx, n: 5 }; this.fx.word(w.kan, W / 2, 112, w.col, 66, w.name.toUpperCase(), 1.1);
      return yield* this.say(WXON[mv.wx], 0.5);
    }
    if (mv.heal) {
      if (a.hp >= a.max && !(mv.cure && a.status)) return yield* fail();
      if (mv.cure || mv.nap) a.status = null;
      this.heal(s, Math.round(a.max * mv.heal)); this.fx.word('回復', ax, ay - 64, '#7dffa8', 32, 'RECOVER');
      yield* this.say(`${this.nm(s)} restored its health!`, 0.4);
      if (mv.nap) { a.status = 'slp'; a.slp = 3; yield* this.say(`${this.nm(s)} curled up for a nap.`, 0.4); }
      return;
    }
    if (mv.self) return yield* this.stages(s, mv.self);
    if (mv.foe) return yield* this.stages(1 - s, mv.foe);
    if (mv.st) return this.canStatus(d, mv.st[0]) ? yield* this.inflict(1 - s, mv.st[0]) : yield* fail();
    if (mv.daze) { if (d.daze) return yield* fail(); d.daze = this.ri(2, 4); const [x, y] = this.mid(1 - s); this.fx.word('混乱', x, y - 56, '#ff9ae8', 30, 'DAZED'); yield* this.say(`${this.nm(1 - s)} became dazed!`, 0.4); }
  }
  lunge(s, dur, k = 1) { const S = this.bs[s]; S.lungeT = S.lungeD = dur; S.lungeK = k; }
  // how each kind of move looks; returns when the hit lands
  *play(mv, s) {
    const fx = this.fx, A = this.bs[s], [ax, ay] = this.mid(s), [dx, dy] = this.mid(1 - s), col = ECOL[mv.e], el = mv.e, dir = s ? -1 : 1, gy = POS[1 - s][1];
    switch (mv.fx) {
      case 'rush': A.atk = 0.5; fx.streaks(dir, '#fff', 0.45); this.lunge(s, 0.42); yield 0.2; return;
      case 'slash': A.atk = 0.45; this.lunge(s, 0.3, 0.45); yield 0.12; fx.slashes(dx, dy, col, 3); yield 0.12; return;
      case 'orb': A.atk = 0.4; yield 0.12; yield fx.orb(ax + dir * 24, ay, dx, dy, col, el, 0.3); return;
      case 'multi': A.atk = 0.4; yield 0.1; yield fx.orb(ax + dir * 24, ay, dx + this.r(-12, 12), dy + this.r(-12, 12), col, el, 0.2, 6); return;
      case 'beam': A.atk = 0.8; fx.charge(ax + dir * 20, ay, el, col, 0.4); yield 0.4; fx.beam(ax + dir * 24, ay, dx, dy, col, 0.5); fx.focus(dx, dy, '#fff', 0.5); yield 0.1; return;
      case 'pillar': A.atk = 0.5; fx.ring(dx, gy, col, 4, 50, 0.3, 4); yield 0.28; fx.pillar(dx, gy, col, el, 0.65); yield 0.08; return;
      case 'rain': A.atk = 0.5; fx.rain(dx, dy, el, 0.55); yield 0.38; return;
      case 'wave': A.atk = 0.45; fx.wave(ax + dir * 20, ay, dx, dy, col, el, 0.38); yield 0.34; return;
      case 'quake': A.atk = 0.5; this.lunge(s, 0.25, 0.2); fx.shake = 12; fx.cracks(dx, gy); fx.emit('earth', dx, gy, 16, 260, { dir: -Math.PI / 2, spread: 1.2 }); yield 0.3; return;
      case 'drain': A.atk = 0.4; fx.hex(dx, dy, col, 0.4); yield 0.3; return;
      case 'hex': A.atk = 0.4; fx.hex(dx, dy, col, 0.6); fx.emit(el, dx, dy, 12, 80); yield 0.5; return;
      case 'roar': A.atk = 0.5; for (let i = 0; i < 3; i++) fx.ring(ax, ay, '#fff', 10, 120 + i * 30, 0.5 + i * 0.1, 4); fx.focus(ax, ay, 'rgba(255,255,255,.8)', 0.5); fx.word(this.rng() < 0.5 ? 'ガオー!' : 'ウォォ!', ax + dir * 30, ay - 54, '#fff', 30); fx.shake = 5; yield 0.45; return;
      case 'aura': A.atk = 0.4; fx.aura(ax, ay, col, 0.8); fx.word('強化', ax, ay - 64, col, 30, 'POWER UP'); yield 0.55; return;
      case 'heal': fx.heal(ax, ay, 0.9); yield 0.4; return;
      case 'weather': A.atk = 0.5; fx.flash(WEATHER[mv.wx].col, 0.35); fx.focus(W / 2, 100, WEATHER[mv.wx].col, 0.6); yield 0.3; return;
      case 'ult': {
        A.atk = 1.2; fx.charge(ax, ay, el, col, 0.5); fx.focus(ax, ay, col, 0.6); fx.word('必殺', ax + dir * 10, ay - 74, col, 46, 'SUPER MOVE');
        yield 0.5;
        fx.streaks(dir, '#fff', 0.6); this.lunge(s, 0.5, 1.2); fx.beam(ax + dir * 24, ay, dx, dy, col, 0.6, 26); fx.pillar(dx, gy, col, el, 0.8, 70); fx.rain(dx, dy, el, 0.6, 30); fx.focus(dx, dy, '#fff', 0.7);
        yield 0.25; fx.word(mv.kan, W / 2, 150, col, 72, mv.n.toUpperCase(), 1.2); return;
      }
    }
  }
  *playHit(mv, s) {
    const [ax, ay] = this.mid(s), [dx, dy] = this.mid(1 - s), dir = s ? -1 : 1;
    if (mv.fx === 'slash') { this.bs[s].atk = 0.3; this.fx.slashes(dx + this.r(-10, 10), dy, ECOL[mv.e], 1, 0.25); yield 0.1; }
    else if (mv.fx === 'rain') { this.fx.rain(dx, dy, mv.e, 0.3, 10); yield 0.2; }
    else yield this.fx.orb(ax + dir * 24, ay, dx + this.r(-14, 14), dy + this.r(-14, 14), ECOL[mv.e], mv.e, 0.18, 6);
  }
  *endTurn() {
    const bt = this.bt;
    for (const s of [0, 1]) {
      const m = this.bs[s].m; m.flinch = 0; if (m.hp <= 0) continue;
      if (m.status === 'brn' || m.status === 'psn') { this.hurt(s, Math.max(1, Math.floor(m.max / (m.status === 'brn' ? 16 : 10))), 0.2); this.fx.emit(m.status === 'brn' ? 'fire' : 'shadow', ...this.mid(s), 12, 100); yield* this.say(`${this.nm(s)} is hurt by its ${m.status === 'brn' ? 'burn' : 'poison'}!`, 0.35); }
      m.gauge = Math.min(1, m.gauge + 0.07);
    }
    if (!bt.wx) return;
    const w = WEATHER[bt.wx.k];
    if (w.chip) for (const s of [0, 1]) { const m = this.bs[s].m; if (m.hp > 0 && m.el !== w.chip) { this.hurt(s, Math.max(1, Math.floor(m.max / 16)), 0.15); yield* this.say(`${this.nm(s)} is buffeted by the sandstorm!`, 0.3); } }
    if (w.heal && this.bs.some((S) => S.m.hp > 0 && S.m.hp < S.m.max)) { for (const s of [0, 1]) { const m = this.bs[s].m; if (m.hp > 0 && m.hp < m.max) this.heal(s, Math.max(1, Math.floor(m.max / 16))); } yield* this.say(`The ${bt.wx.k === 'bloom' ? 'blossoms' : 'aurora'} restored a little health.`, 0.3); }
    if (--bt.wx.n <= 0) { yield* this.say(WXOFF[bt.wx.k], 0.35); bt.wx = null; }
  }
  *faints() {
    const bt = this.bt, F = this.bs[1], M = this.bs[0];
    if (F.m.hp <= 0 && !F.out) {
      F.out = true; F.faint = 0.001; this.fx.emit(F.m.el, ...this.mid(1), 20, 120);
      yield 0.35; yield* this.say(`${this.nm(1)} fainted!`, 0.4);
      this.score += F.m.lv * 10;
      if (M.m.hp > 0) yield* this.xp(M.m, F.m);
      const next = bt.foes.find((m) => m.hp > 0);
      if (next) { yield* this.sendOut(1, next); return null; }
      return 'won';
    }
    if (M.m.hp <= 0 && !M.out) {
      M.out = true; M.faint = 0.001;
      yield 0.35; yield* this.say(`${M.m.name} fainted!`, 0.4);
      if (!this.team.some((m) => m.hp > 0)) return 'lost';
      const i = yield* this.chooseSwap(); yield* this.sendOut(0, this.team[i]);
    }
    return null;
  }
  *xp(m, foe) {
    const amt = Math.round((foe.lv * 9 + 12) * (this.bt.tr ? 1.5 : 1) * clamp(1 + (foe.lv - m.lv) * 0.12, 0.5, 1.8));
    yield* this.say(`${m.name} gained ${amt} XP!`, 0.3);
    yield* this.grow(m, amt, true);
    for (const b of this.team) if (b !== m && b.hp > 0) yield* this.grow(b, Math.round(amt * 0.4), false);
  }
  *grow(m, amt, loud) {
    m.xp += amt;
    while (m.xp >= need(m.lv) && m.lv < 70) {
      m.xp -= need(m.lv); m.lv++; calc(m);
      const nl = m.sp.learn.find((x) => x.lv === m.lv && !m.moves.includes(x.m));
      if (nl) { if (m.moves.length >= 4) m.moves.shift(); m.moves.push(nl.m); }
      if (tierAt(m.sp, m.lv) > m.tier) m.evolve = true;
      if (!loud) continue;
      const [x, y] = this.mid(0); this.fx.word('レベルアップ!', x + 20, y - 64, '#7dffa8', 26, `LV ${m.lv}`); this.fx.emit('spirit', x, y, 14, 120); this.fx.aura(x, y, '#7dffa8', 0.6);
      yield* this.say(`${m.name} grew to Lv ${m.lv}!`, 0.45);
      if (nl) yield* this.say(`${m.name} learned ${nl.m.n}!`, 0.45);
    }
  }
  *swap(i) {
    const S = this.bs[0], old = S.m;
    yield* this.say(`${old.name}, come back!`, 0.1);
    S.white = 1; for (let t = 0; t < 0.3; t += 1 / 60) { S.scale = 1 - t / 0.3; yield 1 / 60; }
    S.hidden = true; S.scale = 1; S.white = 0; this.reset(old);
    yield* this.sendOut(0, this.team[i]);
  }
  catchChance(m) { return clamp((1 - ((2 / 3) * m.hp) / m.max) * 0.85 * m.sp.rate * (m.tier ? 0.75 : 1) * (m.status === 'slp' ? 2 : m.status ? 1.5 : 1), 0.04, 0.97); }
  *throwOrb() {
    const S = this.bs[1], foe = S.m, [fx0, fy0] = this.mid(1), gy = POS[1][1] - 8, fx = this.fx;
    this.orbs--; this.bt.orbsUsed++;
    this.me.actor.attack(); yield* this.say('You threw a catch orb!', 0.05);
    const B = (this.ball = { x: 44, y: 214, rot: 0, open: 0 });
    for (let t = 0; t < 0.5; t += 1 / 60) { const k = t / 0.5; B.x = 44 + (fx0 - 44) * k; B.y = 214 + (fy0 - 214) * k - Math.sin(k * Math.PI) * 120; B.rot += 0.45; yield 1 / 60; }
    B.open = 1; fx.flash('#fff', 0.2); fx.ring(B.x, B.y, '#ff6a8a', 6, 70, 0.4); S.white = 1;
    for (let t = 0; t < 0.4; t += 1 / 60) { S.scale = 1 - t / 0.4; yield 1 / 60; }
    S.hidden = true; S.scale = 1; B.open = 0;
    for (let t = 0; t < 0.45; t += 1 / 60) { const k = t / 0.45; B.y = fy0 + (gy - fy0) * k - (k > 0.6 ? Math.sin(((k - 0.6) / 0.4) * Math.PI) * 10 : 0); B.rot *= 0.85; yield 1 / 60; }
    B.rot = 0;
    const p = this.catchChance(foe), ok = this.rng() < p; let n = ok ? 3 : 0;
    if (!ok) { const q = Math.pow(p, 0.3); while (n < 3 && this.rng() < q) n++; }
    for (let i = 0; i < n; i++) { yield 0.22; for (let t = 0; t < 0.3; t += 1 / 60) { B.rot = Math.sin((t / 0.3) * TAU) * 0.45; yield 1 / 60; } B.rot = 0; fx.emit('beast', B.x, B.y - 6, 4, 60); }
    yield 0.35;
    if (ok) {
      fx.emit('spirit', B.x, B.y - 6, 24, 180); fx.word('ゲット!', W / 2, 110, '#ffe14a', 44, 'GOTCHA!', 1.2); fx.flash('#fff8d0', 0.25);
      this.me.actor.emote('cheer', 2); this.score += 50;
      yield* this.say(`Gotcha! ${foe.name} was caught!`, 0.6);
      const isNew = !this.caught.has(foe.seed); this.caught.add(foe.seed);
      if (isNew) { this.score += 50; this.card = { m: foe, t: 0 }; yield 2.1; this.card = null; }
      this.reset(foe); foe.status = foe.status === 'slp' ? null : foe.status;
      if (this.team.length < 6) { this.team.push(foe); yield* this.say(`${foe.name} joined your team!`, 0.5); } else { this.box.push(foe); yield* this.say(`${foe.name} was sent to the spirit box.`, 0.5); }
      this.ball = null; return true;
    }
    fx.flash('#fff', 0.2); fx.emit('spirit', B.x, B.y - 6, 18, 200); this.ball = null; S.hidden = false; S.white = 0.9; S.enter = 0.3;
    fx.word('ああっ!', W / 2, 120, '#ff8a6a', 36, 'IT BROKE FREE');
    yield* this.say(['Oh no! It broke free!', 'Argh! Almost had it!', 'Aww! It appeared to be caught!', 'So close!'][n], 0.5);
    S.white = 0;
    return false;
  }
  *evolve(m) {
    const oldName = m.name, nt = tierAt(m.sp, m.lv);
    this.evo = { m, a: sprite(m).big, b: null, t: 0, done: 0, el: m.el }; this.mode = 'evo'; this.trans = { k: 'in', t: 0, dur: 0.5 };
    yield* this.say(`What? ${oldName} is evolving!`, 0.5);
    const ns = sprite({ ...m, tier: nt }); this.evo.b = ns.big; yield 0; void ns.attack; yield 0; void ns.hurt; yield 0; void ns.dead;
    this.evo.t = 0; while (this.evo.t < 2.8) yield 0;
    m.tier = nt; m.name = formName(m.sp, nt); calc(m); m.evolve = false; this.score += 100;
    this.evo.done = 1; this.fx.flash('#fff', 0.7); this.fx.word('進化!', W / 2, 92, ECOL[m.el], 58, 'EVOLVED!', 1.5); this.fx.emit('spirit', W / 2, 200, 40, 260); this.me.actor.emote('cheer', 2);
    yield* this.say(`Congratulations! ${oldName} evolved into ${m.name}!`, 1);
    this.mode = 'world'; this.evo = null; this.trans = { k: 'in', t: 0, dur: 0.4 }; this.msg = '';
  }
  // ---------------------------------------------------------------- choices (autopilot and AI)
  dmgCalc(a, d, mv, crit, roll) {
    const phys = mv.k === 'p', A = (phys ? a.atk : a.sat) * stageMul(a.st[phys ? 'atk' : 'sat']), D = (phys ? d.def : d.sdf) * stageMul(d.st[phys ? 'def' : 'sdf']);
    const wx = this.bt?.wx && WEATHER[this.bt.wx.k], e = eff(mv.e, d.el);
    if (e === 0) return 0;
    let m = (mv.e === a.el ? 1.5 : 1) * e * (crit ? 1.5 : 1) * roll * (phys && a.status === 'brn' ? 0.5 : 1) * (this.mods.glass ? 1.5 : 1);
    if (wx) m *= wx.boost === mv.e ? 1.5 : wx.nerf === mv.e ? 0.5 : 1;
    return Math.max(1, Math.floor(((((2 * a.lv) / 5 + 2) * mv.p * (mv.hex && d.status ? 2 : 1) * A) / D / 50 + (mv.hits ? 0.5 : 2)) * m));
  }
  dmg(a, d, mv, crit) { return this.dmgCalc(a, d, mv, crit, this.r(0.85, 1)); }
  est(a, d, mv) { return this.dmgCalc(a, d, mv, false, 0.925) * (mv.hits ? (mv.hits[0] + mv.hits[1]) / 2 : 1) * (mv.a || 1); }
  value(a, d, mv) {
    const hpA = a.hp / a.max, hpD = d.hp / d.max, bt = this.bt;
    if (mv.p) { const e = this.est(a, d, mv); let v = Math.min(1.2, e / Math.max(1, d.hp)) * 100; if (e >= d.hp) v += 40 + (mv.pri ? 30 : 0); if (mv.drain) v += (1 - hpA) * 25; if (mv.recoil) v -= 12; return v; }
    if (mv.heal) return hpA < 0.4 ? 85 : hpA < 0.65 ? 22 : -60;
    if (mv.wx) return bt.wx?.k === mv.wx ? -99 : a.moves.some((m) => m.p && m.e === WEATHER[mv.wx].boost) ? 30 : 2;
    if (mv.self) { const k = Object.keys(mv.self)[0]; return hpA > 0.6 && a.st[k] < 2 ? 36 - bt.turn * 5 : -20; }
    if (mv.foe) { const k = Object.keys(mv.foe)[0]; return hpD > 0.5 && d.st[k] > -2 ? 24 : 0; }
    if (mv.st) return this.canStatus(d, mv.st[0]) ? (mv.st[0] === 'slp' ? 56 : 44) * (mv.a || 1) * (hpD > 0.35 ? 1 : 0.4) : -99;
    if (mv.daze) return d.daze ? -99 : 26;
    return 0;
  }
  bestMove(a, d, noise = 10) { let best = a.moves[0], bv = -1e9; for (const mv of a.moves) { const v = this.value(a, d, mv) + this.r(0, noise); if (v > bv) { bv = v; best = mv; } } return best; }
  bestBench() {
    const foe = this.bs[1].m; let bi = -1, bv = -1e9;
    this.team.forEach((m, i) => { if (m.hp <= 0 || m === this.bs[0].m) return; const v = eff(m.el, foe.el) * 2 - eff(foe.el, m.el) + m.hp / m.max + m.lv / 10; if (v > bv) { bv = v; bi = i; } });
    return bi;
  }
  decide() {
    const me = this.bs[0].m, foe = this.bs[1].m, bt = this.bt, wild = !bt.tr, f = foe.hp / foe.max;
    const want = wild && this.orbs > 0 && (!this.caught.has(foe.seed) || this.team.length < 3) && bt.orbsUsed < 5;
    if (!bt.swapped && eff(foe.el, me.el) >= 2 && me.hp / me.max > 0.25) { const i = this.bestBench(), b = this.team[i]; if (b && eff(foe.el, b.el) <= 1 && b.hp / b.max > 0.5 && b.lv >= me.lv - 2) { bt.swapped = 1; return { kind: 'swap', i }; } }
    const low = me.hp / me.max < 0.35, bench = this.team.some((m) => m !== me && m.hp > m.max * 0.5);
    if (wild && !bench && low && f > 0.45 && !(want && f < 0.6)) return { kind: 'run' };
    if (wild && !want && bt.turn <= 1 && !bench && eff(foe.el, me.el) >= 2 && eff(me.el, foe.el) <= 1 && foe.lv >= me.lv - 2) return { kind: 'run' };
    if (want) {
      if (f <= 0.3 || (foe.status === 'slp' && f <= 0.6) || (low && f < 0.7)) return { kind: 'orb' };
      const st = me.moves.find((m) => m.st && m.st[1] >= 1 && (m.st[0] === 'slp' || m.st[0] === 'par') && this.canStatus(foe, m.st[0]));
      if (st && f <= 0.8 && this.rng() < 0.75) return { kind: 'move', mv: st };
      let best = null, bd = -1;
      for (const mv of me.moves) if (mv.p) { const mx = this.dmgCalc(me, foe, mv, false, 1) * (mv.hits ? mv.hits[1] : 1), av = this.est(me, foe, mv); if (mx < foe.hp && av > bd) { bd = av; best = mv; } }
      if (best && bd > foe.max * 0.06) return { kind: 'move', mv: best };
      if (f <= 0.55) return { kind: 'orb' };
    }
    if (me.gauge >= 1) return { kind: 'move', mv: ultFor(me) };
    return { kind: 'move', mv: this.bestMove(me, foe, 12) };
  }
  // the autopilot moves a cursor through the menus like a player would
  autoPick(dt) {
    const ap = (this.ap ||= { t: 0, p: this.forced ? { kind: 'swap', i: this.bestBench() } : this.decide() }), p = ap.p;
    ap.t += dt;
    const done = (t) => { if (ap.t > t) { this.pick = p; this.ap = null; } };
    if (this.forced) { if (ap.t > 0.35) this.cursor = ['team', p.i]; return done(0.7); }
    if (p.mv?.ult) { if (ap.t > 0.3) this.cursor = ['burst']; return done(0.7); }
    if (ap.t > 0.25) this.cursor = ['act', { move: 0, orb: 1, swap: 2, run: 3 }[p.kind]];
    if (p.kind === 'move' || p.kind === 'swap') {
      if (ap.t > 0.45) this.menu = p.kind === 'move' ? 'moves' : 'team';
      if (ap.t > 0.6) this.cursor = p.kind === 'move' ? ['moves', this.bs[0].m.moves.indexOf(p.mv)] : ['team', p.i];
      return done(0.85);
    }
    done(0.6);
  }
  // ---------------------------------------------------------------- input
  down(x, y) {
    if (this.mode === 'battle') return this.tapBattle(x, y);
    if (this.script || this.mode !== 'world') { this.skip = 1; return; }
    const P = this.me, tx = Math.floor((x + this.cam.x) / TS), ty = Math.floor((y + this.cam.y) / TS), n = this.npcs.find((q) => q.x === tx && q.y === ty);
    this.pauseT = 0;
    if (n) {
      if (Math.abs(n.x - P.x) + Math.abs(n.y - P.y) === 1) { P.path = []; return this.run(this.talk(n)); }
      const opts = D4.map(([a, b]) => this.path(P, n.x + a, n.y + b)).filter(Boolean).sort((a, b) => a.length - b.length);
      if (opts.length) { P.path = opts[0]; P.walkMode = 0; P.talk = n; }
      return;
    }
    let p = this.path(P, tx, ty);
    if (!p) p = D4.map(([a, b]) => this.path(P, tx + a, ty + b)).filter(Boolean).sort((a, b) => a.length - b.length)[0];
    if (p) { P.path = p; P.walkMode = 0; P.talk = null; }
  }
  tapBattle(x, y) {
    if (!this.menu) { this.skip = 1; return; }
    const me = this.bs[0].m;
    if (!this.forced && me.gauge >= 1 && Math.hypot(x - BX, y - BY) < 24) { this.pick = { kind: 'move', mv: ultFor(me) }; return; }
    if (this.menu === 'team') {
      const i = Math.floor((y - 60) / 34);
      if (x > 14 && x < W - 14 && i >= 0 && i < this.team.length) { const m = this.team[i]; if (m.hp > 0 && m !== me) this.pick = { kind: 'swap', i }; }
      else if (!this.forced) this.menu = 'act';
      return;
    }
    const b = y < H - 86 || y > H - 2 ? -1 : (y > H - 44 ? 2 : 0) + (x > W / 2 ? 1 : 0);
    if (b < 0) { if (this.menu === 'moves') this.menu = 'act'; return; }
    if (this.menu === 'moves') { const mv = me.moves[b]; if (mv) this.pick = { kind: 'move', mv }; return; }
    if (b === 0) this.menu = 'moves';
    else if (b === 1) { if (!this.bt.tr && this.orbs > 0) this.pick = { kind: 'orb' }; }
    else if (b === 2) { if (this.team.some((m) => m.hp > 0 && m !== me)) this.menu = 'team'; }
    else if (!this.bt.tr) this.pick = { kind: 'run' };
  }
  battleStep(dt) {
    for (const S of this.bs) {
      S.atk = Math.max(0, S.atk - dt); S.hurt = Math.max(0, S.hurt - dt); S.dodge = Math.max(0, S.dodge - dt); S.hop = Math.max(0, S.hop - dt);
      if (S.lungeT > 0 && (S.lungeT -= dt) <= 0) S.lungeT = S.lungeD = 0;
      if (S.enter < 1) S.enter = Math.min(1, S.enter + dt / 0.4);
      if (S.faint > 0 && S.faint < 1) S.faint = Math.min(1, S.faint + dt / 0.5);
      if (S.slide > 0) S.slide = Math.max(0, S.slide - dt / 0.55);
      const m = S.m; if (m) { const d = m.hp - m.hpShow; m.hpShow += Math.sign(d) * Math.min(Math.abs(d), m.max * dt * 0.9); }
    }
    const bt = this.bt; this.me.actor.update(dt, {});
    if (bt.tr) { bt.tr.actor.update(dt, {}); bt.trOff = clamp(bt.trOff + (bt.trGo && !bt.trBack ? 1 : -1) * dt * 320, 0, 160); }
  }
  // ---------------------------------------------------------------- drawing
  draw(c) {
    c.imageSmoothingEnabled = false;
    if (this.mode === 'battle' && this.bt) this.drawBattle(c);
    else if (this.mode === 'evo' && this.evo) this.drawEvo(c);
    else this.drawWorld(c);
    if (this.trans) this.drawTrans(c);
  }
  tx(c, s, x, y, size, col = '#fff', align = 'left', o = {}) {
    c.font = `${o.it ? 'italic ' : ''}${o.w || 800} ${size}px ${o.j ? JFONT : FONT}`; c.textAlign = align; c.textBaseline = 'middle';
    if (o.st) { c.lineJoin = 'round'; c.lineWidth = o.st; c.strokeStyle = o.sc || 'rgba(10,6,16,.9)'; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  drawWorld(c) {
    const R = this.region, cx = Math.round(this.cam.x), cy = Math.round(this.cam.y), F = this.fol;
    R.drawGround(c, cx, cy, this.t, W, H);
    const y0 = Math.max(0, Math.floor(cy / TS) - 1), y1 = Math.min(N - 1, Math.floor((cy + H) / TS) + 3), x0 = Math.floor(cx / TS) - 3, x1 = Math.floor((cx + W) / TS) + 3;
    const actors = [this.me, ...this.npcs], row = (a) => Math.floor((a.py - 1) / TS);
    for (let y = y0; y <= y1; y++) {
      for (const o of R.rows[y]) if (o.x >= x0 && o.x <= x1) R.drawObj(c, o, cx, cy, y);
      if (row(F) === y) this.drawFol(c, cx, cy);
      for (const a of actors) if (row(a) === y) this.drawActor(c, a, cx, cy);
    }
    for (const a of [...actors, F]) { const ty = row(a); for (const tx of new Set([Math.floor((a.px - 9) / TS), Math.floor((a.px + 9) / TS)])) if (R.at(tx, ty) === TALL) c.drawImage(R.ground, tx * TS, ty * TS + 13, TS, 11, tx * TS - cx, ty * TS + 13 - cy, TS, 11); }
    c.save(); c.translate(-cx, -cy); this.wfx.draw(c, 'back'); this.wfx.draw(c, 'front'); c.restore();
    for (const n of this.npcs) if (n.alert) { const x = Math.round(n.px - cx), y = Math.round(n.py - cy) - 44; c.fillStyle = '#fff'; roundRect(c, x - 7, y - 10, 14, 18, 4); c.fill(); c.strokeStyle = '#140a14'; c.lineWidth = 1.5; c.stroke(); this.tx(c, '!', x, y, 14, '#e8243a', 'center', { w: 900 }); }
    if (this.night || this.dusk) {
      c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = this.night ? (R.B.season === 'night' ? '#9aa0d0' : '#5a64a8') : '#ffc8a8'; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, a) => { const g = c.createRadialGradient(x, y, 2, x, y, r); g.addColorStop(0, `rgba(255,196,120,${a})`); g.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
      for (const [lx, ly] of R.town.lights) { const x = lx * TS - cx, y = ly * TS - cy; if (x > -60 && x < W + 60 && y > -60 && y < H + 60) glow(x, y, 44, this.night ? 0.5 : 0.25); }
      if (this.night) glow(this.me.px - cx, this.me.py - cy - 14, 54, 0.22);
      c.restore();
    }
    this.drawAmb(c);
    this.drawWorldHud(c);
    if (this.msg && this.script) this.drawMsg(c, H - 64, 56);
  }
  drawActor(c, a, cx, cy) {
    const x = Math.round(a.px - cx), y = Math.round(a.py - cy);
    if (x < -40 || x > W + 40 || y < -10 || y > H + 50) return;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y, 7, 2.5, 0, 0, TAU); c.fill();
    a.actor.draw(c, x, y, 1);
  }
  drawFol(c, cx, cy) {
    const F = this.fol, m = this.lead(); if (!m) return;
    const s = mini(m), x = Math.round(F.px - cx), y = Math.round(F.py - cy), fl = s.floats ? 5 + Math.sin(this.t * 3) * 2 : 0;
    if (x < -30 || x > W + 30 || y < -10 || y > H + 40) return;
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y, 8, 2.5, 0, 0, TAU); c.fill();
    const img = F.mv ? s.walk[Math.floor(F.dist / 6) % 4] : s.frames[Math.floor(this.t * 2) % 2];
    c.save(); c.translate(x, Math.round(y - fl)); if (F.face < 0) c.scale(-1, 1); c.drawImage(img, -13, -24); c.restore();
  }
  drawAmb(c) {
    const B = this.region.B, kind = { spring: 'petal', autumn: 'leaf', winter: 'snow', night: 'fly', ink: '' }[B.season] ?? (this.night || this.dusk ? 'fly' : 'pollen');
    if (!kind) return;
    const t = this.t;
    c.save();
    for (const p of this.amb) {
      if (kind === 'fly') { const x = (p.x + Math.sin(t * 0.5 * p.s + p.ph) * 30 + W) % W, y = (p.y + Math.cos(t * 0.4 * p.s + p.ph * 2) * 24 + H) % H; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 * p.s + p.ph); c.fillStyle = '#e8ff8a'; c.fillRect(x, y, 2, 2); c.globalAlpha *= 0.3; c.beginPath(); c.arc(x + 1, y + 1, 5, 0, TAU); c.fill(); continue; }
      const fall = kind === 'snow' ? 26 : kind === 'pollen' ? 6 : 20, x = (((p.x + t * 16 * p.s + Math.sin(t * p.s + p.ph) * 14) % (W + 20)) + W + 20) % (W + 20) - 10, y = ((p.y + t * fall * p.s) % (H + 20)) - 10;
      c.globalAlpha = kind === 'pollen' ? 0.5 : 0.85; c.fillStyle = kind === 'snow' ? '#fff' : kind === 'petal' ? '#ffc0dc' : kind === 'leaf' ? (p.ph > 3 ? '#e8742a' : '#d8a030') : '#fff6c0';
      if (kind === 'snow' || kind === 'pollen') c.fillRect(Math.round(x), Math.round(y), 2, 2);
      else { c.save(); c.translate(x, y); c.rotate(t * p.s * 2 + p.ph); c.fillRect(-2, -1, 4, 2); c.restore(); }
    }
    c.restore();
  }
  drawWorldHud(c) {
    this.team.forEach((m, i) => {
      const x = W - 6 - (this.team.length - i) * 31, y = 44, s = mini(m);
      c.fillStyle = 'rgba(12,9,22,.62)'; roundRect(c, x, y, 29, 34, 6); c.fill();
      c.globalAlpha = m.hp > 0 ? 1 : 0.35; c.drawImage(s.frames[0], x + 1, y + 1); c.globalAlpha = 1;
      const f = m.hp / m.max; c.fillStyle = '#222'; c.fillRect(x + 3, y + 29, 23, 3); c.fillStyle = f > 0.5 ? '#6fd36a' : f > 0.2 ? '#ffd23a' : '#ff5a3a'; c.fillRect(x + 3, y + 29, 23 * f, 3);
      if (m.status) { c.fillStyle = STATUS[m.status][1]; c.fillRect(x + 22, y + 3, 4, 4); }
    });
    c.fillStyle = 'rgba(12,9,22,.62)'; roundRect(c, W - 96, 6, 90, 34, 6); c.fill();
    this.tx(c, '図鑑', W - 88, 16, 10, '#ffe9a8', 'left', { j: 1, w: 900 });
    this.tx(c, `${this.caught.size}/${this.dexTotal}`, W - 62, 16, 12, '#fff', 'left', { w: 900 });
    this.drawOrb(c, W - 80, 30, 5, 0); this.tx(c, `×${this.orbs}`, W - 70, 30, 11, '#fff', 'left', { w: 800 });
    this.tx(c, `Lv${this.lead().lv}`, W - 12, 30, 10, '#bfe8ff', 'right', { w: 800 });
    if (this.banner > 0 && this.mode === 'world') {
      const k = Math.min(1, this.banner / 0.4, (3.4 - this.banner) / 0.4), R = this.region;
      c.save(); c.globalAlpha = k; c.fillStyle = 'rgba(12,9,22,.8)'; c.beginPath(); c.moveTo(70, 82); c.lineTo(W - 60, 82); c.lineTo(W - 70, 120); c.lineTo(60, 120); c.closePath(); c.fill();
      this.tx(c, SEASON_KAN[R.B.season], 92, 101, 26, 'rgba(255,233,168,.9)', 'center', { j: 1, w: 900 });
      this.tx(c, R.name.toUpperCase(), 118, 95, 16, '#fff', 'left', { it: 1, w: 900 }); this.tx(c, `ROUTE ${R.route} · ${this.dexTotal} SPIRITS TO FIND`, 118, 111, 9, '#ffe9a8', 'left', { w: 800 });
      c.restore();
    }
  }
  drawMsg(c, y, h) {
    c.fillStyle = 'rgba(12,9,22,.93)'; roundRect(c, 8, y, W - 16, h, 10); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = this.bt ? ECOL[this.bs[0].m.el] : 'rgba(255,233,168,.6)'; c.lineWidth = 1; roundRect(c, 12, y + 4, W - 24, h - 8, 7); c.stroke();
    const s = this.msg.slice(0, Math.floor(this.msgT)); c.font = `700 13px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
    let line = '', ly = y + 16;
    for (const w of s.split(' ')) { if (c.measureText(line + ' ' + w).width > W - 52 && line) { c.fillText(line, 22, ly); line = w; ly += 17; } else line = (line + ' ' + w).trim(); }
    c.fillText(line, 22, ly);
    if (this.msgT >= this.msg.length && (this.t * 3) % 2 < 1 && !this.menu) { c.fillStyle = '#ffe9a8'; c.beginPath(); c.moveTo(W - 30, y + h - 14); c.lineTo(W - 22, y + h - 14); c.lineTo(W - 26, y + h - 9); c.fill(); }
  }
  drawOrb(c, x, y, r, rot = 0, open = 0) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = '#f4f0ea'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI); c.fill();
    c.save(); if (open) { c.translate(-r, 0); c.rotate(-open * 0.9); c.translate(r, -open * 2); }
    c.fillStyle = '#e8384a'; c.beginPath(); c.arc(0, 0, r, Math.PI, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-r * 0.5, -r * 0.7, r * 0.35, r * 0.25); c.restore();
    c.fillStyle = '#1a1018'; c.fillRect(-r, -r * 0.12, r * 2, r * 0.24);
    c.beginPath(); c.arc(0, 0, r * 0.36, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r * 0.22, 0, TAU); c.fill();
    c.strokeStyle = '#1a1018'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.restore();
  }
  battleBg(onPath) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), B = this.region.B, ink = B.season === 'ink';
    const sky = this.night ? ['#0a1030', '#2c3266'] : this.dusk ? ['#40306a', '#f4a070'] : ink ? ['#f2ecdf', '#ddd4c2'] : B.season === 'winter' ? ['#a8c8ea', '#eef4fa'] : ['#4aa0e6', '#d4eeff'];
    let g = x.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); x.fillStyle = g; x.fillRect(0, 0, W, 170);
    const img = this.skin.bgSet?.[0] || this.skin.bg;
    if (ready(img)) { const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, s = Math.max(W / iw, 170 / ih); x.globalAlpha = 0.3; x.drawImage(img, (W - iw * s) / 2, (170 - ih * s) / 2, iw * s, ih * s); x.globalAlpha = 1; }
    if (this.night) { x.fillStyle = '#fff'; for (let i = 0; i < 40; i++) x.fillRect((i * 97) % W, (i * 53) % 120, 1, 1); x.fillStyle = '#fff8e0'; x.beginPath(); x.arc(300, 40, 14, 0, TAU); x.fill(); }
    else { x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) { const cx = (i * 113 + 40) % W, cy = 30 + (i * 37) % 60; for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(cx + j * 14 - 20, cy - (j % 2) * 6, 16, 9, 0, 0, TAU); x.fill(); } } }
    x.fillStyle = tone(B.leaf, 0.35); x.beginPath(); x.moveTo(0, 170); for (let i = 0; i <= W; i += 8) x.lineTo(i, 128 + Math.sin(i * 0.021) * 12 + Math.sin(i * 0.07) * 4); x.lineTo(W, 170); x.fill();
    x.fillStyle = tone(B.leaf, -0.2); for (let i = -10; i < W + 20; i += 13) { x.beginPath(); x.arc(i, 148 + Math.sin(i * 0.3) * 3, 11 + (i % 3) * 2, 0, TAU); x.fill(); }
    const ground = onPath ? B.path : B.grass;
    g = x.createLinearGradient(0, 150, 0, H); g.addColorStop(0, tone(ground, -0.1)); g.addColorStop(1, tone(ground, 0.08)); x.fillStyle = g; x.fillRect(0, 150, W, H - 150);
    x.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 14; i++) x.fillRect(0, 156 + Math.pow(i, 1.7) * 2.6, W, 1 + i * 0.25);
    const plat = (px, py, rx, ry) => {
      const base = onPath ? B.sand : B.tall;
      x.fillStyle = tone(base, -0.35); x.beginPath(); x.ellipse(px, py + 4, rx, ry, 0, 0, TAU); x.fill();
      x.fillStyle = tone(base, 0); x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, TAU); x.fill();
      x.fillStyle = tone(base, 0.18); x.beginPath(); x.ellipse(px - rx * 0.1, py - ry * 0.25, rx * 0.7, ry * 0.5, 0, 0, TAU); x.fill();
      if (!onPath) { x.fillStyle = tone(B.tall, -0.25); for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, bx = px + Math.cos(a) * rx * 0.96, by = py + Math.sin(a) * ry * 0.96; x.beginPath(); x.moveTo(bx - 3, by + 2); x.lineTo(bx, by - 6 - (i % 3) * 2); x.lineTo(bx + 3, by + 2); x.fill(); } }
    };
    plat(POS[1][0], POS[1][1] - 2, 84, 19); plat(POS[0][0], POS[0][1] - 2, 100, 23);
    if (this.night || this.dusk) { x.globalCompositeOperation = 'multiply'; x.fillStyle = this.night ? '#6a74b0' : '#ffd0b8'; x.fillRect(0, 120, W, H - 120); }
    return c;
  }
  drawBattle(c) {
    const bt = this.bt, fx = this.fx;
    c.save(); fx.camera(c);
    c.drawImage(bt.bg, 0, 0);
    this.drawWx(c, 0);
    fx.draw(c, 'back');
    this.me.actor.draw(c, 40, 282, 2);
    if (bt.tr && bt.trOff < 160) bt.tr.actor.draw(c, 300 + bt.trOff, 150, 2);
    this.drawSide(c, 1); this.drawSide(c, 0);
    if (this.ball) this.drawOrb(c, this.ball.x, this.ball.y, 8, this.ball.rot, this.ball.open);
    fx.draw(c, 'front');
    this.drawWx(c, 1);
    c.restore();
    if (fx.impact > 0) this.drawImpact(c);
    else { this.drawHud(c, 1); this.drawHud(c, 0); this.drawMenu(c); }
    fx.draw(c, 'top'); if (fx.impact <= 0) fx.drawFlash(c);
    if (this.card) this.drawCard(c);
  }
  drawSide(c, s, flat) {
    const S = this.bs[s]; if (!S?.m || S.hidden || S.faint >= 1) return;
    const m = S.m, sp = sprite(m), size = sp.size * SC, [x0, y0] = POS[s];
    let img = sp.frames[Math.floor(this.t * 2.2 + s * 0.5) % 2];
    if (S.atk > 0) img = sp.attack[S.atk > 0.3 ? 0 : S.atk > 0.12 ? 1 : 2];
    if (S.hurt > 0) img = sp.hurt;
    if (S.faint > 0) img = sp.dead;
    if (flat) return [img, x0, y0 - (sp.floats ? 8 : 0), size];
    const [ox, oy] = POS[1 - s], L = S.lungeD ? Math.sin(Math.PI * (1 - S.lungeT / S.lungeD)) * 0.42 * S.lungeK : 0;
    const x = x0 + (ox - x0) * L + (S.hurt > 0 ? Math.sin(this.t * 70) * 4 : 0) - S.slide * (s ? 320 : -320) + (s ? 1 : -1) * Math.sin((S.dodge / 0.45) * Math.PI) * 34;
    const y = y0 + (oy - y0) * L + S.faint * 18 - Math.sin((S.hop / 0.4) * Math.PI) * 12 - (sp.floats ? 8 + Math.sin(this.t * 2.4 + s) * 3 : 0);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x0 + (ox - x0) * L - S.slide * (s ? 320 : -320), y0 - 2, size * 0.3, size * 0.07, 0, 0, TAU); c.fill();
    const sc = S.enter < 1 ? ease(S.enter) : S.scale;
    c.save(); c.translate(Math.round(x), Math.round(y)); if (s === 1) c.scale(-1, 1); c.scale(sc, sc); c.imageSmoothingEnabled = false;
    c.globalAlpha = 1 - S.faint;
    if (L > 0.05) { c.globalAlpha = 0.35; c.drawImage(silhouette(img, ECOL[m.el]), -size / 2 - L * 70, -size + 4, size, size); c.globalAlpha = 0.2; c.drawImage(silhouette(img, ECOL[m.el]), -size / 2 - L * 140, -size + 4, size, size); c.globalAlpha = 1; }
    c.drawImage(img, -size / 2, -size + 4, size, size);
    const wh = S.enter < 1 ? 1 - S.enter : Math.max(S.white, S.hurt > 0 && Math.floor(this.t * 20) % 2 ? 0.6 : 0);
    if (wh > 0) { c.globalAlpha = wh; c.drawImage(silhouette(img, '#fff'), -size / 2, -size + 4, size, size); }
    c.restore();
  }
  // anime impact frame: stark two-tone silhouettes with focus lines
  drawImpact(c) {
    const inv = Math.floor(this.fx.impact * 50) % 2, bg = inv ? '#fff' : '#0a0610', fg = inv ? '#0a0610' : '#fff', [cx, cy] = this.fx.zx ? [this.fx.zx, this.fx.zy] : [W / 2, H / 2];
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.fillStyle = fg; c.globalAlpha = 0.7; c.beginPath();
    for (let i = 0; i < 46; i++) { const a = Math.random() * TAU, w = 0.01 + Math.random() * 0.03, r0 = 40 + Math.random() * 50; c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a - w) * 500, cy + Math.sin(a - w) * 500); c.lineTo(cx + Math.cos(a + w) * 500, cy + Math.sin(a + w) * 500); }
    c.fill(); c.globalAlpha = 1;
    for (const s of [1, 0]) { const r = this.drawSide(c, s, true); if (!r) continue; const [img, x, y, size] = r; c.save(); c.translate(x, y); if (s) c.scale(-1, 1); c.drawImage(silhouette(img, fg), -size / 2, -size + 4, size, size); c.restore(); }
    c.fillStyle = ECOL[this.bs[0].m.el]; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(0, H * 0.62); c.lineTo(W, H * 0.3); c.lineTo(W, H * 0.33); c.lineTo(0, H * 0.67); c.fill(); c.globalAlpha = 1;
  }
  drawWx(c, front) {
    const w = this.bt.wx; if (!w) return;
    const t = this.t; c.save();
    if (w.k === 'sun' && !front) { const g = c.createRadialGradient(330, -10, 10, 330, -10, 380); g.addColorStop(0, 'rgba(255,220,120,.55)'); g.addColorStop(1, 'rgba(255,160,60,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,240,180,.12)'; for (let i = 0; i < 7; i++) { const a = 1.7 + i * 0.22 + Math.sin(t * 0.5 + i) * 0.05; c.beginPath(); c.moveTo(330, -10); c.lineTo(330 + Math.cos(a) * 600, -10 + Math.sin(a) * 600); c.lineTo(330 + Math.cos(a + 0.07) * 600, -10 + Math.sin(a + 0.07) * 600); c.fill(); } }
    if (w.k === 'rain') { if (!front) { c.fillStyle = 'rgba(20,40,90,.22)'; c.fillRect(0, 0, W, H); } else { c.strokeStyle = 'rgba(190,215,255,.6)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 70; i++) { const x = ((i * 53 + t * 240) % (W + 60)) - 30, y = ((i * 97 + t * 900) % (H + 40)) - 20; c.moveTo(x, y); c.lineTo(x - 5, y + 15); } c.stroke(); } }
    if (w.k === 'sand' && front) { c.fillStyle = 'rgba(210,170,90,.2)'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(240,210,140,.8)'; for (let i = 0; i < 60; i++) c.fillRect(((i * 71 + t * 420) % (W + 40)) - 20, (i * 43 + Math.sin(t * 3 + i) * 8) % H, 3, 1); }
    if (w.k === 'bloom' && front) { c.fillStyle = '#ffb0d8'; for (let i = 0; i < 28; i++) { const x = ((i * 67 + t * 30) % (W + 20)) - 10, y = ((i * 89 + t * 40) % (H + 20)) - 10; c.save(); c.translate(x, y); c.rotate(t * 2 + i); c.beginPath(); c.ellipse(0, 0, 3, 1.6, 0, 0, TAU); c.fill(); c.restore(); } }
    if (w.k === 'eclipse' && !front) { c.fillStyle = 'rgba(40,10,70,.38)'; c.fillRect(0, 0, W, H); const g = c.createRadialGradient(300, 50, 16, 300, 50, 46); g.addColorStop(0, 'rgba(255,220,255,.9)'); g.addColorStop(1, 'rgba(160,80,255,0)'); c.fillStyle = g; c.fillRect(250, 0, 100, 100); c.fillStyle = '#05020a'; c.beginPath(); c.arc(300, 50, 17, 0, TAU); c.fill(); }
    if (w.k === 'aurora' && !front) { c.fillStyle = 'rgba(10,20,50,.25)'; c.fillRect(0, 0, W, H); for (let k = 0; k < 3; k++) { c.fillStyle = k % 2 ? 'rgba(255,120,220,.16)' : 'rgba(110,255,190,.18)'; c.beginPath(); c.moveTo(0, 20 + k * 22); for (let x = 0; x <= W; x += 12) c.lineTo(x, 20 + k * 22 + Math.sin(x * 0.03 + t * 1.2 + k) * 14); for (let x = W; x >= 0; x -= 12) c.lineTo(x, 50 + k * 22 + Math.sin(x * 0.025 + t + k) * 10); c.fill(); } }
    c.restore();
  }
  drawHud(c, s) {
    const S = this.bs[s]; if (!S?.m || (S.hidden && S.enter >= 1 && !this.ball)) return;
    const m = S.m, foe = s === 1, w = 172, h = foe ? 46 : 62, x = foe ? 8 - S.slide * 220 : W - w - 8 + S.slide * 220, y = foe ? 64 : 196, col = ECOL[m.el];
    c.beginPath(); c.moveTo(x + 10, y); c.lineTo(x + w, y); c.lineTo(x + w - 10, y + h); c.lineTo(x, y + h); c.closePath();
    c.fillStyle = 'rgba(14,10,26,.86)'; c.fill(); c.lineWidth = 2; c.strokeStyle = col; c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(x + 17, y + 16, 11, 0, TAU); c.fill(); c.strokeStyle = '#140a14'; c.lineWidth = 1.5; c.stroke();
    this.tx(c, EKAN[m.el], x + 17, y + 16.5, 13, '#140a14', 'center', { j: 1, w: 900 });
    this.tx(c, m.name, x + 33, y + 13, 13, '#fff', 'left', { it: 1, w: 900 });
    this.tx(c, `Lv${m.lv}`, x + w - 14, y + 13, 11, '#ffe9a8', 'right', { w: 800 });
    if (foe && !this.bt.tr && this.caught.has(m.seed)) this.drawOrb(c, x + w - 50, y + 13, 4.5);
    let hx = x + 33;
    if (m.status) { c.fillStyle = STATUS[m.status][1]; roundRect(c, hx, y + 25, 26, 11, 3); c.fill(); this.tx(c, STATUS[m.status][0], hx + 13, y + 31, 8, '#140a14', 'center', { w: 900 }); hx += 30; }
    this.tx(c, 'HP', hx, y + 31, 8, '#ffd23a', 'left', { w: 900 });
    const bw = x + w - 18 - (hx + 16), f = clamp(m.hpShow / m.max, 0, 1);
    c.fillStyle = '#2a2234'; c.fillRect(hx + 16, y + 27, bw, 7); c.fillStyle = f > 0.5 ? '#6fd36a' : f > 0.2 ? '#ffd23a' : '#ff5a3a'; c.fillRect(hx + 16, y + 27, bw * f, 7); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(hx + 16, y + 27, bw * f, 2);
    if (foe) return;
    this.tx(c, `${Math.ceil(m.hpShow)}/${m.max}`, x + w - 18, y + 45, 11, '#fff', 'right', { w: 800 });
    const g = clamp(m.gauge, 0, 1), full = g >= 1;
    this.tx(c, 'SP', x + 14, y + 45, 8, full ? '#fff' : '#d8b8ff', 'left', { w: 900 });
    c.fillStyle = '#2a2234'; c.fillRect(x + 28, y + 42, 66, 5); c.fillStyle = full ? `hsl(${(this.t * 300) % 360},90%,65%)` : '#b080ff'; c.fillRect(x + 28, y + 42, 66 * g, 5);
    c.fillStyle = '#2a2234'; c.fillRect(x + 10, y + h - 6, w - 30, 3); c.fillStyle = '#5ab8ff'; c.fillRect(x + 10, y + h - 6, (w - 30) * clamp(m.xp / need(m.lv), 0, 1), 3);
  }
  drawMenu(c) {
    const me = this.bs[0].m, foe = this.bs[1].m, menu = this.menu, cur = this.cursor;
    if (this.msg) this.drawMsg(c, H - 140, 52);
    const show = menu === 'moves' ? 'moves' : 'act';
    for (let i = 0; i < 4; i++) {
      const bx = 8 + (i % 2) * (W / 2 - 4), by = H - 84 + Math.floor(i / 2) * 42, bw = W / 2 - 12, bh = 38;
      let col, label, sub, dim = !menu || menu === 'team', mark = '';
      if (show === 'act') { [label, sub, col] = ACTS[i]; if (i === 1) { label = `ORB ×${this.orbs}`; dim ||= !!this.bt.tr || !this.orbs; } if (i === 3) dim ||= !!this.bt.tr; }
      else { const mv = me.moves[i]; if (!mv) continue; col = ECOL[mv.e]; label = mv.n; sub = `${EKAN[mv.e]} ${mv.k === 't' ? 'STATUS' : `${mv.k === 'p' ? 'PHYS' : 'SPEC'} ${mv.p}${mv.hits ? '×' + mv.hits[1] : ''}`}`; if (mv.p) { const e = eff(mv.e, foe.el); mark = e > 1 ? '▲▲' : e === 0 ? '✕' : e < 1 ? '▼' : ''; } }
      c.globalAlpha = dim ? 0.42 : 1;
      const g = c.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, col); g.addColorStop(1, tone(col.match(/\w\w/g).map((v) => parseInt(v, 16)), -0.3)); c.fillStyle = g;
      roundRect(c, bx, by, bw, bh, 9); c.fill(); c.strokeStyle = 'rgba(20,10,20,.8)'; c.lineWidth = 2; c.stroke();
      this.tx(c, label, bx + 12, by + 14, show === 'act' ? 14 : 12, '#140a14', 'left', { it: 1, w: 900 });
      this.tx(c, sub, bx + 12, by + 29, 9, 'rgba(20,10,20,.8)', 'left', { j: 1, w: 800 });
      if (mark) this.tx(c, mark, bx + bw - 10, by + 14, 11, mark === '▼' || mark === '✕' ? '#7a1020' : '#0a5a18', 'right', { w: 900 });
      if (cur && cur[0] === show && cur[1] === i && menu) { c.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 12); c.strokeStyle = '#fff'; c.lineWidth = 3; roundRect(c, bx - 2, by - 2, bw + 4, bh + 4, 11); c.stroke(); c.globalAlpha = 1; this.tx(c, '▶', bx - 4, by + bh / 2, 13, '#fff', 'center', { st: 3 }); }
      c.globalAlpha = 1;
    }
    if (menu && !this.forced && me.gauge >= 1) {
      const p = 1 + Math.sin(this.t * 8) * 0.06, g = c.createRadialGradient(BX, BY, 2, BX, BY, 22 * p); g.addColorStop(0, '#fff'); g.addColorStop(0.5, ECOL[me.el]); g.addColorStop(1, tone([40, 10, 60], 0));
      c.fillStyle = g; c.beginPath(); c.arc(BX, BY, 21 * p, 0, TAU); c.fill(); c.lineWidth = 3; c.strokeStyle = `hsl(${(this.t * 300) % 360},90%,70%)`; c.stroke();
      this.tx(c, '必殺', BX, BY - 2, 13, '#140a14', 'center', { j: 1, w: 900, st: 3, sc: '#fff' }); this.tx(c, 'BURST', BX, BY + 12, 7, '#fff', 'center', { w: 900, st: 2 });
      if (cur && cur[0] === 'burst') { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(BX, BY, 27, 0, TAU); c.stroke(); }
    }
    if (menu === 'team') this.drawTeam(c);
  }
  drawTeam(c) {
    const n = this.team.length, cur = this.cursor;
    c.fillStyle = 'rgba(12,9,22,.94)'; roundRect(c, 14, 36, W - 28, 30 + n * 34, 10); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    this.tx(c, this.forced ? 'CHOOSE A SPIRIT' : 'TEAM · なかま', 26, 49, 11, '#ffe9a8', 'left', { it: 1, w: 900, j: !this.forced });
    this.team.forEach((m, i) => {
      const y = 60 + i * 34, active = m === this.bs[0].m, f = m.hp / m.max;
      c.globalAlpha = m.hp > 0 ? 1 : 0.4;
      c.fillStyle = active ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)'; roundRect(c, 20, y, W - 40, 31, 6); c.fill();
      c.drawImage(mini(m).frames[0], 24, y + 2);
      this.tx(c, m.name, 56, y + 10, 12, '#fff', 'left', { it: 1, w: 900 }); this.tx(c, `Lv${m.lv}`, 56, y + 23, 9, '#ffe9a8', 'left', { w: 800 });
      c.fillStyle = ECOL[m.el]; c.beginPath(); c.arc(150, y + 15, 8, 0, TAU); c.fill(); this.tx(c, EKAN[m.el], 150, y + 15.5, 10, '#140a14', 'center', { j: 1, w: 900 });
      c.fillStyle = '#2a2234'; c.fillRect(168, y + 12, 110, 6); c.fillStyle = f > 0.5 ? '#6fd36a' : f > 0.2 ? '#ffd23a' : '#ff5a3a'; c.fillRect(168, y + 12, 110 * f, 6);
      this.tx(c, active ? 'IN BATTLE' : m.hp > 0 ? `${m.hp}/${m.max}` : 'FAINTED', W - 28, y + 15, 9, active ? '#7dffa8' : '#fff', 'right', { w: 800 });
      c.globalAlpha = 1;
      if (cur && cur[0] === 'team' && cur[1] === i) { c.strokeStyle = '#fff'; c.lineWidth = 2.5; roundRect(c, 18, y - 2, W - 36, 35, 7); c.stroke(); }
    });
  }
  drawCard(c) {
    const { m, t } = this.card, k = ease(Math.min(1, t / 0.3)), out = t > 1.8 ? (t - 1.8) / 0.3 : 0, sp = sprite(m), col = ECOL[m.el], no = [...this.caught].indexOf(m.seed) + 1;
    c.save(); c.globalAlpha = 1 - out; c.translate((1 - k) * -W, 0);
    c.fillStyle = 'rgba(8,6,16,.92)'; c.beginPath(); c.moveTo(0, 74); c.lineTo(W, 54); c.lineTo(W, 236); c.lineTo(0, 256); c.closePath(); c.fill(); c.strokeStyle = col; c.lineWidth = 3; c.stroke();
    const g = c.createRadialGradient(96, 156, 10, 96, 156, 90); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 60, 200, 190);
    c.imageSmoothingEnabled = true; c.drawImage(sp.big, 16, 76, 160, 160); c.imageSmoothingEnabled = false;
    this.tx(c, '図鑑登録', W - 16, 84, 14, '#ffe9a8', 'right', { j: 1, w: 900 });
    this.tx(c, `No.${String(no).padStart(3, '0')}`, 186, 110, 12, '#bfe8ff', 'left', { w: 900 });
    this.tx(c, m.name, 186, 134, 22, '#fff', 'left', { it: 1, w: 900, st: 4 });
    this.tx(c, m.sp.species, 186, 158, 11, '#ddd', 'left', { it: 1, w: 700 });
    c.fillStyle = col; roundRect(c, 186, 172, 70, 18, 9); c.fill(); this.tx(c, `${EKAN[m.el]} ${m.el.toUpperCase()}`, 221, 181.5, 10, '#140a14', 'center', { j: 1, w: 900 });
    this.tx(c, `DEX ${this.caught.size}/${this.dexTotal}`, 186, 210, 12, '#ffe9a8', 'left', { w: 900 });
    c.restore();
  }
  drawEvo(c) {
    const E = this.evo, t = E.t, col = ECOL[E.el];
    const g = c.createRadialGradient(W / 2, 190, 10, W / 2, 190, 300); g.addColorStop(0, col); g.addColorStop(0.4, '#1a0e2a'); g.addColorStop(1, '#05030a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.18; c.fillStyle = '#fff'; c.translate(W / 2, 190); c.rotate(t * 0.4);
    for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(420, -30); c.lineTo(420, 30); c.fill(); }
    c.restore();
    const flick = !E.done && t > 0.6 && Math.sin(t * t * 5) > 0, img = E.done || flick ? E.b || E.a : E.a, s = 190 * (1 + Math.sin(t * 8) * (E.done ? 0 : 0.03));
    c.save(); c.imageSmoothingEnabled = true;
    if (!E.done) { c.drawImage(img, W / 2 - s / 2, 190 - s / 2, s, s); c.globalAlpha = clamp(t / 0.6, 0, 1); c.drawImage(silhouette(img, '#fff'), W / 2 - s / 2, 190 - s / 2, s, s); }
    else c.drawImage(img, W / 2 - s / 2, 190 - s / 2, s, s);
    c.restore();
    this.fx.draw(c, 'front'); this.fx.draw(c, 'top'); this.fx.drawFlash(c);
    if (this.msg) this.drawMsg(c, H - 64, 56);
  }
  drawTrans(c) {
    const T = this.trans, t = T.t, k = clamp(t / T.dur, 0, 1);
    c.save();
    if (T.k === 'wild' || (T.k === 'vs' && t < 0.3)) {
      if (t < 0.48) { if (Math.floor(t * 12.5) % 2 === 0) { c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(0, 0, W, H); } }
      else { const p = clamp((t - 0.48) / (T.dur - 0.5), 0, 1); c.fillStyle = '#07050d'; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + p * 2.2; c.beginPath(); c.moveTo(W / 2, H / 2); c.arc(W / 2, H / 2, 420, a, a + (p * Math.PI) / 4 + 0.01); c.closePath(); c.fill(); } c.beginPath(); c.arc(W / 2, H / 2, p * p * 300, 0, TAU); c.fill(); }
    } else if (T.k === 'vs') this.drawVs(c, t, T);
    else if (T.k === 'in') { const h = (1 - ease(k)) * (H / 2); c.fillStyle = '#07050d'; c.fillRect(0, 0, W, h); c.fillRect(0, H - h, W, h); }
    else if (T.k === 'fade') { c.globalAlpha = k < 0.5 ? k * 2 : (1 - k) * 2; c.fillStyle = '#07050d'; c.fillRect(0, 0, W, H); }
    c.restore();
  }
  drawVs(c, t, T) {
    const p = ease(clamp((t - 0.3) / 0.35, 0, 1)), out = clamp((t - (T.dur - 0.35)) / 0.35, 0, 1), mc = ECOL[T.lead.el], tc = ECOL[T.tr.team[0].el];
    c.fillStyle = '#07050d'; c.fillRect(0, 0, W, H);
    c.fillStyle = mc; c.beginPath(); c.moveTo(-W * (1 - p), 0); c.lineTo(W * 0.6 - W * (1 - p), 0); c.lineTo(W * 0.4 - W * (1 - p), H); c.lineTo(-W * (1 - p), H); c.fill();
    c.fillStyle = tc; c.beginPath(); c.moveTo(W * 0.6 + W * (1 - p) + 6, 0); c.lineTo(W * 2, 0); c.lineTo(W * 2, H); c.lineTo(W * 0.4 + W * (1 - p) + 6, H); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 26; i++) { const y = (i * 37) % H, x = ((i * 151 + t * 1400) % (W + 200)) - 100; c.fillRect(i % 2 ? x : W - x, y, 70 + (i % 5) * 20, 1 + (i % 3)); }
    const sx = 90 - (1 - p) * 200, ox = W - 90 + (1 - p) * 200;
    drawFrame(c, this.me.actor.sheet, 'idle', 'E', Math.floor(t * 4) % 2, sx, 300, 4);
    drawFrame(c, T.tr.actor.sheet, 'idle', 'W', Math.floor(t * 4) % 2, ox, 210, 4);
    this.tx(c, this.skin.heroName || 'YOU', 24, 340, 15, '#fff', 'left', { it: 1, w: 900, st: 5 });
    this.tx(c, T.tr.name.toUpperCase(), W - 20, 74, 15, '#fff', 'right', { it: 1, w: 900, st: 5 });
    const vs = 1 + Math.max(0, 0.6 - (t - 0.55)) * 2;
    c.save(); c.translate(W / 2, H / 2 - 10); c.scale(vs, vs); c.rotate(-0.12); this.tx(c, 'VS', 0, 0, 64, '#ffe14a', 'center', { it: 1, w: 900, st: 12, sc: '#140a14' }); c.restore();
    if (out > 0) { c.globalAlpha = out; c.fillStyle = '#07050d'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  }
  hud() { return `dex ${this.caught.size}/${this.dexTotal} · ${this.score}`; }
}
