/**
 * ── ⭐⭐⭐ CBTable — THE FOUR TABLE HABITS, ONCE ─────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-13: *"we can also create a column selection so we can select few columns as required"* and
 * *"we have to have adjustable column headers and usual stuff, all cannot be explained."*
 *
 * ⚠️⚠️ "ALL CANNOT BE EXPLAINED" IS THE WHOLE INSTRUCTION. He paid for these once, on the Platform screen, and
 * then the watcher found `misScreen` and `suppliersScreen` owing the same four: sort by heading, column
 * chooser, resizable, reset to default. Writing them a second and third time is how three tables come to
 * disagree about what a column chooser does — and he would have to ask three times.
 *
 * ⭐ SO IT IS LIFTED FROM THE ONE THAT WORKS, not invented here. Every judgement below was already made and
 * paid for on Platform:
 *
 *   · a saved column set is filtered against the CURRENT columns, so a renamed key cannot render an empty
 *     header forever with nobody knowing why
 *   · ticking a column inserts it in the canonical order rather than appending — a chooser that reorders the
 *     table as you tick is disorienting, and nobody asked for reordering
 *   · a resize writes to the <col> element and does NOT repaint: a repaint per mousemove rebuilds every row
 *     and replaces the grip under the pointer
 *   · widths and columns are a PREFERENCE, and a preference you cannot undo is a trap — hence reset
 *   · one column can never be turned off, or a reader can empty the table and not know how to get back
 *
 * ── ⚠️ WHAT EACH TABLE STILL OWNS ───────────────────────────────────────────────────────────────────────────────
 *
 * The COLUMNS and the REPAINT. This file knows nothing about entities, suppliers or MIS rows; it is handed a
 * function that returns `{key,w,label,hint,sort,cell}` and a function that repaints. That split is what keeps it
 * one helper rather than one helper with a flag per caller. [[feedback-no-duplicate-functions]]
 *
 * ⚠️ AND THE STORAGE KEY IS THE NAMESPACE. Two tables sharing `cb_cols` would fight over one saved set — which
 * is the same bug as sharing a stylesheet instead of sharing the rules. [[feedback-shop-scoped-local-store]]
 */
