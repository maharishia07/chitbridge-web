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

  /* ⚠️ THE PICKER MOVED. It briefly lived here; it is now app/cart-ui.js, which owns the cart for all four
     ordering screens. The old cbPick* names survive as thin adapters over CBCart (see cart-ui.js) so no
     call site had to change, but there is ONE implementation. This file is back to what it should be: the
     WALK, and nothing else. */

  /**
 * ⭐ cbMediaGallery — ONE renderer for a product's pictures and videos, used by the product page's Media row and by
 * the storefront (shop.html): what the owner sees in the row IS what the customer gets. Pictures come through the
 * API (never a bucket URL); a video is an EMBED of the link the owner pasted (YouTube/Vimeo — the API parsed it).
 *   cbMediaGallery(d, { apiBase, itemId, size:'tile'|'phone', onRemove })
 */
root.cbMediaEmbed = function (m) {
  if (!m || m.kind !== 'video') return '';
  if (m.embed) return m.embed;
  if (m.provider === 'youtube' && m.vid) return 'https://www.youtube-nocookie.com/embed/' + m.vid;
  if (m.provider === 'vimeo' && m.vid) return 'https://player.vimeo.com/video/' + m.vid;
  return '';
};
root.cbMediaGallery = function (d, o) {
  o = o || {}; var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var m = Array.isArray(d && d.media) ? d.media : [];
  var pic = function (x) { return x.key ? ((o.apiBase || '') + '/api/products/media/' + encodeURIComponent(o.itemId || '') + '/' + encodeURIComponent(x.id)) : (x.url || ''); };
  var phone = o.size === 'phone';
  var w = phone ? '100%' : '140px', h = phone ? '190px' : '100px';
  var tiles = m.map(function (x) {
    var inner;
    if (x.kind === 'video') {
      var src = root.cbMediaEmbed(x);
      inner = src ? '<iframe src="' + esc(src) + '" title="' + esc(x.name || 'video') + '" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen style="width:100%;height:' + h + ';border:0;display:block;background:#000"></iframe>'
                  : '<video src="' + esc(pic(x)) + '" controls preload="metadata" style="width:100%;height:' + h + ';object-fit:cover;display:block"></video>';
    } else if (x.kind === 'image') {
      inner = '<img src="' + esc(pic(x)) + '" alt="' + esc(x.name || '') + '" loading="lazy" style="width:100%;height:' + h + ';object-fit:cover;display:block">';
    } else {
      inner = '<div style="height:' + h + ';display:flex;align-items:center;justify-content:center;color:#888">📄</div>';
    }
    var cap = phone ? '' : '<div style="padding:4px 6px;font-size:11px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(x.name || '') + '">' + esc(x.name || '') + '</div>';
    var del = o.onRemove ? '<button type="button" data-testid="prod-media-del-' + esc(x.id) + '" style="position:absolute;top:4px;inset-inline-end:4px;padding:2px 6px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer" onclick="' + esc(o.onRemove.replace('{id}', String(x.id))) + '">✕</button>' : '';
    return '<div data-testid="prod-media-' + esc(x.id) + '" style="position:relative;width:' + w + ';border:1px solid #e3e3e3;border-radius:9px;overflow:hidden;background:#fff">' + inner + cap + del + '</div>';
  });
  if (!tiles.length && d && d.image) {
    tiles.push('<div data-testid="prod-media-cover" style="width:' + w + ';border:1px solid #e3e3e3;border-radius:9px;overflow:hidden;background:#fff"><img src="' + esc(d.image) + '" alt="" loading="lazy" style="width:100%;height:' + h + ';object-fit:cover;display:block"></div>');
  }
  if (!tiles.length) return '';
  return '<div data-testid="prod-media" style="display:' + (phone ? 'grid' : 'flex') + ';gap:8px;flex-wrap:wrap;' + (phone ? 'grid-template-columns:1fr;' : '') + 'padding:6px 0">' + tiles.join('') + '</div>';
};
root.cbLineRows = cbLineRows;
  if (typeof module !== 'undefined' && module.exports) module.exports = { cbLineRows: cbLineRows };
})(typeof window !== 'undefined' ? window : globalThis);
