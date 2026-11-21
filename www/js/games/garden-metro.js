// The metropolis (world v6), laid over a garden that may already be lived in. Nothing sown, found or
// built by the dream is lost. It adds:
//   countries  five more kinds of country (jungle, bamboo groves, salt flats, ash fields, lagoon);
//              on an older world the patches that turn into them are regrown as you come near
//   the city   the neon city grows into a metropolis about 160 tiles across, in districts round a
//              high-tech centre: the neon quarter, the old town, the ironworks and the suburbs.
//              Rivers that run through it become canals; streets bridge them
//   railway    a loop of track from the central station out to five towns and two country halts,
//              routed round the meadows on a coarse grid that avoids turning, water and villages;
//              two steam trains run it to a timetable kept by the clock (garden-rail.js)
//   towns      the villages the line serves grow a second ring of houses and a station
//   the works  three levels under the city: the steam tunnels, the clockworks and the boiler heart,
//              joined by lift cages to the undercity, to the ironworks' streets and to each other
// Each part runs on its own: one that fails is logged and the rest still happen.
import { mulberry32 } from '../util.js';
import { BLDG_H } from './garden-metro-art.js';

export function metropolis(G, W) {
  if ((G.v || 0) >= 6) return G;
  const S = G.R.surface, N = S.w, R = mulberry32((G.seed ^ 0x3e7a0) >>> 0);
  const D = { G, W, S, N, R, rr: (a, b) => a + R() * (b - a), ri: (a, b) => Math.floor(a + R() * (b - a + 1)), pick: (a) => a[Math.floor(R() * a.length)] };
  const step = (name, fn) => { try { fn(D); } catch (e) { console.error(`garden metro: ${name}`, e); } };
  step('countries', countries);
  protect(D);
  step('site', site);
  if (D.m) { step('stations', stations); step('railway', railway); step('city', city); step('towns', towns); }
  step('works', works);
  for (const Rm of Object.values(G.R)) { delete Rm.dIdx; delete Rm.pIdx; }
  G.v = 6;
  return G;
}

// ------------------------------------------------ the five new countries
function countries(D) {
  const { S, W, N } = D, B = W.B;
  if ((S.bv || 1) < 2) {
    // an older world: where the map now says a new country, the wild plants and animals go, and the
    // chunk is grown again as you come near (populate) in the new country's way
    delete S.bio;
    const prev = Uint8Array.from(W.biomeMap(S));
    S.bv = 2; delete S.bio;
    const now = W.biomeMap(S), C = Math.ceil(N / W.CH), moved = new Uint16Array(C * C), changed = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) if (prev[i] !== now[i] && now[i] >= B.B_JUNGLE) { changed[i] = 1; moved[Math.floor(Math.floor(i / N) / W.CH) * C + Math.floor((i % N) / W.CH)]++; }
    S.plants = S.plants.filter((p) => !p.n || p.k === 'giant' || !changed[p.y * N + p.x]);
    S.animals = S.animals.filter((a) => !a.n || !changed[Math.floor(a.y / W.T) * N + Math.floor(a.x / W.T)]);
    for (let ci = 0; ci < C * C; ci++) if (moved[ci] > W.CH * W.CH * 0.5) { if (S.pop) S.pop[ci] = 0; if (S.pop5) S.pop5[ci] = 0; }
  }
  // salt and ash lie bare: their grass is crust or cinders (painted as the country's sand)
  const bio = W.biomeMap(S);
  for (let i = 0; i < N * N; i++) { const b = bio[i], g = S.ground[i]; if ((b === B.B_SALT || b === B.B_ASH) && (g === W.GRASS || g === W.FLOWERS)) { S.ground[i] = W.SAND; S.wild[i] = 0; } }
}

// ------------------------------------------------ where nothing may be built over
function protect(D) {
  const { S, N } = D, av = (D.av = new Uint8Array(N * N)), M = N >> 1, c = S.city;
  const mark = (D.mark = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(N - 1, y1); y++) av.fill(1, y * N + Math.max(0, x0), y * N + Math.min(N - 1, x1) + 1); });
  mark(M - 26, M - 26, M + 26, M + 26);
  for (const p of S.plants) if (!p.n) mark(p.x - 3, p.y - 3, p.x + 3, p.y + 3); else if (p.k === 'giant') mark(p.x - 4, p.y - 5, p.x + 4, p.y + 4);
  for (const r of S.ruins) mark(r.x - 3, r.y - 3, r.x + r.w + 2, r.y + r.h + 2);
  for (const p of S.portals) { if (c && p.x >= c.x0 && p.x <= c.x1 && p.y >= c.y0 && p.y <= c.y1) mark(p.x - 1, p.y - 1, p.x + 1, p.y + 2); else mark(p.x - 4, p.y - 4, p.x + 4, p.y + 5); }
  for (const v of S.villages || []) mark(v.x - 12, v.y - 10, v.x + 12, v.y + 10);
  for (const p of S.places || []) mark(p.x - 4, p.y - 4, p.x + 4, p.y + 4);
  for (const d of S.decor) if (d.t === 'chest' || d.t === 'gate' || d.t === 'island') mark(d.x, d.y, d.x, d.y);
  // tiles a building or a lift already stands on (the route and the city keep off them)
  const solid = (D.solid = new Uint8Array(N * N));
  for (const d of S.decor) {
    if (d.t === 'house') { for (let y = d.y - 1; y <= d.y + 1; y++) for (let x = d.x - 1; x <= d.x + 1; x++) if (x >= 0 && y >= 0 && x < N && y < N) solid[y * N + x] = 1; }
    else if (d.t === 'lift' || d.t === 'prop' || d.t === 'chest') for (let y = d.y - 1; y <= d.y + 2; y++) for (let x = d.x - 1; x <= d.x + 1; x++) if (x >= 0 && y >= 0 && x < N && y < N) solid[y * N + x] = 1;
  }
}

