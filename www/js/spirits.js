// SPIRITS — folk-tale spirits crossed with cute animal chimeras: soot sprites, kodama,
// mochi and lantern yokai, will-o'-wisps, moth-rabbits, owl-cats, fox-fish, frog-deer,
// noodle dragons, caterpillar pups and turtles with gardens on their backs. A seeded
// genome picks an archetype and a kit of parts (head animal, ears, crown, tail, wings,
// markings, masks, trinkets). Every pose is drawn as smooth shaded vector shapes at 4×
// the target size, box-filtered down, quantised to the creature's own palette and
// outlined; faces snap to the pixel grid so the eyes stay crisp at 16 px. A third of
// them get ordered dithering and grit. `big` is a smooth 160 px portrait.
import { mulberry32 } from './util.js';

const TAU = Math.PI * 2;
const ssFor = (size) => (size <= 26 ? 4 : size <= 44 ? 3 : 2);
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
  g.len = r(0.9, 1.1); g.fat = r(0.9, 1.15); g.hr = r(0.92, 1.18); g.sit = plan === 'critter' && ch(0.35); g.leg = r(0, 1); g.legW = r(0.85, 1.2); g.fluff = r(0, 1); g.turn = r(0.12, 0.3);
  g.eye = 'bean'; g.eyeS = r(1.05, 1.45); g.blushOn = ch(0.75); g.one = false;
  const tone = opts.tone || wp(TONES[plan]); g.tone = tone;
  if (plan === 'puff') { g.legs = opts.plan === 'spider' ? 6 + 2 * Math.floor(R() * 2) : ch(0.55) ? pick([2, 4, 6]) : 0; if (g.legs) g.loco = 'walk'; g.fluff = r(0.6, 1); g.turn = r(0.04, 0.14); g.spiky = tone === 'dark' || ch(0.3); g.mouth = pick(['none', 'smile', 'cat', 'none']); g.hold = ch(0.3) ? 'star' : ''; }
  if (plan === 'mochi') { g.sub = pick(['dome', 'dome', 'drop', 'jelly']); g.turn = r(0.05, 0.15); g.mouth = pick(['cat', 'smile', 'open', 'cat']); g.crown = g.A === 'rabbit' ? 'none' : pick(['leaf', 'sprout', 'none', 'flower', 'cherry']); }
  if (plan === 'wisp') { g.sub = pick(['flame', 'flame', 'ghost', 'jelly', 'mask']); g.turn = r(0.04, 0.14); g.mouth = pick(['smile', 'cat', 'none', 'open']); if (g.sub === 'mask') { g.mask = 'face'; g.tone = tone === 'white' || ch(0.6) ? 'dark' : tone; } }
  if (plan === 'kodama') { g.eye = 'hollow'; g.mouth = 'o'; g.turn = r(-0.05, 0.12); g.eyeS = r(1.1, 1.5); g.blushOn = ch(0.3); g.crown = pick(['sprout', 'sprout', 'leaf', 'flower', 'mushroom', 'acorn', 'none']); g.sub = pick(['round', 'tall', 'wide']); g.fluff = 0; g.headShape = 'round'; }
  if (plan === 'lantern') { g.sub = pick(['chochin', 'chochin', 'kasa', 'kettle']); g.one = g.sub === 'kasa' || ch(0.45); g.mouth = 'tongue'; g.turn = r(0.02, 0.12); if (g.sub === 'kasa') g.loco = 'hop'; if (g.sub === 'kettle') { g.loco = 'walk'; g.A = 'tanuki'; Object.assign(g, { ears: 'round', tail: 'ringed', nose: true, mouth: 'cat', band: ch(0.5), one: false }); g.atk = 'spit'; g.die = 'flop'; } }
  if (plan === 'guardian') { g.turn = r(0.06, 0.18); g.belly = 1; g.chev = ch(0.6); g.hold = ch(0.35) ? pick(['leaf', 'leaf', 'acorn', 'lantern']) : ''; if (g.A === 'spirit') g.ears = pick(['cat', 'round', 'rabbit', 'tufts']); }
  if (plan === 'birdy') { g.belly = 1; g.turn = r(0.12, 0.26); g.wings = 'feather'; if (g.B === 'turtle') g.shellBack = 1; if (g.A === 'cat' || g.A === 'fox') { g.mouth = 'beak'; g.tail = 'feather'; } }
  if (plan === 'moth') { g.wings = 'moth'; g.turn = r(0.03, 0.12); g.ears = g.A === 'moth' ? 'antennae' : AN[g.A].ears; g.tail = 'none'; g.collar = 1; g.eye = ch(0.4) ? 'soot' : 'bean'; }
  if (plan === 'noodle') { g.turn = r(0.15, 0.3); g.tail = pick(['tuft', 'fish', 'tuft', 'wisp']); g.fin = ch(0.5); g.paws = ch(0.6); if (g.A === 'dragon') g.crown = pick(['horns', 'antlers', 'horns', 'none']); g.whisk = g.A === 'dragon' || ch(0.3) ? 2 : g.whisk; }
  if (plan === 'pup') { g.segs = 3 + Math.floor(R() * 3) + (opts.plan === 'centipede' ? 1 : 0); g.turn = r(0.15, 0.3); if (g.A === 'moth') { g.ears = 'antennae'; g.A = 'caterpillar'; } g.tail = 'none'; g.crown = ch(0.35) ? pick(['leaf', 'flower', 'sprout']) : 'none'; }
  if (plan === 'shell') { g.sub = g.A === 'snail' ? 'snail' : 'turtle'; g.turn = r(0.15, 0.3); g.garden = pick(['moss', 'flower', 'mushroom', 'tree', 'shrine', 'sprout']); g.tail = 'none'; if (g.A === 'turtle') g.mouth = pick(['smile', 'cat', 'beak']); g.crown = 'none'; if (g.sub === 'turtle') g.die = 'flip'; }
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
  g.pupil = hsl(toward(h, 250, 0.7), 40, 9); g.white = hsl(h, 30, 97); g.iris = hsl(gh, 80, 50); g.blush = hsl(350, 85, 78); g.tongue = hsl(352, 75, 62);
  g.pupilC = css(g.pupil); g.whiteC = css(g.white); g.irisC = css(g.iris); g.blushC = css(g.blush); g.tongueC = css(g.tongue);
  g.beak = ramp(r(30, 46), 88, 60); g.pink = ramp(348, 62, 80); g.cloth = ramp(pick([355, 5, 350, 225, 280, 150]), r(60, 75), r(46, 54)); g.paper = ramp(h + 30, 18, 94);
  g.shellR = ramp(pick([28, 90, 150, 200, h + 160, 15]), r(30, 55), r(38, 52));
  const wk = plan === 'birdy' || g.B === 'bird' || g.B === 'owl' ? pick([g.body, g.body, g.acc]) : null;
  g.wingR = wk || (plan === 'moth' ? pick([g.acc, g.petal, g.belly, g.body]) : pick([g.acc, g.belly, g.petal])); g.wingR2 = plan === 'moth' ? pick([g.belly, g.acc, g.petal].filter((q) => q !== g.wingR)) : g.wingR;
  g.noseC = g.tone === 'dark' ? g.belly[1] : ch(0.5) ? g.pink[1] : g.pupilC;
  g.outRGB = hsl(toward(h, 262, 0.45), 42, g.tone === 'dark' ? 6 : 12); g.ink = mix(g.body.rgb[0], g.outRGB, 0.45); g.inkC = css(g.ink);
  if (opts.outline && typeof opts.outline === 'string' && /^#[0-9a-f]{6}$/i.test(opts.outline)) g.outRGB = [1, 3, 5].map((i) => parseInt(opts.outline.slice(i, i + 2), 16));
  g.line = opts.outline !== false;
  g.rim = g.glowy ? g.glow[3] : '';
  // finish: a third get ordered dithering and grit
  const rough = ch(0.33);
  g.dither = opts.dither ?? rough;
  g.grit = opts.grit === true ? 0.7 : opts.grit === false ? 0 : typeof opts.grit === 'number' ? opts.grit : rough ? r(0.4, 1) : 0;
  g.species = species(g); g.name = spiritName(g, R); g.element = element(g);
  g.uses = { glow: g.glowy || g.eye === 'glow' || g.tail === 'wisp' || g.crown === 'flame' || g.halo || g.fmark || g.kitsune || tier >= 3 || ['wisp', 'lantern', 'moth'].includes(plan), leaf: ['sprout', 'leaf', 'flower'].includes(g.crown) || plan === 'shell' || g.hold === 'leaf', petal: ['flower', 'mushroom', 'cherry'].includes(g.crown) || plan === 'shell' || plan === 'moth' || g.hold === 'star', horn: ['antlers', 'horns', 'acorn'].includes(g.crown) || g.hold === 'acorn' || g.trinket === 'rope' || plan === 'lantern', beak: g.mouth === 'beak' || plan === 'birdy' || g.trinket === 'bell' || g.crown === 'flower' || plan === 'shell',
    cloth: !!g.trinket || g.kitsune || !!g.mask || g.crown === 'mushroom' || plan === 'shell', paper: !!g.mask || g.crown === 'mushroom' || plan === 'shell', shell: plan === 'shell' || g.shellBack || g.sub === 'kettle', wing: !!g.wings || plan === 'moth' || g.tail === 'feather' };
  return g;
}
function species(g) {
  const A = g.A === 'spirit' ? '' : g.A, B = g.B, pre = A ? A + ' ' : '';
  switch (g.plan) {
    case 'critter': return B ? `${A}-${B}` : `${A} spirit`;
    case 'guardian': return A ? `${A} guardian` : 'forest guardian';
    case 'birdy': return g.shellBack ? `turtle-${A}` : A === 'bird' ? 'songbird spirit' : A === 'owl' ? 'owl spirit' : `${A}-bird`;
    case 'moth': return A === 'moth' ? 'moth spirit' : `moth-${A}`;
    case 'noodle': return A === 'dragon' ? (B ? `dragon-${B}` : 'sky dragon') : `${A}-dragon`;
    case 'pup': return A === 'dog' ? 'caterpillar pup' : A === 'caterpillar' ? 'fuzzy caterpillar' : `caterpillar-${A}`;
    case 'shell': return g.sub === 'snail' ? 'garden snail' : A === 'turtle' ? 'garden turtle' : `turtle-${A}`;
    case 'puff': return g.tone === 'dark' ? pre + 'soot sprite' : pre + 'fuzzball';
    case 'mochi': return pre + (g.sub === 'jelly' ? 'jelly spirit' : 'mochi spirit');
    case 'wisp': return g.sub === 'mask' ? 'masked spirit' : pre + { flame: "will-o'-wisp", ghost: 'little ghost', jelly: 'sky jelly' }[g.sub];
    case 'kodama': return 'kodama';
    default: return { chochin: 'lantern yokai', kasa: 'umbrella yokai', kettle: 'teakettle tanuki' }[g.sub];
  }
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
  if (Q.probe) return;
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
    if (k === 'soot') { body(Wc); const pw = Math.max(1, Math.round(tw * 0.45)), ph = Math.max(1, Math.round(th * 0.5)); pix(L + ((tw - pw + 1) >> 1), T + ((th - ph + 1) >> 1), pw, ph, D); }
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
function blushAt(bx, by, r) { if (!G.blushOn) return; if (Q.F) { const hp = hpx(r); if (hp >= 6) stamp(bx, by, hp >= 11 ? ['xx'] : ['x'], { x: G.blushC }); return; } X.globalAlpha = Q.big ? 0.7 : 1; fill(E(bx, by, r * 0.15, r * 0.085), G.blushC); X.globalAlpha = 1; }
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
  if (o.part !== 'back') { if (!Q.probe) face(r, rx, ry, o); ears(r, rx, ry, 'front'); if (!o.noCrown) crown(r, rx, ry); }
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

// ---------------------------------------------------------------- body parts
function leg(hx, hy, r, ph, near, reach = 0) {
  const g = G, A = Q.A, x = X, mv = A.mv, sw = Math.sin(ph) * 0.08 * mv + reach * 0.1, up = Math.max(0, -Math.cos(ph)) * 0.05 * mv + Math.max(0, reach) * 0.04;
  const fx = hx + sw, fy = -up - (A.air ? 0 : A.bobS), col = near ? g.body[2] : g.body[1], sock = g.bodyMark === 'socks';
  const p = new Path2D(); p.moveTo(hx, hy); p.quadraticCurveTo(hx + sw * 0.3 + 0.015, (hy + fy) / 2, fx, fy - r * 0.7);
  x.lineCap = 'round';
  if (near && Q.ink) { x.strokeStyle = g.inkC; x.lineWidth = r * 2 + px(2); x.stroke(p); }
  x.strokeStyle = col; x.lineWidth = r * 2; x.stroke(p);
  const paw = E(fx + r * 0.3, fy - r * 0.78, r * 1.22, r * 0.78);
  if (near) ink(paw);
  fill(paw, sock ? g.belly[near ? 3 : 1] : col);
  if (near) fill(E(fx + r * 0.1, fy - r * 1.05, r * 0.5, r * 0.28), (sock ? g.belly : g.body)[3]);
}
const TAILS = {
  fluffy: { a: 0.85, bend: 1.5, len: 0.5, r: 0.11, fuzz: 0.22, tip: 1, prof: (u) => 0.35 + 0.72 * Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.85)) },
  ringed: { a: 0.55, bend: 0.9, len: 0.46, r: 0.1, fuzz: 0.16, rings: 1, prof: (u) => 0.5 + 0.6 * Math.sin(Math.PI * Math.min(1, 0.2 + u * 0.8)) },
  cat: { a: 0.25, bend: 2.4, len: 0.5, r: 0.036, prof: (u) => 1 - u * 0.2 },
  thin: { a: 0.1, bend: 2.6, len: 0.5, r: 0.022, prof: (u) => 1 - u * 0.5, pink: 1 },
  tuft: { a: 0.35, bend: 1.8, len: 0.42, r: 0.03, prof: () => 1, ball: 1 },
  curly: { a: 1.25, bend: 4.6, len: 0.34, r: 0.045, prof: (u) => 1 - u * 0.3 },
  paddle: { a: 0.15, bend: 0.5, len: 0.4, r: 0.075, prof: (u) => 1 - u * 0.8, fin: 1 },
  fish: { a: 0.2, bend: -0.2, len: 0.2, r: 0.075, prof: (u) => 1 - u * 0.55, fan: 1 },
  wisp: { a: 0.7, bend: 1.4, len: 0.5, r: 0.1, prof: (u) => Math.pow(1 - u, 0.8) + 0.05, glow: 1 }
};
function tail(x0, y0, sc = 1) {
  const g = G, k = g.tail, A = Q.A, x = X, sw = (A.tail || 0) * 0.5;
  if (!k || k === 'none') return;
  if (k === 'puff') { const p = furE(x0 - 0.02, y0, 0.085 * sc, 0.08 * sc, 6, 0.3, 31); solid(p, g.belly, x0 - 0.02, y0, 0.085 * sc, 0.08 * sc, { rim: '' }); return; }
  if (k === 'feather') { for (const i of [0, 2, 1]) { const a = Math.PI + 0.45 + (i - 1) * 0.4 + sw, cx = x0 + Math.cos(a) * 0.13 * sc, cy = y0 + Math.sin(a) * 0.13 * sc; solid(E(cx, cy, 0.15 * sc, 0.05 * sc, a), i === 1 ? g.wingR : dk(g.wingR), cx, cy, 0.12 * sc, 0.06 * sc, { rim: '' }); } return; }
  if (k === 'flipper') { for (const s of [1, -1]) solid(leafP(x0, y0, Math.PI + 0.3 + s * 0.45 + sw, 0.17 * sc, 0.05 * sc), s > 0 ? dk(g.body) : g.body, x0 - 0.08 * sc, y0, 0.09 * sc, 0.06 * sc, { rim: '' }); return; }
  const T = TAILS[k] || TAILS.cat, n = g.tails || 1;
  for (let i = n - 1; i >= 0; i--) {
    const fan = n > 1 ? (i / (n - 1) - 0.5) * Math.min(1.8, 0.45 * n) : 0, s2 = sc * (n > 1 ? 0.8 : 1);
    const pts = spine(x0, y0, Math.PI + T.a + sw + fan, T.len * s2, T.bend * (1 - fan * 0.35), 8), rad = pts.map((_, j) => T.r * s2 * T.prof(j / 8)), b = bbox(pts, T.r * s2), e = pts[8];
    if (T.fin) fill(tube(pts, rad.map((v) => v * 2.1 + 0.01)), g.acc[3]);
    const p = tube(pts, rad, T.fuzz || 0, 40 + i);
    solid(p, T.glow ? g.glow : T.pink ? g.pink : g.body, ...b, { rim: T.glow ? g.glow[4] : '' });
    if (T.tip || T.rings) {
      x.save(); x.clip(p);
      if (T.tip) fill(E(e[0], e[1], T.len * s2 * 0.34, T.len * s2 * 0.34), g.glowy && n > 1 ? g.glow[3] : g.belly[3]);
      if (T.rings) for (const j of [3, 5, 7]) { const a = pts[j - 1], c = pts[j + 1], dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1, q = rad[j] * 1.8; line([[pts[j][0] + dy / d * q, pts[j][1] - dx / d * q], [pts[j][0] - dy / d * q, pts[j][1] + dx / d * q]], rad[j] * 0.55, g.body[0]); }
      x.restore();
    }
    if (T.fan) for (const s of [-1, 1]) { const a = Math.atan2(e[1] - pts[7][1], e[0] - pts[7][0]) + s * 0.6; solid(leafP(e[0], e[1], a, 0.18 * s2, 0.055 * s2), s > 0 ? dk(g.acc) : g.acc, e[0] - 0.06 * s2, e[1], 0.09 * s2, 0.07 * s2, { rim: '' }); }
    if (T.ball) { const q = furE(e[0], e[1], 0.07 * s2, 0.07 * s2, 6, 0.3, 45); solid(q, g.mane ? g.acc : g.body, e[0], e[1], 0.07 * s2, 0.07 * s2, { rim: '' }); }
  }
}
function wing(sx, sy, sz, near) {
  const g = G, A = Q.A, x = X, Rm = near ? g.wingR : dk(g.wingR);
  x.save(); x.translate(sx, sy); x.rotate(-0.3 - (A.wing || 0) * 0.65 - (near ? 0 : 0.4)); if (!near) x.scale(0.92, 0.92);
  const p = curve([[0.04, -0.06], [-0.3, -0.2], [-0.78, -0.16], [-1, -0.02], [-0.86, 0.08], [-0.72, 0.04], [-0.6, 0.18], [-0.45, 0.1], [-0.3, 0.22], [-0.14, 0.12], [0.06, 0.1]].map(([a, b]) => [a * sz, b * sz]));
  if (near) ink(p, 1.6);
  solid(p, Rm, -sz * 0.45, 0, sz * 0.55, sz * 0.2, { rim: '' });
  if (Q.detail || !Q.F) for (const t of [0.35, 0.55, 0.75]) line([[-sz * (t - 0.1), sz * 0.06], [-sz * t, -sz * 0.1]], sz * 0.025, Rm[1]);
  x.restore();
}
function mothWings(cx, cy, sz, both) {
  const g = G, A = Q.A, x = X, f = A.wing || 0, m = ([a, b]) => [a * sz, b * sz];
  for (const far of both ? [true, false] : [false]) {
    x.save(); x.translate(cx, cy); x.scale(far ? -0.9 : 1, far ? 0.9 : 1); x.rotate(-f * 0.25 - (both ? 0 : 0.5)); x.scale(1 - Math.abs(f) * 0.16, 1);
    const hind = curve([[0, 0.02], [-0.3, 0.04], [-0.55, 0.2], [-0.5, 0.45], [-0.26, 0.5], [-0.06, 0.26]].map(m)), fore = curve([[0.02, -0.02], [-0.18, -0.34], [-0.55, -0.56], [-0.86, -0.46], [-0.88, -0.18], [-0.6, 0.02], [-0.22, 0.08]].map(m));
    solid(hind, far ? dk(g.wingR2) : g.wingR2, -sz * 0.3, sz * 0.25, sz * 0.28, sz * 0.25, { rim: '' });
    solid(fore, far ? dk(g.wingR) : g.wingR, -sz * 0.45, -sz * 0.22, sz * 0.45, sz * 0.32, { rim: '' });
    fill(E(-sz * 0.56, -sz * 0.26, sz * 0.12, sz * 0.12), g.glowy ? g.glow[3] : g.petal[2]); fill(E(-sz * 0.55, -sz * 0.26, sz * 0.05, sz * 0.05), g.pupilC);
    if (Q.detail || !Q.F) for (const t of [-0.42, -0.25, -0.08]) line([[-sz * 0.05, 0], [-sz * 0.8, sz * t]], sz * 0.012, (far ? dk(g.wingR) : g.wingR)[1]);
    x.restore();
  }
}
function trinket(nx, ny, w) {
  const g = G, k = g.trinket;
  if (!k) return;
  if (k === 'bib') solid(curve([[nx - w * 0.5, ny - w * 0.08], [nx + w * 0.5, ny - w * 0.08], [nx + w * 0.3, ny + w * 0.25], [nx, ny + w * 0.5], [nx - w * 0.3, ny + w * 0.25]]), g.cloth, nx, ny + w * 0.15, w * 0.5, w * 0.35, { rim: '' });
  else if (k === 'scarf') { line([[nx - w * 0.5, ny], [nx + w * 0.45, ny + w * 0.05]], w * 0.22, g.cloth[2]); fill(leafP(nx - w * 0.35, ny, Math.PI * 0.8 + (Q.A.tail || 0) * 0.3, w * 0.55, w * 0.12), g.cloth[1]); }
  else if (k === 'bell') { line([[nx - w * 0.45, ny], [nx + w * 0.45, ny + w * 0.04]], w * 0.12, g.cloth[2]); solid(E(nx + w * 0.06, ny + w * 0.16, w * 0.16, w * 0.16), g.beak, nx + w * 0.06, ny + w * 0.16, w * 0.16, w * 0.16, { rim: '', gloss: 1 }); }
  else if (k === 'rope') { line([[nx - w * 0.55, ny - w * 0.02], [nx + w * 0.5, ny + w * 0.04]], w * 0.16, g.horn[2]); for (const sx of [-0.18, 0.22]) line([[nx + w * sx, ny + w * 0.05], [nx + w * (sx + 0.09), ny + w * 0.17], [nx + w * sx, ny + w * 0.27], [nx + w * (sx + 0.09), ny + w * 0.38]], w * 0.08, g.whiteC); }
}
function marks(p, cx, cy, rx, ry) {
  const g = G, k = g.bodyMark;
  if (!k || k === 'socks') return;
  X.save(); X.clip(p); const R = rng(70);
  if (k === 'spots') for (let i = 0; i < 6; i++) fill(E(cx + (R() - 0.5) * rx * 1.5, cy - ry * (0.15 + R() * 0.7), rx * 0.12, rx * 0.1), g.glowy && g.tier >= 1 ? g.glow[3] : g.belly[3]);
  else if (k === 'stripes') for (let i = 0; i < 4; i++) { const sx = cx - rx * 0.55 + i * rx * 0.36; line([[sx, cy - ry * 1.1], [sx - rx * 0.1, cy - ry * 0.3]], rx * 0.09, g.body[0]); }
  else if (k === 'runes') { X.strokeStyle = g.glow[3]; X.lineWidth = Math.max(rx * 0.05, px(1)); X.beginPath(); X.arc(cx - rx * 0.2, cy - ry * 0.1, rx * 0.22, 0.2, 4.2); X.stroke(); X.beginPath(); X.arc(cx + rx * 0.35, cy - ry * 0.35, rx * 0.12, 1, 5.5); X.stroke(); }
  X.restore();
}
function shellDome(cx, cy, rx, ry) {
  const Rm = G.shellR, p = curve([[cx - rx, cy + ry * 0.38], [cx - rx * 0.86, cy - ry * 0.32], [cx - rx * 0.1, cy - ry], [cx + rx * 0.8, cy - ry * 0.4], [cx + rx, cy + ry * 0.38], [cx, cy + ry * 0.52]]);
  ink(p); solid(p, Rm, cx, cy, rx, ry, { gloss: 1, rim: '' });
  if (!Q.F || hpx(rx) > 7) { X.save(); X.clip(p); X.strokeStyle = Rm[0]; X.lineWidth = Math.max(rx * 0.05, px(1)); X.beginPath(); X.ellipse(cx - rx * 0.05, cy - ry * 0.15, rx * 0.36, ry * 0.4, 0, 0, TAU); for (const s of [-1, 1]) { X.moveTo(cx - rx * 0.05 + s * rx * 0.36, cy - ry * 0.1); X.lineTo(cx + s * rx, cy + ry * 0.05); } X.stroke(); X.restore(); }
  line([[cx - rx * 0.92, cy + ry * 0.36], [cx, cy + ry * 0.46], [cx + rx * 0.92, cy + ry * 0.36]], ry * 0.14, Rm[3], true);
  return p;
}
function garden(cx, ty, w) {
  const g = G, k = g.garden;
  solid(furE(cx, ty + w * 0.06, w * 0.5, w * 0.12, 7, 0.4, 90), g.leaf, cx, ty + w * 0.06, w * 0.5, w * 0.12, { rim: '' });
  if (k === 'flower') { flower(cx - w * 0.2, ty - w * 0.1, w * 0.17); flower(cx + w * 0.22, ty - w * 0.02, w * 0.13); }
  else if (k === 'mushroom') for (const [dx, s] of [[-0.15, 1], [0.18, 0.7]]) { const mx = cx + w * dx, my = ty - w * 0.02; line([[mx, my], [mx, my - w * 0.18 * s]], w * 0.07 * s, g.paper[2]); solid(curve([[mx - w * 0.17 * s, my - w * 0.15 * s], [mx, my - w * 0.33 * s], [mx + w * 0.17 * s, my - w * 0.15 * s]]), g.cloth, mx, my - w * 0.2 * s, w * 0.17 * s, w * 0.1 * s, { rim: '' }); }
  else if (k === 'tree') { line([[cx, ty + w * 0.05], [cx + w * 0.02, ty - w * 0.3]], w * 0.08, g.horn[0]); const q = furE(cx + w * 0.02, ty - w * 0.42, w * 0.32, w * 0.24, 7, 0.25, 91); solid(q, g.leaf, cx + w * 0.02, ty - w * 0.42, w * 0.32, w * 0.24, { rim: '' }); }
  else if (k === 'shrine') { for (const s of [-1, 1]) line([[cx + s * w * 0.15, ty + w * 0.04], [cx + s * w * 0.15, ty - w * 0.3]], w * 0.06, g.cloth[2]); line([[cx - w * 0.26, ty - w * 0.34], [cx, ty - w * 0.3], [cx + w * 0.26, ty - w * 0.34]], w * 0.07, g.cloth[1], true); line([[cx - w * 0.2, ty - w * 0.22], [cx + w * 0.2, ty - w * 0.22]], w * 0.045, g.cloth[2]); }
  else if (k === 'sprout') { const pts = spine(cx, ty, -Math.PI / 2 + 0.1, w * 0.26, -0.4, 3); line(pts, w * 0.05, g.leaf[1], true); for (const s of [-1, 1]) solid(leafP(pts[3][0], pts[3][1], -Math.PI / 2 + s * 1.1, w * 0.26, w * 0.09), g.leaf, pts[3][0] + s * w * 0.1, pts[3][1] - w * 0.06, w * 0.13, w * 0.09, { rim: '' }); }
}
function spitFx(x0, y0) { if (!Q.A.spit) return; const Rm = G.glowy ? G.glow : G.acc; solid(E(x0 + 0.1, y0, 0.075, 0.062), Rm, x0 + 0.1, y0, 0.075, 0.062, { gloss: 1, rim: '' }); fill(E(x0 + 0.015, y0 + 0.01, 0.035, 0.028), Rm[3]); }
const egg = (cx, cy, rx, ry, k = 0.12) => { const pts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; pts.push([cx + Math.cos(a) * rx * (1 + k * Math.sin(a)), cy + Math.sin(a) * ry]); } return curve(pts); };

