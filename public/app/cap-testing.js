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
 * ⚠️ PASS/FAIL IS RECORDED AGAINST THE VERSION OF THE CASE THE SERVER HOLDS, not against the words on screen. If
 * somebody edits a case while you have the panel open, your result says v3 and the panel says v2 — the server is
 * right, and the board shows the version each result was actually given.
 */
'use strict';

var CBTEST = { on: false, cases: [], last: {}, area: '', open: null, run: null, busy: false, adding: false, stale: {} };

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
  if (CBTEST.on) { testPanelOpen(); } else { testPanelClose(); }
  if (typeof renderApp === 'function') renderApp();
}
function testModeIsOn() { try { return localStorage.getItem('cb_testmode') === '1'; } catch (_) { return false; } }

/* ── loading ──────────────────────────────────────────────────────────────────────────────────────────────── */
async function testLoad(force) {
  if (CBTEST.cases.length && !force) return;
  CBTEST.busy = true; testPaint();
  try {
    /* two calls for the whole panel — never one per case. See the round-trip note in routes/testing.js. */
    var a = await api('testCases');
    var b = await api('testResults');
    /* ⭐ a third read, and worth its round trip: without it a tester works through cases that were written
       against wording nobody stands behind any more, and records passes that prove nothing. */
    var st = await api('testStale');
    CBTEST.stale = {};
    ((st && st.stale) || []).forEach(function (x) { CBTEST.stale[x.case_key] = x; });
    CBTEST.cases = (a && a.cases) || [];
    CBTEST.last = {};
    ((b && b.results) || []).forEach(function (r) {
      /* ⭐ THE WORST RESULT WINS, not the newest. A case proved green by a unit test and red at the counter is
         not a green case, and showing the later of the two would let one hide the other. */
      var rank = { fail: 4, blocked: 3, skipped: 2, pass: 1 };
      var cur = CBTEST.last[r.case_key];
      if (!cur || rank[r.status] > rank[cur.status]
          || (rank[r.status] === rank[cur.status] && new Date(r.at) > new Date(cur.at))) CBTEST.last[r.case_key] = r;
    });
  } catch (e) {
    if (typeof toast === 'function') toast(tx('Could not read the test cases') + ' — ' + e.message, true);
  }
  CBTEST.busy = false; testPaint();
}

