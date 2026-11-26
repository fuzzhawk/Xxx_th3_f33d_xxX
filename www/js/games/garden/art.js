// Everything the garden paints, through the Makhana texture engine (tex.js): ground tiles (64×64,
// tileable), the props (trees, rocks, ruins, wrecks, pylons, village houses, landmarks), city
// facades and roofs, the animals (side-on, a short walk cycle each), the giant gardeners and the
// sky. All of it lit from a painted height buffer, then crushed and dithered into a family palette.
import { TB, RNG, mk, hex, shade, shadeHex, mixHex, clamp, fbm, bay, qIdx, flipH, cx2d } from '../mk/tex.js';
import { PALS, FAMILY } from './lands.js';

// ------------------------------------------------ ground (64×64 tileable)
export function groundTex(kind, cs, P, seed) {
  const t = new TB(64, 64, 4, seed), r = t.r;
  t.fill(cs[0], 0);
  switch (kind) {
    case 'grass': t.grain(0.45, 16, seed, 0.4, 64); t.speck(60, [cs[1], cs[2]], 1.5, 4, 0.3, true); t.speck(420, [cs[1], cs[2], cs[3] || cs[2]], 0.35, 0.9, 0.8, true, 'blade'); break;
    case 'flowers': t.grain(0.4, 16, seed, 0.4, 64); t.speck(300, [cs[1], cs[2]], 0.35, 0.8, 0.7, true, 'blade'); t.speck(22, [cs[3], cs[4] || cs[3]], 0.5, 0.9, 0.6, true); break;
    case 'dirt': t.grain(0.5, 16, seed, 0.6, 64); t.speck(40, [cs[1], cs[2]], 1.2, 3.2, 0.2, true); t.speck(90, [cs[2], cs[3] || cs[1]], 0.3, 0.7, 0.6, true); t.speck(6, [cs[1]], 2, 3, 0.5, true, 'crack'); break;
    case 'litter': t.grain(0.5, 16, seed, 0.5, 64); t.speck(140, [cs[1], cs[2], cs[3]], 0.5, 1.3, 0.4, true); t.speck(80, [cs[2]], 0.3, 0.8, 0.6, true, 'blade'); break;
    case 'asphalt': t.grain(0.32, 8, seed, 0.25, 64); t.speck(160, [cs[1], cs[2]], 0.25, 0.6, 0.3, true); t.speck(9, [cs[3] || cs[1]], 2.5, 4, 0.6, true, 'crack'); if (cs[4]) t.speck(40, [cs[4]], 0.4, 0.9, 0.5, true, 'blade'); break;
    case 'concrete': t.grain(0.28, 16, seed, 0.25, 64); for (let i = 0; i < 64; i += 16) { t.rect(i, 0, 0.5, 64, cs[1], -0.5); t.rect(0, i, 64, 0.5, cs[1], -0.5); } t.speck(14, [cs[2]], 2, 3, 0.5, true, 'crack'); t.speck(20, [cs[3] || cs[2]], 2, 5, 0.05, true); break;
    case 'sand': t.grain(0.22, 16, seed, 0.2, 64); for (let y = 0; y < 64; y += 5) { const ph = r.range(0, 6.28), a = r.range(1, 2.5); for (let x = 0; x < 64; x += 0.5) { const yy = y + Math.sin((x / 64) * 6.2832 * 2 + ph) * a; t.ell(x, yy, 0.6, 0.45, cs[1], 0.6); t.ell(x, yy + 1, 0.6, 0.45, cs[2], -0.2); } } t.speck(40, [cs[2], cs[3] || cs[1]], 0.3, 0.6, 0.2, true); break;
    case 'redrock': t.grain(0.5, 16, seed, 1.2, 64); t.speck(30, [cs[1], cs[2]], 2, 5, 0.6, true); t.speck(10, [cs[2]], 2, 3.5, 0.8, true, 'crack'); break;
    case 'salt': t.grain(0.18, 16, seed, 0.15, 64); for (let i = 0; i < 22; i++) { let px = r.range(0, 64), py = r.range(0, 64), a = r.range(0, 6.28); for (let k = 0; k < 4; k++) { const nx = px + Math.cos(a) * 5, ny = py + Math.sin(a) * 5; for (const [ox, oy] of [[0, 0], [64, 0], [-64, 0], [0, 64], [0, -64]]) t.line(px + ox, py + oy, nx + ox, ny + oy, 0.55, cs[1], -0.6); px = nx; py = ny; a += r.range(-1.2, 1.2); } } t.speck(30, [cs[2]], 0.3, 0.7, 0.4, true); break;
    case 'mud': t.grain(0.5, 16, seed, 0.6, 64); t.speck(30, [cs[1]], 2, 5, -0.3, true); t.speck(40, [cs[2]], 0.4, 1, 0.2, true); t.speck(100, [cs[3] || cs[2]], 0.3, 0.7, 0.6, true, 'blade'); break;
    case 'ash': t.grain(0.45, 16, seed, 0.4, 64); t.speck(120, [cs[1], cs[2]], 0.3, 0.9, 0.3, true); t.speck(8, [cs[3]], 0.3, 0.5, 0.1, true); t.speck(8, [cs[1]], 2, 4, 0.4, true, 'crack'); break;
    case 'glass': t.grain(0.3, 8, seed, 0.6, 64); t.speck(18, [cs[1]], 2, 5, 1.2, true); t.speck(16, [cs[2]], 2, 4, 0.6, true, 'crack'); t.speck(10, [cs[3]], 0.4, 0.8, 0.2, true); break;
    case 'moss': t.grain(0.5, 16, seed, 0.5, 64); t.speck(80, [cs[1], cs[2]], 0.8, 2, 0.5, true); t.speck(16, [cs[3]], 0.3, 0.6, 0.2, true); break;
    case 'gravel': t.grain(0.35, 16, seed, 0.3, 64); t.speck(260, [cs[1], cs[2], cs[3] || cs[1]], 0.35, 0.9, 0.6, true); break;
    case 'oil': t.grain(0.45, 16, seed, 0.4, 64); t.speck(14, [cs[1]], 3, 7, -0.1, true); t.speck(120, [cs[2], cs[3] || cs[2]], 0.3, 0.8, 0.4, true); break;
    case 'snow': t.grain(0.16, 16, seed, 0.5, 64); t.speck(50, [cs[1], cs[2]], 1.5, 4, 0.6, true); t.speck(60, [cs[3] || cs[1]], 0.3, 0.7, 0.3, true); t.speck(4, [cs[3] || cs[1]], 2, 4, 0.3, true, 'crack'); break;
    case 'floor': t.grain(0.25, 16, seed, 0.2, 64); for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) { const c = r.chance(0.2) ? cs[2] : r.chance(0.5) ? cs[0] : cs[1]; t.rect(x + 0.3, y + 0.3, 7.4, 7.4, c, 0.6, 0.8); } t.speck(8, [cs[3] || cs[2]], 2, 3, 0.6, true, 'crack'); break;
    case 'water': t.grain(0.18, 16, seed, 0, 64); for (let y = 2; y < 64; y += 6) { const ph = r.range(0, 6.28); for (let x = 0; x < 64; x += 0.5) t.ell(x, y + Math.sin((x / 64) * 6.2832 * 3 + ph) * 1.2, 0.5, 0.35, cs[1]); } t.speck(20, [cs[2]], 0.3, 0.6, 0, true); return t.finish(P, { light: false, dither: 0.6 });
    case 'ice': t.grain(0.14, 16, seed, 0.2, 64); t.speck(26, [cs[1]], 2, 6, 0.4, true, 'crack'); t.speck(30, [cs[2]], 0.3, 1, 0.2, true); return t.finish(P, { dither: 0.5, amb: 0.6, dif: 0.5 });
    case 'toxic': t.grain(0.3, 16, seed, 0, 64); t.speck(40, [cs[1]], 1, 3, 0, true); t.speck(30, [cs[2]], 0.3, 0.8, 0, true); return t.finish(P, { light: false, dither: 0.7 });
    case 'cliffTop': t.grain(0.5, 16, seed, 1.2, 64); t.speck(24, [cs[1], cs[2]], 2, 6, 0.8, true); t.speck(40, [cs[3] || cs[1]], 0.4, 1, 0.4, true, 'blade'); break;
    case 'cliffFace': t.grain(0.35, 8, seed, 0.4, 64); for (let x = 0; x < 64; x += r.range(2, 5)) t.line(x, 0, x + r.range(-1, 1), 64, r.range(0.5, 1.3), r.chance(0.5) ? cs[1] : cs[2], 0.9); t.speck(20, [cs[1]], 1, 2.5, 0.6, true); break;
    case 'wallTop': t.grain(0.3, 16, seed, 0.4, 64); for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 64; x += 8) t.rect(x + 0.2, y + 0.2, 7.6, 7.6, r.chance(0.5) ? cs[0] : cs[1], 0.8, 1); t.speck(30, [cs[3] || cs[2]], 0.5, 1.5, 0.5, true); break;
    case 'wallFace': t.grain(0.3, 16, seed, 0.3, 64); for (let y = 0; y < 64; y += 4) for (let x = (y / 4) % 2 ? 3 : 0; x < 64; x += 6) t.rect(x + 0.25, y + 0.25, 5.5, 3.5, r.chance(0.3) ? cs[2] : r.chance(0.5) ? cs[0] : cs[1], 0.7, 0.6); t.speck(10, [cs[3] || cs[2]], 1.5, 3, 0.6, true, 'crack'); break;
    case 'metalWall': t.grain(0.25, 8, seed, 0.2, 64); for (let x = 0; x < 64; x += 4) t.rect(x, 0, 2.6, 64, cs[1], 0.7, 0.7); for (let y = 0; y < 64; y += 16) t.rect(0, y, 64, 1, cs[2], 1.2, 0.4); t.speck(30, [cs[3] || cs[2]], 1, 3, 0.1, true); break;
    case 'bridge': for (let y = 0; y < 64; y += 4) t.rect(0, y + 0.3, 64, 3.4, r.chance(0.5) ? cs[0] : cs[1], 0.8, 0.6); t.grain(0.4, 8, seed, 0.3, 64); for (let x = 0; x < 64; x += 16) t.rect(x + 2, 0, 1, 64, cs[2], 0.3); break;
  }
  return t.finish(P, { dither: 0.55, amb: 0.5, dif: 0.62, hs: 0.9 });
}

// city facades and roofs (64×64, tile in both directions): weathered concrete with window grids, old
// brick, rusted cladding, a dead glass tower; roofs of gravel and vents, or gone to moss
export function facadeTex(kind, seed) {
  const P = kind === 'brick' || kind === 'metal' ? PALS.rust : PALS.ash, t = new TB(64, 64, 3, seed), r = t.r;
  const win = (x, y, w, h, lit) => { t.rect(x, y, w, h, lit ? r.pick(['#ffb040', '#e2722a', '#ffe08a']) : r.pick(['#110f14', '#1a171e', '#08070a']), -0.6); if (!lit && r.chance(0.25)) t.rect(x, y, w, h * 0.4, '#3c3644', -0.3); };
  switch (kind) {
    case 'conc': { t.fill('#5d5564', 0); t.grain(0.35, 8, seed, 0.4, 64); for (let y = 0; y < 64; y += 16) { t.rect(0, y, 64, 1.2, '#3c3644', 0.6); for (let x = 2; x < 64; x += 8) win(x, y + 4, 5, 7, r.chance(0.07)); } for (let k = 0; k < 7; k++) { const x = r.range(0, 64); t.line(x, r.range(0, 30), x + r.range(-1, 1), 64, r.range(0.6, 1.4), r.pick(['#4a1c16', '#3c3644', '#2f2a36'])); } t.speck(6, ['#24202a'], 2, 4, 0.5, true, 'crack'); break; }
    case 'brick': { t.fill('#66442c', 0); for (let y = 0; y < 64; y += 3) for (let x = (y / 3) % 2 ? 2 : 0; x < 64; x += 5) t.rect(x + 0.2, y + 0.2, 4.6, 2.6, r.pick(['#66442c', '#513726', '#7f5433', '#3f2c20', '#c6452a']), 0.5, 0.4); for (let y = 0; y < 64; y += 21) for (let x = 3; x < 64; x += 11) { win(x, y + 6, 6, 10, r.chance(0.08)); t.rect(x - 0.5, y + 5, 7, 1.2, '#9d9886', 1); } t.grain(0.3, 8, seed, 0.3, 64); break; }
    case 'metal': { t.fill('#43413a', 0); for (let x = 0; x < 64; x += 4) t.rect(x, 0, 2.4, 64, '#5c5a50', 0.7, 0.6); for (let k = 0; k < 10; k++) { const x = r.range(0, 64); t.line(x, r.range(0, 40), x, 64, r.range(0.8, 2), r.pick(['#7f5433', '#9b673c', '#513726'])); } for (let y = 6; y < 64; y += 22) for (let x = 4; x < 64; x += 16) win(x, y, 9, 4, r.chance(0.06)); t.grain(0.35, 8, seed, 0.3, 64); break; }
    case 'tower': { t.fill('#1a171e', 0); for (let y = 0; y < 64; y += 6) for (let x = 0; x < 64; x += 6) { const broken = r.chance(0.18); t.rect(x + 0.4, y + 0.4, 5.2, 5.2, broken ? '#08070a' : r.chance(0.05) ? '#ffb040' : r.pick(['#24202a', '#2f2a36', '#1c2a2e', '#2c4a4e']), broken ? -0.5 : 0.3); } for (let x = 0; x < 64; x += 12) t.rect(x, 0, 0.8, 64, '#5d5564', 0.8); t.grain(0.3, 8, seed, 0.2, 64); break; }
    case 'tile': { t.fill('#8b8290', 0); for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) t.rect(x + 0.2, y + 0.2, 3.6, 3.6, r.pick(['#8b8290', '#a69ca8', '#726978', '#5d5564']), 0.4, 0.3); for (let y = 2; y < 64; y += 16) for (let x = 3; x < 64; x += 10) win(x, y + 2, 6, 8, r.chance(0.06)); for (let k = 0; k < 9; k++) { const x = r.range(0, 64); t.line(x, r.range(0, 20), x, 64, r.range(0.5, 1.2), r.pick(['#4b4453', '#3c3644', '#4a1c16'])); } t.grain(0.3, 8, seed, 0.3, 64); break; }
    case 'roof': { t.fill('#3c3644', 0); t.grain(0.4, 16, seed, 0.4, 64); t.speck(200, ['#4b4453', '#24202a', '#5d5564'], 0.3, 0.8, 0.3, true); for (let k = 0; k < 3; k++) { const x = r.range(4, 50), y = r.range(4, 50); t.rect(x, y, r.range(5, 10), r.range(4, 8), '#5d5564', 2.5, 0.8); } t.speck(5, ['#1c2a2e'], 3, 6, -0.2, true); break; }
    case 'roofgreen': { t.fill('#24202a', 0); t.grain(0.4, 16, seed, 0.4, 64); t.speck(120, ['#2c4a4e', '#1c2a2e', '#3c3644'], 0.6, 2, 0.5, true); t.speck(60, ['#3e7a70', '#2c4a4e'], 0.3, 0.8, 0.6, true, 'blade'); break; }
  }
  return t.finish(P, { dither: 0.5, amb: 0.5, dif: 0.6, hs: 0.8 });
}

