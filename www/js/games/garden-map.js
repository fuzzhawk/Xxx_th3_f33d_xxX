// The garden's menu and its map, added to the Garden game (install).
// A small round button rests in the card's top-right corner while you stand still and fades the
// moment you walk. It opens a little menu (one entry for now: the map; add more to MENU), and the
// map fills the card: the realm you are in at one pixel per tile, explored ground clear and the
// rest under soft cloud, with the names of the countries, villages, the city, the ways up and down
// and the places you have found, and a pulsing mark where you stand. Pinch to zoom (or double-tap),
// drag to look around, ‹ › for the other realms you have been to, the target to come back to you.
// It is the one place in the garden with words on it.
import { W, H, roundRect } from './engine.js';
import * as Wd from './garden-world.js';
import { hash2 } from './garden-kit.js';

const { T, ALT, ix } = Wd;

// the menu: one entry per row, in order (id, label, icon)
const MENU = [{ id: 'map', label: 'Map', icon: 'map' }];
const BX = W - 22, BY = 22, BR = 13, BHIT = 26;               // the round button (and the map's close button)
const MW = 148, MI = 40, MX1 = W - 10, MY0 = BY + BR + 8;      // the menu: width, row height, right edge, top
const RX = W - 24, RY = H - 24, RR = 14;                       // the map's come-back-to-me button
const TOP = 46;                                                // the map's title bar

const NAME = { surface: 'The Meadows', cave: 'The Caverns', deep: 'The Deep', canyon: 'The Canyons', gorge: 'The Violet Gorge', abyss: 'The Abyss', mountain: 'The Mountains', canopy: 'The Treetops', sky: 'The Sky Islands', high: 'The High Sky', stars: 'The Star Sea', under: 'The Undercity', roofs: 'The Rooftops' };
const SHORT = { surface: 'Meadows', cave: 'Caverns', deep: 'The Deep', canyon: 'Canyons', gorge: 'Violet Gorge', abyss: 'Abyss', mountain: 'Mountains', canopy: 'Treetops', sky: 'Sky Islands', high: 'High Sky', stars: 'Star Sea', under: 'Undercity', roofs: 'Rooftops' };
// highest first, as ‹ › walks through them
const ORDER = ['stars', 'high', 'sky', 'mountain', 'canopy', 'roofs', 'surface', 'cave', 'canyon', 'under', 'deep', 'gorge', 'abyss'];
const BG = { surface: '#15121e', cave: '#07060b', sky: '#0e1428' };
// where a way up or down leads, by colour
const LIFT = { mountain: '#9fd8ff', sky: '#ffffff', canyon: '#ff9a5a', canopy: '#7ad06a', cave: '#ffd98a', deep: '#c8a8ff', gorge: '#b080ff', abyss: '#ff6a2a', high: '#ffc8f0', stars: '#fff6c8', under: '#5af0ff', roofs: '#ff5ad8', surface: '#bfe8b0' };
const PLACE = { chest: ['Hidden Glade', '#ffd23f'], ring: ['Fairy Ring', '#8ff0d8'], pond: ['Moon Pond', '#9fd8ff'], ribbon: ['Ribbon Tree', '#ff9ac0'], shrine: ['Forest Shrine', '#ff7a5a'], crystal: ['Crystal Grove', '#c8a8ff'] };
// names for the kinds of country (garden-world's B_* order) and for villages, picked from the spot
const COUNTRY = [
  [['Sunny', 'Wide', 'Honey', 'Clover', 'Gentle', 'Lark'], 'Meadow'], [['Whispering', 'Mossy', 'Old', 'Deep', 'Quiet', 'Fern'], 'Woods'],
  [['Flower', 'Rolling', 'Bright', 'Poppy', 'Butterfly', 'Petal'], 'Downs'], [['Misty', 'Reed', 'Frog', 'Willow', 'Heron', 'Lily'], 'Marsh'],
  [['Heather', 'Windy', 'Purple', 'Bramble', 'Gorse', 'Lonely'], 'Heath'], [['Amber', 'Russet', 'Maple', 'Ember', 'Golden', 'Harvest'], 'Wood'],
  [['Singing', 'Golden', 'Shifting', 'Sun', 'Whisper', 'Dust'], 'Dunes'], [['Elder', 'Ancient', 'Sleeping', 'Moon', 'Spirit', 'First'], 'Grove'],
  [['Frost', 'Snow', 'Silver', 'Winter', 'Crystal', 'White'], 'Fields'], [['Glow', 'Spore', 'Puffball', 'Moon', 'Lantern', 'Velvet'], 'Glade']
];
const VPRE = { cottage: ['Clover', 'Honey', 'Bramble', 'Fern', 'Thistle', 'Primrose'], timber: ['Oak', 'Ash', 'Hazel', 'Rowan', 'Alder', 'Birch'], stone: ['Flint', 'Grey', 'Crag', 'Slate', 'High', 'Cairn'], igloo: ['Frost', 'Snow', 'Rime', 'White', 'Ice', 'Winter'], adobe: ['Sun', 'Red', 'Dust', 'Amber', 'Clay', 'Ochre'], shroom: ['Spore', 'Puff', 'Glow', 'Cap', 'Moon', 'Mallow'], stilt: ['Reed', 'Heron', 'Mire', 'Rush', 'Fen', 'Lily'], treehouse: ['Leaf', 'Bough', 'Moss', 'Acorn', 'Elder', 'Owl'], cloud: ['Cloud', 'Nimbus', 'Feather', 'Breeze', 'Halo', 'Drift'] };
const VSUF = ['wick', 'by', 'ford', 'dale', 'mere', 'stead', 'combe', 'field', ' Hollow', ' Haven'];
const pick = (L, x, y, s) => L[Math.floor(hash2(x, y, s) * L.length) % L.length];
const villageName = (v) => pick(VPRE[v.style] || VPRE.cottage, v.x, v.y, 11) + pick(VSUF, v.x, v.y, 23);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const seenNear = (Rm, x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < Rm.w && Y < Rm.h && Rm.seen[Y * Rm.w + X]) return true; } return false; };
const inBox = (b, x, y) => b && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

