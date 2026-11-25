'use strict';
/* L-F-09 / L-F-10 (21 Nov, UAE walk L): on the Tasks & Orders sheet
   · the one refusal sentence three or more step buttons share ("Only the copy you received moves through these steps.") is said ONCE, not five times;
     a sentence shared by two, or all different, stays beside its own button
   · a task's line (a credit note, a to-do) never offers Deliver and never counts Delivered / left — nothing moves; an order's line still does
   Run: node tests/tasks-sheet-words.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const node = () => new Proxy({ style: {}, classList: { add() {}, remove() {} }, addEventListener() {} }, { get: (t, k) => (k in t ? t[k] : () => node()), set: (t, k, v) => { t[k] = v; return true; } });
const cx = vm.createContext({ console, esc: (s) => String(s == null ? '' : s), tx: (s) => s, document: { getElementById: () => node() }, EP: {}, CBList: { mount: () => ({}) }, api: () => Promise.resolve({}) });
cx.window = cx; cx.globalThis = cx;
cx.CBAssign = { chip: () => '', slotHTML: () => '', queue: () => ({ views: [], filter: { key: 'assignee', match: () => true } }) };
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-tasks-assign.js', 'utf8'), cx);
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-tasks-words.js', 'utf8'), cx); /* the row wording, loaded before cap-tasks.js as tasks.html does */
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-tasks.js', 'utf8'), cx);
const T = cx.CBTasks;
const S = 'Only the copy you received moves through these steps.';
const no = (say) => ({ ok: false, say });
assert.strictEqual(T.repeatedWhy({ accept: no(S), reject: no(S), complete: no(S), cancel: no(S), reopen: no(S) }), S, 'five the same → said once');
assert.strictEqual(T.repeatedWhy({ accept: no(S), reject: no(S), complete: no('Already done'), cancel: { ok: true }, reopen: no('x') }), '', 'two the same stay on their buttons');
const hid = T.actRow('tk_do_accept', 'Accept', no(S), '', '', 'X', true);
assert.ok(hid.includes('disabled') && hid.includes('title="' + S + '"') && !hid.includes('tk_do_accept-why'), 'hidden why: still greyed, the sentence stays as its tooltip');
const line = { line_id: 'l1', particulars: 'Credit', qty: 1, unit: '', delivered: 0, remaining: 1, actions: { assign_line: { ok: true }, deliver_line: { ok: true } }, settings: {} };
const task = T.lineHTML(line, { kind: 'task', chit_id: 'c' }), order = T.lineHTML(line, { kind: 'order_in', chit_id: 'c' });
assert.ok(!/Deliver|left/.test(task), 'a task line: no Deliver, no counts: ' + task.replace(/<[^>]+>/g, ' '));
assert.ok(/tk_lv_l1/.test(order) && /left/.test(order), 'an order line still delivers');
console.log('tasks-sheet-words: all ok');
