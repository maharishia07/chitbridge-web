'use strict';
/**
 * tests/accfix-1121-yearclose.test.cjs — F-16: the Year close checks say dates as dates, months as month words, and drop the raw period keys.
 * OWNS    the F-16 proof        CALLED BY npm test        CARD    books/year-close
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-period.js'), 'utf8');
const i = src.indexOf('function peYearWhy('); assert.ok(i >= 0);
const ctx = { bkDate: (d) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4), monthNames: () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
vm.createContext(ctx); vm.runInContext(src.slice(i, src.indexOf('\n}\n', i) + 3), ctx);
const w = (t) => vm.runInContext('peYearWhy(' + JSON.stringify(t) + ')', ctx);
assert.strictEqual(w('2026-27 ends on 2027-06-30 — close it once it has ended.'), '2026-27 ends on 30/06/2027 — close it once it has ended.');
assert.strictEqual(w('Close each BAS period first — not closed yet: FY27 Q1 (Jul–Sep 2026) [2026-Q1], FY27 Q2 (Oct–Dec 2026) [2026-Q2].'), 'Close each BAS period first — not closed yet: FY27 Q1 (Jul–Sep 2026), FY27 Q2 (Oct–Dec 2026).');
assert.strictEqual(w('Every month must be locked before the year closes — still open: 2026-07, 2026-08.'), 'Every month must be locked before the year closes — still open: Jul 2026, Aug 2026.');
assert.ok(/esc\(peYearWhy\(x\.why\)\)/.test(src), 'the checks list uses it');
console.log('accfix-1121-yearclose: 4 ok');
