/* tests/delegate-in-place.test.cjs: ACC-374 — Accounts > Delegate work mounts the People "What they can do" panel IN PLACE: one component (cap-employees.js accessPanel),
 * no redirect, the same GET /api/people choices and the same PATCH /api/actors/:id. Real cap-employees.js + cap-employees-give.js, stub DOM and fetch.
 * CARD 17-people-employees-hr-and-payroll/pin-otp-first-sign-in */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
const nodes = {}, calls = [], navigated = [];
const node = (id) => (nodes[id] = nodes[id] || { id, innerHTML: '', textContent: '', onclick: null, onchange: null, value: '' });
const choices = [{ key: 'view', label: 'Reads only', why: 'sees, never changes', level: 'viewer', whole_entity: true, can_see_costs: false }, { key: 'work', label: 'Does the work', why: 'enters and posts', level: 'editor', whole_entity: true, can_see_costs: false }];
const people = [{ id: 'p1', name: 'Asha', state: 'on', access: { label: 'Reads only' } }, { id: 'p2', name: 'Off Person', state: 'off', access: { label: 'Reads only' } }];
const ctx = {
  console, Promise, encodeURIComponent, tx: (s) => s, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), scrErr: (e) => 'ERR ' + e.message,
  fetch: (url, o) => { calls.push({ url, method: o.method, body: o.body && JSON.parse(o.body) }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(o.method === 'GET' ? { people, access_choices: choices, may: { add: { ok: true } }, counts: { on: 1, off: 1 } } : {}) }); },
  CBAction: { run: (btn, fn, opts) => fn().then(() => opts.outcome && opts.outcome()) },
};
ctx.window = ctx; ctx.location = { set href(v) { navigated.push(v); }, get href() { return ''; } };
ctx.document = { getElementById: (id) => node(id), querySelector: (q) => (q === 'input[name="emp_lvl"]:checked' ? { value: '1' } : null), addEventListener() {} };
vm.createContext(ctx);
for (const f of ['cap-employees-copy.js', 'cap-employees.js', 'cap-employees-give.js']) vm.runInContext(src(f), ctx, { filename: f });
(async () => {
  const host = node('host');
  await ctx.CBEmployees.mountAccess(host, { token: 't', base: '' });
  assert.ok(host.innerHTML.includes('emp_give_who') && host.innerHTML.includes('Asha') && !host.innerHTML.includes('Off Person'), 'the picker lists the people who are on');
  const pick = node('emp_give_who'); pick.value = 'p1'; pick.onchange.call(pick);
  assert.ok(node('emp_more').innerHTML.includes('emp-level-work') && node('emp_more').innerHTML.includes('emp_access_go'), 'the panel opens in place with the server\'s choices');
  await node('emp_access_go').onclick();
  await new Promise((r) => setTimeout(r, 0));
  const patch = calls.filter((c) => c.method === 'PATCH')[0];
  assert.ok(patch && patch.url === '/api/actors/p1' && patch.body.access_level === 'editor' && patch.body.hat === 'act', 'Save sends the ONE PATCH /api/actors/:id with the picked preset');
  assert.deepStrictEqual(navigated, [], 'no redirect');
  assert.strictEqual(node('emp_out').textContent, 'Saved.', 'the person is told, on the same screen');
  console.log('  ok  Delegate work: picker, panel, one PATCH, no redirect');
})().catch((e) => { console.error(e); process.exit(1); });
