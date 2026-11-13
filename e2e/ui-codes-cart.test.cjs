'use strict';
// @type: unit
/**
 * ui-codes-cart.test.cjs - the shared basket (public/app/cart.js) wears ITS identity codes (UX-137, one-pass ops lane, screen OWN006 "Cart").
 *
 * OWNS      the proof that every control cart.js draws carries a data-cbsid code of screen OWN006, that each code sits on ITS element (a marker only
 *           that element carries must follow the code before the next code starts: a swap of two codes fails), that no code is written twice,
 *           that the file has exactly 32 OWN006 elements, that the close and remove marks keep their component codes, and that no code is retired.
 *           A tag drawn by a row builder wears ONE code for all its rows (the stepper's minus is one element in the register, drawn once per row).
 * CALLED BY by hand and the QA gate: node e2e/ui-codes-cart.test.cjs   (CART_ID_MUTATE=swap or remove must fail it)
 * CARD      storefront-and-catalogue/cart
 * Register  codes are looked up in UIID_REG, else ../chitbridge-docs/SCREENS.json, else C:/dev/SCREENS.json: a code not there yet is printed as
 *           pending (the docs PR lands the rows), a code the register calls retired fails.
 */
const fs = require('fs'), path = require('path');
const mutate = process.env.CART_ID_MUTATE || '';
const SOURCE = path.join(__dirname, '..', 'public', 'app', 'cart.js');
const WINDOW = 400; /* how far after a code its own marker may sit when no other code starts first */

let src = fs.readFileSync(SOURCE, 'utf8').split('\r\n').join('\n');
if (mutate === 'remove') src = src.split('data-cbsid="OWN006-B01"').join('');
if (mutate === 'swap') src = src.split('OWN006-B01').join('SWAPX').split('OWN006-B02').join('OWN006-B01').split('SWAPX').join('OWN006-B02');

let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) failures++; };

/** code -> a marker only its element carries (a class, a test id, an aria-label or the word it is drawn with) */
const WANT = {
  'OWN006-B01': 'data-testid="pick-catg',
  'OWN006-C01': 'title="Open the cart to review',
  'OWN006-C02': 'class="cbcart-x"',
  'OWN006-B02': 'CBCart.setQty(',
  'OWN006-B03': 'rnd + \'" onclick="event.stopPropagation();CBCart.add(',
  'OWN006-I01': 'placeholder="your price" value="',
  'OWN006-C03': 'display:inline-flex;align-items:center;gap:8px',
  'OWN006-B04': 'CBCart.dec(',
  'OWN006-I02': 'width:52px',
  'OWN006-B05': 'color:#fff" onclick="CBCart.add(',
  'OWN006-B06': "tx('Show everything')",
  'OWN006-C04': 'class="cbcart-grp"',
  'OWN006-B07': "'Keep shopping'",
  'OWN006-B08': 'data-testid="cart-checkout"',
  'OWN006-I03': 'class="inp cbpick-q"',
  'OWN006-B09': 'class="cbcart-float-pill"',
  'OWN006-B10': 'class="cbcart-float-x"',
  'OWN006-B11': 'class="cbcat-pick',
  'OWN006-B12': "call('dec')",
  'OWN006-I04': 'aria-label="quantity"',
  'OWN006-B13': 'aria-label="more"',
  'OWN006-B14': 'aria-label="add"',
  'OWN006-I05': 'class="cbcat-offer"',
  'OWN006-C05': 'class="cbcat-moret"',
  'OWN006-C06': 'class="cbcat-all"',
  'OWN006-I06': 'class="cbcat-q" disabled',
  'OWN006-B15': 'data-testid="cbcat-checkout-',
  'OWN006-I07': 'class="cbcat-note"',
  'OWN006-I08': 'type="file"',
  'OWN006-I09': 'class="cbcat-q" placeholder=',
  'OWN006-B16': 'data-testid="pick-onoffer"',
  'OWN006-B17': 'class="cbcart-bar cbcat-chip'
};

/** the text from a code up to the next code of the file (at most WINDOW characters): the tag it sits in */
function tagAfter(code) {
  const at = src.indexOf('data-cbsid="' + code + '"');
  if (at < 0) return null;
  const rest = src.slice(at + 12);
  const next = rest.search(/data-cbsid=/);
  return rest.slice(0, next >= 0 ? Math.min(next, WINDOW) : WINDOW);
}

for (const [code, marker] of Object.entries(WANT)) {
  const tag = tagAfter(code);
  check(tag !== null && tag.indexOf(marker) >= 0, code + ' sits on the element with ' + marker);
}

/** every code is written once; the file has exactly the 32 coded elements of this screen */
const written = [...src.matchAll(/data-cbsid="(OWN006-[A-Z][0-9]{2})"/g)].map((m) => m[1]);
const dup = written.filter((c, i) => written.indexOf(c) !== i);
check(dup.length === 0, 'no code is written on two elements' + (dup.length ? ' (' + dup.join(',') + ')' : ''));
check(written.length === 32 && Object.keys(WANT).length === 32, 'the file has 32 coded elements, counted by code: ' + written.length + ' written, ' + Object.keys(WANT).length + ' expected');
check(!/data-cbsid="(?!OWN006-|CMP005"|CMP008")/.test(src), 'no code of another screen is written here (only the component codes CMP005 close and CMP008 remove)');
check(/data-cbsid="CMP005"/.test(src) && /data-cbsid="CMP008"/.test(src), 'the close and remove marks keep their component codes');

/** the register */
let reg = null;
for (const p of [process.env.UIID_REG, path.join(__dirname, '..', '..', 'chitbridge-docs', 'SCREENS.json'), 'C:/dev/SCREENS.json']) {
  if (p && fs.existsSync(p)) { try { reg = JSON.parse(fs.readFileSync(p, 'utf8')); break; } catch (e) { console.log('  note: register ' + p + ' did not parse (' + e.message + ')'); } }
}
if (reg) {
  const rows = {}; Object.values(reg.screens || {}).forEach((r) => { if (r.code) rows[r.code] = r; });
  const all = Object.keys(WANT), missing = all.filter((c) => !rows[c]), retired = all.filter((c) => rows[c] && rows[c].retired);
  console.log('  register: ' + (all.length - missing.length) + ' of ' + all.length + ' codes found' + (missing.length ? ' (pending until the docs PR lands: ' + missing.length + ')' : ''));
  check(retired.length === 0, 'no code is retired in the register');
}
console.log(failures ? failures + ' FAILED' : 'ALL PASS');
process.exit(failures ? 1 : 0);
