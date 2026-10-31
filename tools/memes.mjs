// Package builder: memes. Built from the helpers and state that build-package.mjs passes in.
export function memesBuilder(K) {
  const { OFFLINE, config, fetchJSON, hashStr, id, memeImageCount, memeText, memeWeights, pick, rand, report, shuffle, topics, want, warn, wq } = K;

  function buildMemes(quotes, wiki, commons, kym) {
    const posts = [];
    const kymN = Math.min(kym.length, Math.round(want.meme * 0.25));
    for (const k of kym.slice(0, kymN)) posts.push({ id: `mk${hashStr(k.link).toString(36)}`, cat: 'meme', sub: 'kym', style: 'kym', img: k.img, title: k.title, link: k.link, credit: 'via Know Your Meme' });
    const shortQ = shuffle(quotes.filter((q) => q.text.length < 150));
    const facts = shuffle(wiki.filter((w) => w.hook.length < 170));
    const topicLabel = Object.fromEntries(Object.entries(topics.wiki).map(([k, t]) => [k, t.label]));
    let qi = 0, fi = 0, ii = 0;
    const nextQ = () => shortQ[qi++ % Math.max(1, shortQ.length)] || { text: 'Only the madman is absolutely sure.', author: 'Robert Anton Wilson' };
    const nextF = () => facts[fi++ % Math.max(1, facts.length)];
    const nextImg = () => commons[ii++ % Math.max(1, commons.length)];
    const styles = Object.entries(memeWeights);
    const total = styles.reduce((s2, [, w]) => s2 + w, 0);
    const pickStyle = () => { let x = rand() * total; for (const [k, w] of styles) { x -= w; if (x <= 0) return k; } return 'caption'; };
    const authorUrl = (a) => `https://en.wikipedia.org/wiki/${encodeURIComponent(a.replace(/ /g, '_'))}`;
    const short = (t) => t.replace(/ \(.*\)$/, '');
    while (posts.length < want.meme && commons.length) {
      const style = pickStyle();
      const f = nextF(), f2 = nextF(), f3 = nextF(), f4 = nextF(), q = nextQ();
      const usesQuote = (s3) => /\{quote|\{author|quoteA/.test(s3);
      const factLower = f ? f.hook.replace(/\.$/, '').replace(/^(\S)/, (c) => (/^[A-Z][a-z]+ [a-z]/.test(f.hook) ? c.toLowerCase() : c)) : 'nothing is true';
      const words = q.text.split(' '), half = Math.ceil(words.length / 2);
      const fill = (t) => String(t).replace(/\{TITLE\}/g, f ? short(f.title).toUpperCase() : 'THIS').replace(/\{title\}/g, f ? short(f.title) : 'this').replace(/\{title2\}/g, f2 ? short(f2.title) : 'that')
        .replace(/\{title3\}/g, f3 ? short(f3.title) : 'the other thing').replace(/\{fact\}/g, factLower).replace(/\{quoteA\}/g, words.slice(0, half).join(' ')).replace(/\{quoteB\}/g, words.slice(half).join(' '))
        .replace(/\{quote\}/g, q.text.replace(/^"|"$/g, '')).replace(/\{author\}/g, q.author).replace(/\{topic\}/g, f ? topicLabel[f.sub] || 'Wikipedia' : 'Wikipedia');
      const imgs = Array.from({ length: memeImageCount[style] || 1 }, nextImg);
      const p = { cat: 'meme', sub: 'remix', style, imgs: imgs.map((x) => x.img), img: imgs[0].img, credit: imgs[0].credit, link: imgs[0].link };
      const T = memeText[style];
      let src = '';
      if (style === 'impact' || style === 'demotivator') { const [top, bottom] = pick(T); p.top = fill(top); p.bottom = fill(bottom); src = top + bottom; }
      else if (style === 'caption' || style === 'pov' || style === 'isthis') { const t = pick(T); p.text = fill(t); src = t; if (style === 'pov') { p.top = p.text; } if (style === 'isthis') p.label = 'me'; }
      else if (style === 'post' || style === 'quotecard') { p.text = q.text.replace(/^"|"$/g, ''); p.author = q.author; src = '{quote}'; }
      else if (style === 'chyron') { p.text = factLower; p.ticker = [f2, f3].filter(Boolean).map((x) => short(x.title).toUpperCase()).join(' · '); src = '{fact}'; }
      else if (style === 'twopanel') { p.a = pick(T.boring); p.b = fill(pick(T.weird)); src = p.b; }
      else if (style === 'versus') { const [a, b] = pick(T); p.a = fill(a); p.b = fill(b); src = a + b; }
      else if (style === 'brain') { p.steps = pick(T).map(fill); src = '{title}'; }
      else if (style === 'starter') {
        const same = facts.filter((x) => x.sub === f?.sub).slice(fi % 50, (fi % 50) + 4);
        p.text = fill(pick(T)); p.labels = (same.length >= 4 ? same : [f, f2, f3, f4].filter(Boolean)).map((x) => short(x.title)); src = '{title}';
      }
      else if (style === 'labels') { p.labels = pick(T).map(fill); src = '{title}'; }
      // the send button opens what the meme is about
      if (usesQuote(src)) { p.wiki = authorUrl(q.author); p.ref = q.author; }
      else if (f) { p.wiki = f.url; p.ref = short(f.title); }
      p.id = `mc${hashStr(style + p.img + (p.text || p.top || p.a || p.ref || '')).toString(36)}`;
      if (!posts.some((x) => x.id === p.id)) posts.push(p);
    }
    report.sources.memesBuilt = posts.length;
    report.memeStyles = posts.reduce((m, p) => ((m[p.style] = (m[p.style] || 0) + 1), m), {});
    return shuffle(posts);
  }

  // ------------------------------------------------------------------ surreal comic strips: odd thinkers talk past each other in their own (Wikiquote) words
  async function buildStrips(quotes, commons, n) {
    const S = config.strips || {}, byAuthor = {};
    for (const q of quotes) if (q.text.length >= 25 && q.text.length <= 150) (byAuthor[q.author] ||= []).push(q.text.replace(/^"|"$/g, ''));
    const cast = Object.keys(byAuthor).filter((a) => byAuthor[a].length >= 3);
    if (cast.length < 2 || !n) return [];
    const portraits = {};
    if (!OFFLINE) for (let i = 0; i < cast.length; i += 20) {
      try {
        const j = await fetchJSON(wq({ action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '240', pilimit: '20', redirects: '1', titles: cast.slice(i, i + 20).join('|') }));
        const back = {}; for (const r of [...(j.query?.normalized || []), ...(j.query?.redirects || [])]) back[r.to] = back[r.from] || r.from;
        for (const pg of j.query?.pages || []) if (pg.thumbnail?.source) portraits[back[pg.title] || pg.title] = pg.thumbnail.source;
      } catch (e) { warn(`strip portraits: ${e.message}`); }
    }
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = pick(cast); let b = pick(cast), g = 0; while (b === a && g++ < 10) b = pick(cast);
      const qa = shuffle([...byAuthor[a]]), qb = shuffle([...byAuthor[b]]);
      const bgs = Array.from({ length: 4 }, () => pick(commons)?.img).filter(Boolean);
      const panels = [{ who: 0, say: qa[0] }, { who: 1, say: qb[0] }, { event: pick(S.events || ['Something strange happens.']) }, rand() < 0.75 ? { who: rand() < 0.5 ? 0 : 1, say: rand() < 0.5 ? qa[1] : qb[1] } : { who: 1, say: pick(S.sfx || ['…']) }];
      const theme = pick(S.themes || ['the void']);
      out.push({ id: `ms${hashStr(a + b + qa[0] + qb[0]).toString(36)}`, cat: 'meme', sub: 'strip', style: 'strip', title: `${a} and ${b} on ${theme}`, cast: [{ name: a, img: portraits[a] }, { name: b, img: portraits[b] }], panels, imgs: bgs, wiki: `https://en.wikiquote.org/wiki/${encodeURIComponent(a.replace(/ /g, '_'))}`, ref: `${a} & ${b}`, credit: 'Words from Wikiquote · pictures from Wikimedia Commons' });
    }
    report.sources.strips = out.length;
    return out;
  }

  return { buildMemes, buildStrips };
}
