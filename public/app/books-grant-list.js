/**
 * books-grant-list.js — ACC-176 part of books-grant-view.js: the list a read is shown in.
 * OWNS      the list configuration of one read (columns, search, drill, empty state) and the two aged tables of Who owes whom
 * CALLED BY books-grant-view.js (through root.CBBooksGrantKit)
 * FLOW      kit.paintRows(host, report) → CBList mounted in host
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * Paints what the server answered and computes nothing. Loaded before books-grant-view.js (network.html).
 */
(function (root) {
  'use strict';
  var grantKit = root.CBBooksGrantKit; /* created by books-grant-reports.js, which loads first */
  grantKit.paintRows = paintRows;
  grantKit.duesVoice = duesVoice;
  function paintRows(host, report) {
    if (report.panels) return paintDues(host, report);
    var rows = rowsOf(report);
    var config = Object.assign({ foldHead: true } /* a phone's head folds to one chip */, listConfig(report, rows));
    grantKit.viewState.o.mountList(host, config);
  }
  /** the rows of a read as the list draws them (numbered) */
  function rowsOf(report) {
    return report.rows(grantKit.viewState.answer || {}).concat(grantKit.totalRows(report.k, grantKit.viewState.answer || {})).map(function (row, n) {
      return Object.assign({ _n: n }, row);
    });
  }
  /** W21: the two headings in the reader's voice: a firm reads "Customers owe <client>" and "<client> owes suppliers"; the owner's own books say you (no member = the owner) */
  function duesVoice(client) {
    return client ? { customer: grantKit.words('Customers owe') + ' ' + client, supplier: client + ' ' + grantKit.words('owes suppliers') } : { customer: grantKit.words('Customers owe you'), supplier: grantKit.words('You owe suppliers') };
  }
  /** E15: the empty side of Who owes whom in the reader's voice, as the owner's own Dues says it ("Nobody owes you money" · "You owe nobody") */
  function duesNobody(client, who) {
    if (who === 'customer') return client ? grantKit.words('Nobody owes') + ' ' + client : grantKit.words('Nobody owes you money');
    return client ? client + ' ' + grantKit.words('owes nobody') : grantKit.words('You owe nobody');
  }
  /** the aged figures of one row (the server's follow_up, days past due) as the table's columns */
  function agedRow(row) {
    var fu = row.follow_up || {};
    return Object.assign({}, row, { age_not_due: fu.not_due, age_d0_30: fu.d0_30, age_d31_60: fu.d31_60, age_d61_90: fu.d61_90, age_d90_plus: fu.d90_plus });
  }
  /** the parties of one side's table: a party the server marks `both` is on each table with that list's own figures (row.sides.<side>, sent by the server; nothing is worked out here) */
  function partiesOf(all, who) {
    return all.reduce(function (list, row) {
      if (row.side === who) list.push(row);
      else if (row.side === 'both' && row.sides && row.sides[who]) list.push(Object.assign({}, row, row.sides[who], { side: who }));
      return list;
    }, []);
  }
  /** the total row of one side: the server's own aged_totals (nothing is added up here) */
  function agedTotalRow(who, total) {
    if (!total) return [];
    return [{ _total: true, name: grantKit.words('Total'), side: who, age_not_due: total.not_due, age_d0_30: total.d0_30, age_d31_60: total.d31_60, age_d61_90: total.d61_90, age_d90_plus: total.d90_plus, balance_minor: total.balance_minor }];
  }
  /** FC-M10: the tie-out line under Who owes whom, from the server's own tb_control (each side's list total beside the trial balance's control, the difference named; nothing is added or compared here):
   *  "Agrees with trial balance · Debtors A$5,440.00" or "Differs from trial balance · Debtors by A$70.00 · see Trial balance"; a side the reader may not see (null figures) is left out */
  function tieOutLine(control) {
    var sides = [['customer', 'Debtors'], ['supplier', 'Creditors']].filter(function (side) { return control && control[side[0]] && control[side[0]].tb_minor != null; });
    if (!sides.length) return '';
    var shown = function (minor) { return grantKit.minorWords(String(Math.abs(Number(minor)))); }; /* a supplier's is negative as the rows are; painted as an amount, like the Total column */
    var off = sides.filter(function (side) { return Number(control[side[0]].differs_minor) !== 0; });
    var text = off.length
      ? grantKit.words('Differs from trial balance') + ' · ' + off.map(function (side) { return grantKit.words(side[1]) + ' ' + grantKit.words('by') + ' ' + shown(control[side[0]].differs_minor); }).join(' · ') + ' · ' + grantKit.words('see Trial balance')
      : grantKit.words('Agrees with trial balance') + ' · ' + sides.map(function (side) { return grantKit.words(side[1]) + ' ' + shown(control[side[0]].tb_minor); }).join(' · ');
    return '<div class="tag bv-dues-tie' + (off.length ? ' warn' : '') + '" data-testid="bv-dues-tb">' + esc(text) + '</div>';
  }
  /** Who owes whom: two aged tables, customers owe and the shop owes suppliers (Current · 1–30 · 31–60 · 61–90 · 90+ days past due), each with its total row, no net total */
  function paintDues(host, report) {
    var all = report.rows(grantKit.viewState.answer || {}), voice = duesVoice(grantKit.viewState.o && grantKit.viewState.o.member && grantKit.viewState.o.member.name), totals = (grantKit.viewState.answer && grantKit.viewState.answer.aged_totals) || {};
    var member = grantKit.viewState.o && grantKit.viewState.o.member && grantKit.viewState.o.member.name, heads = { customer: voice.customer, supplier: voice.supplier };
    /* fd17: ONE heading line per side; a side with nobody owing is that line plus its sentence (no list, no head), the sentence is still the side's own (bv-dues-customers / bv-dues-suppliers) */
    host.classList.add('bv-dues');
    host.innerHTML = ['customer', 'supplier'].map(function (who) {
      var empty = !partiesOf(all, who).length, tid = who === 'customer' ? 'customers' : 'suppliers', id = who === 'customer' ? 'bv_dues_c' : 'bv_dues_s';
      return '<div class="bv-dues-side' + (empty ? ' bv-dues-nil' : '') + '"><h3 class="sub" data-testid="bv-dues-' + tid + '-head">' + esc(heads[who]) + '</h3>' +
        (empty ? '<span class="tag" id="' + id + '" data-testid="bv-dues-' + tid + '">' + esc(duesNobody(member, who)) + '</span>' : '<div id="' + id + '" data-testid="bv-dues-' + tid + '"></div>') + '</div>';
    }).join('') + tieOutLine(grantKit.viewState.answer && grantKit.viewState.answer.tb_control);
    ['customer', 'supplier'].forEach(function (who) {
      var parties = partiesOf(all, who).map(agedRow);
      if (!parties.length) return; /* said in the heading line above */ /* E15: the server drops a party with nothing open; a side with no party is an empty sentence, never a lone Total row */
      var rows = (parties.length ? parties.concat(agedTotalRow(who, totals[who])) : []).map(function (row, n) { return Object.assign({ _n: n }, row); });
      var config = listConfig(report, rows);
      config.key = 'books-grant-dues-' + who;
      config.empty = { title: duesNobody(grantKit.viewState.o && grantKit.viewState.o.member && grantKit.viewState.o.member.name, who) };
      grantKit.viewState.o.mountList(grantKit.$(who === 'customer' ? 'bv_dues_c' : 'bv_dues_s'), Object.assign({ foldHead: true }, config));
    });
  }
  /** the columns the read sends, as the list draws them */
  function shownCols(report) {
    return report.cols;
  }
  var HTML_NAMES = ['change_minor', 'party_ref', 'lock_note'];
  /** an amount, a percent or a net balance: right-aligned */
  function isNumberColumn(column) {
    return [grantKit.MONEY, grantKit.PCT, grantKit.DRCR].indexOf(column[2]) >= 0;
  }
  /** a cell of html (escaped where it was built) rather than text */
  function isHtmlColumn(column) {
    return HTML_NAMES.indexOf(column[0]) >= 0;
  }
  /** which columns stay on a narrow screen: the first, the name, the party and the amounts (1), the rest go first (2) Last year and % go first on a narrow screen: the amount and its change stay */
  function columnPriority(column, index) {
    if (index === 0 || column[0] === 'name' || column[0] === 'party_ref') return 1;
    return column[2] === grantKit.MONEY ? 1 : 2;
  }
  /** a column's width: by what it holds */
  function columnWidth(column) {
    return column[2] === grantKit.MONEY ? 140 : 180;
  }
  /** one column of the list: how it is headed, sized, sorted, kept and painted */
  function listColumn(column, index, all, report) {
    return Object.assign({}, {
      html: isHtmlColumn(column),
      key: column[0],
      label: grantKit.words(column[1]),
      prio: columnPriority(column, index),
      num: isNumberColumn(column),
      keep: column[0] === 'party_ref',
      w: columnWidth(column),
      cell: function (row) {
        return grantKit.figure(row, column);
      },
      value: function (row) {
        return row[column[0]] == null ? '' : String(row[column[0]]);
      }
    });
  }
  /** what a click on a row opens: an account's ledger or an entry (drill), a Months row's Day book; nothing else */
  function rowOpener(report) {
    if (report.drill) return function (row) { grantKit.drill(report, row); };
    if (report.k !== 'periods') return undefined;
    return function (row) { if (row.start_date && row.end_date) grantKit.openMonth(String(row.start_date).slice(0, 10), String(row.end_date).slice(0, 10)); }; /* a Months row opens that month's Day book */
  }
  /** the list's configuration for one report: its columns, search, drill and empty state */
  var SEARCH_FROM = 10;
  var BAR_FROM = 12;
  function listConfig(report, rows) {
    return {
      key: 'books-grant-' + report.k,
      /* R4 17 Nov: no first sort. The Day book opens in the book's own order (day, then number: the api's order); the risk-first order opened it with the three after-period-end entries of June 2026 above July 2025 and, at 1366, the Risk column is not even in view to explain why. Most risks first is one press on Risk (kept for the reader), or the Risk filters below */
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
      columns: shownCols(report).map(function (column, index) { return listColumn(column, index, null, report); }),
      search: function (row) {
        return report.cols
          .map(function (column) {
            return row[column[0]];
          })
          .join(' ');
      },
      rowClass: function (row) { return row.change_over ? 'bv-over' : ''; },
      onOpen: rowOpener(report),
      empty: waitingEmpty(report) || { title: grantKit.words('Nothing to show here'), body: grantKit.words(grantKit.viewState.day || !grantKit.viewState.range ? 'These books have no entries for this day.' : 'These books have no entries in this period.') }
    };
  }
  /** ACC-410: a return the shop's setup still waits for says what it waits for (the server's sentence), never an empty list; null for every other read */
  function waitingEmpty(report) {
    var answer = grantKit.viewState.answer, stagger = answer && answer.needs === 'stagger';
    if (report.k !== 'bas' || !answer || !answer.needs) return null;
    return { title: grantKit.words(stagger ? 'This return is waiting on the shop' : 'No return to show'), body: grantKit.words(answer.why || 'The shop has not said how it files this return yet.') + (stagger ? ' ' + grantKit.words('The owner sets it once; you then see the same boxes as the owner.') : '') };
  }
})(typeof window !== 'undefined' ? window : globalThis);
