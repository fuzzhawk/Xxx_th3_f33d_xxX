#!/usr/bin/env node
// Builds one weekly package for The Feed.
//
//   node tools/build-package.mjs [--id 2026-W43] [--offline] [--out packages]
//
// Network sources (Wikipedia, Wikiquote, YouTube, Hacker News, Substack, Reddit,
// Wikimedia Commons, Know Your Meme) are fetched here; each source fails soft so
// a blocked site shrinks its category instead of failing the build. The app
// rebalances the feed when a category is short.
//
// --offline skips the network and fills network categories with placeholder
// fixtures. It is only for testing the app locally; never commit its output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasTransparentEdges } from './png.mjs';
import { productClassics, productParts, selfCare, selfCareFlavors, fallbackQuotes, memeText, memeWeights, memeImageCount } from './data/content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const OFFLINE = !!args.offline;
const OUT = path.resolve(ROOT, args.out || 'packages');
const config = readJSON(path.join(ROOT, 'tools/data/config.json'));
const topics = readJSON(path.join(ROOT, 'tools/data/topics.json'));
const UA = 'TheFeedBuilder/0.1 (https://github.com/fuzzhawk/Xxx_th3_f33d_xxX; personal, non-commercial)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const id = args.id || isoWeekId(new Date());
const rand = mulberry32(hashStr(id));
const report = { sources: {}, warnings: [] };

// ------------------------------------------------------------------ helpers
function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
  }
  return o;
}
function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { if (fallback !== undefined) return fallback; throw e; }
}
function writeJSON(p, v, pretty = false) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, pretty ? 2 : 0) + '\n');
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function isoWeekId(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...m) { console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...m); }
function warn(m) { report.warnings.push(m); console.warn('WARN', m); }

