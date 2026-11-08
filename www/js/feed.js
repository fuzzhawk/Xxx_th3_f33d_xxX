import { el, weightedPick, fmtDur } from './util.js';
import { settings, saveSettings, pctFor, subWeight, seenSet, markSeen, resetSeen, CATS, CAT_LABEL } from './state.js';
import { renderCard, notice } from './cards.js';
import { GAMES, GAME_NAMES, upgradeGamePost } from './games/all.js';
import * as stats from './stats.js';
import { getMode } from './modes.js';
import { mindPost, greetingPost } from './mindful.js';

// Morning and evening feeds: package posts (articles, videos, quotes, poems) mixed with cards made
// on the phone (body and breath, prompts, dream guides, scenes, worlds) and the garden.
const MODE_MIX = {
  morning: { body: 2.2, affirm: 1.6, cells: 1.5, garden: 0.9, wiki: 2.6, video: 2.4, quote: 2.4 },
  evening: { guide: 1.1, scene: 1.4, world: 1.4, cells: 1.2, garden: 0.9, wiki: 2.5, poem: 2.2, quote: 2.4 }
};
const PKG_KIND = (p) => (p.cat === 'read' ? 'poem' : p.cat);
// one shared garden: every garden card opens the same saved garden
export const gardenPost = (mode, n = 0) => ({ id: `garden-${mode}-${Date.now().toString(36)}-${n}`, cat: 'game', sub: 'garden', seed: 7, title: 'Your garden', mode, mods: [] });

// Activates heavy cards when they are mostly visible, tears them down when they
// leave the screen, and (optionally) measures dwell time per post.
export class CardObserver {
  constructor(root, { onDwell } = {}) {
    this.onDwell = onDwell;
    this.active = new Set();
    this.dwell = new Map();
    this.io = new IntersectionObserver((entries) => entries.forEach((e) => this.update(e)), { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { [...this.dwell.keys()].forEach((c) => this.endDwell(c)); [...this.active].forEach((c) => this.deactivate(c)); }
    });
    this.root = root;
  }
  add(card) { this.io.observe(card); }
  remove(card) { this.io.unobserve(card); this.deactivate(card); this.endDwell(card); }
  update(e) {
    const card = e.target;
    const vh = (this.root || document.documentElement).clientHeight || innerHeight;
    const seen = e.intersectionRatio >= 0.6 || e.intersectionRect.height >= vh * 0.55;
    if (card._heavy) {
      if (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= vh * 0.5) this.activate(card);
      else if (!e.isIntersecting) this.deactivate(card);
    }
    if (this.onDwell) {
      if (seen && !this.dwell.has(card) && !document.hidden) this.dwell.set(card, performance.now());
      else if (!seen && e.intersectionRatio < 0.25) this.endDwell(card);
    }
  }
  activate(card) {
    if (this.active.has(card) || !card._activate) return;
    if (card.dataset.cat === 'video') for (const c of this.active) if (c.dataset.cat === 'video') this.deactivate(c);
    this.active.add(card);
    try { card._activate(); } catch (err) { console.error('activate failed', err); }
  }
  deactivate(card) {
    if (!this.active.has(card)) return;
    this.active.delete(card);
    try { card._deactivate?.(); } catch (err) { console.error(err); }
  }
  endDwell(card) {
    const t = this.dwell.get(card);
    if (t == null) return;
    this.dwell.delete(card);
    this.onDwell?.(card, performance.now() - t);
  }
}

