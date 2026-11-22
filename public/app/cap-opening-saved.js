/* app/cap-opening-saved.js — OPENING BALANCES, the SAVED VIEW capability: who entered it, when and from where, every line the server kept, and the year strip under it. Split out of cap-opening.js, code moved verbatim; nothing is added up here, every figure is the server's.
 * OWNS      obSourceWord · obPartyName · obShowSaved
 * CALLED BY public/accounts.html (script tag, before cap-opening.js) · public/app.html (CAP_WITH books: opening-saved); cap-opening.js calls obShowSaved at run time; its functions are global
 * FLOW      obView (cap-opening.js) → obShowSaved → obEnsureParties (cap-opening-bills.js) → the saved rows + obYearsHtml (cap-opening-years.js)
 * CARD      14-accounting/README
 */
'use strict';
/* ── what is saved ── */
function obSourceWord(kind) {
  return tx(OB_SOURCE[kind] || OB_SOURCE.posted);
}
function obPartyName(id) {
  var hit = (OPENING.parties || []).filter(function (item) {
    return item.party_id === id;
  })[0];
  return hit ? (hit.party_no ? hit.party_no + ' · ' : '') + (hit.name || hit.display_name || '') : '';
}
/** the saved view: who entered it, when and from where, every line the server kept, and the year strip */
async function obShowSaved() {
  OPENING.mode = 'saved';
  await obEnsureParties();
  var saved = OPENING.saved,
    currency = saved.currency;
  var savedBy = (saved.entries || [])
    .map(function (entry) {
      return (
        '<div data-testid="ob-source" style="font-size:var(--fs-1);color:var(--grey)"><b>' +
        esc(obSourceWord(entry.source && entry.source.kind)) +
        '</b> · ' +
        esc(entry.entry_no || '') +
        (entry.by_name ? ' · ' + esc(entry.by_name) : '') +
        (entry.at ? ' · ' + esc(bkDate ? bkDate(String(entry.at).slice(0, 10)) : String(entry.at).slice(0, 10)) : '') +
        '</div>'
      );
    })
    .join('');
  var rows = (saved.lines || [])
    .map(function (line) {
      return (
        '<div class="ob-row" data-testid="ob-saved-row"><div class="ob-name"><span class="mono">' + esc(line.code) + '</span> ' + esc(line.name || '') +
        (line.party_id ? '<small>' + esc(obPartyName(line.party_id) + (line.bill_ref ? ' · ' + line.bill_ref : '') + (line.due_date ? ' · ' + tx('due') + ' ' + line.due_date : '')) + '</small>' : '') +
        '</div><div class="ob-num">' + (line.dr_minor ? esc(bkMoney(line.dr_minor, currency)) : '') + '</div><div class="ob-num">' + (line.cr_minor ? esc(bkMoney(line.cr_minor, currency)) : '') + '</div></div>'
      );
    })
    .join('');
  OPENING.body.innerHTML =
    '<div class="ob" data-testid="ob-root"><div class="ob-head"><b>' + tx('Opening balances') + '</b><span>' + esc(tx('from') + ' ' + (bkDate ? bkDate(saved.date) : saved.date)) + '</span><span style="flex:1"></span>' +
    '<button type="button" class="supact-pri" data-cbsid="CMP012-B01"' + obMount('CMP012') + ' data-testid="ob-edit" onclick="obEdit()">' + tx('Edit') + '</button></div>' +
    savedBy +
    '<div class="ob-rows" data-testid="ob-rows"><div class="ob-row ob-hd"><div class="ob-name">' + tx('Ledger') + '</div><div class="ob-num">' + tx('Debit') + '</div><div class="ob-num">' + tx('Credit') + '</div></div>' + rows + '</div>' +
    '<div id="ob_years" data-testid="ob-years">' + obYearsHtml() + '</div></div>';
}
