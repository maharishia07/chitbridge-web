/* tests/bank-map-card.test.cjs: FIN-115 — a bank file whose headings the reader does not know must offer the column map on the Bank screen
 * (the same card bank-demo uses), and reading with the person's mapping must produce the lines. Real engine, real cap-bank.js, stub DOM. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const P = path.join(__dirname, '..', 'public') + '/';
const out = { innerHTML: '' }, nodes = { bk_out: out, bk_res: { innerHTML: '' } };
const ctx = { console, setTimeout, tx: (s) => s, txf: (s) => s, peBad: (id, why) => { nodes[id].innerHTML = '<bad>' + why + '</bad>'; }, toast() {}, bkQuiet() {}, bkCur: () => 'AUD', SESSION: { country: 'AU', currency: 'AUD' } };
ctx.window = ctx; ctx.self = ctx;
ctx.document = { querySelector: () => null, body: { classList: { toggle() {}, add() {}, remove() {} } }, getElementById: (id) => nodes[id] || null, querySelectorAll: (q) => (q === 'select[data-map]' ? (ctx.__selects || []) : []), addEventListener() {} };
ctx.esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
vm.createContext(ctx);
for (const f of ['engine/tax.js', 'engine/bank-files.js', 'engine/bank-json.js', 'engine/bank-recon.js', 'app/bank-demo-ask.js', 'app/cap-bank.js', 'app/cap-bank-map.js']) {
  vm.runInContext(fs.readFileSync(P + f, 'utf8'), ctx, { filename: f });
}
const text = 'When,Memo,Out,In\n20/11/2026,COLES 12,50.00,\n19/11/2026,SALARY ACME,,200.00\n';
(async () => {
  ctx.bkbHash = async () => 'abcdef0123456789abcdef'; ctx.bankCurrencyRun = async () => { ctx.__ran = true; };
  vm.runInContext('bkbHash = async () => "abcdef0123456789abcdef"; bankCurrencyRun = async () => { globalThis.__ran = true; }; BKB.acct = "B-1";', ctx);
  await vm.runInContext('bankTake', ctx)(text, 'x.csv', false);
  assert.ok(/data-cbsid="BKS017-M01"/.test(out.innerHTML), 'an unknown heading offers the column map: ' + out.innerHTML.slice(0, 200));
  console.log('  ok  unknown headings offer the column map');
  ctx.__selects = [['date', 'When'], ['narration', 'Memo'], ['debit', 'Out'], ['credit', 'In']].map(([k, v]) => ({ value: v, getAttribute: () => k }));
  await vm.runInContext('bankMapRead', ctx)();
  const parsed = vm.runInContext('BKB.parsed', ctx);
  assert.ok(parsed && parsed.lines.length === 2 && parsed.lines.map((l) => l.debit_minor).join() === "0,5000" && parsed.lines.map((l) => l.credit_minor).join() === "20000,0", 'the mapped file reads both lines');
  assert.strictEqual(vm.runInContext('BKB.mapping', ctx), undefined, 'the mapping is not kept for the next file');
  console.log('  ok  the mapped file reads: 2 lines, 5000 out + 20000 in');
  /* the banks the backlog named (engines v1.99.0, adopted): Westpac Narrative, NAB Transaction Details, headerless CommBank, read with their descriptions */
  const read = (t) => ctx.CBBankRecon.parse(t, { format: 'auto', country: 'AU' });
  const westpac = read(['Bank Account,Date,Narrative,Debit Amount,Credit Amount,Balance', '123,20/11/2026,WOOLWORTHS 1234,50.00,,950.00', ''].join('\n'));
  const nab = read(['Date,Amount,Account Number,Transaction Type,Transaction Details,Balance', '20 Nov 26,-50.00,1,DEBIT,CAFE X,950.00', ''].join('\n'));
  const cba = read(['20/11/2026,"-50.00","COLES 12 SYDNEY",+950.00', '19/11/2026,"+200.00","SALARY ACME",+1000.00', ''].join('\n'));
  assert.deepStrictEqual([westpac.lines[0].narration, nab.lines[0].narration, cba.lines.map((l) => l.narration).join('|')], ['WOOLWORTHS 1234', 'CAFE X', 'SALARY ACME|COLES 12 SYDNEY']);
  assert.ok(westpac.lines[0].debit_minor === 5000 && nab.lines[0].debit_minor === 5000 && cba.lines[1].debit_minor === 5000 && cba.lines[0].credit_minor === 20000, 'amounts: 50.00 out = 5000, 200.00 in = 20000');
  console.log('  ok  Westpac, NAB and headerless CommBank files read with their descriptions');
})().catch((e) => { console.error(e); process.exit(1); });
