// A microscope's view of a living tissue, made fresh for each card: a vessel pulsing with the
// heartbeat, red cells tumbling through it, white cells rolling along its wall, nutrients seeping out
// and drifting to the cells that need them; cells take them up and glow, grow, and now and then
// divide. A small wound mends while you watch. In the morning the tissue wakes (a slow pulse
// quickening, everything brightening); in the evening the heart slows and the night's repair
// work takes over. No organs, no labels: just the close-up.
import { el, mulberry32 } from './util.js';

const W = 360, H = 288, TAU = Math.PI * 2;
const LINES = {
  morning: ['Inside you, right now: a pulse quickening, cells taking their first breakfast.', 'Every cell in you is waking. Blood is bringing them the morning.', 'Somewhere in you a cell is dividing. You are, very slightly, new today.', 'The night’s small mending is done. Oxygen is arriving.'],
  evening: ['Your heart slows. Your cells turn to the night’s repairs.', 'Nothing to do now but mend. The tissue knows how.', 'Blood moves softer at night; the cells take what they need.', 'While you sleep, the small wounds close.']
};

function sim(seed, evening) {
  const R = mulberry32(seed), rr = (a, b) => a + R() * (b - a);
  // the vessel: a gentle S across the view
  const P0 = [-30, rr(60, 140)], P3 = [W + 30, rr(130, 230)], P1 = [rr(60, 140), rr(-20, 120)], P2 = [rr(200, 300), rr(170, 320)];
  const path = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160, u = 1 - t, x = u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], y = u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1];
    path.push([x, y]);
  }
  for (let i = 0; i < path.length; i++) { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; path[i].push(-dy / l, dx / l); }
  const r0 = rr(22, 30), at = (u, v, rad) => { const f = Math.max(0, Math.min(1, u)) * (path.length - 1), i = Math.floor(f), k = f - i, a = path[i], b = path[Math.min(path.length - 1, i + 1)]; const x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k; return [x + a[2] * v * rad, y + a[3] * v * rad, Math.atan2(b[1] - a[1], b[0] - a[0])]; };
  const distToVessel = (x, y) => { let d = 1e9; for (let i = 0; i < path.length; i += 2) d = Math.min(d, Math.hypot(path[i][0] - x, path[i][1] - y)); return d; };
  const rbc = Array.from({ length: 46 }, () => ({ u: R(), v: rr(-0.75, 0.75), s: rr(0.85, 1.15), rot: R() * TAU, spin: rr(-2, 2), size: rr(6, 8) }));
  const wbc = Array.from({ length: 2 }, (_, k) => ({ u: R(), v: k ? 0.8 : -0.8, size: rr(9, 11), ph: R() * TAU }));
  // the tissue: cells set out by dart-throwing, away from the vessel; a wound where a few are hurt
  const wound = (() => { for (let t = 0; t < 200; t++) { const x = rr(60, W - 60), y = rr(50, H - 50); if (distToVessel(x, y) > r0 + 50) return { x, y, r: 46 }; } return { x: W * 0.3, y: H * 0.8, r: 46 }; })();
  const cells = [];
  for (let t = 0; t < 900 && cells.length < 24; t++) {
    const r = rr(15, 24), x = rr(-10, W + 10), y = rr(-10, H + 10);
    if (distToVessel(x, y) < r0 + r + 8) continue;
    if (cells.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + 4)) continue;
    const dw = Math.hypot(x - wound.x, y - wound.y);
    if (dw < wound.r * 0.55 && R() < 0.7) continue;   // the wound starts with a gap in it
    cells.push(mkCell(R, x, y, r, dw < wound.r ? 0.9 - dw / wound.r * 0.4 : 0));
  }
  const debris = Array.from({ length: 22 }, () => { const a = R() * TAU, d = R() * wound.r; return { x: wound.x + Math.cos(a) * d, y: wound.y + Math.sin(a) * d, r: rr(1, 2.5), life: 1 }; });
  const fibres = Array.from({ length: 16 }, () => ({ x: rr(-40, W), y: rr(0, H), a: rr(-0.6, 0.6), len: rr(120, 260), amp: rr(3, 9), ph: R() * TAU, w: rr(1, 2.6) }));
  const bokeh = Array.from({ length: 9 }, () => ({ x: rr(0, W), y: rr(0, H), r: rr(30, 70), h: rr(-20, 20) }));
  return { R, rr, path, r0, at, distToVessel, rbc, wbc, cells, wound, debris, fibres, bokeh, nutrients: [], t: 0, beat: 0, evening };
}
function mkCell(R, x, y, r, damage = 0) {
  return { x, y, r, r0: r, energy: 0.2 + R() * 0.3, damage, ph: R() * TAU, seed: R() * 1000, mito: Array.from({ length: 4 + Math.floor(R() * 4) }, () => ({ a: R() * TAU, d: 0.35 + R() * 0.45, rot: R() * TAU, l: 0.22 + R() * 0.12 })), div: 0, axis: R() * TAU, glow: 0, nucl: [R() * 0.3 - 0.15, R() * 0.3 - 0.15] };
}

