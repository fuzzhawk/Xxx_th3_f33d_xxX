// Absurd power scale: versus cards and tier lists of strange things from history,
// folklore and fiction. Two stats come from real numbers (article length, page
// views); the rest are fate. Power levels are quoted in silly units.
import { el } from './util.js';
import { setImg } from './images.js';

const KIND = { item: 'artefact', creature: 'creature', person: 'human', fiction: 'fiction', concept: 'idea' };
const fmt = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n.toLocaleString();

function face(e, cls = '') {
  const pic = el(`div.pw-pic${cls}`);
  if (e.img) { const i = el('img', { alt: '', loading: 'lazy' }); setImg(i, e.img, () => { i.remove(); pic.textContent = e.t[0]; }); pic.append(i); }
  else pic.textContent = e.t[0];
  return pic;
}
const wikiLink = (e) => el('a.pw-name', { href: e.url, target: '_blank', rel: 'noopener', onclick: (ev) => ev.stopPropagation() }, e.t);

export function powerBody(p) {
  return p.sub === 'tier' ? tier(p) : versus(p);
}

function versus(p) {
  const [a, b] = [p.a, p.b];
  const side = (e, k) => el(`div.pw-side${p.winner === k ? '.win' : ''}`, face(e), wikiLink(e), el('span.pw-kind', KIND[e.k] || e.k), el('div.pw-level', el('b', fmt(e.pw)), el('small', p.unit)));
  const bar = (side, v) => { const i = el('i'); i.style.setProperty('--v', v / 10); return el(`div.pw-bar.${side}`, i); };
  const stats = el('div.pw-stats', ...Object.keys(a.s).map((name) => el('div.pw-row', bar('l', a.s[name]), el('span', name), bar('r', b.s[name]))));
  const box = el('div.pw', el('div.pw-vs', side(a, 0), el('div.pw-mid', 'VS'), side(b, 1)), stats,
    el('div.pw-verdict', el('b', p.how), el('small', p.verdict)),
    el('div.pw-blurbs', el('p', a.b), el('p', b.b)));
  return box;
}

function tier(p) {
  const rows = p.ents.map((e, i) => el('div.pw-tr', el(`span.pw-t.t${i}`, p.tiers[i]), face(e, '.sm'), el('div.pw-tn', wikiLink(e), el('small', `${KIND[e.k] || e.k} · ${fmt(e.pw)} ${p.unit}`))));
  return el('div.pw.pw-tierlist', el('h3', p.title), ...rows, el('small.pw-foot', 'Rankings final. Complaints to the sacred chickens.'));
}
