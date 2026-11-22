/* tests/acct-c-f04-bank-difference.test.cjs — Walk C C-F-04 (21 Nov): "Difference" is one figure (statement less books); the reconciliation's remainder is called Unexplained.
 * HAND-COMPUTED  Aug: statement 8,567.50, books 8,237.50: Difference 330.00 (the tile). The reconciliation's remainder after the timing items is 0.00: it reads "Unexplained 0.00", not a second "Difference 0.00".
 * OWNS the offline guard of bkbBrsRows in public/app/cap-bank.js.   CARD 16-finance/bank-reconciliation */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank.js'), 'utf8').split('\r\n').join('\n');
const pick = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const ctx = { tx: (s) => s, bkbE: (s) => String(s), bkbFig: (m) => (m / 100).toFixed(2) };
vm.createContext(ctx);
vm.runInContext(pick('bkbBrsRows') + ';this.rows=bkbBrsRows;', ctx);
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ok   ' + name); };
ok('the engine\'s Difference row is drawn as Unexplained; the other rows keep their words', () => {
  const html = ctx.rows({ rows: [{ label: 'Balance per statement', minor: 856750, sign: '' }, { label: 'Difference', minor: 0, sign: '' }] });
  assert.ok(/Balance per statement/.test(html) && /Unexplained<\/span><span class="mono">0\.00/.test(html));
  assert.ok(!/Difference/.test(html));
});
console.log('\n' + pass + ' passed');
