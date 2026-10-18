// Favorites and saves. Each entry keeps a full copy of the post, so it survives
// switching or deleting packages.
import { idbAll, idbSet, idbDel } from './store.js';

const items = new Map(); // key `${kind}:${id}` -> { kind, post, at, pkg }
const listeners = new Set();

export async function loadFavs() {
  for (const [k, v] of await idbAll('favs')) items.set(k, v);
}
export const has = (kind, id) => items.has(`${kind}:${id}`);
export function toggle(kind, post, pkg) {
  const k = `${kind}:${post.id}`;
  if (items.has(k)) { items.delete(k); idbDel('favs', k); }
  else { const v = { kind, post, at: Date.now(), pkg }; items.set(k, v); idbSet('favs', k, v); }
  listeners.forEach((fn) => fn(kind, post));
  return items.has(k);
}
export function list(kind) {
  return [...items.values()].filter((v) => v.kind === kind).sort((a, b) => b.at - a.at);
}
export function onChange(fn) { listeners.add(fn); }
export function all() { return [...items.values()]; }
