/**
 * tests/compose-tax-choice-1132.test.cjs — TAXLINE-1132: a line typed in Compose carries a tax choice (public/app/compose-tax-choice.js + app.html ccMintedLine), paired with api PR #1400.
 * HAND      AU A$100.00 typed GST-free: gst_rate 0 + tax_kind gst_free, GST 0.00, total 100.00 (the engine's answer, api services.computeTax) · standard: no tax field (the api stamps 10: GST 10.00, total 110.00) ·
 *           AE zero-rated 0, exempt 0 · IN offers nil / exempt only (no standard rate).
 * Run: node tests/compose-tax-choice-1132.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'public', 'app', 'compose-tax-choice.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'public', 'app.html'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(source, context);
const host = {}; host.window = host; host.self = host; vm.createContext(host);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'engine', 'tax.js'), 'utf8'), host); /* the adopted bundle the page loads: CBTaxPacks */
const packs = host.CBTaxPacks || host.window.CBTaxPacks;
const pack = (country) => packs.packFor(country);
const keys = (country) => context.composeTaxChoices(pack(country)).map((choice) => choice.key).join(',');
let steps = 0;
const step = (label, fn) => { fn(); steps++; console.log('ok - ' + label); };

step('AU offers standard (10%) first, then GST-free and input-taxed', () => assert.equal(keys('AU'), 'standard,zero,exempt'));
step('AE offers standard, zero-rated, exempt', () => assert.equal(keys('AE'), 'standard,zero,exempt'));
step('IN has no standard rate: only nil and exempt', () => assert.equal(keys('IN'), 'zero,exempt'));
step('no pack, no choices', () => assert.deepEqual(context.composeTaxChoices(null), []));
step('AU GST-free typed line: rate 0 WITH the kind gst_free (a zero must say why)', () => assert.deepEqual(context.composeTaxFields(pack('AU'), 'zero'), { gst_rate: 0, tax_kind: 'gst_free' }));
step('standard, or nothing chosen, sends no tax field (the api stamps the standard rate)', () => { assert.deepEqual(context.composeTaxFields(pack('AU'), 'standard'), {}); assert.deepEqual(context.composeTaxFields(pack('AU'), ''), {}); });
step('the minted line carries the choice and the choice is read at Add', () => {
  assert.ok(/\.\.\.ccTaxFieldsOf\(item\)/.test(app), 'ccMintedLine spreads the tax fields');
  assert.ok(/tax_choice: val\('cc_mtax'\)/.test(app), 'ccAddManual stores the choice');
  assert.ok(/<script src="\/app\/compose-tax-choice\.js">/.test(app), 'the module is loaded');
});
step('GST-free typed line posts 0 GST: the api engine on the exact line Compose sends', () => {
  const apiDir = process.env.CB_API_DIR || path.join(ROOT, '..', 'chitbridge-api');
  if (!fs.existsSync(path.join(apiDir, 'lib', 'tax-lines.js'))) { console.log('   (api checkout not beside this repo: engine step skipped here, api PR #1400 test holds it)'); return; }
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'; process.env.NODE_ENV = 'test';
  const TL = require(path.join(apiDir, 'lib', 'tax-lines.js'));
  const seller = { Country: 'AU', LglNm: 'S', RegType: 'regular', Gstin: '51824753556' };
  const fields = context.composeTaxFields(pack('AU'), 'zero');
  const answer = TL.invoiceFor({ lines: [Object.assign({ name: 'Basic food', qty: 1, unit_price: 100 }, fields)], seller, buyer: { Country: 'AU', Gstin: seller.Gstin }, currency: 'AUD', at: '2026-11-27T00:00:00Z' });
  assert.equal(answer.tax_status[0].status, 'ZERO');
  assert.equal(answer.tax_status[0].reason, 'gst_free');
  assert.equal(answer.invoice.ValDtls.TotInvVal, 100);
});
console.log('compose-tax-choice-1132: ' + steps + ' steps');
