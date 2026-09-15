#!/usr/bin/env node
/**
 * ── ⭐⭐ WHAT A LIST'S CONTROLS ACTUALLY DO, RUN FOR REAL ─────────────────────────────────────────────────────────
 *
 * `e2e/list-controls.cjs` checks that the five controls EXIST. It cannot check that they are RIGHT — and a sort
 * that quietly does nothing, or a filter that narrows to the wrong set, looks identical in the source to one
 * that works. This runs the real files in a vm and reads the real answers back.
 *
 * ⭐ THE DEFAULTS ARE THE ASSERTIONS THAT MATTER, because they are the decisions. A shopkeeper opens co-assists
 * asking *"who can take this now"* and intake asking *"what came in while I was away"* — alphabetical and
 * arbitrary orders answer questions nobody asked. The next person to touch these files will not know those were
 * decisions unless a test says so.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE: the rendering. `lazyWrap` is stubbed here and exercised in a browser instead.
 *
 * Sections:  § 1 co-assists — the order the list opens in
 *            § 2 intake — search, two filters that compose, and which empty state is shown
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

const WEB = path.join(__dirname, '..', 'public');
const src = fs.readFileSync(path.join(WEB, 'app', 'cap-workforce.js'), 'utf8');

/**
 * ⚠️⚠️ THE FIXTURE IS PART OF THE TEST, and the first draft of it made one assertion pass by accident. The raw
 * order began with an `on_shift` actor — so "an unknown sort key falls back to on-shift-first" was satisfied by
 * a list that had not been sorted at all. Proved by breaking `acSortKey` and watching nothing go red.
 * ⭐ So the raw order deliberately opens on an OFF-shift actor: the assertion can now only pass if a sort ran.
 */
const shifts = ['off', 'on_break', 'off', 'on_shift'];
const acts = Array.from({ length: 120 }, (_, i) => ({
  id: 'a' + i, name: (i % 4 === 0 ? 'Zara ' : 'Actor ') + i, role: 'picker', key: 'K' + i,
  type: 'human', status: i % 11 === 0 ? 'inactive' : 'active',
  shift: shifts[i % 4], load: i % 13, max: 10, hat: 'staff',
}));

const sandbox = {
  console: { log() {}, warn() {}, error() {} },
  UI: { acts, acQ: '', acTypeF: 'all', acFlt: 'all', acSort: undefined, nav: 'coassists' },
  SESSION: { capabilities: [] },
  document: { getElementById: () => null, createElement: () => ({ style: {} }), head: { appendChild() {} } },
  ACTOR_TYPES: {}, AI_SLOTS: [], LAZY: {},
  esc: (s) => String(s == null ? '' : s), tx: (s) => s, txf: (s) => s,
  timeAgo: () => '', healthColor: () => '', healthDot: () => '', nm: (v, f) => v || f,
  lazyWrap: (id, items) => items,
  acTypeOf: () => 'human', acLbl: (a) => a.name, hatLabel: () => '',
  /* lives in app.html, not the capability file — the shell owns the active/inactive switch */
  acFlt: () => sandboxRef.UI.acFlt || 'active',
  api: async () => ({}), toast() {}, emptyState: () => '',
};
const sandboxRef = sandbox;
sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'cap-workforce.js' });

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('   ok   ' + name); }
  catch (e) { fail++; console.log('   FAIL ' + name + '\n          ' + e.message); } };
const assert = require('assert');
const vis = () => vm.runInContext('acVisible()', sandbox);
const setSort = (v) => { sandbox.UI.acSort = v; };

/* ══ § 1 · CO-ASSISTS — the order the list opens in ══════════════════════════════════════════════ */
console.log('\n══ CO-ASSISTS — the order a shopkeeper opens the list to ══\n');

ok('⭐ the DEFAULT is on shift first — "who can take this now"', () => {
  setSort(undefined);
  const first = vis().slice(0, 4).map((x) => x.shift);
  assert.deepStrictEqual(first, ['on_shift', 'on_shift', 'on_shift', 'on_shift'],
    'an alphabetical default answers a question nobody asked and buries the one they did');
  const last = vis().slice(-4).map((x) => x.shift);
  assert.ok(last.every((s) => s === 'off'), 'and off-shift sinks: ' + JSON.stringify(last));
});

ok('on break sits between on shift and off', () => {
  setSort('shift');
  const ranks = vis().map((x) => (x.shift === 'on_shift' ? 0 : x.shift === 'on_break' ? 1 : 2));
  assert.deepStrictEqual(ranks, ranks.slice().sort(), 'the three states must not interleave');
});

