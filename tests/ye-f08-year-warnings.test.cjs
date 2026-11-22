/* tests/ye-f08-year-warnings.test.cjs — YE-F-08 (walk YE 21 Nov): Year close shows the api's warnings before "Close the year".
 * HAND-COMPUTED  warnings [{ why: "1 entry has an open query or hold from the auditor" }, { why: "Bank not reconciled to 2026-06-30: Business bank account" }] → two ⚠ lines, the date in words, no fix button; none → none.
 * OWNS the offline guard of peYearWarnLines and its call in peYearChecksHtml (public/app/cap-period.js).   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-period-year.js'), 'utf8').split('\r\n').join('\n');
const pick = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const ctx = { tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), esc: (s) => String(s), bkDate: (d) => d.split('-').reverse().join('/'), monthNames: () => [], peYearFix: () => null };
vm.createContext(ctx);
vm.runInContext(pick('peYearWhy') + pick('peYearWarnLines') + pick('peYearChecksHtml') + ';this.warn=peYearWarnLines;this.checks=peYearChecksHtml;', ctx);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
const warnings = [{ why: '1 entry has an open query or hold from the auditor' }, { why: 'Bank not reconciled to 2026-06-30: Business bank account' }];
ok('both warnings drawn as warn lines, the ISO date in words', () => {
  const html = ctx.warn(warnings);
  assert.ok(html.includes('py-warn-0') && html.includes('py-warn-1') && html.includes('open query or hold from the auditor') && html.includes('30/06/2026'), html);
});
ok('they sit in the checks card, before the closing line', () => {
  const html = ctx.checks({ warnings }, [{ status: 'hard_locked' }], []);
  assert.ok(html.indexOf('py-warn-0') > 0 && html.indexOf('py-warn-0') < html.indexOf('py-rest'), html);
});
ok('no warnings, nothing drawn', () => assert.strictEqual(ctx.warn([]) + ctx.warn(undefined), ''));
console.log('\n' + n + ' checks');
