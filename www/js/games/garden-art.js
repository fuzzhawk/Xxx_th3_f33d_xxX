// The dream garden's pictures, all drawn in code and cached: trees with many shapes and several
// variants of each, village houses in each country's own style, the neon city's towers and signs,
// lanterns, gates and treasure chests, strange and mythical creatures, sky whales, and the gentle
// giant gardeners. Everything is small pixel art finished with the same crisp outline.
import { mulberry32 } from '../util.js';
import { mk, ell, px, tone, mixHex, crisp, vivid } from './garden-kit.js';

const cache = new Map();
const memo = (key, fn) => { let s = cache.get(key); if (!s) { const cv = fn(); s = { cv, w: cv.width, h: cv.height }; cache.set(key, s); } return s; };
const hashS = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; };
const poly = (c, col, pts) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };

// ------------------------------------------------ trees
// A crown is a cloud of leaf puffs: a shadow under each, the leaf colour, light on the upper left,
// then bright and dark flecks, so it reads as foliage and not a ball.
function crown(c, R, cx, cy, rx, ry, L, o = {}) {
  const n = o.n || Math.round(5 + (rx * ry) / 34), puffs = [];
  for (let i = 0; i < n; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * 0.72, r = (0.34 + R() * 0.26) * Math.min(rx, ry) * (o.puff || 1); puffs.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d * (o.flat || 1), r]); }
  puffs.push([cx, cy, Math.min(rx, ry) * 0.62]);
  puffs.sort((a, b) => a[1] - b[1]);
  const dk = tone(L, -0.34), md = tone(L, -0.14), lt = tone(L, 0.16), hi = tone(L, 0.34);
  for (const [x, y, r] of puffs) ell(c, x, y + r * 0.34, r, r * 0.86, dk);
  for (const [x, y, r] of puffs) ell(c, x, y, r, r * 0.84, md);
  for (const [x, y, r] of puffs) ell(c, x - r * 0.16, y - r * 0.2, r * 0.8, r * 0.66, L);
  for (const [x, y, r] of puffs) ell(c, x - r * 0.34, y - r * 0.38, r * 0.42, r * 0.34, lt);
  for (let i = 0; i < n * 3; i++) { const [x, y, r] = puffs[(R() * puffs.length) | 0], a = R() * 6.283, d = R() * r * 0.8; px(c, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8), R() < 0.45 ? hi : R() < 0.5 ? dk : lt, R() < 0.3 ? 2 : 1, 1); }
  return puffs;
}
// a trunk that tapers from a flared foot, with bark shading and a fork of branches into the crown
function trunk(c, x, y0, y1, w, bark, o = {}) {
  const dk = tone(bark, -0.3), lt = tone(bark, 0.22), lean = o.lean || 0;
  for (let y = y1; y >= y0; y--) {
    const u = (y1 - y) / Math.max(1, y1 - y0), ww = Math.max(1, Math.round(w * (1 - u * 0.5) + (u < 0.12 ? (0.12 - u) * w * 5 : 0))), xx = Math.round(x + lean * u * u - ww / 2);
    px(c, xx, y, bark, ww, 1); px(c, xx, y, lt, 1, 1); if (ww > 2) px(c, xx + ww - 1, y, dk, 1, 1);
    if (o.birch && y % 4 === 0) px(c, xx + (y % 8 ? 0 : ww - 2), y, '#3a3430', Math.min(2, ww), 1);
  }
  if (o.fork) for (const s of [-1, 1]) for (let k = 0; k < o.fork; k++) px(c, Math.round(x + lean + s * (1 + k)), y0 - k, k % 2 ? dk : bark, 1, 2);
}
const BARK = { oak: '#7a5a40', birch: '#ece6dc', pine: '#6a4a34', cherry: '#6a4a48', willow: '#77684a', maple: '#6a4638', palm: '#a08458', redwood: '#8a4a34', cypress: '#5e4a3a', ginkgo: '#77685a', baobab: '#a08a72', crystal: '#b8c8e8', wisteria: '#6e5a52', jacaranda: '#5e4a44', acacia: '#77603e', mangrove: '#6a5a48' };
// One tree: its species' shape, at a growth stage (2 young, 3 grown), in one of four variants.
export function treeSprite(k, P, st, fruit, v = 0) {
  return memo(`tree|${k}|${st}|${fruit ? 1 : 0}|${v}`, () => {
    const R = mulberry32(hashS(k) + st * 7919 + v * 977), big = st === 3, sc = (big ? 1 : 0.56) * (0.9 + (v % 4) * 0.07), S = (n) => Math.max(1, Math.round(n * sc));
    const shape = P.shape || (P.pine ? 'pine' : P.willow ? 'willow' : P.birch ? 'tall' : P.blossom ? 'blossom' : 'round');
    const L = v % 2 ? tone(P.leaf, v === 1 ? 0.07 : -0.08) : P.leaf, bark = BARK[P.bark || k] || BARK.oak;
    let cv, c;
    const flecks = (pf, col, n, w = 2) => { for (let i = 0; i < n; i++) { const [x, y, r] = pf[(R() * pf.length) | 0], a = R() * 6.283, d = R() * r * 0.85; px(c, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8), col, w, 1); } };
    if (shape === 'pine' || shape === 'redwood' || shape === 'cypress') {
      const tall = shape === 'redwood', slim = shape === 'cypress', w = S(slim ? 16 : tall ? 30 : 28), h = S(slim ? 54 : tall ? 86 : 52), tw = S(tall ? 6 : 3), bare = S(tall ? 30 : slim ? 4 : 9);
      [cv, c] = mk(w + 2, h);
      const x = (w + 2) / 2;
      trunk(c, x, h - bare - 4, h - 1, tw, bark);
      if (slim) { for (let y = h - bare; y > 1; y--) { const u = (h - bare - y) / (h - bare), r = (w / 2 - 1) * Math.sin(Math.min(1, u * 1.15 + 0.12) * Math.PI) ** 0.7 + (R() - 0.5) * 1.4; px(c, Math.round(x - r), y, tone(L, -0.26), Math.round(r * 2), 1); px(c, Math.round(x - r), y, L, Math.round(r * 1.25), 1); px(c, Math.round(x - r * 0.7), y, tone(L, 0.18), Math.max(1, Math.round(r * 0.4)), 1); } }
      else {
        const tiers = tall ? 6 : big ? 5 : 4, th = (h - bare) / (tiers * 0.72);
        for (let i = 0; i < tiers; i++) {
          const y1 = h - bare - i * th * 0.68, r = (w / 2) * (1 - i / (tiers + 0.7)) * (tall ? 0.8 : 1), y0 = y1 - th;
          for (let y = Math.round(y1); y > y0; y--) {
            const u = (y1 - y) / th, rr = r * (1 - u) + (R() - 0.5) * 1.6 + (y % 3 === 0 ? 1 : 0);
            if (rr < 0.5) continue;
            px(c, Math.round(x - rr), y, tone(L, -0.3), Math.round(rr * 2), 1); px(c, Math.round(x - rr), y, L, Math.round(rr * 1.3), 1); px(c, Math.round(x - rr * 0.75), y, tone(L, 0.2), Math.max(1, Math.round(rr * 0.45)), 1);
            if (P.snow && u > 0.45) px(c, Math.round(x - rr * 0.8), y, '#f4f8fc', Math.max(1, Math.round(rr * 1.3)), 1);
          }
        }
      }
    } else if (shape === 'palm') {
      const w = S(40), h = S(54); [cv, c] = mk(w, h);
      const lean = (v % 2 ? -1 : 1) * S(7);
      trunk(c, w / 2 - lean * 0.6, S(14), h - 1, S(4), bark, { lean });
      for (let y = S(18); y < h - 2; y += 4) px(c, Math.round(w / 2 - lean * 0.6 + lean * ((h - y) / h) ** 2 - 2), y, tone(bark, -0.25), S(4), 1);
      const tx = w / 2 + lean * 0.42, ty = S(14);
      for (let f = 0; f < 9; f++) { const a = -Math.PI * 0.95 + f * (Math.PI * 0.9 / 8) + (R() - 0.5) * 0.2, len = S(17 + R() * 5); for (let q = 0; q < len; q++) { const u = q / len, X = tx + Math.cos(a) * q, Y = ty + Math.sin(a) * q * 0.75 + u * u * S(11); px(c, Math.round(X), Math.round(Y), f % 2 ? L : tone(L, -0.2), 1, Math.max(1, Math.round((1 - u) * S(4)))); if (q % 2) px(c, Math.round(X), Math.round(Y), tone(L, 0.22), 1, 1); } }
      if (fruit) for (let i = 0; i < 4; i++) px(c, Math.round(tx - 3 + i * 2), ty + 2 + (i % 2), P.fruit || '#c8843a', 2, 2);
    } else if (shape === 'shroom') {
      const w = S(38), h = S(44), sw = S(6), capH = S(14); [cv, c] = mk(w, h);
      trunk(c, w / 2, capH, h - 1, sw, '#e8e0d0');
      ell(c, w / 2, capH + 1, w / 2 - 1, capH * 0.42, P.glow);
      ell(c, w / 2, capH - 1, w / 2 - 0.5, capH * 0.66, tone(P.cap, -0.25)); ell(c, w / 2, capH - 2.5, w / 2 - 1.5, capH * 0.58, P.cap); ell(c, w / 2 - w * 0.14, capH - 4, w * 0.2, capH * 0.26, tone(P.cap, 0.22));
      for (let i = 0; i < (big ? 8 : 3); i++) px(c, (w * 0.18 + R() * w * 0.62) | 0, (2 + R() * (capH - 5)) | 0, '#f8f0ff', 2, 1 + (R() < 0.4 ? 1 : 0));
      if (big && v % 2) { ell(c, w * 0.2, h - 5, 4, 2.6, P.cap); px(c, Math.round(w * 0.2 - 1), h - 4, '#e8e0d0', 2, 4); }
    } else if (shape === 'crystal') {
      const w = S(34), h = S(52); [cv, c] = mk(w, h);
      trunk(c, w / 2, S(26), h - 1, S(4), bark, { fork: 3 });
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.36 + (R() - 0.5) * 0.2, len = S(13 + R() * 11), bx = w / 2 + Math.cos(a) * S(5), by = S(27) + Math.sin(a) * S(5), ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len, nx = -Math.sin(a) * S(3), ny = Math.cos(a) * S(3), col = i % 2 ? P.leaf : tone(P.leaf, 0.25); poly(c, tone(col, -0.25), [[bx - nx, by - ny], [ex, ey], [bx + nx, by + ny]]); poly(c, col, [[bx - nx, by - ny], [ex, ey], [bx, by]]); px(c, Math.round((bx + ex) / 2), Math.round((by + ey) / 2), '#ffffff', 1, 2); }
    } else if (shape === 'baobab') {
      const w = S(44), h = S(50); [cv, c] = mk(w, h);
      for (let y = h - 1; y > S(16); y--) { const u = (h - y) / (h - S(16)), ww = S(15) * (1 - u * 0.35) + (u < 0.1 ? 3 : 0); px(c, Math.round(w / 2 - ww / 2), y, bark, Math.round(ww), 1); px(c, Math.round(w / 2 - ww / 2), y, tone(bark, 0.2), 2, 1); px(c, Math.round(w / 2 + ww / 2 - 3), y, tone(bark, -0.28), 3, 1); }
      for (const [dx, r] of [[-12, 6], [-4, 7], [5, 7], [13, 6]]) { for (let q = 0; q < 6; q++) px(c, Math.round(w / 2 + dx * 0.5 + (dx > 0 ? q : -q) * 0.6), S(17) - q, bark, 2, 1); crown(c, R, w / 2 + S(dx), S(9), S(r), S(5), L, { n: 3 }); }
    } else {
      // broadleaf shapes: round, tall, willow, blossom, umbrella, ginkgo, wisteria, mangrove
      const tallS = shape === 'tall', umb = shape === 'umbrella', w = S(tallS ? 30 : umb ? 48 : shape === 'willow' ? 44 : 42), h = S(tallS ? 62 : umb ? 46 : 54), tw = S(tallS ? 3 : 5);
      [cv, c] = mk(w + 2, h + (shape === 'mangrove' ? 4 : 0));
      const x = (w + 2) / 2, rx = w / 2 - 2, ry = S(tallS ? 19 : umb ? 9 : 15), cy = ry + 2 + (umb ? S(2) : 0), lean = ((v % 3) - 1) * S(2);
      if (shape === 'mangrove') for (const s of [-1, 1]) for (let q = 0; q < S(9); q++) { px(c, Math.round(x + s * (2 + q)), h - S(9) + q + 3, bark, 1, 2); px(c, Math.round(x + s * (1 + q * 0.5)), h - S(6) + q, tone(bark, -0.2), 1, 2); }
      trunk(c, x - lean, cy + ry * 0.4, h - 1, tw, bark, { lean, birch: P.birch, fork: big ? 4 : 2 });
      if (umb) for (const s of [-1, 1]) for (let q = 0; q < rx * 0.7; q++) px(c, Math.round(x + s * q), Math.round(cy + ry * 0.7 - q * 0.22), bark, 1, 2);
      const pf = crown(c, R, x, cy, rx, ry, L, { flat: umb ? 0.7 : 1, puff: umb ? 0.9 : tallS ? 0.85 : 1 });
      if (shape === 'round' && big) { crown(c, R, x - rx * 0.55, cy + ry * 0.5, rx * 0.5, ry * 0.5, L, { n: 3 }); crown(c, R, x + rx * 0.55, cy + ry * 0.45, rx * 0.5, ry * 0.5, tone(L, -0.05), { n: 3 }); }
      if (shape === 'willow') for (let i = 0; i < S(26); i++) { const xx = Math.round(x - rx + 1 + R() * (rx * 2 - 2)), y0 = Math.round(cy - ry * 0.2 + R() * ry), len = S(14 + R() * 12); for (let q = 0; q < len; q++) px(c, xx + (Math.sin(q * 0.35 + i) > 0.6 ? 1 : 0), y0 + q, q % 3 ? tone(L, i % 2 ? -0.12 : 0.1) : tone(L, -0.3), 1, 1); }
      if (shape === 'wisteria') for (let i = 0; i < S(16); i++) { const xx = Math.round(x - rx + 2 + R() * (rx * 2 - 4)), y0 = Math.round(cy + R() * ry * 0.8), len = S(7 + R() * 8); for (let q = 0; q < len; q++) px(c, xx + (q % 3 === 1 ? 1 : 0), y0 + q, q % 2 ? P.bloom : tone(P.bloom, q > len * 0.6 ? 0.35 : -0.15), q < len * 0.7 ? 2 : 1, 1); }
      if (P.blossom || shape === 'blossom') flecks(pf, P.bloom || '#ffd6e4', big ? 46 : 16), flecks(pf, '#ffffff', big ? 20 : 7);
      if (shape === 'ginkgo') flecks(pf, tone(P.leaf, 0.4), big ? 30 : 10);
      if (P.fruit && fruit && big) for (let i = 0; i < 8; i++) { const [fx, fy, r] = pf[(R() * pf.length) | 0], X = Math.round(fx + (R() - 0.5) * r), Y = Math.round(fy + R() * r * 0.6); px(c, X, Y, P.fruit, 2, 2); px(c, X, Y, tone(P.fruit, 0.45)); }
      if (P.glow && big && !P.fruit) flecks(pf, P.glow, 14, 1);
    }
    return crisp(cv);
  });
}
// the soft shadow a tree or a house stands on (dithered, so it is pixels and not a blur)
export function shadowSprite(w, h) {
  w = Math.max(6, Math.round(w / 4) * 4); h = Math.max(3, Math.round(h));
  return memo(`sh|${w}|${h}`, () => { const [cv, c] = mk(w, h); c.fillStyle = 'rgba(16,24,40,.3)'; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2), d = dx * dx + dy * dy; if (d < 0.55 || (d < 1 && (x + y) % 2 === 0)) c.fillRect(x, y, 1, 1); } return cv; }).cv;
}

