// A microscope's view of living tissue, made fresh for each card. Each card is one of five tissues:
// muscle, brain, a healing wound, lung or gut. Each has a real capillary bed: an arteriole branching
// into capillaries, so narrow the red cells pass single file and squeeze, joining again into a
// venule. Bright oxygenated cells darken as they give up their oxygen (in the lung they brighten).
// Each tissue's own cells do their own work:
//   muscle  fibres that a motor nerve fires, calcium sweeping through them, striations bunching as
//           they contract, mitochondria sparking ATP
//   brain   neurons whose spikes leap along their myelin to synapses that spill transmitter;
//           astrocytes ferrying glucose from the blood; microglia feeling about with fine arms
//   wound   bacteria; neutrophils squeezing out through the vessel wall to hunt and swallow them;
//           platelets and fibrin plugging a leak; a macrophage clearing up; fibroblasts laying collagen
//   lung    alveoli swelling with each breath; oxygen crossing into passing red cells, carbon dioxide
//           leaving; surfactant, and a macrophage sweeping dust
//   gut     a villus in the food: microvilli catching sugars and amino acids, fats taking the lacteal,
//           goblet cells spilling mucus, old cells shed at the tip
// A caption names what is happening, and the microscope drifts to look. The heart sets the pace: in
// the morning it quickens as the tissue wakes; in the evening it slows and the repairs go on.
import { el, mulberry32 } from './util.js';

const W = 360, H = 288, TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, k) => a + (b - a) * k;

// ------------------------------------------------ geometry: polylines and splines
function line(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  const at = (s) => {
    s = clamp(s, 0, len);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi], k = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [a[0] + dx * k, a[1] + dy * k, -dy / l, dx / l, Math.atan2(dy, dx)];
  };
  const near = (x, y) => { let d = 1e9, s = 0; for (let i = 0; i < pts.length; i++) { const q = Math.hypot(pts[i][0] - x, pts[i][1] - y); if (q < d) { d = q; s = cum[i]; } } return [d, s]; };
  return { pts, cum, len, at, near };
}
// Catmull-Rom through control points, sampled every few pixels
function spline(ctrl, step = 3) {
  const pts = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(ctrl[ctrl.length - 1].slice());
  return line(pts);
}
const off = (x, y) => x < -12 || y < -12 || x > W + 12 || y > H + 12;

// ------------------------------------------------ the capillary bed
// A ladder: capillaries leave the arteriole A at aS and join the venule V at vS. Their waypoints are
// pushed off obstacles (cells, sacs, fibres) and off each other, so they wind through the tissue.
function bed(S, aCtrl, vCtrl, rungs, o = {}) {
  const A = { L: spline(aCtrl), r: o.ra || 12, kind: 'art' }, V = { L: spline(vCtrl), r: o.rv || 14, kind: 'ven' };
  const rc = o.rc || 4.6, routes = [];
  const C = rungs.map((g) => {
    const aS = g.aS ?? A.L.near(...g.a)[1], vS = g.vS ?? V.L.near(...g.v)[1], [ax, ay] = A.L.at(aS), [vx, vy] = V.L.at(vS);
    let pts = g.via ? [[ax, ay], ...g.via.map((p) => p.slice()), [vx, vy]] : null;
    if (!pts) {
      pts = [[ax, ay]];
      const n = 9, dx = vx - ax, dy = vy - ay, l = Math.hypot(dx, dy) || 1, w = o.wiggle ?? 14, ph = S.R() * TAU;
      for (let i = 1; i < n; i++) { const t = i / n, q = Math.sin(t * Math.PI * (1.2 + S.R() * 0.8) + ph) * w; pts.push([ax + dx * t - dy / l * q, ay + dy * t + dx / l * q]); }
      pts.push([vx, vy]);
    }
    routes.push(pts);
    return { pts, r: rc, kind: 'cap', aS, vS };
  });
  // relax the waypoints off the obstacles and off the other capillaries, keeping each smooth
  const obst = S.obst || [], pad = o.pad ?? rc + 4;
  for (let it = 0; it < (o.iters ?? 60); it++) for (const pts of routes) for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    for (const q of obst) { const dx = p[0] - q.x, dy = p[1] - q.y, d = Math.hypot(dx, dy) || 1, need = q.r + pad; if (d < need) { p[0] += dx / d * (need - d) * 0.5; p[1] += dy / d * (need - d) * 0.5; } }
    for (const other of routes) if (other !== pts) for (let j = 1; j < other.length - 1; j++) { const q = other[j], dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1; if (d < 16) { p[0] += dx / d * (16 - d) * 0.15; p[1] += dy / d * (16 - d) * 0.15; } }
    const a = pts[i - 1], b = pts[i + 1]; p[0] += ((a[0] + b[0]) / 2 - p[0]) * 0.12; p[1] += ((a[1] + b[1]) / 2 - p[1]) * 0.12;
  }
  for (const c of C) c.L = spline(c.pts);
  C.sort((a, b) => a.aS - b.aS);
  // where the arteriole ends on screen, the last capillary leaves from its very end
  const [ex, ey] = A.L.at(A.L.len);
  A.open = off(ex, ey);
  if (!A.open) C[C.length - 1].aS = A.L.len;
  // cross-links between neighbouring capillaries (they branch off one and join the next one
  // downstream), so the bed is a mesh and not a ladder
  const base = C.length;
  for (let k = 0; k < (o.links || 0); k++) {
    const i = Math.floor(S.R() * (base - 1)), j = S.R() < 0.5 ? i + 1 : Math.max(0, i - 1);
    if (i === j) continue;
    const a = C[i], b = C[j], fa = S.rr(0.22, 0.55), fb = clamp(fa + S.rr(0.08, 0.3), 0.2, 0.9), [x0, y0] = a.L.at(fa * a.L.len), [x1, y1] = b.L.at(fb * b.L.len);
    const mx = (x0 + x1) / 2 + S.rr(-10, 10), my = (y0 + y1) / 2 + S.rr(-10, 10);
    if (Math.hypot(x1 - x0, y1 - y0) < 14 || Math.hypot(x1 - x0, y1 - y0) > 120) continue;
    const L = spline([[x0, y0], [mx, my], [x1, y1]]);
    a.kids = a.kids || []; a.kids.push({ k: C.length, s: fa * a.L.len });
    C.push({ L, r: rc * 0.9, kind: 'cap', link: true, to: j, toS: fb * b.L.len });
  }
  S.net = { A, V, C, base };
  S.vessels = [A, ...C, V];
  for (const v of S.vessels) v.nuc = Array.from({ length: Math.ceil(v.L.len / 26) }, (_, k) => ({ s: (k + S.R() * 0.6) * 26, side: k % 2 ? 1 : -1 }));
}
// the default: an arteriole across the top, a venule across the bottom, rungs between (mirrored at random)
function meshBed(S, n = 6, o = {}) {
  const fx = S.R() < 0.5, fy = S.R() < 0.5, M = ([x, y]) => [fx ? W - x : x, fy ? H - y : y], rr = S.rr;
  const aCtrl = [[-40, rr(20, 80)], [rr(70, 110), rr(15, 60)], [rr(170, 220), rr(30, 80)], [rr(270, 310), rr(55, 100)]].map(M);
  const vCtrl = [[rr(40, 80), rr(205, 245)], [rr(140, 190), rr(235, 270)], [rr(250, 290), rr(215, 255)], [W + 40, rr(225, 275)]].map(M);
  const A = spline(aCtrl), V = spline(vCtrl);
  const fa = Array.from({ length: n - 1 }, () => rr(0.22, 0.97)).sort((a, b) => a - b), fv = Array.from({ length: n - 1 }, () => rr(0.04, 0.62)).sort((a, b) => a - b);
  const rungs = Array.from({ length: n }, (_, i) => ({ aS: i === n - 1 ? A.len : A.len * fa[i], vS: i === 0 ? 0 : V.len * fv[i - 1] }));
  bed(S, aCtrl, vCtrl, rungs, { links: 4, wiggle: 22, ...o });
}

// ------------------------------------------------ blood
function bodyAt(S, b) {
  const { A, V, C } = S.net, v = b.on === 'A' ? A : b.on === 'V' ? V : C[b.on], [x, y, nx, ny, ang] = v.L.at(b.s), k = b.v * Math.max(0, v.r - b.size * 0.7);
  return [x + nx * k, y + ny * k, ang, v];
}
function respawn(S, b) {
  b.on = S.net.A.open || S.R() < 0.75 ? 'A' : 'V'; b.s = 0; b.v = S.rr(-0.7, 0.7);
  if (b.o2 !== undefined) b.o2 = S.o2in;
}
function moveBody(S, b, dt, base) {
  const { A, V, C } = S.net;
  if (b.on === 'A') {
    const s0 = b.s; b.s += base * b.sp * dt * (1 - Math.abs(b.v) * 0.35);
    const nb = S.net.base;
    for (let i = 0; i < nb; i++) { const c = C[i]; if (c.aS > s0 && c.aS <= b.s && S.R() < (A.open ? 0.85 : 1) / (nb - i)) { b.on = i; b.s = 0; b.v = 0; return; } }
    if (b.s >= A.L.len) { if (A.open) respawn(S, b); else { b.on = nb - 1; b.s = 0; b.v = 0; } }
  } else if (b.on === 'V') { b.s += base * 0.75 * b.sp * dt * (1 - Math.abs(b.v) * 0.35); if (b.s >= V.L.len) respawn(S, b); }
  else {
    const c = C[b.on], s0 = b.s; b.s += base * 0.42 * b.sp * dt;
    if (c.kids) for (const kd of c.kids) if (kd.s > s0 && kd.s <= b.s && S.R() < 0.4) { b.on = kd.k; b.s = 0; return; }
    if (b.s >= c.L.len) { if (c.link) { b.on = c.to; b.s = c.toS; } else { b.on = 'V'; b.s = c.vS; b.v = S.rr(-0.6, 0.6); } }
  }
}
function blood(S, n, o2in) {
  S.o2in = o2in;
  const vs = S.vessels, tot = vs.reduce((a, v) => a + v.L.len, 0), place = (b) => {
    let q = S.R() * tot;
    for (const v of vs) { if (q < v.L.len) { b.on = v.kind === 'art' ? 'A' : v.kind === 'ven' ? 'V' : S.net.C.indexOf(v); b.s = q; b.v = v.kind === 'cap' ? 0 : S.rr(-0.7, 0.7); return b; } q -= v.L.len; }
    return b;
  };
  S.rbc = Array.from({ length: n }, () => place({ o2: o2in, rot: S.R() * TAU, spin: S.rr(-2, 2), size: S.rr(5.5, 6.8), sp: S.rr(0.85, 1.15) }));
  S.plt = Array.from({ length: Math.round(n * 0.4) }, () => place({ size: 1.8, sp: S.rr(0.8, 1.2) }));
  S.wbc = Array.from({ length: 2 }, (_, k) => ({ on: 'V', s: S.R() * S.net.V.L.len, v: k ? 0.85 : -0.85, size: S.rr(8, 9.5), ph: S.R() * TAU, sp: 1, state: 'roll' }));
}
function stepBlood(S, dt) {
  const base = (24 + 64 * S.pulse) * (0.6 + 0.6 * S.act);
  for (const b of S.rbc) { const was = b.on; moveBody(S, b, dt, base); b.rot += b.spin * dt * (0.4 + S.pulse); if (typeof was === 'number' || typeof b.on === 'number') S.scene.exchange?.(S, b, dt); }
  for (const p of S.plt) moveBody(S, p, dt, base);
  for (const w of S.wbc) if (w.state === 'roll') { w.s += base * 0.1 * dt; w.ph += dt * 2; if (w.s >= S.net.V.L.len) w.s = 0; }
}

