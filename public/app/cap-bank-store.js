/* cap-bank-store.js — the SERVER STORE of the Bank view's marks (FIN-70, web half; api: POST /bank/marks, POST /bank/statements, GET /bank/log).
 * OWNS      bankStoreLoad (read the log, replay the marks through the SAME CBBankRecon.step, newest wins) · bankStoreAppend (one mark per step action, in order) ·
 *           the sign-off ("Sign off this reconciliation": the BRS figures the page already shows, carried, behind one confirm) · bankStorePanel (one line saying where the
 *           marks are kept, the signed statements, the posted lines no accept names) · bankStoreNoteWords.
 * CALLED BY cap-bank.js (bankRun · bkbStep · bankPaint · the note box), loaded after it by public/accounts.html. Reads cap-bank.js's BKB and bkb* helpers by name.
 * FLOW      bankRun → bankStoreLoad → GET /bank/log → replay → BKB.rec · a step → bkbStep → bankStoreAppend → POST /bank/marks · Sign off → confirm → POST /bank/statements
 * ⭐ ONE CALCULATION: nothing is worked out here. The replay is CBBankRecon.step, the sign-off carries CBBankRecon.brs's own figures (BKB.brs), the server stamps who and when.
 * ⭐ UNTIL THE SQL RUNS (api b864) every door answers 503 "arrives after the next update": the marks stay in localStorage as today, one line says so, and nothing is lost.
 *    localStorage is ALWAYS kept as the offline cache; marks made before the server store existed are NOT copied up (trial data is mock; ask Athi if ever wanted).
 * ⚠️ A statement line, a narration and the file name are never sent: a mark carries a line fingerprint, ids, the owner's note text; the statement carries figures and the hash.
 * IDS       BKS014-B08 (Sign off this reconciliation). The confirm is the page's one popup (CBAction.ask). CARD 16-finance/bank-reconciliation-and-bank-rail
 */
'use strict';
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    booksBankLog: { m: 'GET', p: '/api/books/bank/log' },
    booksBankMarks: { m: 'POST', p: '/api/books/bank/marks' },
    booksBankStatements: { m: 'POST', p: '/api/books/bank/statements' }
  });
}

/** where the marks are kept: mode 'server' (shared record) · 'device' (the record is not set up yet) · 'error' (could not reach it); the rest is what the log said */
var BKS = { mode: 'device', acct: '', statements: [], exceptions: [], chain: Promise.resolve(), say: '', signing: false };
const BKS_SHOWN = 4;
const bksE = (text) => (typeof bkbE === 'function' ? bkbE(text) : String(text));
const bksNotSetUp = (failure) => !!failure && failure.status === 503;

/** the log's marks, oldest first, through the engine's own step; a mark the engine refuses is skipped, never invented */
function bankStoreReplay(marks) {
  let state = {};
  (marks || []).forEach((row) => {
    const next = CBBankRecon.step(state, {
      act: row.act,
      key: row.line_key,
      how: row.how,
      chits: row.chit_ids,
      ledger: row.entry_ids,
      text: row.note,
      name: row.attach_ref,
      ref: row.attach_ref,
      at: row.at,
      by: row.by
    });
    if (!next.why) state = next;
  });
  return state;
}
/** the marks of the picked account: the shared record when it answers, else this device's own copy (and the line says which) */
async function bankStoreLoad() {
  BKS = Object.assign(BKS, { acct: BKB.acct, statements: [], exceptions: [], say: '', chain: Promise.resolve() });
  try {
    const log = (await api('booksBankLog', { query: { account: BKB.acct, from: BKB.from, to: BKB.to }, fresh: true })) || {};
    BKS.mode = 'server';
    BKS.statements = log.statements || [];
    BKS.exceptions = log.exceptions || [];
    const state = bankStoreReplay(log.marks);
    bkbSave('marks:' + BKB.acct, state);
    return state;
  } catch (failure) {
    BKS.mode = bksNotSetUp(failure) ? 'device' : 'error';
    BKS.say = bksNotSetUp(failure) ? '' : (failure && failure.message) || '';
    return bkbLoad('marks:' + BKB.acct, {});
  }
}
/** the line, ready for the server: the engine's action keys only; at and by are the server's */
function bankStoreMark(action) {
  const ids = (list) => (list || []).map(String);
  const mark = { act: action.act, key: String(action.key) };
  if (action.how) mark.how = String(action.how).slice(0, 40);
  if (action.chits) mark.chits = ids(action.chits);
  if (action.ledger) mark.ledger = ids(action.ledger);
  if (action.text) mark.text = String(action.text);
  if (action.ref) mark.ref = String(action.ref);
  return mark;
}
/** one step → one mark, sent in the order made; a failure is said on the line and the device copy stays */
function bankStoreAppend(action) {
  if (BKS.mode === 'device') return;
  const acct = BKB.acct,
    body = { account: acct, file_hash: (BKB.file && BKB.file.hash) || undefined, marks: [bankStoreMark(action)] };
  BKS.chain = BKS.chain
    .then(() => api('booksBankMarks', { body }))
    .then(() => {
      BKS.mode = 'server';
      BKS.say = '';
    })
    .catch((failure) => {
      BKS.mode = bksNotSetUp(failure) ? 'device' : 'error';
      BKS.say = bksNotSetUp(failure) ? '' : (failure && failure.message) || '';
    })
    .then(bankStorePaintLine);
}
const bankStoreNoteWords = () =>
  BKS.mode === 'server'
    ? tx('Kept for you and your accountant on the shared record. A note never stops you accepting.')
    : tx('Kept on this device. A note never stops you accepting.');
