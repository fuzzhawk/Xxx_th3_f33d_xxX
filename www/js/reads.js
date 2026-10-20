// Long reads: 4–5 paragraph excerpts from public-domain novels, whole poems and
// longer article passages. They open short; tap to read the rest.
import { el } from './util.js';

export function readBody(p) {
  const kicker = el('div.kicker', p.kind === 'poem' ? 'Poem' : p.kind === 'novel' ? `From ${p.book || 'a novel'}` : 'Long read');
  const head = el('h3', p.title), by = p.author ? el('div.read-by', p.author + (p.year ? ` · ${p.year}` : '')) : null;
  let first, rest;
  if (p.kind === 'poem') {
    const lines = p.lines || [];
    first = el('div.read-poem', lines.slice(0, 6).join('\n'));
    rest = lines.length > 6 ? el('div.read-poem', lines.slice(6).join('\n')) : null;
  } else {
    const paras = p.paras || [];
    const lead = paras[0] || '';
    const cut = lead.length > 320 ? lead.slice(0, lead.lastIndexOf(' ', 300)) + '…' : lead;
    first = el('p', cut);
    rest = el('div', lead.length > 320 ? el('p', lead) : null, ...paras.slice(1).map((t) => el('p', t)));
    if (lead.length > 320) rest.firstChild && (first._full = true);
  }
  const more = rest ? el('span.tapmore', p.kind === 'poem' ? `Tap to read the whole poem (${(p.lines || []).length} lines)` : `Tap to read on (${(p.paras || []).length} paragraphs)`) : null;
  const box = el('div.textpost.read', kicker, head, by, first, rest ? el('div.rest', rest) : null, more);
  box.onclick = () => {
    const open = box.classList.toggle('open');
    if (first._full) first.style.display = open ? 'none' : '';
    if (more) more.textContent = open ? 'Tap to fold' : more.textContent.replace('Tap to fold', 'Tap to read on');
  };
  return box;
}
