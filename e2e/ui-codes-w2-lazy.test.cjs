'use strict';
// @type: unit
/**
 * ui-codes-w2-lazy.test.cjs - UX-137 wave 2 (18 Nov): the script-built controls of fourteen lazy scripts wear their identity codes.
 *
 * OWNS      the proof that each script below carries at least its count of data-cbsid codes (a removed code fails), that every literal code is a live,
 *           not retired row of the register UIID_REG names (a missing row fails), and that the worklist helpers (wlBtn, wlInput) stamp through wlStamp.
 * CALLED BY by hand and the QA gate: node e2e/ui-codes-w2-lazy.test.cjs   (UIID_REG=<docs SCREENS.json> makes a missing row fail; without it the rows are printed as pending)
 * FLOW      read each script, count its data-cbsid literals, look each up in the register
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 */
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public', 'app');
const COUNTS = { 'cap-testing': 143, 'cap-catsetup': 54, 'cap-register': 44, 'cap-workforce': 53, 'cap-worklist': 24, 'cap-definitions': 29, 'cap-readiness': 21, 'cap-supplies': 20, 'cap-flag': 14, 'cap-bank': 14, 'cap-bank-details': 2, 'cap-network-member': 11, 'cap-mark-sheet': 9, 'cap-traceability': 8, 'bank-preview-ui-parts': 28 };
const regPath = [process.env.UIID_REG, path.join(__dirname, '..', '..', 'chitbridge-docs', 'SCREENS.json'), 'C:/dev/SCREENS.json'].filter(Boolean).filter((p) => fs.existsSync(p))[0];
const reg = regPath ? JSON.parse(fs.readFileSync(regPath, 'utf8')).screens : {};
const live = {}, retired = {};
Object.keys(reg).forEach((k) => { (reg[k].retired ? retired : live)[reg[k].code] = 1; });
let fails = 0, pending = 0;
const ok = (c, m) => { if (c) console.log('  ok ' + m); else { fails++; console.log('  FAIL ' + m); } };
Object.keys(COUNTS).forEach((f) => {
  const src = fs.readFileSync(path.join(PUB, f + '.js'), 'utf8');
  const codes = [...src.matchAll(/data-cbsid=\\?["']([A-Z]{3}[0-9]{3}(?:-[A-Z][0-9]{2})?)\\?["']/g)].map((m) => m[1]);
  ok(codes.length >= COUNTS[f], f + '.js carries ' + codes.length + ' codes (at least ' + COUNTS[f] + ')');
  codes.forEach((c) => {
    if (retired[c] && !live[c]) ok(false, f + ' ' + c + ' is retired in the register');
    else if (!live[c]) { if (process.env.UIID_REG) ok(false, f + ' ' + c + ' has no live row'); else pending++; }
  });
});
const wl = fs.readFileSync(path.join(PUB, 'cap-worklist.js'), 'utf8');
ok(/function wlBtn\(label, testid, call, primary, stampCode\)/.test(wl) && (wl.match(/wlStamp\(/g) || []).length >= 4, 'cap-worklist.js builders stamp through wlStamp');
ok((wl.match(/stamp: 'RAL002-I\d\d'/g) || []).length === 6, 'cap-worklist.js: six wlInput call sites pass a code');
if (pending) console.log('  pending: ' + pending + ' codes not in the register yet (the docs PR lands the rows)');
console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
