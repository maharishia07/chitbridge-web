/**
 * books-grant-marks.js — ACC-358 part of books-grant-view.js: the firm's queues mount.
 *
 * OWNS      the adviser's Actions tab mount (the firm's queues, inside the list area, under the same banner)
 * CALLED BY books-grant-view.js (through root.CBBooksGrantKit)
 * FLOW      mountQueues() → CBBooksActionsView.mount in the list area
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * ONEP-2 PR7b: the marks bar, "since I last looked", the JET filters, the evidence chips and my bookmarks moved to the owner's Day book (books-audit-tools.js, cap-books.js bkDaybook); this file keeps only the queues. Loaded before books-grant-view.js (network.html).
 */
(function (root) {
  'use strict';
  var grantKit = root.CBBooksGrantKit; /* created by books-grant-reports.js, which loads first */
  grantKit.mountQueues = mountQueues;
  /** the firm's queues, inside the list area, under the same banner */
  function mountQueues() {
    root.CBBooksActionsView.mount(grantKit.$('bv_list'), { call: grantKit.viewState.o.call, mode: 'firm', mountList: grantKit.viewState.o.mountList, sheet: grantKit.viewState.o.sheet, closeSheet: grantKit.viewState.o.closeSheet });
  }
})(typeof window !== 'undefined' ? window : globalThis);
