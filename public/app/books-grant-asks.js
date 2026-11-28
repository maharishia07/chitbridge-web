/**
 * books-grant-asks.js — UX-215/216 (firm-connect 1138): THE REQUESTS TO CONNECT A FIRM AND A SHOP, the "Requests" view of "Who can see my books".
 *
 * ID        NET004
 * OWNER     cb-network
 * RISK      personal-data
 * OWNS      the asks card: requests waiting for my answer (Accept · Refuse) and requests I made (Cancel) as one grouped CBList, each with the other business's name, bridge id and country; Ask to connect (find, pick, confirm); Invite by email; every refusal in a plain sentence
 * CALLED BY books-grant-member.js (the Requests view); network-app.js hands the sheet and the list mount
 * FLOW      mount(host, o) → GET /api/network/asks → paint → Ask to connect → GET /api/entities/search → POST /api/network/connections; Accept / Refuse → POST …/approve | …/decline; Cancel → …/decline; Invite → POST /api/network/firm-invites
 * CARD      04-network/connections-and-invitations
 *
 * The server decides who may (the owner only) and the direction (the firm is always the parent): a refusal is greyed with its sentence, never worked out here. Accepting alone gives the firm NO access: the owner gives access himself afterwards.
 *   CBBooksGrantAsks.mount(host, { call, sheet, closeSheet, mountList, onBack?, find? }) → Promise<{ reload }> · .refusal(failure)
 *
 * REUSE (named in the PR): CBList (via mountList) · CBAction.run (confirm, busy, outcome) · the page's sheet · the page's call() · GET /api/entities/search (the one finder)
 */
