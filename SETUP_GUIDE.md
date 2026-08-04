# GP Ledger — Setup Guide (v8)

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
10. Tap **Sync now**. Open your Google Sheet — you should now see tabs: `Data`, `Habits`, `Settings`, `Transactions_<year>`, `Routine`, `Reports`, `Debts`, `Journal`, `Diet`.

> **Already on v7 and just adding v8?** You still need to redo step 3.3 —
> paste in the *new* `apps-script.gs` — and step 5's **Deploy → Manage
> deployments → ✏️ edit → New version → Deploy**. Saving alone does not
> publish code changes to your live `/exec` URL (see the troubleshooting
> note below). Without this, the new **Load from Sheet** button and the
> `Debts`/`Journal`/`Diet` sheet tabs won't work.

### If sync ever stops updating the sheet correctly
This was the exact bug fixed in v6. The app now checks that the response
really came from the sync handler (not a generic/error page), and shows a
**debug log** in Settings if it didn't. The most common causes, in order:
1. **You edited the script but didn't redeploy.** Apps Script's "Save" does *not*
   republish the live `/exec` URL. You must go **Deploy → Manage deployments →
   ✏️ edit → New version → Deploy** every time you change `apps-script.gs`.
2. **Wrong URL** — make sure it's the `/exec` URL, not `/dev`.
3. **Permissions revoked** — re-run step 6 if Google ever asks you to re-authorize.

### Pulling data back down (Load from Sheet)
Settings → Google Sheet database → **"⬇ Load from Sheet"** fetches the last
snapshot saved to the `Data` tab and replaces everything currently on this
device — habits, transactions, routine logs, debts, journal, diet, settings.
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

## 5. Customize the app icon

The app ships with a default **"G"** icon. To change it:
1. **Settings → App Icon** — type a new letter/emoji and pick two colors. This updates the **in-app badge** immediately (top-left of the header).
2. To actually change the **real home-screen icon**, tap **"Download my icon files"** — this generates and downloads `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, and `apple-touch-icon.png` matching your chosen letter/colors.
3. Replace those four files in your hosting (re-upload to GitHub/Netlify/etc. with the same filenames).
4. Remove the app from your home screen and **Add to Home Screen** again — phones only re-read icon files on a fresh install, not a page refresh.

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

## 7. Debts / EMI tracking

**More → Debts/EMI → + Add**: enter the loan name, current balance,
monthly EMI amount, and the due day of the month (1–31). Loans past their
due day and not yet marked paid that month show an **Overdue** badge.
Tapping **"Mark this month paid"** reduces the balance by the EMI amount
and creates a matching Finance transaction (category "EMI/Loan") in one
step, so Finance and Debts stay in sync without entering the payment twice.

## 8. Journal / diary

**Journal** tab (bottom nav): write in the text box, pick a font and color
if you like, then **Save entry** — it saves under whatever date is showing
in the date bar at the top, *not* necessarily today. So if you forgot to
write yesterday: open Journal, type your entry, tap **‹** to move the date
back one day (or type the date directly), then Save — it files correctly
under that date. Entries always export in true chronological (month/date)
order via **Export whole diary**, regardless of what order you wrote them
in. Print, PDF, and Word (.doc) export work per-entry too. Everything syncs
to a `Journal` tab in your Google Sheet.

## 9. Diet & nutrition

1. **Settings → Diet & body stats**: enter height, weight, age, sex,
   activity level and goal (fat loss / maintain / muscle gain), then
   **Save body stats**. The Diet tab uses these to show a personal daily
   calorie and macro target.
2. **More → Diet → + Log meal**: enter a meal manually (name + calories/
   protein/carbs/fat/fiber), or attach/take a photo first.
3. **Optional — photo-based estimates:** get a free API key at
   [aistudio.google.com](https://aistudio.google.com), paste it into
   **Settings → Diet & body stats → Gemini API key**. With a key saved,
   attaching a photo shows an **"✨ Estimate nutrition from photo"**
   button that fills in the fields for you — review and adjust before
   saving, since it's an estimate, not a lab measurement. Without a key,
   just fill the fields in yourself; everything else works the same.
4. View totals against your targets by Day/Week/Month, and export the log
   to Excel or PDF from the Diet tab. Meals also sync to a `Diet` tab in
   your Google Sheet.

## 10. Everyday use

- **Save & Sync** button (top right, always visible) pushes everything to your Google Sheet on demand.
- **Settings → Auto-sync** toggles automatic syncing after every change (small delay, so it doesn't fire on every keystroke).
- **Load from Sheet** (Settings) pulls the last synced snapshot back down — see section 3.
- **Backup** (bottom of Settings) exports/imports a local `.json` file — a second safety net independent of the Sheet.
- **Habits tab** now shows what's left **to do** at the top, and anything that's hit its target for the day in a **Completed ✅** section below.
- **Expanding a habit** (tap ⌄): shows a custom-amount box, your quick-add
  preset chips, a **Linked Routine category** picker, and a ▲ button to
  close it again.
- **Quick-log timer** (Routine tab): tap a category chip to start timing it
  now; tap it again (or a different category) to stop and log it.
- **More** tab (bottom nav): Trends, Reports, Debts/EMI, Diet, and Settings
  all live here to keep the main nav bar uncluttered.
- **About** (bottom of Settings) shows the app version and credit.

## 11. Troubleshooting checklist
- **Habits not showing on first open** — the app seeds default habits (Drink Water, Read, Walk, No Junk, Sleep) before the very first render, and re-seeds automatically if local storage ever comes back empty or corrupted.
- **Can't see text I'm typing** (habit custom amount, or any field) — fixed in v8: inputs now force explicit text color and override phone autofill styling.
- **Reminders don't seem to fire** — you must explicitly set a reminder time on each habit (Habit detail → Reminder times). Also confirm the `checkReminders` trigger exists and Telegram is enabled with a valid token/chat ID.
- **Sheet not updating, or Load from Sheet fails** — you likely need to redeploy `apps-script.gs`: **Deploy → Manage deployments → ✏️ edit → New version → Deploy**. See section 3.
- **Diet photo button doesn't appear** — you need to save a Gemini API key first (Settings → Diet & body stats); without one, log meals manually.
- **Icon won't change** — see section 5; the real fix is downloading fresh files and doing a clean reinstall, not just editing in-app.
