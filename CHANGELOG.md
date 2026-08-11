# Changelog — v12.3.0 (nav-state fixes, font/heading redesign, 3 new themes, icon pack cleanup) → history below

## v12.3.0

**Navigation / screen-state**
- **Fixed the onboarding screen briefly showing the Home/nav buttons and
  the `+` button behind it on first launch.** Root cause: nav and the FAB
  were always in the DOM and only visually behind the onboarding overlay
  by z-index — on slower loads there was a flash before that overlay
  painted. Nav/FAB are now hidden (not just covered) until the app
  explicitly marks itself ready — right after onboarding completes, or
  immediately if no onboarding is needed.
- **Added real "last screen" persistence.** Nothing previously remembered
  which screen you were on, so a killed/relaunched app (or a phone that
  restores a stale hash on its own) had no consistent landing spot.
  `goToScreen()` now saves the current screen name on every navigation;
  `init()` restores it on launch instead of always forcing Dashboard
  (Settings is exempted — it always reopens on its hub, never mid-category,
  same rule the v12.2.0 Settings-back fix already established).

**Typography**
- **Font selector redesigned.** The old "App font" control was a tall
  scrolling list of big preview cards, which made Settings unnecessarily
  long. Replaced with two compact, clearly separated native dropdowns —
  **App Font** and **Mono Font** (mono already was a dropdown; app font
  now matches it) — both natively scrollable with no extra markup needed.
- **New: Font Weight/Style control**, independent of family — Regular /
  Medium / Semibold / Bold / Extra Bold / Italic / Bold Italic — applied
  to all headings via a new `--font-weight-head`/`--font-style-head` pair.
  Changing font or weight now only ever touches typography variables,
  never theme/pack color or layout — verified no call site does both.

**Readability**
- **Fixed a real contrast bug: section headings ("Quick Actions", "Top
  Priority", every screen's section title, settings-group headers, quick
  action labels) were rendered in the dim `--sub` secondary/caption color**
  instead of a proper heading color — fine for captions, too low-contrast
  for a heading, and made worse on light packs like Skyglass. Introduced a
  dedicated `--heading-color` variable (defaults to the theme's full-
  contrast text color) and moved those rules onto it.
- **New: user-controlled Heading color**, Settings → Appearance — a color
  picker independent of the accent color and the active theme, with a
  one-tap "Reset to theme" to go back to the default. Persists across
  theme/pack changes until explicitly reset.

**Themes**
- **Three new Experience Packs**: **iOS** (frosted glass, San Francisco
  font stack, blue/indigo accent), **Android** (bold Material greens,
  pill-shaped buttons, big rounded tiles, Roboto), and **Retro Mobile**
  (chunky, high-contrast, monospace-flavored — inspired by 2000s
  messenger-phone UIs). All three are "inspired by", not pixel clones of,
  a real OS — a literal copy would also risk another company's actual UI/
  trademarks. They reuse the existing Life OS layout/nav/FAB engine with
  their own color palette, font pairing, and default icon style.
- **Fixed a discoverability gap**: the theme picker is a horizontal-scroll
  strip with its scrollbar intentionally hidden, which gave no visual clue
  more packs existed off-screen (2 fit on a typical phone screen; there
  are now 7). Added a fixed fade-out edge + a "More ›" chip so the overflow
  is obvious without a visible scrollbar.

**Icons**
- **Simplified the icon pack picker from 10 options down to 4**: kept
  Emoji, Sticker, and Vivid; removed the six near-identical geometric
  variants (Auto, Outline, Filled, Duotone, Rounded, Minimal, Hand-drawn —
  one shared line-art geometry differing only in stroke/fill, which read
  as redundant clutter next to genuinely distinct packs). Replaced them
  with one new **iOS** icon pack — glossy squircle tiles in your accent
  color with a soft top-gloss highlight, real per-key artwork (not a CSS
  filter). Anyone with an old removed style saved is migrated to Emoji
  automatically. The underlying geometry these six drew from is untouched
  in the stylesheet — re-adding any of them later is a pure data change,
  not new artwork (see BLUEPRINT.md §9).

**Settings cleanup**
- Removed the "Daily Quote" card that sat at the top of the Settings
  screen — decorative, not a setting.
- Removed the General → "Icon letter / emoji" alternate-icon generator
  (custom initials/colors + a canvas-rendered downloadable icon set) —
  redundant now that the app has a fixed brand logo everywhere. Its
  now-unused settings fields, form bindings, and click handler were all
  removed together, not just hidden.

**Layout**
- Audited the Add-button-next-to-heading pattern (`.section-head`) — it
  was already flexbox with no absolute-positioning hacks, so no drift bug
  existed. Hardened it further: `gap`+`flex-wrap` so a long heading next
  to "+ Add" can't force horizontal overflow on the narrowest phones, and
  the button no longer shrinks below a comfortable tap target.

**Scrolling**
- Added `touch-action:pan-x` + `overscroll-behavior-x:contain` to the two
  horizontal-scroll strips (Experience Pack picker, Icon Pack picker) so
  swiping them doesn't fight or chain into the page's vertical scroll.
  Main-screen scrolling itself was already tuned in v12.1.1 (smooth
  scroll, touch scrolling, overscroll containment) — left as-is.

**About**
- Reviewed the About screen content — it already reads as a finished
  product description (feature list, privacy stance, credits), not
  placeholder copy, so it's unchanged apart from a small chip reflecting
  the new theme count.

## v12.2.0

- **Fixed the visible delay/black-flash on every background photo** (Daily
  Quote card, the Focus hero card on Dashboard, and the empty-state photo
  card on every module including Goals and Documents). Root cause: the app
  was setting `background-image` to a gradient+photo pair the instant a
  screen rendered, before the photo had actually downloaded — a background
  layer with an unloaded `url()` paints as fully transparent, so with
  nothing behind it that read as a slow, blank, or broken image. Worst on
  screens like Goals/Documents that are opened less often, since their
  photo was almost never warm.
  Fix: the photo is now only swapped in once it's actually finished
  loading; until then the card shows its themed CSS gradient instantly
  (never blank), and a failed load quietly keeps that gradient instead of
  showing a broken image. Today's photos are also now pre-fetched right at
  startup, before the first screen even renders, instead of after.
- **Fixed Settings back-button/back-gesture sometimes landing on a stale
  or empty-looking screen.** Drilling into a Settings category (e.g.
  Appearance) never registered with the browser's back history, so the
  system/gesture Back button could skip past Settings entirely, and
  reopening Settings afterward could show it still stuck on whatever
  category was last open instead of the hub. Settings now always opens
  fresh on the hub, and each category drill-in has its own back-history
  step, so Back reliably steps out one level at a time.
- **New default look: Skyglass experience pack**, 50% glass transparency,
  background photo + auto-rotate turned on out of the box, and a new
  default font pairing — SF Pro for headings/body, IBM Plex Mono for
  numbers. Existing installs are migrated to this once automatically;
  anything you change afterward sticks.
- Small copy polish on the About screen.

## v12.1.0

