/* ADOPTED from chitbridge-engines v1.96.0 · bank-entry · sha256 64f8c5ad5fb8ac9b78009e8ce35855cccb9b01f0ca99e90c2cd3917615a2a771 — DO NOT EDIT HERE. Change it in chitbridge-engines, release a version, then run tools/adopt.cjs. */
/**
 * bank-entry.js: WHAT A BANK-LINE PROPOSAL'S ENTRY CARRIES: the shape of the entry posting.post composed, and the tax inside a tax-inclusive expense.
 * OWNS withTax (a taxed expense: the amount worked back through tax.splitLineTax, the tax handed to posting.post as input_tax) · entryOf (the composed entry as a proposal shows it) · newParty (a payee who is no party yet: proposed, never created here).
 * CALLED BY bank-recon.js (base → withTax, finish_ → entryOf) · bank-project.js reads the entry these make and nothing else.
 * FLOW bank statement → books, step "suggest" (docs/16-finance/BANK-TO-BOOKS-REQUIREMENT.md, Critic 14 Nov, item 3). CARD 16-finance/bank-reconciliation-and-bank-rail.
 * ONE calculation: no rate is written here and no tax is divided here. The rate and the credit rule are the pack's supply kind (pack.supplyKindOf), the sum is tax.splitLineTax,
 * the tax-invoice threshold is the pack's taxInvoice row (read on the line's own day by tax-packs.rowAsOf). A pack with no supply kinds, or with more than one tax head, gets no split.
 * An UNKNOWN stays unknown: a line whose kind nothing names carries no tax (never guessed), and the cash-or-accrual basis is not in any pack, so a taxed proposal says `needs: 'gst_basis'`.
 */
