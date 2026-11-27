#!/usr/bin/env node
/* practice-rep73-fable.cjs — REP-73 Fable gate (16 Nov): B1 stage in the row · B2 columns follow the band · B6 one name per stage, from the server's words · B7 "costs not shared", never 0 · W9 firm Home keeps no shop cards.
 * Run: node e2e/practice-rep73-fable.cjs   (no browser: the page file is loaded against a stub window) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { loadShopTime } = require('./lib/lift-fn.cjs');
const root = { Promise, tx: (s) => s, txn: (a, b, n) => (Math.abs(n) === 1 ? a : b).split('{count}').join(n), document: { readyState: 'loading', addEventListener(n, h) { (root.heard = root.heard || {})[n] = h; }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, toggle() {} } }, querySelector: () => null, getElementById: () => null }, location: { hostname: 'x' }, localStorage: { getItem: (k) => (root.kept || {})[k] || null, setItem(k, v) { (root.kept = root.kept || {})[k] = v; } } };
/* the page loads helpers.js first (the one esc · fmtMoney · monthNames); so does this sandbox */
const sandbox = vm.createContext({ module: { exports: {} }, window: root, globalThis: root, setInterval() {}, setTimeout() {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'engine', 'money.js'), 'utf8'), sandbox, { filename: 'money.js' });
sandbox.CBMoney = sandbox.module.exports;
loadShopTime(sandbox); /* the one date formatter, before helpers.js routes through it */
for (const part of ['helpers.js', 'assign-bar.js', 'books-practice-band.js', 'books-practice-cells.js', 'books-practice.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', part), 'utf8'), sandbox, { filename: part });
const P = root.CBPractice, T = P.parts || {};
let bad = 0, total = 0;
const t = (n, f) => { total++; try { f(); console.log('  ok  ', n); } catch (e) { bad++; console.log('  FAIL', n, '\n      ', e.message); } };
const row = (o) => Object.assign({ entity_id: 'c1', currency: 'AUD', name: 'C', stage: 'lodged', stage_blocker: null, year_end: { fy: '2025-26', of: 12, locked: 12, bank_to_end: true, end: '2026-06-30' }, queries: { open: 0 }, bank: { state: 'reconciled' }, health: { status: 'good', words: 'Doing well', reasons: [], withheld: { costs: null, currencies: null }, gross_margin_pct: 40, profit_quarter_minor: 500, cash_minor: 900 }, checked: { n: 1, of: 1 }, months_unlocked: 0, grant: { can_see_costs: true } }, o || {});

/* practice-ux225.cjs — UX-225 (cold walk AU r2, U1 + B3): the practice home follows the seat, plural by the shared helper, a role said once or in a column.
 * Run: node e2e/practice-ux225.cjs   (no browser: the page files run against a stub window; the box proof is a named follow-up) */
const stages = [{ key: 'books_in', n: 1 }, { key: 'return_overdue', n: 1 }, { key: 'return_due_30', n: 1 }];
const onUs = [{ key: 'queries_on_us', n: 1 }, { key: 'bank_unexplained', n: 1 }, { key: 'months_unlocked', n: 1 }, { key: 'return_overdue', n: 1 }];
const bandOf = (seat) => ({ seat, bands: [{ key: 'pipeline', first: seat === 'auditor', tiles: stages }, { key: 'on_us', first: seat !== 'auditor', tiles: onUs }] });
const answer = (seat, rows) => ({ band: bandOf(seat), clients: rows, total: rows.length, words: {} });
const tiles = (html) => [...html.matchAll(/data-bp-filter="[^"]*" aria-pressed="[^"]*"/g)].length;
const hasTile = (html, key) => new RegExp('class="bp-tile ' + key + '[ "]').test(html);

t('an audit seat is not shown the return tiles or Months-to-lock, on either band', () => {
  T.use(answer('auditor', [row({ role: 'auditor', grant: { read_only: true } })]));
  const y = T.bandHTML(root.CBPracticeKit.practiceState.data);
  assert.ok(hasTile(y, 'books_in') && !hasTile(y, 'return_overdue') && !hasTile(y, 'return_due_30'), y);
  root.CBPracticeKit.practiceState.band = 'on_us';
  const o = T.bandHTML(root.CBPracticeKit.practiceState.data);
  assert.ok(hasTile(o, 'queries_on_us') && hasTile(o, 'bank_unexplained') && !hasTile(o, 'months_unlocked') && !hasTile(o, 'return_overdue'), o);
  assert.ok(/To follow up/.test(o) && !/On us today/.test(o), 'the auditor reads "To follow up"');
});
t('a bookkeeping seat keeps every tile and "On us today"', () => {
  T.use(answer('adviser', [row({ role: 'adviser' })]));
  root.CBPracticeKit.practiceState.band = 'on_us';
  const o = T.bandHTML(root.CBPracticeKit.practiceState.data);
  assert.ok(hasTile(o, 'months_unlocked') && hasTile(o, 'return_overdue') && /On us today/.test(o) && !/To follow up/.test(o), o);
});
t('the server answer is not changed by hiding (a copy)', () => {
  const d = answer('auditor', [row({ role: 'auditor' })]); T.use(d); T.bandHTML(d);
  assert.strictEqual(d.band.bands[0].tiles.length, 3);
});
t('an audit seat has no Due column; a bookkeeping seat keeps it', () => {
  T.use(answer('auditor', [row({ role: 'auditor' })]));
  assert.ok(T.colsOf('pipeline').indexOf('bas') < 0);
  T.use(answer('adviser', [row({ role: 'adviser' })]));
  assert.ok(T.colsOf('pipeline').indexOf('bas') >= 0);
});
t('plural: one client says "1 client" in the heading (picture and caption: in practice-rep66-pictures.cjs / box-practice-compare.cjs); three say "3 clients"', () => {
  T.use(answer('adviser', [row({ role: 'adviser' })]));
  const one = T.sectionHTML();
  assert.ok(/Your practice · 1 client</.test(one) || /Your practice · 1 client /.test(one), one.slice(0, 300));
  assert.ok(!/1 clients/.test(one), '1 clients must not appear');
  T.use(answer('adviser', [row({ entity_id: 'a' }), row({ entity_id: 'b' }), row({ entity_id: 'c' })]));
  assert.ok(/Your practice · 3 clients/.test(T.sectionHTML()));
});
t('role: one role is said once in the heading and has no column; mixed roles add the Role column', () => {
  T.use(answer('adviser', [row({ entity_id: 'a', role: 'adviser' }), row({ entity_id: 'b', role: 'adviser' })]));
  assert.ok(/practice-role-all/.test(T.sectionHTML()) && T.colsOf('pipeline').indexOf('role') < 0);
  T.use(answer('adviser', [row({ entity_id: 'a', role: 'adviser' }), row({ entity_id: 'b', role: 'auditor' })]));
  assert.ok(T.colsOf('pipeline').indexOf('role') === 1 && !/practice-role-all/.test(T.sectionHTML()));
});
t('a single read-only client is said once in the heading, not on the row', () => {
  T.use(answer('auditor', [row({ role: 'auditor', grant: { read_only: true } })]));
  assert.ok(/practice-readonly-all/.test(T.sectionHTML()));
});
console.log(String.fromCharCode(10) + (total - bad) + '/' + total + ' ok'); process.exit(bad ? 1 : 0);
