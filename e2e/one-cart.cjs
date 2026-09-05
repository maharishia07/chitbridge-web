/**
 * one-cart.cjs — THE CART IS THE ONLY PLACE MONEY IS COMPUTED FOR A BUYER'S EYES.
 *   node e2e/one-cart.cjs
 *
 * Athi, 2026-09-05: "either storefront or supplier or through API, all should have the same principle … single source of
 * truth … keep it as a practice". The storefront had its own basket math for two days and drifted (no GST on the Suppliers
 * screen, a badge no screen could show). This guard fails the moment a second implementation appears:
 *   – only app/cart.js (the CART capability) may build the "Total incl. tax" row or a per-rate tax table (`byRate`);
 *   – only app/cart.js and app/offers.js may call CBOffers.evaluate for a BASKET (the product page's single-line preview
 *     and the offer form's test panel are allowed: they preview one product, they never total a basket).
 */
const fs = require('fs'); const path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const files = ['app.html', 'shop.html'].concat(fs.readdirSync(path.join(PUB, 'app')).filter((f) => f.endsWith('.js')).map((f) => 'app/' + f));
const OWNER = 'app/cart.js';
/* the renderer pair (cart-ui + catalogue-ui) and the engine itself may evaluate; anyone else only for ONE line ("lines:[line]") */
const ALLOW_EVALUATE = new Set([OWNER, 'app/offers.js',
  'app.html'              /* the product page previews ONE product (prodOfferCartHTML, the bulk preview) — and the Compose cart, see DEBT below */,
  'app/cap-definitions.js' /* the offer form's preview and Test panel: one product */]);
/* KNOWN DEBT, printed every run until it is gone: the Compose cart (CC.offers) still totals its own offers — step 3 of the convergence */
const DEBT = [['app.html', /offers\s*:\s*CC\.offers/, 'the Compose cart evaluates its own offers (CC.offers) — converge onto CBCart.money (step 3)']];
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '');
let bad = 0;
for (const rel of files) {
  const s = stripComments(fs.readFileSync(path.join(PUB, rel), 'utf8'));
  if (rel !== OWNER) {
    /* the MARKUP of the row (">Total incl. tax<"), not the words — the Legend and the docs may name it */
    if (/>\s*Total incl\. tax\s*</.test(s)) { console.log('  ✗ ' + rel + ' renders its own "Total incl. tax" — the cart owns that row (CBCart.moneyRowsHTML)'); bad++; }
    if (/\bbyRate\s*\[/.test(s) && !/CBCart\.money\(/.test(s)) { console.log('  ✗ ' + rel + ' builds a per-rate tax table of its own — call CBCart.money'); bad++; }
  }
  /* a screen that reads the cart's bare total must also ask it for the money rows — a bare Total beside offers and tax is the
     Suppliers-review defect of 2026-09-05 ("₹400" while the storefront basket said "₹378 incl. tax") */
  if (rel !== OWNER && /\b(?:c|cart|_CART|UI\._\w+Cart)\.total\(\)/.test(s)) { console.log('  ✗ ' + rel + ' reads the cart total itself — the cart prints its own money block: c.reviewHTML({ totalTestid })'); bad++; }
  if (!ALLOW_EVALUATE.has(rel)) {
    const calls = s.match(/CBOffers\.evaluate\(\s*\{[^}]*/g) || [];
    for (const c of calls) if (!/lines\s*:\s*\[\s*[A-Za-z_$][\w$]*\s*\]/.test(c) && !/lines\s*:\s*lines\b/.test(c) && !/lines\s*:\s*\[cbOfferLine/.test(c)) { console.log('  ✗ ' + rel + ' evaluates offers for a basket — go through CBCart.money: ' + c.slice(0, 60)); bad++; }
  }
}
for (const [rel, re, why] of DEBT) { try { if (re.test(stripComments(fs.readFileSync(path.join(PUB, rel), 'utf8')))) console.log('  ⚠ debt · ' + rel + ': ' + why); } catch (_) {} }
console.log('\n══ ONE CART ══');
console.log(bad ? '  ' + bad + ' second implementation(s) found\n' : '  ✓ money is computed in one place (app/cart.js — the CART capability); every screen delegates\n');
process.exit(bad ? 1 : 0);