- **Fixed a real bug: the Glass intensity slider wasn't visibly doing
  anything.** Two causes, both fixed: (1) the glass-card CSS rule only
  targeted `.card`/`.dash-tile`/`.quote-card`/`nav.bottom` — Settings
  panels, stat tiles, and modals all had their own hardcoded solid
  background outside that rule, so the screen most people check first
  (Settings) never visibly changed. Folded those in. (2) The opacity
  percentage was computed with `calc()` inside `color-mix()`, which
  doesn't render reliably on every mobile browser — switched to a
  precomputed plain percentage instead.
- **Diet Plan redesigned to be scannable, not a wall of text** — food
  sources are now small emoji chips (🥚 Eggs, 🍚 Rice, 🥑 Avocado, etc.)
  instead of bulleted sentences, macros are 4 compact emoji tiles, and
  the Do/Don't sections are short one-line tips with an icon instead of
  full paragraphs.
- **New: settable daily calorie goal**, in Settings → Diet & body stats,
  right under Goal — "Auto" (calculated from your stats, as before) or
  "Set it myself" with a manual kcal number. Either way the Diet tab's
  targets, the Calories-left ring, and the Diet Plan all read from the
  same number, so it stays linked instead of becoming a separate figure.
  Manual mode also works even without height/weight/age on file.
