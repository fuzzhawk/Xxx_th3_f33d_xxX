import { Game, W, H, roundRect, drawFit, ready } from './engine.js';

// ================================================================ Retro racer (pseudo-3D road)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = (c, a) => a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
const TOD = { day: { k: 1, t: [0, 0, 0], m: 0 }, dusk: { k: 0.82, t: [255, 120, 60], m: 0.2 }, night: { k: 0.32, t: [10, 18, 60], m: 0.4 } };
const SKY = { dusk: [[70, 55, 120], [250, 150, 95]], night: [[6, 9, 32], [30, 36, 84]] };
const shade = (c, tod) => { const t = TOD[tod]; return mix(c.map((v) => v * t.k), t.t, t.m); };
const poly = (c, ...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.fill(); };
const quad = (c, x1, y1, w1, x2, y2, w2, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x1 - w1, y1); c.lineTo(x2 - w2, y2); c.lineTo(x2 + w2, y2); c.lineTo(x1 + w1, y1); c.fill(); };
const pick = (R, a) => a[Math.floor(R() * a.length)];

let GL = null;
const glows = () => GL ||= {
  fire: mk(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.25, 'rgba(255,200,70,.95)'); g.addColorStop(0.55, 'rgba(255,100,20,.6)'); g.addColorStop(1, 'rgba(160,30,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }),
  smoke: mk(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(55,55,60,.9)'); g.addColorStop(0.6, 'rgba(75,75,80,.45)'); g.addColorStop(1, 'rgba(80,80,85,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }),
  warm: mk(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,190,.95)'); g.addColorStop(0.3, 'rgba(255,190,90,.4)'); g.addColorStop(1, 'rgba(255,150,40,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }),
  white: mk(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); })
};

// biomes: ground pair, day sky, silhouette kind/colours, roadside mix [kind, weight], traffic density, hills, curves
const BIOMES = {
  forest: { n: 'PINE VALLEY', g: ['#3c8a3c', '#357d35'], sky: [[62, 125, 220], [190, 226, 248]], bg: ['hills', '#5b86a0', '#3f6e52'], tods: ['day', 'day', 'dusk'], wx: ['clear', 'clear', 'rain', 'fog'], spr: [['tree', 6], ['pine', 3], ['bush', 2], ['rock', 1], ['house', 0.4], ['post', 2], ['sign', 0.5], ['img', 1]], gap: [1, 3], traf: 1, hill: 0.9, curv: 1, tun: 0.5, br: 0.4 },
  desert: { n: 'DUST FLATS', g: ['#d9b36a', '#cfa75c'], sky: [[70, 140, 225], [255, 226, 175]], bg: ['mesa', '#c97c4a', '#a85c38'], tods: ['day', 'day', 'dusk'], wx: ['clear', 'clear', 'dust'], spr: [['cactus', 4], ['rock', 3], ['mesa', 0.6], ['bush', 2], ['post', 1], ['sign', 0.6], ['bb', 1], ['img', 1]], gap: [2, 4], traf: 1, hill: 0.6, curv: 0.8, tun: 0.2, br: 0.2 },
  city: { n: 'NEON CITY', g: ['#6d7076', '#64676d'], sky: [[70, 110, 190], [200, 215, 235]], bg: ['skyline', '#6a7ba0', '#46526f'], tods: ['night', 'night', 'dusk', 'day'], wx: ['clear', 'rain', 'clear'], spr: [['bldg', 7], ['lamp', 3], ['sign', 1], ['bb', 1.5], ['tree', 1], ['post', 1], ['img', 0.5]], gap: [1, 2], traf: 1.3, hill: 0.4, curv: 0.7, tun: 0.6, br: 0.4 },
  coast: { n: 'SEA ROAD', g: ['#d8c48a', '#cdb97e'], sky: [[50, 140, 230], [200, 235, 250]], bg: ['hills', '#7a9fc0', '#58829a'], tods: ['day', 'dusk', 'day'], wx: ['clear', 'clear', 'fog'], spr: [['palm', 4], ['rock', 2], ['lighthouse', 0.3], ['house', 1], ['post', 2], ['sign', 0.5], ['bb', 0.5], ['bush', 1], ['crag', 1.5]], gap: [1, 3], traf: 0.9, hill: 0.8, curv: 1.1, tun: 0.3, br: 0.9, sea: 1 },
  alpine: { n: 'FROST PASS', g: ['#f2f6fa', '#e2eaf2'], sky: [[110, 150, 200], [225, 235, 245]], bg: ['peaks', '#a9bdd6', '#7e93b3'], tods: ['day', 'day', 'dusk', 'night'], wx: ['snow', 'snow', 'fog'], spr: [['pine', 7], ['rock', 2], ['post', 2], ['sign', 0.5], ['crag', 1]], gap: [1, 3], traf: 0.8, hill: 1.4, curv: 1.2, tun: 0.8, br: 0.3, snow: 1 },
  canyon: { n: 'RED CANYON', g: ['#b5602f', '#a85729'], sky: [[60, 120, 200], [245, 205, 160]], bg: ['mesa', '#9a4a2c', '#7d3b24'], tods: ['day', 'dusk', 'dusk'], wx: ['clear', 'dust', 'clear'], spr: [['crag', 4], ['rock', 3], ['cactus', 1], ['bush', 1], ['sign', 0.5], ['post', 1]], gap: [1, 3], traf: 1, hill: 1.2, curv: 1.3, tun: 0.7, br: 0.3 }
};
const FOG = { clear: 0.1, rain: 0.35, snow: 0.4, fog: 0.75, dust: 0.5 };
const WORDS = ['GAS', 'DINER', 'MOTEL', 'FEED', 'BOOST', 'OPEN', 'COLA', 'HOTEL', 'FUEL', 'EAT', 'BAR', 'ZZZ'];

