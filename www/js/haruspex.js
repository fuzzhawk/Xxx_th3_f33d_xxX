// Haruspicy, done properly: a generated beast is led to the altar, you sacrifice
// it, and its opened body shows the exta — liver (with the sixteen houses of the
// Piacenza bronze), gall bladder, heart, lungs, stomach and the coils of gut.
// Tap any organ to read it.
import { monster, creatureName, item as trinket } from './games/creature.js';
import { LIVER, MARKS, CAPUT, EXTA } from './oracle-data.js';

const W = 360, H = 300;
const pickW = (rnd, list) => { let x = rnd() * list.reduce((s, o) => s + (o.w ?? 1), 0); for (const o of list) { x -= o.w ?? 1; if (x <= 0) return o; } return list[0]; };

export class Haruspex {
  constructor(o) { this.o = o; this.state = 'empty'; }
  // a fresh beast on the altar
  bring() {
    const rnd = this.o.rnd, seed = Math.floor(rnd() * 2 ** 31), hue = Math.floor(rnd() * 360);
    this.beast = { seed, hue, art: monster(seed, hue, 22 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 3)), name: creatureName(seed) };
    this.state = 'altar'; this.t0 = this.o.t; this.picked = null;
    this.o.say(`${this.beast.name} is led to the altar`, ['It seems calm. Tap the beast, or press Sacrifice.']);
  }
  sacrifice() {
    if (this.state !== 'altar') return;
    const rnd = this.o.rnd;
    this.state = 'cut'; this.t0 = this.o.t;
    // what lies inside
    const caput = CAPUT[pickW(rnd, [{ i: 0, w: 55 }, { i: 1, w: 15 }, { i: 2, w: 20 }, { i: 3, w: 10 }]).i];
    const marks = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ region: Math.floor(rnd() * LIVER.length), mark: Math.floor(rnd() * MARKS.length), u: rnd(), v: rnd() }));
    const pick = (k) => pickW(rnd, EXTA[k].states);
    const odd = rnd() < 0.25; // strange beasts have strange insides
    this.ex = {
      caput, marks, liverHue: odd ? Math.floor(rnd() * 360) : 4,
      heart: pick('heart'), lungs: pick('lungs'), gall: pick('gall'), stomach: pick('stomach'), gut: pick('gut'),
      coils: 3 + Math.floor(rnd() * 5), gutSeed: rnd(), trinket: trinket(Math.floor(rnd() * 1e6), Math.floor(rnd() * 360)), odd
    };
    this.blood = Array.from({ length: 40 }, () => ({ x: W / 2 + (rnd() - 0.5) * 220, y: 150 + (rnd() - 0.5) * 150, r: 1 + rnd() * 5 }));
    this.organs = [];
    setTimeout(() => this.open(), 1300);
  }
  open() {
    this.state = 'open'; this.t0 = this.o.t;
    const e = this.ex;
    this.o.say(`The exta of ${this.beast.name}`, [
      `Liver: ${e.caput[1]}`,
      ...e.marks.map((m) => `${cap(MARKS[m.mark][0])} in the house of ${LIVER[m.region][0]} (${LIVER[m.region][1]}): ${MARKS[m.mark][1]}.`),
      `Heart: ${e.heart.s}. ${e.heart.r}`,
      'Tap an organ for its reading.'
    ]);
  }
  tap(x, y) {
    if (this.state === 'altar') { this.sacrifice(); return true; }
    if (this.state !== 'open') return false;
    const o = this.organs.find((g) => ((x - g.x) / g.rx) ** 2 + ((y - g.y) / g.ry) ** 2 <= 1);
    if (!o) return false;
    this.picked = o.k;
    const e = this.ex;
    if (o.k === 'liver') this.o.say('Iecur — the liver', [e.caput[1], ...e.marks.map((m) => `${cap(MARKS[m.mark][0])} in the house of ${LIVER[m.region][0]}, ${LIVER[m.region][1]}: ${MARKS[m.mark][1]}.`)]);
    else { const st = e[o.k]; this.o.say(`${EXTA[o.k].name}: ${st.s}`, [st.r]); }
    return true;
  }
  label() { return this.state === 'altar' ? 'Sacrifice' : this.state === 'empty' ? 'Bring a beast' : 'Another beast'; }

  draw(c) {
    const t = this.o.t - (this.t0 || 0), p = this.o.pal;
    if (this.state === 'empty') return false;
    if (this.state === 'open') { this.drawOpen(c, t); return true; }
    // the altar: a stone block with the photo texture, candles either side
    c.fillStyle = p.c[5]; c.fillRect(70, 205, 220, 70);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(70, 205, 220, 8);
    c.fillStyle = 'rgba(255,240,220,.08)'; for (let i = 0; i < 6; i++) c.fillRect(80 + i * 36, 220, 22, 2);
    for (const cx of [52, 308]) { c.fillStyle = '#e8dcc0'; c.fillRect(cx - 5, 190, 10, 40); c.fillStyle = `rgba(255,${180 + Math.sin(this.o.t * 9 + cx) * 40},80,.9)`; c.beginPath(); c.ellipse(cx, 184 + Math.sin(this.o.t * 7 + cx) * 1.5, 4, 8, 0, 0, 7); c.fill(); }
    const fr = this.beast.art.frames[Math.floor(this.o.t * 2) % 2], fw = fr.width, fh = fr.height, s = 150 / Math.max(fw, fh), dw = fw * s, dh = fh * s, bx = W / 2, by = 205 - dh / 2 + 6;
    c.imageSmoothingEnabled = false;
    if (this.state === 'altar') c.drawImage(fr, bx - dw / 2, by - dh / 2 + Math.sin(this.o.t * 3) * 2, dw, dh);
    else {
      // the cut: the knife falls, the beast parts down the middle
      const k = Math.min(1, t / 0.35), split = Math.max(0, t - 0.35) * 70;
      c.drawImage(fr, 0, 0, fw / 2, fh, bx - dw / 2 - split, by - dh / 2 + split * 0.3, dw / 2, dh);
      c.drawImage(fr, fw / 2, 0, fw / 2, fh, bx + split, by - dh / 2 + split * 0.3, dw / 2, dh);
      if (t > 0.3) { c.fillStyle = '#5a0f0c'; c.fillRect(bx - split - 2, by - dh / 2 + split * 0.3, split * 2 + 4, dh); }
      if (k < 1) { c.save(); c.translate(bx + 40, 40 + k * 150); c.rotate(-0.6); c.fillStyle = '#d8d4cc'; c.beginPath(); c.moveTo(0, 0); c.lineTo(60, -8); c.lineTo(60, 6); c.closePath(); c.fill(); c.fillStyle = '#4a2a14'; c.fillRect(-26, -5, 26, 10); c.restore(); }
      if (t > 0.3) { c.fillStyle = 'rgba(120,10,10,.85)'; for (const b of this.blood) { const q = Math.min(1, (t - 0.3) * 2); c.beginPath(); c.arc(W / 2 + (b.x - W / 2) * q, 150 + (b.y - 150) * q, b.r, 0, 7); c.fill(); } }
      if (t < 0.45 && t > 0.3) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, 0, W, H); }
    }
    c.imageSmoothingEnabled = true;
    c.fillStyle = p.ink; c.font = '600 12px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(this.beast.name.toUpperCase(), W / 2, 288);
    return true;
  }
  drawOpen(c, t) {
    const e = this.ex, pk = this.picked, beast = this.beast, organs = (this.organs = []);
    const glow = (k) => { if (pk === k) { c.shadowColor = 'rgba(255,200,120,.9)'; c.shadowBlur = 14; } };
    const unglow = () => { c.shadowBlur = 0; };
    // the opened body: the beast's own colours as the hide, the cavity inside
    c.fillStyle = `hsl(${beast.hue},35%,30%)`; c.beginPath(); c.ellipse(W / 2, 150, 176, 140, 0, 0, 7); c.fill();
    c.fillStyle = `hsl(${beast.hue},30%,20%)`; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; c.beginPath(); c.arc(W / 2 + Math.cos(a) * 168, 150 + Math.sin(a) * 132, 9, 0, 7); c.fill(); }
    const cav = c.createRadialGradient(W / 2, 150, 20, W / 2, 150, 170); cav.addColorStop(0, '#5c1612'); cav.addColorStop(1, '#2a0807');
    c.fillStyle = cav; c.beginPath(); c.ellipse(W / 2, 152, 160, 124, 0, 0, 7); c.fill();
    // gut: a coiling tube across the lower cavity
    if (e.gut.k !== 'none') {
      const pts = [], n = e.coils * 14;
      for (let i = 0; i <= n; i++) { const u = i / n, a = u * e.coils * Math.PI * 2, r = 18 + 14 * Math.sin(u * 11 + e.gutSeed * 9); pts.push([62 + u * 236 + Math.sin(a) * r * 1.4, 222 + Math.cos(a * 1.3 + e.gutSeed * 6) * r + Math.sin(u * 7 + e.gutSeed) * 10]); }
      glow('gut');
      for (const [w, col] of [[15, e.gut.k === 'black' ? '#2a1e1a' : '#a0525a'], [10, e.gut.k === 'black' ? '#3d2c26' : '#d4838a'], [3, 'rgba(255,220,220,.45)']]) {
        c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      }
      if (e.gut.k === 'knot') { c.strokeStyle = '#7a2a30'; c.lineWidth = 6; c.beginPath(); c.arc(pts[n >> 1][0], pts[n >> 1][1], 10, 0, 6); c.stroke(); }
      unglow();
    }
    organs.push({ k: 'gut', x: W / 2, y: 222, rx: 140, ry: 40 });
    // lungs
    const lungs = e.lungs.k;
    if (lungs !== 'none') {
      glow('lungs');
      const lc = lungs === 'black' ? '#3a2e30' : lungs === 'gills' ? '#6aa0a0' : '#e09aa0';
      for (const [dx, on] of [[-1, true], [1, lungs !== 'one']]) if (on) { c.fillStyle = lc; c.beginPath(); c.ellipse(W / 2 + dx * 34 - 80, 78, 26, 36, dx * 0.3, 0, 7); c.fill(); if (lungs === 'spotted') { c.fillStyle = '#5a1a1a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(W / 2 + dx * 34 - 80 + Math.cos(i * 2.3) * 14, 78 + Math.sin(i * 1.7) * 22, 3, 0, 7); c.fill(); } } if (lungs === 'gills') { c.strokeStyle = '#2a5050'; c.lineWidth = 2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(W / 2 + dx * 34 - 98, 78 + i * 10); c.lineTo(W / 2 + dx * 34 - 62, 78 + i * 10); c.stroke(); } } }
      unglow();
    }
    organs.push({ k: 'lungs', x: W / 2 - 80, y: 78, rx: 62, ry: 40 });
    // heart, still beating for a moment
    const beat = 1 + Math.max(0, Math.sin(this.o.t * 7)) * 0.12 * Math.max(0, 1 - t / 6);
    const hearts = e.heart.k === 'two' ? [-16, 16] : e.heart.k === 'none' ? [] : [0];
    glow('heart');
    for (const dx of hearts) {
      const hs = (e.heart.k === 'small' ? 0.6 : e.heart.k === 'huge' ? 1.35 : 1) * beat, hx = W / 2 - 12 + dx, hy = 112;
      c.save(); c.translate(hx, hy); c.scale(hs, hs);
      c.fillStyle = e.heart.k === 'stone' ? '#8a8478' : '#b0202a'; c.beginPath(); c.moveTo(0, 18); c.bezierCurveTo(-26, 0, -18, -20, 0, -8); c.bezierCurveTo(18, -20, 26, 0, 0, 18); c.fill();
      c.strokeStyle = '#5a1014'; c.lineWidth = 3; c.beginPath(); c.moveTo(-4, -10); c.lineTo(-6, -22); c.moveTo(4, -10); c.lineTo(8, -20); c.stroke();
      c.restore();
    }
    if (!hearts.length) { c.strokeStyle = 'rgba(255,220,200,.35)'; c.setLineDash([3, 3]); c.beginPath(); c.arc(W / 2 - 12, 110, 16, 0, 7); c.stroke(); c.setLineDash([]); }
    unglow();
    organs.push({ k: 'heart', x: W / 2 - 12, y: 110, rx: 30, ry: 26 });
    // liver with its houses
    this.liver(c, W / 2 + 70, 100, 0.5, pk === 'liver');
    organs.push({ k: 'liver', x: W / 2 + 70, y: 100, rx: 70, ry: 48 });
    // gall bladder
    const gs = e.gall.k === 'swollen' ? 1.6 : e.gall.k === 'tiny' ? 0.5 : 1;
    glow('gall');
    c.fillStyle = e.gall.k === 'burst' ? '#4a6a1a' : '#5d8a2a'; c.beginPath(); c.ellipse(W / 2 + 54, 150, 11 * gs, 8 * gs, 0.4, 0, 7); c.fill();
    if (e.gall.k === 'burst') { c.fillStyle = 'rgba(120,160,40,.6)'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(W / 2 + 54 + Math.cos(i) * 18, 150 + Math.sin(i * 2) * 10, 3, 0, 7); c.fill(); } }
    unglow();
    organs.push({ k: 'gall', x: W / 2 + 54, y: 150, rx: 18, ry: 14 });
    // stomach, and whatever it swallowed
    glow('stomach');
    c.fillStyle = '#c2847a'; c.beginPath(); c.ellipse(W / 2 - 60, 162, 40, 24, -0.25, 0, 7); c.fill();
    c.strokeStyle = 'rgba(90,30,30,.5)'; c.lineWidth = 2; c.beginPath(); c.ellipse(W / 2 - 60, 162, 28, 14, -0.25, 0, 3); c.stroke();
    if (e.stomach.k === 'trinket') { c.imageSmoothingEnabled = false; c.drawImage(e.trinket, W / 2 - 70, 152, 22, 22); c.imageSmoothingEnabled = true; }
    if (e.stomach.k === 'grain') { c.fillStyle = '#e0b860'; for (let i = 0; i < 14; i++) c.fillRect(W / 2 - 80 + (i * 7) % 40, 156 + (i * 5) % 14, 3, 2); }
    unglow();
    organs.push({ k: 'stomach', x: W / 2 - 60, y: 162, rx: 42, ry: 26 });
    // wet sheen
    c.fillStyle = 'rgba(255,255,255,.06)'; c.beginPath(); c.ellipse(W / 2 - 40, 100, 90, 30, -0.2, 0, 7); c.fill();
    if (t < 3) { c.fillStyle = this.o.pal.ink; c.globalAlpha = Math.min(1, 3 - t); c.font = '600 11px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText('tap an organ', W / 2, 286); c.globalAlpha = 1; }
  }
  liver(c, cx, cy, s, lit) {
    const e = this.ex;
    c.save(); c.translate(cx, cy); c.scale(s, s);
    const shape = () => { c.beginPath(); c.moveTo(-130, -10); c.bezierCurveTo(-120, -90, -10, -100, 20, -70); c.bezierCurveTo(70, -105, 140, -60, 130, 10); c.bezierCurveTo(120, 80, 20, 95, -30, 75); c.bezierCurveTo(-90, 90, -140, 50, -130, -10); c.closePath(); };
    if (lit) { c.shadowColor = 'rgba(255,200,120,.9)'; c.shadowBlur = 24; }
    shape();
    const g = c.createRadialGradient(-30, -30, 10, 0, 0, 160); g.addColorStop(0, `hsl(${e.liverHue},50%,42%)`); g.addColorStop(1, `hsl(${e.liverHue},60%,17%)`);
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
const cap = (s) => s[0].toUpperCase() + s.slice(1);