- Re: the animated timer — "Scenic" (Settings → Appearance → Timer style)
  is that feature. It's an original rotating pastel/gradient design
  rather than a copy of the specific illustrated characters in the
  reference (can't reproduce copyrighted artwork), which may be why it
  didn't look like what was expected.

# Changelog — v12.0.9 (focus timer is now genuinely full-screen, Skyglass tuning, glass intensity control) → history below

## v12.0.9

- **Focus timer is now a true full-screen page**, not a small modal —
  Plant, Ring, Digits and Scenic all now cover the whole screen while a
  session is running, closer to the reference. Tapping ✕ just minimizes it
  (the session keeps running in the background, same as before); reopen it
  from the running-timer bar or the running category chip.
- **Plant style rebuilt to fill the screen** at reference proportions — a
  much bigger leaf badge, same speech-bubble/time/progress-track styling,
  same transparency levels throughout, instead of being squeezed into a
  small card.
- **Skyglass now defaults to the Emoji icon pack.**
- **New "Glass intensity" slider** in Settings → Appearance, right below
  Experience Pack — higher is more see-through and blurred ("crystal
  clear"), lower is more solid/readable. Only visually affects glass-card
  packs (Aurora, Skyglass); everything else is unaffected.
- Applied the Skyglass gradient background at the `body` level too (not
  just the app shell), so there's no flat-color flash anywhere in the app.
- Audited icon/theme consistency across every screen — nav, module cards,
  and all icon-pack coverage (Sticker/Vivid) were confirmed consistent;
  no per-screen fallback gaps found.

# Changelog — v12.0.8 (real theme-reset bug fixed, timer removed from habit rows, Diet Plan feature, Skyglass pack) → history below

## v12.0.8 — bug fix + feature pass

- **Fixed a real bug: changing the mono/number font (or an accent color)
  was silently resetting the entire color scheme.** Root cause: those
  inputs called the full theme-apply function, which re-applies the whole
  Theme Preset color set (background/cards/text — defaulting to a plain
  dark preset) on top of whatever Experience Pack was actually showing
  (e.g. Aurora), with nothing re-applying the pack afterward. Both inputs
  now touch only the one CSS value they're actually responsible for —
  picking a font or an accent color no longer touches your background,
  cards, or icon pack. Confirmed the Timer style picker never had this
  problem in the first place.
- **Removed the ▶ timer button from habit rows.** Starting a timed session
  is Routine-tab only now (via Start Log); habit rows just log amounts.
- **Removed the default "Reading" habit** added in v12.0.7 (only removes
  the untouched auto-added one — never touches a Reading habit you made or
  logged something to yourself). The Reading routine category + its timer
  stay.
- **New "Diet Plan" feature** — a 🩺 button on the Diet tab builds a
  doctor-style write-up from the height/weight/age/activity/goal already
  saved in Settings → Diet & body stats: BMI + category, daily
  calorie/macro targets, a suggested meal structure, food suggestions by
  protein/carbs/fat/fiber, and goal-specific do's and don'ts — with a
  plain note to involve a real doctor for any existing condition.
- **Added a "Calories left" progress ring** to the Diet tab's targets
  card, next to the daily target numbers.
- **New "Skyglass" Experience Pack** — a blue-to-pink glassmorphic theme
  (translucent cards, soft wave gradient background) modeled on the
  reference image, with contrast tuned up from the reference on purpose so
  it stays easy to read in daily use rather than just in a screenshot.

# Changelog — v12.0.7 (real duration bug fix, human time formatting, Quick Log rework, Scenic timer style, journal rewritten as a list, Reading/Sleep timers, Vivid icon pack) → history below

## v12.0.7 — bug fix + another large feature pass

- **Fixed a real duration bug.** A block where start and end were the same
  time (e.g. 7:50 PM–7:50 PM) was being computed as a full 24 hours instead
  of 0 — the midnight-rollover check used `<=` instead of `<`. Fixed.
- **Durations now read in plain minutes/hours** instead of confusing decimals
  — "0.5h" and "0.3h" are gone, replaced with "30 min", "10 min", "1 hr 30
  min", etc. everywhere a duration is shown (Routine totals, blocks list,
  category breakdown, dashboard, day-detail popup).
- **Quick Log reworked.** Chips now wrap across multiple lines instead of
  one scrolling row. Tapping a category only SELECTS it — nothing starts
  recording. A new **Start Log** button underneath actually begins the
  session and opens the timer page; tapping the running category again
  reopens its timer instead of risking an accidental stop.
- **Timer page always opens** when a session is started via Start Log (not
  only for Meditation), shows which category is running, and has a Stop
  control right there.
- **Plant timer style redesigned** to match the reference closely: green
  gradient card, "Stay focused 😊" speech bubble, circular badge, big time,
  thin progress track with a traveling dot, full-width Stop pill.
- **New "Scenic" timer style** — a 4th option alongside Plant/Ring/Digits:
  a rotating pastel illustrated-style background (different look each
  session), big clock-style time, category label, round stop button.
- **Journal rewritten from one note per day to a list of entries.** Every
  save now adds a new entry; a day's entries list below with Edit and
  Delete. Delete can be turned off in Settings → Journal (Edit still
  works) if you'd rather entries not be removable. Every place that read
  the old single-entry format (word counts, calendar dots, day-detail
  popup, search, PDF/Excel exports) was updated to match.
- **Added Reading as a habit + routine category** (10/20/30/45-min quick
  amounts, timer-enabled) and **turned the timer on for Sleep** too, so
  both work the same way Meditation already did.
- **New "Vivid" icon pack** — colorful rounded-square badges, a different
  hue per module, alongside Emoji/Sticker/Outline/etc. in Settings →
  Appearance → Icon pack.

# Changelog — v12.0.6 (top motivation cards, floating back button, roomier inputs, more light themes, Aurora pack, Meditation + focus timer, single-segment template apply) → history below

## v12.0.6 — a large UX + feature pass

- **Custom-amount input in habit rows was cramped.** Bumped its height/padding
  (and the Add/collapse buttons next to it) so typing there feels comfortable
  instead of squeezed.
- **Added a floating back button.** '‹ More' and '‹ All settings' sat at the
  top of the screen — a long one-handed reach. A small circular back button
  now floats in the thumb zone on any screen with a back link (and inside
  Settings categories), doing the same thing.
- **Moved the photo/quote motivation cards to the top of every screen.**
  They used to only appear buried in an empty list. Routine, Finance, Debts,
  Diet, Goals, Subscriptions, Assets, and Documents now show them right at
  the top, above the main content — always visible, not just when empty.
- **Four new light theme presets:** Ivory, Sand, Lilac, Sage — the color
  preset grid skewed heavily dark before this.
- **New "Aurora" Experience Pack — now the default.** Warm coral/plum
  gradient palette with glass-style cards and rounded dial widgets, modeled
  on a warm readiness-app reference. Existing installs are migrated to it
  once; picking any other pack afterwards sticks normally.
- **Added a Meditation habit + Meditation routine category**, merged into
  existing data automatically (won't duplicate or remove anything you
  already have).
- **New focus timer** for Meditation (and anything else marked as a timer
  category): three selectable styles — Plant (green, grows with progress +
  a slider bar, the default), Ring (circular progress), and Digits (big
  hrs/min/sec readout) — picked in Settings → Appearance → Timer style.
  Start it from the Routine quick-log chip or the ▶ button on the
  Meditation habit row; Stop logs the elapsed time to both the routine
  block and the linked habit automatically.
- **Templates can now be applied one segment at a time.** Each block in the
  Templates modal has a "+ Today" button to add just that one time segment
  to today's log, alongside the existing "Apply to today" (whole day) and
  "Fill this week" options.

# Changelog — v12.0.5 (bottom nav breathing room) → history below

## v12.0.5

- **Bottom nav buttons had no space between them.** They sat flush
  edge-to-edge on mobile with no visual gap, making the row feel
  cramped. Added a small gap between buttons (and tightened their
  internal padding to compensate) so each tab has breathing room
  without the bar overflowing on narrow screens.

# Changelog — v12.0.4 (nav dead-space fix, finance score bug, About consolidated, new Sticker icon pack, motivation cards on 9 modules, trend chart rebuild) → history below

## v12.0.4 — a large fix/feature pass

- **Fixed the nav dead-space bug.** `body.exp-nav-lifeos nav.bottom` still
  had leftover `padding-left/right:36px` from before the dedicated
  `.nav-fab-spacer` existed (v12.0.1) — the two were double-compensating
  for the FAB, leaving visible empty space at both ends of the nav bar
  (the circled area around Home/More). Padding removed; the spacer alone
  now handles FAB clearance correctly.
- **Fixed a real score bug:** the Finance tab's sub-score unconditionally
  factored in a "subscriptions due" score even with **zero subscriptions
  tracked**, dragging the score toward 50% regardless of actual progress
  (confirmed: overdue debts correctly scored 0, untracked subscriptions
  wrongly scored 50, averaging to exactly the reported 50%). Now guarded
  the same way debts already was — an untracked module contributes
  nothing to the score, same "only count what's in use" rule documented
  elsewhere in this file. Live-update was already working correctly
  (debt actions already called `renderDashboard()`) — this was purely a
  bad formula, not a stale-refresh issue.
- **About consolidated — one tap, not two.** The Settings → About
  category previously drilled into a sub-list containing exactly one
  row, which then opened the About modal — two taps and a screen
  transition for one piece of info. The hub's About row now opens the
  modal directly; the redundant category/settings-group was removed.
- **New "Sticker" icon pack — genuinely different geometry, not another
  fill/stroke variant.** The existing Outline/Filled/Duotone/Rounded/
  Minimal/Hand-drawn styles all share one path-geometry set and only
  differ in stroke/fill, which is why they read as "all similar" next to
  Emoji (a completely different rendering method). Sticker is real new
  artwork — bold filled circle-badge icons, 19 keys — selected the same
  way Emoji is, with its own live preview in the picker. **The existing
  6 styles are completely unchanged**, per direct request not to touch
  them.
- **Motivational empty-state cards extended to 6 more modules** — Debts,
  Diet, Subscriptions, Assets, Documents, Goals (previously only Habits/
  Routine/Finance had them). New content added to `MOTIVATION_CARDS` for
  each. New **per-module toggle** (Settings → Modules & Data →
  "Empty-state photos") alongside the existing all-or-nothing General
  toggle — e.g. turn off just Diet's cards without losing them elsewhere.
- **Trend chart rebuilt** to match the referenced style: smooth spline
  (no area fill), the highest and lowest points highlighted in green/red
  with a small custom Chart.js plugin drawing dashed vertical droplines
  to the axis, two-line date+weekday labels (e.g. "27 Aug" / "Thu"), and
  a new **Day / Week / Month period selector** above the chart
  (`trendBuckets(period)` — day: last 14 days, week: last 8 weeks
  averaged, month: last 6 months averaged).
- **Verified:** `node --check` (pass), `getElementById` cross-reference
  (zero mismatches), `<div>` balance (706/706), plus a standalone Node
  check confirming `STICKER_ICONS` (19 keys) and `MOTIVATION_CARDS`
  (9 modules) both parse with the expected content.
- **Deferred, not done in this pass:** moving the motivation card to a
  guaranteed fixed "top of screen" position on every module — currently
  it renders immediately before that module's own empty-state block,
  which is at the top of the *list* but not necessarily the top of the
  *screen* if other cards/summaries sit above that list. Doing this
  properly means auditing each screen's layout individually rather than
  a single shared fix; flagged rather than guessed at.

---

# Changelog — v12.0.3 (version fix, routine 12h, habit fields, motivation cards, categorized Settings, sticky headers, real font picker) → history below

## v12.0.3 — a large fix/feature pass, several real pre-existing bugs found along the way

- **Single version source of truth.** New `const APP_VERSION` — the About
  screen and the Settings row both read from it now instead of two
  separately-typed strings that had drifted (10.0.3 vs 12.0.2). Also
  removed the stale "(backend unchanged from v9.4.1 — no redeploy
  needed)" line from About per direct request.
