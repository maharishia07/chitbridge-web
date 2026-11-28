/**
 * books-grant-visits.js — UX-221/220 (firm-connect 1138): WHO LOOKED as visits, one row each.
 *
 * ID        NET004
 * OWNER     cb-network
 * RISK      personal-data
 * OWNS      the columns, the row detail and the empty words of the visits list; a run of looks by one person on one grant with no gap over 30 minutes is ONE row (the server groups them)
 * CALLED BY books-grant-member.js (the Who looked view) · books-grant-words.js supplies the page's words per route
 * FLOW      rows(answer) → the visits (or the looks of an older api, each as a visit of one page) → config(host, screen) → the CBList config: When · Who · What · Result, the pages in the detail
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * Decides nothing: a visit is the server's own grouping (GET /api/books-grants/log → visits[]); the firm is the Who, and the person where the log holds one.
 *   CBBooksGrantVisits.rows · .config
 */
(function (root) {
  'use strict';
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  /** the visits of the answer; an older api that sends only looks[] is shown as before, each look one page */
  function rows(answer) {
    if (answer && answer.visits) return answer.visits;
    return ((answer && answer.looks) || []).map(function (look) {
      return { grant_id: look.grant_id, grantee_entity: look.grantee_entity, actor_name: null, actor_entity_name: null, from: look.at, to: look.at, pages: 1, refused: look.outcome === 'allowed' ? 0 : 1, pages_list: [{ route_pattern: look.route_pattern, count: 1 }] };
    });
  }
  /** the firm, and the person after it where the log holds one */
  function whoOf(visit, nameOf) {
    var firm = visit.actor_entity_name || nameOf(visit.grantee_entity);
    return visit.actor_name ? firm + ' · ' + visit.actor_name : firm;
  }
  function pagesWords(n) {
    return n + ' ' + words(n === 1 ? 'page' : 'pages');
  }
  function refusedWords(n) {
    return n ? n + ' ' + words('refused') : words('Looked');
  }
  /** the pages of one visit, each with its count, in the page's own words */
  function detail(visit, route) {
    return '<div class="bg-detail" data-testid="bg-visit-pages">' + (visit.pages_list || []).map(function (p) {
      return '<div>' + esc(route(p.route_pattern)) + (p.count > 1 ? ' × ' + esc(p.count) : '') + '</div>';
    }).join('') + '</div>';
  }
  /** the CBList config of the visits: screen = { nameOf, route, when, col } from the member screen */
  function config(screen, data) {
    return {
      key: 'books-grants-looks',
      rows: function () { return data; },
      id: function (v) { return v.grant_id + '|' + v.from + '|' + (v.actor_name || ''); },
      rowTid: function (v) { return 'bg-visit-' + (v.refused ? 'refused' : 'looked'); },
      columns: [
        screen.col('at', words('When'), 1, 170, function (v) { return screen.when(v.from); }, function (v) { return v.from || ''; }),
        screen.col('who', words('Who'), 1, 240, function (v) { return whoOf(v, screen.nameOf); }),
        screen.col('what', words('What they did'), 2, 130, function (v) { return pagesWords(v.pages); }, function (v) { return v.pages; }),
        screen.col('out', words('Result'), 2, 150, function (v) { return refusedWords(v.refused); })
      ],
      next: function (v) { return detail(v, screen.route); },
      search: function (v) { return whoOf(v, screen.nameOf); },
      empty: { title: words('Nobody has looked yet'), body: words('Visits show here.') }
    };
  }
  root.CBBooksGrantVisits = { rows: rows, config: config };
})(typeof window !== 'undefined' ? window : globalThis);
