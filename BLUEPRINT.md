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
