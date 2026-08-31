// GP Ledger service worker — v15.0.1
// v15.0.1: fixed a real bug — the picsum.photos cache handler used to
// cache error/rate-limit responses as if they were valid images, which
// could permanently break Photo & Quote cards for the rest of the day.
// See the fix + full explanation inline below. IMG_CACHE_NAME bumped too,
// so any already-poisoned entries are dropped on next activate.
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
// v13.14.1: APP_SCRIPT_VERSION bumped to v9.7.1 — the Data tab's rows.data
// now reports the real chunk count instead of a flat 1, so the sync debug
// log doubles as proof the new script is actually deployed (paste ≠
// publish; a stale deployment was the likely reason v13.14.0's fix didn't
// visibly take effect yet) — index.html changed again, same reasoning.
// v13.15.0: persistence/backup architecture fix — Save & Sync, Export
// Backup, Load from Sheet, and Import Backup now all go through one
// canonical buildBackupSnapshot_()/restoreBackupSnapshot_() pair instead of
// four separate field lists (see index.html's comment above
// buildBackupSnapshot_ for the full reasoning). Two real gaps fixed along
// the way: S.aiCoach and S.notifLog were never included in ANY backup or
// restore path before this (sync, load, AND import), and Import Backup
// used to have its own restore logic that — unlike Load from Sheet — never
// ran settings through defaultSettings() and never protected this
// device's own sheetUrl. apps-script.gs is unchanged: the Data tab already
// stores whatever object the client sends, so these fields ride along
// automatically once index.html started sending them, same as every
// module added since v13.2.0. index.html changed, so bump so installed
// copies actually receive this instead of serving a cached v13.14.1.
// v13.16.0: "Load from Sheet" error handling fix — a Sheet that's empty,
// a corrupt stored snapshot, and an unreachable/undeployed URL used to all
// collapse into the same generic "redeploy" alert, hiding handleLoad()'s
// real error string. Each is now told apart and shown with its actual
// cause. Also added a local "unsynced changes" flag (set on every
// saveState(), cleared on a confirmed Save & Sync / Load from Sheet) so
// Load from Sheet now warns specifically when it would overwrite local
// edits that were never pushed to the Sheet, instead of only a generic
// "this replaces everything" confirm. Save & Sync's success toast no
// longer reads as a plain "Synced ✓" when the Data-tab snapshot (the one
// Load from Sheet actually reads) failed to write. apps-script.gs is
// unchanged — its chunked-snapshot read/write and handleLoad() error
// strings were already correct; this was purely the client discarding
// them. index.html changed, so bump so installed copies actually receive
// this instead of serving a cached v13.15.0.
// v13.17.0: UI stability fix, no feature/design changes. (1) The focus-timer
// full-screen overlay and the modal backdrop were only ever dismissed by
// their own explicit close buttons, never by navigation — pressing Back
// while either was open left it covering the new screen and silently
// swallowing every touch (including the FAB and bottom nav), which is what
// showed up as a black screen (the timer overlay's background is
// var(--bg), near-black in dark theme) or "stuck" buttons. goToScreen now
// closes both before switching screens. (2) Every .screen element carried
// a permanent GPU-layer promotion hint (transform:translateZ(0) +
// will-change:scroll-position), so ~25 layers were resident at once instead
// of just the one visible screen — real memory/GPU pressure that's a
// likely contributor to both the navigation lag and the black-screen
// flashes; scoped to .screen.active only. (3) goToScreen's per-screen
// render dispatch is now wrapped so one module's render error can no
// longer abort the rest of navigation (which previously could leave
// updateBackFab()/the back button in a stale state). index.html changed,
// so bump so installed copies actually receive this instead of serving a
// cached v13.16.0.
// v13.18.0: two further root causes, found after v13.17.0's fixes weren't
// enough. (1) Bottom nav (Home/Habit/Routine/+Add) going invisible and
// untappable: the 'kb-open' body class (hides the fixed nav+FAB under the
// keyboard on focusin) was only ever cleared by a focusout event resolving
// through a 120ms timeout — nothing tied its removal to navigation, so a
// missed/delayed blur (a real risk any time a focused field's screen gets
// hidden by a screen swap rather than a normal user blur) left it stuck on
// <body> forever, with no recovery short of reload. goToScreen() and
// closeModal() now blur any focused field and clear 'kb-open'
// deterministically every time, instead of relying on event timing.
// (2) App-wide scroll stutter/jumping: setupPullBounce()'s own comment
// says it's meant only for screens too short to scroll natively, but the
// code never actually checked that — it hijacked any touch starting at
// scrollTop<=0 into a transform-based drag, which is true at the start of
// nearly every normal scroll, so most real scroll gestures throughout the
// app were fighting native momentum scrolling instead of using it. Restored
// the actual scrollHeight<=clientHeight check so the synthetic bounce only
// engages on genuinely non-scrollable screens, and every screen with real
// content scrolls 100% natively again. index.html changed, so bump so
// installed copies actually receive this instead of serving a cached
// v13.17.0.
// v13.19.0: [V14.0.0 phase 1/6 — stability] Journal back-button fix (see
// APP_VERSION comment in index.html for the root cause and fix). index.html
// changed, so bump so installed copies actually receive this instead of
// serving a cached v13.18.0.
// v14.0.0: full release — see the APP_VERSION comment block in index.html
// for the complete phase-by-phase summary (sync fixes, meal-planner/diet
// linking, habit streaks, fonts, clock, AI Coach restructure, Routine
// grouping, Finance summary/log view, global refresh). index.html
// changed, so bump so installed copies actually receive all of this
// instead of serving a cached v13.19.0.
// v14.0.1: closes every gap flagged after the v14.0.0 review — dedicated
// Typography section, Streak Milestone edit/reorder, real Meal Planner
// calendar grid, Meal Planner visual redesign, Routine card redesign,
// Appearance sub-grouping, log-heavy page audit (+ a real duplicate-
// streak-calc bug fix in Trends), Diet↔Goals linking (new goal type —
// this relationship didn't exist before), and a Home visual-hierarchy
// pass. See the APP_VERSION comment block in index.html for full detail.
// index.html changed, so bump so installed copies actually receive all
// of this instead of serving a cached v14.0.0.
// v14.0.2: bugfix — Settings → Home → Quick Actions was rendering
// "undefined undefined" per row (wrong property names, qa.icon/qa.label
// vs the actual qa.ic/qa.lbl). See APP_VERSION comment in index.html.
// index.html changed, so bump so installed copies actually receive this
// instead of serving a cached v14.0.1.
// v14.1.0: thematic module redesigns (Journal/Notes/Trip Planner/Finance
// log/Tasks/Subscriptions/Debts), a Global Clock redesign (relocated to
// a compact header chip per feedback), and Diet↔Habit↔Home integration
// (auto food categorization, linked-habit food insights, Home "Eating
// Patterns" card). See the APP_VERSION comment block in index.html for
// full detail. index.html changed, so bump so installed copies actually
// receive all of this instead of serving a cached v14.0.2.
// v14.2.0: closes out the full "GP Hub UI/AI/Module Integration" spec —
// see the APP_VERSION comment block in index.html for the complete
// summary. index.html changed, so bump so installed copies actually
// receive all of this instead of serving a cached v14.1.0.
// v14.3.0: premium Journal customization — 3 artwork styles (Quill & Ink,
// Stipple Tree, and Botanical & Skyline — a full page-framing border of
// original branch/vine/skyline line art), all 6 spec'd page-transition
// modes via a new "🎨 Customize diary" modal, the Default Font dropdown
// renamed to 5 named categories with corrected per-font fallbacks, and a
// real grain/fibre paper texture on both the diary page and notebook
// editor. See the APP_VERSION comment block in index.html for full
// detail. index.html changed, so bump so installed copies actually
// receive all of this instead of serving a cached v14.2.0.
// v14.4.0: targeted fixes — Clock size setting + position-jump-on-open
// glitch fixed; Meal Planner's real "tomorrow always empty" bug fixed
// (Auto-fill was filling a stale, invisible week) plus real per-slot AI
// suggestions, Clear, and larger/responsive cards; Goals/Learning AI
// suggestions now available while adding a new entry, not only after
// it's saved; Journal's Botanical & Skyline artwork gained blossoms and
// ink-hatching shading; notification volume is now adjustable (was a
// fixed, quiet hardcoded level). See the APP_VERSION comment block in
// index.html for full detail. index.html changed, so bump so installed
// copies actually receive all of this instead of serving a cached
// v14.3.0.
// v14.4.1: three targeted fixes — (1) black screen on app open, root
// cause was init() running as one unguarded sequence where a single
// uncaught exception anywhere in it aborted everything before #app ever
// got its .ready class, which is what reveals <main>; every step in
// init() is now individually try/caught so it always finishes and .ready
// always gets added; (2) the fixed bottom nav sometimes stayed on screen
// and blocked the keyboard while typing — its show/hide listeners used to
// sit at the very end of init(), so the same kind of abort described
// above could leave them never attached for a whole session; they now
// live in their own setupKeyboardHandling() function that always runs
// first; (3) Journal now remembers the font you last used and defaults
// new entries to it instead of always starting on Caveat. See the
// APP_VERSION comment block in index.html for full detail. index.html
// changed, so bump so installed copies actually receive all of this
// instead of serving a cached v14.4.0.
// v14.4.2: Meal Planner input fix — a leftover inline style="flex:1;" on
// each meal input was overriding the .mp-slot CSS rule meant to give it
// its own full-width row, squeezing it down to a sliver next to the
// ✨/✕/Eaten buttons and truncating meal names ("Peanut but…"). Removed.
// index.html changed, so bump so installed copies actually receive this
// instead of serving a cached v14.4.1.
// v14.4.3: fixed the grey strip below the bottom nav — the safe-area gap
// under the floating nav was never painted with anything but the plain
// page background, exposed on every screen since nothing covers it there.
// Added a backing plate matching the nav's own card colour behind it. See
// the APP_VERSION comment block in index.html for full detail. index.html
// changed, so bump so installed copies actually receive this instead of
// serving a cached v14.4.2.
// v14.4.4: header now collapses along with the bottom nav while typing,
// and the v14.4.3 nav safe-area plate now hides together with nav.bottom
// instead of staying visible on its own. See the APP_VERSION comment
// block in index.html for full detail. index.html changed, so bump so
// installed copies actually receive this instead of serving a cached
// v14.4.3.
const CACHE_NAME = 'gp-ledger-v15-0-1';
// v15.0.1 — bumped so `activate` (below) deletes the old image cache,
// which may already contain a permanently-poisoned response from the bug
// fixed just above — a clean cache means this fix takes effect immediately
// instead of only for images that happen to get a fresh URL.
const IMG_CACHE_NAME = 'gp-ledger-images-v2';
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
  // v15.0.1 — bugfix: this used to call cache.put() unconditionally on
  // whatever fetch(req) returned, including a rate-limit/5xx/error
  // response from picsum.photos. Once that happened, cache.match(req)
  // would keep serving that same failed response for that exact seeded
  // URL forever — the hero/quote/motivation photos use a URL baked from
  // today's date, so one transient picsum.photos hiccup silently and
  // permanently "broke" every image on that screen for the rest of the
  // day (quotes still rendered fine since they're not network-dependent,
  // matching the reported symptom exactly). Only a genuinely successful
  // (res.ok) response gets cached now; a failed one is still handed back
  // to the page as-is (img.onerror on the client already treats it as a
  // failed load and just leaves the themed-gradient fallback in place —
  // see setPhotoCardBg in index.html) but is never persisted, so the very
  // next attempt (next visit, "Change now", tomorrow's rotation) gets a
  // real fresh network attempt instead of being stuck on the bad copy.
  if (req.url.includes('picsum.photos')) {
    event.respondWith(
      caches.open(IMG_CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
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
