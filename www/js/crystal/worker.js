// Bakes Crystal Sprite Engine sheets off the main thread. A job names a character
// (or a seed + era for a random one) and the directions wanted; the reply carries
// the RGBA sheet and its meta.
import './engine.js';

const S = globalThis.FF5Sprites;
self.onmessage = (e) => {
  const { id, seed, era, char, dirs, png } = e.data;
  try {
    const c = char || S.randomCharacter(seed, era || undefined);
    const sh = S.generate(c, { seed, dirs: dirs || undefined });
    // the PNG for the cache is encoded here too, so the page never stalls on toBlob
    const copy = png && typeof OffscreenCanvas === 'function' ? new Uint8ClampedArray(sh.data) : null;
    self.postMessage({ id, w: sh.width, h: sh.height, data: sh.data, meta: sh.meta, char: c, png: !!copy }, [sh.data.buffer]);
    if (copy) {
      const oc = new OffscreenCanvas(sh.width, sh.height);
      oc.getContext('2d').putImageData(new ImageData(copy, sh.width, sh.height), 0, 0);
      oc.convertToBlob({ type: 'image/png' }).then((blob) => self.postMessage({ id, blob }), () => self.postMessage({ id, blob: null }));
    }
  } catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