// a critter sitting up: haunch on the ground, front legs straight, tail curled round its feet
function sitting(g, A) {
  const x = X, ry = 0.17 * g.fat, rx = 0.25 * g.len, hr = 0.27 * g.hr, bx = -0.06, by = -0.3 - 0.06 * g.leg, lr = 0.058 * g.legW;
  const fl = (lx, near) => { const col = near ? g.body[2] : g.body[1], p = new Path2D(); p.moveTo(lx, by + 0.02); p.lineTo(lx + 0.01, -lr * 0.7 - A.bobS); if (near && Q.ink) { x.strokeStyle = g.inkC; x.lineWidth = lr * 2 + px(2); x.stroke(p); } x.strokeStyle = col; x.lineWidth = lr * 2; x.lineCap = 'round'; x.stroke(p); const paw = E(lx + lr * 0.4, -lr * 0.78 - A.bobS, lr * 1.22, lr * 0.78); if (near) ink(paw); fill(paw, g.bodyMark === 'socks' ? g.belly[near ? 3 : 1] : col); };
  fl(bx + rx * 0.62, false);
  if (g.wings === 'moth') mothWings(bx - rx * 0.2, by - ry * 0.9, 0.5, false); else if (g.wings) wing(bx - rx * 0.2, by - ry * 0.8, 0.36, false);
  const tl = g.tail; if (tl === 'fluffy' || tl === 'ringed' || tl === 'cat' || tl === 'wisp' || tl === 'tuft' || tl === 'thin') { x.save(); x.translate(bx - rx * 0.7, -0.08); x.scale(1, -0.55); tail(0, 0, 0.95); x.restore(); } else tail(bx - rx * 0.8, -0.12);
  const body = g.fluff > 0.45 ? furE(bx, by, rx, ry * 1.35, 10, 0.07 * g.fluff, 1) : E(bx, by, rx, ry * 1.35, -0.5);
  solid(body, g.body, bx, by, rx, ry * 1.35, { deep: 1 }); marks(body, bx, by, rx, ry);
  const hp = E(bx - rx * 0.45, -ry * 0.75, rx * 0.55, ry * 0.75); solid(hp, g.body, bx - rx * 0.45, -ry * 0.75, rx * 0.55, ry * 0.75, { deep: 1 });
  const rp = E(bx - rx * 0.05, -lr * 0.78 - A.bobS, lr * 1.4, lr * 0.8); ink(rp); fill(rp, g.bodyMark === 'socks' ? g.belly[3] : g.body[2]);
  if (g.shellBack) shellDome(bx - rx * 0.25, by - ry * 0.6, rx * 0.8, ry * 1.2);
  fill(furE(bx + rx * 0.62, by - ry * 0.35, rx * 0.32, ry * 0.95, 4, 0.3, 3), g.belly[3]);
  fl(bx + rx * 0.82, true);
  const hx = bx + rx * 0.62, hy = by - ry * 1.15 - hr * 0.55;
  trinket(hx - hr * 0.2, hy + hr * 0.82, hr * 0.95);
  head(hx, hy, hr);
  if (g.wings === 'feather') wing(bx - rx * 0.1, by - ry * 0.9, 0.36, true);
}

