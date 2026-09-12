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
function testModeSet(on) {
  CBTEST.on = !!on;
  try { localStorage.setItem('cb_testmode', CBTEST.on ? '1' : ''); } catch (_) {}
  if (CBTEST.on) {
    testPanelOpen();
    /* ⭐ the first tick explains itself. After that it never asks again — the ⓘ is there for when it is wanted. */
    try { testGuide(false); } catch (_) {}
  } else { testPanelClose(); }
  if (typeof renderApp === 'function') renderApp();
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
function testEnsureVerdict() {
  if (typeof testVerdict === 'function') return Promise.resolve();
  if (CBTEST._verdictP) return CBTEST._verdictP;
  return (CBTEST._verdictP = new Promise(function (resolve) {
    var el = document.createElement('script');
    el.src = '/app/test-verdict.js' + (typeof CB_BUILD !== 'undefined' ? '?v=' + CB_BUILD : '');
    el.async = false;
    el.onload = function () { resolve(); };
    el.onerror = function () { resolve(); };
    document.head.appendChild(el);
  }));
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
    + '<div id="cbtesthead" class="mhd" style="padding:9px 11px 9px 30px;border-bottom:1px solid var(--line,#e7e3d8);'
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
        /* ⭐ Athi, 2026-09-11: *"a minimise button, so we can minimise the test case"* — and it already
           existed, behind an option I had not passed. It HIDES, it never closes: whatever is half-typed in a
           note box is still there when it comes back. */
        minimise: true,
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
var TEST_AREA_COLS = 'minmax(0,12.5em) minmax(0,1fr) 4.2em 4.6em 4.4em 4.8em';

function testPaint() {
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
           ['large', 'Large'], ['full', 'Full height']].map(function (o) {
            return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('')
    +   '</select>'
    +   '<button title="Close" onclick="testModeSet(false)" style="' + ico + '">\u2715</button>'
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
      h += '<div style="position:sticky;top:0;z-index:2;background:var(--card,#fff);'
        + 'display:grid;grid-template-columns:' + TEST_AREA_COLS + ';gap:6px;'
        + 'padding:5px 6px 4px;font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.06em;'
        + 'color:var(--grey-2,#545A61);font-weight:700;border-bottom:1px solid var(--line,#e7e3d8)">'
        + '<span>Area</span><span></span>'
        + '<span style="text-align:end">Cases</span><span style="text-align:end">Passed</span>'
        + '<span style="text-align:end">Failed</span><span style="text-align:end">Not run</span></div>';
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

        h += '<div onclick="testFold(\'' + testEsc(gk) + '\')" style="display:grid;'
          + 'grid-template-columns:' + TEST_AREA_COLS + ';gap:6px;align-items:baseline;'
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
                : (c.title || '')) + '</span>'
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

function testCaseBodyHTML(c) {
  var h = '<div style="border-top:1px solid var(--line-2,#efece4);padding:8px 9px;font-size:var(--fs-1);line-height:1.5">';
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
  full:   { w: 460, h: Math.max(360, window.innerHeight - 40) },
};
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

async function testMark(key, status) {
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
