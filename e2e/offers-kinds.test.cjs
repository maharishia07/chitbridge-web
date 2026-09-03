'use strict';
/**
 * offers-kinds.test.cjs — EVERY KIND IN THE REGISTRY, on a real basket, with the rules the FORM writes.
 *
 * Athi, 2026-09-03: *"check offer effectively for each type of offers"*.
 *
 * ⚠️⚠️ WHY THIS IS NOT COVERED BY THE TWO FILES BESIDE IT. offers-promise tests promise() and offers-combined
 * tests stacking, and both were written by reading offers.js — so both fed it the keys offers.js reads. The
 * FORM writes different keys. `promise()` read `min_subtotal`; cap-definitions writes `min_amount`; the promise
 * test passed `min_subtotal` and went green, while every threshold offer a person actually authored advertised
 * nothing at all on any product row. A test that supplies the implementation's own vocabulary can only prove
 * the implementation is self-consistent.
 *
 * ⭐ SO THE RULE HERE IS: the rules in this file are the rules cbDefRuleFields() can produce, and every kind is
 * asserted three ways — the MONEY it moves, the WHY it gives for moving it, and the PROMISE it makes on a row
 * before anything is in a basket. A kind that cannot pass all three cannot be sold with.
 *
 * ⚠️ THE FIRST GUARD IS A COUNT. Adding a KIND to offers.js without a case here is the failure this file exists
 * to catch — a kind nobody exercises looks fine, because a kind that never fires looks like a kind nobody used.
 *
 * Run: node e2e/offers-kinds.test.cjs
 */
const assert = require('assert');
const { CBOffers: O } = require('../public/app/offers.js');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); fail++; }
};
const sec = (s) => console.log('\n' + s);

const NOW = new Date('2026-09-03T00:00:00Z');
const money = (n) => '₹' + n;
const CTX = { now: NOW, money };

/* One basket, used by every kind: 3 × ₹100 rice (Grains) and 2 × ₹250 oil. */
const RICE = { key: '0', item_id: 'rice', sku: 'R1', categories: ['grains'], qty: 3, unitPrice: 100 };
const OIL = { key: '1', item_id: 'oil', sku: 'O1', categories: ['edible'], qty: 2, unitPrice: 250 };
const BASKET = [RICE, OIL];                                     /* subtotal 300 + 500 = 800 */

const ev = (offers, lines, extra) => O.evaluate(Object.assign(
  { lines: lines || BASKET, offers: [].concat(offers), now: NOW, money }, extra || {}));
const only = (r) => { assert.strictEqual(r.adjustments.length, 1, 'one adjustment, got ' + r.adjustments.length
  + ' · ' + JSON.stringify(r.explain)); return r.adjustments[0]; };
const kept = new Set();
const kind = (k, name, fn) => { kept.add(k); t(name, fn); };

sec('offers · every kind, with the rules the FORM writes');

kind('percent_off', '⭐ percent_off — off each line it targets, and the badge says the plain thing', () => {
  const o = { id: 'p', kind: 'percent_off', label: 'Diwali 10%', percent: 10, applies_to: { category: 'grains' } };
  const a = only(ev(o));
  assert.strictEqual(a.amount, -30, '10% of the ₹300 rice line');
  assert.strictEqual(a.target, '0', 'and it lands on that line, not the order');
  assert.strictEqual(a.why, '10% off ₹300');
  assert.strictEqual(O.promise(o, CTX), '10% off');
  assert.strictEqual(ev(o).total, 770);
});

kind('amount_off', '⭐ amount_off — a flat sum, capped at the line, and the cap is REPORTED', () => {
  const o = { id: 'a', kind: 'amount_off', label: '₹50 off', amount: 50, applies_to: { item_ids: ['rice'] } };
  assert.strictEqual(only(ev(o)).amount, -50);
  assert.strictEqual(only(ev(o)).why, '₹50 off');
  assert.strictEqual(O.promise(o, CTX), '₹50 off');
  /* ⚠️ ₹500 off a ₹300 line must not pay the customer ₹200 — and must SAY it was trimmed, or the number
     cannot be reconciled against the offer that was advertised. */
  const big = only(ev(Object.assign({}, o, { amount: 500 })));
  assert.strictEqual(big.amount, -300);
  assert.ok(/capped at the line/.test(big.why), big.why);
});

