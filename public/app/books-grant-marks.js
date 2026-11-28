/**
 * books-grant-marks.js — ACC-358 part of books-grant-view.js: the reviewer's own tools on the Day book.
 *
 * OWNS      the mark bar and the Query sheet wiring (cap-mark.js), the evidence chips (cap-evidence.js), my private flags and explanations (cap-flag.js), the firm's queues mount, the bank line under the trial balance, and the Changed-since-my-last-check bar with Mark as checked
 * CALLED BY books-grant-view.js (through root.CBBooksGrantKit)
 * FLOW      newMarks() builds the three helpers for the open client; paintMarkBar(report) draws the bar; setSince(on) re-reads the Day book since the person's check point
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * Every act is the person's own and goes through the page's call; this file adds nothing up. Loaded before books-grant-view.js (network.html).
 */
(function (root) {
  'use strict';
  var grantKit = root.CBBooksGrantKit; /* created by books-grant-reports.js, which loads first */
  grantKit.sinceAsked = sinceAsked;
  grantKit.sinceBar = sinceBar;
  grantKit.wireSince = wireSince;
  grantKit.markable = markable;
  grantKit.paintMarkBar = paintMarkBar;
  grantKit.explainId = explainId;
  grantKit.explainOn = explainOn;
  grantKit.explainCell = explainCell;
  grantKit.flagsOn = flagsOn;
  grantKit.flagLabel = flagLabel;
  grantKit.newMarks = newMarks;
  grantKit.mountQueues = mountQueues;
  /* ── rank 10: changed since my last check. The Day book can be read as "the entries posted since THIS person last pressed Mark as checked on this client" (api: GET /daybook?since=mine; the server holds the check point and
     the count, this page adds nothing up). Mark as checked sends back the watermark the list carried (seen_to), never a moment of its own. The act is the person's own (POST /api/books-grants/practice/baseline), never the client's. ── */
  var T = root.CBBooksAuditTools; /* ONEP-2 PR7a: the since bar, Mark as checked and the Risk bits are ONE module (books-audit-tools.js), shared with the owner's Day book */
  grantKit.SINCE_LIMIT = T.SINCE_LIMIT;
  function sinceAsked() { return T.sinceAsked(); }
  function sinceBar() {
    return T.sinceBar({ on: grantKit.viewState.since, seen: grantKit.viewState.seen, shown: ((grantKit.viewState.answer && grantKit.viewState.answer.entries) || []).length });
  }
  grantKit.TABROW_CSS = T.TABROW_CSS;
  function setSince(on) {
    grantKit.viewState.since = on;
    grantKit.viewState.seen = null;
    T.writeSince(on);
    grantKit.reload().then(function () { var b = grantKit.$('bv_since'); if (b) b.focus(); });
  }
  /** Mark as checked: the shared module asks, names the client and sends the grant route's own call (practiceBaseline) */
  function markChecked() {
    var member = grantKit.viewState.o.member;
    T.markChecked({ seen: grantKit.viewState.seen, name: member && member.name, client: member && member.id, call: grantKit.viewState.o.call, done: function () { grantKit.reload().then(function () { var b = grantKit.$('bv_since'); if (b) b.focus(); }); } });
  }
  function wireSince() {
    if (grantKit.$('bv_since')) grantKit.$('bv_since').onclick = function () { setSince(!grantKit.viewState.since); };
    if (grantKit.$('bv_mark_checked')) grantKit.$('bv_mark_checked').onclick = markChecked;
  }
  /* ── ACC-358: marks (cap-mark.js, CMP058 the chip · CMP059 the sheet). The server's `mark_actions` says whether marking is on and who may set. ── */
  function markable(report) {
    return !!(report.k === 'daybook' && grantKit.viewState.mk && grantKit.viewState.mk.state().may);
  }
  var markBar = null;
  function paintMarkBar(report) {
    markBar = null;
    if (!markable(report) || !grantKit.$('bv_marks')) return;
    grantKit.viewState.mk.bar(grantKit.$('bv_marks'), { onFilter: function (on) { grantKit.viewState.queriesOnly = on; grantKit.paintList(report); } }).then(function (handle) { markBar = handle; });
  }
  /** a mark set anywhere repaints the bar's count and, when All queries is open, its list */
  function onMarkChange() {
    grantKit.rereadChoices();
    if (!markBar) return;
    markBar.refresh().then(function () { if (grantKit.viewState.queriesOnly) grantKit.paintList(grantKit.current()); });
  }
  /** the evidence chips (cap-evidence.js): a file is read through the page's own token and base, with the seat's headers */
  function newEvidence() {
    grantKit.viewState.ev = root.CBEvidence && grantKit.viewState.o.raw ? root.CBEvidence.use({ raw: function (path) { return grantKit.viewState.o.raw(path, root.CBBooksActing.headers()); } }) : null;
  }
  /** my private bookmarks and notes on this client's entries (cap-flag.js): the page's own call and NO X-Books-For, so a flag lands in MY organisation, never the client's */
  function newFlags() {
    if (grantKit.viewState.fl) grantKit.viewState.fl.destroy();
    grantKit.viewState.fl = root.CBFlag && grantKit.viewState.o.call && grantKit.viewState.o.member ? root.CBFlag.use({ call: grantKit.viewState.o.call, kind: 'posting', entity: function () { return grantKit.viewState.o.member.id; } }) : null;
    if (grantKit.viewState.fl) grantKit.viewState.fl.onChange(onFlagChange);
    if (grantKit.viewState.fa) grantKit.viewState.fa.destroy();
    grantKit.viewState.fa = root.CBFlag && grantKit.viewState.o.call && grantKit.viewState.o.member ? root.CBFlag.use({ call: grantKit.viewState.o.call, kind: 'account', entity: function () { return grantKit.viewState.o.member.id; } }) : null;
  }
  /** NET005-P06: Explain on a flagged P&L change: my own note on the account line, for this period (cap-flag.js kind 'account'; the id is '<code>@<period end day>'). Never the client's, never a mark */
  function explainId(row) {
    var to = String((grantKit.viewState.answer && grantKit.viewState.answer.to) || '').slice(0, 10);
    return row.code && to ? String(row.code).toLowerCase() + '@' + to : '';
  }
  function explainOn() {
    return !!grantKit.viewState.fa && !grantKit.viewState.fa.off() && !!(grantKit.viewState.answer && grantKit.viewState.answer.compare);
  }
  function explainCell(row) {
    var id = explainId(row);
    return row.change_over && id && grantKit.viewState.fa ? '<span data-cbsid="NET005-P06">' + grantKit.viewState.fa.chip(id, String(row.name || row.code).replace(/[<>]/g, '').slice(0, 56) + ' · ' + root.shopDay(grantKit.viewState.answer.to)) + '</span>' : '';
  }
  function flagsOn() {
    return !!grantKit.viewState.fl && !grantKit.viewState.fl.off();
  }
  /** the entry's words on the flag: number and day, plain text, at most 80 characters (the server keeps them as the label) */
  function flagLabel(row) {
    return String(row.entry_no || '') + (row.posting_date ? ' · ' + root.shopDay(row.posting_date) : '');
  }
  /** a flag changed: the chips repaint themselves; a list narrowed to Saved is drawn again so a row that no longer matches leaves it */
  function onFlagChange() {
    if (grantKit.viewState.dbf && grantKit.viewState.dbf.flag && grantKit.alive()) grantKit.paintList(grantKit.current());
  }
  function newMarks() {
    newEvidence();
    newFlags();
    if (grantKit.viewState.mk) grantKit.viewState.mk.destroy();
    grantKit.viewState.queriesOnly = false;
    if (!root.CBMark || grantKit.onActions()) { grantKit.viewState.mk = null; return; }
    grantKit.viewState.mk = root.CBMark.use({
      adopter: 'acc.audit',
      period: function () { return grantKit.viewState.markDay ? { from: grantKit.viewState.markDay, to: grantKit.viewState.markDay } : grantKit.viewState.day ? { from: grantKit.viewState.day, to: grantKit.viewState.day } : grantKit.viewState.range; },
      transport: function (method, path, body) {
        var headers = Object.assign({}, root.CBBooksActing.headers());
        if (method !== 'GET') headers['Idempotency-Key'] = (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : String(Date.now()) + Math.random());
        return grantKit.viewState.o.call(method, path, body, headers);
      }
    });
    grantKit.viewState.mk.onChange(onMarkChange);
  }
  /** the firm's queues, inside the list area, under the same banner */
  function mountQueues() {
    root.CBBooksActionsView.mount(grantKit.$('bv_list'), { call: grantKit.viewState.o.call, mode: 'firm', mountList: grantKit.viewState.o.mountList, sheet: grantKit.viewState.o.sheet, closeSheet: grantKit.viewState.o.closeSheet });
  }
})(typeof window !== 'undefined' ? window : globalThis);
