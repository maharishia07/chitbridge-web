/* app/cap-entry-lines.js — ＋ ENTRY, the JOURNAL LINES capability: the journal's own lines (the accountant's door): ledger · Dr/Cr · amount, add and remove a line. Split out of cap-entry.js, code moved verbatim; the server says whether the lines balance, nothing is added up here.
 * OWNS      enLinesHTML · enLine · enLineAdd · enLineDel
 * CALLED BY public/accounts.html and public/finance.html (script tag, before cap-entry.js); cap-entry.js (enFormHTML, the journal step) calls it at run time; its functions are global
 * FLOW      the Journal step → enLinesHTML → enLine / enLineAdd / enLineDel (EN.lines) → enPaint (cap-entry.js) → the server's preview says whether it balances
 * CARD      16-finance/cb-finance
 */
'use strict';
/* ── the journal's own lines (the CA's door): ledger · Dr/Cr · amount. The server says whether they balance. ── */
function enLinesHTML() {
  return (
    '<div class="en-sec">' +
    esc(tx('Lines')) +
    '</div>' +
    EN.lines
      .map(function (item, index) {
        return (
          '<div class="en-ln" data-testid="en-line-' +
          index +
          '">' +
          enLedgerSelect('en_lc' + index, item.code, 'enLine(' + index + ",'code',this.value)", undefined, 'en-line-code-' + index) +
          '<select data-cbsid="SCR022-S03" data-testid="en-line-side-' +
          index +
          '" onchange="enLine(' +
          index +
          ',\'side\',this.value)"><option value="dr"' +
          (item.side === 'dr' ? ' selected' : '') +
          '>Dr</option><option value="cr"' +
          (item.side === 'cr' ? ' selected' : '') +
          '>Cr</option></select>' +
          bkMoneyInput({ id: 'en-line-amt-' + index, text: item.amt == null ? '' : String(item.amt), on: 'enLine(' + index + ",'amt',this.value)" }) +
          '<button data-cbsid="CMP008" type="button" class="en-btn" style="padding:0" aria-label="' +
          esc(tx('Remove')) +
          '" data-testid="en-line-del-' +
          index +
          '" onclick="enLineDel(' +
          index +
          ')"' +
          (EN.lines.length <= 2 ? ' disabled' : '') +
          '>✕</button></div>'
        );
      })
      .join('') +
    '<button data-cbsid="SCR022-B03" type="button" class="en-btn" data-testid="en-line-add" onclick="enLineAdd()">＋ ' +
    esc(tx('Add a line')) +
    '</button>'
  );
}
function enLine(i, k, v) {
  EN.lines[i][k] = v;
  EN.pv = null;
  var node = document.getElementById('en_next');
  if (node) node.disabled = !enStepReady(EN.step);
}
function enLineAdd() {
  EN.lines.push({ code: '', side: 'dr', amt: '' });
  enPaint();
}
function enLineDel(i) {
  if (EN.lines.length > 2) EN.lines.splice(i, 1);
  enPaint();
}
