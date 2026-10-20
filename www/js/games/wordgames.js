// Word games: Wordle-style guessing, a spelling bee, word search, a letter wheel,
// hangman, a vocabulary quiz and word ladders. Each one plays itself on autopilot.
import { Game, W, H } from './engine.js';
import { loadWords, getVocab, FREQ, BLOCK, tile, keyboard, keyAt, wrap } from './words.js';

const shuffleWith = (rng, a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const maskOf = (w) => { let m = 0; for (const ch of w) m |= 1 << (ch.charCodeAt(0) - 97); return m; };

class WordGame extends Game {
  static noAuto = true;
  static noMods = ['mirror', 'wobble', 'lowg', 'heavy', 'giant', 'tiny', 'swarm', 'glass', 'trails', 'chaos'];
  setup() { this.ready = false; this.msg = null; this.thinkT = 1; loadWords().then((d) => { if (d) { this.dict = d; this.newRound(); this.ready = true; } }); }
  pick(list) { return list[Math.floor(this.rng() * list.length)]; }
  flash(s, t = 1.4) { this.msg = { s, t }; }
  step(dt) { if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null; if (this.ready && (this.autoOK || !this.auto)) this.tick(dt); }
  tick() {}
  draw(c) {
    this.clear(c);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, W, H);
    if (!this.ready) { this.text(c, 'opening the dictionary…', W / 2, H / 2, 13); return; }
    this.paint(c);
    if (this.msg) { c.globalAlpha = Math.min(1, this.msg.t * 3); c.fillStyle = 'rgba(0,0,0,.75)'; c.beginPath(); c.roundRect(W / 2 - 130, 64, 260, 34, 8); c.fill(); this.text(c, this.msg.s, W / 2, 81, 13, this.pal.ink); c.globalAlpha = 1; }
  }
  paint() {}
}

// ================================================================ Wordle-style
function score(guess, answer) {
  const res = Array(5).fill('miss'), left = {};
  for (let i = 0; i < 5; i++) if (guess[i] === answer[i]) res[i] = 'hit'; else left[answer[i]] = (left[answer[i]] || 0) + 1;
  for (let i = 0; i < 5; i++) if (res[i] !== 'hit' && left[guess[i]] > 0) { res[i] = 'near'; left[guess[i]]--; }
  return res;
}
export class Wordle extends WordGame {
  newRound() {
    this.answers ||= this.dict.common(5, 20);
    this.answer = this.pick(this.answers);
    this.rows = []; this.typed = ''; this.done = false; this.cands = this.dict.common(5, 35); this.plan = null;
  }
  submit() {
    const g = this.typed;
    if (g.length < 5) return;
    if (!this.dict.has(g)) { this.flash('not in the word list'); this.typed = ''; return; }
    const res = score(g, this.answer);
    this.rows.push({ g, res, t: 0 }); this.typed = '';
    this.cands = this.cands.filter((w) => score(g, w).join() === res.join());
    if (g === this.answer) { this.done = 2.5; this.score += (7 - this.rows.length) * 100; this.flash(['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'][this.rows.length - 1]); this.burst(W / 2, 160, this.col(2), 30, 200); }
    else if (this.rows.length >= 6) { this.done = 3; this.flash(this.answer.toUpperCase()); }
  }
  key(k) {
    if (this.done) return;
    if (k === 'enter') this.submit(); else if (k === 'back') this.typed = this.typed.slice(0, -1); else if (this.typed.length < 5) this.typed += k;
  }
  autopilot(dt) {
    if (this.done || !this.ready) return;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    if (!this.plan) this.plan = this.rows.length ? this.pick(this.cands.length ? this.cands : this.answers) : this.pick(['crane', 'slate', 'trace', 'raise', 'stare', 'adieu', 'roast', 'least'].filter((w) => this.dict.has(w)));
    if (this.typed.length < 5) { this.key(this.plan[this.typed.length]); this.thinkT = this.r(0.12, 0.25); }
    else { this.key('enter'); this.plan = null; this.thinkT = this.r(0.9, 1.6); }
  }
  tick(dt) { for (const r of this.rows) r.t += dt; if (this.done && (this.done -= dt) <= 0) this.newRound(); }
  down(x, y) { const k = keyAt(this.keys, x, y); if (k) this.key(k); }
  paint(c) {
    const tw = 37, gap = 5, x0 = (W - (tw * 5 + gap * 4)) / 2, y0 = 60;
    for (let r = 0; r < 6; r++) for (let i = 0; i < 5; i++) {
      const row = this.rows[r], live = r === this.rows.length;
      const flip = row ? Math.min(1, Math.max(0, row.t * 4 - i * 0.6)) : 1;
      const ch = row ? row.g[i] : live ? this.typed[i] : '';
      const st = row && flip >= 0.5 ? row.res[i] : ch ? 'empty' : null;
      const y = y0 + r * (tw + gap), sq = Math.abs(Math.cos(flip * Math.PI));
      c.save(); c.translate(0, y + tw / 2); c.scale(1, row ? Math.max(0.05, sq) : 1);
      tile(this, c, x0 + i * (tw + gap), -tw / 2, tw, tw, ch, st); c.restore();
    }
    const states = {};
    const rank = { miss: 1, near: 2, hit: 3 };
    for (const row of this.rows) [...row.g].forEach((ch, i) => { const st = row.res[i]; if (!states[ch] || rank[st] > rank[states[ch]]) states[ch] = st; });
    this.keys = keyboard(this, c, 322, states, 28);
  }
  hud() { return `${this.score} · guess ${Math.min(6, this.rows?.length + 1 || 1)}/6`; }
}

