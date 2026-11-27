// The garden's small living touches, as they were in the old garden: banks of low fog that part round
// you and drift back, trees and bushes that sway when you brush past and shed a few leaves, rings
// spreading on the water, and the wisps that follow you for each treasure found.
import { glowSprite } from './scene.js';
import { clamp, mk } from '../mk/tex.js';
import { K_WATER } from './world.js';

const WISP = [[255, 246, 200], [159, 216, 255], [255, 184, 232], [191, 247, 234], [200, 168, 255], [255, 217, 138]];

// ------------------------------------------------ fog that parts
// banks of a few puffs each, laid low over the ground round the walker; anything moving through pushes the
// puffs aside, and they ease back to where they were as it passes
export class FogField {
  constructor() { this.banks = []; this.t = 0; }
  clear() { this.banks = []; }
  // density 0..1 (how foggy this country is), col the mist's colour, movers [[x, y, vx, vy, strength]]
  update(dt, g, density, col, movers) {
    this.t += dt; const P = g.P, here = P.place, want = Math.round(clamp(density, 0, 1) * 9), wind = [Math.cos(this.t * 0.013) * 5, Math.sin(this.t * 0.011) * 2];
    const far = (b) => Math.hypot(b.x - P.x, b.y - P.y);
    for (let n = 0; this.banks.length < want && n < 2; n++) {
      // new banks come in round the edge of the view (all over it, the first time)
      const fresh = !this.banks.length, a = Math.random() * 6.283, d = fresh ? 40 + Math.random() * 300 : 260 + Math.random() * 120, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d * 0.8;
      const base = g.W.heightAt(x, y, here); if (!Number.isFinite(base) || Math.abs(base - P.h) > 120) continue;
      const k = 4 + Math.floor(Math.random() * 5), s = 0.9 + Math.random() * 0.9;
      this.banks.push({ x, y, base, a: 0, life: 30 + Math.random() * 50, col, puffs: Array.from({ length: k }, () => ({ ox: (Math.random() - 0.5) * 90 * s, oy: (Math.random() - 0.5) * 40 * s, h: 2 + Math.random() * 14, s: s * (1 + Math.random() * 0.8), v: Math.floor(Math.random() * 4), dx: 0, dy: 0, vx: 0, vy: 0 })) });
    }
    for (const b of this.banks) {
      b.x += wind[0] * dt; b.y += wind[1] * dt; b.life -= dt; b.a += ((b.life > 0 ? 1 : 0) - b.a) * Math.min(1, dt * 0.5);
      for (const p of b.puffs) {
        const px = b.x + p.ox + p.dx, py = b.y + p.oy + p.dy; let fx = -p.dx * 1.1 - p.vx * 1.5, fy = -p.dy * 1.1 - p.vy * 1.5;
        for (const [mx, my, mvx, mvy, m] of movers) { const ex = px - mx, ey = py - my, d = Math.hypot(ex, ey), reach = 22 + p.s * 18; if (d < reach && d > 0.01) { const k = (1 - d / reach) * (150 + Math.hypot(mvx, mvy) * 2.4) * m; fx += (ex / d) * k; fy += (ey / d) * k * 0.8; } }
        p.vx += fx * dt; p.vy += fy * dt; p.dx += p.vx * dt; p.dy += p.vy * dt;
      }
    }
    this.banks = this.banks.filter((b) => (b.life > 0 || b.a > 0.02) && far(b) < 520);
    if (this.banks.length > want + 4) this.banks.sort((a, b) => far(a) - far(b)).length = want + 4;
  }
  // drawn over the picture as the old garden drew it (soft, see-through puffs), but anchored in the world: each puff
  // is projected to the screen and sized by its distance. Those coming between you and the camera thin away.
  draw2D(c, PJ, D, strength, P) {
    for (const b of this.banks) for (const p of b.puffs) {
      const x = b.x + p.ox + p.dx, y = b.y + p.oy + p.dy, dz = y - P.y, near = clamp(1 - (dz + 4) / 70, 0, 1), al = clamp(b.a * strength * near, 0, 0.6); if (al < 0.02) continue;
      const [sx, sy, w] = PJ(x, y, 0, b.base + p.h); if (w <= D * 0.35) continue; const k = D / w, r = 26 * p.s * k, s = softPuff(b.col);
      c.globalAlpha = al * clamp((w - D * 0.35) / (D * 0.3), 0, 1); c.drawImage(s, sx - r, sy - r * 0.62, r * 2, r * 1.24);
    }
    c.globalAlpha = 1;
  }
}
// one soft puff: an ellipse whose density falls away smoothly to its edge (drawn with smoothing on, so it is blurry)
const softs = new Map();
function softPuff(col) {
  const key = col.join(','); let cv = softs.get(key); if (cv) return cv;
  cv = mk(64, 64); const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32), [r, gg, b] = col;
  for (const [t, a] of [[0, 0.9], [0.35, 0.62], [0.65, 0.26], [0.85, 0.08], [1, 0]]) g.addColorStop(t, `rgba(${r},${gg},${b},${a})`);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); softs.set(key, cv); return cv;
}

