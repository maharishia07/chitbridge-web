/**
 * firm-door.js — FIRM-PARENT-DOOR (18 Nov 2026): HOW AN ACCOUNTING FIRM BECOMES A SHOP'S ACCOUNTANT OR AUDITOR, from a screen.
 *
 * OWNS      one card with an invite box and a list of the agency connections (a firm over its client): the owner's "Your accountant or auditor" (My books) and the firm's "Your clients: add a client" (the practice page). Ask by handle, Accept, Decline, Cancel, Remove.
 * HOME      o.home (a firm with no client yet): the page above already says what happens next, so the card keeps its box and list and leaves out its own sentence.
 * CALLED BY books-grant-member.js (side 'owner', above "Access I gave") · books-practice.js (side 'firm', above the client list)
 * FLOW      mount(host, o) → GET /entities/lookup (own node, once) → GET /entities/:id/connections → keep the agency rows of this side → paint (CBList) → Ask / Accept / Decline / Cancel / Remove (CBAction) → reload. Accept on the owner side = approve, then the existing Give access sheet (o.giveTo) for the data consent.
 * CARD      04-network/connections-and-invitations
 *
 * The relationship and the data access are two consents: accepting connects, it never opens the books. The server decides who may ask (the business owner only) and why not; a refusal is shown in its own words and the control is greyed with that sentence.
 *   CBFirmDoor.mount(host, { side: 'owner' | 'firm', token, base, call?, bridgeId?, mountList?, giveTo?(name), access?() → [names with access], onChange? }) → Promise<{ reload }>
 * REUSE (named in the PR): CBList (mountList or CBList.mount) · CBAction.run (confirm, busy, outcome, onFail) · books-grant-member's Give access sheet (giveTo) · the api's one edge ask (POST /api/network/connections, type agency) and its approve · decline · disconnect.
 */
