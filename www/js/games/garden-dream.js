// The dream, laid over the garden's world (a new one, or one already lived in: nothing sown or found
// is lost). Same sizes as before. It adds:
//   villages     houses round a little square with a well, lamps, gardens, a windmill or a market
//                stall, each in its country's own style, joined to the old roads (the people live here)
//   the city     a neon district of towers and wet streets with a canal, a holo-plaza, signs and
//                lamps; lifts go down to the undercity and up to the rooftops
//   forest paths winding trails through the woods, lit by lanterns, with a gate where they leave the
//                road and something waiting at the far end: a chest, a fairy ring, a spirit pond,
//                a ribbon tree, a lantern shrine, a crystal garden
//   depths       under the canyons a violet gorge, and under that the abyss with its lakes of fire
//   heights      over the sky islands the high sky, and over that the star sea, always night
//   treasure     chests, urns, geodes and capsules in every realm, and glints in the grass
//   giants       the gentle gardeners, who walk the meadows and leave forest where they step
// Strange creatures are added chunk by chunk as you come near (populateDream).
import { mulberry32 } from '../util.js';

const STYLE = ['cottage', 'timber', 'cottage', 'stilt', 'stone', 'timber', 'adobe', 'treehouse', 'igloo', 'shroom'];   // by kind of country
const LAMP = ['lamp', 'stonelamp', 'lamp', 'lamp', 'stonelamp', 'lamp', 'lamp', 'stonelamp', 'stonelamp', 'shroomlamp'];
const FLOWERS5 = ['daisy', 'tulip', 'poppy', 'lavender', 'bluebell', 'cosmos'];

export function dreamify(G, W) {
  if (G.v >= 5) return G;
  const S = G.R.surface, R = mulberry32((G.seed ^ 0xd4ea11) >>> 0), N = S.w, M = N >> 1;
  const D = { G, W, R, S, N, M, rr: (a, b) => a + R() * (b - a), ri: (a, b) => Math.floor(a + R() * (b - a + 1)), pick: (a) => a[Math.floor(R() * a.length)] };
  // where nothing may be built: round the start, on what the gardener sowed, on ruins and ways out
  const av = (D.av = new Uint8Array(N * N)), mark = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(N - 1, y1); y++) av.fill(1, y * N + Math.max(0, x0), y * N + Math.min(N - 1, x1) + 1); };
  D.mark = mark;
  mark(M - 30, M - 30, M + 30, M + 30);
  for (const p of S.plants) if (!p.n) mark(p.x - 4, p.y - 4, p.x + 4, p.y + 4); else if (p.k === 'giant') mark(p.x - 4, p.y - 5, p.x + 4, p.y + 4);
  for (const r of S.ruins) mark(r.x - 4, r.y - 4, r.x + r.w + 3, r.y + r.h + 3);
  for (const p of S.portals) mark(p.x - 4, p.y - 4, p.x + 4, p.y + 5);
  S.villages = []; S.places = [];
  respecies(D);
  villages(D);
  city(D);
  trails(D);
  realms(D);
  treasure(D);
  giants(D);
  for (const Rm of Object.values(G.R)) { delete Rm.dIdx; delete Rm.pIdx; }
  G.v = 5;
  return G;
}

// ------------------------------------------------ helpers
const BAD = (W) => [W.WATER, W.ROCK, W.CHASM, W.ICE, W.PORTAL, W.BRIDGE, W.STONE, W.STREET, W.VOID];
function findSite(D, Rm, w, h, d0, d1, maxBad, tries = 5000) {
  const { W, R } = D, bad = BAD(W), cx = Rm.w >> 1, cy = Rm.h >> 1;
  for (let t = 0; t < tries; t++) {
    const a = R() * 6.283, d = d0 + R() * (d1 - d0), x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d), x0 = x - (w >> 1), y0 = y - (h >> 1);
    if (x0 < 8 || y0 < 8 || x0 + w > Rm.w - 8 || y0 + h > Rm.h - 8) continue;
    let nb = 0, no = false;
    for (let yy = y0; yy < y0 + h && !no; yy++) for (let xx = x0; xx < x0 + w; xx++) {
      const i = yy * Rm.w + xx, g = Rm.ground[i];
      if ((Rm === D.S && D.av[i]) || g === W.CHASM || g === W.PORTAL || g === W.STREET) { no = true; break; }
      if (bad.includes(g)) nb++;
    }
    if (!no && nb <= maxBad * w * h) return { x, y };
  }
  return null;
}
const dropPlants = (Rm, x0, y0, x1, y1) => { Rm.plants = Rm.plants.filter((p) => !p.n || p.k === 'giant' || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1); };
// a footpath from a to the nearest existing path or road, wandering a little; planks over water
function carve(D, Rm, a, c) {
  const { W, R } = D; let x = a.x, y = a.y;
  for (let st = 0; st < 400 && (x !== c.x || y !== c.y); st++) {
    const dx = c.x - x, dy = c.y - y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (R() < 0.12 && ax + ay > 6) { if (ax > ay) y += R() < 0.5 ? 1 : -1; else x += R() < 0.5 ? 1 : -1; } else if (R() < ax / (ax + ay)) x += Math.sign(dx); else y += Math.sign(dy);
    if (!W.inside(Rm, x, y)) break;
    const i = W.ix(Rm, x, y), g = Rm.ground[i];
    if ([W.PORTAL, W.STONE, W.BRIDGE, W.ICE, W.STREET, W.PATH].includes(g)) continue;
    Rm.ground[i] = g === W.WATER || g === W.CHASM ? W.BRIDGE : W.PATH; Rm.wild[i] = 0;
  }
}
function nearestPath(D, Rm, x, y, rmin, rmax) {
  const { W } = D;
  for (let r = rmin; r <= rmax; r++) for (let k = 0; k < r * 8; k++) {
    const a = (k / (r * 8)) * 6.283, xx = Math.round(x + Math.cos(a) * r), yy = Math.round(y + Math.sin(a) * r);
    if (W.inside(Rm, xx, yy) && Rm.ground[W.ix(Rm, xx, yy)] === W.PATH) return { x: xx, y: yy };
  }
  return null;
}
const decorAt = (Rm, x, y) => Rm.decor.some((o) => o.x === x && o.y === y);
const groundOK = (W, Rm, x, y) => W.inside(Rm, x, y) && [W.GRASS, W.FOREST, W.FLOWERS, W.SAND, W.PATH].includes(Rm.ground[W.ix(Rm, x, y)]);