// ------------------------------------------------ particles: oxygen, sugars, transmitters, mucus…
const PART = { o2: [190, 240, 255, 1.4], co2: [175, 175, 200, 1.5], glu: [255, 200, 110, 1.9], aa: [150, 240, 150, 1.7], fat: [255, 236, 140, 2.6], nt: [140, 255, 220, 1.3], atp: [255, 250, 170, 1.2], ach: [160, 255, 200, 1.3], mucus: [215, 232, 255, 3.2], surf: [225, 255, 235, 1.5], dust: [140, 125, 110, 1.8], ca: [180, 230, 255, 1.6] };
function emit(S, p) { if (S.parts.length < 260) S.parts.push({ vx: 0, vy: 0, life: 4, max: p.life || 4, ...p }); }
function stepParts(S, dt) {
  for (let i = S.parts.length - 1; i >= 0; i--) {
    const p = S.parts[i];
    p.life -= dt;
    if (p.path) { p.ps = (p.ps || 0) + (p.speed || 40) * dt; const [x, y] = p.path.at(p.ps); p.x = x; p.y = y; if (p.ps >= p.path.len) { p.done?.(); p.life = 0; } }
    else {
      const tg = typeof p.to === 'function' ? p.to() : p.to;
      if (tg) { const dx = tg[0] - p.x, dy = tg[1] - p.y, d = Math.hypot(dx, dy) || 1; p.vx += dx / d * (p.pull || 30) * dt; p.vy += dy / d * (p.pull || 30) * dt; if (d < (p.reach || 3)) { p.done?.(); p.life = 0; } }
      p.vx += (S.R() - 0.5) * (p.jit ?? 50) * dt; p.vy += (S.R() - 0.5) * (p.jit ?? 50) * dt + (p.g || 0) * dt;
      p.vx *= p.drag ?? 0.92; p.vy *= p.drag ?? 0.92;
      p.x += p.vx * dt * 10; p.y += p.vy * dt * 10;
    }
    if (p.life <= 0) S.parts.splice(i, 1);
  }
}
function drawParts(S, c) {
  c.globalCompositeOperation = 'lighter';
  for (const p of S.parts) { const [r, g, b, s] = PART[p.kind] || PART.o2, a = Math.min(1, p.life / 0.4) * (p.alpha ?? 0.85); c.fillStyle = `rgba(${r},${g},${b},${a})`; c.beginPath(); c.arc(p.x, p.y, (p.size || 1) * s, 0, TAU); c.fill(); }
  c.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------ the caption and the microscope's eye
function say(S, key, x, y, force) {
  const txt = (S.scene.say[key] || [])[S.ev ? 1 : 0] || (S.scene.say[key] || [])[0];
  if (!txt || S.quiet) return;
  if (!force && S.t - S.capT < 5.5) return;
  if (S.cap === txt && S.t - S.capT < 20) return;
  S.cap = txt; S.capT = S.t;
  if (x !== undefined) S.look = { x, y, until: S.t + 4.5 };
}
function idle(S) {
  if (S.t - S.capT < 9) return;
  const keys = S.scene.idle, k = keys[(S.idleK = ((S.idleK ?? -1) + 1) % keys.length)];
  say(S, k);
}

// ------------------------------------------------ generic tissue cells (the wound's neighbours)
function mkCell(R, x, y, r, damage = 0) {
  return { x, y, r, r0: r, energy: 0.2 + R() * 0.3, damage, ph: R() * TAU, seed: R() * 1000, mito: Array.from({ length: 4 + Math.floor(R() * 4) }, () => ({ a: R() * TAU, d: 0.35 + R() * 0.45, rot: R() * TAU, l: 0.22 + R() * 0.12 })), div: 0, axis: R() * TAU, glow: 0, nucl: [R() * 0.3 - 0.15, R() * 0.3 - 0.15] };
}
function nearVessel(S, x, y) { let d = 1e9; for (const v of S.vessels) d = Math.min(d, v.L.near(x, y)[0] - v.r); return d; }
function fillCells(S, n, rmin, rmax, avoid) {
  const cells = [];
  for (let t = 0; t < 1400 && cells.length < n; t++) {
    const r = S.rr(rmin, rmax), x = S.rr(-10, W + 10), y = S.rr(-10, H + 10);
    if (nearVessel(S, x, y) < r + 7) continue;
    if (cells.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + 4)) continue;
    if (avoid && avoid(x, y, r)) continue;
    cells.push(mkCell(S.R, x, y, r));
  }
  return cells;
}
function drawCell(c, cell, S, now) {
  const ev = S.ev, dmg = cell.damage, e = cell.energy, t = now / 1000, act = S.act;
  const pts = 22, wob = (a) => 1 + 0.05 * Math.sin(a * 3 + cell.ph + cell.seed) + 0.03 * Math.sin(a * 5 - cell.ph * 1.3) + dmg * 0.18 * Math.sin(a * 7 + cell.seed);
  const div = cell.div, stretch = 1 + div * 0.6, pinch = Math.max(0, (div - 0.4) / 0.6);
  c.save(); c.translate(cell.x, cell.y); c.rotate(cell.axis);
  const shape = () => { c.beginPath(); for (let i = 0; i <= pts; i++) { const a = i / pts * TAU, r = cell.r * wob(a), x = Math.cos(a) * r * stretch, y = Math.sin(a) * r * (1 - pinch * 0.35 * (1 - Math.abs(Math.cos(a)))); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); };
  const hue = ev ? 270 - e * 30 : 18 + e * 14, sat = 40 - dmg * 25, lum = (ev ? 34 : 46) + e * 14 * act - dmg * 18;
  shape(); c.fillStyle = `hsla(${hue},${sat}%,${lum}%,.62)`; c.fill();
  c.lineWidth = 1.6; c.strokeStyle = `hsla(${hue},${sat + 10}%,${lum + 22}%,.8)`; c.stroke();
  if (cell.glow > 0) { c.fillStyle = `rgba(255,240,200,${0.22 * cell.glow})`; shape(); c.fill(); }
  for (const m of cell.mito) {
    const a = m.a + Math.sin(t * 0.4 + m.rot) * 0.2, d = cell.r * m.d * 0.9, x = Math.cos(a) * d * stretch, y = Math.sin(a) * d, l = cell.r * m.l;
    c.save(); c.translate(x, y); c.rotate(m.rot + t * 0.1);
    c.fillStyle = `hsla(${ev ? 300 : 30},60%,${42 + e * 25 * act}%,.85)`; c.beginPath(); c.ellipse(0, 0, l, l * 0.42, 0, 0, TAU); c.fill();
    c.restore();
  }
  const nuc = (x, y, r) => { c.fillStyle = `hsla(${ev ? 250 : 330},35%,${(ev ? 26 : 32) - dmg * 8}%,.85)`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.fillStyle = `hsla(${ev ? 250 : 330},40%,${ev ? 18 : 22}%,.9)`; c.beginPath(); c.arc(x + r * 0.25, y - r * 0.2, r * 0.32, 0, TAU); c.fill(); };
  const nr = cell.r * 0.36;
  if (div > 0.25 && div < 0.55) {
    // metaphase: chromosomes lined up, then pulled to the poles
    c.strokeStyle = `hsla(${ev ? 280 : 340},55%,30%,.95)`; c.lineWidth = 1.6;
    for (let k = -3; k <= 3; k++) { const yy = k * nr * 0.28, sp = (div - 0.25) * 30; c.beginPath(); c.moveTo(-3 + sp, yy); c.lineTo(3 + sp, yy + 1); c.moveTo(-3 - sp, yy); c.lineTo(3 - sp, yy - 1); c.stroke(); }
  } else if (div >= 0.55) { nuc(cell.r * 0.6 * stretch * pinch, 0, nr * 0.8); nuc(-cell.r * 0.6 * stretch * pinch, 0, nr * 0.8); }
  else nuc(cell.nucl[0] * cell.r, cell.nucl[1] * cell.r, nr);
  c.restore();
}
function stepCells(S, cells, dt, nearFn) {
  for (const c of cells) {
    c.ph += dt * (0.6 + S.act); c.glow = Math.max(0, c.glow - dt * 1.5); c.energy = Math.max(0, c.energy - dt * 0.012);
    if (c.div > 0) {
      c.div += dt / 3.2;
      if (c.div >= 1) {
        c.div = 0; const a = c.axis, d = c.r * 0.55, b = mkCell(S.R, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, c.r * 0.74, c.damage);
        c.x -= Math.cos(a) * d; c.y -= Math.sin(a) * d; c.r *= 0.74; c.energy *= 0.5; b.energy = c.energy; cells.push(b);
      }
      continue;
    }
    if (c.energy > 0.55 && c.damage < 0.3) c.r = Math.min(c.r0 * 1.25, c.r + dt * 0.6 * S.act);
    const crowd = cells.filter((o) => o !== c && Math.hypot(o.x - c.x, o.y - c.y) < c.r * 2.6).length, near = nearFn ? nearFn(c) : null;
    if (c.r > c.r0 * 1.18 && c.energy > 0.7 && cells.length < 34 && (crowd < 4 || near) && S.R() < dt * (near ? 0.5 : 0.08)) {
      c.div = 0.001; c.axis = near ? Math.atan2(near[1] - c.y, near[0] - c.x) : S.R() * TAU;
      say(S, 'divide', c.x, c.y);
    }
  }
  for (const a of cells) for (const b of cells) {
    if (a === b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, need = a.r + b.r + 2;
    if (d < need) { const k = (need - d) * 0.5 * dt * 4; a.x -= dx / d * k; a.y -= dy / d * k; }
  }
  for (const c of cells) for (const v of S.vessels) { const [d, s] = v.L.near(c.x, c.y), need = v.r + c.r + 5; if (d < need) { const [x, y] = v.L.at(s), dx = c.x - x, dy = c.y - y, l = Math.hypot(dx, dy) || 1; c.x += dx / l * (need - d) * dt * 2; c.y += dy / l * (need - d) * dt * 2; } }
}
// oxygen leaving a red cell in a capillary for the nearest thing that wants it
function giveO2(S, b, dt, targets, rate = 1) {
  if (b.o2 <= 0.12) return;
  b.o2 = Math.max(0.12, b.o2 - dt * 0.07 * rate);
  if (S.R() < dt * 1.6 * rate) {
    const [x, y] = bodyAt(S, b);
    let best = null, bd = 160;
    for (const t of targets) { const d = Math.hypot(t.x - x, t.y - y) - (t.r || 0); if (d < bd) { bd = d; best = t; } }
    if (best) emit(S, { kind: 'o2', x, y, to: [best.x, best.y], reach: (best.r || 4) * 0.7, life: 3.5, alpha: 0.7, done: () => { best.energy = Math.min(1, (best.energy ?? 0) + 0.05); best.glow = 1; } });
  }
}

// ================================================ the tissues
// ------------------------------------------------ muscle
const muscle = {
  title: 'muscle',
  lines: { morning: ['Your muscles are waking: capillaries open between the fibres as the blood speeds up.', 'Each fibre is one long cell, packed with mitochondria. This morning they are starting to burn.'], evening: ['Muscle at rest: the fibres twitch only now and then, and the night’s repairs begin.', 'Slow blood, quiet fibres. Tonight the small tears of the day are mended.'] },
  idle: ['bed', 'mito', 'single'],
  say: {
    bed: ['Capillaries thread between the muscle fibres', 'Capillaries thread between the resting fibres'], mito: ['Mitochondria line the fibres, turning oxygen into ATP'], single: ['Red cells squeeze through single file, giving up oxygen'],
    nerve: ['A motor nerve fires: acetylcholine spills onto the fibre'], ca: ['Calcium floods the fibre; myosin pulls on actin, and it shortens'], relax: ['It relaxes as calcium is pumped back into store']
  },
  build(S) {
    const n = 4, sp = (H + 40) / n, gap = 21;
    S.fibers = Array.from({ length: n }, (_, k) => ({ y0: -20 + k * sp + gap / 2, y1: -20 + (k + 1) * sp - gap / 2, c: 0, wave: -1, wx: W / 2, next: S.rr(0.4, 4), sp: S.rr(6.2, 7.6), energy: 0.4,
      nuc: Array.from({ length: 3 + Math.floor(S.R() * 3) }, () => ({ x: S.rr(-10, W + 10), top: S.R() < 0.5 })), mito: Array.from({ length: 30 }, () => ({ x: S.rr(-10, W + 10), y: S.rr(0.12, 0.88), l: S.rr(4, 7) })) }));
    const k = 1 + Math.floor(S.R() * (n - 2)), f = S.fibers[k], xj = S.rr(110, 250);
    f.nmj = true; f.wx = xj;
    const gy = f.y0 - gap / 2;
    S.nmj = { f, x: xj, ax: spline([[xj + S.rr(-60, 60), -24], [xj + S.rr(-20, 20), gy - 30], [xj + 6, gy], [xj, f.y0 + 1]]), spike: -1 };
    const rungs = [];
    for (let i = 0; i <= n; i++) { const y = -20 + i * sp; if (y < 6 || y > H - 6) continue; const via = []; for (let j = 1; j < 9; j++) via.push([j * W / 9, y + S.rr(-2, 2)]); rungs.push({ a: [10, y], v: [W - 10, y], via }); }
    bed(S, [[12, -40], [7, H * 0.35], [13, H * 0.7], [9, H + 40]], [[W - 9, -40], [W - 13, H * 0.4], [W - 7, H * 0.7], [W - 11, H + 40]], rungs, { iters: 0, rc: 4.8 });
    blood(S, 64, 1);
  },
  exchange(S, b, dt) { if (typeof b.on === 'number') { const [, y] = bodyAt(S, b), f = S.fibers.reduce((a, q) => (Math.abs((q.y0 + q.y1) / 2 - y) < Math.abs((a.y0 + a.y1) / 2 - y) ? q : a)); giveO2(S, b, dt, [{ x: bodyAt(S, b)[0] + S.rr(-30, 30), y: clamp(y, f.y0 + 6, f.y1 - 6), r: 4, f }], 1 + f.c * 2); } },
  step(S, dt) {
    const N = S.nmj;
    for (const f of S.fibers) {
      f.next -= dt * (0.35 + S.act);
      if (f.next <= 0 && f.wave < 0 && (!f.nmj || N.spike < 0)) {
        f.next = S.ev ? S.rr(6, 11) : S.rr(2.4, 5);
        if (f.nmj) { N.spike = 0; say(S, 'nerve', N.x, f.y0); } else { f.wave = 0; f.wx = S.rr(40, W - 40); }
      }
      if (f.wave >= 0) {
        const w = (f.wave += dt);
        f.c = w < 0.15 ? 0 : w < 0.45 ? (w - 0.15) / 0.3 : w < 0.85 ? 1 : w < 1.7 ? 1 - (w - 0.85) / 0.85 : 0;
        if (f.nmj && w > 0.9 && w - dt <= 0.9) say(S, 'relax', N.x, (f.y0 + f.y1) / 2);
        if (w > 1.7) { f.wave = -1; f.c = 0; }
        if (f.c > 0.3 && S.R() < dt * 34 * f.c) { const m = f.mito[Math.floor(S.R() * f.mito.length)], sh = 1 - 0.1 * f.c; emit(S, { kind: 'atp', x: f.wx + (m.x - f.wx) * sh, y: mix(f.y0, f.y1, m.y), jit: 20, life: 0.5 }); }
      }
    }
    if (N.spike >= 0) {
      N.spike += dt / 0.4;
      if (N.spike >= 1) {
        N.spike = -1; N.f.wave = 0;
        for (let i = 0; i < 6; i++) emit(S, { kind: 'ach', x: N.x + S.rr(-3, 3), y: N.f.y0 - 2, vy: 2, jit: 30, life: 0.6 });
        say(S, 'ca', N.x, (N.f.y0 + N.f.y1) / 2, true);
      }
    }
  },
  under(S, c) {
    const ev = S.ev, a = S.act;
    for (const f of S.fibers) {
      const sh = 1 - 0.1 * f.c, xc = f.wx, X = (x) => xc + (x - xc) * sh, h = f.y1 - f.y0;
      c.fillStyle = ev ? `hsl(330,26%,${24 + a * 6 + f.c * 4}%)` : `hsl(356,44%,${30 + a * 8 + f.c * 5}%)`;
      c.beginPath(); c.roundRect(-30, f.y0, W + 60, h, 10); c.fill();
      // striations: dark A bands and thin Z lines, bunching up as the fibre contracts
      const sp = f.sp * sh, x0 = xc - Math.ceil((xc + 30) / sp) * sp;
      c.fillStyle = ev ? 'rgba(20,8,30,.28)' : 'rgba(60,0,10,.26)';
      for (let x = x0; x < W + 30; x += sp) c.fillRect(x, f.y0 + 2, sp * 0.46, h - 4);
      c.fillStyle = ev ? 'rgba(200,180,240,.12)' : 'rgba(255,200,200,.14)';
      for (let x = x0 + sp * 0.73; x < W + 30; x += sp) c.fillRect(x, f.y0 + 2, 0.8, h - 4);
      // myofibril seams with mitochondria in them
      c.fillStyle = ev ? 'rgba(220,150,230,.55)' : 'rgba(255,170,120,.6)';
      for (const m of f.mito) { const x = X(m.x), y = mix(f.y0, f.y1, m.y); c.beginPath(); c.ellipse(x, y, m.l * sh, 1.5, 0, 0, TAU); c.fill(); }
      // nuclei pressed to the edge of the cell
      c.fillStyle = ev ? 'rgba(90,60,140,.85)' : 'rgba(110,30,60,.85)';
      for (const q of f.nuc) { c.beginPath(); c.ellipse(X(q.x), q.top ? f.y0 + 4 : f.y1 - 4, 9, 2.6, 0, 0, TAU); c.fill(); }
      // the calcium wave, out from where it started
      if (f.wave >= 0 && f.wave < 0.6) {
        const sprd = f.wave / 0.6 * (W + 60), al = 0.4 * (1 - f.wave / 0.6);
        c.fillStyle = `rgba(190,235,255,${al})`;
        c.fillRect(xc - sprd, f.y0 + 1, 10, h - 2); c.fillRect(xc + sprd - 10, f.y0 + 1, 10, h - 2);
        c.fillStyle = `rgba(190,235,255,${al * 0.35})`; c.fillRect(xc - sprd, f.y0 + 1, sprd * 2, h - 2);
      }
      c.strokeStyle = ev ? 'rgba(200,170,240,.35)' : 'rgba(255,190,190,.35)'; c.lineWidth = 1.2; c.beginPath(); c.roundRect(-30, f.y0, W + 60, h, 10); c.stroke();
    }
  },
  over(S, c) {
    const N = S.nmj, L = N.ax;
    c.strokeStyle = S.ev ? 'rgba(220,210,250,.8)' : 'rgba(255,235,215,.85)'; c.lineWidth = 2; c.beginPath(); L.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    // the end plate: little knobs on the fibre
    c.fillStyle = S.ev ? 'rgba(210,200,250,.9)' : 'rgba(255,225,200,.9)';
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.arc(N.x + k * 5, N.f.y0 + 1.5, 2.6, 0, TAU); c.fill(); }
    if (N.spike >= 0) { const [x, y] = L.at(N.spike * L.len), g = c.createRadialGradient(x, y, 0, x, y, 10); g.addColorStop(0, 'rgba(255,255,220,.95)'); g.addColorStop(1, 'rgba(255,255,220,0)'); c.fillStyle = g; c.fillRect(x - 10, y - 10, 20, 20); }
  }
};

