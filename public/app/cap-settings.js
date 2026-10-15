/* app/cap-settings.js — CB SETTINGS › Counters & keys · Connectors · Policy · Plan & usage (T3-SETTINGS, 2026-10-14; SET2 of INDEX-NOT-APP.md).
 *
 * Owner, 14 Oct: "follow the same design standards or better … better UI … much simpler". The workshop holds these as eight Integrations tabs
 * and two Profile/Settings cards (cap-admin.js), each drawing its own rows and repainting through loadSettings(). Here every list is CBList
 * (list-ctl.js), a row opens to its next level the way CBList opens every row, every write goes through CBAction (M64), and every action is
 * SHOWN, greyed with the SERVER's sentence when it may not run (GET /api/counters may.manage · GET /entities/policy may[flag] ·
 * GET /integrations/catalogue connector.may). This file decides nothing about who may do what.
 *
 * ── WHAT IS MOVED HERE (CLAUDE.md rule 1 — moved, never copied; cap-admin.js calls these same names, loaded first through CAP_WITH.admin) ──
 *   polDefsOf                      — the flags' rows from the server's schema[key].ui + bound_schema (T2-POLICY: no flag list on the web; was cap-admin.js polDefs)
 *   polShown · polStored           — a flag's value in the unit a person reads (0.50 %) and the unit it is stored in (50 bp) (was inline in setPolFlag/_polControl)
 *   _keySeenAt · _keyAgo · _agentName — when a key last spoke, in words, and which machine (was cap-admin.js)
 *   KEY_SCOPES · keyScopesOf       — what a minted key may do, and the connector rule (was inline in integrationsSettingsHTML/intKeyMint)
 *   ctrOpenTill                    — open the till on this PC with a counter's key (was inline in ctrOpenHere)
 *   kitDownload                    — the connector kit, fetched with the session so the key rides inside (was intDownloadKit's body)
 * ── WHAT IS NEW, AND WHY ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   CBSettings.mount(host, section) — paints one of the four sections in CB Settings' pane; nothing existing painted them outside the workshop's
 *                                     #setbody (which needs renderApp · setSec · loadSettings).
 * Host globals (as every cap-*.js): api · EP (CB_SETTINGS_EP) · SESSION · CFG · esc · fmtMoney (helpers.js, the money unit) · tx · toast · CBAction · CBConfirm · CBList · CBLocale (optional).
 * Flow step: Onboarding · counters & keys / connectors / policy / plan (docs/process/flows.json, the SET rows).
 */
'use strict';

/* ---- POLICY FLAGS — per-entity governance toggles, SERVER-PERSISTED (b130).
 *
 * Athi, 2026-08-09: *"make the policy flags real, move it to settings."*
 *
 * The VALUES come from and go to /api/entities/policy, which validates against its own whitelist. The server never trusts this file.
 * ⭐ T2-POLICY (2026-10-14): AND SO DO THE ROWS. A second table of these flags lived on the web (label · help · level · gov · labels ·
 * scale) beside lib/policy.js FLAGS, and the two drifted — self_copy_pref's default was stated three times, two of them wrong. The server
 * now sends each flag's row as `schema[key].ui` (and `bound_schema` for the locked ones); polDefsOf() reads them. Nothing about a flag is
 * defined on the web. INT6c: the workshop's Business rules card (cap-admin.js polDefs) and CB Settings › Policy read through this one reader.
 */
/** the flags' rows from the server's answer: schema[key].ui (+ bound_schema for the locked ones), in the server's order */
function polDefsOf(schema, bound){
  var out=[];
  function add(key,f){ if(!f||!f.ui) return; var u=f.ui;
    out.push({ key:key, label:u.label, type:f.type, options:u.options||f.options, labels:u.labels, def:f.def, level:u.level, gov:u.gov,
               help:u.help, scale:u.scale, suffix:u.suffix, step:u.step, order:u.order }); }
  var s=schema||{}, b=bound||{};
  Object.keys(s).forEach(function(k){ add(k,s[k]); });
  Object.keys(b).forEach(function(k){ add(k,b[k]); });
  return out.sort(function(x,y){ return (x.order||0)-(y.order||0); });
}
/** a flag's value as a person reads it: a scaled number in its human unit (50 bp → 0.5), an enum's label */
function polShown(def, v){
  if (def && def.type === 'number' && def.scale) return Number(v) / def.scale;
  return v;
}
/**
 * ⚠️ A SCALED FIELD IS STORED IN ITS OWN UNIT, NOT THE ONE ON SCREEN. 0.50% is shown, 50 is stored — and the
 * rounding is deliberate: the flag type truncates, so 0.505% would land as 50 either way, and doing it here
 * means the number that comes back matches the number that was typed.
 */
function polStored(def, v){
  if (def && def.type === 'number' && def.scale) return v === '' ? 0 : Math.round(Number(v) * def.scale);
  if (def && def.type === 'number') return v === '' ? 0 : Number(v);
  return v;
}

function _keySeenAt(k){ return (k && k.seen && k.seen.at) ? new Date(k.seen.at).getTime() : 0; }
function _keyAgo(iso){
  if (!iso) return '';
  var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return tx('just now');
  if (s < 5400) return Math.round(s / 60) + ' min ago';
  if (s < 172800) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' days ago';
}
/** ⭐ a user-agent is unreadable; the shop only needs to recognise WHICH MACHINE this was */
function _agentName(ua){
  var u = String(ua || '');
  var os = /Windows/.test(u) ? 'Windows' : /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iPhone/iPad'
         : /Mac OS X/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : '';
  var br = /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox'
         : /Safari\//.test(u) ? 'Safari' : '';
  return [os, br].filter(Boolean).join(' · ') || tx('unknown');
}
/* what a minted key may do — [value, words]; a connector key also evaluates offers (routes/keys.js · middleware/auth.js KEY_ROUTES) */
var KEY_SCOPES = [
  ['services', 'services — offers, pricing, tax, invoice'], ['offers', 'offers only'], ['pricing', 'pricing only'], ['tax', 'tax only'], ['invoice', 'invoice only'],
  ['till', 'till — the counter: bill on this device, offline too'], ['connector', 'connector — products, orders, the bell, and the services'],
  ['testing', 'testing — a build posts test results to the board'],
];
function keyScopesOf(sc){ return sc === 'connector' ? ['connector', 'services'] : [sc || 'offers']; }

/**
 * ⭐ OPEN ON THIS PC — the key is minted FOR this counter and handed to the counter page, which takes the counter's
 * number and carries on its series. The same address shape counterGo() uses, so the counter checks it is the shop
 * it was opened for.
 */
function ctrOpenTill(key){
  try { localStorage.setItem('cb_till_key', key); localStorage.setItem('cb_till_entity', SESSION.entityId || ''); }
  catch (e) { if (typeof cblog === 'function') cblog('error', 'counter key not kept on this PC: ' + ((e && e.message) || e)); }   /* the till still opens: the key rides its address */
  var addr = '/till.html#key=' + encodeURIComponent(key)
           + '&shop=' + encodeURIComponent(SESSION.entityId || '')
           + '&as=' + encodeURIComponent(SESSION.entity || '');
  window.open(addr, '_blank', 'noopener');
}

/** the kit, fetched with the session so the key rides inside; saved through a blob like the tax export (misTaxDownload). Throws on a refusal. */
async function kitDownload(id, adapter){
  var base = (typeof CFG !== 'undefined' && CFG.API_BASE) || '';
  var r = await fetch(base + '/api/integrations/download/' + encodeURIComponent(id) + '?adapter=' + encodeURIComponent(adapter), { headers: { Authorization: 'Bearer ' + SESSION.token } });
  if (!r.ok) { var j = await r.json().catch(function () { return {}; }); var e = new Error(j.message || ('download failed (' + r.status + ')')); e.status = r.status; throw e; }
  var blob = await r.blob();
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chitbridge-connector-' + id + '.zip'; document.body.appendChild(a); a.click(); a.remove();
}