// some of the trees already standing become the new kinds, so old woods are as varied as new ones
function respecies(D) {
  const { S, W } = D, B = W.B, bio = W.biomeMap(S);
  const SWAP = { [B.B_WOODS]: { oak: 'ginkgo', pine: 'redwood' }, [B.B_DOWNS]: { cherry: 'jacaranda', birch: 'wisteria', apple: 'wisteria' }, [B.B_MARSH]: { willow: 'mangrove', birch: 'mangrove' }, [B.B_HEATH]: { pine: 'cypress' }, [B.B_AUTUMN]: { oak: 'ginkgo' }, [B.B_ANCIENT]: { pine: 'redwood', oak: 'redwood' }, [B.B_FUNGAL]: { spirittree: 'crystaltree' }, [B.B_MEADOW]: { pine: 'cypress', birch: 'jacaranda' } };
  for (const p of S.plants) { if (!p.n) continue; const to = SWAP[bio[p.y * S.w + p.x]]?.[p.k]; if (to && W.hash2(p.x, p.y, 77) < 0.3) p.k = to; }
}

// ------------------------------------------------ villages
function village(D, Rm, cx, cy, style, n, lamp = 'lamp') {
  const { W, R, rr, ri, pick } = D, houses = [], ix = (x, y) => W.ix(Rm, x, y), sky = Rm.kind === 'sky';
  const soft = (x, y, g) => { if (!W.inside(Rm, x, y)) return; const i = ix(x, y), o = Rm.ground[i]; if (o === W.PORTAL || o === W.CHASM || o === W.VOID || (sky && g !== W.GRASS)) return; Rm.ground[i] = g; Rm.wild[i] = 0; };
  // the clearing
  for (let dy = -8; dy <= 8; dy++) for (let dx = -10; dx <= 10; dx++) { const x = cx + dx, y = cy + dy; if (!W.inside(Rm, x, y) || Math.hypot(dx / 10, dy / 8) + (W.hash2(x, y, 5) - 0.5) * 0.3 > 1) continue; const i = ix(x, y), g = Rm.ground[i]; Rm.wild[i] = 0; if (!sky && [W.FOREST, W.WATER, W.ROCK, W.ICE, W.SAND].includes(g) && Math.hypot(dx / 10, dy / 8) < 0.82) Rm.ground[i] = W.GRASS; }
  dropPlants(Rm, cx - 9, cy - 8, cx + 9, cy + 8);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) soft(cx + dx, cy + dy, sky ? W.GRASS : W.STONE);
  Rm.decor.push({ t: 'prop', k: 'well', x: cx, y: cy });
  for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
    const a = (k / n) * 6.283 + rr(-0.25, 0.25), hx = Math.round(cx + Math.cos(a) * rr(5.2, 7.4)), hy = Math.round(cy + Math.sin(a) * rr(3.8, 5.6));
    if (houses.some((h) => Math.abs(h.x - hx) < 5 && Math.abs(h.y - hy) < 4) || (Math.abs(hx - cx) < 4 && Math.abs(hy - cy) < 4)) continue;
    let ok = true;
    for (let yy = hy - 1; yy <= hy + 1 && ok; yy++) for (let xx = hx - 1; xx <= hx + 1; xx++) if (!W.inside(Rm, xx, yy) || [W.VOID, W.CHASM, W.PORTAL, W.BRIDGE].includes(Rm.ground[ix(xx, yy)])) { ok = false; break; }
    if (!ok) continue;
    for (let yy = hy - 1; yy <= hy; yy++) for (let xx = hx - 1; xx <= hx + 1; xx++) soft(xx, yy, W.GRASS);
    const v = ri(0, 3);
    Rm.decor.push({ t: 'house', x: hx, y: hy, s: style, v });
    houses.push({ x: hx, y: hy, v });
    // the path from its door to the square
    if (!sky) { let x = hx, y = hy + 1; for (let st = 0; st < 30 && (Math.abs(x - cx) > 1 || Math.abs(y - cy) > 1); st++) { soft(x, y, Rm.ground[ix(x, y)] === W.STONE ? W.STONE : W.PATH); if (Math.abs(x - cx) > Math.abs(y - cy)) x += Math.sign(cx - x); else y += Math.sign(cy - y); if (houses.some((h) => Math.abs(h.x - x) <= 1 && (y === h.y || y === h.y - 1))) { x -= Math.sign(cx - x) || 1; y += Math.sign(cy - y) || 1; } } }
    // a flower bed beside it, and often a fruit tree behind
    const sd = R() < 0.5 ? -1 : 1;
    for (let q = 0; q < 3; q++) { const fx = hx + sd * 2 + (q === 2 ? sd : 0), fy = hy + (q % 2); if (groundOK(W, Rm, fx, fy) && !decorAt(Rm, fx, fy)) { if (!sky) Rm.ground[ix(fx, fy)] = W.FLOWERS; W.natural(Rm, sky ? 'skyorchid' : pick(FLOWERS5), fx, fy); } }
    if (R() < 0.6 && groundOK(W, Rm, hx - sd * 2, hy - 2)) W.natural(Rm, sky ? 'cherry' : pick(['apple', 'cherry', 'wisteria', 'apple']), hx - sd * 2, hy - 2);
    k++;
  }
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) if (R() < 0.8 && groundOK(W, Rm, cx + dx, cy + dy)) Rm.decor.push({ t: 'lamp', k: lamp, x: cx + dx, y: cy + dy });
  const free = (x, y) => groundOK(W, Rm, x, y) && !decorAt(Rm, x, y) && !houses.some((h) => Math.abs(h.x - x) <= 2 && Math.abs(h.y - y) <= 2);
  if (!sky && R() < 0.75) { const sx = cx + (R() < 0.5 ? -3 : 3), sy = cy + 2; if (free(sx, sy)) Rm.decor.push({ t: 'prop', k: 'stall', x: sx, y: sy, v: ri(0, 2) }); }
  if (!sky && R() < 0.5) for (let t = 0; t < 20; t++) { const a = R() * 6.283, x = Math.round(cx + Math.cos(a) * 9), y = Math.round(cy + Math.sin(a) * 7); if (free(x, y) && free(x - 1, y) && free(x + 1, y)) { Rm.decor.push({ t: 'prop', k: 'windmill', x, y }); break; } }
  // a small field
  if (!sky && R() < 0.6) { const fx = cx + (R() < 0.5 ? -8 : 6), fy = cy + ri(-2, 2), crop = pick(['sunflower', 'berrybush', 'lavender', 'tulip']); for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) if (free(fx + dx, fy + dy)) W.natural(Rm, crop, fx + dx, fy + dy); }
  (Rm.villages ||= []).push({ x: cx, y: cy, r: 10, style, houses });
  if (Rm === D.S) D.mark(cx - 12, cy - 10, cx + 12, cy + 10);
  if (!sky) { const p = nearestPath(D, Rm, cx, cy, 11, 70); if (p) carve(D, Rm, { x: cx, y: cy + 2 }, p); }
}
function villages(D) {
  const { S, W, R, G } = D, bio = W.biomeMap(S), at = [];
  const put = (d0, d1) => { for (let t = 0; t < 40; t++) { const p = findSite(D, S, 22, 18, d0, d1, 0.12, 400); if (!p || at.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 95)) continue; const b = bio[p.y * S.w + p.x]; village(D, S, p.x, p.y, STYLE[b], D.ri(4, 8), LAMP[b]); at.push(p); return true; } return false; };
  put(44, 60);
  for (let n = 0; n < 11; n++) put(90, S.w * 0.47);
  // a hamlet in the mountains, a camp in the canyons, cloud houses in the sky
  for (const [name, style, lamp] of [['mountain', 'stone', 'stonelamp'], ['canyon', 'adobe', 'lamp']]) { const Rm = G.R[name]; if (!Rm) continue; for (let n = 0; n < 2; n++) { const p = findSite(D, Rm, 22, 18, 20, Rm.w * 0.42, 0.1, 3000); if (p && !(Rm.villages || []).some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 80)) village(D, Rm, p.x, p.y, style, D.ri(4, 6), lamp); } }
}
// houses of cloud on a sky realm's bigger islands
function skyVillage(D, Rm) {
  const { W, R } = D;
  for (let t = 0, n = 0; t < 3000 && n < 2; t++) {
    const x = 12 + Math.floor(R() * (Rm.w - 24)), y = 12 + Math.floor(R() * (Rm.h - 24));
    let ok = true;
    for (let dy = -4; dy <= 4 && ok; dy += 2) for (let dx = -5; dx <= 5; dx += 2) if (Rm.ground[W.ix(Rm, x + dx, y + dy)] !== W.GRASS) { ok = false; break; }
    if (!ok || Rm.portals.some((p) => Math.hypot(p.x - x, p.y - y) < 9) || (Rm.villages || []).some((o) => Math.hypot(o.x - x, o.y - y) < 40)) continue;
    village(D, Rm, x, y, 'cloud', 3, 'stonelamp'); n++;
  }
}

