/**
 * catalogue-lines.js — ONE walk from a catalogue payload to a list of display rows.
 *
 * Athi, 2026-08-06: *"fix the supplier view as well — this should not be a separate code, it is another entry point
 * for the same view."*
 *
 * He is right, and it is the same point he made about the READ a week earlier (SPEC-one-path-many-principals):
 * *"there is no difference between a storefront or a B2B relationship… all paths remain the same."* We took that
 * seam at the read — `buildPublicView` is one implementation serving the public storefront, the B2B supplier view
 * and a network peer — and then rendered it twice. So the storefront learned to group variants and the supplier
 * view did not, which is exactly the divergence the shared read exists to prevent.
 *
 * This file is the missing half: the walk from `{items, groups}` to an ordered list of rows. Both surfaces call it
 * and then style the rows in their own house style — shop.html is a public page in its own CSS, app.html is the
 * signed-in app. Sharing the LOGIC is the requirement; sharing the CSS would be a different and worse thing.
 *
 * ── WHAT IT RETURNS ────────────────────────────────────────────────────────────────────────────────────────────
 *   [ { type:'product', label, count, options },      ← a heading, only when a product has MORE THAN ONE line
 *     { type:'line', item, variant, item_id },        ← the purchasable line; `variant` is '' when ungrouped
 *     … ]
 *
 * ── THE RULES, IN ONE PLACE SO BOTH SURFACES OBEY THEM ─────────────────────────────────────────────────────────
 *   1. No groups → the flat list, exactly as before. Every catalogue that has not declared variants is untouched.
 *   2. A group of ONE is not a group — it renders as the plain product it is, with no empty hierarchy.
 *   3. Anything the grouping did not cover is STILL SHOWN. A product that vanished because it lacked a group value
 *      would be the silent-drop failure that keeps recurring in this codebase.
 *   4. Order is the server's. It decided lines-in-listed-order and products-newest-first deliberately; re-sorting
 *      here would take that decision away from it and put it back in the hands of whatever order the array arrived.
 */
