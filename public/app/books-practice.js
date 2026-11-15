/**
 * books-practice.js — THE FIRM'S FIRST SCREEN (l16/firm-dash): a Practice band of counts across ALL clients and the client list under it, on Home.
 *
 * OWNS      one section on Home for a login that holds live received books grants: the band (each count a filter), the rule in words, the client list (CBList), the "Open books" per row; and the flag that hides the shop cards on a firm Home.
 * CALLED BY public/app.html (script tag, after books-grant-api.js and list-ctl.js) · public/app/shell.js (CBPractice.hidesShopCards)
 * FLOW      every second: a token not yet read → GET /api/books-grants/practice (one read for every client) → answer → draw the section before the areas; a login that may not read it (403) or holds no client draws nothing.
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * Decides nothing and computes nothing: every count, status, reason and date is the server's (lib/books-practice.js); the band's counts equal the filters under them because the server counts them from the same rows.
 */
(function (root) {
  'use strict';
  var P = { token: null, data: null, drawn: false, filter: null, list: null };
  var HIDDEN_CARDS = { till: 1, marketing: 1, storefront: 1 };
  var EP = { practice: { m: 'GET', p: '/api/books-grants/practice' } };
  function tx(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function base() {
    try {
      var f = root.localStorage.getItem('cb_api_base');
      if (f) return f === 'stage' ? root.CB_API || '' : f;
    } catch (failure) {
      if (root.cbQuiet) root.cbQuiet('practice:base', failure);
    }
    return /^(localhost|127\.0\.0\.1)$/.test(root.location.hostname) ? 'http://localhost:3000' : root.CB_API || '';
  }
  function token() {
    try {
      return (JSON.parse(root.localStorage.getItem('cb_sess') || 'null') || {}).token || null;
    } catch (failure) {
      if (root.cbQuiet) root.cbQuiet('practice:token', failure);
      return null;
    }
  }
  function read(left) {
    left = left === undefined ? 3 : left;
    return root.fetch(base() + EP.practice.p, { method: EP.practice.m, headers: { Authorization: 'Bearer ' + token() } }).then(function (r) {
      if (r.status === 503 && left > 0) {
        return new Promise(function (go) { root.setTimeout(go, Math.min(10, Number(r.headers.get('Retry-After')) || 2) * 1000); }).then(function () { return read(left - 1); });
      }
      if (!r.ok) return null; /* a login that may not read the practice (403) or a server without it: nothing is drawn */
      return r.json();
    });
  }
  /** a firm: it holds clients by live grants and has no trade of its own: the DATA says so (the server's own_trade), never a trade switch */
  function isFirm() {
    return !!(P.data && P.data.clients && P.data.clients.length && P.data.own_trade === false);
  }
  function hidesShopCards(id) {
    return isFirm() && !!HIDDEN_CARDS[id];
  }
  function money(minor, currency) {
    if (minor == null) return '—';
    var major = Number(minor) / 100;
    return root.CBLocale && root.CBLocale.money ? root.CBLocale.money(major, currency || 'AUD') : (currency || '') + ' ' + major.toFixed(2);
  }
  function day(value) {
    return value ? (typeof root.shopDay === 'function' ? root.shopDay(value) : String(value).slice(0, 10)) : '—';
  }
  var STATUS_CLASS = { help: 'red', watch: 'amber', good: 'green', none: '' };
  var ROLE = { adviser: 'Adviser', auditor: 'Auditor' };
  /* the band: key → [label, count, the filter it opens] */
  function tiles(b) {
    return [
      ['help', 'Needs help', b.health.help, { status: 'help' }],
      ['watch', 'Watch', b.health.watch, { status: 'watch' }],
      ['good', 'Doing well', b.health.good, { status: 'good' }],
      ['queries', 'Open queries', b.queries.clients, { queries: 'open' }, b.queries.on_client + ' ' + tx('waiting on the client') + ' · ' + b.queries.on_us + ' ' + tx('waiting on us')],
      ['bas', 'Return due in 30 days', b.bas_due_30, { bas: 'soon' }],
      ['months', 'Months not locked', b.months_unlocked, { unlocked: 'yes' }],
      ['checked', 'Entries checked', b.checked.clients_behind, { checked: 'behind' }, b.checked.n + ' ' + tx('of') + ' ' + b.checked.of + ' ' + tx('checked')],
      ['ending', 'Access ending in 30 days', b.grants_ending_30, { ending: 'soon' }]
    ];
  }
  function bandHTML(data) {
    var b = data.band;
    return (
      '<div class="bp-band" data-testid="practice-band" role="group" aria-label="' + esc(tx('Practice counts')) + '">' +
      tiles(b).map(function (t) {
        var on = P.filter && Object.keys(t[3])[0] === Object.keys(P.filter)[0] && t[3][Object.keys(t[3])[0]] === P.filter[Object.keys(P.filter)[0]];
        return (
          '<button type="button" class="bp-tile ' + esc(t[0]) + (on ? ' on' : '') + '" data-bp-filter="' + esc(JSON.stringify(t[3])) + '" aria-pressed="' + !!on + '" data-testid="practice-tile-' + esc(t[0]) + '">' +
          '<b>' + esc(t[2]) + '</b><span>' + esc(tx(t[1])) + '</span>' + (t[4] ? '<i>' + esc(t[4]) + '</i>' : '') + '</button>'
        );
      }).join('') +
      '<div class="bp-tile held" data-testid="practice-tile-bank"><b>—</b><span>' + esc(tx('Bank not reconciled')) + '</span><i>' + esc(tx('Not shown yet: the finance owner has not agreed it may be read across clients.')) + '</i></div>' +
      '</div>'
    );
  }
  function ruleHTML(rule) {
    return (
      '<p class="bp-rule sub" data-testid="practice-rule">' + esc(tx('Needs help')) + ': ' + esc(tx('cash under')) + ' ' + rule.help.cash_days_below + ' ' + esc(tx('days of bills')) + ', ' + esc(tx('sales down')) + ' ' + rule.help.sales_down_pct + '%, ' + esc(tx('or a loss')) + ' ' + rule.help.loss_months_running + ' ' + esc(tx('months running')) +
      '. ' + esc(tx('Watch')) + ': ' + esc(tx('sales down')) + ' ' + rule.watch.sales_down_pct + '%, ' + esc(tx('or a loss this quarter')) + '. ' + esc(tx('This is our starting rule; the firm can change it.')) + '</p>'
    );
  }
  function statusCell(r) {
    var why = r.health.reasons && r.health.reasons.length ? ' <span class="sub">' + esc(r.health.reasons.slice(0, 2).join(' · ')) + '</span>' : '';
    return '<span class="tag ' + (STATUS_CLASS[r.health.status] || '') + '" data-testid="practice-status-' + esc(r.entity_id) + '">' + esc(tx(r.health.words)) + '</span>' + why;
  }
  function trend(r) {
    var v = r.health.sales_trend_pct;
    return v == null ? '—' : (v > 0.5 ? '▲ ' : v < -0.5 ? '▼ ' : '► ') + (v > 0 ? '+' : '') + Math.round(v) + '%';
  }
  function basCell(r) {
    if (!r.bas.due_date) return '—';
    return esc(r.bas.form || '') + ' ' + esc(day(r.bas.due_date)) + (r.bas.due_in_days != null && r.bas.due_in_days <= 30 ? ' <span class="sub">(' + esc(r.bas.due_in_days) + ' ' + esc(tx('days')) + ')</span>' : '');
  }
  function queriesCell(r) {
    return r.queries.open ? esc(r.queries.on_client) + ' ' + esc(tx('client')) + ' · ' + esc(r.queries.on_us) + ' ' + esc(tx('us')) : '0';
  }
  function columns() {
    var num = function (key, label, w, cell, value, extra) {
      return Object.assign({ key: key, label: tx(label), prio: 2, w: w, sort: key, html: true, cell: cell, value: value }, extra || {});
    };
    return [
      { key: 'name', label: tx('Client'), prio: 1, w: 200, keep: true, sort: 'name', cell: function (r) { return r.name || r.entity_id.slice(0, 8); }, value: function (r) { return r.name || ''; } },
      num('status', 'Status', 210, statusCell, function (r) { return r.health.words; }, { prio: 1, keep: true, hfilter: 'status', sort: 'urgency' }),
      num('role', 'Role', 90, function (r) { return esc(tx(ROLE[r.role] || r.role)); }, function (r) { return r.role; }, { hfilter: 'role' }),
      num('bank', 'Bank', 120, function () { return '<span class="sub">' + esc(tx('Not shown yet')) + '</span>'; }, function () { return ''; }),
      num('queries', 'Queries open', 130, queriesCell, function (r) { return r.queries.open; }, { hfilter: 'queries' }),
      num('bas', 'Return due', 150, basCell, function (r) { return r.bas.due_date || ''; }, { hfilter: 'bas' }),
      num('checked', 'Checked', 90, function (r) { return esc(r.checked.n) + '/' + esc(r.checked.of); }, function (r) { return r.checked.n + '/' + r.checked.of; }, { hfilter: 'checked' }),
      num('unlocked', 'Months not locked', 110, function (r) { return esc(r.months_unlocked); }, function (r) { return r.months_unlocked; }, { hfilter: 'unlocked' }),
      num('sales', 'Sales vs 3-month average', 150, function (r) { return esc(trend(r)); }, function (r) { return trend(r); }),
      num('margin', 'Gross margin', 110, function (r) { return r.health.gross_margin_pct == null ? '—' : esc(r.health.gross_margin_pct) + '%'; }, function (r) { return r.health.gross_margin_pct == null ? '' : r.health.gross_margin_pct; }),
      num('cash', 'Cash in bank', 130, function (r) { return esc(money(r.health.cash_minor, r.currency)); }, function (r) { return r.health.cash_minor == null ? '' : r.health.cash_minor; }),
      num('profit', 'Profit this quarter', 140, function (r) { return esc(money(r.health.profit_quarter_minor, r.currency)); }, function (r) { return r.health.profit_quarter_minor == null ? '' : r.health.profit_quarter_minor; }),
      num('ending', 'Access ends', 120, function (r) { return esc(day(r.grant.expires_at)); }, function (r) { return r.grant.expires_at || ''; }, { hfilter: 'ending' }),
      num('look', 'Last look', 120, function (r) { return esc(day(r.last_look)); }, function (r) { return r.last_look || ''; }),
      { key: 'books', label: tx('Books'), prio: 1, w: 120, keep: true, html: true, cell: function (r) { return '<button type="button" class="act quiet" data-bp-open="' + esc(r.entity_id) + '" data-testid="practice-open-' + esc(r.entity_id) + '">' + esc(tx('Open books')) + '</button>'; }, value: function () { return 'open'; } }
    ];
  }
  function sorts() {
    var by = function (k, get, text) { return { key: k, label: tx(text), cmp: function (a, b) { var x = get(a), y = get(b); return typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : (x == null ? -1e18 : x) - (y == null ? -1e18 : y); } }; };
    return [
      by('urgency', function (r) { return r._n; }, 'Most to action first'),
      by('name', function (r) { return r.name || ''; }, 'Client'),
      by('queries', function (r) { return r.queries.open; }, 'Queries open'),
      by('bas', function (r) { return r.bas.due_date || '9999'; }, 'Return due'),
      by('checked', function (r) { return r.checked.of - r.checked.n; }, 'Checked'),
      by('unlocked', function (r) { return r.months_unlocked; }, 'Months not locked'),
      by('sales', function (r) { return r.health.sales_trend_pct; }, 'Sales vs 3-month average'),
      by('margin', function (r) { return r.health.gross_margin_pct; }, 'Gross margin'),
      by('cash', function (r) { return r.health.cash_minor; }, 'Cash in bank'),
      by('profit', function (r) { return r.health.profit_quarter_minor; }, 'Profit this quarter'),
      by('ending', function (r) { return r.grant.expires_at || ''; }, 'Access ends'),
      by('look', function (r) { return r.last_look || ''; }, 'Last look')
    ];
  }
  function filters() {
    var f = function (key, label, options, match) { return { key: key, label: tx(label), all: tx('All'), options: options.map(function (o) { return { v: o[0], label: tx(o[1]) }; }), match: match }; };
    return [
      f('status', 'Status', [['good', 'Doing well'], ['watch', 'Watch'], ['help', 'Needs help'], ['none', 'Not enough books yet']], function (r, v) { return r.health.status === v; }),
      f('role', 'Role', [['adviser', 'Adviser'], ['auditor', 'Auditor']], function (r, v) { return r.role === v; }),
      f('queries', 'Queries', [['open', 'Open'], ['us', 'Waiting on us'], ['client', 'Waiting on the client'], ['none', 'None']], function (r, v) { return v === 'open' ? r.queries.open > 0 : v === 'us' ? r.queries.on_us > 0 : v === 'client' ? r.queries.on_client > 0 : r.queries.open === 0; }),
      f('bas', 'Return due', [['soon', 'Within 30 days'], ['later', 'Later'], ['none', 'No date']], function (r, v) { return v === 'soon' ? r.bas.due_in_days != null && r.bas.due_in_days <= 30 : v === 'later' ? r.bas.due_in_days != null && r.bas.due_in_days > 30 : r.bas.due_in_days == null; }),
      f('checked', 'Checked', [['behind', 'Entries not all checked'], ['done', 'All checked']], function (r, v) { return v === 'behind' ? r.checked.of > r.checked.n : r.checked.of <= r.checked.n; }),
      f('unlocked', 'Months not locked', [['yes', 'Some'], ['no', 'None']], function (r, v) { return v === 'yes' ? r.months_unlocked > 0 : r.months_unlocked === 0; }),
      f('ending', 'Access ends', [['soon', 'Within 30 days'], ['later', 'Later']], function (r, v) { return v === 'soon' ? r.grant.ends_in_days <= 30 : r.grant.ends_in_days > 30; })
    ];
  }
  function openBooks(id) {
    root.location.href = '/network.html?open=' + encodeURIComponent(id);
  }
  function mountList() {
    var host = root.document.getElementById('bp_list');
    if (!host || !root.CBList) return;
    if (P.list) {
      try { P.list.destroy(); } catch (failure) { if (root.cbQuiet) root.cbQuiet('practice:destroy', failure); }
    }
    if (root.CBList.reset) root.CBList.reset('practice-clients');
    var rows = P.data.clients.map(function (r, n) { r._n = n; return r; });
    P.list = root.CBList.mount(host, {
      key: 'practice-clients', t: tx, rows: function () { return rows; }, id: function (r) { return r.entity_id; }, rowTid: function (r) { return 'practice-row-' + r.entity_id; },
      columns: columns(), sorts: sorts(), filters: filters(), preset: P.filter ? { filt: P.filter } : { filt: {} },
      search: function (r) { return [r.name, r.country, r.health.words, r.health.reasons.join(' ')].join(' '); },
      empty: { title: tx('No clients match') }
    });
    host.onclick = function (ev) {
      var button = ev.target.closest && ev.target.closest('[data-bp-open]');
      if (button) openBooks(button.getAttribute('data-bp-open'));
    };
  }
  function css() {
    if (root.document.getElementById('bp_css')) return;
    var s = root.document.createElement('style');
    s.id = 'bp_css';
    s.textContent =
      '#bp_practice{margin:0 0 16px}#bp_practice h2{margin:0 0 6px;font-size:18px}.bp-band{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0}' +
      '.bp-tile{display:flex;flex-direction:column;gap:2px;text-align:left;padding:8px 10px;border:1px solid var(--line,#DDD6C6);border-radius:10px;background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer;min-height:44px}' +
      '.bp-tile b{font-size:22px;line-height:1.1}.bp-tile span{font-size:13px}.bp-tile i{font-style:normal;font-size:12px;color:var(--muted,#5a5646)}' +
      '.bp-tile.on{outline:2px solid var(--accent,#1b4d3e)}.bp-tile.help b{color:var(--red,#9b1c1c)}.bp-tile.watch b{color:var(--amber,#8a5a00)}.bp-tile.good b{color:var(--green,#1b5e20)}.bp-tile.held{cursor:default;opacity:.85;border-style:dashed}' +
      '#bp_list{height:min(70vh,640px);min-height:320px}.bp-rule{margin:4px 0 8px}.bp-clear{margin-inline-start:8px}';
    root.document.head.appendChild(s);
  }
  function draw() {
    var areas = root.document.querySelector('[data-testid="shell-areas"]');
    if (!areas || !P.data) return false;
    var section = root.document.getElementById('bp_practice');
    if (!section) {
      css();
      section = root.document.createElement('section');
      section.id = 'bp_practice';
      section.setAttribute('data-testid', 'practice');
      areas.parentNode.insertBefore(section, areas);
    }
    section.innerHTML =
      '<h2>' + esc(tx('Your practice')) + ' · ' + esc(P.data.clients.length) + ' ' + esc(tx('clients')) + '</h2>' + ruleHTML(P.data.rule) + bandHTML(P.data) +
      (P.filter ? '<button type="button" class="act quiet bp-clear" data-bp-clear="1" data-testid="practice-clear">' + esc(tx('Show all clients')) + '</button>' : '') +
      (P.data.truncated ? '<p class="sub">' + esc(tx('Only the first clients are shown.')) + '</p>' : '') +
      '<div id="bp_list" data-testid="practice-list"></div>';
    [].forEach.call(section.querySelectorAll('[data-bp-filter]'), function (b) {
      b.onclick = function () {
        var f = JSON.parse(b.getAttribute('data-bp-filter'));
        P.filter = P.filter && JSON.stringify(P.filter) === JSON.stringify(f) ? null : f;
        draw();
      };
    });
    var clear = section.querySelector('[data-bp-clear]');
    if (clear) clear.onclick = function () { P.filter = null; draw(); };
    mountList();
    P.drawn = true;
    return true;
  }
  function tick() {
    var t = token();
    if (!t) return;
    if (P.token !== t) {
      P.token = t;
      P.data = null;
      P.drawn = false;
      read().then(function (answer) {
        if (!answer || !answer.clients || !answer.clients.length) return;
        P.data = answer;
        root.dispatchEvent(new root.Event('cb-practice'));
        tick();
      }, function (failure) { if (root.cbQuiet) root.cbQuiet('practice:read', failure); });
    } else if (P.data && !root.document.getElementById('bp_practice')) draw();
  }
  function start() {
    tick();
    if (!P.timer) P.timer = root.setInterval(tick, 1000);
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
  else start();
  root.CBPractice = { hasData: function () { return !!P.data; }, isFirm: isFirm, hidesShopCards: hidesShopCards, start: start };
})(typeof window !== 'undefined' ? window : globalThis);
