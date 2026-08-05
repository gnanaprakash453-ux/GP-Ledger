# GP Ledger — Blueprint (v9)

> **v9.2 patch note:** the brand logo is now embedded directly inside
> `index.html` as a base64 data URI (`const LOGO_DATA_URI = ...` near the
> top of the script), used by the header badge, onboarding screen, and
> About screen — none of them depend on `icon-192.png` loading as a
> sibling file anymore, so the logo always renders even if `index.html` is
> opened in isolation. The four separate icon PNG files are still required
> (and still shipped) for the actual installable home-screen icon via
> `manifest.json`/`apple-touch-icon.png` — that part of the platform
> genuinely does need real files, only the in-app UI copies were switched
> to the embedded version. The About screen's brand lockup was also
> simplified: no separate "GP" text label next to the logo (redundant with
> the logo itself), no "GP is the brand / Ledger is the product" explainer
> paragraph — just the logo, "LEDGER", the tagline, and "Founder — GP" at
> the bottom. Onboarding copy was similarly trimmed ("Welcome to Ledger",
> no "from the makers of GP" line). See `CHANGELOG.md`'s "v9.2 patch"
> section.
>
> **v9.1 patch note:** since this blueprint was written, the header badge,
> onboarding screen, and About screen were switched from a generic letter
> avatar to the real GP logo image (`icon-192.png`), with a graceful
> text-fallback if the image file is ever missing. Onboarding/About copy
> now explicitly frames **GP as the brand** and **Ledger as the product**
> (a "GP · LEDGER" lockup, not a single blended wordmark). The daily quote
> bank grew from 15 to 68 entries — mostly real, diverse, attributed quotes
> instead of habit-tracker one-liners — and `index.html`'s `QUOTES` array
> must stay byte-for-byte identical (same order, same count) to
> `apps-script.gs`'s `QUOTES` array, since both are indexed by the same
> day-number so the Telegram quote matches the in-app quote. See
> `CHANGELOG.md`'s "v9.1 patch" section for the full list.

Keep this file. Hand it back to me (or any AI/developer) in a future
conversation, along with the current app files if you've made manual edits
outside our chats, and it fully describes what exists — nothing needs to be
re-explained. See `CHANGELOG.md` for the exact diff from v8.

---

## 1. What this app is
A single-file installable PWA that is now a full life-management system, not
just a set of trackers. Core pillars: **Dashboard** (daily score, priorities,
quick actions), **Goals** (debt-free / savings / weight / habit-streak /
custom, auto-fed from the relevant module), **Habits**, **Routine & Sleep**,
**Finance** with **Budgets**, **Debts/EMI** (undo-able payments, debited-from
account, month-labeled status), **Diet & Nutrition** (photo estimate with
portion reasoning + confidence), **Journal**, **Calendar** (one screen, every
day, tap for full detail), **Global Search** (across every module),
**Subscriptions**, **Assets & Net Worth**, **Health** (vitals, medicines,
appointments), **Documents Vault** (reference info only), **Reports** (every
module, Excel/PDF export, color-coded where relevant), **AI Coach**
(Gemini-powered insights grounded in your real data), full theme/font/icon
customization, **Telegram alarms**, and **Google Sheets** as a verified,
year-spanning database with pull-back-down restore. Built by
**Gnanaprakash Xavier**. No accounts, no ads — everything lives on the
user's own device, own Sheet, own Telegram bot, and (for photo meal
estimates + AI Coach) the user's own Gemini API key.

## 2. File structure
```
ledger-pwa/
├── index.html              ← the entire app: HTML + CSS + JS (~3650 lines)
├── manifest.json
├── sw.js                     ← cache name bumped to v9
├── icon-192.png / icon-512.png / icon-512-maskable.png / apple-touch-icon.png
│                              ← regenerated from the user's supplied GP logo
├── apps-script.gs             ← Google Sheet backend: adds Goals,
│                                 Subscriptions, Assets, Health, Documents,
│                                 Budgets tabs; Debts tab now has account +
│                                 paid/unpaid status
├── SETUP_GUIDE.md              ← hosting, Sheet, Telegram, all module setup,
│                                 troubleshooting
└── CHANGELOG.md                ← exact diff from v8
```

