'use strict';
// @type: unit
/**
 * rw1acc-1130.test.cjs - re-walk 1 (25 Nov 2026) RW1-07: ONE rounding rule for every carried percent (basis points), and RW1-10 BAS wording.
 * Hand figures: Sales 116,550.00 of income 137,355.00 = 84.853% = 8485 bp: shown 84.9% (a float toFixed read 84.8); 4066 bp = 40.7%; 1515 bp = 15.2%; -8485 bp = -84.9%; 4 bp = 0.0% with no sign.
 * CALLED BY by hand: node e2e/rw1acc-1130.test.cjs
 * CARD      14-accounting/README
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const PUB = path.join(__dirname, '..', 'public');
const read = (file) => fs.readFileSync(path.join(PUB, file), 'utf8');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const cx = vm.createContext({
  console, tx: (t) => t, CBAction: { run: () => Promise.resolve() }, setTimeout, clearTimeout, SESSION: 'AUD',
  esc: (t) => String(t == null ? '' : t),
  localStorage: { getItem: () => null, setItem() {} }, navigator: { language: 'en-AU' },
  document: { documentElement: { setAttribute() {}, style: {} }, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null }
});
cx.window = cx; cx.self = cx;
for (const f of ['engine/money.js', 'engine/locale.js', 'app/ui.js', 'app/ui-field.js', 'app/ui-money.js']) vm.runInContext(read(f), cx);
const pct = (bp, signed) => vm.runInContext('CBUiMoney.pct', cx)(bp, signed);
check(pct(8485) === '84.9%', '8485 bp is 84.9% (not 84.8)');
check(pct(1515) === '15.2%' && pct(4066) === '40.7%', '1515 bp 15.2%, 4066 bp 40.7%');
check(pct(8485, true) === '+84.9%' && pct(-8485, true) === '-84.9%' && pct(-8485) === '-84.9%', 'signed and negative');
check(pct(4, true) === '0.0%' && pct(-4, true) === '0.0%' && pct(0) === '0.0%', 'rounds to zero: no sign');
check(pct(10000) === '100.0%' && pct(5) === '0.1%' && pct(NaN) === '', 'edges: 100.0%, half a bp up, not a number is empty');
/* the three painters call the one rule: no float toFixed(1) of basis points is left in them */
const books = read('app/cap-books.js'), cells = read('app/books-grant-cells.js');
check(/function bkPct[\s\S]{0,260}CBUiMoney\.pct/.test(books), 'bkPct calls CBUiMoney.pct');
check(/function pctCell[\s\S]{0,260}CBUiMoney\.pct/.test(cells), 'the grant view pctCell calls CBUiMoney.pct');
check(!/\/ 100\)\.toFixed\(1\)/.test(books + cells), 'no (bp / 100).toFixed(1) is left');
/* RW1-10: the BAS close card stays in view at 1366x768 (sticky foot), and the month rows get their overdue word from the server */
const period = read('app/cap-period.js'), css = read('app/accounts-page.css');
check(/class="pe-card pe-sticky-foot" data-testid="pr-close-card"/.test(period), 'the Close and pay card carries the sticky-foot class');
check(/\.pe-card\.pe-sticky-foot\{position:sticky;bottom:0/.test(css), 'the sticky foot is one CSS rule');
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
process.exit(failures ? 1 : 0);