kind('tier_price', '⭐⭐ tier_price — a RE-PRICE, and the badge carries the quantity or it is a lie', () => {
  const o = { id: 't', kind: 'tier_price', label: 'Bulk rice',
              tiers: [{ qty: 3, price: 80 }, { qty: 10, price: 70 }], applies_to: { item_ids: ['rice'] } };
  const a = only(ev(o));
  assert.strictEqual(a.amount, -60, '3 × (100 − 80)');
  assert.strictEqual(a.basis, 'price', 'marked a re-price, not a discount — it is the price of record');
  assert.strictEqual(a.why, 'qty 3 reaches the 3+ tier · ₹100 → ₹80 each');
  assert.strictEqual(O.promise(o, CTX), '₹80 each from 3 (2 price breaks)');
  /* ⚠️ NEVER SILENTLY RAISES. A tier dearer than the list price is not applied. */
  assert.strictEqual(ev(Object.assign({}, o, { tiers: [{ qty: 1, price: 500 }] })).adjustments.length, 0);
});

kind('threshold', '⭐⭐ threshold — spend, and the shortfall is reported when it does not fire', () => {
  const o = { id: 'th', kind: 'threshold', label: 'Over ₹500', percent: 10, min_amount: 500 };
  const a = only(ev(o));
  assert.strictEqual(a.amount, -80, '10% of the whole ₹800 order');
  assert.strictEqual(a.scope, 'cart', 'an order benefit belongs to the order, never to one line');
  assert.strictEqual(a.why, '10% off — order of ₹800 meets the ₹500 threshold');
  assert.strictEqual(O.promise(o, CTX), '10% off orders over ₹500');
  const short = ev(Object.assign({}, o, { min_amount: 1000 }));
  assert.strictEqual(short.adjustments.length, 0);
  assert.strictEqual(short.notes[0].why, 'not yet — ₹200 more needed');
  assert.strictEqual(short.notes[0].shortfall, 200, 'the number, not only the sentence');
});

kind('buy_x_get_y', '⭐ buy_x_get_y — the cheapest qualifying units are the free ones', () => {
  const o = { id: 'b', kind: 'buy_x_get_y', label: 'BOGO rice', buy: 2, get: 1,
              applies_to: { item_ids: ['rice'] } };
  const a = only(ev(o));
  assert.strictEqual(a.amount, -100, 'qty 3 = one set of (2+1), one unit free');
  assert.strictEqual(a.why, '1 × free — buy 2 get 1 (1 set, cheapest units taken)');
  assert.strictEqual(O.promise(o, CTX), 'Buy 2 get 1 free');
  /* ⭐ A DIFFERENT PRODUCT AS THE REWARD, which the same-item form cannot say. */
  const cross = { id: 'x', kind: 'buy_x_get_y', label: 'Rice → oil', buy: 3, get: 1,
                  get_item_id: 'oil', get_item_name: 'Sunflower Oil', applies_to: { item_ids: ['rice'] } };
  assert.strictEqual(only(ev(cross)).amount, -250, 'one oil they are holding goes free');
  assert.strictEqual(O.promise(cross, CTX), 'Buy 3 get 1 Sunflower Oil free');
});

kind('shipping', '⭐ shipping — free, flat or a percentage, and it never promises on a product row', () => {
  const free = { id: 's', kind: 'shipping', label: 'Free delivery', free: true };
  const r = ev(free, BASKET, { shipping: 80 });
  assert.strictEqual(only(r).amount, -80);
  assert.strictEqual(only(r).why, 'free shipping');
  assert.strictEqual(r.shipping, 0, 'and the order carries no delivery charge');
  assert.strictEqual(ev({ id: 's2', kind: 'shipping', label: 'Half', percent: 50 }, BASKET,
    { shipping: 80 }).adjustments[0].amount, -40);
  assert.strictEqual(only(ev({ id: 's3', kind: 'shipping', label: 'Flat ₹30', flat: 30 }, BASKET,
    { shipping: 80 })).why, 'flat shipping at ₹30');
  /* ⚠️ One line cannot deliver an order-level benefit, so a row stays silent about it. */
  assert.strictEqual(O.promise(free, CTX), null);
});