// ------------------------------------------------ the neon city
function city(D) {
  const { S, W, R, rr, ri, G } = D, CW = 62, CD = 52;
  const site = findSite(D, S, CW + 8, CD + 8, 120, 260, 0.2, 8000) || findSite(D, S, CW + 8, CD + 8, 100, S.w * 0.46, 0.4, 20000);
  if (!site) return;
  const cx = site.x, cy = site.y, x0 = cx - (CW >> 1), y0 = cy - (CD >> 1), x1 = x0 + CW - 1, y1 = y0 + CD - 1, ix = (x, y) => W.ix(S, x, y);
  const inC = (x, y) => { const dx = (x - cx) / (CW / 2), dy = (y - cy) / (CD / 2); return dx ** 4 + dy ** 4 + (W.hash2(x >> 1, y >> 1, 41) - 0.5) * 0.16 < 1; };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inC(x, y)) { S.ground[ix(x, y)] = W.STREET; S.wild[ix(x, y)] = 0; }
  dropPlants(S, x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  S.animals = S.animals.filter((a) => a.x < x0 * 16 || a.x > x1 * 16 || a.y < y0 * 16 || a.y > y1 * 16);
  const street = (x, y) => W.inside(S, x, y) && S.ground[ix(x, y)] === W.STREET;
  const xs = [], ys = [];
  for (let x = x0 + 3; x < x1 - 4; x += ri(7, 10)) xs.push(x);
  for (let y = y0 + 3; y < y1 - 4; y += ri(6, 8)) ys.push(y);
  const maxd = Math.hypot(CW / 2, CD / 2), mid = ys[ys.length >> 1], blocked = new Set();
  // the canal along one cross street, bridged where the avenues pass
  for (let x = x0; x <= x1; x++) if (street(x, mid)) { const br = xs.some((sx) => x === sx || x === sx + 1); S.ground[ix(x, mid)] = br ? W.BRIDGE : W.WATER; if (street(x, mid + 1) && !br) S.ground[ix(x, mid + 1)] = W.WATER; else if (br && street(x, mid + 1)) S.ground[ix(x, mid + 1)] = W.BRIDGE; }
  for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) {
    const bx0 = xs[i] + 2, bx1 = xs[i + 1] - 1, by0 = ys[j] + 2 + (ys[j] === mid ? 1 : 0), by1 = ys[j + 1] - 1, depth = by1 - by0 + 1, mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2;
    if (depth < 2) continue;
    if (Math.abs(mx - cx) < 5 && Math.abs(my - cy) < 5) {
      // the holo-plaza: a hologram hangs over it, signs all round
      S.decor.push({ t: 'holo', x: Math.round(mx), y: Math.round(my), v: ri(0, 3) });
      for (const [dx, dy] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) S.decor.push({ t: 'neon', x: Math.round(mx) + dx, y: Math.round(my) + dy, v: ri(0, 7) });
      continue;
    }
    if (R() < 0.1) {
      // a pocket park
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (street(x, y)) S.ground[ix(x, y)] = (x + y) % 3 ? W.GRASS : W.FLOWERS;
      for (let q = 0; q < 4; q++) { const x = ri(bx0, bx1), y = ri(by0, by1); if (S.ground[ix(x, y)] !== W.STREET && !S.plants.some((p) => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2)) W.natural(S, D.pick(['cherry', 'wisteria', 'jacaranda', 'willow']), x, y); }
      S.decor.push({ t: 'lamp', k: 'neonlamp', x: bx0, y: by1, v: ri(0, 2) });
      continue;
    }
    const hk = 1 - Math.hypot(mx - cx, my - cy) / maxd, rows = depth >= 4 ? [[by0 + 1, 1], [by1, 0]] : [[by1, 0]];
    for (const [fy, back] of rows) for (let x = bx0; x <= bx1;) {
      const w = Math.min(bx1 - x + 1, ri(2, 4));
      if (w < 2) break;
      let ok = true;
      for (let yy = fy - 1; yy <= fy && ok; yy++) for (let xx = x; xx < x + w; xx++) if (!street(xx, yy) || blocked.has(ix(xx, yy))) { ok = false; break; }
      if (ok && R() < 0.93) {
        const h = Math.round(back ? rr(64, 100) + hk * 56 : rr(30, 54) + hk * 26);
        S.decor.push({ t: 'tower', x, y: fy, w, d: 2, h, v: ri(0, 23) });
        for (let yy = fy - 1; yy <= fy; yy++) for (let xx = x; xx < x + w; xx++) blocked.add(ix(xx, yy));
      } else if (ok && R() < 0.5) S.decor.push({ t: 'neon', x: x + 1, y: fy, v: ri(0, 7) });
      x += w;
    }
    // an alley between the rows hides something now and then
    if (depth >= 5 && R() < 0.3) { const x = ri(bx0, bx1), y = by0 + 2; if (street(x, y) && !blocked.has(ix(x, y))) S.decor.push({ t: 'chest', k: 'capsule', x, y }); }
  }
  // lamps at the crossings, signs along the avenues
  for (const y of ys) for (const x of xs) { if (street(x - 1, y - 1) && !blocked.has(ix(x - 1, y - 1)) && R() < 0.8) S.decor.push({ t: 'lamp', k: 'neonlamp', x: x - 1, y: y - 1, v: ri(0, 2) }); if (R() < 0.3 && street(x + 2, y + 2) && !blocked.has(ix(x + 2, y + 2))) S.decor.push({ t: 'neon', x: x + 2, y: y + 2, v: ri(0, 7) }); }
  // lifts: three down to the undercity, three up to the rooftops, at crossings
  const cross = [];
  for (const y of ys) for (const x of xs) if (y !== mid && street(x, y) && street(x + 1, y + 1)) cross.push({ x, y });
  for (let q = cross.length - 1; q > 0; q--) { const j = Math.floor(R() * (q + 1)); [cross[q], cross[j]] = [cross[j], cross[q]]; }
  D.cityUp = cross.slice(0, 3); D.cityDown = cross.slice(3, 6);
  S.city = { x0, y0, x1, y1, cx, cy };
  D.mark(x0 - 4, y0 - 4, x1 + 4, y1 + 4);
  const p = nearestPath(D, S, cx, y1 + 2, 3, 90); if (p) carve(D, S, { x: cx, y: y1 + 1 }, p);
  void G;
}

