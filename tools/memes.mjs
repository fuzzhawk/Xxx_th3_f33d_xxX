// Package builder: memes. Built from the helpers and state that build-package.mjs passes in.
import { offlineQuotes } from './data/memes-data.mjs';

// Subjects shared by memes (to keep text, facts and pictures on one idea) and strips (to find authors who speak to each other).
const SUBJECTS = {
  death: /\b(death|die[sd]?|dying|dead|graves?|mortal\w*|corpses?|funeral|kill\w*|perish\w*|ghosts?|seance|skull|anatom\w*|spirit)\b/i,
  love: /\b(love[sd]?|lovers?|beloved|hearts?|desire|kiss\w*|passion|romance|marriage)\b/i,
  time: /\b(time|hours?|years?|moments?|eternity|clocks?|past|future|forever|history|centur\w+|chronicle)\b/i,
  god: /\b(gods?|divine|heaven|holy|souls?|prayer|faith|religio\w*|devil|angels?|sacred|codex|manuscript|alchem\w*|bosch|fludd|bestiary|medieval|church|myth\w*)\b/i,
  art: /\b(art|artists?|paint\w*|poems?|poetry|music|beauty|beautiful|songs?|novel|engraving|illustration|portrait|sculpt\w*|theatre|film|haeckel|grandville|dor[eé])\b/i,
  money: /\b(money|rich|poor|wealth\w*|gold|price|pay|cost|buy|sell|markets?|debt|profit|advertisement|bank|trade)\b/i,
  madness: /\b(mad|madness|insane|crazy|fools?|folly|sane|lunatic|absurd\w*|circus|robot)\b/i,
  dreams: /\b(dreams?|dreamt|sleep\w*|asleep|nightmares?|awake|visions?|imagin\w+|flammarion|surreal)\b/i,
  cities: /\b(city|cities|streets?|town|crowds?|urban|roads?|colony|aviation|soviet|architecture|building)\b/i,
  animals: /\b(animals?|dogs?|cats?|birds?|beasts?|horses?|fish|wolf|wolves|apes?|monkeys?|bees?|snakes?|fox|cows?|owls?|goats?|capybara|frogs?|raccoons?|opossum|crows?|taxidermy|species|mammals?)\b/i,
  self: /\b(myself|himself|oneself|herself|self|ego|identity|my own|mind|conscious\w*|alone|soul)\b/i,
  language: /\b(words?|language|speak\w*|speech|silence|tongue|sentences?|alphabet|letters?|grammar|translat\w*)\b/i,
  war: /\b(wars?|battles?|soldiers?|peace|enem(?:y|ies)|armies|army|fight\w*|weapons?|conquer\w*)\b/i,
  truth: /\b(truths?|lies|lie|false\w*|knowledge|wisdom|learn\w*|ignorance|reason|science|scientific|theory|mystery)\b/i,
  freedom: /\b(free|freedom|liberty|slave\w*|chains|power|laws?|govern\w*|states?|politic\w*|revolution)\b/i,
  nature: /\b(nature|trees?|sea|river|earth|sky|sun|moon|forest|gardens?|stars?|ocean|mountains?|plants?|flowers?|rain)\b/i,
  work: /\b(work\w*|labou?r|jobs?|idle|lazy|busy|toil|factory|machines?|computer|invent\w+)\b/i
};
const SUBJECT_LABEL = { death: 'death', love: 'love', time: 'time', god: 'God', art: 'art', money: 'money', madness: 'madness', dreams: 'dreams', cities: 'cities', animals: 'animals', self: 'the self', language: 'language', war: 'war', truth: 'truth', freedom: 'freedom', nature: 'nature', work: 'work' };
const themesOf = (t) => Object.keys(SUBJECTS).filter((k) => SUBJECTS[k].test(t));
const overlap = (a, b) => a.reduce((n, x) => n + (b.includes(x) ? 1 : 0), 0);
const keyWords = (t) => new Set(String(t).toLowerCase().match(/[a-z]{5,}/g) || []);
const sharedWords = (a, b) => { const A = keyWords(a); let n = 0; for (const w of keyWords(b)) if (A.has(w)) n++; return n; };
const fileName = (link) => { try { return decodeURIComponent(String(link || '').split(/File:/)[1] || '').replace(/[_.]/g, ' '); } catch { return ''; } };
const trunc = (t, n) => { t = String(t); if (t.length <= n) return t; const c = t.slice(0, n).replace(/\s+\S*$/, ''); return `${c}…`; };