async function fetchText(url, { headers = {}, timeout = 20000, retries = 4, ua = UA } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.8', ...headers }, signal: ctl.signal, redirect: 'follow' });
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { retry: true, wait: (+res.headers.get('retry-after') || 0) * 1000 });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return await res.text();
    } catch (e) {
      if (attempt >= retries || (e.status && !e.retry)) throw e;
      await sleep(Math.max(e.wait || 0, (e.retry ? 4000 : 800) * 2 ** attempt));
    } finally { clearTimeout(timer); }
  }
}
const fetchJSON = async (url, opts) => JSON.parse(await fetchText(url, opts));

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = undefined; } }
  }));
  return out;
}
function decodeEntities(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
const stripTags = (s) => decodeEntities(s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<sup[\s\S]*?<\/sup>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
function clip(s, n) {
  if (!s || s.length <= n) return s;
  const cut = s.slice(0, n);
  const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return cut.slice(0, at > n * 0.6 ? at : n).replace(/[,;:\s]+$/, '') + '…';
}

// Sentence splitter that tolerates initials ("J. G. Ballard") and common abbreviations.
const ABBR = new Set(['st', 'dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'vs', 'no', 'vol', 'ca', 'c', 'mt', 'ft', 'inc', 'ltd', 'co', 'gen', 'col', 'rev', 'prof', 'fr', 'op', 'u.s', 'u.k', 'e.g', 'i.e', 'etc', 'al', 'approx', 'ad', 'bc']);
function sentences(text) {
  const out = [];
  let start = 0;
  const re = /[.!?]["”’)]*\s+(?=[A-Z0-9"“‘(])/g;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(start, m.index + 1);
    const word = (before.match(/([A-Za-z.]+)\.$/) || [])[1] || '';
    const w = word.toLowerCase().replace(/\.$/, '');
    if (w.length === 1 || ABBR.has(w)) continue;
    out.push(text.slice(start, m.index + m[0].trimEnd().length).trim());
    start = m.index + m[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}
const stripParens = (s) => { let prev; do { prev = s; s = s.replace(/\s*\([^()]*\)/g, ''); } while (s !== prev); return s.replace(/\s+([,.;])/g, '$1'); };
function cleanExtract(s) {
  return s.replace(/\s*\([^()]*(?:listen|pronounced|IPA|\[|;|[A-Z][a-z]+:)[^()]*\)/g, '')
    .replace(/\(\s*[;,]\s*/g, '(').replace(/\(\s*\)/g, '').replace(/\s+([,.;])/g, '$1').replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------------ history (no repeats across packages)
const historyPath = path.join(OUT, 'history.json');
const history = readJSON(historyPath, { wiki: [], video: [], web: [], memeImg: [], kym: [], product: [], news: [] });
history.news ||= [];
if (args.id && !OFFLINE) {
  const old = path.join(OUT, args.id);
  const rd = (f) => readJSON(path.join(old, f), []);
  if (fs.existsSync(old)) {
    const drop = { wiki: rd('wiki.json').map((p) => p.id.slice(1)), video: rd('video.json').map((p) => p.vid), web: rd('web.json').map((p) => p.url),
      memeImg: rd('meme.json').map((p) => p.img), kym: rd('meme.json').map((p) => p.link), product: rd('product.json').map((p) => p.name) };
    for (const [k, v] of Object.entries(drop)) { const d = new Set(v); history[k] = (history[k] || []).filter((x) => !d.has(x)); }
    console.log(`Rebuilding ${args.id}: its previous posts are allowed again`);
  }
}
const seen = Object.fromEntries(Object.entries(history).map(([k, v]) => [k, new Set(v)]));

// ------------------------------------------------------------------ counts
const cats = config.categories;
const avgDwell = Object.values(cats).reduce((s, c) => s + (c.pct / 100) * c.dwellSec, 0);
const totalPosts = Math.round((config.targetHoursPerDay * config.days * 3600) / avgDwell * config.buffer);
const want = Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, Math.round(totalPosts * c.pct / 100)]));
log(`Package ${id}: target ${totalPosts} posts`, want);

// ------------------------------------------------------------------ Wikipedia
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const wq = (params) => `${WIKI_API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;

async function categoryMembers(cat, depth = 1) {
  const titles = [];
  try {
    const j = await fetchJSON(wq({ action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmlimit: '200', cmtype: 'page|subcat' }));
    const subs = [];
    for (const m of j.query?.categorymembers || []) {
      if (m.ns === 0) titles.push(m.title);
      else if (m.ns === 14) subs.push(m.title.replace(/^Category:/, ''));
    }
    await sleep(150);
    if (depth > 0) for (const s of shuffle(subs).slice(0, 5)) titles.push(...await categoryMembers(s, depth - 1));
  } catch (e) { warn(`wiki category ${cat}: ${e.message}`); }
  return titles;
}
async function moreLike(title) {
  try {
    const j = await fetchJSON(wq({ action: 'query', list: 'search', srsearch: `morelike:${title}`, srlimit: '15', srnamespace: '0', srprop: '' }));
    return (j.query?.search || []).map((r) => r.title);
  } catch (e) { return []; }
}
async function extracts(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    try {
      const j = await fetchJSON(wq({ action: 'query', prop: 'extracts|pageprops|pageimages|info', exintro: '1', explaintext: '1', exsentences: '6', exlimit: '20',
        piprop: 'thumbnail', pithumbsize: '480', pilimit: '20', ppprop: 'disambiguation', inprop: 'url', redirects: '1', titles: batch.join('|') }));
      out.push(...(j.query?.pages || []));
    } catch (e) { warn(`wiki extracts batch ${i}: ${e.message}`); }
    await sleep(60);
  }
  return out;
}

async function buildWiki() {
  const topicKeys = Object.keys(topics.wiki);
  const perTopic = Math.ceil(want.wiki / topicKeys.length);
  const claimed = new Set();
  const posts = [];
  for (const key of topicKeys) {
    const t = topics.wiki[key];
    log(`wiki: ${key}`);
    const cand = new Set(t.seeds);
    const catLists = await pool(t.categories, 2, (c) => categoryMembers(c));
    catLists.forEach((l) => (l || []).forEach((x) => cand.add(x)));
    const likeLists = await pool(shuffle([...t.seeds]).slice(0, 30), 2, moreLike);
    likeLists.forEach((l) => (l || []).forEach((x) => cand.add(x)));
    const seeds = new Set(t.seeds);
    const relevant = t.keywords ? new RegExp(t.keywords, 'i') : null;
    const order = [...cand].filter((x) => !/^(List|Lists|Outline|Index|Timeline|Glossary) of /.test(x) && !/^\d{3,4}s?( in .*)?$/.test(x));
    // seeds first (shuffled), then the rest (shuffled), capped to keep request count sane
    const ordered = [...shuffle(order.filter((x) => seeds.has(x))), ...shuffle(order.filter((x) => !seeds.has(x)))].slice(0, perTopic * 2.2);
    const pages = await extracts(ordered);
    let n = 0;
    for (const p of pages) {
      if (n >= perTopic) break;
      if (!p || p.missing || p.pageprops?.disambiguation !== undefined) continue;
      const pid = String(p.pageid);
      if (claimed.has(pid) || seen.wiki.has(pid)) continue;
      const ex = cleanExtract((p.extract || '').replace(/\n+/g, ' '));
      if (ex.length < 160) continue;
      const ss = sentences(ex).slice(0, 5);
      if (ss.length < 2) continue;
      if (relevant && !seeds.has(p.title) && !relevant.test(ss.join(' '))) continue;
      claimed.add(pid);
      posts.push({
        id: `w${pid}`, cat: 'wiki', sub: key, title: p.title,
        hook: clip(stripParens(ss[0]), 190), summary: ss.join(' '),
        url: p.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
        thumb: p.thumbnail?.source || undefined
      });
      n++;
    }
    log(`wiki: ${key} -> ${n} (${cand.size} candidates)`);
  }
  report.sources.wikipedia = posts.length;
  return posts;
}

// ------------------------------------------------------------------ Wikiquote
async function buildQuotes() {
  const quotes = [];
  await pool(config.quoteAuthors, 4, async (author) => {
    try {
      const j = await fetchJSON(`https://en.wikiquote.org/w/api.php?${new URLSearchParams({ action: 'parse', page: author, prop: 'text', redirects: '1', format: 'json', formatversion: '2' })}`);
      const got = parseWikiquote(j.parse?.text || '');
      got.forEach((q) => quotes.push({ author, text: q }));
      log(`quotes: ${author} -> ${got.length}`);
    } catch (e) { warn(`wikiquote ${author}: ${e.message}`); }
  });
  report.sources.wikiquote = quotes.length;
  if (quotes.length < 40) fallbackQuotes.forEach(([author, text]) => quotes.push({ author, text }));
  return quotes;
}
function parseWikiquote(html) {
  const STOP = /misattributed|disputed|about |quotes about|external links|see also|sources|references|attributed|notes/i;
  const tagRe = /<(\/?)(ul|li|h2)\b[^>]*>/gi;
  let depth = 0, inLi = false, liStart = 0, stopped = false;
  const out = [];
  let m, lastH2 = -1;
  while ((m = tagRe.exec(html))) {
    const [full, close, tag] = m;
    const t = tag.toLowerCase();
    if (t === 'h2' && !close) { lastH2 = m.index; continue; }
    if (t === 'h2' && close) {
      const title = stripTags(html.slice(lastH2, m.index));
      stopped = STOP.test(title);
      continue;
    }
    if (stopped) continue;
    if (t === 'ul') {
      if (!close) { if (inLi && depth === 1) { push(html.slice(liStart, m.index)); inLi = false; } depth++; }
      else depth = Math.max(0, depth - 1);
    } else if (t === 'li' && depth === 1) {
      if (!close) { inLi = true; liStart = m.index + full.length; }
      else if (inLi) { push(html.slice(liStart, m.index)); inLi = false; }
    }
  }
  function push(frag) {
    const s = stripTags(frag).replace(/\s*\[\d+\]/g, '');
    if (s.length >= 25 && s.length <= 230 && !/^(p\.|pp\.|chapter|page|as quoted|source|vol)/i.test(s) && !/https?:/.test(s)) out.push(s);
  }
  return [...new Set(out)];
}

// ------------------------------------------------------------------ YouTube
async function ytSearch(query) {
  const url = `https://www.youtube.com/results?${new URLSearchParams({ search_query: query, sp: 'EgIYAQ==' })}`;
  const html = await fetchText(url, { ua: BROWSER_UA, headers: { Cookie: 'CONSENT=YES+cb; SOCS=CAI' } });
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) || html.match(/ytInitialData"\]\s*=\s*(\{[\s\S]*?\});/);
  if (!m) throw new Error('no ytInitialData');
  const data = JSON.parse(m[1]);
  const found = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o.videoRenderer?.videoId) {
      const v = o.videoRenderer;
      found.push({ vid: v.videoId, title: v.title?.runs?.map((r) => r.text).join('') || '', channel: v.ownerText?.runs?.[0]?.text || '', dur: v.lengthText?.simpleText || '' });
      return;
    }
    if (o.reelItemRenderer?.videoId) {
      found.push({ vid: o.reelItemRenderer.videoId, title: o.reelItemRenderer.headline?.simpleText || '', channel: '', dur: '', short: true });
      return;
    }
    const sl = o.shortsLockupViewModel;
    if (sl) {
      const vid = sl.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
      if (vid) found.push({ vid, title: sl.overlayMetadata?.primaryText?.content || '', channel: '', dur: '', short: true });
      return;
    }
    for (const k in o) walk(o[k]);
  })(data);
  return found;
}
function durSec(d) { if (!d) return 0; return d.split(':').reduce((s, x) => s * 60 + (+x || 0), 0); }
// Checks that a video plays embedded and is not blocked in config.videoRegion
// (YouTube's own watch-page data); falls back to oEmbed when the page can't be read.
async function playable(vid) {
  const region = config.videoRegion;
  try {
    const html = await fetchText(`https://www.youtube.com/watch?v=${vid}&hl=en`, { ua: BROWSER_UA, headers: { Cookie: 'CONSENT=YES+cb; SOCS=CAI' }, retries: 1, timeout: 15000 });
    const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\})\s*;\s*(?:var\s|<\/script>)/);
    if (m) {
      const pr = JSON.parse(m[1]);
      const ps = pr.playabilityStatus || {};
      if (ps.status && ps.status !== 'OK') return null;
      if (ps.playableInEmbed === false) return null;
      const countries = pr.microformat?.playerMicroformatRenderer?.availableCountries;
      if (region && Array.isArray(countries) && countries.length && !countries.includes(region)) { report.regionBlocked = (report.regionBlocked || 0) + 1; return null; }
      return { title: pr.videoDetails?.title, author_name: pr.videoDetails?.author };
    }
  } catch { /* fall through */ }
  try {
    const j = await fetchJSON(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${vid}`)}&format=json`, { retries: 1, timeout: 10000 });
    return j && j.title ? j : null;
  } catch { return null; }
}
async function buildVideos() {
  const groups = topics.video;
  const totalW = Object.values(groups).reduce((s, g) => s + g.weight, 0);
  const posts = [];
  const taken = new Set();
  for (const [key, g] of Object.entries(groups)) {
    const quota = Math.round(want.video * g.weight / totalW);
    const lists = await pool(g.queries, 2, async (q) => { await sleep(700); return ytSearch(q); });
    const failures = lists.filter((l) => !l).length;
    if (failures) warn(`youtube ${key}: ${failures}/${g.queries.length} searches failed`);
    // interleave query results so one query cannot dominate
    const cand = [];
    const maxLen = Math.max(0, ...lists.map((l) => (l || []).length));
    for (let i = 0; i < maxLen; i++) for (const l of lists) if (l && l[i]) cand.push(l[i]);
    const fresh = cand.filter((v) => !taken.has(v.vid) && !seen.video.has(v.vid) && (!v.dur || durSec(v.dur) <= 600));
    const kw = g.keywords ? new RegExp(g.keywords, 'i') : null;
    const dedup = [...new Map(fresh.map((v) => [v.vid, v])).values()];
    const ranked = kw ? [...dedup.filter((v) => kw.test(v.title)), ...dedup.filter((v) => !kw.test(v.title))] : dedup;
    const uniq = ranked.slice(0, Math.ceil(quota * 1.4));
    const checks = await pool(uniq, 5, (v) => playable(v.vid));
    let n = 0;
    uniq.forEach((v, i) => {
      if (n >= quota || !checks[i]) return;
      taken.add(v.vid);
      posts.push({ id: `v${v.vid}`, cat: 'video', sub: key, vid: v.vid, title: v.title || checks[i].title, channel: v.channel || checks[i].author_name || '', dur: v.dur || '', short: !!v.short || durSec(v.dur) <= 75 });
      n++;
    });
    log(`video: ${key} -> ${n}/${quota} (${cand.length} found)`);
  }
  report.sources.youtube = posts.length;
  return posts;
}

