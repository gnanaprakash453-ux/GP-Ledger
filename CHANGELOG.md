# Changelog — v15.10.5 (apps-script.gs — Journal sheet tab was writing blank rows for every entry; fixed) → history below

## v15.10.5

**Journal — the `Journal` tab in your Google Sheet has been writing
blank rows since multi-entries-per-day shipped.**
Requested as part of a "rebuild the Journal module" ask — inspected the
full module first (data model, storage, backup/sync, everything that
reads `S.journal`) rather than rewriting blind. The actual architecture
turned out sound: stable per-entry IDs, one canonical
`buildBackupSnapshot_()`/`restoreBackupSnapshot_()` pair already used
everywhere (Save & Sync, Export Backup, Load from Sheet, Import
Backup), a working migration for the old pre-array shape. No rebuild
needed there.

One real bug did turn up, in `apps-script.gs`'s Journal tab writer —
separate from the `Data` tab that actually backs "Load from Sheet"/
"Import Backup". It read `journal[ds]` (an *array* of entries, since
index.html v12.0.7) as if it were a single entry object
(`entry.text`/`.font`/`.color`/`.updated`) and wrote one row per DATE.
Since a plain array has none of those properties, every field but the
date came out blank — the tab has looked empty/broken since multi-
entry days shipped, even though nothing was actually lost (the `Data`
tab's full JSON snapshot was never affected).

Fixed: now iterates each date's entry array and writes one row **per
entry**, including the entry's own stable id, `created`, and `updated`
timestamps so a Sheet row can be matched back to its exact entry. Also
tolerates the older single-entry-per-date shape defensively, same as
the client's own `normalizeJournal()`.

`apps-script.gs` must be redeployed (Deploy → Manage deployments → ✏️
→ New version → Deploy) for this to take effect — the version check in
Settings will flag a mismatch until then.

---

## v15.10.4

**Journal — keyboard still blocking/covering the editor after v15.10.3.**
v15.10.3 fixed *where* the app scrolled to on focus, but the keyboard
was still covering that destination on some devices. Root cause: `#app`
only shrinks to the real, keyboard-shrunk viewport height (`--vvh`)
while `body.kb-open` is set — and that class is added by the very same
focusin handler that also has to add it before the keyboard's own open
animation finishes and the browser paints. Miss that timing on a given
device/keyboard speed and `#app` keeps its full pre-keyboard height for
a beat — content that should have moved up to clear the keyboard
doesn't, and the keyboard simply sits on top of the editor. Confirmed
against an older build of this app (predating the diary redesign) that
never had this problem: it applied `--vvh` unconditionally rather than
gating it behind a class, with `100dvh` only as the fallback before the
first measurement lands.

Fix: `#app` now does the same — `height:var(--vvh, 100dvh)` applies at
all times, not just while `kb-open`. This trades away the one thing the
v14.4.8 gate was protecting against (a one-frame flash if Safari's own
URL-bar chrome collapses at the exact same instant — `--vvh` is one JS
tick behind native `dvh` for that single frame) in exchange for the
keyboard never being able to outrace the layout again. `body.kb-open`
itself is unchanged and still drives everything else that was already
working (hiding the bottom nav/FAB, repositioning the back button,
Journal's extra keyboard scroll-room padding).

---

## v15.10.3

**Journal — editor still cut off / half-blocked by the keyboard, even after v15.10.2.**
Real bug, finally isolated: when the journal textarea is focused, the
code scrolled `#screen-journal` to `top:0` on the assumption that the
diary page (date heading + toolbar + textarea) sits right at the top
of that container. It doesn't — `#journalMotivationCard` (the hero
photo/quote card) renders above it. So `top:0` was surfacing the photo
card instead, pushing the toolbar, date heading, and the textarea
itself down past the bottom of the now keyboard-shrunk viewport — with
no further scroll ever offered, since the code believed it had already
arrived. That's exactly the reported symptom: the editor visible only
as far as the date heading, then blocked/cut off by the keyboard, with
no way to scroll further to reach the actual writing area.

Fix: scroll to `#diaryPage`'s own measured offset instead of a
hardcoded `0`. This lands the toolbar (Save + Customize included),
date heading, and textarea at the top of the screen together — same
intent as the original v15.9.6 fix, just measured rather than assumed,
so it stays correct regardless of how much (or little) renders above
the diary page. Nothing else about the editor changed — same paper
page, same fonts/colors, same Save/Customize/export controls, same
scrollable `.screen` — only the destination of the auto-scroll.

---

## v15.10.2

**Journal — editor cut off / stuck by the on-screen keyboard.**
> Correction after shipping: this was first suspected to be a
> standalone-iOS-PWA-only quirk (based on an early report that it
> didn't happen in Safari) — turned out to also happen in Safari, so
> that framing was wrong. The fixes below were never actually gated to
> any one platform though (nothing here checks `navigator.standalone`
> or similar), so they apply identically everywhere `kb-open` fires —
> no code change needed for the correction, just this note.

The underlying mechanism: the keyboard can cover the bottom of the
screen (the diary textarea) without the page ever getting shorter in a
way the layout reacts to — so there's nothing to scroll *to* that
clears the keyboard, and the outer document can end up visually
shifted on top of that. Two fixes, both scoped to only apply while
actually typing in Journal:
1. **Extra scroll room.** `#screen-journal` now gets a large bottom
   padding buffer (`min(60vh, 420px)`) whenever a field on it is
   focused — enough that there's always somewhere for the browser to
   scroll the textarea *to*, independent of whether the keyboard's real
   height ever gets reported anywhere.
2. **Outer-scroll correction.** `window.scrollTo(0,0)` is now called
   twice after focusing the journal textarea (once at 320ms, once at
   650ms, to also catch a keyboard animation that's still finishing) to
   undo any outer-document shift if one happens; harmless on
   platforms/tabs where it never does.

`sw.js`'s `CACHE_NAME` is bumped alongside this so a deployed copy
actually reaches phones instead of continuing to serve the cached
v15.9.7 shell.

## v15.10.1

**Journal — still cutting off mid-page after v15.10.0's overflow fix.**
v15.10.0 fixed `.diary-page` clipping its own content, but the page
still visibly cut off partway down whenever the keyboard opened. The
actual remaining cause was the "journal-focus" scheme from v15.6.0
onward: the instant a field on this screen gains focus, `kb-open` gets
added and CSS reacts by hiding the header, the bottom nav, and the
motivational photo card, *and* growing the textarea to `min-height:58vh`
— four layout changes firing at the same moment the keyboard itself is
sliding up. Each of v15.6.0, v15.8.0, and v15.9.7 fixed one fresh
symptom of that same race, but the underlying race was never removed —
and losing it, even for a frame or two, is exactly what a "half the
page, cut off, with the photo card caught mid-transition" screenshot
looks like.

This version removes the race instead of patching its next symptom:
header, bottom nav, and the motivation card no longer hide themselves
on focus — they now behave the same on Journal as on every other
screen, always present. The textarea keeps one constant height
(`min-height:46vh`, up slightly from 42vh) instead of jumping to 58vh
on focus. Nothing about the diary page's size or the surrounding
chrome's visibility changes at the moment the keyboard opens or closes
— the `.screen` container's native scrolling is the only thing doing
work, which is what makes "the complete page, reachable by scrolling"
actually reliable. The photo card, handwriting, colors, toolbar, and
Save/Export buttons are all unchanged.

## v15.10.0

**Journal — the diary page was getting cut off partway down, not just
scrolled awkwardly.**
`.diary-page` had `overflow:hidden` on it — added early on to keep the
decorative background art (the sketch illustration, the paper-grain
texture) from bleeding past the page's rounded corners. That same rule
was also silently cropping the page's *real* content: any time the
textarea grew taller than the page's starting height — typed content,
the keyboard-open 58vh bump, or a manual `resize:vertical` drag — the
extra height had nowhere to go but under the clip, so the bottom of the
page (and anything typed or attached down there) disappeared instead of
pushing the page taller. `.diary-page` now only clips horizontally
(`overflow-x:hidden`, still enough to contain the background art's
negative-offset bleed); vertically it's `overflow-y:visible`, so the
page is a plain block that always expands to fit everything inside it,
and the surrounding `.screen` (already `overflow-y:auto`) scrolls to
reach whatever that adds. The photo card, handwriting, colors, and
toolbar are unchanged — this only touches how tall the page container
is allowed to get.

## v15.9.7

**Journal — the bottom half (the actual writing area) wasn't visible
above the keyboard on mobile.**
v15.9.6 fixed the textarea's focus scroll to land at the top of the
page instead of centering the tall keyboard-open textarea. But "the
top of the page" on Journal still includes the motivational photo
card (~160px, with its own photo strip) above the date heading,
datebar, and toolbar — together tall enough that, above a half-screen
keyboard, the visible area cut off right at the toolbar, with the
textarea itself scrolled just out of view below the fold. That card is
purely decorative and irrelevant while actively writing, so it's now
hidden the same way the header/nav already are — only while the
keyboard is up — freeing enough room that the toolbar and the start of
the writing area are both visible together.

## v15.9.6

**Journal — fixed three real bugs reported on mobile.**
1. Tapping **Edit** on a past entry called `window.scrollTo({top:0})`,
   but this app's `body` has `overflow:hidden` — the window itself
   never scrolls, so that call was a silent no-op. Edit opened wherever
   the entries list happened to be scrolled to already, instead of at
   the top of the page. Now scrolls the actual scrollable element
   (`#screen-journal`) to the top.
2. Focusing the diary textarea used `scrollIntoView({block:'center'})`,
   same as every other input in the app. That's fine for a short field,
   but the journal textarea grows to `min-height:58vh` the instant the
   keyboard opens — centering it landed the viewport in the middle of
   that tall box, showing blank ruled lines with no date heading or
   toolbar in view ("opens to the middle of the page, have to scroll to
   see the start"). The journal textarea is now special-cased to scroll
   its screen container to the top instead, so the toolbar and date
   heading are visible together with the cursor, nothing to scroll past.
3. The toolbar Save button was a text link ("💾 Save"/"💾 Save
   changes"), wide enough to wrap onto its own second line on narrow
   phones — landing far from the Customize button instead of next to
   it. Switched to the same compact square icon style as Customize/
   prev/next/today, so the two now sit flush together regardless of
   screen width; new-vs-editing state is conveyed via the button's
   tooltip instead of its text.

## v15.9.5

**Journal — added an always-visible Save button in the toolbar, then
removed the old fixed bottom Save/Print bar entirely.**
Previously the only way to save an entry was the fixed `#journalSaveRow`
bar at the bottom of the screen, which only appeared while the textarea
itself was focused (`body.journal-focus`) — tap away to change the font,
ink color, or date and the Save action vanished with it. Added a Save
button directly in the toolbar, right next to "Export whole diary", so
it's always reachable regardless of focus state (wired to the same
`saveJournalEntry()`).

Once that toolbar button existed, the old bottom bar (`#journalSaveRow`
— "Save entry" + "Print") was redundant and, per feedback, sitting
awkwardly over the bottom nav — so it was removed outright, along with
its dedicated `position:fixed` CSS, the FAB-hiding workaround it
needed, and the extra bottom padding `#screen-journal` was carrying to
clear it. "Save changes" vs "Save" label switching (edit vs new entry)
now happens on the toolbar button instead. The "Print" action itself
was dropped — PDF/Word export for the current entry already exists
just below the editor and covers the same need.

## v15.9.3

**Journal — real bug: Save/Print was silently broken by its own container.**
v15.9.2 made Save/Print `position:fixed`, but it was still living inside
`#screen-journal`, and `.screen.active` carries `transform:translateZ(0)`
(a scroll-perf hint). Any ancestor with a transform becomes the
containing block for `position:fixed` descendants — so the bar was never
actually anchored to the real viewport at all, it was anchored to the
screen's own scrolling, clipped box, which broke both its position and,
on some platforms, its tappability entirely: "can't save the journal
entries now." Save/Print is now a sibling of the bottom nav and FAB at
the app-shell level — same pattern, no transformed ancestor in the way —
shown only while Journal is the active screen. Also hid the universal
Add FAB while on Journal: it was sitting in the same vertical band as
the new Save/Print bar and overlapping it.

## v15.9.2

**Journal — "Save entry"/"Print" is now truly fixed, not sticky.**
v15.9.0/v15.9.1's sticky bar had a fundamental problem: `position:sticky`
only pins an element once scrolling would carry it past a threshold — if
the diary content above it is shorter than the screen (a fresh or short
entry), the bar just renders at its normal in-flow position instead,
which can land anywhere in the middle of the screen with empty space
below it. Reported as "the button is stuck in the middle of the screen."
Save/Print now uses `position:fixed`, the same proven pattern already
used by the bottom nav and FAB — always in the same place at the true
bottom of the screen, completely independent of entry length or scroll
position. Journal's bottom padding is widened to match, so the entries
list and other buttons below never get hidden underneath it.

## v15.9.1

**Journal — sticky "Save entry" bar no longer clashes with the nav.**
v15.9.0's sticky save bar had two rough edges: it used the card-tint
background color instead of the real page background (a visible color
seam against the surrounding screen), and it wasn't full-bleed like
every other sticky element in the app, so it read as a floating patch
rather than an intentional toolbar. Worse, its bottom offset put it
directly on top of the bottom nav whenever the nav was visible (i.e.
whenever not actively typing) — the two were overlapping in the same
strip of screen. Now: true page background, edge-to-edge, a top border
for a clean boundary, and it sits just above the nav by default, only
dropping to hug the true bottom edge once typing actually hides the nav.

## v15.9.0

**Journal — "Save entry" is now a sticky bar, always reachable.**
Save/Print sat in normal document flow below the diary textarea, so
reaching it meant scrolling past however tall the textarea currently
was — 42vh normally, 58vh while typing — plus whatever the keyboard was
covering. On a long entry, or mid-typing, it could end up scrolled well
out of reach. It's now pinned to the bottom of the Journal scroll area:
it clamps into view immediately regardless of how far down its normal
position would fall, and stays in place as you scroll through the
entries list below, so Save is always one tap away.

## v15.8.0

**Journal — header/nav only hide while actually typing.** v15.6.0's
"focus" layout hid the app header (welcome/time, Save & Sync) and bottom
nav the moment Journal was opened at all, even just to browse past
entries with no keyboard up — reported as too much empty page and no way
to see the home/welcome/time header from Journal. The textarea also
always reserved a fixed 58vh of blank space up front, before a single
character was typed, which made an unwritten entry look mostly empty.
Focus mode now only engages once the on-screen keyboard is actually open
— the same moment the textarea's space genuinely gets tight — using the
same kb-open state already tracked for keyboard handling elsewhere.
Opening Journal to read or browse now looks like every other screen,
header and nav both visible; the expanded writing view only kicks in
once you tap in to write.

## v15.7.0

**Real bug fix — grey strip below the bottom nav, root cause this time.**
v15.6.1 patched one specific way this could happen (kb-open getting stuck
after the app is backgrounded with a field focused), but the report kept
coming back because that was a symptom-level fix, not the real bug: the
nav bar was `position:absolute`, anchored to `#app` — so its on-screen
position was only ever as reliable as `#app`'s height. `#app`'s height is
`100dvh`, which is *usually* right, but every fix so far (v14.4.8,
v15.6.1) was really just patching one more specific case where it briefly
reads wrong. The FAB never had this problem, because it was already
`position:fixed`, measured straight from the true viewport, completely
independent of `#app`. The bottom nav now uses that exact same pattern —
`position:fixed` + `env(safe-area-inset-bottom)` — so it's glued to the
real screen edge no matter what `#app` is doing. This closes the whole
class of bug at the root instead of chasing the next way `#app`'s height
can lag. No visual change under normal conditions — same size, same
position, same look, on every Experience Engine nav style (float, dock,
pill, glass, lifeos).

## v15.6.1

**Real bug fix — grey strip below the bottom nav, on any screen.**
Reported as a solid grey box below "Quick Actions" on Home, not
tappable. Root cause: v14.4.8 already fixed one cause of this (`#app`
now uses native `100dvh` normally, only falling back to a JS-measured
`--vvh` snapshot while `body.kb-open` is set, for the on-screen
keyboard) — but that fix assumed `kb-open` always gets cleared by a
normal focusout, which it doesn't when the app is backgrounded while a
field is still focused. Switching away to another app (e.g. to share a
screenshot) and back is a completely routine way to do that, and
neither the OS dismissing the keyboard nor the tab losing focus
reliably fires focusout on return — so `kb-open` was left stuck true,
pinning `#app` to whichever `--vvh` it happened to measure last
(usually shorter, from when the keyboard was still up), exposing a
strip of the raw page background below the nav that isn't part of any
actual app content — which is exactly why it didn't respond to taps.
The app now also re-checks on `visibilitychange`/`pageshow` (fired
whenever the app becomes visible again): if nothing is actually
focused at that point, `kb-open` is cleared and the height re-synced
immediately, before the gap can ever be seen. No visual/layout changes
otherwise.

## v15.6.0

**Journal — distraction-free "focus" layout.** The app header (clock,
search, Save & Sync) and the bottom nav bar used to stay on screen the
whole time you were in Journal, even with the keyboard up — between
the two of them and the keyboard, the actual writing area shrank down
to just a couple of visible lines, which is what made it feel cramped
and uncomfortable to type in. Both are now hidden completely while
you're on the Journal screen, and the diary page expands into the
space they leave behind — the `‹ More` back button at the top of the
screen still gets you out. The diary page itself (date navigation,
font/color toolbar, artwork picker, "Export whole diary", the saved
entries list) is unchanged. The writing box also got a bit more
breathing room on its own — real left/right padding instead of text
sitting almost flush against the edge, and it now grows to fill the
newly-freed vertical space (58vh) instead of staying capped at the old
42vh, which was sized for a screen that still had a header and nav
eating into it.

## v15.5.0

**Finance — real Calendar/Period Selector.** Finance used to only ever
show a fixed trailing-30-days window, with no way to look at any other
day, month, or year. It now opens on the current month by default, with
a Day/Month/Year switch plus `‹ Prev | Month 2026 | Next ›` navigation
and a 📅 jump button to pick an exact date/month/year. Balance stays
all-time (it's the running total, not a period figure); Net, the donut
chart, and the Ledger (both the 3-item preview and the full log) now
reflect whichever period is selected. This is a viewing filter only —
no transaction is ever deleted, altered, or duplicated when the period
changes, and switching to a new current month never clears anything.

**Reports — same calendar experience as Finance.** Previously "Week" /
"Month" / "Year" only ever meant *this* week/month/year — there was no
way to look at a past period at all. Reports now uses the identical
period-nav component as Finance (`periodRange()` gained an anchor-date
parameter so it isn't locked to "now" anymore), defaults to the current
month, and lets you navigate or jump to any historical day, week,
month, or year. The selected period always drives what's calculated and
displayed, and the current selection is always shown in the heading so
the numbers are never ambiguous about which period they cover.

**Journal — Quill & Ink removed, 7 new premium styles added.** Quill &
Ink is gone from the artwork picker, per request. Anyone who still had
`quill` (or the also-retired `stipple`) selected is auto-migrated to
the new `leaf` style on next load — nobody is left on a hidden or
broken style. In its place: **Minimal**, **Botanical** (a new, much
more restrained corner leaf sprig than the old illustrations),
**Paper & Grain**, **Night Journal**, **Editorial**, **Modern
Notebook**, and **Serene** — each a genuinely different colour/texture
theme for the whole diary page (paper tone, ink colour, ruled-line
colour), not just a palette tweak. The previous full-page "Botanical &
Skyline" border style is kept as an 8th, larger option for anyone who
wants a statement look. None of the new styles add heavy illustration —
writing space, readability, and the date stay the priority, decoration
stays out of the way, per the "don't overdecorate" requirement. All
existing journal entries, fonts, colors, page transitions, and
persistence are untouched.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v15-5-0`)
so installed copies actually receive this. No apps-script.gs change, no
redeploy needed — nothing here changes the sync payload shape.

## v15.4.0

Prompted by a direct "is the About screen okay?" check rather than
assuming it was fine — and it wasn't, quite.

The About modal (Settings → About) claimed **"14 trackers"** and
showcased 13 module chips. The app actually has **22 modules**. Nine
were missing from the chip cloud entirely: Tasks, Notes, Travel,
Learning, Content & Ideas, Meal Planner, People, Trends, Reports. This
was stale copy, hand-typed at some earlier version, that never got
updated as later modules shipped — a real, user-visible inaccuracy, not
a cosmetic nitpick, since About is the one place that's supposed to
tell you what the app actually does.

**Fixed at the root**, not just the numbers: both the count and the chip
list are now generated live from `MODULE_DEFS` (and the "Styles" count
from `EXPERIENCE_PACKS.length`, which — checked — was already correct,
now just dynamic too) instead of being hand-typed. This specific kind of
drift can't happen again; the next module added automatically shows up
here.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v15-4-0`)
so installed copies actually receive this. No apps-script.gs change, no
redeploy needed.

## v15.3.0

**Follow-up to the "is anything redundant" audit.** Notes and Content &
Ideas sounded like the same feature ("Quick capture, separate from
Journal" vs. "Capture an idea before it disappears"), but their actual
data models aren't related at all: Notes is generic freeform reference
notes; Content & Ideas is a content-creator pipeline (platform,
content-type, idea → in-progress → published status, links, publish
link). The overlap was in the *wording*, not the feature. Reworded
Content & Ideas' one-line description to "Content pipeline: idea →
published, with platform & status" — it now reads as what it actually
is on both the More screen and Settings → Modules (one shared source,
`MODULE_DEFS`, so a single edit fixes both places).

**Nothing else changed** — no module merged, removed, renamed, or
disabled; no data model touched; no other file (sw.js's CACHE_NAME
excepted) affected.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v15-3-0`)
so installed copies actually receive this. No apps-script.gs change, no
redeploy needed.

## v15.2.0

**Real UX fix, addressing "the app feels clumsy/hard to navigate."**

Root cause: all 22 modules are enabled by default, but only 4 fit the
bottom nav (`MAX_NAV_SLOTS`). That means up to **18 sections** were
sitting behind "More" in one long, grouped-but-unfiltered scroll — the
single biggest reason things felt hard to find, especially on phone.

Two additive changes, no navigation architecture changed:

- **Live filter box on the More screen.** Type a few letters of a
  section's name and everything else hides — including empty group
  headings, so you never see a bare "Money" heading with nothing left
  under it.
- **"Customize your Home bar" shortcut**, right at the top of More, that
  jumps straight into Settings → Modules. The ability to pin your 4
  most-used sections to the bottom nav already existed — it just wasn't
  discoverable from the screen where the crowding is actually felt.

Nothing was removed, hidden, or reorganized — this is purely a
findability layer on top of the existing structure.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v15-2-0`)
so installed copies actually receive this. No apps-script.gs change this
time — no redeploy needed for this update.

## v15.1.0

Closes the one gap v15.0.0 explicitly deferred: **Nudges now also fire in
the background**, not just while the app is open.

`checkNudges()` in index.html (journal inactivity 7+ days, 3+ overdue
tasks, subscriptions renewing within 5 days while a budget category is
already over its limit) has been in-app/foreground-only since it shipped
in v13.5.0 — flagged in BLUEPRINT.md the whole time as a "known
limitation, not yet addressed." `apps-script.gs`'s background trigger now
has `checkNudges_()`, a direct port of the same three conditions, reading
and writing the exact same `settings.nudgeLastShown` dedupe object the
client already syncs — so whichever fires first (the app being open, or
the 5-minute trigger) marks that nudge shown for the day, and the other
side won't send a duplicate. `SCRIPT_VERSION` bumped to `v10.1.0`.

**apps-script.gs must be redeployed** (Deploy → Manage deployments → ✏️ →
New version → Deploy) for this to take effect — no client (index.html)
logic changed, `checkNudges()` itself is untouched, only its server-side
mirror is new.

index.html, sw.js, and apps-script.gs all changed (CACHE_NAME bumped to
`gp-ledger-v15-1-0`) so installed copies actually receive this.

## v15.0.0

**Maintenance/architecture release — no visual redesign.** This pass
audited the project end-to-end (all three files, plus BLUEPRINT.md's own
"known limitation" notes) rather than adding new surface area. Three real
gaps closed:

1. **Tasks due-today reminders now also fire in the background.** Tasks
   has had `dueDate`/`dueTime` fields since v13.2.0, and the client's own
   `checkTaskReminders()` has shown an in-app popup for them since
   v13.8.0 — but that only ever reached you while the app was open.
   `checkReminders()` in `apps-script.gs` (the background Telegram
   trigger every other reminder-bearing module already uses) never
   gained a matching check. It now mirrors the exact same
   dueDate/done logic, on the same existing 5-minute trigger — no new
   trigger to set up. `SCRIPT_VERSION` bumped to `v10.0.0`;
   **apps-script.gs must be redeployed** (Deploy → Manage deployments →
   ✏️ → New version → Deploy) for this to take effect, same as any
   script change.
2. **This changelog had drifted five versions behind the shipped app** —
   its last entry was v14.1.0, while `APP_VERSION` was already at
   v14.4.8. Backfilled below (v14.2.0 → v14.4.8) from index.html's and
   sw.js's own version-history comments, which had stayed current the
   whole time — only this file had stopped being updated.
3. **sw.js's own top-of-file version comment** had been stuck reading
   "v14.4.1" for seven bumps while `CACHE_NAME` kept moving underneath
   it — cosmetic, but exactly the kind of doc drift that wastes time
   when debugging a stale-cache report. Now current, and worth keeping
   current going forward.

**Confirmed NOT a bug, just scope not yet reached (stated so a future
pass doesn't re-discover it):** Nudges (`checkNudges()`) remain
in-app/foreground-only. Real background delivery would mean adding the
same three conditions to `checkReminders()` in apps-script.gs too — this
was scoped out here because it needs its own audit of the nudge dedupe
logic (`S.settings.nudgeLastShown`), not a one-line mirror like Tasks
was.

index.html, sw.js, and apps-script.gs all changed (CACHE_NAME bumped to
`gp-ledger-v15-0-0`, SCRIPT_VERSION bumped to `v10.0.0`) so installed
copies actually receive all of the above instead of serving a cached
v14.4.8 — and don't forget the separate Apps Script redeploy for part 1.

## v14.4.8

Real bug fix — a grey gap could appear between the bottom nav and
Safari's own toolbar in mobile Safari (not installed as a home-screen
app). Root cause: `#app`'s height was pinned to a JS-measured viewport
value at all times, when that value only actually needs to override the
CSS default while the on-screen keyboard is open. Native `100dvh`
already tracks Safari's bottom URL-bar chrome expanding/collapsing
continuously with zero JS involved — pinning to a JS snapshot instead
meant `#app` could lag one event behind Safari's real chrome state,
exposing a strip of the page's own background below the nav. `#app` now
uses native `100dvh` normally and only switches to the JS-measured
`--vvh` while `body.kb-open` is set. CSS-only fix, no JS changed.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v14-4-8`)
so installed copies actually receive this instead of serving a cached
v14.4.7.

## v14.4.7

Content-relevant photos. loremflickr.com (unlike picsum) supports real
keyword search, so every hero/quote/motivation card photo now actually
matches its topic: Diet shows food, Finance shows money, Health shows
fitness, etc. `MOTIVATION_CARDS` quotes already carried a descriptive
`img` slug per quote, now sent as real flickr search tags via
`photoUrl()`'s new keywords param; the main `QUOTES` list instead
carries a `cat` field mapped to search terms via a new
`CATEGORY_KEYWORDS` table; the Home hero's other 3 tabs got their own
fixed keyword sets. No provider/architecture change beyond v14.4.6 —
same `photoUrl()` call sites, just passing real search terms now.

index.html changed only (no caching-strategy change) so bump so
installed copies actually receive this instead of serving a cached
v14.4.6.

## v14.4.6

Photo provider switched from picsum.photos to loremflickr.com — picsum
was confirmed genuinely unreachable on the user's own network and
device (a rate-limit page on one network, ERR_TIMED_OUT on another,
tested directly), unrelated to anything in this app. Every photo URL
now goes through one central `photoUrl()` helper in index.html; sw.js's
caching rule updated to match the new host.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v14-4-6`)
so installed copies actually receive this instead of serving a cached
v14.4.5.

## v14.4.5

Real root cause found for photos never loading: picsum.photos was
actively rate-limiting the device's IP (Cloudflare Error 1200), caused
by this app firing ~17 distinct picsum requests on every single boot
(confirmed by opening picsum.photos directly and hitting the same
rate-limit page). Cut the eager per-module preload (12 of those 17),
since each module's photo already loads itself when that module's
screen is opened — down to 5 requests on boot.

index.html changed, bumped CACHE_NAME to `gp-ledger-v14-4-5`.

## v14.4.4

Real bug fix — found why photos never loaded at all, not just
occasionally: `applyBackground()` and `preloadTodaysImages()` both
bailed out completely whenever `navigator.onLine` was false, before
attempting a single image request. That property is unreliable and
known to misreport `false` on installed/standalone PWAs on Android even
with a working connection — meaning on an affected device, zero photos
would ever load, permanently. Removed both gates; failures are already
handled safely via each image's own `onerror`.

index.html changed, bumped CACHE_NAME to `gp-ledger-v14-4-4`.

## v14.4.3

Real bug fix — quote/photo cards (Home hero, Habit quote, every
module's motivation card) were showing black instead of the intended
themed-gradient fallback whenever their photo failed to load
(offline/blocked/slow network, or picsum hiccuping). Root cause was
`.quote-card` never having a solid base color, only a faint tint over
whatever's behind it — near-black in dark themes. Gave it the same
opaque `var(--card)` base every other card already has. CSS-only fix,
no JS changed.

index.html changed, bumped CACHE_NAME to `gp-ledger-v14-4-3`.

## v14.4.2

Meal Planner input fix — a leftover inline `style="flex:1;"` on each
meal input was overriding the `.mp-slot` CSS rule meant to give it its
own full-width row, squeezing it down to a sliver next to the ✨/✕/Eaten
buttons and truncating meal names ("Peanut but…"). Removed.

index.html changed, bumped CACHE_NAME to `gp-ledger-v14-4-2`.

## v14.4.1

Three targeted fixes: (1) black screen on app open — root cause was
`init()` running as one unguarded sequence where a single uncaught
exception anywhere in it aborted everything before `#app` ever got its
`.ready` class, which is what reveals `<main>`; every step in `init()`
is now individually try/caught so it always finishes and `.ready`
always gets added. (2) The fixed bottom nav sometimes stayed on screen
and blocked the keyboard while typing — its show/hide listeners used to
sit at the very end of `init()`, so the same kind of abort described
above could leave them never attached for a whole session; they now
live in their own `setupKeyboardHandling()` function that always runs
first. (3) Journal now remembers the font you last used and defaults
new entries to it instead of always starting on Caveat.

index.html changed, bumped CACHE_NAME to `gp-ledger-v14-4-1`.

## v14.4.0

Targeted fixes: Clock size setting + position-jump-on-open glitch
fixed; Meal Planner's real "tomorrow always empty" bug fixed (Auto-fill
was filling a stale, invisible week) plus real per-slot AI suggestions,
Clear, and larger/responsive cards; Goals/Learning AI suggestions now
available while adding a new entry, not only after it's saved;
Journal's Botanical & Skyline artwork gained blossoms and
ink-hatching shading; notification volume is now adjustable (was a
fixed, quiet hardcoded level).

index.html changed, bumped CACHE_NAME to `gp-ledger-v14-4-0`.

## v14.3.0

Premium Journal customization — 3 artwork styles (Quill & Ink, Stipple
Tree, and Botanical & Skyline — a full page-framing border of original
branch/vine/skyline line art), all 6 spec'd page-transition modes via a
new "🎨 Customize diary" modal, the Default Font dropdown renamed to 5
named categories with corrected per-font fallbacks, and a real
grain/fibre paper texture on both the diary page and notebook editor.

index.html changed, bumped CACHE_NAME to `gp-ledger-v14-3-0`.

## v14.2.0

Closes out the full "GP Hub UI/AI/Module Integration" spec.

index.html changed, bumped CACHE_NAME to `gp-ledger-v14-2-0`.

## v14.1.0

Three feature batches:

### Thematic visual redesigns
Applied per-module only where a genuine metaphor fit — utility screens
(Settings, Search, AI Coach, Reports/Trends) were deliberately left
alone, since decoration there would hurt scanability rather than help it.

- **Journal → diary**: warm parchment page, faint ruled lines, a
  notebook-style red margin rule, a wax-seal ribbon tab, italic serif
  date heading, and two new handwriting/serif font options (Caveat,
  Lora). Fixed a real bug along the way: the old default text colour
  (`#eef1f7`, tuned for a dark background) would've been invisible on
  the new light paper — added a luminance-based ink fallback so no
  existing entry goes blank. Print, single-entry PDF, and "Export whole
  diary" all now render the same decorated parchment/border/ruled page
  (vector-drawn in jsPDF — no image assets, works offline). Word export
  gets a toned-down version since Word's HTML-to-.doc converter doesn't
  support gradients.
- **Notes → notebook**: ring-binder holes down the left edge, a
  coloured tab per category, faint blue ruled paper texture — carried
  into the note editor's textarea too.
- **Trip Planner → boarding pass**: a new transport-mode field
  (✈️ Flight / 🚆 Train / 🚗 Road trip / 🚌 Bus / 🚢 Ship), a mode-coloured
  ticket stub, dashed perforation with rivet-style notches, a decorative
  barcode strip, and a From→To route line.
- **Finance's full transaction log → paper receipt**: torn zigzag top/
  bottom edges, monospace amounts. Fixed a matching contrast bug — the
  date span's inline `--sub` colour (tuned for dark theme) was close to
  unreadable on the receipt's light paper.
- **Tasks**: a restrained sticky-note corner-fold coloured by priority —
  kept intentionally light-touch since this is a high-frequency,
  scan-fast checklist, not a browsing screen.
- **Subscriptions → membership/credit cards**: a gradient hashed
  deterministically from each service's name, so "Netflix" is always the
  same colour every time.
- **Debts → loan document**: a dashed "official" border, and a rotated
  red "PAID OFF" ink-stamp the moment a loan's balance actually reaches
  ₹0 (not just "this month's EMI paid").

### Global Clock — redesigned, then relocated
Initially rebuilt as a large reference-image-inspired card (dark face,
glowing green ring, bold `HH:MM:SS AM/PM`) on Home. Per feedback that
this was too intrusive, it was moved into the header as a compact styled
chip instead — same dark/green visual language, same Settings → Clock
controls (on/off, Analog / Digital / Analog+Digital), just living
permanently in the header rather than a dedicated Home card. The Home
card and all its supporting code were fully removed, not just hidden.

### Diet ↔ Habit ↔ Home integration
- Meals are now **auto-categorized** — Healthy, Junk, Processed,
  Protein-rich, Fruits, Vegetables, Sugary, or Other — via local keyword
  matching on the meal name. Instant, works offline, no AI dependency
  for something that doesn't need one. A meal can match more than one
  category (e.g. "fried chicken" → Protein-rich + Junk).
- Each meal row in Diet shows its category chips with a **"✎ edit"**
  affordance — tapping opens a small multi-select to manually correct a
  mis-detected category. A manual correction always takes priority over
  auto-detection from then on.
- Habits can optionally **link to a food category** plus a goal
  direction (avoid it / eat more of it). The habit detail view then
  compares the habit against actual logged meals: *"Junk Food: 3× this
  week, was 5× last week, Progress: Improving ↓"* — instead of only the
  daily checkmark.
- Home gets a new **🍎 Eating Patterns** card: a healthy-vs-junk split
  bar, the most frequent categories this week with week-over-week trend
  arrows, and any linked-habit insights. Only appears once there's real
  logged data — never a fabricated empty placeholder.
- Fully additive: existing meal and habit data/functionality is
  unchanged for anyone who doesn't use the new linking field or the
  category editor.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v14-1-0`)
so installed copies actually receive all of the above instead of serving
a cached v14.0.2.

## v14.0.2

**Bugfix.** Settings → Home → Quick Actions was showing "undefined
undefined" next to every toggle instead of the actual icon and label
(e.g. it should read "🎯 Log habit" — it just showed the toggle with no
readable text).

Root cause: `drawQuickActionsSettings()` read `qa.icon` / `qa.label`, but
the `QUICK_ACTION_DEFS` list actually stores those fields as `qa.ic` /
`qa.lbl`. A property-name mismatch, not a logic bug — the on/off toggle
state itself was already correct for everyone who used it (turning
actions on/off did work, and did save correctly), only the row's visible
text was broken. Now reads the correct fields and renders the icon
through the same `chromeIcon()` call Home itself uses, so the icon in
Settings matches the icon on Home exactly.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v14-0-2`)
so installed copies actually receive this instead of serving a cached
v14.0.1.

## v14.0.1

Follow-up release closing every specific gap identified in a review of
v14.0.0 against the original spec. Nothing here is a new feature request —
all of it is finishing items that v14.0.0 only partially addressed.

- **§7/§8 Typography**: v14.0.0 extended the existing font system in
  place; this release gives it a literal, dedicated **Typography**
  category in Settings (moved — not duplicated — from Appearance), with
  independent Header / Body / Time-Clock font pickers and a small live
  preview under each. The Time/Clock font is now genuinely independent
  (its own `--font-time` CSS variable driving the header clock), not a
  relabeled reuse of the Number/stats font.
- **§11 Streak Milestones**: added **Edit-in-place** (tap ✎, the Add form
  becomes an Update form) and **Reorder** (↑/↓ buttons), on top of the
  existing Add/Delete. Manual reorder only affects display order — the
  actual milestone-matching logic still sorts by day count internally, so
  reordering can't break which emoji is correct.
- **§12.3/§12.4 Meal Planner Calendar**: replaced the jump-to-date-only
  shortcut with an actual **month calendar grid**, reusing the exact same
  component/CSS as the app's main Calendar screen. 🟢 = something planned
  that day, 🔴 = at least one meal actually marked eaten. Tapping a day
  opens that day's full detail (planned text + Eaten toggle per slot).
- **§14 Meal Planner visuals**: colour-coded left accent bar + emoji per
  meal type — 🍳 Breakfast, 🥗 Lunch, 🍲 Dinner, 🍎 Snacks (matching the
  spec's own example) — plus a visual day-total calorie progress bar on
  each day card.
- **§15 Routine**: block rows rebuilt as proper cards — icon chip,
  coloured left accent bar, a live-pulse dot on whatever's happening
  right now, and a dimmed/muted look for Completed blocks — replacing the
  old flat plain-text row list that only had the Now/Upcoming/Completed
  grouping from v14.0.0 with no visual redesign to go with it.
- **§21 Settings → Appearance**: sub-grouped into **🎨 Theme** (Experience
  Pack, Theme presets, Colours) and **🖌️ Visual Style** (Icon pack, Timer
  style) section labels, instead of one flat scroll of 5 unrelated-
  looking cards. Photo cards/Quotes/Wallpaper already had their own
  **Photos & Quotes** category from v14.0.0.
- **§24 Log-heavy pages — full audit**: checked Reports, Trends, Debts,
  Subscriptions, Assets, Travel, Learning, Tasks, and Journal's entry
  list (the ones not covered by the v14.0.0 pass). All were already
  summary- or filter-scoped by default (Tasks defaults to "Today",
  Learning to its active filter, Reports/Assets/Subscriptions are already
  small current-state lists, not growing logs). One real bug found and
  fixed along the way: **Trends had its own separate habit-streak
  calculation** instead of using the shared `habitStreak()` — a duplicate-
  derived-value bug of exactly the kind spec §25 warns against. Now uses
  the same function everywhere.
- **§25 Diet ↔ Goals**: there was no goal type linked to Diet at all
  before this release, so the relationship couldn't be "kept in sync"
  because it didn't exist yet. Added a new **"Diet — days within calorie
  target"** goal mode, computed live from `S.diet.meals` on every render
  (same pattern as the existing Habit-streak goal mode) — and since Meal
  Planner's "Eaten" toggle already writes into `S.diet.meals` (from
  v14.0.0's interlink), marking a planned meal eaten automatically counts
  toward a Diet goal too, with no extra wiring needed. Also factored
  Routine's "what's happening right now" detection into a shared
  `routineBlockRange()`/`currentRoutineBlock()` helper, used by both
  Routine's own grouping and the new Home priority row below, instead of
  keeping two separate copies of the same time-range math.
- **§3/§9.1 Home visual hierarchy**: Routine now actually appears on
  Home — a "▶️ [category] — right now" row at the top of Top Priorities
  whenever something's actively running, using the same shared detection
  as Routine's own screen. Routine was completely absent from Home before
  this despite being explicitly named alongside Habits and Diet in the
  spec. Also added small section-header icons (⚡ Quick Actions,
  🎯 Top priorities, 📅 Upcoming, 🔥 Streaks) for faster scanning — no new
  cards, no new screens, same sections just clearer at a glance.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v14-0-1`)
so installed copies actually receive all of the above instead of serving
a cached v14.0.0.

## v14.0.0 — V14.0.0 full release

All six priority phases from the spec are complete. Full breakdown:

### Phase 1 — Stability / UX bugs
- **Journal back-button fix** (v13.19.0, carried into this release): the
  floating back button no longer lands mid-textarea when the keyboard is
  open — it relocates to a fixed top-right corner while typing instead of
  keeping a bottom-of-screen offset that made sense on a full-height
  screen but not a keyboard-shrunk one. Applies app-wide (Notes, Trip
  Plans, anywhere with a back-fab).
- **Notes / Trip Plans audited**: both use the bottom-sheet modal pattern
  for editing (not a full-screen editor like Journal), so they were never
  exposed to the back-fab bug above — confirmed by inspection, no change
  needed.
- **Quote-card image glitch**: the no-flash warm-cache pattern already
  existed (v12.2); added `fetchPriority:'high'` hints on the two
  most-likely-seen images (today's hero + habit quote) so the cache warms
  a little sooner on a cold start.

### Phase 2 — Data integrity / synchronization
- **Real root cause found and fixed for "Routine → Habit doesn't update
  immediately"**: the Habit screen had no case at all in the navigation
  render dispatch (`goToScreen`) — opening it never called
  `renderHabits()`. It only ever showed whatever was drawn at app boot.
  The routine→habit data sync itself (`syncRoutineToLinkedHabit`) was
  always working correctly; the Habit screen just never redrew to show
  it. Fixed.
- **Habit ↔ Goals**: checked — already recalculates fresh on every render
  (`goalProgressCalc` reads live habit data), no bug found.
- **Meal Planner ↔ Diet ↔ Calories interlink** (new): each planned meal
  slot has an "Eaten" toggle. Marking it done creates exactly one linked
  Diet-log entry (tagged `source:'mealplanner'`); unmarking removes
  exactly that entry; editing the plan text after marking done updates
  the linked calories too. No double-counting in either direction.
  Deleting the linked entry from the Diet screen also clears the
  Planner's "Eaten" flag, so the two screens can't disagree.
- **Global refresh** (new): a ↻ button in the header re-renders whatever
  screen is currently open from local state — the spec's requested
  fallback, sitting alongside the automatic re-render-on-navigate that's
  the actual day-to-day mechanism (fixed above).

### Phase 3 — Core feature improvements
- **Habit streaks**: computed live from real completion history every
  time (`habitStreak()`) — never a manually stored number, so it's always
  correct after edits or backfills. Shown on every Habit row and in the
  habit detail modal (which now shares the exact same calculation instead
  of a separate one that could disagree).
- **Streak milestone emojis**: customizable ladder, defaults to
  🔥 (1d) → ⭐ (10d) → 🌟 (20d) → 🏆 (50d) → 💎 (100d), always shows the
  highest milestone reached.
- **Meal Planner views**: defaults to **Today + Tomorrow** instead of
  always 7 days, with Yesterday / Next 5 days / Week view switches plus a
  jump-to-any-date field for checking a specific day's plan/history.
- **Home Quick Actions**: expanded from 5 hardcoded actions to a 10-item
  pool (added Add task, New note, Goals, Diet, Meal Planner), customizable
  in Settings → Home. Default selection and order is byte-identical to
  the original 5 for anyone who never opens that setting.
- **Habit streaks on Home**: a compact row shows every habit with an
  active streak, longest first — no need to open the Habit tab just to
  see them.

### Phase 4 — Settings / customization
- New **Streaks**, **Clock**, and **Home** categories in Settings.
- **Fonts**: the app already had a Header/Body/Mono font system
  (`--font-head`/`--font-body`/`--font-mono`) but forced Body to always
  mirror Header. Decoupled them into independent controls under
  Appearance → Fonts instead of adding a second, competing font system —
  falls back to the Header font until explicitly changed, so this is a
  pure addition, not a behavior change for anyone who hasn't visited the
  new control.
- **Clock**: the app already had a live header date/time indicator.
  Extended it (rather than adding a second clock element) with an on/off
  toggle and digital / analog / both style, including a small inline SVG
  analog face.

### Phase 5 — Visual polish
- **Finance**: clean summary view by default (recent-3 preview) with an
  explicit "View full log" toggle for the full transaction history.
  Transaction rows are colour-coded (🟢 Income / 🔴 Food / 🟠 Other) with
  icon + label + colour together, never colour-only.
- **AI Coach restructured**: from one flat list of sentences into five
  scannable sections — ✅ Doing Well, ⚠️ Needs Attention, 🎯 Continue,
  🔧 Improve, ➡️ Next Step — matching the spec's example structure.
  Previously-generated insights (saved in the old flat-list shape) still
  render correctly; nothing is lost by upgrading.
- **Routine**: today's block list now groups into **Now / Upcoming /
  Completed** instead of one flat chronological list, so what's happening
  right now vs already done is clear without reading every time range.
- **Health / Documents** checked against the "hide secondary information
  by default" principle (spec §24) — both were already summary-first, no
  change needed.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v14-0-0`)
so installed copies actually receive all of the above instead of serving
a cached v13.19.0.

## v13.19.0 — V14.0.0 work-in-progress, Phase 1 of 6 (Stability / UX bugs)

**This is an interim build toward the V14.0.0 improvement release. The
full spec has six priority phases; this build covers the first item in
Phase 1. Version stays at v13.19.0 (not 14.0.0) until all six phases are
complete and regression-tested — see the roadmap note at the bottom of
this entry.**

**Fixed: Journal back-button bug (screenshot report).** The floating
back-fab (the small circular "‹" thumb-zone button) would land in the
middle of the Journal writing area, overlapping the text, whenever the
on-screen keyboard was open.

- Root cause: `.back-fab` was positioned `bottom: calc(86px + safe-area)`
  — a fixed offset from the bottom of `#app`. But `#app`'s real height
  already tracks the keyboard (`--vvh` / `setVH()`), so once the keyboard
  opened and `#app` shrank to roughly half the screen, that same 86px
  offset from its (now much closer) bottom edge put the button high up
  the visible area — right over the textarea.
- Fix: when `body.kb-open` is set, the back-fab now relocates to a fixed
  position in the top-right corner — clear of both the existing sticky
  "‹ More" link (top-left) and the keyboard itself — with a smooth
  transition. It returns to its normal bottom-left thumb-zone spot the
  moment the keyboard closes.
- This fix lives in the same global `kb-open` mechanism every text-entry
  screen already uses (Journal, Notes, Trip Plans, etc.), so it applies
  app-wide, not just to Journal.
- Verified: back button stays visible and tappable with keyboard closed,
  keyboard open, on long entries, while scrolling, through repeated
  keyboard open/close, and immediately after typing then tapping back.

index.html and sw.js changed (CACHE_NAME bumped to `gp-ledger-v13-19-0`)
so installed copies actually receive this instead of serving a cached
v13.18.0. (The rest of the V14.0.0 spec — Phases 2 through 6 — followed in
the v14.0.0 release above.)

## v13.18.0

**Follow-up bug-fix release — the v13.17.0 fixes weren't the actual root
cause of the bottom nav getting stuck or scrolling feeling rough. Found and
fixed the real causes this time.** Only `index.html` and `sw.js` changed.
No design, layout, colors, icons, navigation structure, or features changed.

- **Bottom nav (Home/Habit/Routine/+Add) going invisible/untappable —
  actual cause:** a body class `kb-open` slides the fixed nav and FAB
  off-screen and disables their touches (`pointer-events:none`) whenever a
  text field is focused, so the keyboard doesn't cover them or eat stray
  taps. It's added on `focusin` and was **only** removed by a `focusout`
  event resolving through a fixed 120ms timeout — nothing tied its removal
  to navigation itself. The Search screen even auto-focuses its input on
  open. Any time focus moved away without a clean native blur resolving in
  time (platform/WebView timing varies, especially when the focused field's
  screen gets hidden by a screen swap rather than a normal user tap-out),
  `kb-open` stayed on `<body>` permanently — nav pinned off-screen and
  untappable, with no recovery short of a reload, exactly matching what was
  reported. Fix: `goToScreen()` and `closeModal()` now blur any focused
  field and remove `kb-open` **deterministically**, every single time,
  instead of depending on an event/timeout race. This can no longer get
  stuck regardless of platform or timing.
- **App-wide scroll stutter/jumping/stopping — actual cause:**
  `setupPullBounce()`'s own comment says it exists only to give a bounce
  feel to screens *too short to scroll natively* — but the code never
  actually checked for that. It engaged on any touch starting at
  `scrollTop<=0`, which is true at the start of nearly every normal
  downward scroll on nearly every screen (you always start scrolling from
  the top). That hijacked the vast majority of real scroll gestures
  throughout the entire app into a hand-rolled, transform-based drag
  (`transition:none` forced) fighting the browser's own native momentum
  scrolling — and on iOS, fighting the native elastic bounce
  `-webkit-overflow-scrolling:touch` already provides. That fight is what
  produced the stutter/jump/stop-dead scrolling everywhere. Fix: restored
  the actual `scrollHeight <= clientHeight` check from the feature's own
  stated intent, so the synthetic bounce only ever engages on genuinely
  non-scrollable screens (where it still works exactly as before), and
  every screen with real content now scrolls entirely natively.
- **Not changed:** no screens, modules, styling, or navigation paths were
  added, removed, or restructured; the pull-to-bounce feel on short screens
  and the keyboard-avoidance behavior for the nav both still work exactly
  as designed — they just no longer misfire on cases they were never meant
  to cover.

## v13.17.0 (apps-script.gs unchanged this release)

**Bug-fix release, requested audit: black screen on Back, general UI lag,
and the Home FAB / other Home buttons becoming unresponsive after
navigating around.** Only `index.html` and `sw.js` changed. No design,
structure, or feature changes.

- **Real cause of the black screen + stuck buttons:** the focus-timer
  full-screen overlay (`#timerFullscreen`) and the modal backdrop were only
  ever dismissed by their own explicit close/minimize buttons — neither was
  tied to navigation. Pressing Back (hardware/gesture, the in-app `‹ Back`
  links, or the floating back button all route through `goToScreen()`)
  swapped the screen *underneath* whichever of the two was open, while it
  stayed on top at a high z-index, silently swallowing every touch on the
  new screen — including the FAB and bottom nav, since those sit at a lower
  z-index. In dark theme, the timer overlay's background (`var(--bg)`,
  near-black) is exactly what read as a plain black screen; in light theme
  the same bug just looked like every button had stopped responding. Fix:
  `goToScreen()` now closes both, once, before any screen swap — this
  matches the app's own existing "minimize" behavior (the running timer
  itself is untouched, only its full-screen view closes), so nothing about
  the timer or modal system changes, it just now also triggers on
  navigation instead of solely on its own close button.
- **Lag / GPU pressure fix:** every `.screen` element (there are 25+)
  carried a permanent compositor-layer promotion hint
  (`transform:translateZ(0)` + `will-change:scroll-position`), so the
  browser was keeping ~25 GPU layers resident at once even though only one
  screen is ever visible. That's real, constant memory/GPU pressure on a
  phone, and a likely contributor to both the navigation lag and the
  black-screen flashes (a starved compositor drops a layer's tiles and
  paints them blank until it catches up). The hint is now scoped to
  `.screen.active` only — exactly one layer is ever promoted.
- **Hardening:** `goToScreen()`'s per-screen render dispatch (the
  `renderDashboard()` / `renderFinance()` / … chain) is now wrapped in a
  try/catch. Previously, if any one screen's render function threw, the
  exception aborted the rest of `goToScreen()` too — including
  `updateBackFab()` at the very end — which could leave that screen
  half-built and the back button/FAB in a stale state after an otherwise
  unrelated edge case. Now the screen switch, nav, and back-fab always
  complete, and the specific failure is logged to the console instead of
  silently freezing navigation.
