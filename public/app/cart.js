/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * CAPABILITY: CART — one basket, everywhere (app/cart.js). Athi, 2026-09-05: "the cart is a single view we should be able to
 * embed anywhere so we get the same style and response everywhere — single source of truth; convert as a capability and
 * remove duplicate code, so we can work on one piece of code."
 *
 * CONTRACT
 *   in   a catalogue payload as the catalogue view (lib/catalogue-view.js) emits it — items with item_data · tax · avail,
 *        offers, categories, shop — the SAME payload the storefront, Suppliers, Compose/Network and the API read.
 *   out  CBCart.create(cat, opts) → a handle: state · rows · lines · selected · qtyOf · add/dec/setQty · open/close ·
 *        moneyRows() · reviewHTML() — and CBCatUI: pickerHTML · listHTML · barHTML · rowHTML (the rows every surface draws).
 *   money  CBCart.money(lines, {offers, ctx, taxOf}) + CBCart.moneyRowsHTML(m) are the ONLY place a buyer's money is computed
 *        (offers → after offers → GST per rate → total incl. tax). The server re-prices every order with the same engines.
 *
 * GUARDS   e2e/one-cart.cjs (a second total or basket evaluation fails the run) · e2e/dup-functions.cjs · e2e/render-smoke.cjs
 * SPECS    [PAR-01] parity across surfaces · [EXP-01] exposure · [OFF-01/02] offers · [SF-01] storefront · [PAY-01] · tour-two
 * LEGEND   cap-legend.js › cart (maturity 2 → 3)
 *
 * HISTORY  2026-08 cart-ui.js (state, money, panel) and catalogue-ui.js (rows, chip, picker) were two files; every surface
 *          loaded both, the storefront loaded one and drew its own rows, and the reviews summed their own lines. Merged
 *          2026-09-05 into this one file; the two globals CBCart and CBCatUI are kept so no caller changes.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 */
/* ═══ PART 1 · THE STATE, THE MONEY, THE BASKET PANEL (was app/cart-ui.js) ═══════════════════════════════ */

/**
 * cart-ui.js — THE cart. One implementation, used by every screen that puts items on a chit.
 *
 * Athi, 2026-08-08: *"it has to be one helper and should be used everywhere."*
 *
 * He said it while I was pasting the cart popup into a second mock, which is exactly how the last divergence
 * started: the storefront learned to group variants and the supplier view did not, because the WALK was shared and
 * the RENDER was copied. Copying the render is copying the bug surface.
 *
 * So this file owns the whole cart — the quantity model, the bar, the list rows, and the popup — and every screen
 * calls it. The four callers are the four places an order is composed:
 *
 *     Compose (self)  ·  Suppliers  ·  Network store catalogues  ·  Storefront
 *
 * ── WHAT A CALLER SUPPLIES, AND WHAT IT MUST NOT ─────────────────────────────────────────────────────────────────
 * A caller supplies: the catalogue payload, three element ids to paint into, a currency symbol, and what CHECK OUT
 * means on that screen. That is all. A caller does NOT supply row markup, quantity rules, or its own popup — the
 * moment one of them does, this file has stopped being the single implementation.
 *
 * Theming is one accent colour, because the storefront is a public page in a shop's own colours and the signed-in
 * app is not. That is a legitimate difference; a second copy of the rows is not.
 *
 * ── THE MODEL ────────────────────────────────────────────────────────────────────────────────────────────────────
 * `sel` maps item_id → QUANTITY. Zero is never stored: removing the last one deletes the key, so "in the cart"
 * stays one fact rather than two that can disagree. This is the stepper Athi built in 2018 — `+` on a row, `− n +`
 * once it is in — because quantity belongs beside the price and unit that inform it, not in a panel two steps on.
 *
 * Depends on cbLineRows() from catalogue-lines.js for the walk (groups, variants, nothing dropped).
 */