// ------------------------------------------------ village houses
// Each country builds in its own way; windows are dark by day and warm when lit.
export const HOUSE_STYLES = ['cottage', 'timber', 'stone', 'igloo', 'adobe', 'shroom', 'stilt', 'treehouse', 'cloud'];
export function houseSprite(style, v = 0, lit = 0) {
  return memo(`house|${style}|${v}|${lit}`, () => {
    const R = mulberry32(hashS(style) + v * 131), win = lit ? '#ffd98a' : '#3a4a66', win2 = lit ? '#fff3c8' : '#566a8a', W = 50, H = 46;
    const [cv, c] = mk(W, H);
    const window_ = (x, y, w = 5, h = 5) => { px(c, x - 1, y - 1, '#4a3a30', w + 2, h + 2); px(c, x, y, win, w, h); px(c, x, y, win2, 2, 2); px(c, x + (w >> 1), y, '#4a3a30', 1, h); };
    const door = (x, y, col = '#7a4a2e') => { px(c, x - 1, y - 1, tone(col, -0.3), 8, 13); px(c, x, y, col, 6, 12); px(c, x + 4, y + 6, '#f0d080'); if (lit) px(c, x + 1, y + 1, '#ffd98a', 4, 2); };
    const chimney = (x, y) => { px(c, x, y, '#8a7468', 5, 9); px(c, x - 1, y, '#a48c7e', 7, 2); };
    if (style === 'igloo') {
      ell(c, 25, 34, 22, 15, '#c8d8e8'); ell(c, 24, 32, 20, 13, '#eef4fa'); ell(c, 19, 28, 9, 5, '#ffffff');
      for (let y = 22; y < 44; y += 5) px(c, 6 + ((y / 5) % 2) * 4, y, 'rgba(120,150,190,.5)', 38 - ((y / 5) % 2) * 8, 1);
      ell(c, 25, 40, 7, 7, '#9ab0c8'); ell(c, 25, 41, 5, 6, lit ? '#ffd98a' : '#2a3448');
    } else if (style === 'shroom') {
      px(c, 15, 22, '#e8e0d0', 20, 22); px(c, 15, 22, '#c8bca8', 3, 22); px(c, 32, 22, '#f8f2e6', 3, 22);
      const cap = ['#d8506a', '#8a6ad0', '#e88a3c', '#4aa8a0'][v % 4];
      ell(c, 25, 20, 24, 12, tone(cap, -0.3)); ell(c, 25, 17, 23, 11, cap); ell(c, 19, 13, 10, 5, tone(cap, 0.22));
      for (let i = 0; i < 7; i++) ell(c, 6 + R() * 38, 9 + R() * 12, 2.2, 1.6, '#fff4e8');
      door(22, 32, '#8a5a3a'); window_(17, 27, 4, 4); if (lit) ell(c, 25, 24, 12, 3, 'rgba(255,220,150,.5)');
    } else if (style === 'cloud') {
      for (const [x, y, r] of [[14, 34, 11], [26, 30, 14], [38, 35, 10], [25, 38, 12]]) ell(c, x, y, r, r * 0.72, '#dfe8f6');
      for (const [x, y, r] of [[14, 32, 10], [26, 27, 13], [38, 33, 9]]) ell(c, x, y, r, r * 0.7, '#ffffff');
      ell(c, 25, 40, 5, 6, lit ? '#ffe6a8' : '#8fa8d0'); window_(12, 30, 4, 4); window_(35, 31, 4, 4);
      px(c, 24, 6, '#d8c070', 1, 12); poly(c, '#ffb0c8', [[25, 6], [33, 9], [25, 12]]);
    } else {
      // a walled house under a pitched roof: what the walls and the roof are made of is the style
      const wallC = { cottage: '#eadfc8', timber: '#e6d6b8', stone: '#a8a29a', adobe: '#d8a878', stilt: '#b08a62', treehouse: '#9a7652' }[style], roofC = { cottage: ['#c8a45a', '#e0c070', '#a8843e'], timber: ['#8a3c34', '#b05848', '#6a2a26'], stone: ['#5a6478', '#7a869c', '#444c5e'], adobe: ['#c08a5a', '#d8a878', '#a06c40'], stilt: ['#6a7a4a', '#88a060', '#4e5c36'], treehouse: ['#3f7a4a', '#5a9a5e', '#2c5a36'] }[style];
      const y0 = style === 'stilt' ? 18 : 22, wh = style === 'stilt' ? 16 : 22, x0 = 7, ww = 36;
      if (style === 'stilt') { for (const x of [9, 20, 30, 40]) px(c, x, 34, '#6a5038', 2, 12); px(c, 5, 34, '#8a6a48', 40, 2); for (let q = 0; q < 5; q++) px(c, 1 + q, 44 - q * 2, '#8a6a48', 3, 1); }
      if (style === 'treehouse') { px(c, 20, 30, '#6a4e36', 10, 16); px(c, 20, 30, '#8a6a4a', 2, 16); for (let q = 0; q < 6; q++) px(c, 14 + q, 45 - q, '#6a4e36', 2, 1), px(c, 34 - q, 45 - q, '#5a4230', 2, 1); }
      px(c, x0, y0, wallC, ww, wh); px(c, x0, y0, tone(wallC, 0.12), 2, wh); px(c, x0 + ww - 3, y0, tone(wallC, -0.2), 3, wh);
      if (style === 'timber') { for (const x of [x0, x0 + 12, x0 + 24, x0 + ww - 2]) px(c, x, y0, '#6a4630', 2, wh); px(c, x0, y0 + 9, '#6a4630', ww, 2); for (let q = 0; q < 9; q++) px(c, x0 + 3 + q, y0 + q, '#6a4630', 1, 1); }
      if (style === 'stone') for (let y = y0 + 2; y < y0 + wh; y += 4) for (let x = x0 + ((y >> 2) % 2) * 3; x < x0 + ww - 2; x += 7) px(c, x, y, tone(wallC, R() < 0.5 ? -0.18 : 0.12), 5, 1);
      if (style === 'adobe') { px(c, x0 - 1, y0 - 3, roofC[0], ww + 2, 4); px(c, x0 - 1, y0 - 3, roofC[1], ww + 2, 1); for (const x of [x0 + 5, x0 + 17, x0 + 29]) px(c, x, y0 + 1, '#7a5030', 3, 2); }
      else {
        // the roof: rows that step in toward the ridge, lit on the left slope
        const rh = 15, ry = y0 - rh + 2;
        for (let q = 0; q < rh; q++) { const ins = Math.round((rh - 1 - q) * 1.15), y = ry + q, w2 = ww + 6 - ins * 2; if (w2 <= 0) continue; px(c, x0 - 3 + ins, y, roofC[q % 3 === 2 ? 2 : 0], w2, 1); px(c, x0 - 3 + ins, y, roofC[1], Math.max(1, w2 >> 1), 1); if (style === 'cottage' && q % 2) px(c, x0 - 3 + ins + ((q * 5) % 7), y, roofC[2], 3, 1); }
        px(c, x0 - 4, y0 + 1, roofC[2], ww + 8, 2);
        if (style !== 'treehouse') chimney(x0 + ww - 12 + (v % 2) * -18, ry + 1);
        if (style === 'treehouse') for (let i = 0; i < 14; i++) px(c, x0 - 4 + (R() * (ww + 6) | 0), ry + (R() * rh | 0), R() < 0.5 ? '#7ab86a' : '#2c5a36', 2, 1);
      }
      door(x0 + (v % 2 ? 6 : ww - 13), y0 + wh - 12, ['#7a4a2e', '#4a6a8a', '#8a3a3a', '#4a7a5a'][v % 4]);
      window_(x0 + (v % 2 ? 20 : 5), y0 + 5); if (style !== 'stilt') window_(x0 + (v % 2 ? 29 : 14), y0 + 5);
      if (style === 'cottage' || style === 'timber') for (let i = 0; i < 6; i++) px(c, x0 + (v % 2 ? 19 : 4) + i * 2, y0 + 12, ['#ff7a9a', '#ffd23f', '#ffffff'][i % 3], 1, 1), px(c, x0 + (v % 2 ? 19 : 4) + i * 2, y0 + 13, '#5a9a4e', 1, 1);
    }
    return crisp(cv, 'rgba(30,24,36,.9)');
  });
}
// a windmill whose sails turn (four frames), a market stall, a village well with a lantern
export function propSprite(kind, f = 0, lit = 0) {
  return memo(`prop|${kind}|${f}|${lit}`, () => {
    let cv, c;
    if (kind === 'windmill') {
      [cv, c] = mk(46, 62);
      poly(c, '#d8cdb8', [[15, 62], [18, 24], [28, 24], [31, 62]]); poly(c, '#b8ab94', [[26, 62], [26, 24], [28, 24], [31, 62]]);
      poly(c, '#8a3c34', [[15, 26], [23, 14], [31, 26]]); px(c, 20, 50, '#6a4630', 6, 12); px(c, 21, 34, lit ? '#ffd98a' : '#3a4a66', 4, 5);
      const a0 = f * Math.PI / 8;
      for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2, ex = 23 + Math.cos(a) * 21, ey = 22 + Math.sin(a) * 21, nx = -Math.sin(a) * 4, ny = Math.cos(a) * 4; poly(c, '#f4ead4', [[23, 22], [ex, ey], [ex + nx, ey + ny], [23 + nx * 0.4, 22 + ny * 0.4]]); c.strokeStyle = '#8a6a4a'; c.lineWidth = 1; c.beginPath(); c.moveTo(23, 22); c.lineTo(ex, ey); c.stroke(); }
      px(c, 22, 21, '#5a4230', 3, 3);
    } else if (kind === 'stall') {
      [cv, c] = mk(30, 28);
      px(c, 3, 14, '#8a6446', 2, 14); px(c, 25, 14, '#8a6446', 2, 14); px(c, 2, 18, '#a07a52', 26, 4);
      for (let i = 0; i < 7; i++) px(c, 1 + i * 4, 6, i % 2 ? '#f4ead4' : ['#e86a6a', '#5aa8d8', '#e8b040'][f % 3], 4, 8);
      px(c, 1, 5, '#6a4a34', 28, 1);
      for (let i = 0; i < 5; i++) ell(c, 6 + i * 4.5, 17, 2, 1.8, ['#e2453f', '#f0b040', '#7ab86a', '#b28dff', '#ff9ac0'][(i + f) % 5]);
    } else if (kind === 'well') {
      [cv, c] = mk(22, 26); ell(c, 11, 19, 9, 5, '#8a8480'); ell(c, 11, 18, 8, 4, '#b8b0a8'); ell(c, 11, 18, 5.5, 2.6, '#2a4a6a'); px(c, 3, 4, '#8a6446', 2, 15); px(c, 17, 4, '#8a6446', 2, 15); poly(c, '#a0563a', [[1, 6], [11, 0], [21, 6]]);
      px(c, 10, 6, '#d8c8a0', 1, 5); px(c, 9, 10, lit ? '#ffd98a' : '#7a6a4a', 3, 3);
    } else if (kind === 'lamp' || kind === 'stonelamp' || kind === 'shroomlamp' || kind === 'neonlamp') {
      if (kind === 'neonlamp') { [cv, c] = mk(10, 34); px(c, 4, 6, '#2a2838', 2, 28); px(c, 3, 32, '#3a3848', 4, 2); px(c, 1, 3, '#3a3848', 8, 3); px(c, 2, 5, lit ? ['#5af0ff', '#ff5ad8', '#ffd24a'][f % 3] : '#565470', 6, 2); }
      else if (kind === 'stonelamp') { [cv, c] = mk(12, 20); px(c, 4, 12, '#9a948e', 4, 8); px(c, 2, 18, '#8a847e', 8, 2); px(c, 2, 5, '#aaa49c', 8, 7); px(c, 4, 7, lit ? '#ffd98a' : '#4a4640', 4, 3); poly(c, '#7e786e', [[0, 6], [6, 0], [12, 6]]); px(c, 2, 2, '#6aa860', 3, 1); }
      else if (kind === 'shroomlamp') { [cv, c] = mk(12, 16); px(c, 5, 7, '#e8e0d0', 2, 9); ell(c, 6, 6, 5.5, 4, lit ? '#8ff0d8' : '#5aa898'); ell(c, 4.5, 4.5, 2.4, 1.6, lit ? '#e8fff8' : '#8fd0c0'); px(c, 2, 12, '#e8e0d0', 1, 4); ell(c, 2.5, 11.5, 2, 1.5, lit ? '#c8a8ff' : '#8a78b8'); }
      else { [cv, c] = mk(10, 26); px(c, 4, 8, '#5a4636', 2, 18); px(c, 4, 4, '#5a4636', 5, 1); px(c, 8, 4, '#5a4636', 1, 3); px(c, 6, 7, '#8a3c34', 4, 1); px(c, 6, 8, lit ? '#ffd98a' : '#7a6a58', 4, 5); if (lit) px(c, 7, 9, '#fff6d8', 2, 2); px(c, 6, 13, '#8a3c34', 4, 1); }
    } else if (kind === 'gate') {
      [cv, c] = mk(38, 40);
      for (const x of [6, 28]) { px(c, x, 8, '#b8402e', 4, 32); px(c, x, 8, '#d8604a', 1, 32); px(c, x - 1, 36, '#3a3430', 6, 4); }
      px(c, 2, 12, '#b8402e', 34, 3); poly(c, '#3a3038', [[0, 4], [2, 8], [36, 8], [38, 4], [36, 6], [2, 6]]); px(c, 1, 6, '#b8402e', 36, 3); px(c, 17, 9, '#3a3038', 4, 4);
      px(c, 7, 30, '#6aa860', 3, 2); px(c, 29, 22, '#6aa860', 2, 3);
    } else if (kind === 'chest' || kind === 'urn' || kind === 'geode' || kind === 'capsule' || kind === 'starchest') {
      const open = f;
      if (kind === 'geode') { [cv, c] = mk(18, 16); ell(c, 9, 10, 8, 5.5, '#6a6274'); ell(c, 8, 9, 6.5, 4.4, '#8a8296'); if (open) { ell(c, 9, 9, 5, 3.2, '#2a2038'); for (const [x, h2, col] of [[6, 7, '#c8a8ff'], [9, 10, '#9ff0f0'], [12, 6, '#ffb8e8']]) poly(c, col, [[x - 2, 11], [x, 11 - h2], [x + 2, 11]]); } else { px(c, 6, 7, '#b8b0c4', 3, 1); px(c, 11, 10, '#5a5264', 3, 1); } }
      else if (kind === 'urn') { [cv, c] = mk(14, 18); ell(c, 7, 11, 6, 6, '#a86a48'); ell(c, 6, 10, 4.5, 4.5, '#c88a62'); px(c, 4, 2, '#a86a48', 6, 4); px(c, 3, 1, '#c88a62', 8, 2); px(c, 3, 9, '#f0d080', 8, 1); if (open) { px(c, 4, 1, '#2a1a14', 6, 2); px(c, 6, 0, '#ffe9a8', 2, 1); } else px(c, 4, 0, '#7a4a30', 6, 2); px(c, 1, 14, '#6aa860', 3, 2); }
      else if (kind === 'capsule') { [cv, c] = mk(16, 18); px(c, 2, 6, '#2a2838', 12, 12); px(c, 3, 7, '#3a3850', 10, 10); px(c, 4, open ? 4 : 8, open ? '#5af0ff' : '#ff5ad8', 8, 3); px(c, 2, 5, '#565470', 12, 2); px(c, 5, 13, '#5af0ff', 6, 1); if (open) ell(c, 8, 3, 4, 2.5, '#d8ffff'); }
      else { const gold = kind === 'starchest' ? '#bfe6ff' : '#f0d080', wood = kind === 'starchest' ? '#6a6aa8' : '#8a5a34'; [cv, c] = mk(18, 17); px(c, 1, 8, tone(wood, -0.25), 16, 9); px(c, 2, 8, wood, 14, 8); px(c, 1, 11, gold, 16, 1); px(c, 8, 9, gold, 2, 4); if (open) { poly(c, tone(wood, -0.1), [[1, 8], [3, 1], [15, 1], [17, 8]]); px(c, 3, 5, '#2a1a14', 12, 3); px(c, 4, 6, '#fff3c8', 10, 2); px(c, 6, 4, '#ffe9a8', 2, 2); px(c, 11, 5, '#fff', 1, 1); } else { ell(c, 9, 7.5, 8, 4.5, tone(wood, 0.12)); px(c, 1, 7, gold, 16, 1); px(c, 2, 4, tone(wood, 0.3), 5, 1); } }
    } else if (kind === 'glint') { [cv, c] = mk(7, 7); const s = f % 2; px(c, 3, s ? 0 : 1, '#fff8d0', 1, s ? 7 : 5); px(c, s ? 0 : 1, 3, '#fff8d0', s ? 7 : 5, 1); px(c, 3, 3, '#ffffff'); return cv; }
    else if (kind === 'ribbontree') { [cv, c] = mk(40, 50); trunk(c, 20, 18, 49, 5, '#6a4a3a', { fork: 4 }); const R = mulberry32(77); crown(c, R, 20, 15, 17, 13, '#f0b8c8'); for (let i = 0; i < 12; i++) { const x = 5 + (R() * 30 | 0), y = 14 + (R() * 12 | 0), col = ['#ff5a7a', '#ffd23f', '#5ac8ff', '#ffffff', '#b28dff'][i % 5]; for (let q = 0; q < 6 + (R() * 6 | 0); q++) px(c, x + (q % 3 === 1 ? 1 : 0), y + q, col, 1, 1); } }
    else { [cv, c] = mk(8, 8); px(c, 0, 0, '#f0f', 8, 8); }
    return crisp(cv, 'rgba(30,24,36,.9)');
  });
}