(function (root) {
  'use strict';

  /* every live instance, so the outside-click handler below can close whichever menu is open */
  const _all = [];

  /** ⚠️ uk() namespaces by USER; without it two people on one browser inherit each other's columns. */
  const key = (ns, what) => (typeof uk === 'function' ? uk('cb_' + ns + what) : 'cb_' + ns + what);

  /**
   * @param ns       short namespace, e.g. 'plat' | 'sup' | 'mis' — decides the storage keys
   * @param opts.columns   () => [{key,w,label,hint,sort,cell}]   the canonical list, in order
   * @param opts.defaults  [key]                                  which are shown before anybody chooses
   * @param opts.repaint   ()                                     called when the reader changes something
   * @param opts.fixed     key                                    the one that can never be hidden (default: first)
   * @param opts.tableSel  css selector for the <table>, for the resize grip to find its <col>
   */
  function make(ns, opts) {
    const o = opts || {};
    const columns = o.columns || function () { return []; };
    const repaint = o.repaint || function () {};
    const tableSel = o.tableSel || ('#' + ns + '_table');
    let state = { cols: null, w: null, menu: false };
    let rz = null;

    const fixedKey = () => o.fixed || ((columns()[0] || {}).key);

    /** the chosen column keys — saved, filtered against what exists now, else the defaults */
    function cols() {
      if (state.cols) return state.cols;
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(key(ns, 'cols')) || 'null'); } catch (_) {}
      const all = columns().map((c) => c.key);
      /* ⚠️ filtered against the CURRENT list: a saved set naming a column that has since been renamed would
         otherwise render an empty header forever, and nobody would know why. */
      state.cols = (Array.isArray(saved) && saved.length)
        ? saved.filter((k) => all.indexOf(k) >= 0)
        : (o.defaults || all).slice();
      const f = fixedKey();
      if (f && state.cols.indexOf(f) < 0) state.cols.unshift(f);
      return state.cols;
    }

    function toggle(k) {
      if (k === fixedKey()) return;                 /* the one that cannot be turned off */
      const set = cols().slice(), i = set.indexOf(k);
      if (i >= 0) set.splice(i, 1);
      else {
        /* ⭐ inserted in the canonical order, not appended — a chooser that reorders the table as you tick is
           disorienting, and nobody asked for reordering. */
        const all = columns().map((c) => c.key);
        set.push(k);
        set.sort((a, b) => all.indexOf(a) - all.indexOf(b));
      }
      state.cols = set;
      try { localStorage.setItem(key(ns, 'cols'), JSON.stringify(set)); } catch (_) {}
      repaint();
    }

    /** the width in force: what was dragged, else the column's own default */
    function colW(c) {
      if (!state.w) {
        try { state.w = JSON.parse(localStorage.getItem(key(ns, 'colw')) || '{}') || {}; }
        catch (_) { state.w = {}; }
      }
      return Number(state.w[c.key]) || c.w || 110;
    }

    function resizeStart(e, k) {
      e.preventDefault(); e.stopPropagation();
      const col = document.querySelector(tableSel + ' col[data-col="' + k + '"]');
      rz = { key: k, x: e.clientX, w: col ? (col.offsetWidth || parseInt(col.style.width, 10)) : 110, col: col };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', end);
      document.body.style.userSelect = 'none';
    }
    /* ⚠️ writes to the <col> directly and does NOT repaint. A full repaint per mousemove would rebuild every row
       of a hundred and the drag would stutter — and worse, the grip would be replaced under the pointer. */
    function move(e) {
      if (!rz) return;
      const w = Math.max(56, rz.w + (e.clientX - rz.x));
      state.w = state.w || {};
      state.w[rz.key] = w;
      if (rz.col) rz.col.style.width = w + 'px';
    }
    function end() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
      document.body.style.userSelect = '';
      if (rz) { try { localStorage.setItem(key(ns, 'colw'), JSON.stringify(state.w || {})); } catch (_) {} }
      rz = null;
    }

    /** ⭐ a way back: widths are a preference, and a preference you cannot undo is a trap. */
    function reset() {
      state.w = {}; state.cols = null;
      try { localStorage.removeItem(key(ns, 'colw')); localStorage.removeItem(key(ns, 'cols')); } catch (_) {}
      repaint();
    }

    function toggleMenu() { state.menu = !state.menu; repaint(); }
    function menuOpen() { return !!state.menu; }
    function closeMenu() { if (!state.menu) return false; state.menu = false; return true; }

    function menuHTML() {
      if (!state.menu) return '';
      const on = cols(), f = fixedKey();
      return '<div data-testid="' + ns + '-colmenu" onclick="event.stopPropagation()" '
        + 'style="position:absolute;z-index:40;margin-top:4px;background:var(--card);border:1px solid var(--line);'
        + 'border-radius:var(--r-md);padding:9px 11px;box-shadow:0 8px 24px rgba(0,0,0,.28);max-height:320px;'
        + 'overflow:auto;min-width:190px">'
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:6px">'
        + esc(tx('Show these columns')) + '</div>'
        + columns().map((c) => {
            const checked = on.indexOf(c.key) >= 0, isFixed = c.key === f;
            return '<label style="display:flex;gap:7px;align-items:center;padding:3px 0;font-size:var(--fs-2);'
              + (isFixed ? 'opacity:.55' : 'cursor:pointer') + '">'
              + '<input type="checkbox" data-testid="' + ns + '-col-' + c.key + '" ' + (checked ? 'checked ' : '')
              + (isFixed ? 'disabled ' : 'onchange="CBTable.get(\'' + ns + '\').toggle(\'' + c.key + '\')" ')
              + 'style="margin:0">' + esc(tx(c.label)) + '</label>';
          }).join('')
        + '<div style="border-top:1px solid var(--line-soft);margin-top:7px;padding-top:7px">'
        + '<button onclick="event.stopPropagation();CBTable.get(\'' + ns + '\').reset()" '
        + 'data-testid="' + ns + '-cols-reset" '
        + 'style="font:inherit;font-size:var(--fs-1);padding:3px 9px;cursor:pointer;border:1px solid var(--line);'
        + 'background:var(--card);color:var(--grey-2);border-radius:var(--r-sm)">'
        + esc(tx('Reset columns and widths')) + '</button></div>'
        + '</div>';
    }

    /** the ⚙ that opens it — beside the table, not buried in a menu nobody opens */
    function menuButtonHTML() {
      return '<button data-testid="' + ns + '-cols" onclick="event.stopPropagation();'
        + 'CBTable.get(\'' + ns + '\').toggleMenu()" title="' + esc(tx('Choose columns')) + '" '
        + 'style="font:inherit;font-size:var(--fs-1);padding:2px 8px;cursor:pointer;border:1px solid var(--line);'
        + 'background:var(--card);color:var(--grey-2);border-radius:var(--r-sm)">⚙ '
        + esc(tx('Columns')) + '</button>';
    }

    /** <colgroup>, so a dragged width survives a repaint and every cell in the column obeys it */
    function colgroupHTML() {
      const on = cols();
      return '<colgroup>' + columns().filter((c) => on.indexOf(c.key) >= 0)
        .map((c) => '<col data-col="' + c.key + '" style="width:' + colW(c) + 'px">').join('') + '</colgroup>';
    }

    /**
     * the header row, with a sort affordance on every sortable column and a drag grip between them.
     * @param sortKey  the column currently sorted on
     * @param dir      'asc' | 'desc'
     * @param onSort   name of a global function taking the column key
     */
    function headHTML(sortKey, dir, onSort) {
      const on = cols();
      return '<thead><tr>' + columns().filter((c) => on.indexOf(c.key) >= 0).map((c) => {
        const active = c.sort && String(sortKey) === String(c.sort);
        const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : '';
        return '<th data-testid="' + ns + '-th-' + c.key + '" '
          + 'style="position:relative;text-align:start;padding:6px 9px;font-size:var(--fs-1);'
          + 'color:' + (active ? 'var(--disp)' : 'var(--grey)') + ';font-weight:600;text-transform:uppercase;'
          + 'letter-spacing:.03em;border-bottom:1px solid var(--line);white-space:nowrap"'
          + (c.hint ? ' title="' + esc(tx(c.hint)) + '"' : '') + '>'
          + (c.sort
              ? '<span onclick="' + onSort + '(\'' + c.sort + '\')" style="cursor:pointer">'
                + esc(tx(c.label)) + arrow + '</span>'
              : esc(tx(c.label)))
          /* ⚠️ the grip is VISIBLE. Athi, 2026-09-13: *"need to have a visible pipeline for the column split,
             otherwise it will not be known"* — an invisible hit area is a feature nobody finds. */
          + '<span onmousedown="CBTable.get(\'' + ns + '\').resizeStart(event,\'' + c.key + '\')" '
          + 'data-testid="' + ns + '-grip-' + c.key + '" '
          + 'style="position:absolute;top:4px;bottom:4px;inset-inline-end:0;width:5px;cursor:col-resize;'
          + 'border-inline-end:2px solid var(--line);opacity:.8"></span>'
          + '</th>';
      }).join('') + '</tr></thead>';
    }

    /** the visible columns, for a caller drawing its own rows */
    function shown() {
      const on = cols();
      return columns().filter((c) => on.indexOf(c.key) >= 0);
    }

    const api = { ns, cols, toggle, colW, resizeStart, reset, toggleMenu, menuOpen, closeMenu,
                  menuHTML, menuButtonHTML, colgroupHTML, headHTML, shown, columns };
    _all.push(api);
    return api;
  }

  const _by = {};
  /* ⚠️ a panel that only closes by pressing the same button again is one people leave open and then report as
     "it covers the table". Every other menu here closes on an outside click; so do these. */
  if (typeof document !== 'undefined') {
    document.addEventListener('click', function () {
      let any = false;
      for (const t of _all) if (t.closeMenu()) any = true;
      if (any) for (const t of _all) if (_by[t.ns] && _by[t.ns]._repaint) _by[t.ns]._repaint();
    });
  }

  root.CBTable = {
    /** make one, or return the one already made for this namespace */
    of: function (ns, opts) {
      if (!_by[ns]) { _by[ns] = make(ns, opts); _by[ns]._repaint = (opts || {}).repaint; }
      return _by[ns];
    },
    /** the instance, for the onclick handlers above — never makes one */
    get: function (ns) { return _by[ns] || { toggle(){}, reset(){}, toggleMenu(){}, resizeStart(){} }; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
