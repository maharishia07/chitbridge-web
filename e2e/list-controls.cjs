#!/usr/bin/env node
/**
 * ── ⭐⭐⭐ THE WATCHER — every list screen offers the same five controls ──────────────────────────────────────────
 *
 * Athi, 2026-09-14, after finding search silent and the list truncated at 100 for the third time:
 *
 *   *"create a watcher and check all those have been handled every time when you are writing the control. this
 *    becomes very bad. i could have worked with human engineers — once I say, they follow and no drift. here my
 *    fingers are paining."*
 *
 * He is right, and the fault is not that any one of these was hard. It is that he had to say it again for each
 * new panel: *"almost every panel is missing this information"* (2026-09-14), *"we need to have a sort mechanism
 * based on field like we have it in the task"*, *"it has to be lazy loaded"*, *"search also not working?"*.
 *
 * ⭐ A RULE HE HAS TO RESTATE IS NOT A RULE. This file is where it gets stated once.
 *
 * ── THE FIVE ───────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   search    an input that filters the list, and it must be LIVE (oninput). Enter-only is how "search is
 *             broken" happens: the box accepts typing and the list does not move, with nothing saying why.
 *   filters   at least one <select> — a list you cannot narrow is a list you scroll.
 *   sort      a sort control. "most recent, most oldest, whatever" — Athi, 2026-09-14.
 *   paging    page numbers, or an onscroll that loads more. A list that stops at its limit and says
 *             "100 of 2,259" is reporting a number it cannot reach.
 *   count     a line that says how many matched, not how many fitted.
 *
 * ⭐ AND IF IT RENDERS A <table>, four more — see TABLE_CONTROLS below.
 *
 * ── ⚠️⚠️ WHY THIS IS A RATCHET AND NOT A PASS/FAIL ──────────────────────────────────────────────────────────────
 *
 * Turned on as a flat rule it would fail a dozen screens at once, and a guard that is red on arrival gets
 * skipped — which would leave Athi exactly where he started, only with an extra file. So the CURRENT gaps are
 * recorded in BASELINE below and the rule is:
 *
 *     a screen may never LOSE a control it has, and a screen not in BASELINE must have all five.
 *
 * The number can only go down. Every run prints what is still outstanding, so the debt is visible rather than
 * remembered. When a line reaches zero gaps, delete it — the guard then holds that screen to all five forever.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const FILES = [path.join(ROOT, 'app.html')].concat(
  fs.readdirSync(path.join(ROOT, 'app')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'app', f)));

/**
 * ── what a screen must offer, and how to see it in the source ──────────────────────────────────────────────────
 *
 * ⭐ A HELPER NAME IS A LEGITIMATE DETECTOR, and this file has always worked that way — `PagerHTML`, `CountHTML`
 * and `sortPresetSelect` are all somebody else's function. `app/list-ctl.js` is the newest of them: it holds the
 * five controls for a list the browser already has, so a screen that calls it has them.
 *
 * ⚠️ AND THE CONFIG IS WHAT IS CHECKED, NOT THE CALL, for the two that are optional. `listCtlToolbarHTML` always
 * draws a search box, so calling it proves search. It draws filters and sorts only if it was GIVEN some — so
 * those look for `filters: [{` and `sorts: [{` in the screen's own declaration, which is where a screen says
 * what a customer may be narrowed and ordered by. An empty `filters: []` matches neither, on purpose.
 */