// ------------------------------------------------ the neon city
const NEON = ['#5af0ff', '#ff5ad8', '#ffd24a', '#8aff8a', '#b08aff', '#ff7a5a'];
// a tower: the roof seen from above, the lit face below it, windows, pipes, a sign down its side
export function towerSprite(v, wT, hPx) {
  return memo(`tower|${v}|${wT}|${hPx}`, () => {
    const R = mulberry32(v * 7919 + wT * 31 + hPx), W = wT * 16, roofH = 12 + (v % 3) * 3, H = hPx + roofH, [cv, c] = mk(W, H + 8);
    const base = ['#34325a', '#3c3868', '#2e3c5c', '#44346a'][v % 4], n1 = NEON[v % 6], n2 = NEON[(v + 2 + (v >> 2)) % 6];
    // the roof, seen from above: paler than the walls, a bright rim, a strip of neon along its front edge
    px(c, 0, 8, tone(base, 0.22), W, roofH); px(c, 0, 8, tone(base, 0.5), W, 1); px(c, 0, 8, tone(base, 0.4), 1, roofH); px(c, W - 1, 8, tone(base, -0.1), 1, roofH); px(c, 0, 7 + roofH, n1, W, 1);
    for (let i = 0; i < 2 + wT; i++) { const x = 2 + (R() * (W - 8) | 0), y = 10 + (R() * (roofH - 6) | 0); px(c, x, y, tone(base, 0.4), 4, 3); px(c, x, y, tone(base, 0.55), 4, 1); }
    const ax = 4 + (R() * (W - 8) | 0); px(c, ax, 0, '#565470', 1, 10); px(c, ax - 1, 0, '#ff4a4a', 3, 2);
    px(c, 0, 8 + roofH, base, W, hPx); px(c, 0, 8 + roofH, tone(base, 0.2), 1, hPx); px(c, W - 2, 8 + roofH, tone(base, -0.35), 2, hPx);
    for (let y = 8 + roofH + 4; y < H - 6; y += 6) for (let x = 3; x < W - 5; x += 5) { const r = R(); if (r < 0.62) px(c, x, y, r < 0.16 ? n1 : r < 0.28 ? n2 : r < 0.46 ? '#ffe9a8' : '#565a86', 3, 3); else px(c, x, y, '#1c1a30', 3, 3); }
    for (let y = 8 + roofH + 14; y < H - 10; y += 18) px(c, 0, y, tone(base, -0.3), W, 1);
    // a sign down one side: glyph blocks that are shapes, not letters
    const sx = v % 2 ? 2 : W - 9, sy = 8 + roofH + 6, sh = Math.min(hPx - 22, 44);
    px(c, sx - 1, sy - 1, '#0c0a14', 8, sh + 2);
    for (let y = sy + 1; y < sy + sh - 5; y += 8) { const g = (R() * 5) | 0; c.fillStyle = y % 16 < 8 ? n1 : n2; if (g === 0) { c.fillRect(sx, y, 6, 1); c.fillRect(sx + 2, y, 2, 6); } else if (g === 1) { c.fillRect(sx, y, 6, 6); c.clearRect(sx + 2, y + 2, 2, 2); px(c, sx + 2, y + 2, '#0c0a14', 2, 2); } else if (g === 2) { c.fillRect(sx, y + 2, 6, 2); c.fillRect(sx + 1, y, 1, 6); c.fillRect(sx + 4, y, 1, 6); } else if (g === 3) { for (let q = 0; q < 6; q++) c.fillRect(sx + q, y + (q < 3 ? q : 5 - q), 1, 2); } else { c.fillRect(sx + 2, y, 2, 2); c.fillRect(sx, y + 3, 6, 1); c.fillRect(sx + 1, y + 5, 4, 1); } }
    // the street front: an awning, a lit shop window and a door
    px(c, 0, H - 2, tone(base, -0.4), W, 10); px(c, 2, H - 8, n2, W - 4, 1); px(c, 3, H - 6, '#ffe9a8', W > 20 ? 9 : 5, 6); px(c, 3, H - 6, '#fff8e0', 3, 2); px(c, W - 9, H - 7, '#0c0a14', 5, 9); px(c, W - 9, H - 7, n1, 5, 1);
    for (let x = 1; x < W - 1; x += 4) px(c, x, H - 10, x % 8 < 4 ? n1 : tone(base, 0.3), 3, 2);
    return crisp(cv, 'rgba(8,6,16,.95)');
  });
}
// neon signs on poles and holograms that hang in the air (two frames: steady and a flicker)
export function neonSprite(kind, f = 0) {
  return memo(`neon|${kind}|${f}`, () => {
    const k = kind % 8, col = NEON[kind % 6], dim = f ? tone(col, -0.45) : col, [cv, c] = mk(18, 26);
    px(c, 8, 12, '#2a2838', 2, 14); px(c, 1, 0, '#0c0a14', 16, 13);
    c.fillStyle = dim;
    if (k === 0) { c.fillRect(4, 7, 10, 3); c.fillRect(5, 10, 8, 1); c.fillStyle = f ? dim : '#ffffff'; c.fillRect(6, 3, 1, 3); c.fillRect(9, 2, 1, 4); c.fillRect(12, 3, 1, 3); }                                   // a steaming bowl
    else if (k === 1) { ell(c, 9, 6.5, 6, 3.5, dim); ell(c, 9, 6.5, 2.2, 2.2, '#0c0a14'); px(c, 9, 6, f ? dim : '#ffffff'); }                                                                                 // an eye
    else if (k === 2) { for (const [x, y, w] of [[4, 3, 3], [10, 3, 3], [3, 4, 11], [3, 5, 11], [4, 6, 9], [5, 7, 7], [6, 8, 5], [7, 9, 3], [8, 10, 1]]) c.fillRect(x, y, w, 1); }                               // a heart
    else if (k === 3) { ell(c, 8, 6.5, 5, 3, dim); poly(c, dim, [[12, 6], [16, 3], [16, 10]]); px(c, 5, 6, '#0c0a14'); }                                                                                       // a fish
    else if (k === 4) { ell(c, 9, 6.5, 5, 5, dim); ell(c, 11, 5.5, 4, 4, '#0c0a14'); }                                                                                                                        // a moon
    else if (k === 5) { poly(c, dim, [[3, 6], [10, 2], [10, 5], [15, 5], [15, 8], [10, 8], [10, 11]]); }                                                                                                    // an arrow
    else if (k === 6) { ell(c, 9, 8, 4.5, 3.5, dim); poly(c, dim, [[5, 6], [5, 2], [8, 5]]); poly(c, dim, [[13, 6], [13, 2], [10, 5]]); px(c, 7, 7, '#0c0a14'); px(c, 11, 7, '#0c0a14'); }                 // a cat
    else { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; c.fillRect(Math.round(9 + Math.cos(a) * 4.5), Math.round(6.5 + Math.sin(a) * 4.5), 2, 2); } c.fillRect(8, 6, 2, 2); }         // a star
    return cv;
  });
}

