import { $, $$, el, fmtDur, toast } from './util.js';
import { settings, saveSettings, seenSet, flushSeen } from './state.js';
import { initialPackage, loadPackage, checkForNew, downloadPackage } from './packages.js';
import { loadFavs } from './favs.js';
import { loadKenney, setProps, setThemes } from './games/assets.js';
import * as stats from './stats.js';
import { Feed } from './feed.js';
import { notice } from './cards.js';
import { initFavs, render as renderFavs } from './favsview.js';
import { initSettings, render as renderSettings } from './settingsview.js';

let pkg = null;
const feed = new Feed($('#view-feed'), $('#feed'), $('#feed-spacer'), $('#feed-sentinel'), $('#stories'));

// Full-screen: hide Android's navigation buttons (native plugin; no-op in a browser).
export function applyImmersive() {
  try { window.Capacitor?.nativePromise?.('FeedNative', 'setImmersive', { on: !!settings.immersive })?.catch(() => {}); } catch { /* not native */ }
}
const app = {
  pkg: () => pkg,
  async reload() { pkg = await loadPackage(settings.pkg); setProps(pkg.sprites); setThemes(pkg.themes); feed.load(pkg); },
  // settings changed: keep what is on screen, new posts follow the new mix
  softReload() { /* the scheduler reads settings live */ },
  applyImmersive
};

// ---------------------------------------------------------------- tabs + back button
let tab = 'feed';
function show(name, push = true) {
  if (name === tab) return;
  tab = name;
  $$('nav#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'favs') renderFavs();
  if (name === 'settings') renderSettings();
  if (push && name !== 'feed') history.pushState({ tab: name }, '');
}
$$('nav#tabs button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.tab === 'stats') return openStats();
  if (b.dataset.tab === tab && tab === 'feed') $('#view-feed').scrollTo({ top: 0, behavior: 'smooth' });
  if (b.dataset.tab === 'settings') b.classList.remove('notify');
  show(b.dataset.tab);
  topbar.classList.remove('hide');
}));

// Top bar slides away while scrolling down, comes back on the way up.
const topbar = $('#top');
let lastY = 0;
$$('.view').forEach((v) => v.addEventListener('scroll', () => {
  const y = v.scrollTop;
  if (y > lastY + 6 && y > 120) topbar.classList.add('hide');
  else if (y < lastY - 6 || y < 60) topbar.classList.remove('hide');
  lastY = y;
}, { passive: true }));
addEventListener('popstate', () => {
  if (!$('#stats').hidden) { $('#stats').hidden = true; return; }
  show('feed', false);
});

// ---------------------------------------------------------------- timer + stats sheet
const timer = $('#timer');
const timerText = timer.querySelector('span');
stats.onTick((d) => {
  const t = fmtDur(d.sec);
  if (timerText.textContent !== t) timerText.textContent = t;
  const over = settings.dailyBudgetMin > 0 && d.sec > settings.dailyBudgetMin * 60;
  timer.classList.toggle('over', over);
  document.body.classList.toggle('gray', over && settings.grayscaleOverBudget);
  if (!$('#stats').hidden && Math.floor(d.sec) % 5 === 0) renderStats();
});
const renderStats = () => stats.render($('#stats-body'), { pkg, seen: pkg ? seenSet(pkg.manifest.id) : new Set() });
function openStats() { renderStats(); $('#stats').hidden = false; history.pushState({ sheet: 1 }, ''); }
timer.addEventListener('click', openStats);
$('#stats').addEventListener('click', (e) => { if (e.target.id === 'stats' || e.target.closest('[data-close]')) history.back(); });

// ---------------------------------------------------------------- boot
async function boot() {
  stats.init();
  applyImmersive();
  loadKenney();
  await loadFavs().catch((e) => console.warn('favorites unavailable', e));
  initFavs($('#view-favs'), () => ({ topics: pkg?.manifest.topics }));
  initSettings($('#view-settings'), app);
  try {
    pkg = await initialPackage();
    setProps(pkg.sprites); setThemes(pkg.themes);
    feed.load(pkg);
  } catch (err) {
    console.error(err);
    $('#feed').append(notice('No package yet', `The app could not load a package (${err.message}). Connect to the internet and check Settings → Package.`,
      [el('button.btn.primary', { onclick: () => show('settings') }, 'Open settings')]));
    return;
  }
  if (settings.autoCheck && navigator.onLine) {
    try {
      const { remote, fresh } = await checkForNew();
      // same package id rebuilt on GitHub: refresh it quietly
      const same = remote.packages.find((p) => p.id === pkg.manifest.id);
      if (same && same.created > pkg.manifest.created) {
        try { pkg = await downloadPackage(same.id); setProps(pkg.sprites); setThemes(pkg.themes); toast(`Updated ${same.id} with the latest build`); feed.load(pkg); } catch { /* keep the old copy */ }
      }
      const newest = fresh.at(-1);
      if (newest) document.querySelector('[data-tab=settings]').classList.add('notify');
      if (newest && newest.id > pkg.manifest.id) {
        const card = notice(`New package: ${newest.id}`, `${newest.total?.toLocaleString() || 'A fresh'} posts, about ${newest.estHours || '?'} hours. Your current package is ${pkg.manifest.id}.`, [
          el('button.btn.primary', { onclick: async (e) => {
            e.target.textContent = 'Downloading…';
            try { await downloadPackage(newest.id); settings.pkg = newest.id; saveSettings(); await app.reload(); toast(`Switched to ${newest.id}`); }
            catch (er) { toast(`Download failed: ${er.message}`); e.target.textContent = 'Switch now'; }
          } }, 'Switch now'),
          el('button.btn', { onclick: () => card.remove() }, 'Later')
        ]);
        $('#feed').insertBefore(card, $('#feed').children[1] || null);
      }
    } catch { /* offline or rate-limited: fine */ }
  }
}
addEventListener('pagehide', flushSeen);
// web version: offline support (the Android app serves files itself)
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.() && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSeen(); });
boot();
