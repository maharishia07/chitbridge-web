/**
 * network-app.js — P2: NETWORK AS A SMALL APP (member view + Design tab). Athi, 2026-10-10: *"reuse Network lab … very easy."*
 *
 * OWNS      the Network small app: the three tabs (My network, Offers, Design), the member's In / Out choice on a brand's offer, and the design dry-run check; it computes nothing
 * CALLED BY public/network.html only (script tag network.html:83, CBNetworkApp.mount at network.html:118)
 * FLOW      mount(el, o) ──▶ load() reads GET /api/network-offers and the stores ──▶ paint() draws the tabs ──▶ paintMine | paintOffers | paintDesign ──▶ a choice or a check goes to the server, then reload()
 * CARD      04-network/network-app-member-view
 *
 * ACC-176 (books grant): a fourth section MY BOOKS (the member's "Who can see my books", books-grant-member.js) and, on My network, an "Open books" button on a store that holds a live grant for
 * this business (books-grant-view.js: read only). Both screens are theirs; this file only gives them its call(), its sheet and its CBList mount, and says which stores hold a grant.
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
  var N = { networks: [], notices: [], stores: [], may: { ok: false, why: null }, draft: undefined, el: null, o: {}, tab: 'mine', lists: {}, held: {}, opened: null };
  var STAND = { active: 'In', invited: 'Invited you', asked: 'You asked', requested: 'Asked', suspended: 'Paused', none: 'Not yet' };

  function T(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function $(id) {
    return root.document.getElementById(id);
  }

  /* ⭐ the endpoint registry — the ONE declaration shape (accounts-shell.js) the round-trip scanner reads
     (api tools/endpoint-usage.cjs): a call made any other way is invisible to the budget guard. */
  var EP = {
    nwValidate: { m: 'POST', p: '/api/network-design/validate' } // dry-run: what would break; posts nothing
  };
  function api(key, body) {
    var e = EP[key];
    return call(e.m, e.p, body);
  }
  function call(method, path, body, headers) {
    return root
      .fetch((N.o.base || '') + path, {
        method: method,
        cache: 'no-store',
        headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + N.o.token }, headers || {}),
        body: body ? JSON.stringify(body) : undefined
      })
      .then(function (reply) {
        return reply
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            if (reply.status === 401 && N.o.onEnded) N.o.onEnded();
            if (!reply.ok) {
              var e = new Error(j.message || j.error || 'API ' + reply.status);
              e.status = reply.status;
              throw e;
            }
            return j;
          });
      });
  }

  /* ── the reads: the member half is ONE call (networks · offers · may_design) and the store list ONE more ── */
  function load() {
    return Promise.all([
      call('GET', '/api/network-offers'),
      call('GET', '/api/network-design/stores').catch(function () {
        return { stores: [] };
      }),
      root.CBBooksGrantApi.held(call)
    ]).then(function (reply) {
      N.held = reply[2] || {};
      var s = (reply[0] && reply[0].store) || {};
      N.networks = s.networks || [];
      N.notices = s.price_notices || [];
      N.may = reply[0].may_design || N.may;
      N.stores = (reply[1] && reply[1].stores) || [];
    });
  }
  function offers() {
    var out = [];
    N.networks.forEach(function (item) {
      (item.offers || []).forEach(function (o) {
        out.push(Object.assign({ brand: item.brand_name, brand_id: item.brand_id, policy: item.policy }, o));
      });
    });
    return out;
  }
  function stand(n) {
    return T(STAND[(n.membership && n.membership.state) || 'none'] || 'Not yet');
  }

  /* ── frame of the page: the tab strip and the one place a tab draws ── */
  function paint() {
    var tabs = [
      ['mine', T('My network')],
      ['offers', T('Offers')],
      ['design', T('Design')],
      ['books', T('My books')]
    ];
    N.el.innerHTML =
      (N.o.sidebar
        ? ''
        : '<div class="nw-tabs" role="tablist" data-testid="nw-tabs">' +
          tabs
            .map(function (item) {
              var no = item[0] === 'design' && N.may.ok === false;
              return (
                '<button data-cbsid="NET001-B01" type="button" role="tab" class="nw-tab' +
                (N.tab === item[0] ? ' on' : '') +
                (no ? ' no' : '') +
                '" data-tab="' +
                item[0] +
                '" data-testid="nw-tab-' +
                item[0] +
                '" aria-selected="' +
                (N.tab === item[0]) +
                '">' +
                esc(item[1]) +
                '</button>'
              );
            })
            .join('') +
          '</div>') + '<div class="nw-body" id="nw_body" data-testid="nw-body"></div><dialog class="sheet" id="nw_sheet" data-testid="nw-sheet"></dialog>';
    Array.prototype.forEach.call(N.el.querySelectorAll('.nw-tab'), function (element) {
      element.onclick = function () {
        N.tab = element.getAttribute('data-tab');
        N.opened = null;
        paint();
      };
    });
    var node = $('nw_sheet');
    node.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeSheet();
    });
    node.addEventListener('click', function (e) {
      if (e.target === node) closeSheet();
    });
    ({ mine: paintMine, offers: paintOffers, design: paintDesign, books: paintBooks })[N.tab]($('nw_body'));
  }
  function sheet(html) {
    var node = $('nw_sheet');
    node.innerHTML = '<button data-cbsid="NET001-B02" type="button" class="mx" data-testid="nw-close" aria-label="' + esc(T('Close')) + '">✕</button>' + html;
    node.querySelector('.mx').onclick = closeSheet;
    if (!node.open) node.showModal();
  }
  function closeSheet() {
    var node = $('nw_sheet');
    try {
      node.close();
    } catch (_) {}
    node.innerHTML = '';
  }
  function mountList(host, cfg) {
    if (N.lists[cfg.key]) {
      try {
        N.lists[cfg.key].destroy();
      } catch (_) {}
    }
    root.CBList.reset && root.CBList.reset(cfg.key);
    cfg.t = T;
    N.lists[cfg.key] = root.CBList.mount(host, cfg);
  }

  /* ── MY NETWORK ── */
  function paintMine(host) {
    if (N.opened) return paintOpened(host);
    if (!N.networks.length && !N.stores.length) {
      host.innerHTML =
        '<div class="empty" data-testid="nw-none"><div class="t">' +
        esc(T('Not in a network yet')) +
        '</div><div>' +
        esc(T('When a brand adds this shop to its network, it shows here.')) +
        '</div></div>';
      return;
    }
    host.innerHTML = '<div class="nw-nets" data-testid="nw-nets">' + N.networks.map(netCard).join('') + '</div><div class="nw-list" id="nw_stores" data-testid="nw-stores"></div>';
    mountStores();
  }
  /** one network this store sits in: the brand, where this store stands, who its parent is */
  function netCard(item) {
        return (
          '<div class="nw-net" data-testid="nw-net-' +
          esc(item.brand_id) +
          '"><b>' +
          esc(item.brand_name) +
          '</b> <span class="tag' +
          ((item.membership || {}).state === 'active' ? ' green' : ' amber') +
          '">' +
          esc(stand(item)) +
          '</span>' +
          '<div class="sub">' +
          esc(T('Your parent')) +
          ': ' +
          esc(item.brand_name) +
          '</div></div>'
        );
  }
  /** the store list's columns */
  function storeColumns() {
    return [
      {
        key: 'name',
        label: T('Store'),
        prio: 1,
        w: 240,
        sort: 'name',
        html: true,
        value: function (s) {
          return s.name;
        },
        cell: function (s) {
          return '<b>' + esc(s.name) + '</b>' + (s.is_me ? ' <span class="tag">' + esc(T('You')) + '</span>' : '');
        }
      },
      {
        key: 'city',
        label: T('City'),
        prio: 2,
        w: 150,
        sort: 'city',
        cell: function (s) {
          return s.city || '—';
        },
        value: function (s) {
          return s.city || '';
        }
      },
      {
        key: 'km',
        label: T('Distance'),
        prio: 3,
        w: 110,
        sort: 'km',
        cell: function (s) {
          return s.km == null ? '—' : Math.round(s.km) + ' km';
        },
        value: function (s) {
          return s.km == null ? '' : String(s.km);
        }
      },
      {
        key: 'purpose',
        label: T('What it does'),
        prio: 4,
        w: 240,
        cell: function (s) {
          return s.purpose || '—';
        },
        value: function (s) {
          return s.purpose || '';
        }
      },
      {
        key: 'books',
        label: T('Books'),
        prio: 1,
        w: 130,
        html: true,
        cell: booksCell,
        value: function (s) {
          return N.held[String(s.entity_id)] ? 'open' : '';
        }
      }
    ];
  }
  /** the store list's sort choices */
  function storeSorts() {
    return [
      {
        key: 'name',
        label: T('Name'),
        cmp: function (a, b) {
          return String(a.name).localeCompare(String(b.name));
        }
      },
      {
        key: 'city',
        label: T('City'),
        cmp: function (a, b) {
          return String(a.city || '').localeCompare(String(b.city || ''));
        }
      },
      {
        key: 'km',
        label: T('Distance'),
        cmp: function (a, b) {
          return (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km);
        }
      }
    ];
  }
  /** the stores this login can see, as a CBList; a store that holds a live books grant gets "Open books" */
  function mountStores() {
    mountList($('nw_stores'), {
      key: 'network-stores',
      rows: function () {
        return N.stores;
      },
      id: function (s) {
        return s.entity_id;
      },
      rowTid: function (s) {
        return 'nw-store-' + s.entity_id;
      },
      columns: storeColumns(),
      search: function (s) {
        return [s.name, s.city, s.purpose].join(' ');
      },
      sorts: storeSorts(),
      empty: { title: T('No stores to show') }
    });
    $('nw_stores').addEventListener('click', openBooksClick);
  }

  /* ── ACC-176: a store that holds a live grant for this business gets "Open books"; a store without one shows nothing extra ── */
  function booksCell(s) {
    var id = esc(s.entity_id);
    return N.held[String(s.entity_id)]
      ? '<button data-cbsid="NET001-B04" type="button" class="act quiet" id="nw_books_' + id + '" data-open-books="' + id + '" data-testid="nw-books-' + id + '">' + esc(T('Open books')) + '</button>'
      : '';
  }
  function openBooksClick(ev) {
    var button = ev.target.closest && ev.target.closest('[data-open-books]');
    if (!button) return;
    var id = button.getAttribute('data-open-books');
    var store = N.stores.filter(function (s) {
      return String(s.entity_id) === id;
    })[0];
    N.opened = { id: id, name: (store && store.name) || T('this store') };
    paint();
  }
  function paintOpened(host) {
    root.CBBooksGrantView.mount(host, {
      call: call,
      member: N.opened,
      mountList: mountList,
      onEnded: N.o.onEnded,
      onBack: function () {
        var id = N.opened.id;
        N.opened = null;
        paint();
        var back = $('nw_books_' + id);
        if (back) back.focus();
      }
    });
  }

  /* ── MY BOOKS: the member's "Who can see my books" ── */
  function parentsOf() {
    return N.networks
      .filter(function (item) {
        return (item.membership || {}).state === 'active';
      })
      .map(function (item) {
        return { id: item.brand_id, name: item.brand_name };
      });
  }
  function paintBooks(host) {
    root.CBBooksGrantMember.mount(host, { call: call, parents: parentsOf, sheet: sheet, closeSheet: closeSheet, mountList: mountList });
  }

  /* ── OFFERS ── */
  function paintOffers(host) {
    host.innerHTML = '<div class="nw-list" id="nw_offers" data-testid="nw-offers"></div>';
    mountList($('nw_offers'), {
      key: 'network-offers',
      rows: offers,
      id: function (o) {
        return o.id;
      },
      rowTid: function (o) {
        return 'nw-offer-' + o.id;
      },
      columns: [
        {
          key: 'name',
          label: T('Offer'),
          prio: 1,
          w: 240,
          sort: 'name',
          html: true,
          value: function (o) {
            return o.name;
          },
          cell: function (o) {
            return '<b>' + esc(o.name) + '</b>';
          }
        },
        {
          key: 'brand',
          label: T('From'),
          prio: 2,
          w: 180,
          sort: 'brand',
          cell: function (o) {
            return o.brand;
          },
          value: function (o) {
            return o.brand;
          }
        },
        {
          key: 'applies',
          label: T('At your counter'),
          prio: 3,
          w: 150,
          sort: 'applies',
          html: true,
          value: function (o) {
            return o.applies ? T('On') : T('Off');
          },
          cell: function (o) {
            return '<span class="tag' + (o.applies ? ' green' : '') + '">' + esc(o.applies ? T('On') : T('Off')) + '</span>';
          }
        },
        {
          key: 'until',
          label: T('Until'),
          prio: 4,
          w: 130,
          cell: function (o) {
            return o.until ? String(o.until).slice(0, 10) : '—';
          },
          value: function (o) {
            return o.until || '';
          }
        }
      ],
      search: function (o) {
        return [o.name, o.brand].join(' ');
      },
      sorts: [
        {
          key: 'name',
          label: T('Offer'),
          cmp: function (a, b) {
            return String(a.name).localeCompare(String(b.name));
          }
        }
      ],
      onOpen: function (o) {
        openOffer(o);
      },
      empty: { title: T('No offers from your network yet') }
    });
  }
  function openOffer(o) {
    sheet(
      '<h2 data-testid="nw-offer-title">' +
        esc(o.name) +
        '</h2><div class="sub">' +
        esc(o.brand) +
        (o.live ? '' : ' · ' + esc(T('not live'))) +
        '</div>' +
        '<div class="nw-out" id="nw_out" data-testid="nw-out"></div><div class="nw-acts">' +
        '<button data-cbsid="NET002-B01" type="button" class="act" id="nw_in" data-testid="nw-offer-in">' +
        esc(T('Use this offer')) +
        '</button>' +
        '<button data-cbsid="NET002-B02" type="button" class="act quiet" id="nw_outb" data-testid="nw-offer-out">' +
        esc(T('Not for us')) +
        '</button></div>'
    );
    [
      ['nw_in', 'in', T('Now on at your counter.')],
      ['nw_outb', 'out', T('Turned off at your counter.')]
    ].forEach(function (item) {
      $(item[0]).onclick = function () {
        root.CBAction.run(
          $(item[0]),
          function () {
            return call('POST', '/api/network-offers/' + encodeURIComponent(o.id) + '/choice', { choice: item[1] });
          },
          {
            key: 'nw-choice-' + o.id,
            failed: T("Couldn't save that"),
            out: 'nw_out',
            outcome: function () {
              $('nw_out').textContent = item[2];
              load().then(function () {
                if (N.tab === 'offers') paint();
              });
            }
          }
        );
      };
    });
  }

  /* ── DESIGN: the builder's canvas, read + checked here; changed in the builder. Greyed with the server's sentence when this login may not. ── */
  function paintDesign(host) {
    var no = N.may.ok === false;
    host.innerHTML =
      '<div class="nw-design" data-testid="nw-design">' +
      (no ? '<div class="nw-why" data-testid="nw-design-why">' + esc(N.may.why || T('This login cannot design a network.')) + '</div>' : '') +
      '<div class="nw-tree" id="nw_tree" data-testid="nw-tree"><div class="loadwrap"><span class="spin"></span> ' +
      esc(T('Loading')) +
      '</div></div>' +
      '<div class="nw-out" id="nw_dout" data-testid="nw-check-out"></div><div class="nw-acts">' +
      '<button data-cbsid="NET003-B01" type="button" class="act" id="nw_check" data-testid="nw-check"' +
      (no ? ' disabled aria-disabled="true"' : '') +
      ' title="' +
      esc(no ? N.may.why || '' : T('See what would break — nothing is made')) +
      '">' +
      esc(T('Check this design')) +
      '</button>' +
      (no
        ? '<span class="act quiet" aria-disabled="true" data-testid="nw-builder">' + esc(T('Open the builder')) + '</span>'
        : '<a class="act quiet" href="/app.html#/network" data-testid="nw-builder">' + esc(T('Open the builder')) + '</a>') +
      '</div></div>';
    if (!no)
      $('nw_check').onclick = function () {
        check();
      };
    (N.draft !== undefined
      ? Promise.resolve()
      : call('GET', '/api/network-design').then(
          function (reply) {
            N.draft = reply.draft || null;
          },
          function () {
            N.draft = null;
          }
        )
    ).then(function () {
      drawTree();
    });
  }
  function drawTree() {
    var node = $('nw_tree');
    if (!node) return;
    var nodes = (N.draft && N.draft.nodes) || [];
    if (!nodes.length) {
      node.innerHTML =
        '<div class="empty"><div class="t">' +
        esc(T('No design yet')) +
        '</div><div>' +
        esc(T('Draw a network in the builder, then check it here.')) +
        '</div></div>';
      return;
    }
    function kids(key, depth) {
      return nodes
        .filter(function (item) {
          return (item.parent_key || null) === (key || null) && (key || item.root);
        })
        .map(function (item) {
          return (
            '<div class="nw-node" style="padding-inline-start:' +
            depth * 18 +
            'px" data-testid="nw-node-' +
            esc(item.key) +
            '"><b>' +
            esc(item.name || '—') +
            '</b> <span class="tag">' +
            esc(item.owned === false ? T('Partner') : T('Own')) +
            '</span></div>' +
            kids(item.key, depth + 1)
          );
        })
        .join('');
    }
    node.innerHTML =
      kids(null, 0) ||
      nodes
        .map(function (item) {
          return '<div class="nw-node"><b>' + esc(item.name || '—') + '</b></div>';
        })
        .join('');
  }
  function check() {
    root.CBAction.run(
      $('nw_check'),
      function () {
        return api('nwValidate', {});
      },
      {
        key: 'nw-check',
        failed: T("Couldn't check the design"),
        out: 'nw_dout',
        outcome: function (v) {
          var out = $('nw_dout');
          out.setAttribute('data-tone', v.ok ? 'ok' : 'error');
          out.textContent = v.says || '';
          var b = (v.breaks || [])
            .map(function (x) {
              return '<li data-testid="nw-break"><b>' + esc(x.name) + '</b> — ' + esc(x.reason) + '</li>';
            })
            .join('');
          var n = (v.notes || [])
            .map(function (x) {
              return '<li>' + esc(x) + '</li>';
            })
            .join('');
          if (b || n) out.insertAdjacentHTML('afterend', '<ul class="nw-breaks" data-testid="nw-breaks">' + b + n + '</ul>');
        }
      }
    );
  }

  function paintFail() {
    N.el.innerHTML =
      '<div class="empty" data-testid="nw-fail"><div class="t">' +
      esc(T("Couldn't read your network")) +
      '</div><button data-cbsid="NET001-B03" type="button" class="act" id="nw_retry" data-testid="nw-retry">' +
      esc(T('Try again')) +
      '</button></div>';
    $('nw_retry').onclick = start;
  }
  function start() {
    N.el.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(T('Loading')) + '</div>';
    return load().then(paint, paintFail);
  }
  function reload() {
    return load().then(paint, paintFail);
  }
  function go(tab) {
    if (N.tab !== tab || N.opened) {
      N.tab = tab;
      N.opened = null;
      if (N.el.querySelector('#nw_body')) paint();
    }
  } /* the page's sidebar picks the section; the in-page tab strip is for a page without one */
  function mount(el, o) {
    N.el = el;
    N.o = o || {};
    start();
    return { reload: reload, go: go };
  }
  root.CBNetworkApp = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
