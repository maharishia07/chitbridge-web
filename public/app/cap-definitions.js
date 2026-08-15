/* app/cap-definitions.js — DEFINITIONS · the shelf a catalogue takes things off.  (lazy capability)
 *
 * Athi, 2026-08-15: *"create another menu type next to catalogue, where we can showcase what are all can be added
 * as part of catalogue … and its rules can be set and then, the same can be called against catalogue."*
 * Then, on the plan: *"go ahead as per your suggestion"* — which was the READ-ONLY SHOWCASE first.
 *
 * ── ⭐ WHAT THIS SCREEN IS ───────────────────────────────────────────────────────────────────────────────────────
 * The DDL half, finally given a door. Catalogue is DML — mint products and sell them. This is the layer that has
 * been written down for months and never had a screen: the reusable things a catalogue ADOPTS.
 *
 * ── ⭐⭐ THE DISTINCTION THE WHOLE DESIGN TURNS ON ────────────────────────────────────────────────────────────────
 *   KIND        "a pack model exists"        CODE — a registry — changes in a release
 *   DEFINITION  "Carton of 6" / "Diwali 10%" DATA — the entity's shelf — changes any time
 *   ADOPTION    "this catalogue uses that"   a REFERENCE on the catalogue
 *
 * THIS FILE SHOWS KINDS ONLY. No definitions, no adoption, no authoring, no writes. That is deliberate: it is the
 * part that cannot break anything, it ships today, and it answers the question that actually blocks people —
 * *what can a catalogue even have?*
 *
 * ── ⚠️⚠️ IT NEVER KEEPS ITS OWN LIST ────────────────────────────────────────────────────────────────────────────
 * Every kind on this screen is read from the registry the code already publishes — CBCart.models, CBOffers.KINDS,
 * CBCatalogueModel's palette. Typing the lists here would create a second source of truth that drifts within one
 * release and then LIES on screen, which is the exact divergence cart-ui.js exists to end. A kind added to
 * offers.js next month appears here with no edit; a kind removed stops being shown. That is the whole trick.
 *
 * ⚠️ AND WHERE A REGISTRY IS ABSENT, SAY SO. If offers.js has not loaded, the row reads "not loaded" rather than
 * rendering an empty section that looks like "there are none" — an empty list and a missing source look identical
 * on screen and mean opposite things.
 */

var CBDEF = { open: {} };

