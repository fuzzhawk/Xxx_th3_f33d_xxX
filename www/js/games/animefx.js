// Anime battle effects for Monster Battle: camera shake, zoom punches and hit-stop, screen flashes, impact frames,
// speed and focus lines, big kana/kanji impact words, element particles (embers, droplets, leaves, wind streaks,
// shadow smoke, spirit stars, rocks, claw sparks), beams, projectiles, pillars, rings, slashes and the super-move
// cut-in with the creature's portrait. Effects are short-lived items drawn on one of three layers:
// 'back' (behind the creatures), 'front' and 'top' (over the HUD).
const TAU = Math.PI * 2, rnd = Math.random;
export const JFONT = '"Hiragino Kaku Gothic StdN","Hiragino Sans","Yu Gothic","Noto Sans CJK JP","Noto Sans JP","Source Han Sans","WenQuanYi Zen Hei","Droid Sans Fallback",sans-serif';
const PS = {
  fire: { cols: ['#fff6c0', '#ffc040', '#ff6a1a', '#c0200c'], g: -140, shape: 'ember', drag: 1.6, life: [0.35, 0.8], add: 1 },
  water: { cols: ['#ffffff', '#b8ecff', '#5ab8ff', '#2a70e0'], g: 520, shape: 'drop', drag: 0.4, life: [0.4, 0.8] },
  leaf: { cols: ['#d8ff98', '#7ee05a', '#3a9a3a', '#ffa8d8'], g: 70, shape: 'leaf', drag: 1.8, life: [0.6, 1.2], spin: 9 },
  wind: { cols: ['#ffffff', '#d8fff6', '#8ff0dc'], g: 0, shape: 'streak', drag: 1.2, life: [0.25, 0.55] },
  shadow: { cols: ['#1a0a28', '#3a1a5a', '#7a3ac0', '#b080ff'], g: -50, shape: 'smoke', drag: 2.2, life: [0.5, 1] },
  spirit: { cols: ['#ffffff', '#ffd8f6', '#ff8ae6', '#a8f0ff'], g: -30, shape: 'star', drag: 1.4, life: [0.5, 1.1], add: 1, spin: 4 },
  earth: { cols: ['#f0d8a0', '#b88848', '#7a5430', '#4a3420'], g: 700, shape: 'rock', drag: 0.3, life: [0.5, 1], spin: 10 },
  beast: { cols: ['#ffffff', '#fff0c0', '#ffd080'], g: 240, shape: 'spark', drag: 1, life: [0.2, 0.45], add: 1 }
};
const sils = new WeakMap();
// a flat-colour copy of a sprite (impact frames, catching, evolution)
export function silhouette(img, col) {
  let m = sils.get(img); if (!m) sils.set(img, (m = {}));
  if (!m[col]) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); m[col] = c; }
  return m[col];
}
const ease = (k) => 1 - (1 - k) ** 3;
export class Fx {
  constructor(W, H) { this.W = W; this.H = H; this.items = []; this.parts = []; this.shake = 0; this.flashT = 0; this.flashD = 1; this.flashC = '#fff'; this.impact = 0; this.stop = 0; this.zoom = 0; this.zx = W / 2; this.zy = H / 2; }
  clear() { this.items = []; this.parts = []; this.shake = this.flashT = this.impact = this.stop = this.zoom = 0; }
  add(o) { o.t = 0; o.layer ||= 'front'; this.items.push(o); return o; }
  update(dt) {
    this.shake = this.shake > 0.3 ? this.shake * Math.exp(-dt * 8) : 0; this.zoom *= Math.exp(-dt * 5);
    this.flashT = Math.max(0, this.flashT - dt); this.impact = Math.max(0, this.impact - dt);
    for (const o of this.items) { o.t += dt; o.tick?.(dt, Math.min(1, o.t / o.dur), o); }
    this.items = this.items.filter((o) => o.t < o.dur);
    for (const p of this.parts) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy = p.vy * d + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.a += p.spin * dt; }
    if (this.parts.length) this.parts = this.parts.filter((p) => p.life > 0);
  }
  camera(c) { const s = this.shake; if (s) c.translate((rnd() - 0.5) * 2 * s, (rnd() - 0.5) * 2 * s); if (this.zoom > 0.003) { c.translate(this.zx, this.zy); c.scale(1 + this.zoom, 1 + this.zoom); c.translate(-this.zx, -this.zy); } }
  // a hit: shake, hit-stop, a zoom punch toward it; heavy hits get a flash and an impact frame
  hit(x, y, power = 1) { this.shake = Math.max(this.shake, 3 + power * 5); this.stop = Math.max(this.stop, 0.03 + power * 0.05); this.zoom = Math.max(this.zoom, 0.02 + power * 0.05); this.zx = x; this.zy = y; if (power >= 1) { this.flash('#fff', 0.18); this.impact = 0.13; } }
  flash(col = '#fff', dur = 0.25) { this.flashC = col; this.flashT = this.flashD = dur; }
  emit(el, x, y, n = 12, spd = 170, o = {}) {
    const P = PS[el] || PS.beast;
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + (rnd() - 0.5) * (o.spread ?? 1) : rnd() * TAU, s = spd * (0.3 + rnd() * 0.7), life = P.life[0] + rnd() * (P.life[1] - P.life[0]);
      this.parts.push({ x: x + (rnd() - 0.5) * (o.w || 0), y: y + (rnd() - 0.5) * (o.h || 0), vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: P.g, drag: P.drag, life, max: life, a: rnd() * TAU, spin: (rnd() - 0.5) * (P.spin || 0), col: P.cols[(rnd() * P.cols.length) | 0], r: (o.size || 1) * (1.5 + rnd() * 2.5), shape: o.shape || (el === 'water' && rnd() < 0.3 ? 'bubble' : P.shape), add: P.add });
    }
    if (this.parts.length > 340) this.parts.splice(0, this.parts.length - 340);
  }
  // big stylised impact word (kana/kanji), with an English subtitle
  word(txt, x, y, col = '#ffe14a', size = 34, sub = '', dur = 0.95) {
    const rot = (rnd() - 0.6) * 0.3;
    this.add({ dur, layer: 'top', draw: (c, k) => {
      const pop = k < 0.1 ? 1.9 - (k / 0.1) * 1.05 : k < 0.18 ? 0.85 + ((k - 0.1) / 0.08) * 0.15 : 1, a = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
      c.save(); c.globalAlpha = a; c.translate(x + (k < 0.18 ? (rnd() - 0.5) * 6 : 0), y - k * 12); c.rotate(rot); c.scale(pop, pop); c.transform(1, 0, -0.18, 1, 0, 0);
      c.font = `900 ${size}px ${JFONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.lineWidth = size * 0.34; c.strokeStyle = '#140a14'; c.strokeText(txt, 0, 0);
      c.lineWidth = size * 0.14; c.strokeStyle = '#fff'; c.strokeText(txt, 0, 0);
      const g = c.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.45, col); g.addColorStop(1, col); c.fillStyle = g; c.fillText(txt, 0, 0);
      if (sub) { c.font = `italic 900 ${Math.round(size * 0.34)}px system-ui, sans-serif`; c.lineWidth = 4; c.strokeStyle = '#140a14'; c.strokeText(sub, 0, size * 0.66); c.fillStyle = '#fff'; c.fillText(sub, 0, size * 0.66); }
      c.restore();
    } });
  }
  num(n, x, y, col = '#fff') {
    this.add({ dur: 0.8, layer: 'top', draw: (c, k) => { c.save(); c.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1; c.font = 'italic 900 18px system-ui, sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#140a14'; const yy = y - 18 * ease(Math.min(1, k * 3)); c.strokeText(n, x, yy); c.fillStyle = col; c.fillText(n, x, yy); c.restore(); } });
  }
  // manga focus lines converging on a point, re-drawn every frame so they flicker
  focus(x, y, col = '#fff', dur = 0.5, n = 44, layer = 'back') {
    this.add({ dur, layer, draw: (c, k) => {
      c.save(); c.globalAlpha = (1 - k) * 0.85; c.fillStyle = col; c.beginPath();
      for (let i = 0; i < n; i++) { const a = rnd() * TAU, w = 0.008 + rnd() * 0.022, r0 = 70 + rnd() * 70, r1 = 460; c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a - w) * r1, y + Math.sin(a - w) * r1); c.lineTo(x + Math.cos(a + w) * r1, y + Math.sin(a + w) * r1); }
      c.fill(); c.restore();
    } });
  }
  // horizontal speed lines rushing past (dir 1 = to the right)
  streaks(dir, col = '#fff', dur = 0.45, layer = 'back') {
    const L = Array.from({ length: 24 }, () => ({ y: rnd() * this.H * 0.75, x: rnd() * 600, l: 50 + rnd() * 140, w: 1 + rnd() * 2.5 }));
    this.add({ dur, layer, draw: (c, k) => { c.save(); c.globalAlpha = Math.sin(k * Math.PI) * 0.8; c.fillStyle = col; for (const s of L) { const x = ((s.x + k * 1700) % 600) - 120; c.fillRect(dir > 0 ? x : this.W - x - s.l, s.y, s.l, s.w); } c.restore(); } });
  }
  ring(x, y, col, r0 = 8, r1 = 70, dur = 0.4, w = 6) {
    this.add({ dur, draw: (c, k) => { c.save(); c.globalAlpha = 1 - k; c.strokeStyle = col; c.lineWidth = w * (1 - k) + 1; c.beginPath(); c.ellipse(x, y, r0 + (r1 - r0) * ease(k), (r0 + (r1 - r0) * ease(k)) * 0.75, 0, 0, TAU); c.stroke(); c.restore(); } });
  }
  slashes(x, y, col, n = 3, dur = 0.38) {
    const S = Array.from({ length: n }, (_, i) => ({ a: -0.9 + (rnd() - 0.5) * 0.5 + i * 0.12, ox: (i - (n - 1) / 2) * 16, d: i * 0.05 }));
    this.add({ dur, draw: (c, k) => {
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (const s of S) { const q = Math.max(0, Math.min(1, (k - s.d) / 0.45)); if (q <= 0) continue; const len = 90 * ease(Math.min(1, q * 2)), fade = 1 - Math.max(0, q - 0.5) * 2;
        const ca = Math.cos(s.a), sa = Math.sin(s.a), x0 = x + s.ox - ca * 45, y0 = y - sa * 45;
        for (const [w, cc] of [[9, col], [3, '#fff']]) { c.globalAlpha = fade; c.strokeStyle = cc; c.lineWidth = w * fade; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + ca * len * 0.5 + sa * 10, y0 + sa * len * 0.5 - ca * 10, x0 + ca * len, y0 + sa * len); c.stroke(); } }
      c.restore();
    } });
  }
  beam(x0, y0, x1, y1, col, dur = 0.5, w = 16) {
    this.add({ dur, tick: () => this.emit('spirit', x1 + (rnd() - 0.5) * 20, y1 + (rnd() - 0.5) * 20, 1, 120), draw: (c, k) => {
      const q = k < 0.15 ? k / 0.15 : 1, ww = w * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1) * (0.85 + rnd() * 0.3), xe = x0 + (x1 - x0) * q, ye = y0 + (y1 - y0) * q, a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (const [m, cc, al] of [[1.8, col, 0.35], [1, col, 0.9], [0.4, '#fff', 1]]) { c.globalAlpha = al; c.strokeStyle = cc; c.lineWidth = ww * m; c.beginPath(); c.moveTo(x0, y0); for (let i = 1; i <= 8; i++) { const t = i / 8, j = (rnd() - 0.5) * ww * 0.3 * m; c.lineTo(x0 + (xe - x0) * t + nx * j, y0 + (ye - y0) * t + ny * j); } c.stroke(); }
      c.globalAlpha = 0.8; c.fillStyle = '#fff'; c.beginPath(); c.arc(xe, ye, ww * 1.3, 0, TAU); c.fill(); c.restore();
    } });
  }
  // a projectile with a trail; returns its flight time
  orb(x0, y0, x1, y1, col, el, dur = 0.32, r = 9) {
    this.add({ dur, tick: (dt, k, o) => { o.x = x0 + (x1 - x0) * k; o.y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 26; this.emit(el, o.x, o.y, 1, 40); }, draw: (c, k, o) => {
      c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 2); g.addColorStop(0, '#fff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, r * 2, 0, TAU); c.fill(); c.restore();
    }, x: x0, y: y0 });
    return dur;
  }
  pillar(x, y, col, el, dur = 0.65, w = 46) {
    this.add({ dur, tick: () => this.emit(el, x + (rnd() - 0.5) * w, y, 2, 260, { dir: -Math.PI / 2, spread: 0.5 }), draw: (c, k) => {
      const q = ease(Math.min(1, k * 4)), f = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1, ww = w * (0.6 + q * 0.4) * f * (0.9 + rnd() * 0.2), top = y - 260 * q;
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(0, top, 0, y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, col); g.addColorStop(1, '#fff');
      c.globalAlpha = 0.85; c.fillStyle = g; c.fillRect(x - ww / 2, top, ww, y - top); c.fillStyle = '#fff'; c.globalAlpha = 0.6 * f; c.fillRect(x - ww / 6, top + 30, ww / 3, y - top - 30);
      c.globalAlpha = f; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, ww * 0.9, 9, 0, 0, TAU); c.fill(); c.restore();
    } });
  }
  // things raining onto the target (petals, rocks, stars…)
  rain(x, y, el, dur = 0.6, n = 26) { let made = 0; this.add({ dur, tick: (dt, k) => { while (made < n * k) { made++; this.emit(el, x + (rnd() - 0.5) * 90, y - 150 - rnd() * 40, 1, 420, { dir: Math.PI / 2 + 0.25, spread: 0.2, size: 1.6 }); } }, draw: () => {} }); }
  wave(x0, y0, x1, y1, col, el, dur = 0.4) {
    this.add({ dur, tick: (dt, k, o) => { o.x = x0 + (x1 - x0) * ease(k); o.y = y0 + (y1 - y0) * ease(k); this.emit(el, o.x, o.y, 2, 90); }, x: x0, y: y0, draw: (c, k, o) => {
      c.save(); c.globalAlpha = 0.85 * (1 - k * 0.5); c.strokeStyle = col; c.lineCap = 'round'; const a = Math.atan2(y1 - y0, x1 - x0);
      for (let i = 0; i < 3; i++) { c.lineWidth = 9 - i * 3; c.beginPath(); c.arc(o.x - Math.cos(a) * i * 14, o.y - Math.sin(a) * i * 14, 34 - i * 6, a - 1.1, a + 1.1); c.stroke(); }
      c.restore();
    } });
  }
  // curse/status: dark rings closing in, with a spiral
  hex(x, y, col, dur = 0.6) {
    this.add({ dur, draw: (c, k) => { c.save(); c.strokeStyle = col; for (let i = 0; i < 3; i++) { const q = (k * 1.6 + i / 3) % 1; c.globalAlpha = q * (1 - k * 0.6); c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 70 * (1 - q) + 6, (70 * (1 - q) + 6) * 0.6, 0, 0, TAU); c.stroke(); }
      c.globalAlpha = 1 - k; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 40; i++) { const a = i * 0.45 + k * 12, r = i * 1.1; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6); } c.stroke(); c.restore(); } });
  }
  aura(x, y, col, dur = 0.8, up = true) {
    this.add({ dur, tick: () => this.emit(up ? 'fire' : 'shadow', x + (rnd() - 0.5) * 60, y + 20, 1, 60, { dir: up ? -Math.PI / 2 : Math.PI / 2, spread: 0.3 }), layer: 'back', draw: (c, k) => {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(k * Math.PI) * 0.6; const g = c.createRadialGradient(x, y, 4, x, y, 70); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 60, 76, 0, 0, TAU); c.fill(); c.restore();
    } });
    this.arrows(x, y, up, col);
  }
  arrows(x, y, up, col) {
    this.add({ dur: 0.8, draw: (c, k) => { c.save(); c.globalAlpha = 1 - k; c.fillStyle = col; c.strokeStyle = '#140a14'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const ax = x - 30 + i * 30, ay = y + (up ? 20 - k * 60 - i * 8 : -30 + k * 60 + i * 8), d = up ? -1 : 1; c.beginPath(); c.moveTo(ax, ay + d * 12); c.lineTo(ax + 9, ay); c.lineTo(ax + 4, ay); c.lineTo(ax + 4, ay - d * 10); c.lineTo(ax - 4, ay - d * 10); c.lineTo(ax - 4, ay); c.lineTo(ax - 9, ay); c.closePath(); c.fill(); c.stroke(); }
      c.restore(); } });
  }
  heal(x, y, dur = 0.9) {
    this.add({ dur, tick: () => rnd() < 0.5 && this.emit('spirit', x + (rnd() - 0.5) * 60, y + 30, 1, 80, { dir: -Math.PI / 2, spread: 0.4 }), draw: (c, k) => {
      c.save(); c.globalAlpha = 1 - k; c.fillStyle = '#7dffa8'; for (let i = 0; i < 4; i++) { const px = x - 36 + i * 24, py = y + 10 - ((k * 70 + i * 17) % 70); c.fillRect(px - 2, py - 7, 4, 14); c.fillRect(px - 7, py - 2, 14, 4); } c.restore();
    } });
  }
  // energy gathering into a point before a big move
  charge(x, y, el, col, dur = 0.4) {
    this.add({ dur, tick: () => { const a = rnd() * TAU, r = 70 + rnd() * 30; this.parts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 3.2, g: 0, drag: 0, life: 0.3, max: 0.3, a: 0, spin: 0, col, r: 2.5, shape: 'streak', add: 1 }); }, layer: 'back', draw: (c, k) => {
      c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, 30 * k + 6); g.addColorStop(0, '#fff'); g.addColorStop(0.4, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 30 * k + 6, 0, TAU); c.fill(); c.restore();
    } });
  }
  cracks(x, y, col = '#2a1a10') {
    const L = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI + rnd() * 0.3; let px = x, py = y; return Array.from({ length: 5 }, () => [(px += Math.cos(a) * (8 + rnd() * 10) * (rnd() < 0.5 ? 1 : -1)), (py += Math.sin(a) * 4 * (rnd() - 0.3))]); });
    this.add({ dur: 0.9, layer: 'back', draw: (c, k) => { c.save(); c.globalAlpha = 1 - k; c.strokeStyle = col; c.lineWidth = 2.5; for (const l of L) { c.beginPath(); c.moveTo(x, y); for (const [a, b] of l) c.lineTo(a, b); c.stroke(); } c.restore(); } });
  }
  // the super-move cut-in: a diagonal band with the portrait, speed lines, the move's name and kanji
  cutin(img, name, kan, col, side, dur = 1.3) {
    const W = this.W;
    this.add({ dur, layer: 'top', draw: (c, k) => {
      const inK = ease(Math.min(1, k / 0.14)), outK = k > 0.84 ? (k - 0.84) / 0.16 : 0, bh = 120 * (1 - outK), y0 = 92;
      c.save(); c.fillStyle = `rgba(6,4,14,${0.6 * inK * (1 - outK)})`; c.fillRect(0, 0, W, this.H);
      const xIn = side ? W * (1 - inK) : -W * (1 - inK);
      c.translate(xIn, 0); c.beginPath(); c.moveTo(-20, y0 + 26 - bh / 2 + 60); c.lineTo(W + 20, y0 - bh / 2 + 30); c.lineTo(W + 20, y0 + bh / 2 + 30); c.lineTo(-20, y0 + bh / 2 + 60 + 26); c.closePath();
      c.save(); c.clip();
      const g = c.createLinearGradient(0, y0 - 40, 0, y0 + 140); g.addColorStop(0, '#140a1e'); g.addColorStop(0.5, col); g.addColorStop(1, '#140a1e'); c.fillStyle = g; c.fillRect(-20, 0, W + 40, this.H);
      c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 22; i++) { const yy = y0 - 40 + rnd() * 200, xx = ((rnd() * 900 + k * 2600 * (side ? -1 : 1)) % 700 + 700) % 700 - 170; c.fillRect(xx, yy, 60 + rnd() * 160, 1 + rnd() * 2); }
      c.globalAlpha = 0.28; c.font = `900 120px ${JFONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(kan, side ? 110 : W - 110, y0 + 50); c.globalAlpha = 1;
      if (img) { const px = (side ? W - 120 : 120) + (side ? -1 : 1) * (k * 24), s = 230; c.save(); c.translate(px, y0 + 52); if (side) c.scale(-1, 1); c.imageSmoothingEnabled = true; c.drawImage(silhouette(img, '#fff'), -s / 2 - 3, -s / 2 - 3, s + 6, s + 6); c.drawImage(img, -s / 2, -s / 2, s, s); c.restore(); }
      c.restore();
      c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke();
      c.transform(1, 0, -0.2, 1, 0, 0); c.font = `italic 900 25px system-ui, sans-serif`; c.textAlign = side ? 'left' : 'right'; c.lineWidth = 6; c.strokeStyle = '#140a14';
      const tx = side ? 40 : W + 10, ty = y0 + 118; c.strokeText(name.toUpperCase(), tx, ty); c.fillStyle = '#fff'; c.fillText(name.toUpperCase(), tx, ty);
      c.restore();
    } });
  }
  draw(c, layer) {
    for (const o of this.items) if (o.layer === layer) o.draw(c, Math.min(1, o.t / o.dur), o);
    if (layer !== 'front') return;
    c.save();
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max); c.globalAlpha = Math.min(1, k * 1.5); c.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; c.fillStyle = c.strokeStyle = p.col;
      switch (p.shape) {
        case 'ember': c.beginPath(); c.arc(p.x, p.y, p.r * (0.5 + k * 0.6) * (0.8 + rnd() * 0.4), 0, TAU); c.fill(); break;
        case 'drop': c.beginPath(); c.ellipse(p.x, p.y, p.r * 0.7, p.r * 1.4, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, TAU); c.fill(); break;
        case 'bubble': c.lineWidth = 1.2; c.beginPath(); c.arc(p.x, p.y, p.r * 1.3, 0, TAU); c.stroke(); break;
        case 'leaf': c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.beginPath(); c.ellipse(0, 0, p.r * 1.6, p.r * 0.7, 0, 0, TAU); c.fill(); c.restore(); break;
        case 'streak': { const l = Math.hypot(p.vx, p.vy) * 0.06 + 3; const a = Math.atan2(p.vy, p.vx); c.lineWidth = p.r * 0.6; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - Math.cos(a) * l, p.y - Math.sin(a) * l); c.stroke(); break; }
        case 'smoke': c.globalAlpha = k * 0.7; c.beginPath(); c.arc(p.x, p.y, p.r * (1 + (1 - k) * 3), 0, TAU); c.fill(); break;
        case 'star': { c.save(); c.translate(p.x, p.y); c.rotate(p.a); const r = p.r * 1.4; c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.3 : r; c.lineTo(Math.cos((i / 8) * TAU) * rr, Math.sin((i / 8) * TAU) * rr); } c.fill(); c.restore(); break; }
        case 'rock': c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillRect(-p.r, -p.r, p.r * 2, p.r * 1.6); c.restore(); break;
        default: { const a = Math.atan2(p.vy, p.vx); c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9); c.stroke(); }
      }
    }
    c.restore();
  }
  drawFlash(c) { if (this.flashT > 0) { c.save(); c.globalAlpha = this.flashT / this.flashD; c.fillStyle = this.flashC; c.fillRect(0, 0, this.W, this.H); c.restore(); } }
}
