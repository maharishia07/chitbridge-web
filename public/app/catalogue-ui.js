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
  var CBCAT = { io: null, seq: 0 };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dataOf(r) { return (r && r.item && (r.item.item_data || r.item)) || {}; }
  function money(sym, n) {
    if (n == null || !isFinite(n)) return '';
    return (sym || '₹') + (Math.round(Number(n) * 100) / 100);
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
   * ⭐ THE MEDIA COLUMN IS DECIDED PER CATALOGUE, NOT PER ROW — and this is the one place the drawing and the
   * implementation deliberately differ.
   *
   * A box that appears on some rows and not others makes the list jump as media loads and makes two rows
   * uncomparable, so within a catalogue it must be all-or-nothing. But the product has ZERO images today, so
   * rendering it unconditionally would add 52px of empty grey to every row of every catalogue on all four
   * surfaces, forever, in exchange for nothing. So: if no item in THIS catalogue declares media, no column.
   * The first upload brings it in, for that catalogue only.
   */
  function hasMedia(rows) {
    for (var i = 0; i < rows.length; i++) if (rows[i].type !== 'product' && mediaOf(rows[i])) return true;
    return false;
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
    if (m === 'pick') {
      /* ⚠️ NO STEPPER AT ALL. `pick` is one or none — a second press must not make it two, so there must be no
         control that invites one. The model already refuses it; offering a + that does nothing would be worse. */
      return '<button type="button" class="cbcat-pick' + (q ? ' on' : '') + '" data-testid="cbcat-pick-' + esc(id) + '"'
        + ' onclick="' + (q ? call('setQty', '0') : call('add')) + '">' + (q ? '✓ Added' : 'Add') + '</button>';
    }
    var out = q
      ? '<span class="cbcat-stp"><button type="button" aria-label="less" onclick="' + call('dec') + '">−</button>'
        + '<input value="' + esc(q) + '" inputmode="decimal" aria-label="quantity"'
        + ' onchange="CBCart.setQty(\'' + esc(ns) + '\',\'' + esc(id) + '\',this.value)"></span>'
        + '<button type="button" class="cbcat-add" aria-label="more" onclick="' + call('add') + '">+</button>'
      : '<button type="button" class="cbcat-add" data-testid="cbcat-add-' + esc(id) + '" aria-label="add"'
        + ' onclick="' + call('add') + '">+</button>';
    return out;
  }

  /* ── one row ─────────────────────────────────────────────────────────────────────────────────────────────── */
  function rowHTML(cart, r, opts, withMedia) {
    var d = dataOf(r), id = r.item_id, q = cart.qtyOf(id);
    var u = cart.unitPrice ? cart.unitPrice(r) : { amount: d.price, offered: false, asking: d.price };
    var sym = opts.sym || '₹';
    var name = r.variant || d.name || d.product || 'item';
    var hint = hintOf(r);

    var media = withMedia ? (function () {
      var m = mediaOf(r);
      if (!m) return '<span class="cbcat-thumb"><span class="cbcat-nomedia" title="no photograph">▣</span></span>';
      /* ⭐ data-src, NOT src. The observer fills it when the row nears the viewport. `loading="lazy"` is set too
         as a belt-and-braces for the case where the observer never runs. */
      return '<span class="cbcat-thumb cbcat-skel">'
        + '<img data-src="' + esc(m.src) + '" alt="" loading="lazy" decoding="async">'
        + (m.kind === 'video' ? '<span class="cbcat-play">▶</span>' : '') + '</span>';
    })() : '';

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
      ? '<s class="cbcat-was">' + esc(money(sym, u.asking)) + '</s>' + offerInput
      : (offerInput || (isFinite(u.amount) ? esc(money(sym, u.amount)) : '<span class="cbcat-noprice">no price</span>'));
    /* The line total, ONLY once there is a quantity to multiply by — a price × 1 restated is noise. */
    var lineTotal = (q && isFinite(u.amount))
      ? '<div class="cbcat-linetotal">' + esc(money(sym, u.amount * q)) + '</div>' : '';

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

  function listHTML(cart, opts) {
    var rows = cart.rows() || [];
    if (!rows.length) {
      return '<div class="cbcat-empty">' + esc(opts.empty || 'Nothing matches that.') + '</div>';
    }
    var withMedia = hasMedia(rows);
    var out = '';
    for (var i = 0; i < rows.length; i++) {
      out += rows[i].type === 'product' ? groupHTML(cart, rows[i], i) : rowHTML(cart, rows[i], opts, withMedia);
    }
    return out;
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
    var amt = T && T.amount ? money(opts.sym || '₹', T.amount) + (T.partial ? '+' : '') : '';
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
  function committedHTML(lines, opts) {
    if (!lines || !lines.length) return '';
    var sym = opts.sym || '₹';
    return '<div class="cbcat-onchit" data-testid="cbcat-onchit">'
      + '<div class="cbcat-onchit-t">On the chit · ' + lines.length + ' line' + (lines.length === 1 ? '' : 's') + '</div>'
      + lines.map(function (l) {
          var q = Number(l.qty || l.quantity || 0), p = Number(l.price || 0);
          return '<div class="cbcat-li"><span class="cbcat-li-n">' + esc(l.particulars || l.name || 'item') + '</span>'
            + '<span class="cbcat-li-q">' + esc(q) + ' ' + esc(l.unit || '') + '</span>'
            + '<span class="cbcat-li-p">' + esc(money(sym, q * p)) + '</span></div>';
        }).join('')
      + '</div>';
  }

  /* ── the whole picker ────────────────────────────────────────────────────────────────────────────────────── */
  function pickerHTML(cart, opts) {
    opts = opts || {};
    var barId = 'cbcatbar_' + cart.ns, listId = 'cbcatlist_' + cart.ns;
    ensureCss();
    return '<div class="cbcat-wrap" data-testid="cbcat-' + esc(cart.ns) + '">'
      + committedHTML(opts.committed, opts)
      + '<div class="cbcat-hdr">'
      +   '<span id="' + esc(barId) + '" class="cbcat-chipslot">' + chipHTML(cart, opts) + '</span>'
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
    var n = cart.lines(), T = cart.total(), sym = opts.sym || '₹';
    if (!n && opts.hideEmptyChip) return '';
    return '<button type="button" class="cbcat-chip' + (n ? ' on' : '') + '"'
      + ' data-testid="cbcat-cart-' + esc(cart.ns) + '"'
      + (n ? ' onclick="CBCart.open(\'' + esc(cart.ns) + '\')"' : ' disabled')
      + ' title="' + esc(n ? 'Open the cart' : (opts.emptyHint || 'Press + on what you need')) + '">'
      + '<span class="cbcat-bag">🛒' + (n ? '<span class="cbcat-n" data-testid="cbcat-count-' + esc(cart.ns) + '">' + n + '</span>' : '') + '</span>'
      + (n && T.amount ? '<span class="cbcat-sum">' + esc(money(sym, T.amount)) + '</span>' : '')
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

      '.cbcat-commit{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:8px;',
      'background:var(--gold-soft,#F7F1E4);border:1px solid var(--gold-line,#E8D9BC);border-radius:10px;',
      'font-size:12.5px;color:#6b5a36}',
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
      '.cbcat-li-p{font-weight:700}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  root.CBCatalogue = {
    pickerHTML: pickerHTML, listHTML: listHTML, rowHTML: rowHTML,
    commitHTML: commitHTML, committedHTML: committedHTML, chipHTML: chipHTML,
    paint: paint, observe: observe, ensureCss: ensureCss,
    mediaOf: mediaOf, hasMedia: hasMedia, hintOf: hintOf
  };
})(typeof window !== 'undefined' ? window : this);
