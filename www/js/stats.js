// Usage tracking: time on app, time of day, sessions, posts viewed, dwell, scroll distance.
import { lsGet, lsSet } from './store.js';
import { dayKey, fmtDur, el } from './util.js';
import { CATS, CAT_LABEL, settings } from './state.js';

const IDLE_MS = 5 * 60 * 1000;      // stop counting after 5 minutes without touching anything
const NEW_SESSION_MS = 60 * 1000;   // a gap this long starts a new session
const PX_TO_M = 0.000159;           // one CSS px is roughly 1/160 inch on phones

const data = lsGet('stats', { days: {} });
let lastInteract = Date.now();
let lastTick = 0;
let session = null;
let listeners = [];
let dirty = false;

function day(k = dayKey()) {
  return (data.days[k] ||= { sec: 0, h: Array(24).fill(0), posts: 0, cats: {}, dwell: {}, views: {}, skips: 0, scroll: 0, sessions: 0, longest: 0, selfcare: 0 });
}
function save() { if (dirty) { lsSet('stats', data); dirty = false; } }

export function interact() { lastInteract = Date.now(); }
export function onTick(fn) { listeners.push(fn); }
export const today = () => day();
export const sessionSec = () => session?.sec || 0;

export function init() {
  ['pointerdown', 'wheel', 'keydown', 'touchmove'].forEach((e) => addEventListener(e, interact, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { endSessionMaybe(); save(); } else interact(); });
  setInterval(tick, 1000);
  setInterval(save, 5000);
  addEventListener('pagehide', save);
  tick();
}
function endSessionMaybe() { if (session) session.hiddenAt = Date.now(); }

function tick() {
  const now = Date.now();
  const visible = !document.hidden;
  if (visible && now - lastInteract < IDLE_MS) {
    if (!session || (session.hiddenAt && now - session.hiddenAt > NEW_SESSION_MS) || now - session.last > NEW_SESSION_MS) {
      session = { start: now, sec: 0, last: now };
      day().sessions++;
    }
    session.hiddenAt = 0;
    const dt = lastTick ? Math.min(2, (now - lastTick) / 1000) : 1;
    const d = day();
    d.sec += dt;
    d.h[new Date().getHours()] += dt;
    session.sec += dt;
    session.last = now;
    if (session.sec > d.longest) d.longest = session.sec;
    dirty = true;
  }
  lastTick = now;
  const d = day();
  listeners.forEach((fn) => fn(d, session));
}

export function view(post, dwellMs, isNew) {
  const d = day();
  if (isNew) { d.posts++; d.cats[post.cat] = (d.cats[post.cat] || 0) + 1; }
  d.dwell[post.cat] = (d.dwell[post.cat] || 0) + dwellMs;
  d.views[post.cat] = (d.views[post.cat] || 0) + 1;
  if (dwellMs < 1500) d.skips++;
  dirty = true;
}
export function scrolled(px) { day().scroll += Math.abs(px); dirty = true; }
export function selfcareDone() { day().selfcare++; dirty = true; }
export function resetStats() { data.days = {}; dirty = true; save(); }
export function exportStats() { return data; }

function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const k = dayKey(dt);
    out.push([k, data.days[k] || { sec: 0, h: Array(24).fill(0), posts: 0, cats: {}, dwell: {}, views: {}, skips: 0, scroll: 0, sessions: 0, longest: 0, selfcare: 0 }, dt]);
  }
  return out;
}
export function weekSummary() {
  const days = lastDays(7).map(([, d]) => d);
  const sum = (f) => days.reduce((s, d) => s + f(d), 0);
  const dwell = {}, views = {};
  for (const d of days) for (const c of CATS) { dwell[c] = (dwell[c] || 0) + (d.dwell[c] || 0); views[c] = (views[c] || 0) + (d.views[c] || 0); }
  return {
    sec: sum((d) => d.sec), posts: sum((d) => d.posts), sessions: sum((d) => d.sessions), skips: sum((d) => d.skips), scroll: sum((d) => d.scroll),
    selfcare: sum((d) => d.selfcare), longest: Math.max(0, ...days.map((d) => d.longest)),
    hours: Array.from({ length: 24 }, (_, h) => sum((d) => d.h[h] || 0)),
    avgDwell: Object.fromEntries(CATS.map((c) => [c, views[c] ? dwell[c] / views[c] / 1000 : 0])), views
  };
}

