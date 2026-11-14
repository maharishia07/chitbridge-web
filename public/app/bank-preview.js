/* bank-preview.js — BANK STATEMENT → BOOKS, the ONE module: load → match → proposals → preview → confirm with reach → post.
 * OWNS      the flow of reading a statement on the device, putting each line against the books, showing the books AS THEY WILL READ once the ready lines are in
 *           (nothing saved), the confirm popup that says what the press will reach, and posting the confirmed lines ONE AT A TIME through an INJECTED post adapter.
 *           The demo page (public/bank-demo.html) and the app (public/app/cap-bank-post.js) differ ONLY in that adapter.
 * CALLED BY public/app/bank-demo.js (the no-login showcase) · later the Bank view (cap-bank.js) through one call-in.
 * FLOW      create(opts) → load(text) → recon.parse · recon.match · recon.suggest → project.project() → view() → confirmText() → CBLabKit.confirm → postReady(onLine) → read again
 * CARD      16-finance/bank-reconciliation-and-bank-rail   (requirement: docs 16-finance/BANK-TO-BOOKS-REQUIREMENT.md, "Critic 14 Nov")
 *
 * ⭐ THE PAGE COMPUTES NO MONEY. Matching and proposals are CBBankRecon's (match · suggest), the books-after, the reconciliation, each line's state and its client_ref
 *   are CBBankProject.project()'s, the proposed entry is the one posting.post composed inside suggest(). This file only moves carried figures and paints them.
 *   The reach popup reads project().totals and counts; when the engine says nothing the popup says so (a sum here would be a second calculation).
 * ⭐ NEVER GUESSED. A line with no entry (no account, no party known) is "Needs you" and never posted; a blocker 'gst_basis' is asked as a question (cash or accrual,
 *   once), never defaulted. No new chart account in v1: an account comes from the existing chart.
 * ⭐ ONE LINE AT A TIME. Each ready line is one adapter call with its own client_ref (the engine's bank:<fingerprint>-<n>); a failure is shown on ITS line and the others
 *   go on. A line in a closed month is refused BEFORE the press, named, and counted in the popup. A NEW party (parties_to_create, with did_you_mean) is made by the
 *   adapter FIRST (app: the CRM party door; demo: the on-screen list); if that fails, that line fails with the reason.
 * ⭐ THE ENGINE CONTRACT (engines branch feat/bank-to-books-engine, src/bank-project.js; every read of it is in this file's lineOf_ and run):
 *   project(lines, proposals, { currency, opening_minor, ledger, statement: { currency, opening_minor, closing_minor }, account }) → { ok, currency, lines[], ledger[], brs, totals,
 *   counts, parties_to_create[] } | { ok: false, code, why }. Amounts are money values { amount_minor, currency }. line: { i, state, ready, blockers[], why, entry, party, ref }.
 */
