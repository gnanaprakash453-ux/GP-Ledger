# GP Ledger — Blueprint (v8)

Keep this file. Hand it back to me (or any AI/developer) in a future
conversation, along with the current app files if you've made manual edits
outside our chats, and it fully describes what exists — nothing needs to be
re-explained. See `CHANGELOG.md` for the exact diff from v7.

---

## 1. What this app is
A single-file installable PWA combining a **habit tracker** (with
customizable quick-add amounts, per-habit reminder times, and optional
auto-sync from a linked Routine category), a **personal finance ledger**
with a linked **Debts/EMI tracker**, a **daily routine/time tracker**
(start/stop quick-log timer), a **Journal/diary** (one entry per calendar
date, font/color customization, print/PDF/Word export, always-chronological
full-diary export), a **Diet & Nutrition tracker** (BMR/TDEE-based targets,
manual or photo-estimated meal logging), a **Reports** tab (category
filters, Excel/PDF export), full theme/font/icon customization, **Telegram
alarms** that actually fire, and **Google Sheets** as a verified,
year-spanning database that can now also be **pulled back down** onto a
device. Built by **Gnanaprakash Xavier**. No accounts, no ads — everything
lives on the user's own device, own Sheet, own Telegram bot, and (for photo
meal estimates) the user's own Gemini API key.

## 2. File structure
```
ledger-pwa/
├── index.html              ← the entire app: HTML + CSS + JS
├── manifest.json
├── sw.js                     ← cache name bumped to v8
├── icon-192.png / icon-512.png / icon-512-maskable.png / apple-touch-icon.png
├── apps-script.gs             ← Google Sheet backend, action=load endpoint,
│                                 Debts/Journal/Diet sheet writers, Telegram triggers
├── SETUP_GUIDE.md              ← hosting, Sheet, Telegram, Routine-Habit link,
│                                 Debts, Journal, Diet, troubleshooting
└── CHANGELOG.md                ← exact diff from v7
```

## 3. Data model (`localStorage`, mirrored to the Sheet on sync)

