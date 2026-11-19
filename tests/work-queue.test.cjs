/* tests/work-queue.test.cjs — UNIT 01-rail-core-the-chit/assign: the ONE work-queue capability (CBAssign.queue) as Tasks mounts it, and the sign-in line of Add a person.
 * Pure: a fake window, no browser. Walk 19 Nov rows W11 (ticks cleared after an assign), W14 (the line follows the typed sign-in name), W16/W17 (an employee opens on Mine; the owner on Everyone). */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const app = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8').replace(/\}\)\(typeof window[^\n]*$/, '})(window);');
let ok = 0;
const pass = (what) => { ok++; console.log('  ok  ' + what); };
const resets = [];
function world(sessionId) {
  const win = { esc: (s) => String(s), tx: (s) => s, localStorage: { getItem: (k) => (k === 'cb_sess' ? JSON.stringify({ actor_id: sessionId, token: 't' }) : null) }, Promise, setTimeout, clearTimeout, location: { hostname: "localhost", origin: "http://localhost" }, CBList: { reset: (k, only) => resets.push([k, only]) } };
  new Function('window', app('assign-bar.js'))(win);
  new Function('window', app('cap-tasks-assign.js'))(win);
  return win;
}
const row = (id, who, may) => ({ chit_id: id, assignee: who ? { id: who, name: who.toUpperCase() } : null, may_assign: may });

// an employee (a1): Mine first, the bar says Assign to me, the Held by filter reads Unassigned · Mine · people
{
  const win = world('a1'), board = { view: 'tasks', rows: [row('c1', 'a1', false), row('c2', 'a2', false), row('c3', null, false)] };
  const q = win.CBTasksAssign.queue(board, () => null);
  assert.deepStrictEqual(q.preset, { filt: { held: 'mine' } });
  assert.deepStrictEqual(q.views.items.map((v) => v.label), ['Mine', 'Unassigned', 'Everyone']);
  assert.strictEqual(q.bulkAlways, true);
  assert.deepStrictEqual(q.bulk.map((b) => b.label), ['Assign to me', 'Assign to…', 'Hand over', 'Back to pool']);
  assert.deepStrictEqual(q.filter.options.map((o) => o.v), ['none', 'mine', 'a1', 'a2']);
  assert(q.filter.match(board.rows[0], 'mine') && !q.filter.match(board.rows[1], 'mine') && q.filter.match(board.rows[2], 'none'));
  pass('an employee opens on Mine, with Mine · Unassigned · Everyone and the bar Assign to me first');
  assert.strictEqual(win.CBTasksAssign.queue(board, () => null).preset, undefined);
  pass('the opening view is given once: a later paint keeps what the person chose');
}
// the owner (the server says may_assign on the rows): Everyone
{
  const win = world('own'), q = win.CBTasksAssign.queue({ view: 'tasks', rows: [row('c1', 'a2', true), row('c2', null, true)] }, () => null);
  assert.deepStrictEqual(q.preset, { filt: {} });
  pass('the owner opens on Everyone (Assigned and Unassigned)');
}
// W11: the ticks go after the assign, the filters stay
{
  const win = world('a1');
  const opts = { key: 'k1', rows: [{ holders: [] }], said: true, plug: 'task', noun: 'task', subjectOf: (r) => r.id, roleOf: () => '', reload: () => null };
  assert.strictEqual(win.CBAssign.queue(opts).bulk.length, 4);
  const src = app('assign-bar.js');
  assert(/CBList\.reset\(opts\.listKey, true\)/.test(src) && /listKey: q\.key/.test(src));
  pass('the queue hands its list key to every call; the ticks are cleared (reset(key, true)) before the list repaints');
}
// W12: Undo puts back each COPY's own previous holder (a mixed batch: 3 copies held by Priya, 2 unassigned)
{
  const calls = [], listeners = {};
  const win = world('a1');
  win.document = { addEventListener: (t, f) => { listeners[t] = f; }, getElementById: () => null }; win.clearTimeout = clearTimeout;
  const previous = [{ chit_id: 'k1', subject_id: 's1', actor_id: 'priya' }, { chit_id: 'k2', subject_id: 's1', actor_id: 'priya' }, { chit_id: 'k3', subject_id: 's2', actor_id: 'priya' }, { chit_id: 'k4', subject_id: 's3', actor_id: null }, { chit_id: 'k5', subject_id: 's3', actor_id: null }];
  win.fetch = (url, init) => { const body = JSON.parse(init.body); calls.push(body); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(calls.length === 1 ? { assigned: 5, skipped: [], previous } : { assigned: 5, skipped: [] }) }); };
  const opts = { key: 'k', rows: [{ holders: [{ actor_id: 'priya', name: 'Priya' }] }], said: true, plug: 'client', noun: 'client', subjectOf: (r) => r.sid, roleOf: () => 'adviser', reload: () => null };
  const bar = win.CBAssign.queue(opts).bulk, pool = bar.filter((b) => b.id === 'pool')[0];
  pool.run([{ sid: 's1', holders: [1] }, { sid: 's2', holders: [1] }, { sid: 's3', holders: [1] }]).then(() => {
    const undone = listeners.click({ target: { closest: (sel) => (sel === '[data-as-undo]' ? {} : null) } });
    return Promise.resolve(undone).then(() => new Promise((r) => setTimeout(r, 20)));
  }).then(() => {
    const back = calls.slice(1);
    assert.deepStrictEqual(back.map((b) => [b.target_actor_id, b.chit_ids]), [['priya', ['k1', 'k2', 'k3']], [null, ['k4', 'k5']]]);
    pass('Undo puts each copy back to its own previous holder (per copy, by chit id)');
  }).catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });
}
// W14: the line follows the typed sign-in name, whole
{
  const win = { tx: (s) => s };
  new Function('window', app('cap-employees-copy.js'))(win);
  const input = { value: '' }, note = { textContent: '' };
  const watch = win.CBEmployeesCopy.watchKey(input, note, () => Promise.resolve({ suggested_key: 'arjunm', login_format: 'arjunm@bayside-books-au.br' }), (s) => s);
  watch.ask('Arjun M', (r) => { input.value = r.suggested_key; }).then(() => {
    assert.strictEqual(note.textContent, 'They sign in as arjunm@bayside-books-au.br');
    input.value = 'ArjunBay'; input.oninput();
    assert.strictEqual(note.textContent, 'They sign in as arjunbay@bayside-books-au.br');
    assert(watch.typed());
    pass('the hint follows the typed sign-in name and keeps the full suffix');
    console.log(ok + ' passed');
  }).catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });
}