(function (root) {
  'use strict';

  var C = {};            // ns -> cart state
  var MAX_QTY = 100000;  // the server's own line cap; refuse at the row so a typo is caught where it was made

  /**
   * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
   *  ORDER MODELS — how a line is quantified. ONE registry, and every surface obeys it.
   * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
   *
   * Athi, 2026-08-08: *"now if you apply different cart type like range and so on, can you check each one how it
   * works, so you have the cart model picker as a single source and the same can be applied as part of the helper."*
   *
   * A `+` that adds 1 is right for a tin of paint and wrong for almost everything else a real catalogue holds:
   * bolts sold in boxes of 100, cable sold by the metre between 5 and 500, a survey you either want or do not, a
   * price you are invited to offer against a band. Each of those was previously going to become a special case in
   * whichever screen hit it first — which is how four screens end up disagreeing about what a quantity is.
   *
   * So the CATALOGUE DECLARES and the cart obeys:
   *
   *     item_data.order = { model:'range', min:5, max:500, step:5 }
   *
   * ── THE MODELS ───────────────────────────────────────────────────────────────────────────────────────────────
   *   count    (default)  whole units. + adds 1. A tin, a bag, a licence.
   *   measure             a decimal amount. 2.5 kg is a real order; 2.5 tins is not.
   *   pack                sold in multiples — step 12 means 12, 24, 36. Never 13.
   *   range               a declared min/max. Below the minimum is REFUSED, not rounded up quietly.
   *   pick                one or none. A service, an inspection, a form. No quantity control at all.
   *   offer               a quantity AND your price, bounded by the seller's declared band.
   *
   * ── WHY EACH RULE IS WHERE IT IS ─────────────────────────────────────────────────────────────────────────────
   * `coerce` is the single gate every change passes through — the stepper, the typed box, the popup and any future
   * caller. That is the whole point of one source: a pack of 12 cannot be broken by typing 13 into a different
   * screen's input, because there is no other input. Anything a model refuses returns 0, which removes the line,
   * because a line that cannot hold a legal quantity should not be in the cart at all.
   *
   * ⚠️ A MODEL NEVER SILENTLY CORRECTS UPWARD. `range` with min 5 refuses 3 rather than making it 5 — quietly
   * ordering more than someone asked for is the failure that costs them money. `pack` DOES round to the nearest
   * legal multiple, because there the multiple IS the unit of sale and 13 boxes is not a thing that exists.
   * The difference is real: one is a limit, the other is a granularity.
   */
  var MODELS = {
    count: {
      label: 'each',
      coerce: function (v) { var n = Math.floor(parseFloat(v)); return isFinite(n) && n > 0 ? Math.min(MAX_QTY, n) : 0; },
      next: function (v, d) { return Math.max(0, (Number(v) || 0) + d); },
      hint: function () { return ''; }
    },
    measure: {
      label: 'amount',
      // Decimal, because 2.5 kg is a real order. Rounded to 3 places so floating point cannot produce 2.4999999.
      coerce: function (v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? Math.min(MAX_QTY, Math.round(n * 1000) / 1000) : 0; },
      next: function (v, d, o) { var s = Number(o.step) || 1; return Math.max(0, Math.round(((Number(v) || 0) + d * s) * 1000) / 1000); },
      hint: function (o) { return o.step ? 'in steps of ' + o.step : ''; }
    },
    pack: {
      label: 'pack',
      // The multiple IS the unit of sale, so 13 is rounded to the nearest legal pack — 13 boxes does not exist.
      coerce: function (v, o) {
        var s = Number(o.step) || 1, n = parseFloat(v);
        if (!isFinite(n) || n <= 0) return 0;
        return Math.min(MAX_QTY, Math.max(s, Math.round(n / s) * s));
      },
      next: function (v, d, o) { var s = Number(o.step) || 1; return Math.max(0, (Number(v) || 0) + d * s); },
      hint: function (o) { return 'sold in ' + (o.step || 1) + 's'; }
    },
    range: {
      label: 'range',
      /* ⚠️ Below the minimum is REFUSED, never rounded up. Ordering more than someone asked for costs them money. */
      coerce: function (v, o) {
        var n = parseFloat(v);
        if (!isFinite(n) || n <= 0) return 0;
        if (o.min != null && n < Number(o.min)) return 0;
        if (o.max != null && n > Number(o.max)) return Number(o.max);   // a ceiling may clamp; a floor may not
        return Math.min(MAX_QTY, Math.round(n * 1000) / 1000);
      },
      next: function (v, d, o) {
        var s = Number(o.step) || 1, cur = Number(v) || 0;
        if (!cur && d > 0) return Number(o.min) || s;                   // first press lands ON the minimum
        return Math.max(0, Math.round((cur + d * s) * 1000) / 1000);
      },
      hint: function (o) {
        return (o.min != null ? 'min ' + o.min : '') + (o.min != null && o.max != null ? ' · ' : '')
             + (o.max != null ? 'max ' + o.max : '');
      }
    },
    pick: {
      label: 'one or none',
      // No quantity exists. One, or not in the cart. A second press must not make it two.
      coerce: function (v) { return (parseFloat(v) > 0) ? 1 : 0; },
      next: function (v, d) { return d > 0 ? 1 : 0; },
      hint: function () { return ''; }
    },
    offer: {
      label: 'name your price',
      coerce: function (v) { var n = Math.floor(parseFloat(v)); return isFinite(n) && n > 0 ? Math.min(MAX_QTY, n) : 0; },
      next: function (v, d) { return Math.max(0, (Number(v) || 0) + d); },
      hint: function (o) {
        if (o.price_min == null && o.price_max == null) return 'name your price';
        return 'seller’s range ' + (o.price_min != null ? o.price_min : '') + '–' + (o.price_max != null ? o.price_max : '');
      }
    }
  };

  /** The declaration for a row — the item's own, falling back to the catalogue's, falling back to plain counting. */
  function declOf(ns, r) {
    var s = C[ns] || {}, d = (r && (r.item && (r.item.item_data || r.item))) || {};
    var o = d.order || (s.cat && s.cat.shop && s.cat.shop.order) || {};
    if (!o || typeof o !== 'object') return {};
    /* ⭐ ADOPTED BY REFERENCE (backlog 17): `{ref:<definition_id>}` resolves LIVE, so a correction to
       "Carton of 6" reaches every product that adopted it. The values are frozen onto the chit at the mint,
       never stored on the product. An inline declaration still works and is left untouched. */
    return (o.ref && typeof cbOrderDecl === 'function') ? cbOrderDecl(o) : o;
  }
  /**
   * ⚠️⚠️ AN UNRESOLVED REFERENCE DOES NOT FALL BACK TO `count`. That default is right for a MISSING model and
   * catastrophic for an UNREADABLE one: "Carton of 6" would silently become "6 each" — same number, different
   * promise, no error anywhere, and the customer receives six boxes or six items depending on nobody's decision.
   * Callers get null and must refuse to quantify rather than guess.
   */
  function modelOf(ns, r) {
    var o = declOf(ns, r);
    if (o && o.unresolved) return null;
    return MODELS[o.model] || MODELS.count;
  }
  /** Row lookup by id — models need the declaration, and every mutation is given only an id. */
  function rowById(ns, id) {
    var s = C[ns]; if (!s) return null;
    var all = rowsOf(s.cat);
    for (var i = 0; i < all.length; i++) if (all[i].type === 'line' && all[i].item_id === id) return all[i];
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rowsOf(cat) {
    return (typeof root.cbLineRows === 'function')
      ? root.cbLineRows(cat)
      : ((cat && cat.items) || []).map(function (p) { return { type: 'line', item: p, item_id: p.item_id, variant: '' }; });
  }
  function dataOf(r) { return (r.item && (r.item.item_data || r.item)) || {}; }
  function nameOf(r) {
    var d = dataOf(r);
    return r.variant ? ((d.name || d.product || '') + ' ' + r.variant).trim() : (d.name || d.product || 'item');
  }
  function priceOf(r) {
    var p = dataOf(r).price;
    var v = (p && typeof p === 'object' && p.amount !== undefined) ? p.amount : p;
    return parseFloat(v);
  }
  function sigOf(cat) {
    var shop = (cat && cat.shop) || {};
    return [shop.bridge_id || shop.entity_id || '', ((cat && cat.items) || []).length].join('|');
  }

  /**
   * init — point a cart at a catalogue.
   *
   * ⚠️ RE-INITIALISING MUST NOT EMPTY THE CART. Screens call this on every repaint, and repaints happen for reasons
   * unrelated to the catalogue. The cart is kept while the catalogue is the SAME one and cleared only when a
   * genuinely different one arrives — a different supplier, a different store. Conservative on purpose: a stale
   * tick is visible on screen and can be removed; a silently emptied cart is not visible at all.
   */
  function init(ns, cat, opts) {
    var prev = C[ns], sig = sigOf(cat), keep = prev && prev.sig === sig;
    C[ns] = {
      cat: cat || {}, sig: sig,
      sel: keep ? prev.sel : {}, q: keep ? prev.q : '', open: false,
      opts: opts || (prev && prev.opts) || {}
    };
    return C[ns];
  }
  function st(ns) { return C[ns]; }
  function opt(ns, k, dflt) { var s = C[ns]; var v = s && s.opts && s.opts[k]; return v === undefined ? dflt : v; }

  /* ── numbers ─────────────────────────────────────────────────────────────────────────────────────────────── */
  function lines(ns) { var s = C[ns]; return s ? Object.keys(s.sel).length : 0; }
  function units(ns) {
    var s = C[ns]; if (!s) return 0;
    return Object.keys(s.sel).reduce(function (n, k) { return n + (Number(s.sel[k]) || 0); }, 0);
  }
  function qtyOf(ns, id) { var s = C[ns]; return (s && Number(s.sel[id])) || 0; }
  /**
   * The running total, and whether it is WHOLE. A total that silently skips unpriced lines is wrong in the
   * direction that costs money, so `partial` is returned and every surface must show it.
   */
  /**
   * unitPrice — THE price for a line, which is not always the catalogue's.
   *
   * Athi, 2026-08-08: *"your price value not appearing in the review page, it got ignored."*
   *
   * It was. `offer` lines carried the buyer's price out with the line, and then every total and every summary went
   * on multiplying the SELLER's price — so someone who offered ₹850 against a ₹900 ask saw ₹900 on review and would
   * have sent an order at a number they never agreed to. Silently reverting to the higher price is the worst
   * direction for this class of bug to fail in.
   *
   * The fix belongs here and not on the review screen, because the question "which price counts for this line" has
   * exactly one answer and four screens that need it. Anything that shows or sums money calls this.
   */
  function unitPrice(ns, r) {
    var s = C[ns] || {}, o = declOf(ns, r);
    if (o.model === 'offer') {
      var v = (s.offers || {})[r.item_id];
      if (v != null && isFinite(v)) return { amount: Number(v), offered: true, asking: priceOf(r) };
    }
    /* the pricing structure the product cites re-prices the unit at this quantity (pricing.js) — before offers, before tax */
    var list = priceOf(r);
    if (typeof CBPricing !== 'undefined' && dataOf(r).pricing_kind) {
      var tp = CBPricing.unitPrice(dataOf(r), Number(r.qty) || 1, list);
      return { amount: tp.amount, offered: false, asking: list, tier: tp.tier || null, why: tp.why };
    }
    return { amount: list, offered: false, asking: list };
  }
  function total(ns) {
    var s = C[ns]; if (!s) return { amount: 0, partial: false, offered: false };
    var amount = 0, partial = false, offered = false;
    rowsOf(s.cat).forEach(function (r) {
      if (r.type !== 'line' || !s.sel[r.item_id]) return;
      var u = unitPrice(ns, r);
      if (u.offered) offered = true;
      if (!isFinite(u.amount)) { partial = true; return; }
      amount += u.amount * (Number(s.sel[r.item_id]) || 0);
    });
    // `offered` lets a screen say WHOSE number this is. A total that mixes an asking price and an offer without
    // saying so reads as agreed when nothing has been agreed.
    return { amount: amount, partial: partial, offered: offered };
  }
  /** the selected lines in the OFFER ENGINE's shape (key · item_id · sku · categories · qty · unitPrice · tax) — for money() */
  function engineLines(ns) {
    var s = C[ns]; if (!s) return [];
    var out = [];
    rowsOf(s.cat).forEach(function (r) {
      if (r.type !== 'line' || !s.sel[r.item_id]) return;
      var u = unitPrice(ns, r), d = (r.item && (r.item.item_data || r.item)) || {};
      out.push({ key: String(r.item_id), item_id: r.item_id, sku: d.sku || d.code || null, categories: d.category_ids || d.categories || [], excluded: Array.isArray(d.offers_excluded) ? d.offers_excluded : [],
                 qty: Number(s.sel[r.item_id]) || 0, unitPrice: isFinite(u.amount) ? u.amount : 0, tax: (r.item && r.item.tax) || d.tax || null });
    });
    return out;
  }
  /** What is in the cart, in the shape a chit line needs. Reads the WHOLE catalogue, never the filtered view. */
  function selected(ns) {
    var s = C[ns]; if (!s) return [];
    return rowsOf(s.cat).filter(function (r) { return r.type === 'line' && s.sel[r.item_id]; })
      .map(function (r) {
        var d = dataOf(r);
        var o = declOf(ns, r), u = unitPrice(ns, r), q = Number(s.sel[r.item_id]) || 1;
        /* ⭐ THE LINE CARRIES ITS CATEGORIES so an offer can target them (offers.js `applies_to.category`).
           ⚠️ That field has existed in the engine all along and never matched anything, because nothing here
           emitted one — a filter with no data to filter on fails closed and looks like a feature that works. */
        return { item_id: r.item_id, item: r.item, qty: q, name: nameOf(r), categories: catgsOf(r), excluded: (d && Array.isArray(d.offers_excluded)) ? d.offers_excluded.map(String) : [],
                 unit: d.unit || 'unit', price: d.price, code: d.code || d.sku || null,
                 // The price that COUNTS for this line, and the line's own total — computed once, here, so no
                 // screen has to decide again whether an offer beats the catalogue.
                 unit_price: u.amount, asking_price: u.asking, offered: u.offered,
                 line_total: isFinite(u.amount) ? u.amount * q : null,
                 // The MODEL travels with the line, so what was agreed can be read back later — a '4' means
                 // something different on a pack of 12 than on a metre of cable.
                 model: o.model || 'count',
                 /**
                  * ⭐⭐ CITE THE ORDER MODEL SO THE MINT FREEZES IT (backlog 17). `definition_ids` is the
                  * existing adoption channel: sendChit() collects every line's ids and POSTs them to
                  * /definitions/freeze, stamping the version that was agreed.
                  *
                  * ⚠️ WITHOUT THIS THE REFERENCE WOULD STAY LOOSE FOREVER. `model` above travels as a bare word
                  * — "pack" — and pack of WHAT is in the definition. Changing "Carton of 6" to 12 next month
                  * would re-read a chit already agreed at 6, and the chit itself could not prove otherwise.
                  * The freeze is what makes the reference safe; citing it is what triggers the freeze.
                  * ⚠️ Deduplicated upstream in sendChit, so fifty lines on one model freeze it once.
                  */
                 definition_ids: (d.order && d.order.ref) ? [d.order.ref] : [],
                 offer: (s.offers && s.offers[r.item_id]) != null ? s.offers[r.item_id] : null };
      });
  }

  /* ── categories ──────────────────────────────────────────────────────────────────────────────────────────────
   * ⚠️ THE STATE IS `s.catg`, NOT `s.cat`. `s.cat` is the CATALOGUE and has been since this file was written —
   * naming the category filter `cat` would have silently replaced every screen's product list with a string.
   * The near-miss is the whole reason this comment is here.
   *
   * ⭐ A CATEGORY IS STORED AS A definition_id AND ONLY EVER AS A definition_id (BACKLOG 15: *"Store the
   * `definition_id`, never the name. Refer, do not copy"*). The label comes from the `categories` map the host
   * passes in — so renaming a category in Definitions renames it everywhere, which is the entire point of a
   * definition. ⚠️ If no map is supplied the id itself is shown rather than nothing: an unresolved reference
   * should look wrong, not look absent.
   */
  /* ⚠️ A NAMED SENTINEL, and not a leading space. My first cut used `' none'` — written twice — and BOTH spaces
     serialised as NUL bytes, which `node --check` passes and only the static guard catches. One constant now:
     no second literal to get wrong, and no whitespace to be eaten. A definition_id can never collide with it. */
  var CATG_NONE = '__none';
  /**
   * ⭐ MANY, NOT ONE (Athi, 2026-08-16). A row is counted under EVERY category it carries and matches a filter
   * if ANY of them matches — so rice under Grains and Staples appears in both, and the two chip counts add up to
   * more than the catalogue. That is correct and worth saying out loud: these are memberships, not a partition.
   *
   * ⚠️ Reads through the shared `catgIdsOf` (core.js) so the legacy single-`category` shape is understood in
   * exactly one place. This file must never look at `d.category` itself.
   */
  function catgsOf(r) {
    var d = dataOf(r);
    if (typeof root.catgIdsOf === 'function') return root.catgIdsOf(d);
    if (Array.isArray(d.categories)) return d.categories.map(String).filter(Boolean);
    return d.category ? [String(d.category)] : [];
  }
  /**
   * ⭐⭐ A definition_id IS MEANINGLESS ACROSS AN ENTITY BOUNDARY, and this is where that stops being theory.
   *
   * On YOUR catalogue the host passes `categories` — your live definitions — and an id resolves to a name. On a
   * SUPPLIER's or a network peer's catalogue it cannot: their category is their definition, in their entity, and
   * we have no right to read it. So the published item may carry `category_name` as a VALUE beside the id, and
   * that value is what a counterparty reads.
   *
   * ⚠️ That is not a workaround, it is [[reference-cb-core-principle]] applied to a label: a reference is only
   * resolvable inside the entity that owns it, so anything that must survive the crossing travels as a copy.
   * The id stays for the owner (rename follows); the name travels for everyone else (rename does not follow, and
   * must not — a counterparty's screen should not silently relabel itself).
   */
  function catgLabel(ns, r, id) {
    var m = opt(ns, 'categories', null);
    /* The travelling names are positionally aligned with the ids, so the label for THIS id is at its index. */
    var carriedAt = function () {
      var d = dataOf(r);
      var ids = (typeof root.catgIdsOf === 'function') ? root.catgIdsOf(d) : [];
      var names = (typeof root.catgNamesOf === 'function') ? root.catgNamesOf(d) : [];
      var i = ids.indexOf(String(id));
      return (i >= 0 && names[i]) ? String(names[i]) : null;
    };
    /* ⚠️ A FUNCTION IS ALLOWED, and compose needs it. Options are captured once at create(); the shelf arrives
       later, on the same async trip as the offers. A captured `null` would stay null for the life of the cart
       and every chip would read as a raw id. A getter is read at paint time, so late is fine. */
    if (typeof m === 'function') { try { m = m(); } catch (e) { m = null; } }
    if (m && m.length) { for (var i = 0; i < m.length; i++) if (String(m[i].id) === String(id)) return m[i].name; }
    var carried = r ? carriedAt() : null;
    return carried ? carried : String(id);
  }
  /** Label without a row to hand — the empty-state message. Reads the tally so it says the same word the chip does. */
  function catgName(ns, id) {
    var t = catgTally(ns);
    for (var i = 0; i < t.length; i++) if (String(t[i].id) === String(id)) return t[i].name;
    return String(id);
  }
  /** Counts come from the CATALOGUE, never from the filtered rows — a chip that recounts itself as you filter is
   *  a chip that reads 0 next to the list it is showing. */
  function catgTally(ns) {
    var s = C[ns]; if (!s) return [];
    var all = rowsOf(s.cat), seen = {}, label = {}, order = [], none = 0;
    for (var i = 0; i < all.length; i++) {
      if (all[i].type === 'product') continue;
      var cs = catgsOf(all[i]);
      if (!cs.length) { none++; continue; }
      /* ⚠️ One row, several counts — a product in two categories is counted in both. The chip totals therefore
         exceed the catalogue size, and that is the honest arithmetic for memberships. */
      for (var j = 0; j < cs.length; j++) {
        var c = cs[j];
        if (seen[c] === undefined) { seen[c] = 0; order.push(c); label[c] = catgLabel(ns, all[i], c); }
        seen[c]++;
      }
    }
    var out = order.map(function (c) { return { id: c, name: label[c], n: seen[c] }; });
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    /* ⭐ Athi, 2026-08-16: *"uncategorised chip when count above zero"*. Below zero it is not a category anyone
       needs to be told about; above zero it is the only chip that tells you there is tidying to do. It sorts LAST
       because it is a gap in the data, not a section of the shelf. */
    if (none) out.push({ id: CATG_NONE, name: 'Uncategorised', n: none, none: true });
    return out;
  }
  function catgSet(ns, v) {
    var s = C[ns]; if (!s) return;
    s.catg = (s.catg === v) ? '' : v;          // tapping the active chip clears it — no separate "All" to hunt for
    paintCatgs(ns); paintList(ns);
  }
  /** ⚠️ Its own element, repainted on its own. Repainting the sticky row would take the search input — and the
   *  caret inside it — with it, which is the same trap documented on pickerHTML. */
  function catgsHTML(ns) {
    var s = C[ns]; if (!s) return '';
    var t = catgTally(ns);
    /* One category is not a choice, and zero is not a strip. Nothing on screen until there is something to pick. */
    if (t.length < 2) return '';
    var a = accent(ns), sf = soft(ns);
    var chip = function (id, label, n, on) {
      return '<button type="button" class="cbpick-chip' + (on ? ' on' : '') + '"'
        + (on ? ' style="background:' + sf + ';border-color:' + a + ';color:' + a + '"' : '')
        + ' data-testid="pick-catg' + (id ? '' : '-all') + '"'
        + ' onclick="CBCart.category(\'' + esc(ns) + '\',\'' + esc(id) + '\')">'
        + esc(label) + (n == null ? '' : ' <span class="cbpick-chipn">' + n + '</span>') + '</button>';
    };
    return chip('', 'All', null, !s.catg)
      + t.map(function (c) { return chip(c.id, c.name, c.n, s.catg === c.id); }).join('');
  }
  function paintCatgs(ns) { var el = doc(opt(ns, 'listEl') + '_catg'); if (el) el.innerHTML = catgsHTML(ns); }

  /* ── the visible rows ────────────────────────────────────────────────────────────────────────────────────── */
  function rows(ns) {
    var s = C[ns]; if (!s) return [];
    var all = rowsOf(s.cat), q = (s.q || '').trim().toLowerCase(), g = s.catg || '';
    /**
     * ⭐⭐ "ON OFFER" IS A FILTER THIS FILE DELIBERATELY DOES NOT UNDERSTAND.
     *
     * Athi, 2026-09-02: *"do we have options to filter based on offers, discount?"* — yes, and the cart engine
     * is the wrong place to teach what an offer IS. It knows quantities and totals; validity windows, regions
     * and targeting live in offers.js, and the renderer already holds them.
     *
     * ⚠️ So the flag is here and the JUDGEMENT is injected: `opts.isOnOffer(row)`. Without a predicate the flag
     * cannot narrow anything, which is the safe direction — a filter that silently hides rows because nobody
     * supplied the test would empty a catalogue and look like an outage.
     */
    /* ⭐ THE RENDERER IS THE SEAM WE ALREADY HAVE. opts.renderer is held here for painting; asking IT the
       question keeps the dependency pointing the right way — cart-ui never learns what an offer is. */
    var _rn = s.o && s.o.renderer;
    var onlyOff = !!s.onlyOffers;
    var isOff = (_rn && typeof _rn.isOnOffer === 'function') ? function (r) { return _rn.isOnOffer(r, s.o); } : null;
    if (onlyOff && !isOff) onlyOff = false;
    if (!q && !g && !onlyOff) return all;                 // the list is ALWAYS the full list — the cart is a popup, not a filter
    var out = [], pend = null, took = false;
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (r.type === 'product') { pend = r; took = false; continue; }
      if (onlyOff && !isOff(r)) continue;
      if (g) {
        var cs = catgsOf(r);
        /* ANY membership matches. Uncategorised is "carries none at all". */
        if (g === CATG_NONE ? cs.length > 0 : cs.indexOf(g) < 0) continue;
      }
      if (q) {
        var hay = (nameOf(r) + ' ' + (dataOf(r).unit || '') + ' ' + (dataOf(r).code || '')).toLowerCase();
        if (hay.indexOf(q) === -1) continue;
      }
      if (pend && !took) { out.push(pend); took = true; }   // a matched variant keeps its heading, for context
      out.push(r);
    }
    return out;
  }

  /* ── changes. One route, so the list and the popup can never disagree. ───────────────────────────────────── */
  function touched(ns) { var s = C[ns]; if (s && s.open) paintPopup(ns); else paint(ns); }
  /**
   * ⚠️ ONE GATE. Every change — the +, the −, the typed box, the popup's controls, and anything added later —
   * lands here and is passed through the ROW'S OWN MODEL. That is what makes the registry a single source rather
   * than a suggestion: a pack of 12 cannot be broken by typing 13 somewhere else, because there is nowhere else.
   * A value the model refuses becomes 0 and the line leaves the cart — a line that cannot hold a legal quantity
   * has no business being in it.
   */
  function put(ns, id, raw) {
    var s = C[ns]; if (!s) return;
    var r = rowById(ns, id), o = declOf(ns, r), m = modelOf(ns, r);
    /* ⚠️ REFUSE TO QUANTIFY AN UNREADABLE MODEL. Coercing with the default would accept the number under the
       wrong rule — "Carton of 6" silently becoming "6 each" — so the line takes no quantity until its
       definition can be read. Refusing is visible; guessing is not. */
    if (!m) return;
    var v = m.coerce(raw, o);
    if (v > 0) s.sel[id] = v; else delete s.sel[id];
    touched(ns);
  }
  function step(ns, id, dir) {
    var s = C[ns]; if (!s) return;
    var r = rowById(ns, id), o = declOf(ns, r), m = modelOf(ns, r);
    if (!m) return;                                   // same reason as put() — no stepping under a guessed rule
    put(ns, id, m.next(s.sel[id] || 0, dir, o));
  }
  function add(ns, id) { step(ns, id, +1); }
  function dec(ns, id) { step(ns, id, -1); }
  function setQty(ns, id, v) { put(ns, id, v); }
  /** The buyer's offer on an `offer` line. Kept apart from quantity — it is a different fact about the same line. */
  function setOffer(ns, id, v, label) {
    /* the word beside an offered price: a negotiation says "your offer"; a discount says the offer's own name */
    var s0 = C[ns]; if (s0) { s0.offerLabels = s0.offerLabels || {}; if (label) s0.offerLabels[id] = String(label); else delete s0.offerLabels[id]; }
    var s = C[ns]; if (!s) return;
    var n = parseFloat(v);
    s.offers = s.offers || {};
    if (isFinite(n) && n > 0) s.offers[id] = n; else delete s.offers[id];
    touched(ns);
  }
  /** What the seller declared, and whether an offer sits inside it. Advisory here; the server is the authority. */
  function offerState(ns, id) {
    var s = C[ns] || {}, r = rowById(ns, id), o = declOf(ns, r);
    var v = (s.offers || {})[id];
    if (v == null) return { value: null, ok: null, band: o };
    var low = o.price_min != null && v < Number(o.price_min);
    var high = o.price_max != null && v > Number(o.price_max);
    return { value: v, ok: !low && !high, low: low, high: high, band: o };
  }
  /** A heading's control adds ONE of each — never a quantity nobody asked for. Membership is `gid`, never
   *  "walk until the next heading": ungrouped products are appended after the groups and would be swallowed. */
  function group(ns, idx) {
    var s = C[ns]; if (!s) return;
    var rs = rows(ns), head = rs[idx], ids = [];
    if (!head || head.type !== 'product') return;
    for (var i = idx + 1; i < rs.length; i++) {
      if (rs[i].type !== 'line' || rs[i].gid !== head.gid) break;
      ids.push(rs[i].item_id);
    }
    var allIn = ids.length && ids.every(function (id) { return s.sel[id]; });
    ids.forEach(function (id) { if (allIn) delete s.sel[id]; else if (!s.sel[id]) s.sel[id] = 1; });
    touched(ns);
  }
  /**
   * addAdhoc — a line that is NOT in the catalogue.
   *
   * Compose needs this and the other three callers do not: you can author a chit for something you have never
   * listed. It lands in the SAME cart rather than in a second list the screen keeps beside it, because two lists
   * would mean two counts, two totals and two things to remember at checkout — and the count on the bar would
   * quietly be wrong.
   *
   * ⚠️ It is appended to the catalogue IN PLACE rather than re-initialising, because init() clears the cart when the
   * catalogue signature changes — adding a line would have emptied the basket it was being added to. The signature
   * is refreshed afterwards so a later repaint does not mistake the grown catalogue for a different one.
   */
  function addAdhoc(ns, data, qty) {
    var s = C[ns]; if (!s || !data || !data.name) return null;
    s.adhoc = (s.adhoc || 0) + 1;
    var id = 'adhoc-' + s.adhoc;
    s.cat = s.cat || {};
    s.cat.items = (s.cat.items || []).concat([{ item_id: id, item_data: data, adhoc: true }]);
    s.sig = sigOf(s.cat);
    put(ns, id, qty == null ? 1 : qty);
    return id;
  }
  function clear(ns) { var s = C[ns]; if (!s) return; s.sel = {}; close(ns); paint(ns); }
  /** Toggle the "on offer" narrowing. The TEST comes from the renderer — see rows(). */
  function onlyOffers(ns, on) {
    var s = C[ns]; if (!s) return;
    s.onlyOffers = (on === undefined) ? !s.onlyOffers : !!on;
    paint(ns);
  }

  function search(ns, v) { var s = C[ns]; if (!s) return; s.q = v || ''; paintList(ns); }
  function open(ns) { if (!lines(ns)) return; C[ns].open = true; paintPopup(ns); }
  function close(ns) {
    var s = C[ns]; if (!s) return;
    s.open = false;
    var el = doc(opt(ns, 'popupEl'));
    if (el) el.className = opt(ns, 'popupClass', 'cbcart-ov');
  }

  /* ── rendering ───────────────────────────────────────────────────────────────────────────────────────────── */
  function doc(id) { return (typeof document !== 'undefined' && id) ? document.getElementById(id) : null; }
  /* ⚠️ Same defect as catalogue-ui: the fallback assumed India. See the note there. */
  function sym(ns) { return opt(ns, 'symbol', CBLocale.symbol((typeof SESSION !== 'undefined' && SESSION && SESSION.currency) || 'INR')); }
  /**
   * ⚠️ DIGIT GROUPING IS OFF BY DEFAULT, and that is deliberate.
   *
   * The screens this helper replaced printed the raw number — ₹3400. Grouping it (₹3,400) is arguably better and
   * is certainly correct for INR, but it is a CHANGE TO A PUBLIC PAGE that nobody asked for, arriving as a side
   * effect of a cart refactor. A refactor that quietly restyles money is not a refactor.
   *
   * It broke e2e/tests/variants.spec.js, which asserts the price as written — and the test was right to fail.
   * So the default reproduces the old output exactly, and grouping is a flag a screen can choose on purpose.
   */
  /**
   * ⭐ ONE MONEY FORMAT. Athi, 2026-09-04: "fix the shop money format to match the app" — the shop printed ₹1000 where
   * the app prints ₹1,000.00. Every cart now prints through CBLocale.money (the app's fmtMoney), with the currency the
   * page declares (`currency`), else the session's, else INR. The old `symbol`/`groupDigits` path stays only for a
   * page that loads no locale.js.
   */
  function currencyOf(ns) { return opt(ns, 'currency', (typeof SESSION !== 'undefined' && SESSION && SESSION.currency) || 'INR'); }
  function fmt(ns, n) {
    if (typeof CBLocale !== 'undefined' && CBLocale && typeof CBLocale.money === 'function') {
      try { return CBLocale.money(Number(n || 0), currencyOf(ns)); } catch (_) {}
    }
    return sym(ns) + (opt(ns, 'groupDigits', false)
      ? Number(n).toLocaleString(opt(ns, 'locale', CBLocale.locale()))
      : String(n));
  }
  function accent(ns) { return opt(ns, 'accent', 'var(--blue)'); }
  function soft(ns) { return opt(ns, 'soft', 'var(--blue-tint-bg)'); }

  /**
   * The cart control. THE WHOLE THING OPENS THE CART — bag, badge and total alike; a 12px link is not a tap target.
   *
   * Athi, 2026-08-15: *"wasting so much of space in top … cart can be an icon on the top"*.
   *
   * ⭐ IT IS A CHIP, NOT A BAR, AND THAT BUYS A WHOLE ROW. It used to be a full-width box on its own line above the
   * search box — two stacked rows of chrome before the first product, on a screen whose entire job is choosing
   * products. As a chip it sits INSIDE the search row, so the header costs one row instead of two: on the 854px
   * laptop that moved the first product up ~100px, and on a phone it is the difference between seeing two products
   * and seeing none.
   *
   * ⚠️ `cbcart-bar` AND `cart-count-<ns>` ARE PUBLISHED HOOKS — e2e/tests/render-smoke.spec.js clicks the class and
   * order-steps.spec.js asserts the badge. The look changed; the names deliberately did not. Renaming them here is
   * how a spec goes quietly green against nothing.
   *
   * ⚠️ NO position:sticky HERE ANY MORE, AND THAT WAS THE ORIGINAL BUG. This element carried `position:sticky;top:0`
   * from the start — and never once stuck, because each screen wrapped it in a div of exactly its own height, so it
   * had zero range to travel in. Sticky belongs on `.cbpick-stick`, the wrapper that spans chip AND search and is
   * as tall as the list. A sticky rule on a box that cannot move is indistinguishable from no rule at all.
   */
  function barHTML(ns) {
    var n = lines(ns), u = units(ns), T = total(ns), on = n > 0, a = accent(ns);
    /**
     * ⭐ `barHideEmpty` — NOTHING AT ALL WHEN THE CART IS EMPTY. Set by hosts that park the chip in a header
     * (compose does, beside the ✕) rather than in the picker row. In the row an empty cart is a useful target
     * with a hint on it; in a title bar it is a permanent grey blob that never does anything, sitting in the one
     * place the eye checks first. So the chip APPEARS when there is something in it, and is absent until then.
     *
     * ⚠️ paintBar still runs on every change (touched → paint → paintBar), so the slot fills and empties on its
     * own. The element must exist in the DOM even while this returns '' — it is the container that persists.
     */
    if (!on && opt(ns, 'barHideEmpty')) return '';
    var sum = on ? (n + ' line' + (n === 1 ? '' : 's')
                   + (T.amount ? ' · ' + fmt(ns, T.amount) + (T.partial ? '+' : '') : '')) : '';
    return '<div class="cbcart-bar' + (on ? ' on' : '') + '" data-testid="cart-' + esc(ns) + '"'
      + (on ? ' onclick="CBCart.open(\'' + esc(ns) + '\')" title="Open the cart to review and add these lines"'
            : ' title="' + esc(opt(ns, 'emptyHint', 'Press + on what you need')) + '"')
      + ' style="border-color:' + (on ? a : 'var(--line)') + ';background:' + (on ? a : 'var(--neutral-tint)') + '">'
      + '<span class="cbcart-bag">🛒'
      + (on ? '<span data-testid="cart-count-' + esc(ns) + '" class="cbcart-n" style="color:' + a + '">' + u + '</span>' : '')
      + '</span>'
      /* ⚠️ The summary HIDES on a narrow screen (see .cbcart-sum), never the badge. The count is the fact you cannot
         lose; the money is the detail, and it is one tap away in the cart itself. */
      + (on ? '<span class="cbcart-sum">' + esc(sum) + '</span>' : '')
      + (on ? '<span class="cbcart-x" onclick="event.stopPropagation();CBCart.clear(\'' + esc(ns) + '\')"'
            + ' title="Clear the cart">✕</span>' : '')
      + '</div>'
      + (on && T.partial ? '<div class="cbcart-partial">Some lines have no price — the total covers only the priced ones.</div>' : '');
  }

  /**
   * The control for a row — decided by the row's MODEL, not by the screen.
   *
   * A `pick` line gets no stepper at all, because there is no quantity to step; showing "− 1 +" on a one-off
   * inspection would invite an order for two of something that cannot be had twice. Every other model shares the
   * stepper shape and differs only in what a press means, which is exactly the difference the registry holds.
   */
  function stepperHTML(ns, id, q) {
    var a = accent(ns), r = rowById(ns, id), o = declOf(ns, r), o_model = (o && o.model) || 'count';
    var rnd = 'border-radius:50%;width:28px;height:28px;flex:none;border:1.5px solid ' + a + ';background:var(--card);color:' + a
      + ';font-size:17px;font-weight:700;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center';

    if (o_model === 'pick') {
      return '<button data-testid="cart-add" onclick="event.stopPropagation();CBCart.setQty(\'' + esc(ns) + '\',\'' + esc(id) + '\',' + (q ? 0 : 1) + ')"'
        + ' style="border-radius:20px;padding:6px 14px;font-size:var(--fs-2);font-weight:700;cursor:pointer;border:1.5px solid ' + a
        + ';background:' + (q ? a : 'var(--card)') + ';color:' + (q ? 'var(--on-accent)' : a) + '">' + (q ? '✓ Added' : 'Add') + '</button>';
    }
    if (!q) {
      return '<button data-testid="cart-add" style="' + rnd + '" onclick="event.stopPropagation();CBCart.add(\'' + esc(ns) + '\',\'' + esc(id) + '\')">+</button>';
    }
    var off = '';
    if (o_model === 'offer') {
      // The offer rides beside the quantity, and says immediately whether it sits inside the seller's band.
      var os = offerState(ns, id);
      off = '<input placeholder="your price" value="' + esc(os.value == null ? '' : String(os.value)) + '" inputmode="decimal"'
        + ' onchange="CBCart.setOffer(\'' + esc(ns) + '\',\'' + esc(id) + '\',this.value)"'
        + ' style="width:78px;padding:5px;border:1.5px solid ' + (os.value != null && !os.ok ? 'var(--disp)' : 'var(--line)')
        + ';border-radius:6px;font-size:var(--fs-2);text-align:end">';
    }
    return '<span style="display:inline-flex;align-items:center;gap:8px" onclick="event.stopPropagation()">' + off
      + '<button style="' + rnd + '" onclick="CBCart.dec(\'' + esc(ns) + '\',\'' + esc(id) + '\')">−</button>'
      + '<input value="' + esc(String(q)) + '" inputmode="decimal" onchange="CBCart.setQty(\'' + esc(ns) + '\',\'' + esc(id) + '\',this.value)"'
      + ' style="width:52px;padding:5px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2);text-align:center">'
      + '<button data-testid="cart-add" style="' + rnd + ';background:' + a + ';color:#fff" onclick="CBCart.add(\'' + esc(ns) + '\',\'' + esc(id) + '\')">+</button></span>';
  }
  /**
   * availHTML — what the holder reports, in ONE short fragment on the row.
   *
   * Athi, 2026-08-09: *"just mention avl qty - 14 dt:, no extra two lines. Keep hide attribute and make it true in
   * other places if it is not demanded."*
   *
   * It was a whole second panel under the list repeating every item. Gone — it belongs on the row it describes,
   * in as few characters as carry the meaning: `avl 14 · dt 07 Aug`.
   *
   * ⚠️ HIDDEN BY DEFAULT. `hideAvail` starts true, so a supplier list, a storefront and compose show nothing at
   * all; only a screen that asks for it (the Network, where stock is the point) sets it false. A default that
   * showed stock everywhere would put "not reported" on every row of every catalogue that never claimed to report.
   *
   * ⚠️ THE THREE STATES STAY DISTINCT even at this length. Absent is not zero, and a quantity with no date is a
   * rumour — compressing the words must not compress the meaning:
   *     reported      avl 14 · dt 07 Aug
   *     reported zero avl 0  · dt 08 Aug
   *     never said    avl —              (never "avl 0")
   *     no date       avl 14 · dt ?      (the missing date is shown as missing, not quietly dropped)
   */
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function shortDate(s) {
    var d = new Date(s);
    if (isNaN(d)) return String(s);
    return ('0' + d.getDate()).slice(-2) + ' ' + MON[d.getMonth()];
  }
  function availHTML(ns, r) {
    if (opt(ns, 'hideAvail', true)) return '';
    var a = dataOf(r).avail;
    if (!a || a.qty === undefined || a.qty === null) {
      return ' <span style="color:var(--grey-3);font-size:var(--fs-1)">· avl —</span>';
    }
    var col = Number(a.qty) > 0 ? 'var(--ok-2)' : 'var(--disp-2)';
    if (!a.as_of) return ' <span style="font-size:var(--fs-1);color:' + col + '">· avl ' + esc(a.qty)
      + '</span><span style="font-size:var(--fs-1);color:var(--warn-2)"> dt ?</span>';
    // Older than the staleness window gets an amber date and a marker — a word would cost a line it does not have.
    var days = (new Date() - new Date(a.as_of)) / 864e5;
    var stale = days > Number(opt(ns, 'staleDays', 14));
    return ' <span style="font-size:var(--fs-1);color:' + col + '">· avl ' + esc(a.qty) + '</span>'
      + '<span style="font-size:var(--fs-1);color:' + (stale ? 'var(--warn-2)' : 'var(--blue-2)') + '"> dt ' + esc(shortDate(a.as_of))
      + (stale ? ' ⚠' : '') + '</span>';
  }
  /** The model's own note under the row — "sold in 12s", "min 5 · max 500". Silent when there is nothing to say. */
  function hintHTML(ns, r) {
    var o = declOf(ns, r), m = modelOf(ns, r);
    /* ⚠️ SAY IT, do not fall silent. An unresolved model is the one case where this note has something urgent
       to add — the row cannot be ordered and the reader deserves to know why rather than finding the controls
       inert. `loading` is transient and says so; `missing` means the definition is gone. */
    if (!m) return ' <span style="color:var(--disp);font-size:var(--fs-1)">· ' + (o.unresolved === 'loading'
      ? 'reading its order model…' : 'order model unavailable — cannot be ordered') + '</span>';
    var h = m.hint(o);
    if (!h) return '';
    return ' <span style="color:#8a949c;font-size:var(--fs-1)">· ' + esc(h) + '</span>';
  }

  /* rowExtra — HTML the owning page adds UNDER a line (the storefront puts the product's pictures and video there).
     Optional, never throws: a gallery that fails must not take the price with it. */
  function rowExtra(ns, r) {
    var f = opt(ns, 'rowExtra', null); if (typeof f !== 'function') return '';
    try { return f(r.item, r) || ''; } catch (_) { return ''; }
  }
  function listHTML(ns) {
    var s = C[ns]; if (!s) return '';
    var rs = rows(ns), a = accent(ns);
    if (!rs.length) {
      /* ⚠️ SAY WHICH FILTER EMPTIED IT. "Nothing matches that" beside an active category chip sends someone to
         retype a search term that was never the problem. */
      var why = (s.q && s.catg) ? 'Nothing in ' + esc(catgName(ns, s.catg)) + ' matches that.'
              : s.catg ? 'Nothing in ' + esc(catgName(ns, s.catg)) + ' yet.'
              : s.q ? 'Nothing matches that.'
              : esc(opt(ns, 'noCatalogue', 'Nothing published yet.'));
      return '<div style="padding:34px 8px;color:var(--grey-2);font-size:var(--fs-3);text-align:center">' + why
        + (s.catg ? '<div style="margin-top:8px"><button type="button" class="cbpick-chip"'
            + ' onclick="CBCart.category(\'' + esc(ns) + '\',\'\')">' + tx('Show everything') + '</button></div>' : '')
        + '</div>';
    }
    return rs.map(function (r, i) {
      if (r.type === 'product') {
        var ids = [];
        for (var k = i + 1; k < rs.length && rs[k].type === 'line' && rs[k].gid === r.gid; k++) ids.push(rs[k].item_id);
        var inCart = ids.filter(function (id) { return s.sel[id]; }).length;
        return '<div style="padding:10px 2px 3px;display:flex;align-items:center;gap:8px">'
          + '<b style="font-size:var(--fs-3)">' + esc(r.label) + '</b>'
          + '<span style="font-size:var(--fs-1);color:var(--grey-2)">' + r.count + ' options</span>'
          + (inCart ? '<span style="font-size:var(--fs-1);color:' + a + ';font-weight:700">' + inCart + ' in cart</span>' : '')
          + '<span onclick="CBCart.group(\'' + esc(ns) + '\',' + i + ')" style="cursor:pointer;font-size:var(--fs-1);color:' + a + '">'
          + (inCart === ids.length && ids.length ? 'clear all' : 'add all') + '</span>'
          + (r.options ? '<span style="font-size:var(--fs-1);color:var(--grey-2);margin-inline-start:auto">' + esc(r.options) + '</span>' : '')
          + '</div>';
      }
      var d = dataOf(r), q = qtyOf(ns, r.item_id), u = unitPrice(ns, r), p = u.amount;
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 2px 8px ' + (r.variant ? '20px' : '2px')
        + ';border-bottom:1px dashed var(--line);' + (q ? 'background:' + soft(ns) : '') + '">'
        + '<span style="flex:1"><b style="font-size:var(--fs-3)">' + esc(r.variant || d.name || d.product || 'item') + '</b>'
        + (d.unit ? ' <span style="color:var(--grey-2);font-size:var(--fs-1)">' + esc(d.unit) + '</span>' : '')
        + '<div style="font-size:var(--fs-2);color:var(--grey-2);margin-top:1px">'
        // An offer REPLACES the asking price in the maths, so it must replace it on screen too — with the asking
        // price still shown, struck through, because hiding what they asked for is its own dishonesty.
        + (u.offered
            ? '<span style="text-decoration:line-through;opacity:.55">' + esc(fmt(ns, u.asking)) + '</span> '
              + '<b style="color:' + accent(ns) + ';font-size:var(--fs-3)">' + esc(fmt(ns, p)) + '</b> '
              + '<span data-testid="cart-offer-pill" style="display:inline-block;font-size:var(--fs-1);font-weight:700;color:#fff;background:' + accent(ns) + ';border-radius:9px;padding:1px 7px;margin-inline-start:2px">'
              + esc(((s.offerLabels || {})[r.item_id]) || 'your offer') + (isFinite(u.asking) && u.asking > p ? ' · save ' + esc(fmt(ns, u.asking - p)) : '') + '</span>'
            : (isFinite(p) ? esc(fmt(ns, p)) : 'no price'))
        // The line's own total, only once there is a quantity to multiply by — a price × 1 restated is noise.
        + (q && isFinite(p) ? ' <span style="color:var(--ink-2);font-weight:800">· ' + esc(fmt(ns, p * q)) + '</span>' : '')
        + hintHTML(ns, r) + availHTML(ns, r)
        + '</div></span>' + stepperHTML(ns, r.item_id, q) + '</div>' + rowExtra(ns, r);
    }).join('');
  }

  /**
   * The popup. Athi: *"assume you have 1000s of products… when they click the cart, it should open in popup to show
   * the products selected."*
   *
   * Filtering the list down to the cart in place is fine for eight products and wrong for eight thousand: it throws
   * away the scroll position and the search someone worked to reach. This opens OVER the list and leaves it intact.
   *
   * ⚠️ Quantities are editable HERE, not merely listed — the reason to open a cart on a big catalogue is usually to
   * fix a 10 that should have been a 1, and a read-only list would send you back to hunt for that row.
   */
  function popupHTML(ns) {
    var s = C[ns]; if (!s) return '';
    var sel = selected(ns), T = total(ns), a = accent(ns);
    var btn = 'flex:1;height:40px;border-radius:9px;font-size:var(--fs-3);font-weight:700;cursor:pointer;border:1.5px solid ' + a;
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
      + '<b style="font-size:var(--fs-4);flex:1">🛒 ' + esc(opt(ns, 'cartTitle', 'Your cart')) + '</b>'
      + '<button onclick="CBCart.close(\'' + esc(ns) + '\')" style="border:0;background:none;font-size:var(--fs-5);color:#8a949c;cursor:pointer">×</button></div>'
      + '<div style="font-size:var(--fs-2);color:var(--grey-2);margin-bottom:10px">'
      + (opt(ns, 'from') ? 'from <b>' + esc(opt(ns, 'from')) + '</b> · ' : '')
      + sel.length + ' line' + (sel.length === 1 ? '' : 's') + ' · ' + units(ns) + ' units</div>'
      + (sel.length
        ? sel.map(function (l) {
            var p = l.unit_price;
            return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed var(--line)">'
              + '<span style="flex:1"><b style="font-size:var(--fs-3)">' + esc(l.name) + '</b>'
              + ' <span style="color:var(--grey-2);font-size:var(--fs-1)">' + esc(l.unit) + '</span>'
              + '<div style="font-size:var(--fs-2);color:var(--grey-2)">'
              + (l.offered ? '<span style="text-decoration:line-through;opacity:.55">' + esc(fmt(ns, l.asking_price)) + '</span> ' : '')
              + (isFinite(p) ? esc(fmt(ns, p)) : 'no price') + (l.offered ? ' <span style="font-size:var(--fs-1)">your offer</span>' : '')
              + (isFinite(p) ? ' <span style="color:var(--ink-2);font-weight:800">· ' + esc(fmt(ns, p * l.qty)) + '</span>' : '') + '</div></span>'
              + stepperHTML(ns, l.item_id, l.qty)
              + '<span onclick="CBCart.setQty(\'' + esc(ns) + '\',\'' + esc(l.item_id) + '\',0)" title="remove"'
              + ' style="cursor:pointer;color:var(--grey-4);font-weight:800;padding:0 3px">×</span></div>';
          }).join('')
          /* ⭐ the same money rows the storefront shows — offers → After offers → GST per rate → Total incl. tax — whenever the
             catalogue carries offers or a line carries a tax rate; the bare Total stays for a catalogue with neither */
          + (function () {
              try {
                var st = C[ns], EL = engineLines(ns);
                var hasOffers = !!(st && st.cat && Array.isArray(st.cat.offers) && st.cat.offers.length), hasTax = EL.some(function (l) { return l.tax && l.tax.rate != null; });
                if (!T.offered && !T.partial && (hasOffers || hasTax)) {
                  var M = money(EL, { offers: (st.cat.offers || []), ctx: { now: new Date(), currency: (st.cat.shop && st.cat.shop.currency_code) || 'INR', money: function (n) { return fmt(ns, n); } }, taxOf: function (id, l) { return (l && l.tax) || null; } });
                  return '<div data-testid="cart-money" style="padding:11px 2px;border-top:2px solid var(--line);font-size:var(--fs-2)">' + moneyRowsHTML(M, { taxTestid: 'cart-tax', totalTestid: 'cart-total' }) + '</div>';
                }
              } catch (e) { /* fall through to the bare total */ }
              return '<div style="display:flex;padding:11px 2px;border-top:2px solid var(--line);font-size:var(--fs-3);font-weight:800">'
                + '<span style="flex:1">' + (T.offered ? 'Total at your offer' : 'Total') + '</span>'
                + '<span>' + (T.amount ? esc(fmt(ns, T.amount)) + (T.partial ? '+' : '') : '—') + '</span></div>';
            })()
          + (T.partial ? '<div style="color:var(--warn-2);font-size:var(--fs-1)">Some lines have no price — the total covers only the priced ones.</div>' : '')
        // Emptying the cart from inside it must not leave someone facing a blank box with no way back.
        : '<div style="padding:26px 8px;color:var(--grey-2);font-size:var(--fs-3);text-align:center">Nothing in the cart yet.</div>')
      + '<div style="display:flex;gap:9px;margin-top:15px">'
      + '<button style="' + btn + ';background:var(--card);color:' + a + '" onclick="CBCart.close(\'' + esc(ns) + '\')">'
      + (sel.length ? 'Keep shopping' : 'Browse the catalogue') + '</button>'
      + (sel.length ? '<button data-testid="cart-checkout" style="' + btn + ';background:' + a + ';color:var(--on-card)"'
          + ' onclick="CBCart.checkout(\'' + esc(ns) + '\')">' + esc(opt(ns, 'checkoutLabel', 'Check out <span class=arw>→</span>')) + '</button>' : '')
      + '</div>';
  }

  function checkout(ns) {
    close(ns);
    var fn = opt(ns, 'onCheckout');
    if (typeof fn === 'function') fn(selected(ns), total(ns));
  }

  /**
   * pickerHTML(ns, o) — THE WHOLE PICKER: cart bar, search box, list, in that order.
   *
   * Athi, 2026-08-15: *"search and cart should be stable"* … *"it is a single js i guess, you have to reuse it"*.
   *
   * ⚠️ WHY THIS IS A FUNCTION AND NOT THREE LINES AT EACH CALL SITE. Compose (app.html:2058), Suppliers
   * (app.html:3093) and Network (cap-network.js:1335) each hand-assembled `bar + <input> + list` — the same three
   * pieces, three times, with three different search wrappers around one call. So the bar could only ever be fixed
   * in one screen at a time, and the two that were not being looked at kept the defect. That is the exact shape of
   * the standing rule: a second call site means a helper, now.
   *
   * ⭐ THE BAR AND THE SEARCH BOX STICK; ONLY THE LIST SCROLLS. A catalogue of 56 products is 3,000px tall, so
   * picking means scrolling — and the cart bar, sitting in flow at the top, went to -913px on the first flick.
   * While choosing you could no longer see what you had chosen, what it came to, or reach Clear or View cart, and
   * the search box that would have saved the scrolling had gone with it. The running total is not a decoration
   * here; it is the number a person is deciding against.
   *
   * ⚠️ SEARCH REPAINTS THE LIST ONLY — never the picker. Repainting the picker would replace the input being typed
   * into and take the caret with it. That is why this calls CBCart.search (which is paintList) rather than the
   * screen's own onChange, and it is why the three per-screen wrappers this replaces all existed.
   */
  function pickerHTML(ns, o) {
    o = o || {};
    var barId = opt(ns, 'barEl'), listId = opt(ns, 'listEl');
    /* `cart:false` — the host renders the chip somewhere of its own (compose puts it in the modal header, level
       with the ✕) and owns an element with the barEl id there. The row is then search alone, full width. */
    return '<div class="cbpick-stick">'
      +   '<div class="cbpick-row">'
      +     (o.cart === false ? ''
            : '<div id="' + esc(barId) + '" class="cbpick-cartslot">' + barHTML(ns) + '</div>')
      +     '<input class="inp cbpick-q" placeholder="' + esc(o.placeholder || 'Search this catalogue…') + '"'
      +     ' value="' + esc((C[ns] || {}).q || '') + '"'
      +     (o.searchTestid ? ' data-testid="' + esc(o.searchTestid) + '"' : '')
      +     ' oninput="CBCart.search(\'' + esc(ns) + '\', this.value)">'
      +   '</div>'
      /* ⭐ Athi, 2026-08-16: *"it should be below the search, scrolling"*. Inside the sticky block, so the way you
         narrow the list stays reachable however far down the list you are. It renders NOTHING until there are at
         least two categories, so every screen that has none looks exactly as it did before. */
      +   '<div id="' + esc(listId) + '_catg" class="cbpick-catgs">' + catgsHTML(ns) + '</div>'
      + '</div>'
      + '<div id="' + esc(listId) + '"' + (o.listTestid ? ' data-testid="' + esc(o.listTestid) + '"' : '') + '>'
      +   listHTML(ns)
      + '</div>';
  }

  /* ── painting. Each piece repaints on its own, deliberately. ─────────────────────────────────────────────── */
  /**
   * ⭐⭐ THE RENDERER HOOK — how a screen adopts the redesigned row WITHOUT a second repaint path.
   *
   * A screen may pass `renderer: CBCatalogue` to create(). When it does, THESE functions produce the new markup
   * into the SAME elements (`listEl` / `barEl`), so there is still exactly one place that repaints a list and one
   * place that repaints a bar.
   *
   * ⚠️ THE ALTERNATIVE WAS A SILENT BUG, AND THE cap-network HARNESS CAUGHT IT WITHIN A MINUTE. My first wiring
   * had catalogue-ui render its own element ids. Everything looked right — until you typed in the search box:
   * `search()` calls `paintList()`, which writes into `opt(ns,'listEl')`, which no longer existed. No error, no
   * missing element on screen, just a search field that quietly stopped filtering. A repaint that targets an id
   * nobody renders is invisible in every way except the one that matters.
   *
   * ⚠️ THE IDS ARE THE CONTRACT. `cbpick_net`, `cbcartbar_net`, `cbpick_sup`, `cbpick_cc` are what paintList and
   * paintBar address AND what the harness asserts. A renderer may change the markup inside them; it may not
   * change where they are.
   */
  function handleOf(ns) { var s = C[ns]; return (s && s.handle) || null; }
  function rendererOf(ns) {
    var r = opt(ns, 'renderer');
    return (r && typeof r.listInto === 'function' && handleOf(ns)) ? r : null;
  }
  function paintList(ns) {
    var el = doc(opt(ns, 'listEl')); if (!el) return;
    var r = rendererOf(ns);
    if (r) r.listInto(el, handleOf(ns)); else el.innerHTML = listHTML(ns);
  }
  function paintBar(ns) {
    var el = doc(opt(ns, 'barEl')); if (!el) return;
    var r = rendererOf(ns);
    if (r) r.barInto(el, handleOf(ns)); else el.innerHTML = barHTML(ns);
  }
  function paint(ns) {
    paintBar(ns); paintList(ns);
    // A screen may show the cart somewhere else too — a footer button count, a disabled Next. It registers a
    // refresh and is called here, so nothing on screen can disagree with the cart about what is in it.
    var s = C[ns];
    if (s && s.opts && typeof s.opts.onChange === 'function') { try { s.opts.onChange(); } catch (e) {} }
  }
  /**
   * ⚠️ THE POPUP REPAINTS ITSELF AND THE BAR — NEVER THE LIST. The list underneath holds a scroll position someone
   * reached by scrolling thousands of rows; re-rendering it would drop them at the top on closing, which is the
   * exact cost the popup exists to avoid.
   */
  function paintPopup(ns) {
    var el = doc(opt(ns, 'popupEl'));
    var body = doc(opt(ns, 'popupBodyEl'));
    if (body) body.innerHTML = popupHTML(ns);
    if (el) el.className = opt(ns, 'popupClass', 'cbcart-ov') + ' on';
    paintBar(ns);
  }

  /**
   * ensureHost — the ONE overlay the popup is painted into.
   *
   * ⚠️ THIS BELONGS TO THE CART, NOT TO THE COMPAT ADAPTER, and for two days it did not — it sat under cbPickInit,
   * so a screen that used the NEW front door got a cart it could add to and could not open. That is exactly what
   * shipped: on 2026-08-09 the storefront moved to create() and its "View cart ›" went dead, along with the only
   * route to check out. Six + buttons and no order path, on the public page, with nothing thrown for a smoke test
   * to catch — `open()` looked up a popupEl the caller had never been told to supply, got null, and returned
   * quietly. Silence is the failure mode a missing default always has.
   *
   * Two front doors are only one implementation if they hand back the same cart. A default the old door filled in
   * and the new door did not is a second implementation wearing the first one's name.
   */
  function ensureHost() {
    ensureChipCss();
    if (typeof document === 'undefined' || document.getElementById('cbcart_ov')) return;
    var d = document.createElement('div');
    d.id = 'cbcart_ov'; d.className = 'cbcart-ov';
    d.onclick = function (e) { if (e.target === d) { for (var k in C) if (C[k] && C[k].open) close(k); } };
    d.innerHTML = '<div class="cbcart-ovc" id="cbcart_ovc"></div>';
    // ⚠️ `|| documentElement`. create() now runs this, and create() is called from inside a catalogue load whose
    // .catch() reports any exception as "could not read their catalogue" — so a bare document.body.appendChild
    // would turn a missing <body> into a message blaming the supplier's catalogue. There is always somewhere to
    // put it; failing loudly in the wrong words is worse than either failing or working.
    (document.body || document.documentElement).appendChild(d);
  }

  /**
   * ensureChipCss — the stylesheet, on its OWN front door.
   *
   * ⚠️ THIS LIVED INSIDE ensureHost, AND THAT IS A BUG OF EXACTLY THE KIND ensureHost's OWN COMMENT DESCRIBES.
   * The chip/search/category CSS was injected as a SIDE EFFECT of building the cart popup overlay. Every screen
   * that opens a cart got it. The catalogue MANAGEMENT screen renders the same `.cbpick-chip` markup and never
   * opens a cart — so it never got the stylesheet, and the category filter fell all the way back to the browser's
   * default <button>: square corners and near-black label text.
   *
   * ⚠️ IT WAS INVISIBLE IN EVERY LIGHT THEME. UA-default black on a pale page reads fine, so for months the only
   * symptom was "the chips look a bit square". On a dark ground the same black text sits on a dark page and the
   * category names disappear — which is what Athi photographed: All / Flour 3 / Grains 3 / Uncategorised 55, all
   * unreadable, while the SELECTED chip stayed visible because its colours are inline on the element.
   *
   * Two consumers of one stylesheet means the stylesheet needs its own entry point, not a lucky call order.
   */
  function ensureChipCss() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('cbcart_css')) {
      // `styleEl`, not `st` — `st` is this module's state getter, and shadowing it here is a trap for the next edit.
      var styleEl = document.createElement('style');
      styleEl.id = 'cbcart_css';
      styleEl.textContent = '.cbcart-ov{position:fixed;inset:0;background:rgba(15,22,32,.5);display:none;'
        + 'align-items:center;justify-content:center;padding:14px;z-index:1200}.cbcart-ov.on{display:flex}'
        + '.cbcart-ovc{background:var(--card);width:100%;max-width:470px;border-radius:15px;padding:17px 18px 20px;'
        + 'max-height:86vh;overflow:auto}'
        /**
         * ⭐ THE PICKER HEADER STICKS — see pickerHTML. `top:0` pins it to whichever ancestor scrolls, which is
         * the modal body in Compose and the page in Suppliers/Network, so one rule covers all three.
         *
         * ⚠️ THE BACKGROUND MUST BE OPAQUE. A sticky element with a transparent background lets the list scroll
         * THROUGH it — the rows and the cart total draw on top of each other and both become unreadable. #fff is
         * what all three hosts sit on today; if a dark surface ever hosts a picker this is the line to change.
         *
         * ⚠️ z-index above the rows but well below .cbcart-ov (1200), so the cart popup still covers the header
         * that opened it.
         */
        /**
         * ⚠️ `top:-11px`, NOT `top:0`, AND THE NUMBER IS NOT ARBITRARY. A sticky offset is measured from the scroll
         * container's PADDING edge, and every host here pads its scroller (.mbody is `11px 12px`). At top:0 the
         * header parked 11px below the top of the scrollport and the list scrolled through the gap above it — the
         * product rows drew over the cart. Pulling it up by that padding parks it flush; the matching padding-top
         * keeps the gap when it is at rest. `--cbpick-gap` is here so a host with different padding can set it
         * rather than discover this the way it was discovered here.
         */
        + ':root{--cbpick-gap:11px}'
        + '.cbpick-stick{position:sticky;top:calc(-1 * var(--cbpick-gap));z-index:6;background:var(--card);'
        + 'padding:var(--cbpick-gap) 0 0}'
        /* ONE row: the cart chip takes what it needs, the search box takes the rest. */
        + '.cbpick-row{display:flex;align-items:center;gap:8px;margin:0 0 7px}'
        + '.cbpick-row .cbpick-q{flex:1 1 auto;min-width:0;margin:0}'
        + '.cbpick-cartslot{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-start;gap:3px}'
        /* ⭐ THE CATEGORY STRIP — one scrolling row under the search, inside the sticky block.
           ⚠️ `flex-wrap:nowrap` + `overflow-x:auto` ON PURPOSE. Wrapping is the obvious choice and it is wrong
           here: a shop with 14 categories would push the product list two rows further down on every screen, and
           this row is sticky — it would eat the list permanently. Scrolling costs one gesture and costs nothing
           when there are three chips. `:empty` collapses the whole thing so a catalogue without categories has
           not so much as a margin. */
        + '.cbpick-catgs{display:flex;flex-wrap:nowrap;gap:6px;overflow-x:auto;overflow-y:hidden;'
        + 'margin:0 0 8px;padding-bottom:2px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}'
        + '.cbpick-catgs:empty{display:none}'
        + '.cbpick-catgs::-webkit-scrollbar{height:5px}'
        + '.cbpick-catgs::-webkit-scrollbar-thumb{background:var(--blue-tint-bg);border-radius:3px}'
        /**
         * ⭐ THE TAG SHAPE (Athi, 2026-08-17: *"the category has to be something like new product shape, square
         * doesn't look good"*). A category is a LABEL you hang on a product, so it reads as a luggage tag —
         * square on the left where it attaches, rounded on the right where it hangs free.
         * ⚠️ The asymmetry is the point: a pill says "toggle", a rectangle says "cell", and neither says
         * "this is a label attached to something". The shape now matches what the thing IS.
         */
        + '.cbpick-chip{flex:0 0 auto;border:1px solid var(--line);background:var(--card);'
        + 'border-radius:4px 14px 14px 4px;'
        /* 28px and 12px: smaller than the cart chip beside the search (this narrows a list, it does not hold
           money), still above the legibility floor. */
        /* ⚠️ THE SURFACE AND ITS TEXT MOVE TOGETHER. This set `background:var(--card)` with a hardcoded
           `color:var(--ink-2)`, so in a dark theme the chip went dark and the letters stayed dark — 1.63:1,
           invisible. `--on-card` is the partner of `--card`; using anything else here is the bug. */
        + 'height:28px;padding:0 12px;font:inherit;font-size:var(--fs-2);color:var(--on-card);cursor:pointer;white-space:nowrap}'
        + '.cbpick-chip:hover{border-color:var(--accent)}'
        /* ⭐ SELECTED IS A SURFACE CHANGE, NOT JUST BOLDER TEXT (Athi: the letters were unreadable when picked).
           Weight alone is a weak signal and it was carrying the whole job; now the chip takes the accent and its
           partner text colour, so "which category am I filtered to" is answerable at a glance. */
        + '.cbpick-chip.on{font-weight:700;background:var(--accent);border-color:var(--accent);color:var(--on-accent)}'
        + '.cbpick-chip.on .cbpick-chipn{opacity:.85}'
        + '.cbpick-chipn{font-size:var(--fs-1);opacity:.6;font-variant-numeric:tabular-nums}'
        /* The chip. Sized to sit level with the input beside it, never taller. */
        + '.cbcart-bar{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:9px;'
        /* 40px, because `.inp` beside it is 40px. A chip two pixels short of the field it shares a row with reads
           as a misalignment even to someone who could not name what is wrong. */
        + 'padding:0 10px;height:40px;box-sizing:border-box;white-space:nowrap;user-select:none}'
        + '.cbcart-bar.on{cursor:pointer;color:#fff}'
        + '.cbcart-bag{position:relative;font-size:17px;line-height:1}'
        + '.cbcart-n{position:absolute;top:-7px;inset-inline-end:-9px;background:var(--card);border-radius:9px;min-width:17px;'
        /* 11px, not the 10.5px this started at — the legibility floor. The count is the one fact the chip must
           carry on a phone (the money hides below 520px), so it is the last thing that should be squinted at. */
        + 'height:18px;padding:0 4px;font-size:var(--fs-1);font-weight:800;line-height:18px;text-align:center}'
        + '.cbcart-sum{font-size:var(--fs-2);font-weight:800}'
        + '.cbcart-x{font-size:var(--fs-2);font-weight:800;opacity:.75;cursor:pointer;padding:0 1px}'
        + '.cbcart-x:hover{opacity:1}'
        + '.cbcart-partial{color:var(--warn-2);font-size:var(--fs-1);max-width:190px;line-height:1.3;white-space:normal}'
        /**
         * ⚠️ MOBILE: THE MONEY GOES, THE COUNT STAYS. Below 520px the summary would push the search box down to a
         * second row, which costs more than it tells you — so it is the summary that yields, never the badge or the
         * search field. What survives is: how many are in the cart, and the box to find the next one.
         */
        + '@media(max-width:520px){.cbcart-sum{display:none}.cbcart-bar{padding:0 8px;gap:5px}}';
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }
  /** The popup host every cart shares, unless a caller deliberately names its own. */
  var HOST = { popupEl: 'cbcart_ov', popupBodyEl: 'cbcart_ovc', popupClass: 'cbcart-ov' };

  /**
   * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
   *  create() — A CART YOU HOLD, rather than a name you pass around.
   * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
   *
   * Athi, 2026-08-09: *"do the create() refactor now, before the step-flow… the cart is the mechanism different
   * type of input can get into the system."*
   *
   * The namespaced API ('sup', 'net', 'cc', 'shop') works, and it caused two of the five defects in the 2026-08-09
   * integration. Both came from the same root: state keyed by a NAME means a screen re-initialises by calling
   * init() again on every repaint, so the module has to guess whether it is being handed the same catalogue or a
   * new one. Guessing wrong either wiped the caller's options or nearly emptied a basket.
   *
   * A handle removes the question. You create a cart once, you hold it, and there is no second call to interpret.
   *
   *     const cart = CBCart.create(catalogue, { accent, listEl, barEl, onCheckout });
   *     cart.add(itemId); cart.selected(); cart.destroy();
   *
   * ⚠️ ALL FOUR SCREENS HOLD A HANDLE NOW (2026-08-09) — storefront, Suppliers, Compose, Network. The cbPick*
   * adapters that carried them across are deleted. What remains of the namespaced API below is not a second front
   * door: `CBCart.add('cbcart-3', 'id')` is what the rows' own inline onclick handlers call, so the generated
   * markup can reach the cart it belongs to. It is an internal address, not an API to build a screen on.
   *
   * ── WHY THIS MATTERS FOR EVERY OTHER INPUT ───────────────────────────────────────────────────────────────────
   * The cart is where things ENTER the system, and the screen is only one way in. WhatsApp, email, the AI
   * "describe it in words" line, a CSV, an ERP push — all of them produce the same thing: a set of lines somebody
   * then confirms. `load()` is that door.
   *
   * ⚠️ AND IT IS THE SAME DOOR ON PURPOSE. A WhatsApp message saying "2 boxes of bolts" must pass through the same
   * model gate as a human pressing +. Bolts sold in 12s make "2 boxes" 24, or it is not a legal line. A channel
   * with its own path would bypass every order model and mint orders the catalogue says cannot exist. So load()
   * routes each line through put(), exactly as the + button does, and reports what it could not place rather than
   * dropping it.
   */
  var SEQ = 0;

  function create(cat, opts) {
    var ns = 'cbcart-' + (++SEQ);
    // The popup host is the cart's own business. A caller supplies a catalogue and where to paint the list — being
    // made to know that an overlay exists, and to name two element ids for it, is the kind of detail that gets
    // forgotten exactly once and then ships.
    ensureHost();
    var o = {}; for (var k in (opts || {})) o[k] = opts[k];
    for (var h in HOST) if (o[h] === undefined) o[h] = HOST[h];
    init(ns, cat, o);
    var h = {
      ns: ns,
      /* reading */
      state: function () { return st(ns); },
      /**
       * ⭐⭐ THE MONEY ROWS FOR A REVIEW — offers → After offers → GST per rate → Total incl. tax — for what is in THIS cart,
       * or null when the catalogue carries neither offers nor a tax rate (then a bare Total is honest). Athi, 2026-09-05,
       * two screenshots: the storefront basket said −₹40 · GST ₹18 · ₹378, the Suppliers review said ₹400. Same cart, same
       * seller, a second total. Every review step asks the cart; none of them adds up lines of its own any more.
       */
      moneyRows: function (o) {
        o = o || {};
        try {
          var s = C[ns], EL = engineLines(ns); if (!s) return null;
          var hasOffers = !!(s.cat && Array.isArray(s.cat.offers) && s.cat.offers.length), hasTax = EL.some(function (l) { return l.tax && l.tax.rate != null; });
          if (!hasOffers && !hasTax) return null;
          var M = money(EL, { offers: (s.cat.offers || []), ctx: { now: new Date(), currency: (s.cat.shop && s.cat.shop.currency_code) || 'INR', money: function (n) { return fmt(ns, n); } }, taxOf: function (id, l) { return (l && l.tax) || null; } });
          return { html: moneyRowsHTML(M, { taxTestid: o.taxTestid || 'cart-tax', totalTestid: o.totalTestid || 'cart-total' }), grand: M.grand, model: M };
        } catch (e) { return null; }
      },
      /**
       * ⭐⭐ THE ONE MONEY BLOCK EVERY SCREEN PRINTS (Athi, 2026-09-05: "it has to be a single source of truth — write a helper, one
       * source"). The full block: the rows (offers → after offers → GST per rate → total incl. tax) when the catalogue carries
       * offers or a rate, else the bare Total — with the partial / your-offer wording. A screen writes ONE line:
       *   c.reviewHTML({ totalTestid: 'sup-total', taxTestid: 'sup-tax' })
       * and never reads total() itself; e2e/one-cart.cjs fails the run if one does.
       */
      reviewHTML: function (o) {
        o = o || {};
        var T = total(ns), tid = o.totalTestid || 'cart-total';
        var MR = (!T.offered && !T.partial) ? h.moneyRows({ totalTestid: tid, taxTestid: o.taxTestid || 'cart-tax' }) : null;
        if (MR) return '<div data-testid="' + esc(tid.replace(/-total$/, '')) + '-money" style="padding:8px 12px;border-top:2px solid var(--line);font-size:var(--fs-2)">' + MR.html + '</div>';
        return '<div style="display:flex;padding:10px 12px;border-top:2px solid var(--line);font-size:var(--fs-3);font-weight:800">'
          + '<span style="flex:1">' + (T.offered ? 'Total at your offer' : 'Total') + '</span>'
          + '<span data-testid="' + esc(tid) + '">' + (T.amount ? esc(fmt(ns, T.amount)) + (T.partial ? '+' : '') : '—') + '</span></div>'
          + (T.partial ? '<div style="color:var(--warn-2);font-size:var(--fs-1);padding:0 12px 8px">Some lines have no price — the total covers only the priced ones.</div>' : '');
      },
      rows: function () { return rows(ns); },
      selected: function () { return selected(ns); },
      lines: function () { return lines(ns); },
      units: function () { return units(ns); },
      total: function () { return total(ns); },
      /**
       * ⭐⭐ THE CART FORMATS ITS OWN MONEY. Athi: *"the amount does not carry a currency symbol."* Two review
       * screens — supplier and network — printed `String(line_total)` and `String(total.amount)`, bare numbers on
       * the last page before an order goes out. Both had been written by copying the other.
       *
       * ⚠️ The fix is NOT a helper in each screen. This file's own note says a renderer that formats money its own
       * way will one day print a different number from the cart beside it, and two screens had already proved it.
       * The cart knows the shop's currency, so the cart is asked.
       *
       * An unpriced line returns the em-dash rather than "0": no price and a price of zero are different claims,
       * and only one of them is a promise.
       */
      money: function (n) { return (n == null || !isFinite(n)) ? '—' : fmt(ns, n); },
      qtyOf: function (id) { return qtyOf(ns, id); },
      offerState: function (id) { return offerState(ns, id); },
      /* changing — every one routes through the same gate as the + button */
      add: function (id) { add(ns, id); return h; },
      dec: function (id) { dec(ns, id); return h; },
      setQty: function (id, v) { setQty(ns, id, v); return h; },
      setOffer: function (id, v) { setOffer(ns, id, v); return h; },
      addLine: function (data, qty) { return addAdhoc(ns, data, qty); },
      group: function (i) { group(ns, i); return h; },
      clear: function () { clear(ns); return h; },
      search: function (q) { search(ns, q); return h; },
      onlyOffers: function (on) { onlyOffers(ns, on); return h; },
      /* ⚠️ A SETTER WITHOUT A GETTER IS WHY AN EMPTY CATALOGUE SAID "nothing matches that". The picker could
         set a search term but never ask whether one existed, so it printed the no-match sentence over a screen
         with an empty search box — telling the reader their query was too narrow when they had not typed one. */
      queryText: function () { return (C[ns] || {}).q || ''; },
      /* Repaint the chips alone — for a host whose category shelf lands after the picker is already on screen. */
      paintCategories: function () { paintCatgs(ns); return h; },
      /* the cart popup */
      open: function () { open(ns); return h; },
      close: function () { close(ns); return h; },
      checkout: function () { checkout(ns); return h; },
      /* rendering */
      barHTML: function () { return barHTML(ns); },
      listHTML: function () { return listHTML(ns); },
      pickerHTML: function (o) { return pickerHTML(ns, o); },
      popupHTML: function () { return popupHTML(ns); },
      paint: function () { paint(ns); return h; },

      /**
       * load(lines) — THE CHANNEL DOOR. Anything that is not a person pressing + comes in here: a WhatsApp
       * message, an email, the AI line, a CSV, an ERP push.
       *
       * Each line is `{ item_id?, name?, qty?, price?, unit? }`. A line that names a catalogue item by id or name
       * is placed AS that item, so it inherits the item's order model and the catalogue's price. A line that
       * matches nothing becomes an ad-hoc line, because a message asking for something you do not stock is still
       * a real request and dropping it silently is the failure this codebase keeps refusing.
       *
       * ⚠️ RETURNS WHAT IT COULD NOT PLACE. `refused` holds lines the MODEL rejected — 3 metres of a cable with a
       * 5 metre minimum, say. They are reported, never rounded up to make them fit, because quietly ordering more
       * than someone asked for is the one direction this must never fail in. The caller shows them; a human
       * decides. Nothing here mints anything.
       */
      load: function (incoming) {
        var s = C[ns]; if (!s || !Array.isArray(incoming)) return { placed: [], refused: [] };
        var placed = [], refused = [];
        var all = rowsOf(s.cat).filter(function (r) { return r.type === 'line'; });
        var byId = {}, byName = {};
        all.forEach(function (r) {
          byId[r.item_id] = r;
          byName[String(nameOf(r)).trim().toLowerCase()] = r;
        });
        incoming.forEach(function (ln) {
          if (!ln) return;
          var want = ln.qty == null ? 1 : ln.qty;
          var match = (ln.item_id && byId[ln.item_id])
                   || (ln.name && byName[String(ln.name).trim().toLowerCase()]);
          if (match) {
            put(ns, match.item_id, want);
            // The model may have refused it outright (below a minimum) or landed it on a legal value.
            var got = qtyOf(ns, match.item_id);
            if (got > 0) placed.push({ item_id: match.item_id, name: nameOf(match), qty: got, asked: want });
            else refused.push({ name: nameOf(match), asked: want, why: 'the catalogue refuses that quantity' });
            return;
          }
          if (!ln.name) { refused.push({ name: null, asked: want, why: 'no name — nothing to put on a chit' }); return; }
          var id = addAdhoc(ns, { name: ln.name, unit: ln.unit || 'unit', price: ln.price }, want);
          if (id) placed.push({ item_id: id, name: ln.name, qty: qtyOf(ns, id), asked: want, adhoc: true });
          else refused.push({ name: ln.name, asked: want, why: 'could not be added' });
        });
        touched(ns);
        return { placed: placed, refused: refused };
      },

      /**
       * setCatalogue — the SAME cart, pointed at a freshly-read catalogue.
       *
       * A screen re-reads a supplier's catalogue for reasons that have nothing to do with the basket — you clicked
       * the same supplier again, you came back from another store. Under the namespaced API that was init()'s job,
       * and init() had to GUESS from a signature whether it was being handed the same catalogue or a new one;
       * guessing wrong once nearly emptied a basket and once wiped the caller's options.
       *
       * ⚠️ THERE IS NO GUESS HERE. The caller already knows which supplier it is looking at, so it decides: the same
       * one gets setCatalogue and keeps the basket, a different one gets destroy() and a new cart. That is the whole
       * reason a handle beats a name.
       */
      setCatalogue: function (nextCat) {
        var s = C[ns]; if (!s) return h;
        var next = nextCat || {};
        // Ad-hoc lines are the CALLER'S own, not the shop's — re-reading the shop's catalogue must not delete
        // something a person typed in themselves. Copied, never mutated: the payload belongs to the screen.
        var mine = ((s.cat && s.cat.items) || []).filter(function (p) { return p && p.adhoc; });
        var merged = {}; for (var k in next) merged[k] = next[k];
        if (mine.length) merged.items = (next.items || []).concat(mine);
        s.cat = merged; s.sig = sigOf(merged);
        // A line the shop has withdrawn cannot be ordered, and left in `sel` it would go on counting toward the
        // bar while selected() — which reads the catalogue — never returned it. Two facts about one cart,
        // disagreeing. Dropping it is visible on screen; a phantom in the count is not.
        var live = {};
        rowsOf(merged).forEach(function (r) { if (r.type === 'line') live[r.item_id] = 1; });
        Object.keys(s.sel).forEach(function (id) { if (!live[id]) delete s.sel[id]; });
        touched(ns);
        return h;
      },

      /** Let it go. A held cart that is never released is a leak the namespaced API could not even express. */
      destroy: function () { close(ns); delete C[ns]; }
    };
    /* ⚠️ The handle is kept on the state so paintList/paintBar can hand it to a `renderer` (see rendererOf).
       Everything else in this file works from `ns`; a renderer works from the handle, because a renderer is a
       CALLER of this API and must not reach into C[ns]. This is the one bridge between the two. */
    if (C[ns]) C[ns].handle = h;
    return h;
  }

  /**
   * ⭐⭐ ONE MATH FOR EVERY MONEY FIGURE A BUYER SEES — moved here from the storefront (Athi, 2026-09-05: "the cart is a
   * single view we should be able to embed anywhere so we get the same style and response everywhere; keep it as a
   * single source of truth"). The storefront basket, the storefront review, the app's basket panel and the Suppliers
   * review all call these two; nothing else computes an offer, a tax row or a total.
   *   money(lines, { offers, ctx, taxOf })  → { gross, ev, byRate, taxTotal, untaxed, grand, ctx }
   *     lines: the engine's line shape ({ key, item_id, sku, categories, qty, unitPrice, … }); offers: the seller's live
   *     rules; ctx: { now, currency, money(n) }; taxOf(item_id) → { rate, cess, name } or null (the catalogue view attaches
   *     it per item — the same resolver as the order and the invoice).
   *   moneyRowsHTML(m, { taxTestid, totalTestid }) → offers → After offers (or Goods) → GST per rate → Total incl. tax
   */
  function money(lines, o) {
    o = o || {}; var offers = o.offers || [], ctx = o.ctx || { now: new Date(), currency: 'INR', money: function (n) { return String(n); } };
    var taxOf = typeof o.taxOf === 'function' ? o.taxOf : function () { return null; };
    var gross = lines.reduce(function (s, l) { return s + (Number(l.unitPrice) || 0) * (Number(l.qty) || 0); }, 0);
    var ev = (offers.length && root.CBOffers) ? root.CBOffers.evaluate({ lines: lines, offers: offers, ctx: ctx, money: ctx.money }) : { adjustments: [], notes: [], subtotal: gross, total: gross };
    var per = (offers.length && root.CBOffers && root.CBOffers.perLine) ? (root.CBOffers.perLine(ev, lines) || {}) : {};
    var orderOff = (ev.adjustments || []).filter(function (a) { return a.scope !== 'line' && a.scope !== 'note'; }).reduce(function (s, a) { return s + Math.abs(Number(a.amount) || 0); }, 0);
    var byRate = {}, taxTotal = 0, untaxed = 0;
    lines.forEach(function (l, i) {
      var g = (Number(l.unitPrice) || 0) * (Number(l.qty) || 0);
      var off = ((per[String(i)] || per[l.key] || {}).off) || 0;
      var net = Math.max(0, g - off - (gross > 0 ? orderOff * g / gross : 0));
      var t = taxOf(l.item_id, l);
      if (t && t.rate != null) {
        var rate = Number(t.rate) + (Number(t.cess) || 0), tax = Math.round(net * rate / 100 * 100) / 100;
        var k = (t.name && !/^\d/.test(String(t.name)) ? String(t.name) : 'GST') + ' · ' + Number(t.rate) + '%' + (Number(t.cess) ? ' + ' + Number(t.cess) + '% cess' : '');
        byRate[k] = Math.round(((byRate[k] || 0) + tax) * 100) / 100; taxTotal += tax;
      } else untaxed += net;
    });
    taxTotal = Math.round(taxTotal * 100) / 100;
    return { gross: gross, ev: ev, byRate: byRate, taxTotal: taxTotal, untaxed: Math.round(untaxed * 100) / 100, grand: Math.round(((ev.total != null ? ev.total : gross) + taxTotal) * 100) / 100, ctx: ctx };
  }
  function moneyRowsHTML(m, opt) {
    opt = opt || {}; var ctx = m.ctx, ev = m.ev || { adjustments: [], notes: [], total: m.gross };
    var row = function (l, r, extra) { return '<div style="display:flex;justify-content:space-between;gap:8px;' + (extra || '') + '"><span>' + l + '</span><span>' + r + '</span></div>'; };
    var rows = (ev.adjustments || []).map(function (a) { return row('🏷️ ' + esc(a.label || a.kind) + (a.scope && a.scope !== 'line' ? ' <small style="opacity:.7">' + esc(a.scope) + '</small>' : ''), '<b style="color:#c0392b">−' + esc(ctx.money(Math.abs(Number(a.amount) || 0))) + '</b>'); }).join('');
    var notes = (ev.notes || []).map(function (n) { return '<div style="opacity:.75">💡 ' + esc(n.why || n.text || n.label || '') + '</div>'; }).join('');
    var keys = Object.keys(m.byRate || {});
    var taxRows = keys.map(function (k) { return '<div data-testid="' + esc(opt.taxTestid || 'cart-tax') + '" style="display:flex;justify-content:space-between;gap:8px;opacity:.85"><span>' + esc(k) + '</span><span>' + esc(ctx.money(m.byRate[k])) + '</span></div>'; }).join('')
      + (m.untaxed > 0 && keys.length ? '<div style="opacity:.6;font-size:12px">' + esc('no tax slab resolves for ' + ctx.money(m.untaxed) + ' of this basket') + '</div>' : '');
    var after = (rows || notes)
      ? rows + notes + '<div style="display:flex;justify-content:space-between;border-top:1px solid #eee;margin-top:6px;padding-top:6px"><span>After offers</span><b>' + esc(ctx.money(ev.total)) + '</b></div>'
      : '<div style="display:flex;justify-content:space-between"><span>Goods</span><b>' + esc(ctx.money(m.gross)) + '</b></div>';
    /* ⭐ ONE ROOT, ITS OWN TYPE. The block carries its font and size itself (the app's --font-ui token, which shop.html now
       declares too), so the storefront, Suppliers, Record a sale and Compose print the same pixels — [PAR-02] shoots this root
       at one width on two surfaces and diffs them. The frame around it (a dashed accent on the storefront) stays the surface's. */
    return '<div class="cbcart-money" data-testid="cbcart-money" style="font-family:var(--font-ui,Inter,system-ui,sans-serif);font-size:13px;line-height:1.35;color:var(--ink,#20303b)">' + after + taxRows

      + '<div style="display:flex;justify-content:space-between;border-top:2px solid #333;margin-top:6px;padding-top:6px;font-size:14px"><span>Total incl. tax</span><b data-testid="' + esc(opt.totalTestid || 'cart-total') + '">' + esc(ctx.money(m.grand)) + '</b></div>' + '</div>';
  }

  root.CBCart = {
    money: money, moneyRowsHTML: moneyRowsHTML,
    create: create,
    init: init, state: st, rows: rows, selected: selected,
    lines: lines, units: units, total: total, qtyOf: qtyOf, unitPrice: unitPrice,
    add: add, dec: dec, setQty: setQty, setOffer: setOffer, offerState: offerState,
    group: group, clear: clear, search: search, onlyOffers: onlyOffers, addAdhoc: addAdhoc, models: MODELS,
    /* `category` is the chips' inline onclick, the same front-door route as add/search. */
    category: catgSet, categories: catgTally,
    /* ⚠️ EXPORTED so catalogue-ui can render the SAME strip rather than growing a second one. It has its own
       pickerHTML (it replaces the search chrome, not just the list), so without this the chips exist on one
       picker and not the other — which is exactly how they went missing from compose. */
    categoriesHTML: catgsHTML,
    /* ⚠️ EXPORTED because the chip markup has TWO consumers and the stylesheet had one accidental injector. Any
       screen emitting `.cbpick-chip` must call this; the catalogue management screen does not open a cart, so
       relying on ensureHost to have run is relying on an unrelated feature being used first. */
    ensureChipCss: ensureChipCss,
    open: open, close: close, checkout: checkout,
    barHTML: barHTML, listHTML: listHTML, popupHTML: popupHTML, pickerHTML: pickerHTML,
    /* ⚠️ EXPORTED SO catalogue-ui.js CANNOT GROW A SECOND MONEY FORMATTER. It briefly had one, and that is
       precisely how the two would drift: `fmt` honours `groupDigits`/`locale` per screen (off by default on
       purpose — grouping ₹3400 into ₹3,400 broke variants.spec and would restyle a public page as a side
       effect of a refactor). A renderer that formats money its own way is a renderer that will one day print a
       different number from the cart popup beside it. */
    fmt: fmt, symbolOf: sym,
    paint: paint, paintList: paintList, paintBar: paintBar, paintPopup: paintPopup
  };
  /**
   * ⚠️ THE cbPick* ADAPTERS ARE GONE (2026-08-09), and this note is the receipt.
   *
   * They existed for one reason: on 2026-08-08 four live screens called a picker written the day before, and
   * rewriting every call site in one pass, on a deployed app, to land a UI change is the kind of big-bang edit that
   * breaks something unrelated at 11pm. So the old names survived as forwarders while the screens moved over one at
   * a time — storefront, Suppliers, Compose, Network — each with a gate between.
   *
   * All four hold a CBCart.create() handle now, so every forwarder had lost its last caller. A compat shim with no
   * caller is not compatibility; it is dead weight that reads like a supported API, and the next person needing a
   * cart would have found two front doors with no way to tell which was current.
   *
   * ⚠️ WHAT THE TWO DOORS COST BEFORE: they were never quite the same. cbPickInit called ensureHost() and named the
   * popup element ids; create() did neither, so the storefront shipped a cart that could be filled and never
   * opened. That is why ensureHost and the host ids now live in the CART itself, above — so deleting these takes
   * nothing with them.
   */


  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBCart;
})(typeof window !== 'undefined' ? window : globalThis);


