'use strict';
/* Stonelock service worker — network-first with cache fallback. Deploys always land
   (fresh network wins whenever it's reachable), while everything successfully fetched
   is cached as it streams through — so once visited, the game keeps working offline,
   and art/audio accumulate on demand. Same-origin GETs only. */
const CACHE = 'stonelock-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() =>
      caches.match(req).then(m => m || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )
  );
});
