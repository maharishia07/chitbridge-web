/**
 * cap-employees.js — P1: EMPLOYEES AS A SMALL APP (people only). Athi, 2026-10-10: *"hide the hard part and make it very easy."*
 *
 * ONE list (CBList) — one line per person: name · user ID · what they can do · on/off · last at a counter — and ONE sheet per person with the
 * actions. Which actions are open is the SERVER's answer (GET /api/people → may/why, per this login): a refused action is drawn greyed WITH its
 * sentence; the server still refuses on its own (routes/actors.js). This file decides nothing about who may do what.
 *
 * REUSE (named in the PR): CBList (list-ctl.js) · CBAction (accounts-shell.js, M64: one press one write · ask before an irreversible one · say the
 * outcome) · the existing routes of routes/actors.js (POST / · PATCH /:id · DELETE /:id/pin · PUT /:id/status · PUT /:id/delegate · POST /suggest-key)
 * · the level presets from lib/access.js (they arrive in the answer, none is listed here) · tx/esc/toast from the shell files.
 *
 * EMBED (?embed=1&view=add|onduty): the same screens with no frame, for a host page to open in a dialog (app/embed-host.js). The page tells its
 * host what happened: window.parent.postMessage({ cb: 'employees', event: 'added' | 'changed' | 'close', person? }, location.origin).
 *
 *   CBEmployees.mount(el, { token, base, embed, view, onEnded }) → { reload }
 */
