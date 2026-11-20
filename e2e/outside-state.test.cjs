'use strict';
// @type: unit
/**
 * outside-state.test.cjs - ERR-8: an action that needs an outside service (AI, mail, WhatsApp, speech) is greyed WITH the api's sentence and hint when that service is not connected.
 *
 * OWNS      the proof, on the real public/app/helpers.js (outsideLoad / outsideReason / outsideAttrs / outsideApply): the status is read once and kept (one api call for many buttons);
 *           state down or not_set_up -> the button carries `disabled` and the sentence + hint; connected, unknown or a failed read -> the button is not greyed (never grey on a guess);
 *           a late read greys an already drawn button and frees only what it greyed.
 * CALLED BY ci.yml (the unit checks): node e2e/outside-state.test.cjs
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/helpers
 */
const path = require('path'),
  fs = require('fs'),
  vm = require('vm'),
  assert = require('assert');
let calls = 0,
  reply;
const buttons = [];
const makeButton = (name) => {
  const attrs = { 'data-outside': name };
  return { disabled: false, title: '', getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => (attrs[k] = v), removeAttribute: (k) => delete attrs[k], attrs };
};
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  tx: (s) => s,
  api: () => (calls++, reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply)),
  document: { querySelectorAll: () => buttons }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'helpers.js'), 'utf8') + '\nthis.__T = { outsideLoad, outsideReason, outsideAttrs, outsideApply, OUTSIDE };', sandbox, { filename: 'helpers.js' });
const T = sandbox.__T;
const reset = () => {
  T.OUTSIDE.at = 0;
  T.OUTSIDE.byName = {};
  T.OUTSIDE.pending = null;
  calls = 0;
  buttons.length = 0;
};
const DOWN = { name: 'ai', state: 'down', code: 'CONNECTOR_DOWN', sentence: 'AI is not answering right now.', hint: 'Try again in a few minutes.' };
let ran = 0;
const ok = (n) => console.log('ok  ' + n) || ran++;

(async () => {
  /* 1 · down: the button is shown, disabled, and carries the sentence + hint */
  reset();
  reply = { connectors: [], outside: [DOWN, { connector: 'mail', state: 'connected', code: null, sentence: null, hint: null }] };
  const drawn = makeButton('ai');
  buttons.push(drawn);
  const before = T.outsideAttrs('ai'); /* the draw starts the one read; unknown yet, so not greyed */
  assert.ok(!/disabled/.test(before) && /data-outside="ai"/.test(before));
  await T.outsideLoad();
  assert.strictEqual(drawn.disabled, true);
  assert.strictEqual(drawn.title, 'AI is not answering right now. Try again in a few minutes.');
  const again = T.outsideAttrs('ai');
  assert.ok(/ disabled /.test(again) && /title="AI is not answering right now\. Try again in a few minutes\."/.test(again));
  ok('state down: the button is disabled and carries the sentence and the hint');

  /* 2 · connected and unknown names are not greyed; the read is kept (one call) */
  assert.strictEqual(T.outsideReason('mail'), null);
  assert.strictEqual(T.outsideReason('whatsapp'), null);
  await T.outsideLoad();
  assert.strictEqual(calls, 1);
  ok('connected or unknown: not greyed; many buttons share one read');

  /* 3 · a failed read greys nothing */
  reset();
  reply = new Error('network');
  await T.outsideLoad();
  assert.strictEqual(T.outsideReason('ai'), null);
  ok('a failed read greys nothing');

  /* 4 · back to connected frees only what the read greyed; a button the screen keeps disabled stays */
  reset();
  reply = { outside: [DOWN] };
  const kept = makeButton('ai');
  kept.disabled = true;
  buttons.push(drawn, kept);
  drawn.attrs['data-disabled'] = '1';
  drawn.disabled = true;
  T.OUTSIDE.byName = { ai: { name: 'ai', state: 'connected' } };
  T.outsideApply();
  assert.strictEqual(drawn.disabled, false);
  assert.strictEqual(kept.disabled, true);
  ok('connected again: frees only what this read greyed');
  console.log(ran + ' checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
