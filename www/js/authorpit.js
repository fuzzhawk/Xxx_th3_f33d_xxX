// The Author Pit: a card where fourteen writers, drawn as Crystal Sprite characters in a small sunken
// garden, make one thing together. The script (authorpit-script.js) plays in real time while the
// card is on screen: they walk to the table, argue, split up in pairs (each pair in its own corner:
// the café, the crypt door, the cut-up table, the old tree, the orgone box, the river, the
// chalkboard), come back, decide, write the book a door at a time and sit by the fire after. Where
// you left off is kept, so it carries on the next time the card comes round. A tap moves it on.
import { Actor, crystalSheet } from './crystal/sprites.js';
import { mulberry32 } from './util.js';
import { AUTHORS, SCRIPT } from './authorpit-script.js';

const W = 360, H = 420, T = 16, MW = 36, MH = 28, Z = 1.5, VW = W / Z, VH = H / Z;
const KEYS = Object.keys(AUTHORS);
const GAIT = { mode: 'eight', walkSpeed: 7.5, runSpeed: 55, walkStride: 5, runStride: 6.5 };
const STORE = 'pit.beat';

// ------------------------------------------------ the script, parsed once
let BEATS = null;
function beats() {
  if (BEATS) return BEATS;
  BEATS = [];
  let act = 0;
  for (const raw of SCRIPT.split('\n')) {
    const s = raw.trim();
    if (!s) continue;
    if (s[0] === '#') { BEATS.push({ k: 'act', text: s.slice(1).trim(), act: ++act }); continue; }
    if (s[0] === '>') { const w = s.slice(1).trim().split(/\s+/), spot = w.pop(); BEATS.push({ k: 'move', who: w[0] === 'ALL' ? KEYS : w, spot, act }); continue; }
    if (s[0] === '~') { BEATS.push({ k: 'note', text: s.slice(1).trim(), act }); continue; }
    const door = s.match(/^!\s*DOOR\s+(\d+)\s+(\w+):\s*(.*)$/);
    if (door) { BEATS.push({ k: 'door', n: +door[1], who: door[2], text: door[3], act }); continue; }
    const m = s.match(/^(\w+):\s*(.*?)\s*(?:\{(\w+)\})?$/);
    if (m && AUTHORS[m[1]]) BEATS.push({ k: 'say', who: m[1], text: m[2], emote: m[3] || null, act });
  }
  return BEATS;
}