ok('Name A–Z and Z–A are each other reversed', () => {
  setSort('az'); const az = vis().map((x) => x.name);
  setSort('za'); const za = vis().map((x) => x.name);
  assert.deepStrictEqual(za, az.slice().reverse());
  assert.ok(/^Actor/.test(az[0]), 'A–Z must open on an Actor, not a Zara — got ' + az[0]);
  assert.ok(/^Zara/.test(za[0]), 'Z–A must open on a Zara — got ' + za[0]);
});

ok('busiest first is descending by load', () => {
  setSort('load');
  const loads = vis().map((x) => Number(x.load) || 0);
  assert.deepStrictEqual(loads, loads.slice().sort((a, b) => b - a));
  assert.strictEqual(loads[0], 12, 'the busiest is 12/13 in this fixture');
});

ok('⚠️ an unknown sort key falls back to the default, it does not empty the list', () => {
  setSort('nonsense-from-an-old-session');
  assert.strictEqual(vis().length, 120);
  assert.strictEqual(vis()[0].shift, 'on_shift');
});

/**
 * ⚠️ A LATENT GUARD, AND LABELLED AS ONE. Turning `.slice().sort()` into `.sort()` does NOT make this fail
 * today, because `acVisible` opens with `.filter(...)` and filter already returns a new array — so the slice is
 * belt-and-braces, not the thing holding the line. Proved by breaking it and watching nothing go red.
 * ⭐ It stays because the day somebody removes that filter (an "all" fast path is the obvious way), the sort
 * would start reordering `UI.acts` itself and nothing else would notice. Saying it cannot fire today is honest;
 * counting it as proven would not be. [[feedback-silence-is-the-bug]]
 */
ok('UI.acts is never reordered (latent — filter already copies today)', () => {
  const before = sandbox.UI.acts.map((x) => x.id).join(',');
  setSort('za'); vis(); setSort('load'); vis(); setSort('az'); vis();
  assert.strictEqual(sandbox.UI.acts.map((x) => x.id).join(','), before,
    'reordering the screen\u2019s own array is how a list silently changes under everything else reading it');
});

ok('the status filter still narrows, and the sort still holds inside it', () => {
  sandbox.UI.acFlt = 'inactive'; setSort('az');
  const r = vis();
  assert.ok(r.length > 0 && r.length < 120, 'inactive must be a subset — got ' + r.length);
  assert.ok(r.every((x) => x.status !== 'active'), 'only inactive');
  const names = r.map((x) => x.name);
  assert.deepStrictEqual(names, names.slice().sort((a, b) => a.localeCompare(b)));
  sandbox.UI.acFlt = 'all';
});

ok('search narrows and the chosen order survives it', () => {
  sandbox.UI.acQ = 'Zara'; setSort('az');
  const r = vis();
  assert.ok(r.length > 0 && r.every((x) => /Zara/.test(x.name)));
  const names = r.map((x) => x.name);
  assert.deepStrictEqual(names, names.slice().sort((a, b) => a.localeCompare(b)));
  sandbox.UI.acQ = '';
});

/* ══ § 2 · INTAKE — the queue that keeps filling ═════════════════════════════════════════════════ */
const WEBDIR = path.join(__dirname, '..', 'public');
const chans = ['whatsapp', 'email', 'web', 'whatsapp'];
const list = Array.from({ length: 90 }, (_, i) => ({
  id: 'c' + i, channel: chans[i % 4],
  sender_name: (i % 5 === 0 ? 'Ravi' : 'Sender ' + i),
  sender_ref: '+9199' + i,
  raw_text: i % 3 === 0 ? 'need 2 boxes of bolts and 5 m cable' : 'send price for rice',
  created_at: new Date(Date.now() - i * 36e5).toISOString(),
  structured: i % 4 === 0 ? { lines: [] } : null,
}));

const ibox = {
  console: { log() {}, warn() {}, error() {} },
  esc: (s) => String(s == null ? '' : s), tx: (s) => s, txf: (s) => s,
  emptyState: (i, t, s2) => '[empty:' + t + ']',
  /* lazyWrap is app.html's; here it must behave like it does — first 50 plus a sentinel */
  LAZY: {},
  lazyWrap: (id, items, fn, empty) => (!items.length ? (empty || '')
    : items.slice(0, 50).map(fn).join('') + '<SENT ' + Math.min(50, items.length) + ' of ' + items.length + '>'),
  document: { getElementById: () => null },
  UI: { nav: 'intake' }, SESSION: {}, api: async () => ({}), toast() {},
  navTo() {}, openAssist() {}, loadIntake() {},
};
ibox.window = ibox; ibox.globalThis = ibox; ibox.self = ibox;
vm.createContext(ibox);
vm.runInContext(fs.readFileSync(path.join(WEBDIR, 'app', 'list-ctl.js'), 'utf8'), ibox, { filename: 'list-ctl.js' });
vm.runInContext(fs.readFileSync(path.join(WEBDIR, 'app', 'cap-intake.js'), 'utf8'), ibox, { filename: 'cap-intake.js' });
ibox._INTAKE.list = list; ibox._INTAKE.busy = false; ibox._INTAKE.migrated = true;

