#!/usr/bin/env node
/**
 * offers.test.mjs — CBOffers, proven without a browser.
 *
 * offers.js is deliberately pure — catalogue + lines + context in, a breakdown out, nothing mutated — so it can
 * be tested exactly as the pricing engine it is, with no DOM and no cart. That purity is the point: the same
 * engine has to give the same answer in the cart, on the storefront, in a quote, and again at seal time months
 * later, and a function that touches nothing is the only kind that can promise that.
 *
 * ⚠️ NOT WIRED TO ANY SCREEN YET (Athi: "need not complete now, let us finish cart flow correct"). This proves
 * the arithmetic and the REFUSALS; where it gets called is a later decision. See C:\dev\SPEC-offers-tax.md.
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = createContext({ console });
runInContext(readFileSync(join(ROOT, 'public/app/offers.js'), 'utf8'), ctx, { filename: 'offers.js' });
const CBOffers = ctx.CBOffers;

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (got === undefined ? '' : '  → ' + JSON.stringify(got))); }
};
const money = (n) => '₹' + n;
const LINES = [
  { key: 'a', item_id: 'i1', sku: 'RICE-25', category: 'grain', qty: 4, unitPrice: 100 },   // 400
  { key: 'b', item_id: 'i2', sku: 'DAL-1',   category: 'grain', qty: 2, unitPrice: 150 },   // 300
  { key: 'c', item_id: 'i3', sku: 'OIL-5',   category: 'oil',   qty: 1, unitPrice: 300 }    // 300
];
const run = (offers, extra) => CBOffers.evaluate(Object.assign({ lines: LINES, offers, money }, extra || {}));

console.log('\n1 · the shapes an offer can take');
{
  let r = run([{ id: 'o1', kind: 'percent_off', scope: 'cart', percent: 10, label: '10% off' }]);
  ok('cart % off applies to the whole subtotal', r.total === 900, { subtotal: r.subtotal, total: r.total });

  r = run([{ id: 'o2', kind: 'threshold', min_amount: 500, percent: 5, label: 'spend 500' }]);
  ok('⭐ "discount above a certain amount" fires when the order qualifies', r.total === 950, r.total);

  r = run([{ id: 'o3', kind: 'threshold', min_amount: 5000, percent: 5, label: 'spend 5000' }]);
  ok('…and does NOT fire when it does not', r.total === 1000, r.total);
  ok('⭐ …and says HOW FAR SHORT — the most useful thing a cart can tell you',
     /4000 more needed/.test((r.notes[0] || {}).why || ''), r.notes);

  r = run([{ id: 'o4', kind: 'tier_price', label: 'bulk rice',
             applies_to: { skus: ['RICE-25'] }, tiers: [{ qty: 3, price: 90 }, { qty: 10, price: 80 }] }]);
  ok('a quantity tier RE-PRICES the line (4 × ₹100 → ₹90)', r.total === 960, r.total);
  ok('…and is marked as a re-price, not a discount', r.adjustments[0].basis === 'price', r.adjustments[0]);

  r = run([{ id: 'o5', kind: 'buy_x_get_y', buy: 1, get: 1, label: 'BOGO grain',
             applies_to: { category: 'grain' } }]);
  ok('buy-one-get-one takes whole sets from 6 qualifying units', r.adjustments.length > 0);
  ok('⭐ …and the CHEAPEST units are the free ones — the defensible convention',
     /cheapest units taken/.test(r.adjustments[0].why), r.adjustments[0].why);

  r = run([{ id: 'o6', kind: 'shipping', free: true, label: 'free shipping' }], { shipping: 80 });
  ok('free shipping zeroes the shipping leg, not the goods', r.shipping === 0 && r.subtotal === 1000,
     { shipping: r.shipping, subtotal: r.subtotal });
}

console.log('\n2 · ⚠️ the refusals — never apply what was not earned');
{
  let r = run([{ id: 'x1', kind: 'percent_off', scope: 'cart', percent: 50,
                 valid_from: '2030-01-01', label: 'future' }]);
  ok('an offer that has not started is NOT applied', r.total === 1000, r.total);
  ok('…and says why', /not started/.test((r.skipped[0] || {}).why || ''), r.skipped);

  r = run([{ id: 'x2', kind: 'percent_off', scope: 'cart', percent: 50,
             valid_to: '2020-12-31', label: 'expired' }]);
  ok('an expired offer is NOT applied', r.total === 1000, r.total);

  /* ⚠️ The off-by-one that customers notice: "valid to 31 Oct" must mean the END of the 31st. */
  r = run([{ id: 'x3', kind: 'percent_off', scope: 'cart', percent: 10, valid_to: '2026-10-31', label: 'oct' }],
          { now: '2026-10-31T18:00:00Z' });
  ok('⭐ an end DATE means the END of that day, not 00:00', r.total === 900, r.total);

  r = run([{ id: 'x4', kind: 'percent_off', scope: 'cart', percent: 10, region: 'TN', label: 'TN only' }],
          { region: 'KL' });
  ok('a region-locked offer does not apply elsewhere', r.total === 1000, r.total);

  r = run([{ id: 'x5', kind: 'percent_off', scope: 'cart', percent: 10, label: 'no region declared' }],
          { region: 'KL' });
  ok('⚠️ …but a MISSING region means no restriction, never "fails"', r.total === 900, r.total);

  r = run([{ id: 'x6', kind: 'amount_off', scope: 'cart', amount: 99999, label: 'huge' }]);
  ok('⭐ a flat discount larger than the order does NOT pay the customer', r.total === 0, r.total);
  ok('…and the cap is REPORTED, not silent', /capped/.test(r.adjustments[0].why), r.adjustments[0].why);

  r = run([{ id: 'x7', kind: 'tier_price', applies_to: { skus: ['RICE-25'] },
             tiers: [{ qty: 3, price: 130 }], label: 'bad tier' }]);
  ok('⚠️ a tier that would RAISE the price is refused', r.total === 1000, r.total);

  r = run([{ id: 'x8', kind: 'price_range', min: 200, max: 250,
             applies_to: { skus: ['OIL-5'] }, label: 'oil band' }]);
  ok('⭐ a price outside the seller band produces a VIOLATION, never a clamp',
     r.total === 1000 && r.notes.length === 1, { total: r.total, notes: r.notes.length });
  /* ⚠️ The band is printed through the caller's money() — "₹200–₹250", not "200–250". Asserting the bare digits
     was my mistake, and the formatted version is the correct behaviour: a band stated without its currency is
     exactly the ambiguity this engine exists to remove. */
  ok('…and names the band, in the caller’s currency', /₹200–₹250/.test(r.notes[0].why), r.notes[0].why);

  r = run([{ id: 'x9', kind: 'not_a_real_kind', label: 'nonsense' }]);
  ok('an unknown kind is skipped with a reason, not crashed on',
     r.total === 1000 && /unknown kind/.test(r.skipped[0].why), r.skipped);
}

