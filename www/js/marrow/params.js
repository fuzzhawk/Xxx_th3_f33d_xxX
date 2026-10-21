// Character parameters for MARROW: the studio's randomizer and body presets, without its UI.
import { DEFAULTS, WEAR_DEFAULTS, OUTFITS, HAIR_STYLES, HAIR_COLORS, NOSE_STYLES } from './engine.js';

const deep = (o) => JSON.parse(JSON.stringify(o));
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const SKINS = ['#f2cba8', '#e0ad86', '#c98e6b', '#a8704e', '#7d4f35', '#563728', '#93ad7c', '#a3abc9'];
const PRESETS = {
  'Average adult': {},
  'Athlete': { muscle: 1.3, fat: 10, strength: 1.2, fastTwitch: 64, actTime: 18, control: 22, walkCadence: 112 },
  'Bruiser': { height: 1.92, muscle: 1.65, fat: 24, bias: .35, strength: 1.15, fastTwitch: 44, chest: 1.25, belly: 1.15, bone: 1.15, upperArmL: 1.04, walkCadence: 98 },
  'Child': { height: 1.22, headL: 1.42, neckL: .85, thighL: .92, shankL: .92, upperArmL: .94, forearmL: .94, muscle: .62, fat: 20, strength: .9, actTime: 30, walkCadence: 132, jt: 1.12 },
  'Elder': { height: 1.68, muscle: .74, fat: 28, strength: .72, fastTwitch: 32, actTime: 45, control: 12, walkCadence: 96, walkStride: .82, walkLean: 9, walkArm: 10, jt: .75 },
  'Lanky': { height: 2.0, thighL: 1.12, shankL: 1.12, upperArmL: 1.1, forearmL: 1.1, torsoL: .95, muscle: .85, fat: 10, belly: .8 },
  'Chibi': { height: 1.2, headL: 2.9, headRound: 1, eyes: 2.6, neckL: .5, torsoL: .8, upperArmL: .85, forearmL: .85, thighL: .78, shankL: .78, footL: 1.1, muscle: .65, fat: 14, chest: .85, belly: .8, walkCadence: 128, runCadence: 190, skin: '#f2cba8', scale: .46 },
  'Anime hero': { height: 1.72, headL: 1.55, headRound: .8, eyes: 1.9, neckL: .85, thighL: 1.08, shankL: 1.1, torsoL: .95, muscle: .95, fat: 11, chest: .95, belly: .8, runLean: 12, skin: '#f2cba8' },
  'Brute monster': { height: 2.05, hunch: .85, jowl: 1, brow: 1, headL: 1.2, neckL: .55, upperArmL: 1.3, forearmL: 1.35, handL: 1.5, handSize: 2.3, armBulk: 1.9, muscle: 1.4, thighL: .88, shankL: .85, fat: 22, belly: 1.2, chest: 1.3, walkCadence: 92, walkLean: 8, runLean: 14, skin: '#7f9a5e', scale: .3 },
  'Werebeast': { height: 1.95, hunch: .6, snout: 1, brow: .6, jowl: .55, headL: 1.1, upperArmL: 1.15, forearmL: 1.2, handL: 1.3, handSize: 1.6, armBulk: 1.4, muscle: 1.35, fat: 9, footL: 1.25, shankL: 1.05, fastTwitch: 70, strength: 1.3, runLean: 20, skin: '#7a5a43', scale: .32 },
  'Ghoul': { height: 1.8, hunch: .7, jowl: .35, brow: .4, headL: 1.05, upperArmL: 1.2, forearmL: 1.25, handL: 1.35, handSize: 1.4, armBulk: .8, muscle: .6, fat: 5, belly: .65, strength: .9, actTime: 40, walkCadence: 84, walkArm: 6, walkLean: 6, skin: '#a3abc9' },
};
const BODY_PRESETS = ['Athlete', 'Bruiser', 'Elder', 'Lanky', 'Chibi', 'Anime hero', 'Child'];
const MONSTER_PRESETS = ['Brute monster', 'Werebeast', 'Ghoul'];
export const PRESET_NAMES = Object.keys(PRESETS);
export function randomParams(seed, opts = {}) {
  const r = mulberry(seed), g = (m, s, lo, hi) => { const v = m + s * ((r() + r() + r()) - 1.5) * 1.15; return Math.min(hi, Math.max(lo, v)); };
  const p = deep(DEFAULTS); p.atkType = opts.atkType || p.atkType;
  p.height = +g(1.74, .22, 1.2, 2.2).toFixed(2); p.muscle = +g(1.05, .35, .55, 1.75).toFixed(2); p.fat = Math.round(g(19, 12, 5, 42)); p.bias = +g(0, .5, -.8, .8).toFixed(2); p.bone = +g(1, .12, .86, 1.24).toFixed(2);
  for (const k of ['headL', 'neckL', 'torsoL', 'upperArmL', 'forearmL', 'handL', 'thighL', 'shankL', 'footL']) p[k] = +g(1, .1, .82, 1.25).toFixed(2);
  p.chest = +g(1, .14, .82, 1.35).toFixed(2); p.belly = +g(1, .22, .65, 1.55).toFixed(2);
  p.strength = +g(1, .28, .45, 1.8).toFixed(2); p.fastTwitch = Math.round(g(50, 18, 22, 78)); p.actTime = Math.round(g(26, 10, 12, 60)); p.control = +g(18, 4, 10, 28).toFixed(1);
  for (const t in p.joints) { const u = p.joints[t]; u.min = Math.round(u.min * g(1, .22, .6, 1.4)); u.max = Math.round(u.max * g(1, .18, .65, 1.3)); u.sPos = Math.round(g(100, 30, 40, 180)); u.sNeg = Math.round(g(100, 30, 40, 180)); }
  p.walkCadence = Math.round(g(108, 14, 84, 140)); p.walkStride = +g(1.05, .15, .75, 1.35).toFixed(2); p.walkArm = Math.round(g(18, 8, 4, 38)); p.walkLean = Math.round(g(4, 4, -2, 15)); p.walkKnee = +g(1, .15, .7, 1.4).toFixed(2);
  p.jumpTuck = Math.round(g(45, 25, 0, 100)); p.atkWind = Math.round(g(50, 25, 0, 100));
  const on = Object.keys(OUTFITS).filter(n => n !== 'Nothing'), oname = on[Math.floor(r() * on.length)];
  Object.assign(p, WEAR_DEFAULTS, OUTFITS[oname], { outfit: oname });
  p.hairStyle = HAIR_STYLES[Math.floor(r() * HAIR_STYLES.length)][0]; p.hairColor = HAIR_COLORS[Math.floor(r() * HAIR_COLORS.length)];
  p.hairLen = +g(1, .25, .6, 1.6).toFixed(2); p.hairVolume = +g(1, .2, .6, 1.6).toFixed(2); p.hairStiff = +g(.5, .25, 0, 1).toFixed(2);
  p.beard = r() < .25 ? ['stubble', 'short', 'long'][Math.floor(r() * 3)] : 'none';
  const pick = arr => arr[Math.floor(r() * arr.length)];
  p.noseStyle = pick(Object.keys(NOSE_STYLES).filter(k => k !== 'snout')); p.noseLen = +g(1, .12, .75, 1.35).toFixed(2); p.noseProj = +g(1, .15, .6, 1.5).toFixed(2); p.noseWidth = +g(1, .12, .75, 1.4).toFixed(2);
  p.lipFull = +g(1, .25, .5, 1.7).toFixed(2); p.mouthW = +g(1, .07, .85, 1.2).toFixed(2); p.eyeSize = +g(1, .08, .8, 1.25).toFixed(2); p.eyeTilt = +g(0, .35, -.8, .8).toFixed(2);
  p.cheekbone = +g(1, .4, 0, 2).toFixed(2); p.jawW = +g(1, .08, .85, 1.25).toFixed(2); p.chinSize = +g(1, .2, .6, 1.5).toFixed(2); p.earSize = +g(1, .12, .8, 1.35).toFixed(2);
  p.browStyle = pick(['thin', 'natural', 'natural', 'arched', 'straight', 'bushy']); p.browThick = +g(1, .2, .6, 1.6).toFixed(2);
  p.mustache = r() < .25 ? pick(['pencil', 'chevron', 'handlebar', 'walrus', 'horseshoe']) : 'none'; p.beardStyle = r() < .25 ? pick(['goatee', 'soul', 'chinstrap', 'chops', 'full', 'long']) : 'none';
  p.irisColor = pick(['#5b7a3c', '#3d6a9e', '#6b4423', '#2e2018', '#7a8a96', '#4f8a6e']);
  let skin = SKINS[Math.floor(r() * SKINS.length)], scale = 0.36;
  // now and then a whole body type from the presets, monsters included when asked
  const kinds = opts.monsters ? MONSTER_PRESETS : BODY_PRESETS;
  const lp = opts.look?.preset;
  if (lp === 'Average adult') { /* keep the random body */ } else if (lp || opts.preset || r() < (opts.monsters ? 0.8 : 0.3)) { const pr = PRESETS[lp || opts.preset || kinds[Math.floor(r() * kinds.length)]]; const { skin: s2, scale: sc, ...rest } = pr; Object.assign(p, rest); if (s2) skin = s2; if (sc) scale = sc; }
  if (opts.look) { const { preset: _p, skin: sk, ...rest } = opts.look; Object.assign(p, rest); if (sk) skin = sk; }
  if (opts.skin) skin = opts.skin;
  return { p, skin, scale };
}