const run = (expr) => vm.runInContext(expr, ibox);
const body = () => run('intakeBodyHTML()');
const matched = () => { run('intakeCtl()'); return run("listCtlView('intake').matched"); };
const count = () => { run('intakeCtl()'); return run("listCtlCountHTML('intake')").replace(/<[^>]+>/g, ''); };

console.log('\n══ INTAKE — the queue that keeps filling ══\n');

ok('the toolbar and the count are drawn above the queue', () => {
  const h = body();
  assert.ok(/listctl-search-intake/.test(h), 'a search box');
  assert.ok(/listctl-sort-intake/.test(h), 'a sort control');
  assert.ok(/listctl-filter-state/.test(h), 'the still-to-read filter');
  assert.ok(/listctl-filter-channel/.test(h), 'the channel filter, because three channels are present');
  assert.ok(/90 messages/.test(h), 'the count: ' + (h.match(/\d+ messages[^<]*/) || [])[0]);
});

ok('⭐ newest first by default — what landed while you were away', () => {
  const m = matched();
  assert.strictEqual(m[0].id, 'c0');
  assert.strictEqual(m[m.length - 1].id, 'c89');
});

ok('oldest first reverses it', () => {
  run("listCtlSetSort('intake', 1)");
  assert.strictEqual(matched()[0].id, 'c89');
  run("listCtlSetSort('intake', 0)");
});

ok('⭐ the RAW TEXT is searchable — "the one about bolts"', () => {
  run("listCtlSetQ('intake', 'bolts')");
  const m = matched();
  assert.ok(m.length > 0 && m.length < 90, 'must narrow, got ' + m.length);
  assert.ok(m.every((c) => /bolts/.test(c.raw_text)));
  assert.ok(/of 90/.test(count()), 'and the count says what it narrowed from: ' + count());
  run("listCtlSetQ('intake', '')");
});

ok('a sender is searchable too', () => {
  run("listCtlSetQ('intake', 'Ravi')");
  const m = matched();
  assert.ok(m.length === 18, 'every 5th is Ravi — got ' + m.length);
  run("listCtlSetQ('intake', '')");
});

ok('⭐ "still to read" is the working queue — no draft on it', () => {
  run("listCtlSetFilter('intake', 'state', 'todo')");
  const m = matched();
  assert.ok(m.every((c) => !c.structured), 'every one must be undrafted');
  assert.strictEqual(m.length, 90 - 23, 'every 4th of 90 is drafted');
  run("listCtlSetFilter('intake', 'state', 'done')");
  assert.ok(matched().every((c) => !!c.structured));
  run("listCtlSetFilter('intake', 'state', '')");
});

ok('the channel filter narrows to one channel', () => {
  run("listCtlSetFilter('intake', 'channel', 'email')");
  const m = matched();
  assert.ok(m.length > 0 && m.every((c) => c.channel === 'email'));
  run("listCtlSetFilter('intake', 'channel', '')");
});

ok('two filters compose rather than replace each other', () => {
  run("listCtlSetFilter('intake', 'state', 'todo')");
  run("listCtlSetFilter('intake', 'channel', 'web')");
  const m = matched();
  assert.ok(m.length > 0, 'the fixture must have some');
  assert.ok(m.every((c) => !c.structured && c.channel === 'web'));
  run("listCtlSetFilter('intake', 'state', '')"); run("listCtlSetFilter('intake', 'channel', '')");
});

ok('⚠️ a search that matches nothing keeps the controls on screen', () => {
  run("listCtlSetQ('intake', 'zzzznothing')");
  const h = body();
  assert.strictEqual(matched().length, 0);
  assert.ok(/listctl-search-intake/.test(h),
    'a dead end wearing an empty state: the box you would use to undo it must still be there');
  assert.ok(/Nothing matches/.test(h), 'and it must say nothing MATCHES, not "nothing waiting"');
  run("listCtlSetQ('intake', '')");
});

ok('⚠️ an empty queue says "nothing waiting", not "nothing matches"', () => {
  ibox._INTAKE.list = [];
  const h = body();
  assert.ok(/Nothing waiting/.test(h), h.slice(0, 120));
  ibox._INTAKE.list = list;
});

ok('the rows are drawn lazily — 50 of 90', () => {
  assert.ok(/<SENT 50 of 90>/.test(body()), 'lazyWrap must hold the rest back');
});

console.log('\n  ' + pass + ' passed, ' + fail + ' failed · ' + (pass + fail) + ' checks\n');
process.exit(fail ? 1 : 0);