// ------------------------------------------------------------------ web (HN, sites, comics, Reddit)
async function ogMeta(url) {
  try {
    const html = await fetchText(url, { ua: BROWSER_UA, timeout: 10000, retries: 0 });
    const meta = (k) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)["']`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${k}["']`, 'i')) || [])[1];
    return { desc: meta('og:description') || meta('description') || meta('twitter:description'), image: meta('og:image') || meta('twitter:image'), html };
  } catch { return {}; }
}
// Parses RSS 2.0 and Atom into { title, link, html, date }.
function parseFeed(xml) {
  const unc = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const pick = (blk, t) => unc((blk.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`)) || [])[1]);
  const title = stripTags(unc((xml.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || ''));
  const items = [];
  const blocks = xml.includes('<entry') ? xml.split(/<entry[\s>]/).slice(1) : xml.split(/<item[\s>]/).slice(1);
  for (const b of blocks) {
    const link = stripTags(pick(b, 'link')) || (b.match(/<link[^>]+href=["']([^"']+)["']/) || [])[1] || stripTags(pick(b, 'guid'));
    items.push({
      title: stripTags(decodeEntities(pick(b, 'title'))),
      link: decodeEntities(link || ''),
      html: decodeEntities(pick(b, 'content:encoded') || pick(b, 'content') || pick(b, 'description') || pick(b, 'summary')),
      date: pick(b, 'pubDate') || pick(b, 'published') || pick(b, 'updated') || pick(b, 'dc:date')
    });
  }
  return { title, items };
}
const isoDate = (d) => { const t = new Date(d || ''); return isNaN(t) ? '' : t.toISOString().slice(0, 10); };
async function readFeed(f) {
  for (const url of f.urls) {
    try { const xml = await fetchText(url, { ua: BROWSER_UA, retries: 1 }); const parsed = parseFeed(xml); if (parsed.items.length) return parsed; }
    catch (e) { warn(`feed ${f.name} ${url}: ${e.message}`); }
  }
  return null;
}
function firstImg(html, base) {
  const m = (html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!m) return null;
  try { return new URL(decodeEntities(m[1]), base).href; } catch { return null; }
}
async function buildComics(w) {
  const out = [];
  await pool(w.comics, 3, async (f) => {
    const feed = await readFeed(f);
    if (!feed) return;
    let n = 0;
    for (const it of feed.items) {
      if (n >= f.max || !it.link) continue;
      let img = firstImg(it.html, it.link);
      if (!img || /feeds\.feedburner|gravatar|pixel|emoji|share|button/i.test(img)) {
        const page = await ogMeta(it.link);
        img = page.html ? (page.html.match(/<img[^>]+(?:id|class)=["'][^"']*(?:comic|strip|cc-comic)[^"']*["'][^>]*src=["']([^"']+)["']/i) || page.html.match(/<div[^>]+id=["'](?:comic|strip)[^"']*["'][\s\S]{0,400}?<img[^>]+src=["']([^"']+)["']/i) || [])[1] || page.image : null;
        if (img) try { img = new URL(decodeEntities(img), it.link).href; } catch { img = null; }
      }
      if (!img) continue;
      const alt = stripTags(it.html).slice(0, 220);
      out.push({ source: f.name, sub: 'comic', title: it.title || f.name, url: it.link, img, excerpt: alt && alt !== it.title ? clip(alt, 200) : '', date: isoDate(it.date), nsfw: f.nsfw || undefined });
      n++;
    }
    log(`comics: ${f.name} -> ${n}`);
  });
  // xkcd: random picks from the whole archive
  if (w.xkcdRandom) {
    try {
      const latest = (await fetchJSON('https://xkcd.com/info.0.json')).num;
      const nums = new Set();
      while (nums.size < w.xkcdRandom) nums.add(1 + Math.floor(rand() * latest));
      const got = await pool([...nums].filter((n) => n !== 404), 4, (n) => fetchJSON(`https://xkcd.com/${n}/info.0.json`));
      for (const x of got) if (x?.img) out.push({ source: 'xkcd', sub: 'comic', title: `${x.safe_title} (#${x.num})`, url: `https://xkcd.com/${x.num}/`, img: x.img, excerpt: x.alt, date: `${x.year}-${String(x.month).padStart(2, '0')}-${String(x.day).padStart(2, '0')}` });
      log(`comics: xkcd -> ${got.filter(Boolean).length}`);
    } catch (e) { warn(`xkcd: ${e.message}`); }
  }
  report.sources.comics = out.length;
  return out;
}
async function buildWeb() {
  const w = config.web;
  // Hacker News via Algolia
  const hnLists = await pool(w.hnQueries, 4, (q) => fetchJSON(`https://hn.algolia.com/api/v1/search?${new URLSearchParams({ query: q, tags: 'story', numericFilters: `points>${w.hnMinPoints}`, hitsPerPage: '20' })}`).then((j) => j.hits.map((h) => ({ q, h }))));
  const hn = [];
  hnLists.forEach((l) => (l || []).forEach(({ q, h }) => {
    if (!h.title) return;
    const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
    hn.push({ source: 'Hacker News', sub: 'hn', title: h.title, url, discuss: `https://news.ycombinator.com/item?id=${h.objectID}`, meta: `${h.points} points · ${h.num_comments || 0} comments`, date: h.created_at?.slice(0, 10), excerpt: h.story_text ? clip(stripTags(h.story_text), 320) : '', topic: q });
  }));
  report.sources.hackernews = hn.length;
  // Sites (RSS/Atom)
  const sites = [];
  const perSite = {};
  await pool(w.feeds, 4, async (f) => {
    const feed = await readFeed(f);
    if (!feed) return;
    for (const it of feed.items.slice(0, f.max)) {
      if (!it.title || !it.link) continue;
      const thumb = firstImg(it.html, it.link);
      sites.push({ source: f.name, sub: 'site', title: it.title, url: it.link, excerpt: clip(stripTags(it.html).replace(/^Link URL:\s*\S+\s*/i, '').replace(/\s*(Comments URL|Votes|Comments):.*$/i, ''), 320), date: isoDate(it.date), thumb: thumb && !/feedburner|gravatar|pixel|emoji|share/i.test(thumb) ? thumb : undefined });
      perSite[f.name] = (perSite[f.name] || 0) + 1;
    }
  });
  report.sources.sites = perSite;
  const comics = await buildComics(w);
  // Reddit (occasional; usually blocked from CI)
  const rd = [];
  await pool(w.subreddits, 2, async (s) => {
    try {
      const j = await fetchJSON(`https://www.reddit.com/r/${s}/top.json?t=month&limit=25&raw_json=1`, { retries: 0 });
      for (const c of j.data?.children || []) {
        const d = c.data;
        if (!d || d.over_18 || d.stickied || d.score < 100) continue;
        rd.push({ source: `r/${s}`, sub: 'reddit', title: d.title, url: `https://www.reddit.com${d.permalink}`, excerpt: clip((d.selftext || '').replace(/\s+/g, ' '), 320), meta: `${d.score} upvotes · ${d.num_comments} comments`, date: new Date(d.created_utc * 1000).toISOString().slice(0, 10) });
      }
    } catch (e) { warn(`reddit ${s}: ${e.message}`); }
  });
  report.sources.reddit = rd.length;

  const fresh = (l) => shuffle(l.filter((x) => !seen.web.has(x.url)));
  const comicN = Math.min(comics.length, Math.round(want.web * w.comicShare));
  const redditN = Math.min(rd.length, Math.round(want.web * w.redditShare));
  const siteN = Math.min(sites.length, Math.round((want.web - comicN - redditN) * 0.65));
  const chosen = [...fresh(comics).slice(0, comicN), ...fresh(rd).slice(0, redditN), ...fresh(sites).slice(0, siteN)];
  const urls = new Set(chosen.map((x) => x.url));
  for (const x of [...fresh(hn), ...fresh(sites), ...fresh(comics), ...fresh(rd)]) { if (chosen.length >= want.web) break; if (!urls.has(x.url)) { urls.add(x.url); chosen.push(x); } }
  const missing = chosen.filter((x) => !x.excerpt && x.sub !== 'comic' && !x.url.includes('news.ycombinator.com'));
  const metas = await pool(missing, 6, (x) => ogMeta(x.url));
  missing.forEach((x, i) => { if (metas[i]?.desc) x.excerpt = clip(decodeEntities(metas[i].desc), 320); });
  return chosen.map((x) => ({ id: `web${hashStr(x.url).toString(36)}`, cat: 'web', ...x }));
}

