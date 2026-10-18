// Procedural 80s/90s promo graphics for made-up products, as inline SVG.
import { mulberry32 } from './util.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const BURSTS = ['NEW!', 'AS SEEN ON TV!', 'NOW 40% WEIRDER', 'LIMITED TIME!', 'ACT NOW!', 'FREE GIFT INSIDE', 'AMAZING!', 'PATENT DENIED', 'WOW!', 'NO MONEY DOWN', 'CALL NOW!', 'NOT IN STORES'];

function starburst(cx, cy, r1, r2, n, rot = 0) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + rot, r = i % 2 ? r2 : r1;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return d + 'Z';
}
function wrap(name, max = 14) {
  const words = name.toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export function productSVG(p) {
  const R = mulberry32(p.art?.seed || 1);
  const style = p.art?.style || 'sunset';
  const id = `p${(p.art?.seed || 1).toString(36)}`;
  const lines = wrap(p.name.replace(/^The /, ''));
  const burst = BURSTS[Math.floor(R() * BURSTS.length)];
  const glyph = esc(p.glyph || '✦');
  const nameText = (fill, stroke, y0, size = 34, font = "Impact, 'Arial Black', sans-serif", extra = '') =>
    lines.map((l, i) => `<text x="200" y="${y0 + i * (size + 4)}" text-anchor="middle" font-family="${font}" font-size="${l.length > 12 ? size * 0.82 : size}" font-weight="900" fill="${fill}" stroke="${stroke}" stroke-width="${stroke === 'none' ? 0 : 2}" paint-order="stroke" letter-spacing="1" ${extra}>${esc(l)}</text>`).join('');
  let body = '';
  if (style === 'sunset') {
    const h = Math.floor(R() * 40);
    body = `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${270 + h},60%,12%)"/><stop offset=".55" stop-color="hsl(${330 + h},70%,35%)"/><stop offset="1" stop-color="hsl(${20 + h},95%,55%)"/></linearGradient>
      <linearGradient id="${id}sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe66d"/><stop offset="1" stop-color="#ff5e3a"/></linearGradient>
      <linearGradient id="${id}chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#9bd1ff"/><stop offset=".5" stop-color="#1b2a4a"/><stop offset="1" stop-color="#f6c1ff"/></linearGradient>
      <clipPath id="${id}c"><rect y="0" width="400" height="245"/></clipPath></defs>
      <rect width="400" height="400" fill="url(#${id}s)"/>
      <g clip-path="url(#${id}c)"><circle cx="200" cy="230" r="100" fill="url(#${id}sun)"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="90" y="${190 + i * 12}" width="220" height="${2 + i * 1.6}" fill="hsl(${300 + h},60%,${25 + i * 3}%)"/>`).join('')}</g>
      <rect y="245" width="400" height="155" fill="#120a1f"/>
      ${Array.from({ length: 13 }, (_, i) => `<line x1="${200 + (i - 6) * 18}" y1="245" x2="${200 + (i - 6) * 120}" y2="400" stroke="#ff4fd8" stroke-width="1.4" opacity=".75"/>`).join('')}
      ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="0" x2="400" y1="${245 + Math.pow(i / 5, 1.8) * 155}" y2="${245 + Math.pow(i / 5, 1.8) * 155}" stroke="#ff4fd8" stroke-width="1.2" opacity=".7"/>`).join('')}
      <text x="200" y="275" text-anchor="middle" font-size="86" style="filter:drop-shadow(0 0 12px #ff9de2)">${glyph}</text>
      ${nameText(`url(#${id}chrome)`, '#2b0b3f', 62, 38)}`;
  } else if (style === 'memphis') {
    const cols = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#ff8fd1', '#1b1b1b'];
    let shapes = '';
    for (let i = 0; i < 22; i++) {
      const x = R() * 400, y = R() * 400, c = cols[Math.floor(R() * cols.length)], k = Math.floor(R() * 4), s = 10 + R() * 26;
      if (k === 0) shapes += `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${c}"/>`;
      else if (k === 1) shapes += `<path d="M${x},${y} l${s},0 l${-s / 2},${-s}z" fill="none" stroke="${c}" stroke-width="4"/>`;
      else if (k === 2) shapes += `<path d="M${x},${y} q10,-14 20,0 t20,0 t20,0" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
      else shapes += `<rect x="${x}" y="${y}" width="${s}" height="${s / 3}" fill="${c}" transform="rotate(${R() * 90} ${x} ${y})"/>`;
    }
    body = `<rect width="400" height="400" fill="#fff4e0"/><g opacity=".85">${shapes}</g>
      <circle cx="200" cy="215" r="95" fill="#1b1b1b"/><circle cx="208" cy="207" r="95" fill="#ffd93d"/>
      <text x="205" y="245" text-anchor="middle" font-size="96">${glyph}</text>
      <rect x="18" y="20" width="364" height="${lines.length * 38 + 18}" fill="#1b1b1b" transform="rotate(-2 200 50)"/>
      ${nameText('#fff4e0', 'none', 56, 34, "'Arial Black', Impact, sans-serif", 'transform="rotate(-2 200 50)"')}`;
  } else if (style === 'chrome') {
    body = `<defs><linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdfd"/><stop offset=".48" stop-color="#8e9aa8"/><stop offset=".52" stop-color="#2f3640"/><stop offset="1" stop-color="#d7dde5"/></linearGradient>
      <radialGradient id="${id}g" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#3a2a1a"/><stop offset="1" stop-color="#080706"/></radialGradient></defs>
      <rect width="400" height="400" fill="url(#${id}g)"/>
      ${Array.from({ length: 40 }, () => `<circle cx="${R() * 400}" cy="${R() * 400}" r="${R() * 1.6}" fill="#fff" opacity="${0.3 + R() * 0.6}"/>`).join('')}
      <path d="${starburst(300, 300, 4, 60, 4, 0.3)}" fill="#fff" opacity=".6"/>
      <ellipse cx="200" cy="330" rx="110" ry="16" fill="#ff7a1a" opacity=".25"/>
      <text x="200" y="300" text-anchor="middle" font-size="120" style="filter:drop-shadow(0 0 16px rgba(255,170,90,.6))">${glyph}</text>
      ${nameText(`url(#${id}m)`, '#0b0b0b', 70, 40, "'Arial Black', Impact, sans-serif", 'font-style="italic"')}`;
  } else if (style === 'vhs') {
    const hue = Math.floor(R() * 360);
    body = `<rect width="400" height="400" fill="hsl(${hue},35%,14%)"/>
      ${Array.from({ length: 100 }, (_, i) => `<rect y="${i * 4}" width="400" height="1.5" fill="#000" opacity=".25"/>`).join('')}
      <text x="200" y="265" text-anchor="middle" font-size="110" opacity=".95">${glyph}</text>
      <g font-family="ui-monospace, monospace" font-size="22" fill="#fff"><text x="22" y="40">PLAY ▶</text><text x="378" y="40" text-anchor="end">SP</text>
      <text x="22" y="380">${String(Math.floor(R() * 12) + 1).padStart(2, '0')}:${String(Math.floor(R() * 60)).padStart(2, '0')} ${R() < 0.5 ? 'AM' : 'PM'}</text><text x="378" y="380" text-anchor="end">${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Math.floor(R() * 12)]}.${String(Math.floor(R() * 28) + 1).padStart(2, '0')} 19${80 + Math.floor(R() * 20)}</text></g>
      <g transform="translate(-3 0)" opacity=".7">${nameText('#ff2a6d', 'none', 110, 34)}</g><g transform="translate(3 0)" opacity=".7">${nameText('#05d9e8', 'none', 110, 34)}</g>${nameText('#fff', 'none', 110, 34)}`;
  } else if (style === 'infomercial') {
    body = `<defs><radialGradient id="${id}r" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#ffe29a"/><stop offset="1" stop-color="#ff7a1a"/></radialGradient></defs>
      <rect width="400" height="400" fill="url(#${id}r)"/>
      ${Array.from({ length: 18 }, (_, i) => `<path d="M200,230 L${200 + Math.cos((i / 18) * 6.283) * 400},${230 + Math.sin((i / 18) * 6.283) * 400} L${200 + Math.cos(((i + 0.5) / 18) * 6.283) * 400},${230 + Math.sin(((i + 0.5) / 18) * 6.283) * 400}z" fill="#fff" opacity=".18"/>`).join('')}
      <text x="200" y="275" text-anchor="middle" font-size="120">${glyph}</text>
      ${nameText('#d7263d', '#fff', 58, 38)}
      <g transform="rotate(-14 320 325)"><path d="${starburst(320, 325, 64, 46, 14)}" fill="#ffd400" stroke="#d7263d" stroke-width="4"/>
      <text x="320" y="322" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-size="${burst.length > 10 ? 11 : 15}" fill="#d7263d" font-weight="900">${esc(burst.split(' ').slice(0, 2).join(' '))}</text>
      <text x="320" y="340" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-size="${burst.length > 10 ? 11 : 15}" fill="#d7263d" font-weight="900">${esc(burst.split(' ').slice(2).join(' '))}</text></g>`;
  } else {
    // blueprint
    body = `<rect width="400" height="400" fill="#123a6b"/>
      ${Array.from({ length: 21 }, (_, i) => `<line x1="${i * 20}" y1="0" x2="${i * 20}" y2="400" stroke="#fff" stroke-width="${i % 5 ? 0.3 : 0.8}" opacity=".35"/><line y1="${i * 20}" x1="0" y2="${i * 20}" x2="400" stroke="#fff" stroke-width="${i % 5 ? 0.3 : 0.8}" opacity=".35"/>`).join('')}
      <circle cx="200" cy="230" r="90" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 4" opacity=".8"/>
      <text x="200" y="265" text-anchor="middle" font-size="96" style="filter:grayscale(1) brightness(2.2) contrast(.8)" opacity=".85">${glyph}</text>
      ${[0, 1, 2].map((i) => { const a = R() * 6.28, x = 200 + Math.cos(a) * 90, y = 230 + Math.sin(a) * 90, lx = x < 200 ? 30 : 300; return `<line x1="${x}" y1="${y}" x2="${lx + (x < 200 ? 70 : 0)}" y2="${y}" stroke="#fff" stroke-width="1"/><text x="${lx}" y="${y - 6}" font-family="ui-monospace, monospace" font-size="11" fill="#fff">FIG. ${i + 1}${'ABC'[i]}</text>`; }).join('')}
      ${nameText('#fff', 'none', 60, 30, 'ui-monospace, monospace')}
      <text x="380" y="385" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" fill="#fff" opacity=".8">PAT. PENDING · DO NOT BUILD</text>`;
  }
  return `<svg class="art" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)} promo">${body}</svg>`;
}
