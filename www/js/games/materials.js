// Falling materials for the arcade games: a coarse cellular grid of sand, gunpowder, stone, embers, water, oil,
// lava, fire, smoke and steam, plus flying grains for splashes and blasts. Only 8×8-cell chunks where something
// moved last tick are stepped, so settled piles cost nothing. A game stamps its pegs as solid cells, lets its balls
// plow through the grid (and be slowed by it), reads `events` for gunpowder blasts and draws it where it likes.
// Also here: Fx (confetti, sparks, shards, stars, puffs, flung sprites, shock rings, pops, banners, shake, flash)
// and Tail (tracer tails).
import { W, H, rgbOf, drawFit } from './engine.js';

export const EMPTY = 0, WALL = 1, SAND = 2, POWDER = 3, STONE = 4, EMBER = 5, WATER = 6, OIL = 7, LAVA = 8, FIRE = 9, SMOKE = 10, STEAM = 11, SPARK = 12;
const KIND = [0, 1, 2, 2, 2, 2, 3, 3, 3, 5, 4, 4, 5]; // 1 solid, 2 powder, 3 liquid, 4 gas, 5 fire
const DENS = [0, 99, 30, 28, 34, 26, 10, 8, 14, 0, 1, 1, 0];
export const MASS = [0, 0, 1, 0.9, 1.3, 0.6, 0.45, 0.55, 0.9, 0, 0, 0, 0];
const HOT = [0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1];
export const MAT_RGB = { [SAND]: [226, 190, 122], [POWDER]: [58, 56, 66], [STONE]: [124, 120, 130], [EMBER]: [255, 150, 50], [WATER]: [52, 128, 226], [OIL]: [52, 40, 38], [LAVA]: [255, 96, 24], [SPARK]: [255, 228, 150] };
const pack = (r, g, b, a = 255) => (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const FIRE_C = [], LAVA_C = [], SMOKE_C = [], STEAM_C = [], WATER_C = [];
for (let k = 0; k < 16; k++) { const h = k >> 2, j = (k & 3) * 9; FIRE_C.push(pack(255 - (3 - h) * 24, [46, 96, 160, 232][h] + j, [10, 18, 36, 150][h])); }
for (let k = 0; k < 4; k++) LAVA_C.push(pack(255, 66 + k * 28, 16 + k * 7));
for (let l = 0; l < 256; l++) { SMOKE_C.push(pack(78, 74, 84, Math.min(170, l * 3))); STEAM_C.push(pack(226, 232, 242, Math.min(140, l * 2.4))); }
for (let k = 0; k < 12; k++) WATER_C.push(k < 4 ? pack(150 + k * 12, 208, 255, 225) : k < 8 ? pack(48, 126 + k * 4, 228, 205) : pack(30, 88 + k * 2, 192, 215)); // falling, flowing, still

export class Materials {
  constructor(o = {}) {
    const cs = (this.cs = o.cell || 3), w = (this.w = Math.ceil(W / cs)), h = (this.h = Math.ceil(H / cs)), n = w * h;
    this.T = new Uint8Array(n); this.C = new Uint32Array(n); this.L = new Uint8Array(n); this.K = new Uint8Array(n);
    this.cw = (w + 7) >> 3; this.ch = (h + 7) >> 3;
    this.act = new Uint8Array(this.cw * this.ch); this.nxt = new Uint8Array(this.cw * this.ch);
    this.floor = o.floor ?? 'open'; // 'open' (falls out), 'solid', or a drain chance per tick for the bottom row
    this.g = o.g ?? 1; this.rate = o.rate || 60; this.cap = o.cap || 6000;
    this.clk = 1; this.acc = 0; this.count = 0; this.hot = 0; this.booms = 0; this.s = (o.seed | 0) || 0x2545f491;
    const P = (this.pmax = o.particles || 900);
    this.px = new Float32Array(P); this.py = new Float32Array(P); this.pvx = new Float32Array(P); this.pvy = new Float32Array(P);
    this.pl = new Float32Array(P); this.pt = new Uint8Array(P); this.pc = new Uint32Array(P); this.np = 0;
    this.events = []; this.drain = new Float32Array(w); this.met = new Float32Array(16);
    const mk = (a, b) => Object.assign(document.createElement('canvas'), { width: a, height: b });
    this.cv = mk(w, h); this.cx = this.cv.getContext('2d'); this.img = this.cx.createImageData(w, h); this.pix = new Uint32Array(this.img.data.buffer);
    this.gw = Math.ceil(w / 4); this.gh = Math.ceil(h / 4);
    this.gv = mk(this.gw, this.gh); this.gx = this.gv.getContext('2d'); this.gimg = this.gx.createImageData(this.gw, this.gh);
    this.gpix = new Uint32Array(this.gimg.data.buffer); this.heat = new Float32Array(this.gw * this.gh);
  }
  rb() { let s = this.s; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (this.s = s >>> 0); }
  rnd() { return this.rb() / 4294967296; }
  rgb(t, col) { return col ? (typeof col === 'string' ? rgbOf(col) : col) : MAT_RGB[t] || [200, 200, 200]; }
  // the packed colour and starting life of a fresh cell
  paint(t, rgb) {
    if (t === WATER) return WATER_C[4 + (this.rb() & 3)];
    if (t === LAVA) return LAVA_C[this.rb() & 3];
    if (t === FIRE) return FIRE_C[12 + (this.rb() & 3)];
    if (t === SMOKE) return SMOKE_C[60];
    if (t === STEAM) return STEAM_C[60];
    rgb ||= MAT_RGB[t];
    const k = 1 + (this.rnd() - 0.5) * (t === POWDER ? 0.7 : t === OIL ? 0.2 : 0.28);
    return pack(cl(rgb[0] * k), cl(rgb[1] * k), cl(rgb[2] * k), t === OIL ? 242 : 255);
  }
  life(t) { const r = this.rb(); return t === FIRE ? 14 + (r & 15) : t === SMOKE ? 45 + (r & 63) : t === STEAM ? 60 + (r & 63) : t === EMBER ? 40 + (r & 63) : 0; }

  // ------------------------------------------------ cell bookkeeping
  wake(i) {
    const w = this.w, x = i % w, y = (i - x) / w, cx = x >> 3, cy = y >> 3, cw = this.cw, n = this.nxt, b = cy * cw + cx;
    n[b] = 1;
    const lx = x & 7, ly = y & 7, dx = lx === 0 && cx > 0 ? -1 : lx === 7 && cx < cw - 1 ? 1 : 0, dy = ly === 0 && cy > 0 ? -cw : ly === 7 && cy < this.ch - 1 ? cw : 0;
    if (dx) n[b + dx] = 1;
    if (dy) { n[b + dy] = 1; if (dx) n[b + dy + dx] = 1; }
  }
  wakeCells(x0, y0, x1, y1, stir = false) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.w - 1, x1); y1 = Math.min(this.h - 1, y1);
    for (let cy = y0 >> 3; cy <= y1 >> 3; cy++) for (let cx = x0 >> 3; cx <= x1 >> 3; cx++) this.nxt[cy * this.cw + cx] = 1;
    if (stir) for (let y = y0; y <= y1; y++) for (let x = x0, i = y * this.w + x0; x <= x1; x++, i++) if (KIND[this.T[i]] === 3) this.L[i] &= 128;
  }
  // wake (and unsettle liquids) around a spot in px
  stir(x, y, r) { const cs = this.cs; this.wakeCells(Math.floor((x - r) / cs), Math.floor((y - r) / cs), Math.floor((x + r) / cs), Math.floor((y + r) / cs), true); }
  set(i, t, c, l = 0) {
    const was = this.T[i];
    if (was < 2 && t >= 2) this.count++; else if (was >= 2 && t < 2) this.count--;
    this.T[i] = t; this.C[i] = c; this.L[i] = l; this.K[i] = this.clk;
    if (HOT[t]) this.hot = 1;
    this.wake(i);
  }
  put(i, t, rgb) { this.set(i, t, this.paint(t, rgb), this.life(t)); }
  kill(i) { if (this.T[i] >= 2) this.count--; this.T[i] = 0; this.C[i] = 0; this.L[i] = 0; this.K[i] = this.clk; this.wake(i); }
  mv(i, j) {
    const T = this.T, C = this.C, L = this.L;
    let a = T[i]; T[i] = T[j]; T[j] = a; a = C[i]; C[i] = C[j]; C[j] = a; a = L[i]; L[i] = L[j]; L[j] = a;
    this.K[i] = this.K[j] = this.clk;
    this.wake(i); this.wake(j);
  }
  // can t fall into a cell holding u?
  sink(t, u) { const k = KIND[u]; return u === EMPTY || k === 4 || k === 5 || (k === 3 && DENS[u] < DENS[t] && (this.rb() & 3) === 0); }
  flow(t, u) { const k = KIND[u]; return u === EMPTY || k === 4 || (k === 3 && DENS[u] < DENS[t] && (this.rb() & 7) === 0); }
  nb(i, x, y, k) { return k === 0 ? (x > 0 ? i - 1 : -1) : k === 1 ? (x < this.w - 1 ? i + 1 : -1) : k === 2 ? (y > 0 ? i - this.w : -1) : y < this.h - 1 ? i + this.w : -1; }

  // ------------------------------------------------ stepping
  step(dt) {
    this.acc += dt;
    const k = 1 / this.rate;
    for (let n = 0; this.acc >= k && n < 3; n++) { this.acc -= k; this.tick(); }
    if (this.acc > k) this.acc = 0;
    if (this.np) this.stepP(dt);
  }
  tick() {
    const tmp = this.act; this.act = this.nxt; this.nxt = tmp; tmp.fill(0);
    const clk = (this.clk = this.clk >= 255 ? 1 : this.clk + 1), { w, h, cw, act, T, K } = this, flip = clk & 1;
    this.booms = 0;
    for (let y = h - 1; y >= 0; y--) {
      const row = (y >> 3) * cw, base = y * w;
      for (let q = 0; q < cw; q++) {
        const cx = flip ? q : cw - 1 - q;
        if (!act[row + cx]) continue;
        const x0 = cx << 3, x1 = Math.min(w, x0 + 8);
        if (flip) { for (let x = x0; x < x1; x++) { const i = base + x, t = T[i]; if (t > 1 && K[i] !== clk) this.upd(i, x, y, t); } }
        else for (let x = x1 - 1; x >= x0; x--) { const i = base + x, t = T[i]; if (t > 1 && K[i] !== clk) this.upd(i, x, y, t); }
      }
    }
  }
  upd(i, x, y, t) { const k = KIND[t]; if (k === 2) this.powder(i, x, y, t); else if (k === 3) this.liquid(i, x, y, t); else if (k === 4) this.gas(i, x, y, t); else this.fire(i, x, y); }
  bottom(i, x) {
    const f = this.floor;
    if (f === 'solid' || (f !== 'open' && this.rnd() >= f)) return false;
    this.drain[x]++; this.kill(i); return true;
  }
  powder(i, x, y, t) {
    const T = this.T, L = this.L, w = this.w, h = this.h;
    if (t === EMBER && this.ember(i, x, y)) return;
    if (y >= h - 1) { this.bottom(i, x); return; }
    const j = i + w;
    if (this.sink(t, T[j])) { // free fall picks up speed, up to four cells a tick
      const v = t === EMBER ? 0 : Math.min(6, L[i] + 1);
      let k = i, yy = y;
      for (let s = 1 + (v >> 1); s > 0 && yy < h - 1 && this.sink(t, T[k + w]); s--, yy++) { this.mv(k, k + w); k += w; }
      if (t !== EMBER) L[k] = v;
      return;
    }
    if (t !== EMBER) L[i] = 0;
    const d = this.rb() & 1 ? 1 : -1;
    if (x + d >= 0 && x + d < w && this.sink(t, T[j + d]) && T[i + d] !== WALL) this.mv(i, j + d);
    else if (x - d >= 0 && x - d < w && this.sink(t, T[j - d]) && T[i - d] !== WALL) this.mv(i, j - d);
  }
  liquid(i, x, y, t) {
    const T = this.T, L = this.L, C = this.C, w = this.w, h = this.h;
    if (t === LAVA) { if (this.lava(i, x, y)) return; if (this.rb() & 1) { this.wake(i); return; } } // thick: half speed
    if (y < h - 1) {
      const j = i + w;
      if (this.sink(t, T[j])) {
        let k = i, yy = y;
        for (let s = 2; s > 0 && yy < h - 1 && this.sink(t, T[k + w]); s--, yy++) { this.mv(k, k + w); k += w; }
        L[k] &= 128; if (t === WATER) C[k] = WATER_C[this.rb() & 3];
        return;
      }
      const d = L[i] & 128 ? 1 : -1;
      if (x + d >= 0 && x + d < w && this.sink(t, T[j + d])) { this.mv(i, j + d); return; }
      if (x - d >= 0 && x - d < w && this.sink(t, T[j - d])) { this.mv(i, j - d); return; }
    } else if (this.bottom(i, x)) return;
    // spread sideways; a liquid that has sloshed back and forth long enough settles until disturbed
    const n = L[i] & 127, d = L[i] & 128 ? 1 : -1;
    if (n > 60) return;
    const disp = t === WATER ? 4 : t === OIL ? 2 : 1;
    let k = 0;
    for (let s = 1; s <= disp; s++) { const xx = x + d * s; if (xx < 0 || xx >= w || !this.flow(t, T[i + d * s])) break; k = s; }
    if (k) { const m = i + d * k; this.mv(i, m); L[m] = (d > 0 ? 128 : 0) | (n + 1); if (t === WATER) C[m] = WATER_C[4 + (this.rb() & 3)]; }
    else { L[i] = (d > 0 ? 0 : 128) | (n + 1); if (t === WATER && n > 50) C[i] = WATER_C[8 + (this.rb() & 3)]; this.wake(i); }
  }
  gas(i, x, y, t) {
    const T = this.T, L = this.L, w = this.w, l = L[i] - 1;
    if (l <= 0 || y === 0) { this.kill(i); return; }
    L[i] = l; this.C[i] = (t === SMOKE ? SMOKE_C : STEAM_C)[l];
    if (t === STEAM && y < this.h * 0.18 && (this.rb() & 255) === 0) { this.set(i, WATER, WATER_C[this.rb() & 3]); return; } // condenses into rain
    const j = i - w, d = this.rb() & 1 ? 1 : -1, r = this.rb() & 7;
    if (r < 6 && this.rise(T[j])) { this.mv(i, j); return; }
    if (x + d >= 0 && x + d < w) { if (this.rise(T[j + d])) { this.mv(i, j + d); return; } if (r === 7 && T[i + d] === EMPTY) { this.mv(i, i + d); return; } }
    this.wake(i);
  }
  rise(u) { return u === EMPTY || (KIND[u] === 3 && (this.rb() & 7) === 0); }
  fire(i, x, y) {
    const T = this.T, L = this.L, w = this.w, l = L[i] - 1;
    if (l <= 0) { if (this.rb() & 1) this.set(i, SMOKE, SMOKE_C[50], this.life(SMOKE)); else this.kill(i); return; }
    L[i] = l; this.C[i] = FIRE_C[((l > 24 ? 3 : l > 12 ? 2 : l > 5 ? 1 : 0) << 2) | (this.rb() & 3)]; this.K[i] = this.clk; this.wake(i);
    for (let k = 0; k < 4; k++) { const n = this.nb(i, x, y, k); if (n >= 0 && this.touch(n, i)) return; }
    if (y > 0 && (this.rb() & 3) === 0) { const xx = x + (this.rb() % 3) - 1; if (xx >= 0 && xx < w && T[i - w - x + xx] === EMPTY) this.mv(i, i - w - x + xx); } // flames lick upward
  }
  // fire at i reaches cell n: fuel catches, water puts it out (true)
  touch(n, i) {
    const u = this.T[n];
    if (u === POWDER) this.ignite(n);
    else if (u === OIL) { if ((this.rb() & 7) === 0) this.ignite(n); }
    else if (u === WATER) { this.set(i, STEAM, STEAM_C[60], this.life(STEAM)); if (this.rb() & 1) this.set(n, STEAM, STEAM_C[60], this.life(STEAM)); return true; }
    return false;
  }
  ignite(i) {
    const t = this.T[i];
    if (t === POWDER) {
      this.set(i, FIRE, FIRE_C[15], 8 + (this.rb() & 7));
      if (this.booms < 4 && (this.rb() & 7) === 0) { // gunpowder goes off in pops that fling what is around them
        this.booms++;
        const x = i % this.w, y = (i - x) / this.w;
        this.blast((x + 0.5) * this.cs, (y + 0.5) * this.cs, 9 + (this.rb() & 7), { power: 260, ev: true });
      }
    } else if (t === OIL) this.set(i, FIRE, FIRE_C[15], 70 + (this.rb() & 63));
    else if (t !== WALL && KIND[t] !== 3) this.set(i, FIRE, FIRE_C[15], 10 + (this.rb() & 15));
  }
  lava(i, x, y) {
    for (let k = 0; k < 4; k++) {
      const n = this.nb(i, x, y, k);
      if (n < 0) continue;
      const u = this.T[n];
      if (u === WATER) { this.set(i, STONE, this.paint(STONE)); this.set(n, STEAM, STEAM_C[60], this.life(STEAM)); return true; }
      if (u === POWDER || u === OIL) this.ignite(n);
    }
    if ((this.rb() & 7) === 0) this.C[i] = LAVA_C[this.rb() & 3];
    return false;
  }
  ember(i, x, y) {
    const l = this.L[i] - 1;
    if (l <= 0) { if (this.rb() & 3) this.kill(i); else this.set(i, STONE, this.paint(STONE)); return true; }
    this.L[i] = l; this.wake(i);
    if ((this.rb() & 3) === 0) this.C[i] = FIRE_C[((l >> 4) & 3) * 4 + (this.rb() & 3)];
    for (let k = 0; k < 4; k++) {
      const n = this.nb(i, x, y, k);
      if (n < 0) continue;
      const u = this.T[n];
      if (u === POWDER || u === OIL) this.ignite(n);
      else if (u === WATER) { this.set(i, STONE, this.paint(STONE)); this.set(n, STEAM, STEAM_C[60], this.life(STEAM)); return true; }
    }
    return false;
  }

  // ------------------------------------------------ flying grains
  emit(x, y, vx, vy, t, col, life = 6) {
    if (this.np >= this.pmax || (KIND[t] < 4 && t !== SPARK && this.count + this.np > this.cap)) return false;
    const k = this.np++;
    this.px[k] = x; this.py[k] = y; this.pvx[k] = vx; this.pvy[k] = vy; this.pt[k] = t; this.pc[k] = col; this.pl[k] = life;
    if (HOT[t]) this.hot = 1;
    return true;
  }
  stepP(dt) {
    const { cs, w, h, T } = this, gy = 620 * this.g * dt;
    let k = 0;
    while (k < this.np) {
      const t = this.pt[k], kd = KIND[t];
      let vx = this.pvx[k], vy = this.pvy[k];
      if (t === SPARK) { vy += gy * 0.45; vx *= 0.99; } else if (kd === 4) { vy -= gy * 0.2; vx *= 0.96; vy *= 0.96; } else vy += gy;
      const x0 = this.px[k], y0 = this.py[k], x1 = x0 + vx * dt, y1 = y0 + vy * dt, life = this.pl[k] - dt;
      let fate = life <= 0 ? 1 : 0, lx = Math.floor(x0 / cs), ly = Math.floor(y0 / cs), hx = 0, hy = 0;
      if (!fate) {
        const ax = x0 / cs, ay = y0 / cs, bx = x1 / cs, by = y1 / cs, ns = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
        for (let s = 1; s <= ns; s++) {
          const cx = Math.floor(ax + ((bx - ax) * s) / ns), cy = Math.floor(ay + ((by - ay) * s) / ns);
          if (cx < 0 || cx >= w) { vx = -vx * 0.5; fate = 3; break; }
          if (cy >= h) { fate = 2; break; }
          if (cy >= 0) { const u = T[cy * w + cx]; if (u !== EMPTY && KIND[u] < 4) { fate = 4; hx = cx; hy = cy; break; } }
          lx = cx; ly = cy;
        }
      }
      if (fate === 0 || fate === 3) {
        if (fate === 0) { this.px[k] = x1; this.py[k] = y1; }
        this.pvx[k] = vx; this.pvy[k] = vy; this.pl[k] = life; k++;
        continue;
      }
      if (t === SPARK) { // sparks light what they land on, sometimes leave an ember
        if (fate === 4) { const j = hy * w + hx, u = T[j]; if (u === POWDER || u === OIL) this.ignite(j); else if ((this.rb() & 7) === 0 && ly >= 0 && T[ly * w + lx] === EMPTY) this.set(ly * w + lx, EMBER, FIRE_C[8], 20 + (this.rb() & 31)); }
      } else if (fate === 2) { if (this.floor === 'open') this.drain[Math.max(0, Math.min(w - 1, lx))]++; else this.deposit(lx, h - 1, t, this.pc[k]); }
      else if (fate === 4 || kd !== 4) this.deposit(lx, ly, t, this.pc[k]);
      const m = --this.np;
      if (k < m) { this.px[k] = this.px[m]; this.py[k] = this.py[m]; this.pvx[k] = this.pvx[m]; this.pvy[k] = this.pvy[m]; this.pt[k] = this.pt[m]; this.pc[k] = this.pc[m]; this.pl[k] = this.pl[m]; }
    }
  }
  deposit(x, y, t, c) {
    const { w, T } = this;
    if (x < 0 || x >= w || y >= this.h) return;
    for (let n = 0; n < 6 && y >= 0; n++, y--) {
      const i = y * w + x;
      if (T[i] === EMPTY || KIND[T[i]] === 4) { if (T[i]) this.kill(i); this.set(i, t, c, this.life(t)); if (KIND[t] === 3) this.stir(x * this.cs, y * this.cs, 4); return; }
    }
  }

  // ------------------------------------------------ what games call
  each(x, y, r, f) {
    const cs = this.cs, cx = x / cs, cy = y / cs, cr = r / cs, r2 = cr * cr;
    const x0 = Math.max(0, Math.floor(cx - cr)), x1 = Math.min(this.w - 1, Math.floor(cx + cr)), y0 = Math.max(0, Math.floor(cy - cr)), y1 = Math.min(this.h - 1, Math.floor(cy + cr));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy; if (dx * dx + dy * dy <= r2) f(yy * this.w + xx, xx, yy, dx, dy); }
  }
  at(x, y) { const xx = Math.floor(x / this.cs), yy = Math.floor(y / this.cs); return xx < 0 || yy < 0 || xx >= this.w || yy >= this.h ? EMPTY : this.T[yy * this.w + xx]; }
  // stamp (or remove) solid cells: pegs, ledges, bucket walls. Material in the way is shoved up or lost.
  wall(i, on) {
    const T = this.T;
    if (!on) { if (T[i] === WALL) { T[i] = EMPTY; this.C[i] = 0; this.wake(i); } return; }
    if (T[i] >= 2) { for (let j = i - this.w, n = 0; j >= 0 && n < 6; j -= this.w, n++) if (T[j] === EMPTY) { this.mv(i, j); break; } if (T[i] >= 2) this.kill(i); }
    T[i] = WALL; this.C[i] = 0;
  }
  solid(x, y, r, on = true) { this.each(x, y, r + this.cs * 0.4, (i) => this.wall(i, on)); this.stir(x, y, r + 6); }
  solidRect(x, y, w, h, on = true) {
    const cs = this.cs, x0 = Math.max(0, Math.floor(x / cs)), x1 = Math.min(this.w - 1, Math.floor((x + w - 0.01) / cs)), y0 = Math.max(0, Math.floor(y / cs)), y1 = Math.min(this.h - 1, Math.floor((y + h - 0.01) / cs));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) this.wall(yy * this.w + xx, on);
    this.wakeCells(x0 - 1, y0 - 1, x1 + 1, y1 + 1, true);
  }
  solidSeg(ax, ay, bx, by, r, on = true) {
    const cs = this.cs, ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1, rr = (r + cs * 0.4) ** 2;
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - r) / cs) - 1), x1 = Math.min(this.w - 1, Math.floor((Math.max(ax, bx) + r) / cs) + 1);
    const y0 = Math.max(0, Math.floor((Math.min(ay, by) - r) / cs) - 1), y1 = Math.min(this.h - 1, Math.floor((Math.max(ay, by) + r) / cs) + 1);
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const px = (xx + 0.5) * cs, py = (yy + 0.5) * cs, t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / l2)), dx = px - ax - ex * t, dy = py - ay - ey * t;
      if (dx * dx + dy * dy <= rr) this.wall(yy * this.w + xx, on);
    }
    this.wakeCells(x0 - 1, y0 - 1, x1 + 1, y1 + 1, true);
  }
  // a solid disc turns into material where it stood (a peg crumbling into sand)
  crumble(x, y, r, t, col, fill = 1) {
    const rgb = this.rgb(t, col);
    this.each(x, y, r + this.cs * 0.4, (i) => { if (this.T[i] <= WALL) { if (this.rnd() < fill) this.put(i, t, rgb); else if (this.T[i] === WALL) { this.T[i] = EMPTY; this.wake(i); } } });
    this.stir(x, y, r + 6);
  }
  pour(x, y, r, t, n, col) {
    const rgb = this.rgb(t, col);
    for (let k = 0; k < n * 2 && n > 0; k++) {
      if (KIND[t] < 4 && this.count > this.cap) return;
      const a = this.rnd() * 6.2832, d = Math.sqrt(this.rnd()) * r, xx = Math.floor((x + Math.cos(a) * d) / this.cs), yy = Math.floor((y + Math.sin(a) * d) / this.cs);
      if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
      const i = yy * this.w + xx;
      if (this.T[i] === EMPTY) { this.put(i, t, rgb); n--; }
    }
  }
  spray(x, y, n, t, col, sp = 160, vx = 0, vy = 0, life = 6) {
    const rgb = this.rgb(t, col);
    for (let k = 0; k < n; k++) {
      const a = this.rnd() * 6.2832, s = sp * (0.2 + this.rnd() * 0.8);
      if (!this.emit(x + (this.rnd() - 0.5) * 6, y + (this.rnd() - 0.5) * 6, vx + Math.cos(a) * s, vy + Math.sin(a) * s, t, t === SPARK ? pack(255, 200 + (this.rb() & 55), 120 + (this.rb() & 100)) : this.paint(t, rgb), t === SPARK ? 0.25 + this.rnd() * 0.5 : life)) return;
    }
  }
  // explosion: flings loose material outward, lights fuel, leaves fire and smoke. `ev` reports it in `events`.
  blast(x, y, r, o = {}) {
    const { cs, T } = this, pw = o.power ?? 340, fire = o.fire ?? true;
    if (o.ev) this.events.push({ x, y, r });
    this.each(x, y, r, (i, xx, yy, dx, dy) => {
      const t = T[i];
      if (t === WALL) return;
      const d = Math.hypot(dx, dy), f = 1 - (d * cs) / r;
      if (t === EMPTY) { if (fire && f > 0.5 && this.rb() & 1) this.put(i, FIRE); else if (f > 0.15 && (this.rb() & 7) === 0) this.put(i, SMOKE); return; }
      if (t === POWDER || (fire && t === OIL)) { this.ignite(i); return; }
      if (KIND[t] >= 4) return;
      const s = (pw * (0.3 + f) * (0.6 + this.rnd() * 0.7)) / (d || 1);
      if (this.emit((xx + 0.5) * cs, (yy + 0.5) * cs, dx * s, dy * s - pw * 0.3 * f, t, this.C[i], 6)) this.kill(i);
    });
    this.stir(x, y, r + 6);
  }
  // a ball of radius r moving at (vx, vy) shoves material aside or throws it; returns the mass it met.
  // `met[type]` counts what was inside (fire, lava and water included) for the game to react to.
  plow(x, y, r, vx, vy) {
    const met = this.met; met.fill(0);
    if (!this.count) return 0;
    const { cs, w, h, T } = this, cx = x / cs, cy = y / cs, cr = r / cs + 0.3, r2 = cr * cr;
    const x0 = Math.max(0, Math.floor(cx - cr)), x1 = Math.min(w - 1, Math.floor(cx + cr)), y0 = Math.max(0, Math.floor(cy - cr)), y1 = Math.min(h - 1, Math.floor(cy + cr));
    if (x0 > x1 || y0 > y1) return 0;
    const sp = Math.hypot(vx, vy), fling = sp > 70;
    let m = 0;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const i = yy * w + xx, t = T[i];
      if (t < 2) continue;
      const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy, d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      met[t]++;
      if (KIND[t] >= 4) continue;
      m += MASS[t];
      const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
      if (fling && this.rb() & 1 && this.emit((xx + 0.5) * cs, (yy + 0.5) * cs, vx * 0.5 + nx * sp * 0.35 + (this.rnd() - 0.5) * 40, vy * 0.4 + ny * sp * 0.3 - 40, t, this.C[i], 5)) { this.kill(i); continue; }
      const tx = Math.floor(cx + nx * (cr + 0.8)), ty = Math.floor(cy + ny * (cr + 0.8));
      if (tx >= 0 && tx < w && ty >= 0 && ty < h && T[ty * w + tx] === EMPTY) this.mv(i, ty * w + tx);
    }
    if (m) this.wakeCells(x0 - 1, y0 - 1, x1 + 1, y1 + 1, true);
    return m;
  }
  // slide everything in a rect (px) one cell sideways: a moving bucket carries its sand
  shift(x, y, wd, ht, dir) {
    const { cs, w, T, C, L } = this, x0 = Math.max(0, Math.floor(x / cs)), x1 = Math.min(w - 1, Math.floor((x + wd) / cs)), y0 = Math.max(0, Math.floor(y / cs)), y1 = Math.min(this.h - 1, Math.floor((y + ht) / cs));
    const cp = (i, j) => { T[j] = T[i]; C[j] = C[i]; L[j] = L[i]; };
    for (let yy = y0; yy <= y1; yy++) {
      const b = yy * w, lead = dir > 0 ? x1 + 1 : x0 - 1;
      if (lead < 0 || lead >= w) continue;
      if (T[b + lead] >= 2) { if (KIND[T[b + lead]] < 4) this.emit((lead + 0.5) * cs, (yy - 0.5) * cs, dir * 40, -90, T[b + lead], C[b + lead]); this.kill(b + lead); }
      if (dir > 0) for (let xx = x1; xx >= x0; xx--) cp(b + xx, b + xx + 1);
      else for (let xx = x0; xx <= x1; xx++) cp(b + xx, b + xx - 1);
      const tail = b + (dir > 0 ? x0 : x1); T[tail] = 0; C[tail] = 0; L[tail] = 0;
    }
    this.wakeCells(x0 - 2, y0 - 2, x1 + 2, y1 + 1);
  }
  // material cells in a rect (px)
  amount(x, y, wd, ht, t = 0) {
    const cs = this.cs, x0 = Math.max(0, Math.floor(x / cs)), x1 = Math.min(this.w - 1, Math.floor((x + wd) / cs)), y0 = Math.max(0, Math.floor(y / cs)), y1 = Math.min(this.h - 1, Math.floor((y + ht) / cs));
    let n = 0;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0, i = yy * this.w + x0; xx <= x1; xx++, i++) { const u = this.T[i]; if (t ? u === t : u >= 2 && KIND[u] < 4) n++; }
    return n;
  }
  // a solid rect (px) turns into material: a brick crumbling (over = false only fills empty cells: a heap)
  crumbleRect(x, y, wd, ht, t, col, over = true) {
    const cs = this.cs, rgb = this.rgb(t, col), x0 = Math.max(0, Math.floor(x / cs)), x1 = Math.min(this.w - 1, Math.floor((x + wd - 0.01) / cs)), y0 = Math.max(0, Math.floor(y / cs)), y1 = Math.min(this.h - 1, Math.floor((y + ht - 0.01) / cs));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const i = yy * this.w + xx; if (this.T[i] === EMPTY || (over && this.T[i] === WALL)) this.put(i, t, rgb); }
    this.wakeCells(x0 - 1, y0 - 1, x1 + 1, y1 + 1, true);
  }
  settle(n = 60) { for (let k = 0; k < n; k++) this.tick(); }
  // remove all material (and with `all` the solid stamps too)
  clear(all = false) {
    const T = this.T;
    for (let i = 0; i < T.length; i++) if (all || T[i] >= 2) { T[i] = 0; this.C[i] = 0; this.L[i] = 0; }
    this.count = 0; this.np = 0; this.events.length = 0; this.drain.fill(0); this.hot = 0;
  }

  // ------------------------------------------------ drawing
  draw(c, alpha = 1) {
    if (!this.count && !this.np) return;
    const { cs, w, h, pix } = this;
    pix.set(this.C);
    for (let k = 0; k < this.np; k++) { const x = Math.floor(this.px[k] / cs), y = Math.floor(this.py[k] / cs); if (x >= 0 && y >= 0 && x < w && y < h) pix[y * w + x] = this.pc[k]; }
    this.cx.putImageData(this.img, 0, 0);
    const sm = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false; c.globalAlpha = alpha;
    c.drawImage(this.cv, 0, 0, w * cs, h * cs);
    c.imageSmoothingEnabled = sm; c.globalAlpha = 1;
    if (this.hot) this.glow(c);
  }
  // fire, lava, embers and sparks glow: heat summed on a quarter-resolution grid, blurred, added on top
  glow(c) {
    const { w, h, T, heat, gw, gh, gpix, cs } = this;
    heat.fill(0);
    let any = 0;
    for (let y = 0; y < h; y++) { const gy = (y >> 2) * gw, b = y * w; for (let x = 0; x < w; x++) { const t = T[b + x]; if (t >= 5 && HOT[t]) { heat[gy + (x >> 2)] += t === FIRE ? 0.08 : 0.06; any = 1; } } }
    for (let k = 0; k < this.np; k++) if (HOT[this.pt[k]]) { const x = Math.floor(this.px[k] / cs) >> 2, y = Math.floor(this.py[k] / cs) >> 2; if (x >= 0 && y >= 0 && x < gw && y < gh) { heat[y * gw + x] += 0.1; any = 1; } }
    if (!any) { this.hot = 0; return; }
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      let s = heat[y * gw + x] * 2;
      if (x > 0) s += heat[y * gw + x - 1]; if (x < gw - 1) s += heat[y * gw + x + 1]; if (y > 0) s += heat[(y - 1) * gw + x]; if (y < gh - 1) s += heat[(y + 1) * gw + x];
      const v = Math.min(1, s / 4);
      gpix[y * gw + x] = pack(255 * v, 120 * v, 30 * v, 255 * v);
    }
    this.gx.putImageData(this.gimg, 0, 0);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.75;
    c.drawImage(this.gv, 0, 0, gw * 4 * cs, gh * 4 * cs);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- effects kit
