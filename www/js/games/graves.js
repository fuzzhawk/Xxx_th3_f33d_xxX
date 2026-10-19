// Merge-2 graveyard (Necromerger-ish): tap graves and crypts to raise things,
// drag two of a kind together to merge them up the chain, fill the orders at the
// top for coins and xp. Levelling up digs new generators and asks for bigger things.
import { Game, W, H, drawFit, roundRect } from './engine.js';
import { monster } from './creature.js';

const COLS = 6, ROWS = 6, CS = 50, X0 = (W - COLS * CS) / 2, Y0 = 116;
const CHAINS = [
  { gen: 'Grave', names: ['Bone', 'Bone Pile', 'Skull', 'Skeleton', 'Bone Knight', 'Ossuary Lord', 'Bone Throne'], plan: ['totem', 'blob', 'biped', 'biped', 'biped', 'quad', 'totem'] },
  { gen: 'Crypt', names: ['Wisp', 'Ghostlet', 'Spirit', 'Banshee', 'Wraith', 'Phantom Duke', 'The Pale Choir'], plan: ['floater', 'floater', 'floater', 'serpent', 'floater', 'biped', 'serpent'] },
  { gen: 'Cauldron', names: ['Toadstool', 'Eye of Newt', 'Potion', 'Elixir', 'Homunculus', 'Mandrake King', 'Philosopher Toad'], png: true },
  { gen: 'Bat Tower', names: ['Fluff', 'Bat', 'Bat Swarm', 'Vampire Bat', 'Count', 'Night Baron', 'Eternal Sire'], plan: ['blob', 'insect', 'insect', 'insect', 'biped', 'biped', 'quad'] }
];
const MAXT = 6;

