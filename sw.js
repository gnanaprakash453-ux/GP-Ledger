// GP Ledger service worker — v13.1.0
// Bumping CACHE_NAME forces old caches to be dropped on next install,
// so a re-deploy (e.g. after this update) actually reaches phones.
// v13.0.0: new app icon set (all 4 files replaced) — bumping the cache
// name here is what makes phones actually pick up the new icons/splash,
// since CORE_ASSETS caches them by filename and a same-name overwrite
// alone wouldn't invalidate an old cached copy.
// v13.1.0: index.html changed (Quote Engine) — same reasoning, bump so
// installed copies actually receive the new JS instead of serving a
// cached v13.0.0 index.html indefinitely.
// v13.2.0: index.html changed again (Tasks module) — same reasoning.
// v13.3.0: new icon set (round 2) + notification sound library expansion
// + per-module quote pool expansion — bump so installed copies pick up
// both the new icons and the new JS.
// v13.4.0: the five remaining new modules (Notes, Travel, Learning,
// Content & Ideas, Meal Planner) + per-quote images — same reasoning.
// v13.5.0: new logo everywhere (embedded LOGO_DATA_URI swapped), Dashboard
// Today/Upcoming integration, People module, proactive Nudges.
// v13.6.0: calorie-aware Meal Planner suggestions.
// v13.7.0: fixed a real restore-path bug — see CHANGELOG. Data-only fix,
// but bumping anyway since index.html changed.
// v13.8.0: Search now indexes the 7 new modules, Tasks now fires a
// due-today reminder — see CHANGELOG for both.
// v13.9.0: Trash/undo, Calendar integration, Documents photo attachments,
// Travel currency, Finance accounts + recurring transactions, AI Coach +
// exports for the 6 newest modules. See CHANGELOG.
// v13.10.0: Morning Summary added to Home (Yesterday/Carry Forward/Today
// Top 3/Insight) — index.html changed, bump so installed copies pick it up.
// v13.12.0: Morning Summary revised — Yesterday is now a collapsible card
// below the existing Dashboard Image/Quote, a Main Achievement row was
// added, and a small live Day/Date/Time indicator was added to the header
// — index.html changed again, same reasoning, bump.
// v13.13.0: header restructured to two rows (greeting alone on row 1;
// date/time + Search/Save & Sync on row 2) so nothing crowds the greeting
// on narrow phones — index.html changed again, same reasoning, bump.
// v13.14.0: APP_SCRIPT_VERSION bumped to v9.7.0 to match the apps-script.gs
// fix for "Load from Sheet" failing with "Data tab is empty" on large
// accounts (chunked snapshot storage instead of one capped cell) — plus
// the related debug-log wording in syncNow() — index.html changed again,
// same reasoning, bump so installed copies pick up the corrected version
// check instead of comparing against the old v9.6.1.
const CACHE_NAME = 'gp-ledger-v13-14-0';
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
