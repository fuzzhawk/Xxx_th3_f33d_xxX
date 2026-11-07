// Draws memes onto a canvas so what you see is exactly what gets saved.
// Styles: impact, caption, demotivator, post, chyron, twopanel, brain, starter,
// versus, labels, quotecard, pov, isthis, venn, nobody, placard, wanted, align, flow, graph, triptych,
// and four-panel comic strips (authors in conversation on one subject).

const CACHE = 'feed-img-v1';
const W = 720;

// Load an image without tainting the canvas: cache → CORS fetch → plain <img>.
async function loadImg(url) {
  const asImg = (src, cors) => new Promise((res, rej) => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  if (!url) throw new Error('no url');
  if (/^(data:|blob:)/.test(url)) return asImg(url);
  try {
    const c = 'caches' in window ? await caches.open(CACHE) : null;
    let r = c ? await c.match(url) : null;
    if (!r) { r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw new Error('http'); c?.put(url, r.clone()).catch(() => {}); }
    return await asImg(URL.createObjectURL(await r.blob()));
  } catch {
    const i = await asImg(url); i.tainted = true; return i;
  }
}
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
  }
  return lines;
}
function cover(ctx, img, x, y, w, h) {
  if (!img) { const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#6e4a33'); g.addColorStop(1, '#241c17'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore();
}
function impactText(ctx, text, x, y, maxW, size, align = 'top') {
  ctx.font = `900 ${size}px Impact, "Anton", "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const ls = wrap(ctx, String(text).toUpperCase(), maxW);
  ls.forEach((l, i) => {
    const yy = align === 'top' ? y + i * size * 1.05 : y - (ls.length - 1 - i) * size * 1.05;
    ctx.textBaseline = align === 'top' ? 'top' : 'bottom';
    ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#000'; ctx.strokeText(l, x, yy); ctx.fillStyle = '#fff'; ctx.fillText(l, x, yy);
  });
}
function textBlock(ctx, text, x, y, maxW, font, color, lh = 1.3, align = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const size = parseInt(font.match(/(\d+)px/)[1], 10);
  const ls = wrap(ctx, text, maxW);
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh));
  return ls.length * size * lh;
}
const sans = (n, w = 500) => `${w} ${n}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const serif = (n, w = 400) => `${w} ${n}px Georgia, "Times New Roman", serif`;


// centred text that shrinks until it fits a box
function fitText(ctx, text, cx, cy, w, h, max, weight, color, face = 'sans', stroke) {
  const f = (n) => (face === 'serif' ? serif(n, weight) : sans(n, weight));
  let size = max, ls;
  for (; size >= 12; size -= 2) { ctx.font = f(size); ls = wrap(ctx, text, w); if (ls.length * size * 1.18 <= h) break; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ls.forEach((l, i) => {
    const y = cy + (i - (ls.length - 1) / 2) * size * 1.18;
    if (stroke) { ctx.lineWidth = size * 0.2; ctx.strokeStyle = stroke; ctx.strokeText(l, cx, y); }
    ctx.fillStyle = color; ctx.fillText(l, cx, y);
  });
}
function arrow(ctx, x1, y1, x2, y2, col = '#111') {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 16 * Math.cos(a - 0.4), y2 - 16 * Math.sin(a - 0.4)); ctx.lineTo(x2 - 16 * Math.cos(a + 0.4), y2 - 16 * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill();
}
const ROMAN = ['I', 'II', 'III'];

function drawVenn(ctx, p, imgs, set) {
  set(580); ctx.fillStyle = '#f6f1e7'; ctx.fillRect(0, 0, W, 580);
  const r = 215, cy = 290, ax = W / 2 - 110, bx = W / 2 + 110;
  const disc = (x, img, tint) => { ctx.save(); ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.clip(); cover(ctx, img, x - r, cy - r, 2 * r, 2 * r); ctx.fillStyle = tint; ctx.fillRect(x - r, cy - r, 2 * r, 2 * r); ctx.restore(); };
  disc(ax, imgs[0], 'rgba(210,60,70,.42)'); disc(bx, imgs[1] || imgs[0], 'rgba(50,100,200,.42)');
  ctx.save(); ctx.beginPath(); ctx.arc(ax, cy, r, 0, 7); ctx.clip(); ctx.beginPath(); ctx.arc(bx, cy, r, 0, 7); ctx.clip(); ctx.fillStyle = 'rgba(255,225,90,.7)'; ctx.fillRect(0, 0, W, 580); ctx.restore();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5; for (const x of [ax, bx]) { ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.stroke(); }
  fitText(ctx, p.a, ax - 100, cy, 170, 240, 40, 800, '#fff', 'sans', '#000');
  fitText(ctx, p.b, bx + 100, cy, 170, 240, 40, 800, '#fff', 'sans', '#000');
  fitText(ctx, p.mid, W / 2, cy, 150, 220, 34, 800, '#111', 'sans');
}
function drawNobody(ctx, p, im, ratio, set) {
  const lines = p.lines || [], lh = 62, head = 40 + lines.length * lh + 20, ih = W * Math.min(ratio, 1);
  set(head + ih); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, head);
  lines.forEach((l, i) => { const last = i === lines.length - 1; ctx.font = sans(last ? 38 : 36, last ? 800 : 500); ctx.fillStyle = last ? '#111' : '#555'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(l, 30, 40 + i * lh + lh / 2 - 6, W - 60); });
  cover(ctx, im, 0, head, W, ih);
}
function drawPlacard(ctx, p, im, ratio, set) {
  ctx.font = sans(24); const dl = wrap(ctx, p.desc, W - 240).length;
  const fw = W - 200, fh = Math.round(fw * Math.min(1.1, Math.max(0.65, ratio))), plaque = 70 + 34 + 30 + dl * 31 + 56;
  set(60 + fh + 50 + plaque + 40);
  const g = ctx.createRadialGradient(W / 2, 80, 40, W / 2, 200, W); g.addColorStop(0, '#8a7d70'); g.addColorStop(1, '#3a332d'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, canvas_h(ctx));
  const x = 100, y = 60; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x + 12, y + 16, fw, fh);
  ctx.fillStyle = '#b8892e'; ctx.fillRect(x - 26, y - 26, fw + 52, fh + 52); ctx.fillStyle = '#e6c46a'; ctx.fillRect(x - 18, y - 18, fw + 36, fh + 36); ctx.fillStyle = '#7a5a1a'; ctx.fillRect(x - 8, y - 8, fw + 16, fh + 16);
  cover(ctx, im, x, y, fw, fh);
  const px = 100, py = y + fh + 60, pw = fw;
  ctx.fillStyle = '#f2eee6'; ctx.fillRect(px, py, pw, plaque); ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.strokeRect(px + 6, py + 6, pw - 12, plaque - 12);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = serif(34, 700); ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(p.title.length > 30 ? `${p.title.slice(0, 29)}…` : p.title, px + 24, py + 22, pw - 48);
  ctx.font = serif(22, 400); ctx.fillStyle = '#444'; ctx.fillText(`${p.date} · ${p.medium}`, px + 24, py + 66);
  textBlock(ctx, p.desc, px + 24, py + 106, pw - 48, sans(24), '#222', 1.3);
  ctx.font = `italic 20px Georgia, serif`; ctx.fillStyle = '#777'; ctx.fillText(p.gift || '', px + 24, py + plaque - 40);
}
const canvas_h = (ctx) => ctx.canvas.height;
function drawWanted(ctx, p, im, set) {
  set(980); const g = ctx.createLinearGradient(0, 0, W, 980); g.addColorStop(0, '#e3c796'); g.addColorStop(1, '#c49f66'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 980);
  ctx.strokeStyle = '#3b2a14'; ctx.lineWidth = 8; ctx.strokeRect(20, 20, W - 40, 940); ctx.lineWidth = 2; ctx.strokeRect(34, 34, W - 68, 912);
  ctx.fillStyle = '#2a1c0d'; ctx.font = serif(150, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WANTED', W / 2, 130, W - 100);
  const iw = 420, ih = 400, ix = (W - iw) / 2, iy = 215;
  ctx.save(); ctx.filter = 'sepia(1) contrast(1.15) grayscale(.3)'; cover(ctx, im, ix, iy, iw, ih); ctx.restore();
  ctx.strokeStyle = '#2a1c0d'; ctx.lineWidth = 8; ctx.strokeRect(ix, iy, iw, ih);
  fitText(ctx, String(p.name).toUpperCase(), W / 2, 680, W - 120, 90, 60, 900, '#2a1c0d', 'serif');
  fitText(ctx, `FOR ${p.crime}`, W / 2, 780, W - 140, 90, 34, 700, '#3b2a14', 'serif');
  ctx.fillStyle = '#2a1c0d'; ctx.fillRect(60, 840, W - 120, 3);
  fitText(ctx, `REWARD: ${p.reward}`, W / 2, 900, W - 140, 70, 40, 900, '#7a1414', 'serif');
}
function drawAlign(ctx, p, im, set) {
  const lw = 110, top = 150, cs = (W - lw - 20) / 3; set(top + cs * 3 + 20);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, canvas_h(ctx));
  ctx.globalAlpha = 0.28; cover(ctx, im, lw, top, cs * 3, cs * 3); ctx.globalAlpha = 1;
  fitText(ctx, p.text, W / 2, 40, W - 40, 60, 38, 800, '#111');
  const cols = ['#7fbf7f', '#e6d34f', '#e0735a'];
  (p.cols || []).forEach((c, i) => fitText(ctx, c, lw + cs * (i + 0.5), 112, cs - 16, 50, 26, 800, '#111'));
  (p.rows || []).forEach((r, i) => fitText(ctx, r, lw / 2, top + cs * (i + 0.5), lw - 12, 80, 24, 800, '#111'));
  for (let k = 0; k < 9; k++) {
    const x = lw + (k % 3) * cs, y = top + Math.floor(k / 3) * cs;
    ctx.fillStyle = `${cols[k % 3]}33`; ctx.fillRect(x, y, cs, cs); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + 8, y + cs / 2 - 40, cs - 16, 80);
    fitText(ctx, p.cells?.[k] || '', x + cs / 2, y + cs / 2, cs - 30, 70, 26, 700, '#111');
  }
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(lw, top, cs * 3, cs * 3);
  ctx.lineWidth = 2; for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(lw + cs * i, top); ctx.lineTo(lw + cs * i, top + cs * 3); ctx.moveTo(lw, top + cs * i); ctx.lineTo(lw + cs * 3, top + cs * i); ctx.stroke(); }
}
function drawFlow(ctx, p, im, set) {
  set(860); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, 860); ctx.globalAlpha = 0.16; cover(ctx, im, 0, 0, W, 860); ctx.globalAlpha = 1;
  const node = (x, y, w, h, t, fill, shape) => {
    ctx.fillStyle = fill; ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.beginPath();
    if (shape === 'dia') { ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x - w / 2, y); ctx.closePath(); }
    else ctx.roundRect(x - w / 2, y - h / 2, w, h, shape === 'pill' ? h / 2 : 10);
    ctx.fill(); ctx.stroke(); fitText(ctx, t, x, y, shape === 'dia' ? w * 0.6 : w - 36, shape === 'dia' ? h * 0.5 : h - 24, 30, 700, '#111');
  };
  arrow(ctx, W / 2, 190, W / 2, 275); arrow(ctx, W / 2 - 100, 540, W / 4 + 20, 640); arrow(ctx, W / 2 + 100, 540, (3 * W) / 4 - 20, 640);
  node(W / 2, 110, 560, 160, p.start, '#cde8ff', 'pill'); node(W / 2, 420, 440, 250, p.q, '#fff1b8', 'dia');
  node(W / 4, 740, 320, 160, p.yes, '#cdeccd', 'box'); node((3 * W) / 4, 740, 320, 160, p.no, '#f5cccc', 'box');
  ctx.font = sans(26, 800); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('YES', W / 4 + 40, 585); ctx.fillText('NO', (3 * W) / 4 - 40, 585);
}
function drawGraph(ctx, p, im, set) {
  set(680); ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, W, 680);
  fitText(ctx, p.text, W / 2, 62, W - 60, 90, 38, 800, '#111', 'sans');
  const x0 = 110, x1 = W - 40, y0 = 560, y1 = 140, pw = x1 - x0, ph = y0 - y1;
  ctx.save(); ctx.globalAlpha = 0.18; cover(ctx, im, x0, y1, pw, ph); ctx.restore();
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x0, y0 - (ph * i) / 5); ctx.lineTo(x1, y0 - (ph * i) / 5); ctx.moveTo(x0 + (pw * i) / 5, y0); ctx.lineTo(x0 + (pw * i) / 5, y1); ctx.stroke(); }
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y1 - 10); ctx.lineTo(x0, y0); ctx.lineTo(x1 + 10, y0); ctx.stroke();
  const shapes = { spike: (t) => (t < 0.7 ? 0.08 + 0.1 * t : 0.15 + 0.85 * Math.sin(((t - 0.7) / 0.3) * Math.PI / 2)), cliff: (t) => (t < 0.55 ? 0.85 - 0.1 * t : 0.8 - Math.min(1, (t - 0.55) / 0.12) * 0.75), flat: (t) => 0.42 + 0.01 * Math.sin(t * 20), wave: (t) => 0.5 + 0.38 * Math.sin(t * 9) * (1 - t * 0.6), rise: (t) => t * t * 0.9 + 0.05 };
  const fn = shapes[p.shape] || shapes.rise, pt = (t) => [x0 + t * pw, y0 - fn(t) * ph];
  ctx.strokeStyle = '#d6322e'; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const [x, y] = pt(i / 120); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  const tt = p.shape === 'cliff' ? 0.62 : p.shape === 'spike' ? 0.93 : p.shape === 'wave' ? 0.17 : p.shape === 'flat' ? 0.8 : 0.9, [px, py] = pt(tt);
  ctx.fillStyle = '#d6322e'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.fill(); ctx.stroke();
  const ly = py < 330 ? py + 90 : py - 100, lx = Math.max(x0 + 130, Math.min(x1 - 130, px - 30));
  ctx.fillStyle = '#ffe36b'; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.roundRect(lx - 125, ly - 34, 250, 68, 8); ctx.fill(); ctx.stroke();
  fitText(ctx, p.note || '', lx, ly, 226, 56, 24, 700, '#111');
  arrow(ctx, lx, ly + (ly < py ? 34 : -34), px - (px - lx) * 0.1, py + (ly < py ? -14 : 14));
  ctx.fillStyle = '#111'; ctx.font = sans(24, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.xl || '', (x0 + x1) / 2, 615, pw);
  ctx.save(); ctx.translate(40, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(p.yl || '', 0, 0, ph); ctx.restore();
}
function drawTriptych(ctx, p, imgs, set) {
  const pad = 24, gap = 16, cw = 280, sw = (W - pad * 2 - gap * 2 - cw) / 2, ih = 360;
  set(100 + ih + 150); const g = ctx.createLinearGradient(0, 0, W, canvas_h(ctx)); g.addColorStop(0, '#4a3524'); g.addColorStop(1, '#26190f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, canvas_h(ctx));
  fitText(ctx, p.text, W / 2, 50, W - 60, 60, 36, 700, '#f0dcae', 'serif');
  [sw, cw, sw].forEach((w, k) => {
    const x = pad + (k ? sw + gap : 0) + (k === 2 ? cw + gap : 0), y = 100, h = k === 1 ? ih + 30 : ih - 20, yy = k === 1 ? y - 15 : y + 5;
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(x - 8, yy - 8, w + 16, h + 16); cover(ctx, imgs[k] || imgs[0], x, yy, w, h);
    ctx.strokeStyle = '#2a1c0d'; ctx.lineWidth = 3; ctx.strokeRect(x, yy, w, h);
    ctx.font = serif(22, 700); ctx.fillStyle = '#c9a24a'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(ROMAN[k], x + w / 2, 100 + ih + 28);
    fitText(ctx, p.caps?.[k] || '', x + w / 2, 100 + ih + 92, w, 70, 24, 400, '#f0dcae', 'serif');
  });
}

// Returns a canvas; resolves once images have loaded (or failed).
export async function renderMeme(p, canvas) {
  const urls = p.imgs || (p.img ? [p.img] : []);
  const imgs = await Promise.all(urls.map((u) => loadImg(u).catch(() => null)));
  const im = imgs[0];
  const ratio = im ? Math.min(1.35, Math.max(0.6, im.naturalHeight / im.naturalWidth)) : 0.8;
  const ctx = canvas.getContext('2d');
  const set = (h) => { canvas.width = W; canvas.height = Math.round(h); };
  const style = p.style;
  if (style === 'strip') { await drawStrip(ctx, p, imgs, set); return canvas; }
  const tail = () => { canvas.tainted = imgs.some((i) => i?.tainted); return canvas; };
  if (style === 'venn') { drawVenn(ctx, p, imgs, set); return tail(); }
  if (style === 'nobody') { drawNobody(ctx, p, im, ratio, set); return tail(); }
  if (style === 'placard') { drawPlacard(ctx, p, im, ratio, set); return tail(); }
  if (style === 'wanted') { drawWanted(ctx, p, im, set); return tail(); }
  if (style === 'align') { drawAlign(ctx, p, im, set); return tail(); }
  if (style === 'flow') { drawFlow(ctx, p, im, set); return tail(); }
  if (style === 'graph') { drawGraph(ctx, p, im, set); return tail(); }
  if (style === 'triptych') { drawTriptych(ctx, p, imgs, set); return tail(); }
  if (style === 'kym' || style === 'plain') { set(W * ratio); cover(ctx, im, 0, 0, W, W * ratio); }
  else if (style === 'impact' || style === 'pov') {
    set(W * ratio); cover(ctx, im, 0, 0, W, W * ratio);
    if (style === 'pov') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, 120); textBlock(ctx, p.top, 28, 26, W - 56, sans(36, 700), '#fff', 1.2); }
    else { if (p.top) impactText(ctx, p.top, W / 2, 16, W - 40, 62); if (p.bottom) impactText(ctx, p.bottom, W / 2, W * ratio - 16, W - 40, 62, 'bottom'); }
  } else if (style === 'caption' || style === 'isthis') {
    ctx.font = sans(38); const ls = wrap(ctx, p.text, W - 60); const cap = ls.length * 38 * 1.32 + 52;
    set(cap + W * ratio); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, cap);
    textBlock(ctx, p.text, 30, 28, W - 60, sans(38), '#111', 1.32);
    cover(ctx, im, 0, cap, W, W * ratio);
    if (style === 'isthis' && p.label) { ctx.font = sans(40, 800); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.textAlign = 'center'; ctx.strokeText(p.label, W * 0.68, cap + W * ratio * 0.28); ctx.fillText(p.label, W * 0.68, cap + W * ratio * 0.28); }
  } else if (style === 'demotivator') {
    const ih = (W - 120) * ratio; set(ih + 300);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, canvas.height);
    cover(ctx, im, 60, 50, W - 120, ih); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(52, 42, W - 104, ih + 16);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = serif(64); ctx.textBaseline = 'top'; ctx.fillText(String(p.top).toUpperCase(), W / 2, ih + 92);
    textBlock(ctx, p.bottom, W / 2, ih + 180, W - 120, serif(28), '#ddd', 1.3, 'center');
  } else if (style === 'post') {
    ctx.font = sans(34); const ls = wrap(ctx, p.text, W - 80); const th = ls.length * 34 * 1.35;
    const ih = im ? (W - 60) * Math.min(ratio, 0.9) : 0; set(130 + th + (ih ? ih + 40 : 20) + 60);
    ctx.fillStyle = '#1d1a17'; ctx.fillRect(0, 0, W, canvas.height);
    ctx.fillStyle = `hsl(${(p.author || 'x').length * 37 % 360},55%,55%)`; ctx.beginPath(); ctx.arc(70, 70, 34, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = sans(30, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((p.author || '?')[0], 70, 71);
    ctx.textAlign = 'left'; ctx.font = sans(28, 700); ctx.fillText(p.author || 'anonymous', 120, 56);
    ctx.font = sans(24); ctx.fillStyle = '#9a8f84'; ctx.fillText(`@${(p.author || 'anon').toLowerCase().replace(/[^a-z]+/g, '')}_irl · 3h`, 120, 88);
    textBlock(ctx, p.text, 40, 128, W - 80, sans(34), '#fff', 1.35);
    if (ih) { ctx.save(); ctx.beginPath(); ctx.roundRect?.(30, 148 + th, W - 60, ih, 22); ctx.clip(); cover(ctx, im, 30, 148 + th, W - 60, ih); ctx.restore(); }
    ctx.fillStyle = '#9a8f84'; ctx.font = sans(24); ctx.fillText(`💬 ${(p.text.length * 7) % 900}   🔁 ${(p.text.length * 31) % 4000}   ♥ ${(p.text.length * 113) % 30000}`, 40, canvas.height - 40);
  } else if (style === 'chyron') {
    set(W * 0.75); cover(ctx, im, 0, 0, W, W * 0.75);
    ctx.fillStyle = '#c4161c'; ctx.fillRect(0, W * 0.75 - 170, 190, 50); ctx.fillStyle = '#fff'; ctx.font = sans(30, 900); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText('BREAKING', 20, W * 0.75 - 145);
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(0, W * 0.75 - 120, W, 82);
    ctx.font = sans(30, 700); ctx.fillStyle = '#111'; const ls = wrap(ctx, String(p.text).toUpperCase(), W - 40); ctx.fillText(ls[0] + (ls.length > 1 ? '…' : ''), 20, W * 0.75 - 79);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, W * 0.75 - 38, W, 38); ctx.fillStyle = '#ffd23a'; ctx.font = sans(22, 600); ctx.fillText(`LIVE · ${p.ticker || 'MORE AT 11'}`, 20, W * 0.75 - 19);
  } else if (style === 'twopanel' || style === 'versus') {
    const h = 340; set(style === 'versus' ? h + 90 : h * 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, canvas.height);
    if (style === 'versus') {
      cover(ctx, imgs[0], 0, 90, W / 2 - 3, h); cover(ctx, imgs[1] || imgs[0], W / 2 + 3, 90, W / 2 - 3, h);
      ctx.font = sans(36, 800); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.a, W / 4, 45); ctx.fillText(p.b, (3 * W) / 4, 45);
    } else {
      for (let k = 0; k < 2; k++) {
        cover(ctx, imgs[k] || imgs[0], 0, k * h, W / 2, h);
        ctx.fillStyle = k ? '#eef7ea' : '#fbeaea'; ctx.fillRect(W / 2, k * h, W / 2, h);
        ctx.font = sans(44); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(k ? '✅' : '🚫', W / 2 + 16, k * h + 16);
        const t = k ? p.b : p.a; ctx.font = sans(32, 600); const ls = wrap(ctx, t, W / 2 - 50);
        textBlock(ctx, t, W / 2 + 26, k * h + h / 2 - (ls.length * 32 * 1.25) / 2, W / 2 - 50, sans(32, 600), '#111', 1.25);
      }
    }
  } else if (style === 'brain') {
    const rows = p.steps.length, h = 200; set(rows * h);
    p.steps.forEach((t, k) => {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, k * h, W / 2, h);
      textBlock(ctx, t, 20, k * h + 30, W / 2 - 40, sans(30, 600), '#111', 1.25);
      cover(ctx, imgs[k] || imgs[0], W / 2, k * h, W / 2, h);
      ctx.fillStyle = `rgba(255,${200 - k * 40},${80 + k * 50},${0.12 + k * 0.12})`; ctx.fillRect(W / 2, k * h, W / 2, h);
      ctx.fillStyle = '#000'; ctx.fillRect(0, k * h + h - 3, W, 3);
    });
  } else if (style === 'starter') {
    set(W + 110); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, canvas.height);
    ctx.font = sans(40, 800); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.text, W / 2, 56);
    const s = W / 2;
    (p.labels || []).slice(0, 4).forEach((l, k) => {
      const x = (k % 2) * s, y = 110 + Math.floor(k / 2) * s;
      cover(ctx, imgs[k] || imgs[0], x + 8, y + 8, s - 16, s - 16);
      ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(x + 8, y + s - 66, s - 16, 58);
      textBlock(ctx, l, x + s / 2, y + s - 60, s - 40, sans(24, 700), '#111', 1.15, 'center');
    });
  } else if (style === 'labels') {
    set(W * ratio); cover(ctx, im, 0, 0, W, W * ratio);
    const spots = [[0.25, 0.3], [0.7, 0.45], [0.45, 0.78]];
    (p.labels || []).slice(0, 3).forEach((l, k) => {
      const [fx, fy] = spots[k]; ctx.font = sans(34, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText(l, W * fx, W * ratio * fy); ctx.fillStyle = '#fff'; ctx.fillText(l, W * fx, W * ratio * fy);
    });
  } else if (style === 'quotecard') {
    set(W); cover(ctx, im, 0, 0, W, W);
    const g = ctx.createLinearGradient(0, 0, 0, W); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,.8)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
    ctx.font = serif(40, 400); const ls = wrap(ctx, `“${p.text}”`, W - 100); const th = ls.length * 40 * 1.35;
    textBlock(ctx, `“${p.text}”`, 50, W / 2 - th / 2 - 20, W - 100, serif(40), '#fff', 1.35);
    ctx.font = sans(26, 600); ctx.fillStyle = '#ffcf9a'; ctx.textAlign = 'left'; ctx.fillText(`— ${p.author}`, 50, W / 2 + th / 2 + 20);
  } else { set(W * ratio); cover(ctx, im, 0, 0, W, W * ratio); }
  canvas.tainted = imgs.some((i) => i?.tainted);
  return canvas;
}