/* ── the registries, read live ───────────────────────────────────────────────────────────────────────────────── */
function cbDefRegistries(){
  var out = [];

  /* Order models — the quantity rule a catalogue declares per item. cart-ui owns them. */
  out.push({
    key: 'ordermodel', icon: '🔢', title: 'Order models',
    blurb: 'How a line is quantified. The catalogue declares it per item; every screen obeys.',
    source: 'app/cart-ui.js · MODELS',
    rows: (typeof CBCart !== 'undefined' && CBCart.models)
      ? Object.keys(CBCart.models).map(function (k) {
          var m = CBCart.models[k];
          return { code: k, label: m.label || k,
                   note: cbDefModelNote(k) };
        })
      : null
  });

  /* Offer kinds — offers.js. */
  out.push({
    key: 'offer', icon: '🏷️', title: 'Offer kinds',
    blurb: 'The shapes an offer can take. A definition picks a kind and sets its rules.',
    source: 'app/offers.js · KINDS',
    rows: (typeof CBOffers !== 'undefined' && CBOffers.KINDS)
      ? Object.keys(CBOffers.KINDS).map(function (k) {
          return { code: k, label: cbDefOfferLabel(k),
                   note: 'scope: ' + (CBOffers.KINDS[k].scope || '—') };
        })
      : null
  });

  /* The catalogue's own grammar — datatypes, selling methods, facets, pricing models, standards. */
  /**
   * ⚠️ `CBCatalogue`, NOT `CBCatalogueModel` — I invented the second name and five of the seven sections read
   * "not loaded" while the data was sitting right there. The registry's real global is CBCatalogue (see
   * catalogue-model.js line 18, `root.CBCatalogue = M`), which is precisely the name catalogue-ui.js was
   * clobbering an hour ago; renaming that one to CBCatUI is what freed it.
   *
   * ⭐ Worth noting the honest-empty-state rule earned its keep twice in one evening: "not loaded" is what
   * surfaced BOTH the missing offers.js script tag and this wrong name. Had the section rendered as an empty
   * list, both would have read as "there are none" and neither would have been found.
   */
  var P = (typeof CBCatalogue !== 'undefined' && CBCatalogue.PALETTE) ? CBCatalogue.PALETTE() : null;
  out.push({
    key: 'pricing', icon: '💱', title: 'Pricing models',
    blurb: 'How a price is arrived at. ⚠️ Declared today, not yet evaluated at order time.',
    source: 'app/catalogue-model.js · PRICING_MODELS',
    rows: P && P.pricingModels ? P.pricingModels.map(function (k) { return { code: k, label: k }; }) : null
  });
  out.push({
    key: 'method', icon: '🧾', title: 'Selling methods',
    blurb: 'How a whole catalogue sells. One per catalogue.',
    source: 'app/catalogue-model.js · METHODS',
    rows: P && P.methods ? P.methods.map(function (m) { return { code: m.k, label: m.label }; }) : null
  });
  out.push({
    key: 'datatype', icon: '🔤', title: 'Field datatypes',
    blurb: 'What a catalogue field can hold — the palette a field set is built from.',
    source: 'app/catalogue-model.js · DATATYPES',
    rows: P && P.datatypes ? P.datatypes.map(function (d) {
      return { code: d.k || d, label: d.label || d.k || d }; }) : null
  });
  out.push({
    key: 'standard', icon: '📐', title: 'Standards',
    blurb: 'Classification schemes a product can cite, by reference.',
    source: 'app/catalogue-model.js · STD_SCHEMES',
    rows: P && P.standards ? P.standards.map(function (s) { return { code: s, label: s }; }) : null
  });
  out.push({
    key: 'facet', icon: '🧩', title: 'Catalogue facets',
    blurb: 'The parts a catalogue definition is made of.',
    source: 'app/catalogue-model.js · FACETS',
    rows: P && P.facets ? P.facets.map(function (f) { return { code: f, label: f }; }) : null
  });

  return out;
}

/* The one-line reason each order model exists. ⚠️ Kept as PROSE about a rule that lives in cart-ui — not a second
   copy of the rule. If these ever disagree, cart-ui is right and this text is stale. */
function cbDefModelNote(k){
  return ({
    count:   'Whole units. A tin, a bag, a licence.',
    measure: 'A decimal amount — 2.5 kg is a real order, 2.5 tins is not.',
    pack:    'Sold in multiples. The multiple IS the unit of sale, so 13 rounds to a legal pack.',
    range:   '⚠️ A declared min/max. Below the minimum is REFUSED, never rounded up — ordering more than someone asked for costs them money.',
    pick:    'One or none. No quantity control at all; a second press must not make it two.',
    offer:   'A quantity AND your price, inside the seller’s band. Two facts about one line.'
  })[k] || '';
}
function cbDefOfferLabel(k){
  return ({
    percent_off: 'Percentage off',
    amount_off:  'Flat amount off',
    tier_price:  'Quantity tier — a RE-PRICE, not a discount',
    threshold:   'Spend or quantity threshold — reports the shortfall when it does not fire',
    buy_x_get_y: 'Buy X get Y — cheapest qualifying units are the free ones',
    shipping:    'Shipping — free, flat or a percentage',
    price_range: '⚠️ A declared band — reports a violation, never clamps a negotiated price'
  })[k] || k;
}