// ================================================================ Spelling bee
const RANKS = [[0, 'Beginner'], [0.05, 'Good start'], [0.12, 'Moving up'], [0.2, 'Good'], [0.32, 'Solid'], [0.48, 'Nice'], [0.62, 'Great'], [0.78, 'Amazing'], [0.9, 'Genius']];
export class Bee extends WordGame {
  newRound() {
    const d = this.dict;
    if (!this.pool) { this.pool = []; for (const [w, lv] of d.level) if (lv <= 40 && w.length >= 4 && !w.includes('s') && !BLOCK.test(w)) this.pool.push([w, maskOf(w)]); }
    for (let tries = 0; tries < 60; tries++) {
      const pan = this.pick([...d.common(7, 35), ...d.common(8, 35)].filter((w) => !w.includes('s') && new Set(w).size === 7));
      if (!pan) break;
      const letters = [...new Set(pan)], center = letters[Math.floor(this.rng() * 7)], m = maskOf(pan), cm = maskOf(center);
      const valid = this.pool.filter(([w, wm]) => (wm & ~m) === 0 && (wm & cm)).map(([w]) => w);
      if (valid.length < 14 || valid.length > 70) continue;
      this.center = center; this.outer = shuffleWith(this.rng, letters.filter((l) => l !== center)); this.valid = new Set(valid);
      this.max = valid.reduce((s, w) => s + this.pts(w), 0); break;
    }
    this.found = []; this.typed = ''; this.pts0 = 0; this.queue = null;
  }
  pts(w) { return (w.length === 4 ? 1 : w.length) + (new Set(w).size === 7 ? 7 : 0); }
  submit() {
    const w = this.typed; this.typed = '';
    if (w.length < 4) return this.flash('too short');
    if (!w.includes(this.center)) return this.flash('missing centre letter');
    if (this.found.includes(w)) return this.flash('already found');
    if (!this.valid.has(w)) return this.flash('not in word list');
    this.found.unshift(w); const p = this.pts(w); this.pts0 += p; this.score += p * 10;
    this.flash(new Set(w).size === 7 ? `PANGRAM! +${p}` : `+${p}`, 1);
    if (this.found.length >= this.valid.size || this.pts0 >= this.max * 0.9) { this.flash('Genius! New hive…', 2.5); this.nextT = 2.5; }
  }
  hexes() {
    const pts = [{ ch: this.center, x: W / 2, y: 238, mid: true }];
    this.outer.forEach((ch, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; pts.push({ ch, x: W / 2 + Math.cos(a) * 64, y: 238 + Math.sin(a) * 64 }); });
    return pts;
  }
  autopilot(dt) {
    if (this.nextT) return;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    if (!this.queue) {
      const left = [...this.valid].filter((w) => !this.found.includes(w));
      this.queue = this.rng() < 0.12 ? shuffleWith(this.rng, [this.center, ...this.outer]).slice(0, 4 + this.ri(0, 2)).join('') : this.pick(left) || '';
    }
    if (this.typed.length < this.queue.length) { this.typed += this.queue[this.typed.length]; this.thinkT = this.r(0.1, 0.2); }
    else { this.submit(); this.queue = null; this.thinkT = this.r(0.8, 2); }
  }
  tick(dt) { if (this.nextT && (this.nextT -= dt) <= 0) { this.nextT = 0; this.newRound(); } }
  down(x, y) {
    for (const h of this.hexes()) if (Math.hypot(x - h.x, y - h.y) < 30) { this.typed += h.ch; return; }
    if (y > 350 && y < 386) { if (x < 130) this.typed = this.typed.slice(0, -1); else if (x < 230) this.outer = shuffleWith(this.rng, this.outer); else this.submit(); }
  }
  paint(c) {
    const p = this.pal, frac = this.pts0 / Math.max(1, this.max);
    const rank = RANKS.filter(([f]) => frac >= f).pop()[1];
    this.text(c, `${rank} · ${this.pts0} pts · ${this.found.length} words`, W / 2, 112, 12, p.ink);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(40, 122, W - 80, 4); c.fillStyle = p.c[1]; c.fillRect(40, 122, (W - 80) * Math.min(1, frac / 0.9), 4);
    c.font = '600 11px ui-monospace, monospace'; c.fillStyle = p.c[4]; c.textAlign = 'center'; c.fillText(this.found.slice(0, 7).join('  '), W / 2, 138);
    this.text(c, this.typed.toUpperCase(), W / 2, 154, 24, p.ink);
    c.fillStyle = p.c[0]; c.fillRect(W / 2 - 60, 168, 120, 2);
    for (const h of this.hexes()) {
      c.fillStyle = h.mid ? p.c[1] : 'rgba(255,255,255,.14)'; c.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(h.x + Math.cos(a) * 32, h.y + Math.sin(a) * 32); }
      c.closePath(); c.fill();
      this.text(c, h.ch.toUpperCase(), h.x, h.y + 1, 22, h.mid ? p.bg : p.ink);
    }
    ['Delete', '⟳', 'Enter'].forEach((s, i) => { const x = 40 + i * 100; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x, 354, 80, 30, 15); c.stroke(); this.text(c, s, x + 40, 369, 12); });
  }
  hud() { return `${this.score} · bee`; }
}

