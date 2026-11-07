// Monster Battle rules: the eight spirit elements and their matchups, ~60 moves (physical, special,
// status, buffs and debuffs, multi-hit, priority, heal, drain, weather), stats, learnsets, levels
// and evolution. Creatures are SPIRITS from creature.js; a species is a spirit seed.
import { mulberry32 } from '../util.js';
import { monster } from './creature.js';
import { genome } from '../spirits.js';

export const ELEMENTS = ['fire', 'water', 'leaf', 'wind', 'shadow', 'spirit', 'earth', 'beast'];
export const ECOL = { fire: '#ff6a2a', water: '#3ea2ff', leaf: '#5fd35a', wind: '#7fe8d2', shadow: '#9a62e0', spirit: '#ff8ae6', earth: '#d29a4a', beast: '#efe0c4' };
export const EHUE = { fire: 14, water: 205, leaf: 105, wind: 165, shadow: 268, spirit: 318, earth: 32, beast: 28 };
export const EKAN = { fire: '炎', water: '水', leaf: '葉', wind: '風', shadow: '闇', spirit: '霊', earth: '土', beast: '獣' };
const CHART = {
  fire: { leaf: 2, shadow: 2, fire: 0.5, water: 0.5, earth: 0.5 }, water: { fire: 2, earth: 2, water: 0.5, leaf: 0.5 },
  leaf: { water: 2, earth: 2, leaf: 0.5, fire: 0.5, wind: 0.5 }, wind: { leaf: 2, beast: 2, earth: 0.5 },
  earth: { fire: 2, wind: 2, leaf: 0.5 }, beast: { earth: 2, shadow: 2, wind: 0.5, spirit: 0 },
  shadow: { spirit: 2, shadow: 0.5, beast: 0.5 }, spirit: { shadow: 2, beast: 2, fire: 0.5 }
};
export const eff = (a, d) => CHART[a]?.[d] ?? 1;
export const STATUS = { brn: ['BRN', '#ff7a3a'], psn: ['PSN', '#b45cff'], slp: ['SLP', '#8aa0c8'], par: ['PAR', '#ffd23a'] };
export const WEATHER = {
  sun: { name: 'harsh sunlight', kan: '晴', col: '#ffb040', boost: 'fire', nerf: 'water' }, rain: { name: 'rain', kan: '雨', col: '#4a7aff', boost: 'water', nerf: 'fire' },
  sand: { name: 'a sandstorm', kan: '砂', col: '#d8b060', chip: 'earth' }, bloom: { name: 'a blooming field', kan: '花', col: '#ff9ad0', boost: 'leaf', heal: 1 },
  eclipse: { name: 'an eclipse', kan: '蝕', col: '#5a2a8a', boost: 'shadow', nerf: 'spirit' }, aurora: { name: 'an aurora', kan: '光', col: '#7affc8', boost: 'spirit', heal: 1 }
};
// k: p physical, s special, t status. a: accuracy (0 never misses). L: learn tier. fx: how it looks.
// hits [min,max], pri priority, drain/heal/recoil fractions, crit stage, st [status, chance], self/foe stage changes,
// daze (confusion) chance, flinch chance, wx weather. w: impact word.
const M = (n, e, k, p, a, L, fx, o = {}) => ({ n, e, k, p, a, L, fx, ...o });
export const MOVES = [
  M('Ember Flick', 'fire', 's', 40, 1, 0, 'orb', { st: ['brn', 0.1] }), M('Fox Fire', 'fire', 's', 22, 0.95, 0, 'multi', { hits: [2, 4] }),
  M('Flame Rush', 'fire', 'p', 85, 0.95, 1, 'rush', { recoil: 0.25 }), M('Will-o-Wisp', 'fire', 't', 0, 0.85, 1, 'hex', { st: ['brn', 1] }),
  M('Blazing Sky', 'fire', 't', 0, 0, 1, 'weather', { wx: 'sun' }), M('Inferno Pillar', 'fire', 's', 105, 0.85, 2, 'pillar', { st: ['brn', 0.2] }),
  M('Bubble Barrage', 'water', 's', 20, 1, 0, 'multi', { hits: [2, 5] }), M('Tide Lash', 'water', 'p', 60, 1, 0, 'wave'),
  M('Spring Water', 'water', 't', 0, 0, 1, 'heal', { heal: 0.5 }), M('Rain Prayer', 'water', 't', 0, 0, 1, 'weather', { wx: 'rain' }),
  M('Whirlpool', 'water', 's', 60, 0.95, 1, 'pillar', { foe: { spd: -1 }, fc: 0.5 }), M('Torrent Cannon', 'water', 's', 100, 0.85, 2, 'beam'),
  M('Leaf Blade', 'leaf', 'p', 55, 1, 0, 'slash', { crit: 1 }), M('Seed Drain', 'leaf', 's', 50, 1, 0, 'drain', { drain: 0.5 }),
  M('Spore Cloud', 'leaf', 't', 0, 0.75, 1, 'hex', { st: ['slp', 1] }), M('Ironbark', 'leaf', 't', 0, 0, 1, 'aura', { self: { def: 2 } }),
  M('Toxic Spores', 'leaf', 't', 0, 0.9, 1, 'hex', { st: ['psn', 1] }), M('Bloom Field', 'leaf', 't', 0, 0, 1, 'weather', { wx: 'bloom' }),
  M('Petal Storm', 'leaf', 's', 95, 0.9, 2, 'rain'),
  M('Gust', 'wind', 's', 40, 1, 0, 'wave'), M('Swift Wing', 'wind', 'p', 40, 1, 0, 'rush', { pri: 1 }),
  M('Tailwind', 'wind', 't', 0, 0, 1, 'aura', { self: { spd: 2 } }), M('Feather Dance', 'wind', 't', 0, 1, 1, 'hex', { foe: { atk: -2 } }),
  M('Air Blade', 'wind', 's', 75, 0.95, 1, 'slash', { flinch: 0.3 }), M('Cyclone', 'wind', 's', 100, 0.85, 2, 'pillar', { daze: 0.2 }),
  M('Rock Throw', 'earth', 'p', 50, 0.9, 0, 'rain'), M('Mud Shot', 'earth', 's', 50, 0.95, 0, 'orb', { foe: { spd: -1 }, fc: 1 }),
  M('Bedrock', 'earth', 't', 0, 0, 1, 'aura', { self: { def: 1, sdf: 1 } }), M('Sandstorm', 'earth', 't', 0, 0, 1, 'weather', { wx: 'sand' }),
  M('Quake Stomp', 'earth', 'p', 90, 1, 2, 'quake'), M('Landslide', 'earth', 'p', 120, 0.85, 2, 'rain', { recoil: 0.33 }),
  M('Pounce', 'beast', 'p', 40, 1, 0, 'rush'), M('Quick Nip', 'beast', 'p', 40, 1, 0, 'rush', { pri: 1 }),
  M('Fury Swipes', 'beast', 'p', 18, 0.9, 0, 'slash', { hits: [2, 5] }), M('Growl', 'beast', 't', 0, 1, 0, 'roar', { foe: { atk: -1 } }),
  M('War Cry', 'beast', 't', 0, 0, 1, 'roar', { self: { atk: 2 } }), M('Body Slam', 'beast', 'p', 85, 1, 1, 'rush', { st: ['par', 0.3] }),
  M('Catnap', 'beast', 't', 0, 0, 1, 'heal', { heal: 1, nap: 1 }), M('Wild Fang', 'beast', 'p', 90, 0.95, 2, 'slash', { crit: 1, flinch: 0.2 }),
  M('Shade Claw', 'shadow', 'p', 60, 1, 0, 'slash', { crit: 1 }), M('Night Orb', 'shadow', 's', 55, 1, 0, 'orb'),
  M('Venom Fang', 'shadow', 'p', 50, 1, 1, 'rush', { st: ['psn', 0.3] }), M('Hypnotic Eye', 'shadow', 't', 0, 0.65, 1, 'hex', { st: ['slp', 1] }),
  M('Soul Leech', 'shadow', 's', 60, 1, 1, 'drain', { drain: 0.5 }), M('Hex Mark', 'shadow', 's', 65, 1, 1, 'hex', { hex: 1 }),
  M('Eclipse', 'shadow', 't', 0, 0, 1, 'weather', { wx: 'eclipse' }), M('Ambush', 'shadow', 'p', 70, 1, 2, 'rush', { pri: 1 }),
  M('Nightmare Ray', 'shadow', 's', 110, 0.85, 2, 'beam'),
  M('Spirit Spark', 'spirit', 's', 40, 1, 0, 'orb'), M('Glamour', 'spirit', 't', 0, 0.9, 0, 'hex', { daze: 1 }),
  M('Meditate', 'spirit', 't', 0, 0, 1, 'aura', { self: { sat: 1, sdf: 1 } }), M('Purify', 'spirit', 't', 0, 0, 1, 'heal', { heal: 0.5, cure: 1 }),
  M('Aurora Veil', 'spirit', 't', 0, 0, 1, 'weather', { wx: 'aurora' }), M('Star Rain', 'spirit', 's', 25, 1, 2, 'rain', { hits: [3, 5] }),
  M('Moonbeam', 'spirit', 's', 90, 1, 2, 'beam', { foe: { sdf: -1 }, fc: 0.3 })
];
const WORDS = { rush: ['ドン!', 'バキッ!', 'ドゴォ!'], slash: ['ズバッ!', 'ザシュ!', 'シャキン!'], orb: ['ボン!', 'パァン!'], multi: ['ポポポ!', 'ダダダ!'], beam: ['ゴォォ!', 'ビーム!'],
  pillar: ['ドドド!', 'ゴゴゴ!'], rain: ['ザザザ!', 'ドドド!'], wave: ['ザブン!', 'ヒュオッ!'], quake: ['ゴゴゴ!', 'ズシン!'], drain: ['ジュルッ!'], hex: ['ゾクッ…'], roar: ['ガオー!'], aura: ['キュイン!'], heal: ['キラッ'], weather: ['ゴロゴロ…'] };
