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

/* ── what a screen must offer, and how to see it in the source ────────────────────────────────────────────── */
const CONTROLS = {
  /* ⚠️ oninput, not onkeydown. The Platform search accepted Enter and nothing else for a day. */
  search:  (b) => /placeholder="[^"]*[Ss]earch|id="[a-z]{2}_q"|data-testid="[a-z-]*search/.test(b)
                  && /oninput=/.test(b),
  filters: (b) => /<select/.test(b),
  sort:    (b) => /pl_sort|sortPresetSelect|data-testid="[a-z-]*sort|onchange="[a-zA-Z]*[Ss]ort/.test(b),
  /* ⚠️ EITHER SHAPE COUNTS. Athi asked for page numbers on the Platform screen, not an endless scroll:
     *'give the page numbers so the next page can be moved.'* A detector that only knows about onscroll would
     have failed the screen for doing the better thing. What matters is that the list can REACH its total. */
  paging:  (b) => /onscroll=|PagerHTML|data-testid="[a-z-]*page-/.test(b),
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
const BASELINE = {
  /* ⚠️ THIS IS THE DEBT, MEASURED 2026-09-14 — 12 of 13 list screens. It is the quantified version of Athi's
     *"almost every panel is missing this information"*, and it is not a licence: every line here is a panel he
     will eventually have to ask about. Shrink them. `settingsScreen` and `catalogueSetupHubScreen` are the two
     most likely to be legitimate exemptions (a settings page is a form, not a list) — check before fixing. */
  capScreen:               ['search', 'filters', 'sort', 'paging', 'count'],
  catalogueScreen:         ['filters', 'sort', 'paging', 'count'],
  catalogueSetupHubScreen: ['search', 'filters', 'sort', 'paging', 'count'],
  categoriesScreen:        ['filters', 'sort', 'paging', 'count'],
  coassistsScreen:         ['sort', 'paging', 'count'],
  customersScreen:         ['search', 'sort', 'paging', 'count'],
  disputesScreen:          ['search', 'filters', 'sort', 'paging', 'count'],
  intakeScreen:            ['search', 'filters', 'sort', 'paging', 'count'],
  /* ⚠️ NEWLY VISIBLE, not newly broken: these two render a <table> and the guard could not see inside a
     helper until 2026-09-14. The four table habits were always missing. */
  misScreen:               ['search', 'filters', 'sort', 'paging',
                            'sort by heading', 'column chooser', 'resizable', 'reset to default'],
  networkScreen:           ['search', 'filters', 'sort', 'paging', 'count'],
  settingsScreen:          ['search', 'filters', 'sort', 'paging', 'count'],
  suppliersScreen:         ['filters', 'sort', 'paging',
                            'sort by heading', 'column chooser', 'resizable', 'reset to default'],
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
function withHelpers(body, all) {
  let out = body;
  const seen = new Set();
  let frontier = [body];
  for (let d = 0; d < HELPER_DEPTH; d++) {
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
    const body = withHelpers(safe.slice(i, j + 1), helpers);
    /* ⭐ only screens that actually render a LIST. A detail-only or form-only screen has no list to control,
       and holding it to "you must offer sorting" would be noise that teaches people to ignore this file. */
    if (!/class="list"|class="rows"|id="[a-z_]*rows"/.test(body)) continue;
    found.push({ name: m[1], file: path.basename(file), line: src.slice(0, m.index).split('\n').length, body });
  }
  return found;
}

const all = [];
for (const f of FILES) all.push(...screens(fs.readFileSync(f, 'utf8'), f));

const gaps = {};
for (const s of all) {
  const missing = Object.keys(CONTROLS).filter((k) => !CONTROLS[k](s.body));
  if (/<table|<thead|<tbody/.test(s.body)) {
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

let fails = 0, debt = 0;
/* ⚠️ a table is detected by what it RENDERS, not by what it is called: a screen that merely mentions tables in
   a comment owes nothing, and blank() has already removed the comments anyway. */
const isTable = (b) => /<table|<thead|<tbody/.test(b);

for (const s of all.sort((a, b) => a.name.localeCompare(b.name))) {
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

console.log('\n  ' + all.length + ' list screen(s) · ' + fails + ' with unagreed gaps · ' + debt + ' recorded gap(s) outstanding\n');
process.exit(fails ? 1 : 0);
