/**
 * books-grant-drill.js — ACC-176c, THE AUDITOR'S DRILL: from a figure to the account's ledger, from a ledger line to its journal entry. READ ONLY.
 *
 * OWNS      the two sheets an auditor opens from books-grant-view.js: an account's LEDGER (date · entry no · what · party · Dr · Cr · running balance, with the opening, the period's total Dr and Cr and the closing as the server carried them)
 *           and a journal ENTRY (who made it, when, each line's account · party · Dr · Cr); a line of an entry opens its account's ledger; a line of a ledger opens its entry
 * CALLED BY books-grant-view.js (a trial balance, profit and loss or balance sheet row · a Day book row)
 * FLOW      openLedger(ctx, account) → GET /api/books/ledger/:account?limit&after (+ the same page's entries from GET /api/books/daybook?entries= for the party names and the entry sheet) → mountList; openEntry(ctx, entry) → paints the entry the Day book or the ledger page carried
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * No write control: every read goes through CBBooksGrantApi.run with the headers of CBBooksActing (X-Books-For). It paints what the server answered; running balance, opening, closing and the period's totals are the server's own (a paged ledger carries them).
 * An entry's amount is the Dr side of its carried lines, set beside the Cr side: when the two differ the sheet says so, it never recomputes a third figure.
 *   CBBooksGrantDrill.openLedger · .openEntry · .amountOf
 */
