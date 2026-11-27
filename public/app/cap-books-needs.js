/* app/cap-books-needs.js — CB ACCOUNTS · WHO NEEDS YOU, AND WHY (W15-114): the reason chips on a party row, the Needs filter of the Dues list, the header line of Receivables / Payables with a chip for each reason, and the press that opens a party on its fix. Split out of cap-books.js, code moved verbatim; nothing is counted here, every count and amount is the server's (the sums stay in cap-books.js: bkNeedsSum, bkNeedRank).
 * OWNS      BK_NEED · BK_NEED_ORDER · bkNeedChips · bkNeedFilters · bkNeedsChip · bkNeedsChips · bkNeedsHead · bkNeedsHeadPress · bkNeedOpen
 * CALLED BY public/accounts.html, crm.html, finance.html, tasks.html (script tag right after cap-books.js; the Dues list calls it at run time) · app.html CAP_WITH books: books-needs; its functions are global
 * FLOW      the Dues read (BK.duesRaw.needs) → bkNeedsHead (the header line, each chip a filter) → bkNeedFilters (CBList) → a row's bkNeedChips → bkNeedOpen → the party on its Needs you tab
 * CARD      16-finance/cb-finance
 * ID        BKS010
 * OWNER     cb-finance
 * RISK      plain
 */
'use strict';
/**
 * ⭐ W15-114 · WHO NEEDS YOU, AND WHY — the server's reasons (api lib/books-needs), in the shopkeeper's words. Nothing is counted here: a party row carries `needs { bills, <reason>: n, overdue_minor }`
 * and the answer carries the same by side. [word of a chip, the one action it offers]. A chip is a press: it opens that party on its Needs you tab, narrowed to that reason.
 */