// ------------------------------------------------ surreal comic strip
const hashCol = (s, l = 45) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${h % 360},40%,${l}%)`; };
function balloon(ctx, text, x, y, w, maxH, tailX, tailY) {
  let size = 24, ls;
  for (; size >= 13; size--) { ctx.font = `700 ${size}px "Comic Neue", "Comic Sans MS", "Chalkboard SE", ui-rounded, system-ui, sans-serif`; ls = wrap(ctx, text, w - 28); if (ls.length * size * 1.18 + 22 <= maxH) break; }
  const h = ls.length * size * 1.18 + 22;
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill(); ctx.stroke();
  const bx = Math.max(x + 24, Math.min(x + w - 24, tailX));
  ctx.beginPath(); ctx.moveTo(bx - 12, y + h - 1); ctx.lineTo(tailX, tailY); ctx.lineTo(bx + 12, y + h - 1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx - 12, y + h); ctx.lineTo(tailX, tailY); ctx.lineTo(bx + 12, y + h); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ls.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 12 + i * size * 1.18));
}
function figure(ctx, x, y, s, img, name, flip, tilt = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(flip ? -s : s, s);
  ctx.fillStyle = hashCol(name, 30); ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-22, -92); ctx.lineTo(22, -92); ctx.lineTo(34, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = hashCol(name, 22); ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-18, -80); ctx.lineTo(-40, -44); ctx.moveTo(18, -80); ctx.lineTo(36, -58); ctx.lineTo(48, -76); ctx.stroke();
  ctx.restore();
  // the head: their portrait, cut into a circle and pushed toward a print look
  const r = 40 * s, hx = x, hy = y - 92 * s - r * 0.8;
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.closePath();
  if (img) { ctx.clip(); ctx.filter = 'grayscale(.35) contrast(1.35) sepia(.2)'; const k = Math.max(2 * r / img.naturalWidth, 2 * r / img.naturalHeight) * 1.1; ctx.drawImage(img, hx - img.naturalWidth * k / 2, hy - img.naturalHeight * k * 0.42, img.naturalWidth * k, img.naturalHeight * k); ctx.filter = 'none'; }
  else { ctx.fillStyle = '#e9d6b8'; ctx.fill(); ctx.fillStyle = '#111'; ctx.font = `800 ${Math.round(r)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name.split(' ').map((w) => w[0]).slice(0, 2).join(''), hx, hy + 2); }
  ctx.restore();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.stroke();
  return [hx, hy - r];
}
async function drawStrip(ctx, p, bgs, set) {
  const faces = await Promise.all((p.cast || []).map((c) => (c.img ? loadImg(c.img).catch(() => null) : null)));
  const cast = p.cast || [], n = cast.length, pad = 14, gap = 12, pw = (W - pad * 2 - gap) / 2, top = 92, bar = 30;
  set(top + pw * 2 + gap + pad);
  ctx.fillStyle = '#f2e8d5'; ctx.fillRect(0, 0, W, canvas_h(ctx));
  ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = serif(27, 700);
  ctx.fillText(p.title, pad + 4, 34, W - pad * 2 - 8);
  ctx.font = `italic 18px Georgia, serif`; ctx.fillStyle = '#6b5a44'; ctx.fillText(`a conversation${p.subject ? ` · on ${p.subject}` : ''}`, pad + 4, 68);
  // fixed spots so each author keeps their place from panel to panel
  const spots = n === 3 ? [0.2, 0.5, 0.8] : [0.28, 0.72];
  p.panels.forEach((pn, i) => {
    const x = pad + (i % 2) * (pw + gap), y = top + Math.floor(i / 2) * (pw + gap);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, pw, pw); ctx.clip();
    ctx.filter = pn.event ? 'hue-rotate(140deg) saturate(1.8) contrast(1.1)' : `sepia(.3) saturate(1.2) hue-rotate(${i * 25}deg)`;
    cover(ctx, bgs[i % Math.max(1, bgs.length)] || null, x, y, pw, pw); ctx.filter = 'none';
    ctx.fillStyle = pn.event ? 'rgba(40,0,60,.25)' : 'rgba(255,240,215,.18)'; ctx.fillRect(x, y, pw, pw);
    ctx.fillStyle = 'rgba(0,0,0,.07)'; for (let yy = y + 4; yy < y + pw; yy += 8) for (let xx = x + ((yy / 8) % 2) * 4; xx < x + pw; xx += 8) ctx.fillRect(xx, yy, 2, 2);
    const ground = y + pw - bar - 4;
    if (pn.event) {
      cast.forEach((c, k) => figure(ctx, x + pw * spots[k], ground, n === 3 ? 0.5 : 0.62, faces[k], c.name, spots[k] > 0.5, (k % 2 ? 1 : -1) * 0.25));
      ctx.fillStyle = '#ffe36b'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.rect(x + 10, y + 10, pw - 20, 96); ctx.fill(); ctx.stroke();
      textBlock(ctx, pn.event, x + 22, y + 22, pw - 44, `italic 700 21px Georgia, serif`, '#111', 1.2);
    } else {
      const sp = pn.who;
      cast.forEach((c, k) => { if (k !== sp) figure(ctx, x + pw * spots[k], ground, n === 3 ? 0.5 : 0.62, faces[k], c.name, spots[k] > 0.5); });
      const [tx, ty] = figure(ctx, x + pw * spots[sp], ground, n === 3 ? 0.78 : 0.92, faces[sp], cast[sp].name, spots[sp] > 0.5);
      balloon(ctx, `${pn.say}`, x + 10, y + 10, pw - 20, pw * 0.46, tx + (spots[sp] > 0.5 ? -14 : 14), ty - 4);
    }
    // nameplate: who is speaking
    ctx.fillStyle = '#111'; ctx.fillRect(x, y + pw - bar, pw, bar);
    ctx.font = sans(16, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd98a';
    ctx.fillText(pn.event ? '· · ·' : `${cast[pn.who].name}`, x + 12, y + pw - bar / 2, pw - 24);
    ctx.restore();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(x, y, pw, pw);
  });
}
