/**
 * tests/compose-tax-choice-1132.test.cjs — TAXLINE-1132: a line typed in Compose carries a tax choice (public/app/compose-tax-choice.js + app.html ccMintedLine), paired with api PR #1400.
 * HAND      AU A$100.00 typed GST-free: gst_rate 0 + tax_kind gst_free, GST 0.00, total 100.00 (the engine's answer, api services.computeTax) · standard: no tax field (the api stamps 10: GST 10.00, total 110.00) ·
 *           AE zero-rated 0, exempt 0 · IN offers nil / exempt only (no standard rate).
 * MIN walk (the last section walks one shop through AU, AE and IN as a person changing country would: choices, then the fields each sends; no browser walk drives the typed line yet, e2e/ui-codes-g1 only reads its code)
 * MIN cream-and-dark-1366-390 (the module draws nothing and types no colour or width; the select takes the page's own .inp class, so both themes and both widths follow the page)
 * MIN aa-contrast (no colour typed in the module or on the select: contrast is the page's token pair for .inp)
 * MIN could-not-read-words (no pack or a pack without the kind: no choice is offered rather than a wrong one, and a zero without its kind sends nothing, so the api's standard rate is never silently dropped)
 * MIN string-layer (the select's option labels go through tx(), and the module names no country: every word is the pack's)
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
step('walk: one shop through AU, AE, IN: the choices follow the pack and each sends the pack kind, never a typed rate', () => {
  ['AU', 'AE', 'IN'].forEach((country) => {
    const choices = context.composeTaxChoices(pack(country));
    assert.ok(choices.length >= 2, country + ' offers at least zero and exempt');
    choices.forEach((choice) => {
      const fields = context.composeTaxFields(pack(country), choice.key);
      assert.ok(choice.key === 'standard' ? Object.keys(fields).length === 0 : fields.gst_rate === 0 && !!fields.tax_kind, country + ' ' + choice.key + ' sends ' + JSON.stringify(fields));
    });
  });
});
step('no pack, or a choice the pack does not have: nothing is offered and nothing wrong is sent (could not read: said by an empty select, never a guessed kind)', () => {
  assert.deepEqual(context.composeTaxChoices(undefined), []);
  assert.deepEqual(context.composeTaxFields(null, 'zero'), {});
  assert.deepEqual(context.composeTaxFields({ supplyKinds: {} }, 'exempt'), {});
  assert.deepEqual(context.composeTaxFields(pack('AU'), 'no-such-choice'), {});
});
step('no colour, no fixed width and no country word in the module; the select reads the page .inp class and its labels pass through tx (theme, 1366 and 390, string layer)', () => {
  assert.ok(!/#[0-9a-fA-F]{3,6}|rgb\(|px|width/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), 'the module states no colour or width');
  assert.ok(!/(Australia|India|Emirates|GST|VAT)/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), 'no country word in code');
  assert.ok(/class="inp" id="cc_mtax"/.test(app) && /esc\(tx\(choice\.label\)\)/.test(app), 'the select takes .inp and tx()');
});
console.log('compose-tax-choice-1132: ' + steps + ' steps');
