// Minimal PNG decoder (non-interlaced, all colour types and bit depths) used to
// check that sprites really have transparent edges before we use them.
import zlib from 'node:zlib';

export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let off = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString('latin1', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    off += 12 + len;
  }
  if (interlace) throw new Error('interlaced png');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const bpp = Math.max(1, (channels * depth) >> 3);
  const stride = Math.ceil((w * channels * depth) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, b = y ? px[dst - stride + x] : 0, c = y && x >= bpp ? px[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = v & 255;
    }
  }
  // alpha value for pixel (x, y)
  const sample = (y, i) => { // i-th sample in row y
    if (depth === 8) return px[y * stride + i];
    if (depth === 16) return px[y * stride + i * 2];
    const bit = i * depth, byte = px[y * stride + (bit >> 3)], shift = 8 - depth - (bit & 7);
    return (byte >> shift) & ((1 << depth) - 1);
  };
  const alpha = (x, y) => {
    if (type === 6) return sample(y, x * 4 + 3);
    if (type === 4) return sample(y, x * 2 + 1);
    if (type === 3) { const idx = sample(y, x); return trns && idx < trns.length ? trns[idx] : 255; }
    if (trns) {
      if (type === 0 && sample(y, x) === trns.readUInt16BE(0) >> (depth === 16 ? 8 : 0)) return 0;
      if (type === 2 && depth === 8 && sample(y, x * 3) === trns[1] && sample(y, x * 3 + 1) === trns[3] && sample(y, x * 3 + 2) === trns[5]) return 0;
    }
    return 255;
  };
  return { w, h, type, depth, alpha };
}

// True when most of the border is see-through and a meaningful share of the
// image is transparent: i.e. a cut-out sprite, not a rectangle.
export function hasTransparentEdges(buf, { edge = 0.35, overall = 0.04 } = {}) {
  let img;
  try { img = decodePNG(buf); } catch { return false; }
  if (![3, 4, 6, 0, 2].includes(img.type)) return false;
  const { w, h, alpha } = img;
  let border = 0, clear = 0;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { border++; if (alpha(x, y) < 24) clear++; }
  for (let y = 1; y < h - 1; y++) for (const x of [0, w - 1]) { border++; if (alpha(x, y) < 24) clear++; }
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].filter(([x, y]) => alpha(x, y) < 24).length;
  if (clear / border < edge && corners < 3) return false;
  let tot = 0, see = 0;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { tot++; if (alpha(x, y) < 24) see++; }
  return see / tot >= overall && see / tot < 0.97;
}