// ------------------------------------------------ the metropolis's centre and size
function site(D) {
  const { S, N, R, G } = D, c = S.city;
  let cx, cy;
  if (c) { cx = c.cx; cy = c.cy; }
  else {
    let best = null, bs = Infinity;
    for (let t = 0; t < 80; t++) {
      const a = R() * 6.2832, d = 140 + R() * 120, x = Math.round(N / 2 + Math.cos(a) * d), y = Math.round(N / 2 + Math.sin(a) * d);
      if (x < 60 || y < 60 || x > N - 60 || y > N - 60) continue;
      let bad = 0; for (let yy = y - 40; yy <= y + 40; yy += 4) for (let xx = x - 40; xx <= x + 40; xx += 4) bad += D.av[yy * N + xx];
      if (bad < bs) { bs = bad; best = [x, y]; }
    }
    if (!best) return;
    [cx, cy] = best;
  }
  const rx = Math.max(30, Math.min(80, cx - 12, N - 13 - cx)), ry = Math.max(26, Math.min(68, cy - 12, N - 13 - cy));
  D.m = S.metro = { cx, cy, rx, ry, a0: R() * 6.2832, s: ((G.seed >>> 4) & 0xffff) ^ 0x3e7 };
}

// ------------------------------------------------ the stations
const BAD = (W) => new Set([W.WATER, W.ROCK, W.CHASM, W.PORTAL, W.ICE, W.BRIDGE, W.VOID, W.RAIL]);
const angD = (a, b) => Math.abs((((a - b) % 6.2832) + 9.4248) % 6.2832 - 3.1416);
function stations(D) {
  const { S, N, W, R, m } = D, M = N >> 1, bad = BAD(W), ix = (x, y) => y * N + x;
  // a station: a straight of track along row y from x0, a platform on the row above, the building above that
  const fits = (x0, y, len, city) => {
    if (x0 < 8 || x0 + len > N - 8 || y < 10 || y > N - 8) return false;
    for (let yy = y - 4; yy <= y + 1; yy++) for (let x = x0 - 3; x <= x0 + len + 2; x++) { const i = ix(x, yy); if (bad.has(S.ground[i]) || D.solid[i] || (D.av[i] && !city)) return false; }
    return true;
  };
  const stops = (D.stops = []);
  // a station's ground is spoken for: other lines and the city keep off it (its two ends stay open)
  const claim = (x0, y, len) => { for (let yy = y - 4; yy <= y + 1; yy++) for (let x = x0; x < x0 + len; x++) D.solid[ix(x, yy)] = 1; };
  {
    let at = null;
    for (let r = 0; r < 24 && !at; r++) for (let t = 0; t < 20 && !at; t++) { const x0 = Math.round(m.cx - 7 + (R() - 0.5) * r * 2), y = Math.round(m.cy - 3 + (R() - 0.5) * r * 2); if (fits(x0, y, 14, true) && W.districtAt(S, x0 + 7, y) === W.D.D_CORE) at = [x0, y]; }
    if (!at) at = [m.cx - 7, m.cy - 3];
    stops.push({ kind: 'central', x0: at[0], y: at[1], len: 14 }); claim(at[0], at[1], 14);
  }
  const ring = (cx, cy, r0, r1, len) => { for (let r = r0; r <= r1; r++) for (let q = 0; q < 28; q++) { const a = (q / 28) * 6.2832 + r, x0 = Math.round(cx + Math.cos(a) * r - len / 2), y = Math.round(cy + Math.sin(a) * r); if (fits(x0, y, len, false)) return [x0, y]; } return null; };
  const angs = [Math.atan2(m.cy - M, m.cx - M)], ang = (p) => Math.atan2(p.y - M, p.x - M);
  // the towns: villages spread round the meadows, well away from the city
  const vs = (S.villages || []).filter((v) => Math.hypot(v.x - m.cx, v.y - m.cy) > Math.max(m.rx, m.ry) + 30 && Math.hypot(v.x - M, v.y - M) > 70);
  for (let k = 0; k < 5; k++) {
    let best = null, bs = -1;
    for (const v of vs) { if (v.town) continue; const d = Math.hypot(v.x - M, v.y - M), sc = Math.min(...angs.map((a) => angD(ang(v), a))) + (d > 130 && d < 360 ? 0.25 : 0); if (sc > bs) { bs = sc; best = v; } }
    if (!best) break;
    best.town = 1;
    const at = ring(best.x, best.y, 15, 34, 12);
    if (!at) continue;
    angs.push(ang(best));
    stops.push({ kind: 'town', x0: at[0], y: at[1], len: 12, v: S.villages.indexOf(best) }); claim(at[0], at[1], 12);
  }
  // two halts out in the country, by ways up or down or the places at the ends of forest paths
  const cand = [...S.decor.filter((d) => d.t === 'lift').map((d) => ({ x: d.x, y: d.y, k: d.style || (d.up ? 'spire' : 'shaft') })), ...(S.places || []).map((p) => ({ x: p.x, y: p.y, k: p.k }))]
    .filter((p) => Math.hypot(p.x - m.cx, p.y - m.cy) > Math.max(m.rx, m.ry) + 30 && Math.hypot(p.x - M, p.y - M) > 60);
  for (let k = 0; k < 2; k++) {
    let best = null, bs = -1;
    for (const p of cand) { if (p.used) continue; const sc = Math.min(...angs.map((a) => angD(ang(p), a))); if (sc > bs) { bs = sc; best = p; } }
    if (!best) break;
    best.used = 1;
    const at = ring(best.x, best.y, 7, 26, 10);
    if (!at) continue;
    angs.push(ang(best));
    stops.push({ kind: 'halt', x0: at[0], y: at[1], len: 10, near: best.k }); claim(at[0], at[1], 10);
  }
}

