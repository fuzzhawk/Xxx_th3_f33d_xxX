// One character, two styles. A persona describes a person once: skin, hair, beard, headwear, clothes and their
// colours, gloves, boots, belt, cape, weapon and build. personaToCrystal() dresses a Crystal Sprite and
// personaToMarrow() a MARROW body from it, so both renders are the same person. personaFor(seed, era) makes random
// people: the same seed and era always give the same person, in either style (the games' Crystal townsfolk and the
// brawler's MARROW fighters come from the same pool).
import './crystal/engine.js';

const S = globalThis.FF5Sprites, O = S.options, CLOTH = S.palettes.cloth, SKIN = S.palettes.skin, HAIR = S.palettes.hair;
export const ERAS = ['Fantasy', 'Present day', 'Sci-fi'];
export const BUILDS = ['average', 'slim', 'athletic', 'brawny', 'heavy', 'lanky', 'stocky', 'small', 'elder'];
// every field with its label and choices, in the creator's order (colours are Crystal cloth names)
export const FIELDS = [
  ['build', 'Build', BUILDS], ['skin', 'Skin', O.skin], ['hair', 'Hair', O.hair], ['hairColor', 'Hair colour', O.hairColor], ['beard', 'Beard', O.beard],
  ['head', 'Headwear', O.head], ['headColor', 'Hat colour', O.headColor], ['top', 'Top', O.top], ['topColor', 'Top colour', O.topColor], ['trimColor', 'Trim', O.trimColor],
  ['bot', 'Bottoms', O.bot], ['botColor', 'Bottoms colour', O.botColor], ['feet', 'Feet', O.feet], ['feetColor', 'Shoe colour', O.feetColor],
  ['hands', 'Hands', O.hands], ['handsColor', 'Glove colour', O.handsColor], ['belt', 'Belt', O.belt], ['beltColor', 'Belt colour', O.beltColor],
  ['cape', 'Cape', O.cape], ['capeColor', 'Cape colour', O.capeColor], ['weapon', 'Weapon', O.weapon], ['weaponColor', 'Weapon colour', O.weaponColor],
];
const LOOK = FIELDS.map((f) => f[0]).filter((k) => k !== 'build');
const DEF = { build: 'average', ...Object.fromEntries(LOOK.map((k) => [k, S.defaults[k] ?? FIELDS.find((f) => f[0] === k)[2][0]])) };
// swatch colours for UI
export const swatch = (k, v) => (k === 'skin' ? SKIN[v]?.[1] : k === 'hairColor' ? HAIR[v]?.[2] : /Color$/.test(k) ? CLOTH[v]?.[2] : '') || '';
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// a complete persona from any partial one (old saves, Crystal characters)
export function normPersona(p = {}, seed) {
  const o = { ...DEF, seed: (p.seed ?? seed ?? 1) >>> 0 || 1, era: ERAS.includes(p.era) ? p.era : 'Fantasy' };
  for (const [k, , vals] of FIELDS) if (vals.includes(p[k])) o[k] = p[k];
  return o;
}
export const crystalToPersona = (c, seed, era) => normPersona({ ...c, era }, seed);

// random people: a remix of one of the era's Crystal jobs, plus beards, capes, more hair styles and a build
export function personaFor(seed, era) {
  seed = (seed >>> 0) || 1;
  const e = ERAS.includes(era) ? era : ERAS[seed % 3], r = rng(seed * 7919 + 13), pick = (a) => a[Math.floor(r() * a.length)];
  const p = normPersona(S.randomCharacter(seed, e), seed);
  p.era = e;
  if (r() < 0.3) p.hair = pick(['buzz', 'braid', 'pigtails', 'bun', 'mohawk', 'afro', 'long', 'bob']);
  if (r() < 0.05) p.skin = pick(['Porcelain', 'Ebony', 'Ebony', 'Infernal']);
  p.beard = r() < 0.28 ? pick(['stubble', 'short', 'short', 'long']) : 'none';
  p.cape = r() < (e === 'Fantasy' ? 0.22 : 0.06) ? 'cape' : 'none'; p.capeColor = pick(O.capeColor);
  p.build = pick(['average', 'average', 'slim', 'athletic', 'athletic', 'brawny', 'heavy', 'lanky', 'stocky', 'elder']);
  return p;
}
// the brawler, the townsfolk and the RPGs draw people from one pool of 90 per era
export const poolSeed = (seed) => ((((seed >>> 0) * 2654435761) >>> 0) % 90) + 1;
export const poolPersona = (seed, era) => personaFor(poolSeed(seed), era);

