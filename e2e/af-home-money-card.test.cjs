'use strict';
// @type: unit
/**
 * af-home-money-card.test.cjs - AF-F-03 (walk AF-C13): Home showed "To pay A$410.00" to a seat the books refuse. The api now answers that seat's Finance card with may.ok false + the books' sentence;
 * the tile paints the sentence only (greyed, no figure, no "Set up" invite). Any other answer is not touched.
 * OWNS      the proof for CBShellFacts.noMoneyHTML (app/shell-facts.js)
 * CALLED BY by hand: node e2e/af-home-money-card.test.cjs
 * FLOW      load shell-facts.js in a vm, hand noMoneyHTML a refused answer and a normal one
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/shell
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const box = { console, esc: (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), document: {} };
box.window = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'shell-facts.js'), 'utf8'), box);
box.CBShellFacts.painters({ state: {}, setUp: 'Set up' }, (t) => t);
const say = "Only the owner, the shop's accountant or bookkeeper, or the shop's auditor may read these figures.";
const html = box.CBShellFacts.noMoneyHTML({ lines: [{ text: say }], figures: {}, state: 'not_started', may: { ok: false, why: 'books_money', say } });
check(/shell-no-money/.test(html) && html.indexOf('Only the owner') >= 0, 'a refused seat: the tile is the books\' sentence');
check(!/\d/.test(html.replace(/ (data-testid|style)="[^"]*"/g, '')) && !/Set up/.test(html), 'no figure and no "Set up" invite on it');
check(box.CBShellFacts.noMoneyHTML({ lines: [{ text: 'To pay {money}' }], state: 'in_use' }) === '' && box.CBShellFacts.noMoneyHTML(null) === '', 'any other answer is left to the normal painter');
console.log(failures ? failures + ' failed' : 'all passed');
process.exit(failures ? 1 : 0);
