# Changelog — v7 → v8

## Added

- **Load from Sheet.** Settings → Google Sheet database now has a
  **"⬇ Load from Sheet"** button, next to Sync now. It pulls the last
  synced snapshot back down from your Google Sheet and replaces
  everything on the current device — for restoring onto a new phone,
  or after a reinstall. (Apps Script gained a matching `action=load`
  endpoint; you must redeploy `apps-script.gs` for this to work.)

- **Routine ↔ Habit auto-sync (no more double entry).** A habit can now
  be linked to a Routine category (Habit detail → **Linked Routine
  category**, or set it when adding a new habit). Logging time in that
  category — via a time block, the Quick-log timer, or Quick-log Sleep —
  automatically logs the same amount against the linked habit, so you
  never have to enter the same thing twice. Minutes convert to hours
  automatically for habits whose unit is "hr"; check-off habits are
  simply marked done.

- **Completed habits move to their own queue.** The Habits tab now
  splits into an **incomplete section on top** and a **Completed ✅
  section at the bottom** for whichever habits have hit their target
  that day — so what's left to do is always what you see first.

- **Debts / EMI tab** (More → Debts/EMI). Add each loan with its
  current balance, monthly EMI amount, and due day of month. Overdue
  loans (past their due day and not yet marked paid this month) are
  flagged. Tapping **"Mark this month paid"** both reduces the loan's
  balance by the EMI amount *and* creates a matching Finance
  transaction (category "EMI/Loan") — so the two stay in sync from one
  action, in the direction that matters day to day: pay from the Debts
  tab, see it reflected in Finance automatically.

- **Journal / diary tab.** A notepad-style entry per calendar date —
  navigate with ‹ › or the date picker (including backdating a missed
  day), adjustable font and text color, Save/Print/PDF/Word export for
  a single entry, and an **"Export whole diary"** button that pulls
  every saved entry and lays it out in true chronological order
  (sorted by date, not by when you happened to type it) regardless of
  what order you entered days in. Syncs to a new **Journal** sheet tab.

- **Diet & Nutrition tab** (More → Diet). Set your height, weight, age,
  sex, activity level and goal in Settings → Diet & body stats to get
  a personal daily calorie and macro target (Mifflin-St Jeor BMR ×
  activity, adjusted ±20%/+15% for fat-loss/muscle-gain goals). Log
  meals manually, or attach/capture a photo and — if you've added a
  free Gemini API key in the same settings group — tap **"Estimate
  nutrition from photo"** to auto-fill calories/protein/carbs/fat/fiber
  from the image (you can edit the estimate before saving; without a
  key, manual entry works exactly the same). View totals by day/week/
  month against your targets, and export to Excel or PDF. Syncs to a
  new **Diet** sheet tab.

- **Habit custom-amount input now visible while typing.** Global fix:
  number/date/text inputs now force explicit text color (and override
  the phone's autofill white-on-white styling), so the "Custom amount"
  field under a habit shows what you're typing as you type it, not
  only after you tap Add.

## Changed

- **Bottom navigation restructured.** With three new sections, the
  bottom nav is now Habits / Finance / Routine / Journal / **More** —
  More opens a menu for Trends, Reports, Debts, Diet and Settings, so
  the nav bar stays usable on a phone screen and has room for further
  additions later without another redesign.

## Known limitations (carried forward / new)
1. Google Sheet remains the sync/backup mechanism — Load from Sheet is
   a manual pull, not automatic real-time multi-device sync.
2. Debt ↔ Finance sync is one-directional: paying from the Debts tab
   creates a Finance transaction; editing that transaction afterwards
   does not adjust the loan balance back.
3. Photo-based nutrition estimates need your own free Gemini API key
   and are estimates, not lab-accurate figures — always sanity-check
   before saving.
4. Apps Script still requires a "New version" deployment after any
   code change (see SETUP_GUIDE troubleshooting).
5. Quick-log timer remains single-slot (unchanged from v7).
