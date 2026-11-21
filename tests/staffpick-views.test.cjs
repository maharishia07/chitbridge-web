/* tests/staffpick-views.test.cjs — STAFFPICK (Athi 21 Nov): a staff seat of the practice sees Mine and Unassigned only (never Everyone) and the take button reads "Pick up";
 * the partner and a manager keep Mine · Unassigned · Everyone and "Assign to me". Pure: a fake window, no browser.
 * HAND-COMPUTED  staff (may_assign false, may_take true) → views [Mine, Unassigned], first bulk button "Pick up", opens on Mine, bar of one button (the server says may_assign false);
 *                partner (may_assign true) → [Mine, Unassigned, Everyone], first button "Assign to me", opens on Everyone; a list that never says staff (Tasks) keeps all three. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'assign-bar.js'), 'utf8').replace(/\}\)\(typeof window[^\n]*$/, '})(window);');
let ok = 0;
const check = (what, fn) => { fn(); ok++; console.log('  ok   ' + what); };
const win = { esc: (s) => String(s), tx: (s) => s, localStorage: { getItem: (k) => (k === 'cb_sess' ? JSON.stringify({ actor_id: 'a1', token: 't' }) : null) }, Promise, setTimeout, clearTimeout, location: { hostname: 'localhost', origin: 'http://localhost' }, CBList: { reset() {} } };
new Function('window', src)(win);
const rows = [{ entity_id: 'c1', holders: [{ actor_id: 'a1', name: 'A' }] }, { entity_id: 'c2', holders: [] }];
const base = { key: 'k', rows, plug: 'client', noun: 'client', subjectOf: (r) => r.entity_id, roleOf: () => 'adviser', reload: () => null };
const staff = win.CBAssign.queue(Object.assign({ said: false, take: true, everyone: false, staff: true }, base));
const partner = win.CBAssign.queue(Object.assign({ said: true, take: false, everyone: true }, base));
const tasks = win.CBAssign.queue(Object.assign({ said: false, take: true, everyone: false }, base));
check('staff: the views are Mine and Unassigned, Everyone is not offered', () => assert.deepStrictEqual(staff.views.items.map((v) => v.label), ['Mine', 'Unassigned']));
check('staff: opens on Mine and the one bulk button is Pick up', () => { assert.deepStrictEqual(staff.preset, { filt: { held: 'mine' } }); assert.deepStrictEqual(staff.bulk.map((b) => b.label), ['Pick up']); });
check('the partner: Mine · Unassigned · Everyone, Assign to me first, opens on Everyone', () => { assert.deepStrictEqual(partner.views.items.map((v) => v.label), ['Mine', 'Unassigned', 'Everyone']); assert.strictEqual(partner.bulk[0].label, 'Assign to me'); });
check('a list that never says staff (Tasks) keeps all three views and Assign to me', () => { assert.strictEqual(tasks.views.items.length, 3); assert.strictEqual(tasks.bulk[0].label, 'Assign to me'); });
console.log(ok + ' checks');
