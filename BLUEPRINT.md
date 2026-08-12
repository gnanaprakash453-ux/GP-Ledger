# GP Ledger — Architecture Blueprint

Re-upload this file (plus `index.html`) at the start of any future session
so Claude doesn't have to re-derive the app's structure from scratch.
Keep it updated when the shape of the app changes, not just the features.

## 1. What this is

A single-file Progressive Web App (`index.html` — one file, HTML+CSS+JS,
no build step, no framework). Habit tracker + finance ledger + routine
timeline + diet log + goals/calendar/health/documents/etc. Runs entirely
client-side against `localStorage`; an optional Google Apps Script backend
(`apps-script.gs`) mirrors data to a Google Sheet and sends Telegram
reminders. Deployed as a static site (GitHub Pages) so it can be
"Added to Home Screen" as an installable app on a phone.

## 2. File map

| File | Purpose | Redeploy needed when changed? |
|---|---|---|
| `index.html` | Entire app: markup, CSS, JS | Yes — replace on host, reinstall on phone |
| `sw.js` | Service worker, offline cache | Yes — **bump `CACHE_NAME`** every time or phones keep the old cached copy |
| `manifest.json` | PWA metadata, icons, theme color | Only if icons/name/colors change |
| `icon-*.png`, `apple-touch-icon.png` | App icons | Only if regenerating icons |
| `apps-script.gs` | Backend: Sheet sync + Telegram | Only when this file itself changes — **redeploy via Deploy → Manage deployments → New version** |
| `SETUP_GUIDE.md` | End-to-end setup for a non-technical user | Update when setup steps change |
| `CHANGELOG.md` | Dated feature history, newest on top | Add an entry every session |
| `BLUEPRINT.md` | This file | Update when architecture/conventions change |

`APP_SCRIPT_VERSION` (top of the JS, inside `index.html`) must always
equal `SCRIPT_VERSION` (top of `apps-script.gs`) — this is what the
in-app "Test connection" diagnostic checks to catch a stale deployment.
Only bump both together, and only when `apps-script.gs` actually changed.

## 3. In-app data model (`S` object, global state)

```
S = {
  habits: [...],            // kind: 'check' | 'quantity'
  transactions: [...],      // finance ledger
  settings: {...},          // see below
  routineLogs: { 'YYYY-MM-DD': [ {id,start,end,cat,note} ] },
  routineCats: [...], routineTemplates: { weekday, weekend, dayAssignment },
  debts: [...], journal: { 'YYYY-MM-DD': {text,font,color} },
  diet: { meals: { 'YYYY-MM-DD': [...] }, settings: {...} },
  goals, subscriptions, assets, health, documents, aiCoach, budgets,
}
```
Everything persists to `localStorage` under `gpl_<key>` (see
`loadState()`/`saveState()`). Every array/object has a defaulting guard in
`loadState()` so a fresh install or corrupted storage never crashes —
**when adding a new top-level `S` field, add its default-guard line there
too**, and add it to `Object.assign(defaultSettings(), S.settings)` if it
lives under `settings`.

## 4. Module system (added v9.5.0)

`MODULE_DEFS` (near the top of the script, right after `GEMINI_MODEL`) is
the single source of truth for every optional section: key, label, icon,
`iconKey` (v10.0 — see §9), target screen id, whether it's "core", and
which group it falls under on the More screen. `S.settings.modules[key]`
(bool, default `true`) is the on/off switch, edited from Settings →
Modules (`drawModuleToggleList()`).

- `renderBottomNav()` rebuilds `#bottomNav` from `navModuleList()` — core
  modules fill slots first, then other enabled modules fill what's left,
  capped at `MAX_NAV_SLOTS` (4, plus Home, plus More if anything didn't
  fit).
- `renderMoreCards()` fills `#moreModuleCards` with whatever enabled
  modules didn't make it onto the bottom bar, grouped by `group`.
- `goToScreen(name)` still just toggles `.screen.active` and calls that
  screen's render function — unchanged contract. Nav is rebuilt on every
  navigation so the active state stays correct.

**To add a new module/section in the future:** add one entry to
`MODULE_DEFS` (including an `iconKey` — see §9), add its
`<section class="screen" id="screen-x">` markup, add its render call to
`goToScreen()`, and it automatically gets a Settings toggle, nav/More
placement, and inclusion in shared/export backups — no other wiring
needed.

## 5. Theming — color presets (added v9.5.0, scope narrowed v10.0)

`THEMES` (array of palettes, right after `MODULE_DEFS`) each define
`bg, bg2, card, card2, text, sub, sub2, line, accent, accent2`.
`applyTheme()` writes the **color** custom properties onto `:root`
(`--bg`, `--card`, `--accent`, etc.) — already how the whole stylesheet
was written, so no CSS changes were needed to make theming live.
`S.settings.themeId` picks the palette; `S.settings.customAccent`
(existing per-color picker) still overrides just the accent on top.
`--good` (used for positive/income amounts) is intentionally **not**
overridden by theme — it stays a fixed green across all themes/packs.

**v10.0 change:** `applyTheme()` no longer touches font, radius, or
`--accent2`-from-theme when a non-default Experience Pack is active —
those are now owned by the pack (see §9). Theme presets are a **color-only
fine-tune layer on top of the current pack**, not a full skin swap. Order
of application matters: `applyTheme()` then `applyExperiencePack()` at
init/restore, so the pack's colors win unless the person explicitly taps
a theme preset chip afterward (explicit action, intentionally allowed to
override pack colors).