// ------------------------------------------------ strange and mythical creatures (two frames, facing right)
export const STRANGE = ['kirin', 'spiritfox', 'mothdeer', 'mossling', 'jelly', 'snail', 'tortoise', 'stag', 'moonhare', 'axolotl', 'crab', 'kodama', 'emberbird', 'angler', 'manta', 'koi', 'phoenix', 'drone', 'cat', 'gecko'];
export function creatureSprite(k, f) {
  return memo(`cr|${k}|${f}`, () => {
    const B = '#2a2224'; let cv, c, raw = false;
    const legs = (xs, y, col, h = 5) => xs.forEach((x, i) => px(c, x + (f && i % 2 ? 1 : 0), y, col, 1, h - (f && i % 2 === 0 ? 1 : 0)));
    switch (k) {
      case 'kirin': [cv, c] = mk(22, 20); ell(c, 9, 11, 7, 4, '#f4f0e8'); legs([4, 7, 11, 14], 13, '#d8d0c4', 6); px(c, 14, 4, '#f4f0e8', 3, 8); ell(c, 17, 5, 3, 2.4, '#f4f0e8'); px(c, 19, 4, B); px(c, 17, 0, '#ffe08a', 1, 4); px(c, 18, 1, '#fff6c8', 1, 2); for (let i = 0; i < 6; i++) px(c, 12 - i, 5 + i, ['#8ff0d8', '#9fd8ff', '#c8a8ff'][i % 3], 2, 2); for (let i = 0; i < 4; i++) px(c, 1 - (f ? 1 : 0) + i, 8 + i, ['#c8a8ff', '#9fd8ff'][i % 2], 2, 1); break;
      case 'spiritfox': [cv, c] = mk(22, 14); ell(c, 10, 9, 5.5, 2.8, '#f8f4f0'); for (const [dy, col] of [[-3, '#bfe6ff'], [0, '#f8f4f0'], [3, '#d8c8ff']]) { ell(c, 3, 8 + dy * (f ? 0.8 : 1), 3.4, 1.8, col); px(c, 0, 8 + dy, '#9fd8ff', 2, 1); } ell(c, 16, 6, 3, 2.6, '#f8f4f0'); px(c, 15, 2, '#f8f4f0', 1, 3); px(c, 17, 2, '#e8d8ff', 1, 3); px(c, 17, 6, '#5ac8ff'); px(c, 19, 7, B); legs([7, 13], 11, '#d8d0e0', 3); px(c, 16, 0, '#9fd8ff', 2, 1); break;
      case 'mothdeer': [cv, c] = mk(20, 20); ell(c, 8, 12, 6, 3.4, '#8a78a8'); legs([4, 6, 10, 12], 14, '#6a5a88', 6); px(c, 12, 6, '#8a78a8', 2, 7); ell(c, 15, 6, 2.6, 2, '#8a78a8'); px(c, 16, 5, '#e8fff8'); for (const s of [0, 2]) { px(c, 13 + s, 1, '#c8a8ff', 1, 4); px(c, 12 + s * 2, 0, '#e0c8ff', 2, 1); } ell(c, 6, f ? 6 : 7, 5, f ? 2.5 : 4, 'rgba(200,170,255,.8)'); ell(c, 5, f ? 6 : 7, 2, 1.5, '#fff3c8'); break;
      case 'mossling': [cv, c] = mk(12, 12); ell(c, 6, 7, 5, 4.4, '#4f8a4c'); ell(c, 5, 5.5, 3.4, 2.6, '#7ab86a'); px(c, 4, 7, B); px(c, 8, 7, B); px(c, 5 + f, 1, '#5f9a4e', 1, 3); px(c, 4 + f, 0, '#ff9ac0', 3, 2); legs([3, 8], 10, '#3a6a3a', 2); break;
      case 'jelly': [cv, c] = mk(12, 16); raw = true; ell(c, 6, 5, 5.5, f ? 3.6 : 4.4, 'rgba(190,230,255,.75)'); ell(c, 5, 4, 3, 1.8, 'rgba(255,255,255,.85)'); for (const x of [2, 4, 6, 8, 10]) for (let q = 0; q < 7; q++) px(c, x + (Math.sin(q * 0.9 + x + f * 2) > 0.3 ? 1 : 0), 8 + q, q % 2 ? 'rgba(200,170,255,.8)' : 'rgba(160,230,255,.7)'); break;
      case 'snail': [cv, c] = mk(22, 18); px(c, 2, 14, '#e8d8b8', 17 + f, 3); ell(c, 18 + f, 12, 2.4, 2.6, '#e8d8b8'); px(c, 18 + f, 7, '#e8d8b8', 1, 4); px(c, 20 + f, 8, '#e8d8b8', 1, 3); px(c, 18 + f, 6, B); px(c, 20 + f, 7, B); ell(c, 9, 9, 7.5, 6.5, '#b87a5a'); ell(c, 8.5, 8.5, 5.5, 4.6, '#d89a72'); ell(c, 8.5, 8.5, 3, 2.4, '#b87a5a'); for (const [x, y, col] of [[5, 2, '#ff9ac0'], [9, 1, '#ffd23f'], [12, 3, '#ffffff']]) { px(c, x, y + 1, '#5f9a4e', 1, 3); px(c, x - 1, y, col, 3, 2); } break;
      case 'tortoise': [cv, c] = mk(34, 28); ell(c, 16, 21, 13, 5.5, '#6a7a4a'); legs([6, 12, 20, 25], 22, '#7a8a5a', 5); ell(c, 29, 19, 3.6, 3, '#8a9a66'); px(c, 31, 18, B); ell(c, 16, 17, 12, 6.5, '#5a8a4a'); ell(c, 14, 15, 9, 4.4, '#7ab86a'); { const R = mulberry32(5); px(c, 14, 6, '#7a5a40', 2, 9); crown(c, R, 15, 6, 8, 5.5, '#f5b5cc', { n: 4 }); for (let i = 0; i < 5; i++) px(c, 6 + i * 4, 13 + (i % 2), ['#ffd23f', '#ffffff', '#b28dff'][i % 3], 2, 2); } break;
      case 'stag': [cv, c] = mk(24, 26); ell(c, 10, 16, 7.5, 4, '#f4f4f8'); legs([4, 7, 12, 15], 18, '#d8d8e4', 8); px(c, 15, 8, '#f4f4f8', 3, 9); ell(c, 18, 8, 3, 2.4, '#f4f4f8'); px(c, 20, 7, '#5ac8ff'); for (const s of [-1, 1]) { const bx = 17 + s; for (let q = 0; q < 7; q++) px(c, bx + s * (q >> 1), 6 - q, '#bfe6ff', 1, 1); px(c, bx + s * 2, 2, '#e8fbff', 2, 1); px(c, bx + s * 4, 0, '#e8fbff', 1, 2); px(c, bx + s * 3, 3 + (f ? 0 : 1), '#9ff0f0'); } ell(c, 8, 14, 4, 2, '#ffffff'); break;
      case 'moonhare': [cv, c] = mk(14, 13); { const up = f ? 1 : 0; ell(c, 6, 9 - up, 4.5, 3, '#e8eeff'); ell(c, 10, 6 - up, 2.6, 2.4, '#e8eeff'); px(c, 9, 0 - up + 1, '#e8eeff', 1, 5); px(c, 11, 1 - up + 1, '#c8d4f8', 1, 4); px(c, 11, 5 - up, '#5a6ad8'); ell(c, 2, 8 - up, 1.6, 1.6, '#fff6c8'); px(c, 5, 6 - up, '#fff6c8', 2, 1); } break;
      case 'axolotl': [cv, c] = mk(15, 8); ell(c, 6, 4.5, 5, 2.4, '#ffb8d0'); ell(c, 11, 4, 3, 2.6, '#ffc8dc'); px(c, 12, 3, B); for (const y of [1, 6]) for (let q = 0; q < 3; q++) px(c, 9 + q * 2, y + (f && q === 1 ? (y < 4 ? -1 : 1) : 0), '#ff6a9a'); px(c, 0, 4 + f, '#ffb8d0', 2, 1); break;
      case 'crab': [cv, c] = mk(14, 10); ell(c, 7, 6, 4.5, 3, '#8a7ab8'); for (const [x, h, col] of [[5, 5, '#9ff0f0'], [7, 7, '#c8a8ff'], [9, 4, '#ffb8e8']]) poly(c, col, [[x - 1.5, 5], [x, 5 - h], [x + 1.5, 5]]); px(c, 1 - f, 4, '#8a7ab8', 2, 2); px(c, 11 + f, 4, '#8a7ab8', 2, 2); legs([3, 5, 9, 11], 8, '#6a5a98', 2); px(c, 5, 6, B); px(c, 9, 6, B); break;
      case 'kodama': [cv, c] = mk(9, 13); ell(c, 4.5, 4, 3.6, 3.6, '#f4fff8'); px(c, 3, 7, '#e0f4ea', 3, 4); px(c, 3, 3, B); px(c, 6, 3 + f, B); px(c, 4, 5, B, 1, 1); legs([3, 5], 11, '#c8e0d4', 2); px(c, 1, 8, '#e0f4ea', 2, 1); px(c, 6, 8 - f, '#e0f4ea', 2, 1); break;
      case 'emberbird': [cv, c] = mk(13, 9); ell(c, 6, 5, 3.6, 2.4, '#e8502a'); ell(c, 9.5, 3.5, 1.8, 1.8, '#ff8a3a'); px(c, 11, 3, '#ffe08a'); px(c, 9, 3, B); if (f) px(c, 3, 0, '#ffb23a', 5, 3); else px(c, 2, 5, '#ffb23a', 5, 2); px(c, 0, 4 + f, '#ffe08a', 3, 1); px(c, 1, 6 - f, '#ff8a3a', 2, 1); break;
      case 'angler': [cv, c] = mk(18, 14); ell(c, 8, 9, 6.5, 4, '#2a3a5a'); poly(c, '#2a3a5a', [[2, 9], [-1, 5 + f], [-1, 13 - f]]); px(c, 12, 8, '#e8fff8'); px(c, 10, 11, '#e8e0cc', 4, 1); for (let q = 0; q < 5; q++) px(c, 11 + q, 5 - q + (q > 3 ? 2 : 0), '#4a5a7a'); ell(c, 16, 3.5, 1.8, 1.8, '#d8ffa0'); break;
      case 'manta': [cv, c] = mk(30, 14); poly(c, '#5a6ab0', [[4, 7], [15, f ? 1 : 3], [27, 7], [15, f ? 12 : 10]]); poly(c, '#8a9ae0', [[8, 7], [15, f ? 3 : 5], [24, 7], [15, 8]]); px(c, 0, 7, '#5a6ab0', 5, 1); px(c, 25, 5, '#5a6ab0', 3, 1); px(c, 25, 9, '#5a6ab0', 3, 1); for (const [x, y] of [[12, 6], [17, 7], [20, 6]]) px(c, x, y, '#e8f4ff'); break;
      case 'koi': [cv, c] = mk(18, 9); ell(c, 9, 4.5, 6, 2.6, '#f8f4f0'); ell(c, 7, 4, 2.6, 1.6, '#ff6a3a'); ell(c, 12, 5, 1.8, 1.2, '#ff6a3a'); poly(c, '#ffb08a', [[3, 4.5], [0, 1 + f], [0, 8 - f]]); px(c, 14, 4, B); px(c, 8, 1, '#ffb08a', 3, 1); px(c, 8, 7, '#ffb08a', 3, 1); break;
      case 'phoenix': [cv, c] = mk(26, 18); ell(c, 14, 9, 5, 3, '#ff8a3a'); ell(c, 20, 6, 2.6, 2.2, '#ffb23a'); px(c, 22, 6, '#ffe08a', 2, 1); px(c, 20, 5, B); px(c, 19, 2, '#ffe08a', 1, 3); if (f) { poly(c, '#ffb23a', [[10, 8], [14, 0], [18, 8]]); poly(c, '#ffe08a', [[12, 7], [14, 2], [16, 7]]); } else { poly(c, '#ffb23a', [[9, 9], [14, 15], [18, 10]]); } for (let q = 0; q < 10; q++) px(c, 9 - q, 9 + Math.round(Math.sin(q * 0.7 + f) * 2), ['#ff5a3a', '#ffb23a', '#ffe08a'][q % 3], 2, 2 - (q > 6 ? 1 : 0)); break;
      case 'drone': [cv, c] = mk(12, 9); raw = true; px(c, 3, 3, '#3a3850', 6, 4); px(c, 4, 4, '#5af0ff', 2, 2); px(c, 0, f ? 1 : 2, '#8a88a0', 4, 1); px(c, 8, f ? 2 : 1, '#8a88a0', 4, 1); px(c, 5, 7, '#ff5ad8', 2, 1); break;
      case 'cat': [cv, c] = mk(14, 11); ell(c, 6, 7, 4.5, 2.8, '#2a2838'); ell(c, 10.5, 5, 2.6, 2.4, '#2a2838'); px(c, 9, 2, '#2a2838', 1, 2); px(c, 12, 2, '#2a2838', 1, 2); px(c, 10, 5, '#8aff8a'); px(c, 12, 5, '#8aff8a'); px(c, 9, 7, '#ff5ad8', 3, 1); px(c, 0, 3 + f, '#2a2838', 1, 4); px(c, 1, 6, '#2a2838', 2, 1); legs([3, 8], 9, '#1c1a2a', 2); break;
      case 'gecko': [cv, c] = mk(13, 6); px(c, 2, 2, '#e8a03c', 8, 2); ell(c, 11, 3, 1.8, 1.6, '#f0b85a'); px(c, 12, 2, B); px(c, 0, 3, '#e8a03c', 2, 1); for (const x of [4, 8]) { px(c, x + f, 0, '#c8802a'); px(c, x - f, 4, '#c8802a'); } px(c, 5, 2, '#8a4a1a'); px(c, 8, 3, '#8a4a1a'); break;
      default: [cv, c] = mk(6, 6); ell(c, 3, 3, 2.5, 2.5, '#fff');
    }
    return raw ? cv : crisp(cv);
  });
}

