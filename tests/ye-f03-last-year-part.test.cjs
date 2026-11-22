/* tests/ye-f03-last-year-part.test.cjs — YE-F-03 (walk YE 21 Nov): the figures table reads last year from the books and says "(part month)"
 * for the month the books began in. HAND-COMPUTED  Sep 2025 A$5,104.32 beside Sep 2026 A$4,909.84; the other months stay "—".
 * OWNS the offline guard of MC.monthTable (public/app/mis-charts.js).   CARD 26-reporting-mis-and-bi */
'use strict';
const assert = require('assert'), path = require('path');
const MC = require(path.join(__dirname, '..', 'public', 'app', 'mis-charts.js'));
const deps = { tx: (s) => s, money: (m) => 'A$' + (m / 100).toFixed(2), date: (ms) => new Date(ms).toISOString().slice(0, 7), cur: 'AUD' };
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
const bars = [{ from: '2026-08-01', sold_minor: 100, last_year_minor: null }, { from: '2026-09-01', sold_minor: 490984, last_year_minor: 510432, last_year_partial: true }, { from: '2026-10-01', sold_minor: 200, last_year_minor: 300 }];
const rows = MC.monthTable(bars, 'sold_minor', deps, true).rows;
ok('Sep 2026 reads Sep 2025 A$5104.32 and says it is a part month', () => assert.strictEqual(rows[1][2], 'A$5104.32 (part month)'));
ok('a whole earlier month carries no part-month words', () => assert.strictEqual(rows[2][2], 'A$3.00'));
ok('a month with no earlier range stays a dash', () => assert.strictEqual(rows[0][2], '—'));
console.log('\n' + n + ' checks');
