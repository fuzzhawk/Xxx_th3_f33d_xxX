// Diablo-style dungeon hack: an isometric, torch-lit crawl through procedural crypts
// and caves. Tap a monster to swing at it, hurl fireballs, quaff potions, grab loot in
// rarity colours and take the stairs ever deeper. Champions and bosses guard the way.
import { Game, W, H, drawFit, ready, roundRect } from './engine.js';
import { monster, creatureName, item as itemArt } from './creature.js';

const G = 46, TW = 16, TH = 8, WH = 18, CY = 212, LIGHT = 7, HS = 3.3, COST = 12, PY = 362;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const RAR = ['#e6dfd2', '#7d8cff', '#ffe04a', '#d9a952'];
const SLOTS = ['weapon', 'armor', 'helm', 'shield', 'ring'];
const BASES = {
  weapon: ['Rusty Falchion', 'Short Sword', 'Hand Axe', 'Club', 'Scimitar', 'Morning Star', 'Broad Sword', 'War Axe', 'Bastard Sword', 'Great Axe', 'Executioner Sword'],
  armor: ['Rags', 'Quilted Armor', 'Leather Armor', 'Studded Leather', 'Ring Mail', 'Chain Mail', 'Splint Mail', 'Plate Mail', 'Gothic Plate', 'Full Plate'],
  helm: ['Cap', 'Skull Cap', 'Helm', 'Bone Helm', 'Full Helm', 'Great Helm', 'Crown'],
  shield: ['Buckler', 'Small Shield', 'Kite Shield', 'Bone Shield', 'Tower Shield', 'Gothic Shield'],
  ring: ['Ring']
};
const PRE = [['Jagged', 'pct', 0.15], ['Deadly', 'pct', 0.3], ['Savage', 'pct', 0.5], ['Merciless', 'pct', 0.8], ['Sturdy', 'apct', 0.2], ['Strong', 'apct', 0.4], ['Glorious', 'apct', 0.7], ['Lapis', 'mana', 8], ['Cobalt', 'mana', 15], ['Sapphire', 'mana', 25]];
const SUF = [['of the Leech', 'leech', 0.04], ['of Blood', 'leech', 0.08], ['of Vigor', 'hp', 8], ['of Life', 'hp', 16], ['of the Whale', 'hp', 28], ['of Haste', 'spd', 0.1], ['of Speed', 'spd', 0.18], ['of Might', 'flat', 2], ['of the Titan', 'flat', 4], ['of Stone', 'ar', 5]];
const GRIM = ['Grim', 'Doom', 'Blood', 'Bone', 'Corpse', 'Storm', 'Wraith', 'Dread', 'Rune', 'Viper', 'Shadow', 'Gale', 'Pain', 'Hate', 'Gloom', 'Carrion', 'Ghoul', 'Plague'];
const NOUN = { weapon: ['Bite', 'Edge', 'Fang', 'Thirst', 'Song', 'Cleaver', 'Reaver', 'Scythe'], armor: ['Shroud', 'Coat', 'Carapace', 'Hide', 'Mantle', 'Shell'], helm: ['Visage', 'Crest', 'Brow', 'Cowl', 'Hood', 'Mask'], shield: ['Ward', 'Wall', 'Bulwark', 'Aegis', 'Guard'], ring: ['Loop', 'Coil', 'Band', 'Eye', 'Knot', 'Spiral'] };
const UNIQ = { weapon: ['The Gravedigger', 'Kingsbane', 'Widowmaker', 'Bonesaw of Ruin', 'The Undertaker'], armor: ['Corpsehide', 'Shroud of the Penitent', 'The Iron Maiden', 'Carrion Wind'], helm: ['Crown of Ash', 'The Undead Visage', 'Gravelord Helm', 'Skull of the Martyr'], shield: ['Stormwall', 'The Bone Door', 'Lid of the Sarcophagus'], ring: ['Band of the Ninth Circle', 'Eye of the Worm', 'The Weeping Loop'] };
const CH = [['Bone', 'Gore', 'Rot', 'Blood', 'Grave', 'Gut', 'Skull', 'Ash', 'Bile', 'Maggot', 'Vile', 'Corpse', 'Pox'], ['gnaw', 'maw', 'rend', 'hide', 'tooth', 'fist', 'belly', 'claw', 'spine', 'fang', 'flay', 'drool'], ['the Unclean', 'the Defiler', 'the Hungry', 'the Rotten', 'the Flayer', 'the Cursed', 'the Mad', 'the Vile', 'the Butcher', 'the Wretched', 'the Foul']];
const CMOD = ['Extra Fast', 'Stone Skin', 'Extra Strong', 'Vampiric'];
const ZONES = ['Cathedral', 'Catacombs', 'Crypt', 'Ossuary', 'Hell'];