(function (root) {
  'use strict';
  /* ⭐ the endpoint registry: the same names app.html and accounts-shell.js give these routes (ep-aliases), plus the two new reads */
  var ENDPOINTS = {
    netAsks: { m: 'GET', p: '/api/network/asks' } /* { to_me[], by_me[] }: edge_id · kind · i_am · name · bridge_id · country · asked_at */,
    netConnect: { m: 'POST', p: '/api/network/connections' } /* the shop asks its firm { parentHandle, type } or the firm asks a shop { childBridgeId, type } */,
    netApprove: { m: 'POST', p: '/api/network/connections/:id/approve' },
    netDecline: { m: 'POST', p: '/api/network/connections/:id/decline' } /* Refuse, and Cancel of my own request */,
    netInvite: { m: 'POST', p: '/api/network/firm-invites' } /* { email } → { sent, delivered, message } */,
    entitySearch: { m: 'GET', p: '/api/entities/search' }
  };
  /** every refusal of the ask doors in a plain sentence (what happened · what it means · what to do); a code not listed keeps the server's own words */
  var WORDS = {
    EXISTS: 'You have already asked, or you are already connected. Nothing was sent.',
    FIRM_DIRECTION: 'These two are already connected the other way round: the firm is the one that looks after the books. Nothing was sent.',
    ASK_LIMIT: 'Too many requests are waiting, or too many were sent today. Nothing was sent. Try again tomorrow.',
    ASK_COOLING_OFF: 'That business refused a short while ago. You can ask again in an hour.',
    INVITE_LIMIT: 'Too many invitations today, or that address was invited this week. Nothing was sent.',
    OWNER_ONLY: 'Only the owner sends and answers requests. Ask your owner.',
    CHILD_NOT_FOUND: 'We could not find that business. Check its name or bridge id. Nothing was sent.',
    PARENT_NOT_FOUND: 'We could not find that business. Check its name or bridge id. Nothing was sent.',
    SELF: 'That is your own business. Nothing was sent.'
  };
  var panel = { host: null, o: {}, to_me: [], by_me: [], why: null };

  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function $(id) {
    return root.document.getElementById(id);
  }
  /** one call from the registry: { params, query, body } */
  function callEndpoint(key, o) {
    o = o || {};
    var path = ENDPOINTS[key].p.replace(':id', encodeURIComponent((o.params || {}).id));
    var query = Object.keys(o.query || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o.query[k]); }).join('&');
    return panel.o.call(ENDPOINTS[key].m, path + (query ? '?' + query : ''), o.body).catch(function (failure) {
      throw refusal(failure);
    });
  }
  /** the failure with its message said in words when its code is known */
  function refusal(failure) {
    if (failure && WORDS[failure.code]) failure.message = words(WORDS[failure.code]);
    return failure;
  }
  /** the other business as a line: name · bridge id · country */
  function whoLine(request) {
    return [request.name, request.bridge_id, request.country].filter(Boolean).join(' · ');
  }
  function dayWords(value) {
    return root.shopDay ? root.shopDay(value) : String(value || '').slice(0, 10);
  }
  function col(key, label, prio, w, text, sortValue) {
    return { key: key, label: label, prio: prio, w: w, cell: text, value: sortValue || text, keep: prio === 1 };
  }
  /** the two groups, the one waiting for me first */
  var GROUP = { me: 'Waiting for your answer', them: 'Waiting for their answer' };
  function rows() {
    return panel.to_me.map(function (a) { return Object.assign({ g: 'me' }, a); }).concat(panel.by_me.map(function (a) { return Object.assign({ g: 'them' }, a); }));
  }

  /* ── the reads ── */
  function read() {
    return callEndpoint('netAsks').then(
      function (answer) {
        panel.why = null;
        panel.to_me = (answer && answer.to_me) || [];
        panel.by_me = (answer && answer.by_me) || [];
      },
      function (failure) {
        if (failure.status !== 403) throw failure;
        panel.why = failure.message; /* a staff seat: the owner's screen, greyed with the server's sentence */
        panel.to_me = [];
        panel.by_me = [];
      }
    );
  }
  function paint() {
    panel.host.innerHTML =
      (panel.o.onBack ? '<div class="nw-acts"><button data-cbsid="NET004-B09" type="button" class="act quiet" id="ba_back" data-testid="ba-back">← ' + esc(words('Back to My network')) + '</button></div>' : '') +
      '<div class="nw-acts" data-testid="ba-head"><button data-cbsid="NET004-B15" type="button" class="act" id="ba_ask" data-testid="ba-ask">' + esc(words('Ask to connect')) + '</button>' +
      '<button data-cbsid="NET004-B16" type="button" class="act quiet" id="ba_invite" data-testid="ba-invite">' + esc(words('Invite by email')) + '</button></div>' +
      '<div class="sub" data-testid="ba-note">' + esc(words('Connecting gives nobody access to your books. You give access yourself afterwards.')) + '</div>' +
      (panel.why ? '<div class="nw-why" id="ba_why" role="status" data-testid="ba-why">' + esc(panel.why) + '</div>' : '') +
      '<div class="nw-list" id="ba_list" data-testid="ba-list"></div>';
    if ($('ba_back')) $('ba_back').onclick = panel.o.onBack;
    grey($('ba_ask'));
    grey($('ba_invite'));
    $('ba_ask').onclick = openAsk;
    $('ba_invite').onclick = openInvite;
    paintList($('ba_list'));
  }
  /** a control the server refused this seat is greyed WITH the server's sentence */
  function grey(button) {
    if (!panel.why) return;
    button.setAttribute('disabled', '');
    button.setAttribute('aria-disabled', 'true');
    button.title = panel.why;
  }
  function paintList(host) {
    panel.o.mountList(host, {
      key: 'books-asks',
      rows: rows,
      id: function (a) { return a.edge_id; },
      rowTid: function (a) { return 'ba-ask-' + a.g; },
      group: { default: 'on', tid: 'ba', order: ['me', 'them'], by: function (a) { return [words(GROUP[a.g]), a.g]; } },
      columns: [
        col('name', words('Business'), 1, 230, function (a) { return a.name; }),
        col('bridge', words('Bridge id'), 1, 150, function (a) { return a.bridge_id; }),
        col('country', words('Country'), 2, 110, function (a) { return a.country || '—'; }),
        col('asked', words('Asked'), 2, 130, function (a) { return dayWords(a.asked_at); }, function (a) { return a.asked_at || ''; })
      ],
      actions: [
        { id: 'accept', tid: 'ba-accept', label: words('Accept'), when: forMe, run: askAccept },
        { id: 'refuse', tid: 'ba-refuse', label: words('Refuse'), when: forMe, run: askRefuse },
        { id: 'cancel', tid: 'ba-cancel', label: words('Cancel request'), when: function (a) { return a.g === 'them'; }, run: askCancel }
      ],
      search: whoLine,
      empty: { title: words('No requests to connect'), body: words('Ask your bookkeeper or auditor to connect, then give access.') }
    });
  }
  function forMe(a) {
    return a.g === 'me' && !panel.why;
  }

  /* ── Accept · Refuse · Cancel ── */
  /** one answer to one request: a confirm that names who, then the write, then the list is read again */
  function answer(request, key, text) {
    root.CBAction.run(
      null,
      function () { return callEndpoint(key, { params: { id: request.edge_id }, body: {} }); },
      {
        key: 'ba-' + key + '-' + request.edge_id,
        confirm: { title: words(text.title), body: '<b>' + esc(whoLine(request)) + '</b><br>' + esc(words(text.body)), yes: words(text.yes), danger: !!text.danger },
        failed: words(text.failed),
        done: words(text.done),
        outcome: function () { reload(); }
      }
    );
  }
  function askAccept(request) {
    answer(request, 'netApprove', { title: 'Accept this request?', body: 'You are connected. They cannot see your books until you give them access.', yes: 'Accept', failed: "Couldn't accept", done: 'Connected.' });
  }
  function askRefuse(request) {
    answer(request, 'netDecline', { title: 'Refuse this request?', body: 'Nothing is connected. They can ask again after an hour.', yes: 'Refuse', failed: "Couldn't refuse", done: 'Request refused.', danger: true });
  }
  function askCancel(request) {
    answer(request, 'netDecline', { title: 'Cancel your request?', body: 'They will not be asked any more. You can ask again.', yes: 'Cancel request', failed: "Couldn't cancel", done: 'Request cancelled.', danger: true });
  }

  /* ── Ask to connect: say who asks, find the business, pick it, confirm ── */
  var found = [];
  /** the sheet: I am a shop (ask my firm) or a firm (ask a shop); a name, sign-in name or bridge id; the matches to pick; the confirm */
  function askForm() {
    return (
      '<h2>' + esc(words('Ask to connect')) + '</h2><div class="bg-form" data-testid="ba-form">' +
      '<label class="sub" for="ba_dir">' + esc(words('Who is asking')) + '</label><select data-cbsid="NET004-S03" id="ba_dir" class="inp" data-testid="ba-dir">' +
      '<option value="shop">' + esc(words('I am a shop: ask my bookkeeper or auditor')) + '</option><option value="firm">' + esc(words('I am a firm: ask a shop')) + '</option></select>' +
      '<label class="sub" for="ba_q">' + esc(words('Name, sign-in name or bridge id')) + '</label><div class="nw-acts"><input data-cbsid="NET004-I07" id="ba_q" class="inp" maxlength="80" autocomplete="off" data-testid="ba-q">' +
      '<button data-cbsid="NET004-B17" type="button" class="act quiet" id="ba_find" data-testid="ba-find">' + esc(words('Find')) + '</button></div>' +
      '<div class="bg-consent" id="ba_found" role="group" data-testid="ba-found" hidden></div>' +
      '<div class="nw-out" id="ba_out" data-testid="ba-out" role="status"></div>' +
      '<div class="nw-acts"><button data-cbsid="NET004-B18" type="button" class="act" id="ba_send" data-testid="ba-send" disabled aria-disabled="true" title="' + esc(words('Find and pick a business first.')) + '">' + esc(words('Send request')) + '</button>' +
      '<button data-cbsid="NET004-B19" type="button" class="act quiet" id="ba_cancel" data-testid="ba-cancel">' + esc(words('Cancel')) + '</button></div></div>'
    );
  }
  function openAsk() {
    found = [];
    panel.o.sheet(askForm());
    $('ba_cancel').onclick = panel.o.closeSheet;
    $('ba_find').onclick = findBusiness;
    $('ba_q').onkeydown = function (e) { if (e.key === 'Enter') findBusiness(); };
    $('ba_send').onclick = askSend;
    $('ba_q').focus();
  }
  /** a person has not pressed Find yet, or the matches were drawn: the radio per match, and Send is held until one is picked */
  function paintFound(list) {
    var box = $('ba_found');
    found = list;
    box.hidden = !list.length;
    box.innerHTML = list.map(function (b, i) {
      return '<label class="bg-tick"><input data-cbsid="NET004-I08" type="radio" name="ba_pick" value="' + i + '" data-testid="ba-pick"> ' + esc([b.display_name, b.bridge_id].filter(Boolean).join(' · ')) + '</label>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('input'), function (radio) { radio.onchange = tickPick; });
    tickPick();
  }
  function picked() {
    var radio = panel.host.ownerDocument.querySelector('input[name="ba_pick"]:checked');
    return radio ? found[Number(radio.value)] : null;
  }
  function tickPick() {
    var go = $('ba_send'), on = !!picked();
    go.disabled = !on;
    go.setAttribute('aria-disabled', String(!on));
    go.title = on ? '' : words('Find and pick a business first.');
  }
  function findBusiness() {
    var text = $('ba_q').value.trim();
    $('ba_out').textContent = '';
    if (text.length < 2) { $('ba_out').textContent = words('Type at least two letters.'); return; }
    callEndpoint('entitySearch', { query: { q: text, limit: 8 } }).then(
      function (reply) {
        var list = ((reply && reply.results) || []).filter(function (b) { return !!b.bridge_id; });
        paintFound(list);
        if (!list.length) $('ba_out').textContent = words('Nobody found. Check the name or bridge id.');
      },
      function (failure) { $('ba_out').textContent = failure.message || words("Couldn't search. Try again."); }
    );
  }
  /** the shop asks its firm (the firm is the parent) or the firm asks the shop: the only difference is which end the picked business is */
  function askBody(pick, direction) {
    return direction === 'firm' ? { childBridgeId: pick.bridge_id, type: 'agency' } : { parentHandle: pick.user_id || pick.bridge_id, type: 'agency' };
  }
  function askSend() {
    var pick = picked(), direction = $('ba_dir').value;
    root.CBAction.run(
      $('ba_send'),
      function () { return callEndpoint('netConnect', { body: askBody(pick, direction) }); },
      {
        key: 'ba-ask',
        confirm: {
          title: words('Send this request?'),
          body: '<b>' + esc([pick.display_name, pick.bridge_id].join(' · ')) + '</b><br>' + esc(words(direction === 'firm' ? 'This shop is asked to let you look after its books. It must accept.' : 'This firm is asked to look after your books. It must accept. Nobody can see your books until you give access.')),
          yes: words('Send request')
        },
        failed: words("Couldn't send the request"),
        out: 'ba_out',
        outcome: function () { panel.o.closeSheet(); reload(); }
      }
    );
  }

  /* ── Invite by email: one address; nothing connects ── */
  function openInvite() {
    panel.o.sheet(
      '<h2>' + esc(words('Invite your firm by email')) + '</h2><div class="bg-form" data-testid="ba-invite-form">' +
      '<div class="sub">' + esc(words('We send an invitation to join ChitBridge. Nothing is connected until they sign up and you ask them to connect.')) + '</div>' +
      '<label class="sub" for="ba_email">' + esc(words('Email address')) + '</label><input data-cbsid="NET004-I09" id="ba_email" class="inp" type="email" maxlength="120" autocomplete="off" data-testid="ba-email">' +
      '<div class="nw-out" id="ba_iout" data-testid="ba-iout" role="status"></div>' +
      '<div class="nw-acts"><button data-cbsid="NET004-B20" type="button" class="act" id="ba_isend" data-testid="ba-isend">' + esc(words('Send invitation')) + '</button>' +
      '<button data-cbsid="NET004-B21" type="button" class="act quiet" id="ba_icancel" data-testid="ba-icancel">' + esc(words('Cancel')) + '</button></div></div>'
    );
    $('ba_icancel').onclick = panel.o.closeSheet;
    $('ba_isend').onclick = sendInvite;
    $('ba_email').focus();
  }
  /** the server says whether it was sent: when it was NOT, the screen says so in those words and keeps the sheet open */
  function inviteSaid(reply) {
    var text = (reply && reply.message) || '';
    return reply && reply.sent === false ? words('Not sent.') + ' ' + text : text || words('Invitation sent.');
  }
  function sendInvite() {
    var email = $('ba_email').value.trim();
    if (!email) { $('ba_iout').textContent = words('Type an email address.'); return; }
    root.CBAction.run(
      $('ba_isend'),
      function () { return callEndpoint('netInvite', { body: { email: email } }); },
      {
        key: 'ba-invite',
        failed: words("Couldn't send the invitation"),
        out: 'ba_iout',
        outcome: function (reply) {
          $('ba_iout').textContent = inviteSaid(reply);
          $('ba_iout').setAttribute('data-tone', reply && reply.sent === false ? 'error' : 'ok');
        }
      }
    );
  }

  function reload() {
    return read().then(paint, function () {
      panel.host.innerHTML = '<div class="nw-why" role="status" data-testid="ba-fail">' + esc(words("Couldn't read your requests. Try again.")) + '</div><button data-cbsid="NET004-B22" type="button" class="act" id="ba_retry" data-testid="ba-retry">' + esc(words('Try again')) + '</button>';
      $('ba_retry').onclick = reload;
    });
  }
  /** start the view in the host the page gives */
  function mount(host, o) {
    panel.host = host;
    panel.o = o || {};
    return reload().then(function () {
      return { reload: reload };
    });
  }
  root.CBBooksGrantAsks = { mount: mount, refusal: refusal, openAsk: openAsk };
})(typeof window !== 'undefined' ? window : globalThis);
