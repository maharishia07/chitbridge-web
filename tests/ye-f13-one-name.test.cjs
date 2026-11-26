/* tests/ye-f13-one-name.test.cjs — YE-F-13 (walk YE 21 Nov): one name per thing.
 * HAND-COMPUTED  chart axis: "Sept 26" · "July 26" · "June 26" beside "Jan 26" → "Sep 26" · "Jul 26" · "Jun 26" (three letters on every tick; a long month keeps its name);
 *                group key gst_and_statutory → "GST and statutory" (not "Gst and statutory"); the Month lock column says "Income, tax out" like How we are doing (not "Income before tax");
 *                a balance-sheet head that is one ledger (the GST net payable) is said once: no "Total GST collected" over a net figure.
 * OWNS the offline guard of MC.monthPoints labels (public/app/mis-charts.js), groupWords (books-grant-cells.js) and the three copy rules.   CARD 26-reporting-mis-and-bi */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const app = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8').split('\r\n').join('\n');
const MC = require(path.join(__dirname, '..', 'public', 'app', 'mis-charts.js'));
const AU = { 1: 'Jan', 3: 'Mar', 6: 'June', 7: 'July', 9: 'Sept' };
const deps = { tx: (s) => s, money: (m) => String(m), date: (ms, o) => (o.month === 'long' ? 'Month' : (AU[new Date(ms).getUTCMonth() + 1] || 'Xyz') + ' ' + String(new Date(ms).getUTCFullYear()).slice(2)) };
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
ok('the axis ticks: three letters on every short month', () => {
  const labels = MC.monthPoints([{ from: '2026-01-01' }, { from: '2026-03-01' }, { from: '2026-06-01' }, { from: '2026-07-01' }, { from: '2026-09-01' }], deps).map((p) => p.label);
  assert.strictEqual(labels.join(), 'Jan 26,Mar 26,Jun 26,Jul 26,Sep 26');
});
ok('group keys read with their tax name in capitals', () => {
  const text = app('books-grant-cells.js'), at = text.indexOf('  function groupWords('), ctx = { root: { packWord: () => '' }, grantKit: { words: (s) => s } };
  vm.createContext(ctx);
  vm.runInContext('var root = this.root, grantKit = this.grantKit;' + text.slice(at, text.indexOf('\n  }\n', at) + 5) + ';this.g = groupWords;', ctx);
  assert.strictEqual(ctx.g('gst_and_statutory'), 'GST and statutory');
  assert.strictEqual(ctx.g('trade_debtors'), 'Trade debtors');
});
ok('the Month lock column says Profit (FW-05: its cell holds the profit) and the Months list says Profit', () => {
  assert.ok(/tx\('Profit'\)/.test(app('cap-books-lock.js')) && !/Income before tax/.test(app('cap-books-lock.js')));
  assert.ok(/'profit_minor', 'Profit'/.test(app('books-grant-reports.js')) && !/Income before tax/.test(app('books-grant-reports.js')));
});
ok('a balance-sheet head that is one ledger is said once', () => assert.ok(/mine\.length === 1 && String\(mine\[0\]\.code\) === String\(headGroup\.code\)/.test(app('cap-books.js'))));
console.log('\n' + n + ' checks');