(function (root) {
  'use strict';
  var STATE_WORDS = { in_books: 'In your books', proposed: 'Ready to add', needs_you: 'Needs you', posted: 'Added', failed: 'Not added', closed: 'Month closed' };
  var NEEDS_WORDS = { gst_basis: 'GST basis needed', no_entry: 'Needs you' };
  var MAX_FILE_BYTES = 2 * 1024 * 1024;
  var MATCH_WINDOW_DAYS = 3;

  /** the minor amount of a money value { amount_minor } (or of a bare minor number); 0 when there is none */
  function minorOf(money) {
    if (money && typeof money === 'object') return +money.amount_minor || 0;
    return +money || 0;
  }
  /** a carried amount as text in its own currency: "AUD 2,200.00"; the digits come from the money unit, never a fixed 2 */
  function moneyText(money, currency) {
    var minor = minorOf(money),
      code = (money && money.currency) || currency,
      unit = root.CBMoney,
      digits = unit && unit.decimals && code ? unit.decimals(code) : 2;
    var text = (Math.abs(minor) / Math.pow(10, digits)).toLocaleString('en-AU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return (code ? code + ' ' : '') + (minor < 0 ? '-' : '') + text;
  }
  /** "5 Nov 2026" from 'YYYY-MM-DD'; '' when there is no date */
  function dateText(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''),
      names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return m ? Number(m[3]) + ' ' + names[Number(m[2]) - 1] + ' ' + m[1] : '';
  }

  /** the statement line (index i) joined to what the engine said about it, ready to paint and to post */
  function lineOf_(projected, statementLine, proposal, lockedMonth, toCreate) {
    var blockers = projected.blockers || [],
      closed = lockedMonth ? lockedMonth(statementLine.date) : null;
    var proposed = toCreate.filter(function (p) {
      return p.lines.indexOf(projected.i) >= 0;
    })[0];
    var party = projected.party ? Object.assign({}, projected.party) : null;
    return {
      key: projected.ref,
      ref: projected.ref,
      i: projected.i,
      line: statementLine,
      entry: projected.entry || null,
      event: (proposal && proposal.event) || null, /* what POST /events takes: the proposal's own event, the one posting.post composed the entry from */
      state: closed ? 'closed' : projected.state,
      needs: blockers.indexOf('gst_basis') >= 0 ? 'gst_basis' : null,
      blockers: blockers,
      closed: closed,
      why: closed ? closed.words : projected.why || '',
      party: party,
      didYouMean: (proposed && proposed.did_you_mean) || [],
      ready: !!projected.ready && !closed
    };
  }

  /**
   * create(opts) → the preview controller.
   *   opts.engine   { recon: CBBankRecon, project: CBBankProject }      opts.currency  the ACCOUNT's currency (from the shop, never the file)
   *   opts.account  the bank account's name (in every ref)               opts.ledger()  → { lines, opening_minor }, read again after posting
   *   opts.post(item) → Promise<{ ok, duplicate?, entry_no?, why? }>      opts.lockedMonth(date) → null | { month, words }
   *   opts.statementCurrency()  the currency the STATEMENT says it is in (the engine refuses a mismatch with the account); default the file's own, else the account's
   *   opts.suggestOpts / parseOpts   the pack, country, learned rules, parties — passed to the engine as given
   */
  function create(opts) {
    var s = { proposals: [], parsed: null, projection: null, items: [], results: {}, name: '', refusal: null, answers: {}, partyEdits: {} };
    function engineReady() {
      var e = opts.engine || {};
      var ok = e.recon && e.recon.parse && e.recon.match && e.recon.suggest && e.project && e.project.project;
      return ok ? null : 'The books engine for this page has not loaded, so nothing can be checked here yet.';
    }
    /** match against the books, a proposal for each line the books lack (null for a line already there), then the engine's preview of it all */
    function projectNow() {
      var recon = opts.engine.recon,
        books = opts.ledger(),
        lines = s.parsed.lines;
      var inBooks = {};
      recon.match(lines, books.lines, { window_days: MATCH_WINDOW_DAYS }).matched.forEach(function (pair) {
        pair.stmt.forEach(function (i) {
          inBooks[i] = true;
        });
      });
      s.proposals = lines.map(function (line, i) {
        return inBooks[i] ? null : recon.suggest(line, Object.assign({}, opts.suggestOpts, s.answers));
      });
      var statement = { currency: (opts.statementCurrency && opts.statementCurrency()) || s.parsed.currency || opts.currency, opening_minor: s.parsed.opening_minor, closing_minor: s.parsed.closing_minor };
      return opts.engine.project.project(lines, s.proposals, { currency: opts.currency, opening_minor: books.opening_minor, ledger: books.lines, statement: statement, account: opts.account });
    }
    function run() {
      var out = projectNow();
      if (!out.ok) {
        s.refusal = out.why;
        s.projection = null;
        s.items = [];
        return false;
      }
      s.projection = out;
      s.refusal = null;
      s.items = out.lines.map(function (projected, i) {
        return withPartyEdit_(lineOf_(projected, s.parsed.lines[i], s.proposals[i], opts.lockedMonth, out.parties_to_create || []), s.partyEdits[projected.ref]);
      });
      return true;
    }
    /** the owner's edit of a line's party (a new name or kind, or an existing party picked from did-you-mean) laid over what the engine said */
    function withPartyEdit_(item, edit) {
      if (edit && item.party) item.party = Object.assign({}, item.party, edit);
      return item;
    }
    function fail_(why) {
      s.refusal = why;
      return { ok: false, why: why };
    }
    function load(text, name) {
      s.results = {};
      s.partyEdits = {};
      var notReady = engineReady();
      if (notReady) return fail_(notReady);
      if (typeof text === 'string' && text.length > MAX_FILE_BYTES) return fail_('That file is too big for this page (2 MB at most).');
      var parsed = opts.engine.recon.parse(text, opts.parseOpts || {});
      if (!parsed.ok) return fail_(parsed.why || 'This file could not be read as a bank statement.');
      s.parsed = parsed;
      s.name = name || '';
      return run() ? { ok: true, count: parsed.lines.length, warnings: parsed.warnings || [] } : fail_(s.refusal);
    }
    function readyItems() {
      return s.items.filter(function (item) {
        return item.ready && !(s.results[item.key] && s.results[item.key].ok);
      });
    }
    /** edit a new party: { name?, kind? }; or { status: 'existing', id, name } picks one of the did-you-mean. The books are not touched. */
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
    /** how many NEW parties the press would make: one per distinct name and kind among the ready lines (two lines naming one payee make it once) */
    function newPartyCount_() {
      var seen = {};
      readyItems().forEach(function (item) {
        if (item.party && item.party.status === 'new') seen[String(item.party.name).toLowerCase() + '|' + item.party.kind] = 1;
      });
      return Object.keys(seen).length;
    }
    /** what the press reaches: the engine's carried totals of the READY lines, the lines a closed month holds back, the lines that still need a person */
    function reach() {
      var totals = s.projection && s.projection.totals,
        counts = s.projection && s.projection.counts;
      if (!totals || !counts) return null;
      var held = s.items.filter(function (item) {
        return item.closed;
      }).length;
      return { currency: s.projection.currency, count: readyItems().length, in: totals.in, out: totals.out, from: totals.from, to: totals.to, needs_you: counts.needs_you, closed: held, newParties: newPartyCount_() };
    }
    /** the popup: count · in · out · date range · currency · new parties · how many still need you */
    function confirmText() {
      var r = reach();
      if (!r) return null;
      var money = function (value) {
        return moneyText(value, r.currency);
      };
      return {
        title: 'Add ' + r.count + (r.count === 1 ? ' entry' : ' entries') + ' to your books?',
        lines: [
          'Money in: ' + money(r.in),
          'Money out: ' + money(r.out),
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

  root.CBBankPreview = { create: create, moneyText: moneyText, minorOf: minorOf, dateText: dateText, STATE_WORDS: STATE_WORDS, NEEDS_WORDS: NEEDS_WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankPreview;
})(typeof globalThis !== 'undefined' ? globalThis : this);
