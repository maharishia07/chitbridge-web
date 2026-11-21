'use strict';
/**
 * walkx-lab-sample-country.test.cjs — WALK-X X-F-01: the network lab's made-up stores carry no India place or rupee.
 * R1 the page names no Erode/Salem/Coimbatore/Chennai and has no INR / rupee literal
 * R2 the sample's money comes from CBSample (the one list), loaded by the page, never a hard-coded currency
 * R3 CBSample for AE and AU carries no India town
 * Run: node tests/walkx-lab-sample-country.test.cjs · static, no browser.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'network-design.html'), 'utf8');
const CBSample = require(path.join(root, 'public', 'app', 'sample-set.js'));
let fail = 0;
const ok = (name, fn) => { try { fn(); console.log('  ok ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n      ' + String(e.message).slice(0, 300)); } };
ok('R1 no India place or rupee in the lab', () => { assert.ok(!/Erode|Salem|Coimbatore|Chennai|CBERODE|CBSALEM|'INR'|₹/i.test(html)); });
ok('R2 money from CBSample, loaded', () => {
  assert.ok(/sample-set\.js/.test(html) && /CBSample\.forCountry/.test(html));
});
ok('R3 AE and AU sample sets hold no India town', () => {
  ['AE', 'AU'].forEach((cc) => assert.ok(!/Coimbatore|Erode|Salem|Chennai|Pooja/i.test(JSON.stringify(CBSample.forCountry(cc))), cc));
});
process.exit(fail ? 1 : 0);
