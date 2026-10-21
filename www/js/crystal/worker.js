// Bakes Crystal Sprite Engine sheets off the main thread. A job names a character
// (or a seed + era for a random one) and the directions wanted; the reply carries
// the RGBA sheet and its meta.
import './engine.js';

const S = globalThis.FF5Sprites;
self.onmessage = (e) => {
  const { id, seed, era, char, dirs } = e.data;
  try {
    const c = char || S.randomCharacter(seed, era || undefined);
    const sh = S.generate(c, { seed, dirs: dirs || undefined });
    self.postMessage({ id, w: sh.width, h: sh.height, data: sh.data, meta: sh.meta, char: c }, [sh.data.buffer]);
  } catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