var BK_NEED = {
  disputed: ['disputed', 'Answer'],
  query: ['open query', 'Answer'],
  held: ['on hold', 'Release'],
  no_tax_invoice: ['no tax invoice', 'Attach'],
  no_terms: ['no terms', 'Set terms'],
  overdue: ['overdue', 'Pay']
};
var BK_NEED_ORDER = ['disputed', 'query', 'held', 'no_tax_invoice', 'no_terms', 'overdue'];
/** the chips of one party row: up to three reasons with their counts, then "+n"; each opens the party on its fix. Nothing wraps (one line a row). */
function bkNeedChips(party) {
  var needTotals = party.needs || {},
    kinds = BK_NEED_ORDER.filter(function (kind) {
      return Number(needTotals[kind]) > 0 && !(kind === 'overdue' && Number(needTotals.no_terms) >= Number(needTotals.bills)) /* ACC-412: every open bill has no terms = no due date = nothing overdue to say (the server counts each, this only stops the word) */;
    });
  if (!kinds.length) return '';
  var shown = kinds.slice(0, 3).map(function (kind) {
    return (
      '<button type="button" class="cbl-nchip bk-need" data-cbsid="CMP033-B01"' + bkMountAttribute('CMP033') + ' data-b="need-' + kind + '" data-testid="need-' + kind + '-' + esc(party.party_id) + '" onclick="bkNeedOpen(event,\'' + escJs(party.party_id) + "','" + kind + '\')">' +
      '<b>' + esc(String(needTotals[kind])) + '</b> ' + esc(tx(BK_NEED[kind][0])) + '</button>'
    );
  });
  if (kinds.length > 3) shown.push('<span class="bk-need-more" data-b="need-more">+' + (kinds.length - 3) + '</span>');
  return '<span class="bk-needs" style="display:inline-flex;gap:4px;flex-wrap:wrap;max-width:100%;min-width:0">' + shown.join('') + '</span>';
}
/** the Needs filter of the Dues list: any reason, or one of them (the header line presses it) */
function bkNeedFilters() {
  return [
    {
      key: 'need',
      label: tx('Needs'),
      all: tx('Needs'),
      match: function (p, v) {
        return v === 'any' ? !!(p.needs && p.needs.bills > 0) : !!(p.needs && Number(p.needs[v]) > 0);
      },
      options: [{ v: 'any', label: tx('Needs you') }].concat(
        BK_NEED_ORDER.map(function (kind) {
          return { v: kind, label: tx(BK_NEED[kind][0]) };
        })
      )
    }
  ];
}
/** one chip of the header line: pressed when the list is narrowed to that reason */
function bkNeedsChip(kind, text, pressed, tidSuffix) {
  return '<button type="button" class="attn-chip" data-cbsid="CMP033-B01"' + bkMountAttribute('CMP033') + ' data-b="needs-head-' + kind + (tidSuffix || '') + '" data-testid="needs-head-' + kind + (tidSuffix || '') + '" aria-pressed="' + (pressed === kind) + '" onclick="bkNeedsHeadPress(\'' + kind + '\')">' + text + '</button>';
}
/** the overdue chip(s) of the header line (ACC-412: none when every open bill has no terms = no due date; the server counts each, this only stops the word) */
function bkNeedsOverdueParts(sum, currency, pressed) {
  var parts = [];
  if (Number(sum.no_terms) > 0 && Number(sum.no_terms) >= Number(sum.bills)) return parts;
  /* FW-35: both sides on one list = two overdue figures, never one sum of what is owed to us and what we owe */
  if (sum.overdue && sum.overdue_sides && sum.overdue_sides.length > 1) {
    sum.overdue_sides.forEach(function (part) {
      parts.push(bkNeedsChip('overdue', '<b>' + (part.minor != null ? esc(bkMoney(part.minor, currency)) : part.count) + '</b> ' + esc(tx(part.key === 'customer' ? 'overdue from customers' : 'overdue to suppliers')), pressed, '-' + part.key));
    });
  } else if (sum.overdue) parts.push(bkNeedsChip('overdue', '<b>' + (sum.overdue_minor != null ? esc(bkMoney(sum.overdue_minor, currency)) : sum.overdue) + '</b> ' + esc(tx('overdue')), pressed));
  return parts;
}
/** the chips of the header line, the server's counts only: parties that need you, then each reason with its count (overdue says the amount) */
function bkNeedsChips(sum, side, currency, pressed) {
  var words = side === 'pay' ? ['supplier', 'suppliers'] : side === 'rcv' ? ['customer', 'customers'] : ['party', 'parties'],
    parts = [];
  if (sum.parties) parts.push(bkNeedsChip('any', esc(txn('{count} ' + words[0] + ' needs you', '{count} ' + words[1] + ' need you', sum.parties)).replace(/^([0-9][0-9,.]*)/, function (n) { return '<b>' + n + '</b>'; }), pressed));
  [
    ['no_tax_invoice', tx('no tax invoice')],
    ['no_terms', tx('without terms')],
    ['disputed', tx('disputed')],
    ['query', txn('open query', 'open queries', sum.query)] /* RW1-15: one is "1 open query", never "1 open queries" (the one plural helper) */,
    ['held', tx('on hold')]
  ].forEach(function (reason) {
    if (sum[reason[0]]) parts.push(bkNeedsChip(reason[0], '<b>' + sum[reason[0]] + '</b> ' + esc(reason[1]), pressed));
  });
  return parts.concat(bkNeedsOverdueParts(sum, currency, pressed));
}
/** the header line of Receivables / Payables: "12 suppliers need you · 8 no tax invoice · 3 no terms · A$4,210 overdue" — each a filter (a press again clears it) */
function bkNeedsHead() {
  var host = document.getElementById('bk_needs_head');
  if (!host) return;
  var side = BK.duesSide,
    sum = bkNeedsSum(side),
    currency = (BK.duesRaw && BK.duesRaw.currency) || bkCur(),
    list = typeof CBList !== 'undefined' && CBList.get('dues'),
    pressed = (list && list.state().filt.need) || '';
  var parts = bkNeedsChips(sum, side, currency, pressed);
  if (typeof CBAttention !== 'undefined' && CBAttention.styles) CBAttention.styles(); /* the one strip look (Day book, Ledgers, BAS and this line) */
  host.innerHTML = '<div class="attn-strip" role="status" data-testid="needs-head">' + (parts.length ? parts.join(' · ') : '<span class="attn-ok" data-b="needs-ok">✓ ' + esc(tx('Nobody needs you')) + '</span>') + '</div>';
}
/** a press on the header line: the list narrows to that reason; the same press again puts it back */
function bkNeedsHeadPress(kind) {
  var list = CBList.get('dues');
  if (!list) return;
  list.filter('need', list.state().filt.need === kind ? '' : kind);
  bkNeedsHead();
}
/** a chip on a party row: that party opens on its Needs you tab, narrowed to the reason */
function bkNeedOpen(event, pid, kind) {
  event.stopPropagation();
  bkPbSet(pid, { tab: 'needs', why: kind, paid: false, band: '' });
  var list = CBList.get('dues');
  if (list) list.open(pid, true);
}