const bankStoreLine = () =>
  BKS.mode === 'server'
    ? tx('Marks and notes are kept for your accountant too.')
    : BKS.mode === 'device'
      ? tx('Saved on this device until the next update')
      : tx('Could not reach the shared record. Saved on this device for now.') + (BKS.say ? ' ' + BKS.say : '');

/* ── the sign-off: the figures the Statement tab shows, carried, never worked out again ── */
function bankStoreBody() {
  const worked = BKB.brs,
    raw = BKB.ledgerRaw || {};
  return {
    account: BKB.acct,
    period_from: BKB.from,
    period_to: BKB.to,
    opening_minor: Number(raw.opening_minor) || 0,
    closing_bank_minor: worked.bank_balance_minor,
    closing_books_minor: worked.book_balance_minor,
    difference_minor: worked.difference_minor,
    currency: String(raw.currency || bkCur() || '').toUpperCase(),
    file_hash: BKB.file && BKB.file.hash
  };
}
/** the confirm names its reach: which account, which period, what difference; and that it is kept and cannot be edited */
function bankStoreAsk(body) {
  const acct = (BKB.accts || []).filter((item) => String(item.code) === String(BKB.acct))[0];
  return {
    title: tx('Sign off this reconciliation?'),
    body:
      '<div data-testid="bank-signoff-reach">' +
      bksE(txf('{account}, {from} to {to}.', { account: (acct && acct.name) || BKB.acct, from: bkDate(BKB.from), to: bkDate(BKB.to) })) +
      '<br>' +
      bksE(txf('Difference {amount}.', { amount: bkMoney(Math.abs(body.difference_minor), body.currency) })) +
      '<br>' +
      bksE(tx('It is kept for your accountant and cannot be edited. Signing again adds a new record.')) +
      '</div>',
    yes: tx('Sign off'),
    danger: false
  };
}
function bankStoreSignOff(btn) {
  if (!BKB.brs || !BKB.brs.ok || BKS.mode !== 'server') return;
  const body = bankStoreBody();
  return CBAction.run(btn, () => api('booksBankStatements', { body }), {
    key: 'bank-signoff:' + BKB.acct,
    confirm: bankStoreAsk(body),
    failed: tx('Could not sign off'),
    outcome: (reply) => {
      BKS.statements = [(reply && reply.statement) || body].concat(BKS.statements);
      bankStorePaintLine();
      toast(tx('Signed off.'));
    }
  });
}

/* ── what is drawn ── */
const bksRow = (testId, left, right) => '<div class="pe-row" data-testid="' + testId + '"><span>' + bksE(left) + '</span><span class="mono">' + bksE(right) + '</span></div>';
const bksMore = (count) => (count > BKS_SHOWN ? '<div class="pe-note">' + bksE(txf('and {n} more', { n: count - BKS_SHOWN })) + '</div>' : '');
function bankStoreSigned() {
  if (!BKS.statements.length) return '';
  return (
    '<div class="pe-sub">' +
    bksE(tx('Signed off')) +
    '</div><div class="pe-rows" data-testid="bank-signed">' +
    BKS.statements
      .slice(0, BKS_SHOWN)
      .map((item) =>
        bksRow(
          'bank-signed-row',
          bkDate(String(item.at || '').slice(0, 10)) + ' · ' + (item.by || '') + ' · ' + tx('as at') + ' ' + bkDate(item.period_to),
          (item.tied ? tx('Tied') : tx('Difference') + ' ' + bkMoney(Math.abs(item.difference_minor), item.currency))
        )
      )
      .join('') +
    '</div>' +
    bksMore(BKS.statements.length)
  );
}
function bankStoreExceptions() {
  if (!BKS.exceptions.length) return '';
  return (
    '<div class="pe-sub">' +
    bksE(tx('Posted from a bank line, not yet accepted')) +
    '</div><div class="pe-rows" data-testid="bank-exceptions">' +
    BKS.exceptions
      .slice(0, BKS_SHOWN)
      .map((item) => bksRow('bank-exception-row', txf('Entry {no}', { no: item.entry_no }) + ' · ' + bkDate(item.posting_date), bkMoney(item.amount_minor, item.currency)))
      .join('') +
    '</div>' +
    bksMore(BKS.exceptions.length)
  );
}
function bankStoreSignButton() {
  const worked = BKB.brs;
  if (!worked || !worked.ok) return '';
  const off = BKS.mode !== 'server';
  return (
    '<div class="supacts"><button data-cbsid="BKS014-B08" type="button" class="act" data-testid="bank-signoff"' +
    (off ? ' disabled aria-describedby="bk_store_line" title="' + bksE(tx('Signing off starts after the next update')) + '"' : '') +
    ' onclick="bankStoreSignOff(this)">' +
    bksE(tx('Sign off this reconciliation')) +
    '</button></div>'
  );
}
/** the whole panel: the line, the sign-off, the signed list, the exceptions */
const bankStorePanel = () =>
  '<div id="bk_store" data-testid="bank-store"><div class="pe-note" id="bk_store_line" data-testid="bank-store-line" data-mode="' +
  BKS.mode +
  '">' +
  bksE(bankStoreLine()) +
  '</div>' +
  bankStoreSignButton() +
  bankStoreSigned() +
  bankStoreExceptions() +
  '</div>';
/** a step or an answer changed the line or the lists: redraw the panel where it is, nothing else */
function bankStorePaintLine() {
  const host = document.getElementById('bk_store');
  if (host) host.outerHTML = bankStorePanel();
}
