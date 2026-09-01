/* Fortress service worker — offline app shell + cached PDF engine */
const CACHE = 'fortress-v2026-09-01b';
const SHELL = ['./', './index.html', './parser.js', './recognizers.js', './fxseries.js', './alseries.js', './pdf.min.js', './pdf.worker.min.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // pdf.js CDN: cache-first after first successful fetch
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
        return r;
      }))
    );
    return;
  }
  // App shell: network-first so a new deploy lands. Network-first is not enough on its
  // own — GitHub Pages and the phone's own HTTP cache can hand the SW a stale copy of
  // index.html, which is how an update appears to "not happen". So app files are fetched
  // with a cache-busting query and no-store, then stored in the SW cache under their
  // REAL request, which keeps offline working unchanged.
  if (url.origin === location.origin) {
    const isApp = url.pathname.endsWith('/') || /\.(html|js|webmanifest)$/i.test(url.pathname);
    e.respondWith((async () => {
      try {
        const r = isApp
          ? await fetch(url.href + (url.search ? '&' : '?') + '_sw=' + Date.now(), { cache: 'no-store' })
          : await fetch(e.request);
        if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
        return r;
      } catch (err) {
        const hit = await caches.match(e.request, { ignoreSearch: true });
        return hit || await caches.match('./index.html');
      }
    })());
  }
});
