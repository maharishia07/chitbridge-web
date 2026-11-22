'use strict';
// @type: unit
/**
 * bank-add-batch.test.cjs - the bank Add posts its plain-entry lines MANY TO A CALL (POST /events/batch), the rest one at a time.
 *
 * OWNS      the proof that public/app/bank-preview.js postReady + public/app/cap-bank-post.js (adapter.many / .batchable) (1) send 50 plain lines in at most 3 requests (the
 *           parent sent 50), (2) name a refused line by its own reason while the others are added, (3) fall back to one line at a time when the door says no (an owner-approval
 *           shop answers 409) with each line's client_ref, so nothing is posted twice, (4) keep a new-party line, a payment and a loan instalment on their own doors.
 * CALLED BY ci.yml (the unit checks): node e2e/bank-add-batch.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const path = require('path'), assert = require('assert');
const pub = (rel) => path.join(__dirname, '..', 'public', rel);
require(pub('app/shop-time.js'));
const P = require(pub('app/bank-preview.js')), POST = require(pub('app/cap-bank-post.js'));
let ran = 0;
const ok = (name) => console.log('ok  ' + name) || ran++;
const money = (minor) => ({ amount_minor: minor, currency: 'AUD' });

/** n statement lines, all ready; shape(i) gives { type, party } for a line */
function ctlOf(n, shape, post) {
  const lines = Array.from({ length: n }, (_, i) => ({ date: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), narration: 'Line ' + i, debit_minor: 1000 + i, credit_minor: 0 }));
  const engine = {
    recon: {
      parse: () => ({ ok: true, lines, warnings: [], skipped: [], opening_minor: 0, closing_minor: 0 }),
      match: () => ({ matched: [], unmatched_stmt: lines.map((l, i) => Object.assign({ i }, l)), unmatched_ledger: [] }),
      nearMatches: () => ({}),
      suggest: (line) => ({ event: { type: 'expense', date: line.date, amount: 1 } })
    },
    project: {
      refsOf: (ls) => ls.map((l, i) => 'bank:' + 'b'.repeat(23) + i + '-1'),
      project: (ls) => ({
        ok: true, currency: 'AUD',
        lines: ls.map((l, i) => ({ i, state: 'proposed', ready: true, blockers: [], ref: 'bank:' + 'b'.repeat(23) + i + '-1', entry: { lines: [] }, party: (shape(i) || {}).party || null, event: Object.assign({ type: 'expense', date: l.date, amount: 1 }, { type: (shape(i) || {}).type || 'expense' }) })),
        ledger: [], brs: null,
        totals: { entries: n, in: money(0), out: money(1), tax: money(0), from: '2026-10-01', to: '2026-10-28' },
        counts: { lines: n, in_books: 0, proposed: n, ready: n, needs_you: 0 }, parties_to_create: []
      })
    }
  };
  const ctl = P.create({ engine, currency: 'AUD', statementCurrency: () => 'AUD', account: 'Demo', ledger: () => ({ lines: [], opening_minor: 0 }), post, lockedMonth: () => null });
  assert.ok(ctl.load('ok', 'x.csv').ok);
  return ctl;
}

(async () => {
  /* 1. 50 plain lines: at most 3 requests, every line added */
  let calls = [];
  const api = async (key, o) => {
    calls.push([key, o.body]);
    if (key === 'booksEventsBatch') return { results: o.body.events.map((e, index) => ({ index, client_ref: e.client_ref, ok: true, entry_no: 'MJ-' + index })), posted: o.body.events.length, failed: 0 };
    return { entry_no: 'MJ-1', duplicate: false };
  };
  let ctl = ctlOf(50, () => null, POST.adapter({ api, who: { role: 'owner' } }));
  let said = await ctl.postReady();
  assert.deepStrictEqual([said.tried, said.added, said.failed], [50, 50, 0]);
  assert.ok(calls.length <= 3, 'requests: ' + calls.length);
  assert.ok(calls[0][1].events.every((e) => /^bank:/.test(e.client_ref) && e.kind === 'expense'), 'each line keeps its client_ref and the closed body');
  ok('50 plain lines are added in ' + calls.length + ' request(s), not 50');

  /* 2. a refused line is named; the others are added */
  calls = [];
  const apiPart = async (key, o) => {
    calls.push(key);
    return { results: o.body.events.map((e, index) => (index === 1 ? { index, client_ref: e.client_ref, ok: false, status: 422, code: 'PERIOD_LOCKED', detail: 'That month is locked.' } : { index, client_ref: e.client_ref, ok: true, entry_no: 'MJ-' + index })) };
  };
  const told = [];
  ctl = ctlOf(4, () => null, POST.adapter({ api: apiPart, who: { role: 'owner' } }));
  said = await ctl.postReady((item, r) => told.push(r.ok ? 'ok' : r.why));
  assert.deepStrictEqual([said.added, said.failed], [3, 1]);
  assert.deepStrictEqual(told, ['ok', 'That month is locked.', 'ok', 'ok']);
  ok('a refused line says its own reason; the others are added');

  /* 3. the door says no (409): one line at a time, once, nothing lost */
  calls = [];
  const apiHeld = async (key, o) => {
    calls.push(key);
    if (key === 'booksEventsBatch') throw new Error('This shop asks the owner to approve entries, so each one is sent on its own.');
    return { entry_no: 'MJ-' + calls.length, duplicate: false };
  };
  ctl = ctlOf(5, () => null, POST.adapter({ api: apiHeld, who: { role: 'owner' } }));
  said = await ctl.postReady();
  assert.deepStrictEqual([said.added, said.failed], [5, 0]);
  assert.deepStrictEqual(calls, ['booksEventsBatch'].concat(Array(5).fill('booksEventPost')), 'one try of the batch, then the five single posts');
  ok('a door that says no falls back to one line at a time (one try, nothing posted twice: every line has its client_ref)');

  /* 4. a new-party line, a payment and a loan instalment keep their own doors, in order */
  calls = [];
  const apiMix = async (key, o) => {
    calls.push(key);
    if (key === 'booksEventsBatch') return { results: o.body.events.map((e, index) => ({ index, ok: true, entry_no: 'MJ-' + index })) };
    if (key === 'supAdd') return { supplier: { supplier_entity_id: 'sup-1' } };
    return { entry_no: 'X-1', duplicate: false, posted: { entry_no: 'P-1' }, payment: {} };
  };
  const shape = (i) => (i === 2 ? { party: { status: 'new', name: 'Origin', kind: 'supplier' } } : i === 3 ? { type: 'payment_received', party: { status: 'existing', id: '11111111-1111-4111-8111-111111111111', name: 'A' } } : null);
  ctl = ctlOf(6, shape, POST.adapter({ api: apiMix, who: { role: 'owner' } }));
  said = await ctl.postReady();
  assert.strictEqual(said.tried, 6);
  assert.deepStrictEqual(calls.slice(0, 1), ['booksEventsBatch'], 'lines 0 and 1 go together');
  assert.ok(calls.includes('supAdd'), 'the new party is still made first, on its own door');
  assert.ok(calls.filter((k) => k === 'booksEventsBatch').length <= 2, 'plain runs stay batched');
  ok('a new party, a payment and a loan keep their own doors; plain runs between them are still batched');
  console.log('\n' + ran + ' groups ok');
})().catch((e) => { console.error(e); process.exit(1); });