// ------------------------------------------------------------------ news (hidden from the main feed by default)
async function buildNews() {
  const out = [];
  const per = {};
  const jobs = Object.entries(config.news.groups).flatMap(([g, grp]) => grp.feeds.map(([name, url]) => ({ g, name, url })));
  await pool(jobs, 4, async (j) => {
    const feed = await readFeed({ name: j.name, urls: [j.url] });
    if (!feed) return;
    for (const it of feed.items.slice(0, config.news.maxPerFeed)) {
      if (!it.title || !it.link || seen.news?.has(it.link)) continue;
      // Google News titles end with " - Source"
      const title = j.url.includes('news.google.com') ? it.title.replace(/\s+-\s+[^-]+$/, '') : it.title;
      const thumb = firstImg(it.html, it.link);
      out.push({ id: `n${hashStr(it.link).toString(36)}`, cat: 'news', sub: j.g, source: j.name, title, url: it.link, excerpt: j.url.includes('news.google.com') ? '' : clip(stripTags(it.html), 320), date: isoDate(it.date), thumb: thumb && !/feedburner|gravatar|pixel|emoji|share/i.test(thumb) ? thumb : undefined });
      per[j.name] = (per[j.name] || 0) + 1;
    }
  });
  report.sources.news = per;
  // newest first
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// ------------------------------------------------------------------ game sprites (transparent PNGs from Commons)
async function buildSprites() {
  const out = [];
  const lists = await pool(config.spriteQueries, 3, async (q) => {
    try {
      const j = await fetchJSON(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${q} filemime:image/png`, gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '160', format: 'json', formatversion: '2' })}`);
      return (j.query?.pages || []).map((p) => ({ q, ii: p.imageinfo?.[0], title: p.title })).filter((x) => x.ii?.thumburl);
    } catch (e) { warn(`sprites ${q}: ${e.message}`); return []; }
  });
  const cand = shuffle(lists.flat().filter((x) => /public domain|cc0|cc[- ]by|pd/i.test(x.ii.extmetadata?.LicenseShortName?.value || '')));
  const perQuery = {};
  await pool(cand, 4, async (x) => {
    if (out.length >= config.spriteCount || (perQuery[x.q] || 0) >= 6) return;
    try {
      const r = await fetch(x.ii.thumburl, { headers: { 'User-Agent': UA } });
      if (!r.ok) return;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 60000 || buf.readUInt32BE(0) !== 0x89504e47) return;
      if (!hasTransparentEdges(buf)) return;
      perQuery[x.q] = (perQuery[x.q] || 0) + 1;
      out.push({ src: `data:image/png;base64,${buf.toString('base64')}`, name: x.title.replace(/^File:/, ''), credit: `${clip(stripTags(x.ii.extmetadata?.Artist?.value || 'Unknown'), 40)} · ${x.ii.extmetadata?.LicenseShortName?.value} · Wikimedia Commons` });
    } catch { /* skip */ }
  });
  report.sources.sprites = out.length;
  return out;
}

