// SPIRITS — folk-tale spirits crossed with cute animal chimeras: soot sprites, kodama,
// mochi and lantern yokai, will-o'-wisps, moth-rabbits, owl-cats, fox-fish, frog-deer,
// noodle dragons, caterpillar pups and turtles with gardens on their backs. A seeded
// genome picks an archetype and a kit of parts (head animal, ears, crown, tail, wings,
// markings, masks, trinkets). Every pose is drawn as smooth shaded vector shapes at 4×
// the target size, box-filtered down, quantised to the creature's own palette and
// outlined; faces snap to the pixel grid so the eyes stay crisp at 16 px. A third of
// them get ordered dithering and grit. `big` is a smooth 160 px portrait.
import { mulberry32 } from './util.js';

const TAU = Math.PI * 2, F = 4;
export const SPIRIT_PLANS = ['critter', 'guardian', 'kodama', 'puff', 'mochi', 'wisp', 'birdy', 'moth', 'noodle', 'pup', 'shell', 'lantern'];
// the old BEASTS plan names (and the older legacy ones) map onto archetypes
const ALIAS = { quad: 'critter', brute: 'guardian', biped: 'guardian', insect: 'moth', spider: 'puff', serpent: 'noodle', bird: 'birdy', floater: 'wisp', slime: 'mochi', blob: 'mochi', crab: 'shell', centipede: 'pup', totem: 'kodama' };
const WEIGHTS = { critter: 15, guardian: 8, kodama: 7, puff: 9, mochi: 8, wisp: 9, birdy: 9, moth: 8, noodle: 7, pup: 6, shell: 7, lantern: 6 };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ---------------------------------------------------------------- colour
const hsl = (h, s, l) => { h = (((h % 360) + 360) % 360) / 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; };
const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const toward = (h, t, k) => h + ((((t - h) % 360) + 540) % 360 - 180) * k;
// five tones (deep, shade, base, light, shine): shadows lean violet, lights lean warm
function ramp(h, s, l) {
  const dk = l < 35, rgb = [hsl(toward(h, 255, 0.25), s * 0.9 + 8, l * 0.45), hsl(toward(h, 255, 0.13), s + 5, l * 0.71), hsl(h, s, l),
    hsl(toward(h, 60, 0.12), s * 0.95, l + (100 - l) * (dk ? 0.22 : 0.4)), hsl(toward(h, 60, 0.2), s * 0.75, l + (100 - l) * (dk ? 0.45 : 0.75))];
  const r = rgb.map(css); r.rgb = rgb; return r;
}
const hash = (a, b, c) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f) ^ c; h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };

// ---------------------------------------------------------------- genome
// head animals: face shape, ears, nose, tail and markings
const AN = {
  fox: { head: 'snout', ears: 'fox', tail: 'fluffy', nose: 1, whisk: 1, mouth: 'cat', cheeks: 1 },
  cat: { head: 'round', ears: 'cat', tail: 'cat', nose: 1, whisk: 1, mouth: 'cat', cheeks: 1 },
  owl: { head: 'round', ears: 'tufts', tail: 'feather', mouth: 'beak', disc: 1 },
  frog: { head: 'wide', ears: 'none', tail: 'none', mouth: 'smile', bumps: 1 },
  deer: { head: 'snout', ears: 'deer', tail: 'puff', nose: 1, mouth: 'cat', antlers: 1, spots: 1 },
  rabbit: { head: 'round', ears: 'rabbit', tail: 'puff', nose: 1, mouth: 'cat', cheeks: 1 },
  bear: { head: 'round', ears: 'round', tail: 'puff', nose: 1, mouth: 'smile', muzzle: 1 },
  tanuki: { head: 'round', ears: 'round', tail: 'ringed', nose: 1, mouth: 'cat', band: 1, cheeks: 1 },
  axolotl: { head: 'wide', ears: 'gills', tail: 'paddle', mouth: 'smile' },
  lion: { head: 'round', ears: 'round', tail: 'tuft', nose: 1, mouth: 'cat', mane: 1, muzzle: 1 },
  mouse: { head: 'round', ears: 'mouse', tail: 'thin', nose: 1, whisk: 1, mouth: 'cat' },
  dog: { head: 'snout', ears: 'floppy', tail: 'curly', nose: 1, mouth: 'open', muzzle: 1 },
  seal: { head: 'round', ears: 'none', tail: 'flipper', nose: 1, whisk: 1, mouth: 'cat', muzzle: 1 },
  bird: { head: 'round', ears: 'crest', tail: 'feather', mouth: 'beak' },
  dragon: { head: 'snout', ears: 'fins', tail: 'tuft', nose: 1, mouth: 'fang', whisk: 2 },
  fish: { head: 'round', ears: 'fins', tail: 'fish', mouth: 'smile' },
  moth: { head: 'round', ears: 'antennae', tail: 'none', mouth: 'smile' },
  turtle: { head: 'round', ears: 'none', tail: 'none', mouth: 'smile' },
  snail: { head: 'round', ears: 'stalks', tail: 'none', mouth: 'smile' },
  spirit: { head: 'round', ears: 'none', tail: 'none', mouth: 'smile' }
};
const HEADS = {
  critter: ['fox', 'cat', 'deer', 'tanuki', 'lion', 'dog', 'rabbit', 'axolotl', 'frog', 'owl', 'bear', 'mouse', 'fox', 'cat'],
  guardian: ['bear', 'tanuki', 'cat', 'owl', 'rabbit', 'frog', 'spirit'], birdy: ['bird', 'owl', 'bird', 'cat', 'fox', 'bird'],
  moth: ['moth', 'rabbit', 'moth', 'cat', 'mouse'], noodle: ['dragon', 'dragon', 'fox', 'axolotl', 'fish', 'cat'], pup: ['dog', 'cat', 'frog', 'mouse', 'bear', 'moth'],
  shell: ['turtle', 'turtle', 'cat', 'frog', 'snail', 'fox', 'bird'], puff: ['spirit', 'spirit', 'cat', 'bear', 'rabbit', 'owl'], mochi: ['spirit', 'rabbit', 'cat', 'frog', 'spirit'],
  wisp: ['spirit', 'spirit', 'cat', 'fox'], kodama: ['spirit'], lantern: ['spirit']
};
const EXTRAS = ['fish', 'bird', 'moth', 'deer', 'frog', 'axolotl', 'lion', 'turtle', 'fox', 'owl', 'cat', 'rabbit'];
const TONES = { critter: { earthy: 3, pastel: 3, vivid: 2, white: 1, dark: 1 }, guardian: { earthy: 3, pastel: 2, dark: 2, white: 1, vivid: 1 }, kodama: { white: 7, pastel: 2, earthy: 1 },
  puff: { dark: 6, pastel: 2, vivid: 1, white: 1 }, mochi: { pastel: 5, white: 2, vivid: 1 }, wisp: { vivid: 3, pastel: 2, white: 3, dark: 2 }, birdy: { pastel: 3, earthy: 2, vivid: 2, white: 1 },
  moth: { pastel: 4, white: 2, earthy: 1, vivid: 1 }, noodle: { vivid: 3, pastel: 3, white: 1, dark: 1 }, pup: { vivid: 3, pastel: 3, earthy: 1 }, shell: { earthy: 2, pastel: 2, vivid: 1 }, lantern: { vivid: 2, pastel: 2, white: 3 } };
const SL = { pastel: [45, 70, 70, 80], vivid: [60, 82, 50, 60], earthy: [26, 48, 40, 54], white: [8, 22, 87, 92], dark: [16, 32, 15, 22] };

