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

## 19. v13.0.0 — new icon set, and a lesson on inspecting provided assets

New GP Ledger icon (all four files: `icon-192.png`, `icon-512.png`,
`icon-512-maskable.png`, `apple-touch-icon.png`) replaced the old
branding. Filenames were unchanged, so no `manifest.json` or
`index.html` edits were needed — only the image bytes.

**Worth remembering for any future asset drop (icons, images, anything
supplied as a finished binary rather than generated in-session): open
and actually look at it before wiring it in.** All four provided icon
files turned out to be raw exports from whatever tool generated them,
with a "COLOR VARIATIONS" label baked into the bottom-right corner of
every one — invisible until you actually view the file, easy to ship
by accident if you only check the filename/dimensions match what
`manifest.json` expects. Patched out by painting over the label with
the surrounding flat background (safe because it sat in plain margin
outside the icon's rounded card, not on top of any artwork). Also
`apple-touch-icon.png` came in at 1024×1024 (524 KB) — no functional
problem, but iOS only ever renders it at ~180×180, and it's one of the
files `sw.js` precaches on install, so it was downsampled to the
conventional 180×180 (~36 KB) to keep the SW install-time cache lean.

**`CACHE_NAME` in `sw.js` bumped to `gp-ledger-v13-0-0`.** This is the
part that actually delivers new icons to phones with GP Ledger already
installed — same filenames means the old cached copies would otherwise
persist indefinitely post-deploy (see §18's note on this).

`apps-script.gs` / `SCRIPT_VERSION` untouched — this release is
static-file-only, no backend logic changed, so no redeploy of the Apps
Script side is required.

## 20. v13.1.0 — Quote Engine

Built on top of the existing rotation system (`QUOTES`, `MOTIVATION_CARDS`,
`activeQuoteList`/`activeModuleQuoteList`, `advanceQuote`/
`advanceModuleQuote`) rather than replacing it — every pre-existing call
site (`todaysQuote()`, `currentModuleQuoteText()`, the Manage Quotes
editor) works unchanged. New code should call the two new public
entry points instead: `getDailyQuote()` and `getModuleQuote(key)`.

**Data model change, backward compatible:** `QUOTES` entries went from
`[text, author]` tuples to `{text, author, cat, src}` objects. Anything
reading `.text`/`.author` (which is everything) is unaffected;
`defaultQuotes()` and `defaultModuleQuotes()` now also carry `cat`/`src`
through onto the runtime editable quote objects, for a future
filter-by-category/source view in Manage Quotes — not built yet, just
the data is there.

**`FUTURE_MODULE_QUOTES`** — quote pools for Tasks/Notes/Travel/
Learning/Content & Ideas/Meal Planner exist now, pre-written, but are
NOT wired into `MODULE_QUOTE_KEYS` — see the comment above that
constant for the exact 4-step activation checklist when each module is
actually built. Worth remembering: don't add a module's key to
`MODULE_QUOTE_KEYS` before the module's screen exists, or Settings →
Quotes → Manage shows a category with nowhere to display it.

**Recency-avoidance lives outside `S` entirely** (`gpl_quoteRecent` in
its own localStorage key, via `loadQuoteRecentCache()`/
`saveQuoteRecentCache()`) — not `S.settings`, because `S.settings`
syncs to Sheets wholesale (`payload.settings = S.settings` in
`syncNow()`). This is the pattern to follow for any future "local
display state that shouldn't ride along with a Sheets sync" — a
sibling localStorage key, never a field bolted onto `S.settings`.

## 21. v13.2.0 — Tasks module (first of the six new modules)

Confirms the Phase 0 audit's read on `MODULE_DEFS`: adding
`{key:'tasks', ...}` was genuinely all that was needed for nav/More
screen/Settings→Modules — `renderMoreCards()`, `enabledModules()`, and
the module-enable backfill in `loadState()` are 100% data-driven, no
special-casing required anywhere in that layer.

**New touchpoints for the next module (Notes, most likely next):**
1. `S` state key + `loadState()`/`saveState()` pair (`gpl_<key>`)
2. `syncNow()` payload entry — rides the full-JSON Data-tab snapshot
   automatically, no `apps-script.gs` change required unless you also
   want a dedicated readable tab
3. `MODULE_DEFS` entry (nav/More/Settings free after this)
4. Icon: one entry each in `ICONS`, `STICKER_ICONS`, `VIVID_COLORS`
   (`EMOJI_MAP` auto-derives from `MODULE_DEFS.icon`)
5. Screen HTML section + CSS for its list rows
6. `render<Module>()` / `open<Module>Modal()` following the
   Subscriptions/Assets pattern (openModal→onclick handlers→
   saveState()→re-render→closeModal())
7. `goToScreen()` dispatch line
8. `FAB_ACTIONS` + `CREATE_ACTIONS` entries
9. Activate its `FUTURE_MODULE_QUOTES` pool into `MOTIVATION_CARDS`/
   `MODULE_QUOTE_KEYS`/`MOTIVATION_MODULE_LABELS`/`MOTIVATION_TARGETS`+elId

**Recurrence pattern established:** completing a recurring task clones
itself forward (`nextRecurDate()`) rather than maintaining a template/
instance split. Cheap, no new data shape — reuse this for any future
module that needs "repeats" (Meal Planner's weekly repeat, per the
brief, is the next place this will come up).

**Deliberately deferred, not forgotten:** Dashboard widget (Phase 14),
Search integration (Phase 15), a dedicated readable "Tasks" Sheets tab.
None of these block Tasks from being fully usable today.

## 22. v13.3.0 — sound library, deeper quotes, icon refresh round 2

**`TONE_LIBRARY`** replaces the old 3-entry inline `notesFor` map in
`playAlertTone()`. Pattern worth reusing for future additions: each
entry is `{label, wave, notes:[[freq,delay,dur],...]}`, and the
Settings dropdown (`drawAlertToneList()`) builds its `<option>` list
from `Object.entries(TONE_LIBRARY)` — adding tone #24 is purely a data
addition, no template/UI edit needed.

**Quote depth is now genuinely uneven-fixed** — the brief's complaint
was accurate: Subscriptions/Assets/Documents had exactly 1 quote each
before this release, which is why they were the priority. Worth
remembering for the next module built: give it 5+ quotes at launch,
not 1–2, or it'll need this same catch-up pass later.

**Icon watermark issue, round 2 — same lesson as §19, reinforced:**
this batch had a *worse* problem than the first (a pattern baked
across the entire canvas, not just a corner label) — reinforces that
"open and look at every provided asset before wiring it in" needs to
happen on *every* asset drop, not just the first one. A despeckle
pass (near-white/low-saturation pixels → pure white) was added to the
toolkit alongside the existing watermark-patch approach; keep both
techniques in mind for any future icon/image asset review.

## 23. v13.4.0 — all six new modules complete + honest per-quote images

Every module from the original brief now exists: Tasks (v13.2.0) plus
Notes, Travel, Learning, Content & Ideas, Meal Planner (this release).
The registry-driven architecture held up across all six with zero
special-casing — same `MODULE_DEFS` entry → nav/More/Settings pattern,
same modal CRUD pattern, same quote-pool activation checklist.

**Travel's expense integration is the one cross-module wire actually
built**: `openTxModal()` gained an optional Trip `<select>` (only
rendered when `S.trips.length>0`), and `renderTripDetail()`'s "Linked
expenses" section filters `S.transactions` by `tripId` — genuinely
read-only, no new ledger. This is the template for any future
module-to-Finance link: tag the existing transaction, filter-and-total
on the other end, never fork the data.

**Per-quote images — the honest version.** `motivationCardHtml()` and
`renderQuote()` both now derive their picsum seed from the active
quote's own `id`/`img` field (via new `currentModuleQuoteObj()`
helper) instead of `module+date`. Worth remembering if this comes up
again: picsum.photos seeds are for *reproducibility*, not content
matching — there is no keyword search happening. True subject-matched
images would need a real photo-search API (Unsplash/Pexels), which
this app deliberately doesn't depend on (offline-first, no API-key
requirement for core function). If that trade-off is ever revisited,
it's a bigger architectural conversation, not a quick wiring change.

