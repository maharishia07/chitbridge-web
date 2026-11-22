// UNIT      29/Arabic / RTL + bill sheet
/**
 * bg-1129.test.cjs — static checks for walk BG (UAE screens, sit-ae2): the Arabic pack carries the words the bill sheet,
 * the bill tabs, the menu and the VAT return page said in English (BG-F-09); the closed drawer sits off-screen on its OWN side in RTL (BG-F-10);
 * the 390 balance row wraps (BG-F-01); the Period label is not emptied at 390 (BG-F-02); a credit note / goods receipt is not told "No issued figures" (BG-F-06).
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'public');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); if (!c) fail++; };

const ar = rd('app/strings-ar.js');
['VAT return', 'Tax period', 'Monthly', 'VAT summary', 'Rate', 'Taxable', 'Content', 'Summary', 'Messages', 'Record a sale', 'Platform', 'Match', 'Refund', 'Show the difference']
  .forEach((k) => ok(ar.includes("'" + k + "':"), 'strings-ar.js has "' + k + '"'));

const app = rd('app.html');
ok(/:root\[dir=rtl\] \.appwrap\.m \.menu\{transform:translateX\(100%\)\}/.test(app), 'RTL: the closed drawer slides out to the right, not onto the bill');
ok(app.includes("tx(l.slice(0, at)) + l.slice(at)") && /dtabLabel\(/.test(app), 'the bill tabs say their name through tx (dtabLabel: the word translated, the count kept)'); /* fold1129 71f2f201 */
ok(app.includes("c.kind === 'receipt'") && app.includes("c.kind === 'credit_note'"), 'a credit note / goods receipt has its own money line, not the red "No issued figures"');
ok(app.includes("${c.amt ? chitMoney(c.amt, c) : '—'}"), 'the bill header says — for no total, never AED 0.00');

ok(/@media \(max-width:760px\)\{\.bk-bal-quick\{display:flex;flex-wrap:wrap/.test(rd('app/accounts-page.css')), 'the 390 balance row wraps inside the band');
const per = rd('app/cap-period.js');
ok(per.includes('item.label.replace(/' + String.fromCharCode(92) + 's*' + String.fromCharCode(92) + '([^)]*' + String.fromCharCode(92) + ')/'), 'the narrow Period label drops only a bracket, never the whole name');
console.log('\n' + (fail ? fail + ' failed' : 'all passed'));
process.exit(fail ? 1 : 0);
