/* cap-finance.js — CB Finance · Collections (round F1): who owes you, how old, the limit, the interest it has earned, Remind, Receive.
 * Loaded by finance.html only (after cap-books.js, list-ctl.js, rail-thread.js). docs: C:/dev/CB-FINANCE-PLAN.md §4 F1.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): CBList.mount (the one list) · bkDuesStore / bkDuesSide / bkDuesAge / bkMoney / bkOwes /
 * bkDate / bkPartyLabel (cap-books.js — the Dues words) · payOpen (THE one payment path: Receive) · bkRemind (M28, through CBThread) ·
 * CBAction (M64) · api('booksDues') — the existing EP row, asked with finance=1.
 * ⭐ ONE CALCULATION (rule 2): this file computes NO money. Balance, oldest due, the limit, over_limit and the interest are the server's
 * (/api/books/dues?finance=1); a row paints them. Interest is SHOWN, never posted (decision). Over a limit the till still lets the owner's
 * PIN through (PIN-allow) — this tab only says it.
 * ⭐ NEW PATHS (rule 4): FIN (the page's state), the batch-Remind sheet (the list's bulk action has no composer of its own: each party's
 * Remind is bkRemind, one after another), the denied card (the server said "owner only" — the sentence, greyed).
 * ⚠️ Never error.message on a screen: a failure says what happened and offers Try again.
 */
'use strict';

var FIN = { gen: 0, rows: [], cur: 'INR', state: 'loading', err: null, api: null, queue: null, back: null };
var FIN_OWNER_ONLY = 'Only the owner may see collections.';

function finOwes(p) { return Number(p.balance_minor) > 0; }

async function finLoad(quiet) {
  if (finTab() === 'terms') return ftLoad(quiet);   /* the Terms tab (cap-finance-terms.js) */
  var g = ++FIN.gen;
  if (!quiet) { FIN.state = 'loading'; if (FIN.api) FIN.api.refresh(); }
  try {
    var r = await api('booksDues', { query: { asOf: bkToday(), finance: '1' } });
    if (g !== FIN.gen) return;
    bkDuesStore(r);
    FIN.cur = (r && r.currency) || 'INR';
    FIN.rows = ((r && r.parties) || []).filter(function (p) { return bkDuesSide(p) === 'rcv' && finOwes(p); });
    FIN.state = 'ready'; FIN.err = null;
  } catch (e) {
    if (g !== FIN.gen) return;
    FIN.state = e && e.status === 403 ? 'denied' : 'error'; FIN.err = e;
    if (FIN.state === 'denied') { finDenied(); return; }
  }
  if (FIN.api) FIN.api.refresh();
}
function finRetry() { finLoad(); }

/** the server said who may see it: the sentence, greyed, and no list — the server refuses anyway */
function finDenied() {
  var s = document.getElementById('screen'); if (!s) return;
  s.className = 'screen';
  s.innerHTML = '<div class="card" data-testid="fin-denied" style="opacity:.75"><h2>' + esc(tx('Collections')) + '</h2><p data-testid="fin-denied-why">' + esc(tx(FIN_OWNER_ONLY)) + '</p></div>';
}

/* ── the columns: every figure is the server's ── */
function finCols() {
  var c = function () { return FIN.cur; };
  var dash = '<span style="color:var(--grey)">—</span>';
  return [
    { key: 'party', label: tx('Party'), prio: 1, sort: 'name', w: 230, html: true, cell: function (p) { return esc(bkPartyLabel(p.party_id, p.name)); } },
    { key: 'due', label: tx('To collect'), prio: 2, sort: 'due', num: true, w: 150, html: true, cell: function (p) { return '<b data-b="balance">' + esc(bkMoney(Number(p.balance_minor), c())) + '</b>'; } },
    { key: 'age', label: tx('Age'), prio: 3, sort: 'oldest', w: 200, html: true, cell: function (p) {
      var ag = bkDuesAge(p);
      return p.oldest_due ? '<span data-b="due">' + esc(bkDate(p.oldest_due)) + '</span>' + (ag ? ' <span data-b="age" style="color:var(--grey)">· ' + esc(tx(ag)) + '</span>' : '') : dash; } },
    { key: 'limit', label: tx('Limit'), prio: 4, sort: 'limit', num: true, w: 170, html: true, cell: function (p) {
      if (p.credit_limit_minor == null) return dash;
      return '<span data-b="limit">' + esc(bkMoney(Number(p.credit_limit_minor), c())) + '</span>'
        + (p.over_limit ? ' <span class="tag red" data-b="over">⚠ ' + esc(tx('Over limit')) + '</span>' : ''); } },
    { key: 'interest', label: tx('Interest due'), prio: 5, sort: 'interest', num: true, w: 150, html: true, cell: function (p) {
      return Number(p.interest_minor) > 0 ? '<span data-b="interest" title="' + esc(tx('Shown, never charged')) + '">' + esc(bkMoney(Number(p.interest_minor), c())) + '</span>' : dash; } },
    { key: 'last', label: tx('Last reminded'), prio: 6, w: 130, html: true, cell: function (p) { return p.last_remind ? esc(bkDate(p.last_remind)) : dash; } },
    { key: 'act', label: ' ', prio: 1, pin: 'end', w: 170, html: true, cell: function (p) {
      var id = esc(p.party_id);
      return '<span style="display:inline-flex;gap:6px" onclick="event.stopPropagation()">'
        + '<button type="button" class="cbl-tbtn" data-testid="fin-receive-' + id + '" onclick="event.stopPropagation();payOpen(\'customer\',\'' + id + '\')">' + esc(tx('Receive')) + '</button>'
        + '<button type="button" class="cbl-tbtn" data-testid="fin-remind-' + id + '" onclick="event.stopPropagation();bkRemind(\'' + id + '\',this)">' + esc(tx('Remind')) + '</button></span>'; } },
  ];
}