## 3. Data model (`localStorage`, mirrored to the Sheet on sync)

Unchanged from v8: `habits`, `transactions`, `routineLogs`, `runningTimer`,
`routineCats`, `journal`, `diet` (now meal records also carry
`estimateNote`, a one-line AI confidence/assumptions string when logged via
photo).

**`debts`** — `[{id, name, balance, emiAmount, dueDay, principal,
debitAccount, notes, paidMonths:{ 'YYYY-MM': { paidDate, amount, txId,
account } } }]`. `paidMonths` entries are now **objects**, not booleans (v8
used `{'YYYY-MM': true}`) — this is what makes "↩ Undo payment" possible:
it knows exactly which transaction to delete and how much balance to
restore. Old boolean entries are still read fine for display; undo on those
falls back to a best-effort match by debtId + month.

**`goals`** (NEW v9) — `[{id, title, mode:'debt'|'savings'|'weight'|
'habit'|'custom', createdAt, deadline?, ...mode-specific fields}]`.
  - `debt`: `linkedId` (debt id), `target` (balance at goal creation).
  - `savings`/`custom`: `target`, `current`, `unit`.
  - `weight`: `startValue`, `target` — current pulled live from the latest
    `health.vitals[...].weight` entry.
  - `habit`: `linkedId` (habit id), `target` (days out of a trailing
    window, default 30) — current computed live from habit logs.
  Progress/behind-pace logic lives in `goalProgressCalc(g)`.

**`subscriptions`** (NEW v9) — `[{id, name, amount, cycle:'monthly'|
'yearly', renewDay (monthly) | renewDate 'MM-DD' (yearly), category,
notes}]`.

**`assets`** (NEW v9) — `[{id, name, type:'bank'|'cash'|'investment'|
'gold'|'property'|'other', value}]`. Net worth = sum(assets.value) −
sum(debts.balance), computed live, never stored.

**`health`** (NEW v9) — `{ meds:[{id,name,dose,times:[],notes}],
vitals:{ 'YYYY-MM-DD': {bp,sugar,weight,updated} },
appts:[{id,title,date,notes}] }`.

**`documents`** (NEW v9) — `[{id, title, category, ref, expiryDate,
notes}]` — reference info only, no file attachments.

**`budgets`** (NEW v9) — `[{id, category, limit}]` — monthly ₹ cap per
Finance category, shown inside the Finance screen.

**`aiCoach`** (NEW v9) — `{ lastInsights:[string...], lastRun: ISO
timestamp }` — cached so the Dashboard insight line and Coach screen don't
need a fresh Gemini call on every open.

**`settings`** — unchanged fields from v8 (name, accent/customAccent,
fonts, toastDur, motivation*, icon*, tg*, quoteToTg, sheetUrl/sheetId/
autoSync/lastSync, autoCollapseHabits, showUndo). Diet body-stats +
`geminiKey` live in `diet.settings` and are reused by both the photo
estimator and the AI Coach.

## 4. Feature list (v9 — changes over v8 marked NEW)

### Dashboard (NEW v9, now the home screen)
- `screen-dashboard`, first bottom-nav button (🏠 Home, replaced Journal's
  old slot — Journal moved into More).
- Score ring blends habit completion %, whether routine was logged today,
  whether any meal was logged today, and whether any EMI is overdue — only
  factors with real data are averaged in.
- Tile grid adapts to what's tracked: habits done, routine hours, spend
  today, calories (if Diet targets are set), water (if a habit named/unit
  matches water), sleep (if a Sleep-linked habit exists), pending EMI
  count, goals on track — tiles for modules with no data simply don't
  render rather than showing zeroes.
- Top Priorities: unlogged habits, overdue EMI, subscriptions renewing
  ≤5 days, no journal entry today, goals behind pace — capped at 5, sorted
  by nothing fancy (habits → debts → subs → journal → goals) since all are
  same-day urgency.
- Quick actions jump straight into the relevant Add flow.
- Insight line shows the first cached AI Coach insight if generated today,
  else falls back to the existing daily quote.