/* ── render ──────────────────────────────────────────────────────────────────────────────────────────────────── */
function cbDefEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ⚠️ renderApp(), not a local paint — this screen returns HTML to the router like every other
   capability, so the router is the only thing that owns the frame. */
function cbDefToggle(k){ CBDEF.open[k] = !CBDEF.open[k]; renderApp(); }

function cbDefSectionHTML(s){
  var open = !!CBDEF.open[s.key];
  var count = s.rows ? s.rows.length : 0;
  var head = '<div class="cbdef-head" data-testid="cbdef-' + cbDefEsc(s.key) + '"'
    + ' onclick="cbDefToggle(\'' + cbDefEsc(s.key) + '\')">'
    + '<span class="cbdef-ico">' + s.icon + '</span>'
    + '<span class="cbdef-t">' + cbDefEsc(s.title) + '</span>'
    /* ⚠️ "not loaded" is NOT "0". An empty list and a missing source look identical on screen and mean opposite
       things — one says the catalogue may have none of these, the other says this screen cannot tell you. */
    + '<span class="cbdef-n">' + (s.rows ? count + ' kind' + (count === 1 ? '' : 's') : 'not loaded') + '</span>'
    + '<span class="cbdef-caret">' + (open ? '▾' : '▸') + '</span></div>';
  if (!open) return '<div class="cbdef-sec">' + head + '</div>';

  var body = '<div class="cbdef-blurb">' + cbDefEsc(s.blurb) + '</div>';
  if (!s.rows) {
    body += '<div class="cbdef-empty">This registry has not loaded on this page, so its kinds cannot be listed. '
          + 'It is not that there are none.</div>';
  } else {
    body += s.rows.map(function (r) {
      return '<div class="cbdef-row">'
        + '<code class="cbdef-code">' + cbDefEsc(r.code) + '</code>'
        + '<span class="cbdef-lab">' + cbDefEsc(r.label) + '</span>'
        + (r.note ? '<div class="cbdef-note">' + cbDefEsc(r.note) + '</div>' : '')
        + '</div>';
    }).join('');
  }
  /* ⭐ THE SOURCE IS ON SCREEN. This screen's whole claim is that it does not keep its own list; saying WHERE
     each list comes from is what makes that checkable rather than a promise in a comment. */
  body += '<div class="cbdef-src">read from <code>' + cbDefEsc(s.source) + '</code></div>';
  return '<div class="cbdef-sec">' + head + '<div class="cbdef-body">' + body + '</div></div>';
}

function cbDefHTML(){
  var secs = cbDefRegistries();
  return '<div class="cbdef-wrap" data-testid="definitions">'
    + '<div class="cbdef-hd">'
    +   '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:14px">🧱 Definitions</span>'
    +   '<button onclick="openAssist(\'definitions\')" title="Ask the assistant about this screen"'
    +   ' style="border:1px solid var(--line);background:#fff;color:#3F66A6;border-radius:50%;width:20px;'
    +   'height:20px;font-weight:800;cursor:pointer;font-size:12px;line-height:1;flex:none">?</button>'
    + '</div>'
    + '<div class="cbdef-lede">Everything a catalogue can be built from. These are the <b>kinds</b> the system '
    + 'knows — the shapes available to you. Naming your own (a category list, an offer, “Carton of 6”) and '
    + 'attaching them to a catalogue comes next.</div>'
    /**
     * ⚠️ SAYING WHAT IS NOT HERE, IN THE PRODUCT, NOT ONLY IN A SPEC. A showcase that looks like a finished
     * feature invites someone to hunt for the Create button and conclude the screen is broken. The honest
     * version of "read-only first" says so out loud.
     */
    + '<div class="cbdef-note-box">This is a <b>read-only showcase</b>. Nothing here can be created or edited '
    + 'yet — and the reason is deliberate: attaching a definition to a catalogue has to decide what happens at '
    + 'the mint. A chit that resolves its terms from a definition someone edits next week is a chit whose terms '
    + 'changed after they were agreed. Loose while referenced, <b>frozen by value when stamped</b> — that rule '
    + 'gets built before the Create button does.</div>'
    + secs.map(cbDefSectionHTML).join('')
    + '</div>';
}

