'use strict';
// @type: unit
/**
 * bank-cheque-loan-1141.test.cjs - the two lines that kept the bank reconciliation off 0.00 (BB-P1-1, batch 1141; after api #1439 / web #818, twin of the api PR for POST /entries/:id/reverse).
 *
 * OWNS      the proof, against a stub api and stand-in engines (the real engine's own numbers are proved in the api test tests/bb-p1-1-cheque-return-loan.test.cjs: Dr debtors 300.00 /
 *           Cr bank 300.00, the BRS 0.00), that bank-preview.js + cap-bank-post.js
 *           (1) a DISHONOURED CHEQUE that does not name its receipt is never Ready: it asks which receipt (the books' cleared receipts of exactly this figure, one pick), and with none says so;
 *           (2) with the receipt named and the owner's tick it posts ONE POST /entries/:id/reverse on THAT receipt, dated the day the bank returned it, never anything else;
 *           (3) a second press (409 ALREADY_REVERSED) is done only when the reversal sits inside the match window of the line, else said in words; a held reversal is never "Added";
 *           (4) a LOAN REPAYMENT is never Ready without a loan and the interest: no loan listed says so, no loan picked asks, no interest asks; with both it posts POST /loans/:ref/emi with
 *           the split AS GIVEN (640.00 = 600.00 principal + 40.00 interest), and the sheet and the press read the SAME test (CBBankPost.loanNeed).
 * CALLED BY ci.yml (the unit checks): node e2e/bank-cheque-loan-1141.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const path = require('path'), assert = require('assert');
const pub = (rel) => path.join(__dirname, '..', 'public', rel);
require(pub('app/shop-time.js'));
const LINEKIT = require(pub('app/bank-preview-line.js'));
const P = require(pub('app/bank-preview.js')), POST = require(pub('app/cap-bank-post.js'));
let ran = 0;
const ok = (name) => console.log('ok  ' + name) || ran++;
const money = (minor) => ({ amount_minor: minor, currency: 'AUD' });
const RECEIPTS = [{ ref: 'e0000000-0000-4000-8000-000000000001', party: 'p0000000-0000-4000-8000-000000000001', party_name: 'Ravi Stores', amount_minor: 30000, date: '2026-10-12' },
  { ref: 'e0000000-0000-4000-8000-000000000002', party: 'p0000000-0000-4000-8000-000000000002', party_name: 'Smith Pty', amount_minor: 30000, date: '2026-10-05' },
  { ref: 'e0000000-0000-4000-8000-000000000003', party: 'p0000000-0000-4000-8000-000000000003', party_name: 'Other', amount_minor: 99900, date: '2026-10-06' }];
const CHEQUE = { date: '2026-10-20', narration: 'DISHONOURED CHEQUE 000123', debit_minor: 30000, credit_minor: 0 };
const LOAN = { date: '2026-10-26', narration: 'LOAN REPAYMENT CBA 8812', debit_minor: 64000, credit_minor: 0 };

/** stand-in engines: the dishonoured-cheque proposal as the engine gives it (the receipt named only when the options hold exactly one of this figure; the bank's words alone need a tick), a loan repayment with no need of its own */
function engines(line, kind) {
  return {
    recon: {
      parse: () => ({ ok: true, lines: [line], warnings: [], skipped: [], opening_minor: 0, closing_minor: 0 }),
      match: () => ({ matched: [], unmatched_stmt: [Object.assign({ i: 0 }, line)], unmatched_ledger: [] }),
      nearMatches: () => ({}),
      suggest: (one, o) => {
        if (kind === 'loan') return { event: { type: 'loan_repaid', date: one.date, principal: 640, interest: 0 } };
        const fits = (o.receipts || []).filter((r) => r.amount_minor === one.debit_minor);
        const event = fits.length === 1 ? { type: 'cheque_dishonoured', party: fits[0].party, reverses: fits[0].ref, date: one.date, amount: 300, narration: 'Bank statement: ' + one.narration } : { type: 'cheque_dishonoured', party: null, reverses: null, date: one.date, amount: 300 };
        return { event, needs: fits.length === 1 ? (o.confirmed ? undefined : 'needs_tick') : ['party', 'reverses'] };
      }
    },
    project: {
      refsOf: () => ['bank:' + 'a'.repeat(23) + '0-1'],
      project: (lines, proposals) => {
        const need = proposals[0].needs, blockers = need ? [].concat(need).join(',').split(',').filter((c) => c !== '').map((c) => c) : [];
        const joined = blockers.length > 1 ? ['no_entry'].concat(blockers) : blockers;
        return {
          ok: true, currency: 'AUD',
          lines: [{ i: 0, state: blockers.length ? 'needs_you' : 'proposed', ready: !blockers.length, blockers: joined, ref: 'bank:' + 'a'.repeat(23) + '0-1', entry: { lines: [] }, party: null }],
          ledger: [], brs: null, totals: { entries: 1, in: money(0), out: money(line.debit_minor), tax: money(0), from: line.date, to: line.date },
          counts: { lines: 1, in_books: 0, proposed: 1, ready: blockers.length ? 0 : 1, needs_you: blockers.length ? 1 : 0 }, parties_to_create: []
        };
      }
    }
  };
}
const LOANS = [{ ref: 'acct:2510', lender: 'Secured loans', opening_minor: 500000, outstanding_minor: 500000, currency: 'AUD' }];
function ctlOf(line, kind, api, loans) {
  const ctl = P.create({ engine: engines(line, kind), currency: 'AUD', statementCurrency: () => 'AUD', account: 'Demo', ledger: () => ({ lines: [], opening_minor: 0 }), post: POST.adapter({ api, who: { role: 'owner' } }), lockedMonth: () => null, postable: POST.POSTABLE,
    loans: () => loans || [], loanNeed: POST.loanNeed, suggestOpts: { receipts: RECEIPTS } });
  assert.ok(ctl.load('ok', 'x.csv').ok);
  return ctl;
}
const only = (ctl) => ctl.view().items[0];
const refusal = (code, data) => Object.assign(new Error('refused'), { code, data });

