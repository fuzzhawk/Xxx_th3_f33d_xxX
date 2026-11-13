// Oracle posts: dice, I Ching (three-coin method), haruspicy on a sheep's liver, tarot with scans of old decks from Wikimedia
// Commons, and chaos magic (chaos.js). Each cast is random; the canvas animates it and the
// reading appears below: what fell, how it bears on the question, and something to do.
import { el, toast } from './util.js';
import { img, ready, getTextures } from './games/assets.js';
import { themePalette } from './games/creature.js';
import { HEX, TRI, hexNumber, DECK, SUITS, DICE3, QUESTIONS, VERDICT, ADVICE, LENS, DIE_ROLE, qKind, verdictOf, cardTone, hexTone } from './oracle-data.js';
import { CHAOS, CTA, castChaos, drawChaos, chaosUI } from './chaos.js';
import { Haruspex } from './haruspex.js';
import { rollCharacter, sheet, sheetText, drawCharacter, saveAsHero } from './dnd.js';

let tarotImgs = {};
export function setOracle(data) { tarotImgs = data?.tarot || {}; }

const W = 360, H = 300;
const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const LABEL = { dice: 'Dice', die: 'One die', iching: 'I Ching', haruspicy: 'Haruspicy', tarot: 'Tarot', dnd: 'Character', sigil: 'Sigil', paradigm: 'Paradigm shift', ritual: 'Random ritual' };
const D20 = ['A natural 1. Stay in bed; the universe has your number.', 'Something will break. Let it be something cheap.', 'A detour, then a worse detour.', 'Ask for help before you need it.', 'Proceed with snacks and caution.', 'Middling luck. Bring a towel.', 'An old friend, or an old debt, comes calling.', 'Fine, if you keep it small.', 'The answer is in your pocket.', 'A coin flip in a trench coat.', 'Slightly in your favour.', 'Someone is rooting for you quietly.', 'Unlucky number, lucky result.', 'Yes, but read the small print.', 'The door is unlocked. Push.', 'Momentum is on your side.', 'Go now, before you think about it.', 'Strong yes. Dress for it.', 'Nearly perfect. Take it.', 'A natural 20. Whatever it is: do it, and narrate it out loud.'];
const dieLine = (n, v) => (n === 20 ? D20[v - 1] : v === 1 ? 'The lowest face. Retreat and regroup.' : v === n ? 'The highest face. Fortune is loud today.' : v / n < 0.34 ? 'Low. Keep expectations modest.' : v / n < 0.67 ? 'Middling. It depends on you, annoyingly.' : 'High. The odds lean your way.');
function download(name, text) { const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
// the closing lines of a reading: how the omen bears on the question, and something concrete to do
function wrap(src, q, score, facts) {
  const v = verdictOf(score);
  return [...facts, `Asked “${q}”, ${src} ${pick(VERDICT[v])}.`, `Do this: ${pick(ADVICE[v])}`];
}
export const oracleLabel = (sub) => LABEL[sub] || 'Oracle';

export function oracleMedia(p) {
  // the chicken augury is gone: an old package's augury post is read as dice
  if (p.sub === 'augury') p = { ...p, sub: 'dice' };
  const canvas = el('canvas.oracle-cv');
  const reading = el('div.oracle-reading');
  let question = p.question || pick(QUESTIONS);
  const qt = el('span', `“${question}”`);
  const q = el('div.oracle-q', qt, el('button.qshuffle', { type: 'button', 'aria-label': 'Ask another question', title: 'Another question', onclick: (e) => { e.stopPropagation(); question = pick(QUESTIONS); qt.textContent = `“${question}”`; o.question = question; } }, '↻'));
  const chaos = CHAOS.includes(p.sub);
  const btn = el('button.btn.primary', CTA[p.sub]?.[0] || 'Cast');
  const media = el('div.media.oracle', canvas);
  const row = el('div.btnrow', btn);
  const o = new Oracle(canvas, p, reading); o.question = question;
  const cx = chaos ? chaosUI(o, p) : null;
  if (cx) row.append(...cx.btns);
  const body = el('div.oracle-body', p.sub === 'dnd' || p.sub === 'sigil' ? null : q, cx?.top, reading, row);
  if (p.sub === 'die') { btn.remove(); for (const n of [4, 6, 8, 10, 12, 20, 100]) row.append(el('button.btn', { onclick: (e) => { e.stopPropagation(); o.sides = n; o.cast(); } }, `d${n}`)); }
  if (p.sub === 'dnd') { btn.textContent = 'Roll a character'; row.append(el('button.btn', { onclick: (e) => { e.stopPropagation(); if (o.ch) download(`${o.ch.name.replace(/\W+/g, '_')}.txt`, sheetText(o.ch)); } }, 'Save sheet'), el('button.btn', { onclick: (e) => { e.stopPropagation(); if (!o.ch) { toast('Roll a character first'); return; } saveAsHero(o.ch); toast(`${o.ch.name} is your hero now`); } }, 'Make my hero')); }
  const label = () => { btn.textContent = o.hx ? o.hx.label() : p.sub === 'dnd' ? 'Roll another' : CTA[p.sub]?.[1] || 'Cast again'; };
  o.onCast = label;
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
    const loop = (now) => { if (!this.running) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt; this.dt = dt; if (this.anim) this.anim.t += dt; this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  say(title, lines) { this.out.replaceChildren(el('b', title), ...lines.map((l) => el('p', l))); }
  cast() {
    this.casts++;
    const s = this.p.sub;
    this.out.replaceChildren(el('p.muted', 'Consulting…'));
    if (s === 'die') {
      const n = this.sides || 20, v = 1 + Math.floor(rnd() * n);
      this.anim = { t: 0, n, v, spin: rnd() * 7 };
      const q = this.question, tone = (v / n - 0.5) * 4, ex = v === n ? ' The highest face there is.' : v === 1 ? ' The lowest face there is.' : '';
      this.after(1.1, () => this.say(`d${n}: ${v}`, wrap(`the d${n}`, q, tone, [`${dieLine(n, v)}${ex}`, `${LENS[qKind(q)]}, a ${v} on a die of ${n} sits at ${Math.round(v / n * 100)}% of the way up the scale: ${v / n > 0.66 ? 'closer to the ceiling than the floor' : v / n > 0.33 ? 'in the awkward middle, where it is up to you' : 'nearer the floor than you would like'}.`])));
    } else if (s === 'dnd') {
      const ch = rollCharacter(rnd); this.ch = ch;
      this.anim = { t: 0, ch };
      this.after(2, () => this.out.replaceChildren(sheet(ch)));
    } else if (s === 'dice') {
      const dice = [1, 2, 3].map(() => 1 + Math.floor(rnd() * 6));
      this.anim = { t: 0, dice, seeds: dice.map(() => rnd()) };
      const q = this.question;
      this.after(1.4, () => {
        const sum = dice.reduce((a, b) => a + b, 0), same = new Set(dice).size;
        const roles = DIE_ROLE.map(([who, ph], i) => `${who} ${ph[dice[i] - 1]} (${dice[i]})`).join('; ');
        const echo = same === 1 ? ' Triples: the omen is shouting.' : same === 2 ? ' A pair: something repeats, so look for the pattern.' : '';
        this.say(`${dice.join(' · ')} = ${sum}`, wrap('the dice', q, (sum - 10.5) / 3, [DICE3[sum], `Read as you, the others and luck: ${roles}.${echo}`]));
      });
    } else if (s === 'iching') {
      const tosses = Array.from({ length: 6 }, () => [0, 1, 2].map(() => (rnd() < 0.5 ? 3 : 2)));
      const vals = tosses.map((c) => c.reduce((a, b) => a + b, 0)); // 6 old yin, 7 young yang, 8 young yin, 9 old yang
      const lines = vals.map((v) => v % 2 === 1), moved = vals.map((v) => (v === 6 ? true : v === 9 ? false : v % 2 === 1));
      const n = hexNumber(lines), m = hexNumber(moved), changing = vals.map((v, i) => (v === 6 || v === 9 ? i + 1 : 0)).filter(Boolean);
      this.anim = { t: 0, tosses, vals, n, m: changing.length ? m : 0 };
      this.after(6 * 0.55 + 0.4, () => {
        const [py, en, gloss] = HEX[n], q = this.question, tri = (a) => TRI.find((t) => t.bits === (a[0] ? 1 : 0) + (a[1] ? 2 : 0) + (a[2] ? 4 : 0));
        const lo = tri(lines.slice(0, 3)), up = tri(lines.slice(3));
        const facts = [`${gloss}`, `The image is ${up.name} ${lo.glyph === up.glyph ? 'doubled' : `over ${lo.name}`}: ${up.glyph}${lo.glyph}.`];
        let score = hexTone(n);
        if (changing.length) { const [py2, en2, g2] = HEX[m]; score = (score + hexTone(m)) / 2; facts.push(`Line${changing.length > 1 ? 's' : ''} ${changing.join(' and ')} ${changing.length > 1 ? 'are' : 'is'} changing, so the situation is not settled: it is moving towards ${m}. ${en2} (${py2}). ${g2}`); }
        else facts.push('No line is changing, so the picture is stable: this is how things stand, not where they are heading.');
        facts.push(`${LENS[qKind(q)]}, the hexagram’s advice is its first sentence: ${gloss.split('. ')[0].replace(/\.$/, '')}.`);
        this.say(`${n}. ${en} · ${py}`, wrap('the hexagram', q, score, facts));
      });
    } else if (CHAOS.includes(s)) {
      const r = castChaos(s, this); this.anim = r.anim;
      this.after(r.delay, () => this.say(r.title, r.lines));
    } else if (s === 'haruspicy') {
      this.hx.bring();
    } else {
      const n = (this.p.spread || 1) === 3 ? 3 : 1, used = new Set();
      const cards = Array.from({ length: n }, () => { let c; do c = pick(DECK); while (used.has(c.id)); used.add(c.id); const imgs = tarotImgs[c.id] || []; return { c, rev: rnd() < 0.3, i: imgs.length ? img(pick(imgs)) : null }; });
      this.anim = { t: 0, cards };
      const pos = n === 3 ? ['Past', 'Present', 'Future'] : [''];
      const q = this.question, wts = n === 3 ? [0.5, 0.8, 1.2] : [1.5], score = cards.reduce((a, x, k) => a + cardTone(x.c) * (x.rev ? -0.5 : 1) * wts[k], 0) / (n === 3 ? 1.5 : 1);
      const mean = (x) => (x.rev ? x.c.rev : x.c.up);
      this.after(0.9 + n * 0.6, () => {
        const facts = cards.map((x, k) => `${pos[k] ? `${pos[k]}: ` : ''}${x.c.name}${x.rev ? ', reversed' : ''} — ${mean(x)}. ${x.c.major ? 'A major arcana card: it speaks to the shape of the whole situation.' : `A ${SUITS.find((s) => s.id === x.c.suit).name.toLowerCase()} card, so it concerns ${SUITS.find((s) => s.id === x.c.suit).of}.`}`);
        facts.push(n === 3 ? `The story runs from ${mean(cards[0])}, through ${mean(cards[1])}, towards ${mean(cards[2])}.` : `${LENS[qKind(q)]}, the card is about ${mean(cards[0])}.`);
        this.say(cards.map((x) => `${x.c.name}${x.rev ? ' (reversed)' : ''}`).join(' · '), wrap('the cards', q, score, facts));
      });
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
    if (s === 'die') this.drawDie(c, a);
    else if (s === 'dnd') drawCharacter(c, a.ch, a.t, this.pal, W, H);
    else if (s === 'dice') this.drawDice(c, a);
    else if (s === 'iching') this.drawIChing(c, a);
    else if (CHAOS.includes(s)) drawChaos(c, a, this);
    else this.drawTarot(c, a);
  }
  idle(c) {
    c.fillStyle = this.pal.ink; c.globalAlpha = 0.6 + Math.sin(this.t * 2) * 0.2;
    c.font = '600 46px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText({ die: '⚅', dnd: '⚔', dice: '⚄', iching: '☯', haruspicy: '⛤', tarot: '🂠', paradigm: '☉', ritual: '⛧' }[this.p.sub] || '✶', W / 2, H / 2 - 10);
    c.font = '600 13px ui-monospace, monospace'; c.fillText(this.p.sub === 'sigil' ? 'state an intent, then draw' : 'tap Cast', W / 2, H / 2 + 40); c.globalAlpha = 1;
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
  // ---- one polyhedral die
  drawDie(c, a) {
    const k = Math.min(1, a.t / 1), e = 1 - (1 - k) ** 3, n = a.n, sides = { 4: 3, 6: 4, 8: 4, 10: 5, 12: 5, 20: 6, 100: 5 }[n] || 6;
    const x = W / 2 + (1 - e) * 120 * Math.cos(a.spin), y = H / 2 - Math.abs(Math.sin(e * Math.PI * 3)) * (1 - e) * 70, r = 70, rot = (1 - e) * 9 + (n === 4 ? -Math.PI / 2 : n === 8 || n === 6 ? Math.PI / 4 : -Math.PI / 2);
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); for (let i = 0; i < sides; i++) { const an = i / sides * Math.PI * 2; c.lineTo(Math.cos(an) * r + 6, Math.sin(an) * r * (n === 8 ? 1.25 : 1) + 8); } c.fill();
    c.fillStyle = this.pal.c[0]; c.beginPath(); for (let i = 0; i < sides; i++) { const an = i / sides * Math.PI * 2; c.lineTo(Math.cos(an) * r, Math.sin(an) * r * (n === 8 ? 1.25 : 1)); } c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; c.stroke();
    if (n === 20 || n === 12) { c.beginPath(); for (let i = 0; i < sides; i++) { const an = i / sides * Math.PI * 2 + Math.PI / sides; c.lineTo(Math.cos(an) * r * 0.55, Math.sin(an) * r * 0.55); } c.closePath(); c.stroke(); }
    c.rotate(-rot);
    const face = k < 1 ? 1 + Math.floor((this.t * 23) % n) : a.v;
    c.fillStyle = this.pal.ink; c.font = `800 ${n === 100 ? 34 : 42}px ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(face), 0, 3);
    c.restore();
    c.fillStyle = this.pal.ink; c.font = '600 13px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText(`d${n}`, W / 2, H - 20);
    if (k >= 1 && n === 20 && (a.v === 20 || a.v === 1)) { c.fillStyle = a.v === 20 ? '#ffd24a' : '#d23a2a'; c.font = '900 20px Georgia, serif'; c.fillText(a.v === 20 ? 'CRITICAL!' : 'FUMBLE', W / 2, 36); }
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
