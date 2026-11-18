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
  const slot = { className: '', hidden: true, innerHTML: '', style: '', setAttribute(name, value) { if (name === 'style') this.style = value; } };
  const quiet = [];
  const win = {
    localStorage: { getItem: (key) => (key in store ? store[key] : null) },
    location: { hostname: 'localhost' },
    document: { getElementById: (id) => (id === 'as_result' ? slot : null), head: { appendChild() {} }, createElement: () => ({}) },
    esc: (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    tx: (value) => 'T(' + value + ')',
    cbQuiet: (where, failure) => quiet.push(where + ':' + (failure && failure.message)),
    Promise,
    setTimeout: () => 0,
    clearTimeout() {},
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
  check(assistant.win.CBAssign.bulk({}).length === 0 && manager.win.CBAssign.bulk({ plug: 'p', said: true }).length === 3, 'bulk gives three buttons (Assign to… · Hand over · Back to pool) when the server said yes and none when it said nothing');
  check(!manager.win.CBAssign.bulk({ plug: 'p', said: true }).some((button) => button.id === 'open'), 'there is no Open jobs button: the server opens the job (I8)');

  check(owner.win.CBAssign.heldBy({ holders: [{ name: 'Anna <Lee>' }, { name: 'Ben' }] }) === 'Anna &lt;Lee&gt;, Ben', 'Held by lists the names the server sent, escaped');
  check(owner.win.CBAssign.heldBy({ holders: [] }) === '<span style="color:var(--grey,#5B5B5B)">T(Unassigned)</span>', 'an empty holders list reads Unassigned through the string layer (tx)');
  check(owner.win.CBAssign.heldBy({}) === '' && owner.win.CBAssign.heldByText(null) === '', 'a row with no holders key (the switch is off) shows nothing');
  check(owner.win.CBAssign.heldByText({ holders: [] }) === 'T(Unassigned)', 'the plain-text column says Unassigned through the string layer');
  check(owner.win.CBAssign.hasHolders([{}, { holders: [] }]) === true && owner.win.CBAssign.hasHolders([{}]) === false, 'hasHolders is true only when a row carries the key');

  const reloads = [];
  const opts = { said: true, plug: 'p', subjectOf: (row) => row.id, roleOf: (row) => row.role, reload: () => reloads.push(1) };
  const refused = ownerWindow([reply(false, { detail: SERVER_SENTENCE })]);
  poolOf(opts, refused).run([heldRow]);
  await settle();
  check(refused.slot.innerHTML.includes(SERVER_SENTENCE) && refused.slot.style.includes('--bad'), "a refused call shows the server's own sentence, in the bad tone");
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
  check(partial.slot.innerHTML.includes('2 · ' + skipSentence) && partial.slot.innerHTML.includes('T(1 T(client) back in the pool.)'), 'skips are grouped by the server sentence with a count, and the done count goes through tx');
  check(partial.calls[0].body.target_actor_id === null && partial.calls[0].body.subject_ids[0] === 'a', 'back to pool sends target null and the row subject ids');

  const noHolder = ownerWindow();
  await noHolder.win.CBAssign.bulk(opts).find((button) => button.id === 'handover').run([{ id: 'a', role: 'adviser', holders: [] }]);
  check(noHolder.slot.innerHTML.includes('T(Nothing ticked has a holder to hand over from.)') && noHolder.calls.length === 0, 'hand over with no holder among the ticked rows says so in words and calls nothing');

  const source = text(BAR);
  /* ASSIGN-W2 (A10): no style sheet and no <dialog> of its own; colours are theme tokens inline; the popover is the library popup (ui.dialog) */
  check(!/createElement\(['"](style|dialog)|showModal/.test(source), 'assign-bar.js injects no style sheet and builds no <dialog> of its own');
  const bareColours = [...source.matchAll(/(?:color|background|border-color):\s*(?!var\()[^;}'"]*/g)].filter((hit) => /#[0-9A-Fa-f]{3,6}/.test(hit[0]));
  check(bareColours.length === 0 && /var\(--card,#fff\)/.test(source), 'every colour is a design token (var(--x, fallback)): cream and dark follow the theme');
  check(/ui\.dialog\(/.test(source) && /POP212/.test(source), 'the person popover is ui.dialog (CMP002) with its register code');
  check(/min-height:44px/.test(source), 'the touch targets are 44px');

  /* the chip: the cell is the control, shown on the server's verdict only */
  const chipWin = ownerWindow();
  const chipOpts = { said: true, plug: 'client', noun: 'client', subjectOf: (row) => row.id, roleOf: (row) => row.role };
  const chipHtml = chipWin.win.CBAssign.chip({ id: 'a', role: 'adviser', holders: [{ name: 'Anna' }] }, chipOpts);
  check(/data-as-chip/.test(chipHtml) && /Anna ▾/.test(chipHtml) && /data-as-sub="a"/.test(chipHtml), 'a held row draws a chip with the name');
  check(/\+ T\(Assign to…\)/.test(chipWin.win.CBAssign.chip({ id: 'b', role: 'adviser', holders: [] }, chipOpts)), 'an empty row draws the action itself: + Assign to…');
  check(!/data-as-chip/.test(chipWin.win.CBAssign.chip({ id: 'a', role: 'adviser', holders: [] }, { ...chipOpts, said: false })), 'with no server verdict the cell is plain words, not a button');
  check(chipWin.win.CBAssign.chip({}, chipOpts) === '', 'a row with no holders key shows nothing');

  /* Undo reads the holders the server returned */
  const undoWin = ownerWindow([reply(true, { assigned: 2, skipped: [], previous: [{ chit_id: 'c1', subject_id: 'a', actor_id: 'ben' }, { chit_id: 'c2', subject_id: 'b', actor_id: null }] }), reply(true, { assigned: 2 })]);
  await poolOf(opts, undoWin).run([heldRow, { id: 'b', role: 'adviser', holders: [{ name: 'Y' }] }]);
  await settle();
  check(/data-as-undo/.test(undoWin.slot.innerHTML), 'the result line carries Undo when the answer returned the previous holders');
  const noPrev = ownerWindow([reply(true, { assigned: 1, skipped: [] })]);
  await poolOf(opts, noPrev).run([heldRow]);
  await settle();
  check(!/data-as-undo/.test(noPrev.slot.innerHTML), 'no previous holders in the answer, no Undo');

  /* L12: the one vocabulary, the quick views and the filter by person */
  const views = owner.win.CBAssign.quickViews();
  check(views.items.map((v) => v.label).join('|') === 'T(Mine)|T(Unassigned)|T(Everyone)' && views.merge === true, 'quick views: Mine · Unassigned · Everyone');
  const rowsHeld = [{ holders: [{ actor_id: 'ben', name: 'Ben' }] }, { holders: [] }, { holders: [{ actor_id: 'anna', name: 'Anna' }] }];
  const filter = owner.win.CBAssign.heldFilter(rowsHeld);
  check(filter.options.map((o) => o[0]).join(',') === 'none,mine,anna,ben', 'the Held by filter lists Unassigned, Mine and each person who holds a client');
  check(rowsHeld.filter((r) => filter.match(r, 'none')).length === 1 && rowsHeld.filter((r) => filter.match(r, 'ben')).length === 1 && rowsHeld.filter((r) => filter.match(r, 'mine')).length === 0, 'the filter matches Unassigned and a person by the server holder id');

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

  /* ASSIGN-W3 (18 Nov): Holds, My work, and a plug written by its own route (opts.write) */
  const holdsWin = ownerWindow([reply(true, { people: [{ actor_id: 'p1', name: 'Anna', total: 3, followups: 1, plugs: [{ plug: 'task', count: 2 }, { plug: 'followup', count: 1 }] }] }), reply(false, { detail: 'Only the partner or a manager can see this.' }), reply(true, { total: 2, plugs: [], rows: [] })]);
  const holdsOk = await holdsWin.win.CBAssign.holds();
  check(holdsOk.people.length === 1 && holdsOk.people[0].total === 3 && holdsWin.calls[0].url.endsWith('/api/chits/holds'), 'holds() reads GET /api/chits/holds and hands back the server counts');
  const holdsNo = await holdsWin.win.CBAssign.holds();
  check(holdsNo.people === null && holdsNo.why === 'Only the partner or a manager can see this.', "a seat that may not read holds gets the server's sentence and no people");
  const mine = await holdsWin.win.CBAssign.myWork(5);
  check(mine.total === 2 && holdsWin.calls[2].url.endsWith('/api/chits/my-work?limit=5'), 'myWork() reads GET /api/chits/my-work');
  const written = [];
  const writeWin = ownerWindow();
  const wopts = { plug: 'followup', noun: 'follow-up', said: true, subjectOf: (r) => r.id, roleOf: () => '', heldOf: (r) => !!r.held, reload: () => null, write: (ids, target) => { written.push([ids, target]); return Promise.resolve({ ok: true, assigned: ids.length, skipped: [], previous: ids.map((id) => ({ subject_id: id, actor_id: 'old' })) }); } };
  await writeWin.win.CBAssign.bulk(wopts).find((button) => button.id === 'pool').run([{ id: 'f1', held: true }, { id: 'f2', held: true }]);
  await settle();
  check(written.length === 1 && written[0][0].join() === 'f1,f2' && written[0][1] === null && writeWin.calls.length === 0, 'a plug with its own writer is written through opts.write, never through assign-bulk');

  console.log(failures ? '\nFAIL ' + failures : '\nall ok');
  process.exit(failures ? 1 : 0);
})();
/* A2 + A5 (18 Nov), on the source itself: no token read, and the person picker starts on a prompt with Assign off */
(function sourceChecks() {
  const src = text(BAR);
  check(!/atob|payload\.hat|hatOfToken/.test(src), 'assign-bar.js reads no token and no hat');
  check(!/selected disabled/.test(src), 'the popover pre-chooses nobody: every person is one press');
})();
