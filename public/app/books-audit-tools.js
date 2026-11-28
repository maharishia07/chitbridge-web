/**
 * books-audit-tools.js — ONEP-2 PR 7a: the auditor's tools on the Day book, ONE module for every screen that shows them.
 *
 * OWNS      the "changed since my last check" bar and Mark as checked, the Risk note and the Risk cell, the c / q row keys, the narrowing in the address, and the one seat test (seatOn) that says whether these tools are drawn at all
 * CALLED BY cap-books.js (bkDaybook: the owner's Day book, in a firm seat) · books-grant-marks.js · books-grant-cells.js · books-grant-list.js (the firm view, until PR 7b removes its Day book)
 * FLOW      seatOn(mk) → the page draws sinceBar / the mark bar / the JET filters (books-grant-filters.js) / riskNote; a press asks the SAME calls the firm view always asked (mark control → the page's call; practiceBaseline → the grant route), the server decides every write
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * Nothing here adds up, judges or writes by itself: the server's `seen_to`, `total`, `since` and `mark_actions` are carried, and every act is the person's own. A seat with no firm grant (the owner, a bookkeeper) never gets a tool: seatOn is false and nothing is drawn.
 *   CBBooksAuditTools.seatOn(mk) · .sinceAsked() · .sinceBar(o) · .markChecked(o) · .riskNote() · .riskCell(row) · .keys(host, o) · .narrowAddress(filt, names) · .TABROW_CSS
 */
