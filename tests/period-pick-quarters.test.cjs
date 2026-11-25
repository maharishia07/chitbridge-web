/**
 * tests/period-pick-quarters.test.cjs — AT-03 / FW-25: the tax return's own periods are lines of the ONE period control (CBPeriodPick), so the Day box is not the only way to change quarter.
 * Hand figures: quarters of FY27 (Jul-Sep, Oct-Dec 2026, Jan-Mar, Apr-Jun 2027); a quarter that has not begun is not offered; the value is c:<from>|<to>, which CBPeriodPick.of reads back as the range whose end the return reads.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = { URLSearchParams, Date, String, Number, Array, Object, JSON, Math };
root.window = root; vm.createContext(root);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public/app/period-pick.js'), 'utf8'), root);
const P = root.CBPeriodPick;
const real = Date;
const q = (period, start, end, label) => ({ period, start, end, label });
const periods = [q('2026-Q1', '2026-07-01', '2026-09-30', 'Q1 FY27'), q('2026-Q2', '2026-10-01', '2026-12-31', 'Q2 FY27'), q('2027-Q3', '2027-01-01', '2027-03-31', 'Q3 FY27'), q('2027-Q4', '2027-04-01', '2027-06-30', 'Q4 FY27')];
const today = new real().toISOString().slice(0, 10);
const began = periods.filter((p) => p.start <= today).map((p) => 'c:' + p.start + '|' + p.end).reverse();
assert.strictEqual(JSON.stringify(P.optionsOf({}, null, periods).filter((o) => /^c:/.test(o.value)).map((o) => o.value)), JSON.stringify(began), 'quarters that have begun, newest first');
assert.ok(P.optionsOf({}, null, periods).every((o) => o.value !== 'c:2027-04-01|2027-06-30' || today >= '2027-04-01'), 'a future quarter is not offered');
assert.strictEqual(P.optionsOf({}, null).length, 0, 'no quarters, no years: nothing (as before)');
const got = P.of('c:2026-07-01|2026-09-30', {});
assert.deepStrictEqual([got.kind, got.from, got.to], ['custom', '2026-07-01', '2026-09-30'], 'a picked quarter is the range; the return reads the quarter holding its end');
console.log('period-pick-quarters: ok');