- **Not changed:** `apps-script.gs` (no sync/backup logic touched), the
  timer's actual running/elapsed-time tracking (`S.runningTimer` is
  untouched by this fix — only the full-screen *view* of it closes on
  navigation), and no screens, modules, or navigation paths were added,
  removed, or restructured.

## v13.16.0 / apps-script v9.7.1 (apps-script.gs unchanged this release)

**Bug-fix release, requested audit: "Load from Sheet" was masking its own
real error messages, and there was no warning before it could silently
overwrite local changes that were never pushed to the Sheet.** Only
`index.html` and `sw.js` changed; `apps-script.gs` did not (see why below).

- **The actual bug:** the `loadFromSheetBtn` handler discarded whatever
  specific error `handleLoad()` (apps-script.gs) sent back and replaced it
  with one generic guess — *"Could not load a valid snapshot. Make sure the
  Apps Script is redeployed to the latest version."* — regardless of the
  real cause. An empty Data tab, a corrupt stored snapshot, and a
  wrong/undeployed Web App URL all produced that exact same misleading
  text. `apps-script.gs`'s `handleLoad()` was already returning the correct,
  specific error in every one of those cases (`"Data tab is empty — sync
  from the app at least once first."`, `"No data has been synced to this
  Sheet yet."`, `"Stored snapshot is not valid JSON — try Sync now again to
  rewrite it."`) — the frontend just never surfaced it.
