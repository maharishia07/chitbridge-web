/* bank-preview.js — BANK STATEMENT → BOOKS, the ONE module: load → match → proposals → preview → confirm with reach → post.
 * OWNS      the flow of reading a statement on the device, putting each line against the books, showing the books AS THEY WILL READ once the proposed
 *           lines are in (nothing saved), the confirm popup that says what the press will reach, and posting the confirmed lines ONE AT A TIME through an
 *           INJECTED post adapter. The demo page (public/bank-demo.html) and the app (public/app/cap-bank-post.js) differ ONLY in that adapter.
 * CALLED BY public/app/bank-demo.js (the no-login showcase) · later the Bank view (cap-bank.js) through one call-in.
 * FLOW      create(opts) → load(text) → engine parse + explain → project() → view() → confirmText() → CBLabKit.confirm → postReady(onLine) → refresh
 * CARD      16-finance/bank-reconciliation-and-bank-rail   (requirement: docs 16-finance/BANK-TO-BOOKS-REQUIREMENT.md, "Critic 14 Nov")
 *
 * ⭐ THE PAGE COMPUTES NO MONEY. Matching and proposals are CBBankRecon's (parse · explain), the books-after and the reconciliation are CBBankProject.project()'s,
 *   the proposed entry is the one posting.post composed inside suggest(). This file only moves carried figures and paints them. The reach popup reads
 *   projection.reach; when the engine sends none, the popup says so and the press is refused (a second sum here would be a second calculation).
 * ⭐ NEVER GUESSED. A line with no account or no party (suggestion.entry null, or `needs`) is "Needs you" and is never posted; `needs: 'gst_basis'` is asked
 *   as a question ("Does this amount include GST?"), never defaulted.
 * ⭐ ONE LINE AT A TIME. Each ready line is one adapter call with its own client_ref (bank:<fingerprint>, the same line twice is the same entry); a failure is
 *   shown on ITS line and the others go on. A line in a closed month is refused BEFORE the press, named, and counted in the popup.
 * ⭐ THE ENGINE CONTRACT THIS FILE READS (engines lane feat/bank-to-books-engine, src/bank-project.js; every read of it is in projectionOf_):
 *   project({ currency, statement: parsed, ledger: { lines, closing_minor }, explained }) → { currency, lines: [{ key, state, entry, needs, why }],
 *   ledger: [{ date, narration, dr_minor, cr_minor, balance_minor, proposed }], brs: { statement_closing_minor, books_closing_minor, difference_minor, open: [] },
 *   reach: { count, in_minor, out_minor, from, to, needs_you } }   state ∈ in_books | proposed | needs_you
 *   A line with an unknown payee carries party: { status: 'new', name, kind, basis } and did_you_mean: [{ id, name }] (on the projected line or its suggestion).
 *   The owner may edit the name and kind or pick an existing party; the adapter creates a NEW party FIRST (app: POST /relationships; demo: the on-screen list), then
 *   posts the entry with its id. A party that cannot be made fails THAT line. The GST basis ('cash' | 'accrual') is asked once and passed to explain as gst_basis.
 *   No new chart account in v1: an account is picked from the existing chart.
 */