// ================================================================ Word search
const THEMES = {
  'Planets & moons': ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'titan', 'europa', 'phobos', 'io'],
  'Cheeses': ['brie', 'gouda', 'cheddar', 'feta', 'edam', 'stilton', 'gruyere', 'paneer', 'ricotta', 'halloumi', 'oka', 'emmental'],
  'Tarot': ['fool', 'magician', 'empress', 'emperor', 'lovers', 'chariot', 'hermit', 'justice', 'death', 'tower', 'star', 'moon', 'sun', 'world'],
  'Weather': ['rain', 'sleet', 'hail', 'fog', 'mist', 'thunder', 'drizzle', 'blizzard', 'gale', 'frost', 'monsoon', 'chinook'],
  'Canadian things': ['moose', 'maple', 'toque', 'loonie', 'hockey', 'poutine', 'canoe', 'beaver', 'tundra', 'muskeg', 'caribou', 'igloo'],
  'Mythical beasts': ['griffin', 'kraken', 'dragon', 'unicorn', 'hydra', 'sphinx', 'kappa', 'wendigo', 'basilisk', 'phoenix', 'yeti', 'golem'],
  'Instruments': ['oboe', 'tuba', 'banjo', 'cello', 'sitar', 'harp', 'theremin', 'kazoo', 'fiddle', 'organ', 'drum', 'lute'],
  'Fungi': ['morel', 'chanterelle', 'truffle', 'enoki', 'shiitake', 'puffball', 'oyster', 'porcini', 'amanita', 'mycelium', 'spore', 'cap'],
  'Philosophers': ['plato', 'zeno', 'hume', 'kant', 'locke', 'hegel', 'marx', 'camus', 'sartre', 'laozi', 'diogenes', 'hypatia'],
  'Gemstones': ['ruby', 'opal', 'jade', 'onyx', 'topaz', 'garnet', 'beryl', 'amber', 'pearl', 'agate', 'jasper', 'emerald'],
  'Kitchen': ['ladle', 'whisk', 'kettle', 'spatula', 'colander', 'grater', 'tongs', 'skillet', 'wok', 'sieve', 'pestle', 'mortar'],
  'Birds': ['heron', 'raven', 'finch', 'owl', 'egret', 'puffin', 'loon', 'magpie', 'osprey', 'wren', 'kestrel', 'chicken'],
  'Oracles': ['augury', 'omen', 'tarot', 'rune', 'iching', 'entrails', 'liver', 'sibyl', 'delphi', 'prophecy', 'dice', 'chicken'],
  'Dances': ['waltz', 'tango', 'polka', 'salsa', 'jig', 'mambo', 'rumba', 'samba', 'twist', 'hustle', 'bolero', 'reel']
};
const DIRS = [[1, 0], [0, 1], [1, 1], [-1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1]];
export class WordSearch extends WordGame {
  newRound() {
    const N = 11; this.N = N;
    const name = this.pick(Object.keys(THEMES)), list = shuffleWith(this.rng, THEMES[name].filter((w) => w.length <= N)).slice(0, 9);
    const grid = Array.from({ length: N * N }, () => '');
    this.place = [];
    for (const w of list) {
      for (let k = 0; k < 120; k++) {
        const [dx, dy] = DIRS[this.ri(0, this.rng() < 0.6 ? 3 : 7)], x = this.ri(0, N - 1), y = this.ri(0, N - 1), ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
        if (ex < 0 || ey < 0 || ex >= N || ey >= N) continue;
        if ([...w].some((ch, i) => { const g = grid[(y + dy * i) * N + x + dx * i]; return g && g !== ch; })) continue;
        [...w].forEach((ch, i) => (grid[(y + dy * i) * N + x + dx * i] = ch));
        this.place.push({ w, x, y, dx, dy, found: false }); break;
      }
    }
    this.grid = grid.map((g) => g || FREQ[Math.floor(this.rng() * FREQ.length)]);
    this.themeName = name; this.sel = null; this.nextT = 0;
  }
  cell(x, y) { const s = 28, x0 = (W - s * this.N) / 2, y0 = 56, cx = Math.floor((x - x0) / s), cy = Math.floor((y - y0) / s); return cx >= 0 && cy >= 0 && cx < this.N && cy < this.N ? [cx, cy] : null; }
  line(a, b) {
    let dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]); const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    if (Math.abs(b[0] - a[0]) && Math.abs(b[1] - a[1]) && Math.abs(b[0] - a[0]) !== Math.abs(b[1] - a[1])) { if (Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1])) dy = 0; else dx = 0; }
    return { x: a[0], y: a[1], dx, dy, n };
  }
  check(l) {
    const s = Array.from({ length: l.n + 1 }, (_, i) => this.grid[(l.y + l.dy * i) * this.N + l.x + l.dx * i]).join('');
    const hit = this.place.find((p) => !p.found && ((p.w === s && p.x === l.x && p.y === l.y) || (p.w === [...s].reverse().join('') && p.x === l.x + l.dx * l.n && p.y === l.y + l.dy * l.n)));
    if (hit) { hit.found = true; this.score += hit.w.length * 20; this.flash(hit.w.toUpperCase(), 0.9); if (this.place.every((p) => p.found)) { this.nextT = 2.5; this.flash('All found!', 2); } }
  }
  autopilot(dt) {
    if (this.nextT) return;
    if (this.anim) { this.anim.k += dt * 2.2; const p = this.anim.p, i = Math.min(p.w.length - 1, Math.floor(this.anim.k * p.w.length)); this.sel = { x: p.x, y: p.y, dx: p.dx, dy: p.dy, n: i }; if (this.anim.k >= 1) { this.check(this.sel); this.sel = null; this.anim = null; this.thinkT = this.r(0.8, 2.2); } return; }
    if ((this.thinkT -= dt) > 0) return;
    const p = this.pick(this.place.filter((q) => !q.found)); if (p) this.anim = { p, k: 0 };
  }
  tick(dt) { if (this.nextT && (this.nextT -= dt) <= 0) this.newRound(); }
  down(x, y) { const a = this.cell(x, y); if (a) { this.dragA = a; this.sel = this.line(a, a); } }
  move(x, y) { const b = this.cell(x, y); if (this.dragA && b) this.sel = this.line(this.dragA, b); }
  up() { if (this.sel) this.check(this.sel); this.sel = null; this.dragA = null; }
  tap() {}
  paint(c) {
    const s = 28, N = this.N, x0 = (W - s * N) / 2, y0 = 56, p = this.pal;
    const capsule = (l, col) => { const ax = x0 + l.x * s + s / 2, ay = y0 + l.y * s + s / 2, bx = ax + l.dx * l.n * s, by = ay + l.dy * l.n * s; c.strokeStyle = col; c.lineWidth = s * 0.78; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); };
    this.place.forEach((q, i) => { if (q.found) { c.globalAlpha = 0.55; capsule({ ...q, n: q.w.length - 1 }, this.col(i)); c.globalAlpha = 1; } });
    if (this.sel) { c.globalAlpha = 0.5; capsule(this.sel, p.ink); c.globalAlpha = 1; }
    c.font = '700 15px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = p.ink;
    for (let i = 0; i < N * N; i++) c.fillText(this.grid[i].toUpperCase(), x0 + (i % N) * s + s / 2, y0 + Math.floor(i / N) * s + s / 2 + 1);
    this.text(c, this.themeName.toUpperCase(), W / 2, 378, 11, p.c[1]);
    c.font = '600 11px ui-monospace, monospace';
    const words = this.place.map((q) => q.w); let x = 14, y = 394;
    for (const [i, w] of words.entries()) { const tw = c.measureText(w).width + 12; if (x + tw > W - 10) { x = 14; y += 14; } c.fillStyle = this.place[i].found ? 'rgba(255,255,255,.3)' : p.ink; c.textAlign = 'left'; c.fillText(w, x, y); if (this.place[i].found) c.fillRect(x, y, tw - 12, 1); x += tw; }
  }
  hud() { return `${this.score} · ${this.place?.filter((p) => p.found).length || 0}/${this.place?.length || 0}`; }
}

