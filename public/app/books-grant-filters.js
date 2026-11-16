/**
 * books-grant-filters.js — A3C rank 3 (auditor paper 17 Nov): REVIEW BY EXCEPTION on the Day book. The filters the one list control (list-ctl.js `filters:`) draws above the auditor's Day book.
 *
 * OWNS      the three filters Mark · Evidence · Type and the address words that carry them (&dbf_mark= &dbf_ev= &dbf_kind=, so a reload or a shared link opens the same narrowing)
 * CALLED BY books-grant-view.js (the Day book's list configuration)
 * FLOW      filtersFor(mk) → the list's `filters:` → each choice is answered by the SAME three one-definitions the rows already paint: the mark control's class of the entry (cap-mark.js markOf) ·
 *           the evidence chip's key (cap-evidence.js stateOf) · the Day book's kind (helpers.js dayBookKind). Nothing is counted or decided here: the list counts what matches.
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * "Not checked" is everything the bar's "Checked n of m" does not count: no mark, a check that changed after review, a query, a hold, a refusal. So Not checked = m − n and Checked + Not checked = every row (tests/a3c-day-book-exception).
 *   CBBooksGrantFilters.carry(search, clientId) · .filtersFor(mk) · .markState(mk, row) · .evidenceKey(row) · .kindOf(row) · .toAddress(filt) · .fromAddress(search)
 */
(function (root) {
  'use strict';
  var PARAM = { mark: 'dbf_mark', ev: 'dbf_ev', kind: 'dbf_kind' };

  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  /** the mark's class for the entry row ('none' · 'clear' · 'open' · 'hold' · 'reject') and whether a check still holds */
  function markState(mk, row) {
    var m = mk && row ? mk.markOf(row.entry_id) : null;
    return m || { state: 'none', altered: false };
  }
  /** a check that still holds: the ONLY thing the bar's "Checked n of m" counts (the server's stillCleared); everything else, queried and on hold included, is "Not checked" (so Not checked = m − n) */
  function isChecked(mk, row) {
    var m = markState(mk, row);
    return m.state === 'clear' && !m.altered;
  }
  /** the evidence chip's own key (flag · none · nodoc · held); '' when the server sent no evidence on the entry */
  function evidenceKey(row) {
    var ev = row && row.evidence;
    if (!ev || !root.CBEvidence || !root.CBEvidence.stateOf) return '';
    return root.CBEvidence.stateOf(ev).key;
  }
  function kindOf(row) {
    return root.dayBookKind(row);
  }
  function opts(list) {
    return list.map(function (o) { return { v: o[0], label: words(o[1]) }; });
  }
  function filtersFor(mk) {
    var EV = (root.CBEvidence && root.CBEvidence.words) || { flag: 'No tax invoice', none: 'No file', nodoc: 'No source', held: 'File attached' }; /* the chip's own words: one wording per state */
    return [
      { key: 'mark', label: words('Mark'), all: words('All'), options: opts([['notchecked', 'Not checked'], ['checked', 'Checked'], ['hold', 'On hold'], ['query', 'Queried']]), match: function (row, v) { var st = markState(mk, row).state; return v === 'checked' ? isChecked(mk, row) : v === 'notchecked' ? !isChecked(mk, row) : v === 'hold' ? st === 'hold' : st === 'open'; } },
      { key: 'ev', label: words('Evidence'), all: words('All'), options: opts([['flag', EV.flag], ['none', EV.none], ['nodoc', EV.nodoc], ['held', EV.held]]), match: function (row, v) { return evidenceKey(row) === v; } },
      { key: 'kind', label: words('Type'), all: words('All'), options: opts([['Sales', 'Sales'], ['Purchases', 'Purchases'], ['Expenses', 'Expenses'], ['Returns', 'Returns'], ['Receipts', 'Receipts'], ['Payments', 'Payments'], ['Other', 'Journals and other']]), match: function (row, v) { return kindOf(row) === v; } }
    ];
  }
  /** the choices in force → the address words (only the ones set) */
  function toAddress(filt) {
    var out = '';
    Object.keys(PARAM).forEach(function (k) { if (filt && filt[k]) out += (out ? '&' : '') + PARAM[k] + '=' + encodeURIComponent(filt[k]); });
    return out;
  }
  /** the address → the choices ({} when none): a value the list does not offer is dropped by the list itself (cleanFilters) */
  function fromAddress(search) {
    var q = new root.URLSearchParams(search || ''), out = {};
    Object.keys(PARAM).forEach(function (k) { var v = q.get(PARAM[k]); if (v) out[k] = v; });
    return out;
  }
  /** the filter words already in the address, as '&dbf_..=..' to append to the client's address (so the address the page writes for itself does not wipe them) */
  function carry(search, clientId) {
    var open = new root.URLSearchParams(search || '').get('open');
    if (clientId && open !== clientId) return ''; /* another client's narrowing never follows to this one */
    var text = toAddress(fromAddress(search));
    return text ? '&' + text : '';
  }
  root.CBBooksGrantFilters = { carry: carry, filtersFor: filtersFor, markState: markState, isChecked: isChecked, evidenceKey: evidenceKey, kindOf: kindOf, toAddress: toAddress, fromAddress: fromAddress };
}(typeof window !== 'undefined' ? window : globalThis));