// ---- baked roadside sprites: [pixel w, pixel h, world width, draw fn]
const BAKE = {
  tree: [112, 140, 1100, (c, w, h, p) => { c.fillStyle = p.trunk; c.fillRect(w * 0.45, h * 0.55, w * 0.1, h * 0.45); for (const [x, y, r, col] of [[0.5, 0.36, 0.34, p.l2], [0.3, 0.52, 0.24, p.l2], [0.7, 0.52, 0.24, p.l2], [0.46, 0.3, 0.26, p.l1], [0.62, 0.45, 0.16, p.l1]]) { c.fillStyle = col; c.beginPath(); c.arc(w * x, h * y, w * r, 0, 7); c.fill(); } }],
  pine: [96, 150, 900, (c, w, h, p) => { c.fillStyle = p.trunk; c.fillRect(w * 0.45, h * 0.8, w * 0.1, h * 0.2); for (let i = 0; i < 3; i++) { const y = h * (0.05 + i * 0.25), hw = w * (0.26 + i * 0.12); c.fillStyle = p.l2; poly(c, w / 2, y, w / 2 - hw, y + h * 0.36, w / 2 + hw, y + h * 0.36); c.fillStyle = p.snow || p.l1; poly(c, w / 2, y, w / 2 - hw * 0.5, y + h * 0.18, w / 2 + hw * 0.5, y + h * 0.18); } }],
  palm: [110, 160, 1000, (c, w, h, p) => { c.strokeStyle = p.trunk; c.lineWidth = w * 0.07; c.beginPath(); c.moveTo(w * 0.45, h); c.quadraticCurveTo(w * 0.62, h * 0.55, w * 0.52, h * 0.25); c.stroke(); c.strokeStyle = p.l1; c.lineWidth = w * 0.05; for (const a of [-2.6, -2.1, -1.4, -0.8, -0.3, 0.2]) { c.beginPath(); c.moveTo(w * 0.52, h * 0.25); c.quadraticCurveTo(w * 0.52 + Math.cos(a) * w * 0.3, h * 0.25 + Math.sin(a) * h * 0.2 - 6, w * 0.52 + Math.cos(a) * w * 0.46, h * 0.25 + Math.sin(a) * h * 0.1 + h * 0.16); c.stroke(); } }],
  cactus: [70, 110, 600, (c, w, h, p) => { c.fillStyle = p.l2; roundRect(c, w * 0.38, h * 0.05, w * 0.24, h * 0.95, w * 0.12); c.fill(); roundRect(c, w * 0.1, h * 0.35, w * 0.12, h * 0.3, w * 0.06); c.fill(); roundRect(c, w * 0.1, h * 0.55, w * 0.4, h * 0.1, w * 0.05); c.fill(); roundRect(c, w * 0.78, h * 0.2, w * 0.12, h * 0.3, w * 0.06); c.fill(); roundRect(c, w * 0.5, h * 0.4, w * 0.4, h * 0.1, w * 0.05); c.fill(); c.fillStyle = p.l1; c.fillRect(w * 0.47, h * 0.1, w * 0.04, h * 0.85); }],
  rock: [100, 70, 900, (c, w, h, p, R) => { c.fillStyle = p.rock2; poly(c, 0, h, w * 0.1, h * 0.4, w * 0.35, h * 0.1, w * 0.7, h * 0.2, w * 0.95, h * 0.55, w, h); c.fillStyle = p.rock; poly(c, w * 0.1, h * 0.4, w * 0.35, h * 0.1, w * 0.5, h * 0.55, w * 0.25, h); }],
  mesa: [200, 120, 3500, (c, w, h, p) => { const bands = [p.rock, p.rock2, p.rock, p.rock2, p.rock]; for (let i = 0; i < 5; i++) { c.fillStyle = bands[i]; const t = i / 5, t2 = (i + 1) / 5; poly(c, w * (0.12 + 0.1 * t) - 0, h * (0.2 + 0.8 * t), w * (0.88 - 0.1 * t), h * (0.2 + 0.8 * t), w * (0.88 - 0.1 * t2), h * (0.2 + 0.8 * t2) + 1, w * (0.12 + 0.1 * t2), h * (0.2 + 0.8 * t2) + 1); } c.fillStyle = p.rock; poly(c, w * 0.12, h * 0.2, w * 0.2, 0, w * 0.8, 0, w * 0.88, h * 0.2); }],
  crag: [180, 200, 3000, (c, w, h, p, R) => { c.fillStyle = p.rock2; c.beginPath(); c.moveTo(0, h); let x = 0; while (x < w) { c.lineTo(x, h * (0.15 + R() * 0.5)); x += w * 0.16; c.lineTo(x, h * (0.05 + R() * 0.3)); x += w * 0.1; } c.lineTo(w, h); c.fill(); c.fillStyle = p.rock; c.beginPath(); c.moveTo(0, h); c.lineTo(w * 0.18, h * 0.3); c.lineTo(w * 0.34, h * 0.55); c.lineTo(w * 0.5, h); c.fill(); c.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 4; i++) c.fillRect(0, h * (0.45 + i * 0.14), w, h * 0.03); if (p.snow) { c.fillStyle = p.snow; poly(c, w * 0.1, h * 0.3, w * 0.18, h * 0.12, w * 0.3, h * 0.3); } }],
  bush: [90, 50, 700, (c, w, h, p) => { for (const [x, y, r, col] of [[0.3, 0.6, 0.28, p.l2], [0.65, 0.58, 0.3, p.l2], [0.5, 0.4, 0.26, p.l1]]) { c.fillStyle = col; c.beginPath(); c.arc(w * x, h * y, w * r, 0, 7); c.fill(); } }],
  bldg: [120, 240, 2000, (c, w, h, p, R) => { const col = pick(R, p.bl); c.fillStyle = col; c.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.92); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(w * 0.08, h * 0.08, w * 0.12, h * 0.92); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(w * 0.08, h * 0.05, w * 0.84, h * 0.04); c.fillRect(w * 0.45, 0, w * 0.04, h * 0.06); for (let y = 0.14; y < 0.94; y += 0.065) for (let x = 0.16; x < 0.84; x += 0.14) { c.fillStyle = p.night && R() < 0.6 ? pick(R, ['#ffd98a', '#ffe9b0', '#9fd8ff']) : p.night ? '#1a2038' : R() < 0.5 ? 'rgba(170,210,240,.75)' : 'rgba(40,60,90,.7)'; c.fillRect(w * x, h * y, w * 0.08, h * 0.04); } }],
  house: [120, 100, 1500, (c, w, h, p, R) => { c.fillStyle = pick(R, p.bl); c.fillRect(w * 0.12, h * 0.4, w * 0.76, h * 0.6); c.fillStyle = p.roof; poly(c, w * 0.04, h * 0.42, w * 0.5, h * 0.05, w * 0.96, h * 0.42); c.fillStyle = p.night ? '#ffd98a' : '#35516e'; c.fillRect(w * 0.2, h * 0.55, w * 0.16, h * 0.18); c.fillRect(w * 0.62, h * 0.55, w * 0.16, h * 0.18); c.fillStyle = '#5b3a24'; c.fillRect(w * 0.44, h * 0.65, w * 0.12, h * 0.35); }],
  lamp: [80, 200, 700, (c, w, h, p) => { c.fillStyle = '#3a3d44'; c.fillRect(w * 0.14, h * 0.08, w * 0.06, h * 0.92); c.fillRect(w * 0.14, h * 0.08, w * 0.7, h * 0.04); c.fillStyle = p.night ? '#fff2b0' : '#cfd6dc'; roundRect(c, w * 0.7, h * 0.1, w * 0.26, h * 0.05, 3); c.fill(); }, 0.83],
  post: [16, 40, 130, (c, w, h) => { c.fillStyle = '#f2f2ee'; c.fillRect(w * 0.25, 0, w * 0.5, h); c.fillStyle = '#d33'; c.fillRect(w * 0.25, h * 0.15, w * 0.5, h * 0.2); }],
  lighthouse: [60, 200, 700, (c, w, h) => { for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#d33' : '#f4f4f0'; const t = i / 5, t2 = (i + 1) / 5; poly(c, w * (0.3 - 0.12 * t), h * (0.2 + 0.8 * t), w * (0.7 + 0.12 * t), h * (0.2 + 0.8 * t), w * (0.7 + 0.12 * t2), h * (0.2 + 0.8 * t2) + 1, w * (0.3 - 0.12 * t2), h * (0.2 + 0.8 * t2) + 1); } c.fillStyle = '#333'; c.fillRect(w * 0.25, h * 0.12, w * 0.5, h * 0.08); c.fillStyle = '#ffe27a'; c.fillRect(w * 0.33, h * 0.04, w * 0.34, h * 0.08); c.fillStyle = '#333'; poly(c, w * 0.28, h * 0.04, w * 0.5, 0, w * 0.72, h * 0.04); }],
  barrel: [48, 60, 380, (c, w, h) => { c.fillStyle = '#c4301c'; roundRect(c, w * 0.12, h * 0.05, w * 0.76, h * 0.9, 6); c.fill(); c.fillStyle = '#8c1f10'; c.fillRect(w * 0.12, h * 0.25, w * 0.76, h * 0.06); c.fillRect(w * 0.12, h * 0.7, w * 0.76, h * 0.06); c.fillStyle = '#ffd21f'; poly(c, w * 0.5, h * 0.36, w * 0.68, h * 0.64, w * 0.32, h * 0.64); c.fillStyle = '#222'; c.fillRect(w * 0.47, h * 0.44, w * 0.06, h * 0.12); }],
  tanker: [140, 110, 1100, (c, w, h) => { c.fillStyle = '#222'; c.fillRect(w * 0.08, h * 0.8, w * 0.16, h * 0.2); c.fillRect(w * 0.76, h * 0.8, w * 0.16, h * 0.2); const g = c.createLinearGradient(0, 0, 0, h * 0.8); g.addColorStop(0, '#f2f2f2'); g.addColorStop(1, '#8c949c'); c.fillStyle = g; roundRect(c, w * 0.05, h * 0.08, w * 0.9, h * 0.72, w * 0.2); c.fill(); c.fillStyle = '#d4261a'; c.fillRect(w * 0.05, h * 0.4, w * 0.9, h * 0.18); c.fillStyle = '#fff'; c.font = `700 ${h * 0.16}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FUEL', w / 2, h * 0.49); c.fillStyle = '#444'; c.fillRect(w * 0.1, h * 0.78, w * 0.8, h * 0.08); c.fillStyle = '#ff3b30'; c.fillRect(w * 0.1, h * 0.7, w * 0.08, h * 0.06); c.fillRect(w * 0.82, h * 0.7, w * 0.08, h * 0.06); }],
  car: [100, 70, 700, (c, w, h, p, R) => { const col = pick(R, ['#d33', '#2a6fd6', '#f2b21c', '#2fb36b', '#eee', '#8a3ad6']); c.fillStyle = '#111'; c.fillRect(w * 0.08, h * 0.72, w * 0.18, h * 0.28); c.fillRect(w * 0.74, h * 0.72, w * 0.18, h * 0.28); c.fillStyle = col; roundRect(c, w * 0.04, h * 0.3, w * 0.92, h * 0.5, 8); c.fill(); roundRect(c, w * 0.18, h * 0.04, w * 0.64, h * 0.4, 9); c.fill(); c.fillStyle = '#243044'; roundRect(c, w * 0.24, h * 0.1, w * 0.52, h * 0.26, 5); c.fill(); c.fillStyle = '#ff3b30'; c.fillRect(w * 0.08, h * 0.5, w * 0.16, h * 0.1); c.fillRect(w * 0.76, h * 0.5, w * 0.16, h * 0.1); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(w * 0.04, h * 0.72, w * 0.92, h * 0.08); }]
};
const SIGNS = [
  (c, w, h, d) => { c.fillStyle = '#ffd21f'; c.fillRect(w * 0.1, 0, w * 0.8, h * 0.55); c.fillStyle = '#111'; c.lineWidth = w * 0.1; c.strokeStyle = '#111'; c.beginPath(); c.moveTo(w * (0.5 - 0.15 * d), h * 0.08); c.lineTo(w * (0.5 + 0.15 * d), h * 0.275); c.lineTo(w * (0.5 - 0.15 * d), h * 0.47); c.stroke(); },
  (c, w, h) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h * 0.26, w * 0.4, 0, 7); c.fill(); c.strokeStyle = '#d22'; c.lineWidth = w * 0.1; c.stroke(); c.fillStyle = '#111'; c.font = `700 ${w * 0.4}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('80', w / 2, h * 0.27); },
  (c, w, h) => { c.fillStyle = '#1f8a4c'; c.fillRect(w * 0.05, 0, w * 0.9, h * 0.5); c.fillStyle = '#fff'; poly(c, w * 0.5, h * 0.06, w * 0.8, h * 0.28, w * 0.6, h * 0.28, w * 0.6, h * 0.44, w * 0.4, h * 0.44, w * 0.4, h * 0.28, w * 0.2, h * 0.28); }
];

const mkSprite = (kind, R, p, v = 0) => {
  if (kind === 'sign') {
    const c = mk(64, 120, (g, w, h) => { g.fillStyle = '#9aa0a6'; g.fillRect(w * 0.45, h * 0.4, w * 0.1, h * 0.6); SIGNS[v ? 0 : 1 + (R() < 0.5 ? 0 : 1)](g, w, h, v || 1); });
    return { c, ww: 520, ar: 120 / 64, solid: true, brk: true };
  }
  if (kind === 'bb') {
    const c = mk(200, 160, (g, w, h) => { g.fillStyle = '#555'; g.fillRect(w * 0.2, h * 0.5, w * 0.05, h * 0.5); g.fillRect(w * 0.75, h * 0.5, w * 0.05, h * 0.5); g.fillStyle = '#222'; g.fillRect(w * 0.03, h * 0.02, w * 0.94, h * 0.62); g.fillStyle = p.acc[v % p.acc.length]; g.fillRect(w * 0.06, h * 0.06, w * 0.88, h * 0.54); g.fillStyle = '#fff'; g.font = `700 ${h * 0.3}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(WORDS[(v * 5 + (R() * 7 | 0)) % WORDS.length], w / 2, h * 0.34); });
    return { c, ww: 2200, ar: 0.8, solid: true, brk: true, pan: [0.06, 0.06, 0.88, 0.54] };
  }
  const [w, h, ww, f, hx] = BAKE[kind];
  const hh = kind === 'bldg' ? h + ((R() * 90) | 0) : h;
  const c = mk(w, hh, (g) => f(g, w, hh, p, R));
  return { c, ww: kind === 'bldg' ? ww * (0.8 + R() * 0.6) : ww, ar: hh / w, solid: !['post', 'bush'].includes(kind), brk: ['lamp', 'cactus', 'post'].includes(kind), hx, kind };
};

const prof = (kind, R) => {
  const a = new Float32Array(60);
  if (kind === 'hills') { const ph = [R() * 6, R() * 6, R() * 6]; for (let i = 0; i < 60; i++) a[i] = 0.5 + 0.28 * Math.sin(i / 60 * 6.283 * 2 + ph[0]) + 0.16 * Math.sin(i / 60 * 6.283 * 5 + ph[1]) + 0.06 * Math.sin(i / 60 * 6.283 * 11 + ph[2]); }
  else if (kind === 'peaks') for (let k = 0; k < 8; k++) { const c = R() * 60, w = 4 + R() * 8, A = 0.4 + R() * 0.6; for (let i = 0; i < 60; i++) { const d = Math.min(Math.abs(i - c), 60 - Math.abs(i - c)); a[i] = Math.max(a[i], Math.max(0, 1 - d / w) * A); } }
  else if (kind === 'mesa') for (let k = 0; k < 5; k++) { const c = R() * 60, w = 3 + R() * 4, A = 0.35 + R() * 0.5; for (let i = 0; i < 60; i++) { const d = Math.min(Math.abs(i - c), 60 - Math.abs(i - c)); a[i] = Math.max(a[i], clamp((w + 1.5 - d) / 1.5, 0, 1) * A); } }
  else { let i = 0; while (i < 60) { const n = 2 + (R() * 4 | 0), h = 0.15 + R() * 0.85; for (let j = 0; j < n && i < 60; j++) a[i++] = h; } }
  return a;
};

export class Racer extends Game {
  setup() {
    this.segLen = 200; this.roadW = 2000; this.camH = 1000; this.depth = 1 / Math.tan((100 / 2) * Math.PI / 180); this.drawN = 110;
    const R = () => this.rng();
    const ids = Object.keys(BIOMES).sort(() => R() - 0.5).slice(0, 5);
    // ---- track: heights at boundaries, curve per segment
    const ys = [0], cs = [], sts = [];
    let y0 = 0;
    this.stages = [];
    ids.forEach((bk, si) => {
      const B = BIOMES[bk], a = cs.length, n = this.ri(700, 950);
      while (cs.length < a + n) {
        const m = this.ri(30, 80), cm = R() < 0.3 ? 0 : this.r(-1, 1) * B.curv * 6, s2 = R() < 0.4, hk = R();
        let A = this.r(-1, 1) * B.hill * 900; if (Math.abs(y0 + A) > 1500) A = -A;
        for (let i = 0; i < m; i++) {
          const t = i / m, t1 = (i + 1) / m, sn = Math.sin(Math.PI * t1) ** 2;
          cs.push(cs.length < 40 ? 0 : cm * (s2 ? Math.sin(2 * Math.PI * t) : Math.sin(Math.PI * t)));
          ys.push(y0 + (cs.length < 40 ? 0 : hk < 0.35 ? A * (1 - Math.cos(Math.PI * t1)) / 2 : hk < 0.65 ? A * sn : hk < 0.85 ? A * 0.6 * Math.sin(2 * Math.PI * t1) * sn : 0));
        }
        if (hk < 0.35 && cs.length >= 40) y0 += A;
      }
      const tod = pick(R, B.tods), wx = pick(R, B.wx);
      this.stages.push({ bk, B, a, b: cs.length, tod, wx, si });
    });
    const N = cs.length, tail = 90, last = ys[N];
    for (let k = N - tail; k <= N; k++) ys[k] -= last * (1 - Math.cos(Math.PI * (k - (N - tail)) / tail)) / 2;
    this.segs = [];
    for (let i = 0; i < N; i++) { const st = this.stages.findIndex((s) => i < s.b); this.segs.push({ i, y1: 0, y2: 0, curve: cs[i], st, sp: [], tun: 0, br: 0, ga: 0, sea: 0 }); }
    // ---- features per stage
    for (const S of this.stages) {
      const B = S.B, n = S.b - S.a;
      if (B.sea) S.sea = R() < 0.5 ? -1 : 1;
      if (R() < B.tun) { const ta = S.a + this.ri(150, (n >> 1) - 130), len = this.ri(70, 120); S.tun = [ta, ta + len]; }
      if (R() < B.br) { const ta = S.a + (n >> 1) + this.ri(30, (n >> 1) - 200), len = this.ri(60, 100); S.br = [ta, ta + len]; for (let k = ta; k <= ta + len; k++) ys[k] = lerp(ys[ta], ys[ta + len], (k - ta) / len); }
    }
    for (let i = 0; i < N; i++) { const s = this.segs[i]; s.y1 = ys[i]; s.y2 = ys[i + 1]; }
    for (const S of this.stages) {
      if (S.tun) for (let k = S.tun[0]; k < S.tun[1]; k++) this.segs[k].tun = 1;
      if (S.tun) this.segs[S.tun[0]].portal = 1;
      if (S.br) for (let k = S.br[0]; k < S.br[1]; k++) { const s = this.segs[k]; s.br = 1; s.curve *= 0.3; if ((k - S.br[0]) % 26 === 12) s.ga = 'arch'; }
      if (S.sea) for (let k = S.a; k < S.b; k++) this.segs[k].sea = S.sea;
      this.segs[S.si ? S.a : 8].ga = 'gate';
      this.mkStage(S);
    }
    this.len = N * this.segLen;
    // ---- roadside scenery
    this.bbimgs = this.skin.list('bb', 6, 'item', 'enemy', 'hero').filter(Boolean);
    this.propSp = this.skin.list('rprop', 8, 'item', 'deco', 'tile', 'enemy').filter(Boolean).map((img) => ({ img, ww: 900, ar: 1, solid: true, brk: true }));
    for (const S of this.stages) {
      const B = S.B, kit = {};
      for (const [k] of B.spr) if (k !== 'img') kit[k] = k === 'sign' ? [] : Array.from({ length: k === 'bb' ? 4 : 3 }, (_, v) => mkSprite(k, R, S.pal.bake, v));
      kit.sign = [mkSprite('sign', R, S.pal.bake, 0), mkSprite('sign', R, S.pal.bake, 0)];
      kit.chevL = mkSprite('sign', R, S.pal.bake, -1); kit.chevR = mkSprite('sign', R, S.pal.bake, 1);
      kit.lampN = kit.lamp || [mkSprite('lamp', R, S.pal.bake)];
      const tot = B.spr.reduce((s, x) => s + x[1], 0);
      const put = (s, side, sp, inner, extra) => { const sc = this.r(0.85, 1.25), hw = sp.ww * sc / 2 / this.roadW; s.sp.push({ b: sp, off: side * (inner + hw), s: sc, hw: hw * 0.75, solid: sp.solid && inner < 2.1, flip: side > 0 && sp.kind !== 'bb' && sp.kind !== 'sign', hit: 0, ...extra }); };
      for (let i = S.a + 12; i < S.b; i += this.ri(B.gap[0], B.gap[1])) {
        const s = this.segs[i];
        if (s.tun || s.br) { if (s.br && i % 3 === 0) for (const side of [-1, 1]) put(s, side, kit.lampN[0], 1.18); continue; }
        for (const side of [-1, 1]) {
          if (s.sea === side && R() < 0.8) continue;
          let x = R() * tot, k = B.spr[0][0];
          for (const [kk, w] of B.spr) { x -= w; if (x <= 0) { k = kk; break; } }
          const far = R() < 0.4, inner = far ? this.r(2.3, 4.2) : this.r(1.25, 1.9);
          if (k === 'img') { if (this.propSp.length) put(s, side, pick(R, this.propSp), inner); continue; }
          if (k === 'mesa' || k === 'crag') { put(s, side, pick(R, kit[k]), far ? inner + 1 : this.r(1.4, 2)); continue; }
          const sp = pick(R, kit[k]);
          put(s, side, sp, inner, k === 'bb' && this.bbimgs.length && R() < 0.7 ? { bb: pick(R, this.bbimgs) } : null);
        }
      }
      for (let i = S.a + 20; i < S.b - 8; i++) { // chevron signs before and in sharp curves
        const s = this.segs[i];
        if (Math.abs(s.curve) > 3.2 && i % 5 === 0 && !s.tun && !s.br) put(s, s.curve > 0 ? -1 : 1, s.curve > 0 ? kit.chevR : kit.chevL, 1.22, { flip: false });
      }
    }
    // ---- player, traffic, state
    this.carImg = this.skin.vehicle('car');
    this.traf = this.skin.list('traf', 8, 'enemy', 'item', 'hero').filter(Boolean);
    const pp = this.stages[0].pal.bake;
    this.tSpr = { car: Array.from({ length: 3 }, () => mkSprite('car', R, pp)), truck: mkSprite('tanker', R, pp), barrel: mkSprite('barrel', R, pp), rock: mkSprite('rock', R, pp) };
    this.pz = 930; this.max = 12000 * (this.T > 1 ? 1.2 : 1);
    this.pool = Array.from({ length: this.drawN }, () => ({ es: [], fx: [] }));
    this.wp = Array.from({ length: 100 }, () => ({ x: this.r(0, W), y: this.r(0, H), v: this.r(0.6, 1.2) }));
    this.restart();
  }
  restart() {
    this.pos = 0; this.speed = 3500; this.px = 0; this.vx = 0; this.steer = 0; this.hold = 0; this.lean = 0;
    this.time = 42; this.over = 0; this.msg = null; this.stageNo = 1; this.bonus = 0; this.score = 0;
    this.ents = []; this.fx = []; this.pf = []; this.nextZ = 9000; this.hurt = 0; this.spin = 0; this.spinDir = 1; this.smoke = 0;
    this.shake = 0; this.flash = 0; this.bump = 0; this.bolt = 0; this.lt = 3; this.wallCd = 0; this.bgx = 0; this.apX = 0; this.apT = 0;
  }
  mkStage(S) {
    const B = S.B, tod = S.tod, R = () => this.rng(), sh = (h) => shade(hex(h), tod), wet = S.wx === 'rain' || S.wx === 'fog' ? 0.3 : 0;
    const sk = (tod === 'day' ? B.sky : SKY[tod]).map((c) => mix(c.map((v) => v * (tod === 'day' ? 1 : 1)), [140, 150, 160].map((v) => v * TOD[tod].k), wet));
    const gc = (a) => rgb(sh(B.g[a])), th = (i) => this.col(i);
    S.sky = sk; S.fog = FOG[S.wx];
    S.fogC = mix(sk[1], S.wx === 'snow' ? [240, 245, 250] : S.wx === 'dust' ? [220, 190, 130] : sk[1], 0.5);
    const night = tod === 'night';
    S.pal = {
      g1: gc(0), g2: gc(1), w1: rgb(shade([40, 110, 170], tod)), w2: rgb(shade([46, 120, 180], tod)), dark: tod !== 'day',
      r1: rgb(shade([66, 66, 72], tod)), r2: rgb(shade([58, 58, 64], tod)), lane: rgb(shade([225, 220, 200], tod)), ru1: rgb(shade([232, 226, 214], tod)), ru2: rgb(shade(S.B.snow ? [210, 60, 60] : [200, 55, 50], tod)),
      tw: rgb(shade([70, 72, 80], tod)), tc1: rgb(shade([46, 48, 56], tod)), tc2: rgb(shade([36, 38, 44], tod)), rock: rgb(shade([112, 104, 96], tod)), rail: rgb(shade([170, 175, 180], tod)),
      bake: { l1: rgb(shade(B === BIOMES.desert || B === BIOMES.canyon ? [110, 150, 60] : [70, 150, 60], tod)), l2: rgb(shade(B === BIOMES.coast ? [50, 130, 70] : B === BIOMES.alpine ? [40, 95, 70] : [40, 110, 50], tod)), trunk: rgb(shade([100, 70, 44], tod)), rock: rgb(shade(B === BIOMES.canyon || B === BIOMES.desert ? [190, 100, 60] : [140, 138, 134], tod)), rock2: rgb(shade(B === BIOMES.canyon || B === BIOMES.desert ? [150, 74, 44] : [100, 100, 100], tod)), snow: B.snow ? rgb(shade([245, 248, 252], tod)) : null, bl: [rgb(shade([150, 130, 120], tod)), rgb(shade([110, 120, 140], tod)), rgb(shade([160, 150, 130], tod)), rgb(shade([90, 100, 110], tod))], roof: rgb(shade([160, 70, 50], tod)), night, acc: [th(0), th(2), th(4), th(1)] }
    };
    S.layers = [{ kind: B.bg[0], col: rgb(sh(B.bg[1])), par: 0.35, amp: 70, p: prof(B.bg[0], R) }, { kind: B.bg[0], col: rgb(sh(B.bg[2])), par: 0.7, amp: 48, p: prof(B.bg[0], R) }];
    S.clouds = Array.from({ length: 6 }, () => ({ x: this.r(0, 540), y: this.r(20, 120), r: this.r(14, 30) }));
    S.stars = Array.from({ length: 50 }, () => [this.r(0, W), this.r(0, 190), this.r(0.4, 1.4)]);
    S.sunx = this.r(0.2, 0.8);
  }
  seg(z) { return this.segs[Math.floor(z / this.segLen) % this.segs.length]; }
  rate() { return 3.6 * (0.5 + 0.5 * Math.min(1, (this.speed / this.max) * 1.4)); }
  // ------------------------------------------------------------ input
  down(x) { this.steer = x < W / 2 ? -1 : 1; this.hold = 0.16; }
  move(x) { if (this.pointer.down) this.steer = x < W / 2 ? -1 : 1; }
  up() { this.steer = 0; }
  tap() {}
  autopilot(dt) {
    const look = 3500 + this.speed * 0.5, pz = this.pos + this.pz;
    if ((this.apT -= dt) <= 0) {
      this.apT = 0.05;
      const cost = (x) => {
        let c = Math.abs(x - this.px) * 0.8 + Math.abs(x) * 0.25;
        const lo = Math.min(x, this.px), hi = Math.max(x, this.px);
        for (const e of this.ents) {
          const dz = e.z - pz; if (e.dead || dz < -150 || dz > look) continue;
          const m = e.hw + 0.18 + (e.t === 'truck' || e.t === 'barrel' ? 0.12 : 0);
          if (Math.abs(e.off - x) < m) c += 8 + (1 - dz / look) * 30;
          else if (e.off > lo - m && e.off < hi + m && dz < look * 0.7) c += 12;
        }
        for (const f of this.fx) { const dz = f.z - pz; if (f.age < 1 && dz > -200 && dz < look && Math.abs(f.off - x) < 0.5) c += 25; }
        return c;
      };
      let best = this.apX, bc = cost(best) - 2;
      for (let x = -0.75; x < 0.76; x += 0.15) { const v = cost(x); if (v < bc) { bc = v; best = x; } }
      this.apX = best;
    }
    const s = this.seg(this.pos + 1200), sp = this.speed / this.max, r = this.rate();
    const vd = clamp((this.apX - this.px) * 6, -r, r) + s.curve * sp * sp * 0.3;
    this.steer = clamp(vd / r, -1, 1);
  }
  // ------------------------------------------------------------ simulation
  step(dt) {
    const L = this.segLen, N = this.segs.length;
    if (this.over > 0) { this.over -= dt; this.steer = 0; if (this.over <= 0) { this.restart(); return; } } else if ((this.time -= dt) <= 0) { this.time = 0; this.over = 2.8; this.msg = { t: 'TIME UP', sub: '', age: 0 }; }
    if (this.hold > 0) { this.hold -= dt; if (!this.pointer.down && !this.hold && this.auto === false) this.steer = 0; }
    const off = Math.abs(this.px), f = clamp((off - 1.02) / 0.2, 0, 1), cap = this.max * lerp(1, 0.45, f);
    if (this.over > 0) this.speed = Math.max(0, this.speed - 6000 * dt);
    else { this.speed = this.speed > cap ? Math.max(cap, this.speed - 7000 * dt) : Math.min(cap, this.speed + 5200 * dt); this.speed = Math.max(this.speed, this.max * 0.15); }
    const sp = this.speed / this.max, s = this.seg(this.pos + this.pz);
    this.pos += this.speed * dt;
    this.score = Math.floor(this.pos / 1000) + this.bonus;
    const st = this.stages[s.st];
    // steering: immediate and speed-sensitive, curves push outward, shoulders pull gently back
    const inp = this.hold > 0 && !this.steer ? 0 : this.steer;
    this.vx += (inp * this.rate() - this.vx) * (1 - Math.exp(-dt * (inp ? 16 : 24)));
    const pull = off > 1.05 ? -Math.sign(this.px) * clamp(off - 1.05, 0, 0.8) * 2.4 : 0;
    this.px += (this.vx - s.curve * sp * sp * 0.3 + pull) * dt;
    this.lean += (clamp(this.vx / 3.6, -1, 1) - this.lean) * (1 - Math.exp(-dt * 14));
    this.bgx -= s.curve * sp * dt * 22;
    // walls (tunnel, bridge) and the outer limit bounce instead of pinning
    this.wallCd -= dt;
    const lim = s.tun || s.br ? 1.1 : 2.25;
    if (Math.abs(this.px) > lim) { const d = -Math.sign(this.px); this.px = -d * lim; this.vx = d * 3; if (this.wallCd <= 0) { this.wallCd = 0.3; this.speed = Math.max(this.max * 0.2, this.speed * 0.9); this.sparks(d); } }
    // roadside objects
    const k = Math.floor((this.pos + this.pz) / L);
    if (this.wallCd <= 0 && lim > 2) for (let q = 0; q < 2; q++) for (const o of this.segs[(k + q) % N].sp) if (o.solid && !o.hit && Math.abs(this.px - o.off) < o.hw + 0.12) { this.knock(o, k + q); break; }
    // stage checkpoints
    const no = Math.floor(k / N) * this.stages.length + this.segs[k % N].st + 1;
    if (no > this.stageNo) { this.stageNo = no; const b = 22; this.time += b; this.bonus += 10; this.msg = { t: 'CHECKPOINT', sub: `STAGE ${no}  +${b}s`, age: 0 }; for (let i = 0; i < 3; i++) this.burst(W * (0.25 + i * 0.25), 110, this.col(i), 14, 200); }
    if (this.msg && (this.msg.age += dt) > 2.6) this.msg = null;
    // traffic
    this.stepEnts(dt);
    for (const e of this.fx) e.age += dt;
    this.fx = this.fx.filter((e) => e.age < 3.6);
    this.shake *= Math.exp(-dt * 5); this.flash *= Math.exp(-dt * 4); this.bump *= Math.exp(-dt * 8); this.bolt *= Math.exp(-dt * 6);
    this.hurt = Math.max(0, this.hurt - dt); this.spin = Math.max(0, this.spin - dt);
    if (this.smoke > 0) { this.smoke -= dt; if (Math.random() < dt * 40) this.pf.push({ x: W / 2 + (Math.random() - 0.5) * 30, y: H - 66, vx: (Math.random() - 0.5) * 20, vy: -60, r: 5, life: 0.8, max: 0.8, col: '60,60,64' }); }
    if (f > 0 && sp > 0.15 && Math.random() < dt * 50) this.pf.push({ x: W / 2 + (Math.random() - 0.5) * 70, y: H - 24, vx: (Math.random() - 0.5) * 60, vy: -30, r: 4, life: 0.6, max: 0.6, col: st.snow ? '240,245,250' : '150,125,80' });
    if (Math.abs(this.vx) > 2.4 && sp > 0.3 && f === 0 && Math.random() < dt * 30) this.pf.push({ x: W / 2 + Math.sign(this.vx) * -30, y: H - 22, vx: -this.vx * 10, vy: -15, r: 3, life: 0.5, max: 0.5, col: '220,220,220' });
    for (const p of this.pf) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.r += dt * 14; }
    this.pf = this.pf.filter((p) => p.life > 0);
    // weather
    const wx = st.wx;
    for (const p of this.wp) {
      if (wx === 'rain') { p.y += 620 * p.v * dt; p.x += (-this.vx * 30 - s.curve * 20) * dt; } else if (wx === 'snow') { p.y += 55 * p.v * dt; p.x += Math.sin(this.t * 1.5 + p.y * 0.04) * 18 * dt - this.vx * 20 * dt; } else if (wx === 'dust') { p.x -= 420 * p.v * dt; p.y += 6 * dt; }
      if (p.y > H) { p.y = -4; p.x = Math.random() * W; } if (p.x < -4) p.x = W + 4; if (p.x > W + 4) p.x = -4;
    }
    if (wx === 'rain' && (this.lt -= dt) < 0) { this.bolt = 1; this.lt = this.r(4, 9); }
  }
  sparks(d) { this.shake = Math.max(this.shake, 4); this.bump = 1; this.burst(W / 2 - d * 40, H - 40, '#ffc94a', 8, 200); }
  knock(o, k) {
    const d = -Math.sign(o.off);
    this.vx = d * 4.2; this.px += d * 0.06; this.speed = Math.max(this.max * 0.25, this.speed * 0.68); this.wallCd = 0.4; this.shake = Math.max(this.shake, 6); this.bump = 1;
    this.burst(W / 2 - d * 36, H - 44, '#ffd36a', 10, 220);
    if (o.b.brk || o.b.kind === 'tree' || o.b.kind === 'palm') o.hit = this.t;
    this.puff(this.segs[k % this.segs.length].i * this.segLen + this.segLen / 2, o.off, 0.45, o.b.img ? null : o.b.c);
  }
  stepEnts(dt) {
    const pz = this.pos + this.pz;
    while (this.nextZ < this.pos + 24000) {
      const z = this.nextZ, S = this.stages[this.seg(z).st];
      this.nextZ += this.r(3200, 6500) / S.B.traf;
      const roll = this.rng(), t = roll < 0.6 ? 'car' : roll < 0.72 ? 'truck' : roll < 0.84 ? 'barrel' : 'rock';
      const lanes = [-0.62, 0, 0.62].filter((l) => !this.ents.some((e) => Math.abs(e.z - z) < 4000 && Math.abs(e.off - l) < 0.3));
      if (lanes.length < 2) continue;
      const e = { t, z, off: lanes[this.ri(0, lanes.length - 1)] + this.r(-0.06, 0.06), v: 0, hw: 0.16, ww: 700 };
      if (t === 'car') { e.v = this.r(3500, 7800); if (this.traf.length && this.rng() < 0.5) e.img = this.traf[this.ri(0, this.traf.length - 1)]; else e.spr = this.tSpr.car[this.ri(0, 2)]; } else if (t === 'truck') { e.v = this.r(3000, 4400); e.hw = 0.27; e.ww = 1100; e.spr = this.tSpr.truck; } else if (t === 'barrel') { e.hw = 0.1; e.ww = 380; e.spr = this.tSpr.barrel; } else { e.hw = 0.12; e.ww = 600; e.spr = this.tSpr.rock; }
      e.v0 = e.v; this.ents.push(e);
    }
    for (const e of this.ents) {
      if (e.dead) continue;
      if (e.fuse > 0 && (e.fuse -= dt) <= 0) { this.explode(e); continue; }
      if (e.v) {
        let lead = null;
        for (const o of this.ents) if (o !== e && !o.dead && o.v && o.z > e.z && o.z - e.z < 1100 && Math.abs(o.off - e.off) < 0.3 && (!lead || o.z < lead.z)) lead = o;
        e.v += ((lead && lead.z - e.z < 900 ? Math.min(e.v0, lead.v) : e.v0) - e.v) * Math.min(1, dt * 4);
        e.z += e.v * dt;
        for (const o of this.ents) if (!o.v && !o.dead && o.t !== 'rock' + 'x' && Math.abs(o.z - e.z) < 160 && Math.abs(o.off - e.off) < e.hw + o.hw) { this.explode(e); if (o.t === 'barrel') this.explode(o); else o.dead = true; break; }
      }
      const dz = e.z - pz;
      if (!e.dead && this.hurt <= 0 && Math.abs(dz) < 140 && Math.abs(e.off - this.px) < e.hw + 0.12) this.crash(e);
    }
    this.ents = this.ents.filter((e) => !e.dead && e.z > this.pos - 1500);
  }
  explode(e) {
    if (e.dead) return; e.dead = true;
    const big = e.t === 'truck', rock = e.t === 'rock';
    this.boom(e.z, e.off, big ? 1.5 : e.t === 'barrel' ? 1.1 : rock ? 0.5 : 1, e);
    if (big || e.t === 'barrel') this.blast(e.z, e.off, big ? 1400 : 950);
  }
  blast(z, off, r) {
    for (const o of this.ents) if (!o.dead && !o.fuse && o.t !== 'rock' && Math.abs(o.z - z) < r && Math.abs(o.off - off) < 0.9) o.fuse = this.r(0.1, 0.35);
    if (this.hurt <= 0 && Math.abs(z - (this.pos + this.pz)) < r * 0.6 && Math.abs(this.px - off) < 0.5) { this.speed = Math.max(this.max * 0.2, this.speed * 0.7); this.hurt = 0.8; this.spin = 0.4; this.spinDir = Math.random() < 0.5 ? 1 : -1; this.shake = 12; this.flash = 0.7; }
  }
  crash(e) {
    const big = e.t === 'truck' || e.t === 'barrel', rock = e.t === 'rock';
    this.explode(e);
    this.hurt = 1.1; this.speed = Math.max(this.max * 0.18, this.speed * (rock ? 0.7 : big ? 0.35 : 0.5));
    this.spin = rock ? 0.3 : big ? 0.9 : 0.6; this.spinDir = this.px >= e.off ? 1 : -1; this.vx = this.spinDir * 3.2; this.shake = rock ? 6 : big ? 16 : 11; this.flash = rock ? 0.2 : big ? 1 : 0.6; this.bump = 1; this.smoke = rock ? 0 : 2.5;
    this.burst(W / 2, H - 60, '#ffb13a', rock ? 8 : 26, 260); this.burst(W / 2, H - 60, '#fff3b0', rock ? 4 : 12, 320);
  }
  puff(z, off, size, canvas) { this.boom(z, off, size, null, true, canvas); }
  boom(z, off, size, e, small, canvas) {
    const R = () => Math.random(), rr = (a, b) => a + R() * (b - a);
    const img = e && e.img && ready(e.img) ? e.img : null;
    const fx = { z, off, age: 0, size, small, fire: [], smoke: [], deb: [], flames: [] };
    const src = img || canvas || (e && e.spr && e.spr.c);
    if (!small) {
      for (let i = 0; i < 9; i++) fx.fire.push({ x: rr(-500, 500) * size, y: rr(0, 700) * size, vx: rr(-600, 600), vy: rr(300, 1200), r: rr(350, 700) * size, d: rr(0, 0.18), l: rr(0.35, 0.7) });
      for (let i = 0; i < 8; i++) fx.flames.push({ x: rr(-350, 350) * size, r: rr(250, 450) * size, ph: R() });
    }
    for (let i = 0; i < (small ? 5 : 11); i++) fx.smoke.push({ x: rr(-400, 400) * size, y: rr(100, 400) * size, vx: rr(-300, 300), vy: rr(500, 1100), r: rr(300, 600) * size, d: small ? rr(0, 0.2) : rr(0.1, 0.9), l: rr(1.2, 2.4) });
    const nd = Math.round((small ? 8 : 16) * Math.max(0.7, size));
    for (let i = 0; i < nd; i++) {
      const dd = { vx: rr(-3200, 3200) * size, vy: rr(1800, 5200) * size, rot: R() * 6, vr: rr(-12, 12), w: rr(60, 150) * size, spark: !small && i % 3 === 0, col: pick(() => R(), ['#ffb13a', '#e24a1a', '#333', '#ccc', this.col(i)]) };
      if (src && !dd.spark) { const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height; dd.sw = iw * rr(0.2, 0.4); dd.sh = ih * rr(0.2, 0.4); dd.sx = rr(0, iw - dd.sw); dd.sy = rr(0, ih - dd.sh); dd.src = src; }
      fx.deb.push(dd);
    }
    this.fx.push(fx); if (this.fx.length > 8) this.fx.shift();
    const dz = z - (this.pos + this.pz); if (!small) this.shake = Math.max(this.shake, Math.min(10, 6000 * size / (400 + Math.abs(dz))));
  }
  // ------------------------------------------------------------ drawing
  drawBack(c, S, a, hz) {
    c.globalAlpha = a;
    const tod = S.tod, night = tod === 'night', sx = (this.bgx * 0.08) % W;
    if (night) { c.fillStyle = '#fff'; for (const [x, y, r] of S.stars) { c.globalAlpha = a * (0.5 + 0.5 * Math.sin(this.t * 2 + x)) * r / 1.4; c.fillRect(((x + this.bgx * 0.05) % W + W) % W, y, r, r); } c.globalAlpha = a; }
    const g = glows(), sunX = ((W * S.sunx + sx) % W + W) % W, sunY = tod === 'dusk' ? hz - 22 : hz - 85;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * (night ? 0.3 : 0.8); c.drawImage(g.white, sunX - 60, sunY - 60, 120, 120); c.globalCompositeOperation = 'source-over'; c.globalAlpha = a;
    c.fillStyle = night ? '#e8ecf5' : tod === 'dusk' ? '#ffb070' : '#fff6cc'; c.beginPath(); c.arc(sunX, sunY, night ? 14 : 22, 0, 7); c.fill();
    const bs = this.skin.bgSet;
    if (bs && bs[0] && ready(bs[0])) {
      const im = bs[0], h = hz + 10, w = Math.max(W * 1.5, im.naturalWidth * h / im.naturalHeight), o = (((this.bgx * 0.25) % w) + w) % w;
      c.globalAlpha = a * (night ? 0.5 : 0.85); c.drawImage(im, -o, 0, w, h); c.drawImage(im, w - o, 0, w, h);
      if (bs[1] && ready(bs[1])) { const im2 = bs[1], w2 = Math.max(W * 1.5, im2.naturalWidth * hz * 0.6 / im2.naturalHeight), o2 = (((this.bgx * 0.5) % w2) + w2) % w2; c.globalAlpha = a * 0.35; c.drawImage(im2, -o2, 0, w2, hz * 0.6); c.drawImage(im2, w2 - o2, 0, w2, hz * 0.6); }
      if (night) { c.globalAlpha = a * 0.55; c.fillStyle = 'rgb(5,10,40)'; c.fillRect(0, 0, W, hz); }
      c.globalAlpha = a;
    } else if (!night) { c.fillStyle = tod === 'dusk' ? 'rgba(255,200,170,.75)' : 'rgba(255,255,255,.8)'; for (const k of S.clouds) { const x = (((k.x + this.bgx * 0.3) % 540) + 540) % 540 - 90; for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.2, 0.8], [-0.9, 0.25, 0.7], [0.3, -0.35, 0.7]]) { c.beginPath(); c.ellipse(x + dx * k.r, k.y + dy * k.r * 0.7, k.r * r, k.r * r * 0.55, 0, 0, 7); c.fill(); } } }
    for (const l of S.layers) {
      const sc = ((this.bgx * l.par + this.px * l.par * 14) % 360 + 360) % 360;
      c.fillStyle = l.col; c.beginPath(); c.moveTo(-12, hz + 2);
      for (let x = -12; x <= W + 12; x += 6) c.lineTo(x, hz - l.p[Math.floor(((x + sc) % 360 + 360) % 360 / 6) % 60] * l.amp);
      c.lineTo(W + 12, hz + 2); c.fill();
      if (night && l.kind === 'skyline' && l.par > 0.5) { c.fillStyle = 'rgba(255,220,130,.7)'; for (let x = -12; x <= W; x += 6) { const i = Math.floor(((x + sc) % 360 + 360) % 360 / 6) % 60, h = l.p[i] * l.amp; if (i % 3 === 0) c.fillRect(x, hz - h * 0.6, 2, 2); } }
    }
    c.globalAlpha = 1;
  }
  fxDraw(c, f, d, sc, x, y) {
    const ux = sc * W / 2, g = glows(), age = f.age, S = f.size;
    c.save();
    for (const p of f.smoke) { const a = age - p.d; if (a < 0 || a > p.l) continue; const t = a / p.l, r = p.r * (0.6 + 1.4 * t) * ux; c.globalAlpha = 0.75 * (1 - t); c.drawImage(g.smoke, x + (p.x + p.vx * a) * ux - r, y - (p.y + p.vy * a) * ux - r, r * 2, r * 2); }
    if (f.flames.length && age > 0.3 && age < 3.2) { c.globalCompositeOperation = 'lighter'; for (const p of f.flames) { const t = (age * 1.6 + p.ph) % 1, r = p.r * (1 - t * 0.5) * ux; c.globalAlpha = (1 - t) * clamp((3.2 - age) / 1.2, 0, 1); c.drawImage(g.fire, x + p.x * ux - r, y - (150 + t * 700) * ux - r, r * 2, r * 2); } }
    c.globalCompositeOperation = 'lighter';
    for (const p of f.fire) { const a = age - p.d; if (a < 0 || a > p.l) continue; const t = a / p.l, r = p.r * (0.5 + 1.2 * t) * ux; c.globalAlpha = (1 - t) ** 1.2; c.drawImage(g.fire, x + (p.x + p.vx * a) * ux - r, y - (p.y + p.vy * a) * ux - r, r * 2, r * 2); }
    if (age < 0.16 && !f.small) { const r = (500 + age * 6000) * S * ux; c.globalAlpha = 1 - age / 0.16; c.drawImage(g.white, x - r, y - r * 0.6 - 200 * ux, r * 2, r * 2); }
    c.globalCompositeOperation = 'source-over';
    if (age < 0.55 && !f.small) { const r = age * 9000 * S * ux; c.globalAlpha = 1 - age / 0.55; c.strokeStyle = '#ffe9c0'; c.lineWidth = 3 * (1 - age / 0.55) + 0.5; c.beginPath(); c.ellipse(x, y, r, r * 0.28, 0, 0, 7); c.stroke(); }
    for (const p of f.deb) {
      const yy = Math.max(0, 100 + p.vy * age - 4500 * age * age), xx = p.vx * age; if (yy <= 0 && age > 1.6) continue;
      const px = x + xx * ux, py = y - yy * ux, w = p.w * ux * (1 + age * 0.6);
      c.globalAlpha = clamp((2.2 - age) / 0.8, 0, 1);
      if (p.spark) { c.strokeStyle = '#ffd36a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, py); c.lineTo(px - p.vx * 0.03 * ux, py + (p.vy - 9000 * age) * 0.03 * ux); c.stroke(); continue; }
      c.save(); c.translate(px, py); c.rotate(p.rot + p.vr * age);
      if (p.src) c.drawImage(p.src, p.sx, p.sy, p.sw, p.sh, -w / 2, -w / 2, w, w); else { c.fillStyle = p.col; c.fillRect(-w / 2, -w / 3, w, w * 0.66); }
      c.restore();
    }
    c.restore();
  }
  clipDraw(c, d, y, fn) { if (y > d.clip + 2) { c.save(); c.beginPath(); c.rect(-12, -12, W + 24, d.clip + 12); c.clip(); fn(); c.restore(); } else fn(); }
  draw(c) {
    const { segs, segLen: L, drawN, depth } = this, N = segs.length, hz = H / 2, pool = this.pool, nSt = this.stages.length;
    const k0 = Math.floor(this.pos / L), base = segs[k0 % N], bp = (this.pos % L) / L;
    const S = this.stages[base.st], NX = this.stages[(base.st + 1) % nSt], toEnd = S.b - (k0 % N), kk = toEnd < 100 ? clamp(1 - (toEnd - 10) / 90, 0, 1) : 0, cur = kk > 0.5 ? NX : S;
    c.save();
    if (this.shake > 0.3 || this.px > 1.02 || this.px < -1.02) { const m = this.shake + (Math.abs(this.px) > 1.02 ? 1.2 * this.speed / this.max : 0); c.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m); }
    const top = mix(S.sky[0], NX.sky[0], kk), bot = mix(S.sky[1], NX.sky[1], kk);
    const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot)); c.fillStyle = g; c.fillRect(-12, -12, W + 24, hz + 12);
    this.drawBack(c, S, 1, hz); if (kk > 0) this.drawBack(c, NX, kk, hz);
    const far = this.stages[segs[(k0 + drawN - 1) % N].st].pal;
    c.fillStyle = far.g1; c.fillRect(-12, hz - 1, W + 24, H - hz + 12);
    // ---- road, front to back
    const cam = this.px * this.roadW, camY = this.camH + base.y1 + (base.y2 - base.y1) * bp, cw = W / 2, chh = H / 2;
    let x = 0, dx = -(base.curve * bp), maxy = H + 20;
    for (let n = 0; n < drawN; n++) {
      const s = segs[(k0 + n) % N], d = pool[n]; d.vis = false; d.es.length = 0; d.fx.length = 0;
      const z1 = (k0 + n) * L, dz1 = z1 - this.pos;
      if (dz1 <= depth) { x += dx; dx += s.curve; continue; }
      const sc1 = depth / dz1, sc2 = depth / (dz1 + L), c1 = cam - x, c2 = cam - x - dx;
      const x1 = cw - sc1 * c1 * cw, y1 = chh - sc1 * (s.y1 - camY) * chh, w1 = sc1 * this.roadW * cw;
      const x2 = cw - sc2 * c2 * cw, y2 = chh - sc2 * (s.y2 - camY) * chh, w2 = sc2 * this.roadW * cw;
      x += dx; dx += s.curve;
      if (y2 >= y1 || y2 >= maxy) continue;
      d.vis = true; d.s = s; d.clip = maxy; d.x1 = x1; d.y1 = y1; d.w1 = w1; d.c1 = sc1; d.x2 = x2; d.y2 = y2; d.w2 = w2; d.c2 = sc2; maxy = y2;
      const P = this.stages[s.st].pal, alt = (s.i / 3 | 0) & 1;
      c.fillStyle = s.br ? (alt ? P.w1 : P.w2) : alt ? P.g1 : P.g2; c.fillRect(-12, y2, W + 24, y1 - y2 + 1);
      if (s.sea && !s.br) { c.fillStyle = alt ? P.w1 : P.w2; const a1 = x1 + s.sea * w1 * 1.7, a2 = x2 + s.sea * w2 * 1.7, ex = s.sea < 0 ? -12 : W + 12; poly(c, ex, y1 + 1, a1, y1 + 1, a2, y2, ex, y2); }
      quad(c, x1, y1, w1 * 1.15, x2, y2, w2 * 1.15, s.br ? P.rail : alt ? P.ru1 : P.ru2);
      quad(c, x1, y1, w1, x2, y2, w2, alt ? P.r1 : P.r2);
      if (alt) for (const l of [-2 / 3, 2 / 3]) quad(c, x1 + w1 * l, y1, w1 * 0.02, x2 + w2 * l, y2, w2 * 0.02, P.lane);
      if (s.ga === 'gate') { c.fillStyle = '#fff'; poly(c, x1 - w1, y1, x2 - w2, y2, x2 + w2, y2, x1 + w1, y1); c.fillStyle = '#111'; c.beginPath(); for (let j = 1; j < 8; j += 2) { const a = -1 + j / 4, b = a + 0.25; c.moveTo(x1 + w1 * a, y1); c.lineTo(x1 + w1 * b, y1); c.lineTo(x2 + w2 * b, y2); c.lineTo(x2 + w2 * a, y2); } c.fill(); }
    }
    // entities and fx to their segments
    for (const e of this.ents) { const n = Math.floor(e.z / L) - k0; if (n > 0 && n < drawN && pool[n].vis) pool[n].es.push(e); }
    for (const f of this.fx) { const n = Math.floor(f.z / L) - k0; if (n > 0 && n < drawN && pool[n].vis) pool[n].fx.push(f); }
    const night = cur.pal.dark, gl = glows();
    // ---- scenery, back to front
    for (let n = drawN - 1; n > 0; n--) {
      const d = pool[n]; if (!d.vis) continue;
      const s = d.s, P = this.stages[s.st].pal, fade = n > drawN - 14 ? (drawN - n) / 14 : 1;
      c.globalAlpha = fade;
      if (s.tun) this.drawTun(c, d, s, P, gl);
      if (s.br) for (const side of [-1, 1]) { const xa = d.x1 + side * d.w1 * 1.1, xb = d.x2 + side * d.w2 * 1.1; c.fillStyle = P.rail; poly(c, xa, d.y1, xa, d.y1 - d.c1 * 110 * chh, xb, d.y2 - d.c2 * 110 * chh, xb, d.y2); }
      if (s.ga) this.drawGantry(c, d, s);
      for (const o of s.sp) {
        const ux = d.c1 * cw, dw = ux * o.b.ww * o.s; if (dw < 1.4) continue;
        const sx = d.x1 + d.w1 * o.off, dh = dw * o.b.ar; let fall = 0;
        if (o.hit) { fall = (this.t - o.hit) * 3.5; if (fall > 3) continue; }
        this.clipDraw(c, d, d.y1, () => {
          if (fall) { c.save(); c.translate(sx, d.y1); c.rotate(Math.min(1.5, fall) * (o.off > 0 ? 1 : -1)); c.globalAlpha = fade * clamp(1 - (fall - 1.5) / 1.5, 0, 1); c.translate(-sx, -d.y1); }
          if (o.b.img) drawFit(c, o.b.img, sx, d.y1 - dw / 2, dw, dw);
          else {
            if (o.flip) { c.save(); c.translate(sx, 0); c.scale(-1, 1); c.drawImage(o.b.c, -dw / 2, d.y1 - dh, dw, dh); c.restore(); } else c.drawImage(o.b.c, sx - dw / 2, d.y1 - dh, dw, dh);
            if (o.bb && ready(o.bb)) { const pn = o.b.pan; drawFit(c, o.bb, sx - dw / 2 + dw * (pn[0] + pn[2] / 2), d.y1 - dh + dh * (pn[1] + pn[3] / 2), dw * pn[2] * 0.96, dh * pn[3] * 0.96); }
            if (P.dark && (o.b.kind === 'lamp' || o.b.kind === 'bb')) { c.globalCompositeOperation = 'lighter'; const gx = o.b.kind === 'lamp' ? sx + (o.flip ? -1 : 1) * (o.b.hx - 0.5) * dw : sx, gy = d.y1 - dh * (o.b.kind === 'lamp' ? 0.88 : 0.7), r = o.b.kind === 'lamp' ? dw * 1.6 : dw * 0.5; c.globalAlpha = fade * (o.b.kind === 'lamp' ? 0.9 : 0.22); c.drawImage(gl.warm, gx - r, gy - r, r * 2, r * 2); c.globalCompositeOperation = 'source-over'; }
          }
          if (fall) c.restore();
        });
        c.globalAlpha = fade;
      }
      for (const e of d.es) {
        const f = e.z / L - Math.floor(e.z / L), sc = lerp(d.c1, d.c2, f), ex = lerp(d.x1, d.x2, f), ey = lerp(d.y1, d.y2, f), ew = lerp(d.w1, d.w2, f), sx = ex + ew * e.off, dw = sc * cw * e.ww;
        if (dw < 1.5) continue;
        this.clipDraw(c, d, ey, () => {
          c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(sx, ey, dw * 0.55, dw * 0.1, 0, 0, 7); c.fill();
          if (e.spr) c.drawImage(e.spr.c, sx - dw / 2, ey - dw * e.spr.ar, dw, dw * e.spr.ar); else if (!drawFit(c, e.img, sx, ey - dw * 0.4, dw, dw * 0.8)) { c.fillStyle = this.col(4); c.fillRect(sx - dw / 2, ey - dw * 0.5, dw, dw * 0.5); }
          if (night && e.v) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = fade * 0.7; for (const sd of [-0.4, 0.4]) { const r = dw * 0.22; c.drawImage(gl.fire, sx + sd * dw - r, ey - dw * 0.3 - r, r * 2, r * 2); } c.globalCompositeOperation = 'source-over'; }
        });
        c.globalAlpha = fade;
      }
      for (const f of d.fx) { const fr = f.z / L - Math.floor(f.z / L); this.fxDraw(c, f, d, lerp(d.c1, d.c2, fr), lerp(d.x1, d.x2, fr) + lerp(d.w1, d.w2, fr) * f.off, lerp(d.y1, d.y2, fr)); }
    }
    c.globalAlpha = 1;
    // ---- fog and haze
    const fg = cur.fog;
    if (fg > 0.05) { const gr = c.createLinearGradient(0, hz - 70, 0, hz + 30 + fg * 120); const fc = cur.fogC; gr.addColorStop(0, rgb(fc, 0)); gr.addColorStop(0.35, rgb(fc, Math.min(0.95, fg + 0.15))); gr.addColorStop(1, rgb(fc, 0)); c.fillStyle = gr; c.fillRect(-12, hz - 70, W + 24, 100 + fg * 120 + 12); }
    // ---- the player
    this.drawPlayer(c, night);
    for (const p of this.pf) { c.globalAlpha = Math.max(0, p.life / p.max) * 0.55; c.fillStyle = `rgb(${p.col})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    // speed lines
    const sp = this.speed / this.max;
    if (sp > 0.8) { c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * 0.63 + this.t * 3 % 0.63, r0 = 150 + (i * 53 + this.t * 600) % 80; c.moveTo(W / 2 + Math.cos(a) * r0, hz + 40 + Math.sin(a) * r0 * 0.8); c.lineTo(W / 2 + Math.cos(a) * (r0 + 36), hz + 40 + Math.sin(a) * (r0 + 36) * 0.8); } c.stroke(); }
    // weather
    const wx = cur.wx;
    if (wx === 'rain') { c.strokeStyle = 'rgba(200,215,235,.45)'; c.lineWidth = 1; c.beginPath(); for (const p of this.wp) { c.moveTo(p.x, p.y); c.lineTo(p.x + this.vx * 1.5 - 1, p.y + 11); } c.stroke(); } else if (wx === 'snow') { c.fillStyle = 'rgba(255,255,255,.85)'; for (const p of this.wp) c.fillRect(p.x, p.y, 1 + p.v, 1 + p.v); } else if (wx === 'dust') { c.strokeStyle = 'rgba(225,195,140,.35)'; c.beginPath(); for (const p of this.wp) { c.moveTo(p.x, p.y); c.lineTo(p.x + 22, p.y); } c.stroke(); }
    if (this.bolt > 0.05) { c.fillStyle = `rgba(230,235,255,${this.bolt * 0.5})`; c.fillRect(-12, -12, W + 24, H + 24); }
    if (this.flash > 0.03) { c.fillStyle = `rgba(255,${200 + this.flash * 50 | 0},140,${this.flash * 0.6})`; c.fillRect(-12, -12, W + 24, H + 24); }
    c.restore();
    // ---- HUD
    const lab = (s, x, y, sz, al = 'right') => { c.font = `700 ${sz}px ui-monospace, monospace`; c.textAlign = al; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(s, x, y); c.fillStyle = this.time < 8 ? '#ff6b5a' : '#fff'; c.fillText(s, x, y); };
    lab(`TIME ${Math.ceil(this.time)}`, W - 10, 18, 15); c.font = '700 10px ui-monospace, monospace'; lab(S.B.n + (S.wx !== 'clear' ? ' · ' + S.wx.toUpperCase() : ''), W - 10, 36, 10);
    lab(`${Math.round(this.speed / 60)} km/h`, W - 10, H - 12, 12);
    if (this.msg) { const m = this.msg, a = clamp(Math.min(m.age * 4, (2.6 - m.age) * 2), 0, 1); c.globalAlpha = a; lab(m.t, W / 2, 112 - (1 - a) * 8, 26, 'center'); if (m.sub) lab(m.sub, W / 2, 140, 14, 'center'); c.globalAlpha = 1; }
  }
  drawTun(c, d, s, P, gl) {
    const th = 1700, hh = H / 2, cy1 = d.y1 - d.c1 * th * hh, cy2 = d.y2 - d.c2 * th * hh;
    const xl1 = d.x1 - d.w1 * 1.15, xr1 = d.x1 + d.w1 * 1.15, xl2 = d.x2 - d.w2 * 1.15, xr2 = d.x2 + d.w2 * 1.15;
    c.fillStyle = P.tw; poly(c, xl1, d.y1, xl1, cy1, xl2, cy2, xl2, d.y2); poly(c, xr1, d.y1, xr1, cy1, xr2, cy2, xr2, d.y2);
    c.fillStyle = (s.i >> 1) & 1 ? P.tc1 : P.tc2; poly(c, xl1, cy1, xr1, cy1, xr2, cy2, xl2, cy2);
    if (s.i % 6 === 0) { c.globalCompositeOperation = 'lighter'; const r = d.c1 * 900 * W / 2; c.globalAlpha = 0.85; c.drawImage(gl.warm, d.x1 - r, cy1 - r * 0.5, r * 2, r); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    if (s.portal) {
      const yt = cy1 - (d.y1 - cy1) * 1.3, w = d.w1;
      c.fillStyle = P.rock; c.beginPath(); c.moveTo(d.x1 - 4 * w, d.y1); c.lineTo(d.x1 - 2.4 * w, yt); c.lineTo(d.x1 + 2.4 * w, yt); c.lineTo(d.x1 + 4 * w, d.y1); c.closePath(); c.moveTo(xl1, d.y1); c.lineTo(xl1, cy1); c.lineTo(xr1, cy1); c.lineTo(xr1, d.y1); c.closePath(); c.fill('evenodd');
      c.strokeStyle = '#d8d2c4'; c.lineWidth = Math.max(1, w * 0.06); c.beginPath(); c.moveTo(xl1, d.y1); c.lineTo(xl1, cy1); c.lineTo(xr1, cy1); c.lineTo(xr1, d.y1); c.stroke();
    }
  }
  drawGantry(c, d, s) {
    const hh = H / 2, th = 2600, cy = d.y1 - d.c1 * th * hh, t = d.c1 * 200 * hh, xl = d.x1 - d.w1 * 1.25, xr = d.x1 + d.w1 * 1.25;
    c.fillStyle = '#4a4d55'; c.fillRect(xl - t / 2, cy, t, d.y1 - cy); c.fillRect(xr - t / 2, cy, t, d.y1 - cy); c.fillRect(xl - t / 2, cy, xr - xl + t, t * 1.6);
    if (s.ga === 'gate') {
      const bw = xr - xl - t, bh = t * 3.4, bx = xl + t / 2, by = cy + t * 1.6, cell = bh / 3; c.fillStyle = '#fff'; c.fillRect(bx, by, bw, bh); c.fillStyle = '#111';
      if (cell > 1.5) for (let i = 0; i * cell < bw; i++) for (let j = 0; j < 3; j++) if ((i + j) & 1) c.fillRect(bx + i * cell, by + j * cell, Math.min(cell, bw - i * cell), cell);
      c.fillStyle = '#ffd21f'; c.fillRect(bx + bw * 0.2, by + bh * 0.15, bw * 0.6, bh * 0.7);
      if (bh > 8) { c.fillStyle = '#111'; c.font = `700 ${bh * 0.5}px ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.i < 20 ? 'START' : 'CHECKPOINT', bx + bw / 2, by + bh / 2); }
    }
  }
  drawPlayer(c, night) {
    const sp = this.speed / this.max, bounce = Math.sin(this.t * 30) * sp * 1.2 - this.bump * 3, yy = H - 46 + bounce;
    if (this.hurt > 0 && ((this.t * 18) | 0) % 2 && this.spin <= 0) return;
    if (night) { const gr = c.createLinearGradient(0, H - 70, 0, H / 2 + 20); gr.addColorStop(0, 'rgba(255,245,200,.3)'); gr.addColorStop(1, 'rgba(255,245,200,0)'); c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; poly(c, W / 2 - 26, H - 70, W / 2 + 26, H - 70, W / 2 + 130, H / 2 + 20, W / 2 - 130, H / 2 + 20); c.globalCompositeOperation = 'source-over'; }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(W / 2, H - 16, 50 * this.S, 8, 0, 0, 7); c.fill();
    const rot = this.lean * 0.14 + (this.spin > 0 ? (1 - this.spin / 0.9) * 6.283 * this.spinDir : 0), sx = W / 2 + this.lean * 5, sq = 1 - this.bump * 0.06;
    c.save(); c.translate(sx, yy); c.scale(1, sq); c.translate(-sx, -yy);
    if (!drawFit(c, this.carImg, sx, yy, 92 * this.S, 64 * this.S, rot)) {
      c.save(); c.translate(sx, yy + 6); c.rotate(rot); c.fillStyle = this.col(0); roundRect(c, -34, -18, 68, 30, 8); c.fill(); c.fillStyle = '#111'; c.fillRect(-30, 8, 14, 8); c.fillRect(16, 8, 14, 8); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-18, -14, 36, 10); c.restore();
    }
    c.restore();
  }
  hud() { return `${this.score} km · stage ${this.stageNo} · ${Math.ceil(this.time)}s`; }
}
