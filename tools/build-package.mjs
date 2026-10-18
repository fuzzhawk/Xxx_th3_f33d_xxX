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
import { productClassics, productParts, selfCare, selfCareFlavors, memeTemplates, fallbackQuotes } from './data/content.mjs';

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

async function fetchText(url, { headers = {}, timeout = 20000, retries = 2, ua = UA } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.8', ...headers }, signal: ctl.signal, redirect: 'follow' });
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { retry: true });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return await res.text();
    } catch (e) {
      if (attempt >= retries || (e.status && !e.retry)) throw e;
      await sleep(800 * 2 ** attempt);
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
function cleanExtract(s) {
  return s.replace(/\s*\([^()]*(?:listen|pronounced|IPA|;\s*$)[^()]*\)/gi, '')
    .replace(/\(\s*[;,]\s*/g, '(').replace(/\(\s*\)/g, '').replace(/\s+([,.;])/g, '$1').replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------------ history (no repeats across packages)
const historyPath = path.join(OUT, 'history.json');
const history = readJSON(historyPath, { wiki: [], video: [], web: [], memeImg: [], kym: [], product: [] });
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
    const catLists = await pool(t.categories, 4, (c) => categoryMembers(c));
    catLists.forEach((l) => (l || []).forEach((x) => cand.add(x)));
    const likeLists = await pool(shuffle([...t.seeds]).slice(0, 30), 4, moreLike);
    likeLists.forEach((l) => (l || []).forEach((x) => cand.add(x)));
    const seeds = new Set(t.seeds);
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
      claimed.add(pid);
      posts.push({
        id: `w${pid}`, cat: 'wiki', sub: key, title: p.title,
        hook: clip(ss[0], 190), summary: ss.join(' '),
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
async function embeddable(vid) {
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
    const lists = await pool(g.queries, 3, async (q) => { const r = await ytSearch(q); await sleep(300); return r; });
    const failures = lists.filter((l) => !l).length;
    if (failures) warn(`youtube ${key}: ${failures}/${g.queries.length} searches failed`);
    // interleave query results so one query cannot dominate
    const cand = [];
    const maxLen = Math.max(0, ...lists.map((l) => (l || []).length));
    for (let i = 0; i < maxLen; i++) for (const l of lists) if (l && l[i]) cand.push(l[i]);
    const fresh = cand.filter((v) => !taken.has(v.vid) && !seen.video.has(v.vid) && (!v.dur || durSec(v.dur) <= 600));
    const uniq = [...new Map(fresh.map((v) => [v.vid, v])).values()].slice(0, Math.ceil(quota * 1.4));
    const checks = await pool(uniq, 8, (v) => embeddable(v.vid));
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

// ------------------------------------------------------------------ web (HN, Substack, Reddit)
async function ogDescription(url) {
  try {
    const html = await fetchText(url, { ua: BROWSER_UA, timeout: 9000, retries: 0 });
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description|twitter:description)["'][^>]+content=["']([^"']{30,})["']/i)
      || html.match(/<meta[^>]+content=["']([^"']{30,})["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i);
    return m ? clip(decodeEntities(m[1]).trim(), 320) : '';
  } catch { return ''; }
}
async function buildWeb() {
  const w = config.web;
  const items = [];
  // Hacker News via Algolia
  const hnLists = await pool(w.hnQueries, 4, (q) => fetchJSON(`https://hn.algolia.com/api/v1/search?${new URLSearchParams({ query: q, tags: 'story', numericFilters: `points>${w.hnMinPoints}`, hitsPerPage: '20' })}`).then((j) => j.hits.map((h) => ({ q, h }))));
  const hn = [];
  hnLists.forEach((l) => (l || []).forEach(({ q, h }) => {
    if (!h.title) return;
    const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
    hn.push({ source: 'Hacker News', sub: 'hn', title: h.title, url, discuss: `https://news.ycombinator.com/item?id=${h.objectID}`, meta: `${h.points} points · ${h.num_comments || 0} comments`, date: h.created_at?.slice(0, 10), excerpt: h.story_text ? clip(stripTags(h.story_text), 320) : '', topic: q });
  }));
  report.sources.hackernews = hn.length;
  // Substack RSS + search
  const ss = [];
  await pool(w.substackFeeds, 4, async (feed) => {
    try {
      const xml = await fetchText(feed, { ua: BROWSER_UA });
      const pub = stripTags((xml.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/) || [])[1] || '').replace(/^<!\[CDATA\[|\]\]>$/g, '');
      for (const it of xml.split(/<item>/).slice(1, 16)) {
        const g = (t) => ((it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
        const title = stripTags(g('title'));
        const link = stripTags(g('link'));
        if (!title || !link) continue;
        ss.push({ source: pub || new URL(feed).hostname, sub: 'substack', title, url: link, excerpt: clip(stripTags(g('description')), 320), date: new Date(g('pubDate') || Date.now()).toISOString().slice(0, 10) });
      }
    } catch (e) { warn(`substack ${feed}: ${e.message}`); }
  });
  await pool(w.substackSearch, 2, async (q) => {
    try {
      const j = await fetchJSON(`https://substack.com/api/v1/post/search?${new URLSearchParams({ query: q, page: '0' })}`, { ua: BROWSER_UA, retries: 0 });
      for (const r of (j.results || j.posts || []).slice(0, 12)) {
        if (!r.title || !r.canonical_url) continue;
        ss.push({ source: r.publication?.name || 'Substack', sub: 'substack', title: r.title, url: r.canonical_url, excerpt: clip(r.subtitle || r.description || '', 320), date: (r.post_date || '').slice(0, 10) });
      }
    } catch (e) { warn(`substack search ${q}: ${e.message}`); }
  });
  report.sources.substack = ss.length;
  // Reddit (occasional)
  const rd = [];
  await pool(w.subreddits, 2, async (s) => {
    try {
      const j = await fetchJSON(`https://www.reddit.com/r/${s}/top.json?t=month&limit=25&raw_json=1`, { retries: 1 });
      for (const c of j.data?.children || []) {
        const d = c.data;
        if (!d || d.over_18 || d.stickied || d.score < 100) continue;
        rd.push({ source: `r/${s}`, sub: 'reddit', title: d.title, url: `https://www.reddit.com${d.permalink}`, excerpt: clip((d.selftext || '').replace(/\s+/g, ' '), 320), meta: `${d.score} upvotes · ${d.num_comments} comments`, date: new Date(d.created_utc * 1000).toISOString().slice(0, 10) });
      }
      await sleep(1200);
    } catch (e) { warn(`reddit ${s}: ${e.message}`); }
  });
  report.sources.reddit = rd.length;

  const fresh = (l) => shuffle(l.filter((x) => !seen.web.has(x.url)));
  const redditN = Math.min(rd.length, Math.round(want.web * w.redditShare));
  const ssN = Math.min(ss.length, Math.round((want.web - redditN) * 0.45));
  const chosen = [...fresh(rd).slice(0, redditN), ...fresh(ss).slice(0, ssN)];
  const urls = new Set(chosen.map((x) => x.url));
  for (const x of fresh(hn)) { if (chosen.length >= want.web) break; if (!urls.has(x.url)) { urls.add(x.url); chosen.push(x); } }
  for (const x of fresh([...ss, ...rd])) { if (chosen.length >= want.web) break; if (!urls.has(x.url)) { urls.add(x.url); chosen.push(x); } }
  // fill in excerpts for links that have none
  const missing = chosen.filter((x) => !x.excerpt && !x.url.includes('news.ycombinator.com'));
  const descs = await pool(missing, 6, (x) => ogDescription(x.url));
  missing.forEach((x, i) => { if (descs[i]) x.excerpt = descs[i]; });
  return chosen.map((x) => ({ id: `web${hashStr(x.url).toString(36)}`, cat: 'web', ...x }));
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

// ------------------------------------------------------------------ procedural categories
const GAME_NAMES = {
  plinko: 'Plinko', breakout: 'Breakout', merge: 'Merge', dash: 'Dash', flappy: 'Flap', stacker: 'Stacker', pong: 'Pong', peggle: 'Peg Shot', golf: 'Bounce Golf', juggle: 'Juggle'
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
  const lines = [...quotes.map((q) => ({ text: q.text, author: q.author })), ...wiki.filter((w) => w.hook.length < 150).map((w) => ({ text: w.hook, author: w.title, url: w.url }))];
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
  const kymN = Math.min(kym.length, Math.round(want.meme * 0.3));
  for (const k of kym.slice(0, kymN)) posts.push({ id: `mk${hashStr(k.link).toString(36)}`, cat: 'meme', sub: 'kym', style: 'kym', img: k.img, title: k.title, link: k.link, credit: 'via Know Your Meme' });
  const shortQ = shuffle(quotes.filter((q) => q.text.length < 150));
  const facts = shuffle(wiki.filter((w) => w.hook.length < 170));
  let qi = 0, fi = 0;
  const imgs = commons.slice(0, want.meme - posts.length);
  for (const im of imgs) {
    const t = pick(memeTemplates);
    const q = shortQ[qi++ % Math.max(1, shortQ.length)] || { text: 'Reality is what you can get away with.', author: 'Robert Anton Wilson' };
    const f = facts[fi++ % Math.max(1, facts.length)];
    const fact = f ? f.hook.replace(/\.$/, '').replace(/^(\S)/, (c) => (/^[A-Z][a-z]/.test(f.hook) && !/^[A-Z][a-z]+ [A-Z]/.test(f.hook) ? c.toLowerCase() : c)) : 'nothing is true';
    const title = f ? f.title.replace(/ \(.*\)$/, '') : 'this';
    const words = q.text.split(' ');
    const half = Math.ceil(words.length / 2);
    const fill = (s) => s.replace(/\{quoteA\}/g, words.slice(0, half).join(' ')).replace(/\{quoteB\}/g, words.slice(half).join(' '))
      .replace(/\{quote\}/g, q.text.replace(/^"|"$/g, '')).replace(/\{author\}/g, q.author).replace(/\{fact\}/g, fact).replace(/\{title\}/g, title);
    const post = { id: `mc${hashStr(im.img).toString(36)}`, cat: 'meme', sub: 'remix', style: t.style, img: im.img, credit: im.credit, link: im.link, ratio: im.h && im.w ? +(im.h / im.w).toFixed(3) : undefined };
    if (t.style === 'impact') { post.top = fill(t.top); post.bottom = fill(t.bottom); } else post.text = fill(t.text);
    if (/\{(quote|author)\}|quoteA/.test(JSON.stringify(t))) post.src = q.author; else if (f) post.src = f.url;
    posts.push(post);
  }
  report.sources.memesBuilt = posts.length;
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
  let wiki, video, web, quotes, commons, kym;
  if (OFFLINE) ({ wiki, video, web, quotes, commons, kym } = offlineFixtures());
  else {
    quotes = await buildQuotes();
    wiki = await buildWiki();
    video = await buildVideos();
    web = await buildWeb();
    commons = await commonsImages();
    kym = await kymMemes();
  }
  const posts = {
    game: buildGames(),
    wiki: shuffle(wiki),
    video: shuffle(video),
    meme: buildMemes(quotes, wiki, commons, kym),
    product: buildProducts(),
    psych: buildPsych(quotes, wiki),
    selfcare: buildSelfCare(),
    web: shuffle(web)
  };
  const counts = Object.fromEntries(Object.entries(posts).map(([k, v]) => [k, v.length]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const estHours = Object.entries(counts).reduce((s, [k, n]) => s + n * cats[k].dwellSec, 0) / 3600;

  for (const [k, n] of Object.entries(counts)) if (n < want[k] * 0.6) warn(`category ${k} is short: ${n}/${want[k]}`);
  report.wanted = want;

  let pkgId = id;
  const index = readJSON(path.join(OUT, 'index.json'), { packages: [] });
  if (!args.id) { let n = 1; while (index.packages.some((p) => p.id === pkgId)) pkgId = `${id}-${++n}`; }
  const dir = path.join(OUT, pkgId);
  const files = {};
  for (const [k, v] of Object.entries(posts)) { files[k] = `${k}.json`; writeJSON(path.join(dir, files[k]), v); }

  const prompt = fs.readFileSync(path.join(ROOT, 'packages/prompt.md'), 'utf8');
  const manifest = {
    id: pkgId, title: `The Feed · ${pkgId}`, created: new Date().toISOString(), offline: OFFLINE || undefined,
    total, counts, estHours: +estHours.toFixed(1),
    categories: Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, { label: c.label, pct: c.pct }])),
    topics: {
      wiki: Object.fromEntries(Object.entries(topics.wiki).map(([k, t]) => [k, t.label])),
      video: Object.fromEntries(Object.entries(topics.video).map(([k, t]) => [k, t.label])),
      game: Object.fromEntries(config.gameTypes.map((t) => [t, GAME_NAMES[t] || t]))
    },
    files, prompt, report
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
    add('memeImg', posts.meme.filter((p) => p.sub === 'remix').map((p) => p.img));
    add('kym', posts.meme.filter((p) => p.sub === 'kym').map((p) => p.link));
    add('product', posts.product.map((p) => p.name));
    writeJSON(historyPath, history);
  }
  log(`Wrote ${dir}: ${total} posts, ~${estHours.toFixed(1)} h`, counts);
  if (report.warnings.length) log(`${report.warnings.length} warnings (see manifest.report)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