// ------------------------------------------------ sky whales
// Seen from the side as they swim through the air: a long body, pale grooved belly, a fluke that
// beats (two frames), and a garden of moss and flowers riding on their backs. Four colourings.
export function whaleSprite(v, f) {
  return memo(`whale|${v}|${f}`, () => {
    const [cv, c] = mk(92, 40), R = mulberry32(31 + v * 7), body = ['#4a6aa8', '#6a5aa8', '#e8eef8', '#1e2a52'][v % 4], belly = ['#c8d8f0', '#d8c8f0', '#ffffff', '#5a6aa8'][v % 4];
    const ty = f ? -3 : 3;
    poly(c, body, [[18, 20], [6, 12 + ty], [0, 8 + ty], [3, 18 + ty * 0.4], [0, 28 + ty], [8, 26 + ty]]);                    // the fluke
    ell(c, 50, 21, 34, 12, tone(body, -0.22)); ell(c, 50, 19.5, 33, 11, body); ell(c, 44, 15, 22, 5, tone(body, 0.16));
    ell(c, 54, 26, 26, 6, belly); for (let x = 34; x < 78; x += 5) px(c, x, 26 + ((x / 5) % 2), tone(belly, -0.18), 3, 1), px(c, x + 1, 29, tone(belly, -0.18), 3, 1);
    poly(c, tone(body, -0.12), [[52, 26], [44, 36 + (f ? -2 : 1)], [58, 31]]);                                                    // the fin
    px(c, 76, 18, '#12101c', 2, 2); px(c, 76, 18, '#ffffff');
    px(c, 70, 25, tone(body, -0.3), 12, 1);
    // the garden on its back
    for (let i = 0; i < 16; i++) { const x = 30 + (R() * 40 | 0), y = 9 + Math.round(((x - 50) / 34) ** 2 * 9) - 1; px(c, x, y, i % 3 ? '#5a9a5e' : '#7ab86a', 3, 2); if (i % 4 === 0) { px(c, x + 1, y - 3, '#5f9a4e', 1, 3); px(c, x, y - 4, ['#ff9ac0', '#ffd23f', '#ffffff', '#b28dff'][i % 4 + (i >> 2) % 2 > 3 ? 0 : (i >> 2) % 4], 3, 2); } }
    if (v % 4 === 3) for (let i = 0; i < 22; i++) px(c, 20 + (R() * 58 | 0), 12 + (R() * 16 | 0), R() < 0.5 ? '#fff6c8' : '#9fd8ff');
    else for (let i = 0; i < 8; i++) px(c, 24 + (R() * 50 | 0), 13 + (R() * 8 | 0), tone(body, 0.35), 2, 1);
    return crisp(cv, 'rgba(20,20,44,.9)');
  });
}

