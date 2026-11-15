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
 * ACC-176c: a trial balance, profit and loss or balance sheet row opens that account's ledger; a Day book row opens its entry (books-grant-drill.js).
 *
 * REUSE (named in the PR): CBBooksGrantDrill · CBList (via mountList) · CBBooksGrantApi (endpoints) · CBBooksActing (headers, banner, figure) · CBBooksActionsView (the queues) · the page's own call (token, base, 401)
 */
(function (root) {
  'use strict';
  var viewState = { host: null, o: {}, report: 'tb', day: '', answer: null, why: null, mk: null };
  var MONEY = 'money'; /* a column kind: the server's minor units, painted in the answer's currency */
  var ACTIONS = 'actions'; /* the adviser's seventh tab: the three queues */
  /** each read: its endpoint, how the day box maps to its question, the rows it lists and the totals it shows (names are the server's own keys) */
  var REPORTS = [
    { k: 'tb', label: 'Trial balance', ep: 'readTB', day: 'asOf', rows: function (a) { return a.rows || []; }, cols: [['code', 'Code'], ['name', 'Account'], ['group', 'Group'], ['dr_minor', 'Debit', MONEY], ['cr_minor', 'Credit', MONEY]], facts: [['total_dr_minor', 'Total debit'], ['total_cr_minor', 'Total credit']], drill: 'ledger' },
    { k: 'pl', label: 'Profit and loss', ep: 'readPL', day: 'to', rows: function (a) { return side(a.income, 'Income').concat(side(a.expense, 'Expense')); }, cols: [['side', 'Type'], ['code', 'Code'], ['name', 'Account'], ['amount_minor', 'Amount', MONEY]], facts: [['total_income_minor', 'Income'], ['total_expense_minor', 'Expense'], ['profit_minor', 'Profit']], drill: 'ledger' },
    { k: 'bs', label: 'Balance sheet', ep: 'readBS', day: 'asOf', rows: function (a) { return side(a.assets, 'Assets').concat(side(a.liabilities, 'Liabilities'), side(a.equity, 'Equity')); }, cols: [['side', 'Part'], ['code', 'Code'], ['name', 'Account'], ['amount_minor', 'Amount', MONEY]], facts: [['total_assets_minor', 'Assets'], ['total_liab_equity_minor', 'Liabilities and equity']], drill: 'ledger' },
    { k: 'daybook', label: 'Day book', ep: 'readDaybook', day: 'both', rows: function (a) { return (a.entries || []).map(function (e) { return Object.assign({ amount_minor: root.CBBooksGrantDrill.amountOf(e) }, e); }); }, cols: [['entry_no', 'Entry'], ['posting_date', 'Date'], ['event_type', 'Kind'], ['narration', 'What it was'], ['amount_minor', 'Amount', MONEY], ['mark', 'Mark', 'mark']], facts: [], drill: 'entry' },
    { k: 'dues', label: 'Who owes whom', ep: 'readDues', day: 'asOf', rows: function (a) { return a.parties || []; }, cols: [['name', 'Party'], ['balance_minor', 'Balance', MONEY], ['oldest_due', 'Oldest due']], facts: [], panels: true },
    { k: 'periods', label: 'Closed months', ep: 'readPeriods', day: null, rows: function (a) { return a.periods || []; }, cols: [['fiscal_year', 'Year'], ['period', 'Month'], ['status', 'State'], ['entries', 'Entries'], ['sales_minor', 'Sales', MONEY]], facts: [] }
  ];

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
    return root.CBBooksActing.figure(minor, viewState.answer && viewState.answer.currency);
  }
  /** a group key (trade_debtors, gst_and_statutory) as words */
  function groupWords(key) {
    var text = String(key).split('_').join(' ');
    return words(text.charAt(0).toUpperCase() + text.slice(1)).split('Gst').join('GST');
  }
  function figure(row, column) {
    var v = row[column[0]];
    if (column[2] === MONEY) return moneyCell(row, column[0], v);
    if (column[2] === 'mark') return viewState.mk.chip(row.entry_id);
    if (v == null || v === '') return row._total ? '' : '—';
    return column[0] === 'group' ? groupWords(v) : String(v);
  }
  /** a money cell: a nil debit or credit is blank; a supplier's balance is what is owed (no minus) */
  function moneyCell(row, key, v) {
    if ((key === 'dr_minor' || key === 'cr_minor') && (v == null || v === '' || String(v) === '0')) return '';
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
    if (!viewState.day && report.k === 'daybook' && viewState.month) return { from: viewState.month + '-01', to: viewState.month + '-' + String(new Date(Number(viewState.month.slice(0, 4)), Number(viewState.month.slice(5, 7)), 0).getDate()) };
    if (!viewState.day || !report.day) return {};
    if (report.day === 'both') return { from: viewState.day, to: viewState.day };
    var q = {};
    q[report.day] = viewState.day;
    return q;
  }

  /* ── the read ── */
  /** the month of the books: the latest month the server lists, so the Day book does not open on an empty today */
  function findMonth() {
    if (viewState.month !== undefined) return Promise.resolve();
    return root.CBBooksGrantApi.run(viewState.o.call, 'readPeriods', { headers: root.CBBooksActing.headers() }).then(function (a) {
      var list = ((a && a.periods) || []).map(function (p) { return String(p.period || ''); }).filter(function (p) { return /^[0-9]{4}-[0-9]{2}$/.test(p); }).sort();
      viewState.month = list.length ? list[list.length - 1] : '';
    }, function () { viewState.month = ''; });
  }
  function load() {
    if (onActions()) return Promise.resolve();
    var report = current();
    return (report.k === 'daybook' ? findMonth() : Promise.resolve()).then(function () { return readReport(report); });
  }
  function readReport(report) {
    return root.CBBooksGrantApi.run(viewState.o.call, report.ep, { query: queryOf(report), headers: root.CBBooksActing.headers() }).then(
      function (answer) {
        viewState.answer = answer;
        viewState.why = null;
        if (report.k === 'daybook' && viewState.mk) viewState.mk.ingest(answer && answer.entries, answer); /* ACC-358: each entry carries its mark */
        root.CBBooksActing.setCurrency(answer && answer.currency);
      },
      function (failure) {
        if (failure.status === 401) throw failure;
        viewState.answer = null;
        viewState.why = failure.message || words("Couldn't open these books. Nothing was changed.");
      }
    );
  }

  /* ── the screen ── */
  function tabs() {
    var all = REPORTS.map(function (r) {
      return { k: r.k, label: r.label };
    });
    if (isAdviser()) all.push({ k: ACTIONS, label: 'Actions' });
    return all.map(function (r) {
      return (
        '<button data-cbsid="NET005-B02" type="button" id="bv_tab_' + r.k + '" class="act' + (viewState.report === r.k ? '' : ' quiet') + '" data-report="' + r.k + '" data-testid="bv-tab-' + r.k + '" aria-pressed="' + (viewState.report === r.k) + '">' + esc(words(r.label)) + '</button>'
      );
    }).join('') + prepareButton();
  }
  /** the adviser's way to prepare a journal: the owner's books page, opened to act for this store (CBBooksActing.addressOf), where Save prepares (or posts, when the owner's grant says adviser_posts) */
  function prepareButton() {
    return isAdviser() && !viewState.why ? '<button data-cbsid="NET005-B03" type="button" class="act" id="bv_prepare" data-testid="bv-prepare">' + esc(words('Prepare a journal')) + '</button>' : '';
  }
  function openPrepare() {
    root.location.assign(root.CBBooksActing.addressOf(root.CBBooksActing.current().store, 'journal'));
  }
  /** the band: an auditor is told it is read only; an adviser gets the frozen banner naming the store and its currency, with the store switch */
  function band() {
    if (isAdviser()) return root.CBBooksActing.banner(viewState.o.stores);
    return (
      '<div class="bv-band" role="status" data-testid="bv-band"><b>' + esc(words('Viewing')) + ' ' + esc(viewState.o.member.name) + ' — ' + esc(words('read only')) + '</b>' +
      '<button data-cbsid="NET005-B01" type="button" class="act quiet" id="bv_back" data-testid="bv-back">← ' + esc(words('Back to My network')) + '</button></div>'
    );
  }
  function wireBand() {
    var back = function () { root.CBBooksActing.leave(); viewState.o.onBack(); };
    if (isAdviser()) root.CBBooksActing.wireBanner(viewState.host, { onBack: back, onSwitch: viewState.o.onSwitch });
    else $('bv_back').onclick = back;
  }
  function paint() {
    var report = onActions() ? { day: null, facts: [] } : current();
    viewState.host.innerHTML =
      band() +
      '<div class="nw-acts" data-testid="bv-tabs" role="group" aria-label="' + esc(words('Books')) + '">' + tabs() +
      (report.day ? '<label class="sub" for="bv_day">' + esc(words('Day')) + '</label><input data-cbsid="NET005-I01" id="bv_day" class="inp" type="date" value="' + esc(viewState.day) + '" data-testid="bv-day">' : '') + '</div>' +
      (viewState.why ? '' : asAt(report)) +
      (viewState.why ? '<div class="nw-why" id="bv_why" role="status" data-testid="bv-why">' + esc(viewState.why) + '</div>' : facts(report)) +
      (markable(report) ? '<div id="bv_marks" data-testid="bv-marks"></div>' : '') +
      '<div class="nw-list" id="bv_list" data-testid="bv-list"></div>';
    wireBand();
    if ($('bv_prepare')) $('bv_prepare').onclick = openPrepare;
    Array.prototype.forEach.call(viewState.host.querySelectorAll('[data-report]'), function (button) {
      button.onclick = function () {
        viewState.report = button.getAttribute('data-report');
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
    if (!markBar) return;
    markBar.refresh().then(function () { if (viewState.queriesOnly) paintList(current()); });
  }
  function newMarks() {
    if (viewState.mk) viewState.mk.destroy();
    viewState.queriesOnly = false;
    if (!root.CBMark || onActions()) { viewState.mk = null; return; }
    viewState.mk = root.CBMark.use({
      adopter: 'acc.audit',
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
  function facts(report) {
    var items = report.facts
      .filter(function (f) {
        return viewState.answer && viewState.answer[f[0]] != null;
      })
      .map(function (f) {
        return '<span class="tag" data-testid="bv-fact-' + f[0] + '">' + esc(words(f[1])) + ': ' + esc(minorWords(viewState.answer[f[0]])) + '</span>';
      });
    return items.length ? '<div class="nw-acts" data-testid="bv-facts">' + items.join('') + '</div>' : '';
  }
  /** the server's own totals as a last row (nothing is added up here) */
  function totalRows(key, a) {
    var total = words('Total');
    if (key === 'tb' && a.total_dr_minor != null) return [{ _total: true, name: total, dr_minor: a.total_dr_minor, cr_minor: a.total_cr_minor }];
    if (key === 'pl' && a.profit_minor != null) return [{ _total: true, name: words('Profit'), amount_minor: a.profit_minor }];
    if (key === 'bs' && a.total_assets_minor != null) return [{ _total: true, side: words('Assets'), name: total, amount_minor: a.total_assets_minor }, { _total: true, side: words('Liabilities and equity'), name: total, amount_minor: a.total_liab_equity_minor }];
    return [];
  }
  /** a heading naming the date the figures stand at */
  function asAt(report) {
    var date = viewState.day || (viewState.answer && (viewState.answer.asOf || viewState.answer.as_of || viewState.answer.to)) || '';
    return date && (report.k === 'tb' || report.k === 'pl' || report.k === 'bs') ? '<h3 class="sub" data-testid="bv-asat">' + esc(words('As at')) + ' ' + esc(date) + '</h3>' : '';
  }
  function paintRows(host, report) {
    if (report.panels) return paintDues(host, report);
    var rows = report.rows(viewState.answer || {}).concat(totalRows(report.k, viewState.answer || {})).map(function (row, n) {
      return Object.assign({ _n: n }, row);
    });
    viewState.o.mountList(host, Object.assign({ foldHead: true } /* a phone's head folds to one chip */, listConfig(report, rows)));
  }
  /** Who owes whom: two panels, customers owe you and you owe suppliers, no net total */
  function paintDues(host, report) {
    var all = report.rows(viewState.answer || {});
    host.innerHTML = '<h3 class="sub">' + esc(words('Customers owe you')) + '</h3><div id="bv_dues_c" data-testid="bv-dues-customers"></div><h3 class="sub">' + esc(words('You owe suppliers')) + '</h3><div id="bv_dues_s" data-testid="bv-dues-suppliers"></div>';
    ['customer', 'supplier'].forEach(function (who) {
      var rows = all.filter(function (row) { return row.side === who; }).map(function (row, n) { return Object.assign({ _n: n }, row); });
      var config = listConfig(report, rows);
      config.key = 'books-grant-dues-' + who;
      viewState.o.mountList($(who === 'customer' ? 'bv_dues_c' : 'bv_dues_s'), Object.assign({ foldHead: true }, config));
    });
  }
  /** the Mark column is drawn only when the server says marking is on */
  function shownCols(report) {
    return report.cols.filter(function (column) { return column[2] !== 'mark' || markable(report); });
  }
  /** the list's configuration for one report: its columns, search, drill and empty state */
  function listConfig(report, rows) {
    return {
      key: 'books-grant-' + report.k,
      csv: false /* read only: no copy of the books leaves this screen */,
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
          html: column[2] === 'mark',
          key: column[0],
          label: words(column[1]),
          prio: i === 0 || column[0] === 'name' || column[2] === MONEY ? 1 : 2,
          num: column[2] === MONEY,
          w: column[2] === MONEY ? 140 : 180,
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
      onOpen: report.drill ? function (row) { drill(report, row); } : undefined,
      empty: { title: words('Nothing to show here'), body: words('These books have no entries for this day.') }
    };
  }
  /** a row opens what is behind it (ACC-176c): an account's ledger (a code on the row), or the journal entry a Day book row is; books-grant-drill.js paints both, read only */
  function drill(report, row) {
    var ctx = { mk: viewState.mk, call: viewState.o.call, sheet: viewState.o.sheet, mountList: viewState.o.mountList, day: viewState.day, currency: viewState.answer && viewState.answer.currency };
    if (report.drill === 'entry') root.CBBooksGrantDrill.openEntry(ctx, row, ctx.currency, null);
    else if (row.code) root.CBBooksGrantDrill.openLedger(ctx, { code: row.code, name: row.name });
  }
  function reload() {
    return load().then(paint, function () {
      if (viewState.o.onEnded) viewState.o.onEnded();
    });
  }
  var stopForgetting = null;
  /** the answer and the day of the store that was open are forgotten when the store changes */
  function forget() {
    viewState = { host: viewState.host, o: viewState.o, report: 'tb', day: '', answer: null, why: null, mk: viewState.mk };
    newMarks();
  }
  /** after Open books: focus lands on the books heading (the acting band), not on a button that has gone */
  function focusHeading() {
    var head = $('ba_band') || viewState.host;
    head.setAttribute('tabindex', '-1');
    head.focus();
  }
  function mount(host, options) {
    viewState = { host: host, o: options, report: 'tb', day: '', answer: null, why: null, mk: null };
    newMarks();
    root.CBBooksActing.enter({ id: options.member.id, name: options.member.name }, options.member.role === 'adviser' ? 'adviser' : 'auditor', options.member.posting);
    if (stopForgetting) stopForgetting();
    stopForgetting = root.CBBooksActing.onClear(forget);
    Promise.resolve(reload()).then(focusHeading, focusHeading);
    return {
      destroy: function () {
        host.innerHTML = '';
      }
    };
  }
  root.CBBooksGrantView = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