kind('price_range', '⭐ price_range — a CONSTRAINT: it reports a violation and moves no money', () => {
  const o = { id: 'r', kind: 'price_range', label: 'Rice band', min: 120, max: 200,
              applies_to: { item_ids: ['rice'] } };
  const r = ev(o);
  assert.strictEqual(r.adjustments.length, 0, 'a band never clamps a negotiated price');
  assert.strictEqual(r.notes[0].why, '₹100 is outside the seller’s band ₹120–₹200');
  assert.strictEqual(r.total, 800, 'and the order is unchanged');
  assert.strictEqual(ev(Object.assign({}, o, { min: 50 })).notes.length, 0, 'inside the band, nothing to say');
  assert.strictEqual(O.promise(o, CTX), null, 'a band is the price, not a discount off one');
});

t('⚠️ EVERY KIND IN THE REGISTRY IS EXERCISED ABOVE', () => {
  const missing = O.kinds.filter((k) => !kept.has(k));
  assert.deepStrictEqual(missing, [], 'kinds with no case in this file: ' + missing.join(', '));
});

sec('offers · what the form writes vs what the engine reads');

/**
 * ⚠️⚠️ THESE ARE THE MISMATCHES THAT WERE LIVE. Each one is written with the keys cbDefRuleFields() produces,
 * because that is the only vocabulary an authored offer ever has.
 */
t('⚠️⚠️ A THRESHOLD AUTHORED ON THE FORM ADVERTISES ITSELF — promise() read a key nothing writes', () => {
  /* The form's fields are `min_amount` and `min_qty`. promise() read `min_subtotal`, so it returned null,
     forLine() dropped the offer, and the product row said the product was on no offer. */
  assert.strictEqual(O.promise({ kind: 'threshold', percent: 5, min_amount: 5000 }, CTX),
    '5% off orders over ₹5000');
  assert.strictEqual(O.promise({ kind: 'threshold', amount: 200, min_qty: 10 }, CTX),
    '₹200 off orders of 10+ items');
  assert.strictEqual(O.promise({ kind: 'threshold', percent: 5, min_subtotal: 5000 }, CTX),
    '5% off orders over ₹5000', 'the old key still reads, so nothing authored before this stops working');
});

t('⚠️⚠️ A QUANTITY THRESHOLD COUNTS ITEMS — it used to measure the SPEND against the item count', () => {
  const o = { id: 'q', kind: 'threshold', label: '5 items', percent: 10, min_qty: 5 };
  assert.strictEqual(only(ev(o)).why, '10% off — order of 5 items meets the 5-item threshold');
  /* The form offers "Spend at least" and "…or this many items" side by side, so both get filled. The old code
     took the SPEND figure and compared it to the COUNT: "197 more item(s) needed" on a ₹300 basket. */
  const both = { id: 'qb', kind: 'threshold', label: 'Either', percent: 10, min_amount: 500, min_qty: 20 };
  assert.strictEqual(only(ev(both)).why, '10% off — order of ₹800 meets the ₹500 threshold');
  const neither = ev(Object.assign({}, both, { min_amount: 2000 }));
  assert.strictEqual(neither.notes[0].why, 'not yet — ₹1200 more needed (or 15 more item(s) needed)',
    'and when neither is met, BOTH ways to close the gap are named — the form said "or"');
});

t('⚠️⚠️ A SHIPPING OFFER WITH NO TERM SAYS SO — it used to evaluate to silence', () => {
  /* The form's only shipping field is "% off shipping (blank = free)". Blank produced an offer with no free,
     no flat and no percent: it returned an empty list and was indistinguishable from one nobody triggered. */
  const r = ev({ id: 's0', kind: 'shipping', label: 'Delivery' }, BASKET, { shipping: 80 });
  assert.strictEqual(r.adjustments.length, 0);
  assert.strictEqual(r.notes.length, 1);
  assert.ok(/no shipping term stated/.test(r.notes[0].why), r.notes[0].why);
});

t('⚠️ A THRESHOLD WITH NO MINIMUM IS UNFINISHED, not "always on"', () => {
  const r = ev({ id: 'x', kind: 'threshold', label: 'Half done', percent: 10 });
  assert.strictEqual(r.adjustments.length, 0, 'it must not fire on every basket');
  assert.ok(/unfinished/.test(r.notes[0].why), r.notes[0].why);
});

sec('offers · two offers on ONE product');

const P10 = { id: 'p10', kind: 'percent_off', label: '10% off rice', percent: 10,
              applies_to: { item_ids: ['rice'] }, priority: 1 };
const A25 = { id: 'a25', kind: 'amount_off', label: '₹25 off rice', amount: 25,
              applies_to: { item_ids: ['rice'] }, priority: 2 };

