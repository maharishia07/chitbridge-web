/* app/cap-tasks-words.js — Tasks & Orders: the WORDS a board row and a sheet say (age, channel, delivery, asked-for day, stage marks, who holds it, how many lines). Split out of cap-tasks.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the row wording of the Tasks screen: ageWord · channelWord · fulfilWord · howWord · forWord · marksHTML · toneOf · wordTag · wordCell · whoWord · linesWord (CBTasksWords.make(translate) hands them back)
 * CALLED BY cap-tasks.js (the list columns and the sheet head call them; it hands its own T, the tx fallback); tasks.html loads this before cap-tasks.js
 * FLOW      CBTasksWords.make(translate) → the wording functions → the list cells and the sheet bits; they only say what the server sent, they decide nothing
 * ID        TSK003
 * CARD      05-orders-and-workflow/tasks-and-orders
 * OWNER     cb-orders
 * RISK      plain
 */
(function (root) {
  'use strict';
  /** the string layer, handed over by make(); until then the words stand as written */
  var inWords = function (text) {
    return text;
  };
  function ageWord(stamp) {
    stamp = Math.floor(Number(stamp) || 0);
    return stamp <= 0 ? inWords('Today') : stamp + ' ' + inWords('d');
  }
  /* the symbols the bell already uses for an order (rail-bell.js O3): 🌐 Online · Delivery / Pick up — a symbol beats a sentence (SYSTEM §1) */
  var CHANNEL_WORD = { online: '🌐 Online', rail: '⇄ Rail', counter: '▤ Counter' };
  var FULFIL_WORD = { delivery: 'Delivery', pickup: 'Pick up' };
  function channelWord(row) {
    return row.channel ? inWords(CHANNEL_WORD[row.channel] || row.channel) : '';
  }
  function fulfilWord(row) {
    return row.fulfilment ? inWords(FULFIL_WORD[row.fulfilment] || row.fulfilment) : '';
  }
  function howWord(row) {
    return [channelWord(row), fulfilWord(row)].filter(Boolean).join(' · ');
  }
  /** the asked-for time, in the shop's own date words (CBLocale.date; the raw ISO day when the locale unit is not on the page) */
  function forWord(row) {
    if (!row.requested_for) return '';
    try {
      return (root.CBLocale && root.CBLocale.date(row.requested_for, { day: 'numeric', month: 'short' })) || String(row.requested_for).slice(0, 10);
    } catch (failure) {
      console.warn('TASK-WORD-FOR-01 the asked-for time could not be formatted; the raw day is shown', (failure && failure.message) || failure);
      return String(row.requested_for).slice(0, 10);
    }
  }
  /** the marks the server keeps beside the stage word: billed (the counter bill exists) · sent out (despatched) · stuck (the rail's overdue test, with its why) */
  function marksHTML(row) {
    var list = [];
    if (row.stuck)
      list.push('<span class="tag red" data-testid="tk-stuck-' + esc(row.chit_id) + '" title="' + esc(row.stuck_why || '') + '">' + esc(inWords('Stuck')) + '</span>');
    if (row.billed) list.push('<span class="tag" data-testid="tk-billed-' + esc(row.chit_id) + '">' + esc(inWords('Billed')) + '</span>');
    if (row.despatched && row.stage !== 'delivered' && row.stage !== 'closed') list.push('<span class="tag">' + esc(inWords('Sent out')) + '</span>');
    return list.join(' ');
  }
  function toneOf(row) {
    return row.stage === 'new' ? 'amber' : row.stage === 'closed' ? '' : 'green';
  }
  function wordTag(row) {
    return '<span class="tag ' + toneOf(row) + '" data-testid="tk-word-' + esc(row.chit_id) + '">' + esc(inWords(row.word || '')) + '</span>';
  }
  function wordCell(row) {
    var marks = marksHTML(row);
    return wordTag(row) + (marks ? ' ' + marks : '');
  }
  function whoWord(row) {
    if (row.lines_assigned_n) return row.lines_assigned_n + ' ' + inWords(row.lines_assigned_n === 1 ? 'line held' : 'lines held');
    return row.assignee && row.assignee.name ? row.assignee.name : inWords('Unassigned');
  }
  function linesWord(row) {
    if (row.lines_n == null) return '';
    if (!row.lines_n) return inWords('No lines');
    return row.lines_open_n ? row.lines_open_n + ' ' + inWords('of') + ' ' + row.lines_n + ' ' + inWords('open') : row.lines_n + ' ' + inWords('delivered');
  }
  /** takes the page's own words function and hands back the wording functions of the board row */
  function make(translate) {
    inWords = translate;
    return { ageWord: ageWord, howWord: howWord, forWord: forWord, wordCell: wordCell, whoWord: whoWord, linesWord: linesWord };
  }
  root.CBTasksWords = { make: make };
})(typeof window !== 'undefined' ? window : globalThis);