// ------------------------------------------------ the railway
// A* on 3-tile cells with a cost for turning (so the line runs in long straights), for water and
// gorges (it crosses on trestles), rock (cuttings), forest, and the protected places round villages
// and sown gardens; buildings and the ways up and down are never crossed.
function cellCosts(D, CS, C) {
  const { S, N, W } = D, cost = new Float32Array(C * C);
  const tc = (i) => {
    if (D.solid[i]) return Infinity;
    const g = S.ground[i];
    if (g === W.PORTAL) return Infinity;
    let v = g === W.WATER ? 5 : g === W.BRIDGE ? 4 : g === W.CHASM ? 10 : g === W.ROCK ? 7 : g === W.ICE ? 3 : g === W.FOREST ? 1.8 : g === W.SAND ? 1.2 : g === W.STREET ? 1.4 : g === W.RAIL ? 6 : 1;
    if (D.av[i]) v += 40;
    return v;
  };
  for (let cy = 0; cy < C; cy++) for (let cx = 0; cx < C; cx++) {
    let s = 0;
    for (let dy = 0; dy < CS; dy++) for (let dx = 0; dx < CS; dx++) { const x = cx * CS + dx, y = cy * CS + dy; s += x < 4 || y < 4 || x >= N - 4 || y >= N - 4 ? Infinity : tc(y * N + x); }
    cost[cy * C + cx] = s / (CS * CS);
  }
  return cost;
}
function route(D, a, b) {
  const { N } = D, CS = 3, C = Math.ceil(N / CS), cost = (D.cellCost ||= cellCosts(D, CS, C)), TURN = 5;
  const ca = [Math.floor(a[0] / CS), Math.floor(a[1] / CS)], cb = [Math.floor(b[0] / CS), Math.floor(b[1] / CS)];
  const near = (cx, cy) => Math.abs(cx - ca[0]) + Math.abs(cy - ca[1]) <= 3 || Math.abs(cx - cb[0]) + Math.abs(cy - cb[1]) <= 3;
  const cAt = (cx, cy) => { const v = cost[cy * C + cx]; return near(cx, cy) ? (v === Infinity ? 30 : Math.min(v, 3)) : v; };
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1], gS = new Float32Array(C * C * 4).fill(Infinity), from = new Int32Array(C * C * 4).fill(-1), shut = new Uint8Array(C * C * 4);
  const heap = [], push = (f, s) => { heap.push([f, s]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = (cx, cy) => (Math.abs(cx - cb[0]) + Math.abs(cy - cb[1])) * 1.1;
  for (let d = 0; d < 4; d++) { const s = (ca[1] * C + ca[0]) * 4 + d; gS[s] = 0; push(h(ca[0], ca[1]), s); }
  let goal = -1;
  for (let it = 0; heap.length && it < 2e6; it++) {
    const [, s] = pop();
    if (shut[s]) continue;
    shut[s] = 1;
    const cell = s >> 2, d0 = s & 3, cx = cell % C, cy = (cell / C) | 0;
    if (cx === cb[0] && cy === cb[1]) { goal = s; break; }
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 1 || ny < 1 || nx >= C - 1 || ny >= C - 1) continue;
      const c1 = cAt(nx, ny); if (c1 === Infinity) continue;
      const ns = (ny * C + nx) * 4 + d, g = gS[s] + c1 + (d !== d0 && gS[s] > 0 ? TURN : 0);
      if (g < gS[ns]) { gS[ns] = g; from[ns] = s; push(g + h(nx, ny), ns); }
    }
  }
  if (goal < 0) return null;
  const cells = [];
  for (let s = goal; s >= 0; s = from[s]) cells.push([(s >> 2) % C, ((s >> 2) / C) | 0]);
  cells.reverse();
  // cell centres joined by straight runs of tiles
  const pts = [[a[0], a[1]]];
  let x = a[0], y = a[1];
  const go = (tx, ty, hFirst) => { const st = (dx, dy) => { x += dx; y += dy; pts.push([x, y]); }; if (hFirst) { while (x !== tx) st(Math.sign(tx - x), 0); while (y !== ty) st(0, Math.sign(ty - y)); } else { while (y !== ty) st(0, Math.sign(ty - y)); while (x !== tx) st(Math.sign(tx - x), 0); } };
  cells.forEach(([cx, cy], k) => { const tx = cx * CS + 1, ty = cy * CS + 1, prev = k ? cells[k - 1] : null; go(tx, ty, prev ? prev[1] === cy : true); });
  go(b[0], b[1], false);
  // later legs keep off this one where they can
  for (const [cx, cy] of cells) cost[cy * C + cx] += 4;
  return pts;
}
function railway(D) {
  const { S, N, W, stops } = D;
  if (!stops || stops.length < 3) return;
  const mx = stops.reduce((s, o) => s + o.x0 + o.len / 2, 0) / stops.length, my = stops.reduce((s, o) => s + o.y, 0) / stops.length;
  stops.sort((p, q) => Math.atan2(p.y - my, p.x0 + p.len / 2 - mx) - Math.atan2(q.y - my, q.x0 + q.len / 2 - mx));
  const n = stops.length;
  for (let k = 0; k < n; k++) {
    const s = stops[k], nx = stops[(k + 1) % n], east = nx.x0 + nx.len / 2 >= s.x0 + s.len / 2;
    s.dir = east ? 1 : -1;
  }
  // each station's straight, then the leg to the next; the train comes in at one end and leaves by the other
  const line = [];
  for (let k = 0; k < n; k++) {
    const s = stops[k], nx = stops[(k + 1) % n], first = s.dir > 0 ? s.x0 : s.x0 + s.len - 1;
    for (let q = 0; q < s.len; q++) line.push([first + q * s.dir, s.y]);
    s.at = line.length - Math.ceil(s.len / 2);
    const out = [s.dir > 0 ? s.x0 + s.len : s.x0 - 1, s.y], inn = [nx.dir > 0 ? nx.x0 - 1 : nx.x0 + nx.len, nx.y];
    const a2 = [out[0] + s.dir * 2, out[1]], b2 = [inn[0] - nx.dir * 2, inn[1]];
    const leg = route(D, a2, b2);
    if (!leg) throw new Error(`no route from stop ${k}`);
    line.push(out, [out[0] + s.dir, out[1]], ...leg, [inn[0] - nx.dir, inn[1]], inn);
  }
  // no tile twice in a row, and every step to a neighbour
  const L = [];
  for (const p of line) { const q = L[L.length - 1]; if (q && q[0] === p[0] && q[1] === p[1]) continue; L.push(p); }
  for (let k = 1; k < L.length; k++) if (Math.abs(L[k][0] - L[k - 1][0]) + Math.abs(L[k][1] - L[k - 1][1]) !== 1) throw new Error('rail gap');
  // lay it: ballast and sleepers; trestles over water and gorges; whatever stood there goes
  const brW = [], brC = [], on = new Uint8Array(N * N);
  for (const [x, y] of L) {
    const i = y * N + x, g = S.ground[i];
    if (on[i]) continue;
    on[i] = 1;
    if (g === W.WATER || g === W.BRIDGE) brW.push(i); else if (g === W.CHASM) brC.push(i);
    S.ground[i] = W.RAIL; S.wild[i] = 0;
  }
  S.plants = S.plants.filter((p) => !on[p.y * N + p.x] || !p.n);
  S.decor = S.decor.filter((d) => !on[d.y * N + d.x] || d.t === 'lift' || d.t === 'chest');
  // the stations: platforms of stone, the buildings behind them, lamps at the platform ends
  for (const s of stops) {
    for (let yy = s.y - 4; yy <= s.y - 1; yy++) for (let x = s.x0 - 1; x <= s.x0 + s.len; x++) { const i = yy * N + x; if (S.ground[i] !== W.RAIL) { S.ground[i] = yy === s.y - 1 ? W.STONE : S.ground[i] === W.STREET ? W.STREET : W.GRASS; S.wild[i] = 0; } }
    S.plants = S.plants.filter((p) => !(p.x >= s.x0 - 2 && p.x <= s.x0 + s.len + 1 && p.y >= s.y - 5 && p.y <= s.y + 1) || !p.n);
    if (s.kind === 'central') S.decor.push({ t: 'bldg', k: 'station', x: s.x0 + 2, y: s.y - 2, w: 10, d: 2, h: 54, v: 0 });
    else S.decor.push({ t: 'bldg', k: 'halt', x: s.x0 + Math.floor(s.len / 2) - 2, y: s.y - 2, w: 4, d: 2, h: 24, v: stops.indexOf(s) });
    S.decor.push({ t: 'lamp', k: 'gaslamp', x: s.x0, y: s.y - 2 }, { t: 'lamp', k: 'gaslamp', x: s.x0 + s.len - 1, y: s.y - 2 });
    D.mark(s.x0 - 2, s.y - 5, s.x0 + s.len + 1, s.y + 1);
    // a path from the platform to the village (or the road) it serves
    const v = s.v >= 0 ? S.villages[s.v] : null;
    carve(D, { x: s.x0 + (s.len >> 1), y: s.y - 1 }, v ? { x: v.x, y: v.y + 2 } : null);
  }
  S.railBrW = brW; S.railBrC = brC; delete S._rw; delete S._rc;
  S.rail = { line: L.flat(), stops: stops.map((s) => ({ at: s.at, kind: s.kind, x: s.x0 + (s.len >> 1), y: s.y, v: s.v ?? -1, near: s.near || '' })) };
}
// a footpath from a toward b (or toward the nearest road or path), stopping when it meets one
function carve(D, a, b) {
  const { S, N, W, R } = D;
  let x = a.x, y = a.y - 1;
  const tgt = b || (() => { for (let r = 2; r < 60; r++) for (let q = 0; q < r * 8; q++) { const an = (q / (r * 8)) * 6.2832, xx = Math.round(x + Math.cos(an) * r), yy = Math.round(y + Math.sin(an) * r); if (xx > 2 && yy > 2 && xx < N - 3 && yy < N - 3 && [W.PATH, W.STREET].includes(S.ground[yy * N + xx])) return { x: xx, y: yy }; } return null; })();
  if (!tgt) return;
  for (let st = 0; st < 200 && (x !== tgt.x || y !== tgt.y); st++) {
    const dx = tgt.x - x, dy = tgt.y - y;
    if (R() < 0.1 && Math.abs(dx) + Math.abs(dy) > 5) { if (Math.abs(dx) > Math.abs(dy)) y += R() < 0.5 ? 1 : -1; else x += R() < 0.5 ? 1 : -1; } else if (R() < Math.abs(dx) / (Math.abs(dx) + Math.abs(dy))) x += Math.sign(dx); else y += Math.sign(dy);
    const i = y * N + x, g = S.ground[i];
    if (x < 2 || y < 2 || x > N - 3 || y > N - 3 || (st > 6 && D.solid[i])) break;
    if (st > 2 && [W.PATH, W.STREET, W.STONE].includes(g)) break;
    if ([W.PORTAL, W.RAIL, W.STONE, W.BRIDGE, W.ICE, W.STREET].includes(g)) continue;
    S.ground[i] = g === W.WATER || g === W.CHASM ? W.BRIDGE : W.PATH; S.wild[i] = 0;
  }
}

