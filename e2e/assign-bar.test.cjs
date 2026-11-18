/* e2e/assign-bar.test.cjs — public/app/assign-bar.js and public/app/actor-hat.js: who holds the work, the bulk buttons, and what the person reads when the server says no
 * OWNS      the unit proof for public/app/assign-bar.js (CBAssign.showsBar · heldBy · heldByText · hasHolders · bulk) and public/app/actor-hat.js (hatAssignable · jobAssignable · actorHatFields):
 *           the bar is shown to the owner or a manager only, a row with no holders key shows nothing, a refusal is the server's own sentence, a call that cannot be read says so in words,
 *           every label goes through the string layer (tx), and the styles it injects are tokens (cream and dark, 1366 and 390 wide, AA contrast, no colour of its own)
 * CALLED BY node e2e/assign-bar.test.cjs (offline, no browser: a fake window and a fake api; the browser walk of the same module is e2e/walk-assign-bulk.cjs)
 * FLOW      load the module into a fake window → call it with rows and a fake fetch → read what the page would show and which calls were made
 * CARD      01-rail-core-the-chit/assign
 * MIN walk (the browser walk of the module is e2e/walk-assign-bulk.cjs, 100 checks on a mocked api at 1366 and 390, light and dark; this file drives the same functions without a browser)
 * MIN cream-and-dark-1366-390
 * MIN aa-contrast
 * MIN could-not-read-words
 * MIN string-layer
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const BAR = 'public/app/assign-bar.js';
const HAT = 'public/app/actor-hat.js';
const text = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0;
const check = (ok, what) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + what);
  if (!ok) failures++;
};
const SERVER_SENTENCE = 'Only the partner or a manager can assign clients.';

/** a fake window: storage, a document that remembers its result slot, a fetch that answers from `answers` and records every call */
function fakeWindow(session, answers) {
  const calls = [];
  const store = { cb_sess: JSON.stringify(session) };
  const slot = { className: '', hidden: true, innerHTML: '' };
  const quiet = [];
  const win = {
    localStorage: { getItem: (key) => (key in store ? store[key] : null) },
    location: { hostname: 'localhost' },
    document: { getElementById: (id) => (id === 'as_result' ? slot : null), head: { appendChild() {} }, createElement: () => ({}) },
    esc: (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    tx: (value) => 'T(' + value + ')',
    cbQuiet: (where, failure) => quiet.push(where + ':' + (failure && failure.message)),
    Promise,
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    fetch: (url, init) => {
      calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
      const answer = answers.shift() || { ok: true, status: 200, json: () => Promise.resolve({}) };
      return Promise.resolve(answer);
    }
  };
  vm.runInNewContext(text(BAR), { window: win, globalThis: win }, { filename: BAR });
  return { win, calls, slot, quiet };
}
const reply = (ok, body) => ({ ok, status: ok ? 200 : 403, json: () => Promise.resolve(body) });
const tokenWith = (payload) => 'h.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.s';
const ownerWindow = (answers) => fakeWindow({ role: 'entity', token: 't' }, answers || []);
const heldRow = { id: 'a', role: 'adviser', holders: [{ name: 'X' }] };
/** the buttons do not return their promise: let the fake network and the reload run */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const poolOf = (opts, fake) => fake.win.CBAssign.bulk(opts).find((button) => button.id === 'pool');

(async function main() {
  const owner = ownerWindow();
  const manager = fakeWindow({ role: 'actor', token: tokenWith({ hat: 'Manager' }) }, []);
  const assistant = fakeWindow({ role: 'actor', token: tokenWith({ hat: 'act' }) }, []);
  /* A2 (18 Nov): the bar is shown on the SERVER's verdict only; a token (hat Manager included) and a role are never read */
  check(owner.win.CBAssign.showsBar() === false && manager.win.CBAssign.showsBar() === false && assistant.win.CBAssign.showsBar() === false, 'with no server verdict nobody is shown the bar: the token and the role say nothing');
  check(manager.win.CBAssign.showsBar(true) === true && owner.win.CBAssign.showsBar(false) === false && assistant.win.CBAssign.showsBar(true) === true, "the server's verdict alone decides (a manager the server approves sees it, an owner it refuses does not)");
  check(manager.quiet.length === 0, 'no token is read, so nothing is logged');
  check(assistant.win.CBAssign.bulk({}).length === 0 && manager.win.CBAssign.bulk({ plug: 'p', said: true }).length === 4, 'bulk gives four buttons when the server said yes and none when it said nothing');

  check(owner.win.CBAssign.heldBy({ holders: [{ name: 'Anna <Lee>' }, { name: 'Ben' }] }) === 'Anna &lt;Lee&gt;, Ben', 'Held by lists the names the server sent, escaped');
  check(owner.win.CBAssign.heldBy({ holders: [] }) === '<span class="as-none">T(Unassigned)</span>', 'an empty holders list reads Unassigned through the string layer (tx)');
  check(owner.win.CBAssign.heldBy({}) === '' && owner.win.CBAssign.heldByText(null) === '', 'a row with no holders key (the switch is off) shows nothing');
  check(owner.win.CBAssign.heldByText({ holders: [] }) === 'T(Unassigned)', 'the plain-text column says Unassigned through the string layer');
  check(owner.win.CBAssign.hasHolders([{}, { holders: [] }]) === true && owner.win.CBAssign.hasHolders([{}]) === false, 'hasHolders is true only when a row carries the key');

  const reloads = [];
  const opts = { said: true, plug: 'p', subjectOf: (row) => row.id, roleOf: (row) => row.role, reload: () => reloads.push(1) };
  const refused = ownerWindow([reply(false, { detail: SERVER_SENTENCE })]);
  poolOf(opts, refused).run([heldRow]);
  await settle();
  check(refused.slot.innerHTML.includes(SERVER_SENTENCE) && refused.slot.className.includes('as-bad'), "a refused call shows the server's own sentence, in the bad tone");
  check(reloads.length === 1, 'the list reloads after a refusal');

  const unreadableAnswer = ownerWindow([{ ok: false, status: 500, json: () => Promise.reject(new Error('not json')) }]);
  poolOf(opts, unreadableAnswer).run([heldRow]);
  await settle();
  check(
    unreadableAnswer.slot.innerHTML.includes('T(Not done.)') && unreadableAnswer.quiet.some((line) => line.startsWith('assign:json')),
    'an answer that could not be read says "Not done." in words and goes to cbQuiet'
  );

  const skipSentence = 'No job is open for this client and role.';
  const partial = ownerWindow([reply(true, { assigned: 1, skipped: [{ reason: skipSentence }, { reason: skipSentence }] })]);
  poolOf(opts, partial).run([heldRow]);
  await settle();
  check(partial.slot.innerHTML.includes('2 · ' + skipSentence) && partial.slot.innerHTML.includes('1 T(client back in pool.)'), 'skips are grouped by the server sentence with a count, and the done count goes through tx');
  check(partial.calls[0].body.target_actor_id === null && partial.calls[0].body.subject_ids[0] === 'a', 'back to pool sends target null and the row subject ids');

  const noHolder = ownerWindow();
  await noHolder.win.CBAssign.bulk(opts).find((button) => button.id === 'handover').run([{ id: 'a', role: 'adviser', holders: [] }]);
  check(noHolder.slot.innerHTML.includes('T(No ticked client has a holder.)') && noHolder.calls.length === 0, 'hand over with no holder among the ticked rows says so in words and calls nothing');

  const source = text(BAR);
  const sheet = source.slice(source.indexOf('function injectStyles'), source.indexOf('/** the people who may hold'));
  const bareColours = [...sheet.matchAll(/(?:color|background|border-color):\s*(?!var\()[^;}]*/g)].filter((hit) => !/inherit|transparent/.test(hit[0]));
  check(/var\(--/.test(sheet) && bareColours.length === 0, 'every colour in the sheet is a design token (var(--x, fallback)): cream and dark follow the theme, no colour of its own');
  check(/min\(420px,calc\(100vw - 24px\)\)/.test(sheet) && /min-height:44px/.test(sheet), 'the picker fits 390 wide (100vw - 24px) and 1366, with 44px touch targets');
  check(/var\(--on-accent,#fff\)/.test(sheet) && /var\(--accent,#1F4E8C\)/.test(sheet), 'the primary button text is the on-accent token over the accent token (AA contrast is measured on both themes in the browser walk)');

  const context = { accessLevelOf: (value) => (value === 'view' ? 'commenter' : 'editor') };
  vm.runInNewContext(text(HAT) + '\nthis.out = { hatAssignable, jobAssignable, actorHatFields };', context);
  const hatApi = context.out;
  check(hatApi.hatAssignable({ assignable: false, hat: 'act' }) === false && hatApi.hatAssignable({ assignable: true, hat: 'view' }) === true, "hatAssignable takes the server's flag over the hat");
  check(hatApi.hatAssignable('view') === false && hatApi.hatAssignable({ hat: 'act' }) === true, 'a bare hat, or an actor with no flag, falls back to the editor test');
  check(hatApi.jobAssignable({ jobAssignable: true }) === true && hatApi.jobAssignable({}) === false && hatApi.jobAssignable('x') === false, 'jobAssignable is true only when the server said so');
  const fields = hatApi.actorHatFields({ hat: 'manager', assignable: true, job_assignable: true });
  check(fields.hat === 'manager' && fields.assignable === true && fields.jobAssignable === true, 'actorHatFields maps the hat and both flags');
  const empty = hatApi.actorHatFields({});
  check(empty.hat === 'act' && empty.assignable === undefined && empty.jobAssignable === false, 'a row with none of them gets hat act, no assignable answer, and jobAssignable false');

  console.log(failures ? '\nFAIL ' + failures : '\nall ok');
  process.exit(failures ? 1 : 0);
})();
/* A2 + A5 (18 Nov), on the source itself: no token read, and the person picker starts on a prompt with Assign off */
(function sourceChecks() {
  const src = text(BAR);
  check(!/atob|payload\.hat|hatOfToken/.test(src), 'assign-bar.js reads no token and no hat');
  check(/Choose a person/.test(src) && /assign-go[^]{0,260}' disabled>'/.test(src), 'the picker pre-chooses nobody: a prompt option, and the Assign button off until a person is picked');
})();
