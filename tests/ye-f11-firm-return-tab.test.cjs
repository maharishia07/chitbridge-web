/* tests/ye-f11-firm-return-tab.test.cjs — YE-F-11 (walk YE 21 Nov): the firm's client view has a tax return tab (BAS), read through the grant read GET /returns.
 * HAND-COMPUTED  Elm Park-like answer: period "FY26 Q1 (Jul–Sep 2025)", due 2025-10-28, stage "Lodged, as you said", boxes G1 (amount 1000000) · 1A (tax 90909) · an empty box, net 365850:
 *                rows = the two boxes with a figure; header tag names the period, the due day and the server's stage; the query asks the period that holds the end of the period shown.
 * OWNS the offline guard of the 'bas' REPORTS entry (public/app/books-grant-reports.js) and the readReturns address (public/app/books-grant-api.js).   CARD 04-network/ACC-176-AUDITOR-GRANT */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = { tx: (s) => s, esc: (s) => String(s == null ? '' : s), shopDay: (d) => 'D' + String(d).slice(0, 10), document: { getElementById: () => null }, location: { search: '' }, Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, URLSearchParams, setTimeout };
root.window = root; root.globalThis = root;
vm.createContext(root);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public/app/books-grant-reports.js'), 'utf8'), root);
const kit = root.CBBooksGrantKit;
kit.words = (s) => s; /* defined by books-grant-cells.js on the page */
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
const bas = kit.REPORTS.filter((r) => r.k === 'bas')[0];
const answer = { currency: 'AUD', period: { label: 'FY26 Q1 (Jul–Sep 2025)', due: '2025-10-28' }, stage: { code: 'declared_lodged', words: 'Lodged, as you said' }, net_minor: 365850, boxes: [{ code: 'G1', amount_minor: 1000000, tax_minor: null }, { code: '1A', amount_minor: null, tax_minor: 90909 }, { code: 'X', amount_minor: null, tax_minor: null }] };
ok('the tab is there and reads GET /returns', () => { assert.ok(bas && bas.ep === 'readReturns'); assert.ok(/readReturns: '\/api\/books\/returns'/.test(fs.readFileSync(path.join(__dirname, '..', 'public/app/books-grant-api.js'), 'utf8'))); });
ok('rows: the boxes that carry a figure, as the server sent them', () => assert.strictEqual(bas.rows(answer).map((b) => b.code).join(), 'G1,1A'));
ok('the header tag: period, due day, the server\'s stage word', () => {
  kit.viewState = { answer, report: 'bas', day: '' };
  const tag = kit.asAt(bas);
  assert.ok(tag.includes('FY26 Q1 (Jul–Sep 2025)') && tag.includes('due D2025-10-28') && tag.includes('Lodged, as you said'), tag);
});
ok('the net is the server\'s own (a fact), never added here', () => assert.strictEqual(JSON.stringify(bas.facts), '[["net_minor","To pay or refund"]]'));
ok('the query asks the period that holds the end of the period shown', () => { kit.viewState = { period: { from: '2025-07-01', to: '2025-09-30' }, day: '', report: 'bas' }; assert.strictEqual(JSON.stringify(kit.queryOf(bas)), '{"on":"2025-09-30"}'); });
console.log('\n' + n + ' checks');
