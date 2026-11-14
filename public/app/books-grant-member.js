/**
 * books-grant-member.js — ACC-176, THE MEMBER'S SIDE: "Who can see my books".
 *
 * OWNS      the member's screen of the books grant: the access it gave (CBList), Give access (purpose, end date, the plain-words consent, a confirm that names the reach), Change the end date, End access, and who looked (CBList)
 * CALLED BY network-app.js (the "My books" section of the Network page)
 * FLOW      mount(host, o) → GET /api/books-grants → paint → Give access → GET /api/books-grants/consent → confirm (CBAction) → POST /api/books-grants → reload; End access → confirm → POST …/revoke; Who looked → GET …/log
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * The grant is a deliberate act: nothing is sent until the owner has read the consent, ticked yes and answered the confirm that says WHO, UNTIL WHEN and READ ONLY.
 * The server decides who may (the owner of the books only) and why not; a refusal is shown in its own words. Nothing is worked out here.
 *   CBBooksGrantMember.mount(host, { call, parents, sheet, closeSheet, mountList }) → Promise<{ reload }>
 *   call(method, path, body, headers) is the page's (token, base) · parents() → [{ id, name }] the network parents this store may open its books to
 *
 * REUSE (named in the PR): CBList (via mountList) · CBAction.run (confirm, busy, outcome) · the page's sheet · CBBooksGrantApi (the endpoints)
 */
