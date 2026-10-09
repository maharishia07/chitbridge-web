/**
 * tests/bell-line.test.cjs — O3: a NEW incoming order's bell row says "sent a new order", shows the amount and is in LOCAL time (never "delivered", never UTC text).
 * Run: node tests/bell-line.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
process.env.TZ = 'Asia/Kolkata';
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, documentElement: { appendChild() {} }, addEventListener() {} };
eval(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'rail-bell.js'), 'utf8'));
const L = globalThis.CBBell.line;
const o = L({ action: 'delivered', purpose: 'order', direction: 'received', action_by_display_name: 'athi', auto_subject: 'Order from athi — 09 Oct 2026',
  created_at: '2026-10-09T10:25:00.000Z', chit_id: 'c1', total_value: '90', currency_code: 'INR', order_channel: 'online', order_fulfilment: 'delivery' });
assert.strictEqual(o.say, 'sent a new order'); assert(!/deliver(ed)?\b/i.test(o.say), 'must not say delivered');
assert(/90/.test(o.d) && /Online/.test(o.d) && /Delivery/.test(o.d), 'amount and how: ' + o.d);
assert(/3:55|03:55/.test(o.s) && !/10:25/.test(o.s), 'local time (IST 15:55), got ' + o.s);
const r = L({ action: 'delivered', purpose: 'invoice', direction: 'received', action_by_display_name: 'x', auto_subject: 'Bill', created_at: '2026-10-09T10:25:00Z', chit_id: 'c2' });
assert.strictEqual(r.say, 'delivered', 'other rows keep their words');
console.log('bell-line: all ok');
