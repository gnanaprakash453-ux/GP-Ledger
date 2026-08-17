/**
 * GP LEDGER — Google Apps Script backend (v9.5.2)
 * ---------------------------------------------------------------
 * Paste this whole file into script.google.com (Extensions > Apps
 * Script, from a Google Sheet), then deploy as a Web App.
 * Full click-by-click steps are in SETUP_GUIDE.md.
 *
 * v9.5.2 fix — real bug, finally the actual cause of "Sync did not
 *  verify" / "TypeError: sheet.clearContent is not a function":
 *  Apps Script's Sheet class does not have a clearContent() method —
 *  that method only exists on the Range class. The Sheet-level
 *  equivalent is clearContents() (with an "s"). Both writeSheet()
 *  (used for every tab: Habits, Settings, Transactions, Routine,
 *  Debts, Journal, Diet, Goals, Subscriptions, Assets, Health,
 *  Documents, Budgets, RoutineTemplates) and the Data-tab backup write
 *  were calling sheet.clearContent() / dataSheet.clearContent(), which
 *  throws immediately since that method doesn't exist on a Sheet — so
 *  the very first tab written died and the whole sync never verified.
 *  This is unrelated to the v9.5.1 try/catch fix below, which was a
 *  real improvement but didn't touch this line. Both call sites now
 *  correctly call clearContents(). doGet/ping and the Load-from-Sheet
 *  path never called this method, which is why those kept working while
 *  sync didn't.
 *
 * v9.5.1 fix — real bug: "Sync did not verify" / TypeError on
 *  dataSheet.clearContent. The Data-tab backup snapshot was SUPPOSED to
 *  degrade gracefully if anything went wrong writing it (see the v9.4.1
 *  note below) — but getOrCreateSheet('Data') and dataSheet.clearContent()
 *  were both called BEFORE the try/catch that was meant to protect that
 *  section, so if either of those two calls itself threw for any reason,
 *  the entire sync died right there before Habits, Diet, Finance, or any
 *  other tab ever got written. Moved both calls inside the try/catch, so
 *  a problem specific to the Data tab can no longer take every other tab
 *  down with it.
 *
 * v9.5.0 fix — sync speed. Every tab was written with the sheet's own
 *  appendRow() called once per header row + once per data row. Each
 *  appendRow() is a separate round-trip to the Sheets service (it reads
 *  the current last row, then writes) — across 15 tabs and however many
 *  combined habits/transactions/routine blocks/journal entries/etc a
 *  real account accumulates, that easily added up to 100–300+ individual
 *  API calls on every single sync, which is what made it feel slow
 *  (typically several seconds to tens of seconds depending on data size).
 *  Every writer below now builds its sheet as one plain 2D array in
 *  memory (fast — pure JS, no API calls) and writes it in ONE
 *  clearContent()+setValues() pair via the new writeSheet() helper —
 *  so each tab costs ~2 calls total regardless of row count. The Reports
 *  tab is the one deliberate exception (see its comment) since it's
 *  meant to accumulate across syncs, not reflect current state, and was
 *  already a single appendRow per sync, not a loop.
 *  No column layout, tab names, or the rows{} shape returned to the app
 *  changed — this is purely how the same data gets written, so it's a
 *  drop-in replacement: paste, Deploy → Manage deployments → New version.
 *
 * v9.4.1 fix — the real cause of most "Sync did not verify" reports:
 *  - Meal photos are stored client-side as full base64 images. The app now
 *    strips that image field out before sending the sync payload — only the
 *    nutrition numbers (already extracted from the photo) are synced, never
 *    the photo itself. Previously, logging even one meal photo made the
 *    full-snapshot JSON blow past Google Sheets' 50,000-character-per-cell
 *    limit, which threw inside handleSync and made the WHOLE sync look
 *    broken (not just the photo).
 *  - Defense in depth on this side too: the Data tab's full-snapshot write
 *    is now wrapped so that if a payload is ever too large for one cell for
 *    any other reason, it degrades gracefully (skips just that snapshot,
 *    leaves a note explaining why) instead of throwing and failing every
 *    other tab along with it.
 *
 * v9.4 changes from v9.3:
 *  - Added SCRIPT_VERSION, returned from both the ping (doGet) and sync
 *    (handleSync) responses. The app now compares this against the version
 *    it expects and tells you in plain language if your deployed script is
 *    stale — this is what "Sync did not verify" usually means: you pasted
 *    new code but didn't Deploy > Manage deployments > New version > Deploy.
 *  - New RoutineTemplates tab — writes your two editable weekday/weekend
 *    day-plans (and which days use which) so they're backed up to the Sheet
 *    like everything else, not just kept on-device.
 *
 * v9 changes from v8:
 *  - handleSync now also writes six new readable tabs: Goals,
 *    Subscriptions, Assets (net worth), Health (vitals + medicines +
 *    appointments), Documents (vault), and Budgets — mirroring the six
 *    new modules added to the app. The Data tab's JSON snapshot (used
 *    by load/backup) already included these once the client started
 *    sending them.
 *  - Debts tab gained a "Debited From" column and now reflects
 *    per-month paid/unpaid status with the account used, matching the
 *    app's new undo-able EMI payment flow.
 *  - Everything else (doGet/doPost shape, load endpoint, Habits,
 *    Settings, year-wise Transactions, Routine, Journal, Diet,
 *    Reports, reminders, daily quote) is unchanged from v8.
 * ---------------------------------------------------------------
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
// Bump this every time you paste updated code, so the app's "Test connection"
// and sync-failure messages can tell you when a deployment is stale (i.e. you
// edited/pasted new code but forgot Deploy > Manage deployments > New version).
const SCRIPT_VERSION = 'v9.6.1';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'status';
  if (action === 'ping') {
    return jsonOut({ ok: true, source: 'doGet', version: SCRIPT_VERSION, message: 'GP Ledger Apps Script is reachable.' });
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

/** Writes a full rectangular block in ONE call instead of row-by-row.
 * v9.5.0 — this is the fix for slow syncs: the old code called
 * sheet.appendRow() once per header + once per data row, and every
 * appendRow() is its own round-trip to the Sheets service (reads the
 * current last row, then writes) — with 15 tabs and hundreds of combined
 * rows across habits/transactions/routine/journal/etc, that was easily
 * 100–300+ separate API calls per sync, which is what made it feel slow.
 * Building the same data as a plain 2D array in memory (fast, all
 * client-side JS) and writing it with one clearContent() + one
 * setValues() call per sheet cuts that down to ~2 calls per tab
 * regardless of row count — a sync with hundreds of rows now costs the
 * same handful of calls as one with a dozen.
 * `rows2d` must be rectangular (every row the same length) — pad shorter
 * rows with '' before calling this, same as the writers below already do. */