- **Fix:** the handler now tells apart three distinct failure modes and
  shows the real cause for each:
  1. Response wasn't valid JSON at all (wrong/undeployed URL, HTML
     error/login page, uncaught script exception) → tells you to check the
     URL and deployment.
  2. `handleLoad()` returned `ok:false` → shows its `error` string
     **verbatim**, not a guess.
  3. Response was `ok:true` but the payload doesn't pass
     `isValidBackupSnapshot_()` → says so specifically, current on-device
     data untouched (same guard `v13.15.0` already established).
- **New: unsynced-changes warning (a real gap, not a regression).** There
  was previously no tracking of "does this device have local changes that
  were never pushed via Save & Sync" — Load from Sheet only ever showed the
  same generic "this replaces everything, continue?" confirm regardless. A
  new local flag, `syncDirty` (plain JS variable + its own `gpl_syncDirty`
  localStorage key — deliberately **not** part of `S`/the backup snapshot,
  since it's sync state, not app data), is set inside `saveState()` — the
  one function every real edit already funnels through — and cleared by
  `markSynced_()` after a **confirmed successful** Save & Sync or a
  completed Load from Sheet. When Load from Sheet finds a valid Sheet
  snapshot AND `syncDirty` is true, it now warns specifically that this
  device has unsaved local changes and offers Cancel (go Save & Sync first)
  before the generic replace-everything confirm.
- **Save & Sync's toast wording tightened for the `rows.data===0` case**
  (Data-tab snapshot — the one Load from Sheet actually reads — failed to
  write even though every other tab synced fine): it used to read `Synced ✓
  (backup snapshot failed — see debug log)`, which still led with a
  checkmark. Now reads `Sync incomplete — backup snapshot failed, see debug
  log`, and `syncDirty` is deliberately **not** cleared in this case, since
  the thing Load-from-Sheet-elsewhere depends on didn't actually get
  written.
- **`apps-script.gs` needed no changes.** Its chunked snapshot read/write
  (`chunkSnapshot_`/`readDataSnapshotRaw_`, `v9.7.0`/`v9.7.1`) and
  `handleLoad()`'s specific error strings were already correct — this was
  purely the client discarding information the backend was already sending
  correctly. `SCRIPT_VERSION`/`APP_SCRIPT_VERSION` stay at `v9.7.1`.
- `CACHE_NAME` bumped to `gp-ledger-v13-16-0` (index.html changed).
- **Nothing in the UI changed** — same Backup & Restore screen, same
  buttons, same overall confirm-before-overwrite flow (just smarter about
  when and what it warns you about).

## v13.15.0 / apps-script v9.7.1 (apps-script.gs unchanged this release)

**Architecture fix, not just a bug fix — Save & Sync, Export Backup, Load
from Sheet, and Import Backup now share ONE canonical snapshot builder and
ONE canonical restorer instead of four separate field lists.** `index.html`
and `sw.js` changed; `apps-script.gs` did not (see why below).

- **Why:** `v13.7.0` fixed 8 fields that were added to `syncNow()`'s
  outbound payload across `v13.2.0`–`v13.5.0` but never added to Load from
  Sheet's inbound restore — pulling a backup down had been silently
  dropping all of them the whole time sync itself worked fine. That was a
  symptom of the real problem: four independent code paths each hand-listed
  which `S` fields they cared about, so it was only a matter of time before
  they drifted apart again.
- **Fix:** new `buildBackupSnapshot_(opts)` builds the complete, current
  snapshot from `S` (used by both Save & Sync and Export Backup —
  `opts.forSync` controls whether diet meal photos are stripped and Goals
  progress is pre-resolved, same behavior as before, just centralized), and
  new `restoreBackupSnapshot_(d)` restores one back into `S` (used by both
  Load from Sheet and Import Backup). A new `isValidBackupSnapshot_(d)`
  gate runs first on every restore path — if a snapshot doesn't look like a
  real GP Ledger backup (missing `habits`/`settings`), **nothing in `S` is
  touched and the current on-device data is left exactly as it was**,
  instead of a partial/corrupted overwrite.
- **Two real gaps closed by centralizing this:** `S.aiCoach` (cached AI
  Coach insights) and `S.notifLog` (notification history) were never
  actually part of ANY backup or restore path before this — not sync, not
  load, not import. They're both small, bounded fields (notifLog is
  already capped at 200 entries) and now ride the snapshot like every
  other module.
- **Import Backup was quietly worse than Load from Sheet before this:** its
  old restore logic did a raw `Object.assign` that never ran the imported
  `settings` through `defaultSettings()` (so an older local `.json` backup
  missing newer settings fields left them `undefined` instead of properly
  defaulted) and never protected this device's own configured `sheetUrl`
  (importing an old backup could silently repoint this device at a
  different/blank Google Sheet). Both are fixed now that it shares the same
  restore function as Load from Sheet.
- `S.runningTimer` is deliberately still excluded from the snapshot (see
  the comment above `buildBackupSnapshot_` in `index.html`) — it's an
  in-progress "recording" timer, genuinely session-local; restoring a
  "running" timer from an old backup would show a wildly wrong elapsed
  time rather than just correctly not being restored. Documents vault
  photo attachments (`gpl_docAttachments`) remain device-only exactly as
  before, unaffected by this change.
- **`apps-script.gs` needs no changes and no redeploy for this release** —
  the Data tab's snapshot is `JSON.stringify(body)` of whatever the client
  sends, so `aiCoach`/`notifLog` ride along automatically now that
  `index.html` sends them, the same way Tasks/Notes/Trips/etc. did when
  those modules shipped. `SCRIPT_VERSION`/`APP_SCRIPT_VERSION` stay at
  `v9.7.1`.
- `CACHE_NAME` bumped to `gp-ledger-v13-15-0` (index.html changed).
- **Nothing in the UI changed** — same Backup & Restore buttons, same
  confirm dialog, same toasts/debug log. Export Backup's downloaded
  `.json` now includes a `backupVersion`/`appVersion`/`createdAt` header
  (schema-version metadata, independent of the app version) but is
  otherwise the same shape older versions of the app can still read back.

## v13.14.1 / apps-script v9.7.1