// ------------------------------------------------ trees and bushes that sway
export class Sway {
  constructor() { this.m = new Map(); }
  kick(p, amp) { let s = this.m.get(p); if (!s) this.m.set(p, (s = { a: 0, t: Math.random() * 6 })); s.a = Math.min(1.3, s.a + amp); }
  update(dt) { for (const [p, s] of this.m) { s.t += dt; s.a *= Math.pow(0.2, dt); if (s.a < 0.01) this.m.delete(p); } }
  // how far a prop's top leans this frame, in px
  skew(p, h) { const s = this.m.get(p); return s ? Math.sin(s.t * 12) * s.a * Math.min(7, h * 0.1) : 0; }
}

// ------------------------------------------------ water that moves
// as the old garden had it: a height field on 2-px cells over the water round the walker (waves spread, bounce
// off the banks and die away), drawn as light and dark glints laid on the water's surface. Pokes come from you
// wading and swimming, from swimmers, from drops and fish. The field slides along as you walk.
export class Ripples {
  constructor() { this.w = 200; this.h = 176; const N = this.w * this.h; this.a = new Float32Array(N); this.b = new Float32Array(N); this.m = new Uint8Array(N); this.ox = -1e9; this.oy = -1e9; this.place = undefined; this.any = false; this.cv = mk(this.w, this.h); this.img = this.cv.getContext('2d').createImageData(this.w, this.h); this.level = 0; this.t = 0; }
  // where the field lies: round the walker, more of it ahead (north, where the camera looks)
  anchor(P, Wd) {
    const ox = Math.floor((P.x - this.w) / 2), oy = Math.floor((P.y - this.h * 1.45) / 2), dx = ox - this.ox, dy = oy - this.oy;
    if (P.place !== this.place) { this.place = P.place; this.a.fill(0); this.b.fill(0); this.ox = ox; this.oy = oy; this.mask(P, Wd); return; }
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      // slide the water along, keeping its waves
      for (const k of ['a', 'b']) { const o = this[k], n = new Float32Array(o.length); for (let j = 0; j < this.h; j++) { const sj = j + dy; if (sj < 0 || sj >= this.h) continue; for (let i = 0; i < this.w; i++) { const si = i + dx; if (si >= 0 && si < this.w) n[j * this.w + i] = o[sj * this.w + si]; } } this[k] = n; }
      this.ox = ox; this.oy = oy; this.mask(P, Wd);
    }
  }
  // which cells are water at the level of the water nearest you (asked a tile at a time)
  mask(P, Wd) {
    const w = this.w, h = this.h, m = this.m; m.fill(0); this.any = false; let level = null, bd = 1e9;
    const tx0 = Math.floor((this.ox * 2) / 16), ty0 = Math.floor((this.oy * 2) / 16), tx1 = Math.floor(((this.ox + w) * 2) / 16), ty1 = Math.floor(((this.oy + h) * 2) / 16), tiles = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const c = Wd.cell(tx * 16 + 8, ty * 16 + 8, P.place); if (c.k !== K_WATER) continue; const t = c.t; tiles.push([tx, ty, t]); const d = Math.hypot(tx * 16 - P.x, ty * 16 - P.y) + Math.abs(t - P.h) * 4; if (d < bd) { bd = d; level = t; } }
    if (level === null) return; this.level = level;
    for (const [tx, ty, t] of tiles) { if (Math.abs(t - level) > 2) continue; const i0 = tx * 8 - this.ox, j0 = ty * 8 - this.oy; for (let j = Math.max(0, j0); j < Math.min(h, j0 + 8); j++) for (let i = Math.max(0, i0); i < Math.min(w, i0 + 8); i++) m[j * w + i] = 1; this.any = true; }
  }
  // a soft, round drop
  poke(x, y, s) {
    const i = Math.floor(x / 2) - this.ox, j = Math.floor(y / 2) - this.oy, w = this.w;
    if (i < 3 || j < 3 || i >= w - 3 || j >= this.h - 3 || !this.m[j * w + i]) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const k = (j + dy) * w + i + dx; if (this.m[k]) this.a[k] += s * Math.exp(-(dx * dx + dy * dy) / 1.2); }
  }
  step() {
    if (!this.any) return; const { w, h, a, b, m } = this;
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { const k = j * w + i; b[k] = m[k] ? ((a[k - 1] + a[k + 1] + a[k - w] + a[k + w]) * 0.5 - b[k]) * 0.975 : 0; }
    this.a = b; this.b = a;
  }
  // the glints: light where the surface tilts toward the sky, dark where it tilts away
  paint(light, dark) {
    if (!this.any) return null; const { w, h, a, m } = this, d = this.img.data; d.fill(0); let n = 0;
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { const k = j * w + i; if (!m[k]) continue; const s = a[k - 1] - a[k + 1] + a[k - w] - a[k + w]; if (s > 0.3) { const o = k * 4; d[o] = light[0]; d[o + 1] = light[1]; d[o + 2] = light[2]; d[o + 3] = light[3]; n++; } else if (s < -0.3) { const o = k * 4; d[o] = dark[0]; d[o + 1] = dark[1]; d[o + 2] = dark[2]; d[o + 3] = dark[3]; n++; } }
    if (!n) return null; this.cv.getContext('2d').putImageData(this.img, 0, 0); return this.cv;
  }
}