export const wordFor = (mv, R) => { const w = WORDS[mv.fx] || WORDS.rush; return w[Math.floor(R() * w.length)]; };
// each element's finisher, used when the spirit gauge is full (with a cut-in)
export const ULT = { fire: ['Kitsune Inferno', '狐火'], water: ['Dragon Tide', '龍潮'], leaf: ['Thousand Petals', '千花'], wind: ['Heaven Typhoon', '天嵐'],
  shadow: ['Night Parade', '百鬼'], spirit: ['Moon Kami Burst', '月神'], earth: ['Mountain Fall', '山崩'], beast: ['King Fang', '獣王'] };
export const ultFor = (m) => ({ n: ULT[m.el][0], kan: ULT[m.el][1], e: m.el, k: m.atk >= m.sat ? 'p' : 's', p: 130, a: 0, fx: 'ult', ult: 1 });

// archetype base stats: hp atk def sat sdf spd
const BASE = { critter: [60, 75, 55, 60, 55, 82], guardian: [92, 86, 84, 48, 68, 36], kodama: [62, 48, 66, 82, 90, 46], puff: [56, 62, 54, 72, 60, 78], mochi: [94, 56, 70, 56, 80, 40], wisp: [52, 42, 46, 96, 70, 86],
  birdy: [56, 66, 50, 70, 56, 96], moth: [56, 46, 50, 86, 76, 82], noodle: [72, 80, 60, 86, 60, 74], pup: [58, 72, 52, 56, 52, 76], shell: [70, 62, 100, 56, 86, 30], lantern: [62, 50, 62, 90, 80, 50] };
