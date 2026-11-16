/* cap-bank-home.js — the BANK HOME and the way back to it (l16, W15-84; Athi 16 Nov: "you always need to land on one page when you press the bank").
 * OWNS      the page the menu's Bank always opens on (the Statements box grown: one row per account, the months across: ✓ signed off · ● not signed off · Missing) · the cards for unfinished months (Continue) ·
 *           the trail "← Bank › account › Month YYYY" over a statement's lines and its Back · the #bank/<account>/<YYYY-MM> entry the browser's Back and Forward walk.
 * CALLED BY cap-bank.js (bankView lands here; bankPaint → bankHomeEnter when lines show) and cap-bank-statements.js (bankStmtPaint draws the grid and cards; Read → bankStmtReadFile). Loaded after cap-bank-statements.js by public/accounts.html.
 * FLOW      menu Bank → bankView → BKB.view = 'home' → bankStmtMount (GET /bank/statement-files) + bankHomeSigned (GET /bank/log per account: the sign-offs) → a month pressed / Continue / Read → the kept file into the ONE reader → bankPaint → bankHomeEnter (view 'lines', pushState #bank/<code>/<month>) → Back = history.back() → popstate → bankHomeShow.
 * ⭐ ONE LANDING: the device's last statement never decides the landing page (cap-bank.js no longer restores it on open); it may still be picked when the account is changed on the plain picker.
 * ⭐ NO NEW READ AND NO MONEY: a month is ✓ only when GET /bank/log (the page's own sign-off record) lists a statement signed for that account whose period ends in it; kept and not signed is ●. When the log cannot be read the cell says "Kept", never ✓.
 * ⭐ A LINE COUNT only where it is known: the device's count of lines that need a person (bankTodoItem's record) is shown on the card of the statement it was counted for; else the card says "Not signed off yet".
 * IDS       BKS014-B46 (Back to the Bank home) · BKS014-B47 (a month: open its lines) · BKS014-B48 (Continue an unfinished month). A missing month keeps BKS014-B44 (cap-bank-statements.js).
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
'use strict';
const BKH = { signed: {}, known: false, noPush: false };
const bkhE = (text) => (typeof bkbE === 'function' ? bkbE(text) : String(text));
/** 'September 2026' for '2026-09', in the reader's language (a date helper, no money) */
function bkhMonthLong(month) {
  try {
    return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch (_) {
    return month;
  }
}
const bkhAccountById = (id) => ((BKST.data && BKST.data.accounts) || []).filter((item) => item.account_id === id)[0] || null;
const bkhAccountByCode = (code) => ((BKST.data && BKST.data.accounts) || []).filter((item) => String(item.code) === String(code))[0] || null;
const bkhCellOf = (account, month) => BKST.data.cells.filter((item) => item.account_id === account.account_id && item.month === month)[0];
/** the sign-offs of every account the box lists: the same GET /bank/log the lines view reads; one that fails leaves the whole answer unknown (cells say Kept) */
async function bankHomeSigned() {
  const accounts = (BKST.data && BKST.data.accounts) || [],
    next = {};
  let known = true;
  await Promise.all(
    accounts.map(async (account) => {
      try {
        const log = await api('booksBankLog', { query: { account: String(account.code) }, fresh: true });
        next[account.account_id] = (log && log.statements) || [];
      } catch (_) {
        known = false;
      }
    })
  );
  BKH.signed = next;
  BKH.known = known && accounts.length > 0;
}
/** 'missing' · 'signed' · 'open' (kept, lines to do) · 'kept' (the sign-off record could not be read) */
function bankHomeState(account, month, cell) {
  if (!cell || cell.missing) return 'missing';
  if (!BKH.known) return 'kept';
  return (BKH.signed[account.account_id] || []).some((item) => String(item.period_to || '').slice(0, 7) === month) ? 'signed' : 'open';
}
const bankHomeMayAdd = () => typeof bkbMayAct === 'function' && bkbMayAct();
/** the unfinished months, newest first: one card each (at most three), the rest said as a count */
function bankHomeCardsHtml() {
  const data = BKST.data;
  if (!data || !data.accounts.length) return '';
  const open = [];
  data.accounts.forEach((account) => data.months.forEach((month) => bankHomeState(account, month, bkhCellOf(account, month)) === 'open' && open.push({ account, month })));
  if (!open.length) return '';
  open.sort((first, second) => second.month.localeCompare(first.month));
  const todo = bkbLoad('todo', null),
    many = data.accounts.length > 1;
  const cards = open.slice(0, 3).map(({ account, month }) => {
    const counted = todo && Number(todo.n) > 0 && String(todo.acct) === String(account.code) && String(todo.to || '').slice(0, 7) === month,
      words = counted ? txn('{count} line needs you', '{count} lines need you', Number(todo.n)) : tx('Not signed off yet');
    return (
      '<div class="bkh-card" data-testid="bank-home-card-' + bkhE(account.account_id) + '-' + bkhE(month) + '"><span class="bkh-dot" aria-hidden="true">●</span><span class="bkh-words">' + bkhE(bkhMonthLong(month)) + (many ? ' · ' + bkhE(bkstAccountName(account)) : '') + ' · ' + bkhE(words) + '</span>' +
      '<button data-cbsid="BKS014-B48" type="button" class="bks-btn bkh-go" data-testid="bank-home-continue" data-acct="' + bkhE(account.account_id) + '" data-month="' + bkhE(month) + '" onclick="bankHomePress(this)">' + bkhE(tx('Continue')) + '</button></div>'
    );
  });
  return '<div class="bkh-cards" data-testid="bank-home-cards">' + cards.join('') + (open.length > 3 ? '<div class="pe-note">' + bkhE(txf('and {n} more', { n: open.length - 3 })) + '</div>' : '') + '</div>';
}
/** the grid: one row per account, the months across; a month with a statement opens its lines */
function bankHomeGridHtml() {
  const data = BKST.data;
  if (!data || !data.accounts.length) return '';
  const head = '<tr><th scope="col">' + bkhE(tx('Account')) + '</th>' + data.months.map((month) => '<th scope="col">' + bkhE(bkstMonth(month)) + '</th>').join('') + '</tr>',
    mayAdd = bankHomeMayAdd();
  const rows = data.accounts
    .map((account) => {
      const cells = data.months
        .map((month) => {
          const cell = bkhCellOf(account, month),
            state = bankHomeState(account, month, cell),
            key = bkhE(account.account_id) + '-' + bkhE(month);
          if (state === 'missing')
            return mayAdd
              ? '<td class="bks-gap"><button data-cbsid="BKS014-B44" type="button" class="bks-miss" data-testid="bank-stmts-miss-' + key + '" data-acct="' + bkhE(account.code || '') + '" onclick="bankStmtPickGap(this)" title="' + bkhE(tx('Add a statement for this account')) + '">' + bkhE(tx('Missing')) + '</button></td>'
              : '<td class="bks-gap"><span class="bks-sum" data-testid="bank-stmts-miss-' + key + '">' + bkhE(tx('Missing')) + '</span></td>';
          const crossed = cell.file_ids.some((id) => (data.files.filter((item) => item.id === id)[0] || {}).overlaps),
            mark = state === 'open' ? '●' : state === 'signed' ? '✓' : '◦',
            word = state === 'signed' ? tx('Signed off') : state === 'open' ? tx('Not signed off yet') : tx('Kept');
          return (
            '<td class="bks-have bkh-' + state + '" data-testid="bank-stmts-have-' + key + '"><button data-cbsid="BKS014-B47" type="button" class="bkh-cell" data-testid="bank-home-month-' + key + '" data-acct="' + bkhE(account.account_id) + '" data-month="' + bkhE(month) + '" onclick="bankHomePress(this)" title="' + bkhE(word + ' · ' + bkhMonthLong(month)) + '" aria-label="' + bkhE(bkstAccountName(account) + ', ' + bkhMonthLong(month) + ', ' + word) + '"><span aria-hidden="true">' + mark + '</span> ' + bkhE(String(cell.file_ids.length)) + '</button>' + (crossed ? ' <span class="bks-flag">' + bkhE(tx('overlap')) + '</span>' : '') + '</td>'
          );
        })
        .join('');
      return '<tr><th scope="row">' + bkhE(bkstAccountName(account)) + '</th>' + cells + '</tr>';
    })
    .join('');
  return (
    '<div class="bks-wrap"><table class="bks-grid" data-testid="bank-stmts-grid"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="pe-note bkh-key" data-testid="bank-home-key">✓ ' + bkhE(tx('signed off')) + ' · ● ' + bkhE(tx('not signed off yet')) + ' · ' + bkhE(tx('Missing')) + '</div>'
  );
}
/** a month pressed, or Continue: that statement's lines */
function bankHomePress(button) {
  return bankHomeOpen(bkhAccountById(button.getAttribute('data-acct')), button.getAttribute('data-month'));
}
/** open the lines of the (newest) file kept for this account and month; a month with none says so on the home */
function bankHomeOpen(account, month) {
  const cell = account && BKST.data ? bkhCellOf(account, month) : null,
    files = cell && !cell.missing ? BKST.data.files.filter((item) => cell.file_ids.indexOf(item.id) >= 0) : [];
  if (!files.length) return peBad('bks_out', tx('That statement is no longer here.'));
  files.sort((first, second) => String(second.period_to).localeCompare(String(first.period_to)));
  return bankStmtReadFile(files[0].id);
}

/* ── the lines view: the trail and the Back ── */
/** the one line over a statement's lines: ← Bank › account › Month YYYY */
function bankHomeTrailHtml() {
  const account = bkhAccountByCode(BKB.acct),
    ledger = (BKB.accts || []).filter((item) => String(item.code) === String(BKB.acct))[0] || {},
    name = account ? bkstAccountName(account) : ledger.name || '',
    month = String(BKB.to || '').slice(0, 7);
  return (
    '<nav class="bkh-trail" data-testid="bank-home-trail" aria-label="' + bkhE(tx('Where you are')) + '"><button data-cbsid="BKS014-B46" type="button" class="bks-btn bkh-back" id="bkh_back" data-testid="bank-home-back" onclick="bankHomeBack()">← ' + bkhE(tx('Bank')) + '</button>' +
    '<span class="bkh-crumbs" aria-current="page"><span aria-hidden="true">›</span> ' + bkhE(name) + (month ? ' <span aria-hidden="true">›</span> ' + bkhE(bkhMonthLong(month)) : '') + '</span></nav>'
  );
}
/** the lines are on screen (cap-bank.js bankPaint): the view is 'lines' and the browser has an entry to go Back to */
function bankHomeEnter() {
  if (BKB.view === 'lines') return;
  BKB.view = 'lines';
  if (BKH.noPush) {
    BKH.noPush = false; /* the browser's Forward brought us here: the entry is in the history already */
    return;
  }
  const month = String(BKB.to || '').slice(0, 7);
  try {
    history.pushState({ bk: 1 }, '', '#bank/' + encodeURIComponent(BKB.acct) + (month ? '/' + month : ''));
  } catch (_) {}
}
/** Back: one step in the browser's history when the lines were entered from the home (the popstate paints the home), else straight to the home */
function bankHomeBack() {
  if (history.state && history.state.bk) history.back();
  else bankHomeShow();
}
/** the home over everything: the lines are cleared from the screen, the box is read again (a sign-off just made shows) */
function bankHomeShow() {
  BKB.view = 'home';
  try {
    if (/^#bank\//.test(location.hash)) history.replaceState(null, '', '#bank');
  } catch (_) {}
  const res = bkbEl('bk_res'),
    out = bkbEl('bk_out');
  if (res) res.innerHTML = '';
  if (out) out.innerHTML = '';
  bankLayout(false, false);
  bankHomeClass();
  if (BKST.mode === 'server') bankStmtLoad().then(bankHomeFocus).catch(() => {});
  else bankStmtPaint();
}
/** the pane wears bk-home while the box is the page (the plain picker folds; it stays when the box is not ready) */
function bankHomeClass() {
  const pane = document.querySelector('.pe-bank');
  if (pane) pane.classList.toggle('bk-home', BKB.view === 'home' && BKST.mode === 'server');
}
/** the keyboard lands on the first press of the home */
function bankHomeFocus() {
  const node = document.querySelector('.bkh-cell,.bkh-go,.bks-tog');
  if (node) node.focus({ preventScroll: true });
}
/** the browser's Back and Forward: #bank is the home, #bank/<code>/<YYYY-MM> is that statement's lines */
function bankHomeRoute() {
  if (!/^#bank(\/|$)/.test(location.hash) || !bkbEl('bk_stmts')) return;
  const hit = /^#bank\/([^/]+)\/(\d{4}-\d{2})$/.exec(location.hash);
  if (!hit) return BKB.view === 'lines' ? bankHomeShow() : undefined;
  const code = decodeURIComponent(hit[1]);
  if (BKB.view === 'lines' && String(BKB.acct) === code && String(BKB.to || '').slice(0, 7) === hit[2]) return;
  const account = bkhAccountByCode(code),
    cell = account ? bkhCellOf(account, hit[2]) : null;
  if (cell && !cell.missing) {
    BKB.view = 'home'; /* the entry is already in the history: bankHomeEnter pushes none */
    BKH.noPush = true;
    return bankHomeOpen(account, hit[2]);
  }
  bankHomeShow();
}
window.addEventListener('popstate', bankHomeRoute);
