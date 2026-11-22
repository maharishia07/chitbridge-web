'use strict';
/** WALK-X X-F-12: a credit note's detail cell is never "Unpaid / Mark paid"; an invoice's still is. vm over the real functions in app.html. */
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8');
const grab = (name) => { const m = html.match(new RegExp('^function ' + name + '[(][^]*?^}', 'm')); assert.ok(m, name + ' not found'); return m[0]; };
const names = ['chitUnpaidWord', 'chitStatusWord', 'chitNoPayWhy', 'chitMarkPaidButton', 'chitIsNote', 'chitNoteWord', 'chitPaymentCell'];
const sb = { tx: (s) => s, esc: (s) => String(s), payHasUpi: () => false, SESSION: null, CBSheet: { isDead: () => false }, typeof: undefined };
vm.createContext(sb); vm.runInContext(names.map(grab).join('\n') + '\nthis.cell=(l,v)=>l+"|"+v;this.pc=chitPaymentCell;', sb);
let fail = 0; const ok = (n, f) => { try { f(); console.log('  ok ' + n); } catch (e) { fail++; console.log('  FAIL ' + n + '\n      ' + String(e.message).slice(0, 200)); } };
ok('R1 a credit note shows no Unpaid and no Mark paid', () => { const out = sb.pc({ id: 'c1', purpose: 'credit_note', header: { current_status: 'accepted' } }, sb.cell, 126); assert.ok(!/Unpaid|Mark paid/.test(out), out); assert.ok(/Settlement/.test(out)); });
ok('R2 an invoice still shows Unpaid and Mark paid', () => { const out = sb.pc({ id: 'c2', purpose: 'invoice', header: {} }, sb.cell, 126); assert.ok(/Unpaid/.test(out) && /Mark paid/.test(out)); });
process.exit(fail ? 1 : 0);