// ------------------------------------------------ the wisps: one for each treasure found, trailing after you
export class Wisps {
  constructor() { this.w = []; this.t = 0; }
  update(dt, P, n) {
    this.t += dt;
    while (this.w.length < n) { const i = this.w.length; this.w.push({ x: P.x, y: P.y, h: P.hv + 24, vx: 0, vy: 0, vh: 0, ph: i * 1.7, c: WISP[i % WISP.length] }); }
    this.w.length = Math.min(this.w.length, n);
    let lx = P.x, ly = P.y;
    this.w.forEach((w, i) => {
      // each follows the one before it (the first follows you), circling a little, bobbing
      const a = this.t * 0.8 + w.ph, tx = lx + Math.cos(a) * (10 + (i % 3) * 3), ty = ly + 5 + Math.sin(a) * 6, th = P.hv + 22 + Math.sin(this.t * 1.9 + w.ph) * 5 + (i % 2) * 6;
      const k = i === 0 ? 6 : 9; w.vx += ((tx - w.x) * k - w.vx * 3.2) * dt; w.vy += ((ty - w.y) * k - w.vy * 3.2) * dt; w.vh += ((th - w.h) * k - w.vh * 3.2) * dt;
      w.x += w.vx * dt; w.y += w.vy * dt; w.h += w.vh * dt; if (!Number.isFinite(w.x)) { w.x = P.x; w.y = P.y; w.h = P.hv + 24; w.vx = w.vy = w.vh = 0; }
      lx = w.x; ly = w.y;
    });
  }
  // their glow goes to the lights; the bright hearts are drawn as small glows of their own
  lights(list) { for (const w of this.w) { list.push({ x: w.x, y: w.y, h: w.h, r: 12, c: w.c, a: 0.42 }); list.push({ x: w.x, y: w.y, h: w.h, r: 2.6, c: w.c.map((v) => Math.min(255, v + 40)), a: 0.95, core: 1 }); } }
}
export { glowSprite };
