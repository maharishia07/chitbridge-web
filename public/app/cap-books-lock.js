/* app/cap-books-lock.js — CB ACCOUNTS: the Month lock tab's rows and buttons (who locked, why a month waits, Lock · Reopen). Split out of cap-books.js (file-size ratchet, 20 Nov), code moved unchanged.
 * OWNS      the month-lock rows: bkLockWho · bkLockWhyWords · bkLockView · bkLockRule · bkLockRowHTML · bkLockButtonsHTML · bkLockRowsPaint · bkLockWhy · bkLockReopen · bkLockReopenGo · bkLockDo · bkReasonDialog · bkReasonGo
 * CALLED BY public/accounts.html, crm.html, finance.html, tasks.html (script tag, after cap-books.js) · app.html CAP_WITH books; its functions are global and cap-books.js calls them at run time
 * FLOW      the Month lock tab → bkLockView → bkLockRowsPaint (one row per month) → Lock / Reopen → bkLockDo (the server decides; the row repaints from its answer)
 * CARD      16-finance/cb-finance
 */
'use strict';
/** W15-97: the words of a month's lock history and of the month a Lock waits for are lock-words.js' (the auditor's Months say the same) */
function bkLockWho(x, st) {
  return CBLockWords.whoOf(x, st);
}
function bkLockWhyWords(x, kind) {
  return CBLockWords.whyOf(x, kind, bkMonths().map(tx)) || (x && x[kind] && x[kind].why) || '';
}
/* the Month lock tab: the year picker and its twelve month rows */
async function bkLockView(body) {
  try {
    await bkPeriodsLoad();
  } catch (e) {
    body.innerHTML = bkErr(e);
    return;
  }
  var own = bkIsOwner();
  body.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:8px;max-width:900px">' +
    '<label style="max-width:420px">' +
    tx('Financial year') +
    bkFyPicker('lk_fy', 'lk_fy', 'width:100%') +
    '</label>' +
    '<div id="lk_rows" data-testid="lk_rows"></div>' +
    '<div id="lk_fx"></div>' /* FX1 (cap-fx.js): the foreign balances of the month to lock next — revalue, then lock */ +
    '<div id="lk_foot" data-testid="lk_note" style="color:var(--grey);font-size:var(--fs-1)"></div>' +
    '<div id="lk_out" data-testid="lk_out" style="font-size:var(--fs-1)"></div></div>';
  bkLockRowsPaint();
}
/** what the server says about one month: may it be locked, may it open again, who did what, and the sentence when it may not */
function bkLockRule(info, state) {
  var mayLock = !info || !info.lock || info.lock.may,
    lockWhy = info && info.lock && info.lock.why ? bkLockWhyWords(info, 'lock') : '',
    openMay = !info || !info.reopen || info.reopen.may !== false;
  return {
    may: mayLock,
    openMay: openMay,
    why: lockWhy,
    who: bkLockWho(info, state),
    blocked: state === 'open' ? !mayLock : state === 'soft_locked' && !openMay,
    blockWhy: state === 'open' ? lockWhy : bkLockWhyWords(info, 'reopen')
  };
}
/** one month's row of the lock table: its state with who did it, the entries and sales, and the button the SERVER says may be pressed (owner only) with the reason it may not */
function bkLockRowHTML(item, index, isOwner) {
  var lock = BK.lk,
    month = index + 1,
    state = lock.rows[lock.fy + '|' + month] || 'open',
    info = (lock.info || {})[lock.fy + '|' + month] || null,
    rule = bkLockRule(info, state);
  rule.lastHard = bkLastHardKey() === lock.fy + '|' + month; /* Reopen month only on the LAST hard-locked month */
  var buttons = bkLockButtonsHTML(isOwner, state, month, rule);
  return (
    '<tr data-testid="lk-row-' +
    month +
    '"><th scope="row">' +
    tx(item) +
    '</th><td data-testid="lk-state-' +
    month +
    '" data-state="' +
    esc(state) +
    '">' +
    (BK_PERIOD_SYM[state] || '') +
    ' ' +
    esc(CBLockWords.stateWord(state)) +
    bkLockWhoHTML(month, rule.who) +
    '</td><td data-testid="lk-figs-' +
    month +
    '" class="num lk-ent">' +
    esc(String((info && info.entries) || 0)) +
    '</td><td class="num lk-sales">' +
    (info && info.sales_minor === undefined ? '—' : info && info.sales_minor ? bkMoney(info.sales_minor) : esc(tx('No income'))) + /* STAFF-BOOKS: a seat that may not read figures gets none: a dash, never "No sales" */
    '</td><td class="lk-act">' +
    buttons +
    (buttons ? bkLockWhyHTML(month, state, info, rule.blocked, rule.blockWhy) : '') +
    '</td></tr>'
  );
}
/** the Lock button of an open month, or Open again + Close for good of a soft-locked one (owner only); a refused one is disabled with the server's sentence */
function bkLockButtonsHTML(isOwner, st, month, rule) {
  var b = '',
    mayLock = rule.may,
    openMay = rule.openMay,
    lockWhy = rule.why,
    blockWhy = rule.blockWhy;
  if (isOwner && st === 'open')
    b =
      '<button data-cbsid="CMP042-B07"' + bkMountAttribute('CMP042') + ' type="button"' + (mayLock ? ' class="supact-pri"' : '') + ' data-testid="lk-lock-' +
      month +
      '"' +
      (mayLock
        ? " onclick=\"bkLockDo('lock'," + month + ')" title="' + esc(tx('Stops entries · reopens with a reason')) + '"'
        : ' disabled style="opacity:.55;cursor:not-allowed" title="' + esc(tx(lockWhy)) + '"') +
      '>🔒 ' +
      tx('Lock') +
      '</button>';
  if (isOwner && st === 'soft_locked')
    b =
      '<button data-cbsid="CMP042-B08"' + bkMountAttribute('CMP042') + ' type="button" data-testid="lk-unlock-' +
      month +
      '"' + (openMay ? ' onclick="bkLockReopen(' + month + ')"' : ' disabled style="opacity:.55;cursor:not-allowed" title="' + esc(tx(blockWhy)) + '"') + '>🔓 ' +
      tx('Open again') +
      '</button> <button data-cbsid="CMP042-B09"' + bkMountAttribute('CMP042') + ' type="button" data-testid="lk-hard-' +
      month +
      '" onclick="bkLockDo(\'hard\',' +
      month +
      ')">⛔ ' +
      tx('Close for good') +
      '</button>';
  if (isOwner && st === 'hard_locked' && rule.lastHard !== false)
    b =
      '<button data-cbsid="CMP042-B28"' + bkMountAttribute('CMP042') + ' type="button" data-testid="lk-reopen-month-' + month + '" onclick="bkLockReopen(' + month + ', true)" title="' + esc(tx('Only the last closed month can be reopened, with a reason; it is logged.')) + '">🔓 ' + tx('Reopen month') + '</button>';
  return b;
}
/** who locked or opened the month, and its history (the first row's line, the notes and the full list on a fold) */
function bkLockWhoHTML(p, who) {
  return (
    (who.line || who.note ? '<div class="lk-who" data-testid="lk-who-' + p + '">' + esc([who.line, who.note].filter(Boolean).join('. ')) + '</div>' : '') +
    (who.all.length > 1 ? '<details class="lk-hist" data-testid="lk-hist-' + p + '"><summary>' + esc(txf('History ({n})', { n: who.all.length })) + '</summary><ul>' + who.all.map(function (words) { return '<li>' + esc(words) + '</li>'; }).join('') + '</ul></details>' : '')
  );
}
/** the line under a refused button: why it is blocked, shortened, with the return still to close when that is the reason */
function bkLockWhyHTML(p, st, x, blocked, blockWhy) {
  return (
    (!blocked ? '' : '<button data-cbsid="SCR013-B02" type="button" class="lk-why" aria-expanded="false" data-testid="lk-why-' + p + '" data-short="' + esc(tx(blockWhy)) + '" data-full="' + esc(tx(blockWhy) + (st === 'open' && x && x.return && !x.return.closed ? ' ' + txf('{form} {label} not closed yet', { form: x.return.form, label: x.return.label }) : '')) + '" title="' + esc(tx(blockWhy)) + '" onclick="bkLockWhy(this)">' + esc(tx(blockWhy)) + '</button>')
  );
}
/**
 * the twelve months, April to March: state as a word and a symbol, its entries and sales, and the actions the SERVER says it may do (owner only).
 * M157: ONE rule, read from GET /periods - Lock for a finished month, oldest first (else greyed with the server's sentence); the Reason box and the foot
 * follow reopen.may, so the page never promises what the server will refuse.
 */