(function (root) {
  'use strict';
  var E = { people: [], may: { add: { ok: false, why: null } }, choices: [], counts: { on: 0, off: 0 }, el: null, o: {}, list: null, loaded: false };
  var HAT_OF = { editor: 'act', commenter: 'audit', viewer: 'view_only' };   /* sent beside access_level until b173 is run, as the workshop does */
  var STATE_WORD = { on: 'On', away: 'Away', off: 'Off' };

  function T(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return root.document.getElementById(id); }

  /** the one call: a server refusal keeps its own words and its status, so CBAction.words can say it */
  function call(method, path, body) {
    return root.fetch((E.o.base || '') + path, { method: method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + E.o.token }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && E.o.onEnded) E.o.onEnded();
          if (!r.ok) { var e = new Error(j.message || j.error || 'API ' + r.status); e.status = r.status; throw e; }
          return j;
        });
      });
  }

  /** what a host page hears (embed only) */
  function tell(event, person) {
    if (!E.o.embed || !root.parent || root.parent === root) return;
    try { root.parent.postMessage({ cb: 'employees', event: event, person: person || null }, root.location.origin); } catch (_) {}
  }

  function say(msg) { if (typeof root.toast === 'function') root.toast(msg); }
  function ask(c, fn, btn, o) { return root.CBAction.run(btn, fn, Object.assign({ confirm: c }, o || {})); }

  /* ── words ── */
  /** the short id people type: the stored grammar (asha01@mayur-restaurant.br) is added behind the scenes (2026-10-08) and never shown */
  function shortId(u) { return String(u == null ? '' : u).replace(/@[^@]*$/, ''); }
  function sinceWord(iso) {
    if (!iso) return T('Not yet');
    var d = Date.parse(iso); if (!d) return T('Not yet');
    var days = Math.floor((Date.now() - d) / 86400000);
    if (days <= 0) return T('Today');
    if (days === 1) return T('Yesterday');
    if (days < 30) return days + ' ' + T('days ago');
    try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return iso.slice(0, 10); }
  }
  function stateTag(p) {
    var cls = p.state === 'on' ? 'green' : p.state === 'away' ? 'amber' : '';
    return '<span class="tag ' + cls + '" data-testid="emp-state-' + esc(p.id) + '"><span aria-hidden="true">' + (p.state === 'off' ? '○' : '●') + '</span> ' + esc(T(STATE_WORD[p.state] || 'On')) + '</span>';
  }
  function byId(id) { return E.people.filter(function (p) { return p.id === id; })[0] || null; }

  /* ── the read ── */
  function load() {
    return call('GET', '/api/people').then(function (j) {
      E.people = j.people || []; E.may = j.may || E.may; E.choices = j.access_choices || []; E.counts = j.counts || E.counts; E.loaded = true;
      return j;
    });
  }
  function reload() {
    return load().then(function () { if (E.list) E.list.refresh(); paintBar(); }, function () { paintFail(); });
  }
  function paintFail() {
    if (!E.el) return;
    E.el.innerHTML = '<div class="empty" data-testid="emp-fail"><div class="t">' + esc(T("Couldn't read your people")) + '</div>'
      + '<button type="button" class="act" id="emp_retry" data-testid="emp-retry">' + esc(T('Try again')) + '</button></div>';
    $('emp_retry').onclick = function () { start(); };
  }

  /* ── an action drawn the one way: shown always; greyed with the server's sentence when it may not ── */
  function actRow(id, icon, label, may, extra) {
    var ok = !may || may.ok !== false;
    return '<div class="emp-act' + (ok ? '' : ' no') + '">'
      + '<button type="button" class="act quiet" id="' + id + '" data-testid="' + id + '"' + (ok ? '' : ' aria-disabled="true" disabled') + ' title="' + esc(ok ? label : (may.why || label)) + '">'
      + '<span aria-hidden="true">' + icon + '</span> ' + esc(label) + '</button>'
      + (ok ? (extra || '') : '<span class="why" data-testid="' + id + '-why">' + esc(may.why || '') + '</span>') + '</div>';
  }

  /* ── the list ── */
  function cols() {
    return [
      { key: 'name', label: T('Name'), prio: 1, w: 230, sort: 'name', html: true, value: function (p) { return p.name; },
        cell: function (p) { return '<b>' + esc(p.name) + '</b>' + (p.role ? ' <span class="sub">' + esc(p.role) + '</span>' : ''); } },
      { key: 'user_id', label: T('User ID'), prio: 2, w: 230, mono: true, cell: function (p) { return shortId(p.user_id) || '—'; } },
      { key: 'access', label: T('Can do'), prio: 3, w: 170, sort: 'access', hfilter: 'access', cell: function (p) { return p.access.label; }, value: function (p) { return p.access.label; } },
      { key: 'state', label: T('On or off'), prio: 4, w: 120, sort: 'state', hfilter: 'state', html: true, cell: stateTag, value: function (p) { return STATE_WORD[p.state]; } },
      { key: 'last', label: T('Last at a counter'), prio: 5, w: 170, sort: 'last', cell: function (p) { return sinceWord(p.last_at); }, value: function (p) { return p.last_at || ''; } }
    ];
  }
  function mountList(host) {
    if (E.list) { try { E.list.destroy(); } catch (_) {} }
    root.CBList.reset && root.CBList.reset('employees');
    E.list = root.CBList.mount(host, {
      key: 'employees', t: T, rows: function () { return E.people; }, id: function (p) { return p.id; }, rowTid: function (p) { return 'emp-row-' + p.id; },
      columns: cols(), defaultCols: ['name', 'user_id', 'access', 'state'],   /* On or off shows by default; Last at a counter is in the ⚙ chooser */
      filters: [
        { key: 'state', label: T('On or off'), all: T('All'), options: [{ v: 'on', label: T('On') }, { v: 'off', label: T('Off') }], match: function (p, v) { return v === 'off' ? p.state === 'off' : p.state !== 'off'; } },
        { key: 'access', label: T('Can do'), all: T('Anything'), options: E.choices.map(function (c) { return { v: c.label, label: c.label }; }), match: function (p, v) { return p.access.label === v; } }
      ],
      search: function (p) { return [p.name, p.user_id, p.role, p.access.label, p.phone].join(' '); },
      sorts: [{ key: 'name', label: T('Name'), cmp: function (a, b) { return String(a.name).localeCompare(String(b.name)); } },
              { key: 'last', label: T('Last at a counter'), cmp: function (a, b) { return String(b.last_at || '').localeCompare(String(a.last_at || '')); } }],
      onOpen: function (p) { openPerson(p.id); },
      empty: { title: T('No one added yet') }
    });
  }

  function paintBar() {
    var b = $('emp_bar'); if (!b) return;
    var add = E.may.add || { ok: false };
    b.innerHTML = '<span class="emp-count" data-testid="emp-count"><b>' + (E.counts.on || 0) + '</b> ' + esc(T('on')) + (E.counts.off ? ' · <b>' + E.counts.off + '</b> ' + esc(T('off')) : '') + '</span>'
      + '<span class="emp-add">' + actRow('emp_add', '＋', T('Add a person'), add) + '</span>';
    var btn = $('emp_add'); if (btn && add.ok !== false) btn.onclick = function () { openAdd(); };
  }

  /* ── the person sheet: four actions (Add is the list's) ── */
  function sheet(html) {
    var d = $('emp_sheet');
    d.innerHTML = '<button type="button" class="mx" id="emp_x" aria-label="' + esc(T('Close')) + '" title="' + esc(T('Close')) + '">✕</button>' + html;
    if (!d.open) { try { d.showModal(); } catch (_) { d.setAttribute('open', ''); } }
    $('emp_x').onclick = closeSheet;
  }
  function closeSheet() {
    var d = $('emp_sheet'); try { d.close(); } catch (_) { d.removeAttribute('open'); } d.innerHTML = '';
    if (E.o.embed && E.o.view === 'add') tell('close');
  }
  function openPerson(id) {
    var p = byId(id); if (!p) return;
    var m = p.may;
    var coverNote = p.cover ? '<span class="sub">' + esc(T('Stands in')) + ': ' + esc(p.cover.name) + '</span>' : '';
    sheet('<h2 data-testid="emp-name">' + esc(p.name) + '</h2>'
      + '<div class="emp-sub"><span class="mono" data-testid="emp-userid">' + esc(shortId(p.user_id)) + '</span> ' + stateTag(p) + '</div>'
      + '<div id="emp_out" class="emp-out" role="status" data-testid="emp-out"></div>'
      + '<div class="emp-acts">'
      + actRow('emp_access', '🔑', T('What they can do'), m.access, '<span class="sub">' + esc(p.access.label) + '</span>')
      + actRow('emp_pin', '🔢', T('Reset code'), m.reset_pin)
      + actRow('emp_switch', '⏻', m.switch.to === 'on' ? T('Switch on') : T('Switch off'), m.switch,
          p.jobs && m.switch.to === 'off' ? '<span class="sub">' + esc(p.jobs + ' ' + T('open jobs go to the pool')) + '</span>' : '')
      + actRow('emp_cover', '🤝', T('Who stands in'), m.cover, coverNote)
      + '</div><div id="emp_more"></div>');
    var q = function (k) { return $(k); };
    if (m.access.ok !== false) q('emp_access').onclick = function () { accessPanel(p); };
    if (m.reset_pin.ok !== false) q('emp_pin').onclick = function () { resetPin(p, q('emp_pin')); };
    if (m.switch.ok !== false) q('emp_switch').onclick = function () { switchIt(p, q('emp_switch')); };
    if (m.cover.ok !== false) q('emp_cover').onclick = function () { coverPanel(p); };
  }

  /** after a write: re-read the one list, repaint the sheet on the fresh row, tell the host */
  function changed(id, event) {
    return load().then(function () {
      if (E.list) E.list.refresh(); paintBar();
      var p = byId(id); if (p) { var out = $('emp_out'), keep = out ? out.textContent : ''; openPerson(id); if (keep && $('emp_out')) $('emp_out').textContent = keep; }
      tell(event || 'changed', p ? { id: p.id, name: p.name, user_id: p.user_id } : null);
    });
  }

  function codeSentence(r) {
    if (r && r.otp) return T('Their first code is') + ' ' + r.otp + ' — ' + T('good for 24 hours.');
    if (r && r.sent_to) return T('A new code went to') + ' ' + r.sent_to + '.';
    return (r && r.delivery_note) || T('A new code is ready.');
  }

  function resetPin(p, btn) {
    ask({ title: T('Reset code?'), body: esc(p.name) + ' ' + esc(T('will sign in with a new code.')), yes: T('Reset'), danger: false },
      function () { return call('DELETE', '/api/actors/' + encodeURIComponent(p.id) + '/pin'); }, btn,
      { key: 'emp-pin-' + p.id, failed: T("Couldn't reset the code"), out: 'emp_out', outcome: function (r) { $('emp_out').textContent = codeSentence(r); changed(p.id); } });
  }

  function switchIt(p, btn) {
    var turningOn = p.may.switch.to === 'on';
    var run = function () {
      return call('PUT', '/api/actors/' + encodeURIComponent(p.id) + '/status',
        turningOn ? { action: 'reactivate' } : { action: 'deactivate', task_action: p.jobs ? 'pool' : undefined });
    };
    var opts = { key: 'emp-switch-' + p.id, failed: turningOn ? T("Couldn't switch on") : T("Couldn't switch off"), out: 'emp_out',
      outcome: function (r) { $('emp_out').textContent = turningOn ? codeSentence(r) : T('Switched off.'); changed(p.id); } };
    if (turningOn) return root.CBAction.run(btn, run, opts);
    return ask({ title: T('Switch off?'), body: esc(p.name) + ' ' + esc(T('can no longer sign in.')) + (p.jobs ? ' ' + esc(p.jobs + ' ' + T('open jobs go to the pool.')) : ''), yes: T('Switch off'), danger: true }, run, btn, opts);
  }

  function accessPanel(p) {
    var cur = p.access;
    var cs = E.choices.map(function (c, i) {
      var on = c.level === cur.level && c.whole_entity === cur.whole_entity && c.can_see_costs === cur.can_see_costs;
      return '<label class="emp-opt"><input type="radio" name="emp_lvl" value="' + i + '"' + (on ? ' checked' : '') + ' data-testid="emp-level-' + esc(c.key) + '"> <b>' + esc(c.label) + '</b><span class="sub">' + esc(c.why) + '</span></label>';
    }).join('');
    $('emp_more').innerHTML = '<div class="emp-panel">' + cs + '<button type="button" class="act" id="emp_access_go" data-testid="emp-access-go">' + esc(T('Save')) + '</button></div>';
    $('emp_access_go').onclick = function () {
      var sel = root.document.querySelector('input[name="emp_lvl"]:checked'); if (!sel) return;
      var c = E.choices[+sel.value];
      root.CBAction.run($('emp_access_go'), function () {
        return call('PATCH', '/api/actors/' + encodeURIComponent(p.id), { access_level: c.level, hat: HAT_OF[c.level] || 'act', whole_entity: c.whole_entity, can_see_costs: c.can_see_costs });
      }, { key: 'emp-access-' + p.id, failed: T("Couldn't save"), out: 'emp_out', outcome: function () { $('emp_out').textContent = T('Saved.'); changed(p.id); } });
    };
  }

  function coverPanel(p) {
    var opts = '<option value="">' + esc(T('No one')) + '</option>' + p.cover_options.map(function (o) {
      return '<option value="' + esc(o.id) + '"' + (p.cover && p.cover.id === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>';
    }).join('');
    $('emp_more').innerHTML = '<div class="emp-panel"><label class="sub" for="emp_cover_sel">' + esc(T('Who covers when they are away?')) + '</label>'
      + '<select id="emp_cover_sel" class="inp" data-testid="emp-cover-sel">' + opts + '</select>'
      + '<button type="button" class="act" id="emp_cover_go" data-testid="emp-cover-go">' + esc(T('Save')) + '</button></div>';
    $('emp_cover_go').onclick = function () {
      var v = $('emp_cover_sel').value || null;
      root.CBAction.run($('emp_cover_go'), function () { return call('PUT', '/api/actors/' + encodeURIComponent(p.id) + '/delegate', { delegate_actor_id: v }); },
        { key: 'emp-cover-' + p.id, failed: T("Couldn't save"), out: 'emp_out', outcome: function () { $('emp_out').textContent = T('Saved.'); changed(p.id); } });
    };
  }

  /* ── add a person ── */
  function openAdd() {
    var cs = E.choices.map(function (c, i) { return '<option value="' + i + '"' + (c.key === 'counter' ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('');
    sheet('<h2>' + esc(T('Add a person')) + '</h2><div id="emp_out" class="emp-out" role="status" data-testid="emp-out"></div>'
      + '<div class="emp-form">'
      + '<label for="emp_n">' + esc(T('Name')) + '</label><input class="inp" id="emp_n" data-testid="emp-add-name" autocomplete="off">'
      + '<label for="emp_k">' + esc(T('Sign-in name')) + '</label><input class="inp mono" id="emp_k" data-testid="emp-add-key" autocomplete="off" maxlength="12">'
      + '<div class="sub" id="emp_kn" data-testid="emp-add-keynote"></div>'
      + '<label for="emp_l">' + esc(T('What they can do')) + '</label><select class="inp" id="emp_l" data-testid="emp-add-level">' + cs + '</select>'
      + '<label for="emp_r">' + esc(T('Job')) + '</label><input class="inp" id="emp_r" data-testid="emp-add-role" autocomplete="off">'
      + '<label for="emp_p">' + esc(T('Phone')) + '</label><input class="inp" id="emp_p" data-testid="emp-add-phone" inputmode="tel" autocomplete="off">'
      + '<label for="emp_e">' + esc(T('E-mail')) + '</label><input class="inp" id="emp_e" data-testid="emp-add-email" type="email" autocomplete="off">'
      + '<button type="button" class="act" id="emp_add_go" data-testid="emp-add-go">' + esc(T('Add')) + '</button></div>');
    var typedKey = false, tm = null;
    $('emp_k').oninput = function () { typedKey = true; };
    $('emp_n').oninput = function () {
      clearTimeout(tm);
      var name = $('emp_n').value.trim();
      if (typedKey || name.length < 2) return;
      tm = setTimeout(function () {
        call('POST', '/api/actors/suggest-key', { display_name: name }).then(function (j) {
          if (typedKey) return; $('emp_k').value = j.suggested_key || ''; $('emp_kn').textContent = j.login_format ? T('They sign in as') + ' ' + j.login_format : '';
        }, function () {});
      }, 300);
    };
    $('emp_add_go').onclick = function () {
      var name = $('emp_n').value.trim(), key = $('emp_k').value.trim().toLowerCase(), c = E.choices[+$('emp_l').value] || {};
      if (name.length < 2) { $('emp_out').textContent = T('Type their name.'); return; }
      if (!/^[a-z0-9]{4,12}$/.test(key)) { $('emp_out').textContent = T('Sign-in name: 4 to 12 letters or numbers.'); return; }
      var body = { display_name: name, actor_key: key, actor_role: $('emp_r').value.trim() || undefined, phone: $('emp_p').value.trim() || undefined,
        email: $('emp_e').value.trim() || undefined, access_level: c.level, hat: HAT_OF[c.level] || 'act', whole_entity: !!c.whole_entity };
      root.CBAction.run($('emp_add_go'), function () {
        return call('POST', '/api/actors', body).then(function (r) {
          var id = r && r.actor && r.actor.identity_id;
          /* the create takes the level and reach; money-sight is the owner's PATCH (b145), so a preset that carries it is one more call */
          var more = id && c.can_see_costs ? call('PATCH', '/api/actors/' + encodeURIComponent(id), { can_see_costs: true }).catch(function () {}) : Promise.resolve();
          return more.then(function () { return r; });
        });
      }, { key: 'emp-add', failed: T("Couldn't add them"), out: 'emp_out', outcome: function (r) { added(r); } });
    };
  }
  function added(r) {
    var id = r && r.actor && r.actor.identity_id;
    return load().then(function () {
      if (E.list) E.list.refresh(); paintBar();
      var p = id ? byId(id) : null;
      sheet('<h2 data-testid="emp-added">' + esc(T('Added')) + '</h2>'
        + '<div class="emp-sub"><b>' + esc((p && p.name) || (r.actor && r.actor.display_name) || '') + '</b></div>'
        + '<div class="mono" data-testid="emp-added-id">' + esc(shortId((p && p.user_id) || (r.actor && r.actor.login_format))) + '</div>'
        + '<div class="emp-out" data-testid="emp-added-code">' + esc(codeSentence(r)) + '</div>'
        + '<button type="button" class="act" id="emp_done" data-testid="emp-done">' + esc(T('Done')) + '</button>');
      $('emp_done').onclick = function () { var d = $('emp_sheet'); try { d.close(); } catch (_) {} d.innerHTML = ''; if (E.o.view === 'add') tell('close'); };
      tell('added', { id: id, name: (p && p.name) || (r.actor && r.actor.display_name) || '', user_id: (p && p.user_id) || null });
    });
  }

  /* ── on duty: a short read-only list for an embed (who is on) ── */
  function onDuty(host) {
    var on = E.people.filter(function (p) { return p.state === 'on'; });
    host.innerHTML = '<div class="emp-duty" data-testid="emp-duty">' + (on.length ? on.map(function (p) {
      return '<div class="emp-duty-row" data-testid="emp-duty-' + esc(p.id) + '"><b>' + esc(p.name) + '</b> <span class="sub">' + esc(p.access.label) + ' · ' + esc(sinceWord(p.last_at)) + '</span></div>';
    }).join('') : '<div class="empty"><div class="t">' + esc(T('No one is on')) + '</div></div>') + '</div>';
  }

  function start() {
    E.el.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(T('Loading')) + '</div>';
    return load().then(function () {
      if (E.o.embed && E.o.view === 'onduty') return onDuty(E.el);
      if (E.o.embed && E.o.view === 'add') {
        if (E.may.add && E.may.add.ok === false) { E.el.innerHTML = '<div class="empty" data-testid="emp-refused"><div class="t">' + esc(E.may.add.why || '') + '</div></div>'; return; }
        E.el.innerHTML = '<dialog class="sheet" id="emp_sheet" data-testid="emp-sheet"></dialog>';
        return openAdd();
      }
      E.el.innerHTML = '<div class="emp-top" id="emp_bar" data-testid="emp-bar"></div><div class="emp-list" id="emp_list" data-testid="emp-list"></div><dialog class="sheet" id="emp_sheet" data-testid="emp-sheet"></dialog>';
      var d = $('emp_sheet');
      d.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });
      d.addEventListener('click', function (e) { if (e.target === d) closeSheet(); });
      paintBar(); mountList($('emp_list'));
    }, function () { paintFail(); });
  }

  function mount(el, o) { E.el = el; E.o = o || {}; start(); return { reload: reload }; }
  root.CBEmployees = { mount: mount, sinceWord: sinceWord };
})(typeof window !== 'undefined' ? window : globalThis);