// ------------------------------------------------ forest paths and what they lead to
function place(D, Rm, cx, cy, kind) {
  const { W, R, ri, pick } = D, ix = (x, y) => W.ix(Rm, x, y);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = cx + dx, y = cy + dy, d = Math.hypot(dx, dy); if (d > 3.3 || !groundOK(W, Rm, x, y)) continue; Rm.ground[ix(x, y)] = d > 2.2 ? W.FLOWERS : W.GRASS; Rm.wild[ix(x, y)] = 0; }
  dropPlants(Rm, cx - 3, cy - 3, cx + 3, cy + 3);
  const ring = (k, r, n) => { for (let q = 0; q < n; q++) { const a = (q / n) * 6.283, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); if (groundOK(W, Rm, x, y) && !Rm.plants.some((p) => p.x === x && p.y === y)) W.natural(Rm, k, x, y); } };
  if (kind === 'chest') { Rm.decor.push({ t: 'chest', k: 'chest', x: cx, y: cy }); ring(pick(FLOWERS5), 2, 5); }
  else if (kind === 'ring') { ring('glowshroom', 2, 9); Rm.decor.push({ t: 'ring', x: cx, y: cy }); }
  else if (kind === 'pond') { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dy) < 2 && groundOK(W, Rm, cx + dx, cy + dy)) Rm.ground[ix(cx + dx, cy + dy)] = W.WATER; ring('moonflower', 2.4, 7); W.critter(D.G, Rm, R() < 0.5 ? 'stag' : 'kirin', cx + 2, cy + 2); }
  else if (kind === 'ribbon') { Rm.decor.push({ t: 'prop', k: 'ribbontree', x: cx, y: cy }); ring(pick(FLOWERS5), 2.2, 6); }
  else if (kind === 'shrine') { Rm.decor.push({ t: 'gate', x: cx, y: cy + 1 }); for (const dx of [-2, 2]) Rm.decor.push({ t: 'lamp', k: 'stonelamp', x: cx + dx, y: cy }); Rm.decor.push({ t: 'chest', k: 'urn', x: cx, y: cy - 1 }); for (let q = 0; q < 3; q++) W.critter(D.G, Rm, 'kodama', cx + ri(-2, 2), cy + ri(-2, 2)); }
  else { for (let q = 0; q < 5; q++) { const x = cx + ri(-2, 2), y = cy + ri(-2, 2); if (!decorAt(Rm, x, y) && groundOK(W, Rm, x, y)) Rm.decor.push({ t: 'crystal', x, y, c: pick(['#9ff0f0', '#c8a8ff', '#8fd8ff', '#ffb8e8']) }); } W.natural(Rm, 'crystaltree', cx, cy); W.critter(D.G, Rm, 'crab', cx + 1, cy + 2); }
  (Rm.places ||= []).push({ x: cx, y: cy, k: kind });
}
function trails(D) {
  const { S, W, R, rr, N, M } = D, bio = W.biomeMap(S), ix = (x, y) => W.ix(S, x, y), no = [W.ROCK, W.CHASM, W.PORTAL, W.STREET, W.ICE, W.STONE];
  const kinds = ['chest', 'chest', 'chest', 'ring', 'pond', 'ribbon', 'shrine', 'crystal', 'chest', 'ring'];
  for (let t = 0, made = 0; t < 9000 && made < 46; t++) {
    const near = made < 3, a0 = R() * 6.283, d0 = near ? rr(34, 60) : rr(60, N * 0.47);
    let x = Math.round(M + Math.cos(a0) * d0), y = Math.round(M + Math.sin(a0) * d0);
    if (x < 10 || y < 10 || x > N - 11 || y > N - 11 || S.ground[ix(x, y)] !== W.FOREST || D.av[ix(x, y)]) continue;
    // begin on a road if one runs close by, so the path branches off it
    const rd = nearestPath(D, S, x, y, 1, 12), fromRoad = !!rd;
    let a = R() * 6.283, fx = x, fy = y;
    if (rd) { a = Math.atan2(y - rd.y, x - rd.x); fx = rd.x; fy = rd.y; }
    const len = rr(55, 130), pts = [];
    let px = fx, py = fy, fails = 0, lampAt = 6;
    for (let st = 0; st < len && fails < 8; st++) {
      a += (W.vnoise(st * 0.13, made * 7.31, 911) - 0.5) * 0.85;
      const nx = px + Math.cos(a), ny = py + Math.sin(a), tx = Math.round(nx), ty = Math.round(ny);
      if (tx < 8 || ty < 8 || tx > N - 9 || ty > N - 9 || D.av[ix(tx, ty)] || no.includes(S.ground[ix(tx, ty)])) { a += 1.1; fails++; continue; }
      if (S.ground[ix(tx, ty)] === W.WATER) {
        // a short plank bridge if the far bank is close; else turn aside
        let far = 0; for (let q = 1; q <= 5; q++) { const g = S.ground[ix(Math.round(nx + Math.cos(a) * q), Math.round(ny + Math.sin(a) * q))]; if (g !== W.WATER) { far = no.includes(g) ? 0 : q; break; } }
        if (!far) { a += 1.1; fails++; continue; }
        for (let q = 0; q < far; q++) { const bx = Math.round(nx + Math.cos(a) * q), by = Math.round(ny + Math.sin(a) * q); S.ground[ix(bx, by)] = W.BRIDGE; }
        px = nx + Math.cos(a) * far; py = ny + Math.sin(a) * far; continue;
      }
      px = nx; py = ny; fails = 0;
      const i = ix(tx, ty);
      if (S.ground[i] !== W.PATH && S.ground[i] !== W.BRIDGE) { S.ground[i] = W.PATH; S.wild[i] = 0; }
      pts.push([tx, ty]);
      if (--lampAt <= 0) {
        lampAt = 8 + Math.floor(R() * 4);
        const sd = R() < 0.5 ? 1 : -1, lx = Math.round(nx - Math.sin(a) * 1.6 * sd), ly = Math.round(ny + Math.cos(a) * 1.6 * sd);
        if (groundOK(W, S, lx, ly) && S.ground[ix(lx, ly)] !== W.PATH && !decorAt(S, lx, ly)) { S.decor.push({ t: 'lamp', k: LAMP[bio[ix(lx, ly)]], x: lx, y: ly }); S.wild[ix(lx, ly)] = 0; }
      }
    }
    if (pts.length < 20) continue;
    const drop = new Set(pts.map(([qx, qy]) => qy * N + qx));
    S.plants = S.plants.filter((p) => !p.n || p.k === 'giant' || !drop.has(p.y * N + p.x));
    if (fromRoad && pts.length > 3) { const [gx, gy] = pts[2]; if (!decorAt(S, gx, gy)) S.decor.push({ t: 'gate', x: gx, y: gy }); }
    const [ex, ey] = pts[pts.length - 1];
    if (!D.av[ix(ex, ey)]) { place(D, S, ex, ey, kinds[made % kinds.length]); D.mark(ex - 4, ey - 4, ex + 4, ey + 4); }
    made++;
  }
}

