/* ADOPTED from chitbridge-engines v1.98.0-l16sit.1 · bank-ask · sha256 774dab4412796128bd03ac07f919bf39dc4b8564f0a10896a2b11fb41cf600af — DO NOT EDIT HERE. Change it in chitbridge-engines, release a version, then run tools/adopt.cjs. */
/**
 * bank-ask.js: THE QUESTION A BANK LINE NOBODY EXPLAINED PUTS TO THE OTHER PARTY ON THE RAIL. PURE: no I/O, no clock, nothing sent.
 * OWNS      ask (the words and the chit send body of "which bill is this line?": only the date, the amount and the reference travel) · its date and amount wording
 * CALLED BY bank-recon.js (CBBankRecon.ask is a thin door onto it; the statement helpers it needs are handed in as `h`: bankOf · lineMoney · lineKey · side · dateOf · decimalsOf, so this file reads no statement and calls no sibling) · the web accounts screen through CBBankRecon.ask
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * Moved out of bank-recon.js unchanged (engines PR #151, to keep that file under its size ratchet); cb-finance owns the logic.
 */
(function (root) {
  'use strict';
  var QUERY_KIND = 'bank_query';
  var MON3_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dayWords_(h, value) {
    var isoDate = h.dateOf(value);
    return isoDate ? +isoDate.slice(8, 10) + ' ' + MON3_[+isoDate.slice(5, 7) - 1] + ' ' + isoDate.slice(0, 4) : '';
  }
  /** an amount for words: the currency CODE and the figure in the pack's number format (money.format's rule: the code, never a guessed symbol) */
  function amountWords_(h, minor, currency, pack) {
    var decimals = h.decimalsOf(currency),
      locale = (pack && pack.locale && pack.locale.format) || 'en-US';
    var figure = minor / Math.pow(10, decimals);
    var text;
    try {
      text = figure.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } catch (_) {
      text = figure.toFixed(decimals);
    }
    return (currency ? currency + ' ' : '') + text;
  }
  /**
   * ⭐ ask(line, { party: { id, name }, currency, me?, key?, pack?, country? }) → { ok, words, body } | { ok: false, why }
   *   The question a line nobody explained puts to the other party ON THE RAIL: "<CUR> 4,200.00 came into our bank on 12 Oct 2026, ref R —
   *   which bill is it for?" `body` is the chit send body (POST /api/chits/send): purpose 'general', client_ref 'bankask:<key>' (a retry answers
   *   the first chit), business_json { kind: 'bank_query', currency, bank_query: { key, side, amount_minor, currency, date, ref, words } }.
   *   ⭐ ONLY THREE FACTS TRAVEL — the date, the amount and the reference. The narration (and the rest of the statement) never leaves the device.
   *   Their answer is the payment advice they already send (M30), carrying the reference: explain() then settles the line by 'ref' — in both books.
   */
  function ask(line, opts, h) {
    var options = opts || {},
      statementLine = line || {},
      money = h.lineMoney(statementLine);
    var refusal = askRefusal_(options, money.debit, money.credit);
    if (refusal) return refusal;
    var bankRules = h.bankOf(options),
      pack = bankRules ? bankRules.pack : null;
    return askResult_(h, statementLine, options, money, pack, askCurrency_(options, pack));
  }
  /** the refusal when the line moves money both ways or neither, or no party was chosen; null when the question can be put */
  function askRefusal_(options, debit, credit) {
    if (debit > 0 === credit > 0) return { ok: false, why: 'a statement line has money going one way' };
    if (!options.party || !options.party.id) return { ok: false, why: 'choose who to ask' };
    return null;
  }
  /** the currency the question names: the one given, else the pack's, upper-case; null when neither */
  function askCurrency_(options, pack) {
    return String(options.currency || (pack && pack.currency) || '').toUpperCase() || null;
  }
  /** the question and the chit send body that carries it: only the date, the amount and the reference travel */
  function askResult_(h, statementLine, options, money, pack, currency) {
    var debit = money.debit,
      key = options.key || h.lineKey(statementLine),
      ref = statementLine.ref || statementLine.cheque_no || null,
      minor = debit || money.credit,
      side = h.side(debit);
    var amountText = amountWords_(h, minor, currency, pack),
      dayText = dayWords_(h, statementLine.date);
    var words = askWords_(options, amountText, dayText, ref, debit);
    return {
      ok: true,
      words: words,
      key: key,
      body: {
        recipients: [{ entity_id: options.party.id, role: 'to' }],
        purpose: 'general',
        manual_subject: 'Bank line ' + dayText + ' — which bill?',
        client_ref: 'bankask:' + key,
        message: words,
        business_json: {
          kind: QUERY_KIND,
          currency: currency,
          bank_query: { key: key, side: side, amount_minor: minor, currency: currency, date: statementLine.date || null, ref: ref, words: words }
        }
      }
    };
  }
  /** the question in words: money that came in asks which bill it is for, money that went out asks which bill it was for */
  function askWords_(options, amountText, dayText, ref, debit) {
    return !debit
      ? amountText +
          ' came into ' +
          (options.me ? options.me + "'s" : 'our') +
          ' bank on ' +
          dayText +
          (ref ? ', ref ' + ref : '') +
          ' — which bill is it for? Send the payment advice and both books settle.'
      : amountText +
          ' went from ' +
          (options.me ? options.me + "'s" : 'our') +
          ' bank to you on ' +
          dayText +
          (ref ? ', ref ' + ref : '') +
          ' — which bill was it for? Send the receipt advice and both books settle.';
  }

  var EXPORTS = { ask: ask };
  if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
  if (root && typeof root.window !== 'undefined') root.window.CBBankAsk = EXPORTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
