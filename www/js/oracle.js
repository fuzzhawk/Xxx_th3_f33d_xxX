// Oracle posts: dice, I Ching (three-coin method), augury with sacred chickens,
// haruspicy on a sheep's liver, and tarot with scans of old decks from Wikimedia
// Commons. Each cast is random; the canvas animates it and the reading appears below.
import { el } from './util.js';
import { img, ready, getTextures } from './games/assets.js';
import { themePalette } from './games/creature.js';
import { HEX, hexNumber, DECK, AUGURY, DICE3, QUESTIONS } from './oracle-data.js';
import { Haruspex } from './haruspex.js';

let tarotImgs = {};
export function setOracle(data) { tarotImgs = data?.tarot || {}; }

const W = 360, H = 300;
const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const LABEL = { dice: 'Dice', iching: 'I Ching', augury: 'Augury', haruspicy: 'Haruspicy', tarot: 'Tarot' };
export const oracleLabel = (sub) => LABEL[sub] || 'Oracle';

export function oracleMedia(p) {
  const canvas = el('canvas.oracle-cv');
  const reading = el('div.oracle-reading');
  const q = el('div.oracle-q', `“${p.question || pick(QUESTIONS)}”`);
  const btn = el('button.btn.primary', 'Cast');
  const media = el('div.media.oracle', canvas);
  const body = el('div.oracle-body', q, reading, el('div.btnrow', btn));
  const o = new Oracle(canvas, p, reading);
  const label = () => { btn.textContent = o.hx ? o.hx.label() : 'Cast again'; };
  if (o.hx) btn.textContent = 'Bring a beast';
  btn.onclick = (e) => { e.stopPropagation(); if (o.hx?.state === 'altar') o.hx.sacrifice(); else o.cast(); label(); };
  canvas.addEventListener('click', (e) => { if (!o.hx) return; const r = canvas.getBoundingClientRect(); if (o.hx.tap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H)) { e.stopPropagation(); label(); } });
  return { media, body, activate: () => { o.start(); if (!o.casts) { setTimeout(() => { if (o.running && !o.casts) { o.cast(); label(); } }, 700); } }, deactivate: () => o.stop() };
}

