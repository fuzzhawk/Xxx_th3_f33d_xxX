// The garden's lands: palettes, families and biomes. The old garden's country has gone feral and
// weathered (pasture, tanglewood, downs, fen, old growth, withered acres, the drowned avenues, the
// greenwreck), and beyond it lie the wastes: the glass desert and its mesas, salt pans, oasis and
// ossuary; the rust belt's carcass yards, foundry and sour mire; the ash country's cinder wastes,
// the wound and the mycel gardens; the frostbite moor and the pylon steppe. Families share a palette
// and their cliffs, walls and water; biomes pick ground textures, props, decals, fauna, fog, motes.
import { makePal } from '../mk/tex.js';

export const PALS = {
  green: makePal(['#0b0d0a', '#151a12', '#1f2818', '#2b3820', '#384a28', '#4a5f30', '#5f763a', '#7a8f46', '#9aa85a', '#bcc07a', '#d8d49c', '#2a2520', '#3e352b', '#544638', '#6e5c47', '#8c765a', '#a8936f', '#3a3f44', '#555b5f', '#767c7c', '#9ca09a', '#1b3238', '#2c5156', '#4b7d78', '#c4a24a', '#e0d6b8', '#7a2e22', '#a8522e', '#c8783a']),
  rust: makePal(['#0c0907', '#17110c', '#231912', '#30221a', '#3f2c20', '#513726', '#66442c', '#7f5433', '#9b673c', '#b77d47', '#d29b5c', '#e8c07e', '#1d1d1a', '#2e2d28', '#43413a', '#5c5a50', '#7a776a', '#9d9886', '#3b3f1c', '#5a6224', '#83902e', '#b4c444', '#2a4440', '#3f6b5e', '#c6452a', '#efe2c0']),
  desert: makePal(['#120c08', '#22160e', '#352214', '#4a301c', '#613f24', '#7b512e', '#956539', '#ae7b45', '#c49456', '#d6ad6c', '#e5c689', '#f1dfb0', '#fbf3dc', '#3c2a2a', '#5a3a32', '#7e4a36', '#a35a3a', '#c8723e', '#2c3a44', '#466272', '#6f95a2', '#a9cbd0', '#2f3a1e', '#4d5f2c', '#7d8f3e', '#e8e4d4']),
  ash: makePal(['#08070a', '#110f14', '#1a171e', '#24202a', '#2f2a36', '#3c3644', '#4b4453', '#5d5564', '#726978', '#8b8290', '#a69ca8', '#c4bac2', '#e2dade', '#2a1414', '#4a1c16', '#7a2a18', '#b2441c', '#e2722a', '#ffb040', '#ffe08a', '#1c2a2e', '#2c4a4e', '#3e7a70', '#6ac8a0', '#5a2a5e', '#9a4aa0']),
  frost: makePal(['#0a0c10', '#141a22', '#1e2732', '#2a3644', '#384858', '#4c5e70', '#64788a', '#8296a6', '#a4b6c2', '#c8d6dc', '#e6eef0', '#f8fbfc', '#2a2420', '#3e352c', '#55493c', '#6e604e', '#3a4a3a', '#52664e', '#6e8466', '#8a3a2a', '#c8a060', '#24303a', '#ffcf7a']),
  neon: makePal(['#06040a', '#0c0814', '#140c20', '#1c122e', '#26183c', '#321f4c', '#40285e', '#503372', '#1a0e14', '#3a1424', '#601a3a', '#922458', '#d0367c', '#ff5ab0', '#0a2430', '#0e3e52', '#14607a', '#1e92aa', '#44d0e0', '#a8f4ff', '#ffd36e', '#e8e0f0', '#6a5a7a', '#968aa6', '#3a3a42', '#5a5a62', '#7a7a80'])
};