**Next natural step:** Dashboard "Today" integration (tasks due, trip
countdown, learning next-action — Phase 14) and Search across all six
new modules (Phase 15). Both were deliberately deferred, same as
Tasks' were in v13.2.0, now that every module they'd surface actually
exists.

## 24. v13.5.0 — logo everywhere, Dashboard Today/Upcoming, People, Nudges

**The embedded logo lives in exactly one place**: `LOGO_DATA_URI`, a
base64 PNG constant, reused by the Dashboard badge, onboarding screen,
and About/splash screen. Worth remembering for any future branding
update: this constant is the only thing that needs to change — don't
go hunting for three separate `<img>` tags.

**Dashboard Today/Upcoming (Phase 14) landed as an extension of the
existing `pr` (priorities) array and a new parallel `up` array**, not
a rewrite — same `.priority-row` styling reused for both, capped at 5
and 3 items respectively so the Dashboard doesn't bloat. Every module
built this session (Tasks, Notes, Travel, Learning, Content, Meal
Planner, People) feeds one or two lines in here rather than getting
its own Dashboard section — this is the pattern for any future module
too.

**People's Finance/Task integration follows Travel's exact template**:
an optional foreign-key-style field on the *other* module
(`transaction.personId`, `task.personId`), never a second data
structure. Any future "tag this to a person" need should follow the
same shape.

