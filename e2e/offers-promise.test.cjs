'use strict';
/**
 * offers-promise.test.cjs — what a ROW may advertise, before anything is in a cart.
 *
 * Athi, 2026-09-02: *"discount and offers need to be expressed i guess, otherwise people may not know"* and
 * *"in b2b, that is the way, the products are being pushed."*
 *
 * ⚠️⚠️ THE LOAD-BEARING TESTS HERE ARE THE ONES ABOUT NOT PROMISING. A badge is a commitment: a row that says
 * "10% off" while the basket declines to give it is worse than a row that said nothing at all — the first is a
 * broken promise, the second is merely quiet. So most of this file asserts silence.
 *
 * Run: node e2e/offers-promise.test.cjs
 */
const assert = require('assert');
const { CBOffers: O } = require('../public/app/offers.js');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); fail++; }
};

const NOW = new Date('2026-09-03T00:00:00Z');
const CTX = { now: NOW, money: (n) => '₹' + n };

console.log('\noffers · the promise states its condition');

t('a plain percentage needs no condition', () => {
  assert.strictEqual(O.promise({ kind: 'percent_off', percent: 10 }, CTX), '10% off');
});

t('⭐⭐ A QUANTITY BREAK CARRIES ITS THRESHOLD — "₹170 each" alone would be a lie', () => {
  /* The row shows ₹180. A badge reading "₹170 each" would be read as the price for one. */
  const p = O.promise({ kind: 'tier_price', tiers: [{ qty: 10, price: 170 }, { qty: 50, price: 160 }] }, CTX);
  assert.ok(/from 10/.test(p), 'the quantity that unlocks it must be in the sentence: ' + p);
  assert.ok(/170/.test(p));
});

t('⭐ an order threshold says what the order must reach', () => {
  const p = O.promise({ kind: 'threshold', min_subtotal: 5000, percent: 5 }, CTX);
  assert.ok(/5% off/.test(p) && /5000/.test(p), p);
});

t('buy-x-get-y reads the way a shopper says it', () => {
  assert.strictEqual(O.promise({ kind: 'buy_x_get_y', buy: 2, get: 1 }, CTX), 'Buy 2 get 1 free');
});

console.log('\noffers · when a row must stay silent');

t('⚠️ an EXPIRED offer promises nothing', () => {
  assert.strictEqual(O.promise({ kind: 'percent_off', percent: 10, valid_to: '2026-08-01' }, CTX), null);
});

t('⚠️ an offer that has NOT STARTED promises nothing', () => {
  assert.strictEqual(O.promise({ kind: 'percent_off', percent: 10, valid_from: '2027-01-01' }, CTX), null);
});

t('⚠️ an offer for another region promises nothing here', () => {
  const ctx = Object.assign({ region: 'IN' }, CTX);
  assert.strictEqual(O.promise({ kind: 'percent_off', percent: 10, region: 'AE' }, ctx), null);
});

t('⚠️ FREE SHIPPING IS NOT A PRODUCT PROMISE — one line cannot deliver an order-level benefit', () => {
  assert.strictEqual(O.promise({ kind: 'shipping', amount: 0 }, CTX), null);
});

t('a percentage of nothing is not an offer', () => {
  assert.strictEqual(O.promise({ kind: 'percent_off', percent: 0 }, CTX), null);
  assert.strictEqual(O.promise({ kind: 'amount_off', amount: 0 }, CTX), null);
});

t('the validity gate is the SAME one evaluate uses', () => {
  /* Two copies of "is this live?" is how a badge and a basket disagree on one screen. If evaluate skips it,
     promise must be silent about it. */
  const o = { id: 'x', kind: 'percent_off', percent: 10, valid_to: '2026-08-01', label: 'Old' };
  const ev = O.evaluate({ lines: [{ key: '0', item_id: 'a', qty: 1, unitPrice: 100 }], offers: [o],
    now: NOW, money: CTX.money });
  assert.strictEqual(ev.adjustments.length, 0, 'the basket refuses it');
  assert.strictEqual(O.promise(o, CTX), null, 'so the row must not advertise it');
});

console.log('\noffers · which rows may advertise which offer');

const OFFERS = [
  { id: 'o1', kind: 'percent_off', percent: 10, applies_to: { category: 'grains' } },
  { id: 'o2', kind: 'tier_price', tiers: [{ qty: 10, price: 170 }] },
];

t('a targeted offer reaches the rows it names', () => {
  const got = O.forLine({ item_id: 'a', categories: ['grains'], unitPrice: 180 }, OFFERS, CTX);
  assert.deepStrictEqual(got.map((x) => x.offer_id).sort(), ['o1', 'o2']);
});

t('⚠️⚠️ AN UNCLASSIFIED PRODUCT DOES NOT INHERIT A TARGETED OFFER — it fails CLOSED', () => {
  /* An offer aimed at Grains must never fall back to "applies to everything" on a product nobody classified.
     That would be a discount nobody agreed to, appearing on the storefront. */
  const got = O.forLine({ item_id: 'b', unitPrice: 180 }, OFFERS, CTX);
  assert.deepStrictEqual(got.map((x) => x.offer_id), ['o2']);
});

t('a row in another category gets only the untargeted offer', () => {
  const got = O.forLine({ item_id: 'c', categories: ['spices'], unitPrice: 180 }, OFFERS, CTX);
  assert.deepStrictEqual(got.map((x) => x.offer_id), ['o2']);
});

t('onOffer agrees with forLine, because it IS forLine', () => {
  assert.strictEqual(O.onOffer({ item_id: 'a', categories: ['grains'], unitPrice: 180 }, OFFERS, CTX), true);
  assert.strictEqual(O.onOffer({ item_id: 'z', unitPrice: 180 }, [OFFERS[0]], CTX), false);
});

t('an expired offer puts no badge on any row', () => {
  const dead = [{ id: 'd', kind: 'percent_off', percent: 25, valid_to: '2026-01-01' }];
  assert.deepStrictEqual(O.forLine({ item_id: 'a', unitPrice: 100 }, dead, CTX), []);
});

console.log('\n' + (fail ? '✗ ' + fail + ' failed, ' : '✓ ') + pass + ' passed\n');
process.exit(fail ? 1 : 0);
