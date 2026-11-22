'use strict';
/* tests/bf-direction-1129.test.cjs — walk BF (22 Nov): BF-F-01 one wording of the api's supplier/customer balance for Unpaid bills AND Payables; BF-F-07 an unknown Finance hash is "not found", never Collections.
 * HAND-COMPUTED  AK shop: TB 2100 is a DEBIT of A$1.00 -> the dues api says balance_minor +100 on side=supplier (+ = they owe you) = a SUPPLIER CREDIT, not "owed to suppliers".
 *   -100 on side=supplier = A$1.00 owed to suppliers. Customer side mirrors it: +100 owed to you, -100 a customer credit. 0 says nothing. Fails on the parent (no bkDuesWords, finTab defaults to collect). */
const fs = require('fs'), assert = require('assert'), vm = require('vm');
const read = (f) => fs.readFileSync(__dirname + '/../public/' + f, 'utf8');
let pass = 0;
const ok = (n, f) => { f(); pass++; console.log('  ok   ' + n); };
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); assert(i >= 0, name + ' exists'); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const books = read('app/cap-books.js');
const ctx = { tx: (s) => s, bkMoney: (m) => 'A$' + (m / 100).toFixed(2) };
vm.createContext(ctx); vm.runInContext(grab(books, 'bkDuesWords'), ctx);
const w = (side, n) => ctx.bkDuesWords ? vm.runInContext('bkDuesWords', ctx)(side, n, 'AUD') : '';
ok('supplier +100 (TB 2100 debit) is a supplier credit, never owed to suppliers', () => { assert.strictEqual(w('supplier', 100), 'A$1.00 is a supplier credit (paid ahead) in your books'); });
ok('supplier -100 is owed to suppliers', () => { assert.strictEqual(w('supplier', -100), 'A$1.00 is owed to suppliers in your books'); });
ok('customer +100 is owed to you; -100 is a customer credit', () => { assert.strictEqual(w('customer', 100), 'A$1.00 is owed to you in your books'); assert.strictEqual(w('customer', -100), 'A$1.00 is a customer credit (paid ahead) in your books'); });
ok('zero says nothing', () => assert.strictEqual(w('supplier', 0), ''));
const bills = read('accounts.html'), pay = read('app/cap-finance-pay.js');
ok('Unpaid bills words the api total by its sign (no abs() figure with a fixed direction)', () => { assert(/bkDuesWords\(supplierSide \? 'supplier' : 'customer', owed\.total_minor/.test(bills)); assert(!/is owed to suppliers in your books'\) : tx\('is owed to you/.test(bills)); });
ok('Payables reads the same api balance and the same words', () => { assert(/FP\.books = reply \? Number\(reply\.total_minor\)/.test(pay)); assert(/bkDuesWords\('supplier', FP\.books, FP\.cur\)/.test(pay)); });
// BF-F-07: finTab
const terms = read('app/cap-finance-terms.js');
const tab = (hash) => { const c = { location: { hash }, FIN_TABS: null }; vm.createContext(c); vm.runInContext(terms.slice(terms.indexOf('var FIN_TABS'), terms.indexOf('function ftNav')), c); return vm.runInContext('finTab()', c); };
ok('no hash and #/collections are Collections', () => { assert.strictEqual(tab(''), 'collect'); assert.strictEqual(tab('#/collections'), 'collect'); });
ok('a real hash still opens its tab', () => { assert.strictEqual(tab('#/payables'), 'pay'); assert.strictEqual(tab('#terms'), 'terms'); });
ok('a wrong hash (#/pay) is unknown, not Collections', () => assert.strictEqual(tab('#/pay'), 'unknown'));
const tabs = read('app/cap-finance-tabs.js');
ok('the unknown tab mounts the library empty state with a way back to Finance', () => { assert(/unknown: function \(\) \{ return finUnknownMount\(\)/.test(tabs)); assert(/emptyState\(/.test(tabs) && /Open Finance/.test(tabs)); });
console.log('\n' + pass + ' passed');
