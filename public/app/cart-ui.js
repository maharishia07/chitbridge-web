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
          + '<div style="display:flex;padding:11px 2px;border-top:2px solid var(--line);font-size:var(--fs-3);font-weight:800">'
          + '<span style="flex:1">' + (T.offered ? 'Total at your offer' : 'Total') + '</span>'
          + '<span>' + (T.amount ? esc(fmt(ns, T.amount)) + (T.partial ? '+' : '') : '—') + '</span></div>'
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

  root.CBCart = {
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
