'use strict';
// @type: unit
/**
 * bank-engine199.test.cjs - web follow-ups for engines v1.99.0 (BANK-new-11 over-payment, BANK-new-14 balance_break, BANK-new-15 which_liability).
 * OWNS      the proof that (1) an owner-ticked over-payment (a proposal with on_account_minor) posts with acknowledge ['same_again','excess'] and an unticked one never does;
 *           (2) the line carries on_account_minor as item.onAccount and the tick box says A$X stays on the account BEFORE the tick; (3) balance_break and which_liability are asked
 *           lines whose sentence is the ENGINE's (CBBankProject.BLOCKER_WORDS), none written in web; (4) which_liability offers the engine's own options and defaults to none.
 * CALLED BY ci.yml (the unit checks): node e2e/bank-engine199.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'), path = require('path'), assert = require('assert');
const pub = (rel) => path.join(__dirname, '..', 'public', rel);
const WORDS = { balance_break: 'ENGINE SAYS: balance does not follow', which_liability: 'ENGINE SAYS: which liability' };
globalThis.CBBankProject = { BLOCKER_WORDS: WORDS };
const LINE = require(pub('app/bank-preview-line.js'));
const POST = require(pub('app/cap-bank-post.js'));
let ran = 0;
const ok = (n) => console.log('ok  ' + n) || ran++;

(async () => {
  const paid = [];
  const api = async (key, o) => (paid.push(o.body), { payment: { duplicate: false }, posted: { entry_no: 'RC-1' } });
  const post = POST.adapter({ api, who: { role: 'owner' }, modeOf: (b) => Object.assign({}, b, { paid_from: 'bank' }) });
  const over = { ref: 'bank:o1', event: { type: 'payment_received', mode: 'bank', date: '2026-11-05' }, line: { date: '2026-11-05', credit_minor: 150000, debit_minor: 0 },
    party: { status: 'existing', id: 'c-1', name: 'Coogee', kind: 'customer' }, against: [{ against_ref: 'inv-1', amount_minor: 100000 }], onAccount: 50000 };
  await post(Object.assign({}, over, { ticked: true }));
  assert.deepStrictEqual(paid[0].acknowledge, ['same_again', 'excess']);
  await post(Object.assign({}, over, { ref: 'bank:o2' }));
  assert.ok(!paid[1].acknowledge, 'no tick, no acknowledge');
  await post(Object.assign({}, over, { ref: 'bank:o3', ticked: true, onAccount: 0 }));
  assert.deepStrictEqual(paid[2].acknowledge, ['same_again']);
  await post(Object.assign({}, over, { ref: 'bank:o4', twin: true }));
  assert.ok(!paid[3].acknowledge || paid[3].acknowledge.indexOf('excess') < 0, 'a twin alone is not a tick for the excess');
  ok('over-payment: excess acknowledged only on the owner\'s tick, same_again kept');

  const item = LINE.lineOf({ ref: 'r', i: 0, state: 'proposed', ready: false, blockers: ['needs_tick'], entry: { lines: [] } }, { date: '2026-11-05' }, { against: over.against, on_account_minor: 50000 }, null, []);
  assert.strictEqual(item.onAccount, 50000);
  assert.strictEqual(LINE.lineOf({ ref: 'r', i: 0, state: 'proposed', blockers: [] }, {}, {}, null, []).onAccount, 0);
  ok('the line carries on_account_minor as onAccount');

  const asked = (blockers) => LINE.lineOf({ ref: 'r', i: 0, state: 'needs_you', blockers }, {}, null, null, []).needs;
  assert.strictEqual(asked(['no_entry', 'which_liability']), 'which_liability');
  assert.strictEqual(asked(['balance_break']), 'balance_break');
  assert.strictEqual(asked(['needs_tick', 'balance_break']), 'needs_tick', 'one tick answers both');
  assert.strictEqual(LINE.sentenceOf('balance_break'), WORDS.balance_break);
  delete globalThis.CBBankProject;
  assert.strictEqual(LINE.sentenceOf('balance_break'), '', 'an engine copy without the words shows the label alone, never a copy');
  const src = fs.readFileSync(pub('app/bank-preview-line.js'), 'utf8') + fs.readFileSync(pub('app/bank-preview-ui-parts.js'), 'utf8');
  assert.ok(!/does not follow from the line before/.test(src) && !/Say which tax liability/.test(src), 'no engine sentence is copied into web');
  ok('balance_break and which_liability are asked, with the engine\'s sentence read from BLOCKER_WORDS');

  const ui = fs.readFileSync(pub('app/bank-preview-ui-parts.js'), 'utf8') + fs.readFileSync(pub('app/bank-preview-ui.js'), 'utf8');
  assert.ok(/stays on the/.test(ui) && /item\.what\.options/.test(ui) && /act="liability"/.test(ui));
  assert.ok(!/gst_collected|payg/i.test(ui), 'no liability name or role is written in web: the options are the engine\'s');
  assert.ok(/choice.note/.test(ui) && /bd-choice-note/.test(ui), 'the engine note is rendered with its choice');
  ok('the stays-on-account sentence and the liability options are on the line, none named in web');
  /* v1.100.0: drawings is one POST /events kind; a loan repayment posts the owner's typed interest to POST /loans/:ref/emi, never computed */
  const evs = [];
  const api2 = async (key, o) => (evs.push([key, o]), { entry_no: 'E-1' });
  const post2 = POST.adapter({ api: api2, who: { role: 'owner' }, modeOf: (b) => Object.assign({}, b, { paid_from: 'bank' }) });
  assert.ok(POST.POSTABLE.indexOf('drawings') >= 0);
  const dr = await post2({ ref: 'bank:d1', event: { type: 'drawings', from: 'bank', owner: true, date: '2026-11-10', amount: 2000 }, line: { date: '2026-11-10', debit_minor: 200000 } });
  assert.strictEqual(dr.ok, true, JSON.stringify(dr));
  assert.strictEqual(evs[0][1].body.kind, 'drawings');
  assert.strictEqual(evs[0][1].body.paid_from, 'bank');
  const loan = { ref: 'bank:l1', event: { type: 'loan_repaid', date: '2026-11-10' }, line: { date: '2026-11-10', debit_minor: 150000, credit_minor: 0 } };
  assert.strictEqual((await post2(loan)).ok, false, 'no loan picked: says so, posts nothing');
  assert.strictEqual((await post2(Object.assign({}, loan, { loanRef: 'L-1' }))).ok, false, 'no interest typed: says so, posts nothing');
  assert.strictEqual(evs.length, 1);
  const paidEmi = await post2(Object.assign({}, loan, { loanRef: 'L-1', interestMinor: 25000 }));
  assert.strictEqual(paidEmi.ok, true, JSON.stringify(paidEmi));
  assert.strictEqual(evs[1][0], 'booksLoanEmi');
  assert.deepStrictEqual(evs[1][1].params, { ref: 'L-1' });
  assert.deepStrictEqual([evs[1][1].body.principal_minor, evs[1][1].body.interest_minor], [125000, 25000]);
  assert.strictEqual((await post2(Object.assign({}, loan, { loanRef: 'L-1', interestMinor: 999999 }))).ok, false, 'interest above the payment is refused');
  assert.strictEqual(LINE.lineOf({ ref: 'r', i: 0, state: 'needs_you', blockers: ['no_entry', 'interest'] }, {}, null, null, []).needs, 'interest');
  ok('drawings posts as an event; a loan repayment posts to /loans/:ref/emi only with a picked loan and the owner-typed interest (125,000.00 principal + 25,000.00 interest hand-computed from 1,500.00 and 250.00)');
  console.log(ran + ' checks passed');
})().catch((e) => { console.error('FAIL', e && e.stack || e); process.exit(1); });