export class Graves extends Game {
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'giant', 'tiny'];
  setup() {
    const s = this.post.seed || 1;
    this.art = CHAINS.map((ch, k) => ch.png
      ? (() => { const l = this.skin.list('brew', MAXT + 1, 'item', 'prop', 'ball', 'deco'); return l.map((im, t) => im || monster(s * 3 + t, this.skin.hue + 90, 14 + t * 2, t, { tex: this.skin.texFor?.(t + 30) }).frames[0]); })()
      : ch.names.map((_, t) => monster(s * 13 + k * 7907 + t * 131, this.skin.hue + k * 70 + t * 8, 14 + t * 2.5, t, { tex: this.skin.texFor?.(k * 7 + t), plan: ch.plan[t], head: t >= 3 ? this.skin.slots.enemy[(t + k) % Math.max(1, this.skin.slots.enemy.length)] : null }).frames));
    this.cells = Array.from({ length: COLS * ROWS }, () => null);
    // cobwebbed cells open up when you merge next to them
    for (let i = 0; i < this.cells.length; i++) if (Math.floor(i / COLS) >= 3 && this.rng() < 0.55) this.cells[i] = { web: true };
    this.gens = 0; this.addGen(0); this.addGen(1);
    this.energy = 30; this.coins = 0; this.lvl = 1; this.xp = 0; this.need = 6; this.eT = 0;
    this.orders = []; for (let k = 0; k < 3; k++) this.newOrder(k);
    this.anims = []; this.drag = null; this.thinkT = 1;
  }
  addGen(chain) {
    const free = this.cells.map((c, i) => (!c ? i : -1)).filter((i) => i >= 0 && Math.floor(i / COLS) < 3);
    const i = free.length ? free[Math.floor(this.rng() * free.length)] : this.cells.findIndex((c) => !c);
    if (i < 0) return;
    this.cells[i] = { gen: chain, pulse: 0 }; this.gens++;
  }
  newOrder(k) {
    const gens = [...new Set(this.cells.filter((c) => c?.gen != null).map((c) => c.gen))];
    const chain = gens[Math.floor(this.rng() * gens.length)] ?? 0;
    const tier = Math.min(MAXT, 1 + Math.floor(this.rng() * Math.min(4, 1 + this.lvl / 2)));
    this.orders[k] = { chain, tier, who: this.skin.people[k % 4], reward: 5 * 2 ** tier, xp: tier + 1, done: 0 };
  }
  cellXY(i) { return [X0 + (i % COLS) * CS + CS / 2, Y0 + Math.floor(i / COLS) * CS + CS / 2]; }
  cellAt(x, y) { const c = Math.floor((x - X0) / CS), r = Math.floor((y - Y0) / CS); return c >= 0 && c < COLS && r >= 0 && r < ROWS ? r * COLS + c : -1; }
  orderAt(x, y) { return y > 40 && y < 110 ? Math.floor(x / (W / 3)) : -1; }
  isItem(c) { return c && c.chain != null; }
  // tapping a generator raises its first tier into the nearest empty cell
  tapGen(i) {
    const g = this.cells[i];
    if (!g || g.gen == null || this.energy < 1) return false;
    const [gx, gy] = this.cellXY(i);
    let best = -1, bd = 1e9;
    this.cells.forEach((c, j) => { if (!c) { const [x, y] = this.cellXY(j), d = Math.hypot(x - gx, y - gy); if (d < bd) { bd = d; best = j; } } });
    if (best < 0) return false;
    this.energy--; g.pulse = 0.25;
    const t = this.rng() < 0.1 ? 1 : 0;
    this.cells[best] = { chain: g.gen, t, hidden: true };
    this.anims.push({ from: [gx, gy], to: best, k: 0, chain: g.gen, t, spawn: true });
    return true;
  }
  merge(a, b) {
    const A = this.cells[a], B = this.cells[b];
    if (a === b || !this.isItem(A) || !this.isItem(B) || A.chain !== B.chain || A.t !== B.t || A.t >= MAXT) return false;
    this.cells[a] = null; B.t++; B.pop = 0.3;
    const [x, y] = this.cellXY(b); this.burst(x, y, this.col(B.chain), 14, 130);
    this.score += 2 ** B.t;
    // clear cobwebs around the merge
    const c = b % COLS, r = Math.floor(b / COLS);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = c + dx, Y = r + dy, j = Y * COLS + X; if (X >= 0 && Y >= 0 && X < COLS && Y < ROWS && this.cells[j]?.web) { this.cells[j] = null; const [wx, wy] = this.cellXY(j); this.burst(wx, wy, this.pal.ink, 8, 80); } }
    return true;
  }
  deliver(i, k) {
    const c = this.cells[i], o = this.orders[k];
    if (!this.isItem(c) || !o || o.done || c.chain !== o.chain || c.t !== o.tier) return false;
    this.cells[i] = null; o.done = 0.6;
    this.coins += o.reward; this.xp += o.xp; this.score += o.reward * 3;
    this.burst(W / 6 + k * W / 3, 76, this.col(1), 20, 160);
    if (this.xp >= this.need) { this.lvl++; this.xp -= this.need; this.need = Math.round(this.need * 1.4); this.energy += 15; this.addGen(Math.min(CHAINS.length - 1, this.gens)); this.msg = { s: `LEVEL ${this.lvl}`, t: 1.5 }; }
    return true;
  }
  autopilot(dt) {
    this.thinkT -= dt;
    if (this.thinkT > 0 || this.anims.length || this.drag) return;
    this.thinkT = this.r(0.35, 0.7);
    // fill an order
    for (let k = 0; k < 3; k++) { const o = this.orders[k]; if (o.done) continue; const i = this.cells.findIndex((c) => this.isItem(c) && c.chain === o.chain && c.t === o.tier); if (i >= 0) { this.slide(i, null, k); return; } }
    // merge, preferring what the orders want
    const wanted = new Set(this.orders.map((o) => o.chain));
    let pair = null;
    for (let i = 0; i < this.cells.length && !pair; i++) for (let j = i + 1; j < this.cells.length; j++) {
      const a = this.cells[i], b = this.cells[j];
      if (!this.isItem(a) || !this.isItem(b) || a.chain !== b.chain || a.t !== b.t || a.t >= MAXT) continue;
      if (this.orders.some((o) => o.chain === a.chain && o.tier === a.t)) continue; // keep ones an order wants
      if (!pair || wanted.has(a.chain)) pair = [i, j];
      if (wanted.has(a.chain)) break;
    }
    if (pair) { this.slide(pair[0], pair[1]); return; }
    // raise something an order needs
    const gens = this.cells.map((c, i) => (c?.gen != null ? i : -1)).filter((i) => i >= 0);
    const g = gens.find((i) => wanted.has(this.cells[i].gen)) ?? gens[0];
    if (g != null && this.energy >= 1 && this.cells.some((c) => !c)) { this.tapGen(g); return; }
    // board jammed: sell the cheapest item
    if (!this.cells.some((c) => !c)) { let lo = -1; this.cells.forEach((c, i) => { if (this.isItem(c) && (lo < 0 || c.t < this.cells[lo].t)) lo = i; }); if (lo >= 0) { this.coins += 1; this.cells[lo] = null; } }
  }
  slide(from, to, order) {
    const c = this.cells[from];
    this.anims.push({ from: this.cellXY(from), to: to ?? null, order, k: 0, chain: c.chain, t: c.t, src: from, move: true });
    c.hidden = true;
  }
  down(x, y) {
    const k = this.orderAt(x, y);
    if (k >= 0 && y < 110) { const o = this.orders[k]; const i = this.cells.findIndex((c) => this.isItem(c) && c.chain === o.chain && c.t === o.tier); if (i >= 0) this.deliver(i, k); return; }
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
    if (j < 0 || j === d.i) return;
    if (!this.merge(d.i, j) && !this.cells[j]) { this.cells[j] = this.cells[d.i]; this.cells[d.i] = null; }
  }
  tap(x, y) { this.down(x, y); this.drag = null; }
  step(dt) {
    this.eT += dt;
    if (this.eT > 1.6) { this.eT = 0; if (this.energy < 40) this.energy++; }
    for (const a of this.anims) {
      a.k += dt / 0.28;
      if (a.k >= 1 && a.spawn && this.cells[a.to]) this.cells[a.to].hidden = false;
      if (a.k >= 1 && a.move) {
        const c = this.cells[a.src];
        if (c) c.hidden = false;
        if (a.order != null) this.deliver(a.src, a.order);
        else if (a.to != null) this.merge(a.src, a.to);
      }
    }
    this.anims = this.anims.filter((a) => a.k < 1);
    for (const c of this.cells) { if (c?.pulse) c.pulse = Math.max(0, c.pulse - dt); if (c?.pop) c.pop = Math.max(0, c.pop - dt); }
    this.orders.forEach((o, k) => { if (o.done && (o.done -= dt) <= 0) this.newOrder(k); });
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
  }
  itemArt(chain, t) { const a = this.art[chain][t]; return Array.isArray(a) ? a[Math.floor(this.t * 2.5 + t) % 2] : a; }
  drawItem(c, chain, t, x, y, s = 1) {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + 16 * s, 14 * s, 4 * s, 0, 0, 7); c.fill();
    if (!drawFit(c, this.itemArt(chain, t), x, y, (30 + t * 2) * s, (30 + t * 2) * s)) { c.fillStyle = this.col(chain); c.beginPath(); c.arc(x, y, 12 * s, 0, 7); c.fill(); }
    // tier pips
    for (let p = 0; p <= t; p++) { c.fillStyle = this.col(chain); c.fillRect(x - CS / 2 + 5 + p * 5, y + CS / 2 - 8, 3, 3); }
  }
  draw(c) {
    this.clear(c);
    // board
    for (let i = 0; i < COLS * ROWS; i++) {
      const [x, y] = this.cellXY(i), cell = this.cells[i];
      c.fillStyle = (i + Math.floor(i / COLS)) % 2 ? this.pal.bg2 : this.pal.bg; c.globalAlpha = 0.75;
      roundRect(c, x - CS / 2 + 1.5, y - CS / 2 + 1.5, CS - 3, CS - 3, 6); c.fill(); c.globalAlpha = 1;
      if (!cell) continue;
      if (cell.web) { c.strokeStyle = this.pal.ink; c.globalAlpha = 0.35; c.lineWidth = 1; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x - 22, y - 22 + k * 15); c.lineTo(x + 22, y + 22 - k * 15); c.stroke(); } c.globalAlpha = 0.25; c.fillStyle = this.pal.ink; c.fillRect(x - 24, y - 24, 48, 48); c.globalAlpha = 1; continue; }
      if (cell.gen != null) {
        const s = 1 + (cell.pulse || 0) * 0.8;
        c.fillStyle = this.col(cell.gen); c.globalAlpha = 0.3; roundRect(c, x - CS / 2 + 3, y - CS / 2 + 3, CS - 6, CS - 6, 8); c.fill(); c.globalAlpha = 1;
        const im = this.skin.pick(`gen${cell.gen}`, 'block', 'tile', 'deco');
        if (!drawFit(c, im, x, y - 3, 38 * s, 38 * s)) { c.fillStyle = this.col(cell.gen); c.fillRect(x - 14, y - 18, 28, 32); }
        this.text(c, CHAINS[cell.gen].gen.toUpperCase(), x, y + 19, 7, this.pal.ink);
        continue;
      }
      if (cell.hidden || (this.drag && this.drag.i === i)) continue;
      this.drawItem(c, cell.chain, cell.t, x, y - 2, 1 + (cell.pop || 0));
    }
    for (const a of this.anims) {
      const k = Math.min(1, a.k), e = k * k * (3 - 2 * k);
      const [tx, ty] = a.order != null ? [W / 6 + a.order * W / 3, 76] : a.to != null ? this.cellXY(a.to) : this.cellXY(a.to ?? 0);
      const to = a.move ? [tx, ty] : this.cellXY(a.to);
      this.drawItem(c, a.chain, a.t, a.from[0] + (to[0] - a.from[0]) * e, a.from[1] + (to[1] - a.from[1]) * e - Math.sin(e * Math.PI) * 12);
    }
    if (this.drag) { const cell = this.cells[this.drag.i]; if (cell) this.drawItem(c, cell.chain, cell.t, this.drag.x, this.drag.y, 1.15); }
    // orders
    this.orders.forEach((o, k) => {
      const x = k * W / 3 + 4, w = W / 3 - 8;
      c.fillStyle = this.pal.bg2; c.globalAlpha = o.done ? 0.4 : 0.92; roundRect(c, x, 44, w, 64, 8); c.fill(); c.globalAlpha = 1;
      drawFit(c, o.who.idle, x + 18, 70, 24, 32);
      this.drawItem(c, o.chain, o.tier, x + w - 30, 66, 0.8);
      this.text(c, CHAINS[o.chain].names[o.tier], x + w / 2, 101, 8, this.pal.ink);
      if (this.cells.some((cl) => this.isItem(cl) && cl.chain === o.chain && cl.t === o.tier)) { c.strokeStyle = this.col(1); c.lineWidth = 2; roundRect(c, x, 44, w, 64, 8); c.stroke(); }
    });
    this.text(c, `⚡${this.energy}  ◉${this.coins}  LV${this.lvl}`, W - 8, 30, 10, this.pal.ink, 'right');
    if (this.msg) this.text(c, this.msg.s, W / 2, Y0 + ROWS * CS / 2, 22, this.pal.ink);
  }
  hud() { return `${this.score} · lv ${this.lvl}`; }
}