// ------------------------------------------------------------------ meme images
async function commonsImages() {
  const imgs = [];
  await pool(config.memeImageQueries, 4, async (q) => {
    try {
      const j = await fetchJSON(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '30', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '480', format: 'json', formatversion: '2' })}`);
      for (const p of j.query?.pages || []) {
        const ii = p.imageinfo?.[0];
        if (!ii?.thumburl || !/jpeg|png/.test(ii.mime || '') || ii.width < 300) continue;
        const lic = ii.extmetadata?.LicenseShortName?.value || '';
        if (!/public domain|cc0|cc[- ]by|pd/i.test(lic)) continue;
        imgs.push({ img: ii.thumburl, link: ii.descriptionurl, credit: `${clip(stripTags(ii.extmetadata?.Artist?.value || 'Unknown'), 50)} · ${lic} · Wikimedia Commons`, q, w: ii.thumbwidth, h: ii.thumbheight });
      }
    } catch (e) { warn(`commons ${q}: ${e.message}`); }
  });
  report.sources.commons = imgs.length;
  return shuffle([...new Map(imgs.map((x) => [x.img, x])).values()].filter((x) => !seen.memeImg.has(x.img)));
}
async function kymMemes() {
  const out = [];
  for (const url of config.knowYourMemeUrls) {
    try {
      const html = await fetchText(url, { ua: BROWSER_UA, retries: 1 });
      const re = /<img[^>]*?(?:data-src|src)="(https:\/\/i\.kym-cdn\.com\/(?:entries\/icons|photos\/images)\/[^"]+)"[^>]*?alt="([^"]*)"/g;
      let m;
      while ((m = re.exec(html))) {
        const back = html.slice(Math.max(0, m.index - 600), m.index);
        const href = [...back.matchAll(/href="(\/(?:memes|photos)\/[^"#?]+)"/g)].pop()?.[1];
        const title = decodeEntities(m[2]).trim();
        if (!title || !href) continue;
        out.push({ img: m[1].replace(/\/(?:newsfeed|square|masonry|list|small)\//, '/original/'), title, link: `https://knowyourmeme.com${href}` });
      }
      await sleep(1500);
    } catch (e) { warn(`knowyourmeme ${url}: ${e.message}`); }
  }
  report.sources.knowyourmeme = out.length;
  return shuffle([...new Map(out.map((x) => [x.link, x])).values()].filter((x) => !seen.kym.has(x.link)));
}