// ------------------------------------------------ the city, district by district
function city(D) {
  const { S, N, W, R, m, rr, ri, pick } = D, DD = W.D, ix = (x, y) => y * N + x;
  const x0 = Math.max(4, m.cx - m.rx), x1 = Math.min(N - 5, m.cx + m.rx), y0 = Math.max(4, m.cy - m.ry), y1 = Math.min(N - 5, m.cy + m.ry), BW = x1 - x0 + 1;
  const dist = new Uint8Array(BW * (y1 - y0 + 1)), dAt = (x, y) => (x < x0 || x > x1 || y < y0 || y > y1 ? 0 : dist[(y - y0) * BW + (x - x0)]);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) dist[(y - y0) * BW + (x - x0)] = W.districtAt(S, x, y);
  // the old neon city's towers, signs and lamps make way (its lifts stay where they are)
  const old = S.city;
  if (old) S.decor = S.decor.filter((d) => !(d.x >= old.x0 - 1 && d.x <= old.x1 + 1 && d.y >= old.y0 - 1 && d.y <= old.y1 + 1 && (d.t === 'tower' || d.t === 'neon' || d.t === 'holo' || (d.t === 'lamp' && d.k === 'neonlamp'))));
  const md = (v, k) => ((v % k) + k) % k;
  const road = (x, y, dk) => { const u = md(x - m.cx, 12), v = md(y - m.cy, 12); if (u === 0 || v === 0) return true; if (dk === DD.D_CORE) return u === 1 || v === 1; if (dk === DD.D_NEON) return u === 6; if (dk === DD.D_OLD) return u === 6 || v === 6; if (dk === DD.D_SUBS) return v === 6; return false; };
  const fixed = (i) => D.av[i] || D.solid[i] || [W.RAIL, W.PORTAL, W.STONE].includes(S.ground[i]);
  const drop = new Uint8Array(N * N);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dk = dAt(x, y), i = ix(x, y), g = S.ground[i];
    if (!dk || fixed(i)) continue;
    const rd = road(x, y, dk);
    if (g === W.WATER || g === W.CHASM) {
      // rivers become canals; the streets bridge them (a street that runs along a canal leaves it be)
      const u = md(x - m.cx, 12), v = md(y - m.cy, 12), along = (v === 0 || (dk === DD.D_CORE && v === 1)) && !(u === 0 || (dk === DD.D_CORE && u === 1)) ? S.ground[i - 1] === g && S.ground[i + 1] === g : (u === 0 || (dk === DD.D_CORE && u === 1)) && !(v === 0 || (dk === DD.D_CORE && v === 1)) ? S.ground[i - N] === g && S.ground[i + N] === g : false;
      if (rd && !along) S.ground[i] = W.BRIDGE;
      continue;
    }
    if (g === W.BRIDGE) continue;
    S.ground[i] = dk === DD.D_SUBS && !rd ? W.GRASS : W.STREET; S.wild[i] = 0; drop[i] = 1;
  }
  S.plants = S.plants.filter((p) => !p.n || p.k === 'giant' || !drop[ix(p.x, p.y)]);
  S.animals = S.animals.filter((a) => !a.n || !drop[ix(Math.floor(a.x / W.T), Math.floor(a.y / W.T))]);
  // building plots
  const occ = (D.occ = new Uint8Array(N * N));
  const free = (x, y, dk) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && dAt(x, y) === dk && !road(x, y, dk) && !occ[ix(x, y)] && !fixed(ix(x, y)) && S.ground[ix(x, y)] === (dk === DD.D_SUBS ? W.GRASS : W.STREET);
  const can = (x, fy, w, d, dk) => { for (let y = fy - d + 1; y <= fy; y++) for (let xx = x; xx < x + w; xx++) if (!free(xx, y, dk)) return false; return true; };
  const take = (x, fy, w, d) => { for (let y = fy - d + 1; y <= fy; y++) for (let xx = x; xx < x + w; xx++) occ[ix(xx, y)] = 1; };
  const maxR = Math.hypot(m.rx, m.ry);
  const hFor = (k, x, y) => { const [a, b] = BLDG_H[k], c = Math.max(0, 1 - Math.hypot(x - m.cx, y - m.cy) / (maxR * 0.4)); return Math.round(a + (b - a) * (k === 'glass' || k === 'spire' ? c * 0.7 + R() * 0.3 : R())); };
  const bldg = (k, x, fy, w, d, dk) => { if (!can(x, fy, w, d, dk)) return false; take(x, fy, w, d); S.decor.push({ t: 'bldg', k, x, y: fy, w, d, h: hFor(k, x, fy), v: ri(0, 23) }); return true; };
  const prop = (o, dk) => { if (!free(o.x, o.y, dk)) return false; occ[ix(o.x, o.y)] = 1; S.decor.push(o); return true; };
  const tree = (k, x, y, dk) => { if (!free(x, y, dk)) return; occ[ix(x, y)] = 1; W.natural(S, k, x, y); };
  let clock = false;
  const oldMid = (() => { let sx = 0, sy = 0, n = 0; for (let y = y0; y <= y1; y += 3) for (let x = x0; x <= x1; x += 3) if (dAt(x, y) === DD.D_OLD) { sx += x; sy += y; n++; } return n ? [sx / n, sy / n] : null; })();
  // the old town's clock tower stands in its square nearest the middle of the old town
  const BX0 = m.cx - Math.ceil(m.rx / 12) * 12, BY0 = m.cy - Math.ceil(m.ry / 12) * 12;
  let clockAt = null, cd = Infinity;
  if (oldMid) for (let by = BY0; by < y1; by += 12) for (let bx = BX0; bx < x1; bx += 12) if (dAt(bx + 6, by + 6) === DD.D_OLD) { const d = Math.hypot(bx + 6 - oldMid[0], by + 6 - oldMid[1]); if (d < cd) { cd = d; clockAt = `${bx},${by}`; } }
  for (let by = BY0; by < y1; by += 12) for (let bx = BX0; bx < x1; bx += 12) {
    const X0 = bx + 1, X1 = bx + 11, Y0 = by + 1, Y1 = by + 11, dk = dAt(bx + 6, by + 6);
    if (!dk) continue;
    if (dk === DD.D_CORE) {
      if (m.cx >= bx && m.cx <= bx + 12 && m.cy >= by && m.cy <= by + 12) {
        // the central plaza: a hologram over it, light all round, trees in a ring of lawn
        const hx = bx + 6, hy = by + 6;
        if (free(hx, hy, dk)) { occ[ix(hx, hy)] = 1; S.decor.push({ t: 'holo', x: hx, y: hy, v: ri(0, 3) }); }
        for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) prop({ t: 'lamp', k: 'neonlamp', x: hx + dx, y: hy + dy, v: ri(0, 2) }, dk);
        for (const [dx, dy] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) prop({ t: 'neon', x: hx + dx, y: hy + dy, v: ri(0, 7) }, dk);
        for (let q = 0; q < 8; q++) { const a = (q / 8) * 6.2832, x = Math.round(hx + Math.cos(a) * 4.6), y = Math.round(hy + Math.sin(a) * 4.6); if (free(x, y, dk)) { S.ground[ix(x, y)] = W.GRASS; tree(pick(['cherry', 'jacaranda', 'ginkgo']), x, y, DD.D_SUBS); } }
        continue;
      }
      if (R() < 0.16) {
        // a sky garden at street level
        for (let y = Y0 + 1; y <= Y1 - 1; y++) for (let x = X0 + 1; x <= X1 - 1; x++) if (free(x, y, dk)) S.ground[ix(x, y)] = (x + y) % 4 ? W.GRASS : W.FLOWERS;
        for (let q = 0; q < 6; q++) { const x = ri(X0 + 1, X1 - 1), y = ri(Y0 + 1, Y1 - 1); if (S.ground[ix(x, y)] !== W.STREET && !occ[ix(x, y)]) { occ[ix(x, y)] = 1; W.natural(S, pick(['cherry', 'wisteria', 'jacaranda', 'ginkgo', 'cypress']), x, y); } }
        continue;
      }
      // great towers of glass and needle spires, as many as the block will hold, holograms between
      for (const [tx, ty] of [[X0 + 1, Y1 - 1], [X0 + 5, Y1 - 1], [X0 + 1, Y0 + 4], [X0 + 6, Y0 + 4], [X0 + 3, Y1 - 3], [X0 + 2, Y0 + 3]]) {
        const sp = R() < 0.3, w = sp ? 2 : ri(3, 4);
        if (!bldg(sp ? 'spire' : 'glass', tx, ty, w, sp ? 2 : 3, dk) && !bldg('spire', tx, ty, 2, 2, dk)) continue;
      }
      for (let q = 0; q < 2; q++) prop({ t: 'neon', x: ri(X0 + 1, X1 - 1), y: ri(Y0 + 1, Y1 - 1), v: ri(0, 7) }, dk);
      continue;
    }
    if (dk === DD.D_NEON) {
      // the neon quarter: rows of towers with alleys between, signs where a tower is missing
      for (const [sx0, sx1] of [[X0, bx + 5], [bx + 7, X1]]) for (let fy = Y1; fy >= Y0 + 1; fy -= 3) for (let x = sx0; x <= sx1;) {
        const w = Math.min(sx1 - x + 1, ri(2, 4));
        if (w < 2) break;
        if (R() < 0.9) { if (can(x, fy, w, 2, dk)) { take(x, fy, w, 2); const hk = 1 - Math.hypot(x - m.cx, fy - m.cy) / maxR; S.decor.push({ t: 'tower', x, y: fy, w, d: 2, h: Math.round(rr(30, 70) + hk * 60), v: ri(0, 23) }); } }
        else prop({ t: 'neon', x, y: fy, v: ri(0, 7) }, dk);
        x += w;
      }
      continue;
    }
    if (dk === DD.D_OLD) {
      // the old town: little squares of brick rowhouses and shops round a courtyard; the clock tower
      // and the market in the square nearest the middle of town
      const mid = !clock && clockAt === `${bx},${by}`;
      for (const [sx, sy] of [[X0, Y0], [bx + 7, Y0], [X0, by + 7], [bx + 7, by + 7]]) {
        if (mid && sx === X0 && sy === Y0) {
          clock = bldg('clock', sx + 1, sy + 2, 2, 2, dk) || clock;
          prop({ t: 'prop', k: 'stall', x: sx + 3, y: sy + 3, v: ri(0, 2) }, dk); prop({ t: 'prop', k: 'stall', x: sx, y: sy + 4, v: ri(0, 2) }, dk); prop({ t: 'prop', k: 'well', x: sx + 3, y: sy + 1 }, dk);
          continue;
        }
        for (const fy of [sy + 4, sy + 1]) for (let x = sx; x <= sx + 4;) { const k = R() < 0.35 ? 'shop' : 'brick'; if (bldg(k, x, fy, 2, 2, dk)) x += 2; else x++; }
      }
      continue;
    }
    if (dk === DD.D_WORKS) {
      // the ironworks: a factory along the front, a warehouse, gasometer, silos or a cooling tower
      // behind; smokestacks and cranes in the gaps; coal and carts in the yards
      const fw = ri(5, 8);
      bldg('factory', X0 + ri(0, 2), Y1 - 1, Math.min(fw, X1 - X0), 3, dk);
      const back = pick(['warehouse', 'gasometer', 'cooling', 'silo', 'warehouse']);
      if (back === 'silo') { bldg('silo', X0 + 1, Y0 + 3, 2, 2, dk); bldg('silo', X0 + 4, Y0 + 3, 2, 2, dk); }
      else bldg(back, X0 + ri(0, 3), Y0 + 3, back === 'warehouse' ? ri(4, 6) : 4, 3, dk);
      for (let q = 0; q < 2; q++) bldg('chimney', ri(X0, X1), ri(Y0 + 1, Y1 - 1), 1, 1, dk);
      if (R() < 0.5) bldg('crane', ri(X0, X1 - 3), ri(Y0 + 5, Y1 - 4), 3, 1, dk);
      for (let q = 0; q < 3; q++) prop({ t: 'works', k: R() < 0.5 ? 'coal' : 'cart', x: ri(X0, X1), y: ri(Y0, Y1), v: ri(0, 9) }, dk);
      continue;
    }
    // the suburbs: little houses along each street with a tree behind and flowers by the door;
    // now and then a park with a pond
    if (R() < 0.1) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const x = bx + 6 + dx, y = by + 3 + dy; if (free(x, y, dk)) { S.ground[ix(x, y)] = W.WATER; occ[ix(x, y)] = 1; } }
      for (let q = 0; q < 8; q++) tree(pick(['willow', 'oak', 'cherry', 'birch']), ri(X0, X1), ri(Y0, Y1), dk);
      continue;
    }
    for (const fy of [by + 5, by + 11]) for (let x = X0; x <= X1 - 1; x += 4) {
      if (!bldg('villa', x, fy - 1, 2, 2, dk)) continue;
      if (R() < 0.8) tree(pick(['apple', 'cherry', 'birch', 'maple', 'oak', 'jacaranda']), x + (R() < 0.5 ? 0 : 1), fy - 3, dk);
      if (R() < 0.6) { const fx = x + 2, fy2 = fy - 1; if (free(fx, fy2, dk)) { occ[ix(fx, fy2)] = 1; S.ground[ix(fx, fy2)] = W.FLOWERS; W.natural(S, pick(['tulip', 'daisy', 'rosebush', 'hydrangea', 'lavender']), fx, fy2); } }
    }
  }
  // lamps at the crossings, in each district's own kind
  const LAMP = { [DD.D_CORE]: 'neonlamp', [DD.D_NEON]: 'neonlamp', [DD.D_OLD]: 'lamp', [DD.D_WORKS]: 'gaslamp', [DD.D_SUBS]: 'lamp' };
  for (let y = m.cy - Math.ceil(m.ry / 12) * 12; y < y1; y += 12) for (let x = m.cx - Math.ceil(m.rx / 12) * 12; x < x1; x += 12) {
    const dk = dAt(x + 2, y + 2); if (!dk || R() < 0.2) continue;
    prop({ t: 'lamp', k: LAMP[dk], x: x + 2, y: y + 2, v: ri(0, 2) }, dk);
  }
  S.city = { x0, y0, x1, y1, cx: m.cx, cy: m.cy };
  D.mark(x0, y0, x1, y1);
}