**Nudges (`checkNudges()`) share the existing reminder plumbing**
(`openGenericReminderPopup`, the dedupe-by-date pattern every other
`checkXReminders()` function already uses) rather than inventing a
parallel notification system. Dedupe state lives in
`S.settings.nudgeLastShown` — small, meaningful, low-volume, so unlike
`gpl_quoteRecent` it's fine for this one to live inside the
already-synced `S.settings` rather than getting its own localStorage
key. **Known limitation, not yet addressed:** these three conditions
only get checked client-side while the app is open. Real background
delivery (app closed) would mean adding the same three checks
server-side in `apps-script.gs`, alongside its existing Telegram
reminder path — a real next step, scoped out of this release.

## 25. v13.6.0 — calorie-aware Meal Planner

`mealSlotTargets()` calls the existing `dietTargets()` — no second
TDEE calculation was written. `FOOD_SUGGESTIONS` is a curated ~44-item
library (not sourced from anywhere external, hand-picked common
meals with rough calorie figures), matched to each slot's share of
the daily target via nearest-calorie search
(`suggestFoodForSlot`), with a per-week "don't repeat while other
options exist" rule (falls back to allowing repeats once every option
in a slot's pool has been used that week, rather than leaving a slot
empty).

**Deliberately stayed a plain string, not a data-model change**:
`S.mealPlan[date][slot]` is still exactly the free-text string it always
was. The calorie figure is embedded in the text itself
(`"...(~320 kcal)"`) and parsed back out with a regex
(`mpParseCalories`) purely for display (the day's running total). This
was the one design decision in this feature actually worth deliberating
— an object-shaped `{text, calories}` would be more "correct" but would
require migrating every existing plan and touching the input's read/
write path; the regex approach cost nothing and broke nothing.

## 26. v13.7.0 — the audit lesson: outbound wiring ≠ inbound wiring

**Real bug, found by actually auditing rather than re-asserting
confidence.** Every new module's data got added to `syncNow()`'s
OUTBOUND payload as each module shipped (v13.2.0 onward) — but the two
INBOUND restore paths (`loadFromSheetBtn`'s handler, and local JSON
backup import) were never touched. Data flowed to Sheets fine; pulling
it back down on a fresh install silently dropped it. Neither path
errored — they just quietly ignored fields they didn't know to look
for, which is exactly why this kind of bug survives casual testing
("sync works, no errors shown") and only shows up on the one flow
nobody tries mid-session: fresh install → restore.

**The lesson for every future module**: adding sync support is a
**two-sided change**, not one. `syncNow()`'s payload is the outbound
half; `loadFromSheetBtn`'s click handler AND the local-JSON-restore
`Object.assign()` defaults are the inbound half. All three need the
new field, or data silently doesn't round-trip. Going forward, treat
"add to syncNow()" as an incomplete edit until both restore paths are
also checked in the same sitting — not a separate later pass.

## 27. v13.8.0 — Search and Tasks-reminders were also incomplete

Two more gaps found the same way as v13.7.0's: the user asked a second
time whether everything was actually wired, which prompted an actual
corner-to-corner pass instead of re-asserting confidence. Worth noting
as a pattern — both this and v13.7.0's bug were silent, not erroring,
which is exactly why "no console errors" isn't sufficient evidence
that a feature genuinely covers what it claims to.

**Search** (`renderSearchResults()`) — its own empty-state copy claims
full coverage ("search across every module at once"); it wasn't true
for any of the 7 modules built this session. Fixed by extending the
same flat `add(searchScore(...), {...})` calls already used for every
pre-existing module — no architecture change, just 7 missing entries.
**Lesson for the next module**: Search is a manually-maintained list,
not automatically derived from `MODULE_DEFS` — a new module's data
needs an explicit line here too, same as the sync payload needed one.

**Tasks reminders** — Tasks has had `dueDate`/`dueTime` fields since
it shipped (v13.2.0), but nothing ever read them proactively;
`checkDailyReminders()` never gained a Tasks check when Tasks itself
was built. `checkTaskReminders()` now follows the exact
`lastNotified`-on-the-record pattern of every other check in that
function. **Lesson**: a module that has date-based fields conceptually
"due" for reminders needs its own `checkXReminders()` added to
`checkDailyReminders()` explicitly, at the time it's built — it's not
automatic just because the data field exists.

**Confirmed NOT bugs, just scope not yet reached** (worth stating
plainly so a future pass doesn't waste time "fixing" something that
was never broken): AI Coach integration for the 7 new modules (Phase
16 in the original brief, deliberately after all modules exist — which
is now, so it's a reasonable next step, just not a defect). Report/
Excel exports for the 7 new modules (every pre-existing module has
one; none of the 7 new ones do — consistent absence, not a
per-module oversight). No app-wide data-wipe feature (never existed,
checked specifically, not something this session removed or missed).

## 28. v13.10.0 — Morning Summary on Home

A scoped brief this time: improve *only* the Home/Dashboard, using a
reference image for visual direction without redesigning anything else.
Worth documenting the pattern since it's the first tightly-scoped visual
brief since the module-building sessions above.

**What was added.** One new function, `renderMorningSummary()`, called
as the first line of the existing `renderDashboard()`. Renders into a
new empty `<div id="morningSummaryWrap">` placed above the existing
`.focus-tabs` in `#screen-dashboard` — everything below it (Daily
Progress ring, Quick Actions, Top priorities, Upcoming) is byte-for-byte
unchanged. Four pieces, in order: Yesterday metrics → Carry Forward →
Today Top 3 → one rule-based Insight.

**Zero new data model — this was the actual constraint to hold.** Every
value is read through helpers `renderDashboard()` already calls:
`taskIsOverdue`/`taskIsToday`, `debtIsOverdue`, `dueSoonSubscriptions()`,
`goalProgressCalc()`, `habitProgress()`/`habitValue()`, `txForDate()`,
`sleepHabit()`, plus `addDays()` for yesterday's date. No new fields on
`S`, no new localStorage keys, no new sync payload entries — this
section literally cannot drift out of sync with the modules it reads
from, because it doesn't hold its own copy of anything.

**Carry Forward / Today Top 3 share one priority ladder** (overdue
task, high-priority first → overdue debt EMI → subscription due soon →
goal behind pace → today's due tasks → today's unlogged habits for the
Top 3 only). Carry Forward takes the #1 result; Top 3 walks the same
ladder and takes up to 3. Intentional overlap — the brief's own
reference image shows the carry-forward item appearing again as Today's
#1, so this isn't a bug to dedupe later.

**Insight is deliberately NOT an AI Coach call.** The brief said don't
touch AI Coach, and "max 1 sentence, no generic AI advice" reads like a
rule-based line is actually the more correct choice here, not a
shortcut — a fixed 4-branch sentence keyed off yesterday's completion
rate and whether a carry-forward item exists.

**One deviation from the reference image, noted rather than silently
applied**: the mockup repeats "Good morning, GP" inside the new section,
but the existing header (`greetName`/`greetSub`) already shows that
greeting immediately above it — repeating it would be exactly the
"unnecessary duplication" the brief's own visual-design section warned
against. New section starts at "Yesterday • [date]" instead.

**Empty-state discipline**: every one of the four pieces independently
checks whether it has real data before rendering, and the whole
`morningSummaryWrap` collapses to nothing if all four are empty (new
install, no data yet) — no wall of "0/0" placeholder cards, per the
brief's explicit empty-data section.

**Known gap from this round, fixed in v13.12.0 below**: `APP_VERSION` and
the Service Worker `CACHE_NAME` were never actually bumped when this
shipped — About/Settings kept showing v13.9.0 despite the new section
being live. Root cause: the version bump step was treated as separate
from the feature work and got dropped. Flagging the pattern explicitly
so it isn't repeated: bump the version in the *same* edit that ships the
feature, not as a follow-up.

## 29. v13.12.0 — Morning Summary refined against the reference mockup,
header clock added

A second, tightly-scoped Home-only brief, this time with both a live
project export and a target screenshot attached as ground truth. Three
changes, per the brief's explicit order:

**1. Layout order corrected.** The brief's reference put the existing
Dashboard Image/Quote (the `.focus-tabs` + `.hero-focus-card` pair) at
the very top of Home, with Yesterday below it. The previous round had
actually placed `#morningSummaryWrap` *above* `.focus-tabs` in the
markup — the opposite order. Fixed by moving the two blocks in
`#screen-dashboard`; no changes to either block's own internals.

**2. Yesterday made collapsible.** Previously always-expanded; now
starts collapsed (`Yesterday · Aug 16 ▾`), tap-to-expand/collapse in
place via a new in-memory flag `msumYesterdayOpen` (module-scoped `let`,
not persisted — resets to collapsed on reload, matching "collapsed by
default" literally rather than remembering the user's last state, which
the brief didn't ask for). Toggling calls `renderMorningSummary()` again
— cheap and self-contained, no need to run the rest of
`renderDashboard()`. Added a keyboard handler (`Enter`/`Space`) on the
toggle row alongside the click handler, since it's a `role="button"`.

**3. Main achievement row added.** The reference mockup's expanded
Yesterday panel shows both a green "✓ Main achievement" row and the
existing amber "⚠ Carry-forward" row. Achievement is a new 3-branch
rule-based line (all habits done → most tasks done → most habits done,
in that priority order), shown only when `goodDay` is true and only
alongside real Yesterday data — same "don't invent it" discipline as
everything else in this section. Today Top 3 and Insight now render
below the Yesterday card unconditionally (not nested inside it), so they
stay visible whether or not Yesterday is expanded, per the brief's
layout diagram.

**4. Header Day/Date/Time indicator.** New `updateHeaderDateTime()`,
called once on load and every 30s after. Renders into a new
`#headerDateTime` element placed between the existing `.greet` block and
`.header-actions` — deliberately not inside either, so `greetName`/
`greetSub`/the search button/the sync button are all byte-for-byte
unchanged. Uses `toLocaleDateString`/`toLocaleTimeString` with no
explicit timezone argument, so it follows the browser's local timezone
(the app has no separate configured-timezone setting to defer to). Hides
itself under a 380px viewport media query rather than wrapping or
shrinking the greeting on small phones — the brief's "only if it fits"
condition, implemented as a hard breakpoint rather than a runtime
overflow check, which is simpler and has the same effect in practice.

**Version bump.** `APP_VERSION` and `sw.js`'s `CACHE_NAME` now both
correctly read v13.12.0, closing the gap noted at the end of the v13.10.0
section above.