(async () => {
  /* 1 - a returned cheque that names no receipt: asks which, never Ready, posts nothing */
  let calls = [];
  const api = async (key, o) => (calls.push([key, o]), { ok: true, entry_no: 'MJ/2026-27/000009', posting_date: '2026-10-20' });
  let ctl = ctlOf(CHEQUE, 'cheque', api);
  assert.strictEqual(only(ctl).ready, false);
  assert.strictEqual(only(ctl).needs, 'which_receipt', 'asks which receipt');
  assert.strictEqual((await ctl.postReady()).tried, 0);
  assert.strictEqual(calls.length, 0, 'nothing is sent');
  const choices = ctl.receiptChoices(CHEQUE);
  assert.deepStrictEqual(choices.map((r) => r.party_name), ['Ravi Stores', 'Smith Pty'], 'the two receipts of exactly 300.00, not the 999.00 one');
  ok('a returned cheque with two receipts of 300.00 asks which one (the 999.00 receipt is not offered), nothing posted');

  /* 2 - the pick, the tick, then ONE reverse of THAT receipt on the bank day */
  assert.ok(ctl.receipt(only(ctl).key, RECEIPTS[0].ref).ok);
  assert.strictEqual(only(ctl).ready, false, 'the bank words alone still need the owner tick');
  assert.strictEqual(only(ctl).needs, 'needs_tick');
  ctl.tick(only(ctl).key);
  assert.strictEqual(only(ctl).ready, true, 'receipt named + tick = ready');
  const run = await ctl.postReady();
  assert.strictEqual(run.added, 1);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], 'booksReverse');
  assert.deepStrictEqual(calls[0][1].params, { id: RECEIPTS[0].ref });
  assert.strictEqual(calls[0][1].body.date, '2026-10-20', 'dated the day the bank returned it');
  assert.ok(/DISHONOURED CHEQUE 000123/.test(calls[0][1].body.reason), 'the reason names the bank line');
  assert.ok(!('client_ref' in calls[0][1].body), 'no second idempotency key: reverse is once per entry');
  ok('pick + tick: ONE POST /entries/:id/reverse on the picked receipt, date 2026-10-20, never an event or a payment');

  /* 3 - a second press: inside the match window it is done, outside it is said, a held reversal is never Added */
  const again = (day) => async () => { throw refusal('ALREADY_REVERSED', { posting_date: day, entry_no: 'MJ-8' }); };
  const one = (api2) => { const c = ctlOf(CHEQUE, 'cheque', api2); c.receipt(only(c).key, RECEIPTS[0].ref); c.tick(only(c).key); return c; };
  let c3 = one(again('2026-10-19')); let r3 = await c3.postReady();
  assert.strictEqual(c3.view().results[only(c3).key].ok, true, 'reversed a day before the line: it matches, done');
  c3 = one(again('2026-10-01')); r3 = await c3.postReady();
  const said = c3.view().results[only(c3).key];
  assert.deepStrictEqual([r3.added, said.ok], [0, false]);
  assert.ok(/already reversed on 2026-10-01/.test(said.why) && /will not match/.test(said.why), said.why);
  c3 = one(async () => ({ state: 'waiting_accept', action_id: 'a1' })); r3 = await c3.postReady();
  assert.strictEqual(r3.added, 0, 'a held reversal is not added');
  assert.ok(/owner/.test(c3.view().results[only(c3).key].why));
  assert.ok(LINEKIT.MATCH_WINDOW_DAYS >= 1, 'the window is the one the matcher uses');
  ok('409 ALREADY_REVERSED: done only inside the match window, else "already reversed on <day>, will not match"; a held reversal is not added');

  /* 4 - a cheque with no receipt of this figure says so, never Ready */
  ctl = ctlOf(Object.assign({}, CHEQUE, { debit_minor: 12300 }), 'cheque', api);
  assert.strictEqual(only(ctl).ready, false);
  assert.strictEqual(ctl.receiptChoices(Object.assign({}, CHEQUE, { debit_minor: 12300 })).length, 0);
  ok('no receipt of this figure in the books: not Ready (the row keeps Ask the party / Record it in Dues)');

  /* 5 - the loan: never Ready without a loan and the interest */
  calls = [];
  const quiet = async (key, o) => (calls.push([key, o]), { ok: true, entry_no: 'PV-3', posting_date: '2026-10-26' });
  ctl = ctlOf(LOAN, 'loan', quiet, []);
  assert.deepStrictEqual([only(ctl).ready, only(ctl).blockers.indexOf('no_loan') >= 0], [false, true], 'no loan in the books: said, not Ready');
  assert.strictEqual((await ctl.postReady()).tried, 0);
  ctl = ctlOf(LOAN, 'loan', quiet, LOANS);
  assert.deepStrictEqual([only(ctl).ready, only(ctl).needs], [false, 'which_loan'], 'a loan is listed but none picked: asks');
  ctl.loan(only(ctl).key, 'acct:2510');
  assert.deepStrictEqual([only(ctl).ready, only(ctl).needs], [false, 'interest'], 'loan picked, no interest: asks');
  ctl.interest(only(ctl).key, 4000);
  assert.strictEqual(only(ctl).ready, true, 'loan + interest = ready');
  await ctl.postReady();
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], 'booksLoanEmi');
  assert.deepStrictEqual(calls[0][1].params, { ref: 'acct:2510' });
  assert.deepStrictEqual([calls[0][1].body.principal_minor, calls[0][1].body.interest_minor], [60000, 4000], '640.00 = 600.00 + 40.00 as given');
  ctl = ctlOf(LOAN, 'loan', quiet, LOANS); ctl.loan(only(ctl).key, 'acct:2510'); ctl.interest(only(ctl).key, 99999);
  assert.deepStrictEqual([only(ctl).ready, only(ctl).blockers.indexOf('interest_too_big') >= 0], [false, true]);
  ok('loan 640.00: no loan listed / none picked / no interest are each said and not Ready; with both it posts /loans/acct:2510/emi 600.00 + 40.00');

  /* 6 - the sheet and the press read ONE test */
  assert.strictEqual(POST.loanEmiRefusal({ line: LOAN }), 'Choose which loan this pays first.');
  assert.strictEqual(POST.loanEmiRefusal({ line: LOAN, loanRef: 'x' }), "Type the interest from the lender's statement first.");
  assert.strictEqual(POST.loanEmiRefusal({ line: LOAN, loanRef: 'x', interestMinor: 4000 }), null);
  ok('the press refuses with the words of the same loanNeed the sheet holds the line on');
  /* 7 - the receipts a returned cheque can reverse come from the bank ledger lines the api already returns: money in, a party, a payment received, not reversed, from 90 days before the statement */
  const line = (extra) => Object.assign({ dr_minor: 30000, entry_id: 'e1', event_type: 'payment_received', party_name: 'Ravi Stores', date: '2026-10-12' }, extra);
  const debtor = (id, extra) => Object.assign({ entry_id: id, party_id: 'p-' + id, cr_minor: 30000 }, extra); /* the real ledger: the BANK line has party_id null (SIT, 28 Nov), the debtors line names the party */
  const found = POST.receiptsOf([line(), line({ entry_id: 'e2', reversed_by: 'MJ-1' }), line({ entry_id: 'e3', event_type: 'sale_bill' }), line({ entry_id: 'e4' }), line({ entry_id: 'e5', reverses_entry_id: 'x' }), line({ entry_id: 'e6', dr_minor: 0 }), line({ entry_id: 'e7' })],
    [debtor('e1'), debtor('e2'), debtor('e3'), debtor('e5'), debtor('e6'), debtor('e7', { party_id: null })]);
  assert.deepStrictEqual(found.map((r) => [r.ref, r.party]), [['e1', 'p-e1']], 'only the unreversed payment received whose debtors line names the party (e4 has no debtors line, e7 no party)');
  assert.deepStrictEqual(POST.receiptWindow('2026-10-01', '2026-10-31'), { from: '2026-07-03', to: '2026-10-31' }, '90 days before the first day, to the last');
  ok('receipts: only the unreversed customer payments received (not a bill, not a reversal, not a partyless line); the window starts 90 days before the statement');
  console.log(ran + ' checks');
})().catch((e) => { console.error('FAIL', e && e.stack || e); process.exit(1); });
