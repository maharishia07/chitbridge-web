/* app/cap-finance-terms-undo.js — TERMS, the CHANGES-LIST UNDO capability: Undo on the newest change, what the server takes back, the standard money confirm. Split out of cap-finance-terms.js, code moved verbatim; the old value is sent back as a new change, nothing is worked out here.
 * OWNS      FT_UNDOABLE · ftUndoVal · ftUndoFor · ftMoneyConfirm · ftUndo
 * CALLED BY public/finance.html (script tag, before cap-finance-terms.js); cap-finance-terms.js (ftShopPaint, ftOpen, the saves) calls it at run time; its functions and FT_UNDOABLE are global
 * FLOW      the Changes list → ftUndoFor (the Undo button on the newest change) → ftUndo → CBAction.run (ftMoneyConfirm asks first) → POST booksTermsSet → ftLoad (cap-finance-terms.js) → ftSay
 * CARD      16-finance/cb-finance
 * ID        FIN004
 * OWNER     cb-finance
 * RISK      money
 */
'use strict';
/* ── the Changes list: Undo puts the newest change back (a new change, so it is in the list too) ── */
var FT_UNDOABLE = { credit_days: 1, credit_limit_minor: 1, interest: 1, early: 1 };
/** the stored old value → what the server takes back (a number, or the interest / early object; null clears) */
function ftUndoVal(field, oldValue) {
  if (oldValue == null || oldValue === '') return null;
  if (field === 'interest' || field === 'early') return typeof oldValue === 'string' ? JSON.parse(oldValue) : oldValue;
  return Number(oldValue);
}
/** the extra html for one change row: Undo on the newest change only, greyed when the person may not set terms */
function ftUndoFor(list, greyed, partyId) {
  var newest = (list || []).reduce(function (best, change, index) {
    return best < 0 || String(change.at) > String((list[best] || {}).at) ? index : best;
  }, -1);
  return function (change, index) {
    var side = /^supplier\./.test(String(change.field || '')) ? 'supplier' : 'customer';
    var field = String(change.field || '').replace(/^(customer|supplier)\./, '');
    if (index !== newest || !FT_UNDOABLE[field]) return '';
    var old = change.old == null ? '' : typeof change.old === 'object' ? JSON.stringify(change.old) : String(change.old);
    return ' <button data-cbsid="FIN004-B02" type="button" class="act" data-testid="ft-undo" data-field="' + esc(field) + '" data-side="' + esc(side) + '" data-old="' + esc(old) + '" data-party="' + esc(partyId || '') + '"' + (greyed ? ' disabled' : '') + ' onclick="ftUndo(this)">' + esc(tx('Undo')) + '</button>';
  };
}
/** the standard confirm for a money setting (CBAction asks in the page's own dialog; Cancel sends nothing) */
function ftMoneyConfirm(title, body, yes) {
  return { title: title, body: esc(body), yes: yes, danger: false };
}
/** Undo: send the newest change's old value back as a new change, then read the terms again */
function ftUndo(btn) {
  var undo = { field: btn.dataset.field, old: btn.dataset.old, partyId: btn.dataset.party || null, side: btn.dataset.side === 'supplier' ? 'supplier' : 'customer' };
  if (!undo.field) return;
  var body = undo.partyId ? { party_id: undo.partyId, side: undo.side } : {},
    lineId = undo.partyId ? 'ftp_why' : 'ft_why';
  try {
    body[undo.field] = ftUndoVal(undo.field, undo.old);
  } catch (_) {
    return ftSay(lineId, tx('That change cannot be undone here.'));
  }
  return CBAction.run(
    btn,
    function () {
      return api('booksTermsSet', { body: body });
    },
    {
      key: 'ft-undo',
      confirm: ftMoneyConfirm(tx('Undo this change?'), tx('The earlier terms are put back as a new change. It shows in the Changes list.'), tx('Undo')),
      out: lineId,
      failed: tx('Could not undo'),
      done: '✓ ' + tx('Undone'),
      outcome: function () {
        ftLoad(true).then(function () {
          if (undo.partyId) ftOpen(undo.partyId);
          ftSay(lineId, '✓ ' + tx('Undone'));
        });
      }
    }
  );
}
