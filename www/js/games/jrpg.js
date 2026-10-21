// Final Fantasy-style RPG: a party of three roams a generated overworld, rests in
// towns, delves into multi-floor dungeons for chests and a boss, and fights classic
// side-view turn-based battles with spells, potions and level ups.
import { Game, W, H, drawFit, ready, roundRect, noiseMap } from './engine.js';
import { monster, creatureName } from './creature.js';
import { crystalSheet, Actor, S } from '../crystal/sprites.js';

const T = 20, N = 64, DN = 36;
const GRASS = 0, FOREST = 1, HILL = 2, MOUNT = 3, WATER = 4, ROAD = 5, TOWN = 6, CAVE = 7, SAND = 8;
const ENC = [0.035, 0.085, 0.06, 0, 0, 0.012, 0, 0, 0.03];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CLASSES = [
  { job: 'Knight', hp: 46, mp: 0, atk: 11, def: 7, mag: 2, spd: 6, g: [10, 0, 3, 2, 0.4, 0.5], spells: [] },
  { job: 'Mage', hp: 28, mp: 26, atk: 5, def: 3, mag: 11, spd: 8, g: [5, 4, 1, 1, 2.6, 0.7], spells: [['Fire', 1], ['Bolt', 1], ['Flare', 7]] },
  { job: 'Cleric', hp: 34, mp: 22, atk: 7, def: 5, mag: 8, spd: 7, g: [7, 3.5, 1.6, 1.4, 2, 0.6], spells: [['Cure', 1], ['Bolt', 4], ['Cura', 7]] }
];
const SPELLS = {
  Fire: { mp: 6, all: 1, pow: 1.05, col: '#ff7a2a' }, Bolt: { mp: 4, pow: 1.7, col: '#ffe14a' }, Flare: { mp: 14, pow: 3.2, col: '#ff4a8a' },
  Cure: { mp: 5, heal: 1, pow: 2.4, col: '#7dffa8' }, Cura: { mp: 12, heal: 1, all: 1, pow: 1.6, col: '#a8ffd8' }
};
const GEAR = ['Bronze', 'Iron', 'Steel', 'Silver', 'Mithril', 'Rune', 'Dragon', 'Star', 'Void'];
const DNAME = ['Cave', 'Crypt', 'Tower', 'Ruins', 'Mines', 'Temple', 'Lair', 'Vault'];
const need = (lv) => Math.round(12 * lv ** 1.7);
// Crystal Sprite party: the classes wear the matching FF jobs, in four directions
const DIR4 = ['S', 'W', 'N', 'E'], CJOB = { Knight: 'Knight', Mage: 'Black Mage', Cleric: 'White Mage' };
const LUNGE = -42, BSC = 2; // battle step-forward distance and sprite scale

