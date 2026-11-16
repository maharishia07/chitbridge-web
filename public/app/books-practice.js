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
  var P = { token: null, data: null, drawn: false, filter: null, list: null, band: null };
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
  var ROLE = { adviser: 'Accountant', auditor: 'Auditor' };
  /* REP-73: the bands are the server's (data.band.bands, in its order, the first one open); the page knows each tile's WORDS and the list filter it opens, never which band comes first, which tile is hidden or a count.
     tile key → [label, the filter it opens]; every count is the size of that filter on the list (the server counts them from the same rows). */
  var BAND_NAME = { pipeline: 'Year end', on_us: 'On us today', advisory: 'Advice' };
  var TILE = {
    books_in: ['Books in', { stage: 'books_in' }], complete: ['Complete', { stage: 'complete' }], checked: ['Checked', { stage: 'checked' }], ready: ['Ready to file', { stage: 'ready' }], lodged: ['Marked lodged by the owner', { stage: 'lodged' }],
    bas_due_30: ['Due in 30 days', { bas: 'soon' }],
    queries_on_us: ['Queries on us', { queries: 'us' }], queries_over_14: ['Waiting over 14 days', { queries: 'over14' }], bank_unexplained: ['Bank not explained', { bank: 'unexplained' }], to_check: ['Entries to check', { checked: 'behind' }], months_unlocked: ['Months to lock', { unlocked: 'yes' }],
    cash_low: ['Cash running low', { advice: 'cash_low' }], sales_down: ['Sales down', { advice: 'sales_down' }], loss: ['Making a loss', { advice: 'loss' }], late_debtors: ['Late debtors', { advice: 'late_debtors' }]
  };
  function sameFilter(f, g) {
    return !!f && !!g && JSON.stringify(f) === JSON.stringify(g);
  }
  /** the band shown: the one the person chose, else the one the server opened first */
  function bandShown(data) {
    var bands = (data.band && data.band.bands) || [];
    return bands.filter(function (x) { return x.key === P.band; })[0] || bands.filter(function (x) { return x.first; })[0] || bands[0] || null;
  }
  function bandHTML(data) {
    var bands = (data.band && data.band.bands) || [], shown = bandShown(data);
    if (!shown) return '';
    var tabs = bands.length > 1 ? '<div class="bp-bands" role="tablist" aria-label="' + esc(tx('Practice bands')) + '">' + bands.map(function (x) {
      return '<button type="button" role="tab" class="bp-bandtab' + (x.key === shown.key ? ' on' : '') + '" aria-selected="' + (x.key === shown.key) + '" data-cbsid="CMP036-D01" data-bp-band="' + esc(x.key) + '" data-testid="practice-band-' + esc(x.key) + '">' + esc(tx(BAND_NAME[x.key] || x.key)) + '</button>';
    }).join('') + '</div>' : '';
    var tiles = shown.tiles.filter(function (t) { return TILE[t.key]; }).map(function (t) {
      var def = TILE[t.key], on = sameFilter(P.filter, def[1]);
      return '<button type="button" class="bp-tile ' + esc(t.key) + (on ? ' on' : '') + '" data-cbsid="CMP060-D01" data-bp-filter="' + esc(JSON.stringify(def[1])) + '" aria-pressed="' + on + '" data-testid="practice-tile-' + esc(t.key) + '"><b>' + esc(t.n) + '</b><span>' + esc(tx(def[0])) + '</span></button>';
    }).join('');
    var note = shown.costs_not_shared ? '<p class="bp-note sub" data-testid="practice-costs-note">' + esc(shown.costs_not_shared) + ' ' + esc(tx('clients: costs not shared')) + '</p>' : '';
    return '<div class="bp-bandbox" data-testid="practice-band" data-band="' + esc(shown.key) + '" role="group" aria-label="' + esc(tx('Practice counts')) + '">' + tabs + '<div class="bp-band">' + tiles + '</div>' + note + '</div>';
  }
  function ruleHTML(rule) {
    return (
      '<p class="bp-rule sub" data-testid="practice-rule">' + esc(tx('Needs help')) + ': ' + esc(tx('cash under')) + ' ' + rule.help.cash_days_below + ' ' + esc(tx('days of bills')) + ', ' + esc(tx('sales down')) + ' ' + rule.help.sales_down_pct + '%, ' + esc(tx('loss')) + ' ' + rule.help.loss_months_running + ' ' + esc(tx('months running')) +
      '. ' + esc(tx('Watch')) + ': ' + esc(tx('sales down')) + ' ' + rule.watch.sales_down_pct + '%, ' + esc(tx('loss this quarter')) + '. ' + esc(tx('The firm can change this.')) + '</p>'
    );
  }
  function statusCell(r) {
    var why = r.health.reasons && r.health.reasons.length ? ' <span class="sub">· ' + esc(r.health.reasons.slice(0, 2).join(' · ')) + '</span>' : '';
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
  /** what a client row opens to: the health figures read from the client's own books, each with its words; a figure the server holds back says so */
  function detailHTML(r) {
    var h = r.health, held = tx('Not shown');
    var line = function (label, value) { return '<div class="bp-fig"><span class="sub">' + esc(tx(label)) + '</span><b>' + value + '</b></div>'; };
    return (
      '<div class="bp-detail" data-testid="practice-detail-' + esc(r.entity_id) + '">' +
      line('Sales vs 3-month average', esc(trend(r))) +
      line('Margin this quarter', h.gross_margin_pct == null ? '—' : esc(h.gross_margin_pct) + '%') +
      line('Cash in bank', esc(money(h.cash_minor, r.currency))) +
      line('Bills due in 30 days', h.bills_due_30_minor == null ? esc(held) : esc(money(h.bills_due_30_minor, r.currency))) +
      line('Cash for those bills', h.bills_due_30_minor == null ? esc(held) : h.cash_days == null ? esc(tx('Covers them')) : esc(tx('Runs out in')) + ' ' + esc(h.cash_days) + ' ' + esc(tx('days'))) +
      line('Customers owe, over 60 days late', h.receivables_over60_minor == null ? esc(held) : esc(money(h.receivables_over60_minor, r.currency)) + (h.receivables_over60_share_pct == null ? '' : ' (' + esc(h.receivables_over60_share_pct) + '%)')) +
      line('Bank', r.bank.state === 'none' ? esc(tx('No statement')) : r.bank.state === 'reconciled' ? esc(tx('Reconciled')) + ' ' + esc(tx('to')) + ' ' + esc(day(r.bank.reconciled_to)) : esc(bankLeft(r)) + ' ' + esc(tx('unexplained'))) +
      line('Profit this quarter', esc(money(h.profit_quarter_minor, r.currency))) +
      line('Months not locked', esc(r.months_unlocked)) +
      line('Access ends', esc(day(r.grant.expires_at))) +
      (h.reasons && h.reasons.length ? '<p class="sub">' + esc(tx('Why')) + ': ' + esc(h.reasons.join(' · ')) + '</p>' : '') +
      '</div>'
    );
  }
  /** what is left unexplained, as the api carries it: one figure per currency (CUR-1), never two currencies added; an older answer's one figure in the client's currency */
  function bankLeft(r) {
    var b = r.bank, lines = b.by_currency || [];
    return lines.length ? lines.map(function (l) { return money(l.unexplained_minor, l.currency); }).join(' · ') : money(b.unexplained_minor, b.currency || r.currency);
  }
  /** the bank as the client's signed statements carry it: reconciled to a date, or the amount left unexplained, or no statement signed */
  function bankCell(r) {
    var b = r.bank;
    if (b.state === 'none') return '<span class="sub">' + esc(tx('No statement')) + '</span>';
    var to = esc(tx('to')) + ' ' + esc(day(b.reconciled_to));
    return b.state === 'unexplained' ? '<span data-testid="practice-bank-' + esc(r.entity_id) + '">' + esc(bankLeft(r)) + ' ' + esc(tx('unexplained')) + '</span><br><span class="sub">' + to + '</span>' : esc(tx('Reconciled')) + ' <span class="sub">' + to + '</span>';
  }
  /** l16 R4-2b: the client this person worked on last (set when a client's books are entered, books-acting.js): its row is marked, in view and focused when the list comes back */
  function lastClient() {
    try { return root.sessionStorage.getItem('cb_last_client') || ''; } catch (failure) { if (root.cbQuiet) root.cbQuiet('practice:last', failure); return ''; }
  }
  function isLast(r) {
    var last = lastClient();
    return !!last && String(r.entity_id) === last;
  }
  function columns() {
    var num = function (key, label, w, cell, value, extra) {
      return Object.assign({ key: key, label: tx(label), prio: 2, w: w, sort: key, html: true, cell: cell, value: value }, extra || {});
    };
    return [
      { key: 'name', label: tx('Client'), prio: 1, w: 150, minw: 110, keep: true, stretch: true, sort: 'name', html: true, cell: function (r) { return esc(r.name || r.entity_id.slice(0, 8)) + (isLast(r) ? ' <span class="bp-chip" data-cbsid="CMP033-B01" data-testid="practice-last-chip">' + esc(tx('Last opened')) + '</span>' : ''); }, value: function (r) { return r.name || ''; } },
      num('status', 'Status', 180, statusCell, function (r) { return r.health.words; }, { prio: 1, keep: true, hfilter: 'status', sort: 'urgency' }),
      num('role', 'Role', 90, function (r) { return esc(tx(ROLE[r.role] || r.role)); }, function (r) { return r.role; }, {}),
      num('bank', 'Bank', 150, bankCell, function (r) { return r.bank.state; }, { hfilter: 'bank' }),
      num('queries', 'Queries', 120, queriesCell, function (r) { return r.queries.open; }),
      num('bas', 'Return due', 120, basCell, function (r) { return r.bas.due_date || ''; }, { hfilter: 'bas' }),
      num('checked', 'Checked', 100, function (r) { return esc(r.checked.n) + '/' + esc(r.checked.of); }, function (r) { return r.checked.n + '/' + r.checked.of; }, {}),
      num('unlocked', 'Unlocked', 90, function (r) { return esc(r.months_unlocked); }, function (r) { return r.months_unlocked; }, { hfilter: 'unlocked', prio: 3 }),
      num('sales', 'Sales trend', 90, function (r) { return esc(trend(r)); }, function (r) { return trend(r); }),
      num('margin', 'Margin', 80, function (r) { return r.health.gross_margin_pct == null ? '—' : esc(r.health.gross_margin_pct) + '%'; }, function (r) { return r.health.gross_margin_pct == null ? '' : r.health.gross_margin_pct; }, { prio: 3 }),
      num('cash', 'Cash', 110, function (r) { return esc(money(r.health.cash_minor, r.currency)); }, function (r) { return r.health.cash_minor == null ? '' : r.health.cash_minor; }, { prio: 3 }),
      num('profit', 'Profit (qtr)', 110, function (r) { return esc(money(r.health.profit_quarter_minor, r.currency)); }, function (r) { return r.health.profit_quarter_minor == null ? '' : r.health.profit_quarter_minor; }, { prio: 3 }),
      num('ending', 'Ends', 100, function (r) { return esc(day(r.grant.expires_at)); }, function (r) { return r.grant.expires_at || ''; }, { hfilter: 'ending', prio: 3 }),
      num('look', 'Last look', 100, function (r) { return esc(day(r.last_look)); }, function (r) { return r.last_look || ''; }),
      { key: 'books', label: tx('Books'), prio: 1, w: 110, keep: true, html: true, cell: function (r) { return '<button type="button" class="act quiet" data-cbsid="NET001-B04" data-bp-open="' + esc(r.entity_id) + '" data-testid="practice-open-' + esc(r.entity_id) + '">' + esc(tx('Open books')) + '</button>'; }, value: function () { return 'open'; } }
    ];
  }
  function sorts() {
    var by = function (k, get, text) { return { key: k, label: tx(text), cmp: function (a, b) { var x = get(a), y = get(b); return typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : (x == null ? -1e18 : x) - (y == null ? -1e18 : y); } }; };
    return [
      by('urgency', function (r) { return r._n; }, 'Most urgent first'),
      by('name', function (r) { return r.name || ''; }, 'Client'),
      by('bank', function (r) { return r.bank.unexplained_minor || 0; }, 'Bank unexplained'),
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
      f('stage', 'Year end', [['books_in', 'Books in'], ['complete', 'Complete'], ['checked', 'Checked'], ['ready', 'Ready to file'], ['lodged', 'Marked lodged']], function (r, v) { return (r.stages_reached || []).indexOf(v) >= 0; }),
      f('advice', 'Advice', [['cash_low', 'Cash running low'], ['sales_down', 'Sales down'], ['loss', 'Making a loss'], ['late_debtors', 'Late debtors']], function (r, v) { return !!(r.grant && r.grant.can_see_costs) && ((r.health && r.health.codes) || []).indexOf(v) >= 0; }),
      f('role', 'Role', [['adviser', 'Accountant'], ['auditor', 'Auditor']], function (r, v) { return r.role === v; }),
      f('bank', 'Bank', [['unexplained', 'Not reconciled'], ['reconciled', 'Reconciled'], ['none', 'No statement']], function (r, v) { return r.bank.state === v; }),
      f('queries', 'Queries', [['open', 'Open'], ['us', 'Waiting on us'], ['over14', 'Waiting over 14 days'], ['client', 'Waiting on the client'], ['none', 'None']], function (r, v) { return v === 'open' ? r.queries.open > 0 : v === 'us' ? r.queries.on_us > 0 : v === 'over14' ? r.queries.waiting_over_14 === true : v === 'client' ? r.queries.on_client > 0 : r.queries.open === 0; }),
      f('bas', 'Return due', [['soon', 'Within 30 days'], ['later', 'Later'], ['none', 'No date']], function (r, v) { return v === 'soon' ? r.bas.due_in_days != null && r.bas.due_in_days <= 30 : v === 'later' ? r.bas.due_in_days != null && r.bas.due_in_days > 30 : r.bas.due_in_days == null; }),
      f('checked', 'Checked', [['behind', 'Some not checked'], ['done', 'All checked']], function (r, v) { return v === 'behind' ? r.checked.of > r.checked.n : r.checked.of <= r.checked.n; }),
      f('unlocked', 'Months not locked', [['yes', 'Some'], ['no', 'None']], function (r, v) { return v === 'yes' ? r.months_unlocked > 0 : r.months_unlocked === 0; }),
      f('ending', 'Access ends', [['soon', 'Within 30 days'], ['later', 'Later']], function (r, v) { return v === 'soon' ? r.grant.ends_in_days <= 30 : r.grant.ends_in_days > 30; })
    ];
  }
  function openBooks(id) {
    root.location.href = '/network.html?open=' + encodeURIComponent(id);
  }
  /** the list unit is loaded when the practice has answered (Home carries no list otherwise) */
  function withList(then) {
    if (root.CBList) return then();
    var tag = root.document.createElement('script');
    tag.src = '/app/list-ctl.js';
    tag.onload = then;
    root.document.head.appendChild(tag);
  }
  function mountList() {
    var host = root.document.getElementById('bp_list');
    if (!host) return;
    if (!root.CBList) return withList(mountList);
    if (P.list) {
      try { P.list.destroy(); } catch (failure) { if (root.cbQuiet) root.cbQuiet('practice:destroy', failure); }
    }
    if (root.CBList.reset) root.CBList.reset('practice-clients');
    var rows = P.data.clients.map(function (r, n) { r._n = n; return r; });
    P.list = root.CBList.mount(host, {
      key: 'practice-clients', t: tx, rows: function () { return rows; }, id: function (r) { return r.entity_id; }, rowTid: function (r) { return 'practice-row-' + r.entity_id; },
      columns: columns(), defaultCols: ['name', 'status', 'role', 'bank', 'queries', 'bas', 'checked', 'sales', 'look', 'books'], next: detailHTML, sorts: sorts(), filters: filters(), preset: P.filter ? { filt: P.filter } : { filt: {} },
      search: function (r) { return [r.name, r.country, r.health.words, r.health.reasons.join(' ')].join(' '); },
      empty: { title: tx('No clients match') },
      rowClass: function (r) { return isLast(r) ? 'bp-last' : ''; }
    });
    if (!P.marked && lastClient()) {
      P.marked = true;
      root.setTimeout(function () { if (P.list && P.list.mark) P.list.mark(lastClient()); }, 0);
    }
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
      '.bp-tile b{font-size:20px;line-height:1.1}@media(max-width:700px){.bp-band{grid-template-columns:repeat(3,1fr);gap:6px}.bp-tile{padding:6px 8px;min-height:44px}.bp-tile b{font-size:18px}.bp-tile span{font-size:12px;line-height:1.15}}.bp-bands{display:flex;gap:6px;margin:4px 0}.bp-bandtab{border:1px solid var(--line,#DDD6C6);border-radius:999px;padding:4px 12px;background:var(--card,#fff);color:inherit;font:inherit;font-size:13px;cursor:pointer;min-height:32px}.bp-bandtab.on{background:var(--accent,#1b4d3e);color:var(--on-accent,#fff);border-color:var(--accent,#1b4d3e)}.bp-note{margin:2px 0}.bp-tile span{font-size:13px}.bp-tile i{font-style:normal;font-size:12px;color:var(--muted,#5a5646)}' +
      '.bp-last{background:var(--amber-t,#FDF3DC)}.bp-chip{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:999px;border:1px solid var(--amber-b,#EFD39A);background:var(--amber-t,#FDF3DC);color:var(--amber-i,#7A5205);font-size:12px;font-weight:600;white-space:nowrap}' +
      '.bp-tile.on{outline:2px solid var(--accent,#1b4d3e)}.bp-tile.help b{color:var(--red,#9b1c1c)}.bp-tile.watch b{color:var(--amber,#8a5a00)}.bp-tile.good b{color:var(--green,#1b5e20)}.bp-tile.held{cursor:default;opacity:.85;border-style:dashed}' +
      '.bp-detail{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 16px;padding:8px 4px}.bp-fig{display:flex;justify-content:space-between;gap:8px}#bp_list{height:min(70vh,640px);min-height:320px}@media(max-width:700px){#bp_list{height:80vh}}.bp-rule{margin:4px 0 8px}.bp-clear{margin-inline-start:8px}';
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
    dropWaiting();
    var door = root.document.getElementById('bcd_card');
    if (door && door.parentNode) door.parentNode.removeChild(door);
    section.innerHTML =
      '<h2>' + esc(tx('Your practice')) + ' · ' + esc(P.data.clients.length) + ' ' + esc(tx('clients')) + '</h2>' + (bandShown(P.data) && bandShown(P.data).key === 'advisory' ? ruleHTML(P.data.rule) : '') + bandHTML(P.data) +
      (P.filter ? '<button type="button" class="act quiet bp-clear" data-cbsid="CMP014-B01" data-bp-clear="1" data-testid="practice-clear">' + esc(tx('Show all clients')) + '</button>' : '') +
      (P.data.truncated ? '<p class="sub">' + esc(tx('Some clients are not shown.')) + '</p>' : '') +
      '<div id="bp_list" data-testid="practice-list"></div>';
    [].forEach.call(section.querySelectorAll('[data-bp-filter]'), function (b) {
      b.onclick = function () {
        var f = JSON.parse(b.getAttribute('data-bp-filter'));
        P.filter = P.filter && JSON.stringify(P.filter) === JSON.stringify(f) ? null : f;
        draw();
      };
    });
    [].forEach.call(section.querySelectorAll('[data-bp-band]'), function (b) {
      b.onclick = function () { P.band = b.getAttribute('data-bp-band'); P.filter = null; draw(); };
    });
    var clear = section.querySelector('[data-bp-clear]');
    if (clear) clear.onclick = function () { P.filter = null; draw(); };
    mountList();
    P.drawn = true;
    return true;
  }
  /* l16 firmhome: Home's card facts and the "Your clients" card ask THIS first: a firm (clients, no trade of its own) hides the shop cards and asks for only what it draws, so
     they wait for the one practice read (at most `ms`) and then know which Home they are on. Never rejects. */
  var settleNow = null,
    settledOnce = new root.Promise(function (go) { settleNow = go; });
  function settle() { P.pending = false; release(); dropWaiting(); if (settleNow) settleNow(true); }
  /* l16 R4-2: the wait is for the ANSWER, not for 3 s. A practice answer held past 3 s used to let Home decide "not a firm": the auditor saw the shop Home and the page asked 31 calls against a budget of 8. The ceiling is
     only a hang-guard (a read that never returns); a slow answer shows the loading frame (drawWaiting) and Home waits for it. */
  var SETTLE_CEILING = 25000;
  function settled(ms) {
    return root.Promise.race([settledOnce, new root.Promise(function (go) { root.setTimeout(go, ms || SETTLE_CEILING, false); })]);
  }
  /** what the last answer said (a firm or not) for THIS login, kept per browser only to word the loading frame and to decide whether Home holds its paint; the page never decides from it.
      Stored as "1:<token tail>" / "0:<token tail>" so another login in the same browser reads as unknown. */
  function hintRaw() {
    try {
      var v = root.localStorage.getItem('cb_practice_hint') || '', t = token() || '';
      return v.slice(1, 2) === ':' && v.slice(2) === t.slice(-12) ? v.slice(0, 1) : '';
    } catch (failure) {
      if (root.cbQuiet) root.cbQuiet('practice:hint', failure);
      return '';
    }
  }
  function hint(set) {
    try {
      if (set !== undefined) root.localStorage.setItem('cb_practice_hint', (set ? '1' : '0') + ':' + (token() || '').slice(-12));
    } catch (failure) {
      if (root.cbQuiet) root.cbQuiet('practice:hint', failure);
    }
    return hintRaw() === '1';
  }
  /** l16 R5-2: Home paints ONLY the loading frame while this login may be a firm (signed in, and the last answer for this login was not "a shop"): no shop card, no card facts, until settled() answers.
      A login known to be a shop (hint 0) paints at once as before, so an owner is never slower. */
  var holding = !!token() && hintRaw() !== '0';
  function release() {
    if (!holding) return;
    holding = false;
    root.document.documentElement.classList.remove('bp-hold');
  }
  if (holding) {
    root.document.documentElement.classList.add('bp-hold');
    var hs = root.document.createElement('style');
    hs.textContent = 'html.bp-hold [data-testid="shell-areas"]{display:none!important}';
    (root.document.head || root.document.documentElement).appendChild(hs);
    root.setTimeout(release, SETTLE_CEILING + 500);
  }
  function dropWaiting() {
    var w = root.document.getElementById('bp_wait');
    if (w && w.parentNode) w.parentNode.removeChild(w);
  }
  /** the practice frame while the one practice read is still out (after 0.8 s): a heading and a loading line, replaced by the practice when it answers, removed when it says there is none */
  function drawWaiting() {
    var areas = root.document.querySelector('[data-testid="shell-areas"]');
    if (!areas || root.document.getElementById('bp_wait') || root.document.getElementById('bp_practice')) return;
    var w = root.document.createElement('section');
    w.id = 'bp_wait';
    w.setAttribute('data-testid', 'practice-loading');
    w.setAttribute('role', 'status');
    w.setAttribute('aria-live', 'polite');
    w.style.margin = '0 0 16px';
    w.innerHTML = (hint() ? '<h2 style="margin:0 0 6px;font-size:18px">' + esc(tx('Your practice')) + '</h2>' : '') + '<p class="sub">' + esc(tx('Loading')) + '</p>';
    areas.parentNode.insertBefore(w, areas);
  }
  function tick() {
    var t = token();
    if (!t) return;
    if (P.token !== t) {
      P.token = t;
      P.data = null;
      P.drawn = false;
      P.pending = true;
      P.since = Date.now();
      read().then(function (answer) {
        if (!answer || !answer.clients || !answer.clients.length) { hint(false); return settle(); }
        P.data = answer;
        hint(answer.own_trade === false);
        root.dispatchEvent(new root.Event('cb-practice'));
        settle();
        tick();
      }, function (failure) { if (root.cbQuiet) root.cbQuiet('practice:read', failure); settle(); });
    } else if (P.data && !root.document.getElementById('bp_practice')) draw();
    else if (P.pending && !P.data && (holding || Date.now() - P.since > 800)) drawWaiting();
  }
  function start() {
    tick();
    if (!P.timer) P.timer = root.setInterval(tick, 1000);
    if (holding) { var quick = root.setInterval(function () { if (!holding || P.data) return root.clearInterval(quick); drawWaiting(); }, 60); }
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
  else start();
  root.CBPractice = { settled: settled, hasData: function () { return !!P.data; }, isFirm: isFirm, hidesShopCards: hidesShopCards, start: start };
})(typeof window !== 'undefined' ? window : globalThis);
