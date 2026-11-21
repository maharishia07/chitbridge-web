/**
 * queue-back.js — the accountant's ONE path: Tasks (his queue) → a client's books → back to his queue.
 * ID        TSK004
 * OWNER     cb-orders
 * OWNS      the address mark of "I came from my queue" (&from=queue), the way back (/tasks.html?view=tasks&keep=1: his filter kept) and its words
 * FLOW      cap-tasks.js (a client row) → CBQueueBack.booksAddress(client) → /network.html?open=<client>&view=daybook&from=queue → network-books.js / books-acting.js keep the mark in the address and draw "Back to my queue" → CBQueueBack.href()
 * CARD      02-tasks-orders-and-workflow/tasks-and-orders-list-sheet
 * RISK      plain
 * CALLED BY cap-tasks.js · network-books.js · books-acting.js · network.html (script tag) · tasks.html (script tag)
 * Decides nothing: who may open a client's books is the server's (the books grant and the assignment); this only remembers where the person came from.
 */
(function (root) {
  'use strict';
  var MARK = 'from=queue';
  var BACK = '/tasks.html?view=tasks&keep=1'; /* keep=1: the list opens on the filter the person left (Mine, Unassigned…), not the opening preset */
  /** did the person come to this address from his queue? */
  function on(search) {
    try { return new root.URLSearchParams(search == null ? root.location.search : search).get('from') === 'queue'; } catch (failure) { if (root.cbQuiet) root.cbQuiet('queue-back:on', failure); return false; } /* no address to read: not from the queue */
  }
  /** the mark to append to an address that must keep the way back (empty when the person did not come from the queue) */
  function carry(search) {
    return on(search) ? '&' + MARK : '';
  }
  /** a client's books from the queue: the Day book (the books and the activity), with the way back marked */
  function booksAddress(clientId) {
    return '/network.html?open=' + encodeURIComponent(clientId) + '&view=daybook&' + MARK;
  }
  root.CBQueueBack = { on: on, carry: carry, booksAddress: booksAddress, href: function () { return BACK; }, label: function (words) { return (words || function (s) { return s; })('Back to my queue'); } };
})(typeof window !== 'undefined' ? window : globalThis);