export function genome(seed, hue = 0, tier = 0, opts = {}) {
  const R = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x5bd1e995) >>> 0), r = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length)], ch = (p) => R() < p;
  const wp = (o) => { let t = R() * Object.values(o).reduce((a, b) => a + b, 0); for (const k in o) if ((t -= o[k]) <= 0) return k; return Object.keys(o)[0]; };
  const plan = ALIAS[opts.plan] || (SPIRIT_PLANS.includes(opts.plan) ? opts.plan : wp(WEIGHTS));
  tier = Math.max(0, Math.min(4, tier | 0));
  const g = { seed, plan, tier, sub: '', B: '', tails: 1 };
  g.A = opts.head && AN[opts.head] ? opts.head : pick(HEADS[plan]);
  if (plan === 'critter' || (plan === 'guardian' && ch(0.4)) || (plan === 'birdy' && ch(0.4)) || (plan === 'pup' && ch(0.3)) || (plan === 'noodle' && ch(0.3))) g.B = pick(EXTRAS.filter((e) => e !== g.A));
  const a = AN[g.A];
  Object.assign(g, { headShape: a.head, ears: a.ears, tail: a.tail, nose: !!a.nose, whisk: a.whisk || 0, mouth: a.mouth, disc: !!a.disc, bumps: !!a.bumps, band: !!a.band, muzzle: !!a.muzzle, mane: !!a.mane, cheeks: !!a.cheeks, spots: !!a.spots && ch(0.6) });
  g.crown = a.antlers && ch(0.7) ? 'antlers' : 'none';
  // archetype rules
  g.float = ['wisp', 'moth', 'noodle'].includes(plan);
  g.loco = { critter: 'walk', guardian: 'waddle', kodama: 'waddle', puff: 'hop', mochi: 'hop', wisp: 'float', birdy: 'hop', moth: 'float', noodle: 'float', pup: 'inch', shell: 'walk', lantern: 'float' }[plan];
  g.atk = { critter: 'pounce', guardian: 'lunge', kodama: 'flare', puff: 'pounce', mochi: 'spit', wisp: 'flare', birdy: 'peck', moth: 'flare', noodle: 'lunge', pup: 'lunge', shell: 'lunge', lantern: 'flare' }[plan];
  g.die = { critter: 'flop', guardian: 'flop', kodama: 'fade', puff: 'squish', mochi: 'squish', wisp: 'fade', birdy: 'flop', moth: 'fade', noodle: 'fade', pup: 'flop', shell: 'flop', lantern: 'fade' }[plan];
  g.len = r(0.9, 1.1); g.fat = r(0.9, 1.15); g.hr = r(0.92, 1.12); g.leg = r(0, 1); g.legW = r(0.85, 1.2); g.fluff = r(0, 1); g.turn = r(0.12, 0.3);
  g.eye = 'bean'; g.eyeS = r(1.05, 1.45); g.blush = ch(0.75); g.one = false;
  const tone = opts.tone || wp(TONES[plan]); g.tone = tone;
  if (plan === 'puff') { g.legs = opts.plan === 'spider' ? 6 + 2 * Math.floor(R() * 2) : ch(0.55) ? pick([2, 4, 6]) : 0; if (g.legs) g.loco = 'walk'; g.fluff = r(0.6, 1); g.turn = r(0.04, 0.14); g.spiky = tone === 'dark' || ch(0.3); g.mouth = pick(['none', 'smile', 'cat', 'none']); g.hold = ch(0.3) ? 'star' : ''; }
  if (plan === 'mochi') { g.sub = pick(['dome', 'dome', 'drop', 'jelly']); g.turn = r(0.05, 0.15); g.mouth = pick(['cat', 'smile', 'open', 'cat']); g.crown = g.A === 'rabbit' ? 'none' : pick(['leaf', 'sprout', 'none', 'flower', 'cherry']); }
  if (plan === 'wisp') { g.sub = pick(['flame', 'flame', 'ghost', 'jelly', 'mask']); g.turn = r(0.04, 0.14); g.mouth = pick(['smile', 'cat', 'none', 'open']); if (g.sub === 'mask') { g.mask = 'face'; g.tone = tone === 'white' ? 'dark' : tone; } }
  if (plan === 'kodama') { g.eye = 'hollow'; g.mouth = 'o'; g.turn = r(-0.05, 0.12); g.eyeS = r(1.1, 1.5); g.blush = ch(0.3); g.crown = pick(['sprout', 'sprout', 'leaf', 'flower', 'mushroom', 'acorn', 'none']); g.sub = pick(['round', 'tall', 'wide']); }
  if (plan === 'lantern') { g.sub = pick(['chochin', 'chochin', 'kasa', 'kettle']); g.one = g.sub === 'kasa' || ch(0.45); g.mouth = 'tongue'; g.turn = r(0.02, 0.12); if (g.sub === 'kasa') g.loco = 'hop'; if (g.sub === 'kettle') { g.loco = 'walk'; g.A = 'tanuki'; Object.assign(g, { ears: 'round', tail: 'ringed', nose: true, mouth: 'cat', band: ch(0.5), one: false }); g.atk = 'spit'; g.die = 'flop'; } }
  if (plan === 'guardian') { g.turn = r(0.06, 0.18); g.belly = 1; g.chev = ch(0.6); g.hold = ch(0.35) ? pick(['leaf', 'leaf', 'acorn', 'lantern']) : ''; if (g.A === 'spirit') g.ears = pick(['cat', 'round', 'rabbit', 'tufts']); }
  if (plan === 'birdy') { g.belly = 1; g.turn = r(0.12, 0.26); g.wings = 'feather'; if (g.B === 'turtle') g.shellBack = 1; if (g.A === 'cat' || g.A === 'fox') { g.mouth = 'beak'; g.tail = 'feather'; } }
  if (plan === 'moth') { g.wings = 'moth'; g.turn = r(0.03, 0.12); g.ears = g.A === 'moth' ? 'antennae' : AN[g.A].ears; g.tail = 'none'; g.collar = 1; g.eye = ch(0.4) ? 'soot' : 'bean'; }
  if (plan === 'noodle') { g.turn = r(0.15, 0.3); g.tail = pick(['tuft', 'fish', 'tuft', 'wisp']); g.fin = ch(0.5); g.paws = ch(0.6); if (g.A === 'dragon') g.crown = pick(['horns', 'antlers', 'horns', 'none']); g.whisk = g.A === 'dragon' || ch(0.3) ? 2 : g.whisk; }
  if (plan === 'pup') { g.segs = 3 + Math.floor(R() * 3) + (opts.plan === 'centipede' ? 1 : 0); g.turn = r(0.15, 0.3); if (g.A === 'moth') { g.ears = 'antennae'; g.A = 'caterpillar'; } g.tail = 'none'; g.crown = ch(0.35) ? pick(['leaf', 'flower', 'sprout']) : 'none'; }
  if (plan === 'shell') { g.sub = g.A === 'snail' ? 'snail' : 'turtle'; g.turn = r(0.15, 0.3); g.garden = pick(['moss', 'flower', 'mushroom', 'tree', 'shrine', 'sprout']); g.tail = 'none'; if (g.A === 'turtle') g.mouth = pick(['smile', 'cat', 'beak']); g.crown = 'none'; }
  // chimera extras
  const B = g.B;
  if (B === 'fish') { g.tail = 'fish'; if (plan === 'critter') g.fin = 1; }
  else if (B === 'bird' || B === 'owl') { if (plan !== 'birdy') g.wings = 'feather'; if (B === 'owl' && g.ears === 'none') g.ears = 'tufts'; if (B === 'bird' && ch(0.5)) g.tail = 'feather'; }
  else if (B === 'moth') { g.wings = 'moth'; if (g.ears === 'none' || ch(0.3)) g.ears = 'antennae'; }
  else if (B === 'deer') { g.crown = 'antlers'; g.spots = ch(0.6); }
  else if (B === 'frog') { g.spots = 1; if (g.mouth !== 'beak') g.mouth = 'smile'; }
  else if (B === 'axolotl') { g.ears = g.ears === 'none' || ch(0.6) ? 'gills' : g.ears; g.tail = 'paddle'; }
  else if (B === 'lion') { g.mane = 1; g.tail = 'tuft'; }
  else if (B === 'turtle') g.shellBack = 1;
  else if (B === 'fox') g.tail = 'fluffy';
  else if (B === 'cat') { g.tail = 'cat'; if (g.ears === 'none') g.ears = 'cat'; }
  else if (B === 'rabbit') { g.ears = 'rabbit'; g.tail = 'puff'; }
  // spirit flourishes
  g.glowy = ['wisp', 'lantern', 'kodama'].includes(plan) || tier >= 2 || ch(0.25);
  if (g.tail === 'fluffy' && (g.A === 'fox' || B === 'fox') && (tier >= 1 || ch(0.3))) g.tails = Math.min(5, 1 + tier + (ch(0.4) ? 1 : 0));
  if (g.crown === 'none' && !['shell', 'lantern', 'wisp'].includes(plan) && ch(0.42 + tier * 0.1)) g.crown = pick(['sprout', 'flower', 'leaf', 'mushroom', 'horns', 'flame', 'acorn', 'flower', 'sprout']);
  if (tier >= 4 && plan !== 'lantern') g.halo = 1;
  if (!g.mask && ['critter', 'guardian', 'kodama', 'puff'].includes(plan) && ch(0.1 + tier * 0.03)) g.mask = plan === 'kodama' && ch(0.5) ? 'face' : 'side';
  g.fmark = ch(0.28 + tier * 0.1) ? pick(['dot', 'diamond', 'crescent', 'flame', 'tomoe', 'dot']) : '';
  g.kitsune = (g.A === 'fox' || B === 'fox' || plan === 'wisp') && ch(0.45);
  g.bodyMark = plan === 'kodama' ? '' : pick(['', '', 'spots', 'stripes', 'socks', '', 'runes']);
  if (g.bodyMark === 'runes' && !g.glowy) g.bodyMark = '';
  if (g.spots) g.bodyMark = 'spots';
  g.trinket = ['critter', 'guardian', 'puff', 'birdy', 'pup', 'kodama'].includes(plan) && ch(0.22 + tier * 0.08) ? pick(['bib', 'bib', 'bell', 'scarf', tier >= 2 ? 'rope' : 'bib']) : '';
  if (tier >= 3 && !g.trinket && ['critter', 'guardian', 'kodama', 'shell'].includes(plan)) g.trinket = 'rope';
  if (g.eye === 'bean') g.eye = tone === 'dark' ? (ch(0.6) ? 'soot' : 'glow') : ch(0.3) ? 'sparkle' : (g.glowy && plan !== 'kodama' && ch(0.18)) ? 'glow' : 'bean';
  if (g.band && g.eye === 'bean') g.eye = 'sparkle';
  if (g.mask === 'face') g.eye = 'glow';
  if (g.eye === 'soot') g.eyeS *= r(1.05, 1.25);
  // colours
  const [s0, s1, l0, l1] = SL[g.tone], h = hue + r(-22, 22), s = r(s0, s1), l = r(l0, l1);
  g.hue = ((h % 360) + 360) % 360;
  g.body = ramp(h, s, l);
  g.belly = g.tone === 'white' ? ramp(h + 30, 30, 96) : g.tone === 'dark' ? ramp(h + 10, s * 0.7, Math.min(46, l + 18)) : ramp(h + 25, Math.min(s, 45) * 0.6 + 12, Math.max(l + 16, 86));
  const ah = h + pick([35, -35, 150, 180, 205, -150, 40]);
  g.acc = ramp(ah, r(55, 80), r(55, 68));
  const gh = pick([h + 180, 50, 185, 320, 95, 35, h + 150, h]);
  g.glow = ramp(gh, 95, r(58, 66));
  g.leaf = ramp(r(84, 138), r(42, 62), r(40, 52));
  g.petal = ramp(pick([340, 325, 48, 205, 0, 350, 280]), r(60, 85), r(74, 84));
  g.horn = g.glowy && ch(0.3) ? g.glow : ramp(r(28, 42), r(18, 35), r(66, 80));
  g.pupilC = css(hsl(toward(h, 250, 0.7), 40, 9)); g.whiteC = css(hsl(h, 30, 97)); g.irisC = css(hsl(gh, 80, 50)); g.blushC = css(hsl(350, 85, 78));
  g.tongueC = css(hsl(352, 75, 62)); g.beak = ramp(r(30, 46), 88, 60); g.noseC = g.tone === 'dark' ? g.belly[1] : ch(0.5) ? css(hsl(345, 60, 62)) : g.pupilC;
  g.outRGB = hsl(toward(h, 262, 0.45), 42, g.tone === 'dark' ? 6 : 12); g.inkC = css(mix(g.body.rgb[0], g.outRGB, 0.45));
  if (typeof opts.outline === 'string' && /^#[0-9a-f]{6}$/i.test(opts.outline)) g.outRGB = [1, 3, 5].map((i) => parseInt(opts.outline.slice(i, i + 2), 16));
  g.line = opts.outline !== false;
  g.rim = g.glowy ? g.glow[3] : '';
  // finish: a third get ordered dithering and grit
  const rough = ch(0.33);
  g.dither = opts.dither ?? rough;
  g.grit = opts.grit === true ? 0.7 : opts.grit === false ? 0 : typeof opts.grit === 'number' ? opts.grit : rough ? r(0.4, 1) : 0;
  g.species = species(g); g.name = spiritName(g, R); g.element = element(g);
  g.uses = { glow: g.glowy || g.eye === 'glow' || g.tail === 'wisp' || g.crown === 'flame' || g.halo || g.fmark || g.kitsune || tier >= 3 || ['wisp', 'lantern', 'moth'].includes(plan), leaf: ['sprout', 'leaf', 'flower'].includes(g.crown) || plan === 'shell' || g.hold === 'leaf', petal: ['flower', 'mushroom', 'cherry'].includes(g.crown) || plan === 'shell' || plan === 'moth' || g.hold === 'star', horn: ['antlers', 'horns', 'acorn'].includes(g.crown) || g.hold === 'acorn', beak: g.mouth === 'beak' || plan === 'birdy' || g.trinket === 'bell' || plan === 'lantern' };
  return g;
}
function species(g) {
  const P = { puff: g.tone === 'dark' ? 'soot sprite' : 'fuzzball', mochi: g.sub === 'jelly' ? 'jelly spirit' : 'mochi spirit', wisp: { flame: "will-o'-wisp", ghost: 'little ghost', jelly: 'sky jelly', mask: 'masked spirit' }[g.sub], kodama: 'kodama', lantern: { chochin: 'lantern yokai', kasa: 'umbrella yokai', kettle: 'teakettle tanuki' }[g.sub], guardian: 'forest guardian', moth: 'moth', noodle: 'sky dragon', pup: 'caterpillar pup', shell: g.sub === 'snail' ? 'garden snail' : 'garden turtle', birdy: 'bird', critter: '' }[g.plan];
  const A = g.A === 'spirit' ? '' : g.A;
  if (g.plan === 'critter') return g.B ? `${A}-${g.B}` : A;
  if (['moth', 'birdy', 'noodle', 'pup', 'guardian'].includes(g.plan) && A && !['moth', 'bird', 'dragon'].includes(A)) return `${P.split(' ').pop()}-${A}`.replace('pup-', 'caterpillar-');
  return g.plan === 'kodama' || g.plan === 'lantern' || !A || A === 'tanuki' && g.plan === 'lantern' ? P : `${A} ${P}`;
}
const FRAG = { fox: ['Fox', 'Kit', 'Vix'], cat: ['Mew', 'Purr', 'Tabby'], owl: ['Hoot', 'Owl'], frog: ['Rib', 'Frog', 'Croak'], deer: ['Fawn', 'Doe'], rabbit: ['Bun', 'Hop', 'Lop'], bear: ['Bear', 'Bru'], tanuki: ['Nuki', 'Tanu'], axolotl: ['Axo', 'Lotl'], lion: ['Leo', 'Mane'], mouse: ['Pip', 'Squeak'], dog: ['Pup', 'Woof'], seal: ['Seal', 'Pinn'], bird: ['Wren', 'Chirp'], fish: ['Fin', 'Koi', 'Gill'], moth: ['Moth', 'Dust'], turtle: ['Shell', 'Turt'], dragon: ['Ryu', 'Drake'], snail: ['Swirl', 'Snail'], caterpillar: ['Wiggle', 'Grub'] };
const SPIRIT = { puff: ['Soot', 'Fuzz', 'Smudge'], mochi: ['Mochi', 'Dango', 'Jelly'], wisp: ['Wisp', 'Flick', 'Boo'], kodama: ['Koda', 'Twig', 'Kono'], lantern: ['Chochi', 'Kasa', 'Glim'], guardian: ['Toto', 'Moss', 'Bumble'], moth: ['Moth'], noodle: ['Ryu'], pup: ['Wiggle'], shell: ['Shell'], birdy: ['Wren'], critter: ['Kit'] };
const TAIL = ['ling', 'kin', 'bo', 'maru', 'pon', 'chi', 'let', 'mo', 'ko', 'puff'];
function spiritName(g, R) {
  const pick = (a) => a[Math.floor(R() * a.length)], A = FRAG[g.A] ? pick(FRAG[g.A]) : pick(SPIRIT[g.plan]), B = g.B && FRAG[g.B] ? pick(FRAG[g.B]) : '';
  const n = B && R() < 0.85 ? A + B.toLowerCase() : A + pick(TAIL);
  return n.length > 10 ? n.slice(0, 10) : n;
}
function element(g) {
  if (g.plan === 'wisp' || g.plan === 'lantern' && g.sub !== 'kettle' || g.crown === 'flame' || g.tail === 'wisp') return 'fire';
  if (g.tone === 'dark') return 'shadow';
  if (['fish', 'axolotl', 'frog'].includes(g.B) || ['axolotl', 'frog', 'fish', 'seal'].includes(g.A) || g.plan === 'noodle' || g.plan === 'mochi' && g.sub === 'jelly') return 'water';
  if (g.plan === 'kodama' || g.plan === 'pup' || ['sprout', 'leaf', 'flower', 'mushroom'].includes(g.crown) || g.plan === 'shell' && g.garden !== 'shrine') return 'leaf';
  if (g.plan === 'moth' || g.plan === 'birdy' || g.wings) return 'wind';
  if (g.halo || g.mask || g.eye === 'glow') return 'spirit';
  return g.plan === 'guardian' || g.plan === 'shell' ? 'earth' : 'beast';
}

