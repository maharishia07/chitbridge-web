/* app/offers.js — OFFERS AS A SUBJECT OF THEIR OWN.  (classic script, shared global scope)
 *
 * Athi, 2026-08-15: *"there are different type of offers run in different industry, some where product range,
 * price range, plus offer, discount above certain amount and so on, if we think offer is a seperate subject, we
 * can keep it as a js and see how we can call it, similarly tax etc."*
 *
 * He is right, and the reason is structural rather than tidiness: an offer is not a property of a cart, it is a
 * TERM OF TRADE. It has an author, a validity window, a jurisdiction, and it must survive into a dispute intact.
 * Baking "10% off above ₹5,000" into cart-ui would make the cart the authority on commercial policy, which it is
 * not — the same mistake as a screen owning a quantity rule.
 *
 * ── ⚠️⚠️ WHAT THIS FILE MUST NEVER DO ────────────────────────────────────────────────────────────────────────────
 * IT NEVER MUTATES A CART, A LINE, OR A PRICE. `evaluate()` is a pure function: catalogue + lines + context in, a
 * BREAKDOWN out. The caller decides what to do with it. That is what lets the same engine run in the cart, on the
 * storefront, in a quote, and again at seal time months later — and get the same answer.
 *
 * ── ⭐ EVERY ADJUSTMENT MUST EXPLAIN ITSELF ──────────────────────────────────────────────────────────────────────
 * This is the CB-specific requirement and it outranks every feature below. Disputes are the product's USP. When
 * someone asks "why was this ₹7,950 and not ₹8,400?" six months later, the answer cannot be "the engine decided".
 * So every adjustment carries: which offer, which rule fired, what the input was, and what it produced. An offer
 * engine that cannot say WHY is unusable here, however clever its arithmetic.
 *
 * ── ⚠️ NEVER APPLY WHAT WAS NOT EARNED, NEVER SILENTLY IMPROVE ───────────────────────────────────────────────────
 * cart-ui's models refuse rather than round up, because quietly ordering more than someone asked for costs them
 * money. The mirror rule here: never apply an offer whose conditions are not met, and never quietly give a better
 * price than the terms state. A surprise discount is a pricing error that happens to be pleasant, and it is still
 * a number nobody can defend in a dispute.
 *
 * ── THE VOCABULARY IS ADOPTED, NOT INVENTED ──────────────────────────────────────────────────────────────────────
 * Scopes (line / cart / shipping), predicate conditions, stacking order and exclusivity, and validity windows are
 * the standard commerce-platform model (commercetools' pricing & promotions capability, Voucherify's promotion
 * taxonomy). Using their words means a person who has run promotions elsewhere already knows what these mean, and
 * a future integration maps rather than translates.
 *
 * ── ⚠️ NOT WIRED. Nothing calls this yet — the same posture as catalogue-ui.js. `CBOffers.evaluate()` is ready;
 * which screen calls it, and whether an offer is frozen at seal, is Athi's decision. See SPEC-offers-tax.md.
 */
