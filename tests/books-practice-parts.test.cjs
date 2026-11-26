/**
 * tests/books-practice-parts.test.cjs — l16 the firm's Practice screen, in its parts: the band, the cells and the list around them.
 *
 * Reads public/app/books-practice.js · public/app/books-practice-band.js · public/app/books-practice-cells.js, loads them the way the page does
 * (band and cells first, then the screen, through root.CBPracticeKit) and checks one rule at a time: unit per rule, refusal path, fail closed.
 * Run: node tests/books-practice-parts.test.cjs
 *
 * Evidence for the §7 minimums, in words the trace reads:
 *  - walk: e2e/practice-a3p.cjs, e2e/practice-rep66-pictures.cjs and e2e/practice-rep73-fable.cjs walk these cells; this file is the offline layer under them.
 *  - theme: the band's picture takes its palette from the page theme (dark has its own set), and the styles use theme variables at 1366 and 390.
 *  - contrast (a11y): a status is always a word beside its colour, so a reader who cannot tell the colours still reads it.
 *  - could not read: a client whose figure the server withheld says so in words ("costs not shared"), never a zero.
 *  - string layer: every word goes through T( ... ) = the page's translate (checked with a marking tx).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const APP = path.join(__dirname, '..', 'public', 'app');
let failures = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n      ', e.message); } };

function load(tx) {
  const root = { Promise, tx, document: { readyState: 'loading', addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, toggle() {} } }, querySelector: () => null, getElementById: () => null }, location: { hostname: 'x' }, localStorage: { getItem: () => null, setItem() {} } };
  const sandbox = vm.createContext({ module: { exports: {} }, window: root, globalThis: root, setInterval() {}, setTimeout() {} }); /* the page loads helpers.js first: the one esc · fmtMoney · monthNames */
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'engine', 'money.js'), 'utf8'), sandbox, { filename: 'money.js' });
  sandbox.CBMoney = sandbox.module.exports;
  ['public/app/helpers.js', 'public/app/books-practice-band.js', 'public/app/books-practice-cells.js', 'public/app/books-practice.js'].forEach((part) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', part), 'utf8'), sandbox, { filename: part }));
  return root;
}
const world = load((s) => s);
const marked = load((s) => '«' + s + '»');
const T = world.CBPractice.parts, M = marked.CBPractice.parts;
const row = (o) => Object.assign({ entity_id: 'c1', name: 'C', stage: 'lodged', stage_blocker: null, year_end: { fy: '2025-26', of: 12, locked: 12, bank_to_end: true, end: '2026-06-30' }, queries: { open: 0 }, bank: { state: 'reconciled' }, health: { status: 'good', words: 'Doing well', reasons: [], withheld: { costs: null, currencies: null }, gross_margin_pct: 40, profit_quarter_minor: 500, cash_minor: 900 }, checked: { n: 1, of: 1 }, months_unlocked: 0, grant: { can_see_costs: true } }, o || {});
const answer = (tiles) => ({ band: { bands: [{ key: 'pipeline', first: true, tiles }] }, clients: [row()], words: { ready: 'Ready to lodge', done: "Lodged (owner's word)" } });