/**
 * definitionsScreen — the entry point the router calls. RETURNS HTML; it does not paint. Every other
 * capability in this app works that way (traceabilityScreen, readinessScreen, disputesScreen) and a screen that
 * painted itself would be the one that behaves differently for no reason.
 */
function definitionsScreen(){ cbDefCss(); return cbDefHTML(); }

function cbDefCss(){
  if (document.getElementById('cbdef_css')) return;
  var s = document.createElement('style');
  s.id = 'cbdef_css';
  s.textContent = [
    /**
     * ⚠️⚠️ THE SCREEN MUST OWN ITS OWN SCROLLING. `#mainbody` is `flex:1; display:flex; flex-direction:column;
     * min-height:0` — a flex COLUMN that does not scroll. A screen that just returns tall HTML gets clipped in
     * silence: measured here at 2,071px of content in a 799px viewport with `overflow-y: visible`, so 1,272px —
     * every section below Offer kinds — was simply unreachable. Nothing errors, the page just ends.
     *
     * Peer screens (cap-readiness and friends) each wrap their body in an `overflow:auto` pane for exactly this
     * reason. `flex:1` so it takes the remaining height rather than its content's height, and `min-height:0`
     * because a flex item's default `min-height:auto` refuses to shrink below its content and would put the
     * overflow back where it started.
     */
    '.cbdef-wrap{flex:1;min-height:0;overflow-y:auto;padding:14px 16px 40px;max-width:820px}',
    '.cbdef-hd{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
    '.cbdef-lede{font-size:13px;color:var(--grey);line-height:1.55;margin-bottom:10px;max-width:66ch}',
    '.cbdef-note-box{font-size:12.5px;line-height:1.55;color:#6b5a36;background:var(--gold-soft);',
    'border:1px solid var(--gold-line);border-radius:10px;padding:10px 12px;margin-bottom:14px;max-width:66ch}',
    '.cbdef-sec{border:1px solid var(--line);border-radius:11px;margin-bottom:9px;background:#fff;overflow:hidden}',
    '.cbdef-head{display:flex;align-items:center;gap:9px;padding:11px 13px;cursor:pointer;user-select:none}',
    '.cbdef-head:hover{background:#fafafa}',
    '.cbdef-ico{font-size:16px;line-height:1}',
    '.cbdef-t{font-weight:700;font-size:13.5px}',
    '.cbdef-n{margin-left:auto;font-size:11.5px;color:var(--grey);font-variant-numeric:tabular-nums}',
    '.cbdef-caret{color:var(--grey);font-size:12px;width:12px;text-align:center}',
    '.cbdef-body{padding:0 13px 12px;border-top:1px solid var(--line)}',
    '.cbdef-blurb{font-size:12.5px;color:var(--grey);line-height:1.5;margin:10px 0 8px;max-width:66ch}',
    '.cbdef-row{padding:7px 0;border-bottom:1px dashed #eee9e0}',
    '.cbdef-row:last-of-type{border-bottom:0}',
    '.cbdef-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;',
    'background:#f4f2ec;border-radius:5px;padding:1px 6px;margin-right:8px;color:#5a5245}',
    '.cbdef-lab{font-size:13px;font-weight:600}',
    '.cbdef-note{font-size:12px;color:var(--grey);margin-top:3px;line-height:1.5;max-width:66ch}',
    '.cbdef-empty{font-size:12.5px;color:#b4453f;padding:6px 0 2px;max-width:66ch}',
    '.cbdef-src{margin-top:10px;font-size:11px;color:#9aa3a7}',
    '.cbdef-src code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}'
  ].join('');
  (document.head || document.documentElement).appendChild(s);
}
