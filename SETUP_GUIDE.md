# GP Ledger — Setup Guide (v9)

This covers everything from "I have these files" to "the app is installed on my
phone, syncing to my own Google Sheet, and pinging me on Telegram."

---

## 1. Get the files onto your phone/computer

You need this folder of files together in one place:
```
index.html, manifest.json, sw.js, icon-192.png, icon-512.png,
icon-512-maskable.png, apple-touch-icon.png, apps-script.gs (not needed on the phone)
```
The simplest free hosting is **GitHub Pages**. You do **not** need to install
Git or use any command line — everything below happens in a normal web
browser, on your phone or computer. Takes about 10 minutes the first time.

### 1a. Create a GitHub account
1. Go to **github.com** and click **Sign up** (top right).
2. Enter an email address, then a password, then choose a **username**
   (this becomes part of your site's web address later, so pick something
   simple — e.g. `yourname123`. Letters, numbers, and hyphens only).
3. Verify you're human (a small puzzle), then verify your email — GitHub
   sends a code to your inbox, type it in.
4. It may ask a couple of onboarding questions ("what will you use GitHub
   for") — you can pick anything or skip. You'll land on your GitHub
   homepage once done. This account is free forever for what we're doing.

### 1b. Create a new repository (a "project folder" on GitHub)
1. Once logged in, click the **"+"** icon in the top-right corner of the
   page, then **New repository**.
2. **Repository name:** type `gp-ledger` (any name works, no spaces).
3. Leave it set to **Public** (GitHub Pages needs this on a free account).
4. Tick the box **"Add a README file"** — this just gives it one starter
   file so the repository isn't empty; harmless either way.
5. Click the green **Create repository** button at the bottom.
   You'll land on your new (mostly empty) repository page.

### 1c. Upload the app files — no Git required
1. On your repository page, click **Add file** (top right of the file
   list) → **Upload files**.
2. Either drag all the files listed at the top of this section into the
   browser window, or click **"choose your files"** and select them from
   wherever you saved them on your computer/phone.
   - Upload **everything except `apps-script.gs`** — that one is pasted
     into Google Apps Script instead, in section 3 below, not uploaded here.
   - Make sure `index.html` ends up sitting directly in the repository (not
     inside a sub-folder) — if your files were inside a folder called
     `ledger-pwa` when you selected them, GitHub may nest them the same
     way; check the file list afterwards and drag things back to the top
     level if needed by re-uploading individually.
3. Scroll down, and click the green **Commit changes** button (the default
   message is fine). This uploads and saves the files.
4. Refresh the page — you should now see `index.html`, `manifest.json`,
   `sw.js`, the four icon PNGs, `SETUP_GUIDE.md` and `CHANGELOG.md` listed
   in the repository.

### 1d. Turn on GitHub Pages (this is what makes it a live website)
1. On your repository page, click the **Settings** tab (top of the page,
   may be hidden under a "···" dropdown on a narrow phone screen).
2. In the left sidebar, under **"Code and automation"**, click **Pages**.
3. Under **"Build and deployment" → Source**, make sure **"Deploy from a
   branch"** is selected.
4. Under **Branch**, use the dropdown to pick **`main`**, leave the folder
   as **`/ (root)`**, then click **Save**.
5. Wait about a minute, then refresh this same Settings → Pages screen.
   A green box will appear saying **"Your site is live at
   `https://yourusername.github.io/gp-ledger/`"** — that's your app's URL.
   (It can occasionally take up to 10 minutes on the first deploy.)
6. Open that URL in a new tab to confirm the app loads before moving on to
   installing it on your phone (section 2).

### Updating the app later
Whenever you (or I, in a future chat) hand you new/changed files: go back
to the repository, **Add file → Upload files**, drop in the updated files
(this overwrites the old ones with the same name), **Commit changes**, then
wait a minute for GitHub Pages to redeploy automatically — no settings need
to be touched again.

Any other static host works the same basic way (Netlify, Vercel, Cloudflare
Pages, your own server) — the app is just plain static files — but GitHub
Pages above is the simplest free option that needs no extra sign-up beyond
the GitHub account.

## 2. Install it as an app on your phone

**iPhone (Safari):** open your URL → Share icon → **Add to Home Screen** → Add.
**Android (Chrome):** open your URL → ⋮ menu → **Add to Home screen** / **Install app**.

You'll get a real home-screen icon and a full-screen app with no browser bar.

> If you ever change the icon files (see step 5) and reinstall, you may need to
> **remove the old home-screen icon first**, then re-add it — phones cache PWA
> icons aggressively.

## 3. Set up the Google Sheet database + backend

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet. Name it "GP Ledger Data".
2. In the sheet: **Extensions → Apps Script**. This opens the script editor.
3. Delete the placeholder code and paste in the **entire contents of `apps-script.gs`**.
4. Click **Save** (the floppy disk icon or Ctrl/Cmd+S).
5. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" → **Web app**.
   - Description: "GP Ledger sync" (anything).
   - Execute as: **Me**.
   - Who has access: **Anyone** (this doesn't expose your data publicly — the URL itself acts as the secret; still, don't share it).
   - Click **Deploy**.
6. The first time, Google will ask you to **authorize** the script — click through the "unverified app" warning (it's your own script), and allow the permissions it asks for (it needs to edit the spreadsheet and send outbound requests to Telegram).
7. Copy the **Web app URL** it gives you (ends in `/exec`).
8. In GP Ledger → **Settings → Google Sheet database**, paste that URL into **Apps Script Web App URL**.
9. Tap **Test connection** — you should see a message confirming it's reachable, plus a debug log entry.
10. Tap **Sync now**. Open your Google Sheet — you should now see tabs: `Data`, `Habits`, `Settings`, `Transactions_<year>`, `Routine`, `RoutineTemplates`, `Reports`, `Debts`, `Journal`, `Diet`, `Goals`, `Subscriptions`, `Assets`, `Health`, `Documents`, `Budgets`, `Quotes`.

> **Already on v9.6.1 and just upgrading to v9.7.1?** Paste in the *new*
> `apps-script.gs` and redeploy (**Deploy → Manage deployments → ✏️ edit
> → New version → Deploy — this step is required, saving alone does NOT
> republish the live URL**). This fixes **"Load from Sheet" failing with
> "Data tab is empty"** even on accounts that synced successfully — the
> full backup snapshot used to be capped at one ~50,000-character Sheet
> cell and silently skipped itself once total history (habits +
> transactions + routine logs + diet, etc. combined) grew past that. It's
> now split across as many rows as needed instead of one cell, so there's
> no practical size ceiling anymore. After redeploying, tap **Test
> connection** — if the debug log still reports an old version number
> (anything before v9.7.1), the redeploy step above was missed; go back
> and do it via "New version", not just Save. Once it reports v9.7.1, tap
> **Sync now** — the debug log will show how many snapshot rows were
> written (e.g. "Data tab snapshot: wrote 3 row(s)"); seeing "1" on an
> account with real history means you're still on the old script. Once
> that count looks right, **Load from Sheet** will work — nothing to do
> manually, no history is lost either way.

> **Already on v9.6.0 and just upgrading to v9.6.1?** Same deal — paste
> in the *new* `apps-script.gs` and redeploy. This is the fix mentioned
> above: `checkReminders` now also covers Finance, Health, Documents, and
> Goals, sending to Telegram on the same trigger — previously those four
> only fired locally while the app was open.

> **Already on v9.5.2 and just upgrading to v9.6.0?** Same deal — paste
> in the *new* `apps-script.gs` and redeploy (**Deploy → Manage
> deployments → ✏️ edit → New version → Deploy**). This adds the new
> `Quotes` tab (your custom/edited quotes from Settings > Quotes >
> Manage my quotes now back up here too), adds Fat Quality/Meal Tag
> columns to `Diet`, and fixes `Goals` showing a blank Current for
> Debt/Weight/Habit-streak goals and auto-tracked Savings goals (those
> were never stored as a plain number — the sheet just didn't know how
> to ask for them until now).

> **Already on v9.5.1 and just upgrading to v9.5.2?** Same deal — paste
> in the *new* `apps-script.gs` and redeploy (**Deploy → Manage
> deployments → ✏️ edit → New version → Deploy**). This one matters even
> if v9.5.1 seemed to install fine: v9.5.2 fixes the actual cause of
> `TypeError: sheet.clearContent is not a function` (Apps Script's
> `Sheet` class has no `clearContent()` method — only `clearContents()`,
> with an "s" — v9.5.1 fixed a real but different ordering bug that
> didn't touch this). If your debug log ever showed that exact
> `clearContent is not a function` message, this is the fix for it.

> **Already on v9.4.1 and just upgrading to v9.5.0?** Same deal — paste in
> the *new* `apps-script.gs` and redeploy (**Deploy → Manage deployments →
> ✏️ edit → New version → Deploy**). This is a pure speed fix — same tabs,
> same columns, same data — so nothing else changes, but it's worth doing
> if sync has felt slow: v9.5.0 batches each tab into one write instead of
> one call per row, which is usually a large, noticeable speedup once you
> have more than a handful of habits/transactions/routine entries.

> **Already on v9.4 and just upgrading to v9.4.1?** Same deal — paste in
> the *new* `apps-script.gs` and redeploy. This one matters even if sync
> was "working" for you before: v9.4.1 fixes a real bug where logging a
> meal photo made the *next* sync fail (see the Troubleshooting section
> below), so it's worth doing even if you haven't touched Templates.

> **Already on v9.3 and just upgrading to v9.4?** Same deal — paste in the
> *new* `apps-script.gs` and redeploy (**Deploy → Manage deployments →
> ✏️ edit → New version → Deploy**), or the new `RoutineTemplates` tab
> won't appear and Test connection will flag the version mismatch
> described below.

> **Already on v8 and just upgrading to v9?** You still need to redo step 3.3 —
> paste in the *new* `apps-script.gs` — and step 5's **Deploy → Manage
> deployments → ✏️ edit → New version → Deploy**. Saving alone does not
> publish code changes to your live `/exec` URL (see the troubleshooting
> note below). Without this, the six new sheet tabs (`Goals`, `Subscriptions`,
> `Assets`, `Health`, `Documents`, `Budgets`) and the updated `Debts` tab
> (with the new Debited-From/Status columns) won't populate.

### If sync ever stops updating the sheet correctly
This was the exact bug fixed in v6. The app now checks that the response
really came from the sync handler (not a generic/error page), and shows a
**debug log** in Settings if it didn't. The most common causes, in order:
1. **You logged a meal with a photo, then synced (fixed in v9.4.1).**
   Meal photos are stored as full images on your device. Before v9.4.1,
   that image was accidentally included in what got sent to the Sheet —
   and a single Sheet cell can only hold 50,000 characters, so even one
   photo broke the sync. If you're on v9.4.1 this can't happen anymore
   (only the nutrition numbers are synced, never the photo) — if you're
   still on an older version and this matches what you're seeing, update
   to the latest files and redeploy.
1b. **"Load from Sheet" says "Data tab is empty" even though Sync now
   succeeds (fixed in v9.7.0, made self-verifying in v9.7.1).** Before
   v9.7.0, the full backup snapshot (only used by Load-from-Sheet — every
   readable tab like Habits/Finance/Diet syncs independently of it) was
   written into one Sheets cell, capped at ~50,000 characters. Once total
   history across every module grew past that, the snapshot was silently
   skipped — Sync still reported success because every other tab wrote
   fine, but Load then found nothing. If you updated to v9.7.0 and this
   is STILL happening, it almost always means the redeploy didn't
   actually take — pasting new code into script.google.com does not
   republish the live `/exec` URL by itself (see cause #2 below). Check:
   tap **Test connection** and confirm the debug log reports v9.7.1 (not
   an older version); tap **Sync now** and confirm the debug log's "Data
   tab snapshot: wrote N row(s)" shows a realistic N for your data, not
   "1". If either looks wrong, redo Deploy → Manage deployments → ✏️ →
   New version → Deploy.
2. **You edited the script but didn't redeploy.** Apps Script's "Save" does *not*
   republish the live `/exec` URL. You must go **Deploy → Manage deployments →
   ✏️ edit → New version → Deploy** every time you change `apps-script.gs`.
   As of v9.4, this is the easiest cause to catch: tap **Test connection**
   in Settings — the debug log will explicitly say *"your deployed script
   reports v9.3 but the app expects v9.4.1"* (or similar) if this is what's
   wrong, instead of a generic failure. A sync failure alert does the same
   check.
3. **Wrong URL** — make sure it's the `/exec` URL, not `/dev`.
4. **Permissions revoked** — re-run step 6 if Google ever asks you to re-authorize.

### Pulling data back down (Load from Sheet)
Settings → Google Sheet database → **"⬇ Load from Sheet"** fetches the last
snapshot saved to the `Data` tab and replaces everything currently on this
device — habits, transactions, routine logs, debts, journal, diet, goals,
subscriptions, assets, health, documents, budgets, settings.
Useful when setting up a new phone, or after reinstalling the app. It asks
for confirmation first since it's a full replace, not a merge. This needs
the same redeployed `apps-script.gs` as above (it adds the `action=load`
endpoint) and at least one prior successful sync so there's something to load.

### Background reminders (Telegram fires even with the app closed)
1. In the Apps Script editor, click the **clock icon (Triggers)** on the left.
2. **Add Trigger**.
3. Function: `checkReminders`. Event source: **Time-driven**. Type: **Minutes timer**. Every **5 minutes**. Save.

## 4. Set up Telegram notifications

1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts → it gives you a **bot token** (looks like `123456789:AAExampleTokenHere`).
2. Message your new bot anything (e.g. "hi") so it can message you back.
3. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser (replace `<YOUR_TOKEN>`) and find `"chat":{"id":123456789,...}` — that number is your **chat ID**.
4. In GP Ledger → **Settings → Telegram reminders**: turn it on, paste the token and chat ID.
5. Tap **Send test Telegram message** — you should get a message within a couple seconds.

### Actually set a reminder (this is what the bot alerts you about)
Connecting Telegram doesn't by itself schedule anything — you still need to
tell a habit *when* to remind you:
1. On the Habits tab, tap the small **⌄** on any habit to open its detail view.
2. Under **Reminder times**, pick a time and tap **Add** — you can add several
   times a day. Tap the ✕ on a chip to remove it.
3. Tap **Save changes**, then **Sync now** (or leave Auto-sync on) so the time
   reaches the Sheet — that's what the background trigger below reads from.
4. Make sure you completed the trigger step in section 3 above
   (`checkReminders`, every 5 minutes) — without that trigger running on
   Google's servers, reminders only fire while the app happens to be open.

### Daily quote at midnight (optional second trigger)
GP Ledger can text you the day's quote every night at 12 AM, so you wake up
to it:
1. In GP Ledger → **Settings → Telegram reminders**, turn on
   **"Send Daily Quote at 12 AM."**
2. In the Apps Script editor: **Triggers → Add Trigger**.
3. Function: `sendDailyQuote`. Event source: **Time-driven**. Type:
   **Day timer**. Time of day: **Midnight to 1am**. Save.
4. That's a second, separate trigger from `checkReminders` — you'll end up
   with two triggers listed, which is correct.
5. This now sends whatever quote is currently in rotation from **your own**
   quote list (Settings → Quotes → Manage my quotes), not a fixed built-in
   one — keep Syncing so the Sheet has your latest list and rotation
   position to read from.

### In-app reminder sounds — and what's Telegram-backed vs. local-only
**Settings → Communication → Reminder sounds** gives Habit, Finance
(EMI due / subscription renewal), Health (appointment today), Documents
(expiring within 7 days), and Goals (deadline today) each their own tone,
plus a **Notification history** to see everything that's fired.

Only **Habit** reminders had this treatment before; **Finance/Health/
Documents/Goals now also send to Telegram** on the same `checkReminders`
trigger you already set up — no second trigger needed, just redeploy
`apps-script.gs` (now v9.7.1). One difference: Goals sends a same-day
nudge on the deadline regardless of whether it's already met (the in-app
popup only fires if it isn't — replicating that exact check server-side
wasn't worth the duplication for one extra condition).

The first time you open the app it'll ask permission to show
notifications — allow it, or the reminder still pops up and plays its
sound inside the app, but won't also show as a phone notification banner
outside it. On iPhone this only works once the app is **installed to your
Home Screen** (step 2) — Safari itself won't show notifications for a
site that's just open in a browser tab.

## 5. The app icon

v9 ships with your **GP logo** baked in as `icon-192.png`, `icon-512.png`,
`icon-512-maskable.png` and `apple-touch-icon.png` — no in-app setup needed,
just make sure all four files are uploaded to your host alongside
`index.html` (same filenames, same folder). If you ever want a different
logo:
1. Send me the new logo image in a future chat and I'll re-crop/regenerate
   all four icon files from it (this is scripted, so it's quick).
2. Replace those four files in your hosting (re-upload with the same
   filenames).
3. Remove the app from your home screen and **Add to Home Screen** again —
   phones only re-read icon files on a fresh install, not a page refresh.

The **Settings → App Icon** letter/color picker still exists and controls
only the small in-app header badge (top-left avatar), separate from the
real home-screen icon files above.

## 6. Habits: linking to Routine (no double entry)

If you already log something under Routine — e.g. Sleep, or a workout —
you can link it to a matching habit so you don't have to log it twice:
1. Open a habit's detail view (tap ⌄) or **+ New habit**.
2. Under **Linked Routine category**, pick the matching Routine category
   (e.g. "Sleep").
3. From then on, logging a time block, using the Quick-log timer, or
   Quick-log Sleep for that category also logs the equivalent amount
   against the linked habit automatically. Minutes convert to hours if
   the habit's unit is "hr"; check-off habits are simply marked done.

## 6a. Routine → Templates (weekday/weekend day-plans)

Routine tab → **Templates** button (next to Categories). This holds two
reusable day plans instead of one, so you don't have to hand-type your
schedule every day:

- **Weekday plan (Mon–Fri)** — pre-filled from the BPO shift schedule you
  sent: finish BPO shift, additional job, travel home, home routine,
  sleep block, lunch, get ready, travel to office, then the main BPO Team
  Lead shift again.
- **Weekend plan (Sat & Sun)** — pre-filled with a 9-hour additional-work
  block, BBA class, and a sleep/rest block, since you said Sat/Sun need
  the extra job + college covered.

**Everything is editable** — tap **Edit** on any block to change its
category, start/end time, or note, or **+ Add block** for a new one. If
you change jobs, shift timing, or class schedule, this is the only place
you need to update — nothing about the timing is hard-coded elsewhere in
the app.

**Which plan applies to which day** is controlled by the row of day chips
at the top of the Templates screen (tap a day to flip it between Weekday
and Weekend) — so if your off days ever move off Sat/Sun, just re-tap them.

**Putting a plan into your actual log:**
- **"Apply today's plan"** (also available directly on the Routine tab,
  next to Quick-log sleep) fills in *today* using whichever plan matches
  today's weekday.
- **"Fill this week"** (inside the Templates screen) does the next 7 days
  at once — any day that already has logged blocks is skipped automatically,
  so it never silently overwrites real entries; applying to a single day
  that already has blocks asks for confirmation first.

These sync to the Google Sheet in a new `RoutineTemplates` tab, same as
everything else — remember to redeploy `apps-script.gs` (see section 3)
for that tab to start appearing.

## 7. Debts / EMI tracking

**More → Debts/EMI → + Add**: enter the loan name, current balance,
monthly EMI amount, the due day of the month (1–31), and (optionally) which
account it's usually debited from. Unpaid loans sort to the top in
due-date order; loans already paid this month sink to the bottom, dimmed,
labeled e.g. **"Aug - Paid"**.

> **Your existing loans are already in here.** The 10 entries from the EMI
> sheet you sent (Ather, Axis Finance, Axis Bank, Education Loan, Kredit
> Bee, Local Finance, Gold Loan, Credit Card, Rent, Chit) were pre-loaded
> with their balance/EMI/due-day on first open — edit or delete any of them
> like normal, this was only a one-time starting point, not something that
> re-applies itself.

- **Mark this month paid** → confirm the amount and pick the debited-from
  account (choose one of your Assets bank/cash entries, or type one in) →
  this reduces the loan balance and creates a matching Finance transaction
  (category "EMI/Loan") in one step.
- **Made a mistake?** Tap **"↩ Undo payment"** on a paid loan — it restores
  the balance and deletes the matching Finance transaction. No need to
  manually fix both places.
- The top of the screen shows four numbers: total balance owed, total EMI
  due this month, how much you've paid this month, and how much is still
  remaining this month.

## 8. Goals

**More → Goals → + Add**. Five types:
- **Pay off a debt** — pick one of your loans; progress tracks automatically
  as its balance drops (no separate updating needed).
- **Save an amount** — set a target. By default you update your current
  progress manually, or flip on **"Auto-track from a Finance category"**
  and pick a category (e.g. "Savings") — progress then becomes money-in
  minus money-out tagged with that category since the goal was created,
  so logging a transfer as usual is all you need to do.
- **Reach a weight** — set a starting and target weight; progress pulls
  automatically from whatever you log in **Health → today's vitals**.
- **Habit streak** — pick a habit and a number of days (e.g. "hit Read for
  20 of the last 30 days"); tracks automatically from that habit's log.
- **Custom** — anything else (steps, books, whatever) with a manual target
  and current value you update yourself — always manual, since there's no
  single data source in the app to link a truly custom goal to.

Every goal card shows **🔄 Auto-tracked** or **✋ Manual** so it's clear at
a glance which kind you're looking at. Add an optional deadline and the
goal will flag itself **"behind pace"** if your actual progress is
trailing what the calendar would suggest.

## 9. Calendar & Global Search

**More → Calendar**: a month grid with a small colored dot under any day
that has a habit ✅, finance 💰, journal 📔 or diet 🍎 entry. Tap a day to
see everything logged that date in one popup.

**🔍 icon** (top-right of the header, next to Save & Sync, on every
screen): type anything — a habit name, a transaction note, a word from a
journal entry, a meal name, a loan name, a goal title, a subscription, a
medicine, an appointment, a document title, an asset, or a budget
category — and it searches across every module at once. Multi-word
searches match across any field, not just one exact phrase, and results
are ranked so the closest match shows first. Tap a result to jump
straight to it.

## 10. Budgets

Inside the **Finance** tab, above the ledger: **+ Add** a category and a
monthly ₹ limit. A progress bar shows spend vs. limit for the current
month and turns red once you go over. Budget categories and Transaction
categories now share one list — pick from the dropdown or "+ Add new
category…" inline, and **Manage categories** (in either Add Transaction
or Add Budget) lets you rename or delete one everywhere at once. This is
separate from Subscriptions (recurring bills) and Debts (loan EMI) — it's
for everyday spending caps.

## 11. Subscriptions

**More → Subscriptions → + Add**: name, amount, and whether it renews
**monthly** (pick a day of month) or **yearly** (pick a MM-DD date). The
screen totals your monthly and yearly recurring spend, and flags anything
renewing within 5 days — these also show up on the Dashboard's priority
list so you don't get surprised by a renewal.

## 12. Assets & Net Worth

**More → Assets & Net Worth → + Add**: bank accounts, cash, investments,
gold, or property, each with a current value. Net worth is calculated
automatically as **total assets − total Debts/EMI balances** — you don't
enter liabilities separately, it reads them straight from your Debts tab
so the two numbers can never drift apart.

## 13. Health

**More → Health**: log today's blood pressure, blood sugar, and weight at
the top (one entry per day). Below that, two simple lists — **Medicines**
(name, dose, times of day) and **Appointments** (title, date, notes). Your
weight entries here automatically feed any weight-type Goal you've set up.

## 14. Documents Vault

**More → Documents Vault → + Add**: a reference record — title, category
(Insurance, Vehicle, Loan, ID, etc.), a reference/policy/account number,
an optional expiry or renewal date, and notes. This is deliberately
**reference info only** — it does not store file attachments, scanned
copies, or passwords; it's for "what's my policy number" not "where's my
policy PDF."

## 15. AI Coach

**More → AI Coach**: needs the same **Gemini API key** you set up for
photo nutrition (see step 17 below — get a free one at
[aistudio.google.com](https://aistudio.google.com) if you haven't already).
Tap **"✨ Get today's insights"** and it reads a summary of your last 30
days — habit completion, spending trend, budget status, debt payoff pace,
average sleep, goal progress, journaling frequency — and asks Gemini for
4–6 short, specific observations, not generic advice. The first insight
also appears on the Dashboard once generated. Nothing is sent anywhere
except Google's Gemini API, directly from your device, using your own key.

## 16. Journal / diary

**Journal** tab (bottom nav): write in the text box, pick a font and color
if you like, then **Save entry** — it saves under whatever date is showing
in the date bar at the top, *not* necessarily today. So if you forgot to
write yesterday: open Journal, type your entry, tap **‹** to move the date
back one day (or type the date directly), then Save — it files correctly
under that date. Entries always export in true chronological (month/date)
order via **Export whole diary**, regardless of what order you wrote them
in. Print, PDF, and Word (.doc) export work per-entry too. Everything syncs
to a `Journal` tab in your Google Sheet.

## 17. Diet & nutrition

1. **Settings → Diet & body stats**: enter height, weight, age, sex,
   activity level and goal (fat loss / maintain / muscle gain), then
   **Save body stats**. The Diet tab uses these to show a personal daily
   calorie and macro target.
2. **More → Diet → + Log meal**: enter a meal manually (name + calories/
   protein/carbs/fat/fiber), or attach/take a photo first.
3. **Optional — photo-based estimates:** get a free API key at
   [aistudio.google.com](https://aistudio.google.com), paste it into
   **Settings → Diet & body stats → Gemini API key**. This same key also
   powers the AI Coach (step 15). With a key saved, attaching a photo
   shows an **"✨ Estimate nutrition from photo"** button. The prompt
   identifies each food item separately, reasons about portion size
   against things visible in the photo (plate size, cutlery, hand size),
   flags likely hidden calories (oil, sauce, sugar) it can't directly see,
   and shows a confidence level plus its assumptions right under the meal
   once saved. It now also suggests the predominant **fat quality**
   (healthy/mixed/unhealthy) and an overall **✅ Healthy / ⚖️ Balanced /
   🍔 Junk-ish** tag — both editable via the "Mostly what kind of fat?"
   picker in the log-meal form for meals entered without a photo.
   Review and adjust before saving either way — it's a much better
   estimate, still not a lab measurement. Without a key, just fill the
   fields in yourself.
4. View totals against your targets by Day/Week/Month — the totals card
   also shows a healthy/balanced/junk count for the period — and export
   the log to Excel or PDF from the Diet tab. Meal nutrition numbers
   (including the fat-quality/meal-tag classification) sync to a `Diet`
   tab in your Google Sheet — the photo itself stays on this device only
   and is never uploaded to the Sheet (a single Sheet cell can't hold an
   image's worth of data; see Troubleshooting if you're on a version
   older than v9.4.1).

## 18. Everyday use

- **Save & Sync** button (top right, always visible) pushes everything to your Google Sheet on demand.
- **Settings → Auto-sync** toggles automatic syncing after every change (small delay, so it doesn't fire on every keystroke).
- **Load from Sheet** (Settings) pulls the last synced snapshot back down — see section 3.
- **Backup** (bottom of Settings) exports/imports a local `.json` file — a second safety net independent of the Sheet.
- **Home / Dashboard** (bottom nav, first tab): your daily score, today's
  numbers across every module, top priorities, and quick-add shortcuts —
  this is the new starting screen.
- **Habits tab** shows what's left **to do** at the top, and anything that's hit its target for the day in a **Completed ✅** section below.
- **Expanding a habit** (tap ⌄): shows a custom-amount box, your quick-add
  preset chips, a **Linked Routine category** picker, and a ▲ button to
  close it again.
- **Quick-log timer** (Routine tab): tap a category chip to start timing it
  now; tap it again (or a different category) to stop and log it.
- **More** tab (bottom nav): organized into Plan (Goals, Calendar, AI
  Coach), Track (Journal, Diet, Health), Money (Debts/EMI, Subscriptions,
  Assets & Net Worth), Review (Trends, Reports, Documents Vault), and
  System (Settings). Every screen opened from More has a **"‹ More"**
  button at the top to get back, all the time.
- **🔍 Search** (header icon, every screen) — see section 9.
- **About** (bottom of Settings) shows the app version, the logo, and credit.

## 19. Troubleshooting checklist
- **Habits not showing on first open** — the app seeds default habits (Drink Water, Read, Walk, No Junk, Sleep) before the very first render, and re-seeds automatically if local storage ever comes back empty or corrupted.
- **Can't see text I'm typing** (habit custom amount, or any field) — inputs force explicit text color and override phone autofill styling.
- **Reminders don't seem to fire** — you must explicitly set a reminder time on each habit (Habit detail → Reminder times). Also confirm the `checkReminders` trigger exists and Telegram is enabled with a valid token/chat ID.
- **Sheet not updating, or Load from Sheet fails** — you likely need to redeploy `apps-script.gs`: **Deploy → Manage deployments → ✏️ edit → New version → Deploy**. See section 3. Tap **Test connection** first — as of v9.4 it will tell you directly if this is the cause (a version-mismatch message).
- **New Goals/Subscriptions/Assets/Health/Documents/Budgets tabs not appearing in the Sheet** — same fix as above: redeploy `apps-script.gs`, then Sync now.
- **Diet photo button or AI Coach won't run** — you need to save a Gemini API key first (Settings → Diet & body stats → Gemini API key); both features share this one key.
- **Marked an EMI paid by mistake** — open Debts/EMI, tap **"↩ Undo payment"** on that loan; don't edit the Finance transaction directly, it won't adjust the balance back.
- **Icon looks wrong or didn't update** — make sure all four icon files were re-uploaded with the same filenames, then remove the app from your home screen and **Add to Home Screen** again; phones only re-read icon files on a fresh install, not a page refresh.