export class Feed {
  constructor(view, list, spacer, sentinel, stories) {
    this.view = view; this.list = list; this.spacer = spacer; this.sentinel = sentinel; this.storiesEl = stories;
    this.focus = null;
    this.obs = new CardObserver(view, { onDwell: (card, ms) => this.dwelled(card, ms) });
    this.more = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) this.append(8); }, { root: view, rootMargin: '1400px 0px' });
    this.more.observe(sentinel);
    let lastY = 0;
    view.addEventListener('scroll', () => { const y = view.scrollTop; stats.scrolled(y - lastY); lastY = y; }, { passive: true });
  }

  setMode(m) {
    this.mode = m;
    if (!this.pkg) return;
    this.focus = null; this.focusSub = null;
    [...this.list.children].forEach((c) => this.obs.remove(c));
    this.list.replaceChildren();
    this.spacer.style.height = '0px';
    this.rebuildPools();
    this.modeN = 0; this.lastGarden = -99; this.lastKind = null; this.ended = false;
    this.renderStories();
    this.view.scrollTop = 0;
    this.append(8);
  }
  load(pkg) {
    this.mode = getMode();
    this.modeN = 0; this.lastGarden = -99; this.lastKind = null; this.lastDayGarden = -10;
    this.pkg = pkg;
    const games = pkg.posts?.game;
    for (const p of (Array.isArray(games) ? games : games?.posts) || []) upgradeGamePost(p);
    this.ctx = { pkgId: pkg.manifest.id, topics: pkg.manifest.topics };
    this.rebuildPools();
    this.emitted = Object.fromEntries(CATS.map((c) => [c, 0]));
    this.total = 0;
    this.last = null;
    this.lastSelfcare = Date.now();
    this.lastNudge = 0;
    this.ended = false;
    [...this.list.children].forEach((c) => this.obs.remove(c));
    this.list.replaceChildren();
    this.spacer.style.height = '0px';
    this.view.scrollTop = 0;
    this.renderStories();
    this.append(10);
  }

  // Instagram-style "stories": one bubble per kind of post; tapping one focuses the feed on it.
  renderStories() {
    if (!this.storiesEl) return;
    if (this.mode && this.mode !== 'day') { this.storiesEl.replaceChildren(); return; }
    const FACE = { all: ['✦', '#2a2420'], game: ['◐', '#5e6b3a'], wiki: ['W', '#3a3530'], video: ['▶', '#9b3d1f'], meme: ['☺', '#8c5a3c'], product: ['✧', '#a07a22'], psych: ['✺', '#6d4a8c'], selfcare: ['☘', '#4f7a6f'], web: ['⌘', '#3a5a6a'], oracle: ['☯', '#5a3a6a'], power: ['⚔', '#8a4a1a'], read: ['❧', '#6a5a3a'], studio: ['✎', '#3a6a5a'], news: ['◉', '#8a2b2b'] };
    const NAME = { all: 'For you', game: 'Games', wiki: 'Wiki', video: 'Videos', meme: 'Memes', product: 'Shop', psych: 'Trip', selfcare: 'Breathe', web: 'Web', oracle: 'Oracle', power: 'Versus', read: 'Read', studio: 'Studio', news: 'News' };
    const items = ['all', ...CATS.filter((c) => this.remaining(c) > 0)];
    const bubble = (c) => el(`button.story${(this.focus || 'all') === c ? '.on' : ''}`, { onclick: () => this.setFocus(c === 'all' ? null : c) },
      el('div.ring', el('div.face', { style: { background: FACE[c][1] } }, FACE[c][0])), el('span', NAME[c] || CAT_LABEL[c]));
    this.storiesEl.replaceChildren(el('div.stories', items.map(bubble)),
      this.focus ? el('div.focusbar', el('span', 'Showing only ', el('b', this.focusSub ? this.subLabel(this.focus, this.focusSub) : CAT_LABEL[this.focus])), el('button.btn.small', { onclick: () => this.setFocus(null) }, 'Show everything')) : '');
  }
  subLabel(cat, sub) {
    const t = this.pkg?.manifest.topics?.[cat]?.[sub] || (cat === 'game' && GAME_NAMES[sub]);
    return t || String(sub).replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }
  // Posts of one kind (and optionally one sub-type, e.g. a single game), as listed in Settings → Jump to.
  setFocus(cat, sub = null) {
    this.focus = cat; this.focusSub = cat ? sub : null;
    [...this.list.children].forEach((c) => this.obs.remove(c));
    this.list.replaceChildren();
    this.spacer.style.height = '0px';
    this.rebuildPools();
    this.ended = false;
    this.renderStories();
    this.view.scrollTop = 0;
    this.append(8);
  }

  rebuildPools() {
    const seen = seenSet(this.pkg.manifest.id);
    this.pools = {};
    for (const [cat, posts] of Object.entries(this.pkg.posts)) {
      const bySub = new Map();
      for (const p of posts) {
        if (seen.has(p.id)) continue;
        if (p.nsfw && !settings.showNsfw) continue;
        const k = p.sub || '_';
        if (!bySub.has(k)) bySub.set(k, []);
        bySub.get(k).push(p);
      }
      this.pools[cat] = bySub;
    }
    // morning and evening posts by kind (wiki, video, quote, poem), shuffled
    this.modePools = {};
    for (const m of ['morning', 'evening']) {
      const by = {};
      for (const p of this.pkg.posts[m] || []) if (!seen.has(p.id)) (by[PKG_KIND(p)] ||= []).push(p);
      for (const l of Object.values(by)) l.sort(() => Math.random() - 0.5);
      this.modePools[m] = by;
    }
  }
  nextModePost() {
    const m = this.mode, n = this.modeN++;
    if (n === 0) return greetingPost(m);
    const pool = this.modePools[m] || {}, mix = MODE_MIX[m];
    const PKG = ['wiki', 'video', 'quote', 'poem'];
    const ok = (k) => {
      if (k === this.lastKind) return false;
      if (k === 'garden') return n >= 2 && n - this.lastGarden >= 5;
      if (PKG.includes(k)) return (pool[k]?.length || 0) > 0 && !(k === 'video' && !navigator.onLine);
      return true;
    };
    // the garden comes early (third card) and then every so often
    let kind = n === 2 ? 'garden' : weightedPick(Object.keys(mix).filter(ok).map((k) => [k, mix[k]]));
    kind ||= Object.keys(mix).find((k) => !PKG.includes(k) && k !== 'garden');
    this.lastKind = kind;
    if (kind === 'garden') { this.lastGarden = n; return gardenPost(m, n); }
    if (pool[kind]?.length) return pool[kind].shift();
    return mindPost(kind, m);
  }
  remaining(cat) { let n = 0; for (const l of this.pools[cat]?.values() || []) n += l.length; return n; }

  // Weighted round-robin: the category furthest behind its target share goes next.
  nextPost() {
    const now = Date.now();
    if (this.mode && this.mode !== 'day' && !this.focus) return this.nextModePost();
    // the garden visits the day feed too, every couple of dozen posts
    if (!this.focus && settings.gardenInFeed !== false && this.total - (this.lastDayGarden ?? -10) >= 22) { this.lastDayGarden = this.total; this.total++; return gardenPost('day', this.total); }
    // and the two whole games (Vitriol's story, Cave Crawler), taking turns, every dozen and a half
    if (!this.focus && this.total - (this.lastExt ?? -8) >= 17) {
      this.lastExt = this.total; this.total++;
      const sub = (this.extTurn = (this.extTurn || 0) + 1) % 2 ? 'cavecrawler' : 'vitriol';
      return { id: `${sub}-${Date.now().toString(36)}-${this.total}`, cat: 'game', sub, seed: (Math.random() * 1e9) | 0, title: sub === 'vitriol' ? 'Vitriol' : 'Cave Crawler', mods: [] };
    }
    if (this.focus && this.focusSub) {
      const l = this.pools[this.focus]?.get(this.focusSub);
      if (l?.length) { this.emitted[this.focus]++; this.total++; this.last = this.focus; return l.shift(); }
      // a game the package has no more of (or none at all yet): deal a fresh one
      if (this.focus === 'game' && GAMES[this.focusSub]) return this.freshGame(this.focusSub);
      this.focusSub = null; this.renderStories();
    }
    if (this.focus) {
      if (this.remaining(this.focus)) return this.take(this.focus);
      this.focus = null; this.renderStories();
    }
    if (settings.selfcareEveryMin > 0 && now - this.lastSelfcare > settings.selfcareEveryMin * 60000 && this.remaining('selfcare')) return this.take('selfcare');
    const pct = pctFor(this.pkg.manifest);
    const avail = CATS.filter((c) => pct[c] > 0 && this.remaining(c) > 0 && !(c === 'video' && settings.skipVideosOffline && !navigator.onLine));
    if (!avail.length) return null;
    const sum = avail.reduce((s, c) => s + pct[c], 0);
    let best = null, bestScore = -Infinity;
    for (const c of avail) {
      let score = (pct[c] / sum) * (this.total + 1) - this.emitted[c] + Math.random() * 0.35;
      if (settings.avoidRepeat && c === this.last && avail.length > 1) score -= 1;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return this.take(best);
  }
  freshGame(sub) {
    const seed = Math.floor(Math.random() * 2 ** 31), ADJ = ['Ember', 'Moss', 'Rust', 'Ochre', 'Dusk', 'Ash', 'Copper', 'Sage', 'Cinder', 'Lichen', 'Obsidian', 'Driftwood'];
    const name = GAME_NAMES[sub] || sub;
    return { id: `gx${seed.toString(36)}`, cat: 'game', sub, seed, title: `${ADJ[seed % ADJ.length]} ${name}`, theme: { proc: true, name: `${ADJ[(seed >>> 4) % ADJ.length]} ${name}`, hue: seed % 360, seed } };
  }
  take(cat) {
    const subs = [...this.pools[cat].entries()].filter(([, l]) => l.length);
    const sub = weightedPick(subs.map(([k]) => [k, subWeight(cat, k)]));
    const post = this.pools[cat].get(sub).shift();
    this.emitted[cat]++; this.total++; this.last = cat;
    if (cat === 'selfcare') this.lastSelfcare = Date.now();
    return post;
  }

  append(n) {
    if (!this.pkg) return;
    for (let i = 0; i < n; i++) {
      const extra = this.maybeNudge();
      if (extra) this.list.append(extra);
      const post = this.nextPost();
      if (!post) { this.end(); break; }
      const card = renderCard(post, this.ctx);
      if (!card) continue;
      this.list.append(card);
      this.obs.add(card);
    }
    this.trim();
  }
  maybeNudge() {
    const every = (settings.doomscrollMin ?? 30) * 60, sess = stats.sessionSec();
    if (every > 0 && sess >= every * ((this.warned || 0) + 1)) { this.warned = Math.floor(sess / every); return doomscrollCard(sess); }
    if (every > 0 && sess < every) this.warned = 0;
    const budget = settings.dailyBudgetMin * 60;
    if (!budget) return null;
    const used = stats.today().sec;
    if (used < budget || Date.now() - this.lastNudge < 15 * 60000) return null;
    this.lastNudge = Date.now();
    return notice('Over your daily budget', `You set ${fmtDur(budget, true)} a day and you have used ${fmtDur(used, true)}. The feed will still be here tomorrow.`,
      [el('button.btn.primary', { onclick: () => document.querySelector('[data-tab=settings]').click() }, 'Adjust budget')]);
  }
  end() {
    if (this.ended) return;
    this.ended = true;
    if (settings.repeatWhenDone) {
      resetSeen(this.pkg.manifest.id);
      this.rebuildPools();
      this.ended = false;
      this.list.append(notice('Starting the package over', 'You have seen every post in this package. Repeats are on, so it is starting again.'));
      return;
    }
    this.list.append(notice('You reached the end of this package', 'Every post in this week\'s package has been viewed. Grab the next package in Settings, or turn on repeats.', [
      el('button.btn.primary', { onclick: () => document.querySelector('[data-tab=settings]').click() }, 'Get the next package'),
      el('button.btn', { onclick: () => { settings.repeatWhenDone = true; saveSettings(); this.ended = false; this.end(); } }, 'Repeat this one')
    ]));
  }
  // Keep the DOM small during long sessions: drop old cards, preserve scroll position.
  trim() {
    const cards = this.list.children;
    if (cards.length <= 90) return;
    let h = 0;
    const gap = 0;
    const drop = [...cards].slice(0, 30);
    for (const c of drop) { h += c.offsetHeight + gap; this.obs.remove(c); c.remove(); }
    this.spacer.style.height = `${(parseFloat(this.spacer.style.height) || 0) + h}px`;
  }
  dwelled(card, ms) {
    const post = card._post;
    if (!post || ms < 700) return;
    const isNew = markSeen(this.pkg.manifest.id, post.id);
    stats.view(post, ms, isNew);
  }
}

