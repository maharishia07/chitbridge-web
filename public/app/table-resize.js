/* app/table-resize.js — drag a column edge; the width is yours and it is remembered.
 *
 * ── ⭐⭐ WHY ─────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"provide an adjustable column, so people can adjust if it is not fit. Still the column
 * width is not correct."*
 *
 * ⚠️ AND HE IS RIGHT THAT NO SET OF WIDTHS I CHOOSE WILL BE. This board shows a five-character case key beside
 * a twenty-two character path, a one-word claim beside a four-line one, at four text sizes, on his screen and
 * not mine. Every width I picked today was right for one of those and wrong for the others — which is why he
 * has had to report the same class of thing five times.
 *
 * ⭐ SO THE READER DECIDES. A width somebody dragged is correct by definition, and it is the only kind that
 * survives a change of content.
 *
 * ── HOW IT SURVIVES A REPAINT ──────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ THESE TABLES ARE REBUILT FROM innerHTML ON EVERY PAINT — a filter, a fold, a tab. So a width set on a
 * DOM node is gone the moment anything happens. Nothing here lives on the element: the widths live in
 * localStorage under a key derived from the table's own HEADINGS, and they are re-applied after every render.
 *
 * ⭐ Keying on the headings rather than a position is what makes it stable: a table keeps its widths when rows
 * change, when it moves down the page, and when another table appears above it — and a table whose COLUMNS
 * change is a different table and correctly starts fresh.
 *
 * ⚠️ It sets a width on the <th> only. Setting table-layout:fixed would make every column obey, and would also
 * throw away the browser's own sizing for every column the reader has NOT touched — turning one adjustment
 * into a whole-table decision they did not ask to make.
 */
'use strict';

var TBL_STORE = 'cb.colw';

function tblWidths() {
  try { return JSON.parse(localStorage.getItem(TBL_STORE) || '{}'); } catch (_) { return {}; }
}
function tblSave(all) {
  try { localStorage.setItem(TBL_STORE, JSON.stringify(all)); } catch (_) {}
}

/** ⭐ a table's identity is what its columns are CALLED — see the note above */
function tblKey(table) {
  var head = table.querySelector(':scope > thead') || table.querySelector(':scope > tr');
  if (!head) return null;
  var names = [].slice.call(head.querySelectorAll('th')).map(function (h) {
    return (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 14);
  });
  return names.length > 1 ? names.join('|') : null;
}

/**
 * Wire every table under `root`, and re-apply whatever the reader has already chosen.
 * ⚠️ Idempotent: paint() calls this on every render, so it must not add a second handle each time.
 */
function tblResizable(root) {
  var all = tblWidths();
  (root || document).querySelectorAll('table').forEach(function (table) {
    var key = tblKey(table);
    if (!key) return;
    var head = table.querySelector(':scope > thead') || table.querySelector(':scope > tr');
    var ths = [].slice.call(head.querySelectorAll('th'));

    ths.forEach(function (th, i) {
      /* re-apply a remembered width */
      var w = all[key] && all[key][i];
      if (w) th.style.width = w + 'px';

      if (th.dataset.rs) return;                 /* ⚠ already wired — see the idempotence note */
      th.dataset.rs = '1';
      th.style.position = th.style.position || 'relative';

      var grip = document.createElement('span');
      grip.className = 'colgrip';
      grip.title = 'Drag to set this column’s width · double-click to reset it';
      th.appendChild(grip);

      var startX = 0, startW = 0, dragging = false;

      grip.addEventListener('mousedown', function (e) {
        /* ⚠️ a th is usually a sort or fold control — the drag must not also press it */
        e.preventDefault(); e.stopPropagation();
        dragging = true;
        startX = e.clientX;
        startW = th.getBoundingClientRect().width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      });

      /* ⭐ on the DOCUMENT, not the grip: a fast drag leaves the 5px handle behind instantly */
      document.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        var w2 = Math.max(36, Math.round(startW + (e.clientX - startX)));
        th.style.width = w2 + 'px';
      });

      document.addEventListener('mouseup', function () {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        var store = tblWidths();
        store[key] = store[key] || {};
        store[key][i] = Math.round(th.getBoundingClientRect().width);
        tblSave(store);
      });

      /* ⭐ double-click clears THIS column — the way back is the same control as the way in */
      grip.addEventListener('dblclick', function (e) {
        e.preventDefault(); e.stopPropagation();
        th.style.width = '';
        var store = tblWidths();
        if (store[key]) { delete store[key][i]; tblSave(store); }
      });
    });
  });
}

/** ⭐ every column of every table, back to the browser's own sizing */
function tblResetWidths() {
  try { localStorage.removeItem(TBL_STORE); } catch (_) {}
  document.querySelectorAll('th[data-rs]').forEach(function (th) { th.style.width = ''; });
}

/** has the reader adjusted anything? — so a Reset control can say whether it has work to do */
function tblHasWidths() {
  var all = tblWidths();
  return Object.keys(all).some(function (k) { return Object.keys(all[k] || {}).length; });
}
