/* app/cap-finance-pay-held.js — PAYABLES, the HELD BILLS capability: one bill's two doors (Hold this bill, Note a difference), the held bills of a supplier and Release. Split out of cap-finance-pay.js, code moved verbatim; every figure is the server's, nothing is added up here.
 * OWNS      fpBillActs · fpHeldHTML · fpHeldRow · fpHeldRead · fpWho · fpBill · fpHoldDone · fpHold · fpRelease · fpNoteDiff · fpAfterNote
 * CALLED BY public/finance.html (script tag, before cap-finance-pay.js, same late group); cap-finance-pay.js (the supplier row's detail) calls it at run time; its functions are global
 * FLOW      a supplier row opens → fpHeldHTML → fpHeldRead (POST /payments/preview, read only) → fpHeldRow → fpRelease · fpBillActs → fpHold / fpNoteDiff (＋ Entry, cap-entry.js enOpen)
 * CARD      16-finance/cb-finance
 */
'use strict';
/** one bill's two doors (R106): Hold this bill · Note a difference (a rate difference, goods sent back) — each asks first (fpHold, fpNoteDiff) */
function fpBillActs(party, item) {
  var pid = esc(party.party_id),
    ref = esc(item.ref);
  return (
    '<div class="fp-acts" data-b="acts" style="display:flex;gap:6px;flex-wrap:wrap;padding:2px 0 6px">' +
    '<button data-cbsid="FIN002-B01" type="button" class="cbl-tbtn" data-testid="fp-hold-' + ref + '" data-pid="' + pid + '" data-ref="' + ref + '" onclick="event.stopPropagation();fpHold(this.dataset.pid,this.dataset.ref,this)">' +
    esc(tx('Hold this bill')) +
    '</button>' +
    '<button data-cbsid="FIN002-B02" type="button" class="cbl-tbtn" data-testid="fp-note-' + ref + '" data-pid="' + pid + '" data-ref="' + ref + '" onclick="event.stopPropagation();fpNoteDiff(this.dataset.pid,this.dataset.ref)">' +
    esc(tx('Note a difference')) +
    '</button></div>'
  );
}
/**
 * R106: the HELD bills of a supplier (the server leaves them out of payable.bills and the total; the party row carries disputed_minor). Read once per
 * opened row from the pay sheet's own open-bills reader (POST /payments/preview lists every open bill, `disputed` on each — FIELDS 419), never kept
 * from an earlier answer. Each shows the books' word and Release.
 */
function fpHeldHTML(party, sectionHTML, lineHTML) {
  if (!Number(party.disputed_minor)) return '';
  var pid = esc(party.party_id),
    held = FP.held[party.party_id],
    grey = 'color:var(--grey);font-size:var(--fs-1)';
  if (!held) {
    fpHeldRead(party.party_id);
    return sectionHTML('Held') + '<div data-testid="fp-held-' + pid + '" style="' + grey + '">' + esc(tx('Reading the held bills…')) + '</div>';
  }
  if (held.error) return sectionHTML('Held') + '<div data-testid="fp-held-' + pid + '" style="' + grey + '">' + esc(held.error) + '</div>';
  var rows = held.bills
    .map(function (item) {
      return fpHeldRow(pid, item, lineHTML);
    })
    .join('');
  return sectionHTML('Held') + '<div data-testid="fp-held-' + pid + '">' + (rows || '<div style="' + grey + '">' + esc(tx('Nothing is held')) + '</div>') + '</div>';
}
/** one held bill: its number (else its due day), the open figure, the books' word, Release */
function fpHeldRow(pid, item, lineHTML) {
  var ref = esc(item.against_ref);
  return (
    CBList.nextRow([
      '<span data-b="held-bill">' + esc(item.bill_no || bkDate(item.due_date)) + '</span>',
      '<span class="due give">' + esc(bkMoney(item.open_minor, FP.cur)) + '</span>'
    ]) +
    lineHTML('held', tx(FP_HELD_WORD)) +
    '<div class="fp-acts" data-b="acts" style="padding:2px 0 6px"><button data-cbsid="FIN002-B03" type="button" class="cbl-tbtn" data-testid="fp-release-' + ref + '" data-pid="' + pid + '" data-ref="' + ref + '" onclick="event.stopPropagation();fpRelease(this.dataset.pid,this.dataset.ref,this)">' +
    esc(tx('Release')) +
    '</button></div>'
  );
}
/** the one read behind fpHeldHTML; the list paints again when it lands (or says why it could not) */
async function fpHeldRead(pid) {
  FP.held[pid] = { bills: [], reading: true };
  try {
    var reply = await api('booksPayPreview', { body: { party_id: pid, direction: 'out', amount_minor: 1, currency: FP.cur || bkCur(), allocate: 'none' } });
    FP.held[pid] = {
      bills: ((reply && reply.proposal) || []).filter(function (item) {
        return item.disputed && Number(item.open_minor) > 0;
      })
    };
  } catch (e) {
    FP.held[pid] = { bills: [], error: bkWhy(e, tx('Could not read the held bills')) };
  }
  if (FP.api) FP.api.refresh();
}
/** the supplier's name as the row shows it, for a question */
function fpWho(pid) {
  var party = fpRow(pid);
  return bkPartyLabel(pid, party && party.name);
}
/** the bill a ref names on a supplier's row (payable.bills) — its figure for the question; null when the server does not list it */
function fpBill(pid, ref) {
  var party = fpRow(pid);
  return (
    ((party && party.payable && party.payable.bills) || []).filter(function (item) {
      return String(item.ref) === String(ref);
    })[0] || null
  );
}
/** after a hold or a release: the server's own word under the row, then the list reads again (the bill moves between the two lists) */
function fpHoldDone(pid, reply) {
  var out = document.getElementById('fp_out');
  if (out) out.textContent = (reply && reply.words) || tx('Done');
  FP.held = {};
  fpLoad(true);
}
/**
 * ⭐ R106 "Hold this bill": a money promise — ask first (supplier · the bill's ₹), then the books' one hold (POST /parties/:id/dispute, side supplier,
 * with the typed note). Payables and the cash view leave it out until Release; the answer's `words` is what the row says.
 */
