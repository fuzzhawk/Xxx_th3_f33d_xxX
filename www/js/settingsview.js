import { el, toast, copyText, fmtDur } from './util.js';
import { settings, saveSettings, resetSettings, pctFor, CATS, CAT_LABEL, DEFAULT_PCT, seenSet, resetSeen, marks } from './state.js';
import { bundledIndex, remoteIndex, localIds, downloadPackage, deletePackage, checkForNew } from './packages.js';
import { precache, cacheSize, clearCache } from './images.js';
import * as favs from './favs.js';
import * as stats from './stats.js';
import { buildFeedback, sync } from './github.js';
import { lsGet, lsSet } from './store.js';

let root, app;
export function initSettings(view, appApi) { root = view; app = appApi; }

const group = (title, sub, ...kids) => el('div.group', el('h3', title), sub ? el('p.sub', sub) : null, el('div.box', ...kids));
function toggle(key, label, hint, after) {
  const input = el('input', { type: 'checkbox', checked: !!settings[key], onchange: () => { settings[key] = input.checked; saveSettings(); after?.(); } });
  return el('div.field', el('label', label, hint ? el('small', hint) : null), el('label.toggle', input, el('span')));
}
function number(key, label, hint, { min = 0, max = 999, step = 1 } = {}, after) {
  const input = el('input', { type: 'number', min, max, step, value: settings[key], onchange: () => { settings[key] = Math.max(min, Math.min(max, +input.value || 0)); saveSettings(); after?.(); } });
  return el('div.field', el('label', label, hint ? el('small', hint) : null), input);
}
function text(key, label, type = 'text', placeholder = '') {
  const input = el('input', { type, value: settings[key] || '', placeholder, autocomplete: 'off', onchange: () => { settings[key] = input.value.trim(); saveSettings(); } });
  return el('div.field', el('label', label), input);
}

export async function render() {
  const pkg = app.pkg();
  const man = pkg?.manifest;
  root.replaceChildren(el('div.settings', el('h2', 'Settings'),
    await packageGroup(man),
    balanceGroup(man),
    group('Display', null,
      window.Capacitor?.isNativePlatform?.() ? toggle('immersive', 'Full screen', 'Hide the Android navigation buttons. Swipe up from the bottom edge to show them.', () => app.applyImmersive()) : null,
      toggle('showNsfw', 'Adult comics', 'Include NSFW webcomics such as Oglaf', () => app.softReload()),
      toggle('blurNsfw', 'Blur adult comics until tapped')),
    group('Playback', null,
      toggle('autoplay', 'Autoplay videos', 'Videos start when they scroll into view'),
      toggle('startMuted', 'Start videos muted'),
      toggle('rememberSound', 'Keep sound on once unmuted', 'Next videos follow your last mute choice'),
      toggle('autopilot', 'Game autopilot', 'Games play themselves until you tap them'),
      toggle('reduceMotion', 'Calmer psychedelic visuals', 'Slows the animations down'),
      toggle('showWikiImages', 'Show Wikipedia thumbnails', 'Needs the network unless images are downloaded'),
      toggle('skipVideosOffline', 'Skip videos while offline')),
    group('Wellbeing', 'Gentle guard rails for the scroll.',
      number('dailyBudgetMin', 'Daily time budget (minutes)', '0 = no budget. The timer turns orange and the feed nudges you when you go over.', { max: 1440, step: 15 }),
      toggle('grayscaleOverBudget', 'Fade to grayscale over budget', 'Makes the feed less shiny once you pass your budget'),
      number('selfcareEveryMin', 'Self-care prompt at least every (minutes)', '0 = only at the normal 5% share', { max: 240, step: 5 }),
      toggle('repeatWhenDone', 'Repeat the package when it runs out')),
    promptGroup(man),
    feedbackGroup(pkg),
    group('Reset', null, el('div.btnrow',
      el('button.btn.danger', { onclick: () => { if (confirm('Mark every post in this package as unseen?')) { resetSeen(man.id); app.reload(); toast('Package progress reset'); } } }, 'Reset package progress'),
      el('button.btn.danger', { onclick: () => { if (confirm('Delete all usage stats?')) { stats.resetStats(); toast('Stats cleared'); } } }, 'Clear usage stats'),
      el('button.btn.danger', { onclick: () => { if (confirm('Reset all settings (keeps your token and package)?')) { resetSettings(); app.reload(); render(); } } }, 'Reset settings'))),
    group('About', null, el('div.kv', `The Feed · build ${window.BUILD?.sha || 'dev'} · ${window.BUILD?.branch || ''} · ${window.BUILD?.date || ''}`, el('br'),
      `Packages from github.com/${settings.repo} (${settings.branch})`))
  ));
}

