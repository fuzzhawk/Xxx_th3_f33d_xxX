// Rhyming dictionary for the Studio: type a word, get perfect and near rhymes grouped by syllables, tap one to put it
// in a writing pad that saves as you type. The sounds come from the CMU Pronouncing Dictionary (see
// data/rhymes-LICENSE.txt); tools/build-rhymes.mjs boils it down to data/rhymes.txt, which is fetched the first time a
// rhyme card is shown and works offline after that. The top of this file is plain data and maths (the build script
// imports it); the card is further down.
import { el, toast } from './util.js';

// sounds are stored one letter each: vowels A–O (a 1 or 2 after one marks stress), consonants a–x
export const VOWELS = ['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'];
export const CONSONANTS = ['B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH'];
const enc = (ph) => { const v = VOWELS.indexOf(ph); return v >= 0 ? String.fromCharCode(65 + v) : String.fromCharCode(97 + CONSONANTS.indexOf(ph)); };
// 'M UW1 N' -> 'kO1l'
export function encodePron(arpa) {
  return arpa.split(' ').map((t) => { const m = /^([A-Z]+)([012])?$/.exec(t); return enc(m[1]) + (m[2] === '1' || m[2] === '2' ? m[2] : ''); }).join('');
}
const isVowel = (c) => c >= 'A' && c <= 'O';
// consonants that sound alike enough for a near rhyme (nasals, voiced/unvoiced pairs, hissing sounds, liquids)
const GROUPS = [['M', 'N', 'NG'], ['P', 'B'], ['T', 'D'], ['K', 'G'], ['F', 'V'], ['S', 'Z', 'SH', 'ZH', 'CH', 'JH'], ['TH', 'DH'], ['L', 'R'], ['AH', 'IH']];
const CLS = {}; GROUPS.forEach((g, i) => g.forEach((ph) => { CLS[enc(ph)] = i; }));
const cls = (c) => CLS[c] ?? c;

// what matters about one pronunciation: syllables, the vowel of the last stressed syllable, the sounds after it, the
// consonants before it, and the rhyming part (vowel + everything after, stress ignored)
export function analyse(s) {
  let n = 0, last = -1, any = -1;
  for (let i = 0; i < s.length; i++) if (isVowel(s[i])) { n++; any = i; if (s[i + 1] === '1' || s[i + 1] === '2') last = i; }
  const at = last >= 0 ? last : any;
  if (at < 0) return null;
  let j = at; while (j > 0 && s[j - 1] >= 'a') j--;
  const key = s.slice(at).replace(/\d/g, '');
  return { s, n, v: key[0], tail: key.slice(1), key, on: s.slice(j, at) };
}

// ---------------------------------------------------------------- the dictionary
let dict = null, loading = null;
// lines of 'Lword pron pron…' (L = 1–5, how common the word is); returns { words: Map word -> { w, lv, p: [analysed pronunciations] }, all: [every pronunciation] }
export function parseRhymes(txt) {
  const words = new Map(), all = [];
  for (const line of txt.split('\n')) {
    const [head, ...prons] = line.trim().split(' ');
    if (!head || !prons.length || head[0] === '#') continue;
    const e = { w: head.slice(1), lv: +head[0], p: [] };
    for (const s of prons) { const a = analyse(s); if (a) { a.e = e; e.p.push(a); all.push(a); } }
    if (e.p.length) words.set(e.w, e);
  }
  return { words, all };
}
export function loadRhymes() {
  if (dict) return Promise.resolve(dict);
  loading ||= fetch('data/rhymes.txt').then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }).then((t) => (dict = parseRhymes(t))).catch(() => { loading = null; return null; });
  return loading;
}

// the pronunciations of what was typed: the word itself, or failing that the longest ending that is a word (so
// compounds and prefixed words still work). guess says which ending was used.
export function lookup(d, text) {
  const w = text.toLowerCase().replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '');
  if (!w) return null;
  const hit = (x) => d.words.get(x) || (x.endsWith("'s") ? d.words.get(x.slice(0, -2)) : null);
  let e = hit(w);
  if (e) return { w, p: e.p };
  for (let i = 1; i <= w.length - 2; i++) if ((e = hit(w.slice(i)))) return { w, p: e.p, guess: w.slice(i) };
  return null;
}

// perfect: the same rhyming part after a different start. near: the same vowel with a similar ending, the same vowel
// with another ending, or the same ending with another vowel (ranked in that order)
export function rhymes(d, q) {
  const perfect = new Map(), near = new Map(), skip = new Set(q.p.map((a) => a.e.w).concat(q.w));
  for (const c of d.all) {
    if (skip.has(c.e.w)) continue;
    let best = 0, score = 0;
    for (const a of q.p) {
      if (c.key === a.key) { if (c.on !== a.on) { best = 9; break; } continue; }
      if (c.v === a.v) {
        if (c.tail.length === a.tail.length && c.tail.length) score = [...c.tail].every((t, i) => cls(t) === cls(a.tail[i])) ? 3 : 2;
        else if (!c.tail.length && !a.tail.length) score = 0;
      } else if (a.tail && c.tail === a.tail) score = 1.5;
      if (score) score += c.n === a.n ? 0.3 : 0;
      best = Math.max(best, score);
    }
    if (!best) continue;
    const m = best === 9 ? perfect : near, k = Math.min(4, c.n), cur = m.get(c.e.w);
    if (cur && cur.score >= best) continue;
    m.set(c.e.w, { w: c.e.w, lv: c.e.lv, n: k, score: best });
  }
  // sorted by how common, within each number of syllables; the near ones by closeness first
  const group = (m) => { const g = {}; for (const r of m.values()) (g[r.n] ||= []).push(r); for (const k in g) g[k].sort((a, b) => b.score - a.score || a.lv - b.lv || (a.w < b.w ? -1 : 1)); return g; };
  return { perfect: group(perfect), near: group(near) };
}

