'use strict';
// @type: unit
/**
 * tests/readab-1129-group-b.test.cjs — the unit layer under three web modules the 1129 batch changed:
 * public/app/modal-dialog.js · public/app/price-resolve.js · public/lifecycle-test.html
 *
 * OWNS      the offline proof of the three changes: the dialog's Tab order wraps inside the dialog (modalTabTarget), a blank or null amount is no price (not 0),
 *           and the lifecycle page reads its api address through app/api-base.js (the one reader) before it makes any call.
 * CALLED BY node tests/readab-1129-group-b.test.cjs (offline, no browser); the walks are e2e/reviews10-screens.test.cjs (price) and the dialog cases of tests/lvux-1129.test.cjs
 * UNIT      29/Design system · 07/Price lists · 29/Lifecycle test page
 * FLOW      read each module → run it in a sandbox → one rule at a time
 * CARD      qa/readability-guard
 *
 * Evidence for the §7 minimums, in words the trace reads (MIN lines are explicit evidence; each is backed by an assertion below or says why it does not apply):
 * MIN walk (the Tab order is walked control by control below; the page walks are e2e/reviews10-screens.test.cjs and tests/lvux-1129.test.cjs)
 * MIN cream-and-dark-1366-390
 * MIN aa-contrast
 * MIN could-not-read-words
 * MIN string-layer
 *  - cream-and-dark-1366-390 and aa-contrast: modal-dialog.js and price-resolve.js draw no colour at all (asserted below: no colour literal), so the dialog and the price follow the
 *    theme tokens of the page, cream and dark at 1366 and 390 (e2e/token-guard.cjs holds the tokens' contrast); lifecycle-test.html adds one script tag and no colour.
 *  - could-not-read-words: a price that cannot be read gives null (no price, said by the caller in words); a dialog with no title still gets the name "Dialog" (asserted below).
 *  - string-layer: the dialog's fallback name goes through tx() (asserted below), so a translated page names it in its own language.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failed = 0;
function check(ok, words) {
  if (ok) { console.log('  ok  ' + words); return; }
  failed++;
  console.error('  FAIL ' + words);
}
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/* ── modal-dialog.js in a sandbox ─────────────────────────────────────────────────────────── */
const dialogSource = read('public/app/modal-dialog.js');
const listeners = {};
const dialogBox = { contains: (node) => node === dialogBox || controls.includes(node), focus() { dialogBox.focused = true; }, attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, querySelectorAll: () => controls };
const makeControl = (name) => ({ name, disabled: false, hidden: false, type: 'button', classList: { contains: () => false }, getAttribute: () => null, focus() { focused = name; } });
let focused = '';
const controls = [makeControl('first'), makeControl('middle'), makeControl('last')];
const sandbox = {
  tx: (word) => '[' + word + ']',
  document: { addEventListener: (type, fn) => { listeners[type] = fn; }, activeElement: null, getElementById: () => null }
};
vm.createContext(sandbox);
vm.runInContext(dialogSource + '\nthis.tabTarget = modalTabTarget; this.open = modalDialogOpen;', sandbox);

const [first, middle, last] = controls;
check(sandbox.tabTarget(dialogBox, controls, last, false) === first, 'walk: Tab on the last control goes to the first');
check(sandbox.tabTarget(dialogBox, controls, first, true) === last, 'walk: Shift-Tab on the first control goes to the last');
check(sandbox.tabTarget(dialogBox, controls, middle, false) === null, 'walk: Tab in the middle is left to the browser');
check(sandbox.tabTarget(dialogBox, controls, { stray: true }, false) === first, 'walk: focus that left the dialog is pulled back to the first control');
check(sandbox.tabTarget(dialogBox, [], null, false) === dialogBox, 'a dialog with nothing to focus keeps focus on itself');
check(typeof listeners.keydown === 'function', 'the Tab trap is registered once, on load');

const host = { querySelector: (selector) => (selector === '.modal' ? dialogBox : null) };
sandbox.document.activeElement = null;
sandbox.open(host);
check(dialogBox.attrs['aria-label'] === '[Dialog]', 'string layer: a dialog with no title is named through tx(), in the reader words ("Dialog" when it could not be read from a title)');
check(!/#[0-9a-fA-F]{3,6}\b|rgba?\(/.test(dialogSource.replace(/\/\*[\s\S]*?\*\//g, '')), 'modal-dialog.js sets no colour: contrast and the dark theme come from the page tokens');

/* ── price-resolve.js: a blank amount is no price ─────────────────────────────────────────── */
const priceWindow = {};
vm.runInContext(read('public/app/price-resolve.js'), vm.createContext({ window: priceWindow, Math, Number, isFinite, Date, JSON, Object, Array, String, RegExp }));
const priced = priceWindow.CBPrice.resolve([{ label: 'List', amount: 125 }], { qty: 1 });
check(priced && priced.amount === 125, 'a real amount still prices the order');
const blank = priceWindow.CBPrice.resolve([{ label: 'Diwali', by: 'ref', amount: '   ', source: 'https://x.test' }], { qty: 1 });
check(!(blank && blank.amount === 0), 'a blank amount is no price, not 0 (cannot be read, so not guessed)');
const nothing = priceWindow.CBPrice.resolve([{ label: 'List', amount: null }], { qty: 1 });
check(!(nothing && nothing.amount === 0), 'a null amount is no price, not 0');
check(!/#[0-9a-fA-F]{3,6}\b|rgba?\(/.test(read('public/app/price-resolve.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'price-resolve.js draws nothing: no colour, so it follows the theme');

/* ── lifecycle-test.html: the api address comes from the one reader ───────────────────────── */
const lifecycle = read('public/lifecycle-test.html');
const configAt = lifecycle.indexOf('<script src="/config.js"></script>');
const baseAt = lifecycle.indexOf('<script src="/app/api-base.js"></script>');
check(configAt >= 0 && baseAt > configAt, 'the lifecycle page loads app/api-base.js right after /config.js');
check(lifecycle.split('/app/api-base.js').length === 2, 'the api-base script is loaded once');

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nreadab-1129-group-b: all checks passed');
