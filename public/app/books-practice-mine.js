/* public/app/books-practice-mine.js — 'Your books today: <client> · <country>': the first line of a firm seat's Home
   ID        HOM001
   OWNER     cb-ux-locale
   OWNS      the Add a client door (UX-215) and the one line; CBPracticeKit.mineLine() returns its markup ('' when the seat holds no client). Decides nothing: the held clients are the server's holders on GET /api/books-grants/practice; CBAssign.heldFilter is the one 'mine' matcher
   FLOW      books-practice.js sectionHTML -> CBPracticeKit.mineLine -> practiceState.data.clients -> heldFilter mine -> the line
   CARD      04-network/ACC-176-AUDITOR-GRANT
   RISK      plain
   CALLED BY index.html (script tag, before books-practice.js)
*/
(function (root) {
  'use strict';
  var practiceKit = (root.CBPracticeKit = root.CBPracticeKit || {});
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  /** UX-215 B2: the firm adds a client: the same find-and-ask sheet as the owner's, opened on the Network page (the firm is the parent of the edge) */
  practiceKit.addClient = function () {
    return '<p style="margin:0 0 6px"><a class="act quiet" data-cbsid="NET004-B29" href="/network.html#add" data-testid="practice-add-client">' + root.esc(words('Add a client')) + '</a></p>';
  };
  practiceKit.mineLine = function () {
    var data = practiceKit.practiceState && practiceKit.practiceState.data, A = root.CBAssign;
    if (!data || !A || !A.meId()) return '';
    var mine = (data.clients || []).filter(function (r) { return A.heldFilter([r]).match(r, 'mine'); });
    if (!mine.length) return '';
    var named = mine.slice(0, 2).map(function (r) { return root.esc(r.name) + (r.country ? ' · ' + root.esc(r.country) : ''); }).join(', ');
    return '<p class="bp-mine" data-testid="practice-mine" style="margin:0 0 6px;font-size:15px"><b>' + root.esc(words('Your books today')) + ':</b> ' + named + (mine.length > 2 ? ' +' + (mine.length - 2) : '') + '</p>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
