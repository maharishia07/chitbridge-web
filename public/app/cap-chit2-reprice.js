/* app/cap-chit2-reprice.js — the CHIT DETAIL's PRICE-FROM-CATALOGUE capability: the preview overlay (what would change, what cannot be priced, a stated figure called out), then Apply. Split out of cap-chit2.js; the prices are the server's reprice plan, nothing is worked out here.
 * ID        DTL006
 * OWNER     cb-orders
 * RISK      money
 * OWNS      REPRICE_STATE · c2RepricePreview · c2RepriceScope · c2RepricePaint · c2RepriceApply
 * CALLED BY app.html CAP_WITH (chit2: loaded with cap-chit2.js, ensureCap('chit2')); cap-chit2.js (the Order tab's Price from catalogue button) calls it at run time; its functions are global
 * FLOW      the Order tab → c2RepricePreview → POST c2Reprice { preview: true } → c2RepricePaint (the overlay) → c2RepriceApply → POST c2Reprice → loadChit2 (cap-chit2.js)
 * CARD      06-orders/README
 */
'use strict';
/* ── price from catalogue — PREVIEW, then apply ─────────────────────────────────────────────────────────────────
   Athi, 2026-08-13: *"either wholistically or for an individual item the price should be pulled in"* and
   *"always bring the entire content as an overlay box and perform the activity"*.

   ⚠️ THE PREVIEW IS NOT A COURTESY. Pricing a whole chit in one tap is the useful version and also the dangerous
   one — it can overwrite a figure the customer stated. Showing the exact list first turns a promise into a
   decision, and it costs one extra tap on an action performed rarely.
   ⚠️ AND IT IS AN OVERLAY, not an inline expansion, so the page does not jump under the reader's thumb. */
var REPRICE_STATE = { plan: null, busy: false, only_unpriced: false };

/** open the overlay, ask the server for the plan (nothing is written) and paint it; a failed read is painted as words */
async function c2RepricePreview() {
  REPRICE_STATE.busy = true;
  c2RepricePaint();
  try {
    REPRICE_STATE.plan = await api('c2Reprice', { params: { id: C2.id }, body: { preview: true, only_unpriced: REPRICE_STATE.only_unpriced } });
  } catch (e) {
    REPRICE_STATE.plan = { error: (e && e.message) || 'Could not read the catalogue.' };
  }
  REPRICE_STATE.busy = false;
  c2RepricePaint();
}
/** the scope chips: every line, or only the lines with no price; the plan is asked again for the chosen scope */
function c2RepriceScope(onlyUnpriced) {
  REPRICE_STATE.only_unpriced = !!onlyUnpriced;
  c2RepricePreview();
}

/** the two scope chips (Every line · Only lines with no price), the chosen one filled with the accent and its own on-accent text */
function c2RepriceScopeChipsHtml() {
  var only = REPRICE_STATE.only_unpriced;
  return (
    '<div style="display:flex;gap:6px;margin-bottom:12px">' +
    [
      '<span data-cbsid="DTL006-C03" onclick="c2RepriceScope(false)" style="cursor:pointer;border:1px solid ' +
        (only ? 'var(--line)' : 'var(--blue)') +
        ';' +
        (only ? '' : 'background:var(--blue);color:var(--on-accent);font-weight:700;') +
        'border-radius:9px;padding:4px 11px;font-size:var(--fs-2)">' +
        tx('Every line') +
        '</span>',
      '<span data-cbsid="DTL006-C04" onclick="c2RepriceScope(true)" style="cursor:pointer;border:1px solid ' +
        (only ? 'var(--blue)' : 'var(--line)') +
        ';' +
        (only ? 'background:var(--blue);color:var(--on-accent);font-weight:700;' : '') +
        'border-radius:9px;padding:4px 11px;font-size:var(--fs-2)">' +
        tx('Only lines with no price') +
        '</span>'
    ].join('') +
    '</div>'
  );
}
/** one line the plan will change: what it is, what it matches, the old price struck through and the new one */
function c2RepriceWillRowHtml(item) {
  return (
    '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:var(--fs-2)">' +
    '<span style="flex:1;min-width:0"><b>' +
    esc(item.particulars || '') +
    '</b>' +
    '<div style="font-size:var(--fs-1);color:var(--grey)"><span class=arw>→</span> ' +
    esc(item.matched) +
    (item.matched_by_spelling ? ' <span style="color:var(--warn-2)">' + tx('≈ matched by spelling') + '</span>' : '') +
    '</div>' +
    /* ⚠️ REPLACING A STATED FIGURE IS CALLED OUT. Filling an empty price and overwriting one the customer
       wrote are different acts, and only a person can say whether the second is right. */
    (item.replaces_stated_price ? '<div style="font-size:var(--fs-1);color:var(--warn-2)">replaces the price on the chit</div>' : '') +
    '</span><span style="text-align:end;font-variant-numeric:tabular-nums">' +
    (item.price != null ? '<s style="color:var(--grey)">' + c2Money(item.price) + '</s> ' : '') +
    '<b>' +
    c2Money(item.to) +
    '</b></span></div>'
  );
}
/** the lines that will change (or the sentence that nothing needs to) */
function c2RepriceWillHtml(will) {
  if (!will.length) return '<div style="font-size:var(--fs-2);color:var(--grey)">Nothing to change — every line already matches the catalogue.</div>';
  return (
    '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:4px">Will change (' +
    will.length +
    ')</div>' +
    will.map(c2RepriceWillRowHtml).join('')
  );
}
/* ⚠️ WHAT CANNOT BE PRICED IS SHOWN HERE, NOT LEFT AT ZERO. Athi: "if the exact item not found, then highlight
   for the cost to be updated." A chit that looks priced while a third of it is not is the failure this avoids. */
