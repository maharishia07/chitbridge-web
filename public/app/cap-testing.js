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
  testPaint();
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
    + verdict(tx('Fail'), 'var(--disp)', 'var(--disp-tint, #FBECEB)',
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

  var STAT = { pass: ['var(--ok-2)', 'var(--ok-tint)'], fail: ['var(--disp)', 'var(--disp-tint, #fbeceb)'],
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
    +   '<b style="font-size:var(--fs-3);white-space:nowrap">🧪 Test lab</b>'
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
    var col = tone === 'bad' ? ['var(--disp-tint,#fbeceb)', '#eccbc9', 'var(--disp)']
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
          + 'cursor:pointer;padding:5px 6px;border-bottom:1px solid var(--line-2,#efece4)">'
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
          +     'background:var(--grey-2,#545A61);color:#fff;border-radius:4px;padding:1px 5px;'
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
var TEST_VIEWS = ['list', 'menu', 'req', 'inc', 'scr'];
function testViewGet() {
  try { var v = localStorage.getItem('cb_test_view'); return TEST_VIEWS.indexOf(v) >= 0 ? v : 'list'; }
  catch (_) { return 'list'; }
}
function testSetView(v) {
  if (TEST_VIEWS.indexOf(v) < 0) v = 'list';
  try { localStorage.setItem('cb_test_view', v); } catch (_) {}
  CBTEST.view = v;
  /* ⚠️ the requirements are read on ARRIVAL, not with the cases: a list nobody has opened should not be one
     more call on every panel open. [[feedback-on-demand-loading]] */
  if (v === 'req' && !CBTEST.reqs) testReqLoad();
  else if (v === 'inc' && !CBTEST.incs) testIncLoad();
  else if (v === 'scr' && !CBTEST.scrRes) testScrLoad();
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
var TEST_REQ_STATES = ['raised', 'accepted', 'implemented', 'rejected'];
function testReqFilterGet() {
  try { var v = localStorage.getItem('cb_test_reqf'); return v || 'open'; } catch (_) { return 'open'; }
}
function testReqFilter(v) {
  try { localStorage.setItem('cb_test_reqf', v); } catch (_) {}
  testReqLoad();
}
async function testReqLoad() {
  CBTEST.reqBusy = true; testPaint();
  try { CBTEST.reqs = await api('testReqList', { query: { state: testReqFilterGet() } }); CBTEST.reqErr = null; }
  catch (e) { CBTEST.reqErr = (e && e.message) || 'Could not read them.'; }
  CBTEST.reqBusy = false; testPaint();
}
/**
 * ⚠️⚠️ REJECTING ASKS FOR THE REASON AND WILL NOT PROCEED WITHOUT ONE. The server refuses it too — but a refusal
 * that arrives after the click is a worse way to learn it. A "no" with no reason gets re-raised by the next
 * tester, and rightly.
 */
async function testReqSet(id, state) {
  var why = null;
  if (state === 'rejected') {
    why = window.prompt('Why is this rejected? The next tester will read this instead of raising it again.');
    if (why === null) return;                       /* cancelled — nothing is changed */
    if (!String(why).trim()) { if (typeof toast === 'function') toast('A rejection needs its reason.'); return; }
  }
  try {
    await api('testReqSet', { params: { id: id }, body: { state: state, why: why } });
    if (typeof toast === 'function') toast('Marked ' + state);
    testReqLoad();
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
  var base = 'font:inherit;font-size:var(--fs-1);padding:2px 8px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;margin-inline-end:5px;';
  var chips = [['open', 'Not actioned'], ['raised', 'Raised'], ['accepted', 'Accepted'],
               ['implemented', 'Implemented'], ['rejected', 'Rejected'], ['all', 'Everything']]
    .map(function (x) {
      var on = f === x[0];
      var n = d && d.counts ? (x[0] === 'open' ? d.open : (x[0] === 'all' ? d.total : d.counts[x[0]])) : null;
      return '<button onclick="testReqFilter(\'' + x[0] + '\')" style="' + base
        + (on ? 'background:var(--grey-2,#545A61);color:#fff;border-color:var(--grey-2,#545A61)'
              : 'background:var(--card,#fff);color:var(--grey-2,#545A61)') + '">'
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
  h += list.map(function (q) {
    var acts = '';
    if (q.state === 'raised') {
      acts = '<button onclick="testReqSet(\'' + q.definition_id + '\',\'accepted\')" style="' + base + '">Accept</button>'
           + '<button onclick="testReqSet(\'' + q.definition_id + '\',\'rejected\')" style="' + base + '">Reject</button>';
    } else if (q.state === 'accepted') {
      acts = '<button onclick="testReqSet(\'' + q.definition_id + '\',\'implemented\')" style="' + base + '">Implemented</button>'
           + '<button onclick="testReqSet(\'' + q.definition_id + '\',\'rejected\')" style="' + base + '">Reject</button>';
    }
    return '<div style="border-bottom:1px solid var(--line,#e7e3d8);padding:7px 0">'
      + '<div style="display:flex;align-items:baseline;gap:7px;flex-wrap:wrap">'
      +   '<b style="color:' + (PRI[q.priority] || PRI.Medium) + ';font-size:var(--fs-1)">' + testEsc(q.priority) + '</b>'
      +   '<code style="font-size:var(--fs-1);color:var(--note)">' + testEsc(q.clause) + '</code>'
      +   '<span style="font-size:var(--fs-1);background:var(--neutral-tint,#f2efe6);border-radius:5px;padding:1px 6px">'
      +     testEsc(q.state) + '</span>'
      +   (q.screen_code ? '<code style="font-family:\'Space Mono\',ui-monospace,monospace;font-size:var(--fs-1);'
            + 'background:var(--neutral-tint);border-radius:5px;padding:0 5px;user-select:all">'
            + testEsc(q.screen_code) + '</code>' : '')
      +   (q.popup_code ? '<code style="font-family:\'Space Mono\',ui-monospace,monospace;font-size:var(--fs-1);'
            + 'background:var(--neutral-tint);border-radius:5px;padding:0 5px;user-select:all">'
            + testEsc(q.popup_code) + '</code>' : '')
      +   (q.raised_from ? '<span style="font-size:var(--fs-1);color:var(--note)">from '
            + testEsc(q.raised_from) + '</span>' : '')
      + '</div>'
      + '<div style="font-size:var(--fs-2);margin-top:2px">' + testEsc(q.requirement) + '</div>'
      /* ⚠️ THE EVIDENCE IS SHOWN BESIDE THE RULE, ALWAYS. Six months on, "what was seen" is the only thing that
         says whether the requirement was ever real. */
      + (q.observed ? '<div style="font-size:var(--fs-1);color:var(--grey-2,#545A61);margin-top:2px">seen: '
          + testEsc(q.observed) + '</div>' : '')
      + (q.why ? '<div style="font-size:var(--fs-1);color:var(--disp,#B3261E);margin-top:2px">because: '
          + testEsc(q.why) + '</div>' : '')
      + '<div style="font-size:var(--fs-1);color:var(--note);margin-top:3px">'
      +   testEsc(q.raised_by || 'someone') + (q.raised_at ? ' · ' + testEsc(String(q.raised_at).slice(0, 10)) : '')
      +   (acts ? '<span style="margin-inline-start:9px">' + acts + '</span>' : '')
      + '</div></div>';
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
function testIncFilterGet() {
  try { return localStorage.getItem('cb_test_incf') || 'open'; } catch (_) { return 'open'; }
}
function testIncFilter(v) {
  try { localStorage.setItem('cb_test_incf', v); } catch (_) {}
  testIncLoad();
}
async function testIncLoad() {
  CBTEST.incBusy = true; testPaint();
  try { CBTEST.incs = await api('testIncList', { query: { state: testIncFilterGet() } }); CBTEST.incErr = null; }
  catch (e) { CBTEST.incErr = (e && e.message) || 'Could not read them.'; }
  CBTEST.incBusy = false; testPaint();
}

/**
 * ⚠️⚠️ RESOLVING ASKS WHAT CHANGED AND WILL NOT PROCEED WITHOUT AN ANSWER. The server refuses it too, but a
 * refusal arriving after the click is a worse way to learn the rule. ⭐ A commit sha is accepted as the answer
 * and CITED — the message, the diff and the author stay in git, where they cannot drift from the truth.
 */
async function testIncSet(id, state) {
  var body = { state: state };
  if (state === 'resolved') {
    var a = window.prompt('What fixed it? Paste the commit sha, or say why nothing needed changing.');
    if (a === null) return;
    a = String(a).trim();
    if (!a) { if (typeof toast === 'function') toast('A resolution needs the commit, or a reason.'); return; }
    /* ⭐ a sha is a citation; anything else is an explanation, and both are legitimate answers */
    if (/^[0-9a-fA-F]{7,40}$/.test(a)) body.change = { sha: a.toLowerCase() };
    else body.why = a;
  }
  if (state === 'closed') {
    var w = window.prompt('Why is this closed? The next person reads this instead of reopening it.');
    if (w === null) return;
    if (!String(w).trim()) { if (typeof toast === 'function') toast('Closing needs its reason.'); return; }
    body.why = String(w).trim();
  }
  try {
    await api('testIncSet', { params: { id: id }, body: body });
    if (typeof toast === 'function') toast('Marked ' + state);
    testIncLoad();
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
  var base = 'font:inherit;font-size:var(--fs-1);padding:2px 8px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;margin-inline-end:5px;';
  var chips = [['open', 'Open'], ['raised', 'Raised'], ['investigating', 'Being looked at'],
               ['resolved', 'Resolved'], ['closed', 'Closed'], ['all', 'Everything']]
    .map(function (x) {
      var on = f === x[0];
      var n = d && d.counts ? (x[0] === 'open' ? d.open : (x[0] === 'all' ? d.total : d.counts[x[0]])) : null;
      return '<button onclick="testIncFilter(\'' + x[0] + '\')" style="' + base
        + (on ? 'background:var(--grey-2,#545A61);color:#fff;border-color:var(--grey-2,#545A61)'
              : 'background:var(--card,#fff);color:var(--grey-2,#545A61)') + '">'
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
    var acts = '';
    if (q.state === 'raised') {
      acts = '<button onclick="testIncSet(\'' + q.definition_id + '\',\'investigating\')" style="' + base + '">Looking at it</button>'
           + '<button onclick="testIncSet(\'' + q.definition_id + '\',\'resolved\')" style="' + base + '">Resolved</button>';
    } else if (q.state === 'investigating') {
      acts = '<button onclick="testIncSet(\'' + q.definition_id + '\',\'resolved\')" style="' + base + '">Resolved</button>';
    } else if (q.state === 'resolved') {
      acts = '<button onclick="testIncSet(\'' + q.definition_id + '\',\'closed\')" style="' + base + '">Close</button>';
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
      +   (acts ? '<span style="margin-inline-start:9px">' + acts + '</span>' : '')
      + '</div></div>';
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
  CBTEST.scrBusy = true; testPaint();
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
  CBTEST.scrBusy = false; testPaint();
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
      + 'style="font:inherit;font-size:var(--fs-1);padding:4px 12px;border:1px solid var(--line,#e7e3d8);'
      + 'border-radius:7px;cursor:pointer;background:var(--card,#fff)">'
      + '\u002b New test case</button></div>';
  }
  var inp = 'width:100%;font:inherit;font-size:var(--fs-2);padding:5px 7px;border:1px solid '
    + 'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff);margin-bottom:5px';
  var btn = 'font:inherit;font-size:var(--fs-1);padding:4px 12px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;background:var(--card,#fff)';
  return '<div style="border:1px solid var(--line,#e7e3d8);border-radius:9px;padding:9px;margin:2px 0 9px">'
    + '<div style="font-size:var(--fs-2);margin-bottom:6px">Document '
    +   '<code>' + testEsc(w.code) + '</code> <b>' + testEsc(w.name) + '</b></div>'
    + '<input id="wcTitle" placeholder="1 \u00b7 The requirement — what must be true" style="' + inp + '">'
    + '<input id="wcDo" placeholder="2 \u00b7 The operation — what you do" style="' + inp + '">'
    + '<input id="wcSee" placeholder="3 \u00b7 Expected — what should happen" style="' + inp + '">'
    + '<input id="wcGot" placeholder="4 \u00b7 Observed — what you are actually seeing" style="' + inp + '">'
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
    +   '<option value="">5 \u00b7 Which control? \u2014 optional, the screen as a whole if you leave it</option>'
    +   testCtlOptions(w.code)
    + '</select>'
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px">'
    +   '<select id="wcPri" style="font:inherit;font-size:var(--fs-1);padding:3px 6px;border:1px solid '
    +     'var(--line,#e7e3d8);border-radius:7px;background:var(--card,#fff)">'
    +     '<option>High</option><option selected>Medium</option><option>Low</option></select>'
    +   '<button onclick="testCaseSend(\'pass\')" style="' + btn
    +     ';color:var(--ok-2,#1B7F4B);background:var(--ok-tint,#eaf5ee);font-weight:700">Pass</button>'
    +   '<button onclick="testCaseSend(\'inc\')" style="' + btn
    +     ';color:var(--disp,#B3261E);background:var(--disp-tint,#fbeceb)">Incident</button>'
    +   '<button onclick="testCaseSend(\'req\')" style="' + btn + '">Requirement</button>'
    +   '<span style="flex:1 1 auto"></span>'
    +   '<button onclick="testCaseSend(\'\')" style="' + btn + '" title="Write it now, run it later">Save'
    +     '</button>'
    +   '<button onclick="testCaseCancel()" style="' + btn + '">Cancel</button>'
    + '</div>'
    /* ⭐ the picture, and what is attached right now — said in words, because a thumbnail alone leaves a
       tester wondering whether it actually saved */
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;'
    +   'font-size:var(--fs-1);color:var(--grey-2)">'
    +   '<button onclick="testShotGrab()" style="' + btn + '" title="Capture this window and attach it">'
    +     '\ud83d\udcf7 Screenshot</button>'
    +   (CBTEST.shot
      ? '<span style="display:inline-flex;gap:6px;align-items:center">'
        /* ⭐ the picture itself, small — the fastest possible answer to "is the right one attached?" */
        + (CBTEST._thumb ? '<img src="' + CBTEST._thumb + '" alt="" style="height:26px;width:auto;'
            + 'border:1px solid var(--line,#e7e3d8);border-radius:4px;vertical-align:middle">' : '')
        + '<button onclick="testShotView(\'' + testEsc(CBTEST.shot.id) + '\')" style="' + btn
          + ';padding:1px 7px">view</button>'
        + '<button onclick="testShotDrop()" style="' + btn + ';padding:1px 7px">remove</button></span>'
      : '<span>\u2026 or paste one here with Ctrl+V</span>')
    + '</div></div>';
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
    CBTEST.shot = null;
    testShotThumb(null);
    if (typeof testLoad === 'function') await testLoad(true);

    if (outcome) {
      /* the observation rides on the same hidden field the list uses, so there is one path to a verdict */
      var box = document.getElementById('cbt_n_' + key);
      if (!box) {
        box = document.createElement('input');
        box.id = 'cbt_n_' + key; box.type = 'hidden';
        document.body.appendChild(box);
      }
      box.value = got || (outcome === 'pass' ? 'As expected.' : '');
      if (outcome === 'pass') await testMark(key, 'pass');
      else await testFromCase(key, outcome);
      try { if (box.type === 'hidden') box.remove(); } catch (_) {}
    }
    if (typeof toast === 'function') toast(outcome ? ('Recorded \u2014 ' + key) : ('Written \u2014 ' + key));
    /* ⚠️ AFTER the repaint, not before: the repaint carries values across now, so clearing first would
       have them carried straight back in. */
    /* ⭐ after writing, the list is where the work is — and where the case just written can be seen */
    if (CBTEST.popupFor) { try { localStorage.setItem('cb_case_area', 'cases'); } catch (_) {} }
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
  var son = 'background:var(--grey-2,#545A61);color:#fff;border-color:var(--grey-2,#545A61)';
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
      +   ')" title="Write a case for this screen" style="font:inherit;font-size:var(--fs-1);'
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
async function testFromCase(key, kind) {
  var box = document.getElementById('cbt_n_' + key);
  var seen = box ? String(box.value || '').trim() : '';
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
        evidence_id: (CBTEST.shot && CBTEST.shot.id) || null,
        affected: 'found by ' + key, severity: 'Sev-3',
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
function testCaseListHTML(code) {
  var all = (CBTEST.cases || []).filter(function (c) { return testScrOf(c) === code; });
  if (!all.length) {
    return '<div style="font-size:var(--fs-1);color:var(--note);padding:6px 0 2px">'
      + 'No case on this screen yet. Write the first one above.</div>';
  }
  var isPass = function (c) { var l = CBTEST.last[c.case_key]; return !!(l && l.status === 'pass'); };
  var nPass = all.filter(isPass).length;
  var nTodo = all.length - nPass;
  var f = testCaseFilterGet();
  var mine = f === 'passed' ? all.filter(isPass)
           : f === 'all' ? all
           : all.filter(function (c) { return !isPass(c); });

  var chip = 'font:inherit;font-size:var(--fs-1);padding:1px 8px;border:1px solid var(--line,#e7e3d8);'
    + 'border-radius:7px;cursor:pointer;margin-inline-end:4px;';
  var on = 'background:var(--grey-2,#545A61);color:#fff;border-color:var(--grey-2,#545A61)';
  var off = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  var h = '<div style="margin:8px 0 2px">'
    + [['todo', 'To do', nTodo], ['passed', 'Passed', nPass], ['all', 'All', all.length]]
      .map(function (x) {
        return '<button onclick="testCaseFilter(\'' + x[0] + '\')" style="' + chip
          + (f === x[0] ? on : off) + '">' + x[1] + ' <b>' + x[2] + '</b></button>';
      }).join('')
    + '</div>';

  if (!mine.length) {
    return h + '<div style="font-size:var(--fs-1);color:var(--note);padding:6px 0 2px">'
      + (f === 'todo' ? 'Nothing left to test on this screen.' : 'None in this pile.') + '</div>';
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
        +   'border-top:1px solid var(--line-2,#efece4);opacity:.72">'
        + '<code style="font-size:var(--fs-1);color:var(--grey-2)">' + testEsc(c.case_key) + '</code>'
        + '<span style="font-size:var(--fs-1);flex:1 1 12em;min-width:0;overflow:hidden;'
        +   'text-overflow:ellipsis;white-space:nowrap">' + testEsc(c.title || '') + '</span>'
        + '<span style="font-size:var(--fs-1);font-weight:700;color:' + col + '">PASS</span>'
        + '<button class="btn" style="font-size:var(--fs-1);padding:0 7px" onclick="testRetest(\''
        +   testEsc(c.case_key) + '\')">Re-test</button>'
        + '</div>';
    }

    return '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;padding:4px 0;'
      +   'border-top:1px solid var(--line-2,#efece4)">'
      + '<code style="font-size:var(--fs-1);color:var(--grey-2)">' + testEsc(c.case_key) + '</code>'
      + '<span style="flex:1 1 16em;min-width:0">'
      +   '<div style="font-size:var(--fs-2)">' + testEsc(c.title || '') + '</div>'
      +   (exp ? '<div style="font-size:var(--fs-1);color:var(--grey-2,#545A61)">should see: '
        + testEsc(exp) + '</div>' : '')
      +   '<input id="cbt_n_' + testEsc(c.case_key) + '" placeholder="what you are seeing instead \u2014 leave '
      +     'empty if it matched" style="width:100%;font:inherit;font-size:var(--fs-1);margin-top:3px;'
      +     'padding:3px 6px;border:1px solid var(--line,#e7e3d8);border-radius:6px;'
      +     'background:var(--card,#fff)">'
      + '</span>'
      + '<span style="font-size:var(--fs-1);font-weight:700;color:' + col + '">'
      +   (l ? testEsc(String(l.status).toUpperCase()) : 'not run') + '</span>'
      + '<span style="display:flex;gap:4px;flex:0 0 auto;align-items:center">'
      + testMarkBtn(c.case_key, 'pass', 'Pass', 'var(--ok-2)', 'var(--ok-tint)')
      + '<button class="btn" onclick="testFromCase(\'' + testEsc(c.case_key) + '\',\'inc\')" '
      +   'style="color:var(--disp);background:var(--disp-tint,#fbeceb)">Incident</button>'
      + '<button class="btn" onclick="testFromCase(\'' + testEsc(c.case_key) + '\',\'req\')" '
      +   'style="color:var(--grey-2);background:var(--neutral-tint)">Requirement</button>'
      + '</span>'
      + '</div>';
  }).join('');
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
function testAreaGet() {
  try { return localStorage.getItem('cb_case_area') || ''; } catch (_) { return ''; }
}
function testArea(v) {
  try { localStorage.setItem('cb_case_area', v); } catch (_) {}
  screenCasesPaint();
}

/* repainted in place after every verdict, so the panel shows what was just recorded */
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
  var FIELDS = ['wcTitle', 'wcDo', 'wcSee', 'wcGot', 'wcPri', 'wcCtl'];
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
    /* ⭐ a figure and its word, not a sentence to parse — the same shape the lab uses above its list */
    var stat = function (n, word, colour) {
      return '<span style="display:inline-flex;flex-direction:column;line-height:1.05">'
        + '<b style="font-size:var(--fs-2)' + (colour ? ';color:' + colour : '') + '">' + n + '</b>'
        + '<span style="font-size:var(--fs-1);color:var(--grey-2)">' + word + '</span></span>';
    };
    head.innerHTML = '<div style="display:flex;align-items:center;gap:7px">'
      + '<b style="font-size:var(--fs-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      +   '\ud83e\uddea ' + testEsc(code) + ' ' + testEsc(name) + '</b>'
      + '<span style="flex:1 1 auto"></span>'
      + '<button title="Close" onclick="screenCasesClose()" style="' + ico + '">\u2715</button>'
      + '</div>'
      + '<div style="display:flex;gap:16px;margin-top:6px">'
      +   stat(t.total, 'written')
      +   stat(t.pass, 'passed', t.pass ? 'var(--ok-2,#1B7F4B)' : null)
      +   stat(t.fail, 'failed', t.fail ? 'var(--disp,#B3261E)' : null)
      +   (known ? stat(inc, 'incidents', inc ? 'var(--disp,#B3261E)' : null) : '')
      +   (known ? stat(req, 'requirements') : '')
      + '</div>';
  }

  /* ── the three areas ── */
  var area = testAreaGet() || (t.total ? 'cases' : 'write');
  if (area === 'raised' && !(inc + req)) area = t.total ? 'cases' : 'write';
  var tab = 'font:inherit;font-size:var(--fs-1);padding:4px 11px;border:0;cursor:pointer;';
  var on = 'background:var(--grey-2,#545A61);color:#fff';
  var off = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  var seg = function (id, label, n) {
    return '<button onclick="testArea(\'' + id + '\')" style="' + tab + (area === id ? on : off)
      + (id === 'write' ? '' : ';border-inline-start:1px solid var(--line,#e7e3d8)') + '">'
      + label + (n == null ? '' : ' <b>' + n + '</b>') + '</button>';
  };
  var tabs = '<div style="display:inline-flex;border:1px solid var(--line,#e7e3d8);border-radius:8px;'
    + 'overflow:hidden;margin:10px 0 4px">'
    + seg('write', 'Write', null)
    + seg('cases', 'Cases', t.total)
    + seg('raised', 'Raised', known ? (inc + req) : null)
    + '</div>';

  var body = area === 'write' ? testCaseFormHTML()
           : area === 'raised' ? (testRaisedHTML(code)
             || '<div style="font-size:var(--fs-1);color:var(--note);padding:8px 0">Nothing has been raised '
               + 'on this screen.</div>')
           : testCaseListHTML(code);
  host.innerHTML = tabs + body;

  Object.keys(typed).forEach(function (id) {
    var el = document.getElementById(id);
    if (el && typed[id] != null && typed[id] !== '') el.value = typed[id];
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
function testViewToggleHTML() {
  var menu = CBTEST.view === 'menu', req = CBTEST.view === 'req', inc = CBTEST.view === 'inc',
      scr = CBTEST.view === 'scr';
  var base = 'font:inherit;font-size:var(--fs-1);padding:2px 8px;border:0;cursor:pointer;';
  var on = 'background:var(--grey-2,#545A61);color:#fff';
  /* ⚠️ List is "on" only when neither of the others is — three segments, one filled */
  var off = 'background:var(--card,#fff);color:var(--grey-2,#545A61)';
  return '<span style="display:inline-flex;border:1px solid var(--line,#e7e3d8);border-radius:7px;overflow:hidden">'
    + '<button onclick="testSetView(\'list\')" title="Every case, grouped by area" '
    +   'style="' + base + (menu || req ? off : on) + '">List</button>'
    + '<button onclick="testSetView(\'menu\')" title="The product as a menu \u2014 every door, and every '
    +   'control behind it" style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);'
    +   (menu && !req && !inc && !scr ? on : off) + '">Menu tree</button>'
    + '<button onclick="testSetView(\'req\')" title="Requirements raised while testing — what is not actioned yet" '
    +   'style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);' + (req ? on : off) + '">Requirements</button>'
    + '<button onclick="testSetView(\'inc\')" title="Incidents \u2014 what a person experienced, and what was '
    +   'done about it" style="' + base + 'border-inline-start:1px solid var(--line,#e7e3d8);'
    +   (inc ? on : off) + '">Incidents</button>'
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
    h += '<div onclick="testFold(\'' + testEsc(gkey) + '\')" style="display:flex;gap:6px;align-items:baseline;cursor:pointer;padding:5px 6px;border-bottom:1px solid var(--line-2,#efece4)">'
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
    + 'border:1px solid var(--line-2,#efece4);' + q + '"><b>This tree rebuilds itself.</b> '
    + (typeof TEST_MENU_RETIRED_NOTE === 'string' ? TEST_MENU_RETIRED_NOTE : '') + '</div>';
  return h;
}

function testCaseBodyHTML(c) {
  var h = '<div style="border-top:1px solid var(--line-2,#efece4);padding:8px 9px;font-size:var(--fs-1);line-height:1.5">';
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
    + 'border:1px solid var(--line-2,#efece4);border-radius:7px;color:var(--grey-2,var(--grey-2))">' + testEsc(c.note) + '</div>';

  /* ⭐ EVIDENCE IS A FIELD OF ITS OWN, because Athi asked for it and because "what you saw" and "where to look at
     it" are different sentences. A note is prose; evidence is a bill number, a spec name, a screenshot filename. */
  h += '<input type="text" id="cbt_n_' + testEsc(c.case_key) + '" placeholder="What did you see?" '
    +  'style="width:100%;margin-top:8px;font-size:var(--fs-2);padding:5px 7px">'
    +  '<input type="text" id="cbt_e_' + testEsc(c.case_key) + '" placeholder="Evidence — bill number, screenshot" '
    +  'style="width:100%;margin-top:5px;font-size:var(--fs-2);padding:5px 7px">'
    /* ⚠ SAY WHETHER THE CALLS ARE BEING KEPT. api() only records while spec is on, so without this the tester
       believes the endpoints are being attached and they are not — a quiet nothing, which is the worst kind. */
    + (typeof specOn === 'function' && specOn()
        ? '<div style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2));margin-top:3px">The API calls this case makes will be attached.</div>'
        : '<div style="font-size:var(--fs-1);color:var(--grey-2,var(--grey-2));margin-top:3px">Turn <b>spec</b> on to attach the API calls too.</div>')
    +  '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px">'
    +    testMarkBtn(c.case_key, 'pass', 'Pass', 'var(--ok-2)', 'var(--ok-tint)')
    +    testMarkBtn(c.case_key, 'fail', 'Fail', 'var(--disp)', 'var(--disp-tint, #fbeceb)')
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
  /* ⭐ what the tester typed comes FIRST; the calls are appended. Their sentence is the evidence that matters,
     and burying it under a machine-generated list would be the wrong way round. */
  var calls = testCallsSince();
  if (calls) ev = (ev ? ev + ' · ' : '') + calls;
  var c = CBTEST.cases.filter(function (x) { return x.case_key === key; })[0] || {};
  try {
    var r = await api('testRecord', { body: {
      run_id: CBTEST.run.id, run_label: CBTEST.run.label || null,
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