// the colours props are painted in, per family (merged over BASE)
const BASE = {
  leaf: ['#2f4a22', '#3e5e2a', '#557a34', '#6e8f3e'], bark: ['#4a3626', '#5e4430', '#3a2a1e'], stone: ['#6a6e6a', '#82847c', '#5a5e5a'], metal: ['#5a5e60', '#707474', '#4a4e50'],
  rust: ['#7a4a2a', '#8a5a32', '#6a3e24'], concrete: ['#7a7a74', '#8a8a80', '#6a6a64'], bone: ['#d8d0b8', '#b8b098'], glow: ['#e0d070', '#a8f070'], vine: ['#3e6a2a', '#5a8a34'],
  flower: ['#c4a24a', '#a8522e', '#e0d6b8', '#7a2e22'], litter: ['#6a5a2a', '#7a6a34', '#5a4a24'], puddle: '#2c4a50', cloth: ['#6a5a3a', '#5a3a2a', '#3a4a5a', '#7a2e22'], sign: ['#a8522e', '#c4a24a', '#4b7d78', '#e0d6b8'],
  lane: '#c4a24a', char: ['#1f1a16', '#2a2520'], fungStem: '#c8c0a0', fungCap: ['#a8522e', '#c4a24a'], cactus: ['#4d5f2c', '#7d8f3e', '#e8e4d4'], moss: ['#4a5f30', '#5f763a'], crystal: ['#4b7d78', '#9ca09a'],
  berry: ['#7a2e22'], plank: ['#544638', '#6e5c47', '#3e352b', '#8c765a'], roof: ['#3e352b', '#555b5f', '#6e5c47', '#7a2e22'], tarp: ['#3a4a5a', '#6a5a3a', '#7a2e22', '#4b7d78'], snow: ['#e0d6b8', '#9ca09a'], window: '#c8783a'
};
export const FAMILY = {
  green: { pal: PALS.green, col: {},
    tex: { floor: ['floor', ['#6a6a64', '#7a7a74', '#555b5f', '#3e352b']], cliffTop: ['cliffTop', ['#4a5f30', '#384a28', '#5f763a', '#7a8f46']], cliffFace: ['cliffFace', ['#544638', '#3e352b', '#6e5c47']],
      wallTop: ['wallTop', ['#767c7c', '#9ca09a', '#555b5f', '#5f763a']], wallFace: ['wallFace', ['#6e5c47', '#555b5f', '#3a3f44', '#2b3820']], water: ['water', ['#1b3238', '#2c5156', '#9ca09a']], toxic: ['toxic', ['#384a28', '#7a8f46', '#bcc07a']], bridge: ['bridge', ['#6e5c47', '#8c765a', '#3e352b']] } },
  rust: { pal: PALS.rust, col: { leaf: ['#3b3f1c', '#5a6224', '#83902e'], bark: ['#3f2c20', '#513726'], stone: ['#5c5a50', '#7a776a', '#43413a'], flower: ['#b4c444', '#d29b5c'], litter: ['#66442c', '#7f5433'], puddle: '#2a4440', sign: ['#c6452a', '#d29b5c', '#3f6b5e', '#efe2c0'], cloth: ['#5c5a50', '#66442c', '#c6452a'], plank: ['#513726', '#66442c', '#3f2c20', '#7f5433'], roof: ['#5c5a50', '#7f5433', '#43413a', '#9b673c'], tarp: ['#3f6b5e', '#66442c', '#c6452a'], window: '#d29b5c' },
    tex: { floor: ['concrete', ['#5c5a50', '#7a776a', '#43413a']], cliffTop: ['cliffTop', ['#66442c', '#513726', '#7f5433', '#83902e']], cliffFace: ['cliffFace', ['#3f2c20', '#30221a', '#513726']],
      wallTop: ['wallTop', ['#5c5a50', '#7a776a', '#43413a', '#66442c']], wallFace: ['metalWall', ['#43413a', '#5c5a50', '#2e2d28', '#9b673c']], water: ['water', ['#1d1d1a', '#2a4440', '#5c5a50']], toxic: ['toxic', ['#3b3f1c', '#5a6224', '#83902e']], bridge: ['bridge', ['#5c5a50', '#7a776a', '#2e2d28']] } },
  desert: { pal: PALS.desert, col: { leaf: ['#2f3a1e', '#4d5f2c', '#7d8f3e'], bark: ['#613f24', '#7b512e'], stone: ['#a35a3a', '#c8723e', '#7e4a36'], metal: ['#466272', '#6f95a2'], rust: ['#a35a3a', '#7e4a36', '#c8723e'], concrete: ['#c49456', '#d6ad6c', '#ae7b45'],
      vine: null, moss: null, flower: ['#c8723e', '#e5c689'], litter: ['#ae7b45', '#956539'], puddle: '#466272', cloth: ['#a35a3a', '#e5c689', '#466272'], crystal: ['#a9cbd0', '#fbf3dc'], plank: ['#7b512e', '#956539', '#613f24'], roof: ['#956539', '#7e4a36', '#ae7b45'], tarp: ['#a35a3a', '#466272', '#e5c689'], window: '#e5c689' },
    tex: { floor: ['floor', ['#ae7b45', '#956539', '#c49456', '#613f24']], cliffTop: ['redrock', ['#a35a3a', '#7e4a36', '#c8723e']], cliffFace: ['cliffFace', ['#7e4a36', '#5a3a32', '#a35a3a']],
      wallTop: ['wallTop', ['#c49456', '#d6ad6c', '#956539', '#7b512e']], wallFace: ['wallFace', ['#956539', '#ae7b45', '#7b512e', '#613f24']], water: ['water', ['#2c3a44', '#466272', '#a9cbd0']], toxic: ['toxic', ['#2c3a44', '#6f95a2', '#a9cbd0']], bridge: ['bridge', ['#7b512e', '#956539', '#4a301c']] } },
  ash: { pal: PALS.ash, col: { leaf: ['#2c4a4e', '#3e7a70', '#5a2a5e'], bark: ['#24202a', '#2f2a36'], stone: ['#4b4453', '#5d5564', '#3c3644'], metal: ['#4b4453', '#5d5564'], rust: ['#4a1c16', '#7a2a18'], concrete: ['#5d5564', '#726978', '#4b4453'],
      glow: ['#ffb040', '#ff7a2a', '#6ac8a0'], vine: null, moss: null, flower: ['#9a4aa0', '#6ac8a0'], litter: ['#3c3644', '#2f2a36'], puddle: '#24202a', char: ['#110f14', '#1a171e'], fungStem: '#a69ca8', fungCap: ['#5a2a5e', '#9a4aa0', '#3e7a70'],
      crystal: ['#6ac8a0', '#9a4aa0', '#c4bac2'], sign: ['#b2441c', '#9a4aa0', '#3e7a70', '#c4bac2'], cloth: ['#4b4453', '#4a1c16'], lane: '#8b8290', plank: ['#3c3644', '#4b4453', '#2f2a36'], roof: ['#4b4453', '#3c3644', '#7a2a18'], tarp: ['#4a1c16', '#3e7a70'], window: '#ffb040' },
    tex: { floor: ['floor', ['#4b4453', '#5d5564', '#3c3644', '#2a1414']], cliffTop: ['cliffTop', ['#3c3644', '#2f2a36', '#4b4453', '#5d5564']], cliffFace: ['cliffFace', ['#24202a', '#1a171e', '#2f2a36']],
      wallTop: ['wallTop', ['#5d5564', '#726978', '#4b4453', '#3c3644']], wallFace: ['wallFace', ['#3c3644', '#4b4453', '#2f2a36', '#7a2a18']], water: ['water', ['#110f14', '#24202a', '#5d5564']], toxic: ['toxic', ['#4a1c16', '#b2441c', '#ffb040']], bridge: ['bridge', ['#3c3644', '#4b4453', '#1a171e']] } },
  frost: { pal: PALS.frost, col: { leaf: ['#2a3644', '#384858', '#3a4a3a', '#52664e'], bark: ['#3e352c', '#55493c', '#2a2420'], stone: ['#64788a', '#8296a6', '#4c5e70'], metal: ['#4c5e70', '#64788a'], rust: ['#8a3a2a', '#6e604e'], concrete: ['#8296a6', '#a4b6c2', '#64788a'],
      vine: null, moss: null, flower: ['#c8d6dc', '#8a3a2a'], litter: ['#55493c', '#6e604e'], puddle: '#24303a', cloth: ['#8a3a2a', '#3e352c', '#4c5e70'], plank: ['#55493c', '#6e604e', '#3e352c'], roof: ['#c8d6dc', '#e6eef0', '#a4b6c2'], tarp: ['#8a3a2a', '#4c5e70'], snow: ['#e6eef0', '#c8d6dc', '#f8fbfc'], window: '#ffcf7a', glow: ['#ffcf7a', '#c8a060'] },
    tex: { floor: ['floor', ['#64788a', '#8296a6', '#4c5e70', '#3e352c']], cliffTop: ['snow', ['#e6eef0', '#c8d6dc', '#f8fbfc', '#a4b6c2']], cliffFace: ['cliffFace', ['#4c5e70', '#384858', '#64788a']],
      wallTop: ['wallTop', ['#a4b6c2', '#c8d6dc', '#8296a6', '#64788a']], wallFace: ['wallFace', ['#55493c', '#6e604e', '#3e352c', '#2a2420']], water: ['ice', ['#8296a6', '#a4b6c2', '#e6eef0']], toxic: ['toxic', ['#2a3644', '#4c5e70', '#8296a6']], bridge: ['bridge', ['#55493c', '#6e604e', '#2a2420']] } }
};
for (const F of Object.values(FAMILY)) { F.col = { ...BASE, ...F.col }; for (const k in F.col) if (F.col[k] === null) F.col[k] = k === 'vine' || k === 'moss' ? null : BASE[k]; }

