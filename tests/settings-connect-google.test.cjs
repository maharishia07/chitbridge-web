/**
 * tests/settings-connect-google.test.cjs — SSO-1130: the Settings › Sign-in "Connect Google" row (public/app/cap-settings.js, provRow..readProv) and its three api doors
 * (public/app/accounts-shell.js), read as source, no browser (the row's closures are not exported).
 *   · the row says WHICH Google account is connected (the e-mail the api returns), never a subject or issuer
 *   · Connect and Disconnect each carry the person's PIN (the api re-proves it) and each has its control id (ACC002-B62 / B63) and the PIN box (ACC002-I31)
 *   · both buttons are greyed with a sentence, never hidden and never a dead click: not switched on · not accepted by the business · no PIN yet · loading · error
 *   · Disconnect asks first; the api doors are the three declared ones; no door is called on a link the person did not list
 *   · a link is never made from the page: the page only follows the address the api gives (window.location.assign(url)); the result word and the confirm code are read by CBSignin.takeLanded
 * Run: node tests/settings-connect-google.test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let pass = 0, fail = 0;
const check = (what, fn) => {
  try { fn(); pass++; console.log('  ok   ' + what); } catch (failure) { fail++; console.log('  FAIL ' + what + '\n       ' + String(failure && failure.message).split('\n')[0]); }
};
const settings = read('public/app/cap-settings.js');
const start = settings.indexOf('function provRow()');
const end = settings.indexOf('function readProv()');
assert.ok(start > 0 && end > start, 'the connect row is in cap-settings.js');
const row = settings.slice(start, end + 400);
const shell = read('public/app/accounts-shell.js');

check('the row shows which Google account is connected (its e-mail), not a subject or issuer', () => {
  assert.ok(/row\.link\.email/.test(row) && /T\('Connected'\)/.test(row) && /T\('Not connected'\)/.test(row));
  assert.ok(!/\.subject|\.issuer|subject_alt/.test(row), 'the row never reads a subject or issuer');
});
check('Connect and Disconnect are library buttons with control ids, and the PIN box has its id', () => {
  assert.ok(/btn\('sx_prov_off'.*?'ACC002-B62'\)/.test(row) && /btn\('sx_prov_on'.*?'ACC002-B63'\)/.test(row) && /data-cbsid="ACC002-I31"/.test(row));
});
check('both carry the PIN in the body (the api re-proves it) and run through CBAction', () => {
  assert.ok(/api\('providerLinkStart', \{ body: \{ provider: 'google', pin: pinOf\(\)/.test(row));
  assert.ok(/api\('providerUnlink', \{ params: \{ link_id: row\.link\.link_id \}, body: \{ pin: pinOf\(\) \} \}\)/.test(row));
  assert.strictEqual((row.match(/CBAction\.run\(/g) || []).length, 2);
});
check('greyed with a sentence in every state that cannot work (not on, not accepted, no PIN, loading, error)', () => {
  for (const words of ['Google sign-in is being switched on.', 'This business does not accept Google sign-in.', 'Set a PIN first.', 'Checking.', 'Could not read this. Try again.']) {
    assert.ok(row.includes("T('" + words + "')"), words);
  }
  assert.ok(/row\.host\.live !== true/.test(row) && /row\.reproof === 'code'/.test(row));
});
check('Disconnect asks first, in words, with a danger yes', () => {
  assert.ok(/confirm: \{ title: T\('Disconnect Google\?'\)/.test(row) && /danger: true/.test(row));
});
check('the page only follows the address the api gives; it writes no link itself', () => {
  assert.ok(/window\.location\.assign\(url\)/.test(row));
  assert.ok(!/providerLinkFinish/.test(row), 'the confirm code is spent by the sign-in landing code, not by this row');
});
check('the three doors are declared once, with the right method and path', () => {
  assert.ok(/providerLinks: \{ m: 'GET', p: '\/api\/signin\/provider\/links'/.test(shell));
  assert.ok(/providerLinkStart: \{ m: 'POST', p: '\/api\/signin\/provider\/link\/start'/.test(shell));
  assert.ok(/providerLinkFinish: \{ m: 'POST', p: '\/api\/signin\/provider\/link\/finish'/.test(shell));
  assert.ok(/providerUnlink: \{ m: 'DELETE', p: '\/api\/signin\/provider\/links\/:link_id'/.test(shell));
});
check('every result word the api can answer has a sentence in the sign-in window', () => {
  const ui = read('public/app/signin-provider.js'); /* the provider words moved out of signin-ui.js (1129 split) */
  for (const code of ['LINK_EXISTS', 'SIGNIN_REFUSED', 'SIGNIN_UNAVAILABLE', 'LINK_CONFIRM_FAILED', 'SIGNIN_PROVIDER_NOT_ACCEPTED']) assert.ok(new RegExp(code + ':').test(ui), code);
  assert.ok(/linked: 'Connected\./.test(ui));
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
