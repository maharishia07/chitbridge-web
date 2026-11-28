'use strict';
// @type: unit
/**
 * bank-party-post.test.cjs - "Use this party" on a money-out Bank line (BB-P1-3, batch 1140; after api #1439 + engines #167).
 *
 * OWNS      the proof, against a stub api and stand-in engines, that bank-preview.js + cap-bank-post.js
 *           (1) a party alone is NOT ready: the line asks "Which account is this for?" and nothing is posted, (2) with the party AND an account the line posts ONE
 *           POST /events kind bank_expense_supplier (never batched) carrying supplier, class, the net amount and the tax inside the bank figure,
 *           (3) a payment against an open bill stays ready and sends bank_line:true, (4) a 422 NEEDS_WHICH_BILL shows the bill and waits for a yes,
 *           (5) a 422 NEEDS_WHICH_ACCOUNT puts the line back to the question, never "Added".
 * CALLED BY ci.yml (the unit checks): node e2e/bank-party-post.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const path = require('path'), assert = require('assert');
const pub = (rel) => path.join(__dirname, '..', 'public', rel);
require(pub('app/shop-time.js'));
const P = require(pub('app/bank-preview.js')), POST = require(pub('app/cap-bank-post.js'));
let ran = 0;
const ok = (name) => console.log('ok  ' + name) || ran++;
const money = (minor) => ({ amount_minor: minor, currency: 'AUD' });
const SUPPLIER = '11111111-1111-4111-8111-111111111111';
const MODE = { untaxed: false };
const LINE = { date: '2026-11-05', narration: 'Origin Energy', debit_minor: 33000, credit_minor: 0 };

/** stand-in engines: the bank's words name the supplier (payment_made, no bill unless `against`); an account answer is an expense with the party and the engine's own split (330.00 = 300.00 + 30.00) */
function engines(against) {
  const named = { status: 'existing', id: SUPPLIER, name: 'Origin Energy', kind: 'supplier' };
  return {
    recon: {
      parse: () => ({ ok: true, lines: [LINE], warnings: [], skipped: [], opening_minor: 0, closing_minor: 0 }),
      match: () => ({ matched: [], unmatched_stmt: [Object.assign({ i: 0 }, LINE)], unmatched_ledger: [] }),
      nearMatches: () => ({}),
      suggest: (line) => ({ event: { type: 'payment_made', date: line.date, amount: 330, party: SUPPLIER }, against: against || [] })
    },
    entry: {
      /* no account: the party alone (a payment); an account: the expense, taxed (330.00 = 300.00 + 30.00) or with no tax invoice (the whole figure, no tax) */
      resolve: (line, answers) => (!answers.account ? { ok: true, event: { type: 'payment_made', date: line.date, amount: line.debit_minor / 100, party: answers.party } } : MODE.untaxed
        ? { ok: true, event: { type: 'expense', class: answers.account, paid_from: 'bank', date: line.date, amount: line.debit_minor / 100, party: answers.party } }
        : { ok: true, event: { type: 'expense', class: answers.account, paid_from: 'bank', date: line.date, amount: 300, party: answers.party }, tax: { tax_minor: 3000, direction: 'input', invoice_answer: 'held' } })
    },
    project: {
      refsOf: () => ['bank:' + 'a'.repeat(23) + '0-1'],
      project: (lines, proposals) => {
        const proposal = proposals[0], blockers = proposal.needs ? [proposal.needs] : [];
        return {
          ok: true, currency: 'AUD',
          lines: [{ i: 0, state: blockers.length ? 'needs_you' : 'proposed', ready: !blockers.length, blockers, ref: 'bank:' + 'a'.repeat(23) + '0-1', entry: { lines: [] }, party: named, tax: proposal.tax || null }],
          ledger: [], brs: null,
          totals: { entries: 1, in: money(0), out: money(33000), tax: money(0), from: '2026-11-05', to: '2026-11-05' },
          counts: { lines: 1, in_books: 0, proposed: 1, ready: blockers.length ? 0 : 1, needs_you: blockers.length ? 1 : 0 }, parties_to_create: []
        };
      }
    }
  };
}
function ctlOf(api, against) {
  const ctl = P.create({ engine: engines(against), currency: 'AUD', statementCurrency: () => 'AUD', account: 'Demo', ledger: () => ({ lines: [], opening_minor: 0 }), post: POST.adapter({ api, who: { role: 'owner' } }), lockedMonth: () => null, postable: POST.POSTABLE });
  assert.ok(ctl.load('ok', 'x.csv').ok);
  return ctl;
}
const only = (ctl) => ctl.view().items[0];
const refusal = (code, data) => Object.assign(new Error('refused'), { code, data });

