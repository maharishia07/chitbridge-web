'use strict';
// @type: unit
/**
 * walks-register-email-code.test.cjs - WALK S S-F-01 and S-F-13: Register refuses "not-an-email" in words before any call (the shared ui.field.emailWhy),
 * and its code box takes the long tester code (maxlength 320, what the api's verify accepts), not 6 characters.
 *
 * OWNS      the proof for app/register-form.js (reg-email check, reg-otp length) and ui.field.emailWhy in app/ui-field.js
 * CALLED BY ci.yml (QA gate, beside startfix-signup-shopname); by hand: node e2e/walks-register-email-code.test.cjs
 * FLOW      run ui.js + ui-field.js + register-form.js in a vm with a fake document, press Register with typed values, read what api() was handed
 * CARD      28-platform-and-operations/register-form
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const painted = [];
const host = { set innerHTML(html) { painted.push(html); }, get innerHTML() { return painted[painted.length - 1] || ''; } };
const typed = {}, calls = [];
const sandbox = {
  console,
  tx: (text) => text,
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
  const why = sandbox.ui.field.emailWhy;
  check(why('') === '' && why('a@b.example') === '' && why('ravi.k+x@shop.com.au') === '', 'a real address, or none yet, has no complaint');
  check(/not an email/.test(why('not-an-email')) && /not an email/.test(why('a@b')) && /no spaces/.test(why('a b@c.example')) && /not an email/.test(why('a@@b.example')), 'no @, no dotted host, a space, two @: each is refused in words');
  sandbox.REG = { step: 'form', shop: 'Walk S Coffee', name: '', email: '', busy: false, err: '' };
  sandbox.CBRegistration.mount(host, () => {});
  typed.r_shop = 'Walk S Coffee'; typed.r_name = 'walks-coffee-au'; typed.r_email = 'not-an-email';
  await sandbox.doRegister();
  check(calls.length === 0 && /not an email/.test(sandbox.REG.err), 'Register with "not-an-email": no call, the sentence says why');
  typed.r_email = 'a@b.example';
  await sandbox.doRegister();
  check(calls.length === 1 && calls[0].name === 'register', 'a good address goes on to the register call');
  sandbox.REG = { step: 'code', shop: 'x', name: 'walks-coffee-au', email: 'a@b.example', busy: false, err: '' };
  painted.length = 0;
  sandbox.CBRegistration.mount(host, () => {});
  const otp = (host.innerHTML.match(/<input[^>]* id="r_otp"[^>]*>/) || [''])[0];
  check(/data-testid="reg-otp"/.test(otp) && /maxlength="320"/.test(otp), 'the code box (reg-otp) takes the long tester code, not 6 characters');
  process.exit(failures ? 1 : 0);
})();