function bkLockRowsPaint() {
  var el = document.getElementById('lk_rows'),
    L = BK.lk,
    own = bkIsOwner();
  if (!el) return;
  if (typeof fxLockLine === 'function') fxLockLine();
  var foot = document.getElementById('lk_foot');
  if (foot) foot.textContent = !own ? '' : tx('A locked month opens again with a reason, asked when you press Open again. Close for good never opens.');
  var rows = bkMonths()
    .map(function (item, index) {
      return bkLockRowHTML(item, index, own);
    })
    .join('');
  el.innerHTML =
    '<style>@media(max-width:620px){.lk-t thead{display:none}.lk-t,.lk-t tbody{display:block}.lk-t tr{display:grid;grid-template-columns:auto 1fr auto;gap:2px 10px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--line)}.lk-t td,.lk-t th{padding:0!important}.lk-t .lk-ent{display:none}.lk-t .lk-act{grid-column:1 / -1}.lk-t .lk-sales{text-align:right}}.lk-t button.lk-why{background:none!important;border:0!important;box-shadow:none!important;padding:0!important;min-height:0!important;font:inherit!important;font-size:var(--fs-1)!important;font-weight:400!important;color:var(--grey)!important;text-align:left;cursor:pointer;display:inline-block;vertical-align:middle;margin-left:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%}@media(max-width:620px){.lk-t button.lk-why{display:block;margin:2px 0 0;max-width:100%}}.lk-t button.lk-why[aria-expanded=true]{white-space:normal;max-width:100%}.lk-who{color:var(--grey);font-size:var(--fs-1);font-weight:400}.lk-hist{font-size:var(--fs-1);color:var(--grey)}.lk-hist summary{cursor:pointer;display:inline-block}.lk-hist ul{margin:2px 0 0;padding-left:16px}.lk-box{max-height:calc(100vh - 405px);min-height:160px;overflow:auto}body:has(#acting-band) .lk-box{max-height:calc(100vh - 465px)}@media(max-width:620px){.lk-box{max-height:calc(100vh - 480px)}}.lk-t th{position:sticky;top:0;background:var(--surface,#fff);z-index:1}.lk-t td,.lk-t th{padding:3px 8px;text-align:left;vertical-align:middle}.lk-t .num{text-align:right}.lk-t button{padding:3px 10px;min-height:0}</style>' +
    '<div class="lk-box" data-testid="lk-box"><table class="tbl lk-t" data-testid="lk-table" style="width:100%;border-collapse:collapse;font-size:var(--fs-1)"><thead><tr><th>' +
    tx('Month') +
    '</th><th>' +
    tx('State') +
    '</th><th class="num">' +
    tx('Entries') +
    '</th><th class="num">' +
    tx('Income before tax') +
    '</th><th></th></tr></thead><tbody>' +
    rows +
    '</tbody></table></div>';
}
/** the reason line opens in place to the full sentence (tap or Enter), shut again on the next press */
function bkLockWhy(node) {
  var open = node.getAttribute('aria-expanded') !== 'true';
  node.setAttribute('aria-expanded', open ? 'true' : 'false');
  node.textContent = node.getAttribute(open ? 'data-full' : 'data-short');
}
/**
 * W15-97 · OPEN AGAIN asks its reason in its own popup, beside the button that sends it (the box used to sit under the twelve rows, apart from the action). The reason is kept in the trail with the name and the day; Cancel sends nothing.
 */
