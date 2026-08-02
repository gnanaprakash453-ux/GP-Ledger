# GP Ledger — Blueprint (v7)

Keep this file. Hand it back to me (or any AI/developer) in a future
conversation, along with the current app files if you've made manual edits
outside our chats, and it fully describes what exists — nothing needs to be
re-explained. See `CHANGELOG.md` for the exact diff from v6.

---

## 1. What this app is
A single-file installable PWA combining a **habit tracker** (with
customizable quick-add amounts and per-habit reminder times), a **personal
finance ledger**, and a **daily routine/time tracker** (including a
start/stop quick-log timer), with a **Reports** tab (category filters,
Excel/PDF export), full theme/font/icon customization, **Telegram alarms**
that actually fire (per-habit reminder times + a daily quote at midnight),
and **Google Sheets** as a verified, year-spanning database. Built by
**Gnanaprakash Xavier**. No accounts, no ads — everything lives on the
user's own device, own Sheet, own Telegram bot.

## 2. File structure
```
ledger-pwa/
├── index.html              ← the entire app: HTML + CSS + JS
├── manifest.json
├── sw.js                     ← cache name bumped to v7 so updates actually reach installed phones
├── icon-192.png / icon-512.png / icon-512-maskable.png / apple-touch-icon.png
├── apps-script.gs             ← Google Sheet backend + Telegram reminder & daily-quote triggers
├── SETUP_GUIDE.md              ← hosting, Sheet, Telegram (incl. reminder times & daily quote), icon, troubleshooting
└── CHANGELOG.md                ← exact diff from v6
```

## 3. Data model (`localStorage`, mirrored to the Sheet on sync)
**`habits`** — `id, name, icon, kind('check'|'quantity'), target, unit, step,
quickAmounts[] (NEW v7 — one-tap preset chips, e.g. water: [250,500,1000,2000]),
times[] (per-habit reminder times, HH:MM — now actually editable via the UI,
NEW v7), done{date:true}, logs{date:[{amount,time}]}, lastNotified{},
milestones{date:[...]}, color`.
Default habits unchanged from v6: Drink Water, Read, Walk, No Junk, Sleep.

**`transactions`** — unchanged: `{id, amount, type, note, category, date, created}`.

**`routineLogs`** — `{date: [{id, start, end, cat, note}]}`, unchanged shape.

**`runningTimer`** (NEW v7) — `{cat, startISO} | null`. Backs the Routine
tab's quick-log stopwatch; persisted so it survives a reload mid-timer.

**`routineCats`** — unchanged: user-editable category/color list.

**`settings`** — adds four fields over v6:
```js
{
  ...v6 fields unchanged (name, accent/customAccent, fontHead/fontBody/fontMono,
    toastDur, motivationOn/Freq/Msgs, iconInitial/iconColor1/iconColor2,
    tgEnabled/tgToken/tgChatId, sheetUrl/sheetId/autoSync/lastSync),
  quoteToTg,              // NEW v7 — send the daily quote to Telegram at 12 AM
  autoCollapseHabits,     // NEW v7 — expanding one habit auto-closes others; default true
  showUndo,               // NEW v7 — show/hide the Undo button on action toasts; default true
}
```

## 4. Feature list (v7 — changes over v6 marked NEW/FIXED)

### Habits
- **FIXED: reminders now actually settable.** v6 had the Telegram plumbing
  but no UI to put a time on a habit. Habit detail view now has a
  **Reminder times** section (add/remove HH:MM chips) — this is what both
  the in-app popup and the Telegram alarm key off.
- **NEW: customizable quick-add.** Habit detail view now has an editable
  **step size** and editable **quick preset chips** (comma-separated
  amounts), rendered as one-tap chips in the row's expanded area — so e.g.
  logging 2 liters of water is one tap instead of eight.
- **NEW: accordion behaviour.** Expanding a habit auto-collapses any other
  open habit, and tapping outside an expanded habit closes it; a ▲ minimize
  button also sits in the expanded area. All controllable via **Settings →
  Habit list behaviour → Auto-minimize** (default on).
- **FIXED: in-app reminders were a no-op.** `checkLocalReminders()` was a
  placeholder stub in v6 (comment only, did nothing). It now actually checks
  habit times every 15 seconds and **pops a modal** ("⏰ Reminder — log it
  now?") plus a browser notification if permission was granted, not just a
  toast.
- Everything else (default habit set, weekly grid detail view, per-habit
  color, streaks) unchanged from v6.

### Motivation toasts
- Unchanged in mechanics from v6 (on/off, frequency, custom message list,
  duration slider).
- **NEW: moved to the top of the screen** (was bottom), and the **Undo**
  button on any toast can now be turned off entirely in Settings.

### Daily quote
- Unchanged rotation logic from v6 (deterministic by date, local quote bank).
- **NEW: optional Telegram delivery.** Settings → **"Send Daily Quote at
  12 AM"** + a `sendDailyQuote()` function in `apps-script.gs` (wired as a
  second daily trigger) posts that day's quote and its real author (or
  "GP Ledger" for the app's own lines) to Telegram at midnight — using the
  identical quote bank and date-index math as the in-app card, so they never
  disagree.