- **12-hour AM/PM time display** for routine blocks, everywhere the app
  renders a time as text (Today's Routine list, Routine Templates modal).
  New `fmt12()` helper. Honest limitation: the native `<input
  type="time">` picker widget itself is OS/browser-controlled, not
  something CSS/JS can force into 12h format — this fixes every place
  the app *displays* a time, not the native picker's own UI.
- **Habit "Quick-add preset amounts"** converted from a single
  comma-separated text box to the same one-line-input-plus-Add-button
  chip pattern already used for Reminder times right next to it — type
  one amount, tap Add, see it as a chip, tap ✕ to remove.
- **Contextual empty-state motivation cards.** When Habits, Routine, or
  Finance have nothing logged yet, a photo+quote card now shows (same
  hero-photo-card visual language as the Home hero and Habit quote
  card), picked from a small curated set per module and rotating daily
  (same day-index mechanism as the existing daily quote — refreshes
  automatically at midnight). New Settings toggle: General → "Motivational
  empty-state cards" (default on).
- **Categorized Settings**, matching the reference pattern: a top-level
  hub (General / Appearance / Communication / Backup & Restore /
  Modules & Data / About) that drills into the relevant existing
  settings-groups. **Every existing settings-group's markup, ids, and
  listeners are completely unchanged** — this only tags each with
  `data-cat` and shows/hides by category; zero risk to existing
  functionality.
- **Sticky back/close buttons.** Every screen's back button and every
  modal's close button now stay pinned at the top while the content
  underneath scrolls, instead of scrolling away and forcing a
  scroll-back-up just to leave a screen or close a modal.
- **Real, working font picker — found and fixed a genuine pre-existing
  bug.** The old "Heading font"/"Body font" dropdowns wrote to
  `S.settings.fontHead`/`fontBody`, but `applyExperiencePack()` never
  read those values back — it only ever used the current pack's own
  font tokens, so picking a font silently did nothing, every session,
  since v10.0. Replaced with one unified "App font" picker (10 fonts:
  Inter, SF Pro, Manrope, Plus Jakarta Sans, Roboto, DM Sans, IBM Plex
  Sans, Geist, Outfit, Nunito Sans — each row shows a live sample
  sentence in that font) and fixed `applyExperiencePack()` to actually
  read `S.settings.fontHead`/`fontBody` first. **Plus Jakarta Sans is
  now the default**, with a one-time migration forcing it for existing
  installs (same reasoning as the v12.0.2 icon-pack migration — the old
  default was already saved explicitly, so a `defaultSettings()` change
  alone wouldn't have reached anyone who'd already opened the app once).
  **SF Pro is deliberately not a Google Fonts file** — it isn't licensed
  for that — it uses the real system font stack instead
  (`-apple-system, BlinkMacSystemFont, ...`), which renders as actual
  San Francisco on iOS/Mac and falls back gracefully elsewhere.
- **Crash caught and fixed before shipping:** removing the old font
  `<select>` elements would have left a generic settings-binding loop
  calling `.addEventListener` on `null`, throwing at init and halting
  every settings listener registered after it in that loop. Caught by
  the standard id cross-reference check, fixed by removing those two
  entries from the loop.
- **Verified:** `node --check` (pass), `getElementById` cross-reference
  (zero mismatches, including catching the crash above), `<div>` balance
  (702/702).

---

# Changelog — v12.0.2 (native Emoji icon pack, now default) → history below

## v12.0.2 — Emoji icon pack (default), plus two bugs fixed along the way

- **New "Emoji" Icon Pack option — and it's now the default.** Matches
  the pre-v10 app exactly (screenshots: 🏠 Home, ✅ Habits, 💰 Finance,
  ⏱️ Routine, 🥗 Diet, ⋯ More, plus every More-screen module: 🎯 Goals,
  📆 Calendar, 🤖 AI Coach, 📔 Journal, 💊 Health, 🏦 Debts/EMI, 🔁
  Subscriptions, 🏛️ Assets, 📈 Trends, 🧾 Reports, 🗂️ Documents, ⚙️
  Settings). These emoji were never deleted — `MODULE_DEFS` has always
  carried an `.icon` (emoji) field alongside `.iconKey` (geometric key);
  v10.0's Experience Engine just stopped reading it. `EMOJI_MAP` reuses
  that field directly rather than re-typing 24 emoji by hand.
- **New `chromeIcon(key, size)`**, used only at real nav/module chrome
  call sites (bottom nav, More screen, dashboard Quick Actions, universal
  create sheet). Checks the live icon style
  (`S.settings.iconStyleOverride || currentPack().iconStyle`) and renders
  the native emoji when it's `'emoji'` and a mapping exists, otherwise
  falls back to the existing geometric SVG. **`icon()` itself is
  untouched** — still pure-geometric — so the Icon Pack preview grid
  (which must show each style's *true* appearance, not whatever's live
  right now) and the habit icon picker (no emoji equivalents, always
  geometric) aren't affected.
- **One-time migration for existing installs.** `iconStyleOverride`
  already existed (as `''`) from v12.0.1, so simply changing
  `defaultSettings()` wouldn't reach anyone who'd already loaded the app
  once — their saved `''` would keep overriding the new default via the
  existing `Object.assign(defaultSettings(), S.settings)` merge. Added a
  one-time `S.settings._iconMigrationV1202` guard in `loadState()` that
  forces `iconStyleOverride` to `'emoji'` exactly once; any choice made
  after that (including switching back to Auto) sticks normally.
- **Two pre-existing bugs fixed while in this code:**
  1. `loadState()`'s invalid-pack fallback still pointed at `'glass'`,
     removed from the roster in v12.0.0. `packById()`'s own internal
     fallback (`EXPERIENCE_PACKS[0]`) made this harmless in practice, but
     the stored value was wrong/confusing. Now falls back to `'lifeos'`.
  2. (Carried from v12.0.1's changelog, unrelated to this fix — no new
     bug here, just confirming it's still correct after this pass.)
- **Verified:** `node --check` (pass), `getElementById` cross-reference
  (zero mismatches), `<div>` balance (669/669), and a standalone Node
  sanity check confirming `EMOJI_MAP` builds all 24 expected keys with
  the exact emoji from the reference screenshots.

---

# Changelog — v12.0.1 (nav fix, hero-photo quote, standalone Icon Pack) → history below

## v12.0.1 — nav spacing fix, hero-photo Habit quote, standalone Icon Pack

Three direct pieces of feedback on v12.0.0:

- **FAB was crowding Finance/Routine.** The raised center FAB had no
  dedicated space — whichever nav button landed in the middle slot sat
  directly under it. `renderBottomNav()` now inserts a `.nav-fab-spacer`
  (58px) at the middle position whenever the active pack's `navStyle` is
  `'lifeos'`, so the flanking buttons get real breathing room instead of
  overlapping the FAB.
- **Habit screen's "Quote of the day" now uses the photo-hero treatment**
  from the Home screen — same picsum-photo + gradient-overlay + bold-quote
  style, applied via a new `.hero-photo-card` class on the existing
  `.quote-card`. Uses a **stable per-day seed** (`...-habitquote-<today>`)
  so the photo doesn't reshuffle on every render, only once per day.
- **New standalone Icon Pack selector**, decoupled from both the
  Experience Pack and the color Theme Presets — same "fine-tune layer on
  top of the current pack" pattern §5's `THEMES` already established for
  color, applied to icon rendering style instead. Settings → Icon pack
  shows a horizontal strip (Auto/Outline/Filled/Duotone/Rounded/Minimal/
  Hand-drawn) with a live 2-icon preview per option; picking one applies
  instantly and persists across pack/theme changes until set back to
  Auto. New `S.settings.iconStyleOverride` field (default `''` = pack
  default), read by `applyExperiencePack()` in place of `p.iconStyle`
  when set. **No new icon geometry or CSS was needed** — this exposes the
  icon-style-swapping mechanism that already existed in the v10.0
  Experience Engine (§9) as its own control, since it was previously only
  reachable by switching whole packs.
- Clarifying the color-swatches-only confusion: **Theme Presets (the
  panel with Midnight/Ocean/Forest/etc.) are colors only, by original
  design** (BLUEPRINT §5) — they were never meant to carry layout/photo
  elements like the hero card. That structural look lives in the
  Experience Pack (`layout:'lifeos'`), which both current packs already
  use, and now the Habit quote card uses it too (this entry). If more
  photo-hero moments should appear elsewhere in the app, or more
  Experience Packs should be added with their own distinct structure
  (per the earlier "expand after you approve the direction" plan), that's
  a follow-up, not something Theme Presets should be stretched to do.
- **Verified:** `node --check` (pass), `getElementById` ↔ `id="..."`
  cross-reference (zero mismatches), `<div>` balance (669/669).

---

# Changelog — v12.0.0 (Life OS rebuild) → history below

## v12.0.0 — Life OS: new Home screen, new icon pack, universal FAB, 2 flagship Experience Packs

A full visual rebuild on top of the v10.0.0 base, per direct reference
(a "Life OS"-style mockup). **No data model changes beyond one new
optional field (`h.iconKey`) and no feature removed** — every module,
screen, and piece of data works exactly as before; only how you look at
and add things changed.

- **New Home screen.** Replaced the old score-ring + generic tile grid
  with: a **Focus / Health / Productivity / Finance segmented control**
  (`#focusTabs`, `activeFocusTab`) that swaps a domain-specific score,
  quote, and 3-4 stat rows; a **photo + quote hero card**
  (`.hero-focus-card`, picsum-sourced background, per-tab caption); a
  **Daily Progress card** (ring + stat-row list, `.progress-card`); and an
  icon-based **Quick Actions row** (`.quick-actions-row`). All of it reads
  the exact same computed values the old dashboard did (`habitPct`,
  `routineMin`, `spentToday`, `dt`/`calToday`, `wh`/`sh`, `overdueDebts`,
  `goalProgressCalc`) — this is a presentation change, not a new data
  pipeline. Top Priorities list is unchanged data, restyled only.
- **New curated icon pack.** 20 new geometric icons added to the existing
  `ICONS` set (water, run, meditate, sleep, sun, heart, brain, pill,
  wallet, plant, guitar, code, paint, alarm, apple, bike, gratitude, and
  more) — see `HABIT_ICON_KEYS` for the curated subset shown in the
  picker. New `habitIcon(h, size)` helper renders the curated icon when
  `h.iconKey` is set, and **falls back to the old free-text emoji**
  (`h.icon`) for every habit created before this version — nothing about
  existing habits changed or needs migrating.
- **Habit icon picker.** New Habit's old `<input type="text">` emoji
  field is replaced with a tap-to-select grid of the 20 curated icons
  (`.icon-picker-grid`), plus a "use a custom emoji instead" fallback
  for anything not in the curated set. Existing habits are untouched;
  this only changes what *new* habits pick from.
- **One universal FAB.** Removed the 9 screen-scoped `fabAdd*` buttons
  (habit/tx/routine/debt/meal/goal/sub/asset/doc), same consolidation
  pattern as before: one `#fabUniversal` at app-shell level, direct-fires
  the obvious action on a screen that has one, opens a contextual create
  sheet (`openCreateSheet()`, `CREATE_ACTIONS`) everywhere else, filtered
  by `S.settings.modules` exactly like the More screen already was.
- **Experience Packs: 21 → 2 flagship packs.** Per direct request, the
  old pack roster is replaced with **Life OS** (light) and **Life OS
  Midnight** (dark) — same structure, different palette, matching the
  reference image exactly. Both use two new component variants:
  `navStyle:'lifeos'` (floating rounded nav bar) and `fabStyle:'lifeos'`
  (a raised gradient circle centered and overlapping the nav bar, border
  color-matched to `--bg` so it reads as "cut into" the bar). New CSS
  only for these two variant classes — the rest of the Experience Engine
  (icon styles, card styles, token flow) is unchanged infrastructure.
  **The old 21-pack CSS is left in place, unreferenced but harmless** —
  nothing was deleted, so re-adding any of the old 21 later (per the
  "expand after you approve the direction" plan) is a data-only change,
  not a CSS rewrite.
- **"Many personalities" pack picker.** `drawExperienceGrid()` rewritten
  from a 2-column card grid to a horizontal scroll strip of rounded
  gradient-thumbnail chips, matching the reference. Also fixes a
  pre-existing bug found while touching this function: the old click
  handler called `toast(...)`, a function that doesn't exist anywhere in
  the file (the real function is `showToast`) — silently failing every
  time a pack was applied from this screen. Now calls `showToast`
  correctly.
- **Verified before shipping:** `node --check` on the extracted script
  (pass), full `getElementById` ↔ `id="..."` cross-reference (zero
  mismatches), `<div>` tag balance (659/659), and both new
  `EXPERIENCE_PACKS` entries checked against every required field
  (`accent`/`bg`/`card`/`font*`/`radius*`/`iconStyle`/`cardStyle`/
  `navStyle`/`fabStyle`/`layout`/`animSpeed`/`wallSeed`) — no typos that
  would silently fall back to unstyled defaults.
- **Not in this pass, explicitly deferred:** the v11.0.0-style tabbed
  Workspace pattern (Overview/Edit/History/Notes/AI/Analytics) is not
  included here — this session started from the v10.0.0 base per the
  files re-uploaded, and the visual rebuild was the stated priority.
  Command palette (⌘K) also not included this round — search still opens
  the existing full-screen search. Both are natural next additions on
  top of this new Home screen if wanted later.

---

# Changelog — v10.0.0 (Experience Engine) → v9.5.0 and earlier history below

## v10.0.0 — Experience Engine (20 Experience Packs)

Phase 1 of the "make GP Ledger feel like a different app per pack"
rebuild. See `BLUEPRINT.md` §9 for the full architecture. Summary:

- **20 Experience Packs** (Settings → Experience Pack, new section above
  Theme presets): Minimal, Fitness, Wellness, Habit Builder, Productivity,
  Finance, Luxury, Glassmorphism, AI Future, Nature, Material Design,
  Apple Style, Samsung Style, Cyberpunk, Gaming, Neumorphism, Kids, Elder
  Friendly, Professional Business, Magazine Style. Each is a full token
  set — colors, fonts, corner radius, icon style, card style, nav style,
  FAB shape, dashboard layout family, animation speed, background photo
  seed — applied live with `applyExperiencePack()`, no reload.
- **Theme presets narrowed to color-only.** Per the original ask ("Theme
  only controls light/dark/system, nothing else"), `applyTheme()` no
  longer touches font/radius — it's now a fine-tune layer that sits
  underneath whichever Experience Pack is active, instead of overwriting
  it. The existing 12 named palettes (Midnight, Ocean, Forest, etc.) still
  work exactly as before, just scoped to colors.
- **New shared icon system.** One SVG geometry set (`ICONS`, 24 app-chrome
  icons: nav, module tiles, dashboard tiles) rendered in 6 different
  visual styles — outline, filled, duotone, rounded, minimal, hand-drawn —
  purely via CSS class toggling on `<body>`, so no per-pack icon assets
  were needed. Includes a redesigned "person sleeping in bed" sleep icon
  (previously a crescent moon) per the reference screenshots. **Habit
  emoji icons are untouched** — those stay as free-text/emoji, since
  they're your data, not app chrome.
- **6 dashboard layout families** (rings / magazine / minimal / dense /
  glass / gamified), each pack assigned one. Restructures the dashboard
  hero and `#dashGrid` (grid columns, tile shape, hero size, imagery use)
  via CSS grid/shape rules — same `renderDashboard()` JS and element ids
  throughout, per the "no duplicate editor" rule.
- **6 card styles** (flat/glass/neumorphic/outline/soft/elevated), **4 nav
  bar styles** (floating/dock/pill/glass), **3 FAB shapes**
  (circle/squircle/pill) — all CSS-variant-driven off the same markup.
- **Chart color tinting.** The three Chart.js instances (habit trend,
  income/expense, net worth) now pull their primary color from the active
  pack's accent instead of a hardcoded hex; chart *type* per pack is not
  yet implemented (see Blueprint §9 deferred list).
- **New Google Fonts loaded:** Playfair Display, Space Grotesk, Quicksand,
  Outfit, Syne, DM Serif Display, Bricolage Grotesque, Plus Jakarta Sans —
  on top of the existing set, so every pack's `fontHead`/`fontBody` has a
  real family behind it.
- Deferred to a follow-up session (flagged in Blueprint §9, not silently
  dropped): guided multi-step habit-creation wizard, curated per-pack
  wallpaper imagery (currently reused picsum seeds), modular/reorderable
  dashboard widgets, quote-card visual redesign, full chart-type-per-pack.
- **`sw.js` `CACHE_NAME` bumped** to `gp-ledger-v10-0-0` — required, or
  installed phones keep serving the pre-Experience-Engine cached copy.
- Verified before shipping: full JS syntax check, `getElementById`/`id=`
  cross-reference (0 mismatches), structural validation of all 20 pack
  objects (required fields + valid variant-enum values), and a headless
  Playwright pass rendering the dashboard + Settings pack picker across 6
  packs with zero console errors (aside from expected sandbox network
  blocks for fonts/images, irrelevant on a real deploy).

## v9.5.0 — customizable/shareable edition

- **Modules on/off (Settings → Modules).** All 15 sections (Habits, Finance,
  Routine, Diet, Goals, Calendar, AI Coach, Journal, Health, Debts/EMI,
  Subscriptions, Assets, Trends, Reports, Documents) can now be switched off
  individually. Turned-off modules disappear from the bottom bar, the Home
  bar, and the More screen. This is what makes it practical to hand a copy
  of the app to someone who only wants habits + diet, for example, without
  them seeing your finance/EMI/journal data structures at all.
- **Smart bottom bar.** The 4 non-Home slots on the bottom bar now fill
  dynamically from whatever's switched on — habits/finance/routine/diet
  first if enabled, then other enabled modules fill any remaining slots.
  So if you only keep Habits and Diet on and then enable Debts/EMI, EMI is
  promoted straight onto the bottom bar instead of hiding inside More.
  A "More" button only appears if something didn't fit.
- **Theme presets (15, one tap, fully live).** Settings → Theme presets —
  Midnight, Ocean, Forest, Plum, Sunset, Rose, Slate, Amber, Crimson, Mono,
  Paper, Skylight, Blossom, Mint, Graphite, Neon. Tapping one repaints
  every color, card surface and corner radius instantly, no reload — this
  is on top of (not instead of) the existing custom accent-color/font
  controls.
- **Random background photos (Settings → Background).** Optional, off by
  default. A subtle photo layer behind the app, toggle on/off, "Shuffle now"
  button, optional auto-rotate on a timer (15 min / hourly / daily), and a
  strength slider so it stays a background, not a distraction. Falls back
  to no image automatically when offline.
- **Daily quote now refreshes at midnight even if the app is left open** —
  previously it only updated on next app launch/refresh; now a background
  check flips it (and the date strip / dashboard) the moment the calendar
  date changes, without needing to close and reopen the app.
- **Mobile custom-amount input visibility — root cause fixed.** On phones,
  typing into a habit's custom-amount field (e.g. changing a Water default
  from 300 ml to 100) was invisible while typing because the on-screen
  keyboard covered the field — the value was always saving correctly, you
  just couldn't see it happen. The app now scrolls the focused field above
  the keyboard automatically; this didn't reproduce on desktop because
  there's no on-screen keyboard to cover it.
- **Meal photo re-evaluation.** If Gemini identifies a meal wrong (e.g.
  calls rice what's actually chapati), a new "Not quite right? Tell it
  what this actually is" field appears after the first estimate — type a
  correction and tap "Re-evaluate with this correction" to get fresh
  nutrition numbers based on the corrected food, from the same photo.
- **Routine per-segment logging clarified**, not new: the existing "+" on
  the Routine tab already lets you add one custom time segment (e.g.
  5–6am) to just today without touching your weekday/weekend template —
  a hint now explains this directly on the Routine screen since it wasn't
  obvious that templates and one-off segments are separate things.
- Backend (`apps-script.gs`) is **unchanged** in this release — no redeploy
  needed, only replace the app files (index.html, sw.js).


## v9.4.1 patch — the actual fix for "Sync did not verify" after logging a meal photo

- **Root cause found and fixed.** Meal photos are kept as full base64 images
  in `S.diet.meals[date][].image` for the in-app preview and the one-time AI
  estimate. That field was being included in the sync payload sent to your
  Apps Script — and the full snapshot gets written into a **single Google
  Sheets cell**, which has a hard **50,000-character limit**. Even one meal
  photo pushed that snapshot well past the limit, so the write inside
  `handleSync` threw an error and the whole sync failed — showing up as
  "Sync did not verify," with no obvious connection to the meal you'd just
  logged. This had nothing to do with deployment staleness even though the
  symptom looked identical.
- **Fix**: the app now strips the photo out before syncing — only the
  nutrition numbers (already extracted from the photo by Gemini) are sent
  to the Sheet, never the image itself. Photos still show in the app's
  Diet tab and history (kept on-device), they just aren't backed up to the
  Sheet — there was never a Photos tab there to begin with.
- **Backend hardened too**: the Apps Script side now wraps the full-snapshot
  write in a try/catch. If a payload is ever too large for one cell for any
  other reason in the future, it now degrades gracefully (skips just that
  snapshot with an explanatory note, keeps every other tab working) instead
  of throwing and taking the entire sync down with it.
- Requires the same redeploy as any other `apps-script.gs` change —
  **Deploy → Manage deployments → ✏️ → New version → Deploy**.

## v9.4 patch — routine templates, EMI import, sync version-check

- **Routine → Templates (new).** The Routine tab now has a "Templates"
  button next to Categories: two fully-editable day plans — a **Weekday
  plan (Mon–Fri)** and a **Weekend plan (Sat & Sun)** — each a list of
  time blocks (category, start/end time, note) you add/edit/delete freely.
  A row of day chips lets you flip which plan applies to which day of the
  week (e.g. if your off days move from Sat/Sun to something else). Two
  action buttons apply a plan to actual logged data: **"Apply today's
  plan"** (also on the Routine tab itself, next to Quick-log sleep) fills
  in today from whichever plan matches today's weekday, and **"Fill this
  week"** does the next 7 days at once, skipping any day that already has
  logged blocks so it never overwrites real entries. The two plans ship
  pre-filled from the BPO shift / additional job / travel / home routine /
  sleep schedule you sent (weekday) and a 9-hour additional-work + BBA
  class + sleep/rest layout (weekend) — edit every time and category on
  both to match your actual schedule, and re-edit any time it changes
  (new job, new class times, etc.) since nothing about the timing is
  hard-coded into the app. Six new routine categories were added to
  support this (BPO Shift, Additional Job, Travel, Home Routine, Get
  Ready, BBA Class) — merged into your existing category list without
  touching any categories you'd already added or renamed. Templates sync
  to the Google Sheet in a new `RoutineTemplates` tab.

- **Debts/EMI pre-loaded from your sheet.** Your 10 loans/EMIs (Ather,
  Axis Finance, Axis Bank, Education Loan, Kredit Bee, Local Finance,
  Gold Loan, Credit Card, Rent, Chit) are now seeded into Debts/EMI with
  their balance, monthly EMI and due day from the sheet you sent — same
  as everything else in that tab, fully editable and deletable per entry.
  This only seeds once, the first time Debts/EMI is empty on a device —
  it will never overwrite loans you've already added or edited.

- **Sync failures now self-diagnose a stale deployment.** The single most
  common cause of "Sync did not verify" is pasting updated
  `apps-script.gs` code into the script editor without republishing it
  (Apps Script's "Save" does not update the live `/exec` URL — that needs
  **Deploy → Manage deployments → ✏️ → New version → Deploy**). The
  backend now reports its own version (`SCRIPT_VERSION`) on both ping and
  sync; the app compares that to the version it expects and, on a
  mismatch, tells you exactly that in the debug log and the failure
  alert — e.g. *"your deployed script reports v9.3 but the app expects
  v9.4 — redeploy"* — instead of a generic failure message.

## v9.3 patch — dashboard score, photo nutrition, Diet on the front page

- **Dashboard score no longer starts at ~50% for no reason.** The daily
  score ring used to blend in guessed "not logged yet" values (45%, 55%)
  for the Routine and Diet factors even on a brand-new day with nothing
  logged, which made the ring show roughly half-full before you'd done
  anything. Every factor now only counts once that module actually has
  something to measure (habits exist, you've ever logged routine time, you
  have diet targets set, you have a loan on file), and an unmet factor
  contributes 0, not a guessed middle value — so a day with nothing logged
  now correctly shows 0%, and the ring only rises as you actually log
  things.
- **Photo → nutrition estimate made far more reliable.** The Gemini request
  now forces plain-JSON output (`responseMimeType: 'application/json'`),
  which was the main cause of "could not analyze photo" failures — the
  model would occasionally wrap its answer in a sentence or markdown fence,
  which broke the JSON parser even though the photo itself was fine. Error
  handling is also more specific now (no key set, no photo chosen, network
  failure, an unreadable/blocked response, and a malformed reply are all
  reported separately) so the hint under the button actually tells you what
  went wrong instead of a generic failure every time.
- **Diet & Nutrition moved to the front page.** It now has its own icon in
  the bottom navigation bar, right next to Routine, instead of being buried
  a tap deeper inside More. The duplicate entry has been removed from the
  More menu's Track section.

## v9.2 patch — logo now embedded, simplified branding

- **Logo embedded directly in the app.** The v9.1 fix still loaded the logo
  from the sibling `icon-192.png` file, which fails if `index.html` is ever
  opened/previewed on its own without the other files next to it (exactly
  what happened in testing — the "GP" text fallback was firing because the
  image file wasn't reachable, not because anything was broken). The logo
  is now embedded directly inside `index.html` as a data URI (`LOGO_DATA_URI`
  near the top of the script) and used for the header badge, onboarding
  screen, and About screen — it now displays correctly no matter how the
  file is opened, with zero dependency on the other files being present.
  The four separate icon PNG files are still shipped and still needed for
  the actual home-screen app icon (`manifest.json`/`apple-touch-icon.png`),
  which browsers require as real files — only the three in-app UI spots
  now use the embedded copy.
- **Simplified brand lockup.** The About screen's header no longer shows a
  separate "GP" text label next to the logo — since the logo mark already
  is the GP identity, showing "GP" again in text was redundant. It now just
  shows the logo image and "LEDGER" underneath.
- **Simplified About copy.** Removed the "GP is the brand, Ledger is the
  product" explainer paragraph — About now just describes what Ledger does,
  and credits "Founder — GP" at the bottom instead of a longer explanation.
- **Simplified onboarding copy.** "Welcome to GP Ledger" → "Welcome to
  Ledger"; dropped "from the makers of GP" from the subtext.

## v9.1 patch — branding, logo placement, and quotes

- **Real logo everywhere.** The header badge (next to "Hey [name]"), the
  onboarding welcome screen, and the About screen now all show your actual
  GP logo image instead of a generic letter avatar. If the image file is
  ever missing on your host, each spot now falls back gracefully to a
  colored "GP" badge instead of a broken-image icon — but the real fix is
  making sure `icon-192.png` (and the other three icon files) are actually
  uploaded to your host alongside `index.html` with the exact same
  filenames; that's almost always why a logo "won't load."
- **GP is the brand, Ledger is the product.** The onboarding screen and
  About screen now say this explicitly and show a "GP · LEDGER" lockup
  (brand mark + product wordmark, divider between them) instead of a single
  blended "GP Ledger" wordmark — so if more products join GP later, this
  app's identity as one product under that brand is already established.
- **Settings → App Icon** is now clearly labeled as an *alternate*
  downloadable icon generator (letter + two colors) rather than something
  that changes the header — the header/onboarding/About always show the
  brand logo now.
- **Daily quotes rewritten.** The quote bank grew from 15 (mostly
  habit-tracker one-liners) to 68 entries, the large majority of which are
  real, well-known, accurately-attributed quotes spanning many themes —
  courage, simplicity, patience, kindness, wisdom, creativity, failure,
  friendship, gratitude — not just fitness/habit framing. The Telegram
  daily-quote script (`apps-script.gs`) uses the exact same 68-quote list
  in the exact same order as the app, so the quote texted at midnight
  always matches the one shown in-app that day (this pairing is load-bearing
  — if you ever edit one list, copy the same edit to the other or the two
  will drift apart).

## v9.0 — v8 → v9

## Added

- **Dashboard (new home screen).** A daily score ring (habits, routine,
  meals logged, and overdue EMIs feed into it), a tile grid (habits done,
  routine hours, spend today, calories, water, sleep, pending EMI, goals
  on track — each tile only shows if that module has relevant data), a
  Top Priorities list (unlogged habits, overdue EMI, subscriptions due
  soon, missing journal entry, goals behind pace), one-tap quick actions,
  and an insight line that shows your latest AI Coach insight once
  generated. This is now the first screen on open.

- **Goals module** (bottom nav → More → Goals). Five goal types: pay off
  a specific debt (pulls its balance automatically), save an amount,
  reach a target weight (pulls from Health vitals), a habit-streak target
  (days hit out of the last N), or a fully manual/custom goal. Optional
  deadline flags a goal "behind pace" if actual progress trails expected
  progress for the time elapsed.

- **Calendar** (More → Calendar). Month grid with a colored dot per day
  for each module that has an entry (habit ✅, finance 💰, journal 📔,
  diet 🍎). Tap any day for a full read-out of everything logged that
  date across habits, routine, finance, diet and journal.

- **Global Search** (magnifying-glass icon in the header, available on
  every screen). One search box across habits, transactions, journal
  entries, meals, debts, goals, subscriptions, medicines, appointments
  and documents — tapping a result jumps straight to it.

- **Budgets** (inside Finance). Set a monthly ₹ cap per category; a
  progress bar per budget shows spend vs. limit and turns red when over.

- **Subscription tracker** (More → Subscriptions). Recurring bills —
  monthly or yearly — with a renewal countdown, a due-soon flag (≤5
  days), and monthly/yearly total. Feeds the Dashboard's priority list
  when something renews soon.

- **Assets & Net Worth** (More → Assets & Net Worth). Track bank
  accounts, cash, investments, gold and property; net worth is computed
  automatically as total assets minus your Debts/EMI balances.

- **Health** (More → Health). Daily BP/sugar/weight logging, a medicine
  list (name, dose, times), and an appointments list. Weight entries here
  feed weight-type Goals automatically.

- **Documents Vault** (More → Documents). Reference-only records for
  insurance, vehicle, loan and ID info — title, category, reference
  number, expiry/renewal date, notes. Explicitly not a place for scanned
  copies or passwords.

- **AI Coach** (More → AI Coach). Builds a real digest of your last 30
  days — habit completion, spend trend vs. the prior 30 days, top
  categories, budget status, debt payoff pace, average sleep, goal
  progress, journaling frequency — and sends it to Gemini for 4–6
  specific, data-grounded insights (not generic advice). Uses the same
  Gemini key as photo nutrition (Settings → Diet & body stats).

- **Debts/EMI overhaul:**
  - **Undo a payment.** Marked a month paid by mistake? "↩ Undo payment"
    restores the loan balance and deletes the matching Finance
    transaction it created.
  - **Unpaid-first sorting.** Unpaid loans sort to the top in
    chronological due-date order; paid loans sink to the bottom of the
    list, dimmed.
  - **Month-labeled paid badge** — shows e.g. "Aug - Paid" instead of a
    generic "Paid" label.
  - **New Debts dashboard**: total balance owed, total EMI this month,
    paid this month, and remaining this month — four stat tiles instead
    of two.
  - **Debited-from account.** Each loan can carry a default account
    (picked from your Assets bank/cash entries, or typed manually); the
    "Mark this month paid" flow asks which account and remembers it for
    next time.

- **Reports, expanded to every module.** Reports previously only covered
  Habits and Finance. It now has report categories (with their own
  summary + Excel/PDF export) for Debts/EMI, Journal, Diet, Routine,
  Goals, Subscriptions, Net Worth and Health, alongside the existing
  per-habit and Finance reports. The Debts PDF export color-codes rows
  green (paid) / red (unpaid) and includes the debited-from account.

- **Persistent back navigation.** Every screen reached through the More
  menu — including Journal and Search, which were missing it — now has a
  "‹ More" (or "‹ Home" for Search) button at the top at all times.

- **New app icon.** Replaced with your uploaded GP mark across
  `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` and
  `apple-touch-icon.png`.

- **About screen redesign.** Now shows the app logo, the "Your Life. One
  System." tagline, a colorful gradient header, a feature-chip summary of
  every module, and rewritten, less dry copy.

## Changed

- **Bottom navigation restructured** to Home / Habits / Finance / Routine
  / More (was Habits/Finance/Routine/Journal/More). Journal moved into
  the More menu, replaced on the bottom bar by the new Dashboard/Home.
  The More menu itself is now organized into Plan / Track / Money /
  Review / System sections to make room for the six new modules.

- **Meal photo nutrition estimate — rewritten prompt.** The Gemini
  prompt now asks the model to identify each food item separately,
  reason about portion size against visible reference objects (plate
  diameter, cutlery, hand size) instead of guessing blindly, flag
  likely hidden calories (oil, sauce, sugar) it can't see, and return a
  confidence level (low/medium/high) plus a one-line explanation of its
  assumptions — shown directly under the meal in the Diet tab. This is a
  meaningfully better estimate than v8's bare guess, but it is still an
  AI estimate from a photo, not a lab measurement; always sanity-check
  before saving, especially for oil/butter/sauce-heavy dishes.

## Known limitations (carried forward / new)
1. Google Sheet remains the sync/backup mechanism — Load from Sheet is a
   manual pull, not automatic real-time multi-device sync.
2. Debt ↔ Finance sync is one-directional: paying from the Debts tab
   creates a Finance transaction; editing that transaction afterwards
   does not adjust the loan balance back (undo is only via the new "↩
   Undo payment" button on the Debts screen itself).
3. Photo-based nutrition estimates need your own free Gemini API key and
   are estimates, not lab-accurate figures, even with the improved
   prompt — always sanity-check before saving. As of v9.4.1, meal photos
   themselves are kept on-device only and are not backed up to the Google
   Sheet (only the nutrition numbers are) — reinstalling the app or
   loading from a fresh device will keep your meal history but not the
   original photos.
4. Apps Script still requires a "New version" deployment after any code
   change — v9.4 now detects and tells you when this has been missed (see
   SETUP_GUIDE troubleshooting), but it still has to be done manually.
5. Quick-log timer remains single-slot (unchanged from v7).
6. AI Coach and photo nutrition both require the same Gemini key and a
   live internet connection at the moment you tap them; nothing is
   cached beyond the day's insights/estimate.
7. Documents Vault is reference-only by design — it does not store file
   attachments, scans or passwords.
8. Applying a Routine template to a day that already has logged blocks
   replaces that day's blocks (after a confirmation) rather than merging
   with them — "Fill this week" avoids this by skipping any day that
   already has something logged.
