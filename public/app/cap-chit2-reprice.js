/* app/cap-chit2-reprice.js — the CHIT DETAIL's PRICE-FROM-CATALOGUE capability: the preview overlay (what would change, what cannot be priced, a stated figure called out), then Apply. Split out of cap-chit2.js, code moved verbatim; the prices are the server's reprice plan, nothing is worked out here.
 * OWNS      C2R · c2RepricePreview · c2RepriceScope · c2RepricePaint · c2RepriceApply
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
var C2R = { plan: null, busy: false, only_unpriced: false };

async function c2RepricePreview() {
  C2R.busy = true;
  c2RepricePaint();
  try {
    C2R.plan = await api('c2Reprice', { params: { id: C2.id }, body: { preview: true, only_unpriced: C2R.only_unpriced } });
  } catch (e) {
    C2R.plan = { error: (e && e.message) || 'Could not read the catalogue.' };
  }
  C2R.busy = false;
  c2RepricePaint();
}
function c2RepriceScope(v) {
  C2R.only_unpriced = !!v;
  c2RepricePreview();
}

function c2RepricePaint() {
  if (C2R.busy && !C2R.plan)
    return modal(
      '<h3 style="margin:0 0 10px">₹ Price from catalogue</h3><div style="color:var(--grey);font-size:var(--fs-2)"><span class="spin"></span> checking the catalogue…</div>', false, { pop: 'POP020' }
    );
  var p = C2R.plan || {};
  if (p.error)
    return modal(
      '<h3 style="margin:0 0 10px">₹ Price from catalogue</h3><div style="color:var(--disp);font-size:var(--fs-2)">' +
        esc(p.error) +
        '</div><button data-cbsid="CMP005" class="btn" style="width:100%;margin-top:12px" onclick="closeModal()">' +
        tx('Close') +
        '</button>', false, { pop: 'POP020' }
    );

  if (!p.has_catalogue) {
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

  var will = p.will_price || [],
    need = p.needs_price || [];
  var body =
    '<div style="display:flex;gap:6px;margin-bottom:12px">' +
    [
      '<span data-cbsid="DTL006-C03" onclick="c2RepriceScope(false)" style="cursor:pointer;border:1px solid ' +
        (C2R.only_unpriced ? 'var(--line)' : 'var(--blue)') +
        ';' +
        (C2R.only_unpriced ? '' : 'background:var(--blue);color:var(--on-accent);font-weight:700;') +
        'border-radius:9px;padding:4px 11px;font-size:var(--fs-2)">' +
        tx('Every line') +
        '</span>',
      '<span data-cbsid="DTL006-C04" onclick="c2RepriceScope(true)" style="cursor:pointer;border:1px solid ' +
        (C2R.only_unpriced ? 'var(--blue)' : 'var(--line)') +
        ';' +
        (C2R.only_unpriced ? 'background:var(--blue);color:var(--on-accent);font-weight:700;' : '') +
        'border-radius:9px;padding:4px 11px;font-size:var(--fs-2)">' +
        tx('Only lines with no price') +
        '</span>'
    ].join('') +
    '</div>';

  body += will.length
    ? '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:4px">Will change (' +
      will.length +
      ')</div>' +
      will
        .map(function (item) {
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
        })
        .join('')
    : '<div style="font-size:var(--fs-2);color:var(--grey)">Nothing to change — every line already matches the catalogue.</div>';

  /* ⚠️ WHAT CANNOT BE PRICED IS SHOWN HERE, NOT LEFT AT ZERO. Athi: "if the exact item not found, then highlight
     for the cost to be updated." A chit that looks priced while a third of it is not is the failure this avoids. */
  if (need.length) {
    body +=
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
        .join('');
  }

  modal(
    '<h3 style="margin:0 0 4px">₹ Price from catalogue</h3>' +
      '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:12px">Nothing is written until you confirm. Each change is recorded as an amendment — the old price stays struck through.</div>' +
      body +
      '<div style="display:flex;gap:8px;margin-top:16px">' +
      '<button data-cbsid="CMP003" class="btn" style="flex:1" onclick="closeModal()">' +
      tx('Cancel') +
      '</button>' +
      (will.length ? '<button data-cbsid="DTL006-B03" class="btn pri" style="flex:1" onclick="c2RepriceApply()">Apply ' + will.length + '</button>' : '') +
      '</div>', false, { pop: 'POP020' }
  );
}

async function c2RepriceApply() {
  try {
    var reply = await api('c2Reprice', { params: { id: C2.id }, body: { only_unpriced: C2R.only_unpriced } });
    closeModal();
    C2R.plan = null;
    await loadChit2();
    toast((reply && reply.applied ? reply.applied : 0) + ' line(s) priced — the old values are kept');
  } catch (e) {
    toast(MSG.fail('apply the prices', e));
  }
}
