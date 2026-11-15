/**
 * books-acting.js — ACC-176b: THE ONE PLACE THAT KNOWS WHICH STORE'S BOOKS THIS SCREEN IS WORKING IN.
 *
 * OWNS      the acting context (store, currency, role) · the headers and the `store_id` every request of that store carries · the frozen "Acting for <store>, <currency>" banner with its store switch · the clearing of drafts and cached data when the store changes · the one minor-units-in-words helper of the books screens · this business's own entity
 * CALLED BY books-grant-view.js (the firm's workspace) · books-actions-view.js (the queues) · network-app.js (opens and switches the store) · accounts.html + core.js (the books page opened to act for a store: banner, headers)
 * FLOW      enter(store, role) → headers() / body() are built from THIS context only → a different store runs every registered clear (drafts, caches, open sheets) before the new one is set → leave() clears and forgets
 * CARD      04-network/ACC-176B-ADVISER-REQUIREMENT
 *
 * Why one object: data must never mix between clients. A request is never built from two places (a header from one, a body from another); both come from the same context, and the server refuses a mismatch with STORE_MISMATCH.
 * The owner works in his own books: role 'owner', no header, his own entity as the store. The server decides who may; nothing here grants anything.
 *   CBBooksActing.enter · .leave · .current · .headers · .body · .onClear · .setCurrency · .banner · .wireBanner · .figure · .ownStore
 */
(function (root) {
  'use strict';
  var context = null;
  var clears = [];

  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  /** register what must be forgotten when the store changes (a draft, a cached answer, an open sheet); returns the way to take it off */
  function onClear(fn) {
    clears.push(fn);
    return function () {
      clears = clears.filter(function (item) {
        return item !== fn;
      });
    };
  }
  function clearAll() {
    clears.slice().forEach(function (fn) {
      fn();
    });
  }
  /** work in this store's books as this role ('adviser' · 'auditor' · 'owner'); another store than the one in hand clears everything of the first, first */
  function enter(store, role) {
    if (context && String(context.store.id) !== String(store.id)) clearAll();
    context = { store: { id: String(store.id), name: store.name }, role: role, currency: context && context.store.id === String(store.id) ? context.currency : '' };
    return context;
  }
  function leave() {
    clearAll();
    context = null;
  }
  function current() {
    return context;
  }
  /** the headers of a request into the store's books: the firm names the store and the role; the owner and nobody else sends none */
  function headers() {
    var out = {};
    if (!context || context.role === 'owner') return out;
    out[root.CBBooksGrantApi.HEADER] = context.store.id;
    if (context.role === 'adviser') out[root.CBBooksGrantApi.ROLE_HEADER] = 'adviser';
    return out;
  }
  /** a write's body: `store_id` is the store this screen is open on, so a stale tab is refused by the server instead of saved */
  function body(fields) {
    return Object.assign({ store_id: context && context.store.id }, fields);
  }
  function setCurrency(code) {
    if (context && code) context.currency = code;
  }

  /** a figure the way the books screens paint it: the server's minor units as a money value that carries its OWN currency (fmtMoney reads the exponent from the code; never a guessed symbol) */
  function figure(minor, code) {
    if (minor == null || minor === '') return '—';
    return typeof root.fmtMoney === 'function' ? root.fmtMoney({ amount_minor: String(minor), currency: code }) : String(minor) + (code ? ' ' + code : '');
  }
  /** this business's own entity, read from the sign-in token: the owner's own books are the store of his queue */
  function ownStore(token, name) {
    var claims = (typeof root.jwtPayload === 'function' && root.jwtPayload(token)) || {};
    return { id: claims.parent_entity_id || claims.identity_id, name: name };
  }

  /* ── acting on another page: the address carries the store, the server checks the grant on every request ── */
  /** the books page of the firm's workspace for one store (optionally straight into preparing a journal) */
  function addressOf(store, doing) {
    return '/accounts.html?acting=' + encodeURIComponent(store.id) + '&actingName=' + encodeURIComponent(store.name) + (doing ? '&prepare=' + doing : '') + '#/daybook';
  }
  /** read the store from the page address: a page opened with ?acting=<store> works in that store's books as the adviser; null when it carries none */
  function fromAddress(search) {
    var query = new URLSearchParams(search || '');
    var id = query.get('acting');
    return id ? enter({ id: id, name: query.get('actingName') || '' }, 'adviser') : null;
  }

  /* ── the banner: frozen at the top of every screen that acts for a store ── */
  function switchBox(stores) {
    if (!stores || stores.length < 2) return '';
    return (
      '<label class="sub" for="ba_switch">' + esc(words('Switch store')) + '</label><select data-cbsid="NET006-S01" id="ba_switch" class="inp" data-testid="ba-switch">' +
      stores.map(function (item) {
        return '<option value="' + esc(item.id) + '"' + (String(item.id) === context.store.id ? ' selected' : '') + '>' + esc(item.name) + '</option>';
      }).join('') + '</select>'
    );
  }
  /** the banner's markup: who this is for, in which currency, a way to another store (when the firm holds more than one) and the way back */
  function banner(stores) {
    if (!context) return '';
    return (
      '<div class="bv-band ba-band" id="ba_band" role="status" data-testid="ba-band"><b>' + esc(words('Acting for')) + ' ' + esc(context.store.name) + (context.currency ? ', ' + esc(context.currency) : '') + '</b>' +
      '<span class="ba-tools">' + switchBox(stores) + '<button data-cbsid="NET006-B01" type="button" class="act quiet" id="ba_back" data-testid="ba-back">← ' + esc(words('Back to My network')) + '</button></span></div>'
    );
  }
  /** wire the banner just drawn in `host`: Back, and the switch (a different store is entered, which clears the first one's drafts and caches, then the page repaints) */
  function wireBanner(host, o) {
    var back = host.querySelector('#ba_back');
    var box = host.querySelector('#ba_switch');
    if (back) back.onclick = o.onBack;
    if (box)
      box.onchange = function () {
        o.onSwitch(box.value);
      };
  }

  root.CBBooksActing = { enter: enter, leave: leave, current: current, headers: headers, body: body, onClear: onClear, setCurrency: setCurrency, addressOf: addressOf, fromAddress: fromAddress, banner: banner, wireBanner: wireBanner, figure: figure, ownStore: ownStore };
})(typeof window !== 'undefined' ? window : globalThis);
