'use strict';
// @type: unit
/**
 * ui-codes-adm.test.cjs - the Categories script wears ITS identity codes inside their own tags, and the admin lane's boundary claim holds (UX-137, std-adm, 14 Nov).
 *
 * OWNS      the proof that app/cap-categories.js (CTG002) carries each data-cbsid INSIDE the tag it belongs to (a code followed by the start of its own tag), that
 *           its three Cancel buttons are library mounts (CTG002-U23 and U24 in the footers of the two standard-set popups, U25 in the edit form) and that
 *           cap-admin.js, cap-catsetup.js, cap-definitions.js and cap-testing.js are still loaded by NO page through <script src> (SUPPORT: app.html's ensureCap alone).
 * CALLED BY by hand and the web job in ci.yml: node e2e/ui-codes-adm.test.cjs   (ADM_MUTATE=remove or swap must fail it)
 * FLOW      read cap-categories.js -> apply the mutation (remove: take out every pinned data-cbsid and the three mounts; swap: exchange the first two codes)
 *           -> every pin must be found -> the three mounts -> the boundary grep over public/*.html
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 */
const fs = require('fs'), path = require('path');
const mutate = process.env.ADM_MUTATE || '';
const PUB = path.join(__dirname, '..', 'public');
let failures = 0;
const check = (c, m) => { console.log((c ? '  ok ' : '  FAIL ') + m); if (!c) failures++; };

/** code -> the first characters that follow it in the same tag */
const PINS = [
  ["CTG002-S01", " class=\"inp\" data-test"], ["CTG002-B01", " type=\"button\" class=\""], ["CTG002-I01", " type=\"checkbox\" check"],
  ["CTG002-B03", " type=\"button\" data-te"], ["CTG002-B04", " type=\"button\" data-te"], ["CTG002-I02", " class=\"inp\" id=\"cbcat"],
  ["CTG002-B06", " class=\"pri\" id=\"cbcat"], ["CTG002-C01", " class=\"row' +"], ["CTG002-B07", " class=\"dback\" onclick"],
  ["CTG002-I03", " class=\"inp\" id=\"cbcat"], ["CTG002-I04", " class=\"inp\" value=\"' "], ["CTG002-B08", " class=\"pri\" data-test"],
  ["CTG002-B10", " class=\"dback\" onclick"], ["CTG002-C02", " onclick=\"navTo(\\'cata"], ["CTG002-C03", " onclick=\"navTo(\\'cata"],
  ["CTG002-C04", " onclick=\"navTo(\\'cata"], ["CTG002-B11", " class=\"pri\" data-test"], ["CTG002-B12", " class=\"pri\" data-test"],
  ["CTG002-B13", " data-testid=\"catg-ret"], ["CTG002-B14", " type=\"button\" class=\""], ["CTG002-I05", " class=\"inp\" data-test"],
  ["CTG002-C05", " onclick=\"goCatsetSec("], ["CTG002-B15", " type=\"button\" class=\""], ["CTG002-B16", " data-testid=\"catg-unc"],
  ["CTG002-S02", " class=\"inp\" data-test"], ["CTG002-B17", " class=\"composebtn\" st"], ["CTG002-B18", " class=\"composebtn\" st"],
  ["CTG002-I06", " data-testid=\"catg-sea"]
];
let src = fs.readFileSync(path.join(PUB, 'app', 'cap-categories.js'), 'utf8').split('\r\n').join('\n');
if (mutate === 'remove') {
  PINS.forEach((p) => { src = src.split('data-cbsid="' + p[0] + '"').join(''); });
  src = src.split("mount: 'CTG002-U2").join("mount: 'XXX");
}
if (mutate === 'swap') src = src.split('"' + PINS[0][0] + '"').join('"SWAPX"').split('"' + PINS[1][0] + '"').join('"' + PINS[0][0] + '"').split('"SWAPX"').join('"' + PINS[1][0] + '"');
let found = 0;
for (const [code, rest] of PINS) {
  if (src.indexOf('data-cbsid="' + code + '"' + rest) >= 0) found++;
  else console.log('  FAIL ' + code + ' is not in front of its own tag');
}
check(found === PINS.length, 'cap-categories.js: ' + found + ' of ' + PINS.length + ' codes sit in their own tag');
check(new Set(PINS.map((p) => p[0])).size === PINS.length, 'no code is written twice');
check(src.indexOf("ui.footerAction({ name: 'cancel', options: { mount: 'CTG002-U23'") >= 0, 'the first standard-set popup closes with the library Cancel (U23)');
check(src.indexOf("ui.footerAction({ name: 'cancel', options: { mount: 'CTG002-U24'") >= 0, 'the second standard-set popup closes with the library Cancel (U24)');
check(src.indexOf("ui.action('cancel', { mount: 'CTG002-U25'") >= 0, 'the edit form Cancel is the library one (U25)');

const pages = fs.readdirSync(PUB).filter((f) => /\.html$/.test(f));
for (const cap of ['cap-admin', 'cap-catsetup', 'cap-definitions', 'cap-testing']) {
  const loaders = pages.filter((f) => new RegExp('<script[^>]*src=[^>]*' + cap + '\\.js').test(fs.readFileSync(path.join(PUB, f), 'utf8')));
  check(loaders.length === 0, cap + '.js: no page loads it by <script src> (SUPPORT, app.html ensureCap only)' + (loaders.length ? ' - found ' + loaders.join(',') : ''));
}
check(/<script[^>]*src="\/app\/cap-categories\.js"/.test(fs.readFileSync(path.join(PUB, 'catalogue.html'), 'utf8')), 'cap-categories.js: catalogue.html loads it (CUSTOMER)');
console.log(failures ? failures + ' FAILED' : 'ALL PASS');
process.exit(failures ? 1 : 0);
