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
    return (o && typeof o === 'object') ? o : {};
  }
  function modelOf(ns, r) {
    var o = declOf(ns, r);
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
    return { amount: priceOf(r), offered: false, asking: priceOf(r) };
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
        return { item_id: r.item_id, item: r.item, qty: q, name: nameOf(r),
                 unit: d.unit || 'unit', price: d.price, code: d.code || d.sku || null,
                 // The price that COUNTS for this line, and the line's own total — computed once, here, so no
                 // screen has to decide again whether an offer beats the catalogue.
                 unit_price: u.amount, asking_price: u.asking, offered: u.offered,
                 line_total: isFinite(u.amount) ? u.amount * q : null,
                 // The MODEL travels with the line, so what was agreed can be read back later — a '4' means
                 // something different on a pack of 12 than on a metre of cable.
                 model: o.model || 'count',
                 offer: (s.offers && s.offers[r.item_id]) != null ? s.offers[r.item_id] : null };
      });
  }

  /* ── the visible rows ────────────────────────────────────────────────────────────────────────────────────── */
  function rows(ns) {
    var s = C[ns]; if (!s) return [];
    var all = rowsOf(s.cat), q = (s.q || '').trim().toLowerCase();
    if (!q) return all;                       // the list is ALWAYS the full list — the cart is a popup, not a filter
    var out = [], pend = null, took = false;
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (r.type === 'product') { pend = r; took = false; continue; }
      var hay = (nameOf(r) + ' ' + (dataOf(r).unit || '') + ' ' + (dataOf(r).code || '')).toLowerCase();
      if (hay.indexOf(q) === -1) continue;
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
    var v = m.coerce(raw, o);
    if (v > 0) s.sel[id] = v; else delete s.sel[id];
    touched(ns);
  }
  function step(ns, id, dir) {
    var s = C[ns]; if (!s) return;
    var r = rowById(ns, id), o = declOf(ns, r), m = modelOf(ns, r);
    put(ns, id, m.next(s.sel[id] || 0, dir, o));
  }
  function add(ns, id) { step(ns, id, +1); }
  function dec(ns, id) { step(ns, id, -1); }
  function setQty(ns, id, v) { put(ns, id, v); }
  /** The buyer's offer on an `offer` line. Kept apart from quantity — it is a different fact about the same line. */
  function setOffer(ns, id, v) {
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
  function sym(ns) { return opt(ns, 'symbol', '₹'); }
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
  function fmt(ns, n) {
    return sym(ns) + (opt(ns, 'groupDigits', false)
      ? Number(n).toLocaleString(opt(ns, 'locale', 'en-IN'))
      : String(n));
  }
  function accent(ns) { return opt(ns, 'accent', '#3F66A6'); }
  function soft(ns) { return opt(ns, 'soft', '#eef4ff'); }

  /** The bar. THE WHOLE BAR OPENS THE CART — bag, count and summary alike; a 12px link is not a tap target. */
  function barHTML(ns) {
    var n = lines(ns), u = units(ns), T = total(ns), on = n > 0, a = accent(ns);
    return '<div class="cbcart-bar" data-testid="cart-' + esc(ns) + '"' + (on ? ' onclick="CBCart.open(\'' + esc(ns) + '\')"' : '')
      + ' style="position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;margin:11px 0 9px;padding:10px 12px;'
      + 'border-radius:11px;border:1px solid ' + (on ? a : '#e3e6ea') + ';background:' + (on ? soft(ns) : '#f7f8fa') + ';'
      + (on ? 'cursor:pointer' : '') + '">'
      + '<span style="position:relative;font-size:19px;line-height:1">🛒'
      + (on ? '<span data-testid="cart-count-' + esc(ns) + '" style="position:absolute;top:-6px;right:-9px;background:' + a
            + ';color:#fff;border-radius:9px;min-width:18px;height:18px;padding:0 4px;font-size:11px;font-weight:800;'
            + 'line-height:18px;text-align:center">' + u + '</span>' : '')
      + '</span>'
      + '<span style="font-size:13px;font-weight:800">'
      + (on ? (n + ' line' + (n === 1 ? '' : 's') + ' · ' + u + ' unit' + (u === 1 ? '' : 's')
               + (T.amount ? ' · ' + fmt(ns, T.amount) + (T.partial ? '+' : '') : ''))
            : '<span style="font-weight:400;color:#6a707a">' + esc(opt(ns, 'emptyHint', 'Press + on what you need')) + '</span>')
      + '</span>'
      + (on ? '<span style="font-size:11.5px;color:' + a + ';font-weight:700">View cart ›</span>' : '')
      + (on ? '<span onclick="event.stopPropagation();CBCart.clear(\'' + esc(ns) + '\')" style="cursor:pointer;font-size:11.5px;color:#6a707a">Clear</span>' : '')
      + '</div>'
      + (on && T.partial ? '<div style="color:#8a5a1e;font-size:11.5px;margin:5px 0 0">Some lines have no price — the total covers only the priced ones.</div>' : '');
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
    var rnd = 'border-radius:50%;width:28px;height:28px;flex:none;border:1.5px solid ' + a + ';background:#fff;color:' + a
      + ';font-size:17px;font-weight:700;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center';

    if (o_model === 'pick') {
      return '<button data-testid="cart-add" onclick="event.stopPropagation();CBCart.setQty(\'' + esc(ns) + '\',\'' + esc(id) + '\',' + (q ? 0 : 1) + ')"'
        + ' style="border-radius:20px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;border:1.5px solid ' + a
        + ';background:' + (q ? a : '#fff') + ';color:' + (q ? '#fff' : a) + '">' + (q ? '✓ Added' : 'Add') + '</button>';
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
        + ' style="width:78px;padding:5px;border:1.5px solid ' + (os.value != null && !os.ok ? '#b4453f' : '#e3e6ea')
        + ';border-radius:7px;font-size:13px;text-align:right">';
    }
    return '<span style="display:inline-flex;align-items:center;gap:8px" onclick="event.stopPropagation()">' + off
      + '<button style="' + rnd + '" onclick="CBCart.dec(\'' + esc(ns) + '\',\'' + esc(id) + '\')">−</button>'
      + '<input value="' + esc(String(q)) + '" inputmode="decimal" onchange="CBCart.setQty(\'' + esc(ns) + '\',\'' + esc(id) + '\',this.value)"'
      + ' style="width:52px;padding:5px;border:1px solid #e3e6ea;border-radius:7px;font-size:13px;text-align:center">'
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
      return ' <span style="color:#8a94a3;font-size:11px">· avl —</span>';
    }
    var col = Number(a.qty) > 0 ? '#2c7a43' : '#a5382e';
    if (!a.as_of) return ' <span style="font-size:11px;color:' + col + '">· avl ' + esc(a.qty)
      + '</span><span style="font-size:11px;color:#8a5a1e"> dt ?</span>';
    // Older than the staleness window gets an amber date and a marker — a word would cost a line it does not have.
    var days = (new Date() - new Date(a.as_of)) / 864e5;
    var stale = days > Number(opt(ns, 'staleDays', 14));
    return ' <span style="font-size:11px;color:' + col + '">· avl ' + esc(a.qty) + '</span>'
      + '<span style="font-size:11px;color:' + (stale ? '#8a5a1e' : '#8a94a3') + '"> dt ' + esc(shortDate(a.as_of))
      + (stale ? ' ⚠' : '') + '</span>';
  }
  /** The model's own note under the row — "sold in 12s", "min 5 · max 500". Silent when there is nothing to say. */
  function hintHTML(ns, r) {
    var o = declOf(ns, r), m = modelOf(ns, r), h = m.hint(o);
    if (!h) return '';
    return ' <span style="color:#8a949c;font-size:11px">· ' + esc(h) + '</span>';
  }

  function listHTML(ns) {
    var s = C[ns]; if (!s) return '';
    var rs = rows(ns), a = accent(ns);
    if (!rs.length) {
      return '<div style="padding:34px 8px;color:#6a707a;font-size:13.5px;text-align:center">'
        + esc(s.q ? 'Nothing matches that.' : opt(ns, 'noCatalogue', 'Nothing published yet.')) + '</div>';
    }
    return rs.map(function (r, i) {
      if (r.type === 'product') {
        var ids = [];
        for (var k = i + 1; k < rs.length && rs[k].type === 'line' && rs[k].gid === r.gid; k++) ids.push(rs[k].item_id);
        var inCart = ids.filter(function (id) { return s.sel[id]; }).length;
        return '<div style="padding:10px 2px 3px;display:flex;align-items:center;gap:8px">'
          + '<b style="font-size:13.5px">' + esc(r.label) + '</b>'
          + '<span style="font-size:11px;color:#6a707a">' + r.count + ' options</span>'
          + (inCart ? '<span style="font-size:11px;color:' + a + ';font-weight:700">' + inCart + ' in cart</span>' : '')
          + '<span onclick="CBCart.group(\'' + esc(ns) + '\',' + i + ')" style="cursor:pointer;font-size:11px;color:' + a + '">'
          + (inCart === ids.length && ids.length ? 'clear all' : 'add all') + '</span>'
          + (r.options ? '<span style="font-size:11px;color:#6a707a;margin-left:auto">' + esc(r.options) + '</span>' : '')
          + '</div>';
      }
      var d = dataOf(r), q = qtyOf(ns, r.item_id), u = unitPrice(ns, r), p = u.amount;
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 2px 8px ' + (r.variant ? '20px' : '2px')
        + ';border-bottom:1px dashed #e3e6ea;' + (q ? 'background:' + soft(ns) : '') + '">'
        + '<span style="flex:1"><b style="font-size:13.5px">' + esc(r.variant || d.name || d.product || 'item') + '</b>'
        + (d.unit ? ' <span style="color:#6a707a;font-size:11.5px">' + esc(d.unit) + '</span>' : '')
        + '<div style="font-size:12px;color:#6a707a;margin-top:1px">'
        // An offer REPLACES the asking price in the maths, so it must replace it on screen too — with the asking
        // price still shown, struck through, because hiding what they asked for is its own dishonesty.
        + (u.offered
            ? '<span style="text-decoration:line-through;opacity:.55">' + esc(fmt(ns, u.asking)) + '</span> '
              + '<b style="color:#1d2530">' + esc(fmt(ns, p)) + '</b> <span style="font-size:11px">your offer</span>'
            : (isFinite(p) ? esc(fmt(ns, p)) : 'no price'))
        // The line's own total, only once there is a quantity to multiply by — a price × 1 restated is noise.
        + (q && isFinite(p) ? ' <span style="color:#1d2530;font-weight:800">· ' + esc(fmt(ns, p * q)) + '</span>' : '')
        + hintHTML(ns, r) + availHTML(ns, r)
        + '</div></span>' + stepperHTML(ns, r.item_id, q) + '</div>';
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
    var btn = 'flex:1;height:40px;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer;border:1.5px solid ' + a;
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
      + '<b style="font-size:17px;flex:1">🛒 ' + esc(opt(ns, 'cartTitle', 'Your cart')) + '</b>'
      + '<button onclick="CBCart.close(\'' + esc(ns) + '\')" style="border:0;background:none;font-size:22px;color:#8a949c;cursor:pointer">×</button></div>'
      + '<div style="font-size:12px;color:#6a707a;margin-bottom:10px">'
      + (opt(ns, 'from') ? 'from <b>' + esc(opt(ns, 'from')) + '</b> · ' : '')
      + sel.length + ' line' + (sel.length === 1 ? '' : 's') + ' · ' + units(ns) + ' units</div>'
      + (sel.length
        ? sel.map(function (l) {
            var p = l.unit_price;
            return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed #e3e6ea">'
              + '<span style="flex:1"><b style="font-size:13.5px">' + esc(l.name) + '</b>'
              + ' <span style="color:#6a707a;font-size:11.5px">' + esc(l.unit) + '</span>'
              + '<div style="font-size:12px;color:#6a707a">'
              + (l.offered ? '<span style="text-decoration:line-through;opacity:.55">' + esc(fmt(ns, l.asking_price)) + '</span> ' : '')
              + (isFinite(p) ? esc(fmt(ns, p)) : 'no price') + (l.offered ? ' <span style="font-size:11px">your offer</span>' : '')
              + (isFinite(p) ? ' <span style="color:#1d2530;font-weight:800">· ' + esc(fmt(ns, p * l.qty)) + '</span>' : '') + '</div></span>'
              + stepperHTML(ns, l.item_id, l.qty)
              + '<span onclick="CBCart.setQty(\'' + esc(ns) + '\',\'' + esc(l.item_id) + '\',0)" title="remove"'
              + ' style="cursor:pointer;color:#9aa3a7;font-weight:800;padding:0 3px">×</span></div>';
          }).join('')
          + '<div style="display:flex;padding:11px 2px;border-top:2px solid #e3e6ea;font-size:14px;font-weight:800">'
          + '<span style="flex:1">' + (T.offered ? 'Total at your offer' : 'Total') + '</span>'
          + '<span>' + (T.amount ? esc(fmt(ns, T.amount)) + (T.partial ? '+' : '') : '—') + '</span></div>'
          + (T.partial ? '<div style="color:#8a5a1e;font-size:11.5px">Some lines have no price — the total covers only the priced ones.</div>' : '')
        // Emptying the cart from inside it must not leave someone facing a blank box with no way back.
        : '<div style="padding:26px 8px;color:#6a707a;font-size:13.5px;text-align:center">Nothing in the cart yet.</div>')
      + '<div style="display:flex;gap:9px;margin-top:15px">'
      + '<button style="' + btn + ';background:#fff;color:' + a + '" onclick="CBCart.close(\'' + esc(ns) + '\')">'
      + (sel.length ? 'Keep shopping' : 'Browse the catalogue') + '</button>'
      + (sel.length ? '<button data-testid="cart-checkout" style="' + btn + ';background:' + a + ';color:#fff"'
          + ' onclick="CBCart.checkout(\'' + esc(ns) + '\')">' + esc(opt(ns, 'checkoutLabel', 'Check out →')) + '</button>' : '')
      + '</div>';
  }

  function checkout(ns) {
    close(ns);
    var fn = opt(ns, 'onCheckout');
    if (typeof fn === 'function') fn(selected(ns), total(ns));
  }

  /* ── painting. Each piece repaints on its own, deliberately. ─────────────────────────────────────────────── */
  function paintList(ns) { var el = doc(opt(ns, 'listEl')); if (el) el.innerHTML = listHTML(ns); }
  function paintBar(ns) { var el = doc(opt(ns, 'barEl')); if (el) el.innerHTML = barHTML(ns); }
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

  root.CBCart = {
    init: init, state: st, rows: rows, selected: selected,
    lines: lines, units: units, total: total, qtyOf: qtyOf, unitPrice: unitPrice,
    add: add, dec: dec, setQty: setQty, setOffer: setOffer, offerState: offerState,
    group: group, clear: clear, search: search, addAdhoc: addAdhoc, models: MODELS,
    open: open, close: close, checkout: checkout,
    barHTML: barHTML, listHTML: listHTML, popupHTML: popupHTML,
    paint: paint, paintList: paintList, paintBar: paintBar, paintPopup: paintPopup
  };
  /**
   * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
   *  COMPATIBILITY — the cbPick* names, as thin adapters. ONE implementation underneath.
   * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
   *
   * Athi, 2026-08-09: *"now you can integrate."*
   *
   * The live screens already call a picker I wrote a day earlier, in catalogue-lines.js and app.html. Rewriting
   * every call site in one pass, on a deployed app, to land a UI change is the kind of big-bang edit that breaks
   * something unrelated at 11pm. So the old names survive here and forward to CBCart.
   *
   * ⚠️ THIS IS NOT A SECOND CART. Every one of these is a forwarder — no state, no rules, no markup of its own.
   * The duplicate implementations they used to point at are DELETED, not left beside these. An adapter that kept
   * its own copy would be the divergence this whole exercise exists to end.
   *
   * They are a migration step and should shrink: as each screen moves to calling CBCart directly, its adapter
   * loses a caller and can go. Five already have — cbPickUnits, cbPickTotal, cbPickToggle, cbPickView and
   * cbPickListHTML were removed on 2026-08-09 once a sweep showed nothing called them. A compat shim with no
   * caller is not compatibility, it is dead weight that reads like a supported API.
   */
  function ids(ns) {
    return { listEl: 'cbpick_' + ns, barEl: 'cbcartbar_' + ns, popupEl: 'cbcart_ov', popupBodyEl: 'cbcart_ovc',
             popupClass: 'cbcart-ov' };
  }
  /** Ensures the ONE popup host exists. Screens never had to declare it, so the adapter creates it on demand. */
  function ensureHost() {
    if (typeof document === 'undefined' || document.getElementById('cbcart_ov')) return;
    var d = document.createElement('div');
    d.id = 'cbcart_ov'; d.className = 'cbcart-ov';
    d.onclick = function (e) { if (e.target === d) { for (var k in C) if (C[k] && C[k].open) close(k); } };
    d.innerHTML = '<div class="cbcart-ovc" id="cbcart_ovc"></div>';
    document.body.appendChild(d);
    if (!document.getElementById('cbcart_css')) {
      var st = document.createElement('style');
      st.id = 'cbcart_css';
      st.textContent = '.cbcart-ov{position:fixed;inset:0;background:rgba(15,22,32,.5);display:none;'
        + 'align-items:center;justify-content:center;padding:14px;z-index:1200}.cbcart-ov.on{display:flex}'
        + '.cbcart-ovc{background:#fff;width:100%;max-width:470px;border-radius:15px;padding:17px 18px 20px;'
        + 'max-height:86vh;overflow:auto}';
      document.head.appendChild(st);
    }
  }
  root.cbPickInit = function (ns, cat, opts) {
    ensureHost();
    var o = {}; for (var k in (opts || {})) o[k] = opts[k];
    var base = ids(ns);
    for (var j in base) if (o[j] === undefined) o[j] = base[j];
    return init(ns, cat, o);
  };
  root.cbPickState = st;
  root.cbPickRows = rows;
  root.cbPickSelected = selected;
  root.cbPickCount = lines;
  root.cbPickQtyOf = qtyOf;
  root.cbPickAdd = add;
  root.cbPickDec = dec;
  root.cbPickSetQty = setQty;
  root.cbPickGroup = group;
  root.cbPickClear = clear;
  root.cbPickSearch = search;
  root.cbPickAddAdhoc = addAdhoc;
  root.cbPickOpen = open;
  root.cbPickClose = close;
  /** The list, with its own search box above it — what the screens used to build by hand. */
  root.cbPickHTML = function (ns, cat, opts) {
    if (cat) root.cbPickInit(ns, cat, opts);
    var s = C[ns]; if (!s) return '';
    return '<input class="inp" style="margin:0 0 7px" placeholder="Search this catalogue…"'
      + ' value="' + esc(s.q || '') + '" data-testid="pick-search-' + esc(ns) + '"'
      + ' oninput="CBCart.search(\'' + esc(ns) + '\', this.value)">'
      // ⚠️ A SCREEN MAY OWN THE TEST ID. variants.spec.js addresses the supplier catalogue as 'sup-catalogue';
      // renaming it to 'pick-sup' as part of a refactor silently removed a documented hook and the spec could no
      // longer find the element at all.  lets the caller keep the name it published.
      + '<div id="' + esc(ids(ns).listEl) + '" data-testid="' + esc(opt(ns, 'testid', 'pick-' + ns)) + '">'
      + listHTML(ns) + '</div>';
  };
  /**
   * The bar. `sendCall` is a handler STRING, which is this codebase's inline-handler idiom, so it is honoured as
   * the checkout action rather than re-plumbed — the adapter's job is to change nothing the caller can see.
   */
  root.cbCartBar = function (ns, sendCall, label) {
    ensureHost();
    var s = C[ns];
    if (s) {
      s.opts = s.opts || {};
      if (label) s.opts.checkoutLabel = label;
      if (sendCall) s.opts.onCheckout = function () { try { (new Function(sendCall))(); } catch (e) { /* caller's handler */ } };
    }
    return '<div id="' + esc(ids(ns).barEl) + '">' + barHTML(ns) + '</div>';
  };
  root.cbPickOnChange = function (ns, fn) { var s = C[ns]; if (s) { s.opts = s.opts || {}; s.opts.onChange = fn; } };
  /**
   * The old repaint entry point. It repaints the list and the bar in place, then lets the screen refresh whatever
   * else depends on the cart — the same split cart-ui uses natively, so a screen's own footer stays in step.
   */
  root.cbPickPaint = function (ns, listOnly) {
    paintList(ns);
    if (!listOnly) { paintBar(ns); var s = C[ns]; if (s && s.opts && typeof s.opts.onChange === 'function') { try { s.opts.onChange(); } catch (e) {} } }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBCart;
})(typeof window !== 'undefined' ? window : globalThis);
