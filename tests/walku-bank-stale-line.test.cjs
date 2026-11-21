/* tests/walku-bank-stale-line.test.cjs — WALK U U-F-03 (AU): the Bank page's sign-off line reads the api's own words.
 * Hand figures (cents): signed Nov at books 500000, then a reversal lifts the books to 501250. The api now says stale + books_now_minor 501250;
 * the line must NOT say "nothing unexplained" then, and must say the books have changed with the figure now. A clean sign-off still says "nothing unexplained".
 * Runs the real bkstBalanceHtml from cap-bank-statements.js in a vm with a stub page. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank-statements.js'), 'utf8');
const row = (extra) => Object.assign({ account_id: 'a1', currency: 'AUD', period_to: '2026-11-30', statement_minor: 498750, books_signed_minor: 500000, unexplained_minor: 0, tied: true }, extra);
function render(signed) {
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v[k]);
  const data = { currency: 'AUD', accounts: [{ account_id: 'a1', name: 'Bank' }], signed_as_at: { accounts: [signed] } };
  const ctx = { tx: (s) => s, txf: fill, bkMoney: (m) => 'A$' + (m / 100).toFixed(2), bkstE: (s) => s, console };
  ctx.window = { addEventListener() {} }; ctx.document = { addEventListener() {} };
  ctx.__data = data;
  vm.createContext(ctx);
  vm.runInContext(src + '\nBKST.data = this.__data; this.__html = bkstBalanceHtml();', ctx, { filename: 'cap-bank-statements.js' });
  return ctx.__html;
}
let pass = 0;
const ok = (m) => { pass++; console.log('  ok  ' + m); };
let h = render(row());
assert.ok(/nothing unexplained/.test(h) && !/changed/.test(h), String(h)); ok('a clean sign-off still says nothing unexplained');
h = render(row({ tied: false, stale: true, moved_minor: 1250, books_now_minor: 501250 }));
assert.ok(!/nothing unexplained/.test(h) && /the books have changed since: now A\$5012\.50/.test(h), h); ok('after a reversal: no "nothing unexplained", says the books changed, now A$5012.50');
h = render(row({ unexplained_minor: 1250, tied: false }));
assert.ok(/unexplained A\$12\.50/.test(h) && !/nothing unexplained/.test(h), h); ok('an unexplained remainder reads as before');
console.log(pass + ' ok');
