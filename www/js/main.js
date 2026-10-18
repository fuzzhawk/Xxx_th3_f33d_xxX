import { $, $$, el, fmtDur, toast } from './util.js';
import { settings, saveSettings, seenSet, flushSeen } from './state.js';
import { initialPackage, loadPackage, checkForNew, downloadPackage } from './packages.js';
import { loadFavs } from './favs.js';
import * as stats from './stats.js';
import { Feed } from './feed.js';
import { notice } from './cards.js';
import { initFavs, render as renderFavs } from './favsview.js';
import { initSettings, render as renderSettings } from './settingsview.js';

let pkg = null;
const feed = new Feed($('#view-feed'), $('#feed'), $('#feed-spacer'), $('#feed-sentinel'));
const app = {
  pkg: () => pkg,
  async reload() { pkg = await loadPackage(settings.pkg); feed.load(pkg); },
  // settings changed: keep what is on screen, new posts follow the new mix
  softReload() { /* the scheduler reads settings live */ }
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
  if (b.dataset.tab === tab && tab === 'feed') $('#view-feed').scrollTo({ top: 0, behavior: 'smooth' });
  show(b.dataset.tab);
}));
addEventListener('popstate', () => {
  if (!$('#stats').hidden) { $('#stats').hidden = true; return; }
  show('feed', false);
});

// ---------------------------------------------------------------- timer + stats sheet
const timer = $('#timer');
stats.onTick((d) => {
  const t = fmtDur(d.sec);
  if (timer.textContent !== t) timer.textContent = t;
  const over = settings.dailyBudgetMin > 0 && d.sec > settings.dailyBudgetMin * 60;
  timer.classList.toggle('over', over);
  document.body.classList.toggle('gray', over && settings.grayscaleOverBudget);
  if (!$('#stats').hidden && Math.floor(d.sec) % 5 === 0) renderStats();
});
const renderStats = () => stats.render($('#stats-body'), { pkg, seen: pkg ? seenSet(pkg.manifest.id) : new Set() });
timer.addEventListener('click', () => { renderStats(); $('#stats').hidden = false; history.pushState({ sheet: 1 }, ''); });
$('#stats').addEventListener('click', (e) => { if (e.target.id === 'stats' || e.target.closest('[data-close]')) history.back(); });

// ---------------------------------------------------------------- boot
async function boot() {
  stats.init();
  await loadFavs().catch((e) => console.warn('favorites unavailable', e));
  initFavs($('#view-favs'), () => ({ topics: pkg?.manifest.topics }));
  initSettings($('#view-settings'), app);
  try {
    pkg = await initialPackage();
    feed.load(pkg);
  } catch (err) {
    console.error(err);
    $('#feed').append(notice('No package yet', `The app could not load a package (${err.message}). Connect to the internet and check Settings → Package.`,
      [el('button.btn.primary', { onclick: () => show('settings') }, 'Open settings')]));
    return;
  }
  if (settings.autoCheck && navigator.onLine) {
    try {
      const { fresh } = await checkForNew();
      const newest = fresh.at(-1);
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
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSeen(); });
boot();
