/**
 * books-grant-view.js — ACC-176, THE AUDITOR'S SIDE: a member's books, READ ONLY.
 *
 * OWNS      the books view a firm opens from "My network" for one member store: for an auditor the "Viewing <store> — read only" band, for an adviser the frozen "Acting for <store>, <currency>" banner (CBBooksActing) with its store switch and an "Actions" tab (the queues); the back link; six reads (Trial balance · Profit and loss · Balance sheet · Day book · Who owes whom · Closed months) as CBLists
 * CALLED BY network-app.js ("Open books" on a member row that holds a live grant)
 * FLOW      mount(host, o) → GET /api/books/<read> with the headers of CBBooksActing (the server checks the grant on every look and writes the log row) → rows + totals painted as the server sent them; a refusal is shown in the server's words
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * This screen has NO write control: nothing here adds, changes or exports a book (the adviser's writes live in books-actions-view.js, which this screen only mounts). It paints what the server answered and computes nothing. A look the server refuses (a grant that ended, a part not open to an auditor)
 * is said in its own sentence, never as an empty table.
 *   CBBooksGrantView.mount(host, { call, member: { id, name, role }, onBack, onSwitch, stores, mountList, sheet, closeSheet }) → { destroy }
 *
 * THE PERIOD (W8/W14/W15/W17/W18, Athi 16 Nov): ONE control (period-pick.js) at the right of the tabs line picks the year or a month for every read; the page opens on the year under review (the server's `under_review`) and the period rides the address (&fy= or &from=&to=). tb and bs read it as 'as at <to>', p&l and the day book as from – to.
 *
 * ACC-176c: a trial balance, profit and loss or balance sheet row opens that account's ledger; a Day book row opens its entry (books-grant-drill.js).
 *
 * REUSE (named in the PR): CBBooksGrantDrill · CBList (via mountList) · CBBooksGrantApi (endpoints) · CBBooksActing (headers, banner, figure) · CBBooksActionsView (the queues) · the page's own call (token, base, 401)
 */
