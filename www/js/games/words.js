// Dictionary and vocabulary for the word games. The word list is SCOWL (Kevin
// Atkinson; see data/words-LICENSE.txt), grouped by how common words are:
// level 10 is the most common, 50 is fairly obscure. Vocabulary definitions come
// from Wiktionary via the weekly package.
let dict = null, loading = null, vocab = [];

// a few words (with our own short definitions) so vocabulary games work before a package arrives
const FALLBACK = [
  ['petrichor', 'noun', 'the smell of earth after rain'], ['defenestrate', 'verb', 'to throw someone out of a window'], ['sonder', 'noun', 'the feeling that every passer-by has a life as complex as yours'],
  ['callipygian', 'adjective', 'having shapely buttocks'], ['apricity', 'noun', 'the warmth of the sun in winter'], ['susurrus', 'noun', 'a soft whispering or rustling sound'],
  ['quidnunc', 'noun', 'a gossip; someone who always wants the latest news'], ['crapulent', 'adjective', 'sick from too much eating or drinking'], ['lollygag', 'verb', 'to dawdle or waste time'],
  ['borborygmus', 'noun', 'a rumbling noise in the gut'], ['ultracrepidarian', 'adjective', 'giving opinions on things beyond your knowledge'], ['sesquipedalian', 'adjective', 'given to using very long words'],
  ['gongoozler', 'noun', 'someone who idly watches boats on a canal'], ['kakistocracy', 'noun', 'government by the least qualified people'], ['limerence', 'noun', 'the state of being infatuated with someone'],
  ['vellichor', 'noun', 'the wistful atmosphere of second-hand bookshops'], ['psithurism', 'noun', 'the sound of wind in the trees'], ['snollygoster', 'noun', 'a shrewd, unprincipled person'],
  ['flibbertigibbet', 'noun', 'a frivolous, flighty, talkative person'], ['absquatulate', 'verb', 'to leave abruptly'], ['brouhaha', 'noun', 'a noisy, overexcited fuss'], ['eldritch', 'adjective', 'weird and sinister; unearthly'],
  ['hiraeth', 'noun', 'homesickness for a home you can’t return to'], ['tittynope', 'noun', 'a small quantity of something left over'], ['cattywampus', 'adjective', 'askew; not lined up']
].map(([w, pos, d]) => ({ w, pos, d }));

export function setVocab(list) { vocab = (list || []).filter((v) => v.w && v.d); }
export const getVocab = () => (vocab.length >= 12 ? vocab : FALLBACK);

export const BLOCK = /^(fuck|shit|cunt|cock|dick|piss|twat|wank|slut|whore|nigg|fag|spic|kike|chink|gook|retard|tits|boob|porn|rape|anal|anus|penis|vagin|dildo|bitch|bastard|nazi)/;
export function loadWords() {
  if (dict) return Promise.resolve(dict);
  loading ||= fetch('data/words.txt').then((r) => r.text()).then((txt) => {
    const all = new Set(), level = new Map(), byLen = {};
    for (const line of txt.split('\n')) {
      const [lv, ...ws] = line.trim().split(' ');
      if (!ws.length) continue;
      for (const w of ws) { all.add(w); level.set(w, +lv); (byLen[w.length] ||= []).push(w); }
    }
    const common = (n, max = 20) => (byLen[n] || []).filter((w) => level.get(w) <= max && !BLOCK.test(w));
    dict = { all, level, byLen, common, has: (w) => all.has(w) };
    return dict;
  }).catch(() => { loading = null; return null; });
  return loading;
}
export const words = () => dict;

// letter frequencies in English, for filling grids
export const FREQ = 'eeeeeeeeeeeeaaaaaaaaarrrrrrriiiiiiioooooootttttttnnnnnnnssssssllllllcccccuuuudddpppmmmhhhggbbffyywkvxzjq';

// ---------------------------------------------------------------- drawing helpers
export function tile(g, c, x, y, w, h, ch, state) {
  const p = g.pal;
  const fill = state === 'hit' ? p.c[2] : state === 'near' ? p.c[1] : state === 'miss' ? 'rgba(255,255,255,.08)' : state === 'sel' ? p.c[0] : state === 'found' ? p.c[5] : 'rgba(0,0,0,.35)';
  c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, Math.min(6, w / 6)); c.fill();
  if (!state || state === 'empty') { c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5; c.stroke(); }
  if (ch) { c.fillStyle = p.ink; c.font = `800 ${Math.round(h * 0.55)}px ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch.toUpperCase(), x + w / 2, y + h / 2 + 1); }
}
const ROWS = ['qwertyuiop', 'asdfghjkl', '⏎zxcvbnm⌫'];
// on-screen keyboard; returns the key rectangles so taps can be matched
export function keyboard(g, c, y0, states = {}, keyH = 30) {
  const keys = [], gap = 4, kw = (g.W - 12 - gap * 9) / 10;
  ROWS.forEach((row, r) => {
    const wide = (ch) => (ch === '⏎' || ch === '⌫' ? kw * 1.5 + gap / 2 : kw);
    const total = [...row].reduce((s, ch) => s + wide(ch), 0) + gap * (row.length - 1);
    let x = (g.W - total) / 2;
    for (const ch of row) {
      const w = wide(ch), y = y0 + r * (keyH + gap);
      const st = states[ch];
      c.fillStyle = st === 'hit' ? g.pal.c[2] : st === 'near' ? g.pal.c[1] : st === 'miss' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.16)';
      c.beginPath(); c.roundRect(x, y, w, keyH, 5); c.fill();
      c.fillStyle = st === 'miss' ? 'rgba(255,255,255,.35)' : g.pal.ink; c.font = `700 ${ch.length > 1 || /[⏎⌫]/.test(ch) ? 14 : 13}px ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(ch === '⏎' ? 'ENTER' : ch.toUpperCase(), x + w / 2, y + keyH / 2 + 1);
      keys.push({ ch: ch === '⏎' ? 'enter' : ch === '⌫' ? 'back' : ch, x, y, w, h: keyH });
      x += w + gap;
    }
  });
  return keys;
}
export const keyAt = (keys, x, y) => keys?.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h)?.ch;
export function wrap(c, s, x, y, w, lh, maxLines = 4) {
  let line = '', yy = y, n = 0;
  for (const word of s.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (c.measureText(t).width > w && line) { c.fillText(line, x, yy); yy += lh; line = word; if (++n >= maxLines - 1) { line = `${line}…`; break; } } else line = t;
  }
  c.fillText(line, x, yy);
  return yy + lh;
}