// Placeholder pictures for offline builds (no internet in tests): one tinted SVG per image query.
function offlineCommons(config) {
  const qs = (config.memeImageQueries || ['owl photograph']).slice(0, 24);
  return qs.map((q, i) => ({ img: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${320 + (i % 3) * 60}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${i * 47 % 360},45%,62%)"/><stop offset="1" stop-color="hsl(${(i * 47 + 70) % 360},50%,22%)"/></linearGradient></defs><rect width="480" height="500" fill="url(#g)"/><circle cx="${140 + i * 13 % 200}" cy="150" r="${50 + i % 5 * 12}" fill="hsl(${i * 47 % 360},60%,80%)" opacity=".7"/><text x="20" y="300" font-family="serif" font-size="26" fill="#fff">${q}</text></svg>`)}`, link: `https://commons.wikimedia.org/wiki/File:${q.replace(/ /g, '_')}_${i}.jpg`, credit: 'Offline placeholder', q }));
}

export function memesBuilder(K) {
  const { OFFLINE, config, fetchJSON, hashStr, id, memeImageCount, memeText, memeWeights, pick, rand, report, shuffle, topics, want, warn, wq } = K;
  const sample = (arr, k = 40) => (arr.length <= k ? arr : Array.from({ length: k }, () => arr[Math.floor(rand() * arr.length)]));
  const bestBy = (arr, score, k = 40) => { let best, bs = -Infinity; for (const x of sample(arr, k)) { const sc = score(x) + rand() * 0.6; if (sc > bs) { bs = sc; best = x; } } return best; };
  const imgText = (im) => (im._t ||= `${im.q || ''} ${fileName(im.link)}`);

  function buildMemes(quotes, wiki, commons, kym) {
    if (OFFLINE && !commons.length) commons = offlineCommons(config);
    const posts = [];
    const kymN = Math.min(kym.length, Math.round(want.meme * 0.25));
    for (const k of kym.slice(0, kymN)) posts.push({ id: `mk${hashStr(k.link).toString(36)}`, cat: 'meme', sub: 'kym', style: 'kym', img: k.img, title: k.title, link: k.link, credit: 'via Know Your Meme' });
    const shortQ = shuffle(quotes.filter((q) => q.text.length < 150));
    const facts = shuffle(wiki.filter((w) => w.hook.length < 170));
    const topicLabel = Object.fromEntries(Object.entries(topics.wiki).map(([k, t]) => [k, t.label]));
    const bySub = {}; for (const f of facts) (bySub[f.sub] ||= []).push(f);
    const used = new Map();
    let fi = 0;
    const nextF = () => facts[fi++ % Math.max(1, facts.length)];
    const styles = Object.entries(memeWeights);
    const total = styles.reduce((s2, [, w]) => s2 + w, 0);
    const pickStyle = () => { let x = rand() * total; for (const [k, w] of styles) { x -= w; if (x <= 0) return k; } return 'caption'; };
    const authorUrl = (a) => `https://en.wikipedia.org/wiki/${encodeURIComponent(a.replace(/ /g, '_'))}`;
    const short = (t) => t.replace(/ \(.*\)$/, '');
    const factText = (f) => (f ? `${f.title} ${f.hook}` : '');
    // same topic as f, scored by shared themes and words with the lead material
    const relatedFact = (f, not, lead) => bestBy((bySub[f?.sub] || facts).filter((x) => !not.includes(x)), (x) => overlap(themesOf(factText(x)), themesOf(lead)) * 2 + sharedWords(factText(x), lead));
    const imageFor = (text) => { const th = themesOf(text); const im = bestBy(commons, (x) => overlap(themesOf(imgText(x)), th) * 3 + sharedWords(imgText(x), text) * 2 - (used.get(x.img) || 0) * 2, 60); used.set(im.img, (used.get(im.img) || 0) + 1); return im; };
    const yearOf = (t) => (String(t).match(/\b(1[0-9]{3}|20[0-2][0-9])\b/) || [])[1];
    let guard = 0;
    while (posts.length < want.meme && commons.length && guard++ < want.meme * 20) {
      const style = pickStyle();
      const f = nextF();
      const fT = factText(f);
      // a quote on the same subject as the fact (falls back to any short quote)
      const q = shortQ.length ? bestBy(shortQ, (x) => overlap(themesOf(x.text), themesOf(fT)) * 2 + sharedWords(x.text, fT) * 2) : { text: 'Only the madman is absolutely sure.', author: 'Robert Anton Wilson' };
      const lead = `${fT} ${q.text}`;
      const f2 = relatedFact(f, [f], lead), f3 = relatedFact(f, [f, f2], lead), f4 = relatedFact(f, [f, f2, f3], lead);
      const usesQuote = (s3) => /\{quote|\{author|quoteA/.test(s3);
      const factLower = f ? f.hook.replace(/\.$/, '').replace(/^(\S)/, (c) => (/^[A-Z][a-z]+ [a-z]/.test(f.hook) ? c.toLowerCase() : c)) : 'nothing is true';
      const words = q.text.split(' '), half = Math.ceil(words.length / 2);
      const fill = (t) => String(t).replace(/\{TITLE\}/g, f ? short(f.title).toUpperCase() : 'THIS').replace(/\{title\}/g, f ? short(f.title) : 'this').replace(/\{title2\}/g, f2 ? short(f2.title) : 'that')
        .replace(/\{title3\}/g, f3 ? short(f3.title) : 'the other thing').replace(/\{fact\}/g, factLower).replace(/\{quoteA\}/g, words.slice(0, half).join(' ')).replace(/\{quoteB\}/g, words.slice(half).join(' '))
        .replace(/\{quote\}/g, q.text.replace(/^"|"$/g, '')).replace(/\{author\}/g, q.author).replace(/\{topic\}/g, f ? topicLabel[f.sub] || 'Wikipedia' : 'Wikipedia');
      // pictures follow the material: per-slot text for multi-image formats, otherwise the fact + quote
      const slotText = { venn: [factText(f), factText(f2)], triptych: [factText(f), factText(f2), factText(f3)], starter: [f, f2, f3, f4].map(factText), brain: [f, f2, f3, f4].map(factText), twopanel: [fT, fT], versus: [factText(f), factText(f2)] }[style] || [lead];
      const n = memeImageCount[style] || 1;
      const imgs = Array.from({ length: n }, (_, k) => imageFor(slotText[k % slotText.length]));
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
        p.text = fill(pick(T)); p.labels = [f, f2, f3, f4].filter(Boolean).map((x) => short(x.title)); src = '{title}';
      }
      else if (style === 'labels') { p.labels = pick(T).map(fill); src = '{title}'; }
      else if (style === 'venn') { p.a = short(f.title); p.b = short(f2.title); p.mid = fill(pick(T.mids)); p.text = `${p.a} / ${p.b}`; src = '{title}'; }
      else if (style === 'nobody') { p.lines = pick(T).map((l) => trunc(fill(l), 90)); p.text = p.lines.join(' '); src = pick(['{title}', '{fact}']) ; if (p.lines.some((l) => /“|"/.test(l))) src = '{quote}'; }
      else if (style === 'placard') {
        const yr = yearOf(f.hook); p.title = short(f.title); p.date = yr ? `${pick(['c. ', '', 'dated '])}${yr}` : `c. ${1400 + Math.floor(rand() * 520)}`;
        p.medium = pick(T.media); p.desc = trunc(f.hook, 170); p.gift = `Gift of ${short(f2.title)}`; p.text = p.title; src = '{title}';
      }
      else if (style === 'wanted') {
        const byQuote = rand() < 0.4; p.name = byQuote ? q.author : short(f.title); p.crime = trunc(fill(pick(T.crimes)), 80); p.reward = fill(pick(T.rewards)); p.text = `WANTED: ${p.name}`; src = byQuote ? '{author}' : '{title}';
      }
      else if (style === 'align') {
        const [cols, rows] = pick(T); const cells = [f, f2, f3, f4];
        for (const x of shuffle(bySub[f.sub] || facts)) if (cells.length < 9 && !cells.includes(x)) cells.push(x);
        for (const x of facts) if (cells.length < 9 && !cells.includes(x)) cells.push(x);
        p.cols = cols; p.rows = rows; p.cells = shuffle(cells).slice(0, 9).map((x) => trunc(short(x.title), 28)); p.text = `${topicLabel[f.sub] || 'Wikipedia'} alignment chart`; src = '{title}';
      }
      else if (style === 'flow') { const [a, b, c, d] = pick(T).map((x) => trunc(fill(x), 70)); Object.assign(p, { start: a, q: b, yes: c, no: d, text: a }); src = '{title}'; }
      else if (style === 'graph') { const [t, xl, yl, shape, note] = pick(T); Object.assign(p, { text: fill(t), xl, yl, shape, note: trunc(fill(note), 40) }); src = '{title}'; }
      else if (style === 'triptych') { const [h, ...caps] = pick(T).map((x) => trunc(fill(x), 40)); p.text = h; p.caps = caps; src = '{title}'; }
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

  // ------------------------------------------------------------------ comic strips: authors talk about one subject, in their own (Wikiquote) words
  async function buildStrips(quotes, commons, n) {
    const S = config.strips || {};
    if (OFFLINE) { if (!commons.length) commons = offlineCommons(config); quotes = [...quotes, ...offlineQuotes.map(([author, text]) => ({ author, text }))]; }
    // subject -> author -> short quotes touching it
    const bySubj = {}, seenQ = new Set();
    for (const q of quotes) {
      const text = q.text.replace(/^"|"$/g, '').trim();
      if (text.length < 25 || text.length > 125 || seenQ.has(text)) continue; seenQ.add(text);
      for (const k of themesOf(text)) ((bySubj[k] ||= {})[q.author] ||= []).push(text);
    }
    const subjects = shuffle(Object.keys(bySubj).filter((k) => Object.values(bySubj[k]).filter((a) => a.length >= 2).length >= 2));
    if (!subjects.length || !n) return [];
    const plans = [], usedText = new Set();
    for (let k = 0; plans.length < n && k < n * 6; k++) {
      const subj = subjects[k % subjects.length], pool = bySubj[subj];
      const eligible = Object.keys(pool).filter((a) => pool[a].filter((t) => !usedText.has(t)).length >= 2);
      if (eligible.length < 2) continue;
      const trio = rand() < 0.25 && eligible.length >= 3;
      const cast = shuffle(eligible).slice(0, trio ? 3 : 2);
      const lines = Object.fromEntries(cast.map((a) => [a, shuffle(pool[a].filter((t) => !usedText.has(t))).slice(0, 3).sort((x, y) => x.length - y.length).slice(0, 2)]));
      // opener: a question if anyone has one; answers are statements; the shortest line closes
      const isQ = (t) => /\?/.test(t);
      const asker = cast.find((a) => lines[a].some(isQ)) || cast[0];
      const order = [asker, ...cast.filter((a) => a !== asker)];
      const take = (a, wantQ) => { const L = lines[a]; const i = L.findIndex((t) => isQ(t) === wantQ); return L.splice(i < 0 ? 0 : i, 1)[0]; };
      const seq = [{ a: asker, t: take(asker, true) }];
      for (const a of order.slice(1)) seq.push({ a, t: take(a, false) });
      while (seq.length < 4) { const last = seq[seq.length - 1].a, nx = order.find((a) => a !== last && lines[a].length) || order.find((a) => lines[a].length); if (!nx) break; seq.push({ a: nx, t: lines[nx].shift() }); }
      if (seq.length < 4 || new Set(seq.map((x) => x.t)).size < 4) continue;
      seq.forEach((x) => usedText.add(x.t));
      plans.push({ subj, cast, seq });
    }
    if (!plans.length) return [];
    const portraits = {};
    const names = [...new Set(plans.flatMap((p) => p.cast))];
    if (!OFFLINE) for (let i = 0; i < names.length; i += 20) {
      try {
        const j = await fetchJSON(wq({ action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '240', pilimit: '20', redirects: '1', titles: names.slice(i, i + 20).join('|') }));
        const back = {}; for (const r of [...(j.query?.normalized || []), ...(j.query?.redirects || [])]) back[r.to] = back[r.from] || r.from;
        for (const pg of j.query?.pages || []) if (pg.thumbnail?.source) portraits[back[pg.title] || pg.title] = pg.thumbnail.source;
      } catch (e) { warn(`strip portraits: ${e.message}`); }
    }
    const out = [];
    for (const pl of plans) {
      const label = SUBJECT_LABEL[pl.subj] || pl.subj;
      const th = pl.subj;
      const bgs = [];
      for (let i = 0; i < 4; i++) bgs.push(bestBy(commons.filter((c) => !bgs.includes(c.img)), (c) => (themesOf(imgText(c)).includes(th) ? 3 : 0), 50)?.img);
      const names2 = pl.cast.length === 3 ? `${pl.cast[0]}, ${pl.cast[1]} and ${pl.cast[2]}` : `${pl.cast[0]} and ${pl.cast[1]}`;
      const panels = pl.seq.map((x) => ({ who: pl.cast.indexOf(x.a), say: x.t }));
      out.push({ id: `ms${hashStr(pl.seq.map((x) => x.t).join('|')).toString(36)}`, cat: 'meme', sub: 'strip', style: 'strip', subject: label, title: `${names2} on ${label}`, cast: pl.cast.map((name) => ({ name, img: portraits[name] })), panels, imgs: bgs.filter(Boolean), wiki: `https://en.wikiquote.org/wiki/${encodeURIComponent(pl.cast[0].replace(/ /g, '_'))}`, ref: pl.cast.join(' & '), credit: 'Words from Wikiquote · pictures from Wikimedia Commons' });
    }
    report.sources.strips = out.length;
    return out;
  }

  return { buildMemes, buildStrips };
}
