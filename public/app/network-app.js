/**
 * network-app.js — P2: NETWORK AS A SMALL APP (member view + Design tab). Athi, 2026-10-10: *"reuse Network lab … very easy."*
 *
 * Three tabs on one page: MY NETWORK (the networks this store sits in, who its parent is, the stores it can see — a CBList) · OFFERS
 * (what each brand released to it, and whether it takes them — a CBList; In / Out are CBAction writes) · DESIGN (the builder's canvas,
 * shown for every login and greyed with the SERVER's sentence for one that may not design: GET /api/network-offers → may_design).
 * This file decides nothing about who may do what, and computes nothing: the server says what is in, what applies, what would break.
 *
 * REUSE (named in the PR): CBList (list-ctl.js) · CBAction (accounts-shell.js, M64) · GET /api/network-offers (the member half: networks,
 * membership, offers) · GET /api/network-design/stores · GET /api/network-design (the saved draft) · POST /api/network-design/validate
 * (the dry-run — the same plan() Build runs; posts nothing) · POST /api/network-offers/:id/choice. The builder itself stays in app.html
 * (cap-network.js) — the Design tab here READS the draft and CHECKS it; "Open the builder" goes there to change it.
 *
 *   CBNetworkApp.mount(el, { token, base, onEnded }) → { reload }
 */
