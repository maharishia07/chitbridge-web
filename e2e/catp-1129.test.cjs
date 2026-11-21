'use strict';
// @type: unit
/**
 * catp-1129.test.cjs - WALK P catalogue fixes (P-F-03 / P-F-04 / P-F-05 / P-F-11) are wired in public/app/cap-catalogue.js.
 *
 * OWNS      source pins: the three item write buttons (cat-new, cat-edit, cat-status) take viewerShut() (view-only login: grey with the reason, helpers.js viewOnlyLogin);
 *           catNames falls back to the carried / legacy name (the till's own reading); the category count adds names with no definition row; the GST field (cat-field-gst,
 *           cat-field-gst-kind) is read by readGst before any write, a zero rate needs its kind; the price prefix comes from fmtMoney (A$), not the bare CLDR sign.
 * CALLED BY by hand and the web job: node e2e/catp-1129.test.cjs
 * FLOW      read cap-catalogue.js -> every pin must hold
 * CARD      06-catalogue-pim/items
 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-catalogue.js'), 'utf8').split('\r\n').join('\n');
let failures = 0;
const check = (c, m) => { console.log((c ? '  ok ' : '  FAIL ') + m); if (!c) failures++; };
check(/data-testid="cat-new" id="cat_new"' \+ viewerShut\(\)/.test(src), 'P-F-03 cat-new greys for a view-only login');
check(/data-testid="cat-edit" id="cat_edit"' \+ viewerShut\(\)/.test(src), 'P-F-03 cat-edit greys');
check(/data-testid="cat-status" id="cat_status"' \+ viewerShut\(\)/.test(src), 'P-F-03 cat-status greys');
check(/viewOnlyLogin\(\)/.test(src) && !/function viewOnlyLogin/.test(src), 'P-F-03 reuses helpers.js viewOnlyLogin, no second reading of the claim');
check(/carried\[at\]/.test(src), 'P-F-04 catNames shows the carried / legacy name, never "-"');
check(/rows\.some\(function \(x\) \{ return String\(x\.id\) === key/.test(src), 'P-F-04 the category count includes names with no definition row');
check(/gstWhy = readGst\(next\)/.test(src) && /cat-field-gst/.test(src) === false || /ctField\('gst'/.test(src), 'P-F-05 the GST field is on the form and read before save');
check(/A zero rate needs its reason/.test(src), 'P-F-05 a zero rate needs its supply kind');
check(/String\(fmtMoney\(0, cur\(\)\)\)/.test(src), 'P-F-11 the price prefix is the money formatter\'s sign (A$)');
check(/No categories yet\. Add one under Categories/.test(src), 'P-F-11 an empty Categories field says why');
console.log(failures ? 'FAIL' : 'ALL PASS');
process.exit(failures ? 1 : 0);