(function (root) {
  'use strict';
  var MARK_CODE = 'NET005-B09';
  var TOGGLE_CODE = 'NET005-B08';
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function esc(s) {
    return typeof root.esc === 'function' ? root.esc(s) : String(s == null ? '' : s);
  }
  /** the ONE seat test: a firm seat (an auditor or an adviser acting for a client) AND the server says marking is on for it (mark_actions). The owner and a bookkeeper have no firm seat, so they get none of these tools */
  function firmSeat() {
    var seat = root.CBBooksActing && root.CBBooksActing.current ? root.CBBooksActing.current() : null;
    return !!seat && (seat.role === 'auditor' || seat.role === 'adviser');
  }
  function seatOn(mk) {
    return firmSeat() && !!(mk && mk.state && mk.state().may);
  }
  var SINCE_LIMIT = 500; /* the since read is ONE call of at most this many entries */
  /* ── rank 10: changed since my last check. The Day book can be read as "the entries posted since THIS person last pressed Mark as checked on this client" (api: GET /daybook?since=mine; the server holds the check point and
     the count, this module adds nothing up). Mark as checked sends back the watermark the list carried (seen_to), never a moment of its own. The act is the person's own (POST /api/books-grants/practice/baseline), never the client's. ── */
  function sinceAsked() {
    try { return new root.URLSearchParams(root.location.search).get('since') === 'mine'; } catch (failure) { if (root.cbQuiet) root.cbQuiet('books-audit:since', failure); return false; }
  }
  /** the one control: Changed since my last check (a toggle on the Day book), and in that view the count and Mark as checked. o = { on, seen: { to, total, since }, shown: how many entries the list holds } */
  function sinceBar(o) {
    var toggle = '<button type="button" class="act quiet" id="bv_since" aria-pressed="' + !!o.on + '" data-cbsid="' + TOGGLE_CODE + '" data-testid="bv-since">' + esc(words(o.on ? 'Back to the period' : 'Changed since my last check')) + '</button>';
    var line = o.on && o.seen ? sinceLine(o.seen, o.shown) : '';
    return '<div class="bv-since" data-testid="bv-since-bar" role="group" aria-label="' + esc(words('Changed since my last check')) + '" style="display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0">' + toggle + line + '</div>';
  }
  /** in the since view: how many entries were posted since, and (when every one is listed) Mark as checked */
  function sinceLine(seen, shown) {
    var count = Number(seen.total || 0);
    return '<span class="sub" data-testid="bv-since-line">' + esc(count + ' ' + words(count === 1 ? 'entry posted since' : 'entries posted since') + ' ' + sinceFrom(seen.since)) + '</span>' + sinceAction(count, shown);
  }
  /** where the count starts: the day of the last check, or the start of the person's access */
  function sinceFrom(info) {
    if (info && info.never) return words('your access began');
    return info && info.at ? root.shopDay(info.at) : '';
  }
  /** nothing when no entry is new; the newest-N note when not every one is listed; Mark as checked when all are */
  function sinceAction(count, shown) {
    if (count <= 0) return '';
    if (count > shown) return '<span class="sub" data-testid="bv-since-more">' + esc(words('Showing the newest') + ' ' + shown + '. ' + words('Mark as checked waits until every entry is listed.')) + '</span>';
    return '<button type="button" class="act" id="bv_mark_checked" data-cbsid="' + MARK_CODE + '" data-testid="bv-mark-checked">' + esc(words('Mark as checked')) + '</button>';
  }
  /** the tab row carries the since toggle: one line at a laptop, never a row of its own */
  var TABROW_CSS = '<style>.bv-tabrow .act{white-space:nowrap}@media (max-width:700px){.bv-tabrow{row-gap:2px}}</style>';
  /** wire the two buttons: o = { toggle(on), markChecked(), on } */
  function wireSince(o) {
    var doc = root.document, tog = doc.getElementById('bv_since'), mark = doc.getElementById('bv_mark_checked');
    if (tog) tog.onclick = function () { o.toggle(!o.on); };
    if (mark) mark.onclick = o.markChecked;
  }
  /** the address records the since view (replace, never a new history entry) */
  function writeSince(on) {
    if (!root.history || !root.history.replaceState) return;
    try {
      var query = new root.URLSearchParams(root.location.search);
      if (on) query.set('since', 'mine'); else query.delete('since');
      root.history.replaceState(root.history.state, '', root.location.pathname + (query.toString() ? '?' + query.toString() : '') + (root.location.hash || ''));
    } catch (failure) { if (root.cbQuiet) root.cbQuiet('books-audit:since-address', failure); }
  }
  /** Mark as checked: asks first (it sets this client's count to 0 for this person), names the client and the point; then the server stores it. o = { seen: { to }, name, client, call, done() } — the write is the grant route's own (practiceBaseline), token only */
  function markChecked(o) {
    var seen = o.seen, name = o.name || words('this client');
    if (!seen || !seen.to || typeof root.CBConfirm !== 'function') return;
    var body = esc(words('Entries posted up to') + ' ' + root.shopDay(seen.to) + ' ' + words('will stop counting as changed. Anything posted after will still count.'));
    root.CBConfirm(words('Mark') + ' ' + name + ' ' + words('as checked?'), body, words('Mark as checked'), function () {
      root.CBBooksGrantApi.run(o.call, 'practiceBaseline', { body: { client: o.client, seen_to: seen.to } }).then(function () {
        if (root.toast) root.toast(words('Checked. Changes count from here.'));
        if (o.done) o.done();
      }, function (failure) {
        if (root.toast) root.toast((failure && failure.message) || words('We could not save that. Nothing was changed.'));
      });
    });
  }
  /* ── JET: the Risk note and the Risk cell. The rules themselves are books-grant-filters.js (riskOf), one definition each ── */
  /** NET005-P05: under the Day book, the fixed hours and day counts the Risk column and its filters use (one sentence; not a setting) */
  function riskNote() {
    return '<style>.bv-risk{display:inline-block;min-width:1.6em;text-align:center;border-radius:10px;padding:0 6px;background:var(--amber-t);color:var(--amber-i);font-weight:600}.bv-risknote{margin:6px 0;color:var(--muted);font-size:var(--fs-1,13px)}</style><div class="bv-risknote" data-cbsid="NET005-P05" data-testid="bv-risk-note">' + esc(words('Risk counts one point for each of: recorded after the period end · over 7 days late · at a weekend · after hours (8 pm to 7 am) · a round sum (multiple of 100) · no narration.')) + '</div>';
  }
  /** "1 risk" / "3 risks": the shell's txn (Intl.PluralRules of the reader's locale, the catalogue's one/other forms); English one/other when the page has no txn */
  function riskCount(n) {
    return typeof root.txn === 'function' ? root.txn('{count} risk', '{count} risks', n) : n + (n === 1 ? ' risk' : ' risks');
  }
  /** the Risk cell: the count, with the rules it counts as its title and as words for a reader; none = a dash. row.risk_list = the rules the entry trips (riskOf) */
  function riskCell(row) {
    var list = row.risk_list || [];
    return list.length ? '<span class="bv-risk" data-cbsid="NET005-P04" data-testid="bv-risk" role="img" aria-label="' + esc(riskCount(list.length) + ': ' + list.join(', ')) + '" title="' + esc(list.join(', ')) + '">' + list.length + '</span>' : '—';
  }
  /* ── A3C rank 8: on a focused Day book row "c" checks it and moves down, "q" opens its question; never while typing ── */
  /** o = { mark: () => the mark control, on: () => bool (the seat test), entryAt(rowEl) → the entry of that row } */
  function keys(host, o) {
    if (host.__bvKeys) return;
    host.__bvKeys = true;
    host.addEventListener('keydown', function (event) { onRowKey(host, o, event); });
  }
  /** c or q, on its own, and not while typing in a field */
  function isRowKey(event) {
    var target = event.target;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !target || !target.closest) return false;
    if (event.key !== 'c' && event.key !== 'q') return false;
    return !(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
  }
  /** the row, its entry and the mark helper a key press is for (null when the key is not ours: typing, a modifier, marking off, no row) */
  function keyedRow(host, o, event) {
    var mark = o.mark();
    if (!isRowKey(event) || !mark || !o.on()) return null;
    var rowEl = event.target.closest('[data-row]');
    var entry = rowEl ? o.entryAt(rowEl) : null;
    return entry && entry.entry_id ? { rowEl: rowEl, entry: entry, mark: mark } : null;
  }
  function onRowKey(host, o, event) {
    var keyed = keyedRow(host, o, event);
    if (!keyed) return;
    event.preventDefault();
    var entry = keyed.entry, mark = keyed.mark;
    if (event.key === 'q') { mark.sheet(entry.entry_id, { title: entry.entry_no, opener: keyed.rowEl }); return; }
    var rowsNow = [].slice.call(host.querySelectorAll('[data-row]')), next = rowsNow[rowsNow.indexOf(keyed.rowEl) + 1];
    if (mark.mayCheck(entry.entry_id) && mark.markOf(entry.entry_id).state === 'none') mark.set(entry.entry_id, 'clear', '', null);
    if (next) next.focus();
  }
  /** the narrowing rides the address (replace, never a new history entry): the page's address with the filter words in place of the old ones. filt = the choices in force; names = the filter keys this page owns */
  function narrowAddress(filt, names) {
    var F = root.CBBooksGrantFilters;
    if (!F || !root.history || !root.history.replaceState) return;
    try {
      var query = new root.URLSearchParams(root.location.search), mine = {};
      F.paramNames().forEach(function (name) { query.delete(name); });
      (names || []).forEach(function (key) { if (filt && filt[key]) mine[key] = filt[key]; });
      var more = F.toAddress(mine), text = query.toString() + (more ? (query.toString() ? '&' : '') + more : '');
      var url = root.location.pathname + (text ? '?' + text : '') + (root.location.hash || '');
      if (url !== root.location.pathname + root.location.search + (root.location.hash || '')) root.history.replaceState(root.history.state, '', url);
    } catch (failure) { if (root.cbQuiet) root.cbQuiet('books-audit:narrowing', failure); }
  }
  root.CBBooksAuditTools = { firmSeat: firmSeat, SINCE_LIMIT: SINCE_LIMIT, seatOn: seatOn, sinceAsked: sinceAsked, sinceBar: sinceBar, wireSince: wireSince, writeSince: writeSince, markChecked: markChecked, riskNote: riskNote, riskCell: riskCell, keys: keys, narrowAddress: narrowAddress, TABROW_CSS: TABROW_CSS };
})(typeof window !== 'undefined' ? window : globalThis);