// ------------------------------------------------ the place
// spots in tiles: where each corner's pair stands (two places), the table's seats, the fire's ring
const SPOT = { cafe: [29, 21], crypt: [6, 5], cutup: [5, 14], tree: [8, 21], orgone: [30, 12], river: [18, 25], board: [18, 4] };
const TABLE = [18, 13.5], FIRE = [18, 19];
function seatsAround(cx, cy, rx, ry, n, a0 = 0) { return Array.from({ length: n }, (_, k) => { const a = a0 + (k / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; }); }
const SEATS = { table: seatsAround(TABLE[0], TABLE[1] + 0.3, 4.6, 2.4, 14, -Math.PI / 2), fire: seatsAround(FIRE[0], FIRE[1], 3.6, 2.2, 14, -Math.PI / 2) };

const LIGHT = [null, { tint: '#ff9a5a', k: 0.16, dark: 0.18 }, { tint: '#ffc070', k: 0.12, dark: 0.05 }, { tint: '#ffd890', k: 0.08, dark: 0 }, { tint: '#8a6ac8', k: 0.18, dark: 0.22 }, { tint: '#6a4a9a', k: 0.22, dark: 0.36 }, { tint: '#2a2a6a', k: 0.28, dark: 0.55 }];

function paintMap() {
  const cv = document.createElement('canvas'); cv.width = MW * T; cv.height = MH * T;
  const c = cv.getContext('2d'), R = mulberry32(1914);
  const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const ell = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
  // grass, then the sunken stone floor of the pit with its ring of steps, paths to the corners
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { px(x * T, y * T, T, T, ['#5e8a4a', '#58844a', '#628e4e'][(x * 7 + y * 3) % 3]); for (let k = 0; k < 6; k++) px(x * T + R() * 15, y * T + R() * 14, 1, 2, R() < 0.5 ? '#4a7438' : '#76a05a'); if (R() < 0.12) { const fx = x * T + 3 + R() * 10, fy = y * T + 3 + R() * 10; px(fx - 1, fy, 3, 1, ['#ffd23f', '#ff9ac0', '#ffffff', '#b28dff'][(R() * 4) | 0]); px(fx, fy - 1, 1, 3, '#ffe08a'); } }
  const cx = TABLE[0] * T, cy = (TABLE[1] + 1) * T;
  for (const [r, col] of [[12.5, '#6a6258'], [11.6, '#8a8276'], [10.8, '#77705f'], [10, '#9a9286']]) ell(cx, cy, r * T, r * T * 0.82, col);
  for (let k = 0; k < 220; k++) { const a = R() * 6.283, d = Math.sqrt(R()) * 9.6 * T; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.82; px(x, y, 6 + R() * 6, 4 + R() * 4, R() < 0.5 ? '#8e8678' : '#a49c8e'); px(x, y, 3, 1, '#b8b0a2'); }
  for (const [sx, sy] of Object.values(SPOT)) { let x = cx, y = cy; const tx = sx * T + 8, ty = sy * T + 8; for (let q = 0; q < 60; q++) { x += (tx - x) / (60 - q); y += (ty - y) / (60 - q); if (Math.hypot(x - cx, (y - cy) / 0.82) < 10 * T) continue; ell(x, y, 9, 6, '#c8aa7a'); } }
  // the river along the foot, a plank bridge, reeds
  for (let x = 0; x < MW * T; x++) { const y0 = 25.6 * T + Math.sin(x * 0.05) * 6; px(x, y0, 1, MH * T - y0, '#4a8ab8'); px(x, y0, 1, 3, '#8ac8e8'); if (x % 9 === 0) px(x, y0 + 8 + (x % 5), 4, 1, '#bfe8ff'); }
  for (let x = 21 * T; x < 24 * T; x += 4) px(x, 25.2 * T, 3, 3 * T, '#8a6440');
  for (let k = 0; k < 40; k++) { const x = R() * MW * T, y = 25.3 * T + Math.sin(x * 0.05) * 6; px(x, y - 10, 1, 10, '#5a8a3a'); px(x, y - 12, 1, 3, '#a07a4a'); }
  // trees round the edge
  const tree = (x, y, s) => { ell(x, y + 2, 10 * s, 4 * s, 'rgba(0,0,0,.2)'); px(x - 2 * s, y - 14 * s, 4 * s, 16 * s, '#6a4a32'); for (let q = 0; q < 7; q++) ell(x + (R() - 0.5) * 18 * s, y - 20 * s + (R() - 0.5) * 12 * s, 9 * s, 7 * s, ['#3f7a42', '#4a8a4c', '#58984f'][q % 3]); };
  for (let k = 0; k < 26; k++) { const a = (k / 26) * 6.283, x = cx + Math.cos(a) * 17 * T, y = cy + Math.sin(a) * 13 * T; if (y > 24 * T || y < 2 * T || x < T || x > (MW - 1) * T) continue; tree(x, y, 0.9 + R() * 0.4); }
  return cv;
}
// the things in the pit, drawn over the floor (and sorted with the people by their feet)
function propList() {
  return [
    { k: 'table', x: TABLE[0] * T, y: (TABLE[1] + 0.6) * T }, { k: 'cutup', x: (SPOT.cutup[0] - 1.2) * T, y: (SPOT.cutup[1] - 0.6) * T },
    { k: 'crypt', x: (SPOT.crypt[0] - 0.4) * T, y: (SPOT.crypt[1] - 1.2) * T }, { k: 'board', x: SPOT.board[0] * T, y: (SPOT.board[1] - 1.1) * T },
    { k: 'orgone', x: (SPOT.orgone[0] + 1.5) * T, y: (SPOT.orgone[1] - 0.5) * T }, { k: 'cafe', x: SPOT.cafe[0] * T, y: (SPOT.cafe[1] - 0.6) * T },
    { k: 'oak', x: (SPOT.tree[0] - 1.4) * T, y: (SPOT.tree[1] - 1.2) * T }, { k: 'fire', x: FIRE[0] * T, y: FIRE[1] * T + 4 }, { k: 'bench', x: (SPOT.river[0] - 2) * T, y: (SPOT.river[1] - 1.4) * T }
  ];
}
function drawProp(c, o, X, Y, t, st) {
  const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(X + x), Math.round(Y + y), w, h); };
  const ell = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(X + x, Y + y, rx, ry, 0, 0, 7); c.fill(); };
  if (o.k === 'table') {
    ell(0, 4, 46, 9, 'rgba(0,0,0,.25)'); px(-44, -12, 88, 14, '#7a5434'); px(-44, -12, 88, 3, '#9a7048'); px(-44, 2, 88, 3, '#4a3018'); for (const x of [-40, 36]) px(x, 2, 4, 8, '#4a3018');
    // the book: blank, then titled; its pages fill as the doors are written
    const glow = 0.5 + Math.sin(t * 2) * 0.2; c.globalAlpha = glow * 0.5; ell(0, -10, 26, 10, '#fff2b0'); c.globalAlpha = 1;
    px(-14, -16, 28, 10, '#f4ecd8'); px(-14, -16, 28, 1, '#d8ccb0'); px(-1, -16, 2, 10, '#c8b890');
    if (st.titled) { px(-12, -14, 10, 1, '#5a3a6a'); px(-12, -12, 8, 1, '#5a3a6a'); px(2, -14, 10, 1, '#5a3a6a'); px(2, -12, 9, 1, '#5a3a6a'); }
    for (let q = 0; q < Math.min(14, st.doors); q++) px(-13 + (q % 7) * 2 + (q >= 7 ? 14 : 0), -9, 1, 2, '#8a6a4a');
    for (const x of [-30, 30]) { px(x, -20, 2, 7, '#f4ecd8'); const f = Math.sin(t * 13 + x) > 0; px(x, -23 - (f ? 1 : 0), 2, 3, '#ffd24a'); }
  } else if (o.k === 'cutup') {
    px(-14, -10, 28, 10, '#6a5040'); px(-14, -10, 28, 2, '#8a6a52'); for (let q = 0; q < 7; q++) px(-12 + q * 4, -13 + (q % 2) * 2, 3, 6, '#f4ecd8'); px(6, -14, 6, 2, '#a8a8b0'); px(8, -16, 2, 6, '#a8a8b0');
  } else if (o.k === 'crypt') {
    px(-14, -34, 28, 34, '#6a6670'); px(-14, -34, 28, 3, '#8a8690'); ell(0, -20, 9, 12, '#14121a'); px(-9, -20, 18, 20, '#14121a'); ell(0, -30, 4, 3, '#4a4652'); px(-16, -36, 32, 3, '#5a5660'); for (let q = 0; q < 5; q++) px(-12 + q * 6, -8 + (q % 2) * 3, 3, 2, '#4a7a4a');
  } else if (o.k === 'board') {
    px(-28, -30, 56, 26, '#3a4a3e'); px(-30, -32, 60, 3, '#6a4a32'); px(-30, -6, 60, 3, '#6a4a32'); for (const x of [-26, 24]) px(x, -4, 2, 6, '#6a4a32');
    c.strokeStyle = 'rgba(240,240,230,.75)'; c.lineWidth = 1; c.beginPath(); for (let q = 0; q < 5; q++) { c.moveTo(X - 24, Y - 26 + q * 4); for (let s = 0; s < 8; s++) c.lineTo(X - 24 + s * 5, Y - 26 + q * 4 + (s % 2)); } c.stroke();
    c.beginPath(); c.moveTo(X + 14, Y - 12); c.lineTo(X + 20, Y - 24); c.lineTo(X + 26, Y - 12); c.closePath(); c.stroke(); ell(20, -16, 2, 1.3, 'rgba(240,240,230,.8)');
  } else if (o.k === 'orgone') {
    ell(0, 2, 14, 4, 'rgba(0,0,0,.22)'); px(-10, -34, 20, 34, '#8a6a46'); px(-10, -34, 20, 3, '#a8845a'); px(-7, -30, 14, 26, '#6a4e32'); for (let y = -28; y < -4; y += 5) for (const x of [-6, 4]) px(x, y, 2, 2, '#c8ccd4'); px(5, -18, 2, 3, '#d8b05a');
  } else if (o.k === 'cafe') {
    px(-1, -26, 2, 26, '#5a5a62'); ell(0, -27, 18, 6, '#c84a3a'); for (let q = 0; q < 6; q++) px(-16 + q * 6, -26, 3, 3, '#f4ecd8'); ell(0, -8, 9, 3.5, '#e8e0d0'); px(-1, -8, 2, 8, '#5a5a62'); px(-3, -12, 3, 3, '#f4f0e8'); px(3, -11, 2, 2, '#6a4a32');
  } else if (o.k === 'oak') {
    ell(0, 2, 26, 8, 'rgba(0,0,0,.25)'); px(-5, -34, 10, 36, '#5a4028'); px(-5, -34, 3, 36, '#7a5a3a'); for (const [x, y, r, col] of [[-14, -46, 15, '#3a6a3a'], [12, -48, 16, '#447a42'], [0, -60, 17, '#4a8a46'], [-4, -44, 12, '#58984f']]) ell(x, y, r, r * 0.8, col);
  } else if (o.k === 'fire') {
    for (let q = 0; q < 8; q++) { const a = (q / 8) * 6.283; ell(Math.cos(a) * 11, Math.sin(a) * 5, 3.5, 2.6, '#7a746e'); }
    ell(0, 0, 8, 3.5, '#2a1a12');
    if (st.fire) { for (let q = 0; q < 5; q++) { const h = 6 + Math.abs(Math.sin(t * 9 + q * 1.7)) * 9; px(-6 + q * 3, -h, 3, h, q % 2 ? '#ff8a2a' : '#ffd24a'); } px(-2, -16 - Math.sin(t * 7) * 2, 3, 4, '#fff0b0'); }
  } else if (o.k === 'bench') { px(-14, -8, 28, 4, '#8a6440'); px(-14, -12, 28, 3, '#9a7448'); for (const x of [-12, 10]) px(x, -4, 3, 6, '#5a4028'); }
}