function bkLockReopen(period, hard) {
  var monthName = tx(bkMonths()[period - 1] || String(period));
  bkReasonDialog({
    title: txf('Open {m} again?', { m: monthName + ' ' + String((((BK.lk.info || {})[BK.lk.fy + '|' + period]) || {}).start_date || BK.lk.fy).slice(0, 4) }),
    go: function (reason) { return bkLockDo(hard ? 'reopen' : 'unlock', period, reason); }
  });
}
/** ⭐ THE ONE "why are you opening it again?" dialog (POP092): a month's Open again, a hard-locked month's Reopen month and a closed year's Reopen year all ask the reason here, then Confirm sends it (the reason is required, kept in the change log) */
function bkReasonDialog(o) {
  BK.reasonGo = o.go;
  /* where-used: out-of-scope the mount is bkDialogMount(6): the host screen's own code plus -U26, so it cannot be one literal */
  ui.dialog({
    mount: bkDialogMount(6),
    pop: 'POP092',
    titleText: o.title,
    bodyStyle: 'display:flex;flex-direction:column;gap:8px',
    body:
      '<label>' + tx('Why are you opening it again?') + '<input class="inp" data-cbsid="CMP040-I01"' + bkMountAttribute('CMP040') + ' id="lk_why" data-testid="lk_why" maxlength="200" autocomplete="off" placeholder="' + esc(tx('Needed to open a month again')) + '"></label>' +
      '<div id="lk_whyout" data-testid="lk-whyout" role="alert" style="color:var(--warn-2)"></div>',
    footerHtml:
      '<button type="button" data-cbsid="CMP003-B01"' + bkMountAttribute('CMP003') + ' onclick="closeModal()">' + tx('Cancel') + '</button>' +
      '<button type="button" class="supact-pri" data-cbsid="CMP042-B08"' + bkMountAttribute('CMP042') + ' data-testid="lk-reopen-go" onclick="bkReasonGo()">' + tx(o.yes || 'Open again') + '</button>'
  });
}
function bkReasonGo() {
  var reason = String((document.getElementById('lk_why') || {}).value || '').trim(),
    out = document.getElementById('lk_whyout');
  if (!reason) {
    if (out) out.textContent = tx('Say why — the reason is kept');
    return;
  }
  closeModal();
  return BK.reasonGo ? BK.reasonGo(reason) : undefined;
}
/* lock or unlock one month, asking the server and flipping only that row */
async function bkLockDo(what, period, reason) {
  var lockState = BK.lk,
    fiscalYear = lockState.fy,
    node = reason || '',
    out = document.getElementById('lk_out');
  var monthName = tx(bkMonths()[period - 1] || String(period));
  if ((what === 'unlock' || what === 'reopen') && !node.trim()) return; /* the reason is asked in bkLockReopen, beside the button that sends it */
  /* ⭐ M64: through CBAction — ONE write per month at a time (whichever of its buttons), Close for good asks first in the
     page's own dialog (Cancel sends nothing), and the outcome is said in lk_out beside the months */
  var btn = document.querySelector('[data-testid="lk-' + what + '-' + period + '"]');
  return CBAction.run(
    btn,
    function () {
      return api(what === 'reopen' ? 'booksReopenMonth' : what === 'unlock' ? 'booksUnlock' : 'booksLock', { params: { fy: fiscalYear, p: period }, body: { reason: node, hard: what === 'hard' } });
    },
    {
      key: 'lk-' + fiscalYear + '-' + period,
      out: 'lk_out',
      failed: tx('Could not change it'),
      confirm:
        what === 'hard'
          ? { title: tx('Close for good?'), body: esc(txf('{m} {fy} will never open again.', { m: monthName, fy: fiscalYear })), yes: tx('Close for good') }
          : { title: txf('Lock {m} {fy}?', { m: monthName, fy: fiscalYear }), body: esc(tx('No entries can be added to it. It opens again with a reason.')), yes: tx('Lock'), danger: false }, /* E12: Lock is a commit, so it asks first in the library's confirm */
      /* after the server answers: flip the one month row, then reload the periods */
      outcome: function (answer) {
        var status = (answer && answer.period && answer.period.status) || (what === 'reopen' && answer && answer.status) || (what === 'reopen' ? 'open' : '');
        if (status) lockState.rows[fiscalYear + '|' + period] = status; /* flip the ROW, never the whole list */
        if (lockState.fy === fiscalYear) bkLockRowsPaint();
        bkPeriodsLoad()
          .then(function () {
            if (BK.lk.fy === fiscalYear) bkLockRowsPaint();
          })
          .catch(function (failure) {
            bkQuiet('periods-reload', failure);
          }); /* M157: the server's may/why moves with the lock (the next month opens up, the reason box follows) */
        var element = document.getElementById('lk_out');
        if (element) element.textContent = txf('{m} {fy} · {s}', { m: monthName, fy: fiscalYear, s: status ? CBLockWords.stateWord(status) : tx('Done') });
      }
    }
  );
}
