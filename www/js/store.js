// Small state lives in localStorage; packages and favorites live in IndexedDB.
const LS = 'thefeed:';
export function lsGet(k, d) {
  try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch { return d; }
}
export function lsSet(k, v) {
  try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { console.warn('localStorage write failed', k, e); }
}

let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('thefeed', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('favs'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const idbGet = (store, k) => tx(store, 'readonly', (s) => s.get(k));
export const idbSet = (store, k, v) => tx(store, 'readwrite', (s) => s.put(v, k));
export const idbDel = (store, k) => tx(store, 'readwrite', (s) => s.delete(k));
export async function idbAll(store) {
  const d = await db();
  return new Promise((res, rej) => {
    const out = [];
    const r = d.transaction(store).objectStore(store).openCursor();
    r.onsuccess = () => { const c = r.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
    r.onerror = () => rej(r.error);
  });
}
export async function idbKeys(store) {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction(store).objectStore(store).getAllKeys();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
