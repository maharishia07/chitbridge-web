/* e2e/entry-preview-ref.test.cjs — the + Entry sheet's ONE client_ref rides the preview as well as the save (f09, 21 Nov live walk)
 * OWNS      the proof that enBody (public/app/cap-entry-preview.js) carries EN.ref for EVERY kind, debit_note and credit_note included, and that the save adds no second one
 * CALLED BY node e2e/entry-preview-ref.test.cjs (offline, no browser)
 * FLOW      load cap-entry-preview.js in a sandbox → build the body for each kind → read client_ref; read cap-entry.js enSaveWrite → it takes the body as enBody gave it
 * CARD      16-finance/cb-finance
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public/app', f), 'utf8');
let failures = 0;
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failures++; };
const sb = { EN: { ev: null, v: {}, lines: [], items: [], ref: 'web-test-ref-1' }, bkMoneyMinor: (x) => Math.round(Number(x) * 100), enItemsBody: () => [{ name: 'x', qty: 2, unit_price: 55, gst_rate: 10 }], console };
vm.createContext(sb);
vm.runInContext(read('cap-entry-preview.js') + '\nthis.enBody = enBody;', sb);
['expense', 'debit_note', 'credit_note', 'contra', 'journal'].forEach((kind) => {
  sb.EN.ev = { kind }; sb.EN.v = { supplier: 'p1', amount: '10' }; sb.EN.items = kind.endsWith('_note') ? [1] : [];
  const b = sb.enBody();
  check(b.client_ref === 'web-test-ref-1', kind + ': the preview body carries the sheet\'s client_ref (' + b.client_ref + ')');
});
const save = read('cap-entry.js').split('\r\n').join('\n').match(/async function enSaveWrite[\s\S]*?\n}\n/);
check(save && /enBody\(\)/.test(save[0]) && !/client_ref\s*=\s*EN\.ref/.test(save[0]), 'the save takes the body as enBody built it (one client_ref, one place)');
process.exit(failures ? 1 : 0);
