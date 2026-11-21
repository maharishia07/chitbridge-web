/* tests/ad-f02-bank-add-ready.test.cjs — Walk AD AD-F-02 (21 Nov): the page's Add button counts the lines READY, not the lines still to go; with none ready it is greyed with a sentence.
 * HAND-COMPUTED  4 lines to go, 0 ready -> greyed "Add to your books" + the sentence (never "Add 4 lines"); 4 to go, 2 ready -> "Add 2 lines to your books", live; 1 ready -> "Add 1 line to your books".
 * OWNS the offline guard of bankPrimaryHtml in public/app/cap-bank.js.   CARD 16-finance/bank-reconciliation */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank.js'), 'utf8').split('\r\n').join('\n');
const fn = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const line = (name) => { const at = text.indexOf('const ' + name + ' ='); return text.slice(at, text.indexOf('\n', at) + 1); };
let ready = 0;
const ctx = {
  tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), txn: (one, many, n) => (n === 1 ? one : many).replace('{count}', n),
  bkbE: (s) => s, BKB: { text: 'csv' }, bkbReadOnly: () => false, bkbMayAct: () => true, bkbSeatNoPrimary: () => '', bankOpeningFacts: () => null, bankSheetOpen: () => {},
  bkbCount: () => 4, bkbReadyCount: () => ready
};
vm.createContext(ctx);
vm.runInContext(fn('bankPrimaryHtml') + fn('bankPrimaryGreyed') + fn('bankAddButton') + ';this.primary=bankPrimaryHtml;', ctx);
let pass = 0;
const ok = (name, f) => { f(); pass++; console.log('  ok   ' + name); };
ok('4 to go, 0 ready: greyed, with the sentence, no "Add 4"', () => {
  ready = 0;
  const html = ctx.primary({ nil: false });
  assert.ok(/disabled/.test(html) && /No line is ready to add yet/.test(html) && !/Add 4/.test(html), html);
});
ok('4 to go, 2 ready: live, "Add 2 lines to your books"', () => {
  ready = 2;
  const html = ctx.primary({ nil: false });
  assert.ok(/Add 2 lines to your books/.test(html) && /onclick="bankAdd\(\)"/.test(html) && !/disabled/.test(html), html);
});
ok('1 ready: "Add 1 line to your books"', () => { ready = 1; assert.ok(/Add 1 line to your books/.test(ctx.primary({ nil: false }))); });
ok('bkbReadyCount reads the controller\'s count when it is there, else the lines to go', () => {
  const c2 = { bkbCount: () => 4, typeof: undefined, bkshCounts: () => ({ ready: 0 }), BKSH: { ctl: {}, key: 'k' }, bkshKey: () => 'k' };
  vm.createContext(c2);
  vm.runInContext(line('bkbReadyCount') + ';this.r=bkbReadyCount;', c2);
  assert.strictEqual(c2.r(), 0);
  c2.BKSH.ctl = null;
  assert.strictEqual(c2.r(), 4);
});
console.log('\n' + pass + ' passed');
