'use strict';
/* A-F-36 (Walk A, 21 Nov 2026): the party timeline's change row says "Credit limit: — → A$2,000.00" and "ABN: — → 33…", never "Credit limit minor: — → 200000".
   public/app/cap-crm-record.js crmChangeLine run in node. Run: node tests/crm-change-line.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../public/app/cap-crm-record.js', 'utf8');
const at = src.indexOf('function crmChangeLine'); assert(at > 0);
const cx = vm.createContext({ tx: (s) => s, window: { CRM: { currency: 'AUD' } }, bkMoney: (m, c) => c + ' ' + (m / 100).toFixed(2) });
vm.runInContext(src.slice(at, src.indexOf('function crmEntryFrom', at)), cx);
const word = (t) => String(t).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
assert.strictEqual(cx.crmChangeLine({ field: 'credit_limit_minor', old: null, new: 200000 }, word), 'Credit limit: — → AUD 2000.00');
assert.strictEqual(cx.crmChangeLine({ field: 'tax_id:ABN', old: null, new: '33051775556' }, word), 'ABN: — → 33051775556');
assert.strictEqual(cx.crmChangeLine({ field: 'legal_name', old: 'A', new: 'B' }, word), 'Legal name: A → B');
console.log('  ok  A-F-36: 3 checks');
