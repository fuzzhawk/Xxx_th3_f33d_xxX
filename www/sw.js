// Service worker for the web version: keeps the app shell, game art and the
// bundled package available offline. Same-origin GETs are served from cache
// and refreshed in the background; everything else goes to the network.
const CACHE = 'feed-shell-v2';
const SHELL = ['./', 'index.html', 'css/style.css', 'icon.svg', 'manifest.webmanifest', 'bundled/index.json', 'assets/kenney/index.json', 'data/words.txt'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('feed-shell-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    const fresh = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || fresh;
  }));
});