// the countries of the meadows: each sizeable patch of one kind, with a name and its middle
const countryCache = new WeakMap();
function countries(Rm) {
  if (Rm.name !== 'surface') return [];
  let L = countryCache.get(Rm);
  if (L) return L;
  const bio = Wd.biomeMap(Rm), S = 24, C = Math.ceil(Rm.w / S), done = new Uint8Array(C * C), M = Rm.w >> 1;
  const at = (cx, cy) => bio[Math.min(Rm.h - 1, cy * S + 12) * Rm.w + Math.min(Rm.w - 1, cx * S + 12)];
  L = [];
  for (let cy = 0; cy < C; cy++) for (let cx = 0; cx < C; cx++) {
    if (done[cy * C + cx]) continue;
    const b = at(cx, cy), q = [[cx, cy]];
    done[cy * C + cx] = 1;
    let sx = 0, sy = 0;
    for (let k = 0; k < q.length; k++) {
      const [x, y] = q[k]; sx += x; sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= C || done[ny * C + nx] || at(nx, ny) !== b) continue; done[ny * C + nx] = 1; q.push([nx, ny]); }
    }
    if (q.length < 4) continue;
    const x = Math.round((sx / q.length) * S + 12), y = Math.round((sy / q.length) * S + 12), home = q.some(([a, c]) => Math.abs(a * S + 12 - M) < S && Math.abs(c * S + 12 - M) < S);
    L.push({ x, y, cells: q, label: home && b === 0 ? 'Home Meadow' : `${pick(COUNTRY[b][0], x, y, 5)} ${COUNTRY[b][1]}` });
  }
  countryCache.set(Rm, L);
  return L;
}

