/**
 * chit-doc-head.js - THE DOCUMENT'S OWN HEAD on a rail invoice or credit note (AU-F-11, walk AU, UAE law).
 *
 * OWNS      CBDocHead.html(m): the title (the country pack's own words), the supplier's name, tax number and address, the date, the number, and on a credit note the invoice it reduces and why
 * CALLED BY app/chit-sheet.js (the popup and the page form) and public/app.html chitDocHead (design 1's Content tab); loaded on the same script line as chit-sheet.js
 * FLOW      model m = { purpose, bj, no, counterBill } ──▶ bj.invoice (DocDtls · SellerDtls, frozen by the api) + the pack (shopReg) ──▶ one block of rows
 * CARD      01-rail-core-the-chit/chit-sheet
 *
 * Every word is READ: the title from the pack (pack.taxInvoice(...).title, pack.creditNote.title) of the seller's country when the frozen invoice names it
 * (SellerDtls.Country), else the shop's own pack; the rest from the frozen business_json.invoice and business_json.against / reason_words. A pack with no
 * rule prints the neutral words; a fact the chit does not hold is left out, never invented. There is NO country literal here and no arithmetic on money.
 * A counter bill is not drawn here: the till's own slip is titled already.
 */
(function (root) {
  'use strict';
  var DOC_PURPOSES = { invoice: 1, credit_note: 1, debit_note: 1 };
  function T(s) {
    return typeof tx === 'function' ? tx(s) : s;
  }
  function packOf(inv) {
    var country = inv && inv.SellerDtls && inv.SellerDtls.Country;
    return typeof shopReg === 'function' ? shopReg(country) : null;
  }
  function titleOf(m, inv) {
    var pack = packOf(inv),
      note = m.purpose === 'credit_note' || m.purpose === 'debit_note';
    if (note) return (pack && pack.creditNote && pack.creditNote.title) || (m.purpose === 'debit_note' ? 'Debit note' : 'Credit note');
    var rule = pack && typeof pack.taxInvoice === 'function' ? pack.taxInvoice(0, {}) : null;
    return (rule && rule.title) || 'Invoice';
  }
  /** the invoice a note reduces: against.bill_no, else the text the sender gave */
  function againstOf(bj) {
    var against = bj && bj.against;
    return against && typeof against === 'object' ? against.bill_no || '' : against ? String(against) : '';
  }
  function rowsOf(m, inv) {
    var seller = inv.SellerDtls || {},
      taxWord = typeof taxIdWord === 'function' ? taxIdWord(seller.Country) : 'Tax ID';
    var rows = [
      ['Supplier', seller.LglNm],
      [taxWord, seller.Gstin],
      ['Address', seller.Addr1],
      ['Date', (inv.DocDtls || {}).Dt],
      ['Number', m.no]
    ];
    if (m.purpose === 'credit_note' || m.purpose === 'debit_note') rows.push(['Against invoice', againstOf(m.bj)], ['Reason', m.bj.reason_words || m.bj.reason]);
    return rows.filter(function (row) {
      return row[1];
    });
  }
  function rowHTML(row) {
    var id = String(row[0]).toLowerCase().replace(/\W+/g, '-');
    return '<div class="cs-row"><span>' + esc(T(row[0])) + '</span><span data-testid="cs-doc-' + esc(id) + '">' + esc(String(row[1])) + '</span></div>';
  }
  function html(m) {
    var inv = m && m.bj && m.bj.invoice;
    if (!inv || !DOC_PURPOSES[m.purpose] || m.counterBill) return '';
    return '<div class="cs-docs" data-testid="cs-doc-head"><div class="cs-sec" data-testid="cs-doc-title">' + esc(T(titleOf(m, inv))) + '</div>' + rowsOf(m, inv).map(rowHTML).join('') + '</div>';
  }
  root.CBDocHead = { html: html };
})(typeof window !== 'undefined' ? window : globalThis);
