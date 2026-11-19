/* cap-tasks-assign.js — Tasks & Orders: the board's rows on the ONE work-queue capability (CBAssign.queue, app/assign-bar.js): Mine · Unassigned · Everyone, ticks with Assign to me / Assign to…, the Held by filter.
 * ID        TSK001
 * OWNER     cb-ux-locale
 * OWNS      only what is the board's own: a row's assignee as CBAssign's `holders`, and the door (plug 'task', the chit id). Every view, filter, tick, bar and clear-after-assign is CBAssign.queue's
 * FLOW      cap-tasks.js mountList → CBTasksAssign.queue(board, reload) → CBAssign.queue → { views, bulk, bulkAlways, preset, filter } merged into the CBList mount
 * CARD      01-rail-core-the-chit/assign
 * RISK      plain
 * CALLED BY tasks.html (script tag, after assign-bar.js, before cap-tasks.js) · app/cap-tasks.js
 * Decides nothing: who may assign, who may hold and every refusal sentence are the server's (POST /api/chits/assign-bulk, plug 'task'). The owner is told from an employee by the server's own verdict on the rows (may_assign).
 */
(function (root) {
  'use strict';
  var opened = {}; /* the views already opened once: the opening view is given once, later paints keep what the person chose */
  /** a row's holder as CBAssign reads it: [{ actor_id, name }], or [] = nobody (Unassigned) */
  function holdersOf(row) {
    return row && row.assignee && row.assignee.id ? [{ actor_id: row.assignee.id, name: row.assignee.name || '' }] : [];
  }
  /** back from a client's books to his queue: the list keeps the filter it remembers, not the opening preset */
  function cameBack() {
    try { return new root.URLSearchParams(root.location.search).get('keep') === '1'; } catch (failure) { if (root.cbQuiet) root.cbQuiet('tasks-assign:keep', failure); return false; } /* no address to read: the opening preset */
  }
  /** the board's queue: CBAssign.queue over its rows; the opening view only the first time this view is drawn */
  function queue(board, reload) {
    board.rows.forEach(function (row) { row.holders = holdersOf(row); });
    var key = 'tasks-' + board.view;
    var made = root.CBAssign.queue({ key: key, rows: board.rows, said: true, everyone: board.rows.some(function (row) { return row.may_assign === true; }), plug: 'task', noun: 'task', nounMany: 'tasks', subjectOf: function (row) { return row.chit_id; }, roleOf: function () { return ''; }, reload: reload });
    if (opened[key] || cameBack()) delete made.preset; /* TSK004: back from a client's books (keep=1) the list opens on the filter he left */
    if (made.views) opened[key] = true;
    return made;
  }
  root.CBTasksAssign = { holdersOf: holdersOf, queue: queue };
})(typeof window !== 'undefined' ? window : globalThis);