/* ── the panel ────────────────────────────────────────────────────────────────────────────────────────────── */
function testPanelClose() {
  var el = document.getElementById('cbtesthost');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function testPanelOpen() {
  if (document.getElementById('cbtesthost')) { testPaint(); return; }
  testRunLoad();
  if (!CBTEST.area) CBTEST.area = testAreaGuess();

  var host = document.createElement('div');
  host.id = 'cbtesthost';
  host.innerHTML =
    '<div id="cbtestpanel" role="dialog" aria-label="Test panel" style="position:fixed;right:16px;bottom:16px;'
    + 'width:min(420px,calc(100vw - 32px));max-height:min(70vh,620px);display:flex;flex-direction:column;'
    + 'background:var(--card,#fff);border:1px solid var(--line,#e7e3d8);border-radius:12px;'
    + 'box-shadow:0 10px 34px rgba(0,0,0,.16);z-index:4000;overflow:hidden">'
    + '<div id="cbtestbody" style="display:flex;flex-direction:column;min-height:0;flex:1"></div></div>';
  document.body.appendChild(host);

  /**
   * ⭐ ADOPTED, NOT REBUILT. makeMovable() already does drag, resize and per-key geometry persistence, and it has
   * existed since 2026-08-15. A tester drags this panel off whatever it is covering ten times an hour, and where
   * they put it must survive a reload or they will drag it again every time.
   */
  try {
    if (typeof makeMovable === 'function') {
      makeMovable(document.getElementById('cbtestpanel'), { key: 'cb_testpanel', minW: 300, minH: 220 });
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

function testAreas() {
  var seen = {}, out = [];
  CBTEST.cases.forEach(function (c) {
    if (!seen[c.module_key]) { seen[c.module_key] = 1; out.push({ key: c.module_key, name: c.module_name || '' }); } });
  return out.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
}

function testShown() {
  return CBTEST.cases.filter(function (c) { return !CBTEST.area || c.module_key === CBTEST.area; });
}

function testPaint() {
  var body = document.getElementById('cbtestbody');
  if (!body) return;

  var STAT = { pass: ['#2c7a43', '#e6f4ea'], fail: ['#b4453f', '#fbeceb'],
               blocked: ['#8a5a1e', '#fbf3e3'], skipped: ['#8a949c', '#EEF1F5'] };

  var shown = testShown();
  var n = { pass: 0, fail: 0, blocked: 0, skipped: 0, todo: 0 };
  shown.forEach(function (c) { var l = CBTEST.last[c.case_key]; if (!l) n.todo++; else n[l.status]++; });
  var staleN = shown.filter(function (c) { return CBTEST.stale[c.case_key]; }).length;

  /* ── the header: who is recording, into which run, over which area ── */
  var h = '<div style="padding:9px 11px;border-bottom:1px solid var(--line,#e7e3d8);background:var(--paper,#faf8f3)">'
    + '<div style="display:flex;align-items:center;gap:8px">'
    +   '<b style="font-size:13px">🧪 Testing</b>'
    +   '<span style="flex:1"></span>'
    +   '<button class="btn" title="Add a case for something you just found" onclick="testAddOpen()" '
    +     'style="padding:2px 9px;font-size:15px;line-height:1.3">+</button>'
    +   '<button class="btn" title="Read the cases again" onclick="testLoad(true)" style="padding:2px 8px">↻</button>'
    +   '<button class="btn" title="Close" onclick="testModeSet(false)" style="padding:2px 8px">✕</button>'
    + '</div>'
    + '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;align-items:center">'
    +   '<select onchange="testSetArea(this.value)" style="font-size:12px;padding:3px 5px;max-width:190px">'
    +     '<option value=""' + (CBTEST.area ? '' : ' selected') + '>All areas · ' + CBTEST.cases.length + '</option>'
    +     testAreas().map(function (a) {
            return '<option value="' + testEsc(a.key) + '"' + (CBTEST.area === a.key ? ' selected' : '') + '>'
                 + testEsc(a.key + ' · ' + a.name) + '</option>'; }).join('')
    +   '</select>'
    +   '<select onchange="testSetKind(this.value)" title="How this is being tested" style="font-size:12px;padding:3px 5px">'
    +     ['manual', 't0', 't1', 't2', 't3', 'unit', 'regression'].map(function (k) {
            return '<option value="' + k + '"' + (CBTEST.run.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('')
    +   '</select>'
    + '</div>'
    /* ⭐ the tally is the reason to keep the panel open — it is the only place that says how far you have got */
    + '<div style="margin-top:6px;font-size:11px;color:var(--grey-2,#545A61)">'
    +   (n.pass ? '<b style="color:#2c7a43">' + n.pass + '</b> passed · ' : '')
    +   (n.fail ? '<b style="color:#b4453f">' + n.fail + '</b> failed · ' : '')
    +   (n.blocked ? '<b style="color:#8a5a1e">' + n.blocked + '</b> blocked · ' : '')
    +   '<b>' + n.todo + '</b> to go'
    +   (staleN ? ' \u00b7 <b style="color:#8a5a1e">' + staleN + '</b> spec moved' : '')
    +   (CBTEST.run.label ? ' · ' + testEsc(CBTEST.run.label) : '')
    + '</div>'
    + '</div>';

  if (CBTEST.adding) { body.innerHTML = h + testAddHTML(); return; }

  /* ── the list ── */
  h += '<div style="flex:1;overflow:auto;padding:7px 9px;min-height:0">';
  if (CBTEST.busy && !CBTEST.cases.length) {
    h += '<div style="padding:14px;color:var(--grey-2,#545A61);font-size:12px">Reading the cases…</div>';
  } else if (!CBTEST.cases.length) {
    /* ⚠️ AN EMPTY BOARD IS NOT AN ERROR, and must not read like one. Say what to do. */
    h += '<div style="padding:14px 12px;font-size:12px;line-height:1.6;color:var(--grey-2,#545A61);text-align:center">'
      +  '<div style="margin-bottom:9px">No test cases on this board yet.</div>'
      +  '<button class="btn pri" onclick="testSeed()" style="font-size:12px;padding:6px 14px">'
      +  (CBTEST.seeding ? 'Loading…' : 'Load the test cases') + '</button>'
      +  '<div style="margin-top:9px;font-size:10.5px">The documented cases — the counter, the bill, the queue, '
      +  'suppliers, the offer lab. Or press <b>+</b> to write your own.</div></div>';
  } else if (!shown.length) {
    h += '<div style="padding:12px;font-size:12px;color:var(--grey-2,#545A61)">Nothing in this area yet — '
      +  'press <b>+</b> to add the first case for it.</div>';
  } else {
    shown.forEach(function (c) {
      var l = CBTEST.last[c.case_key];
      var col = l ? STAT[l.status] : null;
      var isOpen = CBTEST.open === c.case_key;
      h += '<div style="border:1px solid var(--line,#e7e3d8);border-left:3px solid ' + (col ? col[0] : 'transparent')
        +  ';border-radius:8px;margin-bottom:6px;background:var(--card,#fff)">'
        +  '<div onclick="testOpen(\'' + testEsc(c.case_key) + '\')" style="display:flex;gap:7px;align-items:flex-start;'
        +    'padding:7px 9px;cursor:pointer">'
        +    '<span style="font-family:ui-monospace,Menlo,monospace;font-size:10.5px;font-weight:700;'
        +      'background:' + (col ? col[1] : '#EEF1F5') + ';color:' + (col ? col[0] : '#545A61')
        +      ';border-radius:4px;padding:2px 5px;white-space:nowrap">' + testEsc(c.case_key) + '</span>'
        +    '<span style="flex:1;min-width:0;font-size:12px;line-height:1.35">' + testEsc(c.title || '')
        +      '<span style="display:block;color:var(--grey-2,#545A61);font-size:10.5px;margin-top:2px">'
        +      (l ? testEsc(l.status.toUpperCase() + ' · ' + (l.tester_name || '') + ' · ' + testAgo(l.at))
                 + (l.note ? ' — ' + testEsc(l.note) : '')
               : 'not tested yet') + '</span></span>'
        /* ⚠️ THE SPEC MOVED, SO THE CASE IS SUSPECT — said on the row, not hidden behind a filter. A green
           case whose clause has changed is the most misleading thing a board can show. */
        + (CBTEST.stale[c.case_key]
            ? '<span title="' + testEsc('The clause this case proves has changed since it was written — '
                + 'clause ' + CBTEST.stale[c.case_key].clause + ' is now v' + CBTEST.stale[c.case_key].clause_now
                + ', this case cites v' + CBTEST.stale[c.case_key].cited_version + '.')
              + '" style="font-size:9.5px;background:#fbf3e3;color:#8a5a1e;border-radius:4px;'
              + 'padding:2px 5px;white-space:nowrap">spec moved</span>'
            : '')
        +  '</div>';
      if (isOpen) h += testCaseBodyHTML(c);
      h += '</div>';
    });
  }
  h += '</div>';
  body.innerHTML = h;
}

function testCaseBodyHTML(c) {
  var h = '<div style="border-top:1px solid var(--line-2,#efece4);padding:8px 9px;font-size:11.5px;line-height:1.5">';
  if (c.pre) h += '<div style="color:var(--grey-2,#545A61);margin-bottom:5px"><b>Before:</b> ' + testEsc(c.pre) + '</div>';
  if (c.data) h += '<div style="color:var(--grey-2,#545A61);margin-bottom:5px"><b>Use:</b> ' + testEsc(c.data) + '</div>';
  (c.steps || []).forEach(function (s, i) {
    h += '<div style="display:flex;gap:6px;margin:4px 0">'
      +  '<span style="color:#8a949c;min-width:13px">' + (i + 1) + '</span>'
      +  '<span style="flex:1">' + testEsc(s[0])
      +    '<span style="display:block;color:var(--grey-2,#545A61)">→ ' + testEsc(s[1]) + '</span></span></div>';
  });
  if (c.note) h += '<div style="margin-top:6px;padding:6px 8px;background:var(--paper,#faf8f3);'
    + 'border:1px solid var(--line-2,#efece4);border-radius:7px;color:var(--grey-2,#545A61)">' + testEsc(c.note) + '</div>';

  /* ⭐ EVIDENCE IS A FIELD OF ITS OWN, because Athi asked for it and because "what you saw" and "where to look at
     it" are different sentences. A note is prose; evidence is a bill number, a spec name, a screenshot filename. */
  h += '<input type="text" id="cbt_n_' + testEsc(c.case_key) + '" placeholder="What did you see?" '
    +  'style="width:100%;margin-top:8px;font-size:12px;padding:5px 7px">'
    +  '<input type="text" id="cbt_e_' + testEsc(c.case_key) + '" placeholder="Evidence — bill number, screenshot" '
    +  'style="width:100%;margin-top:5px;font-size:12px;padding:5px 7px">'
    /* ⚠ SAY WHETHER THE CALLS ARE BEING KEPT. api() only records while spec is on, so without this the tester
       believes the endpoints are being attached and they are not — a quiet nothing, which is the worst kind. */
    + (typeof specOn === 'function' && specOn()
        ? '<div style="font-size:10px;color:var(--grey-2,#545A61);margin-top:3px">The API calls this case makes will be attached.</div>'
        : '<div style="font-size:10px;color:var(--grey-2,#545A61);margin-top:3px">Turn <b>spec</b> on to attach the API calls too.</div>')
    +  '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px">'
    +    testMarkBtn(c.case_key, 'pass', 'Pass', '#2c7a43', '#e6f4ea')
    +    testMarkBtn(c.case_key, 'fail', 'Fail', '#b4453f', '#fbeceb')
    +    testMarkBtn(c.case_key, 'blocked', 'Blocked', '#8a5a1e', '#fbf3e3')
    +    testMarkBtn(c.case_key, 'skipped', 'Skip', '#545A61', '#EEF1F5')
    +  '</div></div>';
  return h;
}
function testMarkBtn(key, status, label, fg, bg) {
  return '<button class="btn" onclick="testMark(\'' + testEsc(key) + '\',\'' + status + '\')" '
    + 'style="font-size:12px;padding:4px 10px;font-weight:700;color:' + fg + ';background:' + bg + ';border-color:' + bg + '">'
    + label + '</button>';
}

function testSetArea(v) { CBTEST.area = v; CBTEST.open = null; testPaint(); }
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

function testAddOpen() { CBTEST.adding = true; testPaint(); }
function testAddClose() { CBTEST.adding = false; testPaint(); }

function testAddHTML() {
  var areas = testAreas();
  var suggested = CBTEST.area || testAreaGuess() || (areas[0] && areas[0].key) || 'NEW';
  return '<div style="flex:1;overflow:auto;padding:10px 11px;min-height:0;font-size:12px">'
    + '<div style="font-weight:700;margin-bottom:7px">New case</div>'
    + '<label style="font-size:11px;color:var(--grey-2,#545A61)">Area</label>'
    + '<input type="text" id="cbt_a_mod" value="' + testEsc(suggested) + '" '
    +   'style="width:100%;margin-bottom:7px;padding:5px 7px;font-size:12px">'
    + '<label style="font-size:11px;color:var(--grey-2,#545A61)">What should happen</label>'
    + '<input type="text" id="cbt_a_title" placeholder="e.g. A local supplier cannot be sent a chit" '
    +   'style="width:100%;margin-bottom:7px;padding:5px 7px;font-size:12px">'
    + '<label style="font-size:11px;color:var(--grey-2,#545A61)">Do this</label>'
    + '<input type="text" id="cbt_a_do" placeholder="The one action that shows it" '
    +   'style="width:100%;margin-bottom:7px;padding:5px 7px;font-size:12px">'
    + '<label style="font-size:11px;color:var(--grey-2,#545A61)">You should see</label>'
    + '<input type="text" id="cbt_a_see" placeholder="What a correct answer looks like" '
    +   'style="width:100%;margin-bottom:7px;padding:5px 7px;font-size:12px">'
    + '<label style="font-size:11px;color:var(--grey-2,#545A61)">Why this case exists</label>'
    + '<input type="text" id="cbt_a_note" placeholder="What went wrong, in your words" '
    +   'style="width:100%;margin-bottom:9px;padding:5px 7px;font-size:12px">'
    /* ⚠️ SAID BEFORE THEY SAVE, not after. The document in the repository is where the wording is reviewed, and a
       case written here is real but is not yet in it — so it is not in the printed script either. */
    + '<div style="font-size:10.5px;color:var(--grey-2,#545A61);line-height:1.5;margin-bottom:9px">'
    +   'This becomes a real case on the board straight away. To get it into the printed script as well, add it to '
    +   '<code>TEST-CASES-V2.js</code> — the document stays where the wording is reviewed.</div>'
    + '<div style="display:flex;gap:6px">'
    +   '<button class="btn pri" onclick="testAddSave()" style="font-size:12px">Add the case</button>'
    +   '<button class="btn" onclick="testAddClose()" style="font-size:12px">Cancel</button>'
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