// ------------------------------------------------ props
export const PROPDEF = {
  tree: { w: 36, h: 50, foot: [10, 6] }, pine: { w: 24, h: 52, foot: [8, 5] }, snowpine: { w: 26, h: 54, foot: [8, 5] }, bigtree: { w: 66, h: 98, foot: [22, 10], s: 3 }, willow: { w: 40, h: 48, foot: [10, 6] },
  deadtree: { w: 30, h: 44, foot: [6, 5] }, burnt: { w: 28, h: 40, foot: [6, 5] }, palm: { w: 32, h: 50, foot: [6, 5] }, fungus: { w: 22, h: 24, foot: [6, 4] }, bigshroom: { w: 44, h: 56, foot: [14, 7], s: 3 },
  bush: { w: 16, h: 13, foot: null }, fern: { w: 18, h: 14, foot: null }, reeds: { w: 12, h: 14, foot: null }, rock: { w: 16, h: 12, foot: [12, 6] }, boulder: { w: 26, h: 20, foot: [22, 8] },
  stones: { w: 34, h: 30, foot: [30, 8] }, cactus: { w: 12, h: 22, foot: [5, 4] }, wreck: { w: 34, h: 18, foot: [30, 8] }, bus: { w: 54, h: 26, foot: [50, 10], s: 3 }, tank: { w: 30, h: 36, foot: [26, 12] },
  drum: { w: 10, h: 12, foot: [8, 5] }, scrap: { w: 22, h: 14, foot: [18, 6] }, ribs: { w: 40, h: 30, foot: null }, pillar: { w: 12, h: 30, foot: [8, 5] }, tower: { w: 46, h: 72, foot: [40, 12], s: 3 },
  lamp: { w: 10, h: 32, foot: [3, 3] }, billboard: { w: 34, h: 38, foot: [30, 3] }, pylon: { w: 40, h: 76, foot: [20, 8], s: 3 }, chimney: { w: 20, h: 84, foot: [14, 10], s: 3 }, pipes: { w: 32, h: 16, foot: [30, 7] },
  crystal: { w: 16, h: 24, foot: [8, 5] }, totem: { w: 10, h: 24, foot: [5, 4] }, fence: { w: 30, h: 12, foot: [28, 3] }, scarecrow: { w: 16, h: 28, foot: [3, 3] },
  shack: { w: 46, h: 40, foot: [40, 14], s: 3 }, cottage: { w: 48, h: 46, foot: [42, 14], s: 3 }, adobe: { w: 44, h: 34, foot: [38, 14], s: 3 }, loghut: { w: 46, h: 40, foot: [40, 14], s: 3 }, bunker: { w: 46, h: 30, foot: [42, 14], s: 3 },
  watertower: { w: 28, h: 64, foot: [22, 10], s: 3 }, windpump: { w: 26, h: 60, foot: [10, 8], s: 3 }, well: { w: 18, h: 22, foot: [14, 8] }, firebarrel: { w: 10, h: 14, foot: [8, 5] }, laundry: { w: 34, h: 20, foot: null }, cart: { w: 26, h: 18, foot: [22, 8] }, tent: { w: 30, h: 24, foot: [26, 8] },
  observatory: { w: 58, h: 72, foot: [50, 18], s: 3 }, greenhouse: { w: 62, h: 44, foot: [54, 16], s: 3 }, airship: { w: 124, h: 58, foot: [104, 20], s: 2 }, shrine: { w: 30, h: 48, foot: [24, 10] }, radiomast: { w: 32, h: 112, foot: [12, 10], s: 2 },
  lifttower: { w: 36, h: 124, foot: null, s: 2 }, liftpad: { w: 34, h: 26, foot: null }, statue: { w: 42, h: 92, foot: [30, 14], s: 3 },
  // the dream's flora
  birch: { w: 30, h: 54, foot: [6, 5] }, maple: { w: 38, h: 50, foot: [10, 6] }, blossom: { w: 40, h: 48, foot: [10, 6] }, spirittree: { w: 74, h: 104, foot: [22, 10], s: 2 }, lanterntree: { w: 38, h: 52, foot: [10, 6] },
  glowshroom: { w: 22, h: 20, foot: null }, bamboo: { w: 22, h: 60, foot: [8, 5] }, flowerbush: { w: 18, h: 14, foot: null }, mossrock: { w: 22, h: 16, foot: [18, 7] },
  // landmarks, treasure and the ways up and down
  fountain: { w: 40, h: 36, foot: [34, 12], s: 3 }, rootarch: { w: 50, h: 52, foot: null, s: 3 }, foxstatue: { w: 26, h: 34, foot: [18, 8] }, lanternshrine: { w: 22, h: 34, foot: [14, 8] }, obelisk: { w: 18, h: 60, foot: [14, 8], s: 3 },
  cairn: { w: 22, h: 30, foot: [16, 8] }, urn: { w: 16, h: 22, foot: [12, 6] }, crystalheart: { w: 52, h: 60, foot: [40, 14], s: 3 }, dragonbones: { w: 96, h: 50, foot: null, s: 2 }, moonpool: { w: 46, h: 22, foot: null, s: 3 },
  windtemple: { w: 64, h: 66, foot: [50, 14], s: 2 }, starharp: { w: 44, h: 70, foot: [30, 10], s: 3 }, floatbell: { w: 36, h: 64, foot: [24, 10], s: 3 }, nest: { w: 22, h: 12, foot: null }, treehouse: { w: 54, h: 52, foot: [44, 14], s: 3 },
  chest: { w: 16, h: 14, foot: null }, chestopen: { w: 16, h: 14, foot: null }, cavemouth: { w: 40, h: 34, foot: null, s: 3 }, floatrock: { w: 26, h: 24, foot: null }, basket: { w: 22, h: 30, foot: null }, headframe: { w: 30, h: 46, foot: null, s: 3 }
};
export function paintProp(type, fam, seed) {
  const F = FAMILY[fam], D = PROPDEF[type], t = new TB(D.w, D.h, D.s || 4, seed, D.pad ?? (D.w > 30 ? 6 : 3)), r = t.r, K = F.col, pick = (a) => r.pick(a);
  const leaf = K.leaf, bark = K.bark, stone = K.stone, metal = K.metal, rust = K.rust, W = D.w, H = D.h;
  const canopy = (cx, cy, n, rx, ry, rmin, rmax, cols) => { for (let k = 0; k < n; k++) { const x = cx + r.range(-rx, rx), y = cy + r.range(-ry, ry * 0.7), rr = r.range(rmin, rmax); t.ell(x, y, rr, rr * 0.85, pick(cols), rr * 1.1); } };
  switch (type) {
    case 'tree': { t.rect(W / 2 - 2, 26, 4, 22, pick(bark), 1.8, 0.8); t.line(W / 2, 38, W / 2 - 5, 47, 1.6, pick(bark), 1); t.line(W / 2, 38, W / 2 + 5, 47, 1.6, pick(bark), 1); t.line(W / 2, 30, W / 2 + 7, 22, 1.4, pick(bark), 1.2);
      canopy(W / 2, 17, 34, 12, 11, 3.5, 6.5, leaf); t.speck(40, [leaf[leaf.length - 1], shadeHex(leaf[0], 0.7)], 0.3, 0.7, 0.3, false); if (K.vine) t.speck(8, K.vine, 0.5, 1, 0.2, false); t.speck(6, [shadeHex(leaf[0], 0.5)], 1.5, 3, -0.5, false); break; }
    case 'willow': { t.rect(W / 2 - 2.5, 24, 5, 24, pick(bark), 2, 0.8); canopy(W / 2, 16, 24, 13, 8, 4, 6.5, leaf); for (let k = 0; k < 30; k++) { const x = r.range(6, W - 6); t.line(x, r.range(12, 22), x + r.range(-1, 1), r.range(28, 44), 0.8, pick(leaf), 1.4); } break; }
    case 'pine': case 'snowpine': { t.rect(W / 2 - 1.5, H - 10, 3, 10, pick(bark), 1.2); for (let i = 0; i < 7; i++) { const y = 6 + i * 5.6, w = 2.5 + i * 1.6; for (let k = 0; k < 6; k++) t.ell(W / 2 + r.range(-w * 0.6, w * 0.6), y + r.range(0, 2.5), w * 0.55, 2.4, pick(leaf), 2.6); if (type === 'snowpine') for (let k = 0; k < 4; k++) t.ell(W / 2 + r.range(-w * 0.55, w * 0.55), y - 0.6 + r.range(0, 1), w * 0.35, 1, pick(K.snow), 3); } break; }
    case 'bigtree': { const bx = W / 2; t.poly([[bx - 9, H], [bx - 5, 50], [bx + 5, 50], [bx + 10, H]], pick(bark)); t.hrect(bx - 9, 50, 18, H - 50, 4, 3);
      for (const [dx, a] of [[-12, -0.9], [13, -2.2], [-4, -1.4], [6, -1.7]]) { let x = bx + dx * 0.2, y = 58; for (let s = 0; s < 4; s++) { const nx = x + Math.cos(a) * 7 + r.range(-1, 1), ny = y + Math.sin(a) * 7; t.line(x, y, nx, ny, 3.2 - s * 0.6, pick(bark), 2); x = nx; y = ny; } }
      for (const [x, y] of [[bx - 13, H - 2], [bx + 14, H - 2], [bx - 8, H - 1]]) t.line(bx, H - 8, x, y, 2.6, pick(bark), 1.5);
      canopy(bx, 30, 70, 28, 22, 5, 10, leaf); t.speck(70, [leaf[leaf.length - 1], shadeHex(leaf[0], 0.6)], 0.4, 1, 0.3, false); if (K.moss) t.speck(20, K.moss, 0.6, 1.4, 2.5, false); t.speck(10, [shadeHex(leaf[0], 0.45)], 2, 4, -0.6, false); break; }
    case 'deadtree': case 'burnt': { const bc = type === 'burnt' ? K.char : bark; t.rect(W / 2 - 1.5, 22, 3.5, 20, pick(bc), 1.4, 0.7);
      const br = (x, y, a, len, w, d) => { if (d > 5 || w < 0.4) return; const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len; t.line(x, y, nx, ny, w, pick(bc), w * 0.8); br(nx, ny, a + r.range(-0.6, -0.1), len * 0.74, w * 0.7, d + 1); if (r.chance(0.7)) br(nx, ny, a + r.range(0.1, 0.6), len * 0.7, w * 0.65, d + 1); };
      br(W / 2, 24, -1.57 + r.range(-0.3, 0.3), 9, 2.6, 0); if (type === 'burnt') t.speck(5, K.glow, 0.3, 0.5, 0, false); else if (r.chance(0.4)) t.speck(3, ['#0b0d0a'], 0.8, 1.2, 0.5, false); break; }
    case 'palm': { let x = W / 2, y = H; const lean = r.range(-0.35, 0.35); for (let i = 0; i < 16; i++) { const nx = x + lean * 1.6, ny = y - 2.3; t.line(x, y, nx, ny, 2.6 - i * 0.07, pick(bark), 1.2); x = nx; y = ny; }
      for (let k = 0; k < 9; k++) { const a = -3.14 + k * 0.4 + r.range(-0.1, 0.1); let px = x, py = y; for (let s = 0; s < 6; s++) { const nx = px + Math.cos(a) * 2.6, ny = py + Math.sin(a) * 1.6 + s * 0.75; t.line(px, py, nx, ny, 1.9 - s * 0.25, pick(k % 3 ? leaf : [shadeHex(leaf[0], 0.8), '#6e5c47']), 1.4); px = nx; py = ny; } } t.ell(x, y + 1, 1.7, 1.3, pick(bark), 1); break; }
    case 'fungus': { t.rect(W / 2 - 1.5, 12, 3.5, 11, K.fungStem, 1.4, 0.8); const capC = pick(K.fungCap); t.ell(W / 2, 10, 9, 5, capC, 4); t.ell(W / 2, 12.5, 8, 1.5, shadeHex(capC, 0.55), 0.5); for (let k = 0; k < 7; k++) t.ell(W / 2 + r.range(-6, 6), 8 + r.range(-2.5, 1.5), r.range(0.6, 1.2), r.range(0.5, 0.9), pick(K.glow), 5); break; }
    case 'bigshroom': { t.rect(W / 2 - 3, 22, 6, 34, K.fungStem, 2.6, 1); for (let k = 0; k < 4; k++) t.ell(W / 2 + r.range(-2, 2), r.range(28, 50), 3.5, 1, shadeHex(K.fungStem, 0.75), 2.8); const capC = pick(K.fungCap); t.ell(W / 2, 18, 20, 11, capC, 8); t.ell(W / 2, 24, 18, 3, shadeHex(capC, 0.5), 1); for (let k = 0; k < 14; k++) t.ell(W / 2 + r.range(-15, 15), 14 + r.range(-6, 4), r.range(0.8, 1.8), r.range(0.6, 1.2), pick(K.glow), 9); break; }
    case 'bush': for (let k = 0; k < 9; k++) { const rr = r.range(2.5, 4); t.ell(8 + r.range(-3, 3), 7 + r.range(-1.5, 1.5), rr, rr * 0.8, pick(leaf), rr); } if (K.berry && r.chance(0.3)) t.speck(4, K.berry, 0.4, 0.6, 1, false); break;
    case 'fern': for (let k = 0; k < 9; k++) { const a = -3.1 + k * 0.39; let px = 9, py = 13; for (let s = 0; s < 4; s++) { const nx = px + Math.cos(a) * 2.2, ny = py + Math.sin(a) * 2.6 + s * 0.4; t.line(px, py, nx, ny, 1.2 - s * 0.2, pick(leaf), 1.2); px = nx; py = ny; } } break;
    case 'reeds': for (let k = 0; k < 12; k++) { const x = r.range(2, 10); t.line(x, 13, x + r.range(-1.5, 1.5), r.range(2, 7), 0.6, pick(leaf), 0.6); } t.speck(3, [pick(bark)], 0.6, 0.9, 0.5, false); break;
    case 'rock': case 'boulder': { t.ell(W / 2, H * 0.58, W * 0.43, H * 0.4, pick(stone), H * 0.5); t.ell(W * 0.45, H * 0.45, W * 0.3, H * 0.28, pick(stone), H * 0.62, 'base'); t.grain(0.35, 4, seed, 0.6); t.speck(3, [shadeHex(stone[0], 0.6)], 1, 2, 0.3, false, 'crack'); if (K.moss) t.speck(8, K.moss, 0.6, 1.3, 0.2, false); break; }
    case 'stones': { for (const [x, h, w] of [[5, 22, 5], [14, 28, 6], [24, 20, 5], [30, 14, 4]]) { const c = pick(stone); t.rect(x - w / 2, H - h, w, h, c, 4, 1.4); t.poly([[x - w / 2, H - h], [x, H - h - 2], [x + w / 2, H - h]], c); } t.grain(0.4, 4, seed, 0.5); if (K.moss) t.speck(14, K.moss, 0.5, 1.2, 4.5, false); break; }
    case 'cactus': { const c = pick(K.cactus); t.line(6, 21, 6, 4, 4, c, 2.4); if (r.chance(0.8)) { t.line(6, 12, 2.5, 11, 2.2, c, 1.6); t.line(2.5, 11, 2.5, 6, 2.2, c, 1.6); } if (r.chance(0.7)) { t.line(6, 10, 9.5, 9, 2.2, c, 1.6); t.line(9.5, 9, 9.5, 5, 2.2, c, 1.6); } t.speck(14, [K.cactus[2] || '#e8e0c0'], 0.2, 0.3, 0.3, false); break; }
    case 'wreck': { const c = pick(rust); t.rect(2, 6, 30, 9, c, 3, 1.2); t.rect(9, 3, 15, 6, shadeHex(c, 0.85), 4.5, 1); t.rect(10, 3.8, 6, 3.6, '#141818', 4); t.rect(17, 3.8, 6, 3.6, '#141818', 4); for (const x of [6, 26]) t.ell(x, 14, 3, 2.4, '#151210', 1.5); t.grain(0.45, 3, seed, 0.5); if (K.vine) t.speck(14, K.vine, 0.6, 1.4, 3.5, false); t.speck(10, rust, 0.4, 1, 0, false); break; }
    case 'bus': { const c = pick(rust.concat(metal)); t.rect(2, 4, 50, 18, c, 4, 1.4); for (let x = 5; x < 48; x += 7) t.rect(x, 7, 5, 5, r.chance(0.3) ? '#2a2a2a' : '#141818', 5); t.rect(2, 14, 50, 1.2, shadeHex(c, 0.6), 4.5); for (const x of [10, 42]) t.ell(x, 22, 3.4, 2.6, '#151210', 1.5); t.grain(0.5, 3, seed, 0.5); t.speck(20, rust, 0.6, 1.8, 0.1, false); if (K.vine) t.speck(22, K.vine, 0.6, 1.6, 5, false); break; }
    case 'tank': { const c = pick(metal); t.rect(3, 10, 24, 24, c, 0); t._hRegion(3, 10, 27, 34, (x) => 8 * Math.sqrt(Math.max(0, 1 - ((x - 15) / 12) ** 2))); t.ell(15, 10, 12, 4, shadeHex(c, 1.1), 9); for (let y = 14; y < 34; y += 6) t.rect(3, y, 24, 0.8, shadeHex(c, 0.7), 0); t.line(24, 6, 24, 34, 0.6, '#2a2a2a', 1); for (let y = 8; y < 34; y += 2) t.line(23, y, 25, y, 0.4, '#3a3a3a', 1); for (let k = 0; k < 7; k++) { const x = r.range(5, 25); t.line(x, r.range(12, 18), x + r.range(-0.5, 0.5), r.range(20, 34), r.range(0.6, 1.4), pick(rust)); } t.grain(0.3, 4, seed, 0.3); break; }
    case 'drum': { const c = pick(rust.concat(['#3a4a2a', '#4a5a22'])); t.rect(1.5, 1.5, 7, 10, c, 0); t._hRegion(1.5, 1.5, 8.5, 11.5, (x) => 3 * Math.sqrt(Math.max(0, 1 - ((x - 5) / 3.5) ** 2))); t.ell(5, 1.8, 3.5, 1.2, shadeHex(c, 1.2), 3); t.rect(1.5, 5, 7, 0.7, '#1d1d1a', 3); t.grain(0.5, 3, seed, 0.3); t.speck(4, ['#b4c444'], 0.3, 0.6, 3, false); break; }
    case 'scrap': for (let k = 0; k < 20; k++) { const x = r.range(2, 18), y = r.range(4, 11), w = r.range(2, 6), h = r.range(1.5, 4); t.rect(x, y - (11 - y) * 0.2, w, h, pick(r.chance(0.6) ? rust : metal), r.range(1, 4), 0.6); } t.grain(0.4, 3, seed, 0.4); break;
    case 'ribs': { const b = K.bone; t.line(2, 26, 38, 25, 2.2, b[1], 1.5); for (let i = 0; i < 6; i++) { const x = 6 + i * 5.5, hh = 16 + Math.sin((i / 5) * 3.14) * 7; let px = x, py = 25; for (let s = 0; s < 6; s++) { const nx = x + Math.sin((s / 5) * 2.6) * 5, ny = 25 - (s / 5) * hh; t.line(px, py, nx, ny, 1.7 - s * 0.12, pick(b), 1.4); px = nx; py = ny; } } t.ell(36, 24, 3.4, 2.8, b[0], 2); break; }
    case 'pillar': { const c = pick(K.concrete); t.rect(2, 6, 8, 24, c, 2.5, 1); t.poly([[2, 6], [3, 2], [5, 4], [7, 1], [10, 6]], c); t.hrect(2, 1, 8, 5, 2.5, 0.6); t.line(4, 3, 3, 0, 0.4, rust[0], 0.6); t.line(8, 3, 9, 0.5, 0.4, rust[0], 0.6); t.grain(0.4, 3, seed, 0.4); if (K.vine) t.speck(12, K.vine, 0.6, 1.2, 3, false); break; }
    case 'tower': { const c = pick(K.concrete); t.rect(3, 10, 40, 60, c, 5, 1.5); for (let y = 14; y < 66; y += 6) for (let x = 6; x < 41; x += 5) if (r.chance(0.8)) t.rect(x, y, 3, 3.5, r.chance(0.04) ? pick(K.glow) : '#0e0e12', 2);
      const jag = [[3, 10]]; for (let x = 3; x <= 43; x += 3) jag.push([x, r.range(0, 14)]); jag.push([43, 10]); t.x.globalCompositeOperation = 'destination-out'; t.poly([[0, 0], [46, 0], ...jag.reverse()], '#000'); t.x.globalCompositeOperation = 'source-over';
      t.grain(0.35, 4, seed, 0.4); t.speck(8, [shadeHex(c, 0.5)], 2, 4, 0.8, false, 'crack'); if (K.vine) t.speck(16, K.vine, 0.8, 2, 5.5, false); break; }
    case 'lamp': { t.line(4, 31, 4, 4, 1.4, pick(metal), 1); t.line(4, 4, 8, 5, 1, pick(metal), 1); t.rect(6.5, 5, 2, 1.5, r.chance(0.3) ? K.glow[0] : '#2a2a2a', 1.5); break; }
    case 'billboard': { t.line(7, 37, 7, 16, 1.4, pick(metal), 1); t.line(27, 37, 27, 16, 1.4, pick(metal), 1); t.rect(1, 2, 32, 16, pick(rust), 1.5, 0.6); for (let k = 0; k < 4; k++) t.rect(r.range(2, 24), r.range(3, 13), r.range(3, 9), r.range(2, 4), pick(K.sign), 1.6);
      t.x.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 3; k++) t.ell(r.range(2, 32), r.range(2, 17), r.range(1, 3), r.range(1, 3), '#000'); t.x.globalCompositeOperation = 'source-over'; t.grain(0.35, 4, seed, 0.3); break; }
    case 'pylon': { const c = pick(metal), lean = r.range(-0.12, 0.12), top = (y) => W / 2 + (H - y) * lean; const L = (x0, y0, x1, y1, w = 1) => t.line(x0, y0, x1, y1, w, c, 1.6);
      L(W / 2 - 9, H, top(14) - 2, 14, 1.4); L(W / 2 + 9, H, top(14) + 2, 14, 1.4); for (let y = H - 6; y > 18; y -= 8) { const a = (H - y) / (H - 14), xl = W / 2 - 9 + (top(y) - 2 - (W / 2 - 9)) * a, xr = W / 2 + 9 + (top(y) + 2 - (W / 2 + 9)) * a; L(xl, y, xr, y - 8, 0.6); L(xr, y, xl, y - 8, 0.6); L(xl, y, xr, y, 0.6); }
      L(top(18) - 16, 18, top(18) + 16, 18, 1.2); L(top(10) - 11, 10, top(10) + 11, 10, 1); for (const x of [-15, -8, 8, 15]) t.line(top(18) + x, 18, top(18) + x, 22, 0.6, '#d8d0b8', 2); if (r.chance(0.5)) for (let k = 0; k < 3; k++) t.line(top(18) - 15 + k * 15, 22, top(18) - 15 + k * 15 + r.range(-4, 4), r.range(40, 70), 0.4, '#1a1a1a', 2.5); t.grain(0.3, 4, seed, 0.2); break; }
    case 'chimney': { const c = pick(K.concrete.concat(['#6a4a3a'])); t.poly([[4, H], [7, 8], [13, 8], [16, H]], c); t._hRegion(4, 8, 16, H, (x) => 4 * Math.sqrt(Math.max(0, 1 - ((x - 10) / 6) ** 2))); for (let y = 14; y < H; y += 10) t.rect(5, y, 10, 1, shadeHex(c, 0.7), 3); t.rect(6.5, 6, 7, 3, '#2a2a2a', 4); for (let k = 0; k < 8; k++) { const x = r.range(7, 13); t.line(x, 10, x, r.range(20, 60), r.range(0.5, 1.2), '#1d1d1a', 3); } t.grain(0.4, 4, seed, 0.3); break; }
    case 'pipes': for (let k = 0; k < 3; k++) { const y = 4 + k * 4, c = pick(metal); t.line(1, y, 31, y, 3.4, c, 1.8); for (let x = 4; x < 30; x += r.range(6, 11)) t.rect(x, y - 2.2, 1.4, 4.4, shadeHex(c, 1.15), 3); } t.rect(4, 13, 2, 3, '#222', 1); t.rect(25, 13, 2, 3, '#222', 1); t.grain(0.3, 4, seed, 0.3); t.speck(6, rust, 0.6, 1.4, 2, false); break;
    case 'crystal': for (let k = 0; k < 5; k++) { const x = r.range(4, 12), h = r.range(9, 22), c = pick(K.crystal); t.poly([[x - 1.5, 23], [x + r.range(-1.5, 1.5), 23 - h], [x + 1.5, 23]], c); t.hrect(x - 1.5, 23 - h, 3, h, 3); } t.speck(4, K.glow, 0.3, 0.5, 0, false); break;
    case 'totem': { const c = pick(bark); t.rect(3, 4, 4, 19, c, 2, 0.8); t.ell(5, 4, 3.5, 3, K.bone[0], 3); t.rect(3.6, 3.4, 1, 1, '#101010', 3.5); t.rect(5.6, 3.4, 1, 1, '#101010', 3.5); t.line(1, 10, 9, 10, 0.8, pick(K.cloth), 2.5); break; }
    case 'fence': { const c = pick(K.plank); for (let x = 2; x < 30; x += r.range(4.5, 6.5)) if (r.chance(0.85)) t.rect(x, r.range(1, 3), 1.6, 9, pick(K.plank), 1.5, 0.4); t.line(1, 5, 29, 5.6, 1, c, 1.6); t.line(1, 8.5, 29, 8, 1, c, 1.6); if (r.chance(0.4)) t.line(r.range(4, 26), 2, r.range(4, 26), 10, 0.4, '#555b5f', 2); t.grain(0.4, 3, seed, 0.3); break; }
    case 'scarecrow': { const c = pick(bark); t.line(8, 27, 8, 6, 1.2, c, 1.2); t.line(2, 10, 14, 10.5, 1, c, 1.4); t.poly([[4, 9], [12, 9], [11, 20], [5, 20]], pick(K.cloth)); t.hrect(4, 9, 8, 11, 1.8, 1); t.ell(8, 6, 2.4, 2.4, '#c4a24a', 2.2); t.poly([[4.5, 5], [8, 1.5], [11.5, 5]], pick(K.plank)); t.rect(7, 5.6, 0.8, 0.8, '#101010', 2.4); t.grain(0.4, 3, seed, 0.3); break; }
    // ---- village buildings: weathered, patched, lived in
    case 'shack': case 'loghut': case 'cottage': case 'adobe': case 'bunker': { villageHouse(t, type, K, r, W, H); break; }
    case 'watertower': { const c = pick(rust.concat(metal)); for (const x of [6, 22]) t.line(x, H, W / 2 + (x - W / 2) * 0.6, 30, 1.4, pick(metal), 1.4); t.line(6, H - 12, 22, 34, 0.6, pick(metal), 1.2); t.line(22, H - 12, 6, 34, 0.6, pick(metal), 1.2);
      t.rect(3, 12, 22, 20, c, 0); t._hRegion(3, 12, 25, 32, (x) => 7 * Math.sqrt(Math.max(0, 1 - ((x - 14) / 11) ** 2))); t.poly([[2, 13], [14, 3], [26, 13]], shadeHex(c, 0.85)); t.hrect(2, 3, 24, 10, 6, 3); for (let y = 16; y < 32; y += 5) t.rect(3, y, 22, 0.7, shadeHex(c, 0.65), 0);
      for (let k = 0; k < 6; k++) { const x = r.range(5, 23); t.line(x, 16, x, r.range(24, 34), 0.8, pick(rust)); } t.grain(0.4, 4, seed, 0.3); break; }
    case 'windpump': { const c = pick(metal); t.line(13, H, 11, 14, 1.2, c, 1.4); t.line(5, H, 11, 14, 1, c, 1.2); t.line(21, H, 13, 14, 1, c, 1.2); for (let y = H - 8; y > 18; y -= 9) t.line(7 + (H - y) * 0.1, y, 19 - (H - y) * 0.1, y, 0.6, c, 1.2);
      const cx = 12, cy = 12; for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283 + r.range(-0.05, 0.05); if (r.chance(0.15)) continue; t.line(cx, cy, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, 1.2, pick(rust), 2.2); } t.ell(cx, cy, 1.6, 1.6, '#2a2a2a', 2.6); t.line(cx, cy, cx + 12, cy + 1, 1, pick(metal), 2); t.rect(cx + 10, cy - 3, 3, 6, pick(rust), 2.2); break; }
    case 'well': { const s = K.stone; t.rect(2, 12, 14, 9, s[0], 2, 1); t.ell(9, 12, 7, 2.2, '#101010', 0.5); for (let k = 0; k < 6; k++) t.rect(2 + k * 2.4, r.range(12, 14), 2.2, 2, pick(s), 2.4, 0.4); t.line(3, 13, 3, 3, 1, pick(bark), 1.5); t.line(15, 13, 15, 3, 1, pick(bark), 1.5); t.poly([[1, 4], [9, 0], [17, 4]], pick(K.roof)); t.line(9, 4, 9, 10, 0.3, '#6e5c47', 2); t.grain(0.4, 3, seed, 0.3); break; }
    case 'firebarrel': { const c = pick(rust); t.rect(1.5, 4, 7, 9.5, c, 0); t._hRegion(1.5, 4, 8.5, 13.5, (x) => 3 * Math.sqrt(Math.max(0, 1 - ((x - 5) / 3.5) ** 2))); t.ell(5, 4, 3.5, 1.2, '#1a1410', 1); t.rect(1.5, 8, 7, 0.7, '#1d1d1a', 3); for (let k = 0; k < 6; k++) t.ell(5 + r.range(-2, 2), r.range(1, 4), r.range(0.6, 1.2), r.range(0.8, 1.6), r.pick(['#ffb040', '#e2722a', '#ffe08a']), 4); t.grain(0.5, 3, seed, 0.3); break; }
    case 'laundry': { const c = pick(bark); t.line(2, 19, 2, 2, 1, c, 1.4); t.line(32, 19, 32, 3, 1, c, 1.4); t.line(2, 3, 32, 4.5, 0.4, '#3e352b', 2); for (let x = 4; x < 30; x += r.range(4, 7)) { const w = r.range(3, 5), h = r.range(4, 9); t.rect(x, 3.6 + (x / 30) * 1.2, w, h, pick(K.cloth.concat(K.tarp)), 2, 0.5); } t.grain(0.4, 3, seed, 0.3); break; }
    case 'cart': { const c = pick(K.plank); t.rect(2, 6, 20, 6, c, 2, 0.6); for (let x = 3; x < 21; x += 3) t.rect(x, 6, 0.6, 6, shadeHex(c, 0.7), 2.4); t.ell(7, 13, 4, 4, '#2a2520', 1.5); t.ell(7, 13, 1, 1, '#6e5c47', 2); t.line(22, 9, 26, 11, 0.8, pick(bark), 1.6); t.speck(6, K.cloth, 1, 2, 2.5, false); t.grain(0.4, 3, seed, 0.3); break; }
    case 'tent': { const c = pick(K.tarp); t.poly([[2, 23], [15, 3], [28, 23]], c); t._hRegion(2, 3, 28, 23, (x, y) => { const e = 1 - Math.abs(x - 15) / 13; return y > 3 + (1 - e) * 20 ? 6 * e : undefined; }); t.poly([[12.5, 23], [15, 12], [17.5, 23]], '#120e0a'); t.line(15, 3, 15, 1, 0.5, pick(bark), 1); t.speck(6, [shadeHex(c, 0.6)], 1, 2, 0.2, false); t.grain(0.4, 3, seed, 0.4); break; }
    // ---- landmarks
    case 'observatory': { const s = K.stone; t.rect(8, 34, 42, 36, pick(s), 5, 1.4); for (let y = 38; y < 68; y += 6) t.rect(8, y, 42, 0.6, shadeHex(s[0], 0.7), 5); t.ell(29, 34, 21, 18, '#555b5f', 12); t.x.globalCompositeOperation = 'destination-out'; t.rect(8, 34, 42, 18, null); t.x.fillRect(8 * 3, 34 * 3, 42 * 3, 18 * 3); t.x.globalCompositeOperation = 'source-over';
      t.rect(26, 16, 7, 20, '#141818', 13); t.line(29, 22, 42, 8, 3, '#767c7c', 14); t.speck(20, ['#7a2e22', '#a8522e'], 1, 3, 0.2, false); for (let k = 0; k < 3; k++) t.rect(14 + k * 12, 50, 4, 7, '#101414', 4); if (K.vine) t.speck(26, K.vine, 0.8, 2, 6, false); t.grain(0.4, 4, seed, 0.4); break; }
    case 'greenhouse': { const m = pick(metal); t.rect(4, 18, 54, 26, '#2c5156', 2, 1); t.poly([[4, 18], [31, 2], [58, 18]], '#4b7d78'); for (let x = 4; x <= 58; x += 6) t.line(x, 44, x, 18, 0.8, m, 3); for (let x = 4; x <= 58; x += 6) t.line(x, 18, 31, 2, 0.6, m, 3.5); t.line(4, 31, 58, 31, 0.7, m, 3);
      t.x.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 8; k++) t.x.fillRect(r.range(6, 54) * 3, r.range(6, 40) * 3, r.range(3, 7) * 3, r.range(3, 6) * 3); t.x.globalCompositeOperation = 'source-over'; canopy(30, 28, 22, 22, 10, 2.5, 5, leaf); t.grain(0.3, 4, seed, 0.3); break; }
    case 'airship': { const c = pick(rust.concat(['#5c5a50'])); t.ell(62, 22, 56, 17, c, 14); for (let x = 12; x < 112; x += 9) t.line(x, 7, x + r.range(-2, 2), 37, 0.8, shadeHex(c, 0.65), 15);
      t.x.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 6; k++) t.ell(r.range(20, 100), r.range(10, 30), r.range(4, 10), r.range(3, 7), '#000'); t.x.globalCompositeOperation = 'source-over';
      t.rect(44, 38, 34, 12, pick(metal), 6, 1.4); for (let x = 47; x < 76; x += 6) t.rect(x, 41, 4, 4, '#101414', 7); t.line(46, 38, 40, 30, 0.8, '#2a2a2a', 6); t.line(76, 38, 82, 30, 0.8, '#2a2a2a', 6); t.poly([[108, 20], [122, 8], [122, 32]], shadeHex(c, 0.8)); t.speck(30, rust, 0.8, 2, 0.2, false); if (K.vine) t.speck(30, K.vine, 0.8, 2, 16, false); t.grain(0.4, 4, seed, 0.4); break; }
    case 'shrine': { const s = K.stone; t.rect(1, 40, 28, 8, s[0], 2, 1); t.rect(4, 34, 22, 7, s[1] || s[0], 3.5, 1); t.rect(9, 6, 12, 30, s[0], 4, 1.5); t.poly([[9, 6], [15, 0], [21, 6]], s[1] || s[0]); for (let y = 10; y < 32; y += 3) t.rect(12, y, 6, 1, '#1a1418', 3); t.ell(15, 8, 2.2, 2.2, pick(K.glow), 5); t.grain(0.3, 4, seed, 0.4); if (K.moss) t.speck(12, K.moss, 0.5, 1.2, 4, false); break; }
    case 'radiomast': { const c = pick(metal); for (let y = H; y > 8; y -= 7) { t.line(W / 2 - 4, y, W / 2 + 4, y - 7, 0.6, c, 1.6); t.line(W / 2 + 4, y, W / 2 - 4, y - 7, 0.6, c, 1.6); } t.line(W / 2 - 4, H, W / 2 - 4, 8, 1, c, 1.6); t.line(W / 2 + 4, H, W / 2 + 4, 8, 1, c, 1.6); for (const x of [2, W - 2]) t.line(W / 2, 30, x, H, 0.3, '#3a3f44', 1); t.rect(W / 2 - 1, 2, 2, 7, '#7a2e22', 2); t.ell(W / 2, 2, 1.4, 1.4, '#c8783a', 3); for (const y of [40, 70]) t.rect(W / 2 - 6, y, 12, 3, pick(K.sign), 2); t.grain(0.3, 4, seed, 0.2); break; }
    case 'lifttower': { const c = pick(rust.concat(metal)); for (const x of [6, W - 6]) t.line(x, H, x, 6, 1.6, c, 1.8); for (let y = H - 4; y > 8; y -= 8) { t.line(6, y, W - 6, y - 8, 0.6, c, 1.6); t.line(W - 6, y, 6, y - 8, 0.6, c, 1.6); } t.rect(3, 2, W - 6, 6, pick(metal), 2.4, 1); t.ell(W / 2, 5, 3, 3, '#2a2a2a', 3); t.line(W / 2, 8, W / 2, H - 22, 0.4, '#2a2520', 2.6);
      t.rect(W / 2 - 7, H - 22, 14, 16, pick(metal), 1.6, 0.6); t.rect(W / 2 - 5, H - 19, 10, 10, '#101414', 2); t.rect(W / 2 - 1, H - 26, 2, 3, '#ffb040', 3); t.grain(0.35, 4, seed, 0.3); break; }
    case 'liftpad': { const m = pick(metal); t.rect(3, 12, 28, 12, m, 1.2, 0.8); for (let x = 5; x < 30; x += 3) t.rect(x, 13, 1, 10, shadeHex(m, 0.7), 1.4); for (const x of [4, 29]) { t.line(x, 14, x, 2, 1, pick(rust), 1.6); t.rect(x - 1, 1, 2, 2, '#ffb040', 2); } t.line(4, 3, 29, 3, 0.6, pick(rust), 1.8); t.grain(0.35, 3, seed, 0.3); break; }
    case 'statue': { const s = K.stone; t.rect(6, 76, 30, 16, pick(s), 4, 1.4); t.poly([[14, 76], [16, 40], [26, 40], [28, 76]], pick(s)); t.hrect(14, 40, 14, 36, 5, 3); t.poly([[12, 44], [21, 26], [30, 44]], pick(s)); t.ell(21, 20, 6, 7, pick(s), 6); t.x.globalCompositeOperation = 'destination-out'; t.poly([[24, 12], [32, 22], [28, 30], [30, 14]], '#000'); t.x.globalCompositeOperation = 'source-over';
      t.line(12, 44, 4, 60, 3, pick(s), 4); t.line(30, 44, 36, 30, 3, pick(s), 4); t.grain(0.45, 4, seed, 0.6); t.speck(10, ['#1a1418'], 2, 4, 0.8, false, 'crack'); if (K.vine) t.speck(24, K.vine, 0.8, 2, 5, false); t.speck(10, ['#6a6e6a'], 0.4, 1, 0, false); break; }
    // ---- the dream's flora
    case 'birch': { const b = '#e8e4d4'; t.rect(W / 2 - 1.5, 18, 3, H - 18, b, 1.6, 0.6); for (let y = 20; y < H - 2; y += r.range(3, 6)) t.rect(W / 2 - 1.5, y, r.range(1.5, 3), 0.8, '#2a2520', 1.8); t.line(W / 2, 30, W / 2 - 6, 22, 0.8, b, 1.6); t.line(W / 2, 26, W / 2 + 6, 18, 0.8, b, 1.6); canopy(W / 2, 16, 26, 10, 12, 2.6, 5, leaf); t.speck(30, [leaf[leaf.length - 1], '#d8e4a0'], 0.3, 0.7, 0.3, false); break; }
    case 'maple': { t.rect(W / 2 - 2, 26, 4, H - 26, pick(bark), 1.8, 0.8); t.line(W / 2, 34, W / 2 - 6, 26, 1.4, pick(bark), 1.2); t.line(W / 2, 32, W / 2 + 7, 24, 1.4, pick(bark), 1.2); canopy(W / 2, 17, 34, 14, 11, 3.5, 6.5, ['#e05a3a', '#ff8a5a', '#ffd23f', '#c0502a', '#a8522e'].filter((c) => c)); t.speck(30, ['#ffd23f', '#e05a3a'], 0.3, 0.7, 0.3, false); break; }
    case 'blossom': { t.rect(W / 2 - 2, 26, 4, H - 26, pick(bark), 1.8, 0.8); t.line(W / 2, 32, W / 2 - 9, 22, 1.6, pick(bark), 1.2); t.line(W / 2, 30, W / 2 + 9, 20, 1.6, pick(bark), 1.2); canopy(W / 2, 17, 38, 15, 10, 3.5, 6.5, K.blossom || ['#f5b5cc', '#f28aa8']); t.speck(40, ['#f6f0e2', '#f28aa8'], 0.3, 0.7, 0.4, false); break; }
    case 'spirittree': { const bx = W / 2; t.poly([[bx - 10, H], [bx - 5, 52], [bx + 5, 52], [bx + 11, H]], pick(bark)); t.hrect(bx - 10, 52, 20, H - 52, 4, 3); for (const [x, y] of [[bx - 14, H - 2], [bx + 15, H - 2]]) t.line(bx, H - 8, x, y, 2.6, pick(bark), 1.5);
      canopy(bx, 32, 70, 30, 22, 5, 10, leaf); for (let k = 0; k < 26; k++) t.ell(bx + r.range(-30, 30), r.range(10, 50), 1.4, 1.4, pick(K.glow), 9); t.speck(40, [leaf[leaf.length - 1]], 0.4, 1, 0.3, false); for (let k = 0; k < 8; k++) { const x = bx + r.range(-24, 24); t.line(x, r.range(30, 44), x + r.range(-1, 1), r.range(54, 70), 0.6, pick(K.vine || leaf), 6); } break; }
    case 'lanterntree': { t.rect(W / 2 - 2, 26, 4, H - 26, pick(bark), 1.8, 0.8); canopy(W / 2, 17, 30, 13, 10, 3.5, 6, leaf); for (let k = 0; k < 7; k++) { const x = W / 2 + r.range(-13, 13), y = r.range(22, 32); t.line(x, y - 4, x, y, 0.3, '#2a2520', 4); t.ell(x, y + 1.4, 1.5, 2, pick(['#ffd23f', '#ff8a5a', '#fff6c8']), 5); } break; }
    case 'glowshroom': for (let k = 0; k < 5; k++) { const x = r.range(4, 18), h = r.range(5, 14), c = pick(K.glow.concat(K.fungCap)); t.rect(x - 0.6, 19 - h, 1.2, h, K.fungStem, 1.2); t.ell(x, 19 - h, r.range(2, 3.6), r.range(1.2, 2), c, 3); t.ell(x - 0.5, 18.6 - h, 0.8, 0.5, '#fff6c8', 3.4); } break;
    case 'bamboo': for (let k = 0; k < 6; k++) { const x = r.range(4, 18), c = pick(['#88cb70', '#6aa65a', '#a8cf6a', '#4c8a4c']); t.line(x, H, x + r.range(-1.5, 1.5), r.range(2, 12), 1.6, c, 1.4); for (let y = H - 6; y > 8; y -= r.range(6, 9)) { t.rect(x - 1, y, 2, 0.7, shadeHex(c, 0.7), 1.6); if (r.chance(0.4)) t.line(x, y, x + r.sign() * r.range(3, 6), y - r.range(2, 4), 0.8, pick(leaf), 1.6); } } break;
    case 'flowerbush': for (let k = 0; k < 8; k++) { const rr = r.range(2.2, 3.6); t.ell(9 + r.range(-4, 4), 8 + r.range(-2, 2), rr, rr * 0.8, pick(leaf), rr); } t.speck(14, K.flower, 0.6, 1, 2.6, false); break;
    case 'mossrock': { t.ell(W / 2, H * 0.6, W * 0.45, H * 0.38, pick(stone), H * 0.5); t.ell(W * 0.45, H * 0.45, W * 0.3, H * 0.25, pick(stone), H * 0.6, 'base'); t.grain(0.35, 4, seed, 0.6); t.speck(24, K.moss || leaf, 0.8, 2, H * 0.7, false); break; }
    // ---- landmarks
    case 'fountain': { const s2 = K.stone; t.ell(20, 28, 18, 6, s2[0], 3); t.ell(20, 27, 15, 4.5, '#3a9ab8', 3.2); t.ell(16, 26, 4, 1, '#c8f0f0', 3.4); t.rect(17, 10, 6, 17, s2[1] || s2[0], 4, 1); t.ell(20, 10, 7, 2.4, s2[0], 5); for (let k = 0; k < 5; k++) t.line(20, 6, 20 + (k - 2) * 3, 12 + r.range(0, 4), 0.5, '#c8f0f0', 6); t.speck(20, K.moss || ['#4c8a4c'], 0.5, 1.2, 4, false); t.grain(0.35, 4, seed, 0.4); break; }
    case 'rootarch': { const s2 = K.stone; t.rect(4, 14, 9, 38, s2[0], 5, 1.2); t.rect(37, 14, 9, 38, s2[0], 5, 1.2); t.rect(2, 8, 46, 9, s2[1] || s2[0], 6, 1.2); for (let k = 0; k < 9; k++) { let x = r.range(2, 48), y = 8; for (let q = 0; q < 6; q++) { const nx = x + r.range(-3, 3), ny = y + r.range(4, 8); t.line(x, y, nx, ny, r.range(1, 2.4), pick(bark), 7); x = nx; y = ny; } } t.speck(26, K.moss || leaf, 0.8, 2, 7, false); t.grain(0.35, 4, seed, 0.5); break; }
    case 'foxstatue': { const s2 = K.stone; t.rect(3, 26, 20, 8, s2[0], 3, 1); t.ell(13, 20, 6, 5, s2[1] || s2[0], 5); t.ell(16, 12, 4, 4, s2[1] || s2[0], 6); t.poly([[13, 9], [14, 3], [16, 8]], s2[0]); t.poly([[17, 8], [19, 3], [20, 9]], s2[0]); t.line(8, 22, 3, 14, 3, s2[1] || s2[0], 5); t.grain(0.4, 4, seed, 0.5); t.speck(10, K.moss || leaf, 0.6, 1.4, 5, false); break; }
    case 'lanternshrine': { const s2 = K.stone; t.rect(4, 28, 14, 6, s2[0], 2, 1); t.rect(8, 12, 6, 16, s2[1] || s2[0], 3, 1); t.poly([[2, 13], [11, 5], [20, 13]], pick(K.roof || s2)); t.rect(8.5, 14, 5, 6, '#ffd23f', 5); t.grain(0.35, 4, seed, 0.4); break; }
    case 'obelisk': { const s2 = K.stone; t.poly([[4, 58], [6, 8], [9, 2], [12, 8], [14, 58]], pick(s2)); t.hrect(4, 2, 10, 56, 5, 3); for (let y = 14; y < 54; y += 5) for (let x = 6; x < 13; x += 3) if (r.chance(0.6)) t.rect(x, y, 1.4, 2, pick(K.glow), 6); t.grain(0.4, 4, seed, 0.5); break; }
    case 'cairn': for (let k = 0; k < 9; k++) { const y = 28 - k * 2.8, w = 18 - k * 1.6; t.ell(11 + r.range(-1, 1), y, w / 2, 2.2, pick(K.stone), 3 + k); } t.line(11, 6, 11, 0, 0.6, pick(bark), 9); t.rect(11, 0, 5, 3, pick(K.cloth), 9); break;
    case 'urn': { const c = pick(['#a35a3a', '#7e4a36', '#c8723e', '#956539']); t.ell(8, 13, 6.5, 7, c, 4); t.rect(5, 4, 6, 3, shadeHex(c, 0.8), 3); t.rect(3, 12, 10, 1, shadeHex(c, 0.6), 4); t.speck(8, ['#e5c689', '#3c2a2a'], 0.4, 0.9, 4, false); break; }
    case 'crystalheart': for (const [x, h, w, ci] of [[26, 56, 10, 0], [14, 36, 6, 1], [38, 40, 7, 2], [20, 22, 4, 3], [33, 24, 4, 0], [8, 18, 3, 2]]) { const c = (K.crystal || ['#9ff0d8'])[ci % (K.crystal || ['#9ff0d8']).length]; t.poly([[x - w, 60], [x, 60 - h], [x + w, 60]], c); t.hrect(x - w, 60 - h, w * 2, h, 6, 4); t.line(x - w * 0.3, 60, x, 60 - h, 0.6, '#ffffff', 7); } break;
    case 'dragonbones': { const b = K.bone || ['#e0d0ff', '#6e7c96']; let px = 8, py = 40; for (let k = 0; k < 20; k++) { const nx = px + 4.2, ny = 40 - Math.sin(k / 19 * 3.14) * 18; t.line(px, py, nx, ny, 2.2, b[0], 3); if (k > 3 && k < 16 && k % 2 === 0) { t.line(nx, ny, nx - 2, ny + 12, 1.2, b[0], 2.6); t.line(nx, ny, nx + 1, ny - 8, 1, b[1] || b[0], 3); } px = nx; py = ny; } t.ell(88, 40, 7, 5, b[0], 4); t.rect(86, 38, 2, 2, '#06070a', 4); t.line(92, 42, 96, 46, 1.4, b[0], 3); break; }
    case 'moonpool': { const s2 = K.stone; t.ell(23, 12, 22, 9, s2[0], 2); t.ell(23, 12, 18, 7, '#0c0e14', 2); t.ell(23, 11, 4, 1.6, '#e0d0ff', 2.4); for (let k = 0; k < 14; k++) t.ell(23 + r.range(-15, 15), 12 + r.range(-5, 5), 0.4, 0.4, '#ffffff', 2.2); break; }
    case 'windtemple': { const s2 = K.stone; t.rect(4, 56, 56, 9, s2[0], 2, 1); for (const x of [8, 20, 32, 44, 56]) { t.rect(x - 2.5, 18, 5, 38, s2[1] || s2[0], 5, 1); t.rect(x - 3.5, 16, 7, 3, s2[0], 6, 0.6); } t.poly([[2, 18], [32, 2], [62, 18]], pick(K.roof || s2)); t.hrect(2, 2, 60, 16, 7, 6); for (let k = 0; k < 6; k++) t.line(10 + k * 9, 20, 10 + k * 9 + r.range(-2, 2), r.range(28, 40), 0.6, pick(K.cloth), 7); t.speck(16, K.vine || leaf, 0.6, 1.4, 6, false); t.grain(0.3, 4, seed, 0.4); break; }
    case 'starharp': { const s2 = K.stone; t.rect(6, 62, 32, 7, s2[0], 2, 1); t.line(10, 62, 12, 6, 3, s2[1] || s2[0], 5); t.line(12, 6, 36, 18, 3, s2[1] || s2[0], 5); t.line(36, 18, 34, 62, 2.4, s2[0], 5); for (let k = 0; k < 8; k++) { const x0 = 14 + k * 2.6, y0 = 7 + k * 1.3; t.line(x0, y0, x0 - 0.4, 61, 0.35, pick(K.glow), 6); } t.speck(10, K.glow, 0.5, 1, 7, false); break; }
    case 'floatbell': { t.line(18, 0, 18, 10, 0.6, '#3a3f44', 4); t.poly([[8, 38], [10, 14], [18, 10], [26, 14], [28, 38]], '#a08060'); t.hrect(8, 10, 20, 28, 6, 6); t.rect(6, 36, 24, 3, '#7a5a40', 5); t.ell(18, 41, 3, 2.4, '#5a4232', 4); t.speck(10, ['#3aa08a', '#4c8a4c'], 0.6, 1.4, 6, false); t.rect(6, 56, 24, 7, pick(K.stone), 2, 1); break; }
    case 'nest': { t.ell(11, 8, 10, 4, pick(bark), 2); t.ell(11, 7, 8, 2.6, '#2a2520', 1.5); for (let k = 0; k < 3; k++) t.ell(8 + k * 3, 6.6, 1.4, 1.1, pick(['#c8f0f0', '#f6f0e2', '#8fb2f0']), 2.4); t.speck(10, [pick(bark)], 0.4, 1, 3, false, 'blade'); break; }
    case 'treehouse': { const pl = K.plank; t.rect(6, 22, 42, 26, pick(pl), 3, 1); for (let x = 7; x < 48; x += 3) t.rect(x, 22, 0.6, 26, shadeHex(pick(pl), 0.7), 3.2); t.poly([[2, 23], [27, 4], [52, 23]], pick(K.roof)); t._hRegion(2, 4, 52, 23, (x, y) => { const e = 1 - Math.abs(x - 27) / 25; return y > 4 + (1 - e) * 19 ? 4 + e * 6 : undefined; }); t.rect(23, 34, 8, 14, '#140e0a', 3); t.rect(12, 28, 6, 6, K.window || '#ffd23f', 4); t.rect(36, 28, 6, 6, K.window || '#ffd23f', 4); t.speck(20, leaf, 0.8, 2, 7, false); break; }
    case 'chest': case 'chestopen': { const c = '#7a4a24', gold = '#e8c050'; t.rect(1.5, 6, 13, 7, c, 2, 0.6); t.rect(1.5, 9, 13, 0.9, gold, 2.5); t.rect(7, 8, 2, 2.5, gold, 3); if (type === 'chest') { t.rect(1.5, 2.5, 13, 4, shadeHex(c, 1.15), 3, 0.6); t.rect(1.5, 2.5, 13, 0.8, gold, 3.2); } else { t.rect(1.5, 1, 13, 2.4, shadeHex(c, 0.6), 2.5); t.rect(2.5, 6, 11, 2, '#ffd23f', 1); } t.grain(0.3, 3, seed, 0.2); break; }
    case 'cavemouth': { const s2 = K.stone; t.ell(20, 22, 19, 16, pick(s2), 10); t.ell(20, 24, 12, 11, '#06070a', 2); t.rect(8, 24, 24, 10, '#06070a', 1); t.grain(0.45, 4, seed, 0.7); t.speck(12, K.moss || ['#285a52'], 0.6, 1.4, 9, false); t.speck(4, K.glow, 0.4, 0.7, 3, false); break; }
    case 'floatrock': { t.poly([[2, 8], [24, 8], [18, 18], [13, 24], [8, 17]], pick(stone)); t.hrect(2, 8, 22, 16, 4, 4); t.ell(13, 7, 11, 3, pick(leaf), 5); t.speck(8, K.flower || leaf, 0.5, 1, 6, false); for (let k = 0; k < 3; k++) { const x = r.range(8, 18); t.line(x, 18, x, r.range(20, 24), 0.5, pick(K.vine || leaf), 3); } break; }
    case 'basket': { t.line(11, 0, 11, 14, 0.5, '#3e352b', 2); t.line(4, 14, 11, 4, 0.4, '#3e352b', 2); t.line(18, 14, 11, 4, 0.4, '#3e352b', 2); t.rect(3, 14, 16, 14, pick(K.plank), 2, 0.8); for (let y = 16; y < 28; y += 2.4) t.line(3, y, 19, y, 0.6, shadeHex(pick(K.plank), 0.7), 2.4); t.rect(3, 13, 16, 1.4, pick(bark), 3); t.ell(11, 4, 2, 2, '#ffd23f', 4); break; }
    case 'headframe': { const c = pick(metal.concat(K.plank)); t.line(4, 46, 10, 4, 1.4, c, 2); t.line(26, 46, 20, 4, 1.4, c, 2); t.line(8, 30, 22, 30, 1, c, 2); t.line(7, 18, 23, 18, 1, c, 2); t.ell(15, 4, 5, 5, '#2a2a2a', 3); t.ell(15, 4, 3, 3, pick(rust), 3.4); t.line(15, 6, 15, 46, 0.4, '#2a2520', 2.6); t.rect(9, 38, 12, 8, pick(K.plank), 2.4, 0.6); t.rect(14, 36, 2, 2, '#ffb040', 3); t.grain(0.35, 4, seed, 0.3); break; }
  }
  return t.finish(F.pal, { outline: true, dither: 0.5, amb: 0.42, dif: 0.78, hs: 0.8 });
}
// a house, weathered and patched: planks or logs or mud or concrete, a roof of tin or thatch or snow,
// a door, a window with a little light in it maybe, rust and moss and a stovepipe
function villageHouse(t, type, K, r, W, H) {
  const pick = (a) => r.pick(a), base = 14, wallTop = type === 'bunker' ? 8 : type === 'adobe' ? 12 : 18, x0 = 4, x1 = W - 4;
  const wallC = type === 'adobe' ? pick(K.concrete) : type === 'bunker' ? pick(K.concrete) : pick(K.plank);
  t.rect(x0, wallTop, x1 - x0, H - wallTop - 1, wallC, 3, 1.2);
  if (type === 'loghut') for (let y = wallTop + 1; y < H - 1; y += 3) t.line(x0, y, x1, y, 2.4, pick(K.plank), 3.2);
  else if (type === 'shack' || type === 'cottage') for (let x = x0 + 1; x < x1; x += r.range(2.5, 4)) t.rect(x, wallTop, 0.6, H - wallTop - 1, shadeHex(wallC, r.range(0.6, 0.85)), 2.6);
  if (type === 'cottage') t.rect(x0, H - 10, x1 - x0, 9, pick(K.stone), 3.4, 0.8);
  if (type === 'bunker') { for (let k = 0; k < 8; k++) t.ell(x0 + r.range(0, x1 - x0), H - 3, 3, 2, pick(K.cloth), 3.5); t.rect(x0 + 6, wallTop + 6, x1 - x0 - 12, 2.4, '#0a0a0c', 3); }
  // roof
  const rc = pick(type === 'loghut' && K.snow ? K.snow : K.roof);
  if (type === 'adobe' || type === 'bunker') { t.rect(x0 - 1, wallTop - 2, x1 - x0 + 2, 3, shadeHex(rc, 0.9), 4, 0.6); if (type === 'adobe') { t.poly([[x0 + 4, wallTop - 1], [x0 + 14, wallTop - 6], [x0 + 24, wallTop - 1]], pick(K.tarp)); t.line(x0 + 14, wallTop - 6, x0 + 14, wallTop + 10, 0.6, pick(K.plank), 3); } }
  else { t.poly([[x0 - 3, wallTop + 1], [W / 2, 2], [x1 + 3, wallTop + 1]], rc); t._hRegion(x0 - 3, 2, x1 + 3, wallTop + 1, (x, y) => { const e = 1 - Math.abs(x - W / 2) / (W / 2 + 3); return y > 2 + (1 - e) * (wallTop - 1) ? 4 + e * 6 : undefined; });
    if (type === 'shack') for (let x = x0 - 2; x < x1 + 2; x += 2.2) t.line(x, wallTop, W / 2 + (x - W / 2) * 0.1, 3 + Math.abs(x - W / 2) * 0.55, 0.5, shadeHex(rc, 0.7), 8);
    if (r.chance(0.6)) t.rect(r.range(x0, x1 - 8), r.range(5, wallTop - 4), r.range(5, 9), r.range(3, 5), pick(K.tarp), 9, 0.5); }
  // door and windows
  const dx = r.range(x0 + 4, x1 - 12); t.rect(dx, H - 13, 7, 12, '#140e0a', 2.2); t.rect(dx + 1, H - 12, 5, 11, shadeHex(pick(K.plank), 0.55), 2.4);
  for (let k = 0; k < 2; k++) { const wx = k ? r.range(dx + 10, x1 - 6) : r.range(x0 + 2, Math.max(x0 + 3, dx - 7)); if (wx + 5 > x1 || (k === 0 && dx - x0 < 9)) continue; const lit = r.chance(0.45); t.rect(wx, H - 22, 5, 5, lit ? K.window : '#101010', 2.8); t.rect(wx - 0.5, H - 22.5, 6, 0.8, pick(K.plank), 3.2); if (!lit && r.chance(0.5)) t.line(wx, H - 22, wx + 5, H - 17, 0.6, pick(K.plank), 3.4); }
  // stovepipe, rust, moss, clutter
  if (type !== 'adobe') { const sx = r.range(x0 + 4, x1 - 6); t.rect(sx, 0, 2.2, wallTop - 2, '#2a2a2a', 9); }
  t.speck(10, K.rust, 0.6, 1.6, 0.2, false); if (K.moss) t.speck(10, K.moss, 0.6, 1.6, 4, false); if (K.snow && type === 'loghut') t.speck(12, K.snow, 0.6, 1.4, 9, false);
  t.grain(0.45, 4, r.int(1, 9999), 0.4);
}