- `renderDashboard()` is called on `goToScreen('dashboard')` and inside
  `renderAll()` — it is **not** wired to every single mutation across the
  app (that would be expensive); it recomputes fresh every time the
  Dashboard is opened, which covers the normal usage pattern.

### Goals (NEW v9)
- `screen-goals`, reached via More → Goals. `goalProgressCalc(g)` is the
  single source of truth for progress %, current/target values, and the
  "behind pace" flag (only computed if a deadline is set: expected % from
  elapsed time vs. actual %, flagged behind if actual trails by >12pp).
- Debt-linked goals auto-track as that specific loan's balance drops.
  Habit-linked goals auto-track completion over a trailing window. Weight
  goals pull the latest Health vitals weight entry live.

### Calendar (NEW v9)
- `screen-calendar`, month grid built client-side (`calView` tracks
  y/m), dots computed per day from habits/transactions/journal/diet
  presence. `openDayDetail(date)` opens a modal with a full read-out —
  no dedicated day-editing here, it's a read/navigate surface, not a new
  entry point (use the module's own Add flow, or Search, to edit).

### Global Search (NEW v9)
- `screen-search`, reached via the 🔍 icon in the header (works from any
  screen) or via a data-back button back to Home. `renderSearchResults(q)`
  is a simple substring match across habit names, transaction note/
  category, journal text, meal names, debt names, goal titles,
  subscription names, medicine/appointment names, and document titles —
  capped at 60 results, each result routes to its owning screen (and, for
  transactions/debts/goals/subscriptions/documents, opens the matching
  edit modal directly).

### Habits, Routine & Sleep, Finance, Journal, Diet & Nutrition
- Unchanged structurally from v8 **except**:
  - Finance gained **Budgets** (see below).
  - Diet's photo estimator prompt was substantially rewritten (see §5).
  - Journal gained a persistent "‹ More" back button (previously missing
    since Journal used to live on the bottom nav directly).

### Budgets (NEW v9, lives inside Finance)
- `S.budgets`, rendered in a card between the finance chart and the
  ledger. `monthSpendByCategory(cat, ym)` sums this month's `out`
  transactions per category; a progress bar turns the fill color to
  `--danger` when spend exceeds the limit. Add/edit/delete via
  `openBudgetModal()`.

### Debts / EMI (overhauled v9)
- `debtDueInfo(d)` computes this month's due date, days-away, and whether
  this month is already paid (`d.paidMonths[currentYM()]`).
- List sorts unpaid-first, chronological by due date within each group,
  paid group at the bottom (dimmed via `.debt-card.paid`).
- Badge text: `"{Mon} - Paid"` when paid this month, else `"Overdue by Nd"`
  / `"Due today"` / `"Due in Nd"`.
- **"Mark this month paid"** → `openPayEmiModal()` → asks amount (defaults
  to `emiAmount`, editable) and account (dropdown of Assets bank/cash
  entries + "Other" free text) → `payDebtEmi(id, amt, account)` writes a
  `paidMonths[ym]` **object** (`paidDate`, `amount`, `txId`, `account`),
  reduces `balance`, and pushes a tagged Finance transaction.
- **"↩ Undo payment"** → `undoDebtPayment(id)` → restores `balance`,
  deletes the Finance transaction by `txId` (or best-effort match by
  `debtId` + month for legacy boolean `paidMonths` entries), removes the
  `paidMonths[ym]` entry.
- Stat grid: total balance owed, total EMI this month, paid this month,
  remaining this month — four tiles.
- `openDebtModal()` also sets/edits the loan's default `debitAccount`.

### Subscriptions (NEW v9)
- `screen-subscriptions`, reached via More. Monthly/yearly cycle;
  `subNextRenewDaysAway(s)` computes days to next renewal for either
  cycle type; `dueSoonSubscriptions()` (≤5 days) feeds the Dashboard
  priority list. Monthly/yearly totals shown at the top.

### Assets & Net Worth (NEW v9)
- `screen-assets`, reached via More. Simple CRUD list of assets by type;
  net worth computed live against `S.debts` balances, never stored
  separately (so it's always consistent with the Debts tab).

### Health (NEW v9)
- `screen-health`, reached via More. Today's BP/sugar/weight save into
  `health.vitals[todayStr()]`; medicines and appointments are separate
  CRUD lists (`openMedModal`, `openApptModal`). Weight entries feed
  weight-type Goals automatically.

### Documents Vault (NEW v9)
- `screen-documents`, reached via More. Reference-only fields (title,
  category, reference/number, expiry date, notes) — explicitly not a file
  or password store; the screen says so.

### AI Coach (NEW v9)
- `screen-coach`, reached via More. `buildCoachDigest()` assembles a
  plain-text summary of the last 7/30 days across habits, spend
  (30d vs. prior 30d, top categories), budgets, debts (balance/EMI/months
  remaining/overdue), sleep, goals, and journaling frequency, then sends
  it to `gemini-2.0-flash` asking for 4–6 short, specific, non-generic
  insights as a JSON array of strings. Cached in `S.aiCoach` so the
  Dashboard can show the top insight without re-calling the API.

### Reports (expanded v9)
- Report chips now include Overview, Finance, Debts/EMI, Routine,
  Journal, Diet, Goals, Subscriptions, Net Worth, Health, and one chip
  per habit (was: per-habit + Finance + All only).
  Each new category has its own summary card in `renderReports()` and a
  dedicated **"Export this report"** Excel/PDF pair
  (`exportDebtsExcel/Pdf`, `exportJournalReportExcel/Pdf`,
  `exportDietReportExcel/Pdf`, `exportRoutineReportExcel/Pdf`,
  `exportGoalsExcel/Pdf`, `exportSubscriptionsExcel/Pdf`,
  `exportAssetsExcel/Pdf`, `exportHealthExcel/Pdf`). The Debts PDF
  color-codes rows green (paid) / red (unpaid) and includes the
  debited-from account and per-loan status. The original "Export
  everything" card (period + summary/full toggle, Excel/PDF, Save to
  Sheet) is unchanged and still covers Habits/Finance/Routine together.

### Reminders & notifications (Telegram), Motivation toasts, Daily quote,
### Theme/font/icon, Trends, Installability
- Unchanged from v8, except the **app icon files themselves** were
  regenerated from the user-supplied GP logo (see §6) and the **About**
  screen (Settings → GP Ledger row) was redesigned with the logo, the
  "Your Life. One System." tagline, and a colorful feature-chip summary.

### Navigation (v9 structure)
- Bottom nav: **Home, Habits, Finance, Routine, More** (was Habits/
  Finance/Routine/Journal/More — Journal moved into More to make room for
  Home/Dashboard).
- Header gained a persistent 🔍 search icon next to Save & Sync, available
  on every screen.
- More menu reorganized into sections — **Plan** (Goals, Calendar, AI
  Coach), **Track** (Journal, Diet, Health), **Money** (Debts/EMI,
  Subscriptions, Assets & Net Worth), **Review** (Trends, Reports,
  Documents Vault), **System** (Settings).
- Every screen reached through More now has a persistent "‹ More" back
  button (Journal and Search were missing this in earlier builds and now
  have it — Search's back button reads "‹ Home" since it's reachable from
  anywhere, not just More).

### Database (Google Sheets)
- `apps-script.gs` v9 writes six new tabs on every sync: **Goals**,
  **Subscriptions**, **Assets**, **Health** (vitals history + medicines),
  **Documents**, **Budgets** — alongside the unchanged Data/Habits/
  Settings/Transactions_<year>/Routine/Reports/ReminderLog.
- **Debts tab** gained a "Debited From" column and a per-sync "Status"
  column (Paid/Unpaid for the current month) plus "Last Paid Date".
- `action=load` (Load from Sheet) is unchanged in shape; the JSON
  snapshot on the Data tab already carries every new field once the
  client starts sending it, so restoring onto a new device restores
  everything.

## 5. Diet photo-nutrition estimator (rewritten prompt, v9)
`analyzeMealPhoto()` now asks Gemini to: (1) identify every visually
distinct food/drink item separately rather than guessing one blended
number; (2) reason about portion size against visible reference objects in
the frame (plate ≈26cm, fork/spoon ≈18-20cm, fist ≈1 cup, palm ≈85-100g of
dense protein, thumb ≈1 tbsp) and fall back to a typical serving size with
lowered confidence if no reference object is visible; (3) sum per-item
nutrition into one combined total; (4) explicitly flag likely
hidden-calorie ingredients (oil, ghee, sauce, sugar) it can reasonably
infer but can't see; (5) return an overall confidence level (low/medium/
high) and a one-sentence assumptions note. The assumptions note is stored
on the meal record (`estimateNote`) and shown under the meal in the Diet
tab so the person can see exactly what was guessed. This is a real
accuracy improvement over v8's one-line "guess it" prompt, but it remains
an AI estimate from a 2D photo — it cannot weigh food or see ingredients
mixed in, and the app says so both in the modal hint and in this
blueprint.

