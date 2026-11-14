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
  var STATE_WORDS = { in_books: 'In your books', proposed: 'Ready to add', check: 'Needs you', needs_you: 'Needs you', posted: 'Added', failed: 'Not added', closed: 'Month closed' };
  /** why a proposed line is held back, in the words the line shows (B5-01/02/03: a held-back line says so ON the line, never a silent "Ready") */
  var NEEDS_WORDS = {
    gst_basis: 'Tax basis needed',
    tax_invoice: 'Tax invoice needed',
    needs_tick: 'Needs your tick',
    may_be_in_books: 'May already be in your books',
    unbalanced: 'Entry does not balance',
    refused: 'The books refused this entry',
    bank_leg_mismatch: "Entry does not match the bank line's amount",
    no_entry: 'Needs you'
  };
  /** the blockers a person answers on the line, in the order they are asked (is it new at all? then the tax, then the tick); every other blocker is only shown */
  var ASKED_ = ['may_be_in_books', 'gst_basis', 'tax_invoice', 'needs_tick'];
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
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    var month = new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' });
    return Number(m[3]) + ' ' + month + ' ' + m[1];
  }

  /** a line's standing: its state, the words for it and whether it may be posted; a closed month overrides what the engine said */
  function standingOf_(projected, closed) {
    if (closed) return { state: 'closed', why: closed.words, ready: false };
    return { state: projected.state, why: projected.why || '', ready: !!projected.ready };
  }
  /** the new-party proposal (with its did-you-mean) that names this statement line, or null */
  function partyProposalFor_(toCreate, lineIndex) {
    return (
      toCreate.filter(function (proposal) {
        return proposal.lines.indexOf(lineIndex) >= 0;
      })[0] || null
    );
  }
  /** the one blocker the person answers next, by the order they are asked; null when none of them is held */
  function askedNeedOf_(blockers) {
    return (
      ASKED_.filter(function (code) {
        return blockers.indexOf(code) >= 0;
      })[0] || null
    );
  }
  /** what the engine carried about a line besides its entry: the tax record, what made the proposal, the books entries it may already be */
  function carriedOf_(projected) {
    return { tax: projected.tax || null, basis: projected.basis || null, near: projected.near || [] };
  }
  /** the statement line (index i) joined to what the engine said about it, ready to paint and to post */
  function lineOf_(projected, statementLine, proposal, lockedMonth, toCreate) {
    var blockers = projected.blockers || [],
      closed = lockedMonth ? lockedMonth(statementLine.date) : null,
      named = partyProposalFor_(toCreate, projected.i);
    var item = {
      key: projected.ref,
      ref: projected.ref,
      i: projected.i,
      line: statementLine,
      entry: projected.entry || null,
      event: (proposal && proposal.event) || null, /* what POST /events takes: the proposal's own event, the one posting.post composed the entry from */
      needs: askedNeedOf_(blockers),
      blockers: blockers,
      closed: closed,
      party: projected.party ? Object.assign({}, projected.party) : null,
      didYouMean: (named && named.did_you_mean) || []
    };
    return Object.assign(item, carriedOf_(projected), standingOf_(projected, closed));
  }

  /* ── the controller's steps, each on its own: they take the options and the one state object `preview`, so create() only joins them ── */
  /** the words for why the page cannot work yet (the engine did not load); null when it can */
  function engineRefusal(opts) {
    var parts = opts.engine || {};
    var loaded = parts.recon && parts.recon.parse && parts.recon.match && parts.recon.suggest && parts.project && parts.project.project;
    return loaded ? null : 'The books engine for this page has not loaded, so nothing can be checked here yet.';
  }
  /**
   * the books' answer for every statement line: { held, near }.
   *   held  the line numbers the books already hold: match() found them, or the person PAIRED the line with a books entry (preview.pairs, by the line's ref) — { index: true }
   *   near  B5-02: for every other line, the unmatched books entries with the same amount and side nearby (the engine's nearMatches, 45 days), { index: [entry] }. Such a line is "may already be in
   *         your books", never ready: a cheque that cleared late, or one of two equal amounts, would otherwise be proposed again and posted twice. A pair the person made takes its entry out of
   *         every other line's list; "it is new" (preview.notMatch) takes the line out of the question.
   */
  function booksPass(opts, preview, lines, refs, bookLines) {
    var recon = opts.engine.recon,
      found = recon.match(lines, bookLines, { window_days: MATCH_WINDOW_DAYS }),
      held = {},
      taken = {};
    found.matched.forEach(function (pair) {
      pair.stmt.forEach(function (index) {
        held[index] = true;
      });
    });
    lines.forEach(function (line, index) {
      var entryId = preview.pairs[refs[index]];
      if (entryId == null || held[index]) return;
      held[index] = true;
      taken[entryId] = true;
    });
    var open = (found.unmatched_stmt || []).filter(function (line) {
        return !held[line.i] && !preview.notMatch[refs[line.i]];
      }),
      free = (found.unmatched_ledger || []).filter(function (entry) {
        return !taken[entry.id];
      });
    return { held: held, near: recon.nearMatches ? recon.nearMatches(open, free, {}) : {} };
  }
  /** the proposal for one line the books lack: what suggest() says, or, once the owner has answered the line, what CBBankEntry.resolve() composes from the answer (the same path, one taught rule) */
  function proposalFor(opts, preview, line, ref) {
    /* the person's tick (B5-01) and word on the tax invoice (B5-03) for THIS line ride into the same engine call */
    var suggestOpts = Object.assign({}, opts.suggestOpts, preview.answers, { confirmed: !!preview.ticks[ref], tax_invoice: preview.invoice[ref] }),
      asked = preview.resolved[ref],
      entry = opts.engine.entry;
    var proposal = opts.engine.recon.suggest(line, suggestOpts);
    if (!asked || !entry || !entry.resolve) return proposal;
    var answers = { party: asked.party && asked.party.id, party_name: asked.party && asked.party.name, account: asked.account, tax_kind: asked.tax_kind };
    var resolved = entry.resolve(line, answers, suggestOpts);
    if (resolved.ok === false) {
      preview.resolveRefusal[ref] = resolved.why;
      return proposal;
    }
    delete preview.resolveRefusal[ref];
    return resolved;
  }
  /** match against the books, a proposal for each line the books lack (null for a line already there), then the engine's preview of it all */
  function projectNow(opts, preview) {
    var books = opts.ledger(),
      lines = preview.parsed.lines,
      refs = opts.engine.project.refsOf(lines, opts.account, lines),
      pass = booksPass(opts, preview, lines, refs, books.lines);
    preview.proposals = lines.map(function (line, index) {
      return pass.held[index] ? null : proposalFor(opts, preview, line, refs[index]);
    });
    /* B5-05: the statement's currency is what the FILE or the person said, never the account's: with none the engine refuses (statement_currency_missing), with another it refuses (currency_mismatch) */
    var stated = (opts.statementCurrency && opts.statementCurrency()) || preview.parsed.currency || null;
    var statement = { currency: stated, opening_minor: preview.parsed.opening_minor, closing_minor: preview.parsed.closing_minor, skipped: preview.parsed.skipped || [] };
    return opts.engine.project.project(lines, preview.proposals, { currency: opts.currency, opening_minor: books.opening_minor, ledger: books.lines, statement: statement, account: opts.account, posted_refs: books.posted_refs || [], period_lines: lines, near: pass.near });
  }
  /** the owner's edit of a line's party (a new name or kind, or an existing party picked from did-you-mean) laid over what the engine said */
  function withPartyEdit(item, edit, asked) {
    if (edit && item.party) item.party = Object.assign({}, item.party, edit);
    if (asked && asked.party) item.party = Object.assign({}, asked.party);
    return item;
  }
  /** read the books again and project again; false (with the engine's words in preview.refusal) when the engine refuses */
  function projectAgain(opts, preview) {
    var out = projectNow(opts, preview);
    if (!out.ok) {
      Object.assign(preview, { refusal: out.why, projection: null, items: [] });
      return false;
    }
    preview.projection = out;
    preview.refusal = null;
    preview.items = out.lines.map(function (projected, index) {
      var item = lineOf_(projected, preview.parsed.lines[index], preview.proposals[index], opts.lockedMonth, out.parties_to_create || []);
      item.resolveWhy = preview.resolveRefusal[projected.ref] || null;
      return withPartyEdit(item, preview.partyEdits[projected.ref], preview.resolved[projected.ref]);
    });
    return true;
  }
  /** the lines a press would post: ready, and not already added in this session */
  function readyItems(preview) {
    return preview.items.filter(function (item) {
      return item.ready && !(preview.results[item.key] && preview.results[item.key].ok);
    });
  }
  /** how many NEW parties the press would make: one per distinct name and kind among the ready lines (two lines naming one payee make it once) */
  function newPartyCount(preview) {
    var seen = {};
    readyItems(preview).forEach(function (item) {
      if (item.party && item.party.status === 'new') seen[String(item.party.name).toLowerCase() + '|' + item.party.kind] = 1;
    });
    return Object.keys(seen).length;
  }
  /** what the press reaches: the engine's carried totals of the READY lines, the lines a closed month holds back, the lines that still need a person; null when the engine sent none */
  function reachOf(preview) {
    var totals = preview.projection && preview.projection.totals,
      counts = preview.projection && preview.projection.counts;
    if (!totals || !counts) return null;
    var held = preview.items.filter(function (item) {
      return item.closed;
    }).length;
    return { currency: preview.projection.currency, count: readyItems(preview).length, in: totals.in, out: totals.out, tax: totals.tax, from: totals.from, to: totals.to, needs_you: counts.needs_you, closed: held, newParties: newPartyCount(preview) };
  }
  /** the popup: count · in · out · date range · currency · new parties · how many still need you */
  function confirmWords(reach) {
    var amountOf = function (value) {
      return moneyText(value, reach.currency);
    };
    var parties = reach.newParties ? reach.newParties + (reach.newParties === 1 ? ' new party' : ' new parties') + ' made first' : null;
    var held = reach.closed ? ' ' + reach.closed + ' in a closed month are held back.' : '';
    return {
      title: 'Add ' + reach.count + (reach.count === 1 ? ' entry' : ' entries') + ' to your books?',
      lines: [
        'Money in: ' + amountOf(reach.in),
        'Money out: ' + amountOf(reach.out),
        minorOf(reach.tax) ? 'Tax inside these entries: ' + amountOf(reach.tax) : null, /* the engine's carried total of each ready line's own tax record (B5-03: the tax is on the popup too) */
        'Dated: ' + dateText(reach.from) + (reach.to && reach.to !== reach.from ? ' to ' + dateText(reach.to) : ''),
        'Currency: ' + reach.currency,
        parties,
        reach.needs_you + ' still need you. They are not added.' + held
      ].filter(Boolean)
    };
  }
  /** one adapter call, one line; a throw or a refusal is that line's reason, never the end of the others */
  async function postOne(opts, preview, item) {
    try {
      var reply = await opts.post(item);
      preview.results[item.key] = reply && reply.ok ? { ok: true, duplicate: !!reply.duplicate, entry_no: reply.entry_no || null } : { ok: false, why: (reply && reply.why) || 'Not added.' };
    } catch (failure) {
      preview.results[item.key] = { ok: false, why: (failure && failure.message) || 'Not added.' };
    }
  }
  /** post every ready line in order, tell the page after each (onLine(item, result)), then read the books again so the preview is the truth */
  async function postReady(opts, preview, onLine) {
    var todo = readyItems(preview);
    for (var position = 0; position < todo.length; position++) {
      await postOne(opts, preview, todo[position]);
      if (onLine) onLine(todo[position], preview.results[todo[position].key]);
    }
    projectAgain(opts, preview);
    var failed = todo.filter(function (item) {
      return !preview.results[item.key].ok;
    });
    return { tried: todo.length, added: todo.length - failed.length, failed: failed.length };
  }
  /** the words for why a statement text cannot be taken: engine not loaded, too big, or not a statement; null when it can */
  function textRefusal(opts, text) {
    var refusal = engineRefusal(opts);
    if (!refusal && typeof text === 'string' && text.length > MAX_FILE_BYTES) refusal = 'That file is too big for this page (2 MB at most).';
    return refusal;
  }
  /** the statement text parsed, or the words for why not: { parsed } | { refusal } */
  function readText(opts, text) {
    var refusal = textRefusal(opts, text);
    if (refusal) return { refusal: refusal };
    var parsed = opts.engine.recon.parse(text, opts.parseOpts || {});
    return parsed.ok ? { parsed: parsed } : { refusal: parsed.why || 'This file could not be read as a bank statement.' };
  }
  /** read the statement text; the state is filled and the first projection made, or the words for why not */
  function loadStatement(opts, preview, text, name) {
    Object.assign(preview, { results: {}, partyEdits: {}, resolved: {}, resolveRefusal: {}, ticks: {}, invoice: {}, pairs: {}, notMatch: {} });
    var read = readText(opts, text);
    if (!read.refusal) {
      Object.assign(preview, { parsed: read.parsed, name: name || '' });
      if (!projectAgain(opts, preview)) read.refusal = preview.refusal;
    }
    if (read.refusal) {
      preview.refusal = read.refusal;
      return { ok: false, why: read.refusal };
    }
    return { ok: true, count: read.parsed.lines.length, warnings: read.parsed.warnings || [] };
  }
  /** a new party needs a name; an existing party can be picked from the did-you-mean. The books are not touched. */
  function editParty(opts, preview, key, edit) {
    var picked = edit && edit.status === 'existing';
    var clean = picked ? { status: 'existing', id: edit.id, name: edit.name } : { status: 'new', name: String((edit && edit.name) || '').trim(), kind: edit && edit.kind };
    if (clean.status === 'new' && !clean.name) return { ok: false, why: 'Give the new party a name.' };
    preview.partyEdits[key] = clean;
    delete preview.resolveRefusal[key]; /* the owner changed this line: the old refusal no longer applies */
    projectAgain(opts, preview);
    return { ok: true };
  }
  /** the answers the owner gave for a line, as resolve() takes them: the party (new or existing), or an account from the chart (+ the tax kind on money out); or the words for what is missing */
  function answersOf(item, key, given) {
    if (given && given.account) return { answers: { account: given.account, tax_kind: given.tax_kind || undefined } };
    if (given) return { why: 'Pick an account from the list first.' };
    if (!item.party) return { why: 'Say who this is first.' };
    var party = item.party.status === 'existing' ? item.party : { status: 'new', name: item.party.name, kind: item.party.kind, id: 'new:' + key };
    return { answers: { party: party } };
  }
  /**
   * the owner has answered a "needs you" line (who it is, or which account and tax kind): the line is composed again through CBBankEntry.resolve, the one path.
   * A refusal (ours or the engine's) is kept against THAT line, in preview.resolveRefusal, until the owner changes the line: it survives every repaint.
   * A NEW party keeps its placeholder id until the adapter makes it. No new chart account: the account is one the chart already has.
   */
  function resolveLine(opts, preview, key, given) {
    var item = preview.items.filter(function (one) {
      return one.key === key;
    })[0];
    var read = item ? answersOf(item, key, given) : { why: 'This line is not on the statement.' };
    delete preview.resolveRefusal[key];
    if (read.answers) {
      preview.resolved[key] = read.answers;
      projectAgain(opts, preview);
    } else preview.resolveRefusal[key] = read.why;
    var refusalWords = preview.resolveRefusal[key];
    if (refusalWords) delete preview.resolved[key];
    if (refusalWords) projectAgain(opts, preview);
    return refusalWords ? { ok: false, why: refusalWords } : { ok: true };
  }
  /** a person's answer on one line (tick · tax invoice · pair · "it is new"): it is laid in the state, the engine is asked again, and the line says what it is now; refused for a line that is not on the statement */
  function answerLine(opts, preview, key, lay) {
    var known = preview.items.some(function (one) {
      return one.key === key;
    });
    if (!known) return { ok: false, why: 'This line is not on the statement.' };
    lay();
    projectAgain(opts, preview);
    return { ok: true };
  }
  /** the person's answers on one line, as controller methods: the tick (B5-01) · the word on the tax invoice (B5-03) · a pair with a books entry, or "it is new" (B5-02); each asks the engine again through answerLine */
  function answerMethods(opts, preview) {
    return {
      /** the person's tick: "yes, this is right" for a line only the bank's words proposed (B5-01) */
      tick: function (key) {
        return answerLine(opts, preview, key, function () {
          preview.ticks[key] = true;
        });
      },
      /** the person's word on the tax invoice for a line claiming a GST credit above the pack's threshold (B5-03): 'held' keeps the credit, 'none' books the whole amount to the expense */
      invoice: function (key, answer) {
        return answerLine(opts, preview, key, function () {
          preview.invoice[key] = answer === 'held' ? 'held' : 'none';
        });
      },
      /** B5-02: pair this statement line with the books entry (by its id) it already is, or say it is new */
      pair: function (key, entryId) {
        return answerLine(opts, preview, key, function () {
          preview.pairs[key] = entryId;
        });
      },
      notMatch: function (key) {
        return answerLine(opts, preview, key, function () {
          preview.notMatch[key] = true;
        });
      }
    };
  }
  /**
   * create(opts) → the preview controller.
   *   opts.engine   { recon: CBBankRecon, project: CBBankProject, entry: CBBankEntry }      opts.currency  the ACCOUNT's currency (from the shop, never the file)
   *   opts.account  the bank account's name (in every ref)               opts.ledger()  → { lines (each with its currency), opening_minor, posted_refs }, read again after posting
   *   opts.post(item) → Promise<{ ok, duplicate?, entry_no?, why? }>      opts.lockedMonth(date) → null | { month, words }
   *   opts.statementCurrency()  the currency the STATEMENT says it is in (the engine refuses a mismatch with the account); the file's own when it says, else NONE: it is never taken from the account (B5-05), the engine refuses with "say which currency"
   *   opts.suggestOpts / parseOpts   the pack, country, learned rules, parties — passed to the engine as given
   */
  function create(opts) {
    var preview = { proposals: [], parsed: null, projection: null, items: [], results: {}, name: '', refusal: null, answers: {}, partyEdits: {}, resolved: {}, resolveRefusal: {}, ticks: {}, invoice: {}, pairs: {}, notMatch: {} };
    return Object.assign(answerMethods(opts, preview), {
      load: function (text, name) {
        return loadStatement(opts, preview, text, name);
      },
      reach: function () {
        return reachOf(preview);
      },
      confirmText: function () {
        var reach = reachOf(preview);
        return reach ? confirmWords(reach) : null;
      },
      postReady: function (onLine) {
        return postReady(opts, preview, onLine);
      },
      editParty: function (key, edit) {
        return editParty(opts, preview, key, edit);
      },
      resolveLine: function (key, given) {
        return resolveLine(opts, preview, key, given);
      },
      answer: function (name, value) {
        preview.answers[name] = value;
        if (preview.parsed) projectAgain(opts, preview);
      },
      readyCount: function () {
        return readyItems(preview).length;
      },
      view: function () {
        return { name: preview.name, parsed: preview.parsed, projection: preview.projection, items: preview.items, results: preview.results, refusal: preview.refusal };
      }
    });
  }

  root.CBBankPreview = { create: create, moneyText: moneyText, minorOf: minorOf, dateText: dateText, STATE_WORDS: STATE_WORDS, NEEDS_WORDS: NEEDS_WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankPreview;
})(typeof globalThis !== 'undefined' ? globalThis : this);
