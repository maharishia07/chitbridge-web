/**
 * books-clients-door.js — ACC-176b: THE FIRM'S FRONT DOOR on Home.
 *
 * OWNS      one card on Home, "Your clients · N · Open ›", for a login that holds live received books grants; it links to My network (the client list). Nothing is drawn for a login without a grant.
 * CALLED BY public/app.html (script tag, after books-grant-api.js)
 * FLOW      wait for the Home shell → CBBooksGrantApi.held(call) → count → insert the card before the areas
 * CARD      04-network/ACC-176B-ADVISER-REQUIREMENT
 *
 * Decides nothing: the count is the server's list of live grants (CBBooksGrantApi.held).
 */
(function (root) {
  'use strict';
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function base() {
    try {
      var f = root.localStorage.getItem('cb_api_base');
      if (f) return f === 'stage' ? root.CB_API || '' : f;
    } catch (failure) {
      root.console.warn('books-clients-door', failure);
      return '';
    }
    return /^(localhost|127\.0\.0\.1)$/.test(root.location.hostname) ? 'http://localhost:3000' : root.CB_API || '';
  }
  function token() {
    try {
      return (JSON.parse(root.localStorage.getItem('cb_sess') || 'null') || {}).token || null;
    } catch (failure) {
      root.console.warn('books-clients-door', failure);
      return null;
    }
  }
  function call(method, path) {
    return root.fetch(base() + path, { method: method, headers: { Authorization: 'Bearer ' + token() } }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.message || 'API ' + r.status);
        return j;
      });
    });
  }
  function draw(count) {
    var areas = root.document.querySelector('[data-testid="shell-areas"]');
    if (!areas || root.document.getElementById('bcd_card')) return !!areas;
    var card = root.document.createElement('a');
    card.id = 'bcd_card';
    card.href = '/network.html';
    card.setAttribute('data-testid', 'home-your-clients');
    card.setAttribute('style', 'display:block;margin:0 0 16px;padding:14px 16px;border:1px solid var(--line,#DDD6C6);border-radius:10px;background:var(--card,#fff);color:inherit;text-decoration:none;font-weight:600');
    card.textContent = words('Your clients') + ' · ' + count + ' · ' + words('Open') + ' ›';
    areas.parentNode.insertBefore(card, areas);
    return true;
  }
  function start() {
    if (!token() || !root.CBBooksGrantApi) return;
    root.CBBooksGrantApi.held(call).then(function (held) {
      var count = Object.keys(held).length;
      if (!count) return;
      var tries = 0;
      var timer = root.setInterval(function () {
        if (draw(count) || ++tries > 40) root.clearInterval(timer);
      }, 500);
    });
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
  else start();
  root.CBBooksClientsDoor = { start: start };
})(typeof window !== 'undefined' ? window : globalThis);
