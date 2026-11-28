/**
 * tests/fw2-p1-period-1132.test.cjs — FW2-01 / FW2-02 (cold auditor walk 27 Nov): the firm's period control and what each read asks.
 * Hand figures: the shop day is 27 Nov 2026; FY27 Q2 is 1 Oct – 31 Dec 2026 (it has begun, it has not ended).
 *  FW2-01: the return reads the quarter that holds the day it is asked; the server ignores a day still to come (AT-03), so the Q2 pick must ask a day that has happened (27 Nov), never 31 Dec; a year keeps its end (the server's default stays).
 *  FW2-02: the P&L with a day typed inside the picked quarter reads 1 Oct – that day, not the year to date beside a control that says the quarter; a day outside the quarter, or the trial balance (as at), is as it was.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const FIXED = new Date('2026-11-27T05:00:00Z');
class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [FIXED])); } static now() { return FIXED.getTime(); } }
const root = { Date: FakeDate, String, Number, Array, Object, JSON, Math, console };
root.window = root; vm.createContext(root);
root.CBBooksGrantKit = { viewState: { day: '', period: null }, words: (w) => w, afterYearEnd: () => false };
root.esc = (x) => String(x); root.shopDay = (x) => x;
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public/app/books-grant-reports.js'), 'utf8'), root);
const kit = root.CBBooksGrantKit;
const by = (k) => kit.REPORTS.filter((r) => r.k === k)[0];
const q2 = { kind: 'custom', fy: null, from: '2026-10-01', to: '2026-12-31' };
const q1 = { kind: 'custom', fy: null, from: '2026-07-01', to: '2026-09-30' };
const year = { kind: 'year', fy: '2026-27', from: '2026-07-01', to: '2027-06-30' };
const ask = (k, period, day) => { kit.viewState.period = period; kit.viewState.day = day || ''; const q = kit.queryOf(by(k)), out = {}; Object.keys(q).sort().forEach((n) => { out[n] = q[n]; }); return out; };
assert.strictEqual(JSON.stringify(ask('bas', q2)), JSON.stringify({ on: '2026-11-27' }), 'FW2-01: the quarter in progress is asked at the last day that has happened');
assert.strictEqual(JSON.stringify(ask('bas', q1)), JSON.stringify({ on: '2026-09-30' }), 'a past quarter is asked at its own end');
assert.strictEqual(JSON.stringify(ask('bas', year)), JSON.stringify({ on: '2027-06-30' }), 'a year keeps its end (the server ignores it: its own default stays)');
assert.strictEqual(JSON.stringify(ask('dues', q2, '2026-11-15')), JSON.stringify({ asOf: '2026-11-15', control: '1' }), 'who owes whom is as at the day: unchanged');
console.log('fw2-p1-period-1132: ok');

/* FW2-03 (web half): the Day book's Attach receipt goes through the books door with the acting headers (X-Books-For), so an adviser's file lands in the CLIENT's books; the old POST /api/attachments carried the token alone and looked in the firm's own books */
const books = fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-books.js'), 'utf8');
const at = books.slice(books.indexOf('function bkAttachToEntry'), books.indexOf('function bkFlagCall'));
assert.ok(at.indexOf("'/api/books/evidence'") > 0, 'FW2-03: the receipt is posted to the books door');
assert.ok(/CBBooksActing\.authHeaders\(\)/.test(at) && !/tokenHeader/.test(at), 'FW2-03: with the acting headers, not the token alone');
assert.ok(at.indexOf("'/api/attachments'") < 0, 'FW2-03: not the firm-own attachments door');
console.log('fw2-p1 attach (web): ok');
