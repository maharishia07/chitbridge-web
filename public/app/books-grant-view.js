/**
 * books-grant-view.js — ACC-176, THE AUDITOR'S SIDE: a member's books, READ ONLY.
 *
 * OWNS      the read-only books view an auditor opens from "My network" for one member store: the "Viewing <store> — read only" band, the back link, six reads (Trial balance · Profit and loss · Balance sheet · Day book · Who owes whom · Closed months) as CBLists
 * CALLED BY network-app.js ("Open books" on a member row that holds a live grant)
 * FLOW      mount(host, o) → GET /api/books/<read> with X-Books-For: <member> (the server checks the grant on every look and writes the log row) → rows + totals painted as the server sent them; a refusal is shown in the server's words
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * This screen has NO write control: nothing here adds, changes or exports a book. It paints what the server answered and computes nothing. A look the server refuses (a grant that ended, a part not open to an auditor)
 * is said in its own sentence, never as an empty table.
 *   CBBooksGrantView.mount(host, { call, member: { id, name }, onBack, mountList }) → { destroy }
 *
 * REUSE (named in the PR): CBList (via mountList) · CBBooksGrantApi (endpoints + header) · fmtMoney / CBMoney.decimals (money as the books screens paint it) · the page's own call (token, base, 401)
 */