// ---------------------------------------------------------------- archetypes
const BODY = {
  critter(g, A) {
    if (g.sit && !A.mv && !A.atk && !A.dead) return sitting(g, A);
    const rx = 0.27 * g.len, ry = 0.18 * g.fat, legH = 0.11 + 0.1 * g.leg, by = -(legH + ry), bx = -0.09, hr = 0.27 * g.hr, ph = A.t * TAU, lr = 0.058 * g.legW, hip = by + ry * 0.45, pj = A.pounce || 0;
    leg(bx + rx * 0.64, hip, lr, ph + Math.PI, false, pj); leg(bx - rx * 0.52, hip, lr, ph, false, -pj * 0.4);
    if (g.wings === 'moth') mothWings(bx - rx * 0.05, by - ry * 0.75, 0.5, false); else if (g.wings) wing(bx - rx * 0.1, by - ry * 0.7, 0.36, false);
    tail(bx - rx * 0.86, by - ry * 0.3);
    const body = g.fluff > 0.45 ? furE(bx, by, rx, ry, 10, 0.07 * g.fluff, 1) : E(bx, by, rx, ry);
    solid(body, g.body, bx, by, rx, ry, { deep: 1 }); marks(body, bx, by, rx, ry);
    if (g.fin) solid(leafP(bx - rx * 0.5, by - ry * 0.85, -0.5, rx * 0.9, ry * 0.25), g.acc, bx - rx * 0.1, by - ry * 1.1, rx * 0.4, ry * 0.25, { rim: '' });
    if (g.shellBack) shellDome(bx - rx * 0.08, by - ry * 0.45, rx * 0.88, ry * 1.2);
    leg(bx + rx * 0.5, hip, lr, ph, true, pj); leg(bx - rx * 0.66, hip, lr, ph + Math.PI, true, -pj * 0.4);
    const hx = bx + rx * 0.86 + (A.reach || 0), hy = by - ry * 0.45 - hr * 0.6;
    fill(furE(bx + rx * 0.7, by - ry * 0.2, rx * 0.3, ry * 0.75, 4, 0.3, 3), g.belly[3]);
    trinket(hx - hr * 0.25, hy + hr * 0.78, hr * 0.95);
    head(hx, hy, hr);
    if (g.wings === 'feather') wing(bx - rx * 0.02, by - ry * 0.8, 0.36, true);
    spitFx(hx + hr * 1.15, hy + hr * 0.35);
  },
  guardian(g, A) {
    const x = X, rx = 0.36 * g.fat, ry = 0.42, cy = -0.03 - ry, ph = A.t * TAU, mv = A.mv, sw = Math.sin(ph) * 0.35 * mv, hx = 0.03, hy = cy - ry * 0.42, hr = rx * 0.82;
    for (const s of [1, -1]) { const lift = Math.max(0, Math.sin(ph + (s > 0 ? 0 : Math.PI))) * 0.05 * mv, fx = s * 0.14 + 0.03, fy = -0.05 - lift - A.bobS, p = E(fx, fy, 0.11, 0.06); ink(p); solid(p, s > 0 ? dk(g.body) : g.body, fx, fy, 0.11, 0.06, { rim: '' }); }
    x.save(); x.rotate(A.lean * 0.9 + (A.reach || 0) * 0.8);
    head(hx, hy, hr, { part: 'back', noShape: 1 });
    solid(E(-rx * 0.88, cy + ry * 0.1, rx * 0.17, ry * 0.3, 0.35 - sw * 0.3), dk(g.body), -rx * 0.88, cy + ry * 0.1, rx * 0.17, ry * 0.3, { rim: '' });
    const body = g.fluff > 0.5 ? furE(0, cy, rx, ry, 11, 0.04, 5) : egg(0, cy, rx, ry);
    solid(body, g.body, 0, cy, rx, ry, { deep: 1 }); marks(body, 0, cy, rx, ry);
    solid(E(0.05, cy + ry * 0.32, rx * 0.66, ry * 0.52), g.belly, 0.05, cy + ry * 0.32, rx * 0.66, ry * 0.52, { rim: '' });
    if (g.chev && hpx(rx) > 7) for (const [cxx, cyy] of [[-0.1, 0.12], [0.04, 0.1], [0.18, 0.12], [-0.03, 0.3], [0.11, 0.3]]) { const ax = 0.05 + cxx * rx * 2.2, ay = cy + ry * cyy + ry * 0.12, q = rx * 0.08; line([[ax - q, ay + q * 0.6], [ax, ay], [ax + q, ay + q * 0.6]], rx * 0.035, g.body[1]); }
    trinket(hx, cy - ry * 0.02, rx * 0.8);
    const ax = rx * 0.9, ay = cy + ry * 0.1, arm = E(ax, ay, rx * 0.18, ry * 0.3, -0.35 + sw * 0.3 - (A.flare || 0) * 0.8);
    ink(arm); solid(arm, g.body, ax, ay, rx * 0.18, ry * 0.3, { rim: '' });
    const hx2 = ax + rx * 0.06, hy2 = ay + ry * 0.24;
    if (g.hold === 'leaf') { line([[hx2, hy2], [hx2 - 0.02, cy - ry * 1.28]], 0.022, g.leaf[0]); solid(leafP(hx2 - 0.4, cy - ry * 1.22, -0.12, 0.66, 0.12), g.leaf, hx2 - 0.07, cy - ry * 1.3, 0.33, 0.12, { rim: '' }); }
    else if (g.hold === 'acorn') { solid(E(hx2 + 0.02, hy2 + 0.02, 0.06, 0.07), g.horn, hx2 + 0.02, hy2 + 0.02, 0.06, 0.07, { rim: '' }); fill(E(hx2 + 0.02, hy2 - 0.04, 0.065, 0.03), g.horn[0]); }
    else if (g.hold === 'lantern') { line([[hx2, hy2], [hx2 + 0.03, hy2 + 0.08]], 0.012, g.inkC); solid(E(hx2 + 0.03, hy2 + 0.15, 0.06, 0.075), g.glow, hx2 + 0.03, hy2 + 0.15, 0.06, 0.075, { rim: '', gloss: 1 }); }
    head(hx, hy, hr, { part: 'front', noShape: 1, fy: hr * 0.05 });
    x.restore();
  },
  kodama(g, A) {
    const ph = A.t * TAU, mv = A.mv, hrx = g.sub === 'wide' ? 0.31 : 0.26, hry = g.sub === 'tall' ? 0.36 : 0.28, by = -0.27, up = A.flare > 0.6;
    for (const s of [1, -1]) { const q = ph + (s > 0 ? 0 : Math.PI), lift = Math.max(0, Math.sin(q)) * 0.05 * mv; line([[s * 0.055, by + 0.06], [s * 0.07 + Math.cos(q) * 0.03 * mv, -lift - A.bobS - 0.012]], 0.045, s > 0 ? g.body[1] : g.body[2]); }
    const swing = Math.sin(ph) * 0.3 * mv;
    line(spine(-0.09, by - 0.05, up ? -2.3 : 1.9 + swing, 0.16, 0.3, 3), 0.04, g.body[1], true);
    const bp = curve([[-0.1, by - 0.1], [0.11, by - 0.1], [0.12, by + 0.07], [0, by + 0.12], [-0.12, by + 0.07]]);
    ink(bp); solid(bp, g.body, 0, by, 0.12, 0.12, { rim: '' }); trinket(0.01, by - 0.08, 0.2);
    line(spine(0.1, by - 0.05, up ? -0.8 : 1.2 - swing, 0.16, -0.3, 3), 0.042, g.body[2], true);
    head(0, by - 0.1 - hry * 0.9, hrx, { rx: hrx, ry: hry, tiltK: 2.2 });
  },
  puff(g, A) {
    const n = g.legs || 0, legH = n ? 0.13 : 0, r = 0.4, cy = -legH - r * 0.93, ph = A.t * TAU, mv = A.mv, w = Math.max(0.026, px(1));
    for (let i = 0; i < n; i++) { const far = i % 2 === 0, m = n / 2, u = m > 1 ? Math.floor(i / 2) / (m - 1) - 0.5 : 0, hx = u * r * 1.1 + (far ? -0.03 : 0.03), q = ph + i * 1.7, lift = Math.max(0, Math.sin(q)) * 0.05 * mv, fy = -lift - A.bobS; line([[hx, cy + r * 0.6], [hx * 1.25 + (hx >= 0 ? 0.03 : -0.03), (cy + r * 0.6 + fy) / 2], [hx * 1.35 + Math.sin(q) * 0.03 * mv, fy]], w, far ? g.body[0] : g.body[1]); }
    if (g.A !== 'spirit') tail(-r * 0.85, cy + r * 0.2, 0.8);
    head(0, cy, r, { fur: [g.spiky ? 13 : 10, g.spiky ? 0.16 : 0.09, g.spiky], eyeK: 1.3, fy: r * 0.06, gap: 0.38, deep: 1 });
    if (g.hold === 'star') { const sx = r * 0.85, sy = cy - r * 0.55 - (A.flare || 0) * 0.08, pts = []; line([[r * 0.6, cy - r * 0.1], [sx - 0.03, sy + 0.05]], w, g.body[0]); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i & 1 ? 0.045 : 0.1; pts.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr]); } solid(poly(pts), g.petal, sx, sy, 0.1, 0.1, { rim: '' }); }
  },
  mochi(g, A) {
    const x = X, w = 0.46, h = g.sub === 'drop' ? 0.74 : 0.6, cy = -h * 0.45, r = w * 0.62, o = { ry: h * 0.6 };
    if (g.ears !== 'none') head(0.02, -h * 0.4, r, { ...o, part: 'back', noShape: 1 });
    const pts = [[-w, -0.02], [-w * 0.96, -h * 0.32], [-w * 0.7, -h * 0.78], [0, -h], [w * 0.7, -h * 0.78], [w * 0.96, -h * 0.32], [w, -0.02], [0, 0.012]];
    if (g.sub === 'drop') { pts[2] = [-w * 0.55, -h * 0.72]; pts[3] = [0.04, -h * 1.02]; pts[4] = [w * 0.55, -h * 0.72]; }
    const p = curve(pts);
    solid(p, g.body, 0, cy, w, h * 0.55, { gloss: 1, deep: 1 });
    if (g.sub === 'jelly') { x.save(); x.clip(p); fill(E(0.04, -h * 0.4, w * 0.6, h * 0.34), g.body[3]); const hy = -h * 0.2; solid(curve([[0.13, hy - 0.03], [0.17, hy - 0.07], [0.21, hy - 0.04], [0.17, hy + 0.04]]), g.glow, 0.17, hy - 0.02, 0.05, 0.05, { rim: '' }); x.restore(); }
    if (g.crown === 'leaf') solid(leafP(-w * 0.98, -0.01, -1.15, h * 0.98, w * 0.24), g.leaf, -w * 0.72, -h * 0.4, w * 0.25, h * 0.4, { rim: '' });
    head(0.02, -h * 0.4, r, { ...o, part: 'front', noShape: 1, fy: r * 0.08, eyeK: 0.95, noCrown: g.crown === 'leaf' });
    spitFx(w * 0.85, -h * 0.35);
  },
  wisp(g, A) {
    const x = X, r = 0.3, cy = -0.6, ph = A.ph, sub = g.sub;
    if (sub === 'jelly') for (let i = 0; i < 5; i++) { const sx = -r * 0.7 + i * r * 0.35, pts = spine(sx, cy + r * 0.25, Math.PI / 2, 0.3 + (i % 2) * 0.1, Math.sin(ph + i) * 0.8, 5); line(pts, 0.022, i % 2 ? g.glow[3] : g.acc[2], true); }
    if (sub !== 'flame' && sub !== 'jelly') for (const s of [-1, 1]) { const ax = s * r * 0.95, ay = cy + r * 0.45, p = E(ax, ay - (A.flare || 0) * 0.1, r * 0.2, r * 0.13, s * 0.6); solid(p, s > 0 ? g.body : dk(g.body), ax, ay, r * 0.2, r * 0.13, { rim: '' }); }
    let p;
    if (sub === 'ghost' || sub === 'mask') { const wv = Math.sin(ph) * 0.04; p = curve([[-r, cy], [-r * 0.7, cy - r * 0.72], [0, cy - r], [r * 0.7, cy - r * 0.72], [r, cy], [r * 1.02, cy + r * 0.85], [r * 0.66, cy + r * 1.18 + wv], [r * 0.33, cy + r * 1.0], [0, cy + r * 1.22 - wv], [-r * 0.33, cy + r * 1.0], [-r * 0.66, cy + r * 1.18 + wv], [-r * 1.02, cy + r * 0.85]]); }
    else if (sub === 'jelly') { const pts = [[-r * 1.05, cy + r * 0.3], [-r * 0.85, cy - r * 0.45], [0, cy - r * 0.9], [r * 0.85, cy - r * 0.45], [r * 1.05, cy + r * 0.3]]; for (let i = 1; i < 7; i++) pts.push([r * 1.05 - i * r * 0.3, cy + r * (i & 1 ? 0.45 : 0.3) + Math.sin(ph + i) * 0.015]); p = curve(pts); }
    else { const tp = spine(0.02, cy + r * 0.55, Math.PI * 0.6 + Math.sin(ph) * 0.15, 0.62, 2.4 + Math.sin(ph) * 0.4, 9); solid(tube(tp, tp.map((_, i) => r * 0.95 * Math.pow(1 - i / 9, 1.1) + 0.012)), g.body, ...bbox(tp, 0.1), { rim: g.glow[3], hi: 0 }); p = E(0, cy, r, r); }
    solid(p, g.body, 0, cy, r, r * (sub === 'ghost' || sub === 'mask' ? 1.1 : 1), { gloss: 1, rim: g.glow[3] });
    if (sub === 'flame') { flame(-0.08, cy - r * 0.82, 0.11, ph + 1); flame(0.07, cy - r * 0.9, 0.14, ph); }
    head(0.02, cy + r * 0.05, r, { noShape: 1, fy: r * 0.08, eyeK: 1.1 });
  },
  birdy(g, A) {
    const x = X, rx = 0.31 * g.fat, ry = 0.34, cy = -0.07 - ry, hr = ry * 0.8, hx = rx * 0.12, hy = cy - ry * 0.3;
    for (const s of [1, -1]) { const fx = s * 0.08 + 0.02, fy = -0.012 - (A.air ? 0 : A.bobS), c = s > 0 ? g.beak[0] : g.beak[2]; line([[fx, cy + ry * 0.8], [fx, fy]], 0.028, c); line([[fx - 0.04, fy], [fx + 0.07, fy]], 0.022, c); }
    x.save(); x.translate(0, -0.05); x.rotate(A.lean * 0.7); x.translate(0, 0.05);
    tail(-rx * 0.82, cy + ry * 0.25);
    wing(-rx * 0.15, cy - ry * 0.05, 0.3, false);
    head(hx, hy, hr, { part: 'back', noShape: 1 });
    const p = g.fluff > 0.5 ? furE(0, cy, rx, ry, 10, 0.05, 7) : E(0, cy, rx, ry);
    solid(p, g.body, 0, cy, rx, ry, { deep: 1 });
    x.save(); x.clip(p); solid(E(rx * 0.28, cy + ry * 0.4, rx * 0.62, ry * 0.6), g.belly, rx * 0.28, cy + ry * 0.4, rx * 0.62, ry * 0.6, { rim: '' }); if (Q.detail || !Q.F) for (let i = 0; i < 5; i++) { const sx = rx * (0.05 + (i % 3) * 0.2), sy = cy + ry * (0.25 + Math.floor(i / 3) * 0.25); line([[sx - rx * 0.06, sy], [sx, sy + ry * 0.05], [sx + rx * 0.06, sy]], rx * 0.025, g.belly[1]); } x.restore();
    if (g.shellBack) shellDome(-rx * 0.38, cy - ry * 0.25, rx * 0.68, ry * 0.7);
    wing(-rx * 0.02, cy + ry * 0.05, 0.3, true);
    head(hx, hy, hr, { part: 'front', noShape: 1 });
    x.restore();
  },
  moth(g, A) {
    const r = 0.25, cy = -0.55, mv = A.mv, ph = A.t * TAU;
    mothWings(0.01, cy + r * 0.1, 0.52, true);
    const ab = furE(0, cy + r * 1.2, r * 0.42, r * 0.55, 6, 0.15, 9); solid(ab, dk(g.body), 0, cy + r * 1.2, r * 0.42, r * 0.55, { rim: '' });
    for (const s of [-1, 1]) line([[s * r * 0.3, cy + r * 0.9], [s * r * 0.45, cy + r * 1.35 + Math.sin(ph + s) * 0.03 * mv]], r * 0.07, g.body[0]);
    head(0.01, cy, r, { fur: [9, 0.1], eyeK: 1.15, fy: r * 0.1, gap: 0.4 });
    fill(furE(0.01, cy + r * 0.84, r * 0.9, r * 0.28, 7, 0.3, 11), g.belly[3]);
  },
  noodle(g, A) {
    const ph = A.ph, N = 16, pts = [], rad = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([-0.06 + 0.25 * Math.sin(TAU * 0.85 * u + 0.5 - ph * 0.6) * (0.55 + 0.45 * u), -0.1 - u * 0.58]); rad.push(0.02 + 0.078 * Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * u)), 0.6)); }
    const nrm = (i) => { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(N, i + 1)], dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1; return [dy / d, -dx / d]; };
    const e = pts[0], k = g.tail;
    if (k === 'fish') for (const s of [-1, 1]) solid(leafP(e[0], e[1], Math.PI * 0.5 + s * 0.7, 0.2, 0.06), s > 0 ? dk(g.acc) : g.acc, e[0], e[1] + 0.08, 0.1, 0.08, { rim: '' });
    else if (k === 'wisp') flame(e[0] - 0.05, e[1] + 0.04, 0.15, ph);
    else { const q = furE(e[0] - 0.05, e[1] + 0.02, 0.1, 0.08, 6, 0.35, 45); solid(q, g.acc, e[0] - 0.05, e[1] + 0.02, 0.1, 0.08, { rim: '' }); }
    const paw = (i, near) => { const [a, b] = pts[i], c = near ? g.body[2] : g.body[1], fx = a + 0.07 + rad[i] * 0.4, fy = b + rad[i] + 0.04; line([[a + rad[i] * 0.3, b], [fx, fy]], 0.038, c); fill(E(fx + 0.02, fy, 0.04, 0.026), c); };
    if (g.paws) { paw(5, false); paw(11, false); }
    if (g.fin) fill(tube(pts.map(([a, b], i) => { const [nx, ny] = nrm(i); return [a + nx * rad[i] * 0.7, b + ny * rad[i] * 0.7]; }), rad.map((v) => v * 0.75 + 0.02)), g.acc[3]);
    const p = tube(pts, rad, 0, 3);
    solid(p, g.body, ...bbox(pts, 0.1), {});
    X.save(); X.clip(p); fill(tube(pts.map(([a, b], i) => { const [nx, ny] = nrm(i); return [a - nx * rad[i] * 0.62, b - ny * rad[i] * 0.62]; }), rad.map((v) => v * 0.55)), g.belly[2]); X.restore();
    if (!g.fin) for (let i = 2; i < N - 1; i += 2) { const [a, b] = pts[i], [nx, ny] = nrm(i); fill(leafP(a + nx * rad[i] * 0.8, b + ny * rad[i] * 0.8, Math.atan2(ny, nx) - 0.6, rad[i] * 0.9 + 0.03, 0.022), g.acc[2]); }
    if (g.paws) { paw(4, true); paw(10, true); }
    head(pts[N][0] + 0.1, pts[N][1] - 0.07, 0.2);
    spitFx(pts[N][0] + 0.3, pts[N][1] - 0.02);
  },
  pup(g, A) {
    const n = g.segs, ph = A.t * TAU, mv = A.mv, w = Math.max(0.03, px(1));
    let lx = 0, ly = 0;
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) : 1, r = 0.11 + 0.05 * u, hump = mv ? Math.max(0, Math.sin(ph - i * 1.2)) * 0.07 : 0, cx = -0.5 + i * 0.15, cy = -r - hump - 0.025;
      for (const s of [-1, 1]) line([[cx + s * r * 0.35, cy + r * 0.6], [cx + s * r * 0.45, -0.012 - (mv ? Math.max(0, Math.sin(ph - i * 1.2 + s)) * 0.03 : 0) - A.bobS]], w, s > 0 ? g.body[1] : g.body[0]);
      const p = furE(cx, cy, r, r * 0.95, 7, 0.1, 20 + i); solid(p, g.body, cx, cy, r, r * 0.95, {});
      X.save(); X.clip(p); fill(E(cx, cy + r * 0.95, r * 1.1, r * 0.42), g.belly[2]); fill(E(cx - r * 0.05, cy - r * 0.35, r * 0.24, r * 0.2), g.acc[2]); X.restore();
      lx = cx; ly = cy;
    }
    head(lx + 0.2, ly - 0.08 - (mv ? 0.02 : 0) + (A.reach || 0) * -0.3, 0.24);
    spitFx(lx + 0.45, ly - 0.05);
  },
  shell(g, A) {
    const ph = A.t * TAU, x = X;
    if (g.sub === 'snail') {
      const wv = A.mv ? Math.sin(ph) * 0.03 : 0, pts = [[-0.5, -0.05], [-0.25 + wv, -0.065], [0.04, -0.08], [0.22, -0.18], [0.28, -0.32]], rad = [0.03, 0.07, 0.085, 0.09, 0.1];
      solid(tube(pts, rad, 0, 7), g.body, 0, -0.15, 0.4, 0.15, {});
      const sx = -0.12, sy = -0.38, sp = E(sx, sy, 0.27, 0.27); ink(sp); solid(sp, g.shellR, sx, sy, 0.27, 0.27, { gloss: 1, rim: '' });
      const sp2 = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + i * 0.42, rr = 0.24 * (1 - i / 28); sp2.push([sx + Math.cos(a) * rr * 0.95, sy + Math.sin(a) * rr]); } line(sp2, 0.022, g.shellR[0], true);
      garden(sx - 0.04, sy - 0.24, 0.32);
      head(0.32, -0.44, 0.2);
    } else {
      const lr = 0.06;
      leg(0.2, -0.2, lr, ph + Math.PI, false); leg(-0.26, -0.2, lr, ph, false);
      const tx = -0.42; solid(E(tx, -0.17, 0.06, 0.035, 0.4), g.body, tx, -0.17, 0.06, 0.035, { rim: '' });
      shellDome(-0.06, -0.38, 0.38, 0.3);
      garden(-0.1, -0.67, 0.42);
      leg(0.12, -0.2, lr, ph, true); leg(-0.34, -0.2, lr, ph + Math.PI, true);
      head(0.34 + (A.reach || 0), -0.32, 0.19);
      spitFx(0.5, -0.28);
    }
  },
  lantern(g, A) {
    const x = X, sub = g.sub, ph = A.ph;
    if (sub === 'kettle') {
      const lr = 0.055, ph2 = A.t * TAU; leg(0.18, -0.2, lr, ph2 + Math.PI, false); leg(-0.2, -0.2, lr, ph2, false);
      tail(-0.34, -0.3);
      const p = E(0, -0.3, 0.36, 0.24); ink(p); solid(p, g.shellR, 0, -0.3, 0.36, 0.24, { gloss: 1 });
      line([[-0.35, -0.32], [0, -0.28], [0.35, -0.32]], 0.03, g.shellR[3], true);
      solid(E(-0.04, -0.53, 0.2, 0.06), g.shellR, -0.04, -0.53, 0.2, 0.06, { rim: '' }); solid(E(-0.04, -0.6, 0.05, 0.04), g.horn, -0.04, -0.6, 0.05, 0.04, { rim: '' }); line([[-0.24, -0.5], [-0.12, -0.72], [0.06, -0.72], [0.16, -0.5]], 0.026, g.horn[0], true);
      leg(0.12, -0.18, lr, ph2, true); leg(-0.27, -0.18, lr, ph2 + Math.PI, true);
      head(0.3, -0.52, 0.2); spitFx(0.48, -0.48);
      return;
    }
    if (sub === 'kasa') {
      const fy = -0.012 - (A.air ? 0 : A.bobS); line([[0.02, -0.42], [0.02, fy - 0.04]], 0.042, g.horn[1]);
      fill(poly([[-0.08, fy - 0.045], [0.13, fy - 0.045], [0.13, fy - 0.018], [-0.08, fy - 0.018]]), g.horn[1]); line([[-0.04, fy - 0.02], [-0.04, fy]], 0.025, g.horn[0]); line([[0.09, fy - 0.02], [0.09, fy]], 0.025, g.horn[0]);
      x.save(); x.translate(0, -0.42); x.rotate(0.08 + (A.tilt || 0)); x.translate(0, 0.42);
      const hem = [], pts = [[0, -1.02], [0.22, -0.88], [0.4, -0.64], [0.47, -0.44]];
      for (let i = 0; i <= 8; i++) hem.push([0.47 - i * 0.1175, -0.42 + (i & 1 ? -0.07 : 0)]);
      const p = curve([...pts, ...hem.slice(1, 8), [-0.47, -0.44], [-0.4, -0.64], [-0.22, -0.88]]);
      solid(p, g.body, 0, -0.7, 0.45, 0.32, { deep: 1 });
      x.save(); x.clip(p); for (let i = 0; i <= 8; i += 2) line([[0, -1.0], [hem[i][0] * 0.98, -0.42]], 0.014, g.body[1]); x.restore();
      fill(E(0, -1.04, 0.035, 0.035), g.horn[1]);
      head(0.04, -0.66, 0.26, { noShape: 1, fy: 0, eyeK: 1.25 });
      x.restore();
      return;
    }
    const sw = A.mv ? Math.sin(A.t * TAU) * 0.06 : 0;
    x.save(); x.translate(0, -0.98); x.rotate(sw); x.translate(0, 0.98);
    line([[-0.1, -0.95], [-0.08, -1.04], [0.08, -1.04], [0.1, -0.95]], 0.02, g.inkC, true);
    const p = E(0, -0.56, 0.3, 0.36);
    solid(p, g.body, 0, -0.56, 0.3, 0.36, { rim: g.glow[3] });
    x.save(); x.clip(p); x.globalAlpha = 0.6; fill(E(0.02, -0.52, 0.2, 0.24), g.glow[3]); x.globalAlpha = 1; if (hpx(0.3) > 10) for (const k of [-0.22, 0.22]) line([[-0.32, -0.56 + k], [0, -0.56 + k * 1.08], [0.32, -0.56 + k]], 0.012, g.body[1], true); x.restore();
    fill(E(0, -0.92, 0.17, 0.05), g.inkC); fill(E(0, -0.2, 0.15, 0.045), g.inkC);
    head(0, -0.58, 0.3, { noShape: 1, fy: 0.0 });
    x.restore();
  }
};

