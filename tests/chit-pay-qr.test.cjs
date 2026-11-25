/**
 * tests/chit-pay-qr.test.cjs — public/app/chit-pay.js: the UPI QR sheet for a walk-in customer, run as the page runs it (the file evaluated with stubbed host globals).
 * CARD 16-finance/payables
 * Run: node tests/chit-pay-qr.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const FILE = path.join(__dirname, '..', 'public', 'app', 'chit-pay.js');
const source = fs.readFileSync(FILE, 'utf8');
let steps = 0;
const step = async (label, fn) => { await fn(); steps++; console.log('ok - ' + label); };

/** a fresh page: the shown sheets are collected, `profile` is what the api answers (an Error = the call could not reach the api) */
function page(profile, qrLibrary) {
  const shown = [], warned = [];
  const context = {
    UI: { _party: null }, SESSION: { name: 'Asha Stores' }, CBMoney: { round: (amount) => amount }, console: { warn: (...parts) => warned.push(parts.join(' ')) },
    tx: (words) => words, esc: (value) => String(value), moneyCode: () => 'INR', inr: (amount) => '₹' + amount,
    modal: (html, flag, opts) => shown.push({ html, opts }), closeModal() {}, document: { getElementById: () => null },
    api: async () => { if (profile instanceof Error) throw profile; return profile; }, qrcode: qrLibrary
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.chitShowQr = chitShowQr; this.upiPayLink = upiPayLink;', context, { filename: FILE });
  return { context, shown, warned };
}
const fakeQr = () => ({ addData() {}, make() {}, createImgTag: () => '<img src="qr">' });

(async () => {
  await step('walk-in customer: the sheet carries the seller UPI id, the amount and a QR image', async () => {
    const view = page({ invoice_party: { upi_id: 'asha@upi' } }, fakeQr);
    await view.context.chitShowQr('abcdef1234567', 250);
    assert.strictEqual(view.shown.length, 1);
    assert.match(view.shown[0].html, /asha@upi/);
    assert.match(view.shown[0].html, /data-testid="chit-upi-qr"/);
    assert.strictEqual(view.shown[0].opts.pop, 'POP204');
  });
  await step('the pay link is exact: payee, shop name, amount, currency and the short chit reference', async () => {
    const view = page({}, fakeQr);
    assert.strictEqual(view.context.upiPayLink('asha@upi', 'abcdef1234567', 250), 'upi://pay?pa=asha%40upi&pn=Asha%20Stores&am=250&cu=INR&tn=CB-abcdef12');
    assert.ok(!/&am=/.test(view.context.upiPayLink('asha@upi', 'x1', 0)), 'no amount, no am parameter');
  });
  await step('could not read the UPI id (the api is not reachable): the sheet says in words that none is on record, and the failure is logged', async () => {
    const view = page(new Error('offline'), fakeQr);
    await view.context.chitShowQr('abcdef1234567', 250);
    assert.match(view.shown[0].html, /No UPI id on record/);
    assert.strictEqual(view.shown[0].opts.pop, 'POP203');
    assert.ok(view.warned.some((line) => /CHIT-PAY-QR-01/.test(line)), 'the receipt is logged');
  });
  await step('QR library missing or failing: the sheet falls back in words (QR library not loaded), never a blank, and a failed draw is logged', async () => {
    const missing = page({ invoice_party: { upi_id: 'asha@upi' } }, undefined);
    await missing.context.chitShowQr('abcdef1234567', 0);
    assert.match(missing.shown[0].html, /QR library not loaded/);
    const broken = page({ invoice_party: { upi_id: 'asha@upi' } }, () => { throw new Error('boom'); });
    await broken.context.chitShowQr('abcdef1234567', 0);
    assert.match(broken.shown[0].html, /QR library not loaded/);
    assert.ok(broken.warned.some((line) => /CHIT-PAY-QR-02/.test(line)));
  });
  await step('theme: the sheet draws only theme tokens, so dark and light at 1366 and 390 stay readable (AA contrast comes from the tokens, no fixed colour)', async () => {
    const sheetText = source.slice(source.indexOf('async function chitShowQr'));
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(sheetText.replace(/&#\d+;/g, '')), 'no hex colour in the QR sheet');
    assert.ok(/var\(--grey\)/.test(sheetText), 'the hint line uses a token');
  });
  console.log('chit-pay-qr: ' + steps + ' steps passed');
})().catch((failure) => { console.error(failure); process.exit(1); });
