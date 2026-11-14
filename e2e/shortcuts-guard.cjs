'use strict';
/**
 * e2e/shortcuts-guard.cjs: THE SHORTCUT REGISTER IS WELL FORMED (MNT-63, DECISIONS 14 Nov "Keyboard shortcuts become a measure").
 * OWNS      the rules of public/app/shortcuts-register.js: two codes never share one key (within nav, and a popup key never a nav key) · no bare always-on letter · no Ctrl or Meta
 *           chord, and no Alt+Shift chord a browser owns · every customer-page nav entry and the sheet have a row · a row names something that exists · no key written outside the register.
 * CALLED BY CI (Static guards) and by hand: node e2e/shortcuts-guard.cjs
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/shortcuts
 */
const fs = require('fs');
const path = require('path');
const counter = require('../tools/shortcuts-count.cjs');

const WEB = path.join(__dirname, '..');
const BROWSER_OWNED = ['Alt+Shift+B', 'Alt+Shift+T', 'Alt+Shift+I']; /* Chrome and Edge: bookmarks bar, toolbar, send feedback */
const GRANDFATHERED_LITERALS = { 'public/app/ui.js': 1 }; /* the Run in background component's Control+B: it only shrinks */
let pass = 0;
const fails = [];
const ok = (what, cond) => { if (cond) { pass++; console.log('  ok ' + what); } else { fails.push(what); console.error('  FAIL ' + what); } };

const reg = counter.register();
const rows = reg.rows;
const codes = Object.keys(rows);
const scopeOf = (code) => (code.startsWith('POP') ? 'popup' : 'nav');

console.log('\n== the register ==');
const bad = codes.filter((code) => !counter.KEY_FORM.test(rows[code]));
ok('every key is "g then a letter" or Alt+Shift+letter (no bare letter, no Ctrl, no Meta): ' + (bad.map((code) => code + '=' + rows[code]).join(', ') || 'none bad'), !bad.length);
ok('the setting is the avatar kind "keys"', reg.setting === 'keys' && /keys: 'cb_keys'/.test(fs.readFileSync(path.join(WEB, 'public/app/avatar.js'), 'utf8')));
ok('the sheet key is ? and its code is a row', reg.sheet.key === '?' && Object.prototype.hasOwnProperty.call(rows, reg.sheet.code));

const dup = {};
codes.filter((code) => scopeOf(code) === 'nav').forEach((code) => { (dup[rows[code]] = dup[rows[code]] || []).push(code); });
const shared = Object.keys(dup).filter((key) => dup[key].length > 1).map((key) => key + ' <- ' + dup[key].join(' + '));
ok('no two nav codes share one key: ' + (shared.join('; ') || 'none shared'), !shared.length);
const popupKeys = [...new Set(codes.filter((code) => scopeOf(code) === 'popup').map((code) => rows[code]))];
ok('every popup row uses the one popup key, and no nav row uses it: ' + popupKeys.join(','), popupKeys.length === 1 && !dup[popupKeys[0]]);
ok('no Alt+Shift chord a browser owns: ' + BROWSER_OWNED.join(' '), !codes.some((code) => BROWSER_OWNED.includes(rows[code])));

console.log('\n== the rows name real things ==');
const result = counter.count();
const navMissing = result.missing.filter((code) => code.startsWith('HOM001'));
ok('every area and every customer-page card has a row (missing: ' + (navMissing.join(', ') || 'none') + '); popups without one are the counter work, ' + (result.popups.of - result.popups.declared) + ' left', !navMissing.length);
const wanted = new Set(counter.areas().map((id) => 'HOM001-K01#' + id).concat(counter.cards().map((id) => 'HOM001-B01#' + id), counter.popups()));
const stray = codes.filter((code) => !wanted.has(code));
ok('no row names something that is not there: ' + (stray.join(', ') || 'none stray'), !stray.length);

console.log('\n== one listener, one register ==');
const unit = fs.readFileSync(path.join(WEB, 'public/app/shortcuts.js'), 'utf8');
const registerText = fs.readFileSync(path.join(WEB, 'public/app/shortcuts-register.js'), 'utf8');
ok('the unit adds exactly one keydown listener', (unit.match(/addEventListener\('keydown'/g) || []).length === 1);
ok('the register file only assigns CB_SHORTCUT_REGISTER (no code of its own)', /root\.CB_SHORTCUT_REGISTER = \{/.test(registerText) && !/addEventListener|\bfunction \w/.test(registerText));

console.log('\n== no key written outside the register ==');
const appDir = path.join(WEB, 'public/app');
const offenders = fs.readdirSync(appDir).filter((name) => name.endsWith('.js') && !/^shortcuts(-register)?\.js$/.test(name)).filter((name) => {
  const hits = (fs.readFileSync(path.join(appDir, name), 'utf8').match(/\bshortcut:\s*['"]/g) || []).length;
  return hits > (GRANDFATHERED_LITERALS['public/app/' + name] || 0);
});
ok('no component declares a shortcut: literal of its own: ' + (offenders.join(', ') || 'none'), !offenders.length);

console.log('\n' + pass + ' passed, ' + fails.length + ' failed');
process.exit(fails.length ? 1 : 0);