// small flat things stamped into the ground
export function paintDecal(type, fam, seed) {
  const F = FAMILY[fam], r = RNG(seed), K = F.col; let t;
  switch (type) {
    case 'tuft': t = new TB(8, 7, 4, seed); for (let k = 0; k < 9; k++) { const x = r.range(1.5, 6.5); t.line(x, 6.5, x + r.range(-1.5, 1.5), r.range(1, 4), 0.5, r.pick(K.leaf), 0.6); } break;
    case 'flowers': t = new TB(8, 6, 4, seed); for (let k = 0; k < 4; k++) t.ell(r.range(1.5, 6.5), r.range(1.5, 4.5), 0.8, 0.8, r.pick(K.flower), 0.8); break;
    case 'stones': t = new TB(8, 6, 4, seed); for (let k = 0; k < 4; k++) t.ell(r.range(1.5, 6.5), r.range(1.5, 4.5), r.range(0.7, 1.4), r.range(0.6, 1), r.pick(K.stone), 1); break;
    case 'bones': t = new TB(10, 6, 4, seed); t.line(2, 3, 8, r.range(2, 4), 0.9, K.bone[0], 0.6); t.ell(2, 3, 1, 1, K.bone[1] || K.bone[0], 0.6); t.ell(8, 3, 1, 1, K.bone[1] || K.bone[0], 0.6); break;
    case 'skull': t = new TB(7, 6, 4, seed); t.ell(3.5, 2.6, 2.4, 2, K.bone[0], 1.5); t.rect(2.2, 4, 2.6, 1.5, K.bone[1] || K.bone[0], 1); t.rect(2.2, 2.2, 0.9, 0.9, '#111', 0); t.rect(4, 2.2, 0.9, 0.9, '#111', 0); break;
    case 'puddle': t = new TB(14, 7, 4, seed); t.ell(7, 3.5, 6, 2.6, K.puddle, 0); t.ell(5, 3, 2, 0.6, shadeHex(K.puddle, 1.5), 0); return t.finish(F.pal, { light: false, dither: 0.5 });
    case 'oil': t = new TB(14, 8, 4, seed); t.ell(7, 4, 6, 3, '#141210', 0); t.ell(6, 3.5, 3, 1, '#3a2a4a', 0); return t.finish(F.pal, { light: false, dither: 0.6 });
    case 'leaves': t = new TB(9, 7, 4, seed); for (let k = 0; k < 6; k++) t.ell(r.range(1.5, 7.5), r.range(1.5, 5.5), 0.9, 0.6, r.pick(K.litter), 0.4); break;
    case 'crack': t = new TB(12, 10, 4, seed); { let px = r.range(2, 4), py = r.range(2, 8), a = r.range(-0.5, 0.5); for (let k = 0; k < 5; k++) { const nx = px + Math.cos(a) * 2, ny = py + Math.sin(a) * 2; t.line(px, py, nx, ny, 0.5, '#0c0c0c', -0.5); px = nx; py = ny; a += r.range(-0.8, 0.8); } } return t.finish(F.pal, { light: false, dither: 0.4 });
    case 'glowmoss': t = new TB(8, 6, 4, seed); for (let k = 0; k < 5; k++) t.ell(r.range(1.5, 6.5), r.range(1.5, 4.5), 0.7, 0.6, r.pick(K.glow), 0.5); return t.finish(F.pal, { light: false, dither: 0.3 });
    case 'rubble': t = new TB(12, 8, 4, seed); for (let k = 0; k < 8; k++) t.rect(r.range(1, 9), r.range(2, 6), r.range(1, 2.5), r.range(0.8, 1.8), r.pick(K.concrete), 1, 0.3); break;
    case 'lane': t = new TB(12, 3, 4, seed); t.rect(1, 1, 10, 1, K.lane, 0); t.grain(0.6, 2, seed); return t.finish(F.pal, { light: false, dither: 0.8 });
    case 'crops': t = new TB(16, 8, 4, seed); for (let y = 1; y < 8; y += 2.4) for (let x = 1; x < 15; x += 1.3) if (r.chance(0.7)) t.line(x, y + 1.6, x + r.range(-0.4, 0.4), y, 0.5, r.pick(K.leaf.concat(K.litter)), 0.8); break;
    default: t = new TB(6, 6, 4, seed); t.ell(3, 3, 2, 2, K.stone[0], 1);
  }
  return t.finish(F.pal, { dither: 0.45, amb: 0.5, dif: 0.6 });
}

