// The air over the 3D view, drawn in view pixels on top: Makhana's drifting dithered fog, the weather
// (rain, snow, ash, embers, spores, fireflies, leaves, pollen, sand, dust, drips, haze), the glow of
// fires, windows and lanterns, and a vignette. The tint grades the light by the hour.
import { mk, fbm, bay, rgb, clamp } from '../mk/tex.js';
import { GFX } from './gfx.js';

let FOGTILE = null;
function fogTile() {
  if (FOGTILE) return FOGTILE;
  FOGTILE = mk(128, 96); const x = FOGTILE.getContext('2d'), img = x.createImageData(128, 96), d = img.data;
  for (let y = 0; y < 96; y++) for (let X = 0; X < 128; X++) { const n = fbm(X / 32, y / 24, 555, 4, 4); if (n + bay(X, y) * 0.35 > 0.52) { const i = (y * 128 + X) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 255; } }
  x.putImageData(img, 0, 0); return FOGTILE;
}
export class Atmos {
  constructor() { this.amb = []; this.fogC = mk(16, 16); this.t = 0; this.glow = new Map(); }
  // motes drift in view space, nudged by how the camera moved (dcx, dcy in view px)
  update(dt, type, VW, VH, dcx, dcy) {
    this.t += dt; const n = Math.round((type === 'rain' ? 120 : type === 'snow' ? 90 : type ? 60 : 0) * GFX.parts), A = this.amb;
    while (A.length < n) A.push(this.mote(type, VW, VH)); A.length = Math.min(A.length, n);
    for (const a of A) {
      if (a.type !== type) Object.assign(a, this.mote(type, VW, VH));
      a.x += a.vx * dt - dcx * a.z; a.y += a.vy * dt - dcy * a.z; a.t += dt;
      if (type === 'leaves' || type === 'pollen' || type === 'snow') a.x += Math.sin(a.t * 2 + a.p) * 8 * dt;
      if (type === 'fireflies' || type === 'spores') { a.vx += (Math.random() - 0.5) * 20 * dt; a.vy += (Math.random() - 0.5) * 20 * dt; a.vx *= 0.99; a.vy *= 0.99; }
      if (a.x < -8) a.x += VW + 16; if (a.x > VW + 8) a.x -= VW + 16; if (a.y < -8) a.y += VH + 16; if (a.y > VH + 8) a.y -= VH + 16;
    }
  }
  mote(type, VW, VH) {
    const r = Math.random, a = { type, x: r() * VW, y: r() * VH, z: 0.6 + r() * 0.7, t: 0, p: r() * 6.3, vx: 0, vy: 0 };
    switch (type) {
      case 'rain': a.vx = -40; a.vy = 220 + r() * 60; break; case 'snow': a.vx = -6 + r() * 4; a.vy = 14 + r() * 14; break;
      case 'leaves': a.vx = -10 + r() * 8; a.vy = 10 + r() * 8; break; case 'dust': case 'sand': a.vx = (type === 'sand' ? -50 : -12) - r() * 20; a.vy = r() * 4 - 2; break;
      case 'ash': a.vx = -6 + r() * 4; a.vy = 8 + r() * 10; break; case 'embers': a.vx = r() * 10 - 5; a.vy = -14 - r() * 14; break;
      case 'spores': case 'fireflies': a.vx = r() * 8 - 4; a.vy = r() * 8 - 4; break; case 'pollen': a.vx = -6; a.vy = 2 + r() * 3; break;
      case 'drips': a.vx = 0; a.vy = 120 + r() * 40; break; case 'haze': a.vx = -8 - r() * 6; a.vy = 0; break;
    }
    return a;
  }
  // glows: [x, y (view px), radius, [r, g, b], strength]
  lights(c, list, dark) {
    if (!list.length) return; c.save(); c.globalCompositeOperation = 'lighter';
    for (const [x, y, r, col, a] of list) { const k = clamp(a * (0.35 + dark * 0.9), 0, 1); if (k < 0.02 || x < -r || y < -r) continue; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgb(col, 0.5 * k)); g.addColorStop(0.35, rgb(col, 0.18 * k)); g.addColorStop(1, rgb(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.restore();
  }
  // everything over the scene, in view px: fog wisps (coloured fogCol), motes, tint and the vignette
  draw(c, VW, VH, camX, camY, fogCol, fogA, type, tint) {
    if (fogA > 0.01 && GFX.fogOv > 0) {
      const F = this.fogC, T = fogTile(); if (F.width !== VW || F.height !== VH) { F.width = VW; F.height = VH; }
      const x = F.getContext('2d'); x.clearRect(0, 0, VW, VH); const ox = -((((camX * 0.6 + this.t * 6) % 128) + 128) % 128), oy = -((((camY * 0.6 + this.t * 2) % 96) + 96) % 96);
      for (let y = oy; y < VH; y += 96) for (let X = ox; X < VW; X += 128) x.drawImage(T, X, y);
      x.globalAlpha = 0.55; const ox2 = -((((camX * 0.9 - this.t * 9) % 128) + 128) % 128); for (let y = oy - 40; y < VH; y += 96) for (let X = ox2; X < VW; X += 128) x.drawImage(T, X, y); x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-in'; x.fillStyle = rgb(fogCol); x.fillRect(0, 0, VW, VH); x.globalCompositeOperation = 'source-over';
      c.globalAlpha = clamp(fogA * 0.45 * GFX.fogOv, 0, 1); c.drawImage(F, 0, 0); c.globalAlpha = 1;
    }
    for (const a of this.amb) {
      const x = Math.round(a.x), y = Math.round(a.y);
      switch (type) {
        case 'rain': c.fillStyle = 'rgba(190,210,220,.36)'; c.fillRect(x, y, 1, 3); c.fillRect(x - 1, y + 3, 1, 2); break;
        case 'snow': c.fillStyle = a.p < 3 ? 'rgba(240,246,250,.8)' : 'rgba(220,230,240,.55)'; c.fillRect(x, y, a.z > 1 ? 2 : 1, a.z > 1 ? 2 : 1); break;
        case 'leaves': c.fillStyle = a.p < 2 ? '#6a7a30' : a.p < 4 ? '#8a6a2a' : '#4a5a24'; c.fillRect(x, y, Math.sin(a.t * 4 + a.p) > 0 ? 2 : 1, 1); break;
        case 'dust': c.fillStyle = 'rgba(220,200,170,.35)'; c.fillRect(x, y, 1, 1); break;
        case 'sand': c.fillStyle = 'rgba(240,220,170,.5)'; c.fillRect(x, y, 2, 1); break;
        case 'ash': c.fillStyle = a.p < 0.4 ? '#ff9040' : 'rgba(200,195,205,.6)'; c.fillRect(x, y, 1, 1); break;
        case 'embers': c.fillStyle = Math.sin(a.t * 10 + a.p) > 0 ? '#ffd060' : '#ff6020'; c.fillRect(x, y, 1, 1); break;
        case 'spores': c.fillStyle = Math.sin(a.t * 3 + a.p) > 0.2 ? (a.p < 3 ? '#c8ff90' : '#e0a0ff') : 'rgba(200,255,150,.25)'; c.fillRect(x, y, 1, 1); break;
        case 'fireflies': if (Math.sin(a.t * 2.3 + a.p) > 0.4) { c.fillStyle = '#fff090'; c.fillRect(x, y, 1, 1); c.fillStyle = 'rgba(255,240,120,.25)'; c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); } break;
        case 'pollen': c.fillStyle = 'rgba(255,250,200,.55)'; c.fillRect(x, y, 1, 1); break;
        case 'drips': c.fillStyle = 'rgba(150,200,200,.45)'; c.fillRect(x, y, 1, 2); break;
        case 'haze': c.fillStyle = 'rgba(255,250,235,.07)'; c.fillRect(x, y, 24, 1); break;
      }
    }
    if (tint) { c.fillStyle = tint[0]; c.fillRect(0, 0, VW, VH); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, 0, VW * 0.7, VH); g.addColorStop(0, tint[1]); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, VW, VH); c.globalCompositeOperation = 'source-over'; }
    const vk = Math.max(0, GFX.vig - 1), vg = c.createRadialGradient(VW / 2, VH / 2, VH * Math.max(0.12, 0.45 - vk * 0.11), VW / 2, VH / 2, VH * Math.max(0.6, 1.05 - vk * 0.13));
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${clamp(0.5 * GFX.vig, 0, 0.97)})`); c.fillStyle = vg; c.fillRect(0, 0, VW, VH);
  }
}
