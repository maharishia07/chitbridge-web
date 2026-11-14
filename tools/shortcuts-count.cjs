#!/usr/bin/env node
'use strict';
/* tools/shortcuts-count.cjs: THE COUNTER of keyboard shortcuts on the customer pages (MNT-63). Prints declared / (nav entries + popups).
 * OWNS      the one count: what a customer page can navigate to (the rail's areas + the built Home cards whose page is one of the 19 customer pages) and the popups
 *           (every distinct POP code written in web source), against the rows of public/app/shortcuts-register.js.
 * CALLED BY e2e/shortcuts-guard.cjs (the same lists decide what must have a row); C:/dev/toolset/shortcuts-count.cjs (writes PM/SHORTCUTS.json for the coverage map).
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/shortcuts
 * Usage     node tools/shortcuts-count.cjs [--json]
 * A row counts when its key is well formed (g then a letter, or Alt+Shift+letter); the guard, not the counter, judges duplicates and forbidden keys. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(WEB, file), 'utf8');
const KEY_FORM = /^(g [a-z]|Alt\+Shift\+[A-Z])$/;

/** the register as the browser sees it: the file run against a bare window */
function register() {
  const win = {};
  vm.runInNewContext(read('public/app/shortcuts-register.js'), { window: win });
  return win.CB_SHORTCUT_REGISTER;
}
/** the pages of the 19 customer pages, as paths (the one list the proof packs share) */
function customerPaths() {
  return JSON.parse(read('e2e/proof/pages.json')).pages.map((page) => page[1].split('?')[0]);
}
/** the rail's areas, from the shell's own list */
function areas() {
  return /var AREAS = \[([^\]]+)\]/.exec(read('public/app/shell.js'))[1].match(/'([a-z]+)'/g).map((item) => item.slice(1, -1));
}
/** the built Home cards whose route lands on one of the 19 customer pages */
function cards() {
  const pages = customerPaths();
  return JSON.parse(read('public/app/manifest.json')).entries.filter((entry) => entry.state === 'built' && pages.includes(String(entry.route).split(/[?#]/)[0])).map((entry) => entry.id);
}
/** every distinct POP code written in web source (pages and scripts), the register file left out */
function popups() {
  const files = [];
  ['public', 'public/app'].forEach((dir) => fs.readdirSync(path.join(WEB, dir)).filter((name) => /\.(js|html)$/.test(name)).forEach((name) => files.push(dir + '/' + name)));
  const found = new Set();
  files.filter((file) => !file.endsWith('shortcuts-register.js')).forEach((file) => (read(file).match(/\bPOP\d{3}\b/g) || []).forEach((code) => found.add(code)));
  return [...found].sort();
}
/** the whole count: the wanted row codes, the declared ones, and the number */
function count() {
  const rows = register().rows;
  const wanted = areas().map((id) => 'HOM001-K01#' + id).concat(cards().map((id) => 'HOM001-B01#' + id), popups());
  const declared = wanted.filter((code) => Object.prototype.hasOwnProperty.call(rows, code) && KEY_FORM.test(rows[code]));
  return { declared: declared.length, of: wanted.length, nav: { declared: declared.filter((code) => code.startsWith('HOM001')).length, of: wanted.filter((code) => code.startsWith('HOM001')).length }, popups: { declared: declared.filter((code) => code.startsWith('POP')).length, of: wanted.filter((code) => code.startsWith('POP')).length }, missing: wanted.filter((code) => !declared.includes(code)) };
}

module.exports = { register, areas, cards, popups, customerPaths, count, KEY_FORM };
if (require.main === module) {
  const result = count();
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 1));
  else console.log('shortcuts declared ' + result.declared + ' of ' + result.of + ' (nav entries ' + result.nav.declared + ' of ' + result.nav.of + ' · popups ' + result.popups.declared + ' of ' + result.popups.of + ')');
}
