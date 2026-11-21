/* tests/acct-c-f06-debit-note-fix.test.cjs — Walk C C-F-06 (21 Nov): a refusal that names the box it lacks has a button that goes to that box.
 * HAND-COMPUTED  The server says needs = supplier_gstin; the box is a step-3 field of the debit note, so the button reads "Add it" and goes to step 3 with focus on the box (not "Change it" back to step 2).
 * OWNS the offline guard of enWords / enFieldStep in public/app/cap-entry-preview.js.   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-entry-preview.js'), 'utf8').split('\r\n').join('\n');
const pick = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const ctx = { tx: (s) => s, enSteps: () => [1, 2, 3, 4], EN: {} };
ctx.enFields = (step) => [{ key: 'supplier', step: 2 }, { key: 'supplier_gstin', step: 3 }].filter((f) => f.step === step);
vm.createContext(ctx);
vm.runInContext(pick('enWords') + pick('enFieldStep') + ';this.words=enWords;', ctx);
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ok   ' + name); };
ok('needs = supplier_gstin: the first refusal says Add it and goes to step 3, focus on the box', () => {
  const out = ctx.words(['The supplier\'s ABN is needed to reverse GST.'], null, null, 'supplier_gstin');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(out[0].fix)), { label: 'Add it', step: 3, focus: 'supplier_gstin' });
});
ok('no needs: Change it, back to the second step, as before', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.words(['x'], null)[0].fix)), { label: 'Change it', step: 2 });
});
ok('a box the event does not have falls back to Change it', () => {
  assert.strictEqual(ctx.words(['x'], null, null, 'nope')[0].fix.label, 'Change it');
});
ok('a locked month still says Pick another date', () => {
  assert.strictEqual(ctx.words(['x'], 'PERIOD_LOCKED', 3, 'supplier_gstin')[0].fix.label, 'Pick another date');
});
console.log('\n' + pass + ' passed');
