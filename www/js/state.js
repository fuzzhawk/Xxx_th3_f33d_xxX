import { lsGet, lsSet } from './store.js';

export const CATS = ['game', 'wiki', 'video', 'meme', 'product', 'psych', 'selfcare', 'web'];
export const CAT_LABEL = { game: 'Games', wiki: 'Wikipedia', video: 'Videos', meme: 'Memes', product: 'Products', psych: 'Psychedelic', selfcare: 'Self-care', web: 'From the web' };
export const CAT_GLYPH = { game: '◐', wiki: '❦', video: '▶', meme: '☺', product: '✦', psych: '✺', selfcare: '☘', web: '⌘' };
export const DEFAULT_PCT = { game: 20, wiki: 30, video: 20, meme: 10, product: 5, psych: 5, selfcare: 5, web: 5 };

const BUILD = window.BUILD || {};
export const DEFAULTS = {
  pct: null,               // null = use the package's percentages
  subWeights: {},          // { wiki: { music: 1.4, ... }, video: {...}, game: {...} }
  learned: {},             // nudged by more/less marks: { cat: { sub: factor } }
  adaptive: true,
  avoidRepeat: true,
  selfcareEveryMin: 30,
  autoplay: true,
  startMuted: true,
  rememberSound: false,
  autopilot: true,
  reduceMotion: false,
  showWikiImages: true,
  cacheImages: true,
  skipVideosOffline: true,
  dailyBudgetMin: 0,
  grayscaleOverBudget: false,
  repeatWhenDone: false,
  immersive: true,
  showNsfw: true,
  blurNsfw: false,
  repo: 'fuzzhawk/Xxx_th3_f33d_xxX',
  branch: BUILD.branch || 'main',
  autoCheck: true,
  token: '',
  prompt: null,            // null = the package's prompt
  promptEdited: false,
  pkg: null                // current package id
};

export const settings = Object.assign(structuredClone(DEFAULTS), lsGet('settings', {}));
export function saveSettings() { lsSet('settings', settings); }
export function resetSettings(keep = ['token', 'repo', 'branch', 'pkg']) {
  const kept = Object.fromEntries(keep.map((k) => [k, settings[k]]));
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, structuredClone(DEFAULTS), kept);
  saveSettings();
}

export function pctFor(manifest) {
  const base = settings.pct || Object.fromEntries(CATS.map((c) => [c, manifest?.categories?.[c]?.pct ?? DEFAULT_PCT[c]]));
  return Object.fromEntries(CATS.map((c) => [c, Math.max(0, +base[c] || 0)]));
}
export function subWeight(cat, sub) {
  const u = settings.subWeights?.[cat]?.[sub] ?? 1;
  const l = settings.adaptive ? (settings.learned?.[cat]?.[sub] ?? 1) : 1;
  return u * l;
}

// marks: { [postId]: { v: 1 | -1, cat, sub, label, at } }
export const marks = lsGet('marks', {});
export function setMark(post, v, label) {
  const prev = marks[post.id]?.v || 0;
  if (prev === v) { delete marks[post.id]; v = 0; } else marks[post.id] = { v, cat: post.cat, sub: post.sub, label, at: Date.now() };
  // learned weight moves by the change in vote
  const delta = v - prev;
  if (delta && post.sub) {
    settings.learned[post.cat] = settings.learned[post.cat] || {};
    const cur = settings.learned[post.cat][post.sub] ?? 1;
    settings.learned[post.cat][post.sub] = Math.max(0.25, Math.min(4, cur * Math.pow(1.15, delta)));
    saveSettings();
  }
  lsSet('marks', marks);
  return v;
}

// seen posts, per package
const seenCache = {};
export function seenSet(pkgId) {
  if (!seenCache[pkgId]) seenCache[pkgId] = new Set(lsGet(`seen:${pkgId}`, []));
  return seenCache[pkgId];
}
let seenTimer;
export function markSeen(pkgId, id) {
  const s = seenSet(pkgId);
  if (s.has(id)) return false;
  s.add(id);
  clearTimeout(seenTimer);
  seenTimer = setTimeout(() => lsSet(`seen:${pkgId}`, [...s]), 800);
  return true;
}
export function flushSeen() { for (const [k, s] of Object.entries(seenCache)) lsSet(`seen:${k}`, [...s]); }
export function resetSeen(pkgId) { seenCache[pkgId] = new Set(); lsSet(`seen:${pkgId}`, []); }
