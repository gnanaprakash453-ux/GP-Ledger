# Changelog — v6 → v7

## Fixed
- **"+" button stuck / blocking a habit row.** The floating add button was
  `position:absolute` *inside* the scrolling habit list, so as you scrolled it
  drifted along with the content instead of staying pinned to the corner of
  the screen, landing on top of a habit row and blocking taps. It's now
  `position:fixed`, so it always stays exactly where it visually belongs,
  on every screen.
- **Invisible white-on-white text.** Native date/time pickers and dropdowns
  were rendering with the phone's light-mode colors on top of this app's dark
  background. Added `color-scheme: dark` globally, which tells the browser to
  draw those native controls (and their text) in dark mode to match.
- **Reports tab looked frozen / out of date.** (Carried a fix forward: report
  rendering is triggered on every relevant data change, not just on tab
  switch — confirmed still correct in this pass.)
- **Habit reminders didn't actually do anything.** There was no way to *set*
  a reminder time on a habit in v6, even though the Telegram wiring existed —
  the actual point of connecting Telegram had no path to trigger it. Reminder
  times are now editable per-habit (tap ⌄ on a habit → Reminder times), and:
  - **In-app:** a reminder now pops up as a proper modal (not just a toast),
    with a one-tap "log it now" button, plus a browser notification if
    permission is granted.
  - **Server-side (Telegram, works with the app closed):** `checkReminders()`
    in `apps-script.gs` no longer depends on the client's snapshot to avoid
    duplicates (which could go stale) — it now keeps its own `ReminderLog`
    sheet, and matches within a ±2 minute window so a 5-minute trigger can't
    miss an exact time.

## Added
- **Quick-log timer for Routine (not just Sleep).** A new "Quick log" row of
  category chips on the Routine tab — tap a category to start timing it, tap
  it again (or a different one) to stop and log it, so any minutes of your
  day can be captured in two taps instead of only Sleep having a shortcut.
- **Customizable quick-add amounts per habit.** Inside a habit's detail view:
  edit the +/− step size, and set your own one-tap preset chips (e.g. Water:
  250 / 500 / 1000 / 2000 ml) so a big log doesn't take many taps.
- **Habit list behaviour, now configurable in Settings:**
  - Auto-minimize: expanding one habit collapses any other that was open, and
    tapping anywhere outside an expanded habit closes it. A dedicated
    minimize (▲) button also sits inside the expanded area. All of this can
    be turned off in Settings → Habit list behaviour if you'd rather manage
    multiple open habits yourself.
  - Undo toasts moved to the **top** of the screen, and can be turned off
    entirely in the same settings group.
- **Daily Quote → Telegram at 12 AM.** A new Settings toggle
  ("Send Daily Quote at 12 AM") plus a `sendDailyQuote()` function in
  `apps-script.gs` that you wire up as a second daily trigger — it sends the
  same quote (with its real author, or "GP Ledger" for the app's own lines)
  that's shown in-app that day, so the two never disagree.
- **Icon font now matches your chosen heading font.** The downloadable icon
  PNGs were hardcoded to Poppins regardless of your font settings; they now
  use whatever heading font you've picked in Settings → Theme & Fonts, and
  wait for the web font to finish loading before drawing, so the letter
  actually renders in the right typeface instead of silently falling back.
- **About screen.** Settings → About now opens a real modal: app name,
  version, a short description, and **"Built by Gnanaprakash Xavier."**

## Known limitations (unchanged from v6 unless noted)
1. Google Sheet remains a mirror/backup, not real-time multi-device sync.
2. Custom home-screen icon still needs a manual file swap + reinstall — an
   OS-level limitation no web app can bypass.
3. Apps Script still requires a "New version" deployment after any code
   change (this trips people up — see the SETUP_GUIDE troubleshooting section).
4. The new quick-log timer is single-slot: starting a new category
   automatically stops and logs whatever was previously running, rather than
   tracking several simultaneous timers.
