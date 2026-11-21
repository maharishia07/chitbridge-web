// Browser-bundle check for the gs1/lots/qty adopt (engines v1.91.0): load the vendored files in public/till.html's own
// script order into a context with NO module/require (what a browser is), then prove lots.weighed('gm') and that a
// (17)YYMM00 expiry reads the month's last day. Pure vm, no server. Run: node e2e/engine-gs1-lots-browser.cjs
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'till.html'), 'utf8');
const order = [...html.matchAll(/<script src="\/engine\/([a-z0-9-]+)\.js"/g)].map((m) => m[1]);
const win = {};
win.window = win; win.self = win;
const ctx = vm.createContext(win);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
for (const n of ['gs1', 'lots', 'units', 'qty']) ok(order.includes(n), 'till.html loads engine/' + n + '.js');
for (const n of order) {
  if (!['gs1', 'lots', 'units', 'qty', 'nums', 'money'].includes(n)) continue;
  vm.runInContext(fs.readFileSync(path.join(root, 'public', 'engine', n + '.js'), 'utf8'), ctx, { filename: n + '.js' });
}
ok(typeof win.CBLots === 'object' && typeof win.CBGS1 === 'object' && typeof win.CBQty === 'object', 'globals CBLots, CBGS1, CBQty exist with no require');
ok(win.CBLots.weighed('gm') === true, "lots.weighed('gm') is weighed in the browser bundle");
ok(win.CBLots.weighed('kg') === true, "lots.weighed('kg') is weighed");
ok(win.CBLots.weighed('plate') === false, "lots.weighed('plate') is counted, not weighed");
const p = win.CBGS1.parseElementString('(01)09506000134352(17)270200(10)B7');
const exp = p && p.expiry;
console.log('parse ->', JSON.stringify(p));
ok(exp === '2027-02-28', '(17)270200 reads the last day of Feb 2027 (2027-02-28), got ' + exp);
const leap = win.CBGS1.parseElementString('(01)09506000134352(17)280200(10)B7');
ok(leap && leap.expiry === '2028-02-29', '(17)280200 reads 2028-02-29 (leap year), got ' + (leap && leap.expiry));
process.exit(fails ? 1 : 0);