// ---------------------------------------------------------------- drawing kit
// Shapes are drawn in "units": the ground is y = 0, up is negative, the creature faces right and
// stands about one unit tall. Q.F > 0 means a pixel frame drawn at F hi-res pixels per target
// pixel, so the face is placed on the target grid; Q.F = 0 is smooth (portrait, probes).
let X, G, Q;
const px = (n) => n * Q.u;
const rng = (k) => mulberry32((Math.imul(G.seed | 0, 31) + k * 7919) >>> 0);
const dk = (R) => R.dk || (R.dk = [R[0], R[0], R[1], R[2], R[3]]);
function E(cx, cy, rx, ry, rot = 0, p = new Path2D()) { p.ellipse(cx, cy, Math.max(1e-4, Math.abs(rx)), Math.max(1e-4, Math.abs(ry)), rot, 0, TAU); return p; }
// smooth curve through points (Catmull-Rom as Béziers)
function curve(pts, closed = true, p = new Path2D()) {
  const n = pts.length, at = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) { const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2); p.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]); }
  if (closed) p.closePath();
  return p;
}
function poly(pts, close = true, p = new Path2D()) { pts.forEach(([a, b], i) => (i ? p.lineTo(a, b) : p.moveTo(a, b))); if (close) p.closePath(); return p; }
// an ellipse whose edge breaks into tufts of fur (soft bumps, or spikes for soot)
function furE(cx, cy, rx, ry, n, len, k, spiky = false) {
  const R = rng(k), pts = [], off = R() * TAU;
  for (let i = 0; i < n * 2; i++) { const a = off + (i / (n * 2)) * TAU, tip = i & 1, f = tip ? 1 + len * (0.55 + R() * 0.9) : 1 - len * 0.2; pts.push([cx + Math.cos(a) * rx * f - (tip ? len * rx * 0.3 : 0), cy + Math.sin(a) * ry * f]); }
  return spiky ? poly(pts) : curve(pts);
}
// a tapered tube along a centreline, optionally fluffy
function tube(pts, rad, fuzz = 0, k = 0) {
  const n = pts.length, L = [], Rr = [], R = rng(k + 500);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const f1 = fuzz && i & 1 ? 1 + fuzz * (0.5 + R()) : 1, f2 = fuzz && i & 1 ? 1 + fuzz * (0.5 + R()) : 1, r = rad[i];
    L.push([pts[i][0] - dy * r * f1, pts[i][1] + dx * r * f1]); Rr.push([pts[i][0] + dy * r * f2, pts[i][1] - dx * r * f2]);
  }
  const cap = (e, p, r) => { const d = Math.hypot(e[0] - p[0], e[1] - p[1]) || 1; return [e[0] + (e[0] - p[0]) / d * r * 0.9, e[1] + (e[1] - p[1]) / d * r * 0.9]; };
  return curve([...L, cap(pts[n - 1], pts[n - 2], rad[n - 1]), ...Rr.reverse(), cap(pts[0], pts[1], rad[0])]);
}
// a centreline from (x, y) heading `a`, bending by `bend` over its length
function spine(x, y, a, len, bend, n = 8) { const pts = [[x, y]], st = len / n; for (let i = 1; i <= n; i++) { a += bend / n; x += Math.cos(a) * st; y += Math.sin(a) * st; pts.push([x, y]); } return pts; }
const bbox = (pts, pad) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [a, b] of pts) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); } return [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + pad, (y1 - y0) / 2 + pad]; };
function leafP(x0, y0, a, len, wid) { const c = Math.cos(a), s = Math.sin(a), mx = x0 + c * len * 0.5, my = y0 + s * len * 0.5, p = new Path2D(); p.moveTo(x0, y0); p.quadraticCurveTo(mx - s * wid * 2, my + c * wid * 2, x0 + c * len, y0 + s * len); p.quadraticCurveTo(mx + s * wid * 2, my - c * wid * 2, x0, y0); p.closePath(); return p; }
const fill = (p, c) => { X.fillStyle = c; X.fill(p); };
function line(pts, w, c, smooth = false) { const p = smooth ? curve(pts, false) : poly(pts, false); X.strokeStyle = c; X.lineWidth = Math.max(w, px(1)); X.lineCap = 'round'; X.lineJoin = 'round'; X.stroke(p); }
function ink(p, w = 2) { if (!Q.ink) return; X.strokeStyle = G.inkC; X.lineWidth = px(w); X.lineJoin = 'round'; X.stroke(p); }
// base tone, a shadow crescent away from the light (top-left), a soft light, optional gloss and rim light
function solid(p, Rm, cx, cy, rx, ry, o = {}) {
  const x = X; x.fillStyle = Rm[2]; x.fill(p);
  x.save(); x.clip(p);
  if (o.sh !== 0) {
    const k = o.sh || 1, q = new Path2D(); q.rect(cx - rx * 3, cy - ry * 3, rx * 6, ry * 6); E(cx - rx * 0.2 * k, cy - ry * 0.3 * k, rx * 1.04, ry * 1.02, 0, q); x.fillStyle = Rm[1]; x.fill(q, 'evenodd');
    if (o.deep) { const q2 = new Path2D(); q2.rect(cx - rx * 3, cy - ry * 3, rx * 6, ry * 6); E(cx - rx * 0.06, cy - ry * 0.15, rx * 1.03, ry * 1.04, 0, q2); x.fillStyle = Rm[0]; x.fill(q2, 'evenodd'); }
  }
  if (o.hi !== 0) { x.fillStyle = Rm[3]; x.fill(E(cx - rx * 0.3, cy - ry * 0.42, rx * 0.45, ry * 0.3, -0.35)); }
  if (o.gloss) { x.fillStyle = Rm[4]; x.fill(E(cx - rx * 0.42, cy - ry * 0.5, rx * 0.17, ry * 0.11, -0.5)); }
  const rim = o.rim ?? G.rim;
  if (rim) { x.strokeStyle = rim; x.lineWidth = 2 * Math.max(Math.min(rx, ry) * 0.08, px(1)); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0.15, 1.6); x.stroke(); }
  x.restore();
}
// ---- the target pixel grid (faces stay crisp when shrunk)
function dev(a, b) { const m = X.getTransform(); return [m.a * a + m.c * b + m.e, m.b * a + m.d * b + m.f, m]; }
const hpx = (len) => { if (!Q.F) return 99; const m = X.getTransform(); return len * Math.hypot(m.a, m.b) / Q.F; };
function grid(cx, cy, w, h, mw, mh, cb) {
  const [dx, dy, m] = dev(cx, cy), f = Q.F, W = Math.abs(m.a) * w + Math.abs(m.c) * h, H = Math.abs(m.b) * w + Math.abs(m.d) * h;
  const tw = Math.max(mw, Math.round(W / f)), th = Math.max(mh, Math.round(H / f));
  X.save(); X.setTransform(1, 0, 0, 1, 0, 0); cb(Math.round(dx / f - tw / 2), Math.round(dy / f - th / 2), tw, th); X.restore();
}
const pix = (L, T, w, h, c) => { if (w > 0 && h > 0) { X.fillStyle = c; X.fillRect(L * Q.F, T * Q.F, w * Q.F, h * Q.F); } };
function stamp(cx, cy, rows, cols) {
  const [dx, dy] = dev(cx, cy), f = Q.F, h = rows.length, w = rows[0].length, L = Math.round(dx / f - w / 2), T = Math.round(dy / f - h / 2);
  X.save(); X.setTransform(1, 0, 0, 1, 0, 0);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = cols[rows[j][i]]; if (c) { X.fillStyle = c; X.fillRect((L + i) * f, (T + j) * f, f, f); } }
  X.restore();
}