/* ═══ PART 2 · THE ROWS, THE CHIP, THE PICKER (was app/catalogue-ui.js) ═══════════════════════════════════ */

/* app/catalogue-ui.js — THE CATALOGUE ROW, redesigned. A RENDERER ONLY.  (classic script, shared global scope)
 *
 * Athi, 2026-08-15: *"work on this design pattern as much as we can and then make it possible"* … and, decisively:
 * *"implement as a separate js and then we can replace once we are fully ready"*.
 *
 * That instruction is the whole architecture of this file, and it is the right call: `cart-ui.js` is live behind
 * FOUR surfaces — Compose, Suppliers, Network store catalogues, and the PUBLIC storefront, which has already had
 * two outages this week. Rewriting its rows in place would put a design experiment on a public page with no way
 * back except a revert. So the new design lands beside the old one, both work, and the swap is one line per
 * screen — which means the rollback is also one line per screen.
 *
 * ── ⚠️⚠️ WHAT THIS FILE MUST NEVER DO ────────────────────────────────────────────────────────────────────────────
 * IT DOES NOT OWN QUANTITY. Not the models, not `coerce`, not the stepper's arithmetic, not the 6MB cap, not the
 * cart state. Every one of those lives in cart-ui.js and every mutation here routes through `CBCart.add/dec/
 * setQty/setOffer` exactly as the old rows do. A pack of 12 cannot be broken by typing 13 into THIS renderer,
 * because this renderer has no opinion about 13.
 *
 * That is not politeness — it is the entire lesson of the divergence cart-ui.js was written to end: *the walk was
 * shared and the render was copied*. A second renderer is safe ONLY while it stays a second renderer. The moment
 * it grows its own coerce(), there are two carts again and they will disagree.
 *
 * ── WHAT IT DOES OWN ─────────────────────────────────────────────────────────────────────────────────────────────
 *   CBCatUI.pickerHTML(cart, opts)   the sticky header, the rows, the commit strip, the on-the-chit block
 *   CBCatUI.paint(cart, opts)        repaint in place
 *   CBCatUI.observe()                wire lazy media after any paint
 *
 * `cart` is a handle from `CBCart.create()`. Nothing else is needed.
 *
 * ── THE FOUR THINGS THIS DESIGN FIXES, ALL MEASURED 2026-08-15 ───────────────────────────────────────────────────
 *  1. The cart said "3 lines · ₹375" while the footer said "Add at least one line item" and Next stayed dead.
 *     Both true — the cart stages, `+ Add to the chit` commits — and nothing said so. → THE COMMIT STRIP.
 *  2. Committed lines rendered 3,198px below the fold, under 3,008px of catalogue. → THE ON-THE-CHIT BLOCK.
 *  3. Prices did not line up: ₹340 at x=740, ₹149 at x=628, because the model hint sat inside the control group
 *     and made every row's controls a different width. → FIXED COLUMNS, hint moved to the sub-line.
 *  4. Rows were text only. Fine for `Jute Bag 50kg`; useless for a grade of rice or a finish. → MEDIA.
 */