(async () => {
  /* 1 - the party alone: not ready, asks which account, posts nothing */
  let calls = [];
  const quiet = async (key, o) => (calls.push([key, o.body]), { entry_no: 'MJ-1' });
  let ctl = ctlOf(quiet);
  assert.strictEqual(only(ctl).ready, false, 'a party alone is not ready');
  assert.strictEqual(only(ctl).needs, 'which_account');
  const first = await ctl.postReady();
  assert.strictEqual(first.tried, 0, 'nothing is tried');
  assert.strictEqual(calls.length, 0, 'nothing is sent');
  ok('party only: "Which account is this for?", not ready, nothing posted');

  /* 2 - party and account: one supplier-expense entry */
  ctl.resolveLine(only(ctl).key, { account: 'utilities', tax_kind: 'gst' });
  assert.strictEqual(only(ctl).ready, true, 'the account answer makes it ready');
  assert.strictEqual(POST.adapter({ api: quiet, who: { role: 'owner' } }).batchable(only(ctl)), false, 'a supplier expense is never batched');
  await ctl.postReady();
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], 'booksEventPost', 'one POST /events, never batched');
  const body = calls[0][1];
  assert.deepStrictEqual([body.kind, body.supplier, body.class, body.amount, body.input_tax_minor, body.tax_invoice, body.paid_from], ['bank_expense_supplier', SUPPLIER, 'utilities', 300, 3000, 'held', 'bank']);
  assert.ok(/^bank:/.test(body.client_ref));
  ok('party + account: ONE bank_expense_supplier with supplier, class, net 300 and input tax 3000 minor');

  /* 3 - a payment against an open bill stays ready and says it is a bank line */
  calls = [];
  ctl = ctlOf(quiet, [{ against_ref: 'B-7', amount_minor: 33000 }]);
  assert.strictEqual(only(ctl).ready, true);
  await ctl.postReady();
  assert.strictEqual(calls[0][0], 'booksPayRecord');
  assert.strictEqual(calls[0][1].bank_line, true);
  assert.deepStrictEqual(calls[0][1].allocations, [{ against_ref: 'B-7', amount_minor: 33000 }]);
  ok('against an open bill: ready, POST /payments with bank_line:true and the allocation');

  /* 4 - the api finds a bill of exactly this amount: asks, settles only after a yes */
  calls = [];
  const bill = { ref: 'B-9', open_minor: 33000 };
  const asking = async (key, o) => {
    calls.push([key, o.body]);
    if (!o.body.allocations || o.body.allocations[0].against_ref !== 'B-9') throw refusal('NEEDS_WHICH_BILL', { needs: 'which_bill', bill });
    return { payment: {}, posted: { entry_no: 'PV-1' } };
  };
  ctl = ctlOf(asking, [{ against_ref: 'B-1', amount_minor: 33000 }]);
  let run = await ctl.postReady();
  const asked = ctl.view().results[only(ctl).key];
  assert.deepStrictEqual([run.added, asked.ok, asked.needs, asked.bill.ref], [0, false, 'which_bill', 'B-9'], 'asked, not added');
  assert.strictEqual(calls.length, 1, 'nothing else was sent behind the question');
  assert.deepStrictEqual(ctl.useBill(only(ctl).key, true), { ok: true });
  run = await ctl.postReady();
  assert.strictEqual(run.added, 1, 'the yes settles it');
  assert.deepStrictEqual(calls[1][1].allocations, [{ against_ref: 'B-9', amount_minor: 33000 }]);
  ok('NEEDS_WHICH_BILL: the bill is shown and asked; only a yes sends allocations');

  /* 5 - the api says which account: back to the question, never Added; an answer clears it */
  const needAccount = async () => { throw refusal('NEEDS_WHICH_ACCOUNT', { needs: 'which_account' }); };
  ctl = ctlOf(needAccount, [{ against_ref: 'B-1', amount_minor: 33000 }]);
  run = await ctl.postReady();
  assert.deepStrictEqual([run.added, ctl.view().results[only(ctl).key].needs], [0, 'which_account']);
  ctl.resolveLine(only(ctl).key, { account: 'utilities', tax_kind: 'gst' });
  assert.strictEqual(ctl.view().results[only(ctl).key], undefined, 'a new answer lets the line be tried again');
  ok('NEEDS_WHICH_ACCOUNT: the line asks again, never Added');

  /* 6 - the api asks on the ENTRY door: an open bill of this supplier is for exactly this amount */
  calls = [];
  const bill9 = { ref: 'B-9', open_minor: 33000 };
  const eventAsk = async (key, o) => {
    calls.push([key, o.body]);
    if (key === 'booksEventPost' && !o.body.not_this_bill) throw refusal('NEEDS_WHICH_BILL', { needs: 'which_bill', bill: bill9 });
    return key === 'booksPayRecord' ? { payment: {}, posted: { entry_no: 'PV-1' } } : { entry_no: 'MJ-2' };
  };
  const answered = () => { ctl.resolveLine(only(ctl).key, { account: 'utilities', tax_kind: 'gst' }); return ctl.postReady(); };
  ctl = ctlOf(eventAsk);
  run = await answered();
  let q = ctl.view().results[only(ctl).key];
  assert.deepStrictEqual([run.added, q.ok, q.needs, q.via, q.bill.ref], [0, false, 'which_bill', 'event', 'B-9'], 'asked, never Added');
  assert.strictEqual(calls.length, 1, 'nothing else was sent behind the question');
  ctl.useBill(only(ctl).key, false); /* no: a new expense */
  run = await ctl.postReady();
  assert.strictEqual(run.added, 1);
  assert.deepStrictEqual([calls[1][0], calls[1][1].kind, calls[1][1].not_this_bill], ['booksEventPost', 'bank_expense_supplier', true], '"no" resends with not_this_bill');
  ok('NEEDS_WHICH_BILL on the entry door: asked; "no" resends the same expense with not_this_bill');

  calls = [];
  ctl = ctlOf(eventAsk);
  await answered();
  ctl.useBill(only(ctl).key, true); /* yes: the payment of that bill */
  assert.strictEqual(only(ctl).ready, true);
  run = await ctl.postReady();
  assert.strictEqual(run.added, 1);
  assert.deepStrictEqual([calls[1][0], calls[1][1].allocations, calls[1][1].bank_line], ['booksPayRecord', [{ against_ref: 'B-9', amount_minor: 33000 }], true], '"yes" pays that bill, no expense');
  assert.ok(!calls.slice(1).some((call) => call[0] === 'booksEventPost'), 'no second expense behind the yes');
  ok('NEEDS_WHICH_BILL on the entry door: "yes" becomes the payment of that bill, never a second expense');

  /* 7 - Bunnings: 96.80, no tax invoice: the whole figure is the expense, no GST, the party kept */
  calls = [];
  MODE.untaxed = true;
  LINE.debit_minor = 9680; LINE.narration = 'Bunnings';
  ctl = ctlOf(quiet);
  ctl.resolveLine(only(ctl).key, { account: 'repairs', tax_kind: 'none' });
  await ctl.postReady();
  const bun = calls[0][1];
  assert.deepStrictEqual([bun.kind, bun.supplier, bun.amount, 'input_tax_minor' in bun, 'tax_invoice' in bun], ['bank_expense_supplier', SUPPLIER, 96.8, false, false]);
  ok('Bunnings 96.80, no tax invoice: one supplier expense of the gross, no GST keys, party kept');
  console.log('ran ' + ran);
})().catch((e) => { console.error(e); process.exit(1); });
