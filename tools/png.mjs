// Minimal PNG decoder (non-interlaced, all colour types and bit depths) used to
// check that sprites really have transparent edges before we use them, and to
// read and re-encode the plant sprites for the garden.
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
  // full colour for pixel (x, y) as [r, g, b, a] (8-bit)
  const to8 = (v) => (depth === 16 ? v : depth === 8 ? v : Math.round((v * 255) / ((1 << depth) - 1)));
  const rgba = (x, y) => {
    const a = alpha(x, y);
    if (type === 6) return [sample(y, x * 4), sample(y, x * 4 + 1), sample(y, x * 4 + 2), a];
    if (type === 2) return [sample(y, x * 3), sample(y, x * 3 + 1), sample(y, x * 3 + 2), a];
    if (type === 3) { const i = sample(y, x) * 3; return [palette[i], palette[i + 1], palette[i + 2], a]; }
    const g = to8(sample(y, type === 4 ? x * 2 : x)); return [g, g, g, a];
  };
  return { w, h, type, depth, alpha, rgba };
}

// Minimal PNG encoder: 8-bit RGBA, no filtering (sprites here are tiny).
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(kind, data) {
  const len = Buffer.alloc(4), body = Buffer.concat([Buffer.from(kind, 'latin1'), data]), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
export function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
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