(function (root) {
  'use strict';

  function cbLineRows(data) {
    var items = (data && data.items) || [];
    var groups = (data && data.groups) || [];
    if (!items.length) return [];

    // Rule 1 — nothing declared, nothing to group.
    if (!groups.length) {
      return items.map(function (p) { return { type: 'line', item: p, item_id: p.item_id, variant: '' }; });
    }

    var byId = {};
    items.forEach(function (p) { byId[p.item_id] = p; });

    var rows = [];
    var shown = {};
    groups.forEach(function (g) {
      var lines = (g.lines || [])
        .map(function (l) { return { l: l, p: byId[l.item_id] }; })
        .filter(function (x) { return x.p; });
      if (!lines.length) return;
      lines.forEach(function (x) { shown[x.l.item_id] = true; });

      // Rule 2 — a group of one is just a product.
      if (lines.length === 1) {
        rows.push({ type: 'line', item: lines[0].p, item_id: lines[0].l.item_id, variant: '' });
        return;
      }
      // `gid` marks which heading a line belongs to. The row list is FLAT, so without it nothing downstream can
      // tell where a group ends — rule 3's ungrouped leftovers are 'line' rows too, and a "select all in this
      // group" control walking forward until the next heading would silently swallow them. Additive: every
      // existing consumer ignores it and renders exactly as before.
      var gid = 'g' + rows.length;
      rows.push({
        type: 'product', label: g.label || '', count: lines.length, gid: gid,
        options: Object.keys(g.options || {}).map(function (k) { return (g.options[k] || []).join(' · '); }).join('  '),
      });
      lines.forEach(function (x) {
        rows.push({ type: 'line', item: x.p, item_id: x.l.item_id, variant: x.l.variant || '', gid: gid });
      });
    });

    // Rule 3 — never drop a line just because no group claimed it.
    items.forEach(function (p) {
      if (!shown[p.item_id]) rows.push({ type: 'line', item: p, item_id: p.item_id, variant: '' });
    });
    return rows;
  }

  /**
   * ── THE PICKER — the same walk, made selectable ───────────────────────────────────────────────────────────────
   *
   * Athi, 2026-08-08: *"in supplier and network, the same pattern. with check box, and search, they should be able
   * to select more product and then send button."*
   *
   * Ordering was all-or-nothing: "Compose order" took the supplier's ENTIRE catalogue and left you to delete the
   * lines you did not want. That is fine for a shop with six items and unusable for one with six thousand — and it
   * is the same list in both places, so it is one control, not two.
   *
   * It lives here rather than in either screen for the reason the walk does: the moment supplier and network each
   * own a picker, one of them learns to group variants and the other does not. Same rows, same rules, same code —
   * the screens supply only their house style and what the send button does.
   *
   * ── SEARCH IS LOCAL, DELIBERATELY ─────────────────────────────────────────────────────────────────────────────
   * The catalogue is already whole in the browser, so filtering is a substring test, not a round trip. It also
   * means a filter can never hide a line from a SELECTION — narrowing the view must not silently unpick what you
   * already chose, so the selection is kept by item_id and survives every keystroke. What you have picked is
   * counted on the button even when you cannot currently see it.
   */
  var PICK = {};

  /**
   * ⚠️ RE-INITIALISING MUST NOT EMPTY THE BASKET.
   *
   * The screens call this on every repaint, and a repaint happens for reasons that have nothing to do with the
   * catalogue — a confidence strip arriving, a toast, a tick of the picker itself. Clearing the selection each
   * time would silently discard what someone had chosen, which is the failure this codebase keeps refusing.
   *
   * So the selection is kept while the catalogue is the SAME one, and cleared only when a genuinely different
   * catalogue arrives — a different store, or the same store's list actually changing underneath. The signature
   * is deliberately cheap and deliberately conservative: when in doubt it keeps, because a stale tick is visible
   * on screen and can be unticked, whereas a silently emptied basket is not visible at all.
   */
  function sigOf(cat) {
    var shop = (cat && cat.shop) || {};
    return [shop.bridge_id || shop.entity_id || '', ((cat && cat.items) || []).length].join('|');
  }
  function cbPickInit(ns, cat) {
    var prev = PICK[ns], sig = sigOf(cat);
    var keep = prev && prev.sig === sig;
    PICK[ns] = { cat: cat || {}, sig: sig, q: keep ? prev.q : '', sel: keep ? prev.sel : {} };
  }
  function cbPickCount(ns) { var s = PICK[ns]; return s ? Object.keys(s.sel).length : 0; }

  function lineText(r) {
    var d = (r.item && (r.item.item_data || r.item)) || {};
    return [r.variant, d.name, d.product, d.code, d.sku, d.unit].filter(Boolean).join(' ').toLowerCase();
  }

  /** The rows a given query leaves visible. A heading survives only if one of ITS lines did — a lone group label
   *  over nothing is the kind of empty hierarchy rule 2 already refuses at the walk. */
  function cbPickRows(ns) {
    var s = PICK[ns]; if (!s) return [];
    var all = cbLineRows(s.cat);
    var q = (s.q || '').trim().toLowerCase();
    if (!q) return all;
    var out = [], pending = null, took = false;
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (r.type === 'product') { pending = r; took = false; continue; }
      if (lineText(r).indexOf(q) === -1) continue;
      if (pending && !took) { out.push(pending); took = true; }
      out.push(r);
    }
    return out;
  }

  /** What was picked, in the shape a compose line needs. Reads from the WHOLE catalogue, not the filtered view. */
  function cbPickSelected(ns) {
    var s = PICK[ns]; if (!s) return [];
    return cbLineRows(s.cat).filter(function (r) { return r.type === 'line' && s.sel[r.item_id]; })
      .map(function (r) {
        var d = (r.item && (r.item.item_data || r.item)) || {};
        return {
          item_id: r.item_id, item: r.item,
          name: r.variant ? ((d.name || d.product || '') + ' ' + r.variant).trim() : (d.name || d.product || 'item'),
          unit: d.unit || 'unit', price: d.price, code: d.code || d.sku || null,
        };
      });
  }

  function cbPickToggle(ns, id) {
    var s = PICK[ns]; if (!s) return;
    if (s.sel[id]) delete s.sel[id]; else s.sel[id] = true;
    if (root.cbPickPaint) root.cbPickPaint(ns);
  }
  /**
   * A heading's box picks or clears everything under it — the whole point of grouping variants.
   * ⚠️ Membership comes from `gid`, NOT from "keep walking until the next heading". Ungrouped products are appended
   * as plain lines after every group (rule 3), so walking forward would tick items belonging to nobody's heading.
   */
  function cbPickGroup(ns, idx) {
    var s = PICK[ns]; if (!s) return;
    var rows = cbPickRows(ns), head = rows[idx], ids = [];
    if (!head || head.type !== 'product') return;
    for (var i = idx + 1; i < rows.length; i++) {
      if (rows[i].type !== 'line' || rows[i].gid !== head.gid) break;
      ids.push(rows[i].item_id);
    }
    var allOn = ids.length && ids.every(function (id) { return s.sel[id]; });
    ids.forEach(function (id) { if (allOn) delete s.sel[id]; else s.sel[id] = true; });
    if (root.cbPickPaint) root.cbPickPaint(ns);
  }
  function cbPickSearch(ns, q) {
    var s = PICK[ns]; if (!s) return;
    s.q = q || '';
    if (root.cbPickPaint) root.cbPickPaint(ns, true);   // list only — retyping must not steal focus from the box
  }
  function cbPickClear(ns) { var s = PICK[ns]; if (s) { s.sel = {}; if (root.cbPickPaint) root.cbPickPaint(ns); } }
  function cbPickState(ns) { return PICK[ns]; }

  root.cbPickInit = cbPickInit; root.cbPickRows = cbPickRows; root.cbPickSelected = cbPickSelected;
  root.cbPickToggle = cbPickToggle; root.cbPickGroup = cbPickGroup; root.cbPickSearch = cbPickSearch;
  root.cbPickCount = cbPickCount; root.cbPickClear = cbPickClear; root.cbPickState = cbPickState;

  root.cbLineRows = cbLineRows;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cbLineRows: cbLineRows, cbPickInit: cbPickInit, cbPickRows: cbPickRows,
      cbPickSelected: cbPickSelected, cbPickToggle: cbPickToggle, cbPickGroup: cbPickGroup,
      cbPickSearch: cbPickSearch, cbPickCount: cbPickCount, cbPickClear: cbPickClear };
  }
})(typeof window !== 'undefined' ? window : globalThis);