// ------------------------------------------------ deeper and higher
function genGorge(D) {
  const { G, W, R } = D, Rm = W.mkRealm('gorge', G.seed ^ 0x90a7), N = Rm.w;
  const f1 = W.caField(R, N, N, 7, 0.5, 5), f2 = W.caField(R, N, N, 2.5, 0.5, 4), f3 = W.caField(R, N, N, 1, 0.45, 2), f = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) f[i] = f1[i] * 0.55 + f2[i] * 0.3 + f3[i] * 0.15 + (R() - 0.5) * 0.04;
  const thr = W.quantS(f, 0.43);
  for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0, edge = Math.min(x, y, N - 1 - x, N - 1 - y); Rm.ground[i] = edge < 2 || f[i] > thr ? W.ROCK : f[i] > thr - 0.04 ? W.SAND : f[i] < thr - 0.3 ? W.FLOWERS : W.GRASS; }
  W.joinRegions(Rm, R, (i) => Rm.ground[i] !== W.ROCK, (i) => { Rm.ground[i] = W.GRASS; });
  // a glowing river down the middle and a few still pools
  let y = N * (0.35 + R() * 0.3), dy = 0;
  for (let x = 2; x < N - 2; x++) { dy = Math.max(-1.3, Math.min(1.3, dy + (R() - 0.5) * 0.6)); y = Math.max(8, Math.min(N - 8, y + dy)); for (let o = -3; o <= 3; o++) { const i = W.ix(Rm, x, Math.round(y) + o); Rm.ground[i] = Math.abs(o) <= 1 ? W.WATER : Rm.ground[i] === W.ROCK ? W.SAND : Rm.ground[i]; } }
  const home = W.spotIn(Rm, R, W.openGround(Rm)) || { x: N >> 1, y: N >> 1 };
  Rm.hero = { x: home.x * 16 + 8, y: home.y * 16 + 12 };
  return Rm;
}
// rooftops over the city: flat roofs joined by skywalks, with gardens, signs and lamps
function genRoofs(D) {
  const { G, W, R, ri, pick } = D, Rm = W.mkRealm('roofs', G.seed ^ 0x700f5), N = Rm.w, roofs = [];
  Rm.ground.fill(W.VOID);
  for (let t = 0; t < 4000 && roofs.length < 40; t++) {
    const w = ri(6, 13), h = ri(4, 9), x = ri(6, N - w - 6), y = ri(6, N - h - 6);
    if (roofs.some((o) => x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 4 && y + h + 4 > o.y)) continue;
    roofs.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) Rm.ground[W.ix(Rm, xx, yy)] = W.GRASS;
  }
  const joined = [0];
  while (joined.length < roofs.length) {
    let bi = -1, bj = -1, bd = Infinity;
    for (const i of joined) for (let j = 0; j < roofs.length; j++) if (!joined.includes(j)) { const d = Math.abs(roofs[i].cx - roofs[j].cx) + Math.abs(roofs[i].cy - roofs[j].cy); if (d < bd) { bd = d; bi = i; bj = j; } }
    joined.push(bj);
    let x = roofs[bi].cx, y = roofs[bi].cy; const tx = roofs[bj].cx, ty = roofs[bj].cy;
    while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); const i = W.ix(Rm, x, y); if (Rm.ground[i] === W.VOID) Rm.ground[i] = W.BRIDGE; }
  }
  for (const o of roofs) {
    const r = R();
    if (r < 0.45) { for (let q = 0; q < 5; q++) { const x = ri(o.x + 1, o.x + o.w - 2), y = ri(o.y + 1, o.y + o.h - 2); if (!Rm.plants.some((p) => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2)) W.natural(Rm, pick(['cherry', 'wisteria', 'fern', 'rosebush', 'hydrangea', 'jacaranda', 'moonflower']), x, y); } }
    else if (r < 0.75) Rm.decor.push({ t: 'neon', x: o.x + 1, y: o.y + 1, v: ri(0, 7) }, { t: 'neon', x: o.x + o.w - 2, y: o.y + 1, v: ri(0, 7) });
    if (R() < 0.6) Rm.decor.push({ t: 'lamp', k: 'neonlamp', x: o.x, y: o.y + o.h - 1, v: ri(0, 2) });
    if (R() < 0.22) Rm.decor.push({ t: 'chest', k: 'capsule', x: o.x + o.w - 1, y: o.y + o.h - 1 });
  }
  Rm.roofs = roofs.map((o) => [o.x, o.y, o.w, o.h]);
  Rm.hero = { x: roofs[0].cx * 16 + 8, y: roofs[0].cy * 16 + 12 };
  return Rm;
}
function realms(D) {
  const { G, W, R, S } = D, ix = (Rm, x, y) => W.ix(Rm, x, y);
  const gOK = (Rm) => (x, y) => W.openGround(Rm)(x, y) && !Rm.wild[ix(Rm, x, y)] && !decorAt(Rm, x, y) && !(Rm.villages || []).some((v) => Math.hypot(v.x - x, v.y - y) < 12);
  const cOK = (Rm) => (x, y) => Rm.ground[ix(Rm, x, y)] === W.GRASS && !Rm.wild[ix(Rm, x, y)] && !Rm.portals.some((q) => Math.hypot(q.x - x, q.y - y) < 8) && !decorAt(Rm, x, y);
  const links = (A, okA, B, okB, n, sepA, sepB, style) => { const ua = [], ub = []; for (let k = 0; k < n; k++) { const a = W.spotIn(A, R, okA, ua, sepA), b = W.spotIn(B, R, okB, ub, sepB); if (a && b) { ua.push(a); ub.push(b); W.link(A, a, B, b, style); } } };
  const bare = (Rm) => { const h = Rm.portals[0]; Rm.portals.length = 0; Rm.decor = Rm.decor.filter((o) => o.t !== 'lift'); if (h) Rm.ground[ix(Rm, h.x, h.y)] = W.GRASS; return Rm; };
  // down: canyon -> gorge -> abyss
  const Cn = G.R.canyon, Go = (G.R.gorge = genGorge(D));
  links(Cn, gOK(Cn), Go, gOK(Go), 3, 70, 50);
  const Ab = (G.R.abyss = W.genCave(G, R, [], 'abyss', 'gorge', 0x1ab55).Rm);
  links(Go, gOK(Go), Ab, cOK(Ab), 2, 60, 40);
  Ab.hero = Ab.portals[0] ? { x: Ab.portals[0].x * 16 + 8, y: (Ab.portals[0].y + 1) * 16 + 12 } : Ab.hero;
  // up: sky -> high -> stars
  const K = G.R.sky, Hi = (G.R.high = bare(W.genSky(G, R, 'high', 0x51e70))), St = (G.R.stars = bare(W.genSky(G, R, 'stars', 0x57a25)));
  links(K, cOK(K), Hi, cOK(Hi), 2, 30, 30, 'spire');
  links(Hi, cOK(Hi), St, cOK(St), 2, 30, 30, 'spire');
  skyVillage(D, K); skyVillage(D, Hi);
  // the city's other layers
  if (S.city) {
    const U = (G.R.under = W.genCave(G, R, [], 'under', 'surface', 0x0c170).Rm), Rf = (G.R.roofs = genRoofs(D));
    for (const a of D.cityDown || []) { const b = W.spotIn(U, R, cOK(U), U.portals, 30); if (b) W.link(S, a, U, b, 'hatch'); }
    for (const a of D.cityUp || []) { const b = W.spotIn(Rf, R, cOK(Rf), Rf.portals, 30); if (b) W.link(S, a, Rf, b, 'tube'); }
    // link() turns the lift's own tiles to grass: in the city they are street again
    for (const a of [...(D.cityDown || []), ...(D.cityUp || [])]) for (let yy = a.y - 1; yy <= a.y + 2; yy++) for (let xx = a.x - 1; xx <= a.x + 1; xx++) if (S.ground[ix(S, xx, yy)] === W.GRASS) S.ground[ix(S, xx, yy)] = W.STREET;
    U.hero = U.portals[0] ? { x: U.portals[0].x * 16 + 8, y: (U.portals[0].y + 1) * 16 + 12 } : U.hero;
    // the undercity's night market: lamps, stalls and signs along its halls
    for (let n = 0; n < 60; n++) { const p = W.spotIn(U, R, cOK(U), [], 0, 60); if (p) U.decor.push(n % 3 === 0 ? { t: 'neon', x: p.x, y: p.y, v: D.ri(0, 7) } : n % 7 === 1 ? { t: 'prop', k: 'stall', x: p.x, y: p.y, v: D.ri(0, 2) } : { t: 'lamp', k: 'neonlamp', x: p.x, y: p.y, v: D.ri(0, 2) }); }
  }
}