function writeSheet(sheet, rows2d) {
  sheet.clearContents();
  if (!rows2d.length) return;
  sheet.getRange(1, 1, rows2d.length, rows2d[0].length).setValues(rows2d);
}

/** Core sync handler — writes every part of the payload and reports row counts back. */
function handleSync(body) {
  const rows = {};

  // 1) Full JSON snapshot — source of truth / backup
  // v9.4.1: wrapped in try/catch. A single Google Sheets cell caps out at
  // 50,000 characters — if a future payload ever exceeds that for any reason
  // (very large photo, huge history, etc.), this now degrades gracefully
  // (skips just the snapshot, keeps rows.data=0) instead of throwing and
  // failing the ENTIRE sync — which is what used to make "Sync did not
  // verify" show up even though every other tab synced fine.
  // v12.5.1 fix — that protection had a hole: getOrCreateSheet('Data') and
  // dataSheet.clearContent() were both called BEFORE the try block started,
  // so if either of those two calls itself threw (e.g. a transient Sheets
  // API error, a permissions hiccup, a stale/duplicate "Data" tab), the
  // whole handleSync call died right there — before Habits, Diet, Finance,
  // or any other tab ever got written — which is exactly what "TypeError:
  // dataSheet.clearContent is not a function" in the debug log looks like.
  // Everything Data-tab-related now lives inside one try/catch, so a
  // problem specific to this one backup tab can no longer take the rest of
  // the sync down with it.
  let dataSheet = null;
  try {
    dataSheet = getOrCreateSheet('Data');
    dataSheet.clearContents();
    const snapshot = JSON.stringify(body);
    if (snapshot.length > 49000) {
      dataSheet.getRange(1, 1).setValue('Snapshot too large to store in one cell (' + snapshot.length + ' chars) — every other tab below is still up to date. This usually means a meal photo or similar large field slipped into the sync payload.');
      rows.data = 0;
    } else {
      dataSheet.getRange(1, 1, 2, 1).setValues([
        ['Full JSON snapshot (do not edit by hand)'],
        [snapshot]
      ]);
      rows.data = 1;
    }
  } catch (err) {
    try { if (dataSheet) dataSheet.getRange(1, 1).setValue('Snapshot write failed: ' + String(err)); } catch (err2) {}
    rows.data = 0;
  }

  // 2) Readable Habits tab
  const habitsSheet = getOrCreateSheet('Habits');
  const habitRows = [['Name', 'Kind', 'Target', 'Unit', 'Current Streak Info (see Data tab for full history)']];
  (body.habits || []).forEach(h => {
    habitRows.push([h.name, h.kind, h.target, h.unit, '']);
  });
  writeSheet(habitsSheet, habitRows);
  rows.habits = (body.habits || []).length;

  // 3) Settings tab
  const settingsSheet = getOrCreateSheet('Settings');
  const settingsRows = [['Key', 'Value']];
  Object.keys(body.settings || {}).forEach(k => {
    const v = body.settings[k];
    settingsRows.push([k, typeof v === 'object' ? JSON.stringify(v) : v]);
  });
  writeSheet(settingsSheet, settingsRows);
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
    const txRows = [['Date', 'Type', 'Amount', 'Category', 'Note']];
    txByYear[year].forEach(t => {
      txRows.push([t.date, t.type, t.amount, t.category, t.note]);
      txTotal++;
    });
    writeSheet(sheet, txRows);
  });
  rows.transactions = txTotal;

  // 5) Routine tab — always created even if empty, fixes v5 skip bug
  const routineSheet = getOrCreateSheet('Routine');
  const routineRows = [['Date', 'Start', 'End', 'Category', 'Note', 'Minutes']];
  let routineTotal = 0;
  const routineLogs = body.routineLogs || {};
  Object.keys(routineLogs).forEach(date => {
    (routineLogs[date] || []).forEach(b => {
      const mins = durationMinutes(b.start, b.end);
      routineRows.push([date, b.start, b.end, b.cat, b.note || '', mins]);
      routineTotal++;
    });
  });
  writeSheet(routineSheet, routineRows);
  rows.routine = routineTotal;

  // 6) Reports tab — appends a snapshot row if the client sent a "report" extra.
  // Kept as a true append (not writeSheet) since this tab is meant to accumulate
  // history across syncs, unlike every other tab which reflects current state —
  // it's a single appendRow, not a loop, so it was never part of the slowdown.
  const reportsSheet = getOrCreateSheet('Reports');
  if (reportsSheet.getLastRow() === 0) {
    reportsSheet.appendRow(['Saved At', 'Week Start', 'Habit Completion %', 'Net Finance']);
  }
  if (body.extra && body.extra.type === 'report') {
    reportsSheet.appendRow([new Date().toISOString(), body.extra.week, body.extra.avgPct, body.extra.net]);
  }
  rows.reports = reportsSheet.getLastRow() - 1;

  // 7) Debts / EMI tab — now shows per-month paid/unpaid status + debited-from account
  const debtsSheet = getOrCreateSheet('Debts');
  const debtRows = [['Name', 'Balance', 'Monthly EMI', 'Due Day', 'Debited From', 'Status (this sync month)', 'Last Paid Date', 'Notes']];
  const nowYm = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  (body.debts || []).forEach(d => {
    const pm = d.paidMonths && d.paidMonths[nowYm];
    const paid = !!pm;
    const account = (paid && typeof pm === 'object') ? pm.account : (d.debitAccount || '');
    const paidDate = (paid && typeof pm === 'object') ? pm.paidDate : '';
    debtRows.push([d.name, d.balance, d.emiAmount, d.dueDay, account, paid ? 'Paid' : 'Unpaid', paidDate, d.notes || '']);
  });
  writeSheet(debtsSheet, debtRows);
  rows.debts = (body.debts || []).length;

  // 8) Journal tab — one row per calendar date, written in chronological order
  const journalSheet = getOrCreateSheet('Journal');
  const journalRows = [['Date', 'Entry', 'Font', 'Color', 'Last Updated']];
  const journal = body.journal || {};
  const journalDates = Object.keys(journal).sort(); // ISO date keys sort chronologically
  journalDates.forEach(ds => {
    const entry = journal[ds];
    journalRows.push([ds, entry.text || '', entry.font || '', entry.color || '', entry.updated || '']);
  });
  writeSheet(journalSheet, journalRows);
  rows.journal = journalDates.length;

  // 9) Diet tab — one row per logged meal
  const dietSheet = getOrCreateSheet('Diet');
  const dietRows = [['Date', 'Time', 'Meal', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber', 'Fat Quality', 'Meal Tag']];
  const dietMeals = (body.diet && body.diet.meals) || {};
  let dietTotal = 0;
  Object.keys(dietMeals).sort().forEach(ds => {
    (dietMeals[ds] || []).forEach(m => {
      dietRows.push([ds, m.time || '', m.name, m.calories || 0, m.protein || 0, m.carbs || 0, m.fat || 0, m.fiber || 0, m.fatQuality || '', m.mealTag || '']);
      dietTotal++;
    });
  });
  writeSheet(dietSheet, dietRows);
  rows.diet = dietTotal;

  // 10) Goals tab — Current is the resolved progress (matches the Goals
  // screen), sent pre-computed by the client since it's derived on the fly
  // for Debt/Weight/Habit-streak/auto-tracked Savings goals, not stored.
  const goalsSheet = getOrCreateSheet('Goals');
  const goalRows = [['Title', 'Type', 'Target', 'Current/Progress', 'Auto-tracked From', 'Deadline']];
  (body.goals || []).forEach(g => {
    goalRows.push([g.title, g.mode, g.target, g.current !== undefined ? g.current : '', g.autoTrackCategory || '', g.deadline || '']);
  });
  writeSheet(goalsSheet, goalRows);
  rows.goals = (body.goals || []).length;

  // 11) Subscriptions tab
  const subsSheet = getOrCreateSheet('Subscriptions');
  const subsRows = [['Name', 'Amount', 'Cycle', 'Renews', 'Category']];
  (body.subscriptions || []).forEach(s => {
    subsRows.push([s.name, s.amount, s.cycle, s.cycle === 'monthly' ? ('Day ' + s.renewDay) : s.renewDate, s.category || '']);
  });
  writeSheet(subsSheet, subsRows);
  rows.subscriptions = (body.subscriptions || []).length;

  // 12) Assets tab (net worth)
  const assetsSheet = getOrCreateSheet('Assets');
  const assetRows = [['Name', 'Type', 'Value']];
  (body.assets || []).forEach(a => {
    assetRows.push([a.name, a.type, a.value]);
  });
  const totalAssets = (body.assets || []).reduce(function (s, a) { return s + Number(a.value || 0); }, 0);
  const totalLiab = (body.debts || []).reduce(function (s, d) { return s + Number(d.balance || 0); }, 0);
  assetRows.push(['', '', '']);
  assetRows.push(['Net worth (assets − Debts/EMI balances)', '', totalAssets - totalLiab]);
  writeSheet(assetsSheet, assetRows);
  rows.assets = (body.assets || []).length;

  // 13) Health tab — vitals history + medicines
  const healthSheet = getOrCreateSheet('Health');
  const healthRows = [['Date', 'BP', 'Sugar', 'Weight']];
  const vitals = (body.health && body.health.vitals) || {};
  Object.keys(vitals).sort().forEach(ds => {
    const v = vitals[ds];
    healthRows.push([ds, v.bp || '', v.sugar || '', v.weight || '']);
  });
  healthRows.push(['', '', '', '']);
  healthRows.push(['Medicine', 'Dose', 'Times', '']);
  ((body.health && body.health.meds) || []).forEach(m => {
    healthRows.push([m.name, m.dose || '', (m.times || []).join(', '), '']);
  });
  writeSheet(healthSheet, healthRows);
  rows.health = Object.keys(vitals).length;

  // 14) Documents tab (vault — reference info only)
  const docsSheet = getOrCreateSheet('Documents');
  const docRows = [['Title', 'Category', 'Reference', 'Expiry', 'Notes']];
  (body.documents || []).forEach(d => {
    docRows.push([d.title, d.category || '', d.ref || '', d.expiryDate || '', d.notes || '']);
  });
  writeSheet(docsSheet, docRows);
  rows.documents = (body.documents || []).length;

  // 15) Budgets tab
  const budgetsSheet = getOrCreateSheet('Budgets');
  const budgetRows = [['Category', 'Monthly Limit']];
  (body.budgets || []).forEach(b => {
    budgetRows.push([b.category, b.limit]);
  });
  writeSheet(budgetsSheet, budgetRows);
  rows.budgets = (body.budgets || []).length;

  // 16) Routine templates tab — the two editable weekday/weekend day-plans and which days use which
  const tplSheet = getOrCreateSheet('RoutineTemplates');
  const tplRows = [['Plan', 'Applies To (days)', 'Start', 'End', 'Category', 'Note']];
  const rtpl = body.routineTemplates || {};
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayAssign = rtpl.dayAssignment || {};
  let rtplTotal = 0;
  ['weekday', 'weekend'].forEach(key => {
    const tpl = rtpl[key];
    if (!tpl) return;
    const days = Object.keys(dayAssign).filter(d => dayAssign[d] === key).map(d => dayNames[Number(d)]).join(', ');
    (tpl.blocks || []).forEach(b => {
      tplRows.push([tpl.label || key, days, b.start, b.end, b.cat, b.note || '']);
      rtplTotal++;
    });
  });
  writeSheet(tplSheet, tplRows);
  rows.routineTemplates = rtplTotal;

  // 17) Quotes tab — your custom/edited quotes (Settings > Quotes > Manage
  // my quotes), so they survive a phone loss/reinstall even if you're
  // relying on the Sheet as your only backup and never used the separate
  // local JSON export. General = the Home/Habits quote card; the rest are
  // each module's own themed quotes.
  const quotesSheet = getOrCreateSheet('Quotes');
  const quotesRows = [['Category', 'Quote', 'Author']];
  (body.quotes || []).forEach(q => { quotesRows.push(['General (Home & Habits)', q.text, q.author || '']); });
  const moduleQuotes = body.moduleQuotes || {};
  Object.keys(moduleQuotes).forEach(cat => {
    (moduleQuotes[cat] || []).forEach(q => { quotesRows.push([cat, q.text, '']); });
  });
  writeSheet(quotesSheet, quotesRows);
  rows.quotes = quotesRows.length - 1;

  return { ok: true, source: 'handleSync', version: SCRIPT_VERSION, rows: rows, syncedAt: new Date().toISOString() };
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
  const ym = today.slice(0, 7);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const logSheet = getOrCreateSheet('ReminderLog');
  const sentKeys = logSheet.getLastRow() > 0
    ? logSheet.getRange(1, 1, logSheet.getLastRow(), 1).getValues().flat()
    : [];
  const alreadySent = function (key) { return sentKeys.indexOf(key) !== -1; };
  const markSent = function (key) { logSheet.appendRow([key]); sentKeys.push(key); };

  (payload.habits || []).forEach(h => {
    (h.times || []).forEach(t => {
      const [th, tm] = String(t).split(':').map(Number);
      if (isNaN(th) || isNaN(tm)) return;
      const targetMin = th * 60 + tm;
      if (Math.abs(nowMin - targetMin) > 2) return;
      const key = h.id + '_' + today + '_' + t;
      if (alreadySent(key)) return;
      sendTelegram(settings.tgToken, settings.tgChatId, `⏰ Reminder: ${h.name} ${h.icon || ''}`);
      markSent(key);
    });
  });

  // v9.6.1 — Finance/Health/Documents/Goals reminders were local-only
  // (in-app, foreground-only — see index.html checkFinanceReminders /
  // checkHealthReminders / checkDocumentReminders / checkGoalReminders).
  // This mirrors that same logic here so they also reach Telegram when
  // the app is closed, on the SAME 5-minute trigger you already set up —
  // no second trigger needed. Runs once per day per item (checked every
  // 5 minutes, but the ReminderLog key is date-scoped so it only sends
  // once), rather than at a specific time like habits.

  // Finance — EMI due today, not yet marked paid this month
  (payload.debts || []).forEach(d => {
    if (Number(d.dueDay) !== now.getDate()) return;
    const pm = d.paidMonths && d.paidMonths[ym];
    if (pm) return;
    const key = 'debt_' + d.id + '_' + ym;
    if (alreadySent(key)) return;
    sendTelegram(settings.tgToken, settings.tgChatId, `💰 ${d.name} EMI is due today (₹${d.emiAmount || 0})`);
    markSent(key);
  });

  // Finance — subscription renews today
  (payload.subscriptions || []).forEach(s => {
    if (s.cycle !== 'monthly' || Number(s.renewDay) !== now.getDate()) return;
    const key = 'sub_' + s.id + '_' + ym;
    if (alreadySent(key)) return;
    sendTelegram(settings.tgToken, settings.tgChatId, `💰 ${s.name} renews today (₹${s.amount || 0})`);
    markSent(key);
  });

  // Health — appointment today
  ((payload.health && payload.health.appts) || []).forEach(a => {
    if (a.date !== today) return;
    const key = 'health_' + a.id + '_' + today;
    if (alreadySent(key)) return;
    sendTelegram(settings.tgToken, settings.tgChatId, `🩺 ${a.title} today${a.notes ? ' — ' + a.notes : ''}`);
    markSent(key);
  });

  // Documents — expiring within 7 days (fires once, the first day it enters that window)
  (payload.documents || []).forEach(d => {
    if (!d.expiryDate) return;
    const daysLeft = Math.round((new Date(d.expiryDate) - new Date(today)) / 86400000);
    if (daysLeft < 0 || daysLeft > 7) return;
    const key = 'doc_' + d.id + '_' + today;
    if (alreadySent(key)) return;
    const when = daysLeft === 0 ? 'expires today' : ('expires in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's'));
    sendTelegram(settings.tgToken, settings.tgChatId, `🗂️ ${d.title} ${when}`);
    markSent(key);
  });

  // Goals — deadline is today. Kept simple on purpose: sends a same-day
  // nudge regardless of whether the goal is already met (unlike the
  // in-app popup, which only fires if it isn't) — replicating the exact
  // Debt/Weight/Habit-streak progress math here would duplicate a lot of
  // client-side logic for one extra condition. A deadline-day ping either
  // way is still useful.
  (payload.goals || []).forEach(g => {
    if (!g.deadline || g.deadline !== today) return;
    const key = 'goal_' + g.id + '_' + today;
    if (alreadySent(key)) return;
    sendTelegram(settings.tgToken, settings.tgChatId, `🎯 "${g.title}" deadline is today`);
    markSent(key);
  });
}

/**
 * Daily quote to Telegram — set up as a SECOND time-driven trigger:
 * sendDailyQuote > Time-driven > Day timer > between 12:00am and 1:00am.
 * Uses the same quote bank and date-index logic as the app itself, so
 * the quote texted at midnight always matches the one shown in-app that day.
 */
const QUOTES = [
  ["It always seems impossible until it's done.", "Nelson Mandela"],
  ["The way to get started is to quit talking and begin doing.", "Walt Disney"],
  ["In the middle of difficulty lies opportunity.", "Albert Einstein"],
  ["The only way to do great work is to love what you do.", "Steve Jobs"],
  ["Simplicity is the ultimate sophistication.", "Leonardo da Vinci"],
  ["He who has a why to live can bear almost any how.", "Friedrich Nietzsche"],
  ["The journey of a thousand miles begins with a single step.", "Lao Tzu"],
  ["What we think, we become.", "Buddha"],
  ["The best way out is always through.", "Robert Frost"],
  ["Do not go where the path may lead, go instead where there is no path and leave a trail.", "Ralph Waldo Emerson"],
  ["Whether you think you can, or you think you can't — you're right.", "Henry Ford"],
  ["The best time to plant a tree was twenty years ago. The second best time is now.", "Chinese Proverb"],
  ["Happiness is not something ready made. It comes from your own actions.", "Dalai Lama"],
  ["Believe you can and you're halfway there.", "Theodore Roosevelt"],
  ["It does not matter how slowly you go as long as you do not stop.", "Confucius"],
  ["Success is not final, failure is not fatal: it is the courage to continue that counts.", "Winston Churchill"],
  ["The two most important days in your life are the day you are born, and the day you find out why.", "Mark Twain"],
  ["Try not to become a person of success, but rather try to become a person of value.", "Albert Einstein"],
  ["I have not failed. I've just found ten thousand ways that won't work.", "Thomas Edison"],
  ["If you want to lift yourself up, lift up someone else.", "Booker T. Washington"],
  ["The greatest glory in living lies not in never falling, but in rising every time we fall.", "Nelson Mandela"],
  ["You must be the change you wish to see in the world.", "Mahatma Gandhi"],
  ["Life is really simple, but we insist on making it complicated.", "Confucius"],
  ["Keep your face always toward the sunshine, and shadows will fall behind you.", "Walt Whitman"],
  ["The only true wisdom is in knowing you know nothing.", "Socrates"],
  ["What lies behind us and what lies before us are tiny matters compared to what lies within us.", "Ralph Waldo Emerson"],
  ["The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"],
  ["Genius is one percent inspiration and ninety-nine percent perspiration.", "Thomas Edison"],
  ["The purpose of our lives is to be happy.", "Dalai Lama"],
  ["Life is ten percent what happens to us and ninety percent how we react to it.", "Charles R. Swindoll"],
  ["The mind that opens to a new idea never returns to its original size.", "Albert Einstein"],
  ["Courage is not the absence of fear, but the triumph over it.", "Nelson Mandela"],
  ["You miss one hundred percent of the shots you don't take.", "Wayne Gretzky"],
  ["Whatever you are, be a good one.", "Abraham Lincoln"],
  ["The only person you are destined to become is the person you decide to be.", "Ralph Waldo Emerson"],
  ["Act as if what you do makes a difference. It does.", "William James"],
  ["Nothing is impossible. The word itself says 'I'm possible.'", "Audrey Hepburn"],
  ["You are never too old to set another goal or to dream a new dream.", "C. S. Lewis"],
  ["Do what you can, with what you have, where you are.", "Theodore Roosevelt"],
  ["The only limit to our realization of tomorrow will be our doubts of today.", "Franklin D. Roosevelt"],
  ["Everything has beauty, but not everyone can see it.", "Confucius"],
  ["Twenty years from now you will be more disappointed by the things you didn't do than by the ones you did do.", "Mark Twain"],
  ["The only way to have a friend is to be one.", "Ralph Waldo Emerson"],
  ["Life shrinks or expands in proportion to one's courage.", "Anaïs Nin"],
  ["Perfection is not attainable, but if we chase perfection we can catch excellence.", "Vince Lombardi"],
  ["You can't use up creativity. The more you use, the more you have.", "Maya Angelou"],
  ["Fall seven times, stand up eight.", "Japanese Proverb"],
  ["Not everything that is faced can be changed, but nothing can be changed until it is faced.", "James Baldwin"],
  ["There is only one way to avoid criticism: do nothing, say nothing, and be nothing.", "Aristotle"],
  ["To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", "Ralph Waldo Emerson"],
  ["Turn your wounds into wisdom.", "Oprah Winfrey"],
  ["A person who never made a mistake never tried anything new.", "Albert Einstein"],
  ["Gratitude turns what we have into enough.", "Anonymous"],
  ["Patience is not the ability to wait, but the ability to keep a good attitude while waiting.", "Joyce Meyer"],
  ["The quieter you become, the more you are able to hear.", "Rumi"],
  ["Kindness is a language which the deaf can hear and the blind can see.", "Mark Twain"],
  ["Knowing yourself is the beginning of all wisdom.", "Aristotle"],
  ["We are what we repeatedly do. Excellence, then, is not an act but a habit.", "Aristotle"],
  ["The secret of getting ahead is getting started.", "Mark Twain"],
  ["What gets measured gets managed.", "Peter Drucker"],
  ["Small steps every day beat big leaps once in a while.", "GP Ledger"],
  ["Discipline is choosing what you want most over what you want now.", "GP Ledger"],
  ["Your habits decide your future self — vote wisely today.", "GP Ledger"],
  ["Progress, not perfection.", "GP Ledger"],
  ["Every tick on this app is a promise kept to yourself.", "GP Ledger"],
  ["Track it, don't judge it. Awareness comes before change.", "GP Ledger"],
  ["Money habits are just habits — small saves compound quietly.", "GP Ledger"],
  ["Show up for yourself today, even in a small way.", "GP Ledger"],
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

  // v9.6.0 — quotes became user-editable in-app back in v12.6 (Settings >
  // Quotes > Manage my quotes), but this always ignored that and sent
  // from the hardcoded list below on a fixed daily formula. Now it uses
  // your own synced quote list, at the same rotation position the app is
  // currently showing (payload.settings.quoteRotIdx, synced every Sync
  // now) — so the midnight text actually matches what you see in-app.
  // Falls back to the old hardcoded list only if a sync from before this
  // version hasn't sent quotes yet.
  const userQuotes = payload.quotes;
  let text, author;
  if (Array.isArray(userQuotes) && userQuotes.length) {
    let idx = Number(settings.quoteRotIdx);
    if (isNaN(idx) || idx < 0 || idx >= userQuotes.length) {
      idx = ((dayIndex % userQuotes.length) + userQuotes.length) % userQuotes.length;
    }
    text = userQuotes[idx].text; author = userQuotes[idx].author || 'GP Ledger';
  } else {
    const idx = ((dayIndex % QUOTES.length) + QUOTES.length) % QUOTES.length;
    text = QUOTES[idx][0]; author = QUOTES[idx][1];
  }
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