const glows = new Map();
// soft round light of a colour, for additive halos
export function glowSprite(col) {
  let g = glows.get(col);
  if (g) return g;
  g = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
  const x = g.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalAlpha = 0.9; x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  glows.set(col, g);
  return g;
}
const COMIC_FONT = '900 SIZEpx Impact, "Anton", "Arial Black", system-ui, sans-serif';

export class Fx {
  constructor(rng = Math.random) { this.rng = rng; this.ps = []; this.rings = []; this.pops = []; this.ban = null; this.shk = 0; this.fl = 0; this.flc = '#fff'; this.ox = 0; this.oy = 0; this.cap = 520; }
  r(a, b) { return a + this.rng() * (b - a); }
  // k: 0 confetti, 1 spark, 2 shard, 3 star, 4 puff, 5 flung sprite
  burst(k, x, y, n, cols, sp, o = {}) {
    cols = Array.isArray(cols) ? cols : [cols];
    for (let i = 0; i < n && this.ps.length < this.cap; i++) {
      const a = o.dir != null ? o.dir + this.r(-o.cone, o.cone) : this.r(0, 6.2832), s = sp * this.r(0.25, 1), l1 = o.l1 || 1;
      this.ps.push({ k, x: x + this.r(-3, 3), y: y + this.r(-3, 3), vx: Math.cos(a) * s + (o.vx || 0), vy: Math.sin(a) * s - (o.up || 0) + (o.vy || 0), a: this.r(0, 6.28), va: this.r(-10, 10), sz: this.r(o.min || 2, o.max || 4.5), c: cols[Math.floor((i * cols.length) / n)], life: this.r(o.l0 || 0.5, l1), max: l1, ph: this.r(0, 6.28) });
    }
  }
  confetti(x, y, n, cols, sp = 230, up = 90) { this.burst(0, x, y, n, cols, sp, { up, l0: 1.4, l1: 2.8, min: 2.5, max: 4.5 }); }
  sparks(x, y, n, c, sp = 340, o = {}) { this.burst(1, x, y, n, c, sp, { l0: 0.25, l1: 0.7, ...o }); }
  shards(x, y, n, c, sp = 220) { this.burst(2, x, y, n, c, sp, { up: 60, l0: 0.6, l1: 1.3, min: 2, max: 5 }); }
  stars(x, y, n, c, sp = 170) { this.burst(3, x, y, n, c, sp, { up: 50, l0: 0.5, l1: 1.1, min: 3, max: 6.5 }); }
  puffs(x, y, n, c = '#d8d4dc', sp = 50, sz = 1) { this.burst(4, x, y, n, c, sp, { up: 20, l0: 0.5, l1: 1.1, min: 5 * sz, max: 11 * sz }); }
  fling(img, x, y, vx, vy, s = 22) { if (img) this.ps.push({ k: 5, img, x, y, vx, vy, a: 0, va: this.r(-12, 12), sz: s, life: 1.5, max: 1.5 }); }
  ring(x, y, r, c, life = 0.4, lw = 3) { if (this.rings.length < 40) this.rings.push({ x, y, r, c, life, max: life, lw }); }
  pop(x, y, s, c = '#fff', size = 13, comic = false) { if (this.pops.length < 24) this.pops.push({ x, y, s, c, size, comic, life: comic ? 0.95 : 0.85, max: comic ? 0.95 : 0.85, rot: comic ? this.r(-0.22, 0.22) : 0 }); }
  banner(s, sub = '', c = '#ffe14d', life = 1.6) { this.ban = { s, sub, c, life, max: life }; }
  shake(a) { this.shk = Math.min(18, this.shk + a); }
  flash(c, a = 0.4) { this.flc = c; this.fl = Math.max(this.fl, a); }
  step(dt, g = 1) {
    const ps = this.ps;
    let n = 0;
    for (const p of ps) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.k === 0) { const d = 1 - 2.4 * dt; p.vx *= d; p.vy = p.vy * d + 240 * g * dt; p.ph += dt * 9; p.x += Math.sin(p.ph * 0.7) * 16 * dt; }
      else if (p.k === 1) { const d = 1 - 1.4 * dt; p.vx *= d; p.vy = p.vy * d + 300 * g * dt; }
      else if (p.k === 4) { const d = 1 - 2 * dt; p.vx *= d; p.vy = p.vy * d - 16 * dt; p.sz += 9 * dt; }
      else p.vy += 420 * g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      ps[n++] = p;
    }
    ps.length = n;
    n = 0; for (const r of this.rings) if ((r.life -= dt) > 0) this.rings[n++] = r; this.rings.length = n;
    n = 0; for (const p of this.pops) if ((p.life -= dt) > 0) { p.y -= (p.comic ? 10 : 26) * dt; this.pops[n++] = p; } this.pops.length = n;
    if (this.ban && (this.ban.life -= dt) <= 0) this.ban = null;
    this.shk *= Math.exp(-7 * dt); this.fl *= Math.exp(-5 * dt);
    this.ox = (this.rng() - 0.5) * 2 * this.shk; this.oy = (this.rng() - 0.5) * 2 * this.shk;
  }
  draw(c) {
    const ps = this.ps;
    for (const p of ps) if (p.k === 4) { c.globalAlpha = Math.max(0, p.life / p.max) * 0.45; c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.sz, 0, 6.2832); c.fill(); }
    c.globalAlpha = 1;
    // confetti, shards and stars: one path per colour run
    for (let k = 0; k <= 3; k += k === 0 ? 2 : 1) {
      let cur = null;
      for (const p of ps) {
        if (p.k !== k) continue;
        if (p.c !== cur) { if (cur) c.fill(); c.fillStyle = cur = p.c; c.beginPath(); }
        const s = p.sz * Math.min(1, p.life * 2.5), ca = Math.cos(p.a), sa = Math.sin(p.a);
        if (k === 0) { const fw = s * Math.cos(p.ph), fh = s * 0.55; c.moveTo(p.x + ca * fw - sa * fh, p.y + sa * fw + ca * fh); c.lineTo(p.x - ca * fw - sa * fh, p.y - sa * fw + ca * fh); c.lineTo(p.x - ca * fw + sa * fh, p.y - sa * fw - ca * fh); c.lineTo(p.x + ca * fw + sa * fh, p.y + sa * fw - ca * fh); c.closePath(); }
        else if (k === 2) { c.moveTo(p.x + ca * s, p.y + sa * s); c.lineTo(p.x - ca * s * 0.6 - sa * s * 0.7, p.y - sa * s * 0.6 + ca * s * 0.7); c.lineTo(p.x - ca * s * 0.4 + sa * s * 0.8, p.y - sa * s * 0.4 - ca * s * 0.8); c.closePath(); }
        else { for (let j = 0; j < 10; j++) { const a = p.a + (j * Math.PI) / 5, rr = j & 1 ? s * 0.45 : s; if (j) c.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); else c.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); } c.closePath(); }
      }
      if (cur) c.fill();
    }
    let cur = null;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineWidth = 1.8;
    for (const p of ps) if (p.k === 1) { if (p.c !== cur) { if (cur) c.stroke(); c.strokeStyle = cur = p.c; c.beginPath(); } c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); }
    if (cur) c.stroke();
    c.globalCompositeOperation = 'source-over';
    for (const p of ps) if (p.k === 5) { c.globalAlpha = Math.min(1, p.life * 1.5); drawFit(c, p.img, p.x, p.y, p.sz, p.sz, p.a); }
    for (const r of this.rings) { const f = r.life / r.max; c.globalAlpha = f; c.strokeStyle = r.c; c.lineWidth = r.lw * f + 0.5; c.beginPath(); c.arc(r.x, r.y, r.r * (1.15 - f) + 2, 0, 6.2832); c.stroke(); }
    c.globalAlpha = 1;
    for (const p of this.pops) {
      const f = p.life / p.max, sc = p.comic ? 0.55 + Math.min(1, (1 - f) * 9) * 0.5 : 1;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(sc, sc); c.globalAlpha = Math.min(1, f * 3);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      if (p.comic) {
        const R = p.size * 1.7;
        c.beginPath(); for (let j = 0; j < 22; j++) { const a = (j * Math.PI) / 11, rr = j & 1 ? R * 0.62 : R; c[j ? 'lineTo' : 'moveTo'](Math.cos(a) * rr * 1.25, Math.sin(a) * rr * 0.85); } c.closePath();
        c.fillStyle = p.c; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#1b1012'; c.stroke();
        c.font = COMIC_FONT.replace('SIZE', p.size); c.fillStyle = '#1b1012'; c.fillText(p.s, 0, 1);
      } else {
        c.font = `800 ${p.size}px ui-monospace, monospace`; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(p.s, 0, 0); c.fillStyle = p.c; c.fillText(p.s, 0, 0);
      }
      c.restore();
    }
  }
  // screen-space: flash and banner
  over(c) {
    if (this.fl > 0.01) { c.globalAlpha = this.fl; c.fillStyle = this.flc; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    const b = this.ban;
    if (!b) return;
    const f = b.life / b.max, k = Math.min(1, (1 - f) * 7), sc = 0.4 + k * 0.6 + Math.max(0, 0.25 - (1 - f)) ;
    c.save(); c.translate(W / 2, H * 0.4); c.rotate(-0.06); c.scale(sc, sc); c.globalAlpha = Math.min(1, f * 4);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.font = COMIC_FONT.replace('SIZE', b.s.length > 9 ? 34 : 44); c.lineWidth = 8; c.strokeStyle = '#1b1012'; c.strokeText(b.s, 0, 0); c.fillStyle = b.c; c.fillText(b.s, 0, 0);
    if (b.sub) { c.font = '800 13px ui-monospace, monospace'; c.lineWidth = 4; c.strokeText(b.sub, 0, 32); c.fillStyle = '#fff'; c.fillText(b.sub, 0, 32); }
    c.restore();
  }
}

