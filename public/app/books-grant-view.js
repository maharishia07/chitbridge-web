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
  var PCT = 'pct'; /* a column kind: basis points, painted as a signed percent */
  var CMP_COLS = ['prior_minor', 'change_minor', 'change_bp']; /* the P&L's last-year columns: drawn only when the server read last year */
  var MONEY = 'money'; /* a column kind: the server's minor units, painted in the answer's currency */
  var ACTIONS = 'actions'; /* the adviser's seventh tab: the three queues */
  /** each read: its endpoint, how the day box maps to its question, the rows it lists and the totals it shows (names are the server's own keys) */
  /* the Day book's seven columns fit one 1366 screen beside the menu (Entry · Date · Kind · Party · ref · Amount · Evidence · Mark) */
  var DAYBOOK_W = { entry_no: 150, posting_date: 110, kind: 100, party_ref: 250, amount_minor: 120, evidence: 150, mark: 170, flag: 70, risk: 80, explain: 120 };
  var REPORTS = [
    { k: 'tb', label: 'Trial balance', ep: 'readTB', day: 'asOf', rows: function (a) { return a.rows || []; }, cols: [['code', 'Code'], ['name', 'Account'], ['group', 'Group'], ['dr_minor', 'Debit', MONEY], ['cr_minor', 'Credit', MONEY]], facts: [['total_dr_minor', 'Total debit'], ['total_cr_minor', 'Total credit']], drill: 'ledger' },
    { k: 'pl', label: 'Profit and loss', ep: 'readPL', day: 'to', rows: plRows, cols: [['side', 'Type'], ['code', 'Code'], ['name', 'Account'], ['amount_minor', 'Amount', MONEY], ['prior_minor', 'Last year', MONEY], ['change_minor', 'Change', MONEY], ['change_bp', '%', PCT], ['explain', 'Explain', 'explain']], facts: [['total_income_minor', 'Income'], ['total_expense_minor', 'Expense'], ['gross_profit_minor', 'Gross profit'], ['profit_minor', 'Profit']], drill: 'ledger' },
    { k: 'bs', label: 'Balance sheet', ep: 'readBS', day: 'asOf', rows: function (a) { return side(a.assets, 'Assets').concat(side(a.liabilities, 'Liabilities'), side(a.equity, 'Equity')).map(function (row) { return profitRow(row, a); }); }, cols: [['side', 'Part'], ['code', 'Code'], ['name', 'Account'], ['amount_minor', 'Amount', MONEY]], facts: [['total_assets_minor', 'Assets'], ['total_liab_equity_minor', 'Liabilities and equity']], drill: 'ledger' },
    { k: 'daybook', label: 'Day book', ep: 'readDaybook', day: 'both', rows: function (a) { return (a.entries || []).map(function (e) { return Object.assign({ amount_minor: root.CBBooksGrantDrill.amountOf(e), kind: root.dayBookKind(e), posted_by_words: root.CBBooksActing.postedByWords(e, true), party_ref: root.dayBookPartyRef(e) /* R70: the party and the document number, as the owner's Day book shows them */, recorded_text: recordedText(e), risk_list: riskWords(Object.assign({ amount_minor: root.CBBooksGrantDrill.amountOf(e) }, e)) /* the same row the filters judge (the amount is the debits) */ /* JET: the rules this entry trips (books-grant-filters.js riskOf), one definition each */ }, e); }); }, cols: [['entry_no', 'Entry'], ['posting_date', 'Date'], ['kind', 'Kind'], ['party_ref', 'Party · ref'], ['amount_minor', 'Amount', MONEY], ['evidence', 'Evidence', 'evidence'], ['mark', 'Mark', 'mark'], ['risk', 'Risk', 'risk'], ['flag', 'Saved', 'flag']], facts: [], drill: 'entry' },
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
  /** the P&L's rows: each ledger with last year, the change and its flag, all the server's (by_line); the flat lists only when by_line is absent */
  function plRows(a) {
    var heads = function (list) { return [].concat.apply([], (list || []).map(function (head) { return head.accounts || []; })); };
    var by = a.by_line || {}, inc = heads(by.income), exp = heads(by.expense);
    return side(inc.length ? inc : a.income, 'Income').concat(side(exp.length ? exp : a.expense, 'Expense'));
  }
  /** ASA 520: the one line that says what is highlighted, from the server's rule (nothing when last year was not read or the figures are hidden) */
  function cmpNote(report) {
    var a = viewState.answer, rule = a && a.over_rule;
    if (report.k !== 'pl' || !a || !a.compare || !rule || rule.pct_bp == null || rule.min_minor == null) return '';
    var amount = minorWords(rule.min_minor).replace(/[.,]0+$/, '');
    return '<style>.bv-over,.bv-over>*{background:var(--ask-t)}.bv-over-dot{color:var(--ask-i)}.bv-cmpnote{margin:6px 0;color:var(--muted);font-size:var(--fs-1,13px)}</style><div class="bv-cmpnote" data-cbsid="NET005-P03" data-testid="bv-cmp-note">' + esc(words('Highlighted') + ': ' + words('change of') + ' ' + rule.pct_bp / 100 + '% ' + words('and') + ' ' + amount + ' ' + words('or more')) + '</div>';
  }
  /** NET005-P05: under the Day book, the fixed hours and day counts the Risk column and its filters use (one sentence; not a setting) */
  function riskNote(report) {
    if (report.k !== 'daybook' || viewState.since) return '';
    return '<style>.bv-risk{display:inline-block;min-width:1.6em;text-align:center;border-radius:10px;padding:0 6px;background:var(--ask-t);color:var(--ask-i);font-weight:600}.bv-risknote{margin:6px 0;color:var(--muted);font-size:var(--fs-1,13px)}</style><div class="bv-risknote" data-cbsid="NET005-P05" data-testid="bv-risk-note">' + esc(words('Risk counts one point for each of: recorded after the period end · over 7 days late · at a weekend · after hours (8 pm to 7 am) · a round sum (multiple of 100) · no narration.')) + '</div>';
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
  /** the JET rules an entry trips (the filters file's riskOf, read with the period and currency on screen) */
  function riskWords(e) {
    var F = root.CBBooksGrantFilters;
    return F ? F.riskOf(e, viewState.period, viewState.answer && viewState.answer.currency, viewState.answer && viewState.answer.country) : [];
  }
  /** the Risk cell: the count, with the rules it counts as its title and as words for a reader; none = a dash */
  function riskCell(row) {
    var list = row.risk_list || [];
    return list.length ? '<span class="bv-risk" data-cbsid="NET005-P04" data-testid="bv-risk" role="img" aria-label="' + esc(list.length + ' ' + words('risks') + ': ' + list.join(', ')) + '" title="' + esc(list.join(', ')) + '">' + list.length + '</span>' : '—';
  }
  function figure(row, column) {
    var v = row[column[0]];
    if (column[2] === 'risk') return riskCell(row);
    if (column[2] === 'explain') return explainCell(row);
    if (column[2] === PCT) return v == null ? '—' : (Number(v) > 0 ? '+' : '') + (Number(v) / 100).toFixed(1) + '%';
    if (column[0] === 'change_minor') return changeCell(row, v);
    if (column[2] === MONEY) return narrowLabel(row, column, moneyCell(row, column[0], v));
    if (column[2] === 'mark') return viewState.mk.chip(row.entry_id);
    if (column[2] === 'flag') return viewState.fl ? viewState.fl.chip(row.entry_id, flagLabel(row)) : ''; /* CMP066: my own bookmark; never the client's, never the mark */
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
  /** the P&L's Change: a signed amount, with a quiet dot (and a word for a reader) when it is over the server's threshold; html, escaped here */
  function changeCell(row, v) {
    if (v == null || v === '') return '—';
    var dot = row.change_over ? '<span class="bv-over-dot" data-cbsid="NET005-P02" role="img" aria-label="' + esc(words('Highlighted')) + '" title="' + esc(words('Highlighted')) + '">●</span> ' : '';
    return dot + esc((Number(v) > 0 ? '+' : '') + minorWords(v));
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
  /** JET (ASA 560): "Year end · Dated after it" is pressed (the list's choice, or the address on the first read): the Day book reads the days after the period, through the same route */
  function afterYearEnd() {
    var F = root.CBBooksGrantFilters, chosen = viewState.dbf !== undefined ? viewState.dbf : F ? F.fromAddress(root.location.search) : {};
    return !!F && chosen.ye === 'dated';
  }
  /** the day box → the question each read takes (the server defaults every one to today) */
  function queryOf(report) {
    var period = viewState.period, after = report.k === 'daybook' && !viewState.day && afterYearEnd() && root.CBBooksGrantFilters.afterRange(period);
    if (report.k === 'daybook' && viewState.since) return { since: 'mine', limit: SINCE_LIMIT }; /* rank 10: the server reads this person's check point; no date range (a back-dated entry is the finding) */
    viewState.yeRead = !!after; /* JET: which days the Day book was read for, so a change of the Year end filter knows whether to read again */
    if (after) return after;
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
  /** fix1117 F3: the first screen is never an empty period. A client whose first financial year has not ended has no year under review (the api says null), and a year under review may hold no entries: either way the books open on the latest year that holds entries (the api's years, newest first), so "Checked 0 of 0 · Nothing to show" never greets a client with entries */
  function periodWithEntries(choices, review) {
    var years = (choices && choices.years) || [], busy = years.filter(function (y) { return Number(y.entries) > 0; })[0];
    var held = review && years.filter(function (y) { return y.fy === review.fy; })[0];
    if (review && (!held || Number(held.entries) > 0 || !busy)) return review;
    return busy ? { fy: busy.fy, from: busy.from, to: busy.to } : review;
  }
  function choose() {
    if (viewState.choices !== undefined || !alive()) return Promise.resolve();
    return root.CBBooksGrantApi.run(viewState.o.call, 'readPeriods', { query: { marks: 1 }, headers: root.CBBooksActing.headers() }).then(function (a) {
      viewState.choices = a || null;
      var named = root.CBPeriodPick.filled(viewState.period, a), review = a && a.under_review;
      review = periodWithEntries(a, review);
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
  /* ── rank 10: changed since my last check. The Day book can be read as "the entries posted since THIS person last pressed Mark as checked on this client" (api: GET /daybook?since=mine; the server holds the check point and
     the count, this page adds nothing up). Mark as checked sends back the watermark the list carried (seen_to), never a moment of its own. The act is the person's own (POST /api/books-grants/practice/baseline), never the client's. ── */
  var SINCE_LIMIT = 500, MARK_CODE = 'NET005-B09', TOGGLE_CODE = 'NET005-B08';
  function sinceAsked() {
    try { return new root.URLSearchParams(root.location.search).get('since') === 'mine'; } catch (failure) { if (root.cbQuiet) root.cbQuiet('books-grant:since', failure); return false; }
  }
  /** when and by whom an entry was posted (the server's recorded_at, shown in the shop day) */
  function recordedText(e) {
    return e && e.recorded_at ? root.shopDay(e.recorded_at) + (e.recorded_by ? ' · ' + e.recorded_by : '') : '';
  }
  /** the one control: Changed since my last check (a toggle on the Day book), and in that view the count and Mark as checked */
  function sinceBar() {
    var on = viewState.since, seen = viewState.seen, info = seen && seen.since;
    var toggle = '<button type="button" class="act quiet" id="bv_since" aria-pressed="' + on + '" data-cbsid="' + TOGGLE_CODE + '" data-testid="bv-since">' + esc(words(on ? 'Back to the period' : 'Changed since my last check')) + '</button>';
    var line = '';
    if (on && seen) {
      var n = Number(seen.total || 0), shown = ((viewState.answer && viewState.answer.entries) || []).length, whole = n <= shown, from = info && info.never ? words('your access began') : info && info.at ? root.shopDay(info.at) : '';
      line = '<span class="sub" data-testid="bv-since-line">' + esc(n + ' ' + words(n === 1 ? 'entry posted since' : 'entries posted since') + ' ' + from) + '</span>' +
        (n > 0 && !whole ? '<span class="sub" data-testid="bv-since-more">' + esc(words('Showing the newest') + ' ' + shown + '. ' + words('Mark as checked waits until every entry is listed.')) + '</span>' : '') +
        (n > 0 && whole ? '<button type="button" class="act" id="bv_mark_checked" data-cbsid="' + MARK_CODE + '" data-testid="bv-mark-checked">' + esc(words('Mark as checked')) + '</button>' : '');
    }
    return '<div class="bv-since" data-testid="bv-since-bar" role="group" aria-label="' + esc(words('Changed since my last check')) + '" style="display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0">' + toggle + line + '</div>';
  }
  /** the tab row carries the since toggle: one line at a laptop, never a row of its own */
  var TABROW_CSS = '<style>.bv-tabrow .act{white-space:nowrap}@media (max-width:700px){.bv-tabrow{row-gap:2px}}</style>';
  function setSince(on) {
    viewState.since = on;
    viewState.seen = null;
    if (root.history && root.history.replaceState) {
      try {
        var query = new root.URLSearchParams(root.location.search);
        if (on) query.set('since', 'mine'); else query.delete('since');
        root.history.replaceState(root.history.state, '', root.location.pathname + (query.toString() ? '?' + query.toString() : '') + (root.location.hash || ''));
      } catch (failure) { if (root.cbQuiet) root.cbQuiet('books-grant:since-address', failure); }
    }
    reload().then(function () { var b = $('bv_since'); if (b) b.focus(); });
  }
  /** Mark as checked: asks first (it sets this client's count to 0 for this person), names the client and the point; then the server stores it */
  function markChecked() {
    var seen = viewState.seen, name = (viewState.o.member && viewState.o.member.name) || words('this client');
    if (!seen || !seen.to || typeof root.CBConfirm !== 'function') return;
    var body = esc(words('Entries posted up to') + ' ' + root.shopDay(seen.to) + ' ' + words('will stop counting as changed. Anything posted after will still count.'));
    root.CBConfirm(words('Mark') + ' ' + name + ' ' + words('as checked?'), body, words('Mark as checked'), function () {
      root.CBBooksGrantApi.run(viewState.o.call, 'practiceBaseline', { body: { client: viewState.o.member.id, seen_to: seen.to } }).then(function () {
        if (root.toast) root.toast(words('Checked. Changes count from here.'));
        reload().then(function () { var b = $('bv_since'); if (b) b.focus(); });
      }, function (failure) {
        if (root.toast) root.toast((failure && failure.message) || words('We could not save that. Nothing was changed.'));
      });
    });
  }
  function wireSince() {
    if ($('bv_since')) $('bv_since').onclick = function () { setSince(!viewState.since); };
    if ($('bv_mark_checked')) $('bv_mark_checked').onclick = markChecked;
  }
  var flagsRead = null; /* the flags read of the Day book just answered (cap-flag.js load): readReport waits for it so the Saved column and its filter paint with the rows */
  function readReport(report) {
    return root.CBBooksGrantApi.run(viewState.o.call, report.ep, { query: queryOf(report), headers: root.CBBooksActing.headers() }).then(
      function (answer) {
        viewState.answer = answer;
        viewState.seen = report.k === 'daybook' && viewState.since && answer ? { to: answer.seen_to, total: answer.total, since: answer.since } : null; /* rank 10: the watermark of what this screen listed: Mark as checked sends it back */
        if (viewState.o.onRead) viewState.o.onRead(); /* the first books read answered 200: the seat the person chose may now be remembered */
        if (report.k === 'pl' && answer && answer.gross_profit) answer.gross_profit_minor = answer.gross_profit.gross_profit_minor; /* the server's gross profit, named like its other totals */
        viewState.why = null;
        if (report.k === 'daybook' && viewState.mk) viewState.mk.ingest(answer && answer.entries, answer); /* ACC-358: each entry carries its mark */
        if (report.k === 'daybook' && viewState.ev) viewState.ev.ingest(answer && answer.entries); /* CMP062: and its evidence */
        if (report.k === 'daybook' && viewState.fl) flagsRead = viewState.fl.load(((answer && answer.entries) || []).map(function (e) { return e.entry_id; }).filter(Boolean)); /* CMP066: my bookmarks of these entries, ONE read per 200; a failed read draws no chip rather than saying none */
        if (report.k === 'pl' && viewState.fa && answer && answer.compare) flagsRead = viewState.fa.load(plRows(answer).filter(function (r) { return r.change_over; }).map(explainId).filter(Boolean)); /* my explanations of the flagged lines, ONE read; a failed read draws no button rather than saying none */
        root.CBBooksActing.setCurrency(answer && answer.currency);
      },
      function (failure) {
        if (failure.status === 401) throw failure;
        viewState.answer = null;
        viewState.why = true; /* the frame says it (CBShell.readFailed); the server's raw word is never printed */
        viewState.failure = { status: failure.status || 0, detail: failure.status === 403 ? failure.message : '' };
      }
    ).then(function () { var held = flagsRead; flagsRead = null; return held; }); /* the page paints once the flags answered (or failed: never a reason to hold the books back) */
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
    var ctx = viewState.why ? '' : '<span class="bv-ctx" data-testid="bv-ctx">' + asAt(report) + (viewState.choices ? '' : periodLine(report)) + dayPick(report) + '</span>' + (viewState.why ? '' : lockLines(report)) + tabSelect(); /* the date the figures stand at, with its Day pick: one place, the header line; the period dropdown says the period, so the Period tag is only the fallback */
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
      (!viewState.why && report.k === 'daybook' ? TABROW_CSS + sinceBar() : '') /* fd1117: the since toggle (and, in that view, its count and Mark as checked) sits IN the tab row, not on a row of its own: the first entry stays under the ceiling */ +
      (viewState.why ? '' : '<span class="bv-totals">' + facts(report) + '</span>') + '</div>' +
      (viewState.why ? '<div class="nw-why" id="bv_why" data-testid="bv-why"></div>' : '') +
      '<div class="nw-list" id="bv_list" data-testid="bv-list"></div>' +
      (markable(report) ? '<div id="bv_marks" class="bv-marks" data-testid="bv-marks"></div>' : '') /* fd17: the slot keeps the bar's height before its answer comes; fd1117: the marks bar (count and All queries) sits UNDER the list with the notes, so the first data row stays where the ceiling holds it */ +
      (viewState.why ? '' : riskNote(report) + cmpNote(report)) /* under the list too: the first data row stays where the ceiling holds it */ +
      (viewState.why || report.k !== 'tb' ? '' : '<div id="bv_bank_tb">' + bankTbLine() + '</div>') /* RANK 9: the bank agreement of the day the trial balance is drawn at: UNDER the list, so the first data row stays where the w19 ceiling holds it */;
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
    wireBankTbLine();
    wireSince();
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
  /** my private bookmarks and notes on this client's entries (cap-flag.js): the page's own call and NO X-Books-For, so a flag lands in MY organisation, never the client's */
  function newFlags() {
    if (viewState.fl) viewState.fl.destroy();
    viewState.fl = root.CBFlag && viewState.o.call && viewState.o.member ? root.CBFlag.use({ call: viewState.o.call, kind: 'posting', entity: function () { return viewState.o.member.id; } }) : null;
    if (viewState.fl) viewState.fl.onChange(onFlagChange);
    if (viewState.fa) viewState.fa.destroy();
    viewState.fa = root.CBFlag && viewState.o.call && viewState.o.member ? root.CBFlag.use({ call: viewState.o.call, kind: 'account', entity: function () { return viewState.o.member.id; } }) : null;
  }
  /** NET005-P06: Explain on a flagged P&L change: my own note on the account line, for this period (cap-flag.js kind 'account'; the id is '<code>@<period end day>'). Never the client's, never a mark */
  function explainId(row) {
    var to = String((viewState.answer && viewState.answer.to) || '').slice(0, 10);
    return row.code && to ? String(row.code).toLowerCase() + '@' + to : '';
  }
  function explainOn() {
    return !!viewState.fa && !viewState.fa.off() && !!(viewState.answer && viewState.answer.compare);
  }
  function explainCell(row) {
    var id = explainId(row);
    return row.change_over && id && viewState.fa ? '<span data-cbsid="NET005-P06">' + viewState.fa.chip(id, String(row.name || row.code).replace(/[<>]/g, '').slice(0, 56) + ' · ' + root.shopDay(viewState.answer.to)) + '</span>' : '';
  }
  function flagsOn() {
    return !!viewState.fl && !viewState.fl.off();
  }
  /** the entry's words on the flag: number and day, plain text, at most 80 characters (the server keeps them as the label) */
  function flagLabel(row) {
    return String(row.entry_no || '') + (row.posting_date ? ' · ' + root.shopDay(row.posting_date) : '');
  }
  /** a flag changed: the chips repaint themselves; a list narrowed to Saved is drawn again so a row that no longer matches leaves it */
  function onFlagChange() {
    if (viewState.dbf && viewState.dbf.flag && alive()) paintList(current());
  }
  function newMarks() {
    newEvidence();
    newFlags();
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
  /** RANK 9: the bank agreement under the trial balance: the api's `bank` block drawn by the ONE function (CBBankTbLine, shared with the owner's tab); the sign-off is the client's own, read, never redone */
  function bankTbOptions() {
    var a = viewState.answer || {};
    return {
      money: function (minor, cur) { return root.CBBooksActing.figure(minor, cur || a.currency); }, day: function (iso) { return root.shopDay(iso); }, tx: words,
      txf: function (english, vars) { return words(english).replace(/\{(\w+)\}/g, function (whole, key) { return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole; }); },
      codes: { note: 'NET005-P01', open: 'NET005-B06', at: 'NET005-B07' }, ids: 'bv_tb_bank_',
      onDay: function (day) { viewState.day = day; reload(); },
      onOpen: function () {
        var from = a.fy_from || '', to = a.asOf || '', carry = '&view=tb' + (from && to ? '&fy=' + encodeURIComponent(from.slice(0, 4)) + '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) : '');
        root.location.assign(root.CBBooksActing.auditAddressOf(root.CBBooksActing.current().store, 'bank', carry));
      }
    };
  }
  function bankTbLine() {
    var a = viewState.answer;
    return a && a.bank && root.CBBankTbLine ? root.CBBankTbLine.html(a.bank, bankTbOptions()) : '';
  }
  function wireBankTbLine() {
    var host = $('bv_bank_tb'), a = viewState.answer;
    if (host && a && a.bank && root.CBBankTbLine) root.CBBankTbLine.wire(host, a.bank, bankTbOptions());
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
  /** W22 (fd17: ONE short tag in the header line, no row of its own): the firm's Months view, the lock as Xero's lock date reads it. The tag says the lock ("Locked to 31 Jan 2026" + the count of open gaps); the full sentence (Books start Jul 2025 · Locked to 31 Jan 2026 · Open: Feb 2026 (gap)) is its title and its aria-label. Every word and date is the server's (books_start, lock_date, gaps); months before the books start are not listed */
  function lockLines(report) {
    var a = viewState.answer;
    if (report.k !== 'periods' || !a || !a.books_start) return '';
    var names = typeof root.monthNames === 'function' ? root.monthNames('short') : [];
    var monthOf = function (m) { var at = String(m.start_date || ''); return (names[Number(at.slice(5, 7)) - 1] || at.slice(0, 7)) + ' ' + at.slice(0, 4); };
    var gaps = a.gaps || [], lock = a.lock_date ? words('Locked to') + ' ' + root.shopDay(a.lock_date) : words('Not locked from the books start');
    var full = [words('Books start') + ' ' + monthOf(a.books_start), lock].concat(gaps.length ? [words('Open') + ': ' + gaps.map(monthOf).join(', ') + ' (' + words('gap') + ')'] : []).join(' · ');
    var short = lock + (gaps.length ? ' · ' + gaps.length + ' ' + words('gap') : '');
    return '<span class="tag bv-lock" data-testid="bv-lock-lines" title="' + esc(full) + '" aria-label="' + esc(full) + '" data-full="' + esc(full) + '">' + esc(short) + '</span>';
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
    var a = viewState.answer || {}, date = viewState.day || a.shown_as_at || a.asOf || a.as_of || a.to || '', asked = report.day === 'asOf' ? queryOf(report).asOf : '', running = !viewState.day && a.shown_as_at && ((a.asOf && a.shown_as_at < a.asOf) || (asked && a.shown_as_at < asked)); /* fix1117 F5: the api caps asOf at the shop day, so the year's end we ASKED for is what says the year is still running */ /* F5: an unfinished year says the shop day the api carried (shown_as_at), never its end */
    if (report.k === 'pl' && a.from && a.to && !viewState.day) return '<span class="tag" data-testid="bv-for">' + esc(words('For')) + ' ' + esc(root.shopDay(a.from)) + ' – ' + esc(root.shopDay(a.to)) + '</span>'; /* W18: a profit and loss is for a period, never "as at" a day */
    return date && (report.k === 'tb' || report.k === 'pl' || report.k === 'bs' || report.k === 'dues') ? '<span class="tag" data-testid="bv-asat">' + esc(words('As at')) + ' ' + esc(root.shopDay(date)) + (running ? ' · ' + esc(words('year to date')) : '') + '</span>' : '';
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
    var config = Object.assign({ foldHead: true } /* a phone's head folds to one chip */, listConfig(report, rows));
    if (report.k === 'daybook') narrowDaybook(host, config);
    viewState.o.mountList(host, config);
    if (report.k === 'daybook') { wireDaybook(host, report); root.setTimeout(function () { rememberNarrowing(host); }, 0); }
  }
  /* ── A3C rank 3: review by exception. The Day book's Mark · Evidence · Type filters (books-grant-filters.js) on the one list control; the choice is remembered for this client and rides the address (&dbf_mark= &dbf_ev= &dbf_kind=) ── */
  function narrowDaybook(host, config) {
    var F = root.CBBooksGrantFilters;
    if (!F) return;
    var all = F.filtersFor(viewState.mk, { fl: flagsOn() ? viewState.fl : null, period: function () { return viewState.period; }, currency: function () { return viewState.answer && viewState.answer.currency; }, region: function () { return viewState.answer && viewState.answer.country; }, rows: function () { return (viewState.answer && viewState.answer.entries) || []; } });
    config.filters = all.filter(function (f) { return f.key !== 'mark' || markable({ k: 'daybook' }); });
    if (viewState.dbf === undefined) viewState.dbf = F.fromAddress(root.location.search); /* the first Day book of this client reads the address; later ones, what the person chose */
    var kept = {};
    config.filters.forEach(function (f) { if (viewState.dbf[f.key]) kept[f.key] = viewState.dbf[f.key]; });
    config.preset = { filt: kept };
  }
  /** after any press or change in the list: remember the narrowing and write it to the address (replace, never a new history entry) */
  function rememberNarrowing(host) {
    var F = root.CBBooksGrantFilters, inst = host.__cbl;
    if (!F || !inst || !inst.r) return;
    viewState.dbf = JSON.parse(JSON.stringify(inst.r.filt || {})); /* the list's own remembered choices (api.state() also needs its column choices, which a fresh list has not made) */
    if (afterYearEnd() !== !!viewState.yeRead && current().k === 'daybook' && !viewState.day) reload(); /* Year end · Dated after it is a different read (the days after the period): once per change, never in a loop */
    if (!root.history || !root.history.replaceState) return;
    try {
      var query = new root.URLSearchParams(root.location.search);
      F.paramNames().forEach(function (k) { query.delete(k); });
      var more = F.toAddress(viewState.dbf), text = query.toString() + (more ? (query.toString() ? '&' : '') + more : '');
      var url = root.location.pathname + (text ? '?' + text : '') + (root.location.hash || '');
      if (url !== root.location.pathname + root.location.search + (root.location.hash || '')) root.history.replaceState(root.history.state, '', url);
    } catch (failure) { if (root.cbQuiet) root.cbQuiet('books-grant:narrowing', failure); }
  }
  /** A3C rank 8: on a focused Day book row "c" checks it and moves down, "q" opens its question; never while typing */
  function wireDaybook(host, report) {
    if (host.__bvKeys) return;
    host.__bvKeys = true;
    var settle = function () {
      if (!host.isConnected) { root.document.removeEventListener('change', settle); root.document.removeEventListener('click', settle); return; }
      root.setTimeout(function () { rememberNarrowing(host); }, 0);
    };
    root.document.addEventListener('change', settle); /* the Filters pop-up sits outside the list: listen on the page */
    root.document.addEventListener('click', settle);
    host.addEventListener('keydown', function (event) {
      var target = event.target, mk = viewState.mk;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !target || !target.closest) return;
      if (event.key !== 'c' && event.key !== 'q') return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable || !mk || !markable(report)) return;
      var rowEl = target.closest('[data-row]');
      if (!rowEl) return;
      var entry = report.rows(viewState.answer || {})[Number(rowEl.getAttribute('data-row'))];
      if (!entry || !entry.entry_id) return;
      event.preventDefault();
      if (event.key === 'q') { mk.sheet(entry.entry_id, { title: entry.entry_no, opener: rowEl }); return; }
      var rowsNow = [].slice.call(host.querySelectorAll('[data-row]')), next = rowsNow[rowsNow.indexOf(rowEl) + 1];
      if (mk.mayCheck(entry.entry_id) && mk.markOf(entry.entry_id).state === 'none') mk.set(entry.entry_id, 'clear', '', null);
      if (next) next.focus();
    });
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
    var member = viewState.o && viewState.o.member && viewState.o.member.name, heads = { customer: voice.customer, supplier: voice.supplier };
    /* fd17: ONE heading line per side; a side with nobody owing is that line plus its sentence (no list, no head), the sentence is still the side's own (bv-dues-customers / bv-dues-suppliers) */
    host.classList.add('bv-dues');
    host.innerHTML = ['customer', 'supplier'].map(function (who) {
      var empty = !all.some(function (row) { return row.side === who; }), tid = who === 'customer' ? 'customers' : 'suppliers', id = who === 'customer' ? 'bv_dues_c' : 'bv_dues_s';
      return '<div class="bv-dues-side' + (empty ? ' bv-dues-nil' : '') + '"><h3 class="sub" data-testid="bv-dues-' + tid + '-head">' + esc(heads[who]) + '</h3>' +
        (empty ? '<span class="tag" id="' + id + '" data-testid="bv-dues-' + tid + '">' + esc(duesNobody(member, who)) + '</span>' : '<div id="' + id + '" data-testid="bv-dues-' + tid + '"></div>') + '</div>';
    }).join('');
    ['customer', 'supplier'].forEach(function (who) {
      var parties = all.filter(function (row) { return row.side === who; }).map(agedRow);
      if (!parties.length) return; /* said in the heading line above */ /* E15: the server drops a party with nothing open; a side with no party is an empty sentence, never a lone Total row */
      var rows = (parties.length ? parties.concat(agedTotalRow(who, totals[who])) : []).map(function (row, n) { return Object.assign({ _n: n }, row); });
      var config = listConfig(report, rows);
      config.key = 'books-grant-dues-' + who;
      config.empty = { title: duesNobody(viewState.o && viewState.o.member && viewState.o.member.name, who) };
      viewState.o.mountList($(who === 'customer' ? 'bv_dues_c' : 'bv_dues_s'), Object.assign({ foldHead: true }, config));
    });
  }
  /** the Mark column is drawn only when the server says marking is on */
  function shownCols(report) {
    var last = report.k === 'pl' && viewState.answer && !viewState.answer.compare ? CMP_COLS : [];
    var cols = report.cols.filter(function (column) { return (column[2] !== 'mark' || markable(report)) && (column[2] !== 'flag' || flagsOn()) && (column[2] !== 'explain' || explainOn()) && last.indexOf(column[0]) < 0; });
    return report.k === 'daybook' && viewState.since ? cols.concat([['recorded_text', 'Posted']]) : cols; /* rank 10: the changed list says when and by whom each entry was posted */
  }
  /** the list's configuration for one report: its columns, search, drill and empty state */
  var SEARCH_FROM = 10, BAR_FROM = 12;
  function listConfig(report, rows) {
    return {
      key: 'books-grant-' + report.k,
      sortDefault: report.k === 'daybook' ? { key: 'risk', dir: -1 } : undefined /* auditor practice: the highest risk on top; a sort the reader chose is kept over it */,
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
          html: column[0] === 'change_minor' || column[2] === 'mark' || column[2] === 'flag' || column[2] === 'evidence' || column[2] === 'risk' || column[2] === 'explain' || column[0] === 'party_ref' || column[0] === 'lock_note',
          key: column[0],
          label: words(column[1]),
          prio: i === 0 || column[0] === 'name' || column[0] === 'party_ref' || (column[2] === MONEY && column[0] !== 'prior_minor') ? 1 : 2, /* Last year and % go first on a narrow screen: the amount and its change stay */
          num: column[2] === MONEY || column[2] === PCT || column[2] === 'risk',
          sort: column[2] === 'risk' ? true : undefined, dir0: column[2] === 'risk' ? -1 : undefined, /* Risk is the one Day book column the reader sorts: most risks first (the page opens that way; a press turns it) */
          keep: column[2] === 'mark' || column[2] === 'flag' || column[2] === 'evidence' || column[0] === 'party_ref', /* the Mark and Evidence chips and the Party · ref are never cut to make room (list-ctl keep) */
          w: DAYBOOK_W[column[0]] || (column[2] === 'mark' ? 190 : column[2] === MONEY ? 140 : 180),
          cell: function (row) {
            return figure(row, column);
          },
          value: function (row) {
            if (column[2] === 'risk') return (row.risk_list || []).length;
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
      rowClass: function (row) { return row.change_over ? 'bv-over' : ''; },
      onOpen: report.drill ? function (row) { drill(report, row); } : report.k === 'periods' ? function (row) { if (row.start_date && row.end_date) openMonth(String(row.start_date).slice(0, 10), String(row.end_date).slice(0, 10)); } : undefined, /* a Months row opens that month's Day book */
      empty: report.k === 'daybook' && viewState.since ? { title: words('Nothing has changed since your last check'), body: words('No entries were posted since then.') } : { title: words('Nothing to show here'), body: words(viewState.day || !viewState.range ? 'These books have no entries for this day.' : 'These books have no entries in this period.') }
    };
  }
  /** a row opens what is behind it (ACC-176c): an account's ledger (a code on the row), or the journal entry a Day book row is; books-grant-drill.js paints both, read only */
  function drill(report, row) {
    var ctx = { mk: viewState.mk, ev: viewState.ev, call: viewState.o.call, sheet: viewState.o.sheet, mountList: viewState.o.mountList, day: viewState.day, period: viewState.period /* D1 (A3C): the ledger opens on the period the trial balance was read for, not on this year to today */, currency: viewState.answer && viewState.answer.currency };
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
    viewState = { host: viewState.host, o: viewState.o, report: homeOf(viewState.o), day: '', answer: null, why: null, mk: viewState.mk, period: null, range: null, choices: undefined, since: false, seen: null };
    newMarks();
  }
  /** after Open books: focus lands on the books heading (the acting band), not on a button that has gone */
  function focusHeading() {
    var head = $('ba_band');
    if (!head) return; /* E18: no heading, no focus: the whole pane took a black outline */
    head.setAttribute('tabindex', '-1');
    head.focus();
  }
  function mount(host, options) {
    viewState = { host: host, o: options, report: viewKnown(options.view) ? options.view : homeOf(options), day: '', answer: null, why: null, mk: null, period: options.period || null, range: null, choices: undefined, since: sinceAsked(), seen: null };
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