// ------------------------------------------------ the towns the railway serves
function towns(D) {
  const { S, N, W, R, ri } = D, ix = (x, y) => y * N + x, bad = BAD(W);
  for (const s of D.stops || []) {
    if (!(s.v >= 0)) continue;
    const v = S.villages[s.v];
    v.town = 1; v.r = 17;
    const taken = (x, y) => S.decor.some((d) => Math.abs(d.x - x) <= 2 && Math.abs(d.y - y) <= 2) || S.plants.some((p) => !p.n && Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1);
    for (let k = 0, tries = 0; k < 8 && tries < 80; tries++) {
      const a = R() * 6.2832, hx = Math.round(v.x + Math.cos(a) * (11 + R() * 5)), hy = Math.round(v.y + Math.sin(a) * (9 + R() * 4));
      let ok = hx > 4 && hy > 4 && hx < N - 5 && hy < N - 5 && !taken(hx, hy);
      for (let y = hy - 1; y <= hy + 1 && ok; y++) for (let x = hx - 1; x <= hx + 1; x++) if (bad.has(S.ground[ix(x, y)]) || S.ground[ix(x, y)] === W.STONE) { ok = false; break; }
      if (!ok) continue;
      S.plants = S.plants.filter((p) => !(p.n && Math.abs(p.x - hx) <= 1 && p.y >= hy - 1 && p.y <= hy + 1));
      for (let y = hy - 1; y <= hy; y++) for (let x = hx - 1; x <= hx + 1; x++) { S.ground[ix(x, y)] = W.GRASS; S.wild[ix(x, y)] = 0; }
      const hv = ri(0, 3);
      S.decor.push({ t: 'house', x: hx, y: hy, s: v.style, v: hv });
      v.houses.push({ x: hx, y: hy, v: hv });
      carve(D, { x: hx, y: hy + 2 }, { x: v.x, y: v.y + 2 });
      if (R() < 0.5) S.decor.push({ t: 'lamp', k: 'lamp', x: hx + 2, y: hy + 1 });
      k++;
    }
  }
}

