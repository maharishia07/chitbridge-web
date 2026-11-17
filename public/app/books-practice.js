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
  /* l16 n12: what a firm with no trade of its own KEEPS of the shop's Home, by id: its own Setup (the business, account, plan, policy, privacy, standards, connectors). Everything else is shop: every other card, so
     every area that would hold only those cards (the left rail), and the two shop panels named by id here: 'sides' (We lean on / Leans on us) and 'rail' (Your work). ONE list, ONE test (hidesShopCards). */
  var FIRM_KEEPS = { shop: 1, account: 1, plan: 1, governance: 1, privacy: 1, standards: 1, connectors: 1 };
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
      if (r.status === 429 || r.status >= 500) return { failed: true, status: r.status }; /* l16 W5: rate-limited or failing is NOT "no practice": the caller must not decide "a shop" from it */
      if (!r.ok) return null; /* a login that may not read the practice (403) or a server without it: nothing is drawn */
      return r.json();
    });
  }
  /** a firm: it holds clients by live grants and has no trade of its own: the DATA says so (the server's own_trade), never a trade switch */
  function isFirm() {
    return !!(P.data && P.data.clients && P.data.clients.length && P.data.own_trade === false);
  }
  function hidesShopCards(id) {
    return isFirm() && !FIRM_KEEPS[id];
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
  /* REP-73 B6: ONE name per stage, on the tile, the filter chip, the filter's choices and the row. The last two stages say what the firm's country calls filing the return: the server sends them
     (lib/books-practice words, from the country pack's filingVerb: lodge · file); until it does the neutral words stand. Never a country branch here. */
  var STAGE_WORDS = { books_in: 'Books in', complete: 'Complete', checked: 'Checked', ready: 'Ready to file', lodged: "Filed (owner's word)" };
  function stageWord(key) {
    var w = (P.data && P.data.words) || {};
    return key === 'ready' && w.ready ? w.ready : key === 'lodged' && w.done ? w.done : STAGE_WORDS[key] || key;
  }
  var TILE = {
    books_in: ['Books in', { stage: 'books_in' }], complete: ['Complete', { stage: 'complete' }], checked: ['Checked', { stage: 'checked' }], ready: ['Ready to file', { stage: 'ready' }], lodged: ["Filed (owner's word)", { stage: 'lodged' }],
    bas_due_30: ['Due in 30 days', { bas: 'soon' }],
    queries_on_us: ['Queries on us', { queries: 'us' }], queries_over_14: ['Waiting over 14 days', { queries: 'over14' }], bank_unexplained: ['Bank not explained', { bank: 'unexplained' }], to_check: ['Clients with entries to check (quarter)', { checked: 'behind' }], months_unlocked: ['Clients with months to lock', { unlocked: 'yes' }],
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
  /* REP-66 (practice pictures, Athi 16 Nov): ONE small picture per band, drawn by CBDraw (the one chart helper), inside the tile grid's own free cell so the list never moves down.
     Every figure is a tile's n (the server's count); the picture adds nothing of its own and never invents a part: a tile with no count is left out. Its text equivalent is the svg <desc>
     and the visible caption under it. Year end: clients by CURRENT stage (the tiles sum to the clients). On us today: the work left, each part labelled in its own unit. */
  var PIC = {
    pipeline: { id: 'bp-pic-stage', title: 'Clients by year-end stage', unit: 'clients', parts: [['books_in', 'help'], ['complete', 'watch'], ['checked', 'watch'], ['ready', 'good'], ['lodged', 'good']] },
    on_us: { id: 'bp-pic-left', title: 'Work left on us', unit: '', parts: [['bank_unexplained', 'help'], ['to_check', 'watch'], ['months_unlocked', 'watch']] }
  };
  function picParts(shown, spec) {
    var byKey = {};
    shown.tiles.forEach(function (t) { byKey[t.key] = t; });
    return spec.parts.filter(function (p) { var t = byKey[p[0]]; return TILE[p[0]] && t && typeof t.n === 'number' && t.n > 0; }).map(function (p) {
      var n = byKey[p[0]].n, word = tx(STAGE_WORDS[p[0]] ? stageWord(p[0]) : TILE[p[0]][0]);
      return { kind: p[1], value: n, label: word + ': ' + n, key: p[0] };
    });
  }
  /* E17 (Athi 2 Nov: a code on every element): the practice pictures are on Home (HOM001), kind P = panel; CBDraw writes whichever codes it is passed (opts.codes). The same code on every part of a kind, as a tile row shares its code. */
  var PIC_CODES = { status: { chart: 'HOM001-P01', part: 'HOM001-P02', legend: 'HOM001-P03' }, strip: { chart: 'HOM001-P05', part: 'HOM001-P06', legend: 'HOM001-P07' },
    cmp: { chart: 'HOM001-P09', part: 'HOM001-P10', legend: 'HOM001-P11' }, pair: { chart: 'HOM001-P13', part: 'HOM001-P10', legend: 'HOM001-P11' } };
  /** the picture's colours for the theme on screen now (good / watch / bad have a dark set), measured by CBDraw itself; none when CBDraw cannot read the page */
  function paletteHere() {
    try { return root.CBDraw.paletteNow(null, root.document.getElementById('bp_practice') || root.document.documentElement); } catch (e) { return undefined; }
  }
  function pictureHTML(shown) {
    var spec = PIC[shown.key];
    if (!spec || !root.CBDraw) return '';
    var parts = picParts(shown, spec);
    if (!parts.length) return '';
    var narrow = root.innerWidth && root.innerWidth <= 700;
    var svg = root.CBDraw.statusBar(parts, { palette: paletteHere(), width: narrow ? 112 : 200, id: spec.id, tid: spec.id, codes: PIC_CODES.status, title: tx(spec.title), desc: parts.map(function (p) { return p.label; }).join(', ') });
    var total = parts.reduce(function (sum, p) { return sum + p.value; }, 0);
    return '<div class="bp-pic" style="--pw:' + (narrow ? 99 : 176) + '" data-testid="practice-pic" data-pic="' + esc(shown.key) + '" data-total="' + total + '">' + svg + '<span class="sub" data-cbsid="HOM001-P04" data-testid="practice-pic-count">' + esc(spec.unit ? total + ' ' + tx(spec.unit) : parts.map(function (p) { return p.value; }).join(' · ')) + '</span></div>';
  }
  /* REP-66b (year on year, Athi 16 Nov): sales this year to date against the same dates last year, drawn by CBDraw.compare from the figures the server carried on each client's health
     (sales_ytd_minor, sales_prev_ytd_minor, sales_yoy_pct, the dates and sales_yoy_state). This page adds, subtracts and divides nothing: it picks the rows by state, orders them by the carried change and prints
     money through money(). A client whose books stop early, whose last year is short or absent, or who holds two currencies is never ranked; the opened row says why in words. */
  var YOY_WORDS = { stale: 'Books in to', short_last_year: 'No full last year yet', no_last_year: 'No last year to compare yet', mixed: 'Two currencies: not compared' };
  function yoyDates(h) {
    return h && h.sales_yoy_from ? day(h.sales_yoy_from) + ' – ' + day(h.sales_yoy_to) + ' / ' + day(h.sales_prev_from) + ' – ' + day(h.sales_prev_to) : '';
  }
  function yoyWords(h) {
    var w = YOY_WORDS[h.sales_yoy_state];
    return w ? tx(w) + (h.sales_yoy_state === 'stale' ? ' ' + day(h.sales_through) : '') : '';
  }
  function yoyRow(r) {
    var h = r.health, cur = r.currency;
    return { label: r.name || String(r.entity_id).slice(0, 8), now: h.sales_ytd_minor, before: h.sales_prev_ytd_minor, changePct: h.sales_yoy_pct, state: h.sales_yoy_state,
      title: (r.name || '') + ' · ' + money(h.sales_ytd_minor, cur) + ' ' + tx('this year') + ' · ' + money(h.sales_prev_ytd_minor, cur) + ' ' + tx('last year') + ' · ' + yoyDates(h) };
  }
  /** chart 1: the listed clients whose sales fell most and rose most (only state ok; the bar is the carried change), the caption says how many of the list it shows */
  function yoyRanked(clients) {
    var ok = clients.filter(function (r) { return r.health && r.health.sales_yoy_state === 'ok' && r.health.sales_yoy_pct != null; });
    var by = function (sign) { return function (a, b) { return sign * (a.health.sales_yoy_pct - b.health.sales_yoy_pct); }; };
    return { fall: ok.filter(function (r) { return r.health.sales_yoy_pct < 0; }).sort(by(1)), rise: ok.filter(function (r) { return r.health.sales_yoy_pct > 0; }).sort(by(-1)) };
  }
  function compareHTML(data) {
    var clients = data.clients || [];
    if (!root.CBDraw || !root.CBDraw.compare || !clients.length) return '';
    var narrow = root.innerWidth && root.innerWidth <= 700, take = narrow ? 2 : 3, ranked = yoyRanked(clients), palette = paletteHere();
    var first = clients.filter(function (r) { return r.health && r.health.sales_yoy_from; })[0];
    var one = function (list, id, title) {
      return list.length ? root.CBDraw.compare(list.slice(0, take).map(yoyRow), { palette: palette, codes: PIC_CODES.cmp, width: narrow ? 280 : 250, labelW: narrow ? 92 : 80, id: id, tid: id, title: tx(title), desc: tx(title) + ': ' + list.slice(0, take).map(function (r) { return yoyRow(r).title; }).join('; ') }) : '';
    };
    var svgs = one(ranked.fall, 'bp-cmp-fall', 'Sales down most on last year') + (narrow ? '' : one(ranked.rise, 'bp-cmp-rise', 'Sales up most on last year'));
    if (!svgs) return '';
    var shown = Math.min(take, ranked.fall.length) + (narrow ? 0 : Math.min(take, ranked.rise.length));
    return '<div class="bp-cmp" data-testid="practice-cmp" data-shown="' + shown + '" data-listed="' + clients.length + '"><span class="sub" data-cbsid="HOM001-P12" data-testid="practice-cmp-caption">' + esc(tx('Sales to date vs last year') + (first ? ' · ' + day(first.health.sales_yoy_from) + ' – ' + day(first.health.sales_yoy_to) : '') + ' · ' + shown + ' ' + tx('of') + ' ' + clients.length + ' ' + tx('clients listed')) + '</span><div class="bp-cmp-row">' + svgs + '</div></div>';
  }
  /** chart 2: this client's pair in the opened row, with the figures in words under it and the reason when there is no change */
  function pairHTML(r) {
    var h = r.health;
    if (!root.CBDraw || !root.CBDraw.compare || !h || h.sales_ytd_minor == null || !h.sales_yoy_state) return '';
    var row = yoyRow(r), reason = yoyWords(h);
    row.label = tx('Sales');
    var svg = root.CBDraw.compare([row], { palette: paletteHere(), codes: PIC_CODES.pair, mode: 'money', width: 340, labelW: 60, id: 'bp-pair-' + String(r.entity_id).slice(0, 8), tid: 'practice-pair-' + r.entity_id, title: tx('Sales this year and last year'), desc: row.title });
    return '<div class="bp-pair" data-testid="practice-pair-box-' + esc(r.entity_id) + '">' + svg + '<span class="sub" data-cbsid="HOM001-P14" data-testid="practice-pair-words-' + esc(r.entity_id) + '">' + esc(money(h.sales_ytd_minor, r.currency) + ' ' + tx('this year') + ' · ' + money(h.sales_prev_ytd_minor, r.currency) + ' ' + tx('last year') + (reason ? ' · ' + reason : '')) + '</span></div>';
  }
  /* REP-66: the opened row's months. The server's year_end carries how many months of the year are locked (the Month lock page's one rule, locked oldest first), so the first `locked` squares are locked and the rest open: no second read, no count made here. */
  function monthWords(y) {
    var start = String(y.start || '').slice(0, 7).split('-'), year = Number(start[0]), month = Number(start[1]) - 1, out = [];
    if (!year || month < 0) return null;
    for (var i = 0; i < y.of; i++) {
      var d = new Date(Date.UTC(year, month + i, 1));
      out.push({ label: new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(d), state: i < y.locked ? 'locked' : 'open' });
    }
    return out;
  }
  function stripHTML(r) {
    var y = r.year_end, months = y && !y.first_year && y.of > 0 ? monthWords(y) : null;
    if (!months || !root.CBDraw) return '';
    var words = { locked: tx('locked'), open: tx('open'), running: tx('running') };
    var svg = root.CBDraw.monthStrip(months, { id: 'bp-strip-' + String(r.entity_id).slice(0, 8), tid: 'practice-strip-' + r.entity_id, title: tx('Months locked'), codes: PIC_CODES.strip, words: words, labels: true, palette: paletteHere() });
    return '<div class="bp-strip" data-testid="practice-strip-box-' + esc(r.entity_id) + '">' + svg + '<span class="sub" data-cbsid="HOM001-P08" data-testid="practice-strip-count-' + esc(r.entity_id) + '">FY' + esc(String(y.fy).replace(/^dd(dd)/, '$1')) + ' · ' + esc(y.locked) + ' ' + esc(tx('of')) + ' ' + esc(y.of) + ' ' + esc(tx('months locked')) + '</span></div>';
  }
  /* A3P rank 6: the entries tile counts the work: the entries to check (the server's tile.entries), with the clients behind in its words; every other tile is its n. The filter under the tile is unchanged: its rows are the n clients. */
  function tileFigure(t) {
    return t.key === 'to_check' && typeof t.entries === 'number' ? Number(t.entries).toLocaleString() : t.n;
  }
  function tileWords(t, def) {
    if (t.key === 'to_check' && typeof t.entries === 'number') return tx('Entries to check') + ' · ' + t.n + ' ' + tx(t.n === 1 ? 'client' : 'clients');
    return tx(STAGE_WORDS[t.key] ? stageWord(t.key) : def[0]);
  }
  function bandHTML(data) {
    var bands = (data.band && data.band.bands) || [], shown = bandShown(data);
    if (!shown) return '';
    var tabs = bands.length > 1 ? '<div class="bp-bands" role="tablist" aria-label="' + esc(tx('Practice bands')) + '">' + bands.map(function (x) {
      return '<button type="button" role="tab" class="bp-bandtab' + (x.key === shown.key ? ' on' : '') + '" aria-selected="' + (x.key === shown.key) + '" data-cbsid="CMP036-D01" data-bp-band="' + esc(x.key) + '" data-testid="practice-band-' + esc(x.key) + '">' + esc(tx(BAND_NAME[x.key] || x.key)) + '</button>';
    }).join('') + '</div>' : '';
    var tiles = shown.tiles.filter(function (t) { return TILE[t.key]; }).map(function (t) {
      var def = TILE[t.key], on = sameFilter(P.filter, def[1]);
      return '<button type="button" class="bp-tile ' + esc(t.key) + (on ? ' on' : '') + '" data-cbsid="CMP060-D01" data-bp-filter="' + esc(JSON.stringify(def[1])) + '" aria-pressed="' + on + '"' + (t.key === 'lodged' ? ' title="' + esc(tx('Marked lodged by the owner: the returns were lodged outside these books, on the owner’s word')) + '"' : '') + ' data-testid="practice-tile-' + esc(t.key) + '"><b>' + esc(tileFigure(t)) + '</b><span>' + esc(tileWords(t, def)) + '</span></button>';
    }).join('');
    var note = shown.costs_not_shared ? '<p class="bp-note sub" data-testid="practice-costs-note">' + esc(shown.costs_not_shared) + ' ' + esc(tx('clients: costs not shared')) + '</p>' : '';
    return '<div class="bp-bandbox" data-testid="practice-band" data-band="' + esc(shown.key) + '" role="group" aria-label="' + esc(tx('Practice counts')) + '">' + tabs + '<div class="bp-band">' + tiles + (shown.key === 'advisory' ? compareHTML(data) : '') + '</div>' + note + '</div>';
  }
  function ruleHTML(rule) {
    return (
      '<p class="bp-rule sub" data-testid="practice-rule">' + esc(tx('Needs help')) + ': ' + esc(tx('cash under')) + ' ' + rule.help.cash_days_below + ' ' + esc(tx('days of bills')) + ', ' + esc(tx('sales down')) + ' ' + rule.help.sales_down_pct + '%, ' + esc(tx('loss')) + ' ' + rule.help.loss_months_running + ' ' + esc(tx('months running')) +
      '. ' + esc(tx('Watch')) + ': ' + esc(tx('sales down')) + ' ' + rule.watch.sales_down_pct + '%, ' + esc(tx('loss this quarter')) + '. ' + esc(tx('The firm can change this.')) + '</p>'
    );
  }
  /** the band on screen now: the server's first one until a tab is pressed */
  function bandNow() {
    return (P.data && bandShown(P.data) || {}).key || 'pipeline';
  }
  function statusCell(r) {
    /* A3P rank 1: on Year end the Status is a chip only (the reasons move to the opened row), so Due fits at 1366 */
    var why = bandNow() !== 'pipeline' && r.health.reasons && r.health.reasons.length ? ' <span class="sub">· ' + esc(r.health.reasons.slice(0, 2).join(' · ')) + '</span>' : '';
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
  /** the queries of a client in words: "2 waiting on client" · "1 on us" (with its age once over 14 days) · "—" */
  function queriesCell(r) {
    var q = r.queries, parts = [];
    if (!q.open) return '—';
    if (q.on_client) parts.push(esc(q.on_client) + ' ' + esc(tx('waiting on client')));
    if (q.on_us) parts.push(esc(q.on_us) + ' ' + esc(tx('on us')) + (q.waiting_over_14 ? ' <span class="sub">(' + esc(q.oldest_days) + ' ' + esc(tx('days')) + ')</span>' : ''));
    return parts.join(' · ');
  }
  /** the last year end's label for the header, from the server's own year_end (the pack's label as stored: '2025-26' → FY25-26) */
  function yearLabel() {
    var row = ((P.data && P.data.clients) || []).filter(function (r) { return r.year_end; })[0];
    return row ? 'FY' + String(row.year_end.fy).replace(/^dd(dd)/, '$1') : '';
  }
  /** the year-end cells: the same figures the Complete and Checked tiles count (the server's year_end), never the quarter */
  function yendCell(r) {
    var y = r.year_end;
    /* fix1117 F4: an older seed or a client with no year-end answer still reads: the stage when there is one, else the bank's own words (F2), never a bare dash */
    if (!y && !r.stage) return r.bank && r.bank.state === 'unexplained' ? esc(bankWords(r)) : '—';
    if (y && y.first_year) return esc(tx('First year'));
    if (!y) return '<span class="bp-yend" data-cbsid="HOM001-P16"><b data-testid="practice-stage-' + esc(r.entity_id) + '">' + esc(tx(stageWord(r.stage))) + '</b>' + blockerWords(r) + '</span>';
    var figures = esc(y.locked) + '/' + esc(y.of) + ' ' + esc(tx('locked')) + ' · ' + (y.bank_to_end ? esc(tx('bank to')) + ' ' + esc(shortDay(y.end)) : esc(bankWords(r)));
    /* F4 (17 Nov): ONE line per client, the stage and the one blocker; the figures sit in the title and one press away on the sheet (no second statement of the blocker, so the row is not two lines) */
    return r.stage ? '<span class="bp-yend" data-cbsid="HOM001-P16" title="' + esc(figures.replace(/<[^>]*>/g, '')) + '"><b data-testid="practice-stage-' + esc(r.entity_id) + '">' + esc(tx(stageWord(r.stage))) + '</b>' + blockerWords(r) + '</span>' : figures;
  }
  /** B1: what stands between the row and its next stage, in words, from the server's stage_blocker (never decided here): "· 3 months not locked" · "· no bank statement signed" · "· not checked" · "· 1 query open" */
  function blockerWords(r) {
    var y = r.year_end, b = r.stage_blocker, n;
    if (!b) return r.bank && r.bank.state === 'unexplained' ? ' · ' + esc(bankWords(r)) : ''; /* fix1117 F2: no blocker named, the bank's unexplained amount (the row's own field) still shows */
    if (b === 'months' && y) { n = y.of - y.locked; return ' · ' + esc(n) + ' ' + esc(tx(n === 1 ? 'month not locked' : 'months not locked')); }
    if (b === 'bank') return ' · ' + esc(bankWords(r));
    if (b === 'checked') return ' · ' + esc(tx('not checked'));
    if (b === 'queries') return ' · ' + esc(r.queries.open) + ' ' + esc(tx(r.queries.open === 1 ? 'query open' : 'queries open'));
    return '';
  }
  /** F1 (17 Nov): the bank's words from the one answer the Bank page reads (the client's newest sign-off, bank.state / unexplained_minor / reconciled_to): the same words the Bank page uses ('{a} unexplained' · 'Signed off to {d}'), never a second wording; 'bank not to year end' only when the answer carries no sign-off figure */
  function bankWords(r) {
    var b = r.bank || {};
    if (b.state === 'none') return tx('no bank statement signed');
    if (b.state === 'unexplained') return tx('{a} unexplained').replace('{a}', bankLeft(r));
    return b.reconciled_to ? tx('Signed off to {d}').replace('{d}', day(b.reconciled_to)) : tx('bank not to year end');
  }
  function shortDay(iso) {
    try { return new Date(String(iso).slice(0, 10) + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }); } catch (failure) { if (root.cbQuiet) root.cbQuiet('practice:shortday', failure); return day(iso); }
  }
  /** W3 (Athi, 16 Nov): the Checked cell says the share WITH the counts, so a big book's 50% pending is not read like a small one's; the share rounds DOWN and is never 100% unless every entry is checked */
  function checkedWords(e) {
    if (!e) return '—';
    if (!(e.of > 0)) return tx('No entries');
    if (e.checked >= e.of) return tx('All') + ' ' + e.of + ' ' + tx('checked');
    return Math.min(99, Math.floor((e.checked * 100) / e.of)) + '% · ' + e.checked + ' ' + tx('of') + ' ' + e.of;
  }
  /** entries still to check: the cell's sort, largest first (a client with no figure sorts last) */
  function checkedLeft(r) {
    var e = r.year_end && r.year_end.entries;
    return e ? e.of - e.checked : -1;
  }
  function checkedCell(r) {
    var e = r.year_end && r.year_end.entries;
    if (!e && r.checked && r.checked.of > 0) e = { checked: r.checked.n, of: r.checked.of }; /* fix1117 F4: no year-end answer, the quarter's own count */
    return e ? esc(checkedWords(e)) + (e.capped ? ' <span class="sub">' + esc(tx('over 5000')) + '</span>' : '') : '—';
  }
  /** what a client row opens to: the health figures read from the client's own books, each with its words; a figure the server holds back says so */
  /** B7: why a figure is not there, from the server's health.withheld: costs the grant does not show → "costs not shared"; more than one currency → said so; null otherwise (then "—" is no data). Never 0. */
  function withheldWord(r, notCosts) {
    var w = (r.health && r.health.withheld) || {};
    return w.costs && !notCosts ? tx('costs not shared') : w.currencies ? tx('more than one currency') : '';
  }
  /** notCosts: a figure no cost gate hides (the cash in bank): only a mixed currency explains its absence */
  function figureOrWhy(r, value, shown, notCosts) {
    return value == null ? esc(withheldWord(r, notCosts) || '—') : shown;
  }
  /* A3P rank 2: the opened Year end row is the year-end sheet: five facts from the row's own year_end, queries and bas (the figures in the cells, never a second read), each a link into that client with the year picked.
     Addresses come from CBBooksActing (the one place that builds them): the client's screen (&view=, &fy=) and the auditor's Bank. No year_end (books not on): one sentence, no link. */
  var SHEET_LINK = 'HOM001-P15';
  function sheetAddress(r, view) {
    var A = root.CBBooksActing, fy = r.year_end && r.year_end.fy;
    if (!A || !fy) return '';
    var carry = '&fy=' + encodeURIComponent(fy), store = { id: r.entity_id };
    return view === 'bank' ? A.auditAddressOf(store, 'bank', carry) : A.clientAddress(store, '&view=' + encodeURIComponent(view) + carry);
  }
  function sheetLine(r, key, label, value, view) {
    var href = sheetAddress(r, view), text = '<b>' + value + '</b>';
    return '<div class="bp-fig" data-testid="practice-sheet-' + key + '-' + esc(r.entity_id) + '"><span class="sub">' + esc(tx(label)) + '</span>' +
      (href ? '<a class="bp-link" href="' + esc(href) + '" data-cbsid="' + SHEET_LINK + '" data-testid="practice-sheet-go-' + key + '-' + esc(r.entity_id) + '">' + text + '</a>' : text) + '</div>';
  }
  function sheetHTML(r) {
    var y = r.year_end;
    if (!y) return '<p class="sub" data-testid="practice-sheet-none-' + esc(r.entity_id) + '">' + esc(tx('Books are not on for this client yet.')) + '</p>';
    var e = y.entries, q = r.queries, locked = esc(y.locked) + ' ' + esc(tx('of')) + ' ' + esc(y.of);
    return '<div class="bp-sheet" data-testid="practice-sheet-' + esc(r.entity_id) + '">' +
      sheetLine(r, 'months', 'Months locked', locked, 'periods') +
      sheetLine(r, 'bank', 'Bank to year end', y.bank_to_end ? esc(tx('Yes, to')) + ' ' + esc(shortDay(y.end)) : esc(tx('Not yet')), 'bank') +
      sheetLine(r, 'checked', 'Entries checked', e ? esc(e.checked) + ' ' + esc(tx('of')) + ' ' + esc(e.of) : '—', 'daybook') +
      sheetLine(r, 'queries', 'Queries', q.open ? queriesCell(r) : esc(tx('None')), 'daybook') +
      sheetLine(r, 'due', 'Return due', r.bas.due_date ? basCell(r) : esc(tx('No date')), 'periods') + '</div>';
  }
  function whyLine(r) {
    var h = r.health;
    return h.reasons && h.reasons.length ? '<p class="sub">' + esc(tx('Why')) + ': ' + esc(h.reasons.join(' · ')) + '</p>' : '';
  }
  function detailHTML(r, band) {
    if (band === 'pipeline') return '<div class="bp-detail" data-testid="practice-detail-' + esc(r.entity_id) + '">' + sheetHTML(r) + stripHTML(r) + pairHTML(r) + whyLine(r) + '</div>';
    var h = r.health, held = withheldWord(r) || tx('Not shown');
    var line = function (label, value) { return '<div class="bp-fig"><span class="sub">' + esc(tx(label)) + '</span><b>' + value + '</b></div>'; };
    return (
      '<div class="bp-detail" data-testid="practice-detail-' + esc(r.entity_id) + '">' + stripHTML(r) + pairHTML(r) +
      line('Sales vs 3-month average', esc(trend(r))) +
      line('Margin this quarter', figureOrWhy(r, h.gross_margin_pct, esc(h.gross_margin_pct) + '%')) +
      line('Cash and bank', figureOrWhy(r, h.cash_minor, esc(money(h.cash_minor, r.currency)), true)) +
      line('Bills due in 30 days', h.bills_due_30_minor == null ? esc(held) : esc(money(h.bills_due_30_minor, r.currency))) +
      line('Cash for those bills', h.bills_due_30_minor == null ? esc(held) : h.cash_days == null ? esc(tx('Covers them')) : esc(tx('Runs out in')) + ' ' + esc(h.cash_days) + ' ' + esc(tx('days'))) +
      line('Customers owe, over 60 days late', h.receivables_over60_minor == null ? esc(held) : esc(money(h.receivables_over60_minor, r.currency)) + (h.receivables_over60_share_pct == null ? '' : ' (' + esc(h.receivables_over60_share_pct) + '%)')) +
      line('Bank', r.bank.state === 'none' ? esc(tx('No statement')) : r.bank.state === 'reconciled' ? esc(tx('Reconciled')) + ' ' + esc(tx('to')) + ' ' + esc(day(r.bank.reconciled_to)) : esc(bankLeft(r)) + ' ' + esc(tx('unexplained'))) +
      line('Profit this quarter', figureOrWhy(r, h.profit_quarter_minor, esc(money(h.profit_quarter_minor, r.currency)))) +
      line('Months not locked', esc(r.months_unlocked)) +
      line('Access ends', esc(day(r.grant.expires_at))) +
      whyLine(r) +
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
  /* REP-73 B2: the columns follow the open band, so a tile counts something its rows show: Year end shows the stage and the year's figures; On us today shows the bank, the queries, the entries to check and the months to lock
     (the four tiles); Advice shows the figures its rules read. The page knows which columns a band opens with; the server decides which band exists and what each tile counts. */
  var BAND_COLS = {
    pipeline: ['name', 'status', 'yend', 'checked', 'queries', 'bas'],
    on_us: ['name', 'status', 'bank', 'queries', 'tocheck', 'unlocked'],
    advisory: ['name', 'status', 'sales', 'margin', 'cash', 'profit']
  };
  function columns() {
    var num = function (key, label, w, cell, value, extra) {
      return Object.assign({ key: key, label: tx(label), prio: 2, w: w, sort: key, html: true, cell: cell, value: value }, extra || {});
    };
    return [
      { key: 'name', label: tx('Client'), prio: 1, w: 150, minw: 110, keep: true, stretch: true, sort: 'name', html: true, cell: function (r) { return '<a class="bp-link" href="/network.html?open=' + esc(encodeURIComponent(r.entity_id)) + '" data-cbsid="NET001-B04" data-bp-open="' + esc(r.entity_id) + '" data-testid="practice-open-' + esc(r.entity_id) + '">' + esc(r.name || r.entity_id.slice(0, 8)) + '</a>' + (isLast(r) ? ' <span class="bp-chip" data-cbsid="CMP033-B01" data-testid="practice-last-chip">' + esc(tx('Last opened')) + '</span>' : ''); }, value: function (r) { return r.name || ''; } },
      num('status', 'Status', bandNow() === 'pipeline' ? 150 : 260, statusCell, function (r) { return r.health.words; }, { prio: 1, keep: true, minw: 130, hfilter: 'status', sort: 'urgency' }),
      num('role', 'Role', 90, function (r) { return esc(tx(ROLE[r.role] || r.role)); }, function (r) { return r.role; }, {}),
      num('bank', 'Bank', 150, bankCell, function (r) { return r.bank.state; }, { hfilter: 'bank' }),
      num('queries', 'Queries', 120, queriesCell, function (r) { return r.queries.open; }),
      num('bas', 'Due', 120, basCell, function (r) { return r.bas.due_date || ''; }, { hfilter: 'bas' }),
      num('yend', 'Year end', 230, yendCell, function (r) { return r.year_end ? r.year_end.locked : -1; }, { prio: 1 }),
      num('checked', 'Checked ' + yearLabel(), 110, checkedCell, checkedLeft, { prio: 1, dir0: -1 }),
      num('tocheck', 'To check (qtr)', 100, function (r) { return esc(r.to_check == null ? r.checked.of - r.checked.n : r.to_check); }, function (r) { return r.to_check == null ? r.checked.of - r.checked.n : r.to_check; }, { hfilter: 'checked', prio: 2 }),
      num('unlocked', 'Months not locked', 90, function (r) { return esc(r.months_unlocked); }, function (r) { return r.months_unlocked; }, { hfilter: 'unlocked', prio: 3 }),
      num('sales', 'Sales trend', 90, function (r) { return esc(trend(r)); }, function (r) { return trend(r); }),
      num('margin', 'Margin', 80, function (r) { return figureOrWhy(r, r.health.gross_margin_pct, esc(r.health.gross_margin_pct) + '%'); }, function (r) { return r.health.gross_margin_pct == null ? '' : r.health.gross_margin_pct; }, { prio: 3 }),
      num('cash', 'Cash', 110, function (r) { return figureOrWhy(r, r.health.cash_minor, esc(money(r.health.cash_minor, r.currency)), true); }, function (r) { return r.health.cash_minor == null ? '' : r.health.cash_minor; }, { prio: 3 }),
      num('profit', 'Profit (qtr)', 110, function (r) { return figureOrWhy(r, r.health.profit_quarter_minor, esc(money(r.health.profit_quarter_minor, r.currency))); }, function (r) { return r.health.profit_quarter_minor == null ? '' : r.health.profit_quarter_minor; }, { prio: 3 }),
      num('ending', 'Ends', 100, function (r) { return esc(day(r.grant.expires_at)); }, function (r) { return r.grant.expires_at || ''; }, { hfilter: 'ending', prio: 3 }),
      num('look', 'Last look', 100, function (r) { return esc(day(r.last_look)); }, function (r) { return r.last_look || ''; })
    ];
  }
  /** A3P rank 1: the Year end band's work order: stage in the server's pipeline order (Books in first, Lodged last; a stage the list does not know, last), then the blocker, then the return due date, then the server's own order. */
  var BLOCKERS = ['months', 'bank', 'checked', 'queries'];
  function workOrder(a, b) {
    var stages = (((P.data && P.data.band) || {}).pipeline || []).map(function (x) { return x.key; });
    var at = function (list, key) { var i = list.indexOf(key); return i < 0 ? list.length : i; };
    var due = function (r) { return (r.bas && r.bas.due_date) || '9999'; };
    return at(stages, a.stage) - at(stages, b.stage) || at(BLOCKERS, a.stage_blocker) - at(BLOCKERS, b.stage_blocker) || (due(a) < due(b) ? -1 : due(a) > due(b) ? 1 : 0) || a._n - b._n;
  }
  function sorts(band) {
    var by = function (k, get, text) { return { key: k, label: tx(text), cmp: function (a, b) { var x = get(a), y = get(b); return typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : (x == null ? -1e18 : x) - (y == null ? -1e18 : y); } }; };
    return (band === 'pipeline' ? [{ key: 'pipeline', label: tx('Work order'), cmp: workOrder }] : []).concat([
      by('urgency', function (r) { return r._n; }, 'Most urgent first'),
      by('name', function (r) { return r.name || ''; }, 'Client'),
      by('bank', function (r) { return r.bank.unexplained_minor || 0; }, 'Bank unexplained'),
      by('queries', function (r) { return r.queries.open; }, 'Queries open'),
      by('bas', function (r) { return r.bas.due_date || '9999'; }, 'Return due'),
      by('checked', checkedLeft, 'Entries left to check (year end)'),
      by('yend', function (r) { return r.year_end ? r.year_end.locked : -1; }, 'Months locked (year end)'),
      by('unlocked', function (r) { return r.months_unlocked; }, 'Months not locked'),
      by('sales', function (r) { return r.health.sales_trend_pct; }, 'Sales vs 3-month average'),
      by('margin', function (r) { return r.health.gross_margin_pct; }, 'Gross margin'),
      by('cash', function (r) { return r.health.cash_minor; }, 'Cash and bank'),
      by('profit', function (r) { return r.health.profit_quarter_minor; }, 'Profit this quarter'),
      by('ending', function (r) { return r.grant.expires_at || ''; }, 'Access ends'),
      by('look', function (r) { return r.last_look || ''; }, 'Last look')
    ]);
  }
  function filters() {
    var f = function (key, label, options, match) { return { key: key, label: tx(label), all: tx('All'), options: options.map(function (o) { return { v: o[0], label: tx(o[1]) }; }), match: match }; };
    return [
      f('status', 'Status', [['good', 'Doing well'], ['watch', 'Watch'], ['help', 'Needs help'], ['none', 'Not enough books yet']], function (r, v) { return r.health.status === v; }),
      f('stage', 'Year end', ['books_in', 'complete', 'checked', 'ready', 'lodged'].map(function (k) { return [k, stageWord(k)]; }), function (r, v) { return r.stage === v; }),
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
  /* A3P rank 5: on Year end a client opens where its blocker is (the server's stage_blocker): months → Months · bank → Bank · not checked or a query → Day book, the year picked; no blocker or no year → the client as before */
  var BLOCKER_VIEW = { months: 'periods', bank: 'bank', checked: 'daybook', queries: 'daybook' };
  /* F3: a client whose blocker is entries opens the Day book already narrowed to them (the Day book's own Mark filter words, read from the address by books-grant-filters.js): not checked · queried */
  var BLOCKER_MARK = { checked: 'notchecked', queries: 'query' };
  function openBooks(id, band) {
    var r = band === 'pipeline' ? (P.data.clients || []).filter(function (x) { return String(x.entity_id) === String(id); })[0] : null;
    var to = r && r.stage_blocker && BLOCKER_VIEW[r.stage_blocker] ? sheetAddress(r, BLOCKER_VIEW[r.stage_blocker]) + (BLOCKER_MARK[r.stage_blocker] ? '&dbf_mark=' + BLOCKER_MARK[r.stage_blocker] : '') : '';
    root.location.href = to || '/network.html?open=' + encodeURIComponent(id);
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
    var bandKey = (bandShown(P.data) || {}).key || 'pipeline';
    if (root.CBList.reset) root.CBList.reset('practice-clients-' + bandKey);
    var rows = P.data.clients.map(function (r, n) { r._n = n; return r; });
    P.list = root.CBList.mount(host, {
      key: 'practice-clients-' + bandKey, t: tx, rows: function () { return rows; }, id: function (r) { return r.entity_id; }, rowTid: function (r) { return 'practice-row-' + r.entity_id; },
      columns: columns(), defaultCols: BAND_COLS[bandKey] || BAND_COLS.pipeline, next: function (r) { return detailHTML(r, bandKey); }, sorts: sorts(bandKey), filters: filters(), preset: P.filter ? { filt: P.filter } : { filt: {} },
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
      if (button) { ev.preventDefault(); openBooks(button.getAttribute('data-bp-open'), bandKey); }
    };
  }
  function css() {
    if (root.document.getElementById('bp_css')) return;
    var s = root.document.createElement('style');
    s.id = 'bp_css';
    s.textContent =
      '#bp_practice{margin:0 0 16px}#bp_practice h2{margin:0 0 6px;font-size:18px}.bp-band{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0}' +
      '.bp-tile{display:flex;flex-direction:column;gap:2px;text-align:left;padding:8px 10px;border:1px solid var(--line,#DDD6C6);border-radius:10px;background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer;min-height:44px}' +
      '.bp-tile b{font-size:20px;line-height:1.1}@media(max-width:700px){.bp-band{grid-template-columns:repeat(3,1fr);gap:6px}.bp-tile{padding:6px 8px;min-height:44px}.bp-tile b{font-size:18px}.bp-tile span{font-size:12px;line-height:1.15}}.bp-bands{display:flex;gap:6px;margin:4px 0}.bp-bandtab{border:1px solid var(--line,#DDD6C6);border-radius:999px;padding:4px 12px;background:var(--card,#fff);color:inherit;font:inherit;font-size:13px;cursor:pointer;min-height:32px}.bp-bandtab.on{background:var(--accent,#1b4d3e);color:var(--on-accent,#fff);border-color:var(--accent,#1b4d3e)}.bp-note{margin:2px 0}.bp-link{color:inherit;font-weight:600;text-decoration:underline}.bp-tile span{font-size:13px}.bp-tile i{font-style:normal;font-size:12px;color:var(--muted,#5a5646)}' +
      '.bp-yend{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bp-last{background:var(--amber-t,#FDF3DC)}.bp-chip{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:999px;border:1px solid var(--amber-b,#EFD39A);background:var(--amber-t,#FDF3DC);color:var(--amber-i,#7A5205);font-size:12px;font-weight:600;white-space:nowrap}' +
      '.bp-pic{display:flex;align-items:center;gap:8px;margin-inline-start:auto;flex:none;height:30px}.bp-pic svg{width:calc(var(--pw) * 1px)!important;height:30px!important;max-width:none;flex:none}.bp-pic .sub{font-size:12px;white-space:nowrap}.bp-strip{grid-column:1/-1;display:flex;flex-direction:column;gap:2px;padding:2px 0 6px}.bp-strip svg{max-width:340px}.bp-pair{grid-column:1/-1;display:flex;flex-direction:column;gap:2px;padding:2px 0 6px}.bp-pair svg{max-width:340px}.bp-cmp{grid-column:span 3;display:flex;flex-direction:column;gap:0;min-width:0;overflow:hidden}.bp-cmp .sub{font-size:11px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bp-cmp-row{display:flex;gap:12px}.bp-cmp svg{flex:none;max-width:none}@media(max-width:700px){.bp-cmp{grid-column:span 2}}@media(max-width:700px){.bp-pic .sub{display:none}}.bp-tile.on{outline:2px solid var(--accent,#1b4d3e)}.bp-tile.help b{color:var(--red,#9b1c1c)}.bp-tile.watch b{color:var(--amber,#8a5a00)}.bp-tile.good b{color:var(--green,#1b5e20)}.bp-tile.held{cursor:default;opacity:.85;border-style:dashed}' +
      '.bp-detail{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 16px;padding:8px 4px}.bp-fig{display:flex;justify-content:space-between;flex-wrap:wrap;gap:2px 8px;min-width:0}.bp-fig>b,.bp-fig>a{min-width:0;overflow-wrap:anywhere}#bp_list{height:min(70vh,640px);min-height:320px}@media(max-width:700px){#bp_list{height:80vh}}.bp-rule{margin:4px 0 8px}.bp-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:32px;margin:0 0 6px}.bp-head h2{margin:0}';
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
    var held = root.document.activeElement, heldId = held && section.contains(held) && held.getAttribute ? held.getAttribute('data-testid') : null; /* B3: where the keyboard was, put back after the redraw */
    var door = root.document.getElementById('bcd_card');
    if (door && door.parentNode) door.parentNode.removeChild(door);
    section.innerHTML =
      '<div class="bp-head"><h2>' + esc(tx('Your practice')) + ' · ' + esc(P.data.clients.length) + ' ' + esc(tx('clients')) + '</h2>' + (bandShown(P.data) ? pictureHTML(bandShown(P.data)) : '') +
      (P.filter ? '<button type="button" class="bp-bandtab bp-clear" data-cbsid="CMP014-B01" data-bp-clear="1" data-testid="practice-clear">' + esc(tx('Show all clients')) + '</button>' : '') + '</div>' + (bandShown(P.data) && bandShown(P.data).key === 'advisory' ? ruleHTML(P.data.rule) : '') + bandHTML(P.data) +
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
    if (heldId) {
      var back = section.querySelector('[data-testid="' + heldId + '"]') || section.querySelector('.bp-tile.on') || section.querySelector('.bp-tile');
      if (back && back.focus) back.focus();
    }
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
    /* l16 W5: while a known firm's practice read has failed, nothing decides "a shop": the cards keep waiting for the retry */
    if (P.failedFirm) return settledOnce;
    return root.Promise.race([settledOnce, new root.Promise(function (go) { root.setTimeout(function () { if (hintRaw() !== "0" && !P.data) return; go(false); /* a firm or a login not yet known keeps waiting on the frame and its retry */ }, ms || SETTLE_CEILING + 50); })]);
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
    hs.textContent = 'html.bp-hold [data-testid="shell-areas"],html.bp-hold [data-testid="shell-sidetools"],html.bp-hold #railbox{display:none!important}html.bp-hold .cbsh-nv:not([data-go="home"]){visibility:hidden}';
    (root.document.head || root.document.documentElement).appendChild(hs);
    root.setTimeout(function () { if (!P.failedFirm) release(); }, SETTLE_CEILING + 500);
  }
  /* l16 n12: a firm's Home draws neither the two side buttons (We lean on / Leans on us) nor the Your work strip: one class, set from the one rule, hides them with no flash (the hold above covers the wait) */
  function markFirm() {
    root.document.documentElement.classList.toggle('bp-firm', hidesShopCards('sides'));
  }
  var fs = root.document.createElement('style');
  fs.textContent = 'html.bp-firm [data-testid="shell-sidetools"],html.bp-firm .cbsh-side,html.bp-firm #railbox{display:none!important}html.bp-firm:not(.bp-setup) .cbsh-main[data-tab=home] .cbsh-sec.setup{display:none!important}'; /* W9: a firm's Home is its practice only: the folded "What it all stands on" holds only the cards FIRM_KEEPS names (its own Setup), so it is not drawn on Home; the Setup button reveals it (shell go) */
  (root.document.head || root.document.documentElement).appendChild(fs);
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
  /** l16 W5: a login known to be a firm (hint 1) whose practice read failed (429 / 5xx / no answer): a calm frame with a retry, never the shop Home. An unknown login keeps hold-then-decide. */
  function drawFailed() {
    dropWaiting();
    var areas = root.document.querySelector('[data-testid="shell-areas"]');
    if (!areas || root.document.getElementById('bp_failed')) return;
    var w = root.document.createElement('section');
    w.id = 'bp_failed';
    w.setAttribute('data-testid', 'practice-failed');
    w.setAttribute('role', 'alert');
    w.style.margin = '0 0 16px';
    /* a login known to be a firm is titled "Your practice"; a login the page does not know yet (a fresh browser) is titled "Home": the frame never claims what it has not been told */
    var title = hintRaw() === '1' ? tx('Your practice') : tx('Home');
    w.innerHTML = '<h2 style="margin:0 0 6px;font-size:18px">' + esc(title) + '</h2><div data-testid="practice-failed-frame"></div>';
    areas.parentNode.insertBefore(w, areas);
    root.CBShell.readFailed(w.lastChild, { what: tx('Your practice'), status: P.failStatus, retry: function () {
      P.failedFirm = false;
      P.token = null; /* the next tick reads again */
      var f = root.document.getElementById('bp_failed');
      if (f && f.parentNode) f.parentNode.removeChild(f);
      tick();
    } });
  }
  /** firm frame P0 (T1): only a login KNOWN to be a shop (hint 0) may paint shop cards when the practice read fails; a firm (hint 1) or a login not yet known (a fresh browser, no hint) stays held with the frame and its retry */
  function failedRead(status) {
    P.pending = false;
    P.failStatus = status || 0;
    if (hintRaw() !== '0') { P.failedFirm = true; drawFailed(); return; }
    settle(); /* a known shop: the shop Home, as before */
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
        if (answer && answer.failed === true) return failedRead(answer.status);
        if (!answer || !answer.clients || !answer.clients.length) { hint(false); return settle(); }
        P.data = answer;
        hint(answer.own_trade === false);
        markFirm();
        root.dispatchEvent(new root.Event('cb-practice'));
        settle();
        tick();
      }, function (failure) { if (root.cbQuiet) root.cbQuiet('practice:read', failure); failedRead(0); });
      /* a read that never answers is a failed read too (the 25 s hang): the frame, not the shop Home */
      root.setTimeout(function () { if (P.token === t && P.pending && !P.data && !P.failedFirm) failedRead(0); }, SETTLE_CEILING);
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
  root.CBPractice = { settled: settled, hasData: function () { return !!P.data; }, holding: function () { return holding; }, isFirm: isFirm, hidesShopCards: hidesShopCards, start: start, checkedWords: checkedWords, checkedLeft: checkedLeft,
    /* the pure pieces, for e2e/practice-rep73-fable.cjs (no browser): feed an answer, read the words */
    parts: { bankWords: bankWords, openBooks: openBooks, use: function (d) { P.data = d; P.band = null; P.filter = null; }, compareHTML: compareHTML, pairHTML: pairHTML, yendCell: yendCell, detailHTML: detailHTML, sorts: sorts, statusCell: statusCell, workOrder: workOrder, sheetHTML: sheetHTML, pictureHTML: pictureHTML, stripHTML: stripHTML, columns: columns, filters: filters, bandHTML: bandHTML, stageWord: stageWord, BAND_COLS: BAND_COLS } };
})(typeof window !== 'undefined' ? window : globalThis);
