/* tests/ye-f05-no-reopen-by-year.test.cjs — YE-F-05 (walk YE 21 Nov): no "Reopen month" on a month the year close locked (it opens with the year).
 * HAND-COMPUTED  hard-locked month, last one, server says reopen { may:false, by_year:true } → no button; a month hard-locked alone and last → the button stays.
 * OWNS the offline guard of bkLockRule.byYear and bkLockButtonsHTML in public/app/cap-books-lock.js.   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-books-lock.js'), 'utf8').split('\r\n').join('\n');
const pick = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const ctx = { tx: (s) => s, esc: (s) => String(s), bkMountAttribute: () => '', bkLockWhyWords: () => '', bkLockWho: () => ({}) };
vm.createContext(ctx);
vm.runInContext(pick('bkLockRule') + pick('bkLockByYear') + pick('bkLockBlocked') + pick('bkLockHardButton') + pick('bkLockButtonsHTML') + ';this.rule=bkLockRule;this.btn=bkLockButtonsHTML;', ctx);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
ok('a year-closed month: no Reopen month button', () => {
  const rule = ctx.rule({ reopen: { may: false, by_year: true } }, 'hard_locked'); rule.lastHard = true;
  assert.strictEqual(rule.byYear, true); assert.strictEqual(ctx.btn(true, 'hard_locked', 6, rule), '');
});
ok('a month hard-locked alone and last keeps its button', () => {
  const rule = ctx.rule({ reopen: { may: false } }, 'hard_locked'); rule.lastHard = true;
  assert.ok(/lk-reopen-month-6/.test(ctx.btn(true, 'hard_locked', 6, rule)));
});
ok('a month that is not the last hard-locked one: none either', () => {
  const rule = ctx.rule({ reopen: { may: false } }, 'hard_locked'); rule.lastHard = false;
  assert.strictEqual(ctx.btn(true, 'hard_locked', 5, rule), '');
});
console.log('\n' + n + ' checks');
