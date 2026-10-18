// Sprites for the games: Kenney packs bundled with the app (www/assets/kenney)
// plus a weekly batch of random transparent PNGs from Wikimedia Commons that
// ships inside each package (sprites.json). Everything loads lazily; games
// fall back to drawn shapes until an image is ready.

const cache = new Map();
let kenney = null;
let props = [];

export async function loadKenney() {
  try {
    const r = await fetch('assets/kenney/index.json');
    if (r.ok) kenney = await r.json();
  } catch { kenney = null; }
}
export function setProps(list) {
  props = (list || []).map((p) => p.src).filter(Boolean);
}
export const hasAssets = () => !!kenney || props.length > 0;

export function img(src) {
  if (!src) return null;
  let i = cache.get(src);
  if (!i) {
    i = new Image();
    i.decoding = 'async';
    i.src = src.startsWith('data:') ? src : `assets/kenney/${src}`;
    cache.set(src, i);
  }
  return i;
}
export const ready = (i) => !!(i && i.complete && i.naturalWidth);

const pool = (role) => {
  if (role === 'prop') return props;
  return kenney?.roles?.[role] || [];
};

// A per-game selection of sprites, stable for a given seed.
export class Skin {
  constructor(rng, chaos = 0.3) {
    this.rng = rng;
    this.chaos = chaos;
    this.memo = {};
  }
  any(...roles) {
    const avail = roles.filter((r) => pool(r).length);
    // chaos: sometimes swap in a random Commons object instead of a game sprite
    if (props.length && (this.rng() < this.chaos || !avail.length)) return img(props[Math.floor(this.rng() * props.length)]);
    if (!avail.length) return null;
    const list = pool(avail[Math.floor(this.rng() * avail.length)]);
    return img(list[Math.floor(this.rng() * list.length)]);
  }
  // same answer every time for a given key
  pick(key, ...roles) {
    if (!(key in this.memo)) this.memo[key] = this.any(...roles);
    return this.memo[key];
  }
  list(key, n, ...roles) {
    if (!(key in this.memo)) this.memo[key] = Array.from({ length: n }, () => this.any(...roles));
    return this.memo[key];
  }
  prop() { return props.length ? img(props[Math.floor(this.rng() * props.length)]) : this.any('item', 'deco', 'enemy'); }
}

// Draw an image centred at x,y fitting a w×h box (keeps aspect). Returns false if not ready.
export function drawFit(c, i, x, y, w, h, rot = 0, flip = false) {
  if (!ready(i)) return false;
  const s = Math.min(w / i.naturalWidth, h / i.naturalHeight);
  const dw = i.naturalWidth * s, dh = i.naturalHeight * s;
  if (rot || flip) {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1);
    c.drawImage(i, -dw / 2, -dh / 2, dw, dh); c.restore();
  } else c.drawImage(i, x - dw / 2, y - dh / 2, dw, dh);
  return true;
}
// Fill a rect with an image stretched or tiled.
export function drawRectImg(c, i, x, y, w, h, tile = false) {
  if (!ready(i)) return false;
  if (tile) {
    const pat = c.createPattern(i, 'repeat');
    c.save(); c.translate(x, y); c.fillStyle = pat;
    const s = Math.min(1, h / i.naturalHeight); c.scale(s, s); c.fillRect(0, 0, w / s, h / s); c.restore();
  } else c.drawImage(i, x, y, w, h);
  return true;
}
