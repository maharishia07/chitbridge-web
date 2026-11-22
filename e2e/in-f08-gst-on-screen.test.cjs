/**
 * e2e/in-f08-gst-on-screen.test.cjs — IN-F-08 (walk IN 21 Nov): the owner reads this month's GST by head on the Returns screen, with the set-off preview (read only).
 * Hand figures (the walk's shop P, Nov 2026): tax on sales CGST 228.81 + SGST 228.81 + IGST 0.00; credit from purchases IGST 898.20.
 * Set-off (CGST Act s.49(5): IGST credit against IGST, then CGST, then SGST): IGST 898.20 pays CGST 228.81 and SGST 228.81; to pay 0.00 on every head; IGST credit kept 898.20 - 457.62 = 440.58.
 * The month list starts with the RUNNING month (today 21 Nov 2026 -> 2026-11 first, then 2026-10 ... 2025-12).
 * Run: node e2e/in-f08-gst-on-screen.test.cjs   (no browser, no server: the page's own functions in a vm)
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-finance-returns.js'), 'utf8');
let n = 0;
const ok = (what, cond) => { assert.ok(cond, what); n++; };

const calls = [];
const box = { innerHTML: '' };
const reply = {
  sup_details: { osup_det: { txval: 2542.38, iamt: 0, camt: 228.81, samt: 228.81, csamt: 0 } },
  itc_elg: { itc_net: { iamt: 898.2, camt: 0, samt: 0, csamt: 0 } },
  _cb: { setoff: { utilised: [{ from: 'igst', against: 'cgst', amount: 228.81 }, { from: 'igst', against: 'sgst', amount: 228.81 }], payable: { cgst: 0, sgst: 0, igst: 0 }, carried: { cgst: 0, sgst: 0, igst: 440.58 }, pay_total: 0 } }
};
let answer = reply;
const ctx = {
  esc: (v) => String(v), tx: (v) => v, txf: (v, o) => v.replace(/\{(\w+)\}/g, (m, k) => o[k]),
  fmtMoney: (v) => '₹' + Number(v).toFixed(2), bkToday: () => '2026-11-21', monthNames: () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  api: async (name, o) => { calls.push([name, o]); if (answer instanceof Error) throw answer; return answer; },
  document: { getElementById: (id) => (id === 'fr_view' ? box : id === 'fr_month' ? { value: '2026-11' } : null) },
  String, Number, Array, Object
};
vm.createContext(ctx);
vm.runInContext(SRC + '\nthis.__f = { frViewHTML, frShow, frMonths };', ctx);
const F = ctx.__f;

const months = F.frMonths();
ok('twelve months, the running one first', months.length === 12 && months[0].v === '2026-11' && /running/.test(months[0].label));
ok('...and the last is Dec 2025', months[11].v === '2025-12');

const html = F.frViewHTML(reply);
const row = (head) => (new RegExp('data-testid="fr-view-' + head + '">([\\s\\S]*?)</tr>').exec(html) || ['', ''])[1].replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
eq(row('cgst'), '|CGST|₹228.81|₹0.00|₹0.00|₹0.00|', 'CGST: sales 228.81, credit 0, to pay 0, kept 0');
eq(row('sgst'), '|SGST|₹228.81|₹0.00|₹0.00|₹0.00|', 'SGST row');
eq(row('igst'), '|IGST|₹0.00|₹898.20|₹0.00|₹440.58|', 'IGST: sales 0, credit 898.20, to pay 0, kept 440.58');
ok('the set-off is said per head: IGST credit set against CGST 228.81 and SGST 228.81', /IGST credit ₹228\.81 set against CGST/.test(html) && /IGST credit ₹228\.81 set against SGST/.test(html));
ok('the page says it posts nothing and the close opens after the month ends', /Nothing is posted/.test(html) && /GST close opens when the month has ended/.test(html));
ok('no set-off from the server: said, no table', /could not be worked out/.test(F.frViewHTML({ sup_details: {}, _cb: {} })) && !/fr-view-table/.test(F.frViewHTML({ _cb: {} })));

(async () => {
  await F.frShow();
  ok('frShow asks the one door: taxGstr, the month chosen, form gstr3b', calls.length === 1 && calls[0][0] === 'taxGstr' && calls[0][1].query.month === '2026-11' && calls[0][1].query.form === 'gstr3b');
  ok('...and paints the table', /fr-view-table/.test(box.innerHTML));
  answer = Object.assign(new Error('boom'), { status: 422 });
  await F.frShow();
  ok('a refusal says "Could not read this month." and never the error text', /Could not read this month/.test(box.innerHTML) && !/boom/.test(box.innerHTML));
  console.log('in-f08-gst-on-screen: ' + n + ' checks');
})();

function eq(got, want, what) { assert.strictEqual(got, want, what + ' - got ' + got); n++; }