// ------------------------------------------------ brain
const brain = {
  title: 'brain',
  lines: { morning: ['Your brain is waking: neurons fire faster as fresh blood reaches them.', 'The cortex, close up: a capillary every few cells, and every neuron talking.'], evening: ['As you sleep, neurons replay the day in quiet bursts.', 'Night in the cortex: the brain’s cleaners get to work while it rests.'] },
  idle: ['cortex', 'micro', 'astro'],
  say: {
    cortex: ['Neurons of the cortex, laced with capillaries', 'In sleep, neurons replay the day in quiet bursts'], fire: ['A neuron fires: the spike leaps along its myelin, node to node'],
    syn: ['At the synapse, transmitter spills across; the next neuron listens'], astro: ['An astrocyte ferries glucose from the blood to a neuron'], micro: ['Microglia keep watch, feeling through the tissue with fine arms']
  },
  build(S) {
    S.neu = [];
    for (let t = 0; t < 400 && S.neu.length < 3; t++) { const x = S.rr(60, W - 60), y = S.rr(80, H - 50); if (S.neu.some((n) => Math.hypot(n.x - x, n.y - y) < 115)) continue; S.neu.push({ x, y, r: S.rr(10, 13), v: S.R() * 0.7, glow: 0, dend: [], tips: [], ang: S.rr(-0.4, 0.4), dglow: 0 }); }
    for (const n of S.neu) {
      const grow = (x, y, a, l, d, w) => { const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; n.dend.push([x, y, x2, y2, w]); if (d > 0) { for (const s of [-1, 1]) if (S.R() < 0.85) grow(x2, y2, a + s * S.rr(0.3, 0.7), l * S.rr(0.55, 0.75), d - 1, w * 0.7); } else n.tips.push([x2, y2]); };
      grow(n.x, n.y - n.r, -Math.PI / 2 + n.ang, S.rr(36, 54), 3, 2.6);
      for (let k = 0; k < 3; k++) grow(n.x, n.y, Math.PI / 2 + (k - 1) * 1.1 + S.rr(-0.2, 0.2), S.rr(18, 28), 2, 1.8);
    }
    S.neu.sort((a, b) => a.y - b.y);
    for (let i = 0; i < S.neu.length; i++) {
      const n = S.neu[i], m = S.neu[i + 1], st = [n.x, n.y + n.r * 0.8];
      let end;
      if (m) { const tip = m.tips.slice().sort((p, q) => Math.hypot(p[0] - n.x, p[1] - n.y) - Math.hypot(q[0] - n.x, q[1] - n.y))[0], dx = n.x - tip[0], dy = n.y - tip[1], l = Math.hypot(dx, dy) || 1; end = [tip[0] + dx / l * 6, tip[1] + dy / l * 6]; n.tgt = tip; }
      else end = [clamp(n.x + S.rr(-110, 110), 20, W - 20), H + 30];
      n.ax = spline([st, [st[0] + S.rr(-6, 6), st[1] + 16], [(st[0] + end[0]) / 2 + S.rr(-40, 40), (st[1] + end[1]) / 2 + S.rr(-20, 30)], end]);
      n.target = m || null; n.bouton = end;
      n.nodes = []; for (let s = 24; s < n.ax.len - 8; s += 26) n.nodes.push(s);
    }
    S.astro = [];
    for (let t = 0; t < 300 && S.astro.length < 2; t++) { const x = S.rr(30, W - 30), y = S.rr(30, H - 30); if ([...S.neu, ...S.astro].some((o) => Math.hypot(o.x - x, o.y - y) < 70)) continue; S.astro.push({ x, y, r: 6, arms: Array.from({ length: 7 }, (_, k) => ({ a: k / 7 * TAU + S.rr(-0.3, 0.3), l: S.rr(14, 26), w: S.rr(0, TAU) })), t: S.rr(1, 4) }); }
    S.obst = [...S.neu.map((n) => ({ x: n.x, y: n.y, r: n.r + 12 })), ...S.astro.map((a) => ({ x: a.x, y: a.y, r: 14 }))];
    meshBed(S, 6, { wiggle: 18 });
    for (const a of S.astro) {
      let best = null, bd = 1e9;
      for (const v of S.vessels) { const [d, s] = v.L.near(a.x, a.y); if (d < bd) { bd = d; best = { v, s }; } }
      const [vx, vy, nx, ny] = best.v.L.at(best.s), sd = (a.x - vx) * nx + (a.y - vy) * ny > 0 ? 1 : -1;
      a.foot = [vx + nx * sd * (best.v.r + 2), vy + ny * sd * (best.v.r + 2)];
      const nn = S.neu.slice().sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
      a.neu = nn; a.reach = [mix(a.x, nn.x, 0.75), mix(a.y, nn.y, 0.75)];
    }
    S.glia = Array.from({ length: 2 }, () => ({ x: S.rr(30, W - 30), y: S.rr(30, H - 30), arms: Array.from({ length: 6 }, (_, k) => ({ a: k / 6 * TAU + S.rr(-0.4, 0.4), l: S.rr(8, 16), ph: S.R() * TAU })), vx: 0, vy: 0 }));
    S.spikes = [];
    blood(S, 72, 1);
  },
  exchange(S, b, dt) { if (typeof b.on === 'number') giveO2(S, b, dt, [...S.neu, ...S.astro], 0.8 + S.act * 0.6); },
  step(S, dt) {
    for (const n of S.neu) {
      n.glow = Math.max(0, n.glow - dt * 2); n.dglow = Math.max(0, n.dglow - dt * 1.5);
      const rate = S.ev ? 0.07 + (S.R() < dt * 0.08 ? 3 : 0) : 0.12 + 0.3 * S.act;
      n.v += dt * rate * (0.4 + S.R());
      if (n.v >= 1) { n.v = 0; n.glow = 1; S.spikes.push({ n, s: 0 }); say(S, 'fire', n.x, n.y); }
    }
    for (let i = S.spikes.length - 1; i >= 0; i--) {
      const sp = S.spikes[i], n = sp.n; sp.s += 150 * dt;
      if (sp.s >= n.ax.len) {
        S.spikes.splice(i, 1);
        if (n.target) {
          for (let k = 0; k < 7; k++) emit(S, { kind: 'nt', x: n.bouton[0] + S.rr(-2, 2), y: n.bouton[1] + S.rr(-2, 2), to: n.tgt, reach: 2, pull: 60, jit: 30, life: 0.9 });
          n.target.v += S.rr(0.35, 0.6); n.target.dglow = 1;
          say(S, 'syn', n.bouton[0], n.bouton[1]);
        }
      }
    }
    for (const a of S.astro) {
      a.t -= dt * (0.5 + S.act);
      if (a.t <= 0) {
        a.t = S.rr(2.5, 5);
        const path = spline([a.foot, [mix(a.foot[0], a.x, 0.5), mix(a.foot[1], a.y, 0.5)], [a.x, a.y], a.reach, [a.neu.x, a.neu.y]]);
        emit(S, { kind: 'glu', x: a.foot[0], y: a.foot[1], path, speed: 30, life: path.len / 30 + 0.5, done: () => { a.neu.v += 0.05; } });
        say(S, 'astro', a.x, a.y);
      }
    }
    for (const g of S.glia) {
      g.vx += (S.R() - 0.5) * 8 * dt; g.vy += (S.R() - 0.5) * 8 * dt; g.vx *= 0.98; g.vy *= 0.98;
      g.x = clamp(g.x + g.vx * dt, 20, W - 20); g.y = clamp(g.y + g.vy * dt, 20, H - 20);
      for (const a of g.arms) a.ph += dt * S.rr(0.5, 1.2);
      if (S.R() < dt * 0.05) say(S, 'micro', g.x, g.y);
    }
  },
  over(S, c, now) {
    const ev = S.ev, t = now / 1000;
    // astrocytes: star-shaped, one arm on the capillary (its endfoot), one reaching a neuron
    for (const a of S.astro) {
      c.strokeStyle = ev ? 'rgba(170,200,255,.55)' : 'rgba(255,210,170,.6)'; c.lineCap = 'round';
      for (const m of a.arms) { c.lineWidth = 2; c.beginPath(); c.moveTo(a.x, a.y); const x2 = a.x + Math.cos(m.a) * m.l, y2 = a.y + Math.sin(m.a) * m.l; c.quadraticCurveTo(a.x + Math.cos(m.a + 0.4) * m.l * 0.5, a.y + Math.sin(m.a + 0.4) * m.l * 0.5, x2, y2); c.stroke(); }
      c.lineWidth = 2.6; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(...a.foot); c.moveTo(a.x, a.y); c.lineTo(...a.reach); c.stroke();
      c.fillStyle = ev ? 'rgba(170,200,255,.75)' : 'rgba(255,210,170,.8)'; c.beginPath(); c.ellipse(a.foot[0], a.foot[1], 4.5, 2.6, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(a.x, a.y, a.r, 0, TAU); c.fill();
    }
    // neurons: dendrite trees, a pyramidal body, an axon with myelin and a bouton at the end
    for (const n of S.neu) {
      c.strokeStyle = n.dglow > 0 ? `rgba(200,255,230,${0.55 + n.dglow * 0.4})` : ev ? 'rgba(200,180,250,.6)' : 'rgba(255,220,200,.62)'; c.lineCap = 'round';
      for (const [x1, y1, x2, y2, w] of n.dend) { c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
      const L = n.ax;
      c.strokeStyle = ev ? 'rgba(200,180,250,.7)' : 'rgba(255,220,200,.75)'; c.lineWidth = 1.3; c.beginPath(); L.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      c.strokeStyle = ev ? 'rgba(235,230,255,.55)' : 'rgba(255,245,225,.6)'; c.lineWidth = 4.2;
      for (let k = 0; k + 1 < n.nodes.length; k++) { c.beginPath(); for (let s = n.nodes[k] + 2; s <= n.nodes[k + 1] - 2; s += 3) { const [x, y] = L.at(s); if (s === n.nodes[k] + 2) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }
      if (n.target) { c.fillStyle = ev ? 'rgba(220,200,255,.85)' : 'rgba(255,230,210,.9)'; c.beginPath(); c.arc(n.bouton[0], n.bouton[1], 3.2, 0, TAU); c.fill(); }
      const g = n.glow, col = ev ? `hsla(${265 - g * 60},${40 + g * 40}%,${50 + g * 25}%,.9)` : `hsla(${15 + g * 30},${45 + g * 40}%,${55 + g * 20}%,.9)`;
      c.fillStyle = col; c.beginPath(); c.moveTo(n.x, n.y - n.r * 1.5); c.quadraticCurveTo(n.x + n.r * 1.3, n.y + n.r * 0.3, n.x + n.r * 0.6, n.y + n.r); c.quadraticCurveTo(n.x, n.y + n.r * 1.25, n.x - n.r * 0.6, n.y + n.r); c.quadraticCurveTo(n.x - n.r * 1.3, n.y + n.r * 0.3, n.x, n.y - n.r * 1.5); c.fill();
      c.fillStyle = ev ? 'rgba(70,50,120,.85)' : 'rgba(110,40,70,.8)'; c.beginPath(); c.arc(n.x, n.y + n.r * 0.1, n.r * 0.42, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(n.x + 1, n.y, 1.4, 0, TAU); c.fill();
      // the membrane filling up toward its threshold
      c.strokeStyle = `rgba(255,255,220,${0.15 + n.v * 0.4})`; c.lineWidth = 1; c.beginPath(); c.arc(n.x, n.y + n.r * 0.1, n.r * 0.7, -Math.PI / 2, -Math.PI / 2 + n.v * TAU); c.stroke();
    }
    // the spikes: a bright point at the last node passed (it leaps), and the axon lit behind it
    for (const sp of S.spikes) {
      const n = sp.n, nodes = n.nodes, k = nodes.filter((s) => s <= sp.s).length, s = k ? nodes[k - 1] : 0, [x, y] = n.ax.at(Math.max(s, Math.min(sp.s, 6)));
      const g = c.createRadialGradient(x, y, 0, x, y, 11); g.addColorStop(0, 'rgba(255,255,230,.95)'); g.addColorStop(1, 'rgba(255,255,230,0)'); c.fillStyle = g; c.fillRect(x - 11, y - 11, 22, 22);
    }
    // microglia: a small body and fine arms reaching out and drawing back
    for (const g of S.glia) {
      c.strokeStyle = ev ? 'rgba(160,240,220,.6)' : 'rgba(220,255,200,.6)'; c.lineWidth = 1;
      for (const a of g.arms) { const l = a.l * (0.6 + 0.4 * Math.sin(a.ph)), x2 = g.x + Math.cos(a.a) * l, y2 = g.y + Math.sin(a.a) * l; c.beginPath(); c.moveTo(g.x, g.y); c.lineTo(x2, y2); c.lineTo(x2 + Math.cos(a.a + 0.8) * l * 0.4, y2 + Math.sin(a.a + 0.8) * l * 0.4); c.stroke(); }
      c.fillStyle = ev ? 'rgba(160,240,220,.85)' : 'rgba(220,255,200,.85)'; c.beginPath(); c.ellipse(g.x, g.y, 4.5, 3.4, t * 0.2, 0, TAU); c.fill();
    }
  }
};

// ------------------------------------------------ a wound, and the immune system answering
const wound = {
  title: 'wound',
  lines: { morning: ['A scrape you never noticed: your immune cells are already there.', 'Inside a small cut, right now: first responders at work.'], evening: ['Tonight the wound closes: immune cells clear it, new tissue fills it.', 'While you sleep, the small wounds close.'] },
  idle: ['start', 'heal', 'collagen'],
  say: {
    start: ['A small wound: bacteria have slipped in'], heal: ['The tissue around the wound grows back into the gap'], collagen: ['Fibroblasts lay down fresh collagen'],
    out: ['A neutrophil grips the vessel wall and squeezes through it'], eat: ['It tracks the bacteria by scent… and swallows one'], plug: ['Platelets clump over a leak; fibrin knits them tight'],
    mac: ['A macrophage engulfs the debris'], divide: ['A cell at the edge divides to fill the gap'], bac: ['A bacterium divides; the hunt goes on']
  },
  build(S) {
    meshBed(S, 6);
    const V = S.net.V;
    // the wound: away from the vessels, but near the venule (so the neutrophils can get there)
    let w = null;
    for (let t = 0; t < 400 && !w; t++) { const x = S.rr(70, W - 70), y = S.rr(70, H - 70), d = nearVessel(S, x, y), [dv] = V.L.near(x, y); if (d > 34 && dv < 120) w = { x, y, r: 40 }; }
    S.wound = w || { x: W / 2, y: H / 2, r: 40 };
    const [, vs] = V.L.near(S.wound.x, S.wound.y);
    S.exitS = vs;
    S.cells = fillCells(S, 22, 14, 22, (x, y, r) => Math.hypot(x - S.wound.x, y - S.wound.y) < S.wound.r * 0.6 + r * 0.3);
    for (const c of S.cells) { const d = Math.hypot(c.x - S.wound.x, c.y - S.wound.y); if (d < S.wound.r * 1.4) c.damage = 0.9 - d / (S.wound.r * 1.4) * 0.5; }
    S.debris = Array.from({ length: 20 }, () => { const a = S.R() * TAU, d = S.R() * S.wound.r; return { x: S.wound.x + Math.cos(a) * d, y: S.wound.y + Math.sin(a) * d, r: S.rr(1.2, 2.6), life: 1 }; });
    S.bac = Array.from({ length: 7 }, () => { const a = S.R() * TAU, d = S.R() * S.wound.r * 0.8; return { x: S.wound.x + Math.cos(a) * d, y: S.wound.y + Math.sin(a) * d, a: S.R() * TAU, t: S.rr(5, 12), by: null, k: 0 }; });
    // a leak in the capillary nearest the wound
    let best = null, bd = 1e9;
    S.net.C.forEach((cp, i) => { const [d, s] = cp.L.near(S.wound.x, S.wound.y); if (d < bd) { bd = d; best = { i, s }; } });
    const [lx, ly, nx, ny] = S.net.C[best.i].L.at(best.s), sd = (S.wound.x - lx) * nx + (S.wound.y - ly) * ny > 0 ? 1 : -1;
    S.leak = { ...best, x: lx + nx * sd * 6, y: ly + ny * sd * 6, nx: nx * sd, ny: ny * sd, plug: 0, stuck: [], fib: [] };
    S.spill = [];
    S.hunters = []; S.next = 2;
    S.mac = { x: S.wound.x + S.rr(-60, 60), y: S.wound.y + S.rr(-60, 60), r: 13, tg: null, ate: 0, ph: 0 };
    S.fibro = Array.from({ length: 2 }, (_, k) => { const a = S.R() * TAU; return { x: S.wound.x + Math.cos(a) * S.wound.r * 1.3, y: S.wound.y + Math.sin(a) * S.wound.r * 1.3, a: a + Math.PI, trail: [], k }; });
    blood(S, 72, 1);
  },
  exchange(S, b, dt) {
    if (typeof b.on !== 'number') return;
    giveO2(S, b, dt, S.cells, 1);
    const L = S.leak;
    if (b.on === L.i && Math.abs(b.s - L.s) < 2 && L.plug < 1 && S.spill.length < 8 && S.R() < 0.25) { const [x, y] = bodyAt(S, b); S.spill.push({ x, y, vx: L.nx * 8, vy: L.ny * 8, rot: b.rot, life: 1 }); respawn(S, b); }
  },
  step(S, dt) {
    const L = S.leak, w = S.wound;
    // platelets stick at the leak, and fibrin knits over them
    for (const p of S.plt) if (p.on === L.i && Math.abs(p.s - L.s) < 2.5 && L.plug < 1 && S.R() < 0.5) {
      L.plug = Math.min(1, L.plug + 0.06); L.stuck.push([S.rr(-5, 5), S.rr(-3, 3)]); respawn(S, p);
      if (L.plug > 0.35 && L.fib.length < 10) L.fib.push([S.rr(0, TAU), S.rr(6, 11)]);
      say(S, 'plug', L.x, L.y);
    }
    for (const r of S.spill) { r.x += r.vx * dt; r.y += r.vy * dt; r.vx *= 0.96; r.vy *= 0.96; }
    // neutrophils: roll along the venule, stop at the wound, squeeze out and hunt
    S.next -= dt * (0.4 + S.act);
    if (S.next <= 0 && S.hunters.length < 4) { S.next = S.rr(4, 8); S.wbc.push({ on: 'V', s: Math.max(0, S.exitS - S.rr(60, 140)), v: 0.85, size: 8.5, ph: S.R() * TAU, sp: 1, state: 'roll', hunter: true }); }
    for (const n of S.wbc) {
      if (n.state === 'roll' && n.hunter && Math.abs(n.s - S.exitS) < 3) {
        const [x, y, nx, ny] = S.net.V.L.at(n.s), sd = (w.x - x) * nx + (w.y - y) * ny > 0 ? 1 : -1;
        Object.assign(n, { state: 'out', k: 0, x0: x + nx * sd * S.net.V.r * 0.5, y0: y + ny * sd * S.net.V.r * 0.5, nx: nx * sd, ny: ny * sd });
        say(S, 'out', x, y, true);
      }
      if (n.state === 'out') {
        n.k += dt / 2.6; n.x = n.x0 + n.nx * n.k * 22; n.y = n.y0 + n.ny * n.k * 22;
        if (n.k >= 1) { n.state = 'hunt'; n.ate = 0; S.hunters.push(n); }
      }
    }
    S.wbc = S.wbc.filter((n) => n.state === 'roll' || n.state === 'out');
    for (const n of S.hunters) {
      n.ph += dt * 3;
      if (n.dying !== undefined) { n.dying -= dt * 0.25; continue; }
      const tg = S.bac.filter((b) => !b.by).sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))[0];
      const gx = tg ? tg.x : w.x + Math.cos(n.ph * 0.2) * 20, gy = tg ? tg.y : w.y + Math.sin(n.ph * 0.2) * 20, dx = gx - n.x, dy = gy - n.y, d = Math.hypot(dx, dy) || 1;
      n.dir = Math.atan2(dy, dx);
      const v = (7 + 6 * S.act) * (0.7 + 0.3 * Math.sin(n.ph));
      n.x += dx / d * v * dt; n.y += dy / d * v * dt;
      if (tg && d < n.size + 2) { tg.by = n; tg.k = 0; n.ate++; say(S, 'eat', n.x, n.y, true); if (n.ate >= 3) n.dying = 1; }
    }
    S.hunters = S.hunters.filter((n) => n.dying === undefined || n.dying > 0);
    for (const n of S.hunters) if (n.dying !== undefined && n.dying < 0.3 && !n.left) { n.left = true; S.debris.push({ x: n.x, y: n.y, r: 3.5, life: 1 }); }
    // bacteria: swim, divide, get swallowed
    for (const b of S.bac) {
      if (b.by) { b.k += dt; b.x = mix(b.x, b.by.x, 0.1); b.y = mix(b.y, b.by.y, 0.1); continue; }
      b.a += (S.R() - 0.5) * 3 * dt; b.x += Math.cos(b.a) * 6 * dt; b.y += Math.sin(b.a) * 6 * dt;
      if (Math.hypot(b.x - w.x, b.y - w.y) > w.r * 1.5) b.a = Math.atan2(w.y - b.y, w.x - b.x);
      b.t -= dt;
      if (b.t <= 0) { b.t = S.rr(7, 13); if (S.bac.filter((q) => !q.by).length < 11) { S.bac.push({ x: b.x + Math.cos(b.a) * 4, y: b.y + Math.sin(b.a) * 4, a: b.a + S.rr(-0.5, 0.5), t: S.rr(7, 13), by: null, k: 0 }); say(S, 'bac', b.x, b.y); } }
    }
    S.bac = S.bac.filter((b) => !b.by || b.k < 1.3);
    // the macrophage: slow and large, cleaning up debris, spilled red cells and spent neutrophils
    const M = S.mac; M.ph += dt;
    if (!M.tg || M.tg.life <= 0) M.tg = [...S.debris.filter((d) => d.life > 0.3), ...S.spill.filter((r) => r.life > 0.3)].sort((a, b) => Math.hypot(a.x - M.x, a.y - M.y) - Math.hypot(b.x - M.x, b.y - M.y))[0] || null;
    if (M.tg) { const dx = M.tg.x - M.x, dy = M.tg.y - M.y, d = Math.hypot(dx, dy) || 1; M.dir = Math.atan2(dy, dx); M.x += dx / d * (4 + 3 * S.act) * dt; M.y += dy / d * (4 + 3 * S.act) * dt; if (d < M.r) { M.tg.life -= dt * 0.8; if (M.tg.life <= 0.3 && !M.tg.said) { M.tg.said = true; say(S, 'mac', M.x, M.y); } } }
    S.debris = S.debris.filter((d) => d.life > 0); S.spill = S.spill.filter((r) => r.life > 0);
    // fibroblasts crawl in, laying collagen behind them
    for (const f of S.fibro) {
      const d = Math.hypot(f.x - w.x, f.y - w.y);
      if (d > w.r * 0.25) { f.a += (S.R() - 0.5) * 0.6 * dt; const ta = Math.atan2(w.y - f.y, w.x - f.x); f.a += ((ta - f.a + Math.PI * 3) % TAU - Math.PI) * dt * 0.3; f.x += Math.cos(f.a) * 2.2 * dt * (0.5 + S.act); f.y += Math.sin(f.a) * 2.2 * dt * (0.5 + S.act); }
      const last = f.trail[f.trail.length - 1];
      if (!last || Math.hypot(last[0] - f.x, last[1] - f.y) > 5) { f.trail.push([f.x, f.y]); if (f.trail.length > 26) f.trail.shift(); if (f.trail.length === 10 && !f.said) { f.said = true; say(S, 'collagen', f.x, f.y); } }
    }
    stepCells(S, S.cells, dt, (c) => (Math.hypot(c.x - w.x, c.y - w.y) < w.r * 1.6 ? [w.x, w.y] : null));
    for (const d of S.debris) d.life -= dt * (S.ev ? 0.012 : 0.008);
  },
  under(S, c) {
    const w = S.wound;
    const g = c.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r * 1.3); g.addColorStop(0, S.ev ? 'rgba(80,30,60,.35)' : 'rgba(120,20,30,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(w.x - w.r * 1.4, w.y - w.r * 1.4, w.r * 2.8, w.r * 2.8);
    // collagen behind the fibroblasts
    c.strokeStyle = S.ev ? 'rgba(220,210,255,.35)' : 'rgba(255,235,215,.42)'; c.lineWidth = 1.3;
    for (const f of S.fibro) for (const o of [-2, 0, 2]) { c.beginPath(); f.trail.forEach(([x, y], i) => (i ? c.lineTo(x + o, y + Math.sin(i + o) * 1.2) : c.moveTo(x + o, y))); c.stroke(); }
    for (const d of S.debris) { c.fillStyle = `rgba(70,35,45,${0.55 * d.life})`; c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU); c.fill(); }
    for (const r of S.spill) { c.fillStyle = `rgba(200,50,60,${0.7 * r.life})`; c.beginPath(); c.ellipse(r.x, r.y, 5, 3.6, r.rot, 0, TAU); c.fill(); }
  },
  over(S, c, now) {
    const t = now / 1000, ev = S.ev;
    for (const cell of S.cells) drawCell(c, cell, S, now);
    // the plug over the leak: platelets and fibrin threads
    const L = S.leak;
    c.fillStyle = ev ? 'rgba(200,170,255,.85)' : 'rgba(220,180,255,.85)';
    for (const [x, y] of L.stuck) { c.beginPath(); c.arc(L.x + x, L.y + y, 2, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(255,250,235,.6)'; c.lineWidth = 0.8;
    for (const [a, l] of L.fib) { c.beginPath(); c.moveTo(L.x - Math.cos(a) * l, L.y - Math.sin(a) * l); c.lineTo(L.x + Math.cos(a) * l, L.y + Math.sin(a) * l); c.stroke(); }
    // bacteria: little rods
    for (const b of S.bac) { c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.globalAlpha = b.by ? Math.max(0, 1 - b.k / 1.3) : 1; c.fillStyle = '#9ad06a'; c.beginPath(); c.roundRect(-4, -1.6, 8, 3.2, 1.6); c.fill(); c.fillStyle = 'rgba(40,70,20,.6)'; c.fillRect(-0.5, -1.6, 1, 3.2); c.restore(); }
    c.globalAlpha = 1;
    // fibroblasts: long spindles
    for (const f of S.fibro) { c.save(); c.translate(f.x, f.y); c.rotate(f.a); c.fillStyle = ev ? 'rgba(200,190,240,.8)' : 'rgba(250,210,190,.85)'; c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(0, -5, 14, 0); c.quadraticCurveTo(0, 5, -14, 0); c.fill(); c.fillStyle = ev ? 'rgba(90,70,140,.8)' : 'rgba(130,60,70,.8)'; c.beginPath(); c.ellipse(0, 0, 4, 2, 0, 0, TAU); c.fill(); c.restore(); }
    // neutrophils squeezing out through the wall, then crawling
    const blob = (x, y, r, dir, k, a = 0.9) => {
      c.fillStyle = `rgba(238,238,248,${a})`; c.beginPath();
      for (let i = 0; i <= 20; i++) { const q = i / 20 * TAU, lead = Math.max(0, Math.cos(q - dir)) ** 3 * 0.35 * k, rr = r * (1 + 0.08 * Math.sin(q * 5 + t * 3) + lead); c[i ? 'lineTo' : 'moveTo'](x + Math.cos(q) * rr, y + Math.sin(q) * rr); }
      c.fill();
      c.fillStyle = `rgba(120,90,180,${a * 0.8})`; for (let l = 0; l < 3; l++) { c.beginPath(); c.arc(x + Math.cos(l * 2.1 + t * 0.5) * r * 0.35, y + Math.sin(l * 2.1 + t * 0.5) * r * 0.35, r * 0.3, 0, TAU); c.fill(); }
    };
    for (const n of S.wbc) if (n.state === 'out') {
      // half through: two lobes with a waist at the wall
      const k = n.k, ox = n.x0 + n.nx * 11, oy = n.y0 + n.ny * 11, a1 = clamp(1 - k * 1.4, 0, 1), a2 = clamp(k * 1.4, 0, 1);
      if (a1 > 0) blob(ox - n.nx * (6 + 4 * (1 - k)), oy - n.ny * (6 + 4 * (1 - k)), n.size * (0.35 + 0.65 * a1), 0, 0);
      if (a2 > 0) blob(ox + n.nx * (2 + 10 * k), oy + n.ny * (2 + 10 * k), n.size * (0.35 + 0.65 * a2), Math.atan2(n.ny, n.nx), 1);
    }
    for (const n of S.hunters) blob(n.x, n.y, n.size, n.dir || 0, 1, n.dying !== undefined ? 0.9 * Math.max(0, n.dying) : 0.9);
    // the macrophage
    const M = S.mac;
    c.fillStyle = ev ? 'rgba(200,220,240,.62)' : 'rgba(240,225,200,.66)'; c.beginPath();
    for (let i = 0; i <= 26; i++) { const q = i / 26 * TAU, rr = M.r * (1 + 0.12 * Math.sin(q * 3 + M.ph * 1.2) + 0.25 * Math.max(0, Math.cos(q - (M.dir || 0))) ** 4); c[i ? 'lineTo' : 'moveTo'](M.x + Math.cos(q) * rr, M.y + Math.sin(q) * rr); }
    c.fill();
    c.fillStyle = ev ? 'rgba(80,80,140,.75)' : 'rgba(120,70,60,.75)'; c.beginPath(); c.ellipse(M.x - 3, M.y + 1, 5.5, 4, 0.4, 0, TAU); c.fill();
    c.fillStyle = 'rgba(120,60,60,.5)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(M.x + Math.cos(k * 1.7 + 1) * 6, M.y + Math.sin(k * 1.7 + 1) * 6, 1.6, 0, TAU); c.fill(); }
  }
};

// ------------------------------------------------ lung
const lung = {
  title: 'lung',
  lines: { morning: ['Your breath is deepening: each sac fills and the blood leaves it bright red.', 'Three hundred million alveoli, and this is one handful. Breathe in.'], evening: ['Slow breaths now: the sacs fill and empty, and the blood takes what it needs.', 'Breathing out the day: carbon dioxide leaves, oxygen comes in.'] },
  idle: ['sacs', 'swap', 'co2'],
  say: {
    sacs: ['Alveoli: air sacs a hair’s breadth from the blood'], swap: ['Oxygen slips across into each passing red cell; it brightens'], co2: ['Carbon dioxide leaves the blood, to be breathed out'],
    inhale: ['Breathing in: the sacs swell with fresh air', 'A slow breath in: the sacs swell'], surf: ['A type II cell spreads surfactant, so the sacs stay open'], mac: ['An alveolar macrophage sweeps up a speck of dust']
  },
  build(S) {
    // the capillaries first, a dense mesh; then the air sacs fill the spaces between them, as in
    // the lung, where the capillaries run in the thin walls between alveoli
    meshBed(S, 7, { wiggle: 26, links: 7 });
    S.sacs = [];
    const room = (x, y) => Math.min(nearVessel(S, x, y) - 4, ...S.sacs.map((q) => Math.hypot(q.x - x, q.y - y) - q.r0 - 5));
    for (let pass = 0; pass < 12; pass++) {
      let best = null;
      for (let t = 0; t < 260; t++) { const x = S.rr(-10, W + 10), y = S.rr(-10, H + 10), r = Math.min(58, room(x, y)); if (r > 16 && (!best || r > best.r)) best = { x, y, r }; }
      if (!best) break;
      S.sacs.push({ x: best.x, y: best.y, r0: best.r * 0.94, r: best.r * 0.94, type1: Array.from({ length: 3 + Math.floor(best.r / 15) }, () => S.R() * TAU), type2: S.R() < 0.6 ? { a: S.R() * TAU, t: S.rr(2, 8) } : null });
    }
    if (!S.sacs.length) S.sacs.push({ x: W / 2, y: H / 2, r0: 30, r: 30, type1: [0, 2, 4], type2: null });
    const host = S.sacs.slice().sort((a, b) => Math.hypot(a.x - W / 2, a.y - H / 2) - Math.hypot(b.x - W / 2, b.y - H / 2))[0];
    S.amac = { s: host, x: host.x, y: host.y, a: 0, ph: 0 };
    S.dust = Array.from({ length: 3 }, () => ({ x: host.x + S.rr(-20, 20), y: host.y + S.rr(-20, 20), life: 1 }));
    S.breath = 0; S.bt = 0;
    blood(S, 80, 0.3);
  },
  exchange(S, b, dt) {
    if (typeof b.on !== 'number' || b.o2 >= 1) return;
    const [x, y] = bodyAt(S, b);
    const q = S.sacs.find((s) => Math.hypot(s.x - x, s.y - y) < s.r + 14);
    if (!q) return;
    b.o2 = Math.min(1, b.o2 + dt * 0.5);
    if (S.R() < dt * 3) { const a = Math.atan2(y - q.y, x - q.x); emit(S, { kind: 'o2', x: q.x + Math.cos(a) * q.r * 0.6, y: q.y + Math.sin(a) * q.r * 0.6, to: [x, y], reach: 4, pull: 50, life: 2 }); }
    if (S.R() < dt * 2) emit(S, { kind: 'co2', x, y, to: [q.x + S.rr(-10, 10), q.y + S.rr(-10, 10)], reach: 8, pull: 25, life: 3 });
    if (S.R() < dt * 0.6) say(S, S.R() < 0.6 ? 'swap' : 'co2', x, y);
  },
  step(S, dt) {
    const bpm = S.ev ? 13 - 4 * Math.min(1, S.t / 50) : 11 + 5 * Math.min(1, S.t / 40);
    const was = S.breath; S.bt += dt * bpm / 60;
    S.breath = 0.5 - 0.5 * Math.cos(S.bt * TAU);
    if (S.breath > was && Math.sin(S.bt * TAU) > 0 && Math.sin((S.bt - dt * bpm / 60) * TAU) <= 0) say(S, 'inhale');
    for (const q of S.sacs) {
      q.r = q.r0 * (1 + 0.06 * S.breath);
      if (S.breath > was && S.R() < dt * 4) { const a = S.R() * TAU; emit(S, { kind: 'o2', x: q.x + Math.cos(a) * q.r * 0.5, y: q.y + Math.sin(a) * q.r * 0.5, jit: 30, life: 1.2, alpha: 0.5 }); }
      if (q.type2 && (q.type2.t -= dt) <= 0) {
        q.type2.t = S.rr(5, 10);
        const a = q.type2.a, x = q.x + Math.cos(a) * q.r * 0.92, y = q.y + Math.sin(a) * q.r * 0.92;
        for (let k = 0; k < 8; k++) emit(S, { kind: 'surf', x, y, to: [q.x + Math.cos(a + S.rr(-1.2, 1.2)) * q.r * 0.88, q.y + Math.sin(a + S.rr(-1.2, 1.2)) * q.r * 0.88], reach: 3, pull: 20, jit: 15, life: 2.5 });
        say(S, 'surf', x, y);
      }
    }
    // the alveolar macrophage, wandering in its sac after dust
    const M = S.amac, q = M.s; M.ph += dt;
    const d0 = S.dust.find((d) => d.life > 0);
    const gx = d0 ? d0.x : q.x + Math.cos(M.ph * 0.3) * q.r * 0.4, gy = d0 ? d0.y : q.y + Math.sin(M.ph * 0.3) * q.r * 0.4, dx = gx - M.x, dy = gy - M.y, d = Math.hypot(dx, dy) || 1;
    M.a = Math.atan2(dy, dx); M.x += dx / d * 5 * dt; M.y += dy / d * 5 * dt;
    if (d0 && d < 6) { d0.life -= dt * 0.6; if (d0.life <= 0) say(S, 'mac', M.x, M.y); }
    if (!d0 && S.R() < dt * 0.1) S.dust.push({ x: q.x + S.rr(-q.r, q.r) * 0.5, y: q.y + S.rr(-q.r, q.r) * 0.5, life: 1 });
  },
  under(S, c) {
    const ev = S.ev;
    for (const q of S.sacs) {
      const g = c.createRadialGradient(q.x, q.y, q.r * 0.2, q.x, q.y, q.r);
      g.addColorStop(0, ev ? `rgba(40,30,70,${0.55 + S.breath * 0.2})` : `rgba(255,240,236,${0.3 + S.breath * 0.15})`); g.addColorStop(1, ev ? 'rgba(90,70,140,.35)' : 'rgba(255,215,215,.16)');
      c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, q.r, 0, TAU); c.fill();
      c.strokeStyle = ev ? 'rgba(200,180,255,.7)' : 'rgba(255,210,215,.8)'; c.lineWidth = 2.6; c.stroke();
      // flat type I cells along the wall, and a plump type II cell with its surfactant granules
      c.fillStyle = ev ? 'rgba(120,90,170,.8)' : 'rgba(170,70,90,.75)';
      for (const a of q.type1) { c.beginPath(); c.ellipse(q.x + Math.cos(a) * q.r, q.y + Math.sin(a) * q.r, 6, 1.8, a + Math.PI / 2, 0, TAU); c.fill(); }
      if (q.type2) {
        const a = q.type2.a, x = q.x + Math.cos(a) * q.r * 0.93, y = q.y + Math.sin(a) * q.r * 0.93;
        c.fillStyle = ev ? 'rgba(200,180,240,.85)' : 'rgba(250,200,190,.9)'; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,240,.8)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + Math.cos(k * 1.6) * 3, y + Math.sin(k * 1.6) * 3, 1.1, 0, TAU); c.fill(); }
      }
    }
    for (const d of S.dust) if (d.life > 0) { c.fillStyle = `rgba(90,80,70,${0.8 * d.life})`; c.beginPath(); c.arc(d.x, d.y, 2, 0, TAU); c.fill(); }
  },
  over(S, c) {
    const M = S.amac;
    c.fillStyle = S.ev ? 'rgba(210,220,250,.7)' : 'rgba(245,230,210,.75)'; c.beginPath();
    for (let i = 0; i <= 22; i++) { const q = i / 22 * TAU, rr = 9 * (1 + 0.1 * Math.sin(q * 4 + M.ph * 2) + 0.3 * Math.max(0, Math.cos(q - M.a)) ** 4); c[i ? 'lineTo' : 'moveTo'](M.x + Math.cos(q) * rr, M.y + Math.sin(q) * rr); }
    c.fill(); c.fillStyle = 'rgba(100,80,90,.7)'; c.beginPath(); c.arc(M.x - 2, M.y, 3.5, 0, TAU); c.fill();
  }
};