// ------------------------------------------------ doomscroll warning
const BREAKS = ['Stand up and stretch your arms over your head.', 'Look at something at least six metres away for twenty seconds.', 'Drink a glass of water.', 'Step outside and find three different sounds.', 'Text someone you actually like.', 'Put your phone in another room for ten minutes.', 'Do five slow breaths: four in, six out.', 'Wash your face with cold water.', 'Make a cup of tea and drink it without a screen.', 'Write down one thing you want to do today that isn’t this.'];
function doomscrollCard(sec) {
  const min = Math.round(sec / 60), tip = BREAKS[Math.floor(Math.random() * BREAKS.length)];
  const card = el('article.notice.doom',
    el('div.doom-icon', '⏳'),
    el('h3', `You’ve been scrolling for ${min} minutes`),
    el('p', `This is your ${min >= 60 ? 'gentle-but-firm' : 'gentle'} reminder that the feed will still be here later. ${tip}`),
    el('div.btnrow', { style: { justifyContent: 'center' } },
      el('button.btn.primary', { onclick: () => takeBreak(tip) }, 'Take a 2-minute break'),
      el('button.btn', { onclick: () => card.remove() }, 'Keep scrolling')));
  return card;
}
function takeBreak(tip) {
  let left = 120;
  const n = el('div.doom-count', '2:00');
  const veil = el('div.doom-veil', el('div.doom-box', el('h2', 'Break time'), el('p', tip), n, el('div.ball'), el('button.btn', { onclick: () => close() }, 'End break')));
  const iv = setInterval(() => { left--; n.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 0) close(); }, 1000);
  const close = () => { clearInterval(iv); veil.remove(); };
  document.body.append(veil);
}