**To add a new theme:** add one object to `THEMES` with a unique `id`.
It appears in the Settings theme grid automatically.

## 6. Background layer (added v9.5.0)

`#bgLayer` is a fixed, full-screen `div` behind `#app` (z-index 0 vs
`#app`'s z-index 1). `applyBackground()` sets its `background-image` from
`https://picsum.photos/seed/gpledger<N>/800/1600` (no API key required)
and fades it in via the `.on` class; opacity is controlled by
`--bg-opacity`, driven by `S.settings.bgOpacity`. `S.settings.bgSeed` is
now set automatically per Experience Pack (`p.wallSeed`) when a pack is
applied, so each pack gets a distinct-but-stable photo seed; manual
"Shuffle" still works on top. Auto-rotation is a plain `setInterval` set
up by `scheduleBackgroundRotation()`. Gracefully no-ops when
`navigator.onLine` is false or the image fails to load — never blocks
rendering.

Still true: if a future request wants *keyword-targeted* backgrounds
(e.g. "only nature photos" per pack), picsum doesn't support that — would
need a real image API with a key (Unsplash API, Pexels API) and a
settings field for the key, following the same pattern as the existing
Gemini key field. This is the main remaining gap in the "Images" section
of the original v10.0 spec (curated per-pack imagery vs. random seeds).

## 7. Conventions to keep following

- **No build step.** Everything ships as plain files a browser can load
  directly. Don't introduce npm/bundlers/frameworks.
- **Additive over invasive.** New features should slot into the existing
  `S` object, existing render-function-per-screen pattern, and existing
  `goToScreen()`/modal/toast helpers rather than restructuring them.
- **CSS variables, not hardcoded colors,** for anything that should
  respond to theming or Experience Packs. Check `applyTheme()` and
  `applyExperiencePack()` before adding a new hardcoded hex color to the
  stylesheet or a `new Chart(...)` call.
- **Every new `<input>`/`<select>` needs**: a default in the relevant
  `default*()` function, a line in the matching `load*Form()` to populate
  it, and a change/input listener that writes back to `S` and calls
  `saveState()`. Grep for `getElementById` mismatches after editing (a
  referenced id with no matching `id="..."` in the HTML is the most
  common self-inflicted bug in this file).
- **Sync payload** (`payload` object built for `action:'sync'`) sends
  `S.settings` wholesale, so `experiencePack`/`themeId`/new settings
  fields sync automatically — don't add per-field plumbing on the Apps
  Script side unless a field needs its own Sheet tab (like
  habits/transactions/debts do).
- **Version bump discipline:** bump the display version (About row +
  Settings hint) every session. Only bump `APP_SCRIPT_VERSION` +
  `SCRIPT_VERSION` together, and only when `apps-script.gs` itself
  changed — bumping it unnecessarily forces a redeploy for no reason.
- **Mobile-first testing mindset:** issues that don't reproduce on
  desktop (the customAmt input bug fixed in v9.5.0) are usually about
  on-screen-keyboard viewport coverage or `font-size < 16px` triggering
  iOS zoom — check both before assuming it's a data/logic bug.

## 8. How a future session should start

1. Ask for (or expect) the latest `index.html` + this `BLUEPRINT.md` +
   `CHANGELOG.md` re-uploaded, since the app evolves across sessions and
   there's no shared server-side memory of the code itself.
2. Read `CHANGELOG.md` top entry to know what the current version already
   has, before assuming something is missing.
3. Grep for the relevant function/section (`MODULE_DEFS`, `THEMES`,
   `EXPERIENCE_PACKS`, `applyTheme`, `applyExperiencePack`,
   `renderBottomNav`, `S.settings`, etc.) rather than reading the whole
   ~4500-line file.
4. After any edit: run a syntax check on the extracted `<script>` block
   and a check that every `getElementById('x')` has a matching
   `id="x"` in the HTML — both catch the most common mistakes cheaply,
   before the person ever has to redeploy and test. For Experience Pack
   edits specifically, also validate every pack object has all required
   fields and that `iconStyle`/`cardStyle`/`navStyle`/`fabStyle`/`layout`
   values match a real CSS variant class (see §9) — a typo here fails
   silently (falls back to browser default styling) rather than erroring.

## 9. Experience Engine (added v10.0)

**What it is.** A token + component-variant layer that makes the whole
app *feel* like a different application when the person switches
Experience Pack, without duplicating a single screen's markup or JS.
This deliberately extends — not replaces — the module system (§4) and
color theming (§5): Theme now only recolors; **Experience Pack** owns
layout, icons, fonts, card/nav/FAB shape, and animation speed.

**Token flow.** `EXPERIENCE_PACKS` (const, after `themeById()`) is an
array of 20 pack objects, each with: `accent/accent2/bg/bg2/card/card2/
line/text/sub` (colors), `fontHead/fontBody` (Google Fonts already loaded
in `<head>` — add any new family to that `<link>` too), `radius/
tileRadius/btnRadius/heroRadius` (shape), `iconStyle/cardStyle/navStyle/
fabStyle/layout` (component variant keys — see below), `animSpeed`,
`wallSeed` (background photo seed), and optional `lightBg`.

`applyExperiencePack(id)`:
1. Writes every color/font/radius/animation token onto `:root` as CSS
   custom properties (same mechanism `applyTheme()` already used).
2. Replaces all `exp-*` classes on `<body>` with the new pack's variant
   classes: `exp-icon-<iconStyle>`, `exp-card-<cardStyle>`,
   `exp-nav-<navStyle>`, `exp-fab-<fabStyle>`, `exp-layout-<layout>`,
   `exp-<packId>`.
3. Sets `S.settings.bgSeed` to the pack's `wallSeed` and re-triggers the
   background layer (§6).
4. Saves `S.settings.experiencePack` and re-draws the Settings picker.

**Component variants are CSS-only, keyed off those body classes** — this
is the load-bearing architectural decision that keeps this maintainable:
the DOM/markup for `.card`, `.dash-tile`, `nav.bottom`, `.fab`, and the
dashboard hero/grid never changes per pack. Only the CSS painting them
does (see the "v10.0 EXPERIENCE ENGINE" block at the end of the
`<style>` tag). Six dashboard **layout families** (`rings`, `magazine`,
`minimal`, `dense`, `glass`, `gamified`) restructure `#dashGrid`/
`.dash-hero`/`.dash-tile` via CSS grid/shape rules — genuinely different
structure, same underlying `renderDashboard()` JS and same element ids.

**Icon system.** `ICONS` (const, right after `MODULE_DEFS`) is ONE SVG
path-geometry set per icon key (`.g-base`/`.g-accent` classes inside each
`<path>`), viewBox `0 0 24 24`. `icon(key, size)` wraps it in
`<svg class="gicon">`. The **style** (outline/filled/duotone/rounded/
minimal/hand-drawn) is applied purely by the `exp-icon-*` CSS class on
`<body>` toggling `fill` vs `stroke` vs `opacity` on `.g-base`/`.g-accent`
— this is why one geometry set can serve 6 visual styles instead of
needing 6 separate hand-drawn icon libraries. **This covers app-chrome
icons only** (nav, module tiles, dashboard tiles) — habit icons
(`h.icon`) remain free-text emoji the person picks per habit; those are
user data (synced to Sheets) and are intentionally left alone by the
Experience Engine.

**To add a new icon:** add a `key: '<svg path>'` entry to `ICONS` using
only `<path class="g-base">`/`<path class="g-accent">` (or `<circle>`/
`<rect>` with those classes), 24×24 viewBox, no inline `fill`/`stroke`
attributes (those come from the `exp-icon-*` CSS). Reference it via
`icon('key')` or give a `MODULE_DEFS` entry an `iconKey`.

**To add a new Experience Pack:** add one object to `EXPERIENCE_PACKS`
with all fields listed above, reusing one of the existing
`iconStyle/cardStyle/navStyle/fabStyle/layout` values (adding a *new*
variant value requires a matching CSS block, not just a data entry — see
next paragraph). It appears in Settings → Experience Pack automatically.

**To add a new component variant** (e.g. a 7th dashboard layout, or a
new card style): add the CSS rules keyed off a new `exp-<category>-<name>`
body-class selector in the "v10.0 EXPERIENCE ENGINE" CSS block, then
reference `<name>` from any pack's matching field.

**Deferred from the original v10.0 spec (see CHANGELOG for exact ask):**
- Chart *type* per pack (rings/area/bars/glass) — currently only chart
  *color* is pack-aware (`currentPack().chartStyle`, derived from
  `layout` via a lookup map in `currentPack()`); the three Chart.js
  instances in `renderTrends()`/`renderFinance()` still default to
  line/bar types regardless of pack.
- Guided multi-step habit-creation wizard (7-step flow from the request)
  — the add-habit form is unchanged in v10.0.
- Curated per-pack wallpaper imagery — currently reuses picsum photo
  seeds per pack rather than pack-specific themed photo sources (see §6).
- Modular/reorderable dashboard widgets (add/remove/resize/pin) — the
  dashboard tile *set* is still fixed; only its layout family changes.
- Quote-card visual redesign (background image, swipe, share, TTS) —
  untouched in v10.0.

## 10. Life OS rebuild (added v12.0.0)

**What this is.** A full Home-screen and pack-roster rebuild on top of
everything in §9, done against direct visual reference. The Experience
Engine's *mechanism* (token flow, `exp-*` body classes, CSS-only variant
painting) is unchanged — this section documents what's built *with* that
mechanism now, not a new mechanism.

