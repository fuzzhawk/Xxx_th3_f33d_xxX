import { Game, W, H, roundRect } from './engine.js';

// ================================================================ Tetris with words
// Every row of the well is a line of a saying, printed faintly like a page; blocks ink the letters they cover,
// so a completed line reads as an aphorism and is lifted out whole. Thinkers react to the moments of the game.
const COLS = 10, ROWS = 17, CELL = 22, BX = 132, BY = 40, CH = 2, PI = Math.PI;
const SHAPES = { I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]] };
const KINDS = 'IOTSZJL';
const ROT = {};
for (const k of KINDS) { const n = k === 'I' ? 4 : 3; let s = SHAPES[k]; ROT[k] = []; for (let r = 0; r < 4; r++) { ROT[k].push(s); if (k !== 'O') s = s.map(([x, y]) => [n - 1 - y, x]); } }
// SRS wall kicks for clockwise turns from each state (x right, y up); counter-clockwise uses the negated reverse
const KICK = [[[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]];
const KICK_I = [[[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]];

// The page: sayings that fill the rows of the well (author lines are printed after each one)
const SAY = [
  ['Know thyself', 'Delphic maxim'], ['Nothing in excess', 'Delphic maxim'], ['The unexamined life is not worth living', 'Socrates'],
  ['I think, therefore I am', 'Descartes'], ['Hell is other people', 'Sartre'], ['Man is the measure of all things', 'Protagoras'],
  ['You cannot step twice into the same river', 'Heraclitus'], ['The way up and the way down are one and the same', 'Heraclitus'],
  ['Time is a child playing draughts', 'Heraclitus'], ['Character is destiny', 'Heraclitus'], ['One must imagine Sisyphus happy', 'Camus'],
  ['What does not kill me makes me stronger', 'Nietzsche'], ['Become who you are', 'Nietzsche'], ['Without music, life would be a mistake', 'Nietzsche'],
  ['The limits of my language mean the limits of my world', 'Wittgenstein'], ['The world is everything that is the case', 'Wittgenstein'],
  ['Whereof one cannot speak, thereof one must be silent', 'Wittgenstein'], ['If a lion could talk, we could not understand him', 'Wittgenstein'],
  ['To be is to be perceived', 'Berkeley'], ['Life can only be understood backwards; but it must be lived forwards', 'Kierkegaard'],
  ['Anxiety is the dizziness of freedom', 'Kierkegaard'], ['Boredom is the root of all evil', 'Kierkegaard'],
  ['The heart has its reasons which reason knows nothing of', 'Pascal'], ['Man is condemned to be free', 'Sartre'], ['Existence precedes essence', 'Sartre'],
  ['The journey of a thousand miles begins with a single step', 'Laozi'], ['Those who know do not speak; those who speak do not know', 'Laozi'],
  ['Act without doing; work without effort', 'Laozi'], ['Nature does nothing in vain', 'Aristotle'], ['Man is by nature a political animal', 'Aristotle'],
  ['Well begun is half done', 'Aristotle'], ['Philosophy begins in wonder', 'Plato'], ['The beginning is the most important part of the work', 'Plato'],
  ['There is no royal road to geometry', 'Euclid'], ['Give me a place to stand and I will move the earth', 'Archimedes'],
  ['What stands in the way becomes the way', 'Marcus Aurelius'], ['The soul becomes dyed with the colour of its thoughts', 'Marcus Aurelius'],
  ['We suffer more often in imagination than in reality', 'Seneca'], ['While we are postponing, life speeds by', 'Seneca'],
  ['All that is solid melts into air', 'Marx & Engels'], ['The map is not the territory', 'Korzybski'], ['The medium is the message', 'McLuhan'],
  ['The fox knows many things, but the hedgehog knows one big thing', 'Archilochus'], ['Leisure is the mother of philosophy', 'Hobbes'],
  ['Solitary, poor, nasty, brutish, and short', 'Hobbes'], ['To philosophize is to learn to die', 'Montaigne'], ['What do I know?', 'Montaigne'],
  ['Death is nothing to us', 'Epicurus'], ['Live unnoticed', 'Epicurus'], ['Some things are up to us and some are not', 'Epictetus'],
  ['Form is emptiness, emptiness is form', 'Heart Sutra'], ['Before enlightenment, chop wood, carry water', 'Zen saying'],
  ['The fish trap exists because of the fish', 'Zhuangzi'], ['Nothing comes from nothing', 'Lucretius'], ['We are such stuff as dreams are made on', 'Shakespeare'],
  ['To be, or not to be', 'Shakespeare'], ['Carpe diem', 'Horace'], ['Memento mori', 'Latin maxim'], ['Amor fati', 'Nietzsche'], ['The true is the whole', 'Hegel'],
  ['The owl of Minerva spreads its wings only with the falling of the dusk', 'Hegel'], ['Entities must not be multiplied beyond necessity', "Ockham's razor"],
  ['One is not born, but rather becomes, a woman', 'Simone de Beauvoir'], ['Happiness is an ideal not of reason but of imagination', 'Kant']
];
// Thinkers react: [who, line] per moment
const REACT = {
  start: [['Laozi', 'The journey of a thousand miles begins with a single step.'], ['Plato', 'The beginning is the most important part of the work.'], ['Aristotle', 'Well begun is half done.'], ['Heraclitus', 'The sun is new each day.']],
  line: [['Heraclitus', 'Everything flows.'], ['Marx', 'All that is solid melts into air.'], ['Dhammapada', 'All conditioned things are impermanent.'], ['Marcus Aurelius', 'Loss is nothing else but change.'], ['Zhuangzi', 'Flow with whatever may happen, and let your mind be free.'], ['Heraclitus', 'The way up and the way down are one and the same.'], ['Aristotle', 'Nature does nothing in vain.'], ['Leibniz', 'Nothing is without reason.']],
  multi: [['Aristotle', 'The whole is more than the sum of its parts.'], ['Hegel', 'The true is the whole.'], ['Pythagoras', 'All is number.'], ['Lucretius', 'Nothing can be created out of nothing.']],
  tetris: [['Nietzsche', 'One must still have chaos in oneself to give birth to a dancing star.'], ['Spinoza', 'All things excellent are as difficult as they are rare.'], ['Archimedes', 'Eureka!'], ['Kant', 'The starry heavens above me and the moral law within me.'], ['Leibniz', 'This is the best of all possible worlds.']],
  combo: [['Kierkegaard', 'Repetition is reality, and it is the seriousness of life.'], ['Nietzsche', 'Amor fati: let that be my love henceforth!'], ['Heraclitus', 'Character is destiny.']],
  danger: [['Nietzsche', 'If you gaze long into an abyss, the abyss also gazes into you.'], ['Kierkegaard', 'Anxiety is the dizziness of freedom.'], ['Seneca', 'We suffer more often in imagination than in reality.'], ['Marcus Aurelius', 'What stands in the way becomes the way.'], ['Pascal', 'The eternal silence of these infinite spaces frightens me.'], ['Epictetus', 'Some things are within our power, while others are not.'], ['Hobbes', 'Solitary, poor, nasty, brutish, and short.']],
  saved: [['Camus', 'In the midst of winter, I found there was, within me, an invincible summer.'], ['Nietzsche', 'What does not kill me makes me stronger.'], ['Marcus Aurelius', 'The impediment to action advances action.']],
  level: [['Heraclitus', 'Time is a child playing draughts.'], ['Seneca', 'While we are postponing, life speeds by.'], ['Augustine', 'What then is time? If no one asks me, I know.'], ['Bergson', 'Time is invention or it is nothing at all.'], ['Zeno', 'The flying arrow is at rest.'], ['Pascal', 'We do not rest satisfied with the present.']],
  hold: [['Augustine', 'Grant me chastity and continence, but not yet.'], ['Beckett', 'Nothing to be done.'], ['Pascal', "All of humanity's problems stem from man's inability to sit quietly in a room alone."], ['Montaigne', 'What do I know?']],
  perfect: [['Heart Sutra', 'Form is emptiness, emptiness is form.'], ['Laozi', 'We shape clay into a pot, but it is the emptiness inside that holds whatever we want.']],
  over: [['Camus', 'One must imagine Sisyphus happy.'], ['Beckett', 'Ever tried. Ever failed. No matter. Try again. Fail again. Fail better.'], ['Shakespeare', 'The rest is silence.'], ['Wittgenstein', 'Whereof one cannot speak, thereof one must be silent.'], ['Epicurus', 'Death is nothing to us.'], ['Montaigne', 'To philosophize is to learn to die.']],
  muse: [['Pascal', 'Man is but a reed, the most feeble thing in nature; but he is a thinking reed.'], ['Descartes', 'I think, therefore I am.'], ['Socrates', 'I know that I know nothing.'], ['Zhuangzi', 'Once Zhuang Zhou dreamt he was a butterfly.'], ['Wittgenstein', 'Philosophy is a battle against the bewitchment of our intelligence by means of language.'], ['Kierkegaard', 'Life can only be understood backwards; but it must be lived forwards.'], ['Sartre', 'Man is condemned to be free.']]
};
// marble busts: hair, beard and props per thinker (scriptures get a scroll)
const LOOK = {
  Socrates: 'bald beard', Plato: 'curly beard', Aristotle: 'hair beard', Heraclitus: 'curly lbeard', Laozi: 'bald lbeard', Marx: 'long lbeard', Lucretius: 'hair',
  Hegel: 'hair', Spinoza: 'long stache', 'Marcus Aurelius': 'curly beard', Zhuangzi: 'bun beard', Nietzsche: 'hair stache', Kant: 'wig', Leibniz: 'wig', Archimedes: 'bald lbeard',
  Kierkegaard: 'hair', Seneca: 'bald beard', Pascal: 'long', Epictetus: 'bald beard', Hobbes: 'long stache', Camus: 'hair', Augustine: 'bald beard', Bergson: 'bald stache',
  Zeno: 'curly beard', Pythagoras: 'cap beard', Beckett: 'hair glasses', Montaigne: 'bald stache', Shakespeare: 'long stache', Wittgenstein: 'curly', Epicurus: 'curly lbeard',
  Descartes: 'long stache', Sartre: 'hair glasses', 'Heart Sutra': 'scroll', Dhammapada: 'scroll'
};
const SERIF = 'Georgia, "Iowan Old Style", Palatino, "Noto Serif", serif';

function wrapChars(s, n) {
  const out = [];
  let line = '';
  for (const w of s.split(' ')) { if (line && line.length + 1 + w.length > n) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w; }
  if (line) out.push(line);
  return out;
}
function wrapPx(c, s, w) {
  const out = [];
  let line = '';
  for (const word of s.split(' ')) { const t = line ? `${line} ${word}` : word; if (line && c.measureText(t).width > w) { out.push(line); line = word; } else line = t; }
  if (line) out.push(line);
  return out;
}
function bust(c, x, y, s, look = 'hair') {
  const f = (t) => look.split(' ').includes(t), M = '#e9e2d6', D = '#b3a998', K = '#5a5248';
  c.save(); c.translate(x, y); c.lineCap = 'round';
  if (f('scroll')) {
    c.fillStyle = M; c.fillRect(-s * 1.1, -s * 0.9, s * 2.2, s * 2.3);
    c.fillStyle = D; for (const yy of [-s * 0.9, s * 1.4]) { c.beginPath(); c.ellipse(0, yy, s * 1.3, s * 0.22, 0, 0, 7); c.fill(); }
    c.strokeStyle = K; c.lineWidth = 1;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-s * 0.75, -s * 0.4 + i * s * 0.36); c.lineTo(s * (i % 2 ? 0.45 : 0.75), -s * 0.4 + i * s * 0.36); c.stroke(); }
    c.restore(); return;
  }
  c.fillStyle = D; c.fillRect(-s * 0.95, s * 2, s * 1.9, s * 0.42);
  c.fillStyle = M; c.beginPath(); c.moveTo(-s * 1.7, s * 2); c.quadraticCurveTo(-s * 1.6, s * 0.9, -s * 0.4, s * 0.8); c.lineTo(s * 0.4, s * 0.8); c.quadraticCurveTo(s * 1.6, s * 0.9, s * 1.7, s * 2); c.closePath(); c.fill();
  c.strokeStyle = D; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-s * 1.15, s * 1.25); c.quadraticCurveTo(0, s * 2, s * 0.95, s * 1.05); c.stroke();
  c.fillStyle = D; c.fillRect(-s * 0.32, s * 0.4, s * 0.64, s * 0.5);
  if (f('long') || f('wig')) { c.beginPath(); c.ellipse(0, s * 0.25, s * 1.06, s * 1.2, 0, 0, 7); c.fill(); }
  c.fillStyle = M; c.beginPath(); c.ellipse(0, 0, s * 0.78, s * 0.95, 0, 0, 7); c.fill();
  c.fillStyle = D;
  if (f('hair') || f('long') || f('wig') || f('bun') || f('cap')) { c.beginPath(); c.ellipse(0, -s * 0.45, s * 0.82, s * 0.56, 0, PI, 0); c.fill(); }
  if (f('curly')) for (let i = 0; i < 7; i++) { const a = PI + (i / 6) * PI; c.beginPath(); c.arc(Math.cos(a) * s * 0.7, -s * 0.22 + Math.sin(a) * s * 0.78, s * 0.21, 0, 7); c.fill(); }
  if (f('wig')) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(sx * s * 0.92, -s * 0.15 + i * s * 0.4, s * 0.24, 0, 7); c.fill(); }
  if (f('bun')) { c.beginPath(); c.arc(0, -s * 1.08, s * 0.3, 0, 7); c.fill(); }
  if (f('cap')) { c.fillStyle = K; c.beginPath(); c.ellipse(0, -s * 0.62, s * 0.86, s * 0.42, 0, PI, 0); c.fill(); c.fillStyle = D; }
  c.strokeStyle = K; c.lineWidth = Math.max(1, s * 0.09);
  c.beginPath(); c.moveTo(-s * 0.38, -s * 0.08); c.lineTo(-s * 0.13, -s * 0.06); c.moveTo(s * 0.13, -s * 0.06); c.lineTo(s * 0.38, -s * 0.08);
  c.moveTo(0, -s * 0.02); c.lineTo(-s * 0.07, s * 0.22); c.lineTo(s * 0.05, s * 0.25); c.stroke();
  if (f('glasses')) { c.lineWidth = 1; c.beginPath(); c.arc(-s * 0.26, -s * 0.07, s * 0.17, 0, 7); c.moveTo(s * 0.43, -s * 0.07); c.arc(s * 0.26, -s * 0.07, s * 0.17, 0, 7); c.stroke(); }
  const beard = f('beard') || f('lbeard');
  if (beard) { const L = f('lbeard') ? 1.3 : 0.88; c.beginPath(); c.moveTo(-s * 0.75, s * 0.02); c.quadraticCurveTo(-s * 0.62, s * L, 0, s * (L + 0.18)); c.quadraticCurveTo(s * 0.62, s * L, s * 0.75, s * 0.02); c.quadraticCurveTo(0, s * 0.55, -s * 0.75, s * 0.02); c.fill(); }
  if (beard || f('stache')) { c.fillStyle = f('stache') ? K : D; c.beginPath(); c.ellipse(-s * 0.17, s * 0.36, s * 0.22, s * 0.09, 0.3, 0, 7); c.ellipse(s * 0.17, s * 0.36, s * 0.22, s * 0.09, -0.3, 0, 7); c.fill(); }
  else { c.lineWidth = 1; c.beginPath(); c.moveTo(-s * 0.18, s * 0.45); c.quadraticCurveTo(0, s * 0.5, s * 0.18, s * 0.45); c.stroke(); }
  c.restore();
}