export class Jrpg extends Game {
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'giant', 'tiny', 'trails'];
  setup() {
    const s = this.post.seed || 1;
    this.party = CLASSES.map((cl, k) => ({ hero: true, k, cl, job: cl.job, name: creatureName(s * 3 + k * 71).slice(0, 7), lv: 1, xp: 0, max: cl.hp, hp: cl.hp, mmp: cl.mp, mp: cl.mp, atk: cl.atk, def: cl.def, mag: cl.mag, spd: cl.spd, bo: 0, actor: new Actor(this.partySheet(k, s), { mode: 'four', dir: 'S', walkSpeed: 4, runSpeed: 160, walkStride: 12, runStride: 16 }) }));
    this.gold = 40; this.potions = 3; this.wpn = 0; this.arm = 0; this.world = 0; this.cleared = 0; this.dCount = 0;
    this.pops = []; this.patMemo = new Map(); this.route = []; this.think = 0; this.grace = 6; this.mode = 'world';
    this.newWorld();
  }
  partySheet(k, s) {
    if (k === 0 && this.skin.heroName) return this.skin.crystal(0, 'Fantasy', DIR4);
    const o = S.options, v = ((s >>> 0) % 12) + 1, job = CJOB[CLASSES[k].job];
    const char = S.setCharacter({ job, hairColor: o.hairColor[(v * 3 + k * 5) % o.hairColor.length], ...(job === 'Black Mage' ? {} : { skin: o.skin[(v + k * 2) % o.skin.length] }) }, v * 7 + k);
    return crystalSheet(v * 7 + k, { char, dirs: DIR4 });
  }
  // emote for the whole living party (or just the leader)
  emoteParty(name, secs, lead = false) { for (const h of lead ? [this.party[0]] : this.party) if (h.hp > 0) h.actor.emote(name, secs); }
  // ---------------------------------------------------------------- world generation
  newWorld() {
    const R = () => this.rng();
    let best = null;
    for (let tries = 0; tries < 6; tries++) {
      const e = noiseMap(R, N, 4, 3), m = noiseMap(R, N, 3, 3), map = new Uint8Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, d = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2);
        const v = x < 2 || y < 2 || x > N - 3 || y > N - 3 ? 0 : 0.5 + (e[i] - 0.5) * 2.6 - Math.max(0, d - 0.55) * 1.6 + 0.04;
        map[i] = v < 0.36 ? WATER : v < 0.4 ? SAND : v > 0.75 ? MOUNT : v > 0.66 ? HILL : m[i] > 0.58 ? FOREST : GRASS;
      }
      // keep the biggest walkable landmass
      const comp = new Int32Array(N * N).fill(-1); let big = -1, bigN = 0;
      for (let i = 0; i < N * N; i++) {
        if (comp[i] >= 0 || !this.passW(map[i])) continue;
        const q = [i]; comp[i] = i;
        for (let h = 0; h < q.length; h++) { const j = q[h], x = j % N, y = (j / N) | 0; for (const [dx, dy] of DIRS) { const k = (y + dy) * N + x + dx; if (comp[k] < 0 && this.passW(map[k])) { comp[k] = i; q.push(k); } } }
        if (q.length > bigN) { bigN = q.length; big = i; }
      }
      if (!best || bigN > best.n) best = { map, comp, big, n: bigN };
      if (bigN > 1100) break;
    }
    const { map, comp, big } = best, land = [];
    for (let i = 0; i < N * N; i++) if (comp[i] === big) land.push(i);
    const pick = (f) => { const c = land.filter(f); return c.length ? c[Math.floor(R() * c.length)] : land[Math.floor(R() * land.length)]; };
    const cxy = (i) => [i % N, (i / N) | 0];
    const t0 = pick((i) => { const [x, y] = cxy(i); return map[i] === GRASS && Math.hypot(x - N / 2, y - N / 2) < 16; });
    let dist = this.flood(map, t0);
    const maxD = Math.max(...land.map((i) => dist[i]));
    const t1 = pick((i) => dist[i] > maxD * 0.55 && dist[i] < maxD * 0.85 && map[i] !== MOUNT);
    const s = (this.post.seed || 1) + this.world * 977;
    this.towns = [t0, t1].map((i, k) => { map[i] = TOWN; const [x, y] = cxy(i); return { x, y, name: `${creatureName(s + k * 13)} ${k ? 'Port' : 'Village'}` }; });
    const placed = [t0, t1];
    this.dungeons = [];
    for (let k = 0; k < 4; k++) {
      const want = maxD * (0.18 + k * 0.22);
      let bi = -1, bv = 1e9;
      for (let n = 0; n < 160; n++) {
        const i = land[Math.floor(R() * land.length)], [x, y] = cxy(i);
        if (map[i] === TOWN || placed.some((p) => Math.abs((p % N) - x) + Math.abs(((p / N) | 0) - y) < 9)) continue;
        const v = Math.abs(dist[i] - want) + (map[i] === HILL || map[i] === FOREST ? -3 : 0);
        if (v < bv) { bv = v; bi = i; }
      }
      if (bi < 0) bi = pick((i) => map[i] !== TOWN && !placed.includes(i));
      placed.push(bi); map[bi] = CAVE;
      const [x, y] = cxy(bi), lv = 2 + this.dCount * 3;
      this.dungeons.push({ x, y, k: this.dCount, lv, floors: 2, done: false, name: `${DNAME[(s + k) % DNAME.length]} of ${creatureName(s * 7 + k * 31)}`, d0: dist[bi] });
      this.dCount++;
    }
    this.dungeons.sort((a, b) => a.d0 - b.d0).forEach((d, k) => { d.k = this.dCount - 4 + k; d.lv = 2 + d.k * 3; d.floors = d.k >= 2 ? 3 : 2; });
    // roads: town to town, and towns to the first dungeon
    this.wm = map;
    const road = (a, b) => { const p = this.findRoute(N, (j) => this.passW(map[j]), a % N, (a / N) | 0, (j) => j === b); for (const [x, y] of p || []) { const j = y * N + x; if (map[j] !== TOWN && map[j] !== CAVE) map[j] = ROAD; } };
    road(t0, t1); road(t0, this.dungeons[0].y * N + this.dungeons[0].x); road(t1, this.dungeons[3].y * N + this.dungeons[3].x);
    this.mini = null; this.lastTown = this.towns[0]; this.dg = null; this.mode = 'world';
    this.place(this.towns[0].x, this.towns[0].y);
    this.label = { s: `World ${this.world + 1}: ${this.towns[0].name}`, t: 2.5 };
  }
  passW(t) { return t !== MOUNT && t !== WATER; }
  flood(map, s) {
    const d = new Int16Array(N * N).fill(-1), q = [s]; d[s] = 0;
    for (let h = 0; h < q.length; h++) { const j = q[h], x = j % N, y = (j / N) | 0; for (const [dx, dy] of DIRS) { const k = (y + dy) * N + x + dx; if (x + dx >= 0 && x + dx < N && d[k] < 0 && this.passW(map[k])) { d[k] = d[j] + 1; q.push(k); } } }
    return d;
  }
  findRoute(n, pass, sx, sy, goal) {
    const s = sy * n + sx, prev = new Int32Array(n * n).fill(-1), q = [s]; prev[s] = s;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (i !== s && goal(i)) { const out = []; for (let j = i; j !== s; j = prev[j]) out.unshift([j % n, (j / n) | 0]); return out; }
      const x = i % n, y = (i / n) | 0;
      for (const [dx, dy] of DIRS) { const X = x + dx, Y = y + dy, j = Y * n + X; if (X >= 0 && Y >= 0 && X < n && Y < n && prev[j] < 0 && (pass(j) || goal(j))) { prev[j] = i; q.push(j); } }
    }
    return null;
  }
  place(x, y) { this.walkers = [0, 1, 2].map(() => ({ x, y, fx: x, fy: y, face: 1 })); this.route = []; this.arrive = false; }
  // ---------------------------------------------------------------- dungeons
  enterDungeon(d) {
    this.dg = { d, floor: 0 }; this.mode = 'dungeon'; this.genFloor();
    this.say = { who: d.name, s: `Recommended Lv ${d.lv}. ${d.floors} floors deep. Something stirs below…`, t: this.auto ? 1.4 : 2.5 };
    this.emoteParty('think', this.say.t);
  }
  genFloor() {
    const g = this.dg, d = g.d, map = new Uint8Array(DN * DN), rooms = [];
    for (let k = 0; k < 400 && rooms.length < 8; k++) {
      const w = this.ri(4, 8), h = this.ri(4, 7), x = this.ri(1, DN - w - 2), y = this.ri(1, DN - h - 2);
      if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map[y * DN + x] = 1;
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i]; let b = rooms[0];
      for (let j = 0; j < i; j++) if (Math.abs(rooms[j].cx - a.cx) + Math.abs(rooms[j].cy - a.cy) < Math.abs(b.cx - a.cx) + Math.abs(b.cy - a.cy)) b = rooms[j];
      const hx = this.rng() < 0.5;
      let x = a.cx, y = a.cy;
      const cut = () => { if (!map[y * DN + x]) map[y * DN + x] = 1; };
      if (hx) { while (x !== b.cx) { x += Math.sign(b.cx - x); cut(); } while (y !== b.cy) { y += Math.sign(b.cy - y); cut(); } }
      else { while (y !== b.cy) { y += Math.sign(b.cy - y); cut(); } while (x !== b.cx) { x += Math.sign(b.cx - x); cut(); } }
    }
    const st = rooms[0], dist = new Int16Array(DN * DN).fill(-1), q = [st.cy * DN + st.cx]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const j = q[h], x = j % DN, y = (j / DN) | 0; for (const [dx, dy] of DIRS) { const k = (y + dy) * DN + x + dx; if (dist[k] < 0 && map[k]) { dist[k] = dist[j] + 1; q.push(k); } } }
    const far = rooms.slice(1).reduce((a, r) => (dist[r.cy * DN + r.cx] > dist[a.cy * DN + a.cx] ? r : a), rooms[rooms.length - 1]);
    const last = g.floor === d.floors - 1;
    g.boss = last ? { x: far.cx, y: far.cy } : null;
    if (!last) map[far.cy * DN + far.cx] = 2;
    g.chests = [];
    for (const r of rooms.slice(1).filter((r) => r !== far).sort(() => this.rng() - 0.5).slice(0, this.ri(2, 3))) {
      const x = r.x + this.ri(0, r.w - 1), y = r.y + (this.rng() < 0.5 ? 0 : r.h - 1);
      if (x !== r.cx || y !== r.cy) g.chests.push({ x, y, open: false });
    }
    g.map = map; g.seen = new Uint8Array(DN * DN); g.rooms = rooms;
    g.wallTex = this.texK(9 + d.k); g.floorTex = this.texK(12 + d.k + g.floor);
    this.place(st.cx, st.cy); this.reveal();
    this.label = { s: `${d.name} · B${g.floor + 1}F`, t: 2 };
  }
  reveal() {
    const g = this.dg, w = this.walkers[0];
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const x = w.x + dx, y = w.y + dy; if (x >= 0 && y >= 0 && x < DN && y < DN && dx * dx + dy * dy <= 27) g.seen[y * DN + x] = 1; }
  }
  passD(i) { return this.dg.map[i] > 0 && this.dg.seen[i]; }
  openChest(ch) {
    ch.open = true; const lv = this.dg.d.lv, r = this.rng();
    let s;
    if (r < 0.45) { const n = Math.round((20 + lv * 9) * this.r(0.8, 1.3)); this.gold += n; s = `${n} gold!`; }
    else if (r < 0.8) { const n = this.ri(1, 2); this.potions += n; s = `${n} Potion${n > 1 ? 's' : ''}!`; }
    else if (this.rng() < 0.5) { this.wpn++; s = `${GEAR[Math.min(8, this.wpn)]} Blades! The party's attack rises.`; }
    else { this.arm++; s = `${GEAR[Math.min(8, this.arm)]} Mail! The party's defence rises.`; }
    this.say = { who: 'Treasure chest', s: `Found ${s}`, t: this.auto ? 1.1 : 2, chest: true };
    this.score += 20; this.burst(W / 2, H / 2 - 20, this.col(1), 18, 140);
    this.emoteParty(r < 0.8 ? 'cheer' : 'love', this.say.t, true); for (const h of this.party.slice(1)) h.actor.emote('surprise', 0.7);
  }
  clearDungeon(d) {
    d.done = true; this.cleared++; this.score += 300 * d.lv; this.mode = 'world'; this.dg = null; this.place(d.x, d.y);
    const all = this.dungeons.every((x) => x.done);
    this.say = { who: d.name, s: all ? 'The last seal is broken! The party sails on to a new land…' : 'The dungeon is cleared! Its evil fades from the land.', t: this.auto ? 2 : 3, then: all ? () => { this.world++; this.newWorld(); } : null };
    this.burst(W / 2, H / 2, this.col(0), 40, 220);
    for (const h of this.party) h.actor.face('S');
    this.emoteParty('cheer', this.say.t);
  }
  // ---------------------------------------------------------------- towns
  visitTown(tw) {
    this.lastTown = tw;
    for (const h of this.party) { h.hp = h.max; h.mp = h.mmp; }
    const lines = ['The party rests at the inn. HP and MP restored.'];
    const wc = Math.round(70 * (this.wpn + 1) ** 1.7), ac = Math.round(60 * (this.arm + 1) ** 1.7);
    if (this.gold >= wc + 36 && this.wpn < 8) { this.gold -= wc; this.wpn++; lines.push(`Bought ${GEAR[this.wpn]} Blades.`); }
    if (this.gold >= ac + 36 && this.arm < 8) { this.gold -= ac; this.arm++; lines.push(`Bought ${GEAR[this.arm]} Mail.`); }
    let n = 0; while (this.potions < 6 && this.gold >= 12) { this.gold -= 12; this.potions++; n++; }
    if (n) lines.push(`Bought ${n} Potion${n > 1 ? 's' : ''}.`);
    this.say = { who: tw.name, s: lines.join(' '), t: this.auto ? 1.6 : 3 };
    for (const h of this.party) { if (h.actor.isKO) h.actor.revive(); h.actor.face('S'); }
    this.party.forEach((h, k) => h.actor.emote(k ? (lines.length > 1 && k === 1 ? 'think' : 'nod') : 'wave', this.say.t));
  }
  // ---------------------------------------------------------------- battles
  encounter(boss = false) {
    const dg = this.dg, base = dg ? dg.d.lv + dg.floor : (this.dungeons.find((q) => !q.done)?.lv || 2) - 1;
    const lv = Math.max(1, boss ? base + 1 : base + this.ri(-1, 0));
    const n = boss ? 1 : this.ri(1, Math.min(4, 2 + (lv >> 2)));
    const zone = dg ? dg.d.k : this.cleared, s0 = (this.post.seed || 1) * 131 + zone * 17;
    const foes = [];
    for (let k = 0; k < n; k++) {
      const sp = boss ? s0 + 999 : s0 + this.ri(0, 3), m = boss ? 1 : this.r(0.9, 1.1), hp = Math.round((14 + lv * 11) * (boss ? 4.2 : 1) * m);
      const art = this.foeArt(sp, lv, boss);
      foes.push({ name: boss ? `${creatureName(sp)} the Dread` : creatureName(sp), lv, hp, max: hp, atk: (3.5 + lv * 2) * (boss ? 1.25 : 1), def: 2 + lv * 1.3, mag: 3 + lv * 1.8, spd: 3 + lv * 0.5 + this.r(0, 3), xp: Math.round((6 + lv * 5) * (boss ? 7 : 1)), gp: Math.round((4 + lv * 3) * (boss ? 6 : 1) * this.r(0.8, 1.2)), art, boss, dead: 0 });
    }
    this.bt = { foes, boss, from: this.mode, order: [], actor: null, phase: 'intro', wait: 0.9, msg: boss ? `${foes[0].name} blocks the way!` : `${n > 1 ? `${n} monsters` : `A ${foes[0].name}`} attack${n > 1 ? '' : 's'}!`, menu: 'main', anim: null, shake: null, msgs: [], round: 0 };
    this.mode = 'battle'; this.grace = 5;
    // the party lines up facing the monsters (west) and starts at the sight of them
    for (const h of this.party) { h.bo = 0; h.castT = 0; if (h.hp > 0 && h.actor.isKO) h.actor.revive(); h.actor.stopCast(); h.actor.face('W'); if (h.hp > 0) h.actor.emote('surprise', 0.9); }
  }
  foeArt(sp, lv, boss) { return monster(sp, this.skin.hue + 150 + (sp % 5) * 40, boss ? 28 : 16 + (sp % 3) * 3, Math.min(4, lv >> 2), { tex: this.skin.texFor?.(sp % 9), head: !boss && sp % 3 === 0 ? this.skin.slots.enemy[sp % Math.max(1, this.skin.slots.enemy.length)] : null }); }
  heroPos(k) { return [292 + k * 12, 132 + k * 58]; }
  foePos(f) {
    const b = this.bt, i = b.foes.indexOf(f), n = b.foes.length;
    if (b.boss) return [100, 175];
    if (n === 1) return [100, 180];
    return [[70, 135], [145, 170], [70, 220], [145, 255]][i];
  }
  posOf(u) { return u.hero ? this.heroPos(u.k) : this.foePos(u); }
  atkOf(u) { return u.atk + (u.hero ? this.wpn * 3 : 0); }
  defOf(u) { return u.def + (u.hero ? this.arm * 2 : 0); }
  knows(h, s) { return h.cl.spells.some(([n, l]) => n === s && h.lv >= l); }
  alive(list) { return list.filter((u) => u.hp > 0); }
  nextTurn() {
    const b = this.bt;
    for (let g = 0; g < 20; g++) {
      if (!b.order.length) {
        b.round++;
        const us = [...this.alive(this.party), ...this.alive(b.foes)];
        if (b.boss && b.foes[0].lv >= 7) us.push(...this.alive(b.foes));
        b.order = us.map((u) => [u, u.spd * this.r(0.75, 1.25)]).sort((a, c) => c[1] - a[1]).map((x) => x[0]);
      }
      const a = b.order.shift();
      if (a.hp <= 0) continue;
      if (a.hero) { b.phase = 'cmd'; b.actor = a; b.menu = 'main'; b.msg = `${a.name} the ${a.job}: your move`; return; }
      return this.act(a, this.foeAI(a));
    }
  }
  foeAI(f) {
    const al = this.alive(this.party);
    if (f.boss && this.rng() < 0.3) return { k: 'breath' };
    if (!f.boss && f.lv >= 4 && this.rng() < 0.15) return { k: 'zap', t: al[this.ri(0, al.length - 1)] };
    const w = al.map((h) => (h.job === 'Knight' ? 1.6 : 1)), tot = w.reduce((a, c) => a + c, 0);
    let r = this.r(0, tot), t = al[0];
    for (let i = 0; i < al.length; i++) { r -= w[i]; if (r <= 0) { t = al[i]; break; } }
    return { k: 'atk', t };
  }
  phys(a, d) { const crit = this.rng() < 0.07 ? 1.7 : 1; return [Math.max(1, Math.round((this.atkOf(a) * 1.9 - this.defOf(d)) * this.r(0.85, 1.1) * crit)), crit > 1]; }
  hurt(t, n, col) {
    t.hp = Math.max(0, t.hp - n);
    const [x, y] = this.posOf(t);
    this.pops.push({ x: x + this.r(-8, 8), y: y - 20, s: `${n}`, col: col || '#fff', life: 1 });
    this.bt.shake = { u: t, t: 0.3 };
    if (t.hero) { if (t.hp <= 0) t.actor.ko(); else t.actor.hurt(); }
    if (t.hp <= 0) { this.burst(x, y, t.hero ? this.col(3) : this.col(0), 14, 150); if (t.hero) this.bt.order = this.bt.order.filter((u) => u !== t); }
  }
  heal(t, n) { t.hp = Math.min(t.max, t.hp + n); const [x, y] = this.posOf(t); this.pops.push({ x, y: y - 20, s: `+${n}`, col: '#7dffa8', life: 1 }); }
  act(a, ch) {
    const b = this.bt;
    b.phase = 'act'; b.wait = this.auto ? 0.75 : 0.9; b.actor = a.hero ? a : null; b.hl = a.hero ? { atk: 0, spell: 1, item: 2, run: 3 }[ch.k] : -1;
    if (!a.hero) b.anim = { u: a, t: 0.5, k: ch.k };
    // heroes step forward, swing / cast / throw, and the effect lands on the animation's event (see heroSeq)
    if (a.hero && ch.k !== 'run') { b.seq = { h: a, ch, st: 'adv', t: 0 }; b.msg = ch.k === 'atk' ? `${a.name} attacks!` : ch.k === 'spell' ? `${a.name} begins to cast ${ch.s}…` : `${a.name} throws a Potion!`; return; }
    this.resolve(a, ch);
  }
  resolve(a, ch) {
    const b = this.bt, foesA = this.alive(b.foes), herosA = this.alive(this.party);
    const enemies = a.hero ? foesA : herosA;
    if (ch.k === 'atk') {
      const t = ch.t && ch.t.hp > 0 ? ch.t : enemies[this.ri(0, enemies.length - 1)];
      const [n, crit] = this.phys(a, t);
      b.msg = `${a.name} attacks ${t.name}${crit ? ' — critical!' : '!'}`; this.hurt(t, n, crit ? '#ffd23a' : '#fff');
    } else if (ch.k === 'spell') {
      const sp = SPELLS[ch.s]; a.mp -= sp.mp; b.msg = `${a.name} casts ${ch.s}!`;
      if (a.hero) { const [x, y] = this.heroPos(a.k); this.burst(x + a.bo - 14, y - 6, sp.col, 10, 70); }
      if (sp.heal) {
        for (const t of sp.all ? herosA : [ch.t && ch.t.hp > 0 ? ch.t : this.lowest(herosA)]) { this.heal(t, Math.round(a.mag * sp.pow * 1.6 + 8)); const [x, y] = this.posOf(t); this.burst(x, y, sp.col, 10, 90); }
      } else {
        for (const t of sp.all ? foesA : [ch.t && ch.t.hp > 0 ? ch.t : foesA[0]]) { this.hurt(t, Math.max(1, Math.round(a.mag * sp.pow * 1.7 * this.r(0.9, 1.1) - t.def * 0.4)), sp.col); const [x, y] = this.posOf(t); this.burst(x, y, sp.col, 12, 130); }
      }
    } else if (ch.k === 'item') {
      this.potions--; const t = ch.t && ch.t.hp > 0 ? ch.t : this.lowest(herosA);
      b.msg = `${a.name} uses a Potion on ${t.name}.`; this.heal(t, Math.round(t.max * 0.45 + 20));
    } else if (ch.k === 'run') {
      if (b.boss) b.msg = 'There is no escape!';
      else if (this.rng() < 0.65) { b.msg = 'The party got away!'; b.phase = 'fled'; b.wait = 0.8; }
      else { b.msg = 'Couldn\'t escape!'; a.actor.emote('sad', 0.6); }
    } else if (ch.k === 'breath') {
      b.msg = `${a.name} unleashes Dark Flame!`;
      for (const t of herosA) { this.hurt(t, Math.max(1, Math.round(a.mag * 1.15 * this.r(0.85, 1.1) - this.defOf(t) * 0.3)), '#c070ff'); const [x, y] = this.posOf(t); this.burst(x, y, '#9a5aff', 8, 100); }
    } else if (ch.k === 'zap') {
      b.msg = `${a.name} spits a hex at ${ch.t.name}!`; this.hurt(ch.t, Math.max(1, Math.round(a.mag * 1.6 * this.r(0.85, 1.1) - this.defOf(ch.t) * 0.3)), '#c070ff');
    }
  }
  lowest(list) { return list.reduce((a, c) => (c.hp / c.max < a.hp / a.max ? c : a), list[0]); }
  aiPick(h) {
    const b = this.bt, al = this.alive(this.party), foes = this.alive(b.foes), low = this.lowest(al);
    const can = (s) => this.knows(h, s) && h.mp >= SPELLS[s].mp;
    if (h.job === 'Cleric') {
      if (al.filter((x) => x.hp < x.max * 0.55).length >= 2 && can('Cura')) return { k: 'spell', s: 'Cura' };
      if (low.hp < low.max * 0.5 && can('Cure')) return { k: 'spell', s: 'Cure', t: low };
    }
    if (low.hp < low.max * 0.3 && this.potions > 0 && (h.job !== 'Cleric' || !can('Cure'))) return { k: 'item', t: low };
    const weak = foes.reduce((a, c) => (c.hp < a.hp ? c : a), foes[0]), tough = foes.reduce((a, c) => (c.hp > a.hp ? c : a), foes[0]);
    if (h.job === 'Mage') {
      if (foes.length >= 2 && can('Fire')) return { k: 'spell', s: 'Fire' };
      if (can('Flare') && tough.hp > 70) return { k: 'spell', s: 'Flare', t: tough };
      if (can('Bolt') && (b.boss || tough.hp > this.atkOf(h) * 2)) return { k: 'spell', s: 'Bolt', t: tough };
    }
    if (h.job === 'Cleric' && b.boss && can('Bolt') && h.mp > 18) return { k: 'spell', s: 'Bolt', t: tough };
    return { k: 'atk', t: weak };
  }
  winBattle() {
    const b = this.bt, xp = b.foes.reduce((a, f) => a + f.xp, 0), gp = b.foes.reduce((a, f) => a + f.gp, 0);
    this.gold += gp; this.score += xp;
    b.msgs = [`Victory! ${xp} XP and ${gp} gold.`];
    for (const h of this.party) {
      if (h.hp <= 0) continue;
      h.xp += xp;
      while (h.xp >= need(h.lv)) {
        h.xp -= need(h.lv); h.lv++;
        const [gh, gm, ga, gd, gg, gs] = h.cl.g, j = () => this.r(0.8, 1.25);
        const dh = Math.round(gh * j()); h.max += dh; h.hp += dh; const dm = Math.round(gm * j()); h.mmp += dm; h.mp += dm;
        h.atk += ga * j(); h.def += gd * j(); h.mag += gg * j(); h.spd += gs * j();
        const sp = h.cl.spells.find(([, l]) => l === h.lv);
        b.msgs.push(`${h.name} reached Lv ${h.lv}!${sp ? ` Learned ${sp[0]}!` : ''}`);
        const [x, y] = this.heroPos(h.k); this.burst(x, y, this.col(1), 16, 120);
      }
    }
    b.phase = 'end'; b.wait = this.auto ? 1.1 : 1.6; b.msg = b.msgs.shift(); b.won = true;
    this.emoteParty('cheer', 6);
  }
  loseBattle() {
    const b = this.bt;
    b.phase = 'end'; b.won = false; b.wait = this.auto ? 1.4 : 2.2; b.msg = 'The party has fallen…';
    b.msgs = [`You wake at ${this.lastTown.name}. Half your gold is gone.`];
  }
  endBattle() {
    const b = this.bt;
    this.mode = b.from; this.bt = null;
    // back to the field: stop the victory cheer, get the fallen up
    for (const h of this.party) { h.bo = 0; h.actor.stopCast(); h.actor.revive(); h.actor.face('S'); }
    if (b.phase === 'fled') return;
    if (!b.won) {
      this.gold = Math.floor(this.gold / 2); for (const h of this.party) { h.hp = h.max; h.mp = h.mmp; }
      this.mode = 'world'; this.dg = null; this.place(this.lastTown.x, this.lastTown.y); this.grace = 8;
      this.emoteParty('sad', 1.4); this.think = 1.4; return;
    }
    for (const h of this.party) if (h.hp <= 0) h.hp = 1;
    if (b.boss) this.clearDungeon(this.dg.d);
  }
  stepBattle(dt) {
    const b = this.bt;
    if (b.anim && (b.anim.t -= dt) <= 0) b.anim = null;
    if (b.shake && (b.shake.t -= dt) <= 0) b.shake = null;
    for (const f of b.foes) if (f.hp <= 0) f.dead += dt;
    if (b.seq) return; // a hero is mid-action
    if (b.phase === 'cmd') { if (b.pick) { const p = b.pick; b.pick = null; this.act(b.actor, p); } return; }
    if ((b.wait -= dt) > 0) return;
    if (b.phase === 'end') { if (b.msgs.length) { b.msg = b.msgs.shift(); b.wait = this.auto ? 1 : 1.5; } else this.endBattle(); return; }
    if (b.phase === 'fled') { this.endBattle(); return; }
    if (!this.alive(b.foes).length) return this.winBattle();
    if (!this.alive(this.party).length) return this.loseBattle();
    this.nextTurn();
  }
  // ---------------------------------------------------------------- walking
  stepWalk(dt) {
    const ws = this.walkers, sp = (this.mode === 'world' ? 6 : 5) * dt;
    for (const w of ws) { const dx = w.x - w.fx, dy = w.y - w.fy; if (Math.abs(dx) + Math.abs(dy) > 0.001) { w.fx += Math.sign(dx) * Math.min(Math.abs(dx), sp); w.fy += Math.sign(dy) * Math.min(Math.abs(dy), sp); w.walk = (w.walk || 0) + dt; } }
    const L = ws[0];
    if (Math.abs(L.x - L.fx) + Math.abs(L.y - L.fy) > 0.001) return;
    if (this.arrive) { this.arrive = false; this.onTile(); return; }
    if (!this.route.length) return;
    const n = this.mode === 'dungeon' ? DN : N, [x, y] = this.route[0];
    if (!(this.mode === 'dungeon' ? this.dg.map[y * n + x] > 0 : this.passW(this.wm[y * n + x]))) { this.route = []; return; }
    this.route.shift();
    for (let k = 2; k > 0; k--) { if (ws[k - 1].x !== ws[k].x) ws[k].face = Math.sign(ws[k - 1].x - ws[k].x); ws[k].x = ws[k - 1].x; ws[k].y = ws[k - 1].y; }
    if (x !== L.x) L.face = Math.sign(x - L.x);
    L.x = x; L.y = y; this.arrive = true;
  }
  onTile() {
    const L = this.walkers[0];
    this.grace--;
    if (this.mode === 'world') {
      const t = this.wm[L.y * N + L.x];
      if (t === TOWN) { this.route = []; return this.visitTown(this.towns.find((tw) => tw.x === L.x && tw.y === L.y)); }
      if (t === CAVE) { const d = this.dungeons.find((q) => q.x === L.x && q.y === L.y); if (d && !d.done) { this.route = []; return this.enterDungeon(d); } return; }
      if (this.grace <= 0 && this.rng() < ENC[t]) this.encounter();
      return;
    }
    const g = this.dg, i = L.y * DN + L.x;
    this.reveal();
    const ch = g.chests.find((c) => !c.open && c.x === L.x && c.y === L.y);
    if (ch) return this.openChest(ch);
    if (g.boss && g.boss.x === L.x && g.boss.y === L.y) { this.route = []; return this.encounter(true); }
    if (g.map[i] === 2) { this.route = []; g.floor++; this.genFloor(); this.say = { who: g.d.name, s: `The party descends to B${g.floor + 1}F.`, t: this.auto ? 0.9 : 1.6 }; return; }
    if (this.grace <= 0 && this.rng() < 0.04) this.encounter();
  }
  moving() { const L = this.walkers[0]; return this.arrive || Math.abs(L.x - L.fx) + Math.abs(L.y - L.fy) > 0.001; }
  // ---------------------------------------------------------------- sprites
  animate(dt) {
    for (const h of this.party) {
      if (h.hp > 0 && h.actor.isKO) h.actor.revive();
      if (h.castT > 0 && (h.castT -= dt) <= 0) h.actor.stopCast();
    }
    if (this.mode === 'battle' && this.bt) return this.animBattle(dt);
    const sp = (this.mode === 'world' ? 6 : 5) * T;
    this.party.forEach((h, k) => {
      const w = this.walkers[k], dx = w.x - w.fx, dy = w.y - w.fy;
      let vx = 0, vy = 0;
      if (Math.abs(dx) + Math.abs(dy) > 0.001) { w.vx = vx = Math.abs(dx) > 0.001 ? Math.sign(dx) * sp : 0; w.vy = vy = Math.abs(dy) > 0.001 ? Math.sign(dy) * sp : 0; w.vt = 0.1; }
      else if ((w.vt = (w.vt || 0) - dt) > 0) { vx = w.vx; vy = w.vy; } // bridge the one-frame pause between tiles
      h.actor.update(dt, { vx, vy, lowHealth: h.hp > 0 && h.hp < h.max * 0.25 });
    });
  }
  animBattle(dt) {
    const b = this.bt, q = b.seq;
    for (const h of this.party) {
      let tgt = 0, spd = 220;
      if (b.phase === 'fled') tgt = 300;
      else if (q?.h === h) tgt = q.st === 'back' ? 0 : LUNGE;
      else if (b.actor === h && b.phase === 'cmd') { tgt = -14; spd = 90; }
      if (h.hp <= 0 || h.actor.locked) tgt = h.bo;
      const d = tgt - h.bo, m = Math.sign(d) * Math.min(Math.abs(d), spd * dt);
      h.bo += m;
      const ev = h.actor.update(dt, { vx: dt > 0 ? m / dt : 0, vy: 0, lowHealth: h.hp > 0 && h.hp < h.max * 0.25 });
      if (!m && b.phase !== 'fled' && h.hp > 0 && !h.actor.locked && h.actor.dir !== 'W') h.actor.face('W');
      if (q?.h === h) this.heroSeq(q, ev, dt);
    }
  }
  // a hero's turn: run up, attack / cast / throw, effect on hit / cast / fire, run back
  heroSeq(q, ev, dt) {
    const h = q.h, k = q.ch.k, A = h.actor;
    q.t += dt;
    if (q.st === 'adv') {
      if (Math.abs(h.bo - LUNGE) < 0.5 || q.t > 1.5) { q.st = 'act'; q.t = 0; if (k === 'atk') A.attack(); else if (k === 'spell') A.cast(); else A.shoot(); }
    } else if (q.st === 'act') {
      if (!q.done && (ev.some((e) => e === 'hit' || e === 'cast' || e === 'fire') || q.t > 1.2)) { q.done = true; q.dt = 0; this.resolve(h, q.ch); }
      if (q.done) {
        q.dt += dt;
        if (k === 'spell' && q.dt > 0.45) A.stopCast();
        if ((q.dt > 0.2 && !A.a.action) || q.t > 2.5) { A.stopCast(); q.st = 'back'; }
      }
    } else if (Math.abs(h.bo) < 0.5) { this.bt.seq = null; this.bt.wait = this.auto ? 0.3 : 0.45; A.face('W'); }
  }
  step(dt) {
    this.animate(dt);
    for (const p of this.pops) { p.y -= 28 * dt; p.life -= dt; }
    this.pops = this.pops.filter((p) => p.life > 0);
    if (this.label && (this.label.t -= dt) <= 0) this.label = null;
    if (this.say) { if ((this.say.t -= dt) <= 0) this.endSay(); return; }
    if (this.mode === 'battle') this.stepBattle(dt); else this.stepWalk(dt);
  }
  endSay() { const f = this.say?.then; this.say = null; f?.(); }
  // ---------------------------------------------------------------- autopilot
  autopilot(dt) {
    if (this.say) return;
    if (this.mode === 'battle') { const b = this.bt; if (b.phase === 'cmd' && !b.pick && (b.aiT = (b.aiT || 0) + dt) > 0.25) { b.aiT = 0; b.pick = this.aiPick(b.actor); } return; }
    if (this.moving() || this.route.length) return;
    if ((this.think -= dt) > 0) return;
    this.think = 0.12;
    if (this.fieldHeal()) return;
    const L = this.walkers[0];
    if (this.mode === 'dungeon') {
      const g = this.dg, at = (o) => (i) => o.some((q) => q.x === i % DN && q.y === ((i / DN) | 0));
      const chests = g.chests.filter((c) => !c.open && g.seen[c.y * DN + c.x]);
      const goal = g.boss && g.seen[g.boss.y * DN + g.boss.x] ? at([g.boss]) : (i) => g.map[i] === 2 && g.seen[i];
      const frontier = (i) => g.map[i] && DIRS.some(([dx, dy]) => { const x = (i % DN) + dx, y = ((i / DN) | 0) + dy; return x >= 0 && y >= 0 && x < DN && y < DN && !g.seen[y * DN + x]; });
      const pd = (i) => this.passD(i);
      this.route = (chests.length && this.findRoute(DN, pd, L.x, L.y, at(chests))) || this.findRoute(DN, pd, L.x, L.y, goal) || this.findRoute(DN, pd, L.x, L.y, frontier)
        || this.findRoute(DN, (i) => g.map[i] > 0, L.x, L.y, g.boss ? at([g.boss]) : (i) => g.map[i] === 2) || [];
      return;
    }
    const al = this.party, ratio = al.reduce((a, h) => a + h.hp, 0) / al.reduce((a, h) => a + h.max, 0);
    const mpLow = al[1].mp < 6 && al[2].mp < 5;
    const town = (i) => this.wm[i] === TOWN;
    if (ratio < 0.5 || (mpLow && ratio < 0.8) || (this.potions < 2 && this.gold >= 30)) {
      if (town(L.y * N + L.x)) { this.visitTown(this.towns.find((tw) => tw.x === L.x && tw.y === L.y)); return; }
      this.route = this.wRoute(town) || []; return;
    }
    const d = this.dungeons.find((q) => !q.done);
    if (!d) return;
    const lv = al.reduce((a, h) => a + h.lv, 0) / 3;
    if (lv < d.lv + d.floors - 3.5) {
      // grind in the wilds nearby, preferring forest
      let bt = null, bv = -1;
      for (let n = 0; n < 30; n++) { const x = L.x + this.ri(-6, 6), y = L.y + this.ri(-6, 6); if (x < 0 || y < 0 || x >= N || y >= N) continue; const t = this.wm[y * N + x]; if (!this.passW(t) || t === TOWN || t === CAVE) continue; const v = ENC[t] + this.r(0, 0.02); if (v > bv) { bv = v; bt = y * N + x; } }
      if (bt != null) this.route = this.wRoute((i) => i === bt) || [];
      return;
    }
    this.route = this.wRoute((i) => i === d.y * N + d.x) || [];
  }
  // world paths go round dungeon entrances that aren't the goal
  wRoute(goal) { const L = this.walkers[0]; return this.findRoute(N, (i) => this.wm[i] !== CAVE && this.passW(this.wm[i]), L.x, L.y, goal) || this.findRoute(N, (i) => this.passW(this.wm[i]), L.x, L.y, goal); }
  fieldHeal() {
    const al = this.alive(this.party), low = this.lowest(al), cl = this.party[2];
    if (low.hp >= low.max * 0.6) return false;
    const [x, y] = [W / 2, H / 2];
    if (cl.hp > 0 && cl.mp >= SPELLS.Cure.mp) { cl.mp -= SPELLS.Cure.mp; cl.actor.cast(); cl.castT = 0.6; this.think = 0.5; const n = Math.round(cl.mag * SPELLS.Cure.pow * 1.6 + 8); low.hp = Math.min(low.max, low.hp + n); this.pops.push({ x, y: y - 30, s: `${low.name} +${n}`, col: '#7dffa8', life: 1 }); this.burst(x, y, '#7dffa8', 10, 80); return true; }
    if (low.hp < low.max * 0.3 && this.potions > 0) { this.potions--; low.actor.emote('love', 0.6); this.think = 0.5; const n = Math.round(low.max * 0.45 + 20); low.hp = Math.min(low.max, low.hp + n); this.pops.push({ x, y: y - 30, s: `Potion +${n}`, col: '#7dffa8', life: 1 }); return true; }
    return false;
  }
  // ---------------------------------------------------------------- input
  btnRects() { return [0, 1, 2, 3].map((k) => [8 + (k % 2) * 86, 308 + Math.floor(k / 2) * 56, 82, 50]); }
  menuItems() {
    const b = this.bt, h = b.actor;
    if (b.menu === 'magic') {
      const sp = h.cl.spells.filter(([n, l]) => h.lv >= l).slice(0, 3).map(([n]) => ({ s: `${n} ${SPELLS[n].mp}`, on: h.mp >= SPELLS[n].mp, f: () => (SPELLS[n].heal || SPELLS[n].all ? (b.pick = { k: 'spell', s: n, t: SPELLS[n].heal ? this.lowest(this.alive(this.party)) : null }) : ((b.menu = 'target'), (b.spell = n))) }));
      while (sp.length < 3) sp.push({ s: '', on: false });
      return [...sp, { s: 'Back', on: true, f: () => (b.menu = 'main') }];
    }
    if (b.menu === 'target') return [{ s: '', on: false }, { s: '', on: false }, { s: '', on: false }, { s: 'Back', on: true, f: () => (b.menu = 'main') }];
    return [
      { s: 'Attack', on: true, f: () => { b.menu = 'target'; b.spell = null; } },
      { s: 'Magic', on: h.cl.spells.length > 0, f: () => (b.menu = 'magic') },
      { s: `Potion ×${this.potions}`, on: this.potions > 0, f: () => (b.pick = { k: 'item', t: this.lowest(this.alive(this.party)) }) },
      { s: 'Run', on: true, f: () => (b.pick = { k: 'run' }) }
    ];
  }
  down(x, y) {
    if (this.say) { if (this.say.t < 2.6 || this.say.chest) { this.say.t = 0; this.endSay(); } return; }
    if (this.mode === 'battle') {
      const b = this.bt;
      if (b.phase !== 'cmd' || b.pick) return;
      if (y > 300) {
        const items = this.menuItems();
        this.btnRects().forEach(([bx, by, bw, bh], k) => { if (x >= bx && x <= bx + bw && y >= by && y <= by + bh && items[k].on) items[k].f(); });
        return;
      }
      if (b.menu === 'target' || b.menu === 'main') {
        let best = null, bd = 50;
        for (const f of this.alive(b.foes)) { const [fx, fy] = this.foePos(f), d = Math.hypot(fx - x, fy - y); if (d < bd) { bd = d; best = f; } }
        if (best) b.pick = b.spell && b.menu === 'target' ? { k: 'spell', s: b.spell, t: best } : { k: 'atk', t: best };
      }
      return;
    }
    if (y > H - 24) return;
    const n = this.mode === 'dungeon' ? DN : N, tx = Math.floor((x + this.camX) / T), ty = Math.floor((y + this.camY) / T);
    if (tx < 0 || ty < 0 || tx >= n || ty >= n) return;
    const L = this.walkers[0], goal = (i) => i === ty * n + tx, r = this.mode === 'world' ? this.wRoute(goal) : this.findRoute(n, (i) => this.passD(i), L.x, L.y, goal);
    if (r) this.route = r;
  }
  tap(x, y) { this.down(x, y); }
  // ---------------------------------------------------------------- drawing
  texK(k) { const s = this.skin.slots.tile; return this.skin.texFor?.(k) || s[k % Math.max(1, s.length)] || null; }
  pat(c, i) {
    if (!ready(i)) return null;
    let p = this.patMemo.get(i);
    if (!p) { p = c.createPattern(i, 'repeat'); this.patMemo.set(i, p); }
    return p;
  }
  tileCol(t) {
    const hs = ((this.skin.hue || 0) % 40) - 20;
    return [`hsl(${95 + hs},30%,30%)`, `hsl(${125 + hs},32%,19%)`, `hsl(${70 + hs},26%,36%)`, 'hsl(28,12%,38%)', 'hsl(205,42%,24%)', 'hsl(34,30%,40%)', `hsl(${95 + hs},30%,30%)`, `hsl(${70 + hs},26%,36%)`, 'hsl(42,36%,52%)'][t];
  }
  hash(x, y) { let h = (x * 374761393 + y * 668265263 + this.world * 1013) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  person(c, w, k, x, y) {
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + 12, 7, 2.5, 0, 0, 7); c.fill();
    this.party[k].actor.draw(c, x, y + 12, 1);
  }
  draw(c) {
    if (this.mode === 'battle') this.drawBattle(c); else this.drawMap(c);
    for (const p of this.pops) { c.globalAlpha = Math.min(1, p.life * 2); c.lineWidth = 3; c.strokeStyle = '#000'; c.font = '800 14px ui-monospace, monospace'; c.textAlign = 'center'; c.strokeText(p.s, p.x, p.y); this.text(c, p.s, p.x, p.y, 14, p.col); }
    c.globalAlpha = 1;
    if (this.say) {
      c.fillStyle = 'rgba(10,7,5,.9)'; roundRect(c, 10, H - 128, W - 20, 92, 8); c.fill(); c.strokeStyle = this.col(0); c.lineWidth = 1.5; c.stroke();
      this.text(c, this.say.who, 22, H - 114, 11, this.col(0), 'left');
      this.wrap(c, this.say.s, 22, H - 94, W - 44, 15);
    }
  }
  drawMap(c) {
    const dun = this.mode === 'dungeon', n = dun ? DN : N, L = this.walkers[0];
    this.camX = Math.max(0, Math.min(n * T - W, L.fx * T + T / 2 - W / 2)); this.camY = Math.max(-40, Math.min(n * T - H + 24, L.fy * T + T / 2 - H / 2 + 10));
    c.fillStyle = dun ? '#07060a' : 'hsl(205,42%,20%)'; c.fillRect(0, 0, W, H);
    c.save(); c.translate(-Math.round(this.camX), -Math.round(this.camY));
    const x0 = Math.max(0, Math.floor(this.camX / T)), y0 = Math.max(0, Math.floor(this.camY / T)), x1 = Math.min(n, x0 + Math.ceil(W / T) + 1), y1 = Math.min(n, y0 + Math.ceil(H / T) + 2);
    if (dun) this.drawDungeonTiles(c, x0, y0, x1, y1); else this.drawWorldTiles(c, x0, y0, x1, y1);
    if (this.route.length) { const [px, py] = this.route[this.route.length - 1]; c.strokeStyle = this.pal.ink; c.globalAlpha = 0.5 + Math.sin(this.t * 6) * 0.2; c.lineWidth = 1.5; c.strokeRect(px * T + 2, py * T + 2, T - 4, T - 4); c.globalAlpha = 1; }
    for (let k = 2; k >= 0; k--) { const w = this.walkers[k]; this.person(c, w, k, w.fx * T + T / 2, w.fy * T + T / 2 - 6); }
    c.restore();
    if (dun) { const lx = L.fx * T + T / 2 - this.camX, ly = L.fy * T + T / 2 - this.camY, g = c.createRadialGradient(lx, ly, 30, lx, ly, 190); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(3,2,6,.8)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    else this.drawMini(c);
    // party strip
    c.fillStyle = 'rgba(8,6,4,.82)'; c.fillRect(0, H - 24, W, 24);
    this.party.forEach((h, k) => {
      const x = 6 + k * 92; this.text(c, `${h.job[0]}${h.lv}`, x, H - 12, 10, h.hp > 0 ? this.pal.ink : '#888', 'left');
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 24, H - 17, 58, 5); c.fillStyle = h.hp < h.max * 0.3 ? '#e04a3a' : '#5fd068'; c.fillRect(x + 24, H - 17, 58 * h.hp / h.max, 5);
      if (h.mmp) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 24, H - 9, 58, 3); c.fillStyle = '#5fa8ff'; c.fillRect(x + 24, H - 9, 58 * h.mp / h.mmp, 3); }
    });
    this.text(c, `${this.gold}g ◆${this.potions}`, W - 6, H - 12, 10, this.col(1), 'right');
    if (this.label) { c.globalAlpha = Math.min(1, this.label.t * 2); const lw = dun ? W : W - 76; c.fillStyle = 'rgba(8,6,4,.7)'; c.fillRect(0, 60, lw, 22); this.text(c, this.label.s, lw / 2, 71, 10, this.pal.ink); c.globalAlpha = 1; }
  }
  drawWorldTiles(c, x0, y0, x1, y1) {
    const m = this.wm, tex = { [GRASS]: this.texK(1), [FOREST]: this.texK(4), [HILL]: this.texK(5), [MOUNT]: this.texK(2), [SAND]: this.texK(6), [ROAD]: this.texK(3), [TOWN]: this.texK(1), [CAVE]: this.texK(5) };
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const t = m[y * N + x]; c.fillStyle = this.tileCol(t); c.fillRect(x * T, y * T, T, T); }
    // photo textures laid over each terrain
    c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.45;
    for (const k of [GRASS, FOREST, HILL, MOUNT, SAND, ROAD]) {
      const p = this.pat(c, tex[k]); if (!p) continue;
      c.beginPath(); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const t = m[y * N + x]; if (t === k || (k === GRASS && t === TOWN) || (k === HILL && t === CAVE)) c.rect(x * T, y * T, T, T); }
      c.fillStyle = p; c.fill();
    }
    c.restore();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const t = m[y * N + x], X = x * T, Y = y * T, h = this.hash(x, y);
      if (t === WATER) {
        const l = Math.sin(this.t * 2 + x * 0.9 + y * 1.3); c.fillStyle = `rgba(160,210,255,${0.08 + l * 0.05})`; c.fillRect(X + 3 + h * 6, Y + 6 + l * 2, 8, 1.5);
        for (const [dx, dy] of DIRS) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && m[yy * N + xx] !== WATER) { c.fillStyle = 'rgba(220,240,255,.25)'; c.fillRect(X + (dx > 0 ? T - 2 : 0), Y + (dy > 0 ? T - 2 : 0), dx ? 2 : T, dy ? 2 : T); } }
      } else if (t === FOREST) {
        for (let k = 0; k < 2; k++) { const tx = X + 5 + k * 9 + h * 3, ty = Y + 6 + ((h * 7 + k) % 1) * 6; c.fillStyle = '#2a1a10'; c.fillRect(tx - 1, ty + 4, 2, 5); c.fillStyle = `hsl(${120 + (h * 30 | 0)},35%,${14 + k * 4}%)`; c.beginPath(); c.moveTo(tx, ty - 6); c.lineTo(tx + 6, ty + 5); c.lineTo(tx - 6, ty + 5); c.fill(); }
      } else if (t === HILL || t === CAVE) {
        c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.5; c.beginPath(); c.arc(X + 7 + h * 4, Y + 15, 6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
        if (t === CAVE) {
          const d = this.dungeons.find((q) => q.x === x && q.y === y);
          c.fillStyle = 'hsl(28,14%,30%)'; c.beginPath(); c.moveTo(X - 2, Y + T); c.lineTo(X + T / 2, Y - 6); c.lineTo(X + T + 2, Y + T); c.fill();
          c.fillStyle = '#0a0606'; c.beginPath(); c.arc(X + T / 2, Y + T - 2, 5, Math.PI, 0); c.fill(); c.fillRect(X + T / 2 - 5, Y + T - 2, 10, 2);
          if (d?.done) { c.fillStyle = '#ddd'; c.fillRect(X + T / 2, Y - 14, 1.5, 10); c.fillStyle = this.col(2); c.fillRect(X + T / 2 + 1.5, Y - 14, 7, 5); }
          else { c.globalAlpha = 0.5 + Math.sin(this.t * 4) * 0.3; this.text(c, '!', X + T / 2, Y - 10, 11, this.col(0)); c.globalAlpha = 1; }
        }
      } else if (t === MOUNT) {
        c.fillStyle = 'hsl(28,12%,28%)'; c.beginPath(); c.moveTo(X - 3, Y + T); c.lineTo(X + T / 2 + (h - 0.5) * 4, Y - 5); c.lineTo(X + T + 3, Y + T); c.fill();
        c.fillStyle = 'rgba(240,235,225,.75)'; c.beginPath(); c.moveTo(X + T / 2 + (h - 0.5) * 4, Y - 5); c.lineTo(X + T / 2 + 4, Y + 3); c.lineTo(X + T / 2 - 4, Y + 3); c.fill();
      } else if (t === ROAD) {
        c.fillStyle = 'rgba(255,230,180,.12)'; c.fillRect(X + 6, Y + 6, 8, 8);
      } else if (t === TOWN) {
        for (let k = 0; k < 3; k++) { const hx = X + [2, 11, 6][k], hy = Y + [6, 4, 12][k]; c.fillStyle = '#d8c3a5'; c.fillRect(hx, hy + 3, 7, 5); c.fillStyle = this.col(k === 1 ? 3 : 0); c.beginPath(); c.moveTo(hx - 1, hy + 3); c.lineTo(hx + 3.5, hy - 1); c.lineTo(hx + 8, hy + 3); c.fill(); }
      } else if (t === SAND && h < 0.4) { c.fillStyle = 'rgba(80,60,30,.3)'; c.fillRect(X + h * 40, Y + 10, 2, 2); }
    }
  }
  drawDungeonTiles(c, x0, y0, x1, y1) {
    const g = this.dg, m = g.map, fp = this.pat(c, g.floorTex), wp = this.pat(c, g.wallTex);
    const isF = (x, y) => x >= 0 && y >= 0 && x < DN && y < DN && m[y * DN + x] > 0;
    c.beginPath();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (g.seen[y * DN + x] && m[y * DN + x]) c.rect(x * T, y * T, T, T);
    c.fillStyle = `hsl(${(this.skin.hue + g.d.k * 40) % 360},16%,32%)`; c.fill();
    if (fp) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.7; c.fillStyle = fp; c.fill(); c.restore(); }
    c.beginPath();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (g.seen[y * DN + x] && !m[y * DN + x] && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => isF(x + dx, y + dy)))) c.rect(x * T, y * T, T, T);
    c.fillStyle = `hsl(${(this.skin.hue + g.d.k * 40) % 360},12%,10%)`; c.fill();
    if (wp) { c.save(); c.globalAlpha = 0.25; c.fillStyle = wp; c.fill(); c.restore(); }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!g.seen[y * DN + x]) continue;
      const t = m[y * DN + x];
      if (!t && isF(x, y + 1)) { c.fillStyle = `hsl(${(this.skin.hue + g.d.k * 40 + 20) % 360},14%,22%)`; c.fillRect(x * T, y * T + 8, T, T - 8); if (wp) { c.save(); c.globalAlpha = 0.45; c.fillStyle = wp; c.fillRect(x * T, y * T + 8, T, T - 8); c.restore(); } c.fillStyle = this.col(5); c.globalAlpha = 0.5; c.fillRect(x * T, y * T + 8, T, 1.5); c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x * T, y * T + T, T, 4); }
      if (t === 2) { for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#1a1410' : '#6a5a48'; c.fillRect(x * T + 2 + k, y * T + 3 + k * 4, T - 4 - k * 2, 4); } }
    }
    for (const ch of g.chests) {
      if (!g.seen[ch.y * DN + ch.x]) continue;
      const X = ch.x * T + T / 2, Y = ch.y * T + T / 2, ic = this.skin.pick('chest', 'item');
      c.fillStyle = ch.open ? '#3a2a1a' : '#8a5a2a'; c.fillRect(X - 7, Y - 4, 14, 10); c.fillStyle = ch.open ? '#20160e' : '#c9952b'; c.fillRect(X - 7, Y - 6, 14, 3); c.fillRect(X - 1, Y - 2, 2, 3);
      if (!ch.open && ic) { c.globalAlpha = 0.85; drawFit(c, ic, X, Y - 12 + Math.sin(this.t * 3) * 1.5, 12, 12); c.globalAlpha = 1; }
    }
    if (g.boss && g.seen[g.boss.y * DN + g.boss.x]) {
      const art = this.foeArt((this.post.seed || 1) * 131 + g.d.k * 17 + 999, g.d.lv + g.floor + 1, true);
      drawFit(c, art.frames[Math.floor(this.t * 2) % 2], g.boss.x * T + T / 2, g.boss.y * T + T / 2 - 6 + Math.sin(this.t * 2) * 2, 34, 34);
    }
  }
  drawMini(c) {
    if (!this.mini) {
      this.mini = Object.assign(document.createElement('canvas'), { width: N, height: N });
      const x = this.mini.getContext('2d');
      for (let i = 0; i < N * N; i++) { x.fillStyle = this.tileCol(this.wm[i]); x.fillRect(i % N, (i / N) | 0, 1, 1); }
    }
    const X = W - 70, Y = 60;
    c.globalAlpha = 0.85; c.fillStyle = '#000'; c.fillRect(X - 2, Y - 2, N + 4, N + 4); c.drawImage(this.mini, X, Y); c.globalAlpha = 1;
    for (const tw of this.towns) { c.fillStyle = this.pal.ink; c.fillRect(X + tw.x - 1, Y + tw.y - 1, 3, 3); }
    for (const d of this.dungeons) { c.fillStyle = d.done ? '#888' : this.col(0); c.fillRect(X + d.x - 1.5, Y + d.y - 1.5, 3, 3); }
    if (Math.floor(this.t * 3) % 2) { c.fillStyle = '#fff'; c.fillRect(X + this.walkers[0].x - 1, Y + this.walkers[0].y - 1, 2, 2); }
  }
  drawBattle(c) {
    const b = this.bt, dun = b.from === 'dungeon';
    const g = c.createLinearGradient(0, 56, 0, 300);
    g.addColorStop(0, dun ? '#0b090e' : this.pal.bg2); g.addColorStop(1, dun ? '#1a1418' : this.pal.bg);
    c.fillStyle = g; c.fillRect(0, 0, W, 300);
    const L = this.walkers[0], tt = dun ? null : this.wm[L.y * N + L.x];
    c.fillStyle = dun ? `hsl(${(this.skin.hue + this.dg.d.k * 40) % 360},14%,18%)` : this.tileCol(tt === FOREST ? FOREST : tt === HILL || tt === SAND ? tt : GRASS);
    c.beginPath(); c.moveTo(0, 150); c.lineTo(W, 150); c.lineTo(W, 300); c.lineTo(0, 300); c.fill();
    const p = this.pat(c, dun ? this.dg.floorTex : this.texK(tt === FOREST ? 4 : 1));
    if (p) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.6; c.fillStyle = p; c.fillRect(0, 150, W, 150); c.restore(); }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 150, W, 3);
    if (!dun && tt === FOREST) for (let k = 0; k < 9; k++) { const x = k * 42 + 10; c.fillStyle = `hsl(${125 + k * 3},30%,${10 + (k % 3) * 3}%)`; c.beginPath(); c.moveTo(x, 70 + (k % 2) * 12); c.lineTo(x + 24, 152); c.lineTo(x - 24, 152); c.fill(); }
    if (!dun && tt !== FOREST) { c.fillStyle = 'hsl(28,12%,22%)'; c.beginPath(); c.moveTo(0, 152); for (let k = 0; k <= 8; k++) c.lineTo(k * 45, 152 - 20 - ((k * 37) % 30)); c.lineTo(W, 152); c.fill(); }
    // foes
    for (const f of b.foes) {
      if (f.hp <= 0 && f.dead > 0.6) continue;
      const [x, y] = this.foePos(f), sz = f.boss ? 120 : 58;
      let dx = 0; if (b.anim?.u === f) dx = Math.sin((0.5 - b.anim.t) / 0.5 * Math.PI) * 18;
      if (b.shake?.u === f) dx += Math.sin(this.t * 80) * 3;
      c.globalAlpha = f.hp <= 0 ? Math.max(0, 1 - f.dead / 0.6) : 1;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + sz * 0.42, sz * 0.32, sz * 0.08, 0, 0, 7); c.fill();
      drawFit(c, f.art.frames[Math.floor(this.t * 2.5 + x) % 2], x + dx, y, sz, sz);
      c.globalAlpha = 1;
      if (f.hp > 0) {
        c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x - 22, y - sz * 0.5 - 8, 44, 4); c.fillStyle = '#e04a3a'; c.fillRect(x - 22, y - sz * 0.5 - 8, 44 * f.hp / f.max, 4);
        if (b.phase === 'cmd' && !this.auto && (b.menu === 'target' || b.menu === 'main')) { c.globalAlpha = 0.5 + Math.sin(this.t * 6) * 0.3; this.text(c, '▼', x, y - sz * 0.5 - 18, 11, this.col(1)); c.globalAlpha = 1; }
      }
    }
    // heroes
    for (const h of this.party) {
      const [x, y] = this.heroPos(h.k), dx = h.bo;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + dx, y + 22, 13, 3.5, 0, 0, 7); c.fill();
      h.actor.draw(c, x + dx, y + 22, BSC, { alpha: h.hp <= 0 ? 0.8 : 1 });
    }
    // message
    c.fillStyle = 'rgba(8,6,4,.78)'; c.fillRect(0, 58, W, 24);
    this.text(c, b.phase === 'cmd' && b.menu === 'target' && !this.auto ? 'Tap a monster to target it' : b.msg, W / 2, 70, 11, this.pal.ink);
    if (b.phase === 'intro') { c.fillStyle = `rgba(0,0,0,${Math.max(0, b.wait - 0.3)})`; c.fillRect(0, 82, W, 218); }
    // command panel
    c.fillStyle = 'rgba(10,7,5,.92)'; c.fillRect(0, 300, W, H - 300); c.fillStyle = this.col(0); c.fillRect(0, 300, W, 2);
    const cmd = b.phase === 'cmd' && b.actor && !this.auto;
    const items = cmd ? this.menuItems() : ['Attack', 'Magic', `Potion ×${this.potions}`, 'Run'].map((s) => ({ s, on: false }));
    this.btnRects().forEach(([x, y, w, h], k) => {
      const it = items[k], on = it?.on, hl = !cmd && b.hl === k && b.phase === 'act';
      c.fillStyle = hl ? this.col(k) : it?.s ? (on ? this.pal.bg2 : 'rgba(255,255,255,.05)') : 'rgba(255,255,255,.03)'; roundRect(c, x, y, w, h, 7); c.fill();
      c.strokeStyle = on || hl ? this.col(k) : 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; c.stroke();
      if (it?.s) this.text(c, it.s, x + w / 2, y + h / 2, 12, hl ? this.pal.bg : on ? this.pal.ink : 'rgba(255,255,255,.35)');
    });
    this.party.forEach((h, k) => {
      const x = 186, y = 308 + k * 37, act = b.actor === h && (b.phase === 'cmd' || b.phase === 'act');
      if (act) { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x - 4, y - 2, W - x, 35); }
      this.text(c, `${h.name}`, x, y + 6, 10, h.hp > 0 ? (act ? this.col(1) : this.pal.ink) : '#777', 'left');
      this.text(c, `Lv${h.lv} ${h.job}`, W - 8, y + 6, 9, 'rgba(255,255,255,.5)', 'right');
      c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x, y + 14, 110, 6); c.fillStyle = h.hp < h.max * 0.3 ? '#e04a3a' : '#5fd068'; c.fillRect(x, y + 14, 110 * h.hp / h.max, 6);
      this.text(c, `${Math.ceil(h.hp)}`, W - 8, y + 17, 9, this.pal.ink, 'right');
      if (h.mmp) { c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x, y + 24, 110, 4); c.fillStyle = '#5fa8ff'; c.fillRect(x, y + 24, 110 * h.mp / h.mmp, 4); this.text(c, `${h.mp}`, W - 8, y + 26, 8, '#9cc8ff', 'right'); }
    });
  }
  wrap(c, s, x, y, w, lh) {
    c.font = '600 11px ui-monospace, monospace'; c.fillStyle = this.pal.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
    let line = '', yy = y;
    for (const word of s.split(' ')) { const t = line ? `${line} ${word}` : word; if (c.measureText(t).width > w) { c.fillText(line, x, yy); yy += lh; line = word; } else line = t; }
    c.fillText(line, x, yy);
  }
  hud() { return `${Math.floor(this.score)} · Lv ${Math.floor(this.party.reduce((a, h) => a + h.lv, 0) / 3)} · ${this.cleared}✦`; }
}