class Oracle {
  constructor(canvas, p, out) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.p = p; this.out = out;
    this.pal = themePalette((p.seed || 1) % 360, ['earth', 'rust', 'ink', 'sunset', 'duotone'][(p.seed >>> 4) % 5]);
    this.casts = 0; this.t = 0; this.anim = null; this.running = false; this.rnd = rnd;
    if (p.sub === 'haruspicy') this.hx = new Haruspex(this);
    this.tex = getTextures().filter(Boolean)[(p.seed || 0) % Math.max(1, getTextures().length)] || null;
  }
  start() {
    if (this.running) return;
    const dpr = Math.min(2, devicePixelRatio || 1), cw = this.c.clientWidth || 360;
    this.c.width = Math.round(cw * dpr); this.c.height = Math.round(cw * H / W * dpr); this.k = this.c.width / W;
    this.running = true; this.last = performance.now();
    const loop = (now) => { if (!this.running) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt; if (this.anim) this.anim.t += dt; this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  say(title, lines) { this.out.replaceChildren(el('b', title), ...lines.map((l) => el('p', l))); }
  cast() {
    this.casts++;
    const s = this.p.sub;
    this.out.replaceChildren(el('p.muted', 'Consulting…'));
    if (s === 'dice') {
      const dice = [1, 2, 3].map(() => 1 + Math.floor(rnd() * 6));
      this.anim = { t: 0, dice, seeds: dice.map(() => rnd()) };
      this.after(1.4, () => { const sum = dice.reduce((a, b) => a + b, 0); this.say(`${dice.join(' · ')} = ${sum}`, [DICE3[sum]]); });
    } else if (s === 'iching') {
      const tosses = Array.from({ length: 6 }, () => [0, 1, 2].map(() => (rnd() < 0.5 ? 3 : 2)));
      const vals = tosses.map((c) => c.reduce((a, b) => a + b, 0)); // 6 old yin, 7 young yang, 8 young yin, 9 old yang
      const lines = vals.map((v) => v % 2 === 1), moved = vals.map((v) => (v === 6 ? true : v === 9 ? false : v % 2 === 1));
      const n = hexNumber(lines), m = hexNumber(moved), changing = vals.map((v, i) => (v === 6 || v === 9 ? i + 1 : 0)).filter(Boolean);
      this.anim = { t: 0, tosses, vals, n, m: changing.length ? m : 0 };
      this.after(6 * 0.55 + 0.4, () => {
        const [py, en, gloss] = HEX[n];
        const lines2 = [gloss];
        if (changing.length) { const [py2, en2, g2] = HEX[m]; lines2.push(`Changing line${changing.length > 1 ? 's' : ''} ${changing.join(', ')}. It becomes ${m}. ${en2} (${py2}): ${g2}`); }
        this.say(`${n}. ${en} · ${py}`, lines2);
      });
    } else if (s === 'augury') {
      const r = rnd(), o = AUGURY[r < 0.18 ? 0 : r < 0.5 ? 1 : r < 0.75 ? 2 : r < 0.92 ? 3 : 4];
      const hens = Array.from({ length: 3 + Math.floor(rnd() * 3) }, (_, i) => ({ x: 70 + i * 55 + rnd() * 20, y: 200 + rnd() * 50, dir: rnd() < 0.5 ? -1 : 1, hue: [30, 15, 45, 0, 350][i % 5], ph: rnd() * 7 }));
      const grain = Array.from({ length: 70 }, () => ({ x: 60 + rnd() * 240, y: 190 + rnd() * 70, gone: false }));
      this.anim = { t: 0, o, hens, grain };
      this.after(4, () => this.say(o.title, [o.text]));
    } else if (s === 'haruspicy') {
      this.hx.bring();
    } else {
      const n = (this.p.spread || 1) === 3 ? 3 : 1, used = new Set();
      const cards = Array.from({ length: n }, () => { let c; do c = pick(DECK); while (used.has(c.id)); used.add(c.id); const imgs = tarotImgs[c.id] || []; return { c, rev: rnd() < 0.3, i: imgs.length ? img(pick(imgs)) : null }; });
      this.anim = { t: 0, cards };
      const pos = n === 3 ? ['Past', 'Present', 'Future'] : [''];
      this.after(0.9 + n * 0.6, () => this.say(cards.map((x) => `${x.c.name}${x.rev ? ' (reversed)' : ''}`).join(' · '), cards.map((x, k) => `${pos[k] ? `${pos[k]}: ` : ''}${x.c.name}${x.rev ? ', reversed' : ''} — ${x.rev ? x.c.rev : x.c.up}.`)));
    }
  }
  after(s, fn) { clearTimeout(this.timer); this.timer = setTimeout(fn, s * 1000); }

  draw() {
    const c = this.x, p = this.pal;
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    const g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 260); g.addColorStop(0, p.bg2); g.addColorStop(1, p.bg);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (ready(this.tex)) { c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.35; c.fillStyle = c.createPattern(this.tex, 'repeat'); c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    const s = this.p.sub, a = this.anim;
    if (this.hx) { if (!this.hx.draw(c)) this.idle(c); return; }
    if (!a) { this.idle(c); return; }
    if (s === 'dice') this.drawDice(c, a);
    else if (s === 'iching') this.drawIChing(c, a);
    else if (s === 'augury') this.drawAugury(c, a);
    else this.drawTarot(c, a);
  }
  idle(c) {
    c.fillStyle = this.pal.ink; c.globalAlpha = 0.6 + Math.sin(this.t * 2) * 0.2;
    c.font = '600 46px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText({ dice: '⚄', iching: '☯', augury: '𓅬', haruspicy: '⛤', tarot: '🂠' }[this.p.sub] || '✶', W / 2, H / 2 - 10);
    c.font = '600 13px ui-monospace, monospace'; c.fillText('tap Cast', W / 2, H / 2 + 40); c.globalAlpha = 1;
  }
  // ---- dice
  drawDice(c, a) {
    a.dice.forEach((v, i) => {
      const k = Math.min(1, a.t / (1 + i * 0.15)), e = 1 - (1 - k) ** 3, roll = k < 1;
      const x = 90 + i * 90 + (1 - e) * (a.seeds[i] * 200 - 160), y = 150 - Math.abs(Math.sin(e * Math.PI * 3)) * (1 - e) * 90;
      const face = roll ? 1 + Math.floor((this.t * 20 + i * 3) % 6) : v, rot = (1 - e) * (a.seeds[i] * 10 + 4);
      c.save(); c.translate(x, y); c.rotate(rot);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-26, -22, 56, 56);
      c.fillStyle = this.pal.ink; c.beginPath(); c.roundRect(-28, -28, 56, 56, 10); c.fill();
      c.strokeStyle = 'rgba(60,40,20,.35)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = this.pal.c[0];
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[face];
      for (const [px, py] of P) { c.beginPath(); c.arc(px * 14, py * 14, 5, 0, 7); c.fill(); }
      c.restore();
    });
  }
  // ---- I Ching
  drawIChing(c, a) {
    const per = 0.55, done = Math.min(6, Math.floor(a.t / per));
    const hx = (n, x0, alpha = 1, moving = null) => {
      for (let i = 0; i < 6; i++) {
        if (i >= done && n === a.n) continue;
        const v = a.vals[i], yang = n === a.n ? v % 2 === 1 : (v === 6 ? true : v === 9 ? false : v % 2 === 1);
        const y = 230 - i * 26;
        c.globalAlpha = alpha; c.fillStyle = moving && (v === 6 || v === 9) ? this.pal.c[0] : this.pal.ink;
        if (yang) c.fillRect(x0 - 60, y, 120, 13); else { c.fillRect(x0 - 60, y, 52, 13); c.fillRect(x0 + 8, y, 52, 13); }
        if (moving && (v === 6 || v === 9)) { c.strokeStyle = this.pal.c[0]; c.lineWidth = 2; c.beginPath(); c.arc(x0 + 76, y + 6, 5, 0, 7); c.stroke(); }
      }
      c.globalAlpha = 1;
    };
    const x0 = a.m && done >= 6 ? 110 : W / 2;
    hx(a.n, x0, 1, true);
    if (a.m && done >= 6) { const k = Math.min(1, (a.t - 6 * per) / 0.6); c.fillStyle = this.pal.ink; c.font = '20px serif'; c.textAlign = 'center'; c.fillText('→', W / 2 + 18, 160); hx(a.m, 270, k); }
    // coins for the current line
    if (done < 6) {
      const k = (a.t % per) / per;
      a.tosses[done].forEach((v, j) => {
        const x = W / 2 - 70 + j * 70, y = 40 + Math.sin(k * Math.PI) * -18 + 18, sq = Math.abs(Math.cos(k * 12 + j));
        c.fillStyle = this.pal.c[1]; c.beginPath(); c.ellipse(x, y, 20, 20 * (k > 0.8 ? 1 : sq), 0, 0, 7); c.fill();
        c.fillStyle = this.pal.bg; if (k > 0.8 || sq > 0.5) c.fillRect(x - 5, y - 5, 10, 10);
        if (k > 0.8) { c.fillStyle = this.pal.ink; c.font = '700 11px ui-monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(v === 3 ? '陽' : '陰', x, y + 22); }
      });
    }
    if (done >= 6) { c.fillStyle = this.pal.ink; c.font = '700 22px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${a.n}${a.m ? `  →  ${a.m}` : ''}`, W / 2, 34); }
  }
  // ---- augury
  drawAugury(c, a) {
    const o = a.o, t = a.t;
    c.fillStyle = this.pal.c[4]; c.globalAlpha = 0.35; c.fillRect(0, 180, W, H - 180); c.globalAlpha = 1;
    // coop
    c.fillStyle = this.pal.c[5]; c.fillRect(20, 120, 70, 70); c.fillStyle = this.pal.bg; c.fillRect(32, 140, 46, 50);
    c.strokeStyle = this.pal.ink; c.globalAlpha = 0.5; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(34 + i * 10, 140); c.lineTo(34 + i * 10, 190); c.stroke(); } c.globalAlpha = 1;
    // grain
    c.fillStyle = this.pal.c[1];
    for (const g of a.grain) if (!g.gone) c.fillRect(g.x, g.y, 2.5, 2);
    for (const [i, h] of a.hens.entries()) {
      const start = 0.3 + i * 0.25;
      let x = h.x, y = h.y, peck = 0;
      if (t < start) { x = 55; y = 175; }
      else if (o.flee) { const k = t - start; x = 55 + k * 120 * (i % 2 ? 1 : 0.7); y = 175 - k * 70 + Math.sin(k * 20) * 6; }
      else {
        const k = Math.min(1, (t - start) / 0.8); x = 55 + (h.x - 55) * k; y = 175 + (h.y - 175) * k;
        if (k >= 1 && o.eat > 0) { peck = Math.max(0, Math.sin((t + h.ph) * (6 + o.eat * 10))); if (peck > 0.95 && rnd() < o.eat * 0.5) { const g = a.grain.find((g) => !g.gone && Math.abs(g.x - x) < 30 && Math.abs(g.y - y) < 20); if (g) { g.gone = true; if (o.drop && rnd() < 0.6) a.grain.push({ x: x + h.dir * 14 + rnd() * 6, y: y + 6, gone: false }); } } }
        if (k >= 1 && o.eat === 0) h.dir = Math.sin(t * 2 + i) > 0 ? 1 : -1;
      }
      this.hen(c, x, y, h.dir, h.hue, peck, o.flee && t > start);
    }
  }
  hen(c, x, y, dir, hue, peck, flap) {
    c.save(); c.translate(x, y); c.scale(dir, 1);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 14, 14, 4, 0, 0, 7); c.fill();
    c.strokeStyle = '#d9a23a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, 6); c.lineTo(-4, 14); c.moveTo(3, 6); c.lineTo(4, 14); c.stroke();
    c.fillStyle = `hsl(${hue},45%,${hue === 0 ? 92 : 55}%)`; c.beginPath(); c.ellipse(0, 0, 15, 10, -0.2, 0, 7); c.fill();
    c.beginPath(); c.moveTo(-12, -3); c.lineTo(-22, -12); c.lineTo(-14, 2); c.fill(); // tail
    if (flap) { c.beginPath(); c.moveTo(-2, -4); c.lineTo(-10, -20 + Math.sin(this.t * 30) * 8); c.lineTo(6, -4); c.fill(); }
    const hy = -8 + peck * 14, hx = 12 + peck * 3;
    c.beginPath(); c.arc(hx, hy, 6, 0, 7); c.fill();
    c.fillStyle = '#c0392b'; c.beginPath(); c.arc(hx, hy - 6, 3, 0, 7); c.fill(); c.beginPath(); c.arc(hx + 2, hy + 6, 2, 0, 7); c.fill();
    c.fillStyle = '#e8b04a'; c.beginPath(); c.moveTo(hx + 5, hy - 1); c.lineTo(hx + 11, hy + 1); c.lineTo(hx + 5, hy + 3); c.fill();
    c.fillStyle = '#111'; c.fillRect(hx + 1, hy - 2, 2, 2);
    c.restore();
  }
  // ---- tarot
  drawTarot(c, a) {
    const n = a.cards.length, cw = n === 3 ? 96 : 150, ch = cw * 1.72, gap = 14, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2;
    a.cards.forEach((card, k) => {
      const tIn = 0.2 + k * 0.6, k1 = Math.min(1, Math.max(0, (a.t - tIn) / 0.35)), flip = Math.min(1, Math.max(0, (a.t - tIn - 0.35) / 0.35));
      const x = x0 + k * (cw + gap) + cw / 2, y = H / 2 + (1 - k1) * 200;
      const sx = Math.abs(Math.cos(flip * Math.PI)), front = flip > 0.5;
      c.save(); c.translate(x, y); c.scale(Math.max(0.02, sx), 1); if (front && card.rev) c.rotate(Math.PI);
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-cw / 2 + 4, -ch / 2 + 5, cw, ch);
      if (!front) {
        c.fillStyle = this.pal.c[3]; c.fillRect(-cw / 2, -ch / 2, cw, ch);
        c.strokeStyle = this.pal.c[1]; c.lineWidth = 2; c.strokeRect(-cw / 2 + 6, -ch / 2 + 6, cw - 12, ch - 12);
        c.fillStyle = this.pal.c[1]; c.font = `${cw * 0.3}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✶', 0, 0);
      } else if (ready(card.i)) {
        const iw = card.i.naturalWidth, ih = card.i.naturalHeight, s = Math.min(cw / iw, ch / ih);
        c.fillStyle = '#e9dcc0'; c.fillRect(-cw / 2, -ch / 2, cw, ch);
        c.drawImage(card.i, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
        c.fillStyle = 'rgba(80,50,20,.12)'; c.fillRect(-cw / 2, -ch / 2, cw, ch);
      } else this.cardFace(c, card.c, cw, ch);
      c.restore();
      if (front && n === 3) { c.fillStyle = this.pal.ink; c.font = '600 10px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText(['PAST', 'PRESENT', 'FUTURE'][k], x, H / 2 + ch / 2 + 12); }
    });
  }
  cardFace(c, card, cw, ch) {
    c.fillStyle = '#e9dcc0'; c.fillRect(-cw / 2, -ch / 2, cw, ch);
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; c.strokeRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10);
    c.fillStyle = '#3a2a1a'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const roman = (n) => { const r = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, l] of r) while (n >= v) { s += l; n -= v; } return s || '0'; };
    c.font = `700 ${cw * 0.13}px Georgia, serif`; c.fillText(card.major ? roman(card.num) : card.num, 0, -ch / 2 + 20);
    c.font = `${cw * 0.42}px serif`; c.fillText(card.major ? '☉☽★♄♃☿♀♂⚶⚷⚸'[card.num % 11] || '✶' : { W: '🜂', C: '🜄', S: '🜁', P: '🜃' }[card.suit], 0, 0);
    c.font = `600 ${cw * 0.09}px Georgia, serif`; c.fillText(card.name.toUpperCase(), 0, ch / 2 - 18);
  }
}