// ------------------------------------------------ gut
const gut = {
  title: 'gut',
  lines: { morning: ['Breakfast, close up: a villus in your small intestine, catching the meal.', 'The lining of your gut renews itself every few days. Here it is at work.'], evening: ['At night the gut sweeps itself clean, and new lining climbs from the crypts.', 'Slow digestion now: the villi take the last of the day’s food.'] },
  idle: ['villus', 'renew', 'sugar'],
  say: {
    villus: ['The lining of the small intestine: a villus reaching into the food'], sugar: ['Microvilli catch sugars and amino acids from the meal'], cap: ['Absorbed sugar slips into a capillary, bound for the liver'],
    fat: ['Fats take another road: into the lacteal, a lymph vessel'], goblet: ['A goblet cell spills mucus to keep the lining slick'], shed: ['At the tip an old cell is shed; new ones climb from the crypt'], renew: ['The whole lining creeps upward, renewing itself every few days']
  },
  build(S) {
    const cx = W / 2 + S.rr(-30, 30), hw = S.rr(78, 92), top = S.rr(34, 52), th = 22;
    S.vil = { cx, hw, top, th };
    // the villus outline (outer surface), from the bottom-left up and round and down to the bottom-right
    const outer = [];
    for (let y = H + 30; y > top + hw; y -= 6) outer.push([cx - hw + Math.sin(y * 0.03) * 3, y]);
    for (let k = 0; k <= 24; k++) { const a = Math.PI + k / 24 * Math.PI; outer.push([cx + Math.cos(a) * hw, top + hw + Math.sin(a) * hw]); }
    for (let y = top + hw; y < H + 30; y += 6) outer.push([cx + hw + Math.sin(y * 0.03 + 1) * 3, y]);
    S.surf = line(outer);
    S.offset = 0; S.cellL = 13;
    S.goblets = new Set(Array.from({ length: 6 }, () => Math.floor(S.R() * 40)));
    const ia = hw - th - 14, aCtrl = [[cx - ia, H + 40], [cx - ia + 4, top + hw + 40], [cx - ia * 0.7, top + hw * 0.55], [cx - 6, top + th + 16]];
    const vCtrl = [[cx + 6, top + th + 16], [cx + ia * 0.7, top + hw * 0.55], [cx + ia - 4, top + hw + 40], [cx + ia, H + 40]];
    const A = spline(aCtrl), V = spline(vCtrl);
    // rungs across the villus, arching over the lacteal in the middle
    const rungs = [0.15, 0.32, 0.5, 0.68, 0.84, 1].map((f, i, all) => { const aS = f * A.len, vS = (1 - f) * V.len, [ax, ay] = A.at(aS), [vx, vy] = V.at(vS), my = Math.min(ay, vy) - 14 - i * 2; return { aS, vS: i === all.length - 1 ? 0 : vS, via: [[mix(ax, vx, 0.3), my], [mix(ax, vx, 0.7), my]] }; });
    bed(S, aCtrl, vCtrl, rungs, { iters: 0, ra: 8, rv: 9, rc: 5 });
    S.lacteal = { L: spline([[cx, H + 40], [cx + 2, top + hw + 30], [cx, top + hw * 0.7]]), r: 8 };
    S.chylo = [];
    S.food = [];
    for (let i = 0; i < 40; i++) S.food.push(foodBit(S, true));
    S.shed = [];
    blood(S, 46, 1);
  },
  exchange(S, b, dt) { if (typeof b.on === 'number') giveO2(S, b, dt, [{ x: S.vil.cx + S.rr(-40, 40), y: S.vil.top + S.vil.hw, r: 20 }], 0.6); },
  step(S, dt) {
    const V = S.vil;
    // the lining creeps up toward the tip; a cell reaching it is shed
    const was = S.offset; S.offset += dt * (S.ev ? 1.1 : 0.8);
    const tip = S.surf.len / 2;
    if (Math.floor((tip - was) / S.cellL) !== Math.floor((tip - S.offset) / S.cellL)) {
      const [x, y] = S.surf.at(tip); S.shed.push({ x, y, vx: S.rr(-4, 4), vy: -6, a: 0, life: 1 }); say(S, 'shed', x, y);
    }
    for (const s of S.shed) { s.x += s.vx * dt; s.y += s.vy * dt; s.a += dt * 0.5; s.life -= dt * 0.08; }
    S.shed = S.shed.filter((s) => s.life > 0);
    // food drifting in the lumen; some of it is caught by the brush border
    for (const f of S.food) {
      if (f.caught) {
        f.k += dt / (f.kind === 'fat' ? 2.2 : 1.6);
        const [x, y, nx, ny] = S.surf.at(f.s);
        f.x = x - nx * (f.k * V.th); f.y = y - ny * (f.k * V.th);
        if (f.k >= 1) {
          f.gone = true;
          if (f.kind === 'fat') { const [lx, ly] = S.lacteal.L.at(S.lacteal.L.len * 0.9); emit(S, { kind: 'fat', x: f.x, y: f.y, to: [lx, ly], reach: 6, pull: 35, life: 3, done: () => S.chylo.push({ s: S.lacteal.L.len, r: 2.4 }) }); say(S, 'fat', f.x, f.y); }
          else { let best = null, bd = 1e9; for (const v of S.vessels) { const [d, s] = v.L.near(f.x, f.y); if (d < bd) { bd = d; best = v.L.at(s); } } emit(S, { kind: f.kind, x: f.x, y: f.y, to: [best[0], best[1]], reach: 4, pull: 35, life: 3 }); if (S.R() < 0.4) say(S, 'cap', best[0], best[1]); }
        }
        continue;
      }
      f.x += (f.vx + Math.sin(S.t * 0.5 + f.ph) * 4) * dt; f.y += f.vy * dt;
      const [d, s] = S.surf.near(f.x, f.y), inside = Math.abs(f.x - V.cx) < V.hw && f.y > V.top + V.hw ? true : Math.hypot(f.x - V.cx, f.y - (V.top + V.hw)) < V.hw;
      if (inside || d < 4) { if (S.R() < (f.kind === 'fat' ? 0.4 : 0.7)) { f.caught = true; f.k = 0; f.s = s; if (f.kind !== 'fat') say(S, 'sugar', f.x, f.y); } else { f.vx *= -1; f.x += Math.sign(f.x - V.cx) * 6; } }
      if (f.y < -20 || f.y > H + 20 || f.x < -20 || f.x > W + 20) Object.assign(f, foodBit(S));
    }
    S.food = S.food.filter((f) => !f.gone);
    while (S.food.length < 40) S.food.push(foodBit(S));
    // chylomicrons down the lacteal
    for (const ch of S.chylo) ch.s -= dt * 10;
    S.chylo = S.chylo.filter((ch) => ch.s > 0);
    // goblet cells now and then spill their mucus
    if (S.R() < dt * 0.25) {
      const g = [...S.goblets][Math.floor(S.R() * S.goblets.size)], s = ((g * S.cellL + S.offset) % S.surf.len);
      const [x, y, nx, ny] = S.surf.at(s);
      if (!off(x, y)) { for (let k = 0; k < 5; k++) emit(S, { kind: 'mucus', x: x + nx * 3, y: y + ny * 3, vx: nx * 4, vy: ny * 4, jit: 12, drag: 0.95, life: 3, alpha: 0.4 }); say(S, 'goblet', x, y); }
    }
  },
  under(S, c, now) {
    const V = S.vil, ev = S.ev, L = S.surf, t = now / 1000;
    // the lamina propria inside the villus
    c.fillStyle = ev ? 'rgba(70,50,100,.5)' : 'rgba(150,70,70,.42)'; c.beginPath(); L.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
    // the lacteal, pale, blind-ended near the tip, with fat droplets moving down
    c.strokeStyle = ev ? 'rgba(230,225,255,.35)' : 'rgba(255,245,215,.45)'; c.lineWidth = S.lacteal.r * 2; c.lineCap = 'round'; c.beginPath(); S.lacteal.L.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    for (const ch of S.chylo) { const [x, y] = S.lacteal.L.at(ch.s); c.fillStyle = 'rgba(255,240,170,.85)'; c.beginPath(); c.arc(x, y, ch.r, 0, TAU); c.fill(); }
    // food in the lumen
    for (const f of S.food) { const [r, g, b, s] = PART[f.kind]; c.fillStyle = `rgba(${r},${g},${b},.75)`; c.beginPath(); c.arc(f.x, f.y, s * (f.kind === 'fat' ? 1.3 : 1), 0, TAU); c.fill(); }
    for (const s of S.shed) { c.save(); c.translate(s.x, s.y); c.rotate(s.a); c.globalAlpha = s.life; c.fillStyle = ev ? 'rgba(170,150,210,.8)' : 'rgba(230,170,150,.85)'; c.fillRect(-5, -10, 10, 20); c.restore(); }
    c.globalAlpha = 1;
    // the epithelium: a ring of tall cells, each with a nucleus near its base and microvilli on top
    const n = Math.floor(L.len / S.cellL), th = V.th;
    for (let k = -1; k <= n; k++) {
      const s0 = ((k * S.cellL + S.offset) % L.len + L.len) % L.len, s1 = s0 + S.cellL;
      if (s1 > L.len) continue;
      const [x0, y0, nx0, ny0] = L.at(s0), [x1, y1, nx1, ny1] = L.at(s1);
      if (off(x0, y0) && off(x1, y1)) continue;
      // the outward normal of the outline points into the lumen; inward is minus it
      const gob = S.goblets.has(((k % 40) + 40) % 40);
      c.fillStyle = gob ? (ev ? 'rgba(200,215,255,.55)' : 'rgba(230,235,255,.55)') : ev ? 'rgba(150,120,200,.78)' : 'rgba(225,140,130,.8)';
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x1 - nx1 * th, y1 - ny1 * th); c.lineTo(x0 - nx0 * th, y0 - ny0 * th); c.closePath(); c.fill();
      c.strokeStyle = ev ? 'rgba(220,200,255,.35)' : 'rgba(255,210,200,.4)'; c.lineWidth = 0.8; c.stroke();
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mnx = (nx0 + nx1) / 2, mny = (ny0 + ny1) / 2;
      if (gob) { c.fillStyle = 'rgba(240,248,255,.7)'; c.beginPath(); c.arc(mx - mnx * th * 0.4, my - mny * th * 0.4, 4.5, 0, TAU); c.fill(); }
      else { c.fillStyle = ev ? 'rgba(70,50,120,.85)' : 'rgba(110,40,60,.85)'; c.beginPath(); c.ellipse(mx - mnx * th * 0.68, my - mny * th * 0.68, 2.4, 4, Math.atan2(mny, mnx), 0, TAU); c.fill(); }
      // the brush border, waving a little
      c.strokeStyle = ev ? 'rgba(230,220,255,.55)' : 'rgba(255,230,220,.6)'; c.lineWidth = 0.7; c.beginPath();
      for (let q = 0.1; q < 1; q += 0.2) { const x = mix(x0, x1, q), y = mix(y0, y1, q), w = Math.sin(t * 2 + q * 6 + k) * 0.6; c.moveTo(x, y); c.lineTo(x + mnx * 4 + w, y + mny * 4 - w); }
      c.stroke();
    }
  }
};