// ================================================================ Letter wheel
export class Wheel extends WordGame {
  newRound() {
    const d = this.dict;
    for (let tries = 0; tries < 50; tries++) {
      const base = this.pick([...d.common(6, 20), ...d.common(7, 20)]);
      const count = {}; for (const ch of base) count[ch] = (count[ch] || 0) + 1;
      const fits = (w) => { const c2 = {}; for (const ch of w) { c2[ch] = (c2[ch] || 0) + 1; if (c2[ch] > (count[ch] || 0)) return false; } return true; };
      const subs = [3, 4, 5, 6, 7].flatMap((n) => d.common(n, 35)).filter((w) => w.length <= base.length && fits(w));
      if (subs.length < 7) continue;
      this.letters = shuffleWith(this.rng, [...base]);
      this.targets = [...new Set(subs)].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(-18).sort((a, b) => a.length - b.length || a.localeCompare(b));
      if (!this.targets.includes(base)) this.targets[this.targets.length - 1] = base;
      break;
    }
    this.got = new Set(); this.path = []; this.nextT = 0; this.anim = null;
  }
  spots() { const n = this.letters.length; return this.letters.map((ch, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return { ch, i, x: W / 2 + Math.cos(a) * 62, y: 334 + Math.sin(a) * 62 }; }); }
  word() { return this.path.map((i) => this.letters[i]).join(''); }
  submit() {
    const w = this.word(); this.path = [];
    if (w.length < 3) return;
    if (this.got.has(w)) return this.flash('already found', 0.8);
    if (this.targets.includes(w)) { this.got.add(w); this.score += w.length * 15; this.flash(w.toUpperCase(), 0.8); if (this.got.size === this.targets.length) { this.nextT = 2.5; this.flash('Wheel complete!', 2); } }
    else if (this.dict.has(w)) { this.score += 5; this.flash(`${w.toUpperCase()} · bonus word`, 0.9); }
    else this.flash('not a word', 0.7);
  }
  autopilot(dt) {
    if (this.nextT) return;
    if (this.anim) {
      this.anim.k += dt * 1.6;
      const w = this.anim.w, n = Math.min(w.length, Math.floor(this.anim.k * w.length) + 1);
      if (this.path.length < n) { const used = new Set(this.path); const idx = this.letters.findIndex((ch, i) => ch === w[this.path.length] && !used.has(i)); if (idx >= 0) this.path.push(idx); }
      if (this.anim.k >= 1.1) { this.submit(); this.anim = null; this.thinkT = this.r(0.6, 1.8); }
      return;
    }
    if ((this.thinkT -= dt) > 0) return;
    const w = this.pick(this.targets.filter((x) => !this.got.has(x))); if (w) this.anim = { w, k: 0 };
  }
  tick(dt) { if (this.nextT && (this.nextT -= dt) <= 0) this.newRound(); }
  at(x, y) { return this.spots().find((s) => Math.hypot(s.x - x, s.y - y) < 22); }
  down(x, y) { if (Math.hypot(x - W / 2, y - 334) < 26 && !this.at(x, y)) { this.letters = shuffleWith(this.rng, this.letters); return; } const s = this.at(x, y); if (s) { this.path = [s.i]; this.dragging = true; } }
  move(x, y) { if (!this.dragging) return; const s = this.at(x, y); if (s && !this.path.includes(s.i)) this.path.push(s.i); else if (s && this.path.length > 1 && this.path[this.path.length - 2] === s.i) this.path.pop(); this.fx = x; this.fy = y; }
  up() { if (this.dragging) { this.dragging = false; this.submit(); } }
  tap() {}
  paint(c) {
    const p = this.pal, bs = 15, cols = 2;
    this.targets.forEach((w, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = 20 + col * 170, y = 58 + row * 20;
      for (let k = 0; k < w.length; k++) tile(this, c, x + k * (bs + 2), y, bs, bs, this.got.has(w) ? w[k] : '', this.got.has(w) ? 'hit' : null);
    });
    const sp = this.spots();
    c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.arc(W / 2, 334, 84, 0, 7); c.fill();
    if (this.path.length) { c.strokeStyle = p.c[0]; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); this.path.forEach((i, k) => (k ? c.lineTo(sp[i].x, sp[i].y) : c.moveTo(sp[i].x, sp[i].y))); if (this.dragging && this.fx) c.lineTo(this.fx, this.fy); c.stroke(); }
    for (const s of sp) { const on = this.path.includes(s.i); c.fillStyle = on ? p.c[0] : p.bg2; c.beginPath(); c.arc(s.x, s.y, 21, 0, 7); c.fill(); this.text(c, s.ch.toUpperCase(), s.x, s.y + 1, 19, p.ink); }
    this.text(c, '⟳', W / 2, 334, 18, 'rgba(255,255,255,.4)');
    this.text(c, this.word().toUpperCase(), W / 2, 244, 20, p.ink);
  }
  hud() { return `${this.score} · ${this.got?.size || 0}/${this.targets?.length || 0}`; }
}