export class Tetris extends Game {
  static noMods = ['mirror', 'trails', 'giant', 'tiny', 'swarm', 'glass'];
  setup() {
    this.colors = [...KINDS].map((_, i) => `hsl(${Math.round(this.skin.hue + i * 51.4) % 360},55%,${i % 2 ? 66 : 61}%)`);
    this.deck = []; this.above = []; this.best = 0;
    this.reset();
  }
  reset() {
    this.rows = [];
    for (let i = 0; i < ROWS; i++) this.rows.unshift(this.newRow());
    this.queue = []; this.bag = []; this.holdK = null; this.held = false;
    this.score = 0; this.lines = 0; this.level = 1; this.combo = -1; this.b2b = false;
    this.clearing = null; this.dead = 0; this.say = null; this.danger = false; this.quiet = 0; this.shake = 0;
    this.plan = null; this.dirty = true; this.spawn();
    this.react('start');
  }
  // the next line of the page, scrolling in from above the well
  newRow() {
    if (!this.above.length) {
      if (!this.deck.length) { this.deck = SAY.map((_, i) => i); for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; } }
      const q = this.deck.pop(), n = COLS * CH, [s, who] = SAY[q];
      this.above = wrapChars(s.toUpperCase(), n).map((t) => ({ t: t.padStart(Math.floor((n + t.length) / 2)).padEnd(n), q }));
      const a = `— ${who.toUpperCase()}`;
      this.above.push({ t: a.padStart(n - 1).padEnd(n), q, au: true });
    }
    const l = this.above.pop();
    return { c: Array(COLS).fill(null), txt: l.t, q: l.q, au: l.au };
  }
  bag7() {
    if (!this.bag.length) { this.bag = [...KINDS]; for (let i = 6; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; } }
    return this.bag.pop();
  }
  spawn(k) {
    while (this.queue.length < 5) this.queue.push(this.bag7());
    if (!k) { k = this.queue.shift(); this.held = false; }
    this.p = { k, r: 0, x: 3, y: -1 };
    this.fall = 0; this.lockT = 0; this.resets = 0; this.plan = null;
    if (!this.fits(k, 0, 3, -1)) this.gameOver();
  }
  fits(k, r, x, y) {
    for (const [cx, cy] of ROT[k][r]) {
      const X = x + cx, Y = y + cy;
      if (X < 0 || X >= COLS || Y >= ROWS || (Y >= 0 && this.rows[Y].c[X])) return false;
    }
    return true;
  }
  cells(p) { return ROT[p.k][p.r].map(([x, y]) => [p.x + x, p.y + y]); }
  ghostY() { const p = this.p; let y = p.y; while (this.fits(p.k, p.r, p.x, y + 1)) y++; return y; }
  touched() { if (this.lockT > 0 && this.resets < 15) { this.lockT = 0; this.resets++; } }
  shift(d) {
    const p = this.p;
    if (!p || this.clearing || !this.fits(p.k, p.r, p.x + d, p.y)) return false;
    p.x += d; this.touched(); return true;
  }
  rotate(d = 1) {
    const p = this.p;
    if (!p || this.clearing || p.k === 'O') return false;
    const to = (p.r + d + 4) % 4, tab = (p.k === 'I' ? KICK_I : KICK)[d > 0 ? p.r : to];
    for (const [kx, ky] of tab) {
      const x = p.x + kx * d, y = p.y - ky * d;
      if (this.fits(p.k, to, x, y)) { p.x = x; p.y = y; p.r = to; this.touched(); return true; }
    }
    return false;
  }
  softStep() { const p = this.p; if (p && !this.clearing && this.fits(p.k, p.r, p.x, p.y + 1)) { p.y++; this.score += 1; this.fall = 0; return true; } return false; }
  hardDrop() {
    const p = this.p;
    if (!p || this.clearing) return;
    const y = this.ghostY();
    this.score += 2 * (y - p.y);
    this.trail = { cells: this.cells(p), dy: y - p.y, t: 0, k: p.k };
    p.y = y; this.lock();
  }
  hold() {
    if (!this.p || this.held || this.clearing) return;
    const k = this.p.k;
    if (this.holdK) this.spawn(this.holdK); else this.spawn();
    this.holdK = k; this.held = true;
    if (!this.auto || this.rng() < 0.25) this.react('hold', 0.4);
  }
  lock() {
    const p = this.p, cells = this.cells(p);
    if (cells.some(([, y]) => y < 0)) return this.gameOver();
    for (const [x, y] of cells) this.rows[y].c[x] = { k: p.k };
    this.p = null; this.dirty = true;
    for (const [x, y] of cells) this.burst(BX + (x + 0.5) * CELL, BY + (y + 1) * CELL, this.colors[KINDS.indexOf(p.k)], 2, 60);
    const full = [];
    this.rows.forEach((r, i) => { if (r.c.every(Boolean)) full.push(i); });
    if (!full.length) { this.combo = -1; this.spawn(); return; }
    const n = full.length, lv = this.level;
    this.combo++;
    this.score += [0, 100, 300, 500, 800][n] * lv * (n === 4 && this.b2b ? 1.5 : 1) + 50 * this.combo * lv;
    this.lines += n; this.b2b = n === 4;
    this.level = 1 + Math.floor(this.lines / 10);
    this.clearing = { rows: full, t: 0 };
    const qs = [...new Set(full.map((i) => this.rows[i].q))];
    this.say = { qs, t: 0, n, lines: null };
    for (const i of full) for (let x = 0; x < COLS; x++) this.burst(BX + (x + 0.5) * CELL, BY + (i + 0.5) * CELL, this.colors[KINDS.indexOf(this.rows[i].c[x].k)], n === 4 ? 3 : 1, 140);
    if (n === 4) this.shake = 0.35;
    const empty = this.rows.every((r, i) => full.includes(i) || !r.c.some(Boolean));
    if (empty) this.react('perfect');
    else if (n === 4) this.react('tetris');
    else if (this.level > lv) this.react('level');
    else if (this.combo >= 3) this.react('combo', 0.5);
    else this.react(n > 1 ? 'multi' : 'line', n > 1 ? 0.6 : 0.3);
  }
  gameOver() {
    this.p = null; this.dead = 3.2; this.clearing = null;
    this.react('over');
    for (let i = 0; i < 24; i++) this.burst(BX + this.r(0, COLS * CELL), BY + this.r(0, ROWS * CELL), this.colors[i % 7], 3, 120);
  }
  // a thinker speaks: always for big moments, sometimes (p) for small ones
  react(ev, p = 1) {
    if (p < 1 && this.thinker && this.thinker.t < 6 && this.rng() > p) return;
    const list = REACT[ev];
    let i = Math.floor(this.rng() * list.length);
    if (this.thinker && list[i][1] === this.thinker.text) i = (i + 1) % list.length;
    this.thinker = { who: list[i][0], text: list[i][1], t: 0, lines: null };
    this.quiet = 0;
  }
  hud() { return `${Math.floor(this.score)}`; }

  // ---------------------------------------------------------------- the autopilot: El-Tetris features, plus a well for tetrises
  masks() { return this.rows.map((r) => r.c.reduce((m, v, i) => (v ? m | (1 << i) : m), 0)); }
  think() {
    const m = this.masks(), alt = this.holdK || this.queue[0];
    const opts = [[this.p.k, false]];
    if (!this.held && alt !== this.p.k) opts.push([alt, true]);
    let best = null;
    for (const [k, hold] of opts) for (let r = 0; r < (k === 'O' ? 1 : 4); r++) for (let x = -2; x < COLS; x++) {
      const s = place(m, k, r, x);
      if (s == null) continue;
      const v = s - (hold ? 0.5 : 0) + this.rng() * 0.02;
      if (!best || v > best.v) best = { v, k, r, x, hold };
    }
    return best;
  }
  autopilot(dt) {
    if (!this.p || this.clearing || this.dead) return;
    const rowT = this.rowTime();
    if (!this.plan) { this.plan = this.think(); this.wait = Math.min(this.r(0.22, 0.45), rowT * 1.5); this.tries = 0; if (!this.plan) { this.hardDrop(); return; } }
    if ((this.wait -= dt) > 0) return;
    this.wait = Math.min(0.085, rowT / 3);
    const p = this.p, t = this.plan;
    if (t.hold) { this.hold(); this.plan = null; return; }
    if (p.r !== t.r) { if (!this.rotate(((t.r - p.r + 4) % 4) === 3 ? -1 : 1) && this.tries++ > 2) this.plan = { ...t, r: p.r }; return; }
    if (p.x !== t.x) { if (!this.shift(Math.sign(t.x - p.x))) this.plan = { ...t, x: p.x }; return; }
    this.hardDrop();
  }
  rowTime() { const l = Math.min(this.level, 20) - 1; return Math.pow(0.8 - l * 0.007, l) / this.G; }

  // ---------------------------------------------------------------- touch: tap beside the piece to move, on it to rotate, drag to slide, swipe down to drop, up to hold
  tap() { this.hint = 1.6; }
  setAuto(a) { super.setAuto(a); this.plan = null; this.ges = null; }
  down(x, y) { this.ges = { x0: x, y0: y, ax: x, ay: y, t: performance.now(), drag: '', rep: 0, last: 0 }; }
  move(x, y) {
    const g = this.ges;
    if (!g) return;
    const dx = x - g.x0, dy = y - g.y0;
    if (!g.drag && Math.hypot(dx, dy) > 12) g.drag = Math.abs(dx) > Math.abs(dy) ? 'h' : dy > 0 ? 'v' : 'u';
    if (g.drag === 'h') { while (x - g.ax > CELL * 0.9) { this.shift(1); g.ax += CELL * 0.9; } while (g.ax - x > CELL * 0.9) { this.shift(-1); g.ax -= CELL * 0.9; } }
    if (g.drag === 'v') while (y - g.ay > CELL * 0.8) { this.softStep(); g.ay += CELL * 0.8; }
  }
  up(x, y) {
    const g = this.ges;
    this.ges = null;
    if (!g || this.dead) return;
    const ms = performance.now() - g.t, dy = y - g.y0;
    if (!g.drag) { if (!g.rep) this.tapAt(x, y); return; }
    if (g.drag === 'v' && dy > 46 && ms < 380) this.hardDrop();
    if (g.drag === 'u' && dy < -36) this.hold();
  }
  pieceBox() {
    const cs = this.cells(this.p), xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
    return [BX + Math.min(...xs) * CELL, BY + Math.min(...ys) * CELL, BX + (Math.max(...xs) + 1) * CELL, BY + (Math.max(...ys) + 1) * CELL];
  }
  tapAt(x, y) {
    if (x < 126 && y > 148 && y < 204) { this.hold(); return; }
    if (!this.p) return;
    const [x0, y0, x1, y1] = this.pieceBox();
    if (x > x0 - 10 && x < x1 + 10 && y > y0 - 14 && y < y1 + 14) this.rotate(1);
    else this.shift(x < (x0 + x1) / 2 ? -1 : 1);
  }

  step(dt) {
    this.t2 = (this.t2 || 0) + dt;
    this.quiet += dt; this.shake = Math.max(0, this.shake - dt); this.hint = Math.max(0, (this.hint || 0) - dt);
    if (this.thinker) this.thinker.t += dt;
    if (this.say) { this.say.t += dt; if (this.say.t > 3.4) this.say = null; }
    if (this.trail) { this.trail.t += dt; if (this.trail.t > 0.25) this.trail = null; }
    if (this.dead) { if ((this.dead -= dt) <= 0) { this.dead = 0; this.reset(); } return; }
    if (this.quiet > 22) this.react('muse');
    if (this.clearing) {
      if ((this.clearing.t += dt) < 0.36) return;
      const gone = new Set(this.clearing.rows);
      this.rows = this.rows.filter((_, i) => !gone.has(i));
      while (this.rows.length < ROWS) this.rows.unshift(this.newRow());
      this.clearing = null; this.dirty = true; this.spawn();
      return;
    }
    const p = this.p;
    if (!p) return;
    // hold beside the piece: keep sliding
    const g = this.ges;
    if (g && !g.drag && performance.now() - g.t > 260) {
      const [x0, , x1] = this.pieceBox();
      if ((g.x0 < x0 - 10 || g.x0 > x1 + 10) && !(g.x0 < 126 && g.y0 > 148 && g.y0 < 204) && (this.t2 - g.last > 0.07)) { this.shift(g.x0 < (x0 + x1) / 2 ? -1 : 1); g.rep = 1; g.last = this.t2; }
    }
    if (this.fits(p.k, p.r, p.x, p.y + 1)) {
      this.lockT = 0;
      this.fall += dt / this.rowTime();
      while (this.fall >= 1 && this.fits(p.k, p.r, p.x, p.y + 1)) { this.fall -= 1; p.y++; }
    } else if ((this.lockT += dt) > 0.5) this.lock();
    // danger: the stack nearly at the top
    const top = this.rows.findIndex((r) => r.c.some(Boolean));
    if (top >= 0 && top <= 4 && !this.danger) { this.danger = true; this.react('danger'); }
    else if (this.danger && (top < 0 || top >= 9)) { this.danger = false; this.react('saved'); }
  }

  // ---------------------------------------------------------------- drawing
  ink(i) { return this.colors[KINDS.indexOf(i)]; }
  block(c, x, y, col, txt, a = 1) {
    c.globalAlpha = a;
    c.fillStyle = col; roundRect(c, x + 1, y + 1, CELL - 2, CELL - 2, 3.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(x + 3, y + 2, CELL - 6, 2);
    c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(x + 3, y + CELL - 4, CELL - 6, 2);
    if (txt && txt.trim()) { c.fillStyle = '#1c1611'; for (let i = 0; i < CH; i++) if (txt[i] !== ' ') c.fillText(txt[i], x + (i + 0.5) * (CELL / CH), y + CELL / 2 + 1); }
    c.globalAlpha = 1;
  }
  layer(name, paint) {
    const s = this.scale || 1, w = COLS * CELL, h = ROWS * CELL;
    let cv = this[name];
    if (!cv) cv = this[name] = document.createElement('canvas');
    cv.width = Math.ceil(w * s); cv.height = Math.ceil(h * s);
    const c = cv.getContext('2d');
    c.setTransform(s, 0, 0, s, 0, 0);
    c.font = `700 12px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    paint(c);
  }
  repaint() {
    this.dirty = false; this.paintedAt = this.scale;
    this.layer('pageCv', (c) => {
      c.fillStyle = this.pal.ink;
      this.rows.forEach((r, y) => { for (let i = 0; i < COLS * CH; i++) if (r.txt[i] !== ' ') c.fillText(r.txt[i], (i + 0.5) * (CELL / CH), (y + 0.5) * CELL + 1); });
    });
    this.layer('stackCv', (c) => {
      this.rows.forEach((r, y) => r.c.forEach((v, x) => { if (v) this.block(c, x * CELL, y * CELL, this.ink(v.k), r.txt.substr(x * CH, CH)); }));
    });
  }
  drawPiece(c, k, x, y, cell, a = 1) {
    const cs = ROT[k][0], xs = cs.map((q) => q[0]), ys = cs.map((q) => q[1]);
    const ox = x - ((Math.min(...xs) + Math.max(...xs) + 1) * cell) / 2, oy = y - ((Math.min(...ys) + Math.max(...ys) + 1) * cell) / 2;
    c.globalAlpha = a; c.fillStyle = this.ink(k);
    for (const [cx, cy] of cs) { roundRect(c, ox + cx * cell + 0.5, oy + cy * cell + 0.5, cell - 1, cell - 1, 2); c.fill(); }
    c.globalAlpha = 1;
  }
  label(c, s, x, y, col = 'rgba(255,255,255,.5)', size = 8.5, align = 'left') {
    c.font = `700 ${size}px ui-monospace, monospace`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(s, x, y);
  }
  draw(c) {
    this.clear(c);
    if (this.dirty || this.paintedAt !== this.scale) this.repaint();
    const bw = COLS * CELL, bh = ROWS * CELL;
    c.save();
    if (this.shake) c.translate(this.r(-3, 3) * this.shake * 3, this.r(-3, 3) * this.shake * 3);
    // the well: a dark page with its faint text, then the inked stack
    c.fillStyle = 'rgba(12,10,8,.8)'; roundRect(c, BX - 4, BY - 4, bw + 8, bh + 8, 6); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.stroke();
    c.globalAlpha = 0.17; c.drawImage(this.pageCv, BX, BY, bw, bh); c.globalAlpha = 1;
    c.drawImage(this.stackCv, BX, BY, bw, bh);
    c.font = `700 12px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (this.clearing) {
      const k = this.clearing.t / 0.36;
      for (const i of this.clearing.rows) {
        c.fillStyle = `rgba(255,248,230,${0.85 * (1 - k)})`; c.fillRect(BX, BY + i * CELL, bw, CELL);
        c.globalAlpha = 1 - k * 0.6; c.fillStyle = '#fff';
        for (let j = 0; j < COLS * CH; j++) if (this.rows[i].txt[j] !== ' ') c.fillText(this.rows[i].txt[j], BX + (j + 0.5) * (CELL / CH), BY + (i + 0.5) * CELL - k * 8);
        c.globalAlpha = 1;
      }
    }
    const p = this.p;
    if (p) {
      c.save(); c.beginPath(); c.rect(BX, BY, bw, bh); c.clip();
      const gy = this.ghostY(), col = this.ink(p.k);
      if (gy !== p.y) for (const [x, y] of ROT[p.k][p.r].map(([x, y]) => [p.x + x, gy + y])) {
        if (y < 0) continue;
        c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 1.5; roundRect(c, BX + x * CELL + 1.5, BY + y * CELL + 1.5, CELL - 3, CELL - 3, 3); c.stroke();
        c.globalAlpha = 0.45; c.fillStyle = this.pal.ink; const t = this.rows[y].txt.substr(x * CH, CH);
        for (let i = 0; i < CH; i++) if (t[i] !== ' ') c.fillText(t[i], BX + x * CELL + (i + 0.5) * (CELL / CH), BY + y * CELL + CELL / 2 + 1);
        c.globalAlpha = 1;
      }
      for (const [x, y] of this.cells(p)) this.block(c, BX + x * CELL, BY + y * CELL, col, y >= 0 ? this.rows[y].txt.substr(x * CH, CH) : '');
      c.restore();
    }
    if (this.trail) {
      const tr = this.trail, a = 1 - tr.t / 0.25;
      c.fillStyle = this.ink(tr.k);
      for (const [x, y] of tr.cells) { c.globalAlpha = 0.25 * a; c.fillRect(BX + x * CELL + 4, BY + y * CELL, CELL - 8, tr.dy * CELL); }
      c.globalAlpha = 1;
    }
    c.restore();
    this.drawSaying(c);
    this.drawPanel(c);
    if (this.dead) {
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(BX - 4, BY + bh / 2 - 26, bw + 8, 52);
      c.font = `italic 700 22px ${SERIF}`; c.textAlign = 'center'; c.fillStyle = '#fff3e0'; c.fillText('The End', BX + bw / 2, BY + bh / 2 - 4);
      this.label(c, `${this.lines} LINES · LEVEL ${this.level}`, BX + bw / 2, BY + bh / 2 + 16, 'rgba(255,255,255,.6)', 9, 'center');
    }
    if (this.hint && !this.auto) this.label(c, 'YOUR MOVE', BX + bw / 2, BY + 12, `rgba(255,200,140,${Math.min(1, this.hint)})`, 11, 'center');
  }
  // the cleared line, lifted out whole as a saying
  drawSaying(c) {
    const s = this.say;
    if (!s) return;
    const a = Math.min(1, s.t * 4, (3.4 - s.t) * 2.5), w = COLS * CELL - 28, cx = BX + (COLS * CELL) / 2;
    c.font = `italic 600 16px ${SERIF}`;
    s.lines ||= s.qs.slice(0, 2).map((q) => [wrapPx(c, `“${SAY[q][0]}”`, w), SAY[q][1]]);
    const hgt = s.lines.reduce((h, [l]) => h + l.length * 19 + 18, 0) + 14;
    const y0 = BY + 22 + Math.max(0, 1 - s.t * 3) * 30;
    c.globalAlpha = a;
    c.fillStyle = 'rgba(14,11,8,.82)'; roundRect(c, BX + 6, y0, COLS * CELL - 12, hgt + (s.n === 4 ? 16 : 0), 8); c.fill();
    c.strokeStyle = this.ink('T'); c.lineWidth = 1; c.stroke();
    let y = y0 + 16;
    if (s.n === 4) { this.label(c, 'TETRIS', cx, y, this.ink('I'), 10, 'center'); y += 16; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const [ls, who] of s.lines) {
      c.font = `italic 600 16px ${SERIF}`; c.fillStyle = '#fff4e2';
      for (const l of ls) { c.fillText(l, cx, y); y += 19; }
      this.label(c, `— ${who.toUpperCase()}`, cx, y - 2, 'rgba(255,214,168,.8)', 8.5, 'center'); y += 18;
    }
    c.globalAlpha = 1;
  }
  drawPanel(c) {
    const L = 10, R = 124, mid = (L + R) / 2;
    c.fillStyle = 'rgba(12,10,8,.55)'; roundRect(c, L - 4, 66, R - L + 8, 348, 8); c.fill();
    this.label(c, 'NEXT', L + 2, 78);
    if (this.queue[0]) this.drawPiece(c, this.queue[0], mid, 102, 12);
    if (this.queue[1]) this.drawPiece(c, this.queue[1], mid - 26, 134, 8, 0.7);
    if (this.queue[2]) this.drawPiece(c, this.queue[2], mid + 26, 134, 8, 0.7);
    this.label(c, 'HOLD', L + 2, 158);
    c.strokeStyle = 'rgba(255,255,255,.12)'; roundRect(c, L, 150, R - L, 52, 6); c.stroke();
    if (this.holdK) this.drawPiece(c, this.holdK, mid, 180, 11, this.held ? 0.4 : 1);
    this.label(c, `LEVEL ${this.level}`, L + 2, 216, 'rgba(255,255,255,.75)', 9.5);
    this.label(c, `${this.lines} LINES`, R - 2, 216, 'rgba(255,255,255,.75)', 9.5, 'right');
    // the thinker of the moment
    const th = this.thinker;
    if (!th) return;
    const pop = Math.min(1, th.t * 5), bob = Math.sin(this.t * 2) * 1.2;
    c.save(); c.translate(mid, 258 + bob); c.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
    bust(c, 0, 0, 13, LOOK[th.who]);
    c.restore();
    this.label(c, th.who.toUpperCase(), mid, 298, this.ink('L'), 9, 'center');
    c.font = `italic 11.5px ${SERIF}`;
    th.lines ||= wrapPx(c, `“${th.text}”`, R - L - 4).slice(0, 8);
    let left = Math.floor(th.t * 45);
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#f3e8d8';
    th.lines.forEach((l, i) => { if (left > 0) c.fillText(l.slice(0, left), L + 1, 316 + i * 13.5); left -= l.length + 1; });
  }
}