const SCENES = [muscle, brain, wound, lung, gut];
function foodBit(S, any) {
  const kind = S.R() < 0.4 ? 'glu' : S.R() < 0.6 ? 'aa' : 'fat', V = S.vil, side = S.R() < 0.5 ? -1 : 1;
  const x = any ? (S.R() < 0.5 ? S.rr(0, V.cx - V.hw - 6) : S.rr(V.cx + V.hw + 6, W)) : side < 0 ? -10 : W + 10, y = any ? S.rr(0, H) : S.rr(0, H);
  return { kind, x, y, vx: any ? S.rr(-3, 3) : -side * S.rr(2, 5), vy: S.rr(-1.5, 1.5), ph: S.R() * TAU, caught: false };
}

// ------------------------------------------------ the simulation
const bpmAt = (S) => (S.ev ? 60 - 12 * Math.min(1, S.t / 45) : 54 + 18 * Math.min(1, S.t / 40));
const activityAt = (S) => (S.ev ? 0.85 - 0.35 * Math.min(1, S.t / 50) : 0.25 + 0.75 * Math.min(1, S.t / 28));
function sim(seed, evening, kind) {
  const R = mulberry32(seed), rr = (a, b) => a + R() * (b - a);
  const scene = SCENES.find((s) => s.title === kind) || SCENES[Math.floor(R() * SCENES.length)];
  const S = { R, rr, scene, ev: evening, t: 0, beat: 0, pulse: 0, act: 0.3, parts: [], cap: '', capT: -99, cam: { x: W / 2, y: H / 2, z: 1 }, obst: [], quiet: true };
  S.fibres = Array.from({ length: 14 }, () => ({ x: rr(-40, W), y: rr(0, H), a: rr(-0.6, 0.6), len: rr(120, 260), amp: rr(3, 9), ph: R() * TAU, w: rr(1, 2.6) }));
  S.bokeh = Array.from({ length: 8 }, () => ({ x: rr(0, W), y: rr(0, H), r: rr(30, 70), h: rr(-20, 20) }));
  scene.build(S);
  return S;
}
function step(S, dt) {
  S.t += dt;
  S.act = activityAt(S);
  S.beat += dt * bpmAt(S) / 60;
  const ph = S.beat % 1;
  S.pulse = Math.exp(-(((ph - 0.08) / 0.07) ** 2)) + 0.35 * Math.exp(-(((ph - 0.3) / 0.08) ** 2));
  stepBlood(S, dt);
  S.scene.step(S, dt);
  stepParts(S, dt);
  idle(S);
  // the microscope drifts over to whatever is happening, then back out
  const L = S.look && S.t < S.look.until ? S.look : null, z = L ? 1.28 : 1, tx = L ? L.x : W / 2, ty = L ? L.y : H / 2, k = Math.min(1, dt * 0.7);
  S.cam.z += (z - S.cam.z) * k;
  const hw = W / 2 / S.cam.z, hh = H / 2 / S.cam.z;
  S.cam.x += (clamp(tx, hw, W - hw) - S.cam.x) * k; S.cam.y += (clamp(ty, hh, H - hh) - S.cam.y) * k;
  S.cam.x = clamp(S.cam.x, hw, W - hw); S.cam.y = clamp(S.cam.y, hh, H - hh);
}