const KEYS = ['hp', 'atk', 'def', 'sat', 'sdf', 'spd'];
export const need = (lv) => 14 + lv * 7;
// a species from a spirit seed (genomes are cheap; sprites are built when first shown)
const SP = new Map();
export function species(seed) {
  if (SP.has(seed)) return SP.get(seed);
  const g = genome(seed, 0, 0), R = mulberry32(seed ^ 0x6d2b79f5);
  const el = g.element, hue = EHUE[el] + (R() - 0.5) * 36;
  const base = (BASE[g.plan] || BASE.critter).map((v) => Math.round(v * (0.88 + R() * 0.24)));
  const others = ELEMENTS.filter((e) => e !== el && e !== 'beast'), cov = others[Math.floor(R() * others.length)];
  const of = (e, f) => MOVES.filter((m) => m.e === e && f(m));
  const pick = (list, used) => { const l = list.filter((m) => !used.includes(m)); return l.length ? l[Math.floor(R() * l.length)] : null; };
  const learn = [], add = (m, lv) => m && !learn.some((x) => x.m === m) && learn.push({ m, lv });
  const used = () => learn.map((x) => x.m);
  add(pick(of(el, (m) => m.L === 0 && m.p), used()), 1);
  add(pick(of('beast', (m) => m.L === 0), used()), 1);
  add(pick(of(cov, (m) => m.L === 0 && m.p), used()), 5);
  add(pick(of(el, (m) => m.L === 1 && !m.p), used()), 8);
  add(pick(of(el, (m) => m.L >= 1 && m.p), used()) || pick(of(el, (m) => m.p), used()), 11);
  add(pick(of(cov, (m) => m.L >= 1 && (m.p || !m.wx)), used()), 14);
  add(pick(of(el, (m) => m.L === 2 && m.p), used()), 18);
  add(pick(of('beast', (m) => m.L >= 1), used()), 23);
  const evo = [7 + Math.floor(R() * 3), 15 + Math.floor(R() * 3), 26 + Math.floor(R() * 4)];
  const s = { seed, el, hue, plan: g.plan, base, learn, evo, names: [g.name], species: g.species, rate: g.plan === 'guardian' || g.plan === 'noodle' ? 0.7 : 1 };
  SP.set(seed, s);
  return s;
}
// evolved names: the genome's own name when it changes with tier, else the old name plus an element suffix
const SUF = { fire: ['flare', 'blaze', 'pyre'], water: ['tide', 'surge', 'kai'], leaf: ['bloom', 'grove', 'sylv'], wind: ['gale', 'zeph', 'tempest'], shadow: ['shade', 'noir', 'umbra'],
  spirit: ['lume', 'sei', 'kami'], earth: ['rock', 'titan', 'gaia'], beast: ['fang', 'maw', 'king'] };
