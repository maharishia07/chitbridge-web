/**
 * reviews5-price-typed.test.cjs — reviews5 EL-06 M3 (21 Nov 2026): the catalogue sheet's price box on the real cap-catalogue.js functions.
 * OWNS      the proof that a typed price goes through the shop's money reader: "1O0" is refused in words (it used to become NaN, serialise to null and
 *           DELETE the price under merge-patch), a minus is refused, "12,50" is 12.50 where the comma is the decimal mark (it used to be 1250), and a
 *           refused box keeps the stored price in the diff.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews5-price-typed.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + why)); if (!ok) fail++; };

/* a reader that behaves like CBUiMoney for a comma-decimal shop (EUR-style marks) */
const reader = {
  refusal: (s) => (/^\d+(,\d+)?$/.test(s) ? '' : 'Type a number.'),
  minor: (s) => Math.round(Number(s.replace(',', '.')) * 100),
  decimals: () => 2
};
let box = { value: '', disabled: false };
const cx = vm.createContext({
  CBUiMoney: reader, T: (s) => s, cur: () => 'EUR', el: () => box,
  cbHasPrice: (v) => v != null, cbAmount: (v) => (v && v.amount != null ? v.amount : v)
});
vm.runInContext(liftFns('public/app/cap-catalogue.js', ['priceFromReader', 'priceTyped', 'readPrice'], '  ') + '\nthis.f = { priceFromReader, priceTyped, readPrice };', cx);
const f = cx.f;

t('"12,50" is 12.50 in a comma-decimal shop (not 1250)', f.priceTyped('12,50').value === 12.5, JSON.stringify(f.priceTyped('12,50')));
t('"1O0" (letter O) is refused in words', !!f.priceTyped('1O0').why && f.priceTyped('1O0').value === undefined);
t('a minus is refused', !!f.priceTyped('-5').why);
const next = { price: { amount: 180, currency: 'EUR' } };
box = { value: '1O0', disabled: false };
f.readPrice(next, { price: { amount: 180, currency: 'EUR' } });
t('a refused box keeps the stored price (a typo never clears it)', next.price && next.price.amount === 180, JSON.stringify(next));
const n2 = { price: 1 };
box = { value: '', disabled: false };
f.readPrice(n2, { price: 1 });
t('an emptied box still removes the price (on purpose)', !('price' in n2));
const n3 = {};
box = { value: '19,90', disabled: false };
f.readPrice(n3, {});
t('a good price goes out as the whole-unit number', n3.price === 19.9, JSON.stringify(n3));
process.exit(fail ? 1 : 0);
