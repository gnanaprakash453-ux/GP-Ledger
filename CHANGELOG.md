# Changelog — v8 → v9 (+ v9.2 logo/branding fix, v9.1 branding/logo/quotes patch)

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
   prompt — always sanity-check before saving.
4. Apps Script still requires a "New version" deployment after any code
   change (see SETUP_GUIDE troubleshooting).
5. Quick-log timer remains single-slot (unchanged from v7).
6. AI Coach and photo nutrition both require the same Gemini key and a
   live internet connection at the moment you tap them; nothing is
   cached beyond the day's insights/estimate.
7. Documents Vault is reference-only by design — it does not store file
   attachments, scans or passwords.
