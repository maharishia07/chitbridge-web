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
 *   CBBooksActing.confirmGrant · .openPage · .firstTab · .posts · .keepTabs · .mayCall · .guard · .enter · .leave · .current · .headers · .body · .onClear · .setCurrency · .banner · .wireBanner · .figure · .ownStore · .isAdviser · .prepare · .paintPrepared · .startPage · .roleOf · .adviserStores
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
  function enter(store, role, posting) {
    if (context && String(context.store.id) !== String(store.id)) clearAll();
    context = { store: { id: String(store.id), name: store.name }, role: role, posting: posting || '', currency: context && context.store.id === String(store.id) ? context.currency : '' };
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
    return '/accounts.html?acting=' + encodeURIComponent(store.id) + (doing ? '&prepare=' + doing : '') + '#/daybook';
  }
  /** read the store from the page address: a page opened with ?acting=<store> works in that store's books as the adviser; null when it carries none */
  function fromAddress(search) {
    var query = new URLSearchParams(search || '');
    var id = query.get('acting');
    return id ? enter({ id: id, name: '' }, 'adviser') : null;
  }
  /** a page call(method, path, body, headers) of its own (token + base): no acting header, the grant list is the firm's own */
  function grantCall(base, token) {
    return function (method, path, payload, extra) {
      return root.fetch(base + path, { method: method, cache: 'no-store', headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, extra || {}), body: payload ? JSON.stringify(payload) : undefined }).then(function (reply) {
        return reply.json().catch(function (e) { return { message: String(e && e.message) }; }).then(function (j) {
          if (!reply.ok) throw Object.assign(new Error(j.message || 'API ' + reply.status), { status: reply.status, code: j.code });
          return j;
        });
      });
    };
  }
  /** the page opened with ?acting=<id> enters only when the firm holds a LIVE ADVISER grant on that id; the banner's name and the grant's posting come from the grant row, never from the address. false: not entered (context dropped) */
  function confirmGrant(base, token) {
    if (!context) return Promise.resolve(false);
    var id = context.store.id;
    return root.CBBooksGrantApi.held(grantCall(base, token)).then(function (heldBy) {
      var grant = heldBy[id];
      if (!grant || grant.preset !== 'adviser') {
        context = null;
        return false;
      }
      context.store.name = grant.grantor_name || root.CBBooksGrantApi.withHeld([], heldBy, words)[0].name;
      context.posting = grant.posting || '';
      return true;
    });
  }
  /** this store's grant lets the adviser POST (the owner chose adviser_posts); anything else prepares */
  function posts() {
    return !!context && context.role === 'adviser' && context.posting === 'adviser_posts';
  }
  /** the acting page shows only what is read and written through /api/books*: the tabs that call anything else are taken out of the menu, so no request outside it carries the store's header */
  var TABS = ['daybook', 'ledgers', 'tb', 'pl', 'bs', 'dues', 'lock'];
  function mayCall(path) {
    return !context || context.role === 'owner' || path.indexOf('/api/books') === 0;
  }
  /** the page's way in: only on a live adviser grant, then the menu is cut to the books tabs; false = not entered */
  function openPage(base, token, menu, groups) {
    if (!context) return Promise.resolve(true);
    return confirmGrant(base, token).catch(function (e) {
      if (typeof root.cblog === 'function') root.cblog('error', 'acting: the grant could not be read: ' + ((e && e.message) || e));
      return false;
    }).then(function (entered) {
      if (entered) {
        keepTabs(menu, groups);
        return true;
      }
      root.location.replace('/network.html');
      return new Promise(function () {}); /* the page is leaving: nothing after this runs */
    });
  }
  /** a call outside /api/books* is refused here, before it is sent, while the page acts for a store */
  function guard(endpoint) {
    if (!mayCall(endpoint.p)) throw new Error(words('This screen shows one client books only. Nothing was sent.'));
    return endpoint;
  }
  function firstTab() {
    return context && context.role !== 'owner' ? TABS[0] : 'todo';
  }
  function keepTabs(menu, groups) {
    if (!context || context.role === 'owner') return;
    for (var i = menu.length - 1; i >= 0; i--) if (TABS.indexOf(menu[i][0]) < 0) menu.splice(i, 1);
    for (var g = groups.length - 1; g >= 0; g--) {
      groups[g][1] = groups[g][1].filter(function (t) { return TABS.indexOf(t) >= 0; });
      if (!groups[g][1].length) groups.splice(g, 1);
    }
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
        o.onSwitch(box.value, box.options[box.selectedIndex].text);
      };
  }

  /** this page acts for a store as the adviser */
  function isAdviser() {
    return !!context && context.role === 'adviser';
  }
  /** an adviser's Save: POST /api/books-actions { store_id, kind: 'journal', body, client_ref, working_month } through the screen's own api; the journal's date is required; under the grant's adviser_posts the server posts it at once (state accepted, with its entry), otherwise it waits for review and the owner's accept */
  async function prepare(api, tx, entry, month) {
    if (entry.event !== 'journal') throw new Error(tx('An adviser prepares journals. Pick Journal.'));
    if (!entry.date) throw new Error(tx('Give the journal its date.'));
    var journal = Object.assign({}, entry);
    delete journal.event;
    delete journal.client_ref;
    var made = await api('booksActionPrepare', { body: body({ kind: 'journal', body: journal, client_ref: entry.client_ref, working_month: month }) });
    return Object.assign({ prepared: true, posted: made.state === 'accepted' && !!(made.entry || made.entry_no) }, made);
  }
  /** the screen after an adviser's Save: posted (adviser_posts: the answer carries its entry) or prepared and waiting */
  function paintPrepared(host, acts, saved, tell, esc2) {
    var done = '<button data-cbsid="CMP004" class="en-btn pri" data-testid="en-done" onclick="enClose()">' + esc2(tell('Done')) + '</button>';
    if (saved.posted) {
      var no = saved.entry_no || (saved.entry && (saved.entry.entry_no || saved.entry.no)) || '';
      host.innerHTML = '<h3 data-testid="en-posted"><span class="en-ok">✓</span> ' + esc2(tell('Posted')) + ' ' + esc2(no) + '</h3><div class="en-why" style="border:0;margin-top:10px">' + esc2(tell('It is now in the books of')) + ' ' + esc2(context ? context.store.name : '') + '.</div>';
      acts.innerHTML = done;
      return;
    }
    host.innerHTML =
      '<h3 data-testid="en-prepared"><span class="en-ok">✓</span> ' + esc2(tell('Prepared, waiting for review')) + '</h3><div data-testid="en-prepared-ref" class="en-chip">' + esc2(saved.client_ref || '') + '</div>' +
      '<div class="en-why" style="border:0;margin-top:10px">' + esc2(tell('A colleague reviews it, then the owner accepts. It is not posted until then.')) + '</div>';
    acts.innerHTML = done;
  }
  /** a page opened to act for a store (accounts.html): the frozen banner under the header, the way back, and, when asked (?prepare=journal), the journal sheet that PREPARES; byId is the page's element finder, openSheet its entry opener, currency the shop's */
  function startPage(byId, openSheet, currency) {
    if (!context) return;
    setCurrency(currency);
    var shell = byId('shell');
    var band = root.document.createElement('div');
    band.id = 'acting-band';
    band.setAttribute('data-testid', 'acting-band');
    band.innerHTML = banner();
    shell.parentNode.insertBefore(band, shell.nextSibling);
    wireBanner(band, { onBack: function () { root.location.assign('/network.html'); } });
    if (/[?&]prepare=journal/.test(root.location.search)) openSheet({ kind: 'journal' });
  }
  /** the role a held grant gives on one store: an adviser grant acts, anything else reads */
  function roleOf(held, id) {
    return (held[String(id)] || {}).preset === 'adviser' ? 'adviser' : 'auditor';
  }
  /** the stores a firm holds an ADVISER grant on, for the banner's switch (one store: no switch is drawn) */
  function adviserStores(stores, held) {
    return stores.filter(function (s) { return roleOf(held, s.entity_id) === 'adviser'; }).map(function (s) { return { id: s.entity_id, name: s.name }; });
  }

  root.CBBooksActing = { isAdviser: isAdviser, posts: posts, confirmGrant: confirmGrant, openPage: openPage, guard: guard, firstTab: firstTab, keepTabs: keepTabs, mayCall: mayCall, prepare: prepare, paintPrepared: paintPrepared, startPage: startPage, roleOf: roleOf, adviserStores: adviserStores, enter: enter, leave: leave, current: current, headers: headers, body: body, onClear: onClear, setCurrency: setCurrency, addressOf: addressOf, fromAddress: fromAddress, banner: banner, wireBanner: wireBanner, figure: figure, ownStore: ownStore };
})(typeof window !== 'undefined' ? window : globalThis);