// little glyphs, in card pixels
const INK = 'rgba(14,10,22,.92)';
function house(c, x, y, s, fill) { c.beginPath(); c.moveTo(x - s, y + s * 0.8); c.lineTo(x - s, y - s * 0.1); c.lineTo(x, y - s); c.lineTo(x + s, y - s * 0.1); c.lineTo(x + s, y + s * 0.8); c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 1.4; c.strokeStyle = INK; c.stroke(); c.fillStyle = INK; c.fillRect(x - s * 0.22, y + s * 0.2, s * 0.44, s * 0.6); }
function tri(c, x, y, s, up, fill) { c.beginPath(); if (up) { c.moveTo(x, y - s); c.lineTo(x + s, y + s * 0.75); c.lineTo(x - s, y + s * 0.75); } else { c.moveTo(x, y + s); c.lineTo(x + s, y - s * 0.75); c.lineTo(x - s, y - s * 0.75); } c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 1.4; c.strokeStyle = INK; c.stroke(); }
function sparkle(c, x, y, s, fill) { c.beginPath(); for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 4, r = k % 2 ? s * 0.38 : s; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke(); }
function diamond(c, x, y, s, fill) { c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.8, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.8, y); c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke(); }
function mapIcon(c, x, y, col) {
  // a folded paper map: three panels, zigzag
  c.beginPath(); c.moveTo(x - 9, y - 6); c.lineTo(x - 3, y - 8); c.lineTo(x + 3, y - 6); c.lineTo(x + 9, y - 8); c.lineTo(x + 9, y + 6); c.lineTo(x + 3, y + 8); c.lineTo(x - 3, y + 6); c.lineTo(x - 9, y + 8); c.closePath();
  c.strokeStyle = col; c.lineWidth = 1.5; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x - 3, y - 8); c.lineTo(x - 3, y + 6); c.moveTo(x + 3, y - 6); c.lineTo(x + 3, y + 8); c.stroke();
  c.fillStyle = '#ff7a9a'; c.beginPath(); c.arc(x + 6, y - 1, 1.8, 0, 7); c.fill();
}
function roundBtn(c, x, y, r) {
  c.fillStyle = 'rgba(18,14,32,.58)'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.42)'; c.lineWidth = 1.2; c.stroke();
}
function cross(c, x, y, s) { c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y + s); c.moveTo(x + s, y - s); c.lineTo(x - s, y + s); c.stroke(); }

const widths = new Map();
function textW(c, font, s) { const k = font + s; let w = widths.get(k); if (w === undefined) { c.font = font; w = c.measureText(s).width; widths.set(k, w); } return w; }
function label(c, font, s, x, y, fill, a = 1) {
  c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.globalAlpha *= a; c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = 'rgba(14,10,22,.78)'; c.strokeText(s, x, y); c.fillStyle = fill; c.fillText(s, x, y); c.globalAlpha /= a;
}
const F_MAIN = '600 10.5px system-ui, sans-serif', F_MINOR = '500 9.5px system-ui, sans-serif', F_LAND = 'italic 600 11px Georgia, "Times New Roman", serif', F_TITLE = '700 15px system-ui, sans-serif', F_MENU = '600 14px system-ui, sans-serif';

