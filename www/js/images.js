// Image loading with an on-device cache (Cache Storage) so memes and thumbnails
// work offline once seen or pre-downloaded. Images that refuse CORS are shown
// but can't be cached.
import { settings } from './state.js';

const CACHE = 'feed-img-v1';
const hasCaches = 'caches' in window;

async function fromCache(url) {
  if (!hasCaches) return null;
  try {
    const c = await caches.open(CACHE);
    const r = await c.match(url);
    return r ? URL.createObjectURL(await r.blob()) : null;
  } catch { return null; }
}
export async function store(url) {
  if (!hasCaches) return false;
  try {
    const c = await caches.open(CACHE);
    if (await c.match(url)) return true;
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return false;
    await c.put(url, r);
    return true;
  } catch { return false; }
}

// Sets img.src from cache when possible; calls onFail if the image can't load.
export async function setImg(img, url, onFail) {
  const cached = await fromCache(url);
  img.onerror = () => { img.onerror = null; onFail?.(); };
  if (cached) { img.src = cached; img.onload = () => URL.revokeObjectURL(cached); return; }
  img.onload = () => { if (settings.cacheImages) store(url); };
  img.src = url;
}

export async function precache(urls, onProgress, shouldStop) {
  let ok = 0, i = 0;
  const queue = [...urls];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length && !shouldStop?.()) {
      const u = queue.shift();
      if (await store(u)) ok++;
      onProgress?.(++i, urls.length, ok);
    }
  }));
  return ok;
}
export async function cacheSize() {
  if (!hasCaches) return 0;
  try { return (await (await caches.open(CACHE)).keys()).length; } catch { return 0; }
}
export async function clearCache() { if (hasCaches) await caches.delete(CACHE); }
