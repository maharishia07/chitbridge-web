'use strict';
/* WALK I I-F-02 (P1 money, 21 Nov 2026): the Sell form's "Record a sale" preview must equal what is saved and what the till bills.
   An AE shop's price of AED 100 includes 5% VAT: hand figures in fils: 10000 gross, VAT 10000*5/105 = 476.19 -> 476, net 9524, total 10000
   (the saved chit: total_value 100, AssVal 95.24, TaxVal 4.76). The preview showed 100.00 + 5.00 = 105.00 because the cart never passed the
   shop's price_includes_tax into its money. Now cart.js compute() passes opts.priceIncludesTax and the Sell form sets it from the catalogue
   view (lib/catalogue-view shop.price_includes_tax = policy.flagOf, the one flag the save reads). Run: node tests/walki-sell-preview.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const win = {}; const el0 = () => ({ style: {}, classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} });
const sandbox = { window: win, console, setTimeout, clearTimeout, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el0, addEventListener() {}, body: el0(), head: el0() }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: { language: 'en-IN' } };
sandbox.self = win; Object.assign(win, sandbox); sandbox.window = win;
const cx = vm.createContext(sandbox);
cx.window = cx; cx.self = cx; Object.keys(win).forEach((k) => { if (!(k in cx)) cx[k] = win[k]; });
for (const f of ['engine/money.js', 'engine/tax.js', 'engine/locale.js', 'app/helpers.js', 'app/cart.js']) vm.runInContext(fs.readFileSync(__dirname + '/../public/' + f, 'utf8'), cx);
const CB = cx.CBCart; ok(CB && typeof CB.create === 'function', 'CBCart loads');
const fils = (x) => Math.round(x * 100);
const item = { item_id: 'cable', item_data: { name: 'Cable Roll', price: 100, tax: { rate: 5, name: 'VAT' } } };
const cat = { shop: { currency_code: 'AED', price_includes_tax: true }, items: [item], offers: [] };

/* the Sell form's cart: opts as app.html selfBillCart builds them (priceIncludesTax from the catalogue view's shop) */
const incl = CB.create(cat, { priceIncludesTax: !!(cat.shop && cat.shop.price_includes_tax) });
CB.add(incl.ns, 'cable');
const html = incl.reviewHTML({ totalTestid: 'sb-total', taxTestid: 'sb-tax' });
const m = (re) => { const x = re.exec(html); return x ? x[1] : null; };
ok(/included/.test(html), 'the block says the VAT is included');
ok(fils(Number((m(/data-testid="sb-total">[^\d]*([\d.,]+)/) || '').replace(/,/g, ''))) === 10000, 'total 10000 fils (AED 100.00), never 10500');
ok(/data-testid="sb-tax"[^>]*>[\s\S]*?4\.76/.test(html), 'VAT inside is 476 fils (4.76), the saved chit TaxVal');
ok(!/105\.00/.test(html), 'no 105.00 anywhere in the preview');

/* a shop whose prices EXCLUDE tax keeps adding it: 10000 + 500 = 10500 */
const ex = CB.create({ shop: { currency_code: 'AED', price_includes_tax: false }, items: [item], offers: [] }, { priceIncludesTax: false });
CB.add(ex.ns, 'cable');
ok(/105\.00/.test(ex.reviewHTML({ totalTestid: 'sb-total' })), 'price-excludes-tax shop: 10500 fils total (unchanged)');

/* the wiring: the Sell form sets the flag, cart.js passes it to the one money call */
const app = fs.readFileSync(__dirname + '/../public/app.html', 'utf8');
ok(/priceIncludesTax:\s*!!\(cat && cat\.shop && cat\.shop\.price_includes_tax\)/.test(app), 'app.html selfBillCart passes the shop basis');
console.log(n + ' passed');