// ------------------------------------------------ the scene
export class Pit {
  constructor(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    this.map = paintMap(); this.props = propList(); this.t = 0; this.running = false;
    this.cam = { x: TABLE[0] * T, y: TABLE[1] * T };
    this.people = KEYS.map((k, n) => {
      const A = AUTHORS[k], seed = [...k].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) >>> 0;
      const sheet = crystalSheet(seed % 100000, { char: { ...A.char, belt: 'off', weapon: 'none', hands: 'none', cape: 'none' } });
      const [sx, sy] = SEATS.table[n];
      return { k, A, actor: new Actor(sheet, GAIT), x: sx * T, y: sy * T, tx: sx * T, ty: sy * T, n, idleT: Math.random() * 6 };
    });
    let i = 0;
    try { i = +(localStorage.getItem(STORE) || 0); } catch { /* private mode */ }
    this.st = { doors: 0, titled: false, fire: false, act: 1 };
    this.seek(Math.max(0, Math.min(beats().length - 1, i | 0)));
  }
  // jump to beat i, placing everyone where the script would have them and the book as written so far
  seek(i) {
    const B = beats();
    this.i = i; this.bt = 0; this.cur = null;
    const where = Object.fromEntries(KEYS.map((k) => [k, 'table']));
    let doors = 0, titled = false, act = 1;
    for (let j = 0; j < i; j++) { const b = B[j]; if (b.k === 'move') for (const k of b.who) where[k] = b.spot; if (b.k === 'door') doors = b.n; if (b.k === 'note' && /THE BOOK OF DOORS/.test(b.text)) titled = true; if (b.k === 'act') act = b.act; }
    this.st = { doors, titled, fire: act >= 5, act };
    const groups = {};
    for (const k of KEYS) (groups[where[k]] ||= []).push(k);
    for (const [spot, ks] of Object.entries(groups)) this.place(ks, spot, true);
  }
  place(ks, spot, snap = false) {
    ks.forEach((k, q) => {
      const p = this.people.find((o) => o.k === k), n = p.n;
      let x, y;
      if (spot === 'table' || spot === 'fire') { [x, y] = SEATS[spot][n]; }
      else { const [sx, sy] = SPOT[spot] || [18, 14]; x = sx + (q % 2 ? 1.3 : -1.3); y = sy + Math.floor(q / 2) * 1.2; }
      p.tx = x * T + 8; p.ty = y * T + 8;
      if (snap) { p.x = p.tx; p.y = p.ty; }
    });
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = (now) => { if (!this.running) return; this.frame(now); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); try { localStorage.setItem(STORE, String(this.i)); } catch { /* private mode */ } }
  next() { const B = beats(); this.i = (this.i + 1) % B.length; this.bt = 0; this.cur = null; if (this.i === 0) this.seek(0); try { localStorage.setItem(STORE, String(this.i)); } catch { /* private mode */ } }
  tap() { if (this.cur) this.next(); }
  // ------------------------------------------------ the script's clock
  stepScript(dt) {
    const B = beats(), b = B[this.i];
    if (!this.cur) {
      this.cur = b; this.bt = 0;
      if (b.k === 'act') { this.st.act = b.act; if (b.act >= 5) this.st.fire = true; this.banner = { text: b.text, t: 0 }; }
      else if (b.k === 'move') this.place(b.who, b.spot);
      else if (b.k === 'say' || b.k === 'door') { const p = this.who(b.who); if (b.emote) p.actor.emote(b.emote, 1.6); else if (b.k === 'door') p.actor.cast(); if (b.k === 'door') this.st.doors = b.n; }
      else if (b.k === 'note' && /THE BOOK OF DOORS/.test(b.text)) this.st.titled = true;
    }
    this.bt += dt;
    const len = b.k === 'act' ? 3.2 : b.k === 'move' ? 7 : b.k === 'note' ? 2.2 + b.text.length * 0.05 : b.k === 'door' ? 3.4 + b.text.length * 0.06 : 1.8 + b.text.length * 0.055;
    // a walk lasts until everyone has arrived (or a while has passed)
    const arrived = b.k !== 'move' || this.people.every((p) => Math.hypot(p.tx - p.x, p.ty - p.y) < 3);
    if ((b.k === 'move' && arrived && this.bt > 0.8) || this.bt >= len) this.next();
  }
  who(k) { return this.people.find((p) => p.k === k); }
  // ------------------------------------------------ every frame
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    this.stepScript(dt);
    const b = this.cur, speaker = b && (b.k === 'say' || b.k === 'door') ? this.who(b.who) : null;
    for (const p of this.people) {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), sp = 38;
      let vx = 0, vy = 0;
      if (d > 2) { vx = (dx / d) * sp; vy = (dy / d) * sp; p.x += vx * dt; p.y += vy * dt; if (p.actor.a.action) p.actor.cancel(); }
      p.actor.update(dt, { vx, vy });
      // standing still, they turn toward whoever is talking; now and then a nod
      if (d <= 2 && speaker && speaker !== p && !p.actor.a.action && Math.hypot(speaker.x - p.x, speaker.y - p.y) < 140) { const ax = speaker.x - p.x, ay = speaker.y - p.y; p.actor.face(Math.abs(ax) > Math.abs(ay) * 1.4 ? (ax > 0 ? 'E' : 'W') : ay > 0 ? (ax > 0 ? 'SE' : 'SW') : ax > 0 ? 'NE' : 'NW'); if ((p.idleT -= dt) < 0) { p.idleT = 5 + Math.random() * 8; if (Math.random() < 0.4) p.actor.emote(Math.random() < 0.7 ? 'nod' : 'think', 1.2); } }
    }
    // the camera: on whoever is talking, or the whole group when they gather or walk
    let tx = TABLE[0] * T, ty = TABLE[1] * T;
    if (speaker) { tx = speaker.x; ty = speaker.y - 10; const near = this.people.filter((p) => p !== speaker && Math.hypot(p.x - speaker.x, p.y - speaker.y) < 60); if (near.length && near.length < 4) { tx = (speaker.x * 2 + near[0].x) / 3; ty = (speaker.y * 2 + near[0].y) / 3 - 10; } }
    else if (b?.k === 'move') { const ms = this.people.filter((p) => b.who.includes(p.k)); tx = ms.reduce((s, p) => s + p.x, 0) / ms.length; ty = ms.reduce((s, p) => s + p.y, 0) / ms.length; }
    else if (this.st.fire && this.st.act >= 6) { tx = FIRE[0] * T; ty = FIRE[1] * T; }
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 2); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 2);
    this.cam.x = Math.max(VW / 2, Math.min(MW * T - VW / 2, this.cam.x)); this.cam.y = Math.max(VH / 2, Math.min(MH * T - VH / 2, this.cam.y));
    this.draw();
  }
  draw() {
    const cv = this.cv, c = this.c, cw = cv.clientWidth || W, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(cw * (H / W) * dpr); }
    const s = cv.width / W;
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
    const buf = (this.buf ||= Object.assign(document.createElement('canvas'), { width: VW, height: VH })), b = buf.getContext('2d');
    const cx = Math.round(this.cam.x - VW / 2), cy = Math.round(this.cam.y - VH / 2), t = this.t;
    b.imageSmoothingEnabled = false; b.drawImage(this.map, -cx, -cy);
    // props and people, back to front
    const items = [...this.props.map((o) => [o.y, 'prop', o]), ...this.people.map((p) => [p.y, 'who', p])].sort((a, q) => a[0] - q[0]);
    for (const [, k, o] of items) {
      if (k === 'prop') drawProp(b, o, o.x - cx, o.y - cy, t, this.st);
      else { b.fillStyle = 'rgba(0,0,0,.22)'; b.beginPath(); b.ellipse(Math.round(o.x - cx), Math.round(o.y - cy), 7, 2.5, 0, 0, 7); b.fill(); o.actor.draw(b, Math.round(o.x - cx), Math.round(o.y - cy)); }
    }
    // the light of the act: dusk, gold, evening, lamplight, night; the fire and candles glow
    const L = LIGHT[this.st.act] || LIGHT[1];
    b.globalCompositeOperation = 'multiply'; b.fillStyle = L.tint; b.globalAlpha = L.k; b.fillRect(0, 0, VW, VH);
    if (L.dark) { b.fillStyle = '#1a1438'; b.globalAlpha = L.dark; b.fillRect(0, 0, VW, VH); }
    b.globalCompositeOperation = 'lighter'; b.globalAlpha = 1;
    const glow = (x, y, r, col, a) => { const g = b.createRadialGradient(x - cx, y - cy, 1, x - cx, y - cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); b.globalAlpha = a; b.fillStyle = g; b.fillRect(x - cx - r, y - cy - r, r * 2, r * 2); };
    if (this.st.fire) glow(FIRE[0] * T, FIRE[1] * T - 6, 70, 'rgba(255,150,60,.9)', (0.35 + Math.sin(t * 8) * 0.05) * (L.dark > 0.2 ? 1.4 : 0.6));
    glow(TABLE[0] * T, TABLE[1] * T - 2, 44, 'rgba(255,230,160,.9)', 0.25 + this.st.doors * 0.02);
    if (L.dark > 0.3) for (let q = 0; q < 10; q++) { const fx = ((q * 97 + t * (6 + q)) % (MW * T)), fy = 40 + ((q * 53 + Math.sin(t * 0.7 + q) * 30) % (MH * T - 80)); glow(fx, fy, 6, 'rgba(220,255,140,.9)', 0.6 * (0.5 + Math.sin(t * 3 + q) * 0.5)); }
    b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
    // up to the card, then the words
    c.setTransform(s, 0, 0, s, 0, 0); c.imageSmoothingEnabled = false; c.drawImage(buf, 0, 0, W, H); c.imageSmoothingEnabled = true;
    this.drawWords(c, cx, cy);
  }
  drawWords(c, cx, cy) {
    const b = this.cur, t = this.t;
    const wrap = (text, font, max) => { c.font = font; const out = []; let line = ''; for (const w of text.split(' ')) { const tt = line ? `${line} ${w}` : w; if (c.measureText(tt).width > max && line) { out.push(line); line = w; } else line = tt; } if (line) out.push(line); return out; };
    const round = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    // name tags under everyone, small, so you can tell who is who
    c.font = '600 8px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top';
    for (const p of this.people) { const X = (p.x - cx) * Z, Y = (p.y - cy) * Z + 4; if (X < -20 || X > W + 20 || Y < -10 || Y > H) continue; c.globalAlpha = 0.85; c.fillStyle = 'rgba(14,10,22,.55)'; const w = c.measureText(p.A.short).width + 6; c.fillRect(X - w / 2, Y, w, 10); c.fillStyle = p.A.col; c.fillText(p.A.short, X, Y + 1); }
    c.globalAlpha = 1;
    if (!b) return;
    const fade = Math.min(1, this.bt * 4);
    if (b.k === 'say') {
      // a speech bubble over the speaker: their name in their colour, the line wrapped
      const p = this.who(b.who), font = '500 12px Georgia, "Times New Roman", serif', lines = wrap(b.text, font, 208), lh = 15, w = Math.min(232, Math.max(...lines.map((l) => c.measureText(l).width)) + 20), h = lines.length * lh + 24;
      const X0 = (p.x - cx) * Z, Y0 = (p.y - cy) * Z - 58, x = Math.max(8, Math.min(W - 8 - w, X0 - w / 2)), y = Math.max(52, Math.min(H - 10 - h, Y0 - h));
      c.globalAlpha = fade;
      round(x, y, w, h, 10); c.fillStyle = 'rgba(252,248,238,.95)'; c.fill(); c.strokeStyle = p.A.col; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.moveTo(Math.max(x + 14, Math.min(x + w - 14, X0)) - 6, y + h - 1); c.lineTo(Math.max(x + 14, Math.min(x + w - 14, X0)), y + h + 8); c.lineTo(Math.max(x + 14, Math.min(x + w - 14, X0)) + 6, y + h - 1); c.fillStyle = 'rgba(252,248,238,.95)'; c.fill();
      c.textAlign = 'left'; c.textBaseline = 'top'; c.font = '700 9.5px system-ui, sans-serif'; c.fillStyle = shadeCol(p.A.col); c.fillText(p.A.name.toUpperCase(), x + 10, y + 7);
      c.font = font; c.fillStyle = '#1e1a24'; lines.forEach((l, q) => c.fillText(l, x + 10, y + 19 + q * lh));
      c.globalAlpha = 1;
    } else if (b.k === 'door') {
      // a page of the book: which door, its line, whose hand
      const p = this.who(b.who), font = 'italic 500 13px Georgia, "Times New Roman", serif', lines = wrap(b.text, font, 280), h = lines.length * 17 + 58, x = 22, y = 52;
      c.globalAlpha = fade; round(x, y, W - 44, h, 6); c.fillStyle = 'rgba(244,236,216,.97)'; c.fill(); c.strokeStyle = '#8a6a4a'; c.lineWidth = 2; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'top'; c.font = '700 10px system-ui, sans-serif'; c.fillStyle = '#7a5a3a'; c.fillText(`THE BOOK OF DOORS · DOOR ${b.n} OF 14`, W / 2, y + 10);
      c.font = font; c.fillStyle = '#2a2018'; lines.forEach((l, q) => c.fillText(l, W / 2, y + 28 + q * 17));
      c.font = '600 10px system-ui, sans-serif'; c.fillStyle = shadeCol(p.A.col); c.fillText(`· ${p.A.name} ·`, W / 2, y + h - 18); c.globalAlpha = 1;
    } else if (b.k === 'note') {
      const font = 'italic 500 12px Georgia, "Times New Roman", serif', lines = wrap(b.text, font, 290), h = lines.length * 16 + 16, y = H - h - 18;
      c.globalAlpha = fade; c.fillStyle = 'rgba(14,10,22,.72)'; c.fillRect(0, y, W, h); c.textAlign = 'center'; c.textBaseline = 'top'; c.font = font; c.fillStyle = '#f6ecd6'; lines.forEach((l, q) => c.fillText(l, W / 2, y + 8 + q * 16)); c.globalAlpha = 1;
    }
    if (this.banner && (this.banner.t += 1 / 60) < 3.4) {
      const a = Math.min(1, this.banner.t * 2, (3.4 - this.banner.t) * 2);
      c.globalAlpha = a; c.fillStyle = 'rgba(14,10,22,.7)'; c.fillRect(0, 10, W, 34); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'italic 700 17px Georgia, "Times New Roman", serif'; c.fillStyle = '#f6e6b8'; c.fillText(this.banner.text, W / 2, 27); c.globalAlpha = 1;
    }
    // how far through the book they are
    c.textAlign = 'right'; c.textBaseline = 'top'; c.font = '600 9px system-ui, sans-serif'; c.fillStyle = 'rgba(255,248,230,.7)'; c.fillText(this.st.titled ? `The Book of Doors · ${this.st.doors}/14` : 'a blank book', W - 8, H - 14);
    void t;
  }
}
const shadeCol = (h) => { const n = parseInt(h.slice(1), 16), f = (v) => Math.round(v * 0.62); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

// the card's moving part: a canvas that plays while the card is on screen
export function pitView(el) {
  const canvas = el('canvas.pit'), stage = el('div.stage.pit-stage', canvas);
  let P = null;
  stage.addEventListener('click', () => P?.tap());
  return { stage, activate: () => { P ||= new Pit(canvas); P.start(); }, deactivate: () => P?.stop() };
}
export { beats };
