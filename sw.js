// GP Ledger service worker — v12.5.1
// Bumping CACHE_NAME forces old caches to be dropped on next install,
// so a re-deploy (e.g. after this update) actually reaches phones.
const CACHE_NAME = 'gp-ledger-v12-5-1';
const IMG_CACHE_NAME = 'gp-ledger-images-v1';
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== IMG_CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never cache POSTs to Apps Script

  // v12.1.1 — background photos (Home hero, Diet/Habits motivation cards,
  // Quote card) all pull from picsum.photos with a seed that already bakes
  // in today's date, so the exact same URL is requested every time that
  // screen is revisited on the same day. Cache-first here means the first
  // load of each still pays real network latency, but every repeat visit
  // that day is instant instead of re-fetching. The old blanket
  // network-first handler below was treating these exactly like the app
  // shell — refetching every single time — which was the main cause of
  // the visible image delay on every screen, not just the first visit.
  if (req.url.includes('picsum.photos')) {
    event.respondWith(
      caches.open(IMG_CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // Network-first for the app shell so updates show up quickly;
  // fall back to cache when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