// ------------------------------------------------ drawing
function rbcCol(o2, ev) { return ev ? `hsl(${342 - (1 - o2) * 14},${48 + o2 * 22}%,${26 + o2 * 16}%)` : `hsl(${356 - (1 - o2) * 18},${52 + o2 * 28}%,${27 + o2 * 20}%)`; }
function drawVessels(S, c) {
  const ev = S.ev, rad = (v) => v.r * (1 + (v.kind === 'art' ? 0.1 : v.kind === 'cap' ? 0.05 : 0.03) * S.pulse);
  const tube = (v, wd, col) => { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); v.L.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const v of S.vessels) tube(v, rad(v) * 2 + (v.kind === 'cap' ? 5 : 9), ev ? 'rgba(150,120,190,.4)' : 'rgba(230,140,140,.45)');
  for (const v of S.vessels) tube(v, rad(v) * 2 + (v.kind === 'cap' ? 2 : 4), v.kind === 'art' ? (ev ? 'rgba(130,80,160,.85)' : 'rgba(210,90,100,.85)') : ev ? 'rgba(100,80,150,.8)' : 'rgba(180,90,110,.8)');
  for (const v of S.vessels) tube(v, rad(v) * 2, v.kind === 'art' ? (ev ? 'rgba(80,40,90,.92)' : 'rgba(160,40,55,.9)') : ev ? 'rgba(60,40,90,.92)' : 'rgba(130,45,70,.9)');
  // endothelial nuclei along the walls
  c.fillStyle = ev ? 'rgba(170,150,220,.6)' : 'rgba(240,170,170,.65)';
  for (const v of S.vessels) for (const n of v.nuc) { const [x, y, nx, ny, a] = v.L.at(n.s), r = rad(v) + 1; if (off(x, y)) continue; c.beginPath(); c.ellipse(x + nx * r * n.side, y + ny * r * n.side, v.kind === 'cap' ? 3.5 : 5, 1.5, a, 0, TAU); c.fill(); }
}
function drawBlood(S, c) {
  const ev = S.ev;
  for (const p of S.plt) { const [x, y] = bodyAt(S, p); if (off(x, y)) continue; c.fillStyle = ev ? 'rgba(200,170,240,.8)' : 'rgba(225,180,240,.8)'; c.beginPath(); c.arc(x, y, 1.4, 0, TAU); c.fill(); }
  for (const r of S.rbc) {
    const [x, y, ang, v] = bodyAt(S, r);
    if (off(x, y)) continue;
    const s = r.size, col = rbcCol(r.o2, ev);
    c.save(); c.translate(x, y);
    if (v.kind === 'cap') {
      // squeezed single file: a parachute, bowed against the flow
      c.rotate(ang); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, s * 0.8, v.r * 0.9, 0, -Math.PI / 2, Math.PI / 2); c.quadraticCurveTo(-s * 0.2, 0, 0, -v.r * 0.9); c.fill();
      c.fillStyle = 'rgba(255,210,210,.25)'; c.beginPath(); c.ellipse(s * 0.25, -v.r * 0.3, s * 0.25, v.r * 0.2, 0, 0, TAU); c.fill();
    } else {
      const tilt = 0.35 + 0.65 * Math.abs(Math.cos(r.rot));
      c.rotate(ang + r.rot * 0.2);
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, s, s * tilt, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.5 * tilt, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,200,200,.3)'; c.beginPath(); c.ellipse(-s * 0.35, -s * 0.3 * tilt, s * 0.3, s * 0.16 * tilt, 0, 0, TAU); c.fill();
    }
    c.restore();
  }
  for (const w of S.wbc) {
    if (w.state !== 'roll') continue;
    const [x, y] = bodyAt(S, w), s = w.size;
    if (off(x, y)) continue;
    c.fillStyle = 'rgba(235,235,245,.85)'; c.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU, rr = s * (1 + 0.08 * Math.sin(a * 5 + w.ph)); c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill();
    c.fillStyle = 'rgba(120,90,180,.7)'; for (let l = 0; l < 3; l++) { c.beginPath(); c.arc(x + Math.cos(l * 2.1 + w.ph * 0.2) * s * 0.35, y + Math.sin(l * 2.1 + w.ph * 0.2) * s * 0.35, s * 0.32, 0, TAU); c.fill(); }
  }
}
function draw(S, c, w, h, now) {
  const k = w / W, ev = S.ev, act = S.act;
  c.save();
  c.translate(w / 2, h / 2); c.scale(k * S.cam.z, k * S.cam.z); c.translate(-S.cam.x, -S.cam.y);
  const L = ev ? 14 + act * 10 : 18 + act * 20, hue = { muscle: [8, 262], brain: [340, 250], wound: [12, 255], lung: [5, 245], gut: [20, 265] }[S.scene.title];
  const bg = c.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, ev ? `hsl(${hue[1]},32%,${L + 6}%)` : `hsl(${hue[0]},45%,${L + 8}%)`); bg.addColorStop(1, ev ? `hsl(${hue[1] - 15},38%,${L - 6}%)` : `hsl(${hue[0] - 22},42%,${L - 4}%)`);
  c.fillStyle = bg; c.fillRect(-10, -10, W + 20, H + 20);
  for (const b of S.bokeh) { const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); g.addColorStop(0, ev ? `hsla(${260 + b.h},40%,60%,.12)` : `hsla(${10 + b.h},60%,70%,.14)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); }
  if (S.scene !== muscle && S.scene !== lung) {
    c.lineCap = 'round';
    for (const f of S.fibres) {
      c.strokeStyle = ev ? 'rgba(190,180,240,.09)' : 'rgba(255,220,200,.11)'; c.lineWidth = f.w; c.beginPath();
      for (let s = 0; s <= 1; s += 0.05) { const x = f.x + Math.cos(f.a) * f.len * s, y = f.y + Math.sin(f.a) * f.len * s + Math.sin(s * 9 + f.ph + now / 3000) * f.amp; if (s === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
  }
  S.scene.under?.(S, c, now);
  drawVessels(S, c);
  drawBlood(S, c);
  S.scene.over?.(S, c, now);
  drawParts(S, c);
  c.restore();
  // the microscope: a round field
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, ev ? 'rgba(6,4,14,.78)' : 'rgba(20,6,8,.62)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
}

export function cellView(p) {
  const R = mulberry32(p.seed), evening = p.mode === 'evening';
  const S = sim(p.seed, evening, p.tissue);
  const lines = S.scene.lines[evening ? 'evening' : 'morning'], line0 = lines[Math.floor(R() * lines.length)];
  const cv = el('canvas.mind-canvas'), bpm = el('span.pace', ''), now = el('p.now', '');
  const box = el(`div.mind.cellcard${evening ? '.night' : ''}`, el('div.media-in', cv),
    el('div.mind-text', el('div.kicker', `${evening ? 'Night repair' : 'Waking cells'} · ${S.scene.title}`), el('p.line', line0), now, el('div.pacer', bpm, el('small', evening ? ' · slowing' : ' · quickening'))));
  // a moment of history first, so the tissue is already alive when it scrolls in
  for (let i = 0; i < 90; i++) step(S, 1 / 30);
  S.quiet = false; S.capT = -99; idle(S); S.look = null;
  let raf = 0, last = 0;
  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    step(S, dt);
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 360, h = Math.round(w * 0.8);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(S, c, w, h, t);
    const txt = `♥ ${Math.round(bpmAt(S))} bpm`;
    if (bpm.textContent !== txt) bpm.textContent = txt;
    if (now.textContent !== S.cap) now.textContent = S.cap;
  };
  return { body: box, label: `cells: ${S.scene.title}`, activate: () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }, deactivate: () => { cancelAnimationFrame(raf); raf = 0; } };
}
export const TISSUES = SCENES.map((s) => s.title);
