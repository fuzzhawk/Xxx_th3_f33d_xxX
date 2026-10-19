// Game graphics. Each game has a theme (from the package's themes.json):
//   commons – a kit of transparent PNGs + a background photo from Wikimedia Commons
//   kenney  – one of the Kenney packs bundled in www/assets/kenney
//   proc    – generated pixel creatures, items and textures
// A Skin turns the theme into slots (hero, enemy, item, tile, bg) that the games
// ask for by role. Online images are cached so they keep working offline.
import { mulberry32 } from '../util.js';
import { monster, humanoid, item as procItem, texture, themePalette, SCHEMES } from './creature.js';

const cache = new Map();
let kenney = null;
let props = [];
const themes = new Map();
const CACHE = 'feed-img-v1';

export async function loadKenney() {
  try { const r = await fetch('assets/kenney/index.json'); if (r.ok) kenney = await r.json(); } catch { kenney = null; }
}
export function setProps(list) { props = (list || []).map((p) => p.src).filter(Boolean); }
let textures = [];
// Weathered texture photos (rust, bark, concrete…) shipped in the package as small data URIs.
export function setTextures(list) { textures = (list || []).map((t) => img(t.src)); }
export const getTextures = () => textures;
export function setThemes(list) { themes.clear(); for (const t of list || []) themes.set(t.id, t); }
export const hasAssets = () => !!kenney || props.length > 0;

export function img(src) {
  if (!src) return null;
  if (typeof src !== 'string') return src; // already a canvas
  let i = cache.get(src);
  if (i) return i;
  i = new Image();
  i.decoding = 'async';
  cache.set(src, i);
  if (/^https?:/.test(src) && 'caches' in window) {
    caches.open(CACHE).then((c) => c.match(src)).then(async (hit) => {
      if (hit) { i.src = URL.createObjectURL(await hit.blob()); return; }
      i.src = src;
      fetch(src, { mode: 'cors' }).then((r) => r.ok && caches.open(CACHE).then((c) => c.put(src, r))).catch(() => {});
    }).catch(() => { i.src = src; });
  } else i.src = src.startsWith('data:') || /^https?:/.test(src) ? src : `assets/kenney/${src}`;
  return i;
}
export const ready = (i) => !!i && (i instanceof HTMLCanvasElement || (i.complete && i.naturalWidth > 0));
const dims = (i) => [i.naturalWidth || i.width, i.naturalHeight || i.height];