// ---------------------------------------------------------------- packages
async function packageGroup(man) {
  const box = el('div');
  const status = el('p.sub');
  const draw = async (remote) => {
    const have = new Set(await localIds());
    const bundled = await bundledIndex();
    const known = new Map();
    [...bundled.packages, ...(remote?.packages || [])].forEach((p) => known.set(p.id, p));
    have.forEach((id) => known.has(id) || known.set(id, { id }));
    box.replaceChildren(...[...known.values()].sort((a, b) => b.id.localeCompare(a.id)).map((p) => {
      const local = have.has(p.id) || bundled.packages.some((b) => b.id === p.id);
      const cur = man?.id === p.id;
      const seen = seenSet(p.id).size;
      return el('div.pkg',
        el('div.info', el('b', p.id), el('small', `${p.total ? `${p.total.toLocaleString()} posts · ~${p.estHours}h` : ''}${seen ? ` · ${seen} seen` : ''}${local ? '' : ' · on GitHub'}`)),
        cur ? el('span.cur', 'CURRENT') : el('button.btn.small', { onclick: async (e) => {
          e.target.textContent = '…';
          try { if (!local) await downloadPackage(p.id); settings.pkg = p.id; saveSettings(); await app.reload(); toast(`Switched to ${p.id}`); render(); }
          catch (err) { toast(`Could not load: ${err.message}`); e.target.textContent = 'Use'; }
        } }, local ? 'Use' : 'Download'),
        have.has(p.id) && !cur ? el('button.btn.small', { onclick: async () => { await deletePackage(p.id); draw(remote); } }, '✕') : null);
    }));
  };
  await draw(null);
  const check = el('button.btn.primary', { onclick: async () => {
    check.textContent = 'Checking…';
    try {
      const { remote, fresh } = await checkForNew();
      await draw(remote);
      toast(fresh.length ? `${fresh.length} new package${fresh.length > 1 ? 's' : ''} on GitHub` : 'You have the latest package');
    } catch (err) { toast(`Could not reach GitHub: ${err.message}`); }
    check.textContent = 'Check for new packages';
  } }, 'Check for new packages');
  let stop = false;
  const imgBtn = el('button.btn', { onclick: async () => {
    const pkg = app.pkg();
    const urls = [...new Set([...(pkg.posts.meme || []).map((p) => p.img), ...(settings.showWikiImages ? (pkg.posts.wiki || []).map((p) => p.thumb) : [])].filter(Boolean))];
    stop = false;
    imgBtn.disabled = true;
    const ok = await precache(urls, (i, n, good) => { imgBtn.textContent = `Downloading ${i}/${n} (${good} saved)`; }, () => stop);
    imgBtn.disabled = false;
    imgBtn.textContent = 'Download images for offline';
    toast(`${ok} of ${urls.length} images saved for offline`);
    sizeLine.textContent = `${await cacheSize()} images stored on this device`;
  } }, 'Download images for offline');
  const sizeLine = el('p.sub', `${await cacheSize()} images stored on this device`);
  if (man) status.textContent = `${man.id}: ${man.total.toLocaleString()} posts, about ${man.estHours} hours. Built ${new Date(man.created).toLocaleDateString()}.`;
  return group('Package', null, status, box,
    el('div.btnrow', check, imgBtn, el('button.btn', { onclick: async () => { stop = true; await clearCache(); sizeLine.textContent = '0 images stored on this device'; toast('Image cache cleared'); } }, 'Clear images')),
    sizeLine,
    toggle('autoCheck', 'Check for new packages on launch'),
    toggle('cacheImages', 'Save images as you scroll', 'Memes and thumbnails you have seen keep working offline'),
    text('repo', 'GitHub repository'),
    text('branch', 'Branch'));
}