// ------------------------------------------------ treasure, and the giants
function treasure(D) {
  const { G, W, R } = D, ix = (Rm, x, y) => W.ix(Rm, x, y);
  const KINDS = { surface: ['chest', 26], mountain: ['chest', 10], canyon: ['urn', 10], gorge: ['urn', 9], cave: ['geode', 12], deep: ['geode', 12], abyss: ['geode', 9], under: ['capsule', 9], sky: ['chest', 6], high: ['starchest', 6], stars: ['starchest', 9], canopy: ['chest', 6] };
  for (const [name, [k, n]] of Object.entries(KINDS)) {
    const Rm = G.R[name]; if (!Rm) continue;
    const ok = (x, y) => { const i = ix(Rm, x, y), g = Rm.ground[i]; return (Rm.kind === 'surface' ? [W.GRASS, W.FOREST, W.FLOWERS, W.SAND].includes(g) : g === W.GRASS) && !(Rm === D.S && D.av[i]) && !decorAt(Rm, x, y) && !Rm.portals.some((q) => Math.hypot(q.x - x, q.y - y) < 5) && !Rm.plants.some((p) => p.x === x && p.y === y); };
    const got = [];
    for (let q = 0; q < n; q++) { const p = W.spotIn(Rm, R, ok, got, Rm.w / 9, 1500); if (p) { got.push(p); Rm.decor.push({ t: 'chest', k, x: p.x, y: p.y }); Rm.wild[ix(Rm, p.x, p.y)] = 0; } }
  }
  // the islands in the lakes each keep something
  for (const o of D.S.decor.filter((q) => q.t === 'island')) if (R() < 0.7 && !decorAt(D.S, o.x + 1, o.y + 1)) D.S.decor.push({ t: 'chest', k: 'urn', x: o.x + 1, y: o.y + 1 });
}
function giants(D) {
  const { G, W, R, S, M } = D, ok = (x, y) => [W.GRASS, W.FLOWERS].includes(S.ground[W.ix(S, x, y)]) && !D.av[W.ix(S, x, y)];
  G.giants = [];
  for (let n = 0, t = 0; n < 5 && t < 4000; t++) {
    const a = R() * 6.283, d = n === 0 ? 34 + R() * 10 : 70 + R() * (S.w * 0.42 - 70), x = Math.round(M + Math.cos(a) * d), y = Math.round(M + Math.sin(a) * d);
    if (!W.inside(S, x, y) || (n > 0 && !ok(x, y)) || (n === 0 && [W.WATER, W.ROCK, W.CHASM].includes(S.ground[W.ix(S, x, y)])) || G.giants.some((g) => Math.hypot(g.x / 16 - x, g.y / 16 - y) < 110)) continue;
    G.giants.push({ x: x * 16 + 8, y: y * 16 + 12, v: n % 3 }); n++;
  }
}