// ================================================================ Hangman (with a vocabulary hint)
export class Hangman extends WordGame {
  newRound() {
    const v = getVocab().filter((x) => /^[a-z]{5,14}$/.test(x.w));
    if (v.length && this.rng() < 0.7) { const e = this.pick(v); this.word = e.w; this.hint = `${e.pos ? `(${e.pos}) ` : ''}${e.d}`; }
    else { this.word = this.pick([...this.dict.common(7, 20), ...this.dict.common(8, 20), ...this.dict.common(9, 20)]); this.hint = ''; }
    this.guessed = new Set(); this.wrong = 0; this.done = 0;
  }
  guess(ch) {
    if (this.done || this.guessed.has(ch) || !/^[a-z]$/.test(ch)) return;
    this.guessed.add(ch);
    if (!this.word.includes(ch)) { this.wrong++; if (this.wrong >= 10) { this.done = 3; this.flash(`It was ${this.word.toUpperCase()}`, 3); } }
    else if ([...this.word].every((x) => this.guessed.has(x))) { this.done = 2.5; this.score += (11 - this.wrong) * 30; this.flash('Saved!', 2); this.burst(W / 2, 240, this.col(2), 24, 180); }
  }
  autopilot(dt) {
    if (this.done) return;
    if ((this.thinkT -= dt) > 0) return;
    this.thinkT = this.r(0.6, 1.3);
    const pat = [...this.word].map((x) => (this.guessed.has(x) ? x : '.')).join('');
    const re = new RegExp(`^${pat.replace(/\./g, `[^${[...this.guessed].join('') || '#'}]`)}$`);
    const L = this.word.length, cands = (this.dict.byLen[L] || []).filter((w) => re.test(w));
    const misses = [...this.guessed].filter((ch) => !this.word.includes(ch)), freq = {};
    if (cands.length) for (const w of cands) for (const ch of new Set(w)) { if (!this.guessed.has(ch)) freq[ch] = (freq[ch] || 0) + 1; }
    else {
      // rare word: score letters by how often they sit in the blank spots of similar words,
      // weighting words that agree with the letters already revealed
      for (const w of this.dict.byLen[L] || []) {
        if (misses.some((m) => w.includes(m))) continue;
        let agree = 0; for (let i = 0; i < L; i++) if (pat[i] !== '.' && w[i] === pat[i]) agree++;
        const wt = (1 + agree) ** 3;
        for (let i = 0; i < L; i++) if (pat[i] === '.' && !this.guessed.has(w[i])) freq[w[i]] = (freq[w[i]] || 0) + wt;
      }
    }
    const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[this.rng() < 0.15 ? 1 : 0]?.[0] || [...'etaoinshrdlucmfwypvbgkqjxz'].find((ch) => !this.guessed.has(ch));
    // like a person reading the clue: the more letters showing, the likelier the word clicks
    const shown = [...this.word].filter((x) => this.guessed.has(x)).length / this.word.length, left = [...this.word].filter((x) => !this.guessed.has(x));
    this.guess(left.length && this.rng() < 0.15 + shown * 0.6 ? this.pick(left) : best);
  }
  tick(dt) { if (this.done && (this.done -= dt) <= 0) this.newRound(); }
  down(x, y) { const k = keyAt(this.keys, x, y); if (k && k.length === 1) this.guess(k); }
  paint(c) {
    const p = this.pal, n = this.wrong;
    // gallows and the figure, drawn in parts
    c.lineCap = 'round';
    const beam = (x0, y0, x1, y1) => () => { c.strokeStyle = p.c[4]; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = p.ink; c.lineWidth = 3; };
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 4; c.beginPath(); c.moveTo(40, 210); c.lineTo(130, 210); c.moveTo(60, 210); c.lineTo(60, 50); c.lineTo(130, 50); c.lineTo(130, 70); c.stroke();
    c.strokeStyle = p.ink; c.lineWidth = 3;
    const parts = [beam(40, 210, 130, 210), beam(60, 210, 60, 50), beam(60, 50, 130, 50), beam(130, 50, 130, 70), () => { c.beginPath(); c.arc(130, 86, 15, 0, 7); c.stroke(); }, () => { c.beginPath(); c.moveTo(130, 101); c.lineTo(130, 150); c.stroke(); }, () => { c.beginPath(); c.moveTo(130, 115); c.lineTo(110, 135); c.stroke(); }, () => { c.beginPath(); c.moveTo(130, 115); c.lineTo(150, 135); c.stroke(); }, () => { c.beginPath(); c.moveTo(130, 150); c.lineTo(114, 182); c.stroke(); }, () => { c.beginPath(); c.moveTo(130, 150); c.lineTo(146, 182); c.stroke(); }, () => { c.fillStyle = p.c[0]; c.fillRect(124, 82, 3, 3); c.fillRect(133, 82, 3, 3); }];
    for (let i = 0; i < n; i++) parts[i]();
    if (this.hint) { c.fillStyle = p.c[4]; c.font = '600 12px Georgia, serif'; c.textAlign = 'left'; c.textBaseline = 'top'; wrap(c, `“${this.hint}”`, 172, 60, W - 186, 16, 8); }
    const L = this.word.length, bw = Math.min(26, (W - 30) / L - 4), x0 = (W - L * (bw + 4)) / 2;
    for (let i = 0; i < L; i++) { const ch = this.word[i], show = this.guessed.has(ch) || (this.done && this.wrong >= 10); c.fillStyle = p.ink; c.fillRect(x0 + i * (bw + 4), 280, bw, 2); if (show) this.text(c, ch.toUpperCase(), x0 + i * (bw + 4) + bw / 2, 266, 20, this.guessed.has(ch) ? p.ink : p.c[0]); }
    this.text(c, `${10 - n} lives`, W / 2, 236, 11, p.c[1]);
    const st = {}; for (const ch of this.guessed) st[ch] = this.word.includes(ch) ? 'hit' : 'miss';
    this.keys = keyboard(this, c, 304, st, 34);
  }
  hud() { return `${this.score} · hangman`; }
}