function c2RepriceNeedHtml(need) {
  if (!need.length) return '';
  return (
    '<div style="margin-top:14px;font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--warn-2);margin-bottom:4px">⚠️ Needs a price from you (' +
    need.length +
    ')</div>' +
    need
      .map(function (item) {
        return (
          '<div style="padding:5px 0;border-top:1px solid var(--line);font-size:var(--fs-2)"><b>' +
          esc(item.particulars || '') +
          '</b> ' +
          '<span style="color:var(--grey)">' +
          esc(item.reason) +
          '</span></div>'
        );
      })
      .join('')
  );
}
/** the overlay for a plan that read fine: the scope chips, what will change, what needs a price, then Cancel and Apply */
function c2RepricePlanHtml(plan) {
  var will = plan.will_price || [],
    need = plan.needs_price || [];
  return (
    '<h3 style="margin:0 0 4px">₹ Price from catalogue</h3>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:12px">Nothing is written until you confirm. Each change is recorded as an amendment — the old price stays struck through.</div>' +
    c2RepriceScopeChipsHtml() +
    c2RepriceWillHtml(will) +
    c2RepriceNeedHtml(need) +
    '<div style="display:flex;gap:8px;margin-top:16px">' +
    '<button data-cbsid="CMP003" class="btn" style="flex:1" onclick="closeModal()">' +
    tx('Cancel') +
    '</button>' +
    (will.length ? '<button data-cbsid="DTL006-B03" class="btn pri" style="flex:1" onclick="c2RepriceApply()">Apply ' + will.length + '</button>' : '') +
    '</div>'
  );
}
/** the overlay: checking the catalogue, why it could not be read, that there is no catalogue yet, or the plan itself */
function c2RepricePaint() {
  if (REPRICE_STATE.busy && !REPRICE_STATE.plan)
    return modal(
      '<h3 style="margin:0 0 10px">₹ Price from catalogue</h3><div style="color:var(--grey);font-size:var(--fs-2)"><span class="spin"></span> checking the catalogue…</div>', false, { pop: 'POP020' }
    );
  var plan = REPRICE_STATE.plan || {};
  if (plan.error)
    return modal(
      '<h3 style="margin:0 0 10px">₹ Price from catalogue</h3><div style="color:var(--disp);font-size:var(--fs-2)">' +
        esc(plan.error) +
        '</div><button data-cbsid="CMP005" class="btn" style="width:100%;margin-top:12px" onclick="closeModal()">' +
        tx('Close') +
        '</button>', false, { pop: 'POP020' }
    );

  if (!plan.has_catalogue) {
    return modal(
      '<h3 style="margin:0 0 6px">₹ Price from catalogue</h3>' +
        '<div style="font-size:var(--fs-2);color:var(--grey);margin-bottom:12px">' +
        txf('You have no catalogue yet, so there are no prices to pull. Add items under {cat}', { cat: '<b>' + tx('Catalogue') + '</b>' }) +
        ' and this will fill them in.</div>' +
        '<button data-cbsid="CMP005" class="btn" style="width:100%" onclick="closeModal()">' +
        tx('Close') +
        '</button>', false, { pop: 'POP020' }
    );
  }
  modal(c2RepricePlanHtml(plan), false, { pop: 'POP020' });
}

/** Apply: the server prices the lines (the old values are kept as an amendment), the chit is read again and the count is told */
async function c2RepriceApply() {
  try {
    var reply = await api('c2Reprice', { params: { id: C2.id }, body: { only_unpriced: REPRICE_STATE.only_unpriced } });
    closeModal();
    REPRICE_STATE.plan = null;
    await loadChit2();
    toast((reply && reply.applied ? reply.applied : 0) + ' line(s) priced — the old values are kept');
  } catch (e) {
    toast(MSG.fail('apply the prices', e));
  }
}