## 6. App icon & branding (NEW v9)
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`: the user's GP
  mark (colorful gradient "GP" wordmark) isolated from its source
  screenshot, cropped to the icon's actual bounds (auto-detected via
  largest-bright-connected-component, not a fixed crop box), corners
  made transparent then flattened onto white, full-bleed square.
- `icon-512-maskable.png`: same mark scaled to ~70% and centered on a
  white full-bleed 512×512 canvas so Android's adaptive-icon mask
  (circle/squircle/etc.) doesn't clip the "GP" lettering.
- About screen (`openAboutModal()`) shows `icon-192.png` inline, the
  gradient "GP LEDGER" wordmark text, and the "Your Life. One System."
  tagline (colors: green "One", indigo "System", matching the app's
  existing accent palette).
- If the person wants the maskable icon regenerated (e.g. a different
  safe-zone scale) or a different source logo swapped in, they just need
  to say so — the crop/generation is scripted, not manual.

## 7. Known limitations
1. Google Sheet remains a mirror/backup; Load from Sheet is a manual
   pull, not automatic real-time multi-device sync.
2. Debt ↔ Finance interlink: paying/undoing from the Debts tab is now
   two-directional (undo removes the transaction), but editing the
   auto-created Finance transaction directly still does not adjust the
   loan balance back — always use the Debts screen's Pay/Undo buttons.
3. Photo-based diet estimates and AI Coach insights both require the
   user's own free Gemini API key, a live connection at the moment of
   use, and remain estimates/summaries, not verified data.
4. Apps Script requires a "New version" deployment after any code change.
5. Quick-log timer remains single-slot (no simultaneous timers).
6. PDF exports remain simple generated reports, not pixel-perfect
   brochures.
7. Documents Vault stores reference text only — no file attachments, no
   password storage.
8. Global Search is substring matching, not fuzzy/typo-tolerant.

## 8. Recommended next upgrades (not yet built — ranked by effort)

**Low effort:**
- Light/dark theme toggle
- Two-way Debt ↔ Finance sync (editing the EMI transaction adjusts balance)
- Push-style due-today nudge for subscriptions/appointments (currently
  surfaced only via Dashboard priorities, not a notification)

**Medium effort:**
- Snooze/repeat-if-missed logic for habit reminders
- A PIN or biometric lock screen for privacy
- Rich-text (bold/italic/lists) journal editor instead of plain textarea
- Fuzzy/typo-tolerant Global Search
- Multiple simultaneous quick-log timers
- Recurring transactions auto-created from Subscriptions on their renewal
  date (currently Subscriptions and Finance are tracked separately)

**Larger effort:**
- True real-time multi-device sync would need a proper backend + accounts
- Native app store presence via Capacitor
- Barcode/packaged-food nutrition lookup for Diet (vs. photo-only)
- File attachments for Documents Vault (would need a storage backend
  beyond Google Sheets/localStorage)

## 9. How to hand this back to me later
Paste or upload this blueprint (v9) at the start of a new conversation,
plus the current app files if you've edited them outside our chats. I'll
know exactly what exists — including Dashboard, Goals, Calendar, Search,
Budgets, Subscriptions, Assets & Net Worth, Health, Documents Vault, AI
Coach, the Debts undo/account/status rework, the expanded Reports, the new
icon, and the redesigned About screen — and can pick up precisely instead
of guessing or rebuilding from scratch.