// ---------------------------------------------------------------- Crystal
export function personaToCrystal(p) {
  const q = normPersona(p);
  return { job: '', ...Object.fromEntries(LOOK.map((k) => [k, q[k]])) };
}

// ---------------------------------------------------------------- MARROW
// builds are MARROW body presets or a few body parameters on top of the person's random body
const BODY = {
  average: { preset: 'Average adult' }, athletic: { preset: 'Athlete' }, brawny: { preset: 'Bruiser' }, lanky: { preset: 'Lanky' }, elder: { preset: 'Elder' },
  slim: { preset: 'Average adult', muscle: 0.85, fat: 9, chest: 0.95, belly: 0.75 },
  heavy: { preset: 'Average adult', fat: 31, belly: 1.4, muscle: 1.1, chest: 1.12 },
  stocky: { preset: 'Average adult', height: 1.5, muscle: 1.4, fat: 22, chest: 1.25, thighL: 0.9, shankL: 0.88, upperArmL: 0.95, forearmL: 0.95, headL: 1.18 },
  small: { preset: 'Average adult', height: 1.3, headL: 1.32, thighL: 0.92, shankL: 0.9, muscle: 0.8, fat: 14 },
};
const SLEEVE = { vest: 0, tee: 0.45, tunic: 0.5, longsleeve: 1.9, robe: 1.95, jacket: 1.9, suit: 1.95, coat: 1.95, armor: 1.9 };
const LONG_TOP = { tunic: 0.36, robe: 1, coat: 0.72 };
// hats hide what would poke through them: full helmets and hoods leave only long hair, brims flatten tall styles
const hairUnder = (q) => (['hood', 'helm', 'spacehelm'].includes(q.head) ? (['long', 'braid', 'ponytail'].includes(q.hair) && q.head !== 'spacehelm' ? q.hair : 'bald')
  : ['cap', 'hardhat', 'fedora', 'wizard', 'bandana'].includes(q.head) && ['spiky', 'mohawk', 'afro', 'topknot', 'bun'].includes(q.hair) ? 'short' : q.hair);
// The MARROW look (randomParams' `look`): every garment is set, so nothing of a random outfit leaks through.
// opts.weapon === false leaves the weapon out (fist fights).
export function personaToMarrow(p, opts = {}) {
  const q = normPersona(p), cl = (k, i = 1) => (CLOTH[q[k]] || CLOTH.Leather)[i], top = q.top, robe = top in LONG_TOP;
  return {
    ...(BODY[q.build] || BODY.average), outfit: 'Persona',
    skin: (SKIN[q.skin] || SKIN.Template)[1],
    hairStyle: hairUnder(q), hairColor: (HAIR[q.hairColor] || HAIR.Chestnut)[2], beard: q.beard, beardStyle: 'none', mustache: 'none',
    topOn: top !== 'none', topSleeve: SLEEVE[top] ?? 1.6, topLen: robe || top === 'armor' ? 1 : top === 'suit' ? 0.95 : 0.85,
    topLoose: { robe: 0.6, coat: 0.35, jacket: 0.3, tunic: 0.3, armor: 0.3 }[top] ?? 0.18, topColor: cl('topColor'),
    topPattern: ['jacket', 'suit', 'coat', 'robe'].includes(top) ? 'trim' : 'solid', topTrim: cl('trimColor', 2),
    pantsOn: q.bot === 'pants' || q.bot === 'shorts', pantsLen: q.bot === 'shorts' ? 0.35 : 1, pantsLoose: 0.2, pantsColor: cl('botColor'),
    skirtOn: q.bot === 'skirt' || robe, skirtLen: robe ? LONG_TOP[top] : 0.42, skirtFlare: top === 'robe' ? 0.3 : 0.25, skirtPleats: 1, skirtColor: robe ? cl('topColor') : cl('botColor'),
    bootsOn: q.feet !== 'none', bootHeight: q.feet === 'boots' ? 0.5 : 0.08, bootColor: cl('feetColor'),
    glovesOn: q.hands !== 'none', gloveLen: q.hands === 'gauntlets' ? 0.45 : 0.15, gloveColor: cl('handsColor'),
    beltOn: q.belt === 'on', beltColor: cl('beltColor'),
    capeOn: q.cape === 'cape', capeLen: 0.55, capeWidth: 0.75, capeColor: cl('capeColor'),
    scarfOn: false, fringe: 'none', bandOn: q.head === 'bandana', bandTail: 0.22, bandColor: cl('headColor'),
    pauldronOn: top === 'armor', pauldronColor: cl('topColor', 2),
    hat: q.head, hatColor: cl('headColor'),
    weapon: opts.weapon === false ? 'none' : q.weapon, weaponColor: cl('weaponColor', 2),
  };
}

