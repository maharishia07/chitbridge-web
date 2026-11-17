/**
 * network-books.js — My network: Open books on a store that holds a live grant, the seat choice, and the client's address in history.
 *
 * OWNS      the Open books cell and click (booksCell, openBooksClick) · which seat a firm opens a client as, remembered per client (openSeat, keepSeat) · the client and screen in the address, one history entry each (record, onPop) · the opened client's books view (paintOpened); moved out of network-app.js (2026-11-17, size ratchet; behaviour unchanged)
 * CALLED BY public/network.html (<script src>, before network-app.js) · app/network-app.js (CBNetworkBooks.create(ctx) once; ctx = N, T, $, call, sheet, closeSheet, mountList, paint)
 * FLOW      a store row → booksCell → openBooksClick → openSeat (asks only when the firm holds both an auditor and an adviser grant) → sitAs → record + paint → paintOpened mounts CBBooksGrantView; Back/Forward → onPop
 * CARD      04-network/network-app-member-view
 *
 * Decides nothing: the grants, seats and posting rights are the server's (CBBooksGrantApi.doorsFor); this file only chooses which door the person pressed.
 */
(function (root) {
  'use strict';
  /** the one factory: it gets the network page's shared state and helpers and returns the handlers the page wires */
  function create(ctx) {
    var N = ctx.N,
      T = ctx.T,
      $ = ctx.$,
      call = ctx.call,
      sheet = ctx.sheet,
      closeSheet = ctx.closeSheet,
      mountList = ctx.mountList;
    function paint() {
      ctx.paint();
    }
    /* ── ACC-176: a store that holds a live grant for this business gets "Open books"; a store without one shows nothing extra ── */
    function booksCell(s) {
      var id = esc(s.entity_id);
      return N.held[String(s.entity_id)]
        ? '<button data-cbsid="NET001-B04" type="button" class="act quiet" id="nw_books_' + id + '" data-open-books="' + id + '" data-testid="nw-books-' + id + '">' + esc(T('Open books')) + '</button>'
        : '<span class="sub" data-testid="nw-ended-' + id + '">' + esc(root.CBBooksGrantApi.endedWords(N.ended[String(s.entity_id)])) + '</span>';
    }
    function openBooksClick(ev) {
      var button = ev.target.closest && ev.target.closest('[data-open-books]');
      if (!button) return;
      var id = button.getAttribute('data-open-books');
      var store = N.stores.filter(function (s) { return String(s.entity_id) === id; })[0];
      openSeat(id, (N.held[id] && N.held[id].grantor_name) || (store && store.name) || T('this store'));
    }
    /** a firm that holds BOTH an auditor and an adviser grant on one client never gets one picked silently: it chooses the seat once, and the choice is remembered per client */
    var SEAT_KEY = 'cb_seat:';
    function quietSeat(failure) {
      if (root.cbQuiet) root.cbQuiet('network:seat', failure); /* storage blocked: the person is asked again next time */
    }
    function rememberedSeat(id) {
      try { return root.localStorage.getItem(SEAT_KEY + id); } catch (failure) { quietSeat(failure); return null; } /* no storage: ask each time */
    }
    function forgetSeat(id) {
      try { root.localStorage.removeItem(SEAT_KEY + id); } catch (failure) { quietSeat(failure); }
    }
    /** the seat is remembered only after the first books read of the client answered 200 (books-grant-view calls onRead): a refused choice is never stored. `at` = the screen and period the address named (a deep link, Back): kept, never cleared by the seat choice */
    function sitAs(id, name, preset, at) {
      N.held[id] = N.seats[id][preset];
      N.seatToKeep = { id: id, preset: preset };
      N.opened = { id: id, name: name, role: root.CBBooksActing.roleOf(N.held, id), posting: N.held[id].posting };
      if (at) { N.view = at.view || ''; N.period = at.period || null; } else { N.view = ''; N.period = null; }
      record(!!at);
      paint();
    }
    function keepSeat() {
      var keep = N.seatToKeep;
      if (!keep) return;
      N.seatToKeep = null;
      try { root.localStorage.setItem(SEAT_KEY + keep.id, keep.preset); } catch (failure) { quietSeat(failure); } /* a seat not remembered is asked again */
    }
    function openSeat(id, name, at) {
      var door = root.CBBooksGrantApi.doorsFor({ seats: N.seats, mine: N.mine }, id, rememberedSeat(id));
      if (door.stale) forgetSeat(id); /* a stored seat the server no longer lets this login use is dropped */
      if (door.refused) {
        N.opened = null;
        N.el.innerHTML = '<div data-testid="nw-refused"></div>';
        root.CBShell.readFailed(N.el.firstChild, { what: name, status: 403, back: { href: '/network.html', label: T('Back to My network') } });
        return;
      }
      if (door.open) return sitAs(id, name, door.open, at);
      sheet('<h2 data-testid="nw-seat-title">' + esc(T('How do you want to open')) + ' ' + esc(name) + '?</h2>' +
        '<p class="sub">' + esc(T('Your firm holds two kinds of access. Pick the one you are acting as now; it is remembered for this client.')) + '</p>' +
        '<div class="nw-acts"><button data-cbsid="NET001-B07" type="button" class="act" data-seat="auditor" data-testid="nw-seat-auditor">' + esc(T('Open as auditor')) + '</button>' +
        '<button data-cbsid="NET001-B08" type="button" class="act quiet" data-seat="adviser" data-testid="nw-seat-adviser">' + esc(T('Open as accountant')) + '</button></div>');
      Array.prototype.forEach.call($('nw_sheet').querySelectorAll('[data-seat]'), function (b) {
        b.onclick = function () { closeSheet(); sitAs(id, name, b.getAttribute('data-seat'), at); };
      });
    }
    /* ── l16 R4-2b: the client is in the address (?open=<client>&view=<screen>): every open client and every screen of its books is a history entry (pushState), Back and Forward restore it, and the page never falls back to the network list ── */
    function addressOfClient(id, view, period) {
      return '/network.html?open=' + encodeURIComponent(id) + (view ? '&view=' + encodeURIComponent(view) : '') + (view && period ? root.CBPeriodPick.toAddress(period) : '') + (view === 'daybook' && root.CBBooksGrantFilters ? root.CBBooksGrantFilters.carry(root.location.search, id) : '') + (view === 'daybook' && new root.URLSearchParams(root.location.search).get('open') === id && new root.URLSearchParams(root.location.search).get('since') === 'mine' ? '&since=mine' : ''); /* the period rides the address (&fy= or &from=&to=): Back and a shared link keep it; so do the Day book's filters (A3C, &dbf_*) */
    }
    /** record the client now open (or the list, id null) in history: push a new entry (replace: the one the address already names, on a deep link or a restore) */
    function record(replace, view, period) {
      if (!root.history || !root.history.pushState) return;
      var url = N.opened ? addressOfClient(N.opened.id, view != null ? view : N.view, period !== undefined ? period : N.period) : '/network.html';
      if (root.location.pathname + root.location.search === url) return;
      try {
        root.history[replace ? 'replaceState' : 'pushState']({ cbClient: N.opened ? N.opened.id : null }, '', url);
        if (!replace) N.pushed = (N.pushed || 0) + 1;
      } catch (failure) { if (root.cbQuiet) root.cbQuiet('network:history', failure); }
    }
    /** Back or Forward: the address names the client and the screen; restore them (the seat chosen for that client is remembered), re-reading nothing the page already holds */
    function onPop() {
      var query = new root.URLSearchParams(root.location.search), id = query.get('open'), view = query.get('view') || '';
      N.period = root.CBPeriodPick.fromAddress(root.location.search);
      if (!N.el || !N.held) return;
      if (!id || !N.held[id]) {
        if (N.opened) { N.opened = null; N.view = ''; N.period = null; paint(); }
        return;
      }
      if (N.opened && N.opened.id === id && N.handle) {
        N.view = view;
        if (view) N.handle.setView(view, N.period);
        else N.handle.setView(N.homeView || '', N.period);
        return;
      }
      N.view = view;
      openSeat(id, N.held[id].grantor_name || T('this store'), { view: view, period: N.period });
    }
    function paintOpened(host) {
      N.handle = root.CBBooksGrantView.mount(host, {
        view: N.view || undefined,
        period: N.period || null,
        onRead: keepSeat,
        onView: function (report, period) { N.view = report; N.period = period || null; record(false, report, N.period); },
        call: call,
        raw: function (path, headers) { return root.fetch((N.o.base || '') + path, { cache: 'no-store', headers: Object.assign({ Authorization: 'Bearer ' + N.o.token }, headers || {}) }); } /* a file: the same token and base as call, the answer left as bytes (cap-evidence.js) */,
        member: N.opened,
        stores: root.CBBooksActing.clientStores(N.stores, N.held),
        mountList: mountList, sheet: sheet, closeSheet: closeSheet,
        onEnded: N.o.onEnded,
        onSwitch: function (id, name) { openSeat(id, (N.held[id] && N.held[id].grantor_name) || name); },
        onBack: function () {
          /* E2 (Fable walk 17 Nov): "← Clients" goes to the practice list BY ADDRESS. history.back() stepped one TAB back (every screen of the books is a history entry), so the address and the screen disagreed and the list was never reached. The list is a new entry; Back from it returns to the client. */
          if (N.cameFromHome) { root.location.assign('/'); return; } /* fix1117 F1 (walk 17 Nov): a client opened from the practice Home goes back to that Home (the practice list), never to the network page's old client list (acc17 E2 sent it there) */
          var was = N.opened && N.opened.id;
          N.opened = null; N.view = ''; N.period = null;
          record(false);
          paint();
          var door = was && N.el && N.el.querySelector('[data-open-books="' + was + '"]'); /* focus lands on the "Open books" that opened it */
          if (door) door.focus();
        }
      });
    }
    return { booksCell: booksCell, openBooksClick: openBooksClick, openSeat: openSeat, onPop: onPop, paintOpened: paintOpened };
  }
  root.CBNetworkBooks = { create: create };
})(typeof window !== 'undefined' ? window : this);