// ---------------------------------------------------------------- faces
function eye(cx, cy, w, h, far, skin) {
  const g = G, st = Q.eyes, k = g.eye, D = g.pupilC, Wc = g.whiteC, open = st === 'open' || st === 'angry', x = X;
  if (Q.F) return grid(cx, cy, w, h, k === 'soot' && open ? 2 : 1, open ? 2 : 1, (L, T, tw, th) => {
    if (!open) {
      const my = T + (th >> 1);
      if (tw < 3 || th < 3) return pix(L, my, Math.max(2, tw), 1, D);
      const x0 = L + ((tw - 3) >> 1);
      if (st === 'x') { for (const [a, b] of [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]]) pix(x0 + a, my - 1 + b, 1, 1, D); return; }
      if (st === 'calm') { pix(x0, my - 1, 1, 1, D); pix(x0 + 1, my, 1, 1, D); pix(x0 + 2, my - 1, 1, 1, D); return; }
      const a = far ? 1 : 0; pix(x0 + a, my - 1, 1, 1, D); pix(x0 + 1 - a, my, 1, 1, D); pix(x0 + a, my + 1, 1, 1, D); return;
    }
    const rd = tw >= 4 && th >= 4, body = (c) => { pix(L, T + (rd ? 1 : 0), tw, th - (rd ? 2 : 0), c); if (rd) { pix(L + 1, T, tw - 2, 1, c); pix(L + 1, T + th - 1, tw - 2, 1, c); } };
    if (k === 'soot') { body(Wc); const pw = Math.max(1, Math.round(tw * 0.5)), ph = Math.max(1, Math.round(th * 0.55)); pix(L + tw - pw - (tw >= 4 ? 1 : 0), T + ((th - ph + 1) >> 1), pw, ph, D); }
    else if (k === 'glow') { body(g.glow[2]); if (th >= 3) pix(L + Math.max(0, (tw >> 1) - (tw >= 4 ? 1 : 0)), T + 1, tw >= 4 ? 2 : 1, th - 2, g.glow[4]); }
    else {
      body(D); if (k === 'sparkle' && th >= 4) pix(L + (rd ? 1 : 0), T + th - 2, tw - (rd ? 2 : 0), 1, g.irisC);
      if (k !== 'hollow' && tw >= 2) { const s = tw >= 6 ? 2 : 1; pix(L + (tw >= 4 ? 1 : 0), T + (th >= 4 ? 1 : 0), s, s, Wc); if (tw >= 4 && th >= 5) pix(L + tw - 2, T + th - 3, 1, 1, Wc); }
    }
    if (st === 'angry') { pix(L, T, tw, 1, skin); if (tw >= 3 && th >= 3) pix(far ? L : L + tw - 1, T + 1, 1, 1, skin); }
  });
  if (!open) {
    x.strokeStyle = D; x.lineWidth = Math.max(w * 0.3, px(1)); x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath();
    if (st === 'x') { const q = w * 0.55; x.moveTo(cx - q, cy - q); x.lineTo(cx + q, cy + q); x.moveTo(cx + q, cy - q); x.lineTo(cx - q, cy + q); }
    else if (st === 'calm') x.arc(cx, cy - h * 0.3, w * 0.6, 0.5, Math.PI - 0.5);
    else { const d = far ? -1 : 1; x.moveTo(cx - d * w * 0.5, cy - h * 0.4); x.lineTo(cx + d * w * 0.45, cy); x.lineTo(cx - d * w * 0.5, cy + h * 0.4); }
    x.stroke(); return;
  }
  const p = E(cx, cy, w / 2, h / 2);
  if (k === 'soot') { fill(p, Wc); fill(E(cx + w * 0.12, cy + h * 0.03, w * 0.24, h * 0.26), D); fill(E(cx + w * 0.04, cy - h * 0.1, w * 0.08, w * 0.08), Wc); }
  else if (k === 'glow') {
    if (Q.big) { const gr = x.createRadialGradient(cx, cy, 0, cx, cy, w * 1.3); gr.addColorStop(0, g.glow[3]); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fill(E(cx, cy, w * 1.3, w * 1.3)); }
    fill(p, g.glow[2]); fill(E(cx, cy, w * 0.2, h * 0.3), g.glow[4]);
  } else {
    fill(p, D); if (k === 'sparkle') { x.save(); x.clip(p); fill(E(cx, cy + h * 0.42, w * 0.55, h * 0.35), g.irisC); x.restore(); }
    if (k !== 'hollow') { fill(E(cx - w * 0.15, cy - h * 0.2, w * 0.21, w * 0.21), Wc); fill(E(cx + w * 0.17, cy + h * 0.2, w * 0.09, w * 0.09), Wc); }
  }
  if (st === 'angry') { const d = far ? -1 : 1; x.fillStyle = skin; x.beginPath(); x.moveTo(cx - w, cy - h); x.lineTo(cx + w, cy - h); x.lineTo(cx + w, cy - h * (d > 0 ? 0.05 : 0.5)); x.lineTo(cx - w, cy - h * (d > 0 ? 0.5 : 0.05)); x.closePath(); x.fill(); }
}
function mouthAt(mx, my, r, skin) {
  const g = G, open = Q.A.mouth > 0.5, k = open && g.mouth !== 'beak' && g.mouth !== 'tongue' ? 'open' : g.mouth, hp = hpx(r), x = X;
  if (k === 'none') return;
  if (Q.F) {
    const C = { x: g.pupilC, t: g.tongueC, w: g.whiteC, b: g.beak[2], B: g.beak[0] }; let rows;
    if (k === 'beak') rows = open ? (hp >= 8 ? ['bbb', 'x..', 'BB.'] : ['bb', 'x.', 'B.']) : hp >= 9 ? ['bbb', 'BB.'] : hp >= 4 ? ['bb', 'B.'] : ['b'];
    else if (k === 'open') rows = hp >= 12 ? ['xxxx', 'xttx', '.tt.'] : hp >= 6 ? ['xxx', '.t.'] : ['x'];
    else if (k === 'tongue') rows = hp >= 10 ? ['xxxx', '.tt.', '.tt.', '..t.'] : hp >= 6 ? ['xxx', '.t.', '.t.'] : ['x', 't'];
    else if (k === 'o') rows = hp >= 11 ? ['.xx.', 'xxxx', '.xx.'] : hp >= 6 ? ['xx', 'xx'] : ['x'];
    else if (hp < 6) return;
    else if (k === 'cat') rows = hp >= 11 ? ['x.x.x', '.x.x.'] : ['x.x', '.x.'];
    else if (k === 'fang') rows = hp >= 10 ? ['x...x', '.xxx.', '.w...'] : ['x.x', 'wx.'];
    else rows = hp >= 11 ? ['x...x', '.xxx.'] : ['x.x', '.x.'];
    return stamp(mx, my, rows, C);
  }
  const s = r * 0.13; x.strokeStyle = g.pupilC; x.lineWidth = Math.max(r * 0.055, px(1)); x.lineCap = 'round'; x.lineJoin = 'round';
  if (k === 'beak') { fill(curve([[mx - s, my - s * 0.9], [mx + s * 1.5, my - s * 0.15], [mx - s * 0.9, my + s * 0.75]]), g.beak[2]); fill(curve([[mx - s * 0.9, my + s * 0.05], [mx + s * 1.2, my + s * 0.05], [mx - s * 0.8, my + s * 0.75]]), g.beak[1]); if (open) fill(E(mx, my + s * 0.1, s * 0.7, s * 0.18), g.pupilC); }
  else if (k === 'open') { const p = new Path2D(); p.moveTo(mx - s * 1.3, my - s * 0.4); p.quadraticCurveTo(mx, my - s * 0.1, mx + s * 1.3, my - s * 0.4); p.quadraticCurveTo(mx, my + s * 2.4, mx - s * 1.3, my - s * 0.4); fill(p, g.pupilC); x.save(); x.clip(p); fill(E(mx, my + s * 1.4, s * 0.9, s * 0.7), g.tongueC); x.restore(); }
  else if (k === 'tongue') { const p = new Path2D(); p.moveTo(mx - s * 1.6, my - s * 0.3); p.quadraticCurveTo(mx, my + s * 1.2, mx + s * 1.6, my - s * 0.3); p.quadraticCurveTo(mx, my + s * 0.4, mx - s * 1.6, my - s * 0.3); fill(p, g.pupilC); fill(curve([[mx - s * 0.7, my + s * 0.3], [mx + s * 0.5, my + s * 0.3], [mx + s * 0.55, my + s * 1.9], [mx - s * 0.1, my + s * 2.6], [mx - s * 0.7, my + s * 1.6]]), g.tongueC); }
  else if (k === 'o') fill(E(mx, my + s * 0.3, s * 0.85, s), g.pupilC);
  else {
    x.beginPath();
    if (k === 'cat') { x.moveTo(mx - s * 1.4, my - s * 0.3); x.quadraticCurveTo(mx - s * 0.7, my + s * 0.9, mx, my); x.quadraticCurveTo(mx + s * 0.7, my + s * 0.9, mx + s * 1.4, my - s * 0.3); }
    else { x.moveTo(mx - s * 1.3, my - s * 0.2); x.quadraticCurveTo(mx, my + s * 1.1, mx + s * 1.3, my - s * 0.2); }
    x.stroke();
    if (k === 'fang') fill(poly([[mx - s * 0.75, my + s * 0.2], [mx - s * 0.2, my + s * 0.35], [mx - s * 0.5, my + s * 1.0]]), g.whiteC);
  }
}
function noseAt(nx, ny, r) { if (Q.F) { const hp = hpx(r); if (hp >= 7) stamp(nx, ny, hp >= 13 ? ['xx'] : ['x'], { x: G.noseC }); return; } const s = r * 0.09; fill(curve([[nx - s, ny - s * 0.5], [nx + s, ny - s * 0.5], [nx, ny + s * 0.6]]), G.noseC); }
function blushAt(bx, by, r) { if (!G.blush) return; if (Q.F) { const hp = hpx(r); if (hp >= 6) stamp(bx, by, hp >= 11 ? ['xx'] : ['x'], { x: G.blushC }); return; } X.globalAlpha = Q.big ? 0.7 : 1; fill(E(bx, by, r * 0.15, r * 0.085), G.blushC); X.globalAlpha = 1; }
function fmark(cx, cy, r) {
  const g = G, c = g.glowy ? g.glow[3] : g.acc[2], k = g.fmark, s = r * 0.1;
  if (Q.F && hpx(r) < 9) return stamp(cx, cy, k === 'diamond' || k === 'flame' ? ['x', 'x'] : ['x'], { x: c });
  if (k === 'dot') fill(E(cx, cy, s, s), c);
  else if (k === 'diamond') fill(poly([[cx, cy - s * 1.6], [cx + s, cy], [cx, cy + s * 1.6], [cx - s, cy]]), c);
  else if (k === 'crescent') { fill(E(cx, cy, s * 1.3, s * 1.3), c); fill(E(cx + s * 0.55, cy - s * 0.45, s * 1.1, s * 1.1), g.body[2]); }
  else if (k === 'flame') fill(curve([[cx - s, cy + s], [cx - s * 0.8, cy - s * 0.3], [cx + s * 0.2, cy - s * 2], [cx + s, cy - s * 0.2], [cx + s * 0.9, cy + s]]), c);
  else { fill(E(cx, cy + s * 0.3, s * 0.95, s * 0.95), c); line(spine(cx + s * 0.8, cy + s * 0.2, -Math.PI / 2, s * 1.6, -1.6, 4), s * 0.6, c, true); }
}
function face(r, rx, ry, o) {
  const g = G, t = o.turn ?? g.turn, wide = g.headShape === 'wide', snout = g.headShape === 'snout' && !o.flat;
  const fx = r * t, fy = o.fy ?? r * (wide ? 0.06 : 0.14), gap = r * (o.gap ?? (wide ? 0.48 : 0.36)), so = g.eye === 'soot', ek = o.eyeK || 1;
  const ew = r * 0.2 * g.eyeS * (so ? 1.3 : 1) * ek, eh = r * 0.27 * g.eyeS * (so ? 1.12 : 1) * ek, ey = g.bumps ? -ry * 0.66 : fy, Rm = o.ramp || g.body, fe = fx + gap * 0.84;
  let skin = Rm[2];
  if (g.disc) for (const [ex, k] of [[fx - gap, 1], [fe, 0.88]]) fill(E(ex, ey, r * 0.34 * k, r * 0.36), g.belly[3]);
  if (g.band) fill(E(fx, ey + r * 0.02, r * 0.8, r * 0.25), Rm[0]);
  if (g.muzzle && !snout) fill(E(fx + r * 0.04, fy + r * 0.42, r * 0.33, r * 0.22), g.belly[3]);
  if (snout) solid(E(rx * 0.7, fy + r * 0.3, r * 0.36, r * 0.25), g.belly, rx * 0.7, fy + r * 0.3, r * 0.36, r * 0.25, { rim: '' });
  if (g.mask === 'face') {
    solid(E(fx, fy - r * 0.04, r * 0.6, r * 0.7), g.paper, fx, fy - r * 0.04, r * 0.6, r * 0.7, { rim: '' }); skin = g.paper[2];
    for (const ex of [fx - gap, fe]) { line([[ex, ey - eh * 1.05], [ex, ey - eh * 1.9]], r * 0.05, g.cloth[2]); line([[ex, ey + eh * 0.95], [ex, ey + eh * 1.75]], r * 0.05, g.cloth[2]); }
  }
  if (g.fmark) fmark(fx * 0.8, -ry * 0.52, r);
  if (g.kitsune && g.mask !== 'face') for (const [ex, s] of [[fx - gap - ew * 0.5, -1], [fe + ew * 0.45, 1]]) { line([[ex, ey + eh * 0.1], [ex + s * r * 0.2, ey + eh * 0.28]], r * 0.045, g.cloth[2]); if (hpx(r) > 9) line([[ex, ey + eh * 0.5], [ex + s * r * 0.17, ey + eh * 0.74]], r * 0.045, g.cloth[2]); }
  if (g.one || o.one) eye(fx, ey - r * 0.04, ew * 1.7, eh * 1.45, false, skin);
  else { eye(fx - gap, ey, ew, eh, false, skin); eye(fe, ey, ew * 0.86, eh, true, skin); }
  if (g.mask === 'face' || o.noMouth) return;
  const my = snout ? fy + r * 0.43 : ey + eh * 0.5 + r * (g.nose ? 0.21 : 0.15), mx = snout ? rx * 0.74 : fx + r * 0.02;
  if (g.nose && !o.flat) noseAt(snout ? rx * 0.98 : fx + r * 0.02, snout ? fy + r * 0.2 : ey + eh * 0.5 + r * 0.06, r);
  mouthAt(mx, my, r, skin);
  if (!g.one && !o.one) { blushAt(fx - gap - ew * 0.2, ey + eh * 0.62 + r * 0.05, r); blushAt(fe + ew * 0.45, ey + eh * 0.62 + r * 0.05, r); }
  if (g.whisk && (Q.detail || !Q.F)) for (const s of [-1, 1]) for (const d of [0, 1]) { const wx = (s < 0 ? fx - gap - ew * 0.2 : fe + ew * 0.3), wy = ey + eh * 0.7 + d * r * 0.08; line([[wx, wy], [wx + s * r * (0.42 + g.whisk * 0.2), wy - r * 0.06 + d * r * 0.1 + (g.whisk > 1 ? r * 0.2 : 0)]], r * 0.022, Rm[0], false); }
}