(function (root) {
  'use strict';
  var panel = { host: null, o: {}, given: [], looks: [], view: 'given', why: null };
  var LOOKED = {
    allowed: 'Looked',
    no_grant: 'Refused: no access',
    revoked: 'Refused: ended',
    expired: 'Refused: ran out',
    edge_off: 'Refused: not connected',
    not_listed: 'Refused: not open to an auditor',
    read_only: 'Refused: tried to change'
  };
  var WHAT = {
    '/accounts': 'Chart of accounts',
    '/daybook': 'Day book',
    '/ledger/:account': 'A ledger',
    '/trial-balance': 'Trial balance',
    '/pl': 'Profit and loss',
    '/bs': 'Balance sheet',
    '/dues': 'Who owes whom',
    '/cashflow': 'Cash flow',
    '/periods': 'Closed months',
    '/year/:fy/status': 'Year state',
    '/terms': 'Payment terms',
    '/fx-rates': 'Exchange rates',
    '/health': 'Books health',
    '/cheques': 'Cheques',
    '/bank/rail': 'Bank lines',
    '/returns': 'Tax returns'
  };

  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function $(id) {
    return root.document.getElementById(id);
  }
  function api(key, o) {
    return root.CBBooksGrantApi.run(panel.o.call, key, o);
  }
  function nameOf(entity) {
    var found = (panel.o.parents() || []).filter(function (item) {
      return String(item.id) === String(entity);
    })[0];
    return found ? found.name : words('Your network parent');
  }
  /** a day as a person reads it, from the server's moment */
  function dayWords(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function whenWords(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  /** the value a date box takes: the day in the browser's own calendar */
  function dayValue(d) {
    var two = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }
  function inAYear() {
    var d = new Date();
    d.setMonth(d.getMonth() + 12); /* the default the server's consent words promise: 12 months from today */
    return dayValue(d);
  }
  function whatWords(pattern) {
    var route = String(pattern || '').replace(/^[A-Z]+ /, '');
    return words(WHAT[route] || route || '—');
  }
  function isOpen(grant) {
    return grant.state === 'live' || grant.state === 'edge_off';
  }

  /* ── the reads ── */
  /** read the list or the log, whichever view is on; a refusal becomes the sentence shown above the list */
  function readView() {
    var read = panel.view === 'looks' ? api('grantsLog', { query: { limit: 100 } }) : api('grantsList');
    return read.then(
      function (answer) {
        panel.why = null;
        if (panel.view === 'looks') panel.looks = (answer && answer.looks) || [];
        else panel.given = (answer && answer.given) || [];
      },
      function (failure) {
        panel.why = failure.status === 403 || failure.status === 503 ? failure.message : null;
        if (!panel.why) throw failure;
      }
    );
  }

  /* ── the screen ── */
  /** the two view buttons, the one in use marked pressed */
  function segButtons() {
    return [
      ['given', words('Access I gave'), 'NET004-B01'],
      ['looks', words('Who looked'), 'NET004-B02']
    ]
      .map(function (item) {
        return (
          '<button data-cbsid="' + item[2] + '" type="button" id="bg_seg_' + item[0] + '" class="act' + (panel.view === item[0] ? '' : ' quiet') + '" data-view="' + item[0] +
          '" data-testid="bg-seg-' + item[0] + '" aria-pressed="' + (panel.view === item[0]) + '">' + esc(item[1]) + '</button>'
        );
      })
      .join('');
  }
  /** the screen: the two views, Give access, the server's sentence if the list was refused, and the list */
  function paint() {
    panel.host.innerHTML =
      backButton() + '<div class="nw-acts" data-testid="bg-head"><div class="bg-seg" role="group" aria-label="' + esc(words('Who can see my books')) + '">' + segButtons() + '</div>' +
      '<button data-cbsid="NET004-B03" type="button" class="act" id="bg_give" data-testid="bg-give">' + esc(words('Give access')) + '</button></div>' +
      '<div class="sub" data-testid="bg-note">' + esc(words('Read only. You choose who and until when; every look is recorded.')) + '</div>' +
      (panel.why ? '<div class="nw-why" id="bg_why" role="status" data-testid="bg-why">' + esc(panel.why) + '</div>' : '') +
      '<div class="nw-list" id="bg_list" data-testid="bg-list"></div>';
    Array.prototype.forEach.call(panel.host.querySelectorAll('[data-view]'), function (button) {
      button.onclick = function () {
        panel.view = button.getAttribute('data-view');
        reload();
      };
    });
    if ($('bg_back')) $('bg_back').onclick = panel.o.onBack;
    greyGive();
    $('bg_give').onclick = openGive;
    (panel.view === 'looks' ? paintLooks : paintGiven)($('bg_list'));
  }
  /** a way back to My network, when the page gives one */
  function backButton() {
    return panel.o.onBack ? '<div class="nw-acts"><button data-cbsid="NET004-B09" type="button" class="act quiet" id="bg_back" data-testid="bg-back">← ' + esc(words('Back to My network')) + '</button></div>' : '';
  }
  /** Give access is always shown; when the server refused the list (not the owner) it is greyed WITH that sentence */
  function greyGive() {
    if (!panel.why) return;
    var button = $('bg_give');
    button.setAttribute('disabled', '');
    button.setAttribute('aria-disabled', 'true');
    button.title = panel.why;
  }
  /** one list column: how a row paints and sorts */
  function col(key, label, prio, w, text, sortValue) {
    return { key: key, label: label, prio: prio, w: w, cell: text, value: sortValue || text };
  }
  /** the access this business gave, one row each, with Change date and End access */
  function paintGiven(host) {
    panel.o.mountList(host, {
      key: 'books-grants-given',
      rows: function () {
        return panel.given;
      },
      id: function (g) {
        return g.grant_id;
      },
      rowTid: function (g) {
        return 'bg-grant-' + g.grant_id;
      },
      columns: [
        col('who', words('Who'), 1, 200, function (g) { return nameOf(g.grantee_entity); }),
        col('purpose', words('Why'), 2, 260, function (g) { return g.purpose || '—'; }),
        col('until', words('Until'), 2, 130, function (g) { return dayWords(g.expires_at); }, function (g) { return g.expires_at || ''; }),
        col('costs', words('Costs'), 4, 110, function (g) { return g.can_see_costs ? words('Seen') : words('Hidden'); }),
        col('state', words('State'), 1, 170, function (g) { return root.CBBooksGrantApi.stateWords(g.state); })
      ],
      actions: [
        { id: 'change', tid: 'bg-change', label: words('Change date'), when: isOpen, run: openChange },
        { id: 'end', tid: 'bg-end', label: words('End access'), when: isOpen, run: askEnd }
      ],
      search: function (g) {
        return [nameOf(g.grantee_entity), g.purpose].join(' ');
      },
      empty: { title: words('Nobody can see your books'), body: words('Give access to your network parent when an audit needs it.') }
    });
  }
  /** who looked at these books, when and at what, newest first */
  function paintLooks(host) {
    panel.o.mountList(host, {
      key: 'books-grants-looks',
      rows: function () {
        return panel.looks;
      },
      id: function (look) {
        return look.at + '|' + look.route_pattern + '|' + look.outcome;
      },
      rowTid: function (look) {
        return 'bg-look-' + look.outcome;
      },
      columns: [
        col('at', words('When'), 1, 170, function (look) { return whenWords(look.at); }, function (look) { return look.at || ''; }),
        col('who', words('Who'), 3, 200, function (look) { return nameOf(look.grantee_entity); }),
        col('what', words('Looked at'), 1, 220, function (look) { return whatWords(look.route_pattern); }),
        col('out', words('Result'), 1, 220, function (look) { return words(LOOKED[look.outcome] || look.outcome || ''); })
      ],
      search: function (look) {
        return [nameOf(look.grantee_entity), whatWords(look.route_pattern), look.outcome].join(' ');
      },
      empty: { title: words('Nobody has looked yet'), body: words('Each look at your books will be listed here.') }
    });
  }

  /* ── Give access: the consent, then a confirm that names the reach ── */
  /** the Give access form: who, why, until, costs, the consent words and the yes */
  function giveForm(parents) {
    return (
      '<h2>' + esc(words('Let your network parent read your books')) + '</h2><div class="bg-form" data-testid="bg-form">' +
      '<label class="sub" for="bg_who">' + esc(words('Who')) + '</label><select data-cbsid="NET004-S01" id="bg_who" class="inp" data-testid="bg-who">' +
      parents.map(function (item) { return '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>'; }).join('') + '</select>' +
      '<label class="sub" for="bg_purpose">' + esc(words('Why (optional)')) + '</label><input data-cbsid="NET004-I01" id="bg_purpose" class="inp" maxlength="300" data-testid="bg-purpose" autocomplete="off" placeholder="' + esc(words('For example: year-end audit')) + '">' +
      '<label class="sub" for="bg_until">' + esc(words('Until')) + '</label><input data-cbsid="NET004-I02" id="bg_until" class="inp" type="date" value="' + inAYear() + '" data-testid="bg-until">' +
      '<label class="bg-tick"><input data-cbsid="NET004-I03" id="bg_costs" type="checkbox" checked data-testid="bg-costs"> ' + esc(words('They can see my costs and margins')) + '</label>' +
      '<div id="bg_consent" class="bg-consent" role="status" data-testid="bg-consent"><span class="spin"></span></div>' +
      '<label class="bg-tick"><input data-cbsid="NET004-I04" id="bg_yes" type="checkbox" data-testid="bg-yes"> ' + esc(words('I have read this, and I say yes')) + '</label>' +
      '<div class="nw-out" id="bg_out" data-testid="bg-out" role="status"></div>' +
      '<div class="nw-acts"><button data-cbsid="NET004-B04" type="button" class="act" id="bg_go" data-testid="bg-go" disabled aria-disabled="true" title="' + esc(words('Tick yes to go on.')) + '">' + esc(words('Give access')) + '</button>' +
      '<button data-cbsid="NET004-B05" type="button" class="act quiet" id="bg_cancel" data-testid="bg-cancel">' + esc(words('Cancel')) + '</button></div></div>'
    );
  }
  /** open the Give access sheet for the network parents this store may open its books to */
  function openGive() {
    var parents = panel.o.parents() || [];
    if (!parents.length) {
      panel.o.sheet('<h2>' + esc(words('Give access')) + '</h2><p data-testid="bg-noparent">' + esc(words('You have no network parent to give access to.')) + '</p>');
      return;
    }
    panel.o.sheet(giveForm(parents));
    $('bg_cancel').onclick = panel.o.closeSheet;
    $('bg_costs').onchange = readConsent;
    $('bg_yes').onchange = tickYes;
    $('bg_go').onclick = askGive;
    readConsent();
    $('bg_who').focus();
  }
  /** Give access is held until yes is ticked */
  function tickYes() {
    var go = $('bg_go');
    var yes = $('bg_yes').checked;
    go.disabled = !yes;
    go.setAttribute('aria-disabled', String(!yes));
    go.title = yes ? '' : words('Tick yes to go on.');
  }
  /** read the consent words for the costs choice and clear the yes, so it is said again */
  function readConsent() {
    $('bg_yes').checked = false;
    tickYes();
    api('grantsConsent', { query: { can_see_costs: $('bg_costs').checked ? 'true' : 'false' } }).then(
      function (consent) {
        $('bg_consent').innerHTML =
          '<b>' + esc(consent.headline) + '</b><div>' + esc(words('They can read')) + ': ' + esc((consent.can_read || []).join(', ')) + '.</div>' +
          '<div>' + esc(words('They cannot')) + ': ' + esc((consent.cannot || []).join(', ')) + '.</div><div>' + esc(consent.costs) + '</div><div>' + esc(consent.rights) + '</div>';
      },
      function (failure) {
        $('bg_consent').textContent = failure.message || words("Couldn't load the words. Try again.");
      }
    );
  }
  /** what the form sends: the parent, the purpose, the end day, costs, and the yes */
  function giveBody() {
    return {
      grantee: $('bg_who').value,
      purpose: $('bg_purpose').value.trim() || undefined,
      expires_at: $('bg_until').value || undefined,
      can_see_costs: $('bg_costs').checked,
      consent: $('bg_yes').checked
    };
  }
  /** send the grant once the owner confirms who, until when and read only */
  function askGive() {
    var parentBox = $('bg_who');
    var until = $('bg_until').value;
    var body = giveBody();
    root.CBAction.run(
      $('bg_go'),
      function () {
        return api('grantsGive', { body: body });
      },
      {
        key: 'bg-give',
        confirm: {
          title: words('Give read-only access?'),
          body:
            '<b>' + esc(parentBox.options[parentBox.selectedIndex].text) + '</b> ' + esc(words('will be able to read your books until')) + ' <b>' +
            esc(until ? dayWords(until + 'T12:00:00') : words('12 months from today')) + '</b>. ' + esc(words('Read only: they cannot change anything. Every look is recorded.')),
          yes: words('Give access')
        },
        failed: words("Couldn't give access"),
        out: 'bg_out',
        outcome: function () {
          panel.o.closeSheet();
          panel.view = 'given';
          reload();
        }
      }
    );
  }

  /* ── Change the end date · End access ── */
  /** the sheet that changes the end date of one open access */
  function openChange(grant) {
    panel.o.sheet(
      '<h2>' + esc(words('Change the end date')) + '</h2><div class="bg-form" data-testid="bg-change-form"><div class="sub">' + esc(nameOf(grant.grantee_entity)) + '</div>' +
        '<label class="sub" for="bg_until2">' + esc(words('Until')) + '</label><input data-cbsid="NET004-I05" id="bg_until2" class="inp" type="date" value="' + esc(dayValue(new Date(grant.expires_at))) + '" data-testid="bg-until2">' +
        '<div class="nw-out" id="bg_out2" data-testid="bg-out2" role="status"></div>' +
        '<div class="nw-acts"><button data-cbsid="NET004-B06" type="button" class="act" id="bg_save" data-testid="bg-save">' + esc(words('Save')) + '</button>' +
        '<button data-cbsid="NET004-B07" type="button" class="act quiet" id="bg_cancel2" data-testid="bg-cancel2">' + esc(words('Cancel')) + '</button></div></div>'
    );
    $('bg_cancel2').onclick = panel.o.closeSheet;
    /** Save sends the new end day once; the sheet closes and the list is read again */
    $('bg_save').onclick = function () {
      root.CBAction.run(
        $('bg_save'),
        function () {
          return api('grantsChange', { params: { id: grant.grant_id }, body: { expires_at: $('bg_until2').value } });
        },
        {
          key: 'bg-change-' + grant.grant_id,
          failed: words("Couldn't change the date"),
          out: 'bg_out2',
          outcome: function () {
            panel.o.closeSheet();
            reload();
          }
        }
      );
    };
  }
  /** end an access now, after a confirm that names who */
  function askEnd(grant) {
    root.CBAction.run(
      null,
      function () {
        return api('grantsRevoke', { params: { id: grant.grant_id }, body: {} });
      },
      {
        key: 'bg-end-' + grant.grant_id,
        confirm: {
          title: words('End this access now?'),
          body: '<b>' + esc(nameOf(grant.grantee_entity)) + '</b> ' + esc(words('will not be able to open your books again unless you give access again.')),
          yes: words('End access'),
          danger: true
        },
        failed: words("Couldn't end the access"),
        done: words('Access ended.'),
        outcome: reload
      }
    );
  }

  /** the list could not be read: say so and offer Try again */
  function paintFail() {
    panel.host.innerHTML =
      emptyState('⚠️', words("Couldn't read who can see your books")) +
      '<button data-cbsid="NET004-B08" type="button" class="act" id="bg_retry" data-testid="bg-retry">' + esc(words('Try again')) + '</button>';
    $('bg_retry').onclick = reload;
  }
  /** read the current view from the server and paint it */
  function reload() {
    return readView().then(paint, paintFail);
  }
  /** start the screen in the host the page gives */
  function mount(host, o) {
    panel.host = host;
    panel.o = o || {};
    panel.view = 'given';
    return reload().then(function () {
      return { reload: reload };
    });
  }
  root.CBBooksGrantMember = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