(function (root) {
  'use strict';
  var viewState = { host: null, o: {}, report: 'tb', day: '', answer: null, why: null, mk: null, period: null, range: null, choices: undefined };
  /** where a reviewer lands: the auditor on the Day book (the entries are the job), the adviser on the trial balance */
  function viewKnown(k) {
    return k === ACTIONS || REPORTS.some(function (r) { return r.k === k; });
  }
  function homeOf(options) {
    return options && options.member && options.member.role === 'adviser' ? 'tb' : 'daybook';
  }
  var MONEY = 'money'; /* a column kind: the server's minor units, painted in the answer's currency */
  var ACTIONS = 'actions'; /* the adviser's seventh tab: the three queues */
  /** each read: its endpoint, how the day box maps to its question, the rows it lists and the totals it shows (names are the server's own keys) */
  /* the Day book's seven columns fit one 1366 screen beside the menu (Entry · Date · Kind · Party · ref · Amount · Evidence · Mark) */
  var DAYBOOK_W = { entry_no: 150, posting_date: 110, kind: 100, party_ref: 250, amount_minor: 120, evidence: 150, mark: 170 };
  var REPORTS = [
    { k: 'tb', label: 'Trial balance', ep: 'readTB', day: 'asOf', rows: function (a) { return a.rows || []; }, cols: [['code', 'Code'], ['name', 'Account'], ['group', 'Group'], ['dr_minor', 'Debit', MONEY], ['cr_minor', 'Credit', MONEY]], facts: [['total_dr_minor', 'Total debit'], ['total_cr_minor', 'Total credit']], drill: 'ledger' },
    { k: 'pl', label: 'Profit and loss', ep: 'readPL', day: 'to', rows: function (a) { return side(a.income, 'Income').concat(side(a.expense, 'Expense')); }, cols: [['side', 'Type'], ['code', 'Code'], ['name', 'Account'], ['amount_minor', 'Amount', MONEY]], facts: [['total_income_minor', 'Income'], ['total_expense_minor', 'Expense'], ['gross_profit_minor', 'Gross profit'], ['profit_minor', 'Profit']], drill: 'ledger' },
    { k: 'bs', label: 'Balance sheet', ep: 'readBS', day: 'asOf', rows: function (a) { return side(a.assets, 'Assets').concat(side(a.liabilities, 'Liabilities'), side(a.equity, 'Equity')).map(function (row) { return profitRow(row, a); }); }, cols: [['side', 'Part'], ['code', 'Code'], ['name', 'Account'], ['amount_minor', 'Amount', MONEY]], facts: [['total_assets_minor', 'Assets'], ['total_liab_equity_minor', 'Liabilities and equity']], drill: 'ledger' },
    { k: 'daybook', label: 'Day book', ep: 'readDaybook', day: 'both', rows: function (a) { return (a.entries || []).map(function (e) { return Object.assign({ amount_minor: root.CBBooksGrantDrill.amountOf(e), kind: root.dayBookKind(e), posted_by_words: root.CBBooksActing.postedByWords(e, true), party_ref: root.dayBookPartyRef(e) /* R70: the party and the document number, as the owner's Day book shows them */ }, e); }); }, cols: [['entry_no', 'Entry'], ['posting_date', 'Date'], ['kind', 'Kind'], ['party_ref', 'Party · ref'], ['amount_minor', 'Amount', MONEY], ['evidence', 'Evidence', 'evidence'], ['mark', 'Mark', 'mark']], facts: [], drill: 'entry' },
    { k: 'dues', label: 'Who owes whom', ep: 'readDues', day: 'asOf', rows: function (a) { return a.parties || []; }, cols: [['name', 'Party'], ['age_not_due', 'Current', MONEY], ['age_d0_30', '1–30', MONEY], ['age_d31_60', '31–60', MONEY], ['age_d61_90', '61–90', MONEY], ['age_d90_plus', '90+', MONEY], ['balance_minor', 'Total', MONEY]], facts: [], panels: true },
    { k: 'periods', label: 'Months', ep: 'readPeriods', day: null, rows: monthRows, cols: [['month', 'Month'], ['state', 'State'], ['lock_note', 'Locked by and when'], ['entries', 'Entries'], ['sales_minor', 'Sales', MONEY]], facts: [] }
  ];

  /** the months of the books the way the owner reads them: the month's name, a plain state, no index numbers (the opening balance row, period 0, is not a month) */
  function monthRows(answer) {
    var today = new Date().toISOString().slice(0, 10); /* months that have not begun are not the books yet */
    return ((answer && answer.periods) || []).filter(function (p) { return Number(p.period) >= 1 && !p.before_books && p.start_date && String(p.start_date).slice(0, 10) <= today; }).map(function (p) {
      var at = String(p.start_date).slice(0, 10), names = typeof root.monthNames === 'function' ? root.monthNames('long') : [];
      var who = root.CBLockWords ? root.CBLockWords.whoOf(p, p.status) : { line: '', note: '', all: [] }; /* W15-97: who locked it and when, who opened it again and why: the server's trail, read only */
      return Object.assign({}, p, { month: (names[Number(at.slice(5, 7)) - 1] || at.slice(0, 7)) + ' ' + at.slice(0, 4), state: root.CBLockWords ? root.CBLockWords.stateWord(p.status) : words(p.status), sales_minor: Number(p.sales_minor) > 0 ? p.sales_minor : null, lock_note: (who.all.length > 1 ? who.all : who.line ? [who.line] : []).concat(who.note ? [who.note] : []).map(function (line) { return '<div>' + esc(line) + '</div>'; }).join('') });
    });
  }
  /** W20: the balance sheet's profit line is the profit of the period it is read at: "Profit 1 Jul 2025 – 30 Jun 2026", not a bare "Profit for the year" (api fy_from and the as-at day) */
  function profitRow(row, a) {
    if (row.role !== 'profit_to_date' || !a.fy_from || !a.asOf) return row;
    return Object.assign({}, row, { name: words('Profit') + ' ' + root.shopDay(a.fy_from) + ' – ' + root.shopDay(a.asOf) });
  }
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function $(id) {
    return root.document.getElementById(id);
  }
  function side(list, name) {
    return (list || []).map(function (row) {
      return Object.assign({ side: words(name) }, row);
    });
  }
  function current() {
    return REPORTS.filter(function (r) {
      return r.k === viewState.report;
    })[0];
  }
  /** a figure in the answer's currency, the way the books screens paint it (CBBooksActing.money) */
  function minorWords(minor) {
    return root.CBBooksActing.figure(minor, (viewState.answer && viewState.answer.currency) || (root.CBBooksActing.current() || {}).currency);
  }
  /** a group key (trade_debtors, gst_and_statutory) as words */
  function groupWords(key) {
    var text = String(key).split('_').join(' ');
    return words(text.charAt(0).toUpperCase() + text.slice(1)).split('Gst').join('GST');
  }
  function figure(row, column) {
    var v = row[column[0]];
    if (column[2] === MONEY) return narrowLabel(row, column, moneyCell(row, column[0], v));
    if (column[2] === 'mark') return viewState.mk.chip(row.entry_id);
    if (column[0] === 'lock_note') return v || '—'; /* html built from the server's trail, each line escaped */
    if (column[0] === 'party_ref') return partyCell(row, v); /* one painter: the party · ref, and under it who posted it when an adviser did */
    if (column[2] === 'evidence') return viewState.ev ? viewState.ev.chip(row) : '—'; /* CMP062: what stands behind the row (cap-evidence.js) */
    if (v == null || v === '') return row._total ? '' : '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return root.shopDay(v); /* any day, whatever the column is called */
    return /^[a-z]+(_[a-z]+)+$/.test(String(v)) && column[0] !== 'name' ? groupWords(v) : String(v); /* a key (payment_received, soft_locked) as words */
  }
  /** the Party · ref cell (html, so escaped here): the text, and a second line "posted by …" only when the entry was posted by an adviser firm's person */
  function partyCell(row, v) {
    var text = v == null || v === '' ? '—' : String(v), by = row.posted_by_words ? '<div class="sub" data-testid="bv-posted-by">' + esc(words('posted') + ' ' + String(row.posted_by_words).replace(/^Posted /, '')) + '</div>' : '';
    return esc(text) + by;
  }
  /** W21: on a phone the aged table is a card of values, so each aged figure names its bucket ("1–30 A$220.00"); on a wide screen the column head does that */
  function narrowLabel(row, column, painted) {
    var narrow = typeof root.matchMedia === 'function' && root.matchMedia('(max-width: 600px)').matches;
    var aged = /^age_/.test(column[0]) || (column[0] === 'balance_minor' && viewState.report === 'dues');
    return narrow && painted && aged ? words(column[1]) + ' ' + painted : painted;
  }
  /** a money cell: a nil debit or credit is blank; a supplier's balance is what is owed (no minus) */
  function moneyCell(row, key, v) {
    if (key === 'sales_minor' && (v == null || v === '')) return words('No sales');
    if ((key === 'dr_minor' || key === 'cr_minor') && (v == null || v === '' || String(v) === '0')) return '';
    if (/^age_/.test(key) && v != null && Number(v) === 0) return ''; /* W21: an empty bucket is blank, as the leaders print it */
    if (/^age_/.test(key) && v == null) return '—';
    return minorWords(row.side === 'supplier' && key === 'balance_minor' ? String(Math.abs(Number(v))) : v);
  }
  /** the firm's "Actions" tab is open: the queues, not a read */
  function onActions() {
    return viewState.report === ACTIONS;
  }
  function isAdviser() {
    return viewState.o.member.role === 'adviser';
  }
  /** the day box → the question each read takes (the server defaults every one to today) */
  function queryOf(report) {
    var period = viewState.period;
    if (!viewState.day) {
      if (!period || !period.from || !report.day) return {};
      if (report.day === 'asOf') return { asOf: period.to }; /* tb, bs, dues: as at the end of the period */
      return { from: period.from, to: period.to }; /* p&l, day book: for the period */
    }
    if (report.day === 'both') return { from: viewState.day, to: viewState.day };
    var q = {};
    q[report.day] = viewState.day;
    return q;
  }

  /* ── the read ── */
  /** the period in force: the one value every read takes (and the Day book's `range`, kept as {from, to} for the marks and the empty line) */
  function usePeriod(period) {
    viewState.period = period;
    viewState.range = period && period.from ? { from: period.from, to: period.to } : null;
  }
  /** the choices of this client, read ONCE (GET /periods?marks=1: the year under review, each year, each month with its state and checked n of m); the period opens on the year under review unless the address named one */
  function choose() {
    if (viewState.choices !== undefined || !alive()) return Promise.resolve();
    return root.CBBooksGrantApi.run(viewState.o.call, 'readPeriods', { query: { marks: 1 }, headers: root.CBBooksActing.headers() }).then(function (a) {
      viewState.choices = a || null;
      var named = root.CBPeriodPick.filled(viewState.period, a), review = a && a.under_review;
      usePeriod(named || (review ? { kind: 'year', fy: review.fy, from: review.from, to: review.to } : null)); /* W15/W17: the year under review, never "this month" or "as at today" */
    }, function () { viewState.choices = null; usePeriod(viewState.period && viewState.period.from ? viewState.period : null); });
  }
  /** E16: a mark changes the dropdown's "checked n/m" lines too: the choices are read again (the server's own counts, the same GET /periods?marks=1) and the slot repainted, the period kept */
  function rereadChoices() {
    if (!alive() || !viewState.choices) return;
    root.CBBooksGrantApi.run(viewState.o.call, 'readPeriods', { query: { marks: 1 }, headers: root.CBBooksActing.headers() }).then(function (a) {
      if (!alive() || !a) return;
      viewState.choices = a;
      var report = current();
      if (report) fillPeriodSlot(report);
    }, function () { /* the lines stay as they were; the next open reads them fresh */ });
  }
  /** the period control mounts into the named slot of the header line (CBBooksActing.periodSlot, W19): ONE function, ONE call in paint(); moving it is changing that call. Nothing in a refused or Actions screen. */
  function fillPeriodSlot(report) {
    var slot = $('bv_period_slot');
    if (slot) slot.innerHTML = !report.k || viewState.why || !viewState.choices ? '' : root.CBPeriodPick.control(viewState.choices, viewState.period, pickPeriod);
  }
  /** a period chosen: every view follows it (the typed day is dropped), the address records it */
  function pickPeriod(period) {
    usePeriod(period);
    viewState.day = '';
    tell();
    reload().then(function () { var box = $('bv_period'); if (box) box.focus(); });
  }
  /** a Months row opens that month's Day book */
  function openMonth(from, to) {
    var row = ((viewState.choices && viewState.choices.periods) || []).filter(function (p) { return String(p.start_date).slice(0, 10) === from; })[0];
    usePeriod({ kind: 'month', fy: row ? row.fiscal_year : null, from: from, to: to });
    viewState.day = '';
    viewState.report = 'daybook';
    tell();
    reload();
  }
  /** GET /periods names no currency: a month's sales would print as a dash. The store's currency is learned once from the Day book's own answer (the period it opens on) */
  function knowCurrency() {
    var acting = root.CBBooksActing.current() || {};
    if (current().k !== 'periods' || acting.currency || !viewState.range) return Promise.resolve();
    return root.CBBooksGrantApi.run(viewState.o.call, 'readDaybook', { query: { from: viewState.range.from, to: viewState.range.to }, headers: root.CBBooksActing.headers() }).then(function (a) { root.CBBooksActing.setCurrency(a && a.currency); }, function () { /* no currency learned: the figures show a dash, never a wrong symbol */ });
  }
  function load() {
    if (onActions()) return Promise.resolve();
    var report = current();
    if (report.k === 'periods') viewState.choices = undefined; /* the Months list is read fresh each time it is opened */
    return choose().then(function () { return alive() ? knowCurrency() : null; }).then(function () { return !alive() ? null : report.k === 'periods' ? monthsOfPeriod() : readReport(report); });
  }
  /** the Months list: the months of the period's year, from the one read of the choices (no second trip) */
  function monthsOfPeriod() {
    var fy = viewState.period && viewState.period.fy;
    var c = viewState.choices || {};
    /* E4: the lock line (books_start, lock_date, gaps) is the same /periods answer's: carried across, or lockLines() finds nothing to draw */
    viewState.answer = { periods: (c.periods || []).filter(function (p) { return !fy || p.fiscal_year === fy; }), books_start: c.books_start || null, lock_date: c.lock_date || null, gaps: c.gaps || [] };
    viewState.why = null;
    return Promise.resolve();
  }
  function readReport(report) {
    return root.CBBooksGrantApi.run(viewState.o.call, report.ep, { query: queryOf(report), headers: root.CBBooksActing.headers() }).then(
      function (answer) {
        viewState.answer = answer;
        if (viewState.o.onRead) viewState.o.onRead(); /* the first books read answered 200: the seat the person chose may now be remembered */
        if (report.k === 'pl' && answer && answer.gross_profit) answer.gross_profit_minor = answer.gross_profit.gross_profit_minor; /* the server's gross profit, named like its other totals */
        viewState.why = null;
        if (report.k === 'daybook' && viewState.mk) viewState.mk.ingest(answer && answer.entries, answer); /* ACC-358: each entry carries its mark */
        if (report.k === 'daybook' && viewState.ev) viewState.ev.ingest(answer && answer.entries); /* CMP062: and its evidence */
        root.CBBooksActing.setCurrency(answer && answer.currency);
      },
      function (failure) {
        if (failure.status === 401) throw failure;
        viewState.answer = null;
        viewState.why = true; /* the frame says it (CBShell.readFailed); the server's raw word is never printed */
        viewState.failure = { status: failure.status || 0, detail: failure.status === 403 ? failure.message : '' };
      }
    );
  }

  /* ── the screen ── */
  /** a phone (the header's 700 px rule) holds the screen pick as ONE select, not seven buttons */
  function phone() {
    return typeof root.matchMedia === 'function' && root.matchMedia('(max-width: 700px)').matches;
  }
  function tabs() {
    if (phone()) return '';
    var all = REPORTS.map(function (r) {
      return { k: r.k, label: r.label };
    });
    if (isAdviser()) all.push({ k: ACTIONS, label: 'Actions' });
    return all.map(function (r) {
      return (
        '<button data-cbsid="NET005-B02" type="button" id="bv_tab_' + r.k + '" class="act' + (viewState.report === r.k ? '' : ' quiet') + '" data-report="' + r.k + '" data-testid="bv-tab-' + r.k + '" aria-pressed="' + (viewState.report === r.k) + '">' + esc(words(r.label)) + '</button>'
      );
    }).join('') + prepareButton() + bankButton();
  }
  /** the phone's screen pick: the library Select (ui-select.js, as period-pick.js uses) with the same screens as the buttons, and the Bank / Prepare ways as its last lines; the address follows the pick (onView) */
  function tabSelect() {
    if (!phone() || viewState.why || !root.ui || typeof root.ui.select !== 'function') return '';
    var options = REPORTS.map(function (r) { return { value: r.k, label: words(r.label) }; });
    if (isAdviser()) options.push({ value: ACTIONS, label: words('Actions') }, { value: '_prepare', label: words('Prepare a journal') });
    else options.push({ value: '_bank', label: words('Bank') });
    return '<span class="bv-tabsel" data-testid="bv-tabsel">' + root.ui.select({
      mount: 'NET005-U02', label: 'Books', bare: true, id: 'bv_tabsel', testid: 'bv-tab-select', value: viewState.report, options: options,
      onChange: function (value) {
        if (value === '_prepare') return openPrepare();
        if (value === '_bank') return openBank();
        viewState.report = value;
        tell();
        reload().then(function () { var box = $('bv_tabsel'); if (box) box.focus(); });
      }
    }) + '</span>';
  }
  /** W15-71: the auditor's way to the client's Bank (home, kept statements, a month's lines, who matched, the sign-off) and Month lock: the books page in the auditor's seat, read only */
  function bankButton() {
    return !isAdviser() && !viewState.why ? '<button data-cbsid="NET005-B02" type="button" class="act quiet" id="bv_bank" data-testid="bv-bank">' + esc(words('Bank')) + '</button>' : '';
  }
  function openBank() {
    var report = viewState.report, carry = (report ? '&view=' + encodeURIComponent(report) : '') + (viewState.period ? root.CBPeriodPick.toAddress(viewState.period) : ''); /* E10: the screen and the period ride to Bank and back */
    root.location.assign(root.CBBooksActing.auditAddressOf(root.CBBooksActing.current().store, 'bank', carry));
  }
  /** the adviser's way to prepare a journal: the owner's books page, opened to act for this store (CBBooksActing.addressOf), where Save prepares (or posts, when the owner's grant says adviser_posts) */
  function prepareButton() {
    return isAdviser() && !viewState.why ? '<button data-cbsid="NET005-B03" type="button" class="act" id="bv_prepare" data-testid="bv-prepare">' + esc(words('Prepare a journal')) + '</button>' : '';
  }
  function openPrepare() {
    root.location.assign(root.CBBooksActing.addressOf(root.CBBooksActing.current().store, 'journal'));
  }
  /** the band: an auditor is told it is read only; an adviser gets the frozen banner naming the store and its currency, with the store switch */
  function band(report) {
    var ctx = viewState.why ? '' : '<span class="bv-ctx" data-testid="bv-ctx">' + asAt(report) + (viewState.choices ? '' : periodLine(report)) + dayPick(report) + '</span>' + tabSelect(); /* the date the figures stand at, with its Day pick: one place, the header line; the period dropdown says the period, so the Period tag is only the fallback */
    root.CBBooksActing.css(); /* the one header line's rules, for the auditor's band too (the adviser's banner draws them itself) */
    if (isAdviser()) return root.CBBooksActing.banner(viewState.o.stores, screenName(), false, ctx);
    return (
      '<div class="bv-band" role="status" data-testid="bv-band">' + root.CBBooksActing.crumbs(screenName(), false) + '<span class="tag bv-ro" data-testid="bv-readonly">' + esc(words('read only')) + '</span>' + ctx + root.CBBooksActing.periodSlot() +
      '<button data-cbsid="NET005-B01" type="button" class="act quiet" id="bv_back" data-testid="bv-back">← ' + esc(words('Clients')) + '</button></div>'
    );
  }
  /** the name of the screen on show, for the breadcrumb */
  function screenName() {
    if (onActions()) return words('Queues');
    var r = REPORTS.filter(function (x) { return x.k === viewState.report; })[0];
    return r ? words(r.label) : '';
  }
  /** l16 R4-2b: a screen of the client's books is a history entry: the page is told (onView) so Back and Forward can restore it */
  function tell() {
    if (viewState.o.onView) viewState.o.onView(viewState.report, viewState.period);
  }
  function wireBand() {
    var back = function () { root.CBBooksActing.leave(); viewState.o.onBack(); };
    if (isAdviser()) root.CBBooksActing.wireBanner(viewState.host, { onBack: back, onSwitch: viewState.o.onSwitch });
    else $('bv_back').onclick = back;
  }
  /** the screen pick changes form at the phone width: repaint once when the width crosses it (bound once per page) */
  var breakpointBound = false;
  function followBreakpoint() {
    if (breakpointBound || typeof root.matchMedia !== 'function') return;
    breakpointBound = true;
    var query = root.matchMedia('(max-width: 700px)'), again = function () { if (viewState.host && viewState.host.isConnected && viewState.report) paint(); };
    if (query.addEventListener) query.addEventListener('change', again);
  }
  function paint() {
    followBreakpoint();
    var report = onActions() ? { day: null, facts: [] } : current();
    viewState.host.innerHTML =
      band(report) +
      '<div class="nw-acts bv-tabrow" data-testid="bv-tabs" role="group" aria-label="' + esc(words('Books')) + '">' + tabs() +
      (viewState.why ? '' : '<span class="bv-totals">' + facts(report) + '</span>') + '</div>' +
      (viewState.why ? '' : lockLines(report)) +
      (viewState.why ? '<div class="nw-why" id="bv_why" data-testid="bv-why"></div>' : '') +
      (markable(report) ? '<div id="bv_marks" data-testid="bv-marks"></div>' : '') +
      '<div class="nw-list" id="bv_list" data-testid="bv-list"></div>';
    wireBand();
    if (viewState.why && $('bv_why')) root.CBShell.readFailed($('bv_why'), { what: words('These books'), status: viewState.failure && viewState.failure.status, detail: viewState.failure && viewState.failure.detail, retry: function () { reload(); } });
    fillPeriodSlot(report);
    if ($('bv_prepare')) $('bv_prepare').onclick = openPrepare;
    if ($('bv_bank')) $('bv_bank').onclick = openBank;
    Array.prototype.forEach.call(viewState.host.querySelectorAll('[data-report]'), function (button) {
      button.onclick = function () {
        viewState.report = button.getAttribute('data-report');
        tell();
        reload().then(function () {
          $('bv_tab_' + viewState.report).focus();
        });
      };
    });
    if ($('bv_day')) $('bv_day').onchange = pickDay;
    if (onActions()) mountQueues();
    else if (!viewState.why) { paintList(report); paintMarkBar(report); }
  }
  /* ── ACC-358: marks (cap-mark.js, CMP058 the chip · CMP059 the sheet). The server's `mark_actions` says whether marking is on and who may set. ── */
  function markable(report) {
    return !!(report.k === 'daybook' && viewState.mk && viewState.mk.state().may);
  }
  var markBar = null;
  /** the list: the day book, or (All queries pressed) every open query with its age, across periods */
  function paintList(report) {
    if (viewState.queriesOnly && markable(report)) {
      var host = $('bv_list');
      host.innerHTML = viewState.mk.queries();
      Array.prototype.forEach.call(host.querySelectorAll('[data-mk-q]'), function (b) {
        b.onclick = function () { viewState.mk.sheet(b.getAttribute('data-mk-q'), { title: (b.querySelector('b') || {}).textContent, opener: b }); };
      });
    } else paintRows($('bv_list'), report);
  }
  function paintMarkBar(report) {
    markBar = null;
    if (!markable(report) || !$('bv_marks')) return;
    viewState.mk.bar($('bv_marks'), { onFilter: function (on) { viewState.queriesOnly = on; paintList(report); } }).then(function (handle) { markBar = handle; });
  }
  /** a mark set anywhere repaints the bar's count and, when All queries is open, its list */
  function onMarkChange() {
    rereadChoices();
    if (!markBar) return;
    markBar.refresh().then(function () { if (viewState.queriesOnly) paintList(current()); });
  }
  /** the evidence chips (cap-evidence.js): a file is read through the page's own token and base, with the seat's headers */
  function newEvidence() {
    viewState.ev = root.CBEvidence && viewState.o.raw ? root.CBEvidence.use({ raw: function (path) { return viewState.o.raw(path, root.CBBooksActing.headers()); } }) : null;
  }
  function newMarks() {
    newEvidence();
    if (viewState.mk) viewState.mk.destroy();
    viewState.queriesOnly = false;
    if (!root.CBMark || onActions()) { viewState.mk = null; return; }
    viewState.mk = root.CBMark.use({
      adopter: 'acc.audit',
      period: function () { return viewState.day ? { from: viewState.day, to: viewState.day } : viewState.range; },
      transport: function (method, path, body) {
        var headers = Object.assign({}, root.CBBooksActing.headers());
        if (method !== 'GET') headers['Idempotency-Key'] = (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : String(Date.now()) + Math.random());
        return viewState.o.call(method, path, body, headers);
      }
    });
    viewState.mk.onChange(onMarkChange);
  }
  /** the firm's queues, inside the list area, under the same banner */
  function mountQueues() {
    root.CBBooksActionsView.mount($('bv_list'), { call: viewState.o.call, mode: 'firm', mountList: viewState.o.mountList, sheet: viewState.o.sheet, closeSheet: viewState.o.closeSheet });
  }
  function pickDay() {
    viewState.day = $('bv_day').value;
    reload();
  }
  /** the period the Day book shows when no day is typed: "1 Oct 2026 – 31 Oct 2026" */
  function periodLine(report) {
    if (report.k !== 'daybook' || viewState.day || !viewState.range) return '';
    return '<span class="tag" data-testid="bv-period">' + esc(words('Period')) + ' ' + esc(root.shopDay(viewState.range.from)) + ' – ' + esc(root.shopDay(viewState.range.to)) + '</span>';
  }
  /** W22: the firm's Months view, the lock in ONE line as Xero's lock date reads: "Books start Jul 2025" · "Locked to 31 Jan 2026" · "Open: Feb 2026 (gap)" — every word and date the server's (books_start, lock_date, gaps); months before the books start are not listed */
  function lockLines(report) {
    var a = viewState.answer;
    if (report.k !== 'periods' || !a || !a.books_start) return '';
    var names = typeof root.monthNames === 'function' ? root.monthNames('short') : [];
    var monthOf = function (m) { var at = String(m.start_date || ''); return (names[Number(at.slice(5, 7)) - 1] || at.slice(0, 7)) + ' ' + at.slice(0, 4); };
    var lines = [['start', words('Books start') + ' ' + monthOf(a.books_start)], ['lock', a.lock_date ? words('Locked to') + ' ' + root.shopDay(a.lock_date) : words('Not locked from the books start')]];
    if ((a.gaps || []).length) lines.push(['gap', words('Open') + ': ' + a.gaps.map(monthOf).join(', ') + ' (' + words('gap') + ')']);
    return '<div class="nw-acts" data-testid="bv-lock-lines">' + lines.map(function (l) { return '<span class="tag" data-testid="bv-lock-' + l[0] + '">' + esc(l[1]) + '</span>'; }).join('') + '</div>';
  }
  function facts(report) {
    var items = report.facts
      .filter(function (f) {
        return viewState.answer && viewState.answer[f[0]] != null;
      })
      .map(function (f) {
        return '<span class="tag" data-testid="bv-fact-' + f[0] + '">' + esc(words(f[1])) + ': ' + esc(minorWords(viewState.answer[f[0]])) + '</span>';
      });
    return items.length ? '<span class="bv-facts" data-testid="bv-facts">' + items.join('') + '</span>' : '';
  }
  /** the server's own totals as a last row (nothing is added up here) */
  function totalRows(key, a) {
    var total = words('Total');
    if (key === 'tb' && a.total_dr_minor != null) return [{ _total: true, name: total, dr_minor: a.total_dr_minor, cr_minor: a.total_cr_minor }];
    if (key === 'pl' && a.profit_minor != null) return (a.gross_profit_minor != null ? [{ _total: true, name: words('Gross profit (sales less cost of sales)'), amount_minor: a.gross_profit_minor }] : []).concat([{ _total: true, name: words('Profit'), amount_minor: a.profit_minor }]);
    if (key === 'bs' && a.total_assets_minor != null) return [{ _total: true, side: words('Assets'), name: total, amount_minor: a.total_assets_minor }, { _total: true, side: words('Liabilities and equity'), name: total, amount_minor: a.total_liab_equity_minor }];
    return [];
  }
  /** a heading naming the date the figures stand at */
  function asAt(report) {
    var a = viewState.answer || {}, date = viewState.day || a.asOf || a.as_of || a.to || '';
    if (report.k === 'pl' && a.from && a.to && !viewState.day) return '<span class="tag" data-testid="bv-for">' + esc(words('For')) + ' ' + esc(root.shopDay(a.from)) + ' – ' + esc(root.shopDay(a.to)) + '</span>'; /* W18: a profit and loss is for a period, never "as at" a day */
    return date && (report.k === 'tb' || report.k === 'pl' || report.k === 'bs' || report.k === 'dues') ? '<span class="tag" data-testid="bv-asat">' + esc(words('As at')) + ' ' + esc(root.shopDay(date)) + '</span>' : '';
  }
  /** the Day pick (a report that can stand at one day) */
  function dayPick(report) {
    return report.day ? '<label class="sub" for="bv_day">' + esc(words('Day')) + '</label><input data-cbsid="NET005-I01" id="bv_day" class="inp" type="date" value="' + esc(viewState.day) + '" data-testid="bv-day">' : '';
  }
  function paintRows(host, report) {
    if (report.panels) return paintDues(host, report);
    var rows = report.rows(viewState.answer || {}).concat(totalRows(report.k, viewState.answer || {})).map(function (row, n) {
      return Object.assign({ _n: n }, row);
    });
    viewState.o.mountList(host, Object.assign({ foldHead: true } /* a phone's head folds to one chip */, listConfig(report, rows)));
  }
  /** W21: the two headings in the reader's voice: a firm reads "Customers owe <client>" and "<client> owes suppliers"; the owner's own books say you (no member = the owner) */
  function duesVoice(client) {
    return client ? { customer: words('Customers owe') + ' ' + client, supplier: client + ' ' + words('owes suppliers') } : { customer: words('Customers owe you'), supplier: words('You owe suppliers') };
  }
  /** E15: the empty side of Who owes whom in the reader's voice, as the owner's own Dues says it ("Nobody owes you money" · "You owe nobody") */
  function duesNobody(client, who) {
    if (who === 'customer') return client ? words('Nobody owes') + ' ' + client : words('Nobody owes you money');
    return client ? client + ' ' + words('owes nobody') : words('You owe nobody');
  }
  /** the aged figures of one row (the server's follow_up, days past due) as the table's columns */
  function agedRow(row) {
    var fu = row.follow_up || {};
    return Object.assign({}, row, { age_not_due: fu.not_due, age_d0_30: fu.d0_30, age_d31_60: fu.d31_60, age_d61_90: fu.d61_90, age_d90_plus: fu.d90_plus });
  }
  /** the total row of one side: the server's own aged_totals (nothing is added up here) */
  function agedTotalRow(who, total) {
    if (!total) return [];
    return [{ _total: true, name: words('Total'), side: who, age_not_due: total.not_due, age_d0_30: total.d0_30, age_d31_60: total.d31_60, age_d61_90: total.d61_90, age_d90_plus: total.d90_plus, balance_minor: total.balance_minor }];
  }
  /** Who owes whom: two aged tables, customers owe and the shop owes suppliers (Current · 1–30 · 31–60 · 61–90 · 90+ days past due), each with its total row, no net total */
  function paintDues(host, report) {
    var all = report.rows(viewState.answer || {}), voice = duesVoice(viewState.o && viewState.o.member && viewState.o.member.name), totals = (viewState.answer && viewState.answer.aged_totals) || {};
    host.innerHTML = '<h3 class="sub" data-testid="bv-dues-customers-head">' + esc(voice.customer) + '</h3><div id="bv_dues_c" data-testid="bv-dues-customers"></div><h3 class="sub" data-testid="bv-dues-suppliers-head">' + esc(voice.supplier) + '</h3><div id="bv_dues_s" data-testid="bv-dues-suppliers"></div>';
    ['customer', 'supplier'].forEach(function (who) {
      var parties = all.filter(function (row) { return row.side === who; }).map(agedRow); /* E15: the server drops a party with nothing open; a side with no party is an empty sentence, never a lone Total row */
      var rows = (parties.length ? parties.concat(agedTotalRow(who, totals[who])) : []).map(function (row, n) { return Object.assign({ _n: n }, row); });
      var config = listConfig(report, rows);
      config.key = 'books-grant-dues-' + who;
      config.empty = { title: duesNobody(viewState.o && viewState.o.member && viewState.o.member.name, who) };
      viewState.o.mountList($(who === 'customer' ? 'bv_dues_c' : 'bv_dues_s'), Object.assign({ foldHead: true }, config));
    });
  }
  /** the Mark column is drawn only when the server says marking is on */
  function shownCols(report) {
    return report.cols.filter(function (column) { return column[2] !== 'mark' || markable(report); });
  }
  /** the list's configuration for one report: its columns, search, drill and empty state */
  var SEARCH_FROM = 10, BAR_FROM = 12;
  function listConfig(report, rows) {
    return {
      key: 'books-grant-' + report.k,
      csv: false /* read only: no copy of the books leaves this screen */,
      tools: { search: rows.length >= SEARCH_FROM, bar: rows.length > BAR_FROM } /* W19: a short list is read at a glance; no search box under ten rows, no tools bar up to twelve (T6: first data by 20% / 30%) */,
      defaultCols: shownCols(report).map(function (column) { return column[0]; }) /* an auditor sees every column the server sent (Credit, Amount), not the list's first three */,
      rows: function () {
        return rows;
      },
      id: function (row) {
        return row._n;
      },
      rowTid: function (row) {
        return 'bv-row-' + row._n;
      },
      columns: shownCols(report).map(function (column, i) {
        return {
          html: column[2] === 'mark' || column[2] === 'evidence' || column[0] === 'party_ref' || column[0] === 'lock_note',
          key: column[0],
          label: words(column[1]),
          prio: i === 0 || column[0] === 'name' || column[0] === 'party_ref' || column[2] === MONEY ? 1 : 2,
          num: column[2] === MONEY,
          keep: column[2] === 'mark' || column[2] === 'evidence' || column[0] === 'party_ref', /* the Mark and Evidence chips and the Party · ref are never cut to make room (list-ctl keep) */
          w: DAYBOOK_W[column[0]] || (column[2] === 'mark' ? 190 : column[2] === MONEY ? 140 : 180),
          cell: function (row) {
            return figure(row, column);
          },
          value: function (row) {
            return row[column[0]] == null ? '' : String(row[column[0]]);
          }
        };
      }),
      search: function (row) {
        return report.cols
          .map(function (column) {
            return row[column[0]];
          })
          .join(' ');
      },
      onOpen: report.drill ? function (row) { drill(report, row); } : report.k === 'periods' ? function (row) { if (row.start_date && row.end_date) openMonth(String(row.start_date).slice(0, 10), String(row.end_date).slice(0, 10)); } : undefined, /* a Months row opens that month's Day book */
      empty: { title: words('Nothing to show here'), body: words(viewState.day || !viewState.range ? 'These books have no entries for this day.' : 'These books have no entries in this period.') }
    };
  }
  /** a row opens what is behind it (ACC-176c): an account's ledger (a code on the row), or the journal entry a Day book row is; books-grant-drill.js paints both, read only */
  function drill(report, row) {
    var ctx = { mk: viewState.mk, ev: viewState.ev, call: viewState.o.call, sheet: viewState.o.sheet, mountList: viewState.o.mountList, day: viewState.day, currency: viewState.answer && viewState.answer.currency };
    if (report.drill === 'entry') root.CBBooksGrantDrill.openEntry(ctx, row, ctx.currency, null);
    else if (row.code) root.CBBooksGrantDrill.openLedger(ctx, { code: row.code, name: row.name });
  }
  /** E9: the client is still open (CBBooksActing holds its context). After "← Clients" the context is gone: a read still in flight must neither be sent without the store's header nor paint a band that names it */
  function alive() {
    return !!root.CBBooksActing.current();
  }
  function reload() {
    var mine = viewState;
    return load().then(function () { if (alive() && viewState === mine) paint(); }, function () {
      if (viewState.o.onEnded) viewState.o.onEnded();
    });
  }
  var stopForgetting = null;
  /** the answer and the day of the store that was open are forgotten when the store changes */
  function forget() {
    viewState = { host: viewState.host, o: viewState.o, report: homeOf(viewState.o), day: '', answer: null, why: null, mk: viewState.mk, period: null, range: null, choices: undefined };
    newMarks();
  }
  /** after Open books: focus lands on the books heading (the acting band), not on a button that has gone */
  function focusHeading() {
    var head = $('ba_band') || viewState.host;
    head.setAttribute('tabindex', '-1');
    head.focus();
  }
  function mount(host, options) {
    viewState = { host: host, o: options, report: viewKnown(options.view) ? options.view : homeOf(options), day: '', answer: null, why: null, mk: null, period: options.period || null, range: null, choices: undefined };
    newMarks();
    root.CBBooksActing.enter({ id: options.member.id, name: options.member.name }, options.member.role === 'adviser' ? 'adviser' : 'auditor', options.member.posting);
    if (stopForgetting) stopForgetting();
    stopForgetting = root.CBBooksActing.onClear(forget);
    Promise.resolve(reload()).then(focusHeading, focusHeading);
    return {
      /** Back or Forward to another screen of this client's books */
      setView: function (report, period) {
        var moved = period !== undefined && !root.CBPeriodPick.same(period && period.from ? period : viewState.period, viewState.period);
        if (!viewKnown(report) || (report === viewState.report && !moved)) return;
        viewState.report = report;
        if (period !== undefined) usePeriod(root.CBPeriodPick.filled(period, viewState.choices) || period);
        reload();
      },
      destroy: function () {
        host.innerHTML = '';
      }
    };
  }
  root.CBBooksGrantView = { mount: mount, duesVoice: duesVoice };
})(typeof window !== 'undefined' ? window : globalThis);