### Reminders & notifications (Telegram)
- **FIXED: server-side dedupe.** v6's `checkReminders()` relied on the
  client's `lastNotified` snapshot inside the last-synced JSON blob, which
  could go stale between syncs and either double-fire or silently miss.
  v7 keeps its own `ReminderLog` sheet for dedupe and matches within a
  ±2-minute window of each habit's reminder time (a 5-minute trigger won't
  always land on an exact clock minute).
- In-app reminder popup described above under Habits.

### Routine / time tracking
- Unchanged: 24-hour timeline, Day/Week/Month category totals, "biggest
  time sink" + Junk/Scrolling callout, custom categories, dedicated
  Quick-log Sleep button.
- **NEW: Quick-log timer.** A row of category chips above the Sleep button —
  tap to start timing that category now, tap again (or a different chip) to
  stop and log it, with a live "Recording X — Ym so far" indicator. Solves
  "Quick log only has Sleep" by giving every category the same one-tap
  start/stop flow, without needing to know start/end times in advance.

### Finance / Trends / Reports
- Unchanged from v6: editable/deletable transactions, 30-day donut,
  8-week income/expense + 6-month net trend charts, Reports tab with
  category filter chips + Day/Week/Month/Year toggle + Excel/PDF export
  (SheetJS / jsPDF) + "Save this week to Google Sheet."

### Theme, font & icon
- Theme/font pickers unchanged.
- **FIXED: generated icon files now use your chosen heading font** (was
  hardcoded to Poppins regardless of Settings), and wait for the web font to
  finish loading before drawing to canvas so the letter renders correctly.
  Same download-and-manual-replace flow as v6 for the real home-screen files.

### Database (Google Sheets)
- Unchanged sync mechanics and verification shape from v6
  (`{ok:true, source:'handleSync', rows:{...}}`).
- **NEW: `ReminderLog` sheet**, written by `checkReminders()` for dedupe
  (see above) — not user-facing, just a bookkeeping tab.

### Design system / bug fixes
- **FIXED: the "+" FAB was `position:absolute` inside the scrolling habit
  list**, so it visually drifted with scroll and could end up sitting on top
  of (and blocking taps on) a habit row. Changed to `position:fixed` so it
  stays pinned to the screen corner on every tab, always.
- **FIXED: invisible white-on-white text** in native date/time pickers and
  dropdowns — added `color-scheme: dark` globally so the OS renders those
  native controls in dark mode to match the app.
- **NEW: About modal.** Settings → About now opens a real modal (app name,
  version, short description, "Built by Gnanaprakash Xavier") instead of a
  static version label.

### Installability
- Unchanged: full PWA, service worker cache name bumped to `v7`.

## 5. Known limitations
1. Google Sheet remains a mirror/backup, not real-time multi-device sync.
2. Custom home-screen icon still needs a manual file replace + reinstall —
   an OS-level limitation, not something any web app can bypass.
3. Apps Script requires a "New version" deployment after any code change —
   this is what the sync-verification debug log is there to catch clearly.
4. Quick-log timer is single-slot: starting a new category automatically
   stops and logs whatever was previously running (no simultaneous timers).
5. PDF export remains a simple generated report, not a pixel-perfect brochure.

## 6. Recommended next upgrades (not yet built — ranked by effort)

**Low effort:**
- Light/dark theme toggle (currently dark-only, though accent/fonts are configurable)
- Budget cap per category with a warning when exceeded

**Medium effort:**
- Snooze/repeat-if-missed logic for habit reminders
- A PIN or biometric lock screen for privacy
- Habit categories/tags with filtering
- Two-way sync (pull from Sheet on load, not just push) for true multi-device use
- Multiple simultaneous quick-log timers, if that turns out to matter in practice

**Larger effort:**
- True real-time multi-device sync would need a proper backend + accounts
- Native app store presence via Capacitor

## 7. How to hand this back to me later
Paste or upload this blueprint (v7) at the start of a new conversation, plus
the current app files if you've edited them outside our chats. I'll know
exactly what exists, what's already decided (defaults, removed WhatsApp,
Google Sheet as DB, per-habit reminder times, quick-log timer, etc.), and can
pick up precisely instead of guessing or rebuilding from scratch.