// the biomes. g / g2 = two ground textures mixed by noise, path = the trodden ground; props and decals
// are [type, density per tile]; fauna = the animals met there; fog = [colour, thickness]; motes = drift
export const BIOMES = {
  // the old garden's lands, gone feral
  pasture: { name: 'Old Pasture', fam: 'green', g: ['flowers', ['#4a5f30', '#5f763a', '#7a8f46', '#c4a24a', '#a8522e']], g2: ['grass', ['#5f763a', '#4a5f30', '#7a8f46', '#9aa85a']], mix: 0.5, path: ['dirt', ['#6e5c47', '#544638', '#8c765a']],
    props: [['rock', 0.008], ['tree', 0.012], ['bush', 0.025], ['fence', 0.006], ['scarecrow', 0.0015], ['stones', 0.0015]], decals: [['flowers', 0.12], ['tuft', 0.2], ['stones', 0.04]], fauna: ['cattle', 'horse', 'crow', 'hound'], fog: ['#b8c0a0', 0.1], motes: 'pollen' },
  tanglewood: { name: 'Tanglewood', fam: 'green', g: ['grass', ['#3e5e2a', '#2f4a22', '#557a34', '#6e8f3e']], g2: ['litter', ['#4a3a24', '#6a5a2a', '#7a6a34', '#3e5e2a']], mix: 0.55, path: ['dirt', ['#5e4a34', '#4a3626', '#6e5c47']],
    props: [['tree', 0.1], ['pine', 0.04], ['bush', 0.05], ['rock', 0.012], ['deadtree', 0.012]], decals: [['tuft', 0.25], ['leaves', 0.15]], fauna: ['deer', 'boar', 'crow', 'hound'], fog: ['#8aa080', 0.16], motes: 'leaves' },
  downs: { name: 'Bleak Downs', fam: 'green', g: ['grass', ['#7a8f46', '#5f763a', '#9aa85a', '#bcc07a']], g2: ['gravel', ['#767c7c', '#555b5f', '#9ca09a', '#5f763a']], mix: 0.62, path: ['dirt', ['#6e5c47', '#544638', '#8c765a']],
    struct: 'ridges', props: [['stones', 0.004], ['bush', 0.02], ['rock', 0.02], ['pylon', 0.0015], ['deadtree', 0.006]], decals: [['tuft', 0.25], ['stones', 0.06]], fauna: ['goat', 'crow', 'horse'], fog: ['#a8b0a8', 0.16], motes: 'haze' },
  fen: { name: 'Lotus Fen', fam: 'green', g: ['mud', ['#3e352b', '#2a2520', '#544638', '#4a5f30']], g2: ['grass', ['#384a28', '#2b3820', '#4a5f30', '#5f763a']], mix: 0.5, water: 'water', waterAmt: 0.42, path: ['dirt', ['#544638', '#3e352b', '#6e5c47']],
    props: [['reeds', 0.1], ['deadtree', 0.03], ['fungus', 0.012], ['bush', 0.03], ['willow', 0.01]], decals: [['puddle', 0.05], ['tuft', 0.2], ['glowmoss', 0.03]], fauna: ['heron', 'crow', 'rat'], fog: ['#7a9890', 0.26], motes: 'fireflies' },
  oldgrowth: { name: 'The Old Growth', fam: 'green', g: ['moss', ['#384a28', '#4a5f30', '#5f763a', '#7a8f46']], g2: ['litter', ['#3e352b', '#544638', '#6e5c47', '#4a5f30']], mix: 0.5, path: ['dirt', ['#3e352b', '#2a2520', '#544638']],
    props: [['bigtree', 0.011], ['tree', 0.03], ['fern', 0.06], ['fungus', 0.01], ['rock', 0.01], ['stones', 0.0008]], decals: [['leaves', 0.2], ['glowmoss', 0.04], ['tuft', 0.1]], fauna: ['deer', 'boar', 'moth'], fog: ['#6a8070', 0.28], motes: 'spores' },
  withered: { name: 'Withered Acres', fam: 'rust', g: ['grass', ['#7f5433', '#66442c', '#9b673c', '#b77d47']], g2: ['dirt', ['#513726', '#3f2c20', '#66442c']], mix: 0.55, path: ['dirt', ['#3f2c20', '#30221a', '#513726']],
    props: [['deadtree', 0.03], ['rock', 0.015], ['lamp', 0.003], ['billboard', 0.002], ['scarecrow', 0.002], ['fence', 0.006], ['pylon', 0.001]], decals: [['tuft', 0.2], ['bones', 0.02], ['stones', 0.06]], fauna: ['crow', 'hound', 'cattle'], fog: ['#c09060', 0.1], motes: 'dust' },
  drowned: { name: 'Drowned Avenues', fam: 'green', g: ['asphalt', ['#4a4e50', '#3a3f44', '#5a5e5f', '#1f2818', '#5f763a']], g2: ['grass', ['#4a5f30', '#384a28', '#5f763a', '#7a8f46']], mix: 0.6, water: 'water', waterAmt: 0.3, path: ['asphalt', ['#3a3f44', '#2b2f32', '#555b5f', '#1f2818']],
    struct: 'ruins', props: [['wreck', 0.016], ['pillar', 0.012], ['lamp', 0.008], ['tree', 0.02], ['bush', 0.03], ['billboard', 0.003], ['tower', 0.004]], decals: [['crack', 0.15], ['rubble', 0.08], ['tuft', 0.12], ['oil', 0.02]], fauna: ['rat', 'crow', 'heron'], fog: ['#90989a', 0.18], motes: 'drips' },
  greenwreck: { name: 'The Greenwreck', fam: 'green', g: ['grass', ['#2b3820', '#384a28', '#4a5f30', '#5f763a']], g2: ['litter', ['#384a28', '#2b3820', '#3e352b', '#4a5f30']], mix: 0.5, path: ['dirt', ['#3e352b', '#2a2520', '#544638']],
    struct: 'ruins', props: [['palm', 0.05], ['tree', 0.06], ['fern', 0.06], ['pillar', 0.012], ['wreck', 0.006], ['bush', 0.05]], decals: [['leaves', 0.2], ['tuft', 0.2], ['rubble', 0.04]], fauna: ['boar', 'crow', 'moth'], fog: ['#6a8a6a', 0.22], motes: 'spores' },
  // the glass desert
  dunes: { name: 'The Sea of Glass', fam: 'desert', g: ['sand', ['#d6ad6c', '#e5c689', '#c49456', '#ae7b45']], g2: ['sand', ['#c49456', '#d6ad6c', '#ae7b45', '#956539']], mix: 0.55, path: ['gravel', ['#ae7b45', '#956539', '#c49456']],
    props: [['cactus', 0.01], ['rock', 0.008], ['ribs', 0.0015], ['wreck', 0.002]], decals: [['bones', 0.02], ['stones', 0.03]], fauna: ['lizard', 'crow', 'beetle'], fog: ['#e5c689', 0.16], motes: 'sand' },
  mesa: { name: 'Redwall Mesas', fam: 'desert', g: ['redrock', ['#a35a3a', '#7e4a36', '#c8723e']], g2: ['sand', ['#c8723e', '#d6ad6c', '#a35a3a', '#956539']], mix: 0.5, path: ['gravel', ['#7e4a36', '#5a3a32', '#a35a3a']],
    struct: 'mesa', props: [['boulder', 0.025], ['cactus', 0.02], ['rock', 0.02]], decals: [['stones', 0.08]], fauna: ['lizard', 'goat', 'crow'], fog: ['#c8723e', 0.1], motes: 'sand' },
  saltflat: { name: 'Bleach Pans', fam: 'desert', g: ['salt', ['#f1dfb0', '#c49456', '#fbf3dc']], g2: ['salt', ['#e5c689', '#ae7b45', '#f1dfb0']], mix: 0.6, path: ['gravel', ['#d6ad6c', '#c49456', '#ae7b45']],
    props: [['crystal', 0.006], ['rock', 0.004], ['wreck', 0.002]], decals: [['skull', 0.01], ['crack', 0.06]], fauna: ['beetle', 'crow'], fog: ['#fbf3dc', 0.2], motes: 'haze' },
  oasis: { name: 'Sweetwater', fam: 'desert', g: ['grass', ['#4d5f2c', '#2f3a1e', '#7d8f3e', '#a9cbd0']], g2: ['sand', ['#d6ad6c', '#c49456', '#e5c689', '#ae7b45']], mix: 0.45, water: 'water', waterAmt: 0.34, path: ['dirt', ['#956539', '#7b512e', '#ae7b45']],
    props: [['palm', 0.07], ['reeds', 0.06], ['bush', 0.03]], decals: [['tuft', 0.2], ['flowers', 0.04]], fauna: ['heron', 'goat', 'lizard'], fog: ['#a9cbd0', 0.1], motes: 'pollen' },
  ossuary: { name: 'The Ossuary Flats', fam: 'desert', g: ['sand', ['#c49456', '#ae7b45', '#d6ad6c', '#956539']], g2: ['gravel', ['#e8e4d4', '#c49456', '#fbf3dc']], mix: 0.7, path: ['gravel', ['#956539', '#7b512e', '#ae7b45']],
    props: [['ribs', 0.012], ['totem', 0.008], ['rock', 0.01]], decals: [['bones', 0.12], ['skull', 0.05]], fauna: ['crow', 'hound', 'beetle'], fog: ['#e8e4d4', 0.12], motes: 'sand' },
  // the rust belt
  carcass: { name: 'Carcass Yards', fam: 'rust', g: ['oil', ['#40291a', '#17110c', '#513726', '#66442c']], g2: ['gravel', ['#43413a', '#5c5a50', '#2e2d28', '#7a776a']], mix: 0.5, path: ['dirt', ['#513726', '#3f2c20', '#66442c']],
    props: [['scrap', 0.06], ['wreck', 0.04], ['tank', 0.007], ['lamp', 0.005], ['bus', 0.004]], decals: [['oil', 0.05], ['stones', 0.08], ['rubble', 0.06]], fauna: ['rat', 'hound', 'crow'], fog: ['#9b7a5a', 0.14], motes: 'dust' },
  foundry: { name: 'Foundry Nine', fam: 'rust', g: ['concrete', ['#5c5a50', '#43413a', '#7a776a']], g2: ['oil', ['#43413a', '#1d1d1a', '#5c5a50', '#2e2d28']], mix: 0.6, path: ['asphalt', ['#2e2d28', '#1d1d1a', '#43413a', '#17110c']],
    struct: 'factory', props: [['tank', 0.022], ['pipes', 0.026], ['scrap', 0.02], ['chimney', 0.004]], decals: [['oil', 0.06], ['crack', 0.1]], fauna: ['rat', 'crow'], fog: ['#5c5a50', 0.22], motes: 'embers' },
  sourmire: { name: 'Sour Mire', fam: 'rust', g: ['mud', ['#2e2d28', '#1d1d1a', '#3b3f1c', '#5a6224']], g2: ['moss', ['#3b3f1c', '#5a6224', '#83902e', '#b4c444']], mix: 0.45, water: 'toxic', waterAmt: 0.38, path: ['gravel', ['#43413a', '#2e2d28', '#5c5a50']],
    props: [['deadtree', 0.05], ['reeds', 0.05], ['fungus', 0.01], ['drum', 0.01]], decals: [['glowmoss', 0.05], ['puddle', 0.04]], fauna: ['rat', 'heron', 'moth'], fog: ['#83902e', 0.26], motes: 'spores' },
  pylons: { name: 'The Pylon Steppe', fam: 'rust', g: ['grass', ['#9b673c', '#b77d47', '#7f5433', '#d29b5c']], g2: ['gravel', ['#5c5a50', '#7a776a', '#43413a', '#9b673c']], mix: 0.6, path: ['gravel', ['#43413a', '#5c5a50', '#2e2d28']],
    props: [['pylon', 0.006], ['rock', 0.012], ['deadtree', 0.008], ['wreck', 0.003], ['bush', 0.01]], decals: [['tuft', 0.18], ['stones', 0.05]], fauna: ['horse', 'crow', 'hound'], fog: ['#c09a6a', 0.12], motes: 'dust' },
  // the ash country
  cinder: { name: 'Cinder Wastes', fam: 'ash', g: ['ash', ['#4b4453', '#3c3644', '#5d5564', '#e2722a']], g2: ['ash', ['#5d5564', '#4b4453', '#726978', '#ffb040']], mix: 0.5, path: ['gravel', ['#3c3644', '#2f2a36', '#4b4453']],
    props: [['burnt', 0.05], ['rock', 0.02], ['scrap', 0.004]], decals: [['stones', 0.06], ['crack', 0.08]], fauna: ['crow', 'beetle', 'hound'], fog: ['#8b8290', 0.22], motes: 'ash' },
  wound: { name: 'The Wound', fam: 'ash', g: ['glass', ['#1a171e', '#3c3644', '#e2722a', '#ffb040']], g2: ['ash', ['#2f2a36', '#1a171e', '#3c3644', '#ffb040']], mix: 0.5, water: 'toxic', waterAmt: 0.2, path: ['gravel', ['#2f2a36', '#24202a', '#3c3644']],
    struct: 'crater', props: [['crystal', 0.04], ['boulder', 0.014]], decals: [['glowmoss', 0.04], ['crack', 0.1]], fauna: ['beetle', 'moth'], fog: ['#b2441c', 0.18], motes: 'embers' },
  mycel: { name: 'Mycel Gardens', fam: 'ash', g: ['moss', ['#1c2a2e', '#2c4a4e', '#3e7a70', '#6ac8a0']], g2: ['ash', ['#24202a', '#1a171e', '#2f2a36', '#6ac8a0']], mix: 0.5, path: ['dirt', ['#2f2a36', '#24202a', '#3c3644']],
    props: [['fungus', 0.09], ['bigshroom', 0.012], ['bush', 0.03], ['burnt', 0.01]], decals: [['glowmoss', 0.15]], fauna: ['moth', 'beetle', 'rat'], fog: ['#7a4a80', 0.2], motes: 'spores' },
  crown: { name: 'Crown Boulevard', fam: 'ash', g: ['asphalt', ['#2f2a36', '#24202a', '#3c3644', '#1a171e']], g2: ['ash', ['#3c3644', '#2f2a36', '#4b4453', '#e2722a']], mix: 0.6, path: ['asphalt', ['#24202a', '#1a171e', '#3c3644', '#110f14']],
    struct: 'city', props: [['wreck', 0.012], ['lamp', 0.006], ['billboard', 0.003], ['burnt', 0.004], ['bus', 0.002]], decals: [['rubble', 0.12], ['crack', 0.12], ['oil', 0.03]], fauna: ['rat', 'crow', 'hound'], fog: ['#5d5564', 0.18], motes: 'ash' },
  // the frost
  moor: { name: 'Frostbite Moor', fam: 'frost', g: ['snow', ['#c8d6dc', '#e6eef0', '#a4b6c2', '#8296a6']], g2: ['grass', ['#52664e', '#3a4a3a', '#6e8466', '#8296a6']], mix: 0.55, path: ['gravel', ['#64788a', '#4c5e70', '#8296a6']],
    struct: 'ridges', props: [['snowpine', 0.05], ['deadtree', 0.01], ['rock', 0.015], ['stones', 0.002], ['pylon', 0.001]], decals: [['stones', 0.04], ['tuft', 0.08]], fauna: ['deer', 'hound', 'crow'], fog: ['#c8d6dc', 0.22], motes: 'snow' },
  taiga: { name: 'Black Taiga', fam: 'frost', g: ['snow', ['#a4b6c2', '#c8d6dc', '#8296a6', '#e6eef0']], g2: ['litter', ['#3a4a3a', '#2a3644', '#52664e', '#55493c']], mix: 0.5, path: ['gravel', ['#4c5e70', '#384858', '#64788a']],
    props: [['snowpine', 0.14], ['pine', 0.04], ['rock', 0.01], ['deadtree', 0.01]], decals: [['stones', 0.04]], fauna: ['deer', 'boar', 'crow'], fog: ['#a4b6c2', 0.26], motes: 'snow' }
};
export const BIOME_KEYS = Object.keys(BIOMES);
BIOME_KEYS.forEach((k, i) => { BIOMES[k].key = k; BIOMES[k].i = i; });
// where each family lives on the map: [x0, y0, x1, y1] as fractions, and how many sites per biome
export const REGION = { green: [0.03, 0.18, 0.5, 0.97], frost: [0.05, 0.02, 0.75, 0.2], rust: [0.42, 0.12, 0.78, 0.6], desert: [0.4, 0.62, 0.97, 0.97], ash: [0.72, 0.12, 0.98, 0.7] };
// the floating islands' kinds: their ground, props and what has been left on them
export const ISLES = {
  moor: { name: 'Windward Isle', fam: 'green', g: ['grass', ['#5f763a', '#4a5f30', '#7a8f46', '#9aa85a']], g2: ['gravel', ['#767c7c', '#555b5f', '#9ca09a', '#5f763a']], path: ['dirt', ['#6e5c47', '#544638', '#8c765a']], props: [['stones', 0.02], ['bush', 0.05], ['rock', 0.04], ['deadtree', 0.02]], land: 'observatory' },
  orchard: { name: 'Hanging Orchard', fam: 'green', g: ['flowers', ['#4a5f30', '#5f763a', '#7a8f46', '#c4a24a', '#a8522e']], g2: ['grass', ['#384a28', '#2b3820', '#4a5f30', '#5f763a']], path: ['dirt', ['#544638', '#3e352b', '#6e5c47']], props: [['tree', 0.1], ['bush', 0.05], ['fern', 0.04]], land: 'greenhouse' },
  wreck: { name: 'The Last Airship', fam: 'rust', g: ['gravel', ['#43413a', '#5c5a50', '#2e2d28', '#7a776a']], g2: ['grass', ['#7f5433', '#66442c', '#9b673c', '#b77d47']], path: ['dirt', ['#513726', '#3f2c20', '#66442c']], props: [['scrap', 0.06], ['deadtree', 0.02], ['rock', 0.03]], land: 'airship' },
  shrine: { name: 'The Quiet Spire', fam: 'ash', g: ['moss', ['#1c2a2e', '#2c4a4e', '#3e7a70', '#6ac8a0']], g2: ['ash', ['#3c3644', '#2f2a36', '#4b4453', '#6ac8a0']], path: ['gravel', ['#3c3644', '#2f2a36', '#4b4453']], props: [['crystal', 0.04], ['fungus', 0.04], ['burnt', 0.02]], land: 'shrine' },
  snow: { name: 'The Pale Shelf', fam: 'frost', g: ['snow', ['#c8d6dc', '#e6eef0', '#a4b6c2', '#8296a6']], g2: ['gravel', ['#64788a', '#4c5e70', '#8296a6', '#a4b6c2']], path: ['gravel', ['#64788a', '#4c5e70', '#8296a6']], props: [['snowpine', 0.08], ['rock', 0.04], ['stones', 0.01]], land: 'radiomast' }
};
