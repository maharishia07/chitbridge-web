/**
 * books-grant-firms.js — UX-215, THE OUTSIDE FIRMS on "Who can see my books" (split out of books-grant-member.js, no behaviour change).
 *
 * OWNS      the firms that asked to read this business's books (list, Accept, Decline) and Invite a firm by its User ID: the network's own connect routes, nothing worked out here
 * CALLED BY books-grant-member.js (asking before the list is drawn, html above it, answer and invite from its buttons)
 * FLOW      asking(ctx) → GET /api/network/entities/:id/connections → ctx.panel.firms → html(ctx) → answer(ctx, button) / invite(ctx) → POST /api/network/connections[/:id/approve|decline] → ctx.reload
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 * ID        NET004
 * OWNER     cb-network
 * RISK      security
 *
 *   CBBooksGrantFirms.asking(ctx) · html(ctx) · answer(ctx, button) · invite(ctx)   with ctx = { panel, escapeHtml, words, $, reload, paint } — the member screen's own state and helpers
 */
(function (root) {
  'use strict';
  /* ── outside firms (UX-215): the ways in other than a network parent ──
   The connect routes are the network's own (POST /api/network/connections, .../:id/approve, .../:id/decline, GET /api/network/entities/:id/connections): a firm is the PARENT, this business the CHILD, type agency.
   Once active, the same edge makes the firm a grant parent, so the one Give access form offers it and the one gate (verdictOf) admits it: no second grant path. */
  var NETWORK = '/api/network';
  /** this business's node id (the network's id space, not the identity's): me, then bridge id, then lookup; read once */
  function ownNode(ctx) {
    var panel = ctx.panel;
    if (panel.node) return Promise.resolve(panel.node);
    return panel.o.call('GET', '/api/entities/me').then(function (me) {
      return panel.o.call('GET', NETWORK + '/entities/lookup?bridgeId=' + encodeURIComponent((me && (me.bridge_id || me.bridgeId)) || ''));
    }).then(function (card) {
      var node = card && (card.entity || card);
      panel.node = (node && node.id) || null;
      return panel.node;
    });
  }
  /** the firms that asked to read this business's books and wait for its yes: agency edges, this business the child, the firm the asker */
  function firmsAsking(ctx) {
    var panel = ctx.panel;
    panel.firms = [];
    if (panel.view !== 'given') return Promise.resolve();
    return ownNode(ctx).then(function (node) {
      if (!node) return;
      return panel.o.call('GET', NETWORK + '/entities/' + node + '/connections').then(function (edges) {
        panel.firms = (Array.isArray(edges) ? edges : []).filter(function (e) {
          return e.type === 'agency' && e.state === 'requested' && String(e.child_id) === String(node) && String(e.requested_by) === String(e.parent_id);
        });
      });
    }).then(function () {}, function () { panel.firms = []; }); /* a list that cannot be read hides the block; the grants list stays */
  }
  /** the block above the list: each firm waiting, with Accept and Decline (owner only; the server refuses any other seat) */
  function firmsHtml(ctx) {
    var panel = ctx.panel, escapeHtml = ctx.escapeHtml, words = ctx.words;
    if (!panel.firms.length) return '';
    return '<div class="nw-why" id="bg_firms" role="group" data-testid="bg-firms"><strong>' + escapeHtml(words('Firms asking to read your books')) + '</strong>' + panel.firms.map(function (f, i) {
      return '<div class="nw-acts" data-testid="bg-firm-' + i + '"><span>' + escapeHtml(f.parent_name || words('A firm')) + '</span> ' +
        '<button data-cbsid="NET004-B14" type="button" class="act" id="bg_firm_accept_' + i + '" data-firm="' + escapeHtml(f.id) + '" data-say="approve" data-testid="bg-firm-accept-' + i + '">' + escapeHtml(words('Accept')) + '</button>' +
        '<button data-cbsid="NET004-B15" type="button" class="act quiet" id="bg_firm_decline_' + i + '" data-firm="' + escapeHtml(f.id) + '" data-say="decline" data-testid="bg-firm-decline-' + i + '">' + escapeHtml(words('Decline')) + '</button></div>';
    }).join('') + '</div>';
  }
  /** Accept or Decline one firm's request: the network's own routes; after Accept the screen reloads and Give access offers the firm */
  function answerFirm(ctx, button) {
    var panel = ctx.panel, words = ctx.words;
    var verb = button.getAttribute('data-say');
    root.CBAction.run(
      button,
      function () { return panel.o.call('POST', NETWORK + '/connections/' + button.getAttribute('data-firm') + '/' + verb); },
      {
        key: 'bg-firm-' + verb,
        failed: words(verb === 'approve' ? "Couldn't accept this firm" : "Couldn't decline this firm"),
        out: 'bg_out',
        outcome: function () {
          ctx.reload().then(function () {
            panel.notice = [words(verb === 'approve' ? 'The firm is connected. Now choose what it may see: Give access.' : 'The request was declined.')];
            ctx.paint();
          });
        }
      }
    );
  }
  /** Invite a firm by its User ID: the same request the firm could raise itself; it reads nothing until it accepts and you then give access */
  function openInvite(ctx) {
    var panel = ctx.panel, escapeHtml = ctx.escapeHtml, words = ctx.words, $ = ctx.$;
    panel.o.sheet(
      '<h2>' + escapeHtml(words('Invite a firm')) + '</h2><div class="nw-form"><label class="sub" for="bg_firm_id">' + escapeHtml(words("The firm's User ID")) + '</label>' +
      '<input data-cbsid="NET004-I07" id="bg_firm_id" class="inp" type="text" autocomplete="off" data-testid="bg-firm-id">' +
      '<div class="sub">' + escapeHtml(words('The firm is asked to connect. It can read nothing until it accepts and you then give it access.')) + '</div>' +
      '<div class="nw-out" id="bg_out" data-testid="bg-out" role="status"></div>' +
      '<div class="nw-acts"><button data-cbsid="NET004-B16" type="button" class="act" id="bg_invite_go" data-testid="bg-invite-go">' + escapeHtml(words('Send invitation')) + '</button>' +
      '<button data-cbsid="NET004-B17" type="button" class="act quiet" id="bg_invite_cancel" data-testid="bg-invite-cancel">' + escapeHtml(words('Cancel')) + '</button></div></div>'
    );
    $('bg_invite_cancel').onclick = panel.o.closeSheet;
    /** Send invitation: ask the firm (by User ID) to connect as the one who may read these books once given access */
    $('bg_invite_go').onclick = function () {
      var handle = ($('bg_firm_id').value || '').trim();
      if (!handle) { $('bg_out').textContent = words("Type the firm's User ID."); return; }
      ownNode(ctx).then(function (node) {
        root.CBAction.run(
          $('bg_invite_go'),
          function () { return panel.o.call('POST', NETWORK + '/connections', { parentHandle: handle, childId: node, type: 'agency' }); },
          { key: 'bg-invite', failed: words("Couldn't send the invitation"), out: 'bg_out',
            outcome: function () { panel.o.closeSheet(); ctx.reload().then(function () { panel.notice = [words('Invitation sent. When the firm accepts, choose what it may see: Give access.')]; ctx.paint(); }); } }
        );
      });
    };
  }
  root.CBBooksGrantFirms = { asking: firmsAsking, html: firmsHtml, answer: answerFirm, invite: openInvite };
})(typeof window !== 'undefined' ? window : globalThis);
