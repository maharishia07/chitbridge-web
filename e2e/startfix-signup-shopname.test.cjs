'use strict';
// @type: unit
/**
 * startfix-signup-shopname.test.cjs - A-F-01 (Walk A 21 Nov): sign-up asks the shop's NAME and sends it as display_name.
 *
 * OWNS      the proof that app/register-form.js draws the Business name box (SCR053-U05, reg-shop-name) above the User ID, refuses a name under 2 letters before any call,
 *           and sends user_id (the sign-in id) and display_name (the typed business name) as two different things.
 * CALLED BY ci.yml (QA gate, beside ui-field-w3); by hand: node e2e/startfix-signup-shopname.test.cjs
 * FLOW      run ui.js + ui-field.js + register-form.js in a vm with a fake document, paint the form, press Register with typed values, read what api() was handed
 * CARD      28-platform-and-operations/register-form
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };

const painted = [];
const host = { set innerHTML(html) { painted.push(html); }, get innerHTML() { return painted[painted.length - 1] || ''; } };
const typed = {};
const calls = [];
const sandbox = {
  console,
  tx: (text) => text,
  failWords: (e, fallback) => fallback || 'something went wrong',
  txf: (text, values) => String(text).replace(/\{(\w+)\}/g, (whole, name) => (values && name in values ? values[name] : whole)),
  esc: (text) => String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])),
  val: (id) => typed[id] || '',
  api: (name, options) => { calls.push({ name, body: options && options.body }); return Promise.reject(new Error('stop here')); },
  CBAction: { run: () => Promise.resolve() },
  CBGov: { read: () => ({}), rows: () => [], payload: () => ({}) },
  document: { addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null },
  setTimeout, clearTimeout
};
vm.createContext(sandbox);
sandbox.window = sandbox;
vm.runInContext(read('app/ui.js'), sandbox);
vm.runInContext(read('app/ui-field.js'), sandbox);
vm.runInContext(read('app/register-form.js'), sandbox);

(async () => {
  sandbox.REG = { step: 'form', shop: 'Walk A Coffee', name: '', email: '', busy: false, err: '' };
  sandbox.CBRegistration.mount(host, () => {});
  const html = host.innerHTML;
  const shop = (html.match(/<input[^>]* id="r_shop"[^>]*>/) || [''])[0];
  check(/data-testid="reg-shop-name"/.test(shop) && /value="Walk A Coffee"/.test(shop), 'the form has a Business name box (reg-shop-name) with its value');
  check(html.indexOf('r_shop') < html.indexOf('r_name'), 'the Business name comes before the User ID');

  typed.r_shop = ' ';
  typed.r_name = 'walka-coffee-au';
  typed.r_email = 'a@b.example';
  await sandbox.doRegister();
  check(calls.length === 0 && /business name/i.test(sandbox.REG.err), 'a blank business name is refused in words, no call is made');

  typed.r_shop = 'Walk A Coffee Supplies';
  await sandbox.doRegister();
  const sent = (calls[0] || {}).body || {};
  check(calls.length === 1 && calls[0].name === 'register', 'a named shop calls register');
  check(sent.user_id === 'walka-coffee-au' && sent.display_name === 'Walk A Coffee Supplies', 'user_id is the sign-in id and display_name is the typed business name (not the user id)');
  process.exit(failures ? 1 : 0);
})();