// a cloud: soft heaped puffs, seen from above (laid flat under the islands, drifting)
export function paintCloud(seed) {
  const W = 112, H = 72, t = new TB(W, H, 2, seed, 2), r = RNG(seed), cols = ['#f6f0e2', '#ffffff', '#e8e4f0', '#f5e6ec'];
  for (let k = 0; k < 18; k++) { const a = r.range(0, 6.283), d = r.range(0, 1) ** 0.7; t.ell(W / 2 + Math.cos(a) * d * W * 0.34, H / 2 + Math.sin(a) * d * H * 0.3, r.range(9, 22) * (1.1 - d * 0.4), r.range(7, 15) * (1.1 - d * 0.4), r.pick(cols), r.range(6, 14) * (1.2 - d)); }
  return t.finish(FAMILY.dream.pal, { dither: 0.6, amb: 0.7, dif: 0.45, hs: 1.2 });
}

// a soft dithered shadow ellipse (drawn under things, as a decal)
const SH = new Map();
export function shadowTex(w, h) {
  const key = `${w}|${h}`; if (SH.has(key)) return SH.get(key);
  const c = mk(w, h), x = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) { const d2 = ((X + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2; if (d2 < 1 && bay(X, y) + 0.5 < (1 - d2) * 1.1 + 0.15) { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(X, y, 1, 1); } }
  SH.set(key, c); return c;
}

// ------------------------------------------------ animals: side-on (facing right), four frames each
// ai: walk (wander, flee), hop, swim (on water), flock (peck about, fly off when you come near), flutter (low,
// erratic: insects), soar (circling high), wade (slow, by water), drift (the sky's creatures), bat
const Q = (body, leg, neck, head, cols, o = {}) => ({ kind: 'quad', body, leg, neck, head, cols, ...o });
export const FAUNA = {
  // the forgotten world's
  deer: Q([13, 13, 7, 4], 9, [5, -8], [3.2, 2.2], ['#7a5a40', '#5e4430', '#a8936f'], { w: 26, h: 26, antler: 1, tail: 1, ai: 'walk', speed: 28 }),
  boar: Q([11, 8.5, 7, 4.6], 4.5, [5, 1], [3.6, 2.6], ['#3e352b', '#2a2520', '#544638'], { w: 22, h: 16, tusk: 1, bristle: 1, ai: 'walk', speed: 22 }),
  hound: Q([10.5, 9.5, 6.5, 3], 6.5, [5, -3], [3, 2], ['#544638', '#3e352b', '#6e5c47'], { w: 22, h: 17, tail: 2, mange: 1, ears: 1, ai: 'walk', speed: 32 }),
  horse: Q([15, 15, 9, 5], 11, [7, -9], [4.2, 2.4], ['#3e352b', '#2a2520', '#6e5c47'], { w: 32, h: 30, mane: 1, tail: 3, ribs: 1, ai: 'walk', speed: 26 }),
  cattle: Q([15, 12, 10, 5.5], 7, [6, -1], [3.6, 2.8], ['#8c765a', '#544638', '#d8d49c'], { w: 32, h: 24, horns: 1, tail: 1, ribs: 1, patches: 1, ai: 'walk', speed: 12, calm: 1 }),
  goat: Q([10, 10, 6, 3.6], 6.5, [4, -6], [2.8, 2], ['#9ca09a', '#767c7c', '#544638'], { w: 20, h: 19, curl: 1, tail: 1, beard: 1, ai: 'walk', speed: 22 }),
  rat: Q([6, 4.4, 3.6, 2], 1.6, [3, 0.5], [1.8, 1.3], ['#3e352b', '#2a2520', '#6e5c47'], { w: 12, h: 7, tail: 4, small: 1, ai: 'walk', speed: 34 }),
  // the dream's: gentle, and some of them strange
  fox: Q([10, 9.5, 6, 3], 5.5, [5, -3], [3, 2], ['#e07a2a', '#a8522e', '#f6f0e2'], { w: 22, h: 16, tail: 6, ears: 1, ai: 'walk', speed: 30 }),
  wolf: Q([11, 10, 7, 3.4], 7, [5, -3], [3.2, 2.2], ['#767c7c', '#555b5f', '#c4c0b8'], { w: 24, h: 18, tail: 6, ears: 1, ai: 'walk', speed: 30 }),
  rabbit: Q([6, 6.4, 3.6, 2.6], 2, [2, -2.5], [2, 1.7], ['#a08060', '#7a5a40', '#f6f0e2'], { w: 12, h: 12, earsLong: 1, tail: 1, small: 1, ai: 'hop', speed: 30 }),
  moonhare: Q([6, 6.4, 3.6, 2.6], 2, [2, -2.5], [2, 1.7], ['#f6f0e2', '#c8c0d8', '#fff6c8'], { w: 12, h: 12, earsLong: 1, tail: 1, small: 1, glow: '#fff6c8', ai: 'hop', speed: 34 }),
  hedgehog: Q([6, 5.4, 4, 2.4], 1.4, [3, 0.8], [1.8, 1.3], ['#7a5a40', '#4a3628', '#c8a878'], { w: 12, h: 8, spikes: 1, small: 1, ai: 'walk', speed: 12 }),
  squirrel: Q([6, 6, 3.4, 2.2], 2.2, [2.4, -1.6], [1.8, 1.5], ['#c0502a', '#7a5a40', '#e8d4a8'], { w: 12, h: 12, tail: 7, ears: 1, small: 1, ai: 'hop', speed: 36 }),
  sheep: Q([12, 10, 7.5, 4.6], 5, [5, -2], [2.8, 2], ['#e8e4d4', '#a8a494', '#2a2520'], { w: 24, h: 18, wool: 1, tail: 1, ai: 'walk', speed: 14, calm: 1 }),
  cloudsheep: Q([12, 10, 8, 5], 4, [5, -2], [2.6, 2], ['#f6f0e2', '#c8f0f0', '#5a4232'], { w: 26, h: 18, wool: 2, tail: 1, glow: '#c8f0f0', ai: 'walk', speed: 10, calm: 1 }),
  cow: Q([15, 12, 10, 5.5], 7, [6, -1], [3.6, 2.8], ['#f6f0e2', '#2a2520', '#f5b5cc'], { w: 32, h: 24, horns: 1, tail: 1, patches: 2, ai: 'walk', speed: 12, calm: 1 }),
  kirin: Q([14, 14, 8, 4.4], 10, [6, -9], [3.8, 2.2], ['#f6f0e2', '#c8a8ff', '#fff6c8'], { w: 30, h: 30, mane: 2, tail: 3, horn: 1, glow: '#c8a8ff', ai: 'walk', speed: 26 }),
  stag: Q([14, 14, 8, 4.6], 10, [6, -9], [3.4, 2.4], ['#5a4232', '#3a2a1e', '#9ff0d8'], { w: 30, h: 32, antler: 2, tail: 1, glow: '#9ff0d8', ai: 'walk', speed: 24, big: 1 }),
  spiritfox: Q([10, 9.5, 6, 3], 5.5, [5, -3], [3, 2], ['#c8f0f0', '#8fb2f0', '#fff6c8'], { w: 22, h: 16, tail: 6, ears: 1, glow: '#9fd8ff', ai: 'walk', speed: 34 }),
  mothdeer: Q([13, 13, 7, 4], 9, [5, -8], [3.2, 2.2], ['#8a6aa8', '#5a4a7a', '#c8a8ff'], { w: 26, h: 26, antler: 1, wings: 1, tail: 1, glow: '#c8a8ff', ai: 'walk', speed: 20 }),
  mossling: Q([6, 6, 4.4, 3.6], 1.4, [1.4, -1], [2.4, 2.2], ['#4c8a4c', '#2f5d36', '#a8cf6a'], { w: 12, h: 10, small: 1, moss: 1, ai: 'hop', speed: 12 }),
  cat: Q([7, 6.6, 4.2, 2.2], 3.6, [3.4, -2.4], [2.2, 1.8], ['#544638', '#2a2520', '#e8d4a8'], { w: 14, h: 12, tail: 2, ears: 1, small: 1, ai: 'walk', speed: 28 }),
  dog: Q([9, 8.4, 5.4, 3], 5, [4, -3], [2.8, 2], ['#a08060', '#7a5a40', '#e8d4a8'], { w: 18, h: 15, tail: 2, ears: 1, ai: 'walk', speed: 30 }),
  raccoon: Q([8, 7, 5, 3], 3, [3.6, -0.6], [2.4, 1.8], ['#767c7c', '#3a3f44', '#e8e4d4'], { w: 16, h: 11, tail: 8, ears: 1, mask: 1, ai: 'walk', speed: 22 }),
  redpanda: Q([8, 7, 5, 3], 3, [3.6, -1], [2.4, 1.8], ['#c0502a', '#4a3628', '#f6f0e2'], { w: 16, h: 11, tail: 8, ears: 1, mask: 1, ai: 'walk', speed: 18 }),
  panda: Q([12, 10, 7.4, 5], 4.4, [4, -2], [3.4, 2.8], ['#f6f0e2', '#14201a', '#c8c0b8'], { w: 24, h: 18, panda: 1, tail: 1, ai: 'walk', speed: 8, calm: 1 }),
  jaguar: Q([13, 10, 8, 3.6], 6.5, [6, -2], [3.2, 2.4], ['#c8a040', '#7a5a40', '#2a2520'], { w: 28, h: 18, spots: 1, tail: 4, ears: 1, ai: 'walk', speed: 30 }),
  fennec: Q([8, 8, 4.6, 2.6], 4, [3.6, -2.4], [2.4, 1.8], ['#e5c689', '#c49456', '#fbf3dc'], { w: 16, h: 14, tail: 6, bigEars: 1, ai: 'walk', speed: 32 }),
  capybara: Q([11, 9, 7.6, 4.4], 3.6, [4.4, -0.4], [3.6, 2.6], ['#7a5a40', '#5a4232', '#a08060'], { w: 22, h: 14, ears: 1, ai: 'walk', speed: 10, calm: 1 }),
  bear: Q([15, 13, 10, 6.4], 6.4, [5, -1], [4, 3.4], ['#4a3628', '#2a2520', '#7a5a40'], { w: 32, h: 24, ears: 1, ai: 'walk', speed: 14, big: 1 }),
  // the low things
  lizard: { kind: 'low', w: 18, h: 7, cols: ['#956539', '#7b512e', '#c49456'], ai: 'walk', speed: 26 },
  gecko: { kind: 'low', w: 14, h: 6, cols: ['#88cb70', '#4c8a4c', '#ffd23f'], ai: 'walk', speed: 28 },
  salamander: { kind: 'low', w: 16, h: 6, cols: ['#e05a3a', '#7a2e22', '#ffd23f'], spots: 1, ai: 'walk', speed: 12 },
  axolotl: { kind: 'low', w: 16, h: 7, cols: ['#f5b5cc', '#f28aa8', '#e05a3a'], frills: 1, ai: 'swim', speed: 12 },
  frog: { kind: 'frog', w: 10, h: 8, cols: ['#4c8a4c', '#2f5d36', '#a8cf6a'], ai: 'hop', speed: 14 },
  treefrog: { kind: 'frog', w: 10, h: 8, cols: ['#88cb70', '#3c7442', '#e05a3a'], ai: 'hop', speed: 14 },
  crab: { kind: 'crab', w: 14, h: 9, cols: ['#e05a3a', '#a8522e', '#f6f0e2'], ai: 'walk', speed: 10 },
  snail: { kind: 'shell', w: 12, h: 9, cols: ['#c8a878', '#a08060', '#e8d4a8'], snail: 1, ai: 'walk', speed: 3, calm: 1 },
  tortoise: { kind: 'shell', w: 20, h: 12, cols: ['#5a4232', '#7a5a40', '#a8cf6a'], ai: 'walk', speed: 4, calm: 1 },
  turtle: { kind: 'shell', w: 20, h: 10, cols: ['#3aa08a', '#2f5d36', '#88cb70'], ai: 'swim', speed: 10, calm: 1 },
  beetle: { kind: 'bug', bug: 'beetle', w: 18, h: 11, cols: ['#1c2a2e', '#2c4a4e', '#3e7a70'], ai: 'walk', speed: 10, calm: 1 },
  // the birds
  crow: { kind: 'bird', w: 14, h: 12, cols: ['#1a171e', '#24202a', '#3c3644'], beak: '#3a3f44', ai: 'flock', speed: 60 },
  pigeon: { kind: 'bird', w: 14, h: 12, cols: ['#8296a6', '#64788a', '#c8a8ff'], beak: '#f5b5cc', ai: 'flock', speed: 55 },
  songbird: { kind: 'bird', w: 10, h: 9, cols: ['#e05a3a', '#7a5a40', '#ffd23f'], beak: '#ffd23f', small: 1, ai: 'flock', speed: 50 },
  swallow: { kind: 'bird', w: 12, h: 9, cols: ['#2a3644', '#141a22', '#e05a3a'], beak: '#2a2520', small: 1, fork: 1, ai: 'flock', speed: 70 },
  gull: { kind: 'bird', w: 16, h: 12, cols: ['#f6f0e2', '#b4b8ae', '#6a6e66'], beak: '#ffd23f', ai: 'flock', speed: 55 },
  parrot: { kind: 'bird', w: 14, h: 13, cols: ['#e05a3a', '#3aa08a', '#ffd23f'], beak: '#f6f0e2', ai: 'flock', speed: 50 },
  owl: { kind: 'bird', w: 14, h: 14, cols: ['#a08060', '#7a5a40', '#e8d4a8'], beak: '#e8c050', owl: 1, ai: 'soar', speed: 26 },
  eagle: { kind: 'bird', w: 24, h: 14, cols: ['#5a4232', '#3a2a1e', '#f6f0e2'], beak: '#ffd23f', big: 1, ai: 'soar', speed: 30 },
  emberbird: { kind: 'bird', w: 16, h: 13, cols: ['#ff8a5a', '#e05a3a', '#ffd23f'], beak: '#fff6c8', glow: '#ffb23a', ai: 'soar', speed: 40 },
  duck: { kind: 'bird', w: 14, h: 11, cols: ['#7a5a40', '#3c7442', '#f6f0e2'], beak: '#ffd23f', swim: 1, ai: 'swim', speed: 14 },
  swan: { kind: 'bird', w: 18, h: 16, cols: ['#f6f0e2', '#c8c0b8', '#2a2520'], beak: '#ff8a5a', swim: 1, swan: 1, ai: 'swim', speed: 10 },
  heron: { kind: 'wader', w: 18, h: 26, cols: ['#9ca09a', '#767c7c', '#e0d6b8'], beak: '#c4a24a', ai: 'wade', speed: 8 },
  crane: { kind: 'wader', w: 18, h: 28, cols: ['#f6f0e2', '#2a2520', '#e05a3a'], beak: '#6a6e66', ai: 'wade', speed: 8 },
  flamingo: { kind: 'wader', w: 18, h: 28, cols: ['#f28aa8', '#e05a3a', '#f5b5cc'], beak: '#2a2520', ai: 'wade', speed: 8 },
  bat: { kind: 'bat', w: 14, h: 8, cols: ['#24202a', '#1a171e', '#56405e'], ai: 'bat', speed: 40 },
  // the small fliers
  butterfly: { kind: 'bug', bug: 'butterfly', w: 12, h: 10, cols: ['#ffd23f', '#f28aa8', '#8fb2f0', '#b49be8', '#ff8a5a'], ai: 'flutter', speed: 16 },
  bee: { kind: 'bug', bug: 'bee', w: 8, h: 7, cols: ['#ffd23f', '#2a2520', '#f6f0e2'], ai: 'flutter', speed: 22 },
  dragonfly: { kind: 'bug', bug: 'dragonfly', w: 16, h: 9, cols: ['#3aa08a', '#8fb2f0', '#c8f0f0'], ai: 'flutter', speed: 30 },
  moth: { kind: 'bug', bug: 'moth', w: 18, h: 14, cols: ['#6e5c47', '#a8936f', '#e0d070'], glow: '#e0d070', ai: 'flutter', speed: 16 },
  firefly: { kind: 'bug', bug: 'firefly', w: 6, h: 6, cols: ['#2a2520', '#fff6c8', '#ffd23f'], glow: '#fff090', ai: 'flutter', speed: 10 },
  // the sky's creatures, drifting round the islands and over the dream
  jelly: { kind: 'sky', sky: 'jelly', w: 20, h: 30, cols: ['#c8f0f0', '#8fb2f0', '#f5b5cc'], glow: '#bfe6ff', ai: 'drift', speed: 6, scale: 1.6 },
  koi: { kind: 'sky', sky: 'koi', w: 22, h: 12, cols: ['#ff8a5a', '#f6f0e2', '#e05a3a'], glow: '#ffb08a', ai: 'drift', speed: 16 },
  manta: { kind: 'sky', sky: 'manta', w: 34, h: 18, cols: ['#2a6a8a', '#14201a', '#c8f0f0'], ai: 'drift', speed: 18, scale: 1.6 },
  dolphin: { kind: 'sky', sky: 'dolphin', w: 26, h: 14, cols: ['#8296a6', '#64788a', '#e6eef0'], ai: 'swim', speed: 26 },
  whale: { kind: 'sky', sky: 'whale', w: 96, h: 40, cols: ['#3a5a7a', '#24384c', '#c8d8e0'], ai: 'drift', speed: 14, scale: 2.6, big: 1 }
};
export function animalFrames(k, fam, seed) {
  const A = FAUNA[k], P = FAMILY[fam].pal, out = [];
  for (let f = 0; f < 4; f++) {
    const t = new TB(A.w, A.h, A.kind === 'sky' && A.sky === 'whale' ? 2 : 4, seed, A.big ? 6 : 4), r = t.r, C = A.cols, W = A.w, H = A.h, ph = (f / 4) * 6.283;
    if (A.kind === 'bird') {
      const fly = f < 2, up = f === 0, sm = A.small ? 0.7 : 1, bc = A.beak || '#3a3f44';
      if (fly) { t.ell(W * 0.5, H * 0.5, W * 0.28, H * 0.17, C[0], 2); t.ell(W * 0.78, H * 0.42, W * 0.14, H * 0.14, C[A.owl ? 0 : 1], 2); t.line(W * 0.88, H * 0.42, W * 0.98, H * 0.46, 0.7, bc, 2); t.poly(up ? [[W * 0.3, H * 0.45], [W * 0.55, 0], [W * 0.7, H * 0.45]] : [[W * 0.3, H * 0.55], [W * 0.55, H], [W * 0.7, H * 0.55]], C[1]); t.line(W * 0.24, H * 0.5, W * 0.04, H * (A.fork ? 0.4 : 0.58), 1.2 * sm, C[0], 1.5); if (A.fork) t.line(W * 0.24, H * 0.5, W * 0.04, H * 0.66, 0.8, C[0], 1.5); if (A.cols[2]) t.ell(W * 0.55, H * 0.56, W * 0.12, H * 0.08, C[2], 2.2); }
      else if (A.swim) { const bob = f === 3 ? 0.4 : 0; t.ell(W * 0.45, H * 0.72 + bob, W * 0.36, H * 0.2, C[0], 2); if (A.swan) { t.line(W * 0.72, H * 0.66, W * 0.82, H * 0.2, 1.6, C[0], 2.4); t.line(W * 0.82, H * 0.2, W * 0.95, H * 0.28, 1.2, A.beak, 2.4); t.ell(W * 0.8, H * 0.2, 1.4, 1.2, C[0], 2.6); } else { t.ell(W * 0.76, H * 0.5 + bob, W * 0.15, H * 0.17, C[1], 2.4); t.line(W * 0.88, H * 0.5 + bob, W * 0.99, H * 0.56 + bob, 1, bc, 2.4); } t.ell(W * 0.4, H * 0.66 + bob, W * 0.2, H * 0.08, C[2], 2.2); t.line(W * 0.1, H * 0.84, W * 0.9, H * 0.84, 0.5, '#c8f0f0', 1); }
      else { const hop = f === 3 ? 1 : 0; t.ell(W * 0.48, H * 0.58 - hop, W * 0.28, H * 0.22, C[0], 2); t.ell(W * 0.74, H * 0.42 - hop, W * 0.15, H * 0.16, C[A.owl ? 0 : 1], 2.4); t.line(W * 0.86, H * 0.42 - hop, W * 0.97, H * 0.48 - hop, 0.7, bc, 2); t.line(W * 0.22, H * 0.58 - hop, W * 0.03, H * 0.72 - hop, 1.2 * sm, C[0], 1.5); t.line(W * 0.44, H * 0.78 - hop, W * 0.42, H, 0.4, '#3a3f44', 1); t.line(W * 0.56, H * 0.78 - hop, W * 0.6, H, 0.4, '#3a3f44', 1); if (C[2]) t.ell(W * 0.52, H * 0.66 - hop, W * 0.14, H * 0.1, C[2], 2.2); if (A.owl) { t.rect(W * 0.7, H * 0.36 - hop, 1, 1, '#14201a', 3); t.rect(W * 0.8, H * 0.36 - hop, 1, 1, '#14201a', 3); } }
      t.rect(W * 0.8, H * 0.38, 0.6, 0.6, '#0b0d0a', 3);
    } else if (A.kind === 'wader') {
      const st = [0, 1, 0, -1][f]; t.line(8 + st, H - 1, 9, 15, 0.5, '#3a3f44', 1); t.line(10 - st, H - 1, 10, 15, 0.5, '#3a3f44', 1); t.ell(9.5, 13, 5, 3, C[0], 2.4); t.ell(8, 12.4, 3.5, 1.6, C[1], 2.6);
      t.line(12.5, 12, 14, 7, 1, C[0], 2); t.line(14, 7, 12.6, 3.4, 1, C[0], 2); t.ell(13.2, 3, 1.4, 1.1, C[2], 2.4); t.line(14.2, 3, 17.6, 3.8, 0.6, A.beak, 2); t.line(5, 13, 2.4, 15, 0.8, C[1], 2); t.rect(13.6, 2.6, 0.6, 0.6, '#0b0d0a', 3);
    } else if (A.kind === 'bat') {
      const up = f % 2 === 0; t.ell(W / 2, H / 2, 2, 2.4, C[0], 2); t.poly(up ? [[W / 2, H / 2], [0, 0], [2, H / 2], [4, H * 0.3]] : [[W / 2, H / 2], [0, H], [2, H / 2], [4, H * 0.8]], C[1]); t.poly(up ? [[W / 2, H / 2], [W, 0], [W - 2, H / 2], [W - 4, H * 0.3]] : [[W / 2, H / 2], [W, H], [W - 2, H / 2], [W - 4, H * 0.8]], C[1]); t.rect(W / 2 - 1, H / 2 - 1, 0.6, 0.6, '#ffd23f', 3);
    } else if (A.kind === 'bug') {
      const up = f % 2 === 0;
      if (A.bug === 'butterfly') { const c1 = C[(seed % 5)], c2 = C[(seed + 2) % 5]; t.ell(6, 5, 0.7, 3, '#2a2520', 2); t.poly(up ? [[6, 5], [0.5, 0.5], [2, 6]] : [[6, 5], [1, 5], [3, 9.5]], c1); t.poly(up ? [[6, 5], [11.5, 0.5], [10, 6]] : [[6, 5], [11, 5], [9, 9.5]], c1); t.ell(up ? 3 : 3, up ? 3 : 6.5, 1, 1, c2, 1); t.ell(up ? 9 : 9, up ? 3 : 6.5, 1, 1, c2, 1); }
      else if (A.bug === 'bee') { t.ell(4, 4.4, 2.8, 1.8, C[0], 2); t.rect(3, 3, 0.7, 3, C[1], 2.2); t.rect(4.6, 3, 0.7, 3, C[1], 2.2); t.ell(up ? 4 : 4.4, up ? 1.6 : 2.4, 1.8, 1, C[2], 1); t.ell(6.8, 4, 0.9, 0.9, C[1], 2); }
      else if (A.bug === 'dragonfly') { t.line(1, 5, 12, 4.6, 1, C[0], 2); t.ell(13, 4.4, 1.4, 1.2, C[0], 2.4); t.line(5, 4, up ? 3 : 4, up ? 0.5 : 2, 0.6, C[2], 1); t.line(6, 4, up ? 9 : 8, up ? 0.5 : 2, 0.6, C[2], 1); t.line(5, 5, up ? 3 : 4, up ? 8.5 : 7.4, 0.6, C[1], 1); t.line(6, 5, up ? 9 : 8, up ? 8.5 : 7.4, 0.6, C[1], 1); }
      else if (A.bug === 'firefly') { t.ell(3, 3, 1.2, 1.2, C[up ? 1 : 2], 1); t.rect(2.4, 1.6, 1.2, 0.6, C[0], 1.2); }
      else if (A.bug === 'moth') { t.ell(9, 7, 1.4, 4, C[0], 2.4); t.poly(up ? [[9, 6], [1, 1], [3, 9]] : [[9, 6], [2, 7], [5, 12]], C[1]); t.poly(up ? [[9, 6], [17, 1], [15, 9]] : [[9, 6], [16, 7], [13, 12]], C[1]); t.ell(up ? 4.5 : 5, up ? 4 : 8.5, 1.3, 1.3, C[2], 1); t.ell(up ? 13.5 : 13, up ? 4 : 8.5, 1.3, 1.3, C[2], 1); }
      else { const st = f % 2 ? 1 : -1; for (let k2 = 0; k2 < 3; k2++) { const x = 5 + k2 * 4; t.line(x, 7, x - 2 + st * (k2 % 2 ? 1 : -1), 10.5, 0.5, '#0b0d0a', 1); } t.ell(9, 6, 7, 3.6, C[1], 3.4); t.line(9, 2.6, 9, 9.4, 0.4, C[0], 3.6); t.ell(16, 6, 2, 1.7, C[0], 2.4); t.ell(7, 4.6, 2.5, 1, C[2], 4); }
    } else if (A.kind === 'sky') {
      if (A.sky === 'jelly') { const pul = Math.sin(ph) * 1.2; t.ell(10, 9, 8 + pul * 0.4, 7 - pul * 0.4, C[0], 6); t.ell(10, 11, 6, 2.4, C[1], 4); for (let k2 = 0; k2 < 6; k2++) { let px = 4 + k2 * 2.4, py = 14; for (let q = 0; q < 5; q++) { const nx = px + Math.sin(ph + q + k2) * 0.9, ny = py + 3; t.line(px, py, nx, ny, 0.5, q % 2 ? C[2] : C[0], 2); px = nx; py = ny; } } t.speck(6, ['#ffffff'], 0.4, 0.8, 7, false); }
      else if (A.sky === 'koi') { const sw = Math.sin(ph) * 1.4; t.ell(11, 6, 8, 3.4, C[1], 3); t.speck(5, [C[0], C[2]], 1, 2, 4, false); t.poly([[3, 6], [-0.5, 2 + sw], [-0.5, 10 + sw]], C[0]); t.poly([[10, 3.6], [13, 0.5], [15, 4]], C[0]); t.rect(17, 5, 0.8, 0.8, '#0b0d0a', 4); }
      else if (A.sky === 'manta') { const fl = Math.sin(ph) * 4; t.poly([[2, 9 + fl], [12, 6], [22, 6], [32, 9 + fl], [22, 12], [12, 12]], C[0]); t.hrect(2, 4, 30, 10, 3, 4); t.line(17, 11, 17 + Math.sin(ph) * 3, 18, 0.5, C[1], 2); t.ell(17, 8, 4, 2, C[2], 3.4); }
      else if (A.sky === 'dolphin') { const arc = Math.sin(ph) * 1.5; t.ell(13, 7 + arc * 0.3, 10, 3.6, C[0], 3); t.ell(14, 8.4 + arc * 0.3, 8, 1.8, C[2], 2.4); t.poly([[12, 4], [9, 0.5], [15, 3.6]], C[1]); t.poly([[4, 7], [0, 4 + arc], [0.5, 10 + arc]], C[1]); t.line(22, 7.6, 25.6, 8, 1, C[0], 2.4); t.rect(20, 6, 0.8, 0.8, '#0b0d0a', 4); }
      else { const tl = Math.sin(ph) * 5; t.ell(46, 20, 38, 13, C[0], 12); t.ell(50, 26, 32, 7, C[2], 8); t.poly([[10, 18], [-2, 10 + tl], [-2, 28 + tl]], C[1]); t.poly([[52, 28], [44, 38], [60, 32]], C[1]); for (let k2 = 0; k2 < 10; k2++) t.line(40 + k2 * 4, 28, 40 + k2 * 4, 32, 0.6, C[1], 9); t.rect(76, 17, 1.6, 1.6, '#0b0d0a', 13); t.speck(18, ['#e8e4d4', '#8a8e84'], 0.6, 1.4, 14, false); }
    } else if (A.kind === 'low') {
      const st = f % 2 ? 1 : -1; for (const x of [W * 0.3, W * 0.62]) { t.line(x, H * 0.6, x - 1.5 * st, H - 0.4, 0.6, C[1], 1); t.line(x + 1, H * 0.6, x + 1 + 1.5 * st, H - 0.4, 0.6, C[1], 1); }
      t.ell(W * 0.48, H * 0.55, W * 0.28, H * 0.26, C[0], 1.6); t.ell(W * 0.82, H * 0.48, W * 0.12, H * 0.22, C[0], 1.8); let px = W * 0.22, py = H * 0.55; for (let q = 0; q < 4; q++) { const nx = px - W * 0.06, ny = py + Math.sin(ph + q) * 0.4; t.line(px, py, nx, ny, 1.6 - q * 0.3, C[0], 1.2); px = nx; py = ny; }
      if (A.spots) t.speck(5, [C[2]], 0.4, 0.8, 2, false); if (A.frills) for (let q = 0; q < 3; q++) t.line(W * 0.78, H * 0.36, W * 0.72 + q, H * 0.08, 0.5, C[2], 2.2); t.rect(W * 0.88, H * 0.4, 0.6, 0.6, '#0b0d0a', 2.4);
    } else if (A.kind === 'frog') {
      const jump = f === 1 || f === 2, lift = jump ? 2 : 0; t.ell(5, 5 - lift, 4, 2.6, C[0], 2); t.ell(7.4, 3.6 - lift, 1.4, 1.2, C[0], 2.4); t.rect(7.6, 3 - lift, 0.8, 0.8, '#0b0d0a', 3); t.line(2, 6 - lift, jump ? 0 : 1, jump ? 7.8 : 7.6, 1, C[1], 1.4); t.line(6, 6 - lift, jump ? 8 : 7, 7.8, 0.8, C[1], 1.4); t.speck(3, [C[2]], 0.3, 0.6, 2.4, false);
    } else if (A.kind === 'crab') {
      const st = f % 2 ? 1 : -1; for (let q = 0; q < 3; q++) { t.line(4 + q * 2, 6, 2 + q * 2 + st, 8.6, 0.5, C[1], 1); t.line(8 + q * 2, 6, 10 + q * 2 - st, 8.6, 0.5, C[1], 1); } t.ell(7, 5, 5, 2.6, C[0], 2); t.ell(1.6, 3 + st * 0.3, 1.4, 1.2, C[0], 2); t.ell(12.4, 3 - st * 0.3, 1.4, 1.2, C[0], 2); t.rect(5.4, 2, 0.6, 1, '#0b0d0a', 2.4); t.rect(8, 2, 0.6, 1, '#0b0d0a', 2.4);
    } else if (A.kind === 'shell') {
      const st = f % 2 ? 0.6 : -0.6;
      if (A.snail) { t.ell(6, 7.6, 5.4, 1.4, C[2], 1); t.ell(7 + st * 0.3, 4.4, 3.6, 3.6, C[0], 3); for (let q = 0; q < 3; q++) t.ell(7 + st * 0.3, 4.4, 2.6 - q * 0.8, 2.6 - q * 0.8, q % 2 ? C[1] : C[0], 3.2); t.line(10.6, 7, 11.8, 4, 0.4, C[2], 2); }
      else { for (const x of [W * 0.25, W * 0.7]) t.line(x, H * 0.7, x + st, H - 0.4, 1.2, C[2], 1.2); t.ell(W * 0.5, H * 0.5, W * 0.38, H * 0.36, C[0], 4); for (let q = 0; q < 4; q++) t.ell(W * 0.3 + q * W * 0.13, H * 0.42, W * 0.06, H * 0.1, C[1], 4.4); t.ell(W * 0.92, H * 0.6, W * 0.08, H * 0.14, C[2], 2); t.rect(W * 0.95, H * 0.55, 0.6, 0.6, '#0b0d0a', 3); }
    } else {
      // a four-legged beast: legs swing out of phase, the body bobs, the head rides on a neck
      const [bx, by, rx, ry] = A.body, L = A.leg, bob = Math.abs(Math.sin(ph)) * 0.6, footY = H - 0.6, hipY = by + ry * 0.4 - bob;
      const leg = (x, p, c) => { const sw = Math.sin(ph + p) * (L * 0.32 + 0.5), kx = x + sw * 0.5; t.line(x, hipY, kx + sw * 0.25, hipY + L * 0.55, A.small ? 0.8 : 1.3, c, 1.4); t.line(kx + sw * 0.25, hipY + L * 0.55, x + sw, footY, A.small ? 0.7 : 1.1, c, 1.2); };
      leg(bx - rx * 0.6, 0, shadeHex(C[1], 0.8)); leg(bx + rx * 0.55, Math.PI, shadeHex(C[1], 0.8));
      const tl = A.tail;
      if (tl === 6 || tl === 7 || tl === 8) { const up = tl === 7 ? -1 : 0.2; t.ell(bx - rx - 2.4, by - (tl === 7 ? ry * 1.6 : 0) - bob, tl === 7 ? 2.4 : 3.2, tl === 7 ? 3.6 : 1.8, C[0], ry); if (tl === 6) t.ell(bx - rx - 4.6, by + up - bob, 1.2, 1, C[2], ry); if (tl === 8) for (let q = 0; q < 3; q++) t.rect(bx - rx - 4.4 + q * 1.6, by - 1.6 - bob, 0.7, 3, C[1], ry + 1); }
      else if (tl >= 4) { let px = bx - rx, py = by; for (let q = 0; q < 5; q++) { const nx = px - 1.4, ny = py + 0.5 + Math.sin(ph + q) * 0.3; t.line(px, py, nx, ny, 0.5, C[1], 1); px = nx; py = ny; } }
      else if (tl) t.line(bx - rx, by - ry * 0.4 - bob, bx - rx - 2 - tl, by + (tl === 2 ? -3 : 2) - bob + Math.sin(ph) * 0.6, tl === 3 ? 1.6 : 0.9, C[1], 1.4);
      if (A.wings) { t.poly([[bx, by - ry - bob], [bx - 8, by - ry - 7 + Math.sin(ph) * 2], [bx - 2, by - ry]], C[2]); t.poly([[bx + 2, by - ry - bob], [bx + 9, by - ry - 7 - Math.sin(ph) * 2], [bx + 4, by - ry]], C[2]); }
      t.ell(bx, by - bob, rx, ry, C[0], ry * 1.1);
      if (A.wool) { t.speck(A.wool === 2 ? 26 : 18, [C[0], shadeHex(C[0], 0.9), '#ffffff'], 1, 2.2, ry * 1.4, false); }
      else t.ell(bx - rx * 0.2, by + ry * 0.45 - bob, rx * 0.8, ry * 0.4, C[1], ry * 0.5);
      if (A.patches) t.speck(A.patches === 2 ? 6 : 4, A.patches === 2 ? [C[1]] : [C[2], C[1]], 1, 2.4, ry, false);
      if (A.panda) { t.ell(bx - rx * 0.5, by + ry * 0.2 - bob, rx * 0.35, ry * 0.8, C[1], ry * 1.1); t.ell(bx + rx * 0.5, by + ry * 0.2 - bob, rx * 0.3, ry * 0.8, C[1], ry * 1.1); }
      if (A.spots) t.speck(9, [C[2]], 0.5, 1, ry * 1.2, false);
      if (A.spikes) for (let q = 0; q < 9; q++) t.line(bx - rx * 0.8 + q * rx * 0.2, by - ry * 0.4 - bob, bx - rx * 0.9 + q * rx * 0.2 - 1, by - ry - 1.6 - bob, 0.5, C[1], ry * 1.2);
      if (A.ribs) for (let q = 0; q < 4; q++) t.line(bx - 2 + q * 1.6, by - ry * 0.4 - bob, bx - 2.6 + q * 1.6, by + ry * 0.4 - bob, 0.3, shadeHex(C[0], 0.7), ry * 1.3);
      if (A.mange) t.speck(5, [C[2], shadeHex(C[0], 0.6)], 0.6, 1.2, ry, false);
      if (A.moss) t.speck(8, ['#88cb70', '#2f5d36'], 0.5, 1.2, ry * 1.2, false);
      if (A.bristle) for (let q = 0; q < 6; q++) t.line(bx - rx * 0.6 + q * 1.8, by - ry - bob + 0.6, bx - rx * 0.6 + q * 1.8 + 0.6, by - ry - 1.2 - bob, 0.5, C[1], ry * 1.2);
      leg(bx - rx * 0.4, Math.PI, C[1]); leg(bx + rx * 0.75, 0, C[1]);
      const nx = bx + rx * 0.75 + A.neck[0], ny = by - ry * 0.3 + A.neck[1] - bob;
      t.line(bx + rx * 0.6, by - ry * 0.4 - bob, nx, ny, A.small ? 1.4 : 2.6, C[A.panda ? 0 : 0], ry);
      t.ell(nx + A.head[0] * 0.4, ny, A.head[0], A.head[1], C[0], ry);
      if (A.mask) t.rect(nx + A.head[0] * 0.2, ny - A.head[1] * 0.3, A.head[0] * 1.1, A.head[1] * 0.6, C[1], ry + 0.5);
      if (A.panda) { t.ell(nx + A.head[0] * 0.6, ny - 0.2, 1, 0.9, C[1], ry + 0.6); t.ell(nx - 0.6, ny - A.head[1] * 0.9, 1, 1, C[1], ry + 1); }
      t.rect(nx + A.head[0] * 0.5, ny - A.head[1] * 0.4, 0.8, 0.8, A.glow ? A.glow : '#0b0d0a', ry + 1);
      if (A.ears) t.line(nx - 0.6, ny - A.head[1] * 0.6, nx - 1, ny - A.head[1] - 1.6, 0.8, C[1], ry + 1);
      if (A.bigEars) { t.poly([[nx - 1.4, ny - A.head[1] * 0.5], [nx - 2.6, ny - A.head[1] - 4], [nx + 0.2, ny - A.head[1] * 0.6]], C[0]); }
      if (A.earsLong) { t.line(nx - 0.2, ny - A.head[1] * 0.6, nx - 1.6, ny - A.head[1] - 4, 0.9, C[0], ry + 1); t.line(nx + 0.6, ny - A.head[1] * 0.6, nx - 0.2, ny - A.head[1] - 4.2, 0.9, C[0], ry + 1); }
      if (A.mane) for (let q = 0; q < 5; q++) t.line(bx + rx * 0.6 + q * 1.2, by - ry * 0.6 - bob - q * 1.6, bx + rx * 0.6 + q * 1.2 - 1.2, by - ry * 0.6 - bob - q * 1.6 + 1.4, 0.8, A.mane === 2 ? C[1] : C[1], ry + 1);
      if (A.antler) { const big = A.antler === 2 ? 1.6 : 1; for (const sgn of [-1, 1]) { const ax = nx - 0.4 + sgn * 0.6, ay = ny - A.head[1]; t.line(ax, ay, ax - 2 * big + sgn, ay - 5 * big, 0.5, C[2], ry + 2); t.line(ax - 1.3 * big + sgn, ay - 3 * big, ax + 0.8 * big + sgn, ay - 6 * big, 0.4, C[2], ry + 2); t.line(ax - 1.6 * big + sgn, ay - 4 * big, ax - 4 * big + sgn, ay - 5.4 * big, 0.4, C[2], ry + 2); } }
      if (A.horn) t.line(nx + A.head[0] * 0.3, ny - A.head[1], nx + A.head[0] * 0.3 + 1, ny - A.head[1] - 4.4, 0.6, C[2], ry + 3);
      if (A.horns) { t.line(nx - 0.5, ny - A.head[1] + 0.4, nx - 3, ny - A.head[1] - 2.4, 0.7, C[2], ry + 2); t.line(nx + 0.6, ny - A.head[1] + 0.4, nx + 2.4, ny - A.head[1] - 2.6, 0.7, C[2], ry + 2); }
      if (A.curl) t.ell(nx - 1, ny - A.head[1], 1.4, 1.4, C[2], ry + 2);
      if (A.tusk) t.line(nx + A.head[0] * 1.2, ny + 0.6, nx + A.head[0] * 1.2 + 0.8, ny - 0.8, 0.5, '#e0d6b8', ry + 2);
      if (A.beard) t.line(nx + A.head[0] * 0.6, ny + A.head[1], nx + A.head[0] * 0.5, ny + A.head[1] + 1.6, 0.6, C[2], ry);
      if (A.glow) t.speck(5, [A.glow], 0.3, 0.6, ry * 1.6, false);
    }
    const right = t.finish(P, { outline: true, dither: 0.45, amb: A.glow ? 0.6 : 0.45, dif: 0.75, hs: 0.8 });
    out.push({ r: right, l: flipH(right) });
  }
  return out;
}

// ------------------------------------------------ the giant gardeners: colossi of bark and stone
// gone to moss, a lantern in one hand, antler-branches for a crown; four striding frames, big
export function giantFrames(seed) {
  const out = [], P = PALS.green;
  for (let f = 0; f < 4; f++) {
    const W = 64, H = 126, t = new TB(W, H, 3, seed, 8), r = t.r, bark = ['#3e352b', '#2a2520', '#544638', '#6e5c47'], moss = ['#384a28', '#4a5f30', '#2b3820', '#5f763a'], stone = ['#555b5f', '#767c7c', '#3a3f44'];
    const ph = (f / 4) * 6.283, sw = Math.sin(ph), cx = W / 2, hipY = 70 - Math.abs(Math.cos(ph)) * 1.5;
    const leg = (dx, s, c) => { const kneeX = cx + dx + s * 6, footX = cx + dx + s * 11; t.line(cx + dx, hipY, kneeX, hipY + 26, 7, c, 4); t.line(kneeX, hipY + 26, footX, H - 4, 6, c, 3.5); t.ell(footX + 1, H - 3, 6, 2.6, shadeHex(c, 0.8), 2); for (let k = 0; k < 3; k++) t.line(footX - 3 + k * 3, H - 2, footX - 5 + k * 4, H, 1, bark[1], 1); };
    leg(-6, -sw, bark[1]);
    // the far arm, hanging with the lantern
    const ax = cx - 13, ay = 34; t.line(ax, ay, ax - 4 - sw * 3, ay + 26, 5, bark[2], 3.5); t.line(ax - 4 - sw * 3, ay + 26, ax - 6 - sw * 5, ay + 46, 4, bark[2], 3);
    const lx = ax - 6 - sw * 5, ly = ay + 50; t.line(lx, ly - 4, lx, ly, 0.6, '#2a2a2a', 3); t.rect(lx - 3, ly, 6, 7, '#3a3f44', 3.5, 0.6); t.rect(lx - 2, ly + 1.5, 4, 4, '#ffcf6a', 5);
    // body: a hunched trunk with a coat of hanging moss and vines
    t.poly([[cx - 16, 30], [cx + 14, 28], [cx + 12, hipY + 4], [cx - 13, hipY + 6]], bark[0]); t.hrect(cx - 16, 28, 30, hipY - 22, 6, 6);
    for (let k = 0; k < 26; k++) { const x = r.range(cx - 15, cx + 13); t.line(x, r.range(28, 40), x + r.range(-1.5, 1.5) - sw * 0.8, r.range(hipY - 4, hipY + 14), r.range(1, 2.2), r.pick(moss), 7); }
    t.speck(26, moss, 1, 3, 8, false); t.speck(10, stone, 1.4, 3, 7, false);
    leg(6, sw, bark[0]);
    // the near arm swings with a staff of a branch
    const bx2 = cx + 13, by2 = 33; t.line(bx2, by2, bx2 + 5 + sw * 4, by2 + 24, 5.4, bark[3], 4); t.line(bx2 + 5 + sw * 4, by2 + 24, bx2 + 7 + sw * 7, by2 + 42, 4.4, bark[3], 3.5); t.line(bx2 + 7 + sw * 7, by2 + 30, bx2 + 9 + sw * 7, H - 6, 1.6, bark[2], 3);
    // head: a weathered stone mask, hollow eyes with a faint light, antler-branches
    t.ell(cx + 2, 20, 9, 10, stone[0], 7); t.ell(cx + 4, 22, 6.5, 7, stone[1], 8, 'base'); t.rect(cx + 1, 19, 2.4, 2.6, '#0b0d0a', 6); t.rect(cx + 6, 19, 2.4, 2.6, '#0b0d0a', 6); t.rect(cx + 1.6, 19.6, 1.2, 1.2, '#e0d070', 7); t.rect(cx + 6.6, 19.6, 1.2, 1.2, '#e0d070', 7);
    for (const s of [-1, 1]) { let px = cx + 2 + s * 5, py = 12, a = -1.57 + s * 0.6; for (let k = 0; k < 4; k++) { const nx = px + Math.cos(a) * 5, ny = py + Math.sin(a) * 5; t.line(px, py, nx, ny, 2 - k * 0.4, bark[1], 6); if (k === 1) t.line(nx, ny, nx + s * 4, ny - 2, 0.8, bark[1], 6); px = nx; py = ny; a -= s * 0.3; } }
    t.speck(12, moss, 0.8, 1.8, 9, false); t.grain(0.45, 4, seed + f, 0.6);
    const right = t.finish(P, { outline: true, dither: 0.5, amb: 0.42, dif: 0.8, hs: 0.8 });
    out.push({ r: right, l: flipH(right) });
  }
  return out;
}

// ------------------------------------------------ the sky behind everything: a dithered gradient,
// the sun low in the haze, ragged cloud bands, the far ridges, and the islands hanging in the distance
export function paintSky(w, h, top, mid, low, sun, seed, isles = 3) {
  const c = mk(w, h), x = cx2d(c), img = x.createImageData(w, h), d = img.data, T = hex(top), M = hex(mid), L = hex(low), S = hex(sun), sx = w * 0.68, sy = h * 0.62;
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
    const v = y / h, base = v < 0.6 ? T.map((a, i) => a + (M[i] - a) * (v / 0.6)) : M.map((a, i) => a + (L[i] - a) * ((v - 0.6) / 0.4));
    const sd = Math.hypot((X - sx) / w, (y - sy) / h * 1.6), glow = Math.max(0, 1 - sd * 3.2) ** 2 * 0.8 + Math.max(0, 1 - sd * 12) * 0.6;
    const cl = fbm(X / 70 + seed, y / 9, 401 + seed, 4), band = Math.sin(v * 9 + cl * 3) * 0.5 + 0.5, cloud = clamp((cl - 0.52) * 4, 0, 1) * band * (v < 0.75 ? 1 : 0.3);
    const t2 = bay(X, y) * 10, i = (y * w + X) * 4;
    for (let k = 0; k < 3; k++) { let val = base[k] + (S[k] - base[k]) * glow; val = val * (1 - cloud * 0.35) + M[k] * cloud * 0.2 + (S[k] * 0.4) * cloud * glow; d[i + k] = clamp(Math.round((val + t2) / 6) * 6, 0, 255); }
    d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // far ridges, and the islands up in the haze
  const r = RNG(seed * 7 + 3), fh = (X, s, sc, amp, base) => base - fbm(X / sc, 0, s, 4) * amp;
  for (const [s, sc, amp, base, k] of [[11, 40, 26, h * 0.8, 0.82], [17, 22, 16, h * 0.86, 0.68]]) {
    const col = L.map((v, i) => v * k + T[i] * (1 - k) * 0.25); x.fillStyle = `rgb(${col.map((v) => v | 0)})`; x.beginPath(); x.moveTo(0, h);
    for (let X = 0; X <= w; X += 2) x.lineTo(X, fh(X, s + seed, sc, amp, base)); x.lineTo(w, h); x.fill();
  }
  for (let k = 0; k < isles; k++) {
    const ix = r.range(0.08, 0.92) * w, iy = r.range(0.18, 0.5) * h, iw = r.range(14, 30), col = M.map((v, i) => v * 0.78 + T[i] * 0.1); x.fillStyle = `rgb(${col.map((v) => v | 0)})`;
    x.beginPath(); x.moveTo(ix - iw, iy); for (let X = -iw; X <= iw; X += 2) x.lineTo(ix + X, iy - 2 - Math.abs(Math.sin(X * 0.3 + k)) * 2.5); x.lineTo(ix + iw, iy); x.lineTo(ix + iw * 0.3, iy + iw * 0.5); x.lineTo(ix, iy + iw * 0.8); x.lineTo(ix - iw * 0.4, iy + iw * 0.45); x.fill();
  }
  return c;
}