// ---------------------------------------------------------------- balance
function balanceGroup(man) {
  const pct = pctFor(man);
  const total = el('div.total');
  const vals = {};
  const refresh = () => {
    const sum = CATS.reduce((s, c) => s + pct[c], 0) || 1;
    CATS.forEach((c) => (vals[c].textContent = `${Math.round((pct[c] / sum) * 100)}%`));
    total.textContent = `raw total ${CATS.reduce((s, c) => s + pct[c], 0)} · shares are normalized to 100%`;
  };
  const rows = CATS.map((c) => {
    vals[c] = el('span.val');
    const input = el('input', { type: 'range', min: 0, max: 60, step: 1, value: pct[c], oninput: () => { pct[c] = +input.value; refresh(); },
      onchange: () => { settings.pct = { ...pct }; saveSettings(); app.softReload(); } });
    return el('div.field', el('label', CAT_LABEL[c], el('small', `${(app.pkg()?.posts[c] || []).length} in package`)), input, vals[c]);
  });
  refresh();
  const subGroup = (cat, title, labels) => {
    if (!labels) return null;
    return el('details.subw', el('summary', title), ...Object.entries(labels).map(([sub, label]) => {
      const w = settings.subWeights?.[cat]?.[sub] ?? 1;
      const learned = settings.learned?.[cat]?.[sub];
      const val = el('span.val', `${w.toFixed(1)}×`);
      const input = el('input', { type: 'range', min: 0, max: 3, step: 0.1, value: w,
        oninput: () => (val.textContent = `${(+input.value).toFixed(1)}×`),
        onchange: () => { settings.subWeights[cat] = { ...(settings.subWeights[cat] || {}), [sub]: +input.value }; saveSettings(); app.softReload(); } });
      return el('div.field', el('label', label, learned && Math.abs(learned - 1) > 0.01 ? el('small', `learned from marks: ${learned.toFixed(2)}×`) : null), input, val);
    }));
  };
  return group('Feed balance', 'How much of each kind of post you get. Changes apply to new posts as you scroll. News starts at 0% (hidden); tap News in the stories row to read it, or raise it here.',
    ...rows, total,
    el('div.btnrow', el('button.btn.small', { onclick: () => { settings.pct = null; saveSettings(); app.softReload(); render(); } }, 'Use package mix'),
      el('button.btn.small', { onclick: () => { settings.pct = { ...DEFAULT_PCT }; saveSettings(); app.softReload(); render(); } }, 'Original 20/30/20/10/5/5/5/5')),
    subGroup('wiki', 'Wikipedia topics', man?.topics?.wiki),
    subGroup('video', 'Video topics', man?.topics?.video),
    subGroup('game', 'Game types', man?.topics?.game),
    subGroup('web', 'Web sources', man?.topics?.web),
    subGroup('news', 'News sources', man?.topics?.news),
    toggle('avoidRepeat', 'Avoid the same kind twice in a row'),
    toggle('adaptive', 'Learn from ▲ / ▼ marks', 'Marks nudge topic weights up or down', () => app.softReload()),
    el('div.btnrow', el('button.btn.small', { onclick: () => { settings.learned = {}; saveSettings(); app.softReload(); toast('Learned weights cleared'); render(); } }, 'Forget learned weights'),
      el('button.btn.small', { onclick: () => { settings.subWeights = {}; saveSettings(); app.softReload(); render(); } }, 'Reset topic weights')));
}

