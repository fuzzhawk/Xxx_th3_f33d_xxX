// Final Fantasy-style RPG with a seeded saga per post: a villain with a name and a motive, four relics
// in four dungeons, twists, recruits met in towns or rescued from cells, towns with an inn, item and
// arms shops, multi-phase bosses with telegraphed attacks, and a citadel finale. Self-playing.
import { Game, W, H, drawFit, ready, roundRect, noiseMap } from './engine.js';
import { monster, creatureName } from './creature.js';
import { horror } from '../horror.js';
import { crystalSheet, Actor, S } from '../crystal/sprites.js';

const T = 20, N = 64, DN = 36;
const GRASS = 0, FOREST = 1, HILL = 2, MOUNT = 3, WATER = 4, ROAD = 5, TOWN = 6, CAVE = 7, SAND = 8;
const ENC = [0.035, 0.085, 0.06, 0, 0, 0.012, 0, 0, 0.03];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// jobs: base stats, growth per level [hp, mp, atk, def, mag, spd], gear kinds, skills [name, level]
const CLASSES = {
  Knight: { tag: 'Kn', hp: 48, mp: 6, atk: 11, def: 8, mag: 2, spd: 5, g: [10, 0.8, 3, 2.2, 0.3, 0.45], wk: 'Sword', ak: 'Mail', skills: [['Cover', 1], ['Smite', 4], ['Holy Blade', 9]] },
  'Black Mage': { tag: 'BM', hp: 28, mp: 26, atk: 5, def: 3, mag: 11, spd: 7, g: [5, 4, 1, 1, 2.6, 0.6], wk: 'Rod', ak: 'Robe', mage: 1, skills: [['Fire', 1], ['Blizzard', 1], ['Thunder', 3], ['Flare', 8]] },
  'White Mage': { tag: 'WM', hp: 34, mp: 24, atk: 6, def: 5, mag: 8, spd: 6, g: [7, 3.6, 1.4, 1.4, 2, 0.6], wk: 'Staff', ak: 'Robe', mage: 1, skills: [['Cure', 1], ['Protect', 3], ['Raise', 5], ['Cura', 7], ['Holy', 10]] },
  Monk: { tag: 'Mo', hp: 44, mp: 8, atk: 13, def: 5, mag: 3, spd: 7, g: [9, 1, 3.4, 1.5, 0.5, 0.6], wk: 'Claws', ak: 'Gi', skills: [['Chakra', 1], ['Kick', 3], ['Focus', 6]] },
  Thief: { tag: 'Th', hp: 34, mp: 8, atk: 9, def: 4, mag: 4, spd: 11, g: [7, 1, 2.4, 1.2, 0.8, 0.9], wk: 'Dagger', ak: 'Vest', skills: [['Steal', 1], ['Mug', 4], ['Flurry', 8]] },
  Ranger: { tag: 'Ra', hp: 38, mp: 10, atk: 10, def: 5, mag: 4, spd: 8, g: [8, 1.2, 2.8, 1.4, 0.8, 0.7], wk: 'Knives', ak: 'Leathers', bow: 1, skills: [['Aim', 1], ['Barrage', 4], ['Sleet', 8]] }
};
const SK = {
  Fire: { mp: 6, all: 1, pow: 1.05, el: 'fire', col: '#ff7a2a' }, Blizzard: { mp: 5, pow: 1.7, el: 'ice', col: '#9ae8ff' }, Thunder: { mp: 5, pow: 1.7, el: 'bolt', col: '#ffe14a' },
  Flare: { mp: 14, pow: 3.2, col: '#ff4a8a' }, Holy: { mp: 16, pow: 2.8, el: 'holy', col: '#fffbe0' },
  Cure: { mp: 5, heal: 2.4, col: '#7dffa8' }, Cura: { mp: 12, heal: 1.6, all: 1, col: '#a8ffd8' }, Raise: { mp: 14, raise: 1, col: '#fff3a0' }, Protect: { mp: 8, buff: 1, col: '#9ad0ff' },
  Cover: { mp: 3, cover: 1, col: '#c0c8d8' }, Smite: { mp: 6, phys: 1.9, col: '#ffd23a' }, 'Holy Blade': { mp: 10, phys: 1.7, el: 'holy', col: '#fffbe0' },
  Chakra: { mp: 4, heal: 0, self: 1, col: '#ffcc66' }, Kick: { mp: 5, phys: 0.85, all: 1, col: '#ffb070' }, Focus: { mp: 6, phys: 2.6, col: '#ff7040' },
  Steal: { mp: 0, steal: 1, col: '#e0d070' }, Mug: { mp: 4, phys: 1.1, steal: 1, col: '#e0d070' }, Flurry: { mp: 8, phys: 0.6, hits: 4, col: '#ffffff' },
  Aim: { mp: 3, phys: 1.8, crit: 1, col: '#ffd23a' }, Barrage: { mp: 8, phys: 0.55, hits: 4, col: '#c8ff8a' }, Sleet: { mp: 10, phys: 0.9, all: 1, el: 'ice', col: '#9ae8ff' }
};
const ITEMS = { potion: ['Potion', 15], ether: ['Ether', 45], phoenix: ['Phoenix Down', 90], tent: ['Tent', 70] }, IK = Object.keys(ITEMS);
const GEAR = ['Bronze', 'Iron', 'Steel', 'Silver', 'Mithril', 'Rune', 'Dragon', 'Crystal', 'Star', 'Void', 'Genesis', 'Ultima'];
const price = (kind, t) => Math.round((kind === 'w' ? 70 : 60) * t ** 1.85);
const WEAK = { fire: 'ice', water: 'bolt', leaf: 'fire', wind: 'bolt', earth: 'ice', shadow: 'holy', spirit: 'holy', beast: 'fire' };
const ECOL = { fire: '#ff7a2a', water: '#5ab8ff', leaf: '#7ad04a', wind: '#c8f0e0', earth: '#c8a060', shadow: '#9a5aff', spirit: '#f0d8ff', beast: '#ff5a5a' };
const BIG = { fire: 'Inferno', water: 'Tidal Wave', leaf: 'Thorn Storm', wind: 'Cyclone', earth: 'Quake', shadow: 'Umbral Nova', spirit: 'Soul Requiem', beast: 'Rampage' };
const ZAP = { fire: 'Ember', water: 'Bubble Jet', leaf: 'Spore Cloud', wind: 'Gust', earth: 'Rockfall', shadow: 'Hex', spirit: 'Wail', beast: 'Maul' };
// horror-forge monsters walk among the cute ones: their elements in this game's terms
const HEL = { undead: 'shadow', fire: 'fire', poison: 'beast' };
const HKIND = ['zombie', 'imp', 'wraith', 'hound', 'spider', 'zombie', 'demon', 'abom'];
const hash = (n) => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return (n ^ (n >>> 15)) >>> 0; };
const EPI = { fire: 'the Cinder Maw', water: 'the Tide-Drinker', leaf: 'the Thorned Mother', wind: 'the Storm Herald', earth: 'the Stone Warden', shadow: 'the Night Eater', spirit: 'the Hollow Saint', beast: 'the Ravager' };
// the saga's building blocks
const THREATS = [
  ['the four Crystals are dimming and the sea rises to swallow the coast', 'the Crystals shine again and the sea draws back'],
  ['the sun rises paler every dawn and nothing will grow', 'the sun blazes gold and the fields turn green'],
  ['a grey blight creeps over the fields, turning all it touches to ash', 'the blight withers away and flowers push through the ash'],
  ['the stars are falling one by one and monsters climb from the craters', 'the stars hang still and the craters fill with rain'],
  ['the old bells ring by themselves at night and the dead will not rest', 'the bells fall silent and the dead sleep at last'],
  ['the wind has died and the sky ships lie rotting in their docks', 'the wind returns and the sky ships rise again']
];
const VILLAINS = ['Malgrave', 'Vesper', 'Kaltheon', 'Morwen', 'Azhul', 'Sorrowyn', 'Draxis', 'Ilvane', 'Corvin', 'Seraphine', 'Mordant', 'Xeleth'];
const VTITLES = ['the Hollow King', 'the Ashen Saint', 'the Last Archmage', 'the Star-Eater', 'the Pale Regent', 'the Clockwork Witch', 'the Exiled Prince', 'the Weeping Knight'];
const MOTIVES = [
  ['to drain the relics and live forever', 'I watched everyone I loved grow old and die. Never again!'],
  ['to unmake the world and begin it anew', 'This world took my child from me. It deserves no second chance.'],
  ['to burn the kingdom that cast me out', 'They left me to die in the snow. Now I return the favour.'],
  ['to wake the god sleeping under the sea', 'The god promised a world without hunger. I believed it. I still do.'],
  ['to rule the stars themselves', 'Kings bow to the Crystals, and the Crystals bow to no one. Neither will I!'],
  ['to freeze time so that nothing ever ends', 'Every ending is a grief. I would spare the world all of them.']
];
const RELICS = [['Wind Crystal', 'Fire Crystal', 'Water Crystal', 'Earth Crystal'], ['Ember Shard', 'Tide Pearl', 'Gale Feather', 'Stone Heart'], ['Sun Mirror', 'Moon Bell', 'Star Key', 'Dawn Seal'], ['Crown of Ash', 'Ring of Rain', 'Horn of Storms', 'Mask of Roots']];
const CHAPS = ['A Pale Dawn', 'Embers Below', 'The Drowned Bell', 'Ashes and Oaths', 'Where Crystals Sleep', 'Under a Broken Star', 'Songs of the Deep', 'The Long Night', 'Wings of Iron', 'A Debt of Blood'];
const FINALE = ['The Last Light', 'End of All Things', 'The Hollow Throne', 'Dawn, Again'];
const NAMES = ['Aria', 'Bram', 'Cael', 'Dara', 'Eira', 'Fenn', 'Gale', 'Hale', 'Isolde', 'Joss', 'Kael', 'Lark', 'Mira', 'Nell', 'Orin', 'Pell', 'Quill', 'Rhea', 'Sela', 'Tamsin', 'Ulric', 'Vale', 'Wren', 'Yara', 'Zane', 'Brin', 'Cora', 'Dex', 'Ember', 'Rook'];
const SAGES = ['Elder Tobin', 'Sage Ilsa', 'Old Maren', 'Abbot Corwyn', 'Seer Nadia', 'Granny Wynn'];
const DNAME = ['Cave', 'Crypt', 'Tower', 'Ruins', 'Mines', 'Temple', 'Lair', 'Vault'], CNAME = ['Citadel', 'Spire', 'Sanctum', 'Black Keep'];
const HELLO = {
  Knight: 'My oath is to the realm. Let my shield guard your backs.', 'Black Mage': 'Fire, ice, lightning — I know them all. Point me at something.',
  'White Mage': 'I can mend what monsters break. Let me walk with you.', Monk: 'My fists have waited years for a worthy fight!',
  Thief: 'Relax, I only steal from monsters. Mostly.', Ranger: 'I know these wilds. You will need my eyes — and my knives.'
};
const TAUNT = ['You will not take the {r}!', '{v} promised me a feast. You will do nicely.', 'Turn back, little lights. Nothing waits here but teeth.', 'I have guarded the {r} for a thousand years.'];
const need = (lv) => Math.round(12 * lv ** 1.7);
const DIR4 = ['S', 'W', 'N', 'E'], SKINS = ['Fair', 'Olive', 'Bronze', 'Umber', 'Porcelain', 'Ebony'];
const LUNGE = -42, BSC = 2, QY = 66; // battle step-forward distance, sprite scale, top of the quest line (below the mutator pills)
const F = (f) => [null, null, null, f]; // a callback inside a dialogue
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const mul = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export class Jrpg extends Game {
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'giant', 'tiny', 'trails'];
  setup() {
    this.pops = []; this.patMemo = new Map(); this.route = []; this.think = 0; this.grace = 6; this.mode = 'world';
    this.gold = 60; this.inv = { potion: 3, ether: 1, phoenix: 1, tent: 0 }; this.world = 0; this.cleared = 0; this.extra = 0;
    this.party = []; this.reserve = []; this.sayQ = []; this.used = new Set();
    this.saga();
  }
  // ---------------------------------------------------------------- the saga
  saga() {
    this.npcs = []; this.cast = []; this.pend = []; this.met = []; this.vil = this.sageN = this.kin = this.kinH = null;
    this.kinTold = this.needReturn = false; this.relics = 0; this.chap = 0;
    this.makeStory();
    if (!this.party.length) { this.join(this.makeHero(this.story.lead, true)); this.join(this.makeHero(this.story.second)); }
    this.newWorld(); this.prologue();
  }
  makeStory() {
    const R = mul((this.post.seed || 1) * 7 + this.world * 1291), pk = (a) => a[Math.floor(R() * a.length)], sh = (a) => a.map((v) => [R(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    const have = [...this.party, ...this.reserve].map((h) => h.job), [threat, heal] = pk(THREATS), [want, why] = pk(MOTIVES), vname = pk(VILLAINS);
    const lead = have[0] || sh(['Knight', 'Monk', 'Thief', 'Ranger'])[0], second = have[1] || (R() < 0.6 ? 'White Mage' : 'Black Mage');
    let rec = sh(Object.keys(CLASSES)).filter((j) => !have.includes(j) && j !== lead && j !== second);
    if (rec.includes('White Mage')) rec = ['White Mage', ...rec.filter((j) => j !== 'White Mage')]; // a healer is the first to join
    this.story = { threat, heal, want, why, vname, vtitle: pk(VTITLES), sage: pk(SAGES), relics: pk(RELICS), titles: [...sh(CHAPS).slice(0, 4), pk(FINALE)], fin: R() < 0.5 ? 'seal' : 'traitor', mid: R() < 0.5 ? 'kin' : 'redeemed', rec, lead, second, look: R() < 0.5, names: sh(NAMES), cit: `${pk(CNAME)} of ${vname}` };
  }
  prologue() {
    const st = this.story, sg = this.sage(), [a, b] = this.party;
    this.castAt(sg, -1, 0, 'E'); a.actor.face('W');
    this.talk([
      [sg, `${this.world ? 'Heroes, the peace did not last.' : 'Travellers, hear me!'} ${cap(st.threat)}.`, 'sad'],
      [sg, `It is the work of ${st.vname} ${st.vtitle}, who seeks ${st.want}.`, 'angry'],
      [sg, `Four relics hold the world together: the ${st.relics.slice(0, 3).join(', ')} and ${st.relics[3]}. Find them first!`, 'think'],
      [a, 'Then we leave at dawn. Leave it to us!', 'nod'],
      [b || a, this.world ? 'Together again. Just like old times.' : 'Wherever you go, I go.', 'cheer'],
      F(() => { this.cast = []; this.chapterCard(); })
    ]);
  }
  chapterCard(then) { const c = this.chap; this.card = { s: c < 4 ? `${this.world ? `Book ${this.world + 1} · ` : ''}Chapter ${c + 1}` : 'Finale', sub: this.story.titles[Math.min(4, c)], t: 2.6, max: 2.6, then }; }
  // story people: the villain and the sage are Crystal characters too
  villain() {
    if (!this.vil) {
      const st = this.story, s = ((this.post.seed || 1) * 13 + this.world * 101) >>> 0;
      const char = S.setCharacter({ job: st.look ? 'Black Mage' : 'Knight', topColor: 'Coal', botColor: 'Coal', headColor: st.look ? 'Plum' : 'Coal', trimColor: 'Scarlet', handsColor: 'Coal', weaponColor: 'Scarlet', cape: 'cape', capeColor: 'Scarlet', hairColor: 'Silver', ...(st.look ? {} : { skin: 'Porcelain' }) }, s);
      this.vil = this.npc(st.vname, crystalSheet((s % 9000) + 5000, { char, dirs: DIR4 }));
    }
    return this.vil;
  }
  sage() { return this.sageN || (this.sageN = this.npc(this.story.sage, this.skin.crystal(7 + this.world, 'Fantasy', DIR4))); }
  keeper(tw) { return tw.keep || (tw.keep = this.npc('Shopkeeper', this.skin.crystal(20 + tw.k + this.world * 3, 'Fantasy', DIR4))); }
  newActor(sheet, dir = 'S') { return new Actor(sheet, { mode: 'four', dir, walkSpeed: 4, runSpeed: 160, walkStride: 12, runStride: 16 }); }
  npc(name, sheet, dir = 'S') { const n = { name, actor: this.newActor(sheet, dir) }; this.npcs.push(n); return n; }
  castAt(n, dx, dy, dir) { const L = this.walkers?.[0]; if (!L) return; this.cast = this.cast.filter((m) => m.n !== n); this.cast.push({ n, x: L.x + dx, y: L.y + dy }); n.actor.face(dir); }
  // ---------------------------------------------------------------- heroes
  makeHero(job, lead = false) {
    const cl = CLASSES[job], v = this.party.length + this.reserve.length + this.pend.length + this.world * 7;
    const name = lead && this.skin.heroName ? String(this.skin.heroName).slice(0, 8) : this.story.names.find((n) => !this.used.has(n)) || creatureName(v * 31 + 7);
    this.used.add(name);
    const h = { hero: true, k: 0, cl, job, name, lv: 1, xp: 0, max: cl.hp, hp: cl.hp, mmp: cl.mp, mp: cl.mp, atk: cl.atk, def: cl.def, mag: cl.mag, spd: cl.spd, w: 0, a: 0, bo: 0, pro: 0, cover: 0, guard: false, actor: this.newActor(this.jobSheet(job, v, lead)) };
    // recruits arrive at the party's level and with comparable gear
    if (this.party.length) {
      const lv = Math.round(this.avgLv()), gt = Math.floor(this.party.reduce((s, x) => s + x.w + x.a, 0) / this.party.length / 2);
      while (h.lv < lv) this.levelUp(h);
      h.w = h.a = gt; h.hp = h.max; h.mp = h.mmp;
    }
    return h;
  }
  jobSheet(job, v, lead) {
    if (lead && this.skin.heroName) return this.skin.crystal(0, 'Fantasy', DIR4);
    const s = (((this.post.seed || 1) >>> 0) % 997) + v * 31 + 1, o = S.options;
    const char = S.setCharacter({ job, hairColor: o.hairColor[s % o.hairColor.length], ...(job === 'Black Mage' ? {} : { skin: SKINS[(s >> 2) % SKINS.length] }) }, s);
    return crystalSheet(s, { char, dirs: DIR4 });
  }
  pendHero(i) { return this.pend[i] || (this.pend[i] = this.makeHero(this.story.rec[i])); }
  join(h) { (this.party.length < 4 ? this.party : this.reserve).push(h); this.fixParty(); }
  fixParty() {
    this.party.forEach((h, k) => (h.k = k));
    const L = this.walkers?.[0];
    if (L) this.walkers = this.party.map((_, k) => this.walkers[k] || { x: L.x, y: L.y, fx: L.fx, fy: L.fy, face: 1 });
  }
  levelUp(h) {
    h.lv++;
    const [gh, gm, ga, gd, gg, gs] = h.cl.g, j = () => this.r(0.8, 1.25);
    const dh = Math.round(gh * j()); h.max += dh; h.hp += dh; const dm = Math.round(gm * j()); h.mmp += dm; h.mp += dm;
    h.atk += ga * j(); h.def += gd * j(); h.mag += gg * j(); h.spd += gs * j();
    return h.cl.skills.find(([, l]) => l === h.lv)?.[0];
  }
  avgLv() { return this.party.reduce((a, h) => a + h.lv, 0) / Math.max(1, this.party.length); }
  atkOf(u) { return u.hero ? u.atk + u.w * (u.cl.mage ? 1 : 3) : u.atk; }
  magOf(u) { return u.hero ? u.mag + (u.cl.mage ? u.w * 2.5 : 0) : u.mag; }
  defOf(u) { return u.hero ? u.def + u.a * (u.cl.mage ? 1.5 : 2) : u.def; }
  hpRatio() { return this.party.reduce((a, h) => a + h.hp, 0) / this.party.reduce((a, h) => a + h.max, 0); }
  mpLow() { const m = this.party.filter((h) => h.cl.mage); return m.length > 0 && m.every((h) => h.mp < h.mmp * 0.3); }
  emoteParty(name, secs, lead = false) { for (const h of lead ? [this.party[0]] : this.party) if (h.hp > 0) h.actor.emote(name, secs); }
  // ---------------------------------------------------------------- dialogue: [speaker, text, emote] lines and F(callback) steps
  talk(lines, then) { this.sayQ.push(...lines.filter(Boolean)); if (then) this.sayQ.push(F(then)); if (!this.say) this.nextLine(); }
  msg(who, s, then) { this.talk([[who, s]], then); }
  nextLine() {
    this.say = null;
    while (this.sayQ.length && !this.say) {
      const [sp, s, e, f] = this.sayQ.shift();
      if (f) { f(); continue; }
      const t = this.auto ? Math.min(4.4, 1.4 + s.length * 0.034) : 30;
      this.say = { sp, who: typeof sp === 'string' ? sp : sp?.name || '', s, t, t0: t };
      if (e && sp?.actor) sp.actor.emote(e, Math.min(t, 3));
    }
  }
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
    const t0 = pick((i) => map[i] === GRASS && Math.hypot((i % N) - N / 2, ((i / N) | 0) - N / 2) < 16);
    const dist = this.flood(map, t0), maxD = Math.max(...land.map((i) => dist[i])), placed = [t0];
    // a site near a given walking distance from the start, spaced from the others
    const site = (want, gap, pref) => {
      let bi = -1, bv = 1e9;
      for (let n = 0; n < 220; n++) {
        const i = land[Math.floor(R() * land.length)], x = i % N, y = (i / N) | 0;
        if (map[i] === TOWN || map[i] === CAVE || map[i] === MOUNT || placed.some((p) => Math.abs((p % N) - x) + Math.abs(((p / N) | 0) - y) < gap)) continue;
        const v = Math.abs(dist[i] - want) - (pref.includes(map[i]) ? 3 : 0);
        if (v < bv) { bv = v; bi = i; }
      }
      if (bi < 0) bi = pick((i) => map[i] !== TOWN && map[i] !== CAVE && !placed.includes(i));
      placed.push(bi); return bi;
    };
    const s = (this.post.seed || 1) + this.world * 977, st = this.story;
    const ts = [t0, site(maxD * 0.36, 10, [GRASS]), site(maxD * 0.68, 10, [GRASS, SAND])];
    this.towns = ts.map((i, k) => { map[i] = TOWN; return { x: i % N, y: (i / N) | 0, k, name: `${creatureName(s + k * 13)} ${['Village', 'Port', 'Haven'][k]}` }; });
    const ds = [0.16, 0.38, 0.6, 0.82].map((f) => site(maxD * f, 8, [HILL, FOREST])).sort((a, b) => dist[a] - dist[b]);
    ds.push(site(maxD * 1.05, 8, [HILL, MOUNT]));
    this.dungeons = ds.map((j, i) => {
      map[j] = CAVE; const k = this.world * 5 + i;
      return { x: j % N, y: (j / N) | 0, i, k, lv: Math.round(2 + k * 2.6), floors: [2, 2, 3, 3, 3][i], done: false, locked: i === 4, name: i === 4 ? st.cit : `${DNAME[(s + i) % DNAME.length]} of ${creatureName(s * 7 + i * 31)}` };
    });
    this.wm = map;
    const road = (a, b) => { const p = this.findRoute(N, (j) => this.passW(map[j]), a % N, (a / N) | 0, (j) => j === b); for (const [x, y] of p || []) { const j = y * N + x; if (map[j] !== TOWN && map[j] !== CAVE) map[j] = ROAD; } };
    road(ts[0], ts[1]); road(ts[1], ts[2]); road(ts[0], ds[0]);
    this.mini = null; this.lastTown = this.towns[0]; this.dg = null; this.mode = 'world';
    this.place(this.towns[0].x, this.towns[0].y);
    this.label = { s: this.towns[0].name, t: 2.5 };
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
  place(x, y) { this.walkers = this.party.map(() => ({ x, y, fx: x, fy: y, face: 1 })); this.route = []; this.arrive = false; }
  townAt(x, y) { return this.towns.find((t) => t.x === x && t.y === y) || null; }
  bossOf(d) {
    if (!d.bs) {
      const sp = (this.post.seed || 1) * 131 + d.k * 17 + 999, dread = d.i !== 4 && hash(sp) % 100 < 45;
      const art = dread ? horror(sp >>> 0, 48, { kind: ['demon', 'abom', 'spider', 'wraith'][hash(hash(sp) ^ 0x9e3779b9) % 4], tier: Math.min(3, 2 + (d.i >> 1)) }) : monster(sp, this.skin.hue + 150 + (sp % 5) * 40, 40, Math.min(4, 2 + (d.i >> 1)));
      const el = art.horror ? HEL[art.element] || 'shadow' : art.element || 'beast';
      d.bs = { art, el, name: d.i === 4 ? `${this.story.vname} Unbound` : art.horror ? `${creatureName(sp).split(' ')[0]} ${art.name.split(' ').pop()}, ${EPI[el] || 'the Dread'}` : `${(art.name || creatureName(sp)).split(' ')[0]}, ${EPI[el] || 'the Dread'}` };
    }
    return d.bs;
  }
  // ---------------------------------------------------------------- dungeons
  enterDungeon(d) {
    this.dg = { d, floor: 0 }; this.mode = 'dungeon'; this.genFloor(); this.cast = [];
    const st = this.story, p = this.party, a = p[0], b = p[1 % p.length], c = p[p.length - 1];
    this.talk(d.seen ? [[a, `Back into the ${d.name}. Stay sharp.`, 'nod']] : d.i === 4 ? [
      [a, `The ${d.name}… ${st.vname} is waiting at the top.`, 'think'], [c, 'No turning back now.', 'angry']
    ] : [
      [a, `So this is the ${d.name}. The ${st.relics[d.i]} must be inside.`, 'think'],
      [b, ['I hear something breathing down there…', 'Smells like old bones and bad ideas.', 'Stay close. Watch the shadows.', 'Light the torches. Let\'s finish this.'][d.i], ['surprise', 'laugh', 'think', 'nod'][d.i]]
    ]);
    d.seen = true;
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
    const last = g.floor === d.floors - 1, others = rooms.slice(1).filter((r) => r !== far).sort(() => this.rng() - 0.5);
    g.boss = last ? { x: far.cx, y: far.cy } : null;
    if (!last) map[far.cy * DN + far.cx] = 2;
    // a captive recruit waits in a cell on the last floor of some dungeons
    const ci = d.i === 1 ? 1 : d.i === 3 && this.story.mid !== 'redeemed' ? 3 : -1;
    g.cell = last && ci >= 0 && this.story.rec[ci] && !this.met[ci] && others.length ? { x: others[0].cx, y: others[0].cy, h: this.pendHero(ci), i: ci } : null;
    g.chests = [];
    for (const r of others.slice(g.cell ? 1 : 0, 4)) {
      const x = r.x + this.ri(0, r.w - 1), y = r.y + (this.rng() < 0.5 ? 0 : r.h - 1);
      if (x !== r.cx || y !== r.cy) g.chests.push({ x, y, open: false });
    }
    g.map = map; g.seen = new Uint8Array(DN * DN); g.rooms = rooms;
    g.wallTex = this.texK(9 + d.k); g.floorTex = this.texK(12 + d.k + g.floor);
    this.place(st.cx, st.cy); this.reveal();
    this.label = { s: `${d.name} · ${d.i === 4 ? `${g.floor + 1}F` : `B${g.floor + 1}F`}`, t: 2 };
  }
  reveal() {
    const g = this.dg, w = this.walkers[0];
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const x = w.x + dx, y = w.y + dy; if (x >= 0 && y >= 0 && x < DN && y < DN && dx * dx + dy * dy <= 27) g.seen[y * DN + x] = 1; }
  }
  passD(i) { return this.dg.map[i] > 0 && this.dg.seen[i]; }
  openChest(ch) {
    ch.open = true; const r = this.rng(), G = this.dg.d.k;
    let s;
    if (r < 0.4) { const n = Math.round((25 + this.dg.d.lv * 10) * this.r(0.8, 1.3)); this.gold += n; s = `${n} gold!`; }
    else if (r < 0.62) { const n = this.ri(1, 2); this.inv.potion += n; s = `${n} Potion${n > 1 ? 's' : ''}!`; }
    else if (r < 0.74) { this.inv.ether++; s = 'an Ether!'; }
    else if (r < 0.82) { this.inv[r < 0.78 ? 'phoenix' : 'tent']++; s = r < 0.78 ? 'a Phoenix Down!' : 'a Tent!'; }
    else {
      const h = this.party[this.ri(0, this.party.length - 1)], kind = this.rng() < 0.5 ? 'w' : 'a', t = Math.min(11, Math.max(kind === 'w' ? h.w : h.a, G) + 1), [stat, a0, a1] = this.gearStat(h, kind, t);
      if (kind === 'w') h.w = Math.max(h.w, t); else h.a = Math.max(h.a, t);
      s = `${GEAR[t]} ${kind === 'w' ? h.cl.wk : h.cl.ak}! ${h.name}'s ${stat} ${a0}→${Math.max(a0, a1)}.`;
    }
    this.score += 20; this.burst(W / 2, H / 2 - 20, this.col(1), 18, 140);
    this.talk([['Treasure chest', `Found ${s}`]]);
    this.emoteParty(r < 0.82 ? 'cheer' : 'love', 1.4, true); for (const h of this.party.slice(1)) h.actor.emote('surprise', 0.7);
  }
  rescue(g) {
    const { h, i } = g.cell, a = this.party[0], st = this.story; g.cell = null; this.met[i] = true; this.route = [];
    h.actor.face('S');
    this.talk([
      [h, ['You came! I thought I would rot in this cell.', 'Finally! The jailer lost the key three days ago.', 'Quick, before the guards come back!'][this.ri(0, 2)], 'surprise'],
      [h, `I'm ${h.name}, a ${h.job}. ${st.vname}'s beasts dragged me here. Let me repay you.`, 'love'],
      [a, 'Welcome aboard!', 'nod'],
      F(() => { this.join(h); h.actor.emote('cheer', 1.5); this.label = { s: `${h.name} the ${h.job} joins!`, t: 2.5 }; })
    ]);
  }
  bossIntro(d) {
    this.route = [];
    const st = this.story, p = this.party, a = p[0];
    if (d.i === 4) {
      const v = this.villain(), kin = this.kin && p.includes(this.kin) ? this.kin : null; v.actor.face('S');
      return this.talk([
        [v, 'So you climbed all the way up. Do you even know why I fight?', 'think'], [v, st.why, 'sad'],
        kin && [kin, `${st.vname}, please — it's me. Come home. It isn't too late.`, 'sad'],
        kin && [v, 'The twin you knew died long ago. Stand aside.', 'shake'],
        [a, 'Whatever you lost, the world doesn\'t owe you this. It ends here!', 'angry'],
        [v, 'Then come!', 'laugh'], F(() => this.encounter(true))
      ]);
    }
    const bs = this.bossOf(d);
    this.talk([
      [{ name: bs.name, art: bs.art, el: bs.el }, TAUNT[(d.k + this.world) % TAUNT.length].replace('{r}', st.relics[d.i]).replace('{v}', st.vname)],
      [a, d.i === 2 && st.mid === 'redeemed' ? 'Wait… there is something human in its eyes.' : 'Not a chance. Weapons out!', 'angry'],
      F(() => this.encounter(true))
    ]);
  }
  clearDungeon(d) {
    d.done = true; this.cleared++; this.score += 300 * d.lv; this.mode = 'world'; this.dg = null; this.place(d.x, d.y);
    this.burst(W / 2, H / 2, this.col(0), 40, 220);
    for (const h of this.party) h.actor.face('S');
    if (d.i === 4) return this.epilogue();
    const st = this.story, rel = st.relics[d.i], p = this.party, a = p[0], b = p[1 % p.length], v = this.villain(), L = [];
    this.relics = d.i + 1;
    L.push([a, `The ${rel} is ours!`, 'cheer'], F(() => this.emoteParty('cheer', 2)));
    if (d.i === 0) { this.castAt(v, 2, 0, 'W'); L.push([v, `So the little lights found the ${rel}. Keep it warm for me.`, 'laugh'], [b, 'Who was that?!', 'surprise'], [a, `${st.vname}… We'll meet again.`, 'angry']); }
    if (d.i === 1) L.push([b, `Why would anyone want ${st.want}?`, 'think'], [a, 'Whatever the reason, we stop them.', 'nod']);
    if (d.i === 2 && st.mid === 'redeemed' && st.rec[3] && !this.met[3]) {
      const h = this.pendHero(3); this.castAt(h, 1, 0, 'W');
      L.push(['', `As ${this.bossOf(d).name} falls, the curse breaks. A ${h.job} kneels where the beast stood.`], [h, `${st.vname} cursed me into that thing… I'm ${h.name}. Let me make it right.`, 'sad'], [a, 'Then fight beside us.', 'nod'],
        F(() => { this.met[3] = true; this.cast = this.cast.filter((m) => m.n !== h); this.join(h); h.actor.emote('cheer', 1.5); }));
    }
    if (d.i === 3) {
      if (st.fin === 'seal') { this.castAt(v, 2, 0, 'W'); L.push([v, 'At last! The four relics were the locks on my prison. Thank you, heroes.', 'laugh'], ['', `The earth shakes. Far away, the ${st.cit} tears itself out of the ground.`], [a, 'We were used… Then we finish this!', 'angry'], F(() => (this.dungeons[4].locked = false))); }
      else { L.push([a, `All four relics! Let's bring them to ${st.sage} in ${this.towns[0].name}.`, 'cheer']); this.needReturn = true; }
    }
    L.push(F(() => { this.cast = []; this.chap++; this.chapterCard(); }));
    this.talk(L);
  }
  epilogue() {
    const st = this.story, v = this.villain(), p = this.party, a = p[0];
    this.castAt(v, 1, 0, 'W');
    this.talk([
      [v, ['So this is how it ends… Perhaps you were right.', 'I only wanted… to save something.', 'Remember me… as I was before.'][this.world % 3], 'sad'],
      F(() => v.actor.ko()),
      this.kin && p.includes(this.kin) && [this.kin, `Rest now, ${st.vname}. I'll carry your name.`, 'sad'],
      ['', `The relics blaze with light: ${st.heal}.`],
      [a, 'We did it… We actually did it!', 'cheer'], F(() => this.emoteParty('cheer', 3)),
      [p[1 % p.length], 'So… where to next?', 'laugh'],
      ['', 'And so the light returned. But far across the sea, a new shadow stirs…'],
      F(() => { this.cast = []; this.chap = 5; this.card = { s: 'The End', sub: `Book ${this.world + 2} begins…`, t: 3.4, max: 3.4, then: () => { this.world++; this.saga(); } }; })
    ]);
  }
  // ---------------------------------------------------------------- towns, shops, inn
  storyTown() {
    const st = this.story, c = this.chap;
    if (this.needReturn) return this.towns[0];
    if (c >= 1 && c < 4 && st.rec[0] && !this.met[0]) return this.towns[1];
    if (c >= 2 && c < 4 && ((st.rec[2] && !this.met[2]) || (st.mid === 'kin' && !this.kinTold))) return this.towns[2];
    return null;
  }
  townBeats(tw) {
    const st = this.story, p = this.party, a = p[0], b = p[1 % p.length], L = [];
    const i = tw.k === 1 && this.chap >= 1 ? 0 : tw.k === 2 && this.chap >= 2 ? 2 : -1;
    if (i >= 0 && st.rec[i] && !this.met[i]) {
      const h = this.pendHero(i); this.met[i] = true; h.actor.face('S');
      if (i === 0) this.kinH = h;
      L.push([h, `You're the ones hunting ${st.vname}'s beasts? I'm ${h.name}.`, 'wave'], [h, HELLO[h.job], 'nod'], [a, `Glad to have you, ${h.name}.`, 'cheer'], F(() => { this.join(h); h.actor.face('N'); this.label = { s: `${h.name} the ${h.job} joins!`, t: 2.5 }; }));
    }
    if (tw.k === 2 && this.chap >= 2 && st.mid === 'kin' && !this.kinTold && p.length > 1) {
      const k = this.kinH && (p.includes(this.kinH) || this.reserve.includes(this.kinH)) ? this.kinH : p[p.length - 1];
      this.kinTold = true; this.kin = k;
      L.push([k, `There's something I have to tell you… ${st.vname} is my twin.`, 'sad'], [a, 'What?!', 'surprise'], [k, 'I left home to stop them. I still hope they can be saved.', 'think'], [a, 'Then we save them if we can — and stop them if we must.', 'nod']);
    }
    if (this.needReturn && tw.k === 0) {
      const sg = this.sage(), v = this.villain();
      L.push([sg, 'You found all four! Quickly now, give them to me…', 'love'], [a, 'Here — wait. Your hands… they are ice cold.', 'surprise'],
        ['', `${st.sage}'s smile twists. The old face ripples and melts away—`], [v, `Fools! ${st.sage} died years ago. It was ${st.vname} all along!`, 'laugh'],
        [v, `Thank you for gathering my relics. Now nothing can stop me ${st.want.replace(/^to /, 'from going ')}.`, 'laugh'], [b, 'Give them back!', 'angry'],
        ['', `${st.vname} vanishes with the relics. Far away, the ${st.cit} tears itself out of the ground.`], F(() => { this.needReturn = false; this.dungeons[4].locked = false; }));
    }
    return L;
  }
  visitTown(tw) {
    this.lastTown = tw; this.mode = 'town'; this.route = []; this.cast = [];
    const k = this.keeper(tw);
    this.tw = { town: tw, tab: 0, hl: -1, stage: 0, t: 0.9, px: 180, night: 0 };
    for (const h of this.party) { if (h.actor.isKO) h.actor.revive(); h.actor.face('N'); }
    k.actor.emote('wave', 1.5);
    const L = this.townBeats(tw);
    if (L.length) this.talk(L); else this.label = { s: `Welcome to ${tw.name}`, t: 1.6 };
  }
  leaveTown() { this.mode = 'world'; this.tw = null; this.grace = 4; this.shopGold = this.gold; this.think = 0.4; for (const h of this.party) h.actor.face('S'); }
  innCost() { return 10 + (this.world * 5 + Math.min(4, this.chap)) * 8; }
  shopTier(tw) { return Math.min(11, 1 + this.world * 5 + Math.min(4, this.chap) + (tw.k === 2 ? 1 : 0)); }
  keep() { return 25 + (this.world * 5 + Math.min(4, this.chap)) * 20; }
  rest() {
    const c = this.innCost(); if (this.gold < c) return;
    this.gold -= c; for (const h of [...this.party, ...this.reserve]) { h.hp = h.max; h.mp = h.mmp; if (h.actor.isKO) h.actor.revive(); }
    this.tw.night = 1.3; this.emoteParty('love', 1.6); this.label = { s: 'HP and MP fully restored', t: 1.6 };
  }
  buyItem(k) { const c = ITEMS[k][1]; if (this.gold < c) return; this.gold -= c; this.inv[k]++; this.keeper(this.tw.town).actor.emote('nod', 0.8); }
  gearOffer(h, kind, budget = this.gold) {
    const cur = kind === 'w' ? h.w : h.a, top = this.shopTier(this.tw.town);
    if (cur >= top) return null;
    for (let t = top; t > cur; t--) if (price(kind, t) <= budget) return { t, cost: price(kind, t), ok: true };
    return { t: cur + 1, cost: price(kind, cur + 1), ok: false };
  }
  gearStat(h, kind, t) {
    const key = kind === 'w' ? 'w' : 'a', old = h[key], f = () => Math.round(kind === 'w' ? (h.cl.mage ? this.magOf(h) : this.atkOf(h)) : this.defOf(h));
    const a0 = f(); h[key] = t; const a1 = f(); h[key] = old;
    return [kind === 'w' ? (h.cl.mage ? 'MAG' : 'ATK') : 'DEF', a0, a1];
  }
  buyGear(h, kind, t) {
    const c = price(kind, t); if (this.gold < c) return;
    const [stat, a0, a1] = this.gearStat(h, kind, t);
    this.gold -= c; if (kind === 'w') h.w = t; else h.a = t;
    const [x, y] = this.townPos(h);
    this.pops.push({ x, y: y - 62, s: `+${a1 - a0} ${stat}`, col: kind === 'w' ? '#ffd23a' : '#9ad0ff', life: 1.4 });
    this.burst(x, y - 30, this.col(1), 10, 80); h.actor.emote(this.rng() < 0.5 ? 'cheer' : 'love', 1.2); this.keeper(this.tw.town).actor.emote('nod', 0.8);
    this.label = { s: `${h.name}: ${GEAR[t]} ${kind === 'w' ? h.cl.wk : h.cl.ak}`, t: 1.4 };
  }
  swap(inH, outH) {
    const i = this.party.indexOf(outH); if (i < 1) return;
    this.party[i] = inH; this.reserve = this.reserve.filter((x) => x !== inH); this.reserve.push(outH); this.fixParty();
    inH.actor.face('N'); inH.actor.emote('wave', 1.2); this.label = { s: `${inH.name} swaps in for ${outH.name}`, t: 1.6 };
  }
  bestSwap() {
    if (!this.reserve.length) return null;
    const sc = (h, set) => h.lv * 10 + (h.w + h.a) * 3 + (h.job === 'White Mage' && !set.some((x) => x !== h && x.job === 'White Mage') ? 60 : 0) + (h.job === 'Black Mage' ? 12 : 0);
    let best = null;
    for (const r of this.reserve) for (const o of this.party.slice(1)) {
      const set = this.party.map((x) => (x === o ? r : x)), gain = sc(r, set) - sc(o, this.party);
      if (gain > 8 && (!best || gain > best.gain)) best = { r, o, gain };
    }
    return best;
  }
  bestGear() {
    let best = null; const budget = this.gold - this.keep();
    this.party.forEach((h, row) => {
      for (const kind of ['w', 'a']) {
        const o = this.gearOffer(h, kind, budget); if (!o?.ok) continue;
        const v = (o.t - (kind === 'w' ? h.w : h.a)) * (kind === 'w' ? (h.job === 'White Mage' ? 1 : 3) : h.cl.mage ? 2.5 : 2);
        if (!best || v > best.v) best = { h, kind, t: o.t, row, v };
      }
    });
    return best;
  }
  bestItem() {
    const G = this.world * 5 + Math.min(4, this.chap), mage = this.party.some((h) => h.cl.mage), want = { potion: Math.min(10, 4 + G), ether: mage ? Math.min(5, 1 + (G >> 1)) : 0, phoenix: Math.min(3, 1 + (G >= 2) + (G >= 4)), tent: G >= 1 ? 1 + (G >= 3) : 0 };
    for (const k of ['potion', 'phoenix', 'ether', 'tent']) if (this.inv[k] < want[k] && this.gold >= ITEMS[k][1] + this.innCost()) return k;
    return null;
  }
  // one shopping step at a time, so you can watch the party spend
  autoShop(dt) {
    const tw = this.tw;
    if ((tw.t -= dt) > 0) return;
    tw.t = 0.55;
    if (tw.stage === 0) { tw.stage = 1; const c = this.innCost(); if (this.gold >= c && [...this.party].some((h) => h.hp < h.max * 0.95 || h.mp < h.mmp * 0.9)) { tw.tab = 0; tw.hl = 0; this.rest(); tw.t = 1.3; return; } }
    if (tw.stage === 1) { const s = this.bestSwap(); if (s) { tw.tab = 4; tw.hl = this.party.length + this.reserve.indexOf(s.r); this.swap(s.r, s.o); return; } tw.stage = 2; }
    if (tw.stage === 2) { const g = this.bestGear(); if (g) { tw.tab = g.kind === 'w' ? 2 : 3; tw.hl = g.row; this.buyGear(g.h, g.kind, g.t); tw.t = 0.8; return; } tw.stage = 3; }
    if (tw.stage === 3) { const k = this.bestItem(); if (k) { tw.tab = 1; tw.hl = IK.indexOf(k); this.buyItem(k); return; } tw.stage = 4; tw.tab = 5; tw.hl = -1; tw.t = 0.6; return; }
    this.leaveTown();
  }
  townRows() {
    const tw = this.tw, tab = tw.tab;
    if (tab === 0) { const c = this.innCost(); return [{ s: 'Rest for the night', r: `${c}g`, on: this.gold >= c, f: () => this.rest() }]; }
    if (tab === 1) return IK.map((k) => ({ s: ITEMS[k][0], r: `×${this.inv[k]}   ${ITEMS[k][1]}g`, on: this.gold >= ITEMS[k][1], f: () => this.buyItem(k) }));
    if (tab === 2 || tab === 3) {
      const kind = tab === 2 ? 'w' : 'a';
      return this.party.map((h) => {
        const o = this.gearOffer(h, kind), cur = kind === 'w' ? h.w : h.a, nm = kind === 'w' ? h.cl.wk : h.cl.ak;
        if (!o) return { s: `${h.cl.tag} ${GEAR[cur]} ${nm}`, r: 'best in stock', on: false };
        const [stat, a0, a1] = this.gearStat(h, kind, o.t);
        return { s: `${h.cl.tag} ${GEAR[o.t]} ${nm}`, r: `${stat} ${a0}→${a1}  ${o.cost}g`, on: o.ok, f: () => this.buyGear(h, kind, o.t) };
      });
    }
    if (tab === 4) return [...this.party, ...this.reserve].map((h) => ({ s: `${this.party.includes(h) ? '★' : '·'} ${h.name} the ${h.job}`, r: `Lv ${h.lv}`, on: h !== this.party[0] && this.reserve.length > 0, f: () => this.manualSwap(h) }));
    return [];
  }
  manualSwap(h) {
    if (this.reserve.includes(h)) { const out = this.party.slice(1).reduce((a, x) => (x.lv < a.lv ? x : a), this.party[this.party.length - 1]); if (out !== this.party[0]) this.swap(h, out); }
    else if (this.reserve.length) this.swap(this.reserve[0], h);
  }
  townPos(h) { const n = this.party.length, k = this.party.indexOf(h); return [this.tw.px + (k - (n - 1) / 2) * 46, 248]; }
  // ---------------------------------------------------------------- battles
  zoneLv() { return Math.max(1, this.dungeons[Math.min(this.chap, 4)].lv - 1); }
  encounter(boss = false) {
    const dg = this.dg, d = dg?.d, base = dg ? d.lv + dg.floor : this.zoneLv();
    const lv = Math.max(1, boss ? base + 1 : base + this.ri(-1, 0));
    const n = boss ? 1 : this.ri(1, Math.min(4, 2 + (lv >> 2) + (this.party.length > 3 ? 1 : 0)));
    const zone = d ? d.k : this.world * 5 + this.chap, s0 = (this.post.seed || 1) * 131 + zone * 17;
    const foes = boss ? [this.makeBoss(d, lv)] : Array.from({ length: n }, () => this.makeFoe(s0 + this.ri(0, 3), lv));
    this.cast = [];
    this.bt = { foes, boss, from: this.mode, order: [], actor: null, phase: 'intro', wait: boss ? 1.2 : 0.9, msg: boss ? `${foes[0].name} attacks!` : `${n > 1 ? `${n} monsters` : `A ${foes[0].name}`} attack${n > 1 ? '' : 's'}!`, menu: 'main', anim: null, shake: null, msgs: [], round: 0, since: new Set(), flash: 0, quake: 0 };
    this.mode = 'battle'; this.grace = 5;
    // the party lines up facing the monsters (west) and starts at the sight of them
    for (const h of this.party) { h.bo = 0; h.castT = 0; h.pro = h.cover = 0; h.guard = false; if (h.hp > 0 && h.actor.isKO) h.actor.revive(); h.actor.stopCast(); h.actor.face('W'); if (h.hp > 0) h.actor.emote(boss ? 'angry' : 'surprise', 0.9); }
  }
  // a cute creature, or (one in five out in the world, more than half underground) something from the horror forge
  foeArt(sp, lv) {
    const hv = hash(sp * 7 + 3);
    if (hv % 100 < (this.dg ? 55 : 20)) return horror(sp >>> 0, 30, { kind: HKIND[(hv >>> 8) % (lv < 5 ? 5 : HKIND.length)], tier: lv < 6 ? 1 : lv < 14 ? 2 : 3 });
    return monster(sp, this.skin.hue + 150 + (sp % 5) * 40, 16 + (sp % 3) * 3, Math.min(4, lv >> 2));
  }
  makeFoe(sp, lv) {
    const art = this.foeArt(sp, lv), hp = Math.round((14 + lv * 11) * this.r(0.9, 1.1));
    const name = art.horror ? art.name.split(' ').pop() : (art.name || creatureName(sp)).split(' ')[0];
    return { name, lv, hp, max: hp, atk: 3.5 + lv * 2, def: 2 + lv * 1.3, mag: 3 + lv * 1.8, spd: 3 + lv * 0.5 + this.r(0, 3), xp: Math.round(6 + lv * 5), gp: Math.round((6 + lv * 4) * this.r(0.8, 1.2)), art, el: art.horror ? HEL[art.element] || 'shadow' : art.element || 'beast', dead: 0 };
  }
  makeBoss(d, lv) {
    const bs = this.bossOf(d), fin = d.i === 4, hp = Math.round((14 + lv * 11) * (1.6 + this.party.length * 1.2) * (fin ? 0.75 : 1));
    const f = { name: bs.name, lv, hp, max: hp, atk: (3.5 + lv * 2) * 1.3, def: 2 + lv * 1.4, mag: (3 + lv * 1.8) * 1.25, spd: 4 + lv * 0.5, xp: Math.round((6 + lv * 5) * 8), gp: Math.round((6 + lv * 4) * 7), art: bs.art, el: bs.el, boss: true, phase: 1, turns: 0, charge: 0, barrier: 0, special: ['summon', 'drain', 'barrier'][(d.k + (this.post.seed || 1)) % 3], dead: 0 };
    if (fin) { const v = this.villain(); Object.assign(f, { name: this.story.vname, form: 'human', actor: v.actor, el: 'shadow', special: 'drain' }); v.actor.face('E'); }
    f.hp = f.max = bs.hp || (bs.hp = this.bossHp(f, fin ? 3 : d.i ? 4 : 3)); // fixed at the first meeting, so grinding helps
    return f;
  }
  // boss HP: the level formula, or enough to last a few rounds against this party, whichever is more
  bossHp(f, rounds) {
    const dpr = this.party.reduce((a, h) => a + Math.max(this.estAtk(h, f, 1.2), h.job === 'Black Mage' ? this.magOf(h) * 1.7 * 1.7 - f.def * 0.4 : 0), 0);
    return Math.round(Math.max(f.max, dpr * rounds));
  }
  // the villain's second form: a towering spirit
  transform(f) {
    const b = this.bt, st = this.story, v = this.villain(), sp = (this.post.seed || 1) * 977 + this.world * 31 + 4242;
    const art = horror(sp >>> 0, 64, { kind: ['demon', 'wraith', 'abom'][hash(sp) % 3], tier: 3 }), lv = f.lv + 1, hp = Math.round((14 + lv * 11) * (1.6 + this.party.length * 1.2) * 1.1);
    f.transform = false; f.morph = true;
    this.talk([
      [v, 'Enough! You want to see what the relics have made of me? LOOK!', 'angry'],
      F(() => { f.morph = false; Object.assign(f, { form: 'beast', art, el: HEL[art.element] || 'shadow', name: `${st.vname} Unbound`, hp, max: hp, lv, phase: 1, turns: 0, charge: 0, barrier: 0, special: 'summon', dead: 0, mag: f.mag * 1.1, atk: f.atk * 1.1 }); const bs = this.bossOf(this.dg.d); f.hp = f.max = bs.hp2 || (bs.hp2 = this.bossHp(f, 3.5)); b.flash = 1; b.quake = 0.6; b.order = []; b.msg = `${f.name} rises!`; b.wait = 1; this.burst(96, 176, ECOL[f.el] || '#c070ff', 50, 260); this.emoteParty('surprise', 1.2); }),
      [{ name: `${st.vname} Unbound`, art, el: HEL[art.element] || 'shadow' }, 'NOTHING… ENDS… WITHOUT MY SAY!'],
      [this.party[0], 'Hold the line, everyone!', 'angry']
    ]);
  }
  heroPos(k) { return [282 + k * 12, 118 + k * 46 + (4 - this.party.length) * 20]; }
  foePos(f) {
    const b = this.bt, i = b.foes.indexOf(f), n = b.foes.length;
    if (b.boss) return i === 0 ? [96, 176] : [[186, 120], [186, 240], [186, 180]][(i - 1) % 3];
    if (n === 1) return [100, 180];
    return [[70, 135], [145, 170], [70, 220], [145, 255]][i];
  }
  posOf(u) { return u.hero ? this.heroPos(u.k) : this.foePos(u); }
  knows(h, s) { return h.cl.skills.some(([n, l]) => n === s && h.lv >= l); }
  alive(list) { return list.filter((u) => u.hp > 0); }
  nextTurn() {
    const b = this.bt;
    for (let g = 0; g < 20; g++) {
      if (!b.order.length) {
        b.round++;
        for (const h of this.party) { if (h.pro > 0) h.pro--; if (h.cover > 0) h.cover--; }
        const us = [...this.alive(this.party), ...this.alive(b.foes)];
        for (const f of this.alive(b.foes)) if (f.boss && f.phase >= 3) us.push(f); // desperate bosses act twice
        b.order = us.map((u) => [u, u.spd * this.r(0.75, 1.25)]).sort((a, c) => c[1] - a[1]).map((x) => x[0]);
      }
      const a = b.order.shift();
      if (a.hp <= 0) continue;
      if (a.hero) { a.guard = false; b.phase = 'cmd'; b.actor = a; b.menu = 'main'; b.msg = `${a.name} the ${a.job}: your move`; return; }
      return this.act(a, a.boss ? this.bossAI(a) : this.foeAI(a));
    }
  }
  target(al) {
    const cov = al.find((h) => h.cover > 0);
    if (cov && this.rng() < 0.75) return cov;
    const w = al.map((h) => (h.job === 'Knight' ? 1.6 : h.cl.mage ? 0.85 : 1)), tot = w.reduce((a, c) => a + c, 0);
    let r = this.r(0, tot);
    for (let i = 0; i < al.length; i++) { r -= w[i]; if (r <= 0) return al[i]; }
    return al[0];
  }
  foeAI(f) {
    const al = this.alive(this.party);
    if (f.lv >= 4 && this.rng() < 0.15) return { k: 'zap', t: al[this.ri(0, al.length - 1)] };
    return { k: 'atk', t: this.target(al) };
  }
  // bosses: phases at 60% and 30% HP; a telegraphed big attack lands only after every hero has had a turn to brace
  bossAI(f) {
    const b = this.bt, al = this.alive(this.party);
    f.turns++; if (f.barrier) f.barrier--;
    if (f.charge) {
      if (al.every((h) => b.since.has(h))) { f.charge = 0; return { k: 'big' }; }
      return { k: 'gather', more: 1 };
    }
    if (f.turns % [0, 5, 4, 3][f.phase] === 0) { f.charge = 1; b.since = new Set(); return { k: 'gather' }; }
    if (f.phase >= 2 && f.turns % (f.special === 'barrier' ? 6 : 3) === 1 && (f.special !== 'summon' || this.alive(b.foes).length < 3) && (f.special !== 'barrier' || !f.barrier)) return { k: f.special };
    if (f.phase >= 2 && this.rng() < 0.25) return { k: 'breath' };
    if (this.rng() < 0.3) return { k: 'zap', t: al[this.ri(0, al.length - 1)] };
    return { k: 'atk', t: this.target(al) };
  }
  elMult(el, t) { return !el || t.hero ? 1 : WEAK[t.el] === el ? 1.6 : t.el === el ? 0.5 : 1; }
  strike(a, t, mult = 1, el = null, crit = false) {
    const c = crit || this.rng() < (a.job === 'Thief' ? 0.15 : 0.07), at = this.atkOf(a);
    let n = Math.max(at * 0.3, at * 1.9 - this.defOf(t)) * this.r(0.85, 1.1) * mult * (c ? 1.7 : 1) * this.elMult(el, t);
    if (t.barrier) n *= 0.35;
    this.hurt(t, n, c ? '#ffd23a' : '#fff', el && WEAK[t.el] === el);
  }
  hurt(t, n, col, weak) {
    const b = this.bt;
    if (t.hero) { if (t.guard) n *= 0.5; if (t.pro) n *= 0.65; }
    n = Math.max(1, Math.round(n)); t.hp = Math.max(0, t.hp - n);
    const [x, y] = this.posOf(t);
    this.pops.push({ x: x + this.r(-8, 8), y: y - 20, s: weak ? `${n} WEAK` : `${n}`, col: col || '#fff', life: 1 });
    b.shake = { u: t, t: 0.3 };
    if (t.hero) { if (t.hp <= 0) t.actor.ko(); else t.actor.hurt(); }
    else if (t.actor && t.hp > 0) t.actor.hurt();
    if (t.boss && t.hp > 0) {
      const ph = t.hp < t.max * 0.3 ? 3 : t.hp < t.max * 0.6 ? 2 : 1;
      if (ph > t.phase) { const nm = t.name.split(',')[0]; t.phase = ph; b.note = ph === 2 ? `${nm} is enraged! New attacks unlocked…` : `${nm} is desperate — it acts twice a round!`; b.flash = 0.4; }
    }
    if (t.hp <= 0) {
      this.burst(x, y, t.hero ? this.col(3) : this.col(0), t.boss ? 40 : 14, t.boss ? 240 : 150);
      if (t.hero) b.order = b.order.filter((u) => u !== t);
      else if (t.boss && t.form === 'human') t.transform = true;
      else if (t.boss) for (const m of b.foes) if (m !== t && m.hp > 0) m.hp = 0; // minions flee when the boss falls
    }
  }
  heal(t, n) { n = Math.round(n); t.hp = Math.min(t.max, t.hp + n); const [x, y] = this.posOf(t); this.pops.push({ x, y: y - 20, s: `+${n}`, col: '#7dffa8', life: 1 }); }
  revive(t, f) { t.hp = Math.max(1, Math.round(t.max * f)); t.actor.revive(); t.actor.emote('love', 0.8); const [x, y] = this.posOf(t); this.pops.push({ x, y: y - 20, s: 'Revived!', col: '#fff3a0', life: 1.2 }); this.burst(x, y, '#fff3a0', 16, 100); }
  act(a, ch) {
    const b = this.bt;
    b.phase = 'act'; b.wait = this.auto ? 0.7 : 0.9; b.actor = a.hero ? a : null; b.hl = a.hero ? { atk: 0, spell: 1, item: 2, defend: 3, run: 4 }[ch.k] : -1;
    if (a.hero) b.since.add(a);
    else { b.anim = { u: a, t: 0.5, k: ch.k }; if (a.actor) { if (ch.k === 'atk') a.actor.attack(); else a.actor.cast(); a.castT = 0.7; } }
    // heroes step forward, swing / cast / throw, and the effect lands on the animation's event (see heroSeq)
    if (a.hero && ch.k !== 'run' && ch.k !== 'defend') {
      const sp = ch.k === 'spell' && SK[ch.s], anim = ch.k === 'item' ? 'shoot' : ch.k === 'atk' || sp.phys || sp.steal ? (a.cl.bow ? 'shoot' : 'attack') : 'cast';
      b.seq = { h: a, ch, anim, st: 'adv', t: 0 };
      b.msg = ch.k === 'atk' ? `${a.name} attacks!` : ch.k === 'spell' ? `${a.name} ${anim === 'cast' ? 'begins to cast' : 'uses'} ${ch.s}…` : `${a.name} throws a${ch.it === 'ether' ? 'n' : ''} ${ITEMS[ch.it || 'potion'][0]}!`;
      return;
    }
    this.resolve(a, ch);
  }
  resolve(a, ch) {
    const b = this.bt, foesA = this.alive(b.foes), herosA = this.alive(this.party), enemies = a.hero ? foesA : herosA;
    const pick = (t, pool) => (t && t.hp > 0 ? t : pool[this.ri(0, pool.length - 1)]);
    if (ch.k === 'spell') return this.castSpell(a, ch);
    if (ch.k === 'item') return this.useItem(a, ch);
    if (ch.k === 'defend') { a.guard = true; b.msg = `${a.name} braces for impact.`; a.actor.emote('nod', 0.6); b.wait = 0.5; return; }
    if (ch.k === 'run') {
      if (b.boss) b.msg = 'There is no escape!';
      else if (this.rng() < 0.65) { b.msg = 'The party got away!'; b.phase = 'fled'; b.wait = 0.8; }
      else { b.msg = 'Couldn\'t escape!'; a.actor.emote('sad', 0.6); }
      return;
    }
    if (!enemies.length) return;
    const el = a.el || 'shadow', col = ECOL[el] || '#c070ff', nm = a.name.split(',')[0];
    if (ch.k === 'atk') { const t = pick(ch.t, enemies); b.msg = `${a.name} attacks ${t.name}!`; this.strike(a, t, 1); }
    else if (ch.k === 'zap') { const t = pick(ch.t, herosA); b.msg = `${a.name} uses ${ZAP[el] || 'Hex'} on ${t.name}!`; this.hurt(t, a.mag * 1.6 * this.r(0.85, 1.1) - this.defOf(t) * 0.3, col); const [x, y] = this.posOf(t); this.burst(x, y, col, 10, 110); }
    else if (ch.k === 'breath') { b.msg = `${a.name} lashes out at the whole party!`; for (const t of herosA) { this.hurt(t, a.mag * 1.1 * this.r(0.85, 1.1) - this.defOf(t) * 0.3, col); const [x, y] = this.posOf(t); this.burst(x, y, col, 8, 100); } }
    else if (ch.k === 'gather') { b.msg = ch.more ? `${nm}'s power keeps swelling…` : `⚠ ${nm} is gathering power — brace!`; const [x, y] = this.posOf(a); this.burst(x, y, col, 24, 60); b.wait = 1; }
    else if (ch.k === 'big') {
      b.msg = `${nm} unleashes ${BIG[el] || 'Doom'}!`; b.flash = 0.7; b.quake = 0.6;
      for (const t of herosA) { this.hurt(t, a.mag * 2.9 * this.r(0.9, 1.1) - this.defOf(t) * 0.3, col); const [x, y] = this.posOf(t); this.burst(x, y, col, 20, 180); }
      b.wait = 1.1;
    } else if (ch.k === 'summon') {
      b.foes = b.foes.filter((f) => f === a || f.hp > 0);
      for (let k = 0; k < 2 && b.foes.length < 4; k++) b.foes.push(this.makeFoe((this.post.seed || 1) * 131 + (this.dg?.d.k || 0) * 17 + this.ri(0, 3), Math.max(1, a.lv - 2)));
      b.msg = `${nm} calls its brood to fight!`; this.burst(186, 180, col, 20, 120);
    } else if (ch.k === 'drain') {
      const t = pick(null, herosA), h0 = t.hp; b.msg = `${nm} drains ${t.name}'s life!`;
      this.hurt(t, a.mag * 1.5 - this.defOf(t) * 0.3, '#c070ff'); this.heal(a, h0 - t.hp);
    } else if (ch.k === 'barrier') { a.barrier = 2; b.msg = `A barrier shields ${nm}! Physical blows weakened.`; b.wait = 1; }
  }
  castSpell(a, ch) {
    const b = this.bt, sp = SK[ch.s], herosA = this.alive(this.party);
    a.mp -= sp.mp; b.msg = `${a.name}: ${ch.s}!`;
    const [hx, hy] = this.heroPos(a.k); this.burst(hx + a.bo - 14, hy - 6, sp.col, 10, 70);
    if (sp.heal !== undefined) {
      for (const t of sp.self ? [a] : sp.all ? herosA : [ch.t && ch.t.hp > 0 ? ch.t : this.lowest(herosA)]) { this.heal(t, sp.self ? t.max * 0.35 : this.magOf(a) * sp.heal * 1.6 + 8); const [x, y] = this.posOf(t); this.burst(x, y, sp.col, 10, 90); }
    } else if (sp.raise) { const t = ch.t && ch.t.hp <= 0 ? ch.t : this.party.find((x) => x.hp <= 0); if (t) this.revive(t, 0.4); }
    else if (sp.buff) { b.msg = `${a.name} casts Protect on the party!`; for (const t of herosA) { t.pro = 3; const [x, y] = this.posOf(t); this.burst(x, y, sp.col, 8, 60); } }
    else if (sp.cover) { a.cover = 3; a.guard = true; b.msg = `${a.name} shields the party!`; }
    else {
      for (let i = 0; i < (sp.hits || 1); i++) {
        const pool = this.alive(b.foes); if (!pool.length) break;
        const tg = sp.all ? pool : [sp.hits ? pool[this.ri(0, pool.length - 1)] : ch.t && ch.t.hp > 0 ? ch.t : pool[0]];
        for (const t of tg) {
          if (sp.phys) this.strike(a, t, sp.phys, sp.el, sp.crit);
          else if (!sp.steal) this.hurt(t, this.magOf(a) * sp.pow * 1.7 * this.r(0.9, 1.1) * this.elMult(sp.el, t) - t.def * 0.4, sp.col, WEAK[t.el] === sp.el);
          const [x, y] = this.posOf(t); this.burst(x, y, sp.col, 10, 120);
        }
      }
      if (sp.steal) this.steal(a, ch.t || this.alive(b.foes)[0] || b.foes[0]);
    }
  }
  steal(a, t) {
    const b = this.bt;
    if (!t || t.robbed) { b.msg = `${a.name}: nothing left to steal.`; return; }
    if (this.rng() > (t.boss ? 0.45 : 0.7)) { b.msg = `${a.name} couldn't steal anything.`; return; }
    t.robbed = true; const r = this.rng(); let s;
    if (r < 0.5) { const n = Math.round(t.lv * 7 + 10); this.gold += n; s = `${n} gold`; }
    else { const k = r < 0.8 ? 'potion' : r < 0.93 ? 'ether' : 'phoenix'; this.inv[k]++; s = `a${k === 'ether' ? 'n' : ''} ${ITEMS[k][0]}`; }
    b.msg = `${a.name} stole ${s}!`; a.actor.emote('laugh', 0.8);
    const [x, y] = this.posOf(t); this.pops.push({ x, y: y - 34, s: `Stole ${s}!`, col: '#e0d070', life: 1.2 });
  }
  useItem(a, ch) {
    const b = this.bt, it = ch.it || 'potion', herosA = this.alive(this.party);
    if (this.inv[it] <= 0) { b.msg = 'Out of items!'; return; }
    this.inv[it]--;
    let t;
    if (it === 'phoenix') { t = ch.t && ch.t.hp <= 0 ? ch.t : this.party.find((x) => x.hp <= 0); if (t) this.revive(t, 0.35); }
    else if (it === 'ether') { t = ch.t && ch.t.hp > 0 ? ch.t : a; const n = Math.min(t.mmp - t.mp, 25 + t.lv * 2); t.mp += n; const [x, y] = this.posOf(t); this.pops.push({ x, y: y - 20, s: `+${n} MP`, col: '#9cc8ff', life: 1 }); }
    else { t = ch.t && ch.t.hp > 0 ? ch.t : this.lowest(herosA); this.heal(t, t.max * 0.45 + 20); }
    b.msg = t ? `${a.name} uses ${ITEMS[it][0]} on ${t.name}.` : `${a.name}'s ${ITEMS[it][0]} has no effect.`;
  }
  lowest(list) { return list.reduce((a, c) => (c.hp / c.max < a.hp / a.max ? c : a), list[0]); }
  estAtk(a, t, mult, el) { return Math.max(this.atkOf(a) * 0.3, this.atkOf(a) * 1.9 - this.defOf(t)) * mult * this.elMult(el, t) * (t.barrier ? 0.35 : 1); }
  // autopilot battle choices: revive, brace for telegraphed attacks, heal, exploit weaknesses, steal, save MP on small fry
  aiPick(h) {
    const b = this.bt, al = this.alive(this.party), dead = this.party.filter((x) => x.hp <= 0), foes = this.alive(b.foes), low = this.lowest(al);
    const can = (s) => this.knows(h, s) && h.mp >= SK[s].mp, boss = foes.find((f) => f.boss), hurt = al.filter((x) => x.hp < x.max * 0.55).length, healer = h.job === 'White Mage';
    if (dead.length && (boss || foes.length > 1)) {
      if (can('Raise')) return { k: 'spell', s: 'Raise', t: dead[0] };
      if (this.inv.phoenix > 0) return { k: 'item', it: 'phoenix', t: dead[0] };
    }
    if (boss?.charge) {
      if (can('Protect') && al.filter((x) => !x.pro).length >= 2) return { k: 'spell', s: 'Protect' };
      if (healer && hurt && can('Cura')) return { k: 'spell', s: 'Cura' };
      if (low.hp < low.max * 0.5) { if (healer && can('Cure')) return { k: 'spell', s: 'Cure', t: low }; if (this.inv.potion > 0) return { k: 'item', it: 'potion', t: low }; }
      return { k: 'defend' };
    }
    if (healer) {
      if (hurt >= 2 && can('Cura')) return { k: 'spell', s: 'Cura' };
      if (low.hp < low.max * 0.5 && can('Cure')) return { k: 'spell', s: 'Cure', t: low };
      if (boss && can('Protect') && al.filter((x) => !x.pro).length >= 2 && this.rng() < 0.4) return { k: 'spell', s: 'Protect' };
    }
    const medic = al.some((x) => x !== h && x.job === 'White Mage' && x.mp >= 5);
    if (low.hp < low.max * (medic ? 0.25 : 0.35) && this.inv.potion > 0 && !(healer && can('Cure'))) return { k: 'item', it: 'potion', t: low };
    if (boss && h.cl.mage && h.mp < h.mmp * 0.2 && this.inv.ether > 0) return { k: 'item', it: 'ether', t: h };
    if (h.job === 'Monk' && h.hp < h.max * 0.45 && can('Chakra')) return { k: 'spell', s: 'Chakra' };
    if (h.job === 'Knight' && boss && can('Cover') && !h.cover && al.some((x) => x.cl.mage && x.hp < x.max * 0.6)) return { k: 'spell', s: 'Cover' };
    if (h.job === 'Thief') { const mark = boss && !boss.robbed ? boss : foes.find((f) => !f.robbed); if (mark && (boss ? mark === boss : this.rng() < 0.35)) return { k: 'spell', s: 'Steal', t: mark }; }
    const weak = foes.reduce((a, c) => (c.hp < a.hp ? c : a), foes[0]), tough = foes.reduce((a, c) => (c.hp > a.hp ? c : a), foes[0]), main = boss || tough;
    let best = { k: 'atk', t: boss || weak, v: this.estAtk(h, boss || weak, 1) };
    for (const [s] of h.cl.skills) {
      const sp = SK[s];
      if (!can(s) || sp.heal !== undefined || sp.raise || sp.buff || sp.cover || (sp.steal && !sp.phys)) continue;
      if (!boss && (h.mp - sp.mp < h.mmp * 0.35 || (tough.hp < this.atkOf(h) * 2.5 && foes.length < 3))) continue; // save MP for the boss
      const tg = sp.all ? foes : [main], est = tg.reduce((a, t) => a + Math.min(t.hp, sp.phys ? this.estAtk(h, t, sp.phys * (sp.hits || 1), sp.el) : Math.max(1, this.magOf(h) * sp.pow * 1.7 * this.elMult(sp.el, t) - t.def * 0.4)), 0);
      if (est > best.v * 1.15) best = { k: 'spell', s, t: tg.length === 1 ? tg[0] : null, v: est };
    }
    return best;
  }
  winBattle() {
    const b = this.bt, xp = b.foes.reduce((a, f) => a + f.xp, 0), gp = b.foes.reduce((a, f) => a + f.gp, 0);
    this.gold += gp; this.score += xp;
    b.msgs = [`Victory! ${xp} XP and ${gp} gold.`];
    for (const h of [...this.party, ...this.reserve]) {
      if (h.hp <= 0) continue;
      const act = this.party.includes(h);
      h.xp += Math.round(xp * (act ? 1 : 0.6));
      while (h.xp >= need(h.lv)) {
        h.xp -= need(h.lv); const sk = this.levelUp(h);
        if (!act) continue;
        b.msgs.push(`${h.name} reached Lv ${h.lv}!${sk ? ` Learned ${sk}!` : ''}`);
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
    for (const h of this.party) { h.bo = 0; h.pro = h.cover = 0; h.guard = false; h.actor.stopCast(); h.actor.revive(); h.actor.face('S'); }
    if (b.phase === 'fled') return;
    if (!b.won) {
      this.gold = Math.floor(this.gold / 2); this.extra = Math.min(3, this.extra + 1);
      for (const h of this.party) { h.hp = h.max; h.mp = h.mmp; }
      this.mode = 'world'; this.dg = null; this.place(this.lastTown.x, this.lastTown.y); this.grace = 8;
      this.emoteParty('sad', 1.4); this.think = 1.4; return;
    }
    for (const h of this.party) if (h.hp <= 0) h.hp = 1;
    if (b.boss) { this.extra = 0; this.clearDungeon(this.dg.d); }
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
    const tf = b.foes.find((f) => f.transform);
    if (tf) return this.transform(tf);
    if (b.note) { b.msg = b.note; b.note = null; b.wait = 1; return; }
    if (!this.alive(b.foes).length) return this.winBattle();
    if (!this.alive(this.party).length) return this.loseBattle();
    this.nextTurn();
  }
  // ---------------------------------------------------------------- walking
  stepWalk(dt) {
    const ws = this.walkers, sp = (this.mode === 'world' ? 6 : 5) * dt;
    for (const w of ws) { const dx = w.x - w.fx, dy = w.y - w.fy; if (Math.abs(dx) + Math.abs(dy) > 0.001) { w.fx += Math.sign(dx) * Math.min(Math.abs(dx), sp); w.fy += Math.sign(dy) * Math.min(Math.abs(dy), sp); } }
    const L = ws[0];
    if (Math.abs(L.x - L.fx) + Math.abs(L.y - L.fy) > 0.001) return;
    if (this.arrive) { this.arrive = false; this.onTile(); return; }
    if (!this.route.length) return;
    const n = this.mode === 'dungeon' ? DN : N, [x, y] = this.route[0];
    if (!(this.mode === 'dungeon' ? this.dg.map[y * n + x] > 0 : this.passW(this.wm[y * n + x]))) { this.route = []; return; }
    this.route.shift();
    for (let k = ws.length - 1; k > 0; k--) { if (ws[k - 1].x !== ws[k].x) ws[k].face = Math.sign(ws[k - 1].x - ws[k].x); ws[k].x = ws[k - 1].x; ws[k].y = ws[k - 1].y; }
    if (x !== L.x) L.face = Math.sign(x - L.x);
    L.x = x; L.y = y; this.arrive = true;
  }
  onTile() {
    const L = this.walkers[0];
    this.grace--;
    if (this.mode === 'world') {
      const t = this.wm[L.y * N + L.x];
      if (t === TOWN) { this.route = []; return this.visitTown(this.townAt(L.x, L.y)); }
      if (t === CAVE) {
        const d = this.dungeons.find((q) => q.x === L.x && q.y === L.y);
        if (d && !d.done && !d.locked) { this.route = []; return this.enterDungeon(d); }
        if (d?.locked) { this.route = []; this.msg(this.party[0], 'A black seal bars the way. Not yet…'); this.party[0].actor.emote('shake', 1); }
        return;
      }
      if (this.grace <= 0 && this.rng() < ENC[t]) this.encounter();
      return;
    }
    const g = this.dg, i = L.y * DN + L.x;
    this.reveal();
    if (g.cell && g.cell.x === L.x && g.cell.y === L.y) return this.rescue(g);
    const ch = g.chests.find((c) => !c.open && c.x === L.x && c.y === L.y);
    if (ch) return this.openChest(ch);
    if (g.boss && g.boss.x === L.x && g.boss.y === L.y) return this.bossIntro(g.d);
    if (g.map[i] === 2) { this.route = []; g.floor++; this.genFloor(); this.msg(g.d.name, `The party ${g.d.i === 4 ? 'climbs' : 'descends'} to ${g.d.i === 4 ? `${g.floor + 1}F` : `B${g.floor + 1}F`}.`); return; }
    if (this.grace <= 0 && this.rng() < 0.04) this.encounter();
  }
  moving() { const L = this.walkers[0]; return this.arrive || Math.abs(L.x - L.fx) + Math.abs(L.y - L.fy) > 0.001; }
  // ---------------------------------------------------------------- sprites
  animate(dt) {
    for (const h of this.party) {
      if (h.hp > 0 && h.actor.isKO) h.actor.revive();
      if (h.castT > 0 && (h.castT -= dt) <= 0) h.actor.stopCast();
    }
    for (const n of this.npcs) n.actor.update(dt, {});
    for (const h of this.reserve) h.actor.update(dt, {});
    for (const h of this.pend) if (h && !this.party.includes(h) && !this.reserve.includes(h)) h.actor.update(dt, {});
    if (this.bt) for (const f of this.bt.foes) if (f.castT > 0 && (f.castT -= dt) <= 0) f.actor?.stopCast();
    if (this.mode === 'battle' && this.bt) return this.animBattle(dt);
    if (this.mode === 'town' && this.tw) return this.animTown(dt);
    const sp = (this.mode === 'world' ? 6 : 5) * T;
    this.party.forEach((h, k) => {
      const w = this.walkers[k]; if (!w) return;
      const dx = w.x - w.fx, dy = w.y - w.fy;
      let vx = 0, vy = 0;
      if (Math.abs(dx) + Math.abs(dy) > 0.001) { w.vx = vx = Math.abs(dx) > 0.001 ? Math.sign(dx) * sp : 0; w.vy = vy = Math.abs(dy) > 0.001 ? Math.sign(dy) * sp : 0; w.vt = 0.1; }
      else if ((w.vt = (w.vt || 0) - dt) > 0) { vx = w.vx; vy = w.vy; } // bridge the one-frame pause between tiles
      h.actor.update(dt, { vx, vy, lowHealth: h.hp > 0 && h.hp < h.max * 0.25 });
    });
  }
  animTown(dt) {
    const tw = this.tw, goal = Math.max(84, Math.min(276, [60, 180, 300, 300, 180, 180][tw.tab])), d = goal - tw.px, m = Math.sign(d) * Math.min(Math.abs(d), 110 * dt);
    tw.px += m;
    for (const h of this.party) {
      h.actor.update(dt, { vx: dt > 0 ? m / dt : 0, vy: 0 });
      if (!m && !this.say && h.actor.dir !== 'N' && !h.actor.locked) h.actor.face('N');
    }
  }
  animBattle(dt) {
    const b = this.bt, q = b.seq;
    if (b.flash > 0) b.flash -= dt;
    if (b.quake > 0) b.quake -= dt;
    for (const h of this.party) {
      let tgt = 0, spd = 220;
      if (b.phase === 'fled') tgt = 300;
      else if (q?.h === h) tgt = q.st === 'back' ? 0 : LUNGE;
      else if (b.actor === h && b.phase === 'cmd') { tgt = -14; spd = 90; }
      if (h.hp <= 0 || h.actor.locked) tgt = h.bo;
      const d = tgt - h.bo, m = Math.sign(d) * Math.min(Math.abs(d), spd * dt);
      h.bo += m;
      const ev = h.actor.update(dt, { vx: dt > 0 ? m / dt : 0, vy: 0, lowHealth: h.hp > 0 && h.hp < h.max * 0.25 });
      if (!m && b.phase !== 'fled' && h.hp > 0 && !h.actor.locked && h.actor.dir !== 'W' && !this.say) h.actor.face('W');
      if (q?.h === h) this.heroSeq(q, ev, dt);
    }
  }
  // a hero's turn: run up, attack / cast / throw, effect on hit / cast / fire, run back
  heroSeq(q, ev, dt) {
    const h = q.h, A = h.actor;
    q.t += dt;
    if (q.st === 'adv') {
      if (Math.abs(h.bo - LUNGE) < 0.5 || q.t > 1.5) { q.st = 'act'; q.t = 0; A[q.anim](); }
    } else if (q.st === 'act') {
      if (!q.done && (ev.some((e) => e === 'hit' || e === 'cast' || e === 'fire') || q.t > 1.2)) { q.done = true; q.dt = 0; this.resolve(h, q.ch); }
      if (q.done) {
        q.dt += dt;
        if (q.anim === 'cast' && q.dt > 0.45) A.stopCast();
        if ((q.dt > 0.2 && !A.a.action) || q.t > 2.5) { A.stopCast(); q.st = 'back'; }
      }
    } else if (Math.abs(h.bo) < 0.5) { this.bt.seq = null; this.bt.wait = this.auto ? 0.3 : 0.45; A.face('W'); }
  }
  step(dt) {
    this.animate(dt);
    for (const p of this.pops) { p.y -= 28 * dt; p.life -= dt; }
    this.pops = this.pops.filter((p) => p.life > 0);
    if (this.label && (this.label.t -= dt) <= 0) this.label = null;
    if (this.tw?.night > 0) this.tw.night -= dt;
    if (this.card) { if ((this.card.t -= dt) <= 0) { const f = this.card.then; this.card = null; f?.(); } return; }
    if (this.say) { if ((this.say.t -= dt) <= 0) this.nextLine(); return; }
    if (this.mode === 'battle') this.stepBattle(dt); else if (this.mode !== 'town') this.stepWalk(dt);
  }
  // ---------------------------------------------------------------- autopilot
  autopilot(dt) {
    if (this.say || this.card) return;
    if (this.mode === 'battle') { const b = this.bt; if (b.phase === 'cmd' && !b.pick && (b.aiT = (b.aiT || 0) + dt) > 0.25) { b.aiT = 0; b.pick = this.aiPick(b.actor); } return; }
    if (this.mode === 'town') return this.autoShop(dt);
    if (this.moving() || this.route.length) return;
    if ((this.think -= dt) > 0) return;
    this.think = 0.12;
    if (this.fieldHeal()) return;
    if (this.mode === 'dungeon') return this.autoDungeon();
    this.autoWorld();
  }
  autoDungeon() {
    const g = this.dg, L = this.walkers[0], at = (o) => (i) => o.some((q) => q.x === i % DN && q.y === ((i / DN) | 0)), pd = (i) => this.passD(i);
    if (g.boss && g.seen[g.boss.y * DN + g.boss.x] && this.inv.tent > 0 && (this.hpRatio() < 0.75 || this.mpLow())) return this.useTent();
    const chests = g.chests.filter((c) => !c.open && g.seen[c.y * DN + c.x]), cell = g.cell && g.seen[g.cell.y * DN + g.cell.x] ? [g.cell] : [];
    const goal = g.boss && g.seen[g.boss.y * DN + g.boss.x] ? at([g.boss]) : (i) => g.map[i] === 2 && g.seen[i];
    const frontier = (i) => g.map[i] && DIRS.some(([dx, dy]) => { const x = (i % DN) + dx, y = ((i / DN) | 0) + dy; return x >= 0 && y >= 0 && x < DN && y < DN && !g.seen[y * DN + x]; });
    this.route = (cell.length && this.findRoute(DN, pd, L.x, L.y, at(cell))) || (chests.length && this.findRoute(DN, pd, L.x, L.y, at(chests))) || this.findRoute(DN, pd, L.x, L.y, goal) || this.findRoute(DN, pd, L.x, L.y, frontier)
      || this.findRoute(DN, (i) => g.map[i] > 0, L.x, L.y, g.boss ? at([g.boss]) : (i) => g.map[i] === 2) || [];
  }
  autoWorld() {
    const L = this.walkers[0], here = this.townAt(L.x, L.y), ratio = this.hpRatio(), mpLow = this.mpLow();
    const go = (tw) => { if (here === tw) this.visitTown(tw); else this.route = this.wRoute((i) => i === tw.y * N + tw.x) || []; };
    const story = this.storyTown();
    if (story) return go(story);
    if ((ratio < 0.45 || mpLow) && this.inv.tent > 0 && !here) return this.useTent();
    let near = here ? { tw: here, n: 0 } : null;
    if (!near) { const r = this.wRoute((i) => this.wm[i] === TOWN); if (r?.length) { const [x, y] = r[r.length - 1]; near = { tw: this.townAt(x, y), n: r.length }; } }
    if (near && ((((ratio < 0.5 || (mpLow && ratio < 0.85)) && this.gold >= this.innCost())) || this.wantShop())) return go(near.tw);
    const d = this.dungeons.find((q) => !q.done && !q.locked);
    if (!d) return;
    if (this.avgLv() < d.lv - 0.5 + this.extra) {
      // grind in the wilds nearby, preferring forest
      let bt = null, bv = -1;
      for (let n = 0; n < 30; n++) { const x = L.x + this.ri(-6, 6), y = L.y + this.ri(-6, 6); if (x < 0 || y < 0 || x >= N || y >= N) continue; const t = this.wm[y * N + x]; if (!this.passW(t) || t === TOWN || t === CAVE) continue; const v = ENC[t] + this.r(0, 0.02); if (v > bv) { bv = v; bt = y * N + x; } }
      if (bt != null) this.route = this.wRoute((i) => i === bt) || [];
      return;
    }
    this.route = this.wRoute((i) => i === d.y * N + d.x) || [];
  }
  wantShop() {
    if (this.gold < (this.shopGold ?? 0) + 60) return false;
    const top = Math.min(11, 1 + this.world * 5 + Math.min(4, this.chap)), budget = this.gold - this.keep();
    return this.party.some((h) => (h.w < top && price('w', h.w + 1) <= budget) || (h.a < top && price('a', h.a + 1) <= budget)) || (this.inv.potion < 3 && this.gold > 80);
  }
  // world paths go round dungeon entrances that aren't the goal
  wRoute(goal) { const L = this.walkers[0]; return this.findRoute(N, (i) => this.wm[i] !== CAVE && this.passW(this.wm[i]), L.x, L.y, goal) || this.findRoute(N, (i) => this.passW(this.wm[i]), L.x, L.y, goal); }
  useTent() {
    this.inv.tent--;
    for (const h of this.party) { h.hp = h.max; h.mp = h.mmp; if (h.actor.isKO) h.actor.revive(); }
    this.emoteParty('love', 1.6); this.msg('', 'The party pitches a tent and sleeps. HP and MP restored.');
  }
  fieldHeal() {
    const al = this.alive(this.party); if (!al.length) return false;
    const low = this.lowest(al), [x, y] = [W / 2, H / 2];
    if (low.hp >= low.max * 0.6) return false;
    const cl = this.party.find((h) => h.job === 'White Mage' && h.hp > 0 && h.mp >= SK.Cure.mp);
    if (cl) { cl.mp -= SK.Cure.mp; cl.actor.cast(); cl.castT = 0.6; this.think = 0.5; const n = Math.round(this.magOf(cl) * SK.Cure.heal * 1.6 + 8); low.hp = Math.min(low.max, low.hp + n); this.pops.push({ x, y: y - 30, s: `${low.name} +${n}`, col: '#7dffa8', life: 1 }); this.burst(x, y, '#7dffa8', 10, 80); return true; }
    if (low.hp < low.max * 0.3 && this.inv.potion > 0) { this.inv.potion--; low.actor.emote('love', 0.6); this.think = 0.5; const n = Math.round(low.max * 0.45 + 20); low.hp = Math.min(low.max, low.hp + n); this.pops.push({ x, y: y - 30, s: `Potion +${n}`, col: '#7dffa8', life: 1 }); return true; }
    return false;
  }
  // ---------------------------------------------------------------- input
  btnRects() { return [0, 1, 2, 3, 4, 5].map((k) => [8 + (k % 2) * 86, 304 + Math.floor(k / 2) * 38, 82, 34]); }
  menuItems() {
    const b = this.bt, h = b.actor, al = this.alive(this.party), dead = this.party.filter((x) => x.hp <= 0), E = { s: '', on: false }, back = { s: 'Back', on: true, f: () => (b.menu = 'main') };
    if (b.menu === 'magic') {
      const sp = h.cl.skills.filter(([, l]) => h.lv >= l).slice(0, 5).map(([n]) => {
        const s = SK[n];
        return { s: `${n} ${s.mp || ''}`.trim(), on: h.mp >= s.mp && (!s.raise || dead.length > 0), f: () => {
          if (s.heal !== undefined || s.raise || s.buff || s.cover || s.all || s.hits) b.pick = { k: 'spell', s: n, t: s.raise ? dead[0] : s.heal !== undefined ? this.lowest(al) : null };
          else { b.menu = 'target'; b.spell = n; }
        } };
      });
      while (sp.length < 5) sp.push(E);
      return [...sp, back];
    }
    if (b.menu === 'item') {
      const mage = al.filter((x) => x.mmp).reduce((a, c) => (!a || c.mp / c.mmp < a.mp / a.mmp ? c : a), null) || h;
      return [...IK.slice(0, 3).map((k) => ({ s: `${ITEMS[k][0].split(' ')[0]} ×${this.inv[k]}`, on: this.inv[k] > 0 && (k !== 'phoenix' || dead.length > 0), f: () => (b.pick = { k: 'item', it: k, t: k === 'phoenix' ? dead[0] : k === 'ether' ? mage : this.lowest(al) }) })), E, E, back];
    }
    if (b.menu === 'target') return [E, E, E, E, E, back];
    return [
      { s: 'Attack', on: true, f: () => { b.menu = 'target'; b.spell = null; } },
      { s: h.cl.mage ? 'Magic' : 'Skill', on: true, f: () => (b.menu = 'magic') },
      { s: 'Item', on: true, f: () => (b.menu = 'item') },
      { s: 'Defend', on: true, f: () => (b.pick = { k: 'defend' }) },
      { s: 'Run', on: !b.boss, f: () => (b.pick = { k: 'run' }) }, E
    ];
  }
  down(x, y) {
    if (this.card) return;
    if (this.say) { if (this.say.t0 - this.say.t > 0.25) this.nextLine(); return; }
    if (this.mode === 'battle') {
      const b = this.bt;
      if (b.phase !== 'cmd' || b.pick) return;
      if (y > 300) {
        const items = this.menuItems();
        this.btnRects().forEach(([bx, by, bw, bh], k) => { if (x >= bx && x <= bx + bw && y >= by && y <= by + bh && items[k]?.on) items[k].f(); });
        return;
      }
      if (b.menu === 'target' || b.menu === 'main') {
        let best = null, bd = 60;
        for (const f of this.alive(b.foes)) { const [fx, fy] = this.foePos(f), d = Math.hypot(fx - x, fy - y); if (d < bd) { bd = d; best = f; } }
        if (best) b.pick = b.spell && b.menu === 'target' ? { k: 'spell', s: b.spell, t: best } : { k: 'atk', t: best };
      }
      return;
    }
    if (this.mode === 'town') {
      const tw = this.tw;
      if (y >= 266 && y < 288) { const k = Math.min(5, Math.floor(x / 60)); if (k === 5) this.leaveTown(); else { tw.tab = k; tw.hl = -1; } return; }
      const rows = this.townRows(), rh = rows.length > 5 ? 17 : 20, i = Math.floor((y - 292) / rh);
      if (y >= 292 && rows[i]?.on && rows[i].f) { tw.hl = i; rows[i].f(); }
      return;
    }
    if (y > H - 24 || y < 80) return;
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
  shadowed(c, a, x, y, s = 1) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y, 7 * s, 2.5 * s, 0, 0, 7); c.fill(); a.draw(c, x, y, s); }
  draw(c) {
    if (this.mode === 'battle') this.drawBattle(c); else if (this.mode === 'town') this.drawTown(c); else this.drawMap(c);
    for (const p of this.pops) { c.globalAlpha = Math.min(1, p.life * 2); c.lineWidth = 3; c.strokeStyle = '#000'; c.font = '800 14px ui-monospace, monospace'; c.textAlign = 'center'; c.strokeText(p.s, p.x, p.y); this.text(c, p.s, p.x, p.y, 14, p.col); }
    c.globalAlpha = 1;
    if (this.mode !== 'battle') this.drawQuest(c);
    if (this.label) { c.globalAlpha = Math.min(1, this.label.t * 2); const lw = this.mode === 'world' ? W - 76 : W; const ly = this.mode === 'battle' ? 88 : QY + (this.qh || 17) + 3; c.fillStyle = 'rgba(8,6,4,.7)'; c.fillRect(0, ly, lw, 20); this.text(c, this.label.s, lw / 2, ly + 10, 10, this.pal.ink); c.globalAlpha = 1; }
    if (this.card) this.drawCard(c);
    if (this.say) this.drawSay(c);
  }
  questText() {
    const st = this.story, c = this.chap, d = this.dungeons[Math.min(c, 4)], tw = this.storyTown();
    if (c > 4 || this.dungeons[4].done) return 'The world is saved… for now';
    if (this.needReturn) return `Bring the relics to ${st.sage} in ${tw.name}`;
    if (tw) return tw.k === 1 || (st.rec[2] && !this.met[2]) ? `Find the ${st.rec[tw.k === 1 ? 0 : 2]} waiting in ${tw.name}` : `Meet the others in ${tw.name}`;
    if (c === 4) return d.locked ? `Find a way into the ${st.cit}` : `Storm the ${d.name} and stop ${st.vname} (Lv ${d.lv})`;
    if (this.dg?.boss && this.dg.seen[this.dg.boss.y * DN + this.dg.boss.x]) return `Defeat ${this.bossOf(d).name}`;
    return `Recover the ${st.relics[c]} from the ${d.name} (Lv ${d.lv})`;
  }
  drawQuest(c) {
    const w = this.mode === 'world' ? W - 76 : W, s = `Ch${Math.min(5, this.chap + 1)} ▸ ${this.questText()}`;
    c.font = '700 10px ui-monospace, monospace';
    let lines = [s];
    if (c.measureText(s).width > w - 14) { c.font = '700 9px ui-monospace, monospace'; const ws = s.split(' '); let k = ws.length; while (k > 1 && c.measureText(ws.slice(0, k).join(' ')).width > w - 14) k--; lines = [ws.slice(0, k).join(' '), ws.slice(k).join(' ')]; }
    const h = this.qh = lines.length > 1 ? 28 : 17;
    c.fillStyle = 'rgba(8,6,4,.78)'; c.fillRect(0, QY, w, h); c.fillStyle = this.col(1); c.fillRect(0, QY, 2, h);
    lines.forEach((l, i) => this.text(c, l, 7, QY + 8.5 + i * 11, lines.length > 1 ? 9 : 10, this.pal.ink, 'left'));
  }
  drawCard(c) {
    const k = this.card, a = Math.min(1, (k.max - k.t) * 2.5, k.t * 2);
    c.globalAlpha = a * 0.85; c.fillStyle = '#05040a'; c.fillRect(0, 150, W, 84); c.globalAlpha = a;
    c.fillStyle = this.col(0); c.fillRect(40, 156, W - 80, 1.5); c.fillRect(40, 227, W - 80, 1.5);
    this.text(c, k.s.toUpperCase(), W / 2, 176, 11, this.col(1));
    this.text(c, k.sub, W / 2, 204, 20, this.pal.ink);
    c.globalAlpha = 1;
  }
  drawSay(c) {
    const s = this.say, sp = s.sp, y0 = H - 130, act = sp?.actor, art = sp?.art;
    if (art) {
      const bob = Math.sin(this.t * 2) * 3, g = c.createRadialGradient(84, y0 - 58, 8, 84, y0 - 58, 80);
      g.addColorStop(0, `${ECOL[sp.el] || '#9a5aff'}88`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, y0 - 140, 170, 140);
      drawFit(c, art.big, 84, y0 - 62 + bob, 136, 136);
    }
    c.fillStyle = 'rgba(10,7,5,.93)'; roundRect(c, 10, y0, W - 20, 96, 8); c.fill(); c.strokeStyle = this.col(0); c.lineWidth = 1.5; c.stroke();
    let tx = 22;
    if (act) {
      c.fillStyle = 'rgba(255,255,255,.06)'; roundRect(c, 16, y0 + 6, 58, 84, 6); c.fill();
      c.save(); c.beginPath(); c.rect(16, y0 + 6, 58, 84); c.clip(); act.draw(c, 45, y0 + 86, 2); c.restore(); tx = 84;
    }
    if (s.who) this.text(c, s.who, tx, y0 + 14, 11, this.col(0), 'left');
    this.wrap(c, s.s, tx, s.who ? y0 + 32 : y0 + 20, W - tx - 22, 14, !s.who);
    if (!this.auto) { c.globalAlpha = 0.5 + Math.sin(this.t * 6) * 0.4; this.text(c, '▼', W - 24, y0 + 86, 10, this.col(1)); c.globalAlpha = 1; }
  }
  drawStrip(c) {
    c.fillStyle = 'rgba(8,6,4,.82)'; c.fillRect(0, H - 24, W, 24);
    this.party.forEach((h, k) => {
      const x = 4 + k * 72; this.text(c, `${h.cl.tag}${h.lv}`, x, H - 12, 9, h.hp > 0 ? this.pal.ink : '#888', 'left');
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 24, H - 17, 42, 5); c.fillStyle = h.hp < h.max * 0.3 ? '#e04a3a' : '#5fd068'; c.fillRect(x + 24, H - 17, 42 * h.hp / h.max, 5);
      if (h.mmp) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 24, H - 9, 42, 3); c.fillStyle = '#5fa8ff'; c.fillRect(x + 24, H - 9, 42 * h.mp / h.mmp, 3); }
    });
    this.text(c, `${this.gold}g ${'◆'.repeat(this.relics)}${'◇'.repeat(4 - this.relics)}`, W - 4, H - 12, 9, this.col(1), 'right');
  }
  drawMap(c) {
    const dun = this.mode === 'dungeon', n = dun ? DN : N, L = this.walkers[0];
    this.camX = Math.max(0, Math.min(n * T - W, L.fx * T + T / 2 - W / 2)); this.camY = Math.max(-40, Math.min(n * T - H + 24, L.fy * T + T / 2 - H / 2 + 10));
    c.fillStyle = dun ? '#07060a' : 'hsl(205,42%,20%)'; c.fillRect(0, 0, W, H);
    c.save(); c.translate(-Math.round(this.camX), -Math.round(this.camY));
    const x0 = Math.max(0, Math.floor(this.camX / T)), y0 = Math.max(0, Math.floor(this.camY / T)), x1 = Math.min(n, x0 + Math.ceil(W / T) + 1), y1 = Math.min(n, y0 + Math.ceil(H / T) + 2);
    if (dun) this.drawDungeonTiles(c, x0, y0, x1, y1); else this.drawWorldTiles(c, x0, y0, x1, y1);
    if (this.route.length) { const [px, py] = this.route[this.route.length - 1]; c.strokeStyle = this.pal.ink; c.globalAlpha = 0.5 + Math.sin(this.t * 6) * 0.2; c.lineWidth = 1.5; c.strokeRect(px * T + 2, py * T + 2, T - 4, T - 4); c.globalAlpha = 1; }
    for (const m of this.cast) this.shadowed(c, m.n.actor, m.x * T + T / 2, m.y * T + T / 2 + 6);
    for (let k = this.walkers.length - 1; k >= 0; k--) { const w = this.walkers[k]; if (this.party[k]) this.shadowed(c, this.party[k].actor, w.fx * T + T / 2, w.fy * T + T / 2 + 6); }
    c.restore();
    if (dun) { const lx = L.fx * T + T / 2 - this.camX, ly = L.fy * T + T / 2 - this.camY, g = c.createRadialGradient(lx, ly, 30, lx, ly, 190); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(3,2,6,.8)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    else this.drawMini(c);
    this.drawStrip(c);
  }
  drawWorldTiles(c, x0, y0, x1, y1) {
    const m = this.wm, tex = { [GRASS]: this.texK(1), [FOREST]: this.texK(4), [HILL]: this.texK(5), [MOUNT]: this.texK(2), [SAND]: this.texK(6), [ROAD]: this.texK(3) };
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
        if (t === CAVE) this.drawEntrance(c, this.dungeons.find((q) => q.x === x && q.y === y), X, Y);
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
  drawEntrance(c, d, X, Y) {
    if (d?.i === 4) {
      // the villain's citadel: a black spire, chained shut until the finale
      c.fillStyle = '#1a1420'; c.beginPath(); c.moveTo(X + 2, Y + T); c.lineTo(X + 7, Y - 14); c.lineTo(X + 10, Y - 26); c.lineTo(X + 13, Y - 14); c.lineTo(X + 18, Y + T); c.fill();
      c.fillStyle = d.locked ? '#555' : `rgba(190,90,255,${0.6 + Math.sin(this.t * 4) * 0.3})`; c.fillRect(X + 9, Y - 10, 2, 4); c.fillRect(X + 8, Y + 8, 4, 6);
      if (d.locked) { c.strokeStyle = '#8a8a8a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X + 3, Y + 4); c.lineTo(X + 17, Y + 16); c.moveTo(X + 17, Y + 4); c.lineTo(X + 3, Y + 16); c.stroke(); }
      else { c.globalAlpha = 0.5 + Math.sin(this.t * 4) * 0.3; this.text(c, '!', X + T / 2, Y - 32, 11, this.col(0)); c.globalAlpha = 1; }
      return;
    }
    c.fillStyle = 'hsl(28,14%,30%)'; c.beginPath(); c.moveTo(X - 2, Y + T); c.lineTo(X + T / 2, Y - 6); c.lineTo(X + T + 2, Y + T); c.fill();
    c.fillStyle = '#0a0606'; c.beginPath(); c.arc(X + T / 2, Y + T - 2, 5, Math.PI, 0); c.fill(); c.fillRect(X + T / 2 - 5, Y + T - 2, 10, 2);
    if (d?.done) { c.fillStyle = '#ddd'; c.fillRect(X + T / 2, Y - 14, 1.5, 10); c.fillStyle = this.col(2); c.fillRect(X + T / 2 + 1.5, Y - 14, 7, 5); }
    else { c.globalAlpha = 0.5 + Math.sin(this.t * 4) * 0.3; this.text(c, '!', X + T / 2, Y - 10, 11, this.col(0)); c.globalAlpha = 1; }
  }
  drawDungeonTiles(c, x0, y0, x1, y1) {
    const g = this.dg, m = g.map, fp = this.pat(c, g.floorTex), wp = this.pat(c, g.wallTex), hue = (this.skin.hue + g.d.k * 40 + (g.d.i === 4 ? 230 : 0)) % 360;
    const isF = (x, y) => x >= 0 && y >= 0 && x < DN && y < DN && m[y * DN + x] > 0;
    c.beginPath();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (g.seen[y * DN + x] && m[y * DN + x]) c.rect(x * T, y * T, T, T);
    c.fillStyle = `hsl(${hue},16%,32%)`; c.fill();
    if (fp) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.7; c.fillStyle = fp; c.fill(); c.restore(); }
    c.beginPath();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (g.seen[y * DN + x] && !m[y * DN + x] && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => isF(x + dx, y + dy)))) c.rect(x * T, y * T, T, T);
    c.fillStyle = `hsl(${hue},12%,10%)`; c.fill();
    if (wp) { c.save(); c.globalAlpha = 0.25; c.fillStyle = wp; c.fill(); c.restore(); }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!g.seen[y * DN + x]) continue;
      const t = m[y * DN + x];
      if (!t && isF(x, y + 1)) { c.fillStyle = `hsl(${(hue + 20) % 360},14%,22%)`; c.fillRect(x * T, y * T + 8, T, T - 8); if (wp) { c.save(); c.globalAlpha = 0.45; c.fillStyle = wp; c.fillRect(x * T, y * T + 8, T, T - 8); c.restore(); } c.fillStyle = this.col(5); c.globalAlpha = 0.5; c.fillRect(x * T, y * T + 8, T, 1.5); c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x * T, y * T + T, T, 4); }
      if (t === 2) { for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#1a1410' : '#6a5a48'; c.fillRect(x * T + 2 + k, y * T + 3 + k * 4, T - 4 - k * 2, 4); } }
    }
    for (const ch of g.chests) {
      if (!g.seen[ch.y * DN + ch.x]) continue;
      const X = ch.x * T + T / 2, Y = ch.y * T + T / 2, ic = this.skin.pick('chest', 'item');
      c.fillStyle = ch.open ? '#3a2a1a' : '#8a5a2a'; c.fillRect(X - 7, Y - 4, 14, 10); c.fillStyle = ch.open ? '#20160e' : '#c9952b'; c.fillRect(X - 7, Y - 6, 14, 3); c.fillRect(X - 1, Y - 2, 2, 3);
      if (!ch.open && ic) { c.globalAlpha = 0.85; drawFit(c, ic, X, Y - 12 + Math.sin(this.t * 3) * 1.5, 12, 12); c.globalAlpha = 1; }
    }
    if (g.cell && g.seen[g.cell.y * DN + g.cell.x]) {
      // a captive behind bars
      const X = g.cell.x * T + T / 2, Y = g.cell.y * T + T / 2;
      this.shadowed(c, g.cell.h.actor, X, Y + 6);
      c.strokeStyle = '#9a9aa8'; c.lineWidth = 1.5; c.beginPath();
      for (let k = 0; k < 5; k++) { c.moveTo(X - 10 + k * 5, Y - 24); c.lineTo(X - 10 + k * 5, Y + 8); }
      c.moveTo(X - 12, Y - 24); c.lineTo(X + 12, Y - 24); c.moveTo(X - 12, Y + 8); c.lineTo(X + 12, Y + 8); c.stroke();
      c.globalAlpha = 0.5 + Math.sin(this.t * 4) * 0.4; this.text(c, '?', X, Y - 32, 11, this.col(1)); c.globalAlpha = 1;
    }
    if (g.boss && g.seen[g.boss.y * DN + g.boss.x]) {
      const X = g.boss.x * T + T / 2, Y = g.boss.y * T + T / 2;
      if (g.d.i === 4) this.shadowed(c, this.villain().actor, X, Y + 6, 1.2);
      else drawFit(c, this.bossOf(g.d).art.frames[Math.floor(this.t * 2) % 2], X, Y - 6 + Math.sin(this.t * 2) * 2, 34, 34);
    }
  }
  drawMini(c) {
    if (!this.mini) {
      this.mini = Object.assign(document.createElement('canvas'), { width: N, height: N });
      const x = this.mini.getContext('2d');
      for (let i = 0; i < N * N; i++) { x.fillStyle = this.tileCol(this.wm[i]); x.fillRect(i % N, (i / N) | 0, 1, 1); }
    }
    const X = W - 70, Y = QY, blink = Math.floor(this.t * 3) % 2;
    c.globalAlpha = 0.85; c.fillStyle = '#000'; c.fillRect(X - 2, Y - 2, N + 4, N + 4); c.drawImage(this.mini, X, Y); c.globalAlpha = 1;
    for (const tw of this.towns) { c.fillStyle = this.pal.ink; c.fillRect(X + tw.x - 1, Y + tw.y - 1, 3, 3); }
    for (const d of this.dungeons) { c.fillStyle = d.done ? '#888' : d.i === 4 ? (d.locked ? '#444' : '#c070ff') : this.col(0); c.fillRect(X + d.x - 1.5, Y + d.y - 1.5, 3, 3); }
    const q = this.storyTown() || this.dungeons.find((d) => !d.done && !d.locked);
    if (q && blink) { c.strokeStyle = this.col(1); c.lineWidth = 1; c.strokeRect(X + q.x - 3.5, Y + q.y - 3.5, 7, 7); }
    if (blink) { c.fillStyle = '#fff'; c.fillRect(X + this.walkers[0].x - 1, Y + this.walkers[0].y - 1, 2, 2); }
  }
  drawTown(c) {
    const tw = this.tw, keep = this.keeper(tw.town), bg = this.skin.bgSet?.[1] || this.skin.bg, hot = [0, 1, 2, 2, -1, -1][tw.tab];
    const g = c.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, this.pal.bg2); g.addColorStop(1, this.pal.bg); c.fillStyle = g; c.fillRect(0, 0, W, 264);
    if (ready(bg)) { const iw = bg.naturalWidth || bg.width, ih = bg.naturalHeight || bg.height, s = Math.max(W / iw, 130 / ih); c.globalAlpha = 0.45; c.drawImage(bg, W / 2 - iw * s / 2, 200 - ih * s, iw * s, ih * s); c.globalAlpha = 1; }
    c.fillStyle = this.tileCol(ROAD); c.fillRect(0, 196, W, 68);
    const p = this.pat(c, this.texK(3)); if (p) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.5; c.fillStyle = p; c.fillRect(0, 196, W, 68); c.restore(); }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 196, W, 3);
    ['INN', 'ITEMS', 'ARMS'].forEach((name, k) => {
      const x = 60 + k * 120, wp = this.pat(c, this.texK(9 + k));
      c.fillStyle = '#d8c3a5'; c.fillRect(x - 44, 134, 88, 64);
      if (wp) { c.save(); c.globalAlpha = 0.3; c.fillStyle = wp; c.fillRect(x - 44, 134, 88, 64); c.restore(); }
      c.fillStyle = this.col(k === 1 ? 3 : k * 2); c.beginPath(); c.moveTo(x - 52, 136); c.lineTo(x, 104); c.lineTo(x + 52, 136); c.fill();
      c.fillStyle = '#3a2618'; c.fillRect(x - 10, 172, 20, 26);
      c.fillStyle = hot === k ? `rgba(255,214,120,${0.75 + Math.sin(this.t * 5) * 0.2})` : 'rgba(40,40,60,.8)'; c.fillRect(x - 36, 150, 14, 12); c.fillRect(x + 22, 150, 14, 12);
      c.fillStyle = '#2a1a10'; c.fillRect(x - 24, 140, 48, 13); this.text(c, name, x, 147, 9, hot === k ? this.col(1) : '#f0e0c0');
      if (hot === k || (hot < 0 && k === 1)) this.shadowed(c, keep.actor, x, 202, 1.2);
    });
    const guest = this.say?.sp?.actor && !this.party.includes(this.say.sp) ? this.say.sp : null;
    if (guest) { const gx = tw.px > 180 ? tw.px - 120 : tw.px + 120; guest.actor.face(gx < tw.px ? 'E' : 'W'); this.shadowed(c, guest.actor, gx, 248, 1.5); }
    for (const h of this.party) {
      const [x, y] = this.townPos(h); this.shadowed(c, h.actor, x, y, 1.5);
      const st = h.cl.mage ? `M${Math.round(this.magOf(h))}` : `A${Math.round(this.atkOf(h))}`;
      this.text(c, `${st} D${Math.round(this.defOf(h))}`, x, 257, 8, this.pal.ink);
    }
    if (tw.night > 0) { c.globalAlpha = Math.min(0.75, Math.sin(Math.min(1, tw.night / 1.3) * Math.PI) * 0.9); c.fillStyle = '#0a0a28'; c.fillRect(0, 56, W, 208); this.text(c, 'Zzz…', W / 2, 160, 18, '#c8d0ff'); c.globalAlpha = 1; }
    // shop panel
    c.fillStyle = 'rgba(10,7,5,.94)'; c.fillRect(0, 262, W, H - 286); c.fillStyle = this.col(0); c.fillRect(0, 262, W, 2);
    ['Inn', 'Items', 'Arms', 'Armor', 'Party', 'Exit'].forEach((s, k) => {
      const x = 2 + k * 59.5, on = tw.tab === k;
      c.fillStyle = on ? this.col(k) : 'rgba(255,255,255,.06)'; roundRect(c, x, 267, 56, 20, 5); c.fill();
      this.text(c, s, x + 28, 277, 9, on ? this.pal.bg : this.pal.ink);
    });
    const rows = this.townRows(), rh = rows.length > 5 ? 17 : 20;
    rows.forEach((r, i) => {
      const y = 292 + i * rh;
      if (tw.hl === i) { c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(4, y, W - 8, rh - 2); }
      this.text(c, r.s, 10, y + rh / 2 - 1, 10, r.on ? this.pal.ink : 'rgba(255,255,255,.4)', 'left');
      this.text(c, r.r, W - 10, y + rh / 2 - 1, 9, r.on ? this.col(1) : 'rgba(255,255,255,.35)', 'right');
    });
    if (tw.tab === 5) this.text(c, 'Off to adventure!', W / 2, 330, 11, this.pal.ink);
    this.drawStrip(c);
  }
  drawBattle(c) {
    const b = this.bt, dun = b.from === 'dungeon', fin = b.boss && this.dg?.d.i === 4;
    c.save();
    if (b.quake > 0) c.translate(Math.sin(this.t * 90) * 4, Math.cos(this.t * 70) * 3);
    const g = c.createLinearGradient(0, 56, 0, 300);
    g.addColorStop(0, fin ? '#1a0a24' : dun ? '#0b090e' : this.pal.bg2); g.addColorStop(1, fin ? '#2a1030' : dun ? '#1a1418' : this.pal.bg);
    c.fillStyle = g; c.fillRect(-6, 0, W + 12, 300);
    const L = this.walkers[0], tt = dun ? null : this.wm[L.y * N + L.x];
    c.fillStyle = dun ? `hsl(${(this.skin.hue + this.dg.d.k * 40 + (fin ? 230 : 0)) % 360},14%,18%)` : this.tileCol(tt === FOREST ? FOREST : tt === HILL || tt === SAND ? tt : GRASS);
    c.fillRect(-6, 150, W + 12, 150);
    const p = this.pat(c, dun ? this.dg.floorTex : this.texK(tt === FOREST ? 4 : 1));
    if (p) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.6; c.fillStyle = p; c.fillRect(0, 150, W, 150); c.restore(); }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 150, W, 3);
    if (!dun && tt === FOREST) for (let k = 0; k < 9; k++) { const x = k * 42 + 10; c.fillStyle = `hsl(${125 + k * 3},30%,${10 + (k % 3) * 3}%)`; c.beginPath(); c.moveTo(x, 70 + (k % 2) * 12); c.lineTo(x + 24, 152); c.lineTo(x - 24, 152); c.fill(); }
    if (!dun && tt !== FOREST) { c.fillStyle = 'hsl(28,12%,22%)'; c.beginPath(); c.moveTo(0, 152); for (let k = 0; k <= 8; k++) c.lineTo(k * 45, 152 - 20 - ((k * 37) % 30)); c.lineTo(W, 152); c.fill(); }
    // foes
    for (const f of b.foes) {
      if (f.hp <= 0 && f.dead > 0.6 && !f.transform && !f.morph) continue;
      const [x, y] = this.foePos(f), big = f.boss, sz = big ? 150 : 58, col = ECOL[f.el] || '#c070ff';
      let dx = 0; if (b.anim?.u === f) dx = Math.sin((0.5 - b.anim.t) / 0.5 * Math.PI) * 18;
      if (b.shake?.u === f) dx += Math.sin(this.t * 80) * 3;
      c.globalAlpha = f.hp <= 0 && !f.transform && !f.morph ? Math.max(0, 1 - f.dead / 0.6) : 1;
      if (f.charge) { const r = 60 + Math.sin(this.t * 8) * 8, gl = c.createRadialGradient(x, y, 10, x, y, r + 30); gl.addColorStop(0, `${col}aa`); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(x - r - 30, y - r - 30, (r + 30) * 2, (r + 30) * 2); }
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + (big ? 62 : sz * 0.42), big ? 50 : sz * 0.32, big ? 9 : sz * 0.08, 0, 0, 7); c.fill();
      if (f.form === 'human') f.actor.draw(c, x + dx, y + 62, 3.2);
      else if (big) drawFit(c, f.art.big, x + dx, y + Math.sin(this.t * 2) * 3, sz, sz);
      else {
        // the horror forge's monsters lunge, flinch and fall in their own poses
        const A = f.art, im = !A.horror ? A.frames[Math.floor(this.t * 2.5 + x) % 2] : f.hp <= 0 ? A.dead : b.shake?.u === f ? A.hurt : b.anim?.u === f ? A.view('attack', Math.min(2, Math.floor((0.5 - b.anim.t) / 0.5 * 3)), 2) : A.frames[Math.floor(this.t * 2.5 + x) % 2];
        drawFit(c, im, x + dx, y + (A.horror && A.floats ? Math.sin(this.t * 2 + x) * 2 : 0), sz, sz);
      }
      c.globalAlpha = 1;
      if (f.barrier) { c.strokeStyle = `rgba(160,220,255,${0.5 + Math.sin(this.t * 6) * 0.25})`; c.lineWidth = 2; c.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2 + this.t * 0.5; c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 72, y + Math.sin(a) * 72); } c.stroke(); }
      if (f.charge) { c.globalAlpha = 0.6 + Math.sin(this.t * 10) * 0.4; this.text(c, '!!', x, y - 84, 16, '#ffd23a'); c.globalAlpha = 1; }
      if (f.hp > 0 && !big) {
        c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x - 22, y - sz * 0.5 - 8, 44, 4); c.fillStyle = '#e04a3a'; c.fillRect(x - 22, y - sz * 0.5 - 8, 44 * f.hp / f.max, 4);
      }
      if (f.hp > 0 && b.phase === 'cmd' && !this.auto && (b.menu === 'target' || b.menu === 'main')) { c.globalAlpha = 0.5 + Math.sin(this.t * 6) * 0.3; this.text(c, '▼', x, y - (big ? 80 : sz * 0.5 + 18), 11, this.col(1)); c.globalAlpha = 1; }
    }
    // the boss's name, HP and phase
    const boss = b.boss && b.foes[0];
    if (boss && (boss.hp > 0 || boss.transform || boss.morph)) {
      this.text(c, boss.name, 8, 96, 10, this.pal.ink, 'left');
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(8, 104, 168, 5); c.fillStyle = boss.phase >= 3 ? '#ff4a6a' : boss.phase === 2 ? '#ff9a3a' : '#e04a3a'; c.fillRect(8, 104, 168 * boss.hp / boss.max, 5);
      for (let k = 0; k < 3; k++) { c.fillStyle = k < boss.phase ? this.col(1) : 'rgba(255,255,255,.2)'; c.fillRect(180 + k * 7, 103, 5, 7); }
    }
    // heroes
    for (const h of this.party) {
      const [x, y] = this.heroPos(h.k), dx = h.bo;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + dx, y + 22, 13, 3.5, 0, 0, 7); c.fill();
      if (h.pro > 0 && h.hp > 0) { c.strokeStyle = 'rgba(154,208,255,.45)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x + dx, y - 6, 18, 30, 0, 0, 7); c.stroke(); }
      h.actor.draw(c, x + dx, y + 22, BSC, { alpha: h.hp <= 0 ? 0.8 : 1 });
      if (h.guard && h.hp > 0) { const sx = x + dx - 20, sy = y - 26; c.fillStyle = '#c0c8d8'; c.beginPath(); c.moveTo(sx - 5, sy - 6); c.lineTo(sx + 5, sy - 6); c.lineTo(sx + 4, sy + 1); c.lineTo(sx, sy + 6); c.lineTo(sx - 4, sy + 1); c.closePath(); c.fill(); }
    }
    if (b.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(0.7, b.flash)})`; c.fillRect(-6, 56, W + 12, 244); }
    c.restore();
    // message
    c.fillStyle = 'rgba(8,6,4,.78)'; c.fillRect(0, 62, W, 24);
    this.text(c, b.phase === 'cmd' && b.menu === 'target' && !this.auto ? 'Tap a monster to target it' : b.msg, W / 2, 74, b.msg.length > 52 ? 9 : 11, b.msg.startsWith('⚠') ? '#ffd23a' : this.pal.ink);
    if (b.phase === 'intro') { c.fillStyle = `rgba(0,0,0,${Math.max(0, b.wait - 0.3)})`; c.fillRect(0, 86, W, 214); }
    // command panel
    c.fillStyle = 'rgba(10,7,5,.92)'; c.fillRect(0, 300, W, H - 300); c.fillStyle = this.col(0); c.fillRect(0, 300, W, 2);
    const cmd = b.phase === 'cmd' && b.actor && !this.auto;
    const items = cmd ? this.menuItems() : ['Attack', 'Skill', 'Item', 'Defend', 'Run', ''].map((s) => ({ s, on: false }));
    this.btnRects().forEach(([x, y, w, h], k) => {
      const it = items[k], on = it?.on, hl = !cmd && b.hl === k && b.phase === 'act';
      c.fillStyle = hl ? this.col(k) : it?.s ? (on ? this.pal.bg2 : 'rgba(255,255,255,.05)') : 'rgba(255,255,255,.03)'; roundRect(c, x, y, w, h, 7); c.fill();
      c.strokeStyle = on || hl ? this.col(k) : 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; c.stroke();
      if (it?.s) this.text(c, it.s, x + w / 2, y + h / 2, 11, hl ? this.pal.bg : on ? this.pal.ink : 'rgba(255,255,255,.35)');
    });
    this.party.forEach((h, k) => {
      const x = 186, y = 304 + k * 27, act = b.actor === h && (b.phase === 'cmd' || b.phase === 'act');
      if (act) { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x - 4, y - 2, W - x, 26); }
      this.text(c, h.name, x, y + 5, 10, h.hp > 0 ? (act ? this.col(1) : this.pal.ink) : '#777', 'left');
      this.text(c, `Lv${h.lv} ${h.cl.tag}`, W - 8, y + 5, 9, 'rgba(255,255,255,.5)', 'right');
      c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x, y + 12, 128, 5); c.fillStyle = h.hp < h.max * 0.3 ? '#e04a3a' : '#5fd068'; c.fillRect(x, y + 12, 128 * h.hp / h.max, 5);
      this.text(c, `${Math.ceil(h.hp)}`, W - 8, y + 14, 8, this.pal.ink, 'right');
      if (h.mmp) { c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x, y + 19, 128, 3); c.fillStyle = '#5fa8ff'; c.fillRect(x, y + 19, 128 * h.mp / h.mmp, 3); }
    });
  }
  wrap(c, s, x, y, w, lh, italic) {
    c.font = `${italic ? 'italic ' : ''}600 11px ui-monospace, monospace`; c.fillStyle = italic ? '#d8d0ff' : this.pal.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
    let line = '', yy = y;
    for (const word of s.split(' ')) { const t = line ? `${line} ${word}` : word; if (c.measureText(t).width > w) { c.fillText(line, x, yy); yy += lh; line = word; } else line = t; }
    c.fillText(line, x, yy);
  }
  hud() { return `${Math.floor(this.score)} · Ch ${Math.min(5, this.chap + 1)} · Lv ${Math.floor(this.avgLv())}`; }
}