**New Home screen structure.** `#screen-dashboard` markup replaced
entirely — old elements (`#dashScoreHead`, `#dashScoreSub`, `#dashGrid`,
`#dashQuoteText`) are gone, replaced by:
- `#focusTabs` (`.ft-tab` × 4: Focus/Health/Productivity/Finance) —
  module-level `activeFocusTab` state, click listener bound once (not
  re-bound per render, since `goToScreen()` only toggles visibility, it
  doesn't rebuild this static markup).
- `#heroFocusCard` (`.hero-focus-card`) — picsum background
  (`seed=<bgSeed>-hero-<tab>`), per-tab caption from `HERO_LINES` inside
  `renderDashboard()`.
- `.progress-card` — same ring SVG as before (`#dashRingFill`/
  `#dashRingText`, ids unchanged), now paired with `#pcStats` stat rows
  instead of a tile grid.
- `#dashQuickActions` (`.quick-actions-row`) — icon+label buttons,
  `QA_ITEMS` array inside `renderDashboard()`.
- `#dashPriorities` — same data/logic as before, only the wrapping CSS
  changed (`.priority-row` unchanged).

**Per-tab scoring.** `tabScore(tab)` and `tabStats(tab)` (both inside
`renderDashboard()`) compute a domain-specific score/stat-set per tab —
Focus uses the original all-modules-blended formula, Health/Productivity/
Finance are narrower blends of only the relevant existing variables
(`wh`/`sh`/`dt` for Health; `habitPct`/`routineMin`/goals for
Productivity; `overdueDebts`/subscriptions for Finance). **No new data
sources** — same variables `renderDashboard()` already computed pre-v12.

**Curated icon system.** `ICONS` extended with ~20 new geometric entries
(§9's icon system — one path-geometry set styled via `exp-icon-*`, same
mechanism, more entries). `HABIT_ICON_KEYS` (array of `[key,label]`) is
the curated subset shown in the New Habit picker. **`habitIcon(h, size)`**
is now the *only* correct way to render a habit's icon anywhere in the
file — it prefers `h.iconKey` (new, geometric) and falls back to `h.icon`
(legacy free-text emoji) so pre-v12 habits render unchanged. **When
touching any future code that displays a habit's icon, call
`habitIcon(h)` — never read `h.icon` directly.**

**Universal FAB.** Same consolidation pattern used in the earlier (now
superseded) v11.0.0 Workspace build: one `#fabUniversal` outside every
`.screen`, `FAB_ACTIONS` (screen → direct action) and `CREATE_ACTIONS`
(full list for the sheet, filtered by `S.settings.modules`). No Workspace
tabs in this pass — the FAB opens each module's original single-form
`open*Modal()` directly.

**Pack roster: 2 flagship packs, not 21.** `EXPERIENCE_PACKS` now holds
`lifeos` (light) and `lifeosmidnight` (dark) only. **The old 21-pack CSS
was not deleted** — `exp-layout-rings`/`exp-layout-magazine`/etc. and
their card/nav/fab/icon variant rules are still in the stylesheet,
simply unreferenced by any pack currently in the array. This means
re-adding any of the old 21 identities later is a **pure data change**
(one object back into `EXPERIENCE_PACKS`), not a CSS rewrite — intentional,
since the plan discussed was "2-3 flagship now, expand after approval."

**New component variants (2 new CSS-only variants, same mechanism as
every other variant in §9):**
- `navStyle:'lifeos'` → `body.exp-nav-lifeos nav.bottom` — floating
  rounded bar, extra horizontal padding to leave room for the FAB
  overlapping its center.
- `fabStyle:'lifeos'` → `body.exp-fab-lifeos .fab` — centered
  (`left:50%; transform:translateX(-50%)`, not the default right-anchored
  offset), `border:4px solid var(--bg)` so it visually "cuts into" the
  nav bar beneath it, matching the reference image's raised center
  button.

**Pack picker.** `drawExperienceGrid()` rewritten: `.exp-pack-grid`
(2-col grid) → `.exp-pack-strip` (horizontal scroll, `.exp-pack-chip`
× N), matching the reference's "Many personalities" row. Also fixed a
pre-existing bug in this function — see CHANGELOG v12.0.0 (`toast()` →
`showToast()`).

**Explicitly NOT done in this pass** (see CHANGELOG v12.0.0 for the
full list): tabbed Workspace pattern from the earlier v11.0.0 branch,
command palette. Both are additive on top of this new Home screen
whenever picked back up — neither blocks the other.

**v12.0.1 addendum:** `applyExperiencePack()` now resolves icon style as
`S.settings.iconStyleOverride || p.iconStyle` — always read icon style
this way in any future code, never `p.iconStyle` directly, or a standalone
Icon Pack selection will be silently ignored. See CHANGELOG v12.0.1 for
the nav-spacer and hero-photo-quote changes shipped in the same pass.

**v12.0.2 addendum:** for any NEW chrome/module icon call site (nav,
More screen, quick actions, create sheets, anything module-shaped), call
**`chromeIcon(key, size)`, not `icon(key, size)`** — `chromeIcon` is the
one that respects the live Emoji/geometric choice; `icon()` stays
pure-geometric on purpose (used by the Icon Pack preview grid and the
habit icon picker, which must not react to the live setting). Add any
new emoji mapping to `EMOJI_MAP`, not by hand-writing a new lookup. Also
fixed in this pass: `loadState()`'s invalid-experience-pack fallback was
still `'glass'` (removed in v12.0.0) — now `'lifeos'`.

## 11. v12.0.3 additions

**Single version constant.** `const APP_VERSION` (top of script, right
after `GEMINI_MODEL`) is the only place the app version is ever written.
About screen and the Settings row both read it. **Never hardcode a
version string anywhere else** — if a future screen needs to show the
version, reference `APP_VERSION`.

**Font system, now actually wired up.** `FONT_OPTIONS` (10 entries, each
`{id, stack}`) + `fontStack(name)` + `drawFontPicker()` (Settings →
Appearance) are the real source of truth. `S.settings.fontHead`/
`fontBody` are always populated (default `'Plus Jakarta Sans'`, never
empty) and `applyExperiencePack()` reads them via `fontStack(...)` in
place of the pack's own `p.fontHead`/`p.fontBody`. **This was a real bug
before v12.0.3** — the old two-dropdown UI wrote to those settings but
nothing read them back; if a future session touches font rendering,
grep for `fontStack(` to find every real call site, don't reintroduce a
second disconnected font control.

**Categorized Settings.** Every `.settings-group` has a `data-cat`
attribute (`general`/`appearance`/`communication`/`backup`/`modules`/
`about`). `openSettingsCategory(cat)`/`closeSettingsCategory()` just
toggle `display` on those groups plus the hub/back-button visibility —
**no group's internal markup, ids, or listeners were touched or moved**.
When adding a new settings-group in the future, give it a `data-cat`
matching one of the six existing categories (or propose a 7th + add its
hub row) — a group with no `data-cat` will never be visible, since
`closeSettingsCategory()` hides everything with `[data-cat]` on load and
only `openSettingsCategory()` re-shows the matching one.

**Sticky headers.** `.screen > [data-back]` and `.modal-head` are both
`position:sticky; top:0` with negative-margin/padding bleeding into
their container's own padding so they read as a solid bar, not a
floating button, once stuck. `#settingsCatBack` has its own matching
rule since it's JS-driven, not a generic `[data-back]` element. Any new
screen's back button (must carry the `data-back="<screen>"` attribute)
or any new modal (must start its content with `.modal-head`) gets this
automatically — no per-screen/per-modal CSS needed.

**Contextual empty-state motivation.** `MOTIVATION_CARDS` (per module:
`habits`/`routine`/`diet`/`finance`, each an array of `{text, img}`) +
`motivationCardHtml(moduleKey)`, called at the top of each module's
empty-state branch. Rotates daily via the same `dayIndexSince2020()`
mechanism `todaysQuote()` already used, offset per module so different
empty modules don't show the same index on the same day. Gated by
`S.settings.emptyStateMotivation` (default `true`). **To add motivation
content for a new module**, add an array under its key in
`MOTIVATION_CARDS` and call `motivationCardHtml('thatKey')` at the top
of that module's empty-state HTML string — same pattern as the three
existing call sites (Habits, Routine, Finance).

## 12. v12.0.4 additions

**Sticker icon pack.** `STICKER_ICONS` (19 keys, real new SVG artwork —
bold filled circle badges, not a CSS variant) sits parallel to
`EMOJI_MAP`. `chromeIcon()` checks the live style in order: `emoji` →
`EMOJI_MAP`, `sticker` → `STICKER_ICONS`, otherwise falls through to the
pure-geometric `icon()`. **To add a 3rd "genuinely different" icon
pack**, follow this exact shape: a new `const X_ICONS = {...}` map keyed
by the same chrome keys, one more `if(style==='x' && X_ICONS[key])`
branch in `chromeIcon()`, one more entry in `ICON_STYLE_OPTIONS`, and a
special-cased preview branch in `drawIconStyleGrid()` (search for
`o.id==='sticker'` to find the pattern to copy). Don't add new visual
variety by editing `ICONS` itself — that's shared geometry every
Outline/Filled/Duotone/Rounded/Minimal/Hand-drawn style renders from;
changing it changes all six at once.

**Per-module motivation toggle.** `S.settings.motivationDisabledModules`
(array of module keys, default `[]`) — checked inside
`motivationCardHtml()` alongside the existing all-or-nothing
`emptyStateMotivation` flag. `MOTIVATION_MODULE_LABELS` (Settings →
Modules & Data → "Empty-state photos") is the display list; it must stay
in sync with whatever keys actually exist in `MOTIVATION_CARDS` — if you
add a new module's motivation content (§11), add its label here too, or
it'll work but won't be individually toggleable from Settings.

**Trend chart.** `trendBuckets(period)` is the single source of the
chart's data — `'day'` (14 daily points), `'week'` (8 weekly averages),
`'month'` (6 monthly averages), each returning `{label:[line1,line2],
value}`. `trendDroplinePlugin` is a small Chart.js plugin object
(`afterDatasetsDraw`) that draws the dashed green/red vertical lines to
the two highlighted points — registered via the chart's own `plugins:
[...]` array, not globally, so it only affects this one chart. If a
future session wants the same dropline treatment on another chart
(Finance, Net Worth), reuse `trendDroplinePlugin` directly rather than
writing a new one.

**Known gap, not done in v12.0.4:** the motivation card's position is
"top of its own list", not guaranteed "top of the whole screen" — a
screen with summary cards above its list (Finance's Daily Progress card,
for instance) will show the photo further down than a screen with
nothing above the list. Fixing this properly means auditing each
screen's render function individually for where its list markup sits
relative to other content, not a single shared change.

## 13. v12.2.0 additions

**No-flash photo loading.** Background photos (Daily Quote, Dashboard
Focus hero, every module's empty-state photo card) now only swap the
`background-image` in once the photo has actually finished loading —
before that, the card shows its themed CSS gradient instantly (never
blank/transparent), and a failed load just keeps that gradient. Today's
photos are pre-fetched at the very top of `init()`, before the first
`renderAll()`, instead of being requested lazily per-screen.

**Settings back-button fix.** Drilling into a Settings category
(`openSettingsCategory(cat)`) now pushes its own history step; Settings
always opens fresh on the hub (`closeSettingsCategory()` runs on every
`goToScreen('settings')` unless `opts.keepCategory`), and the `popstate`
listener re-opens the right category on Back via `state.cat`. See §11's
sticky-header section for the layout half of this; this is the
history/state half.

**New default pack: Skyglass**, 50% glass transparency (`glassIntensity`
default), background photo + auto-rotate on out of the box, and the
default font pair changed from Poppins/Manrope to SF Pro (head+body) /
IBM Plex Mono (numbers). Existing installs migrate once
(`_fontMigrationV1203`-style one-shot flag pattern — see `loadState()`).

## 14. v12.3.0 additions

**Nav/FAB readiness gate.** `#app` only gets nav/FAB visible once it
carries a `.ready` class (`#app:not(.ready) nav.bottom, .fab, .back-fab
{ visibility:hidden }`). `init()` adds `.ready` either immediately (no
onboarding needed) or inside the `onbStart` click handler (onboarding
completed). **Any future code path that can show the main app UI before
onboarding is resolved must add `.ready` at that point too** — don't
assume it's already on.

**Last-screen persistence.** `goToScreen(name, opts)` writes
`localStorage['gpl_lastScreen'] = name` on every call (after the
`.active` class swap, before the history push). `init()` reads it back
and — unless onboarding is needed, or the saved value is `'settings'`
(always restore to Dashboard instead, matching the existing "Settings
always opens on its hub" rule) — calls `goToScreen(restoreScreen,
{fromPopstate:true})` after `history.replaceState`. **If you add a new
screen id, no extra wiring is needed here** — it's picked up automatically
as long as `document.getElementById('screen-'+name)` exists (same guard
`goToScreen()` already used).

**Font system, redesigned again.** `FONT_OPTIONS` is unchanged (still
the source of truth for the family list), but `drawFontPicker()` now
populates a native `<select id="setFontHead">` instead of building a
list of `.font-pick-row` preview cards (that markup/CSS is gone —
`.font-picker-list`/`.font-pick-row` no longer exist). **New:**
`S.settings.fontWeight` (values: `'400'|'500'|'600'|'700'|'800'|'400i'|'700i'`,
an `i` suffix means italic) + `applyFontChoice()`, which sets
`--font-weight-head`/`--font-style-head` — read by the global
`h1,h2,h3,h4` rule. This is intentionally a *global* heading weight/style,
not per-font — if a future request wants per-family weight variants
(e.g. only Inter gets a Black option), that's a new field on
`FONT_OPTIONS` entries, not a change to `applyFontChoice()`'s shape.
`applyFontChoice()` is called from `applyExperiencePack()` (so it always
runs after a pack/theme change) and directly from the `setFontHead`/
`setFontWeight` change listeners.

**Heading color layer.** New CSS var `--heading-color` (root default:
`var(--text)`), used by `.section-head h2`, `.settings-group h3`,
`.qa-item .qa-lbl`, `.dash-score-mid .ds-label`. `S.settings.headingColor`
(default `''` = "follow the pack's text color") + `applyHeadingColor(pack)`,
called from `applyExperiencePack()` same as `applyFontChoice()`. Same
"fine-tune layer on top of the pack" pattern as `customAccent` — **any
new heading-like label added later should use `color:var(--heading-color)`,
not `var(--sub)` or a hardcoded value**, or it'll silently miss both the
contrast fix and the user's customization.

**Icon pack roster cut to 4.** `ICON_STYLE_OPTIONS` now holds only
`emoji`/`sticker`/`vivid`/`ios`. The six removed geometric ids (`''`,
`outline`, `filled`, `duotone`, `rounded`, `minimal`, `handdrawn`) are
**no longer selectable but the underlying `ICONS` geometry + `exp-icon-*`
CSS they drew from was not deleted** (same "don't delete, just don't
expose" pattern §9 already used for `EXPERIENCE_PACKS`) — `chromeIcon()`'s
final fallback (`icon(key,size)`) still renders it, and it's still what
`icon()` uses for the Icon Pack preview grid + habit icon picker (both
intentionally never react to the live chrome icon style). A one-time
migration in `loadState()` resets anyone whose saved
`iconStyleOverride` isn't one of the 4 current ids back to `'emoji'`.
**New `iosIconSvg(key,size)`** follows the exact `vividIconSvg()` pattern
— reuses `STICKER_ICONS[key]` glyph paths, re-skins the circle badge into
a squircle (`rx="8.5"` on a 24 viewBox) with an accent-gradient fill and a
flat white-opacity "gloss" rect over the top third. **To add a 5th
"genuinely different" icon pack**, copy this exact shape: one more
`const xIconSvg()` function following the same reuse-`STICKER_ICONS`
pattern, one more branch in `chromeIcon()`, one more `ICON_STYLE_OPTIONS`
entry, one more preview branch in `drawIconStyleGrid()`.

**Three new Experience Packs** (`ios`, `android`, `retro` — added to
`EXPERIENCE_PACKS` after `skyglass`). All three set `layout:'lifeos'`,
`navStyle:'lifeos'`, `fabStyle:'lifeos'` — **no new layout CSS was
written**, they're new color/font/`iconStyle` identities riding the
existing Life OS layout engine, exactly like Aurora/Skyglass already did.
Each sets an `iconStyle` matching its personality (`ios`→`'ios'`,
`android`→`'vivid'`, `retro`→`'sticker'`) but — per the existing v12.0.1
rule — a standalone `iconStyleOverride` always wins if the person has
ever picked one; the pack's `iconStyle` is only what it falls back to.
**Theme-strip discoverability:** `.exp-pack-strip` is now wrapped in
`.exp-pack-scroller`, which adds a `::after` fade gradient + a static
"More ›" chip pinned to the trailing edge (pure CSS, `pointer-events:none`,
doesn't affect the scroll itself). If a future pack pushes the count high
enough that even the fade isn't enough signal, consider swapping to a
paged/dot-indicator layout instead of adding more visual noise here.

**Settings cleanup.** Removed entirely (markup + JS): the Settings
"Daily Quote" card (`#quoteTextSettings` — the `renderQuote()` write to
it is now a no-op via its existing `if(s2)` null-guard, left in place
since it's harmless and saves a call-site change) and the whole "App
Icon" letter/emoji generator group (`#setIconInitial`/`#setIconColor1`/
`#setIconColor2`/`#downloadIconsBtn` + `downloadGeneratedIcon()`).
`S.settings.iconInitial`/`iconColor1`/`iconColor2` remain in
`defaultSettings()` only as inert legacy fields (harmless, not read by
any remaining UI) — fine to delete outright in a future pass if
`defaultSettings()` needs the space back.