function fpHold(pid, ref, btn) {
  var bill = fpBill(pid, ref);
  if (!bill) return;
  FP.note = '';
  return CBAction.run(
    btn,
    function () {
      var body = { against_ref: ref, side: 'supplier', disputed: true };
      if (FP.note) body.note = FP.note.slice(0, 300);
      return api('booksDispute', { params: { id: pid }, body: body });
    },
    {
      key: 'fp-hold-' + ref,
      confirm: {
        title: txf('Hold {amt} from {who}?', { who: fpWho(pid), amt: bkMoney(bill.open_minor, FP.cur) }),
        body:
          esc(tx('It leaves what you owe and the cash view until you release it.')) +
          '<label class="fl" for="fp_hold_note" style="display:block;margin-top:8px">' +
          esc(tx('Why? (optional)')) +
          '</label><input data-cbsid="FIN002-I01" class="inp" id="fp_hold_note" data-testid="fp-hold-note" maxlength="300" autocomplete="off" oninput="FP.note=this.value">',
        yes: tx('Hold this bill'),
        danger: false
      },
      out: 'fp_out',
      busy: tx('Holding…'),
      failed: tx('Could not hold the bill'),
      outcome: function (reply) {
        fpHoldDone(pid, reply);
      }
    }
  );
}
/** "Release": the same door with disputed false — asked first; the bill is payable again (the answer's word) */
function fpRelease(pid, ref, btn) {
  var held = FP.held[pid],
    bill = ((held && held.bills) || []).filter(function (item) {
      return String(item.against_ref) === String(ref);
    })[0];
  if (!bill) return;
  return CBAction.run(
    btn,
    function () {
      return api('booksDispute', { params: { id: pid }, body: { against_ref: ref, side: 'supplier', disputed: false } });
    },
    {
      key: 'fp-release-' + ref,
      confirm: {
        title: txf('Release {amt} from {who}?', { who: fpWho(pid), amt: bkMoney(bill.open_minor, FP.cur) }),
        body: esc(tx('It is payable again.')),
        yes: tx('Release'),
        danger: false
      },
      out: 'fp_out',
      busy: tx('Releasing…'),
      failed: tx('Could not release the bill'),
      outcome: function (reply) {
        fpHoldDone(pid, reply);
      }
    }
  );
}
/** "Note a difference" (the api event's own words; a rate difference by default): a DEBIT NOTE against the bill through the one ＋ Entry door (kind debit_note; its Save asks first, naming the supplier and the ₹) */
function fpNoteDiff(pid, ref) {
  if (typeof enOpen !== 'function') {
    toast(tx('Open Accounts › Day book › ＋ Entry › Note a difference'));
    return;
  }
  enOpen({ kind: 'debit_note', v: { supplier: pid, against_ref: ref, reason: 'rate' }, ref: bkRef(), after: fpAfterNote });
}
/** a debit note saved: the Payables list reads again (what you owe them fell) */
function fpAfterNote() {
  fpLoad(true);
}
