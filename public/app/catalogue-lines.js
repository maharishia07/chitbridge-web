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
      rows.push({
        type: 'product', label: g.label || '', count: lines.length,
        options: Object.keys(g.options || {}).map(function (k) { return (g.options[k] || []).join(' · '); }).join('  '),
      });
      lines.forEach(function (x) {
        rows.push({ type: 'line', item: x.p, item_id: x.l.item_id, variant: x.l.variant || '' });
      });
    });

    // Rule 3 — never drop a line just because no group claimed it.
    items.forEach(function (p) {
      if (!shown[p.item_id]) rows.push({ type: 'line', item: p, item_id: p.item_id, variant: '' });
    });
    return rows;
  }

  root.cbLineRows = cbLineRows;
  if (typeof module !== 'undefined' && module.exports) module.exports = { cbLineRows: cbLineRows };
})(typeof window !== 'undefined' ? window : globalThis);