/* ── CB SETTINGS › the four sections — the page's host mounts one at a time ─────────────────────────────────────────────────────────── */
var CBSettings = (function () {
  var H = { host: null, sec: null, lists: [], data: {} };
  function T(s) { return typeof tx === 'function' ? tx(s) : s; }
  function $(id) { return document.getElementById(id); }
  function btnOf(act, id) { return document.querySelector('[data-act="' + act + '"][data-actrow="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); }
  function grey(may) { return may && may.ok === false ? (may.why || T('Not allowed for this sign-in.')) : ''; }
  function when(iso) { if (!iso) return ''; try { return CBLocale.datetime(iso, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(iso).slice(0, 16).replace('T', ' '); } }
  function day(iso) { if (!iso) return ''; try { return CBLocale.date(iso, { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); } }
  /** a read that failed is said in words, never painted as an empty list */
  function failWords(e) { return e && e.status === 403 ? { title: T('This sign-in cannot open this'), sub: CBAction.words(e, '') } : { title: T('Could not read this'), sub: T('Nothing was lost. Try again in a moment.') }; }
  function list(el, o) {
    var l = CBList.mount(el, Object.assign({ t: T, view: 'lines' }, o));
    H.lists.push(l); return l;
  }
  function frame(parts) { H.host.innerHTML = parts.join(''); }
  function lineOut(id) { return '<div class="sx-out" id="' + id + '" role="status" data-testid="' + id.replace(/_/g, '-') + '"></div>'; }
  function bar(inner) { return '<div class="sx-bar">' + inner + '</div>'; }
  function btn(id, label, may, cls) {
    var why = grey(may);
    return '<span class="sx-act"><button type="button" class="act' + (cls ? ' ' + cls : '') + '" id="' + id + '" data-testid="' + id.replace(/_/g, '-') + '"' + (why ? ' disabled aria-disabled="true" title="' + esc(why) + '"' : '') + '>' + esc(label) + '</button>'
      + (why ? '<span class="sx-why" data-testid="' + id.replace(/_/g, '-') + '-why">' + esc(why) + '</span>' : '') + '</span>';
  }
  /** one read per list: loading under the kept header, the answer, or could-not-read with Try again. `name` is the EP name, or a function that makes the
   *  call itself (so a route read nowhere else keeps a literal api('…') the api's endpoint-usage scanner counts — T3-P4-ACCOUNT) */
  function load(key, name, opts, paint) {
    H.data[key] = { state: 'loading', rows: [] }; paint();
    return (typeof name === 'function' ? name() : api(name, opts || {})).then(function (r) { H.data[key] = { state: 'ok', r: r || {} }; paint(); return r; },
      function (e) { if (typeof cblog === 'function') cblog('error', 'settings ' + key + ': ' + ((e && e.message) || e)); H.data[key] = { state: 'error', err: e }; paint(); });
  }
  function listState(key) { var d = H.data[key] || {}; return d.state === 'loading' ? 'loading' : d.state === 'error' ? 'error' : null; }
  function listErr(key) { return failWords((H.data[key] || {}).err); }

  /* ═════ COUNTERS & KEYS ═════ */
  function counters() {
    frame(['<h1 class="sx-h" data-testid="sx-title">' + esc(T('Counters & keys')) + '</h1>',
      '<p class="sub">' + esc(T('Each counter keeps its own bill numbers. One PC holds a counter at a time.')) + '</p>',
      '<div id="sx_ctr_bar"></div>', lineOut('sx_ctr_out'), '<div class="sx-list" id="sx_ctr_list" data-testid="sx-ctr-list"></div>',
      '<h2 class="sx-h2">' + esc(T('Keys for other systems')) + '</h2>', '<div id="sx_key_bar"></div>', lineOut('sx_key_out'), '<div class="sx-list" id="sx_key_list" data-testid="sx-key-list"></div>']);
    var cl = null, kl = null;
    var manage = function () { var d = H.data.ctr; return (d && d.r && d.r.may && d.r.may.manage) || null; };
    var ctrRows = function () { var d = H.data.ctr; return (d && d.r && d.r.counters) || []; };
    function paintCtrBar() {
      var rows = ctrRows(), open = rows.filter(function (c) { return c.state === 'open' || c.state === 'break'; }).length;
      $('sx_ctr_bar').innerHTML = bar('<span class="sx-count" data-testid="sx-ctr-count"><b>' + rows.length + '</b> ' + esc(T(rows.length === 1 ? 'counter' : 'counters')) + ' · <b>' + open + '</b> ' + esc(T('open')) + '</span>'
        + '<span class="sx-add"><label class="sx-lbl" for="sx_ctr_name">' + esc(T('New counter')) + '</label><input class="inp" id="sx_ctr_name" data-testid="sx-ctr-name" placeholder="' + esc(T('Front desk')) + '" maxlength="40"' + (grey(manage()) ? ' disabled' : '') + '>'
        + btn('sx_ctr_add', T('Add a counter'), manage()) + '</span>');
      var b = $('sx_ctr_add'); if (b && !grey(manage())) b.onclick = function () {
        CBAction.run(b, function () { return api('counterAdd', { body: { name: ($('sx_ctr_name').value || '').trim() } }); },
          { key: 'sx-ctr-add', failed: T('Could not add the counter'), out: 'sx_ctr_out', outcome: function (r) { $('sx_ctr_out').textContent = T('Counter added') + (r && r.counter ? ': ' + r.counter.id : '') + '.'; readCtr(); } });
      };
    }
    function where(c) {
      var h = c.held_by || {};
      if (c.state === 'break') return '☕ ' + T('On break') + (h.name ? ' · ' + h.name : '');
      if (c.state === 'open') return T('Open on') + ' ' + (h.name || T('a PC'));
      if (c.state === 'opening') return T('Opening…');
      return c.closed_at ? T('Closed') + ' ' + _keyAgo(c.closed_at) : T('Not opened yet');
    }
    function stateTag(c) {
      var on = c.state === 'open', br = c.state === 'break';
      return '<span class="tag' + (on ? ' green' : br ? ' amber' : '') + '" data-testid="sx-ctr-state-' + esc(c.id) + '"><span aria-hidden="true">' + (on || br ? '●' : '○') + '</span> ' + esc(where(c)) + '</span>';
    }
    function readCtr() { return load('ctr', 'counters', null, function () { paintCtrBar(); if (cl) cl.refresh(); }); }
    cl = list($('sx_ctr_list'), {
      key: 'set-counters', rows: ctrRows, id: function (c) { return c.id; }, rowTid: function (c) { return 'sx-ctr-' + c.id; },
      state: function () { return listState('ctr'); }, error: function () { return listErr('ctr'); }, onRetry: function () { readCtr(); },
      empty: { title: T('No counters yet'), sub: T('Add one above — then open it on the PC that bills.') },
      columns: [
        { key: 'id', label: T('Counter'), prio: 1, w: 210, sort: 'id', html: true, value: function (c) { return c.id + ' ' + c.name; },
          cell: function (c) { return '<b class="mono">' + esc(c.id) + '</b> ' + esc(c.name); } },
        { key: 'state', label: T('Now'), prio: 2, w: 230, html: true, cell: stateTag, value: function (c) { return where(c); } },
        { key: 'last', label: T('Last bill'), prio: 3, w: 150, mono: true, cell: function (c) { return c.last_no || '—'; } },
      ],
      search: function (c) { return [c.id, c.name, where(c)].join(' '); },
      filters: [{ key: 'st', label: T('Open or closed'), all: T('All'), options: [{ v: 'open', label: T('Open') }, { v: 'closed', label: T('Closed') }],
        match: function (c, v) { var o = c.state === 'open' || c.state === 'break' || c.state === 'opening'; return v === 'open' ? o : !o; } }],
      next: function (c) {
        var h = c.held_by || {};
        return '<div class="sx-next" data-testid="sx-ctr-next-' + esc(c.id) + '">'
          + (c.next ? '<div>' + esc(T('Next bill number')) + ': <b class="mono">' + esc(String(c.next).padStart(4, '0')) + '</b></div>' : '')
          + (h.seen && (h.seen.ip || h.seen.at) ? '<div class="sub">' + esc([h.seen.ip, h.seen.at ? _keyAgo(h.seen.at) : ''].filter(Boolean).join(' · ')) + '</div>' : '')
          + (h.diag && h.diag.verdict ? '<div class="sub">🩺 ' + esc(h.diag.verdict) + '</div>' : '')
          + '<label class="sx-lbl" for="sx_ren_' + esc(c.id) + '">' + esc(T('Name')) + '</label><input class="inp" id="sx_ren_' + esc(c.id) + '" data-testid="sx-ctr-rename-' + esc(c.id) + '" maxlength="40" value="' + esc(c.name) + '"' + (grey(manage()) ? ' disabled' : '') + '></div>';
      },
      actions: [
        { id: 'open', label: T('Open on this PC'), tid: 'sx-ctr-open', when: function (c) { return c.state === 'closed'; }, why: function () { return grey(manage()); },
          run: function (c) {
            CBAction.run(btnOf('open', c.id), function () { return api('counterOpen', { params: { id: c.id } }); },
              { key: 'sx-ctr-open-' + c.id, failed: T('Could not open the counter'), out: 'sx_ctr_out',
                outcome: function (r) { if (!r || !r.key) { $('sx_ctr_out').textContent = T('No key came back — try again.'); return; } ctrOpenTill(r.key); $('sx_ctr_out').textContent = T('Opened in a new tab.'); readCtr(); } });
          } },
        { id: 'release', label: T('Release'), tid: 'sx-ctr-release', when: function (c) { return c.state !== 'closed'; }, why: function () { return grey(manage()); },
          run: function (c) {
            CBAction.run(btnOf('release', c.id), function () { return api('counterRelease', { params: { id: c.id } }); },
              { key: 'sx-ctr-release-' + c.id, confirm: { title: T('Release counter') + ' ' + c.id + '?', body: esc(T('Only for a PC that cannot close it. Bills that PC has not sent stay on it.')), yes: T('Release'), danger: true },
                failed: T('Could not release it'), out: 'sx_ctr_out', outcome: function () { $('sx_ctr_out').textContent = T('Counter released.'); readCtr(); } });
          } },
        { id: 'rename', label: T('Save the name'), tid: 'sx-ctr-save', why: function () { return grey(manage()); },
          run: function (c) {
            var v = (($('sx_ren_' + c.id) || {}).value || '').trim();
            CBAction.run(btnOf('rename', c.id), function () { return api('counterRename', { params: { id: c.id }, body: { name: v } }); },
              { key: 'sx-ctr-ren-' + c.id, failed: T('Could not rename it'), out: 'sx_ctr_out', outcome: function () { $('sx_ctr_out').textContent = T('Saved.'); readCtr(); } });
          } },
      ],
    });
    paintCtrBar(); readCtr();

    /* keys: what other systems (and each counter PC) sign in with */
    var keyRows = function () { var d = H.data.keys; return (d && d.r && d.r.keys) || []; };
    function heard(k) { return k.seen && k.seen.at ? _keyAgo(k.seen.at) + (k.seen.ip ? ' · ' + k.seen.ip : '') : T('Never reached ChitBridge'); }
    function paintKeyBar() {
      $('sx_key_bar').innerHTML = bar('<span class="sx-add"><label class="sx-lbl" for="sx_key_name">' + esc(T('New key')) + '</label><input class="inp" id="sx_key_name" data-testid="sx-key-name" placeholder="' + esc(T('Which system')) + '" maxlength="80">'
        + '<label class="sx-lbl" for="sx_key_scope">' + esc(T('It may')) + '</label><select class="inp" id="sx_key_scope" data-testid="sx-key-scope">' + keyKinds().map(function (s) { return '<option value="' + esc(s[0]) + '">' + esc(T(s[1])) + '</option>'; }).join('') + '</select>'
        + btn('sx_key_mint', T('Make a key')) + '</span>');
      $('sx_key_mint').onclick = function () {
        var b = $('sx_key_mint');
        CBAction.run(b, function () { return api('keysMint', { body: { name: ($('sx_key_name').value || '').trim() || 'key', scopes: keyScopesOf($('sx_key_scope').value) } }); },
          { key: 'sx-key-mint', failed: T('Could not make the key'), out: 'sx_key_out', outcome: function (r) {
            $('sx_key_out').innerHTML = '<b>' + esc(T('Copy it now — it is shown once.')) + '</b><div class="mono sx-secret" data-testid="sx-key-value">' + esc(r && r.key || '') + '</div>';
            readKeys(); } });
      };
    }
    /* W15: the kinds offered = the server's `scopes` (the kinds THIS login may mint — 'testing' is the platform's); KEY_SCOPES only words them. Before the answer: the shop's usual kinds. */
    function keyKinds() {
      var d = H.data.keys, served = d && d.r && Array.isArray(d.r.scopes) ? d.r.scopes : null;
      return KEY_SCOPES.filter(function (s) { return served ? served.indexOf(s[0]) >= 0 : s[0] !== 'testing'; });
    }
    function readKeys() { return load('keys', 'keysList', null, function () { paintKeyBar(); if (kl) kl.refresh(); }); }
    kl = list($('sx_key_list'), {
      key: 'set-keys', rows: keyRows, id: function (k) { return k.jti; }, rowTid: function (k) { return 'sx-key-' + k.jti; },
      state: function () { return listState('keys'); }, error: function () { return listErr('keys'); }, onRetry: function () { readKeys(); },
      empty: { title: T('No keys yet'), sub: T('A key lets another system or a counter PC sign in as your shop.') },
      columns: [
        { key: 'name', label: T('Name'), prio: 1, w: 230, sort: 'name', cell: function (k) { return k.name || 'key'; } },
        { key: 'scopes', label: T('It may'), prio: 3, w: 150, cell: function (k) { return (k.scopes || []).join(', '); } },
        { key: 'seen', label: T('Last heard'), prio: 2, w: 190, sort: 'seen', html: true, value: function (k) { return heard(k); },
          cell: function (k) { var quiet = !k.seen || !k.seen.at || (Date.now() - _keySeenAt(k)) > 86400000; return '<span class="tag' + (quiet ? ' amber' : ' green') + '" data-testid="sx-key-seen-' + esc(k.jti) + '">' + esc(heard(k)) + '</span>'; } },
        { key: 'made', label: T('Made'), prio: 4, w: 130, cell: function (k) { return day(k.created_at); } },
      ],
      sorts: [{ key: 'name', label: T('Name'), cmp: function (a, b) { return String(a.name).localeCompare(String(b.name)); } },
              { key: 'seen', label: T('Last heard'), cmp: function (a, b) { return _keySeenAt(b) - _keySeenAt(a); } }],
      search: function (k) { return [k.name, (k.scopes || []).join(' '), k.last4].join(' '); },
      next: function (k) {
        return '<div class="sx-next" data-testid="sx-key-next-' + esc(k.jti) + '"><div class="mono">…' + esc(k.last4 || '') + '</div>'
          + (k.seen && k.seen.agent ? '<div class="sub">' + esc(_agentName(k.seen.agent)) + '</div>' : '')
          + (k.diag && k.diag.verdict ? '<div class="sub">🩺 ' + esc(k.diag.verdict) + '</div>' : '')
          + (!k.seen || !k.seen.at ? '<div class="sub">' + esc(T('Nothing from it has arrived. Look at the network on that PC, not at permissions.')) + '</div>' : '') + '</div>';
      },
      actions: [{ id: 'revoke', label: T('Revoke'), tid: 'sx-key-revoke',
        run: function (k) {
          var till = (k.scopes || []).indexOf('till') >= 0;
          CBAction.run(btnOf('revoke', k.jti), function () { return api('keysRevoke', { params: { jti: k.jti } }); },
            { key: 'sx-key-revoke-' + k.jti, confirm: { title: T('Revoke') + ' ' + (k.name || 'key') + '?', body: esc(T(till ? 'That PC stops billing. Bills it has not sent stay on it.' : 'That system can no longer sign in.')), yes: T('Revoke'), danger: true },
              failed: T('Could not revoke'), out: 'sx_key_out', outcome: function () { $('sx_key_out').textContent = T('Key revoked.'); readKeys(); readCtr(); } });
        } }],
    });
    paintKeyBar(); readKeys();
  }

  /* W16: the catalogue's may.code → the row's words (a sentence the client branches on ships with a code): NOT_FOR_COUNTRY · NOT_YET_FOR_COUNTRY (sold there, our kit is not built for that pack yet) · NOT_YET (no kit at all) */
  var MAY_WORDS = { NOT_FOR_COUNTRY: 'Not for your country', NOT_YET_FOR_COUNTRY: 'Not yet for your country', NOT_YET: 'Not built yet' };
  function mayWords(may) { return T(MAY_WORDS[(may && may.code) || ''] || 'Not for your shop'); }
  /* ═════ CONNECTORS ═════ */
  function connectors() {
    frame(['<h1 class="sx-h" data-testid="sx-title">' + esc(T('Connectors')) + '</h1>',
      '<p class="sub">' + esc(T('A small program beside Tally, Zoho or a folder of files. Download, unzip, start — your key is inside.')) + '</p>',
      lineOut('sx_con_out'), '<div class="sx-list" id="sx_con_list" data-testid="sx-con-list"></div>',
      '<h2 class="sx-h2">' + esc(T('Running on your PCs')) + '</h2>', lineOut('sx_run_out'), '<div class="sx-list" id="sx_run_list" data-testid="sx-run-list"></div>']);
    var pol = null;
    function inUse() { var v = (pol && pol.connectors_in_use) || []; return Array.isArray(v) ? v.filter(function (x) { return x !== 'none'; }) : []; }
    var catRows = function () { var d = H.data.cat; return (d && d.r && d.r.connectors) || []; };
    var cl = null, rl = null;
    function readCat() {
      return Promise.all([load('cat', 'intCatalogue', null, function () { if (cl) cl.refresh(); }),
        api('policyGet').then(function (r) { pol = (r && r.flags) || {}; H.polMay = (r && r.may) || {}; if (cl) cl.refresh(); },
          function (e) { if (typeof cblog === 'function') cblog('error', 'settings connectors in use: ' + ((e && e.message) || e)); $('sx_con_out').textContent = T('Could not read which ones you use.'); })]);
    }
    function useMay() { return (H.polMay && H.polMay.connectors_in_use) || null; }
    function setUse(c, on) {
      var now = inUse().filter(function (x) { return x !== c.id; }); if (on) now.push(c.id);
      CBAction.run(btnOf(on ? 'use' : 'unuse', c.id), function () { return api('policySet', { body: { connectors_in_use: now.length ? now : ['none'] } }); },
        { key: 'sx-con-use-' + c.id, failed: T('Could not save'), out: 'sx_con_out', outcome: function (r) { pol = (r && r.flags) || pol; if (typeof SESSION !== 'undefined') SESSION.policy_flags = pol; $('sx_con_out').textContent = T('Saved.'); cl.refresh(); } });
    }
    cl = list($('sx_con_list'), {
      key: 'set-connectors', rows: catRows, id: function (c) { return c.id; }, rowTid: function (c) { return 'sx-con-' + c.id; },
      state: function () { return listState('cat'); }, error: function () { return listErr('cat'); }, onRetry: function () { readCat(); },
      empty: { title: T('No connectors published yet') },
      columns: [
        { key: 'name', label: T('Connector'), prio: 1, w: 200, sort: 'name', html: true, value: function (c) { return c.name; },
          cell: function (c) { return '<b>' + esc(c.name) + '</b>' + (inUse().indexOf(c.id) >= 0 ? ' <span class="tag green" data-testid="sx-con-inuse-' + esc(c.id) + '">' + esc(T('We use this')) + '</span>' : ''); } },
        { key: 'does', label: T('What it does'), prio: 3, w: 300, cell: function (c) { return c.does || ''; } },
        { key: 'here', label: T('For your shop'), prio: 2, w: 170, html: true, value: function (c) { return c.may && c.may.ok === false ? 'no' : 'yes'; },
          cell: function (c) { var no = c.may && c.may.ok === false; return '<span class="tag' + (no ? '' : ' green') + '" data-testid="sx-con-may-' + esc(c.id) + '" data-code="' + esc((c.may && c.may.code) || '') + '">' + esc(no ? mayWords(c.may) : T('Works here')) + '</span>'; } },
      ],
      search: function (c) { return [c.name, c.does].join(' '); },
      filters: [{ key: 'use', label: T('In use'), all: T('All'), options: [{ v: 'yes', label: T('We use these') }, { v: 'no', label: T('Not used') }],
        match: function (c, v) { var u = inUse().indexOf(c.id) >= 0; return v === 'yes' ? u : !u; } }],
      next: function (c) {
        var grp = function (title, lines) { return lines && lines.length ? '<div class="sx-grp"><b>' + esc(T(title)) + '</b><ul>' + lines.map(function (l) { return '<li>' + esc(T(l)) + '</li>'; }).join('') + '</ul></div>' : ''; };
        var base = (typeof CFG !== 'undefined' && CFG.API_BASE) || '';
        return '<div class="sx-next" data-testid="sx-con-next-' + esc(c.id) + '">'
          + (c.may && c.may.ok === false && c.may.why ? '<div class="sub" data-testid="sx-con-why-' + esc(c.id) + '">' + esc(c.may.why) + '</div>' : '')
          + grp('Before you start', c.needs) + grp('What to do', c.steps) + grp('If it does not work', c.watch_out)
          + (c.runs_on ? '<div class="sub">' + esc(T('Runs on')) + ': ' + esc(c.runs_on) + '</div>' : '')
          + (c.docs ? '<a class="sx-link" href="' + esc(base + c.docs) + '" target="_blank" rel="noopener" data-testid="sx-con-docs-' + esc(c.id) + '">' + esc(T('Instructions')) + '</a>' : '') + '</div>';
      },
      actions: [
        { id: 'kit', label: T('Download the kit'), tid: 'sx-con-kit', why: function (c) { return grey(c.may); },
          run: function (c) {
            var ad = c.default_adapter || (c.adapters || [])[0] || c.id;
            CBAction.run(btnOf('kit', c.id), function () { return kitDownload(c.id, ad); },
              { key: 'sx-con-kit-' + c.id, failed: T('Could not download'), out: 'sx_con_out', outcome: function () { $('sx_con_out').textContent = T('Downloaded — your key is inside. Unzip it and start it.'); readRun(); } });
          } },
        { id: 'use', label: T('We use this'), tid: 'sx-con-use', when: function (c) { return inUse().indexOf(c.id) < 0; }, why: function () { return grey(useMay()); }, run: function (c) { setUse(c, true); } },
        { id: 'unuse', label: T('We do not use this'), tid: 'sx-con-unuse', when: function (c) { return inUse().indexOf(c.id) >= 0; }, why: function () { return grey(useMay()); }, run: function (c) { setUse(c, false); } },
      ],
    });
    readCat();

    var runRows = function () { var d = H.data.run; return (d && d.r && d.r.connectors) || []; };
    function waiting(r) { return !!(r.enrol && r.enrol.approved === false); }
    function lastSeen(r) { return r.last_seen ? _keyAgo(r.last_seen) : T('Not yet'); }
    function readRun() { return load('run', 'intStatus', null, function () { if (rl) rl.refresh(); }); }
    rl = list($('sx_run_list'), {
      key: 'set-running', rows: runRows, id: function (r) { return r.actor_id || r.id; }, rowTid: function (r) { return 'sx-run-' + (r.actor_id || r.id); },
      state: function () { return listState('run'); }, error: function () { return listErr('run'); }, onRetry: function () { readRun(); },
      empty: { title: T('None has checked in yet'), sub: T('A connector reports here each time it runs.') },
      columns: [
        { key: 'name', label: T('Connector'), prio: 1, w: 200, sort: 'name', cell: function (r) { return r.name || r.id; } },
        { key: 'where', label: T('Where'), prio: 3, w: 200, cell: function (r) { return [r.adapter, r.host].filter(Boolean).join(' · '); } },
        { key: 'seen', label: T('Last heard'), prio: 2, w: 150, cell: lastSeen },
        { key: 'ok', label: T('Approval'), prio: 2, w: 170, html: true, value: function (r) { return waiting(r) ? 'waiting' : 'approved'; },
          cell: function (r) { var w = waiting(r); return '<span class="tag' + (w ? ' amber' : ' green') + '" data-testid="sx-run-ok-' + esc(r.actor_id || r.id) + '">' + esc(w ? T('Waiting for you') : T('Approved')) + '</span>'; } },
      ],
      search: function (r) { return [r.name, r.adapter, r.host].join(' '); },
      next: function (r) {
        var e = r.enrol || {}, sc = r.source || {};
        return '<div class="sx-next" data-testid="sx-run-next-' + esc(r.actor_id || r.id) + '">'
          + ([e.host, e.company, e.gstin].filter(Boolean).length ? '<div class="sub">' + esc([e.host, e.company, e.gstin].filter(Boolean).join(' · ')) + '</div>' : '')
          + (sc.ok === true ? '<div>✓ ' + esc(T('The other system answered')) + (sc.at ? ' · ' + esc(when(sc.at)) : '') + '</div>' : '')
          + (sc.ok === false ? '<div>⚠ ' + esc(T('The other system did not answer')) + (sc.why ? ' · ' + esc(sc.why) : '') + '</div>' : '') + '</div>';
      },
      actions: [
        { id: 'approve', label: T('Approve this PC'), tid: 'sx-run-approve', when: waiting,
          run: function (r) {
            CBAction.run(btnOf('approve', r.actor_id || r.id), function () { return api('intApprove', { params: { id: r.actor_id } }); },
              { key: 'sx-run-approve-' + r.actor_id, failed: T('Could not approve'), out: 'sx_run_out', outcome: function () { $('sx_run_out').textContent = T('Approved — it starts within a minute.'); readRun(); } });
          } },
        { id: 'reject', label: T('Reject'), tid: 'sx-run-reject', when: function (r) { return waiting(r) && !!r.key_jti; },
          run: function (r) {
            CBAction.run(btnOf('reject', r.actor_id || r.id), function () { return api('keysRevoke', { params: { jti: r.key_jti } }); },
              { key: 'sx-run-reject-' + r.actor_id, confirm: { title: T('Reject this PC?'), body: esc(T('Its key is revoked. That kit can no longer connect.')), yes: T('Reject'), danger: true },
                failed: T('Could not reject'), out: 'sx_run_out', outcome: function () { $('sx_run_out').textContent = T('Rejected.'); readRun(); } });
          } },
      ],
    });
    readRun();
  }

  /* ═════ POLICY — the flags of lib/policy that have words here, with who may change each (the server's may) ═════ */
  function policy() {
    frame(['<h1 class="sx-h" data-testid="sx-title">' + esc(T('Policy')) + '</h1>',
      '<p class="sub">' + esc(T('Rules saved on your business, not on this device.')) + ' <a class="sx-link" href="/settings.html#/country" data-testid="sx-pol-country">' + esc(T('Country, money and year')) + ' ›</a></p>',
      lineOut('sx_pol_out'), '<div class="sx-list sx-tall" id="sx_pol_list" data-testid="sx-pol-list"></div>']);
    var pl = null;
    var answer = function () { var d = H.data.pol; return (d && d.r) || {}; };
    function rows() {
      var r = answer(), flags = r.flags || {}, may = r.may || {};
      if (!r.flags) return [];
      /* the rows ARE the server's (schema[key].ui + bound_schema, T2-POLICY) — the same reader the workshop's Business rules card uses */
      return polDefsOf(r.schema, r.bound_schema || r.bound).map(function (d) {
        var v = flags[d.key] !== undefined ? flags[d.key] : d.def;
        /* the server's answer when it gives one; an older server: the class the list states (bound · protected · inherited are locked) — the PATCH still decides */
        var m = may[d.key] || ((d.gov === 'bound' || d.gov === 'protected' || d.gov === 'inherited') ? { ok: false, why: T('Set by the platform for every shop.') } : { ok: true });
        /* W11: the registration is set in ONE place — Country setup (PUT /governance/country-setup writes the flag); here it is read, with the door */
        if (d.key === 'gst_registration') m = { ok: false, code: 'SET_IN_COUNTRY', why: T('Set under Country, with the registration number.') };
        return { key: d.key, def: d, v: v, may: m };
      });
    }
    function shown(x) {
      var d = x.def, v = polShown(d, x.v);
      if (d.type === 'enum') return T((d.labels && d.labels[x.v]) || String(x.v));
      /* AU-WORDS: a number the server names (ui.labels[value] — "No expiry", "Keep — the law here asks 5 years") reads as its word, never "0" */
      if (d.labels && d.labels[String(x.v)] !== undefined) return T(d.labels[String(x.v)]);
      return String(v) + (d.suffix ? ' ' + T(d.suffix) : '');
    }
    function control(x) {
      var d = x.def, id = 'sx_pol_' + d.key, dis = grey(x.may) ? ' disabled' : '';
      if (d.type === 'enum') return '<select class="inp" id="' + id + '" data-testid="sx-pol-in-' + esc(d.key) + '"' + dis + ' aria-label="' + esc(T(d.label)) + '">' + d.options.map(function (o) {
        return '<option value="' + esc(o) + '"' + (String(x.v) === String(o) ? ' selected' : '') + '>' + esc(T((d.labels && d.labels[o]) || o)) + '</option>'; }).join('') + '</select>';
      return '<span class="sx-num"><input class="inp" type="number" min="0" id="' + id + '" data-testid="sx-pol-in-' + esc(d.key) + '"' + (d.step ? ' step="' + esc(String(d.step)) + '"' : '') + dis
        + ' value="' + esc(String(polShown(d, x.v))) + '" aria-label="' + esc(T(d.label)) + '">' + (d.suffix ? '<span class="sub">' + esc(T(d.suffix)) + '</span>' : '') + '</span>';
    }
    function read() { return load('pol', 'policyGet', null, function () { if (pl) pl.refresh(); }); }
    pl = list($('sx_pol_list'), {
      key: 'set-policy', rows: rows, id: function (x) { return x.key; }, rowTid: function (x) { return 'sx-pol-' + x.key; },
      state: function () { return listState('pol'); }, error: function () { return listErr('pol'); }, onRetry: function () { read(); },
      empty: { title: T('No rules to set'), sub: T('This server does not keep policy rules yet.') },
      columns: [
        { key: 'label', label: T('Rule'), prio: 1, w: 260, sort: 'label', cell: function (x) { return T(x.def.label); }, value: function (x) { return T(x.def.label); } },
        { key: 'value', label: T('Now'), prio: 2, w: 170, cell: shown, value: shown },
        { key: 'who', label: T('Who may change it'), prio: 3, w: 200, html: true, value: function (x) { return x.may.ok === false ? 'no' : 'yes'; },
          cell: function (x) { var no = x.may.ok === false; return '<span class="tag' + (no ? '' : ' green') + '" data-testid="sx-pol-who-' + esc(x.key) + '">' + esc(no ? (x.may.code === 'PLATFORM_BOUND' ? T('The platform') : x.may.code === 'SET_IN_COUNTRY' ? T('Country setup') : T('The owner')) : T('You')) + '</span>'; } },
      ],
      search: function (x) { return [T(x.def.label), x.def.help, shown(x)].join(' '); },
      filters: [{ key: 'who', label: T('Who may change it'), all: T('Anyone'), options: [{ v: 'you', label: T('You') }, { v: 'not', label: T('Not you') }],
        match: function (x, v) { return v === 'you' ? x.may.ok !== false : x.may.ok === false; } }],
      next: function (x) {
        return '<div class="sx-next" data-testid="sx-pol-next-' + esc(x.key) + '">' + (x.def.help ? '<div class="sub">' + esc(T(x.def.help)) + '</div>' : '') + control(x)
          + (x.may.code === 'SET_IN_COUNTRY' ? '<a class="sx-link" href="/settings.html#/country" data-testid="sx-pol-country-door">' + esc(T('Change it under Country')) + ' ›</a>' : '') + '</div>';
      },
      actions: [{ id: 'save', label: T('Save'), tid: 'sx-pol-save', why: function (x) { return grey(x.may); },
        run: function (x) {
          var el = $('sx_pol_' + x.key); if (!el) return;
          var body = {}; body[x.key] = polStored(x.def, el.value);
          CBAction.run(btnOf('save', x.key), function () { return api('policySet', { body: body }); },
            { key: 'sx-pol-save-' + x.key, failed: T('Could not save that rule'), out: 'sx_pol_out', outcome: function (r) {
              var d = H.data.pol; if (d && d.r && r && r.flags) d.r.flags = r.flags; if (typeof SESSION !== 'undefined' && r && r.flags) SESSION.policy_flags = r.flags;
              $('sx_pol_out').textContent = T(x.def.label) + ' — ' + T('saved') + '.'; pl.refresh(); } });
        } }],
    });
    read();
  }

  /* ═════ PLAN & USAGE — GET /entities/entitlements (the plan, every quota as a STATE) + GET /entities/usage (what was billed) ═════ */
  var QUOTA_WORDS = { entities: 'Shops and branches', actors: 'People', chits_per_month: 'Chits a month', network_depth: 'Network levels', suppliers: 'Suppliers' };
  function plan() {
    frame(['<h1 class="sx-h" data-testid="sx-title">' + esc(T('Plan & usage')) + '</h1>', '<div id="sx_plan_head" data-testid="sx-plan-head"></div>',
      '<div class="sx-list" id="sx_quota_list" data-testid="sx-quota-list"></div>',
      '<h2 class="sx-h2">' + esc(T('Usage')) + '</h2>', '<div id="sx_use_head" data-testid="sx-use-head"></div>', '<div class="sx-list" id="sx_use_list" data-testid="sx-use-list"></div>']);
    var ql = null, ul = null;
    var ent = function () { var d = H.data.ent; return (d && d.r) || null; };
    var use = function () { var d = H.data.use; return (d && d.r) || null; };
    function quotaRows() {
      var e = ent(); if (!e || !e.quotas) return [];
      return Object.keys(e.quotas).map(function (k) { var q = e.quotas[k] || {}; return { key: k, state: q.state, limit: q.limit }; });
    }
    function allows(q) { return q.state === 'capped' ? T('Up to') + ' ' + q.limit : q.state === 'unlimited' ? T('No limit') : T('Not decided yet'); }
    function paintHead() {
      var e = ent(), d = H.data.ent || {};
      $('sx_plan_head').innerHTML = d.state === 'error' ? '<div class="err" data-testid="sx-plan-err">' + esc(listErr('ent').title) + '</div>'
        : !e ? '<div class="loadwrap"><span class="spin"></span> ' + esc(T('Reading your plan…')) + '</div>'
        : '<div class="sx-card"><div class="sx-big" data-testid="sx-plan-name">' + esc(e.name || e.plan) + '</div>'
          + '<p class="sub" data-testid="sx-plan-enforced">' + esc(e.enforced ? T('Your plan sets the limits below.') : T('Nothing is limited by your plan yet.')) + '</p></div>';
    }
    function paintUse() {
      var u = use(), d = H.data.use || {};
      $('sx_use_head').innerHTML = d.state === 'error' ? '<div class="err" data-testid="sx-use-err">' + esc(listErr('use').title) + '</div>'
        : !u ? '<div class="loadwrap"><span class="spin"></span> ' + esc(T('Reading your usage…')) + '</div>'
        : u.not_enabled ? '<p class="sub" data-testid="sx-use-off">' + esc(T('Usage is not recorded on this server yet.')) + '</p>'
        : '<div class="sx-card"><div class="sx-big" data-testid="sx-use-total">' + esc(fmtMoney(u.total_cost_usd, 'USD', '—')) + '</div>'
          + '<p class="sub" data-testid="sx-use-billed">' + esc(((u.counts && u.counts.billed) || 0) + ' ' + T('events billed in') + ' ' + (u.window_days || 0) + ' ' + T('days')) + '</p></div>';
    }
    function readEnt() { return load('ent', 'entitlements', null, function () { paintHead(); if (ql) ql.refresh(); }); }
    function readUse() { return load('use', 'entityUsage', null, function () { paintUse(); if (ul) ul.refresh(); }); }
    ql = list($('sx_quota_list'), {
      key: 'set-quotas', rows: quotaRows, id: function (q) { return q.key; }, rowTid: function (q) { return 'sx-quota-' + q.key; },
      state: function () { return listState('ent'); }, error: function () { return listErr('ent'); }, onRetry: function () { readEnt(); },
      empty: { title: T('Your plan names no limits') },
      columns: [
        { key: 'what', label: T('What'), prio: 1, w: 220, cell: function (q) { return T(QUOTA_WORDS[q.key] || q.key); } },
        { key: 'allows', label: T('Your plan allows'), prio: 2, w: 200, html: true, value: allows,
          cell: function (q) { return '<span class="tag' + (q.state === 'unset' ? ' amber' : ' green') + '" data-testid="sx-quota-state-' + esc(q.key) + '">' + esc(allows(q)) + '</span>'; } },
      ],
    });
    ul = list($('sx_use_list'), {
      key: 'set-usage', rows: function () { var u = use(); return (u && u.by_meter) || []; }, id: function (m) { return m.meter; }, rowTid: function (m) { return 'sx-use-' + m.meter; },
      state: function () { return listState('use'); }, error: function () { return listErr('use'); }, onRetry: function () { readUse(); },
      empty: { title: T('Nothing billed yet') },
      columns: [
        { key: 'meter', label: T('Kind'), prio: 1, w: 220, mono: true, cell: function (m) { return m.meter; } },
        { key: 'events', label: T('Events'), prio: 2, w: 110, num: true, cell: function (m) { return String(m.events || 0); }, value: function (m) { return Number(m.events) || 0; } },
        { key: 'cost', label: T('Cost'), prio: 3, w: 130, num: true, cell: function (m) { return fmtMoney(m.cost, 'USD', '—'); }, value: function (m) { return Number(m.cost) || 0; } },
      ],
    });
    paintHead(); paintUse(); readEnt(); readUse();
  }

  /* ═════ ACCOUNT (T3-P4-ACCOUNT) — Sessions (GET /signin/sessions · the owner's devices) · API keys (a door to the one list) · Vault (cap-shop.js's card, every section) ═════ */
  var SURFACE_WORDS = { till: 'Counter', index: 'Home', app: 'Workshop', web: 'Web', settings: 'CB Settings', finance: 'CB Finance', accounts: 'CB Accounts', crm: 'CB CRM', tasks: 'CB Tasks & Orders', shop: 'Online shop', kyb: 'Know your business', employees: 'CB Employees', network: 'Network' };
  var CURRENT_WHY = 'This is the device you are on. Use Sign out in the menu.';
  function account() {
    frame(['<h1 class="sx-h" data-testid="sx-title">' + esc(T('Account')) + '</h1>',
      '<p class="sub">' + esc(T('Where you are signed in. Sign one out if a device is lost or shared.')) + '</p>',
      '<div id="sx_ses_bar"></div>', lineOut('sx_ses_out'), '<div class="sx-list" id="sx_ses_list" data-testid="sx-ses-list"></div>',
      '<h2 class="sx-h2">' + esc(T('Every device of the shop')) + '</h2>', '<div id="sx_dev_bar"></div>', lineOut('sx_dev_out'), '<div class="sx-list" id="sx_dev_list" data-testid="sx-dev-list"></div>',
      '<h2 class="sx-h2">' + esc(T('Keys for other systems')) + '</h2>', '<div id="sx_keys_card" data-testid="sx-keys-card"></div>',
      '<h2 class="sx-h2">' + esc(T('Vault')) + '</h2>',
      '<p class="sub">' + esc(T('Identity, signatory, bank and licences — kept once, they fill every form for an authority')) + ' · <a class="sx-link" href="/authority-forms.html" data-testid="sx-vault-forms">' + esc(T('Forms for an authority')) + ' ›</a></p>',
      '<div id="vaulthost" data-testid="sx-vault"></div>']);
    var sl = null, dl = null;
    /* W18: a sign-in older than the list (legacy) is not in the server's rows — this device is still painted, from the page's own session, so the list never hides where you are */
    function hereRow() {
      var sess = (typeof SESSION !== 'undefined' && SESSION) || {};
      return { jti: sess.jti || 'this-device', device_id: sess.device_id || '', surface: sess.surface || 'settings', iat: sess.iat || null, exp: sess.exp || null, current: true, legacy: true, device: { kind: 'web', label: '' } };
    }
    var sesRows = function () { var d = H.data.ses, rows = (d && d.r && d.r.sessions) || []; return d && d.r && d.r.legacy && !rows.some(function (s) { return s.current; }) ? [hereRow()].concat(rows) : rows; };
    var devMay = function () { var d = H.data.ses; return (d && d.r && d.r.may && d.r.may.devices) || null; };
    var devRows = function () { var d = H.data.dev; return (d && d.r && d.r.devices) || []; };
    function surface(s) { return T(SURFACE_WORDS[s] || s || 'Web'); }
    function deviceOf(s) { var d = s.device || {}; return d.label || (d.kind === 'till' ? T('Counter phone or PC') : T('A browser')); }
    function sinceOf(s) { return s.iat ? when(new Date(Number(s.iat) * 1000).toISOString()) : ''; }
    function untilOf(s) { return s.exp ? day(new Date(Number(s.exp) * 1000).toISOString()) : ''; }
    function paintSesBar() {
      var d = H.data.ses || {}, rows = sesRows();
      $('sx_ses_bar').innerHTML = bar('<span class="sx-count" data-testid="sx-ses-count"><b>' + rows.length + '</b> ' + esc(T(rows.length === 1 ? 'sign-in' : 'sign-ins'))
        + (d.r && d.r.legacy ? ' · <span class="tag amber" data-testid="sx-ses-legacy">' + esc(T('This sign-in is older than the list — it is shown from this device; sign in again to list it on the server.')) + '</span>' : '') + '</span>');
    }
    function readSes() { return load('ses', function () { return api('sessionsList'); }, null, function () { paintSesBar(); if (sl) sl.refresh(); paintDevBar(); if (dl) dl.refresh(); }); }
    sl = list($('sx_ses_list'), {
      key: 'set-sessions', rows: sesRows, id: function (s) { return s.jti; }, rowTid: function (s) { return 'sx-ses-' + s.jti; },
      state: function () { return listState('ses'); }, error: function () { return listErr('ses'); }, onRetry: function () { readSes(); },
      empty: { title: T('No listed sign-in'), sub: T('Sign in again and this device is listed here.') },
      columns: [
        { key: 'device', label: T('Device'), prio: 1, w: 220, html: true, value: deviceOf,
          cell: function (s) { return '<b>' + esc(deviceOf(s)) + '</b>' + (s.current ? ' <span class="tag green" data-testid="sx-ses-current-' + esc(s.jti) + '">' + esc(T('This one')) + '</span>' : ''); } },
        { key: 'where', label: T('Where'), prio: 2, w: 150, cell: function (s) { return surface(s.surface); } },
        { key: 'since', label: T('Signed in'), prio: 3, w: 170, sort: 'since', cell: sinceOf, value: function (s) { return Number(s.iat) || 0; } },
        { key: 'until', label: T('Ends'), prio: 4, w: 130, cell: untilOf },
      ],
      sorts: [{ key: 'since', label: T('Signed in'), cmp: function (a, b) { return (Number(b.iat) || 0) - (Number(a.iat) || 0); } }],
      search: function (s) { return [deviceOf(s), surface(s.surface), s.device_id].join(' '); },
      filters: [{ key: 'kind', label: T('Kind'), all: T('All'), options: [{ v: 'till', label: T('Counter') }, { v: 'web', label: T('Browser') }],
        match: function (s, v) { var k = (s.device && s.device.kind) || 'web'; return v === 'till' ? k === 'till' : k !== 'till'; } }],
      next: function (s) {
        var d = s.device || {};
        return '<div class="sx-next" data-testid="sx-ses-next-' + esc(s.jti) + '"><div class="mono sub">' + esc(s.device_id || '') + '</div>'
          + (d.seen ? '<div class="sub">' + esc(T('Last seen') + ' ' + _keyAgo(d.seen)) + '</div>' : '')
          + (s.current ? '<div class="sub">' + esc(T(CURRENT_WHY)) + '</div>' : '') + '</div>';
      },
      actions: [{ id: 'signout', label: T('Sign out this device'), tid: 'sx-ses-signout', why: function (s) { return s.current ? T(CURRENT_WHY) : s.legacy ? T('Sign in again first — then it is listed on the server.') : ''; },
        run: function (s) {
          CBAction.run(btnOf('signout', s.jti), function () { return api('sessionRevoke', { body: { jti: s.jti } }); },
            { key: 'sx-ses-signout-' + s.jti, confirm: { title: T('Sign out') + ' ' + deviceOf(s) + '?', body: esc(T('That device is signed out now. Nothing on it is lost.')), yes: T('Sign out'), danger: true },
              failed: T('Could not sign it out'), out: 'sx_ses_out', outcome: function () { $('sx_ses_out').textContent = T('Signed out.'); readSes(); } });
        } }],
    });

    /* every device of the shop — the owner's list (GET /signin/devices); anyone else sees it greyed with the server's sentence (may.devices), never hidden */
    function paintDevBar() {
      var m = devMay(), rows = devRows(), live = rows.filter(function (d) { return !d.revoked_at && Number(d.sessions) > 0; }).length;
      $('sx_dev_bar').innerHTML = bar('<span class="sx-count" data-testid="sx-dev-count">' + (m && m.ok === false
        ? '<span class="sx-why" data-testid="sx-dev-why">' + esc(m.why || T('Not allowed for this sign-in.')) + '</span>'
        : '<b>' + rows.length + '</b> ' + esc(T(rows.length === 1 ? 'device' : 'devices')) + ' · <b>' + live + '</b> ' + esc(T('signed in now'))) + '</span>');
    }
    function readDev() {
      var m = devMay();
      if (m && m.ok === false) { H.data.dev = { state: 'error', err: { status: 403, message: m.why } }; paintDevBar(); if (dl) dl.refresh(); return Promise.resolve(); }
      return load('dev', function () { return api('devicesList'); }, null, function () { paintDevBar(); if (dl) dl.refresh(); });
    }
    function devState(d) { return d.revoked_at ? T('Removed') : Number(d.sessions) > 0 ? T('Signed in') : T('Nobody signed in'); }
    dl = list($('sx_dev_list'), {
      key: 'set-devices', rows: devRows, id: function (d) { return d.device_id; }, rowTid: function (d) { return 'sx-dev-' + d.device_id; },
      state: function () { return listState('dev'); }, error: function () { return listErr('dev'); }, onRetry: function () { readDev(); },
      empty: { title: T('No device listed yet'), sub: T('A device is listed the first time someone signs in on it.') },
      columns: [
        { key: 'id', label: T('Device'), prio: 1, w: 220, html: true, value: function (d) { return d.label || d.device_id; }, cell: function (d) { return '<b>' + esc(d.label || (d.kind === 'till' ? T('Counter phone or PC') : T('A browser'))) + '</b> <span class="mono sub">' + esc(String(d.device_id || '').slice(0, 12)) + '</span>'; } },
        { key: 'state', label: T('Now'), prio: 2, w: 170, html: true, value: devState,
          cell: function (d) { var on = !d.revoked_at && Number(d.sessions) > 0; return '<span class="tag' + (d.revoked_at ? '' : on ? ' green' : ' amber') + '" data-testid="sx-dev-state-' + esc(d.device_id) + '">' + esc(devState(d)) + (on ? ' · ' + d.sessions : '') + '</span>'; } },
        { key: 'seen', label: T('Last seen'), prio: 3, w: 150, sort: 'seen', cell: function (d) { return d.seen ? _keyAgo(d.seen) : T('Never'); }, value: function (d) { return d.seen ? new Date(d.seen).getTime() : 0; } },
        { key: 'first', label: T('First seen'), prio: 4, w: 150, cell: function (d) { return day(d.first_seen); } },
      ],
      sorts: [{ key: 'seen', label: T('Last seen'), cmp: function (a, b) { return (b.seen ? new Date(b.seen).getTime() : 0) - (a.seen ? new Date(a.seen).getTime() : 0); } }],
      search: function (d) { return [d.label, d.device_id, d.kind, d.till_prefix].join(' '); },
      filters: [{ key: 'st', label: T('State'), all: T('All'), options: [{ v: 'on', label: T('Signed in') }, { v: 'off', label: T('Nobody signed in') }, { v: 'gone', label: T('Removed') }],
        match: function (d, v) { return v === 'gone' ? !!d.revoked_at : v === 'on' ? !d.revoked_at && Number(d.sessions) > 0 : !d.revoked_at && !(Number(d.sessions) > 0); } }],
      next: function (d) {
        return '<div class="sx-next" data-testid="sx-dev-next-' + esc(d.device_id) + '"><div class="mono sub">' + esc(d.device_id || '') + '</div>'
          + (d.till_prefix ? '<div class="sub">' + esc(T('Bills as') + ' ' + d.till_prefix) + '</div>' : '')
          + (d.revoked_at ? '<div class="sub">' + esc(T('Removed') + ' ' + when(d.revoked_at)) + '</div>' : '<div class="sub">' + esc(T('Removing a device signs out everyone on it; it may not sign in again.')) + '</div>') + '</div>';
      },
      actions: [{ id: 'remove', label: T('Remove this device'), tid: 'sx-dev-remove', when: function (d) { return !d.revoked_at; }, why: function () { return grey(devMay()); },
        run: function (d) {
          CBAction.run(btnOf('remove', d.device_id), function () { return api('sessionRevoke', { body: { device_id: d.device_id } }); },
            { key: 'sx-dev-remove-' + d.device_id, confirm: { title: T('Remove this device?'), body: esc(T('Everyone on it is signed out now, and it cannot sign in again. Bills it has not sent stay on it.')), yes: T('Remove'), danger: true },
              failed: T('Could not remove it'), out: 'sx_dev_out', outcome: function () { $('sx_dev_out').textContent = T('Device removed.'); readDev(); readSes(); } });
        } }],
    });
    paintSesBar(); paintDevBar(); readSes().then(readDev);

    /* keys for other systems: the ONE list lives under Counters & keys (T3-SETTINGS) — here the count from the same read, and the door; never a second list or minting */
    function paintKeys() {
      var d = H.data.keys || {}, keys = (d.r && d.r.keys) || [], latest = keys.slice().sort(function (a, b) { return _keySeenAt(b) - _keySeenAt(a); })[0];
      $('sx_keys_card').innerHTML = '<div class="sx-card">' + (d.state === 'loading' ? '<div class="loadwrap"><span class="spin"></span> ' + esc(T('Reading your keys…')) + '</div>'
        : d.state === 'error' ? '<div class="err" data-testid="sx-keys-err">' + esc(listErr('keys').title) + '</div>'
        : '<div class="sx-big" data-testid="sx-keys-count">' + keys.length + ' ' + esc(T(keys.length === 1 ? 'key' : 'keys')) + '</div>'
          + '<p class="sub" data-testid="sx-keys-last">' + esc(latest && latest.seen && latest.seen.at ? T('Last heard') + ': ' + (latest.name || 'key') + ' · ' + _keyAgo(latest.seen.at) : keys.length ? T('None has reached ChitBridge yet.') : T('A key lets another system or a counter PC sign in as your shop.')) + '</p>')
        + '<a class="sx-link" href="/settings.html#/counters" data-testid="sx-keys-door">' + esc(T('Make, see or revoke a key')) + ' ›</a></div>';
    }
    load('keys', 'keysList', null, paintKeys);

    /* the vault: the workshop's own card (cap-shop.js), every section type here — Your shop shows the identity rows only */
    UI._vaultOnly = '';
    loadVault();
  }

  var PAINT = { counters: counters, connectors: connectors, policy: policy, plan: plan, account: account };
  function mount(host, sec) {
    H.lists.forEach(function (l) { try { l.destroy(); } catch (e) { if (typeof cblog === 'function') cblog('error', 'settings list teardown: ' + ((e && e.message) || e)); } });
    H.lists = []; H.data = {}; H.host = host; H.sec = sec;
    (PAINT[sec] || counters)();
  }
  return { mount: mount, SECTIONS: Object.keys(PAINT) };
})();