(function (root) {
  'use strict';
  var STATE_WORDS = { in_books: 'In your books', proposed: 'Ready to add', needs_you: 'Needs you', posted: 'Added', failed: 'Not added', closed: 'Month closed' };
  var NEEDS_WORDS = { gst_basis: 'Does this amount include GST?', account: 'Which account is this?', party: 'Who is this?' };
  var MAX_FILE_BYTES = 2 * 1024 * 1024;

  /** a carried minor amount as text in its own currency: "AUD 2,200.00" — the digits come from the money unit, never a fixed 2 */
  function moneyText(minor, currency) {
    var unit = root.CBMoney,
      digits = unit && unit.decimals && currency ? unit.decimals(currency) : 2;
    var text = (Math.abs(minor) / Math.pow(10, digits)).toLocaleString('en-AU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return (currency ? currency + ' ' : '') + (minor < 0 ? '-' : '') + text;
  }
  /** "5 Nov 2026" from 'YYYY-MM-DD'; '' when there is no date */
  function dateText(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''),
      names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return m ? Number(m[3]) + ' ' + names[Number(m[2]) - 1] + ' ' + m[1] : '';
  }
  /** a 24-hex fingerprint of (account, line key): the same line in a re-exported file has the same one (a file hash or a row number would not) */
  function fingerprint(account, key) {
    var text = String(account || '') + '\n' + String(key || ''),
      seeds = [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35],
      out = '';
    seeds.forEach(function (seed) {
      var h = seed;
      for (var i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
      out += ('00000000' + (h >>> 0).toString(16)).slice(-8);
    });
    return out;
  }
  /** the first problem with a statement against the account it is for, in words; null when it may go on. The account's currency comes from the shop, never from the file. */
  function currencyRefusal(parsed, accountCurrency) {
    var said = parsed && parsed.currency;
    if (said && accountCurrency && said !== accountCurrency) {
      return 'This statement is in ' + said + ' but this account is in ' + accountCurrency + '. Nothing was read.';
    }
    return null;
  }

  /** the engine's answer read through ONE door, so a change of the contract is a change here and nowhere else */
  function projectionOf_(raw, currency) {
    var answer = raw || {};
    return {
      currency: answer.currency || currency,
      lines: answer.lines || [],
      ledger: answer.ledger || [],
      brs: answer.brs || null,
      reach: answer.reach || null
    };
  }

  /** one statement line joined to what the projection says about it, ready to paint and to post */
  function itemOf_(row, projected, statementLine, account, lockedMonth) {
    var suggestion = (row && row.suggestion) || {},
      event = suggestion.event || null,
      state = (projected && projected.state) || 'needs_you',
      closed = lockedMonth ? lockedMonth(statementLine.date) : null;
    var needs = (projected && projected.needs) || suggestion.needs || null;
    var ready = state === 'proposed' && !!(projected && projected.entry) && !needs && !closed;
    var party = (projected && projected.party) || suggestion.party || null;
    return {
      party: party ? Object.assign({}, party) : null,
      didYouMean: (projected && projected.did_you_mean) || suggestion.did_you_mean || [],
      key: row.key,
      ref: 'bank:' + fingerprint(account, row.key),
      line: statementLine,
      event: event,
      entry: (projected && projected.entry) || null,
      state: closed ? 'closed' : state,
      needs: needs,
      closed: closed,
      why: closed ? closed.words : (projected && projected.why) || suggestion.why || '',
      ready: ready
    };
  }

  /**
   * create(opts) → the preview controller.
   *   opts.engine   { recon: CBBankRecon, project: CBBankProject }      opts.currency  the ACCOUNT's currency (from the shop)
   *   opts.account  the bank account's name (in every fingerprint)       opts.ledger()  → { lines, closing_minor }, read again after posting
   *   opts.post(item) → Promise<{ ok, duplicate?, entry_no?, why? }>      opts.lockedMonth(date) → null | { month, words }
   *   opts.explainOpts / parseOpts   the pack, country, learned rules, parties — passed to the engine as given
   */
  function create(opts) {
    var s = { parsed: null, projection: null, items: [], results: {}, name: '', refusal: null, answers: {}, partyEdits: {} };
    function engineReady() {
      var e = opts.engine || {};
      if (e.recon && e.recon.parse && e.recon.explain && e.project && e.project.project) return null;
      return 'The books engine for this page has not loaded, so nothing can be checked here yet.';
    }
    function run() {
      var books = opts.ledger(),
        recon = opts.engine.recon,
        explained = recon.explain(s.parsed.lines, books.lines, [], Object.assign({}, opts.explainOpts, s.answers));
      var raw = opts.engine.project.project({ currency: opts.currency, statement: s.parsed, ledger: books, explained: explained });
      s.projection = projectionOf_(raw, opts.currency);
      s.items = explained.rows.map(function (row, index) {
        var statementLine = s.parsed.lines[index];
        return withPartyEdit_(itemOf_(row, s.projection.lines[index], statementLine, opts.account, opts.lockedMonth), s.partyEdits[row.key]);
      });
    }
    /** the owner's edit of a line's party (a new name or kind, or an existing party picked from did_you_mean) laid over what the engine said */
    function withPartyEdit_(item, edit) {
      if (!edit || !item.party) return item;
      item.party = Object.assign({}, item.party, edit);
      return item;
    }
    /** edit a new party: { name?, kind? } makes it a new one again; { status: 'existing', id, name } picks one of the did-you-mean; the books are not touched */
    function editParty(key, edit) {
      var clean = edit && edit.status === 'existing' ? { status: 'existing', id: edit.id, name: edit.name } : { status: 'new', name: String((edit && edit.name) || '').trim(), kind: edit && edit.kind };
      if (clean.status === 'new' && !clean.name) return { ok: false, why: 'Give the new party a name.' };
      s.partyEdits[key] = clean;
      run();
      return { ok: true };
    }
    /** the owner's one-time answer to a question the engine asked (gst_basis: 'cash' | 'accrual'); the proposals are read again with it */
    function answer(name, value) {
      s.answers[name] = value;
      if (s.parsed) run();
    }
    function load(text, name) {
      s.results = {};
      s.refusal = engineReady();
      if (s.refusal) return { ok: false, why: s.refusal };
      if (typeof text === 'string' && text.length > MAX_FILE_BYTES) return fail_('That file is too big for this page (2 MB at most).');
      var parsed = opts.engine.recon.parse(text, opts.parseOpts || {});
      if (!parsed.ok) return fail_(parsed.why || 'This file could not be read as a bank statement.');
      var refused = currencyRefusal(parsed, opts.currency);
      if (refused) return fail_(refused);
      s.parsed = parsed;
      s.name = name || '';
      run();
      return { ok: true, count: parsed.lines.length, warnings: parsed.warnings || [] };
    }
    function fail_(why) {
      s.refusal = why;
      return { ok: false, why: why };
    }
    function readyItems() {
      return s.items.filter(function (item) {
        return item.ready && !(s.results[item.key] && s.results[item.key].ok);
      });
    }
    /** what the press reaches: the engine's carried figures, plus the lines a closed month holds back and the lines that still need a person */
    function reach() {
      var carried = s.projection && s.projection.reach;
      if (!carried) return null;
      var closed = s.items.filter(function (item) {
        return item.closed;
      }).length;
      return Object.assign({ currency: s.projection.currency, closed: closed, newParties: newPartyCount_() }, carried);
    }
    /** how many NEW parties the press would make: one per distinct name and kind among the ready lines (two lines naming one payee make it once) */
    function newPartyCount_() {
      var seen = {};
      readyItems().forEach(function (item) {
        if (item.party && item.party.status === 'new') seen[String(item.party.name).toLowerCase() + '|' + item.party.kind] = 1;
      });
      return Object.keys(seen).length;
    }
    /** the popup body: count · in · out · date range · currency · how many still need you. Escaped by the caller's esc. */
    function confirmText() {
      var r = reach();
      if (!r) return null;
      var money = function (minor) {
        return moneyText(minor, r.currency);
      };
      return {
        title: 'Add ' + r.count + (r.count === 1 ? ' entry' : ' entries') + ' to your books?',
        lines: [
          'Money in: ' + money(r.in_minor),
          'Money out: ' + money(r.out_minor),
          'Dated: ' + dateText(r.from) + (r.to && r.to !== r.from ? ' to ' + dateText(r.to) : ''),
          'Currency: ' + r.currency,
          r.newParties + (r.newParties === 1 ? ' new party' : ' new parties') + ' made first',
          r.needs_you + ' still need you. They are not added.' + (r.closed ? ' ' + r.closed + ' in a closed month are held back.' : '')
        ]
      };
    }
    /** one adapter call, one line; a throw or a refusal is that line's reason, never the end of the others */
    async function postOne(item) {
      try {
        var reply = await opts.post(item);
        s.results[item.key] = reply && reply.ok ? { ok: true, duplicate: !!reply.duplicate, entry_no: reply.entry_no || null } : { ok: false, why: (reply && reply.why) || 'Not added.' };
      } catch (failure) {
        s.results[item.key] = { ok: false, why: (failure && failure.message) || 'Not added.' };
      }
    }
    /** post every ready line in order, tell the page after each (onLine(item, result)), then read the books again so the preview is the truth */
    async function postReady(onLine) {
      var todo = readyItems();
      for (var i = 0; i < todo.length; i++) {
        await postOne(todo[i]);
        if (onLine) onLine(todo[i], s.results[todo[i].key]);
      }
      run();
      var failed = todo.filter(function (item) {
        return !s.results[item.key].ok;
      });
      return { tried: todo.length, added: todo.length - failed.length, failed: failed.length };
    }
    return {
      load: load,
      reach: reach,
      confirmText: confirmText,
      postReady: postReady,
      editParty: editParty,
      answer: answer,
      readyCount: function () {
        return readyItems().length;
      },
      view: function () {
        return { name: s.name, parsed: s.parsed, projection: s.projection, items: s.items, results: s.results, refusal: s.refusal };
      }
    };
  }

  root.CBBankPreview = { create: create, moneyText: moneyText, dateText: dateText, fingerprint: fingerprint, currencyRefusal: currencyRefusal, STATE_WORDS: STATE_WORDS, NEEDS_WORDS: NEEDS_WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankPreview;
})(typeof globalThis !== 'undefined' ? globalThis : this);