// ------------------------------------------------------------------ weathered texture photos (small, embedded)
async function buildTextures() {
  const out = [];
  await pool(config.textureQueries, 3, async (q) => {
    if (out.length >= config.textureCount) return;
    try {
      const cands = (await commonsSearch(q, 'filetype:bitmap', 6, 96)).filter((c) => /jpeg/.test(c.ii.mime || ''));
      for (const c of cands.slice(0, 2)) {
        const r = await fetch(c.ii.thumburl, { headers: { 'User-Agent': UA } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 14000) continue;
        out.push({ src: `data:image/jpeg;base64,${buf.toString('base64')}`, q, credit: c.ii.extmetadata?.LicenseShortName?.value });
        break;
      }
    } catch (e) { warn(`texture ${q}: ${e.message}`); }
  });
  report.sources.textures = out.length;
  return out;
}

// ------------------------------------------------------------------ game theme kits
const themeDefs = readJSON(path.join(ROOT, 'tools/data/themes.json')).themes;
const KENNEY_NAMES = { 'racing-pack': 'Grand Prix', 'alien-ufo-pack': 'UFO Invasion', 'tiny-dungeon': 'Dungeon Crawl', 'pixel-platformer': 'Pixel World', 'physics-assets': 'Alien Physics', 'shape-characters': 'Shape Folk', 'emotes-pack': 'Emote Storm', 'monster-builder-pack': 'Monster Builder', 'rolling-ball-assets': 'Marble Run', 'platformer-pack-redux': 'Townscape' };
async function commonsSearch(q, extra, limit, width) {
  const j = await fetchJSON(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${q} ${extra}`, gsrnamespace: '6', gsrlimit: String(limit), prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: String(width), format: 'json', formatversion: '2' })}`);
  return (j.query?.pages || []).map((p) => ({ title: p.title, ii: p.imageinfo?.[0] })).filter((x) => x.ii?.thumburl && /public domain|cc0|cc[- ]by|pd/i.test(x.ii.extmetadata?.LicenseShortName?.value || ''));
}
async function vetSprite(x) {
  try {
    const r = await fetch(x.ii.thumburl, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 90000 || !hasTransparentEdges(buf)) return null;
    return { src: x.ii.thumburl, credit: `${clip(stripTags(x.ii.extmetadata?.Artist?.value || 'Unknown'), 40)} · ${x.ii.extmetadata?.LicenseShortName?.value}` };
  } catch { return null; }
}
async function buildThemes() {
  const kits = [];
  await pool(themeDefs, 2, async (t) => {
    const sprites = [];
    for (const kw of t.sprites) {
      try {
        const cands = await commonsSearch(kw, 'filemime:image/png', 10, 128);
        let got = 0;
        for (const c of cands) { if (got >= 2) break; const v = await vetSprite(c); if (v && !sprites.some((s) => s.src === v.src)) { sprites.push({ ...v, kw }); got++; } }
      } catch (e) { warn(`theme ${t.id} ${kw}: ${e.message}`); }
      await sleep(120);
    }
    const bgs = [];
    for (const q of t.bg) {
      try { for (const c of (await commonsSearch(q, 'filetype:bitmap', 6, 640)).filter((c) => /jpeg/.test(c.ii.mime || '') && c.ii.width >= c.ii.height * 0.6).slice(0, 2)) bgs.push(c.ii.thumburl); }
      catch (e) { warn(`theme ${t.id} bg ${q}: ${e.message}`); }
    }
    if (sprites.length >= 5) kits.push({ id: t.id, kind: 'commons', name: t.name, hue: t.hue, sprites, bgs });
    log(`theme ${t.id}: ${sprites.length} sprites, ${bgs.length} backgrounds`);
  });
  // Kenney packs bundled with the app are themes too (sprites resolved in the app)
  const kidx = readJSON(path.join(ROOT, 'www/assets/kenney/index.json'), { files: {} });
  const perPack = {};
  for (const [, f] of Object.entries(kidx.files || {})) if (f.cut) perPack[f.pack] = (perPack[f.pack] || 0) + 1;
  for (const [pack, n] of Object.entries(perPack)) if (n >= 6 && KENNEY_NAMES[pack]) kits.push({ id: `k-${pack}`, kind: 'kenney', name: KENNEY_NAMES[pack], pack, hue: hashStr(pack) % 360 });
  report.sources.themes = kits.length;
  return kits;
}
const PROC_A = ['Neon', 'Velvet', 'Feral', 'Gloom', 'Candy', 'Rust', 'Astral', 'Bog', 'Chrome', 'Fever', 'Lunar', 'Moss', 'Static', 'Ember', 'Glitch', 'Opal', 'Swamp', 'Solar', 'Ghost', 'Plasma', 'Coral', 'Obsidian', 'Paper', 'Acid'];
const PROC_B = ['Bestiary', 'Menagerie', 'Critters', 'Goblins', 'Spawn', 'Familiars', 'Creatures', 'Imps', 'Monsters', 'Gremlins', 'Swarm', 'Brood', 'Horde', 'Zoo', 'Kin', 'Mob'];
// Every game gets a different (theme, variant); a theme appears at most once per game type.
function assignThemes(games, kits) {
  const uses = Object.fromEntries(kits.map((k) => [k.id, new Set()]));
  const count = Object.fromEntries(kits.map((k) => [k.id, 0]));
  const procNames = new Set();
  for (const g of games) {
    const free = kits.filter((k) => !uses[k.id].has(g.sub)).sort((a, b) => count[a.id] - count[b.id] || rand() - 0.5);
    if (!free.length || rand() < 0.25) {
      let name; do name = `${pick(PROC_A)} ${pick(PROC_B)}`; while (procNames.has(name) && procNames.size < PROC_A.length * PROC_B.length);
      procNames.add(name);
      g.theme = { proc: true, name, hue: Math.floor(rand() * 360), seed: Math.floor(rand() * 2 ** 31) };
    } else {
      const k = free[0];
      uses[k.id].add(g.sub);
      g.theme = { id: k.id, v: count[k.id]++, name: k.name };
    }
  }
}

// ------------------------------------------------------------------ procedural categories
const GAME_NAMES = {
  plinko: 'Plinko', breakout: 'Breakout', merge: 'Merge', dash: 'Dash', flappy: 'Flap', stacker: 'Stacker', pong: 'Pong', peggle: 'Peg Shot', golf: 'Bounce Golf', juggle: 'Juggle',
  platformer: 'Platformer', racer: 'Road Racer', raycast: 'Hell Maze', rocks: 'Rocks', sling: 'Slingshot',
  necro: 'Necromancer', chess: 'Chess', dice: 'Yacht Dice', cards: 'Joker Hands', monsters: 'Monster Battle', fighter: 'Street Brawl',
  starfox: 'Sky Fox', mystery: 'Manor Mystery', ski: 'Downhill', graves: 'Grave Merge', survivors: 'Cave Horde', robotron: 'Robo Arena', crokinole: 'Crokinole'
};
const ADJ = ['Ember', 'Moss', 'Rust', 'Ochre', 'Clay', 'Amber', 'Dusk', 'Ash', 'Copper', 'Sage', 'Umber', 'Saffron', 'Cedar', 'Flint', 'Honey', 'Basalt', 'Juniper', 'Tangerine', 'Cinder', 'Sienna', 'Lichen', 'Marigold', 'Obsidian', 'Fern', 'Paprika', 'Driftwood', 'Terracotta', 'Pumpkin', 'Gravel', 'Sunset'];
function buildGames() {
  const types = config.gameTypes;
  const posts = [];
  const used = new Set();
  for (let i = 0; i < want.game; i++) {
    const type = types[i % types.length];
    let seed; do seed = Math.floor(rand() * 2 ** 31); while (used.has(seed));
    used.add(seed);
    posts.push({ id: `g${seed.toString(36)}`, cat: 'game', sub: type, seed, title: `${pick(ADJ)} ${GAME_NAMES[type] || type}` });
  }
  return shuffle(posts);
}

const PSYCH_ALGOS = ['julia', 'mandel', 'tunnel', 'plasma', 'moire', 'kaleido', 'flow', 'spiro', 'rings', 'warp'];
function buildPsych(quotes, wiki) {
  const lines = quotes.filter((q) => q.text.length <= 180).map((q) => ({ text: q.text, author: q.author }));
  shuffle(lines);
  return Array.from({ length: want.psych }, (_, i) => {
    const seed = Math.floor(rand() * 2 ** 31);
    const q = lines[i % Math.max(1, lines.length)] || { text: 'Look closer.', author: '' };
    return { id: `p${seed.toString(36)}`, cat: 'psych', sub: PSYCH_ALGOS[i % PSYCH_ALGOS.length], seed, quote: q.text, author: q.author };
  });
}

function buildProducts() {
  const P = productParts;
  const posts = [];
  const names = new Set();
  const STYLES = ['sunset', 'memphis', 'chrome', 'vhs', 'infomercial', 'blueprint'];
  const art = () => ({ style: pick(STYLES), seed: Math.floor(rand() * 2 ** 31) });
  for (const c of shuffle([...productClassics])) {
    if (posts.length >= want.product) break;
    if (seen.product.has(c.name)) continue;
    names.add(c.name);
    posts.push({ id: `pr${hashStr(c.name).toString(36)}`, cat: 'product', sub: 'classic', name: c.name, tagline: c.tagline, desc: c.desc, glyph: c.glyph,
      features: shuffle([...P.feature]).slice(0, 3), price: pick(P.price), disclaimer: pick(P.disclaimer), art: art() });
  }
  let guard = 0;
  while (posts.length < want.product && guard++ < 20000) {
    const [obj, glyph] = pick(P.object);
    const name = `The ${pick(P.prefix)}-${obj} ${pick(P.suffix)}`;
    if (names.has(name) || seen.product.has(name)) continue;
    names.add(name);
    const purpose = pick(P.purpose);
    posts.push({ id: `pr${hashStr(name).toString(36)}`, cat: 'product', sub: 'generated', name, tagline: pick(P.tagline), glyph,
      desc: `The ${obj.toLowerCase()} ${purpose}.`, features: shuffle([...P.feature]).slice(0, 3), price: pick(P.price), disclaimer: pick(P.disclaimer), art: art() });
  }
  return posts;
}

function buildSelfCare() {
  const posts = [];
  const pool = shuffle(selfCare.map((s, i) => ({ s, i })));
  for (let n = 0; n < want.selfcare; n++) {
    const { s: [type, kind, text, extra], i } = pool[n % pool.length];
    const round = Math.floor(n / pool.length);
    posts.push({ id: `s${i}r${round}`, cat: 'selfcare', sub: type, kind, title: pick(selfCareFlavors), text,
      ...(kind === 'timer' ? { dur: extra } : {}), ...(kind === 'breathe' ? { pattern: extra } : {}), hue: Math.floor(rand() * 360) });
  }
  return shuffle(posts);
}

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

// ------------------------------------------------------------------ offline fixtures (local testing only)
function offlineFixtures() {
  const wiki = [];
  for (const [key, t] of Object.entries(topics.wiki)) {
    t.seeds.forEach((s, i) => wiki.push({ id: `w-off-${key}-${i}`, cat: 'wiki', sub: key, title: s,
      hook: `${s} is a placeholder entry used when the builder runs offline.`,
      summary: `${s} is a placeholder entry used when the builder runs offline. The real package pulls a five-sentence summary from Wikipedia. This text exists so the layout can be tested. It is never committed. Hail Eris.`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.replace(/ /g, '_'))}` }));
  }
  const vids = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0', 'kJQP7kiw5Fk'];
  const video = Array.from({ length: 40 }, (_, i) => ({ id: `v-off-${i}`, cat: 'video', sub: Object.keys(topics.video)[i % 10], vid: vids[i % vids.length], title: `Offline test video ${i}`, channel: 'Test', dur: '0:45', short: true }));
  const web = Array.from({ length: 30 }, (_, i) => ({ id: `web-off-${i}`, cat: 'web', sub: ['hn', 'substack', 'reddit'][i % 3], source: ['Hacker News', 'Substack', 'r/occult'][i % 3], title: `Offline test link ${i}`, url: 'https://news.ycombinator.com/', excerpt: 'Placeholder excerpt for layout testing. The real package fills this from the article.', meta: '123 points' }));
  const quotes = fallbackQuotes.map(([author, text]) => ({ author, text }));
  return { wiki, video, web, quotes, commons: [], kym: [] };
}

// ------------------------------------------------------------------ main
async function main() {
  let wiki, video, web, quotes, commons, kym, sprites = [], themes = [], news = [], textures = [];
  if (OFFLINE) ({ wiki, video, web, quotes, commons, kym } = offlineFixtures());
  else {
    quotes = await buildQuotes();
    wiki = await buildWiki();
    video = await buildVideos();
    web = await buildWeb();
    commons = await commonsImages();
    kym = await kymMemes();
    sprites = await buildSprites();
    themes = await buildThemes();
    textures = await buildTextures();
    news = await buildNews();
  }
  const games = buildGames();
  assignThemes(games, themes);
  const posts = {
    game: games,
    wiki: shuffle(wiki),
    video: shuffle(video),
    meme: buildMemes(quotes, wiki, commons, kym),
    product: buildProducts(),
    psych: buildPsych(quotes, wiki),
    selfcare: buildSelfCare(),
    web: shuffle(web),
    news
  };
  const counts = Object.fromEntries(Object.entries(posts).map(([k, v]) => [k, v.length]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const estHours = Object.entries(counts).reduce((s, [k, n]) => s + (cats[k].pct ? n * cats[k].dwellSec : 0), 0) / 3600;

  for (const [k, n] of Object.entries(counts)) if (want[k] && n < want[k] * 0.6) warn(`category ${k} is short: ${n}/${want[k]}`);
  report.wanted = want;

  let pkgId = id;
  const index = readJSON(path.join(OUT, 'index.json'), { packages: [] });
  if (!args.id) { let n = 1; while (index.packages.some((p) => p.id === pkgId)) pkgId = `${id}-${++n}`; }
  const dir = path.join(OUT, pkgId);
  const files = {};
  for (const [k, v] of Object.entries(posts)) { files[k] = `${k}.json`; writeJSON(path.join(dir, files[k]), v); }

  if (sprites.length) writeJSON(path.join(dir, 'sprites.json'), sprites);
  if (themes.length) writeJSON(path.join(dir, 'themes.json'), themes);
  if (textures.length) writeJSON(path.join(dir, 'textures.json'), textures);
  const prompt = fs.readFileSync(path.join(ROOT, 'packages/prompt.md'), 'utf8');
  const manifest = {
    id: pkgId, title: `The Feed · ${pkgId}`, created: new Date().toISOString(), offline: OFFLINE || undefined,
    total, counts, estHours: +estHours.toFixed(1),
    categories: Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, { label: c.label, pct: c.pct }])),
    topics: {
      wiki: Object.fromEntries(Object.entries(topics.wiki).map(([k, t]) => [k, t.label])),
      video: Object.fromEntries(Object.entries(topics.video).map(([k, t]) => [k, t.label])),
      game: Object.fromEntries(config.gameTypes.map((t) => [t, GAME_NAMES[t] || t])),
      web: { hn: 'Hacker News', site: 'Sites', comic: 'Comics', reddit: 'Reddit' },
      news: Object.fromEntries(Object.entries(config.news.groups).map(([k, g]) => [k, g.label]))
    },
    files, sprites: sprites.length ? 'sprites.json' : undefined, themes: themes.length ? 'themes.json' : undefined, textures: textures.length ? 'textures.json' : undefined, prompt, report
  };
  writeJSON(path.join(dir, 'manifest.json'), manifest, true);

  if (!OFFLINE) {
    index.packages = index.packages.filter((p) => p.id !== pkgId);
    index.packages.push({ id: pkgId, title: manifest.title, created: manifest.created, total, counts, estHours: manifest.estHours });
    index.packages.sort((a, b) => a.created.localeCompare(b.created));
    index.latest = pkgId;
    writeJSON(path.join(OUT, 'index.json'), index, true);
    const add = (k, vals) => { history[k] = [...new Set([...(history[k] || []), ...vals])]; };
    add('wiki', posts.wiki.map((p) => p.id.slice(1)));
    add('video', posts.video.map((p) => p.vid));
    add('web', posts.web.map((p) => p.url));
    add('memeImg', posts.meme.filter((p) => p.sub === 'remix').flatMap((p) => p.imgs || [p.img]));
    add('kym', posts.meme.filter((p) => p.sub === 'kym').map((p) => p.link));
    add('product', posts.product.map((p) => p.name));
    add('news', posts.news.map((p) => p.url));
    writeJSON(historyPath, history);
  }
  log(`Wrote ${dir}: ${total} posts, ~${estHours.toFixed(1)} h`, counts);
  if (report.warnings.length) log(`${report.warnings.length} warnings (see manifest.report)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
