// The garden's small living touches, as they were in the old garden: banks of low fog that part round
// you and drift back, trees and bushes that sway when you brush past and shed a few leaves, rings
// spreading on the water, and the wisps that follow you for each treasure found.
import { puffSprite, ringSprite, glowSprite } from './scene.js';
import { clamp } from '../mk/tex.js';

const WISP = [[255, 246, 200], [159, 216, 255], [255, 184, 232], [191, 247, 234], [200, 168, 255], [255, 217, 138]];

// ------------------------------------------------ fog that parts
// banks of a few puffs each, laid low over the ground round the walker; anything moving through pushes the
// puffs aside, and they ease back to where they were as it passes
export class FogField {
  constructor() { this.banks = []; this.t = 0; }
  clear() { this.banks = []; }
  // density 0..1 (how foggy this country is), col the mist's colour, movers [[x, y, vx, vy, strength]]
  update(dt, g, density, col, movers) {
    this.t += dt; const P = g.P, here = P.place, want = Math.round(clamp(density, 0, 1) * 16), wind = [Math.cos(this.t * 0.013) * 5, Math.sin(this.t * 0.011) * 2];
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
  // drawn beside and beyond the walker; those coming between you and the camera thin away, so the mist never smothers the view
  draw(B, K, strength, P) {
    for (const b of this.banks) for (const p of b.puffs) {
      const x = b.x + p.ox + p.dx, y = b.y + p.oy + p.dy, dz = y - P.y, near = clamp(1 - (dz + 6) / 60, 0, 1) * clamp(1 - (Math.abs(x - P.x) - 150) / 90, 0, 1), al = clamp(b.a * strength * near, 0, 0.9); if (al < 0.04) continue;
      const s = puffSprite(b.col, p.v); B.bb(s, 0, 0, s.width, s.height, x, y, b.base + p.h, K * 0.7, 1, al, undefined, 0, p.s * 0.8);
    }
  }
}

// ------------------------------------------------ trees and bushes that sway
export class Sway {
  constructor() { this.m = new Map(); }
  kick(p, amp) { let s = this.m.get(p); if (!s) this.m.set(p, (s = { a: 0, t: Math.random() * 6 })); s.a = Math.min(1.3, s.a + amp); }
  update(dt) { for (const [p, s] of this.m) { s.t += dt; s.a *= Math.pow(0.2, dt); if (s.a < 0.01) this.m.delete(p); } }
  // how far a prop's top leans this frame, in px
  skew(p, h) { const s = this.m.get(p); return s ? Math.sin(s.t * 12) * s.a * Math.min(7, h * 0.1) : 0; }
}

// ------------------------------------------------ rings on the water
export class Ripples {
  constructor() { this.r = []; }
  add(x, y, h, big = false) { if (this.r.length < 40) this.r.push({ x, y, h, t: 0, life: big ? 1.7 : 1.15, s: big ? 1.5 : 1 }); }
  update(dt) { for (const q of this.r) q.t += dt; this.r = this.r.filter((q) => q.t < q.life); }
  draw(B) { const cv = ringSprite(); for (const q of this.r) { const k = q.t / q.life, w = (5 + k * 30) * q.s; B.gd(cv, q.x, q.y, w, w * 0.62, q.h + 0.6, (1 - k) * 0.95); } }
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
