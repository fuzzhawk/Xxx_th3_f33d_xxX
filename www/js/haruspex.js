// Haruspicy, done properly: a generated beast is led to the altar, you sacrifice
// it, and it goes off — the knife, a swelling, a burst of organs and gore flying
// in arcs, bouncing and splatting across the cloth. Where each organ lands is read:
// liver (with the sixteen houses of the Piacenza bronze), gall bladder, heart,
// lungs, stomach, the coils of gut, and whatever odd organ the creature carries.
// Tap any organ to read it.
import { monster, creatureName, item as trinket } from './games/creature.js';
import { LIVER, MARKS, CAPUT, EXTA } from './oracle-data.js';

const W = 360, H = 300, G = 900;
const pickW = (rnd, list) => { let x = rnd() * list.reduce((s, o) => s + (o.w ?? 1), 0); for (const o of list) { x -= o.w ?? 1; if (x <= 0) return o; } return list[0]; };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const rgb = (h) => { h = (h || '#888').replace('#', ''); if (h.length === 3) h = [...h].map((x) => x + x).join(''); const n = parseInt(h, 16) || 0; return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = (h, f) => { const t = f < 0 ? 0 : 255, k = Math.abs(f); return `rgb(${rgb(h).map((v) => Math.round(v + (t - v) * k)).join(',')})`; };
// where organs can land (the spread), and the foot of the cloth for the gut
const SLOTS = [[62, 92, 'upper left'], [180, 84, 'top centre'], [298, 92, 'upper right'], [84, 172, 'left'], [180, 168, 'the middle'], [276, 172, 'right']];
const REACH = { heart: [30, 26], lungs: [40, 36], liver: [62, 44], gall: [18, 14], stomach: [36, 22], gut: [120, 34], extra: [20, 20] };
const EXTRA = {
  ember: ['a still-glowing ember', 'A coal that has not gone out: an old hope is still warm. Blow on it gently.'],
  seed: ['a hard little seed', 'Something small is ready to be planted. Plant it this week, not next.'],
  'bean paste': ['a dollop of sweet bean paste', 'Comfort is nearer than you think. Accept the sweet thing offered.'],
  soot: ['a clot of soot', 'You are carrying old smoke. Open a window, or a conversation.'],
  'pollen sac': ['a bright pollen sac', 'You have been spreading yourself to the right flowers. Expect a small harvest.'],
  pearl: ['a pale pearl', 'Irritation is becoming something precious. Do not rush the polishing.'],
  nacre: ['a shard of rainbow nacre', 'Look at the problem from a second angle; the colour changes.'],
  'star pearl': ['a star pearl, faintly lit', 'A rare omen of luck, usually arriving sideways.'],
  'gizzard stones': ['a handful of gizzard stones', 'You can digest what others cannot. Take on the hard task.'],
  'silk gland': ['a coil of silk gland', 'Something is being spun for you. Wait for it to finish.'],
  acorn: ['a stored acorn', 'Savings, favours, patience: a store is being put by.'],
  'spirit core': ['a glowing spirit core', 'The creature’s true centre. Whatever you do next, do it with your whole self.']
};
const OK = { heart: 'normal', lungs: 'normal', gall: 'normal', stomach: 'normal', gut: 'normal' };

export class Haruspex {
  constructor(o) { this.o = o; this.state = 'empty'; this.P = []; this.bodies = []; this.shock = 0; this.flash = 0; this.shake = 0; }
  // a fresh beast on the altar
  bring() {
    const rnd = this.o.rnd, seed = Math.floor(rnd() * 2 ** 31), hue = Math.floor(rnd() * 360);
    const art = monster(seed, hue, 22 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 3));
    this.beast = { seed, hue, art, name: art.name || creatureName(seed), an: art.anatomy };
    this.state = 'altar'; this.t0 = this.o.t; this.picked = null; this.P = []; this.bodies = []; this.shock = this.flash = this.shake = 0;
    if (!this.stain) { this.stain = document.createElement('canvas'); this.stain.width = W * 2; this.stain.height = H * 2; }
    const sc = this.stain.getContext('2d'); sc.globalCompositeOperation = 'destination-out'; sc.fillStyle = 'rgba(0,0,0,.6)'; sc.fillRect(0, 0, W * 2, H * 2); sc.globalCompositeOperation = 'source-over';
    this.o.say(`${this.beast.name} is led to the altar`, [`${cap(art.species || 'beast')}${art.element ? `, of ${art.element}` : ''}. It seems calm. Tap the beast, or press Sacrifice.`]);
  }
  sacrifice() {
    if (this.state !== 'altar') return;
    const rnd = this.o.rnd;
    this.state = 'cut'; this.t0 = this.o.t; this.boomed = false; this.lastT = this.o.t;
    const caput = CAPUT[pickW(rnd, [{ i: 0, w: 55 }, { i: 1, w: 15 }, { i: 2, w: 20 }, { i: 3, w: 10 }]).i];
    const marks = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ region: Math.floor(rnd() * LIVER.length), mark: Math.floor(rnd() * MARKS.length), u: rnd(), v: rnd() }));
    const pick = (k) => pickW(rnd, EXTA[k].states);
    const odd = rnd() < 0.25; // strange beasts have strange insides
    this.ex = {
      caput, marks, liverHue: odd ? Math.floor(rnd() * 360) : 4, odd,
      heart: pick('heart'), lungs: pick('lungs'), gall: pick('gall'), stomach: pick('stomach'), gut: pick('gut'),
      coils: 3 + Math.floor(rnd() * 5), gutSeed: rnd(), trinket: trinket(Math.floor(rnd() * 1e6), Math.floor(rnd() * 360))
    };
    this.o.say('The knife falls', ['The beast swells, shudders and…']);
  }
  // the burst: organs launched on arcs to land in a random spread, gore everywhere
  boom() {
    const rnd = this.o.rnd, an = this.beast.an || { organs: [] }, e = this.ex, O = [W / 2, 165];
    this.boomed = true; this.bt = this.o.t; this.shock = 0.001; this.flash = 1; this.shake = 16;
    const slots = SLOTS.map((s) => s).sort(() => rnd() - 0.5), find = (kind) => an.organs.find((x) => x.kind === kind) || { col: '#c04050', size: 1 };
    const xo = an.organs.find((x) => !['heart', 'liver', 'lungs', 'stomach', 'gut', 'gall'].includes(x.kind));
    const list = ['heart', 'lungs', 'liver', 'gall', 'stomach'].map((k) => ({ k, ...find(k) }));
    if (xo) list.push({ k: 'extra', kind: xo.kind, col: xo.col, size: xo.size, glow: xo.glow });
    list.sort(() => rnd() - 0.5).forEach((b, i) => { const s = slots[i % slots.length]; b.tx = s[0] + (rnd() - 0.5) * 10; b.ty = s[1] + (rnd() - 0.5) * 8; b.where = s[2]; });
    const g = find('gut'); list.push({ k: 'gut', col: g.col, size: g.size, tx: W / 2 + (rnd() - 0.5) * 20, ty: 242, where: 'the foot of the cloth' });
    this.bodies = list.map((b) => {
      const missing = (b.k === 'heart' && e.heart.k === 'none') || (b.k === 'gut' && e.gut.k === 'none');
      const T = 0.85 + rnd() * 0.5, x0 = O[0] + (rnd() - 0.5) * 20, y0 = O[1] + (rnd() - 0.5) * 20;
      return { ...b, missing, T, tt: 0, x0, y0, x: missing ? b.tx : x0, y: missing ? b.ty : y0, vx: (b.tx - x0) / T, vy: (b.ty - y0) / T - 0.5 * G * T, rf: b.k === 'gut' ? (rnd() - 0.5) * 0.2 : (rnd() - 0.5) * 0.7, dir: rnd() < 0.5 ? -1 : 1, turns: 1 + Math.floor(rnd() * 2), bn: 0, rest: missing, sq: 0 };
    });
    const im = this.img(), half = (side) => ({ half: side, T: 1.05, tt: 0, x0: O[0], y0: O[1], tx: side < 0 ? 30 + rnd() * 10 : 330 - rnd() * 10, ty: 252 - rnd() * 8, rf: side * (1.1 + rnd() * 0.3), dir: -side, turns: 1, bn: 0, rest: false, sq: 0, x: O[0], y: O[1] });
    for (const h of [half(-1), half(1)]) { h.vx = (h.tx - h.x0) / h.T; h.vy = (h.ty - h.y0) / h.T - 0.5 * G * h.T; this.bodies.push(h); }
    this.bodies.sort((a, b) => (a.half ? 0 : 1) - (b.half ? 0 : 1));
    // gore
    const blood = an.blood || '#8a1018', spirit = !!an.spirit, bright = an.glow || blood;
    const add = (p) => { if (this.P.length < 320) this.P.push(p); };
    for (let i = 0; i < 70; i++) { const a = rnd() * 7, sp = 120 + rnd() * 420; add({ k: 'drop', x: O[0], y: O[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, r: 1.5 + rnd() * 3.5, col: spirit && rnd() < 0.5 ? bright : blood, glow: spirit, fy: 110 + rnd() * 160 }); }
    const parts = [an.flesh, an.hide, an.fur, an.flesh];
    for (let i = 0; i < 30; i++) { const a = rnd() * 7, sp = 140 + rnd() * 340; add({ k: 'chunk', x: O[0], y: O[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, r: 3 + rnd() * 4, col: parts[i % 4] || blood, rot: rnd() * 7, vr: (rnd() - 0.5) * 20, fy: 120 + rnd() * 150, bn: 0, glow: spirit }); }
    for (let i = 0; i < 7; i++) { const a = rnd() * 7, sp = 160 + rnd() * 260; add({ k: 'rope', x: O[0], y: O[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 220, r: 6 + rnd() * 5, col: find('gut').col, rot: rnd() * 7, vr: (rnd() - 0.5) * 14, fy: 130 + rnd() * 130, bn: 0 }); }
    if (spirit) for (let i = 0; i < 50; i++) { const a = rnd() * 7, sp = 40 + rnd() * 260; add({ k: 'spark', x: O[0], y: O[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, r: 1.5 + rnd() * 2.5, col: bright, life: 0.8 + rnd() * 1.2, age: 0 }); }
    this.o.say('It bursts!', [spirit ? `${this.beast.name} bleeds light, not blood.` : `${this.beast.name} is no more than a good deal of gore.`, 'The organs are still in the air…']);
  }
  img() { const a = this.beast.art; return a.big || a.frames[0]; }
  open() {
    this.state = 'open'; this.t0 = this.o.t;
    const e = this.ex, B = (k) => this.bodies.find((b) => b.k === k), lv = B('liver'), ht = B('heart'), an = this.beast.an || {};
    const near = (b) => this.bodies.filter((x) => x !== b && x.k && x.k !== 'gut').sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
    const name = (b) => (b.k === 'extra' ? EXTRA[b.kind]?.[0] || b.kind : b.k === 'gall' ? 'gall bladder' : b.k);
    const L = [`${cap(this.beast.name)} went off like a festival: ${this.bodies.filter((b) => b.k && !b.missing).length} organs scattered across the cloth.`];
    L.push(`Liver (${lv.where}): ${e.caput[1]}`);
    for (const m of e.marks) L.push(`${cap(MARKS[m.mark][0])} in the house of ${LIVER[m.region][0]} (${LIVER[m.region][1]}): ${MARKS[m.mark][1]}.`);
    L.push(ht.missing ? 'There was no heart to land anywhere.' : `Heart (${ht.where}): ${e.heart.s}. ${e.heart.r}`);
    if (near(lv) === ht) L.push('The liver fell hard against the heart: what you want and what you feel are leaning on each other.');
    const gl = B('gall'), st = B('stomach');
    if (near(gl) === st) L.push(`The gall bladder${e.gall.k === 'burst' ? ' burst' : ' came to rest'} beside the stomach: a bitter word will have to be swallowed.`);
    const side = (f) => this.bodies.filter((b) => b.k && b.k !== 'gut' && !b.missing && f(b.x) && (b.k === 'extra' || (e[b.k] && e[b.k].k !== OK[b.k]))).map((b) => `${name(b)} (${b.k === 'extra' ? 'a glowing oddity' : e[b.k].s})`);
    const left = side((x) => x < W / 2 - 30), right = side((x) => x > W / 2 + 30);
    if (left.length) L.push(`On the hostile left lay ${left.join(' and ')}: expect resistance from that quarter.`);
    if (right.length) L.push(`On the familiar right lay ${right.join(' and ')}: help comes from that quarter.`);
    const ex = B('extra');
    if (ex) L.push(`The creature’s own organ, ${name(ex)}, landed ${ex.where === 'the middle' ? 'in the middle' : ex.where}${an.spirit ? ' and gave off a faint light' : ''}.`);
    if (an.spirit) L.push('Spirit ichor stains the cloth. It will glow until morning; the omens of a spirit are not shy.');
    L.push('Tap an organ for its reading.');
    this.o.say(`The exta of ${this.beast.name}`, L);
  }
  look(b) { const s = b.size || 1; return s > 1.15 ? 'plump' : s < 0.9 ? 'shrunken' : 'average'; }
  tap(x, y) {
    if (this.state === 'altar') { this.sacrifice(); return true; }
    if (this.state === 'cut' || this.state === 'burst') return true;
    if (this.state !== 'open') return false;
    const b = [...this.bodies].reverse().find((g) => g.k && Math.abs(x - g.x) < REACH[g.k][0] * (g.size > 1.1 ? 1.1 : 1) && Math.abs(y - g.y) < REACH[g.k][1] && ((x - g.x) / REACH[g.k][0]) ** 2 + ((y - g.y) / REACH[g.k][1]) ** 2 <= 1.3);
    if (!b) return false;
    this.picked = b;
    const e = this.ex, an = this.beast.an || {}, tail = `It landed ${b.where}, ${b.k === 'gut' ? 'sprawled' : 'a ' + this.look(b) + ' thing'} ${an.spirit ? 'still glowing a little' : 'still wet'}.`;
    if (b.k === 'liver') this.o.say('Iecur — the liver', [e.caput[1], ...e.marks.map((m) => `${cap(MARKS[m.mark][0])} in the house of ${LIVER[m.region][0]}, ${LIVER[m.region][1]}: ${MARKS[m.mark][1]}.`), tail]);
    else if (b.k === 'extra') this.o.say(cap(EXTRA[b.kind]?.[0] || b.kind), [EXTRA[b.kind]?.[1] || 'Not in the books. Treat it as luck.', tail]);
    else { const st = e[b.k]; this.o.say(`${EXTA[b.k].name}: ${st.s}`, [st.r, b.missing ? 'Nothing landed here at all.' : tail]); }
    return true;
  }
  label() { return this.state === 'altar' ? 'Sacrifice' : this.state === 'empty' ? 'Bring a beast' : 'Another beast'; }

  // physics for the flying bodies and gore
  update(dt) {
    const rnd = this.o.rnd, an = this.beast.an || {}, spirit = !!an.spirit;
    for (let s = 0; s < 2; s++) {
      const h = dt / 2;
      for (const b of this.bodies) {
        if (b.rest) continue;
        b.tt += h; b.vy += G * h; b.x += b.vx * h; b.y += b.vy * h; b.sq *= Math.exp(-9 * h);
        const q = Math.min(1, b.tt / b.T); b.rot = b.rf + b.dir * Math.PI * 2 * b.turns * (1 - q) * (b.bn ? 0 : 1);
        if (!b.bn && rnd() < 0.5) this.P.push({ k: 'drop', x: b.x, y: b.y, vx: (rnd() - 0.5) * 60, vy: rnd() * 30, r: 1 + rnd() * 2, col: an.blood || '#8a1018', glow: spirit, fy: b.ty + rnd() * 14 });
        if (b.y >= b.ty && b.vy > 0) {
          this.splat(b.x, b.ty + (b.half ? 0 : 6), b.half ? 14 : 12, b.k === 'extra' ? b.col : an.blood || '#8a1018', spirit);
          if (Math.abs(b.vy) < 90 || b.bn >= 2) { b.rest = true; b.x = b.tx; b.y = b.ty; b.rot = b.rf; } else { b.vy *= -0.38; b.vx *= 0.3; b.bn++; b.sq = 1; b.y = b.ty; this.shake = Math.max(this.shake, 5); }
        }
      }
      for (const p of this.P) {
        if (p.k === 'spark') { p.age += h; p.vy += G * 0.12 * h; p.x += p.vx * h; p.y += p.vy * h; p.vx *= 0.99; continue; }
        p.vy += G * h; p.x += p.vx * h; p.y += p.vy * h;
        if (p.rot !== undefined) p.rot += p.vr * h;
        if (p.y >= p.fy && p.vy > 0) {
          if (p.k === 'drop') { this.splat(p.x, p.fy, p.r * (0.8 + rnd() * 1.0), p.col, p.glow); p.dead = true; }
          else if (++p.bn > 2) { this.stamp(p); p.dead = true; } else { p.y = p.fy; p.vy *= -0.45; p.vx *= 0.6; p.vr *= 0.5; this.splat(p.x, p.fy, 3, an.blood || '#8a1018', spirit); }
        }
      }
    }
    this.P = this.P.filter((p) => !p.dead && !(p.k === 'spark' && p.age > p.life) && p.x > -40 && p.x < W + 40);
    this.shake *= Math.exp(-6 * dt); this.flash *= Math.exp(-7 * dt);
    if (this.shock) { this.shock += dt; if (this.shock > 0.9) this.shock = 0; }
  }
  splat(x, y, r, col, glow) {
    const sc = this.stain.getContext('2d'), rnd = this.o.rnd;
    sc.save(); sc.scale(2, 2); sc.globalAlpha = 0.7;
    if (glow) { sc.shadowColor = col; sc.shadowBlur = 8; }
    sc.fillStyle = col; sc.beginPath(); sc.ellipse(x, y, r * 1.4, r * 0.7, 0, 0, 7); sc.fill();
    for (let i = 0; i < 2 + (r > 5 ? 4 : 0); i++) { const a = rnd() * 7, d = r * (1.2 + rnd() * 1.6); sc.beginPath(); sc.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5, 1 + rnd() * r * 0.3, (1 + rnd() * r * 0.3) * 0.6, 0, 0, 7); sc.fill(); }
    sc.restore();
  }
  stamp(p) { const sc = this.stain.getContext('2d'); sc.save(); sc.scale(2, 2); sc.translate(p.x, p.fy); sc.rotate(p.rot); sc.fillStyle = p.col; if (p.k === 'rope') { sc.lineCap = 'round'; sc.strokeStyle = p.col; sc.lineWidth = 4; sc.beginPath(); sc.moveTo(-p.r, 0); sc.lineTo(p.r, 0); sc.stroke(); } else sc.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.7); sc.restore(); }

  draw(c) {
    const t = this.o.t - (this.t0 || 0), p = this.o.pal;
    if (this.state === 'empty') return false;
    const dt = Math.min(0.05, this.o.t - (this.lastT ?? this.o.t)); this.lastT = this.o.t;
    if (this.state === 'cut' && t > 0.7 && !this.boomed) { this.boom(); this.state = 'burst'; }
    if (this.state === 'burst') { this.update(dt); if (this.o.t - this.bt > 1.6 && this.bodies.every((b) => b.rest)) this.open(); }
    else if (this.state === 'open') this.update(dt);
    c.save();
    if (this.shake > 0.3) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    // the cloth on the altar, candles either side
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(20, 52, 320, 232);
    c.fillStyle = '#d6c9aa'; c.fillRect(24, 44, 312, 228);
    c.fillStyle = 'rgba(255,250,235,.25)'; for (let i = 0; i < 8; i++) c.fillRect(24, 44 + i * 29, 312, 1);
    c.strokeStyle = p.c[5]; c.lineWidth = 5; c.strokeRect(34, 54, 292, 208);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(24, 272, 312, 6);
    c.drawImage(this.stain, 0, 0, W, H);
    const cand = this.state === 'altar' || this.state === 'cut' ? [40, 320] : [];
    for (const cx of cand) { c.fillStyle = '#e8dcc0'; c.fillRect(cx - 5, 170, 10, 40); c.fillStyle = `rgba(255,${180 + Math.sin(this.o.t * 9 + cx) * 40},80,.9)`; c.beginPath(); c.ellipse(cx, 164 + Math.sin(this.o.t * 7 + cx) * 1.5, 4, 8, 0, 0, 7); c.fill(); }
    if (this.state === 'altar' || this.state === 'cut') this.drawBeast(c, t);
    else this.drawSpread(c, t);
    c.restore();
    if (this.flash > 0.02) { c.fillStyle = `rgba(255,255,255,${Math.min(0.8, this.flash)})`; c.fillRect(0, 0, W, H); }
    c.fillStyle = p.ink; c.font = '600 12px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (this.state === 'open' && t < 3.5) { c.globalAlpha = Math.min(1, 3.5 - t); c.font = '600 11px ui-monospace, monospace'; c.fillText('tap an organ', W / 2, 288); c.globalAlpha = 1; }
    else if (this.state !== 'open') c.fillText(this.beast.name.toUpperCase(), W / 2, 288);
    return true;
  }
  drawBeast(c, t) {
    const im = this.img(), an = this.beast.an || {}, d = 150, cx = W / 2, cy = 135;
    c.imageSmoothingEnabled = true;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(cx, 212, 62, 9, 0, 0, 7); c.fill();
    if (this.state === 'altar') { c.drawImage(im, cx - d / 2, cy - d / 2 + Math.sin(this.o.t * 3) * 2, d, d); return; }
    // the knife falls, then the beast swells and shudders
    const k = Math.min(1, t / 0.35), sw = Math.max(0, t - 0.35) / 0.35, j = sw * 4;
    c.save(); c.translate(cx + (Math.random() - 0.5) * j, cy + (Math.random() - 0.5) * j); c.scale(1 + sw * 0.18, 1 - sw * 0.08 + Math.sin(t * 60) * 0.02 * sw);
    c.drawImage(im, -d / 2, -d / 2, d, d);
    if (t > 0.3) { c.strokeStyle = an.spirit ? an.glow || '#fff' : '#7a0c10'; c.lineWidth = 2 + sw * 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -d / 2); for (let y = -d / 2; y < d / 2; y += 14) c.lineTo(((y / 14) & 1 ? 4 : -4) * (1 + sw), y); c.stroke(); }
    c.restore();
    if (k < 1) { c.save(); c.translate(cx + 40, 20 + k * 130); c.rotate(-0.6); c.fillStyle = '#d8d4cc'; c.beginPath(); c.moveTo(0, 0); c.lineTo(60, -8); c.lineTo(60, 6); c.closePath(); c.fill(); c.fillStyle = '#4a2a14'; c.fillRect(-26, -5, 26, 10); c.restore(); }
    if (t > 0.34 && t < 0.4) { c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(0, 0, W, H); }
  }
  drawSpread(c, t) {
    const an = this.beast.an || {}, im = this.img(), iw = im.width, ih = im.height;
    const ord = [...this.bodies].sort((a, b) => (b.half ? 1 : 0) - (a.half ? 1 : 0) || (a.k === 'gut' ? -1 : 0) - (b.k === 'gut' ? -1 : 0) || a.y - b.y);
    for (const b of ord) {
      c.save(); c.translate(b.x, b.y); c.rotate(b.rot || 0);
      if (b.half) {
        const q = b.rest ? 1 : Math.min(1, b.tt / b.T), sc = 0.94 - 0.54 * q, sx = b.half < 0 ? 0 : iw / 2;
        const u = 150 / iw * sc, w = iw / 2 * u, h = ih * u;
        c.scale(1 + b.sq * 0.2, 1 - b.sq * 0.2); c.drawImage(im, sx, 0, iw / 2, ih, -w / 2, -h / 2, w, h);
        c.fillStyle = an.flesh || '#c04050'; c.fillRect(b.half < 0 ? w / 2 - 3 : -w / 2 - 3, -h / 2, 6, h);
      } else if (b.missing) { c.strokeStyle = 'rgba(80,30,20,.45)'; c.setLineDash([3, 3]); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.stroke(); c.setLineDash([]); }
      else { c.scale(1 + b.sq * 0.3, 1 - b.sq * 0.3); const lit = this.picked === b; if (lit) { c.shadowColor = 'rgba(255,200,120,.95)'; c.shadowBlur = 16; } else if (an.spirit || b.glow) { c.shadowColor = an.glow || b.col; c.shadowBlur = 8 + Math.sin(this.o.t * 4) * 3; } this.organ(c, b, t); }
      c.restore();
    }
    // gore in the air
    for (const p of this.P) {
      if (p.k === 'spark') { const a = 1 - p.age / p.life; c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * (0.6 + 0.4 * Math.sin(p.age * 40)); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; continue; }
      c.fillStyle = p.col; c.strokeStyle = p.col;
      if (p.glow) { c.shadowColor = p.col; c.shadowBlur = 6; }
      if (p.k === 'drop') { const sp = Math.hypot(p.vx, p.vy); c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx)); c.beginPath(); c.ellipse(0, 0, p.r + sp * 0.012, p.r, 0, 0, 7); c.fill(); c.restore(); }
      else if (p.k === 'rope') { c.lineCap = 'round'; c.lineWidth = 4; c.beginPath(); c.moveTo(p.x - Math.cos(p.rot) * p.r, p.y - Math.sin(p.rot) * p.r); c.lineTo(p.x + Math.cos(p.rot) * p.r, p.y + Math.sin(p.rot) * p.r); c.stroke(); }
      else { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.7); c.restore(); }
      c.shadowBlur = 0;
    }
    if (this.shock) { const q = this.shock / 0.9; c.strokeStyle = `rgba(255,${an.spirit ? 240 : 220},200,${(1 - q) * 0.8})`; c.lineWidth = 8 * (1 - q) + 1; c.beginPath(); c.ellipse(W / 2, 165, q * 260, q * 200, 0, 0, 7); c.stroke(); }
  }
  // one organ at its own origin, in the creature's own colours
  organ(c, b, t) {
    const e = this.ex, sz = Math.max(0.75, Math.min(1.25, b.size || 1)), st = e[b.k] || {}, col = b.col;
    c.save(); c.scale(sz, sz);
    if (b.k === 'heart') {
      const beat = 1 + Math.max(0, Math.sin(this.o.t * 7)) * 0.1 * Math.max(0, 1 - t / 6);
      for (const dx of st.k === 'two' ? [-14, 14] : [0]) {
        const hs = (st.k === 'small' ? 0.55 : st.k === 'huge' ? 1.3 : 0.9) * beat * (st.k === 'two' ? 0.75 : 1);
        c.save(); c.translate(dx, 0); c.scale(hs, hs); const f = st.k === 'stone' ? '#8a8478' : col;
        c.fillStyle = f; c.beginPath(); c.moveTo(0, 18); c.bezierCurveTo(-26, 0, -18, -20, 0, -8); c.bezierCurveTo(18, -20, 26, 0, 0, 18); c.fill();
        c.shadowBlur = 0; c.strokeStyle = shade(f, -0.5); c.lineWidth = 3; c.beginPath(); c.moveTo(-4, -10); c.lineTo(-6, -22); c.moveTo(4, -10); c.lineTo(8, -20); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-8, -2, 4, 7, 0.5, 0, 7); c.fill(); c.restore();
      }
    } else if (b.k === 'lungs') {
      const lc = st.k === 'black' ? '#3a2e30' : st.k === 'gills' ? '#6aa0a0' : col;
      for (const dx of st.k === 'one' ? [-1] : [-1, 1]) {
        c.save(); c.translate(dx * 17, 0); c.rotate(dx * 0.25); c.fillStyle = lc; c.beginPath(); c.ellipse(0, 0, 16, 26, 0, 0, 7); c.fill(); c.shadowBlur = 0;
        c.strokeStyle = shade(lc, -0.3); c.lineWidth = 1.5; c.beginPath(); c.moveTo(-dx * 8, -20); c.lineTo(0, 4); c.moveTo(0, 4); c.lineTo(dx * 5, 18); c.stroke();
        if (st.k === 'spotted') { c.fillStyle = '#5a1a1a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(Math.cos(i * 2.3) * 8, Math.sin(i * 1.7) * 14, 2.5, 0, 7); c.fill(); } }
        if (st.k === 'gills') { c.strokeStyle = '#2a5050'; c.lineWidth = 2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-9, i * 8); c.lineTo(9, i * 8); c.stroke(); } }
        c.restore();
      }
    } else if (b.k === 'liver') { this.liverCol = col; this.liver(c, 0, 0, 0.46, false); }
    else if (b.k === 'gall') {
      const gs = st.k === 'swollen' ? 1.6 : st.k === 'tiny' ? 0.5 : 1;
      c.fillStyle = st.k === 'burst' ? shade(col, -0.3) : col; c.beginPath(); c.ellipse(0, 0, 11 * gs, 8 * gs, 0.4, 0, 7); c.fill(); c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-3 * gs, -2 * gs, 3 * gs, 2 * gs, 0.4, 0, 7); c.fill();
      if (st.k === 'burst') { c.fillStyle = 'rgba(120,160,40,.7)'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(Math.cos(i) * 18, Math.sin(i * 2) * 10, 3, 0, 7); c.fill(); } }
    } else if (b.k === 'stomach') {
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 34, 20, -0.25, 0, 7); c.fill(); c.shadowBlur = 0;
      c.strokeStyle = 'rgba(90,30,30,.5)'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 23, 11, -0.25, 0, 3); c.stroke();
      if (st.k === 'trinket') { c.imageSmoothingEnabled = false; c.drawImage(e.trinket, -11, -11, 22, 22); c.imageSmoothingEnabled = true; }
      if (st.k === 'grain') { c.fillStyle = '#e0b860'; for (let i = 0; i < 14; i++) c.fillRect(-20 + (i * 7) % 40, -6 + (i * 5) % 14, 3, 2); }
    } else if (b.k === 'gut') {
      const n = e.coils * 14, pts = [];
      for (let i = 0; i <= n; i++) { const u = i / n, a = u * e.coils * Math.PI * 2, r = 14 + 10 * Math.sin(u * 11 + e.gutSeed * 9); pts.push([(u - 0.5) * 236 * 0.95 + Math.sin(a) * r * 1.2, Math.cos(a * 1.3 + e.gutSeed * 6) * r * 0.9 + Math.sin(u * 7 + e.gutSeed) * 6]); }
      const blk = st.k === 'black';
      for (const [w, cl] of [[14, blk ? '#2a1e1a' : shade(col, -0.3)], [9, blk ? '#3d2c26' : col], [3, 'rgba(255,240,240,.4)']]) { c.strokeStyle = cl; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.shadowBlur = 0; }
      if (st.k === 'knot') { c.strokeStyle = '#7a2a30'; c.lineWidth = 6; c.beginPath(); c.arc(pts[n >> 1][0], pts[n >> 1][1], 10, 0, 6); c.stroke(); }
    } else {
      const kd = b.kind, r = 10;
      c.fillStyle = col; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(-3, -3, 3, 0, 7); c.fill();
      if (kd === 'ember') { c.fillStyle = 'rgba(255,240,160,.8)'; c.beginPath(); c.arc(0, 0, 5 + Math.sin(this.o.t * 9), 0, 7); c.fill(); }
      else if (kd === 'seed') { c.strokeStyle = '#4a8a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(4, -r - 8, 8, -r - 6); c.stroke(); }
      else if (kd === 'pollen sac') { c.fillStyle = '#fff6a0'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Math.cos(i * 2) * 14, Math.sin(i * 3) * 14, 1.5, 0, 7); c.fill(); } }
      else if (kd === 'nacre') { const g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, 'rgba(255,180,220,.6)'); g.addColorStop(0.5, 'rgba(160,255,230,.5)'); g.addColorStop(1, 'rgba(180,170,255,.6)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); }
      else if (kd === 'star pearl' || kd === 'spirit core') { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, r + 4 + Math.sin(this.o.t * 5) * 2, 0, 7); c.stroke(); }
      else if (kd === 'soot') { c.fillStyle = col; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(Math.cos(i) * 11, Math.sin(i) * 11, 3, 0, 7); c.fill(); } }
      else if (kd === 'gizzard stones') { c.fillStyle = '#8a8478'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(Math.cos(i * 1.6) * 8, Math.sin(i * 1.6) * 8, 4, 0, 7); c.fill(); } }
    }
    c.restore();
  }
  liver(c, cx, cy, s, lit) {
    const e = this.ex;
    c.save(); c.translate(cx, cy); c.scale(s, s);
    const shape = () => { c.beginPath(); c.moveTo(-130, -10); c.bezierCurveTo(-120, -90, -10, -100, 20, -70); c.bezierCurveTo(70, -105, 140, -60, 130, 10); c.bezierCurveTo(120, 80, 20, 95, -30, 75); c.bezierCurveTo(-90, 90, -140, 50, -130, -10); c.closePath(); };
    if (lit) { c.shadowColor = 'rgba(255,200,120,.9)'; c.shadowBlur = 24; }
    shape();
    const lc = this.liverCol, g = c.createRadialGradient(-30, -30, 10, 0, 0, 160); if (e.odd || !lc) { g.addColorStop(0, `hsl(${e.liverHue},50%,42%)`); g.addColorStop(1, `hsl(${e.liverHue},60%,17%)`); } else { g.addColorStop(0, shade(lc, 0.15)); g.addColorStop(1, shade(lc, -0.45)); }
    c.fillStyle = g; c.fill(); c.shadowBlur = 0;
    c.save(); shape(); c.clip();
    c.strokeStyle = 'rgba(255,220,200,.25)'; c.lineWidth = 2;
    for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(an) * 50, Math.sin(an) * 34); c.lineTo(Math.cos(an) * 200, Math.sin(an) * 140); c.stroke(); }
    c.beginPath(); c.ellipse(0, 0, 50, 34, 0, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,240,220,.6)'; c.font = '600 19px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    LIVER.forEach(([name], i) => { const an = ((i + 0.5) / 16) * Math.PI * 2; c.fillText(name, Math.cos(an) * 95, Math.sin(an) * 64); });
    for (const m of e.marks) {
      const an = ((m.region + 0.3 + m.u * 0.4) / 16) * Math.PI * 2, r = 0.55 + m.v * 0.35, x = Math.cos(an) * 110 * r, y = Math.sin(an) * 75 * r, k = m.mark;
      c.fillStyle = ['rgba(255,235,200,.75)', 'rgba(20,0,0,.8)', 'rgba(200,90,70,.9)', 'rgba(20,0,0,.8)', 'rgba(255,255,255,.5)', 'rgba(60,10,10,.7)', 'rgba(120,20,60,.9)', 'rgba(240,230,200,.9)'][k];
      if (k === 3 || k === 6) { c.strokeStyle = c.fillStyle; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 18, y - 6); c.quadraticCurveTo(x, y + 10, x + 20, y - 4); c.stroke(); }
      else { c.beginPath(); c.arc(x, y, k === 2 ? 16 : 9, 0, 7); c.fill(); }
    }
    c.restore();
    if (e.caput[2] > -2) { const sz = e.caput[2] === 0 ? 0.6 : 1; for (let d = 0; d < (e.caput[2] === 2 ? 2 : 1); d++) { c.fillStyle = `hsl(${e.liverHue},50%,28%)`; c.beginPath(); c.moveTo(20 + d * 40, -70); c.lineTo(38 + d * 40, -70 - 50 * sz); c.lineTo(58 + d * 40, -66); c.fill(); } }
    c.restore();
  }
}
