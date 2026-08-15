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
 *   CBCatalogue.pickerHTML(cart, opts)   the sticky header, the rows, the commit strip, the on-the-chit block
 *   CBCatalogue.paint(cart, opts)        repaint in place
 *   CBCatalogue.observe()                wire lazy media after any paint
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
    var sym = opts.sym || '₹';
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
        + ' onerror="CBCatalogue.fellBack(this,\'' + esc(t.bg) + '\',\'' + esc(t.letter) + '\')">'
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
      ? '<s class="cbcat-was">' + esc(money(cart.ns, u.asking)) + '</s>' + offerInput
      : (offerInput || (isFinite(u.amount) ? esc(money(cart.ns, u.amount)) : '<span class="cbcat-noprice">no price</span>'));
    /* The line total, ONLY once there is a quantity to MULTIPLY by — `q > 1`, not `q`. At quantity 1 it prints
       the same number twice under itself, which is exactly the noise the rule was written to avoid; I had the
       comment right and the condition wrong, and it showed as ₹65 over ₹65 on screen. */
    var lineTotal = (q > 1 && isFinite(u.amount))
      ? '<div class="cbcat-linetotal">' + esc(money(cart.ns, u.amount * q)) + '</div>' : '';

    return '<div class="cbcat-row' + (q ? ' on' : '') + (r.variant ? ' cbcat-var' : '') + '"'
      + ' data-testid="cbcat-row-' + esc(id) + '">'
      + media
      + '<span class="cbcat-meat"><span class="cbcat-nm">' + esc(name) + '</span>'
      + '<span class="cbcat-sub">' + esc(d.unit || '')
      + (hint ? (d.unit ? ' · ' : '') + '<span class="cbcat-hint">' + esc(hint) + '</span>' : '') + '</span></span>'
      + '<span class="cbcat-pr">' + price + lineTotal + '</span>'
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
    var rows = cart.rows() || [];
    if (!rows.length) {
      return '<div class="cbcat-empty">' + esc(opts.empty || 'Nothing matches that.') + '</div>';
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
  function committedHTML(ns, lines, noteFn, attachFn, chips) {
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
     * body), so requiring each to remember `CBCatalogue.observe()` afterwards guarantees one of them forgets and
     * that catalogue silently shows grey boxes forever.
     *
     * cart-ui learned the hard way that side effects belong nowhere near a renderer — a `setCatalogue()` here
     * would repaint → sync → repaint forever. The difference is that `observe()` only sets `img.src`: it touches
     * no cart state, fires no onChange, and is idempotent, so it cannot loop. Scheduled on a timeout so it runs
     * after the caller has inserted the string, whenever and however it does that.
     */
    if (typeof setTimeout === 'function') setTimeout(function () { observe(); }, 0);
    return '<div class="cbcat-wrap" data-testid="cbcat-' + esc(cart.ns) + '">'
      + committedHTML(cart.ns, opts.committed, opts.noteFn, opts.attachFn, opts.chips)
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
      '.cbcat-hdr{position:sticky;top:calc(-1 * var(--cbcat-gap));z-index:6;background:#fff;',
      'padding:var(--cbcat-gap) 0 7px;display:flex;align-items:center;gap:8px}',
      '.cbcat-q{flex:1 1 auto;min-width:0;height:40px;border:1px solid var(--line,#E7E2D8);border-radius:10px;',
      'padding:0 12px;font-size:13.5px;font-family:inherit;background:#fff;color:var(--ink,#0F2E3D)}',
      '.cbcat-chipslot{flex:0 0 auto}',
      '.cbcat-chip{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 11px;border-radius:10px;',
      'border:1px solid var(--line,#E7E2D8);background:#f7f8fa;white-space:nowrap;font-size:12.5px;font-weight:800;',
      'color:var(--ink,#0F2E3D);cursor:pointer;font-family:inherit}',
      '.cbcat-chip:disabled{cursor:default;opacity:.75}',
      '.cbcat-chip.on{background:var(--blue,#3F66A6);border-color:var(--blue,#3F66A6);color:#fff}',
      /* margin-right clears the badge, which is absolutely positioned 9px past the bag's right edge — without it
         the count sits on top of the total and both become unreadable at a glance. */
      '.cbcat-bag{position:relative;font-size:17px;line-height:1;margin-right:6px}',
      '.cbcat-sum{font-variant-numeric:tabular-nums}',
      /* 11px, the legibility floor. The count is the one fact the chip must carry on a phone. */
      '.cbcat-n{position:absolute;top:-7px;right:-9px;background:#fff;color:var(--blue,#3F66A6);border-radius:9px;',
      'min-width:18px;height:18px;padding:0 4px;font-size:11px;font-weight:800;line-height:18px;text-align:center}',
      /* ⚠️ Below 520px the MONEY yields, never the badge and never the search box. How many are in the cart is
         the fact you cannot lose; the total is one tap away inside the cart itself. */
      '@media(max-width:520px){.cbcat-sum{display:none}.cbcat-chip{padding:0 9px;gap:5px}}',

      /* ⭐ content-visibility: the list is 3,008px tall today and most of it is never looked at. This skips
         layout and paint for off-screen rows; contain-intrinsic-size keeps the scrollbar honest. */
      '.cbcat-row{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px dashed #e3e6ea;',
      'content-visibility:auto;contain-intrinsic-size:auto 58px}',
      '.cbcat-row.on{background:var(--soft,#eef4ff)}',
      '.cbcat-var .cbcat-nm{padding-left:16px}',
      '.cbcat-thumb{flex:none;width:52px;height:52px;border-radius:9px;background:#ECE7DE;',
      'border:1px solid var(--line,#E7E2D8);overflow:hidden;position:relative;display:grid;place-items:center}',
      '.cbcat-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
      /* The letter tile. White on a derived mid-tone hue — see tileFor for why the colour is a hash and not a
         random pick, and why the yellow-green band is darkened. */
      /* ⚠️ NORMAL WEIGHT, not 800 — Athi: "keep the letter normal, bold letter not looking ok". He is right: the
         tile is a quiet recognition aid sitting beside the product NAME, and a heavy letter competes with the
         name for the same glance. The colour already does the identifying work; the letter only has to confirm
         it. */
      '.cbcat-tile{color:#fff;font-weight:400;font-size:20px;line-height:1;letter-spacing:.02em;',
      'font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;user-select:none}',
      '.cbcat-nomedia{font-size:17px;opacity:.4}',
      '.cbcat-play{position:absolute;inset:0;display:grid;place-items:center;background:rgba(15,46,61,.34);',
      'color:#fff;font-size:15px}',
      '.cbcat-skel{background:linear-gradient(100deg,#ECE7DE 30%,#f6f2ea 50%,#ECE7DE 70%);background-size:220% 100%;',
      'animation:cbcatsk 1.1s linear infinite}',
      '@keyframes cbcatsk{to{background-position:-120% 0}}',
      '@media(prefers-reduced-motion:reduce){.cbcat-skel{animation:none}}',
      '.cbcat-meat{flex:1;min-width:0;display:block}',
      '.cbcat-nm{display:block;font-weight:700;font-size:13.5px}',
      '.cbcat-sub{display:block;font-size:11.5px;color:#6a707a;margin-top:1px}',
      '.cbcat-hint{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}',
      /* ⚠️ FIXED COLUMNS, or the price column zig-zags. Measured: ₹340 at x=740 and ₹149 at x=628 before this. */
      '.cbcat-pr{flex:none;min-width:78px;text-align:right;font-weight:700;font-size:13.5px;',
      'font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.cbcat-was{opacity:.55;font-weight:400;font-size:11.5px}',
      '.cbcat-noprice{color:#6a707a;font-weight:400;font-size:12px}',
      '.cbcat-linetotal{font-size:11px;color:#6a707a;font-weight:800}',
      '.cbcat-ctl{flex:none;min-width:104px;display:flex;align-items:center;justify-content:flex-end;gap:6px}',
      '.cbcat-stp{display:inline-flex;align-items:center;gap:5px}',
      '.cbcat-stp button,.cbcat-add{width:30px;height:30px;border-radius:50%;border:1px solid var(--blue,#3F66A6);',
      'background:#fff;color:var(--blue,#3F66A6);font-size:15px;font-weight:800;line-height:1;display:grid;',
      'place-items:center;cursor:pointer;font-family:inherit;flex:none}',
      '.cbcat-add{background:var(--blue,#3F66A6);color:#fff}',
      '.cbcat-stp input{width:52px;height:30px;border:1px solid var(--line,#E7E2D8);border-radius:8px;',
      'text-align:center;font-size:13px;font-variant-numeric:tabular-nums;font-family:inherit}',
      /* Sits INSIDE the price column, so it must not widen it — hence the same 78px the column is. */
      '.cbcat-offer{display:block;width:100%;height:28px;border:1px solid var(--blue,#3F66A6);border-radius:7px;',
      'padding:0 7px;font-size:12.5px;text-align:right;font-family:inherit;margin-top:2px;',
      'font-variant-numeric:tabular-nums}',
      '.cbcat-pick{border:1px solid var(--line,#E7E2D8);background:#fff;border-radius:9px;padding:7px 13px;',
      'font-size:12.5px;font-weight:700;color:var(--ink,#0F2E3D);cursor:pointer;font-family:inherit;',
      'white-space:nowrap}',
      '.cbcat-pick.on{background:var(--blue,#3F66A6);border-color:var(--blue,#3F66A6);color:#fff}',
      '.cbcat-grp{padding:11px 2px 3px;display:flex;align-items:center;gap:9px;font-size:13px}',
      '.cbcat-cnt{font-size:11px;color:#6a707a}',
      '.cbcat-all{font-size:11px;color:var(--blue,#3F66A6);font-weight:700;cursor:pointer;margin-left:auto}',
      '.cbcat-empty{padding:30px 8px;color:#6a707a;font-size:13.5px;text-align:center}',
      /* the window sentinel */
      '.cbcat-more{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 8px;',
      'color:#6a707a;font-size:12px;cursor:pointer}',
      '.cbcat-spin{width:12px;height:12px;border:2px solid #d7d2c8;border-top-color:#9aa3a7;border-radius:50%;',
      'display:inline-block;animation:cbcatspin .7s linear infinite}',
      '@keyframes cbcatspin{to{transform:rotate(360deg)}}',
      '@media(prefers-reduced-motion:reduce){.cbcat-spin{animation:none}}',
      /* the skeleton — the same row shape, so nothing moves when the real data lands */
      '.cbcat-skelrow{pointer-events:none}',
      '.cbcat-skelbar{display:block;height:11px;border-radius:5px;margin:3px 0;',
      'background:linear-gradient(100deg,#ECE7DE 30%,#f6f2ea 50%,#ECE7DE 70%);background-size:220% 100%;',
      'animation:cbcatsk 1.1s linear infinite}',
      '.cbcat-skelbar-sm{height:8px;opacity:.7}',
      '.cbcat-skeldot{display:inline-block;width:30px;height:30px;border-radius:50%;background:#ECE7DE}',
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
      'background:var(--gold-soft,#F7F1E4);border:1px solid var(--gold-line,#E8D9BC);border-radius:10px;',
      'font-size:12.5px;color:#6b5a36;box-shadow:0 -6px 12px -10px rgba(15,46,61,.45)}',
      '.cbcat-commit b{color:var(--ink,#0F2E3D)}',
      '.cbcat-commit button{margin-left:auto;background:var(--blue,#3F66A6);color:#fff;',
      'border:1px solid var(--blue,#3F66A6);border-radius:9px;padding:9px 15px;font-weight:700;font-size:13px;',
      'white-space:nowrap;cursor:pointer;font-family:inherit}',

      '.cbcat-onchit{padding:10px 12px;margin-bottom:9px;background:#f4f8fd;border:1px solid #d8e4f3;',
      'border-radius:10px}',
      '.cbcat-onchit-t{font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.05em;',
      'color:var(--blue-d,#345488);margin-bottom:5px}',
      '.cbcat-li{display:flex;gap:8px;padding:3px 0;font-size:12.5px}',
      '.cbcat-li-n{flex:1;min-width:0}',
      '.cbcat-li-q,.cbcat-li-p{font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.cbcat-li-p{font-weight:700}',
      '.cbcat-liwrap{padding:2px 0}',
      '.cbcat-note{display:block;width:100%;box-sizing:border-box;margin:3px 0 5px;padding:6px 9px;',
      'border:1px dashed #c3d3e8;border-radius:8px;font-size:12px;font-family:inherit;background:#fff;',
      'color:var(--ink,#0F2E3D)}',
      '.cbcat-note:focus{border-style:solid;border-color:var(--blue,#3F66A6);outline:none}',
      '.cbcat-noteread{font-size:12px;color:#4a6b8a;padding:1px 0 4px}',
      '.cbcat-attrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 0 4px}',
      '.cbcat-clip{cursor:pointer;border:1px solid var(--line,#E7E2D8);border-radius:8px;padding:3px 8px;',
      'font-size:13px;background:#fff;flex:none;line-height:1.4}',
      '.cbcat-clip:hover{border-color:var(--blue,#3F66A6)}',
      '.cbcat-chips{display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  root.CBCatalogue = {
    /* listInto/barInto ARE the renderer-hook contract cart-ui looks for — see rendererOf() there. */
    listInto: listInto, barInto: barInto,
    pickerHTML: pickerHTML, listHTML: listHTML, rowHTML: rowHTML,
    commitHTML: commitHTML, committedHTML: committedHTML, chipHTML: chipHTML,
    paint: paint, observe: observe, ensureCss: ensureCss,
    mediaOf: mediaOf, tileFor: tileFor, hintOf: hintOf,
    skeletonHTML: skeletonHTML, growWindow: growWindow, fellBack: fellBack
  };
})(typeof window !== 'undefined' ? window : this);