// ---------------------------------------------------------------- heads, ears, crowns
function head(hx, hy, r, o = {}) {
  const g = G, A = Q.A, x = X, sh = g.headShape, rx = o.rx ?? r * (sh === 'wide' ? 1.18 : 1.03), ry = o.ry ?? r * (sh === 'wide' ? 0.84 : 0.95), Rm = o.ramp || g.body;
  x.save(); x.translate(hx, hy); x.rotate((A.tilt || 0) * (o.tiltK ?? 1) + (A.lean || 0) * 0.4);
  if (o.part !== 'front') {
    if (g.mane && !o.noShape) { const m = furE(-r * 0.1, r * 0.04, r * 1.38, r * 1.28, 9, 0.22, 61); solid(m, g.acc, -r * 0.1, r * 0.04, r * 1.38, r * 1.28, { rim: '' }); }
    ears(r, rx, ry, 'back');
    if (g.bumps) for (const s of [-1, 1]) { const ex = r * g.turn + s * r * (s > 0 ? 0.4 : 0.48), q = E(ex, -ry * 0.66, r * 0.3, r * 0.27); solid(q, Rm, ex, -ry * 0.66, r * 0.3, r * 0.27, { rim: '' }); }
    if (g.cheeks && g.fluff > 0.3 && !o.noShape) for (const s of [-1, 1]) fill(furE(s * rx * 0.62 + r * g.turn * 0.3, ry * 0.4, r * 0.34, r * 0.24, 3, 0.45, 63 + s), s < 0 ? Rm[2] : Rm[1]);
    if (!o.noShape) { const p = o.fur ? furE(0, 0, rx, ry, o.fur[0], o.fur[1], 62, o.fur[2]) : g.fluff > 0.55 ? furE(0, 0, rx, ry, 8, 0.05 + g.fluff * 0.04, 62) : E(0, 0, rx, ry); solid(p, Rm, 0, 0, rx, ry, { deep: o.deep, gloss: o.gloss }); }
  }
  if (o.part !== 'back') { face(r, rx, ry, o); ears(r, rx, ry, 'front'); if (!o.noCrown) crown(r, rx, ry); }
  x.restore();
}
function ears(r, rx, ry, layer) {
  const g = G, k = g.ears, A = Q.A, x = X, lag = A.ear || 0;
  if (k === 'none') return;
  if (k === 'crest') { if (layer !== 'back') return; const pts = spine(r * g.turn * 0.3, -ry * 0.82, -Math.PI / 2 - 0.2, r * 0.55, 1.9 - lag, 6); fill(tube(pts, pts.map((_, i) => r * (0.075 - i * 0.007))), g.body[1]); const e = pts[6]; solid(E(e[0], e[1], r * 0.12, r * 0.12), g.acc, e[0], e[1], r * 0.12, r * 0.12, { rim: '' }); return; }
  if (k === 'floppy') { if (layer !== 'front') return; for (const s of [1, -1]) { const ex = r * g.turn * 0.3 + s * rx * 0.86, p = E(ex, ry * 0.05, r * 0.2, r * 0.44, -s * 0.28 + lag * s * 0.3); solid(p, s > 0 ? dk(g.body) : g.body, ex, ry * 0.05, r * 0.2, r * 0.44, { rim: '' }); } return; }
  if (layer !== 'back') return;
  const sp = { cat: 0.62, fox: 0.56, rabbit: 0.3, round: 0.78, mouse: 0.8, tufts: 0.68, deer: 1.2, gills: 1.45, fins: 1.5, antennae: 0.36, stalks: 0.3 }[k] ?? 0.6;
  for (const far of [true, false]) {
    const side = far ? 1 : -1, a = -Math.PI / 2 + side * sp + g.turn * 0.5 + Math.min(0, lag) * 0.7 - side * Math.max(0, lag) * 0.15;
    const Rm = far ? dk(g.body) : g.body, inner = far ? g.pink[1] : g.pink[2];
    x.save(); x.translate(Math.cos(a) * rx * 0.84, Math.sin(a) * ry * 0.84); x.rotate(a + Math.PI / 2);
    if (k === 'round' || k === 'mouse') { const q = r * (k === 'mouse' ? 0.4 : 0.27); solid(E(0, -q * 0.4, q, q), Rm, 0, -q * 0.4, q, q, { rim: '' }); fill(E(0, -q * 0.35, q * 0.58, q * 0.55), inner); }
    else if (k === 'gills') for (let j = -1; j <= 1; j++) { const pts = spine(0, 0, -Math.PI / 2 + j * 0.55, r * (0.5 - Math.abs(j) * 0.1), -side * 0.7, 5), p = tube(pts, pts.map((_, i) => r * (0.08 - i * 0.009)), 0.6, 80 + j + side * 3); solid(p, far ? dk(g.acc) : g.acc, ...bbox(pts, r * 0.08), { rim: '' }); }
    else if (k === 'fins') { const p = curve([[-r * 0.14, r * 0.02], [-r * 0.3, -r * 0.36], [-r * 0.04, -r * 0.5], [r * 0.22, -r * 0.38], [r * 0.16, r * 0.02]]); solid(p, far ? dk(g.acc) : g.acc, 0, -r * 0.24, r * 0.26, r * 0.28, { rim: '' }); if (Q.detail || !Q.F) for (const d of [-0.12, 0, 0.12]) line([[0, 0], [d * r * 1.6, -r * 0.42]], r * 0.02, g.acc[1]); }
    else if (k === 'antennae' || k === 'stalks') {
      const st = k === 'stalks', pts = spine(0, 0, -Math.PI / 2, r * (st ? 0.5 : 0.7), -side * (st ? 0.3 : 1.1), 5); line(pts, r * 0.05, Rm[1], true); const e = pts[5];
      if (st) solid(E(e[0], e[1], r * 0.12, r * 0.12), Rm, e[0], e[1], r * 0.12, r * 0.12, { rim: '' });
      else { const m = pts[3]; fill(leafP(pts[1][0], pts[1][1], Math.atan2(e[1] - pts[1][1], e[0] - pts[1][0]), Math.hypot(e[0] - pts[1][0], e[1] - pts[1][1]) * 1.05, r * 0.11), far ? g.belly[1] : g.belly[2]); fill(E(m[0], m[1], r * 0.03, r * 0.03), Rm[1]); }
    } else {
      const [w, l] = { cat: [0.3, 0.56], fox: [0.3, 0.8], rabbit: [0.17, 1.05], tufts: [0.17, 0.5], deer: [0.16, 0.52] }[k] || [0.3, 0.56], W = r * w, L = r * l;
      const p = k === 'tufts' ? poly([[-W, r * 0.05], [-W * 0.7, -L * 0.45], [-W * 1.1, -L * 0.6], [-W * 0.2, -L], [W * 0.45, -L * 0.5], [W * 0.9, -L * 0.62], [W, r * 0.05]]) : curve([[-W, r * 0.08], [-W * 0.92, -L * 0.42], [-W * 0.42, -L * 0.86], [0, -L], [W * 0.42, -L * 0.86], [W * 0.92, -L * 0.42], [W, r * 0.08], [0, r * 0.22]]);
      solid(p, Rm, 0, -L * 0.45, W, L * 0.55, { rim: '', sh: 0.6 });
      if (k !== 'tufts') fill(curve([[-W * 0.5, 0], [-W * 0.42, -L * 0.45], [0, -L * 0.78], [W * 0.42, -L * 0.45], [W * 0.5, 0]]), inner);
      if (k === 'fox') { x.save(); x.clip(p); fill(E(0, -L, W * 1.2, L * 0.3), g.body[0]); x.restore(); }
    }
    x.restore();
  }
}
function flower(cx, cy, s, Rm = G.petal) { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; fill(E(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55, s * 0.44, s * 0.44), i === 1 || i === 2 ? Rm[2] : Rm[3]); } fill(E(cx, cy, s * 0.3, s * 0.3), G.beak[3]); }
function flame(cx, by, s, ph, Rm = G.glow) { const f = Math.sin(ph * 2) * 0.15, p = curve([[cx - s * 0.5, by], [cx - s * 0.45, by - s * 0.55], [cx + s * (0.05 + f), by - s * 1.3], [cx + s * 0.42, by - s * 0.5], [cx + s * 0.45, by]]); solid(p, Rm, cx, by - s * 0.45, s * 0.45, s * 0.6, { rim: '', sh: 0.5 }); fill(E(cx, by - s * 0.28, s * 0.2, s * 0.26), Rm[4]); }
function crown(r, rx, ry) {
  const g = G, A = Q.A, x = X, k = g.crown, tx = r * g.turn * 0.35, ty = -ry * 0.92, sw = (A.ear || 0) * 0.4 + (A.tail || 0) * 0.15;
  if (k === 'sprout') { const pts = spine(tx, ty + r * 0.06, -Math.PI / 2 + 0.15 + sw, r * 0.36, -0.5, 4); line(pts, r * 0.06, g.leaf[1], true); const e = pts[4]; for (const s of [-1, 1]) solid(leafP(e[0], e[1], -Math.PI / 2 + s * 1.05 + sw, r * 0.4, r * 0.13), g.leaf, e[0] + s * r * 0.17, e[1] - r * 0.1, r * 0.2, r * 0.13, { rim: '' }); }
  else if (k === 'leaf') { const p = leafP(tx - r * 0.5, ty + r * 0.14, -0.38 + sw, r * 1.05, r * 0.25); solid(p, g.leaf, tx, ty - r * 0.06, r * 0.5, r * 0.25, { rim: '' }); if (Q.detail || !Q.F) line([[tx - r * 0.45, ty + r * 0.12], [tx + r * 0.4, ty - r * 0.22]], r * 0.025, g.leaf[0]); }
  else if (k === 'flower' || k === 'cherry') { flower(-rx * 0.52 + tx * 0.3, -ry * 0.66, r * 0.25); if (g.tier >= 2) flower(-rx * 0.14 + tx * 0.3, -ry * 0.92, r * 0.18); }
  else if (k === 'antlers') { const w = Math.max(r * 0.075, px(1.1)); for (const s of [1, -1]) { const col = s > 0 ? g.horn[1] : g.horn[2], m = spine(tx + s * r * 0.3, ty + r * 0.12, -Math.PI / 2 + s * 0.4, r * 0.72, s * 0.55, 4); line(m, w * 1.25, col, true); line(spine(m[2][0], m[2][1], -Math.PI / 2 - s * 0.3, r * 0.3, 0, 2), w, col); line(spine(m[3][0], m[3][1], -Math.PI / 2 + s * 1.15, r * 0.22, 0, 2), w, col); if (g.tier >= 2) flower(m[4][0], m[4][1], r * 0.12); } }
  else if (k === 'mushroom') { x.save(); x.translate(tx - r * 0.12, ty - r * 0.02); x.rotate(-0.25); fill(E(0, -r * 0.05, r * 0.1, r * 0.15), g.paper[2]); const p = curve([[-r * 0.44, 0], [-r * 0.32, -r * 0.3], [0, -r * 0.38], [r * 0.32, -r * 0.3], [r * 0.44, 0], [0, r * 0.05]]); solid(p, g.cloth, 0, -r * 0.18, r * 0.44, r * 0.22, { rim: '' }); for (const [a, b, s] of [[-0.2, -0.2, 0.07], [0.15, -0.26, 0.06], [0.28, -0.08, 0.05]]) fill(E(r * a, r * b, r * s, r * s), g.whiteC); x.restore(); }
  else if (k === 'horns') for (const s of [-1, 1]) { const hx = tx + s * r * 0.36, p = curve([[hx - r * 0.1, ty + r * 0.14], [hx + s * r * 0.05, ty - r * 0.3], [hx + r * 0.1, ty + r * 0.14]]); solid(p, s > 0 ? dk(g.horn) : g.horn, hx, ty - r * 0.05, r * 0.1, r * 0.2, { rim: '' }); }
  else if (k === 'flame') flame(tx, ty + r * 0.08, r * 0.34, A.ph);
  else if (k === 'acorn') { const p = curve([[-rx * 0.62, ty * 0.55], [-rx * 0.4, ty * 1.02], [tx, ty * 1.1], [rx * 0.42, ty * 1.0], [rx * 0.66, ty * 0.5], [tx, ty * 0.72]]); solid(p, g.horn, tx, ty * 0.8, rx * 0.6, ry * 0.3, { rim: '' }); line([[tx, ty * 1.08], [tx + r * 0.08, ty * 1.08 - r * 0.18]], r * 0.07, g.horn[0]); }
  if (g.halo) { x.strokeStyle = g.glow[3]; x.lineWidth = Math.max(r * 0.08, px(1.2)); x.beginPath(); x.ellipse(tx, ty - r * 0.42, r * 0.48, r * 0.13, 0, 0, TAU); x.stroke(); }
  if (g.mask === 'side') { x.save(); x.translate(-rx * 0.6, -ry * 0.38); x.rotate(-0.5); const s = r * 0.42, p = curve([[-s * 0.5, -s * 0.25], [-s * 0.42, -s * 0.78], [-s * 0.16, -s * 0.38], [s * 0.16, -s * 0.38], [s * 0.42, -s * 0.78], [s * 0.5, -s * 0.25], [s * 0.3, s * 0.35], [0, s * 0.58], [-s * 0.3, s * 0.35]]); solid(p, g.paper, 0, 0, s * 0.5, s * 0.55, { rim: '' }); line([[-s * 0.3, -s * 0.05], [-s * 0.08, s * 0.04]], s * 0.08, g.cloth[2]); line([[s * 0.3, -s * 0.05], [s * 0.08, s * 0.04]], s * 0.08, g.cloth[2]); fill(E(0, s * 0.38, s * 0.08, s * 0.06), g.cloth[2]); x.restore(); }
}
