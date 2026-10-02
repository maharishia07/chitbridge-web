/**
 * ── ⭐⭐⭐ THE FIVE CONTROLS, WRITTEN ONCE ────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-14, after finding search silent and the list truncated at 100 for the third time:
 *
 *   *"create a watcher and check all those have been handled every time when you are writing the control. this
 *    becomes very bad. i could have worked with human engineers — once I say, they follow and no drift. here my
 *    fingers are paining."*
 *
 * `e2e/list-controls.cjs` is the watcher that CHECKS the rule. This is the thing that makes it cheap to obey —
 * because a rule that costs eighty lines a screen gets skipped on the ninth screen, and then the watcher is just
 * a list of complaints. A screen declares its list once and gets search, filters, sort, a count and lazy
 * rendering. [[feedback-no-duplicate-functions]] [[project-js-unification]]
 *
 * ── WHAT IT IS FOR, AND WHAT IT IS NOT ─────────────────────────────────────────────────────────────────────────
 *
 * ⭐ FOR A LIST THE BROWSER ALREADY HOLDS. Customers, suppliers, categories and co-assists all arrive whole —
 * the server sends no LIMIT — so the entire question is what to SHOW, and that is a browser question.
 *
 * ⚠️ NOT FOR A SERVER-PAGED LIST. The Platform screen asks the server for one page at a time and gets `matched`
 * back with it; `platPagerHTML` is that, and it is right for 2,509 entities nobody wants in one payload. Using
 * this there would mean downloading everything to page it locally, which is the bug that shape exists to avoid.
 *
 * ── ⚠️⚠️ WHY LAZY RENDERING AND NOT PAGE NUMBERS ───────────────────────────────────────────────────────────────
 *
 * Athi asked for page numbers on Platform — *"give the page numbers so the next page can be moved"* — and that
 * is right where a page is a round trip. Here nothing is fetched by scrolling: every row is already in memory
 * and the only cost is DOM. So the list grows as you reach the end, which is the same answer with no clicks.
 *
 * ⭐ AND THE COUNT NEVER LIES ABOUT IT. It says how many MATCHED, not how many are drawn — *"100 of 2,259"* with
 * no way to reach the rest is the complaint that started all of this. [[feedback-silence-is-the-bug]]
 *
 * ── ⚠️⚠️ THE ROWS ARE DRAWN BY `lazyWrap`, WHICH WAS ALREADY HERE — AND I WROTE A SECOND ONE FIRST ──────────────
 *
 * The first cut of this file had its own chunking and its own `onscroll` handler that grew the slice and then
 * put the scroll position back. It worked. It was also **the second implementation of one rule**, and the one
 * that was already in `app.html` — doing this job for the catalogue, the message thread and the disputes list
 * since August — is better than mine on every count: an IntersectionObserver instead of a scroll threshold, an
 * explicit *"↓ Show 50 more"* button as well as auto-reveal, *"50 of 812"* and *"812 total · end of list"*
 * written into the sentinel, and rows INSERTED before the sentinel rather than the container being rebuilt, so
 * there is no scroll position to lose in the first place.
 *
 * ⚠️ I searched this codebase for `PagerHTML`, `CountHTML` and `sortPresetSelect` before building, and never
 * searched for a lazy renderer. That is the motto missed by one query. [[feedback-adopt-dont-reinvent]]
 * [[feedback-search-before-you-build]] [[feedback-no-duplicate-functions]]
 */
'use strict';

/** key → { cfg, q, sort, f:{} } — one entry per list, kept across repaints so a search survives one */
var LISTCTL = {};

/**
 * ⚠️ HOW MANY ROWS ARE DRAWN IS `lazyWrap`'S BUSINESS, NOT THIS FILE'S — it keeps that in its own `LAZY` map.
 * But a control change must send it back to the top: narrowing 812 rows to 150 while it still believes 400 are
 * revealed would draw the entire narrowed answer at once, and look identical to nothing having been filtered.
 * ⚠️ `LAZY` is a top-level `const` in app.html, so it is NOT on `window` and it is in the temporal dead zone
 * until that script runs — `typeof` THROWS on a TDZ binding, hence the try. [[feedback-probe-the-right-scope]]
 */
function listCtlResetRows(key) { try { if (LAZY) delete LAZY[key]; } catch (_) {} }

