/**
 * tests/fin-15-dispute-row.test.cjs — FIN-15 (web half): Collections keeps a customer whose NET is 0 but who has a bill in dispute (Ravi: 170.00 disputed, 170.00 advance),
 * and says the dispute beside the amount. Hand figures: balance 0, disputed 17000 minor (170.00). A settled party (0 and 0) stays out.
 * The advance figure itself needs an api key on the dues row: listed for cb-api, not shown here.
 * Pure: the two functions are cut from public/app/cap-finance.js and run with stand-ins. Run: node tests/fin-15-dispute-row.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-finance.js'), 'utf8');
const from = src.indexOf('function finOwes'), to = src.indexOf('/** the unbilled orders in words');
assert(from > 0 && to > from, 'the cut points moved');
const sb = { FIN: { cur: 'INR' }, esc: (s) => String(s), tx: (s) => s, bkMoney: (m, c) => c + ' ' + (m / 100).toFixed(2) };
vm.createContext(sb);
vm.runInContext(src.slice(from, to) + '\nthis.__t = { finOwes, finDisputeHTML };', sb);
let pass = 0;
const it = (what, fn) => { try { fn(); pass++; console.log('  ok  ' + what); } catch (e) { console.log('  FAIL ' + what + '\n      ' + e.message); process.exitCode = 1; } };
it('a net-0 party with 170.00 in dispute stays on the list', () => assert.strictEqual(sb.__t.finOwes({ balance_minor: 0, disputed_minor: 17000 }), true));
it('a party owing 100.00 stays; a settled party (0 and 0) is out', () => {
  assert.strictEqual(sb.__t.finOwes({ balance_minor: 10000, disputed_minor: 0 }), true);
  assert.strictEqual(sb.__t.finOwes({ balance_minor: 0, disputed_minor: 0 }), false);
});
it('the dispute is said beside the amount, with the currency, and nothing when there is none', () => {
  assert.match(sb.__t.finDisputeHTML({ disputed_minor: 17000 }), /In dispute INR 170\.00/);
  assert.strictEqual(sb.__t.finDisputeHTML({ disputed_minor: 0 }), '');
});
console.log(pass + ' passed');
