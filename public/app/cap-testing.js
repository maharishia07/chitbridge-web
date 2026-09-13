/**
 * ── app/cap-testing.js · THE TEST PANEL, ON TOP OF THE APP ────────────────────────────────────────────────────
 *
 * Athi, 2026-09-11: *"this will be good so we can bring the test suite on top of the application to read the test
 * case and update the status and provide evidence etc. So like laptop, mobile, we enable test as a checkbox, and
 * then say which area and bring the relevant test cases, and add more issues as a plus icon."*
 *
 * ⭐⭐⭐ THE WHOLE IDEA IS THAT YOU NEVER LEAVE THE SCREEN YOU ARE TESTING. A test document in another tab means
 * reading a step, switching, doing it, switching back, and remembering what you saw. Every one of those switches
 * is a chance to lose the thread — and it is why a tester stops writing notes about three cases in, which is
 * exactly when the notes start being worth having.
 *
 * ⭐⭐ AND THE AREA IS INFERRED FROM WHERE YOU ARE. Open it on Suppliers and it shows the supplier cases. Athi
 * asked to "say which area"; the screen already knows, so it says it FIRST and lets you change it. A dropdown you
 * have to set every time is a dropdown people set wrong.
 *
 * ⚠️ NOTHING HERE IS A SECOND PATH. The panel calls the same four endpoints testing.html calls, which write to
 * the same append-only ledger through the same recorder. A result tapped here and a result tapped on the board
 * are the same row, and a Playwright run lands beside both.
 *
 * ⭐⭐⭐ EVERY SIZE AND COLOUR HERE IS A TOKEN, AND THE FIRST VERSION OF THIS FILE GOT THAT WRONG.
 *
 * Athi, 2026-09-11: *"the text size is not changing if I increase the size — I guess you have not used the
 * capability here. I am just trying to test how the capability behaves when we design a new one."*
 *
 * ⚠️ HE WAS TESTING THE CAPABILITY, NOT THE PANEL, AND THE PANEL FAILED IT. appearanceApply() scales the
 * --fs-* tokens on <html>, so `var(--fs-2)` follows a reader who chose Large or Extra large and a raw `12px`
 * does not. Thirty-six raw sizes here meant the whole panel ignored that setting — invisible to anyone who
 * never changes it, which is the worst kind of accessibility failure.
 *
 * ⚠️ THE COLOURS WERE THE SAME MISTAKE and theme-literals.cjs caught them the moment it was run: a hex
 * `color:` is dark ink with nothing painted under it, so it disappears on a dark theme.
 *
 * ⭐ The tokens INHERIT — that part genuinely works, down the DOM, live, with no import. What does not inherit
 * is the discipline of using them, and that is why the ratchet in e2e/type-scale.cjs now refuses a NEW file
 * that adds raw sizes. The cascade is the mechanism; the guard is what makes it unforgettable.
 *
 * ⚠️ PASS/FAIL IS RECORDED AGAINST THE VERSION OF THE CASE THE SERVER HOLDS, not against the words on screen. If
 * somebody edits a case while you have the panel open, your result says v3 and the panel says v2 — the server is
 * right, and the board shows the version each result was actually given.
 */
'use strict';

/**
 * ── ⭐⭐⭐ BENCH · LAB · REPORT — THREE SURFACES, ONE BOARD ─────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"how do we call the current test screen? Suggest a name and keep it — and also the test
 * lab and report. We have to see how we reuse the content, UI/UX, so we don’t need to repeat the work three
 * times. Possibly unification should help."*
 *
 * ⚠️⚠️ AND THE ABSENCE OF NAMES WAS ITSELF THE PROBLEM. Three faults today were one fault: a write landed,
 * the data was re-read, and the wrong frame was repainted — because nothing in the code or the conversation
 * distinguished the two places a person can be standing. You cannot keep two things straight that have no
 * names, and I fixed the same bug twice before noticing it was the same bug.
 *
 * ── THE NAMES, AND WHY THESE ────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ FIRST TRY WAS "BENCH · LAB · REPORT" and Athi refused it, rightly: *"these are tools, so can we talk in
 * terms of tools?"* A bench is a metaphor — it reads well and it teaches nobody, because it matches nothing
 * a tester has used before. These three are the three tools every test suite in the industry ships, so they
 * take the industry’s words and a person who has used TestRail, Xray or Usersnap already knows what each
 * one is. [[feedback-adopt-dont-reinvent]]
 *
 * ⭐ TEST CAPTURE — the panel that opens ON a screen (#cbcasespanel). "Capture" is what the in-context tools
 *   call themselves (Usersnap, Marker.io, BugHerd): you are standing on the thing, and it captures what you
 *   see — the screen ID, the control, the build, the screenshot — without you typing any of it.
 *
 * ⭐ TEST MANAGER — the board (#cbtestpanel). "Test management" is the category name TestRail, Xray, Kiwi
 *   TCMS and Zephyr all file themselves under: every case, every run, every finding, in one place.
 *
 * ⭐ TEST REPORT — what leaves the building. ISO/IEC/IEEE 29119-3 names this one for us.
 *
 * ⚠️ AND A SCREEN IS ALWAYS "ID · NAME", IN THAT ORDER, EVERYWHERE. `CAT001 · Catalogue`. The ID is what a
 * report, an incident and a conversation can all carry unchanged; the name is what a person recognises. Put
 * the name first and people quote the name, and then two screens called "Products" are one screen.
 *
 * ⚠️ ONE BOARD UNDERNEATH ALL THREE, and that is the whole of the unification: a case is a `definition`, a
 * result is a row in the ledger, a finding has ONE status derived in ONE place (testWorkRow), and ONE row
 * renderer draws it (testWorkRowHTML) wherever it appears. The Bench filters that board to a screen; the Lab
 * shows all of it; the Report prints it. Three views, never three implementations.
 * [[feedback-no-duplicate-functions]]
 */
var TEST_SURFACE = { capture: 'Test Capture', manager: 'Test Manager', report: 'Test Report' };

/**
 * ── ⭐⭐ THE TOOL HAS A SCREEN ID TOO, AND IT ALREADY HAD ONE ──────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"Test Capture screen — for that we need a screen id?"*
 *
 * ⭐ IT HAS HAD ONE SINCE THE REGISTER WAS SWEPT. `PNL007` is the panel that opens on a screen and `PNL004`
 * is the board; they were minted with the rest and the tools simply never wore them. So an incident about
 * the testing tool itself can be filed against a code, exactly like an incident about the catalogue — which
 * is the whole point of a register that does not stop at the product.
 *
 * ⚠️⚠️ AND THE REGISTER KEEPS THE NAME IT MINTED UNDER, not the name on screen. Renaming "Test lab" to
 * "Test Manager" in screens.cjs was tried and reverted inside a minute: the code is keyed by the PATH, so
 * it did not rename PNL004, it WITHDREW it and minted PNL009 — and every case citing PNL004 would have
 * pointed at a withdrawn code, silently. What a person sees lives here; what a case cites lives there.
 */
function testToolCode(path) {
  try {
    var m = (window.CBSCREENS && CBSCREENS.byPath) || {};
    return m[path] || '';
  } catch (_) { return ''; }
}
/** \u2b50 ID FIRST, exactly like a screen \u2014 PNL007 Test Capture, CAT001 \u00b7 Catalogue. One rule, both kinds of thing. */
function testToolTag(name, path) {
  var c = testToolCode(path);
  return '\ud83e\uddea '
    + (c ? '<code style="font-size:var(--fs-1);font-weight:700;color:var(--note)">' + c + '</code> ' : '')
    + name;
}

/** ⭐ ONE WAY TO SAY WHICH SCREEN, EVERYWHERE: the ID first, because that is the part that travels. */
function testScreenLabel(code, name) {
  var n = name || (typeof codeName === 'function' ? (codeName(code) || '') : '');
  return '<code style="font-weight:700">' + testEsc(code || '?') + '</code>'
    + (n ? ' <span style="font-weight:400">\u00b7 ' + testEsc(n) + '</span>' : '');
}

var CBTEST = { on: false, cases: [], last: {}, area: '', kind: '', open: null, run: null, busy: false, adding: false, stale: {}, cover: [], suggest: null };

/* ── WHICH CASES BELONG TO THE SCREEN YOU ARE ON ──────────────────────────────────────────────────────────────
 * ⚠️ A GUESS, AND IT SAYS SO. The map is deliberately partial: a nav with no entry opens on "All areas" rather
 * than on a confident wrong answer. A panel that silently shows the wrong module is worse than one that shows
 * everything, because the tester has no reason to doubt it. */
var TEST_AREA_OF = {
  suppliers: 'SPR', supplies: 'SUP', customers: 'REW', catalogue: 'MNT', catsetup: 'MNT',
  categories: 'MNT', definitions: 'OFF', match: 'RCV', folders: 'RCV', messages: 'RCV',
  chits: 'SELL', compose: 'SELL', stock: 'STK', adopt: 'ADO', settings: 'UI', profile: 'UI',
};

function testAreaGuess() {
  try { return TEST_AREA_OF[(typeof UI !== 'undefined' && UI.nav) || ''] || ''; } catch (_) { return ''; }
}

/* ── the run, kept across reloads: a sitting includes closing the tab to look at something ─────────────────── */
function testRunLoad() {
  try { CBTEST.run = JSON.parse(localStorage.getItem('cb_testrun') || 'null'); } catch (_) { CBTEST.run = null; }
  if (!CBTEST.run || !CBTEST.run.id) {
    CBTEST.run = { id: testUuid(), label: '', kind: 'manual' };
    testRunSave();
  }
}
function testRunSave() { try { localStorage.setItem('cb_testrun', JSON.stringify(CBTEST.run)); } catch (_) {} }
function testUuid() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
}

/**
 * ⭐ THE CHECKBOX Athi asked for. Turning it ON loads the board and opens the panel; turning it OFF puts the
 * panel away and leaves the run where it is, so coming back later continues the same sitting rather than
 * starting a new one.
 */
/**
 * ── ⭐⭐⭐ TEST MODE AND THE TEST LAB ARE TWO DIFFERENT THINGS ────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"let the test lab be a separate icon and test mode be a separate icon, like a toggle."*
 *
 * ⚠️ THEY WERE ONE BUTTON AND THAT CONFLATED TWO JOBS. Turning the mode on threw the whole board open over
 * the screen, so a tester who only wanted the Test chip on each screen got the lab as well — and closing
 * the lab turned the mode off, taking the chips with it. Neither is what either control is for.
 *
 *   TEST MODE   a state: every screen shows a Test chip, and can be documented where it stands
 *   TEST LAB    a place: the whole board, its filters and its tallies, in a panel
 *
 * ⭐ Mode no longer opens the panel. Turning mode OFF still closes it, because the lab is testing furniture
 * and mode off means there is no tester here.
 */
function testModeSet(on) {
  CBTEST.on = !!on;
  try { localStorage.setItem('cb_testmode', CBTEST.on ? '1' : ''); } catch (_) {}
  if (!CBTEST.on) testPanelClose();
  /* ⭐ mode on IS the start of a sitting — the run is the thing every verdict of it will belong to */
  if (CBTEST.on) { try { testRunLoad(); } catch (_) {} }
  /**
   * ⚠️⚠️ MODE ON HAS TO READ THE BOARD, and splitting it from the lab is what broke this. Opening the panel
   * used to load the cases as a side effect; with the panel gone the chip had nothing to count, so it hid
   * itself — test mode on, and not one screen showed a Test chip.
   * ⭐ Quietly, and only once: the chip appears a beat later rather than the mode appearing to do nothing.
   */
  if (CBTEST.on && !(CBTEST.cases || []).length && !CBTEST._booting) {
    CBTEST._booting = 1;
    if (typeof testLoad === 'function') {
      testLoad().then(function () {
        CBTEST._booting = 0;
        if (typeof renderApp === 'function') renderApp();
      }).catch(function () { CBTEST._booting = 0; });
    }
  }
  if (typeof renderApp === 'function') renderApp();
}

/* the lab: a place you open and close, without touching whether a tester is here */
function testLabOpen() {
  if (!CBTEST.on) testModeSet(true);        /* the lab makes no sense with the chips off */
  testPanelOpen();
  try { testGuide(false); } catch (_) {}
}
function testLabToggle() {
  if (document.getElementById('cbtesthost')) testPanelClose(); else testLabOpen();
}
/**
 * ── ⭐⭐⭐ THE DOOR IS THE SCREEN CODE ITSELF ──────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ THE ONE THING THE BRIEF WARNED ABOUT: *a form nobody fills in.* An incident box reached through a menu,
 * after the fact, is a form — and the evidence is in this repo, where a policy flag sat unsettable for four
 * days because nothing put it in front of anybody.
 *
 * ⭐ So the door is the thing already in the corner of every screen. Click `CAT005` and the box opens with the
 * screen code, the dialog code and the build already known — which are the three things a person will not
 * think to write down and an investigator cannot work without.
 *
 * ⚠️ IT OPENS THE ONE BOX, IN THE ONE PLACE. A second incident form floating over the screen would be a
 * second thing to maintain and a second set of rules to forget: the chip is the door, the lab is the room.
 */
function incidentHere() {
  try {
    CBTEST.view = "inc";
    try { localStorage.setItem("cb_test_view", "inc"); } catch (_) {}
    CBTEST.incForm = true;
    /* ⚠️ opening the panel is what LOADS the board — setting the view alone would show an empty list and
       teach the person that recording an incident does not work. */
    testLabOpen();
    if (!CBTEST.incs) testIncLoad(); else testPaint();
    /* the box, not the top of the panel: they clicked to write something */
    setTimeout(function () {
      try { var f = document.getElementById("incWhat"); if (f) f.focus(); } catch (_) {}
    }, 260);
  } catch (e) {}
}

function testModeIsOn() { try { return localStorage.getItem('cb_testmode') === '1'; } catch (_) { return false; } }

/* ── loading ──────────────────────────────────────────────────────────────────────────────────────────────── */
/**
 * ⭐ THE SHARED JUDGEMENT, FETCHED ON DEMAND. app/test-verdict.js answers "what would make this red green" for
 * BOTH the lab and the Report, so neither owns a copy.
 *
 * ⚠️ NOT ADDED TO app.html's EAGER LIST. The standing rule here is never pre-load — the lab is a lazy panel
 * most sessions never open, and paying for its dependency on every app start to save one fetch when it does
 * is the trade that rule exists to refuse. ensureCap() loads exactly one file per capability, so the panel
 * fetches this itself.
 *
 * ⚠️ It resolves even on FAILURE. A missing verdict must cost the panel a column, never the panel.
 */
/**
 * ⭐ ONE LOADER, because there is now more than one shared file: the verdict and the menu’s shape. A second
 * copy of this five-line dance, differing only in a filename, is the same duplication the shared files exist
 * to end. ⚠️ Each is fetched ONCE and remembered by src, and a failure still resolves — a missing shared
 * file must cost the panel a column, never the panel.
 */
function testEnsureFile(src, ready) {
  if (ready()) return Promise.resolve();
  CBTEST._files = CBTEST._files || {};
  if (CBTEST._files[src]) return CBTEST._files[src];
  return (CBTEST._files[src] = new Promise(function (resolve) {
    var el = document.createElement('script');
    el.src = src + (typeof CB_BUILD !== 'undefined' ? '?v=' + CB_BUILD : '');
    el.async = false;
    el.onload = function () { resolve(); };
    el.onerror = function () { resolve(); };
    document.head.appendChild(el);
  }));
}

function testEnsureVerdict() {
  /**
   * ⭐ BOTH SHARED FILES, TOGETHER. They are wanted at the same moment — the first paint — and asking for
   * them separately would mean a tree that renders one repaint after the list it replaces.
   */
  return Promise.all([
    testEnsureFile('/app/test-verdict.js', function () { return typeof testVerdict === 'function'; }),
    testEnsureFile('/app/test-menu-tree.js', function () { return typeof testMenuTree === 'function'; }),
  ]);
}

/**
 * ── ⚠️⚠️ PRESSING ↻ SAID NOTHING AT ALL ──────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"when I press the refresh button I asked for a proper reading box, and when done, a
 * reading-completed message — otherwise not sure what was happening. Or give a message, these many test cases
 * loaded."*
 *
 * ⚠️ THE PANEL DID HAVE A "Reading the cases…" STATE, behind `CBTEST.busy && !CBTEST.cases.length` — so it
 * showed on the FIRST load and never again. Pressing ↻ with cases already loaded did four network calls, took
 * several seconds and produced no change on screen whatsoever. Indistinguishable from a dead button.
 *
 * ⭐ IT SAYS WHAT IT IS DOING WHILE IT RUNS, and what it got when it finished. ⚠️ And it reports the RESULTS
 * count, not only the cases: the lab spent its whole life loading 0 results and reporting nothing, and a
 * message that had said "186 results" would have exposed that on the first press.
 *
 * ⚠️ Same fault as the Report's Load cases an hour ago, which wrote its summary and then painted over it. Both
 * surfaces now say the same three things: what is happening, what arrived, and whether anything moved.
 */
async function testLoad(force) {
  if (CBTEST.cases.length && !force) return;
  var was = { cases: CBTEST.cases.length, results: Object.keys(CBTEST.last || {}).length };
  CBTEST.busy = true;
  CBTEST.notice = { tone: 'work', text: 'Reading the test cases\u2026' };
  testPaint();
  try {
    /* two calls for the whole panel — never one per case. See the round-trip note in routes/testing.js. */
    await testEnsureVerdict();
    var a = await api('testCases');
    var b = await api('testResults');
    /* ⭐ a third read, and worth its round trip: without it a tester works through cases that were written
       against wording nobody stands behind any more, and records passes that prove nothing. */
    var st = await api('testStale');
    /* ⭐ the gap, ranked. Read on every load because it is what decides where the panel opens. */
    var cv = await api('testCoverage', { query: { run_id: CBTEST.run && CBTEST.run.id } });
    CBTEST.cover = (cv && cv.areas) || [];
    CBTEST.suggest = (cv && cv.suggest) || null;
    CBTEST.stale = {};
    ((st && st.stale) || []).forEach(function (x) { CBTEST.stale[x.case_key] = x; });
    CBTEST.cases = (a && a.cases) || [];
    /**
     * ── ⚠️⚠️⚠️ THE LAB HAS NEVER SHOWN A SINGLE RESULT ──────────────────────────────────────────────────────
     *
     * Athi, 2026-09-12: *"in the report cases passed shows the value, here it is all none."*
     *
     * ⚠️ `/api/testing/results` returns a COMPOUND — {results, count, history} — and core.js's unwrap()
     * collapses a response with a single array in it down TO that array. So `b` is the array, `b.results` is
     * undefined, and CBTEST.last stayed empty forever. Every case in this panel has read "not run" since the
     * day it was built, on a board with 160 passes in it.
     *
     * ⚠️⚠️ AND unwrap() CARRIES A NOTE ABOUT DOING EXACTLY THIS to the catalogue overlay in August — "the
     * picker read cat.candidates on what was actually a bare array, got undefined, and fell through with no
     * error anywhere". Same collapse, same silence, a different endpoint four months later.
     *
     * ⭐ Read whichever shape arrives. ⚠️ NOT fixed by editing unwrap(): it is the app's single response
     * envelope and every screen depends on how it behaves. Changing it to satisfy this panel would be a
     * platform-wide change made for one caller.
     */
    CBTEST.last = {};
    var rows = Array.isArray(b) ? b : ((b && b.results) || []);
    rows.forEach(function (r) {
      /* ⭐ THE WORST RESULT WINS, not the newest. A case proved green by a unit test and red at the counter is
         not a green case, and showing the later of the two would let one hide the other. */
      var rank = { fail: 4, blocked: 3, skipped: 2, pass: 1 };
      var cur = CBTEST.last[r.case_key];
      if (!cur || rank[r.status] > rank[cur.status]
          || (rank[r.status] === rank[cur.status] && new Date(r.at) > new Date(cur.at))) CBTEST.last[r.case_key] = r;
    });
  } catch (e) {
    /* ⚠️ a toast fades in four seconds; the reason a read failed has to stay until it is dealt with */
    CBTEST.notice = { tone: 'bad', text: 'Could not read the test cases \u2014 ' + testEsc(e.message) };
    if (typeof toast === 'function') toast(tx('Could not read the test cases') + ' — ' + e.message, true);
  }
  CBTEST.busy = false;
  /**
   * ⭐ THE COMPLETION MESSAGE, and it names the numbers rather than saying "done". "Reading completed" tells a
   * reader the button worked; "620 cases · 186 results" tells them WHAT it worked on, which is the only part
   * that can be checked against what they expected.
   */
  if (!CBTEST.notice || CBTEST.notice.tone !== 'bad') {
    var now = { cases: CBTEST.cases.length, results: Object.keys(CBTEST.last || {}).length };
    var n = (typeof testCounts === 'function') ? testCounts(CBTEST.cases, CBTEST.last) : null;
    var moved = (now.cases !== was.cases) || (now.results !== was.results);
    CBTEST.notice = {
      tone: 'done',
      text: 'Reading completed \u00b7 <b>' + now.cases + '</b> cases \u00b7 <b>' + now.results + '</b> with a result'
        + (n ? ' \u00b7 ' + n.pass + ' passed \u00b7 ' + n.fail + ' failed \u00b7 ' + n.todo + ' not run' : '')
        + (was.cases && !moved ? ' \u2014 unchanged since the last read' : ''),
    };
    /* ⚠️ a notice that never leaves becomes furniture and stops being read */
    clearTimeout(CBTEST._noticeT);
    CBTEST._noticeT = setTimeout(function () { CBTEST.notice = null; testPaint(); }, 9000);
  }
  /* ⚠ the board has been READ — which is not the same as it having anything in it */
  CBTEST._read = 1;
  testRepaint();
}

/* ── the panel ────────────────────────────────────────────────────────────────────────────────────────────── */
/**
 * ⭐⭐⭐ THE GUIDE, IN THE APP — so there is nothing to send anybody.
 *
 * Athi, 2026-09-11: *"just show the Test and give this info and then provide the check box there itself, so
 * we don't need to send it to anyone. I have to say, just check the test in the top level, that is it."*
 *
 * ⚠️ A LINK IS A THING SOMEBODY HAS TO BE SENT, AND THEN FIND AGAIN. Tick 🧪 Test and the instructions are
 * already in front of you; the ⓘ in the panel brings them back. Nothing to forward, nothing to bookmark,
 * nothing that goes stale in an inbox while the panel it describes changes.
 *
 * ⚠️ SHOWN ONCE, NOT EVERY TIME. A person who has read it does not need it again, and a dialog that reopens
 * on every toggle is a dialog people learn to dismiss without reading — which costs the FIRST reader too.
 */
function testGuideSeen() {
  try { return localStorage.getItem('cb_testguide') === '1'; } catch (_) { return false; }
}
function testGuide(force) {
  if (!force && testGuideSeen()) return false;
  try { localStorage.setItem('cb_testguide', '1'); } catch (_) {}
  if (typeof modal !== 'function') return false;

  var step = function (nn, title, body) {
    return '<div style="display:flex;gap:11px;align-items:flex-start;margin-bottom:13px">'
      + '<span style="flex:0 0 25px;height:25px;border-radius:50%;background:var(--blue);color:#fff;'
      +   'font-size:var(--fs-1);font-weight:700;line-height:25px;text-align:center">' + nn + '</span>'
      + '<div style="flex:1;min-width:0"><b style="font-size:var(--fs-3)">' + title + '</b>'
      + '<div style="color:var(--grey-2);font-size:var(--fs-2);line-height:1.55;margin-top:2px">' + body
      + '</div></div></div>';
  };
  var verdict = function (name, fg, bg, body) {
    return '<div style="border-inline-start:3px solid ' + fg + ';background:var(--card);'
      + 'border:1px solid var(--line);border-inline-start-width:3px;border-radius:9px;padding:9px 12px;'
      + 'margin-bottom:7px">'
      + '<span style="display:inline-block;font-size:var(--fs-1);font-weight:700;letter-spacing:.07em;'
      +   'text-transform:uppercase;color:' + fg + ';background:' + bg + ';border-radius:4px;'
      +   'padding:2px 7px;margin-bottom:5px">' + name + '</span>'
      + '<div style="font-size:var(--fs-2);line-height:1.55;color:var(--grey-2)">' + body + '</div></div>';
  };

  modal('<div class="mhd"><div class="t">' + tx('Test lab') + '</div>'
    + '<div class="s">' + tx('Read a case, do it, say what happened — without leaving the screen you are on.')
    + '</div></div>'
    + '<div class="mbody" style="line-height:1.6">'
    + step(1, tx('The panel follows you'),
        tx('It opens at the bottom right and stays with you on every screen. Drag it by the ⠿, minimise it '
         + 'with –, or pick a Size. Where you leave it is where it comes back.'))
    + step(2, tx('Load the cases, once'),
        tx('If the panel says there are none, press Load the test cases. Pressing it again later is harmless.'))
    + step(3, tx('Say who you are'),
        tx('Type your name in the Tester box. Leave it blank and the record still shows which login tested — '
         + 'the name is only so a shared login can tell two people apart.'))
    + step(4, tx('Pick a Focus'),
        tx('It lists each area with how many cases nobody has run. ⚠ marks the important ones. Pick one and '
         + 'the panel counts it down for you.'))
    + step(5, tx('Work through them'),
        tx('Each case tells you what must be true before you start, what to do, and what you should see. '
         + 'Then tap a verdict.'))
    + step(6, tx('Found something with no case? Press +'),
        tx('The moment you find it is the moment you can still describe it. An hour later it is “something '
         + 'was wrong with the supplier screen”.'))
    + '<div style="font-size:var(--fs-1);font-weight:700;letter-spacing:.08em;text-transform:uppercase;'
    +   'color:var(--grey-2);margin:18px 0 9px">' + tx('The four verdicts') + '</div>'
    + verdict(tx('Pass'), 'var(--ok-2)', 'var(--ok-tint)',
        tx('It did what the case says. The case closes and you move on.'))
    + verdict(tx('Fail'), 'var(--disp)', 'var(--danger-tint, #FBECEB)',
        '<b>' + tx('Write what you saw in the note box.') + '</b> '
        + tx('That sentence is the whole value of the run — a status on its own tells nobody anything. '
           + 'Both numbers help: the one shown and the one you expected.'))
    + verdict(tx('Blocked'), 'var(--warn-2)', 'var(--warn-tint)',
        tx('You could not get to it because something earlier is broken. ') + '<b>'
        + tx('This is not a fail.') + '</b> '
        + tx('It says nothing about the case itself, and counting it as one makes a red board nobody can act on.'))
    + verdict(tx('Skip'), 'var(--grey-2)', 'var(--neutral-tint)',
        tx('Deliberately not this time — not applicable, or out of scope for this sitting.'))
    + '<div style="margin-top:15px;padding:10px 13px;border-radius:9px;background:var(--ok-tint);'
    +   'color:var(--ok-2);font-size:var(--fs-2);line-height:1.55"><b>' + tx('You cannot break anything.')
    +   '</b> ' + tx('Nothing is ever overwritten — testing a case again writes a new line, and the older one '
    +   'stays readable. A wrong verdict is fixed by marking it again.') + '</div>'
    + '</div>'
    + '<div class="mfoot"><button class="pri" onclick="closeModal()">' + tx('Start testing') + '</button></div>');
  return true;
}

function testPanelClose() {
  var el = document.getElementById('cbtesthost');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function testPanelOpen() {
  if (document.getElementById('cbtesthost')) { testPaint(); return; }
  testRunLoad();
  /**
   * ⭐⭐ WHERE THE PANEL OPENS, and the order is the whole of Athi's answer.
   *
   * A FOCUS chosen for this run wins — that is somebody having decided. Otherwise the screen you are on,
   * because testing what is in front of you is the natural thing. The gap comes in behind both, once the
   * coverage has been read, and only when neither of the first two applies.
   */
  if (!CBTEST.area) {
    CBTEST.area = (CBTEST.run && CBTEST.run.focus) || testAreaGuess();
    /**
     * ⚠️⚠️ AND THE PANEL MUST SAY THAT IT CHOSE. Athi, 2026-09-12: *"it is filtered on something, not sure why
     * the filter stays… otherwise I keep searching how to reset the data to full."*
     *
     * ⭐ Opening on the area you are looking at is RIGHT — testing what is in front of you is the natural
     * thing, and the ordering above is his own answer. ⚠️ But a filter the panel applied ON YOUR BEHALF, and
     * never mentions, is indistinguishable from a board that has lost your cases: the counts are smaller than
     * the board's and nothing on screen explains why.
     *
     * ⭐ So it records WHO chose. A filter a person set needs no explanation; one the panel set does.
     */
    CBTEST.areaAuto = !!CBTEST.area;
  }

  var host = document.createElement('div');
  host.id = 'cbtesthost';
  host.innerHTML =
    '<div id="cbtestpanel" role="dialog" aria-label="Test panel" style="position:fixed;right:16px;bottom:16px;'
    + 'width:min(420px,calc(100vw - 32px));max-height:min(70vh,620px);display:flex;flex-direction:column;'
    + 'background:var(--card,#fff);border:1px solid var(--line,#e7e3d8);border-radius:12px;'
    + 'box-shadow:0 10px 34px rgba(0,0,0,.16);z-index:4000;overflow:hidden">'
    /**
     * ⚠️ THE HEADER IS ITS OWN ELEMENT, and that is what makes minimise mean anything. makeMovable collapses
     * every child EXCEPT the one classed `mhd`, so with a single child the panel would minimise to an empty
     * box — which is a close button with extra steps, not a minimise.
     * ⚠️ padding-inline-start leaves room for the drag grip makeMovable pins at the top-left corner; without
     * it the grip sits on top of the title and neither can be read.
     */
    /* ⚠️ the 30px left inset was room for the drag grip; the grip is gone now that the whole header drags,
       and the extra space read as a wonky margin. */
    + '<div id="cbtesthead" class="mhd" style="padding:9px 11px;border-bottom:1px solid var(--line,#e7e3d8);'
    +   'background:var(--paper,#faf8f3);border-radius:12px 12px 0 0;margin:0"></div>'
    /* ⚠⚠ A SCROLL CONTAINER, NOT A FLEX COLUMN. It was both, and that is why nothing scrolled: a flex
       parent SIZES its child to fit, so the list never overflowed and there was nothing for overflow:auto to
       scroll. Athi found it in a minute — "I couldn't roll inside the panel". */
    /**
     * ── ⚠️ THE LAST ROW WAS UNREACHABLE ─────────────────────────────────────────────────────────────────────
     *
     * Athi, 2026-09-12: *"we had a standing rule, scrolling has to move a bit more — I could not see the last
     * record."*
     *
     * ⚠️ AND THE RULE IS ALREADY APPLIED ON THE REPORT, which ends with . This panel
     * had none, so the final row sat flush against the bottom edge — reachable in principle and unreadable in
     * practice, with nothing below it to show you had arrived.
     * ⭐ Room to scroll PAST the last row. The rule was written down; it had only ever been applied to one of
     * the two surfaces, which is the same one-of-two fault as the counts and the dispatch.
     */
    + '<div id="cbtestbody" data-mv-fit="1" style="flex:1 1 auto;min-height:0;overflow-y:auto;'
    +   'overflow-x:hidden;padding-bottom:72px;scroll-padding-block-end:72px"></div></div>';
  document.body.appendChild(host);

  /**
   * ⭐ ADOPTED, NOT REBUILT. makeMovable() already does drag, resize and per-key geometry persistence, and it has
   * existed since 2026-08-15. A tester drags this panel off whatever it is covering ten times an hour, and where
   * they put it must survive a reload or they will drag it again every time.
   */
  try {
    if (typeof makeMovable === 'function') {
      makeMovable(document.getElementById('cbtestpanel'), {
        key: 'cb_testpanel', minW: 280, minH: 180,
        /* ⭐ the whole header drags — Athi: *"it has to work anywhere in the top panel"* */
        dragOn: '#cbtesthead',
        /* ⭐ Athi, 2026-09-11: *"a minimise button, so we can minimise the test case"* — and it already
           existed, behind an option I had not passed. It HIDES, it never closes: whatever is half-typed in a
           note box is still there when it comes back. */
        /* ⚠️ FALSE HERE ON PURPOSE: this panel draws its own minimise beside its own close, on the RIGHT, where
           every window keeps them. makeMovable's built-in one is pinned top-LEFT, which is the split Athi asked
           to end — and being outside the header, it also survived nothing that repaints. */
        minimise: false,
        /* ⚠️ WITHOUT `fit`, DRAGGING THE CORNER TALLER GROWS THE FRAME AND NOT THE LIST — you get a band of
           empty card under the cases, which reads as a bug rather than as a resize that did nothing. */
        fit: '#cbtestbody',
      });
    }
  } catch (_) {}

  testPaint();
  testLoad();
}

function testEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; });
}
function testAgo(iso) {
  if (!iso) return '';
  var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return Math.round(s / 60) + ' min ago';
  if (s < 172800) return Math.round(s / 3600) + ' h ago';
  return new Date(iso).toLocaleDateString();
}

/**
 * ⚠️ THE AREA COUNTS ARE OF WHAT THE KIND FILTER HAS LEFT. A list still offering "CTR · Counter" after picking
 * Unit would promise ten cases and deliver none — the same fault the board had before this afternoon.
 */
function testAreas() {
  var seen = {}, out = [];
  CBTEST.cases.forEach(function (c) {
    /* ⚠ the kind filter, applied HERE and not only to the list below — otherwise this dropdown keeps
       offering areas that hold nothing of the chosen kind */
    if (CBTEST.kind && c.test_type !== CBTEST.kind) return;
    if (!seen[c.module_key]) {
      seen[c.module_key] = { key: c.module_key, name: c.module_name || '', n: 0 };
      out.push(seen[c.module_key]);
    }
    seen[c.module_key].n++;
  });
  return out.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
}

/**
 * ── ⭐⭐⭐ WHAT KIND OF TEST — THE FIRST QUESTION, IN THE PANEL TOO ────────────────────────────────────────────
 *
 * Athi, 2026-09-11, looking at this panel: *"my expectation was the very first dropdown box is Unit Test etc,
 * is it the one you have given me?"*
 *
 * ⚠️⚠️ IT WAS NOT, AND THE REASON IS WORTH WRITING DOWN. Every change that afternoon went into testing.html —
 * the full-page board — and this panel is a different file that nothing touched. So he asked four times why
 * the dropdowns had not moved while looking at a screen I had never edited, and I kept answering about the
 * other one. ⭐ Two surfaces showing the same board must be changed together or the one left behind makes a
 * liar of the answer.
 */
var TEST_KINDS = ['acceptance', 'unit', 'integration', 'system', 'performance', 'security', 'penetration',
                  'static', 'support'];
var TEST_KIND_LABEL = {
  acceptance: 'Manual · a person', unit: 'Unit', integration: 'Integration', system: 'System',
  performance: 'Performance', security: 'Security', penetration: 'Penetration',
  'static': 'Static · reads code', support: 'Support · not a test',
};

function testShown() {
  /* ⭐ the journey order, same as the board — see build-test-cases.cjs FLOW */
  return CBTEST.cases.slice().sort(function (x, y) {
    var d = (x.seq === undefined ? 99 : x.seq) - (y.seq === undefined ? 99 : y.seq);
    return d || (x.case_key < y.case_key ? -1 : 1);
  }).filter(function (c) {
    if (CBTEST.kind && c.test_type !== CBTEST.kind) return false;
    return !CBTEST.area || c.module_key === CBTEST.area;
  });
}

/** ⚠️ counts of what the OTHER control has left, so picking a kind narrows the areas rather than lying about them */
function testKindCounts() {
  var n = {};
  CBTEST.cases.forEach(function (c) {
    if (CBTEST.area && c.module_key !== CBTEST.area) return;
    var k = c.test_type || '—'; n[k] = (n[k] || 0) + 1;
  });
  return n;
}

function testSetKindFilter(v) { CBTEST.kind = v; CBTEST.area = ''; CBTEST.areaAuto = false; CBTEST.open = null; testPaint(); }

/**
 * ⭐ Clear BOTH, and clear the panel's own guess with them. ⚠️ areaAuto has to be cleared too, or the next
 * paint re-reads it and the line still claims the panel chose an area that is no longer set.
 */
function testClearFilters() {
  CBTEST.kind = '';
  CBTEST.area = '';
  CBTEST.areaAuto = false;
  CBTEST.open = null;
  testPaint();
}

/** how many cases the KIND filter alone leaves — the honest number for "All areas" */
function testKindTotal() {
  return CBTEST.cases.filter(function (c) { return !CBTEST.kind || c.test_type === CBTEST.kind; }).length;
}

/**
 * ⭐ ONE DECLARATION OF THE CASE ROW'S TRACKS. The header and the rows both read it, so they cannot disagree —
 * a header that drifts from its columns is worse than no header, because the reader trusts it.
 */
var TEST_ROW_COLS = 'minmax(0,11em) minmax(0,1fr) 5.5em auto';
/* ⭐ the AREA row's tracks, read by the header and every row — see the note on TEST_ROW_COLS */
/**
 * ⚠️⚠️ AND THE HEADER'S OWN WORDS DID NOT FIT ITS TRACKS: "CASESPASSEDFAILED" ran together because CASES,
 * PASSED, FAILED and NOT RUN are wider than 3.2em once uppercased and letter-spaced. I sized these tracks for
 * the NUMBERS and then put words above them.
 * ⭐ Wide enough for the LABEL, which is always the longer of the two.
 */
/**
 * ⚠️ 9em HELD THE SEQ, THE CHIP AND NOTHING ELSE. Athi, 2026-09-12: *"Area width can be a little more wider,
 * and 10 char possibly."* A key like `chitbridge-api/scripts` was ellipsised to almost nothing beside a
 * two-digit sequence, so the column that identifies the row was the one with no room in it.
 * ⭐ 12.5em fits ten characters of key plus the sequence and the caret at every text size on this scale.
 */
/**
 * ⚠️ minmax(0,1fr) ON DETAILS COLLAPSED IT TO ZERO in a 420px panel — the four figure columns and the Area
 * key took every pixel, and the column holding the area NAME had none left. It looked fine on Athi's wide
 * panel and vanished on the default one, which is the worst kind of layout bug: correct wherever it is
 * being looked at.
 * ⭐ A floor of 6em means Details can shrink but never disappear, and the row wraps the panel instead.
 */
/**
 * ⚠️⚠️ BOTH FLEXIBLE TRACKS NEED A FLOOR, and only giving one to Details moved the collapse rather than
 * fixing it: Area then computed to TWO PIXELS in a 420px panel, so the key chip had nowhere to go. A
 * minmax(0,…) track will shrink to nothing whenever the row is over-subscribed, and this row is, at the
 * panel's default width.
 * ⭐ Floors on both. The panel is genuinely tight for six columns at 420px — the Size control exists for
 * that — but no column may ever disappear.
 */
/**
 * ⚠️⚠️⚠️ em IN A GRID TRACK IS RELATIVE TO THAT ELEMENT'S OWN FONT-SIZE — and the header is deliberately
 * smaller than the rows it labels. So the SAME template produced different pixels on each:
 *
 *     header   225  164  60.9  66.7  63.8  69.6
 *     row      225  137  67.2  73.6  70.4  76.8
 *
 * Identical string, identical container width, columns that could never line up. This is the real cause of
 * every "not properly aligned" report in this panel, and no amount of adjusting the NUMBERS would have
 * fixed it — the unit was wrong.
 *
 * ⭐ rem is relative to the ROOT, so one template means one set of widths wherever it is used. ⚠️ Which also
 * means these tracks no longer shrink when the panel's own font shrinks — correct: a column is a property of
 * the TABLE, not of the text that happens to sit in it.
 */
var TEST_AREA_DEFAULT = 'minmax(4.5rem,8rem) minmax(5rem,1fr) 3.4rem 3.9rem 3.7rem 4.1rem';

/**
 * ── ⭐⭐ THE COLUMNS ARE ADJUSTABLE HERE TOO ─────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"have you given an adjustable column with | here, for Area?"*
 *
 * ⚠️ NO — the resizer I built lives in app/table-resize.js and works on a <table>, by setting a width on a
 * <th>. This panel is a CSS GRID, so there is no th to set and nothing that file can grab. Same feature, two
 * different mechanisms, and I had quietly delivered it to one surface.
 *
 * ⭐ For a grid the adjustable thing is the TEMPLATE itself. One string, stored, read by the header and every
 * row — which is why they cannot drift apart, and why a drag moves both at once.
 *
 * ⚠️ THE FIRST TWO TRACKS ARE minmax(), NOT FIXED WIDTHS, and a drag has to preserve that: Area must still be
 * able to shrink on a narrow panel and Details must still take what is left. Dragging sets the MINIMUM of the
 * track it grabbed; it does not convert a flexible column into a rigid one.
 */
function testAreaCols() {
  try {
    var v = localStorage.getItem('cb.labcols');
    if (v) return v;
  } catch (_) {}
  return TEST_AREA_DEFAULT;
}
function testSetAreaCols(tpl) {
  try { tpl ? localStorage.setItem('cb.labcols', tpl) : localStorage.removeItem('cb.labcols'); } catch (_) {}
}
/** ⭐ every column back to the width this panel shipped with */
function testResetCols() { testSetAreaCols(''); testPaint(); }

/**
 * Drag one boundary. `i` is the track to the LEFT of the grip.
 * ⚠️ It reads the LIVE widths from the header row rather than parsing the template, because a template of
 * minmax() and fr cannot be turned into pixels without the browser having laid it out — and the number a
 * person is dragging is the one they can see.
 */
function testColDrag(e, i) {
  e.preventDefault(); e.stopPropagation();
  var head = document.getElementById('cbt_areahead');
  if (!head) return;
  var cells = [].slice.call(head.children);
  var startX = e.clientX;
  var startW = cells[i] ? cells[i].getBoundingClientRect().width : 0;
  var move = function (ev) {
    var w = Math.max(32, Math.round(startW + (ev.clientX - startX)));
    var parts = testAreaCols().split(' ');
    /* ⭐ keep a flexible track flexible — set its floor, not its width */
    parts[i] = (i <= 1) ? 'minmax(' + w + 'px,' + (i === 1 ? '1fr' : w + 'px') + ')' : w + 'px';
    head.style.gridTemplateColumns = parts.join(' ');
    [].slice.call(document.querySelectorAll('[data-arearow]')).forEach(function (r) {
      r.style.gridTemplateColumns = parts.join(' ');
    });
    head.dataset.pending = parts.join(' ');
  };
  var up = function () {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    document.body.style.cursor = '';
    if (head.dataset.pending) {
      testSetAreaCols(head.dataset.pending);
      head.dataset.pending = '';
      /* ⚠️ REPAINT, do not leave the inline styles the drag wrote. The drag sets the header and the rows it
         can SEE; a row rendered afterwards, or one inside a collapsed area, would keep the old template and
         the columns would silently disagree. Re-rendering from the stored value is the only way they cannot. */
      testPaint();
    }
  };
  document.body.style.cursor = 'col-resize';
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

/**
 * ── ⚠️⚠️⚠️ THERE ARE TWO FRAMES, AND A LOADER CANNOT KNOW WHICH ONE YOU ARE LOOKING AT ─────────────────────
 *
 * `testPaint()` draws the LAB (`#cbtestbody`). `screenCasesPaint()` draws the POPUP that opens on a screen
 * (`#cbcasespanel`). They show the same data through different doors, and every loader in this file called
 * the first one only.
 *
 * ⚠️⚠️ SO EVERY WRITE MADE FROM THE POPUP LANDED, RE-READ, AND CHANGED NOTHING ON SCREEN. Three separate
 * reports today were this one fault wearing different clothes: the Findings row after a verdict, the
 * Incidents list after a resolve, and — Athi, 2026-09-13 — *"when I close a case in the Cases tab, the
 * closed one should leave the queue or change the status; it is still the same."* It always had.
 *
 * ⭐ A LOADER REPAINTS WHATEVER IS OPEN. It is not the loader’s business which frame the person is in, and
 * making it guess is how the third instance of this shipped after the first two were fixed by hand.
 * ⚠️ Cheap and safe: screenCasesPaint returns immediately when no popup is up.
 */
/**
 * ── ⭐⭐ READ IT ALL AGAIN, BECAUSE SOMETIMES YOU HAVE TO ──────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"we need a refresh button on the top for the Test Capture screen itself, so just by
 * refreshing we can get the new data which is not refreshed for some reason."*
 *
 * ⭐ AND HE IS RIGHT TO WANT ONE EVEN THOUGH THE AUTOMATIC PATH IS NOW FIXED. Three faults today were the
 * board not repainting after a write, and each was invisible: the data was correct, the screen was not, and
 * nothing said which. An explicit re-read is the one control that tells a person the difference between
 * "the tool is stuck" and "that really is what the server holds" — without it they cannot tell, and they
 * are right not to trust it.
 *
 * ⚠️ IT DROPS EVERY CACHE, INCLUDING THE ONES THIS VIEW IS NOT SHOWING. A refresh that quietly leaves one
 * list stale is worse than none: the person has now RULED OUT staleness and will look for the fault
 * somewhere it is not.
 * ⚠️ It does NOT touch the call log. That is a measurement, not a cache — re-reading the board must not
 * throw away the reading, and Clear is the control that does.
 */
async function testRefreshAll() {
  CBTEST.refreshing = true; testRepaint();
  CBTEST.closedCases = null;
  CBTEST.trace = null;
  try {
    await Promise.all([
      (typeof testLoad === 'function') ? testLoad(true) : null,
      (typeof testScrLoad === 'function') ? testScrLoad() : null,
      (CBTEST.incs && typeof testIncLoad === 'function') ? testIncLoad() : null,
      (CBTEST.reqs && typeof testReqLoad === 'function') ? testReqLoad() : null,
    ]);
  } catch (_) {}
  CBTEST.refreshing = false;
  CBTEST.readAt = Date.now();
  testRepaint();
  if (typeof toast === 'function') toast('Read again from the server.');
}

/** ⚠️ the time is shown because a refresh button with no timestamp answers "is this current?" with a shrug */
function testReadAt() {
  if (CBTEST.refreshing) return 'reading\u2026';
  if (!CBTEST.readAt) return '';
  return 'read ' + new Date(CBTEST.readAt).toTimeString().slice(0, 5);
}
function testRefreshBtn(ico) {
  return '<button data-testid="test-refresh" title="Read everything again from the server" '
    + 'onclick="testRefreshAll()" style="' + ico + '"' + (CBTEST.refreshing ? ' disabled' : '')
    + '>\u21bb</button>';
}

function testRepaint() {
  try { testPaint(); } catch (_) {}
  try { if (CBTEST.popupFor) screenCasesPaint(); } catch (_) {}
}

function testPaint() {
  /**
   * ⚠️ THE REMEMBERED VIEW HAS TO BE READ SOMEWHERE, and nothing was reading it: testViewGet() existed, the
   * toggle wrote localStorage, and every paint still drew the list because CBTEST.view was undefined. A
   * preference that is stored and never loaded is worse than none — it looks broken rather than absent.
   * ⭐ Once, on the first paint; the toggle sets it directly after that.
   */
  if (!CBTEST.view) CBTEST.view = testViewGet();
  var body = document.getElementById('cbtestbody');
  var head = document.getElementById('cbtesthead');
  if (!body || !head) return;

  var STAT = { pass: ['var(--ok-2)', 'var(--ok-tint)'], fail: ['var(--disp)', 'var(--danger-tint, #fbeceb)'],
               blocked: ['var(--warn-2)', 'var(--warn-tint)'], skipped: ['var(--grey)', 'var(--neutral-tint)'] };

  var shown = testShown();
  var n = { pass: 0, fail: 0, blocked: 0, skipped: 0, todo: 0 };
  shown.forEach(function (c) { var l = CBTEST.last[c.case_key]; if (!l) n.todo++; else n[l.status]++; });

  /**
   * ── ⚠️⚠️ "IN THE LAB, EVERYTHING NOT RUN?" ────────────────────────────────────────────────────────────────
   *
   * Athi, 2026-09-12. And no — the board has 160 passed and 27 failed. TWO things hid that from him:
   *
   * ⚠️ The panel opens FILTERED to one area (see testOpen), so the tally counted a slice.
   * ⚠️ And each figure rendered only when NON-ZERO — `n.pass ? … : ''` — so a slice with no results collapsed
   *    to "N to go" and read as though nothing had ever been run anywhere.
   *
   * ⭐ A zero is a fact and has to hold its place. "0 passed" says the work has not started; a missing "passed"
   * says nothing at all, and the reader fills the silence with the worst reading.
   *
   * ⭐ So the panel counts the WHOLE board too, and leads with it — the same four figures as the Report, in
   * the same order, so the two surfaces can be compared instead of doubted.
   */
  /**
   * ⭐ THE SHARED COUNT (app/test-verdict.js), not a second implementation. Two counters over the same two
   * lists agree only until somebody edits one — and this panel spent its whole life reporting "621 not run"
   * with complete confidence because its own counter could not tell "nothing passed" from "I have no results".
   * ⚠️ Falls back to counting here if the shared file has not arrived, so a slow fetch costs the figures'
   * accuracy for one paint rather than costing the panel.
   */
  var all = (typeof testCounts === 'function')
    ? testCounts(CBTEST.cases, CBTEST.last)
    : (function () {
        var t = { pass: 0, fail: 0, blocked: 0, skipped: 0, todo: 0 };
        CBTEST.cases.forEach(function (c) { var l = CBTEST.last[c.case_key]; if (!l) t.todo++; else t[l.status]++; });
        return t;
      })();
  var filtered = shown.length !== CBTEST.cases.length;
  var staleN = shown.filter(function (c) { return CBTEST.stale[c.case_key]; }).length;

  /* ── the header: who is recording, into which run, over which area ── */
  /**
   * ── ⚠️⚠️ THE HEADER WAS FIVE DARK BARS AND A SQUEEZED TITLE ───────────────────────────────────────────────
   *
   * Athi, 2026-09-12: *"header itself not looking good… polish it."*
   *
   * ⚠️ THESE BUTTONS INHERITED app.html's .btn, WHICH STRETCHES. Inside a flex row with no basis they each
   * took an equal share of a 1900px panel, so +, ☷, ⓘ, ↻ and ✕ became five heavy dark slabs running the whole
   * width — the loudest thing on a panel whose actual job is the list below them. And they pushed the title
   * into a two-character column, so "Test lab" wrapped onto two lines.
   *
   * ⭐ AN ICON BUTTON IS A SQUARE. flex:0 0 auto stops the stretch, a fixed 30px box gives them a rhythm, and
   * quiet borders put them back where secondary chrome belongs. The title holds one line because a panel whose
   * own name wraps looks broken before you have read anything on it.
   */
  var ico = 'flex:0 0 auto;width:30px;height:28px;display:inline-flex;align-items:center;'
    + 'justify-content:center;font:inherit;font-size:var(--fs-2);line-height:1;padding:0;cursor:pointer;'
    + 'border:1px solid var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff);'
    + 'color:var(--ink-2,#3a4048)';
  var hd = ''
    + '<div style="display:flex;align-items:center;gap:6px">'
    +   '<b style="font-size:var(--fs-3);white-space:nowrap">'
    +     testToolTag(TEST_SURFACE.manager, 'Panel \u203a Test lab') + '</b>'
    +   '<span style="font-size:var(--fs-1);color:var(--note);white-space:nowrap">everything, '
    +     'collected</span>'
    +   '<span style="flex:1 1 auto;min-width:8px"></span>'
    +   '<button title="Add a case for something you just found" onclick="testAddOpen()" '
    +     'style="' + ico + ';font-size:var(--fs-3)">+</button>'
    /**
     * ⭐⭐ THE REPORT, FROM THE LAB. Athi, 2026-09-11: *"where is the report in the test lab?"* — it was only
     * on the full board, which is the one place a tester is not.
     *
     * ⚠ IT OPENS A TAB RATHER THAN RENDERING HERE, and that is the right trade rather than a shortcut. A
     * completion report is a wide document that gets PRINTED and filed; squeezing ten sections into a 420px
     * panel would make it unreadable in the one place it has to be legible — on paper, to somebody who was
     * not here.
     */
    +   '<button title="Test Completion Report (ISO/IEC/IEEE 29119-3)" '
    +     'onclick="testReport()" style="' + ico + '">\u2637</button>'
    +   '<button title="How to use this" onclick="testGuide(true)" style="' + ico + '">\u24d8</button>'
    +   '<button title="Read the cases again" onclick="testLoad(true)" style="' + ico + '">\u21bb</button>'
    /* ⭐ WIDER · TALLER, as sizes rather than as a drag. Athi: *"keep it wider or lengthier etc, this depends
       on the test case and where we are looking at."* The corner still drags freely; this is for the times
       when you know what you want and do not want to aim at a 16-pixel triangle to get it. */
    +   '<select onchange="testSize(this.value)" title="Size" style="flex:0 0 auto;font-size:var(--fs-1);'
    +     'padding:3px 4px;border-radius:7px;border:1px solid var(--line,#e7e3d8)">'
    +     [['', 'Size'], ['normal', 'Normal'], ['wide', 'Wide'], ['tall', 'Tall'],
           ['large', 'Large'], ['full', 'Full screen']].map(function (o) {
            return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('')
    +   '</select>'
    /**
     * ⭐⭐⭐ OUT OF THE WAY OF THE THING BEING TESTED. Athi, 2026-09-12: *"when we test it, it has to be away from
     * the current screen, so one side test scripts and another side i can test it, it should be openable in
     * another window?"*
     *
     * ⭐ IT IS THIS APP, BOOTED WITH THE LAB OPEN AND ITS OWN SHELL HIDDEN (`?lab=only`) — not a second host.
     * The lab stands on api(), toast(), esc(), tx() and modal(); a page of its own would be a second copy of
     * every one of them, and two copies of a screen is how they start disagreeing.
     * [[feedback-adopt-dont-reinvent]] · [[feedback-no-duplicate-functions]]
     * ⚠️ A FLOATING PANEL CAN NEVER SOLVE THIS: whatever it is not covering, it is still in front of, and a
     * tester dragging it aside ten times an hour is the tax this removes.
     * ⚠️ A named target, so pressing it twice raises the window already open instead of stacking a second one.
     */
    +   '<button title="Open the board in its own window — the app on one screen, the scripts on the other" '
    +     'onclick="testPopOut()" style="' + ico + '">↗</button>'
    /* ⭐ minimise sits WITH close, at the right, and is redrawn on every paint like everything else here */
    +   '<button title="Minimise" onclick="testMinimise()" style="' + ico + '">\u2013</button>'
    /* ⚠️ CLOSES THE PANEL, NOT THE MODE. Closing the lab used to turn test mode off, so the Test chips
   vanished from every screen because somebody put the board away. */
    +   '<button title="Close the lab" onclick="testPanelClose()" style="' + ico + '">\u2715</button>'
    + '</div>'
    + '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;align-items:center">'
    /* ⭐ FIRST, because "what kind of test" is the first question anybody asks of this list */
    +   '<select onchange="testSetKindFilter(this.value)" title="What kind of test"'
    +     ' style="font-size:var(--fs-2);padding:3px 5px;max-width:190px">'
    +     (function () {
            var n = testKindCounts();
            var tot = Object.keys(n).reduce(function (a, k) { return a + n[k]; }, 0);
            return '<option value=""' + (CBTEST.kind ? '' : ' selected') + '>Every kind · ' + tot + '</option>'
              + TEST_KINDS.map(function (k) {
                  /* ⚠️ an empty category we KNOW should exist is still offered — "Penetration · 0" states a
                     fact, while leaving it out lets the absence read as "not applicable" */
                  if (!n[k] && k !== 'penetration') return '';
                  return '<option value="' + k + '"' + (CBTEST.kind === k ? ' selected' : '') + '>'
                    + testEsc(TEST_KIND_LABEL[k]) + ' \u00b7 ' + (n[k] || 0) + '</option>';
                }).join('');
          })()
    +   '</select>'
    +   '<select onchange="testSetArea(this.value)" style="font-size:var(--fs-2);padding:3px 5px;max-width:190px">'
    +     '<option value=""' + (CBTEST.area ? '' : ' selected') + '>All areas · ' + testKindTotal() + '</option>'
    +     testAreas().map(function (a) {
            return '<option value="' + testEsc(a.key) + '"' + (CBTEST.area === a.key ? ' selected' : '') + '>'
                 + testEsc(a.key + ' · ' + a.name) + ' · ' + a.n + '</option>'; }).join('')
    +   '</select>'
    /**
     * ── ⭐⭐ THE SAME TWO CONTROLS AS THE REPORT, BECAUSE IT IS THE SAME CONFUSION ─────────────────────────
     *
     * Athi, 2026-09-12: *"in lab also we need to showcase filter and clear."*
     *
     * ⭐ A permanent Clear, in a fixed place — he settled that on the Report an hour ago and the reasoning
     * carries: a control that only APPEARS is one you must notice before you can use it, and not noticing is
     * the whole problem. ⚠️ Here it matters more, because the lab filters ITSELF on open.
     */
    /**
     * ⭐ LIST or TREE, as two quiet buttons showing which one you are in. ⚠️ Not a dropdown: with exactly two
     * choices a dropdown hides the one you are not in and costs a click to discover — and Athi settled the
     * same question on the Report (*"no, give a clear filter button"*): you cannot hover over something to
     * find out that hovering does anything.
     */
    +   testViewToggleHTML()
    +   '<button onclick="testClearFilters()" ' + (CBTEST.kind || CBTEST.area ? '' : 'disabled ')
    +     'title="Clear the kind and area filters — show every case" '
    +     'style="font:inherit;font-size:var(--fs-1);padding:3px 9px;border-radius:7px;cursor:pointer;'
    +     'border:1px solid ' + (CBTEST.kind || CBTEST.area ? 'var(--blue,#3F66A6);color:var(--blue,#3F66A6)'
                                                           : 'var(--line,#e7e3d8);color:var(--grey-2,#545A61);opacity:.55')
    +     ';background:var(--card,#fff)">Clear filters</button>'
    /**
     * ── ⚠️⚠️ THE PANEL FILTERS ITSELF ON OPEN, AND NEVER SAID SO ──────────────────────────────────────────
     *
     * `CBTEST.area` is set before the first paint from the run's focus, or GUESSED from the screen you were
     * on. That is the right behaviour — testing what is in front of you is the natural thing — but a filter
     * applied on your behalf and never mentioned is indistinguishable from a board that has lost your cases:
     * the count is smaller than the Report's and nothing on screen explains the difference.
     *
     * ⭐ So it says what is on, and — the part that matters — WHO CHOSE IT. "the panel opened here" is the
     * sentence that was missing, and it is the only one that explains a filter nobody remembers setting.
     */
    +   (function () {
          var on = [];
          if (CBTEST.kind) on.push(CBTEST.kind);
          if (CBTEST.area) on.push(CBTEST.area);
          if (!on.length) return '';
          return '<div style="flex:1 1 100%;font-size:var(--fs-1);color:var(--blue,#3F66A6);margin-top:3px">'
            + '<b>' + shown.length + '</b> of ' + CBTEST.cases.length + ' \u00b7 filtered by '
            + testEsc(on.join(' \u00b7 '))
            + (CBTEST.areaAuto && CBTEST.area
                ? ' <span style="color:var(--grey-2,#545A61)">\u2014 the panel opened here, on the screen you '
                  + 'were looking at. Clear it to see every case.</span>'
                : '')
            + '</div>';
        })()
    /**
     * ⭐⭐⭐ FOCUS. Athi: *"can we force an area to test? This area testing not done yet?"*
     *
     * ⚠️ IT PINS, IT DOES NOT LOCK — and that is deliberate, not a shortcut. A panel that refuses to show
     * anything but one module is a panel somebody closes, and then nothing is tested at all: you have lost
     * the only thing you actually had, which was their willingness. What this does instead is make the gap
     * impossible to miss and count it down, which is the only pressure that works on someone doing you a
     * favour.
     */
    +   '<select onchange="testSetFocus(this.value)" title="Focus — the area this sitting is meant to cover"'
    +     ' style="font-size:var(--fs-2);padding:3px 5px;max-width:190px">'
    +     '<option value="">Focus: anywhere</option>'
    +     CBTEST.cover.map(function (a) {
            var left = a.untested;
            return '<option value="' + testEsc(a.module_key) + '"'
              + ((CBTEST.run.focus === a.module_key) ? ' selected' : '') + '>'
              + testEsc(a.module_key) + (left ? ' \u00b7 ' + left + ' left' : ' \u00b7 done')
              + (a.high_untested ? ' \u26a0' : '') + '</option>'; }).join('')
    +   '</select>'
    /**
     * ⚠️⚠️ THIS SAID "manual · t0 · t1 · t2 · t3 · unit · regression" AND NOTHING ELSE.
     *
     * Athi: *"I spent time to understand what each dropdown is"* — and, on the ladder itself, *"T1, T2 are the
     * test yardsticks for YOU."* They are: how much of the suite Claude runs before shipping and who authorises
     * it. Seven bare tokens, four of them somebody else's working vocabulary, on the panel a tester lands on.
     * ⭐ Each option now says what it is, and the internal four say whose they are.
     */
    +   '<select onchange="testSetKind(this.value)" title="Who is doing this run, and how much of it"'
    +     ' style="font-size:var(--fs-2);padding:3px 5px;max-width:200px">'
    +     [['manual', 'Me, by hand'], ['unit', 'An automated run'], ['regression', 'A full regression'],
           ['t0', 'T0 · Claude, quick check'], ['t1', 'T1 · Claude, one spec'],
           ['t2', 'T2 · Claude, one surface'], ['t3', 'T3 · Claude, everything']].map(function (k) {
            return '<option value="' + k[0] + '"' + (CBTEST.run.kind === k[0] ? ' selected' : '') + '>'
              + testEsc(k[1]) + '</option>'; }).join('')
    +   '</select>'
    /* ⚠️ ASKED FOR, NOT ASSUMED. Left blank the row still records the login that wrote it — which is the
       truth either way; this only adds a name when a login is shared. */
    +   '<input type="text" placeholder="' + (testEsc(testDefaultWho())) + '" value="' + testEsc(testWho()) + '"'
    +     ' onchange="testSetWho(this.value)" title="Who is testing — kept on this device"'
    +     ' style="font-size:var(--fs-2);padding:3px 5px;flex:1;min-width:90px">'
    + '</div>'
    /**
     * ⭐ THE SAME FOUR FIGURES AS THE REPORT, IN THE SAME ORDER. Athi, 2026-09-12: *"can we show the same
     * level of summary on the first landing page — cases, passed, failed, not run."*
     * ⚠️ Whole board FIRST, because that is the question "how are we doing" actually asks. The filtered slice
     * is a second line, clearly labelled, so a small number never reads as the whole story.
     */
    /**
     * ⭐ COLUMNS, NOT A SENTENCE. Athi, 2026-09-12: *"show the count in three different columns."*
     * ⚠️ Run together with middots the four figures read as prose and nothing lines up, so the eye cannot
     * compare passed against not-run — which is the one comparison this summary exists for. A fixed grid gives
     * each figure a track, and the FILTERED row sits directly under the whole-board row in the SAME tracks, so
     * the two numbers a reader wants to hold against each other are literally above and below.
     * ⚠️ tabular-nums, or the digits jitter between columns and the alignment is decorative rather than real.
     */
    + (function () {
        var cols = [
          ['cases', CBTEST.cases.length, shown.length, 'var(--ink,#20303b)'],
          ['passed', all.pass, n.pass, 'var(--ok-2)'],
          ['failed', all.fail, n.fail, all.fail ? 'var(--disp)' : 'inherit'],
          ['not run', all.todo, n.todo, 'inherit'],
        ];
        if (all.blocked) cols.splice(3, 0, ['blocked', all.blocked, n.blocked, 'var(--warn-2)']);
        /**
         * ⚠️ 1fr EACH SPREAD FOUR SMALL NUMBERS ACROSS 1900px, so "621 cases" and "621 not run" sat at opposite
         * ends of the panel with a hand-span of nothing between them and nothing to compare. Figures that are
         * meant to be read TOGETHER have to sit together.
         * ⭐ Each column takes the width it needs, they group at the left, and the set stops before it sprawls.
         */
        var grid = 'display:grid;grid-template-columns:repeat(' + cols.length + ',minmax(3.6em,auto));'
                 + 'gap:2px 18px;justify-content:start;font-variant-numeric:tabular-nums;';
        return '<div style="margin-top:8px;' + grid + '">'
          /* the whole board */
          + cols.map(function (c) {
              return '<div><div style="font-size:var(--fs-3);font-weight:700;line-height:1.15;color:' + c[3] + '">'
                + c[1] + '</div>'
                + '<div style="font-size:var(--fs-1);color:var(--grey-2,#545A61)">' + c[0] + '</div></div>';
            }).join('')
          /* ⚠️ the slice in the same tracks, only when it IS a slice — never instead of the whole */
          + (filtered
              ? cols.map(function (c) {
                  return '<div style="font-size:var(--fs-1);color:var(--blue,#3F66A6);border-top:1px solid '
                    + 'var(--line,#e7e3d8);padding-top:3px;margin-top:2px"><b>' + c[2] + '</b>'
                    + (c[0] === 'cases' ? ' in view' : '') + '</div>';
                }).join('')
              : '')
          + '</div>'
          + (staleN ? '<div style="margin-top:4px;font-size:var(--fs-1);color:var(--warn-2)"><b>' + staleN
                    + '</b> spec moved</div>' : '');
      })()
    + (CBTEST.run.label
        ? '<div style="margin-top:3px;font-size:var(--fs-1);color:var(--grey-2,#545A61)">Recording into: '
          + testEsc(CBTEST.run.label) + '</div>'
        : '')
    /* ⭐ THE COUNTDOWN. Naming the area and the number left is what turns "please test the suppliers screen"
       into something a person can finish. ⚠️ It reports the gap for the WHOLE board, not this run, because
       a case somebody else covered yesterday does not need doing again today. */
    + (CBTEST.run.focus ? (function () {
        var a = CBTEST.cover.filter(function (x) { return x.module_key === CBTEST.run.focus; })[0];
        if (!a) return '';
        var done = a.total - a.untested;
        return '<div style="margin-top:5px;font-size:var(--fs-1);padding:4px 7px;border-radius:6px;'
          + (a.untested ? 'background:var(--warn-tint);color:var(--warn-2)' : 'background:var(--ok-tint);color:var(--ok-2)')
          + '">Focus ' + testEsc(a.module_key) + ' \u00b7 ' + done + ' of ' + a.total
          + (a.untested ? ' \u00b7 ' + a.untested + ' still to run' : ' \u00b7 all run') + '</div>';
      })() : (CBTEST.suggest ? '<div style="margin-top:5px;font-size:var(--fs-1);color:var(--warn-2)">'
          + 'Nothing has been run in ' + testEsc(CBTEST.suggest) + ' yet.</div>' : ''))
    + '';

  /* ⚠️ THE HEAD IS WRITTEN SEPARATELY so that minimising can hide the body and keep this. */
  head.innerHTML = hd;

  if (CBTEST.adding) { body.innerHTML = testAddHTML(); return; }

  /* ── the list ── */
  /* ⚠ NO flex:1 HERE. The body scrolls; this just holds the rows and is allowed to be taller than it. */
  var h = '<div style="padding:7px 9px">';

  /**
   * ⭐ THE NOTICE, ABOVE THE LIST AND NOT INSTEAD OF IT. A refresh must not blank the thing you were reading
   * just to tell you it is refreshing it — that is the Report's seed() fault inverted.
   */
  if (CBTEST.notice) {
    var tone = CBTEST.notice.tone;
    var col = tone === 'bad' ? ['var(--danger-tint,#fbeceb)', '#eccbc9', 'var(--disp)']
            : tone === 'work' ? ['var(--warn-tint,#fdf1dc)', '#e8d7ae', 'var(--warn-2,#8A5A00)']
            : ['var(--blue-tint,#E9F0FA)', 'var(--blue,#3F66A6)', 'var(--ink,#20303b)'];
    h += '<div style="margin:0 0 8px;padding:8px 11px;border-radius:9px;background:' + col[0]
      + ';border:1px solid ' + col[1] + ';color:' + col[2] + ';font-size:var(--fs-1);line-height:1.5">'
      + (tone === 'work' ? '\u25cc ' : tone === 'bad' ? '\u26a0 ' : '\u2713 ')
      + CBTEST.notice.text + '</div>';
  }

  if (CBTEST.busy && !CBTEST.cases.length) {
    h += '<div style="padding:14px;color:var(--grey-2,var(--grey-2));font-size:var(--fs-2)">Reading the cases…</div>';
  } else if (!CBTEST.cases.length) {
    /* ⚠️ AN EMPTY BOARD IS NOT AN ERROR, and must not read like one. Say what to do. */
    h += '<div style="padding:14px 12px;font-size:var(--fs-2);line-height:1.6;color:var(--grey-2,var(--grey-2));text-align:center">'
      +  '<div style="margin-bottom:9px">No test cases on this board yet.</div>'
      +  '<button class="btn pri" onclick="testSeed()" style="font-size:var(--fs-2);padding:6px 14px">'
      +  (CBTEST.seeding ? 'Loading…' : 'Load the test cases') + '</button>'
      +  '<div style="margin-top:9px;font-size:var(--fs-1)">The documented cases — the counter, the bill, the queue, '
      +  'suppliers, the offer lab. Or press <b>+</b> to write your own.</div></div>';
  } else if (!shown.length) {
    h += '<div style="padding:12px;font-size:var(--fs-2);color:var(--grey-2,var(--grey-2))">Nothing in this area yet — '
      +  'press <b>+</b> to add the first case for it.</div>';
  } else {
    /**
     * ── ⭐⭐⭐ GROUPED AND FOLDABLE HERE TOO ───────────────────────────────────────────────────────────────
     *
     * Athi, 2026-09-11: *"the header item as a collapsable, with expand all option… same thing applies
     * everywhere."*
     *
     * ⚠️ THE PANEL HAD NO GROUPING AT ALL — a flat list, which was fine while it always opened on one area and
     * stopped being fine the moment "All areas" meant 616 rows in a floating window four inches wide.
     * ⭐ Folded, the panel shows the shape of the board without becoming a second board.
     */
    /**
     * ⭐⭐ THE MENU TREE, WHEN THAT IS WHAT IS BEING ASKED. Athi: *"yes, give the lab its own tree as well."*
     *
     * ⚠️ IT REPLACES THE LIST, NOT THE SUMMARY. The four figures above stay put, because the tree answers
     * "where am I" and never "how far along is the whole board" — losing the totals on switching view would
     * make the two views disagree about the one number Athi has asked to match twice.
     */
    if (CBTEST.view === 'menu') {
      h += testMenuHTML(shown);
      h += '</div>';
      body.innerHTML = h;
      return;
    }
    /* ⭐ the requirements are their own list and do NOT read from `shown`: a case filter has nothing to say
       about a requirement raised months ago from a case that has since been retired. */
    /* ⭐ incidents are their own board for the same reason requirements are: a case filter has nothing to
       say about something a person experienced at the counter. */
    if (CBTEST.view === 'scr') {
      h += testScrHTML();
      h += '</div>';
      body.innerHTML = h;
      return;
    }
    if (CBTEST.view === 'inc') {
      h += testIncHTML();
      h += '</div>';
      body.innerHTML = h;
      return;
    }
    if (CBTEST.view === 'work') {
      h += testWorkHTML();
      h += '</div>';
      body.innerHTML = h;
      return;
    }
    if (CBTEST.view === 'hand') {
      h += testHandHTML();
      h += '</div>';
      body.innerHTML = h;
      return;
    }
    if (CBTEST.view === 'req') {
      h += testReqHTML();
      h += '</div>';
      body.innerHTML = h;
      return;
    }

    var groups = [], byG = {};
    shown.forEach(function (c) {
      if (!byG[c.module_key]) { byG[c.module_key] = []; groups.push(c.module_key); }
      byG[c.module_key].push(c);
    });
    if (groups.length > 1) {
      /**
       * ── ⭐ THE SAME SHAPE AS THE REPORT, BECAUSE IT IS THE SAME LIST ──────────────────────────────────────
       *
       * Athi, 2026-09-12: *"can you bring the similar style… so it looks one and the same."*
       *
       * ⚠️ THE TWO BUTTONS INHERITED app.html's .btn, which is a heavy dark pill built for a primary action on
       * a full screen. Side by side they filled the panel and read as the most important thing on it — two
       * controls that only fold a list, shouting over the list they fold.
       *
       * ⭐ Quiet, small, and the count sits beside them on ONE line rather than wrapping into the corner.
       * ⚠️ Styled inline rather than by class: this panel is injected into app.html and .btn belongs to the
       * app, so overriding the class here would change every other button that borrows it.
       */
      var qbtn = 'font:inherit;font-size:var(--fs-1);padding:2px 9px;border-radius:7px;cursor:pointer;'
        + 'border:1px solid var(--line,#e7e3d8);background:var(--card,#fff);color:var(--ink-2,#3a4048)';
      h += '<div style="display:flex;gap:6px;align-items:center;padding:4px 2px 6px;flex-wrap:wrap">'
        + '<button style="' + qbtn + '" onclick="testFoldAll(true)">Expand all</button>'
        + '<button style="' + qbtn + '" onclick="testFoldAll(false)">Collapse all</button>'
        + '<span style="font-size:var(--fs-1);color:var(--grey-2);white-space:nowrap">' + groups.length
        + ' areas \u00b7 ' + shown.length + ' cases</span></div>';

      /**
       * ⭐ AND THE AREA LIST GETS THE REPORT'S HEADER — AREA · CASES · PASSED · FAILED · NOT RUN — from the same
       * grid constant the rows use, so the two cannot drift apart.
       */
      /**
       * ⭐ STICKY, SO THE SCROLL STARTS BELOW IT. Athi, 2026-09-12: *"scroll has to start below area?"*
       * ⚠️ The header renders INSIDE #cbtestbody, which is the scroll container — so it scrolled away with
       * the first row and the columns lost their names exactly when the list got long enough to need them.
       * ⚠️ An OPAQUE background is not decoration here: a transparent sticky header lets the rows scroll
       * through it and both become unreadable.
       */
      /**
       * ⭐ EVERY COLUMN IS NAMED, INCLUDING THE SECOND. Athi: *"next column header could be Details."* It was
       * an empty <span> holding a track open — a column of prose with no word above it, which is the same
       * "values under nothing" this board keeps finding elsewhere.
       * ⚠️ white-space:nowrap on the figures, or "NOT RUN" wraps to two lines and the header grows a row.
       * ⭐ A grip between each pair, visible as a hairline — the | he asked for — and draggable.
       */
      var hcell = function (label, i, end) {
        return '<span style="position:relative;min-width:0;overflow:hidden;white-space:nowrap'
          + (end ? ';text-align:end' : '') + '">' + label
          + (i < 5 ? '<span onmousedown="testColDrag(event,' + i + ')" title="Drag to set this column\u2019s '
              + 'width" style="position:absolute;inset-block:-4px;inset-inline-end:-4px;width:9px;'
              + 'cursor:col-resize;z-index:3">'
              + '<span style="position:absolute;inset-block:2px;inset-inline-end:4px;width:1px;'
              + 'background:var(--line,#e7e3d8);display:block"></span></span>'
            : '')
          + '</span>';
      };
      h += '<div id="cbt_areahead" style="position:sticky;top:0;z-index:2;background:var(--card,#fff);'
        + 'display:grid;grid-template-columns:' + testAreaCols() + ';gap:6px;'
        + 'padding:5px 6px 4px;font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.06em;'
        + 'color:var(--grey-2,#545A61);font-weight:700;border-bottom:1px solid var(--line,#e7e3d8)">'
        + hcell('Area', 0) + hcell('Details', 1)
        + hcell('Cases', 2, 1) + hcell('Passed', 3, 1)
        + hcell('Failed', 4, 1) + hcell('Not run', 5, 1) + '</div>';
    }

    groups.forEach(function (gk) {
      var list = byG[gk];
      var open = testSectionOpen(gk, groups.length);
      if (groups.length > 1) {
        /* ⭐ the counts on the header, so a folded area still says how far along it is */
        var gn = { pass: 0, bad: 0, todo: 0 };
        list.forEach(function (c) {
          var ll = CBTEST.last[c.case_key];
          if (!ll) gn.todo++; else if (ll.status === 'fail' || ll.status === 'blocked') gn.bad++; else gn.pass++;
        });
        /**
         * ── ⭐ EVERY LINE ITEM GETS THE SAME TRACKS ────────────────────────────────────────────────────────
         *
         * Athi, 2026-09-12: *"show the count in three different columns"* · *"3 or 4, whatever columns
         * required, for each line item."*
         *
         * ⚠️ THIS ROW HAD THE SUMMARY'S TWO FAULTS AT ONCE. The three figures were concatenated into one
         * string, so nothing lined up between one area and the next — and each was hidden when zero, so an
         * area with nothing run showed a blank where the reader was looking for a number.
         *
         * ⭐ Fixed em tracks, and zeros shown. A column a reader can run their eye down is the entire reason
         * to have a column; a number that moves per row is a sentence wearing a column's clothes.
         * ⚠️ tabular-nums, or the digits jitter and the alignment is decorative rather than real.
         */
        /**
         * ⭐ A ZERO IS AN EM DASH, THE WAY THE REPORT DRAWS IT. Athi asked for the two to look the same, and
         * this is the detail that decides it: a column of literal 0s reads as data and pulls the eye to
         * nothing, while "—" holds the column open and says "none" without competing with the number beside
         * it. ⚠️ It is NOT the hidden-zero fault from earlier — the cell is still there and still occupied.
         */
        var num = function (v, colour) {
          return '<span style="text-align:end;font-variant-numeric:tabular-nums;'
            + (v ? 'font-weight:600;color:' + colour : 'color:var(--grey,#8a949c)') + '">'
            + (v ? v : '\u2014') + '</span>';
        };
        /* ⭐ the journey position, as the Report shows it — 00 REG, 01 LOG. It is the order somebody walks the
           product in, and without it the list reads as a filing cabinet. */
        var seqOf = list.reduce(function (m, c) {
          var q = (typeof c.seq === 'number') ? c.seq : 99; return q < m ? q : m; }, 99);
        var seq = seqOf < 99 ? ('0' + seqOf).slice(-2) : '';

        h += '<div data-arearow="1" onclick="testFold(\'' + testEsc(gk) + '\')" style="display:grid;'
          + 'grid-template-columns:' + testAreaCols() + ';gap:6px;align-items:baseline;'
          + 'cursor:pointer;padding:5px 6px;border-bottom:1px solid var(--line,#efece4)">'
          + '<span style="display:flex;gap:5px;align-items:baseline;min-width:0;overflow:hidden">'
          +   '<span style="color:var(--grey-2);font-size:var(--fs-1)">' + (open ? '\u25be' : '\u25b8') + '</span>'
          +   (seq ? '<span style="font-family:ui-monospace,Menlo,monospace;font-size:var(--fs-1);'
                   + 'color:var(--grey-2,#545A61)">' + seq + '</span>' : '')
          /* ⭐ the key as a CHIP, so it reads as a code rather than as the first word of the name */
          /**
           * ⚠️⚠️ AND A LONG KEY RODE STRAIGHT OVER THE NAME. `chitbridge-api/scripts` is 22 characters in a
           * track sized for `REG`, and with nowrap and no overflow rule the chip simply drew on top of the
           * text beside it — "chitbridge-api/scripts and proofs" as one unreadable smear.
           * ⭐ min-width:0 lets the flex item shrink at all (it defaults to auto, which is why it did not), and
           * the ellipsis keeps the start of the key, which is the half that identifies it.
           */
          +   '<span title="' + testEsc(gk) + '" style="font-family:ui-monospace,Menlo,monospace;'
          +     'font-size:var(--fs-1);font-weight:700;min-width:0;'
          +     'background:var(--ink,#0F2E3D);color:var(--card,#fff);border-radius:4px;padding:1px 5px;'
          +     'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + testEsc(gk) + '</span>'
          + '</span>'
          + '<span style="font-size:var(--fs-2);min-width:0;overflow:hidden;display:flex;gap:6px;'
          + 'align-items:baseline">'
          +   '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
          +     testEsc(list[0].module_name || '') + '</span>'
          /**
           * ⭐ ADD A CASE HERE. ⚠️ stopPropagation is not optional: this sits inside the row's fold handler, so
           * without it pressing + would also collapse the area you were adding to — the exact double-fire
           * already fixed once on the Report's drill-down numbers.
           */
          +   '<button title="Add a case to ' + testEsc(gk) + '" '
          +     'onclick="event.stopPropagation();testAddOpen(\'' + testEsc(gk) + '\')" '
          +     'style="flex:0 0 auto;border:1px solid var(--line,#e7e3d8);background:var(--card,#fff);'
          +     'color:var(--grey-2,#545A61);border-radius:5px;font:inherit;font-size:var(--fs-1);'
          +     'line-height:1;padding:1px 6px;cursor:pointer">+</button>'
          + '</span>'
          + '<span style="text-align:end;font-weight:700;font-size:var(--fs-2);'
          + 'font-variant-numeric:tabular-nums">' + list.length + '</span>'
          + num(gn.pass, 'var(--ok-2)') + num(gn.bad, 'var(--disp)')
          + num(gn.todo, 'var(--warn-2,#8A5A00)')
          + '</div>';
      }
      if (!open) return;

      /**
       * ── ⭐ THE COLUMN HEADER, AND IT HAS TO BE THE SAME GRID ──────────────────────────────────────────────
       *
       * Athi, 2026-09-12: *"including column header, the report is nice — here we need to have the same
       * thing."*
       *
       * ⚠️ THE ALIGNMENT IS THE WHOLE POINT, so the header is built from the SAME grid-template as the rows
       * and cannot drift from them. Two hand-tuned widths would agree today and separate the first time either
       * changed — which is how the Report's case rows ended up sitting under the parent table's headings.
       *
       * ⚠️ The 13px inset is not arbitrary: each row is a CARD with a 1px border and a 3px status stripe, then
       * 9px of padding. The header is not a card, so it has to add back what the card's edges contribute or it
       * sits three pixels to the left of every column it names.
       */
      h += '<div style="display:grid;grid-template-columns:' + TEST_ROW_COLS + ';gap:7px;align-items:baseline;'
        + 'padding:2px 9px 4px 13px;font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.06em;'
        + 'color:var(--grey-2,#545A61);font-weight:700">'
        + '<span>Case</span><span>What it proves</span><span>Kind</span><span>Status</span></div>';

      list.forEach(function (c) {
      var l = CBTEST.last[c.case_key];
      var col = l ? STAT[l.status] : null;
      var isOpen = CBTEST.open === c.case_key;
      h += '<div style="border:1px solid var(--line,#e7e3d8);border-left:3px solid ' + (col ? col[0] : 'transparent')
        +  ';border-radius:8px;margin-bottom:6px;background:var(--card,#fff)">'
        /**
         * ── ⭐⭐⭐ A TABLE, NOT A RAGGED LIST ────────────────────────────────────────────────────────────────
         *
         * Athi, 2026-09-11: *"this is not properly aligned… can you keep as a proper tabular format, so we know
         * the status clearly."*
         *
         * ⚠️⚠️ IT WAS A FLEX ROW, SO THE KEY SET THE COLUMN WIDTH AND EVERY ROW SET IT DIFFERENTLY. With written
         * cases the keys are all five characters and it looked like a table by luck. The moment the automated
         * ones arrived — `chitbridge-api/scripts/journey-supplier-hop.js` beside `gold-demo.js` — the titles
         * started at a different x on every line and the eye had nothing to run down.
         *
         * ⚠️ AND THE STATUS WAS NESTED INSIDE THE TITLE, so it wrapped underneath and moved with the text. The
         * one column a person scans for was the one column that never held still.
         *
         * ⭐ A grid with three fixed tracks: the key ellipsised at a set width, the title taking what is left,
         * the verdict in its own column at the right. `min-width:0` on the middle track is what lets a long
         * title shrink instead of shoving the verdict off the edge.
         */
        /**
         * ⭐ THE SAME FACTS AS THE REPORT'S CASES TAB. Athi, 2026-09-12: *"this is nothing but the cases tab in
         * the report — those information should be here as well."* He is right: it is the same list of the
         * same cases, and a fact worth a column on one surface is worth it on the other.
         * ⚠️ Two extra tracks only, not six. The panel is 420px wide beside a working screen; the Report is a
         * full page. Same information, and the ones that earn the space here are the KIND (a green unit test
         * and a green acceptance test are not the same evidence) and WHAT WOULD MAKE IT GREEN.
         */
        +  '<div onclick="testOpen(\'' + testEsc(c.case_key) + '\')" style="display:grid;'
        +    'grid-template-columns:' + TEST_ROW_COLS + ';gap:7px;align-items:baseline;'
        +    'padding:7px 9px;cursor:pointer">'
        +    '<span title="' + testEsc(c.case_key) + '" style="font-family:ui-monospace,Menlo,monospace;'
        +      'font-size:var(--fs-1);font-weight:700;'
        +      'background:' + (col ? col[1] : 'var(--neutral-tint)') + ';color:' + (col ? col[0] : 'var(--grey-2)')
        +      ';border-radius:4px;padding:2px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
        /* ⭐ the SHORT name in the column, the full path in the tooltip. `chitbridge-api/scripts/` is the same
           twenty-two characters on a hundred rows — it identifies nothing and costs the width the title needs.
           ⚠ NOT ellipsised from the left with direction:rtl, which is what I reached for first: that reorders
           the slashes in a path and produces `js.x/stpircs/` — the exact bidi trap already written down. */
        +      '">' + testEsc(testShortKey(c.case_key)) + '</span>'
        +    '<span style="min-width:0;font-size:var(--fs-2);line-height:1.35;overflow:hidden;'
        +      'text-overflow:ellipsis;white-space:nowrap'
        /* ⚠ 244 of the automated files state no claim in their header. Repeating the filename in the title
           column — `akums-demo.js   akums-demo.js` — fills the row with nothing and hides the fact. */
        +      (c.automated && !c.claim ? ';color:var(--grey-2);font-style:italic' : '') + '">'
        /* ⭐ name the FILE and the fix — "no claim written in the file" named neither (Athi, 2026-09-12) */
        +      testEsc(c.automated && !c.claim
                ? '\u26a0 no heading in ' + String(c.case_key).split('/').pop()
                : (c.title || ''))
        /**
         * ⭐ WHERE THIS CASE HAPPENS, on the row rather than one click inside it. Athi, 2026-09-12: *"can I
         * see the names of the screen in the test lab?"* The code was already reachable by expanding a case;
         * a tester scanning a thousand rows for "everything on the catalogue screen" should not have to open
         * a thousand of them.
         *
         * ⚠️ IN THE TITLE CELL, NOT A COLUMN OF ITS OWN. The row grid is six columns and the sticky header
         * shares the same template — a seventh span slides every heading one place left, which is a worse
         * bug than the one being fixed and looks like a rendering glitch rather than a mistake.
         *
         * ⚠️ Nothing for a case that is not on a screen: a guard file is not a screen, and a name beside one
         * would be a category error dressed as a hint.
         */
        +      (c.menu && testScreenName(c.menu)
        ? '<span style="color:var(--note);font-weight:400"> \u00b7 ' + testEsc(testScreenName(c.menu))
          + '</span>' : '')
        +      '</span>'

        /* ⭐ the KIND in its own track — see the note on the grid */
        +    '<span style="font-size:var(--fs-1);color:var(--grey-2);white-space:nowrap;overflow:hidden;'
        +      'text-overflow:ellipsis" title="What kind of test this is">'
        +      testEsc(c.test_type || '\u2014') + '</span>'
        /* ⭐ the verdict, in its own column, so it is always in the same place on every row */
        +    '<span style="font-size:var(--fs-1);white-space:nowrap;font-weight:' + (l ? '700' : '400') + ';'
        +      'color:' + (col ? col[0] : 'var(--grey-2)') + '">'
        +      (l ? testEsc(l.status.toUpperCase()) : 'not run')
        +      '<span style="font-weight:400;color:var(--grey-2);margin-inline-start:5px">'
        +      (l ? testEsc(testAgo(l.at)) : '') + '</span>'
        /**
         * ⭐ AND WHAT WOULD MAKE IT GREEN, under the verdict rather than beside it — the panel has no width to
         * spare, and this is the line a tester acts on.
         * ⚠️ Guarded on the shared file having arrived: a column that cannot be computed is omitted, never
         * faked. See testEnsureVerdict.
         */
        +      (typeof testVerdictLabel === 'function' && l && l.status !== 'pass'
                ? '<span style="display:block;font-weight:400;font-size:var(--fs-1);color:var(--grey-2)" title="'
                  + testEsc(testVerdict(c, l).why) + '">' + testEsc(testVerdictLabel(c, l)) + '</span>'
                : '')
        +      '</span>'
        /* ⚠️ THE SPEC MOVED, SO THE CASE IS SUSPECT — said on the row, not hidden behind a filter. A green
           case whose clause has changed is the most misleading thing a board can show. */
        + (CBTEST.stale[c.case_key]
            ? '<span title="' + testEsc('The clause this case proves has changed since it was written — '
                + 'clause ' + CBTEST.stale[c.case_key].clause + ' is now v' + CBTEST.stale[c.case_key].clause_now
                + ', this case cites v' + CBTEST.stale[c.case_key].cited_version + '.')
              + '" style="font-size:var(--fs-1);background:var(--warn-tint);color:var(--warn-2);border-radius:4px;'
              + 'padding:2px 5px;white-space:nowrap">spec moved</span>'
            : '')
        +  '</div>';
      if (isOpen) h += testCaseBodyHTML(c);
      h += '</div>';
      });
    });
  }
  h += '</div>';
  body.innerHTML = h;
}

/**
 * ⭐ The name that identifies a case in a column: a written case IS its key (CTR-01); a file is its basename.
 * ⚠️ The directory is not dropped, it moves to the tooltip — two cases can share a basename across repos.
 */
/**
 * ⭐ WHICH AREAS ARE OPEN — the same rule as the board, and deliberately the same rule.
 * ⚠️ One area showing means somebody went looking for it: open it. Several means they are surveying: fold.
 * A choice already made always wins over the default, and "expand all" is a STATE rather than an action —
 * the panel repaints on every tap, and an action would be undone by the next one.
 */
/**
 * ── ⭐⭐ TWO WAYS TO READ ONE BOARD ──────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"yes, give the lab its own tree as well."*
 *
 * ⭐ THE LIST ANSWERS "what is left to do"; THE TREE ANSWERS "where am I, and what is behind this door".
 * They are the same cases and the same counts — testMenuTree() and testCounts() are shared with the Report —
 * so switching view changes what the reader is asking, never what the board says.
 *
 * ⚠️ REMEMBERED, because a view is a way of working and re-choosing it on every open is a small tax charged
 * repeatedly. Same rule as the folds beside it.
 */
/* ⚠️ read ONCE at first use — a paint that read localStorage per row would touch it hundreds of times */
var TEST_VIEWS = ['work', 'list', 'menu', 'req', 'inc', 'scr', 'hand'];
/**
 * ⭐⭐ THE PANEL OPENS ON THE WORKLIST. Athi, 2026-09-13: *"this is really confusing — what am I looking at,
 * where do I find the existing one, where do I see the closed one?"* The first thing a tester should see is
 * what is waiting for them, not a thousand documented cases grouped by module.
 * ⚠️ A REMEMBERED CHOICE STILL WINS. Somebody who last used By-screen gets By-screen; this only changes what
 * happens for a person who has never chosen — which is every new tester, and the only one who is lost.
 */
function testViewGet() {
  try { var v = localStorage.getItem('cb_test_view'); return TEST_VIEWS.indexOf(v) >= 0 ? v : 'work'; }
  catch (_) { return 'work'; }
}
function testSetView(v) {
  if (TEST_VIEWS.indexOf(v) < 0) v = 'work';
  try { localStorage.setItem('cb_test_view', v); } catch (_) {}
  CBTEST.view = v;
  /* ⚠️ the requirements are read on ARRIVAL, not with the cases: a list nobody has opened should not be one
     more call on every panel open. [[feedback-on-demand-loading]] */
  if (v === 'req' && !CBTEST.reqs) testReqLoad();
  else if (v === 'inc' && !CBTEST.incs) testIncLoad();
  else if (v === 'scr' && !CBTEST.scrRes) testScrLoad();
  /* ⚠️ the worklist is a JOIN of the cases, the results and both boards — it cannot paint truthfully until
     the all-states copy is in, and a worklist that silently omits the incidents is worse than no worklist. */
  else if (v === 'work' && !CBTEST.scrInc) { CBTEST.closedCases = null; testFindLoadClosed(); testScrLoad(); }
  else testPaint();
}

/**
 * ── ⭐⭐⭐ THE REQUIREMENTS RAISED WHILE TESTING ───────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"we must be having an option to filter the requirements which are not actioned, so we can
 * set the flag"* · *"this testlab is only for the developers and testers so we can conveniently showcase all
 * the requirements captured"* · *"this will help to keep it prioritised, backlog and so on."*
 *
 * ⭐ SO IT IS A BACKLOG, NOT A LOG. It opens on what is NOT ACTIONED, sorts by priority with the oldest first
 * inside each, and can show everything ever captured — the audience is developers and testers, so it says the
 * state, the priority, who raised it and from which case, without softening any of it.
 */
/**
 * ── ⚠️⚠️⚠️ A FILTER AND AN ACTION MUST NEVER LOOK ALIKE, AND MUST NEVER SHARE A WORD ──────────────────────
 *
 * Athi, 2026-09-13: *"when I update as resolved, it is not getting reflected?"* and *"the status is not
 * changing when I close it — it has to change the status, and the closed one should leave the queue."*
 *
 * ⚠️⚠️ AND HE WAS PRESSING THE FILTER. Driving it from outside settled it in one run: the wire carried NO
 * PATCH at all, only `GET /incidents?state=resolved`. The row of chips at the top of the Incidents view reads
 * Open · Raised · Being looked at · RESOLVED · CLOSED · Everything — and the action on the row said RESOLVED
 * too, in the SAME `base` style string, forty pixels below. Pressing the top one showed an empty list
 * ("nothing in this state"), which reads exactly like "I marked it and nothing happened".
 *
 * ⭐ THE FIX IS NOT A BIGGER BUTTON, IT IS TWO DIFFERENT KINDS OF THING LOOKING DIFFERENT. A filter narrows
 * what you SEE; an action changes what IS. So: the filters are quiet, unbordered, prefixed "Show:", and the
 * actions are bordered, inked, on their own line, prefixed "Mark:" and phrased as verbs. Same information,
 * and now nobody can press one meaning the other.
 *
 * ⚠️ The words themselves cannot all change — "resolved" IS the state, in the filter and in the action alike.
 * Which is exactly why the LOOK has to carry the difference.
 */
var TEST_CHIP = 'font:inherit;font-size:var(--fs-1);padding:2px 9px;border:0;border-radius:11px;'
  + 'cursor:pointer;margin-inline-end:4px;';
var TEST_CHIP_ON = 'background:var(--ink,#0F2E3D);color:var(--card,#fff)';
var TEST_CHIP_OFF = 'background:var(--neutral-tint,#f2efe6);color:var(--grey-2,#545A61)';
var TEST_ACT = 'font:inherit;font-size:var(--fs-1);padding:3px 10px;border:1px solid '
  + 'var(--grey-2,#545A61);border-radius:7px;cursor:pointer;margin-inline-end:5px;'
  + 'background:var(--card,#fff);color:var(--ink,#20303b);font-weight:700';
/** ⭐ the actions never float loose in a metadata line again: they are a row, and they are labelled */
function testActRow(acts) {
  if (!acts) return '';
  return '<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:5px">'
    + '<span style="font-size:var(--fs-1);color:var(--note)">Mark:</span>' + acts + '</div>';
}

var TEST_REQ_STATES = ['raised', 'accepted', 'implemented', 'rejected'];
function testReqFilterGet() {
  try { var v = localStorage.getItem('cb_test_reqf'); return v || 'open'; } catch (_) { return 'open'; }
}
function testReqFilter(v) {
  try { localStorage.setItem('cb_test_reqf', v); } catch (_) {}
  testReqLoad();
}
async function testReqLoad() {
  CBTEST.reqBusy = true; testRepaint();
  try { CBTEST.reqs = await api('testReqList', { query: { state: testReqFilterGet() } }); CBTEST.reqErr = null; }
  catch (e) { CBTEST.reqErr = (e && e.message) || 'Could not read them.'; }
  CBTEST.reqBusy = false; testRepaint();
}
/**
 * ⚠️⚠️ REJECTING ASKS FOR THE REASON AND WILL NOT PROCEED WITHOUT ONE. The server refuses it too — but a refusal
 * that arrives after the click is a worse way to learn it. A "no" with no reason gets re-raised by the next
 * tester, and rightly.
 */
async function testReqSet(id, state) {
  var why = null;
  if (state === 'rejected') {
    why = await testAsk('Why is this rejected?',
      'The next tester reads this instead of raising it again.', 'Reject it');
    if (why === null) return;                       /* cancelled — nothing is changed */
    if (!String(why).trim()) { if (typeof toast === 'function') toast('A rejection needs its reason.'); return; }
  }
  try {
    await api('testReqSet', { params: { id: id }, body: { state: state, why: why } });
    if (typeof toast === 'function') toast('Marked ' + state);
    testNewsRefresh('requirement');
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not set that.'); }
}
async function testReqPri(id, priority) {
  try { await api('testReqSet', { params: { id: id }, body: { state: null, priority: priority } }); testReqLoad(); }
  catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not set that.'); }
}

/**
 * ── ⭐⭐⭐ THE BOX A TESTER WRITES IT IN ───────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"we may have to have a text box to add new requirement so it can be considered, because
 * the testers will not have you."*
 *
 * ⚠️⚠️ TWO FIELDS, NOT ONE, and the second is the one people skip. **What must be true** is the requirement;
 * **what you saw** is why anybody should believe it. A list of rules with no evidence is a wish-list, and six
 * months later nobody can tell which entries were ever real.
 *
 * ⭐ THE CASE KEY IS PREFILLED FROM WHERE THE TESTER IS STANDING, because the whole value of raising it here
 * rather than in a document is that the link back to the case is made for free — that is the citation the
 * board has never had.
 */
function testReqFormHTML() {
  var open = CBTEST.reqForm;
  var base = 'font:inherit;font-size:var(--fs-1);padding:2px 8px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;margin-inline-end:5px;background:var(--card,#fff);color:var(--grey-2,#545A61);';
  if (!open) {
    return '<button onclick="testReqForm(1)" style="' + base + 'font-weight:700">+ Raise a requirement</button>';
  }
  var inp = 'width:100%;font:inherit;font-size:var(--fs-2);padding:5px 7px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;background:var(--card,#fff);color:var(--ink,#1a1a1a);margin-bottom:5px;box-sizing:border-box';
  return '<div style="border:1px solid var(--line,#e7e3d8);border-radius:9px;padding:8px;margin-bottom:9px">'
    + '<div style="font-size:var(--fs-1);color:var(--note);margin-bottom:4px">'
    +   'What must the product do — and what did you see that says it does not?</div>'
    + '<input id="reqWhat" style="' + inp + '" placeholder="What must be true — e.g. a unit sold by weight must accept a fraction">'
    + '<input id="reqSeen" style="' + inp + '" placeholder="What you saw — e.g. typed 0.5 kg and the line disappeared">'
    + '<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">'
    +   '<select id="reqPri" style="' + inp + ';width:auto;margin:0">'
    +     '<option>High</option><option selected>Medium</option><option>Low</option></select>'
    +   '<input id="reqCase" style="' + inp + ';width:auto;flex:1;margin:0" placeholder="from case (optional)" value="'
    +     testEsc(CBTEST.focusCase || '') + '">'
    /* ⚠️ SHOWN, NOT SILENT. Capturing where somebody is standing without telling them is the kind of quiet
       cleverness that makes people distrust a tool — it says what it will record, before they press Raise. */
    + '</div><div style="font-size:var(--fs-1);color:var(--note);margin-top:5px">'
    +   (typeof screenCode === 'function' && screenCode()
        ? 'Recorded against <b>' + testEsc(screenCode()) + '</b>'
        : 'No screen code here — this one will be recorded without it')
    +   (document.querySelector('[data-testid="popup-code"]')
        ? ' and <b>' + testEsc(String(document.querySelector('[data-testid="popup-code"]').textContent).trim()) + '</b>'
        : '')
    +   '<button onclick="testReqSend()" style="' + base + 'font-weight:700">Raise</button>'
    +   '<button onclick="testReqForm(0)" style="' + base + '">Cancel</button>'
    + '</div></div>';
}
function testReqForm(on) { CBTEST.reqForm = !!on; testPaint(); }
/**
 * ⚠️ THE FIELDS ARE READ FROM THE DOM, NOT FROM STATE, and that is deliberate: a keystroke-by-keystroke state
 * would repaint the panel under the cursor, which is how a half-typed sentence is lost. [[feedback-repaint-locally]]
 */
async function testReqSend() {
  var g = function (id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
  var what = g('reqWhat'), seen = g('reqSeen');
  /* ⚠️ said here rather than after a round trip — the server refuses these too, but not before the typing is gone */
  if (!what) { if (typeof toast === 'function') toast('Say what must be true.'); return; }
  if (!seen) { if (typeof toast === 'function') toast('Say what you saw — a requirement with no evidence cannot be judged.'); return; }
  try {
    /**
     * ⭐⭐ THE CODES RIDE ALONG, UNASKED. A tester should not have to know what a screen code is to record one —
     * the panel is open on top of the screen they are testing, so it already knows.
     * ⚠️ Whatever is showing AT THE MOMENT OF RAISING, not when the form was opened: somebody types the sentence,
     * goes back to look again, and comes back. The second look is the one that matters.
     */
    var sc = (typeof screenCode === 'function') ? screenCode() : null;
    var pc = null;
    try {
      var pe = document.querySelector('[data-testid="popup-code"]');
      pc = pe ? String(pe.textContent).replace(/[^A-Z0-9]/g, '') : null;
    } catch (_) { pc = null; }
    var r = await api('testReqRaise', { body: {
      requirement: what, observed: seen, priority: g('reqPri') || 'Medium', case_key: g('reqCase') || null,
      screen_code: sc, popup_code: pc } });
    if (typeof toast === 'function') {
      toast('Raised ' + (r && r.clause ? r.clause : '') + (r && r.cited ? ' — and the case now cites it' : ''));
    }
    CBTEST.reqForm = false;
    testReqLoad();
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not raise it.'); }
}

function testReqHTML() {
  var d = CBTEST.reqs, f = testReqFilterGet();
  /* ⚠️ Accepted and Rejected appear in BOTH rows here too — quiet chips above, inked verbs on the row */
  var chips = '<span style="font-size:var(--fs-1);color:var(--note);margin-inline-end:5px">Show:</span>'
    + [['open', 'Not actioned'], ['raised', 'Raised'], ['accepted', 'Accepted'],
       ['implemented', 'Implemented'], ['rejected', 'Rejected'], ['all', 'Everything']]
    .map(function (x) {
      var on = f === x[0];
      var n = d && d.counts ? (x[0] === 'open' ? d.open : (x[0] === 'all' ? d.total : d.counts[x[0]])) : null;
      return '<button data-testid="reqf-' + x[0] + '" onclick="testReqFilter(\'' + x[0] + '\')" '
        + 'style="' + TEST_CHIP + (on ? TEST_CHIP_ON : TEST_CHIP_OFF) + '">'
        + testEsc(x[1]) + (n == null ? '' : ' <b>' + n + '</b>') + '</button>';
    }).join('');

  var h = testReqFormHTML() + '<div style="margin:6px 0 8px">' + chips + '</div>';
  if (CBTEST.reqBusy) return h + '<div style="color:var(--note);font-size:var(--fs-1)">reading…</div>';
  if (CBTEST.reqErr) return h + '<div style="color:var(--disp);font-size:var(--fs-1)">' + testEsc(CBTEST.reqErr) + '</div>';
  var list = (d && d.requirements) || [];
  if (!list.length) {
    /* ⚠️ AN EMPTY LIST SAYS WHICH EMPTY IT IS. "Nothing raised yet" and "nothing left to action" are different
       facts and only one of them is good news. */
    return h + '<div style="color:var(--note);font-size:var(--fs-1);padding:8px 0">'
      + (d && d.total ? 'Nothing in this state — ' + d.total + ' captured altogether.'
                      : 'Nothing raised yet. Raise one from a case when a test finds something the product should do.')
      + '</div>';
  }

  var PRI = { High: 'var(--disp,#B3261E)', Medium: 'var(--grey-2,#545A61)', Low: 'var(--note,#8a8378)' };
  /**
   * ── ⭐⭐⭐ ONE ROW, THREE SURFACES ─────────────────────────────────────────────────────────────────────
   *
   * Athi, 2026-09-13: *"we have to see how we reuse the content, UI/UX, so we don’t need to repeat the
   * work three times. Possibly unification should help."*
   *
   * ⚠️⚠️ THIS FUNCTION HELD EIGHTY LINES OF MARKUP FOR A ROW THE WORKLIST ALREADY DREW, and the two had
   * already drifted: the Lab said "resolved" where the Bench said "Retest", the Lab had no "next:" line at
   * all, and the two verdict buttons only existed on one of them. Every improvement had to be made twice
   * and in practice was made once. [[feedback-no-duplicate-functions]]
   *
   * ⭐ The row now comes from testWorkRowHTML, which carries the severity in words, both clocks and the
   * re-grade select — everything this row used to draw for itself — as optional parts.
   */
  /* ⭐ the same row as the Bench and the worklist — see the note in testIncHTML */
  h += list.map(function (q) {
    return testWorkRowHTML(testWorkRow({
      key: q.clause || '', title: q.requirement || '', screen: q.screen_code || '',
      seen: q.observed || null, by: q.raised_by || null, at: q.raised_at || null,
      last: null, inc: null, req: q, caseKey: q.raised_from || null,
    }));
  }).join('');
  return h;
}

/**
 * ⭐ THE TWO VIEWS, AS A SEGMENTED PAIR. The one you are in is filled; the other is not. ⚠️ Both are always
 * drawn — a toggle that shows only the alternative makes the reader work out which state they are in from
 * what is missing.
 */
/**
 * ⭐ THE CODE FOR A CASE'S SCREEN, from the menu path the sweep already put on it. Athi: *"make it visible in
 * the screen and also in the testlab."*
 * ⚠️ Empty when the case is not on a menu — the guard files and the harness are not screens, and a code beside
 * them would be a category error rather than a helpful hint.
 */
/**
 * ⭐⭐ THE SCREEN NAME, NOT ONLY ITS CODE. Athi, 2026-09-12: *"can I see the names of the screen in the test
 * lab?"*
 *
 * ⚠️ A CODE ALONE IS UNREADABLE UNTIL YOU HAVE LEARNED IT, which is the wrong way round: the code exists so
 * a screen can be QUOTED, not so it can be looked up. On a list of a thousand rows, "CAT004" tells a tester
 * nothing they can act on and "CAT004 Catalogue setup" tells them where to stand.
 *
 * ⭐ Read from the register, never written here — the same rule as the code itself.
 */
function testScreenName(menu) {
  try {
    if (!menu || !window.CBSCREENS) return '';
    var code = window.CBSCREENS.byPath[String(menu)];
    if (!code) return '';
    var row = (window.CBSCREENS.rows || []).filter(function (r) { return r.code === code; })[0];
    return row ? (row.screen || '') : '';
  } catch (_) { return ''; }
}

function testScreenCode(menu) {
  try {
    if (!menu || !window.CBSCREENS) return '';
    var code = window.CBSCREENS.byPath[String(menu)];
    return code ? '<code style="font-family:\'Space Mono\',ui-monospace,monospace;font-size:var(--fs-1);'
      + 'color:var(--grey-2);background:var(--neutral-tint);border-radius:5px;padding:0 5px;user-select:all;'
      + 'margin-inline-end:5px" title="' + testEsc(String(menu)) + '">' + testEsc(code) + '</code>' : '';
  } catch (_) { return ''; }
}

/**
 * ── ⭐⭐⭐ THE INCIDENT BOARD ─────────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"similarly we have to create incident management tool from our system so we can use it
 * to record incidents and the entire change control."*
 *
 * ⚠️⚠️ IT OPENS ON WHAT IS STILL OPEN, AND IT LEADS WITH SEVERITY, because the question anybody opens this to
 * ask is *"what is broken right now, and how badly."* A log sorted newest-first answers a different question
 * and buries the oldest Sev-1, which is precisely the row that must never sink.
 *
 * ⭐ THE NUMBERS COME FROM THE SERVER, NOT FROM COUNTING THE ROWS ON SCREEN. A filtered list counting itself
 * reports the filter, and every chip would then say the same number.
 */
var TEST_INC_SEV = ['Sev-1', 'Sev-2', 'Sev-3', 'Sev-4'];
/**
 * ── ⭐⭐⭐ THE PRODUCT ASKS ITS OWN QUESTIONS ───────────────────────────────────────────────────────────────────
 *
 * Athi, CAT001-H08 (written with the tool's own Create button): *"when I close the case, the toaster message
 * comes from the browser — it has to be from [the app]."*
 *
 * ⚠️⚠️ AND EVERY CLOSING REASON ON THIS BOARD WAS A `window.prompt`. Five of them. A grey Chrome strip pinned to
 * the top of the window, in the browser's font, with the page URL above it — asking for the one sentence that
 * ends up permanently on a finding. It cannot be styled, it cannot be themed, it cannot be translated by tx(),
 * it gives one line for something people write a paragraph in, it is suppressible by the browser, and on a
 * phone it covers the screen it is asking about.
 *
 * ⭐ AND THE APP ALREADY HAD THE ANSWER: `modal()`, which every other question in this product is asked
 * through — themed, movable, RTL-correct, and at z-index 5000, which is above this panel's 4000.
 * [[feedback-adopt-dont-reinvent]] and [[feedback-stay-in-the-construct]]: not a second way to ask, the one way.
 *
 * ⚠️ IT RETURNS A PROMISE, so it is a drop-in for `window.prompt` in the async callers — `var w = await
 * testAsk(...)` reads the same as `var w = window.prompt(...)` and the flow below it does not change.
 *
 * ⚠️ AND IT RESOLVES ON EVERY WAY OUT, including the ✕ and the backdrop that belong to modal() and know nothing
 * about us. A promise that never settles leaves the caller waiting forever with no error anywhere — the quiet
 * kind of break. A short watcher settles it the moment the modal is gone. [[feedback-silence-is-the-bug]]
 */
function testAsk(question, hint, okLabel) {
  return new Promise(function (resolve) {
    if (typeof modal !== 'function') { resolve(window.prompt(question)); return; }
    var done = false;
    var finish = function (v) {
      if (done) return; done = true;
      clearInterval(CBTEST._askWatch); CBTEST._askWatch = null; CBTEST._askDone = null;
      resolve(v);
    };
    CBTEST._askDone = finish;
    var inp = 'width:100%;font:inherit;font-size:var(--fs-2);padding:7px 9px;border:1px solid '
      + 'var(--line,#e7e3d8);border-radius:8px;background:var(--card,#fff);box-sizing:border-box';
    modal('<div class="mhead"><b>' + testEsc(question) + '</b></div>'
      + '<div class="mbody">'
      + (hint ? '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-bottom:6px">'
          + testEsc(hint) + '</div>' : '')
      + '<textarea id="cbaskbox" rows="3" style="' + inp + '"></textarea></div>'
      + '<div class="mfoot">'
      + '<button class="pri" data-testid="ask-ok" onclick="testAskOk()">' + (okLabel || 'Save') + '</button> '
      + '<button class="btn" data-testid="ask-cancel" onclick="testAskCancel()">Cancel</button>'
      + '</div>');
    setTimeout(function () { try { document.getElementById('cbaskbox').focus(); } catch (_) {} }, 60);
    /* ⚠ the ✕ and the backdrop are modal()'s own and do not call us — watch for the box going away */
    CBTEST._askWatch = setInterval(function () {
      if (!document.getElementById('cbaskbox')) finish(null);
    }, 250);
  });
}
function testAskOk() {
  var el = document.getElementById('cbaskbox');
  var v = el ? String(el.value || '') : '';
  var f = CBTEST._askDone;
  try { if (typeof closeModal === 'function') closeModal(); } catch (_) {}
  if (f) f(v);
}
function testAskCancel() {
  var f = CBTEST._askDone;
  try { if (typeof closeModal === 'function') closeModal(); } catch (_) {}
  if (f) f(null);
}

function testIncFilterGet() {
  try { return localStorage.getItem('cb_test_incf') || 'open'; } catch (_) { return 'open'; }
}
function testIncFilter(v) {
  try { localStorage.setItem('cb_test_incf', v); } catch (_) {}
  testIncLoad();
}
/**
 * ── ⚠️⚠️ THE BOARD IS THREE LISTS OF THE SAME FINDINGS, AND THEY WERE DRIFTING ────────────────────────────
 *
 * `CBTEST.incs` is the Incidents view (filtered to what that view asks for). `CBTEST.scrInc` is EVERY
 * incident in every state, and it is what By-screen and Findings read. Marking something resolved refreshed
 * the first and not the second — so the Findings row a person had just acted on went on showing the state
 * it had before they touched it, and the natural conclusion is that the button did not work.
 *
 * ⭐ SO EVERY VERDICT CALLS ONE FUNCTION, and it refreshes what is actually loaded — nothing else. A view
 * nobody has opened is not fetched here; it reads when it opens, as it always did.
 */
async function testNewsRefresh(what) {
  var jobs = [];
  try { if (CBTEST.incs && (!what || what === 'incident')) jobs.push(testIncLoad()); } catch (_) {}
  try { if (CBTEST.reqs && (!what || what === 'requirement')) jobs.push(testReqLoad()); } catch (_) {}
  /* ⚠️ the all-states copy is what Findings and By-screen read; without it a verdict is invisible there */
  try { if (CBTEST.scrInc || CBTEST.scrReq) jobs.push(testScrLoad()); } catch (_) {}
  try { if (what === 'case') { CBTEST.closedCases = null; jobs.push(testLoad(true)); } } catch (_) {}
  try { await Promise.all(jobs); } catch (_) {}
  /* ⭐ the loaders above repaint as they finish; this is the one after the LAST of them lands */
  testRepaint();
}

async function testIncLoad() {
  CBTEST.incBusy = true; testRepaint();
  try { CBTEST.incs = await api('testIncList', { query: { state: testIncFilterGet() } }); CBTEST.incErr = null; }
  catch (e) { CBTEST.incErr = (e && e.message) || 'Could not read them.'; }
  CBTEST.incBusy = false; testRepaint();
}

/**
 * ⚠️⚠️ RESOLVING ASKS WHAT CHANGED AND WILL NOT PROCEED WITHOUT AN ANSWER. The server refuses it too, but a
 * refusal arriving after the click is a worse way to learn the rule. ⭐ A commit sha is accepted as the answer
 * and CITED — the message, the diff and the author stay in git, where they cannot drift from the truth.
 */
async function testIncSet(id, state) {
  var body = { state: state };
  if (state === 'resolved') {
    var a = await testAsk('What fixed it?',
      'Paste the commit sha and it is cited into git \u2014 or say why nothing needed changing.', 'Mark it fixed');
    if (a === null) return;
    a = String(a).trim();
    if (!a) { if (typeof toast === 'function') toast('A resolution needs the commit, or a reason.'); return; }
    /* ⭐ a sha is a citation; anything else is an explanation, and both are legitimate answers */
    if (/^[0-9a-fA-F]{7,40}$/.test(a)) body.change = { sha: a.toLowerCase() };
    else body.why = a;
  }
  if (state === 'closed') {
    var w = await testAsk('Why is this closed?',
      'The next person reads this instead of reopening it.', 'Close it');
    if (w === null) return;
    if (!String(w).trim()) { if (typeof toast === 'function') toast('Closing needs its reason.'); return; }
    body.why = String(w).trim();
  }
  try {
    await api('testIncSet', { params: { id: id }, body: body });
    if (typeof toast === 'function') toast('Marked ' + state);
    testNewsRefresh('incident');
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not set that.'); }
}
async function testIncSev(id, severity) {
  try { await api('testIncSet', { params: { id: id }, body: { state: null, severity: severity } }); testIncLoad(); }
  catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not set that.'); }
}

/**
 * ── ⚠️⚠️ THE BOX, AND WHERE IT IS NOT ────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ A FORM REACHED THROUGH A MENU, AFTER THE FACT, IS A FORM NOBODY FILLS IN. The honest evidence is in this
 * repo: a policy flag sat unsettable for four days and nobody noticed, because nothing put it in front of
 * anybody. This box works for the person already in the lab; the door for someone standing on a broken screen
 * is the screen code itself, and that is where the next piece of this goes.
 *
 * ⭐ WHAT IT CAPTURES WITHOUT ASKING: the screen code, the dialog code if one is open, and the build. Three
 * things a person will not think to write and an investigator cannot work without.
 */
function testIncFormHTML() {
  var inp = 'width:100%;font:inherit;font-size:var(--fs-2);padding:5px 7px;border:1px solid '
    + 'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff);margin-bottom:5px';
  var btn = 'font:inherit;font-size:var(--fs-1);padding:3px 10px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;background:var(--card,#fff)';
  if (!CBTEST.incForm) {
    return '<div style="margin:2px 0 8px"><button onclick="testIncForm(true)" style="' + btn + '">'
      + '\u2295 Record an incident</button></div>';
  }
  var sc = testHereScreen();
  var sevs = TEST_INC_SEV.map(function (x) {
    return '<option value="' + x + '"' + (x === 'Sev-3' ? ' selected' : '') + '>' + x + '</option>';
  }).join('');
  return '<div style="border:1px solid var(--line,#e7e3d8);border-radius:9px;padding:9px;margin:2px 0 9px">'
    + '<textarea id="incWhat" rows="2" placeholder="What happened? \u2014 the counter stopped taking bills at 4pm" '
    +   'style="' + inp + '"></textarea>'
    + '<input id="incWho" placeholder="Who is affected? \u2014 the shop, one till, just me" style="' + inp + '">'
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
    /* ⚠️ BOTH DOORS ASK. An incident raised from the Manager and one raised from Capture must carry the same
       fields, or the report has two shapes of incident in it and the clock works for half of them. */
    +   testWhenHTML()
    +   '<select id="incSev" style="font:inherit;font-size:var(--fs-1);padding:3px 6px;border:1px solid '
    +     'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff)">' + sevs + '</select>'
    +   '<button onclick="testIncSend()" style="' + btn + '">Record</button>'
    +   '<button onclick="testIncForm(false)" style="' + btn + '">Cancel</button>'
    +   '<span style="font-size:var(--fs-1);color:var(--note)">Recorded against '
    +     (sc ? '<code>' + testEsc(sc) + '</code>' : 'no screen') + ' \u00b7 now</span>'
    + '</div></div>';
}
function testIncForm(on) { CBTEST.incForm = !!on; testPaint(); }

/**
 * ⭐ WHERE THE PERSON IS STANDING, read from the app's own stamp rather than asked for. ⚠️ Read at the moment
 * of recording, never remembered: a code captured when the panel opened would name the screen they left.
 */
function testHereScreen() {
  try {
    var t = document.querySelector('[data-testid="detail-code"]')
         || document.querySelector('[data-testid="screen-code"]');
    return t ? String(t.textContent || '').trim() : '';
  } catch (_) { return ''; }
}

async function testIncSend() {
  var what = (document.getElementById('incWhat') || {}).value || '';
  var who = (document.getElementById('incWho') || {}).value || '';
  var sev = (document.getElementById('incSev') || {}).value || 'Sev-3';
  if (!String(what).trim()) { if (typeof toast === 'function') toast('Say what happened.'); return; }
  try {
    await api('testIncNew', { body: {
      observed: what, affected: who, severity: sev,
      /* ⭐ the other half of the clock — see testWhenHTML */
      happened_at: testWhenAt(),
      screen_code: testHereScreen(),
      popup_code: (typeof modalCode === 'function') ? modalCode() : null,
      build: (window.CBBUILD || null),
    } });
    CBTEST.incForm = false;
    if (typeof toast === 'function') toast('Recorded');
    testIncLoad();
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not record it.'); }
}

function testIncHTML() {
  var d = CBTEST.incs, f = testIncFilterGet();
  /* ⚠️ these NARROW WHAT YOU SEE and change nothing — see the note above TEST_CHIP for what that cost */
  var chips = '<span style="font-size:var(--fs-1);color:var(--note);margin-inline-end:5px">Show:</span>'
    + [['open', 'Open'], ['raised', 'Raised'], ['investigating', 'Being looked at'],
       ['resolved', 'Resolved'], ['closed', 'Closed'], ['all', 'Everything']]
    .map(function (x) {
      var on = f === x[0];
      var n = d && d.counts ? (x[0] === 'open' ? d.open : (x[0] === 'all' ? d.total : d.counts[x[0]])) : null;
      return '<button data-testid="incf-' + x[0] + '" onclick="testIncFilter(\'' + x[0] + '\')" '
        + 'style="' + TEST_CHIP + (on ? TEST_CHIP_ON : TEST_CHIP_OFF) + '">'
        + testEsc(x[1]) + (n == null ? '' : ' <b>' + n + '</b>') + '</button>';
    }).join('');

  /* ⭐ THE ONE LINE A RELEASE GATE ASKS FOR, above the list rather than inside it: how many open, at what
     severity. ⚠️ It says "none open" rather than showing four zeros — four zeros is a thing to decode. */
  var gate = '';
  if (d && d.open_by_severity) {
    var bits = TEST_INC_SEV.filter(function (k) { return d.open_by_severity[k]; })
      .map(function (k) { return '<b>' + d.open_by_severity[k] + '</b> ' + k; });
    gate = '<div style="font-size:var(--fs-1);color:var(--note);margin:2px 0 6px">'
      + (bits.length ? 'Open: ' + bits.join(' \u00b7 ') : 'Nothing open.') + '</div>';
  }

  var h = testIncFormHTML() + gate + '<div style="margin:6px 0 8px">' + chips + '</div>';
  if (CBTEST.incBusy) return h + '<div style="color:var(--note);font-size:var(--fs-1)">reading\u2026</div>';
  if (CBTEST.incErr) {
    return h + '<div style="color:var(--disp);font-size:var(--fs-1)">' + testEsc(CBTEST.incErr) + '</div>';
  }
  var list = (d && d.incidents) || [];
  if (!list.length) {
    /* ⚠️ AN EMPTY LIST SAYS WHICH EMPTY IT IS: "none recorded" and "none left open" are different facts. */
    return h + '<div style="color:var(--note);font-size:var(--fs-1);padding:8px 0">'
      + (d && d.total ? 'Nothing in this state \u2014 ' + d.total + ' recorded altogether.'
                      : 'Nothing recorded yet. Record one the moment something stops working.')
      + '</div>';
  }

  var SEV = { 'Sev-1': 'var(--disp,#B3261E)', 'Sev-2': 'var(--disp,#B3261E)',
              'Sev-3': 'var(--grey-2,#545A61)', 'Sev-4': 'var(--note,#8a8378)' };
  h += list.map(function (q) {
    /**
     * ⭐ VERBS, AND THEY SAY WHAT THEY WILL DO. "Resolved" beside a filter that also says "Resolved" is a
     * word, not an instruction. "Mark it fixed" cannot be read as a way of looking at the list.
     */
    var act = function (state, label, title) {
      return '<button data-testid="inc-act-' + state + '" title="' + title + '" '
        + 'onclick="testIncSet(\'' + q.definition_id + '\',\'' + state + '\')" style="' + TEST_ACT
        + '">' + label + '</button>';
    };
    var acts = '';
    if (q.state === 'raised') {
      acts = act('investigating', 'I am looking at it', 'Say somebody has picked this up')
           + act('resolved', 'Mark it fixed', 'You believe it is fixed \u2014 the person who raised it is asked to retest');
    } else if (q.state === 'investigating') {
      acts = act('resolved', 'Mark it fixed', 'You believe it is fixed \u2014 the person who raised it is asked to retest');
    } else if (q.state === 'resolved') {
      acts = act('closed', '\u2713 Retested \u2014 close it', 'You have looked and it holds. This ends it.')
           + act('raised', '\u2717 Still broken', 'Send it back to whoever fixed it');
    }
    /**
     * ⭐ SEVERITY CAN BE RE-GRADED WHILE THE INCIDENT IS STILL OPEN, and only then. What looked like one
     * awkward screen turns out to be the till, and the first person to file it is the least informed person
     * who will ever look at it. ⚠️ On a closed row it would silently rewrite history for no purpose: the
     * severity somebody worked to is part of what happened.
     */
    if (q.state === 'raised' || q.state === 'investigating') {
      acts += '<select onchange="testIncSev(\'' + q.definition_id + '\', this.value)" '
        + 'title="Re-grade it" style="font:inherit;font-size:var(--fs-1);padding:2px 5px;border:1px solid '
        + 'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff);margin-inline-end:5px">'
        + TEST_INC_SEV.map(function (x) {
            return '<option' + (x === q.severity ? ' selected' : '') + '>' + x + '</option>';
          }).join('')
        + '</select>';
    }
    /* ⭐ THE TWO DURATIONS, SHOWN ONLY WHEN THEY SAY SOMETHING. "0 min unnoticed" is noise on a row somebody
       recorded while it was happening; an hour unnoticed is the whole story of that incident. */
    var clock = '';
    if (q.unnoticed_mins) clock += testEsc(q.unnoticed_mins + ' min before anybody knew');
    if (q.open_mins) clock += (clock ? ' \u00b7 ' : '') + testEsc(q.open_mins + ' min to resolve');
    var code = function (v) {
      return v ? '<code style="font-family:\'Space Mono\',ui-monospace,monospace;font-size:var(--fs-1);'
        + 'background:var(--neutral-tint);border-radius:5px;padding:0 5px;user-select:all">' + testEsc(v) + '</code>' : '';
    };
    return '<div style="border-bottom:1px solid var(--line,#e7e3d8);padding:7px 0">'
      + '<div style="display:flex;align-items:baseline;gap:7px;flex-wrap:wrap">'
      +   '<b style="color:' + (SEV[q.severity] || SEV['Sev-3']) + ';font-size:var(--fs-1)" title="'
      +     testEsc(q.severity_means || '') + '">' + testEsc(q.severity) + '</b>'
      +   '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(q.ref) + '</code>'
      +   '<span style="font-size:var(--fs-1);background:var(--neutral-tint,#f2efe6);border-radius:5px;'
      +     'padding:1px 6px">' + testEsc(q.state) + '</span>'
      +   code(q.screen_code) + code(q.popup_code)
      +   (q.affected ? '<span style="font-size:var(--fs-1);color:var(--note)">' + testEsc(q.affected)
            + '</span>' : '')
      + '</div>'
      + '<div style="font-size:var(--fs-2);margin-top:2px">' + testEsc(q.observed) + '</div>'
      /* ⭐ THE SEVERITY IN WORDS, not only its number: "Sev-2" means whatever the reader assumes. */
      + '<div style="font-size:var(--fs-1);color:var(--note);margin-top:2px">'
      +   testEsc(q.severity_means || '') + (clock ? ' \u00b7 ' + clock : '') + '</div>'
      /* ⭐ THE CHANGE THAT FIXED IT, as a citation into git — never a copy of the commit message. */
      + ((q.changes || []).length ? '<div style="font-size:var(--fs-1);margin-top:2px">fixed by '
          + q.changes.map(function (c) { return '<code>' + testEsc(String(c.sha).slice(0, 8)) + '</code>'
              + (c.repo ? ' in ' + testEsc(c.repo) : ''); }).join(' \u00b7 ') + '</div>' : '')
      + (q.why ? '<div style="font-size:var(--fs-1);color:var(--grey-2,#545A61);margin-top:2px">because: '
          + testEsc(q.why) + '</div>' : '')
      + '<div style="font-size:var(--fs-1);color:var(--note);margin-top:3px">'
      +   testEsc(q.raised_by || 'someone')
      +   (q.happened_at ? ' \u00b7 ' + testEsc(String(q.happened_at).replace('T', ' ').slice(0, 16)) : '')
      + '</div>'
      /* ⚠️ ON ITS OWN LINE. Buried at the end of a grey "who and when" line, an action reads as more
         metadata — and the thing that looked like a button was the filter at the top of the page. */
      + testActRow(acts)
      + '</div>';
  }).join('');
  return h;
}

/**
 * ── ⭐⭐⭐ THE LAB, MAPPED ONTO THE SCREENS ────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"can we map the test lab against each of the screens?"*
 *
 * ⭐ NOTHING NEW IS STORED FOR THIS. The board already knows which menu path each case came from, the register
 * already turns a menu path into a code, and the ledger already holds the latest word per case. The map is the
 * join of three things that were each already true — and a joined view can never drift from them, which a
 * fourth stored copy would.
 *
 * ⚠️⚠️ AND IT SAYS WHAT IT CANNOT SEE. Coverage screens are where people lie to themselves: 630 of 1448 cases
 * are not on any screen at all (guards, engines, the harness), and a table that quietly dropped them would
 * report a tidier product than exists. They are counted, named as off-screen, and kept out of the per-screen
 * arithmetic rather than out of sight.
 *
 * ⚠️ A SCREEN WITH NO CASES IS THE POINT OF THE WHOLE VIEW, so it is listed first, not omitted. A list of what
 * IS tested answers a question nobody urgently has.
 */
/* ⭐ remembered per browser: a person who works in menu order works in menu order every day */
function testScrSortGet() {
  try { return localStorage.getItem('cb_test_scrsort') || 'menu'; } catch (_) { return 'menu'; }
}
function testScrSort(v) {
  try { localStorage.setItem('cb_test_scrsort', v); } catch (_) {}
  testPaint();
}

async function testScrLoad() {
  CBTEST.scrBusy = true; testRepaint();
  try {
    /* the latest word per case — the ledger is append-only, so this endpoint already collapses it */
    var rows = await api('testResults', {});
    CBTEST.scrRes = Array.isArray(rows) ? rows : ((rows && rows.results) || []);
    /**
     * ⭐⭐ AND WHAT CAME OUT OF TESTING IT. Athi, 2026-09-12: *"if there are issues, incident raised or
     * requirement written."* Both already carry the screen code — that is what the code was for — so the
     * map can show, on one line, everything that has ever been said about a screen.
     * ⚠️ Every state, not the open ones: a screen with three incidents all resolved has a history worth
     * seeing, and a count that hides them reads as a screen nothing has ever gone wrong on.
     */
    try { var inc = await api('testIncList', { query: { state: 'all' } });
          CBTEST.scrInc = (inc && inc.incidents) || []; } catch (_) { CBTEST.scrInc = []; }
    try { var rq = await api('testReqList', { query: { state: 'all' } });
          CBTEST.scrReq = (rq && rq.requirements) || []; } catch (_) { CBTEST.scrReq = []; }
    CBTEST.scrErr = null;
  } catch (e) { CBTEST.scrErr = (e && e.message) || 'Could not read the results.'; }
  CBTEST.scrBusy = false; testRepaint();
}

/* ⭐ one place that decides which screen a case belongs to, so the count and the row can never disagree */
function testScrOf(c) {
  try {
    if (!c) return '';
    /* ⭐ the code the case carries wins: a menu path is words on a rail and words get reworded, whereas the
       code is assigned once and never changes. The path stays as the fallback for the swept cases, which
       predate the code being written onto them. */
    if (c.screen_code) return String(c.screen_code);
    if (!c.menu || !window.CBSCREENS) return '';
    return window.CBSCREENS.byPath[String(c.menu)] || '';
  } catch (_) { return ''; }
}

/**
 * ── ⭐⭐⭐ WRITING A CASE FOR A SCREEN, AND MARKING IT PASS OR FAIL ────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"wait, how to create test case for each screen and record it as pass or fail?"*
 *
 * ⚠️⚠️ HALF OF THAT ALREADY WORKED AND HALF OF IT WAS IMPOSSIBLE. Recording a verdict has been there all
 * along — open a case in the List and press Pass / Fail / Blocked / Skip. WRITING one could not be done
 * from the app at all: every case on the board came from the sweep, so the only way to add one was to edit
 * a generator and re-import. That is the wrong way round, because the person who knows what a screen must
 * do is the person standing on it.
 *
 * ⭐ NO NEW ROUTE. `/cases/import` already takes `{ cases: [...] }` and upserts, so this needed a door and
 * not a mechanism. [[feedback-search-before-you-build]]
 *
 * ⚠️ THE KEY IS MINTED FROM THE SCREEN CODE — `CAT001-H01`, `H` for hand-written — so a case written here
 * can never collide with a swept `M-RAIL-…` key, and re-pressing the sweep button cannot overwrite it.
 * ⚠️ And it is marked `generic:false`: this is the real test, and the By-screen view stops calling that
 * screen "generic only" the moment one exists.
 */
function testCaseFor(code, name) {
  CBTEST.writeFor = { code: code, name: name };
  if (CBTEST.popupFor) screenCasesPaint(); else testPaint();
  setTimeout(function () { try { document.getElementById("wcTitle").focus(); } catch (_) {} }, 120);
}

/**
 * ── ⭐⭐⭐ ALL FOUR PARTS AND THE OUTCOME, IN ONE PLACE ───────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"the entire four column input screen — pass, incident, requirement — details to be
 * gathered then and there."*
 *
 * ⚠️ IT WAS SPLIT ACROSS TWO STEPS AND THAT IS TWO VISITS. You wrote the case, then found it in the list,
 * then typed what you saw, then pressed an outcome. A person standing on a broken screen with the evidence
 * in front of them will not do four things; they will do one, or none.
 *
 *   1 requirement   what must be true      \u2500 the case, written once
 *   2 operation     what you do            \u2500 the case
 *   3 expected      what should happen     \u2500 the case
 *   4 observed      what you are seeing    \u2500 this run
 *
 * ⭐ One press does both: the case is written AND the outcome recorded. Pass records a pass. Incident records
 * the fail and raises the incident. Requirement raises the requirement and leaves the verdict alone, because
 * "it works and should also do X" is not a failure.
 *
 * ⚠️ SAVE IS STILL THERE, for writing a case you intend to run later. Forcing a verdict at the moment of
 * writing would make everybody press Pass to get out of the form.
 */
/**
 * ⭐ THE CONTROLS ON ONE SCREEN, from the register. A control is keyed by the screen it belongs to and the
 * words on it — "Rail › Task • Close it" — so the ones for a screen are the ones whose path names it.
 * ⚠️ Matched on the screen's own PATH, not its name: two groups can hold a screen with the same words on it,
 * and matching by name alone would offer a tester the other screen's buttons.
 */
function testCtlOptions(code) {
  try {
    var rows = (window.CBSCREENS && window.CBSCREENS.rows) || [];
    var me = rows.filter(function (r) { return r.code === code; })[0];
    if (!me) return '';
    var want = me.path + ' \u2022 ';                 /* 'Rail \u203a Task \u2022 ' */
    return rows.filter(function (r) {
      return r.group === 'Control' && String(r.path).indexOf('Control \u203a ' + want) === 0;
    }).map(function (r) {
      var label = String(r.screen).split(' \u2022 ').pop();
      return '<option value="' + testEsc(r.code) + '">' + testEsc(r.code) + ' \u00b7 '
        + testEsc(label) + '</option>';
    }).join('');
  } catch (_) { return ''; }
}

/**
 * ── ⭐⭐⭐ A PICTURE OF WHAT THEY ARE SEEING ──────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"simple one, usable in the longer run, and it has to follow the tester without much
 * trouble \u2014 if he wants a screenshot to be taken, can we provide an icon, so the screenshot is taken and
 * attached?"*
 *
 * ⭐⭐ TWO WAYS IN, BECAUSE ONE OF THEM ASKS PERMISSION AND ONE OF THEM CANNOT FAIL.
 *
 *   📷    getDisplayMedia \u2014 one click, the browser asks which window, a frame is grabbed and attached.
 *   Ctrl+V any screenshot already on the clipboard, from the tool the tester already uses.
 *
 * ⚠️ THE PASTE IS THE ONE THAT WILL ACTUALLY GET USED and it is why the icon is not the only path. Screen
 * capture prompts every time in most browsers, is refused outright in some, and does not exist on a phone.
 * Win+Shift+S then Ctrl+V is what a tester already does; the box just has to accept it.
 *
 * ⚠️ ONE SHOT AT A TIME, deliberately. A gallery per case is a feature nobody asked for and a thumbnail
 * strip to maintain; the picture that matters is the one of the thing that just went wrong.
 */
async function testShotSend(blob, name) {
  try {
    if (!blob) return;
    if (blob.size > 4 * 1024 * 1024) {
      if (typeof toast === 'function') toast('That is over 4 MB \u2014 crop it to the part that matters.');
      return;
    }
    var b64 = await new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result || '').split(',')[1] || ''); };
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    var r = await api('testShot', { body: {
      name: name || 'screenshot.png', mime: blob.type || 'image/png', data_base64: b64 } });
    CBTEST.shot = { id: r.id, name: r.name, size: r.size };
    testShotThumb(blob);
    screenCasesPaint();
    if (typeof toast === 'function') toast('Screenshot attached');
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not attach it.'); }
}

/* ⚠️ the browser decides what may be captured, and the person decides which window — neither is ours to
   assume. A refusal is normal (they changed their mind) and must not read as a failure. */
async function testShotGrab() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      if (typeof toast === 'function') toast('This browser cannot capture \u2014 take one and paste it here.');
      return;
    }
    var stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' } });
    var track = stream.getVideoTracks()[0];
    /**
     * ── ⭐⭐⭐ THE PANEL GETS OUT OF THE PICTURE ────────────────────────────────────────────────────────────
     *
     * Athi, 2026-09-13: *"the screenshot should work like the snipping tool — it has to minimise the current
     * testing window, take a screenshot of the screen and then back, otherwise you are capturing it with the
     * test window also."*
     *
     * ⚠️ HE IS RIGHT AND THE EVIDENCE WAS WORTHLESS WITHOUT IT. A screenshot of a broken screen with the tool
     * that reported it sitting across the middle proves nothing about the screen and quite a lot about the
     * tool. Worse, the panel covers the part of the screen the tester is usually complaining about.
     *
     * ⚠️ HIDDEN, NOT CLOSED. Closing would lose the four fields already filled in — the whole reason the
     * picture is being taken. `visibility` rather than `display` so nothing reflows: the screen behind must
     * be photographed exactly as the tester saw it, not re-laid-out for the camera.
     *
     * ⚠️ AND RESTORED IN A `finally`. A capture that throws halfway through must not leave the tester with an
     * invisible panel and no way to get it back.
     */
    var hide = document.getElementById('cbcaseshost');
    var blob = null;
    try {
      if (hide) hide.style.visibility = 'hidden';
      /* ⚠️ two frames of grace: the compositor has not necessarily redrawn by the time the promise resolves,
         and a capture taken too early gets the panel anyway — which looks exactly like the bug not being
         fixed. */
      await new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 120); }); });
      if (typeof ImageCapture === 'function') {
        var bmp = await new ImageCapture(track).grabFrame();
        var cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        cv.getContext('2d').drawImage(bmp, 0, 0);
        blob = await new Promise(function (r) { cv.toBlob(r, 'image/png'); });
      }
    } finally {
      if (hide) hide.style.visibility = '';
      try { track.stop(); stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
    }
    if (!blob) {
      if (typeof toast === 'function') toast('Could not grab a frame \u2014 paste one instead.');
      return;
    }
    await testShotSend(blob, 'screen.png');
  } catch (e) { /* refused, or nothing chosen — say nothing */ }
}

/**
 * ── ⚠️⚠️ A PLAIN <a href> COULD NEVER HAVE WORKED, AND I WROTE ONE ANYWAY ────────────────────────────────────
 *
 * Athi, 2026-09-13: *"I am trying to attach a screen and open in view mode, it is not opening — either
 * getting 404 or some other window is opening, but not the screenshot."*
 *
 * TWO FAULTS IN ONE LINE, both mine:
 *
 *   1. it read `CFG.API`, which does not exist. The base is `CFG.API_BASE`, so the href collapsed to a
 *      path on the WEB origin — hence the 404, and hence "some other window": the SPA answered it.
 *   2. even with the right host it would have failed, because `/api/attachments/:id` is authenticated and
 *      A LINK CARRIES NO Authorization HEADER. It would have 401'd, not shown a picture.
 *
 * ⭐ THE CODEBASE HAD ALREADY SOLVED THIS AND SAID SO. `exportCatalogueCSV()` carries the note: *"Not a plain
 * <a href> — the endpoint is authenticated, and a link carries no Authorization header."* Same fetch, same
 * blob, same temporary link. [[feedback-search-before-you-build]] — the answer was written down before the
 * mistake was made.
 *
 * ⚠️ NOT ROUTED THROUGH api(): that helper JSON-parses every response, which would turn a PNG into a parse
 * error — the same reason the CSV export does its own fetch.
 */
async function testShotView(id) {
  if (!id) return;
  try {
    var res = await fetch(CFG.API_BASE + '/api/attachments/' + encodeURIComponent(id), {
      cache: 'no-store',
      headers: (typeof SESSION !== 'undefined' && SESSION.token)
        ? { Authorization: 'Bearer ' + SESSION.token } : {},
    });
    if (!res.ok) {
      var msg = ''; try { var j = await res.json(); msg = j.message || j.error || ''; } catch (_) {}
      throw new Error(msg || ('Could not fetch it (' + res.status + ')'));
    }
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank');
    /* ⚠️ revoked LATER, not now: revoking before the new tab has read it gives a blank window, which is
       exactly the "some other window" symptom in a different disguise. */
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, 60000);
    if (!w && typeof toast === 'function') toast('Allow pop-ups to view it, or it is on the incident.');
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not open it.'); }
}

/**
 * ⭐ AND A THUMBNAIL, so nobody has to open anything to know the right picture is attached. It is the blob
 * that was just uploaded — no second fetch, and it proves the bytes made the round trip.
 */
function testShotThumb(blob) {
  try {
    if (CBTEST._thumb) { try { URL.revokeObjectURL(CBTEST._thumb); } catch (_) {} }
    CBTEST._thumb = blob ? URL.createObjectURL(blob) : null;
  } catch (_) { CBTEST._thumb = null; }
}

function testShotDrop() { CBTEST.shot = null; testShotThumb(null); screenCasesPaint(); }

/* the paste, bound once to the panel — the tester\u2019s own screenshot tool, and no permission at all */
function testShotPasteBind() {
  try {
    var host = document.getElementById('cbcasespanel');
    if (!host || host._pasteBound) return;
    host._pasteBound = 1;
    host.addEventListener('paste', function (e) {
      try {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (String(items[i].type || '').indexOf('image/') === 0) {
            var f = items[i].getAsFile();
            if (f) { e.preventDefault(); testShotSend(f, f.name || 'pasted.png'); return; }
          }
        }
      } catch (_) {}
    });
  } catch (e) {}
}

/**
 * ── ⭐⭐⭐ WHAT ELSE SHOULD I TRY? ────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"build the 29119-4 test techniques into the write form."*
 *
 * ⚠️⚠️ EVERYTHING BUILT THIS WEEK IMPROVED HOW A FINDING IS RECORDED. Not one line of it helped a person
 * decide WHAT TO TRY — and a tester who thinks of three cases writes three, however good the form is. This
 * is the other half, and it is the oldest solved problem in testing: ISO/IEC/IEEE 29119-4:2021 lists the
 * techniques for deriving cases from a specification, and most of them are mechanical enough to do FOR you.
 *
 * ⭐ IT ASKS FOR THE ONE THING IT CANNOT KNOW and derives the rest. Give it the bounds of a field and it
 * gives back the six values that matter; give it the states and it gives back every transition, including
 * the ones that must be refused. Nothing here is a guess: each technique is a rule from the standard applied
 * to numbers the tester supplied.
 *
 * ⚠️ AND IT WRITES NOTHING BY ITSELF. It fills the two boxes for ONE case at a time and the tester still
 * presses Save. A button that silently minted eleven cases would fill the board with rows nobody had read,
 * which is the opposite of what a prompt is for.
 *
 * ⚠️ THE OFF-BY-ONE IS THE POINT. Boundary analysis is worth having precisely because "min-1, min, min+1"
 * is what people skip when they are sure. So the derived list SAYS which side of the line each value is on,
 * rather than leaving the tester to work it out again.
 */
var TECHS = ['bounds', 'classes', 'states', 'decision', 'guess'];

/** ⚠️ the fold is remembered for the session only: it is a preference about this minute, not about the person */
/** ⭐ a chip fills the box rather than replacing it: the name is a suggestion, and it stays editable */
/**
 * ⭐ THE FIELD REMEMBERS ITS KIND, so the boxes below can suit it. Athi: *"if you are selecting a date
 * field, a date picker has to come."* Right — and typing 2026-09-13 by hand into a box labelled "e.g. 1"
 * is the kind of small friction that stops a technique being used at all.
 */
function testTechKind() {
  var f = null;
  try { f = String((document.getElementById('tqField') || {}).value || '').trim(); } catch (_) {}
  if (!f) f = ((CBTEST.tech || {}).field) || '';
  if (!f) return '';
  var hit = testTechFields().filter(function (x) { return x.key === f; })[0];
  return hit ? hit.kind : '';
}

function testTechPick(k) {
  try { var el = document.getElementById('tqField'); if (el) { el.value = k; el.focus(); } } catch (_) {}
  /* ⚠️ remembered, and the panel repainted, or the boxes below cannot change to suit the kind */
  CBTEST.tech = CBTEST.tech || {};
  CBTEST.tech.field = k;
  if (CBTEST.popupFor) screenCasesPaint(); else testPaint();
}
function testTechFold() {
  CBTEST.techOpen = !CBTEST.techOpen;
  if (CBTEST.popupFor) screenCasesPaint(); else testPaint();
}
function testTech(kind) {
  CBTEST.tech = CBTEST.tech || {};
  CBTEST.tech.kind = (CBTEST.tech.kind === kind) ? null : kind;
  screenCasesPaint();
}
/**
 * ── ⚠️⚠️⚠️ THE TABLE WAS DERIVED LIVE, SO IT COULD DISAGREE WITH THE BOXES ABOVE IT ────────────────────────
 *
 * Athi sent a screenshot: the field box read `valid_from`, and the eight cases underneath it all said
 * `version_no` with bounds nobody could see. Both were "right" — the rows were derived from what the boxes
 * held at the previous paint, and the boxes had moved on. A table that quietly describes a different input
 * from the one on screen is worse than an empty one.
 *
 * ⚠️⚠️ AND `testTechUse(i)` RE-DERIVED BEFORE INSERTING. So pressing Add on row 3 after touching a box put a
 * DIFFERENT case into the form from the one that was clicked — silently, and only sometimes.
 *
 * ⭐ SO THE RESULT IS TAKEN ONCE, WITH THE INPUTS IT WAS TAKEN FROM, and everything reads that. Change a box
 * and the old table is still there, still true, and still says out loud which field and range it is about.
 */
function testTechGo() {
  var t = CBTEST.tech || (CBTEST.tech = {});
  t.rows = testTechDerive();
  t.from = {
    field: testTechVal('tqField', 'the field'),
    lo: testTechVal('tqLo', ''), hi: testTechVal('tqHi', ''),
    classes: testTechVal('tqClasses', ''), states: testTechVal('tqStates', ''),
    conds: testTechVal('tqConds', ''),
  };
  screenCasesPaint();
}

/** ⚠️ the row that was CLICKED, never a fresh derivation — see the note on testTechGo */
function testTechRows() { return ((CBTEST.tech || {}).rows) || []; }

/** the value of one of the helper inputs, or a default */
function testTechVal(id, dflt) {
  var el = document.getElementById(id);
  var v = el ? String(el.value || '').trim() : '';
  return v === '' ? (dflt === undefined ? '' : dflt) : v;
}

/**
 * ⭐ THE DERIVATION. Each branch is one technique from 29119-4, applied to what the tester typed.
 * ⚠️ Returns {do, see} pairs — the same two boxes the form already has, so nothing new has to be learned.
 */
function testTechDerive() {
  var t = (CBTEST.tech || {});
  var field = testTechVal('tqField', 'the field');
  var out = [];

  if (t.kind === 'bounds') {
    var loRaw = testTechVal('tqLo', ''), hiRaw = testTechVal('tqHi', '');
    /**
     * ⭐ A DATE HAS BOUNDARIES TOO, AND THEY ARE DAYS, NOT INTEGERS. `Number('2026-09-13')` is NaN, so a date
     * range derived nothing at all and the tab looked broken for exactly the field Athi picked to try it.
     * ⚠️ Arithmetic in UTC on the date part only: adding a day to a local Date crosses a DST boundary twice a
     * year and produces the same date back, which would put two identical rows in a table of eight.
     */
    var isDay = /^\d{4}-\d{2}-\d{2}$/.test(loRaw) && /^\d{4}-\d{2}-\d{2}$/.test(hiRaw);
    if (isDay) {
      var day = function (d, n) {
        var ms = Date.parse(d + 'T00:00:00Z') + (n * 86400000);
        return new Date(ms).toISOString().slice(0, 10);
      };
      out = [
        [day(loRaw, -1), 'refused — it is before the earliest allowed'],
        [loRaw, 'accepted — it is the earliest allowed'],
        [day(loRaw, 1), 'accepted — just inside'],
        [day(hiRaw, -1), 'accepted — just inside'],
        [hiRaw, 'accepted — it is the latest allowed'],
        [day(hiRaw, 1), 'refused — it is after the latest allowed'],
      ].map(function (p) {
        return { do: 'Put ' + p[0] + ' in ' + field + ' and save.', see: 'It is ' + p[1] + '.' };
      });
      out.push({ do: 'Leave ' + field + ' empty and save.',
                 see: 'Either refused with a reason, or a stated default — never today by accident.' });
      out.push({ do: 'Put 2026-02-30 in ' + field + ' and save.',
                 see: 'Refused — it is not a date, and February has never had thirty days.' });
      return out;
    }
    var lo = Number(loRaw);
    var hi = Number(hiRaw);
    if (isNaN(lo) || isNaN(hi) || loRaw === '' || hiRaw === '') return [];
    /* 29119-4 boundary value analysis: the value each side of every boundary, and the boundary itself */
    out = [
      [lo - 1, 'refused \u2014 it is below the lowest allowed'],
      [lo, 'accepted \u2014 it is the lowest allowed'],
      [lo + 1, 'accepted \u2014 just inside'],
      [hi - 1, 'accepted \u2014 just inside'],
      [hi, 'accepted \u2014 it is the highest allowed'],
      [hi + 1, 'refused \u2014 it is above the highest allowed'],
    ].map(function (p) {
      return { do: 'Put ' + p[0] + ' in ' + field + ' and save.', see: 'It is ' + p[1] + '.' };
    });
    /* ⚠ the two everybody forgets, and they are not boundaries — they are the absence of a value */
    out.push({ do: 'Leave ' + field + ' empty and save.',
               see: 'Either refused with a reason, or a stated default \u2014 never a silent zero.' });
    out.push({ do: 'Put text in ' + field + ' and save.',
               see: 'Refused before it reaches the server.' });
  }

  if (t.kind === 'classes') {
    var cs = testTechVal('tqClasses', '').split(',').map(function (x) { return x.trim(); })
      .filter(Boolean);
    /* equivalence partitioning: ONE value from each class, because the class behaves as one */
    out = cs.map(function (c) {
      return { do: 'Use ' + (/^[aeiou]/i.test(c) ? 'an ' : 'a ') + c + ' in ' + field + '.',
               see: 'It behaves as every other ' + c + ' does \u2014 one from the class stands for all of it.' };
    });
  }

  if (t.kind === 'states') {
    var st = testTechVal('tqStates', '').split(',').map(function (x) { return x.trim(); })
      .filter(Boolean);
    /**
     * ⭐⭐ STATE TRANSITION, AND THE INVALID ONES ARE THE POINT. Walking the happy path proves the allowed
     * moves work; it says nothing about whether the forbidden ones are refused, and a lifecycle that can be
     * jumped is how a chit gets paid before it is sent.
     */
    st.forEach(function (a, i) {
      var b = st[i + 1];
      if (b) out.push({ do: 'Move it from ' + a + ' to ' + b + '.', see: 'Allowed.' });
    });
    st.forEach(function (a, i) {
      st.forEach(function (b, j) {
        if (j <= i + 1 || j === i) return;      /* forward by more than one step = a skipped state */
        out.push({ do: 'Try to move it straight from ' + a + ' to ' + b + ', skipping '
          + st.slice(i + 1, j).join(' and ') + '.', see: 'Refused \u2014 the step cannot be skipped.' });
      });
    });
    if (st.length > 1) {
      out.push({ do: 'Try to move it BACK from ' + st[st.length - 1] + ' to ' + st[0] + '.',
        see: 'Refused, or recorded as a reversal with a reason \u2014 never a silent rewind.' });
    }
  }

  if (t.kind === 'decision') {
    var cond = testTechVal('tqConds', '').split(',').map(function (x) { return x.trim(); })
      .filter(Boolean).slice(0, 3);
    /* a decision table: every combination, because a rule that reads two conditions has four answers */
    var n = Math.pow(2, cond.length);
    for (var i = 0; i < n; i++) {
      var says = cond.map(function (c, k) {
        return ((i >> k) & 1) ? c : 'NOT ' + c;
      }).join(' and ');
      out.push({ do: 'Set it up so that ' + says + '.', see: 'The rule gives its answer for this combination.' });
    }
  }

  if (t.kind === 'guess') {
    /**
     * ⚠️ 29119-4 CALLS THIS "ERROR GUESSING" AND IT IS EXPERIENCE-BASED, not derived — which means this list
     * is OURS, not the standard’s, and it says so. Every entry is something that has actually broken in this
     * product at least once.
     */
    out = [
      ['Paste 2,000 characters into ' + field + '.', 'Refused or truncated with a word about it, never a 500.'],
      ['Type a name with an emoji and an accent.', 'Stored and shown back exactly as typed.'],
      ['Press the save button twice, fast.', 'ONE record. Not two.'],
      ['Turn the network off, then save.', 'Queued or refused clearly \u2014 never a success message.'],
      ['Save, then press the browser Back button, then save again.', 'No duplicate, no lost edit.'],
      ['Open the same record in two tabs and save both.', 'The second is refused or merged, never silently '
        + 'overwriting the first.'],
    ].map(function (p) { return { do: p[0], see: p[1] }; });
  }
  return out;
}

/** put one derived case into the two boxes — the tester still reads it and still presses Save */
/**
 * ── ⚠️⚠️⚠️ IT WROTE INTO BOXES THAT WERE NOT ON THE SCREEN ────────────────────────────────────────────────────
 *
 * `wcDo` and `wcSee` belong to the CREATE tab. Pressing Add from the Techniques tab called
 * `document.getElementById('wcDo')`, got null, and did nothing at all — no error, no toast, no movement. Since
 * Techniques became its own tab (an hour ago, at Athi's request) this button has been inert, and the only sign
 * of it was that nothing happened. [[feedback-silence-is-the-bug]]
 *
 * ⭐ SO IT TAKES YOU THERE. Switch to Create, open the form if it is not open, THEN fill it — the same order
 * `testDiagRaise` uses to carry a speed reading into the form, which is the pattern that already worked.
 * ⚠️ Fill AFTER the repaint, or screenCasesPaint restores the empty values over the top of these.
 */
function testTechUse(i) {
  var d = testTechRows()[i];
  if (!d) return;
  var code = CBTEST.popupFor || '';
  if (!CBTEST.writeFor && code) CBTEST.writeFor = { code: code, name: codeName(code) || '' };
  CBTEST.caseArea = 'write';
  try { localStorage.setItem('cb_case_area', 'write'); } catch (_) {}
  if (CBTEST.popupFor) screenCasesPaint(); else testPaint();

  var put = function (id, v) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = v;
    try { if (el.tagName === 'TEXTAREA') testGrow(el); } catch (_) {}
  };
  put('wcDo', d.do);
  put('wcSee', d.see);
  var t = document.getElementById('wcTitle');
  if (t && !String(t.value || '').trim()) {
    t.value = d.see.replace(/^It is /, '').replace(/\.$/, '');
    try { testGrow(t); } catch (_) {}
  }
  try { document.getElementById('wcTitle').focus(); } catch (_) {}
  if (typeof toast === 'function') toast('Added to Create — choose the type and save.');
}

/**
 * ── ⭐⭐⭐ THE TECHNIQUES, AS THEIR OWN TAB ───────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"somewhere I have seen the other test types, now I couldn’t see those — if we want, create
 * another tab for those, like Speed, so we know what we are looking for, the boundary condition etc. Which is
 * gone now, couldn’t see where it is."*
 *
 * ⚠️⚠️ AND HE IS RIGHT THAT I HID IT. An hour earlier he said *"I am not sure what those chips are doing while
 * creating a case"*, and I folded them shut at the foot of the Create form — which fixed the confusion by
 * making the feature disappear. Both complaints are true at once, and a fold was the wrong answer to the first
 * one: the problem was never that it took up room, it was that it was in the WRONG PLACE. Thinking of more
 * cases is not part of writing one down; it is its own job, so it gets its own door, beside Speed.
 *
 * ⭐ ISO/IEC/IEEE 29119-4 is the standard the five techniques come from, and the tab says so — "here are eight
 * cases" is a suggestion; "boundary value analysis says you need eight" is a reason a tester can repeat to
 * somebody who asks why they wrote them. [[feedback-adopt-dont-reinvent]]
 */
/**
 * ── ⭐⭐⭐ THE FIELDS ARE NOT ASKED FOR — THEY ARE READ OFF THE WIRE ────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"what field, where does it come from? From the current API? Can we figure this out and
 * show these are the fields that have to be checked for this reason — or can we diagnose ourselves and provide
 * possible issues?"*
 *
 * ⚠️⚠️ AND A BLANK BOX LABELLED "which field?" IS THE WHOLE PROBLEM. It asks the tester to already know the
 * product's field names, which is the one thing a person testing a screen for the first time does not have.
 * So the technique helper was only usable by somebody who did not need it.
 *
 * ⭐ THE CALL LOG ALREADY HOLDS THE ANSWER. Every request this screen made is in `CBCALLS` with its BODY
 * (`sent`, redacted at capture) and its response (`body`). Those bodies are literally the fields this screen
 * puts on the wire — not a guess, not a schema somebody maintains by hand, but what it actually sent a moment
 * ago. Read them, and the question "which field?" answers itself with a row of chips.
 *
 * ⚠️ AND THE KIND IS INFERRED FROM THE VALUE, NOT FROM THE NAME. `quantity: "3"` is a number whatever it is
 * called, and `status: "available"` is one of a short list. Guessing from names would call `order_no` numeric
 * and `date_added` a date and be wrong about both on this product.
 *
 * ⚠️ WHAT IT WILL NOT DO IS INVENT THE BOUNDS. It can see that `price` is a number; it cannot know the shop
 * allows 1 to 99,999. That is the one thing only a person knows, and asking for exactly that — and nothing
 * else — is the whole design of this helper.
 */
function testTechFields() {
  var here = null;
  try { if (typeof navScreenKey === 'function') here = navScreenKey(); } catch (_) {}
  var gen = window.CBGEN || 0;
  var seen = {}, out = [];

  var kindOf = function (v) {
    if (typeof v === 'boolean') return 'yes/no';
    if (typeof v === 'number') return 'number';
    if (typeof v !== 'string') return null;
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return 'date';
    if (/^-?\d+(\.\d+)?$/.test(v)) return 'number';
    if (v.length <= 24 && !/\s{2}/.test(v)) return 'short text';
    return 'text';
  };
  var take = function (obj, from, depth) {
    if (!obj || typeof obj !== 'object' || depth > 2) return;
    (Array.isArray(obj) ? obj.slice(0, 2) : [obj]).forEach(function (o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (v && typeof v === 'object') { take(v, from, depth + 1); return; }
        var kind = kindOf(v);
        if (!kind) return;
        /* ⚠ ids and stamps are not fields a tester exercises — they are plumbing, and offering them as
           candidates buries the four that matter under thirty that do not */
        if (/^(id|_id|.*_id|entity_id|created_at|updated_at|rid|version)$/i.test(k)) return;
        if (String(v) === '[redacted]') return;
        if (seen[k]) return;
        seen[k] = 1;
        out.push({ key: k, kind: kind, sample: String(v).slice(0, 24), from: from });
      });
    });
  };

  (window.CBCALLS || []).forEach(function (c) {
    if (here && c.scr && c.scr !== here) return;
    if (gen && c.gen && c.gen !== gen) return;
    if (/^\/api\/testing/i.test(String(c.path || ''))) return;
    /* the REQUEST first: what a person typed is what a person can vary */
    try { if (c.sent) take(JSON.parse(c.sent), 'sent', 0); } catch (_) {}
    try { if (c.body) take(JSON.parse(c.body), 'came back', 0); } catch (_) {}
  });
  return out.slice(0, 24);
}

/** ⭐ which technique a field is a candidate for, said in words rather than left to be worked out */
function testTechFor(kind) {
  if (kind === 'number' || kind === 'date') return 'bounds';
  if (kind === 'short text') return 'classes';
  if (kind === 'yes/no') return 'decision';
  return 'guess';
}

/**
 * ⭐ A WORKED EXAMPLE PER TECHNIQUE, using this product's own words. Athi: *"give some example as a 'try this',
 * so people understand what we are saying here."* ⚠️ Real examples, not lorem: "over 500, customer is a member"
 * is a rule this shop actually has, and a tester recognises it and then sees what to do with their own.
 */
var TEST_TECH_EG = {
  bounds: { what: 'A number that has a lowest and a highest allowed value.',
    eg: 'Field <b>quantity</b>, lowest <b>1</b>, highest <b>999</b> — it writes the eight cases that matter: '
      + '0, 1, 2, 998, 999, 1000, empty, and text.',
    why: 'Boundary value analysis. Faults cluster at the edges, because that is where the comparison is '
      + 'written and where < gets typed for ≤.' },
  classes: { what: 'Kinds of value that the product is supposed to treat differently.',
    eg: 'Field <b>customer</b>, kinds <b>GST-registered, unregistered, overseas</b> — one case each, because '
      + 'every value inside a kind behaves the same and testing five of them proves the same thing five times.',
    why: 'Equivalence partitioning. It tells you how FEW cases you need, which is the harder question.' },
  states: { what: 'Something that moves through named stages.',
    eg: 'Field <b>chit</b>, states <b>draft, sent, accepted, delivered, paid</b> — it writes the legal moves '
      + 'and, more usefully, the ones that must be refused: paid going back to draft.',
    why: 'State transition testing. The bugs are almost never in the forward path.' },
  decision: { what: 'A rule with two or three conditions in it.',
    eg: 'Conditions <b>over 500, customer is a member</b> — it writes all four combinations, so the case '
      + 'where BOTH are true and the discount applies twice is not the one nobody tried.',
    why: 'Decision table testing. People test the conditions one at a time and ship the combination.' },
  guess: { what: 'The values that break most products, whatever the field is.',
    eg: 'Field <b>name</b> — empty, one space, a very long value, a leading zero, an apostrophe, an emoji, '
      + 'and the same value twice.',
    why: 'Error guessing. 29119-4 keeps it because it keeps finding things, and it is the only one that '
      + 'depends on having been burnt before.' },
};

function testTechAreaHTML() {
  /**
   * ⚠️ THIS WAS FIVE LINES OF PROSE. Athi: *"it is just a series of text, not much of meaning, difficult to
   * understand."* A paragraph explaining a tool is a paragraph nobody finishes; the same content as three
   * short lines, in the panel's own section treatment, is read.
   */
  return testSec('What else should I test here?')
    + testNotes([
        'You tell it the one thing it cannot know — a range, a set of kinds, a lifecycle.',
        'It writes the cases the techniques in <b>ISO/IEC/IEEE 29119-4</b> say you need. Nothing is invented: '
          + 'every line comes from what you typed.',
        'Press <b>Add</b> on any row and it lands in Create, ready to save.',
      ], 'note')
    + testTechHTML();
}
function testTechHTML() {
  var t = (CBTEST.tech || {});
  var tab = 'font:inherit;font-size:var(--fs-1);padding:2px 8px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;margin-inline-end:4px;margin-top:4px;';
  var on = 'background:var(--ink,#0F2E3D);color:var(--card,#fff);border-color:var(--ink,#0F2E3D)';
  var off = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  var inp = 'font:inherit;font-size:var(--fs-1);padding:2px 6px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:6px;background:var(--card,#fff)';

  /**
   * ⚠️ FOLDED SHUT UNTIL IT IS ASKED FOR. Athi, 2026-09-13: *"I am not sure what those chips are doing while
   * creating a case."* They were five unexplained buttons sitting directly under the four boxes he was filling
   * in, so they read as part of the form. They are not: they are a way of thinking of MORE cases than the one
   * in front of you — a different act. ⭐ And a control that has to be opened earns a line saying what it is.
   */
  /**
   * \u26a0\ufe0f\u26a0\ufe0f THE FOLD THAT USED TO BE HERE BROKE THE CHIPS, AND SILENTLY. It ended with
   * `if (!open) return h + '</div>';` and the next line began `+ [[...]].map(...)` \u2014 which is not a syntax
   * error, it is a valid expression statement (unary plus on an array), so `node --check` passed, no console
   * spoke, and the five buttons were simply never in the output. A fold and an early return dropped into the
   * middle of one long concatenation is exactly how that happens. [[feedback-anchor-replace-drops-code]]
   * \u2b50 Gone entirely now: this lives on its own tab, so there is nothing left to fold it away from.
   */
  var h = '<div style="margin-top:8px;padding-top:7px;border-top:1px dashed var(--line,#e7e3d8)">'
    + [['bounds', 'A number range'], ['classes', 'Kinds of value'], ['states', 'A lifecycle'],
       ['decision', 'A rule with conditions'], ['guess', 'The usual suspects']]
      .map(function (x) {
        return '<button onclick="testTech(\'' + x[0] + '\')" style="' + tab
          + (t.kind === x[0] ? on : off) + '">' + x[1] + '</button>';
      }).join('');
  if (!t.kind) {
    /* ⭐ before a technique is chosen, say what each one is FOR — five bare chips taught nobody anything */
    return h
      + '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:7px;line-height:1.6">'
      + Object.keys(TEST_TECH_EG).map(function (k) {
          var L = { bounds: 'A number range', classes: 'Kinds of value', states: 'A lifecycle',
                    decision: 'A rule with conditions', guess: 'The usual suspects' }[k];
          return '<div style="margin:2px 0"><b>' + L + '</b> — ' + TEST_TECH_EG[k].what + '</div>';
        }).join('')
      + '</div></div>';
  }

  var EG = TEST_TECH_EG[t.kind] || {};
  var big = 'width:100%;font:inherit;font-size:var(--fs-2);padding:7px 9px;border:1px solid '
    + 'var(--line,#e7e3d8);border-radius:8px;background:var(--card,#fff);color:var(--ink,#20303b);'
    + 'box-sizing:border-box';
  var lbl = 'display:block;font-size:var(--fs-1);font-weight:700;color:var(--grey-2,#545A61);margin:9px 0 3px';

  /**
   * ⭐ TRY THIS, IN THIS PRODUCT'S OWN WORDS. Athi: *"give some example as a 'try this', so people understand
   * what we are saying here."* A form that only says what it wants is a form you have to already understand.
   */
  h += '<div style="margin-top:8px;padding:8px 10px;border-inline-start:3px solid var(--ok-2,#1B7F4B);'
    + 'background:var(--ok-tint,#eaf4ee);border-radius:0 8px 8px 0;font-size:var(--fs-1);line-height:1.6">'
    + '<b>Try this:</b> ' + EG.eg + '<br>'
    + '<span style="color:var(--grey-2)">' + EG.why + '</span></div>';

  /**
   * ⭐⭐ THE FIELDS THIS SCREEN ACTUALLY SENT, as chips. Read from the call log, so they are this product's
   * real field names with a real sample value beside each — see testTechFields.
   * ⚠️ Only the ones whose KIND suits this technique are offered first; the rest are still there, because an
   * inference from one sample value is a suggestion and must not become a gate.
   */
  var fields = testTechFields();
  if (fields.length) {
    var fit = fields.filter(function (f) { return testTechFor(f.kind) === t.kind; });
    var rest = fields.filter(function (f) { return testTechFor(f.kind) !== t.kind; });
    var fchip = function (f, strong) {
      return '<button onclick="testTechPick(\'' + testEsc(f.key) + '\')" '
        + 'title="' + testEsc(f.kind + ' · e.g. ' + f.sample + ' · ' + f.from) + '" '
        + 'style="font:inherit;font-size:var(--fs-1);padding:3px 9px;border-radius:11px;cursor:pointer;'
        + 'margin-inline-end:4px;margin-bottom:4px;border:0;background:'
        + (strong ? 'var(--ok-tint,#eaf4ee);color:var(--ok-2,#1B7F4B);font-weight:700'
                  : 'var(--neutral-tint,#f2efe6);color:var(--grey-2,#545A61)') + '">'
        + testEsc(f.key) + ' <span style="opacity:.7">' + testEsc(f.kind) + '</span></button>';
    };
    h += '<label style="' + lbl + '">Which field? · <span style="font-weight:400;color:var(--note)">'
      + 'read from what this screen just sent to the server</span></label>'
      + '<div>' + fit.map(function (f) { return fchip(f, true); }).join('')
      + rest.map(function (f) { return fchip(f, false); }).join('') + '</div>';
  } else {
    h += '<label style="' + lbl + '">Which field?</label>';
  }
  h += '<input id="tqField" placeholder="the field you are testing" style="' + big + '">';

  if (t.kind === 'bounds') {
    var _isDate = testTechKind() === 'date';
    /* ⚠️ THE ONE THING IT CANNOT KNOW. It can see that a field is a number; only a person knows the shop
       allows 1 to 999. Asking for exactly that, and nothing else, is the whole design of this helper. */
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<div style="flex:1 1 9em"><label style="' + lbl + '">' + (_isDate ? 'Earliest allowed' : 'Lowest allowed') + '</label>'
      + '<input id="tqLo" type="' + (_isDate ? 'date' : 'text') + '" '
      +   'placeholder="' + (_isDate ? '' : 'e.g. 1') + '" style="' + big + '"></div>'
      + '<div style="flex:1 1 9em"><label style="' + lbl + '">' + (_isDate ? 'Latest allowed' : 'Highest allowed') + '</label>'
      + '<input id="tqHi" type="' + (_isDate ? 'date' : 'text') + '" '
      +   'placeholder="' + (_isDate ? '' : 'e.g. 999') + '" style="' + big + '"></div>'
      + '</div>';
  }
  if (t.kind === 'classes') {
    h += '<label style="' + lbl + '">The kinds, comma separated</label>'
      + '<input id="tqClasses" placeholder="e.g. GST-registered, unregistered, overseas" style="' + big + '">';
  }
  if (t.kind === 'states') {
    h += '<label style="' + lbl + '">The states, in order</label>'
      + '<input id="tqStates" placeholder="e.g. draft, sent, accepted, delivered, paid" style="' + big + '">';
  }
  if (t.kind === 'decision') {
    h += '<label style="' + lbl + '">Up to three conditions, comma separated</label>'
      + '<input id="tqConds" placeholder="e.g. over 500, customer is a member" style="' + big + '">';
  }
  h += '<div style="margin-top:9px"><button onclick="testTechGo()" '
    + 'style="font:inherit;font-size:var(--fs-2);font-weight:700;padding:6px 16px;border-radius:8px;'
    + 'cursor:pointer;border:1px solid var(--ink,#0F2E3D);background:var(--ink,#0F2E3D);'
    + 'color:var(--card,#fff)">Write the cases</button></div>';


  var rows = testTechRows();
  if (!rows.length) {
    h += '<div style="font-size:var(--fs-1);color:var(--note);margin-top:7px">'
      + 'Fill the boxes above and press <b>Write the cases</b>. Nothing is invented \u2014 every line comes '
      + 'from what you type.'
      + '</div>';
    return h + '</div>';
  }
  /**
   * ⭐ THE TECHNIQUE NAMES ITSELF AND ITS STANDARD. "Here are eight cases" is a suggestion; "boundary value
   * analysis, ISO/IEC/IEEE 29119-4, says you need eight" is a reason — and it is the sentence a tester can
   * repeat to somebody who asks why they wrote them.
   */
  var NAMED = {
    bounds: 'Boundary value analysis',
    classes: 'Equivalence partitioning',
    states: 'State transition testing',
    decision: 'Decision table testing',
    guess: 'Error guessing'
  };
  var src = (t.kind === 'guess')
    ? 'ISO/IEC/IEEE 29119-4 names this technique but cannot supply the list \u2014 it is experience-based, so '
      + 'these are ours, and every one has broken here at least once.'
    : 'ISO/IEC/IEEE 29119-4:2021 \u00b7 specification-based test design.';
  /**
   * ⭐ IT SAYS WHAT IT WAS DERIVED FROM. One line, and the table can never again be read as being about the
   * field currently in the box. [[feedback-silence-is-the-bug]]
   */
  var F = (t.from || {});
  var range = (F.lo !== undefined && F.lo !== '' && F.hi !== '')
    ? (', ' + testEsc(F.lo) + ' to ' + testEsc(F.hi))
    : (F.classes || F.states || F.conds ? (', ' + testEsc(F.classes || F.states || F.conds)) : '');
  h += testSec((NAMED[t.kind] || 'This technique') + ' \u00b7 ' + rows.length + ' case(s)',
    'for <b>' + testEsc(F.field || 'the field') + '</b>' + range + ' \u00b7 ' + src);

  /**
   * ⭐⭐ A TABLE, BECAUSE IT IS TABULAR. Athi: *"the test below can be in a tabular format — not sure what is
   * the purpose of Use."* Two facts per row and an action on each is a table, and running them together as
   * sentences made eight of them read as one paragraph.
   * ⭐ AND THE COLUMN IS LABELLED. "Use" said nothing; the header now says where the row goes, so the button
   * does not have to be pressed to find out what it does.
   */
  var th = 'text-align:start;font-size:var(--fs-1);font-weight:800;letter-spacing:.04em;'
    + 'text-transform:uppercase;color:var(--grey-2,#545A61);padding:4px 8px 4px 0;'
    + 'border-bottom:1px solid var(--line,#e7e3d8)';
  var td = 'font-size:var(--fs-2);padding:6px 8px 6px 0;vertical-align:top;'
    + 'border-bottom:1px solid var(--line,#e7e3d8)';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin-top:4px">'
    + '<tr><th style="' + th + ';width:2em">#</th>'
    +   '<th style="' + th + '">Do this</th>'
    +   '<th style="' + th + '">It should</th>'
    +   '<th style="' + th + ';text-align:end">\u2192 Create</th></tr>'
    + rows.map(function (d, i) {
        return '<tr><td style="' + td + ';color:var(--note)">' + (i + 1) + '</td>'
          + '<td style="' + td + '">' + testEsc(d.do) + '</td>'
          + '<td style="' + td + ';color:var(--grey-2)">' + testEsc(d.see) + '</td>'
          + '<td style="' + td + ';text-align:end">'
          + '<button onclick="testTechUse(' + i + ')" '
          + 'title="Fill the Create form with this case, ready to save" '
          + 'style="font:inherit;font-size:var(--fs-1);padding:3px 10px;border-radius:7px;cursor:pointer;'
          + 'border:1px solid var(--line,#e7e3d8);background:var(--card,#fff);'
          + 'color:var(--ink,#20303b);white-space:nowrap">Add</button></td></tr>';
      }).join('')
    + '</table></div>';
  h += '<div style="font-size:var(--fs-1);color:var(--note);margin-top:5px">'
    + '<b>Add</b> fills the Create form with that row \u2014 you still choose the type and press Save. '
    + 'Nothing here is written to the board on its own.</div>';
  return h + '</div>';
}

/**
 * ── ⭐⭐⭐ ONE FORM, AND IT SAYS WHICH OF THE THREE THINGS YOU ARE MAKING ───────────────────────────────────
 *
 * Athi, 2026-09-13: *"we are using the same dialog box for creating requirement, observation or incident? So
 * possibly those chips should be on top, based on the chip the information received can be changed, and
 * finally a proper save or cancel button."* · *"when I click requirement, if there is a text that states you
 * are writing a requirement, that would be good."* · *"rename Write to Create."*
 *
 * ⚠️⚠️ THE TYPE WAS BEING CHOSEN BY WHICHEVER BUTTON YOU PRESSED AT THE END. Four boxes, then a row of five
 * equal buttons — Pass · Incident · Requirement · Save · Cancel — so a person filled the form in without
 * knowing what they were filling it in FOR, and the labels could not help them because they had to suit all
 * three at once. That is the wrong end of the form. Jira asks for the issue TYPE first and then shows the
 * fields for it; Azure DevOps does the same. [[feedback-adopt-dont-reinvent]]
 *
 * ⭐ SO: the type is chosen at the top, it says in a sentence what it means and what will happen next, the
 * four labels change with it, and the bottom has ONE primary button and Cancel.
 *
 * ⚠️ AND THE FOUR BOXES DO NOT MOVE OR CHANGE ORDER between the types. "What must be true · what you do ·
 * what should happen · what you saw" is the same shape of thought whichever of the three it becomes, and a
 * form that rearranges itself under somebody's hands is a form they have to re-read every time. Only the
 * WORDS change, and which of the boxes is required.
 */
var WKIND = {
  'case': {
    label: 'Test case', verb: '+ Create case', chip: 'var(--grey-2,#545A61)',
    says: 'A CHECK ANYONE CAN REPEAT. It goes on this screen’s board, and somebody else can run it later '
      + 'and record what they got.',
    t1: '1 · What must be true — the rule this case checks',
    t2: '2 · What you do — the steps, in order',
    t3: '3 · What should happen',
    t4: '4 · What you saw — leave it empty if you have not run it yet',
    grade: 'priority',
  },
  inc: {
    label: 'Incident', verb: 'Raise incident', chip: 'var(--disp,#B3261E)',
    says: 'SOMETHING IS WRONG NOW. The case is written, marked failed, and an incident is raised against it '
      + '— everyone testing is told, and whoever fixes it has to send it back to you to retest.',
    t1: '1 · What must be true — the rule that is being broken',
    t2: '2 · What you do — how somebody else reproduces it',
    t3: '3 · What should happen',
    t4: '4 · What you are seeing instead — required: this is the evidence',
    grade: 'severity',
  },
  req: {
    label: 'Requirement', verb: 'Raise requirement', chip: 'var(--grey-2,#545A61)',
    says: 'NOTHING IS BROKEN — IT DOES NOT DO THIS YET. It joins the backlog by priority, the case cites '
      + 'it, and you are told when it is accepted or rejected.',
    t1: '1 · What must be true — what you are asking for',
    t2: '2 · What you do',
    t3: '3 · What should happen once it does',
    t4: '4 · What happens today — required, so the gap is on the record',
    grade: 'priority',
  },
};

/**
 * ⭐ IEEE 1044 severity, each carrying its meaning in words — "Sev-2" alone means whatever the reader assumes,
 * and the server says the same four things in SEV_MEANS. ⚠️ One list, phrased for a shopkeeper.
 */
var WSEV = [['Sev-1', 'the shop cannot trade'], ['Sev-2', 'a job cannot be finished'],
            ['Sev-3', 'wrong, but there is a way round'], ['Sev-4', 'cosmetic']];

/**
 * ── ⭐⭐⭐ WHEN DID IT HAPPEN — THE HALF OF THE CLOCK NOBODY WAS EVER ASKED FOR ─────────────────────────────
 *
 * Athi, 2026-09-13: *"we kept the observation time somewhere — I guess it is in the speed test? Now I
 * couldn’t find it. It would have lost in translation."*
 *
 * ⚠️⚠️ IT WAS NEVER LOST. IT WAS NEVER COLLECTED. The server has accepted `happened_at` since the incident
 * work went in, defaults it to now, refuses a future time, and computes TWO durations from it —
 * `unnoticed_mins` (how long the shop was broken before anybody knew) and `open_mins` (how long it then took
 * to fix). Both are reported. Both are on the row. And **no form in this product has ever sent the field**,
 * so `happened` always equalled `raised`, `unnoticed_mins` was always zero, and the line that prints it was
 * unreachable code.
 *
 * ⚠️⚠️ WHICH IS THE WORST SHAPE OF ALL: a number that is always zero does not look broken, it looks like good
 * news. "0 min before anybody knew" reads as a shop that catches everything instantly. [[feedback-silence-is-the-bug]]
 *
 * ⭐ ASKED AS AN OFFSET, NOT AS A TIMESTAMP. Nobody types "2026-09-13T16:04" about the till going down at
 * four o’clock; they know it was "about an hour ago". One tap, and the client does the arithmetic — the
 * server still refuses anything in the future, so a wrong device clock cannot produce a negative delay.
 * ⚠️ ONLY ON AN INCIDENT. A test case and a requirement did not "happen" at a time.
 */
var TEST_WHEN = [[0, 'Just now'], [5, '5 minutes ago'], [15, '15 minutes ago'], [30, 'Half an hour ago'],
                 [60, 'An hour ago'], [120, 'Two hours ago'], [240, 'This morning'], [1440, 'Yesterday']];
function testWhenHTML() {
  return '<span>When did it happen?</span>'
    + '<select id="wcWhen" style="font:inherit;font-size:var(--fs-1);padding:3px 6px;border:1px solid '
    + 'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff)">'
    + TEST_WHEN.map(function (x) {
        return '<option value="' + x[0] + '">' + x[1] + '</option>';
      }).join('')
    + '</select>';
}
/** ⚠️ an ISO stamp the server can parse; the server clamps anything in the future back to now */
function testWhenAt() {
  try {
    var v = Number((document.getElementById('wcWhen') || {}).value || 0);
    if (!(v > 0)) return null;
    return new Date(Date.now() - (v * 60000)).toISOString();
  } catch (_) { return null; }
}

function testWriteKind(k) {
  if (!WKIND[k]) return;
  CBTEST.writeKind = k;
  if (CBTEST.popupFor) screenCasesPaint(); else testPaint();
}
function testWriteKindNow() { return WKIND[CBTEST.writeKind] ? CBTEST.writeKind : 'case'; }

/** one box, two rows deep, growing with what is typed into it and draggable beyond that */
function testBox(id, ph, inp) {
  return '<textarea id="' + id + '" rows="2" oninput="testGrow(this)" placeholder="' + ph + '" '
    + 'style="' + inp + ';resize:vertical;min-height:2.6em;line-height:1.45;overflow-y:auto"></textarea>';
}
/**
 * ⚠️ height must be cleared BEFORE scrollHeight is read, or the box can only ever grow: scrollHeight of an
 * element already stretched to fit its content is that stretched height, so deleting a line would leave the
 * gap behind for ever.
 */
function testGrow(el) {
  if (!el) return;
  try {
    var cap = Math.round((window.innerHeight || 700) * 0.4);
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight + 2, cap) + 'px';
  } catch (_) {}
}

function testCaseFormHTML() {
  var w = CBTEST.writeFor;
  /**
   * ⚠️ CANCEL USED TO BE A ONE-WAY DOOR. With no form and no button, the only way back was closing the panel
   * and re-opening it from the chip — which is a switch, and this panel exists to remove switches.
   */
  if (!w) {
    var here = CBTEST.popupFor;
    if (!here) return '';
    return '<div style="margin:2px 0 9px"><button onclick="testCaseFor(\'' + here
      + '\', \'' + testEsc(codeName ? codeName(here) : '') + '\')" '
      + 'style="font:inherit;font-size:var(--fs-2);font-weight:700;padding:5px 14px;border:1px solid '
      + 'var(--line,#e7e3d8);border-radius:7px;cursor:pointer;background:var(--card,#fff)">'
      + '+ Create</button>'
      + '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:4px">'
      + 'A test case, an incident or a requirement — you choose which at the top of the form.</div></div>';
  }

  var kind = testWriteKindNow();
  var K = WKIND[kind];
  var inp = 'width:100%;font:inherit;font-size:var(--fs-2);padding:5px 7px;border:1px solid '
    + 'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff);margin-bottom:5px';
  var btn = 'font:inherit;font-size:var(--fs-1);padding:4px 12px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;background:var(--card,#fff)';

  /* ── ⭐ THE TYPE, FIRST, BECAUSE EVERY LABEL BELOW DEPENDS ON IT ── */
  var seg = 'font:inherit;font-size:var(--fs-2);padding:4px 13px;border:0;cursor:pointer;';
  var segOn = 'background:var(--ink,#0F2E3D);color:var(--card,#fff)';
  var segOff = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  var chips = ['case', 'inc', 'req'].map(function (k) {
    return '<button data-testid="wkind-' + k + '" onclick="testWriteKind(\'' + k + '\')" style="' + seg
      + (kind === k ? segOn : segOff)
      + (k === 'case' ? '' : ';border-inline-start:1px solid var(--line,#e7e3d8)') + '">'
      + WKIND[k].label + '</button>';
  }).join('');

  /* ── how bad, or how soon: two different questions, and only one of them belongs to each type ── */
  var grade = K.grade === 'severity'
    /* ⭐ beside the severity, because they are the same question asked twice: how bad, and how long */
    ? testWhenHTML() + '<span style="display:inline-block;width:10px"></span><span>How bad is it?</span>'
      + '<select id="wcSev" style="font:inherit;font-size:var(--fs-1);padding:3px 6px;border:1px solid '
      + 'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff)">'
      + WSEV.map(function (x) {
          return '<option value="' + x[0] + '"' + (x[0] === 'Sev-3' ? ' selected' : '') + '>'
            + x[0] + ' · ' + x[1] + '</option>';
        }).join('')
      + '</select>'
    : '<span>How soon?</span>'
      + '<select id="wcPri" style="font:inherit;font-size:var(--fs-1);padding:3px 6px;border:1px solid '
      + 'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff)">'
      + '<option>High</option><option selected>Medium</option><option>Low</option></select>';

  return '<div style="border:1px solid var(--line,#e7e3d8);border-radius:9px;padding:9px;margin:2px 0 9px">'
    + '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-bottom:4px">What are you recording on '
    +   '<code>' + testEsc(w.code) + '</code> <b>' + testEsc(w.name) + '</b>?</div>'
    + '<div style="display:inline-flex;border:1px solid var(--line,#e7e3d8);border-radius:8px;'
    +   'overflow:hidden;margin-bottom:6px">' + chips + '</div>'
    /* ⭐ and what that choice MEANS, in a sentence — which is what Athi asked for, and it is also the only
       place a first-time tester learns the difference between the three */
    + '<div data-testid="wkind-says" style="font-size:var(--fs-1);color:var(--grey-2);'
    +   'background:var(--paper,#faf8f3);border-radius:7px;padding:5px 8px;margin-bottom:7px">'
    +   K.says + '</div>'

    /**
     * ── ⭐⭐ FOUR BOXES THAT TAKE AS MUCH AS A PERSON HAS TO SAY ─────────────────────────────────────────
     *
     * Athi, 2026-09-13: *"the boxes to receive information are not good — can you make it a text box,
     * scrollable, extendable?"*
     *
     * ⚠️⚠️ THEY WERE SINGLE-LINE `<input>`s, and the fourth one is the OBSERVATION — the field an incident is
     * useless without, and the one people write three sentences in. A one-line box does not refuse the text,
     * it HIDES it: you type past the edge and everything you wrote scrolls out of sight, so you cannot read
     * back what you are about to file. The evidence was being taken through a letterbox.
     *
     * ⭐ TWO ROWS TO START, GROWING AS YOU TYPE, and `resize:vertical` so it can be dragged bigger still —
     * three ways to get the room, none of which has to be discovered before you can write.
     * ⚠️ It stops growing at 40% of the window: a box that eats the panel takes the type chip, the screenshot
     * and the Create button off screen, and then you cannot file what you have written.
     */
    + testBox('wcTitle', K.t1, inp)
    + testBox('wcDo', K.t2, inp)
    + testBox('wcSee', K.t3, inp)
    + testBox('wcGot', K.t4, inp)
    /**
     * ── ⭐⭐ WHICH THING ON THE SCREEN ───────────────────────────────────────────────────────────────────
     *
     * Athi, 2026-09-12: *"we can add few more columns like action, icon, chip, so it is precise?"* and then
     * *"tab"*.
     *
     * ⭐⭐ ALL FOUR ARE THE SAME KIND OF THING AND THE REGISTER ALREADY NAMES THEM. An action, an icon, a chip
     * and a tab are all CONTROLS — 426 of them carry a CTL code, each named by the screen it is on and the
     * words on it. So this is not four new columns; it is one, and the list comes from the register.
     *
     * ⚠️ FOUR SEPARATE COLUMNS WOULD HAVE BEEN WORSE THAN NONE. A tester would have to decide whether ⊕ is an
     * icon or an action before they could write anything, and two people would answer differently — so the
     * same control would be filed two ways and neither search would find both.
     *
     * ⚠️ Optional, and it says so: plenty of findings are about the screen as a whole.
     */
    + '<select id="wcCtl" style="' + inp + ';padding:5px">'
    +   '<option value="">5 · Which control? — optional, the screen as a whole if you leave it</option>'
    +   testCtlOptions(w.code)
    + '</select>'
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px;'
    +   'font-size:var(--fs-1);color:var(--grey-2)">' + grade + '</div>'

    /* ⭐ the picture, and what is attached right now — said in words, because a thumbnail alone leaves a
       tester wondering whether it actually saved */
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;'
    +   'font-size:var(--fs-1);color:var(--grey-2)">'
    +   '<button onclick="testShotGrab()" style="' + btn + '" title="Capture this window and attach it">'
    +     '📷 Screenshot</button>'
    +   (CBTEST.shot
      ? '<span style="display:inline-flex;gap:6px;align-items:center">'
        /* ⭐ the picture itself, small — the fastest possible answer to "is the right one attached?" */
        + (CBTEST._thumb ? '<img src="' + CBTEST._thumb + '" alt="" style="height:26px;width:auto;'
            + 'border:1px solid var(--line,#e7e3d8);border-radius:4px;vertical-align:middle">' : '')
        + '<button onclick="testShotView(\'' + testEsc(CBTEST.shot.id) + '\')" style="' + btn
          + ';padding:1px 7px">view</button>'
        + '<button onclick="testShotDrop()" style="' + btn + ';padding:1px 7px">remove</button></span>'
      : '<span>… or paste one here with Ctrl+V</span>')
    + '</div>'

    /**
     * ── ⭐⭐⭐ AND THE BUTTONS AT THE BOTTOM ARE A DECISION ALREADY MADE ────────────────────────────────────
     *
     * ⚠️ ONE PRIMARY ACTION, and it says what it will do — "Raise incident", not "Incident". A row of five
     * equal buttons is five questions asked at the moment a person has finished thinking.
     * ⭐ "Create and mark passed" survives, for a test case only: writing down a check you have just performed
     * successfully is a real and common act, and making somebody write it, then find it in the list, then tick
     * it is three steps for one thought.
     */
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:9px;padding-top:8px;'
    +   'border-top:1px solid var(--line,#efece4)">'
    +   '<button data-testid="wsave" onclick="testCaseSend()" style="' + btn + ';font-weight:700;'
    +     'font-size:var(--fs-2);padding:5px 15px;color:#fff;background:' + K.chip
    +     ';border-color:' + K.chip + '">' + K.verb + '</button>'
    +   (kind === 'case'
      ? '<button onclick="testCaseSend(\'pass\')" style="' + btn
        + ';color:var(--ok-2,#1B7F4B);background:var(--ok-tint,#eaf5ee)" '
        + 'title="Write it down and record that you have just run it, and it passed">'
        + '✓ Create and mark passed</button>'
      : '')
    +   '<span style="flex:1 1 auto"></span>'
    +   '<button onclick="testCaseCancel()" style="' + btn + '">Cancel</button>'
    + '</div>'
    /* ⚠️ the technique helper is FOLDED, and only on a test case. Unfolded at the foot of the form it read as
       part of it — Athi: *"I am not sure what those chips are doing while creating a case."* It is a way to
       think of MORE cases, which is a different act from writing this one down. */

    + '</div>';
}

function testCaseCancel() { CBTEST.writeFor = null; if (CBTEST.popupFor) screenCasesPaint(); else testPaint(); }

/**
 * Writes the case and, when an outcome was pressed, records it in the same act.
 *
 * ⚠️ THE CASE IS WRITTEN FIRST AND SEPARATELY. If the outcome call fails, the case still exists — the tester
 * has not lost the sentence they just wrote, and can press the outcome again from the list below.
 */
async function testCaseSend(outcome) {
  var w = CBTEST.writeFor; if (!w) return;
  /**
   * ── ⭐⭐ THE TYPE IS ALREADY CHOSEN BY THE TIME ANYBODY REACHES THIS BUTTON ─────────────────────────────
   *
   * The chip at the top of the form is the decision; the button at the bottom only commits it. So an absent
   * `outcome` no longer means "just save a case" — it means "do whatever the chip says", and the one caller
   * that still passes a word ('pass') is the test-case shortcut that also records a run.
   * ⚠️ THE OLD CALL SITES STILL WORK unchanged, which is why this reads the argument first: testDiagRaise and
   * the two list-row buttons pass their outcome explicitly and must not start obeying a chip they never set.
   */
  var kind = (typeof testWriteKindNow === 'function') ? testWriteKindNow() : 'case';
  if (outcome === undefined || outcome === null) outcome = (kind === 'case') ? '' : kind;
  var g = function (id) { return String((document.getElementById(id) || {}).value || '').trim(); };
  var title = g('wcTitle'), doIt = g('wcDo'), see = g('wcSee'), got = g('wcGot');
  if (!title) { if (typeof toast === 'function') toast('Say what must be true.'); return; }
  if (!doIt || !see) { if (typeof toast === 'function') toast('Say what you do, and what you should see.'); return; }
  /* ⚠️ an incident or a requirement without the observation is a report nobody can act on */
  if ((outcome === 'inc' || outcome === 'req') && !got) {
    if (typeof toast === 'function') toast('Say what you are actually seeing \u2014 that is the evidence.');
    try { document.getElementById('wcGot').focus(); } catch (_) {}
    return;
  }
  var n = 1;
  (CBTEST.cases || []).forEach(function (c) {
    var m = String(c.case_key || '').match(new RegExp('^' + w.code + '-H(\\d+)$'));
    if (m) n = Math.max(n, Number(m[1]) + 1);
  });
  var key = w.code + '-H' + String(n).padStart(2, '0');
  try {
    await api('testCaseWrite', { body: { mode: 'add', cases: [{
      case_key: key,
      module_key: w.code, module_name: w.code + ' \u00b7 ' + w.name,
      title: title,
      priority: g('wcPri') || 'Medium',
      test_type: 'screen',
      pre: 'Signed in, and on ' + w.code + ' ' + w.name + '.',
      steps: [[doIt, see]],
      menu: (((window.CBSCREENS && window.CBSCREENS.rows) || [])
        .filter(function (r) { return r.code === w.code; })[0] || {}).path || '',
      screen_code: w.code,
      /* ⭐ the control this case is about, when it is about one — CTL157, not "the button near the top" */
      control_code: g('wcCtl') || null,
      /**
       * ── ⚠️⚠️⚠️ THE FOURTH BOX AND THE PICTURE WERE BEING THROWN AWAY ON SAVE ────────────────────────
       *
       * Athi, 2026-09-13: *"I wrote 4 lines of information, line 1, 2, 3 and 4 and an attachment. I could
       * see only 3 lines of information here, and the attachment is not visible. If that also comes, then
       * we are perfectly recording an observation."*
       *
       * ⚠️ THE OBSERVATION ONLY HAD A HOME IF YOU CHOSE AN OUTCOME. Press Incident and it became the
       * incident’s `observed`; press Save and it went nowhere, along with the screenshot — which had
       * uploaded, said so, and then belonged to nothing. He is right that the four boxes are the unit: what
       * must be true, what you do, what you should see, what you are seeing. Three of them survived.
       *
       * ⭐ SO THE CASE CARRIES THEM. An observation without a verdict is still a thing somebody wrote down
       * on purpose, and the next person to open that case needs it more than anybody.
       */
      observed: got || null,
      evidence_id: (CBTEST.shot && CBTEST.shot.id) || null,
      note: 'Written by hand on ' + new Date().toISOString().slice(0, 10) + '.',
    }] } });
  /**
   * ⚠️⚠️ THE FORM USED TO VANISH ON SAVE, AND THAT WAS THE END OF THE SITTING. Athi, 2026-09-13: *"I created
   * a new incident, after that the test gathering box is gone — if I want to create another observation or
   * test case, how do I create? We need an option to create more."*
   *
   * ⭐ A tester on a screen has three or four things to say about it, not one. The form STAYS, cleared, with
   * the screen it belongs to still named — so the second case costs a sentence rather than a click hunt.
   * ⚠️ And the screenshot is dropped with it: the picture of the last finding must not ride onto the next
   * one, which would attach evidence of the wrong thing and look deliberate.
   */
    /**
     * ── ⚠️⚠️⚠️ THE PICTURE WAS BEING THROWN AWAY BEFORE IT COULD BE ATTACHED ──────────────────────────
     *
     * Athi, 2026-09-13: *"I created an item through write a testcase called screenshot, it got saved and I
     * could see that, but I can’t open again to see what the issue is? what is the screenshot says?"*
     *
     * ⚠️⚠️ `CBTEST.shot` was cleared HERE, and `testFromCase()` reads it BELOW to put `evidence_id` on the
     * incident. So every incident raised this way was filed with evidence_id null, while the image itself
     * had uploaded perfectly and sat in storage attached to nothing. The upload succeeded, the toast said
     * so, and the evidence was gone — the quiet kind of loss, which is the worst kind.
     *
     * ⭐ HELD until the outcome has been filed, then dropped. The clearing still has to happen, and for the
     * reason it always did: the picture of the last finding must not ride onto the next one.
     */
    var heldShot = CBTEST.shot;
    var heldSev = g('wcSev') || null;
    /* ⚠️ read BEFORE the form is repainted, exactly like the severity and the screenshot */
    var heldWhen = testWhenAt();
    CBTEST.shot = null;
    testShotThumb(null);
    if (typeof testLoad === 'function') await testLoad(true);

    if (outcome) {
      /* the observation rides on the same hidden field the list uses, so there is one path to a verdict */
      /* ⚠ still set for the PASS path, which reads the note from the page the same way — but the incident
         and requirement paths no longer depend on this surviving a repaint */
      var box = document.getElementById('cbt_n_' + key);
      if (!box) {
        box = document.createElement('input');
        box.id = 'cbt_n_' + key; box.type = 'hidden';
        document.body.appendChild(box);
      }
      box.value = got || (outcome === 'pass' ? 'As expected.' : '');
      if (outcome === 'pass') await testMark(key, 'pass');
      /* ⚠️ THE SEVERITY IS READ BEFORE THE FORM IS REPAINTED, and passed — it was hardcoded Sev-3 for
         every incident ever raised this way, which made the one field a release gate reads a constant. */
      else await testFromCase(key, outcome, heldShot, got, heldSev, heldWhen);
      try { if (box.type === 'hidden') box.remove(); } catch (_) {}
    }
    if (typeof toast === 'function') toast(outcome ? ('Recorded \u2014 ' + key) : ('Written \u2014 ' + key));
    /* ⚠️ AFTER the repaint, not before: the repaint carries values across now, so clearing first would
       have them carried straight back in. */
    /**
     * ⚠⚠ IT STAYS ON WRITE. Sending the tester to the Cases list after a save felt tidy and was the same
     * fault Athi reported earlier in a new coat: the form disappears, and writing a second case costs a hunt.
     * He asked for “an option to create more”, and the answer is that the form is simply still there. The
     * Cases tab count going up is how the save announces itself.
     */
    if (CBTEST.popupFor) screenCasesPaint(); else testPaint();
    ['wcTitle', 'wcDo', 'wcSee', 'wcGot'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    try { document.getElementById('wcTitle').focus(); } catch (_) {}
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not save it.'); }
}

function testScrHTML() {
  if (CBTEST.scrBusy) return '<div style="color:var(--note);font-size:var(--fs-1)">reading…</div>';
  if (CBTEST.scrErr) {
    return '<div style="color:var(--disp);font-size:var(--fs-1)">' + testEsc(CBTEST.scrErr) + '</div>';
  }
  var cases = CBTEST.cases || [], res = CBTEST.scrRes || [];
  var last = {};
  res.forEach(function (r) { if (r && r.case_key) last[r.case_key] = r.status; });

  var byCode = {}, offScreen = 0;
  var incBy = {}, reqBy = {};
  (CBTEST.scrInc || []).forEach(function (x) { if (x.screen_code) incBy[x.screen_code] = (incBy[x.screen_code] || 0) + 1; });
  (CBTEST.scrReq || []).forEach(function (x) { if (x.screen_code) reqBy[x.screen_code] = (reqBy[x.screen_code] || 0) + 1; });
  cases.forEach(function (c) {
    var code = testScrOf(c);
    if (!code) { offScreen++; return; }
    var b = byCode[code] || (byCode[code] = { code: code, total: 0, pass: 0, fail: 0, notrun: 0,
                                              purpose: null, real: 0, generic: 0 });
    b.total++;
    var st = last[c.case_key];
    if (st === 'pass') b.pass++; else if (st === 'fail') b.fail++; else b.notrun++;
    /**
     * ⭐⭐ WHAT THE SCREEN DOES, AND WHETHER ANYBODY HAS REALLY TESTED IT. Athi, 2026-09-12: *"so we know what
     * that screen does and what are we evidencing … if your existing narrative is not correct or generic,
     * change it to human readable test case and mark it clearly."*
     *
     * ⚠️ A GENERIC CASE COUNTS AS A ROW AND NOT AS A TEST. Every door gets the same standard check, so a
     * screen whose ONLY case is that one has been named, not tested — and a table that adds them together
     * reports thought that has not happened.
     */
    if (c.screen_purpose && !b.purpose) b.purpose = c.screen_purpose;
    if (c.generic) b.generic++; else b.real++;
  });

  /* ⭐ EVERY LIVE SCREEN, not only the ones with cases — a screen the lab has never heard of is the finding */
  var rows = ((window.CBSCREENS && window.CBSCREENS.rows) || []).filter(function (r) {
    return r.group !== 'Control' && r.group !== 'Popup';
  });
  if (!rows.length) {
    return '<div style="padding:10px 0;font-size:var(--fs-2);color:var(--note)">The register did not load, so '
      + 'there is nothing to map against.</div>';
  }
  var q = String(CBTEST.q || '').toLowerCase();
  /* ⭐ walk is the register’s own number for where a screen sits in the product — the rail top to bottom
     with each screen followed by whatever you reach from it. A row without one sorts to the end and is
     visibly unplaced, rather than silently landing first. */
  var list = rows.map(function (r, i) {
    var b = byCode[r.code] || { total: 0, pass: 0, fail: 0, notrun: 0 };
    return { at: (r.walk || (10000 + i)), code: r.code, name: r.screen, group: r.group, total: b.total, pass: b.pass,
             fail: b.fail, notrun: b.notrun, purpose: b.purpose || null,
             real: b.real || 0, generic: b.generic || 0,
             inc: incBy[r.code] || 0, req: reqBy[r.code] || 0 };
  });
  /**
   * ── ⭐⭐⭐ MENU ORDER IS THE DEFAULT, BECAUSE THAT IS HOW A PERSON WALKS THE PRODUCT ─────────────────────────
   *
   * Athi, 2026-09-12: *"we understand through each screen and if I can provide according to menu, it will be
   * easier … so first one should be Counter, then Compose, Task and so on."*
   *
   * ⭐⭐ AND THE TWO LEVELS HE ASKED FOR ALREADY EXIST — they are the rail's own: which GROUP a screen is in,
   * and where it sits WITHIN that group. The register is built by walking the live rail top to bottom, so its
   * natural order IS the menu order; nothing had to be stored, and there is no second ordering to keep in
   * step with the first. ⚠️ A hand-kept sequence beside a rail that already has one is two answers to the
   * same question, and the day they disagree neither is trusted.
   *
   * ⚠️ MY DEFAULT WAS WRONG AND IT WAS WRONG FOR A DEFENSIBLE REASON, which is the dangerous kind. Sorting by
   * failures first is right for someone auditing a finished run and wrong for someone WORKING THROUGH the
   * product, because it reorders itself under them as they record verdicts. So it stays, as a choice.
   */
  if (testScrSortGet() === 'attention') {
    list.sort(function (a, b) {
      return (b.fail - a.fail)
          || ((a.total ? 1 : 0) - (b.total ? 1 : 0))
          || (b.notrun - a.notrun)
          || (a.at - b.at);
    });
  } else {
    list.sort(function (a, b) { return a.at - b.at; });
  }

  var naked = list.filter(function (x) { return !x.total; }).length;
  var withFail = list.filter(function (x) { return x.fail; }).length;
  /* ⚠️ named but not tested: the row exists, the thinking has not happened */
  var onlyGeneric = list.filter(function (x) { return x.total && !x.real; }).length;
  var h = testCaseFormHTML()
    + '<div style="padding:7px 0 8px;font-size:var(--fs-1);color:var(--grey-2,#545A61);line-height:1.5">'
    + '<b>' + list.length + '</b> screens \u00b7 <b>' + naked + '</b> with no case at all \u00b7 <b>'
    + withFail + '</b> with a failure \u00b7 <b>' + onlyGeneric + '</b> covered ONLY by the standard '
    + 'screen check, which names a screen rather than testing it.'
    + '<br>\u26a0\ufe0f <b>' + offScreen + '</b> case(s) are on no screen — guards, engines and the harness. '
    + 'They are counted here and left out of the per-screen numbers rather than out of sight.'
    + '</div>';

  var sb = 'font:inherit;font-size:var(--fs-1);padding:2px 8px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;margin-inline-end:5px;';
  var son = 'background:var(--ink,#0F2E3D);color:var(--card,#fff);border-color:var(--ink,#0F2E3D)';
  var soff = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  var mode = testScrSortGet();
  h += '<div style="margin:2px 0 8px">'
    + '<button onclick="testScrSort(\'menu\')" title="The order the rail is in \u2014 walk the product" style="'
    +   sb + (mode !== 'attention' ? son : soff) + '">In menu order</button>'
    + '<button onclick="testScrSort(\'attention\')" title="Failures first, then screens with no case" style="'
    +   sb + (mode === 'attention' ? son : soff) + '">What needs attention</button>'
    + '</div>';

  h += '<table style="width:100%;border-collapse:collapse;font-size:var(--fs-2)">'
    + '<tr style="text-align:start;color:var(--grey-2,#545A61);font-size:var(--fs-1)">'
    + '<th style="text-align:start;padding:3px 6px 3px 0">Code</th>'
    + '<th style="text-align:start;padding:3px 6px">Screen</th>'
    + '<th style="text-align:end;padding:3px 6px">Cases</th>'
    + '<th style="text-align:end;padding:3px 6px">Passed</th>'
    + '<th style="text-align:end;padding:3px 6px">Failed</th>'
    + '<th style="text-align:end;padding:3px 6px">Not run</th>'
    + '<th style="text-align:end;padding:3px 6px" title="Incidents recorded on this screen">Inc</th>'
    + '<th style="text-align:end;padding:3px 6px" title="Requirements raised from this screen">Req</th>'
    + '<th style="text-align:end;padding:3px 6px"></th></tr>';
  h += list.filter(function (x) {
    return !q || (x.code + ' ' + x.name).toLowerCase().indexOf(q) >= 0;
  }).map(function (x) {
    var num = function (n, colour) {
      return '<td style="text-align:end;padding:4px 6px' + (colour ? ';color:' + colour : '')
        + (n ? ';font-weight:700' : ';color:var(--note)') + '">' + (n || '\u2014') + '</td>';
    };
    return '<tr style="border-top:1px solid var(--line,#e7e3d8)">'
      + '<td style="padding:4px 6px 4px 0;white-space:nowrap"><code onclick="testScrOpen(\'' + x.code
      +   '\')" title="Show the cases on this screen" style="font-family:\'Space Mono\','
      +   'ui-monospace,monospace;cursor:pointer;text-decoration:underline;text-underline-offset:2px">'
      +   testEsc(x.code) + '</code></td>'
      + '<td style="padding:4px 6px">' + testEsc(x.name)
      /* ⭐ a screen with nothing on it says so in words, where the eye already is */
      +   (x.total ? '' : '<span style="color:var(--note);font-size:var(--fs-1)"> \u00b7 no case yet</span>')
      +   (x.total && !x.real
        ? '<span style="color:var(--disp,#B3261E);font-size:var(--fs-1)"> \u00b7 generic only</span>' : '')
      /* ⭐ WHAT IT DOES, under the name — the sentence a tester needs before deciding what to evidence */
      +   (x.purpose ? '<div style="font-size:var(--fs-1);color:var(--grey-2,#545A61)">'
        + testEsc(x.purpose) + '</div>' : '')
      + '</td>'
      + num(x.total)
      + num(x.pass, 'var(--ok,#1B7F4B)')
      + num(x.fail, 'var(--disp,#B3261E)')
      + num(x.notrun)
      + num(x.inc, 'var(--disp,#B3261E)')
      + num(x.req, 'var(--grey-2,#545A61)')
      /* ⭐ the door is ON THE ROW: the screen is named right there, so nothing has to be chosen twice */
      + '<td style="padding:4px 6px;text-align:end"><button onclick="testCaseFor(\'' + x.code
      +   '\', ' + JSON.stringify(String(x.name)).replace(/'/g, '&#39;').replace(/"/g, '&quot;')
      +   ')" title="Create a case, an incident or a requirement on this screen" style="font:inherit;font-size:var(--fs-1);'
      +   'padding:1px 7px;border:1px solid var(--line,#e7e3d8);border-radius:7px;cursor:pointer;'
      +   'background:var(--card,#fff);white-space:nowrap">\u002b case</button></td>'
      + '</tr>'
      /**
       * ── ⭐⭐⭐ AND THE VERDICTS, ON THE SCREEN THEY BELONG TO ────────────────────────────────────────────
       *
       * Athi, 2026-09-12: *"if you provide a button for pass, fail etc, then we will know these many test
       * cases have been written and passed."*
       *
       * ⭐ THIS IS WHAT CLOSES THE LOOP. Walk the product in menu order, open a screen, read its cases, write
       * one if it is missing, and say what happened — without leaving the row. The counts above are the same
       * numbers, so they move as you work.
       *
       * ⚠️ testMark() IS THE ONE THAT RECORDS, here as in the List. A second recorder would be a second set
       * of rules about what a verdict carries — the note, the evidence, the run it belongs to — and the day
       * they differ the ledger has two kinds of truth in it.
       */
      + (CBTEST.scrOpen === x.code ? testScrCasesHTML(x) : '');
  }).join('');
  return h + '</table>';
}

/* which screen is opened out — one at a time, because two open rows make the counts above hard to place */
/**
 * ── ⭐⭐⭐ WHAT A MISMATCH BECOMES ───────────────────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ THE OBSERVATION IS THE EVIDENCE AND IT IS REQUIRED. An incident that says only "it failed" cannot be
 * investigated by anyone but the person who filed it, and they are the one person who will not need to.
 * The box on the row is where it comes from, so the report is written at the moment of seeing rather than
 * reconstructed later.
 *
 * ⭐ BOTH CARRY THE SCREEN CODE AND THE CASE. That is the chain the whole register exists for: a screen, the
 * case that tested it, and what came out — readable in either direction without anybody joining it by hand.
 */
/** ⚠️ `shot` is passed IN, not read from CBTEST: the writer clears it before this runs, and has to */
/**
 * ── ⚠️⚠️⚠️ THE OBSERVATION USED TO TRAVEL THROUGH THE PAGE, AND THE PAGE KEPT LOSING IT ────────────────────
 *
 * Athi, 2026-09-13: *"I couldn’t raise as an incident, two times I raised it."* Both write-ups saved
 * perfectly — CAT001-H04 and CAT001-H05, with observations and screenshots. Only the incident failed, and
 * it failed SILENTLY into a toast that said "say what you are seeing first" when he plainly had.
 *
 * ⚠️⚠️ THE REASON IS A RACE. `testCaseSend` wrote the observation into an input on the page and this function
 * read it back out. Between the two, a repaint can land — `screenCasesPaint` kicks `testScrLoad()` when the
 * counts are not known yet and repaints when it answers — and a repaint rebuilds that input EMPTY. So the
 * value was written to an element that no longer existed by the time it was read, and the guard that exists
 * to stop an incident with no evidence fired on an incident that had it.
 *
 * ⭐ SO IT IS AN ARGUMENT NOW. The DOM read stays only as the fallback for the buttons on the Cases list,
 * where the input IS the place a person typed. Passing a value through the document between two lines of
 * the same function was never anything but a shared mutable global with extra steps.
 */
async function testFromCase(key, kind, shot, seenIn, sev, when) {
  var box = document.getElementById('cbt_n_' + key);
  var seen = (seenIn != null && String(seenIn).trim())
    ? String(seenIn).trim()
    : (box ? String(box.value || '').trim() : '');
  var c = (CBTEST.cases || []).filter(function (x) { return x.case_key === key; })[0] || {};
  var code = testScrOf(c) || null;
  var st0 = (c.steps || [])[0];
  var exp = Array.isArray(st0) ? String(st0[1] || '') : '';
  if (!seen) {
    if (typeof toast === 'function') toast('Say what you are seeing first \u2014 that is the evidence.');
    if (box) box.focus();
    return;
  }
  try {
    if (kind === 'inc') {
      /* the verdict AND the incident: the ledger keeps the run honest, the incident carries the story */
      await testMark(key, 'fail');
      await api('testIncNew', { body: {
        observed: seen + (exp ? '  \u2014 expected: ' + exp : ''),
        /* ⭐ the picture rides with the report, not in a folder somebody has to be told about */
        evidence_id: ((shot || CBTEST.shot) && (shot || CBTEST.shot).id) || null,
        /* ⭐ what the person actually said, when they said it. ⚠️ Sev-3 remains the default in ONE place:
           a caller with no opinion must not be able to file a Sev-1 by accident, nor a blank. */
        affected: 'found by ' + key,
        /* ⭐ WHEN it happened, not when it was typed up. The gap between the two is the one number this
           board exists to make visible, and it was always zero because nothing ever sent this. */
        happened_at: when || null,
        severity: (['Sev-1', 'Sev-2', 'Sev-3', 'Sev-4'].indexOf(String(sev)) >= 0) ? String(sev) : 'Sev-3',
        screen_code: code, case_key: key,
        build: (window.CBBUILD || null) } });
      if (typeof toast === 'function') toast('Failed, and an incident is raised');
      CBTEST.scrInc = null;
    } else {
      await api('testReqRaise', { body: {
        observed: seen,
        requirement: exp || ('What ' + (code || 'this screen') + ' should also do'),
        case_key: key, screen_code: code } });
      if (typeof toast === 'function') toast('Requirement raised \u2014 the case now cites it');
      CBTEST.scrReq = null;
    }
    await testScrLoad();
    /* ⚠️ the popup is a second frame on the same data and must not be left showing the old answer */
    if (CBTEST.popupFor) screenCasesPaint();
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not record that.'); }
}

/**
 * ── ⭐⭐⭐ THE CASES FOR THE SCREEN YOU ARE STANDING ON ───────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"if the test mode is operational, can we bring this screen into the application itself
 * so we don't need to switch? … an extra icon called Test Case on each screen — click it, write the
 * narrative and update there itself, so we can see what test cases are written against that screen and how
 * many closed."*
 *
 * ⭐⭐ AND IT NEEDED NO SECOND SCREEN, WHICH IS THE POINT. The By-screen view already lists a screen's cases
 * with their verdicts and a box to write another; all that was missing was arriving at the right row. A
 * separate in-page panel would have been a second place to write a case, a second place to mark one, and a
 * second set of rules to forget — the fault this whole day has been about.
 *
 * ⚠️ It opens the LAB, which is a panel that floats over the screen you are on. So you do not switch: the
 * screen stays behind it, and its code is still in the corner while you write about it.
 */
function testCasesForScreen(code) {
  try {
    CBTEST.view = 'scr';
    try { localStorage.setItem('cb_test_view', 'scr'); } catch (_) {}
    CBTEST.scrOpen = code || null;
    testLabOpen();
    if (!CBTEST.scrRes) testScrLoad(); else testPaint();
  } catch (e) {}
}

/**
 * ⭐ HOW MANY, AND HOW MANY HAVE PASSED — the number that goes on the chip. Athi: *"how many closed etc."*
 * ⚠️ Returns null when the lab has not loaded its cases, so the chip can stay away rather than claim zero:
 * "0 cases" and "not counted yet" are different facts and only one of them is a finding.
 */
function testScreenTally(code) {
  try {
    /* ⚠⚠ READ-AND-EMPTY IS A REAL ANSWER (0/0); UNREAD is the only case with nothing to say. Conflating
       them hid the Test chip on every screen of a BRAND-NEW shop — where a tester most needs it, because a
       fresh product has no cases until somebody writes the first. Caught by the Playwright spec on its first
       run against a freshly minted entity; no amount of using it on this shop would have found it. */
    if (!CBTEST._read) return null;
    if (!CBTEST.cases) return { total: 0, pass: 0, fail: 0 };
    var t = { total: 0, pass: 0, fail: 0 };
    CBTEST.cases.forEach(function (c) {
      if (testScrOf(c) !== code) return;
      t.total++;
      var l = CBTEST.last[c.case_key];
      if (l && l.status === 'pass') t.pass++; else if (l && l.status === 'fail') t.fail++;
    });
    return t;
  } catch (_) { return null; }
}

function testScrOpen(code) {
  CBTEST.scrOpen = (CBTEST.scrOpen === code) ? null : code;
  testPaint();
}

/**
 * ── ⭐⭐ ONE LIST, TWO FRAMES ───────────────────────────────────────────────────────────────────────────────
 *
 * The cases on a screen, with what should happen, a box for what IS happening, and the three outcomes. It is
 * used by the By-screen table AND by the popup that opens from the screen itself.
 *
 * ⚠️⚠️ WRITTEN ONCE ON PURPOSE. A second copy for the popup would be a second place to mark a case and a
 * second set of rules about what a verdict carries — and the day they drift, the ledger holds two kinds of
 * truth. The frame differs; the list does not.
 */
/* which cases the panel is showing — remembered, because a tester works one way all day */
function testCaseFilterGet() {
  try { return localStorage.getItem('cb_case_filter') || 'todo'; } catch (_) { return 'todo'; }
}
function testCaseFilter(v) {
  try { localStorage.setItem('cb_case_filter', v); } catch (_) {}
  if (CBTEST.popupFor) screenCasesPaint(); else testPaint();
}
/* a passed case opened again on purpose — one at a time, and not remembered */
function testRetest(key) {
  CBTEST.retest = CBTEST.retest || {};
  CBTEST.retest[key] = 1;
  if (CBTEST.popupFor) screenCasesPaint(); else testPaint();
}

/**
 * ── ⭐⭐ ONE LIST, TWO FRAMES ───────────────────────────────────────────────────────────────────────────────
 *
 * The cases on a screen, with what should happen, a box for what IS happening, and the three outcomes. Used
 * by the By-screen table AND by the panel that opens from the screen itself.
 *
 * ⚠️⚠️ WRITTEN ONCE ON PURPOSE. A second copy for the panel would be a second place to mark a case and a
 * second set of rules about what a verdict carries — and the day they drift, the ledger holds two kinds of
 * truth. The frame differs; the list does not.
 *
 * ── ⭐⭐⭐ A PASSED CASE STANDS DOWN ─────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"when the result is pass, why is that row still active? We should be able to filter
 * only those still to be tested, and there must be an option to see the passed one."*
 *
 * ⚠️ A DONE THING THAT STILL LOOKS LIKE WORK IS WORSE THAN A HIDDEN ONE. Seventeen cases all wearing three
 * buttons and an empty box give a tester no idea where they are in the walk, and the passed ones are the
 * majority by the end of it.
 *
 * ⭐ So the default is TO DO — anything not yet passed, which includes a failure, because a failure is very
 * much still work. Passed collapses to one quiet line with a Re-test if you want it back, and the filter
 * says how many are in each pile so nothing is hidden without a number.
 */
/**
 * ── ⭐⭐⭐ A CASE HAS TO BE OPENABLE ─────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13, having written one and attached a picture to it: *"it got saved and I could see that,
 * but I can’t open again to see what the issue is? what is the screenshot says etc? how to do that?"*
 *
 * ⚠️⚠️ HE COULD NOT, BECAUSE THERE WAS NO WAY TO. The row showed a title, one line of "should see", a box to
 * type in and three buttons. Everything else the case knows — what you do, the pre-conditions, the note, WHO
 * recorded the last verdict and what they wrote, the incident it raised, the screenshot — existed and had
 * nowhere to appear. The lab has had a detail view since the beginning; this panel never got one, and this
 * panel is where the testing actually happens.
 *
 * ⭐ IT IS BUILT FROM WHAT IS ALREADY LOADED — the case, `CBTEST.last`, `CBTEST.scrInc`, `CBTEST.scrReq` —
 * so opening a row costs nothing and works with the network down.
 */
function testCaseOpen(key) {
  CBTEST.openCase = (CBTEST.openCase === key ? null : key);
  screenCasesPaint();
}

/** everything this panel knows about one case, which turns out to be a good deal more than it was showing */
/**
 * ── ⭐⭐⭐ THE STANDARD, IN THE NARRATIVE ─────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"this tool is awesome, anyone can test and figure out the issues … bring the standard
 * into narratives."*
 *
 * ⚠️⚠️ A CITATION IN A FIELD NOBODY SEES IS NOT A CITATION. The ASVS cases carry `cites` — standard, clause,
 * chapter, level — and the panel showed none of it, so a tester read "verify that data-specific access is
 * restricted" as somebody’s opinion. It is not; it is OWASP’s, at a numbered clause, and saying so is the
 * difference between a checklist and an argument.
 *
 * ⭐ AND IT IS WHAT MAKES THE TOOL PORTABLE. Athi: *"if it runs against any platform, that will be really
 * good."* A case that says only "check the price" means nothing anywhere else. A case that says "ASVS 5.0.0
 * §8.2.2 · Authorization · level 1" is a case any product can be held to, by anybody who has never met this
 * one.
 */
function testCiteHTML(c) {
  var q = c && c.cites;
  if (!q) return '';
  var bits = [q.standard, q.clause ? '\u00a7' + q.clause : null, q.chapter,
              q.level ? 'level ' + q.level : null].filter(Boolean);
  return '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:4px;padding:3px 7px;'
    + 'background:var(--paper,#faf8f3);border-inline-start:2px solid var(--line,#e7e3d8);border-radius:0 6px 6px 0">'
    + 'Required by <b>' + testEsc(bits.join(' \u00b7 ')) + '</b>'
    + '<span style="display:block;color:var(--note)">Not our opinion \u2014 a published clause. If the standard '
    + 'moves, every case still citing this one is exactly the set to look at again.</span></div>';
}

function testCaseDetailHTML(c) {
  var l = (CBTEST.last || {})[c.case_key];
  var pad = 'padding:2px 0;font-size:var(--fs-1)';
  var lab = function (t, v) { return v ? '<div style="' + pad + '"><span style="color:var(--note)">'
    + t + '</span> ' + v + '</div>' : ''; };

  var h = '<div style="margin:4px 0 2px;padding:7px 9px;background:var(--paper,#faf8f3);'
    + 'border:1px solid var(--line,#efece4);border-radius:8px">';

  /* the case as written: every step, not only the first */
  (c.steps || []).forEach(function (st, i) {
    h += '<div style="display:flex;gap:6px;' + pad + '">'
      + '<span style="color:var(--note);min-width:12px">' + (i + 1) + '</span>'
      + '<span style="flex:1">' + testEsc(Array.isArray(st) ? (st[0] || '') : String(st))
      +   '<span style="display:block;color:var(--grey-2)">\u2192 '
      +     testEsc(Array.isArray(st) ? (st[1] || '') : '') + '</span></span></div>';
  });
  h += lab('Before you start:', testEsc(c.pre || ''));
  h += lab('Use:', testEsc(c.data || ''));
  h += lab('Priority:', testEsc(c.priority || ''));
  h += lab('Control:', testEsc(c.control_code || ''));
  h += lab('Note:', testEsc(c.note || ''));
  h += testCiteHTML(c);

  /* ⭐ the fourth box, kept with the case whether or not a verdict was ever given */
  if (c.observed) {
    h += '<div style="margin-top:5px;padding:5px 7px;background:var(--card,#fff);'
      + 'border:1px solid var(--line,#efece4);border-radius:7px">'
      + '<div style="font-size:var(--fs-1);color:var(--note)">What was being seen when this was '
      + 'written</div><div style="font-size:var(--fs-2)">' + testEsc(c.observed) + '</div></div>';
  }
  /* ⚠️ the picture is fetched with the token, never an <img src> — the endpoint needs an Authorization
     header and a plain link carries none, which is the "404, then unauthorised" this already cost once */
  if (c.evidence_id) {
    h += '<button class="btn" style="display:inline-block;width:auto;margin-top:5px;'
      + 'font-size:var(--fs-1);padding:3px 10px" onclick="testShotView(' + "'" + testEsc(c.evidence_id)
      + "'" + ')">\u1f5bc\ufe0f Screenshot</button>';
  }

  /* ── the last verdict, in the words of whoever gave it ── */
  if (l) {
    var col = l.status === 'pass' ? 'var(--ok-2,#1B7F4B)'
      : (l.status === 'fail' || l.status === 'blocked') ? 'var(--disp,#B3261E)' : 'var(--note)';
    h += '<div style="margin-top:6px;padding-top:5px;border-top:1px solid var(--line,#efece4)">'
      + '<b style="font-size:var(--fs-1);color:' + col + '">' + testEsc(String(l.status).toUpperCase())
      + '</b> <span style="font-size:var(--fs-1);color:var(--note)">'
      + testEsc(l.tester_name || 'someone') + (l.at ? ' \u00b7 ' + testEsc(String(l.at).slice(0, 16)
          .replace('T', ' ')) : '') + '</span>'
      + (l.note ? '<div style="' + pad + '">' + testEsc(l.note) + '</div>' : '')
      + (l.evidence ? '<div style="' + pad + ';color:var(--grey-2);word-break:break-word">'
          + testEsc(l.evidence) + '</div>' : '')
      + '</div>';
  }

  /**
   * ── ⭐⭐ AND THE PICTURE, WHICH IS THE PART HE ASKED FOR BY NAME ────────────────────────────────────
   *
   * ⚠️ The screenshot is attached to the INCIDENT, not to the case — an incident is a thing that happened
   * once and a case is a rule that stands, so evidence belongs to the event. But the tester who wants it is
   * standing on the case, so the case has to reach across and find it.
   *
   * ⚠️ NOT AN `<img src>`: the attachment endpoint needs an Authorization header and a plain link carries
   * none — that is the "404, then unauthorised" this already cost once. testShotView() fetches it with the
   * token and opens the blob.
   */
  var raised = (CBTEST.scrInc || []).concat(CBTEST.scrReq || [])
    .filter(function (x) { return x.case_key === c.case_key; });
  raised.forEach(function (x) {
    h += '<div style="margin-top:5px;padding-top:5px;border-top:1px solid var(--line,#efece4)">'
      + '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(x.ref || x.clause || '')
      + '</code> <span style="font-size:var(--fs-1)">' + testEsc(x.state || '') + '</span>'
      + (x.observed ? '<div style="' + pad + '">' + testEsc(x.observed) + '</div>' : '')
      + (x.requirement ? '<div style="' + pad + '">' + testEsc(x.requirement) + '</div>' : '')
      + (x.evidence_id
        ? '<button class="btn" style="display:inline-block;width:auto;margin-top:4px;'
          + 'font-size:var(--fs-1);padding:3px 10px" onclick="testShotView(' + "'"
          + testEsc(x.evidence_id) + "'" + ')">\u1f5bc\ufe0f Screenshot</button>'
        : '<div style="' + pad + ';color:var(--note)">No screenshot was attached to this one.</div>')
      + '</div>';
  });
  if (!l && !raised.length && !c.observed && !c.evidence_id) {
    h += '<div style="' + pad + ';color:var(--note);margin-top:4px">Not run yet, and nothing raised '
      + 'against it.</div>';
  }
  return h + '</div>';
}

function testCaseListHTML(code) {
  var all = (CBTEST.cases || []).filter(function (c) { return testScrOf(c) === code; });
  if (!all.length) {
    return '<div style="font-size:var(--fs-1);color:var(--note);padding:6px 0 2px">'
      + 'No case on this screen yet — Create is the first tab above.</div>';
  }
  var isPass = function (c) { var l = CBTEST.last[c.case_key]; return !!(l && l.status === 'pass'); };
  var nPass = all.filter(isPass).length;
  var nTodo = all.length - nPass;
  var f = testCaseFilterGet();
  var mine = f === 'passed' ? all.filter(isPass)
           : f === 'all' ? all
           : all.filter(function (c) { return !isPass(c); });

  /**
   * ── ⭐⭐ THE CLOSED ONES ARE HERE, AND ONLY WHEN ASKED FOR ─────────────────────────────────────────────────
   *
   * Athi, 2026-09-13: *"how do we see the closed ones? We don't need to read all at the same time; only the
   * not-closed ones are visible, so the closed ones we have to see on demand."*
   *
   * ⚠️⚠️ AND A RETIRED CASE WAS NOT HIDDEN, IT WAS UNREACHABLE. `CBTEST.cases` never contains them — they come
   * back only from `?all=1`, which only the Findings view had ever asked for. So a case somebody closed on this
   * screen could not be read on this screen, at all, by anybody. Hidden and gone are different things, and only
   * one of them is a decision. [[feedback-silence-is-the-bug]]
   */
  var shutAll = (CBTEST.closedCases || []).filter(function (c) { return testScrOf(c) === code; });
  var showShut = testScrShut('case');
  if (!CBTEST.closedCases) testFindLoadClosed();

  var chip = 'font:inherit;font-size:var(--fs-1);padding:1px 8px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;margin-inline-end:4px;';
  var on = 'background:var(--ink,#0F2E3D);color:var(--card,#fff);border-color:var(--ink,#0F2E3D)';
  var off = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  var h = '<div style="margin:8px 0 2px">'
    + [['todo', 'To do', nTodo], ['passed', 'Passed', nPass], ['all', 'All', all.length]]
      .map(function (x) {
        return '<button onclick="testCaseFilter(\'' + x[0] + '\')" style="' + chip
          + (f === x[0] ? on : off) + '">' + x[1] + ' <b>' + x[2] + '</b></button>';
      }).join('')
    + (shutAll.length ? '<button onclick="testScrShutToggle(\'case\')" style="' + chip + off + '">'
        + (showShut ? 'hide ' : 'show ') + shutAll.length + ' closed</button>' : '')
    + '</div>';

  /* ⚠️ drawn UNDER the live ones and faded, never mixed in: a closed case that reads like a live one is a case
     somebody runs again for nothing. */
  var shutHTML = (showShut && shutAll.length)
    ? '<div style="margin-top:9px;padding-top:7px;border-top:1px solid var(--line,#e7e3d8);opacity:.62">'
      + '<div style="font-size:var(--fs-1);color:var(--note);margin-bottom:3px">Closed on this screen</div>'
      + shutAll.map(function (c) {
          return '<div style="padding:5px 0;border-top:1px solid var(--line,#efece4)">'
            + '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(c.case_key) + '</code> '
            + '<span style="font-size:var(--fs-2)">' + testEsc(c.title || '') + '</span>'
            + (c.closed_note ? '<div style="font-size:var(--fs-1);color:var(--grey-2)">closed: '
                + testEsc(c.closed_note) + (c.closed_by ? ' · ' + testEsc(c.closed_by) : '') + '</div>' : '')
            + ' <button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);'
            + 'padding:1px 8px" onclick="testHandClose(\'' + testEsc(c.case_key) + '\',true)">Open again'
            + '</button></div>';
        }).join('')
      + '</div>'
    : '';

  if (!mine.length) {
    return h + '<div style="font-size:var(--fs-1);color:var(--note);padding:6px 0 2px">'
      + (f === 'todo' ? 'Nothing left to test on this screen.' : 'None in this pile.') + '</div>' + shutHTML;
  }

  return h + mine.map(function (c) {
    var l = CBTEST.last[c.case_key];
    var st0 = (c.steps || [])[0];
    var exp = Array.isArray(st0) ? String(st0[1] || '') : '';
    var col = l && l.status === 'pass' ? 'var(--ok-2,#1B7F4B)'
            : l && l.status === 'fail' ? 'var(--disp,#B3261E)' : 'var(--note)';
    var done = isPass(c) && !((CBTEST.retest || {})[c.case_key]);

    /* ⭐ a passed case: one line, out of the way, and openable again on purpose */
    if (done) {
      return '<div style="display:flex;gap:8px;align-items:baseline;padding:3px 0;'
        +   'border-top:1px solid var(--line,#efece4);opacity:.72">'
        + '<code style="font-size:var(--fs-1);color:var(--grey-2)">' + testEsc(c.case_key) + '</code>'
        + '<span style="font-size:var(--fs-1);flex:1 1 12em;min-width:0;overflow:hidden;'
        +   'text-overflow:ellipsis;white-space:nowrap">' + testEsc(c.title || '') + '</span>'
        + '<span style="font-size:var(--fs-1);font-weight:700;color:' + col + '">PASS</span>'
        + '<button class="btn" style="font-size:var(--fs-1);padding:0 7px" onclick="testCaseOpen(\''
        +   testEsc(c.case_key) + '\')">Open</button>'
        + '<button class="btn" style="font-size:var(--fs-1);padding:0 7px" onclick="testRetest(\''
        +   testEsc(c.case_key) + '\')">Re-test</button>'
        + (CBTEST.openCase === c.case_key
            ? '<div style="flex:1 1 100%">' + testCaseDetailHTML(c) + '</div>' : '')
        + '</div>';
    }

    /* ⭐ the key is the handle: it is already the thing a tester points at when they talk about a case */
    var isOpen = CBTEST.openCase === c.case_key;
    return '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;padding:4px 0;'
      +   'border-top:1px solid var(--line,#efece4)">'
      + '<button onclick="testCaseOpen(\'' + testEsc(c.case_key) + '\')" title="Open it" '
      +   'style="font:inherit;font-size:var(--fs-1);color:var(--grey-2);background:none;border:0;'
      +   'padding:0;cursor:pointer;text-align:start">'
      +   (isOpen ? '\u25be ' : '\u25b8 ') + '<code>' + testEsc(c.case_key) + '</code></button>'
      /**
       * \u2b50 THE PICTURE IS ANNOUNCED ON THE ROW, not only inside it. Athi, 2026-09-13: *"I attached the
       * screenshot, but it is not appearing in the cases tab?"* \u2014 it WAS attached and it WAS saved; it sat two
       * clicks away behind a caret, which for the most valuable thing on a finding is the same as absent.
       */
      + (c.evidence_id ? '<button title="See the screenshot" onclick="testShotView(\'' + testEsc(c.evidence_id)
          + '\')" style="font-size:var(--fs-1);background:none;border:0;cursor:pointer;padding:0">'
          + '\ud83d\uddbc\ufe0f</button>' : '')
      + '<span style="flex:1 1 16em;min-width:0">'
      +   '<div style="font-size:var(--fs-2)">' + testEsc(c.title || '') + '</div>'
      +   (exp ? '<div style="font-size:var(--fs-1);color:var(--grey-2,#545A61)">should see: '
        + testEsc(exp) + '</div>' : '')
      +   '<input id="cbt_n_' + testEsc(c.case_key) + '" placeholder="what you are seeing instead \u2014 leave '
      +     'empty if it matched" style="width:100%;font:inherit;font-size:var(--fs-1);margin-top:3px;'
      +     'padding:3px 6px;border:1px solid var(--line,#e7e3d8);border-radius:6px;'
      +     'background:var(--card,#fff)">'
      +   (isOpen ? testCaseDetailHTML(c) : '')
      + '</span>'
      + '<span style="font-size:var(--fs-1);font-weight:700;color:' + col + '">'
      +   (l ? testEsc(String(l.status).toUpperCase()) : 'not run') + '</span>'
      + '<span style="display:flex;gap:4px;flex:0 0 auto;align-items:center">'
      + testMarkBtn(c.case_key, 'pass', 'Pass', 'var(--ok-2)', 'var(--ok-tint)')
      + '<button class="btn" onclick="testFromCase(\'' + testEsc(c.case_key) + '\',\'inc\')" '
      +   'style="color:var(--disp);background:var(--danger-tint,#fbeceb)">Incident</button>'
      + '<button class="btn" onclick="testFromCase(\'' + testEsc(c.case_key) + '\',\'req\')" '
      +   'style="color:var(--grey-2);background:var(--neutral-tint)">Requirement</button>'
      /**
       * ── ⭐⭐ AND THE WAY OUT, WHICH WAS ONLY IN THE LAB ─────────────────────────────────────────────────
       *
       * Athi, 2026-09-13: *"in this screen I do not have a way of closing the ticket. Say by mistake I raised
       * it, then I need to close; or I am checking the observation again, then I need to close it."*
       *
       * ⚠️ Closing existed — in the Test lab, on a view he was not looking at. A person writes a case where
       * they are standing and finishes with it where they are standing; making them go somewhere else to say
       * "done" is how a list grows for ever, which is the complaint he raised an hour before this one.
       *
       * ⚠️ SMALL AND LAST. Pass, Incident and Requirement are what a tester does most; Close is what they do
       * once. Giving it the same weight would put a destructive action beside the three constructive ones.
       */
      + '<button class="btn" onclick="testHandClose(\'' + testEsc(c.case_key) + '\',false)" '
      +   'title="Close this case \u2014 it moves to Test lab \u203a Findings \u203a Closed" '
      +   'style="font-size:var(--fs-1);padding:2px 8px;color:var(--note);background:none;'
      +   'border:1px solid var(--line,#e7e3d8)">\u2713 Close</button>'
      + '</span>'
      + '</div>';
  }).join('') + shutHTML;
}
/* the table frame: the same list, inside a row that spans the columns */
function testScrCasesHTML(x) {
  return '<tr><td colspan="9" style="padding:2px 6px 10px 0;background:var(--neutral-tint,#f7f5ef)">'
    + testCaseListHTML(x.code) + '</td></tr>';
}

/**
 * ── ⭐⭐⭐ A PANEL BESIDE THE SCREEN, NOT A DIALOG OVER IT ────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"the screen should be active side by side, so operation can be done and also the action
 * can be written — just minimise and keep it below when focus, maximise it."*
 *
 * ⚠️⚠️ A MODAL WAS THE WRONG PRIMITIVE AND HE SPOTTED IT IMMEDIATELY. It was the right choice for a dialog:
 * free POP code, movable, closes on Escape. But a modal lays a backdrop over the app, and the ONE THING this
 * has to allow is operating the screen while writing about it. You cannot document what you cannot touch.
 *
 * ⭐ So it is built the way the test lab and the register are: a fixed panel, bottom-right, no backdrop, with
 * a `.mhd` header that drags and a minimise that leaves the header behind to restore from. Nothing invented —
 * the same three lines of makeMovable those two already use, and it earns a PNL code from the register
 * without asking, because the register finds panels by the makeMovable key.
 */
/**
 * ── ⭐⭐⭐ THE PANEL FOLLOWS YOU ─────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"so I don't need to switch"*, and then *"similarly, message box, popup and so on."*
 *
 * ⚠️ IT WAS OPENED PER SCREEN, which is a switch by another name. Walking Counter → Compose → Task meant
 * opening it three times, and a tester walking 59 screens would open it 59 times.
 *
 * ⭐ SO IT RETARGETS TO WHATEVER IS IN FRONT, most specific first:
 *
 *     a dialog on top   POP067   \u2014 what you are actually looking at
 *     a record open     DTL001   \u2014 the detail, not the list it came from
 *     otherwise         RAL002   \u2014 the screen
 *
 * ⚠️⚠️ AND IT NEVER RETARGETS WHILE YOU ARE TYPING. Following the reader is helpful; throwing away a
 * half-written sentence because they clicked something is not. If any field has text in it, the panel
 * stays where it is until that is saved or cancelled.
 */
function testFollowTarget() {
  try {
    /* a dialog wins: it is the thing in front, and it has a code of its own */
    if (typeof modalCode === 'function' && document.querySelector('#modalhost .modal')) {
      var mc = modalCode();
      if (mc && mc.code) return { code: mc.code, name: (mc.fn ? mc.fn + '()' : 'dialog') };
    }
    var d = document.querySelector('[data-testid="detail-code"]');
    if (d) return { code: String(d.textContent || '').trim(), name: codeName(String(d.textContent || '').trim()) };
    var t = document.querySelector('[data-testid="screen-code"]');
    if (t) return { code: String(t.textContent || '').trim(), name: codeName(String(t.textContent || '').trim()) };
    return null;
  } catch (_) { return null; }
}

/* is the tester mid-sentence? then nothing moves */
function testFormDirty() {
  try {
    return ['wcTitle', 'wcDo', 'wcSee', 'wcGot'].some(function (id) {
      var el = document.getElementById(id);
      return el && String(el.value || '').trim();
    });
  } catch (_) { return false; }
}

function screenCasesFollow() {
  try {
    if (!CBTEST.popupFor || !document.getElementById('cbcasespanel')) return;
    var t = testFollowTarget();
    if (!t || !t.code || t.code === CBTEST.popupFor) return;
    if (testFormDirty()) return;
    CBTEST.popupFor = t.code;
    CBTEST.writeFor = { code: t.code, name: t.name };
    testAreaOpen(!!(testScreenTally(t.code) || {}).total);
    testDiagMark();
    screenCasesPaint();
  } catch (e) {}
}

function screenCasesClose() {
  var el = document.getElementById('cbcaseshost');
  if (el && el.parentNode) el.parentNode.removeChild(el);
  CBTEST.popupFor = null;
  CBTEST.writeFor = null;
}

async function screenCasesPopup(code, name) {
  screenCasesClose();
  var host = document.createElement('div');
  host.id = 'cbcaseshost';
  host.innerHTML =
    '<div id="cbcasespanel" role="dialog" aria-label="Test cases for this screen" style="position:fixed;'
    + 'inset-inline-end:16px;bottom:16px;width:min(560px,calc(100vw - 32px));max-height:min(72vh,660px);'
    + 'display:flex;flex-direction:column;background:var(--card,#fff);'
    + 'border:1px solid var(--line,#e7e3d8);border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.16);'
    /* ⚠️ under the modal layer on purpose: a real dialog must still be able to open over this */
    + 'z-index:3900;overflow:hidden">'
    + '<div id="cbcaseshead" class="mhd" style="padding:9px 11px;border-bottom:1px solid var(--line,#e7e3d8);'
    +   'background:var(--paper,#faf8f3);border-radius:12px 12px 0 0"></div>'
    + '<div id="cbcasesbody" style="overflow:auto;padding:0 11px 11px"></div>'
    + '</div>';
  document.body.appendChild(host);
  try {
    if (typeof makeMovable === 'function') {
      makeMovable(document.getElementById('cbcasespanel'), {
        key: 'cb_casespanel', minW: 340, minH: 200, minimise: true,
        dragOn: '#cbcaseshead', fit: '#cbcasesbody',
      });
    }
  } catch (_) {}
  CBTEST.popupFor = code;
  CBTEST.writeFor = { code: code, name: name };
  /* ⭐ the one place the default belongs: opening it */
  testAreaOpen(!!(testScreenTally(code) || {}).total);
  testDiagMark();
  screenCasesPaint();
  /* ⚠️ the board may not be read yet — a person can be on a screen having never opened the lab */
  try {
    if (!CBTEST.cases || !CBTEST.cases.length) { await testLoad(); screenCasesPaint(); }
  } catch (_) {}
}

/**
 * ── ⭐⭐⭐ THREE AREAS, ONE AT A TIME ─────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"design the screen beautifully with options to view each of the area."*
 *
 * ⚠️ IT WAS ONE LONG SCROLL and that is what made it feel heavy: the form, then every case, then everything
 * ever raised — so a tester wanting to mark one case passed scrolled past a form they were not filling in,
 * and a tester writing a case scrolled past seventeen they were not running.
 *
 *   WRITE    the four parts and the outcome
 *   CASES    what exists here, with To do · Passed · All
 *   RAISED   the incidents and requirements that came out of it
 *
 * ⭐ IT OPENS ON THE ONE WITH WORK IN IT: Cases when there are any, Write when the screen is untouched. A
 * tester on a fresh screen is there to write; a tester on a covered screen is there to run.
 *
 * ⚠️ THE COUNTS ARE ON THE TABS, so nothing is hidden without a number — the same rule as the case filter.
 * A tab reading "Raised 2" is an invitation; an unlabelled tab is a thing nobody presses.
 */
/**
 * ── ⭐⭐⭐ WHAT THIS SCREEN COST ─────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"we may have to see how to bring the types of testing in this window — for example
 * speed test, how the API is responding, how many round trips it makes… kind of diagnostic tool, so we can
 * take the required action."*
 *
 * ⭐⭐ NOTHING NEW IS MEASURED. `CBCALLS` already holds the last forty API calls with their method, path,
 * status, correlation id and duration — it was built for the Spec overlay and only had to be switched on
 * for test mode as well. A second timer would be a second set of numbers to reconcile.
 *
 * ⚠️⚠️ ROUND TRIPS ARE THE NUMBER THAT MATTERS HERE, not milliseconds. Measured 2026-09-08: Railway (sfo) to
 * Supabase (Mumbai) is 1.4–2.4 s PER CALL, four database round trips inside each one. So a screen making
 * six calls is not slightly slower than one making two — it is a different screen to use, and the count is
 * the thing a person can actually act on.
 *
 * ⚠️ SINCE THE PANEL OPENED, not since the tab loaded. A diagnostic that includes the sign-in and the boot
 * says nothing about the screen you are standing on.
 */
/**
 * ── ⭐⭐⭐ WHAT IS BEHIND THIS SCREEN, AND HOW ITS TESTS STAND ─────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"can you bring the other test cases like engine, web, middleware etc which were run or
 * should run as part of the screen in the same place in different tabs… with status."*
 *
 * ⭐⭐ A SCREEN IS THE TIP OF A STACK. Marking CAT001 passed says the catalogue LOOKED right; whether the tax
 * arithmetic under it is proved lives in an engine unit test three layers down, on a board the tester on that
 * screen never opens. This area walks the stack downwards from where they are standing.
 *
 * ⭐⭐ THE CHAIN IS BUILT FROM LINKS THAT ALREADY EXIST — nothing here is invented, and each rung says how
 * strong it is, because a tester reading "8 engine cases, all passing" must know whether that is a fact:
 *
 *   1  DRAWS IT      the asset register knows which capability file draws which screen (CBASSETS.drawnBy)
 *   2  IT CALLED     the routes this screen really hit, from its own network log — observed, not guessed
 *   3  DECLARED      cases whose `subjects` NAME one of those files. ⭐ THIS IS THE REAL FIND: 128 test
 *                    files already declare the module they test, and nothing was reading it. An exact,
 *                    stored, two-way link from a screen to the engine tests underneath it.
 *   4  IS THE CASE   the file IS a case in its own right (481 cases are keyed by their own path)
 *   5  NAMED AFTER   the key merely contains the word. ⚠️ A LEAD, NOT COVERAGE — and it is labelled so in
 *                    the list itself, never folded into the counts above it.
 */
function testBehindOf(code) {
  var A = (window.CBASSETS || {});
  var rows = A.rows || [];
  var drawn = (A.drawnBy || {})[code] || '';
  var files = [];
  String(drawn).split(',').forEach(function (p) { p = p.trim(); if (p) files.push(p); });

  /**
   * ⭐ WHAT IT ACTUALLY CALLED — the same forty-call log the Speed area reads, no second measurement. But
   * narrowed twice, because the first version of this was wrong in a way that flattered it:
   *
   * ⚠️ ONLY THIS SCREEN’S CALLS. The log is the whole session. Unfiltered, the Catalogue claimed eleven
   * routes — the rail’s, the notification poll’s — and 83 tests underneath it. A wrong link is worse
   * than no link: it reports coverage the screen does not have.
   *
   * ⚠️ AND NEVER THE TEST TOOL’S OWN TRAFFIC. Reading the board, saving a verdict and posting a
   * screenshot all hit /api/testing, so every screen in the product would list the tester’s own tool as
   * something it depends on. It depends on nothing of the kind; the tool is standing in the room.
   */
  var here = null;
  try { if (typeof navScreenKey === 'function') here = navScreenKey(); } catch (_) {}
  var gen = window.CBGEN || 0;
  var routes = [], seen = {};
  (window.CBCALLS || []).forEach(function (c) {
    if (here && c.scr && c.scr !== here) return;
    if (gen && c.gen && c.gen !== gen) return;   /* this visit, not every visit ever made */
    var m = String(c.path || '').match(/^\/api\/([a-z0-9-]+)/i);
    if (!m || m[1].toLowerCase() === 'testing') return;
    var f = 'chitbridge-api/routes/' + m[1].toLowerCase() + '.js';
    if (!seen[f]) { seen[f] = 1; routes.push(f); }
  });

  /**
   * ⚠️ TWO SPELLINGS OF THE SAME FILE. The register writes the repo in (`chitbridge-api/routes/tax.js`);
   * `subjects` writes it repo-relative (`routes/tax.js`), because a test file names its module the way its
   * own repo sees it. Matching one against the other raw finds nothing at all — which looks exactly like
   * "this screen has no engine tests" and would have been believed.
   */
  var rel = function (p) { return String(p).replace(/^chitbridge-(api|web)\//, ''); };
  var stem = function (p) { return String(p).split('/').pop().replace(/\.[a-z]+$/i, '').toLowerCase(); };

  var all = files.concat(routes);

  /**
   * ⚠️⚠️ ONE HOP FURTHER, OR THE CATALOGUE READS AS UNTESTED. No unit test declares `routes/catalogue.js` as
   * its subject — they are written against `lib/catalogue-read.js`, which the route requires. Stopping at the
   * route reported "nothing declares itself a test of that code" for one of the most heavily proved parts of
   * the system: a FALSE gap, which is worse than a silent one because someone acts on it.
   *
   * ⭐ `uses` is a static require edge recorded by assets.cjs — a fact in the source, not a resemblance.
   */
  var mods = [];
  all.forEach(function (p) {
    var a = (rows.filter(function (r) { return r.path === p; })[0] || {});
    (a.uses || []).forEach(function (u) { if (mods.indexOf(u) < 0) mods.push(u); });
  });

  var relSet = {}, stemSet = {};
  all.forEach(function (p) { relSet[rel(p)] = 1; stemSet[stem(p)] = 1; });
  var modSet = {};
  mods.forEach(function (u) { modSet[u] = 1; });

  /**
   * ⭐⭐ EVERY ROW CARRIES THE REASON IT IS THERE. A list of forty-three engine cases under a screen is only
   * useful if the tester can see WHY each one is claimed to be underneath it — "because it tests lib/tax.js,
   * which routes/catalogue.js requires" is checkable; a bare list is something to take on faith.
   */
  var linked = [], named = [];
  (CBTEST.cases || []).forEach(function (c) {
    if (c.menu) return;                       /* a screen case belongs on the Cases tab, not underneath it */
    var key = String(c.case_key || '');
    var sub = c.subjects || [];
    var hit = null;
    sub.forEach(function (x) { if (!hit && relSet[String(x)]) hit = String(x); });
    if (hit) { linked.push({ c: c, why: 'tests ' + hit }); return; }
    sub.forEach(function (x) { if (!hit && modSet[String(x)]) hit = String(x); });
    if (hit) { linked.push({ c: c, why: 'tests ' + hit + ', which this screen\u2019s code requires' }); return; }
    if (relSet[rel(key)] || all.indexOf(key) >= 0) { linked.push({ c: c, why: 'is that file' }); return; }
    var k = key.toLowerCase();
    var w = Object.keys(stemSet).filter(function (x) { return x.length > 4 && k.indexOf(x) >= 0; })[0];
    if (w) named.push({ c: c, why: 'named after ' + w });
  });
  return { files: files, routes: routes, mods: mods, linked: linked, named: named,
           booting: (window.CBGEN || 0) <= 1 };
}

/** the tab number counts only what is actually linked — a name match must not inflate it */
function testBehindCount(code) {
  if (!(CBTEST.cases || []).length) return null;
  var b = testBehindOf(code);
  var n = b.linked.length;
  return n || null;
}

/** ⚠️ session-only: whether a person wants the paths this minute is not a preference about the person */
/**
 * ── ⭐⭐⭐ WHAT THIS TAB IS FOR, IN ONE SENTENCE ────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"the Behind tab — not sure what it is? Can you provide me some information and make it
 * usable?"*
 *
 * ⚠️⚠️ "BEHIND" WAS MY WORD AND IT NAMED THE MECHANISM, NOT THE QUESTION. It is literally what is behind the
 * screen — which is true, and useless to somebody deciding what to test next. The question this answers is the
 * one every test tool in the industry has a word for: **COVERAGE**. Is the code under this screen tested, how
 * much of it, and is any of it red? [[feedback-adopt-dont-reinvent]]
 *
 * ⚠️ THE TAB ID STAYS 'behind'. It is in localStorage under cb_case_area on every machine that has used this
 * panel, and renaming a stored value to tidy a label silently resets a remembered preference — the same rule
 * that kept PNL004 when "Test lab" became "Test Manager".
 *
 * ⭐ AND A VERDICT, NOT JUST FIGURES. "12 of 48 run" is arithmetic; "thinly covered — most of the code under
 * this screen has never been tested" is a judgement somebody can act on, and it is the sentence a tester would
 * have had to work out for themselves every time. ⚠️ The thresholds are stated out loud below rather than
 * hidden in a colour, because a judgement whose rule is invisible cannot be argued with — and it should be.
 */
function testCoverGrade(nTests, nRun, nRed) {
  if (!nTests) {
    return ['Not covered', 'var(--disp,#b4453f)',
      'Nothing here declares itself a test of the code behind this screen. That is not the same as the '
      + 'screen being untested — a case you wrote by hand still counts — but nothing AUTOMATED guards it.'];
  }
  if (nRed) {
    return ['Covered, and red', 'var(--disp,#b4453f)',
      nRed + ' of the ' + nTests + ' test(s) under this screen failed the last time they ran. Everything else '
      + 'on this tab matters less than that.'];
  }
  if (!nRun) {
    return ['Written, never run', 'var(--warn-2,#8a6100)',
      nTests + ' test(s) name this code and not one of them has been run, so the green you see elsewhere is '
      + 'about a different screen.'];
  }
  if (nRun * 2 < nTests) {
    return ['Thinly covered', 'var(--warn-2,#8a6100)',
      'Only ' + nRun + ' of ' + nTests + ' have actually been run — fewer than half. A test that has never '
      + 'run has never told anybody anything.'];
  }
  return ['Covered', 'var(--ok-2,#1B7F4B)',
    nRun + ' of ' + nTests + ' have been run and none of them failed.'];
}

/**
 * ⭐ AND THE GAP IS A THING YOU CAN RAISE, from here, in one press. The old copy said an untested screen was
 * "worth raising as a requirement from this very panel" and gave no way to do it — advice with no control
 * beside it is advice nobody takes. The four boxes are filled the same way the Speed area fills them.
 */
function testCoverRaise(code) {
  var name = codeName(code) || 'this screen';
  var b = testBehindOf(code);
  var n = (b.linked || []).length;
  CBTEST.writeKind = 'req';
  CBTEST.caseArea = 'write';
  try { localStorage.setItem('cb_case_area', 'write'); } catch (_) {}
  if (!CBTEST.writeFor) CBTEST.writeFor = { code: code, name: name };
  screenCasesPaint();
  /* ⚠ after the paint, or the repaint restores the empty values over these */
  var put = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; if (el) testGrow(el); };
  put('wcTitle', 'The code behind ' + code + ' ' + name + ' must be covered by automated tests.');
  put('wcDo', 'Open ' + code + ' ' + name + ' with test mode on and read the Coverage tab.');
  put('wcSee', 'Every file that draws or serves this screen is named by at least one automated test.');
  put('wcGot', n
    ? (n + ' test(s) name this code, but the files it actually uses are '
      + (b.files || []).concat(b.routes || []).join(', ') + '.')
    : ('Nothing declares itself a test of ' + ((b.files || []).concat(b.routes || []).join(', ')
      || 'the code behind this screen') + '.'));
  try { document.getElementById('wcTitle').focus(); } catch (_) {}
}

function testBehindTech() {
  CBTEST.behindTech = !CBTEST.behindTech;
  if (CBTEST.popupFor) screenCasesPaint(); else testPaint();
}
function testBehindHTML(code) {
  var A = (window.CBASSETS || {});
  var rows = A.rows || [];
  var b = testBehindOf(code);
  var asset = function (p) { return rows.filter(function (r) { return r.path === p; })[0] || null; };

  var lab = function (t) { return '<div style="font-size:var(--fs-1);color:var(--grey-2);font-weight:700;'
    + 'letter-spacing:.04em;text-transform:uppercase;margin:11px 0 4px">' + t + '</div>'; };
  var quiet = function (t) { return '<div style="font-size:var(--fs-1);color:var(--note);padding:2px 0">'
    + t + '</div>'; };

  var fileRow = function (p) {
    var a = asset(p);
    return '<div style="font-size:var(--fs-2);padding:2px 0;overflow:hidden;text-overflow:ellipsis;'
      +   'white-space:nowrap">'
      + (a ? '<code style="font-size:var(--fs-1);color:var(--grey-2)">' + testEsc(a.code) + '</code> ' : '')
      + testEsc(p)
      + (a && a.stage ? ' <span style="font-size:var(--fs-1);color:var(--note)">\u00b7 ' + testEsc(a.stage)
          + '</span>' : '')
      + '</div>';
  };

  /* ⭐ the verdict is the whole point of the ask — one badge, the same three colours as everywhere else */
  var caseRow = function (x, warn) {
    var c = x.c, l = (CBTEST.last || {})[c.case_key];
    var st = l ? String(l.status) : '';
    var col = st === 'pass' ? 'var(--ok-2,#1B7F4B)' : st === 'fail' ? 'var(--disp,#B3261E)'
            : st ? 'var(--warn-2,#8a6d00)' : 'var(--note)';
    return '<div style="display:flex;gap:8px;align-items:baseline;padding:4px 0;'
      +   'border-top:1px solid var(--line,#efece4)">'
      + '<span style="flex:1 1 auto;min-width:0">'
      +   '<span style="font-size:var(--fs-2);display:block;overflow:hidden;text-overflow:ellipsis;'
      +     'white-space:nowrap">' + (warn ? '\u26a0\ufe0f ' : '') + testEsc(c.title || c.case_key) + '</span>'
      +   '<span style="font-size:var(--fs-1);color:var(--note);display:block;overflow:hidden;'
      +     'text-overflow:ellipsis;white-space:nowrap">' + testEsc(c.case_key)
      +     (c.test_type ? ' \u00b7 ' + testEsc(c.test_type) : '')
      +     ((c.areas || []).length ? ' \u00b7 ' + testEsc(c.areas.join(', ')) : '') + '</span>'
      +   '<span style="font-size:var(--fs-1);color:var(--note);display:block">\u2937 '
      +     testEsc(x.why) + '</span>'
      + '</span>'
      + '<span style="font-size:var(--fs-1);font-weight:700;flex:0 0 auto;color:' + col + '">'
      +   (l ? testEsc(st.toUpperCase()) : 'not run') + '</span>'
      + '</div>';
  };

  var h = '';

  /* ── 1 · what draws it ── */
  /**
   * ── ⭐⭐⭐ SAY WHAT THIS TAB IS, BEFORE SHOWING ANY OF IT ───────────────────────────────────────────────────
   *
   * Athi, 2026-09-13: *"the next one, Behind 48 — I really don't have a clue about it and I can't make any
   * sense out of this text. You may have to explain me; if something technical then the user doesn't want to
   * see, otherwise interpret it."*
   *
   * ⚠️⚠️ AND HE IS RIGHT: IT OPENED ON FILE PATHS. `cap-catalogue.js`, `routes/products.js` — true, useful to
   * me, meaningless to the person holding the screen. Worse, it opened on them, so the answer he actually
   * wanted — is the ground under this screen tested, and is it green? — sat three sections down.
   *
   * ⭐ SO IT LEADS WITH THE SENTENCE, and the technical detail goes behind a fold. Nothing is removed: the file
   * list is exactly how you find out WHY a screen is untested. It is now something you open rather than
   * something you must read past. [[feedback-write-for-the-shopkeeper]]
   */
  var _nT = (b.linked || []).length, _nRun = 0, _nRed = 0;
  (b.linked || []).forEach(function (x) {
    var l = (CBTEST.last || {})[x.c.case_key];
    if (l) { _nRun++; if (l.status === 'fail') _nRed++; }
  });
  var _g = testCoverGrade(_nT, _nRun, _nRed);

  /* ⭐ THE VERDICT FIRST, in the same three treatments the Speed tab uses — figures, notes, sections. */
  h += testSec('Is the code behind this screen tested?',
    'the files that draw it, the server code it called, and every automated test that names them');
  h += '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;padding:4px 0 2px">'
    + '<b style="font-size:var(--fs-3);color:' + _g[1] + '">' + _g[0] + '</b></div>';
  h += testFigures([
    [_nT || null, 'tests name this code'],
    [_nRun || null, 'have been run'],
    [_nRed || null, 'failed', 'var(--disp,#b4453f)'],
    [b.files.length || null, 'files draw it'],
    [b.routes.length || null, 'server routes answered'],
  ]);
  h += testNotes([_g[2]], _nRed || !_nT ? 'bad' : (_nRun && _nRun * 2 >= _nT ? 'ok' : 'warn'));

  /* ⭐ and the gap is a thing you can raise, from here, rather than advice with no control beside it */
  h += '<div style="margin-top:7px">'
    + '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);padding:3px 10px" '
    + 'onclick="testCoverRaise(\'' + testEsc(code) + '\')">\u270e Raise this as a coverage gap</button>'
    + '</div>';

  /* ⚠️ FOLDED, NOT DELETED. A tester asking "why does the register not know what draws this screen?" needs
     exactly these paths, and answering a complaint about noise by deleting the evidence is not an answer. */
  var _tech = !!CBTEST.behindTech;
  h += '<button onclick="testBehindTech()" style="font:inherit;font-size:var(--fs-1);border:0;padding:0;'
    + 'background:none;cursor:pointer;color:var(--grey-2,#545A61);text-align:start">'
    + (_tech ? '▾ ' : '▸ ')
    + 'The technical detail — which files draw it, which server code answered it</button>';

  if (_tech) {
  h += lab('Draws this screen');
  h += b.files.length ? b.files.map(fileRow).join('')
    : quiet('The register does not say which file draws this screen \u2014 that is a gap in the register, '
      + 'not an answer about this screen.');

  /* ── 2 · what it called ── */
  h += lab('Server code it called');
  h += b.routes.length ? b.routes.map(fileRow).join('')
    : quiet('No API call recorded yet. Use the screen behind this panel and it will appear.');
  /* ⚠ said plainly rather than papered over: on the screen the tester LANDED on, the app’s own start-up
     calls are mixed in with the screen’s, and no honest rule separates them */
  if (b.booting && b.routes.length) {
    h += quiet('⚠️ The app was still starting when this screen loaded, so its sign-in and set-up '
      + 'calls are counted here too. Go to another screen and come back for a clean reading.');
  }

  /* ── 3 · the modules that code leans on ── */
  if (b.mods.length) {
    h += lab('Modules underneath \u00b7 ' + b.mods.length);
    /* ⚠️ a route can require thirty modules; printed in full this becomes the whole area and buries the
       verdicts below it, which are what the tester came for */
    h += '<div style="font-size:var(--fs-1);color:var(--grey-2);line-height:1.6;'
      +   'word-break:break-word">' + b.mods.slice(0, 18).map(testEsc).join(' \u00b7 ')
      +   (b.mods.length > 18 ? ' \u00b7 \u2026and ' + (b.mods.length - 18) + ' more' : '') + '</div>';
  }

  }   /* ── end of the technical fold ── */

  /* ── 4+5 · the linked cases, with their standing ── */
  var linked = b.linked;
  var tally = { pass: 0, fail: 0, other: 0, none: 0 };
  linked.forEach(function (x) {
    var l = (CBTEST.last || {})[x.c.case_key];
    if (!l) tally.none++; else if (l.status === 'pass') tally.pass++;
    else if (l.status === 'fail') tally.fail++; else tally.other++;
  });
  /**
   * ⭐⭐ FAILING FIRST, THEN NEVER RUN, THEN PASSING. Sorted by case key this list opens on whatever happens
   * to start with "a" — and the one red line sits at row thirty-one. A tester looks at this area to find out
   * whether the ground under the screen is solid; the answer belongs at the top.
   */
  var rank = { fail: 0, blocked: 1, na: 2 };
  linked = linked.slice().sort(function (p, q) {
    var lp = (CBTEST.last || {})[p.c.case_key], lq = (CBTEST.last || {})[q.c.case_key];
    var rp = lp ? (rank[lp.status] === undefined ? 4 : rank[lp.status]) : 3;
    var rq = lq ? (rank[lq.status] === undefined ? 4 : rank[lq.status]) : 3;
    return rp - rq || (p.c.case_key < q.c.case_key ? -1 : 1);
  });

  h += lab('Tests underneath it \u00b7 ' + linked.length);
  if (!linked.length) {
    h += quiet('Nothing declares itself a test of that code. \u26a0\ufe0f That is a real coverage finding \u2014 '
      + 'worth raising as a requirement from this very panel.');
  } else {
    h += '<div style="font-size:var(--fs-1);color:var(--grey-2);padding:0 0 4px">'
      + '<b style="color:var(--ok-2,#1B7F4B)">' + tally.pass + '</b> passing \u00b7 '
      + '<b' + (tally.fail ? ' style="color:var(--disp,#B3261E)"' : '') + '>' + tally.fail + '</b> failing \u00b7 '
      + '<b>' + (tally.none + tally.other) + '</b> not passing yet</div>';
    h += linked.slice(0, 40).map(function (c) { return caseRow(c, false); }).join('');
    if (linked.length > 40) h += quiet('\u2026 and ' + (linked.length - 40) + ' more, further down the same order. The full board is in the Test lab.');
  }

  /* ── 5 · the weak rung, kept apart and marked ── */
  if (b.named.length) {
    h += lab('Named after that code \u00b7 ' + b.named.length);
    h += quiet('\u26a0\ufe0f Matched on the WORD in the file name, not on a declared link. Read these as leads. '
      + 'They are counted nowhere above.');
    h += b.named.slice(0, 25).map(function (c) { return caseRow(c, true); }).join('');
    if (b.named.length > 25) h += quiet('\u2026 and ' + (b.named.length - 25) + ' more.');
  }
  return h;
}

function testDiagMark() { CBTEST._diagFrom = (window.CBCALLS || []).length ? (CBCALLS[0].rid || null) : null;
  CBTEST._diagAt = Date.now(); }

/**
 * ── ⭐⭐⭐ WHEN DID THIS READING START, AND IS IT GETTING WORSE? ──────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"is it for this read? when I click a catalogue item? or is it the measure previously
 * taken — if it is for the current access, can you write down the time when it started so people know it is
 * for the current read? I am not able to understand that."*
 *
 * ⚠️⚠️ A NUMBER WITH NO WINDOW IS NOT A MEASUREMENT. "24 API calls" is unreadable until you know 24 since
 * WHEN, and a reader who cannot tell will — rightly — not trust any of it. The window now carries a clock
 * time and says what opened it.
 *
 * ⭐⭐ AND THE SECOND HALF OF THE QUESTION IS THE BETTER ONE: *"if we make a note of the longest time taken
 * and compare it with the next read for a few consecutive reads, and if the same call takes more time, then
 * we have to raise an incident to optimise the call."* That is a REGRESSION TEST for speed, and it is the
 * thing a one-off reading can never be. Every visit is now kept, so the fourth visit can be held against the
 * first three.
 *
 * ⚠️ KEPT PER SHOP AND ONLY IN THIS BROWSER — [[feedback-shop-scoped-local-store]]. It is a working note for
 * a tester, not a monitoring history, and it must never be quoted as one.
 */
var VISITS_KEY = 'cb_speed_visits';
function testVisitsKey() {
  try { return (typeof uk === 'function') ? uk(VISITS_KEY) : VISITS_KEY; } catch (_) { return VISITS_KEY; }
}
function testVisitsGet() {
  try { return JSON.parse(localStorage.getItem(testVisitsKey()) || '{}') || {}; } catch (_) { return {}; }
}

/**
 * ⚠️ THE VISIT IN PROGRESS IS UPDATED, NOT APPENDED. This runs on every paint of the Speed area, and a
 * tester who opens it three times during one visit must not turn that visit into three. The generation is
 * the identity of a visit, so it is the key.
 */
function testVisitSave(code, gen, mine) {
  if (!code || !gen) return;
  try {
    var all = testVisitsGet();
    var list = all[code] || [];
    var worst = {};
    mine.forEach(function (c) {
      var k = c.key || (c.m + ' ' + String(c.path || '').split('?')[0]);
      if (!worst[k] || (c.ms || 0) > worst[k]) worst[k] = (c.ms || 0);
    });
    var row = {
      gen: gen,
      at: (list.filter(function (x) { return x.gen === gen; })[0] || {}).at || Date.now(),
      n: mine.length,
      ms: mine.reduce(function (a, c) { return a + (c.ms || 0); }, 0),
      worst: worst,
    };
    list = list.filter(function (x) { return x.gen !== gen; });
    list.push(row);
    /* eight is enough to see a trend and small enough that nobody has to think about the storage */
    all[code] = list.slice(-8);
    localStorage.setItem(testVisitsKey(), JSON.stringify(all));
    return all[code];
  } catch (_) { return null; }
}

/**
 * ⭐⭐ THE CALL THAT IS GETTING SLOWER, WHICH IS THE ONE WORTH RAISING.
 *
 * ⚠️ AGAINST THE BEST EARLIER VISIT, not the previous one. One slow visit — a cold cache, a laptop waking
 * up, somebody else on the wifi — would otherwise make the NEXT visit look like an improvement and hide a
 * real regression behind it. The best time this call has ever managed is the honest thing to fail against.
 *
 * ⚠️ AND IT NEEDS BOTH A RATIO AND AN ABSOLUTE. 40 ms becoming 90 ms is a doubling and is nothing; the floor
 * stops the panel crying about noise, which is the fastest way to make a tester stop reading it.
 */
function testSlowerThanBefore(history, gen) {
  var now = (history || []).filter(function (x) { return x.gen === gen; })[0];
  var past = (history || []).filter(function (x) { return x.gen !== gen; });
  if (!now || past.length < 2) return [];
  var out = [];
  Object.keys(now.worst || {}).forEach(function (k) {
    var best = null;
    past.forEach(function (p) {
      var v = (p.worst || {})[k];
      if (v != null && (best === null || v < best)) best = v;
    });
    if (best === null || best < 40) return;
    var mine = now.worst[k];
    if (mine >= best * 2 && mine - best >= 300) out.push({ key: k, was: best, now: mine });
  });
  return out.sort(function (a, b) { return (b.now - b.was) - (a.now - a.was); });
}

/**
 * ── ⭐⭐⭐ START AGAIN, AND SAY THAT YOU DID ──────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"we have to have a mechanism of clearing the earlier measure in the speed, so we know
 * that we are doing a fresh measure — so we must introduce a button to clear the existing data, and show
 * that the existing measures are cleared and take a fresh sample."*
 *
 * ⚠️⚠️ HE IS DESCRIBING THE FAULT AT THE HEART OF EVERY MEASUREMENT I HAVE TAKEN TODAY. The log holds the
 * last forty calls of the session; the visit filter narrows it, the clock line says when the visit began —
 * and none of that tells a person whether what they are looking at is the run they JUST did. I read a stale
 * window three times this morning and drew a conclusion from it each time.
 *
 * ⭐ SO CLEARING IS AN EVENT WITH A TIME ON IT, not an absence. After it the area says what was thrown away
 * and when, and keeps saying so until the first new call arrives — because an empty panel and a panel that
 * has been emptied look identical, and only one of them means "go and do something".
 *
 * ⚠️ THE STORED VISITS GO TOO. Leaving them would let "slower than it has been" compare a fresh sample
 * against history the tester believes they just deleted — a red warning sourced from data that is not on
 * the screen is the worst thing this area could do.
 */
/**
 * ── ⭐⭐⭐ WHICH SCREEN EATS THE TIME ─────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"the way speed works is, I move around every different screen and the speed makes a
 * note of every call being done and which API uses more effort — that is the accumulated one. On the top it
 * shows for that particular screen for that moment. So we know the overall performance and also which screen
 * eats more time?"*
 *
 * ⭐ THE FIRST TWO HALVES WERE RIGHT AND THE THIRD WAS NOT. The by-API roll-up says which ROUTE is expensive
 * and which screens asked for it; the reading at the top is this visit to this screen. But NOTHING ranked the
 * screens against each other, so "which screen eats more time" could only be answered by walking to each one
 * and reading its top line — and by then the earlier ones have fallen out of the forty-call log.
 *
 * ⚠️⚠️ AND THE VISIT WAS ONLY RECORDED IF SOMEBODY OPENED SPEED ON THAT SCREEN, because the save happened
 * while drawing the area. So the one table meant to compare screens would only ever hold the screens you had
 * already gone looking at — the ones you suspected — which is the opposite of what a survey is for.
 *
 * ⭐ So the visit is now stamped from the CHIP, which test mode puts on every screen. Walk the product once
 * and the table is filled in behind you.
 *
 * ⚠️ WRITTEN ONLY WHEN THE FIGURES MOVE. This runs on every paint, and a localStorage write per paint would
 * be a performance tool that costs performance.
 */
function testVisitTouch(code) {
  try {
    if (!CBTEST.on || !code) return;
    var gen = window.CBGEN || 0;
    if (!gen) return;
    var mine = (window.CBCALLS || []).filter(function (c) {
      return !/^\/api\/testing/i.test(String(c.path || '')) && (!c.gen || c.gen === gen);
    });
    if (!mine.length) return;
    var sig = code + ':' + gen + ':' + mine.length + ':' + mine.reduce(function (a, c) { return a + (c.ms || 0); }, 0);
    if (CBTEST._visitSig === sig) return;
    CBTEST._visitSig = sig;
    testVisitSave(code, gen, mine);
  } catch (_) {}
}

/**
 * ⭐⭐ EVERY SCREEN VISITED IN TEST MODE, RANKED. Not the last forty calls — this is kept per screen and
 * survives them falling out of the log, which is the whole reason a survey needs storage.
 *
 * ⚠️ BY THE WORST VISIT, NOT THE LAST. A screen that is usually quick and occasionally terrible is exactly
 * the one worth finding, and the last reading hides it half the time.
 */
function testDiagByScreen() {
  var all;
  try { all = testVisitsGet(); } catch (_) { return ''; }
  var codes = Object.keys(all || {});
  if (codes.length < 2) return '';   /* one screen is not a comparison */
  var rows = codes.map(function (c) {
    var v = all[c] || [];
    var worst = 0, last = null, calls = 0;
    v.forEach(function (x) { if ((x.ms || 0) > worst) { worst = x.ms || 0; calls = x.n || 0; } });
    last = v[v.length - 1] || null;
    return { code: c, name: (typeof codeName === 'function' && codeName(c)) || '', visits: v.length,
             worst: worst, worstCalls: calls, last: last ? last.ms : null };
  }).sort(function (a, b) { return b.worst - a.worst; });

  var h = '<div style="font-size:var(--fs-1);color:var(--grey-2);font-weight:700;letter-spacing:.04em;'
    + 'text-transform:uppercase;margin:14px 0 3px">Every screen you have measured</div>'
    + '<div style="font-size:var(--fs-1);color:var(--note);margin-bottom:5px">'
    + 'Kept per screen, so it survives the forty-call log. Worst visit first \u2014 a screen that is usually '
    + 'quick and occasionally terrible is the one worth finding.</div>';
  h += '<table style="width:100%;border-collapse:collapse;font-size:var(--fs-2)">'
    + '<tr style="color:var(--grey-2,#545A61);font-size:var(--fs-1)">'
    + '<th style="text-align:start;padding:3px 6px 3px 0">Screen</th>'
    + '<th style="text-align:end;padding:3px 6px">Visits</th>'
    + '<th style="text-align:end;padding:3px 6px">Worst</th>'
    + '<th style="text-align:end;padding:3px 6px">Last</th></tr>';
  h += rows.map(function (r) {
    var hot = r.worst > 8000;
    return '<tr style="border-top:1px solid var(--line,#efece4)'
      + (r.code === CBTEST.popupFor ? ';background:var(--paper,#faf8f3)' : '') + '">'
      + '<td style="padding:4px 6px 4px 0"><code style="font-size:var(--fs-1);color:var(--grey-2)">'
      +   testEsc(r.code) + '</code> ' + testEsc(r.name)
      +   (r.worstCalls ? ' <span style="font-size:var(--fs-1);color:var(--note)">' + r.worstCalls
        + ' calls</span>' : '') + '</td>'
      + '<td style="text-align:end;padding:4px 6px">' + r.visits + '</td>'
      + '<td style="text-align:end;padding:4px 6px;font-weight:' + (hot ? '700' : '400')
      +   ';color:' + (hot ? 'var(--disp,#B3261E)' : 'inherit') + '">' + r.worst + '</td>'
      + '<td style="text-align:end;padding:4px 6px;color:var(--grey-2)">'
      +   (r.last == null ? '\u2014' : r.last) + '</td></tr>';
  }).join('');
  return h + '</table>';
}

/**
 * ── ⚠️⚠️ "IS CLEAR NOT CLEARING EVERY SCREEN YOU HAVE MEASURED?" ──────────────────────────────────────────
 *
 * Athi, 2026-09-13, and no, it was not — and the button did not say so. It emptied the call log (which is
 * every screen) but deleted the saved visits of THIS SCREEN ONLY, so the by-screen roll-up kept every other
 * screen’s history. "Clear and measure again" then meant two different things in one press, and the roll-up
 * underneath went on quoting numbers from before the clear.
 *
 * ⭐ TWO BUTTONS, EACH SAYING WHICH IT IS. `scope` is ‘screen’ or ‘all’, and the toast repeats the choice
 * back — a destructive action that leaves you guessing what it destroyed gets pressed once and never again.
 *
 * ⭐ AND IT IS ALREADY YOURS ALONE, which was the other question. `CBCALLS` lives in this tab’s memory and
 * dies with it; the saved visits go through `uk()`, which keys localStorage by `SESSION.actorId` (or the
 * entity when there is no co-assist) — and localStorage is per browser besides. Two people testing cannot
 * reach each other’s readings, and clearing yours cannot touch theirs.
 */
function testDiagClear(scope) {
  var code = CBTEST.popupFor;
  var everything = scope === 'all';
  var had = ((window.CBCALLS || []).length) || 0;
  var hadVisits = 0;
  try {
    var all = testVisitsGet();
    if (everything) {
      Object.keys(all).forEach(function (k) { hadVisits += ((all[k] || []).length) || 0; });
      localStorage.setItem(testVisitsKey(), '{}');
    } else {
      hadVisits = ((all[code] || []).length) || 0;
      delete all[code];
      localStorage.setItem(testVisitsKey(), JSON.stringify(all));
    }
  } catch (_) {}
  /* ⚠ emptied IN PLACE: core.js holds this same array and a fresh one would leave it writing to the old */
  try { if (window.CBCALLS) window.CBCALLS.length = 0; } catch (_) {}
  CBTEST.openCall = null;
  CBTEST._clearedAt = Date.now();
  /**
   * ⚠️ THE CLEAR BELONGS TO THE VISIT IT HAPPENED IN. Without this the banner outlives it: walk to another
   * screen and back, and the reading is a NEW visit’s calls under a line still claiming to be measured from
   * a clear two screens ago. A window label that is wrong is worse than no label — it is the same fault as
   * the panel-open mark this area started the day with, and it would have shipped again.
   */
  CBTEST._clearedGen = window.CBGEN || 0;
  CBTEST._clearedWhat = { calls: had, visits: hadVisits, all: everything };
  screenCasesPaint();
  if (typeof toast === 'function') {
    toast(everything ? 'Cleared every screen \u2014 measuring from now.'
      : 'Cleared this screen \u2014 measuring from now.');
  }
}

function testDiagHTML() {
  /* ⚠ the tester’s own tool is not part of what the screen cost — reading the board and saving a verdict
     are the measurement, and a measurement that counts itself is not one */
  var all = (window.CBCALLS || []).filter(function (c) {
    return !/^\/api\/testing/i.test(String(c.path || ''));
  });
  if (!all.length) {
    if (testDiagCleared()) {
      var w = CBTEST._clearedWhat || {};
      return '<div style="margin:8px 0;padding:8px 10px;border-inline-start:3px solid var(--ok-2,#1B7F4B);'
        + 'background:var(--ok-tint,#eaf4ee);border-radius:0 8px 8px 0;font-size:var(--fs-1);line-height:1.5">'
        + '<b>Cleared at ' + new Date(CBTEST._clearedAt).toTimeString().slice(0, 8) + '.</b> '
        + 'Threw away ' + (w.calls || 0) + ' recorded call(s)'
        + (w.visits ? ' and ' + w.visits + ' earlier visit(s) to this screen' : '') + '.<br>'
        + 'Nothing has been measured since. Use the screen behind this panel and the fresh sample '
        + 'appears here.</div>'
        + testDiagBarHTML();
    }
    return '<div style="font-size:var(--fs-1);color:var(--note);padding:8px 0">'
      + 'No API call has been recorded yet. Do something on the screen behind this panel and it will '
      + 'appear here \u2014 the log starts when test mode goes on.</div>';
  }
  /**
   * ── ⚠️⚠️⚠️ IT WAS MEASURING EVERYTHING EXCEPT THE THING YOU WANT MEASURED ─────────────────────────────
   *
   * The mark was dropped when the PANEL opened, and the panel opens after the screen has already loaded. So
   * every call the screen made to draw itself sat below the mark and was excluded, and the reading on
   * opening was "1 API call \u00b7 Few enough round trips" — of a screen that had just made nine.
   *
   * ⚠️ WRONG IN THE FLATTERING DIRECTION, for the third time in this tool. A diagnostic that reports every
   * screen as cheap is worse than no diagnostic: it is an argument against looking.
   *
   * ⭐ THE VISIT IS THE RIGHT WINDOW, and it is the one the Behind area already uses — the calls made since
   * the tester arrived on this screen, which is exactly what "what this screen cost" means.
   */
  var gen = window.CBGEN || 0;
  var mine = gen ? all.filter(function (c) { return !c.gen || c.gen === gen; }) : all.slice();
  if (!mine.length) mine = all.slice(0, 1);

  var total = mine.reduce(function (a, c) { return a + (c.ms || 0); }, 0);
  var slow = mine.slice().sort(function (a, b) { return (b.ms || 0) - (a.ms || 0); })[0] || {};
  var bad = mine.filter(function (c) { return (c.status || 0) >= 400; });

  /* ⭐ the reading in words first: a table of numbers is a thing to interpret, a sentence is a thing to act on */
  /**
   * ── ⭐⭐ THE SAME CALL, OVER AND OVER, IS THE FINDING ───────────────────────────────────────────────────
   *
   * Nine rows in a table is a thing to read. "defList ×5" is a thing to FIX, and it is the fault this
   * codebase actually has — measured on the Catalogue 2026-09-12: nine calls, 4419 ms, five of them the same
   * list fetched five times. A person scanning a table misses that; a sentence cannot be missed.
   */
  var seenN = {}, rep = [];
  mine.forEach(function (c) {
    var k = c.key || (c.m + ' ' + String(c.path || '').split('?')[0]);
    seenN[k] = (seenN[k] || 0) + 1;
  });
  Object.keys(seenN).forEach(function (k) {
    if (seenN[k] > 1) rep.push(k + ' \u00d7' + seenN[k]);
  });

  var verdict = mine.length >= 6 ? 'That is a lot of round trips for one screen.'
            : mine.length >= 3 ? 'Three or more round trips \u2014 worth asking whether they can be one.'
            : 'Few enough round trips.';
  /* ⭐ the window, in words and on a clock, because a count with no window is not a measurement */
  var hist = testVisitSave(CBTEST.popupFor, gen, mine) || [];
  var thisVisit = hist.filter(function (x) { return x.gen === gen; })[0];
  var began = thisVisit && thisVisit.at ? new Date(thisVisit.at) : null;
  var clock = began ? began.toTimeString().slice(0, 8) : null;

  /* the split the server makes possible: time in the database, and time getting there and back */
  var srvKnown = mine.filter(function (c) { return c.srv != null; });
  var srvMs = srvKnown.reduce(function (a, c) { return a + (c.srv || 0); }, 0);
  var dbTrips = mine.reduce(function (a, c) { return a + (c.trips || 0); }, 0);

  /* ⭐ the reset sits ABOVE the numbers: a clear button found under a page of figures is found after
     you have already believed them */
  var h = testDiagBarHTML();

  /* ── FIGURES: what the reading IS ─────────────────────────────────────────────────────────────────────── */
  h += testSec('This visit to the screen',
    testDiagCleared()
      ? 'measured from the clear at <b>' + new Date(CBTEST._clearedAt).toTimeString().slice(0, 8)
        + '</b>, not from when you arrived'
      : (clock ? 'everything since you arrived at <b>' + clock + '</b> — leaving and coming back starts a new one'
               : 'everything since you arrived on this screen'));
  h += testFigures([
    [mine.length, 'API calls'],
    [total + ' ms', 'in total'],
    [slow.key ? ((slow.ms || 0) + ' ms') : null, 'slowest · ' + testEsc(slow.key || '')],
    [bad.length || null, 'failed', 'var(--disp,#B3261E)'],
    [srvKnown.length ? (srvMs + ' ms') : null, 'inside the server'],
    [srvKnown.length ? (Math.max(0, total - srvMs) + ' ms') : null, 'on the network'],
    [dbTrips || null, 'database trips'],
  ]);

  /**
   * ── NOTES: what it MEANS, and what to do about it ─────────────────────────────────────────────────────
   *
   * ⚠️ ORDERED BY WHAT IT ASKS OF THE READER, not by where the code happened to compute it. A finding they
   * can act on comes before a caveat about the reading, which comes before the standing fact about round
   * trips — and the standing fact is last because it is true on every screen and so tells you nothing about
   * this one.
   */
  var findings = [];
  if (rep.length) {
    findings.push('<b>The same call, repeated:</b> ' + testEsc(rep.join(' · '))
      + ' — that is the thing to fix, not the milliseconds.');
  }
  if (bad.length) findings.push('<b>' + bad.length + ' call(s) failed.</b> A failed call is not a slow call.');
  h += testNotes(findings, 'bad');

  var caveats = [];
  if ((window.CBGEN || 0) <= 1) {
    caveats.push('The app was still starting, so its sign-in and set-up calls are counted here too. '
      + 'Go to another screen and come back for a clean reading.');
  }
  if (!srvKnown.length) {
    caveats.push('The server is not reporting its own time, so this cannot be split into database, code and '
      + 'network. Turn on <b>Timings</b> at the top right.');
  }
  h += testNotes(caveats, 'warn');

  h += testNotes([verdict,
    'Each call is roughly 1.4–2.4 s to the database and back, so the <b>count</b> matters more than the '
      + 'milliseconds.'], 'note');

  h += testSec('Every call, slowest first');

  h += '<table style="width:100%;border-collapse:collapse;font-size:var(--fs-2)">'
    + '<tr style="text-align:start;color:var(--grey-2,#545A61);font-size:var(--fs-1)">'
    + '<th style="text-align:start;padding:3px 6px 3px 0">Call</th>'
    + '<th style="text-align:start;padding:3px 6px">Path</th>'
    + '<th style="text-align:end;padding:3px 6px">ms</th>'
    + (srvKnown.length ? '<th style="text-align:end;padding:3px 6px" title="time inside the server, and '
        + 'the database round trips it made">server</th>' : '')
    + '<th style="text-align:end;padding:3px 6px">Status</th></tr>';
  h += mine.map(function (c) {
    var ok = (c.status || 0) < 400;
    return '<tr style="border-top:1px solid var(--line,#efece4)">'
      + '<td style="padding:4px 6px 4px 0">'
      +   '<button onclick="testCallOpen(' + "'" + testEsc(c.rid || '') + "'" + ')" '
      +     'title="See the real call" style="font:inherit;font-size:var(--fs-1);background:none;'
      +     'border:0;padding:0;cursor:pointer;color:var(--grey-2);text-decoration:underline;'
      +     'text-underline-offset:2px"><code>' + testEsc(c.key) + '</code></button></td>'
      + '<td style="padding:4px 6px;font-size:var(--fs-1);color:var(--grey-2);max-width:16em;'
      +   'overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + testEsc(c.path || '') + '">'
      +   testEsc(c.m + ' ' + (c.path || '')) + '</td>'
      + '<td style="text-align:end;padding:4px 6px;font-weight:' + ((c.ms || 0) > 1500 ? '700' : '400')
      +   ';color:' + ((c.ms || 0) > 1500 ? 'var(--disp,#B3261E)' : 'inherit') + '">' + (c.ms || 0) + '</td>'
      + (srvKnown.length
        ? '<td style="text-align:end;padding:4px 6px;color:var(--grey-2);font-size:var(--fs-1)">'
          + (c.srv == null ? '\u2014' : c.srv + (c.trips ? ' / ' + c.trips + ' trip' : '')) + '</td>'
        : '')
      + '<td style="text-align:end;padding:4px 6px;color:'
      +   (ok ? 'var(--ok-2,#1B7F4B)' : 'var(--disp,#B3261E)') + '">' + (c.status || '\u2014') + '</td>'
      + '</tr>'
      /* ⭐ the detail lands UNDER its own row, spanning the table, so the reading keeps its place */
      + (CBTEST.openCall && CBTEST.openCall === c.rid
        ? '<tr><td colspan="' + (srvKnown.length ? 5 : 4) + '">' + testCallDetailHTML(c) + '</td></tr>'
        : '');
  }).join('');
  /* ⚠ the correlation id is the thing that joins this to the server's own line — quoted, never invented */
  h += '</table>'
    + '<div style="font-size:var(--fs-1);color:var(--note);padding:7px 0 0">'
    + 'Quote a call\u2019s id when reporting it: ' + testEsc((mine[0] && mine[0].rid) || '\u2014')
    + ' \u2014 the server logged the same one.</div>';

  /**
   * ── ⭐⭐ THE SAME SCREEN, READ AGAIN AND AGAIN ─────────────────────────────────────────────────────────
   *
   * One reading tells you what happened once. Four readings of the same screen tell you whether the product
   * is getting slower, which is the only version of this a person can act on.
   */
  var past = hist.filter(function (x) { return x.gen !== gen; }).slice().reverse();
  if (past.length) {
    h += '<div style="font-size:var(--fs-1);color:var(--grey-2);font-weight:700;letter-spacing:.04em;'
      + 'text-transform:uppercase;margin:13px 0 3px">Earlier visits to this screen</div>'
      + '<div style="font-size:var(--fs-1);color:var(--grey-2)">'
      + past.map(function (p) {
          return '<span style="white-space:nowrap">' + new Date(p.at).toTimeString().slice(0, 5)
            + ' \u00b7 <b>' + p.ms + ' ms</b> (' + p.n + ')</span>';
        }).join(' &nbsp; ')
      + '</div>';
  }

  var slower = testSlowerThanBefore(hist, gen);
  if (slower.length) {
    h += '<div style="margin-top:8px;padding:7px 9px;border-inline-start:3px solid var(--disp,#B3261E);'
      + 'background:var(--danger-tint,#fbeceb);border-radius:0 8px 8px 0;font-size:var(--fs-1)">'
      + '<b>Slower than it has been:</b><br>'
      + slower.map(function (x) {
          return testEsc(x.key) + ' \u2014 <b>' + x.now + ' ms</b> now, best was ' + x.was + ' ms';
        }).join('<br>')
      + '<br><span style="color:var(--grey-2)">Measured against the BEST earlier visit, not the last one: '
      + 'one slow visit would otherwise hide the next regression behind it. Worth raising.</span></div>';
  }

  /* ⭐ and the other question: not what this screen cost, but which route is expensive everywhere */
  /* ⚠️ the trace control moved into the bar at the top (testTraceChip) — it was rendering here, in the
     middle of the numbers, at three different heights depending on what it had loaded. */
  h += testSec('Where the time went', 'read from the browser and the server \u2014 nothing here is estimated');
  h += testDiagLayersHTML(mine);
  h += testSec('By call', 'which route is expensive everywhere, not just on this screen');
  h += testDiagByApi();
  h += testSec('By screen', 'every screen you have measured, worst first');
  h += testDiagByScreen();


  /**
   * ── ⭐⭐ A MEASUREMENT NOBODY CAN RAISE IS A MEASUREMENT NOBODY RAISES ─────────────────────────────────
   *
   * I filed the Catalogue’s nine calls as INC-260912-J89Q by reading these numbers off the screen and
   * typing them into the form by hand. A tester will not do that, and if they do they will round it, and the
   * incident will read "the catalogue feels slow" — which is unactionable, and is what every slow-screen
   * report in every product says.
   *
   * ⚠️ IT FILES NOTHING. It fills the four boxes and leaves the tester on Create, with the type chip still
   * theirs to set — whether this is an incident or a requirement is a judgement, and so is the wording.
   */
  /**
   * \u26a0\ufe0f THESE TWO USED TO SIT HERE, AT THE FOOT OF THE READING. Athi, 2026-09-13: *"Write this up and Snapshot
   * have to be on the top as a chip with clear instruction \u2014 these options are not going to change, so let
   * them be on the top."* They are in `testDiagBarHTML()` now, with the two clears; see the note there.
   */
  return h;
}

/**
 * ⭐ THE SAME NUMBERS THE AREA JUST SHOWED, IN THE TESTER’S FOUR BOXES. Recomputed rather than scraped out
 * of the HTML: a reading that can drift from the table above it is worse than no button.
 *
 * ⚠️ The expectation is deliberately a ROUND, ARGUABLE number — "two or three calls" — not the measurement
 * turned into a rule. A requirement that says "fewer than 9" is just the bug written down as the target.
 */
/**
 * ── ⭐⭐⭐ WHICH API COST WHAT, AND WHO ASKED FOR IT ─────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"do we have an HTML link to see which API has taken this much? or which product line
 * etc."*
 *
 * ⭐⭐ THE TABLE ABOVE ANSWERS "what did THIS screen cost". This answers the other question, which is the one
 * you act on: across everything done in this session, WHICH ROUTE is expensive, and WHICH SCREENS are the
 * ones paying for it. A route that is slow but called once is a curiosity; a route that is slow and called
 * from four screens is the next piece of work.
 *
 * ⚠️⚠️ IT IS THIS SESSION ONLY, AND IT SAYS SO. `CBCALLS` holds the last forty calls in this browser tab. It
 * is not a monitor and must never be read as one — "the slowest API in the product" is a claim this data
 * cannot support, and the moment somebody quotes it as though it could, the number does harm. A real answer
 * needs the SERVER to keep its own timings; that is written up in the backlog, not faked here.
 *
 * ⭐ The route is named by its ASSET CODE (API007) as well as its path, so a finding here can be carried
 * straight into the register, the CMDB panel, and the Behind area — one identity for one file, everywhere.
 */
/**
 * ── ⭐⭐⭐ THE REAL CALL, WITHOUT OPENING THE BROWSER’S TOOLS ─────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"assume the trace tool in the browser itself can showcase, then we have to open that?
 * as I am not a techie, I am asking all these questions, but you know better. Give the best."*
 *
 * ⭐⭐ THE BEST IS NOT TO SEND HIM TO DEVTOOLS. The Network tab has everything and it is the wrong answer:
 * it is a different window, it only shows what happened AFTER it was opened, and none of it can be attached
 * to an incident. Everything needed is already in `CBCALLS` — what was sent, what came back, the status,
 * the correlation id, the server’s own time. A row that opens is a trace tool that a shopkeeper can use.
 *
 * ⚠️ THE RESPONSE IS CAPPED AT 1200 CHARACTERS and says so where it is cut. A pane that quietly truncates
 * teaches you to believe a short answer was the whole answer.
 */
function testCallOpen(rid) {
  CBTEST.openCall = (CBTEST.openCall === rid ? null : rid);
  screenCasesPaint();
}

function testCallDetailHTML(c) {
  var pre = 'margin:3px 0 0;padding:6px 8px;background:var(--paper,#faf8f3);'
    + 'border:1px solid var(--line,#efece4);border-radius:7px;font-size:var(--fs-1);'
    + 'white-space:pre-wrap;word-break:break-all;max-height:11em;overflow:auto';
  var lab = function (t) { return '<div style="font-size:var(--fs-1);color:var(--note);margin-top:5px">'
    + t + '</div>'; };

  var h = '<div style="padding:6px 2px 9px">';
  h += lab('Asked for') + '<div style="' + pre + '">' + testEsc(c.m + ' ' + (c.path || '')) + '</div>';
  if (c.q && Object.keys(c.q).length) {
    h += lab('Parameters') + '<div style="' + pre + '">' + testEsc(JSON.stringify(c.q, null, 1)) + '</div>';
  }
  if (c.sent) {
    h += lab('Sent (secrets removed)') + '<div style="' + pre + '">' + testEsc(c.sent) + '</div>';
  }
  if (c.body) {
    h += lab('Came back' + (c.body.length >= 1200 ? ' \u2014 first 1200 characters only' : ''))
      + '<div style="' + pre + '">' + testEsc(c.body) + '</div>';
  }
  h += lab('Identity')
    + '<div style="' + pre + '">' + testEsc('id ' + (c.rid || '\u2014')
        + '  \u00b7  status ' + (c.status || '\u2014')
        + '  \u00b7  ' + (c.ms || 0) + ' ms total'
        + (c.srv != null ? '  \u00b7  ' + c.srv + ' ms in the server' : '')
        + (c.trips != null ? '  \u00b7  ' + c.trips + ' database trip(s)' : '')
        + (c.at ? '  \u00b7  ' + new Date(c.at).toTimeString().slice(0, 8) : '')) + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--note);margin-top:4px">'
    + 'The server logged the same id \u2014 quote it and the two records join up.</div>';
  return h + '</div>';
}

/**
 * ── ⭐⭐⭐ THE THING A TANDEM WOULD HAVE CALLED A DUMP ────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"I have seen in Tandem machines, when a failure happens or when I want to take a
 * snapshot of the issue, it takes the memory dump, and I can just play the memory dump to see where the
 * issue is. Are we having such a facility?"*
 *
 * ⚠️ NOT A MEMORY DUMP, AND CALLING IT ONE WOULD BE A LIE. A browser cannot hand over its heap, and even if
 * it could, nothing here could replay it. What a Tandem dump actually GAVE you was everything the machine
 * knew at the moment it fell over, in one file, without asking the operator to have been watching. That
 * part is entirely buildable and this is it:
 *
 *   every call of this visit — asked for, sent, came back, status, timings, correlation id
 *   every error the page threw, including the ones nobody had a console open for
 *   where and when — screen, route, build, browser, viewport, the clock
 *   what the app thought it was showing — the current record and selection, not the whole heap
 *
 * ⭐ ONE FILE, ATTACHED TO THE INCIDENT. "Playing it back" is opening it: it is JSON, every line is a fact
 * with a time against it, and it can be read six months later by someone who was not there.
 *
 * ⚠️ WHAT IT IS NOT: a session replay. Watching the tester’s clicks back as a film needs a recorder running
 * all the time, and that is a different order of cost and of consent. Written up rather than half-built.
 */
function testDumpBuild() {
  var gen = window.CBGEN || 0;
  var all = (window.CBCALLS || []).filter(function (c) {
    return !/^\/api\/testing/i.test(String(c.path || ''));
  });
  var mine = gen ? all.filter(function (c) { return !c.gen || c.gen === gen; }) : all.slice();
  var env = (typeof testEnv === 'function') ? testEnv() : {};
  var ui = {};
  try {
    ui = { nav: (typeof UI !== 'undefined' ? UI.nav : null),
           selected: (typeof UI !== 'undefined' ? (UI.sel || null) : null),
           state: (typeof UI !== 'undefined' ? (UI.state || null) : null),
           rows: (typeof UI !== 'undefined' && UI.rows ? UI.rows.length : null) };
  } catch (_) {}
  return {
    what: 'ChitBridge failure snapshot \u2014 everything the page knew at this moment',
    taken_at: new Date().toISOString(),
    screen: CBTEST.popupFor || null,
    where: env,
    visit: gen,
    app: ui,
    errors: (window.CBERRS || []).slice(0, 20),
    calls: mine.map(function (c) {
      return { at: c.at ? new Date(c.at).toISOString() : null, key: c.key, method: c.m, path: c.path,
        params: c.q || null, sent: c.sent || null, status: c.status, ms: c.ms,
        server_ms: c.srv, db_trips: c.trips, correlation_id: c.rid, came_back: c.body || null };
    }),
  };
}

/** ⚠️ a download, not a new tab: a tab of JSON is something to squint at, a file is something to attach */
function testDumpSave() {
  try {
    var blob = new Blob([JSON.stringify(testDumpBuild(), null, 1)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'snapshot-' + (CBTEST.popupFor || 'screen') + '-'
      + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, 30000);
    if (typeof toast === 'function') toast('Snapshot saved \u2014 attach it to the incident.');
  } catch (e) { if (typeof toast === 'function') toast('Could not build the snapshot.'); }
}

/** true only while the clear still describes the window on screen — see the note where it is set */
function testDiagCleared() {
  return !!(CBTEST._clearedAt && CBTEST._clearedGen === (window.CBGEN || 0));
}

/** the control, in one place, because it appears both in the reading and in the emptied panel */
/**
 * ⭐⭐ AT THE TOP, BECAUSE IT IS A STATEMENT ABOUT THE NUMBERS BELOW IT. Athi: *"the other two chips can be on
 * the top, so people know that this data can be cleared and can make a fresh start."* A reset button under a
 * page of figures is found after you have already believed them.
 */
/**
 * ── ⭐⭐⭐ THE FOUR THINGS YOU CAN DO HERE, AS CHIPS, AT THE TOP ────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"Clear this screen and Clear everything have to be a chip, not visible as an action icon.
 * Also, at the bottom, Write this up and Snapshot — it has to be on the top as a chip with clear instruction,
 * so people know it. These options are not going to change, so let them be on the top."*
 *
 * ⚠️⚠️ AND HE IS RIGHT ABOUT WHERE, NOT ONLY HOW. "Write this up" sat at the FOOT of the reading, which is the
 * one place a person never looks until they have finished reading and decided to do nothing. The reason this
 * area exists at all is to turn a slow screen into a filed finding, and the control that does it was below the
 * fold. A reset button underneath the figures has the same problem in reverse: it is found after you have
 * already believed them.
 *
 * ⭐ SO ALL FOUR SIT ABOVE THE NUMBERS, AND THEY NEVER MOVE. What you can do here does not depend on what the
 * reading says, so the bar should not change as the reading does — a control that appears and disappears has
 * to be re-learned every visit.
 *
 * ⚠️⚠️ BUT A CHIP IS WHAT A FILTER LOOKS LIKE IN THIS PANEL, and pressing a filter thinking it was an action is
 * the exact fault reported this morning (the Incidents view: the wire carried no PATCH at all, only a GET).
 * There is no filter row in the Speed area, so there is nothing to confuse them WITH — and to keep it that way
 * the two destructive chips carry ⟲ and a warning tint, so they can never be read as a way of looking at data.
 * See the note above TEST_CHIP.
 */
/**
 * ── ⭐⭐⭐ THREE KINDS OF THING, THREE LOOKS ────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"just for the speed alone you have to work with the designer — information, summary all
 * looks the same, it has to be properly distinguished. Example: write-up, snapshot messages should be as
 * bullet points and possibly in a box with different colour coding. Next, summary. Like that."*
 *
 * ⚠️⚠️ AND HE IS DESCRIBING A REAL FAULT, NOT A PREFERENCE. Every line in this area was the same 11px grey
 * sentence joined to the next by `<br>`: the count of calls, the explanation of what a call costs, a warning
 * that the app was still booting, and the one finding worth acting on all rendered identically. A reader has
 * to parse each sentence to discover which kind it is, and after four of them they stop and skim — so the one
 * red line is the one that gets skimmed past. [[feedback-more-panes-not-denser]]
 *
 * ⭐ SO THERE ARE EXACTLY THREE TREATMENTS, AND EVERY BLOCK PICKS ONE:
 *   FIGURES  a row of big numbers with a word under each — what the reading IS.
 *   NOTES    bullets in a tinted box, tone-coloured — what it MEANS and what to do.
 *   SECTION  a small capitalised rule — where one kind of thing ends and the next begins.
 *
 * ⚠️ THREE, NOT SEVEN. A fourth treatment invented for one block is how a screen ends up looking the way this
 * one did.
 */
function testSec(title, hint) {
  return '<div style="margin:13px 0 5px;padding-top:9px;border-top:1px solid var(--line,#e7e3d8)">'
    + '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;'
    +   'color:var(--grey-2,#545A61)">' + title + '</div>'
    + (hint ? '<div style="font-size:var(--fs-1);color:var(--note);margin-top:1px">' + hint + '</div>' : '')
    + '</div>';
}

/** ⭐ the reading itself, as figures — a number you can read at arm's length, and the word under it */
function testFigures(items) {
  var live = items.filter(function (x) { return x && x[0] != null; });
  if (!live.length) return '';
  return '<div style="display:flex;gap:18px;flex-wrap:wrap;padding:8px 0 4px">'
    + live.map(function (x) {
        return '<div style="display:flex;flex-direction:column;line-height:1.1">'
          + '<b style="font-size:var(--fs-4);' + (x[2] ? 'color:' + x[2] : '') + '">' + x[0] + '</b>'
          + '<span style="font-size:var(--fs-1);color:var(--grey-2)">' + x[1] + '</span>'
          + '</div>';
      }).join('')
    + '</div>';
}

/**
 * ⭐ WHAT IT MEANS, AS BULLETS IN A BOX — and the tone carries the urgency so it does not have to be read for.
 * ⚠️ Tone is a TOKEN pair, never a hardcoded colour: guard-static fails a themed ground with fixed ink on it,
 * and it is right to — one half moving with the theme and the other not is invisible until somebody switches.
 */
var TEST_TONE = {
  bad:  ['var(--disp,#B3261E)', 'var(--danger-tint,#fbeceb)', 'var(--ink,#20303b)'],
  warn: ['var(--warn-2,#8a6100)', 'var(--warn-tint,#fdf6e6)', 'var(--ink,#20303b)'],
  ok:   ['var(--ok-2,#1B7F4B)', 'var(--ok-tint,#eaf4ee)', 'var(--ink,#20303b)'],
  note: ['var(--line,#e7e3d8)', 'var(--paper,#faf8f3)', 'var(--grey-2,#545A61)'],
};
function testNotes(list, tone) {
  var rows = (list || []).filter(Boolean);
  if (!rows.length) return '';
  var t = TEST_TONE[tone] || TEST_TONE.note;
  return '<ul style="margin:6px 0 0;padding:7px 9px 7px 26px;list-style:disc;'
    + 'border-inline-start:3px solid ' + t[0] + ';background:' + t[1] + ';color:' + t[2] + ';'
    + 'border-radius:0 8px 8px 0;font-size:var(--fs-1);line-height:1.6">'
    + rows.map(function (r) { return '<li style="margin:1px 0">' + r + '</li>'; }).join('')
    + '</ul>';
}

function testDiagBarHTML() {
  var chip = 'font:inherit;font-size:var(--fs-1);padding:3px 11px;border:0;border-radius:11px;'
    + 'cursor:pointer;margin-inline-end:5px;margin-bottom:4px;white-space:nowrap;';
  var doer = 'background:var(--neutral-tint,#f2efe6);color:var(--grey-2,#545A61)';
  /* ⚠️ the two that THROW SOMETHING AWAY are tinted apart from the two that make something */
  var undo = 'background:var(--warn-tint,#fdf6e6);color:var(--warn-2,#8a6100)';

  return '<div style="margin:0 0 8px;padding-bottom:7px;border-bottom:1px solid var(--line,#efece4)">'
    + '<div>'
    +   '<button data-testid="diag-raise" onclick="testDiagRaise()" style="' + chip + doer + '" '
    +     'title="Fill the Create form with these numbers">✎ Write this up</button>'
    +   '<button data-testid="diag-snapshot" onclick="testDumpSave()" style="' + chip + doer + '" '
    +     'title="Save one file with every call of this visit">💾 Snapshot</button>'
    +   '<button data-testid="diag-clear-screen" onclick="testDiagClear()" style="' + chip + undo + '" '
    +     'title="Throw away this screen’s readings only">⟲ Clear this screen</button>'
    +   '<button data-testid="diag-clear-all" onclick="testDiagClear(\'all\')" style="' + chip + undo + '" '
    +     'title="Throw away every screen’s readings and start again">⟲ Clear everything</button>'
    /* ⭐ pushed to the end of the row: it is a SETTING, not one of the four things you do here — and it is
       in the same slot whether it is off, on, or still being read */
    +   '<span style="float:inline-end">' + testTraceChip() + '</span>'
    + '</div>'
    /* ⭐ one line, saying what each does — Athi asked for "clear instruction", and a chip with only an icon
       is a control you have to press to find out what it was */
    /**
     * ⭐ ONE BULLET PER CHIP, IN THE SAME ORDER AS THE CHIPS. Athi: *"write-up, snapshot messages should be
     * as bullet points and possibly in a box." A four-sentence paragraph describing four buttons makes the
     * reader match sentence to button themselves; one line each and the matching is already done.
     */
    + testNotes([
        '<b>\u270e Write this up</b> puts these numbers into the Create form \u2014 you still choose whether it is an incident or a requirement.',
        '<b>\ud83d\udcbe Snapshot</b> saves one file with every call of this visit (what was asked, what was sent, what came back), every error the page threw, and where you were \u2014 to attach to it.',
        '<b>\u27f2 Clear</b> starts the measurement again \u2014 this screen, or all of them.',
        'Your readings live in this browser under your login, so clearing cannot touch anybody else\u2019s.',
      ], 'note')
    + '</div>';
}

/* ⚠️ testDiagClearBtn() lived here and drew the two clears on their own. It is gone rather than left
   unused: two functions that draw the same bar is how one of them quietly goes stale, and the next person
   fixes the wrong one. [[feedback-no-duplicate-functions]] — see testDiagBarHTML above. */

/**
 * ── ⭐⭐⭐ WHERE THE TIME ACTUALLY WENT ───────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"do we know why it takes more time — for example network speed, wifi speed, encryption
 * and so on? All the layers?"*
 *
 * Every figure here is READ, not derived from a guess. The browser times each request; the server reports its
 * own share; the difference between them is the wire, and that subtraction is the only arithmetic in it.
 *
 *   FINDING THE ADDRESS   DNS. Once per session, then cached.
 *   OPENING THE LINE      TCP. Once per connection.
 *   AGREEING THE KEYS     the TLS handshake — THIS is what "encryption" costs, and it is also once per
 *                         connection. Encrypting the bytes themselves is not measurable here and is not the
 *                         cost people imagine it is.
 *   WAITING               first byte back, minus what the server says it spent. This is the distance.
 *   RECEIVING             the download, and how many bytes it was.
 *
 * ⚠️⚠️ THE FIRST CALL PAYS FOR THE CONNECTION AND THE REST RIDE ON IT. Reading a per-call average of DNS or
 * TLS would suggest every request pays a handshake, which would send somebody optimising the one thing here
 * that is already free. The setup is shown as a ONE-OFF TOTAL and labelled as such.
 *
 * ⚠️ AND IT SAYS WHEN IT CANNOT SEE. Cross-origin these fields are zeroed unless the API sends
 * `Timing-Allow-Origin` — a zero would read as "no time spent there", the same trap the server timings were
 * in this morning.
 */
/**
 * ── ⭐⭐⭐ TURN THE SERVER TIMINGS ON, FOR MYSELF, FOR TEN MINUTES ────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"can we bring an icon for CB_TRIPS mode on/off and set the limit as say 10 mins, 15
 * mins, after that it will be off? So we can enable for any user id and we don't need to worry about which
 * id I should use to test."*
 *
 * ⭐ WITHOUT THIS, MEASURING A NEW TEST ID MEANS EDITING A RAILWAY VARIABLE AND WAITING FOR A REDEPLOY — for
 * a reading that takes a minute. And an env list only ever grows, because nobody goes back to remove an id.
 *
 * ⚠️ IT ASKS FOR ITSELF AND NOTHING ELSE. The server takes the entity from the token; this cannot be pointed
 * at another shop, and no field here would let it.
 *
 * ⚠️ AND IT SHOWS THE TIME LEFT, because a diagnostic that is quietly still on is the thing this replaces.
 */
function testTraceLoad() {
  if (CBTEST._traceReq) return;
  CBTEST._traceReq = 1;
  api('testTraceGet').then(function (r) {
    CBTEST._traceReq = 0;
    /**
     * ⚠️ THE SERVER SENDS SECONDS REMAINING, WHICH IS TRUE FOR ONE INSTANT. Held as a duration it stops
     * being true the moment it is held, and the chip would go on saying "10 minutes left" an hour later.
     * ⭐ Turned into a DEADLINE here, once, and every reader subtracts from the clock instead.
     */
    CBTEST.trace = r || { on: false };
    if (CBTEST.trace.on) CBTEST.trace.until = Date.now() + ((CBTEST.trace.seconds || 0) * 1000);
    if (CBTEST.popupFor) screenCasesPaint();
  }).catch(function () { CBTEST._traceReq = 0; });
}

function testTraceSet(minutes) {
  var body = minutes ? { minutes: minutes } : { off: true };
  api('testTraceSet', { body: body }).then(function (r) {
    CBTEST.trace = r || { on: false };
    if (CBTEST.trace.on) {
      CBTEST.trace.until = Date.now()
        + (((CBTEST.trace.seconds != null) ? CBTEST.trace.seconds : (CBTEST.trace.minutes || 10) * 60) * 1000);
    }
    if (typeof toast === 'function') {
      toast(r && r.on ? ('Tracing your calls for ' + (r.minutes || 10) + ' minutes.')
                      : 'Tracing off.');
    }
    if (CBTEST.popupFor) screenCasesPaint();
  }).catch(function (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not change it.'); });
}

/**
 * ── ⭐⭐⭐ ONE CHIP, ALWAYS IN THE SAME PLACE, COLOURED WHEN IT IS ON ───────────────────────────────────────
 *
 * Athi, 2026-09-13: *"it was gone and then reappearing when I clear the data and measure. Can we keep it as
 * a stable one on the top right corner? Also if it is enabled, colour it so we know which one is enabled and
 * how long remains."*
 *
 * ⚠️⚠️ AND IT WAS WORSE THAN MOVING — IT WAS ABSENT ON THE FIRST PAINT. `testTraceHTML` returned an empty
 * string while the state was still being read, then a paragraph once it arrived, then a different paragraph
 * once tracing was on. Three heights in three seconds, in the middle of a page of numbers. A control that
 * moves is a control you have to hunt for; a control that is sometimes not there at all is one you stop
 * believing in.
 *
 * ⭐ SO IT IS A CHIP IN THE BAR, at the end, in the same place whatever the state — including WHILE IT IS
 * BEING READ, which is the state that used to render nothing. Off: quiet, with the three durations beside
 * it. On: green, counting down, with Stop.
 *
 * ⚠️ THE COUNTDOWN IS COMPUTED FROM A DEADLINE, and ticks by rewriting ONE element rather than repainting
 * the area — a repaint every thirty seconds would fight anybody typing in the form behind it, which is the
 * fault this file has already had twice. [[feedback-repaint-locally]]
 */
function testTraceLeft() {
  var t = CBTEST.trace;
  if (!t || !t.on || !t.until) return 0;
  return Math.max(0, Math.round((t.until - Date.now()) / 60000));
}

function testTraceChip() {
  var t = CBTEST.trace;
  var chip = 'font:inherit;font-size:var(--fs-1);padding:3px 11px;border:0;border-radius:11px;'
    + 'cursor:pointer;margin-inline-start:4px;margin-bottom:4px;white-space:nowrap;';
  var flat = 'font:inherit;font-size:var(--fs-1);padding:3px 9px;border:0;border-radius:11px;'
    + 'margin-inline-start:4px;white-space:nowrap;background:var(--neutral-tint,#f2efe6);'
    + 'color:var(--note,#8a8378)';

  /* ⚠ the reading state has a chip too, in the same slot, so nothing moves when the answer lands */
  if (!t) { testTraceLoad(); return '<span style="' + flat + '">\u23f1 Server timings\u2026</span>'; }

  if (t.on) {
    var left = testTraceLeft();
    return '<span data-testid="trace-on" id="cbtracechip" style="' + flat
      + ';background:var(--ok-2,#1B7F4B);color:#fff;font-weight:700" '
      + 'title="Every call is reporting what it spent inside the server, and how many database trips it '
      + 'made. Only your own calls.">\u23f1 Timings ON \u00b7 ' + left + ' min left</span>'
      + '<button data-testid="trace-off" onclick="testTraceSet(0)" style="' + chip
      + 'background:var(--neutral-tint,#f2efe6);color:var(--grey-2,#545A61)" '
      + 'title="Stop timing now">Stop</button>';
  }

  return '<span data-testid="trace-off-now" style="' + flat + '" '
    + 'title="Turn them on and each call shows what it spent inside the server and how many database '
    + 'trips it made. It stops by itself, and only your own calls are timed.">\u23f1 Timings off</span>'
    + [10, 15, 30].map(function (m) {
        return '<button data-testid="trace-' + m + '" onclick="testTraceSet(' + m + ')" style="' + chip
          + 'background:var(--neutral-tint,#f2efe6);color:var(--grey-2,#545A61)">' + m + ' min</button>';
      }).join('');
}

/** ⚠️ rewrites the one element; never repaints, so it cannot eat what somebody is typing */
function testTraceTick() {
  try {
    var el = document.getElementById('cbtracechip');
    if (!el) return;
    el.textContent = '\u23f1 Timings ON \u00b7 ' + testTraceLeft() + ' min left';
  } catch (_) {}
}
try { setInterval(testTraceTick, 30000); } catch (_) {}

function testTraceHTML() {
  var t = CBTEST.trace;
  if (!t) { testTraceLoad(); return ''; }
  var btn = 'font:inherit;font-size:var(--fs-1);padding:2px 9px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;background:var(--card,#fff);margin-inline-end:4px';
  if (t.on) {
    var mins = Math.max(1, Math.round((t.seconds || 0) / 60));
    return '<div style="margin-top:9px;padding:7px 9px;border-inline-start:3px solid var(--ok-2,#1B7F4B);'
      + 'background:var(--ok-tint,#eaf4ee);border-radius:0 8px 8px 0;font-size:var(--fs-1)">'
      + '<b>\u1f50e Tracing your calls</b> \u00b7 about ' + mins + ' minute(s) left, then it stops by itself.'
      + ' <button onclick="testTraceSet(0)" style="' + btn + ';margin-inline-start:6px">Stop now</button>'
      + '</div>';
  }
  return '<div style="margin-top:9px;font-size:var(--fs-1);color:var(--grey-2)">'
    + '\u1f50e <b>Server timings are off for you.</b> Turn them on and each call will show what it spent '
    + 'inside the server and how many database trips it made:<br>'
    + [10, 15, 30].map(function (m) {
        return '<button onclick="testTraceSet(' + m + ')" style="' + btn + ';margin-top:5px">'
          + m + ' min</button>';
      }).join('')
    + '<span style="color:var(--note)">it stops by itself, and only your own calls are timed</span></div>';
}

function testDiagLayersHTML(mine) {
  var seen = mine.filter(function (c) { return c.rt && !c.rt.blocked; });
  var blocked = mine.some(function (c) { return c.rt && c.rt.blocked; });
  if (!seen.length) {
    return '<div style="font-size:var(--fs-1);color:var(--note);margin-top:10px">'
      + (blocked
        ? '\u26a0\ufe0f The browser will not show the layers to this page. The API must send '
          + '<code>Timing-Allow-Origin</code> for this origin \u2014 without it DNS, connection, encryption and '
          + 'download all read zero, which is not the same as free.'
        : 'No per-layer timing recorded for this visit yet.') + '</div>';
  }

  var sum = function (f) { return seen.reduce(function (a, c) { return a + (c.rt[f] || 0); }, 0); };
  var setup = sum('dns') + sum('tcp') + sum('tls');
  var wait = sum('wait');
  var down = sum('down');
  var srv = seen.reduce(function (a, c) { return a + (c.srv || 0); }, 0);
  var net = Math.max(0, wait - srv);
  var bytes = sum('bytes');
  var raw = sum('raw');

  /* ⚠ the handshake is counted once per connection, so it is reported as a total and never as an average */
  var firstTls = sum('tls'), firstDns = sum('dns'), firstTcp = sum('tcp');

  var row = function (label, ms, note, colour) {
    return '<tr style="border-top:1px solid var(--line,#efece4)">'
      + '<td style="padding:4px 6px 4px 0;font-size:var(--fs-2)">' + label
      +   '<span style="display:block;font-size:var(--fs-1);color:var(--note)">' + note + '</span></td>'
      + '<td style="text-align:end;padding:4px 6px;font-weight:700'
      +   (colour ? ';color:' + colour : '') + '">' + ms + ' ms</td></tr>';
  };

  var h = ''
    + '<table style="width:100%;border-collapse:collapse">'
    + row('Finding the address', firstDns, 'DNS \u00b7 once per session, then cached', null)
    + row('Opening the line', firstTcp, 'TCP \u00b7 once per connection', null)
    + row('Agreeing the keys', firstTls, 'the TLS handshake \u2014 this is what encryption costs, and it is '
        + 'paid once per connection, not per call', null)
    + row('Waiting \u00b7 the server', srv, 'what the API says it spent inside itself',
        srv > net ? 'var(--disp,#B3261E)' : null)
    + row('Waiting \u00b7 the distance', net, 'first byte back, less the server\u2019s own time \u2014 the wire, the '
        + 'wifi and everything between', net > srv ? 'var(--disp,#B3261E)' : null)
    + row('Receiving', down, bytes ? (Math.round(bytes / 1024) + ' KB over the wire'
        + (raw > bytes ? ', ' + Math.round(raw / 1024) + ' KB after unzipping' : '')) : 'the download', null)
    + '</table>';

  /* ⭐ the reading in a sentence, because a table of five numbers still needs somebody to draw the conclusion */
  var verdict = (setup > srv + net + down) ? 'Most of it was setting up the connection \u2014 that is a first-call '
        + 'cost and the calls after it ride free.'
    : (net > srv * 1.5) ? 'Most of it is DISTANCE, not work. Fewer round trips will help; a faster query will '
        + 'barely show.'
    : (srv > net * 1.5) ? 'Most of it is the SERVER thinking. Batching will barely help here \u2014 look at the '
        + 'query.'
    : 'Server time and network time are close, so neither one alone explains it.';
  h += '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:5px">' + verdict + '</div>';
  return h;
}

function testDiagByApi() {
  var all = (window.CBCALLS || []).filter(function (c) {
    return !/^\/api\/testing/i.test(String(c.path || ''));
  });
  if (!all.length) return '';

  var rows = ((window.CBASSETS || {}).rows) || [];
  var byRoute = {};
  all.forEach(function (c) {
    var m = String(c.path || '').match(/^\/api\/([a-z0-9-]+)/i);
    var r = m ? m[1].toLowerCase() : 'other';
    var g = byRoute[r] || (byRoute[r] = { route: r, n: 0, ms: 0, worst: 0, bad: 0, screens: {} });
    g.n++;
    g.ms += (c.ms || 0);
    if ((c.ms || 0) > g.worst) g.worst = (c.ms || 0);
    if ((c.status || 0) >= 400) g.bad++;
    if (c.scr) g.screens[c.scr] = (g.screens[c.scr] || 0) + 1;
  });

  /* ⭐ by TOTAL time, not by the worst single call: forty fast calls cost more than one slow one, and it is
     the total a person feels */
  var list = Object.keys(byRoute).map(function (k) { return byRoute[k]; })
    .sort(function (a, b) { return b.ms - a.ms; });

  var codeOf = function (r) {
    var a = rows.filter(function (x) {
      return x.type === 'API' && x.path === 'chitbridge-api/routes/' + r + '.js';
    })[0];
    return a ? a.code : '';
  };
  /* the nav key a call was stamped with, said the way a person names the screen */
  var scrName = function (k) {
    var n = ((window.CBSCREENS || {}).byNav || {})[k];
    return n ? (n.code + ' ' + n.label) : k;
  };

  var h = ''
    + '<div style="font-size:var(--fs-1);color:var(--note);margin-bottom:5px">'
    + '\u26a0\ufe0f The last ' + all.length + ' calls in THIS browser tab, nothing more. Not a monitor, and not '
    + 'evidence about the product as a whole.</div>';

  h += '<table style="width:100%;border-collapse:collapse;font-size:var(--fs-2)">'
    + '<tr style="color:var(--grey-2,#545A61);font-size:var(--fs-1)">'
    + '<th style="text-align:start;padding:3px 6px 3px 0">API</th>'
    + '<th style="text-align:end;padding:3px 6px">Calls</th>'
    + '<th style="text-align:end;padding:3px 6px">Total ms</th>'
    + '<th style="text-align:end;padding:3px 6px">Worst</th></tr>';

  h += list.map(function (g) {
    var who = Object.keys(g.screens).sort(function (a, b) { return g.screens[b] - g.screens[a]; });
    var code = codeOf(g.route);
    return '<tr style="border-top:1px solid var(--line,#efece4)">'
      + '<td style="padding:4px 6px 4px 0">'
      +   (code ? '<code style="font-size:var(--fs-1);color:var(--grey-2)">' + testEsc(code) + '</code> ' : '')
      +   '/api/' + testEsc(g.route)
      +   (g.bad ? ' <b style="color:var(--disp,#B3261E);font-size:var(--fs-1)">' + g.bad + ' failed</b>' : '')
      +   '<span style="display:block;font-size:var(--fs-1);color:var(--note)">'
      +     (who.length ? 'asked by ' + testEsc(who.map(function (k) {
            return scrName(k) + ' \u00d7' + g.screens[k]; }).join(', '))
          : 'no screen recorded')
      +   '</span></td>'
      + '<td style="text-align:end;padding:4px 6px">' + g.n + '</td>'
      + '<td style="text-align:end;padding:4px 6px;font-weight:' + (g.ms > 3000 ? '700' : '400')
      +   ';color:' + (g.ms > 3000 ? 'var(--disp,#B3261E)' : 'inherit') + '">' + g.ms + '</td>'
      + '<td style="text-align:end;padding:4px 6px;color:var(--grey-2)">' + g.worst + '</td>'
      + '</tr>';
  }).join('');
  return h + '</table>';
}

function testDiagRaise() {
  var all = (window.CBCALLS || []).filter(function (c) {
    return !/^\/api\/testing/i.test(String(c.path || ''));
  });
  var gen = window.CBGEN || 0;
  var mine = gen ? all.filter(function (c) { return !c.gen || c.gen === gen; }) : all.slice();
  if (!mine.length) { if (typeof toast === "function") toast("Nothing measured yet."); return; }

  var total = mine.reduce(function (a, c) { return a + (c.ms || 0); }, 0);
  var seenN = {};
  mine.forEach(function (c) {
    var k = c.key || (c.m + ' ' + String(c.path || '').split('?')[0]);
    seenN[k] = (seenN[k] || 0) + 1;
  });
  var rep = Object.keys(seenN).filter(function (k) { return seenN[k] > 1; })
    .map(function (k) { return k + ' \u00d7' + seenN[k]; });
  var code = CBTEST.popupFor || '';
  var name = (CBTEST.writeFor && CBTEST.writeFor.name) || codeName(code) || 'this screen';

  CBTEST.caseArea = 'write';
  try { localStorage.setItem('cb_case_area', 'write'); } catch (_) {}
  screenCasesPaint();

  /* ⚠ after the paint, or the repaint restores the empty values over these */
  var put = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
  put('wcTitle', 'Opening ' + code + ' ' + name + ' should not cost more than two or three server calls.');
  put('wcDo', 'Open ' + name + ' from the rail, with test mode on, and read the Speed area.');
  put('wcSee', 'Two or three round trips, each fetched once.');
  put('wcGot', mine.length + ' calls, ' + total + ' ms in total'
    + (rep.length ? ' \u2014 the same call repeated: ' + rep.join(', ') : '')
    + '. Correlation id ' + ((mine[0] && mine[0].rid) || '\u2014') + '.');
  try { document.getElementById('wcTitle').focus(); } catch (_) {}
}

function testAreaGet() {
  try { return localStorage.getItem('cb_case_area') || ''; } catch (_) { return ''; }
}
function testArea(v) {
  try { localStorage.setItem('cb_case_area', v); } catch (_) {}
  CBTEST.caseArea = v;
  screenCasesPaint();
}

/**
 * ⚠️⚠️ THE DEFAULT IS DECIDED ONCE, WHEN THE PANEL OPENS — not re-derived on every repaint.
 *
 * Caught by the Playwright spec: write the first case on a screen and the form vanishes. `t.total` goes from
 * 0 to 1, so a default of "cases when there are any" flipped the tab out from under the tester at the exact
 * moment they were writing. That is the disappearing-form fault a third time, in a third disguise.
 *
 * ⭐ Opening the panel is a decision point; a repaint is not. A tester who is on Create stays on Create until
 * they say otherwise.
 */
function testAreaOpen(hasCases) {
  var saved = testAreaGet();
  CBTEST.caseArea = saved || (hasCases ? 'cases' : 'write');
}

/* repainted in place after every verdict, so the panel shows what was just recorded */
/**
 * ── ⚠️⚠️⚠️ DELETED BY ACCIDENT, AND NOTHING NOTICED FOR A DAY ───────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"in the screen incident 2, but couldn’t click the link for incident and see what those
 * are?"* — and the answer was not that the count was unclickable. `testRaisedHTML` DID NOT EXIST. Opening
 * Raised threw ReferenceError, `screenCasesPaint` died mid-render, and the panel simply went on showing
 * whatever it had been showing. A tab that silently does nothing.
 *
 * ⚠️⚠️ HOW IT WENT: the "three areas" patch (8542c0d) replaced a whole REGION of this file between two
 * anchors — `s.slice(0, i) + block + s.slice(j)` — and this function was sitting inside that region. It was
 * never edited, never mentioned in the commit, and never missed. Exactly the hazard already written down
 * after a region replace ate a shop screen: [[feedback-anchor-replace-drops-code]]. ⭐ REPLACE ANCHORS, NOT
 * RANGES — and when a range is genuinely the only way, list the functions inside it first and count them
 * after.
 *
 * ⚠️⚠️ AND SIXTEEN PLAYWRIGHT SPECS PASSED OVER IT, because not one of them ever opened this area. A green
 * suite is only a statement about what it visits. TM-22 now presses the tab.
 */
/**
 * ── ⭐⭐⭐ THREE TABS ON A SCREEN: CASES · INCIDENTS · REQUIREMENTS ─────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"this is the list we wanted to see for all the cases, incidents, requirements created —
 * can we make it three tabs? How do we see the closed ones? We don't need to read all at the same time; only
 * the not-closed ones are visible, so the closed ones we have to see on demand."*
 *
 * ⚠️⚠️ THE OLD "RAISED" TAB PUT TWO DIFFERENT THINGS IN ONE PILE and then showed every state at once, so the
 * screen with three incidents all closed and one requirement outstanding read the same as the screen with four
 * live faults. A count you cannot act on is a number, not a signal.
 *
 * ⭐ ADOPTED, THE SAME MODEL AS THE WORKLIST: one row renderer, one status vocabulary, one set of verbs — so a
 * finding looks and behaves identically whether you meet it on its screen or on the board.
 * [[feedback-adopt-dont-reinvent]] and [[feedback-no-duplicate-functions]] — this could easily have become a
 * fourth way of drawing the same row.
 *
 * ⚠️ OPEN BY DEFAULT, CLOSED ON DEMAND, and the tab count is the OPEN count for the same reason: the number on
 * a tab is a promise about how much work is behind it.
 */
function testScrOpenN(code, kind) {
  return testScrRows(code, kind).filter(function (x) { return x.status !== 'closed'; }).length;
}

/** the screen's rows, in the worklist's own shape so they render and behave identically */
function testScrRows(code, kind) {
  var out = [];
  if (kind === 'inc') {
    (CBTEST.scrInc || []).forEach(function (x) {
      if (x.screen_code !== code) return;
      out.push(testWorkRow({ key: x.ref || '', title: x.observed || '', screen: code,
        shot: x.evidence_id || null, by: x.raised_by || null, at: x.raised_at || null,
        last: null, inc: x, req: null, caseKey: x.found_by_case || null }));
    });
  } else if (kind === 'req') {
    (CBTEST.scrReq || []).forEach(function (q) {
      if (q.screen_code !== code) return;
      out.push(testWorkRow({ key: q.clause || '', title: q.requirement || '', screen: code,
        seen: q.observed || null, by: q.raised_by || null, at: q.raised_at || null,
        last: null, inc: null, req: q, caseKey: q.raised_from || null }));
    });
  }
  /* ⭐ what is waiting on somebody first, then newest — the worklist's order, for the same reason */
  return out.sort(function (a, b) {
    var d = TEST_WORK_ORDER.indexOf(a.status) - TEST_WORK_ORDER.indexOf(b.status);
    if (d) return d;
    return String(b.at || '') < String(a.at || '') ? -1 : 1;
  });
}

function testScrShut(kind) { return !!(CBTEST._scrShut && CBTEST._scrShut[kind]); }
function testScrShutToggle(kind) {
  CBTEST._scrShut = CBTEST._scrShut || {};
  CBTEST._scrShut[kind] = !CBTEST._scrShut[kind];
  screenCasesPaint();
}

function testScrRaisedHTML(code, kind) {
  var all = testScrRows(code, kind);
  var open = all.filter(function (x) { return x.status !== 'closed'; });
  var shut = all.length - open.length;
  var word = kind === 'inc' ? 'incident' : 'requirement';

  if (!all.length) {
    return '<div style="font-size:var(--fs-1);color:var(--note);padding:8px 0">'
      + 'No ' + word + ' on this screen. '
      + (kind === 'inc'
        ? 'Raise one from Create the moment something does not work.'
        : 'Raise one from Create when the product does what it was told and the instruction was wrong.')
      + '</div>';
  }

  var showShut = testScrShut(kind);
  var rows = showShut ? all : open;
  var h = '<div style="font-size:var(--fs-1);color:var(--grey-2);padding:4px 0 6px">'
    + '<b>' + open.length + '</b> open'
    /* ⚠️ the closed ones are not fetched again — they are already here; what changes is whether they are DRAWN.
       "On demand" is about the reader's attention, not about the network. */
    + (shut ? ' · <button onclick="testScrShutToggle(\'' + kind + '\')" style="font:inherit;'
        + 'font-size:var(--fs-1);border:0;background:none;padding:0;cursor:pointer;color:var(--grey-2);'
        + 'text-decoration:underline;text-underline-offset:2px">'
        + (showShut ? 'hide the ' + shut + ' closed' : 'show ' + shut + ' closed') + '</button>' : '')
    + '</div>';

  if (!rows.length) {
    return h + '<div style="font-size:var(--fs-1);color:var(--note);padding:6px 0">'
      + 'Nothing open — every ' + word + ' on this screen has been dealt with.</div>';
  }
  return h + rows.map(testWorkRowHTML).join('');
}

function testRaisedHTML(code) {
  var inc = (CBTEST.scrInc || []).filter(function (x) { return x.screen_code === code; });
  var req = (CBTEST.scrReq || []).filter(function (x) { return x.screen_code === code; });
  if (!inc.length && !req.length) return '';
  var wrap = 'margin-top:10px;padding-top:8px;border-top:1px solid var(--line,#e7e3d8)';
  var h = '<div style="' + wrap + '">'
    + '<div style="font-size:var(--fs-1);color:var(--grey-2);font-weight:700;letter-spacing:.04em;'
    +   'text-transform:uppercase;margin-bottom:5px">Raised on this screen</div>';

  var pill = function (t, fg, bg) {
    return '<span style="font-size:var(--fs-1);font-weight:700;color:' + fg + ';background:' + bg
      + ';border-radius:5px;padding:1px 6px;white-space:nowrap">' + testEsc(t) + '</span>';
  };

  /* ⚠️ newest first: the one you just raised is the one you are looking for */
  h += inc.slice().reverse().map(function (x) {
    return '<div style="padding:5px 0;border-top:1px solid var(--line,#efece4)">'
      + '<div style="display:flex;gap:6px;align-items:baseline;flex-wrap:wrap">'
      +   pill(x.severity || 'Sev-3', 'var(--disp,#B3261E)', 'var(--danger-tint,#fbeceb)')
      +   '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(x.ref) + '</code>'
      +   '<span style="font-size:var(--fs-1);background:var(--neutral-tint);border-radius:5px;'
      +     'padding:1px 6px">' + testEsc(x.state) + '</span>'
      /* ⭐ the picture, if one was attached — one click from the report it belongs to */
      +   (x.evidence_id ? '<a href="' + (CFG.API || '') + '/api/attachments/' + testEsc(x.evidence_id)
            + '" target="_blank" rel="noopener" style="font-size:var(--fs-1)">screenshot</a>' : '')
      + '</div>'
      + '<div style="font-size:var(--fs-2);margin-top:2px">' + testEsc(x.observed || '') + '</div>'
      /**
       * ── ⚠️⚠️ TWO WAYS OUT, BECAUSE THEY MEAN OPPOSITE THINGS ──────────────────────────────────────────
       *
       * Athi: *"say by mistake I raised it, then I need to close."* Marking that RESOLVED would put it in the
       * report as a fault that was found and fixed — a number somebody will quote. It was never a fault.
       *
       * ⭐ Resolved = it was real and it is dealt with. Not a fault = it should not have been raised. Both
       * ask why, and the report can then tell them apart instead of counting them together.
       */
      + (x.state === 'raised' || x.state === 'investigating'
        ? '<button class="btn" style="display:inline-block;width:auto;margin-top:5px;font-size:var(--fs-1);padding:3px 10px" onclick="testIncSet(\''
          + testEsc(x.definition_id) + '\',\'resolved\')">Resolved</button>'
          + ' <button class="btn" style="display:inline-block;width:auto;margin-top:5px;font-size:var(--fs-1);padding:3px 10px;color:var(--note)" onclick="testIncSet(\''
          + testEsc(x.definition_id) + '\',\'closed\')">Not a fault</button>' : '')
      + '</div>';
  }).join('');

  h += req.slice().reverse().map(function (x) {
    return '<div style="padding:5px 0;border-top:1px solid var(--line,#efece4)">'
      + '<div style="display:flex;gap:6px;align-items:baseline;flex-wrap:wrap">'
      +   pill(x.priority || 'Medium', 'var(--grey-2,#545A61)', 'var(--neutral-tint)')
      +   '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(x.clause) + '</code>'
      +   '<span style="font-size:var(--fs-1);background:var(--neutral-tint);border-radius:5px;'
      +     'padding:1px 6px">' + testEsc(x.state) + '</span>'
      + '</div>'
      + '<div style="font-size:var(--fs-2);margin-top:2px">' + testEsc(x.requirement || '') + '</div>'
      /* ⚠️ the evidence beside the rule, always — six months on it is the only thing that says it was real */
      + (x.observed ? '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:1px">seen: '
          + testEsc(x.observed) + '</div>' : '')
      /* ⚠️ a requirement had NO action on this panel — it could be raised here and only ever closed
         somewhere else. Accept and Reject are its own verbs; "close" would flatten the difference. */
      + (x.state !== 'accepted' && x.state !== 'rejected'
        ? '<div style="margin-top:5px">'
          + '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);padding:3px 10px" '
          +   'onclick="testReqSet(\'' + testEsc(x.definition_id) + '\',\'accepted\')">Accept</button> '
          + '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);padding:3px 10px;'
          +   'color:var(--note)" onclick="testReqSet(' + "'" + testEsc(x.definition_id) + "','rejected'"
          +   ')">Reject</button></div>'
        : '')
      + '</div>';
  }).join('');

  return h + '</div>';
}

function screenCasesPaint() {
  var code = CBTEST.popupFor;
  if (!code) return;
  var head = document.getElementById('cbcaseshead');
  var host = document.getElementById('cbcasesbody');
  if (!host) { CBTEST.popupFor = null; return; }

  /**
   * ── ⚠️⚠️⚠️ A REPAINT MUST NOT EAT WHAT SOMEBODY IS TYPING ────────────────────────────────────────────
   *
   * Found by the Playwright spec: fill one field, press Save, get refused — and every field is empty. The
   * refusal was right; the emptiness was not. ANY repaint rebuilds this with innerHTML — a verdict recorded,
   * the counts arriving a beat later, the panel following you — so a careful sentence is lost to a background
   * fetch finishing, which is the kind of fault people blame themselves for.
   */
  /* ⚠ the technique inputs are in this list too: a repaint landing while somebody is typing a boundary
     would eat it exactly as it once ate the observation — same bug, new boxes */
  var FIELDS = ['wcTitle', 'wcDo', 'wcSee', 'wcGot', 'wcPri', 'wcSev', 'wcWhen', 'wcCtl',
                'tqField', 'tqLo', 'tqHi', 'tqClasses', 'tqStates', 'tqConds'];
  var typed = {};
  FIELDS.forEach(function (id) { var el = document.getElementById(id); if (el) typed[id] = el.value; });
  var focused = document.activeElement;
  var focusId = focused && FIELDS.indexOf(focused.id) >= 0 ? focused.id : null;
  var caret = null;
  try { if (focusId && focused.selectionStart != null) caret = focused.selectionStart; } catch (_) {}

  var name = (CBTEST.writeFor && CBTEST.writeFor.name) || codeName(code) || '';
  var t = testScreenTally(code) || { total: 0, pass: 0, fail: 0 };
  var inc = (CBTEST.scrInc || []).filter(function (x) { return x.screen_code === code; }).length;
  var req = (CBTEST.scrReq || []).filter(function (x) { return x.screen_code === code; }).length;
  var known = !!(CBTEST.scrInc && CBTEST.scrReq);

  /* ── the header: what this is, and how it stands ── */
  if (head) {
    var ico = 'border:1px solid var(--line,#e7e3d8);background:var(--card,#fff);cursor:pointer;'
      + 'border-radius:7px;width:24px;height:24px;font-size:var(--fs-1);line-height:1;padding:0;'
      + 'color:var(--grey-2,#545A61)';
    /**
     * ── ⭐⭐ A COUNT THAT CANNOT BE OPENED IS A DEAD NUMBER ────────────────────────────────────────────
     *
     * Athi, 2026-09-13: *"in the screen incident 2, but couldn’t click the link for incident and see what
     * those are?"* — and he is right twice over, because this is the SECOND time the same complaint has
     * been made about the same figures. The first time I answered it by adding a "Raised" area; the number
     * that made him ask stayed a plain piece of text sitting above it.
     *
     * ⭐ A figure a person reads and wants to act on IS the control. Every one of these now opens the area
     * that holds it — written and passed and failed to the cases, incidents and requirements to Raised.
     *
     * ⚠ A ZERO IS NOT A DOOR. Nothing to see is not worth a cursor that promises there is.
     */
    var stat = function (n, word, colour, area) {
      var live = n && area;
      return '<' + (live ? 'button' : 'span') + (live ? ' onclick="testArea(' + "'" + area + "'" + ')"' : '')
        + ' style="display:inline-flex;flex-direction:column;line-height:1.05;text-align:start;'
        + (live ? 'cursor:pointer;background:none;border:0;padding:0;font:inherit' : '') + '"'
        + (live ? ' title="Open them"' : '') + '>'
        + '<b style="font-size:var(--fs-2)' + (colour ? ';color:' + colour : '')
        + (live ? ';text-decoration:underline;text-underline-offset:2px' : '') + '">' + n + '</b>'
        + '<span style="font-size:var(--fs-1);color:var(--grey-2)">' + word + '</span>'
        + '</' + (live ? 'button' : 'span') + '>';
    };
    head.innerHTML = '<div style="display:flex;align-items:center;gap:7px">'
      /**
       * ── ⚠️⚠️⚠️ TWO IDENTITIES, OPPOSITE ENDS: THE FIXED ONE LEFT, THE CHANGING ONE RIGHT ─────────────────
       *
       * Athi, three times, and I got it wrong twice. First: *"immediately it shows the area which one you are
       * operating on — possibly we have to give some space or hyphen, some differentiator."* I added a
       * divider. Then: *"screen name is coming after Test Capture, it has to be before that as per standard."*
       * I read that as a breadcrumb and swapped the order. Then, with a picture: *"it has to be PNL007 Test
       * Capture, then lot of space middle, CAT001 Catalogue — this CAT001 Catalogue keeps changing according
       * to the screen we trace, but the screen Test Capture remains the same."*
       *
       * ⭐ WHICH IS NOT A BREADCRUMB AT ALL, AND HE IS RIGHT. A breadcrumb says how you got here; this line
       * says two different KINDS of thing. `PNL007 Test Capture` is what this panel IS — the same on every
       * screen, so it anchors the left edge and the eye stops checking it. `CAT001 · Catalogue` is what it is
       * POINTED AT — it changes every time, so it sits apart, at the other end, where a changing value belongs.
       * Space is the separator; a divider glyph between them was making them look like one path.
       *
       * ⚠️ ID FIRST ON BOTH, because that is the half that travels into a report unchanged.
       */
      + '<b style="font-size:var(--fs-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      +   testToolTag(TEST_SURFACE.capture, 'Panel › Test cases for this screen') + '</b>'
      + '<span style="flex:1 1 auto;min-width:18px"></span>'
      + '<span style="font-size:var(--fs-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" '
      +   'title="the screen this is pointed at — it changes as you move">'
      +   testScreenLabel(code, name) + '</span>'
      + '<span style="font-size:var(--fs-1);color:var(--note);white-space:nowrap">'
      +   testReadAt() + '</span>'
      + testRefreshBtn(ico)
      + '<button title="Close" onclick="screenCasesClose()" style="' + ico + '">\u2715</button>'
      + '</div>'
      + '<div style="display:flex;gap:16px;margin-top:6px">'
      +   stat(t.total, 'written', null, 'cases')
      +   stat(t.pass, 'passed', t.pass ? 'var(--ok-2,#1B7F4B)' : null, 'cases')
      +   stat(t.fail, 'failed', t.fail ? 'var(--disp,#B3261E)' : null, 'cases')
      +   (known ? stat(inc, 'incidents', inc ? 'var(--disp,#B3261E)' : null, 'inc') : '')
      +   (known ? stat(req, 'requirements', null, 'req') : '')
      + '</div>';
  }

  /* ── the three areas ── */
  var area = CBTEST.caseArea || testAreaGet() || (t.total ? 'cases' : 'write');
  if (area === 'raised') area = (known && testScrOpenN(code, 'inc')) ? 'inc'
    : (known && testScrOpenN(code, 'req')) ? 'req' : (t.total ? 'cases' : 'write');
  if ((area === 'inc' || area === 'req') && known && !testScrOpenN(code, area) && !testScrShut(area)) {
    /* ⚠️ landing on an empty tab reads as a broken tab — but only when nothing is open AND nothing is being
       shown; a person who pressed "show closed" meant to be here. */
    if (t.total) area = 'cases';
  }
  var tab = 'font:inherit;font-size:var(--fs-1);padding:4px 11px;border:0;cursor:pointer;';
  var on = 'background:var(--ink,#0F2E3D);color:var(--card,#fff)';
  var off = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  var seg = function (id, label, n) {
    return '<button onclick="testArea(\'' + id + '\')" style="' + tab + (area === id ? on : off)
      + (id === 'write' ? '' : ';border-inline-start:1px solid var(--line,#e7e3d8)') + '">'
      + label + (n == null ? '' : ' <b>' + n + '</b>') + '</button>';
  };
  var tabs = '<div style="display:inline-flex;border:1px solid var(--line,#e7e3d8);border-radius:8px;'
    + 'overflow:hidden;margin:10px 0 4px">'
    + seg('write', 'Create', null)
    + seg('cases', 'Cases', t.total)
    /* ⚠️ THE COUNT ON A TAB IS A PROMISE ABOUT HOW MUCH WORK IS BEHIND IT. "Raised 4" counted three closed
       incidents and one live requirement as the same four, so a settled screen read like a burning one. */
    + seg('inc', 'Incidents', known ? testScrOpenN(code, 'inc') : null)
    + seg('req', 'Requirements', known ? testScrOpenN(code, 'req') : null)
    + seg('tech', 'Techniques', null)
    /* ⚠️ the LABEL is Coverage; the id stays 'behind' because it is in localStorage on every machine that
       has used this panel — see the note above testCoverGrade */
    + seg('behind', 'Coverage', testBehindCount(code))
    + seg('diag', 'Speed', (window.CBCALLS || []).length || null)
    + '</div>';

  var body = area === 'behind' ? testBehindHTML(code)
           : area === 'diag' ? testDiagHTML()
           : area === 'write' ? testCaseFormHTML()
           : area === 'tech' ? testTechAreaHTML()
           : area === 'inc' ? testScrRaisedHTML(code, 'inc')
           : area === 'req' ? testScrRaisedHTML(code, 'req')
           /* ⚠️ anyone who last used the old merged tab lands on Incidents rather than on nothing */
           : area === 'raised' ? testScrRaisedHTML(code, 'inc')
           : testCaseListHTML(code);
  host.innerHTML = tabs + body;

  Object.keys(typed).forEach(function (id) {
    var el = document.getElementById(id);
    if (el && typed[id] != null && typed[id] !== '') el.value = typed[id];
    /* ⚠️ a restored paragraph in a two-row box is a paragraph you cannot see — the height is part of the
       value as far as the person typing is concerned */
    if (el && el.tagName === 'TEXTAREA') testGrow(el);
  });
  if (focusId) {
    var back = document.getElementById(focusId);
    if (back) {
      try { back.focus(); if (caret != null && back.setSelectionRange) back.setSelectionRange(caret, caret); }
      catch (_) {}
    }
  }
  try { testShotPasteBind(); } catch (_) {}
  if (!known && !CBTEST._popCounts) {
    CBTEST._popCounts = 1;
    testScrLoad().then(function () { CBTEST._popCounts = 0; if (CBTEST.popupFor) screenCasesPaint(); })
      .catch(function () { CBTEST._popCounts = 0; });
  }
}
/**
 * ── ⭐⭐⭐ WHAT I WROTE, WHERE DID IT GO ──────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"I created a couple of cases for checking the screenshot — now where do I look at those
 * writes? I have not created an incident or a requirement, I just updated the Write, and after that I forgot
 * where I have written. In the test lab I couldn’t find all the writes I created."*
 *
 * ⚠️⚠️ NOTHING WAS LOST — all seven were on the board, and that is exactly the problem. They were seven rows
 * among ONE THOUSAND FOUR HUNDRED AND FIFTY-FIVE, and the lab had been left on the Requirements view, which
 * shows none of them. A tool that keeps your work perfectly and cannot show it to you has not kept it.
 *
 * ⭐ FOUND BY THE KEY, NOT BY THE TYPE. The panel mints every hand-written case as `<SCREEN>-H01`, `-H02`,
 * and has since the first one. ⚠️ Two of his seven carry `test_type: null` because they were written before
 * `'screen'` was added to the server's list of types — so a type filter would have found five of seven and
 * looked like it worked. The key pattern finds all of them, including everything written before today.
 *
 * ⚠️ NEWEST FIRST. The reason somebody opens this view is "where did the thing I just wrote go".
 */
/**
 * ── ⭐⭐⭐ CLOSING WHAT HAS BEEN DEALT WITH ───────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"if that observation can be closed, there is no way of closing it? Which means the list
 * will grow for ever."*
 *
 * ⭐ CLOSED IS RETIRED, NOT DELETED. Every verdict recorded against the case survives it, so closing says
 * "stop asking me this" and never "this never happened" — and it can be opened again, because a fault that
 * comes back must keep its history rather than start a second one under a new key.
 *
 * ⚠️ THE CLOSED ONES STAY REACHABLE. A list that can only hide is how the same observation gets written for
 * the third time by somebody who could not see the first two.
 */
/**
 * ── ⭐⭐⭐ ONE LIST OF EVERYTHING A PERSON FOUND ──────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"manual test cases alone, we have to keep it separate so it is easier to manage — just
 * all the cases, requirements, incidents have to be seen, and there should be a way of closing it with the
 * details. Possibly you can finish that loop."*
 *
 * ⚠️⚠️ THE LAB HAD THEM IN THREE PLACES AND THE PERSON HAS ONE QUESTION. A tester who spent an afternoon on a
 * screen wrote some cases, raised a requirement and filed an incident — three views, three filters, three
 * ways of being closed, and no page that answers "what did I find, and what is still open?". The 1,455
 * automated cases sat in the same list as their eight hand-written ones, which is what made the lab feel
 * unmanageable rather than large.
 *
 * ⭐ SO THIS VIEW IS EXACTLY WHAT A PERSON RAISED, and nothing a machine generated. Three kinds, one shape:
 *
 *   CASE          written on a screen — a rule that should hold        closed = retired
 *   REQUIREMENT   something further has to be done                     accepted · rejected
 *   INCIDENT      it did something else and here is what               resolved · closed
 *
 * ⚠️ THE THREE KEEP THEIR OWN VERBS. Flattening them into one "Close" would erase the difference between a
 * requirement that was REJECTED and an incident that was FIXED — the same word for two opposite outcomes.
 * They share a row and a reason, not a vocabulary.
 *
 * ⚠️ AND EVERY CLOSURE CARRIES ITS REASON. Six months on, "closed" with no account of itself is
 * indistinguishable from somebody tidying up.
 */
/**
 * ⚠️⚠️ THE CLOSED ONES HAVE TO BE FETCHED SEPARATELY, and forgetting it would have left the Closed filter
 * permanently empty while looking like it worked. `CBTEST.cases` is deliberately LIVE ONLY — the main board
 * must not offer retired cases to run — so a case closed a moment ago simply disappears from it. Caught by
 * closing one and watching it vanish rather than move.
 *
 * ⭐ A SECOND, NARROW READ: only the retired hand-written ones, and only when this view is open. The main
 * board pays nothing for a list it never shows.
 */
function testFindLoadClosed() {
  if (CBTEST._closedReq) return;
  CBTEST._closedReq = 1;
  api('testCasesAll').then(function (r) {
    CBTEST._closedReq = 0;
    CBTEST.closedCases = ((r && r.cases) || []).filter(function (c) {
      return c.status === 'retired' && /-H\d+$/.test(String(c.case_key || ''));
    });
    testPaint();
  }).catch(function () { CBTEST._closedReq = 0; CBTEST.closedCases = CBTEST.closedCases || []; });
}

function testFindings() {
  var out = [];
  if (!CBTEST.closedCases) testFindLoadClosed();
  /* live first, then the closed — one shape, so the renderer never asks which list a row came from */
  var caseRows = (CBTEST.cases || []).concat(CBTEST.closedCases || []);
  caseRows.forEach(function (c) {
    if (!/-H\d+$/.test(String(c.case_key || ''))) return;
    var st0 = (c.steps || [])[0];
    out.push({
      kind: 'case', id: c.case_key, key: c.case_key,
      screen: c.screen_code || c.module_key || '',
      title: c.title || '',
      doIt: Array.isArray(st0) ? (st0[0] || '') : '',
      exp: Array.isArray(st0) ? (st0[1] || '') : '',
      seen: c.observed || null,
      shot: c.evidence_id || null,
      by: c.written_by || null, at: c.written_at || null,
      state: c.status === 'retired' ? 'closed' : 'open',
      closedNote: c.closed_note || null, closedBy: c.closed_by || null, closedAt: c.closed_at || null,
      last: (CBTEST.last || {})[c.case_key] || null,
    });
  });
  (CBTEST.scrReq || []).forEach(function (q) {
    out.push({
      kind: 'req', id: q.definition_id, key: q.clause || q.ref || '',
      screen: q.screen_code || '', title: q.requirement || '',
      seen: q.observed || null, shot: q.evidence_id || null,
      by: q.raised_by || q.written_by || null, at: q.raised_at || q.created_at || null,
      state: (q.state === 'accepted' || q.state === 'rejected') ? 'closed' : 'open',
      stateWord: q.state || null, closedNote: q.why || null, byId: q.raised_by_id || null,
    });
  });
  (CBTEST.scrInc || []).forEach(function (x) {
    out.push({
      kind: 'inc', id: x.definition_id, key: x.ref || '',
      screen: x.screen_code || '', title: x.observed || '',
      seen: null, shot: x.evidence_id || null,
      by: x.raised_by || null, at: x.raised_at || x.created_at || null,
      sev: x.severity || null,
      /**
       * ── ⭐⭐⭐ THREE STATES, NOT TWO ─────────────────────────────────────────────────────────────────
       *
       * Athi, 2026-09-13: *"a message back stating that this issue has been fixed — that feedback loop is
       * not there … so I can retest and confirm that this has been resolved and close it."*
       *
       * ⚠️⚠️ AND THIS LINE WAS THE LOOP’S MISSING HALF, sitting here in plain sight: `resolved` was folded
       * into `closed`, so the moment a fixer said "done" the finding went grey, dropped out of Open, and
       * nobody — least of all the person who reported it — was ever asked to look. A board that greys a
       * fix the instant it is CLAIMED is a board that cannot tell a fix from a claim.
       *
       * ⭐ `resolved` = the fixer believes it is done. `closed` = the raiser has looked and agrees. They are
       * different facts and they now render as different states, which is the whole verification loop.
       */
      state: x.state === 'closed' ? 'closed' : (x.state === 'resolved' ? 'verify' : 'open'),
      stateWord: x.state || null, closedNote: x.why || null,
      /* ⚠️ by ID, not by name: "is this mine to retest?" cannot be answered by matching display names, and
         two people with one name would both be told to go and verify it */
      byId: x.raised_by_id || null,
      /* what was actually done about it — the first thing a person about to retest wants to read */
      fixedBy: (x.changes || []).length ? x.changes[x.changes.length - 1] : null,
    });
  });
  /* ⭐ newest first: the reason to open this page is "what did I just find" */
  return out.sort(function (a, b) { return String(b.at || '') < String(a.at || '') ? -1 : 1; });
}

/**
 * ── ⚠️⚠️⚠️ "CLOSE" HAS TO CLOSE ─────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"the status is not changing when I close it — it has to change the status, and the
 * closed one should leave the queue."*
 *
 * ⚠️⚠️ AND THE BUTTON SAID "Close" AND SENT `resolved`. On somebody else’s finding that is defensible — you
 * fixed it, they verify it. On YOUR OWN finding it is nonsense: it put the row on the "waiting for your
 * retest" shelf and asked you to verify a decision you had just taken. The state did not read `closed`, the
 * row did not leave, and the person was right to call it broken.
 *
 * ⭐ SO EACH KIND USES ITS OWN CLOSING STATE, WHICH IS WHAT THE WORD ON THE BUTTON NOW SAYS:
 *   a case        → retired. It is not a live check any more.
 *   an incident   → `closed`, with a reason. Ended, and out of the queue.
 *   a requirement → `accepted` or `rejected`. A backlog item is not “closed”, it is DECIDED, and the two
 *                   decisions are not the same fact — so it gets two buttons and no "Close" at all.
 *
 * ⭐ Marking something FIXED (`resolved`) is still there and is still the right thing when you are fixing
 * somebody else’s report — it is a separate button, phrased as what it does, and it hands them the retest.
 */
function testFindClose(kind, id, key, reopen) {
  try {
    if (kind === 'case') return testHandClose(key, reopen);
    if (kind === 'req') return testReqSet(id, reopen ? 'raised' : 'accepted');
    if (kind === 'inc') return testIncSet(id, reopen ? 'raised' : 'closed');
  } catch (_) {}
}

/** ⭐ the fixer’s half of the loop, from the same row: it goes to the raiser, not to the archive. */
function testFindFixed(id) { try { return testIncSet(id, 'resolved'); } catch (_) {} }

function testHandFilterGet() {
  try { return localStorage.getItem('cb_hand_filter') || 'open'; } catch (_) { return 'open'; }
}
function testHandFilter(v) {
  try { localStorage.setItem('cb_hand_filter', v); } catch (_) {}
  testPaint();
}

async function testHandClose(key, open) {
  /**
   * ⚠️ CLOSING ASKS WHY; REOPENING DOES NOT. The account is of the DECISION to stop looking at something, and
   * bringing it back is not that decision — it undoes it, and the old reason is cleared with it.
   *
   * ⭐ The wording says who the reason is FOR. "Why are you closing this?" gets "done"; naming the next
   * reader gets a sentence they can use.
   */
  var why = null;
  if (!open) {
    why = await testAsk('Closing this \u2014 why?',
      'The next tester reads this instead of raising it again.', 'Close it');
    if (why === null) return;                     /* cancelled: nothing is closed */
    if (!String(why).trim()) { if (typeof toast === 'function') toast('A closure needs its reason.'); return; }
  }
  api('testCaseClose', { body: { case_key: key, open: !!open, why: why } }).then(function (r) {
    /* ⚠ reload rather than patch the row: the closed ones are a different query, and guessing what the
       server now holds is how a list and its source drift apart */
    /* ⚠ a thing that disappears without a word is the complaint this feature answers, not a new one */
    if (typeof toast === 'function') {
      toast(open ? 'Opened again.' : 'Closed \u2014 it is in Test lab \u203a Findings \u203a Closed.');
    }
    /**
     * ── ⚠️⚠️⚠️ IT REPAINTED THE LAB, AND THE BUTTON IS IN THE POPUP ──────────────────────────────────────
     *
     * Athi, 2026-09-13: *"when I close a case in the Cases tab, the closed one should leave the queue or
     * change the status — it is still the same."*
     *
     * ⚠️⚠️ AND THE WRITE HAD WORKED EVERY TIME. The case was retired on the server, both lists were dropped
     * and re-read — and then `testPaint()` redrew `#cbtestbody`, which is the LAB. The Cases tab is in
     * `#cbcasespanel`, the panel that opens on a screen, and nothing redrew it. So the row a person had just
     * closed sat there unchanged, and the only honest conclusion is that the button does nothing.
     *
     * ⭐ THIS IS THE THIRD TIME THE SAME SHAPE OF FAULT HAS BEEN FIXED TODAY (the Findings row after a
     * verdict; the Incidents list after a resolve) and it is why `testNewsRefresh` exists: ONE function that
     * re-reads whatever is loaded and repaints BOTH frames. Calling a painter directly is the bug.
     * [[feedback-no-duplicate-functions]]
     */
    return testNewsRefresh('case');
  }).catch(function (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not change it.'); });
}

function testHandCases() {
  return (CBTEST.cases || [])
    .filter(function (c) { return /-H\d+$/.test(String(c.case_key || '')); })
    .sort(function (a, b) { return String(b.case_key) < String(a.case_key) ? -1 : 1; });
}

/**
 * ── ⭐⭐⭐ WHAT WE FOUND, AND WHAT IS STILL OPEN ──────────────────────────────────────────────────────────────
 *
 * ⚠️ EVERYBODY’S, NOT JUST YOURS. Athi asked *"irrespective of the user?"* — yes, and that has to be the
 * default. A test board that shows you only your own findings cannot answer the question a team actually has,
 * which is what did WE find. RLS already keeps it to this shop; within the shop, testing is a shared act.
 * ⭐ "Mine" is a filter on top, for the afternoon when you want your own list back.
 */
/**
 * ⚠️ THE NAME IS FOR READING, THE ID IS FOR DECIDING. `testHandHTML` matches "mine" on SESSION.name because
 * that is what the old rows carry; this is the answer for anything that must be RIGHT rather than readable —
 * whose turn it is to retest a fix. Missing on an old row, and a row we cannot attribute is never "mine".
 */
function testMeId() {
  /* ⚠️ ONE OWNER: core.js answers this for the whole app (cbMeId). A second copy here would drift the day
     one of them learned about co-assist logins and the other did not. */
  try { return (typeof cbMeId === 'function' ? cbMeId() : '') || ''; } catch (_) { return ''; }
}

function testFindWho() {
  try { return localStorage.getItem('cb_find_who') || 'all'; } catch (_) { return 'all'; }
}
function testFindSetWho(v) {
  try { localStorage.setItem('cb_find_who', v); } catch (_) {}
  testPaint();
}

/**
 * ── ⭐⭐⭐ THE WORKLIST — ONE LIST, ONE STATUS PER ROW, AND WHAT TO DO ABOUT IT ─────────────────────────────────
 *
 * Athi, 2026-09-13: *"assume I create 9 records, 3 are pass, 3 are incidents and 3 are requirements — we need to
 * have a list and each one is expected to retest and close … this is really confusing: what am I looking at,
 * where do I find the existing one, where do I see the closed one?"* and *"use an existing standard or tool
 * which is there in the open source and reflect the same."*
 *
 * ⚠️⚠️ THE DATA WAS NEVER THE PROBLEM — THE SHELVING WAS. One finding lived in as many as three places at once:
 * a case on the Cases board, a result in the ledger, and an incident on the Incidents board, each with its own
 * filter row and its own words. Nothing anywhere answered the only question a tester actually has, which is
 * "what is waiting for ME". So he wrote nine things down and could not find them.
 *
 * ── ⭐⭐ ADOPTED: THE TEST-RUN STATUS MODEL (TestRail · Xray · Kiwi TCMS all share it) ─────────────────────────
 *
 * Every one of those tools puts ONE list in front of a tester — the run — where each row is a case carrying its
 * latest status, and defects hang off the row rather than living on a board of their own.
 * ⭐⭐ AND `RETEST` IS A FIRST-CLASS STATUS IN TestRail, sitting between Failed and Passed. That is precisely the
 * state Athi described and precisely the one we had no word for: somebody says it is fixed, and the person who
 * reported it has not looked yet. [[feedback-adopt-dont-reinvent]]
 *
 * ⚠️ ONE STATUS IS OURS AND SAYS SO: `Change asked`. TestRail has no equivalent because a test tool assumes the
 * requirement is settled and only the product can be wrong. Athi's case (c) is the opposite — the product does
 * what it was told and the instruction was wrong — and folding that into "Failed" would count a design decision
 * as a defect, which is the number every quality report is judged on.
 *
 * ⚠️ NOTHING NEW IS STORED FOR THIS. The status is DERIVED, on read, from three things that were already true:
 * the case, its latest result, and the state of whatever it raised. A seventh stored copy is a seventh thing to
 * drift; a derived one cannot disagree with the board it is drawn from.
 */
var TEST_WORK = {
  todo:    { label: 'To do',        tell: 'run it',                    ink: 'var(--note,#8a8378)' },
  passed:  { label: 'Passed',       tell: 'nothing — it works',        ink: 'var(--ok-2,#1B7F4B)' },
  failed:  { label: 'Failed',       tell: 'waiting for a fix',         ink: 'var(--disp,#B3261E)' },
  blocked: { label: 'Blocked',      tell: 'it could not be run',       ink: 'var(--warn-2,#8a6100)' },
  retest:  { label: 'Retest',       tell: 'YOURS — look again',        ink: 'var(--warn-2,#8a6100)' },
  change:  { label: 'Change asked', tell: 'waiting for a decision',    ink: 'var(--grey-2,#545A61)' },
  /**
   * ⚠️⚠️ ACCEPTED IS NOT DONE, AND FOLDING IT INTO CLOSED WAS A LIE THE WORKLIST TOLD. Somebody agreeing
   * that a thing should be built is a DECISION; the thing still does not exist. A board that files it under
   * Closed reports a product that does what it was asked, when nobody has written the code — and the row
   * that most needs chasing is the one that has vanished from the list.
   */
  agreed:  { label: 'Agreed',       tell: 'waiting to be built',       ink: 'var(--grey-2,#545A61)' },
  closed:  { label: 'Closed',       tell: 'done',                      ink: 'var(--ok-2,#1B7F4B)' },
};
var TEST_WORK_ORDER = ['retest', 'todo', 'failed', 'change', 'agreed', 'blocked', 'passed', 'closed'];

/**
 * ⭐ ONE ROW PER THING A PERSON DID, and the join is made here rather than stored.
 *
 * ⚠️ AN INCIDENT OR A REQUIREMENT RAISED WITHOUT A CASE IS STILL A ROW. The box in the panel can raise one
 * directly, and a worklist that only showed things with a case behind them would be a worklist that hides work.
 */
function testWork() {
  var rows = [];
  var inc = CBTEST.scrInc || [], req = CBTEST.scrReq || [];
  var incBy = {}, reqBy = {}, used = {};
  inc.forEach(function (x) { if (x.found_by_case) (incBy[x.found_by_case] = incBy[x.found_by_case] || []).push(x); });
  req.forEach(function (q) { if (q.raised_from) (reqBy[q.raised_from] = reqBy[q.raised_from] || []).push(q); });

  /**
   * ⚠️⚠️ TWO PLACES HOLD "THE LATEST WORD PER CASE" AND ONLY ONE OF THEM IS ALWAYS LOADED. `CBTEST.last` is
   * built by testLoad, which runs when the board is read; `CBTEST.scrRes` is fetched by testScrLoad, which the
   * worklist FORCES on arrival. Reading only the first showed three passed cases as "To do" — a worklist that
   * tells a tester to run something they have already run, which is the fastest way to make it ignored.
   * ⭐ Whichever is there; `CBTEST.last` wins because it applies the worst-result rule.
   */
  var lastOf = {};
  (CBTEST.scrRes || []).forEach(function (r) { if (r && r.case_key) lastOf[r.case_key] = r; });
  Object.keys(CBTEST.last || {}).forEach(function (k) { lastOf[k] = CBTEST.last[k]; });

  var cases = (CBTEST.cases || []).concat(CBTEST.closedCases || []);
  cases.forEach(function (c) {
    var key = c.case_key || '';
    /* ⚠️ THE HAND-WRITTEN ONES ONLY. The board also holds 1,455 documented cases; putting them in the worklist
       would bury the nine things a person wrote today under a thousand they have never touched. */
    if (!/-H\d+$/.test(key)) return;
    var last = lastOf[key] || null;
    var mine = (incBy[key] || []).concat([]);
    var wants = (reqBy[key] || []).concat([]);
    mine.forEach(function (x) { used[x.definition_id] = 1; });
    wants.forEach(function (q) { used[q.definition_id] = 1; });
    rows.push(testWorkRow({
      key: key, title: c.title || '', screen: c.screen_code || c.module_key || '',
      seen: c.observed || null, shot: c.evidence_id || null,
      by: c.written_by || null, at: c.written_at || c.changed_at || null,
      retired: c.status === 'retired', last: last, inc: mine[0] || null, req: wants[0] || null,
      caseKey: key,
    }));
  });

  /* the ones raised straight from the box, with no case behind them */
  inc.forEach(function (x) {
    if (used[x.definition_id]) return;
    rows.push(testWorkRow({ key: x.ref || '', title: x.observed || '', screen: x.screen_code || '',
      shot: x.evidence_id || null, by: x.raised_by || null, at: x.raised_at || null,
      last: null, inc: x, req: null, caseKey: null }));
  });
  req.forEach(function (q) {
    if (used[q.definition_id]) return;
    rows.push(testWorkRow({ key: q.clause || '', title: q.requirement || '', screen: q.screen_code || '',
      by: q.raised_by || null, at: q.raised_at || null,
      last: null, inc: null, req: q, caseKey: null }));
  });

  /* ⭐ WHAT IS WAITING ON YOU COMES FIRST, then the rest by the order of the status strip, then newest. A
     worklist sorted by date is a diary; sorted by what it is waiting for, it is a worklist. */
  return rows.sort(function (a, b) {
    var d = TEST_WORK_ORDER.indexOf(a.status) - TEST_WORK_ORDER.indexOf(b.status);
    if (d) return d;
    if (a.forMe !== b.forMe) return a.forMe ? -1 : 1;
    return String(b.at || '') < String(a.at || '') ? -1 : 1;
  });
}

/**
 * ⚠️⚠️ THE ONE PLACE THE STATUS IS DECIDED. Two rules that disagree about what "closed" means is how a board
 * starts lying, and there were three of them before this: one in testFindings, one in the Incidents view and
 * one in the tally at the top of the panel.
 */
function testWorkRow(r) {
  var meId = testMeId();
  var st = 'todo';
  var i = r.inc, q = r.req, last = r.last;

  if (i) {
    st = (i.state === 'closed') ? 'closed'
       : (i.state === 'resolved') ? 'retest'
       : 'failed';
  } else if (q) {
    st = (q.state === 'rejected' || q.state === 'implemented') ? 'closed'
       : (q.state === 'accepted') ? 'agreed' : 'change';
  } else if (r.retired) {
    st = 'closed';
  } else if (last && last.status === 'pass') {
    st = 'passed';
  } else if (last && last.status === 'blocked') {
    st = 'blocked';
  } else if (last && last.status === 'fail') {
    /* ⚠️ FAILED WITH NOTHING RAISED IS STILL FAILED, and it is the row most likely to be forgotten: a red
       verdict nobody turned into an incident is a fault that exists and is on nobody's list. */
    st = 'failed';
  } else if (r.retired) {
    st = 'closed';
  }

  var raiser = (i && (i.raised_by_id || null)) || null;
  return {
    key: r.key, title: r.title, screen: r.screen, seen: r.seen || (i && i.observed) || null,
    shot: r.shot || (i && i.evidence_id) || null, by: r.by, at: r.at,
    caseKey: r.caseKey, inc: i, req: q, last: last, status: st,
    sev: i ? i.severity : null,
    /* ⭐ everything the Lab’s own incident row used to draw itself, carried here so there is only one row.
       Each is optional and renders only when present, which is what lets one renderer serve three surfaces. */
    means: i ? (i.severity_means || null) : null,
    affected: i ? (i.affected || null) : null,
    popup: (i && i.popup_code) || (q && q.popup_code) || null,
    pri: q ? (q.priority || null) : null,
    /* ⚠️ TWO CLOCKS, and neither is stored: how long before anybody noticed, and how long it then took.
       A stored duration stops being true the moment the row changes and still prints a number. */
    unnoticed: i ? (i.unnoticed_mins || null) : null,
    openMins: i ? (i.open_mins || null) : null,
    /* ⭐ only the person who reported it is asked to retest — telling everyone gets it verified by nobody */
    forMe: st === 'retest' && !!meId && String(raiser || '') === String(meId),
    fixed: (i && (i.changes || [])[(i.changes || []).length - 1]) || null,
    why: (i && i.why) || (q && q.why) || null,
  };
}

function testWorkFilterGet() {
  try { return localStorage.getItem('cb_work_filter') || 'live'; } catch (_) { return 'live'; }
}
function testWorkFilter(v) {
  try { localStorage.setItem('cb_work_filter', v); } catch (_) {}
  testPaint();
}

function testWorkHTML() {
  var all = testWork();
  var f = testWorkFilterGet();

  if (!all.length) {
    return '<div style="font-size:var(--fs-2);color:var(--grey-2);padding:12px 2px;line-height:1.6">'
      + '<b>Nothing on your worklist yet.</b><br>'
      + 'Open any screen with test mode on, press its code in the corner, and use <b>Create</b>. '
      + 'Whatever you write — a test case, an incident or a requirement — lands here with a status, '
      + 'and stays here until it is closed.</div>';
  }

  var n = {};
  TEST_WORK_ORDER.forEach(function (k) { n[k] = 0; });
  all.forEach(function (x) { n[x.status] = (n[x.status] || 0) + 1; });
  var live = all.filter(function (x) { return x.status !== 'closed'; });
  var mine = all.filter(function (x) { return x.forMe; });

  var rows = f === 'live' ? live
           : f === 'all' ? all
           : f === 'mine' ? mine
           : all.filter(function (x) { return x.status === f; });

  var chip = TEST_CHIP;
  /* ⚠️ the two rows must be separately addressable: "Closed" is a shelf on the first row and a status on the
     second, and one id for both is a control nothing outside the page can name unambiguously. */
  var seg = function (id, label, count, row) {
    return '<button data-testid="' + (row || 'workf') + '-' + id + '" '
      + 'onclick="testWorkFilter(\'' + id + '\')" style="' + chip
      + (f === id ? TEST_CHIP_ON : TEST_CHIP_OFF) + '">' + label
      + (count == null ? '' : ' <b>' + count + '</b>') + '</button>';
  };

  /**
   * ⭐ THE BAND FIRST, AND ONLY WHEN THERE IS ONE. "What is waiting for me" is the question a tester opens this
   * panel to answer; a filter they have to think to apply is not an answer.
   */
  var h = '';
  if (mine.length) {
    h += '<div data-testid="work-yours" style="margin:2px 0 7px;padding:7px 9px;border-radius:8px;'
      + 'border:1px solid var(--warn-2,#8a6100);background:var(--warn-tint,#fdf6e6);font-size:var(--fs-1)">'
      + '<b>' + mine.length + ' waiting for you to retest.</b> Somebody says they fixed what you reported. '
      + 'Look again, then say whether it holds — until you do, it is a claim and not a fix.'
      + ' <button onclick="testWorkFilter(\'mine\')" style="' + chip
      + 'background:var(--warn-2,#8a6100);color:#fff">Show them</button></div>';
  }

  h += '<div style="margin:4px 0 3px">'
    + '<span style="font-size:var(--fs-1);color:var(--note);margin-inline-end:5px">Show:</span>'
    + seg('live', 'Still open', live.length)
    + (mine.length ? seg('mine', 'Yours to retest', mine.length) : '')
    + seg('closed', 'Closed', n.closed)
    + seg('all', 'Everything', all.length)
    + '</div>'
    /* the seven statuses, as counts you can press — this is the "where do I see the closed one" answer */
    + '<div style="margin:0 0 7px">'
    + '<span style="font-size:var(--fs-1);color:var(--note);margin-inline-end:5px">Status:</span>'
    /* ⚠️ Closed is not repeated here — it is a shelf on the row above, and the same word twice on one
       screen is the fault this whole afternoon was about */
    + TEST_WORK_ORDER.filter(function (k) { return n[k] && k !== 'closed'; }).map(function (k) {
        return seg(k, TEST_WORK[k].label, n[k], 'workst');
      }).join('')
    + '</div>';

  if (!rows.length) {
    return h + '<div style="font-size:var(--fs-1);color:var(--note);padding:8px 0">'
      + (f === 'closed' ? 'Nothing has been closed yet.'
       : f === 'live' ? 'Nothing open — everything you have written has been dealt with.'
       : 'Nothing in this status. ' + all.length + ' altogether.') + '</div>';
  }

  h += '<div style="font-size:var(--fs-1);color:var(--grey-2);padding:0 0 6px">'
    + '<b>' + rows.length + '</b> of ' + all.length + ' · what you have written on a screen, with its status '
    + 'and what happens next. Every row ends in <b>Closed</b>.</div>';

  h += rows.map(testWorkRowHTML).join('');
  return h;
}

/** one row: what it is · where · its status · what to do · and the buttons that do it */
function testWorkRowHTML(x) {
  var W = TEST_WORK[x.status] || TEST_WORK.todo;
  var act = 'display:inline-block;width:auto;font-size:var(--fs-1);padding:2px 9px';
  var b = function (label, onclick, colour, title) {
    return '<button class="btn" style="' + act + (colour ? ';border-color:' + colour + ';color:' + colour : '')
      + '" title="' + (title || '') + '" onclick="' + onclick + '">' + label + '</button> ';
  };
  var id = x.inc ? String(x.inc.definition_id) : (x.req ? String(x.req.definition_id) : '');

  var acts = '';
  if (x.status === 'retest') {
    acts += b('✓ It holds — close', 'testVerify(\'' + id + '\',true)', 'var(--ok-2,#1B7F4B)',
              'You have looked and it is fixed. This ends it.');
    acts += b('✗ Still broken', 'testVerify(\'' + id + '\',false)', 'var(--disp,#B3261E)',
              'Send it back to whoever fixed it');
  } else if (x.status === 'failed' && x.inc) {
    acts += b('Mark it fixed', 'testFindFixed(\'' + id + '\')', null,
              'You believe it is fixed — the person who raised it is asked to retest');
    acts += b('✓ Close it', 'testFindClose(\'inc\',\'' + id + '\',\'\',false)', 'var(--ok-2,#1B7F4B)',
              'It is done and needs no retest');
  } else if (x.status === 'failed' && x.caseKey) {
    /* ⚠️ a red verdict with nothing raised is a fault on nobody's list — this is the row that fixes that */
    acts += b('Raise an incident', 'testFromCase(\'' + x.caseKey + '\',\'inc\',null,\''
      + testEsc(String(x.seen || 'It failed').replace(/'/g, ' ')) + '\')', 'var(--disp,#B3261E)',
      'Turn this red verdict into something somebody owns');
  } else if (x.status === 'change') {
    acts += b('✓ Accept it', 'testReqSet(\'' + id + '\',\'accepted\')', 'var(--ok-2,#1B7F4B)',
              'Agree it should be built \u2014 it then waits to be built, it is not closed');
    acts += b('✗ Reject it', 'testReqSet(\'' + id + '\',\'rejected\')', 'var(--disp,#B3261E)',
              'Say no, with the reason');
  } else if (x.status === 'agreed') {
    acts += b('It is built', 'testReqSet(\'' + id + '\',\'implemented\')', 'var(--ok-2,#1B7F4B)',
              'The product does this now');
    acts += b('✗ Reject it', 'testReqSet(\'' + id + '\',\'rejected\')', 'var(--disp,#B3261E)',
              'Changed our mind, with the reason');
  } else if (x.status === 'todo' && x.caseKey) {
    acts += b('✓ It passed', 'testMark(\'' + x.caseKey + '\',\'pass\')', 'var(--ok-2,#1B7F4B)', 'Run it now');
    acts += b('✗ It failed', 'testMark(\'' + x.caseKey + '\',\'fail\')', 'var(--disp,#B3261E)',
              'Then raise an incident from the row');
  } else if (x.status === 'passed' && x.caseKey) {
    acts += b('Run it again', 'testMark(\'' + x.caseKey + '\',\'pass\')', null, 'Record another pass');
  } else if (x.status === 'closed' && x.caseKey && !x.inc && !x.req) {
    acts += b('Open again', 'testHandClose(\'' + x.caseKey + '\',true)', null, 'Put it back on the list');
  }
  if (x.screen) acts += b('Open ' + testEsc(x.screen), 'testHandOpen(\'' + testEsc(x.screen) + '\')', null,
                          'Go to the screen it is about');
  /**
   * ⭐ RE-GRADING IS A JUDGEMENT AND BELONGS WITH THE OTHER ACTIONS. What looked like one awkward screen
   * turns out to be the till, and the first person to file it is the least informed person who will ever
   * look at it. ⚠️ Only while it is still open: on a closed row it would rewrite history for no purpose —
   * the severity somebody worked to is part of what happened.
   */
  if (x.inc && (x.status === 'failed' || x.status === 'todo')) {
    acts += '<select onchange="testIncSev(\'' + id + '\', this.value)" title="Re-grade it" '
      + 'style="font:inherit;font-size:var(--fs-1);padding:2px 5px;border:1px solid var(--line,#e7e3d8);'
      + 'border-radius:7px;background:var(--card,#fff);margin-inline-end:5px">'
      + TEST_INC_SEV.map(function (v) {
          return '<option' + (v === x.sev ? ' selected' : '') + '>' + v + '</option>';
        }).join('') + '</select> ';
  }
  if (x.shot) acts += b('🖼 Screenshot', 'testShotView(\'' + testEsc(x.shot) + '\')', null, '');

  var shut = x.status === 'closed';
  return '<div data-testid="work-row" style="padding:8px 0;border-top:1px solid var(--line,#efece4)'
    + (shut ? ';opacity:.6' : '')
    + (x.forMe ? ';border-inline-start:3px solid var(--warn-2,#8a6100);padding-inline-start:7px' : '') + '">'
    /* ⭐ THE STATUS FIRST AND IN ONE PLACE — the whole complaint was not knowing what he was looking at */
    + '<div style="display:flex;gap:7px;align-items:baseline;flex-wrap:wrap">'
    +   '<span data-testid="work-status" style="font-size:var(--fs-1);font-weight:700;border-radius:5px;'
    +     'padding:1px 8px;color:#fff;background:' + W.ink + '">' + W.label + '</span>'
    +   (x.key ? '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(x.key) + '</code>' : '')
    +   (x.sev ? '<span style="font-size:var(--fs-1);color:var(--disp,#B3261E)" title="'
        + testEsc(x.means || '') + '">' + testEsc(x.sev) + '</span>' : '')
    +   (x.pri ? '<span style="font-size:var(--fs-1);color:var(--note)">' + testEsc(x.pri)
        + '</span>' : '')
    +   (x.popup ? '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(x.popup)
        + '</code>' : '')
    +   '<b style="font-size:var(--fs-2);flex:1 1 14em;min-width:0">' + testEsc(x.title) + '</b>'
    + '</div>'
    /* ⭐ AND WHAT HAPPENS NEXT, in words, on every row. "Failed" tells you the past; this tells you the job. */
    + '<div style="font-size:var(--fs-1);margin-top:2px;color:'
    +   (x.forMe ? 'var(--warn-2,#8a6100);font-weight:700' : 'var(--grey-2)') + '">'
    +   'next: ' + (x.forMe ? 'YOURS — retest it and say whether it holds' : W.tell) + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:1px">'
    +   (x.screen ? '<b>' + testEsc(x.screen) + '</b> ' + testEsc(codeName(x.screen) || '') + ' · ' : '')
    +   (x.by ? 'by ' + testEsc(x.by) : 'author not recorded')
    +   (x.at ? ' · ' + testEsc(String(x.at).slice(0, 16).replace('T', ' ')) : '')
    +   (x.inc ? ' · incident <code>' + testEsc(x.inc.ref || '') + '</code>' : '')
    +   (x.req ? ' · requirement <code>' + testEsc(x.req.clause || '') + '</code>' : '')
    +   (x.affected ? ' · ' + testEsc(x.affected) : '')
    + '</div>'
    /* ⭐ THE SEVERITY IN WORDS AND THE TWO CLOCKS — shown only when they say something. "0 min unnoticed"
       is noise on a row somebody recorded while it was happening; an hour unnoticed IS the story. */
    + ((x.means || x.unnoticed || x.openMins)
      ? '<div style="font-size:var(--fs-1);color:var(--note);margin-top:1px">'
        + [x.means, x.unnoticed ? (x.unnoticed + ' min before anybody knew') : null,
           x.openMins ? (x.openMins + ' min to resolve') : null]
          .filter(Boolean).map(testEsc).join(' \u00b7 ') + '</div>'
      : '')
    + (x.seen ? '<div style="font-size:var(--fs-1);margin-top:1px">seen: ' + testEsc(x.seen) + '</div>' : '')
    + (x.fixed ? '<div style="font-size:var(--fs-1);margin-top:3px;padding:4px 7px;'
        + 'background:var(--warn-tint,#fdf6e6);border-radius:6px">fixed: '
        + testEsc(x.fixed.subject || x.fixed.sha || '') + (x.fixed.by ? ' · ' + testEsc(x.fixed.by) : '')
        + '</div>' : '')
    + (shut && x.why ? '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:3px">closed: '
        + testEsc(x.why) + '</div>' : '')
    + '<div style="margin-top:5px">' + acts + '</div>'
    + '</div>';
}

function testHandHTML() {
  var all = testFindings();
  if (!all.length) {
    return '<div style="font-size:var(--fs-1);color:var(--note);padding:10px 0">'
      + 'Nothing found by hand yet. Turn on test mode, open any screen, and use the Test chip \u2014 every case, '
      + 'requirement and incident written there lands here.</div>';
  }

  var f = testHandFilterGet();
  var who = testFindWho();
  var me = (typeof SESSION !== 'undefined' && (SESSION.name || SESSION.handle)) || '';
  var meId = testMeId();
  /* ⚠️ EITHER, BECAUSE THE ROWS ARE NOT ALL THE SAME AGE. Older findings carry only the name they were
     written under; newer ones carry the id. Matching on one alone hides half of somebody's own work. */
  var mine = function (x) {
    return (meId && String(x.byId || '') === String(meId)) || (me && String(x.by || '') === String(me));
  };

  var pool = all;
  if (who === 'mine') pool = pool.filter(mine);
  var nOpen = pool.filter(function (x) { return x.state === 'open'; }).length;
  var nVer = pool.filter(function (x) { return x.state === 'verify'; }).length;
  var nShut = pool.length - nOpen - nVer;
  var rows = f === 'closed' ? pool.filter(function (x) { return x.state === 'closed'; })
           : f === 'verify' ? pool.filter(function (x) { return x.state === 'verify'; })
           : f === 'all' ? pool
           : pool.filter(function (x) { return x.state === 'open'; });

  /**
   * ── ⭐⭐⭐ "WAITING FOR YOU" GOES ABOVE EVERYTHING ─────────────────────────────────────────────────────
   *
   * ⚠️ A FIX NOBODY VERIFIES IS A FIX NOBODY HAS. The one row that must never be scrolled past is the one
   * where somebody has answered YOUR report and is waiting on your word — so it is not a filter you have to
   * think to apply, it is a line at the top that says how many and puts you in front of them.
   * ⚠️ Only when there are some: a permanent empty banner is furniture, and furniture stops being read.
   */
  var waiting = all.filter(function (x) {
    return x.state === 'verify' && meId && String(x.byId || '') === String(meId);
  });

  var chip = 'font:inherit;font-size:var(--fs-1);padding:1px 8px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;margin-inline-end:4px;';
  var on = 'background:var(--ink,#0F2E3D);color:var(--card,#fff);border-color:var(--ink,#0F2E3D)';
  var off = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';

  var h = '';
  if (waiting.length) {
    h += '<div style="margin:6px 0 4px;padding:7px 9px;border-radius:8px;border:1px solid var(--ok-2,#1B7F4B);'
      + 'background:var(--ok-tint,#eaf5ee);font-size:var(--fs-1)">'
      + '<b>' + waiting.length + ' fixed — waiting for your retest.</b> '
      + 'Somebody answered what you reported. Open the screen, look, then say whether it holds — until you do, '
      + 'it is a claim and not a fix.'
      + ' <button onclick="testHandFilter(\'verify\')" style="font:inherit;font-size:var(--fs-1);'
      + 'margin-inline-start:6px;padding:1px 8px;border-radius:7px;cursor:pointer;border:1px solid '
      + 'var(--ok-2,#1B7F4B);background:var(--ok-2,#1B7F4B);color:#fff">Show them</button></div>';
  }

  h += '<div style="margin:6px 0 2px">'
    + [['open', 'Open', nOpen], ['verify', 'To retest', nVer], ['closed', 'Closed', nShut], ['all', 'All', pool.length]]
      .map(function (x) {
        return '<button onclick="testHandFilter(\'' + x[0] + '\')" style="' + chip
          + (f === x[0] ? on : off) + '">' + x[1] + ' <b>' + x[2] + '</b></button>';
      }).join('')
    + '<span style="display:inline-block;width:14px"></span>'
    + [['all', 'Everyone', all.length], ['mine', 'Mine', all.filter(mine).length]]
      .map(function (x) {
        return '<button onclick="testFindSetWho(\'' + x[0] + '\')" style="' + chip
          + (who === x[0] ? on : off) + '">' + x[1] + ' <b>' + x[2] + '</b></button>';
      }).join('')
    + '</div>';

  h += '<div style="font-size:var(--fs-1);color:var(--grey-2);padding:2px 0 8px">'
    + '<b>' + rows.length + '</b> finding(s) raised by a person on a screen, newest first \u2014 cases, '
    + 'requirements and incidents together. Each one closes with a reason.</div>';

  if (!rows.length) {
    return h + '<div style="font-size:var(--fs-1);color:var(--note);padding:6px 0">'
      + (f === 'closed' ? 'Nothing has been closed yet.'
       /* \u26a0\ufe0f AN EMPTY "TO RETEST" IS GOOD NEWS AND MUST READ AS IT. "Nothing open" here would be a lie: there
          may be plenty open, just nothing anybody has claimed to have fixed. */
       : f === 'verify' ? 'Nothing is waiting to be retested \u2014 every fix claimed so far has been checked.'
       : 'Nothing open \u2014 everything found has been dealt with.') + '</div>';
  }

  var KIND = { 'case': ['Case', 'var(--grey-2,#545A61)', 'var(--neutral-tint)'],
               req: ['Requirement', 'var(--grey-2,#545A61)', 'var(--neutral-tint)'],
               inc: ['Incident', 'var(--disp,#B3261E)', 'var(--danger-tint,#fbeceb)'] };

  h += rows.map(function (x) {
    var k = KIND[x.kind] || ['?', 'var(--note)', 'var(--neutral-tint)'];
    var shut = x.state === 'closed';
    /* ⚠️ a resolved incident is NOT faded and NOT filed: it is the loudest row on the board until somebody
       has actually looked at it again */
    var ver = x.state === 'verify';
    var forMe = ver && meId && String(x.byId || '') === String(meId);
    return '<div style="padding:8px 0;border-top:1px solid var(--line,#efece4)'
      + (shut ? ';opacity:.62' : '')
      + (forMe ? ';border-inline-start:3px solid var(--ok-2,#1B7F4B);padding-inline-start:7px' : '') + '">'
      /* the kind first: a requirement and an incident read differently and must never be skimmed as one */
      + '<div style="display:flex;gap:7px;align-items:baseline;flex-wrap:wrap">'
      +   '<span style="font-size:var(--fs-1);font-weight:700;border-radius:5px;padding:1px 7px;color:'
      +     k[1] + ';background:' + k[2] + '">' + k[0] + '</span>'
      +   (x.sev ? '<span style="font-size:var(--fs-1);color:var(--disp,#B3261E)">' + testEsc(x.sev)
        + '</span>' : '')
      +   (x.key ? '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(x.key) + '</code>' : '')
      +   '<b style="font-size:var(--fs-2);flex:1 1 14em;min-width:0">' + testEsc(x.title) + '</b>'
      +   '<span style="font-size:var(--fs-1);font-weight:700;color:'
      +     (shut ? 'var(--ok-2,#1B7F4B)' : ver ? 'var(--warn-2,#8a6100)' : 'var(--note)') + '">'
      +     testEsc((x.stateWord || (shut ? 'closed' : 'open')).toUpperCase()) + '</span>'
      +   (forMe ? '<span style="font-size:var(--fs-1);font-weight:700;color:var(--ok-2,#1B7F4B)">'
        + '· yours to retest</span>' : '')
      + '</div>'
      /* where, who and when — the three things a finding is useless without */
      + '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:2px">'
      +   (x.screen ? '<b>' + testEsc(x.screen) + '</b> ' + testEsc(codeName(x.screen) || '') + ' \u00b7 ' : '')
      +   (x.by ? 'by ' + testEsc(x.by) : 'author not recorded')
      +   (x.at ? ' \u00b7 ' + testEsc(String(x.at).slice(0, 16).replace('T', ' ')) : '')
      + '</div>'
      + (x.doIt ? '<div style="font-size:var(--fs-1);color:var(--grey-2)">do: ' + testEsc(x.doIt)
          + '</div>' : '')
      + (x.exp ? '<div style="font-size:var(--fs-1);color:var(--grey-2)">should see: ' + testEsc(x.exp)
          + '</div>' : '')
      + (x.seen ? '<div style="font-size:var(--fs-1);margin-top:1px">seen: ' + testEsc(x.seen) + '</div>' : '')
      /* ⭐ the answer travels with the question: what was changed, by whom, so a retest starts informed */
      + (ver ? '<div style="font-size:var(--fs-1);margin-top:3px;padding:4px 7px;background:var(--warn-tint,#fdf6e6);'
          + 'border-radius:6px">fixed: ' + testEsc((x.fixedBy && (x.fixedBy.subject || x.fixedBy.sha)) || x.closedNote
            || 'no account given') + (x.fixedBy && x.fixedBy.by ? ' · ' + testEsc(x.fixedBy.by) : '') + '</div>' : '')
      /* the account of the closure, which is the whole point of asking for one */
      + (shut && x.closedNote
          ? '<div style="font-size:var(--fs-1);color:var(--grey-2);margin-top:3px;padding:4px 7px;'
            + 'background:var(--paper,#faf8f3);border-radius:6px">closed: ' + testEsc(x.closedNote)
            + (x.closedBy ? ' \u00b7 ' + testEsc(x.closedBy) : '') + '</div>'
        : shut ? '<div style="font-size:var(--fs-1);color:var(--note);margin-top:3px">closed, no reason recorded</div>' : '')
      + (x.last ? '<div style="font-size:var(--fs-1);color:var(--note);margin-top:2px">'
          + testEsc(String(x.last.status).toUpperCase()) + ' by ' + testEsc(x.last.tester_name || 'someone')
          + '</div>' : '')
      /* ── the actions ── */
      + '<div style="margin-top:5px">'
      +   (x.screen ? '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);'
        + 'padding:2px 9px" onclick="testHandOpen(' + "'" + testEsc(x.screen) + "'" + ')">Open '
        + testEsc(x.screen) + '</button> ' : '')
      +   (x.shot ? '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);'
        + 'padding:2px 9px" onclick="testShotView(' + "'" + testEsc(x.shot) + "'" + ')">'
        + '\u1f5bc\ufe0f Screenshot</button> ' : '')
      /**
       * ⚠️⚠️ A RETEST HAS TWO ANSWERS AND BOTH MUST BE ONE CLICK. Give a person only "Close" and a fix that
       * did not work gets closed anyway, because reopening means finding the other view and typing a state
       * name. The cheap button is the one that gets pressed, so make BOTH cheap.
       */
      +   (ver ? '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);'
        + 'padding:2px 9px;border-color:var(--ok-2,#1B7F4B);color:var(--ok-2,#1B7F4B)" '
        + 'onclick="testVerify(\'' + testEsc(String(x.id || '')) + '\',true)">\u2713 Retested \u2014 it holds</button> '
        + '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);'
        + 'padding:2px 9px;border-color:var(--disp,#B3261E);color:var(--disp,#B3261E)" '
        + 'onclick="testVerify(\'' + testEsc(String(x.id || '')) + '\',false)">\u2717 Still broken</button>'
      /**
       * ⚠️ THE WORD ON THE BUTTON IS A PROMISE ABOUT THE STATE IT WILL WRITE. A requirement is DECIDED, not
       * closed, and the two decisions are different facts — so it gets both and neither is called "Close".
       */
      : shut ? '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);'
        + 'padding:2px 9px" onclick="testFindClose(\'' + x.kind + '\',\'' + testEsc(String(x.id || ''))
        + '\',\'' + testEsc(String(x.key || '')) + '\',true)">Open again</button>'
      : x.kind === 'req'
      ? '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);padding:2px 9px;'
        + 'border-color:var(--ok-2,#1B7F4B);color:var(--ok-2,#1B7F4B)" '
        + 'onclick="testReqSet(\'' + testEsc(String(x.id || '')) + '\',\'accepted\')">'
        + '\u2713 Accept it</button> '
        + '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);padding:2px 9px;'
        + 'border-color:var(--disp,#B3261E);color:var(--disp,#B3261E)" '
        + 'onclick="testReqSet(\'' + testEsc(String(x.id || '')) + '\',\'rejected\')">'
        + '\u2717 Reject it</button>'
      : x.kind === 'inc'
      ? '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);padding:2px 9px;'
        + 'border-color:var(--ok-2,#1B7F4B);color:var(--ok-2,#1B7F4B)" '
        + 'title="You have looked and it is done. This ends it and takes it off the board." '
        + 'onclick="testFindClose(\'inc\',\'' + testEsc(String(x.id || '')) + '\',\'\',false)">'
        + '\u2713 Close it</button> '
        + '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);padding:2px 9px" '
        + 'title="You believe it is fixed \u2014 the person who raised it is asked to retest" '
        + 'onclick="testFindFixed(\'' + testEsc(String(x.id || '')) + '\')">Mark it fixed</button>'
      : '<button class="btn" style="display:inline-block;width:auto;font-size:var(--fs-1);padding:2px 9px" '
      +     'onclick="testFindClose(\'' + x.kind + '\',\'' + testEsc(String(x.id || '')) + '\',\''
      +     testEsc(String(x.key || '')) + '\',false)">\u2713 Close</button>')
      + '</div>'
      + '</div>';
  }).join('');
  return h;
}
/**
 * ── ⭐⭐⭐ THE RAISER’S VERDICT, WHICH IS THE ONLY THING THAT CLOSES AN INCIDENT ────────────────────────────
 *
 * Athi, 2026-09-13: *"I test it, I create an incident, you fix it and then update the message back that it has
 * been fixed, so I can retest and confirm that this has been resolved and close it."*
 *
 * ⭐ TWO OUTCOMES, AND THEY ARE NOT SYMMETRICAL. "It holds" CLOSES the incident — an ending, so it is asked
 * for a word, exactly as every other closure on this board is. "Still broken" sends it back to `raised`, and
 * that word is not optional: a fix that is rejected with no account is a fix somebody will make twice.
 *
 * ⚠️ THE SERVER APPENDS, IT DOES NOT OVERWRITE. Both verdicts land in the incident’s history with who and
 * when, so "resolved on Tuesday, still broken on Wednesday, closed on Friday" is readable a year later —
 * which is the record an argument about whether something was ever fixed actually turns on.
 */
async function testVerify(id, held) {
  var q = held
    ? 'Retested and it holds. What did you check? (this closes it)'
    : 'Still broken — what did you see? It goes back to the person who fixed it.';
  var w = await testAsk(q, held ? 'This ends it and takes it off the board.'
    : 'It goes back to the person who fixed it.', held ? 'Close it' : 'Send it back');
  if (w === null) return;
  w = String(w).trim();
  if (!w) { if (typeof toast === 'function') toast(held ? 'Closing needs its reason.' : 'Say what you saw.'); return; }
  try {
    await api('testIncSet', { params: { id: id }, body: { state: held ? 'closed' : 'raised', why: w } });
    if (typeof toast === 'function') toast(held ? 'Closed — you verified it.' : 'Sent back — still broken.');
    await testNewsRefresh('incident');
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not set that.'); }
}

/** take me back to the screen this was written on, with its panel open */
function testHandOpen(code) {
  try {
    var row = ((window.CBSCREENS && CBSCREENS.rows) || []).filter(function (r) { return r.code === code; })[0];
    if (row && row.nav && typeof go === 'function') {
      var el = document.querySelector('[data-testid="nav-' + row.nav + '"]');
      if (el) el.click();
    }
    screenCasesPopup(code, codeName(code) || '');
  } catch (_) { screenCasesPopup(code, ''); }
}

function testViewToggleHTML() {
  var menu = CBTEST.view === 'menu', req = CBTEST.view === 'req', inc = CBTEST.view === 'inc',
      scr = CBTEST.view === 'scr';
  var base = 'font:inherit;font-size:var(--fs-1);padding:2px 8px;border:0;cursor:pointer;';
  var on = 'background:var(--ink,#0F2E3D);color:var(--card,#fff)';
  /* ⚠️ List is "on" only when neither of the others is — three segments, one filled */
  var off = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  return '<span style="display:inline-flex;border:1px solid var(--line,#e7e3d8);border-radius:7px;overflow:hidden">'
    /* ⭐ FIRST, because it is the one that answers "what is waiting for me" */
    + '<button data-testid="view-work" onclick="testSetView(\'work\')" title="Everything you have written, '
    +   'with its status and what happens next" style="' + base
    +   (CBTEST.view === 'work' ? on : off) + '">Worklist</button>'
    + '<button onclick="testSetView(\'list\')" title="Every case, grouped by area" '
    +   'style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);'
    +   (menu || req || CBTEST.view === 'work' ? off : on) + '">List</button>'
    + '<button onclick="testSetView(\'menu\')" title="The product as a menu \u2014 every door, and every '
    +   'control behind it" style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);'
    +   (menu && !req && !inc && !scr ? on : off) + '">Menu tree</button>'
    + '<button onclick="testSetView(\'req\')" title="Requirements raised while testing — what is not actioned yet" '
    +   'style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);' + (req ? on : off) + '">Requirements</button>'
    + '<button onclick="testSetView(\'inc\')" title="Incidents \u2014 what a person experienced, and what was '
    +   'done about it" style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);'
    +   (inc ? on : off) + '">Incidents</button>'
    + '<button onclick="testSetView(\'hand\')" title="Every case, requirement and incident a person raised on a screen" '
    +   'style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);'
    +   (CBTEST.view === 'hand' ? on : off) + '">Findings</button>'
    + '<button onclick="testSetView(\'scr\')" title="Every screen, and what the lab knows about it" '
    +   'style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);' + (scr ? on : off)
    +   '">By screen</button>'
    + '</span>';
}

function testFoldGet() {
  try { return JSON.parse(localStorage.getItem('cb_test_fold_panel') || '{}'); } catch (_) { return {}; }
}
function testFoldSet(o) { try { localStorage.setItem('cb_test_fold_panel', JSON.stringify(o)); } catch (_) {} }
function testSectionOpen(k, howMany) {
  var f = testFoldGet();
  if (f[k] !== undefined) return !!f[k];
  if (f._all !== undefined) return !!f._all;
  return howMany <= 2;
}
function testFold(k) { var f = testFoldGet(); f[k] = !testSectionOpen(k, 99); testFoldSet(f); testPaint(); }
function testFoldAll(open) { testFoldSet({ _all: !!open }); testPaint(); }

function testShortKey(k) {
  var s = String(k || '');
  return s.indexOf('/') < 0 ? s : s.slice(s.lastIndexOf('/') + 1);
}

/**
 * ── ⭐⭐⭐ THE PRODUCT AS A MENU, IN THE PANEL ───────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"yes, give the lab its own tree as well."*
 *
 * ⭐ THE SHAPE IS SHARED WITH THE REPORT (app/test-menu-tree.js) AND THE DRAWING IS NOT, which is the same
 * line already drawn for testVerdict and testCounts. A 420px panel cannot carry the Report’s full-width
 * tracks; making it try is how this panel’s rows once ended up sitting under the Report’s headings.
 *
 * ⚠️ IT DRAWS THE FILTERED LIST, not the whole board. The panel filters itself to the screen you are on, and
 * a tree that ignored that would answer a question nobody asked while the header says a filter is active.
 * ⭐ The door counts therefore describe what is SHOWN — and the line under the tree says so, because "0 of 3
 * run" means something different when it is 3 of 19 controls.
 */
function testMenuHTML(shown) {
  if (typeof testMenuTree !== 'function') {
    return '<div style="padding:10px;color:var(--grey-2,#545A61);font-size:var(--fs-1)">The menu\u2019s shape lives in app/test-menu-tree.js and it has not loaded. Press \u21bb to read the cases again.</div>';
  }
  var T = testMenuTree(shown, CBTEST.last);
  if (!T.groups.length) {
    /**
     * ⚠️⚠️ WHICH EMPTY IS THIS? Asked of the WHOLE board, not of the filtered view — that is the whole
     * distinction. A board with no menu anywhere is older than the sweep and needs loading; a board that has
     * doors none of which survived the filter needs the filter cleared. Telling a person to clear filters
     * when the data is stale sends them somewhere there is nothing to find.
     */
    var anyMenu = CBTEST.cases.some(function (c) { return !!c.menu; });
    if (!anyMenu) {
      return '<div style="padding:12px;font-size:var(--fs-2);line-height:1.6">'
        + '<b>This board is older than the menu sweep.</b><br>'
        + '<span style="color:var(--grey-2,#545A61)">None of its ' + CBTEST.cases.length + ' cases names a door yet, so there is no tree to draw. The 266 swept cases \u2014 one per control behind every door \u2014 are in the documented set, waiting to be read in.</span><br>'
        + '<button class="btn pri" onclick="testSeed()" style="margin-top:9px;font-size:var(--fs-2);padding:6px 14px">Load cases</button>'
        + '<div style="margin-top:6px;color:var(--grey-2,#545A61);font-size:var(--fs-1)">Safe to press: it is an upsert, and every result already recorded stays exactly where it is.</div></div>';
    }
    return '<div style="padding:12px;font-size:var(--fs-2);line-height:1.6">'
      + '<b>No door matches this filter.</b><br>'
      + '<span style="color:var(--grey-2,#545A61)">The board does hold swept cases \u2014 they are just not in view. Journey steps and automated files belong to no single door and never appear here.</span><br>'
      + '<button onclick="testClearFilters()" style="margin-top:9px;font:inherit;font-size:var(--fs-1);padding:3px 10px;border-radius:7px;border:1px solid var(--line,#e7e3d8);background:var(--card,#fff);cursor:pointer">Clear filters</button></div>';
  }

  var q = 'color:var(--grey-2,#545A61);font-size:var(--fs-1)';
  var h = '';

  /* ⭐ the root says what is being counted, since the panel is usually filtered */
  h += '<div style="padding:5px 4px 7px;font-size:var(--fs-2)"><b>' + T.total + '</b> case(s) behind <b>'
    + T.doors + '</b> door(s) in ' + T.groups.length + ' menu group(s)'
    + (T.offMenu ? ' <span style="' + q + '">\u00b7 ' + T.offMenu + ' not on the menu</span>' : '') + '</div>';

  T.groups.forEach(function (g) {
    var gkey = 'menu:' + g.name;
    var gopen = testSectionOpen(gkey, g.doors.length);
    /**
     * ⚠️ THE FOLD KEYS ARE THE SAME STRINGS THE REPORT USES (`menu:Rail`, `menu:Rail:Task`) but they are
     * stored under this panel’s own key — see testFoldGet. Two surfaces sharing a fold STATE would mean
     * collapsing a door here silently collapsed it on a board somebody else is reading.
     */
    h += '<div onclick="testFold(\'' + testEsc(gkey) + '\')" style="display:flex;gap:6px;align-items:baseline;cursor:pointer;padding:5px 6px;border-bottom:1px solid var(--line,#efece4)">'
      + '<span style="' + q + '">' + (gopen ? '\u25be' : '\u25b8') + '</span>'
      + '<b style="font-size:var(--fs-2)">' + testEsc(g.name) + '</b>'
      + '<span style="' + q + '">' + g.doors.length + ' door(s)</span>'
      + '<span style="flex:1 1 auto"></span>'
      + '<span style="' + q + ';font-variant-numeric:tabular-nums">' + g.run + ' of ' + g.total + ' run</span>'
      + (g.bad ? '<b style="color:var(--disp);font-size:var(--fs-1)">' + g.bad + ' red</b>' : '')
      + '</div>';
    if (!gopen) return;

    g.doors.forEach(function (d) {
      var dkey = 'menu:' + g.name + ':' + d.name;
      var dopen = testSectionOpen(dkey, d.cases.length);
      h += '<div onclick="testFold(\'' + testEsc(dkey) + '\')" style="display:flex;gap:6px;align-items:baseline;cursor:pointer;padding:4px 6px 4px 18px">'
        + '<span style="' + q + '">' + (dopen ? '\u25be' : '\u25b8') + '</span>'
        /* ⭐ THE SCREEN CODE, so a row of metrics can be quoted as 'CAT004 is 0 of 39'. Athi, 2026-09-12:
           *"so can you give the metrics by screen name as well?"* — the figures were already here; what was
           missing was the name to put in front of them. */
        + testScreenCode(g.name + ' › ' + d.name)
        + '<span style="font-size:var(--fs-2)">' + testEsc(d.name) + '</span>'
        + '<span style="flex:1 1 auto"></span>'
        /**
         * ⭐ THE THREE FIGURES A DOOR OWES A TESTER: how many controls, how many have ever been run, and how
         * many of those cases were SWEPT rather than written. ⚠️ The last one is what stops a door of green
         * ticks reading as proof — a swept pass says the control did something, not that it did the right
         * thing, because nobody has written what the right thing is.
         */
        + '<span style="' + q + ';font-variant-numeric:tabular-nums">' + d.run + ' of ' + d.total + ' run'
        +   (d.gen ? ' \u00b7 ' + d.gen + ' swept' : '') + '</span>'
        + (d.bad ? '<b style="color:var(--disp);font-size:var(--fs-1)">' + d.bad + '</b>' : '')
        + '</div>';
      if (!dopen) return;

      d.cases.forEach(function (c) {
        var l = CBTEST.last[c.case_key];
        var isOpen = CBTEST.open === c.case_key;
        /**
         * ⭐ A LEAF IS THE CASE ITSELF — tapping it opens the same body the list opens, through the same
         * testOpen(). A tree that only NAMED the controls would send a tester back to the list to do anything,
         * which is two views of one board rather than one board with two views.
         */
        h += '<div style="border-inline-start:2px solid ' + (l ? (l.status === 'fail' || l.status === 'blocked'
              ? 'var(--disp)' : 'var(--ok-2)') : 'var(--line,#e7e3d8)') + ';margin-inline-start:26px">'
          + '<div onclick="testOpen(\'' + testEsc(c.case_key) + '\')" style="display:flex;gap:6px;align-items:baseline;cursor:pointer;padding:3px 6px">'
          +   '<span style="font-size:var(--fs-2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + testEsc(c.title || c.case_key) + '</span>'
          +   '<span style="flex:1 1 auto"></span>'
          +   (c.generated ? '<span style="' + q + '">swept ·</span>' : '')
          +   '<span style="' + q + '">' + (l ? testEsc(l.status) : 'not run') + '</span>'
          + '</div>'
          + (isOpen ? testCaseBodyHTML(c) : '')
          + '</div>';
      });
    });
  });

  /**
   * ⭐⭐ WHAT RETIREMENT MEANS — the SAME sentence the Report prints, from the shared file. Athi: *"the same
   * has to be updated with retired if it is not going to be useful anymore."* ⚠️ Two wordings of one
   * mechanism is how a reader ends up believing whichever one is wrong.
   */
  h += '<div style="margin:10px 4px 4px;padding:7px 9px;border-radius:7px;background:var(--paper,#faf8f3);'
    + 'border:1px solid var(--line,#efece4);' + q + '"><b>This tree rebuilds itself.</b> '
    + (typeof TEST_MENU_RETIRED_NOTE === 'string' ? TEST_MENU_RETIRED_NOTE : '') + '</div>';
  return h;
}

function testCaseBodyHTML(c) {
  var h = '<div style="border-top:1px solid var(--line,#efece4);padding:8px 9px;font-size:var(--fs-1);line-height:1.5">';
  /* ⭐ the same two lines as the Report, in the same order and the same words — the two surfaces differ in
     their shell, never in what they say about a case. */
  /* ⭐ the screen CODE first, then the path it names — the code is what gets quoted, the path is what
     makes it readable the first time. */
  if (c.menu) h += '<div style="font-size:var(--fs-1);color:var(--grey-2);letter-spacing:.03em;margin-bottom:6px">'
    + testScreenCode(c.menu) + '<b>' + testEsc(testScreenName(c.menu) || c.menu) + '</b>'
    + (testScreenName(c.menu) ? ' \u00b7 ' + testEsc(c.menu) : '') + '</div>';
  if (c.generated) h += '<div style="font-size:var(--fs-1);margin-bottom:7px;padding:6px 8px;border-radius:7px;background:#fff8ea;border:1px solid #f0e3c4;color:#7a5c17">'
    + 'Swept from the menu \u2014 it names the control but carries no written expectation. Judge it against what the screen is FOR, and if you decide what it should do, write that into the case.</div>';
  if (c.pre) h += '<div style="color:var(--grey-2,var(--grey-2));margin-bottom:5px"><b>Before:</b> ' + testEsc(c.pre) + '</div>';
  if (c.data) h += '<div style="color:var(--grey-2,var(--grey-2));margin-bottom:5px"><b>Use:</b> ' + testEsc(c.data) + '</div>';
  (c.steps || []).forEach(function (s, i) {
    h += '<div style="display:flex;gap:6px;margin:4px 0">'
      +  '<span style="color:var(--grey);min-width:13px">' + (i + 1) + '</span>'
      +  '<span style="flex:1">' + testEsc(s[0])
      +    '<span style="display:block;color:var(--grey-2,var(--grey-2))">→ ' + testEsc(s[1]) + '</span></span></div>';
  });
  if (c.note) h += '<div style="margin-top:6px;padding:6px 8px;background:var(--paper,#faf8f3);'
    + 'border:1px solid var(--line,#efece4);border-radius:7px;color:var(--grey-2,var(--grey-2))">' + testEsc(c.note) + '</div>';

  /* ⭐ EVIDENCE IS A FIELD OF ITS OWN, because Athi asked for it and because "what you saw" and "where to look at
     it" are different sentences. A note is prose; evidence is a bill number, a spec name, a screenshot filename. */
  h += '<input type="text" id="cbt_n_' + testEsc(c.case_key) + '" placeholder="What did you see?" '
    +  'style="width:100%;margin-top:8px;font-size:var(--fs-2);padding:5px 7px">'
    +  '<input type="text" id="cbt_e_' + testEsc(c.case_key) + '" placeholder="Evidence — bill number, screenshot" '
    +  'style="width:100%;margin-top:5px;font-size:var(--fs-2);padding:5px 7px">'
    /**
     * ⚠ SAY WHETHER THE CALLS ARE BEING KEPT, and say it from the SAME condition the recorder uses. This line
     * read "Turn spec on to attach the API calls too" for a day after test mode started recording them by
     * itself — so a tester with the calls already attached was being told to switch something on to get them.
     * ⭐ A changed behaviour and the sentence describing it ship together, or the sentence becomes a lie that
     * looks authoritative.
     */
    + (((typeof specOn === 'function' && specOn()) || CBTEST.on)
        ? '<div style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2));margin-top:3px">The API calls this case makes will be attached.</div>'
        : '<div style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2));margin-top:3px">Turn <b>test mode</b> or <b>spec</b> on to attach the API calls too.</div>')
    +  '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px">'
    +    testMarkBtn(c.case_key, 'pass', 'Pass', 'var(--ok-2)', 'var(--ok-tint)')
    +    testMarkBtn(c.case_key, 'fail', 'Fail', 'var(--disp)', 'var(--danger-tint, #fbeceb)')
    +    testMarkBtn(c.case_key, 'blocked', 'Blocked', 'var(--warn-2)', 'var(--warn-tint)')
    +    testMarkBtn(c.case_key, 'skipped', 'Skip', 'var(--grey-2)', 'var(--neutral-tint)')
    +  '</div></div>';
  return h;
}
function testMarkBtn(key, status, label, fg, bg) {
  return '<button class="btn" onclick="testMark(\'' + testEsc(key) + '\',\'' + status + '\')" '
    + 'style="font-size:var(--fs-2);padding:4px 10px;font-weight:700;color:' + fg + ';background:' + bg + ';border-color:' + bg + '">'
    + label + '</button>';
}

/** what the server would record if nobody types a name — shown as the placeholder, so it is never a surprise */
function testDefaultWho() {
  try { return (typeof SESSION !== 'undefined' && (SESSION.name || SESSION.entity)) || 'this login'; }
  catch (_) { return 'this login'; }
}

/**
 * ⭐⭐ SIZE PRESETS. Athi, 2026-09-11: *"keep it wider or lengthier etc, this depends on the test case and
 * where we are looking at etc matters, so it has to be flexible."*
 *
 * He is describing two different needs and they want two different controls. A case with long expectations
 * wants WIDTH; a module with forty cases wants HEIGHT; and which you want changes every few minutes. The
 * corner still drags freely for anything in between — this is for when you already know, and would rather
 * not aim at a 16-pixel triangle to say so.
 *
 * ⚠️ IT WRITES makeMovable's OWN SAVED SHAPE, not a second one. Two stores for one panel would disagree the
 * first time somebody used a preset and then dragged the corner, and the panel would jump on next open.
 */
var TEST_SIZES = {
  normal: { w: 420, h: 460 },
  wide:   { w: 720, h: 460 },
  tall:   { w: 420, h: Math.max(360, Math.round(window.innerHeight * 0.82)) },
  large:  { w: 720, h: Math.max(360, Math.round(window.innerHeight * 0.82)) },
  /**
   * ⭐ THE WHOLE WINDOW. Athi asked for a real full screen, and found the duplicate on the way: `full` used
   * to be 460 × (height − 40) — a taller `tall`, forty pixels wider, sitting in the same menu under a name
   * that promised something else. ⚠️ 8px of margin on every side is deliberate: a panel flush to the edge
   * has no drag handle left, and the way out of full screen would be the one thing you could not grab.
   */
  full:   { w: Math.max(360, window.innerWidth - 16), h: Math.max(320, window.innerHeight - 16) },
};
/**
 * ⚠️ A POPUP IS ONLY ALLOWED WHEN A CLICK ASKED FOR IT, which is why this runs straight from the button's own
 * handler and does nothing asynchronous first. If the browser blocks it anyway, SAY so and name the address —
 * a window that silently does not open reads as a broken button, and the tester tries it four more times.
 */
/**
 * ⚠️ THE COLLAPSE LIVES IN makeMovable, not here — two implementations of "hide the body" would disagree about
 * the remembered width the first time one of them changed. `panel._mv` is the seam it exposes.
 */
function testMinimise() {
  var el = document.getElementById('cbtestpanel');
  if (el && el._mv && typeof el._mv.toggleMin === 'function') el._mv.toggleMin();
  else if (typeof toast === 'function') toast('This panel is not movable in this build.');
}

function testPopOut() {
  var w = Math.min(1100, Math.max(720, Math.round(window.screen.availWidth * 0.48)));
  var h = Math.max(600, Math.round(window.screen.availHeight * 0.9));
  /* ⭐ the RIGHT half by default: the app keeps the side the tester is already working on */
  var x = Math.max(0, window.screen.availWidth - w);
  var win = null;
  try {
    /**
     * ⚠️ THIS POINTED AT /testing.html AND THAT WAS WRONG. Athi: *"open the board on its own window opens the
     * report panel, not the test lab panel."* The report board is a different thing with a different job and no
     * way to add a case — ⭐ [[feedback-name-vs-behaviour]]: both are called "the test lab" and only one of them
     * is the thing a tester works in.
     */
    win = window.open('/app.html?lab=only', 'cbtestlab',
      'width=' + w + ',height=' + h + ',left=' + x + ',top=0,resizable=yes,scrollbars=yes');
  } catch (_) { win = null; }
  if (!win) {
    if (typeof toast === 'function') toast('Your browser blocked the window — open /testing.html yourself.');
    return;
  }
  try { win.focus(); } catch (_) {}
  /**
   * ⭐ AND THE PANEL GETS OUT OF THE WAY (Athi: *"close the current window"*). Leaving both open is the worst of
   * the three states — two boards, one of them stale, and the floating one still covering the app you moved the
   * board off in order to see.
   * ⚠️ It CLOSES rather than minimises: minimised, it is still a thing to notice and re-open by accident. The
   * board is now the other window, and the avatar menu re-opens the panel whenever it is wanted back.
   */
  try { testPanelClose(); } catch (_) {}
}

function testSize(name) {
  var s = TEST_SIZES[name];
  if (!s) return;
  var el = document.getElementById('cbtestpanel');
  if (!el) return;
  /* ⚠️ once a size is chosen the panel must stop being anchored to the bottom-right, or growing it taller
     pushes it UP off the top of the window rather than getting bigger. */
  var r = el.getBoundingClientRect();
  el.style.position = 'fixed'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.margin = '0';
  if (!el.style.left) el.style.left = Math.max(8, r.left) + 'px';
  if (!el.style.top) el.style.top = Math.max(8, r.top) + 'px';
  /* ⭐ full screen starts at the corner; every other preset stays where the tester put the panel */
  if (name === 'full') { el.style.left = '8px'; el.style.top = '8px'; }
  el.style.width = s.w + 'px';
  el.style.height = s.h + 'px';
  el.style.maxHeight = 'none';

  /* keep it on screen — a preset taller than the window would otherwise hang off the bottom */
  var top = parseFloat(el.style.top) || 0;
  if (top + s.h > window.innerHeight - 8) el.style.top = Math.max(8, window.innerHeight - s.h - 8) + 'px';
  var left = parseFloat(el.style.left) || 0;
  if (left + s.w > window.innerWidth - 8) el.style.left = Math.max(8, window.innerWidth - s.w - 8) + 'px';

  /* ⭐ the same key and the same shape makeMovable persists, so the next open restores what you chose */
  try {
    localStorage.setItem('cb_testpanel', JSON.stringify({
      left: parseFloat(el.style.left), top: parseFloat(el.style.top),
      width: s.w, height: s.h }));
  } catch (_) {}

  /* the list has to grow with the frame, or the panel gets bigger and shows no more cases */
  var b = document.getElementById('cbtestbody');
  if (b) { b.style.maxHeight = 'none'; b.style.flex = '1 1 auto'; b.style.minHeight = '0'; b.style.overflowY = 'auto'; }
}

/**
 * ⭐⭐⭐ WHO IS TESTING — and Athi is right that the entity name is not an answer.
 *
 * He asked, 2026-09-11: *"do we know who is testing? The entity name we can pick it up? Anything else as a
 * tester name, do we need it?"*
 *
 * ⚠️ THE SERVER ALREADY RECORDS THE TRUTH: `tested_by` is the identity_id off the token and cannot be typed
 * in. But `tester_name` fell back to the display name, and when you sign in AS THE BUSINESS that is "Tally
 * Test Shop" — which says the shop tested it, and a shop cannot hold a phone. A co-assist login already gives
 * a person's name; an owner login does not.
 *
 * ⭐ SO BOTH, AND THEY ANSWER DIFFERENT QUESTIONS. The identity is the unforgeable record of WHICH LOGIN wrote
 * the row. This label is who was at the keyboard — which matters exactly when one login is shared, i.e. the
 * case he is describing. It is kept on this device, because it is a property of who is sitting here.
 * ⚠️ It can be wrong, deliberately: it is a courtesy, not evidence, and the identity beside it is the evidence.
 */
function testWho() {
  try { var v = localStorage.getItem('cb_tester'); if (v) return v; } catch (_) {}
  return '';
}
function testSetWho(v) {
  var s = String(v || '').trim().slice(0, 60);
  try { if (s) localStorage.setItem('cb_tester', s); else localStorage.removeItem('cb_tester'); } catch (_) {}
  CBTEST.who = s;
}

/**
 * ⭐ A FOCUS IS A PROPERTY OF THE RUN, not of the device — so a sitting labelled "before release, suppliers"
 * carries what it was meant to cover, and the results it produced can be read against that intention later.
 */
function testSetFocus(v) {
  CBTEST.run.focus = v || '';
  testRunSave();
  /* ⚠️ CHOOSING A FOCUS MOVES YOU THERE. Setting it and then still looking at another module is the state
     nobody wants and everybody would reach by accident. */
  if (v) { CBTEST.area = v; CBTEST.open = null; }
  testPaint();
}

function testSetArea(v) {
  /* ⚠️ SAID, NOT PREVENTED. Wandering off a focus is often the right thing — something looked wrong on the
     way past. It should just not happen without being noticed. */
  if (CBTEST.run.focus && v !== CBTEST.run.focus && typeof toast === 'function') {
    var a = CBTEST.cover.filter(function (x) { return x.module_key === CBTEST.run.focus; })[0];
    if (a && a.untested) toast(a.untested + ' case(s) still to run in ' + CBTEST.run.focus);
  }
  CBTEST.area = v; CBTEST.open = null; testPaint();
}
function testSetKind(v) { CBTEST.run.kind = v; testRunSave(); testPaint(); }
/**
 * ⭐⭐⭐ OPENING A CASE MARKS THE API LOG, so that marking it records WHICH CALLS THIS CASE MADE.
 *
 * Athi, 2026-09-11: *"if we make it happen like this API is called etc, for this purpose, so the spec and the
 * test cases can match?"* — this is that join. The case says what should happen; the spec panel says which
 * endpoints were actually hit; the RESULT now carries both, so a failure is not "the supplier screen was wrong"
 * but "SPR-02 failed and these three calls are what it made".
 *
 * ⚠ ONLY WHILE SPEC IS ON, because that is the only time api() keeps anything. Off, evidence stays whatever the
 * tester typed — and the panel says so rather than silently attaching nothing.
 */
function testOpen(k) {
  try { CBTEST.mark = (window.CBCALLS || []).length; } catch (_) { CBTEST.mark = 0; }
  CBTEST.open = (CBTEST.open === k ? null : k);
  testPaint();
}
/**
 * The calls made since this case was opened, newest first, as one readable line.
 * ⚠ CAPPED AT SIX. Evidence is meant to be read by a person deciding what broke; a full network log is not
 * evidence, it is homework.
 */
/**
 * ── ⭐⭐⭐ WHERE THE TESTER WAS STANDING WHEN IT BROKE ────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ THE FIRST QUESTION ANYONE ASKS A BUG REPORT IS *which build, which browser* — and until now a verdict
 * carried neither. `test_result.build` has existed since b219 and the panel never filled it in. A month-old
 * failure with no environment is not evidence, it is a rumour. This is the one thing Jam and Marker.io lead
 * with, and every value is sitting in the page at the moment Save is pressed.
 *
 * ⚠️ THE BROWSER MUST BE READ IN PREFERENCE ORDER, NOT BY TAKING THE LAST MATCH. Chrome’s user-agent ends
 * with "Safari/537", so the obvious reading reports every Chrome tester as Safari — wrong in a way nobody
 * would question, because it looks like a plausible answer.
 *
 * ⚠️ AND IT IS WHAT THE BROWSER SAYS ABOUT ITSELF, which is not the same as the truth. Named that way in the
 * text so nobody reads it as detection.
 */
function testEnv() {
  try {
    var ua = String((navigator || {}).userAgent || '');
    var br = 'browser not named';
    ['Edg', 'Chrome', 'Firefox', 'Version'].some(function (n) {
      var m = ua.match(new RegExp(n + '/([0-9]+)'));
      if (!m) return false;
      br = (n === 'Edg' ? 'Edge' : n === 'Version' ? 'Safari' : n) + ' ' + m[1];
      return true;
    });
    var os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android'
      : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS'
      : /Linux/.test(ua) ? 'Linux' : 'OS not named';
    return {
      build: (typeof CB_BUILD !== 'undefined' && CB_BUILD) || null,
      browser: br, os: os,
      viewport: (window.innerWidth || 0) + '×' + (window.innerHeight || 0),
      where: String(location.hash || '#/'),
      screen: CBTEST.popupFor || null,
    };
  } catch (_) { return {}; }
}

/** the same facts as one readable line, for the evidence field a person will actually read */
function testEnvLine() {
  var e = testEnv();
  return [e.build && 'build ' + e.build, e.browser, e.os, e.viewport, e.where, e.screen]
    .filter(Boolean).join(' · ');
}

function testCallsSince() {
  try {
    var all = window.CBCALLS || [];
    if (!all.length) return '';
    var since = Math.max(0, all.length - (CBTEST.mark || 0));
    if (!since) return '';
    return all.slice(0, Math.min(since, 6)).map(function (c) {
      return c.m + ' ' + c.path + ' ' + c.status;
    }).join(' | ');
  } catch (_) { return ''; }
}

/**
 * ⚠️⚠️ THE RUN IS ENSURED HERE, AND THAT IS THE FIX FOR "cannot read properties of null (reading id)".
 *
 * Athi, 2026-09-12, first time he pressed Pass from a screen: *"tried updating a pass, I got a message that
 * not updated, cannot read properties of null (reading id)."*
 *
 * ⚠️ MY OWN SPLIT CAUSED IT. `testRunLoad()` was called in exactly one place — `testPanelOpen()` — so the run
 * existed as a SIDE EFFECT of opening the lab. The moment test mode stopped opening the lab, a verdict
 * recorded from a screen had no run to belong to and `CBTEST.run.id` threw.
 *
 * ⭐ A RUN IS NEEDED BY WHOEVER RECORDS, so whoever records asks for one. It is cheap (localStorage) and
 * idempotent, and putting it here means the next caller — from a screen, a popup, a keyboard shortcut, a
 * place nobody has built yet — cannot hit the same wall. Relying on a panel having been opened first was
 * never a rule anybody could see.
 */
async function testMark(key, status) {
  if (!CBTEST.run || !CBTEST.run.id) testRunLoad();
  var nb = document.getElementById('cbt_n_' + key), eb = document.getElementById('cbt_e_' + key);
  var note = nb ? nb.value.trim() : '', ev = eb ? eb.value.trim() : '';
  /* ⭐ asked here as well as refused at the server, so the tester is told by the box they must fill and not
     by a red toast after a round trip — the same shape as the observation an incident already demands */
  if (status === 'blocked' && !note) {
    if (typeof toast === 'function') toast('Say what blocked it — a blocked case with no reason reads the '
      + 'same as one nobody reached.');
    try { if (nb) nb.focus(); } catch (_) {}
    return;
  }
  /* ⭐ what the tester typed comes FIRST; the calls are appended. Their sentence is the evidence that matters,
     and burying it under a machine-generated list would be the wrong way round. */
  var calls = testCallsSince();
  if (calls) ev = (ev ? ev + ' · ' : '') + calls;
  var c = CBTEST.cases.filter(function (x) { return x.case_key === key; })[0] || {};
  try {
    /**
     * ⭐ ON A FAILURE, NOT ON A PASS. A pass needs no reproduction, and stamping the browser onto three
     * hundred green rows would bury the tester’s own sentence under machinery on the rows where it is the
     * only thing worth reading. ⚠ `blocked` counts as a failure here: it is the one a person comes back to.
     */
    if (status === 'fail' || status === 'blocked') {
      var env = testEnvLine();
      if (env) ev = (ev ? ev + ' · ' : '') + env;
    }
    var r = await api('testRecord', { body: {
      run_id: CBTEST.run.id, run_label: CBTEST.run.label || null,
      /* ⚠ the column has been there since b219 and nothing ever wrote to it */
      build: (typeof CB_BUILD !== 'undefined' && CB_BUILD) || null,
      results: [{ case_key: key, module_key: c.module_key, status: status, run_kind: CBTEST.run.kind || 'manual',
                  tester_name: testWho() || undefined,
                  layer: c.layer || null, note: note || null, evidence: ev || null }] } });
    var saved = ((r && r.results) || [])[0] || {};
    CBTEST.last[key] = Object.assign({
      case_key: key, status: status, note: note, run_kind: CBTEST.run.kind,
      tester_name: (typeof SESSION !== 'undefined' && SESSION.name) || 'you',
      at: new Date().toISOString() }, saved);
    /* ⚠️ A FAILURE STAYS OPEN. You are about to write down what happened, and closing the case would take the
       note box away at the exact moment it is needed. A pass closes, because there is nothing more to say. */
    CBTEST.open = (status === 'fail' || status === 'blocked') ? key : null;
    testPaint();
    /* ⭐ and the in-screen panel, when it is the thing the person is looking at — it holds the same counts,
       and a tally that does not move when you press Pass reads as a press that did not land. */
    if (CBTEST.popupFor) { try { screenCasesPaint(); } catch (_) {} }
  } catch (e) {
    if (typeof toast === 'function') toast(tx('Not recorded') + ' — ' + e.message, true);
  }
}

/* ── ⭐ THE PLUS: write a case for what you just found, without leaving the screen ─────────────────────────────
 * Athi: *"add more issues as a plus icon."* The moment you find something is the moment you can describe it; an
 * hour later it is "something was wrong with the supplier screen". So the form is four fields and lands as a
 * real, versioned case on the same board — not a note in a different place. */
/**
 * ⭐⭐ LOAD THE DOCUMENTED CASES. Safe to press twice — it is an upsert, so an unchanged case keeps its version,
 * an edited one gains a new version, and every result already recorded keeps pointing at the version it was
 * actually given. There is deliberately no "already loaded" flag: a flag is a thing that can be wrong.
 */
async function testSeed() {
  if (CBTEST.seeding) return;
  CBTEST.seeding = true; testPaint();
  try {
    var r = await api('testSeed');
    await testLoad(true);
    if (typeof toast === 'function') {
      /* ⚠ SAY WHAT CHANGED, not "done". On a second press `added` is 0 and that is the correct answer — a bare
         success would read as though nothing happened. */
      toast(r.added + ' cases loaded'
        + (r.updated ? ', ' + r.updated + ' updated' : '')
        + (r.unchanged ? ', ' + r.unchanged + ' already current' : ''));
    }
  } catch (e) {
    if (typeof toast === 'function') toast(tx('Could not load the test cases') + ' — ' + e.message, true);
  }
  CBTEST.seeding = false; testPaint();
}

/** ⭐ the completion report — on the board, where it has the width to be read and printed */
function testReport() {
  try { window.open('/testing.html#report', '_blank'); }
  catch (_) { if (typeof toast === 'function') toast(tx('Open /testing.html to read the report.')); }
}

/**
 * ── ⭐⭐ ADD IT WHERE YOU ARE LOOKING ────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"+ icon adding a case — where does it add? If you want to add a case against a section,
 * say 00 REG, it has to be there."*
 *
 * ⚠️ THE ONE + IN THE HEADER COULD NOT ANSWER THAT QUESTION. It opened a form that GUESSED the area — the
 * current filter, then the screen you came from, then whatever happened to be first — and wrote the guess
 * into an editable box. A guess in a field a person did not fill is indistinguishable from a choice they made,
 * and the case lands somewhere they did not intend.
 *
 * ⭐ Pressing + ON AN AREA says where it goes, because you pressed it there. The header + still exists for a
 * case that belongs to no area yet, and the form now SAYS which of the two happened rather than presenting
 * both identically.
 */
function testAddOpen(area) {
  CBTEST.adding = true;
  CBTEST.addTo = area || '';          /* ⭐ '' means "you pressed the header +", which is a different intent */
  testPaint();
}
function testAddClose() { CBTEST.adding = false; CBTEST.addTo = ''; testPaint(); }

function testAddHTML() {
  var areas = testAreas();
  /**
   * ⭐ A CHOSEN AREA IS NOT A GUESSED ONE, and the form has to be able to tell them apart. When + was pressed
   * on a row the area is settled and the form says so; when it was pressed in the header it is still a guess
   * and the form says THAT, so nobody accepts a suggestion believing they made it.
   */
  var chosen = CBTEST.addTo || '';
  var suggested = chosen || CBTEST.area || testAreaGuess() || (areas[0] && areas[0].key) || 'NEW';
  var named = (areas.filter(function (a) { return a.key === suggested; })[0] || {}).name || '';
  return '<div style="flex:1;overflow:auto;padding:10px 11px;min-height:0;font-size:var(--fs-2)">'
    + '<div style="font-weight:700;margin-bottom:3px">New case</div>'
    + '<div style="font-size:var(--fs-1);color:' + (chosen ? 'var(--blue,#3F66A6)' : 'var(--grey-2,#545A61)')
    +   ';margin-bottom:8px">'
    +   (chosen
        ? 'Adding to <b>' + testEsc(suggested) + '</b>' + (named ? ' \u00b7 ' + testEsc(named) : '')
        : '\u26a0 No area chosen \u2014 <b>' + testEsc(suggested) + '</b> is a suggestion. '
          + 'Press + on an area row to be sure, or edit it below.')
    + '</div>'
    + '<label style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2))">Area</label>'
    + '<input type="text" id="cbt_a_mod" value="' + testEsc(suggested) + '" '
    +   'style="width:100%;margin-bottom:7px;padding:5px 7px;font-size:var(--fs-2)">'
    + '<label style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2))">What should happen</label>'
    + '<input type="text" id="cbt_a_title" placeholder="e.g. A local supplier cannot be sent a chit" '
    +   'style="width:100%;margin-bottom:7px;padding:5px 7px;font-size:var(--fs-2)">'
    + '<label style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2))">Do this</label>'
    + '<input type="text" id="cbt_a_do" placeholder="The one action that shows it" '
    +   'style="width:100%;margin-bottom:7px;padding:5px 7px;font-size:var(--fs-2)">'
    + '<label style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2))">You should see</label>'
    + '<input type="text" id="cbt_a_see" placeholder="What a correct answer looks like" '
    +   'style="width:100%;margin-bottom:7px;padding:5px 7px;font-size:var(--fs-2)">'
    + '<label style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2))">Why this case exists</label>'
    + '<input type="text" id="cbt_a_note" placeholder="What went wrong, in your words" '
    +   'style="width:100%;margin-bottom:9px;padding:5px 7px;font-size:var(--fs-2)">'
    /* ⚠️ SAID BEFORE THEY SAVE, not after. The document in the repository is where the wording is reviewed, and a
       case written here is real but is not yet in it — so it is not in the printed script either. */
    + '<div style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2));line-height:1.5;margin-bottom:9px">'
    +   'This becomes a real case on the board straight away. To get it into the printed script as well, add it to '
    +   '<code>TEST-CASES-V2.js</code> — the document stays where the wording is reviewed.</div>'
    + '<div style="display:flex;gap:6px">'
    +   '<button class="btn pri" onclick="testAddSave()" style="font-size:var(--fs-2)">Add the case</button>'
    +   '<button class="btn" onclick="testAddClose()" style="font-size:var(--fs-2)">Cancel</button>'
    + '</div></div>';
}

async function testAddSave() {
  var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var mod = (v('cbt_a_mod') || 'NEW').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'NEW';
  var title = v('cbt_a_title');
  if (!title) { if (typeof toast === 'function') toast(tx('Say what should happen first.'), true); return; }

  /**
   * ⭐ THE NUMBER IS AN ORDINAL, max + 1, never count + 1 — the same rule minted supplier ids follow, and for the
   * same reason: with 01 and 03 present, a count hands out 03 again and two different cases answer to one key.
   */
  var top = 0;
  CBTEST.cases.forEach(function (c) {
    if (c.module_key !== mod) return;
    var m = String(c.case_key).match(/-(\d+)$/);
    if (m && Number(m[1]) > top) top = Number(m[1]);
  });
  var key = mod + '-' + String(top + 1).padStart(2, '0');

  try {
    await api('testCaseAdd', { body: { cases: [{
      case_key: key, module_key: mod,
      module_name: (testAreas().filter(function (a) { return a.key === mod; })[0] || {}).name || mod,
      title: title, priority: 'High',
      steps: v('cbt_a_do') ? [[v('cbt_a_do'), v('cbt_a_see') || 'It does what the title says.']] : [],
      note: v('cbt_a_note') || '', layer: null } ] } });
    CBTEST.adding = false;
    CBTEST.area = mod;
    await testLoad(true);
    CBTEST.open = key;
    testPaint();
    if (typeof toast === 'function') toast(key + ' ' + tx('added'));
  } catch (e) {
    if (typeof toast === 'function') toast(tx('Could not add the case') + ' — ' + e.message, true);
  }
}

/* ⭐ come back to where you were: if test mode was on when the tab closed, it is on when it opens. */
try { if (testModeIsOn()) setTimeout(function () { testModeSet(true); }, 400); } catch (_) {}
