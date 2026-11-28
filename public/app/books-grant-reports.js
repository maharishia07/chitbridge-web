/**
 * books-grant-reports.js — ACC-176 part of books-grant-view.js: the six reads and what stands over them.
 *
 * OWNS      the REPORTS table (Trial balance · Profit and loss · Balance sheet · Day book · Who owes whom · Months: endpoint, day rule, rows, columns, totals), the question each read takes (queryOf), and the header lines (the date the figures stand at, the period, the lock, the facts)
 * CALLED BY books-grant-view.js (through root.CBBooksGrantKit)
 * FLOW      kit.REPORTS[n].rows(answer) → the rows as the server sent them; kit.queryOf(report) → the address query of the read
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * Decides nothing and adds nothing up: totals are the server's own. Loaded before books-grant-view.js (network.html).
 */
(function (root) {
  'use strict';
  var grantKit = (root.CBBooksGrantKit = root.CBBooksGrantKit || {});
  grantKit.queryOf = queryOf;
  grantKit.lockLines = lockLines;
  grantKit.facts = facts;
  grantKit.totalRows = totalRows;
  grantKit.asAt = asAt;
  grantKit.dayPick = dayPick;
  grantKit.PCT = 'pct'; /* a column kind: basis points, painted as a signed percent */
  grantKit.DRCR = 'drcr'; /* a column kind: the trial balance's NET (debit positive), painted as an amount with Dr or Cr, never a minus */
  grantKit.MONEY = 'money'; /* a column kind: the server's minor units, painted in the answer's currency */
  grantKit.ACTIONS = 'actions'; /* the adviser's seventh tab: the three queues */
  /** each read: its endpoint, how the day box maps to its question, the rows it lists and the totals it shows (names are the server's own keys) */
  grantKit.REPORTS = [
    { k: 'dues', label: 'Who owes whom', ep: 'readDues', day: 'asOf', more: { control: '1' } /* FC-M10: the server also answers the trial-balance control */, rows: function (a) { return a.parties || []; }, cols: [['name', 'Party'], ['age_not_due', 'Current', grantKit.MONEY], ['age_d0_30', '1–30', grantKit.MONEY], ['age_d31_60', '31–60', grantKit.MONEY], ['age_d61_90', '61–90', grantKit.MONEY], ['age_d90_plus', '90+', grantKit.MONEY], ['balance_minor', 'Total', grantKit.MONEY]], facts: [], panels: true },
    { k: 'periods', label: 'Months', ep: 'readPeriods', day: null, rows: monthRows, cols: [['month', 'Month'], ['state', 'State'], ['lock_note', 'Locked by and when'], ['entries', 'Entries'], ['profit_minor', 'Profit', grantKit.MONEY]], facts: [] },
    /* YE-F-11: the client's tax return (BAS · VAT return), read from its posted books through GET /returns — a grant read; the box rows and the server's net, the stage in the header line (the server's one stage word) */
    { k: 'bas', label: 'Tax return', ep: 'readReturns', day: 'on', rows: basRows, cols: [['code', 'Box'], ['label', 'What'], ['amount_minor', 'Amount', grantKit.MONEY], ['tax_minor', 'Tax', grantKit.MONEY]], facts: [['net_minor', 'To pay or refund']] }
  ];

  /** a month's profit as the server sent it; when it sent none, the sales when there were any (else nothing) */
  function monthProfit(p) {
    if (p.profit_minor !== undefined && p.profit_minor !== null) return p.profit_minor;
    return Number(p.sales_minor) > 0 ? p.sales_minor : null;
  }
  /** who locked the month and when, who opened it again and why: one line each, the server's trail */
  function lockNoteHtml(who) {
    var lines = (who.all.length > 1 ? who.all : who.line ? [who.line] : []).concat(who.note ? [who.note] : []);
    return lines.map(function (line) { return '<div>' + esc(line) + '</div>'; }).join('');
  }
  /** the months of the books the way the owner reads them: the month's name, a plain state, no index numbers (the opening balance row, period 0, is not a month) */
  function monthRows(answer) {
    var today = new Date().toISOString().slice(0, 10); /* W4-13: only months that are OVER, the rule the year box and the practice read count by (a month still running is not work to lock yet) */
    return ((answer && answer.periods) || []).filter(function (p) { return Number(p.period) >= 1 && !p.before_books && p.end_date && String(p.end_date).slice(0, 10) < today; }).map(function (p) {
      var at = String(p.start_date).slice(0, 10), names = typeof root.monthNames === 'function' ? root.monthNames('long') : [];
      var who = root.CBLockWords ? root.CBLockWords.whoOf(p, p.status) : { line: '', note: '', all: [] }; /* W15-97: who locked it and when, who opened it again and why: the server's trail, read only */
      return Object.assign({}, p, { month: (names[Number(at.slice(5, 7)) - 1] || at.slice(0, 7)) + ' ' + at.slice(0, 4), state: root.CBLockWords ? root.CBLockWords.stateWord(p.status) : grantKit.words(p.status), profit_minor: monthProfit(p), lock_note: lockNoteHtml(who) });
    });
  }
  /** YE-F-11: the return's boxes that carry a figure, as the server sent them (nothing added up here) */
  function basRows(answer) {
    return ((answer && answer.boxes) || []).filter(function (b) { return b.amount_minor != null || b.tax_minor != null; });
  }
  /** YE-F-11: the return's header tag: the period and its due day, then the server's stage (lodged as declared · overdue · closed · prepared) */
  function basLine(answer) {
    if (!answer || !answer.period) return '';
    var text = [answer.period.label || answer.period.period, answer.period.due ? grantKit.words('due') + ' ' + root.shopDay(answer.period.due) : '', answer.stage ? grantKit.words(answer.stage.words) : ''].filter(Boolean).join(' · ');
    return '<span class="tag" data-testid="bv-return">' + esc(text) + '</span>';
  }
  function side(list, name) {
    return (list || []).map(function (row) {
      return Object.assign({ side: grantKit.words(name) }, row);
    });
  }
  /** the day box → the question each read takes (the server defaults every one to today) */
  function queryOf(report) {
    return Object.assign({}, report.more || {}, baseQuery(report));
  }
  function baseQuery(report) {
    var period = grantKit.viewState.period;
    if (!grantKit.viewState.day) return periodQuery(report, period);
    return dayQuery(report, grantKit.viewState.day, period);
  }
  /** no day typed: the read is for the period (as at its end for tb, bs and dues; from – to for the p&l and the day book) */
  function periodQuery(report, period) {
    if (!period || !period.from || !report.day) return {};
    if (report.day === 'asOf') return { asOf: period.to }; /* tb, bs, dues: as at the end of the period */
    if (report.day === 'on') return { on: period.kind === 'year' ? period.to : dayHeld(period.to) }; /* the return: the period that holds the end of the period asked */
    return { from: period.from, to: period.to }; /* p&l, day book: for the period */
  }
  /** FW2-01: the return reads the period that holds the day it is asked, and the server ignores a day still to come (AT-03: a year's end still to come is no pick, so a year keeps the server's own default); a quarter or month that has begun but not ended (the quarter we are in) is asked at its last day that has happened */
  function dayHeld(end) {
    var today = new Date().toISOString().slice(0, 10);
    return end > today ? today : end;
  }
  /** a day typed: that one day, in the shape the read takes. FW2-02: on the P&L (a range) a day typed inside the period in force ends the period there: Oct – 15 Nov, never the year to date beside a control that says the quarter */
  function dayQuery(report, day, period) {
    if (report.day === 'both') return { from: day, to: day };
    var query = {};
    query[report.day] = day;
    if (report.day === 'to' && period && period.from && period.from <= day && day <= period.to) query.from = period.from;
    return query;
  }
  /** W22 (fd17: ONE short tag in the header line, no row of its own): the firm's Months view, the lock as Xero's lock date reads it. The tag says the lock ("Locked to 31 Jan 2026" + the count of open gaps); the full sentence (Books start Jul 2025 · Locked to 31 Jan 2026 · Open: Feb 2026 (gap)) is its title and its aria-label. Every word and date is the server's (books_start, lock_date, gaps); months before the books start are not listed */
  function lockLines(report) {
    var a = grantKit.viewState.answer;
    if (report.k !== 'periods' || !a || !a.books_start) return '';
    var names = typeof root.monthNames === 'function' ? root.monthNames('short') : [];
    var monthOf = function (m) { var at = String(m.start_date || ''); return (names[Number(at.slice(5, 7)) - 1] || at.slice(0, 7)) + ' ' + at.slice(0, 4); };
    var gaps = a.gaps || [], lock = a.lock_date ? grantKit.words('Locked to') + ' ' + root.shopDay(a.lock_date) : grantKit.words('Not locked from the books start');
    var full = [grantKit.words('Books start') + ' ' + monthOf(a.books_start), lock].concat(gaps.length ? [grantKit.words('Open') + ': ' + gaps.map(monthOf).join(', ') + ' (' + grantKit.words('gap') + ')'] : []).join(' · ');
    var short = lock + (gaps.length ? ' · ' + gaps.length + ' ' + grantKit.words('gap') : '');
    return '<span class="tag bv-lock" data-testid="bv-lock-lines" title="' + esc(full) + '" aria-label="' + esc(full) + '" data-full="' + esc(full) + '">' + esc(short) + '</span>';
  }
  function facts(report) {
    var items = report.facts
      .filter(function (f) {
        return grantKit.viewState.answer && !grantKit.viewState.answer.needs && grantKit.viewState.answer[f[0]] != null; /* ACC-410: a return waiting on the shop's setup has no net: AED 0.00 would be a figure nobody computed */
      })
      .map(function (f) {
        return '<span class="tag" data-testid="bv-fact-' + f[0] + '">' + esc(grantKit.words(f[1])) + ': ' + esc(grantKit.minorWords(grantKit.viewState.answer[f[0]])) + '</span>';
      });
    return items.length ? '<span class="bv-facts" data-testid="bv-facts">' + items.join('') + '</span>' : '';
  }
  /** the server's own totals as a last row (nothing is added up here) */
  function totalRows(key, figures) {
    var total = grantKit.words('Total');
    return [];
  }
  /** a heading naming the date the figures stand at */
  function asAt(report) {
    var answer = grantKit.viewState.answer || {}, running = runningYear(report, answer);
    if (report.k === 'bas') return basLine(answer);
    var date = asAtDay(answer);
    return date && report.k === 'dues' ? asAtTag(date, running) : '';
  }
  /** the day the figures stand at: the day typed, else the one the server carried */
  function asAtDay(answer) {
    return grantKit.viewState.day || answer.shown_as_at || answer.asOf || answer.as_of || answer.to || '';
  }
  /** is this year still running? fix1117 F5: the api caps asOf at the shop day, so the year's end we ASKED for is what says the year is still running */
  function runningYear(report, a) {
    var asked = report.day === 'asOf' ? queryOf(report).asOf : '';
    return !grantKit.viewState.day && a.shown_as_at && ((a.asOf && a.shown_as_at < a.asOf) || (asked && a.shown_as_at < asked));
  }
  /** the "As at <day>" tag, with "year to date" while the year is still running */
  function asAtTag(date, running) {
    return '<span class="tag" data-testid="bv-asat">' + esc(grantKit.words('As at')) + ' ' + esc(root.shopDay(date)) + (running ? ' · ' + esc(grantKit.words('year to date')) : '') + '</span>';
  }
  /** the Day pick (a report that can stand at one day) */
  function dayPick(report) {
    return report.day ? '<label class="sub" for="bv_day">' + esc(grantKit.words('Day')) + '</label><input data-cbsid="NET005-I01" id="bv_day" class="inp" type="date" value="' + esc(grantKit.viewState.day) + '" data-testid="bv-day">' : '';
  }
})(typeof window !== 'undefined' ? window : globalThis);
