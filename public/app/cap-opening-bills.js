/* cap-opening-bills.js — the BILL ROWS under a Customers or Suppliers ledger on the Opening balances grid: party · bill no · bill date · due · amount.
 * ⭐ The bills' total is the server's (the preview's bills[]); this file only collects the rows and hands them to cap-opening.js, which sends them. Nothing is added up here.
 * OWNS      the bill rows' markup and edits (obBillsHtml · obBillAdd · obBillDel · obBillIn · obPartyOptions · obBillsTotalOf) and the party list read (obEnsureParties)
 * CALLED BY public/app/cap-opening.js (obRowHtml · obToggle); loaded with it (accounts.html script tag · app.html CAP_WITH books)
 * FLOW      a ledger row's Bills button → obToggle → obEnsureParties (crmParties) → obBillsHtml → each edit → obBillIn → obPreviewSoon (cap-opening.js)
 * CARD      14-accounting/README
 */
'use strict';
function obBillsTotalOf(code) {
  var pair = ((OB.pv && OB.pv.bills) || []).filter(function (item) {
    return String(item.code) === String(code);
  })[0];
  return pair ? pair.bills_minor : null;
}
function obPartyOptions(row, chosen) {
  var want = row.role === 'creditors' ? 'supplier' : 'customer';
  return (
    '<option value="">' +
    esc(tx('Choose')) +
    '</option>' +
    (OB.parties || [])
      .filter(function (item) {
        return item[want] || item.party_id === chosen;
      })
      .map(function (item) {
        return '<option value="' + esc(item.party_id) + '"' + (item.party_id === chosen ? ' selected' : '') + '>' + esc((item.party_no ? item.party_no + ' · ' : '') + (item.name || item.display_name || '')) + '</option>';
      })
      .join('')
  );
}
function obBillsHtml(row, i, total) {
  var rows = row.bills
    .map(function (bill, j) {
      return (
        '<div class="ob-bill" data-testid="ob-bill-' + i + '-' + j + '">' +
        '<select class="inp" data-cbsid="CMP041-S01"' + obMount('CMP041') + ' data-testid="ob_bp_' + i + '_' + j + '" aria-label="' + esc(tx('Party')) + '" onchange="obBillIn(' + i + ',' + j + ",'party_id',this.value)\">" + obPartyOptions(row, bill.party_id) + '</select>' +
        '<input class="inp" data-cbsid="CMP040-I01"' + obMount('CMP040') + ' data-testid="ob_bn_' + i + '_' + j + '" aria-label="' + esc(tx('Bill no')) + '" placeholder="' + esc(tx('Bill no')) + '" value="' + esc(bill.ref) + '" onchange="obBillIn(' + i + ',' + j + ",'ref',this.value)\">" +
        '<input class="inp" type="date" data-cbsid="CMP040-I02"' + obMount('CMP040') + ' data-testid="ob_bt_' + i + '_' + j + '" aria-label="' + esc(tx('Bill date')) + '" value="' + esc(bill.date || '') + '" onchange="obBillIn(' + i + ',' + j + ",'date',this.value)\">" +
        '<input class="inp" type="date" data-cbsid="CMP040-I02"' + obMount('CMP040') + ' data-testid="ob_bd_' + i + '_' + j + '" aria-label="' + esc(tx('Due')) + '" value="' + esc(bill.due) + '" onchange="obBillIn(' + i + ',' + j + ",'due',this.value)\">" +
        obField('ob_ba_' + i + '_' + j, bill.minor, 'obBillIn(' + i + ',' + j + ",'minor')", tx('Amount')) +
        '<button type="button" class="supact ob-del" data-cbsid="CMP014-B01"' + obMount('CMP014') + ' data-testid="ob_bx_' + i + '_' + j + '" aria-label="' + esc(tx('Remove')) + '" onclick="obBillDel(' + i + ',' + j + ')">×</button></div>'
      );
    })
    .join('');
  return (
    '<div class="ob-bills" data-testid="ob-bills-box-' + esc(row.code) + '">' +
    rows +
    '<div><button type="button" class="supact" data-cbsid="CMP007-B01"' + obMount('CMP007') + ' data-testid="ob_badd_' + i + '" onclick="obBillAdd(' + i + ')">' + tx('+ Add a bill') + '</button>' +
    (total != null ? ' <span style="color:var(--grey);font-size:var(--fs-1)">' + esc(txf('Bills add to {amt}', { amt: bkMoney(total, OB.pv && OB.pv.currency) })) + '</span>' : '') +
    '</div></div>'
  );
}
async function obEnsureParties() {
  if (OB.parties) return;
  try {
    var reply = await api('crmParties');
    OB.parties = (reply && reply.parties) || [];
  } catch (e) {
    OB.parties = [];
  }
}
function obBillAdd(i) {
  OB.rows[i].bills.push({ party_id: '', ref: '', date: '', due: '', minor: null });
  obRender();
}
function obBillDel(i, j) {
  OB.rows[i].bills.splice(j, 1);
  obRender();
  obPreviewSoon();
}
function obBillIn(i, j, field, value) {
  var bill = OB.rows[i].bills[j];
  if (field === 'minor') {
    var minor = bkMoneyRead('ob_ba_' + i + '_' + j);
    bill.minor = isFinite(minor) && minor > 0 ? minor : null;
  } else bill[field] = value;
  obPreviewSoon();
}