**Section-head hardening.** No actual drift bug existed — `.section-head`
was already `display:flex; justify-content:space-between`. Added
`gap:10px; flex-wrap:wrap`, `.section-head h2{min-width:0}` (so a long
heading truncates/wraps instead of pushing the button off-strip), and
`.section-head .link-btn{flex-shrink:0}`. No JS changes.

**Scroll-strip touch containment.** `.exp-pack-strip` and
`.icon-style-strip` both gained `touch-action:pan-x;
overscroll-behavior-x:contain`, matching the pattern the main `.screen`
scroll container already used for the Y axis (see §"SCREENS" in the CSS,
v12.1.1). Any future horizontal-scroll strip should copy this pair.

## 15. apps-script.gs v9.5.0 — sync performance

**The problem:** `handleSync()` wrote every tab with `sheet.appendRow(...)`
inside a loop — one appendRow per header, one per data row. Each
`appendRow()` is a full round-trip to the Sheets service. With 15 tabs
and real data volume (habits, all transactions, routine logs, journal
entries, diet meals, etc.) this was easily 100–300+ individual API calls
per sync, which is the entire reason syncs felt slow — it scaled
linearly with total row count across every tab, not with payload size.

**The fix — `writeSheet(sheet, rows2d)`:** every writer now builds its
tab as a plain rectangular 2D JS array (headers as `rows2d[0]`, one
`.push()` per data row — pure in-memory work, zero API calls), then
calls `writeSheet()` once, which does `sheet.clearContent()` +
`sheet.getRange(1,1,rows2d.length,rows2d[0].length).setValues(rows2d)`.
That's 2 Sheets API calls per tab regardless of row count, replacing
what used to be `1 + rowCount` calls.