(function (root) {
  'use strict';
  var PAGE = 100; /* a ledger is read a page at a time (DISCIPLINES §2); "Show more" asks for the next, by the server's own cursor */
  var MONEY = 'money';

  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function $(id) {
    return root.document.getElementById(id);
  }
  function esc(s) {
    return typeof root.esc === 'function' ? root.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function money(minor, currency) {
    return root.CBBooksActing.figure(minor, currency);
  }
  /** the Dr side of an entry's carried lines: what the Day book shows as the entry's amount */
  function amountOf(entry) {
    return (entry.lines || []).reduce(function (sum, line) { return sum + Number(line.dr_minor || 0); }, 0);
  }
  function crOf(entry) {
    return (entry.lines || []).reduce(function (sum, line) { return sum + Number(line.cr_minor || 0); }, 0);
  }
  function whenWords(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function read(ctx, key, params, query) {
    return root.CBBooksGrantApi.run(ctx.call, key, { params: params, query: query, headers: root.CBBooksActing.headers() });
  }
  function show(ctx, html) {
    ctx.sheet('<div class="bd-wrap" data-testid="bd-wrap">' + html + '</div>');
    var node = $('nw_sheet');
    if (node) node.className = 'sheet wide';
  }
  function refusal(ctx, failure) {
    if (failure && failure.status === 401) throw failure;
    show(ctx, '<h2>' + esc(words('Not shown')) + '</h2><div class="nw-why" role="status" data-testid="bd-why">' + esc((failure && failure.message) || words("Couldn't open this. Nothing was changed.")) + '</div>');
  }
  function fact(label, text, tid) {
    return '<span class="tag" data-testid="bd-fact-' + tid + '">' + esc(words(label)) + ': ' + esc(text) + '</span>';
  }

  /* ── an account's ledger ── */
  /** ctx = { call, sheet, mountList, day } · account = { code, name } */
  function openLedger(ctx, account) {
    var state = { account: account, lines: [], entries: {}, answer: null, next: null };
    show(ctx, '<h2>' + esc(account.code + ' ' + account.name) + '</h2><p class="sub" data-testid="bd-loading">' + esc(words('Opening the ledger…')) + '</p>');
    return page(ctx, state, null).then(function () { paintLedger(ctx, state); }, function (failure) { refusal(ctx, failure); });
  }
  /** one page of the ledger and, for the same entries, the Day book's lines (party names, who made it) */
  function page(ctx, state, after) {
    var query = { limit: PAGE, after: after };
    if (ctx.day) query.to = ctx.day;
    return read(ctx, 'readLedger', { account: state.account.code }, query).then(function (answer) {
      state.answer = answer;
      state.next = answer.next || null;
      var ids = (answer.lines || []).map(function (line) { return line.entry_id; }).filter(Boolean);
      state.lines = state.lines.concat(answer.lines || []);
      if (!ids.length) return null;
      return read(ctx, 'readDaybook', {}, { entries: ids.join(','), from: answer.from, to: answer.to }).then(function (book) {
        (book.entries || []).forEach(function (entry) { state.entries[entry.entry_id] = entry; });
      });
    });
  }
  function partyOf(state, line) {
    var entry = state.entries[line.entry_id], hit = null;
    if (!entry) return '';
    (entry.lines || []).forEach(function (l) {
      if (!hit && l.code === state.account.code && Number(l.dr_minor) === Number(line.dr_minor) && Number(l.cr_minor) === Number(line.cr_minor)) hit = l;
    });
    return (hit && hit.party_name) || '';
  }
  function paintLedger(ctx, state) {
    var a = state.answer, cur = a.currency, totals = a.totals || {};
    var head = '<h2 data-testid="bd-title">' + esc(a.account.code + ' ' + a.account.name) + '</h2><p class="sub">' + esc(a.from + ' → ' + a.to) + '</p>';
    var facts = '<div class="nw-acts" data-testid="bd-facts">' +
      fact('Opening', money(a.opening_minor, cur), 'opening') + (totals.dr_minor != null ? fact('Total debit', money(totals.dr_minor, cur), 'dr') + fact('Total credit', money(totals.cr_minor, cur), 'cr') : '') + fact('Closing', money(a.closing_minor, cur), 'closing') + '</div>';
    var more = state.next ? '<div class="nw-acts"><button data-cbsid="NET005-B05" type="button" class="act quiet" id="bd_more" data-testid="bd-more">' + esc(words('Show more')) + '</button><span class="sub">' + esc(state.lines.length + ' ' + words('of') + ' ' + a.total) + '</span></div>' : '';
    show(ctx, head + facts + '<div class="nw-list bd-list" id="bd_list" data-testid="bd-list"></div>' + more);
    if ($('bd_more')) $('bd_more').onclick = function () {
      page(ctx, state, state.next).then(function () { paintLedger(ctx, state); }, function (failure) { refusal(ctx, failure); });
    };
    var rows = state.lines.map(function (line, n) { return Object.assign({ _n: n, party: partyOf(state, line) }, line); });
    var cols = [['date', 'Date'], ['entry_no', 'Entry'], ['what', 'What it was'], ['party', 'Party'], ['dr_minor', 'Debit', MONEY], ['cr_minor', 'Credit', MONEY], ['running_minor', 'Balance', MONEY]];
    ctx.mountList($('bd_list'), {
      key: 'books-grant-ledger',
      defaultCols: cols.map(function (c) { return c[0]; }),
      rows: function () { return rows; },
      id: function (row) { return row._n; },
      rowTid: function (row) { return 'bd-line-' + row._n; },
      columns: cols.map(function (c, i) {
        return {
          key: c[0], label: words(c[1]), prio: i < 2 || c[2] ? 1 : 2, w: c[2] ? 120 : c[0] === 'what' ? 200 : 110,
          cell: function (row) { return c[2] === MONEY ? money(row[c[0]], cur) : row[c[0]] == null || row[c[0]] === '' ? '—' : String(row[c[0]]); },
          value: function (row) { return row[c[0]] == null ? '' : String(row[c[0]]); }
        };
      }),
      search: function (row) { return [row.date, row.entry_no, row.what, row.party].join(' '); },
      onOpen: function (row) {
        var entry = state.entries[row.entry_id];
        if (entry) openEntry(ctx, entry, a.currency, function () { paintLedger(ctx, state); });
      },
      empty: { title: words('Nothing to show here'), body: words('This account has no entries in this period.') }
    });
  }

  /* ── a journal entry ── */
  /** entry = one Day book entry (lines carry code, name, party_name, dr_minor, cr_minor) · back = how to return to the ledger it was opened from (or null) */
  function openEntry(ctx, entry, currency, back) {
    var cur = currency || ctx.currency, dr = amountOf(entry), cr = crOf(entry), src = entry.source || {};
    var who = [src.by ? words('Made by') + ' ' + src.by : '', src.recorded_at ? words('recorded') + ' ' + whenWords(src.recorded_at) : '', src.doc_at ? words('bill') + ' ' + whenWords(src.doc_at) : ''].filter(Boolean).join(' · ');
    var rev = entry.reversed_by ? '<div class="nw-why" role="status" data-testid="bd-reversed">' + esc(words('Reversed by') + ' ' + entry.reversed_by) + '</div>' : '';
    show(ctx,
      (back ? '<button data-cbsid="NET005-B04" type="button" class="act quiet" id="bd_back" data-testid="bd-back">← ' + esc(words('Back to the ledger')) + '</button>' : '') +
      '<h2 data-testid="bd-title">' + esc(entry.entry_no) + '</h2><p class="sub">' + esc(entry.posting_date + ' · ' + entry.narration) + '</p>' +
      (who ? '<p class="sub" data-testid="bd-who">' + esc(who) + '</p>' : '') + rev +
      '<div class="nw-acts" data-testid="bd-facts">' + fact('Amount', money(dr, cur), 'amount') + fact('Total debit', money(dr, cur), 'dr') + fact('Total credit', money(cr, cur), 'cr') +
      (dr === cr ? '' : '<span class="tag" data-testid="bd-unbalanced">' + esc(words('Debit and credit differ')) + '</span>') + '</div>' +
      '<div class="nw-list bd-list" id="bd_list" data-testid="bd-list"></div>');
    if ($('bd_back')) $('bd_back').onclick = back;
    var rows = (entry.lines || []).map(function (line, n) { return Object.assign({ _n: n, account: line.code + ' ' + line.name, party: line.party_name || '' }, line); });
    var cols = [['account', 'Account'], ['party', 'Party'], ['dr_minor', 'Debit', MONEY], ['cr_minor', 'Credit', MONEY]];
    ctx.mountList($('bd_list'), {
      key: 'books-grant-entry',
      defaultCols: cols.map(function (c) { return c[0]; }),
      rows: function () { return rows; },
      id: function (row) { return row._n; },
      rowTid: function (row) { return 'bd-jl-' + row._n; },
      columns: cols.map(function (c, i) {
        return {
          key: c[0], label: words(c[1]), prio: i === 0 || c[2] ? 1 : 2, w: c[2] ? 120 : 200,
          cell: function (row) { return c[2] === MONEY ? (Number(row[c[0]]) ? money(row[c[0]], cur) : '') : row[c[0]] == null || row[c[0]] === '' ? '—' : String(row[c[0]]); },
          value: function (row) { return row[c[0]] == null ? '' : String(row[c[0]]); }
        };
      }),
      search: function (row) { return row.account + ' ' + row.party; },
      onOpen: function (row) { openLedger(ctx, { code: row.code, name: row.name }); },
      empty: { title: words('Nothing to show here'), body: words('This entry has no lines.') }
    });
  }
  root.CBBooksGrantDrill = { openLedger: openLedger, openEntry: openEntry, amountOf: amountOf };
})(typeof window !== 'undefined' ? window : globalThis);
