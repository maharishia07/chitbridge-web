/* cap-bank-store.js — the SERVER STORE of the Bank view's marks (FIN-70, web half; api: POST /bank/marks, POST /bank/statements, GET /bank/log).
 * OWNS      bankStoreLoad (read the log, replay the marks through the SAME CBBankRecon.step, newest wins) · bankStoreAppend (one mark per step action, in order) ·
 *           the sign-off ("Sign off this reconciliation": the BRS figures the page already shows, carried, behind one confirm) · bankStorePanel (one line saying where the
 *           marks are kept, the signed statements, the posted lines no accept names) · bankStoreNoteWords.
 * CALLED BY cap-bank.js (bankRun · bkbStep · bankPaint · the note box), loaded after it by public/accounts.html. Is handed cap-bank.js's BKB at load (bankStoreState.view) and reads its bkb* helpers by name.
 * FLOW      bankRun → bankStoreLoad → GET /bank/log → replay → bankStoreState.view.rec · a step → bkbStep → bankStoreAppend → POST /bank/marks · Sign off → confirm → POST /bank/statements
 * ⭐ ONE CALCULATION: nothing is worked out here. The replay is CBBankRecon.step, the sign-off carries CBBankRecon.brs's own figures (bankStoreState.view.brs), the server stamps who and when.
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
var bankStoreState = { view: null, mode: 'device', acct: '', statements: [], exceptions: [], chain: Promise.resolve(), say: '', signing: false };
const bankStoreState_SHOWN = 4;
/** a string made safe to put into the panel */
const bksE = (text) => (typeof bkbE === 'function' ? bkbE(text) : String(text));
/** true when the server says the shared record is not set up yet (503) */
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
async function bankStoreLoad(view) {
  bankStoreState = Object.assign(bankStoreState, { view: view, acct: view.acct, statements: [], exceptions: [], say: '', chain: Promise.resolve() });
  try {
    const log = (await api('booksBankLog', { query: { account: bankStoreState.view.acct, from: bankStoreState.view.from, to: bankStoreState.view.to }, fresh: true })) || {};
    bankStoreState.mode = 'server';
    bankStoreState.statements = log.statements || [];
    bankStoreState.exceptions = log.exceptions || [];
    const state = bankStoreReplay(log.marks);
    bkbSave('marks:' + bankStoreState.view.acct, state);
    return state;
  } catch (failure) {
    bankStoreState.mode = bksNotSetUp(failure) ? 'device' : 'error';
    bankStoreState.say = bksNotSetUp(failure) ? '' : (failure && failure.message) || '';
    return bkbLoad('marks:' + bankStoreState.view.acct, {});
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
  if (bankStoreState.mode === 'device') return;
  const acct = bankStoreState.view.acct,
    body = { account: acct, file_hash: (bankStoreState.view.file && bankStoreState.view.file.hash) || undefined, marks: [bankStoreMark(action)] };
  bankStoreState.chain = bankStoreState.chain
    .then(() => api('booksBankMarks', { body }))
    .then(() => {
      bankStoreState.mode = 'server';
      bankStoreState.say = '';
    })
    .catch((failure) => {
      bankStoreState.mode = bksNotSetUp(failure) ? 'device' : 'error';
      bankStoreState.say = bksNotSetUp(failure) ? '' : (failure && failure.message) || '';
    })
    .then(bankStorePaintLine);
}
/** the sentence under the note box: where the note is kept */
const bankStoreNoteWords = () =>
  bankStoreState.mode === 'server'
    ? tx('Kept for you and your accountant on the shared record. A note never stops you accepting.')
    : tx('Kept on this device. A note never stops you accepting.');
/** the one line saying where the marks are kept */
const bankStoreLine = () =>
  bankStoreState.mode === 'server'
    ? tx('Marks and notes are kept for your accountant too.')
    : bankStoreState.mode === 'device'
      ? tx('Saved on this device until the next update')
      : tx('Could not reach the shared record. Saved on this device for now.') + (bankStoreState.say ? ' ' + bankStoreState.say : '');

/* ── the sign-off: the figures the Statement tab shows, carried, never worked out again ── */
/** the statement the page carries: the BRS figures as the Statement tab shows them */
function bankStoreBody() {
  const worked = bankStoreState.view.brs,
    ledger = bankStoreState.view.ledgerRaw || {};
  return {
    account: bankStoreState.view.acct,
    period_from: bankStoreState.view.from,
    period_to: bankStoreState.view.to,
    opening_minor: Number(ledger.opening_minor) || 0,
    closing_bank_minor: worked.bank_balance_minor,
    closing_books_minor: worked.book_balance_minor,
    difference_minor: worked.difference_minor,
    currency: String(ledger.currency || bkCur() || '').toUpperCase(),
    file_hash: bankStoreState.view.file && bankStoreState.view.file.hash
  };
}
/** the confirm names its reach: which account, which period, what difference; and that it is kept and cannot be edited */
function bankStoreAsk(body) {
  const acct = (bankStoreState.view.accts || []).filter((item) => String(item.code) === String(bankStoreState.view.acct))[0];
  return {
    title: tx('Sign off this reconciliation?'),
    body:
      '<div data-testid="bank-signoff-reach">' +
      bksE(txf('{account}, {from} to {to}.', { account: (acct && acct.name) || bankStoreState.view.acct, from: bkDate(bankStoreState.view.from), to: bkDate(bankStoreState.view.to) })) +
      '<br>' +
      bksE(txf('Difference {amount}.', { amount: bkMoney(Math.abs(body.difference_minor), body.currency) })) +
      '<br>' +
      bksE(tx('It is kept for your accountant and cannot be edited. Signing again adds a new record.')) +
      '</div>',
    yes: tx('Sign off'),
    danger: false
  };
}
/** Sign off: confirm, then one POST /bank/statements; the signed list grows */
function bankStoreSignOff(btn) {
  if (!bankStoreState.view.brs || !bankStoreState.view.brs.ok || bankStoreState.mode !== 'server') return;
  const body = bankStoreBody();
  return CBAction.run(btn, () => api('booksBankStatements', { body }), {
    key: 'bank-signoff:' + bankStoreState.view.acct,
    confirm: bankStoreAsk(body),
    failed: tx('Could not sign off'),
    outcome: (reply) => {
      bankStoreState.statements = [(reply && reply.statement) || body].concat(bankStoreState.statements);
      bankStorePaintLine();
      toast(tx('Signed off.'));
    }
  });
}

/* ── what is drawn ── */
/** one row of a list: what on the left, the amount or state on the right */
const bksRow = (testId, left, right) => '<div class="pe-row" data-testid="' + testId + '"><span>' + bksE(left) + '</span><span class="mono">' + bksE(right) + '</span></div>';
/** "and n more" when a list shows only its first few rows */
const bksMore = (count) => (count > bankStoreState_SHOWN ? '<div class="pe-note">' + bksE(txf('and {n} more', { n: count - bankStoreState_SHOWN })) + '</div>' : '');
/** the signed statements, newest first, the first few */
function bankStoreSigned() {
  if (!bankStoreState.statements.length) return '';
  return (
    '<div class="pe-sub">' +
    bksE(tx('Signed off')) +
    '</div><div class="pe-rows" data-testid="bank-signed">' +
    bankStoreState.statements
      .slice(0, bankStoreState_SHOWN)
      .map((item) =>
        bksRow(
          'bank-signed-row',
          bkDate(String(item.at || '').slice(0, 10)) + ' · ' + (item.by || '') + ' · ' + tx('as at') + ' ' + bkDate(item.period_to),
          (item.tied ? tx('Tied') : tx('Difference') + ' ' + bkMoney(Math.abs(item.difference_minor), item.currency))
        )
      )
      .join('') +
    '</div>' +
    bksMore(bankStoreState.statements.length)
  );
}
/** the posted-not-accepted lines the log read named, the first few */
function bankStoreExceptions() {
  if (!bankStoreState.exceptions.length) return '';
  return (
    '<div class="pe-sub">' +
    bksE(tx('Posted from a bank line, not yet accepted')) +
    '</div><div class="pe-rows" data-testid="bank-exceptions">' +
    bankStoreState.exceptions
      .slice(0, bankStoreState_SHOWN)
      .map((item) => bksRow('bank-exception-row', txf('Entry {no}', { no: item.entry_no }) + ' · ' + bkDate(item.posting_date), bkMoney(item.amount_minor, item.currency)))
      .join('') +
    '</div>' +
    bksMore(bankStoreState.exceptions.length)
  );
}
/** the Sign off button: shown always, greyed with the reason while the record is not set up */
function bankStoreSignButton() {
  const worked = bankStoreState.view.brs;
  if (!worked || !worked.ok) return '';
  const notReady = bankStoreState.mode !== 'server';
  return (
    '<div class="supacts"><button data-cbsid="BKS014-B08" type="button" class="act" data-testid="bank-signoff"' +
    (notReady ? ' disabled aria-describedby="bk_store_line" title="' + bksE(tx('Signing off starts after the next update')) + '"' : '') +
    ' onclick="bankStoreSignOff(this)">' +
    bksE(tx('Sign off this reconciliation')) +
    '</button></div>'
  );
}
/** the whole panel: the line, the sign-off, the signed list, the exceptions */
const bankStorePanel = () =>
  '<div id="bk_store" data-testid="bank-store"><div class="pe-note" id="bk_store_line" data-testid="bank-store-line" data-mode="' +
  bankStoreState.mode +
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