export function install(Garden) {
  Object.assign(Garden.prototype, {
    uiState() { return (this.ui ||= { btnA: 0, still: 0, menu: null, map: null, press: null }); },
    // the card keeps you in control (no autopilot) while the menu or map is open
    holdPlay() { const U = this.ui; return !!(U && (U.menu || U.map)); },
    onModeChange(auto) { if (auto) this.closeUI(); },
    closeUI() { const U = this.ui; if (!U) return; U.menu = null; U.press = null; if (U.map) { U.map = null; this.lastDraw = 0; } },

    // ------------------------------------------------ every step
    stepUI(dt) {
      const U = this.uiState(), h = this.hero;
      const moving = !!this.stick || h.path.length > 0 || Math.hypot(h.vx || 0, h.vy || 0) > 1 || !!this.fade;
      U.still = moving ? 0 : U.still + dt;
      // shown only while you are in control and standing still (or while its menu is open)
      const to = !this.auto && !U.map && (U.menu || U.still > 0.35) ? 1 : 0;
      U.btnA += (to - U.btnA) * Math.min(1, dt * (to > U.btnA ? 7 : 16));
      if (U.menu) U.menu.t = Math.min(1, U.menu.t + dt * 9);
      const V = U.map;
      if (!V) return;
      V.t += dt;
      V.a = V.closing ? Math.max(0, V.a - dt * 7) : Math.min(1, V.a + dt * 7);
      if (V.closing && V.a <= 0) { U.map = null; this.lastDraw = 0; return; }
      if (V.zoomTo) { const Zt = V.zoomTo; this.zoomAt(V.z + (Zt.z - V.z) * Math.min(1, dt * 12), Zt.sx, Zt.sy); if (Math.abs(V.z - Zt.z) < Zt.z * 0.004) V.zoomTo = null; }
    },

    // ------------------------------------------------ input: true when the menu or map took it
    uiDown(x, y, id) {
      const U = this.uiState();
      if (U.map) { if (!U.map.closing) this.mapDown(x, y, id ?? 0); return true; }
      if (U.menu) { U.press = { item: this.menuHit(x, y) }; return true; }
      if (U.btnA > 0.5 && Math.hypot(x - BX, y - BY) < BHIT) { U.press = { btn: true }; return true; }
      return false;
    },
    uiMove(x, y, id) {
      const U = this.ui;
      if (!U) return false;
      if (U.map) { if (!U.map.closing) this.mapMove(x, y, id ?? 0); return true; }
      return !!U.press;
    },
    uiUp(x, y, id) {
      const U = this.ui;
      if (!U) return false;
      if (U.map) { if (!U.map.closing) this.mapUp(x, y, id ?? 0); return true; }
      const p = U.press;
      U.press = null;
      if (!p) return false;
      if (p.btn) { if (Math.hypot(x - BX, y - BY) < BHIT) U.menu = U.menu ? null : { t: 0 }; return true; }
      // a press while the menu was open: on an entry, that entry; anywhere else, the menu closes
      const it = this.menuHit(x, y);
      if (it && it === p.item) this.menuDo(it); else U.menu = null;
      return true;
    },
    // a tap that arrives on its own (the card's first tap): the button, if it is showing
    uiTap(x, y) {
      const U = this.uiState();
      if (U.map || U.menu) { this.uiDown(x, y, 0); this.uiUp(x, y, 0); return true; }
      if (U.btnA > 0.5 && Math.hypot(x - BX, y - BY) < BHIT) { U.menu = { t: 0 }; return true; }
      return false;
    },
    menuHit(x, y) {
      if (x < MX1 - MW || x > MX1 || y < MY0 + 4 || y > MY0 + 4 + MENU.length * MI) return null;
      return MENU[Math.min(MENU.length - 1, Math.floor((y - MY0 - 4) / MI))];
    },
    menuDo(m) {
      this.ui.menu = null;
      if (m.id === 'map') this.openMap();
    },

    // ------------------------------------------------ the map
    openMap() {
      const U = this.uiState(), h = this.hero;
      U.menu = null; U.press = null;
      this.stick = null; this.press = null; h.path = []; h.task = null;
      U.map = { t: 0, a: 0, pts: new Map(), g: null, last: null, closing: false, hits: {} };
      this.mapRealm(Wd.G.realm);
    },
    closeMap() { const V = this.ui?.map; if (V) { V.closing = true; V.pts.clear(); V.g = null; } },
    // look at a realm: the one you are in centres on you, another on where you last stood there
    mapRealm(name) {
      const V = this.ui.map, Rm = Wd.G.R[name], here = name === Wd.G.realm;
      V.realm = name; V.Rm = Rm;
      V.M = Wd.minimap(Rm, this.mode);
      V.feats = this.mapFeatures(Rm);
      V.lands = countries(Rm).map((L) => ({ ...L, seen: L.cells.some(([cx, cy]) => seenNear(Rm, cx * 24 + 12, cy * 24 + 12, 6)) }));
      V.zMin = Math.min((W / Rm.w) * 0.94, (H - TOP - 10) / Rm.h);
      V.zMax = 16;
      V.z = Math.max(V.zMin, Math.min(V.zMax, 3));
      const at = here ? this.hero : Rm.hero || { x: (Rm.w / 2) * T, y: (Rm.h / 2) * T };
      V.cx = at.x / T; V.cy = (at.y - 4) / T; V.zoomTo = null;
      this.clampMap();
    },
    cycleRealm(d) {
      const V = this.ui.map, G = Wd.G, L = ORDER.filter((n) => G.R[n] && (G.R[n].visited || n === G.realm));
      if (L.length < 2) return;
      this.mapRealm(L[(L.indexOf(V.realm) + d + L.length) % L.length]);
    },
    // keep the map on the card: it may slide a little past its edges (the title bar covers the top)
    clampMap() {
      const V = this.ui.map, Rm = V.Rm, z = V.z, hw = W / 2 / z, hh = H / 2 / z;
      const fit = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
      V.cx = fit(V.cx, hw, Rm.w - hw);
      V.cy = fit(V.cy, hh - TOP / z, Rm.h - hh);
    },
    // zoom, keeping the point under (sx, sy) where it is
    zoomAt(z, sx, sy) {
      const V = this.ui.map, wx = V.cx + (sx - W / 2) / V.z, wy = V.cy + (sy - H / 2) / V.z;
      V.z = Math.max(V.zMin, Math.min(V.zMax, z));
      V.cx = wx - (sx - W / 2) / V.z; V.cy = wy - (sy - H / 2) / V.z;
      this.clampMap();
    },
    // one finger drags the map, two pinch it; a quick touch is a tap
    mapDown(x, y, id) {
      const V = this.ui.map;
      if (V.pts.size >= 2) return;
      V.pts.set(id, { x, y });
      V.zoomTo = null;
      if (V.pts.size === 1) V.g = { pan: 1, x0: x, y0: y, cx: V.cx, cy: V.cy, t: performance.now(), moved: 0, tap: true };
      else { const [a, b] = [...V.pts.values()]; V.g = { pinch: 1, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: V.z, wx: V.cx + ((a.x + b.x) / 2 - W / 2) / V.z, wy: V.cy + ((a.y + b.y) / 2 - H / 2) / V.z }; }
    },
    mapMove(x, y, id) {
      const V = this.ui.map, g = V.g;
      if (!V.pts.has(id) || !g) return;
      V.pts.set(id, { x, y });
      if (g.pinch && V.pts.size === 2) {
        const [a, b] = [...V.pts.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        V.z = Math.max(V.zMin, Math.min(V.zMax, (g.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0));
        V.cx = g.wx - (mx - W / 2) / V.z; V.cy = g.wy - (my - H / 2) / V.z;
      } else if (g.pan) {
        g.moved = Math.max(g.moved, Math.hypot(x - g.x0, y - g.y0));
        V.cx = g.cx - (x - g.x0) / V.z; V.cy = g.cy - (y - g.y0) / V.z;
      }
      this.clampMap();
    },
    mapUp(x, y, id) {
      const V = this.ui.map, g = V.g;
      if (!V.pts.has(id)) return;
      V.pts.delete(id);
      // lifting one finger of a pinch: the other carries on dragging from where it is
      if (V.pts.size === 1) { const p = [...V.pts.values()][0]; V.g = { pan: 1, x0: p.x, y0: p.y, cx: V.cx, cy: V.cy, t: 0, moved: 99, tap: false }; return; }
      V.g = null;
      if (g?.tap && g.moved < 9 && performance.now() - g.t < 450) this.mapTap(x, y);
    },
    mapTap(x, y) {
      const V = this.ui.map;
      if (Math.hypot(x - BX, y - BY) < BHIT) { this.closeMap(); return; }
      if (inBox(V.hits.prev, x, y)) { this.cycleRealm(-1); return; }
      if (inBox(V.hits.next, x, y)) { this.cycleRealm(1); return; }
      if (Math.hypot(x - RX, y - RY) < RR + 10) { if (V.realm !== Wd.G.realm) this.mapRealm(Wd.G.realm); else { const h = this.hero; V.zoomTo = null; V.z = Math.max(V.z, Math.min(V.zMax, 3)); V.cx = h.x / T; V.cy = (h.y - 4) / T; this.clampMap(); } return; }
      // double tap: in closer there (all the way in, it goes back out to the whole realm)
      const t = performance.now(), L = V.last;
      if (L && t - L.t < 340 && Math.hypot(x - L.x, y - L.y) < 30) { V.last = null; V.zoomTo = { z: V.z >= V.zMax * 0.9 ? V.zMin : Math.min(V.zMax, V.z * 2.2), sx: x, sy: y }; return; }
      V.last = { t, x, y };
    },
    // what the map names: only what you have come near (the countries are always there, faintly)
    mapFeatures(Rm) {
      const F = [], sn = (x, y, r = 2) => seenNear(Rm, x, y, r), C = Rm.city;
      if (C) {
        let f = false;
        for (let y = C.y0; y <= C.y1 && !f; y += 4) for (let x = C.x0; x <= C.x1 && !f; x += 4) f = !!Rm.seen[ix(Rm, x, y)];
        if (f) F.push({ k: 'city', x: C.cx, y: C.y0 - 2, C, label: 'Neon City', pri: 0 });
      }
      for (const v of Rm.villages || []) if (sn(v.x, v.y, 7)) F.push({ k: 'village', x: v.x, y: v.y, label: villageName(v), fill: v.style === 'cloud' ? '#ffffff' : '#ffe0a0', pri: 1 });
      for (const d of Rm.decor) if (d.t === 'lift' && sn(d.x, d.y)) F.push({ k: 'way', x: d.x, y: d.y, up: !!d.up, fill: LIFT[d.to] || '#ffffff', label: SHORT[d.to] || '', pri: 2 });
      const stair = Rm.ruins.some((r) => r.t === 'cloudstair' && r.found);
      for (const p of Rm.portals) {
        if (p.kind === 'lift' || (p.ruin && !stair) || !sn(p.x, p.y)) continue;
        const up = p.kind === 'stair' || p.kind === 'up' || (p.kind !== 'mouth' && p.kind !== 'down' && (ALT[p.to] ?? 0) > (ALT[Rm.name] ?? 0));
        F.push({ k: 'way', x: p.x, y: p.y, up, fill: LIFT[p.to] || '#ffffff', label: p.kind === 'stair' ? 'Cloud Stair' : p.kind === 'mouth' ? 'Cave' : SHORT[p.to] || '', pri: 2 });
      }
      for (const r of Rm.ruins) if (r.found && r.t !== 'cloudstair') F.push({ k: 'ruin', x: r.x + (r.w >> 1), y: r.y + (r.h >> 1), label: cap(r.name), pri: 3 });
      for (const p of Rm.places || []) if (sn(p.x, p.y, 3)) F.push({ k: 'place', x: p.x, y: p.y, fill: (PLACE[p.k] || PLACE.chest)[1], label: (PLACE[p.k] || PLACE.chest)[0], pri: 4 });
      return F.sort((a, b) => a.pri - b.pri);
    },

    // ------------------------------------------------ drawing (card pixels; the card's transform is set)
    drawMenuUI(c) {
      const U = this.ui;
      if (!U) return;
      if (U.map) { this.drawMap(c); return; }
      if (U.btnA > 0.01) {
        c.save(); c.globalAlpha = U.btnA;
        roundBtn(c, BX, BY, BR);
        c.strokeStyle = '#f6f0e2'; c.lineWidth = 1.6; c.lineCap = 'round';
        if (U.menu) cross(c, BX, BY, 4);
        else { c.beginPath(); for (const dy of [-4, 0, 4]) { c.moveTo(BX - 5, BY + dy); c.lineTo(BX + 5, BY + dy); } c.stroke(); }
        c.restore();
      }
      if (U.menu) {
        const e = 1 - (1 - U.menu.t) ** 3, x0 = MX1 - MW, y0 = MY0 - (1 - e) * 6, hh = MENU.length * MI + 8;
        c.save(); c.globalAlpha = e;
        roundRect(c, x0, y0, MW, hh, 10); c.fillStyle = 'rgba(20,16,36,.9)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; c.stroke();
        MENU.forEach((m, n) => {
          const iy = y0 + 4 + n * MI;
          if (U.press?.item === m) { roundRect(c, x0 + 4, iy, MW - 8, MI, 7); c.fillStyle = 'rgba(255,255,255,.09)'; c.fill(); }
          if (n) { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x0 + 12, iy, MW - 24, 1); }
          if (m.icon === 'map') mapIcon(c, x0 + 24, iy + MI / 2, '#f6f0e2');
          c.font = F_MENU; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#f6f0e2'; c.fillText(m.label, x0 + 44, iy + MI / 2 + 0.5);
        });
        c.restore();
      }
    },
    drawMap(c) {
      const V = this.ui.map, Rm = V.Rm, M = V.M, z = V.z, x0 = V.cx - W / 2 / z, y0 = V.cy - H / 2 / z, h = this.hero, here = V.realm === Wd.G.realm;
      if (M.dirty) { M.c.putImageData(M.im, 0, 0); M.dirty = false; }
      c.save();
      c.globalAlpha = V.a;
      c.fillStyle = BG[Rm.kind] || BG.surface; c.fillRect(0, 0, W, H);
      // the realm, only the part on the card; smoothed when shrunk, crisp tiles when enlarged
      const sx = Math.max(0, Math.floor(x0)), sy = Math.max(0, Math.floor(y0)), ex = Math.min(Rm.w, Math.ceil(x0 + W / z)), ey = Math.min(Rm.h, Math.ceil(y0 + H / z));
      c.imageSmoothingEnabled = z * (this.scale || 1) < 1;
      if (ex > sx && ey > sy) c.drawImage(M.cv, sx, sy, ex - sx, ey - sy, (sx - x0) * z, (sy - y0) * z, (ex - sx) * z, (ey - sy) * z);
      c.imageSmoothingEnabled = false;
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; c.strokeRect(-x0 * z, -y0 * z, Rm.w * z, Rm.h * z);
      const P = (x, y) => [(x + 0.5 - x0) * z, (y + 0.5 - y0) * z], on = (X, Y, m = 40) => X > -m && X < W + m && Y > -m && Y < H + m;
      // labels never overlap: each takes its room in turn (you, the city, villages, ways, ruins, places, countries)
      const boxes = [[0, 0, W, TOP - 8], [RX - RR - 4, RY - RR - 4, W, H]], take = (b) => { for (const o of boxes) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return false; boxes.push(b); return true; };
      let hx = 0, hy = 0, hOn = false;
      if (here) { hx = (h.x / T - x0) * z; hy = ((h.y - 4) / T - y0) * z; hOn = hx > 8 && hx < W - 8 && hy > TOP - 4 && hy < H - 8; if (hOn) boxes.push([hx - 11, hy - 11, hx + 11, hy + 11]); }
      const gs = Math.max(4, Math.min(8, 3 + z * 0.9)), ms = Math.max(2.6, Math.min(6, 2 + z * 0.7)), minor = z >= 1.2;
      const shown = [];
      for (const f of V.feats) {
        if (f.k === 'city') {
          const [ax, ay] = P(f.C.x0 - 0.5, f.C.y0 - 0.5), [bx, by] = P(f.C.x1 + 0.5, f.C.y1 + 0.5);
          if (bx < -4 || ax > W + 4 || by < -4 || ay > H + 4) continue;
          const cw = textW(c, F_MAIN, f.label) / 2 + 4;
          f.sx = Math.max(cw, Math.min(W - cw, (ax + bx) / 2)); f.sy = Math.max(TOP + 4, Math.min(H - 10, ay - 9)); f.box = [ax, ay, bx, by];
          const w = textW(c, F_MAIN, f.label) + 8; f.show = take([f.sx - w / 2, f.sy - 7, f.sx + w / 2, f.sy + 7]);
          shown.push(f); continue;
        }
        const [X, Y] = P(f.x, f.y);
        if (!on(X, Y)) continue;
        f.sx = X; f.sy = Y;
        const font = f.pri >= 3 ? F_MINOR : F_MAIN, s = f.pri >= 3 ? ms : gs, w = textW(c, font, f.label) + 6;
        f.ly = Y + s + 8; f.lx = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, X));
        f.show = !!f.label && (f.pri < 3 || minor) && X > 0 && X < W && f.ly < H - 4 && take([f.lx - w / 2, f.ly - 6, f.lx + w / 2, f.ly + 6]);
        shown.push(f);
      }
      // the countries' names lie under everything, faint where you have not been
      c.letterSpacing = '0.5px';
      for (const L of V.lands) {
        const [X, Y] = P(L.x, L.y);
        if (!on(X, Y, 60)) continue;
        const w = textW(c, F_LAND, L.label) + 10;
        if (X - w / 2 > 0 && X + w / 2 < W && Y < H - 6 && take([X - w / 2, Y - 7, X + w / 2, Y + 7])) label(c, F_LAND, L.label, X, Y, '#fff8e8', L.seen ? 0.82 : 0.42);
      }
      c.letterSpacing = '0px';
      for (const f of shown) {
        if (f.k === 'city') { const [ax, ay, bx, by] = f.box; c.setLineDash([5, 3]); c.lineWidth = 2; c.strokeStyle = '#ff5ad8'; c.strokeRect(ax, ay, bx - ax, by - ay); c.setLineDash([]); c.fillStyle = 'rgba(255,90,216,.08)'; c.fillRect(ax, ay, bx - ax, by - ay); }
        else if (f.k === 'village') house(c, f.sx, f.sy, gs, f.fill);
        else if (f.k === 'way') tri(c, f.sx, f.sy, gs * 0.9, f.up, f.fill);
        else if (f.k === 'ruin') diamond(c, f.sx, f.sy, ms, '#e8e0d0');
        else if (f.k === 'place') sparkle(c, f.sx, f.sy, ms + 1, f.fill);
      }
      for (const f of shown) if (f.show) label(c, f.pri >= 3 ? F_MINOR : F_MAIN, f.label, f.k === 'city' ? f.sx : f.lx, f.k === 'city' ? f.sy : f.ly, f.k === 'city' ? '#ff9aec' : f.pri >= 3 ? '#efe8da' : '#ffffff');
      // you: a pulsing mark that points the way you face; off the card, an arrow at its edge
      if (here) {
        const fl = Math.hypot(h.fx, h.fy) || 1, fa = Math.atan2(h.fy / fl, h.fx / fl);
        if (hOn) {
          const ph = (this.t * 0.7) % 1;
          c.globalAlpha = V.a * (1 - ph) * 0.85; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(hx, hy, 5 + ph * 13, 0, 7); c.stroke(); c.globalAlpha = V.a;
          c.save(); c.translate(hx, hy); c.rotate(fa); c.beginPath(); c.moveTo(12, 0); c.lineTo(6, -4.5); c.lineTo(6, 4.5); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.restore();
          c.beginPath(); c.arc(hx, hy, 4.6, 0, 7); c.fillStyle = '#ff4a6a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.stroke();
        } else {
          const ex2 = Math.max(16, Math.min(W - 16, hx)), ey2 = Math.max(TOP + 10, Math.min(H - 16, hy)), a = Math.atan2(hy - ey2, hx - ex2);
          c.save(); c.translate(ex2, ey2); c.rotate(a); c.beginPath(); c.moveTo(9, 0); c.lineTo(-5, -6.5); c.lineTo(-2, 0); c.lineTo(-5, 6.5); c.closePath(); c.fillStyle = '#ff4a6a'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#ffffff'; c.lineJoin = 'round'; c.stroke(); c.restore();
        }
      }
      // the title bar: the realm's name (with how far up or down it lies), ‹ › to the others, ×
      const g = c.createLinearGradient(0, 0, 0, TOP + 12);
      g.addColorStop(0, 'rgba(12,10,22,.88)'); g.addColorStop(0.7, 'rgba(12,10,22,.5)'); g.addColorStop(1, 'rgba(12,10,22,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, TOP + 12);
      const title = NAME[V.realm] || V.realm, tw = textW(c, F_TITLE, title), alt = ALT[V.realm] ?? 0;
      c.font = F_TITLE; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f6f0e2'; c.fillText(title, W / 2, 20);
      c.fillStyle = 'rgba(246,240,226,.6)';
      for (let k = 0; k < Math.abs(alt); k++) { const X = W / 2 + (k - (Math.abs(alt) - 1) / 2) * 9, Y = 35; c.beginPath(); if (alt > 0) { c.moveTo(X, Y - 2.5); c.lineTo(X + 3, Y + 2); c.lineTo(X - 3, Y + 2); } else { c.moveTo(X, Y + 2.5); c.lineTo(X + 3, Y - 2); c.lineTo(X - 3, Y - 2); } c.closePath(); c.fill(); }
      const many = ORDER.filter((n) => Wd.G.R[n] && (Wd.G.R[n].visited || n === Wd.G.realm)).length > 1;
      V.hits = {};
      if (many) {
        c.strokeStyle = '#f6f0e2'; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
        for (const d of [-1, 1]) { const X = W / 2 + d * (tw / 2 + 18); c.beginPath(); c.moveTo(X - d * 2.5, 14); c.lineTo(X + d * 3.5, 20); c.lineTo(X - d * 2.5, 26); c.stroke(); V.hits[d < 0 ? 'prev' : 'next'] = [X - 18, 2, X + 18, 38]; }
      }
      roundBtn(c, BX, BY, BR); c.strokeStyle = '#f6f0e2'; c.lineWidth = 1.6; c.lineCap = 'round'; cross(c, BX, BY, 4);
      // come back to me: a target
      roundBtn(c, RX, RY, RR);
      c.strokeStyle = '#f6f0e2'; c.lineWidth = 1.5; c.beginPath(); c.arc(RX, RY, 5.5, 0, 7); c.stroke();
      c.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.moveTo(RX + dx * 5.5, RY + dy * 5.5); c.lineTo(RX + dx * 9, RY + dy * 9); } c.stroke();
      c.fillStyle = '#ff4a6a'; c.beginPath(); c.arc(RX, RY, 2.2, 0, 7); c.fill();
      c.restore();
    }
  });
}
