// Shared kit for the arcade games (Breakout, Pong, Juggle, Dash, Flap): screen effects, colour helpers and
// parallax scenery built from wrap-around silhouettes, optionally textured with one coherent picture set (skin.bgSet).
import { W, H, rgbOf, ready } from './engine.js';
import { mulberry32 } from '../util.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function mix(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
export function rgba(css, a) { const [r, g, b] = rgbOf(css); return `rgba(${r},${g},${b},${a})`; }
export const lum = (css) => { const [r, g, b] = rgbOf(css); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
// a canvas sized in logical units at resolution r
export function canvas(w, h, r = 1) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * r)); c.height = Math.max(1, Math.ceil(h * r)); return c; }

// ---------------------------------------------------------------- effects
// rings, sparks, puffs, chips, glows and popup text, plus screen shake and flash (cosmetic, so Math.random)
export class Fx {
  constructor() { this.list = []; this.sh = 0; this.shT = 0; this.fl = null; }
  add(e) { e.max = e.life; this.list.push(e); if (this.list.length > 420) this.list.splice(0, this.list.length - 420); return e; }
  ring(x, y, r, color, life = 0.4, w = 3, r0 = 2) { return this.add({ k: 0, x, y, r, r0, color, life, w }); }
  spark(x, y, vx, vy, color, life = 0.4, g = 0) { return this.add({ k: 1, x, y, vx, vy, color, life, g }); }
  sparks(x, y, n, color, v = 220, a = 0, spread = 7, life = 0.4, g = 0) {
    for (let i = 0; i < n; i++) { const t = a + (Math.random() - 0.5) * spread, s = v * (0.3 + Math.random() * 0.7); this.spark(x, y, Math.cos(t) * s, Math.sin(t) * s, color, life * (0.5 + Math.random() * 0.7), g); }
  }
  puff(x, y, vx, vy, r, color, life = 0.6, grow = 30, a = 0.5) { return this.add({ k: 2, x, y, vx, vy, r, color, life, grow, a }); }
  chip(x, y, vx, vy, s, color, life = 0.8, g = 900) { return this.add({ k: 3, x, y, vx, vy, s, color, life, g, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18 }); }
  glow(x, y, r, color, life = 0.3) { return this.add({ k: 4, x, y, r, color, life }); }
  text(x, y, s, color, size = 14, life = 0.9, vy = -30) { return this.add({ k: 5, x, y, s, color, size, life, vy }); }
  flash(color, a = 0.35, life = 0.25) { this.fl = { color, a, life, max: life }; }
  shake(a, t = 0.25) { this.sh = Math.max(this.shT > 0 ? this.sh : 0, a); this.shT = Math.max(this.shT, t); }
  step(dt) {
    let dead = false;
    for (const e of this.list) {
      if ((e.life -= dt) <= 0) dead = true;
      if (e.k === 1 || e.k === 3) {
        e.vy += e.g * dt; e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.k === 1) { const d = 1 - 2.5 * dt; e.vx *= d; e.vy *= d; } else e.rot += e.vr * dt;
      } else if (e.k === 2) { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 1 - 2 * dt; e.vy *= 1 - 2 * dt; e.r += e.grow * dt; }
      else if (e.k === 5) e.y += e.vy * dt;
    }
    if (dead) this.list = this.list.filter((e) => e.life > 0);
    if (this.shT > 0 && (this.shT -= dt) <= 0) this.sh = 0;
    if (this.fl && (this.fl.life -= dt) <= 0) this.fl = null;
  }
  // camera shake: call at the start of draw (the engine resets the transform after each frame)
  apply(c) { if (this.sh > 0) { const a = this.sh * Math.min(1, this.shT * 5); c.translate((Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a); } }
  draw(c) {
    for (const e of this.list) {
      const f = Math.max(0, e.life / e.max);
      if (e.k === 0) {
        const q = 1 - f; c.globalAlpha = f; c.strokeStyle = e.color; c.lineWidth = e.w * f + 0.5;
        c.beginPath(); c.arc(e.x, e.y, e.r0 + (e.r - e.r0) * (1 - (1 - q) * (1 - q)), 0, 7); c.stroke();
      } else if (e.k === 1) {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = f; c.strokeStyle = e.color; c.lineWidth = 1.7;
        c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x - e.vx * 0.035, e.y - e.vy * 0.035); c.stroke(); c.globalCompositeOperation = 'source-over';
      } else if (e.k === 2) { c.globalAlpha = f * e.a; c.fillStyle = e.color; c.beginPath(); c.arc(e.x, e.y, e.r, 0, 7); c.fill(); }
      else if (e.k === 3) { c.globalAlpha = Math.min(1, f * 2); c.fillStyle = e.color; c.save(); c.translate(e.x, e.y); c.rotate(e.rot); c.fillRect(-e.s / 2, -e.s * 0.35, e.s, e.s * 0.7); c.restore(); }
      else if (e.k === 4) {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = f;
        const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r); g.addColorStop(0, e.color); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2); c.globalCompositeOperation = 'source-over';
      } else {
        c.globalAlpha = Math.min(1, f * 2.5); c.font = `900 ${e.size}px ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(e.s, e.x, e.y); c.fillStyle = e.color; c.fillText(e.s, e.x, e.y);
      }
    }
    c.globalAlpha = 1;
  }
  over(c) { if (this.fl) { c.globalAlpha = this.fl.a * (this.fl.life / this.fl.max); c.fillStyle = this.fl.color; c.fillRect(-40, -40, W + 80, H + 80); c.globalAlpha = 1; } }
}

// ---------------------------------------------------------------- parallax scenery
// Each layer is a silhouette that repeats every P units (sums of sines with whole frequencies), pre-rendered once,
// drawn twice per frame at an offset scaled by its depth. Pictures are mirror-tiled so the wrap has no seam.
const P = 720, TAU = Math.PI * 2;
function waves(R, n = 4, rough = 0.5, f0 = 1) {
  const t = []; let s = 0;
  for (let i = 0; i < n; i++) { const a = Math.pow(rough, i); s += a; t.push([f0 * (i + 1) + Math.floor(R() * 2) * f0, a, R() * TAU]); }
  return (x) => { let v = 0; for (const [f, a, p] of t) v += a * Math.sin((x / P) * TAU * f + p); return v / s; };
}
function ridges(R, n = 4, f0 = 2) {
  const t = []; let s = 0;
  for (let i = 0; i < n; i++) { const a = Math.pow(0.42, i); s += a; t.push([f0 * (i + 1) + Math.floor(R() * 3), a, R() * TAU]); }
  return (x) => { let v = 0; for (const [f, a, p] of t) v += a * (1 - Math.abs(Math.sin((x / P) * Math.PI * f + p))); return v / s; };
}
// draw a picture across [0,P) × [y, y+h): pairs of tiles, the second mirrored, cropped to the tile's aspect
function mirrorTile(c, i, y, h, ay = 0.7) {
  const iw = i.naturalWidth || i.width, ih = i.naturalHeight || i.height;
  const k = Math.max(1, Math.round(P / (2 * h * iw / ih))), tw = P / (2 * k);
  let sw = iw, sh = (iw * h) / tw;
  if (sh > ih) { sh = ih; sw = (ih * tw) / h; }
  const sx = (iw - sw) / 2, sy = (ih - sh) * ay;
  for (let j = 0; j < 2 * k; j++) {
    c.save(); c.translate(j * tw + (j % 2 ? tw : 0), y); if (j % 2) c.scale(-1, 1);
    c.drawImage(i, sx, sy, sw, sh, 0, 0, tw + 0.5, h); c.restore();
  }
}
// average colour of a picture's band (fog colour for layers in front of a photo sky); null if the image is tainted
function avgColor(i, y0 = 0.45, y1 = 0.8) {
  try {
    const c = canvas(16, 16), x = c.getContext('2d', { willReadFrequently: true }), ih = i.naturalHeight || i.height;
    x.drawImage(i, 0, ih * y0, i.naturalWidth || i.width, ih * (y1 - y0), 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0;
    for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
    const n = d.length / 4; return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  } catch { return null; }
}

// [kind, depth, base offset above the floor, height, decoration]; the last layer is the dark foreground
export const SCENES = {
  hills: [['clouds', 0.05, 230, 0], ['peaks', 0.1, 118, 125], ['hills', 0.24, 70, 52, 'trees'], ['hills', 0.48, 34, 36, 'trees'], ['grass', 1, 0, 22]],
  forest: [['clouds', 0.05, 230, 0], ['hills', 0.1, 112, 74, 'pines'], ['pines', 0.24, 70, 46], ['pines', 0.48, 34, 40], ['ferns', 1, 0, 28]],
  city: [['clouds', 0.04, 240, 0], ['city', 0.1, 118, 125], ['city', 0.24, 70, 95], ['city', 0.48, 30, 66], ['fence', 1, 0, 34]],
  coast: [['clouds', 0.05, 220, 0], ['isles', 0.08, 104, 46], ['sea', 0.16, 100, 0], ['dunes', 0.45, 34, 26], ['grass', 1, 0, 22]],
  desert: [['clouds', 0.04, 240, 0], ['mesas', 0.1, 112, 96], ['dunes', 0.24, 64, 36], ['dunes', 0.48, 30, 26], ['rocks', 1, 0, 22]],
  alien: [['clouds', 0.04, 240, 0], ['spires', 0.1, 112, 135], ['shrooms', 0.24, 66, 74], ['spires', 0.48, 30, 72], ['shrooms', 1, 0, 42]],
  sky: [['bank', 0.05, 250, 38], ['bank', 0.12, 178, 44], ['bank', 0.24, 112, 50], ['bank', 0.45, 52, 52], ['bank', 0.9, -6, 46]]
};
export const SCENE_KEYS = Object.keys(SCENES);
// a scene that suits a picture group (clouds float, paintings and landscapes get land)
export function sceneFor(group, R) {
  const name = String(group?.kind || group?.name || group?.id || '').toLowerCase();
  if (/cloud|sky|weather/.test(name)) return 'sky';
  const k = ['hills', 'forest', 'coast', 'desert', 'alien', 'city', 'hills'];
  return k[Math.floor(R() * k.length)];
}

export class Backdrop {
  // o: { imgs (skin.bgSet: [sky, textures…]), floor (y where the land meets the ground), seed, land (colour), noClouds }
  constructor(g, scene, o = {}) {
    const R = mulberry32(((o.seed ?? g.post.seed ?? 1) * 2654435761 + 77) >>> 0);
    this.scene = SCENES[scene] ? scene : 'hills';
    this.floor = o.floor ?? H;
    this.imgs = (o.imgs || []).filter(Boolean);
    this.sky = this.imgs[0] || null;
    const pal = g.pal, acc = g.col(Math.floor(R() * 6));
    this.zen = pal.bg; this.hz = mix(pal.bg2, acc, 0.5); this.mid = mix(pal.bg, this.hz, 0.45);
    this.land = o.land || mix(g.col(this.scene === 'desert' ? 1 : this.scene === 'city' ? 5 : this.scene === 'alien' ? 4 : 2), pal.bg, 0.25);
    this.sun = { x: W * (0.15 + 0.7 * R()), y: this.floor - 200 - R() * 70, r: 13 + R() * 14 };
    this.stars = Array.from({ length: 70 }, () => [R() * (W + 80), R() * (this.floor - 140), R() * 1.2 + 0.35]);
    const spec = SCENES[this.scene].filter((s) => !(s[0] === 'clouds' && (o.noClouds || this.sky)));
    const n = spec.length, tex = this.imgs.slice(1);
    this.layers = spec.map(([kind, depth, off, amp, deco], i) => {
      const q = n > 1 ? i / (n - 1) : 1, front = depth >= 0.9, base = this.floor - off;
      return { kind, depth, base, amp, deco, q, front, seed: Math.floor(R() * 1e9), res: depth >= 0.4 ? 1.5 : 1,
        top: kind === 'clouds' ? 16 : base - amp - 34, drift: kind === 'clouds' || kind === 'bank' ? 4 + R() * 6 : 0,
        img: tex.length && !front && kind !== 'clouds' ? tex[i % tex.length] : null };
    });
    this.sk = null;
  }
  colors() {
    // once the sky picture is in, layers fade toward its own horizon colour
    if (this.sky && ready(this.sky) && !this.photoHz) { this.photoHz = avgColor(this.sky) || this.hz; this.hz = mix(this.photoHz, this.hz, 0.2); }
  }
  buildSky() {
    this.colors();
    const m = 30, r = 1.25, cv = canvas(W + 2 * m, H + 2 * m, r), c = cv.getContext('2d');
    c.setTransform(r, 0, 0, r, m * r, m * r);
    if (this.sky && ready(this.sky)) {
      const i = this.sky, iw = i.naturalWidth || i.width, ih = i.naturalHeight || i.height, s = Math.max((W + 2 * m) / iw, (H + 2 * m) / ih);
      c.drawImage(i, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      const g = c.createLinearGradient(0, -m, 0, H * 0.5); g.addColorStop(0, rgba(this.zen, 0.35)); g.addColorStop(1, rgba(this.zen, 0));
      c.fillStyle = g; c.fillRect(-m, -m, W + 2 * m, H + 2 * m);
      this.skyDone = true;
    } else {
      const g = c.createLinearGradient(0, -m, 0, this.floor);
      g.addColorStop(0, this.zen); g.addColorStop(0.5, this.mid); g.addColorStop(0.85, this.hz); g.addColorStop(1, mix(this.hz, '#000', 0.2));
      c.fillStyle = g; c.fillRect(-m, -m, W + 2 * m, H + 2 * m);
      const dark = lum(this.zen) < 0.2;
      if (dark) { c.fillStyle = '#fff'; for (const [x, y, s] of this.stars) { c.globalAlpha = 0.25 + s * 0.4; c.fillRect(x - m, y, s, s); } c.globalAlpha = 1; }
      const { x, y, r: sr } = this.sun, sc = mix(this.hz, '#fff', dark ? 0.75 : 0.55);
      const gl = c.createRadialGradient(x, y, sr * 0.6, x, y, sr * 4); gl.addColorStop(0, rgba(sc, dark ? 0.25 : 0.45)); gl.addColorStop(1, rgba(sc, 0));
      c.fillStyle = gl; c.fillRect(x - sr * 4, y - sr * 4, sr * 8, sr * 8);
      c.fillStyle = sc; c.beginPath(); c.arc(x, y, sr, 0, 7); c.fill();
      if (dark) { c.fillStyle = rgba(this.mid, 0.9); c.beginPath(); c.arc(x + sr * 0.45, y - sr * 0.2, sr * 0.92, 0, 7); c.fill(); }
    }
    this.sk = cv;
  }
  build(L) {
    this.colors();
    const r = L.res, h = Math.ceil(this.floor + 74 - L.top), cv = canvas(P, h, r), c = cv.getContext('2d');
    c.setTransform(r, 0, 0, r, 0, -L.top * r);
    const R = mulberry32(L.seed), dark = mix(this.land, '#000', L.front ? 0.74 : 0.12 + 0.5 * L.q);
    L.fill = L.kind === 'bank' || L.kind === 'clouds' ? mix(this.hz, '#fff', L.kind === 'clouds' ? 0.55 : 0.45 - 0.12 * L.q) : L.kind === 'sea' ? mix(this.hz, this.land, 0.35) : dark;
    c.fillStyle = L.fill;
    const post = this.shape(c, L, R);
    c.globalCompositeOperation = 'source-atop';
    const textured = L.img && ready(L.img);
    if (textured) {
      mirrorTile(c, L.img, L.base - L.amp - 10, this.floor + 74 - (L.base - L.amp - 10), L.kind === 'bank' ? 0.4 : 0.85);
      c.globalAlpha = 0.22 + 0.28 * (1 - L.q); c.fillStyle = L.fill; c.fillRect(0, L.top, P, h); c.globalAlpha = 1;
      L.done = true;
    }
    if (L.kind !== 'clouds') {
      const fog = L.front ? 0 : 0.55 * Math.pow(1 - L.q, 1.5), g = c.createLinearGradient(0, L.base - L.amp, 0, this.floor + 60);
      if (L.kind === 'bank') { g.addColorStop(0, 'rgba(255,255,255,.4)'); g.addColorStop(0.35, rgba(this.hz, fog * 0.5)); g.addColorStop(1, 'rgba(0,0,0,.16)'); }
      else { g.addColorStop(0, rgba(this.hz, fog)); g.addColorStop(0.55, rgba(this.hz, fog * 0.4)); g.addColorStop(1, `rgba(0,0,0,${0.16 + 0.22 * L.q})`); }
      c.fillStyle = g; c.fillRect(0, L.top, P, h);
      if (L.edge && !L.front && L.kind !== 'bank') {
        c.strokeStyle = rgba(mix(this.hz, '#fff', 0.5), 0.3); c.lineWidth = 1.6;
        c.beginPath(); for (let x = 0; x <= P; x += 4) c.lineTo(x, L.edge(x) + 1); c.stroke();
      }
    }
    c.globalCompositeOperation = 'source-over';
    post?.(c);
    L.cv = cv; L.h = h;
  }
  // silhouette of one layer (opaque fill); may return a callback for lights drawn after shading
  shape(c, L, R) {
    const base = L.base, amp = L.amp, bot = this.floor + 80;
    const edge = (f) => { L.edge = f; c.beginPath(); c.moveTo(0, bot); for (let x = 0; x <= P; x += 3) c.lineTo(x, f(x)); c.lineTo(P, bot); c.closePath(); c.fill(); };
    const wrap = (x, s, fn) => { fn(x); if (x < s) fn(x + P); if (x > P - s) fn(x - P); };
    const band = (y) => c.fillRect(0, y, P, bot - y);
    const lights = [];
    switch (L.kind) {
      case 'clouds': {
        c.globalAlpha = 0.45;
        for (let k = 0; k < 9; k++) {
          const cx = R() * P, cy = 30 + R() * (this.floor - 290), s = 0.6 + R() * 0.9, pf = Array.from({ length: 6 }, () => [(12 + R() * 8) * s, (8 + R() * 5) * s]);
          wrap(cx, 90, (x) => pf.forEach(([rx, ry], j) => { c.beginPath(); c.ellipse(x + (j - 2.5) * 13 * s, cy - Math.sin((j / 5) * Math.PI) * 10 * s, rx, ry, 0, 0, 7); c.fill(); }));
        }
        c.globalAlpha = 1; break;
      }
      case 'peaks': { const f = ridges(R, 3, 2); edge((x) => base - amp * Math.pow(f(x), 1.7)); break; }
      case 'hills': case 'isles': case 'dunes': {
        const f = waves(R, L.kind === 'dunes' ? 2 : 3, 0.45, L.kind === 'isles' ? 3 : 1);
        edge(L.kind === 'isles' ? (x) => base - amp * Math.max(0, f(x) * 1.8 - 0.35) : L.kind === 'dunes' ? (x) => base - amp * (0.5 + 0.5 * f(x)) * (0.75 + 0.25 * Math.sin((x / P) * TAU * 9)) : (x) => base - amp * (0.5 + 0.5 * f(x)));
        if (L.deco) for (let x = R() * 20; x < P; x += 7 + R() * 22) {
          const y = L.edge(x) + 3, s = 6 + R() * 9;
          if (R() < 0.35) continue;
          wrap(x, 20, (tx) => (L.deco === 'pines' ? pine(c, tx, y, s * 0.7, s * 2.2) : tree(c, tx, y, s)));
        }
        break;
      }
      case 'pines': {
        const f = waves(R, 3, 0.5, 2); edge((x) => base - amp * 0.35 * (0.5 + 0.5 * f(x)));
        for (let x = R() * 8; x < P; x += 5 + R() * 9) { const y = L.edge(x) + 4, hh = amp * (0.45 + 0.55 * R()); wrap(x, 20, (tx) => pine(c, tx, y, hh * 0.28, hh)); }
        break;
      }
      case 'mesas': { const f = waves(R, 4, 0.5, 1); edge((x) => base - amp * clamp(f(x) * 2.4 + 0.3, 0, 1) * (0.85 + 0.15 * Math.sin((x / P) * TAU * 23))); break; }
      case 'city': {
        let x = 0; const win = mix(this.hz, '#ffe9a8', 0.75);
        while (x < P) {
          let w = 14 + R() * 30; if (x + w > P - 12) w = P - x;
          const hh = amp * (0.25 + 0.75 * R() * R() + 0.15 * R()), y = base - hh;
          c.fillRect(x, y, w + 0.5, bot - y);
          const roof = R();
          if (roof < 0.25) c.fillRect(x + w * 0.25, y - hh * 0.12, w * 0.5, hh * 0.12 + 1);
          else if (roof < 0.4) { c.fillRect(x + w * 0.45, y - 16, 1.5, 16); }
          else if (roof < 0.5) { c.beginPath(); c.arc(x + w / 2, y, w * 0.32, Math.PI, 0); c.fill(); }
          for (let wy = y + 5; wy < base + 30; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (R() < 0.22) lights.push([wx, wy]);
          x += w;
        }
        L.edge = null;
        return (cc) => { cc.fillStyle = win; for (const [wx, wy] of lights) { cc.globalAlpha = (0.35 + 0.5 * R()) * (0.5 + 0.5 * L.q); cc.fillRect(wx, wy, 2, 2.6); } cc.globalAlpha = 1; };
      }
      case 'sea': {
        band(base); L.edge = () => base;
        return (cc) => { cc.strokeStyle = rgba(mix(this.hz, '#fff', 0.5), 0.35); cc.lineWidth = 1; for (let k = 0; k < 140; k++) { const x = R() * P, y = base + 2 + Math.pow(R(), 1.6) * 70, w = 4 + R() * 18; cc.beginPath(); cc.moveTo(x, y); cc.lineTo(x + w, y); cc.stroke(); } };
      }
      case 'spires': {
        const f = waves(R, 3, 0.5, 2); edge((x) => base - amp * 0.18 * (0.5 + 0.5 * f(x)));
        for (let k = 0; k < 26; k++) { const x = R() * P, hh = amp * (0.3 + 0.7 * R()), w = 6 + R() * 12, tip = (R() - 0.5) * 6; wrap(x, 20, (tx) => { c.beginPath(); c.moveTo(tx - w, base + 4); c.lineTo(tx + tip, base - hh); c.lineTo(tx + w, base + 4); c.fill(); }); }
        break;
      }
      case 'shrooms': {
        const f = waves(R, 3, 0.5, 2); edge((x) => base - amp * 0.2 * (0.5 + 0.5 * f(x)));
        const glow = mix(this.hz, '#fff', 0.6);
        for (let k = 0; k < (L.front ? 9 : 16); k++) {
          const x = R() * P, hh = amp * (0.35 + 0.65 * R()), w = hh * (0.35 + R() * 0.3);
          wrap(x, 50, (tx) => { c.fillRect(tx - w * 0.12, base - hh, w * 0.24, hh + 6); c.beginPath(); c.ellipse(tx, base - hh, w, w * 0.55, 0, Math.PI, 0); c.fill(); lights.push([tx, base - hh - w * 0.25, w]); });
        }
        return (cc) => { cc.fillStyle = glow; for (const [x, y, w] of lights) for (let j = 0; j < 3; j++) { cc.globalAlpha = L.front ? 0.18 : 0.4; cc.beginPath(); cc.arc(x + (j - 1) * w * 0.45, y + Math.abs(j - 1) * w * 0.12, 1.2 + w * 0.06, 0, 7); cc.fill(); } cc.globalAlpha = 1; };
      }
      case 'bank': {
        const f = waves(R, 3, 0.5, 2); L.edge = (x) => base - amp * (0.5 + 0.5 * f(x));
        c.fillRect(0, base - amp * 0.2, P, bot - base + amp * 0.2);
        for (let x = 0; x < P; x += 10 + R() * 10) { const rr = 14 + R() * 24, y = L.edge(x) + rr * 0.55; wrap(x, 40, (tx) => { c.beginPath(); c.arc(tx, y, rr, 0, 7); c.fill(); }); }
        break;
      }
      default: { // foreground: grass, ferns, rocks, fence
        const f = waves(R, 3, 0.5, 2); L.edge = (x) => base - 4 - 4 * f(x);
        c.beginPath(); c.moveTo(0, bot); for (let x = 0; x <= P; x += 6) c.lineTo(x, L.edge(x)); c.lineTo(P, bot); c.fill();
        if (L.kind === 'grass' || L.kind === 'ferns') {
          const n = L.kind === 'grass' ? 360 : 70;
          for (let k = 0; k < n; k++) {
            const x = R() * P, hh = amp * (0.3 + 0.7 * R()) * (L.kind === 'ferns' ? 1.2 : 1), lean = (R() - 0.5) * hh * 0.6, w = L.kind === 'ferns' ? 5 : 1.6;
            wrap(x, 20, (tx) => { const y = L.edge(tx) + 2; c.beginPath(); c.moveTo(tx - w, y); c.quadraticCurveTo(tx + lean * 0.3, y - hh * 0.6, tx + lean, y - hh); c.quadraticCurveTo(tx + lean * 0.3 + w * 0.4, y - hh * 0.5, tx + w, y); c.fill(); });
          }
          if (L.kind === 'ferns') for (let k = 0; k < 14; k++) { const x = R() * P, rr = 8 + R() * 12; wrap(x, 30, (tx) => { c.beginPath(); c.arc(tx, L.edge(tx) - rr * 0.3, rr, 0, 7); c.fill(); }); }
        } else if (L.kind === 'rocks') {
          for (let k = 0; k < 22; k++) { const x = R() * P, w = 6 + R() * 18, hh = w * (0.4 + R() * 0.5); wrap(x, 30, (tx) => { c.beginPath(); c.ellipse(tx, L.edge(tx) + 2, w, hh, 0, Math.PI, 0); c.fill(); }); }
        } else if (L.kind === 'fence') {
          const y0 = base - amp * 0.55;
          c.fillRect(0, y0, P, 2); c.fillRect(0, y0 + 9, P, 2);
          for (let x = 0; x < P; x += 12) c.fillRect(x, y0 - 2, 2, base - y0 + 4);
          const lamp = mix(this.hz, '#ffe9a8', 0.8);
          for (let x = 40 + R() * 40; x < P - 20; x += 110 + R() * 90) { c.fillRect(x, base - amp * 1.6, 2.5, amp * 1.6); c.fillRect(x - 6, base - amp * 1.6, 9, 2.5); lights.push([x - 5, base - amp * 1.6 + 4]); }
          return (cc) => { for (const [x, y] of lights) { const g = cc.createRadialGradient(x, y, 0, x, y, 26); g.addColorStop(0, rgba(lamp, 0.7)); g.addColorStop(1, rgba(lamp, 0)); cc.fillStyle = g; cc.fillRect(x - 26, y - 26, 52, 52); } };
        }
      }
    }
    return null;
  }
  draw(c, camX = 0, camY = 0, t = 0, alpha = 1) {
    if (!this.sk || (this.sky && !this.skyDone && ready(this.sky))) this.buildSky();
    const m = 30;
    c.globalAlpha = alpha;
    c.drawImage(this.sk, -m + clamp(-camX * 0.02, -m + 2, m - 2), -m + clamp(camY * 0.02, -m + 2, m - 2), W + 2 * m, H + 2 * m);
    for (const L of this.layers) {
      if (!L.cv || (L.img && !L.done && ready(L.img))) this.build(L);
      const ox = -((((camX * L.depth + t * L.drift) % P) + P) % P), oy = L.top + clamp(camY * L.depth, -40, 40);
      c.drawImage(L.cv, ox, oy, P, L.h);
      if (ox + P < W) c.drawImage(L.cv, ox + P, oy, P, L.h);
    }
    c.globalAlpha = 1;
  }
}
function tree(c, x, y, s) { c.fillRect(x - 1, y - s, 2, s); for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x + (j - 1) * s * 0.4, y - s - (j === 1 ? s * 0.45 : s * 0.1), s * 0.55, 0, 7); c.fill(); } }
function pine(c, x, y, w, h) { c.fillRect(x - 1, y - 3, 2, 4); for (let j = 0; j < 3; j++) { const b = y - h * j * 0.28, ww = w * (1 - j * 0.25); c.beginPath(); c.moveTo(x - ww, b); c.lineTo(x, b - h * 0.5); c.lineTo(x + ww, b); c.fill(); } }