// ------------------------------------------------ strange creatures, glints and the gorge's flora, as you come near
const FAUNA = [
  [['mossling', 0.06], ['snail', 0.05], ['tortoise', 0.014]], [['kodama', 0.1], ['mossling', 0.06]], [['kirin', 0.025], ['snail', 0.06], ['tortoise', 0.02]], [['jelly', 0.16], ['axolotl', 0.12]], [['spiritfox', 0.05], ['moonhare', 0.06]],
  [['spiritfox', 0.06], ['mothdeer', 0.04]], [['gecko', 0.12], ['emberbird', 0.06], ['tortoise', 0.02]], [['stag', 0.035], ['kodama', 0.14], ['mothdeer', 0.06]], [['moonhare', 0.1], ['stag', 0.025], ['spiritfox', 0.04]], [['mothdeer', 0.12], ['jelly', 0.16], ['crab', 0.06]]
];
const REALM_FAUNA = { mountain: [['stag', 0.03], ['moonhare', 0.06], ['phoenix', 0.012]], canyon: [['gecko', 0.12], ['emberbird', 0.07]], gorge: [['emberbird', 0.12], ['gecko', 0.1], ['crab', 0.1], ['jelly', 0.08]], cave: [['kodama', 0.07], ['crab', 0.1], ['axolotl', 0.1]], deep: [['kodama', 0.08], ['crab', 0.12], ['axolotl', 0.1], ['jelly', 0.06]],
  abyss: [['angler', 0.3], ['emberbird', 0.12], ['crab', 0.1]], under: [['cat', 0.22], ['drone', 0.28], ['koi', 0.12]], sky: [['manta', 0.08], ['koi', 0.05]], high: [['manta', 0.1], ['phoenix', 0.03], ['koi', 0.06]], stars: [['jelly', 0.1], ['moonhare', 0.06], ['koi', 0.05]], canopy: [['kodama', 0.12], ['mothdeer', 0.06]], roofs: [['cat', 0.22], ['drone', 0.3], ['koi', 0.12]] };