// ------------------------------------------------ the gentle giant gardeners
// Tall as a house: a mossy body on short legs, a tree and flowers growing from head and shoulders,
// two small bright eyes, and a lantern in one long hand. Four frames of a slow walk.
export function giantSprite(v, f) {
  return memo(`giantg|${v}|${f}`, () => {
    const [cv, c] = mk(52, 78), R = mulberry32(900 + v * 13), moss = ['#4f8a5a', '#5a8a4a', '#4a7a6a'][v % 3], earth = ['#6a5a48', '#5e5248', '#685848'][v % 3];
    const lf = f === 1 ? -3 : 0, rf = f === 3 ? -3 : 0, sway = f === 1 ? -1 : f === 3 ? 1 : 0;
    px(c, 16, 62 + lf, earth, 8, 14 - lf); px(c, 16, 62 + lf, tone(earth, 0.18), 2, 14 - lf); px(c, 14, 74, tone(earth, -0.2), 12, 3 + (lf ? -1 : 0));
    px(c, 29, 62 + rf, earth, 8, 14 - rf); px(c, 35, 62 + rf, tone(earth, -0.25), 2, 14 - rf); px(c, 27, 74, tone(earth, -0.2), 12, 3 + (rf ? -1 : 0));
    ell(c, 26 + sway, 46, 17, 20, tone(earth, -0.2)); ell(c, 25 + sway, 44, 16, 19, earth);
    crown(c, R, 25 + sway, 40, 16, 15, moss, { n: 9 });
    // arms: the left swings, the right holds a lantern
    for (let q = 0; q < 22; q++) px(c, 7 + sway - Math.round(Math.sin(q / 22 * 1.4) * 3) + (f === 1 ? 1 : 0), 36 + q, q % 5 ? earth : tone(earth, -0.2), 4, 1);
    for (let q = 0; q < 20; q++) px(c, 41 + sway + Math.round(Math.sin(q / 20 * 1.4) * 3) - (f === 3 ? 1 : 0), 36 + q, q % 5 ? earth : tone(earth, -0.2), 4, 1);
    px(c, 44 + sway, 56, '#5a4636', 1, 5); px(c, 42 + sway, 60, '#8a3c34', 5, 1); px(c, 42 + sway, 61, '#ffd98a', 5, 6); px(c, 43 + sway, 62, '#fff6d8', 2, 2); px(c, 42 + sway, 67, '#8a3c34', 5, 1);
    // the face
    ell(c, 25 + sway, 30, 9, 7, tone(earth, 0.1)); px(c, 21 + sway, 29, '#fff6c8', 2, 2); px(c, 28 + sway, 29, '#fff6c8', 2, 2); px(c, 23 + sway, 33, tone(earth, -0.4), 5, 1); px(c, 22 + sway, 32, tone(earth, -0.4)); px(c, 28 + sway, 32, tone(earth, -0.4));
    // the garden it carries: a small tree on its head, flowers on its shoulders
    px(c, 25 + sway, 10, '#7a5a40', 2, 14); crown(c, R, 26 + sway, 9, 12, 8, ['#f5b5cc', '#7ab86a', '#e0c070'][v % 3], { n: 6 });
    for (let i = 0; i < 9; i++) { const x = 9 + (R() * 34 | 0) + sway, y = 26 + (R() * 14 | 0); px(c, x, y, ['#ff9ac0', '#ffd23f', '#ffffff', '#b28dff', '#8ff0d8'][i % 5], 2, 2); px(c, x, y + 2, '#5f9a4e', 1, 2); }
    return crisp(cv, 'rgba(26,22,30,.92)');
  });
}

