// Bottom action sheet, Instagram-style.
import { el } from './util.js';
import { icon } from './icons.js';

export function actionSheet(title, items) {
  const close = () => { bd.remove(); removeEventListener('popstate', close); };
  const bd = el('div.backdrop', { onclick: (e) => { if (e.target === bd) history.back(); } },
    el('div.actionsheet', el('div.grab'), title ? el('div.sh-title', title) : null,
      items.filter(Boolean).map((it) => el(`button${it.danger ? '.danger' : ''}`, { html: `${icon(it.icon || 'more')}<span></span>`, onclick: () => { history.back(); setTimeout(() => it.run(), 60); } }))));
  bd.querySelectorAll('.actionsheet button span').forEach((s, i) => (s.textContent = items.filter(Boolean)[i].label));
  history.pushState({ sheet: 'action' }, '');
  addEventListener('popstate', close, { once: true });
  document.body.append(bd);
}