const SLOT = {
  hero: 'hero', char: 'hero', player: 'hero', ship: 'hero', car: 'hero',
  enemy: 'enemy', animal: 'enemy', meteor: 'enemy', monster: 'enemy',
  item: 'item', ball: 'item', prop: 'item', deco: 'item', fx: 'item', road: 'item', coin: 'item',
  tile: 'tile', block: 'tile', bg: 'tile'
};
function shuffled(list, R) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export class Skin {
  constructor(post, chaos = false) {
    const seed = post.seed || 1;
    this.rng = mulberry32(seed ^ 0x5bd1e995);
    this.chaos = chaos ? 0.6 : 0;
    this.memo = {};
    const t = post.theme || { proc: true, hue: (seed >>> 3) % 360, seed, name: 'Wildcard' };
    const base = t.id ? themes.get(t.id) : null;
    const v = t.v || 0;
    this.name = t.name || base?.name || 'Wildcard';
    this.hue = ((base?.hue ?? t.hue ?? 0) + v * 37) % 360;
    // scheme: each theme has a favourite, variants and generated themes roam the others
    const sIdx = ((base ? [...(base.id || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0) : seed) + v * 3) % SCHEMES.length;
    this.pal = themePalette(this.hue, base?.kind === 'commons' && v === 0 && this.rng() < 0.4 ? 'earth' : SCHEMES[sIdx]);
    const R = mulberry32((seed ^ (v * 7919)) >>> 0);
    this.slots = { hero: [], enemy: [], item: [], tile: [] };
    this.bg = null;
    this.creatures = [];
    if (base?.kind === 'commons') {
      const s = shuffled(base.sprites.map((x) => x.src), R);
      this.slots.hero = s.slice(0, 2).map(img);
      this.slots.enemy = s.slice(2, 6).map(img);
      this.slots.item = (s.length > 6 ? s.slice(6) : s).map(img);
      if (base.bgs?.length) this.bg = img(base.bgs[v % base.bgs.length]);
      this.slots.tile = [texture(seed, this.hue)];
    } else if (base?.kind === 'kenney' && kenney?.files) {
      const files = Object.entries(kenney.files).filter(([, f]) => f.pack === base.pack);
      const of = (roles, cut = true) => shuffled(files.filter(([, f]) => roles.includes(f.role) && (!cut || f.cut)).map(([n]) => n), R).map(img);
      this.slots.hero = of(['char', 'ship', 'car']);
      this.slots.enemy = of(['enemy', 'meteor', 'animal']);
      this.slots.item = of(['item', 'ball', 'deco', 'fx', 'road']);
      this.slots.tile = of(['tile', 'block', 'road'], false);
      const bgs = of(['bg'], false);
      this.bg = bgs[v % Math.max(1, bgs.length)] || null;
      if (!this.slots.enemy.length) this.slots.enemy = this.slots.hero.slice(1).length ? this.slots.hero.slice(1) : this.slots.item;
      if (!this.slots.hero.length) this.slots.hero = this.slots.enemy.length ? this.slots.enemy : this.slots.item;
      if (!this.slots.item.length) this.slots.item = this.slots.enemy;
    }
    // texture photos (weathered surfaces) for walls, fills and generated skins
    const texPool = textures.filter(Boolean);
    const pickTex = (k) => (texPool.length ? texPool[(seed * 7 + k * 13 + v * 5) % texPool.length] : null);
    if (texPool.length && base?.kind !== 'kenney') this.slots.tile = [pickTex(0), pickTex(1), pickTex(2)];
    // heads for generated creatures: the theme's own cut-outs where possible
    const headPool = base?.kind === 'commons' ? [...this.slots.hero, ...this.slots.enemy, ...this.slots.item]
      : base?.kind === 'kenney' ? [...this.slots.hero, ...this.slots.enemy] : props.slice(0, 40).map(img);
    const head = (k, p) => (headPool.length && R() < p ? headPool[(k * 7 + seed) % headPool.length] : null);
    const ps = t.seed || seed;
    this.creatures = Array.from({ length: 6 }, (_, k) => monster(ps * 31 + k * 977, this.hue + k * 50, 16 + (k % 3) * 4, 0, { tex: pickTex(k + 3), head: head(k, 0.45) }));
    this.people = Array.from({ length: 4 }, (_, k) => humanoid(ps * 17 + k * 131, this.hue + k * 90, { tex: pickTex(k + 9), head: head(k + 6, 0.35) }));
    if (!this.slots.hero.length) { this.slots.hero = [this.people[0].idle, this.creatures[0].frames[0]]; this.procHero = true; }
    if (!this.slots.enemy.length) this.slots.enemy = this.creatures.slice(1, 5).map((m) => m.frames[0]);
    if (!this.slots.item.length) this.slots.item = props.length ? props.slice((seed % 30), (seed % 30) + 6).map(img) : Array.from({ length: 4 }, (_, k) => procItem(ps + k * 13, this.hue + k * 30));
    if (!this.slots.tile.length) this.slots.tile = [texture(ps, this.hue)];
    // generated themes borrow a photo background from a kit, or a texture
    if (!this.bg) {
      const kits = [...themes.values()].filter((x) => x.bgs?.length);
      this.bg = kits.length && R() < 0.5 ? img(kits[seed % kits.length].bgs[v % kits[seed % kits.length].bgs.length]) : pickTex(7);
    }
    this.texFor = pickTex;
  }
  slotFor(roles) {
    for (const r of roles) { const s = this.slots[SLOT[r] || 'item']; if (s?.length) return s; }
    return this.slots.item;
  }
  any(...roles) {
    if (props.length && this.chaos && this.rng() < this.chaos && !roles.every((r) => SLOT[r] === 'tile')) return img(props[Math.floor(this.rng() * props.length)]);
    const s = this.slotFor(roles);
    return s[Math.floor(this.rng() * s.length)] || null;
  }
  pick(key, ...roles) { if (!(key in this.memo)) this.memo[key] = this.any(...roles); return this.memo[key]; }
  list(key, n, ...roles) {
    if (!(key in this.memo)) {
      const s = shuffled(roles.flatMap((r) => this.slots[SLOT[r] || 'item'] || []).filter((x, i, a) => a.indexOf(x) === i), this.rng);
      this.memo[key] = Array.from({ length: n }, (_, k) => s[k % Math.max(1, s.length)] || null);
    }
    return this.memo[key];
  }
  prop() { return this.chaos && props.length ? img(props[Math.floor(this.rng() * props.length)]) : this.any('item', 'enemy'); }
}

// Draw an image or canvas centred at x,y fitting a w×h box (keeps aspect). Returns false if not ready.
export function drawFit(c, i, x, y, w, h, rot = 0, flip = false) {
  if (!ready(i)) return false;
  const [iw, ih] = dims(i);
  const s = Math.min(w / iw, h / ih), dw = iw * s, dh = ih * s;
  const smooth = c.imageSmoothingEnabled;
  if (i.pixel) c.imageSmoothingEnabled = false;
  if (rot || flip) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(i, -dw / 2, -dh / 2, dw, dh); c.restore(); }
  else c.drawImage(i, x - dw / 2, y - dh / 2, dw, dh);
  c.imageSmoothingEnabled = smooth;
  return true;
}
// Fill a rect with an image stretched or tiled.
export function drawRectImg(c, i, x, y, w, h, tile = false) {
  if (!ready(i)) return false;
  const [, ih] = dims(i);
  const smooth = c.imageSmoothingEnabled;
  if (i.pixel) c.imageSmoothingEnabled = false;
  if (tile) {
    const pat = c.createPattern(i, 'repeat');
    c.save(); c.translate(x, y); c.fillStyle = pat;
    const s = Math.max(0.5, Math.min(1.5, h / ih)); c.scale(s, s); c.fillRect(0, 0, w / s, h / s); c.restore();
  } else c.drawImage(i, x, y, w, h);
  c.imageSmoothingEnabled = smooth;
  return true;
}
