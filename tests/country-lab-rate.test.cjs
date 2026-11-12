'use strict';
/**
 * tests/country-lab-rate.test.cjs - CTRY-69 (web half): the Country Lab hands the engine a line's slab rate only to a pack that has NO supply kinds (India:
 * the HSN slab is the rate). Under a pack WITH supply kinds (AU, AE) a line that names no kind is handed NO rate, so the engine marks it unrated (held),
 * never taxes it at a rate the page's picker happened to carry. Runs billUnder() out of public/country-lab.html in a vm over the real engines.
 * Run: node tests/country-lab-rate.test.cjs
 */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0;
const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const root = __dirname + '/../public/';
const html = fs.readFileSync(root + 'country-lab.html', 'utf8');
const start = html.indexOf('function billUnder(p) {'), end = html.indexOf('function billHTML(', start);
assert(start > 0 && end > start, 'billUnder is in country-lab.html');
const sb = { console }; sb.window = sb; sb.globalThis = sb;
const cx = vm.createContext(sb);
['engine/money.js', 'engine/tax.js'].forEach((f) => vm.runInContext(fs.readFileSync(root + f, 'utf8'), cx));
vm.runInContext(html.slice(start, end), cx);
const bill = (country, item) => {
  sb.LAB = { buyer: 'home', incl: false, lines: [Object.assign({ name: 'Tea', qty: 1, price: 100, rate: 5, kind: '' }, item)] };
  return vm.runInContext('billUnder(CBRegulation.packFor(' + JSON.stringify(country) + '))', cx);
};
const itemOf = (r) => r.inv.ItemList[0];

sb.LAB = null;
const au = bill('AU', {});
ok(!au.refused, 'AU, no kind: the engine answers (' + (au.refused || 'ok') + ')');
ok(itemOf(au).TaxAmt === 0 || itemOf(au)._unrated === true, 'AU, no kind, a slab rate of 5 in the row: NOT taxed at 5 (tax ' + itemOf(au).TaxAmt + ')');
ok(itemOf(au)._unrated === true, 'AU, no kind: the line is marked unrated (held), as the engine does for a line that gave no rate');
const auKind = bill('AU', { kind: 'taxable' });
ok(!auKind.refused && itemOf(auKind).TaxAmt === 10, 'AU, kind taxable: the kind\'s own rate (10% of 100) - the kind still works (tax ' + (auKind.inv && itemOf(auKind).TaxAmt) + ')');
const india = bill('IN', {});
ok(!india.refused && itemOf(india).CgstAmt + itemOf(india).SgstAmt === 5 && !itemOf(india)._unrated, 'IN (no supply kinds): the slab rate still reaches the engine (5 on 100)');
console.log(n + ' checks');