export function formName(sp, tier) {
  if (sp.names[tier]) return sp.names[tier];
  const g = genome(sp.seed, 0, tier);
  let stem = sp.names[0].slice(0, 5);
  while (stem.length > 3 && !/[aeiouy]$/i.test(stem)) stem = stem.slice(0, -1);
  const n = !sp.names.includes(g.name) ? g.name : stem + SUF[sp.el][tier - 1];
  return (sp.names[tier] = n[0].toUpperCase() + n.slice(1, 11));
}
export const tierAt = (sp, lv) => sp.evo.filter((v) => lv >= v).length;
// a creature: a species at a level
export function makeMon(seed, lv, opts = {}) {
  const sp = species(seed), tier = opts.tier ?? tierAt(sp, lv);
  const m = { sp, seed, el: sp.el, lv, xp: 0, tier, status: null, gauge: 0, uid: Math.floor(Math.random() * 1e9) };
  calc(m, true);
  m.moves = sp.learn.filter((x) => x.lv <= lv).slice(-4).map((x) => x.m);
  m.name = formName(sp, tier);
  return m;
}
export function calc(m, full) {
  const old = m.max || 0, mult = 1 + m.tier * 0.06;
  KEYS.forEach((k, i) => { const b = m.sp.base[i] * mult; m[k === 'hp' ? 'max' : k] = k === 'hp' ? Math.floor((2 * b * m.lv) / 100) + m.lv + 10 : Math.floor((2 * b * m.lv) / 100) + 5; });
  m.hp = full ? m.max : Math.max(m.hp > 0 ? 1 : 0, Math.min(m.max, m.hp + (m.max - old)));
}
// sprites: battle size grows with each evolution; `mini` is the overworld / team icon
export const sprite = (m) => monster(m.seed, m.sp.hue, 48 + m.tier * 4, m.tier);
export const mini = (m) => monster(m.seed, m.sp.hue, 26, m.tier);
export const stageMul = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