/**
 * Declare a list. Safe to call on every render: the CONFIG is replaced (so a closure never goes stale) and the
 * STATE — what was typed, what was chosen, how far it was scrolled — is kept.
 *
 * @param key     a name for this list, e.g. 'customers'
 * @param cfg.rows      () => the full array the browser holds
 * @param cfg.text      (row) => the text a search should look in
 * @param cfg.sorts     [{ key, label, cmp }]  — the FIRST is the default
 * @param cfg.filters   [{ key, label, all, options:[{v,label}], match(row, v) }]
 * @param cfg.repaint   () => repaint the list body and the count
 * @param cfg.noun      'customer' — for "812 customers"
 */
function listCtl(key, cfg) {
  var s = LISTCTL[key] || (LISTCTL[key] = { q: '', sort: 0, f: {} });
  s.cfg = cfg;
  return s;
}
function listCtlS(key) { return LISTCTL[key] || { cfg: null, q: '', sort: 0, f: {} }; }

/**
 * What the screen should draw: everything, what matched, and the slice to render.
 * ⚠️ `matched` is computed every call rather than cached. A cached count is a count that disagrees with the rows
 * the first time somebody adds a customer without telling the cache.
 */
function listCtlView(key) {
  var s = listCtlS(key), c = s.cfg;
  if (!c) return { all: [], matched: [] };
  var all = (c.rows && c.rows()) || [];
  var q = String(s.q || '').trim().toLowerCase();
  var matched = all.filter(function (row) {
    if (q && String((c.text && c.text(row)) || '').toLowerCase().indexOf(q) < 0) return false;
    for (var i = 0; i < (c.filters || []).length; i++) {
      var f = c.filters[i], v = s.f[f.key];
      if (v && !f.match(row, v)) return false;
    }
    return true;
  });
  var sorts = c.sorts || [];
  var srt = sorts[s.sort] || sorts[0];
  /* ⚠️ sort a COPY. Sorting `matched` in place is fine, but `matched` is `all` itself when nothing is filtered,
     and reordering the screen's own array is how a list silently changes under everything else reading it. */
  if (srt && srt.cmp) matched = matched.slice().sort(srt.cmp);
  if (s.rev) matched = matched.slice().reverse();   /* a heading clicked twice (tblSortBy) */
  return { all: all, matched: matched };
}

/**
 * ⭐ THE ROWS — every match handed to `lazyWrap`, which draws the first 50 and reveals the rest as the sentinel
 * comes into view or the reader presses its button. The COUNT it prints is the true one, because `matched` is
 * the true one: what changes is how many are DRAWN, never what the list claims to hold.
 */
function listCtlRowsHTML(key, rowFn, emptyHTML) {
  var v = listCtlView(key);
  return lazyWrap(key, v.matched, rowFn, emptyHTML || '');
}

/* ── the controls ──────────────────────────────────────────────────────────────────────────────────────────── */