**Rules for extending this file:**
- **Any new tab writer must follow this same shape** — build the array,
  then one `writeSheet()` call. Do not add a new `appendRow()`-in-a-loop
  writer; that reintroduces the exact bug just fixed.
- **`rows2d` must be rectangular** — every row array the same length as
  the header row. Pad missing trailing values with `''`, the way the
  Assets/Health multi-block tabs already do (blank spacer row + a second
  header for medicines, still one array, one `writeSheet()` call).
- **The Reports tab is the deliberate exception** — it's meant to
  accumulate one row per sync (history), not reflect current state like
  every other tab, so it correctly stays a single plain `appendRow()`
  call (not a loop — never was part of the slowdown, don't "fix" it).
- **`SCRIPT_VERSION` and `index.html`'s `APP_SCRIPT_VERSION` must be
  bumped together** — this pairing is how the app's version-mismatch
  warning works (see `syncNow()`/the ping handler); it doesn't matter
  which changed, both strings need to match.
- If a sync ever *still* feels slow after this, the next thing to check
  is total JSON payload size (the client already strips meal-photo
  base64 before sending — see the v9.4.1 note above), not the write
  pattern — that part is now O(1) API calls per tab.

## 16. v12.4.0 additions

**Flash-on-open, root-caused.** The static `<section class="screen
active" id="screen-dashboard">` in the HTML means Dashboard is what the
browser paints first, always, before any JS executes — that part is
unavoidable in a single-file app with no server-side routing. What was
fixable: `#app:not(.ready) main{ visibility:hidden; }` now hides that
first paint, and `init()` resolves `restoreScreen` and calls
`goToScreen()` for it BEFORE adding `.ready` (previously `.ready` was
added first, so the restored screen briefly overwrote a visible
Dashboard). **Any future code path that can make screen content visible
before onboarding/restore is resolved needs to happen after `.ready` is
added, not before** — same rule as the nav/FAB gate from v12.3, just
extended to cover `<main>` itself.

**Back-history now two-deep on restore.** `init()`'s restore step uses
`history.pushState` (not `replaceState`) for the restored screen, so the
stack is always at least `[dashboard, restoreScreen]` on a fresh launch.
**If you ever add another "land here at boot" path, push (don't
replace)** or Back from it will fall out of the app instead of going to
Dashboard.

**Screen checklist for new module screens.** Diet was missing the
standard `<button class="link-btn" data-back="more">‹ More</button>`
that every other More-hub screen has — nothing enforced its presence, it
was just skipped when the screen was built. **Any new screen reached via
the More hub must include this element** (or the equivalent for a
different back target, like Search's `data-back="dashboard"`) — it's
what both the sticky top-of-screen back link AND the floating
`.back-fab` key off (`updateBackFab()` looks for `activeScreen.querySelector('[data-back]')`).
There's no automatic check for this — a screen without it will render
fine and simply have no way back except the bottom nav.

**Habit editing.** `openManageHabitsModal()` lists `S.habits` with an
Edit button per row → `openEditHabitModal(habitId)`, which is the same
field set as `openAddHabitModal()` but mutates the existing habit object
in place (`h.name = ...` etc.) instead of pushing a new one, then
re-opens the manage list. Delete is a `confirm()` + `S.habits =
S.habits.filter(...)`. **If `openAddHabitModal()`'s field set ever
changes** (a new field added to the add form), **`openEditHabitModal()`
needs the same field added** — they're two separate functions that
happen to mirror each other, not one shared form; there's no shared
template between them by design (add starts from defaults, edit starts
from an existing object with its own icon-selection state machine).

**Photo rotation is now push, not just prefetch.** `preloadTodaysImages()`
still exists and still warms the HTTP/service-worker cache for *not-yet-
opened* screens — that's unchanged and still worth doing. What's new is
`refreshVisiblePhotos()`, called at the end of `shuffleBackground()`
(which itself fires from the manual "Change now" button AND every
`scheduleBackgroundRotation()` timer tick — same function, one code
path). It deliberately only touches known photo-card elements
(`renderQuote()`, `renderDashboard()` if Dashboard is active, and
`renderTopMotivation(moduleKey, elId)` for the currently active module
via a small `MOTIVATION_TARGETS` id map) — **never** a blanket
`renderAll()`, because that would also re-run screens with live text
inputs (Journal's entry textarea, etc.) and could stomp on something the
person is mid-typing elsewhere in the app while a rotation timer happens
to fire. **If a new module gets its own motivation card, add its
screen-id → moduleKey/elId pair to `MOTIVATION_TARGETS` in
`refreshVisiblePhotos()`** or its photo will silently only refresh on
next navigation instead of instantly, same as before this fix.

**Custom rotation interval.** `#setBgInterval` gained a `Custom…` option;
picking it reveals `#setBgIntervalCustom` (a plain minutes `<input
type="number">`). `loadSettingsForm()` decides which state to show by
checking whether the saved `bgIntervalMin` is one of the stock dropdown
values (`0/15/30/60/180/1440`) — if not, it's necessarily a custom value
someone typed in, so the dropdown shows "Custom…" and the number field is
populated and shown. **If the stock dropdown options ever change, update
the `STOCK_INTERVALS` array in `loadSettingsForm()` to match**, or a
saved value equal to a newly-added stock option will incorrectly show as
"Custom" (harmless — it'll still schedule correctly — just a slightly
wrong-looking form state).

## 17. v12.5.0 — quote/photo-card rotation decoupled from wallpaper

**The bug:** `scheduleBackgroundRotation()`'s guard was
`if(S.settings.bgOn && S.settings.bgAuto && mins>0)`. `bgOn` is the
wallpaper-layer toggle (`#bgLayer`, see `applyBackground()`) — it has no
relationship to whether the quote/motivation cards show their photo (they
always do, unconditionally, via `setPhotoCardBg()`/`renderTopMotivation()`,
independent of `bgOn`). So the rotation *timer* was accidentally scoped
to a setting that only ever controlled a completely different visual
element. Fixed by dropping `bgOn` from that condition — rotation now
depends only on `bgAuto`+`bgIntervalMin`.

**Rule for future settings in this area:** `bgOn`/`bgOpacity` = wallpaper
layer only. `bgAuto`/`bgIntervalMin`/`bgSeed`/`shuffleBackground()`/
`refreshVisiblePhotos()` = the shared photo set used by wallpaper *and*
every quote/motivation card — these two concerns share one seed
(`S.settings.bgSeed`) but must never share a gating condition again, or
this exact bug comes back. If a future setting is meant to affect only
one of the two, gate it on the specific rendering function (`applyBackground()`
for wallpaper-only, `refreshVisiblePhotos()`/the individual `render*()`
calls for card-only) — never on `bgOn` for anything outside
`applyBackground()` itself.

**Settings markup:** the old single "Background & photos" group is now
two `settings-group` blocks — "Quote & photo cards" (`setBgAuto`,
`setBgInterval`, `setBgIntervalCustom`, `shuffleBgBtn`) and "Wallpaper"
(`setBgOn`, `setBgOpacity`). No id changed, so `loadSettingsForm()` and
every event listener are untouched — this was purely a markup/copy
reorganization plus the one JS condition fix above.

## 18. apps-script.gs v9.5.2 / v12.5.2 — the actual sync-crash fix

**Root cause was a Sheet-vs-Range API mismatch, not a try/catch gap.**
The v9.5.1 entry above (§15/CHANGELOG) fixed a real ordering bug, but
the debug log the person actually hit —
`TypeError: sheet.clearContent is not a function` — pointed at a
different bug entirely: Apps Script's `Sheet` class has no
`clearContent()` method. That method exists only on `Range`
(`Range.clearContent()`, clears a cell range's contents). The
`Sheet`-level equivalent is `clearContents()` (with an "s"). Both call
sites — `writeSheet()`'s `sheet.clearContent()` (used for all 14
readable tabs) and the Data-tab backup's `dataSheet.clearContent()` —
were calling the `Range` method name on a `Sheet` object, so the very
first tab write in every `handleSync()` call threw immediately,
before Habits, Diet, Finance, or anything else got written. Fixed by
renaming both to `clearContents()`. **If any future writer function
in `apps-script.gs` calls `.clearContent()` on a `sheet` object, that
is this exact bug again** — the correct Sheet-clearing call is always
`clearContents()`; `clearContent()` (no "s") is only ever valid when
called on a `Range` returned by `getRange(...)`.

**Version pairing:** `APP_SCRIPT_VERSION` in `index.html` and
`SCRIPT_VERSION` in `apps-script.gs` bumped together to `v9.5.2`, same
discipline as every prior apps-script fix (§15). App version bumped to
`v12.5.2` and the service worker `CACHE_NAME` bumped alongside it —
per the SW's own header comment, a redeploy without a `CACHE_NAME`
bump can leave installed/home-screen copies on stale cached JS, so any
release that touches `index.html` should bump `CACHE_NAME` too.
