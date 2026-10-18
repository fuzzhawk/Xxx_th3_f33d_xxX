import { el, $ } from './util.js';
import { CATS, CAT_LABEL, marks, setMark } from './state.js';
import * as favs from './favs.js';
import { renderCard } from './cards.js';
import { CardObserver } from './feed.js';

let kind = 'fav', cat = 'all', shown = 30, obs, root, getCtx;

export function initFavs(view, ctxFn) {
  root = view; getCtx = ctxFn;
  obs = new CardObserver(view);
  favs.onChange(() => { if (view.classList.contains('active')) render(false); });
}

export function render(resetScroll = true) {
  const entries = kind === 'mark' ? [] : favs.list(kind);
  const counts = { all: entries.length };
  entries.forEach((e) => (counts[e.post.cat] = (counts[e.post.cat] || 0) + 1));
  const filtered = cat === 'all' ? entries : entries.filter((e) => e.post.cat === cat);
  [...root.querySelectorAll('.card')].forEach((c) => obs.remove(c));

  const seg = el('div.seg', [['fav', '♥ Favorites'], ['save', '🔖 Saved'], ['mark', '▲▼ Marked']].map(([k, label]) =>
    el(`button${k === kind ? '.on' : ''}`, { onclick: () => { kind = k; shown = 30; render(); } }, label)));
  const chips = kind === 'mark' ? null : el('div.chips', ['all', ...CATS].filter((c) => c === 'all' || counts[c]).map((c) =>
    el(`button${c === cat ? '.on' : ''}`, { onclick: () => { cat = c; shown = 30; render(); } }, c === 'all' ? 'All' : CAT_LABEL[c], el('i', counts[c] || 0))));
  const list = el('div.list');

  if (kind === 'mark') {
    const ms = Object.entries(marks).sort((a, b) => b[1].at - a[1].at);
    if (!ms.length) list.append(el('div.empty', 'Nothing marked yet. Use ▲ and ▼ on posts to steer the feed and the next package.'));
    for (const [id, m] of ms) {
      list.append(el('div.group', { style: { margin: 0 } },
        el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
          el('span', { style: { color: m.v > 0 ? 'var(--olive)' : 'var(--terracotta)', fontSize: '18px' } }, m.v > 0 ? '▲' : '▼'),
          el('div', { style: { flex: 1 } }, el('div', { style: { fontSize: '14.5px' } }, m.label || id), el('small', { style: { color: 'var(--faint)' } }, `${CAT_LABEL[m.cat] || m.cat}${m.sub ? ` · ${m.sub}` : ''}`)),
          el('button.btn.small', { onclick: () => { setMark({ id, cat: m.cat, sub: m.sub }, m.v); render(false); } }, 'Clear'))));
    }
  } else if (!filtered.length) {
    list.append(el('div.empty', kind === 'fav' ? 'No favorites yet. Tap ♥ on anything in the feed.' : 'Nothing saved yet. Tap 🔖 to keep something for later.'));
  } else {
    for (const e of filtered.slice(0, shown)) {
      const card = renderCard(e.post, { ...getCtx(), pkgId: e.pkg });
      if (!card) continue;
      list.append(card);
      obs.add(card);
    }
    if (filtered.length > shown) list.append(el('button.btn', { style: { margin: '8px auto' }, onclick: () => { shown += 30; render(false); } }, `Show more (${filtered.length - shown})`));
  }
  const y = root.scrollTop;
  root.replaceChildren(seg, chips || '', list);
  root.scrollTop = resetScroll ? 0 : y;
}
