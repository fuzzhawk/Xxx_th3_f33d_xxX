// Twenty more of the garden's creatures, drawn in code like the others (two frames, facing right):
//   the jungle      parrot, jaguar, tree frog
//   bamboo groves   red panda, crane, panda
//   salt flats      flamingo, fennec
//   ash fields      fire newt, ash moth
//   the lagoon      turtle, dolphin, seal
//   the city        pigeon, dog, raccoon
//   under the city  clockwork beetle, brass rat, cog owl, steam golem
// creatureSprite (garden-art.js) hands these names here; their habits are in garden-world.js
// (ANIMALS) and where they live in garden-dream.js (FAUNA, REALM_FAUNA).
import { mk, ell, px, crisp } from './garden-kit.js';

export const FAUNA20 = ['parrot', 'jaguar', 'treefrog', 'redpanda', 'crane', 'panda', 'flamingo', 'fennec', 'firenewt', 'ashmoth', 'turtle', 'dolphin', 'seal', 'pigeon', 'dog', 'raccoon', 'clockbeetle', 'brassrat', 'cogowl', 'golem'];
const B = '#2a2224';

export function faunaSprite(k, f) {
  let cv, c, raw = false;
  const legs = (xs, y, col, h = 5) => xs.forEach((x, i) => px(c, x + (f && i % 2 ? 1 : 0), y, col, 1, h - (f && i % 2 === 0 ? 1 : 0)));
  switch (k) {
    case 'parrot':
      [cv, c] = mk(16, 14);
      ell(c, 8, 7, 4, 3, '#e8302a'); ell(c, 11.5, 4.5, 2.6, 2.4, '#e8302a'); px(c, 13, 4, '#f4f0e0', 2, 2); px(c, 14, 5, '#3a2a24', 2, 2); px(c, 12, 4, B);
      if (f) { px(c, 4, 1, '#2a6ad8', 6, 3); px(c, 5, 1, '#ffd23f', 3, 1); } else { px(c, 4, 8, '#2a6ad8', 6, 3); px(c, 5, 10, '#ffd23f', 3, 1); }
      for (let q = 0; q < 5; q++) px(c, 4 - q, 8 + (q >> 1), q < 2 ? '#e8302a' : '#2a6ad8', 2, 1);
      break;
    case 'jaguar':
      [cv, c] = mk(30, 15);
      ell(c, 13, 8, 9, 3.6, '#d8a040'); ell(c, 12, 9.5, 7, 2, '#f0d8a0');
      legs([6, 9, 17, 20], 10, '#c08a34', 5);
      ell(c, 24, 6, 3.6, 3, '#d8a040'); px(c, 22, 2, '#c08a34', 2, 2); px(c, 25, 2, '#c08a34', 2, 2); px(c, 25, 5, '#4ac040'); px(c, 27, 7, B);
      for (const [x, y] of [[6, 6], [9, 5], [12, 7], [15, 5], [18, 7], [10, 9], [16, 9], [7, 8]]) { px(c, x, y, '#5a3412', 2, 1); px(c, x, y + 1, '#5a3412', 1, 1); px(c, x + 1, y + 1, '#e8b85a', 1, 1); }
      for (let q = 0; q < 6; q++) px(c, 4 - q, 6 - Math.round(Math.sin(q * 0.6 + f) * 2), q % 2 ? '#5a3412' : '#d8a040', 1, 2);
      break;
    case 'treefrog':
      [cv, c] = mk(12, 9);
      { const up = f ? 1 : 0; ell(c, 6, 5 - up, 4, 2.6, '#3ad85a'); ell(c, 5, 4 - up, 2.4, 1.4, '#7af08a'); px(c, 7, 2 - up, '#e82a2a', 2, 2); px(c, 3, 2 - up, '#e82a2a', 2, 2); px(c, 8, 2 - up, B); px(c, 4, 2 - up, B);
        px(c, 1, 7 - up + up, '#ff8a2a', 2, 1); px(c, 9, 7, '#ff8a2a', 2, 1); px(c, 5, 6 - up, '#2a8ad8', 3, 1); }
      break;
    case 'redpanda':
      [cv, c] = mk(20, 13);
      ell(c, 9, 7, 5, 3, '#c8582a'); legs([6, 12], 9, '#3a1a12', 3);
      ell(c, 15, 5, 3, 2.6, '#c8582a'); px(c, 13, 2, '#c8582a', 2, 2); px(c, 17, 2, '#c8582a', 2, 2); px(c, 13, 2, '#f4f0e8'); px(c, 18, 2, '#f4f0e8'); px(c, 14, 5, '#f4f0e8', 3, 2); px(c, 16, 4, B); px(c, 18, 6, B);
      for (let q = 0; q < 6; q++) px(c, 4 - q, 6 + Math.round(Math.sin(q * 0.7 + f) * 1.2), q % 2 ? '#8a3a1a' : '#e08a4a', 1, 3);
      break;
    case 'crane':
      [cv, c] = mk(20, 26);
      ell(c, 8, 13, 6, 3.4, '#f4f4f0'); px(c, 2, 12, '#2a2a30', 4, 3); legs([7, 10], 16, '#5a5a60', 9);
      { const bob = f ? 1 : 0; for (let q = 0; q < 8; q++) px(c, 12 + (q >> 2), 12 - q - bob, q > 5 ? '#2a2a30' : '#f4f4f0', 2, 1); ell(c, 14, 3 - bob, 2.2, 1.8, '#f4f4f0'); px(c, 13, 1 - bob, '#e82a2a', 2, 1); px(c, 15, 3 - bob, '#d8c060', 4, 1); px(c, 14, 3 - bob, B); }
      break;
    case 'panda':
      [cv, c] = mk(22, 17);
      ell(c, 10, 10, 7, 4.6, '#f4f4f0'); ell(c, 10, 11, 7, 2, '#2a2a30'); legs([5, 8, 12, 15], 12, '#1e1e24', 4);
      ell(c, 17, 7, 3.8, 3.4, '#f4f4f0'); px(c, 14, 3, '#1e1e24', 2, 2); px(c, 19, 3, '#1e1e24', 2, 2); px(c, 15, 6, '#1e1e24', 2, 2); px(c, 18, 6, '#1e1e24', 2, 2); px(c, 15, 6, '#ffffff'); px(c, 20, 8, B);
      px(c, 19 + f, 9, '#7ac06a', 1, 6); px(c, 20 + f, 8, '#9ad08a', 2, 1);
      break;
    case 'flamingo':
      [cv, c] = mk(16, 26);
      ell(c, 7, 12, 5, 3, '#ff8aa8'); px(c, 2, 11, '#e8587a', 4, 2);
      px(c, 7, 15, '#e8587a', 1, 11); if (f) px(c, 9, 15, '#e8587a', 1, 11); else { px(c, 9, 15, '#e8587a', 1, 4); px(c, 8, 18, '#e8587a', 2, 1); }
      for (let q = 0; q < 9; q++) px(c, 10 + Math.round(Math.sin(q * 0.45) * 2), 11 - q, '#ff8aa8', 2, 1);
      ell(c, 12, 2, 2.2, 1.8, '#ff9ab8'); px(c, 13, 2, '#f4f0e8', 2, 1); px(c, 14, 3, '#2a2224', 2, 1); px(c, 12, 1, B);
      break;
    case 'fennec':
      [cv, c] = mk(17, 13);
      ell(c, 7, 8, 4.5, 2.6, '#ecd2a0'); legs([5, 9], 10, '#d8b880', 3);
      ell(c, 12.5, 7, 2.6, 2.2, '#ecd2a0'); px(c, 10, 1, '#ecd2a0', 2, 5); px(c, 14, 1, '#ecd2a0', 2, 5); px(c, 10, 2, '#f8c8b8', 1, 3); px(c, 15, 2, '#f8c8b8', 1, 3); px(c, 13, 7, B); px(c, 15, 8, B);
      for (let q = 0; q < 4; q++) px(c, 2 - (q >> 1), 6 + q - (f ? 1 : 0), q === 3 ? '#4a3a2a' : '#e0c088', 2, 1);
      break;
    case 'firenewt':
      [cv, c] = mk(15, 7);
      px(c, 2, 3, '#2a1e1e', 9, 2); ell(c, 12, 3.5, 2, 1.6, '#2a1e1e'); px(c, 13, 3, '#ffd24a'); px(c, 0, 4, '#2a1e1e', 2, 1);
      for (let q = 0; q < 4; q++) px(c, 3 + q * 2, 3, '#ff6a2a', 1, 1);
      for (const x of [4, 9]) { px(c, x + f, 1, '#3a2a28'); px(c, x - f, 5, '#3a2a28'); }
      break;
    case 'ashmoth':
      [cv, c] = mk(15, 11); raw = true;
      px(c, 7, 2, '#3a3234', 2, 7);
      { const s = f ? 3 : 4; ell(c, 4, 4, 3.6, s, '#6a6266'); ell(c, 11, 4, 3.6, s, '#6a6266'); ell(c, 4, 4, 1.6, 1.6, '#ff8a2a'); ell(c, 11, 4, 1.6, 1.6, '#ff8a2a'); px(c, 4, 4, '#ffe08a'); px(c, 11, 4, '#ffe08a'); }
      px(c, 6, 0, '#5a5256', 1, 2); px(c, 9, 0, '#5a5256', 1, 2);
      break;
    case 'turtle':
      [cv, c] = mk(22, 13);
      ell(c, 10, 7, 8, 4.5, '#5a8a4a'); ell(c, 10, 6, 6.5, 3.4, '#7aaa5a');
      for (const [x, y] of [[7, 5], [11, 5], [9, 7], [13, 7], [6, 8]]) { px(c, x, y, '#4a6a3a', 2, 1); px(c, x, y + 1, '#9aca7a', 1, 1); }
      ell(c, 19, 7, 2.4, 2, '#8aba7a'); px(c, 20, 6, B);
      px(c, 4 - f, 10, '#8aba7a', 3, 2); px(c, 14 + f, 10, '#8aba7a', 3, 2);
      break;
    case 'dolphin':
      [cv, c] = mk(26, 13);
      { const a = f ? -1 : 1; for (let q = 0; q < 20; q++) { const y = 6 + Math.round(Math.sin((q / 19) * Math.PI) * -3 * a), h = q < 3 || q > 17 ? 2 : 4; px(c, 3 + q, y, '#5a7a9a', 1, h); px(c, 3 + q, y + h - 1, '#c8d8e8', 1, 1); }
        px(c, 12, 2 + (f ? 1 : 0), '#4a6a8a', 3, 2); px(c, 0, 4, '#4a6a8a', 3, 1); px(c, 0, 8, '#4a6a8a', 3, 1); px(c, 21, 6 + (f ? 1 : -1), B); }
      break;
    case 'seal':
      [cv, c] = mk(19, 10);
      ell(c, 9, 6, 7, 3, '#8a8a8e'); ell(c, 15, 4, 2.8, 2.4, '#9a9a9e'); px(c, 16, 3, B); px(c, 17, 5, '#2a2224', 2, 1);
      for (const [x, y] of [[6, 5], [9, 4], [11, 6]]) px(c, x, y, '#6a6a70', 1, 1);
      px(c, 1, 6 - f, '#7a7a7e', 3, 2); px(c, 10, 8 + f, '#7a7a7e', 3, 1);
      break;
    case 'pigeon':
      [cv, c] = mk(11, 10);
      { const peck = f ? 2 : 0; ell(c, 5, 6, 3.6, 2.4, '#8a8a9a'); px(c, 1, 5, '#6a6a78', 2, 2); ell(c, 8, 3 + peck, 1.8, 1.8, '#7a7a8a'); px(c, 7, 4 + peck, '#5aa87a', 2, 1); px(c, 7, 5 + peck, '#9a6ac8', 2, 1); px(c, 9, 2 + peck, '#e8a040'); px(c, 8, 2 + peck, B); px(c, 4, 8, '#d86a6a', 1, 2); px(c, 6, 8, '#d86a6a', 1, 2); px(c, 3, 6, '#6a6a78', 3, 1); }
      break;
    case 'dog':
      [cv, c] = mk(17, 14);
      ell(c, 8, 7, 5, 3, '#b8803a'); legs([5, 7, 10, 12], 9, '#9a6a2a', 4);
      ell(c, 13.5, 5, 2.8, 2.6, '#b8803a'); px(c, 11, 3, '#7a4a1a', 2, 4); px(c, 15, 5, '#2a2224', 2, 1); px(c, 13, 4, B); px(c, 11, 7, '#d83a3a', 3, 1);
      px(c, 2, f ? 2 : 4, '#b8803a', 1, 3); px(c, 3, f ? 4 : 5, '#b8803a', 1, 2);
      break;
    case 'raccoon':
      [cv, c] = mk(18, 12);
      ell(c, 8, 7, 5, 3, '#7a7a80'); legs([5, 11], 9, '#3a3a40', 3);
      ell(c, 14, 6, 3, 2.6, '#9a9aa0'); px(c, 12, 5, '#1e1e24', 5, 2); px(c, 14, 5, '#f4f4f0'); px(c, 16, 7, B); px(c, 12, 3, '#3a3a40', 2, 2); px(c, 15, 3, '#3a3a40', 2, 2);
      for (let q = 0; q < 6; q++) px(c, 3 - (q >> 1), 6 - (f ? 1 : 0) + (q % 2), q % 2 ? '#2a2a30' : '#9a9aa0', 2, 1);
      break;
    case 'clockbeetle':
      [cv, c] = mk(13, 10);
      ell(c, 6, 6, 4.5, 3, '#a8803a'); ell(c, 5.5, 5, 3.4, 2, '#d8b05a'); px(c, 6, 3, '#6a4a1a', 1, 5);
      for (const x of [3, 5, 8]) px(c, x, 6, '#ffe8a0', 1, 1);
      ell(c, 11, 6, 1.8, 1.6, '#6a4a1a'); px(c, 12, 5, '#ffd88a');
      px(c, 5, 0, '#c8c8d0', 1, 3); if (f) px(c, 3, 0, '#c8c8d0', 5, 1); else px(c, 4, 1, '#c8c8d0', 3, 1);
      legs([3, 6, 9], 8, '#5a4428', 2);
      break;
    case 'brassrat':
      [cv, c] = mk(16, 8);
      ell(c, 7, 4.5, 4.6, 2.4, '#b8903a'); ell(c, 12, 4, 2.4, 2, '#c8a04a'); px(c, 13, 3, '#e82a2a'); px(c, 11, 1, '#8a6a2a', 2, 2); px(c, 15, 4, '#5a4428');
      for (const x of [5, 7, 9]) px(c, x, 3, '#f0d07a');
      for (let q = 0; q < 5; q++) px(c, 2 - q * 0.5 | 0, 5 + Math.round(Math.sin(q + f * 2)), '#8a8a94', 1, 1);
      legs([5, 9], 6, '#6a5028', 2);
      break;
    case 'cogowl':
      [cv, c] = mk(15, 15); raw = true;
      ell(c, 7.5, 9, 4.5, 5, '#a8803a'); ell(c, 7.5, 10, 3, 3.6, '#d8b05a');
      for (const x of [5, 10]) { ell(c, x, 6, 2.2, 2.2, '#5a4428'); ell(c, x, 6, 1.4, 1.4, '#ffd88a'); px(c, x, 6, '#ffffff'); }
      px(c, 7, 8, '#e8a040', 1, 2); px(c, 4, 2, '#5a4428', 2, 2); px(c, 10, 2, '#5a4428', 2, 2);
      if (f) { px(c, 0, 5, '#8a6a2a', 3, 5); px(c, 12, 5, '#8a6a2a', 3, 5); } else { px(c, 1, 9, '#8a6a2a', 3, 5); px(c, 11, 9, '#8a6a2a', 3, 5); }
      cv = crisp(cv);
      break;
    case 'golem':
      [cv, c] = mk(24, 28);
      px(c, 6, 9, '#4a4448', 12, 13); px(c, 6, 9, '#6a6468', 12, 2); px(c, 7, 13, '#2a2224', 10, 6);
      ell(c, 12, 16, 3.4, 2.6, f ? '#ffd24a' : '#ff8a2a'); ell(c, 12, 16, 1.6, 1.2, '#fff0c0');
      for (const [x, y] of [[7, 11], [16, 11], [7, 20], [16, 20]]) px(c, x, y, '#a8a0a4');
      px(c, 8, 3, '#5a5458', 8, 6); px(c, 9, 5, '#ffd88a', 2, 1); px(c, 13, 5, '#ffd88a', 2, 1); px(c, 14, 0, '#3a3438', 2, 4);
      px(c, 2, 10 + f, '#5a5458', 4, 9); px(c, 18, 10 - f + 1, '#5a5458', 4, 9); px(c, 7, 22, '#3a3438', 4, 6 - f); px(c, 13, 22, '#3a3438', 4, 5 + f);
      break;
    default: return null;
  }
  return raw ? cv : crisp(cv);
}
