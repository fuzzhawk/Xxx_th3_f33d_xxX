// Turns whatever is on a post (image, canvas, SVG art, meme with captions) into
// a PNG/JPEG and saves it to the phone's gallery through the native plugin.
import { toast } from './util.js';

const native = () => window.Capacitor?.isNativePlatform?.() && window.Capacitor.nativePromise;

async function blobToB64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
async function loadImage(src) {
  const i = new Image();
  i.crossOrigin = 'anonymous';
  i.src = src;
  await i.decode();
  return i;
}
// Fetch an image with CORS so it can be drawn and exported.
async function corsImage(url) {
  if (/^(data:|blob:)/.test(url) || url.startsWith(location.origin) || !/^https?:/.test(url)) return loadImage(url);
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const u = URL.createObjectURL(await r.blob());
  try { return await loadImage(u); } finally { setTimeout(() => URL.revokeObjectURL(u), 5000); }
}
function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
// Meme: image plus impact text or a white caption box above.
async function composeMeme(post, img) {
  const W = Math.min(1080, img.naturalWidth * 2 || 1080), H = Math.round(W * (img.naturalHeight / img.naturalWidth));
  const c = document.createElement('canvas'), x = c.getContext('2d');
  let capH = 0, lines = [];
  const fs = Math.round(W * 0.05);
  if (post.style === 'caption' && post.text) {
    x.font = `500 ${fs}px system-ui, sans-serif`;
    lines = wrapLines(x, post.text, W - fs * 2);
    capH = lines.length * fs * 1.35 + fs * 1.4;
  }
  c.width = W; c.height = H + capH;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, capH);
  x.drawImage(img, 0, capH, W, H);
  if (capH) { x.fillStyle = '#111'; x.font = `500 ${fs}px system-ui, sans-serif`; x.textBaseline = 'top'; lines.forEach((l, i) => x.fillText(l, fs, fs * 0.7 + i * fs * 1.35)); }
  if (post.style === 'impact') {
    const is = Math.round(W * 0.085);
    x.font = `900 ${is}px Impact, "Arial Black", sans-serif`; x.textAlign = 'center'; x.lineJoin = 'round';
    const draw = (t, top) => {
      const ls = wrapLines(x, String(t).toUpperCase(), W - is);
      ls.forEach((l, i) => {
        const y = top ? is * 0.2 + i * is * 1.05 : H - is * 0.25 - (ls.length - 1 - i) * is * 1.05;
        x.textBaseline = top ? 'top' : 'bottom';
        x.lineWidth = is * 0.14; x.strokeStyle = '#000'; x.strokeText(l, W / 2, y); x.fillStyle = '#fff'; x.fillText(l, W / 2, y);
      });
    };
    if (post.top) draw(post.top, true);
    if (post.bottom) draw(post.bottom, false);
  }
  return c;
}
async function svgToCanvas(svgEl, size = 1080) {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const u = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const i = await loadImage(u);
    const c = document.createElement('canvas'); c.width = c.height = size;
    c.getContext('2d').drawImage(i, 0, 0, size, size);
    return c;
  } finally { URL.revokeObjectURL(u); }
}

export async function saveFromPost(card) {
  const post = card._post;
  const media = card.querySelector('.media');
  try {
    let canvas = null;
    const live = media?.querySelector('canvas');
    const svg = media?.querySelector('svg.art');
    const img = media?.querySelector('img');
    if (live) { canvas = document.createElement('canvas'); canvas.width = live.width; canvas.height = live.height; canvas.getContext('2d').drawImage(live, 0, 0); }
    else if (svg) canvas = await svgToCanvas(svg);
    else if (img) {
      const loaded = await corsImage(post?.img || post?.thumb || img.currentSrc || img.src);
      if (post?.cat === 'meme' && post.sub !== 'kym') canvas = await composeMeme(post, loaded);
      else { canvas = document.createElement('canvas'); canvas.width = loaded.naturalWidth; canvas.height = loaded.naturalHeight; canvas.getContext('2d').drawImage(loaded, 0, 0); }
    }
    if (!canvas) { toast('Nothing to save on this post'); return; }
    const jpeg = post?.cat === 'meme' || post?.cat === 'web';
    const blob = await new Promise((r) => canvas.toBlob(r, jpeg ? 'image/jpeg' : 'image/png', 0.92));
    const name = `thefeed-${(post?.title || post?.name || post?.cat || 'image').toString().replace(/[^\w]+/g, '-').slice(0, 40)}-${Date.now() % 100000}.${jpeg ? 'jpg' : 'png'}`;
    if (native()) {
      await window.Capacitor.nativePromise('FeedNative', 'saveImage', { data: await blobToB64(blob), name, mime: jpeg ? 'image/jpeg' : 'image/png' });
      toast('Saved to Pictures/The Feed');
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Downloaded');
    }
  } catch (e) {
    console.warn('save failed', e);
    const url = post?.img || post?.thumb;
    if (native() && url && /^https?:/.test(url)) {
      try { await window.Capacitor.nativePromise('FeedNative', 'saveUrl', { url, name: `thefeed-${Date.now() % 1000000}` }); toast('Saved to Pictures/The Feed'); return; }
      catch (e2) { toast(`Could not save: ${e2.message || e2}`); return; }
    }
    toast(/tainted|cors|Failed to fetch|HTTP/i.test(String(e)) ? 'That site does not allow saving this image' : `Could not save: ${e.message || e}`);
  }
}