// ---------------------------------------------------------------- tracer tails
export const TAILS = ['ribbon', 'neon', 'dots', 'comet', 'rainbow'];
export class Tail {
  constructor(n = 12) { this.n = n; this.xs = new Float32Array(n); this.ys = new Float32Array(n); this.len = 0; this.h = 0; }
  push(x, y) { this.h = (this.h + 1) % this.n; this.xs[this.h] = x; this.ys[this.h] = y; if (this.len < this.n) this.len++; }
  draw(c, style, col, w, t = 0) {
    const n = this.len, N = this.n, { xs, ys } = this, at = (i) => (this.h - i + N) % N;
    if (n < 3) return;
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (style === 'dots') {
      c.fillStyle = col;
      for (let i = 1; i < n; i += 2) { const k = at(i), f = 1 - i / n; c.globalAlpha = f * 0.85; c.beginPath(); c.arc(xs[k], ys[k], w * 0.55 * f + 0.6, 0, 6.2832); c.fill(); }
      c.globalAlpha = 1; return;
    }
    if (style === 'rainbow') {
      c.lineWidth = w * 0.8;
      for (let i = 0; i < n - 1; i++) { const a = at(i), b = at(i + 1), f = 1 - i / n; c.globalAlpha = f; c.strokeStyle = `hsl(${(t * 240 + i * 28) % 360},95%,62%)`; c.lineWidth = w * (0.3 + 0.7 * f); c.beginPath(); c.moveTo(xs[a], ys[a]); c.lineTo(xs[b], ys[b]); c.stroke(); }
      c.globalAlpha = 1; return;
    }
    const add = style === 'neon' || style === 'comet';
    if (add) c.globalCompositeOperation = 'lighter';
    c.strokeStyle = col;
    const bands = 3, per = Math.ceil((n - 1) / bands);
    for (let b = 0; b < bands; b++) {
      const i0 = b * per, i1 = Math.min(n - 1, i0 + per);
      if (i0 >= i1) break;
      const f = 1 - (b + 0.4) / bands;
      c.globalAlpha = (style === 'neon' ? 0.5 : style === 'comet' ? 0.45 : 0.6) * f;
      c.lineWidth = w * (0.3 + 0.7 * f) * (style === 'neon' ? 1.7 : style === 'comet' ? 1.3 : 1);
      c.beginPath();
      for (let i = i0; i <= i1; i++) { const k = at(i); if (i === i0) c.moveTo(xs[k], ys[k]); else c.lineTo(xs[k], ys[k]); }
      c.stroke();
    }
    if (style !== 'ribbon') {
      c.globalAlpha = 0.85; c.strokeStyle = '#fff'; c.lineWidth = w * 0.28; c.beginPath();
      for (let i = 0; i < Math.min(n, 6); i++) { const k = at(i); if (i) c.lineTo(xs[k], ys[k]); else c.moveTo(xs[k], ys[k]); }
      c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
}