(function (root) {
  'use strict';
  var DEPS_ = {};
  /** a sibling engine, from node or from the page's global; null when it would not load (the callers then split nothing and say so) */
  function dep_(file, globalName) {
    if (DEPS_[file]) return DEPS_[file];
    var scope = typeof globalThis !== 'undefined' ? globalThis : root;
    if (scope[globalName] && typeof scope[globalName] === 'object' && Object.keys(scope[globalName]).length) return (DEPS_[file] = scope[globalName]);
    if (typeof require === 'function') {
      try {
        return (DEPS_[file] = require(file));
      } catch (loadFailure) {
        return null;
      }
    }
    return null;
  }
  /** the supply kind a proposal is taxed as: ONLY the one the person taught with the rule (event.tax_kind, "the tax code on the rule"); a fee is not taxable or input-taxed by its name. null names none */
  function kindNameOf_(event) {
    return event.tax_kind ? String(event.tax_kind) : null;
  }
  /** the tax-invoice answer for a credit claimed on this amount, on the line's own day; null when the pack keeps no such rule */
  function invoiceNeed_(pack, grossMinor, day) {
    if (typeof pack.taxInvoice !== 'function') return null;
    var rows = pack.tax && pack.tax.taxInvoice && pack.tax.taxInvoice.rows,
      packs = Array.isArray(rows) ? dep_('./tax-packs', 'CBTaxPacks') : null;
    var opt = packs && packs.rowAsOf ? { dated: true, row: packs.rowAsOf(rows, day) } : {};
    var answer = pack.taxInvoice(grossMinor, opt);
    return { required: !!answer.required, cite: answer.cite || null };
  }
  /** the amount and the tax inside it for one tax-inclusive line, through the one splitter; null when the tax engine is not there */
  function splitOf_(grossMajor, rate, currency) {
    var taxEngine = dep_('./tax', 'CBTax');
    if (!taxEngine || typeof taxEngine.splitLineTax !== 'function') return null;
    return taxEngine.splitLineTax({ net: grossMajor, rate: rate, priceIncludesTax: true, currency: currency, supply: 'domestic', split: false });
  }
  /**
   * withTax(event, ctx) → { event, tax }: the event as posting.post should compose it, and what was decided about its tax (null when nothing was).
   *   ctx { rule, pack, currency, minor (the amount on the statement, tax included), decimals, basis ('cash' | 'accrual' | undefined) }
   * An `expense` is split as an INPUT tax; an `other_income` (money in coded to an income class) as an OUTPUT tax (B5-04). The event handed in is not touched.
   * tax = { kind, rate, tax_minor, credit, direction: 'input' | 'output', basis, invoice: { required, cite } | null, invoice_answer: 'held' | 'none' | null }.
   * B5-03: ctx.invoice = 'held' (the person holds the tax invoice: the credit stands) | 'none' (no invoice: the whole figure is the expense, no credit) | undefined (asked: bank-recon says needs 'tax_invoice').
   */
  function withTax(event, ctx) {
    var income = !!event && event.type === 'other_income',
      kindName = event && (event.type === 'expense' || income) ? kindNameOf_(event) : null,
      pack = ctx.pack;
    if (!kindName || typeof pack.supplyKindOf !== 'function' || !Array.isArray(pack.taxHeads) || pack.taxHeads.length !== 1) return { event: event, tax: null };
    var kind = pack.supplyKindOf({ supply_kind: kindName });
    if (!kind) return { event: event, tax: null };
    var posted = Object.assign({}, event),
      tax = { kind: kind.id, rate: kind.rate, tax_minor: 0, credit: !income && !!kind.credit, direction: income ? 'output' : 'input', basis: ctx.basis || null, invoice: null, invoice_answer: null };
    delete posted.tax_kind;
    if (!(kind.rate > 0)) return { event: posted, tax: tax };
    var scale = Math.pow(10, ctx.decimals);
    if (tax.credit) tax.invoice = invoiceNeed_(pack, ctx.minor, posted.date);
    if (tax.invoice && tax.invoice.required && ctx.invoice === 'none') return { event: posted, tax: Object.assign(tax, { credit: false, invoice_answer: 'none' }) }; /* B5-03: no tax invoice, no credit: the whole figure is the expense */
    if (tax.invoice && tax.invoice.required && ctx.invoice === 'held') tax.invoice_answer = 'held';
    var split = splitOf_(ctx.minor / scale, kind.rate, ctx.currency);
    if (!split) return { event: event, tax: null };
    var head = {};
    head[pack.taxHeads[0]] = split.tax;
    tax.tax_minor = Math.round(split.tax * scale);
    posted.amount = (ctx.minor - tax.tax_minor) / scale; /* what is left of the statement figure, so amount + tax is always exactly the bank's figure */
    posted[income ? 'output_tax' : 'input_tax'] = Object.assign({ rate: kind.rate }, head); /* B5-04: money in carries the tax it collected through posting's output-tax path, the mirror of the expense's input tax */
    return { event: posted, tax: tax };
  }
  /** the entry posting.post composed, as the proposal shows it: its lines, whether Dr equals Cr, its totals and voucher type, in the owner-made series MJ */
  function entryOf(posted) {
    var debitTotal = 0,
      creditTotal = 0;
    posted.lines.forEach(function (item) {
      debitTotal += item.dr_minor;
      creditTotal += item.cr_minor;
    });
    return {
      lines: posted.lines.map(function (item) {
        return { code: item.code, account: item.account, party: item.party || null, dr_minor: item.dr_minor, cr_minor: item.cr_minor };
      }),
      balanced: debitTotal === creditTotal,
      dr_minor: debitTotal,
      cr_minor: creditTotal,
      voucher: posted.voucher,
      series: 'MJ'
    };
  }
  var LEGAL_WORDS_ = ['PTY', 'LTD', 'LIMITED', 'INC', 'CO', 'COMPANY', 'THE', 'AND'];
  /** a party name as it is compared: upper case, letters and digits only, the legal-form words left out ("Smith Pty Ltd" and "SMITH" meet) */
  function nameKey_(name) {
    return String(name || '')
      .toUpperCase()
      .replace(/&/g, ' AND ')
      .split(/[^A-Z0-9]+/)
      .filter(function (word) {
        return word && LEGAL_WORDS_.indexOf(word) < 0;
      })
      .join(' ');
  }
  /** how alike two normalised names are, 0..1: the Dice coefficient on character pairs (the same measure web csv-preflight uses; the engine cannot import it) */
  function likeness_(left, right) {
    var pairs = function (text) {
      var flat = text.replace(/ /g, ''),
        out = [];
      for (var at = 0; at < flat.length - 1; at++) out.push(flat.slice(at, at + 2));
      return out;
    };
    if (left === right) return 1;
    var first = pairs(left),
      second = pairs(right),
      total = first.length + second.length,
      shared = 0;
    first.forEach(function (pair) {
      var found = second.indexOf(pair);
      if (found >= 0) {
        shared++;
        second.splice(found, 1);
      }
    });
    return total ? (2 * shared) / total : 0;
  }
  var NEAR_AT_ = 0.6;
  /** the parties whose name is near this one, best first (at most three): [{ id, name, kind, score }] */
  function didYouMean_(key, parties) {
    if (!key) return [];
    return (parties || [])
      .map(function (item) {
        return { id: item.id || item.name, name: item.name || item.id, kind: item.kind || null, score: likeness_(key, nameKey_(item.name || item.id)) };
      })
      .filter(function (item) {
        return item.score >= NEAR_AT_;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 3);
  }
  /** the payee's name as the statement says it: its words that are neither the bank's own nor figures, in capitals-first form; null when nothing is left */
  function cleanName_(narration, ownWords) {
    var shown = /[a-z]/.test(String(narration || ''));
    var words = String(narration || '')
      .split(/[^A-Za-z0-9&]+/)
      .filter(function (word) {
        return word.length >= 2 && !/[0-9]/.test(word) && ownWords.indexOf(word.toUpperCase()) < 0;
      })
      .map(function (word) {
        return shown ? word : word.length <= 4 ? word : word.charAt(0) + word.slice(1).toLowerCase(); /* as the statement wrote it; an all-capitals statement keeps short words (ATO) and title-cases the rest */
      });
    return words.length ? words.join(' ') : null;
  }
  /**
   * newParty(line, { out, parties, ownWords }) → the party a line proposes, or null when the narration names nobody:
   *   { status: 'existing', id, name, kind } when the normalised name IS a party's (never proposed new, never in parties_to_create), else
   *   { status: 'new', name, kind: 'supplier' | 'customer', basis: 'direction', did_you_mean: [{ id, name, kind, score }] }
   * The kind is DERIVED from the side (money out = supplier, in = customer) and says so (basis), so a screen shows it editable. Near parties are listed FIRST
   * (did_you_mean, cut at 0.6 on character pairs: a near miss like Smith / Smyth scores 0.5 and is NOT offered, a known limit) so the person picks one rather than makes a duplicate; nothing is created here: a new party is the person's confirm. A new ACCOUNT is out for v1.
   */
  function newParty(line, ctx) {
    var name = cleanName_(line && line.narration, ctx.ownWords || []);
    if (!name) return null;
    var same = (ctx.parties || []).filter(function (item) {
      return nameKey_(item.name || item.id) === nameKey_(name);
    })[0];
    if (same) return { status: 'existing', id: same.id || same.name, name: same.name || same.id, kind: same.kind || null, did_you_mean: [] };
    return { status: 'new', name: name, kind: ctx.out ? 'supplier' : 'customer', basis: 'direction', did_you_mean: didYouMean_(nameKey_(name), ctx.parties) };
  }
  /** the event the owner's answers make of a line: an account picked (an expense class out, an income class in) or a party named (paid to / received from, by bank) */
  function eventOf_(answers, out) {
    if (answers.account && out) return { type: 'expense', class: answers.account, paid_from: 'bank', tax_kind: answers.tax_kind };
    if (answers.account) return { type: 'other_income', class: answers.account, into: 'bank', tax_kind: answers.tax_kind }; /* B5-04: money in names its tax kind too */
    return null;
  }
  /** B5-04: a pack with ONE tax head and supply kinds gives no default tax kind to a coded line: it is asked from the pack's own supply kinds, never assumed; null when it is given or the pack asks nothing */
  function taxKindMissing_(answers, opts) {
    var regulation = dep_('./regulation', 'CBRegulation'),
      pack = (opts && opts.pack) || (regulation && regulation.resolve ? regulation.resolve(opts || {}) : null);
    var asks = pack && typeof pack.supplyKindOf === 'function' && Array.isArray(pack.taxHeads) && pack.taxHeads.length === 1;
    return answers.account && asks && !answers.tax_kind ? "say the tax kind for this line, from the pack's own list; it is never assumed" : null;
  }
  /**
   * resolve(line, answers, opts) → the proposal for a line the engine could not explain, once the owner has answered:
   *   answers { party?: id, party_name?, account?: a class of the chart (never a new account), tax_kind?: the supply kind the owner codes it (with an account on money out) }
   *   opts    the same as suggest(): { country | pack, parties, learned, gst_basis, ... }
   * NO second calculation: the answers become ONE taught rule (bank-recon.learn) and the line goes through bank-recon.suggest, so the entry is composed by posting.post and its tax split by
   * withTax exactly as every other proposal. The result is that proposal plus `taught` (the rule to keep on the device so the next line like it is explained), or { ok: false, why } when the
   * answers name no party and no account, or the narration has no word to teach by.
   */
  function resolve(line, answers, opts) {
    var recon = dep_('./bank-recon', 'CBBankRecon'),
      given = answers || {},
      out = (+line.debit_minor || 0) > 0;
    var event = eventOf_(given, out);
    if (!recon || (!event && !given.party)) return { ok: false, why: 'say which party it is, or which account it goes to' };
    var missing = taxKindMissing_(given, opts);
    if (missing) return { ok: false, why: missing };
    var taught = recon.learn(line, { party: given.party, party_name: given.party_name, event: event }, Object.assign({ at: (opts && opts.at) || null, by: (opts && opts.by) || null }, opts));
    if (!taught.ok) return { ok: false, why: taught.why };
    return Object.assign({ taught: taught.rule }, recon.suggest(line, Object.assign({}, opts, { learned: [taught.rule].concat((opts && opts.learned) || []) })));
  }
  var EXPORTS = { withTax: withTax, entryOf: entryOf, newParty: newParty, resolve: resolve, nameKey: nameKey_ };
  /* ⭐ ONE FILE, EVERY HOST: node takes module.exports; a page takes window.CBBankEntry. */
  if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
  if (root && typeof root.window !== 'undefined') root.window.CBBankEntry = EXPORTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
