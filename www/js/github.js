// Feedback export and sync. Without a token, feedback is copied to the clipboard
// to paste into a chat; with a token it is committed to the repo under feedback/.
import { settings, saveSettings, marks, pctFor, seenSet, CATS } from './state.js';
import * as favs from './favs.js';
import { weekSummary } from './stats.js';
import { b64utf8, dayKey } from './util.js';
import { labelOf } from './cards.js';

const brief = (p) => {
  const o = { id: p.id, cat: p.cat, sub: p.sub, label: labelOf(p) };
  if (p.url) o.url = p.url;
  if (p.vid) o.vid = p.vid;
  if (p.link) o.link = p.link;
  return o;
};

export function buildFeedback(pkg) {
  const wk = weekSummary();
  const seen = pkg ? seenSet(pkg.manifest.id) : new Set();
  const perCat = {};
  if (pkg) for (const c of CATS) { const l = pkg.posts[c] || []; perCat[c] = { total: l.length, viewed: l.filter((p) => seen.has(p.id)).length, avgDwellSec: +(wk.avgDwell[c] || 0).toFixed(1) }; }
  const markList = Object.entries(marks).map(([id, m]) => ({ id, v: m.v, cat: m.cat, sub: m.sub, label: m.label }));
  return {
    generatedAt: new Date().toISOString(),
    package: pkg?.manifest.id,
    mix: pctFor(pkg?.manifest),
    subWeights: settings.subWeights,
    learned: settings.learned,
    usage7d: { hours: +(wk.sec / 3600).toFixed(1), posts: wk.posts, sessions: wk.sessions, skips: wk.skips, selfcareDone: wk.selfcare, byHour: wk.hours.map((s) => Math.round(s / 60)) },
    perCategory: perCat,
    favorites: favs.list('fav').map((f) => brief(f.post)),
    saved: favs.list('save').map((f) => brief(f.post)),
    moreLikeThis: markList.filter((m) => m.v > 0),
    lessLikeThis: markList.filter((m) => m.v < 0),
    promptEdited: !!settings.promptEdited
  };
}

async function gh(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${settings.repo}/${path}`, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${settings.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) }
  });
  if (!r.ok && r.status !== 404) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.status === 404 ? null : r.json();
}
async function putFile(path, content, message) {
  const ref = encodeURIComponent(settings.branch);
  const cur = await gh(`contents/${path}?ref=${ref}`);
  return gh(`contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: b64utf8(content), branch: settings.branch, sha: cur?.sha }) });
}

export async function sync(pkg, prompt) {
  if (!settings.token) throw new Error('Add a GitHub token first.');
  const fb = buildFeedback(pkg);
  const json = JSON.stringify(fb, null, 2);
  const id = pkg?.manifest.id || 'unknown';
  await putFile(`feedback/${id}.json`, json, `Feedback for ${id} (${dayKey()})`);
  await putFile('feedback/latest.json', json, `Latest feedback (${dayKey()})`);
  if (settings.promptEdited && prompt) await putFile('packages/prompt.md', prompt, 'Update package prompt from the app');
  settings.lastSync = Date.now();
  saveSettings();
  return fb;
}