console.log('\n3 · ⚠️ stacking is EXPLICIT, never array order');
{
  let r = run([
    { id: 's2', kind: 'percent_off', scope: 'cart', percent: 10, priority: 2, label: 'second' },
    { id: 's1', kind: 'amount_off',  scope: 'cart', amount: 100, priority: 1, label: 'first' }
  ]);
  ok('offers run in PRIORITY order, not the order they were listed',
     r.adjustments[0].label === 'first', r.adjustments.map((a) => a.label));

  r = run([
    { id: 'e1', kind: 'percent_off', scope: 'cart', percent: 10, priority: 1, exclusive: true, label: 'only me' },
    { id: 'e2', kind: 'percent_off', scope: 'cart', percent: 10, priority: 2, label: 'blocked' }
  ]);
  ok('⭐ an exclusive offer that fires stops everything after it', r.adjustments.length === 1, r.adjustments.length);
  ok('…and the blocked one says why it did not apply',
     /exclusive/.test((r.skipped[0] || {}).why || ''), r.skipped);
}

console.log('\n4 · ⭐ every price must be defensible six months later');
{
  const r = run([
    { id: 'd1', kind: 'threshold', min_amount: 500, percent: 5, label: 'Spend ₹500' },
    { id: 'd2', kind: 'percent_off', scope: 'cart', percent: 50, valid_to: '2020-01-01', label: 'Diwali 2019' }
  ]);
  ok('the explain trail covers what APPLIED', r.explain.some((e) => /Spend ₹500/.test(e)), r.explain);
  ok('⭐ …and what did NOT, with the reason', r.explain.some((e) => /Diwali 2019 not applied — expired/.test(e)),
     r.explain);
  ok('every adjustment names its offer', r.adjustments.every((a) => a.offer_id && a.why));
}

console.log('\n== RESULT ==  PASS ' + pass + '  ·  FAIL ' + fail);
process.exit(fail ? 1 : 0);
