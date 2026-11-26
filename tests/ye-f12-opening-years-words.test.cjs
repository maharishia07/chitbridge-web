/* tests/ye-f12-opening-years-words.test.cjs — YE-F-12 (walk YE 21 Nov): the opening-balances year strip names its figures for what they are.
 * HAND-COMPUTED  2025-26: opening 3200000, carried out (debit side) 4819552 (the closing balance sheet's total is 4780280: GST paid is not netted, so the word "closing" was wrong);
 *                2026-27 is running: it shows its opening only (RW3-23: a so-far carry ties to nothing), and "matches what last year carried out" (not "closing balance sheet").
 * OWNS the offline guard of obYearsHtml (public/app/cap-opening-years.js).   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-opening-years.js'), 'utf8').split('\r\n').join('\n');
const at = text.indexOf('function yearLine('); /* yearLine (the line under a year) is lifted out beside obYearsHtml */
const strip = text.indexOf('function obYearsHtml(');
const ctx = { tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), esc: (s) => String(s), bkMoney: (m) => 'A$' + (m / 100).toFixed(2), OPENING: { years: { currency: 'AUD', years: [
  { fiscal_year: '2025-26', opening_minor: 3200000, closing_minor: 4819552, next: '2026-27', next_opening_minor: 4819552, matches: true, apart_minor: 0 },
  { fiscal_year: '2026-27', opening_minor: 4819552, closing_minor: 6380944, next: null } ] } } };
vm.createContext(ctx);
vm.runInContext(text.slice(at, text.indexOf('\n}\n', strip) + 2) + ';this.html=obYearsHtml();', ctx);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
ok('an ended year says carried out (debit side), never closing', () => { assert.ok(ctx.html.includes('opening A$32000.00 · carried out (debit side) A$48195.52')); assert.ok(!/\bclosing\b/.test(ctx.html)); });
ok('the running year shows no carry figure (RW3-23: nothing beside it to tie to)', () => { assert.ok(!ctx.html.includes('so far')); assert.ok(!ctx.html.includes('A$63809.44')); assert.ok(ctx.html.includes('2026-27</b> · opening A$48195.52')); });
ok('the match line names what was compared', () => assert.ok(ctx.html.includes('matches what last year carried out')));
console.log('\n' + n + ' checks');