const CONTROLS = {
  /* ⚠️ oninput, not onkeydown. The Platform search accepted Enter and nothing else for a day. */
  search:  (b) => /listCtlToolbarHTML\(/.test(b)
                  || (/placeholder="[^"]*[Ss]earch|id="[a-z]{2}_q"|data-testid="[a-z-]*search/.test(b)
                      && /oninput=/.test(b)),
  filters: (b) => /<select/.test(b) || /\bfilters\s*:\s*\[\s*\{/.test(b),
  sort:    (b) => /pl_sort|sortPresetSelect|data-testid="[a-z-]*sort|onchange="[a-zA-Z]*[Ss]ort/.test(b)
                  || /\bsorts\s*:\s*\[\s*\{/.test(b),
  /* ⚠️ EITHER SHAPE COUNTS. Athi asked for page numbers on the Platform screen, not an endless scroll:
     *'give the page numbers so the next page can be moved.'* A detector that only knows about onscroll would
     have failed the screen for doing the better thing. What matters is that the list can REACH its total. */
  paging:  (b) => /onscroll=|PagerHTML|data-testid="[a-z-]*page-|listCtlScrollAttr\(/.test(b),
  count:   (b) => /CountHTML|listtotal|pgTotalText|of\s*'\s*\+/.test(b),
};

/**
 * ── ⭐⭐ AND WHAT A TABLE OWES ON TOP ────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-14: *"we have to have adjustable column headers and usual stuff, all cannot be explained."*
 *
 * ⭐ HE IS RIGHT THAT IT CANNOT BE EXPLAINED, AND THAT IS THE POINT OF WRITING IT DOWN ONCE. A data table is a
 * thing people already know how to use, and every habit it is missing costs him a sentence. These four are the
 * habits: sort by a heading, choose which columns, drag a heading wider, and get back to the default.
 *
 * ⚠️ ONLY SCREENS THAT ACTUALLY RENDER A <table>. A card list owes none of this, and holding it to "you must
 * offer column widths" would be noise — which is how a guard teaches people to ignore it.
 */
const TABLE_CONTROLS = {
  'sort by heading': (b) => /SortBy\(|onclick="[a-zA-Z]*[Ss]ortBy/.test(b),
  'column chooser':  (b) => /ToggleColMenu|colChooser|ColMenuHTML/.test(b),
  'resizable':       (b) => /ColResizeStart|colResizeStart|col-resize/.test(b),
  'reset to default':(b) => /ResetCols|resetCols/.test(b),
};

/**
 * ── THE DEBT, AS IT STOOD WHEN THE WATCHER WAS WRITTEN ─────────────────────────────────────────────────────────
 * screen → the controls it is ALLOWED to be missing. Shrink these; never grow them.
 * ⚠️ Adding a name here is a decision to ship a panel Athi will have to ask about. Do it only with him.
 */
/**
 * ── ⭐⭐⭐ NOT EVERY `<div class="rows">` IS A LIST ────────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ 18 OF THE 47 RECORDED GAPS WERE THIS FILE MISREADING ITS OWN RULE — for the second time. The earlier
 * miss was the four table habits demanded of a passport and a markdown renderer; this is the same mistake one
 * level up. The detector asks "does it render `class="rows"`", and four screens do while holding no records:
 *
 *   · `capScreen`               is the lazy-load DISPATCHER. When the real screen is loaded it delegates; when it
 *                               is not, it returns a SPINNER — and that placeholder is what carries the markup.
 *                               The guard was demanding paging of a loading message.
 *   · `settingsScreen`          a fixed rail built from `SET_SECS`, with sub-rows for the 7 governance layers.
 *   · `misScreen`               a fixed rail of `MIS_BANDS`; its own code says "FIVE FIXED ROWS".
 *   · `catalogueSetupHubScreen` its own code says "a fixed menu of seven and never needs more".
 *
 * ⭐ THE DIFFERENCE THAT MATTERS: a LIST holds records the shop can grow without limit, so it will one day be
 * longer than the screen and Athi will have to ask for search. A RAIL is a menu whose length is decided here, in
 * code. Paging a menu of five is not a missing control, it is a category error — and 18 phantom gaps buried the
 * 29 real ones, which is how a watcher stops being read.
 *
 * ── ⚠️ AND AN EXEMPTION LIST IS THE EASIEST THING IN THIS FILE TO ABUSE ────────────────────────────────────────
 *
 * So it is checked, every run, and each check can FAIL the guard — see the block below the loop. A name here
 * that is not a screen any more, a name that is also in BASELINE, or a rail that has grown a <table> all stop
 * the run. An exemption nobody re-tests is just a deletion with extra steps. [[feedback-silence-is-the-bug]]
 */
const NOT_A_LIST = {
  capScreen:
    'the lazy-load dispatcher — its "rows" is the LOADING SPINNER shown until the real screen arrives',
  settingsScreen:
    'a fixed rail of SET_SECS (plus the 7 governance layers as sub-rows) — a menu, not records',
  misScreen:
    'a fixed rail of MIS_BANDS — its own comment reads "FIVE FIXED ROWS"',
  catalogueSetupHubScreen:
    'a fixed rail of CATSET_SECS — its own comment reads "a fixed menu of seven and never needs more"',
};

const BASELINE = {
  /* ⚠️ THIS IS THE DEBT, MEASURED 2026-09-14 — 12 of 13 list screens. It is the quantified version of Athi's
     *"almost every panel is missing this information"*, and it is not a licence: every line here is a panel he
     will eventually have to ask about. Shrink them. `settingsScreen` and `catalogueSetupHubScreen` are the two
     most likely to be legitimate exemptions (a settings page is a form, not a list) — check before fixing. */
  /* ⭐ TIGHTENED 2026-09-15. Five screens had quietly EARNED a control and the baseline still forgave it — so
     each could have lost it again without a word. A ratchet nobody tightens is a list of excuses. The guard
     prints "now HAS x — remove it from BASELINE" for exactly this; it had been printing it for five. */
  catalogueScreen:         ['filters', 'sort', 'paging', 'count'],
  categoriesScreen:        ['sort', 'paging', 'count'],
  coassistsScreen:         ['sort', 'paging'],
  disputesScreen:          ['search', 'filters', 'sort', 'paging', 'count'],
  intakeScreen:            ['search', 'sort', 'paging', 'count'],
  /**
   * ⚠️⚠️ THESE TWO OWED THE FOUR TABLE HABITS FOR A DAY AND NEVER SHOULD HAVE. The guard was expanding helpers
   * twice — three calls deep — and finding a <table> inside `viewSupplierPassport` (a read-only credentials
   * view), `misTax`/`misFriction` (summary bands of a handful of rows) and `_aiMd` (the MARKDOWN RENDERER for
   * an AI answer). None is a list anybody sorts. Eight of the 55 recorded gaps were the watcher misreading its
   * own rule, and I was one commit from building a column chooser onto a passport to satisfy it.
   *
   * ⭐ THE DEBT THAT IS LEFT IS REAL: search, filters, sort, paging, count. Those they genuinely owe.
   */
  networkScreen:           ['search', 'filters', 'sort', 'paging'],
  /* ⭐ platformScreen is deliberately ABSENT — it has all five, and leaving it out is what holds it there. */
};

/* ── find the screens ─────────────────────────────────────────────────────────────────────────────────────── */
function blank(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); const n = e < 0 ? src.length : e; out += ' '.repeat(n - i); i = n; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const n = e < 0 ? src.length : e + 2; out += src.slice(i, n).replace(/[^\n]/g, ' '); i = n; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1).replace(/[{}]/g, ' ');
      i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

/**
 * ── ⚠️⚠️ A SCREEN IS NOT ONLY ITS OWN BODY ──────────────────────────────────────────────────────────────────────
 *
 * This guard checked the *Screen() function and nothing else, and it was WRONG in a way that made it agree with
 * broken screens: platformScreen() renders its table by calling platScopeTableHTML(), so the <table>, every
 * heading and every control lived in a function the guard never opened. Removing the resize handler changed
 * nothing it could see.
 *
 * ⭐ SO THE BODY IS THE SCREEN PLUS THE HELPERS IT CALLS, one level deep and same-file only. One level is
 * enough in practice (a screen calls its renderer; the renderer does the work) and stops well short of
 * inlining the entire file, which would make every rule pass on the strength of some unrelated code.
 */
function fnBodies(safe) {
  const map = new Map();
  const re = /function\s+([A-Za-z0-9_$]+)\s*\(/g;
  let m;
  while ((m = re.exec(safe))) {
    let i = safe.indexOf('{', m.index);
    if (i < 0) continue;
    let depth = 0, j = i;
    for (; j < safe.length; j++) {
      if (safe[j] === '{') depth++;
      else if (safe[j] === '}' && --depth === 0) break;
    }
    if (!map.has(m[1])) map.set(m[1], safe.slice(i, j + 1));
  }
  return map;
}

/**
 * ⭐ TWO LEVELS, AND THE SECOND ONE EARNED ITS PLACE. A screen calls its renderer (one) and the renderer calls
 * the thing that draws the controls (two) — platformScreen → platScopeTableHTML → platColMenuHTML is exactly
 * that shape, and at depth 1 the guard could not see the column menu at all.
 *
 * ⚠️ IT STOPS AT TWO ON PURPOSE. Every level inlines more code, and a rule that passes because of something
 * unrelated three calls away is a guard agreeing with itself. Two is the shape this codebase actually uses.
 *
 * ⚠️ VISITED SET, not a depth counter alone: two helpers that call each other would otherwise append forever.
 */
const HELPER_DEPTH = 2;
function withHelpers(body, all, depth) {
  let out = body;
  const seen = new Set();
  let frontier = [body];
  for (let d = 0; d < (depth === undefined ? HELPER_DEPTH : depth); d++) {
    const next = [];
    for (const b of frontier) {
      for (const m of b.matchAll(/\b([A-Za-z0-9_$]+)\s*\(/g)) {
        const name = m[1];
        if (seen.has(name) || !all.has(name)) continue;
        seen.add(name);
        out += '\n' + all.get(name);
        next.push(all.get(name));
      }
    }
    frontier = next;
  }
  return out;
}

function screens(src, file) {
  const safe = blank(src), found = [];
  const helpers = fnBodies(safe);
  const re = /function\s+([A-Za-z0-9_$]*Screen)\s*\(/g;
  let m;
  while ((m = re.exec(safe))) {
    let i = safe.indexOf('{', m.index);
    if (i < 0) continue;
    let depth = 0, j = i;
    for (; j < safe.length; j++) {
      if (safe[j] === '{') depth++;
      else if (safe[j] === '}' && --depth === 0) break;
    }
    /**
     * ⚠️⚠️ THE BODY IS THE BLANKED SOURCE, NOT THE RAW SLICE — and this guard passed a screen it should have
     * failed before that was true. A comment I had written saying *"platQuery() has been reading `pl_sort` off
     * an element that does not exist"* satisfied the `pl_sort` detector, so removing the actual control changed
     * nothing. A watcher that can be satisfied by PROSE ABOUT the control is worse than no watcher: it reports
     * green for the exact fault it exists to catch. blank() keeps string contents — the markup lives in
     * strings — and erases every comment. [[feedback-silence-is-the-bug]]
     */
    const raw = safe.slice(i, j + 1);
    const body = withHelpers(raw, helpers);
    /**
     * ⚠️⚠️ THE TABLE HABITS ARE ASKED OF THE SCREEN'S *LIST*, AND ONLY ONE HOP OUT.
     *
     * `body` expands TWICE, which reaches three calls deep — and at three calls deep this guard was demanding a
     * column chooser and draggable widths of:
     *
     *   · `viewSupplierPassport`  a read-only credentials view (suppliersScreen)
     *   · `misTax` / `misFriction`  small summary bands of a handful of rows (misScreen)
     *   · `_aiMd`                 the MARKDOWN RENDERER for an AI answer (misScreen)
     *
     * None of those is a list of records anybody sorts. Athi asked for the four habits on the entity table —
     * *"adjustable column headers and usual stuff"* — and platformScreen → platScopeTableHTML is that shape, at
     * ONE hop. A guard that demands the right thing of the wrong element is one people learn to ignore, and
     * then it is reporting nothing. [[feedback-silence-is-the-bug]]
     *
     * ⚠️ The other five controls still look two hops out: search and paging legitimately live in a helper's
     * helper, and nothing is lost by finding them there.
     */
    const listBody = withHelpers(raw, helpers, 1);
    /* ⭐ only screens that actually render a LIST. A detail-only or form-only screen has no list to control,
       and holding it to "you must offer sorting" would be noise that teaches people to ignore this file. */
    if (!/class="list"|class="rows"|id="[a-z_]*rows"/.test(body)) continue;
    found.push({ name: m[1], file: path.basename(file), line: src.slice(0, m.index).split('\n').length,
                 body, listBody });
  }
  return found;
}

const all = [];
for (const f of FILES) all.push(...screens(fs.readFileSync(f, 'utf8'), f));

const gaps = {};
for (const s of all) {
  const missing = Object.keys(CONTROLS).filter((k) => !CONTROLS[k](s.body));
  /* ⚠️ the table test reads `listBody` — the screen and ONE hop — so a passport, a summary band or a markdown
     renderer three calls away cannot conjure a demand for a column chooser. See the note beside listBody. */
  if (/<table|<thead|<tbody/.test(s.listBody)) {
    for (const k of Object.keys(TABLE_CONTROLS)) if (!TABLE_CONTROLS[k](s.body)) missing.push(k);
  }
  if (missing.length) gaps[s.name] = missing;
}

/* ── --baseline prints the block to paste into BASELINE above ─────────────────────────────────────────────── */
if (process.argv.includes('--baseline')) {
  console.log('const BASELINE = {');
  for (const [n, m] of Object.entries(gaps).sort()) console.log("  " + n + ": [" + m.map((x) => "'" + x + "'").join(', ') + "],");
  console.log('};');
  process.exit(0);
}

console.log('\n══ LIST CONTROLS — search · filters · sort · paging · count ══\n');

let fails = 0, debt = 0, exempt = 0;

/**
 * ── ⚠️⚠️ THE EXEMPTION LIST IS AUDITED BEFORE ANYTHING ELSE IS JUDGED ──────────────────────────────────────────
 *
 * Both of these are silent rot, and both are how a list like this turns into a place to put inconvenient
 * screens. A name that no longer matches a screen forgives nothing and nobody notices; a name in both lists
 * gives one screen two different answers, and which one wins is an accident of the code below.
 */
for (const name of Object.keys(NOT_A_LIST)) {
  if (!all.some((s) => s.name === name)) {
    fails++;
    console.log('  ✗ NOT_A_LIST names ' + name + ', which is not a screen this guard can find.');
    console.log('       It was renamed or deleted. Remove the line — a stale exemption forgives nothing and');
    console.log('       hides the fact that nobody has re-read this list.');
  }
  if (BASELINE[name]) {
    fails++;
    console.log('  ✗ ' + name + ' is in BOTH NOT_A_LIST and BASELINE.');
    console.log('       Those say different things — "it owes nothing" and "it owes these, later". Pick one.');
  }
}

/* ⚠️ a table is detected by what it RENDERS, not by what it is called: a screen that merely mentions tables in
   a comment owes nothing, and blank() has already removed the comments anyway. */
const isTable = (b) => /<table|<thead|<tbody/.test(b);

for (const s of all.sort((a, b) => a.name.localeCompare(b.name))) {
  /**
   * ⚠️ AN EXEMPT SCREEN IS NOT SKIPPED, IT IS CHECKED DIFFERENTLY. It owes none of the five, because a menu of
   * five fixed rows owes nothing — but it must still BE a menu, and the moment it grows a data table it is not
   * one any more. That is a failure, not a note: the exemption would then be hiding a real list.
   */
  if (NOT_A_LIST[s.name]) {
    if (isTable(s.listBody)) {
      fails++;
      console.log('  ✗ ' + s.name + '  (' + s.file + ':' + s.line + ')  is exempt as "' + NOT_A_LIST[s.name] + '"');
      console.log('       — but it now renders a <table>. A rail does not. Either it has become a real list, in');
      console.log('       which case remove it from NOT_A_LIST and give it the controls, or the table belongs');
      console.log('       somewhere else.');
      continue;
    }
    /* ⭐ a rail that has grown a search box has probably stopped being a rail — say so, but do not fail on it:
       somebody may legitimately want to filter a long settings menu without it becoming a list of records. */
    const has = Object.keys(CONTROLS).filter((k) => CONTROLS[k](s.body));
    if (has.includes('search') || has.includes('paging')) {
      console.log('  ⭐ ' + s.name + ' is exempt as a menu, yet now offers ' + has.join(', ')
        + ' — is it still not a list? Re-read NOT_A_LIST.');
    }
    exempt++;
    continue;
  }
  const missing = gaps[s.name] || [];
  const allowed = BASELINE[s.name] || [];
  const regressed = allowed.filter((k) => !missing.includes(k));   /* it had it, per baseline, and lost it */
  const unexpected = missing.filter((k) => !allowed.includes(k));

  if (unexpected.length) {
    fails++;
    console.log('  ✗ ' + s.name + '  (' + s.file + ':' + s.line + ')  missing: ' + unexpected.join(', '));
    console.log('       Athi has asked for these on every panel. Add them, or agree the gap with him and put');
    console.log('       the screen in BASELINE — never silently.');
  } else if (missing.length) {
    debt += missing.length;
    console.log('  ·  ' + s.name + '  — still owes: ' + missing.join(', ') + '   (recorded debt)');
  }
  if (regressed.length) { /* a baseline that is now wrong in our favour: tighten it */
    console.log('  ⭐ ' + s.name + ' now HAS ' + regressed.join(', ') + ' — remove it from BASELINE so it stays.');
  }
}

/* ⭐ the exempt count is PRINTED, not hidden. An exemption nobody sees is one nobody revisits, and the whole
   reason this category exists is that 18 invisible phantom gaps were burying 29 real ones. */
console.log('\n  ' + (all.length - exempt) + ' list screen(s) · ' + exempt + ' fixed rail(s), not lists · '
  + fails + ' with unagreed gaps · ' + debt + ' recorded gap(s) outstanding');
if (exempt) {
  console.log('\n  Not lists, and why:');
  for (const [n, why] of Object.entries(NOT_A_LIST).sort()) console.log('    · ' + n.padEnd(24) + why);
}
console.log('');
process.exit(fails ? 1 : 0);
