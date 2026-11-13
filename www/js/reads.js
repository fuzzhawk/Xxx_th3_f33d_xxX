// Long reads: 4–5 paragraph excerpts from public-domain novels, whole poems and
// longer article passages, classic erotica (excerpts, poems and whole tales), and contemporary
// erotica from Archive of Our Own. They open short; tap to read the rest.
import { el } from './util.js';

export function readBody(p) {
  if (p.contemporary) return storyLink(p);
  const kind = p.kind === 'poem' ? (p.erotica ? `From ${p.book || 'a book of verse'}` : 'Poem') : p.kind === 'novel' ? `From ${p.book || 'a novel'}` : 'Long read';
  const kicker = el('div.kicker', p.erotica ? `${p.tale ? 'A bawdy tale' : 'Classic erotica'} · ${kind}` : kind);
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

// a contemporary story on Archive of Our Own: its author's summary and tags, and the way to it
function storyLink(p) {
  const meta = [p.words ? `${p.words.toLocaleString()} words` : null, p.chapters ? `${p.chapters.replace(/\s+/g, '')} chapters` : null, p.kudos ? `${p.kudos.toLocaleString()} kudos` : null].filter(Boolean).join(' · ');
  return el('div.textpost.read.ao3', el('div.kicker', 'Contemporary erotica · Archive of Our Own'), el('h3', p.title), el('div.read-by', `by ${p.author}`),
    ...(p.paras || []).map((t) => el('p', t)),
    p.tags?.length ? el('div.read-tags', p.tags.join(' · ')) : null, meta ? el('div.read-meta', meta) : null,
    el('a.read-out', { href: p.url, target: '_blank', rel: 'noopener', onclick: (e) => e.stopPropagation() }, 'Read the story on AO3 →'));
}
