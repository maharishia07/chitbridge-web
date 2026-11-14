/**
 * books-grant-api.js — ACC-176: THE ONE WAY THE WEB TALKS TO A BOOKS GRANT (the member's doors and the auditor's reads).
 *
 * OWNS      the endpoint registry of the grant screens (the member's /api/books-grants doors, the six reads an auditor opens, the X-Books-For header) and the one function that makes a call from it; what a grant's state means in words
 * CALLED BY books-grant-member.js · books-grant-view.js · network-app.js (the "Open books" column)
 * FLOW      run(call, key, { params, query, body, headers }) → the page's own call() (network-app.js: token, base, 401 → sign-in) → the server's answer; held(call) → { member entity id: live grant } for the auditor's list
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * Decides nothing: who may grant, who may look and why a look is refused are the server's answers (api PR #1302). The web reads a grant's `state` code and says it in words.
 *   CBBooksGrantApi.run · .held · .stateWords · .HEADER
 */
(function (root) {
  'use strict';
  /* ⭐ the endpoint registry — the ONE declaration shape (accounts-shell.js) the round-trip scanner reads */
  var EP = {
    grantsList: { m: 'GET', p: '/api/books-grants' } /* { given, received }: each row with its state (live · revoked · expired · edge_off) */,
    grantsConsent: { m: 'GET', p: '/api/books-grants/consent' } /* the plain words a member reads before it says yes */,
    grantsGive: { m: 'POST', p: '/api/books-grants' },
    grantsChange: { m: 'PATCH', p: '/api/books-grants/:id' },
    grantsRevoke: { m: 'POST', p: '/api/books-grants/:id/revoke' },
    grantsLog: { m: 'GET', p: '/api/books-grants/log' } /* who looked at what, when — never the figures */
  };
  /* the six books reads an auditor opens. Plain paths on purpose: the endpoint registry already names each one (cap-books.js booksTB · booksPL · booksBS · booksDaybook · booksPeriods, accounts-shell.js booksDues) and
     ep-aliases.cjs fails an endpoint with two names; this page reads them with a header the books page never sends. */
  var READS = { readTB: '/api/books/trial-balance', readPL: '/api/books/pl', readBS: '/api/books/bs', readDaybook: '/api/books/daybook', readDues: '/api/books/dues', readPeriods: '/api/books/periods' };
  var HEADER = 'X-Books-For'; /* names the member whose books are read; the server checks it against a live grant */
  var STATE = { live: 'Open', revoked: 'Ended', expired: 'Ran out', edge_off: 'Paused: not connected now' };

  function T(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function pathOf(key, params) {
    var path = EP[key] ? EP[key].p : READS[key];
    Object.keys(params || {}).forEach(function (name) {
      path = path.replace(':' + name, encodeURIComponent(params[name]));
    });
    return path;
  }
  function queryOf(query) {
    var parts = Object.keys(query || {})
      .filter(function (name) {
        return query[name] !== '' && query[name] != null;
      })
      .map(function (name) {
        return encodeURIComponent(name) + '=' + encodeURIComponent(query[name]);
      });
    return parts.length ? '?' + parts.join('&') : '';
  }
  /** run(call, key, { params, query, body, headers }) → the server's answer; `call` is the page's own (token, base, 401) */
  function run(call, key, o) {
    o = o || {};
    return call(EP[key] ? EP[key].m : 'GET', pathOf(key, o.params) + queryOf(o.query), o.body, o.headers);
  }
  /** held(call) → { <member entity id>: the live grant this business holds on its books }: a login that may not list grants gets {} and the list shows nothing extra */
  function held(call) {
    return run(call, 'grantsList').then(
      function (answer) {
        var out = {};
        ((answer && answer.received) || []).forEach(function (grant) {
          if (grant.state === 'live') out[String(grant.grantor_entity)] = grant;
        });
        return out;
      },
      function () {
        return {};
      }
    );
  }
  function stateWords(state) {
    return T(STATE[state] || state || '');
  }
  root.CBBooksGrantApi = { run: run, held: held, stateWords: stateWords, HEADER: HEADER };
})(typeof window !== 'undefined' ? window : globalThis);
