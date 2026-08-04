/**
 * GP LEDGER — Google Apps Script backend (v8)
 * ---------------------------------------------------------------
 * Paste this whole file into script.google.com (Extensions > Apps
 * Script, from a Google Sheet), then deploy as a Web App.
 * Full click-by-click steps are in SETUP_GUIDE.md.
 *
 * v8 changes from v7:
 *  - doGet now supports action=load, which returns the last-synced
 *    full JSON snapshot from the Data tab — this is what the app's
 *    Settings → "Load from Sheet" button calls to pull data back
 *    down onto a device (e.g. after a reinstall, or a second phone).
 *  - handleSync now also writes three new readable tabs: Debts
 *    (loan name/balance/EMI/due day), Journal (one row per calendar
 *    date, in chronological order), and Diet (one row per logged
 *    meal). The Data tab's JSON snapshot (used by load/backup) already
 *    included these once the client started sending them.
 *  - Everything else (sync verification response shape, Routine tab,
 *    year-wise transactions, reminders, daily quote) is unchanged from v7.
 * ---------------------------------------------------------------
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'status';
  if (action === 'ping') {
    return jsonOut({ ok: true, source: 'doGet', message: 'GP Ledger Apps Script is reachable.' });
  }
  if (action === 'load') {
    return jsonOut(handleLoad());
  }
  return jsonOut({ ok: true, source: 'doGet', message: 'GP Ledger backend is live. Use POST for sync.' });
}

/** Returns the last full snapshot saved to the Data tab, for the app's "Load from Sheet" button. */
function handleLoad() {
  const dataSheet = SS.getSheetByName('Data');
  if (!dataSheet) return { ok: false, source: 'doGet', error: 'No data has been synced to this Sheet yet.' };
  const raw = dataSheet.getRange(2, 1).getValue();
  if (!raw) return { ok: false, source: 'doGet', error: 'Data tab is empty — sync from the app at least once first.' };
  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return { ok: false, source: 'doGet', error: 'Stored snapshot is not valid JSON.' }; }
  return { ok: true, source: 'doGet', data: payload };
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'sync';
    if (action === 'sync') {
      return jsonOut(handleSync(body));
    }
    return jsonOut({ ok: false, source: 'doPost', error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, source: 'doPost', error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Core sync handler — writes every part of the payload and reports row counts back. */
function handleSync(body) {
  const rows = {};

  // 1) Full JSON snapshot — source of truth / backup
  const dataSheet = getOrCreateSheet('Data');
  dataSheet.clear();
  dataSheet.getRange(1, 1).setValue('Full JSON snapshot (do not edit by hand)');
  dataSheet.getRange(2, 1).setValue(JSON.stringify(body));
  rows.data = 1;

  // 2) Readable Habits tab
  const habitsSheet = getOrCreateSheet('Habits');
  habitsSheet.clear();
  habitsSheet.appendRow(['Name', 'Kind', 'Target', 'Unit', 'Current Streak Info (see Data tab for full history)']);
  (body.habits || []).forEach(h => {
    habitsSheet.appendRow([h.name, h.kind, h.target, h.unit, '']);
  });
  rows.habits = (body.habits || []).length;

  // 3) Settings tab
  const settingsSheet = getOrCreateSheet('Settings');
  settingsSheet.clear();
  settingsSheet.appendRow(['Key', 'Value']);
  Object.keys(body.settings || {}).forEach(k => {
    const v = body.settings[k];
    settingsSheet.appendRow([k, typeof v === 'object' ? JSON.stringify(v) : v]);
  });
  rows.settings = Object.keys(body.settings || {}).length;

  // 4) Year-wise Transactions tabs
  const txByYear = {};
  (body.transactions || []).forEach(t => {
    const year = (t.date || '').slice(0, 4) || 'unknown';
    if (!txByYear[year]) txByYear[year] = [];
    txByYear[year].push(t);
  });
  let txTotal = 0;
  Object.keys(txByYear).forEach(year => {
    const sheet = getOrCreateSheet('Transactions_' + year);
    sheet.clear();
    sheet.appendRow(['Date', 'Type', 'Amount', 'Category', 'Note']);
    txByYear[year].forEach(t => {
      sheet.appendRow([t.date, t.type, t.amount, t.category, t.note]);
      txTotal++;
    });
  });
  rows.transactions = txTotal;

  // 5) Routine tab — always created even if empty, fixes v5 skip bug
  const routineSheet = getOrCreateSheet('Routine');
  routineSheet.clear();
  routineSheet.appendRow(['Date', 'Start', 'End', 'Category', 'Note', 'Minutes']);
  let routineTotal = 0;
  const routineLogs = body.routineLogs || {};
  Object.keys(routineLogs).forEach(date => {
    (routineLogs[date] || []).forEach(b => {
      const mins = durationMinutes(b.start, b.end);
      routineSheet.appendRow([date, b.start, b.end, b.cat, b.note || '', mins]);
      routineTotal++;
    });
  });
  rows.routine = routineTotal;

  // 6) Reports tab — appends a snapshot row if the client sent a "report" extra
  const reportsSheet = getOrCreateSheet('Reports');
  if (reportsSheet.getLastRow() === 0) {
    reportsSheet.appendRow(['Saved At', 'Week Start', 'Habit Completion %', 'Net Finance']);
  }
  if (body.extra && body.extra.type === 'report') {
    reportsSheet.appendRow([new Date().toISOString(), body.extra.week, body.extra.avgPct, body.extra.net]);
  }
  rows.reports = reportsSheet.getLastRow() - 1;

  // 7) Debts / EMI tab
  const debtsSheet = getOrCreateSheet('Debts');
  debtsSheet.clear();
  debtsSheet.appendRow(['Name', 'Balance', 'Monthly EMI', 'Due Day', 'Notes']);
  (body.debts || []).forEach(d => {
    debtsSheet.appendRow([d.name, d.balance, d.emiAmount, d.dueDay, d.notes || '']);
  });
  rows.debts = (body.debts || []).length;

  // 8) Journal tab — one row per calendar date, written in chronological order
  const journalSheet = getOrCreateSheet('Journal');
  journalSheet.clear();
  journalSheet.appendRow(['Date', 'Entry', 'Font', 'Color', 'Last Updated']);
  const journal = body.journal || {};
  const journalDates = Object.keys(journal).sort(); // ISO date keys sort chronologically
  journalDates.forEach(ds => {
    const entry = journal[ds];
    journalSheet.appendRow([ds, entry.text || '', entry.font || '', entry.color || '', entry.updated || '']);
  });
  rows.journal = journalDates.length;

  // 9) Diet tab — one row per logged meal
  const dietSheet = getOrCreateSheet('Diet');
  dietSheet.clear();
  dietSheet.appendRow(['Date', 'Time', 'Meal', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber']);
  const dietMeals = (body.diet && body.diet.meals) || {};
  let dietTotal = 0;
  Object.keys(dietMeals).sort().forEach(ds => {
    (dietMeals[ds] || []).forEach(m => {
      dietSheet.appendRow([ds, m.time || '', m.name, m.calories || 0, m.protein || 0, m.carbs || 0, m.fat || 0, m.fiber || 0]);
      dietTotal++;
    });
  });
  rows.diet = dietTotal;

  return { ok: true, source: 'handleSync', rows: rows, syncedAt: new Date().toISOString() };
}

function durationMinutes(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let s = sh * 60 + sm, e = eh * 60 + em;
  if (e <= s) e += 1440;
  return e - s;
}

function getOrCreateSheet(name) {
  let sheet = SS.getSheetByName(name);
  if (!sheet) sheet = SS.insertSheet(name);
  return sheet;
}

/**
 * Background reminder trigger — the actual "alarm" behind the Telegram link.
 * Set this up as a time-driven trigger (every 5 minutes) from the
 * Apps Script editor: Triggers (clock icon) > Add Trigger >
 * checkReminders > Time-driven > Minutes timer > Every 5 minutes.
 *
 * Reads habit reminder times from the Data tab's JSON snapshot and
 * Telegram settings from the Settings tab. Sends a Telegram message for
 * any habit whose reminder time falls within +/-2 minutes of "now" (so
 * a 5-minute trigger that doesn't land on an exact clock minute still
 * catches it), and dedupes using its own ReminderLog sheet — not the
 * client's snapshot, which can go stale between syncs.
 */
function checkReminders() {
  const dataSheet = SS.getSheetByName('Data');
  if (!dataSheet) return;
  const raw = dataSheet.getRange(2, 1).getValue();
  if (!raw) return;
  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return; }

  const settings = payload.settings || {};
  if (!settings.tgEnabled || !settings.tgToken || !settings.tgChatId) return;

  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const logSheet = getOrCreateSheet('ReminderLog');
  const sentKeys = logSheet.getLastRow() > 0
    ? logSheet.getRange(1, 1, logSheet.getLastRow(), 1).getValues().flat()
    : [];

  (payload.habits || []).forEach(h => {
    (h.times || []).forEach(t => {
      const [th, tm] = String(t).split(':').map(Number);
      if (isNaN(th) || isNaN(tm)) return;
      const targetMin = th * 60 + tm;
      if (Math.abs(nowMin - targetMin) > 2) return;
      const key = h.id + '_' + today + '_' + t;
      if (sentKeys.indexOf(key) !== -1) return;
      sendTelegram(settings.tgToken, settings.tgChatId, `⏰ Reminder: ${h.name} ${h.icon || ''}`);
      logSheet.appendRow([key]);
    });
  });
}

/**
 * Daily quote to Telegram — set up as a SECOND time-driven trigger:
 * sendDailyQuote > Time-driven > Day timer > between 12:00am and 1:00am.
 * Uses the same quote bank and date-index logic as the app itself, so
 * the quote texted at midnight always matches the one shown in-app that day.
 */
const QUOTES = [
  ["Small steps every day beat big leaps once in a while.", "GP Ledger"],
  ["Discipline is choosing what you want most over what you want now.", "GP Ledger"],
  ["Your habits decide your future self — vote wisely today.", "GP Ledger"],
  ["Progress, not perfection.", "GP Ledger"],
  ["The best time to start was yesterday. The next best time is now.", "GP Ledger"],
  ["You don't have to be extreme, just consistent.", "GP Ledger"],
  ["Every tick on this app is a promise kept to yourself.", "GP Ledger"],
  ["A little water, a little walk, a little less scrolling — it adds up.", "GP Ledger"],
  ["Track it, don't judge it. Awareness comes before change.", "GP Ledger"],
  ["Rest is productive too — sleep is a habit, not a luxury.", "GP Ledger"],
  ["Money habits are just habits — small saves compound quietly.", "GP Ledger"],
  ["Show up for yourself today, even in a small way.", "GP Ledger"],
  ["What gets measured gets managed.", "Peter Drucker"],
  ["We are what we repeatedly do. Excellence, then, is not an act but a habit.", "Aristotle"],
  ["The secret of getting ahead is getting started.", "Mark Twain"],
];
function sendDailyQuote() {
  const dataSheet = SS.getSheetByName('Data');
  if (!dataSheet) return;
  const raw = dataSheet.getRange(2, 1).getValue();
  if (!raw) return;
  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return; }
  const settings = payload.settings || {};
  if (!settings.quoteToTg || !settings.tgEnabled || !settings.tgToken || !settings.tgChatId) return;

  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const epoch = new Date('2020-01-01T00:00:00');
  const dayIndex = Math.floor((new Date(todayStr + 'T00:00:00') - epoch) / 86400000);
  const idx = ((dayIndex % QUOTES.length) + QUOTES.length) % QUOTES.length;
  const [text, author] = QUOTES[idx];
  sendTelegram(settings.tgToken, settings.tgChatId, `🌅 Quote of the day\n\n"${text}"\n— ${author}\n\nGP Ledger`);
}

function sendTelegram(token, chatId, text) {
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text }),
    muteHttpExceptions: true
  });
}
