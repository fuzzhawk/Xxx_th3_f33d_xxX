// Packages come from two places: the copy bundled into the app at build time,
// and the GitHub repository (raw.githubusercontent.com), which is where new
// weekly packages appear. Downloaded packages are kept in IndexedDB.
import { idbGet, idbSet, idbKeys, idbDel } from './store.js';
import { settings, saveSettings } from './state.js';

const remoteBase = () => `https://raw.githubusercontent.com/${settings.repo}/${settings.branch}/packages/`;

async function getJSON(url, timeout = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function bundledIndex() {
  try { return await getJSON('bundled/index.json'); } catch { return { packages: [] }; }
}
export async function remoteIndex() { return getJSON(`${remoteBase()}index.json?t=${Date.now()}`); }

export async function localIds() {
  return (await idbKeys('kv')).filter((k) => String(k).startsWith('pkg:')).map((k) => k.slice(4));
}

async function fetchPackage(base, id, onProgress) {
  const manifest = await getJSON(`${base}${id}/manifest.json`);
  const posts = {};
  const entries = Object.entries(manifest.files);
  let i = 0;
  for (const [cat, file] of entries) {
    posts[cat] = await getJSON(`${base}${id}/${file}`, 60000);
    onProgress?.(++i / entries.length);
  }
  let sprites = [];
  if (manifest.sprites) { try { sprites = await getJSON(`${base}${id}/${manifest.sprites}`, 60000); } catch { /* optional */ } }
  let themes = [];
  if (manifest.themes) { try { themes = await getJSON(`${base}${id}/${manifest.themes}`, 60000); } catch { /* optional */ } }
  let textures = [];
  if (manifest.textures) { try { textures = await getJSON(`${base}${id}/${manifest.textures}`, 60000); } catch { /* optional */ } }
  let oracle = null;
  if (manifest.oracle) { try { oracle = await getJSON(`${base}${id}/${manifest.oracle}`, 60000); } catch { /* optional */ } }
  return { manifest, posts, sprites, themes, textures, oracle };
}

export async function downloadPackage(id, onProgress) {
  const pkg = await fetchPackage(remoteBase(), id, onProgress);
  await idbSet('kv', `pkg:${id}`, pkg);
  return pkg;
}

// Load a package by id: IndexedDB first, then the bundled copy, then GitHub.
export async function loadPackage(id) {
  const cached = await idbGet('kv', `pkg:${id}`);
  if (cached) return cached;
  try {
    const pkg = await fetchPackage('bundled/', id);
    await idbSet('kv', `pkg:${id}`, pkg);
    return pkg;
  } catch { /* not bundled */ }
  return downloadPackage(id);
}
export const deletePackage = (id) => idbDel('kv', `pkg:${id}`);

// Picks the package to show on launch: the saved choice, else the newest available.
export async function initialPackage() {
  const have = await localIds();
  const bundled = await bundledIndex();
  if (settings.pkg && (have.includes(settings.pkg) || bundled.packages.some((p) => p.id === settings.pkg))) return loadPackage(settings.pkg);
  const ids = [...new Set([...have, ...bundled.packages.map((p) => p.id)])].sort();
  if (!ids.length) {
    const remote = await remoteIndex();
    ids.push(remote.latest || remote.packages.at(-1).id);
  }
  const id = bundled.latest && !have.some((h) => h > bundled.latest) ? bundled.latest : ids.at(-1);
  settings.pkg = id;
  saveSettings();
  return loadPackage(id);
}

// Returns ids of remote packages that are newer than everything we hold.
export async function checkForNew() {
  const remote = await remoteIndex();
  const have = new Set([...(await localIds()), ...(await bundledIndex()).packages.map((p) => p.id)]);
  return { remote, fresh: remote.packages.filter((p) => !have.has(p.id)) };
}