(function (root) {
  'use strict';
  /* Plain paths on purpose (as books-grant-api.js does for the six reads): the endpoint registry already names each of these in app.html (netLookup · netConnections · netConnect · netApprove · netDecline · netDisconnect),
     and e2e/ep-aliases.cjs fails an endpoint with two names. This module is loaded on pages that have no app.html registry, so it carries the paths, not a second name. */
  var NET = '/api/network';
  var DOOR = {
    lookup: { m: 'GET', url: function () { return NET + '/entities/lookup'; } },
    edges: { m: 'GET', url: function (id) { return NET + '/entities/' + encodeURIComponent(id) + '/connections'; } },
    ask: { m: 'POST', url: function () { return NET + '/connections'; } },
    approve: { m: 'POST', url: function (id) { return NET + '/connections/' + encodeURIComponent(id) + '/approve'; } },
    decline: { m: 'POST', url: function (id) { return NET + '/connections/' + encodeURIComponent(id) + '/decline'; } },
    remove: { m: 'POST', url: function (id) { return NET + '/connections/' + encodeURIComponent(id) + '/disconnect'; } }
  };
  var COPY = {
    owner: {
      title: 'Your accountant or auditor',
      sub: 'Invite your firm by handle. They see your books only when you give access.',
      placeholder: 'Your firm\'s handle',
      add: 'Invite',
      emptyTitle: 'No accountant or auditor',
      emptyBody: 'Invite your firm above.',
      asked: 'Invited.'
    },
    firm: {
      title: 'Add a client',
      sub: 'Add a business by handle or bridge id. You see their books only when they give access.',
      placeholder: 'Client handle or bridge id',
      add: 'Add a client',
      emptyTitle: 'No clients yet',
      emptyBody: 'Add a client above.',
      asked: 'Request sent.'
    }
  };
  var seen = {}; /* the own node id, per bridge id: read once, never twice */

  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  /** the page's own call when it gives one; else a plain authed fetch (the practice page has none) */
  function callOf(o) {
    if (o.call) return o.call;
    return function (method, path, body) {
      return root.fetch((o.base || '') + path, { method: method, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + o.token }, body: body ? JSON.stringify(body) : undefined }).then(function (reply) {
        return reply.json().catch(function () { return {}; }).then(function (json) {
          if (!reply.ok) { var failure = new Error(json.message || json.detail || json.error || 'API ' + reply.status); failure.status = reply.status; failure.code = json.code; throw failure; }
          return json;
        });
      });
    };
  }
  function bridgeOf(o) {
    var claims = (o.token && typeof root.jwtPayload === 'function' && root.jwtPayload(o.token)) || {};
    return o.bridgeId || claims.bridge_id || '';
  }
  /** what a row of this side says, from the edge: who is on the other end, who asked, where it stands */
  function rowOf(edge, node, side) {
    var theirs = side === 'owner';
    return { id: edge.id, name: (theirs ? edge.parent_name : edge.child_name) || words('A business'), state: edge.state, mine: String(edge.requested_by) === String(node) };
  }
  /** the agency edges of this side only: the owner's firm is the PARENT of its edge, the firm's client is the CHILD */
  function sideEdges(edges, node, side) {
    return (edges || []).filter(function (edge) {
      return edge.type === 'agency' && String(side === 'owner' ? edge.child_id : edge.parent_id) === String(node);
    });
  }
  function stateWords(row, side, hasAccess) {
    if (row.state === 'requested') return words(row.mine ? (side === 'owner' ? 'Invited. Waiting for them' : 'Asked. Waiting for them') : side === 'owner' ? 'Asks to be your accountant or auditor' : 'Asks you to act for them');
    if (row.state === 'suspended') return words('Paused');
    return words(side === 'owner' ? (hasAccess ? 'Connected. Has access' : 'Connected. No access yet') : 'Connected');
  }

  /** the card's own look on a page that has none (Home): the same tokens as the page, nothing else; network.html already styles its own */
  function doorCss() {
    if (!root.document || root.document.getElementById('fd_css')) return;
    var node = root.document.createElement('style');
    node.id = 'fd_css';
    node.textContent = '.fd-card{margin:0 0 16px}.fd-h{margin:0 0 4px;font-size:16px;color:var(--ink)}.fd-card .sub{color:var(--muted);font-size:13px}' +
      '.fd-ask{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 0}.fd-ask .inp{flex:1 1 220px;min-width:0;min-height:44px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font:inherit}' +
      '.fd-card .act{min-height:44px;padding:0 16px;border:1px solid var(--green);border-radius:9px;background:var(--green);color:var(--card);font:inherit;font-weight:600;cursor:pointer}.fd-card .act[disabled]{opacity:.55;cursor:not-allowed}' +
      '.fd-card .nw-out{min-height:20px;margin:4px 0;font-weight:600;color:var(--green-d)}.fd-card .nw-list{min-height:0}';
    root.document.head.appendChild(node);
  }
  function mount(host, o) {
    doorCss();
    var side = o.side === 'firm' ? 'firm' : 'owner';
    var copy = COPY[side];
    var call = callOf(o);
    var inst = { node: null, rows: [], why: null };
    var tid = function (name) { return 'fd-' + side + '-' + name; };
    var $ = function (id) { return root.document.getElementById(id + '-' + side); };

    function run(key, id, body) {
      return call(DOOR[key].m, DOOR[key].url(id), body);
    }
    function readNode() {
      var bridge = bridgeOf(o);
      if (seen[bridge]) return Promise.resolve(seen[bridge]);
      return call(DOOR.lookup.m, DOOR.lookup.url() + '?bridgeId=' + encodeURIComponent(bridge)).then(function (card) {
        var node = card && (card.entity ? card.entity.id : card.id);
        if (node) seen[bridge] = node;
        return node || null;
      });
    }
    /** the node and its edges; a business with no place on the network yet has none, and says so as an empty list */
    function read() {
      return readNode().then(function (node) {
        inst.node = node;
        return node ? run('edges', node) : [];
      }).then(function (edges) {
        inst.rows = sideEdges(Array.isArray(edges) ? edges : [], inst.node, side).map(function (edge) { return rowOf(edge, inst.node, side); });
      });
    }
    function reload() {
      return read().then(paint, paintFail);
    }
    function changed() {
      if (o.onChange) o.onChange();
      return reload();
    }
    function hasAccess(row) {
      return ((o.access && o.access()) || []).indexOf(row.name) >= 0;
    }
    function actionsOf() {
      var asked = function (row) { return row.state === 'requested' && !row.mine; };
      return [
        { id: 'accept', tid: tid('accept'), label: words('Accept'), when: asked, run: accept },
        { id: 'decline', tid: tid('decline'), label: words('Decline'), when: asked, run: function (row) { settle(row, 'decline', 'Declined.', 'Decline this request?'); } },
        { id: 'cancel', tid: tid('cancel'), label: words('Cancel'), when: function (row) { return row.state === 'requested' && row.mine; }, run: function (row) { settle(row, 'decline', 'Cancelled.'); } },
        { id: 'give', tid: tid('give'), label: words('Give access'), when: function (row) { return side === 'owner' && row.state === 'active' && !hasAccess(row); }, run: function (row) { if (o.giveTo) o.giveTo(row.name); } },
        { id: 'remove', tid: tid('remove'), label: words('Remove'), when: function (row) { return row.state === 'active' || row.state === 'suspended'; }, run: function (row) { settle(row, 'remove', 'Removed.', side === 'owner' ? 'Remove this firm?' : 'Remove this client?', true); } }
      ];
    }
    /** one write on one connection, a confirm when it ends something; the row list is read again */
    function settle(row, key, done, question, danger) {
      root.CBAction.run(null, function () { return run(key, row.id, {}); }, {
        key: 'fd-' + key + '-' + row.id,
        confirm: question ? { title: words(question), body: '<b>' + root.esc(row.name) + '</b> ' + root.esc(words(danger ? (side === 'owner' ? 'can no longer open your books.' : 'is no longer your client.') : 'will be told.')), yes: words(danger ? 'Remove' : 'Decline'), danger: !!danger } : undefined,
        failed: words('Could not do it'),
        done: words(done),
        outcome: function () { changed(); }
      });
    }
    /** ONE step for the owner: accept the connection, then the existing Give access sheet for the data consent. Accepting alone gives nothing. */
    function accept(row) {
      root.CBAction.run(null, function () { return run('approve', row.id, {}); }, {
        key: 'fd-accept-' + row.id,
        confirm: { title: words('Accept ') + row.name + '?', body: root.esc(words(side === 'owner' ? 'Your books stay closed until you give access.' : 'You see their books only when they give access.')), yes: words('Accept') },
        failed: words('Could not accept'),
        done: side === 'owner' ? undefined : words('Accepted.'),
        outcome: function () {
          changed().then(function () { if (side === 'owner' && o.giveTo) o.giveTo(row.name); });
        }
      });
    }
    function ask() {
      var input = $('fd_handle');
      var handle = input.value.trim();
      if (!handle) { input.focus(); return; }
      var body = side === 'owner' ? { parentHandle: handle, type: 'agency' } : { childHandle: handle, type: 'agency' };
      root.CBAction.run($('fd_add'), function () { return run('ask', null, body); }, {
        key: 'fd-ask-' + side,
        failed: words(side === 'owner' ? 'Could not invite' : 'Could not add'),
        out: 'fd_out-' + side,
        outcome: function () { input.value = ''; changed().then(function () { say(copy.asked); }); },
        onFail: function (why, failure) { grey(why, failure); }
      });
    }
    function say(text) {
      var out = $('fd_out');
      if (out) out.textContent = words(text);
    }
    /** the server refused the person (not the owner): the box stays, the action is greyed WITH the server's sentence */
    function grey(why, failure) {
      say(why);
      if (failure && failure.status === 403) {
        root.setTimeout(function () { /* CBAction frees the button as its last act; the grey goes on after it */
          var button = $('fd_add');
          if (!button) return;
          button.setAttribute('disabled', '');
          button.setAttribute('aria-disabled', 'true');
          button.title = why;
        }, 60);
      }
    }
    function paint() {
      host.innerHTML =
        '<section class="fd-card" data-testid="' + tid('card') + '"><h3 class="fd-h">' + root.esc(words(copy.title)) + '</h3>' + (o.home ? '' : '<div class="sub" data-testid="' + tid('note') + '">' + root.esc(words(copy.sub)) + '</div>') +
        '<div class="nw-acts fd-ask"><input data-cbsid="NET004-I06" id="fd_handle-' + side + '" class="inp" maxlength="80" autocomplete="off" data-testid="' + tid('handle') + '" aria-label="' + root.esc(words(copy.placeholder)) + '" placeholder="' + root.esc(words(copy.placeholder)) + '">' +
        '<button data-cbsid="NET004-B14" type="button" class="act" id="fd_add-' + side + '" data-testid="' + tid('add') + '">' + root.esc(words(copy.add)) + '</button></div>' +
        '<div class="nw-out" id="fd_out-' + side + '" data-testid="' + tid('out') + '" role="status"></div><div class="nw-list" id="fd_list-' + side + '" data-testid="' + tid('list') + '"></div></section>';
      $('fd_add').onclick = ask;
      $('fd_handle').onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ask(); } };
      mountRows($('fd_list'));
    }
    function mountRows(listHost) {
      var cfg = {
        key: 'firm-door-' + side,
        t: words,
        rows: function () { return inst.rows; },
        id: function (row) { return row.id; },
        rowTid: function (row) { return 'fd-row-' + row.id; },
        columns: [
          { key: 'who', label: words(side === 'owner' ? 'Firm' : 'Client'), prio: 1, w: 220, cell: function (row) { return row.name; }, value: function (row) { return row.name; } },
          { key: 'state', label: words('State'), prio: 1, w: 260, cell: function (row) { return stateWords(row, side, hasAccess(row)); }, value: function (row) { return row.state; } }
        ],
        actions: actionsOf(),
        search: function (row) { return row.name; },
        empty: { title: words(copy.emptyTitle), sub: words(copy.emptyBody) }
      };
      if (o.mountList) o.mountList(listHost, cfg);
      else {
        root.CBList.reset && root.CBList.reset(cfg.key);
        root.CBList.mount(listHost, cfg);
      }
    }
    function paintFail() {
      host.innerHTML = '<section class="fd-card" data-testid="' + tid('card') + '"><h3 class="fd-h">' + root.esc(words(copy.title)) + '</h3><div class="sub" role="status" data-testid="' + tid('fail') + '">' + root.esc(words('Could not load the list.')) + '</div>' +
        '<button data-cbsid="NET004-B15" type="button" class="act" id="fd_retry-' + side + '" data-testid="' + tid('retry') + '">' + root.esc(words('Try again')) + '</button></section>';
      $('fd_retry').onclick = reload;
    }
    return reload().then(function () { return { reload: reload }; });
  }
  root.CBFirmDoor = { mount: mount, sideEdges: sideEdges, rowOf: rowOf, stateWords: stateWords, DOOR: DOOR };
})(typeof window !== 'undefined' ? window : globalThis);
