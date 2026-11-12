'use strict';
// @type: unit
/**
 * supply-use-idem.test.cjs: api #1178 accepts an Idempotency-Key on POST /api/supplies/:id/issue, so the web `supplyUse` door sends ONE key per attempt
 * (EP row idem:'attempt', the FIN-63 helper in core.js; no new helper). Fails on main (the row has no idem).
 * CARD 16-finance/payments · owns: the supplyUse row · called by: ci.yml
 * Run: node e2e/supply-use-idem.test.cjs
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const row = /supplyUse:\s*(\{[^}]*\})/.exec(html);
assert(row, 'supplyUse row not found in app.html');
assert(/idem:\s*'attempt'/.test(row[1]), 'supplyUse must send idem:\'attempt\': ' + row[1]);

const core = fs.readFileSync(path.join(root, 'app', 'core.js'), 'utf8');
const i = core.indexOf('/* the Idempotency-Key of a write');
const j = core.indexOf('async function apiOnce(');
let n = 0;
const box = { console, JSON, Date, cblog: () => {}, CB: { _uuid: () => 'k' + ++n } };
vm.createContext(box);
vm.runInContext(core.slice(i, j) + '\nthis.cbIdemKey = cbIdemKey; this.attemptOf = attemptOf;', box);
const ep = vm.runInNewContext('(' + row[1] + ')');
const key = () => box.cbIdemKey(ep, false, box.CB, 'rid', box.attemptOf('supplyUse', { id: 's1' }, { qty: 2 }));
const k1 = key();
assert(k1 && k1 === key(), 'a retried issue of the same quantity must carry the SAME key');
console.log('  ok  supplyUse sends one key per attempt');
