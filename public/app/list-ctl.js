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
 */
'use strict';

/** key → { cfg, q, sort, f:{}, shown } — one entry per list, kept across repaints so a search survives one */
var LISTCTL = {};

var LISTCTL_CHUNK = 60;

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
  var s = LISTCTL[key] || (LISTCTL[key] = { q: '', sort: 0, f: {}, shown: LISTCTL_CHUNK });
  s.cfg = cfg;
  return s;
}
function listCtlS(key) { return LISTCTL[key] || { cfg: null, q: '', sort: 0, f: {}, shown: LISTCTL_CHUNK }; }

/**
 * What the screen should draw: everything, what matched, and the slice to render.
 * ⚠️ `matched` is computed every call rather than cached. A cached count is a count that disagrees with the rows
 * the first time somebody adds a customer without telling the cache.
 */
function listCtlView(key) {
  var s = listCtlS(key), c = s.cfg;
  if (!c) return { all: [], matched: [], shown: [], more: 0 };
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
  var shown = matched.slice(0, s.shown);
  return { all: all, matched: matched, shown: shown, more: matched.length - shown.length };
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
  return esc(v.matched.length + ' ' + plural)
    + (narrowed ? ' <span style="color:var(--grey-4)">' + esc(tx('of') + ' ' + v.all.length) + '</span>' : '')
    + (v.more > 0 ? ' <span style="color:var(--grey-4)">· ' + esc(tx('showing') + ' ' + v.shown.length) + '</span>' : '');
}

/** put on the scrolling rows container: grows the slice as the end comes into view */
function listCtlScrollAttr(key) { return 'onscroll="listCtlMore(\'' + esc(key) + '\',this)"'; }

function listCtlMore(key, el) {
  var s = listCtlS(key);
  if (!el || !s.cfg) return;
  if (el.scrollTop + el.clientHeight < el.scrollHeight - 240) return;      /* not near the end yet */
  var v = listCtlView(key);
  if (v.more <= 0) return;
  s.shown += LISTCTL_CHUNK;
  /* ⚠️ the repaint must KEEP the scroll position, or growing the list throws the reader back to the top — which
     is worse than a short list, because it looks like the app lost their place. */
  var top = el.scrollTop;
  if (s.cfg.repaint) s.cfg.repaint();
  var again = document.getElementById(el.id);
  if (again) again.scrollTop = top;
}

/* ⚠️ EVERY CHANGE RESETS THE SLICE. Searching while scrolled 400 rows down and keeping `shown` at 400 would
   render the whole of a narrower answer at once — and, worse, look identical to no filtering having happened. */
function listCtlSetQ(key, v) { var s = listCtlS(key); s.q = v; s.shown = LISTCTL_CHUNK; if (s.cfg && s.cfg.repaint) s.cfg.repaint(); }
function listCtlSetFilter(key, f, v) { var s = listCtlS(key); s.f[f] = v; s.shown = LISTCTL_CHUNK; if (s.cfg && s.cfg.repaint) s.cfg.repaint(); }
function listCtlSetSort(key, i) { var s = listCtlS(key); s.sort = Number(i) || 0; s.shown = LISTCTL_CHUNK; if (s.cfg && s.cfg.repaint) s.cfg.repaint(); }

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
