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
import { DECK, QUESTIONS } from '../www/js/oracle-data.js';
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
  const tryUrl = async (url) => {
    try { const xml = await fetchText(url, { ua: BROWSER_UA, retries: 1 }); const parsed = parseFeed(xml); if (parsed.items.length) return parsed; }
    catch (e) { warn(`feed ${f.name} ${url}: ${e.message}`); }
    return null;
  };
  for (const url of f.urls) { const r = await tryUrl(url); if (r) return r; }
  // RSS autodiscovery from the home page, then (for webcomics) walk the "previous" links
  const home = f.home || (f.urls[0] && new URL(f.urls[0]).origin + '/');
  if (!home) return null;
  let html;
  try { html = await fetchText(home, { ua: BROWSER_UA, retries: 1 }); } catch (e) { warn(`feed ${f.name} home: ${e.message}`); return null; }
  for (const m of html.matchAll(/<link[^>]+>/gi)) {
    const tag = m[0];
    if (!/rel=["']?alternate/i.test(tag) || !/application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    const r = await tryUrl(new URL(decodeEntities(href), home).href);
    if (r) { log(`feed ${f.name}: discovered ${href}`); return r; }
  }
  if (!f.scrape) return null;
  if (f.scrape === 'blog') return scrapeBlog(f, home, html);
  const items = [];
  let url = home, page = html;
  for (let k = 0; k < (f.max || 10) && page; k++) {
    const title = (page.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || page.match(/<title>([^<]+)<\/title>/i) || [])[1];
    const img = (page.match(/<img[^>]+(?:id|class)=["'][^"']*(?:comic|strip|blort|cc-comic|main)[^"']*["'][^>]*>/i) || page.match(/<(?:main|article)[\s\S]*?(<img[^>]+>)/i) || [])[0];
    let src = img && (img.match(/src=["']([^"']+)["']/i) || [])[1];
    // fall back to the first image that isn't site chrome, then og:image
    if (!src) src = [...page.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).find((u) => !/logo|icon|avatar|banner|button|badge|sprite|spacer|pixel/i.test(u));
    if (!src) src = (page.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1];
    if (src) items.push({ title: decodeEntities(title || f.name).trim(), link: url, html: `<img src="${src}">`, date: null });
    const prev = (page.match(/<a[^>]+rel=["']prev["'][^>]*href=["']([^"']+)["']/i) || page.match(/<a[^>]+href=["']([^"']+)["'][^>]*rel=["']prev["']/i) || page.match(/<a[^>]+(?:class|id)=["'][^"']*prev[^"']*["'][^>]*href=["']([^"']+)["']/i) || [])[1];
    if (!prev) break;
    url = new URL(decodeEntities(prev), url).href;
    try { page = await fetchText(url, { ua: BROWSER_UA, retries: 0 }); } catch { page = null; }
  }
  if (items.length) log(`feed ${f.name}: scraped ${items.length} pages`);
  else report.sources[`${f.name} home`] = { bytes: html.length, links: [...html.matchAll(/<(?:link|a)[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 30), imgs: [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 15) };
  return items.length ? { title: f.name, items } : null;
}
// A blog without a feed: follow post-looking links on the home page and read each
// post's Open Graph tags.
async function scrapeBlog(f, home, html) {
  const host = new URL(home).host, links = [];
  const blocks = [...html.matchAll(/<(article|h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  for (const b of [...blocks, html]) for (const m of b.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u; try { u = new URL(decodeEntities(m[1]), home); } catch { continue; }
    const text = stripTags(m[2]).trim();
    if (u.host !== host || u.pathname.length < 3 || /\/(tag|tags|category|categories|page|author|about|contact|search|feed|wp-|login|archive)s?\b/i.test(u.pathname) || /\.(png|jpe?g|gif|css|js|xml)$/i.test(u.pathname) || text.length < 4) continue;
    const href = u.href.replace(/\/$/, '');
    if (!links.some((l) => l.href === href)) links.push({ href, text });
    if (links.length >= (f.max || 10) * 2) break;
  }
  const items = [];
  for (const l of links) {
    if (items.length >= (f.max || 10)) break;
    const page = await ogMeta(l.href);
    if (!page.html) continue;
    const title = (page.html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
    const date = (page.html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) || page.html.match(/<time[^>]+datetime=["']([^"']+)["']/i) || [])[1];
    const body = (page.html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i) || [])[1] || '';
    const text = page.desc || clip(stripTags(body), 400);
    if (!text && !page.image) continue;
    items.push({ title: decodeEntities(stripTags(title || l.text)).trim(), link: l.href, html: `${page.image ? `<img src="${page.image}">` : ''}<p>${text || ''}</p>`, date: date || null });
  }
  if (items.length) log(`feed ${f.name}: scraped ${items.length} posts`);
  else report.sources[`${f.name} home`] = { bytes: html.length, links: [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 40) };
  return items.length ? { title: f.name, items } : null;
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

// ------------------------------------------------------------------ oracle: tarot scans from Commons
const TAROT_ALT = [['fool', 'le fou', 'matto'], ['magician', 'bateleur', 'bagatto'], ['high priestess', 'papesse', 'popess'], ['empress', 'impératrice', 'imperatrice'], ['emperor', 'empereur', 'imperatore'],
  ['hierophant', 'le pape', 'papa'], ['lovers', 'amoureux', 'amanti'], ['chariot', 'carro'], ['strength', 'la force', 'forza', 'fortitude'], ['hermit', 'hermite', 'eremita', 'ermite'], ['wheel of fortune', 'roue de fortune', 'ruota'],
  ['justice', 'giustizia'], ['hanged man', 'le pendu', 'appeso'], ['death', 'la mort', 'morte'], ['temperance', 'tempérance', 'temperanza'], ['devil', 'diable', 'diavolo'], ['tower', 'maison dieu', 'maison-dieu', 'torre'],
  ['star', 'étoile', 'etoile', 'stella'], ['moon', 'la lune', 'luna'], ['sun', 'soleil', 'il sole'], ['judgement', 'judgment', 'jugement', 'giudizio'], ['world', 'le monde', 'mondo']];
async function buildTarot() {
  const out = {};
  const add = (id, url) => { const l = (out[id] ||= []); if (url && !l.includes(url) && l.length < 4) l.push(url); };
  // the 1909 Rider–Waite–Smith deck, by file name
  for (let i = 0; i < DECK.length; i += 50) {
    const batch = DECK.slice(i, i + 50);
    try {
      const j = await fetchJSON(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', titles: batch.map((c) => `File:${c.rws}`).join('|'), prop: 'imageinfo', iiprop: 'url|mime', iiurlwidth: '320', format: 'json', formatversion: '2' })}`);
      const norm = Object.fromEntries((j.query?.normalized || []).map((n) => [n.to, n.from]));
      for (const pg of j.query?.pages || []) {
        const t = norm[pg.title] || pg.title, c = batch.find((x) => `File:${x.rws}` === t || `File:${x.rws}`.replace(/_/g, ' ') === pg.title);
        if (c && pg.imageinfo?.[0]?.thumburl) add(c.id, pg.imageinfo[0].thumburl);
      }
    } catch (e) { warn(`tarot RWS batch ${i}: ${e.message}`); }
    await sleep(100);
  }
  // older decks for the major arcana (Marseille, Visconti-Sforza, Sola Busca…)
  const best = (t) => { let bi = -1, bl = 0; TAROT_ALT.forEach((names, i) => { for (const n of names) if (t.includes(n) && n.length > bl) { bl = n.length; bi = i; } }); return bi; };
  await pool(TAROT_ALT.map((n, i) => [n, i]), 3, async ([names, i]) => {
    for (const q of new Set([`tarot ${names[0]}`, `tarot ${names[1]}`, `tarocchi ${names[names.length - 1]}`])) {
      try {
        for (const c of await commonsSearch(q, 'filetype:bitmap', 15, 320)) {
          const t = c.title.toLowerCase();
          if (/rws|rider|waite/.test(t) || !/tarot|tarocc|trionf|trump|carte|card/.test(t) || best(t) !== i) continue;
          if (c.ii.width && c.ii.height && c.ii.height < c.ii.width * 1.25) continue; // single portrait cards only
          add(`M${String(i).padStart(2, '0')}`, c.ii.thumburl);
        }
      } catch (e) { warn(`tarot search ${q}: ${e.message}`); }
      await sleep(100);
    }
  });
  report.sources.tarotCards = Object.keys(out).length;
  report.sources.tarotImages = Object.values(out).reduce((a, l) => a + l.length, 0);
  return { tarot: out };
}
function buildOracle() {
  const subs = ['tarot', 'iching', 'augury', 'dnd', 'tarot', 'haruspicy', 'dice', 'die'];
  return shuffle(Array.from({ length: want.oracle || 0 }, (_, i) => {
    const seed = Math.floor(rand() * 2 ** 31), sub = subs[i % subs.length];
    return { id: `o${seed.toString(36)}`, cat: 'oracle', sub, seed, question: pick(QUESTIONS), spread: sub === 'tarot' && rand() < 0.5 ? 3 : 1 };
  }));
}

// ------------------------------------------------------------------ vocabulary (definitions from Wiktionary)
async function buildVocab() {
  const list = readJSON(path.join(ROOT, 'tools/data/vocab.json')).words.filter((w) => /^[a-z]+$/.test(w));
  if (OFFLINE) return list.map((w) => ({ w, pos: 'noun', d: `placeholder definition of ${w} for offline testing` }));
  const out = [];
  await pool(list, 4, async (w) => {
    try {
      const j = await fetchJSON(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(w)}`);
      for (const sense of j.en || []) {
        const d = (sense.definitions || []).map((x) => stripTags(x.definition || '')).find((x) => x.length > 8 && !/^(plural|alternative|obsolete|archaic) (of|form|spelling)/i.test(x) && !/^(misspelling|initialism) of/i.test(x));
        if (d) { out.push({ w, pos: sense.partOfSpeech?.toLowerCase(), d: clip(d.replace(/\s+([,.;:)])/g, '$1').replace(/\(\s+/g, '(').replace(/\s*\.$/, ''), 160) }); return; }
      }
    } catch (e) { warn(`vocab ${w}: ${e.message}`); }
    await sleep(50);
  });
  report.sources.vocab = out.length;
  return out;
}

// ------------------------------------------------------------------ studio: writing pages and the character creator
function buildStudio() {
  const P = readJSON(path.join(ROOT, 'tools/data/prompts.json'));
  const prompts = shuffle([...P.prompts]);
  return Array.from({ length: want.studio || 0 }, (_, i) => {
    const seed = Math.floor(rand() * 2 ** 31), k = i % 10;
    if (k === 9) return { id: `st${seed.toString(36)}`, cat: 'studio', sub: 'creator', seed, title: 'Character creator' };
    if (k % 3 === 2) return { id: `st${seed.toString(36)}`, cat: 'studio', sub: 'blank', seed, title: pick(P.blankTitles) };
    return { id: `st${seed.toString(36)}`, cat: 'studio', sub: 'prompt', seed, prompt: prompts[i % prompts.length] };
  });
}

// ------------------------------------------------------------------ long reads: novels (Gutenberg), poems (PoetryDB), long articles (Wikipedia)
async function buildReads(wiki) {
  const R = config.reads || {}, n = want.read || 0, out = [];
  if (!n) return out;
  if (OFFLINE) {
    for (let i = 0; i < n; i++) out.push(i % 3 === 1 ? { kind: 'poem', title: `Offline poem ${i}`, author: 'Anonymous', lines: Array.from({ length: 14 }, (_, k) => `Placeholder line ${k + 1} of a poem for layout testing`) } : { kind: i % 3 ? 'article' : 'novel', title: `Offline long read ${i}`, book: 'A Test Book', author: 'A. Writer', paras: Array.from({ length: 5 }, (_, k) => `Paragraph ${k + 1}. This is placeholder text for the long reads layout, written so the card has something to fold and unfold. It is never committed.`) });
    return out.map((x, i) => ({ id: `rd-off-${i}`, cat: 'read', sub: x.kind, ...x }));
  }
  // novels: popular public-domain books on our themes, excerpts of five paragraphs
  const books = [];
  await pool(R.gutenbergTopics || [], 3, async (topic) => {
    try {
      const j = await fetchJSON(`https://gutendex.com/books/?${new URLSearchParams({ topic, languages: 'en', sort: 'popular' })}`, { timeout: 30000 });
      for (const b of (j.results || []).slice(0, R.booksPerTopic || 4)) {
        const txt = Object.entries(b.formats || {}).find(([k, v]) => k.startsWith('text/plain') && !v.endsWith('.zip'))?.[1];
        if (txt && !books.some((x) => x.id === b.id)) books.push({ id: b.id, title: b.title, author: (b.authors?.[0]?.name || '').split(', ').reverse().join(' '), year: b.authors?.[0]?.death_year, txt, topic });
      }
    } catch (e) { warn(`gutendex ${topic}: ${e.message}`); }
  });
  await pool(shuffle(books).slice(0, R.books || 30), 3, async (b) => {
    try {
      let t = await fetchText(b.txt, { timeout: 40000, retries: 1 });
      t = t.replace(/\r/g, '');
      const s0 = t.search(/\*\*\* ?START OF [^\n]*\n/i), s1 = t.search(/\*\*\* ?END OF /i);
      if (s0 >= 0) t = t.slice(t.indexOf('\n', s0) + 1, s1 > s0 ? s1 : undefined);
      const paras = t.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/_/g, '').trim()).filter(Boolean);
      const good = (p) => p.length > 160 && p.length < 1600 && !/^(chapter|book|part|contents|illustration|\[)/i.test(p) && p.replace(/[^A-Z]/g, '').length < p.length * 0.3;
      const per = R.perBook || 3, start = Math.floor(paras.length * 0.08);
      for (let k = 0, tries = 0; k < per && tries < 60; tries++) {
        const i = start + Math.floor(rand() * Math.max(1, paras.length - start - 6));
        const run = paras.slice(i, i + 5);
        if (run.length < 4 || !run.every(good)) continue;
        out.push({ kind: 'novel', title: b.title.split(/[:;]/)[0], book: b.title.split(/[:;]/)[0], author: b.author, year: b.year, paras: run, url: `https://www.gutenberg.org/ebooks/${b.id}`, source: 'Project Gutenberg', topic: b.topic });
        k++;
      }
    } catch (e) { warn(`gutenberg ${b.id}: ${e.message}`); }
  });
  // whole poems
  try {
    const j = await fetchJSON(`https://poetrydb.org/random/${R.poemsFetch || 120}`, { timeout: 30000 });
    for (const p of shuffle(j || []).filter((p) => +p.linecount >= 8 && +p.linecount <= (R.poemMaxLines || 70)).slice(0, R.poems || 60)) out.push({ kind: 'poem', title: p.title, author: p.author, lines: p.lines, url: `https://www.google.com/search?q=${encodeURIComponent(`${p.title} ${p.author}`)}`, source: 'PoetryDB' });
  } catch (e) { warn(`poetrydb: ${e.message}`); }
  // long articles: the first five paragraphs of this week's longest Wikipedia picks
  const long = [...wiki].sort((a, b) => (b.summary?.length || 0) - (a.summary?.length || 0)).slice(0, R.articles || 30);
  await pool(long, 3, async (w) => {
    try {
      const j = await fetchJSON(wq({ action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'plain', titles: w.title, redirects: '1' }));
      const txt = j.query?.pages?.[0]?.extract || '';
      const paras = txt.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 140 && !/^(See also|References|External links)/.test(p)).slice(0, 5);
      if (paras.length >= 4) out.push({ kind: 'article', title: w.title, author: 'Wikipedia', paras: paras.map((p) => clip(cleanExtract(p), 1400)), url: w.url, source: 'Wikipedia' });
    } catch (e) { warn(`long article ${w.title}: ${e.message}`); }
  });
  report.sources.reads = { novels: out.filter((x) => x.kind === 'novel').length, poems: out.filter((x) => x.kind === 'poem').length, articles: out.filter((x) => x.kind === 'article').length, books: books.length };
  return shuffle(out).slice(0, n).map((x) => ({ id: `rd${hashStr(`${x.title}${x.paras?.[0] || x.lines?.[0] || ''}`).toString(36)}`, cat: 'read', sub: x.kind, ...x }));
}

// ------------------------------------------------------------------ absurd power scale
async function buildPower() {
  const P = readJSON(path.join(ROOT, 'tools/data/power.json'));
  const all = Object.entries(P.entities).flatMap(([kind, ts]) => ts.map((t) => ({ t, kind })));
  const ents = new Map();
  if (OFFLINE) for (const e of all) ents.set(e.t, { t: e.t, k: e.kind, b: `${e.t} is a placeholder entry for offline testing.`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(e.t.replace(/ /g, '_'))}`, views: 500 + (hashStr(e.t) % 90000), len: 3000 + (hashStr(e.t) % 60000) });
  else {
    for (let i = 0; i < all.length; i += 20) {
      const batch = all.slice(i, i + 20);
      try {
        const j = await fetchJSON(wq({ action: 'query', prop: 'extracts|pageimages|info|pageviews', exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20', piprop: 'thumbnail', pithumbsize: '320', pilimit: '20', pvipdays: '30', inprop: 'url', redirects: '1', titles: batch.map((e) => e.t).join('|') }));
        const back = {};
        for (const n of j.query?.normalized || []) back[n.to] = n.from;
        for (const r of j.query?.redirects || []) back[r.to] = back[r.from] || r.from;
        for (const pg of j.query?.pages || []) {
          if (pg.missing || !pg.extract) continue;
          const orig = back[pg.title] || pg.title, e = batch.find((x) => x.t === orig) || batch.find((x) => x.t === pg.title);
          if (!e || ents.has(pg.title)) continue;
          const views = Object.values(pg.pageviews || {}).reduce((a, v) => a + (v || 0), 0);
          ents.set(pg.title, { t: pg.title, k: e.kind, b: clip(cleanExtract(pg.extract), 170), img: pg.thumbnail?.source, url: pg.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pg.title.replace(/ /g, '_'))}`, views, len: pg.length || 0 });
        }
      } catch (e) { warn(`power batch ${i}: ${e.message}`); }
      await sleep(80);
    }
  }
  const list = [...ents.values()];
  if (list.length < 8) { warn('power scale: too few entities'); return []; }
  // stats: two from real numbers (pageviews, article length), the rest are fate
  const statOf = (e) => {
    const h = hashStr(e.t), s = {};
    P.stats.forEach((name, k) => { s[name] = name === 'Lore' ? Math.min(10, Math.max(1, Math.round(Math.log10(e.len + 10) * 2.2 - 5))) : name === 'Cult following' ? Math.min(10, Math.max(1, Math.round(Math.log10(e.views + 10) * 1.9 - 2))) : 1 + ((h >>> (k * 3)) % 10); });
    return s;
  };
  for (const e of list) { e.s = statOf(e); e.pw = Math.round(Math.sqrt(e.views + 50) * Math.sqrt(e.len + 500) / 40 * (1 + (hashStr(e.t) % 13) / 4)); delete e.views; delete e.len; }
  const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  const n = want.power || 0, posts = [];
  const TIER_TITLES = ['Official power ranking', 'Who would win in a pub', 'Strongest when wet', 'Most dangerous at a dinner party', 'Best to have in a lifeboat', 'Tier list of the unknowable', 'Ranked by how hard they are to explain to a customs officer', 'Most likely to survive the heat death of the universe', 'Who you’d want on a pub quiz team', 'Ranked by sheer audacity'];
  for (let i = 0; i < n; i++) {
    const seed = Math.floor(rand() * 2 ** 31), unit = pick(P.units);
    if (i % 10 < 7) {
      let a = pick(list), b = pick(list), g = 0;
      while ((b === a || (b.k === a.k && rand() < 0.7)) && g++ < 20) b = pick(list);
      const w = a.pw === b.pw ? (rand() < 0.5 ? 0 : 1) : a.pw > b.pw ? 0 : 1, win = [a, b][w], lose = [a, b][1 - w];
      const stat = Object.entries(win.s).sort((x, y) => (y[1] - lose.s[y[0]]) - (x[1] - lose.s[x[0]]))[0][0];
      posts.push({ id: `pw${seed.toString(36)}`, cat: 'power', sub: 'versus', seed, unit, a, b, winner: w, how: `${win.t} wins ${fill(pick(P.wins), { stat: stat.toLowerCase(), loser: lose.t })}.`, verdict: pick(P.verdicts) });
    } else {
      const picks = new Set(); while (picks.size < 6) picks.add(pick(list));
      const ranked = [...picks].sort((x, y) => y.pw - x.pw);
      posts.push({ id: `pt${seed.toString(36)}`, cat: 'power', sub: 'tier', seed, unit, title: pick(TIER_TITLES), ents: ranked, tiers: ['S', 'A', 'B', 'C', 'D', 'F'] });
    }
  }
  report.sources.power = list.length;
  return posts;
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
  starfox: 'Sky Fox', mystery: 'Manor Mystery', ski: 'Downhill', graves: 'Grave Merge', survivors: 'Cave Horde', robotron: 'Robo Arena', crokinole: 'Crokinole',
  wordle: 'Five Letters', bee: 'Spelling Hive', wordsearch: 'Word Search', wheel: 'Letter Wheel', hangman: 'Hangman', vocab: 'Vocab Quiz', ladder: 'Word Ladder', t2048: '2048', arrows: 'Arrow Escape', jrpg: 'Crystal Quest', hack: 'Crypt Hack'
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
  let wiki, video, web, quotes, commons, kym, sprites = [], themes = [], news = [], textures = [], oracleData = null;
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
    oracleData = await buildTarot();
  }
  const power = await buildPower();
  const vocab = await buildVocab();
  const games = buildGames();
  assignThemes(games, themes);
  const posts = {
    game: games,
    wiki: shuffle(wiki),
    video: shuffle(video),
    meme: await (async () => { const strips = await buildStrips(quotes, commons, Math.round(want.meme * (config.strips?.share ?? 0.2))); return shuffle([...strips, ...buildMemes(quotes, wiki, commons, kym).slice(0, want.meme - strips.length)]); })(),
    product: buildProducts(),
    psych: buildPsych(quotes, wiki),
    selfcare: buildSelfCare(),
    web: shuffle(web),
    news,
    oracle: buildOracle(),
    power,
    studio: buildStudio(),
    read: await buildReads(wiki)
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
  if (oracleData) writeJSON(path.join(dir, 'tarot.json'), oracleData);
  if (vocab.length) writeJSON(path.join(dir, 'vocab.json'), vocab);
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
    files, sprites: sprites.length ? 'sprites.json' : undefined, themes: themes.length ? 'themes.json' : undefined, textures: textures.length ? 'textures.json' : undefined, oracle: oracleData ? 'tarot.json' : undefined, vocab: vocab.length ? 'vocab.json' : undefined, prompt, report
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