export class Hack extends Game {
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'trails'];
  setup() {
    this.lvl = 1; this.xp = 0; this.need = this.needFor(1); this.gold = 0; this.kills = 0; this.deaths = 0;
    this.ox = this.oy = 0; this.gear = {}; this.pots = { hp: 2, mp: 1 }; this.log = []; this.pops = []; this.pats = new Map();
    this.h = { x: 0, y: 0, hp: 1, mp: 1, path: [], tgt: null, cd: 0, anim: 0, face: 1, heal: 0, rp: 0, sw: 0 };
    this.st = this.calc();
    this.newLevel(1);
    this.h.hp = this.st.maxHp; this.h.mp = this.st.maxMp;
  }
  needFor(l) { return Math.round(18 * Math.pow(l, 1.55) + 8 * l); }
  pick(a) { return a[this.ri(0, a.length - 1)]; }
  tileOf(o) { return Math.floor(o.y) * G + Math.floor(o.x); }
  bfs(s, goal) {
    const prev = this.prev ||= new Int32Array(G * G), m = this.map; prev.fill(-2); prev[s] = -1;
    const q = [s];
    for (let k = 0; k < q.length; k++) {
      const a = q[k];
      if (goal(a)) { const p = []; for (let i = a; i !== s; i = prev[i]) p.push(i); return p.reverse(); }
      for (const [dx, dy] of DIRS) { const b = a + dx + dy * G; if (prev[b] !== -2 || !m[b] || (dx && dy && (!m[a + dx] || !m[a + dy * G]))) continue; prev[b] = a; q.push(b); }
    }
    return null;
  }
  flood(s) {
    const d = new Int16Array(G * G).fill(-1), m = this.map, q = [s]; d[s] = 0;
    for (let k = 0; k < q.length; k++) { const a = q[k]; for (const [dx, dy] of DIRS) { const b = a + dx + dy * G; if (d[b] >= 0 || !m[b] || (dx && dy && (!m[a + dx] || !m[a + dy * G]))) continue; d[b] = d[a] + 1; q.push(b); } }
    return d;
  }
  path(a, b) { return a === b ? [] : this.bfs(a, (i) => i === b); }
  // ------------------------------------------------------------ levels
  newLevel(d) {
    this.depth = d; this.lvT = 0; this.wT = 0; this.goal = null;
    const cave = d % 3 === 0;
    let m;
    for (let tries = 0; tries < 20; tries++) {
      m = this.map = new Uint8Array(G * G); this.rooms = [];
      if (cave) {
        let a = Array.from({ length: G * G }, () => this.rng() < 0.45);
        for (let it = 0; it < 5; it++) {
          const b = a.slice();
          for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && a[(y + dy) * G + x + dx]) n++; b[y * G + x] = n >= 5 || (n <= 1 && it < 2); }
          a = b;
        }
        for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) m[y * G + x] = a[y * G + x] ? 0 : 1;
      } else {
        const rs = this.rooms;
        for (let k = 0; k < 80 && rs.length < 11; k++) {
          const w = this.ri(4, 8), h = this.ri(4, 8), x = this.ri(2, G - w - 3), y = this.ri(2, G - h - 3);
          if (rs.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
          rs.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
        }
        for (const r of rs) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m[y * G + x] = 1;
        const dig = (a, b) => {
          const wide = this.rng() < 0.3, hor = this.rng() < 0.5;
          const run = (x0, y0, x1, y1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { m[y * G + x] = 1; if (wide) m[(y + (x0 === x1 ? 0 : 1)) * G + x + (x0 === x1 ? 1 : 0)] = 1; } };
          if (hor) { run(a.cx, a.cy, b.cx, a.cy); run(b.cx, a.cy, b.cx, b.cy); } else { run(a.cx, a.cy, a.cx, b.cy); run(a.cx, b.cy, b.cx, b.cy); }
        };
        for (let i = 1; i < rs.length; i++) { let best = 0, bd = 1e9; for (let j = 0; j < i; j++) { const dd = Math.abs(rs[i].cx - rs[j].cx) + Math.abs(rs[i].cy - rs[j].cy); if (dd < bd) { bd = dd; best = j; } } dig(rs[i], rs[best]); }
        for (let k = 0; k < 2 && rs.length > 3; k++) dig(this.pick(rs), this.pick(rs));
        // pillars in the bigger halls
        for (const r of rs) if (r.w >= 7 && r.h >= 7 && this.rng() < 0.6) for (const [px, py] of [[2, 2], [r.w - 3, 2], [2, r.h - 3], [r.w - 3, r.h - 3]]) m[(r.y + py) * G + r.x + px] = 0;
      }
      for (let i = 0; i < G; i++) m[i] = m[(G - 1) * G + i] = m[i * G] = m[i * G + G - 1] = 0;
      // keep the largest connected region
      const floors = []; for (let i = 0; i < G * G; i++) if (m[i]) floors.push(i);
      if (!floors.length) continue;
      let best = null;
      const seen = new Uint8Array(G * G);
      for (const f of floors) { if (seen[f]) continue; const D = this.flood(f), reg = floors.filter((i) => D[i] >= 0); for (const i of reg) seen[i] = 1; if (!best || reg.length > best.length) best = reg; }
      if (best.length < 260) continue;
      const keep = new Uint8Array(G * G); for (const i of best) keep[i] = 1;
      for (let i = 0; i < G * G; i++) if (!keep[i]) m[i] = 0;
      this.floors = best;
      break;
    }
    const s = this.rooms.length ? this.rooms[0].cy * G + this.rooms[0].cx : this.pick(this.floors);
    this.home = m[s] ? s : this.floors[0];
    const D = this.flood(this.home);
    let st = this.home; for (const i of this.floors) if (D[i] > D[st]) st = i;
    this.stairs = st; m[st] = 2;
    this.edge = new Uint8Array(G * G);
    for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) { const i = y * G + x; if (!m[i] && DIRS.some(([dx, dy]) => m[i + dx + dy * G])) this.edge[i] = 1; }
    this.seen = new Uint8Array(G * G); this.vis = new Uint8Array(G * G);
    this.loot = []; this.bolts = []; this.fx = []; this.blood = []; this.mobs = [];
    const sd = (this.post.seed | 0) + d * 7919;
    this.kinds = [{ hp: 1, dmg: 1, sp: 1.55, sz: 1 }, { hp: 1.7, dmg: 1.35, sp: 1.1, sz: 1.2 }, { hp: 0.6, dmg: 0.75, sp: 2.2, sz: 0.8 }].map((b, k) => ({ ...b, name: creatureName(sd + k * 131),
      art: (d + k) % 3 === 0 ? this.skin.creatures[(d * 2 + k) % 6] : monster(sd + k * 131, this.skin.hue + k * 90 + d * 37, 16 + k * 3, Math.min(4, d >> 1), { tex: this.skin.texFor?.(k + d * 3) }) }));
    const far = this.floors.filter((i) => D[i] > 9 && m[i] === 1);
    const nPacks = 6 + Math.min(7, d) + (this.mods.swarm ? 4 : 0);
    for (let p = 0; p < nPacks && far.length; p++) {
      const c = this.pick(far), kind = this.ri(0, 2), champ = p === 0 || (d > 3 && p === 1), n = this.ri(2, 3 + Math.min(3, d >> 1)) + (champ ? 1 : 0);
      for (let k = 0; k < n; k++) {
        let t = c;
        for (let tr = 0; tr < 8 && k; tr++) { const u = c + this.ri(-2, 2) + this.ri(-2, 2) * G; if (u > 0 && u < G * G && m[u] === 1) { t = u; break; } }
        this.spawnMob(kind, t % G + this.r(0.3, 0.7), ((t / G) | 0) + this.r(0.3, 0.7), champ && !k ? 'champ' : null, p);
      }
    }
    if (d % 4 === 0) {
      const b = this.spawnMob(1, st % G + 0.5, ((st / G) | 0) + 0.5, 'boss', 99);
      this.say(`${b.name} awaits below…`, RAR[3]);
    }
    const h = this.h; h.x = this.home % G + 0.5; h.y = ((this.home / G) | 0) + 0.5; h.path = []; h.tgt = null;
    this.camX = h.x; this.camY = h.y; this.lastTile = -1;
    this.floorTex = this.skin.texFor?.(d * 2) || this.skin.slots.tile[1] || this.skin.slots.tile[0];
    this.wallTex = this.skin.texFor?.(d * 2 + 1) || this.skin.slots.tile[0];
    this.zone = cave ? 'Caves' : ZONES[Math.min(ZONES.length - 1, Math.floor((d - 1) / 3))];
    this.banner = { s: `${this.zone.toUpperCase()} · LEVEL ${d}`, t: 3 };
    this.track();
  }
  spawnMob(kind, x, y, rank, pack) {
    const K = this.kinds[kind], d = this.depth, mul = rank === 'boss' ? 12 : rank ? 3.5 : 1;
    const hp = (6 + d * 5 + d * d * 0.5) * K.hp * mul;
    const mb = { x, y, K, hp, max: hp, dmg: (1.6 + d * 1.7) * K.dmg * (rank === 'boss' ? 2 : rank ? 1.4 : 1), sp: K.sp * (rank === 'boss' ? 0.9 : 1), r: K.sz * 0.3 * (rank === 'boss' ? 1.6 : rank ? 1.25 : 1),
      rank, pack, cd: 0, ph: this.r(0, 7), flash: 0, aggro: false, lost: 0, xp: (3 + d * 2.2) * mul * K.hp, name: K.name, art: K.art };
    if (rank === 'champ') {
      mb.name = `${this.pick(CH[0])}${this.pick(CH[1])} ${this.pick(CH[2])}`; mb.mod = this.pick(CMOD);
      if (mb.mod === 'Extra Fast') mb.sp *= 1.6; else if (mb.mod === 'Stone Skin') mb.hp = mb.max *= 1.6; else if (mb.mod === 'Extra Strong') mb.dmg *= 1.5;
    }
    if (rank === 'boss') {
      const s = (this.post.seed | 0) + d * 313;
      mb.name = `${this.pick(['Lord', 'Archbishop', 'Matron', 'King', 'Abbot', 'Warlord', 'Prince'])} ${creatureName(s)}`;
      mb.art = monster(s, this.skin.hue + 180, 26, 4, { tex: this.skin.texFor?.(d + 17), head: this.skin.slots.enemy[d % Math.max(1, this.skin.slots.enemy.length)] });
    }
    this.mobs.push(mb);
    return mb;
  }
  descend() { this.score += this.depth * 50; this.newLevel(this.depth + 1); this.say(`Descended to level ${this.depth}`, this.pal.ink); }
  // what the hero can see: rays out to the light radius
  track() {
    const h = this.h, ti = this.tileOf(h);
    this.vis.fill(0);
    const hx = Math.floor(h.x), hy = Math.floor(h.y);
    for (let y = hy - LIGHT; y <= hy + LIGHT; y++) for (let x = hx - LIGHT; x <= hx + LIGHT; x++) {
      if (x < 0 || y < 0 || x >= G || y >= G || (x - hx) ** 2 + (y - hy) ** 2 > LIGHT * LIGHT + 2) continue;
      const tx = x + 0.5, ty = y + 0.5, dx = tx - h.x, dy = ty - h.y, n = Math.ceil(Math.hypot(dx, dy) * 3) || 1;
      for (let k = 1; k <= n; k++) { const i = Math.floor(h.y + dy * k / n) * G + Math.floor(h.x + dx * k / n); this.vis[i] = this.seen[i] = 1; if (!this.map[i]) break; }
    }
    this.vis[ti] = this.seen[ti] = 1; for (const [dx, dy] of DIRS) this.seen[ti + dx + dy * G] = 1;
    if (ti !== this.lastTile) { this.lastTile = ti; this.dist = this.flood(ti); }
  }
  // ------------------------------------------------------------ stats & loot
  calc(g = this.gear) {
    let mn = 1, mx = 3, ar = 0, hp = 0, mp = 0, leech = 0, spd = 0, pct = 0, apct = 0, flat = 0;
    for (const it of Object.values(g)) { if (!it) continue; if (it.dmg) { mn = it.dmg[0]; mx = it.dmg[1]; } ar += it.ar; hp += it.hp; mp += it.mana; leech += it.leech; spd += it.spd; pct += it.pct; apct += it.apct; flat += it.flat; }
    const L = this.lvl, k = (1 + pct) * (1 + L * 0.07);
    return { min: (mn + flat + L * 0.4) * k, max: (mx + flat + L * 0.4) * k, ar: ar * (1 + apct) + L * 1.5, maxHp: 40 + L * 9 + hp, maxMp: 24 + L * 3 + mp, leech, spd };
  }
  power(s) { return (s.min + s.max) * (1 + s.spd) * (1 + s.leech * 4) * s.maxHp * (1 + s.ar / 50) * (1 + s.maxMp / 300); }
  restat() { const o = this.st, h = this.h; this.st = this.calc(); h.hp = Math.min(this.st.maxHp, h.hp * this.st.maxHp / o.maxHp); h.mp = Math.min(this.st.maxMp, h.mp); }
  makeItem(il, minR = 0, boss = false) {
    const x = this.rng();
    const rar = Math.max(minR, x < (boss ? 0.3 : 0.012 + il * 0.002) ? 3 : x < 0.1 + il * 0.005 ? 2 : x < 0.38 ? 1 : 0);
    const slot = SLOTS[this.ri(0, rar ? 4 : 3)], list = BASES[slot], q = Math.max(0, Math.min(list.length - 1, Math.floor(il * 0.6 + this.r(-1, 1.5))));
    const it = { slot, rar, il, q, base: list[q], dmg: null, ar: 0, hp: 0, mana: 0, leech: 0, spd: 0, pct: 0, apct: 0, flat: 0, si: SLOTS.indexOf(slot), seed: this.ri(0, 9999) };
    if (slot === 'weapon') { const lo = Math.round(1 + q * 1.3 + il * 0.5); it.dmg = [lo, Math.round(lo * 1.6 + 2)]; }
    else if (slot !== 'ring') it.ar = Math.round({ armor: 4, shield: 3, helm: 2 }[slot] * (1 + q * 0.8) + il);
    const sc = 0.7 + il * 0.18, add = ([n, k, v]) => { it[k] += ['pct', 'apct', 'leech', 'spd'].includes(k) ? v : Math.round(v * sc); return n; };
    const pres = PRE.filter(([, k]) => k === 'mana' || (k === 'pct' && slot === 'weapon') || (k === 'apct' && it.ar > 0));
    if (rar === 1) { const p = this.rng() < 0.65 ? add(this.pick(pres)) : '', s = !p || this.rng() < 0.6 ? add(this.pick(SUF)) : ''; it.name = [p, it.base, s].filter(Boolean).join(' '); }
    else if (rar >= 2) {
      for (let k = 0; k < (rar === 3 ? 5 : this.ri(3, 4)); k++) add(this.pick(k % 2 ? SUF : pres));
      it.name = rar === 3 ? this.pick(UNIQ[slot]) : `${this.pick(GRIM)} ${this.pick(NOUN[slot])}`;
      if (rar === 3) { if (it.dmg) it.dmg = it.dmg.map((v) => Math.round(v * 1.4)); it.ar = Math.round(it.ar * 1.4); }
    } else it.name = it.base;
    return it;
  }
  take(l) {
    const h = this.h;
    if (l.gold) { this.gold += l.gold; this.pop(h.x, h.y, `+${l.gold}g`, RAR[3]); return true; }
    if (l.pot) { if (this.pots[l.pot] >= 9) return false; this.pots[l.pot]++; this.pop(h.x, h.y, l.pot === 'hp' ? '+healing' : '+mana', l.pot === 'hp' ? '#e04040' : '#5a7dff'); return true; }
    const it = l.it, cur = this.gear[it.slot], val = (it.rar * 3 + 1) * (4 + it.il * 3);
    if (this.power(this.calc({ ...this.gear, [it.slot]: it })) > this.power(this.st) * 1.002) {
      this.gear[it.slot] = it; this.restat(); this.say(`Equipped ${it.name}`, RAR[it.rar]);
      if (cur) this.gold += (cur.rar * 3 + 1) * (4 + cur.il * 3);
    } else { this.gold += val; this.say(`${it.name} · sold ${val}g`, RAR[it.rar]); }
    return true;
  }
  gainXp(v) {
    this.xp += v; this.score += Math.round(v);
    while (this.xp >= this.need) {
      this.xp -= this.need; this.lvl++; this.need = this.needFor(this.lvl); this.st = this.calc(); this.h.hp = this.st.maxHp; this.h.mp = this.st.maxMp;
      this.say(`Level up! Now level ${this.lvl}`, RAR[2]); this.pop(this.h.x, this.h.y, 'LEVEL UP', RAR[2]);
      const [sx, sy] = this.P(this.h.x, this.h.y); this.burst(sx, sy - 14, RAR[2], 24, 160);
    }
  }
  say(s, c) { this.log.push({ s, c, t: 5 }); if (this.log.length > 4) this.log.shift(); }
  pop(x, y, s, c) { this.pops.push({ x, y, s, c, t: 0.9 }); if (this.pops.length > 30) this.pops.shift(); }
  // ------------------------------------------------------------ combat
  engage(m) { const h = this.h; if (h.tgt !== m) { h.tgt = m; h.rp = 0; } this.goal = null; }
  hit(m, dmg, crit) {
    const h = this.h;
    m.hp -= dmg; m.flash = 0.1; m.lost = 0;
    if (!m.aggro) for (const o of this.mobs) if (o.pack === m.pack) o.aggro = true;
    m.aggro = true;
    this.pop(m.x, m.y, String(Math.max(1, Math.round(dmg))), crit ? RAR[2] : this.pal.ink);
    if (this.st.leech) h.hp = Math.min(this.st.maxHp, h.hp + dmg * this.st.leech);
    if (m.hp <= 0 && !m.dead) this.kill(m);
  }
  kill(m) {
    const h = this.h, d = this.depth;
    m.dead = true; this.kills++; this.gainXp(m.xp);
    const [sx, sy] = this.P(m.x, m.y); this.burst(sx, sy - 10, '#8a1414', m.rank ? 26 : 10, 120);
    this.blood.push({ x: m.x, y: m.y, r: m.r * this.r(1.4, 2.4), a: this.r(0, 3) }); if (this.blood.length > 50) this.blood.shift();
    if (m.rank) this.say(`${m.name} slain!`, m.rank === 'boss' ? RAR[3] : RAR[1]);
    const drop = (o) => { let x = m.x + this.r(-0.6, 0.6), y = m.y + this.r(-0.6, 0.6); if (!this.map[this.tileOf({ x, y })]) { x = m.x; y = m.y; } this.loot.push({ x, y, ph: this.r(0, 7), ...o }); };
    const ni = m.rank === 'boss' ? 3 : m.rank ? 2 : this.rng() < 0.13 ? 1 : 0;
    for (let k = 0; k < ni; k++) drop({ it: this.makeItem(d + (m.rank ? 1 : 0), m.rank === 'boss' ? 2 : m.rank ? 1 : 0, m.rank === 'boss') });
    if (this.rng() < (m.rank ? 1 : 0.42)) drop({ gold: Math.round(this.r(2, 6) * (d + 1) * (m.rank ? 4 : 1)) });
    if (this.rng() < (m.rank ? 0.9 : 0.13)) drop({ pot: this.rng() < 0.68 ? 'hp' : 'mp' });
    if (h.tgt === m) h.tgt = null;
  }
  cast(tx, ty) {
    const h = this.h;
    if (h.mp < COST || h.dead) return false;
    h.mp -= COST; h.cast = 0.3;
    const a = Math.atan2(ty - h.y, tx - h.x);
    this.bolts.push({ x: h.x, y: h.y, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, life: 1.2, dmg: 8 + this.lvl * 3 + (this.st.min + this.st.max) * 0.8 });
    return true;
  }
  quaff(k) {
    const h = this.h;
    if (!this.pots[k] || h.dead) return;
    this.pots[k]--;
    if (k === 'hp') h.heal += this.st.maxHp * 0.65; else h.mp = Math.min(this.st.maxMp, h.mp + this.st.maxMp * 0.7);
    const [sx, sy] = this.P(h.x, h.y); this.burst(sx, sy - 14, k === 'hp' ? '#e04040' : '#5a7dff', 12, 90);
  }
  solidAt(x, y, r) { const m = this.map; return !m[Math.floor(y - r) * G + Math.floor(x - r)] || !m[Math.floor(y - r) * G + Math.floor(x + r)] || !m[Math.floor(y + r) * G + Math.floor(x - r)] || !m[Math.floor(y + r) * G + Math.floor(x + r)]; }
  slide(o, vx, vy, r) { if (!this.solidAt(o.x + vx, o.y, r)) o.x += vx; if (!this.solidAt(o.x, o.y + vy, r)) o.y += vy; }
  faceTo(dx, dy) { const s = dx - dy; if (Math.abs(s) > 0.05) this.h.face = Math.sign(s); }
  die() {
    const h = this.h, lost = Math.floor(this.gold * 0.25);
    h.dead = 2.2; h.path = []; h.tgt = null; this.deaths++; this.gold -= lost;
    this.say(`You have died. Lost ${lost} gold.`, '#e04040'); this.banner = { s: 'YOU HAVE DIED', t: 2.2, c: '#c8201c' };
    const [sx, sy] = this.P(h.x, h.y); this.burst(sx, sy - 10, '#8a1414', 40, 200);
  }
  respawn() {
    const h = this.h; h.dead = 0; h.hp = this.st.maxHp; h.mp = this.st.maxMp; h.heal = 0;
    h.x = this.home % G + 0.5; h.y = ((this.home / G) | 0) + 0.5; this.goal = null;
    for (const m of this.mobs) { m.aggro = false; m.hp = Math.min(m.max, m.hp + m.max * 0.25); }
    this.track();
  }
  // ------------------------------------------------------------ simulation
  step(dt) {
    const h = this.h, st = this.st, m = this.map;
    this.lvT += dt;
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const p of this.pops) { p.t -= dt; p.y -= dt * 0.6; p.x -= dt * 0.6; }
    this.pops = this.pops.filter((p) => p.t > 0);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (h.dead) { h.dead -= dt; if (h.dead <= 0) this.respawn(); }
    else {
      h.cd -= dt; h.swing = Math.max(0, (h.swing || 0) - dt); h.cast = Math.max(0, (h.cast || 0) - dt); h.hurt = Math.max(0, (h.hurt || 0) - dt);
      h.mp = Math.min(st.maxMp, h.mp + (1.2 + this.lvl * 0.15) * dt);
      const hr = Math.min(h.heal, st.maxHp * 0.9 * dt); h.heal -= hr;
      h.hp = Math.min(st.maxHp, h.hp + hr + st.maxHp * 0.008 * dt);
      if (!this.auto && !h.tgt && !h.path.length) { let b = null, bd = 1.4; for (const o of this.mobs) { const dd = Math.hypot(o.x - h.x, o.y - h.y); if (o.aggro && dd < bd) { bd = dd; b = o; } } if (b) this.engage(b); }
      let moving = false;
      const t = h.tgt;
      if (t && t.dead) h.tgt = null;
      if (h.tgt) {
        const dx = t.x - h.x, dy = t.y - h.y, d = Math.hypot(dx, dy);
        if (d <= 0.72 + t.r) {
          h.path.length = 0; this.faceTo(dx, dy);
          if (h.cd <= 0) { h.cd = 0.62 / (1 + st.spd); h.swing = 0.22; h.sw++; const crit = this.rng() < 0.1; this.hit(t, this.r(st.min, st.max) * (crit ? 2 : 1), crit); }
        } else {
          if ((h.rp -= dt) <= 0) { h.rp = 0.3; const p = this.path(this.tileOf(h), this.tileOf(t)); if (p) h.path = p; else { t.ign = this.t + 3; h.tgt = null; } }
          if (!h.path.length && h.tgt) { const s = HS * dt; this.slide(h, dx / d * s, dy / d * s, 0.2); this.faceTo(dx, dy); moving = true; }
        }
      }
      if (h.path.length) {
        const n = h.path[0], tx = n % G + 0.5, ty = ((n / G) | 0) + 0.5, dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy), s = HS * dt;
        if (d <= s) { h.x = tx; h.y = ty; h.path.shift(); if (!h.path.length && this.goal === 'explore') for (const [ex, ey] of DIRS) this.seen[n + ex + ey * G] = 1; }
        else { h.x += dx / d * s; h.y += dy / d * s; }
        this.faceTo(dx, dy); moving = true;
      }
      h.moving = moving; if (moving) h.anim += dt;
      if (this.tileOf(h) !== this.lastTile || (this.visT = (this.visT || 0) - dt) <= 0) { this.visT = 0.25; this.track(); }
      for (const l of this.loot) if (!l.got && Math.hypot(l.x - h.x, l.y - h.y) < 0.55) { if (this.take(l)) l.got = true; else l.skip = true; }
      this.loot = this.loot.filter((l) => !l.got);
      if (!h.path.length && !h.tgt && m[this.tileOf(h)] === 2) { this.descend(); return; }
    }
    // monsters
    for (const o of this.mobs) {
      o.ph += dt; o.flash = Math.max(0, o.flash - dt); o.cd -= dt; o.atk = Math.max(0, (o.atk || 0) - dt);
      if (!o.aggro) { if (!h.dead && this.vis[this.tileOf(o)] && Math.hypot(o.x - h.x, o.y - h.y) < LIGHT - 1) o.aggro = true; else continue; }
      if (h.dead) continue;
      const dx0 = h.x - o.x, dy0 = h.y - o.y, d = Math.hypot(dx0, dy0);
      if (d <= 0.55 + o.r) {
        if (o.cd <= 0) {
          o.cd = o.rank === 'boss' ? 1.3 : 1.1; o.atk = 0.25;
          const dmg = o.dmg * 50 / (50 + st.ar) * (this.mods.glass ? 2 : 1) * this.r(0.7, 1.2);
          h.hp -= dmg; h.hurt = 0.2; this.pop(h.x, h.y, String(Math.max(1, Math.round(dmg))), '#ff5a3a');
          if (o.mod === 'Vampiric') o.hp = Math.min(o.max, o.hp + dmg);
          if (h.hp <= 0) { this.die(); break; }
        }
        continue;
      }
      const ti = this.tileOf(o), here = this.dist[ti];
      if (here < 0 || here > 30) { if ((o.lost += dt) > 4) o.aggro = false; continue; }
      let tx = h.x, ty = h.y;
      if (here > 1) {
        let best = here; const cx = ti % G, cy = (ti / G) | 0;
        for (const [dx, dy] of DIRS) { const v = this.dist[ti + dx + dy * G]; if (v >= 0 && v < best && (!(dx && dy) || (m[ti + dx] && m[ti + dy * G]))) { best = v; tx = cx + dx + 0.5; ty = cy + dy + 0.5; } }
      }
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy) + 1e-6, s = o.sp * dt;
      this.slide(o, dx / dd * s, dy / dd * s, o.r * 0.8);
    }
    // keep them from stacking, and off the hero
    const A = this.mobs.filter((o) => o.aggro);
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j], dx = b.x - a.x, dy = b.y - a.y, mm = (a.r + b.r) * 0.9;
        if (Math.abs(dx) > mm || Math.abs(dy) > mm) continue;
        const d = Math.hypot(dx, dy) + 0.01; if (d < mm) { const k = (mm - d) / 2 / d; this.slide(a, -dx * k, -dy * k, a.r * 0.8); this.slide(b, dx * k, dy * k, b.r * 0.8); }
      }
      const dx = a.x - h.x, dy = a.y - h.y, d = Math.hypot(dx, dy) + 0.01, mm = 0.3 + a.r;
      if (d < mm) this.slide(a, dx / d * (mm - d), dy / d * (mm - d), a.r * 0.8);
    }
    for (const b of this.bolts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const hit = this.mobs.find((o) => !o.dead && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 0.25);
      if (hit || !m[this.tileOf(b)] || b.life <= 0) {
        b.life = 0; this.fx.push({ x: b.x, y: b.y, t: 0.4 });
        for (const o of this.mobs) if (!o.dead && Math.hypot(o.x - b.x, o.y - b.y) < 1.6) this.hit(o, b.dmg * this.r(0.85, 1.15), false);
        const [sx, sy] = this.P(b.x, b.y); this.burst(sx, sy - 8, this.col(0), 14, 140);
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter((f) => f.t > 0);
    this.mobs = this.mobs.filter((o) => !o.dead);
  }
  // ------------------------------------------------------------ autopilot
  autopilot(dt) {
    const h = this.h, st = this.st;
    if (h.dead) return;
    const near = (r) => this.mobs.filter((o) => (o.aggro || this.vis[this.tileOf(o)]) && Math.hypot(o.x - h.x, o.y - h.y) < r && (o.ign || 0) < this.t);
    if (h.hp < st.maxHp * 0.42 && h.heal <= 0 && this.pots.hp) this.quaff('hp');
    if (h.mp < COST && this.pots.mp > 1 && h.tgt && (h.tgt.rank || near(3).length > 2)) this.quaff('mp');
    // watchdog: if nothing changes for a while, wander somewhere new
    this.wT += dt;
    if (this.wT > 6) {
      if (Math.hypot(h.x - this.wX, h.y - this.wY) < 1.5 && this.kills === this.wK) { h.tgt = null; const p = this.bfs(this.tileOf(h), (i) => this.map[i] && this.rng() < 0.01); h.path = p || []; this.goal = 'wander'; }
      this.wT = 0; this.wX = h.x; this.wY = h.y; this.wK = this.kills;
    }
    if ((this.aiT = (this.aiT || 0) - dt) > 0) return;
    this.aiT = 0.15;
    const foes = near(7).filter((o) => this.dist[this.tileOf(o)] >= 0 && this.dist[this.tileOf(o)] < 13);
    if (foes.length) {
      let f = foes[0], fd = 1e9;
      for (const o of foes) { const d = Math.hypot(o.x - h.x, o.y - h.y) - (o.rank ? 0.6 : 0); if (d < fd) { fd = d; f = o; } }
      if (!h.tgt || Math.hypot(h.tgt.x - h.x, h.tgt.y - h.y) > fd + 1.5) this.engage(f);
      const t = h.tgt || f, pack = this.mobs.filter((o) => Math.hypot(o.x - t.x, o.y - t.y) < 2).length;
      if (h.mp >= COST && fd < 6 && (pack >= 3 || t.rank || h.hp < st.maxHp * 0.5)) this.cast(t.x, t.y);
      return;
    }
    if (h.tgt) return;
    const here = this.tileOf(h);
    let lb = null, ld = 9;
    for (const l of this.loot) { if (l.skip) continue; const d = Math.hypot(l.x - h.x, l.y - h.y); if (d < ld && this.dist[this.tileOf(l)] >= 0) { ld = d; lb = l; } }
    if (lb) { if (this.goal !== lb) { h.path = this.path(here, this.tileOf(lb)) || []; this.goal = lb; if (!h.path.length && ld > 0.6) lb.skip = true; } if (h.path.length || ld < 0.6) return; }
    if (h.path.length && this.goal) return;
    const seenStairs = this.seen[this.stairs];
    let explored = 0; for (const i of this.floors) explored += this.seen[i];
    if (this.lvT > 150) this.seen[this.stairs] = 1;
    if (!seenStairs || (explored < this.floors.length * 0.6 && this.lvT < 60)) {
      const p = this.bfs(here, (i) => this.seen[i] && this.map[i] && DIRS.some(([dx, dy]) => !this.seen[i + dx + dy * G]));
      if (p && p.length) { h.path = p; this.goal = 'explore'; return; }
      this.seen[this.stairs] = 1;
    }
    if (this.seen[this.stairs]) { h.path = this.path(here, this.stairs) || []; this.goal = 'stairs'; }
  }
  // ------------------------------------------------------------ input
  down(x, y) {
    const h = this.h;
    if (y > PY) {
      if (x > 54 && x < 88) this.quaff('hp');
      else if (x > 88 && x < 122) this.quaff('mp');
      else if (Math.hypot(x - (W - 80), y - 392) < 24) { const t = h.tgt || this.mobs.filter((o) => this.vis[this.tileOf(o)]).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0]; this.cast(t ? t.x : h.x + h.face, t ? t.y : h.y - h.face); }
      return;
    }
    if (h.dead) return;
    let best = null, bd = 22;
    for (const o of this.mobs) { if (!this.vis[this.tileOf(o)]) continue; const [sx, sy] = this.P(o.x, o.y), d = Math.hypot(x - sx, y - (sy - o.r * 40)); if (d < bd) { bd = d; best = o; } }
    if (best) { this.engage(best); return; }
    const u = (x - this.ox) / TW, v = (y - this.oy) / TH, wx = (u + v) / 2, wy = (v - u) / 2;
    let t = Math.floor(wy) * G + Math.floor(wx);
    if (wx < 1 || wy < 1 || wx >= G - 1 || wy >= G - 1) return;
    if (!this.map[t]) { let bd2 = 9; for (const [dx, dy] of DIRS) { const i = t + dx + dy * G; if (this.map[i] && this.seen[i]) { const dd = Math.hypot(i % G + 0.5 - wx, ((i / G) | 0) + 0.5 - wy); if (dd < bd2) { bd2 = dd; t = i; } } } }
    if (!this.map[t]) return;
    h.tgt = null; this.goal = null;
    h.path = this.path(this.tileOf(h), t) || [];
    this.mark = { x: t % G + 0.5, y: ((t / G) | 0) + 0.5, t: 0.5 };
  }
  // ------------------------------------------------------------ drawing
  P(x, y) { return [(x - y) * TW + this.ox, (x + y) * TH + this.oy]; }
  pat(i) { if (!ready(i)) return null; let p = this.pats.get(i); if (!p) { p = this.ctx.createPattern(i, 'repeat'); this.pats.set(i, p); } return p; }
  poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1]); c.closePath(); }
  draw(c) {
    const h = this.h, S = this.S, m = this.map;
    this.camX += (h.x - this.camX) * 0.12; this.camY += (h.y - this.camY) * 0.12;
    this.ox = W / 2 - (this.camX - this.camY) * TW; this.oy = CY - (this.camX + this.camY) * TH;
    c.fillStyle = '#050403'; c.fillRect(0, 0, W, H);
    const cs = this.camX + this.camY, cd = this.camX - this.camY, tiles = [];
    for (let ty = Math.floor(this.camY) - 24; ty <= this.camY + 24; ty++) for (let tx = Math.floor(this.camX) - 24; tx <= this.camX + 24; tx++) {
      if (tx < 0 || ty < 0 || tx >= G || ty >= G || Math.abs(tx + ty + 1 - cs) > 28 || Math.abs(tx - ty - cd) > 13) continue;
      const i = ty * G + tx; if (this.seen[i] && (m[i] || this.edge[i])) tiles.push(i);
    }
    // floor: one iso-skewed photo pattern over every explored floor diamond
    const fp = this.pat(this.floorTex), dia = (i) => { const tx = i % G, ty = (i / G) | 0, [ax, ay] = this.P(tx, ty); c.moveTo(ax, ay); c.lineTo(ax + TW, ay + TH); c.lineTo(ax, ay + TH * 2); c.lineTo(ax - TW, ay + TH); c.closePath(); };
    c.beginPath(); for (const i of tiles) if (m[i]) dia(i);
    c.fillStyle = this.pal.bg2; c.fill();
    if (fp) {
      const k = 4 / ((this.floorTex.naturalWidth || this.floorTex.width) || 64);
      fp.setTransform(new DOMMatrix([TW * k, TH * k, -TW * k, TH * k, this.ox, this.oy]));
      c.globalAlpha = 0.7; c.fillStyle = fp; c.fill(); c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(10,6,4,.28)'; c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.6; c.stroke();
    // stairs down
    if (this.seen[this.stairs]) {
      const sx0 = this.stairs % G, sy0 = (this.stairs / G) | 0;
      for (let k = 0; k < 4; k++) { const [ax, ay] = this.P(sx0 + k * 0.12, sy0 + k * 0.12), s = 1 - k * 0.24; this.poly(c, [ax, ay, ax + TW * s, ay + TH * s, ax, ay + TH * 2 * s, ax - TW * s, ay + TH * s]); c.fillStyle = `rgba(0,0,0,${0.4 + k * 0.18})`; c.fill(); c.strokeStyle = 'rgba(255,230,190,.25)'; c.stroke(); }
    }
    for (const b of this.blood) { const [sx, sy] = this.P(b.x, b.y); c.fillStyle = 'rgba(90,6,6,.55)'; c.beginPath(); c.ellipse(sx, sy, b.r * TW, b.r * TH, 0, 0, 7); c.fill(); }
    if (this.mark && (this.mark.t -= 1 / 60) > 0) { const [sx, sy] = this.P(this.mark.x, this.mark.y); c.strokeStyle = RAR[2]; c.globalAlpha = this.mark.t * 2; c.beginPath(); c.ellipse(sx, sy, 10, 5, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
    for (const l of this.loot) if (this.seen[this.tileOf(l)]) this.drawLoot(c, l);
    // walls and creatures, back to front
    const [hsx, hsy] = this.P(h.x, h.y), objs = [];
    for (const i of tiles) if (!m[i]) objs.push([i % G + ((i / G) | 0) + 1.4, 0, i]);
    for (const o of this.mobs) if (this.vis[this.tileOf(o)]) objs.push([o.x + o.y, 1, o]);
    objs.push([h.x + h.y, 2, h]);
    for (const b of this.bolts) objs.push([b.x + b.y, 3, b]);
    objs.sort((a, b) => a[0] - b[0]);
    const wp = this.pat(this.wallTex);
    if (wp) { const k = 70 / ((this.wallTex.naturalWidth || this.wallTex.width) || 64); wp.setTransform(new DOMMatrix([k, 0, 0, k, this.ox % 512, this.oy % 512])); }
    for (const [dep, kind, o] of objs) {
      if (kind === 0) {
        const i = o, tx = i % G, ty = (i / G) | 0, [ax, ay] = this.P(tx, ty), bx = ax + TW, by = ay + TH, cx = ax, cy = ay + TH * 2, dx = ax - TW, dy = ay + TH;
        const fade = dep > h.x + h.y + 0.3 && Math.abs(ax - hsx) < 34 && ay - hsy > -30 && ay - hsy < 30;
        c.globalAlpha = fade ? 0.35 : 1;
        const face = (pts, shade) => { this.poly(c, pts); c.fillStyle = this.pal.bg2; c.fill(); if (wp) { c.fillStyle = wp; c.fill(); } c.fillStyle = `rgba(0,0,0,${shade + (this.vis[i] ? 0 : 0.35)})`; c.fill(); };
        if (m[i + G]) face([dx, dy - WH, cx, cy - WH, cx, cy, dx, dy], 0.32);
        if (m[i + 1]) face([cx, cy - WH, bx, by - WH, bx, by, cx, cy], 0.55);
        face([ax, ay - WH, bx, by - WH, cx, cy - WH, dx, dy - WH], 0.05);
        c.strokeStyle = 'rgba(255,235,200,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(dx, dy - WH); c.lineTo(cx, cy - WH); c.lineTo(bx, by - WH); c.stroke();
        c.globalAlpha = 1;
      } else if (kind === 1) this.drawMob(c, o, hsx);
      else if (kind === 2) this.drawHero(c);
      else { const [sx, sy] = this.P(o.x, o.y); const g = c.createRadialGradient(sx, sy - 10, 1, sx, sy - 10, 10); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, this.col(0)); g.addColorStop(1, 'rgba(255,80,0,0)'); c.fillStyle = g; c.fillRect(sx - 10, sy - 20, 20, 20); }
    }
    for (const f of this.fx) { const [sx, sy] = this.P(f.x, f.y), k = 1 - f.t / 0.4; c.globalAlpha = f.t * 2; c.fillStyle = this.col(0); c.beginPath(); c.ellipse(sx, sy, 1.6 * TW * k + 4, 1.6 * TH * k + 2, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
    // darkness beyond the torch
    const R = LIGHT * TW * 1.15 + Math.sin(this.t * 9) * 3 + Math.sin(this.t * 23) * 2;
    const g = c.createRadialGradient(hsx, hsy - 8, 10, hsx, hsy - 8, R);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,.12)'); g.addColorStop(1, 'rgba(3,2,1,.9)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const wg = c.createRadialGradient(hsx, hsy - 8, 0, hsx, hsy - 8, R * 0.7); wg.addColorStop(0, 'rgba(255,150,60,.12)'); wg.addColorStop(1, 'rgba(255,150,60,0)'); c.globalCompositeOperation = 'lighter'; c.fillStyle = wg; c.fillRect(hsx - R, hsy - R, R * 2, R * 2); c.globalCompositeOperation = 'source-over';
    // loot labels, names, damage numbers
    c.font = '700 8px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const l of this.loot) {
      if (!this.vis[this.tileOf(l)] || Math.hypot(l.x - h.x, l.y - h.y) > 6) continue;
      const [sx, sy] = this.P(l.x, l.y), s = l.it ? l.it.name : l.gold ? `${l.gold} gold` : l.pot === 'hp' ? 'Healing Potion' : 'Mana Potion', w = c.measureText(s).width + 6;
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(sx - w / 2, sy - 22, w, 10);
      c.fillStyle = l.it ? RAR[l.it.rar] : l.gold ? RAR[3] : this.pal.ink; c.fillText(s, sx, sy - 17);
    }
    for (const o of this.mobs) if (o.rank && this.vis[this.tileOf(o)]) { const [sx, sy] = this.P(o.x, o.y); this.text(c, o.name, sx, sy - o.r * 95 - 8, 8, o.rank === 'boss' ? RAR[3] : RAR[1]); }
    for (const p of this.pops) { const [sx, sy] = this.P(p.x, p.y); c.globalAlpha = Math.min(1, p.t * 2); this.text(c, p.s, sx, sy - 34, 9, p.c); }
    c.globalAlpha = 1;
    this.drawUI(c);
  }
  drawLoot(c, l) {
    const [sx, sy0] = this.P(l.x, l.y), sy = sy0 - 4 + Math.sin(this.t * 3 + l.ph) * 1.2;
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(sx, sy0, 6, 3, 0, 0, 7); c.fill();
    if (l.gold) { c.fillStyle = RAR[3]; for (const [dx, dy] of [[-3, 0], [3, 0], [0, -2]]) { c.beginPath(); c.ellipse(sx + dx, sy + dy, 3, 2, 0, 0, 7); c.fill(); } c.strokeStyle = '#6a4a12'; c.stroke(); }
    else if (l.pot) this.flask(c, sx, sy - 2, 0.8, l.pot === 'hp' ? '#c01c1c' : '#2a46d8');
    else {
      if (l.it.rar === 3) { c.fillStyle = 'rgba(217,169,82,.2)'; c.fillRect(sx - 3, sy - 40, 6, 40); }
      const icon = this.skin.list('loot', 5, 'item')[l.it.si];
      if (!drawFit(c, icon, sx, sy - 4, 14, 14, 0.4)) drawFit(c, itemArt(l.it.seed + l.it.si * 97, this.skin.hue + l.it.si * 60), sx, sy - 4, 12, 12);
    }
  }
  flask(c, x, y, s, col) {
    c.fillStyle = col; c.beginPath(); c.arc(x, y + 2 * s, 5 * s, 0, 7); c.fill(); c.fillRect(x - 2 * s, y - 6 * s, 4 * s, 5 * s);
    c.fillStyle = '#8a6a44'; c.fillRect(x - 2.5 * s, y - 8 * s, 5 * s, 2.5 * s);
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(x - 3 * s, y, 1.5 * s, 2.5 * s);
  }
  drawMob(c, o, hsx) {
    const [sx, sy] = this.P(o.x, o.y), s = o.r * 108 * this.S, im = o.art?.frames?.[Math.floor(o.ph * 4) % 2];
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(sx, sy, s * 0.4, s * 0.2, 0, 0, 7); c.fill();
    if (o.rank) { c.strokeStyle = o.rank === 'boss' ? '#e0412b' : RAR[1]; c.lineWidth = 1.5; c.globalAlpha = 0.6 + Math.sin(this.t * 6) * 0.3; c.beginPath(); c.ellipse(sx, sy, s * 0.5, s * 0.25, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
    if (o.flash) c.filter = 'brightness(2.4)';
    const lunge = o.atk ? 3 : 0, dir = Math.sign(hsx - sx) || 1;
    if (!drawFit(c, im, sx + lunge * dir, sy - s * 0.42 - Math.abs(Math.sin(o.ph * 8)) * 1.5, s, s, 0, hsx < sx)) { c.fillStyle = this.col(3); c.beginPath(); c.arc(sx, sy - s * 0.4, s * 0.35, 0, 7); c.fill(); }
    c.filter = 'none';
    if (o.hp < o.max) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(sx - 10, sy - s - 2, 20, 3); c.fillStyle = '#c01c1c'; c.fillRect(sx - 10, sy - s - 2, 20 * Math.max(0, o.hp / o.max), 3); }
  }
  drawHero(c) {
    const h = this.h, [sx, sy] = this.P(h.x, h.y), per = this.skin.people[0], S = this.S;
    c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(sx, sy, 8, 4, 0, 0, 7); c.fill();
    const im = h.dead ? per.hurt : h.cast > 0 ? per.special : h.swing > 0 ? (h.sw % 2 ? per.kick : per.punch) : h.hurt > 0 ? per.hurt : h.moving ? per.walk[Math.floor(h.anim * 7) % 2] : per.idle;
    if (!drawFit(c, im, sx, sy - 14 * S + (h.dead ? 8 : 0), 22 * S, 30 * S, h.dead ? 1.4 * h.face : 0, h.face < 0)) { c.fillStyle = this.pal.ink; c.fillRect(sx - 4, sy - 24, 8, 22); }
    if (h.swing > 0 && h.tgt) {
      const [tx, ty] = this.P(h.tgt.x, h.tgt.y), a = Math.atan2(ty - sy, tx - sx), k = h.swing / 0.22;
      c.strokeStyle = this.pal.ink; c.globalAlpha = k; c.lineWidth = 2.5; c.beginPath(); c.arc(sx, sy - 12, 14, a - 1.2 + (1 - k) * 1.6, a - 0.4 + (1 - k) * 1.6); c.stroke(); c.globalAlpha = 1;
    }
  }
  drawUI(c) {
    const h = this.h, st = this.st;
    // target / boss bar
    const t = h.tgt && !h.tgt.dead ? h.tgt : null;
    if (t) {
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(W / 2 - 80, 58, 160, 20);
      c.fillStyle = '#6a0e0e'; c.fillRect(W / 2 - 78, 70, 156 * Math.max(0, t.hp / t.max), 6);
      this.text(c, t.mod ? `${t.name} · ${t.mod}` : t.name, W / 2, 64, 8, t.rank === 'boss' ? RAR[3] : t.rank ? RAR[1] : this.pal.ink);
    }
    this.text(c, `${this.zone} ${this.depth}`, W - 8, 64, 9, this.pal.ink, 'right');
    this.log.forEach((l, k) => { c.globalAlpha = Math.min(1, l.t); this.text(c, l.s, 8, 88 + k * 11, 8, l.c, 'left'); });
    c.globalAlpha = 1;
    if (this.banner) { c.globalAlpha = Math.min(1, this.banner.t); this.text(c, this.banner.s, W / 2, 150, 15, this.banner.c || RAR[3]); c.globalAlpha = 1; }
    // bottom panel
    const g = c.createLinearGradient(0, PY, 0, H); g.addColorStop(0, '#1d1611'); g.addColorStop(1, '#0b0806');
    c.fillStyle = g; c.fillRect(0, PY, W, H - PY);
    const wp = this.pat(this.wallTex); if (wp) { wp.setTransform(new DOMMatrix([0.3, 0, 0, 0.3, 0, 0])); c.globalAlpha = 0.25; c.fillStyle = wp; c.fillRect(0, PY, W, H - PY); c.globalAlpha = 1; }
    c.fillStyle = '#5a4630'; c.fillRect(0, PY, W, 1);
    c.fillStyle = '#000'; c.fillRect(0, PY + 1, W, 3); c.fillStyle = '#a8862e'; c.fillRect(0, PY + 1, W * Math.min(1, this.xp / this.need), 3);
    const orb = (x, f, col, v) => {
      c.save(); c.beginPath(); c.arc(x, 392, 22, 0, 7); c.fillStyle = '#100a08'; c.fill(); c.clip();
      c.fillStyle = col; c.fillRect(x - 22, 414 - 44 * Math.max(0, Math.min(1, f)), 44, 44);
      const gg = c.createRadialGradient(x - 7, 384, 2, x, 392, 22); gg.addColorStop(0, 'rgba(255,255,255,.35)'); gg.addColorStop(1, 'rgba(0,0,0,.45)'); c.fillStyle = gg; c.fillRect(x - 22, 370, 44, 44);
      c.restore(); c.strokeStyle = '#7a6040'; c.lineWidth = 2; c.beginPath(); c.arc(x, 392, 22, 0, 7); c.stroke();
      this.text(c, String(Math.max(0, Math.ceil(v))), x, 392, 9, '#fff');
    };
    orb(28, h.hp / st.maxHp, '#a3121a', h.hp); orb(W - 28, h.mp / st.maxMp, '#2338b0', h.mp);
    for (const [k, x, col] of [['hp', 71, '#c01c1c'], ['mp', 105, '#2a46d8']]) {
      c.fillStyle = 'rgba(0,0,0,.5)'; roundRect(c, x - 15, 375, 30, 34, 4); c.fill(); c.strokeStyle = '#4a3a28'; c.lineWidth = 1; c.stroke();
      c.globalAlpha = this.pots[k] ? 1 : 0.3; this.flask(c, x, 390, 1.2, col); c.globalAlpha = 1;
      this.text(c, String(this.pots[k]), x + 10, 403, 8, this.pal.ink);
    }
    const ok = h.mp >= COST, bx = W - 80;
    c.beginPath(); c.arc(bx, 392, 19, 0, 7); c.fillStyle = ok ? '#3a1606' : '#1a1410'; c.fill(); c.strokeStyle = ok ? this.col(0) : '#4a3a28'; c.lineWidth = 2; c.stroke();
    const fg = c.createRadialGradient(bx, 390, 1, bx, 390, 12); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.5, ok ? this.col(0) : '#5a4a3a'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fg; c.beginPath(); c.arc(bx, 390, 12, 0, 7); c.fill();
    this.text(c, 'FIRE', bx, 406, 7, ok ? this.pal.ink : '#6a5a4a');
    this.text(c, `DMG ${Math.round(st.min)}-${Math.round(st.max)}  AR ${Math.round(st.ar)}  LV ${this.lvl}`, 181, 374, 8, this.pal.ink);
    SLOTS.forEach((s, k) => {
      const it = this.gear[s], x = 137 + k * 22, y = 396;
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - 10, y - 10, 20, 20); c.strokeStyle = it ? RAR[it.rar] : '#3a2e22'; c.lineWidth = 1; c.strokeRect(x - 9.5, y - 9.5, 19, 19);
      if (it) { const icon = this.skin.list('loot', 5, 'item')[k]; if (!drawFit(c, icon, x, y, 16, 16)) drawFit(c, itemArt(it.seed + k * 97, this.skin.hue + k * 60), x, y, 14, 14); }
      else this.text(c, s[0].toUpperCase(), x, y, 8, '#4a3a28');
    });
    this.text(c, `${this.gold}g`, 181, 413, 7, RAR[3]);
  }
  hud() { return `D${this.depth} · LV ${this.lvl} · ${this.gold}g`; }
}
