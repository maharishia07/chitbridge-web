/* cap-tasks-assign.js — Tasks & Orders: the board's rows on the ONE work-queue capability (CBAssign.queue, app/assign-bar.js): Mine · Unassigned · Everyone, ticks with Assign to me / Assign to…, the Held by filter.
 * ID        TSK001
 * OWNER     cb-ux-locale
 * OWNS      the client cell of a client's job (clientCell · dueWord · roleWord) and two sentence builders (taxWord · lineSubHTML), all moved from cap-tasks.js (file-size ratchet, 20 and 28 Nov) and only what is the board's own: a row's assignee as CBAssign's `holders`, and the door (plug 'task', the chit id). Every view, filter, tick, bar and clear-after-assign is CBAssign.queue's
 * FLOW      cap-tasks.js mountList → CBTasksAssign.queue(board, reload, beforePick) → CBAssign.queue → { views, bulk, bulkAlways, preset, filter } merged into the CBList mount
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
  function queue(board, reload, beforePick) {
    board.rows.forEach(function (row) { row.holders = holdersOf(row); });
    var key = 'tasks-' + board.view;
    var made = root.CBAssign.queue({ key: key, rows: board.rows, said: true, everyone: board.rows.some(function (row) { return row.may_assign === true; }), plug: 'task', beforePick: beforePick, noun: 'task', nounMany: 'tasks', subjectOf: function (row) { return row.chit_id; }, roleOf: function () { return ''; }, reload: reload });
    if (opened[key] || cameBack()) delete made.preset; /* TSK004: back from a client's books (keep=1) the list opens on the filter he left */
    if (made.views) opened[key] = true;
    return made;
  }
  /** W16: a row for a client's job says WHICH client, where it trades and in what money, and what falls due next; the name opens that client's BOOKS (W18/W20), the small Task link the comment panel */
  function clientCell(row, sayWord, escText) {
    var client = row.client,
      where = [client.country, client.currency].filter(Boolean).join(' · '),
      dueText = client.due ? sayWord('Next return') + ' ' + dueWord(client.due) : [sayWord(client.role ? roleWord(client.role) : ''), client.period && client.period !== 'standing' ? client.period : ''].filter(Boolean).join(' · ');
    return (
      '<a class="tk-client" data-cbsid="TSK003-L01" href="' + escText(root.CBQueueBack.booksAddress(client.entity_id)) + '" data-testid="tk-client-' + escText(row.chit_id) + '"><b>' + escText(client.name || row.party || sayWord('Client')) + '</b></a>' +
      (where ? ' <span class="sub" data-testid="tk-where-' + escText(row.chit_id) + '">' + escText(where) + '</span>' : '') +
      (dueText ? ' <span class="sub" data-testid="tk-due-' + escText(row.chit_id) + '">' + escText(dueText) + '</span>' : '') +
      ' <a class="sub" data-cbsid="TSK003-L02" href="/tasks.html?open=' + encodeURIComponent(row.chit_id) + '" data-testid="tk-panel-' + escText(row.chit_id) + '">' + escText(sayWord('Task')) + '</a>'
    );
  }
  /** the next return's form and day, in the shop's own date words */
  function dueWord(due) {
    var day = (root.CBLocale && root.CBLocale.date && root.CBLocale.date(due.due_date, { day: 'numeric', month: 'short' })) || String(due.due_date).slice(0, 10);
    return (due.form ? due.form + ' ' : '') + day;
  }
  /** the job's role as a word: adviser → Adviser service */
  function roleWord(role) {
    return role === 'adviser' ? 'Adviser service' : role === 'auditor' ? 'Audit' : role;
  }
  /** L-F-06: a total is always the amount WITH tax in it, so say so beside it: "incl. VAT 5.24", the tax word from the country pack (packWord taxName), the figure as the chit states it (tax_minor); nothing when the chit states no tax */
  function taxWord(chit, sayWord, moneyWord) {
    if (chit.tax_minor == null) return '';
    var word = (typeof root.packWord === 'function' && root.packWord('taxName')) || sayWord('tax');
    return sayWord('incl.') + ' ' + word + ' ' + moneyWord(chit.tax_minor, chit.currency, false);
  }
  /** the small line under a line's name: delivered and left, what the other side says, an over-delivery, the due day and the task note */
  function lineSubHTML(chit, line, lineId, sayWord, escText) {
    /* L-F-10: nothing is delivered on a task (a credit note, a to-do): no Delivered / left counts, no Deliver button */
    return (
      (chit.kind === 'task' ? '' : escText(sayWord('Delivered')) + ' ' + escText(line.delivered) + ' · ' + escText(sayWord('left')) + ' ' + escText(line.remaining)) +
      (line.theirs > 0 ? ' · <span data-testid="tk-line-theirs-' + lineId + '">' + escText(sayWord(chit.kind === 'order_out' ? 'Seller says' : 'Buyer says')) + ' ' + escText(line.theirs) + ' ' + escText(sayWord('delivered')) + '</span>' : '') +
      (line.over_theirs > 0 ? ' · <span class="tag red" data-testid="tk-line-over-' + lineId + '">' + escText(line.theirs + ' ' + sayWord('against') + ' ' + line.qty + ' ' + sayWord('ordered')) + '</span>' : '') +
      (line.settings && line.settings.due ? (chit.kind === 'task' ? '' : ' · ') + escText(sayWord('due')) + ' ' + escText(line.settings.due) : '') +
      (line.settings && line.settings.task ? ' · ' + escText(line.settings.task) : '')
    );
  }
  root.CBTasksAssign = { holdersOf: holdersOf, queue: queue, clientCell: clientCell, taxWord: taxWord, lineSubHTML: lineSubHTML };
})(typeof window !== 'undefined' ? window : globalThis);