t('⭐⭐ PERCENT + AMOUNT ON ONE PRODUCT BOTH LAND, and they accumulate', () => {
  const r = ev([P10, A25], [RICE]);
  assert.strictEqual(r.adjustments.length, 2, 'both fired');
  assert.strictEqual(r.goods_adjustment, -55, '30 + 25');
  assert.strictEqual(r.total, 245);
  /* ⭐ AND EACH SAYS WHY — the answer to "why ₹245 and not ₹300" six months later. */
  assert.deepStrictEqual(r.explain, ['10% off rice: 10% off ₹300', '₹25 off rice: ₹25 off']);
});

t('⚠️⚠️ TWO DISCOUNTS ON ONE LINE NEVER EXCEED THE LINE', () => {
  const a = { id: 'a', kind: 'percent_off', label: '60%', percent: 60, applies_to: { item_ids: ['rice'] }, priority: 1 };
  const b = { id: 'b', kind: 'percent_off', label: '60% again', percent: 60, applies_to: { item_ids: ['rice'] }, priority: 2 };
  const lines = [RICE];
  const r = ev([a, b], lines);
  assert.strictEqual(r.total, 0, 'the order is clamped at zero — a negative total is not a refund');
  /* ⚠️ THE CAP IS PER LINE, and evaluate() only clamps the ORDER. perLine() is where a caller gets the capped
     figure, and it exists because four call sites were each one `Math.min` away from a −20% line. */
  const per = O.perLine(r, lines);
  assert.strictEqual(per['0'].off, 300, 'never more than the line was worth');
  assert.strictEqual(per['0'].capped, true, 'and the caller is TOLD it was trimmed');
  assert.deepStrictEqual(per['0'].offers, ['a', 'b'], 'both offers are named on the line');
});

t('⚠️ AN EXCLUSIVE OFFER FIRST STOPS THE ONE AFTER IT', () => {
  const excl = Object.assign({}, P10, { exclusive: true, priority: 1 });
  const r = ev([excl, A25], [RICE]);
  assert.strictEqual(r.adjustments.length, 1);
  assert.strictEqual(r.total, 270, 'only the 10%');
  assert.strictEqual(r.skipped[0].label, '₹25 off rice');
  assert.strictEqual(r.skipped[0].why, 'an exclusive offer already applied');
});

t('⭐⭐ THE SAME TWO OFFERS, THE EXCLUSIVE ONE SECOND — priority decides, not the array', () => {
  const excl = Object.assign({}, P10, { exclusive: true, priority: 9 });
  const r = ev([excl, A25], [RICE]);
  assert.strictEqual(r.adjustments.length, 2, 'the ₹25 ran first, then the exclusive one');
  assert.strictEqual(r.total, 245, 'the same price as the non-exclusive pair');
  assert.strictEqual(r.skipped.length, 0, 'nothing was left to stop');
  /* ⚠️ AND THE ARRAY ORDER IS NOT THE ANSWER — the reversed array gives the same price. */
  assert.strictEqual(ev([A25, excl], [RICE]).total, 245);
});

t('⚠️ AN OFFER THAT TARGETS ANOTHER PRODUCT IS SKIPPED, and says which', () => {
  const other = { id: 'o', kind: 'percent_off', label: 'Oil 10%', percent: 10, applies_to: { item_ids: ['oil'] } };
  const r = ev([P10, other], [RICE]);
  assert.strictEqual(r.adjustments.length, 1);
  assert.strictEqual(r.skipped[0].why, 'no line qualifies');
});

t('⚠️ A CLOSED WINDOW SKIPS, and the reason names the date', () => {
  const r = ev([P10, Object.assign({}, A25, { valid_to: '2026-08-01' })], [RICE]);
  assert.strictEqual(r.total, 270);
  assert.strictEqual(r.skipped[0].why, 'expired (2026-08-01)');
  const early = ev([Object.assign({}, P10, { valid_from: '2026-12-01' })], [RICE]);
  assert.strictEqual(early.skipped[0].why, 'not started (from 2026-12-01)');
  assert.strictEqual(O.promise(Object.assign({}, P10, { valid_from: '2026-12-01' }), CTX), null,
    'and a row promises nothing it cannot honour today');
});

console.log('\n' + (fail ? '✗ ' + fail + ' failed, ' : '✓ ') + pass + ' passed\n');
process.exit(fail ? 1 : 0);