// ------------------------------------------------------------------ rendering
const NS = 'http://www.w3.org/2000/svg';
function svg(w, h, kids) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.innerHTML = kids;
  return s;
}
function barChart(values, labels, { h = 120, color = '#e8742a', fmt = (v) => v, hi = -1 } = {}) {
  const w = 320, pad = 18, bw = (w - 8) / values.length;
  const max = Math.max(1, ...values);
  let k = '';
  values.forEach((v, i) => {
    const bh = (v / max) * (h - pad - 16);
    const x = 4 + i * bw + bw * 0.15, y = h - pad - bh;
    k += `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${Math.max(1, bh)}" rx="3" fill="${i === hi ? '#ff7a1a' : color}" opacity="${v ? 1 : 0.35}"/>`;
    if (labels[i]) k += `<text x="${x + bw * 0.35}" y="${h - 4}" fill="#a49482" font-size="9" text-anchor="middle">${labels[i]}</text>`;
    if (v && values.length <= 7) k += `<text x="${x + bw * 0.35}" y="${y - 4}" fill="#d8c3a5" font-size="9" text-anchor="middle">${fmt(v)}</text>`;
  });
  return svg(w, h, k);
}
function ring(p) {
  const r = 42, c = 2 * Math.PI * r;
  return svg(110, 110, `<circle cx="55" cy="55" r="${r}" fill="none" stroke="#3a2f27" stroke-width="11"/>
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="#ff7a1a" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 55 55)"/>
    <text x="55" y="61" text-anchor="middle" fill="#ece0d1" font-size="19" font-weight="700" font-family="monospace">${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%</text>`);
}
function bars(rows) {
  return el('div.bars', rows.map(([label, frac, num]) => el('div.row', el('span', label), el('div.track', el('div.fill', { style: { width: `${Math.min(100, frac * 100)}%` } })), el('span.num', num))));
}

export function render(container, { pkg, seen }) {
  const d = day();
  const wk = weekSummary();
  const days = lastDays(7);
  const totalPosts = pkg ? pkg.manifest.total : 0;
  const pct = totalPosts ? seen.size / totalPosts : 0;
  const perCat = {};
  if (pkg) for (const [c, list] of Object.entries(pkg.posts)) perCat[c] = { total: list.length, seen: list.reduce((n, p) => n + (seen.has(p.id) ? 1 : 0), 0) };
  const rate = d.sec > 60 ? (d.posts / (d.sec / 60)).toFixed(1) : '–';
  const budget = settings.dailyBudgetMin * 60;
  const peakHour = wk.hours.indexOf(Math.max(...wk.hours));
  const remainingH = pkg ? Object.entries(perCat).reduce((s, [c, v]) => s + (v.total - v.seen) * (wk.avgDwell[c] || 15), 0) / 3600 : 0;

  container.replaceChildren(
    el('div.tiles',
      el('div.tile', el('b', fmtDur(d.sec, true)), el('span', budget ? `today · budget ${fmtDur(budget, true)}` : 'today')),
      el('div.tile', el('b', d.posts), el('span', `posts today · ${rate}/min`)),
      el('div.tile', el('b', d.sessions), el('span', `sessions today · longest ${fmtDur(d.longest, true)}`)),
      el('div.tile', el('b', `${(d.scroll * PX_TO_M).toFixed(1)} m`), el('span', 'scrolled today'))
    ),
    el('div.panel', el('h3', 'Last 7 days'),
      barChart(days.map(([, x]) => x.sec / 60), days.map(([, , dt]) => 'SMTWTFS'[dt.getDay()]), { fmt: (v) => (v >= 60 ? `${(v / 60).toFixed(1)}h` : `${Math.round(v)}m`), hi: 6 }),
      el('p.note', `${fmtDur(wk.sec, true)} this week · ${wk.posts} posts · ${wk.sessions} sessions · average session ${wk.sessions ? fmtDur(wk.sec / wk.sessions, true) : '–'}`)),
    el('div.panel', el('h3', 'Time of day (7 days)'),
      barChart(wk.hours.map((s) => s / 60), wk.hours.map((_, h) => (h % 6 === 0 ? `${h}h` : '')), { h: 100, color: '#c9952b', hi: wk.sec ? peakHour : -1 }),
      el('p.note', wk.sec ? `Most active around ${peakHour}:00. ${Math.round((wk.hours.slice(22).concat(wk.hours.slice(0, 5)).reduce((a, b) => a + b, 0) / Math.max(1, wk.sec)) * 100)}% of your time is late at night (10pm–5am).` : 'No usage yet this week.')),
    el('div.panel', el('h3', 'Package progress'),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        el('div', { style: { width: '110px', flex: 'none' } }, ring(pct)),
        el('p.note', pkg ? `${seen.size.toLocaleString()} of ${totalPosts.toLocaleString()} posts viewed in ${pkg.manifest.id}. About ${remainingH.toFixed(1)} hours of content left at your pace.` : 'No package loaded.')),
      bars(Object.entries(perCat).map(([c, v]) => [CAT_LABEL[c] || c, v.total ? v.seen / v.total : 0, `${v.seen}/${v.total}`]))),
    el('div.panel', el('h3', 'Scrolling habits (7 days)'),
      bars(CATS.filter((c) => wk.views[c]).map((c) => [CAT_LABEL[c], wk.avgDwell[c] / 60, `${wk.avgDwell[c].toFixed(1)}s`])),
      el('p.note', `Average time per post by category. ${wk.posts ? Math.round((wk.skips / Math.max(1, Object.values(wk.views).reduce((a, b) => a + b, 0))) * 100) : 0}% of posts were skipped in under 1.5 seconds. ${wk.selfcare} self-care prompts done this week. Scrolled ${(wk.scroll * PX_TO_M).toFixed(0)} m in 7 days.`))
  );
}