function finMount(frame) {
  var s = document.getElementById('screen'); if (!s) return;
  if (finTab() === 'terms') return ftMount(frame);   /* the Terms tab (cap-finance-terms.js) */
  ftNav();
  s.className = 'screen flush';
  s.innerHTML = '<div id="fin_list" data-testid="fin-list" style="flex:1 1 auto;min-height:0"></div>';
  var num = function (g) { return function (a, b) { return Number(g(a) || 0) - Number(g(b) || 0); }; };
  FIN.api = CBList.mount(document.getElementById('fin_list'), {
    key: 'fin-collect', t: tx, rows: function () { return FIN.rows; }, id: function (p) { return p.party_id; }, rowTid: function (p) { return 'fin-row-' + p.party_id; },
    columns: finCols(), defaultCols: ['party', 'due', 'age', 'limit', 'interest', 'last'], cardMax: 4, fill: false,
    head: function () { return { title: tx('Collections') }; },
    state: function () { return FIN.state; }, error: function () { return tx('Could not read who owes you. Try again.'); }, onRetry: finRetry,
    empty: { title: tx('Nobody owes you money') },
    group: { default: 'over', order: ['over', 'coll'], by: function (p) { return p.over_limit ? [tx('Over limit'), 'over'] : [tx('To collect'), 'coll']; },
      fig: function (rows) { return txn('{count} party', '{count} parties', rows.length) + ' · ' + bkOwes(rows.reduce(function (t, p) { return t + Number(p.balance_minor || 0); }, 0), FIN.cur); },
      headTid: function (k) { return 'fin-group-' + k; } },
    search: function (p) { return [p.party_no, p.name, bkPartyLabel(p.party_id, p.name)].join(' '); },
    sorts: [
      { key: 'name', label: tx('Name'), cmp: function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); } },
      { key: 'due', label: tx('To collect'), cmp: num(function (p) { return p.balance_minor; }) },
      { key: 'oldest', label: tx('Oldest due'), cmp: function (a, b) { return String(a.oldest_due || '9999').localeCompare(String(b.oldest_due || '9999')); } },
      { key: 'limit', label: tx('Limit'), cmp: num(function (p) { return p.credit_limit_minor; }) },
      { key: 'interest', label: tx('Interest due'), cmp: num(function (p) { return p.interest_minor; }) },
    ],
    filters: [{ key: 'flag', label: tx('Show'), all: tx('Everyone'), options: [{ v: 'over', label: tx('Over limit') }, { v: 'late', label: tx('Overdue') }],
      match: function (p, v) { return v === 'over' ? !!p.over_limit : Number(p.interest_minor) > 0 || (p.oldest_due && p.oldest_due < bkToday()); } }],
    next: function (p) { return bkDuesNext(p, FIN.cur); },
    bulk: [{ id: 'remind', label: tx('Remind'), run: finRemindQueue }],
  });
  if (!frame) finLoad(FIN.rows.length > 0);
}

/* ── batch Remind: the chosen parties, each one's Remind (bkRemind, M28) in turn; the sheet comes back after each ── */
function finRemindQueue(rows) {
  FIN.queue = (rows || []).map(function (p) { return { id: p.party_id, name: bkPartyLabel(p.party_id, p.name), minor: Number(p.balance_minor), done: false }; });
  if (FIN.queue.length) finQueueSheet();
}
function finQueueSheet() {
  var q = FIN.queue || [], left = q.filter(function (x) { return !x.done; }).length;
  modal('<div class="mhd"><div class="t" data-testid="fin-queue-title">' + esc(tx('Remind')) + ' · ' + esc(txn('{count} party', '{count} parties', q.length)) + '</div></div><div class="mbody">'
    + q.map(function (x, i) {
      return '<div class="result" data-testid="fin-queue-' + esc(x.id) + '"><span><b>' + esc(x.name) + '</b><span class="k">' + esc(bkMoney(x.minor, FIN.cur)) + '</span></span>'
        + (x.done ? '<span class="tag green">✓ ' + esc(tx('Asked')) + '</span>' : '<button type="button" class="act sm" data-testid="fin-queue-go-' + esc(x.id) + '" onclick="finRemindOne(' + i + ',this)">' + esc(tx('Remind')) + '</button>') + '</div>';
    }).join('')
    + '</div><div class="mfoot"><button type="button" onclick="closeModal()">' + esc(left ? tx('Close') : tx('Done')) + '</button></div>');
}
function finRemindOne(i, btn) {
  var x = (FIN.queue || [])[i]; if (!x) return;
  x.done = true; FIN.back = finQueueSheet;   /* the sheet returns when this party's message is closed */
  return bkRemind(x.id, btn);
}
