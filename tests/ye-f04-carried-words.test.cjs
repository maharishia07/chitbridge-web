/* tests/ye-f04-carried-words.test.cjs — YE-F-04 (walk YE 21 Nov): the retained-earnings opening is named, never a bare balance.
 * HAND-COMPUTED  roll 1,436,617 minor (A$14,366.17) from 2025-26: "Opening rolled forward from 2025-26 … (computed, not an entry) · A$14366.17 Cr"; a year not closed says so.
 * OWNS the offline guard of bkCarriedWords and its two uses (the drill, the ledger head chip) in public/app/cap-books.js.   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-books.js'), 'utf8').split('\r\n').join('\n');
const pick = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const ctx = { tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), bkMoney: (m) => 'A$' + (m / 100).toFixed(2) };
vm.createContext(ctx);
vm.runInContext(pick('bkDrCr') + pick('bkCarriedWords') + ';this.words=bkCarriedWords;', ctx);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
ok('a closed year: the roll is named computed, with its figure on the credit side', () => {
  assert.strictEqual(ctx.words({ computed: true, from_year: '2025-26', retained_minor: 1436617, year_closed: true }, 'AUD'), 'Opening rolled forward from 2025-26: its profit and the earlier retained earnings (computed, not an entry) · A$14366.17 Cr');
});
ok('a year not closed says so', () => {
  assert.ok(/ · 2025-26 is not closed yet · /.test(ctx.words({ computed: true, from_year: '2025-26', retained_minor: 643636, year_closed: false }, 'AUD')));
});
ok('nothing from the server, nothing drawn', () => assert.strictEqual(ctx.words(null, 'AUD') + ctx.words({}, 'AUD'), ''));
ok('the drill and the ledger head both use it', () => assert.ok(/carriedWords = bkCarriedWords\(ledgerReply\.carried/.test(text) && /tid: 'lg-carried'/.test(text)));
console.log('\n' + n + ' checks');