// ---------------------------------------------------------------- poses
// pose: { t (cycle 0..1), walk, breath, atk (1 wind-up, 2 strike, 3 recover), hurt, dead }
function anim(g, pose) {
  const A = { t: pose.t || 0, mv: pose.walk ? 1 : 0, br: pose.breath ? 1 : 0, bob: 0, sq: 1, dx: 0, lean: 0, tilt: 0, eyes: 'open', mouth: 0, flare: 0, spit: 0, ear: 0, tail: 0, wing: 0, reach: 0, pounce: 0, air: 0, atk: pose.atk || 0 };
  const s = Math.sin(A.t * TAU), c = Math.cos(A.t * TAU), L = g.loco;
  A.ph = A.t * TAU + A.br * 1.6;
  if (A.br) { if (L === 'float') { A.bob = -0.035; A.wing = 0.7; A.tail = 0.3; } else { A.sq = 0.965; A.tail = 0.18; A.wing = 0.35; } A.ear = 0.12; A.tilt = 0.035; }
  if (A.mv) {
    if (L === 'hop') { const H = [[0.84, 0], [1.12, -0.07], [1, -0.15], [1.07, -0.05]][Math.round(A.t * 4) % 4]; A.sq = H[0]; A.bob = H[1]; A.air = H[1] < 0 ? 1 : 0; A.ear = H[1] < -0.1 ? 0.3 : -0.2; A.tail = -H[1] * 2; A.wing = H[1] < -0.1 ? 1 : -0.4; }
    else if (L === 'float') { A.bob = s * 0.045; A.tail = c * 0.4; A.ear = s * 0.15; A.wing = c; A.tilt = s * 0.04; }
    else { A.bob = -Math.abs(s) * 0.022; A.tail = s * 0.35; A.ear = 0.05 - Math.abs(s) * 0.15; A.tilt = (L === 'waddle' ? 0.06 : 0.03) * s; A.wing = s * 0.3; if (L === 'waddle') A.lean = s * 0.07; }
  }
  if (A.atk) {
    const k = A.atk, K = g.atk;
    A.eyes = k === 3 ? 'open' : 'angry'; A.ear = k < 3 ? -0.35 : -0.1; A.tail = [0, 0.5, -0.3, 0.2][k];
    A.dx = [0, -0.05, 0.09, 0.035][k]; A.sq = [1, 0.9, 1.06, 0.98][k]; A.lean = [0, -0.1, 0.14, 0.04][k]; A.wing = [0, 1, -0.8, 0.3][k];
    A.mouth = [0, 0, 1, 0.3][k]; A.flare = K === 'flare' ? [0, 0.5, 1, 0.4][k] : 0; A.spit = K === 'spit' && k === 2 ? 1 : 0;
    if (K === 'pounce') { A.bob = [0, 0.015, -0.08, -0.02][k]; A.air = k === 2 ? 1 : 0; A.pounce = [0, -0.5, 1, 0.3][k]; A.dx *= 1.25; }
    if (K === 'peck') { A.lean = [0, -0.18, 0.38, 0.1][k]; A.dx *= 0.6; }
    if (K === 'lunge') A.reach = [0, -0.03, 0.08, 0.03][k];
    if (K === 'flare') { A.dx *= 0.4; A.sq = [1, 0.94, 1.08, 1][k]; A.bob = L === 'float' ? [0, 0.01, -0.04, -0.01][k] : 0; A.wing = [0, 1, -1, 0][k]; }
  }
  if (pose.hurt) Object.assign(A, { dx: -0.06, sq: 0.86, lean: -0.14, eyes: 'shut', mouth: 0.6, ear: -0.4, tail: -0.3, tilt: -0.08, wing: 0.8 });
  if (pose.dead) Object.assign(A, { dead: 1, mv: g.die === 'flip' ? 1 : 0, t: 0.3, eyes: g.die === 'fade' ? 'calm' : 'x', mouth: g.die === 'fade' ? 0 : 0.6, ear: -0.45, tail: -0.4, wing: -0.7, sq: g.die === 'squish' ? 0.55 : g.die === 'fade' ? 0.95 : 1, bob: 0 });
  return A;
}
function paint(x, g, pose, q) {
  X = x; G = g; Q = q; const A = anim(g, pose); Q.A = A; Q.eyes = A.eyes;
  const snap = (v) => (q.F ? Math.round(v / q.u) * q.u : v);
  A.bobS = snap(A.bob);
  x.save();
  // flopped over: a quarter turn onto its back, resting on the ground, kept inside the frame
  if (A.dead && g.die === 'flop' && q.box) { const b = q.box, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, w = b.x1 - b.x0, h = b.y1 - b.y0, rm = q.room || { cx, w: h, h: w }, k = Math.min(1, rm.w / h, rm.h / w); x.translate(rm.cx, b.y1 - (w * k) / 2); x.scale(k, k); x.rotate(-Math.PI / 2); x.translate(-cx, -cy); }
  if (A.dead && g.die === 'flip' && q.box) { const b = q.box, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; x.translate(cx, cy); x.rotate(Math.PI); x.translate(-cx, -cy); }
  x.translate(snap(A.dx), A.bobS);
  const pv = g.loco === 'float' ? -0.5 : 0; x.translate(0, pv); x.scale(1 / Math.sqrt(A.sq), A.sq); x.translate(0, -pv);
  BODY[g.plan](g, A);
  x.restore();
}

