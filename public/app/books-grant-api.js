/**
 * books-grant-api.js — ACC-176: THE ONE WAY THE WEB TALKS TO A BOOKS GRANT (the member's doors and the auditor's reads).
 *
 * OWNS      the endpoint registry of the grant screens (the member's /api/books-grants doors, the adviser's /api/books-actions doors, the six reads an auditor opens, the X-Books-For and X-Books-Role headers) and the one function that makes a call from it; what a grant's state means in words; what each refusal CODE says in a plain sentence
 * CALLED BY books-grant-member.js · books-grant-view.js · books-actions-view.js · books-acting.js · network-app.js (the "Open books" column)
 * FLOW      run(call, key, { params, query, body, headers }) → the page's own call() (network-app.js: token, base, 401 → sign-in) → the server's answer, or an Error whose message is the refusal in plain words; held(call) → { member entity id: live grant } for the auditor's and the adviser's list
 * CARD      04-network/ACC-176-AUDITOR-GRANT · 04-network/ACC-176B-ADVISER-REQUIREMENT
 *
 * Decides nothing: who may grant, who may look, who may prepare, review or accept, and why not, are the server's answers (api PRs #1302, #1313). The web reads a grant's `state` code and a refusal's `code` and says them in words.
 *   CBBooksGrantApi.run · .held · .stateWords · .refusalWords · .HEADER · .ROLE_HEADER
 */
(function (root) {
  'use strict';
  /* ⭐ the endpoint registry — the ONE declaration shape (accounts-shell.js) the round-trip scanner reads */
  var ENDPOINTS = {
    grantsList: { m: 'GET', p: '/api/books-grants' } /* { given, received }: each row with its state (live · revoked · expired · edge_off) */,
    grantsConsent: { m: 'GET', p: '/api/books-grants/consent' } /* the plain words a member reads before it says yes */,
    grantsGive: { m: 'POST', p: '/api/books-grants' },
    grantsChange: { m: 'PATCH', p: '/api/books-grants/:id' },
    grantsRevoke: { m: 'POST', p: '/api/books-grants/:id/revoke' },
    grantsLog: { m: 'GET', p: '/api/books-grants/log' } /* who looked at what, when — never the figures */,
    actionsList: { m: 'GET', p: '/api/books-actions' } /* { actions, total, page, limit }: state · mine · page · limit narrow it */,
    actionsGet: { m: 'GET', p: '/api/books-actions/:id' } /* one action with its steps[] */,
    actionsReview: { m: 'POST', p: '/api/books-actions/:id/review' } /* { store_id, body_hash }: a colleague of the preparer */,
    actionsReturn: { m: 'POST', p: '/api/books-actions/:id/return' } /* { store_id, body_hash, reason } */,
    actionsAccept: { m: 'POST', p: '/api/books-actions/:id/accept' } /* the owner only: { store_id, body_hash, total_minor, currency } */
  };
  /* the six books reads an auditor opens. Plain paths on purpose: the endpoint registry already names each one (cap-books.js booksTB · booksPL · booksBS · booksDaybook · booksPeriods, accounts-shell.js booksDues) and
     ep-aliases.cjs fails an endpoint with two names; this page reads them with a header the books page never sends. */
  var READS = { readTB: '/api/books/trial-balance', readPL: '/api/books/pl', readBS: '/api/books/bs', readDaybook: '/api/books/daybook', readDues: '/api/books/dues', readPeriods: '/api/books/periods' };
  var HEADER = 'X-Books-For'; /* names the member whose books are read; the server checks it against a live grant */
  var ROLE_HEADER = 'X-Books-Role'; /* `adviser` picks the member's adviser grant; absent is the auditor's (read only) */
  var STATE = { live: 'Open', revoked: 'Ended', expired: 'Ran out', edge_off: 'Paused: not connected now' };

  /** a refusal's code → the plain sentence (what happened · what it means · what to do); a code not listed keeps the server's own words */
  var REFUSALS = {
    ACTION_SELF_REVIEW: 'You prepared this, so a colleague has to review it. Nothing changed.',
    ACTION_NOT_REVIEWED: 'A colleague has to review this before you accept it. Nothing was posted.',
    ACTION_BODY_CHANGED: 'This is not the entry you were shown. Open it again. Nothing was saved.',
    ACTION_ACCESS_ENDED: 'The access this was prepared under has ended. You can send it back.',
    ACTION_REF_OPEN: 'An action with this reference is already waiting. Open it from the queue.',
    ACTION_REF_POSTED: 'This reference is already posted. It is not prepared again.',
    ACTION_DUPLICATE: 'This was already posted. Nothing was posted again.',
    ACTION_CLOSED: 'This action has already moved on. Open the queue again.',
    ACTION_REASON_NEEDED: 'Say why in 3 to 300 characters. Nothing was sent back.',
    ACTION_FIRM_ONLY: 'Only the adviser firm prepares and reviews. The owner accepts.',
    ACTION_NOT_FOR_YOU: 'Only the owner and the adviser firm work on these actions.',
    OWNER_ONLY: 'Only the owner accepts an action. You can send it back.',
    STORE_MISMATCH: 'This page is open on another store than the one you are working in. Nothing was saved. Open the store again.',
    PREVIEW_TOTAL_DIFFERS: 'The total changed since it was prepared. Nothing was posted. Open it again.',
    BOOKS_ACTION_NOT_SWITCHED_ON: 'Adviser actions are not switched on yet. Nothing was changed.'
  };
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function pathOf(key, params) {
    var path = ENDPOINTS[key] ? ENDPOINTS[key].p : READS[key];
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
  /** a failure with a known refusal code says its plain sentence (the status stays, so a 4xx is still shown as the server's reason); any other failure is passed on untouched */
  function refusalWords(failure) {
    var sentence = failure && REFUSALS[failure.code];
    return sentence ? words(sentence) : (failure && failure.message) || '';
  }
  function phrased(failure) {
    if (failure && REFUSALS[failure.code]) failure.message = refusalWords(failure);
    throw failure;
  }
  /** run(call, key, { params, query, body, headers }) → the server's answer; `call` is the page's own (token, base, 401) */
  function callEndpoint(call, key, o) {
    o = o || {};
    return call(ENDPOINTS[key] ? ENDPOINTS[key].m : 'GET', pathOf(key, o.params) + queryOf(o.query), o.body, o.headers).catch(phrased);
  }
  /** held(call) → { <member entity id>: the live grant this business holds on its books }: a login that may not list grants gets {} and the list shows nothing extra */
  function held(call) {
    return callEndpoint(call, 'grantsList').then(
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
    return words(STATE[state] || state || '');
  }
  root.CBBooksGrantApi = { run: callEndpoint, held: held, stateWords: stateWords, refusalWords: refusalWords, HEADER: HEADER, ROLE_HEADER: ROLE_HEADER };
})(typeof window !== 'undefined' ? window : globalThis);