/** search · filters · sort, in one row. The screen places it; this decides nothing about where. */
function listCtlToolbarHTML(key) {
  var s = listCtlS(key), c = s.cfg;
  if (!c) return '';
  var k = "'" + key + "'";
  /* ⚠️ oninput, NOT onkeydown. Enter-only is how "search is broken" happens: the box takes typing and the list
     does not move, with nothing on screen saying why. The watcher checks for exactly this. */
  var search = '<div class="srch" style="flex:1 1 150px;min-width:130px">🔍 <input data-testid="listctl-search-' + esc(key) + '"'
    + ' placeholder="' + esc(tx('Search')) + '" value="' + esc(s.q || '') + '"'
    + ' oninput="listCtlSetQ(' + k + ',this.value)"></div>';

  var filters = (c.filters || []).map(function (f) {
    var opts = '<option value="">' + esc(f.all || tx('All')) + '</option>'
      + (f.options || []).map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (s.f[f.key] === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('');
    return '<select class="inp" data-testid="listctl-filter-' + esc(f.key) + '" title="' + esc(f.label) + '"'
      + ' style="width:auto;padding:3px 6px;font-size:var(--fs-1)"'
      + ' onchange="listCtlSetFilter(' + k + ',\'' + esc(f.key) + '\',this.value)">' + opts + '</select>';
  }).join('');

  var sorts = (c.sorts || []).length > 1
    ? '<select class="inp" data-testid="listctl-sort-' + esc(key) + '" title="' + esc(tx('Sort order')) + '"'
      + ' style="width:auto;padding:3px 6px;font-size:var(--fs-1)"'
      + ' onchange="listCtlSetSort(' + k + ',this.value)">'
      + c.sorts.map(function (o, i) { return '<option value="' + i + '"' + (i === s.sort ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('')
      + '</select>'
    : '';

  return '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px">'
    + search + filters + sorts + '</div>';
}

/**
 * ⭐ HOW MANY MATCHED — and, only while some are undrawn, how many are drawn.
 * ⚠️ It never reports the drawn number ALONE. "100 customers" when there are 812 is the exact sentence that made
 * Athi ask for all of this.
 */
function listCtlCountHTML(key) {
  var s = listCtlS(key), c = s.cfg, v = listCtlView(key);
  var noun = (c && c.noun) || 'row';
  var plural = v.matched.length === 1 ? noun : (c && c.plural) || (noun + 's');
  var narrowed = v.matched.length !== v.all.length;
  /* ⭐ how many are DRAWN is not said here — lazyWrap's own sentinel says "50 of 812" at the foot of the rows,
     where somebody who has run out of list is actually looking. Saying it twice would be two places to keep
     agreeing, and the pager on the Platform screen taught that lesson once already. */
  return esc(v.matched.length + ' ' + plural)
    + (narrowed ? ' <span style="color:var(--grey-4)">' + esc(tx('of') + ' ' + v.all.length) + '</span>' : '');
}

/* ⚠️ EVERY CHANGE SENDS THE ROWS BACK TO THE TOP. Narrowing while lazyWrap still believes 400 are revealed
   would draw the whole of a narrower answer at once — and look identical to no filtering having happened. */
function listCtlSetQ(key, v) { var s = listCtlS(key); s.q = v; listCtlResetRows(key); if (s.cfg && s.cfg.repaint) s.cfg.repaint(); }
function listCtlSetFilter(key, f, v) { var s = listCtlS(key); s.f[f] = v; listCtlResetRows(key); if (s.cfg && s.cfg.repaint) s.cfg.repaint(); }
function listCtlSetSort(key, i) { var s = listCtlS(key); s.sort = Number(i) || 0; s.rev = false; listCtlResetRows(key); if (s.cfg && s.cfg.repaint) s.cfg.repaint(); }

/**
 * ⭐ THE EMPTY CASE IS TWO DIFFERENT SENTENCES, and telling them apart is the whole value of saying anything.
 * "No customers yet" is an invitation; "nothing matches 'ravi'" is a correction, and showing the first when the
 * second is true tells somebody their data is gone. [[feedback-write-for-the-shopkeeper]]
 */
function listCtlEmptyHTML(key, icon, title, sub) {
  var s = listCtlS(key), v = listCtlView(key);
  var narrowed = s.q || Object.keys(s.f || {}).some(function (k) { return s.f[k]; });
  if (v.all.length && narrowed) {
    return emptyState(icon || '🔍', tx('Nothing matches'),
      tx('No row here matches what you have typed or chosen. Clear the search or the filters to see the rest.'));
  }
  return emptyState(icon || '📄', title, sub);
}


/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * ⭐⭐⭐ THE TASK TABLE, WRITTEN ONCE — header · rows · column template · fit · hover peek · lazy rows · next level
 *
 * Athi, 2026-10-02: *"the same task header style has to be used in other places, so the information can be a proper
 * tabular format … if you expand the header show the next level of information"* and *"do not create new style
 * anywhere, the first question is how do i reuse."*
 *
 * ⚠️ MOVED, NOT COPIED, out of app.html (listHeader · rowGrid · colTemplate · fittedCols' arithmetic · rowPeek ·
 * lazyWrap and the CSS under them). The Task screen now calls THESE, and gives them what they used to read from
 * `UI.*` as arguments — the columns, the sort, the selection column — so CB Accounts (accounts.html, which does not
 * load app.html) draws its Waiting, Day book, Dues, ledger and party lists with the very same code. A screen that
 * draws its own rows is wrong even if it looks right (CLAUDE.md rule 5; e2e/books-web-breaks.cjs proves it is caught).
 *
 * A column is { key, label, w:'112px'|'minmax(110px,1.2fr)', align:'right'?, sort?, cell(row) → html }. Nothing here
 * decides what a row says: the screen's `cell` paints what the server sent.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/* the table's look — the rules app.html always carried, injected FIRST in <head> so the Task screen's own variants
   (.lrow.unread · .lrow.sel · .acc-*, which stay in app.html) still win the cascade exactly as before */
var TBL_CSS = [
  ".listend{text-align:center;padding:12px 10px;font-size:var(--fs-1);color:var(--grey);font-family:'Space Mono'}",
  ".listend button{margin-inline-end:8px}",
  ".lhead{display:grid;align-items:center;gap:8px;position:sticky;top:0;z-index:3;background:var(--card);border-bottom:1.5px solid var(--line);padding:7px 12px;font-size:var(--fs-1);font-weight:700;color:var(--grey);text-transform:uppercase;letter-spacing:.3px}",
  ".lhcell{display:flex;align-items:center;white-space:nowrap;overflow:hidden}",
  ".lhcell.sortable{cursor:pointer}.lhcell.sortable:hover{color:var(--blue)}",
  ".sarr{font-size:var(--fs-1);margin-inline-start:3px;color:var(--blue)}",
  ".lrow{display:grid;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer;font-size:var(--fs-2)}",
  ".lrow:hover{background:var(--paper)}",
  "#rowpeek{position:fixed;display:none;z-index:60;pointer-events:none;max-width:340px;background:var(--card);border:1px solid var(--line);border-radius:9px;box-shadow:0 8px 26px rgba(20,30,40,.16);padding:9px 11px;font-size:var(--fs-2);line-height:1.45}",
  "#rowpeek .pkr{display:flex;gap:10px;padding:2px 0}",
  "#rowpeek .pkr+.pkr{border-top:1px solid #f0f3f5}",
  "#rowpeek .pkk{flex:0 0 84px;color:var(--grey);font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.3px}",
  "#rowpeek .pkv{flex:1;min-width:0;color:var(--ink);overflow-wrap:anywhere}",
  ".lcell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  ".lcell.ra{text-align:end}",
  ".lhcell.ra{justify-content:flex-end}",
  ".lhcell{position:relative}",
  ".colrz{position:absolute;inset-inline-end:0;top:0;bottom:0;width:7px;cursor:col-resize;z-index:2}",
  ".colrz:hover{background:var(--blue);opacity:.5}",
  ".lhead .lhcell:not(:last-child){border-inline-end:1px solid var(--line)}",
  ".lrow .lcell:not(:last-child){border-inline-end:1px solid var(--line)}",
  ".lhcell{padding-inline-end:4px}",
  ".lcell{padding-inline-end:4px}",
  ".colrz:hover{background:var(--blue);opacity:.35}",
  /* the same rows on a narrow pane (or a phone): one card a row, each cell named by its column — only for tables that
     opt in with the .tblx wrapper (CB Accounts); the Task screen's own fitting is untouched */
  ".tblx{container:tblx/inline-size;min-width:0}",
  "@container tblx (max-width:560px){.tblx .lhead{display:none}.tblx .lrow{display:flex;flex-wrap:wrap;gap:2px 10px;border:1px solid var(--line);border-radius:12px;margin:6px 0;padding:9px 10px}.tblx .lrow .lcell{border:0;white-space:normal;padding:0;flex:0 1 auto;max-width:100%}.tblx .lrow .lcell:first-child{flex:1 1 100%;font-weight:600}.tblx .lrow .lcell[data-l]:not(:first-child):not(:empty)::before{content:attr(data-l) \" · \";color:var(--grey);font-size:var(--fs-1)}.tblx .lrow .lcell.ra{text-align:start}}",
].join('\n');
(function () {
  if (typeof document === 'undefined' || !document.head || document.getElementById('tbl_css')) return;
  var s = document.createElement('style'); s.id = 'tbl_css'; s.textContent = TBL_CSS;
  document.head.insertBefore(s, document.head.firstChild);
})();

/**
 * ⚠️ THE DECLARED MINIMUM, DELIBERATELY NOT A MANUAL WIDTH. A manual column resize is a PREFERENCE — "give Subject more
 * room" — and it was being read as a FLOOR. Athi had dragged Subject to 269px; that 269 then outranked Amount and
 * Status in the fit and pushed both off the right edge. Dragging one column wider must never evict another.
 */
function colMinPx(c) { var m = /(\d+(?:\.\d+)?)px/.exec(c.w); return m ? parseFloat(m[1]) : 80; }

/**
 * ⭐ FIT THE COLUMNS TO THE PANE (Task: 1089px of columns in a 653px pane, five unreachable). `prio` lists column keys
 * best-first; columns are dropped lowest-first until the rest fit. ⚠️ THE TOP-PRIORITY COLUMN IS UNCONDITIONAL — a row
 * you cannot identify is not a row. Whatever is folded away is shown in full by the hover peek (tblPeekShow).
 */
function tblFit(chosen, avail, prio) {
  if (!chosen.length) return chosen;
  var order = chosen.slice().sort(function (a, b) { return prio.indexOf(a.key) - prio.indexOf(b.key); });
  var must = order[0], keep = {}; keep[must.key] = 1; var used = colMinPx(must);
  order.slice(1).forEach(function (c) { var need = colMinPx(c) + 8; if (used + need <= avail) { keep[c.key] = 1; used += need; } });
  return chosen.filter(function (c) { return keep[c.key]; });
}
/** the grid template: an optional lead track (the Task's select box), then each column's width — a manual width map wins */
function tblTemplate(cols, o) {
  o = o || {};
  return (o.lead || '') + cols.map(function (c) { return (o.w && o.w[c.key]) ? o.w[c.key] : c.w; }).join(' ');
}
/**
 * the header: sortable cells call `o.onSort(key)` (a global function NAME, so the markup stays an onclick), the resize
 * handle calls `o.onResize(event, key)`. `o.sort`/`o.dir` say which arrow is lit; `o.label(col)` renames a heading.
 */
function tblHeaderHTML(cols, o) {
  o = o || {};
  var cells = cols.map(function (c) {
    var active = o.sort === c.sort && c.sort, arrow = active ? (o.dir === 'asc' ? ' ▲' : ' ▼') : (c.sort ? ' ⇅' : '');
    return '<span class="lhcell' + (c.sort ? ' sortable' : '') + (c.align === 'right' ? ' ra' : '') + '" ' + (c.sort && o.onSort ? ('onclick="' + o.onSort + '(' + (o.arg ? '\'' + o.arg + '\',' : '') + '\'' + c.sort + '\')"') : '') + '>'
      + esc(o.label ? o.label(c) : c.label) + '<span class="sarr">' + arrow + '</span>'
      + (o.onResize ? '<span class="colrz" onmousedown="' + o.onResize + '(event,\'' + c.key + '\')" onclick="event.stopPropagation()"></span>' : '') + '</span>';
  }).join('');
  return '<div class="lhead" style="grid-template-columns:var(--coltpl)">' + (o.lead || '') + cells + '</div>';
}
/**
 * one row. `o.cls` extra classes · `o.lead` a leading cell · `o.attrs` extra attributes (a leading space) · `o.click` the
 * onclick body · `o.tid` a data-testid. `o.labels` puts each column's label on its cell (data-l) so a narrow pane can name it (the .tblx card fold).
 */
function tblRowHTML(cols, row, o) {
  o = o || {};
  var cells = cols.map(function (col) {
    return '<span class="lcell' + (col.align === 'right' ? ' ra' : '') + '"' + (o.labels ? ' data-l="' + esc(col.label || '') + '"' : '') + (col.tid ? ' data-testid="' + esc(col.tid(row)) + '"' : '') + '>' + col.cell(row) + '</span>';
  }).join('');
  return '<div class="lrow ' + (o.cls || '') + '" style="grid-template-columns:' + (o.tpl || 'var(--coltpl)') + '"' + (o.tid ? ' data-testid="' + esc(o.tid) + '"' : '') + (o.attrs || '') + (o.click ? ' onclick="' + o.click + '"' : '') + '>' + (o.lead || '') + cells + '</div>';
}
/** ⭐ A TABLE's wrapper: carries the column template the header and rows read (--coltpl), and opts into the card fold */
function tblWrapHTML(cols, inner, o) {
  o = o || {};
  return '<div class="' + (o.plain ? '' : 'tblx') + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + (o.tid ? ' data-testid="' + esc(o.tid) + '"' : '') + ' style="--coltpl:' + tblTemplate(cols, o) + '">' + inner + '</div>';
}

/**
 * ⭐ A ROW'S NEXT LEVEL — the way Task's Group sum opens one (cap-folders.js gsToggle/_groupSumPane): a caret, and under the
 * row an indented block on the card colour. Rows inside it are `tblNextRow(cells, widths)`: the first cell takes the room,
 * the others are fixed-width and right-aligned, like the drill-down under a Group-sum item.
 */
function tblCaretHTML(open) { return open ? '▾' : '<span class=arw>▸</span>'; }
function tblNextHTML(inner, tid) { return '<div' + (tid ? ' data-testid="' + esc(tid) + '"' : '') + ' style="padding:2px 0 8px 16px;background:var(--card);color:var(--on-card)">' + inner + '</div>'; }
function tblNextRow(cells, widths) {
  return '<div style="display:flex;align-items:center;font-size:var(--fs-2);padding:3px 0">' + cells.map(function (c, i) {
    return i === 0 ? '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + c + '</span>'
      : '<span style="width:' + ((widths && widths[i - 1]) || 110) + 'px;text-align:end">' + c + '</span>';
  }).join('') + '</div>';
}

/* ── the hover peek: the ENTIRE line, including every column the fold dropped (rowpeek is one element for the page) ── */
function tblPeekShow(ev, cols, row, o) {
  o = o || {};
  var rows = cols.map(function (col) {
    if (o.skip && o.skip(col)) return '';
    var v = ''; try { v = col.cell(row) || ''; } catch (_) { return ''; }
    var plain = String(v).replace(/<[^>]*>/g, '').trim();
    if (!plain || plain === '—') return '';                 /* the em-dash placeholder is "no value" — do not restate it */
    if (o.noTid) v = String(v).replace(/ data-testid="[^"]*"/g, '');   /* the peek is a copy: a second element with the same test id would make the real one ambiguous */
    return '<div class="pkr"><span class="pkk">' + esc(o.label ? o.label(col) : col.label) + '</span><span class="pkv">' + v + '</span></div>';
  }).join('');
  if (!rows) return;
  var e = document.getElementById('rowpeek');
  if (!e) { e = document.createElement('div'); e.id = 'rowpeek'; document.body.appendChild(e); }
  e.innerHTML = rows; e.style.display = 'block';
  var r = ev.currentTarget.getBoundingClientRect(), b = e.getBoundingClientRect();
  e.style.top = Math.max(8, Math.min(r.top, window.innerHeight - b.height - 12)) + 'px';
  e.style.left = Math.max(8, Math.min(r.right + 10, window.innerWidth - b.width - 12)) + 'px';
}
function tblPeekHide() { var e = document.getElementById('rowpeek'); if (e) e.style.display = 'none'; }

/* ── a declared list drawn as a Task table: its rows, a click on a header sorts by it, the count above ── */
/**
 * `tblList(key, cols, rowFn)` — the table for list `key` (declared with listCtl): the header (a click on a sortable heading
 * picks the list's sort of that key, a second click reverses it), then every matched row through `rowFn(row, i)` (which
 * returns tblRowHTML(...) plus any open next level) handed to lazyWrap. Returns the whole table, wrapper included.
 */
function tblList(key, cols, rowFn, emptyHTML, o) {
  o = o || {};
  var s = listCtlS(key), sorts = (s.cfg && s.cfg.sorts) || [], cur = sorts[s.sort] || sorts[0] || {};
  var head = tblHeaderHTML(cols, { sort: cur.key, dir: s.rev ? 'desc' : 'asc', onSort: 'tblSortBy', arg: key, label: o.label, lead: o.lead });
  return tblWrapHTML(cols, head + (o.rows ? o.rows : listCtlRowsHTML(key, rowFn, emptyHTML)), o);
}
/** a heading was clicked: the list's sort with that key (declared by the screen), reversed when it is already the one */
function tblSortBy(key, sortKey) {
  var s = listCtlS(key), sorts = (s.cfg && s.cfg.sorts) || [], i = -1;
  sorts.forEach(function (x, n) { if (x.key === sortKey && i < 0) i = n; });
  if (i < 0) return;
  if (s.sort === i) s.rev = !s.rev; else { s.sort = i; s.rev = false; }
  listCtlResetRows(key); if (s.cfg && s.cfg.repaint) s.cfg.repaint();
}


/**
 * ══ A SCREEN'S LIST AS THE TASK TABLE — declare it once, paint it, open a row's next level ═══════════════════════════
 * What the Ledger's lists (Waiting · Day book · Dues · the ledgers) and the CRM's Customers and Suppliers all do the same way:
 * `tblDeclare(key, {rows, text, sorts, filters, paint})` declares the list (listCtl*: search · filters · sort · count),
 * `tblListHTML(key)` is its controls and the box it paints into, `tblListPaint(key)` paints it. A screen's `paint()` fits the
 * columns to the box (`tblFitBox`), draws the header (`tblHeadFor`) and each row (`tblRowFor`: the Task row, its hover peek,
 * and — when the row is open — its next level under it). The screen declares columns and says what a next level holds; it draws
 * no row, card or expander of its own (e2e/books-web-breaks.cjs proves a screen that does is caught).
 */
var TBL_OPEN = {};   /* 'list:id' → its next level is open */
function tblIsOpen(list, id) { return !!TBL_OPEN[list + ':' + id]; }
function tblRepaint(list) { var c = listCtlS(list).cfg; if (c && c.repaint) c.repaint(); }
function tblToggle(list, id) { var k = list + ':' + id; if (TBL_OPEN[k]) delete TBL_OPEN[k]; else TBL_OPEN[k] = true; tblRepaint(list); }
/** the caret of a row — Task's Group sum draws ▸ / ▾ the same way (tblCaretHTML) */
function tblCaret(list, id) {
  var open = tblIsOpen(list, id);
  return '<span role="button" aria-label="' + esc(tx(open ? 'Collapse' : 'Expand')) + '" aria-expanded="' + open + '" style="cursor:pointer;display:inline-block;width:14px;color:var(--grey)" onclick="event.stopPropagation();tblToggle(\'' + list + '\',\'' + esc(id) + '\')">' + tblCaretHTML(open) + '</span>';
}
/** the pane's width for fitting columns: a card per row (no fitting) below 560px, else what the box holds */
function tblAvail(id, plain) {
  var el = document.getElementById(id), w;
  if (el) w = el.clientWidth;
  /* not on screen yet (the first paint is a string): a rail is as wide as the screen says its pane is — the Task list reads UI.lw the same way */
  else if (plain && typeof UI !== 'undefined') w = (UI.vp === 'mob') ? window.innerWidth : (UI[typeof lwKey === 'function' ? lwKey() : 'lw'] || UI.lw || 340);
  else w = (document.getElementById('bk_body') || document.body).clientWidth || 900;
  return (w <= 560 && !plain) ? 9999 : w - 24;
}
/** the pane was dragged: every rail-style table (the CRM's) that is on screen is fitted again, as applyColTpl does for Task */
function tblRefitRails() { Object.keys(TBL_PEEK).forEach(function (k) { if (TBL_PEEK[k].plain && document.getElementById(TBL_PEEK[k].box)) tblRepaint(k); }); }
/** a declared list's markup: its controls, its count, and the box its table is painted into (tblListPaint) */
function tblListHTML(key, extra) {
  return listCtlToolbarHTML(key) + (extra || '') + '<div class="bkdv-count" id="bkc_' + key + '" data-testid="' + key + '-count"></div><div id="bkl_' + key + '" data-testid="' + key + '-list"></div>';
}
function tblListPaint(key) {
  var c = listCtlS(key).cfg, box = document.getElementById('bkl_' + key); if (!c || !box) return;
  box.innerHTML = c.paint();
  var n = document.getElementById('bkc_' + key); if (n) n.innerHTML = listCtlCountHTML(key);
}
/** declare a list once: the screen's rows, text, sorts, filters, and `paint()` (its table); the repaint is the same for all */
function tblDeclare(key, cfg) {
  cfg.repaint = cfg.repaint || function () { tblListPaint(key); };
  return listCtl(key, cfg);
}
/* a table's fitted columns, its header and its hover peek (the peek shows every column, the fitted ones and the folded) */
var TBL_PEEK = {};
/* `plain` = a rail (the CRM's lists, like the Task list): the columns that do not fit are folded away and the hover peek shows them — no card fold */
function tblFitBox(key, cols, prio, boxId, plain) { TBL_PEEK[key] = { cols: cols, by: {}, plain: !!plain, box: boxId }; return tblFit(cols, tblAvail(boxId, plain), prio || cols.map(function (c) { return c.key; })); }
function tblWrapFor(key, fit, inner, o) { o = o || {}; o.plain = !!(TBL_PEEK[key] && TBL_PEEK[key].plain); return tblWrapHTML(fit, inner, o); }
function tblHeadFor(key, fit) {
  var s = listCtlS(key), sorts = (s.cfg && s.cfg.sorts) || [], cur = sorts[s.sort] || sorts[0] || {};
  return tblHeaderHTML(fit, { sort: cur.key, dir: s.rev ? 'desc' : 'asc', onSort: 'tblSortBy', arg: key });
}
function tblPeek(ev, key, id) { var p = TBL_PEEK[key], row = p && p.by[id]; if (p && row) tblPeekShow(ev, p.cols, row, { noTid: true }); }
/** one row of list `key`: the Task row, its hover peek, and (open) its next level under it */
function tblRowFor(key, fit, row, id, o, next) {
  o = o || {}; TBL_PEEK[key].by[id] = row;
  return tblRowHTML(fit, row, { cls: o.cls, tid: o.tid, labels: !TBL_PEEK[key].plain, click: o.click, lead: o.lead,
    attrs: ' data-id="' + esc(id) + '" onmouseenter="tblPeek(event,\'' + key + '\',\'' + esc(id) + '\')" onmouseleave="tblPeekHide()"' + (o.attrs || '') })
    + (tblIsOpen(key, id) && next ? (typeof next === 'function' ? next() : next) : '');
}


/* ═══ ⭐ UNIVERSAL CLIENT-SIDE LAZY LIST — MOVED from app.html (the Task screen, the catalogue and every list keep calling lazyWrap) ═══ */
/* ── universal client-side lazy list — reveals N rows at a time in ANY container ────────────
   IntersectionObserver auto-reveal + a "Show more" button fallback (never stuck) + total/end marker.
   For lists whose endpoint returns everything at once: lazyWrap(id, items, cardFn, emptyHtml). */
var LAZY = {};
/**
 * ── ⚠️⚠️⚠️ A REPAINT MUST NOT TAKE BACK THE ROWS SOMEBODY ASKED FOR ───────────────────────────────────────────
 *
 * Athi, INC-260912-0XJN: *"it says 500 products but only 12 rows are listed."*
 *
 * ⚠️⚠️ AND THE COUNT WAS RIGHT. `shown` was reset to 50 on EVERY rebuild — and this list rebuilds constantly:
 * the twenty-second refresh, the categories arriving, the tax slabs, the offers, every late loader calls
 * paintProdList. So you press "Show 50 more" three times, reach row 200, a timer fires, and you are back at
 * fifty while the header still says how many there really are. Measured on the deployed page: revealed 60,
 * repainted, `LAZY.prodlist.shown` was 50 again.
 *
 * ⚠️ AND IT TOOK THE SCROLL WITH IT. paintProdList carefully restores scrollTop onto a box that just lost
 * three quarters of its height, so the restore lands past the end and the list jumps. Two symptoms, one cause.
 *
 * ⭐ SO THE WINDOW IS KEPT, and it is kept HERE rather than at the one call site that complained — the same
 * reset was under the chit history, the message thread and both dispute lists, none of which had been
 * noticed. [[feedback-repaint-locally]]
 *
 * ⚠️ KEPT ONLY WHILE IT STILL FITS. If the list has shrunk below what was revealed — a filter narrowed it,
 * rows were deleted — the window goes back to one chunk: showing "150 of 12" is a worse lie than collapsing.
 * ⚠️ And never below `chunk`, so a list that grows never shows fewer rows than a fresh one would.
 */
function lazyWrap(id, items, cardFn, empty){ items = items || [];
  const kept = LAZY[id];
  if(kept && kept._io){ try{ kept._io.disconnect(); }catch(_){} }
  if(!items.length) return empty || '';
  const chunk = 50;
  var shown = Math.min(chunk, items.length);
  if(kept && kept.shown > shown && kept.shown <= items.length) shown = kept.shown;
  LAZY[id] = { items, cardFn, chunk, shown: shown, total: items.length, _io:null };
  setTimeout(function(){ lazyAttach(id); }, 0);
  return items.slice(0, LAZY[id].shown).map(cardFn).join("") + lazyBar(id); }
function lazyBar(id){ const s=LAZY[id]; if(!s) return ''; const left=s.total-s.shown;
  const inner = left<=0 ? ('<div class="listend">'+s.total+' total · end of list</div>')
    : ('<div class="listend"><button class="composebtn" onclick="lazyReveal(\''+id+'\')">↓ Show '+Math.min(s.chunk,left)+' more</button> <span style="color:var(--grey)">'+s.shown+' of '+s.total+'</span></div>');
  return '<div class="lazysent" id="lzs_'+id+'">'+inner+'</div>'; }
function lazyReveal(id){ const s=LAZY[id]; if(!s) return; const sent=document.getElementById('lzs_'+id); if(!sent) return;
  const next=s.items.slice(s.shown, s.shown+s.chunk); if(next.length){ sent.insertAdjacentHTML('beforebegin', next.map(s.cardFn).join("")); s.shown+=next.length; }
  const left=s.total-s.shown;
  if(left<=0){ sent.innerHTML='<div class="listend">'+s.total+' total · end of list</div>'; if(s._io){ try{s._io.disconnect();}catch(_){} s._io=null; } }
  else sent.innerHTML='<div class="listend"><button class="composebtn" onclick="lazyReveal(\''+id+'\')">↓ Show '+Math.min(s.chunk,left)+' more</button> <span style="color:var(--grey)">'+s.shown+' of '+s.total+'</span></div>'; }
function lazyAttach(id){ const s=LAZY[id]; if(!s || s.shown>=s.total) return; const sent=document.getElementById('lzs_'+id); if(!sent) return;
  try{ s._io = new IntersectionObserver(function(es){ if(es.some(function(e){return e.isIntersecting;})) lazyReveal(id); }, {rootMargin:'0px'}); s._io.observe(sent); }catch(_){} }