// little pictures for what the people and creatures say and give: no words, only signs
export const ICONS = ['heart', 'note', 'star', 'leaf', 'sun', 'moon', 'flower', 'drop', 'gem', 'seed', 'spiral', 'fish'];
export function iconSprite(kind) {
  return memo(`icon|${kind}`, () => {
    const [cv, c] = mk(9, 9), P = (col, rows) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') px(c, x, y, ch === '#' ? col : ch === 'o' ? '#ffffff' : tone(col, -0.3)); }));
    const A = { heart: ['#ff6a8a', ['.##.##...', '####o##..', '#######..', '.#####...', '..###....', '...#.....']], note: ['#8ad8ff', ['...###...', '...#.#...', '...#.#...', '...#.#...', '.###.#...', '.##o###..', '.....##..']], star: ['#ffe08a', ['....#....', '....#....', '.##o###..', '..#####..', '...###...', '..##.##..', '..#...#..']],
      leaf: ['#7ad06a', ['.....##..', '...####..', '..##x##..', '.##x###..', '.#x###...', '.x##.....', 'x........']], sun: ['#ffd23f', ['#...#...#', '.#.....#.', '...###...', '#..#o#..#', '...###...', '.#.....#.', '#...#...#']], moon: ['#e8eeff', ['...###...', '..##.....', '.##......', '.##......', '.###.....', '..####...', '...###...']],
      flower: ['#ff9ac0', ['..#.#....', '.#####...', '..#o#....', '.#####...', '..#x#....', '...x.....', '...x.....']], drop: ['#6ac8f8', ['...#.....', '...#.....', '..###....', '.##o##...', '.#####...', '.#####...', '..###....']], gem: ['#9ff0f0', ['.#####...', '##o####..', '.#####...', '..###....', '...#.....']],
      seed: ['#c8a05a', ['...x.....', '..###....', '.##o##...', '.#####...', '.#####...', '..###....']], spiral: ['#c8a8ff', ['.####....', '#....#...', '#.##.#...', '#.#..#...', '#.####...', '#........', '.#####...']], fish: ['#ffb08a', ['.........', '#..###...', '######o..', '######...', '#..###...']] }[kind] || ['#fff', ['###', '###']];
    P(A[0], A[1]);
    return crisp(cv, 'rgba(24,20,34,.95)');
  });
}
export { NEON, vivid, mixHex };