// ---------------------------------------------------------------- prompt
function promptGroup(man) {
  const ta = el('textarea.prompt', { spellcheck: false }, settings.prompt ?? man?.prompt ?? '');
  return group('Package prompt', 'The spec used to generate the next package: post types, topics and percentages. Edit it here; syncing writes it to packages/prompt.md so the next build uses it.',
    ta,
    el('div.btnrow',
      el('button.btn.primary', { onclick: () => { settings.prompt = ta.value; settings.promptEdited = ta.value !== man?.prompt; saveSettings(); toast('Prompt saved on this device'); } }, 'Save'),
      el('button.btn', { onclick: async () => toast((await copyText(ta.value)) ? 'Prompt copied' : 'Copy failed') }, 'Copy'),
      el('button.btn', { onclick: () => { ta.value = man?.prompt || ''; settings.prompt = null; settings.promptEdited = false; saveSettings(); toast('Reset to the package prompt'); } }, 'Reset')));
}

// ---------------------------------------------------------------- feedback
function feedbackGroup(pkg) {
  const nf = favs.list('fav').length, ns = favs.list('save').length, nm = Object.keys(marks).length;
  const last = settings.lastSync ? `Last synced ${new Date(settings.lastSync).toLocaleString()}.` : 'Not synced yet.';
  const status = el('p.sub', `${nf} favorites, ${ns} saved, ${nm} marks. ${last}`);
  const syncBtn = el('button.btn.primary', { onclick: async () => {
    syncBtn.textContent = 'Syncing…';
    try { await sync(pkg, settings.prompt ?? pkg?.manifest.prompt); toast('Feedback synced to GitHub'); status.textContent = `${nf} favorites, ${ns} saved, ${nm} marks. Synced just now.`; }
    catch (err) { toast(err.message, 4000); }
    syncBtn.textContent = 'Sync to GitHub';
  } }, 'Sync to GitHub');
  const backupBox = el('textarea.prompt', { style: { minHeight: '90px', display: 'none' }, placeholder: 'Paste a backup here, then tap Import' });
  return group('Feedback & sync', 'Your favorites, saves, marks and usage guide the next package. Sync them to the repo, or copy them and paste into the chat when you ask for the next package.',
    status,
    el('div.btnrow', syncBtn, el('button.btn', { onclick: async () => toast((await copyText(JSON.stringify(buildFeedback(pkg), null, 1))) ? 'Feedback copied' : 'Copy failed') }, 'Copy feedback')),
    text('token', 'GitHub token', 'password', 'fine-grained token, Contents: read & write'),
    el('p.sub', 'Create a fine-grained token on GitHub limited to this repository with Contents read and write. It is stored only on this phone.'),
    el('div.btnrow',
      el('button.btn.small', { onclick: async () => { const b = { settings: { ...settings, token: '' }, marks, favs: favs.all(), stats: stats.exportStats(), seen: Object.fromEntries((await localIds()).map((id) => [id, [...seenSet(id)]])) }; toast((await copyText(JSON.stringify(b))) ? 'Backup copied to clipboard' : 'Copy failed'); } }, 'Copy backup'),
      el('button.btn.small', { onclick: () => { backupBox.style.display = backupBox.style.display === 'none' ? '' : 'none'; } }, 'Import backup…')),
    backupBox,
    el('div.btnrow', el('button.btn.small', { onclick: async () => {
      if (!backupBox.value.trim()) return;
      try {
        const b = JSON.parse(backupBox.value);
        const token = settings.token;
        if (b.settings) { Object.assign(settings, b.settings, { token }); saveSettings(); }
        if (b.marks) { lsSet('marks', b.marks); }
        if (b.stats) lsSet('stats', b.stats);
        if (b.seen) for (const [id, list] of Object.entries(b.seen)) lsSet(`seen:${id}`, list);
        for (const f of b.favs || []) if (!favs.has(f.kind, f.post.id)) favs.toggle(f.kind, f.post, f.pkg);
        toast('Backup imported. Restarting…');
        setTimeout(() => location.reload(), 900);
      } catch (err) { toast(`Import failed: ${err.message}`); }
    } }, 'Import')));
}
