/* app/cap-bank-sheet-lock.js — the Bank view's LOCKED MONTH capability: the notice under the band for each locked month, Post in the next open month, Reopen with a reason. Split out of cap-bank-sheet.js, code moved verbatim; nothing is worked out here, the month rows and who may are the server's.
 * OWNS      bkshMonthRows · bkshReadMonths · bkshLockGroups · bkshLockNotice · bkshLockRepaint · bkshLockMove · bkshReopen · bkshReopenGo
 * CALLED BY public/accounts.html (script tag, before cap-bank-sheet.js); cap-bank-sheet.js and cap-bank.js call it at run time (bkshLockNotice, bkshReadMonths); its functions are global
 * FLOW      bankSheetOpen (cap-bank-sheet.js) → bkshReadMonths → bkshLockNotice (the band's notice) → bkshReopen / bkshLockMove → bkshLockRepaint
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
'use strict';
/* ── W15-85 · A LOCKED MONTH, SAID BEFORE ANY WORK ─────────────────────────────────────────────────────────────────────────────────
 * The month rows are the server's (GET /periods, kept by cap-books.js in BK.lk.info); bank-lock.js reads them for a day. The band says which months are locked and offers two ways on: reopen the month
 * (whoever the server says may: reopen.may, through the same unlock the Month lock page uses, with a reason) or post those lines in the next open month, noted. Nothing here is worked out twice. */
/** the month rows the controller reads: the server's rows of every year it holds, [] before they are read */
const bkshMonthRows = () => Object.keys((typeof BK !== 'undefined' && BK.lk && BK.lk.info) || {}).map((key) => BK.lk.info[key]);
async function bkshReadMonths() {
  try {
    if (typeof bkPeriodsLoad === 'function') await bkPeriodsLoad();
  } catch (failure) {
    bkQuiet('bank-months', failure); /* the page still works: a locked month is then the server's answer on the line, as before */
  }
}
/** the locked months with lines in them, as the band words them: [{ key, label, name, by, at, may, next, count, moved, fy, period }] */
const bkshLockGroups = () => CBBankLock.groupsOf(BKSH.ctl && BKSH.ctl.view().items, BKSH.ctl && BKSH.ctl.movedMonths && BKSH.ctl.movedMonths());
/** the notice under the band for each locked month. Reopen is the owner's act. Posting in the next open month is the owner's, and the accountant's where the grant lets her post (the accountant does the books for the owner; the entry carries the firm's name) */
function bkshLockNotice() {
  const signedIn = bkshSignedIn(),
    owner = signedIn.role === 'owner',
    mayPost = owner || signedIn.role === 'bookkeeper' || (signedIn.role === 'adviser' && !!signedIn.posts);
  return bkshLockGroups()
    .map((group, at) => {
      const reopen = owner && group.may ? '<button data-cbsid="BKS014-B60" type="button" class="act" data-testid="bank-lock-reopen-' + at + '" data-gk="' + bkbE(group.key) + '" onclick="bkshReopen(this.dataset.gk)">' + bkbE(txf('Reopen {month}', { month: group.name })) + '</button>' : '',
        move = mayPost && group.next && !group.moved ? '<button data-cbsid="BKS014-B61" type="button" class="act" data-testid="bank-lock-move-' + at + '" data-gk="' + bkbE(group.key) + '" onclick="bkshLockMove(this.dataset.gk, true)">' + bkbE(txf('Post in {month} instead', { month: group.next.name })) + '</button>' : '',
        back = mayPost && group.moved ? '<button data-cbsid="BKS014-B62" type="button" class="act" data-testid="bank-lock-undo-' + at + '" data-gk="' + bkbE(group.key) + '" onclick="bkshLockMove(this.dataset.gk, false)">' + bkbE(tx('Keep them out')) + '</button>' : '';
      return '<div class="bk-lock" role="status" data-testid="bank-lock-' + at + '"><span class="bk-lock-w">' + bkbE(group.moved ? CBBankLock.movedWords(group) : CBBankLock.noticeWords(group)) + '</span>' + reopen + move + back + '</div>';
    })
    .join('');
}
/** the page's band and lines follow a choice about a locked month */
function bkshLockRepaint() {
  const slot = bkbEl('bk_bandslot');
  if (slot) slot.innerHTML = bankFinish();
  if (typeof bkshTodo === 'function') bkshTodo();
  if (BKB.lines) BKB.lines.refresh();
  if (BKSH.ui && bkshEl('bks_lines')) bkshPaint();
}
/** "Post in October instead" (on) or take it back (off) */
function bkshLockMove(key, on) {
  if (!BKSH.ctl) return;
  BKSH.ctl.moveLocked(key, !!on);
  bkshLockRepaint();
}
/** "Reopen September": the reason is asked first and kept (the Month lock page's own unlock); the month rows and the lines are read again */
function bkshReopen(key) {
  const group = bkshLockGroups().filter((one) => one.key === key)[0];
  if (!group) return;
  ui.dialog({
    mount: 'BKS014-U05', pop: 'POP092', titleText: txf('Reopen {month}?', { month: group.label }),
    bodyStyle: 'display:flex;flex-direction:column;gap:8px',
    body: peField('bk_lkwhy', 'Reason', peInput('bk_lkwhy', '', tx('Needed to open a month again'), 'text', ' maxlength="200" autocomplete="off"')) + '<div id="bk_lkout" class="pe-slot" role="alert"></div>',
    footerHtml: '<button data-cbsid="BKS014-B63" type="button" onclick="closeModal()">' + bkbE(tx('Cancel')) + '</button><button data-cbsid="BKS014-B64" type="button" class="pri" data-testid="bank-lock-reopen-go" data-gk="' + bkbE(key) + '" onclick="bkshReopenGo(this.dataset.gk)">' + bkbE(tx('Reopen')) + '</button>'
  });
}
/** the Reopen press: the reason typed, the month opened again through the api, the sheet read again */
async function bkshReopenGo(key) {
  const group = bkshLockGroups().filter((one) => one.key === key)[0],
    reason = String(peVal('bk_lkwhy') || '').trim(),
    out = bkbEl('bk_lkout');
  if (!group) return closeModal();
  if (!reason) return void (out && (out.textContent = tx('Say why — the reason is kept')));
  try {
    await api('booksUnlock', { params: { fy: group.fy, p: group.period }, body: { reason, hard: false } });
  } catch (failure) {
    return void (out && (out.textContent = bkWhy(failure, tx('Could not change it'))));
  }
  closeModal();
  await bkshReadMonths();
  if (BKSH.ctl) BKSH.ctl.answer('ledger_read', Date.now());
  bkshLockRepaint();
  toast(txf('{month} is open again.', { month: group.label }));
}
