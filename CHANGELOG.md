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