// ---------------------------------------------------------------- framing and the pixel pipeline
let WK = null, WX = null, BUF = null;
function work(w, h) { if (!WK) { WK = document.createElement('canvas'); WK.width = w; WK.height = h; WX = WK.getContext('2d', { willReadFrequently: true }); } else if (WK.width < w || WK.height < h) { WK.width = Math.max(WK.width, w); WK.height = Math.max(WK.height, h); } return WX; }
const PROBES = [{}, { walk: 1, t: 0.25 }, { walk: 1, t: 0.5 }, { walk: 1, t: 0.75 }, { atk: 2 }];
// the union of the main poses' silhouettes, in units (measured once per genome at low resolution)
function measure(g) {
  if (g.box) return g.box;
  const S = 34, PW = 116, PH = 110, ox = 58, oy = 82, x = work(PW, PH); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const pose of PROBES) {
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, PW, PH); x.setTransform(S, 0, 0, S, ox, oy);
    paint(x, g, pose, { F: 0, u: 1 / 30, probe: 1 });
    const d = x.getImageData(0, 0, PW, PH).data;
    for (let yy = 0; yy < PH; yy++) for (let xx = 0; xx < PW; xx++) if (d[(yy * PW + xx) * 4 + 3] > 100) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  }
  return (g.box = { x0: (x0 - ox) / S, x1: (x1 + 1 - ox) / S, y0: (y0 - oy) / S, y1: (y1 + 1 - oy) / S });
}
function fitFor(g, w, h, pad) {
  const b = measure(g), bw = b.x1 - b.x0, bh = b.y1 - b.y0, aw = w - 2 - pad * 2, ah = h - 2 - pad * 2, s = Math.min(aw / bw, ah / bh);
  const ox = Math.round((w - bw * s) / 2 - b.x0 * s), oy = Math.round(h - 1 - pad - b.y1 * s);
  return { w, h, s, ox, oy, box: b, room: { cx: (w / 2 - ox) / s, w: aw / s, h: ah / s } };
}
function palFor(g) {
  if (g.pal) return g.pal;
  const rgb = [], grp = [], add = (R, idx, k) => { for (const i of idx) { rgb.push(R.rgb[i]); grp.push(k); } }, U = g.uses;
  add(g.body, [0, 1, 2, 3, 4], 0); add(g.belly, [1, 2, 3, 4], 1); add(g.acc, [0, 1, 2, 3], 2); add(g.pink, [1, 2], 8);
  if (U.glow) add(g.glow, [1, 2, 3, 4], 3); if (U.leaf) add(g.leaf, [0, 1, 2, 3], 4); if (U.petal) add(g.petal, [1, 2, 3], 5); if (U.horn) add(g.horn, [0, 1, 2], 6); if (U.beak) add(g.beak, [0, 1, 2, 3], 7);
  if (U.cloth) add(g.cloth, [1, 2, 3], 9); if (U.paper) add(g.paper, [1, 2, 3], 10); if (U.shell) add(g.shellR, [0, 1, 2, 3], 11); if (U.wing) { add(g.wingR, [1, 2, 3], 12); add(g.wingR2, [1, 2, 3], 13); }
  for (const c of [g.pupil, g.white, g.blush, g.tongue, g.iris, g.ink]) { rgb.push(c); grp.push(-1); }
  const n = rgb.length, dn = new Int16Array(n), up = new Int16Array(n);
  for (let i = 0; i < n; i++) { dn[i] = i > 0 && grp[i] >= 0 && grp[i - 1] === grp[i] ? i - 1 : i; up[i] = i < n - 1 && grp[i] >= 0 && grp[i + 1] === grp[i] ? i + 1 : i; }
  const line = rgb.map((c, i) => (grp[i] === 3 ? mix(c, g.glow.rgb[0], 0.6) : mix(c, g.outRGB, 0.78)));
  return (g.pal = { rgb, grp, dn, up, line });
}
// draw a pose at 4× into the work canvas, box-filter it down, quantise to the palette, outline, effects
function pixelFrame(g, pose, fit, fx = {}) {
  const { w, h, s } = fit, F = ssFor(h), W = w * F, H = h * F, x = work(W, H);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.setTransform(s * F, 0, 0, s * F, fit.ox * F, fit.oy * F);
  paint(x, g, pose, { F, u: 1 / s, detail: s >= 34, ink: s >= 20, box: fit.box, room: fit.room });
  const src = x.getImageData(0, 0, W, H).data, n = w * h;
  if (!BUF || BUF.n < n) BUF = { n, acc: new Float32Array(n * 4), id: new Int16Array(n), out: new Uint8ClampedArray(n * 4) };
  const acc = BUF.acc.fill(0, 0, n * 4), id = BUF.id.fill(-1, 0, n), out = BUF.out.fill(0, 0, n * 4), memo = new Map();
  for (let yy = 0; yy < H; yy++) { const row = ((yy / F) | 0) * w; for (let xx = 0; xx < W; xx++) { const i = (yy * W + xx) * 4, a = src[i + 3]; if (!a) continue; const t = (row + ((xx / F) | 0)) * 4; acc[t] += src[i] * a; acc[t + 1] += src[i + 1] * a; acc[t + 2] += src[i + 2] * a; acc[t + 3] += a; } }
  const P = palFor(g), C = P.rgb, full = 255 * F * F, dz = g.dither ? 30 : 0, gz = g.grit * 18;
  for (let t = 0; t < n; t++) {
    const a = acc[t * 4 + 3]; if (a < full * 0.5) continue;
    const tx = t % w, ty = (t / w) | 0, o = (dz ? (BAYER[(ty & 3) * 4 + (tx & 3)] / 16 - 0.47) * dz : 0) + (gz ? (hash(tx, ty, g.seed) - 0.5) * gz : 0);
    const r = acc[t * 4] / a + o, gg = acc[t * 4 + 1] / a + o, b = acc[t * 4 + 2] / a + o, key = ((r + 64) >> 1) * 262144 + ((gg + 64) >> 1) * 512 + ((b + 64) >> 1);
    let best = memo.get(key);
    if (best === undefined) { let bd = 1e12; best = 0; for (let k = 0; k < C.length; k++) { const c = C[k], dr = r - c[0], dg = gg - c[1], db = b - c[2], d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = k; } } memo.set(key, best); }
    id[t] = best;
  }
  if (g.grit) for (let t = 0; t < n; t++) { const k = id[t]; if (k < 0) continue; const q = hash(t, 7, g.seed); if (q < 0.045 * g.grit) id[t] = P.dn[k]; else if (q > 1 - 0.02 * g.grit) id[t] = P.up[k]; }
  const put = (t, c) => { out[t * 4] = c[0]; out[t * 4 + 1] = c[1]; out[t * 4 + 2] = c[2]; out[t * 4 + 3] = 255; };
  for (let t = 0; t < n; t++) if (id[t] >= 0) put(t, C[id[t]]);
  if (g.line) for (let t = 0; t < n; t++) {
    if (id[t] >= 0) continue;
    const tx = t % w, ty = (t / w) | 0, k = tx > 0 && id[t - 1] >= 0 ? id[t - 1] : tx < w - 1 && id[t + 1] >= 0 ? id[t + 1] : ty > 0 && id[t - w] >= 0 ? id[t - w] : ty < h - 1 && id[t + w] >= 0 ? id[t + w] : -1;
    if (k >= 0 && !(g.grit && hash(t, 3, g.seed) < 0.05 * g.grit)) put(t, fx.flare > 0.7 ? g.glow.rgb[3] : P.line[k]);
  }
  const ph = fx.phase || 0;
  if (fx.aura) { // a dithered glow ring around the silhouette
    const dist = new Uint8Array(n).fill(255); let front = [];
    for (let t = 0; t < n; t++) if (out[t * 4 + 3]) { dist[t] = 0; front.push(t); }
    for (let d = 1; d <= fx.aura; d++) { const nx = []; for (const t of front) { const tx = t % w, ty = (t / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = tx + dx, b = ty + dy; if (a < 0 || b < 0 || a >= w || b >= h) continue; const u = b * w + a; if (dist[u] === 255) { dist[u] = d; nx.push(u); } } } front = nx; }
    for (let t = 0; t < n; t++) { const d = dist[t]; if (!d || d === 255) continue; const tx = t % w, ty = (t / w) | 0; if (BAYER[((ty + ph) & 3) * 4 + ((tx + ph * 2) & 3)] / 16 < (fx.flare ? 0.62 : 0.38) - (d - 1) * 0.24) put(t, d === 1 ? g.glow.rgb[3] : g.glow.rgb[2]); }
  }
  if (fx.dissolve) { // the lower body crumbles into sparks
    let top = h, bot = -1; for (let t = 0; t < n; t++) if (out[t * 4 + 3]) { const ty = (t / w) | 0; if (ty < top) top = ty; if (ty > bot) bot = ty; }
    for (let t = 0; t < n; t++) { if (!out[t * 4 + 3]) continue; const tx = t % w, ty = (t / w) | 0, v = (ty - top) / Math.max(1, bot - top), d = Math.min(0.9, Math.max(0, v * 1.5 - 0.45)); if (BAYER[(ty & 3) * 4 + (tx & 3)] / 16 < d) out[t * 4 + 3] = 0; else if (v > 0.4 && hash(tx, ty, g.seed) < 0.35) put(t, g.glow.rgb[hash(ty, tx, 1) < 0.5 ? 3 : 2]); }
    fx.motes = (fx.motes || 0) + 3;
  }
  if (fx.motes) { const R = mulberry32((g.seed ^ (ph * 977 + 13)) >>> 0); for (let i = 0; i < fx.motes; i++) { const mx = Math.floor(R() * w), my = Math.floor(R() * h * 0.85), t = my * w + mx; if (out[t * 4 + 3]) continue; put(t, g.glow.rgb[4]); if (w >= 40) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X2 = mx + a, Y2 = my + b, u = Y2 * w + X2; if (X2 >= 0 && X2 < w && Y2 >= 0 && Y2 < h && !out[u * 4 + 3]) put(u, g.glow.rgb[3]); } } }
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.pixel = true;
  c.getContext('2d').putImageData(new ImageData(out.slice(0, n * 4), w, h), 0, 0);
  return c;
}
// a smooth 160 px portrait with a soft outline (and a halo of light for old spirits)
function bigRender(g) {
  const S = 160, b = measure(g), bw = b.x1 - b.x0, bh = b.y1 - b.y0, s = (S - 22) / Math.max(bw, bh), ox = S / 2 - ((b.x0 + b.x1) / 2) * s, oy = S / 2 - ((b.y0 + b.y1) / 2) * s;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const art = mk(), x = art.getContext('2d', { willReadFrequently: true }); x.setTransform(s, 0, 0, s, ox, oy);
  paint(x, g, {}, { F: 0, u: 1.2 / s, detail: 1, ink: 1, big: 1 });
  const sil = mk(), sx = sil.getContext('2d', { willReadFrequently: true }); sx.drawImage(art, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = css(g.outRGB); sx.fillRect(0, 0, S, S);
  const c = mk(), o = c.getContext('2d');
  if (g.tier >= 2 || g.plan === 'wisp' || g.plan === 'lantern') { const gr = o.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2); gr.addColorStop(0, `rgba(${g.glow.rgb[3].map((v) => v | 0)},${0.25 + g.tier * 0.08})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = gr; o.fillRect(0, 0, S, S); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; o.drawImage(sil, Math.cos(a) * 2.4, Math.sin(a) * 2.4); }
  o.drawImage(art, 0, 0);
  return c;
}
// what the haruspex finds inside: colours to match the hide, and organs (spirits have glowing ichor)
function anatomy(g) {
  const R = mulberry32((g.seed ^ 0xa5a5a5) >>> 0), r = (a, b) => a + R() * (b - a), spirit = g.glowy || ['wisp', 'lantern', 'kodama', 'mochi', 'puff'].includes(g.plan);
  const flesh = spirit ? mix(g.glow.rgb[3], [255, 236, 240], 0.45) : mix(hsl(355, 60, 60), g.body.rgb[2], 0.18), blood = spirit ? g.glow.rgb[2] : hsl(352 + r(-8, 8), 72, 33), red = hsl(352, 70, 45);
  const organs = [{ kind: 'heart', col: hex(spirit ? g.glow.rgb[2] : red), size: r(0.8, 1.3) }, { kind: 'liver', col: hex(mix(hsl(8, 55, 30), g.body.rgb[1], 0.15)), size: r(0.8, 1.3) }, { kind: 'lungs', col: hex(mix(hsl(350, 60, 75), g.body.rgb[3], 0.2)), size: r(0.8, 1.2) },
    { kind: 'stomach', col: hex(mix(hsl(15, 45, 70), g.belly.rgb[2], 0.3)), size: r(0.7, 1.2) }, { kind: 'gut', col: hex(mix(hsl(350, 45, 66), g.body.rgb[2], 0.15)), size: r(0.8, 1.4) }, { kind: 'gall', col: hex(hsl(95, 50, 38)), size: r(0.5, 1) }];
  const extra = { wisp: ['ember', g.glow.rgb[3]], lantern: ['ember', g.glow.rgb[3]], kodama: ['seed', hsl(30, 45, 40)], mochi: ['bean paste', hsl(350, 35, 28)], puff: ['soot', [30, 26, 34]], moth: ['pollen sac', hsl(50, 90, 65)], noodle: ['pearl', [240, 236, 250]], shell: ['nacre', hsl(190, 40, 85)], birdy: ['gizzard stones', hsl(30, 15, 60)], pup: ['silk gland', hsl(60, 30, 90)], guardian: ['acorn', hsl(30, 50, 45)], critter: g.tails > 1 ? ['star pearl', [250, 245, 255]] : ['spirit core', g.glow.rgb[3]] }[g.plan];
  if (extra) organs.push({ kind: extra[0], col: hex(extra[1]), size: r(0.6, 1.1), glow: spirit || extra[0] === 'spirit core' || extra[0] === 'star pearl' });
  return { hide: hex(g.body.rgb[2]), fur: hex(g.belly.rgb[3]), flesh: hex(flesh), blood: hex(blood), glow: spirit ? hex(g.glow.rgb[3]) : null, spirit, organs };
}
function palette(g) {
  const P = palFor(g);
  return { body: hex(g.body.rgb[2]), shade: hex(g.body.rgb[1]), dark: hex(g.body.rgb[0]), light: hex(g.body.rgb[3]), belly: hex(g.belly.rgb[3]), accent: hex(g.acc.rgb[2]), glow: hex(g.glow.rgb[3]), glowDeep: hex(g.glow.rgb[1]), eye: g.eye === 'glow' ? hex(g.glow.rgb[2]) : hex(g.pupil), outline: hex(g.outRGB), colors: P.rgb.map(hex) };
}

// ---------------------------------------------------------------- the creature
const GENOMES = new Map();
// spirit(seed, hue, size, tier, opts) → { frames: [idle a, idle b], walk: [4], attack: [wind-up, strike, recover], hurt, dead,
//   plan, hue, genome, name, species, element, floats, palette, anatomy, big }. Canvases face right, are size×size
//   with .pixel = true; `big` (160×160, smooth) and `anatomy` are built on first use.
export function spirit(seed, hue = 0, size = 24, tier = 0, opts = {}) {
  const key = `${seed}|${Math.round(hue)}|${tier}|${opts.plan || ''}|${opts.grit ?? ''}|${opts.dither ?? ''}|${opts.outline ?? ''}|${opts.head || ''}`;
  let g = GENOMES.get(key);
  if (!g) { g = genome(seed, hue, tier, opts); GENOMES.set(key, g); if (GENOMES.size > 300) GENOMES.delete(GENOMES.keys().next().value); }
  const S = Math.max(12, Math.round(size)), pad = g.tier >= 3 ? (S >= 32 ? 2 : 1) : 0, fit = fitFor(g, S, S, pad);
  const base = g.tier >= 3 ? { aura: pad, motes: g.tier - 1 } : g.tier === 2 ? { motes: 1 } : {}, fr = (pose, fx) => pixelFrame(g, pose, fit, fx);
  const flare = g.atk === 'flare';
  const out = { frames: [fr({}, { ...base, phase: 0 }), fr({ breath: 1 }, { ...base, phase: 1 })], plan: g.plan, hue: g.hue, genome: g, name: g.name, species: g.species, element: g.element, floats: g.loco === 'float', tier: g.tier, size: S, palette: palette(g) };
  // the other cycles, the portrait and the anatomy are built on first use (most games only show the idle pair)
  const lazy = (k, fn) => { let v; Object.defineProperty(out, k, { get: () => v || (v = fn()), enumerable: true }); };
  lazy('walk', () => [0, 0.25, 0.5, 0.75].map((t, i) => fr({ walk: 1, t }, { ...base, phase: i })));
  lazy('attack', () => [1, 2, 3].map((k) => fr({ atk: k }, flare ? { flare: k === 2 ? 1 : 0.5, aura: Math.max(pad, k === 2 ? 2 : 1), motes: k === 2 ? 3 : 1, phase: k } : { ...base, phase: k })));
  lazy('hurt', () => fr({ hurt: 1 }, {}));
  lazy('dead', () => fr({ dead: 1 }, { dissolve: g.die === 'fade', phase: 2 }));
  lazy('big', () => bigRender(g));
  lazy('anatomy', () => anatomy(g));
  return out;
}
