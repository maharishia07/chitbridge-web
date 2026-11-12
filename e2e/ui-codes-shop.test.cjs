'use strict';
// @type: unit
/**
 * ui-codes-shop.test.cjs - the customer Shop page (SHP001) wears its identity codes (UX-137 slice 5, 2026-11-12).
 *
 * OWNS      the proof that shop.html tags its 65 controls with SHP001-<kind><nn> (B button, I input, S select, T textarea, C chip), that the letter is the
 *           tag's own kind, that no code is on two tags, that named controls wear THEIR code (a swap fails), that no control tag is left without a code
 *           (a new raw control fails), that the three privacy buttons drawn by the shared builder in shop-privacy.js take their codes from their call
 *           sites, and that the stamp only added attributes (strip them: no code is left).
 * CALLED BY by hand and the QA gate: node e2e/ui-codes-shop.test.cjs   (SHOP_ID_MUTATE=remove|swap must fail it)
 * FLOW      UX-137 slice 5; the rows are in the docs SCREENS.json (twin branch cmdb/ux137-stamp-5, screen row "Shop › Shop" = SHP001).
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 * Register  looked up in UIID_REG, else ../chitbridge-docs/SCREENS.json, else C:/dev/SCREENS.json: a code not there yet is printed as pending
 *           (the docs PR lands the rows), a code the register calls retired fails.
 */
const fs = require('fs'), path = require('path');
const mutate = process.env.SHOP_ID_MUTATE || '';
const SCREEN = 'SHP001';
const KIND = { button: 'B', input: 'I', select: 'S', textarea: 'T', a: 'C', div: 'C', span: 'C' };
/** the attribute text each named control is found by -> the code its tag must wear */
const WANT = [
  ['id="p_search"', 'SHP001-I04'], ['onclick="shopCatToggle()"', 'SHP001-B05'], ['id="lg_contact"', 'SHP001-I05'], ['onclick="supOpen();return false"', 'SHP001-C02'],
  ['id="sup_what"', 'SHP001-T02'], ['onclick="supSendCode()"', 'SHP001-B09'], ['onclick="supSubmit()"', 'SHP001-B10'], ['id="o_qty"', 'SHP001-I17'],
  ['onclick="orderConfirm()"', 'SHP001-B19'], ['onclick="orderStart()"', 'SHP001-B20'], ['onclick="shopPrivacy()"', 'SHP001-B21'], ['data-testid="shop-orders-more"', 'SHP001-B23'],
  ['onclick="shopMyOrders()"', 'SHP001-B24'], ['onclick="vizToOrder()"', 'SHP001-B27']
];
const PRIVACY_CALLS = [["btn('No', 'data-cbsid=\"", 'SHP001-B28'], ["btn('Yes', 'data-cbsid=\"", 'SHP001-B29'], ['btn(KIND[item], \'data-cbsid="', 'SHP001-B30']];
let failures = 0;
const check = (c, m) => { console.log((c ? '  ok ' : '  FAIL ') + m); if (!c) failures++; };
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8').split('\r\n').join('\n');

let src = read('shop.html');
const first = 'SHP001-I04', second = 'SHP001-B05';
if (mutate === 'remove') src = src.split(' data-cbsid="' + first + '"').join('');
if (mutate === 'swap') src = src.split(first).join('SWAPX').split(second).join(first).split('SWAPX').join(second);
const tags = [...src.matchAll(/<(button|input|select|textarea|a|div|span)\b([^>]*?data-cbsid="([A-Z]{3}[0-9]{3}-[A-Z][0-9]{2})"[^>]*)>/g)];
const codes = tags.map((t) => t[3]);
console.log('shop.html');
check(codes.length === 65, 'shop.html has 65 tagged elements, found ' + codes.length);
check(new Set(codes).size === codes.length, 'no code is on two tags');
check(codes.every((c) => c.indexOf(SCREEN + '-') === 0), 'every code is under ' + SCREEN);
const wrong = tags.filter((t) => KIND[t[1]] !== t[3].charAt(7));
check(wrong.length === 0, 'every code letter is its tag kind' + (wrong.length ? ' (' + wrong.map((t) => t[3]).join(',') + ')' : ''));
for (const [needle, code] of WANT) {
  const tag = tags.filter((t) => t[2].indexOf(needle) >= 0)[0];
  check(!!tag && tag[3] === code, needle + ' wears ' + code);
}
/** the census counts every control tag; each must carry a code (a new raw control fails here) */
const census = [...src.matchAll(/<(button|input|select|textarea)\b([^>]*)>/g)].filter((t) => !/type=["']hidden["']/.test(t[2]));
const chips = [...src.matchAll(/<(a|div|span)\b([^>]*\sonclick=[^>]*)>/g)];
const bare = census.concat(chips).filter((t) => !/data-cbsid="/.test(t[2]));
check(bare.length === 0, 'no control tag is left without a code' + (bare.length ? ' (' + bare.length + ': ' + bare.slice(0, 3).map((t) => t[0].slice(0, 50)).join(' | ') + ')' : ''));
/** the stamp is the only change: strip every attribute it writes and no code is left */
check(!/data-cbsid="SHP001-/.test(src.replace(/ data-cbsid="SHP001-[A-Z][0-9]{2}"/g, '')), 'stripped: no code is left, the page is the same markup');

console.log('app/shop-privacy.js');
const priv = read('app/shop-privacy.js');
for (const [needle, code] of PRIVACY_CALLS) check(priv.indexOf(needle + code + '"') >= 0, 'the call ' + needle.slice(0, 12) + ' passes ' + code);
check(!/data-cbsid="SHP001-/.test(priv.replace(/data-cbsid="SHP001-B[0-9]{2}" /g, '')), 'stripped: no code is left in the privacy sheet');

let reg = null;
for (const p of [process.env.UIID_REG, path.join(__dirname, '..', '..', 'chitbridge-docs', 'SCREENS.json'), 'C:/dev/SCREENS.json']) {
  if (p && fs.existsSync(p)) { try { reg = JSON.parse(fs.readFileSync(p, 'utf8')); break; } catch (e) { console.log('  register unreadable at ' + p + ': ' + e.message); } }
}
if (reg) {
  const rows = {}; Object.values(reg.screens || {}).forEach((r) => { if (r.code) rows[r.code] = r; });
  const all = codes.concat(PRIVACY_CALLS.map((c) => c[1]));
  const missing = all.filter((c) => !rows[c]), retired = all.filter((c) => rows[c] && rows[c].retired);
  console.log('  register: ' + (all.length - missing.length) + ' of ' + all.length + ' codes found' + (missing.length ? ' (pending until the docs PR lands: ' + missing.length + ')' : ''));
  check(retired.length === 0, 'no code is retired in the register');
}
console.log(failures ? failures + ' FAILED' : 'ALL PASS');
process.exit(failures ? 1 : 0);
