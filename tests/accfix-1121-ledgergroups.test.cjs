'use strict';
/**
 * tests/accfix-1121-ledgergroups.test.cjs — F-15: the ledger tree takes its groups from the pack the statements use: a liability is never under "Stock & advances",
 * and Wages sits under the P&L's own line ("Employee benefits expense"). Real AU pack (engine/tax.js).
 * OWNS    the F-15 proof        CALLED BY npm test        CARD    books/ledgers-tree
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'public', p), 'utf8');
const ctx = { console, tx: (s) => s, SESSION: { country: 'AU' } };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(read('engine/tax.js'), ctx);
const cut = (src, head, end) => { const i = src.indexOf(head); assert.ok(i >= 0, head); return src.slice(i, src.indexOf(end, i)); };
const h = read('app/helpers.js'), b = read('app/cap-books.js');
vm.runInContext(cut(h, 'function shopReg(', '\n}\n') + '\n}\n', ctx);
vm.runInContext('var BK = {};\n' + cut(b, 'var BK_LT_BANDS', 'BK.lt = ') + cut(b, 'function bkLtBand(', '/** the pack') + cut(b, '/** the pack\'s own groups', 'function bkLtModel(') + cut(b, 'function bkLtModel(', '\n}\n') + '\n}\n', ctx);
const accts = [['1200', 'Inventory on hand'], ['2410', 'Accrued expenses'], ['5100', 'Wages'], ['6020', 'Salaries'], ['6030', 'Electricity, gas and water']].map(([code, name]) => ({ code, name }));
ctx.accts = accts;
const where = (code) => vm.runInContext('(function(){var r=null;bkLtModel(accts).forEach(function(b){b.groups.forEach(function(g){g.accts.forEach(function(a){if(a.code==="' + code + '")r=b.id+"/"+g.title})})});return r})()', ctx);
assert.strictEqual(where('2410'), 'things/What you owe');
assert.strictEqual(where('1200'), 'things/Stock & advances');
assert.strictEqual(where('5100'), 'income/Employee benefits expense');
assert.strictEqual(where('6020'), 'income/Employee benefits expense');
assert.strictEqual(where('6030'), 'income/Operating expenses');
console.log('accfix-1121-ledgergroups: 5 ok');
