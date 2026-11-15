/* bank-demo-rows.js — one statement line of public/bank-demo.html: its row, what it says about itself and the question it asks (split from bank-demo.js).
 * OWNS      the row of a statement line in the engine's words: the date, the payee and the bank's words, what was spent or received, the status chip and, under it, the entry it matched, the entry it will make
 *           (Dr and Cr, as the engine composed it) or the one question it asks inline (is the tax invoice held, who is this).
 * CALLED BY public/app/bank-demo.js (CBBankDemoRows.create(host)); loaded before it by public/bank-demo.html.
 * FLOW      bank-demo.js paintLines() → rows.lineRow(item, results, matchedWords) → one <li> per line
 * ⭐ NO MONEY IS COMPUTED HERE: every amount is one the engines carried (the line, the entry's legs, the tax the engine says it claims).
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  BKS017-B10 yes, I hold the tax invoice · BKS017-B11 no tax invoice · BKS017-B07 the new payee · BKS017-R01 choose what this is
 */
(function (root) {
  'use strict';
  var host = null /* the page's own functions (standing, amountText, nameOf, tag, whoCell …), given by create() */;
  /** the entry a ready line will make, in an accountant's terms: "Dr Trade creditors 880.00 · Cr Business bank account 880.00" (the legs the engine composed) */
  function entryWords(item) {
    return ((item.entry && item.entry.lines) || []).map(function (leg) {
      var debit = (leg.dr_minor || 0) > 0;
      return (debit ? 'Dr ' : 'Cr ') + host.nameOf(leg.account) + ' ' + host.amountText({ amount_minor: debit ? leg.dr_minor : leg.cr_minor, currency: host.CURRENCY });
    }).join(' \u00b7 ');
  }
  /** the tax the engine says this line claims, in words: "8.80 GST" */
  function taxWords(item) {
    return item.tax && item.tax.tax_minor ? host.amountText({ amount_minor: item.tax.tax_minor, currency: host.CURRENCY }) + ' GST' : 'GST';
  }
  /** what a line that needs you asks, inline: the tax invoice first, then who it is, else a way to say what it is */
  function questionHtml(item) {
    var key = esc(item.key),
      more = '<button type="button" class="bd-link" data-act="open" data-key="' + key + '" data-cbsid="BKS017-R01">Choose what this is</button>';
    if (item.needs === 'tax_invoice') {
      return '<span class="bd-question"><span class="bd-q">This claims ' + esc(taxWords(item)) + ' and needs a tax invoice. Do you hold it?</span>' +
        '<button type="button" class="bd-btn" data-act="taxinvoice" data-key="' + key + '" data-v="held" data-cbsid="BKS017-B10">Yes, I hold it</button>' +
        '<button type="button" class="bd-btn" data-act="taxinvoice" data-key="' + key + '" data-v="none" data-cbsid="BKS017-B11">No: book it without the GST credit</button></span>';
    }
    if (item.needs === 'needs_tick') {
      return '<span class="bd-question"><span class="bd-q">Only the words on the statement say what this is.</span><button type="button" class="bd-btn" data-act="tick" data-key="' + key + '" data-cbsid="BKS017-B09">Yes, this is right</button>' + more + '</span>';
    }
    if (item.needs === 'may_be_in_books') {
      return '<span class="bd-question"><span class="bd-q">This may already be in your books.</span><button type="button" class="bd-btn" data-act="notmatch" data-key="' + key + '" data-cbsid="BKS017-B13">It is new</button>' + more + '</span>';
    }
    if (item.party && item.party.status === 'new') {
      return '<span class="bd-question"><span class="bd-q">Who is this?</span><button type="button" class="bd-btn" data-act="newparty" data-key="' + key + '" data-cbsid="BKS017-B07">New ' + esc(item.party.kind) + ': ' + esc(item.party.name) + '</button>' + more + '</span>';
    }
    return '<span class="bd-question">' + more + '</span>';
  }
  /** the right-hand column of a line, under its chip: the entry it matched, the entry it will make, or the question it asks */
  function detailHtml(item, state, matched) {
    if (state === 'in') return '<span class="bd-detail">' + esc(matched || '') + '</span>';
    if (state === 'ready' || state === 'posted') return '<span class="bd-detail">' + esc(entryWords(item)) + '</span>';
    return state === 'need' ? questionHtml(item) : '';
  }
  /** one money cell: the carried amount as digits (the currency is in the column heading), or an empty cell; which is 'out' (spent) or 'in' (received) */
  function moneyCell(minor, which) {
    return '<span class="bd-m bd-' + which + ' bd-cell' + which + '">' + (minor ? esc(host.amountText(minor)) : '') + '</span>';
  }
  function lineRow(item, results, matched) {
    var line = item.line,
      result = results[item.key],
      state = host.standing(item, result),
      chip = host.CHIPS[state],
      reason = result && !result.ok ? '<span class="bd-why">' + esc(result.why) + '</span>' : '';
    var inner =
      '<span class="bd-date">' + esc(host.preview.dateText(line.date)) + '</span>' + host.whoCell(item) +
      moneyCell(line.debit_minor, 'out') + moneyCell(line.credit_minor, 'in') +
      '<span class="bd-status">' + host.tag(chip[0], chip[1]) + reason + detailHtml(item, state, matched) + '</span>';
    return '<li><div class="bd-row bd-s-' + (state === 'need' ? 'needs_you' : state) + '">' + inner + '</div></li>';
  }

  /** create(host) → { lineRow }: host is the page's own functions */
  function create(pageHost) {
    host = pageHost;
    return { lineRow: lineRow };
  }
  root.CBBankDemoRows = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
