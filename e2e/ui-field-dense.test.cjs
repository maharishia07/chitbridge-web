'use strict';
// @type: unit
/**
 * ui-field-dense.test.cjs - the compact density of the Field part (CMP055 variant, UX-137 R2 follow-up): one control in a one-line list row.
 *
 * OWNS      the proof that ui.field({ density: 'compact' }) draws the control ALONE (no .cbf wrapper, no label row, no extra focusable node), keeps the id, name, testid,
 *           class, data and the CMP055 register attributes, names the control with aria-label, turns a hint into a hidden description (aria-describedby resolves) and a title,
 *           draws a checkbox as a bare native box, refuses a file or a long text, and that label, hint and placeholder all go through tx (regular density too); and that
 *           the regular density is byte-for-byte what it was.
 * CALLED BY ci.yml (QA gate, beside ui-field); by hand: node e2e/ui-field-dense.test.cjs
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const throwsWith = (fn, part) => { try { fn(); return false; } catch (error) { return String(error.message).indexOf(part) >= 0; } };

const sandbox = {
  console,
  tx: (text) => '[' + text + ']',
  esc: (text) => String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])),
  CBAction: { run: () => Promise.resolve() },
  window: {},
  document: { addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null },
  setTimeout, clearTimeout
};
vm.createContext(sandbox);
sandbox.window = sandbox;
vm.runInContext(read('app/ui.js'), sandbox);
vm.runInContext(read('app/ui-field.js'), sandbox);
const ui = sandbox.ui;
const focusables = (html) => (html.match(/<(input|textarea|select|button|a)\b/g) || []).length;

console.log('compact text');
const text = ui.field({ mount: 'CAT004-U01', kind: 'text', density: 'compact', id: 'row_name', testid: 'catset-name-x', cls: 'bn', label: 'Column name', hint: 'Rename it', placeholder: 'name', value: 'a"b' });
check(text.indexOf('class="cbf"') < 0 && text.indexOf('cbf-row') < 0 && text.indexOf('<label') < 0, 'no wrapper and no label row: the control stands alone in the row');
check(/^<input /.test(text) && / id="row_name"/.test(text) && / data-testid="catset-name-x"/.test(text) && /class="cbf-in cbf-dn bn"/.test(text), 'the page id, testid and class are kept; the dense class is added');
check(/data-cbsid="CMP055-I01"/.test(text) && /data-cbmount="CAT004-U01"/.test(text) && /data-cbname="field"/.test(text), 'the register attributes are the same');
check(/aria-label="\[Column name\]"/.test(text), 'the accessible name is aria-label, through tx');
check(/aria-describedby="row_name-h"/.test(text) && /<span class="cbf-vh" id="row_name-h">\[Rename it\]<\/span>/.test(text) && /title="\[Rename it\]"/.test(text), 'the hint is a hidden description that aria-describedby resolves, and a title');
check(/placeholder="\[name\]"/.test(text) && /value="a&quot;b"/.test(text), 'the placeholder goes through tx; the value is escaped');
check(focusables(text) === 1, 'one focusable node: the tab order is the control only');

console.log('compact number, date, checkbox');
const number = ui.field({ mount: 'CAT004-U02', kind: 'number', density: 'compact', id: 'tol', label: 'Round down within', value: '0.5' });
check(/inputmode="decimal"/.test(number) && number.indexOf('-x"') < 0 && number.indexOf('cbf-h') < 0, 'a number keeps the decimal keypad and draws no echo line');
const date = ui.field({ mount: 'CAT004-U03', kind: 'date', density: 'compact', id: 'plan_from', label: 'From', value: '2026-11-15' });
check(/type="date"/.test(date) && date.indexOf('-x"') < 0 && date.indexOf('<div') < 0, 'a date draws no echo line');
const box = ui.field({ mount: 'CAT004-U04', kind: 'checkbox', density: 'compact', id: 'tick', label: 'Decimal allowed', value: true });
check(/^<input /.test(box) && /type="checkbox"/.test(box) && / checked/.test(box) && /aria-label="\[Decimal allowed\]"/.test(box) && box.indexOf('<label') < 0, 'a checkbox is a bare native box with its name in aria-label');

console.log('refusals');
check(throwsWith(() => ui.field({ mount: 'CAT004-U05', kind: 'file', density: 'compact', label: 'x' }), 'one line'), 'a file is refused in compact');
check(throwsWith(() => ui.field({ mount: 'CAT004-U05', kind: 'long', density: 'compact', label: 'x' }), 'one line'), 'a long text is refused in compact');
check(throwsWith(() => ui.field({ mount: 'CAT004-U05', kind: 'text', density: 'tiny', label: 'x' }), 'density'), 'an unknown density is refused');

console.log('regular density: unchanged shape, words through tx');
const regular = ui.field({ mount: 'CAT004-U06', kind: 'text', id: 'reg', label: 'Name', hint: 'Shown on bills', placeholder: 'e.g. Rice' });
check(/<div class="cbf"><div class="cbf-row"><label class="cbf-l" for="reg">\[Name\]<\/label><\/div><input /.test(regular) && regular.indexOf('cbf-dn') < 0, 'a regular field still has its wrapper and label row');
check(/placeholder="\[e\.g\. Rice\]"/.test(regular) && /<span>\[Shown on bills\]<\/span>/.test(regular), 'placeholder and hint go through tx');
check(ui.field({ mount: 'CAT004-U06', kind: 'text', id: 'reg', label: 'Name', density: 'regular' }).indexOf('<div class="cbf">') === 0, 'density regular is the default');

console.log('the catsetup rows: drawn compact, handlers wired');
const heard = {};
const page = Object.assign({}, sandbox, { document: { addEventListener: (name, fn) => { heard[name] = fn; }, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null } });
vm.createContext(page);
page.window = page;
page.txf = (text) => text;
vm.runInContext(read('app/ui.js'), page);
vm.runInContext(read('app/ui-field.js'), page);
vm.runInContext(read('app/cap-catsetup.js'), page);
page.catsetUnitMeasured = () => true; /* after the script: its own function would replace the stub */
const calls = [];
page.catsetUomRuleSet = (unit, field, value) => calls.push([unit, field, value]);
const rule = page.catsetUomRuleHTML('KGM');
const tolBox = (rule.match(/<input[^>]* id="uomr_KGM_t"[^>]*>/) || [''])[0];
check(/data-cbmount="CAT004-U03"/.test(tolBox) && /data-testid="uom-tol-KGM"/.test(tolBox) && tolBox.indexOf('aria-label="[Round down within] KGM"') > 0, 'the tolerance box is a compact CMP055 number named by its label and its unit, testid kept');
check(rule.indexOf('data-cbsid="CAT004-I0') < 0 && rule.indexOf('class="cbf"') < 0, 'the row holds no hand-written input and no field wrapper: the one-line layout is in the page rules');
heard.change({ target: { getAttribute: (name) => ({ 'data-cbname': 'field', 'data-cbkind': 'number' }[name]), id: 'uomr_KGM_t', value: '0.5' } });
check(calls.length === 1 && calls[0].join('|') === 'KGM|tol|0.5', 'a change on it reaches catsetUomRuleSet(unit, tol, value): ' + calls.map((c) => c.join('|')).join(';'));
console.log(failures ? failures + ' FAILED' : 'ALL PASS');
process.exit(failures ? 1 : 0);
