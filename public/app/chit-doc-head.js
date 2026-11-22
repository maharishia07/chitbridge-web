/**
 * chit-doc-head.js - THE DOCUMENT'S OWN HEAD on a rail invoice or credit note (AU-F-11, walk AU, UAE law).
 *
 * ID        DTL001
 * OWNER     cb-rail
 * OWNS      CBDocHead.html(model): the title (the country pack's own words), the supplier's name, tax number and address, the date, the number, and on a credit note the invoice it reduces and why
 * CALLED BY app/chit-sheet.js (the popup and the page form) and public/app.html chitDocHead (design 1's Content tab); loaded on the same script line as chit-sheet.js
 * FLOW      model = { purpose, bj, no, counterBill } ──▶ bj.invoice (DocDtls · SellerDtls, frozen by the api) + the pack (shopReg) ──▶ one block of rows
 * CARD      01-rail-core-the-chit/chit-sheet
 * RISK      money
 *
 * Every word is READ: the title from the pack (pack.taxInvoice(...).title, pack.creditNote.title) of the seller's country when the frozen invoice names it
 * (SellerDtls.Country), else the shop's own pack; the rest from the frozen business_json.invoice and business_json.against / reason_words. A pack with no
 * rule prints the neutral words; a fact the chit does not hold is left out, never invented. There is NO country literal here and no arithmetic on money.
 * A counter bill is not drawn here: the till's own slip is titled already.
 */
(function (root) {
  'use strict';
  var DOC_PURPOSES = { invoice: 1, credit_note: 1, debit_note: 1 };
  function inWords(words) {
    return typeof tx === 'function' ? tx(words) : words;
  }
  function packOf(invoice) {
    var country = invoice && invoice.SellerDtls && invoice.SellerDtls.Country;
    return typeof shopReg === 'function' ? shopReg(country) : null;
  }
  function isNote(purpose) {
    return purpose === 'credit_note' || purpose === 'debit_note';
  }
  /** a credit or debit note's title: the pack's own words, else the neutral ones */
  function noteTitle(pack, purpose) {
    return (pack && pack.creditNote && pack.creditNote.title) || (purpose === 'debit_note' ? 'Debit note' : 'Credit note');
  }
  function titleOf(model, invoice) {
    var pack = packOf(invoice);
    if (isNote(model.purpose)) return noteTitle(pack, model.purpose);
    var rule = pack && typeof pack.taxInvoice === 'function' ? pack.taxInvoice(0, {}) : null;
    return (rule && rule.title) || 'Invoice';
  }
  /** the invoice a note reduces: against.bill_no, else the text the sender gave */
  function againstOf(bj) {
    var against = bj && bj.against;
    return against && typeof against === 'object' ? against.bill_no || '' : against ? String(against) : '';
  }
  function rowsOf(model, invoice) {
    var seller = invoice.SellerDtls || {},
      taxWord = typeof taxIdWord === 'function' ? taxIdWord(seller.Country) : 'Tax ID';
    var rows = [
      ['Supplier', seller.LglNm],
      [taxWord, seller.Gstin],
      ['Address', seller.Addr1],
      ['Date', (invoice.DocDtls || {}).Dt],
      ['Number', model.no]
    ];
    if (isNote(model.purpose)) rows.push(['Against invoice', againstOf(model.bj)], ['Reason', model.bj.reason_words || model.bj.reason]);
    return rows.filter(function (row) {
      return row[1];
    });
  }
  function rowHTML(row) {
    var id = String(row[0]).toLowerCase().replace(/\W+/g, '-');
    return '<div class="cs-row"><span>' + esc(inWords(row[0])) + '</span><span data-testid="cs-doc-' + esc(id) + '">' + esc(String(row[1])) + '</span></div>';
  }
  function html(model) {
    var invoice = model && model.bj && model.bj.invoice;
    if (!invoice || !DOC_PURPOSES[model.purpose] || model.counterBill) return '';
    return '<div class="cs-docs" data-testid="cs-doc-head"><div class="cs-sec" data-testid="cs-doc-title">' + esc(inWords(titleOf(model, invoice))) + '</div>' + rowsOf(model, invoice).map(rowHTML).join('') + '</div>';
  }
  root.CBDocHead = { html: html };
})(typeof window !== 'undefined' ? window : globalThis);
