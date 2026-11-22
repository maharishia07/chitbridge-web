'use strict';
/* WALK I I-F-04 (21 Nov 2026): the AE pack's invoice lines include the supplier's ADDRESS (ER Art. 59(1)(b) / 59(2)(b)); a shop that charges VAT with no address is told at the
   till before the slip prints without it (billWarnHTML 'address', the fix opens the shop's details). The words come from the pack (taxId word = TRN), not a typed country.
   Run: node tests/walki-slip-address.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const win = {}; const cx = vm.createContext(win); cx.window = cx; cx.self = cx;
for (const f of ['engine/money.js', 'engine/tax.js', 'engine/country.js']) { try { vm.runInContext(fs.readFileSync(__dirname + '/../public/' + f, 'utf8'), cx); } catch (e) { /* engine file absent in this kit */ } }
const C = cx.CBCountries;
ok(C && typeof C.meta === 'function', 'CBCountries.meta is loaded');
const meta = C.meta('AE');
ok(meta.invoice && meta.invoice.requiredLines.indexOf('address') >= 0, 'AE pack: the invoice requires the supplier address');
ok(meta.words.taxId === 'TRN', 'AE pack word for the tax id is TRN');
const till = fs.readFileSync(__dirname + '/../public/till.html', 'utf8');
ok(/function addressWarnWords\(\)/.test(till) && /billWarnLine\('address', aw, 'Add it'\)/.test(till), 'the till warns on the bill when the address is missing');
ok(/if \(which === 'address'\) \{ shopEditOpen\(\); return; \}/.test(till), 'the warning\'s button opens the shop details');
console.log(n + ' passed');