// ================================================================ Vocabulary quiz
export class Vocab extends WordGame {
  newRound() { this.streak ||= 0; this.qn = (this.qn || 0) + 1; this.makeQ(); }
  makeQ() {
    const v = getVocab(), e = this.pick(v), wrong = shuffleWith(this.rng, v.filter((x) => x.w !== e.w)).slice(0, 3);
    this.flip = this.rng() < 0.35; // definition → word
    this.q = e; this.opts = shuffleWith(this.rng, [e, ...wrong]); this.answer = null; this.timeLeft = 14; this.thinkT = this.r(1.5, 4);
  }
  choose(i) {
    if (this.answer != null) return;
    this.answer = i; const right = this.opts[i] === this.q;
    if (right) { this.streak++; this.score += 100 + this.streak * 20 + Math.round(this.timeLeft * 5); this.burst(W / 2, 90, this.col(2), 16, 140); }
    else this.streak = 0;
    this.pauseT = 2.2;
  }
  autopilot(dt) { if (this.answer != null) return; if ((this.thinkT -= dt) > 0) return; const right = this.opts.indexOf(this.q); this.choose(this.rng() < 0.82 ? right : (right + 1 + this.ri(0, 2)) % 4); }
  tick(dt) {
    if (this.answer == null) { this.timeLeft -= dt; if (this.timeLeft <= 0) this.choose(-1); }
    else if ((this.pauseT -= dt) <= 0) this.makeQ();
  }
  down(x, y) { const i = Math.floor((y - 168) / 60); if (i >= 0 && i < 4 && y - 168 - i * 60 < 54) this.choose(i); }
  paint(c) {
    const p = this.pal, q = this.q;
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(20, 52, W - 40, 4); c.fillStyle = this.timeLeft < 4 ? p.c[0] : p.c[1]; c.fillRect(20, 52, (W - 40) * Math.max(0, this.timeLeft / 14), 4);
    this.text(c, this.flip ? 'Which word means…' : 'What does it mean?', W / 2, 74, 11, p.c[4]);
    if (this.flip) { c.fillStyle = p.ink; c.font = '600 15px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'top'; wrap(c, `“${q.d}”`, W / 2, 90, W - 50, 19, 4); }
    else { this.text(c, q.w, W / 2, 112, 28, p.ink); if (q.pos) this.text(c, q.pos, W / 2, 140, 11, p.c[4]); }
    this.opts.forEach((o, i) => {
      const y = 168 + i * 60, right = o === q, picked = this.answer === i;
      c.fillStyle = this.answer == null ? 'rgba(255,255,255,.1)' : right ? p.c[2] : picked ? p.c[0] : 'rgba(255,255,255,.05)';
      c.beginPath(); c.roundRect(20, y, W - 40, 54, 10); c.fill();
      c.fillStyle = p.ink; c.textAlign = 'left'; c.textBaseline = 'top';
      if (this.flip) { c.font = '700 17px ui-monospace, monospace'; c.fillText(o.w, 34, y + 17); }
      else { c.font = '500 12px system-ui, sans-serif'; wrap(c, o.d, 32, y + 9, W - 64, 15, 3); }
    });
    this.text(c, `streak ${this.streak}`, W / 2, 412, 11, p.c[1]);
  }
  hud() { return `${this.score} · streak ${this.streak || 0}`; }
}

// ================================================================ Word ladder
export class Ladder extends WordGame {
  newRound() {
    const d = this.dict;
    if (!this.nodes) {
      this.nodes = d.common(4, 35); this.idx = new Map(this.nodes.map((w, i) => [w, i])); this.adj = this.nodes.map(() => []);
      const buckets = new Map();
      this.nodes.forEach((w, i) => { for (let k = 0; k < 4; k++) { const key = w.slice(0, k) + '_' + w.slice(k + 1); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(i); } });
      for (const b of buckets.values()) for (const i of b) for (const j of b) if (i !== j) this.adj[i].push(j);
    }
    const commonSet = new Set(d.common(4, 20));
    for (let tries = 0; tries < 40; tries++) {
      const s = this.pick(this.nodes.filter((w) => commonSet.has(w)));
      const prev = new Map([[this.idx.get(s), -1]]), q = [this.idx.get(s)], dist = new Map([[this.idx.get(s), 0]]);
      for (let h = 0; h < q.length; h++) for (const j of this.adj[q[h]]) if (!dist.has(j)) { dist.set(j, dist.get(q[h]) + 1); prev.set(j, q[h]); q.push(j); }
      const far = [...dist.entries()].filter(([j, dd]) => dd >= 3 && dd <= 5 && commonSet.has(this.nodes[j]));
      if (!far.length) continue;
      const [end] = this.pick(far); const path = []; for (let j = end; j !== -1; j = prev.get(j)) path.unshift(this.nodes[j]);
      this.from = s; this.to = this.nodes[end]; this.solution = path; break;
    }
    this.chain = [this.from]; this.typed = ''; this.done = 0;
  }
  oneOff(a, b) { let n = 0; for (let i = 0; i < 4; i++) if (a[i] !== b[i]) n++; return n === 1; }
  key(k) {
    if (this.done) return;
    if (k === 'back') { if (this.typed) this.typed = this.typed.slice(0, -1); else if (this.chain.length > 1) this.chain.pop(); return; }
    if (k === 'enter') {
      const w = this.typed, last = this.chain[this.chain.length - 1];
      if (w.length < 4) return;
      this.typed = '';
      if (!this.oneOff(w, last)) return this.flash('change exactly one letter');
      if (!this.dict.has(w)) return this.flash('not a word');
      this.chain.push(w);
      if (w === this.to) { const par = this.solution.length - 1, steps = this.chain.length - 1; this.score += Math.max(50, 300 - (steps - par) * 50); this.flash(steps <= par ? `Perfect · ${steps} steps` : `Done in ${steps} (par ${par})`, 2.2); this.done = 2.6; }
      else if (this.chain.length > 12) { this.flash(`Out of rungs: ${this.solution.join('→')}`, 3); this.done = 3.2; }
      return;
    }
    if (this.typed.length < 4) this.typed += k;
  }
  autopilot(dt) {
    if (this.done) return;
    if ((this.thinkT -= dt) > 0) return;
    const at = this.chain.length - 1, next = this.solution[at + 1];
    if (!next || this.chain[at] !== this.solution[at]) { this.key('back'); this.thinkT = 0.3; return; }
    if (this.typed.length < 4) { this.key(next[this.typed.length]); this.thinkT = this.r(0.12, 0.25); } else { this.key('enter'); this.thinkT = this.r(0.8, 1.6); }
  }
  tick(dt) { if (this.done && (this.done -= dt) <= 0) this.newRound(); }
  down(x, y) { const k = keyAt(this.keys, x, y); if (k) this.key(k); }
  paint(c) {
    const p = this.pal, tw = 30, x0 = (W - (tw * 4 + 18)) / 2;
    const row = (w, y, st, prev) => { for (let i = 0; i < 4; i++) tile(this, c, x0 + i * (tw + 6), y, tw, tw, w[i] || '', st === 'diff' ? (prev && prev[i] !== w[i] ? 'near' : 'miss') : st); };
    row(this.to, 60, 'hit');
    this.text(c, `${this.from.toUpperCase()} → ${this.to.toUpperCase()} · par ${this.solution.length - 1}`, W / 2, 102, 11, p.c[4]);
    const shown = this.chain.slice(-4), base = 116;
    shown.forEach((w, k) => row(w, base + k * 36, k === 0 && this.chain.length <= 5 ? 'sel' : 'diff', this.chain[this.chain.length - shown.length + k - 1]));
    if (!this.done) row(this.typed, base + shown.length * 36, 'empty');
    this.keys = keyboard(this, c, 322, {}, 28);
  }
  hud() { return `${this.score} · ladder`; }
}