**`habits`** — `id, name, icon, kind('check'|'quantity'), target, unit, step,
quickAmounts[], times[], done{date:true}, logs{date:[{amount,time,fromRoutine?}]},
lastNotified{}, milestones{date:[...]}, color, linkedRoutineCat` (NEW v8 —
name of a Routine category; logging time in that category auto-appends to
this habit's `logs`/`done` — see §4 Habits).
Default habits unchanged from v7; Sleep ships pre-linked to the "Sleep"
Routine category.

**`transactions`** — unchanged: `{id, amount, type, note, category, date, created, debtId?}`
(`debtId`, NEW v8, is set on transactions created by paying a debt's EMI).

**`routineLogs`** — `{date: [{id, start, end, cat, note}]}`, unchanged shape.

**`runningTimer`** — `{cat, startISO} | null`, unchanged from v7.

**`routineCats`** — unchanged: user-editable category/color list.

**`debts`** (NEW v8) — `[{id, name, balance, emiAmount, dueDay, principal,
paidMonths:{'YYYY-MM':true}, notes}]`.

**`journal`** (NEW v8) — `{ 'YYYY-MM-DD': { text, font, color, updated } }`
— one entry per calendar date, keyed by ISO date so sorting `Object.keys()`
is always chronological regardless of entry order.

**`diet`** (NEW v8) — `{ meals: { 'YYYY-MM-DD': [{id, name, time, calories,
protein, carbs, fat, fiber, image?}] }, settings: { height, weight, age,
sex, activity, goal, geminiKey } }`.

**`settings`** — unchanged fields from v7 (name, accent/customAccent, fonts,
toastDur, motivation*, icon*, tg*, quoteToTg, sheetUrl/sheetId/autoSync/
lastSync, autoCollapseHabits, showUndo). Diet body-stats live in
`diet.settings`, not here.

## 4. Feature list (v8 — changes over v7 marked NEW)

### Habits
- **NEW: Routine ↔ Habit auto-sync.** A habit can carry a
  `linkedRoutineCat`. Logging a time block, using the Quick-log timer, or
  Quick-log Sleep for that category calls `syncRoutineToLinkedHabit()`,
  which appends the equivalent minutes (converted to hours if the habit's
  unit is `hr`) to that habit's log for the date, or marks it done for
  check-kind habits — solving "I logged it in Routine, why do I have to log
  it again in Habits."
- **NEW: Complete queue.** `renderHabits()` now splits into an incomplete
  list (top) and a Completed ✅ list (bottom, dimmed, with a divider showing
  the count) based on `habitProgress(h, selectedDate) >= 1`.
- **FIXED: custom-amount input visibility.** Global CSS now forces
  `color: var(--text)` on all inputs and overrides `-webkit-autofill`
  styling, so the "Custom amount" field shows what's typed as it's typed.
- Everything else (weekly grid detail view, per-habit color, streaks,
  reminder times, quick-add presets, accordion behaviour) unchanged from v7.

### Finance / Debts (NEW v8 tab, interlinked)
- Finance itself unchanged (editable/deletable transactions, 30-day donut,
  trend charts).
- **NEW Debts/EMI tab** (`screen-debts`, reached via More): list of loans
  with balance/EMI/due-day, an overdue badge computed from `debtIsOverdue()`
  (past due day, current month not in `paidMonths`), and **"Mark this month
  paid"** (`payDebtEmi()`) which in one action: sets `paidMonths[currentYM]`,
  reduces `balance` by `emiAmount`, and pushes a Finance transaction tagged
  `debtId` — this is the "update it there, it shows in Finance" link the
  user asked for. Sync is one-directional (Debts → Finance); editing the
  resulting transaction afterwards does not adjust the loan balance.

### Journal (NEW v8 tab)
- `screen-journal`, its own bottom-nav button. One entry per ISO date key
  in `S.journal`. Date bar with ‹/›/date-input/Today lets the user write
  today's thoughts, then **change the date before Save** to file it under
  a missed prior day — the entry is only ever written to whatever date is
  selected at the moment **Save entry** is tapped, which is what makes
  backdating work without extra modes.
  Font (`journalFont`) and color (`journalColor`) are per-entry. Print,
  PDF (`journalPdfBtn`, single entry via jsPDF), Word (`journalWordBtn`,
  `.doc`-mimetype HTML blob), and **Export whole diary** (all entries,
  `Object.keys(S.journal).sort()` → always chronological, one PDF page per
  date) are all implemented client-side. Syncs to a `Journal` sheet tab,
  written in date order.

### Diet & Nutrition (NEW v8 tab)
- `screen-diet`, reached via More. `dietTargets()` computes Mifflin-St
  Jeor BMR from height/weight/age/sex, multiplies by an activity factor,
  then adjusts ×0.8 (fat loss) / ×1.15 (muscle gain) / ×1 (maintain) for
  a calorie target; protein target is 1.8–2.0 g/kg; fat ~25% of calories;
  carbs fill the remainder; fiber fixed at 30g. Returns `null` (and the UI
  shows a prompt) until height/weight/age are set in Settings.
- Meals logged manually or via photo. If a Gemini API key is saved
  (`diet.settings.geminiKey`), an **"✨ Estimate nutrition from photo"**
  button calls `generativelanguage.googleapis.com`'s `gemini-2.0-flash`
  model directly from the client with the image as inline base64 data,
  asking for strict JSON back, and pre-fills the form (user can edit before
  saving). No key → the button is hidden, manual entry only.
  Day/Week/Month totals rendered as progress bars against targets
  (`dietPeriod` toggle). Export to Excel (SheetJS) or PDF (jsPDF). Syncs to
  a `Diet` sheet tab, one row per meal.

### Reminders & notifications (Telegram), Motivation toasts, Daily quote,
### Theme/font/icon, Reports, Trends, Installability
- Unchanged from v7.

### Database (Google Sheets)
- **NEW: `action=load`** in `doGet()` (`handleLoad()`) returns the last
  full JSON snapshot from the `Data` tab — backs the app's **"Load from
  Sheet"** button (Settings), which replaces local state wholesale after a
  confirm dialog.
- **NEW sheet tabs written by `handleSync()`:** `Debts`, `Journal`
  (chronological), `Diet` (one row per meal) — alongside the unchanged
  `Data`/`Habits`/`Settings`/`Transactions_<year>`/`Routine`/`Reports`/
  `ReminderLog`.

### Navigation (NEW v8 structure)
- Bottom nav is now **Habits, Finance, Routine, Journal, More** (was
  Habits/Finance/Trends/Reports/Routine/Settings in v7). **More**
  (`screen-more`) is a menu of cards for Diet, Debts/EMI, Trends, Reports,
  and Settings — each a `.screen` reached via `goToScreen()`, with a
  "‹ More" back link at the top. This keeps the nav bar from overflowing
  as features are added, and is the intended place for any future tab.

## 5. Known limitations
1. Google Sheet remains a mirror/backup; Load from Sheet is a manual pull,
   not automatic real-time multi-device sync.
2. Debt ↔ Finance interlink is one-directional (Debts → Finance only).
3. Photo-based diet estimates require the user's own Gemini API key and
   are estimates, not verified lab nutrition data.
4. Apps Script requires a "New version" deployment after any code change.
5. Quick-log timer remains single-slot (no simultaneous timers).
6. PDF exports (Journal, Diet, Reports) remain simple generated reports,
   not pixel-perfect brochures.

## 6. Recommended next upgrades (not yet built — ranked by effort)

**Low effort:**
- Light/dark theme toggle
- Budget cap per Finance category with a warning when exceeded
- Two-way Debt ↔ Finance sync (editing the EMI transaction adjusts balance)

**Medium effort:**
- Snooze/repeat-if-missed logic for habit reminders
- A PIN or biometric lock screen for privacy
- Rich-text (bold/italic/lists) journal editor instead of plain textarea
- Weekly/monthly diet trend charts (reuse Chart.js already loaded)
- Multiple simultaneous quick-log timers

**Larger effort:**
- True real-time multi-device sync would need a proper backend + accounts
- Native app store presence via Capacitor
- Barcode/packaged-food nutrition lookup for Diet (vs. photo-only)

## 7. How to hand this back to me later
Paste or upload this blueprint (v8) at the start of a new conversation, plus
the current app files if you've edited them outside our chats. I'll know
exactly what exists — including the Routine↔Habit link, the More menu
structure, Debts/Journal/Diet, and Load from Sheet — and can pick up
precisely instead of guessing or rebuilding from scratch.
