// Package builder: Morning and Evening mode content (tools/data/topics.json → modes).
// Morning: human biology, neuroplasticity, nootropics and breathwork articles, uplifting quotes,
// and videos of living things, animals, vistas and kindness. Evening: mystical, dream and
// science-fiction articles, introspective quotes and night poems. Each post keeps its usual
// `cat` (wiki, video, quote, read) and carries `mode`; the app files them under the mode.
export function modesBuilder(K) {
  const { OFFLINE, QUICK, buildQuotes, buildVideos, buildWiki, clip, fetchJSON, hashStr, log, pool, report, shuffle, topics, warn } = K;

  const VILE = /\b(kill\w*|murder\w*|suicid\w*|rape\w*|tortur\w*|slaughter\w*|fuck\w*|shit\w*|bitch\w*|nigg\w*|whore\w*|cunt\w*)\b/i;
  const DARK = /\b(die[sd]?|dying|death|dead|wars?|hate[sd]?|hatred|blood\w*|hell|damn\w*|stupid\w*|ugly|weapons?|bombs?|enem(?:y|ies)|corpses?|slave\w*|guns?|grave|despair|misery|sin)\b/i;
  const UP = /\b(love\w*|joy\w*|light|grat\w*|thank\w*|hope\w*|wonder\w*|kind\w*|life|alive|beaut\w*|grow\w*|learn\w*|curio\w*|heal\w*|morning|sun\w*|bloom\w*|breath\w*|hearts?|peace\w*|together|gifts?|seeds?|begin\w*|possib\w*|courage\w*|world|earth|nature|birds?|trees?|gardens?|smile\w*|dance\w*|sing\w*|play\w*|today|new)\b/gi;
  const INNER = /\b(dream\w*|night\w*|sleep\w*|stars?|soul\w*|mind\w*|silen\w*|imagin\w*|inner|self|wonder\w*|universe|myster\w*|moon\w*|seas?|dark\w*|light|vision\w*|etern\w*|time|memor\w*|unconscious|infinit\w*|shadows?|reality|real|sky|solitude|quiet|spirit\w*)\b/gi;
  const hits = (re, s) => (s.match(re) || []).length;
  const qURL = (a) => `https://en.wikiquote.org/wiki/${encodeURIComponent(a.replace(/ /g, '_'))}`;

  // the best-fitting short quotes, a few per author so no one voice takes over
  function pickQuotes(list, n, mode) {
    const seen = new Set(), perAuthor = {};
    const ok = list.filter((q) => {
      const t = q.text.replace(/\s+/g, ' ').trim();
      if (t.length < 28 || t.length > 210 || VILE.test(t) || (mode === 'morning' && DARK.test(t))) return false;
      const k = t.toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k); q.text = t; return true;
    });
    const score = (q) => (mode === 'morning' ? hits(UP, q.text) : hits(INNER, q.text)) + Math.random() * 0.8 - q.text.length / 400;
    const ranked = shuffle(ok).map((q) => [q, score(q)]).sort((a, b) => b[1] - a[1]).map(([q]) => q);
    const cap = Math.max(4, Math.ceil(n / 10)), out = [];
    for (const q of ranked) {
      if (out.length >= n) break;
      if ((perAuthor[q.author] = (perAuthor[q.author] || 0) + 1) > cap) continue;
      out.push({ id: `q${hashStr(q.author + q.text).toString(36)}`, cat: 'quote', sub: mode === 'morning' ? 'uplift' : 'introspect', mode, text: q.text, author: q.author, url: qURL(q.author) });
    }
    return out;
  }

  // night poems from PoetryDB, found by words in their lines
  async function nightPoems(terms, n) {
    const got = new Map();
    await pool(QUICK ? terms.slice(0, 3) : terms, 3, async (term) => {
      try {
        const j = await fetchJSON(`https://poetrydb.org/lines/${encodeURIComponent(term)}`, { timeout: 30000, retries: 1 });
        let k = 0;
        for (const p of Array.isArray(j) ? j : []) {
          const lc = +p.linecount, text = (p.lines || []).join(' ');
          if (lc < 6 || lc > 40 || VILE.test(text) || got.has(`${p.title}|${p.author}`)) continue;
          got.set(`${p.title}|${p.author}`, p); k++;
        }
        log(`evening poems: "${term}" -> ${k}`);
      } catch (e) { warn(`poetrydb lines/${term}: ${e.message}`); }
    });
    // rank by night words, keep some variety of authors
    const per = {};
    return shuffle([...got.values()]).map((p) => [p, hits(INNER, p.lines.join(' ')) / Math.sqrt(+p.linecount) + Math.random() * 0.5]).sort((a, b) => b[1] - a[1])
      .filter(([p]) => (per[p.author] = (per[p.author] || 0) + 1) <= Math.max(3, Math.ceil(n / 15))).slice(0, n)
      .map(([p]) => ({ id: `pe${hashStr(p.title + p.author).toString(36)}`, cat: 'read', sub: 'poem', kind: 'poem', mode: 'evening', title: p.title, author: p.author, lines: p.lines,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${p.title} ${p.author}`)}`, source: 'PoetryDB' }));
  }

  // layout fixtures for --offline builds
  function offline(mode) {
    const M = topics.modes[mode], out = [];
    for (const [k, t] of Object.entries(M.wiki || {})) for (let i = 0; i < 4; i++) out.push({ id: `w-${mode}-${k}-${i}`, cat: 'wiki', sub: k, mode, title: `${t.label} ${i + 1}`, hook: `A placeholder article about ${t.label.toLowerCase()}.`, summary: `A placeholder article about ${t.label.toLowerCase()}. The real package fetches it from Wikipedia.`, url: 'https://en.wikipedia.org/' });
    for (const [i, a] of (M.quoteAuthors || []).slice(0, 12).entries()) out.push({ id: `q-${mode}-${i}`, cat: 'quote', sub: mode === 'morning' ? 'uplift' : 'introspect', mode, text: mode === 'morning' ? 'Placeholder: a short, bright line from a writer or scientist.' : 'Placeholder: a quiet line about dreams, night or the inner life.', author: a, url: qURL(a) });
    if (mode === 'evening') for (let i = 0; i < 6; i++) out.push({ id: `pe-off-${i}`, cat: 'read', sub: 'poem', kind: 'poem', mode, title: `Night poem ${i + 1}`, author: 'Anonymous', lines: Array.from({ length: 10 }, (_, k) => (k % 5 === 4 ? '' : `Placeholder line ${k + 1} under the moon`)), source: 'PoetryDB' });
    return shuffle(out);
  }

  async function buildModes(mode) {
    const M = topics.modes?.[mode];
    if (!M) return [];
    if (OFFLINE) return offline(mode);
    const N = (k) => (QUICK ? Math.max(4, Math.ceil((M.counts?.[k] || 0) * 0.08)) : M.counts?.[k] || 0);
    log(`${mode}: building`);
    const wiki = M.wiki ? await buildWiki(M.wiki, N('wiki'), { mode }) : [];
    const video = M.video ? await buildVideos(M.video, N('video'), { mode }) : [];
    const quotes = M.quoteAuthors ? pickQuotes(await buildQuotes(M.quoteAuthors, mode), N('quote'), mode) : [];
    const poems = M.poemLines ? await nightPoems(M.poemLines, N('poem')) : [];
    report.sources[mode] = { wiki: wiki.length, video: video.length, quote: quotes.length, poem: poems.length };
    log(`${mode}: ${wiki.length} articles, ${video.length} videos, ${quotes.length} quotes, ${poems.length} poems`);
    if (quotes.length < N('quote') * 0.5) warn(`${mode}: only ${quotes.length} quotes`);
    return shuffle([...wiki, ...video, ...quotes, ...poems]).map((p) => (p.text ? { ...p, text: clip(p.text, 220) } : p));
  }
  return { buildModes };
}