(function (root) {
  'use strict';

  var R2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
   *  KINDS — one registry, the way cart-ui registers order models. The CATALOGUE DECLARES, the engine EVALUATES.
   * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
   * Each kind is { scope, apply(ctx) -> [adjustment] }. An adjustment is:
   *   { offer_id, label, kind, scope, target, amount, basis, why }
   * `amount` is always NEGATIVE for a reduction, so a total is a plain sum and nobody has to remember a sign.
   */
  var KINDS = {

    /** % off — the commonest thing in every industry. Scope decides whether it lands on a line or the cart. */
    percent_off: {
      scope: 'either',
      apply: function (o, ctx) {
        var pct = Number(o.percent) || 0;
        if (pct <= 0) return [];
        if (o.scope === 'cart') {
          var base = ctx.eligibleSubtotal;
          if (!base) return [];
          return [adj(o, 'cart', null, -R2(base * pct / 100),
            pct + '% off ' + ctx.money(base) + ' of eligible lines')];
        }
        return ctx.eligible.map(function (l) {
          return adj(o, 'line', l.key, -R2(l.gross * pct / 100),
            pct + '% off ' + ctx.money(l.gross));
        });
      }
    },

    /** A flat amount off. ⚠️ Capped at the base so a discount can never make a total negative. */
    amount_off: {
      scope: 'either',
      apply: function (o, ctx) {
        var amt = Number(o.amount) || 0;
        if (amt <= 0) return [];
        var base = o.scope === 'cart' ? ctx.eligibleSubtotal : null;
        if (o.scope === 'cart') {
          if (!base) return [];
          /* ⚠️ A flat ₹500 off a ₹300 order must not pay the customer ₹200. Capped, and the cap is REPORTED —
             a silently reduced discount is a number the customer cannot reconcile against the advertised offer. */
          var give = Math.min(amt, base);
          return [adj(o, 'cart', null, -R2(give),
            ctx.money(give) + ' off' + (give < amt ? ' (capped at the order value of ' + ctx.money(base) + ')' : ''))];
        }
        return ctx.eligible.map(function (l) {
          var g = Math.min(amt, l.gross);
          return adj(o, 'line', l.key, -R2(g),
            ctx.money(g) + ' off' + (g < amt ? ' (capped at the line value)' : ''));
        });
      }
    },

    /**
     * TIER PRICE — the quantity break. ⚠️ THE PRICE CHANGES, IT IS NOT A DISCOUNT OFF THE LIST PRICE, and the
     * difference matters: a tier is what the seller charges at that volume, so it is the price of record. Modelled
     * as an adjustment anyway so the breakdown shows the movement, with `basis:'price'` marking it as a re-price.
     */
    tier_price: {
      scope: 'line',
      apply: function (o, ctx) {
        var tiers = (o.tiers || []).slice().sort(function (a, b) { return (a.qty || 0) - (b.qty || 0); });
        if (!tiers.length) return [];
        return ctx.eligible.map(function (l) {
          var hit = null;
          for (var i = 0; i < tiers.length; i++) if (l.qty >= (tiers[i].qty || 0)) hit = tiers[i];
          if (!hit || hit.price == null) return null;
          var was = l.unitPrice, now = Number(hit.price);
          if (!(now < was)) return null;          /* ⚠️ never silently RAISE a price from a tier table */
          return adj(o, 'line', l.key, -R2((was - now) * l.qty),
            'qty ' + l.qty + ' reaches the ' + hit.qty + '+ tier · ' + ctx.money(was) + ' → ' + ctx.money(now) + ' each',
            'price');
        }).filter(Boolean);
      }
    },

    /**
     * THRESHOLD — "discount above a certain amount", exactly as Athi described. Spend or quantity, then a reward.
     * ⚠️ Reports the SHORTFALL when it does not fire, because "you are ₹300 away" is the single most useful thing
     * a cart can say, and it is information the engine already has and would otherwise throw away.
     */
    threshold: {
      scope: 'cart',
      apply: function (o, ctx) {
        var need = Number(o.min_amount || o.min_qty) || 0;
        var have = o.min_qty ? ctx.eligibleQty : ctx.eligibleSubtotal;
        var unit = o.min_qty ? '' : '';
        if (have < need) {
          return [note(o, 'not yet — ' + (o.min_qty
            ? (need - have) + ' more item(s) needed'
            : ctx.money(need - have) + ' more needed'), R2(need - have))];
        }
        if (o.percent) {
          return [adj(o, 'cart', null, -R2(ctx.eligibleSubtotal * Number(o.percent) / 100),
            o.percent + '% off — order of ' + ctx.money(have) + ' meets the ' + ctx.money(need) + ' threshold')];
        }
        var amt = Math.min(Number(o.amount) || 0, ctx.eligibleSubtotal);
        return [adj(o, 'cart', null, -R2(amt),
          ctx.money(amt) + ' off — order meets the ' + (o.min_qty ? need + ' item' : ctx.money(need)) + ' threshold')];
      }
    },

    /**
     * BUY X GET Y — "plus offer". Covers BOGO (x=1,y=1,free) and every "buy 3 pay for 2" variant.
     * ⚠️ THE CHEAPEST QUALIFYING UNITS ARE THE FREE ONES. That is the near-universal convention and, more to the
     * point, it is the one that cannot be accused of inflating the discount. Choosing the dearest would be
     * generous, undocumented, and impossible to defend when a counterparty recomputes it.
     */
    buy_x_get_y: {
      scope: 'line',
      apply: function (o, ctx) {
        var x = Number(o.buy) || 0, y = Number(o.get) || 0;
        if (x <= 0 || y <= 0) return [];
        var pct = o.get_percent == null ? 100 : Number(o.get_percent);   // 100 = free
        var pool = ctx.eligible.slice().sort(function (a, b) { return a.unitPrice - b.unitPrice; });
        var totalQty = pool.reduce(function (t, l) { return t + l.qty; }, 0);
        var sets = Math.floor(totalQty / (x + y));
        if (o.max_sets) sets = Math.min(sets, Number(o.max_sets));
        if (sets <= 0) return [];
        var freeUnits = sets * y, out = [];
        for (var i = 0; i < pool.length && freeUnits > 0; i++) {
          var take = Math.min(freeUnits, pool[i].qty);
          out.push(adj(o, 'line', pool[i].key, -R2(pool[i].unitPrice * take * pct / 100),
            take + ' × ' + (pct === 100 ? 'free' : pct + '% off') + ' — buy ' + x + ' get ' + y
            + ' (' + sets + ' set' + (sets === 1 ? '' : 's') + ', cheapest units taken)'));
          freeUnits -= take;
        }
        return out;
      }
    },

    /** SHIPPING — free, flat, or a percentage. Its own scope because it is not part of goods value. */
    shipping: {
      scope: 'shipping',
      apply: function (o, ctx) {
        var ship = Number(ctx.shipping) || 0;
        if (!ship) return [];
        if (o.free) return [adj(o, 'shipping', null, -R2(ship), 'free shipping')];
        if (o.flat != null) {
          var d = ship - Number(o.flat);
          return d > 0 ? [adj(o, 'shipping', null, -R2(d), 'flat shipping at ' + ctx.money(o.flat))] : [];
        }
        if (o.percent) return [adj(o, 'shipping', null, -R2(ship * Number(o.percent) / 100),
          o.percent + '% off shipping')];
        return [];
      }
    },

    /**
     * PRICE RANGE — a declared band rather than a discount. The seller states the floor and ceiling and the agreed
     * price must sit inside it. ⚠️ It produces NO adjustment: it is a CONSTRAINT, and reporting a violation is the
     * whole job. Silently clamping a negotiated price into the band would overwrite what two parties agreed.
     */
    price_range: {
      scope: 'line',
      apply: function (o, ctx) {
        return ctx.eligible.map(function (l) {
          var lo = o.min == null ? -Infinity : Number(o.min);
          var hi = o.max == null ? Infinity : Number(o.max);
          if (l.unitPrice >= lo && l.unitPrice <= hi) return null;
          return note(o, ctx.money(l.unitPrice) + ' is outside the seller’s band '
            + (o.min != null ? ctx.money(o.min) : '—') + '–' + (o.max != null ? ctx.money(o.max) : '—'), 0, l.key);
        }).filter(Boolean);
      }
    }
  };

  function adj(o, scope, target, amount, why, basis) {
    return { offer_id: o.id || null, label: o.label || o.kind, kind: o.kind, scope: scope,
             target: target, amount: amount, basis: basis || 'discount', why: why };
  }
  /* A NOTE is an explanation with no money attached — "you are ₹300 away", "outside the band". It rides in the
     same list so a caller cannot show the adjustments and forget the reasons. */
  function note(o, why, shortfall, target) {
    return { offer_id: o.id || null, label: o.label || o.kind, kind: o.kind, scope: 'note',
             target: target || null, amount: 0, basis: 'note', why: why, shortfall: shortfall || 0 };
  }

  /* ── conditions ─────────────────────────────────────────────────────────────────────────────────────────────
   * ⚠️ A MISSING CONDITION MEANS "NO RESTRICTION", NEVER "FAILS". An offer with no region declared applies in
   * every region; an offer with no window is always live. The opposite default would silently disable every
   * offer written before a field existed — the same rule products.js applies to a missing status.
   */
  function within(o, ctx) {
    var now = ctx.now;
    if (o.valid_from && new Date(o.valid_from) > now) return 'not started (from ' + o.valid_from + ')';
    if (o.valid_to) {
      /* An end DATE means the end OF that day. "valid to 31 Oct" ending at 00:00 on the 31st is the kind of
         off-by-one a customer notices and nobody can defend. */
      var end = new Date(o.valid_to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(o.valid_to))) end.setUTCHours(23, 59, 59, 999);
      if (end < now) return 'expired (' + o.valid_to + ')';
    }
    if (o.region && ctx.region && String(o.region).toLowerCase() !== String(ctx.region).toLowerCase())
      return 'other region (' + o.region + ')';
    if (o.currency && ctx.currency && String(o.currency) !== String(ctx.currency))
      return 'other currency (' + o.currency + ')';
    if (o.customer_group && ctx.customer_group && o.customer_group !== ctx.customer_group)
      return 'other customer group (' + o.customer_group + ')';
    return null;
  }

  /* Which lines an offer touches. No selector = every line. */
  function eligibleFor(o, lines) {
    var s = o.applies_to;
    if (!s) return lines.slice();
    return lines.filter(function (l) {
      if (s.item_ids && s.item_ids.indexOf(l.item_id) < 0) return false;
      if (s.skus && s.skus.indexOf(l.sku) < 0) return false;
      /**
       * ⭐ A LINE HAS MANY CATEGORIES; THE OFFER NAMES ONE. It matches if the line carries that one.
       *
       * ⚠️ This read `l.category` — singular — and no caller has ever emitted that field, so `applies_to.category`
       * matched nothing and every offer using it silently applied to no lines at all. It failed CLOSED, which is
       * why nobody noticed: an offer that never fires looks like an offer nobody triggered.
       *
       * ⚠️ STILL FAILS CLOSED when the line carries no categories. An offer targeted at Grains must not fall
       * back to "applies to everything" on an unclassified product — that is a discount nobody agreed to.
       */
      if (s.category) {
        var lc = l.categories || (l.category ? [l.category] : []);
        if (!lc.length) return false;
        if (lc.map(String).indexOf(String(s.category)) < 0) return false;
      }
      if (s.min_unit_price != null && l.unitPrice < Number(s.min_unit_price)) return false;
      if (s.max_unit_price != null && l.unitPrice > Number(s.max_unit_price)) return false;
      return true;
    });
  }

  /**
   * ⭐ evaluate — the only entry point.
   *
   *   lines   [{ key, item_id, sku, category, qty, unitPrice }]
   *   offers  [{ id, kind, label, scope, priority, exclusive, valid_from, valid_to, region, currency,
   *              customer_group, applies_to:{…}, …kind-specific fields }]
   *   ctx     { now, region, currency, customer_group, shipping, money(fn) }
   *
   * Returns { subtotal, adjustments, notes, skipped, shipping, total, explain }
   *
   * ⚠️ STACKING IS EXPLICIT. Offers run in `priority` order (low first) and an `exclusive` offer that fires stops
   * everything after it. Left implicit, stacking order is decided by array order — which means it is decided by
   * whatever wrote the array, and two screens will disagree about the price of the same basket.
   */
  function evaluate(input) {
    input = input || {};
    var lines = (input.lines || []).map(function (l, i) {
      var qty = Number(l.qty) || 0, up = Number(l.unitPrice) || 0;
      /**
       * ⚠️ THIS NORMALISER IS A WHITELIST, AND THAT IS WHERE THE TARGETING BUG LIVED. It rebuilds each line from
       * named fields, so anything a caller sends that is not listed here is silently dropped before any rule
       * sees it. `categories` was added to cart-ui's line and to eligibleFor, both correct, and the offer still
       * never fired — because the field died in between, with no error and no missing-property anywhere to find.
       *
       * ⭐ A whitelist is right for an engine that has to be deterministic. But it means ADDING A FIELD IS A
       * TWO-PLACE CHANGE, and the second place is invisible from either end. If a rule reads something a line
       * carries, check here first.
       */
      var cats = Array.isArray(l.categories) ? l.categories.map(String)
               : (l.category ? [String(l.category)] : []);
      return { key: l.key == null ? String(i) : l.key, item_id: l.item_id, sku: l.sku,
               category: l.category, categories: cats,
               qty: qty, unitPrice: up, gross: R2(qty * up) };
    });
    var ctx = {
      now: input.now ? new Date(input.now) : new Date(),
      region: input.region, currency: input.currency, customer_group: input.customer_group,
      shipping: Number(input.shipping) || 0,
      /**
       * ⚠️ THE DEFAULT DROPPED THE CURRENCY ENTIRELY — `String(R2(n))` renders 7950 with no symbol, no code and
       * no grouping. catalogue-ui.js injects a real formatter, but the call at the mint (app.html:4439) injects
       * nothing, so that path renders a bare number the moment anyone shows or persists a `why`.
       *
       * ⚠️ A BARE NUMBER IS NOT A NEUTRAL FALLBACK. It invites the reader to assume their own currency, which is
       * the exact assumption the rest of this codebase spends its effort preventing. The default now uses the
       * currency the caller already passed in `input.currency` and formats it through the localisation layer;
       * where even that is absent it says the amount is unlabelled rather than pretending otherwise.
       */
      money: input.money || function (n) {
        var c = input.currency || '';
        if (c && typeof CBLocale !== 'undefined') { try { return CBLocale.money(R2(n), c); } catch (_) {} }
        return c ? (c + ' ' + R2(n)) : (R2(n) + ' (currency not stated)');
      }
    };
    var subtotal = R2(lines.reduce(function (t, l) { return t + l.gross; }, 0));

    var offers = (input.offers || []).slice().sort(function (a, b) {
      return (Number(a.priority) || 0) - (Number(b.priority) || 0);
    });

    var adjustments = [], notes = [], skipped = [], stop = false;
    offers.forEach(function (o) {
      if (stop) { skipped.push({ offer_id: o.id, label: o.label, why: 'an exclusive offer already applied' }); return; }
      var kind = KINDS[o.kind];
      if (!kind) { skipped.push({ offer_id: o.id, label: o.label, why: 'unknown kind: ' + o.kind }); return; }
      var bad = within(o, ctx);
      if (bad) { skipped.push({ offer_id: o.id, label: o.label, why: bad }); return; }

      var elig = eligibleFor(o, lines);
      if (!elig.length) { skipped.push({ offer_id: o.id, label: o.label, why: 'no line qualifies' }); return; }

      var out = kind.apply(o, {
        eligible: elig,
        eligibleSubtotal: R2(elig.reduce(function (t, l) { return t + l.gross; }, 0)),
        eligibleQty: elig.reduce(function (t, l) { return t + l.qty; }, 0),
        shipping: ctx.shipping, money: ctx.money, now: ctx.now
      }) || [];

      var moved = false;
      out.forEach(function (a) {
        if (a.basis === 'note') notes.push(a);
        else { adjustments.push(a); moved = true; }
      });
      if (moved && o.exclusive) stop = true;
    });

    var goods = R2(adjustments.filter(function (a) { return a.scope !== 'shipping'; })
                              .reduce(function (t, a) { return t + a.amount; }, 0));
    var shipAdj = R2(adjustments.filter(function (a) { return a.scope === 'shipping'; })
                                .reduce(function (t, a) { return t + a.amount; }, 0));
    return {
      subtotal: subtotal,
      adjustments: adjustments,
      notes: notes,
      skipped: skipped,
      goods_adjustment: goods,
      shipping: R2(ctx.shipping + shipAdj),
      /* ⚠️ Never below zero. Adjustments are capped individually, but stacking several could still overshoot, and
         a negative total is not a refund — it is a bug that looks like one. */
      total: Math.max(0, R2(subtotal + goods + ctx.shipping + shipAdj)),
      /* ⭐ THE AUDIT TRAIL. Every applied offer, every rejected one, and the reason for both — this is what makes
         a price defensible six months later, and it is why `skipped` is returned rather than discarded. */
      explain: adjustments.map(function (a) { return a.label + ': ' + a.why; })
        .concat(notes.map(function (n) { return n.label + ' — ' + n.why; }))
        .concat(skipped.map(function (s) { return (s.label || s.offer_id) + ' not applied — ' + s.why; }))
    };
  }

  root.CBOffers = { evaluate: evaluate, KINDS: KINDS, kinds: Object.keys(KINDS) };
})(typeof window !== 'undefined' ? window : this);