(function (root) {
  'use strict';

  /* ⚠️ Every name this file introduces is CBCat/cbcat-prefixed and was greped across app.html and public/app/*.js
     before being written. A colliding top-level declaration throws at load, the <script> still fires onload, the
     loader believes the capability arrived, and the screen renders a stub with nothing anywhere naming the cause.
     That bug cost hours on 2026-08-15 (`MSG` in cap-messages) and it is invisible to `node --check`. */
  var CBCAT = { io: null, moreIo: null, seq: 0, win: {} };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dataOf(r) { return (r && r.item && (r.item.item_data || r.item)) || {}; }
  /**
   * ⚠️ MONEY IS FORMATTED BY CBCart.fmt, NOT HERE. This file had its own `money()` for about an hour and that was
   * a mistake of exactly the kind it is written to avoid: `fmt` honours the screen's `groupDigits`/`locale`
   * (grouping is OFF by default on purpose — turning ₹3400 into ₹3,400 broke a spec and would restyle a public
   * page as a side effect of a refactor). A second formatter means this renderer and the cart popup beside it can
   * one day print different numbers for the same line, and nobody would know which was right.
   */
  function money(ns, n) {
    if (n == null || !isFinite(n)) return '';
    /* ⚠️ ONE FORMAT EVERYWHERE. Beside the app, its own formatter (locale · currency · sign · two decimals) rules — the
       sheet read "₹610" and "₹-61" above "549.00 ₹" (Athi, 2026-09-05). The storefront keeps CBCart.fmt. */
    if (typeof root.fmtMoney === 'function') { try { return root.fmtMoney(n, (typeof root.myCur === 'function') ? root.myCur() : 'INR'); } catch (_) {} }
    return (root.CBCart && root.CBCart.fmt) ? root.CBCart.fmt(ns, n) : String(n);
  }

  /**
   * mediaOf — where a product's picture lives.
   *
   * ⚠️ NOTHING IN THE CATALOGUE DECLARES ONE YET. The schema for product media is unbuilt (see
   * SPEC-object-storage.md), so today this returns null for every row in the product and the media column does
   * not render at all. Several key names are accepted because the field has not been named yet and guessing one
   * here would quietly decide it; when the schema lands, this function is the single place that learns about it.
   */
  function mediaOf(r) {
    var d = dataOf(r);
    var m = d.media || d.image || d.photo || d.thumbnail || null;
    if (!m) return null;
    if (typeof m === 'string') return { src: m, kind: /\.(mp4|webm|mov)$/i.test(m) ? 'video' : 'image' };
    return { src: m.src || m.url || m.thumb || '', kind: m.kind || (m.video ? 'video' : 'image') };
  }

  /**
   * ⭐⭐ THE LETTER TILE — Athi, 2026-08-15: *"can we create a box with different colors rendering with the first
   * letter of the product"*.
   *
   * This retires the compromise that came before it. The column used to be hidden until a catalogue had a real
   * photograph, because the alternative was 52px of empty grey on every row for nothing. A coloured initial is
   * not nothing: it gives a text-only list the visual rhythm that makes it scannable, it distinguishes
   * "Tamarind" from "Toor Dal" at a glance, and it does it TODAY — the product has zero images and the schema
   * for them is not built (see SPEC-object-storage.md).
   *
   * So the column is now always present, and a real photograph simply replaces the tile when one exists.
   *
   * ⚠️ THE COLOUR IS DERIVED, NOT RANDOM. Hue comes from a hash of the name, so a product is the same colour on
   * every screen, every session, for every party — which is what makes it a recognition aid rather than
   * decoration. Random-per-render would be actively worse than grey: it would teach the eye a pattern that is
   * not true.
   *
   * ⚠️ SATURATION AND LIGHTNESS ARE FIXED so white text stays legible on every hue, and the yellow-green band
   * (where a given lightness reads much brighter) is darkened. A tile whose letter cannot be read is a worse
   * empty box than the empty box.
   */
  function tileFor(name) {
    var s = String(name == null ? '' : name).trim();
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var hue = h % 360;
    /* 40°–190° is the yellow→green stretch that reads bright at a given lightness; drop it so contrast holds. */
    var light = (hue > 40 && hue < 190) ? 34 : 44;
    return {
      bg: 'hsl(' + hue + ',38%,' + light + '%)',
      letter: (s.charAt(0) || '?').toUpperCase()
    };
  }

  /**
   * The model's rule, said ON THE SUB-LINE.
   *
   * ⚠️ It used to sit beside the control, and that is what broke the price column: "sold in 12s" is wider than
   * "" so every row's control group was a different width and the prices zig-zagged. It is a fact about the ITEM
   * — true whether or not anything is in the cart — so it belongs with the unit.
   */
  function hintOf(r) {
    var d = dataOf(r), o = d.order || {};
    var m = o.model || 'count';
    if (m === 'pack')    return o.step ? 'sold in ' + o.step + 's' : '';
    if (m === 'range')   return (o.min != null ? 'min ' + o.min : '') + (o.min != null && o.max != null ? ' · ' : '') + (o.max != null ? 'max ' + o.max : '');
    if (m === 'measure') return o.step ? 'steps of ' + o.step : '';
    if (m === 'pick')    return 'one or none';
    if (m === 'offer')   return 'name your price';
    return '';
  }
  function modelOf(r) { return (dataOf(r).order || {}).model || 'count'; }

  /* ── the control. Six models, six shapes; the ARITHMETIC is CBCart's. ─────────────────────────────────────── */
  function ctlHTML(cart, r) {
    var id = r.item_id, q = cart.qtyOf(id), ns = cart.ns, m = modelOf(r);
    var call = function (fn, arg) {
      return 'CBCart.' + fn + '(\'' + esc(ns) + '\',\'' + esc(id) + '\'' + (arg === undefined ? '' : ',' + arg) + ')';
    };
    /**
     * ⚠️⚠️ `data-testid="cart-add"` IS A PUBLISHED HOOK AND GOES ON EVERY ADD CONTROL — the pick toggle, the bare
     * `+`, and the `+` inside the stepper. That is exactly where cart-ui's stepperHTML puts it (lines 452, 457,
     * 472), and order-steps.spec.js clicks `getByTestId('cart-add').first()`.
     *
     * I first used my own `cbcat-add-<id>` instead and the spec timed out after 15s waiting for a button that
     * was on screen the whole time under a different name. Renaming a published hook does not fail loudly; it
     * fails as a test that cannot find a thing a human can see.
     *
     * The per-row id survives as `data-cbcat` so the harness can still target one specific row — an extra
     * attribute, not a second data-testid, because an element gets exactly one of those.
     */
    if (m === 'pick') {
      /* ⚠️ NO STEPPER AT ALL. `pick` is one or none — a second press must not make it two, so there must be no
         control that invites one. The model already refuses it; offering a + that does nothing would be worse. */
      return '<button type="button" class="cbcat-pick' + (q ? ' on' : '') + '"'
        + ' data-testid="cart-add" data-cbcat="pick-' + esc(id) + '"'
        + ' onclick="' + (q ? call('setQty', '0') : call('add')) + '">' + (q ? '✓ Added' : 'Add') + '</button>';
    }
    var out = q
      ? '<span class="cbcat-stp"><button type="button" aria-label="less" onclick="' + call('dec') + '">−</button>'
        + '<input value="' + esc(q) + '" inputmode="decimal" aria-label="quantity"'
        + ' onchange="CBCart.setQty(\'' + esc(ns) + '\',\'' + esc(id) + '\',this.value)"></span>'
        + '<button type="button" class="cbcat-add" data-testid="cart-add" data-cbcat="add-' + esc(id) + '"'
        + ' aria-label="more" onclick="' + call('add') + '">+</button>'
      : '<button type="button" class="cbcat-add" data-testid="cart-add" data-cbcat="add-' + esc(id) + '"'
        + ' aria-label="add" onclick="' + call('add') + '">+</button>';
    return out;
  }

  /* ── one row ─────────────────────────────────────────────────────────────────────────────────────────────── */
  function rowHTML(cart, r, opts) {
    var d = dataOf(r), id = r.item_id, q = cart.qtyOf(id);
    /**
     * ⚠️⚠️ THE PRICE COMES FROM CBCart.unitPrice — ns-first, off the ROOT export. It is NOT on the handle.
     *
     * This line read `cart.unitPrice ? cart.unitPrice(r) : { amount: d.price, … }` and shipped a catalogue where
     * EVERY ROW SAID "no price". `unitPrice` is not one of the handle's methods, so the fallback always won —
     * and the fallback guessed `item_data.price`, which is not where cart-ui finds a price (it walks offers,
     * asking price and the row's own shape). A supplier's whole catalogue rendered as unpriced.
     *
     * That is the same mistake as the money formatter, one hour later: reimplementing something cart-ui owns
     * instead of calling it. There is now NO fallback — if the shared reader cannot be reached, that is a load
     * order bug and it should be loud, not quietly priced at nothing.
     */
    var u = root.CBCart.unitPrice(cart.ns, r);
    /* ⚠️ WAS '₹' AS THE DEFAULT. A symbol is not decoration — it states which currency a figure is in, and a
       rupee sign in front of a dirham amount is a wrong number, not a cosmetic slip. The business's own currency
       is stamped on its prices; this asks the layer for its symbol instead of assuming India. */
    var sym = opts.sym || CBLocale.symbol((typeof SESSION !== 'undefined' && SESSION && SESSION.currency) || 'INR');
    var name = r.variant || d.name || d.product || 'item';
    var hint = hintOf(r);

    var media = (function () {
      var m = mediaOf(r);
      if (!m) {
        /* No photograph — the derived letter tile, which is a real visual rather than a placeholder for one. */
        var t = tileFor(name);
        return '<span class="cbcat-thumb cbcat-tile" style="background:' + t.bg + '" aria-hidden="true">'
          + esc(t.letter) + '</span>';
      }
      /**
       * ⭐ data-src, NOT src. The observer fills it when the row nears the viewport. `loading="lazy"` is set too
       * as a belt-and-braces for the case where the observer never runs.
       *
       * ⚠️ AND AN onerror FALLBACK TO THE TILE. A product declaring a photograph that 404s rendered a BLANK
       * WHITE BOX — seen on screen the moment a test record carried a placeholder path that does not exist yet.
       * That is the worst of the three outcomes: worse than the letter tile, and worse than an honest empty
       * state, because it reads as a rendering fault. Media URLs rot — a bucket is emptied, a key is renamed, a
       * catalogue is copied between entities — so the row must degrade to something deliberate rather than to
       * nothing.
       */
      var t = tileFor(name);
      return '<span class="cbcat-thumb cbcat-skel">'
        + '<img data-src="' + esc(m.src) + '" alt="" loading="lazy" decoding="async"'
        + ' onerror="CBCatUI.fellBack(this,\'' + esc(t.bg) + '\',\'' + esc(t.letter) + '\')">'
        + (m.kind === 'video' ? '<span class="cbcat-play">▶</span>' : '') + '</span>';
    })();

    /**
     * The price column. An offer REPLACES the asking price in the maths, so it replaces it here too — with the
     * asking price still shown, struck through, because hiding what they asked for is its own dishonesty.
     *
     * ⭐ AND THE OFFER INPUT LIVES HERE, IN THE PRICE COLUMN — not beside the stepper.
     *
     * It was in the control group first, and the harness caught the consequence immediately: the offer row's
     * controls were wider than every other row's, so its price sat at x=515 while the other seven sat at x=546.
     * That is the exact zig-zag this design exists to remove, reappearing one model later.
     *
     * Putting it here is not just a fix for the width — it is where the thing belongs. "Name your price" is a
     * statement about PRICE. The control column is for quantity; the price column is for money; and a layout
     * whose columns mean something is the reason a price column can be scanned at all.
     */
    var offerInput = (modelOf(r) === 'offer')
      ? '<input class="cbcat-offer" placeholder="your ' + esc(sym) + '" value="'
        + esc(u.offered ? u.amount : '') + '" aria-label="your price"'
        + ' data-testid="cbcat-offer-' + esc(id) + '"'
        + ' onchange="CBCart.setOffer(\'' + esc(cart.ns) + '\',\'' + esc(id) + '\',this.value)">'
      : '';
    var price = u.offered
      /* an offered price on a row that is NOT a name-your-price model (a line-scope discount the storefront sets) shows the
         struck asking price AND the offered amount — without this the amount vanished behind the strike (2026-09-05) */
      ? '<s class="cbcat-was">' + esc(money(cart.ns, u.asking)) + '</s>' + (offerInput || (isFinite(u.amount) ? ' <b class="cbcat-offered">' + esc(money(cart.ns, u.amount)) + '</b>' : ''))
      : (offerInput || (isFinite(u.amount) ? esc(money(cart.ns, u.amount)) : '<span class="cbcat-noprice">no price</span>'));
    /* The line total, ONLY once there is a quantity to MULTIPLY by — `q > 1`, not `q`. At quantity 1 it prints
       the same number twice under itself, which is exactly the noise the rule was written to avoid; I had the
       comment right and the condition wrong, and it showed as ₹65 over ₹65 on screen. */
    var lineTotal = (q > 1 && isFinite(u.amount))
      ? '<div class="cbcat-linetotal">' + esc(money(cart.ns, u.amount * q)) + '</div>' : '';

    /**
     * ⭐⭐ WHAT THIS ROW PROMISES, BEFORE ANYTHING IS IN A BASKET.
     *
     * Athi, 2026-09-02: *"discount and offers need to be expressed, otherwise people may not know"* — and in
     * B2B, pushing product IS the discount. Until now `offersHTML` showed adjustments inside the CART, so a
     * buyer could not learn an offer existed until they had already chosen.
     *
     * ⚠️ THE CONDITION IS ALWAYS IN THE SENTENCE — "₹170 each from 10", never a bare "₹170 each" beside a row
     * priced ₹180. A badge is a commitment; one the basket then declines is worse than no badge at all.
     * CBOffers.promise returns null for anything expired, unstarted or out of region, so a row that cannot
     * honour a promise simply stays quiet. See offers.js.
     */
    var offBadge = '';
    try {
      /* ⚠️ NO CALLER EVER PASSED `offers` (Athi, 2026-09-05, from Chola's Suppliers screen: "tallytest not showing the
         offer") — the badge could only ever be blank on Suppliers, Compose and Network. The catalogue the cart holds
         carries the seller's live offers (the same payload the storefront reads); they are the default. */
      var _st = null; try { _st = cart.state ? cart.state() : null; } catch (e) { _st = null; }
      var _offs = (opts && opts.offers) || (cart.__cbcatOpts && cart.__cbcatOpts.offers) || (_st && _st.cat && _st.cat.offers) || [];
      if (_offs.length && root.CBOffers && root.CBOffers.forLine) {
        var _p = root.CBOffers.forLine(
          /* `excluded` rides the line — an item whose "Shown to customers" switch for offers is off (offers_excluded ['*']) promises nothing */
          { item_id: id, sku: d.sku, categories: catgIds(d), unitPrice: Number(u.amount) || 0, excluded: Array.isArray(d.offers_excluded) ? d.offers_excluded.map(String) : [] },
          _offs, { now: new Date(), money: function (n) { return money(cart.ns, n); } });
        offBadge = _p.slice(0, 2).map(function (x) {
          return '<span class="cbcat-off" title="' + esc(x.label) + '">' + esc(x.promise) + '</span>';
        }).join('');
      }
    } catch (e) { offBadge = ''; }   /* a badge must never take the catalogue down */

    /* ⭐ THE TAX A BUYER WILL PAY, on the row (Athi, 2026-09-05: "not showing the GST values here"). The item carries the
       rate the seller's shelf resolves for it (catalogue-view attaches it — the same resolver as the order and the
       invoice), so the row says "+5% GST · ₹210 incl." beside the listed price. No rate → nothing extra, as before. */
    var taxChip = '';
    try {
      var _tx = (r.item && r.item.tax) || (d && d.tax) || null;
      if (_tx && _tx.rate != null && isFinite(u.amount)) {
        var _rate = Number(_tx.rate) + (Number(_tx.cess) || 0), _incl = Math.round(u.amount * (1 + _rate / 100) * 100) / 100;
        taxChip = '<span class="cbcat-tax" data-testid="cbcat-tax-' + esc(id) + '" title="' + esc(_tx.name || 'GST') + '" style="display:block;font-size:11px;color:#5D636A;white-space:nowrap">+' + esc(String(Number(_tx.rate))) + '% ' + esc(_tx.name && !/^\d/.test(_tx.name) ? 'GST' : 'GST') + (Number(_tx.cess) ? ' +' + esc(String(Number(_tx.cess))) + '% cess' : '') + ' · ' + esc(money(cart.ns, _incl)) + ' incl.</span>';
      }
    } catch (e) { taxChip = ''; }
    /* ⭐ THE STOCK STAMP, on every surface (Athi, 2026-09-05: "offer, availability not appearing" on the Suppliers screen — the
       storefront alone drew it). The connector stamps item_data.avail { qty, as_of, source }; the row says the figure WITH its
       age, never bare; older than four hours reads faded. `shop-stock` stays the published hook the specs assert on. */
    var stockChip = '';
    try {
      var _av = d && d.avail;
      if (_av && _av.qty != null && _av.as_of) {
        var _mins = Math.max(0, Math.round((Date.now() - Date.parse(_av.as_of)) / 60000));
        var _age = _mins < 1 ? 'just now' : (_mins < 60 ? _mins + ' min ago' : (_mins < 1440 ? Math.round(_mins / 60) + ' h ago' : Math.round(_mins / 1440) + ' d ago'));
        var _in = Number(_av.qty) > 0;
        stockChip = '<span class="cbcat-stock" data-testid="shop-stock" style="display:inline-block;margin-top:2px;font-size:11px;font-weight:700;padding:1px 7px;border-radius:9px;white-space:nowrap;' + (_in ? 'background:#e8f5ec;color:#1d6b3a' : 'background:#fdecec;color:#a33') + (_mins > 240 ? ';opacity:.7' : '') + '">' + (_in ? 'in stock ' + esc(String(_av.qty)) : 'out of stock') + ' · as of ' + esc(_age) + '</span>';
      }
    } catch (e) { stockChip = ''; }

    return '<div class="cbcat-row' + (q ? ' on' : '') + (r.variant ? ' cbcat-var' : '') + '"'
      + ' data-testid="cbcat-row-' + esc(id) + '">'
      + media
      + '<span class="cbcat-meat"><span class="cbcat-nm">' + esc(name) + '</span>'
      + '<span class="cbcat-sub">' + esc(d.unit || '')
      + (hint ? (d.unit ? ' · ' : '') + '<span class="cbcat-hint">' + esc(hint) + '</span>' : '') + '</span>' + (offBadge ? '<span class="cbcat-offs">' + offBadge + '</span>' : '') + (stockChip ? '<span class="cbcat-offs">' + stockChip + '</span>' : '')
      /* ⭐ THE HOST'S OWN LINE UNDER THE ROW (2026-09-05, the storefront joining this renderer): the stock stamp, the media
         gallery — whatever a surface adds that the row itself does not know. Rendered from the item, never trusted to
         change the price. */
      + (function () { try { var x = (opts && opts.rowExtra) || (cart.__cbcatOpts && cart.__cbcatOpts.rowExtra); return (typeof x === 'function') ? (x(r.item, r) || '') : ''; } catch (e) { return ''; } })()
      + '</span>'
      + '<span class="cbcat-pr">' + price + taxChip + lineTotal + '</span>'
      + '<span class="cbcat-ctl">' + ctlHTML(cart, r) + '</span>'
      + '</div>';
  }

  function groupHTML(cart, r, i) {
    return '<div class="cbcat-grp"><b>' + esc(r.label) + '</b>'
      + '<span class="cbcat-cnt">' + r.count + ' options</span>'
      + '<span class="cbcat-all" onclick="CBCart.group(\'' + esc(cart.ns) + '\',' + i + ')">add all</span></div>';
  }

  /**
   * ⭐⭐ THE LIST IS WINDOWED — Athi, 2026-08-15: *"you can load max of 25 to 50 line item at once and you keep
   * loading the rest according to the swipe"*.
   *
   * A catalogue of 56 rows is 3,008px of DOM built on every single repaint — and a repaint happens on every `+`,
   * every `−`, every keystroke in the search box. A real wholesale catalogue is not 56 rows, it is thousands,
   * and at that size the stepper would visibly lag behind the finger pressing it.
   *
   * So: `pageSize` rows (40), then a sentinel at the bottom. When the sentinel comes into view the window grows
   * and the list repaints. This is the standing on-demand rule applied to the list itself — never pre-load, and
   * build only what someone is actually looking at.
   *
   * ⚠️ THE WINDOW RESETS WHEN THE QUERY CHANGES. Without that, searching after scrolling deep would render the
   * first 200 rows of a 3-row result — mostly nothing — and the reset has to happen HERE, because search goes
   * straight through CBCart.search to paintList and never passes through the picker.
   *
   * ⚠️ `content-visibility:auto` on the row is NOT a substitute. That skips PAINT for off-screen rows; this
   * skips BUILDING them. The first costs layout, the second costs string concatenation and innerHTML on every
   * keystroke — and only the second is what makes a large catalogue feel slow.
   */
  function windowOf(cart, opts, total) {
    var st = CBCAT.win[cart.ns] || (CBCAT.win[cart.ns] = { shown: 0, q: null });
    var q = (cart.state() || {}).q || '';
    var page = Number(opts.pageSize) || 40;
    if (st.q !== q) { st.q = q; st.shown = page; }        // a new query starts at the top, always
    if (!st.shown) st.shown = page;
    return { shown: Math.min(st.shown, total), page: page, more: st.shown < total, total: total };
  }
  function growWindow(ns) {
    var st = CBCAT.win[ns]; if (!st) return;
    st.shown += (st.page || 40);
    if (root.CBCart && root.CBCart.paintList) root.CBCart.paintList(ns);
  }

  function listHTML(cart, opts) {
    /* ⚠️⚠️ THE LIST IS ALSO AN ENTRY POINT, AND ONLY IT WAS MISSING THIS. skeletonHTML and pickerHTML both
       inject the stylesheet; listHTML did not, because every screen that existed when it was written reached
       the rows THROUGH pickerHTML. The first screen to paint a bare list — Record a sale — rendered perfect
       markup with no CSS at all: .cbcat-meat fell back to display:inline and the name, unit and price ran
       together as "Sugar, 1kgpiece₹52". Every render entry injects its own styles, or the one that forgets
       stays invisible until some screen takes the unusual door. */
    ensureCss();
    var rows = cart.rows() || [];
    if (!rows.length) {
      /**
       * ⭐⭐ TWO DIFFERENT NOTHINGS, AND THEY NEEDED DIFFERENT SENTENCES. Athi, 2026-08-22, looking at a
       * supplier whose catalogue would not appear: the screen said *"Nothing in their catalogue matches that"*
       * **with an empty search box**. He was told his search was too narrow when he had not searched, so the
       * real state — this supplier has nothing you can order — never reached him, and he went looking for a
       * broken connection instead.
       *
       * ⚠️ The distinction is not cosmetic: one sentence says CHANGE YOUR QUERY, the other says ASK THEM TO
       * PUBLISH. Sending someone to the wrong one costs them the afternoon.
       *
       * ⚠️ And a catalogue can be non-empty and still show nothing here: the server DROPS every item with no
       * price (`unpriced_hidden` in the payload) — so when it says items were hidden, say that instead of
       * implying the supplier has listed nothing at all.
       */
      var q = (typeof cart.queryText === 'function' ? cart.queryText() : '') || '';
      var msg;
      if (q) msg = opts.empty || 'Nothing matches that.';
      else if (opts.hiddenCount > 0) {
        msg = opts.emptyHidden
          ? opts.emptyHidden.replace('{n}', opts.hiddenCount)
          : opts.hiddenCount + ' item(s) here have no price yet, so none can be ordered.';
      } else msg = opts.emptyAll || opts.empty || 'Nothing to order here yet.';
      return '<div class="cbcat-empty">' + esc(msg) + '</div>';
    }
    var w = windowOf(cart, opts, rows.length);
    var out = '';
    for (var i = 0; i < w.shown; i++) {
      out += rows[i].type === 'product' ? groupHTML(cart, rows[i], i) : rowHTML(cart, rows[i], opts);
    }
    if (w.more) {
      /* The sentinel says how many are left, so a long catalogue is honest about its size rather than just
         ending. observe() wires it to grow the window when it is scrolled to. */
      out += '<div class="cbcat-more" data-cbcat-more="' + esc(cart.ns) + '" data-testid="cbcat-more">'
        + '<span class="cbcat-spin"></span>' + (w.total - w.shown) + ' more</div>';
    }
    return out;
  }

  /**
   * ⭐ THE SKELETON — what the catalogue looks like while it is still arriving.
   *
   * Athi: *"instead of another different page, show loading catalogue page and then load the item"*. Before this
   * the cold path replaced the whole step with the words "Loading your catalogue…" for 2.2 SECONDS (measured),
   * and then swapped in a completely different screen. Two different layouts for one action.
   *
   * Now the same layout appears immediately — search box in its place, rows in theirs — and the rows fill in.
   * Nothing moves when the data lands, which is the entire point: a person can start reading, and aim at the
   * search box, before the first row exists.
   */
  function skeletonHTML(opts) {
    opts = opts || {};
    ensureCss();
    var n = Number(opts.rows) || 8, out = '';
    for (var i = 0; i < n; i++) {
      out += '<div class="cbcat-row cbcat-skelrow">'
        + '<span class="cbcat-thumb cbcat-skel"></span>'
        + '<span class="cbcat-meat"><span class="cbcat-skelbar" style="width:' + (44 + (i * 7) % 38) + '%"></span>'
        + '<span class="cbcat-skelbar cbcat-skelbar-sm" style="width:18%"></span></span>'
        + '<span class="cbcat-pr"><span class="cbcat-skelbar" style="width:70%"></span></span>'
        + '<span class="cbcat-ctl"><span class="cbcat-skeldot"></span></span>'
        + '</div>';
    }
    return '<div class="cbcat-wrap">'
      + '<div class="cbcat-hdr">'
      +   '<input class="cbcat-q" disabled placeholder="' + esc(opts.placeholder || 'Search this catalogue…') + '">'
      + '</div>'
      + '<div class="cbcat-list" aria-busy="true">' + out + '</div>'
      + '</div>';
  }

  /**
   * ⭐ THE COMMIT STRIP — the fix for the trap.
   *
   * It exists ONLY while something is staged, and it says the thing nothing on screen said before: these lines
   * are not on the chit yet. The two-stage model is right and stays — amending a chit is not the same as ticking
   * a box, and collapsing them would make the consequential act invisible. What was wrong was the silence.
   */
  function commitHTML(cart, opts) {
    var n = cart.lines(), T = cart.total();
    if (!n) return '';
    var amt = T && T.amount ? money(cart.ns, T.amount) + (T.partial ? '+' : '') : '';
    return '<div class="cbcat-commit" data-testid="cbcat-commit-' + esc(cart.ns) + '">'
      + '<span><b>' + n + ' line' + (n === 1 ? '' : 's') + '</b> ready'
      + (amt ? ' · ' + esc(amt) : '') + ' — <b>not on the chit yet</b></span>'
      + '<button type="button" data-testid="cbcat-checkout-' + esc(cart.ns) + '"'
      + ' onclick="CBCart.checkout(\'' + esc(cart.ns) + '\')">'
      + esc(opts.checkoutLabel || 'Add to the chit') + '</button></div>';
  }

  /**
   * ⭐ THE ON-THE-CHIT BLOCK — the fix for "3,198px below the fold".
   *
   * The host passes what is already committed; this renders it ABOVE the list, where the eye already is. It is
   * ADDITIVE and never reorders the list beneath the hand that is adding to it — the existing code deliberately
   * fixes lines-first vs picker-first once per entry to the step, and that restraint is correct.
   */
  /**
   * ⭐⭐ OFFERS, EVALUATED AT ORDER TIME — the last unwired piece of the arc.
   *
   * `offers.js` has been pure and proven (27/0) and called by nothing. This is where it gets called: over the
   * lines that are actually ON the chit, not over the staging cart.
   *
   * ⚠️ THE CART STAGES; THE ORDER IS WHAT AN OFFER APPLIES TO. Evaluating the cart would show a discount against
   * a basket nobody has committed, and it would move every time a quantity is nudged — a number that flickers is
   * a number nobody trusts. The offer is a statement about the obligation being created.
   *
   * ⚠️ EVERY ADJUSTMENT AND EVERY *SKIPPED* OFFER IS RENDERED. `evaluate()` returns `notes` (the shortfalls —
   * "₹300 more needed") and `skipped` (expired, wrong region, no line qualifies). Showing only what applied
   * would hide the two most useful things a person can be told: what they nearly had, and why an offer they
   * expected did not fire.
   */
  /**
   * ⚠️ THE COMMENT ABOVE SAID SKIPPED OFFERS WERE RENDERED AND THEY WERE NOT — only adjustments and notes were.
   * They are now, behind `opt.skipped`, and the flag is the honest part: a cart holds every LIVE offer the entity
   * has, so most of them are skipped as "no line qualifies" on any given basket and listing all of them would
   * bury the two that fired. The PRODUCT page turns it on, because there the offers are the ones attached to
   * that one product and "why did this one not apply" is the entire question being asked.
   *
   * ⚠️ `ev` MAY BE SUPPLIED (opt.ev). The product preview has already evaluated — running it a second time here
   * would be a second answer to the same question, computed from a line built twice.
   */
  function offersHTML(ns, lines, offers, sym, opt) {
    if (!offers || !offers.length || !root.CBOffers) return '';
    opt = opt || {};
    var ev = opt.ev || null;
    try {
      if (!ev) ev = root.CBOffers.evaluate({
        lines: lines.map(function (l, i) {
          return { key: String(i), item_id: l.item_id, sku: l.sku, category: l.category, excluded: l.excluded || l.offers_excluded || [],
                   qty: Number(l.qty || l.quantity || 0), unitPrice: Number(l.price || 0) };
        }),
        offers: offers,
        money: function (n) { return money(ns, n); }
      });
    } catch (e) {
      /* ⚠️ A PRICING ENGINE THAT THROWS MUST NOT TAKE THE ORDER DOWN. The lines and their prices are already
         correct without it; an offer failing to evaluate costs a discount, not the ability to order. */
      return '<div class="cbcat-offnote">Offers could not be applied just now — the prices above stand.</div>';
    }
    /* ⚠️ `opt.subtotal` KEEPS THE BLOCK EVEN WHEN NOTHING FIRED. On the product page "at qty 1 this offer changes
       nothing" IS the outcome being verified, and an empty space there reads as a screen that failed to load. */
    if (!ev.adjustments.length && !ev.notes.length && !(opt.skipped && ev.skipped.length) && !opt.subtotal) return '';

    /* ⭐ A SHEET, NOT PROSE — Athi, 2026-09-05: "difficult to read … show like an excel sheet: listed price, then the
       discount name, percentage in the next cell, the amount in the next cell, one by one". Three columns everywhere:
       the step · the detail · the amount. The tax footer under it uses the same cells, so the two read as one sheet. */
    /* ⭐ THE MONEY TABLE — the designer's spec, 2026-09-04, after Athi: "the alignment has to be very precise … I was
       spending quite some time to understand". TWO columns: Detail (auto) and Amount (fixed 11ch, right-aligned,
       tabular numerals) so every amount's last character sits on one x. A note ("not yet — ₹4,000 more needed") is a
       small grey second line INSIDE Detail, never in the Amount column. No header row — a header implies three
       independently aligned columns, which was the bug. One rule above After offers, a heavier one above After tax.
       The tax rows ride in the SAME table (opt.tailRows) so the whole computation reads top to bottom. */
    var neg = function (n) { return '\u2212\u2009' + money(ns, Math.abs(n)); };
    var tr = function (cls, label, sub, amt, opts) {
      opts = opts || {};
      return '<tr class="cbm-row ' + cls + '"' + (opts.testid ? ' data-testid="' + esc(opts.testid) + '"' : '') + (opts.attrs || '') + '>'
        + '<td class="cbm-l">' + label + (sub ? '<span class="cbm-sub">' + sub + '</span>' : '') + '</td>'
        + '<td class="cbm-a"><bdi>' + (amt == null ? '' : amt) + '</bdi></td></tr>';
    };
    var rows = ev.adjustments.map(function (a) {
      return tr('cbm-offer', esc(a.label), esc(a.why || ''), Number(a.amount) < 0 ? esc(neg(a.amount)) : esc(money(ns, a.amount)));
    }).join('');
    var notes = ev.notes.map(function (nte) {
      return tr('cbm-note', esc(nte.label), esc(nte.why || ''), '');
    }).join('');
    var skipped = (opt.skipped ? ev.skipped : []).map(function (s) {
      return tr('cbm-note', esc(s.label || s.offer_id), esc(tx('not applied — ') + (s.why || '')), '');
    }).join('');
    return '<div class="cbcat-offers" data-testid="' + esc(opt.testid || 'cbcat-offers') + '">'
      + '<div class="cbcat-offhd">' + esc(opt.head || tx('How this price was calculated')) + '</div>'
      + '<table class="cb-money"><colgroup><col><col style="width:11ch"></colgroup><tbody>'
      + (opt.subtotal ? tr('cbm-list', esc(tx('Listed price')), '', esc(money(ns, ev.subtotal))) : '')
      + rows + notes + skipped
      + (ev.adjustments.length || opt.subtotal
          ? tr('cbm-tot', esc(tx('After offers')), '', '<span data-testid="' + esc(opt.totalTestid || 'cbcat-offtot') + '">' + esc(money(ns, ev.total)) + '</span>')
          : '')
      + (opt.tailRows || '')
      + '</tbody></table></div>';
  }

  function committedHTML(ns, lines, noteFn, attachFn, chips, offers) {
    if (!lines || !lines.length) return '';
    return '<div class="cbcat-onchit" data-testid="cbcat-onchit">'
      + '<div class="cbcat-onchit-t">On the chit · ' + lines.length + ' line' + (lines.length === 1 ? '' : 's') + '</div>'
      + lines.map(function (l, i) {
          var q = Number(l.qty || l.quantity || 0), p = Number(l.price || 0);
          /**
           * ⭐⭐ THE CUSTOM MESSAGE — Athi: *"we should add provision to pass custom message like what we get in
           * whatsapp"*.
           *
           * This is not a new field. `comment` has ridden on a line since intake: lib/capture.js maps it from a
           * WhatsApp order, the amend card edits it, and it is what carries "last time not fresh — please send
           * new stock". What was missing was any way to WRITE one when you author a chit yourself, and any way
           * to send it if you had — the send path enumerated four fields and comment was not among them.
           *
           * It belongs HERE, on the committed line, and not in the cart: the cart stages quantities, and a note
           * is a statement about an obligation that now exists. Placed under the line it is about, so there is
           * never a question which line it refers to.
           */
          var note = noteFn
            ? '<input class="cbcat-note" value="' + esc(l.comment || '') + '"'
              + ' data-testid="cbcat-note-' + i + '"'
              + ' placeholder="add a message for this line — e.g. fresh stock please"'
              + ' oninput="' + esc(noteFn) + '(' + i + ',this.value)">'
            : (l.comment ? '<div class="cbcat-noteread">' + esc(l.comment) + '</div>' : '');
          /**
           * ⭐ A PICTURE ON THE LINE — Athi: *"on the cart data we can add message, picture, attachment etc"*.
           *
           * ⚠️ THIS SURFACES MACHINERY THAT ALREADY EXISTED RATHER THAN ADDING A SECOND ONE. compose has staged
           * per-line files since before this redesign — `CC.items[i].files`, ccAddItemFiles, ccItemChips, and the
           * upload loop that runs once the chit is created. The control was in `cc_items`, the block that renders
           * BELOW the whole catalogue — the same 3,198px problem the on-the-chit block exists to fix. So the
           * feature was not missing, it was unreachable.
           *
           * ⚠️ The files are held, not uploaded: a cart line has no chit to attach to yet, and asking the server
           * to pin bytes to something that does not exist is how a row ends up referencing nothing.
           */
          var att = (attachFn ? '<label class="cbcat-clip" title="Attach a picture or file to this line">📎'
              + '<input type="file" multiple style="display:none"'
              + ' onchange="' + esc(attachFn) + '(' + i + ',this.files);this.value=\'\'"></label>' : '')
            + (typeof chips === 'function' ? '<span class="cbcat-chips">' + (chips(i) || '') + '</span>' : '');
          return '<div class="cbcat-liwrap">'
            + '<div class="cbcat-li"><span class="cbcat-li-n">' + esc(l.particulars || l.name || 'item') + '</span>'
            + '<span class="cbcat-li-q">' + esc(q) + ' ' + esc(l.unit || '') + '</span>'
            + '<span class="cbcat-li-p">' + esc(money(ns, q * p)) + '</span></div>'
            + note + (att ? '<div class="cbcat-attrow">' + att + '</div>' : '') + '</div>';
        }).join('')
      /* ⭐ The offer breakdown, under the lines it applies to. ⚠️ My first wiring of this matched an identical
         `+ '</div>';` earlier in the file and landed in the wrong function — the engine ran, returned two
         adjustments, and nothing rendered. An anchored replace on a repeated string is not an anchor. */
      + offersHTML(ns, lines, offers)
      + '</div>';
  }

  /* ── the whole picker ────────────────────────────────────────────────────────────────────────────────────── */
  /**
   * ⚠️⚠️ THE ELEMENT IDS ARE THE CART'S, NOT OURS. `barEl` and `listEl` come from the screen's CBCart.create()
   * options — `cbpick_cc`, `cbpick_sup`, `cbpick_net`, `cbcartbar_*` — because those are exactly what
   * CBCart.paintList/paintBar address when anything changes, and what the harness asserts.
   *
   * My first version invented `cbcatlist_<ns>` instead. Everything rendered correctly and the bug was invisible
   * until you typed: `search()` → `paintList()` → an element id nobody rendered → the search box quietly stopped
   * filtering. The cap-network harness went 5 FAILED and named it. An id is a contract, not a detail.
   */
  /**
   * The categories a product cites. ⚠️ READ LOCALLY, NOT FROM core.js — `catgIdsOf` lives there and core.js is
   * NOT loaded by shop.html, so reaching for it would work in the signed-in app and throw on the public
   * storefront: exactly the split-surface break this renderer exists to prevent. Two lines, kept honest by the
   * same rule core.js uses — an array of ids, with the retired single-key form still read and never written.
   */
  function catgIds(d) {
    var x = d || {};
    var ids = Array.isArray(x.categories) ? x.categories.map(String).filter(Boolean) : (x.category ? [String(x.category)] : []);
    /* ⭐ WITH THEIR ANCESTORS when the signed-in app is around (core.js catgWithAncestors) — an offer on the parent
       category reaches the child, as tax does. The public storefront has no core.js and keeps the exact ids until the
       tree ships in its payload (backlog). Athi, 2026-09-05: the product page said "via category" while its own
       basket said "no line qualifies" — two readers of one product disagreeing. */
    return (typeof root.catgWithAncestors === 'function') ? root.catgWithAncestors(ids) : ids;
  }

  /**
   * ⭐ THE PREDICATE cart-ui ASKS FOR. It knows quantities and totals, not validity windows and targeting — so it
   * holds the FLAG and this supplies the JUDGEMENT, from the same CBOffers.forLine the badge is printed from. One
   * test, so a row can never be hidden by a filter that disagrees with its own badge.
   */
  function isOnOffer(row, opts) {
    try {
      var offs = (opts && opts.offers) || [];
      if (!offs.length || !root.CBOffers || !root.CBOffers.onOffer) return true;
      var d = dataOf(row) || {};
      return root.CBOffers.onOffer(
        { item_id: row.item_id, sku: d.sku, categories: catgIds(d), unitPrice: Number(d.price && d.price.amount != null ? d.price.amount : d.price) || 0 },
        offs, { now: new Date() });
    } catch (e) { return true; }   /* a failing filter must never empty a catalogue */
  }

  function idsOf(cart, opts) {
    return {
      bar:  opts.barEl  || 'cbcartbar_' + cart.ns,
      list: opts.listEl || 'cbpick_' + cart.ns
    };
  }

  /* The two entry points CBCart's renderer hook calls. They paint INTO the element it already owns, so there is
     one repaint path rather than two competing ones. */
  /**
   * ⚠️⚠️ CREATE-TIME OPTIONS FIRST, RENDER-TIME OPTIONS ON TOP — and this order is a bug fix, not a preference.
   *
   * Stashing the renderer's options on the handle in pickerHTML leaves a WINDOW: anything that repaints before
   * the picker has rendered once gets `{}`. On 2026-08-15 that put an inert grey cart permanently in compose's
   * modal title bar — `hideEmptyChip` had not been stashed yet when the first paintBar ran, and nothing ever
   * repainted it while the cart was still empty. A control that never does anything, parked where the eye checks
   * first.
   *
   * The screen's CBCart.create() options are available from the moment the cart exists, so they are the floor.
   * That makes rendering independent of WHEN it happens, which is the only way to be sure with three hosts that
   * each paint differently.
   */
  function optsFor(cart) {
    var made = (cart.state() || {}).opts || {};
    var o = {}, k;
    for (k in made) o[k] = made[k];
    var late = cart.__cbcatOpts || {};
    for (k in late) o[k] = late[k];
    return o;
  }
  function listInto(el, cart) {
    el.innerHTML = listHTML(cart, optsFor(cart));
    observe(el);
  }
  function barInto(el, cart) {
    el.innerHTML = chipHTML(cart, optsFor(cart));
  }

  function pickerHTML(cart, opts) {
    opts = opts || {};
    /* ⚠️ Stashed on the handle so the renderer hook (which is called with only the handle) paints with the SAME
       options the screen chose — otherwise a repaint after pressing + would silently drop the checkout label,
       the empty text and the placeholder, and the row would change under the hand that touched it. */
    cart.__cbcatOpts = opts;
    var ids = idsOf(cart, opts), barId = ids.bar, listId = ids.list;
    ensureCss();
    /**
     * ⚠️ A SIDE EFFECT IN A RENDER FUNCTION, AND WHY THIS ONE IS SAFE.
     *
     * The images come back with `data-src` and no `src`; something must observe them AFTER the HTML lands in the
     * DOM. Three hosts paint this string in three different ways (a modal body, a re-rendered panel, a step
     * body), so requiring each to remember `CBCatUI.observe()` afterwards guarantees one of them forgets and
     * that catalogue silently shows grey boxes forever.
     *
     * cart-ui learned the hard way that side effects belong nowhere near a renderer — a `setCatalogue()` here
     * would repaint → sync → repaint forever. The difference is that `observe()` only sets `img.src`: it touches
     * no cart state, fires no onChange, and is idempotent, so it cannot loop. Scheduled on a timeout so it runs
     * after the caller has inserted the string, whenever and however it does that.
     */
    if (typeof setTimeout === 'function') setTimeout(function () { observe(); }, 0);
    return '<div class="cbcat-wrap" data-testid="cbcat-' + esc(cart.ns) + '">'
      + committedHTML(cart.ns, opts.committed, opts.noteFn, opts.attachFn, opts.chips, opts.offers)
      + '<div class="cbcat-hdr">'
      /**
       * ⚠️⚠️ `cart:false` MEANS THE HOST ALREADY OWNS AN ELEMENT WITH THIS ID — DO NOT RENDER A SECOND ONE.
       *
       * Compose puts the chip slot in the modal title bar beside the ✕, and that slot carries `cbcartbar_cc`.
       * When this branch was dropped during the id refactor, the row rendered its own slot with the SAME id:
       * two elements, one id, and `getElementById` returns whichever comes first — so `paintBar` updated one
       * chip and left the other frozen at whatever it said when the modal opened. Two carts on screen
       * disagreeing about what is in the cart, which is precisely the thing this whole helper exists to prevent.
       */
      +   (opts.cart === false ? ''
          : '<span id="' + esc(barId) + '" class="cbcat-chipslot">' + chipHTML(cart, opts) + '</span>')
      +   '<input class="cbcat-q" placeholder="' + esc(opts.placeholder || 'Search this catalogue…') + '"'
      +   ' value="' + esc((cart.state() || {}).q || '') + '"'
      +   (opts.searchTestid ? ' data-testid="' + esc(opts.searchTestid) + '"' : '')
      +   ' oninput="CBCart.search(\'' + esc(cart.ns) + '\', this.value)">'
      /**
       * ⭐⭐ THE CATEGORY STRIP — DELEGATED, NOT COPIED (Athi, 2026-08-16: *"can we add a category to the
       * product?"*, and the strip was missing from the one surface he uses).
       *
       * ⚠️ I BUILT THIS INTO cart-ui's pickerHTML AND STOPPED, on the reasoning that a renderer swaps the LIST
       * and the BAR but never the search chrome above them. That is false, and this function is the proof: the
       * redesigned renderer has its own pickerHTML and replaces the chrome wholesale. Compose uses this one, so
       * the strip was invisible on the busiest order surface in the product.
       *
       * ⚠️ guard-static check 5 CAUGHT THIS AND I OVERRODE IT. It failed on `pick-catg` missing from this file;
       * I added it to OK_TO_OMIT with the wrong justification. The guard was right. The entry is now removed so
       * it can never be waved through again — if you are about to add a hook to one picker and not the other,
       * that failure is the whole point.
       *
       * The markup and the counting live in CBCart (catgsHTML/catgTally), so there is ONE definition of what a
       * category chip is; this file only decides where it sits.
       */
      /**
       * ⭐⭐ "ON OFFER" SITS WITH THE CATEGORY CHIPS, because it answers the same kind of question — narrow this
       * list to what I care about. Athi, 2026-09-02: *"do we have options to filter based on offers, discount?"*
       *
       * ⚠️ IT ONLY APPEARS WHEN THERE IS SOMETHING TO FILTER. A dead "On offer" chip on a catalogue with no
       * offers teaches that the feature is broken rather than that the shop is not running one — the same rule
       * the category strip already follows by rendering nothing until a category exists.
       *
       * ⚠️ AND IT NARROWS BY THE SAME TEST THE BADGE USES (CBOffers.forLine), so a row can never be hidden by a
       * filter that disagrees with the badge printed on it.
       */
      +   (((opts.offers || []).length && root.CBOffers) ?
            '<button type="button" class="cbcat-chip cbcat-offchip' + ((cart.state() || {}).onlyOffers ? ' on' : '') + '"'
          + ' data-testid="pick-onoffer" onclick="CBCart.onlyOffers(\'' + esc(cart.ns) + '\')">'
          + '🏷️ ' + esc('On offer') + '</button>' : '')
      +   '<div id="' + esc(listId) + '_catg" class="cbpick-catgs">'
      +     (typeof CBCart.categoriesHTML === 'function' ? CBCart.categoriesHTML(cart.ns) : '')
      +   '</div>'
      + '</div>'
      + '<div id="' + esc(listId) + '" class="cbcat-list"'
      +   (opts.listTestid ? ' data-testid="' + esc(opts.listTestid) + '"' : '') + '>'
      +   listHTML(cart, opts)
      + '</div>'
      + commitHTML(cart, opts)
      + '</div>';
  }

  function chipHTML(cart, opts) {
    var n = cart.lines(), T = cart.total();
    /**
     * ⚠️ THE CART IS ALWAYS ON SCREEN NOW — Athi: *"couldnt find cart symbol in the screen on top, it has to
     * open as a overlay"*.
     *
     * I had hidden it while empty, reasoning that an inert grey cart in the title bar is a control that never
     * does anything. That was wrong for the reason that matters more: a cart you cannot SEE is a cart you cannot
     * learn the position of, and someone hunting for it mid-order does not care that it would have appeared
     * eventually. A permanent, quiet target beats a helpful absence.
     *
     * `hideEmptyChip`/`barHideEmpty` still work for a host that genuinely wants it gone; compose no longer sets
     * either. Empty, it is dimmed and inert — the overlay has nothing to show and opening it would be a dead end.
     */
    if (!n && (opts.hideEmptyChip || opts.barHideEmpty)) return '';
    /**
     * ⚠️ `cbcart-bar` AND `cart-count-<ns>` ARE CARRIED OVER DELIBERATELY. They are published hooks —
     * render-smoke.spec.js clicks the class, order-steps.spec.js asserts the badge — and this chip IS the cart
     * bar, restyled. Dropping the names because the markup is new is how a spec goes quietly green against
     * nothing; the cap-network harness caught exactly that here and said so.
     */
    return '<button type="button" class="cbcart-bar cbcat-chip' + (n ? ' on' : '') + '"'
      + ' data-testid="cart-' + esc(cart.ns) + '"'
      + (n ? ' onclick="CBCart.open(\'' + esc(cart.ns) + '\')"' : ' disabled')
      + ' title="' + esc(n ? 'Open the cart' : (opts.emptyHint || 'Press + on what you need')) + '">'
      + '<span class="cbcat-bag">🛒' + (n ? '<span class="cbcat-n" data-testid="cart-count-' + esc(cart.ns) + '">' + n + '</span>' : '') + '</span>'
      + (n && T.amount ? '<span class="cbcat-sum">' + esc(money(cart.ns, T.amount)) + '</span>' : '')
      + '</button>';
  }

  /* ── lazy media ──────────────────────────────────────────────────────────────────────────────────────────── */
  /**
   * ⭐ ADOPTED, NOT INVENTED: IntersectionObserver + native loading="lazy". A browser primitive beats a library
   * here on every axis that matters — zero bytes, zero dependencies, and the artifact/storefront CSP blocks
   * external hosts anyway. The standing rule is on-demand always: never pre-load, and media only on click.
   *
   * 120px rootMargin so a thumbnail is decoded just before it is looked at rather than as it appears.
   */
  function observe(rootEl) {
    if (typeof IntersectionObserver === 'undefined') {
      /* No observer (old browser): fall back to eager, because a catalogue with invisible pictures is worse than
         a catalogue that loaded them. `loading="lazy"` still applies where supported. */
      (rootEl || document).querySelectorAll('img[data-src]').forEach(function (im) {
        im.src = im.getAttribute('data-src'); im.removeAttribute('data-src');
        if (im.parentElement) im.parentElement.classList.remove('cbcat-skel');
      });
      return;
    }
    if (!CBCAT.io) {
      CBCAT.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var im = e.target, src = im.getAttribute('data-src');
          if (src) { im.src = src; im.removeAttribute('data-src'); }
          if (im.parentElement) im.parentElement.classList.remove('cbcat-skel');
          CBCAT.io.unobserve(im);
        });
      }, { rootMargin: '120px' });
    }
    (rootEl || document).querySelectorAll('img[data-src]').forEach(function (im) { CBCAT.io.observe(im); });
    observeMore(rootEl);
  }

  /**
   * The "N more" sentinel. Scrolling to it grows the window — the swipe IS the trigger, no button to press.
   *
   * ⚠️ NO OBSERVER, NO PAGING — so the sentinel is also a CLICK target. If IntersectionObserver is missing, or
   * the list is in a container the observer cannot see into, a person must still be able to reach row 41. A
   * lazy list with no manual escape is a list with rows nobody can get to.
   */
  /**
   * The image failed. Turn its box back into the letter tile rather than leaving a blank.
   *
   * ⚠️ The <img> is REMOVED, not hidden — a broken img left in the DOM keeps its alt box and its own failed
   * layout, and some browsers draw a placeholder glyph over the tile behind it.
   */
  function fellBack(img, bg, letter) {
    var box = img && img.parentElement; if (!box) return;
    img.remove();
    box.className = 'cbcat-thumb cbcat-tile';
    box.style.background = bg;
    box.textContent = letter;
  }

  function observeMore(rootEl) {
    var sentinels = (rootEl || document).querySelectorAll('[data-cbcat-more]');
    if (!sentinels.length) return;
    if (typeof IntersectionObserver === 'undefined') return;   // the onclick below still works
    if (!CBCAT.moreIo) {
      CBCAT.moreIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var ns = e.target.getAttribute('data-cbcat-more');
          CBCAT.moreIo.unobserve(e.target);
          if (ns) growWindow(ns);
        });
      }, { rootMargin: '300px' });   // grow BEFORE the bottom is reached, so the list never visibly stops
    }
    sentinels.forEach(function (s) {
      s.onclick = function () { growWindow(s.getAttribute('data-cbcat-more')); };
      CBCAT.moreIo.observe(s);
    });
  }

  function paint(cart, opts, hostId) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = pickerHTML(cart, opts);
    observe(host);
  }

  /* ── styles, injected once ───────────────────────────────────────────────────────────────────────────────── */
  function ensureCss() {
    if (typeof document === 'undefined' || document.getElementById('cbcat_css')) return;
    var s = document.createElement('style');
    s.id = 'cbcat_css';
    s.textContent = [
      /* ⚠️ top:-11px, not 0 — a sticky offset is measured from the scroll container's PADDING edge, and every
         host here pads its scroller (.mbody is 11px 12px). At top:0 the list scrolls through the gap ABOVE the
         header and the rows draw over the cart. --cbcat-gap so a host with different padding can set it. */
      ':root{--cbcat-gap:11px}',
      '.cbcat-hdr{position:sticky;top:calc(-1 * var(--cbcat-gap));z-index:6;background:var(--card);',
      'padding:var(--cbcat-gap) 0 7px;display:flex;align-items:center;gap:8px}',
      '.cbcat-q{flex:1 1 auto;min-width:0;height:40px;border:1px solid var(--line,var(--line));border-radius:9px;',
      'padding:0 12px;font-size:var(--fs-3);font-family:inherit;background:var(--card);color:var(--ink,var(--ink))}',
      '.cbcat-chipslot{flex:0 0 auto}',
      '.cbcat-chip{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 11px;border-radius:9px;',
      'border:1px solid var(--line,var(--line));background:var(--neutral-tint);white-space:nowrap;font-size:var(--fs-2);font-weight:800;',
      'color:var(--ink,var(--ink));cursor:pointer;font-family:inherit}',
      '.cbcat-chip:disabled{cursor:default;opacity:.75}',
      '.cbcat-chip.on{background:var(--blue,var(--blue));border-color:var(--blue,var(--blue));color:#fff}',
      /* margin-right clears the badge, which is absolutely positioned 9px past the bag's right edge — without it
         the count sits on top of the total and both become unreadable at a glance. */
      '.cbcat-bag{position:relative;font-size:17px;line-height:1;margin-inline-end:6px}',
      '.cbcat-sum{font-variant-numeric:tabular-nums}',
      /* 11px, the legibility floor. The count is the one fact the chip must carry on a phone. */
      '.cbcat-n{position:absolute;top:-7px;inset-inline-end:-9px;background:var(--card);color:var(--blue,var(--blue));border-radius:9px;',
      'min-width:18px;height:18px;padding:0 4px;font-size:var(--fs-1);font-weight:800;line-height:18px;text-align:center}',
      /* ⚠️ Below 520px the MONEY yields, never the badge and never the search box. How many are in the cart is
         the fact you cannot lose; the total is one tap away inside the cart itself. */
      '@media(max-width:520px){.cbcat-sum{display:none}.cbcat-chip{padding:0 9px;gap:5px}}',

      /* ⭐ content-visibility: the list is 3,008px tall today and most of it is never looked at. This skips
         layout and paint for off-screen rows; contain-intrinsic-size keeps the scrollbar honest. */
      '.cbcat-row{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px dashed var(--line);',
      'content-visibility:auto;contain-intrinsic-size:auto 58px}',
      '.cbcat-row.on{background:var(--soft,#eef4ff)}',
      '.cbcat-var .cbcat-nm{padding-inline-start:16px}',
      '.cbcat-thumb{flex:none;width:52px;height:52px;border-radius:9px;background:var(--warn-tint);',
      'border:1px solid var(--line,var(--line));overflow:hidden;position:relative;display:grid;place-items:center}',
      '.cbcat-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
      /* The letter tile. White on a derived mid-tone hue — see tileFor for why the colour is a hash and not a
         random pick, and why the yellow-green band is darkened. */
      /* ⚠️ NORMAL WEIGHT, not 800 — Athi: "keep the letter normal, bold letter not looking ok". He is right: the
         tile is a quiet recognition aid sitting beside the product NAME, and a heavy letter competes with the
         name for the same glance. The colour already does the identifying work; the letter only has to confirm
         it. */
      '.cbcat-tile{color:#fff;font-weight:400;font-size:var(--fs-5);line-height:1;letter-spacing:.02em;',
      'font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;user-select:none}',
      '.cbcat-nomedia{font-size:var(--fs-4);opacity:.4}',
      '.cbcat-play{position:absolute;inset:0;display:grid;place-items:center;background:rgba(15,46,61,.34);',
      'color:#fff;font-size:var(--fs-3)}',
      '.cbcat-skel{background:linear-gradient(100deg,#ECE7DE 30%,#f6f2ea 50%,#ECE7DE 70%);background-size:220% 100%;',
      'animation:cbcatsk 1.1s linear infinite}',
      '@keyframes cbcatsk{to{background-position:-120% 0}}',
      '@media(prefers-reduced-motion:reduce){.cbcat-skel{animation:none}}',
      '.cbcat-meat{flex:1;min-width:0;display:block}',
      '.cbcat-nm{display:block;font-weight:700;font-size:var(--fs-3)}',
      '.cbcat-sub{display:block;font-size:var(--fs-1);color:var(--grey-2);margin-top:1px}',
      '.cbcat-hint{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1)}',
      /* ⚠️ TOKENS, NOT LITERALS — the badge has to read on both themes, and theme-literals.cjs enforces it.
         --gold-soft/--gold-line already carry "worth noticing, not an error" everywhere else in the app. */
      '.cbcat-offs{display:inline-flex;flex-wrap:wrap;gap:4px;margin-inline-start:7px;vertical-align:middle}',
      '.cbcat-off{display:inline-block;padding:1px 7px;border-radius:999px;font-size:var(--fs-1);font-weight:700;',
      'background:var(--gold-soft);border:1px solid var(--gold-line);color:var(--warn-3);white-space:nowrap}',
      /* ⚠️ FIXED COLUMNS, or the price column zig-zags. Measured: ₹340 at x=740 and ₹149 at x=628 before this. */
      '.cbcat-pr{flex:none;min-width:78px;text-align:end;font-weight:700;font-size:var(--fs-3);',
      'font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.cbcat-was{opacity:.55;font-weight:400;font-size:var(--fs-1)}',
      '.cbcat-noprice{color:var(--grey-2);font-weight:400;font-size:var(--fs-2)}',
      '.cbcat-linetotal{font-size:var(--fs-1);color:var(--grey-2);font-weight:800}',
      '.cbcat-ctl{flex:none;min-width:104px;display:flex;align-items:center;justify-content:flex-end;gap:6px}',
      '.cbcat-stp{display:inline-flex;align-items:center;gap:5px}',
      '.cbcat-stp button,.cbcat-add{width:30px;height:30px;border-radius:50%;border:1px solid var(--blue,var(--blue));',
      'background:var(--card);color:var(--blue,var(--blue));font-size:15px;font-weight:800;line-height:1;display:grid;',
      'place-items:center;cursor:pointer;font-family:inherit;flex:none}',
      '.cbcat-add{background:var(--blue,var(--blue));color:#fff}',
      '.cbcat-stp input{width:52px;height:30px;border:1px solid var(--line,var(--line));border-radius:9px;',
      'text-align:center;font-size:var(--fs-2);font-variant-numeric:tabular-nums;font-family:inherit}',
      /* Sits INSIDE the price column, so it must not widen it — hence the same 78px the column is. */
      '.cbcat-offer{display:block;width:100%;height:28px;border:1px solid var(--blue,var(--blue));border-radius:6px;',
      'padding:0 7px;font-size:var(--fs-2);text-align:end;font-family:inherit;margin-top:2px;',
      'font-variant-numeric:tabular-nums}',
      '.cbcat-pick{border:1px solid var(--line,var(--line));background:var(--card);border-radius:9px;padding:7px 13px;',
      'font-size:var(--fs-2);font-weight:700;color:var(--ink,var(--ink));cursor:pointer;font-family:inherit;',
      'white-space:nowrap}',
      '.cbcat-pick.on{background:var(--blue,var(--blue));border-color:var(--blue,var(--blue));color:#fff}',
      '.cbcat-grp{padding:11px 2px 3px;display:flex;align-items:center;gap:9px;font-size:var(--fs-2)}',
      '.cbcat-cnt{font-size:var(--fs-1);color:var(--grey-2)}',
      '.cbcat-all{font-size:var(--fs-1);color:var(--blue,var(--blue));font-weight:700;cursor:pointer;margin-inline-start:auto}',
      '.cbcat-empty{padding:30px 8px;color:var(--grey-2);font-size:var(--fs-3);text-align:center}',
      /* the window sentinel */
      '.cbcat-more{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 8px;',
      'color:var(--grey-2);font-size:var(--fs-2);cursor:pointer}',
      '.cbcat-spin{width:12px;height:12px;border:2px solid #d7d2c8;border-top-color:var(--grey-4);border-radius:50%;',
      'display:inline-block;animation:cbcatspin .7s linear infinite}',
      '@keyframes cbcatspin{to{transform:rotate(360deg)}}',
      '@media(prefers-reduced-motion:reduce){.cbcat-spin{animation:none}}',
      /* the skeleton — the same row shape, so nothing moves when the real data lands */
      '.cbcat-skelrow{pointer-events:none}',
      '.cbcat-skelbar{display:block;height:11px;border-radius:5px;margin:3px 0;',
      'background:linear-gradient(100deg,#ECE7DE 30%,#f6f2ea 50%,#ECE7DE 70%);background-size:220% 100%;',
      'animation:cbcatsk 1.1s linear infinite}',
      '.cbcat-skelbar-sm{height:8px;opacity:.7}',
      '.cbcat-skeldot{display:inline-block;width:30px;height:30px;border-radius:50%;background:var(--warn-tint)}',
      '@media(prefers-reduced-motion:reduce){.cbcat-skelbar{animation:none}}',

      /**
       * ⚠️⚠️ STICKY AT THE BOTTOM — because the first version reproduced the very bug it exists to fix.
       *
       * The strip renders after the list, and the list is 3,000px tall. So the one control that says "these
       * lines are not on the chit yet" sat three thousand pixels below the thing you were reading — the exact
       * below-the-fold failure the on-the-chit block was added to solve, recreated one element later. Visible on
       * screen within a minute of wiring it: two items added, chip counting, and no commit strip anywhere.
       *
       * Pinned to the bottom of the scroll area it is always in view while you pick, which is when it matters.
       */
      '.cbcat-commit{position:sticky;bottom:0;z-index:6;display:flex;align-items:center;gap:10px;',
      'padding:10px 12px;margin-top:8px;',
      'background:var(--gold-soft,var(--gold-soft));border:1px solid var(--gold-line,var(--gold-line));border-radius:9px;',
      'font-size:var(--fs-2);color:var(--warn-3);box-shadow:0 -6px 12px -10px rgba(15,46,61,.45)}',
      '.cbcat-commit b{color:var(--ink,var(--ink))}',
      '.cbcat-commit button{margin-inline-start:auto;background:var(--blue,var(--blue));color:#fff;',
      'border:1px solid var(--blue,var(--blue));border-radius:9px;padding:9px 15px;font-weight:700;font-size:var(--fs-2);',
      'white-space:nowrap;cursor:pointer;font-family:inherit}',

      '.cbcat-onchit{padding:10px 12px;margin-bottom:9px;background:var(--blue-tint-bg);border:1px solid #d8e4f3;',
      'border-radius:9px}',
      '.cbcat-onchit-t{font-weight:800;font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.05em;',
      'color:var(--blue-d,var(--blue-d));margin-bottom:5px}',
      '.cbcat-li{display:flex;gap:8px;padding:3px 0;font-size:var(--fs-2)}',
      '.cbcat-li-n{flex:1;min-width:0}',
      '.cbcat-li-q,.cbcat-li-p{font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.cbcat-offers{margin-top:8px;padding-top:8px;border-top:1px dashed #d8e4f3}',
      '.cbcat-offhd{font-size:var(--fs-1);font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--ok-2);margin-bottom:4px}',
      '.cbcat-offrow{display:flex;align-items:baseline;gap:8px;padding:2px 0;font-size:var(--fs-2)}',
      '.cbcat-offrow.note{color:var(--warn-2)}',
      '.cbcat-offrow.skip{color:var(--grey,#7C8085)}',
      '.cbcat-offrow.skip .cbcat-offn{font-weight:600;text-decoration:line-through}',
      '.cbcat-offa.plain{color:var(--ink);font-weight:600}',
      '.cbcat-offn{font-weight:700;flex:none}',
      '.cbcat-offw{flex:1;min-width:0;color:var(--grey,#7C8085);font-size:var(--fs-1)}',
      '.cbcat-offa{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ok-2);white-space:nowrap}',
      '.cbcat-offtot{display:flex;justify-content:space-between;font-size:var(--fs-2);font-weight:800;padding-top:5px;margin-top:4px;border-top:1px solid #d8e4f3;font-variant-numeric:tabular-nums}',
      '.cbcat-offnote{font-size:var(--fs-1);color:var(--warn-2);padding:6px 0 2px}',
      '.cbcat-li-p{font-weight:700}',
      '.cbcat-liwrap{padding:2px 0}',
      '.cbcat-note{display:block;width:100%;box-sizing:border-box;margin:3px 0 5px;padding:6px 9px;',
      'border:1px dashed #c3d3e8;border-radius:9px;font-size:var(--fs-2);font-family:inherit;background:var(--card);',
      'color:var(--ink,var(--ink))}',
      '.cbcat-note:focus{border-style:solid;border-color:var(--blue,var(--blue));outline:none}',
      '.cbcat-noteread{font-size:var(--fs-2);color:#4a6b8a;padding:1px 0 4px}',
      '.cbcat-attrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 0 4px}',
      '.cbcat-clip{cursor:pointer;border:1px solid var(--line,var(--line));border-radius:9px;padding:3px 8px;',
      'font-size:var(--fs-2);background:var(--card);flex:none;line-height:1.4}',
      '.cbcat-clip:hover{border-color:var(--blue,var(--blue))}',
      '.cbcat-chips{display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  root.CBCatUI = {
    /* listInto/barInto ARE the renderer-hook contract cart-ui looks for — see rendererOf() there. */
    listInto: listInto, barInto: barInto,
    pickerHTML: pickerHTML, listHTML: listHTML, rowHTML: rowHTML,
    /* the cart bar (the chip) for a host that paints its own shell — the storefront's first paint (2026-09-05) */
    barHTML: function (cart, opts) { return chipHTML(cart, opts || optsFor(cart)); },
    isOnOffer: isOnOffer,
    /* ⭐ THE BREAKDOWN RENDERER, EXPORTED. The product page shows what the cart will do with the offers attached
       to a product, and a lookalike built there would be a second opinion about the same price — which is the one
       thing "verify it then and there" cannot survive. */
    offersHTML: offersHTML,
    commitHTML: commitHTML, committedHTML: committedHTML, chipHTML: chipHTML,
    paint: paint, observe: observe, ensureCss: ensureCss,
    mediaOf: mediaOf, tileFor: tileFor, hintOf: hintOf,
    skeletonHTML: skeletonHTML, growWindow: growWindow, fellBack: fellBack
  };
})(typeof window !== 'undefined' ? window : this);
