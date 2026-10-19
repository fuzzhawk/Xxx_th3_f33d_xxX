// Draws memes onto a canvas so what you see is exactly what gets saved.
// Styles: impact, caption, demotivator, post, chyron, twopanel, brain, starter,
// versus, labels, quotecard, pov, isthis.

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

// Returns a canvas; resolves once images have loaded (or failed).
export async function renderMeme(p, canvas) {
  const urls = p.imgs || (p.img ? [p.img] : []);
  const imgs = await Promise.all(urls.map((u) => loadImg(u).catch(() => null)));
  const im = imgs[0];
  const ratio = im ? Math.min(1.35, Math.max(0.6, im.naturalHeight / im.naturalWidth)) : 0.8;
  const ctx = canvas.getContext('2d');
  const set = (h) => { canvas.width = W; canvas.height = Math.round(h); };
  const style = p.style;
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