**Follow-up to v13.14.0/v9.7.0 below** — that fix was correct, but had no
way to prove from the app alone whether a given account's deployed Apps
Script was actually the new version or still the old one (paste ≠
publish: editing `apps-script.gs` in script.google.com does not
republish the live `/exec` URL — that only happens via **Deploy → Manage
deployments → ✏️ → New version → Deploy**, a step that's easy to miss).

- `rows.data` in the sync response now reports the **actual number of
  snapshot rows written** (e.g. `3`) instead of a flat `1`. On any
  account with real history, seeing `"data":1` after a sync is now a
  clear signal the old single-cell script is still deployed — the app's
  debug log spells this out directly after every "Sync now".
- `SCRIPT_VERSION` / `APP_SCRIPT_VERSION` bumped to `v9.7.1` so **Test
  connection** and any sync attempt will explicitly flag a version
  mismatch (old script vs. what the app expects) if the redeploy step was
  missed — this is usually the real fix if "Load from Sheet" still fails
  after pasting the v9.7.0 file.
- **Requires a redeploy** — paste the new `apps-script.gs` and go
  Deploy → Manage deployments → ✏️ → New version → Deploy, then Sync now
  once, then Load from Sheet.

# Changelog — v13.14.0 / apps-script v9.7.0 (Data tab size ceiling removed) → history below

## v13.14.0 / apps-script v9.7.0

**Real bug fix — "Load from Sheet" failing with "Data tab is empty" even
on accounts where Sync now reported success.** `index.html` and
`apps-script.gs` both changed; no other module touched.

- **Root cause:** the full JSON backup snapshot (used only by "Load from
  Sheet" — every readable per-module tab like Habits/Finance/Diet writes
  independently of it and was never affected) was stored in a single
  Google Sheets cell, which caps out at ~50,000 characters. Once total
  synced history — habits, transactions, routine logs, diet entries,
  everything combined — grew past that limit, `handleSync` silently wrote
  just a warning note into the Data tab instead of the real snapshot.
  Sync itself still reported success (every other tab genuinely did
  write), which is exactly why this was confusing: "Sync now" looked
  fine, but "Load from Sheet" then found nothing.
- **Not related to Documents/meal-photo attachments.** Those were already
  excluded from the sync payload entirely (Documents photos are
  deliberately device-local only, since v13.9.0; meal photos since
  v9.4.1) — this bug was purely "years of combined history no longer fit
  in one cell," not any image field.
- **Fix:** `apps-script.gs` now splits the snapshot into fixed-size
  chunks and writes one chunk per row (`chunkSnapshot_()`,
  `SNAPSHOT_CHUNK_SIZE`) instead of one cell — there's no practical size
  ceiling anymore, it just uses more rows as history grows.
  `handleLoad`, `checkReminders`, and `sendDailyQuote` all read it back
  through a shared `readDataSnapshotRaw_()` helper, which also still
  understands the old single-cell format for one transition cycle, so
  nothing is lost — the very next "Sync now" rewrites it in the new
  format automatically.
- `SCRIPT_VERSION` bumped to `v9.7.0`; `index.html`'s
  `APP_SCRIPT_VERSION` bumped to match, plus the sync debug-log wording
  updated to reflect that a `rows.data===0` result now means a real
  write error, not a size limit. **Requires a redeploy** of
  `apps-script.gs` — paste the new file and go Deploy → Manage
  deployments → ✏️ → New version → Deploy.

## v13.13.0

**Header layout fix, requested with a reference screenshot after the
v13.12.0 header clock turned out too cramped on real phones.** Header-only
change — no other Home content or module touched.

- The header is now two rows instead of one. **Row 1** is the greeting
  alone, full width (`greetName`/`greetSub`, unchanged wording/behavior).
  **Row 2** holds the date/time on the left and the existing Search +
  Save & Sync buttons on the right.
- The date/time indicator no longer needs to hide itself on narrow
  screens (the v13.12.0 `@media (max-width:380px)` rule is gone) — it now
  has its own row and always has room.
- `#app` is capped at 560px and centered at every viewport width, so
  there's no separate desktop header layout in this app to preserve
  separately from mobile — the two-row structure applies unconditionally
  rather than behind a breakpoint.
- Still updates every 30s via the same `updateHeaderDateTime()` from
  v13.12.0, still the browser's local timezone, still doesn't touch
  `greetName`/`greetSub`/the search button/the sync button internals.

## v13.12.0

**Home Dashboard update, requested against the attached reference mockup.**
Three changes, Home-only — Finance/Health/Habits/Tasks/Goals/Routine/AI
Coach/database/navigation/Search/Save & Sync are all untouched.

- **Layout order fixed.** The existing Dashboard Image/Quote (Focus tabs +
  hero photo/quote card) now renders first on Home, with the Morning
  Summary block directly below it — previously Morning Summary rendered
  above the image/quote. Everything else in the existing Home content
  (Daily Progress, Quick Actions, Top Priorities, Upcoming) is unchanged
  and still follows below.
- **Yesterday is now collapsible**, collapsed by default (`Yesterday · Aug
  16 ▾`). Tapping the row expands it in place — no navigation, no popup —
  to show Tasks/Habits/Spent/Sleep (only the metrics that actually have
  data), a new **Main achievement** row (one data-driven positive line,
  shown only on a good day, e.g. "Completed 6 tasks and stayed
  consistent."), and the existing **Carry-forward** row. Tapping again
  collapses it. State is a simple in-memory flag (`msumYesterdayOpen`),
  reset to collapsed on reload — no new storage.
- **Today — Top 3** and the one-line **Insight** now render below the
  Yesterday card regardless of whether it's expanded or collapsed, exactly
  as before in terms of data logic (still 0–3 items, never padded, same
  priority order: overdue task → overdue debt EMI → subscription due soon
  → goal behind pace → today's tasks/habits).
- **Header date/time.** A small live `Mon · Aug 17 · 5:42 AM` indicator
  was added to the header, between the existing greeting and the existing
  Search/Save & Sync controls. Uses the browser's local timezone, updates
  every 30s, and hides itself below 380px viewport width rather than
  crowding or wrapping the existing greeting — the greeting itself
  (`greetName`/`greetSub`) was not touched.
- **Version housekeeping.** `APP_VERSION` (and the Service Worker cache
  name) had not actually been bumped when Morning Summary shipped as
  v13.10.0 last round — the About screen and Settings were still silently
  showing v13.9.0. Fixed here: every current-facing version indicator
  (About screen, Settings row, `sw.js` `CACHE_NAME`) now correctly reads
  v13.12.0. Historical inline comments documenting *when* past features
  shipped (e.g. "v13.9.0 — Trash") are left as-is, same convention as the
  rest of this file — those are changelog annotations, not the live
  version number.

## v13.10.0

**Morning Summary.** New compact section at the top of the Home/Dashboard,
above the existing Daily Progress / Quick Actions / Top Priorities /
Upcoming stack (all untouched, unchanged, still working exactly as before).
Answers three things in ~5 seconds: what happened yesterday, what got
missed, what matters today.

- **Yesterday** — Tasks, Habits, Spent, Sleep, shown ONLY if that metric
  actually has data for yesterday's calendar date (no empty/fake 0/0
  states). "Good day 🙂" / "Light day" chip based on task+habit completion.
- **Carry Forward** — single highest-priority unfinished item, checked in
  order: overdue task (high-priority first) → overdue debt EMI →
  subscription due soon → goal behind pace. Tapping it jumps to that
  module. Omitted entirely if nothing qualifies.
- **Today — Top 3** — same priority order as Carry Forward, extended with
  today's due tasks and today's unlogged habits. Never padded to force
  exactly 3 — shows 0–3 based on what's actually real today.
- **Insight** — one rule-based sentence (no AI Coach call, no new
  architecture) combining yesterday's completion rate with whether a
  carry-forward item exists. Omitted if there's nothing meaningful to say.

**Strictly scoped, per the brief**: reads only existing `S.tasks` /
`S.habits` / `S.transactions` / `S.debts` / `S.subscriptions` / `S.goals`
via the same helpers `renderDashboard()` already used (`taskIsOverdue`,
`taskIsToday`, `debtIsOverdue`, `dueSoonSubscriptions`, `goalProgressCalc`,
`habitProgress`/`habitValue`, `txForDate`, `sleepHabit`, `addDays`). No new
data model, no writes, no changes to Finance/Health/Habits/Tasks/Goals/
Routine/AI Coach/navigation/schema. New function `renderMorningSummary()`
is called from the top of `renderDashboard()`, so it refreshes on every
existing state-changing action automatically — no new call sites added
anywhere else in the app.

**One judgment call**: the reference mockup repeats "Good morning, GP" —
skipped here since the existing header (`greetName`/`greetSub`) already
shows that greeting immediately above; repeating it would be the exact
"unnecessary duplication" the brief asked to avoid. The new section starts
directly at "Yesterday • [date]".

## v13.9.0

**Nine gaps were raised across two rounds of feedback. Eight got built
this release; the ninth (true multi-user) is explained below rather
than faked.**

**1. Trash / Undo.** Every delete in Tasks, Notes, Travel, Learning,
Content & Ideas, People, and Documents now moves the record to a new
Trash screen instead of destroying it — 30-day recoverable, restore or
delete-forever, auto-purged after that. New `softDelete()`/
`restoreFromTrash()` helpers, reused across all 7. **Scoped
deliberately**: pre-existing modules (Habits, Transactions, Debts,
Goals, Subscriptions, Assets, journal entries) still delete
immediately — rewiring those is a real follow-up, not done here.
`trash` and `accounts` (see #5) were added to all three sync
touchpoints *in the same edit*, specifically applying the lesson from
the v13.7.0 postmortem rather than repeating it.

**2. Calendar.** Month-view dots and the day-detail popup now include
Task due dates, Trip start/end dates, Learning target dates, and
birthdays — previously only Habits/Finance/Journal/Diet showed up.

**3. Documents can now hold an actual photo.** Compressed client-side
(max 1000px, JPEG ~72% quality) before storage. **Explicitly local-only
— not synced to Sheets, disclosed in the UI itself, not just here**:
the Sheets "Data" tab has a real ~50,000-character budget, and even one
photo's base64 would blow it for every other module sharing that same
sync payload. Attachments are cleaned up automatically when a document
is permanently removed from Trash (manually or via the 30-day
auto-purge), so deleted photos don't quietly accumulate in local
storage forever.

**4. Travel currency.** Trips get an optional currency field (USD,
EUR, etc.), and expenses tagged to a trip can carry an optional
"foreign amount" reference (e.g. "$45"). **Not real conversion** — no
FX rates, nothing calculated — because live exchange rates need an
external API this app deliberately doesn't depend on. The real ledger
amount stays in ₹, exactly as before; the foreign amount is a
side-by-side reference only.

**5. Finance accounts.** Optional `S.accounts` (Cash/Bank/Card/Wallet/
Other), each with a running balance = opening balance + whatever
transactions happen to be tagged to it. A thin layer over the existing
transaction list, not a second ledger — untagged transactions still
count toward the overall Balance stat exactly as before. Fully
optional end to end: nothing changes if no account is ever added.

**6. Recurring transactions** (rent, salary, any fixed bill). Reuses
`nextRecurDate()` — the same clone-forward function Tasks' recurrence
already used — via a new `processRecurringTransactions()`, checked
daily alongside reminders. **Caught a real boundary bug during
testing** before it shipped: a bill due exactly *today* was waiting
until tomorrow to generate, because the catch-up loop's stop condition
used `>=` instead of `>`. Fixed and re-verified with an isolated
Node test (checked in isolation: correct count, and idempotent — 
running the check twice doesn't create duplicates) before it went into
the real code.

**7. AI Coach** now reads Tasks (overdue count, recent completions),
Learning (in-progress items + %), the next upcoming Trip, stuck
Content ideas, Meal Planner coverage, and People/birthdays into
`buildCoachDigest()` — the same plain-facts-only digest every other
module already fed into the Gemini prompt.

**8. Exports for the 6 newest modules** (Tasks, Notes, Travel,
Learning, Content & Ideas, Meal Planner) plus People. **Scoped down
from the pre-existing Reports-screen export system deliberately**:
that system assumes a date-range report shape (Finance, Diet, Routine)
these list-shaped modules don't really have. Rather than force-fit
them in or rebuild that pipeline, each new module got its own simple
"export what's here" Excel button directly on its own screen —
Excel only, no PDF (six PDF layouts would double the work for no real
benefit over a spreadsheet for this kind of data).

**9. True multi-user — NOT built, explained instead.** This app has no
authentication and no backend beyond a single Google Sheet + Apps
Script per install. Building "real" multi-user (separate logins, per-
person data, conflict-free simultaneous editing) would mean a genuine
backend rewrite — an auth system, a multi-tenant data model, and real
conflict resolution for simultaneous edits. That's a different kind of
project, not a feature addition, and faking a lightweight version of
it (e.g. a "switch user" dropdown with no real data separation) would
be actively worse than not having it — it would look like privacy/
data-separation that doesn't actually exist. **The honest middle
ground, if this comes up again**: this app already has zero auth, so
multiple people CAN already use the same deployed URL + same Google
Sheet today, on their own phones, and see each other's synced data —
with the same last-write-wins caveat every manual sync always had.
That's the realistic answer, not a code change.

# Changelog — v13.8.0 (Search actually covers everything now; Tasks fires reminders) → history below

## v13.8.0

**Asked a second time whether everything was really wired everywhere —
did another full corner-to-corner pass rather than re-asserting
confidence, and found two more real gaps.**

**1. Search's empty state says "Search everything" / "search across
every module at once" — that was false.** All 7 modules built this
session (Tasks, Notes, Travel, Learning, Content & Ideas, Meal
Planner, People) were never indexed. Fixed: `renderSearchResults()`
now adds all 7, following the exact same `searchScore()`/`add()`
pattern as every pre-existing module — tasks by title/category/notes,
notes by title/content, trips by name/destination, learning items by
title/type, ideas by title/topic/platform, people by name/relation,
and meal plan entries by the meal text itself (with the "(~NNN kcal)"
suffix stripped for a cleaner search-result title).

**2. Tasks had due dates and due times since v13.2.0 but never
actually reminded you of anything** — a due task only ever showed up
if you happened to open the Tasks screen and looked at the Today/
Overdue filter. Fixed: `checkTaskReminders()` added, following the
exact `lastNotified`-on-the-record pattern every other reminder here
uses (Health appointments, Document expiry, Goal deadlines). Fires
once per task on its due date, wired into the same `checkDailyReminders()`
loop. Tasks also added to `REMINDER_MODULE_LABELS`, so it automatically
got its own tone picker in Settings → Reminder sounds — that list is
fully generic over the object, so no separate UI work was needed.

**Audited and confirmed as legitimately-deferred scope, not broken
wiring (different category from the two bugs above — these were never
claimed to work, so nothing is silently broken):**
- **AI Coach** (`buildCoachDigest()`) doesn't reference any of the 7
  new modules. This matches the original brief's own phasing — Pulse/
  Coach integration was always meant to come after every module's
  "reliable data and functionality" existed, which is now. Real next
  step, not a bug.
- **Report exports** (the Excel/PDF buttons Finance, Goals, Debts,
  Subscriptions, Assets, Health, Journal, Diet, and Routine each have)
  don't exist for any of the 7 new modules. Consistent gap across all
  7 — none of them have an export feature yet, not an oversight on
  one specific module.
- **No app-wide "reset/wipe all data" feature exists at all** —
  checked for one specifically; it isn't a new-module gap, the app
  has never had this feature.

# Changelog — v13.7.0 (real bug fix: data restore was silently dropping all 7 new modules) → history below

## v13.7.0

**You asked "are you sure nothing's missing or not wired perfectly" — did a real audit rather than just reassuring, and found a genuine bug.**

`syncNow()` was correctly updated across v13.2.0–v13.5.0 to send Tasks,
Notes, Trips, Learning, Ideas, Meal Plan, and People data OUT to Google
Sheets. But the two paths that bring data back IN were never updated:

- **"Load from Google Sheet"** (Settings → the button that pulls your
  saved snapshot back down — used on a fresh install or a new device)
  explicitly whitelists which fields it reads back from the response,
  field by field. All 7 new modules were missing from that whitelist.
  The data was sitting right there in the Sheet's JSON snapshot; it
  just silently never made it back into the app.
- **Local JSON backup restore** (Settings → Import backup file) had a
  quieter version of the same gap: it uses `Object.assign(defaults,
  data)`, and since the exported backup file (which just dumps the
  live `S` object wholesale) already contains the new fields, a
  same-version restore actually worked fine — but the *defaults*
  object was missing them, so restoring an **older** backup (from
  before a given module existed) would leave e.g. `S.tasks` as
  `undefined` rather than `[]`, which would throw as soon as any
  Tasks/Notes/etc. screen tried to `.filter()` or `.map()` over it.

Both fixed — same `Array.isArray(d.x)`/`typeof d.x==='object'` guard
style as every pre-existing field in that function, and all 8 missing
keys added to the local-restore defaults object.

**Also audited and confirmed clean, no changes needed:**
- `apps-script.gs`'s `handleLoad()` does a blind `JSON.parse` and
  returns the whole snapshot — no server-side whitelist, so the
  backend was never part of this bug.
- Settings → Modules toggle list (`drawModuleToggleList()`) is fully
  generic over `MODULE_DEFS` — all 7 new modules were already correctly
  toggleable, nothing missing there.
- `renderAll()` (called after a bulk restore) doesn't refresh Goals,
  Subscriptions, Assets, Documents, Health, or any of the 7 new
  modules' screens — but this turned out to be a **pre-existing
  pattern**, not a regression: those 5 older modules already worked
  this way before any of this session's changes. Screens render
  on-demand via `goToScreen()`'s dispatch when you navigate to them,
  which is why this was never actually visible as a bug — just noting
  it for the record rather than silently "fixing" long-standing
  behavior that wasn't part of what was asked.
- One harmless leftover found: `MOTIVATION_CARDS.habits` (9 quotes)
  has existed since before this session's changes and is genuinely
  unused — Habits shows its daily quote via the separate general-pool
  `renderQuote()`/`#habitQuoteCard` system, not the per-module
  motivation-card system. Left in place (adding a second, redundant
  quote card to the Habits screen would be a worse fix than just
  leaving unused data alone) — flagging it here so it doesn't look
  like a broken reference if noticed later.

# Changelog — v13.5.0 & v13.6.0 (logo everywhere, Dashboard Today/Upcoming, People, Nudges, calorie-aware Meal Planner) → history below

## v13.6.0

**Meal Planner now suggests actual meals against your real calorie
target**, per request. Built entirely on top of what Diet already
computes — `dietTargets()` (the TDEE calculation from your height/
weight/age/activity/goal in Diet → Settings) — rather than a second
calorie engine. A new "✨ Auto-fill empty meals" button splits your
daily target across Breakfast/Lunch/Dinner/Snacks (25/35/30/10%) and
picks the closest-matching option from a small curated food library
for each empty slot, writing it in as plain text with the estimate
attached, e.g. "Oats with banana (~320 kcal)". Each day now also shows
a running "~X / Y kcal" total, parsed back out of whatever's typed in
that day's four slots.

Three things worth knowing about how this was built:
- **Never overwrites anything you've typed** — only fills slots that
  are empty. Existing meal names already there (from you or from
  "Repeat last week") are left alone.
- **The food library is curated, not a nutrition database** — same
  "rough approximation, sanity-check it" spirit as Diet's own AI
  photo-estimate feature. ~44 common meals across the four slots, each
  with a rough calorie figure.
- **No data-model change.** `S.mealPlan[date][slot]` is still a plain
  string, exactly as before — the calorie figure is parsed back out of
  the text with a regex (`mpParseCalories`) rather than the plan
  switching to `{text, calories}` objects. Keeps the plain-text input
  fully hand-editable and avoids migrating anyone's existing plan.
- **Falls back to a general 2,000 kcal/day target** or if you haven't
  filled in body stats in Diet → Settings yet, with a visible hint
  pointing you there — never silently wrong, never blocks the feature
  from working.

## v13.5.0

**New logo, everywhere.** Turned out the app icons (manifest/PWA)
weren't the only place the old branding lived — a single embedded
`LOGO_DATA_URI` (base64 PNG) was reused in three places: the Dashboard
header badge, the onboarding screen, and the About/splash screen. One
swap (using `icon-192.png`, sized right for how small this renders)
updated all three at once, since they all read from the same constant.

**Dashboard "Today"/"Upcoming" integration (Phase 14)** — the thing
flagged as the biggest gap last time. "Top priorities" now also pulls
in overdue/due-today Tasks, a pinned Note, today's Meal Plan, and a
Learning item's next action. A new "Upcoming" section mirrors it
forward-looking: next trip countdown, nearest Learning deadline, a
Content idea that's ready to publish, the next upcoming Task, and
(once People existed) upcoming birthdays. Every module built across
this whole session now actually shows up on the one screen a normal
day starts on, instead of needing 12 separate taps to check.

**People module** — the second gap flagged. Deliberately not a CRM:
name, relation (Family/Friend/Colleague/Other), phone, birthday,
notes. Real integration, not just another isolated list: Finance
transactions gained an optional "Person" tag (same pattern as Travel's
Trip tag), Tasks gained an optional "For" person, and birthdays within
14 days surface on the Dashboard's new Upcoming section.

**Nudges — proactive insights, the third gap.** Three conditions,
checked once a day alongside the existing habit/finance/health/
documents/goals reminders: no Journal entry in 7+ days, 3+ overdue
Tasks, and subscriptions renewing this week while a Finance budget
category is already over its limit. Fires through the same
`openGenericReminderPopup()` every other reminder uses, so it shares
sound/history/notification behavior automatically.
**Honesty note:** this only fires while the app is open (same as most
reminders here) — it is NOT yet wired into the Apps Script + Telegram
path that some other reminders use for delivery when the app is
closed. That's a real, doable next step, just not done in this pass.

# Changelog — v13.4.0 (Notes, Travel, Learning, Content & Ideas, Meal Planner + per-quote images) → history below

## v13.4.0

**All five remaining new modules shipped**, following the exact
9-point checklist v13.2.0's changelog laid out. All six new modules
(Tasks included) are now fully built and standalone-usable.

- **Notes** — quick capture, kept deliberately distinct from Journal:
  title + freeform text + category (Personal/Work/Ideas/Important/
  Reference), pin, archive, search. No dates, no prompts, no mood —
  fast in, fast to find again.
- **Travel** — trip list (name, destination, dates, status) → trip
  detail with Itinerary / Bookings / Checklist tabs. Expenses
  deliberately do NOT get a second ledger: `openTxModal()` (Finance →
  Add Expense) now has an optional "Trip" field when trips exist, and
  the trip detail screen's "Linked expenses" section is a read-only
  filter over the existing `S.transactions`, totaled — not a parallel
  data structure.
- **Learning** — course/book/video/practice/other, status (Planned/
  Learning/Completed), 0–100 progress bar, next action. "Action +
  progress", not a bookmark list.
- **Content & Ideas** — idea → planned → draft → ready → published
  pipeline. Title/platform/topic capture in seconds; script notes,
  thumbnail idea, and published link only matter once an idea moves
  past the Idea stage.
- **Meal Planner** — a 7-day week grid (breakfast/lunch/dinner/snacks
  as plain text per day), "Repeat last week" button, prev/next week
  nav. Deliberately the mirror image of Diet: Diet logs what you
  actually ate with full nutrition; this plans what you intend to
  cook, with no nutrition data and no separate meal-id space — dates
  are the only key, so there's nothing to keep in sync with Diet.

**Per-quote background images, wired honestly.** The `img` field on
every quote had existed since the Quote Engine release but was never
actually connected to anything — the photo behind a motivation card
was seeded from `module + today's date` only, completely independent
of which quote was showing. Worth being upfront about what changed and
what didn't: **picsum.photos has no keyword/content search** — there's
no free, no-API-key way to guarantee a photo actually depicts "diet"
or "finance". What this release fixes is real but narrower: the photo
seed is now derived from the *specific quote's* own id/img keyword, so
changing the quote (shuffle, rotation, or just a different day) now
also changes the photo, and the same quote reliably brings back the
same photo. That's "this quote's own picture" — not "a picture
guaranteed to match this quote's subject", which isn't achievable
without a paid image-search API this app deliberately doesn't depend
on. Applied to both the per-module motivation cards
(`motivationCardHtml()`) and the Habits/Home daily quote card
(`renderQuote()`).

**Wiring completed for all six new modules** (Tasks + these five):
`MODULE_DEFS`, icon entries in all three packs (geometric/Sticker/
emoji-via-MODULE_DEFS) plus `VIVID_COLORS`, `FAB_ACTIONS`/
`CREATE_ACTIONS`, `MODULE_QUOTE_KEYS`/`MOTIVATION_MODULE_LABELS`/
`MOTIVATION_TARGETS`+elId map, and `FUTURE_MODULE_QUOTES` merged into
`MOTIVATION_CARDS` via `Object.assign()`. Every one of the "don't
duplicate existing functionality" boundaries from the original brief
held: Notes≠Journal, Meal Planner≠Diet, Travel expenses reuse Finance.

**Not done in this pass, by design (Phase 14–15, after all modules
exist — which is now):** Dashboard "Today" widget showing tasks due /
trip countdown / learning next-action, and Search integration across
all six new modules. Both are the natural next step.

# Changelog — v13.3.0 (sound library, deeper per-module quotes, icon refresh) → history below

## v13.3.0

**Notification sounds: 3 → 23.** All still pure Web Audio synthesis
(oscillator note sequences) — no sound files were added, nothing new
to load or cache. `TONE_LIBRARY` replaces the old inline 3-entry map;
the Settings → Reminder sounds dropdown now builds its option list
from `TONE_LIBRARY` automatically, so adding tone #24 later is a
one-entry addition, not a UI edit.

**Per-module quote pools deepened.** Every existing module's
`MOTIVATION_CARDS` pool grew — the thinnest ones most: Subscriptions
1→6, Assets 1→6, Documents 1→5. Habits, Routine, Diet, Finance, Debts,
Goals, Health, Journal, Tasks all grew too (5–9 quotes each now, up
from 1–5). Every quote stays genuinely on-theme for its module (diet
quotes are about food/health, finance quotes about money, etc.) rather
than generic filler, per the request. Same `{text, img, src}` shape
and legendary/original sourcing discipline as the Quote Engine release.
The five not-yet-built modules' `FUTURE_MODULE_QUOTES` pools were
deepened the same way (Notes 2→5, Travel 3→6, Learning 3→6, Content
3→6, Meal Planner 2→4) so they're ready with real depth whenever each
module ships.

**New app icon set (round 2)**, replacing v13.0.0's icons across all
four PWA surfaces. The new source files had two problems worse than
the first batch, both fixed before shipping: a faint checkerboard/
transparency-preview pattern baked into every "white" pixel across the
whole canvas (despeckled — any near-white, low-saturation pixel
flattened to pure white, logo pixels untouched), and filename
watermark labels ("512x512.png", "512x512 (Maskable).png",
"1024x1024.png", plus a stray cut-off label sliver at the top of
icon-512) baked into the image (patched out the same way as v13.0.0 —
painted over with the surrounding flat background). `apple-touch-icon.png`
was again 1024×1024; downsampled to 180×180 per iOS convention.
`icon-192.png` needed only the despeckle — no watermark text was
present on that one.

**`sw.js` `CACHE_NAME` bumped** to `gp-ledger-v13-3-0` (icons +
index.html both changed — installed copies need this to actually pick
up either).

**Not changed:** `apps-script.gs` (no backend/sync-shape change this
release), `manifest.json` (icon filenames unchanged, so no manifest
edit needed — same as the v13.0.0 icon swap).

# Changelog — v13.2.0 (Tasks module) → history below

## v13.2.0

**Tasks module** — the first of the six new modules from the project
brief, and the simplest by design ("do NOT turn Tasks into a
complicated project-management system").

- Quick add: title, priority (Low/Medium/High), due date, optional due
  time, category (free text), notes, optional repeat (daily/weekly/
  monthly).
- Four views — Today / Upcoming / Overdue / Completed — as a `.seg`
  filter bar (same control already used for Trends/Reports/Routine/
  Diet period switches, not a new UI pattern).
- Tap the checkbox to complete/reopen without opening the edit modal;
  tap the row for the full editor.
- **Recurrence, kept deliberately simple:** completing a recurring task
  doesn't maintain a separate template — it clones itself with the due
  date advanced by the interval. No new data structure, no second
  system to keep in sync.
- Registry-driven, same as every other module: one `MODULE_DEFS` entry
  gets Tasks into the nav/More screen/Settings→Modules toggle for
  free — confirmed working exactly as the Phase 0 architecture audit
  predicted, zero extra plumbing needed there.
- Motivation card wired in (`FUTURE_MODULE_QUOTES.tasks` → activated
  into `MOTIVATION_CARDS.tasks`, `MODULE_QUOTE_KEYS`, and
  `MOTIVATION_MODULE_LABELS` — same 4-step activation the Quote Engine
  release documented in advance).
- New icon (`tasks`) added to all four icon packs (geometric/Sticker/
  Vivid/iOS) plus the emoji pack (auto-derived from `MODULE_DEFS.icon`,
  no separate edit needed).

**Data model:** `S.tasks` (array), synced via `localStorage['gpl_tasks']`
and included in the `syncNow()` payload. Rides the existing full-JSON
snapshot in the Sheets "Data" tab automatically — **no `apps-script.gs`
change was needed** for backup/restore to work; a dedicated
human-readable "Tasks" tab (like Habits/Subscriptions get) was
deliberately left for a later pass rather than bundling a backend
change into this step.

**Not done in this pass, by design (matches the brief's own phase
order):** Dashboard "Tasks due today" widget (Phase 14, after all six
modules exist), Search integration (Phase 15), Goals/Calendar linking.
Tasks works completely standalone today.

# Changelog — v13.1.0 (Quote Engine) → history below

## v13.1.0

**Quote Engine** — the centralized quote system called for in the project
brief (Phases 4–5), built additively on top of the existing rotation
system rather than replacing it, so every current call site keeps
working unchanged.

- **General pool nearly doubled**: 62 → 117 quotes. Every entry now
  carries `cat` (life-area tag) and `src` (`'legendary'` for real,
  correctly-attributed people; `'original'` for GP Ledger's own
  taglines — nothing AI-generated, nothing invented, nothing knowingly
  misattributed). 103 legendary : 14 original — legendary quotes stay
  the backbone, per the source-priority rule.
- **Module quote pools expanded**: every existing module (Habits,
  Routine, Diet, Finance, Debts, Subscriptions, Assets, Documents,
  Goals) got 1–3 more curated quotes.
- **Health and Journal now have motivation cards** — previously the
  only two enabled modules without one. Same pattern as every other
  module: a `<div id="xMotivationCard">` at the top of the screen, one
  `renderTopMotivation()` call in that screen's render function, wired
  into `MODULE_QUOTE_KEYS`/`MOTIVATION_MODULE_LABELS` so they also show
  up in Settings → Quotes → Manage and Settings → Motivation on/off.
- **`FUTURE_MODULE_QUOTES` added** — ready-to-go quote pools for the
  six planned modules (Tasks, Notes, Travel, Learning, Content & Ideas,
  Meal Planner), deliberately *not* wired into `MODULE_QUOTE_KEYS` yet
  (would surface a quote category in Settings for a screen that
  doesn't exist). Activating one when its module ships is a 4-line
  change — documented inline above the constant.
- **Recency-avoidance**: random-order rotation could repeat a quote
  within a handful of shuffles. Now keeps a short rolling history
  (last ≤6) per pool and skips those on the next random pick.
  **Stored in its own `gpl_quoteRecent` localStorage key, deliberately
  outside `S.settings`** — `S.settings` syncs to Sheets wholesale, and
  quote-shown history is exactly the low-value display state the brief
  says to keep off the sync path.
- **`getDailyQuote()` / `getModuleQuote(key)`** added as the documented
  public entry points for future code (new modules, dashboard widgets)
  — thin wrappers around the existing `todaysQuote()` /
  `currentModuleQuoteText()`, not a rewrite.

**Not changed:** daily-quote stability behavior (still one quote per
day, deterministic, unchanged from before), the Manage Quotes editor
UI/flow, `apps-script.gs` (no backend or sync-shape change — quote
data was already synced the same way; only the new recency cache,
explicitly local, was added).

**Sheets sync impact: none.** No new field was added to the sync
payload. `S.quotes` and `S.moduleQuotes` were already synced before
this release; they're simply longer lists now.

# Changelog — v13.0.0 (new app icon set / branding replacement) → history below

## v13.0.0

**New GP Ledger app icon**, replacing the old icon across every PWA
surface — home-screen icon (Android/`icon-192.png`, `icon-512.png`),
maskable adaptive icon (`icon-512-maskable.png`), and iOS home-screen
icon (`apple-touch-icon.png`). No filenames changed, so `manifest.json`
and the `<link>` tags in `index.html` needed no edits — only the image
bytes themselves.

Two real problems found in the icon files as provided, fixed before
shipping rather than passed through:

- **All four exports had a "COLOR VARIATIONS" label baked into the
  bottom-right corner** — a leftover from whatever icon-generation tool
  produced them. Left in, that text would have shown up on every
  device's home screen. Patched out (painted over with the same flat
  background the label sat on, in the empty margin outside the icon's
  rounded card — no logo artwork was touched).
- **`apple-touch-icon.png` was 1024×1024 and 524 KB** — far larger than
  iOS ever uses (it displays at ~180×180 on-device) and needlessly
  bloating the service-worker's precache. Downsampled to the
  conventional 180×180, dropping it to ~36 KB.

`icon-192.png`, `icon-512.png`, and `icon-512-maskable.png` were left at
their provided pixel dimensions (correct per `manifest.json`) with just
the watermark removed.

**`sw.js` `CACHE_NAME` bumped** to `gp-ledger-v13-0-0`. This is the part
that actually matters for icons specifically: the old icons were cached
under the same filenames, so without a cache-name bump, phones with GP
Ledger already installed would keep the stale icon indefinitely even
after this deploy. **Redeploy + reinstall/refresh required** — see
Setup Guide's update steps; on some Android launchers the home-screen
icon only refreshes after the app is removed and re-added.

**Not changed:** `apps-script.gs` / `SCRIPT_VERSION` (untouched — no
backend logic changed, so no redeploy of the Apps Script side is
needed for this release, only the static files).

**Known cosmetic note, not fixed:** the maskable icon's actual artwork
(the rounded white card) occupies roughly the center 75–80% of the
1024-unit safe canvas with light padding around it, rather than being
edge-to-edge per the strict maskable-icon spec (which expects full-bleed
art with no self-rounding, letting the OS apply the mask shape). In
practice this renders fine on every launcher tested — it just means the
icon sits very slightly smaller/more padded than a from-scratch
maskable icon would. Flagging it rather than silently redesigning the
icon, since a proper fix means regenerating the source art, not
patching this export.

# Changelog — v12.9.2 / apps-script v9.6.1 (Finance/Health/Documents/Goals reminders now reach Telegram) → history below

## v12.9.2 / apps-script v9.6.1

Closes the gap flagged at the end of the last session: Finance (EMI due,
subscription renewal), Health (appointment today), Documents (expiring
within 7 days), and Goals (deadline today) reminders were local-only —
they fired with sound + a logged entry, but only while the app was open
in the foreground, unlike Habit reminders which also reach Telegram in
the background.

`checkReminders` (apps-script.gs) now covers all five reminder types, on
the **same 5-minute trigger** already set up for habits — no new trigger
to add. One intentional simplification: the Telegram version of a Goal
deadline reminder fires regardless of whether the goal is already met
(the in-app popup only fires if it isn't) — replicating that exact
progress check server-side wasn't worth duplicating for one condition.

**Redeploy required** — paste the new `apps-script.gs` in, Deploy →
Manage deployments → ✏️ → New version → Deploy.

# Changelog — v12.9.1 / apps-script v9.6.0 (backup/sync completeness gaps closed) → history below

## v12.9.1 / apps-script v9.6.0

A gap-analysis pass, prompted by reviewing everything together (icons,
setup guide, apps-script.gs) against the app as it stands after v12.6–v12.9.
Found and fixed real gaps — the client-side data model had outrun what
actually got backed up:

- **Diet sync was missing the Fat Quality / Meal Tag columns** (added in
  v12.8.0) — the Sheet's Diet tab now includes both, resolved the same way
  the app displays them (AI suggestion if there was one, otherwise the
  same heuristic), not left blank.
- **Goals sync showed a blank "Current" for anything auto-tracked** (Debt,
  Weight, Habit-streak, and auto-tracked Savings goals) — these were never
  stored as a plain number client-side, they're computed live for display,
  so the old sync payload had nothing to send. Now sends the resolved
  current/target for every goal type, plus a new "Auto-tracked From"
  column showing the linked Finance category where relevant.
- **Custom quotes (Settings > Quotes > Manage my quotes, added v12.6)
  were never backed up to the Sheet at all** — only the separate local
  JSON export included them. Added a `Quotes` tab, and both Sync and
  Load-from-Sheet now carry your quote list and each module's themed
  quotes.
- **The Telegram midnight quote (`sendDailyQuote`) still pulled from a
  hardcoded list on a fixed formula**, completely disconnected from your
  actual editable quotes since v12.6. It now sends your real current
  quote (same rotation position shown in-app), falling back to the old
  list only if a sync from before this version hasn't sent quotes yet.
- Bumped apps-script.gs to v9.6.0 to match — **redeploy required** (paste
  the new file in, Deploy → Manage deployments → ✏️ → New version →
  Deploy), same as any apps-script.gs update.

**Also verified clean, no changes needed:** all four icon files (correct
sizes; the maskable icon already has proper safe-zone padding — content
sits at ~69% of the canvas with ~15% margin on every side, well inside
Android's crop-safe zone; apple-touch-icon is correctly a plain opaque
square with no baked-in rounding, which is what iOS expects), manifest.json,
and BLUEPRINT.md all match the current app exactly.

**Known gap, not yet built:** the four new local reminder types (Finance,
Health, Documents, Goals — added in v12.9.0) only fire while the app is
open in the foreground. Unlike Habit reminders, they don't have a
Telegram/background counterpart yet (`checkReminders` server-side only
knows about habits). Flagging this rather than silently leaving it — happy
to build it next if wanted.

# Changelog — v12.9.0 (reminders for every module + history, smarter/consistent reports) → history below

## v12.9.0

**1. Reminder sounds now cover every module, not just Habit/Finance.**
Settings > Communication > Reminder sounds lists a tone (Chime/Bell/
Beep/None) for each: Habit, Finance, **Health** (new — appointment-day
reminder), **Documents** (new — fires within 7 days of an expiry date),
and **Goals** (new — fires on the deadline day if not yet met). All the
new ones check once a day at 9 AM, same as Finance.

**2. Notification history.** Every reminder that fires — any module —
now gets logged. Settings > Communication > Reminder sounds > "View"
shows the full history (module, title, and when it fired), even after
you've dismissed the popup. Kept to the most recent 200.

**3. Reports are smarter and consistent.** Every report (Finance,
Routine, Diet, and every individual habit) now shows the same "Day by
day" breakdown in the same bar style — including **hours vs. days for
any habit**, e.g. Sleep hours per day, not just a period total. Finance
also got its missing Export buttons back (Excel/PDF — this was silently
absent before), and every individual habit report can now be exported
too (previously only whole-module reports could be).

# Changelog — v12.8.0 (shared categories, time reports, junk/healthy meals, pull-bounce, reminder sounds, smarter search, goal auto-track) → history below

## v12.8.0

**1. Shared Finance categories.** Add Transaction and Add/Edit Budget now
both use one shared, editable category dropdown instead of two free-text
fields that could drift apart. Pick from the list or "+ Add new category…"
inline; "Manage categories" (in either modal) lets you rename or delete —
renaming updates every transaction/budget already using that name.

**2. Time breakdown in Reports.** The Routine report now shows hours by
category, not just one lump total. Any habit linked to a routine category
(Meditation, Sleep, etc.) now shows its actual hours spent in its own
per-habit report, not just days-on-target.

**3. Diet: junk vs healthy, good fat vs bad fat.** Logging a meal now has
a "Mostly what kind of fat?" picker (healthy — nuts/fish/olive oil,
mixed — cooking oil/ghee/dairy, unhealthy — fried/processed). Photo
analysis now suggests this automatically, along with an overall
✅ Healthy / ⚖️ Balanced / 🍔 Junk-ish tag per meal, plus a healthy/
balanced/junk count for the day at the top of Diet. All approximate —
not lab measurements — same disclaimer as the calorie estimates.

**4. Pull-to-bounce feel everywhere.** Every screen now springs when you
pull down at the top or up at the bottom, even short ones (like Settings)
that don't have enough content to scroll natively — previously those felt
"stuck" since there was nothing to scroll.

**5. Reminder sounds.** Settings > Communication > Reminder sounds:
sound on/off, and separate tones (Chime/Bell/Beep/None) for Habit
reminders vs Finance reminders, with a Test button for each. Finance
reminders are new — a daily 9 AM check now nudges you when a debt/EMI
is due today or a monthly subscription renews today, tagged with the
Finance tone so it's distinguishable from a habit alert without looking.

**6. Smarter search.** Multi-word queries now match across any field
(not just one exact substring), results are ranked by relevance
(title match > other-field match), and Assets, Budgets, and Routine
categories are now searchable (previously missing).

**7. Goals — clarified + auto-tracked Savings.** Pay-off-debt, weight,
and habit-streak goals were already auto-calculated from your real data
(no manual updates needed) — this wasn't stated anywhere, so each now
says so directly in the goal form. Savings goals can now optionally
"Auto-track from a Finance category": pick a category (e.g. "Savings")
and progress becomes money-in minus money-out tagged with it, since the
goal was created — no more manually typing in "current progress" every
time. Custom goals stay fully manual by design (there's no single data
source to link to), and now say so explicitly too. Each goal card shows
🔄 Auto-tracked or ✋ Manual so it's clear at a glance.

**Also fixed:** a JSON-backup restore (Settings > Backup & Restore >
Import) was missing the quotes/module-quotes fields added in v12.6/12.7,
which could leave those blank after restoring an old backup — fixed.

# Changelog — v12.7.0 (per-module quote rotation) → history below

## v12.7.0

**Every module now rotates its own themed quotes, not just Home/Habits.**
Previously Finance, Routine, Diet, Debts, Subscriptions, Assets,
Documents, and Goals each showed a motivation quote, but it only ever
changed once a day on a fixed formula and wasn't editable.

- Each of those 8 modules now has its own quote list (Diet quotes are
  food/health-themed, Finance quotes are money-themed, etc — seeded
  from the existing built-in lines) and rotates on the **same** schedule
  as the Home/Habits quote (Settings > Quotes: auto on/off, interval,
  Sequential/Random, "Change quote now").
- **Manage my quotes** now has a **Category** dropdown at the top —
  switch between Home & Habits and any module to add, edit, or delete
  that module's quotes, or restore just that category's built-in
  defaults, without touching the others.
- "Change quote now" and the auto-rotation timer now advance the
  visible quote everywhere at once — the general quote card AND
  whichever module screen you're currently on. Screens you're not on
  pick up their new quote the next time you open them, same as the
  photo behind them always has.

# Changelog — v12.6.0 (quote rotation + editable quotes) → history below

## v12.6.0

**Quote text now rotates independently of the photo behind it, and is
fully editable.** Previously the photo/quote card's picture could be
auto-rotated (Settings > Appearance) but the quote *text* only ever
changed once a day, on a fixed formula, from a hardcoded list.

- Settings > Appearance now has a separate **"Quotes"** group (the old
  "Quote & photo cards" group is renamed **"Photo cards"** and now only
  covers the picture, to avoid the two being confused): Rotate
  automatically on/off, Rotate every (15 min / 30 min / 1 hr / 3 hr /
  once a day / custom minutes), Order (In order / Random), a
  "Change quote now" button, and a "Manage my quotes" button.
- **Manage my quotes**: add, edit, or delete quotes, or restore the
  original built-in list. Your list is now the source of truth — the
  old QUOTES constant is only used to seed it on first run.
- Quote text still guarantees at least one change per day whenever
  auto-rotate is on, even if you set a longer custom interval — same
  baseline behavior as before, now with the extra control on top.

# Changelog — v12.5.2 / apps-script v9.5.2 (the actual sync-crash fix) → history below

## apps-script v9.5.2

**Real bug fix — the actual cause of `TypeError: sheet.clearContent is
not a function`, which the v9.5.1 fix below did not address.** Apps
Script's `Sheet` class does not have a `clearContent()` method — that
method only exists on the `Range` class. The `Sheet`-level equivalent
is `clearContents()` (with an "s"). `writeSheet()` — the helper used
to write every single tab (Habits, Settings, Transactions, Routine,
Debts, Journal, Diet, Goals, Subscriptions, Assets, Health, Documents,
Budgets, RoutineTemplates) — and the Data-tab backup write were both
calling the non-existent `clearContent()`, so the very first tab
written on every sync threw immediately and the whole sync died before
anything got saved. This explains why "Test connection" and "Load from
Sheet" (which never call this method) kept working fine while every
sync failed. Both call sites now correctly call `clearContents()`.
**Requires a redeploy** — paste the new `apps-script.gs` and go
Deploy → Manage deployments → ✏️ → New version → Deploy.

## v12.5.2

**App now expects apps-script v9.5.2.** Bumped `APP_SCRIPT_VERSION` to
match the fix above — Test Connection will correctly flag a mismatch
until you redeploy the new `apps-script.gs`. Service worker cache name
bumped too, so this update actually reaches installed/home-screen
copies on next launch instead of serving a stale cached `index.html`.

# Changelog — v12.5.1 / apps-script v9.5.1 (real sync-crash fix, meal photo gallery picker, Back-navigation fix) → history below

## apps-script v9.5.1

**Real bug fix — sync could fail completely with `TypeError:
dataSheet.clearContent is not a function`.** The Data-tab backup
snapshot was supposed to degrade gracefully if anything went wrong
writing it (see v9.4.1 below) — but `getOrCreateSheet('Data')` and
`dataSheet.clearContent()` were both called *before* the try/catch
meant to protect that section, so if either of those two calls itself
threw for any reason, the whole sync died right there — before Habits,
Diet, Finance, or any other tab ever got written, even though nothing
was actually wrong with your data. Both calls now live inside the
try/catch, so a problem specific to the Data tab can't take every
other tab down with it anymore. **Requires a redeploy** — paste the
new `apps-script.gs` and go Deploy → Manage deployments → ✏️ → New
version → Deploy.

## v12.5.1

**Diet — meal photo can now be picked from the gallery, not just the
camera.** The file input previously had `capture="environment"` on it
unconditionally, which on many phones is treated as "open the camera
app directly" and never offers the gallery/file picker at all — so
there was no way to reuse an existing photo, only take a brand-new one
on the spot. "Log a meal" now shows two explicit buttons — **📷 Take
photo** and **🖼️ Choose from gallery** — wired to two separate file
inputs (one with `capture`, one without), plus a **✕ Remove photo**
link once one's attached. Nothing about how photos are stored or
synced changed — see the note below, they're still on-device only.

**Navigation — real fix for the Settings Back button occasionally
landing on a blank screen (first time only).** Root cause: the
in-screen "‹ Back" links (`data-back`, e.g. Settings' "‹ More") and the
floating back arrow were calling `goToScreen(target)` directly instead
of `history.back()`. Every *forward* navigation already pushes one
history entry, so a Back **link** that also pushes a fresh entry
(instead of popping the one already there) silently doubles up the
history stack the first time it's used — invisible in the moment, but
it's exactly what leaves the browser/hardware Back button (which reads
that stack via `popstate`) out of sync with what's actually on screen,
which is what showed up as a blank render on the *next* Back press.
`settingsCatBack` ("‹ All settings") was already doing this correctly;
every other Back control now matches it, so every forward push has
exactly one matching pop and Back stays reliable everywhere, not just
in Settings.

**Sync — the one-in-a-while "backup snapshot skipped" case is now
visible instead of silent.** `handleSync` already wrote every readable
tab (Habits, Diet, Finance, etc.) independently of the single combined
JSON backup on the Data tab, and already degraded gracefully if that
one cell went over Sheets' 50,000-character limit — but the app never
told you when that happened, so a sync could say "Synced ✓" while
quietly skipping the "Load from Sheet" backup. Now surfaced as a
distinct toast + debug-log note when it happens. To be clear on the
underlying cause: as of v9.4.1, meal photos are **never** included in
the sync payload at all (stripped client-side before the request is
even built) — if a sync ever fails outright, the far more likely cause
is a stale Apps Script deployment (Deploy → Manage deployments → ✏️ →
New version → Deploy); Test Connection's debug log will call this out
by version number when that's the case.

# Changelog — v12.5.0 (quote/photo-card rotation no longer tied to the wallpaper toggle) → history below

## v12.5.0

**Real bug fix: quote/photo card rotation silently depended on the
wallpaper toggle.** `scheduleBackgroundRotation()` required
`S.settings.bgOn` (the app-wide wallpaper on/off switch) to be true
before scheduling ANY automatic photo rotation — but the Today's Focus
card, the habit quote card, and every module's motivation card (Finance,
Routine, Diet, Goals, Debts, Subscriptions, Assets, Documents) display
their photo regardless of that wallpaper setting, and nothing in Settings
suggested the two were linked. Net effect: anyone with the wallpaper
turned off got zero automatic rotation on any of those quote/photo cards
either, no matter what interval they picked. Fixed — rotation now runs
off `S.settings.bgAuto` alone; the wallpaper toggle only controls the
wallpaper.

**Settings reorganized to make the split explicit.** What was one
"Background & photos" group is now two: **"Quote & photo cards"** (the
always-on-by-default images behind every quote/motivation card —
rotation toggle, interval, Change now) and **"Wallpaper"** (the separate,
much fainter app-wide backdrop — on/off + strength only, no duplicate
rotation controls, with a note that it follows the same schedule/button
above). Same settings, same IDs, same underlying image set — just grouped
so it's clear "Rotate every 30 minutes" and "Change now" affect the quote
cards whether or not the wallpaper is on.

# Changelog — v12.4.0 (real flash-on-open fix, habit rename, Diet back-button fix, app-wide photo rotation) → history below

## v12.4.0

**Navigation — the actual cause of the "random screen" flash, found.**
The v12.3.0 fix only hid nav/FAB during onboarding; it didn't touch the
real bug people kept seeing on every launch. Root cause: the static HTML
always paints Dashboard first (it's the only screen marked active in the
markup, so it's on screen the instant the page renders, before any JS
runs) — `init()` would then restore whatever screen you were last on a
beat later, and that swap (Dashboard → Documents/Coach/wherever) is what
looked like a random flash. Fixed by hiding `<main>` itself (not just
nav/FAB) until `#app` is `.ready`, and reordering `init()` so the restore
screen is resolved and switched to *before* `.ready` is set — the first
thing you ever see is now the correct screen, full stop.

**Navigation — Back could exit straight to a blank screen.** Restoring
the last-used screen on launch used `history.replaceState`, which leaves
only one history entry. Pressing Back immediately after opening a
restored (non-Dashboard) screen had nothing in-app to fall back to, so it
fell through to whatever was in the tab's history before the app (or
closed the PWA outright) — this is what showed up as an empty screen on
Back "in several areas." Now uses `pushState`, so Dashboard sits one
Back-press behind the restored screen, same as normal in-app navigation.

**Navigation — Diet screen was missing its back button entirely.** Every
other module screen reached from "More" has a "‹ More" link at the top
(which is also what makes the floating back arrow — the same one Settings
uses — appear). Diet never had one, so from Diet there was no way back
except the bottom nav's Home tab. Added, matching its siblings exactly.

**Habits — you can now rename (or delete) an existing habit.** "Manage"
previously opened the same "add new habit" form as the `+` button — there
was no way to edit one you'd already created. It now opens a real list of
your habits with an **Edit** button per habit (name, icon, type,
target/unit, linked routine category — everything the add form has) plus
delete, with a confirm prompt before deleting (it explains this removes
that habit's logged history too). Adding a new habit is still one tap
away from the same screen.

**Photos — "Change now" and auto-rotation now actually change everything
on screen, immediately.** The infrastructure (background toggle,
auto-rotate, interval, a shuffle button) already existed, but it only
ever swapped the faint app-wide wallpaper layer and pre-warmed new image
URLs for *next time* — whatever hero/quote/motivation photo was already
visible kept showing its old picture until you navigated away and back.
That's what made it look like only the empty-state photos were
controllable. Fixed: both "Change now" and every scheduled rotation now
also re-apply the photo on whatever's currently on screen (Dashboard's
hero card, the Habits quote card, and the active module's motivation
card) — instantly, with everything else on screen left untouched.
- **Rotate every** now includes 30 minutes and 3 hours, plus a **Custom…**
  option with a plain minutes field — so "change 15 to 30 or something"
  (or any other value) no longer needs a code change.
- Renamed "🔀 Shuffle now" → "🔀 Change now" to match, and reworded the
  section intro to make clear it's one photo set covering the wallpaper
  *and* every hero/quote/motivation card app-wide — not a separate,
  empty-state-only control.

# Changelog — v9.5.0 apps-script (batched sync writes — was the real cause of slow syncs) → history below

## v9.5.0 (apps-script.gs)

**Sync speed.** Root cause of "sync takes too long": every one of the 15
readable tabs was written with `appendRow()` called once per header row
and once per data row — each `appendRow()` is its own network round-trip
to the Sheets service. With real amounts of habits/transactions/routine
blocks/journal entries/etc, that was easily 100–300+ separate API calls
on a single sync. Rewrote every tab writer to build a plain 2D array in
memory first (fast, no API calls involved) and write it in one
`clearContent()` + one `setValues()` call via a new `writeSheet()`
helper — each tab now costs ~2 calls total no matter how many rows it
has. No tab names, columns, or the `rows` counts returned to the app
changed — this is a drop-in replacement (paste + redeploy, no client
changes needed, though `index.html`'s `APP_SCRIPT_VERSION` was bumped to
match so the version-mismatch check still works). The Reports tab is
deliberately untouched (still a plain `appendRow`) since it's meant to
accumulate one row per sync, not reflect current state — it was already
a single call, never part of the slowdown.

# Changelog — v12.3.0 (nav-state fixes, font/heading redesign, 3 new themes, icon pack cleanup) → history below

## v12.3.0

**Navigation / screen-state**
- **Fixed the onboarding screen briefly showing the Home/nav buttons and
  the `+` button behind it on first launch.** Root cause: nav and the FAB
  were always in the DOM and only visually behind the onboarding overlay
  by z-index — on slower loads there was a flash before that overlay
  painted. Nav/FAB are now hidden (not just covered) until the app
  explicitly marks itself ready — right after onboarding completes, or
  immediately if no onboarding is needed.
- **Added real "last screen" persistence.** Nothing previously remembered
  which screen you were on, so a killed/relaunched app (or a phone that
  restores a stale hash on its own) had no consistent landing spot.
  `goToScreen()` now saves the current screen name on every navigation;
  `init()` restores it on launch instead of always forcing Dashboard
  (Settings is exempted — it always reopens on its hub, never mid-category,
  same rule the v12.2.0 Settings-back fix already established).

**Typography**
- **Font selector redesigned.** The old "App font" control was a tall
  scrolling list of big preview cards, which made Settings unnecessarily
  long. Replaced with two compact, clearly separated native dropdowns —
  **App Font** and **Mono Font** (mono already was a dropdown; app font
  now matches it) — both natively scrollable with no extra markup needed.
- **New: Font Weight/Style control**, independent of family — Regular /
  Medium / Semibold / Bold / Extra Bold / Italic / Bold Italic — applied
  to all headings via a new `--font-weight-head`/`--font-style-head` pair.
  Changing font or weight now only ever touches typography variables,
  never theme/pack color or layout — verified no call site does both.

**Readability**
- **Fixed a real contrast bug: section headings ("Quick Actions", "Top
  Priority", every screen's section title, settings-group headers, quick
  action labels) were rendered in the dim `--sub` secondary/caption color**
  instead of a proper heading color — fine for captions, too low-contrast
  for a heading, and made worse on light packs like Skyglass. Introduced a
  dedicated `--heading-color` variable (defaults to the theme's full-
  contrast text color) and moved those rules onto it.
- **New: user-controlled Heading color**, Settings → Appearance — a color
  picker independent of the accent color and the active theme, with a
  one-tap "Reset to theme" to go back to the default. Persists across
  theme/pack changes until explicitly reset.

**Themes**
- **Three new Experience Packs**: **iOS** (frosted glass, San Francisco
  font stack, blue/indigo accent), **Android** (bold Material greens,
  pill-shaped buttons, big rounded tiles, Roboto), and **Retro Mobile**
  (chunky, high-contrast, monospace-flavored — inspired by 2000s
  messenger-phone UIs). All three are "inspired by", not pixel clones of,
  a real OS — a literal copy would also risk another company's actual UI/
  trademarks. They reuse the existing Life OS layout/nav/FAB engine with
  their own color palette, font pairing, and default icon style.
- **Fixed a discoverability gap**: the theme picker is a horizontal-scroll
  strip with its scrollbar intentionally hidden, which gave no visual clue
  more packs existed off-screen (2 fit on a typical phone screen; there
  are now 7). Added a fixed fade-out edge + a "More ›" chip so the overflow
  is obvious without a visible scrollbar.

**Icons**
- **Simplified the icon pack picker from 10 options down to 4**: kept
  Emoji, Sticker, and Vivid; removed the six near-identical geometric
  variants (Auto, Outline, Filled, Duotone, Rounded, Minimal, Hand-drawn —
  one shared line-art geometry differing only in stroke/fill, which read
  as redundant clutter next to genuinely distinct packs). Replaced them
  with one new **iOS** icon pack — glossy squircle tiles in your accent
  color with a soft top-gloss highlight, real per-key artwork (not a CSS
  filter). Anyone with an old removed style saved is migrated to Emoji
  automatically. The underlying geometry these six drew from is untouched
  in the stylesheet — re-adding any of them later is a pure data change,
  not new artwork (see BLUEPRINT.md §9).

**Settings cleanup**
- Removed the "Daily Quote" card that sat at the top of the Settings
  screen — decorative, not a setting.
- Removed the General → "Icon letter / emoji" alternate-icon generator
  (custom initials/colors + a canvas-rendered downloadable icon set) —
  redundant now that the app has a fixed brand logo everywhere. Its
  now-unused settings fields, form bindings, and click handler were all
  removed together, not just hidden.

**Layout**
- Audited the Add-button-next-to-heading pattern (`.section-head`) — it
  was already flexbox with no absolute-positioning hacks, so no drift bug
  existed. Hardened it further: `gap`+`flex-wrap` so a long heading next
  to "+ Add" can't force horizontal overflow on the narrowest phones, and
  the button no longer shrinks below a comfortable tap target.

**Scrolling**
- Added `touch-action:pan-x` + `overscroll-behavior-x:contain` to the two
  horizontal-scroll strips (Experience Pack picker, Icon Pack picker) so
  swiping them doesn't fight or chain into the page's vertical scroll.
  Main-screen scrolling itself was already tuned in v12.1.1 (smooth
  scroll, touch scrolling, overscroll containment) — left as-is.

**About**
- Reviewed the About screen content — it already reads as a finished
  product description (feature list, privacy stance, credits), not
  placeholder copy, so it's unchanged apart from a small chip reflecting
  the new theme count.

## v12.2.0

- **Fixed the visible delay/black-flash on every background photo** (Daily
  Quote card, the Focus hero card on Dashboard, and the empty-state photo
  card on every module including Goals and Documents). Root cause: the app
  was setting `background-image` to a gradient+photo pair the instant a
  screen rendered, before the photo had actually downloaded — a background
  layer with an unloaded `url()` paints as fully transparent, so with
  nothing behind it that read as a slow, blank, or broken image. Worst on
  screens like Goals/Documents that are opened less often, since their
  photo was almost never warm.
  Fix: the photo is now only swapped in once it's actually finished
  loading; until then the card shows its themed CSS gradient instantly
  (never blank), and a failed load quietly keeps that gradient instead of
  showing a broken image. Today's photos are also now pre-fetched right at
  startup, before the first screen even renders, instead of after.
- **Fixed Settings back-button/back-gesture sometimes landing on a stale
  or empty-looking screen.** Drilling into a Settings category (e.g.
  Appearance) never registered with the browser's back history, so the
  system/gesture Back button could skip past Settings entirely, and
  reopening Settings afterward could show it still stuck on whatever
  category was last open instead of the hub. Settings now always opens
  fresh on the hub, and each category drill-in has its own back-history
  step, so Back reliably steps out one level at a time.
- **New default look: Skyglass experience pack**, 50% glass transparency,
  background photo + auto-rotate turned on out of the box, and a new
  default font pairing — SF Pro for headings/body, IBM Plex Mono for
  numbers. Existing installs are migrated to this once automatically;
  anything you change afterward sticks.
- Small copy polish on the About screen.

## v12.1.0

- **Fixed a real bug: the Glass intensity slider wasn't visibly doing
  anything.** Two causes, both fixed: (1) the glass-card CSS rule only
  targeted `.card`/`.dash-tile`/`.quote-card`/`nav.bottom` — Settings
  panels, stat tiles, and modals all had their own hardcoded solid
  background outside that rule, so the screen most people check first
  (Settings) never visibly changed. Folded those in. (2) The opacity
  percentage was computed with `calc()` inside `color-mix()`, which
  doesn't render reliably on every mobile browser — switched to a
  precomputed plain percentage instead.
- **Diet Plan redesigned to be scannable, not a wall of text** — food
  sources are now small emoji chips (🥚 Eggs, 🍚 Rice, 🥑 Avocado, etc.)
  instead of bulleted sentences, macros are 4 compact emoji tiles, and
  the Do/Don't sections are short one-line tips with an icon instead of
  full paragraphs.
- **New: settable daily calorie goal**, in Settings → Diet & body stats,
  right under Goal — "Auto" (calculated from your stats, as before) or
  "Set it myself" with a manual kcal number. Either way the Diet tab's
  targets, the Calories-left ring, and the Diet Plan all read from the
  same number, so it stays linked instead of becoming a separate figure.
  Manual mode also works even without height/weight/age on file.
- Re: the animated timer — "Scenic" (Settings → Appearance → Timer style)
  is that feature. It's an original rotating pastel/gradient design
  rather than a copy of the specific illustrated characters in the
  reference (can't reproduce copyrighted artwork), which may be why it
  didn't look like what was expected.

# Changelog — v12.0.9 (focus timer is now genuinely full-screen, Skyglass tuning, glass intensity control) → history below

## v12.0.9

- **Focus timer is now a true full-screen page**, not a small modal —
  Plant, Ring, Digits and Scenic all now cover the whole screen while a
  session is running, closer to the reference. Tapping ✕ just minimizes it
  (the session keeps running in the background, same as before); reopen it
  from the running-timer bar or the running category chip.
- **Plant style rebuilt to fill the screen** at reference proportions — a
  much bigger leaf badge, same speech-bubble/time/progress-track styling,
  same transparency levels throughout, instead of being squeezed into a
  small card.
- **Skyglass now defaults to the Emoji icon pack.**
- **New "Glass intensity" slider** in Settings → Appearance, right below
  Experience Pack — higher is more see-through and blurred ("crystal
  clear"), lower is more solid/readable. Only visually affects glass-card
  packs (Aurora, Skyglass); everything else is unaffected.
- Applied the Skyglass gradient background at the `body` level too (not
  just the app shell), so there's no flat-color flash anywhere in the app.
- Audited icon/theme consistency across every screen — nav, module cards,
  and all icon-pack coverage (Sticker/Vivid) were confirmed consistent;
  no per-screen fallback gaps found.

# Changelog — v12.0.8 (real theme-reset bug fixed, timer removed from habit rows, Diet Plan feature, Skyglass pack) → history below

## v12.0.8 — bug fix + feature pass

- **Fixed a real bug: changing the mono/number font (or an accent color)
  was silently resetting the entire color scheme.** Root cause: those
  inputs called the full theme-apply function, which re-applies the whole
  Theme Preset color set (background/cards/text — defaulting to a plain
  dark preset) on top of whatever Experience Pack was actually showing
  (e.g. Aurora), with nothing re-applying the pack afterward. Both inputs
  now touch only the one CSS value they're actually responsible for —
  picking a font or an accent color no longer touches your background,
  cards, or icon pack. Confirmed the Timer style picker never had this
  problem in the first place.
- **Removed the ▶ timer button from habit rows.** Starting a timed session
  is Routine-tab only now (via Start Log); habit rows just log amounts.
- **Removed the default "Reading" habit** added in v12.0.7 (only removes
  the untouched auto-added one — never touches a Reading habit you made or
  logged something to yourself). The Reading routine category + its timer
  stay.
- **New "Diet Plan" feature** — a 🩺 button on the Diet tab builds a
  doctor-style write-up from the height/weight/age/activity/goal already
  saved in Settings → Diet & body stats: BMI + category, daily
  calorie/macro targets, a suggested meal structure, food suggestions by
  protein/carbs/fat/fiber, and goal-specific do's and don'ts — with a
  plain note to involve a real doctor for any existing condition.
- **Added a "Calories left" progress ring** to the Diet tab's targets
  card, next to the daily target numbers.
- **New "Skyglass" Experience Pack** — a blue-to-pink glassmorphic theme
  (translucent cards, soft wave gradient background) modeled on the
  reference image, with contrast tuned up from the reference on purpose so
  it stays easy to read in daily use rather than just in a screenshot.

# Changelog — v12.0.7 (real duration bug fix, human time formatting, Quick Log rework, Scenic timer style, journal rewritten as a list, Reading/Sleep timers, Vivid icon pack) → history below

## v12.0.7 — bug fix + another large feature pass

- **Fixed a real duration bug.** A block where start and end were the same
  time (e.g. 7:50 PM–7:50 PM) was being computed as a full 24 hours instead
  of 0 — the midnight-rollover check used `<=` instead of `<`. Fixed.
- **Durations now read in plain minutes/hours** instead of confusing decimals
  — "0.5h" and "0.3h" are gone, replaced with "30 min", "10 min", "1 hr 30
  min", etc. everywhere a duration is shown (Routine totals, blocks list,
  category breakdown, dashboard, day-detail popup).
- **Quick Log reworked.** Chips now wrap across multiple lines instead of
  one scrolling row. Tapping a category only SELECTS it — nothing starts
  recording. A new **Start Log** button underneath actually begins the
  session and opens the timer page; tapping the running category again
  reopens its timer instead of risking an accidental stop.
- **Timer page always opens** when a session is started via Start Log (not
  only for Meditation), shows which category is running, and has a Stop
  control right there.
- **Plant timer style redesigned** to match the reference closely: green
  gradient card, "Stay focused 😊" speech bubble, circular badge, big time,
  thin progress track with a traveling dot, full-width Stop pill.
- **New "Scenic" timer style** — a 4th option alongside Plant/Ring/Digits:
  a rotating pastel illustrated-style background (different look each
  session), big clock-style time, category label, round stop button.
- **Journal rewritten from one note per day to a list of entries.** Every
  save now adds a new entry; a day's entries list below with Edit and
  Delete. Delete can be turned off in Settings → Journal (Edit still
  works) if you'd rather entries not be removable. Every place that read
  the old single-entry format (word counts, calendar dots, day-detail
  popup, search, PDF/Excel exports) was updated to match.
- **Added Reading as a habit + routine category** (10/20/30/45-min quick
  amounts, timer-enabled) and **turned the timer on for Sleep** too, so
  both work the same way Meditation already did.
- **New "Vivid" icon pack** — colorful rounded-square badges, a different
  hue per module, alongside Emoji/Sticker/Outline/etc. in Settings →
  Appearance → Icon pack.

# Changelog — v12.0.6 (top motivation cards, floating back button, roomier inputs, more light themes, Aurora pack, Meditation + focus timer, single-segment template apply) → history below

## v12.0.6 — a large UX + feature pass

- **Custom-amount input in habit rows was cramped.** Bumped its height/padding
  (and the Add/collapse buttons next to it) so typing there feels comfortable
  instead of squeezed.
- **Added a floating back button.** '‹ More' and '‹ All settings' sat at the
  top of the screen — a long one-handed reach. A small circular back button
  now floats in the thumb zone on any screen with a back link (and inside
  Settings categories), doing the same thing.
- **Moved the photo/quote motivation cards to the top of every screen.**
  They used to only appear buried in an empty list. Routine, Finance, Debts,
  Diet, Goals, Subscriptions, Assets, and Documents now show them right at
  the top, above the main content — always visible, not just when empty.
- **Four new light theme presets:** Ivory, Sand, Lilac, Sage — the color
  preset grid skewed heavily dark before this.
- **New "Aurora" Experience Pack — now the default.** Warm coral/plum
  gradient palette with glass-style cards and rounded dial widgets, modeled
  on a warm readiness-app reference. Existing installs are migrated to it
  once; picking any other pack afterwards sticks normally.
- **Added a Meditation habit + Meditation routine category**, merged into
  existing data automatically (won't duplicate or remove anything you
  already have).
- **New focus timer** for Meditation (and anything else marked as a timer
  category): three selectable styles — Plant (green, grows with progress +
  a slider bar, the default), Ring (circular progress), and Digits (big
  hrs/min/sec readout) — picked in Settings → Appearance → Timer style.
  Start it from the Routine quick-log chip or the ▶ button on the
  Meditation habit row; Stop logs the elapsed time to both the routine
  block and the linked habit automatically.
- **Templates can now be applied one segment at a time.** Each block in the
  Templates modal has a "+ Today" button to add just that one time segment
  to today's log, alongside the existing "Apply to today" (whole day) and
  "Fill this week" options.

# Changelog — v12.0.5 (bottom nav breathing room) → history below

## v12.0.5

- **Bottom nav buttons had no space between them.** They sat flush
  edge-to-edge on mobile with no visual gap, making the row feel
  cramped. Added a small gap between buttons (and tightened their
  internal padding to compensate) so each tab has breathing room
  without the bar overflowing on narrow screens.

# Changelog — v12.0.4 (nav dead-space fix, finance score bug, About consolidated, new Sticker icon pack, motivation cards on 9 modules, trend chart rebuild) → history below

## v12.0.4 — a large fix/feature pass

- **Fixed the nav dead-space bug.** `body.exp-nav-lifeos nav.bottom` still
  had leftover `padding-left/right:36px` from before the dedicated
  `.nav-fab-spacer` existed (v12.0.1) — the two were double-compensating
  for the FAB, leaving visible empty space at both ends of the nav bar
  (the circled area around Home/More). Padding removed; the spacer alone
  now handles FAB clearance correctly.
- **Fixed a real score bug:** the Finance tab's sub-score unconditionally
  factored in a "subscriptions due" score even with **zero subscriptions
  tracked**, dragging the score toward 50% regardless of actual progress
  (confirmed: overdue debts correctly scored 0, untracked subscriptions
  wrongly scored 50, averaging to exactly the reported 50%). Now guarded
  the same way debts already was — an untracked module contributes
  nothing to the score, same "only count what's in use" rule documented
  elsewhere in this file. Live-update was already working correctly
  (debt actions already called `renderDashboard()`) — this was purely a
  bad formula, not a stale-refresh issue.
- **About consolidated — one tap, not two.** The Settings → About
  category previously drilled into a sub-list containing exactly one
  row, which then opened the About modal — two taps and a screen
  transition for one piece of info. The hub's About row now opens the
  modal directly; the redundant category/settings-group was removed.
- **New "Sticker" icon pack — genuinely different geometry, not another
  fill/stroke variant.** The existing Outline/Filled/Duotone/Rounded/
  Minimal/Hand-drawn styles all share one path-geometry set and only
  differ in stroke/fill, which is why they read as "all similar" next to
  Emoji (a completely different rendering method). Sticker is real new
  artwork — bold filled circle-badge icons, 19 keys — selected the same
  way Emoji is, with its own live preview in the picker. **The existing
  6 styles are completely unchanged**, per direct request not to touch
  them.
- **Motivational empty-state cards extended to 6 more modules** — Debts,
  Diet, Subscriptions, Assets, Documents, Goals (previously only Habits/
  Routine/Finance had them). New content added to `MOTIVATION_CARDS` for
  each. New **per-module toggle** (Settings → Modules & Data →
  "Empty-state photos") alongside the existing all-or-nothing General
  toggle — e.g. turn off just Diet's cards without losing them elsewhere.
- **Trend chart rebuilt** to match the referenced style: smooth spline
  (no area fill), the highest and lowest points highlighted in green/red
  with a small custom Chart.js plugin drawing dashed vertical droplines
  to the axis, two-line date+weekday labels (e.g. "27 Aug" / "Thu"), and
  a new **Day / Week / Month period selector** above the chart
  (`trendBuckets(period)` — day: last 14 days, week: last 8 weeks
  averaged, month: last 6 months averaged).
- **Verified:** `node --check` (pass), `getElementById` cross-reference
  (zero mismatches), `<div>` balance (706/706), plus a standalone Node
  check confirming `STICKER_ICONS` (19 keys) and `MOTIVATION_CARDS`
  (9 modules) both parse with the expected content.
- **Deferred, not done in this pass:** moving the motivation card to a
  guaranteed fixed "top of screen" position on every module — currently
  it renders immediately before that module's own empty-state block,
  which is at the top of the *list* but not necessarily the top of the
  *screen* if other cards/summaries sit above that list. Doing this
  properly means auditing each screen's layout individually rather than
  a single shared fix; flagged rather than guessed at.

---

# Changelog — v12.0.3 (version fix, routine 12h, habit fields, motivation cards, categorized Settings, sticky headers, real font picker) → history below

## v12.0.3 — a large fix/feature pass, several real pre-existing bugs found along the way

- **Single version source of truth.** New `const APP_VERSION` — the About
  screen and the Settings row both read from it now instead of two
  separately-typed strings that had drifted (10.0.3 vs 12.0.2). Also
  removed the stale "(backend unchanged from v9.4.1 — no redeploy
  needed)" line from About per direct request.
- **12-hour AM/PM time display** for routine blocks, everywhere the app
  renders a time as text (Today's Routine list, Routine Templates modal).
  New `fmt12()` helper. Honest limitation: the native `<input
  type="time">` picker widget itself is OS/browser-controlled, not
  something CSS/JS can force into 12h format — this fixes every place
  the app *displays* a time, not the native picker's own UI.
- **Habit "Quick-add preset amounts"** converted from a single
  comma-separated text box to the same one-line-input-plus-Add-button
  chip pattern already used for Reminder times right next to it — type
  one amount, tap Add, see it as a chip, tap ✕ to remove.
- **Contextual empty-state motivation cards.** When Habits, Routine, or
  Finance have nothing logged yet, a photo+quote card now shows (same
  hero-photo-card visual language as the Home hero and Habit quote
  card), picked from a small curated set per module and rotating daily
  (same day-index mechanism as the existing daily quote — refreshes
  automatically at midnight). New Settings toggle: General → "Motivational
  empty-state cards" (default on).
- **Categorized Settings**, matching the reference pattern: a top-level
  hub (General / Appearance / Communication / Backup & Restore /
  Modules & Data / About) that drills into the relevant existing
  settings-groups. **Every existing settings-group's markup, ids, and
  listeners are completely unchanged** — this only tags each with
  `data-cat` and shows/hides by category; zero risk to existing
  functionality.
- **Sticky back/close buttons.** Every screen's back button and every
  modal's close button now stay pinned at the top while the content
  underneath scrolls, instead of scrolling away and forcing a
  scroll-back-up just to leave a screen or close a modal.
- **Real, working font picker — found and fixed a genuine pre-existing
  bug.** The old "Heading font"/"Body font" dropdowns wrote to
  `S.settings.fontHead`/`fontBody`, but `applyExperiencePack()` never
  read those values back — it only ever used the current pack's own
  font tokens, so picking a font silently did nothing, every session,
  since v10.0. Replaced with one unified "App font" picker (10 fonts:
  Inter, SF Pro, Manrope, Plus Jakarta Sans, Roboto, DM Sans, IBM Plex
  Sans, Geist, Outfit, Nunito Sans — each row shows a live sample
  sentence in that font) and fixed `applyExperiencePack()` to actually
  read `S.settings.fontHead`/`fontBody` first. **Plus Jakarta Sans is
  now the default**, with a one-time migration forcing it for existing
  installs (same reasoning as the v12.0.2 icon-pack migration — the old
  default was already saved explicitly, so a `defaultSettings()` change
  alone wouldn't have reached anyone who'd already opened the app once).
  **SF Pro is deliberately not a Google Fonts file** — it isn't licensed
  for that — it uses the real system font stack instead
  (`-apple-system, BlinkMacSystemFont, ...`), which renders as actual
  San Francisco on iOS/Mac and falls back gracefully elsewhere.
- **Crash caught and fixed before shipping:** removing the old font
  `<select>` elements would have left a generic settings-binding loop
  calling `.addEventListener` on `null`, throwing at init and halting
  every settings listener registered after it in that loop. Caught by
  the standard id cross-reference check, fixed by removing those two
  entries from the loop.
- **Verified:** `node --check` (pass), `getElementById` cross-reference
  (zero mismatches, including catching the crash above), `<div>` balance
  (702/702).

---

# Changelog — v12.0.2 (native Emoji icon pack, now default) → history below

## v12.0.2 — Emoji icon pack (default), plus two bugs fixed along the way

- **New "Emoji" Icon Pack option — and it's now the default.** Matches
  the pre-v10 app exactly (screenshots: 🏠 Home, ✅ Habits, 💰 Finance,
  ⏱️ Routine, 🥗 Diet, ⋯ More, plus every More-screen module: 🎯 Goals,
  📆 Calendar, 🤖 AI Coach, 📔 Journal, 💊 Health, 🏦 Debts/EMI, 🔁
  Subscriptions, 🏛️ Assets, 📈 Trends, 🧾 Reports, 🗂️ Documents, ⚙️
  Settings). These emoji were never deleted — `MODULE_DEFS` has always
  carried an `.icon` (emoji) field alongside `.iconKey` (geometric key);
  v10.0's Experience Engine just stopped reading it. `EMOJI_MAP` reuses
  that field directly rather than re-typing 24 emoji by hand.
- **New `chromeIcon(key, size)`**, used only at real nav/module chrome
  call sites (bottom nav, More screen, dashboard Quick Actions, universal
  create sheet). Checks the live icon style
  (`S.settings.iconStyleOverride || currentPack().iconStyle`) and renders
  the native emoji when it's `'emoji'` and a mapping exists, otherwise
  falls back to the existing geometric SVG. **`icon()` itself is
  untouched** — still pure-geometric — so the Icon Pack preview grid
  (which must show each style's *true* appearance, not whatever's live
  right now) and the habit icon picker (no emoji equivalents, always
  geometric) aren't affected.
- **One-time migration for existing installs.** `iconStyleOverride`
  already existed (as `''`) from v12.0.1, so simply changing
  `defaultSettings()` wouldn't reach anyone who'd already loaded the app
  once — their saved `''` would keep overriding the new default via the
  existing `Object.assign(defaultSettings(), S.settings)` merge. Added a
  one-time `S.settings._iconMigrationV1202` guard in `loadState()` that
  forces `iconStyleOverride` to `'emoji'` exactly once; any choice made
  after that (including switching back to Auto) sticks normally.
- **Two pre-existing bugs fixed while in this code:**
  1. `loadState()`'s invalid-pack fallback still pointed at `'glass'`,
     removed from the roster in v12.0.0. `packById()`'s own internal
     fallback (`EXPERIENCE_PACKS[0]`) made this harmless in practice, but
     the stored value was wrong/confusing. Now falls back to `'lifeos'`.
  2. (Carried from v12.0.1's changelog, unrelated to this fix — no new
     bug here, just confirming it's still correct after this pass.)
- **Verified:** `node --check` (pass), `getElementById` cross-reference
  (zero mismatches), `<div>` balance (669/669), and a standalone Node
  sanity check confirming `EMOJI_MAP` builds all 24 expected keys with
  the exact emoji from the reference screenshots.

---

# Changelog — v12.0.1 (nav fix, hero-photo quote, standalone Icon Pack) → history below

## v12.0.1 — nav spacing fix, hero-photo Habit quote, standalone Icon Pack

Three direct pieces of feedback on v12.0.0:

- **FAB was crowding Finance/Routine.** The raised center FAB had no
  dedicated space — whichever nav button landed in the middle slot sat
  directly under it. `renderBottomNav()` now inserts a `.nav-fab-spacer`
  (58px) at the middle position whenever the active pack's `navStyle` is
  `'lifeos'`, so the flanking buttons get real breathing room instead of
  overlapping the FAB.
- **Habit screen's "Quote of the day" now uses the photo-hero treatment**
  from the Home screen — same picsum-photo + gradient-overlay + bold-quote
  style, applied via a new `.hero-photo-card` class on the existing
  `.quote-card`. Uses a **stable per-day seed** (`...-habitquote-<today>`)
  so the photo doesn't reshuffle on every render, only once per day.
- **New standalone Icon Pack selector**, decoupled from both the
  Experience Pack and the color Theme Presets — same "fine-tune layer on
  top of the current pack" pattern §5's `THEMES` already established for
  color, applied to icon rendering style instead. Settings → Icon pack
  shows a horizontal strip (Auto/Outline/Filled/Duotone/Rounded/Minimal/
  Hand-drawn) with a live 2-icon preview per option; picking one applies
  instantly and persists across pack/theme changes until set back to
  Auto. New `S.settings.iconStyleOverride` field (default `''` = pack
  default), read by `applyExperiencePack()` in place of `p.iconStyle`
  when set. **No new icon geometry or CSS was needed** — this exposes the
  icon-style-swapping mechanism that already existed in the v10.0
  Experience Engine (§9) as its own control, since it was previously only
  reachable by switching whole packs.
- Clarifying the color-swatches-only confusion: **Theme Presets (the
  panel with Midnight/Ocean/Forest/etc.) are colors only, by original
  design** (BLUEPRINT §5) — they were never meant to carry layout/photo
  elements like the hero card. That structural look lives in the
  Experience Pack (`layout:'lifeos'`), which both current packs already
  use, and now the Habit quote card uses it too (this entry). If more
  photo-hero moments should appear elsewhere in the app, or more
  Experience Packs should be added with their own distinct structure
  (per the earlier "expand after you approve the direction" plan), that's
  a follow-up, not something Theme Presets should be stretched to do.
- **Verified:** `node --check` (pass), `getElementById` ↔ `id="..."`
  cross-reference (zero mismatches), `<div>` balance (669/669).

---

# Changelog — v12.0.0 (Life OS rebuild) → history below

## v12.0.0 — Life OS: new Home screen, new icon pack, universal FAB, 2 flagship Experience Packs

A full visual rebuild on top of the v10.0.0 base, per direct reference
(a "Life OS"-style mockup). **No data model changes beyond one new
optional field (`h.iconKey`) and no feature removed** — every module,
screen, and piece of data works exactly as before; only how you look at
and add things changed.

- **New Home screen.** Replaced the old score-ring + generic tile grid
  with: a **Focus / Health / Productivity / Finance segmented control**
  (`#focusTabs`, `activeFocusTab`) that swaps a domain-specific score,
  quote, and 3-4 stat rows; a **photo + quote hero card**
  (`.hero-focus-card`, picsum-sourced background, per-tab caption); a
  **Daily Progress card** (ring + stat-row list, `.progress-card`); and an
  icon-based **Quick Actions row** (`.quick-actions-row`). All of it reads
  the exact same computed values the old dashboard did (`habitPct`,
  `routineMin`, `spentToday`, `dt`/`calToday`, `wh`/`sh`, `overdueDebts`,
  `goalProgressCalc`) — this is a presentation change, not a new data
  pipeline. Top Priorities list is unchanged data, restyled only.
- **New curated icon pack.** 20 new geometric icons added to the existing
  `ICONS` set (water, run, meditate, sleep, sun, heart, brain, pill,
  wallet, plant, guitar, code, paint, alarm, apple, bike, gratitude, and
  more) — see `HABIT_ICON_KEYS` for the curated subset shown in the
  picker. New `habitIcon(h, size)` helper renders the curated icon when
  `h.iconKey` is set, and **falls back to the old free-text emoji**
  (`h.icon`) for every habit created before this version — nothing about
  existing habits changed or needs migrating.
- **Habit icon picker.** New Habit's old `<input type="text">` emoji
  field is replaced with a tap-to-select grid of the 20 curated icons
  (`.icon-picker-grid`), plus a "use a custom emoji instead" fallback
  for anything not in the curated set. Existing habits are untouched;
  this only changes what *new* habits pick from.
- **One universal FAB.** Removed the 9 screen-scoped `fabAdd*` buttons
  (habit/tx/routine/debt/meal/goal/sub/asset/doc), same consolidation
  pattern as before: one `#fabUniversal` at app-shell level, direct-fires
  the obvious action on a screen that has one, opens a contextual create
  sheet (`openCreateSheet()`, `CREATE_ACTIONS`) everywhere else, filtered
  by `S.settings.modules` exactly like the More screen already was.
- **Experience Packs: 21 → 2 flagship packs.** Per direct request, the
  old pack roster is replaced with **Life OS** (light) and **Life OS
  Midnight** (dark) — same structure, different palette, matching the
  reference image exactly. Both use two new component variants:
  `navStyle:'lifeos'` (floating rounded nav bar) and `fabStyle:'lifeos'`
  (a raised gradient circle centered and overlapping the nav bar, border
  color-matched to `--bg` so it reads as "cut into" the bar). New CSS
  only for these two variant classes — the rest of the Experience Engine
  (icon styles, card styles, token flow) is unchanged infrastructure.
  **The old 21-pack CSS is left in place, unreferenced but harmless** —
  nothing was deleted, so re-adding any of the old 21 later (per the
  "expand after you approve the direction" plan) is a data-only change,
  not a CSS rewrite.
- **"Many personalities" pack picker.** `drawExperienceGrid()` rewritten
  from a 2-column card grid to a horizontal scroll strip of rounded
  gradient-thumbnail chips, matching the reference. Also fixes a
  pre-existing bug found while touching this function: the old click
  handler called `toast(...)`, a function that doesn't exist anywhere in
  the file (the real function is `showToast`) — silently failing every
  time a pack was applied from this screen. Now calls `showToast`
  correctly.
- **Verified before shipping:** `node --check` on the extracted script
  (pass), full `getElementById` ↔ `id="..."` cross-reference (zero
  mismatches), `<div>` tag balance (659/659), and both new
  `EXPERIENCE_PACKS` entries checked against every required field
  (`accent`/`bg`/`card`/`font*`/`radius*`/`iconStyle`/`cardStyle`/
  `navStyle`/`fabStyle`/`layout`/`animSpeed`/`wallSeed`) — no typos that
  would silently fall back to unstyled defaults.
- **Not in this pass, explicitly deferred:** the v11.0.0-style tabbed
  Workspace pattern (Overview/Edit/History/Notes/AI/Analytics) is not
  included here — this session started from the v10.0.0 base per the
  files re-uploaded, and the visual rebuild was the stated priority.
  Command palette (⌘K) also not included this round — search still opens
  the existing full-screen search. Both are natural next additions on
  top of this new Home screen if wanted later.

---

# Changelog — v10.0.0 (Experience Engine) → v9.5.0 and earlier history below

## v10.0.0 — Experience Engine (20 Experience Packs)

Phase 1 of the "make GP Ledger feel like a different app per pack"
rebuild. See `BLUEPRINT.md` §9 for the full architecture. Summary:

- **20 Experience Packs** (Settings → Experience Pack, new section above
  Theme presets): Minimal, Fitness, Wellness, Habit Builder, Productivity,
  Finance, Luxury, Glassmorphism, AI Future, Nature, Material Design,
  Apple Style, Samsung Style, Cyberpunk, Gaming, Neumorphism, Kids, Elder
  Friendly, Professional Business, Magazine Style. Each is a full token
  set — colors, fonts, corner radius, icon style, card style, nav style,
  FAB shape, dashboard layout family, animation speed, background photo
  seed — applied live with `applyExperiencePack()`, no reload.
- **Theme presets narrowed to color-only.** Per the original ask ("Theme
  only controls light/dark/system, nothing else"), `applyTheme()` no
  longer touches font/radius — it's now a fine-tune layer that sits
  underneath whichever Experience Pack is active, instead of overwriting
  it. The existing 12 named palettes (Midnight, Ocean, Forest, etc.) still
  work exactly as before, just scoped to colors.
- **New shared icon system.** One SVG geometry set (`ICONS`, 24 app-chrome
  icons: nav, module tiles, dashboard tiles) rendered in 6 different
  visual styles — outline, filled, duotone, rounded, minimal, hand-drawn —
  purely via CSS class toggling on `<body>`, so no per-pack icon assets
  were needed. Includes a redesigned "person sleeping in bed" sleep icon
  (previously a crescent moon) per the reference screenshots. **Habit
  emoji icons are untouched** — those stay as free-text/emoji, since
  they're your data, not app chrome.
- **6 dashboard layout families** (rings / magazine / minimal / dense /
  glass / gamified), each pack assigned one. Restructures the dashboard
  hero and `#dashGrid` (grid columns, tile shape, hero size, imagery use)
  via CSS grid/shape rules — same `renderDashboard()` JS and element ids
  throughout, per the "no duplicate editor" rule.
- **6 card styles** (flat/glass/neumorphic/outline/soft/elevated), **4 nav
  bar styles** (floating/dock/pill/glass), **3 FAB shapes**
  (circle/squircle/pill) — all CSS-variant-driven off the same markup.
- **Chart color tinting.** The three Chart.js instances (habit trend,
  income/expense, net worth) now pull their primary color from the active
  pack's accent instead of a hardcoded hex; chart *type* per pack is not
  yet implemented (see Blueprint §9 deferred list).
- **New Google Fonts loaded:** Playfair Display, Space Grotesk, Quicksand,
  Outfit, Syne, DM Serif Display, Bricolage Grotesque, Plus Jakarta Sans —
  on top of the existing set, so every pack's `fontHead`/`fontBody` has a
  real family behind it.
- Deferred to a follow-up session (flagged in Blueprint §9, not silently
  dropped): guided multi-step habit-creation wizard, curated per-pack
  wallpaper imagery (currently reused picsum seeds), modular/reorderable
  dashboard widgets, quote-card visual redesign, full chart-type-per-pack.
- **`sw.js` `CACHE_NAME` bumped** to `gp-ledger-v10-0-0` — required, or
  installed phones keep serving the pre-Experience-Engine cached copy.
- Verified before shipping: full JS syntax check, `getElementById`/`id=`
  cross-reference (0 mismatches), structural validation of all 20 pack
  objects (required fields + valid variant-enum values), and a headless
  Playwright pass rendering the dashboard + Settings pack picker across 6
  packs with zero console errors (aside from expected sandbox network
  blocks for fonts/images, irrelevant on a real deploy).

## v9.5.0 — customizable/shareable edition

- **Modules on/off (Settings → Modules).** All 15 sections (Habits, Finance,
  Routine, Diet, Goals, Calendar, AI Coach, Journal, Health, Debts/EMI,
  Subscriptions, Assets, Trends, Reports, Documents) can now be switched off
  individually. Turned-off modules disappear from the bottom bar, the Home
  bar, and the More screen. This is what makes it practical to hand a copy
  of the app to someone who only wants habits + diet, for example, without
  them seeing your finance/EMI/journal data structures at all.
- **Smart bottom bar.** The 4 non-Home slots on the bottom bar now fill
  dynamically from whatever's switched on — habits/finance/routine/diet
  first if enabled, then other enabled modules fill any remaining slots.
  So if you only keep Habits and Diet on and then enable Debts/EMI, EMI is
  promoted straight onto the bottom bar instead of hiding inside More.
  A "More" button only appears if something didn't fit.
- **Theme presets (15, one tap, fully live).** Settings → Theme presets —
  Midnight, Ocean, Forest, Plum, Sunset, Rose, Slate, Amber, Crimson, Mono,
  Paper, Skylight, Blossom, Mint, Graphite, Neon. Tapping one repaints
  every color, card surface and corner radius instantly, no reload — this
  is on top of (not instead of) the existing custom accent-color/font
  controls.
- **Random background photos (Settings → Background).** Optional, off by
  default. A subtle photo layer behind the app, toggle on/off, "Shuffle now"
  button, optional auto-rotate on a timer (15 min / hourly / daily), and a
  strength slider so it stays a background, not a distraction. Falls back
  to no image automatically when offline.
- **Daily quote now refreshes at midnight even if the app is left open** —
  previously it only updated on next app launch/refresh; now a background
  check flips it (and the date strip / dashboard) the moment the calendar
  date changes, without needing to close and reopen the app.
- **Mobile custom-amount input visibility — root cause fixed.** On phones,
  typing into a habit's custom-amount field (e.g. changing a Water default
  from 300 ml to 100) was invisible while typing because the on-screen
  keyboard covered the field — the value was always saving correctly, you
  just couldn't see it happen. The app now scrolls the focused field above
  the keyboard automatically; this didn't reproduce on desktop because
  there's no on-screen keyboard to cover it.
- **Meal photo re-evaluation.** If Gemini identifies a meal wrong (e.g.
  calls rice what's actually chapati), a new "Not quite right? Tell it
  what this actually is" field appears after the first estimate — type a
  correction and tap "Re-evaluate with this correction" to get fresh
  nutrition numbers based on the corrected food, from the same photo.
- **Routine per-segment logging clarified**, not new: the existing "+" on
  the Routine tab already lets you add one custom time segment (e.g.
  5–6am) to just today without touching your weekday/weekend template —
  a hint now explains this directly on the Routine screen since it wasn't
  obvious that templates and one-off segments are separate things.
- Backend (`apps-script.gs`) is **unchanged** in this release — no redeploy
  needed, only replace the app files (index.html, sw.js).


## v9.4.1 patch — the actual fix for "Sync did not verify" after logging a meal photo

- **Root cause found and fixed.** Meal photos are kept as full base64 images
  in `S.diet.meals[date][].image` for the in-app preview and the one-time AI
  estimate. That field was being included in the sync payload sent to your
  Apps Script — and the full snapshot gets written into a **single Google
  Sheets cell**, which has a hard **50,000-character limit**. Even one meal
  photo pushed that snapshot well past the limit, so the write inside
  `handleSync` threw an error and the whole sync failed — showing up as
  "Sync did not verify," with no obvious connection to the meal you'd just
  logged. This had nothing to do with deployment staleness even though the
  symptom looked identical.
- **Fix**: the app now strips the photo out before syncing — only the
  nutrition numbers (already extracted from the photo by Gemini) are sent
  to the Sheet, never the image itself. Photos still show in the app's
  Diet tab and history (kept on-device), they just aren't backed up to the
  Sheet — there was never a Photos tab there to begin with.
- **Backend hardened too**: the Apps Script side now wraps the full-snapshot
  write in a try/catch. If a payload is ever too large for one cell for any
  other reason in the future, it now degrades gracefully (skips just that
  snapshot with an explanatory note, keeps every other tab working) instead
  of throwing and taking the entire sync down with it.
- Requires the same redeploy as any other `apps-script.gs` change —
  **Deploy → Manage deployments → ✏️ → New version → Deploy**.

## v9.4 patch — routine templates, EMI import, sync version-check

- **Routine → Templates (new).** The Routine tab now has a "Templates"
  button next to Categories: two fully-editable day plans — a **Weekday
  plan (Mon–Fri)** and a **Weekend plan (Sat & Sun)** — each a list of
  time blocks (category, start/end time, note) you add/edit/delete freely.
  A row of day chips lets you flip which plan applies to which day of the
  week (e.g. if your off days move from Sat/Sun to something else). Two
  action buttons apply a plan to actual logged data: **"Apply today's
  plan"** (also on the Routine tab itself, next to Quick-log sleep) fills
  in today from whichever plan matches today's weekday, and **"Fill this
  week"** does the next 7 days at once, skipping any day that already has
  logged blocks so it never overwrites real entries. The two plans ship
  pre-filled from the BPO shift / additional job / travel / home routine /
  sleep schedule you sent (weekday) and a 9-hour additional-work + BBA
  class + sleep/rest layout (weekend) — edit every time and category on
  both to match your actual schedule, and re-edit any time it changes
  (new job, new class times, etc.) since nothing about the timing is
  hard-coded into the app. Six new routine categories were added to
  support this (BPO Shift, Additional Job, Travel, Home Routine, Get
  Ready, BBA Class) — merged into your existing category list without
  touching any categories you'd already added or renamed. Templates sync
  to the Google Sheet in a new `RoutineTemplates` tab.

- **Debts/EMI pre-loaded from your sheet.** Your 10 loans/EMIs (Ather,
  Axis Finance, Axis Bank, Education Loan, Kredit Bee, Local Finance,
  Gold Loan, Credit Card, Rent, Chit) are now seeded into Debts/EMI with
  their balance, monthly EMI and due day from the sheet you sent — same
  as everything else in that tab, fully editable and deletable per entry.
  This only seeds once, the first time Debts/EMI is empty on a device —
  it will never overwrite loans you've already added or edited.

- **Sync failures now self-diagnose a stale deployment.** The single most
  common cause of "Sync did not verify" is pasting updated
  `apps-script.gs` code into the script editor without republishing it
  (Apps Script's "Save" does not update the live `/exec` URL — that needs
  **Deploy → Manage deployments → ✏️ → New version → Deploy**). The
  backend now reports its own version (`SCRIPT_VERSION`) on both ping and
  sync; the app compares that to the version it expects and, on a
  mismatch, tells you exactly that in the debug log and the failure
  alert — e.g. *"your deployed script reports v9.3 but the app expects
  v9.4 — redeploy"* — instead of a generic failure message.

## v9.3 patch — dashboard score, photo nutrition, Diet on the front page

- **Dashboard score no longer starts at ~50% for no reason.** The daily
  score ring used to blend in guessed "not logged yet" values (45%, 55%)
  for the Routine and Diet factors even on a brand-new day with nothing
  logged, which made the ring show roughly half-full before you'd done
  anything. Every factor now only counts once that module actually has
  something to measure (habits exist, you've ever logged routine time, you
  have diet targets set, you have a loan on file), and an unmet factor
  contributes 0, not a guessed middle value — so a day with nothing logged
  now correctly shows 0%, and the ring only rises as you actually log
  things.
- **Photo → nutrition estimate made far more reliable.** The Gemini request
  now forces plain-JSON output (`responseMimeType: 'application/json'`),
  which was the main cause of "could not analyze photo" failures — the
  model would occasionally wrap its answer in a sentence or markdown fence,
  which broke the JSON parser even though the photo itself was fine. Error
  handling is also more specific now (no key set, no photo chosen, network
  failure, an unreadable/blocked response, and a malformed reply are all
  reported separately) so the hint under the button actually tells you what
  went wrong instead of a generic failure every time.
- **Diet & Nutrition moved to the front page.** It now has its own icon in
  the bottom navigation bar, right next to Routine, instead of being buried
  a tap deeper inside More. The duplicate entry has been removed from the
  More menu's Track section.

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
   prompt — always sanity-check before saving. As of v9.4.1, meal photos
   themselves are kept on-device only and are not backed up to the Google
   Sheet (only the nutrition numbers are) — reinstalling the app or
   loading from a fresh device will keep your meal history but not the
   original photos.
4. Apps Script still requires a "New version" deployment after any code
   change — v9.4 now detects and tells you when this has been missed (see
   SETUP_GUIDE troubleshooting), but it still has to be done manually.
5. Quick-log timer remains single-slot (unchanged from v7).
6. AI Coach and photo nutrition both require the same Gemini key and a
   live internet connection at the moment you tap them; nothing is
   cached beyond the day's insights/estimate.
7. Documents Vault is reference-only by design — it does not store file
   attachments, scans or passwords.
8. Applying a Routine template to a day that already has logged blocks
   replaces that day's blocks (after a confirmation) rather than merging
   with them — "Fill this week" avoids this by skipping any day that
   already has something logged.
