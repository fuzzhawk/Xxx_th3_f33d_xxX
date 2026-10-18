// Favorites tab, laid out like a profile: tabs for favorites / saved / marks,
// category chips, and a grid or full-post view.
import { el } from './util.js';
import { CATS, CAT_LABEL, marks, setMark } from './state.js';
import * as favs from './favs.js';
import { renderCard } from './cards.js';
import { CardObserver } from './feed.js';
import { icon } from './icons.js';
import { setImg } from './images.js';
import { productSVG } from './productart.js';

let kind = 'fav', cat = 'all', shown = 30, mode = 'grid', obs, root, getCtx, jumpTo = null;

export function initFavs(view, ctxFn) {
  root = view; getCtx = ctxFn;
  obs = new CardObserver(view);
  favs.onChange(() => { if (view.classList.contains('active') && mode === 'grid') render(false); });
}

function tile(entry, i) {
  const p = entry.post;
  const t = el('button.tile', { onclick: () => { mode = 'list'; shown = Math.max(30, i + 10); jumpTo = p.id; render(); } });
  const src = p.img || p.thumb || (p.vid ? `https://i.ytimg.com/vi/${p.vid}/hqdefault.jpg` : null);
  if (src) { const img = el('img', { alt: '', loading: 'lazy' }); setImg(img, src, () => img.remove()); t.append(img); }
  else if (p.cat === 'product') t.append(el('div', { style: { position: 'absolute', inset: 0 }, html: productSVG(p) }));
  else t.append(el('span', (p.title || p.name || p.quote || p.text || '').toString().slice(0, 70)));
  t.append(el('span.tg', { game: '◐', video: '▶', psych: '✺', wiki: 'W', web: '⌘', meme: '☺', product: '✧', selfcare: '☘' }[p.cat] || ''));
  return t;
}

export function render(resetScroll = true) {
  const entries = kind === 'mark' ? [] : favs.list(kind);
  const counts = { all: entries.length };
  entries.forEach((e) => (counts[e.post.cat] = (counts[e.post.cat] || 0) + 1));
  const filtered = cat === 'all' ? entries : entries.filter((e) => e.post.cat === cat);
  [...root.querySelectorAll('.post')].forEach((c) => obs.remove(c));

  const seg = el('div.seg', [['fav', 'heart', 'Favorites'], ['save', 'bookmark', 'Saved'], ['mark', 'up', 'Marked']].map(([k, ic, label]) =>
    el(`button${k === kind ? '.on' : ''}`, { onclick: () => { kind = k; shown = 30; render(); }, html: `${icon(ic)}<span>${label}</span>` })));
  const chips = kind === 'mark' ? null : el('div.chips', ['all', ...CATS].filter((c) => c === 'all' || counts[c]).map((c) =>
    el(`button${c === cat ? '.on' : ''}`, { onclick: () => { cat = c; shown = 30; render(); } }, c === 'all' ? 'All' : CAT_LABEL[c], el('i', counts[c] || 0))));
  const toggle = kind === 'mark' || !filtered.length ? null : el('div.viewtoggle',
    el(`button${mode === 'grid' ? '.on' : ''}`, { 'aria-label': 'Grid', html: icon('grid'), onclick: () => { mode = 'grid'; render(); } }),
    el(`button${mode === 'list' ? '.on' : ''}`, { 'aria-label': 'Posts', html: icon('list'), onclick: () => { mode = 'list'; render(); } }));
  let body;

  if (kind === 'mark') {
    const ms = Object.entries(marks).sort((a, b) => b[1].at - a[1].at);
    body = el('div.list', !ms.length ? el('div.empty', { html: `${icon('up')}<div>Nothing marked yet. Use the star and the slashed circle on posts to steer the feed and the next package.</div>` }) : null,
      ms.map(([id, m]) => el('div.markrow',
        el('span', { style: { color: m.v > 0 ? 'var(--olive)' : 'var(--terracotta)' }, html: icon(m.v > 0 ? 'up' : 'down') }),
        el('div', { style: { flex: 1, minWidth: 0 } }, el('div', { style: { fontSize: '14.5px' } }, String(m.label || id).slice(0, 120)), el('small', { style: { color: 'var(--faint)' } }, `${CAT_LABEL[m.cat] || m.cat}${m.sub ? ` · ${m.sub}` : ''}`)),
        el('button.btn.small', { onclick: () => { setMark({ id, cat: m.cat, sub: m.sub }, m.v); render(false); } }, 'Clear'))));
  } else if (!filtered.length) {
    body = el('div.empty', { html: `${icon(kind === 'fav' ? 'heart' : 'bookmark')}<div>${kind === 'fav' ? 'No favorites yet. Double-tap a post or tap the heart.' : 'Nothing saved yet. Tap the bookmark on a post to keep it for later.'}</div>` });
  } else if (mode === 'grid') {
    body = el('div.grid', filtered.map(tile));
  } else {
    body = el('div.list');
    for (const e of filtered.slice(0, shown)) {
      const card = renderCard(e.post, { ...getCtx(), pkgId: e.pkg });
      if (!card) continue;
      body.append(card);
      obs.add(card);
    }
    if (filtered.length > shown) body.append(el('button.btn', { style: { margin: '14px auto' }, onclick: () => { shown += 30; render(false); } }, `Show more (${filtered.length - shown})`));
  }
  const y = root.scrollTop;
  root.replaceChildren(seg, chips || '', toggle || '', body);
  if (jumpTo) { const c = root.querySelector(`[data-id="${CSS.escape(jumpTo)}"]`); jumpTo = null; if (c) { root.scrollTop = c.offsetTop - 56; return; } }
  root.scrollTop = resetScroll ? 0 : y;
}