// ---------------------------------------------------------------- placement search for the autopilot (row bitmasks, top row first)
const FULL = (1 << COLS) - 1;
function place(m, k, r, x) {
  const cs = ROT[k][r];
  const ok = (y) => cs.every(([cx, cy]) => { const X = x + cx, Y = y + cy; return X >= 0 && X < COLS && Y < ROWS && (Y < 0 || !(m[Y] & (1 << X))); });
  let y = -2;
  if (!ok(y)) return null;
  while (ok(y + 1)) y++;
  const b = m.slice();
  let above = false;
  for (const [cx, cy] of cs) { if (y + cy < 0) above = true; else b[y + cy] |= 1 << (x + cx); }
  if (above) return -1e6;
  const cleared = [];
  b.forEach((row, i) => { if (row === FULL) cleared.push(i); });
  const eroded = cleared.length * cs.filter(([, cy]) => cleared.includes(y + cy)).length;
  const n = b.filter((row) => row !== FULL);
  while (n.length < ROWS) n.unshift(0);
  const landH = ROWS - (y + cs.reduce((s, q) => s + q[1], 0) / 4);
  // while the stack is low, judge only the left nine columns and keep the right one open as a well for tetrises
  const top = n.findIndex(Boolean), height = top < 0 ? 0 : ROWS - top, build = height < 11, C = build ? COLS - 1 : COLS;
  let rowT = 0, colT = 0, holes = 0, wells = 0, wellCells = 0;
  for (let i = 0; i < ROWS; i++) {
    const row = n[i];
    if (!row) continue;
    let prev = 1;
    for (let X = 0; X < C; X++) { const f = (row >> X) & 1; if (f !== prev) rowT++; prev = f; }
    if (!prev) rowT++;
    if (build && (row >> (COLS - 1)) & 1) wellCells++;
  }
  for (let X = 0; X < C; X++) {
    let prev = 0, seen = false, depth = 0;
    for (let i = 0; i < ROWS; i++) {
      const f = (n[i] >> X) & 1;
      if (f !== prev) colT++;
      prev = f;
      if (f) seen = true; else if (seen) holes++;
      const l = X === 0 || ((n[i] >> (X - 1)) & 1), rr = X === C - 1 || ((n[i] >> (X + 1)) & 1);
      if (!f && l && rr) { depth++; wells += depth; } else depth = 0;
    }
    if (!prev) colT++;
  }
  let v = -4.5 * landH + 3.42 * eroded - 3.22 * rowT - 9.35 * colT - 7.9 * holes - 3.39 * wells;
  if (build) v += -14 * wellCells + (cleared.length === 4 ? 60 : -10 * cleared.length);
  return v;
}
