/**
 * books-practice-mine.js — "Your books today: <client> · <country>" (rr1121ui2 L-bookkeeper): the first line of a firm seat's Home says whose books it works on.
 * OWNS       the one line; CBPracticeKit.mineLine() returns its markup ('' when the seat holds no client)
 * CALLED BY  books-practice.js (sectionHTML) · loaded before it by index.html
 * Decides nothing: the held clients are the server's holders on GET /api/books-grants/practice (GET /api/entities/me says is_practice); CBAssign.heldFilter is the one "mine" matcher. No new api field.
 */
(function (root) {
  'use strict';
  var kit = (root.CBPracticeKit = root.CBPracticeKit || {});
  function tr(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  kit.mineLine = function () {
    var data = kit.practiceState && kit.practiceState.data, A = root.CBAssign;
    if (!data || !A || !A.meId()) return '';
    var mine = (data.clients || []).filter(function (r) { return A.heldFilter([r]).match(r, 'mine'); });
    if (!mine.length) return '';
    var named = mine.slice(0, 2).map(function (r) { return root.esc(r.name) + (r.country ? ' · ' + root.esc(r.country) : ''); }).join(', ');
    return '<p class="bp-mine" data-testid="practice-mine" style="margin:0 0 6px;font-size:15px"><b>' + root.esc(tr('Your books today')) + ':</b> ' + named + (mine.length > 2 ? ' +' + (mine.length - 2) : '') + '</p>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
