/**
 * tests/inbooks-1128-web.test.cjs - WALK M (batch 1128, web side): M-F-03 Returns greys "file" for a view-only login with the reason; M-F-05 a Waiting row carries its own "Try again";
 * M-F-06 the Returns month list opens at the running month of the SHOP's day; OPS001 Stock says the shared 429 sentence; the 429 sentence is in every shipped language pack.
 * OWNS  the proof of helpers.js viewOnlyLogin · cap-finance-returns.js (grey, months) · cap-books-waiting-cells.js bkWaitRetryButton · cap-stock.js error() · strings-*.js. No browser.
 * Run: node tests/inbooks-1128-web.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '');
const token = (level) => 'h.' + b64({ access_level: level }) + '.s';

/* viewOnlyLogin: the viewer is shut, the owner (level owner) and an entity session are not */
const helpers = read('public/app/helpers.js');
const cut = (name) => { const at = helpers.indexOf('function ' + name); assert(at >= 0, name); let depth = 0, i = helpers.indexOf('{', at); const start = at; for (; i < helpers.length; i++) { if (helpers[i] === '{') depth++; if (helpers[i] === '}' && --depth === 0) break; } return helpers.slice(start, i + 1); };
const ctx = { atob: (t) => Buffer.from(t, 'base64').toString(), tx: (s) => s, SESSION: {} };
vm.createContext(ctx);
vm.runInContext(read('public/app/role-names.js'), ctx); /* UX-224: the refusal sentence is CBRoles' one */
vm.runInContext(cut('jwtPayload') + cut('viewOnlyLogin') + cut('viewOnlyMoneyWhy'), ctx);
const as = (role, level) => { ctx.SESSION = { role, token: token(level) }; return vm.runInContext('viewOnlyLogin()', ctx); };
assert.strictEqual(as('user', 'viewer'), true, 'a viewer login is view-only');
assert.strictEqual(as('user', 'owner'), false, 'the owner is not');
assert.strictEqual(as('entity', 'viewer'), false, 'an entity session is not');
assert(/Your seat cannot read the books. Ask the owner./.test(vm.runInContext('viewOnlyMoneyWhy()', ctx)), 'the reason is the one refusal: the seat cannot read the books, ask the owner (CBRoles, UX-224)');
assert(read('public/accounts.html').includes('return viewOnlyLogin();') && !/=== 'viewer'/.test(read('public/accounts.html').split('const viewOnlySeat')[1].slice(0, 400)), 'Accounts uses the one reading, no second copy');

/* Returns: grey + reason for a view-only login; the month list from the shop's day */
const returns = read('public/app/cap-finance-returns.js');
assert(/shut = viewOnlyLogin\(\) \? viewOnlyMoneyWhy\(\)/.test(returns) && returns.includes('aria-disabled="true" data-ready="no" disabled title="'), 'the file buttons are greyed with the reason');
assert((returns.match(/' \+ shutAttrs \+ '/g) || []).length === 2 && returns.includes('data-testid="fr-shut-why"'), 'both buttons and the sentence');
assert(returns.includes('if (!shut) frShow();'), 'a view-only login does not ask for the refused figures');
const ctx2 = { bkToday: () => '2026-11-21', monthNames: () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], tx: (s) => s };
vm.createContext(ctx2); vm.runInContext(returns.slice(returns.indexOf('function frMonths'), returns.indexOf('function frCard')), ctx2);
const months = JSON.parse(JSON.stringify(vm.runInContext('frMonths()', ctx2)));
assert.deepStrictEqual([months[0].v, months[1].v, months.length], ['2026-11', '2026-10', 12], 'M-F-06: the picker opens at Nov 2026, the running month');
assert(/running/.test(months[0].label), 'and says it is running');

/* Waiting: the row's own Try again, the same retry */
const cells = read('public/app/cap-books-waiting-cells.js');
assert(cells.includes("bkWaitingRetry(this)") && cells.includes('data-testid="wait-retry-'), 'a row has its own Try again');
assert(/async function bkWaitingRetry\(button(, forward)?\)/.test(read('public/app/cap-books-waiting-view.js')), 'it calls the one retry (booksRetry)'); /* AM-F-05: a locked-month row's press also takes `forward` */

/* Stock + the 429 sentence in the shared place and every pack */
assert(read('public/app/cap-stock.js').includes('CBShell.busySentence(S.err.retryAfter)'), 'Stock says the shared 429 sentence');
for (const lang of ['ar', 'fr', 'hi', 'ta']) {
  const pack = read('public/app/strings-' + lang + '.js');
  assert(pack.includes("'Too many requests — try again in {n} s.':") && pack.includes("'Too many requests — try again in a moment.':"), lang + ' carries the 429 sentence');
}
console.log('inbooks-1128-web: all checks passed');