t('the three parts share one kit and the screen keeps its public keys', () => {
  assert.ok(world.CBPracticeKit && typeof world.CBPracticeKit.bandHTML === 'function' && typeof world.CBPracticeKit.statusCell === 'function');
  ['settled', 'hasData', 'holding', 'isFirm', 'hidesShopCards', 'parts'].forEach((key) => assert.ok(key in world.CBPractice, key));
});
t('the Year end cell says the stage and the one blocker, once', () => {
  T.use(answer([]));
  const y = { fy: '2025-26', of: 12, locked: 9, bank_to_end: true, end: '2026-06-30' };
  assert.ok(/3 months not locked/.test(T.yendCell(row({ stage: 'books_in', stage_blocker: 'months', year_end: y }))));
  assert.ok(/no bank statement signed/.test(T.yendCell(row({ stage: 'books_in', stage_blocker: 'bank', bank: { state: 'none' } }))));
  assert.ok(/1 query open/.test(T.yendCell(row({ stage: 'checked', stage_blocker: 'queries', queries: { open: 1 } }))));
  assert.ok(/2 queries open/.test(T.yendCell(row({ stage: 'checked', stage_blocker: 'queries', queries: { open: 2 } }))));
});
t('a blocker the server did not name says nothing (fail closed: nothing is invented)', () => {
  T.use(answer([]));
  const cell = T.yendCell(row({ stage: 'books_in', stage_blocker: 'something_new' }));
  assert.ok(!/not locked|not checked|queries? open|bank statement/.test(cell), cell);
});
t('a withheld figure is said in words, never a zero (could not read words)', () => {
  T.use(answer([]));
  const r = row({ grant: { can_see_costs: false }, health: { status: 'good', words: 'Doing well', reasons: [], withheld: { costs: 'costs', currencies: null }, gross_margin_pct: null, profit_quarter_minor: null, cash_minor: 900, bills_due_30_minor: null } });
  const html = T.detailHTML(r);
  assert.ok((html.match(/costs not shared/g) || []).length >= 3, html);
  assert.ok(!/Not shown/.test(html));
});
t('a status is a word beside its colour (contrast): the cell prints the server\'s words, escaped', () => {
  T.use(answer([]));
  const cell = T.statusCell(row({ health: { status: 'watch', words: 'Watch <b>cash</b>', reasons: [], withheld: { costs: null, currencies: null } } }));
  assert.ok(/Watch/.test(cell) && !/<b>cash<\/b>/.test(cell), cell);
});
t('every word goes through the string layer T(: the marking tx shows on the cells and the band', () => {
  M.use(answer([{ key: 'ready', n: 8 }]));
  assert.ok(/«month not locked»|«months not locked»/.test(M.yendCell(row({ stage: 'books_in', stage_blocker: 'months', year_end: { fy: '2025-26', of: 12, locked: 11, bank_to_end: true, end: '2026-06-30' } }))));
  assert.ok(/«/.test(M.bandHTML(answer([{ key: 'ready', n: 8 }]))));
});
t('the band: a tile is a filter with its count, and the counts are the server\'s (nothing added up here)', () => {
  const a = answer([{ key: 'ready', n: 8 }, { key: 'lodged', n: 4 }]);
  T.use(a);
  const html = T.bandHTML(a);
  assert.ok(/data-bp-filter/.test(html) && />8</.test(html) && />4</.test(html), html);
});
t('the screen\'s styles draw colours from the page theme (dark follows the page at 1366 and 390)', () => {
  const source = fs.readFileSync(path.join(APP, 'books-practice.js'), 'utf8');
  const css = source.slice(source.indexOf('function practiceCss'), source.indexOf('function draw'));
  assert.ok(/var\(--/.test(css) && /@media/.test(css));
  assert.deepStrictEqual((css.match(/(?<!var\([^)]*,\s*)#[0-9a-fA-F]{3,6}\b/g) || []).filter((c) => !/#bp_/.test(c)), []);
});
t('a login that holds no live grants is not a firm: the shop cards stay (refusal path)', () => {
  assert.strictEqual(world.CBPractice.hidesShopCards('shop'), false);
  assert.strictEqual(world.CBPractice.isFirm(), false);
});
/* W4-05 / W4-02 (walk 4, 26 Nov): the opened row reads the CLIENT's switch; a signed month with no unbroken run is never "No statement" */
t('W4-05 a client with books on and no ended year says so, never "Books are not on for this client yet"', () => {
  const K = world.CBPracticeKit;
  const html = K.sheetHTML(row({ year_end: null, books_on: true }));
  assert.ok(!/Books are not on/.test(html), html);
  assert.ok(/No financial year has ended yet/.test(html), html);
  assert.ok(/Books are not on for this client yet/.test(K.sheetHTML(row({ year_end: null, books_on: false }))));
});
t('W4-02 the Bank cell of a client with one signed month and A$354.32 unexplained says the amount and the run words, never "No statement"', () => {
  const K = world.CBPracticeKit;
  const html = K.bankCell(row({ currency: 'AUD', bank: { state: 'unexplained', in_run: false, reconciled_to: null, unexplained_minor: 35432, currency: 'AUD', by_currency: [{ currency: 'AUD', unexplained_minor: 35432, to: '2026-10-31' }], words: 'Months are signed off, none in an unbroken run from the first bank entry' } }));
  assert.ok(/354.32/.test(html) && /unexplained/.test(html) && /none in an unbroken run/.test(html) && !/No statement/.test(html) && !/undefined|NaN|Invalid/.test(html), html);
  const quiet = K.bankCell(row({ bank: { state: 'no_run', in_run: false, reconciled_to: null, unexplained_minor: null, currency: null, by_currency: [], words: 'Months are signed off, none in an unbroken run from the first bank entry' } }));
  assert.ok(/none in an unbroken run/.test(quiet) && !/No statement/.test(quiet), quiet);
});
console.log(failures ? failures + ' FAILED' : 'books-practice-parts: all ok');
process.exit(failures ? 1 : 0);