// ---------------------------------------------------------------- words
const HAIRW = { bald: 'a bald head', buzz: 'a buzz cut', short: 'short hair', spiky: 'spiky hair', bob: 'a bob', long: 'long hair', ponytail: 'a ponytail', braid: 'a braid', pigtails: 'pigtails', topknot: 'a topknot', bun: 'a bun', mohawk: 'a mohawk', afro: 'an afro' };
const HEADW = { bandana: 'a bandana', hood: 'a hood', helm: 'a helm', wizard: 'a pointed hat', cap: 'a cap', hardhat: 'a hard hat', fedora: 'a fedora', spacehelm: 'a space helmet', visor: 'a visor' };
const TOPW = { vest: 'vest', tee: 'tee', longsleeve: 'shirt', tunic: 'tunic', robe: 'robe', jacket: 'jacket', suit: 'suit', coat: 'long coat', armor: 'armour' };
const BUILDW = { average: '', slim: 'slim', athletic: 'athletic', brawny: 'brawny', heavy: 'heavyset', lanky: 'lanky', stocky: 'stocky', small: 'small', elder: 'elderly' };
const c = (v) => String(v || '').toLowerCase();
export function describePersona(p) {
  const q = normPersona(p), h = HAIRW[q.hair], art = h.match(/^an? /)?.[0];
  const hair = q.hair === 'bald' ? h : art ? `a${/^[aeiou]/.test(c(q.hairColor)) ? 'n' : ''} ${c(q.hairColor)} ${h.slice(art.length)}` : h.replace(' hair', ` ${c(q.hairColor)} hair`);
  const who = `${BUILDW[q.build] ? `${BUILDW[q.build]}, ` : ''}${c(q.skin)} skin, ${hair}${q.beard !== 'none' ? `, ${q.beard === 'stubble' ? 'stubble' : `a ${q.beard} beard`}` : ''}`;
  const wear = [];
  if (q.head !== 'none') wear.push(`${HEADW[q.head]}${q.head === 'spacehelm' || q.head === 'visor' ? '' : ` (${c(q.headColor)})`}`);
  if (q.top !== 'none') wear.push(`a ${c(q.topColor)} ${TOPW[q.top]}${['jacket', 'suit', 'coat', 'robe'].includes(q.top) ? ` with ${c(q.trimColor)} trim` : ''}`);
  if (q.bot !== 'none') wear.push(`${c(q.botColor)} ${q.bot}`);
  if (q.feet !== 'none') wear.push(`${c(q.feetColor)} ${q.feet}`);
  if (q.hands !== 'none') wear.push(q.hands);
  if (q.cape !== 'none') wear.push(`a ${c(q.capeColor)} cape`);
  return `${who[0].toUpperCase()}${who.slice(1)}.${wear.length ? ` Wears ${wear.join(', ')}.` : ''}${q.weapon !== 'none' ? ` Carries ${q.weapon === 'saber' ? 'an energy saber' : `a ${q.weapon}`}.` : ''}`;
}