// ------------------------------------------------ under the city: the works
function genWorks(D, name, salt) {
  const { G, W } = D, Rm = W.mkRealm(name, G.seed ^ salt), N = Rm.w, R = mulberry32(((G.seed ^ salt) * 31) >>> 0), ix = (x, y) => y * N + x;
  const ri = (a, b) => Math.floor(a + R() * (b - a + 1)), pick = (a) => a[Math.floor(R() * a.length)];
  Rm.ground.fill(W.ROCK);
  const L = name === 'steam' ? 15 : name === 'gears' ? 20 : 17, cw = name === 'gears' ? 2 : 3, n = Math.floor((N - 18) / L) + 1, nodes = [];
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) nodes.push({ x: 9 + gx * L + Math.round((R() - 0.5) * L * 0.3), y: 9 + gy * L + Math.round((R() - 0.5) * L * 0.3) });
  const set = (x, y, g) => { if (x > 2 && y > 2 && x < N - 3 && y < N - 3) Rm.ground[ix(x, y)] = g; };
  // a random spanning tree over the lattice, and about a third of the other links for loops
  const edges = [];
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) { if (gx < n - 1) edges.push([gy * n + gx, gy * n + gx + 1]); if (gy < n - 1) edges.push([gy * n + gx, (gy + 1) * n + gx]); }
  for (let q = edges.length - 1; q > 0; q--) { const j = Math.floor(R() * (q + 1)); [edges[q], edges[j]] = [edges[j], edges[q]]; }
  const up = nodes.map((_, k) => k), find = (k) => (up[k] === k ? k : (up[k] = find(up[k])));
  const keep = edges.filter(([a, b]) => { const ra = find(a), rb = find(b); if (ra !== rb) { up[ra] = rb; return true; } return R() < 0.3; });
  const corr = [];
  for (const [a, b] of keep) {
    const A = nodes[a], Bn = nodes[b], horiz = Math.abs(A.y - Bn.y) < Math.abs(A.x - Bn.x);
    const hrun = (xa, xb, y) => { for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) for (let o = 0; o < cw; o++) set(x, y + o - (cw >> 1), W.GRASS); corr.push({ h: 1, a: Math.min(xa, xb), b: Math.max(xa, xb), at: y }); };
    const vrun = (ya, yb, x) => { for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) for (let o = 0; o < cw; o++) set(x + o - (cw >> 1), y, W.GRASS); corr.push({ h: 0, a: Math.min(ya, yb), b: Math.max(ya, yb), at: x }); };
    if (horiz) { hrun(A.x, Bn.x, A.y); vrun(A.y, Bn.y, Bn.x); } else { vrun(A.y, Bn.y, A.x); hrun(A.x, Bn.x, Bn.y); }
  }
  // halls at some of the junctions
  const halls = [];
  nodes.forEach((p, k) => {
    if (k && R() > 0.38) return;
    if (name === 'gears') { const r = ri(6, 9); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) set(p.x + dx, p.y + dy, W.GRASS); halls.push({ x: p.x, y: p.y, w: r, h: r, round: 1 }); }
    else { const w = name === 'steam' ? ri(4, 6) : ri(5, 7), h = name === 'steam' ? ri(3, 4) : ri(4, 5); for (let dy = -h; dy <= h; dy++) for (let dx = -w; dx <= w; dx++) set(p.x + dx, p.y + dy, W.GRASS); halls.push({ x: p.x, y: p.y, w, h }); }
  });
  const isF = (x, y) => x > 2 && y > 2 && x < N - 3 && y < N - 3 && Rm.ground[ix(x, y)] === W.GRASS;
  // water: canals down the tunnels' middles; pits of oil in the clockworks' halls; pools of molten
  // iron in the boiler heart's (with an iron catwalk across each)
  if (name === 'steam') for (const c of corr) { if (!c.h || R() > 0.4 || c.b - c.a < 10) continue; for (let x = c.a + 3; x <= c.b - 3; x++) set(x, c.at, (x - c.a) % 9 === 4 ? W.BRIDGE : W.WATER); }
  for (const hl of halls) {
    if (name === 'gears' && hl.w >= 7) { const r = hl.w - 3; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) set(hl.x + dx, hl.y + dy, dy === 0 ? W.BRIDGE : W.WATER); hl.pit = 1; }
    if (name === 'furnace' && hl.w >= 6) { for (let dy = -(hl.h - 3); dy <= hl.h - 3; dy++) for (let dx = -(hl.w - 3); dx <= hl.w - 3; dx++) set(hl.x + dx, hl.y + dy, dx === 0 ? W.BRIDGE : W.WATER); hl.pit = 1; }
  }
  // machinery
  const used = new Set(), put = (o) => { const k = ix(o.x, o.y); if (!isF(o.x, o.y) || used.has(k)) return false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) used.add(ix(o.x + dx, o.y + dy)); Rm.decor.push(o); return true; };
  let clockface = name !== 'gears';
  for (const hl of halls) {
    const top = hl.y - hl.h + 1, M = (k, dx, dy, v = 0) => put({ t: 'works', k, x: hl.x + dx, y: dy, v });
    if (name === 'steam') { M('boiler', -3, top); M('boiler', 3, top); M('tank', 0, top); M('valve', -hl.w + 1, hl.y); M('piston', hl.w - 1, hl.y - 1); M(R() < 0.5 ? 'coal' : 'cart', 0, hl.y + hl.h - 1, ri(0, 9)); }
    else if (name === 'gears') { M('gear', 0, top, ri(0, 2)); M(R() < 0.5 ? 'twin' : 'gear', -hl.w + 2, hl.y - 2, ri(0, 2)); M('piston', hl.w - 2, hl.y - 2); if (!clockface && hl.w >= 8) clockface = M('clockface', 0, hl.y + hl.h - 2) || clockface; else M('gear', 2, hl.y + hl.h - 2, ri(0, 2)); }
    else { M('furnace', -3, top); M('furnace', 3, top); M('boiler', -hl.w + 1, hl.y + 1); M('coal', hl.w - 1, hl.y + hl.h - 1, ri(0, 9)); M('cart', hl.w - 2, hl.y - 1); }
  }
  // gas lamps along the walls of the tunnels, vents puffing steam from the floor
  for (const c of corr) for (let s = c.a + 3; s <= c.b - 2; s += 7) {
    const x = c.h ? s : c.at - (cw >> 1), y = c.h ? c.at - (cw >> 1) : s;
    if (isF(x, y) && !used.has(ix(x, y))) { used.add(ix(x, y)); Rm.decor.push({ t: 'lamp', k: 'gaslamp', x, y }); }
  }
  for (let q = 0, t = 0; q < (name === 'steam' ? 26 : 16) && t < 4000; t++) { const p = pick(nodes), x = p.x + ri(-L, L), y = p.y + ri(-L, L); if (put({ t: 'works', k: 'vent', x, y })) q++; }
  Rm.hero = { x: nodes[0].x * 16 + 8, y: nodes[0].y * 16 + 12 };
  return Rm;
}
function works(D) {
  const { G, W, S, R } = D;
  const St = (G.R.steam = genWorks(D, 'steam', 0x57ea)), Ge = (G.R.gears = genWorks(D, 'gears', 0x6ea2)), Fu = (G.R.furnace = genWorks(D, 'furnace', 0xf0a7));
  const clear = (Rm, x, y) => !Rm.decor.some((o) => Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 3) && !Rm.portals.some((p) => Math.abs(p.x - x) <= 3 && Math.abs(p.y - y) <= 3);
  const fl = (Rm) => (x, y) => Rm.ground[y * Rm.w + x] === W.GRASS && y + 2 < Rm.h && Rm.ground[(y + 1) * Rm.w + x] === W.GRASS && Rm.ground[(y + 2) * Rm.w + x] === W.GRASS && clear(Rm, x, y);
  const pair = (A, okA, B, okB, n, sep) => { const ua = [], ub = []; for (let k = 0; k < n; k++) { const a = W.spotIn(A, R, okA, ua, sep), b = W.spotIn(B, R, okB, ub, sep); if (a && b) { ua.push(a); ub.push(b); W.link(A, a, B, b, 'cage'); } } return ua; };
  const U = G.R.under;
  if (U) pair(U, (x, y) => U.ground[y * U.w + x] === W.GRASS && !U.wild[y * U.w + x] && clear(U, x, y), St, fl(St), 2, 40);
  // the ironworks' lift cages down into the tunnels, on its streets
  if (S.metro && D.occ) {
    const N = S.w, ok = (x, y) => { if (W.districtAt(S, x, y) !== W.D.D_WORKS) return false; for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (y + dy) * N + x + dx; if (S.ground[i] !== W.STREET || D.occ[i] || D.solid[i]) return false; } return clear(S, x, y); };
    pair(S, ok, St, fl(St), 2, 30);
  }
  pair(St, fl(St), Ge, fl(Ge), 2, 40);
  pair(Ge, fl(Ge), Fu, fl(Fu), 2, 40);
  for (const Rm of [St, Ge, Fu]) if (Rm.portals[0]) Rm.hero = { x: Rm.portals[0].x * 16 + 8, y: (Rm.portals[0].y + 1) * 16 + 12 };
  // brass safes: the treasure down here
  for (const [Rm, n] of [[St, 6], [Ge, 5], [Fu, 5]]) { const got = []; for (let q = 0; q < n; q++) { const p = W.spotIn(Rm, R, fl(Rm), got, Rm.w / 7, 3000); if (p) { got.push(p); Rm.decor.push({ t: 'chest', k: 'safe', x: p.x, y: p.y }); } } }
}