// ---------------------------------------------------------------- the card
const draftKey = (id) => `feed-write-${id}`;
const load = (id) => { try { return localStorage.getItem(draftKey(id)) || ''; } catch { return ''; } };
const store = (id, v) => { try { localStorage.setItem(draftKey(id), v); } catch { /* private mode */ } };
function download(name, text) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
const SYL = { 1: 'One syllable', 2: 'Two syllables', 3: 'Three syllables', 4: 'Four or more' };
const SHOWN = { 1: 48, 2: 36, 3: 24, 4: 16 };

export function rhymeBody(p) {
  const input = el('input.rhyme-input', { type: 'text', value: p.word || '', placeholder: 'Type a word', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterKeyHint: 'search', 'aria-label': 'Word to find rhymes for' });
  const info = el('div.rhyme-info.muted', 'Loading the dictionary…');
  const out = el('div.rhyme-out');
  const ta = el('textarea.write-area.rhyme-pad', { placeholder: 'Write here. Tap a rhyme to drop it in.', rows: 6, spellcheck: true });
  ta.value = load(p.id);
  const count = el('span.muted.write-count');
  const upd = () => { const n = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0; count.textContent = `${n} word${n === 1 ? '' : 's'} · saved on this device · tap ✈ to download`; };
  ta.addEventListener('input', () => { store(p.id, ta.value); upd(); });
  for (const ev of ['pointerdown', 'click', 'touchstart', 'keydown']) { ta.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); input.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); }
  upd();

  let d = null, current = '';
  const insert = (w) => {
    const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a, v = ta.value;
    const pre = v.slice(0, a), post = v.slice(b), sp = pre && !/[\s(“"'-]$/.test(pre) ? ' ' : '', tail = post && !/^[\s.,;:!?)”"'-]/.test(post) ? ' ' : '';
    ta.value = `${pre}${sp}${w}${tail}${post}`;
    const at = (pre + sp + w).length; ta.setSelectionRange(at, at);
    store(p.id, ta.value); upd();
    ta.classList.remove('flash'); void ta.offsetWidth; ta.classList.add('flash');
  };
  const chip = (r) => {
    let timer = 0, long = false;
    const b = el('button.rhyme-chip', { type: 'button', 'data-lv': r.lv, 'aria-label': `Insert ${r.w}` }, r.w);
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the pad focused (and the keyboard up)
    b.addEventListener('pointerdown', () => { long = false; clearTimeout(timer); timer = setTimeout(() => { long = true; navigator.vibrate?.(10); input.value = r.w; search(); }, 520); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(timer));
    b.addEventListener('click', (e) => { e.stopPropagation(); if (!long) insert(r.w); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  const section = (title, g, sub) => {
    const keys = [1, 2, 3, 4].filter((k) => g[k]?.length);
    const box = el('section.rhyme-sec', el('h4', title, el('small', sub)));
    if (!keys.length) { box.append(el('p.muted.rhyme-none', 'None in this dictionary.')); return box; }
    for (const k of keys) {
      const list = g[k], row = el('div.rhyme-chips');
      const fill = (n) => { row.replaceChildren(...list.slice(0, n).map(chip), list.length > n ? el('button.rhyme-more', { type: 'button', onclick: (e) => { e.stopPropagation(); fill(list.length); } }, `+${list.length - n} more`) : null); };
      fill(SHOWN[k]);
      box.append(el('div.rhyme-grp', el('span.rhyme-n', SYL[k], el('i', ` ${list.length}`)), row));
    }
    return box;
  };
  const search = () => {
    const text = input.value.trim();
    current = text;
    if (!d) return;
    if (!text) { info.textContent = 'Type a word above.'; out.replaceChildren(); return; }
    const q = lookup(d, text);
    if (!q) { info.textContent = `“${text}” isn’t in the dictionary. Try another spelling.`; out.replaceChildren(); return; }
    const r = rhymes(d, q), np = Object.values(r.perfect).reduce((a, l) => a + l.length, 0), nn = Object.values(r.near).reduce((a, l) => a + l.length, 0);
    info.textContent = q.guess ? `Heard as “…${q.guess}”: ${np} perfect, ${nn} near. Tap to insert, hold to look up.` : `${np} perfect, ${nn} near. Tap to insert, hold to look up.`;
    out.replaceChildren(section('Perfect rhymes', r.perfect, 'same ending sound'), section('Near rhymes', r.near, 'same vowel or ending, closest first'));
  };
  let deb = 0;
  input.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(search, 280); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(deb); search(); input.blur(); } });

  const body = el('div.write.rhyme',
    el('div.rhyme-bar', input, el('button.btn.primary', { type: 'button', onclick: (e) => { e.stopPropagation(); clearTimeout(deb); search(); } }, 'Rhyme')),
    info, out,
    el('div.rhyme-pad', ta, count),
    el('div.rhyme-credit.muted', 'Pronunciations: CMU Pronouncing Dictionary (Carnegie Mellon University).'));
  const send = () => {
    const text = ta.value.trim();
    if (!text) { toast('Nothing written yet'); return; }
    download(`${(text.split('\n')[0] || current || 'rhymes').replace(/[^\w]+/g, '-').slice(0, 40).replace(/^-|-$/g, '') || 'rhymes'}.txt`, `${text}\n`);
  };
  const activate = async () => {
    if (!d) { d = await loadRhymes(); if (!d) { info.textContent = 'Couldn’t load the rhyming dictionary. Check your connection once; after that it works offline.'; return; } }
    if (current !== input.value.trim() || !out.childNodes.length) search();
  };
  return { body, send, activate };
}