(function (root) {
  'use strict';
  var viewState = { host: null, o: {}, report: 'tb', day: '', answer: null, why: null };
  var MONEY = 'money'; /* a column kind: the server's minor units, painted in the answer's currency */
  /** each read: its endpoint, how the day box maps to its question, the rows it lists and the totals it shows (names are the server's own keys) */
  var REPORTS = [
    { k: 'tb', label: 'Trial balance', ep: 'readTB', day: 'asOf', rows: function (a) { return a.rows || []; }, cols: [['code', 'Code'], ['name', 'Account'], ['group', 'Group'], ['dr_minor', 'Debit', MONEY], ['cr_minor', 'Credit', MONEY]], facts: [['total_dr_minor', 'Total debit'], ['total_cr_minor', 'Total credit']] },
    { k: 'pl', label: 'Profit and loss', ep: 'readPL', day: 'to', rows: function (a) { return side(a.income, 'Income').concat(side(a.expense, 'Expense')); }, cols: [['side', 'Type'], ['code', 'Code'], ['name', 'Account'], ['amount_minor', 'Amount', MONEY]], facts: [['total_income_minor', 'Income'], ['total_expense_minor', 'Expense'], ['profit_minor', 'Profit']] },
    { k: 'bs', label: 'Balance sheet', ep: 'readBS', day: 'asOf', rows: function (a) { return side(a.assets, 'Assets').concat(side(a.liabilities, 'Liabilities'), side(a.equity, 'Equity')); }, cols: [['side', 'Part'], ['code', 'Code'], ['name', 'Account'], ['amount_minor', 'Amount', MONEY]], facts: [['total_assets_minor', 'Assets'], ['total_liab_equity_minor', 'Liabilities and equity']] },
    { k: 'daybook', label: 'Day book', ep: 'readDaybook', day: 'both', rows: function (a) { return a.entries || []; }, cols: [['entry_no', 'Entry'], ['posting_date', 'Date'], ['event_type', 'Kind'], ['narration', 'What it was']], facts: [] },
    { k: 'dues', label: 'Who owes whom', ep: 'readDues', day: 'asOf', rows: function (a) { return a.parties || []; }, cols: [['name', 'Party'], ['side', 'Side'], ['balance_minor', 'Balance', MONEY], ['oldest_due', 'Oldest due']], facts: [['total_minor', 'Total']] },
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
  /** a figure the way the books screens paint it: the server's minor units, the currency's own decimals, never a guessed symbol */
  function minorWords(minor) {
    if (minor == null || minor === '') return '—';
    var code = viewState.answer && viewState.answer.currency;
    var places = root.CBMoney && root.CBMoney.decimals && code ? root.CBMoney.decimals(code) : NaN;
    return typeof root.fmtMoney === 'function' && isFinite(places) ? root.fmtMoney(Number(minor) / Math.pow(10, places), code) : String(minor);
  }
  function figure(row, column) {
    var v = row[column[0]];
    return column[2] === MONEY ? minorWords(v) : v == null || v === '' ? '—' : String(v);
  }
  /** the day box → the question each read takes (the server defaults every one to today) */
  function queryOf(report) {
    if (!viewState.day || !report.day) return {};
    if (report.day === 'both') return { from: viewState.day, to: viewState.day };
    var q = {};
    q[report.day] = viewState.day;
    return q;
  }

  /* ── the read ── */
  function load() {
    var report = current();
    return root.CBBooksGrantApi.run(viewState.o.call, report.ep, { query: queryOf(report), headers: headerOf() }).then(
      function (answer) {
        viewState.answer = answer;
        viewState.why = null;
      },
      function (failure) {
        if (failure.status === 401) throw failure;
        viewState.answer = null;
        viewState.why = failure.message || words("Couldn't open these books. Nothing was changed.");
      }
    );
  }
  function headerOf() {
    var h = {};
    h[root.CBBooksGrantApi.HEADER] = viewState.o.member.id;
    return h;
  }

  /* ── the screen ── */
  function tabs() {
    return REPORTS.map(function (r) {
      return (
        '<button data-cbsid="NET005-B02" type="button" id="bv_tab_' + r.k + '" class="act' + (viewState.report === r.k ? '' : ' quiet') + '" data-report="' + r.k + '" data-testid="bv-tab-' + r.k + '" aria-pressed="' + (viewState.report === r.k) + '">' + esc(words(r.label)) + '</button>'
      );
    }).join('');
  }
  function paint() {
    var report = current();
    viewState.host.innerHTML =
      '<div class="bv-band" role="status" data-testid="bv-band"><b>' + esc(words('Viewing')) + ' ' + esc(viewState.o.member.name) + ' — ' + esc(words('read only')) + '</b>' +
      '<button data-cbsid="NET005-B01" type="button" class="act quiet" id="bv_back" data-testid="bv-back">← ' + esc(words('Back to My network')) + '</button></div>' +
      '<div class="nw-acts" data-testid="bv-tabs" role="group" aria-label="' + esc(words('Books')) + '">' + tabs() +
      (report.day ? '<label class="sub" for="bv_day">' + esc(words('Day')) + '</label><input data-cbsid="NET005-I01" id="bv_day" class="inp" type="date" value="' + esc(viewState.day) + '" data-testid="bv-day">' : '') + '</div>' +
      (viewState.why ? '<div class="nw-why" id="bv_why" role="status" data-testid="bv-why">' + esc(viewState.why) + '</div>' : facts(report)) +
      '<div class="nw-list" id="bv_list" data-testid="bv-list"></div>';
    $('bv_back').onclick = viewState.o.onBack;
    Array.prototype.forEach.call(viewState.host.querySelectorAll('[data-report]'), function (button) {
      button.onclick = function () {
        viewState.report = button.getAttribute('data-report');
        reload().then(function () {
          $('bv_tab_' + viewState.report).focus();
        });
      };
    });
    if ($('bv_day')) $('bv_day').onchange = pickDay;
    if (!viewState.why) paintRows($('bv_list'), report);
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
  function paintRows(host, report) {
    var rows = report.rows(viewState.answer || {}).map(function (row, n) {
      return Object.assign({ _n: n }, row);
    });
    viewState.o.mountList(host, {
      key: 'books-grant-' + report.k,
      rows: function () {
        return rows;
      },
      id: function (row) {
        return row._n;
      },
      rowTid: function (row) {
        return 'bv-row-' + row._n;
      },
      columns: report.cols.map(function (column, i) {
        return {
          key: column[0],
          label: words(column[1]),
          prio: i < 3 || column[2] === MONEY ? 1 : 2,
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
      empty: { title: words('Nothing to show here'), body: words('These books have no entries for this day.') }
    });
  }
  function reload() {
    return load().then(paint, function () {
      if (viewState.o.onEnded) viewState.o.onEnded();
    });
  }
  function mount(host, o) {
    viewState = { host: host, o: o, report: 'tb', day: '', answer: null, why: null };
    reload();
    return {
      destroy: function () {
        host.innerHTML = '';
      }
    };
  }
  root.CBBooksGrantView = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