const FLYERS = new Set(['jelly', 'emberbird', 'angler', 'manta', 'koi', 'phoenix', 'drone']);
export function populateDream(G, Rm, cx, cy, W) {
  const C = Math.ceil(Rm.w / W.CH);
  if (!Rm.pop5 || Rm.pop5.length !== C * C) Rm.pop5 = new Uint8Array(C * C);
  const ci = cy * C + cx;
  if (cx < 0 || cy < 0 || cx >= C || cy >= C || Rm.pop5[ci]) return false;
  Rm.pop5[ci] = 1;
  if ((G.v || 0) < 5) return false;
  const R = mulberry32((Rm.seed * 131 + ci * 104729 + 5) | 0), x0 = cx * W.CH, y0 = cy * W.CH, ix = (x, y) => W.ix(Rm, x, y);
  const spot = (ok) => { for (let t = 0; t < 24; t++) { const x = x0 + Math.floor(R() * W.CH), y = y0 + Math.floor(R() * W.CH); if (W.inside(Rm, x, y) && x > 2 && y > 2 && x < Rm.w - 3 && y < Rm.h - 3 && ok(Rm.ground[ix(x, y)], x, y)) return [x, y]; } return null; };
  const land = (g) => [W.GRASS, W.FOREST, W.FLOWERS, W.SAND, W.PATH, W.STREET].includes(g), mx = Math.min(Rm.w - 1, x0 + 8), my = Math.min(Rm.h - 1, y0 + 8);
  const inCity = Rm.city && mx >= Rm.city.x0 && mx <= Rm.city.x1 && my >= Rm.city.y0 && my <= Rm.city.y1;
  const list = inCity ? [['cat', 0.35], ['drone', 0.4], ['koi', 0.2]] : Rm.name === 'surface' ? FAUNA[W.biomeMap(Rm)[my * Rm.w + mx]] : REALM_FAUNA[Rm.name] || [];
  for (const [k, pr] of list) {
    if (R() >= pr) continue;
    const p = spot(k === 'axolotl' ? (g) => g === W.WATER : FLYERS.has(k) ? (g) => g !== W.ROCK : (g, x, y) => land(g) && !Rm.wild[ix(x, y)]);
    if (!p) continue;
    W.critter(G, Rm, k, p[0], p[1]);
    if (k === 'kodama' || k === 'jelly' || k === 'moonhare') for (let q = 0; q < 2; q++) W.critter(G, Rm, k, p[0], p[1]);
  }
  // a glint in the grass: something small and bright to find
  if (R() < (Rm.kind === 'surface' ? 0.13 : 0.1)) { const p = spot((g, x, y) => land(g) && !Rm.wild[ix(x, y)] && !Rm.decor.some((o) => o.x === x && o.y === y)); if (p) { Rm.decor.push({ t: 'glint', x: p[0], y: p[1] }); delete Rm.dIdx; } }
  // the gorge grows crystal and light
  if (Rm.name === 'gorge') {
    for (let y = Math.max(3, y0); y < Math.min(Rm.h - 3, y0 + W.CH); y++) for (let x = Math.max(3, x0); x < Math.min(Rm.w - 3, x0 + W.CH); x++) {
      const g = Rm.ground[ix(x, y)], r = R();
      if (Rm.wild[ix(x, y)] || Rm.plants.some((p) => p.x === x && p.y === y) || Rm.decor.some((o) => o.x === x && o.y === y)) continue;
      const k = g === W.FLOWERS ? (r < 0.09 ? 'glowshroom' : r < 0.12 ? 'moonflower' : r < 0.135 ? 'crystaltree' : null) : g === W.GRASS ? (r < 0.02 ? 'glowshroom' : r < 0.028 ? 'bigshroom' : r < 0.034 ? 'crystaltree' : r < 0.04 ? 'crystallily' : null) : null;
      if (k) W.natural(Rm, k, x, y);
    }
  }
  return true;
}