// the heart: beats per minute over the card's life (waking up, or settling down), and the pulse shape
const bpmAt = (S) => (S.evening ? 60 - 12 * Math.min(1, S.t / 45) : 54 + 18 * Math.min(1, S.t / 40));
const activityAt = (S) => (S.evening ? 0.85 - 0.35 * Math.min(1, S.t / 50) : 0.25 + 0.75 * Math.min(1, S.t / 28));

function step(S, dt) {
  S.t += dt;
  const bpm = bpmAt(S), act = activityAt(S);
  S.beat += dt * bpm / 60;
  const ph = S.beat % 1, pulse = Math.exp(-(((ph - 0.08) / 0.07) ** 2)) + 0.35 * Math.exp(-(((ph - 0.3) / 0.08) ** 2));
  S.pulse = pulse;
  const flow = (0.035 + 0.11 * pulse) * (0.6 + 0.6 * act);
  for (const c of S.rbc) { c.u += flow * c.s * dt * (1 - Math.abs(c.v) * 0.5); c.rot += c.spin * dt * (0.4 + pulse); if (c.u > 1.02) { c.u -= 1.04; c.v = S.rr(-0.75, 0.75); } }
  for (const w of S.wbc) { w.u += flow * 0.18 * dt; w.ph += dt * 2; if (w.u > 1.02) w.u -= 1.04; }
  // nutrients seep out of the wall, mostly as the pulse arrives
  if (S.R() < dt * (6 + 30 * pulse) * act) {
    const u = S.R(), side = S.R() < 0.5 ? -1 : 1, [x, y] = S.at(u, side * 1.05, S.r0 * (1 + 0.08 * pulse));
    S.nutrients.push({ x, y, vx: 0, vy: 0, kind: S.R() < 0.55 ? 'o2' : 'glu', life: 9 });
  }
  for (let i = S.nutrients.length - 1; i >= 0; i--) {
    const n = S.nutrients[i];
    n.life -= dt;
    // drift to the hungriest cell nearby (hurt cells call loudest), with a jitter of diffusion
    let best = null, bd = 140;
    for (const c of S.cells) { const d = Math.hypot(c.x - n.x, c.y - n.y) - c.r * (1 + c.damage) - (1 - c.energy) * 30; if (d < bd) { bd = d; best = c; } }
    if (best) { const dx = best.x - n.x, dy = best.y - n.y, d = Math.hypot(dx, dy) || 1; n.vx += dx / d * 26 * dt; n.vy += dy / d * 26 * dt; }
    n.vx += (S.R() - 0.5) * 60 * dt; n.vy += (S.R() - 0.5) * 60 * dt; n.vx *= 0.92; n.vy *= 0.92;
    n.x += n.vx * dt * 10; n.y += n.vy * dt * 10;
    const into = best && Math.hypot(best.x - n.x, best.y - n.y) < best.r * 0.8;
    if (into) { best.energy = Math.min(1, best.energy + 0.05); best.damage = Math.max(0, best.damage - (S.evening ? 0.05 : 0.03)); best.glow = 1; }
    if (into || n.life <= 0) S.nutrients.splice(i, 1);
  }
  // the tissue: breathing membranes, growth, division, and filling the gap
  for (const c of S.cells) {
    c.ph += dt * (0.6 + act); c.glow = Math.max(0, c.glow - dt * 1.5); c.energy = Math.max(0, c.energy - dt * 0.012);
    if (c.div > 0) {
      c.div += dt / 3.2;
      if (c.div >= 1) {
        c.div = 0; const a = c.axis, d = c.r * 0.55;
        const b = mkCell(S.R, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, c.r * 0.74, c.damage);
        c.x -= Math.cos(a) * d; c.y -= Math.sin(a) * d; c.r *= 0.74; c.energy *= 0.5; b.energy = c.energy;
        S.cells.push(b);
      }
      continue;
    }
    if (c.energy > 0.55 && c.damage < 0.3) c.r = Math.min(c.r0 * 1.25, c.r + dt * 0.6 * act);
    const crowd = S.cells.filter((o) => o !== c && Math.hypot(o.x - c.x, o.y - c.y) < c.r * 2.6).length, nearWound = Math.hypot(c.x - S.wound.x, c.y - S.wound.y) < S.wound.r * 1.6;
    if (c.r > c.r0 * 1.18 && c.energy > 0.7 && S.cells.length < 34 && (crowd < 4 || nearWound) && S.R() < dt * (nearWound ? 0.5 : 0.08)) {
      c.div = 0.001;
      // divide toward the open side (into the wound, if it is close)
      c.axis = nearWound ? Math.atan2(S.wound.y - c.y, S.wound.x - c.x) : S.R() * TAU;
    }
  }
  // cells keep their own room, and keep off the vessel
  for (const a of S.cells) for (const b of S.cells) {
    if (a === b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, need = a.r + b.r + 2;
    if (d < need) { const k = (need - d) * 0.5 * dt * 4; a.x -= dx / d * k; a.y -= dy / d * k; }
  }
  for (const c of S.cells) { const dv = S.distToVessel(c.x, c.y), need = S.r0 + c.r + 6; if (dv < need) { const [vx, vy] = S.at(0.5, 0, 0); c.y += (c.y < vy ? -1 : 1) * (need - dv) * dt * 2; void vx; } }
  for (const d of S.debris) d.life -= dt * (S.evening ? 0.03 : 0.02);
}

function draw(S, c, w, h, now) {
  const k = w / W, act = activityAt(S), ev = S.evening, pulse = S.pulse || 0;
  c.save(); c.scale(k, k);
  const focus = 1 + Math.sin(now / 4000) * 0.008;
  c.translate(W / 2, H / 2); c.scale(focus, focus); c.translate(-W / 2, -H / 2);
  // the medium: warm in the morning, cool at night; brighter as the tissue wakes
  const L = ev ? 14 + act * 10 : 18 + act * 20, bg = c.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, ev ? `hsl(255,32%,${L + 6}%)` : `hsl(12,45%,${L + 8}%)`); bg.addColorStop(1, ev ? `hsl(240,38%,${L - 6}%)` : `hsl(350,42%,${L - 4}%)`);
  c.fillStyle = bg; c.fillRect(-10, -10, W + 20, H + 20);
  // out-of-focus cells far below, and the fibres of the matrix
  for (const b of S.bokeh) { const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); g.addColorStop(0, ev ? `hsla(${260 + b.h},40%,60%,.12)` : `hsla(${10 + b.h},60%,70%,.14)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); }
  c.lineCap = 'round';
  for (const f of S.fibres) {
    c.strokeStyle = ev ? 'rgba(190,180,240,.10)' : 'rgba(255,220,200,.13)'; c.lineWidth = f.w; c.beginPath();
    for (let s = 0; s <= 1; s += 0.05) { const x = f.x + Math.cos(f.a) * f.len * s, y = f.y + Math.sin(f.a) * f.len * s + Math.sin(s * 9 + f.ph + now / 3000) * f.amp; if (s === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
  }
  // the wound's debris, fading as it is cleared
  for (const d of S.debris) if (d.life > 0) { c.fillStyle = `rgba(60,30,40,${0.5 * d.life})`; c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU); c.fill(); }
  // the vessel: wall, lumen and the endothelial nuclei along it, swelling with each beat
  const rad = S.r0 * (1 + 0.09 * pulse);
  c.lineJoin = 'round';
  const tube = (wd, col) => { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); S.path.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
  tube(rad * 2 + 10, ev ? 'rgba(150,120,190,.45)' : 'rgba(230,140,140,.5)');
  tube(rad * 2 + 4, ev ? 'rgba(110,80,150,.75)' : 'rgba(200,90,100,.8)');
  tube(rad * 2, ev ? 'rgba(70,40,90,.92)' : 'rgba(150,40,60,.9)');
  tube(rad * 1.2, ev ? 'rgba(90,50,110,.35)' : 'rgba(190,60,80,.35)');
  for (let i = 4; i < S.path.length; i += 13) for (const side of [-1, 1]) { const [x, y, a] = S.at(i / (S.path.length - 1), side * 1.04, rad); c.fillStyle = ev ? 'rgba(170,150,220,.65)' : 'rgba(240,170,170,.7)'; c.beginPath(); c.ellipse(x, y, 5, 1.8, a, 0, TAU); c.fill(); }
  // red cells, tumbling: discs with a pale centre, seen at every angle
  for (const r of S.rbc) {
    const [x, y, a] = S.at(r.u, r.v, rad - r.size * 0.6), tilt = 0.35 + 0.65 * Math.abs(Math.cos(r.rot)), s = r.size;
    c.save(); c.translate(x, y); c.rotate(a + r.rot * 0.2);
    c.fillStyle = ev ? '#b03a5c' : '#d8323e'; c.beginPath(); c.ellipse(0, 0, s, s * tilt, 0, 0, TAU); c.fill();
    c.fillStyle = ev ? '#8a2848' : '#a8202e'; c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.5 * tilt, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,200,200,.35)'; c.beginPath(); c.ellipse(-s * 0.35, -s * 0.3 * tilt, s * 0.3, s * 0.16 * tilt, 0, 0, TAU); c.fill();
    c.restore();
  }
  // white cells rolling along the wall, lobed nuclei and granules
  for (const wbc of S.wbc) {
    const [x, y] = S.at(wbc.u, wbc.v, rad - wbc.size), s = wbc.size;
    c.fillStyle = 'rgba(235,235,245,.85)'; c.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU, rr = s * (1 + 0.08 * Math.sin(a * 5 + wbc.ph)); if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill();
    c.fillStyle = 'rgba(120,90,180,.7)'; for (let l = 0; l < 3; l++) { c.beginPath(); c.arc(x + Math.cos(l * 2.1 + wbc.ph * 0.2) * s * 0.35, y + Math.sin(l * 2.1 + wbc.ph * 0.2) * s * 0.35, s * 0.32, 0, TAU); c.fill(); }
  }
  // the tissue cells
  for (const cell of S.cells) drawCell(c, cell, S, now, act);
  // nutrients: oxygen bright and small, glucose amber
  c.globalCompositeOperation = 'lighter';
  for (const n of S.nutrients) { const a = Math.min(1, n.life); c.fillStyle = n.kind === 'o2' ? `rgba(190,240,255,${0.8 * a})` : `rgba(255,200,110,${0.75 * a})`; c.beginPath(); c.arc(n.x, n.y, n.kind === 'o2' ? 1.4 : 2, 0, TAU); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  c.restore();
  // the microscope: a round field, a little grain
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, ev ? 'rgba(6,4,14,.78)' : 'rgba(20,6,8,.62)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
}
function drawCell(c, cell, S, now, act) {
  const ev = S.evening, dmg = cell.damage, e = cell.energy, t = now / 1000;
  const pts = 22, wob = (a) => 1 + 0.05 * Math.sin(a * 3 + cell.ph + cell.seed) + 0.03 * Math.sin(a * 5 - cell.ph * 1.3) + dmg * 0.18 * Math.sin(a * 7 + cell.seed);
  // dividing: the cell stretches along its axis and pinches in the middle
  const div = cell.div, stretch = 1 + div * 0.6, pinch = Math.max(0, (div - 0.4) / 0.6);
  c.save(); c.translate(cell.x, cell.y); c.rotate(cell.axis);
  const shape = () => { c.beginPath(); for (let i = 0; i <= pts; i++) { const a = i / pts * TAU, r = cell.r * wob(a) * (1 - pinch * 0.7 * Math.abs(Math.sin(a)) ** 6 * (Math.abs(Math.cos(a)) < 0.3 ? 1 : 0)), x = Math.cos(a) * r * stretch, y = Math.sin(a) * r * (1 - pinch * 0.35 * (1 - Math.abs(Math.cos(a)))); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); };
  const hue = ev ? 270 - e * 30 : 18 + e * 14, sat = 40 - dmg * 25, lum = (ev ? 34 : 46) + e * 14 * act - dmg * 18;
  shape(); c.fillStyle = `hsla(${hue},${sat}%,${lum}%,.62)`; c.fill();
  c.lineWidth = 1.6; c.strokeStyle = `hsla(${hue},${sat + 10}%,${lum + 22}%,.8)`; c.stroke();
  // glow when it has just eaten
  if (cell.glow > 0) { c.save(); shape(); c.clip(); const g = c.createRadialGradient(0, 0, 0, 0, 0, cell.r * 1.2); g.addColorStop(0, `rgba(255,240,200,${0.35 * cell.glow})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-cell.r * 2, -cell.r * 2, cell.r * 4, cell.r * 4); c.restore(); }
  // mitochondria: little capsules that light up as the cell wakes
  for (const m of cell.mito) {
    const a = m.a + Math.sin(t * 0.4 + m.rot) * 0.2, d = cell.r * m.d * 0.9, x = Math.cos(a) * d * stretch, y = Math.sin(a) * d, l = cell.r * m.l;
    c.save(); c.translate(x, y); c.rotate(m.rot + t * 0.1);
    c.fillStyle = `hsla(${ev ? 300 : 30},60%,${42 + e * 25 * act}%,.85)`; c.beginPath(); c.ellipse(0, 0, l, l * 0.42, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,240,220,.35)'; c.lineWidth = 0.6; c.beginPath(); for (let k = -2; k <= 2; k++) { c.moveTo(k * l * 0.3, -l * 0.3); c.lineTo(k * l * 0.3 + l * 0.1, l * 0.3); } c.stroke();
    c.restore();
  }
  // the nucleus: one, or two pulling apart while it divides, with condensed chromosomes mid-way
  const nuc = (x, y, r) => {
    c.fillStyle = `hsla(${ev ? 250 : 330},35%,${(ev ? 26 : 32) - dmg * 8}%,.85)`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.fillStyle = `hsla(${ev ? 250 : 330},40%,${ev ? 18 : 22}%,.9)`; c.beginPath(); c.arc(x + r * 0.25, y - r * 0.2, r * 0.32, 0, TAU); c.fill();
  };
  const nr = cell.r * 0.36;
  if (div > 0.25 && div < 0.55) {
    c.strokeStyle = `hsla(${ev ? 280 : 340},55%,30%,.95)`; c.lineWidth = 1.6;
    for (let k = -3; k <= 3; k++) { const yy = k * nr * 0.28; c.beginPath(); c.moveTo(-3 + (div - 0.25) * 30, yy); c.lineTo(3 + (div - 0.25) * 30, yy + 1); c.moveTo(-3 - (div - 0.25) * 30, yy); c.lineTo(3 - (div - 0.25) * 30, yy - 1); c.stroke(); }
  } else if (div >= 0.55) { nuc(cell.r * 0.6 * stretch * pinch, 0, nr * 0.8); nuc(-cell.r * 0.6 * stretch * pinch, 0, nr * 0.8); }
  else nuc(cell.nucl[0] * cell.r, cell.nucl[1] * cell.r, nr);
  c.restore();
}

export function cellView(p) {
  const R = mulberry32(p.seed), evening = p.mode === 'evening';
  const lines = LINES[evening ? 'evening' : 'morning'], line = lines[Math.floor(R() * lines.length)];
  const cv = el('canvas.mind-canvas'), bpm = el('span.pace', '');
  const box = el(`div.mind.cellcard${evening ? '.night' : ''}`, el('div.media-in', cv),
    el('div.mind-text', el('div.kicker', evening ? 'Night repair' : 'Waking cells'), el('p.line', line), el('div.pacer', bpm, el('small', evening ? ' · slowing' : ' · quickening'))));
  const S = sim(p.seed, evening);
  // a moment of history first, so the tissue is already alive when it scrolls in
  for (let i = 0; i < 90; i++) step(S, 1 / 30);
  let raf = 0, last = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    step(S, dt);
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 360, h = Math.round(w * 0.8);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(S, c, w, h, now);
    const txt = `♥ ${Math.round(bpmAt(S))} bpm`;
    if (bpm.textContent !== txt) bpm.textContent = txt;
  };
  return { body: box, label: 'cells', activate: () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }, deactivate: () => { cancelAnimationFrame(raf); raf = 0; } };
}
