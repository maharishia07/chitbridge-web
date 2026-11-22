/* app/chit-pay.js - MARK A CHIT PAID: the sheet, the press, the books' question, and the UPI QR for a walk-in customer.
 *
 * OWNS      chitMarkPaid(id, amount) · readPayForm · keepPaymentOnRow · chitPayBody · chitPaySubmit · chitPayAsk · chitShowQr(id, amount) · PAY_PRESS_REF (one key per open of the sheet).
 * CALLED BY public/app.html chitPaymentCell / chitMarkPaidButton (the Mark paid button's onclick) and the chit sheet's QR button.
 * FLOW      Mark paid -> sheet (method, reference, amount) -> POST chitPay (amount in minor units) -> 409 ALREADY_PAID warnings -> chitPayAsk confirms -> same press re-sent with the codes acknowledged.
 * CARD      16-finance/payables
 */
/* PAY-FIX H2: one key per OPEN of the sheet — a retry of this press repeats it (the books answer 'Already recorded'), a second press on the same chit mints a new one */
let PAY_PRESS_REF = null;
function chitMarkPaid(id, amount) {
  PAY_PRESS_REF = 'press-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  modal(`<div class="mhd"><div class="t">${esc(tx('Mark paid'))}</div><div class="s">${esc(tx('What you received, and the reference on it'))}</div></div><div class="mbody" style="display:grid;gap:8px">
    <select data-cbsid="DTL001-S01" class="inp" id="pay_method" data-testid="pay-method">${payModeOpts()}<option value="cash">${esc(tx('Cash'))}</option><option value="card">${esc(tx('Card'))}</option><option value="bank">${esc(tx('Bank transfer'))}</option><option value="other">${esc(tx('Other'))}</option></select>
    <input data-cbsid="DTL001-I01" class="inp" id="pay_ref" data-testid="pay-ref" placeholder="${esc(tx('UPI transaction id / reference'))}">
    <span class="cbdef-adorn" style="display:flex;align-items:center;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--on-card);overflow:hidden"><b style="padding:0 10px;color:var(--grey-2);font-size:var(--fs-2)">${esc(typeof CBLocale !== 'undefined' && CBLocale.symbol && moneyCode() ? CBLocale.symbol(moneyCode()) : '')}</b><input data-cbsid="DTL001-I02" class="inp" id="pay_amount" data-testid="pay-amount" type="number" step="0.01" value="${esc(String(amount || ''))}" placeholder="${esc(tx('Amount'))}" style="border:0;margin:0;flex:1;min-width:0;background:transparent"></span></div>
    <div class="mfoot"><button data-cbsid="CMP003" onclick="closeModal()">${esc(tx('Cancel'))}</button><button data-cbsid="DTL001-B03" class="pri" id="mok" data-testid="pay-ok" onclick="chitPaySubmit(this.dataset.xa)" data-xa="${esc(id)}">${esc(tx('Record'))}</button></div>`);
}
/** what the Mark-paid sheet holds now: the method (UPI where the pack has it, else cash), the reference typed, the amount as a number */
function readPayForm() {
  const field = (fieldId) => (document.getElementById(fieldId) || {}).value;
  return { method: field('pay_method') || (payHasUpi() ? 'upi' : 'cash'), ref: field('pay_ref') || '', amount: parseFloat(field('pay_amount')) };
}
/** keep the recorded payment on the open row (and its header copy), so the sheet shows it without a re-read */
function keepPaymentOnRow(id, payment) {
  const row = UI.rows && UI.rows.find((x) => x.id === id);
  if (!row) return;
  row.business_json = Object.assign({}, row.business_json || {}, { payment });
  if (row.header) row.header.business_json = Object.assign({}, row.header.business_json || {}, { payment });
}
/** what a Mark-paid press sends: the form as read when Record was pressed (kept across the books' question) and the codes the owner confirmed */
function chitPayBody(form, acknowledge) {
  /* reviews6 EL-01 M1: the amount crosses in MINOR units, a whole number (CBMoney.toMinor, the shop's currency) — never the typed decimal as a float */
  const minor = isFinite(form.amount) && typeof CBMoney !== 'undefined' ? CBMoney.toMinor(form.amount, moneyCode()) : null;
  const body = { method: form.method, ref: form.ref || undefined, amount_minor: minor > 0 ? minor : undefined, client_ref: PAY_PRESS_REF || undefined };
  if (acknowledge && acknowledge.length) body.acknowledge = acknowledge;
  return body;
}
async function chitPaySubmit(id, form, acknowledge) {
  form = form || readPayForm();
  try {
    const reply = await api('chitPay', { params: { id }, body: chitPayBody(form, acknowledge) });
    closeModal();
    toast(reply && reply.replayed ? tx('Already recorded') : tx('Payment recorded ✓'));
    keepPaymentOnRow(id, reply.payment);
    if (typeof openChit === 'function') openChit(id, true);
  } catch (e) {
    if (!chitPayAsk(id, form, e)) toast((e && e.message) || tx('Could not record'), true);
  }
}
/**
 * FIN-53 (Athi, 2026-10-29): the books' one question on a Mark-paid — 409 ALREADY_PAID with `warnings` ("More than is owed" · "Already
 * paid?") — is a deliberate confirm that names the amount over (the server's over_words; the web composes no money words), never a toast
 * that asks. Yes re-sends the SAME press with every warning's code acknowledged; the books keep the rest as an advance. → true when asked.
 */
function chitPayAsk(id, form, e) {
  const warnings = e && e.status === 409 && e.data && Array.isArray(e.data.warnings) ? e.data.warnings : [];
  if (!warnings.length) return false;
  const over = warnings.find((warning) => warning.over_words);
  closeModal();
  confirmAsk(
    e.data.error || tx('Already paid?'),
    '<p>' + esc(warnings.map((warning) => warning.words).join(' ')) + '</p>',
    over ? tx('Keep {amount} as an advance').replace('{amount}', over.over_words) : tx('Record it again'),
    /* the Yes carries the figure the person SAW ({ code, over_minor }): a stale one (a colleague recorded in between) is asked again by the server */
    () => chitPaySubmit(id, form, warnings.map((warning) => (warning.over_minor != null ? { code: String(warning.code), over_minor: warning.over_minor } : String(warning.code))))
  );
  return true;
}
/** the QR for a walk-in customer: the seller's own UPI id (the profile map / Business identity row upi_id) */
async function chitShowQr(id, amount) {
  /* the cached party may predate the id (a sync landed after the screen opened) — read once more when it has none */
  let upi = UI._party && UI._party.upi_id;
  if (!upi) {
    try {
      const reply = await api('profileGet');
      UI._party = (reply && reply.invoice_party) || {};
      upi = UI._party.upi_id;
    } catch (failure) {
      console.warn('CHIT-PAY-QR-01 the UPI id could not be read; the sheet says none is on record', (failure && failure.message) || failure);
    }
  }
  if (!upi) {
    modal(
      `<div class="mhd"><div class="t">${esc(tx('No UPI id on record'))}</div></div><div class="mbody">${esc(tx('Add your UPI id under Settings › Documents › Business identity (tag upi_id), or let the connector copy it from your system.'))}</div><div class="mfoot"><button data-cbsid="CMP005" onclick="closeModal()">${esc(tx('Close'))}</button></div>`, false, { pop: 'POP203' }
    );
    return;
  }
  const link =
    'upi://pay?pa=' +
    encodeURIComponent(upi) +
    '&pn=' +
    encodeURIComponent(String(SESSION.name || '').slice(0, 60)) +
    (amount ? '&am=' + encodeURIComponent(String(CBMoney.round(amount))) : '') +
    '&cu=' +
    encodeURIComponent(moneyCode() || '') +
    '&tn=' +
    encodeURIComponent('CB-' + String(id).slice(0, 8));
  let img = '';
  try {
    if (typeof qrcode === 'function') {
      const qr = qrcode(0, 'M');
      qr.addData(link);
      qr.make();
      img = qr.createImgTag(5, 8).replace('<img ', '<img data-testid="chit-upi-qr" alt="UPI QR" ');
    }
  } catch (failure) {
    console.warn('CHIT-PAY-QR-02 the UPI QR could not be drawn; the sheet shows the link without it', (failure && failure.message) || failure);
  }
  modal(
    `<div class="mhd"><div class="t">${esc(tx('Pay by UPI'))}</div><div class="s">${esc(upi)}${amount ? ' · ' + esc(inr(amount)) : ''} · CB-${esc(String(id).slice(0, 8))}</div></div><div class="mbody" style="text-align:center">${img || esc(tx('QR library not loaded'))}<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px">${esc(tx('Any UPI app scans this. Then Mark paid with the transaction id.'))}</div></div><div class="mfoot"><button data-cbsid="CMP005" onclick="closeModal()">${esc(tx('Close'))}</button></div>`, false, { pop: 'POP204' }
  );
}
