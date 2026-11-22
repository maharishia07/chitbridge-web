/* tests/acct-c-f03-bank-summary.test.cjs — Walk C C-F-03 (21 Nov): the Statements summary says "kept", never the tick that means signed off.
 * HAND-COMPUTED  Aug 2026 kept, 6 months missing: "Aug kept · 6 missing". The legend on the same screen says ✓ = signed off, so the summary holds no ✓.
 * OWNS the offline guard of bkstSummary in public/app/cap-bank-statements.js.   CARD 16-finance/bank-reconciliation */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank-statements.js'), 'utf8').split('\r\n').join('\n');
const pick = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const ctx = { tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), BKST: { mode: 'ok', data: {}, fileTotal: 2, last: '2026-08' }, BKH: {}, bkstMonth: () => 'Aug', bkstMissing: () => 6, bkstSignedLine: () => '', bkstEmptyWords: () => 'empty', bksCostBlindSay: () => 'blind' };
vm.createContext(ctx);
vm.runInContext(pick('bkstSummary') + ';this.sum=bkstSummary;', ctx);
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ok   ' + name); };
ok('a kept month with 6 missing reads "Aug kept · 6 missing" and no tick', () => {
  const said = ctx.sum();
  assert.strictEqual(said, 'Aug kept · 6 missing');
  assert.ok(!said.includes('✓'));
});
ok('every month kept reads without a missing count', () => {
  ctx.bkstMissing = () => 0;
  assert.strictEqual(ctx.sum(), 'Aug kept · Every month is kept');
});
console.log('\n' + pass + ' passed');
