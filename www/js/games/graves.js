// Merge-2 graveyard (Necromerger-ish): tap graves and crypts to raise spirits, drag two of a kind
// together to evolve them up the chain (one spirit species per chain, growing through the tiers),
// fill the customers' orders for coins and xp. Levelling up digs new generators and asks for more.
import { Game, W, H, drawFit, roundRect } from './engine.js';
import { monster } from './creature.js';
import { Actor } from '../crystal/sprites.js';
import { mulberry32 } from '../util.js';

const COLS = 6, ROWS = 6, CS = 50, X0 = (W - COLS * CS) / 2, Y0 = 114;
const CHAINS = [
  { gen: 'Grave', kind: 'grave', plan: 'guardian', names: ['Bonelet', 'Boneling', 'Skullcub', 'Ghoulcub', 'Bone Knight', 'Ossuary Lord', 'Bone Throne'] },
  { gen: 'Crypt', kind: 'crypt', plan: 'wisp', names: ['Wisp', 'Ghostlet', 'Spirit', 'Banshee', 'Wraith', 'Phantom Duke', 'The Pale Choir'] },
  { gen: 'Cauldron', kind: 'cauldron', plan: 'mochi', names: ['Toadstool', 'Eye of Newt', 'Potion', 'Elixir', 'Homunculus', 'Mandrake King', 'Philosopher Toad'] },
  { gen: 'Bat Tower', kind: 'tower', plan: 'moth', names: ['Fluff', 'Bat', 'Bat Swarm', 'Vampire Bat', 'Count', 'Night Baron', 'Eternal Sire'] }
];
const MAXT = 6, PATIENCE = 70; // seconds a customer waits before giving up
// spirit ornament tier and pixel size per merge tier: the same creature, visibly growing
const STIER = [0, 0, 1, 2, 3, 4, 4], SIZE = [15, 17, 19, 22, 25, 29, 32];
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const GOLD = '#ffd25a';
const ease = (k) => k * k * (3 - 2 * k);

