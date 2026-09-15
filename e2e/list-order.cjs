#!/usr/bin/env node
/**
 * ── ⭐⭐ THE ORDER A LIST OPENS IN, RUN FOR REAL ──────────────────────────────────────────────────────────────────
 *
 * `e2e/list-controls.cjs` checks that a sort control EXISTS. It cannot check that the control is RIGHT, and a
 * sort that quietly does nothing looks identical in the source to one that works. This runs the real file and
 * reads the real order back.
 *
 * ⭐ THE DEFAULT IS THE ASSERTION THAT MATTERS. A shopkeeper opens the co-assists list asking *"who can take
 * this now"* — an alphabetical default answers a question nobody asked and buries the answer to the one they
 * did. That was a decision, and the next person to touch the file will not know it was one unless a test says so.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE: the rendering. `lazyWrap` is exercised in a browser, not here.
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

console.log('\n  ' + pass + ' passed, ' + fail + ' failed · ' + (pass + fail) + ' checks\n');
process.exit(fail ? 1 : 0);
