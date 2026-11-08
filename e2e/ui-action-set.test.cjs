'use strict';
// @type: unit
/**
 * ui-action-set.test.cjs — UX-137 lever 0: the standard action set (public/app/ui.js, CMP001..CMP010).
 *
 * Cases: every component draws one native button carrying its element code and its mount; a refused property, an unknown
 * component, a bad mount, a Save with no declared effect, and a commit with no confirm are refused (thrown); a role gate greys
 * WITH its sentence; the two mounted policy buttons and the print Save draw the same classes, id, testid and data-pol-act the
 * hand-written strings drew; a registered commit press goes through CBAction.run with its confirm and a plain press does not.
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 * Run: node e2e/ui-action-set.test.cjs
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
let failures = 0;
const check = (condition, message) => { console.log((condition ? '  ok ' : '  FAIL ') + message); if (!condition) failures++; };
const refused = (call) => { try { call(); return false; } catch (error) { return /ui\.action|ui\.dialog/.test(error.message); } };

const pressed = [], runs = [];
const listeners = {};
const sandbox = {
  console,
  tx: (text) => text,
  esc: (text) => String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])),
  CBAction: { run: (button, fn, options) => { runs.push(options); return Promise.resolve(fn()); } },
  window: {},
  document: { addEventListener: (name, fn) => { listeners[name] = fn; } },
};
vm.createContext(sandbox);
sandbox.window = sandbox;
vm.runInContext(read('app/ui.js'), sandbox);
const ui = sandbox.ui;

console.log('the set');
const names = Object.keys(ui.components).filter((name) => name !== 'dialog');
check(names.length === 9, 'nine actions: ' + names.join(' '));
const codes = Object.values(ui.components).map((component) => component.code);
check(new Set(codes).size === codes.length && codes.every((code) => /^CMP\d{3}$/.test(code)), 'ten distinct CMP codes (nine actions and the dialog)');
const forced = { save: { effect: 'preference' }, remove: { confirmedBy: 'page' } };
names.forEach((name) => {
  const html = ui.action(name, Object.assign({ mount: 'TST001-U01' }, forced[name] || {}));
  check(/^<button /.test(html) && html.includes('type="button"') && html.includes('data-cbsid="' + ui.components[name].code + '-B01"') && html.includes('data-cbmount="TST001-U01"'), name + ': one native button with element code and mount');
});

console.log('refusals (silence is the bug)');
check(refused(() => ui.action('nope', { mount: 'TST001-U01' })), 'unknown component refused');
check(refused(() => ui.action('done', { mount: 'TST001-U01', colour: 'red' })), 'a property outside the schema refused');
check(refused(() => ui.action('done', { mount: 'tst-1' })), 'a bad mount code refused');
check(refused(() => ui.action('save', { mount: 'TST001-U01' })), 'Save with no declared effect refused');
check(refused(() => ui.action('save', { mount: 'TST001-U01', effect: 'commit' })), 'a commit with no confirm refused');
check(refused(() => ui.action('remove', { mount: 'TST001-U01' })), 'Remove with no confirm refused (it is always a commit)');
check(refused(() => ui.action('remove', { mount: 'TST001-U01', effect: 'preference', confirmedBy: 'page' })), 'the fixed effect of Remove cannot be overridden');
check(!refused(() => ui.action('save', { mount: 'TST001-U01', effect: 'commit', confirm: { title: 'Pay', body: 'A$ 10', yes: 'Pay' } })), 'a commit with its confirm is accepted');

console.log('the markup of the mounted pages is unchanged');
const policySave = ui.action('save', { mount: 'ACC002-U01', object: 'policy value', hidden: true, effect: 'commit', confirmedBy: 'page', id: 'sx_pol_save_k', testid: 'sx-pol-save-k', data: { 'pol-act': 'save' } });
check(policySave.includes('class="act"') && policySave.includes('style="display:none"') && policySave.includes('id="sx_pol_save_k"') && policySave.includes('data-testid="sx-pol-save-k"') && policySave.includes('data-pol-act="save"') && policySave.endsWith('>Save</button>'), 'policy Save: class act, hidden, id, testid, data-pol-act, visible text Save');
const policyCancel = ui.action('cancel', { mount: 'ACC002-U02', object: 'policy edit', hidden: true, id: 'c', testid: 'c', data: { 'pol-act': 'cancel' } });
check(policyCancel.includes('class="act ghost"') && policyCancel.endsWith('>Cancel</button>'), 'policy Cancel: class act ghost, visible text Cancel');
const printSave = ui.action('save', { mount: 'ACC002-U03', object: 'print layout', effect: 'preference', id: 'pr-save', testid: 'pr-save' });
check(printSave.includes('class="act"') && !printSave.includes('display:none') && printSave.includes('aria-label="Save print layout"'), 'print Save: class act, shown, named "Save print layout"');
check(ui.action('close', { mount: 'TST001-U01' }).includes('aria-label="Close"'), 'the icon-only Close always has its accessible name');

console.log('role gate and busy');
const gated = ui.action('add', { mount: 'TST001-U01', object: 'counter', role: { ok: false, why: 'Only the owner may add counters' } });
check(gated.includes(' disabled ') && gated.includes('aria-disabled="true"') && gated.includes('title="Only the owner may add counters"'), 'a refused action stays visible, greyed, with its sentence');
check(ui.action('done', { mount: 'TST001-U01', busy: true }).includes('aria-busy="true"'), 'busy is aria-busy');

console.log('the one press path');
function click(code, effect) {
  const attributes = { 'data-cbmount': code, 'data-effect': effect || null };
  const button = { disabled: false, getAttribute: (name) => attributes[name] || null, closest: () => button };
  return () => listeners.click({ target: button });
}
ui.action('save', { mount: 'TST002-U01', effect: 'commit', confirm: { title: 'Post', body: 'x', yes: 'Post' }, onPress: () => pressed.push('commit') });
click('TST002-U01', 'commit')();
check(pressed.length === 1 && runs.length === 1 && runs[0].confirm && runs[0].confirm.title === 'Post', 'a commit press runs through CBAction.run with its confirm');
ui.action('open', { mount: 'TST002-U02', onPress: () => pressed.push('plain') });
runs.length = 0;
click('TST002-U02')();
check(pressed.length === 2 && runs.length === 0, 'a plain press does not go through CBAction (no Done toast)');

if (failures) { console.log(failures + ' FAILED'); process.exit(1); }
console.log('all passed');