(function (root) {
  'use strict';
  var N = { networks: [], notices: [], stores: [], may: { ok: false, why: null }, draft: undefined, el: null, o: {}, tab: 'mine', lists: {} };
  var STAND = { active: 'In', invited: 'Invited you', asked: 'You asked', requested: 'Asked', suspended: 'Paused', none: 'Not yet' };

  function T(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return root.document.getElementById(id); }

  function call(method, path, body) {
    return root.fetch((N.o.base || '') + path, { method: method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + N.o.token }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && N.o.onEnded) N.o.onEnded();
          if (!r.ok) { var e = new Error(j.message || j.error || 'API ' + r.status); e.status = r.status; throw e; }
          return j;
        });
      });
  }

  /* ── the reads: the member half is ONE call (networks · offers · may_design) and the store list ONE more ── */
  function load() {
    return Promise.all([call('GET', '/api/network-offers'), call('GET', '/api/network-design/stores').catch(function () { return { stores: [] }; })]).then(function (r) {
      var s = (r[0] && r[0].store) || {};
      N.networks = s.networks || []; N.notices = s.price_notices || []; N.may = r[0].may_design || N.may; N.stores = (r[1] && r[1].stores) || [];
    });
  }
  function offers() {
    var out = [];
    N.networks.forEach(function (n) { (n.offers || []).forEach(function (o) { out.push(Object.assign({ brand: n.brand_name, brand_id: n.brand_id, policy: n.policy }, o)); }); });
    return out;
  }
  function stand(n) { return T(STAND[(n.membership && n.membership.state) || 'none'] || 'Not yet'); }

  /* ── frame of the page: the tab strip and the one place a tab draws ── */
  function paint() {
    var tabs = [['mine', T('My network')], ['offers', T('Offers')], ['design', T('Design')]];
    N.el.innerHTML = '<div class="nw-tabs" role="tablist" data-testid="nw-tabs">' + tabs.map(function (t) {
      var no = t[0] === 'design' && N.may.ok === false;
      return '<button type="button" role="tab" class="nw-tab' + (N.tab === t[0] ? ' on' : '') + (no ? ' no' : '') + '" data-tab="' + t[0] + '" data-testid="nw-tab-' + t[0] + '" aria-selected="' + (N.tab === t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div><div class="nw-body" id="nw_body" data-testid="nw-body"></div><dialog class="sheet" id="nw_sheet" data-testid="nw-sheet"></dialog>';
    Array.prototype.forEach.call(N.el.querySelectorAll('.nw-tab'), function (b) { b.onclick = function () { N.tab = b.getAttribute('data-tab'); paint(); }; });
    var d = $('nw_sheet');
    d.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });
    d.addEventListener('click', function (e) { if (e.target === d) closeSheet(); });
    ({ mine: paintMine, offers: paintOffers, design: paintDesign })[N.tab]($('nw_body'));
  }
  function sheet(html) { var d = $('nw_sheet'); d.innerHTML = '<button type="button" class="mx" data-testid="nw-close" aria-label="' + esc(T('Close')) + '">✕</button>' + html; d.querySelector('.mx').onclick = closeSheet; if (!d.open) d.showModal(); }
  function closeSheet() { var d = $('nw_sheet'); try { d.close(); } catch (_) {} d.innerHTML = ''; }
  function mountList(host, cfg) {
    if (N.lists[cfg.key]) { try { N.lists[cfg.key].destroy(); } catch (_) {} }
    root.CBList.reset && root.CBList.reset(cfg.key);
    cfg.t = T; N.lists[cfg.key] = root.CBList.mount(host, cfg);
  }

  /* ── MY NETWORK ── */
  function paintMine(host) {
    if (!N.networks.length && !N.stores.length) {
      host.innerHTML = '<div class="empty" data-testid="nw-none"><div class="t">' + esc(T('Not in a network yet')) + '</div><div>' + esc(T('When a brand adds this shop to its network, it shows here.')) + '</div></div>';
      return;
    }
    host.innerHTML = '<div class="nw-nets" data-testid="nw-nets">' + N.networks.map(function (n) {
      return '<div class="nw-net" data-testid="nw-net-' + esc(n.brand_id) + '"><b>' + esc(n.brand_name) + '</b> <span class="tag' + ((n.membership || {}).state === 'active' ? ' green' : ' amber') + '">' + esc(stand(n)) + '</span>'
        + '<div class="sub">' + esc(T('Your parent')) + ': ' + esc(n.brand_name) + '</div></div>';
    }).join('') + '</div><div class="nw-list" id="nw_stores" data-testid="nw-stores"></div>';
    mountList($('nw_stores'), {
      key: 'network-stores', rows: function () { return N.stores; }, id: function (s) { return s.entity_id; }, rowTid: function (s) { return 'nw-store-' + s.entity_id; },
      columns: [
        { key: 'name', label: T('Store'), prio: 1, w: 240, sort: 'name', html: true, value: function (s) { return s.name; }, cell: function (s) { return '<b>' + esc(s.name) + '</b>' + (s.is_me ? ' <span class="tag">' + esc(T('You')) + '</span>' : ''); } },
        { key: 'city', label: T('City'), prio: 2, w: 150, sort: 'city', cell: function (s) { return s.city || '—'; }, value: function (s) { return s.city || ''; } },
        { key: 'km', label: T('Distance'), prio: 3, w: 110, sort: 'km', cell: function (s) { return s.km == null ? '—' : Math.round(s.km) + ' km'; }, value: function (s) { return s.km == null ? '' : String(s.km); } },
        { key: 'purpose', label: T('What it does'), prio: 4, w: 240, cell: function (s) { return s.purpose || '—'; }, value: function (s) { return s.purpose || ''; } }
      ],
      search: function (s) { return [s.name, s.city, s.purpose].join(' '); },
      sorts: [{ key: 'name', label: T('Name'), cmp: function (a, b) { return String(a.name).localeCompare(String(b.name)); } },
              { key: 'city', label: T('City'), cmp: function (a, b) { return String(a.city || '').localeCompare(String(b.city || '')); } },
              { key: 'km', label: T('Distance'), cmp: function (a, b) { return (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km); } }],
      empty: { title: T('No stores to show') }
    });
  }

  /* ── OFFERS ── */
  function paintOffers(host) {
    host.innerHTML = '<div class="nw-list" id="nw_offers" data-testid="nw-offers"></div>';
    mountList($('nw_offers'), {
      key: 'network-offers', rows: offers, id: function (o) { return o.id; }, rowTid: function (o) { return 'nw-offer-' + o.id; },
      columns: [
        { key: 'name', label: T('Offer'), prio: 1, w: 240, sort: 'name', html: true, value: function (o) { return o.name; }, cell: function (o) { return '<b>' + esc(o.name) + '</b>'; } },
        { key: 'brand', label: T('From'), prio: 2, w: 180, sort: 'brand', cell: function (o) { return o.brand; }, value: function (o) { return o.brand; } },
        { key: 'applies', label: T('At your counter'), prio: 3, w: 150, sort: 'applies', html: true, value: function (o) { return o.applies ? T('On') : T('Off'); },
          cell: function (o) { return '<span class="tag' + (o.applies ? ' green' : '') + '">' + esc(o.applies ? T('On') : T('Off')) + '</span>'; } },
        { key: 'until', label: T('Until'), prio: 4, w: 130, cell: function (o) { return o.until ? String(o.until).slice(0, 10) : '—'; }, value: function (o) { return o.until || ''; } }
      ],
      search: function (o) { return [o.name, o.brand].join(' '); },
      sorts: [{ key: 'name', label: T('Offer'), cmp: function (a, b) { return String(a.name).localeCompare(String(b.name)); } }],
      onOpen: function (o) { openOffer(o); },
      empty: { title: T('No offers from your network yet') }
    });
  }
  function openOffer(o) {
    sheet('<h2 data-testid="nw-offer-title">' + esc(o.name) + '</h2><div class="sub">' + esc(o.brand) + (o.live ? '' : ' · ' + esc(T('not live'))) + '</div>'
      + '<div class="nw-out" id="nw_out" data-testid="nw-out"></div><div class="nw-acts">'
      + '<button type="button" class="act" id="nw_in" data-testid="nw-offer-in">' + esc(T('Use this offer')) + '</button>'
      + '<button type="button" class="act quiet" id="nw_outb" data-testid="nw-offer-out">' + esc(T('Not for us')) + '</button></div>');
    [['nw_in', 'in', T('Now on at your counter.')], ['nw_outb', 'out', T('Turned off at your counter.')]].forEach(function (a) {
      $(a[0]).onclick = function () {
        root.CBAction.run($(a[0]), function () { return call('POST', '/api/network-offers/' + encodeURIComponent(o.id) + '/choice', { choice: a[1] }); },
          { key: 'nw-choice-' + o.id, failed: T("Couldn't save that"), out: 'nw_out', outcome: function () { $('nw_out').textContent = a[2]; load().then(function () { if (N.tab === 'offers') paint(); }); } });
      };
    });
  }

  /* ── DESIGN: the builder's canvas, read + checked here; changed in the builder. Greyed with the server's sentence when this login may not. ── */
  function paintDesign(host) {
    var no = N.may.ok === false;
    host.innerHTML = '<div class="nw-design" data-testid="nw-design">'
      + (no ? '<div class="nw-why" data-testid="nw-design-why">' + esc(N.may.why || T('This login cannot design a network.')) + '</div>' : '')
      + '<div class="nw-tree" id="nw_tree" data-testid="nw-tree"><div class="loadwrap"><span class="spin"></span> ' + esc(T('Loading')) + '</div></div>'
      + '<div class="nw-out" id="nw_dout" data-testid="nw-check-out"></div><div class="nw-acts">'
      + '<button type="button" class="act" id="nw_check" data-testid="nw-check"' + (no ? ' disabled aria-disabled="true"' : '') + ' title="' + esc(no ? (N.may.why || '') : T('See what would break — nothing is made')) + '">' + esc(T('Check this design')) + '</button>'
      + (no ? '<span class="act quiet" aria-disabled="true" data-testid="nw-builder">' + esc(T('Open the builder')) + '</span>'
            : '<a class="act quiet" href="/app.html#/network" data-testid="nw-builder">' + esc(T('Open the builder')) + '</a>') + '</div></div>';
    if (!no) $('nw_check').onclick = function () { check(); };
    (N.draft !== undefined ? Promise.resolve() : call('GET', '/api/network-design').then(function (j) { N.draft = j.draft || null; }, function () { N.draft = null; })).then(function () { drawTree(); });
  }
  function drawTree() {
    var t = $('nw_tree'); if (!t) return;
    var nodes = (N.draft && N.draft.nodes) || [];
    if (!nodes.length) { t.innerHTML = '<div class="empty"><div class="t">' + esc(T('No design yet')) + '</div><div>' + esc(T('Draw a network in the builder, then check it here.')) + '</div></div>'; return; }
    function kids(key, depth) {
      return nodes.filter(function (n) { return (n.parent_key || null) === (key || null) && (key || n.root); }).map(function (n) {
        return '<div class="nw-node" style="padding-inline-start:' + (depth * 18) + 'px" data-testid="nw-node-' + esc(n.key) + '"><b>' + esc(n.name || '—') + '</b> <span class="tag">' + esc(n.owned === false ? T('Partner') : T('Own')) + '</span></div>' + kids(n.key, depth + 1);
      }).join('');
    }
    t.innerHTML = kids(null, 0) || nodes.map(function (n) { return '<div class="nw-node"><b>' + esc(n.name || '—') + '</b></div>'; }).join('');
  }
  function check() {
    root.CBAction.run($('nw_check'), function () { return call('POST', '/api/network-design/validate', {}); },
      { key: 'nw-check', failed: T("Couldn't check the design"), out: 'nw_dout',
        outcome: function (v) {
          var out = $('nw_dout'); out.setAttribute('data-tone', v.ok ? 'ok' : 'error'); out.textContent = v.says || '';
          var b = (v.breaks || []).map(function (x) { return '<li data-testid="nw-break"><b>' + esc(x.name) + '</b> — ' + esc(x.reason) + '</li>'; }).join('');
          var n = (v.notes || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
          if (b || n) out.insertAdjacentHTML('afterend', '<ul class="nw-breaks" data-testid="nw-breaks">' + b + n + '</ul>');
        } });
  }

  function paintFail() {
    N.el.innerHTML = '<div class="empty" data-testid="nw-fail"><div class="t">' + esc(T("Couldn't read your network")) + '</div><button type="button" class="act" id="nw_retry" data-testid="nw-retry">' + esc(T('Try again')) + '</button></div>';
    $('nw_retry').onclick = start;
  }
  function start() {
    N.el.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(T('Loading')) + '</div>';
    return load().then(paint, paintFail);
  }
  function reload() { return load().then(paint, paintFail); }
  function mount(el, o) { N.el = el; N.o = o || {}; start(); return { reload: reload }; }
  root.CBNetworkApp = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