export class Graves extends Game {
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'giant', 'tiny', 'trails'];
  setup() {
    const s = this.post.seed || 1, hue = this.skin.hue || 0;
    this.hues = CHAINS.map((_, k) => (hue + k * 90) % 360);
    this.art = CHAINS.map((ch, k) => ch.names.map((_, t) => monster(s * 13 + k * 7907, this.hues[k], SIZE[t], STIER[t], { plan: ch.plan })));
    this.cells = Array.from({ length: COLS * ROWS }, () => null);
    // cobwebbed cells open up when you merge next to them
    for (let i = 0; i < this.cells.length; i++) if (Math.floor(i / COLS) >= 3 && this.rng() < 0.55) this.cells[i] = { web: true };
    this.gens = 0; this.addGen(0); this.addGen(1);
    this.energy = 30; this.coins = 0; this.lvl = 1; this.xp = 0; this.need = 6; this.eT = 0;
    // customers are Crystal characters: mostly graveyard-gothic fantasy folk
    this.era = s % 4 === 3 ? 'Present day' : 'Fantasy'; this.served = 0;
    this.orders = []; for (let k = 0; k < 3; k++) this.newOrder(k);
    this.anims = []; this.drag = null; this.thinkT = 1; this.fx = []; this.barV = 0; this.bump = 0; this.reveal = null; this.msg = null;
    this.seen = new Set(CHAINS.flatMap((_, k) => [k * 10, k * 10 + 1]));
    this.pairs = new Set(); this.pairT = 0;
    this.bats = [{ x: 40, y: 18, v: 22, p: 0 }, { x: 250, y: 30, v: -16, p: 2 }];
    this.buildBG(s);
  }
  chainCol(k, l = 62) { return `hsl(${this.hues[k]},78%,${l}%)`; }
  addGen(chain) {
    const free = this.cells.map((c, i) => (!c ? i : -1)).filter((i) => i >= 0 && Math.floor(i / COLS) < 3);
    const i = free.length ? free[Math.floor(this.rng() * free.length)] : this.cells.findIndex((c) => !c);
    if (i < 0) return -1;
    this.cells[i] = { gen: chain, pulse: 0.6 }; this.gens++;
    const [x, y] = this.cellXY(i); this.ring(x, y, this.chainCol(chain), 8, 34, 0.6);
    return i;
  }
  newOrder(k) {
    const gens = [...new Set(this.cells.filter((c) => c?.gen != null).map((c) => c.gen))];
    const chain = gens[Math.floor(this.rng() * gens.length)] ?? 0;
    const tier = Math.min(MAXT, 1 + Math.floor(this.rng() * Math.min(4, 1 + this.lvl / 2)));
    const who = new Actor(this.skin.crystal(1 + this.served++, this.era, ['S']), { mode: 'four', dir: 'S' });
    who.emote('wave', 1.2); // hello
    this.orders[k] = { chain, tier, who, reward: 5 * 2 ** tier, xp: tier + 1, done: 0, left: 0, wait: 0, fidget: this.r(2, 4), slide: 0 };
  }
  cellXY(i) { return [X0 + (i % COLS) * CS + CS / 2, Y0 + Math.floor(i / COLS) * CS + CS / 2]; }
  cellAt(x, y) { const c = Math.floor((x - X0) / CS), r = Math.floor((y - Y0) / CS); return c >= 0 && c < COLS && r >= 0 && r < ROWS ? r * COLS + c : -1; }
  orderAt(x, y) { return y > 34 && y < 109 ? Math.min(2, Math.max(0, Math.floor(x / (W / 3)))) : -1; }
  orderXY(k) { return [W / 6 + k * W / 3, 61]; }
  isItem(c) { return c && c.chain != null; }
  canMerge(A, B) { return this.isItem(A) && this.isItem(B) && A.chain === B.chain && A.t === B.t && A.t < MAXT; }
  // ---------------------------------------------------------------- effects
  ring(x, y, col, r0 = 6, r1 = 30, life = 0.45) { this.fx.push({ k: 'ring', x, y, col, r0, r1, life, max: life }); }
  sparks(x, y, col, n = 10, speed = 90, size = 3) {
    for (let i = 0; i < n; i++) { const a = this.r(0, 6.283), v = this.r(speed * 0.35, speed); this.fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, col: i % 3 === 2 ? '#fff' : col, size: this.r(size * 0.6, size), life: this.r(0.4, 0.85), max: 0.85, rot: this.r(0, 3) }); }
    if (this.fx.length > 140) this.fx.splice(0, this.fx.length - 140);
  }
  float(s, x, y, col = '#fff', size = 11, life = 1) { this.fx.push({ k: 'text', s, x, y, col, size, life, max: life }); }
  coinsFly(x, y, n) { for (let i = 0; i < n; i++) this.fx.push({ k: 'coin', x0: x + this.r(-8, 8), y0: y + this.r(-6, 6), tx: 266, ty: 26, t: -i * 0.07, dur: 0.65 }); }
  // ---------------------------------------------------------------- rules
  // tapping a generator raises its first tier into the nearest empty cell
  tapGen(i) {
    const g = this.cells[i];
    if (!g || g.gen == null || this.energy < 1) { if (g?.gen != null && !this.auto) { const [x, y] = this.cellXY(i); this.float('no energy', x, y - 14, '#ff8a8a', 9, 0.9); } return false; }
    const [gx, gy] = this.cellXY(i);
    let best = -1, bd = 1e9;
    this.cells.forEach((c, j) => { if (!c) { const [x, y] = this.cellXY(j), d = Math.hypot(x - gx, y - gy); if (d < bd) { bd = d; best = j; } } });
    if (best < 0) { this.float('board full', gx, gy - 14, '#ff8a8a', 9, 0.9); return false; }
    this.energy--; g.pulse = 0.3;
    const t = this.rng() < 0.1 ? 1 : 0;
    this.cells[best] = { chain: g.gen, t, hidden: true };
    this.anims.push({ from: [gx, gy], to: best, k: 0, chain: g.gen, t, spawn: true });
    this.sparks(gx, gy - 6, this.chainCol(g.gen), 5, 50, 2.4);
    return true;
  }
  merge(a, b) {
    const A = this.cells[a], B = this.cells[b];
    if (a === b || !this.canMerge(A, B)) return false;
    this.cells[a] = null; B.t++; B.pop = 0.5;
    const [x, y] = this.cellXY(b), col = this.chainCol(B.chain), hi = B.t >= MAXT;
    this.ring(x, y, col, 8, 40, 0.5); this.ring(x, y, '#fff', 4, 26, 0.3);
    this.sparks(x, y, hi ? GOLD : col, 10 + B.t * 3, 110 + B.t * 12, 3.4);
    this.float(hi ? 'MAX EVOLVED!' : 'EVOLVED!', x, y - 26, hi ? GOLD : '#fff', 9.5, 1.1);
    this.float(CHAINS[B.chain].names[B.t], x, y - 16, col, 8, 1.1);
    this.score += 2 ** B.t;
    const key = B.chain * 10 + B.t;
    if (!this.seen.has(key)) { this.seen.add(key); if (B.t >= 2) this.reveal = { chain: B.chain, t: B.t, life: 2.6, max: 2.6 }; }
    // clear cobwebs around the merge
    const c = b % COLS, r = Math.floor(b / COLS);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = c + dx, Y = r + dy, j = Y * COLS + X; if (X >= 0 && Y >= 0 && X < COLS && Y < ROWS && this.cells[j]?.web) { this.cells[j] = null; const [wx, wy] = this.cellXY(j); this.sparks(wx, wy, '#dfe6ff', 7, 60, 2.4); this.ring(wx, wy, '#dfe6ff', 6, 24, 0.35); } }
    return true;
  }
  deliver(i, k) {
    const c = this.cells[i], o = this.orders[k];
    if (!o || o.done || o.left) return false;
    if (!this.isItem(c) || c.chain !== o.chain || c.t !== o.tier) { if (this.isItem(c)) o.who.emote('shake', 0.9); return false; } // not what they asked for
    this.cells[i] = null; o.done = 1.4;
    this.mood(o, o.tier >= 4 || o.wait < 12 ? 'love' : 'cheer', 1.4);
    this.coins += o.reward; this.xp += o.xp; this.score += o.reward * 3;
    const [ox, oy] = this.orderXY(k);
    this.sparks(ox + 18, oy - 8, GOLD, 12, 120, 3); this.ring(ox + 18, oy - 8, GOLD, 8, 34, 0.5);
    this.coinsFly(ox + 18, oy - 8, Math.min(9, 3 + o.tier));
    this.float(`+${o.reward}`, ox + 18, oy - 22, GOLD, 12, 1.1);
    if (this.xp >= this.need) {
      this.lvl++; this.xp -= this.need; this.need = Math.round(this.need * 1.4); this.energy += 15;
      const ch = Math.min(CHAINS.length - 1, this.gens), gi = this.addGen(ch);
      this.msg = { s: `LEVEL ${this.lvl}`, sub: gi >= 0 ? `new ${CHAINS[ch].gen} dug` : '+15 energy', t: 1.8, max: 1.8 };
      for (let q = 0; q < 3; q++) this.sparks(W / 2 + this.r(-60, 60), Y0 + 70, GOLD, 8, 120, 3.4);
    }
    return true;
  }
  autopilot(dt) {
    this.thinkT -= dt;
    if (this.thinkT > 0 || this.anims.length || this.drag) return;
    this.thinkT = this.r(0.35, 0.7);
    // fill an order
    for (let k = 0; k < 3; k++) { const o = this.orders[k]; if (o.done || o.left) continue; const i = this.cells.findIndex((c) => this.isItem(c) && c.chain === o.chain && c.t === o.tier); if (i >= 0) { this.slide(i, null, k); return; } }
    // merge, preferring what the orders want
    const wanted = new Set(this.orders.map((o) => o.chain));
    let pair = null;
    for (let i = 0; i < this.cells.length && !pair; i++) for (let j = i + 1; j < this.cells.length; j++) {
      const a = this.cells[i], b = this.cells[j];
      if (!this.canMerge(a, b)) continue;
      if (this.orders.some((o) => !o.done && !o.left && o.chain === a.chain && o.tier === a.t)) continue; // keep ones an order wants
      if (!pair || wanted.has(a.chain)) pair = [i, j];
      if (wanted.has(a.chain)) break;
    }
    if (pair) { this.slide(pair[0], pair[1]); return; }
    // raise something an order needs
    const gens = this.cells.map((c, i) => (c?.gen != null ? i : -1)).filter((i) => i >= 0);
    const g = gens.find((i) => wanted.has(this.cells[i].gen)) ?? gens[0];
    if (g != null && this.energy >= 1 && this.cells.some((c) => !c)) { this.tapGen(g); return; }
    // board jammed: sell the cheapest item
    if (!this.cells.some((c) => !c)) { let lo = -1; this.cells.forEach((c, i) => { if (this.isItem(c) && (lo < 0 || c.t < this.cells[lo].t)) lo = i; }); if (lo >= 0) { this.coins += 1; const [x, y] = this.cellXY(lo); this.float('+1', x, y - 10, GOLD, 9, 0.8); this.cells[lo] = null; } }
  }
  slide(from, to, order) {
    const c = this.cells[from];
    this.anims.push({ from: this.cellXY(from), to: to ?? null, order, k: 0, chain: c.chain, t: c.t, src: from, move: true });
    c.hidden = true;
  }
  down(x, y) {
    const k = this.orderAt(x, y);
    if (k >= 0) { const o = this.orders[k]; if (o.done || o.left) return; const i = this.cells.findIndex((c) => this.isItem(c) && c.chain === o.chain && c.t === o.tier); if (i >= 0) this.deliver(i, k); return; }
    const i = this.cellAt(x, y);
    if (i < 0) return;
    const c = this.cells[i];
    if (c?.gen != null) { this.tapGen(i); return; }
    if (this.isItem(c)) this.drag = { i, x, y, sx: x, sy: y };
  }
  move(x, y) { if (this.drag) { this.drag.x = x; this.drag.y = y; } }
  up(x, y) {
    const d = this.drag; this.drag = null;
    if (!d) return;
    const k = this.orderAt(x, y);
    if (k >= 0) { this.deliver(d.i, k); return; }
    const j = this.cellAt(x, y);
    if (j < 0) return;
    if (j === d.i) { // a tap: send it to a customer who wants it
      const c = this.cells[d.i], q = this.orders.findIndex((o) => !o.done && !o.left && c && o.chain === c.chain && o.tier === c.t);
      if (q >= 0 && Math.hypot(x - d.sx, y - d.sy) < 8) this.slide(d.i, null, q);
      return;
    }
    if (!this.merge(d.i, j) && !this.cells[j]) { this.cells[j] = this.cells[d.i]; this.cells[d.i] = null; this.cells[j].pop = 0.2; }
  }
  tap(x, y) { this.down(x, y); this.drag = null; }
  step(dt) {
    this.eT += dt;
    if (this.eT > 1.6) { this.eT = 0; if (this.energy < 40) this.energy++; }
    for (const a of this.anims) {
      a.k += dt / 0.28;
      if (a.k >= 1 && a.spawn && this.cells[a.to]) { this.cells[a.to].hidden = false; this.cells[a.to].pop = 0.25; }
      if (a.k >= 1 && a.move) {
        const c = this.cells[a.src];
        if (c) c.hidden = false;
        if (a.order != null) this.deliver(a.src, a.order);
        else if (a.to != null) this.merge(a.src, a.to);
      }
    }
    this.anims = this.anims.filter((a) => a.k < 1);
    for (const c of this.cells) { if (c?.pulse) c.pulse = Math.max(0, c.pulse - dt); if (c?.pop) c.pop = Math.max(0, c.pop - dt); }
    // effects
    for (const f of this.fx) {
      if (f.k === 'coin') { f.t += dt; if (f.t >= f.dur) { f.dead = true; this.bump = 0.25; this.sparks(f.tx, f.ty, GOLD, 2, 30, 1.8); } continue; }
      f.life -= dt;
      if (f.k === 'spark') { f.vy += 160 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 4; } else if (f.k === 'text') f.y -= 16 * dt;
    }
    this.fx = this.fx.filter((f) => !f.dead && (f.k === 'coin' || f.life > 0));
    this.bump = Math.max(0, this.bump - dt);
    const tv = this.xp / this.need; if (tv < this.barV - 0.2) this.barV = 0; this.barV += (tv - this.barV) * Math.min(1, dt * 6);
    if (this.reveal && (this.reveal.life -= dt) <= 0) this.reveal = null;
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    if ((this.pairT -= dt) <= 0) { // which items have a twin on the board (they glow)
      this.pairT = 0.25; this.pairs.clear();
      this.cells.forEach((a, i) => { if (!this.isItem(a) || a.hidden) return; for (let j = i + 1; j < this.cells.length; j++) if (this.canMerge(a, this.cells[j])) { this.pairs.add(i); this.pairs.add(j); } });
    }
    for (const b of this.bats) { b.x += b.v * dt; if (b.x > W + 30) b.x = -30; if (b.x < -30) b.x = W + 30; }
    this.orders.forEach((o, k) => {
      o.who.update(dt);
      o.slide = Math.min(1, o.slide + dt * 3);
      if (o.done) { if ((o.done -= dt) <= 0) this.newOrder(k); return; }
      if (o.left) { if ((o.left -= dt) <= 0) this.newOrder(k); return; }
      o.wait += dt;
      if (o.wait > PATIENCE) { o.left = 1.6; this.mood(o, 'sad', 1.6); const [ox, oy] = this.orderXY(k); this.sparks(ox, oy, '#9aa', 6, 40, 2.4); return; } // gives up and leaves
      if ((o.fidget -= dt) > 0 || o.who.a.action) return;
      // waiting: ponder, perk up when their thing is on the board, fume when kept too long
      const onBoard = this.cells.some((cl) => this.isItem(cl) && cl.chain === o.chain && cl.t === o.tier);
      const late = o.wait / PATIENCE;
      const e = late > 0.75 ? (this.rng() < 0.6 ? 'angry' : 'sad') : late > 0.5 ? (this.rng() < 0.5 ? 'angry' : 'think') : onBoard ? (this.rng() < 0.5 ? 'nod' : 'surprise') : this.rng() < 0.15 ? 'laugh' : 'think';
      o.who.emote(e, this.r(1, 2)); o.fidget = this.r(1.5, 4);
    });
  }
  // cut short whatever the customer is doing and play this emote
  mood(o, e, secs) { if (o.who.a.action) o.who.a.revive(); o.who.emote(e, secs); }

  // ---------------------------------------------------------------- scenery (drawn once)
  buildBG(seed) {
    const R = mulberry32(seed * 7 + 11), r = (a, b) => a + R() * (b - a), S = 2;
    const cv = Object.assign(document.createElement('canvas'), { width: W * S, height: H * S }), c = cv.getContext('2d');
    c.scale(S, S);
    const H0 = 232 + ((this.skin.hue || 0) % 50) - 25, hs = (dh, s, l, a = 1) => `hsla(${H0 + dh},${s}%,${l}%,${a})`;
    this.H0 = H0;
    // sky
    let g = c.createLinearGradient(0, 0, 0, 125); g.addColorStop(0, hs(0, 50, 6)); g.addColorStop(0.6, hs(10, 42, 15)); g.addColorStop(1, hs(25, 40, 24));
    c.fillStyle = g; c.fillRect(0, 0, W, 130);
    for (let i = 0; i < 70; i++) { c.globalAlpha = r(0.25, 0.85); c.fillStyle = '#e8eeff'; const s2 = r(0.4, 1.1); c.fillRect(r(0, W), r(0, 100), s2, s2); }
    c.globalAlpha = 1;
    // moon and halo
    g = c.createRadialGradient(188, 56, 4, 188, 56, 120); g.addColorStop(0, hs(-10, 60, 80, 0.38)); g.addColorStop(0.35, hs(0, 50, 60, 0.12)); g.addColorStop(1, hs(0, 50, 50, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, 130);
    g = c.createRadialGradient(182, 52, 2, 188, 56, 24); g.addColorStop(0, '#fffbea'); g.addColorStop(1, '#cfd8f0');
    c.fillStyle = g; c.beginPath(); c.arc(188, 56, 24, 0, 7); c.fill();
    c.fillStyle = 'rgba(120,130,170,.28)'; for (const [mx, my, mr] of [[180, 50, 5], [196, 62, 4], [192, 44, 3], [178, 64, 2.4]]) { c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fill(); }
    // hills
    const hill = (y0, amp, col, ph) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 130); for (let x = 0; x <= W; x += 6) c.lineTo(x, y0 + Math.sin(x * 0.02 + ph) * amp + Math.sin(x * 0.051 + ph * 2) * amp * 0.4); c.lineTo(W, 130); c.fill(); };
    hill(96, 7, hs(20, 32, 14), 1); hill(106, 6, hs(15, 30, 10), 3);
    // bare trees at the edges
    const tree = (x, dir) => {
      c.strokeStyle = hs(10, 35, 4); c.lineCap = 'round';
      const br = (x0, y0, a, len, w, d) => { if (d > 4 || len < 4) return; const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); br(x1, y1, a - r(0.3, 0.6), len * r(0.66, 0.78), w * 0.68, d + 1); br(x1, y1, a + r(0.3, 0.6), len * r(0.66, 0.78), w * 0.68, d + 1); };
      br(x, 124, -Math.PI / 2 + dir * 0.12, 30, 4, 0);
    };
    tree(14, 1); tree(348, -1);
    // ground
    g = c.createLinearGradient(0, 112, 0, H); g.addColorStop(0, hs(-5, 24, 15)); g.addColorStop(1, hs(-8, 26, 8)); c.fillStyle = g; c.fillRect(0, 112, W, H - 112);
    for (let i = 0; i < 40; i++) { c.fillStyle = `hsla(${r(95, 140)},30%,${r(14, 24)}%,${r(0.12, 0.3)})`; c.beginPath(); c.ellipse(r(0, W), r(120, H), r(8, 26), r(3, 8), 0, 0, 7); c.fill(); }
    // side margins: tombstones, crosses and lanterns catching the moon
    const stone = (x, y, kind) => {
      const w = 11 + R() * 4, h = 16 + R() * 8;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + 1, w * 0.7, 2.4, 0, 0, 7); c.fill();
      c.fillStyle = hs(8, 14, 22 + R() * 6);
      if (kind === 0) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h + w / 2); c.arc(x, y - h + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w / 2, y); c.fill(); }
      else if (kind === 1) { c.fillRect(x - 1.8, y - h, 3.6, h); c.fillRect(x - 6, y - h * 0.72, 12, 3.4); }
      else { c.beginPath(); c.moveTo(x - w / 2.4, y); c.lineTo(x - 3, y - h); c.lineTo(x + 3, y - h); c.lineTo(x + w / 2.4, y); c.fill(); }
      c.fillStyle = hs(-5, 30, 55, 0.22); c.fillRect(x - w / 2 + 1, y - h + 2, 1.3, h - 3); // moon rim
    };
    for (let i = 0; i < 6; i++) { stone(r(7, 21), 150 + i * 46 + r(-6, 6), Math.floor(r(0, 3))); stone(r(339, 353), 160 + i * 46 + r(-6, 6), Math.floor(r(0, 3))); }
    for (const lx of [10, 350]) for (const ly of [196, 336]) {
      c.fillStyle = '#1a1420'; c.fillRect(lx - 0.8, ly - 14, 1.6, 16);
      g = c.createRadialGradient(lx, ly - 16, 1, lx, ly - 16, 16); g.addColorStop(0, 'rgba(255,200,110,.7)'); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(lx - 16, ly - 32, 32, 32);
      c.fillStyle = '#ffe2a0'; c.fillRect(lx - 2, ly - 19, 4, 5);
    }
    // iron fence along the top of the yard
    c.fillStyle = hs(10, 30, 5); c.fillRect(0, 111, W, 2.4); c.fillRect(0, 119, W, 1.8);
    for (let x = 3; x < W; x += 11) { c.fillRect(x, 104, 1.8, 18); c.beginPath(); c.moveTo(x - 1.6, 105); c.lineTo(x + 0.9, 99); c.lineTo(x + 3.4, 105); c.fill(); }
    // the board: a low stone-edged plot with a soil bed per cell
    c.fillStyle = 'rgba(0,0,0,.28)'; roundRect(c, X0 - 8, Y0 - 5, COLS * CS + 16, ROWS * CS + 10, 14); c.fill();
    c.strokeStyle = hs(5, 18, 34, 0.9); c.lineWidth = 2; roundRect(c, X0 - 7, Y0 - 4, COLS * CS + 14, ROWS * CS + 8, 13); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; roundRect(c, X0 - 9, Y0 - 6, COLS * CS + 18, ROWS * CS + 12, 15); c.stroke();
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = X0 + (i % COLS) * CS + 2, y = Y0 + Math.floor(i / COLS) * CS + 2, w = CS - 4, odd = (i + Math.floor(i / COLS)) % 2;
      g = c.createLinearGradient(0, y, 0, y + w); g.addColorStop(0, hs(-12, 24, odd ? 19 : 16)); g.addColorStop(1, hs(-12, 26, odd ? 13 : 10));
      c.fillStyle = g; roundRect(c, x, y, w, w, 9); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; roundRect(c, x + 0.6, y + 0.6, w - 1.2, w - 1.2, 8.5); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.moveTo(x + 8, y + w - 0.8); c.lineTo(x + w - 8, y + w - 0.8); c.stroke();
      for (let q = 0; q < 5; q++) { c.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${r(0.06, 0.14)})`; c.fillRect(x + r(5, w - 7), y + r(5, w - 7), r(1, 2.4), r(1, 1.6)); }
      if (R() < 0.45) { c.strokeStyle = `hsla(${r(95, 140)},35%,32%,.8)`; c.lineWidth = 1; const gx = x + r(6, w - 6), gy = y + w - 3; for (let b = -1; b <= 1; b++) { c.beginPath(); c.moveTo(gx + b * 1.6, gy); c.quadraticCurveTo(gx + b * 2.4, gy - 3, gx + b * 3.6, gy - 5 - R() * 2); c.stroke(); } }
    }
    this.bg = cv;
  }

  // ---------------------------------------------------------------- drawing helpers
  txt(c, s, x, y, size = 10, col = '#fff', align = 'center', maxW) {
    c.font = `800 ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = Math.max(2, size / 3.2); c.strokeStyle = 'rgba(8,5,18,.8)';
    if (maxW) { c.strokeText(s, x, y, maxW); c.fillStyle = col; c.fillText(s, x, y, maxW); } else { c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y); }
  }
  coin(c, x, y, r = 6) {
    const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, '#fff0a8'); g.addColorStop(1, '#e49a1c');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = '#8a5410'; c.lineWidth = Math.max(1, r / 5); c.stroke();
    c.strokeStyle = 'rgba(138,84,16,.6)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r * 0.58, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - r * 0.45, y - r * 0.55, r * 0.5, r * 0.22);
  }
  bolt(c, x, y, s = 1, col = '#ffe066') {
    c.fillStyle = col; c.strokeStyle = 'rgba(80,50,0,.8)'; c.lineWidth = 1; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x + 1.5 * s, y - 6 * s); c.lineTo(x - 4 * s, y + 1 * s); c.lineTo(x - 0.5 * s, y + 1 * s); c.lineTo(x - 2 * s, y + 6 * s); c.lineTo(x + 4 * s, y - 1.5 * s); c.lineTo(x + 0.5 * s, y - 1.5 * s); c.closePath(); c.fill(); c.stroke();
  }
  star(c, x, y, r, col, rot = 0) {
    c.fillStyle = col; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, d = i % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    c.closePath(); c.fill();
  }
  glow(c, x, y, r, col, a = 1) {
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
  }
  itemArt(chain, t) { return this.art[chain][t].frames[Math.floor(this.t * 2.5 + t) % 2]; }
  // a spirit on a soft glowing plinth; `fit` caps the drawn size
  drawItem(c, chain, t, x, y, s = 1, o = {}) {
    const col = this.chainCol(chain), box = Math.min(o.fit || 99, SIZE[t] * 1.5) * s;
    c.save();
    if (o.alpha != null) c.globalAlpha = o.alpha;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 17 - (o.lift || 0) * 0.3, 13 * s - (o.lift ? 2 : 0), 3.6 * s, 0, 0, 7); c.fill();
    if (!o.flat) {
      const pr = o.pair ? 0.5 + Math.sin(this.t * 5 + x) * 0.18 : 0.3;
      this.glow(c, x, y + 5, 24 * s, col, pr * (o.glow ?? 1));
      if (t >= 5) { c.strokeStyle = GOLD; c.globalAlpha *= 0.6; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, y + 16, 18 * s, 4.6 * s, 0, 0, 7); c.stroke(); c.globalAlpha = o.alpha ?? 1; }
    }
    const bob = o.still ? 0 : Math.sin(this.t * 3.2 + x * 0.07 + t) * 0.9;
    if (!drawFit(c, this.itemArt(chain, t), x, y - 3 + bob, box, box)) { c.fillStyle = col; c.beginPath(); c.arc(x, y, 12 * s, 0, 7); c.fill(); }
    if (!o.flat) { for (let p = 0; p <= t; p++) { const px = x - t * 2.6 + p * 5.2; c.fillStyle = t >= 5 ? GOLD : col; c.beginPath(); c.arc(px, y + 21 * s, 1.5, 0, 7); c.fill(); } }
    c.restore();
  }
  drawGen(c, i, cell) {
    const [x, y0] = this.cellXY(i), k = cell.gen, kind = CHAINS[k].kind, col = this.chainCol(k), on = this.energy >= 1;
    const pu = cell.pulse || 0, y = y0 - 1 - pu * 5, T = this.t;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x, y0 + 19, 17, 4, 0, 0, 7); c.fill();
    this.glow(c, x, y + 2, 30, col, on ? 0.42 + Math.sin(T * 3 + i) * 0.14 + pu : 0.12);
    if (!on) c.globalAlpha = 0.6;
    const stoneG = (x0, y1, a, b) => { const g = c.createLinearGradient(x0, y1 - 20, x0, y1 + 16); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
    if (kind === 'grave') {
      c.fillStyle = '#3a2a24'; c.beginPath(); c.ellipse(x, y + 17, 18, 5, 0, 0, 7); c.fill();
      c.fillStyle = stoneG(x, y, '#aab2c6', '#5f6679'); c.beginPath(); c.moveTo(x - 10, y + 17); c.lineTo(x - 10, y - 5); c.arc(x, y - 5, 10, Math.PI, 0); c.lineTo(x + 10, y + 17); c.closePath(); c.fill();
      c.strokeStyle = '#2a2d3a'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = 'rgba(30,32,48,.55)'; c.fillRect(x - 1.6, y - 11, 3.2, 17); c.fillRect(x - 5.5, y - 6, 11, 3.2);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 8.4, y - 8, 1.4, 20);
      c.strokeStyle = '#6b8a4a'; c.lineWidth = 1.2; for (let b = -2; b <= 2; b++) { c.beginPath(); c.moveTo(x + b * 4, y + 17); c.lineTo(x + b * 4 + 1, y + 13); c.stroke(); }
    } else if (kind === 'crypt') {
      c.fillStyle = stoneG(x, y, '#9aa2b8', '#555c70'); c.fillRect(x - 15, y - 6, 30, 23);
      c.beginPath(); c.moveTo(x - 18, y - 5); c.lineTo(x, y - 19); c.lineTo(x + 18, y - 5); c.closePath(); c.fill();
      c.strokeStyle = '#2a2d3a'; c.lineWidth = 1.2; c.strokeRect(x - 15, y - 6, 30, 23); c.beginPath(); c.moveTo(x - 18, y - 5); c.lineTo(x, y - 19); c.lineTo(x + 18, y - 5); c.closePath(); c.stroke();
      c.fillStyle = '#0c0a16'; c.beginPath(); c.moveTo(x - 6.5, y + 17); c.lineTo(x - 6.5, y + 3); c.arc(x, y + 3, 6.5, Math.PI, 0); c.lineTo(x + 6.5, y + 17); c.fill();
      const fl = 0.55 + Math.sin(T * 4 + i) * 0.2; this.glow(c, x, y + 8, 10, col, fl);
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x - 14, y - 4, 2, 20); c.fillRect(x + 12, y - 4, 2, 20);
    } else if (kind === 'cauldron') {
      const fl = Math.sin(T * 12 + i);
      for (let f = -1; f <= 1; f++) { c.fillStyle = f ? '#ff9a2a' : '#ffd24a'; c.beginPath(); c.moveTo(x + f * 7 - 3, y + 18); c.quadraticCurveTo(x + f * 7, y + 8 + fl * 2 - (f ? 0 : 2), x + f * 7 + 3, y + 18); c.fill(); }
      c.fillStyle = '#17131f'; for (const lx of [-11, 0, 11]) c.fillRect(x + lx - 1.5, y + 11, 3, 6);
      c.fillStyle = stoneG(x, y, '#4a4660', '#14111c'); c.beginPath(); c.ellipse(x, y + 4, 16, 13, 0, 0, 7); c.fill();
      c.fillStyle = '#26222f'; c.beginPath(); c.ellipse(x, y - 6, 17, 5.5, 0, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.ellipse(x, y - 6, 14, 3.8, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - 4, y - 7, 5, 1.2, 0, 0, 7); c.fill();
      for (let b = 0; b < 3; b++) { const p = (T * 0.8 + b / 3 + i * 0.13) % 1; c.globalAlpha = (1 - p) * (on ? 1 : 0.6); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + (b - 1) * 6 + Math.sin(p * 6 + b) * 2, y - 7 - p * 14, 1.4 + (1 - p) * 1.6, 0, 7); c.fill(); }
      c.globalAlpha = on ? 1 : 0.6;
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 12, y - 1, 2, 12);
    } else {
      c.fillStyle = stoneG(x, y, '#80869c', '#40455a'); c.fillRect(x - 8, y - 11, 16, 29);
      c.strokeStyle = '#23263a'; c.lineWidth = 1.1; c.strokeRect(x - 8, y - 11, 16, 29);
      c.fillStyle = '#2c2147'; c.beginPath(); c.moveTo(x - 12, y - 10); c.lineTo(x, y - 25); c.lineTo(x + 12, y - 10); c.closePath(); c.fill(); c.strokeStyle = '#150f26'; c.stroke();
      c.fillStyle = '#0c0a16'; c.beginPath(); c.moveTo(x - 3, y + 2); c.lineTo(x - 3, y - 4); c.arc(x, y - 4, 3, Math.PI, 0); c.lineTo(x + 3, y + 2); c.fill();
      this.glow(c, x, y - 1, 7, col, 0.7);
      c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x - 6.5, y - 8, 1.6, 24);
      const ba = T * 1.7 + i, bx = x + Math.cos(ba) * 14, by = y - 17 + Math.sin(ba * 2) * 3, fl = Math.sin(T * 14 + i) * 2.2;
      c.strokeStyle = '#120d1c'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx - 4, by - fl); c.quadraticCurveTo(bx - 1.5, by - 2.2, bx, by); c.quadraticCurveTo(bx + 1.5, by - 2.2, bx + 4, by - fl); c.stroke();
    }
    c.globalAlpha = 1;
    // badge: the spirit this raises
    c.fillStyle = 'rgba(12,8,26,.85)'; c.beginPath(); c.arc(x + 15, y0 - 16, 8.5, 0, 7); c.fill();
    c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
    drawFit(c, this.art[k][0].frames[0], x + 15, y0 - 16, 13, 13);
    if (on && this.energy < 3) this.txt(c, `${this.energy}`, x - 15, y0 + 16, 8, '#ffd9a0');
    c.restore();
  }
  drawWeb(c, x, y) {
    c.save();
    c.fillStyle = 'rgba(40,46,72,.55)'; roundRect(c, x - 23, y - 23, 46, 46, 9); c.fill();
    c.strokeStyle = 'rgba(225,232,255,.55)'; c.lineWidth = 0.9;
    c.beginPath(); roundRect(c, x - 23, y - 23, 46, 46, 9); c.clip();
    for (const [cx, cy, sx, sy] of [[x - 23, y - 23, 1, 1], [x + 23, y + 23, -1, -1]]) {
      for (let a = 0; a <= 4; a++) { const an = a * Math.PI / 8; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(an) * 40 * sx, cy + Math.sin(an) * 40 * sy); c.stroke(); }
      for (let r2 = 9; r2 < 40; r2 += 8) { c.beginPath(); for (let a = 0; a <= 4; a++) { const an = a * Math.PI / 8, rr = r2 - (a % 1 === 0 ? 0 : 0), px = cx + Math.cos(an) * rr * sx, py = cy + Math.sin(an) * rr * sy; if (a) c.quadraticCurveTo(cx + Math.cos(an - Math.PI / 16) * rr * 0.85 * sx, cy + Math.sin(an - Math.PI / 16) * rr * 0.85 * sy, px, py); else c.moveTo(px, py); } c.stroke(); }
    }
    c.restore();
  }
  drawOrder(c, o, k) {
    const w = W / 3 - 6, x = k * W / 3 + 3, y = 35, h = 72, dead = o.done || o.left;
    const have = !dead && this.cells.some((cl) => this.isItem(cl) && !cl.hidden && cl.chain === o.chain && cl.t === o.tier), col = this.chainCol(o.chain);
    const pull = this.drag && this.cells[this.drag.i] && this.cells[this.drag.i].chain === o.chain && this.cells[this.drag.i].t === o.tier && !dead;
    c.save();
    c.globalAlpha = dead ? 0.55 : 1;
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(26,22,50,.72)'); g.addColorStop(1, 'rgba(12,10,28,.82)');
    c.fillStyle = g; roundRect(c, x, y, w, h, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, 10); c.stroke();
    if (have || pull) { const a = 0.55 + Math.sin(this.t * 6) * 0.3; c.strokeStyle = pull ? '#fff' : col; c.globalAlpha = (dead ? 0.55 : 1) * a; c.lineWidth = 2.4; roundRect(c, x + 1, y + 1, w - 2, h - 2, 9); c.stroke(); c.globalAlpha = dead ? 0.55 : 1; }
    // customer portrait on a moonlit disc
    const px = x + 23, py = y + 34;
    this.glow(c, px, py, 22, 'rgba(190,200,255,.55)', 0.5);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(px, y + 56, 11, 3, 0, 0, 7); c.fill();
    o.who.draw(c, px, y + 57, 1, { alpha: o.left ? Math.max(0, Math.min(1, o.left)) : 1 });
    // the wanted spirit, in a plate ringed by the patience timer
    const sx = x + 78, sy = y + 26, p = Math.max(0, 1 - o.wait / PATIENCE);
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.arc(sx, sy, 20, 0, 7); c.fill();
    this.glow(c, sx, sy, 22, col, have ? 0.55 : 0.28);
    this.drawItem(c, o.chain, o.tier, sx, sy + 1, 1, { fit: 33, flat: true, still: true });
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(sx, sy, 22.5, 0, 7); c.stroke();
    if (!dead) { c.strokeStyle = p < 0.25 ? '#ff5a5a' : p < 0.5 ? '#ffc24a' : '#7be39a'; c.lineCap = 'round'; c.beginPath(); c.arc(sx, sy, 22.5, -Math.PI / 2, -Math.PI / 2 + p * 6.283); c.stroke(); c.lineCap = 'butt'; }
    this.txt(c, CHAINS[o.chain].names[o.tier], sx, y + 54, 8, '#f2ecff', 'center', w - 56);
    this.coin(c, sx - 14, y + 63, 5);
    this.txt(c, `${o.reward}`, sx - 7, y + 63, 9, GOLD, 'left');
    this.star(c, sx + 22, y + 63, 4.2, '#b9a6ff'); this.txt(c, `${o.xp}`, sx + 27, y + 63, 8, '#d9ccff', 'left');
    if (o.done) { c.fillStyle = 'rgba(40,160,90,.9)'; c.beginPath(); c.arc(sx, sy, 11, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx - 5, sy); c.lineTo(sx - 1.5, sy + 4); c.lineTo(sx + 5.5, sy - 4); c.stroke(); c.lineCap = 'butt'; }
    c.restore();
  }
  header(c) {
    // level badge and xp bar
    const bx = 188, bw = W - 8 - bx, ph = this.barV;
    c.fillStyle = 'rgba(8,6,20,.7)'; roundRect(c, bx, 5, bw, 10, 5); c.fill();
    const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#8a6bff'); g.addColorStop(1, GOLD);
    if (ph > 0.01) { c.fillStyle = g; roundRect(c, bx + 1, 6, Math.max(8, (bw - 2) * Math.min(1, ph)), 8, 4); c.fill(); c.fillStyle = 'rgba(255,255,255,.28)'; roundRect(c, bx + 2, 7, Math.max(6, (bw - 4) * Math.min(1, ph)), 2.4, 1.2); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; roundRect(c, bx + 0.5, 5.5, bw - 1, 9, 4.5); c.stroke();
    this.txt(c, `${this.xp}/${this.need}`, bx + bw - 6, 10.5, 7, '#fff', 'right');
    const lg = c.createLinearGradient(0, 0, 0, 22); lg.addColorStop(0, '#ffe58a'); lg.addColorStop(1, '#d9921c');
    c.fillStyle = lg; c.beginPath(); c.arc(bx - 4, 10, 10, 0, 7); c.fill(); c.strokeStyle = '#6a3f08'; c.lineWidth = 1.5; c.stroke();
    c.font = `900 11px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4a2a04'; c.fillText(this.lvl, bx - 4, 10.5);
    // energy and coins
    const ey = 26;
    c.fillStyle = 'rgba(8,6,20,.7)'; roundRect(c, 158, ey - 6, 84, 12, 6); c.fill();
    const ef = Math.min(1, this.energy / 40); c.fillStyle = this.energy < 4 ? '#ff7a5a' : '#ffd24a'; roundRect(c, 172, ey - 3, Math.max(2, 64 * ef), 6, 3); c.fill();
    this.bolt(c, 166, ey, 0.9); this.txt(c, `${this.energy}`, 238, ey + 0.5, 8, '#fff', 'right');
    const bs = 1 + this.bump * 1.4;
    c.fillStyle = 'rgba(8,6,20,.7)'; roundRect(c, 256, ey - 6, 98, 12, 6); c.fill();
    this.coin(c, 266, ey, 5.6 * bs); this.txt(c, `${this.coins}`, 348, ey + 0.5, 9, GOLD, 'right');
  }
  draw(c) {
    c.drawImage(this.bg, 0, 0, W, H);
    const T = this.t;
    // twinkles, bats and drifting mist
    for (let i = 0; i < 12; i++) { const a = 0.35 + Math.sin(T * 2 + i * 1.7) * 0.35; if (a > 0.1) { this.star(c, (i * 53 + 17) % W, 6 + ((i * 29) % 70), 1.4 + (i % 2), `rgba(235,240,255,${a})`, 0); } }
    for (const b of this.bats) { const f = Math.sin(T * 12 + b.p) * 3, y = b.y + Math.sin(T * 1.3 + b.p) * 6; c.strokeStyle = '#0a0714'; c.lineWidth = 1.7; c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x - 6, y - f); c.quadraticCurveTo(b.x - 2.5, y - 3, b.x, y); c.quadraticCurveTo(b.x + 2.5, y - 3, b.x + 6, y - f); c.stroke(); }
    for (let i = 0; i < 4; i++) { const mx = ((T * (5 + i * 2) + i * 130) % (W + 240)) - 120, my = [118, 210, 300, 392][i]; this.glow(c, mx, my, 70, 'rgba(170,185,230,.10)', 1); }
    this.header(c);
    this.orders.forEach((o, k) => this.drawOrder(c, o, k));
    const dc = this.drag ? this.cells[this.drag.i] : null, over = this.drag ? this.cellAt(this.drag.x, this.drag.y) : -1;
    // drag affordances: twins ring, empty beds dash, the hovered target lights up
    if (dc) {
      const col = this.chainCol(dc.chain), pulse = 0.5 + Math.sin(T * 8) * 0.3;
      this.cells.forEach((cl, j) => {
        if (j === this.drag.i) return;
        const [x, y] = this.cellXY(j), twin = this.canMerge(dc, cl);
        if (twin) { c.strokeStyle = col; c.lineWidth = 2.4; c.globalAlpha = 0.5 + pulse * 0.5; roundRect(c, x - 23, y - 23, 46, 46, 10); c.stroke(); c.globalAlpha = 0.25 * pulse; c.fillStyle = col; roundRect(c, x - 23, y - 23, 46, 46, 10); c.fill(); c.globalAlpha = 1; }
        else if (!cl) { c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.2; c.setLineDash([4, 4]); roundRect(c, x - 21, y - 21, 42, 42, 9); c.stroke(); c.setLineDash([]); }
      });
      if (over >= 0 && over !== this.drag.i) { const [x, y] = this.cellXY(over), ok = this.canMerge(dc, this.cells[over]) || !this.cells[over]; c.strokeStyle = ok ? '#fff' : '#ff6a6a'; c.lineWidth = 2.4; roundRect(c, x - 23, y - 23, 46, 46, 10); c.stroke(); }
      const [sx, sy] = this.cellXY(this.drag.i); c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([3, 4]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(this.drag.x, this.drag.y); c.stroke(); c.setLineDash([]);
    }
    // cells
    for (let i = 0; i < COLS * ROWS; i++) {
      const [x, y] = this.cellXY(i), cell = this.cells[i];
      if (!cell) continue;
      if (cell.web) { this.drawWeb(c, x, y); continue; }
      if (cell.gen != null) { this.drawGen(c, i, cell); continue; }
      if (cell.hidden) continue;
      if (this.drag && this.drag.i === i) { this.drawItem(c, cell.chain, cell.t, x, y - 2, 1, { alpha: 0.22, flat: true, still: true }); continue; }
      let s = 1, fl = 0;
      if (cell.pop) { const u = cell.pop / 0.5; s = 1 + 0.4 * u * Math.cos((1 - u) * 5); fl = u * u; }
      this.drawItem(c, cell.chain, cell.t, x, y - 2, s, { pair: this.pairs.has(i) });
      if (fl > 0.05) this.glow(c, x, y - 2, 30, '#fff', Math.min(1, fl * 0.9));
    }
    for (const a of this.anims) {
      const k = Math.min(1, a.k), e = ease(k);
      const [tx, ty] = a.order != null ? this.orderXY(a.order) : this.cellXY(a.to ?? 0);
      const to = a.move ? [tx + (a.order != null ? 18 : 0), ty - (a.order != null ? 8 : 0)] : this.cellXY(a.to);
      const sc = a.order != null ? 1 - e * 0.45 : a.spawn ? 0.5 + e * 0.5 : 1;
      this.drawItem(c, a.chain, a.t, a.from[0] + (to[0] - a.from[0]) * e, a.from[1] + (to[1] - a.from[1]) * e - Math.sin(e * Math.PI) * 14, sc, { lift: 6 });
    }
    if (dc) this.drawItem(c, dc.chain, dc.t, this.drag.x, this.drag.y - 8, 1.18, { lift: 10, still: true });
    // effects
    for (const f of this.fx) {
      if (f.k === 'ring') { const u = 1 - f.life / f.max; c.globalAlpha = (1 - u) * 0.9; c.strokeStyle = f.col; c.lineWidth = 3 * (1 - u) + 0.6; c.beginPath(); c.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * (1 - (1 - u) * (1 - u)), 0, 7); c.stroke(); c.globalAlpha = 1; }
      else if (f.k === 'spark') { c.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 1.6)); this.star(c, f.x, f.y, f.size, f.col, f.rot); c.globalAlpha = 1; }
      else if (f.k === 'text') { c.globalAlpha = Math.min(1, f.life / f.max * 2.2); this.txt(c, f.s, f.x, f.y, f.size, f.col); c.globalAlpha = 1; }
      else if (f.k === 'coin' && f.t >= 0) { const e = ease(f.t / f.dur), x = f.x0 + (f.tx - f.x0) * e, y = f.y0 + (f.ty - f.y0) * e - Math.sin(e * Math.PI) * 26; this.coin(c, x, y, 4.6 - e); }
    }
    // a new spirit discovered
    if (this.reveal) {
      const rv = this.reveal, u = 1 - rv.life / rv.max, a = Math.min(1, u * 8, rv.life * 2.5), sl = (1 - Math.min(1, u * 6)) * -16, col = this.chainCol(rv.chain), m = this.art[rv.chain][rv.t];
      const x = W / 2 - 100, y = Y0 + 4 + sl, w = 200, h = 54;
      c.save(); c.globalAlpha = a * 0.96;
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(34,26,64,.95)'); g.addColorStop(1, 'rgba(14,10,32,.95)');
      c.fillStyle = g; roundRect(c, x, y, w, h, 14); c.fill(); c.strokeStyle = col; c.lineWidth = 2; roundRect(c, x, y, w, h, 14); c.stroke();
      c.globalAlpha = a; this.glow(c, x + 32, y + 28, 34, col, 0.6);
      let im = m.frames[0]; try { im = m.big || im; } catch { /* fall back to the pixel frame */ }
      c.imageSmoothingEnabled = im === m.big; drawFit(c, im, x + 32, y + 29, 46, 46); c.imageSmoothingEnabled = true;
      this.txt(c, 'NEW SPIRIT!', x + 62, y + 13, 7.5, GOLD, 'left');
      this.txt(c, CHAINS[rv.chain].names[rv.t], x + 62, y + 27, 12, '#fff', 'left', 132);
      this.txt(c, m.species || '', x + 62, y + 42, 7.5, '#bfb4ff', 'left', 132);
      c.restore();
    }
    if (this.msg) {
      const m = this.msg, u = 1 - m.t / m.max, a = Math.min(1, u * 6, m.t * 3), sc = 1 + Math.max(0, 0.3 - u * 1.2), cy = Y0 + ROWS * CS / 2;
      c.save(); c.globalAlpha = a; c.translate(W / 2, cy); c.scale(sc, sc);
      c.fillStyle = 'rgba(20,14,44,.88)'; roundRect(c, -92, -24, 184, 48, 14); c.fill(); c.strokeStyle = GOLD; c.lineWidth = 2.2; roundRect(c, -92, -24, 184, 48, 14); c.stroke();
      this.txt(c, m.s, 0, -7, 20, GOLD); this.txt(c, m.sub || '', 0, 13, 9, '#e7dcff');
      c.restore();
    }
  }
  hud() { return `${this.score} · lv ${this.lvl}`; }
}
