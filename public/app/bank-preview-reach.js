/* bank-preview-reach.js — BANK STATEMENT → BOOKS: what an Add press REACHES and the words of the confirm popup, for public/app/bank-preview.js.
 * OWNS      readyItems (the lines a press would post) · newPartyCount · oneLineReach · reachOf (the engine's carried totals of the ready lines, the closed-month hold-back, the lines that still need a person) · confirmWords (the popup's title and lines)
 * CALLED BY public/app/bank-preview.js (the one controller; node: required when the global is absent) · e2e/bank-preview.test.cjs through it. Loaded BEFORE bank-preview.js by public/accounts.html and public/bank-demo.html.
 * FLOW      preview.items + preview.projection.totals/counts → reachOf → confirmWords → the popup (CBLabKit.confirm); nothing is worked out here: every figure is the engine's, carried
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * ID        BKS014
 * OWNER     cb-finance
 * RISK      money
 * Split out of bank-preview.js (websplit 1129): behaviour unchanged, the same functions.
 */
(function (root) {
  'use strict';
  var Line = root.CBBankPreviewLine || (typeof require === 'function' ? require('./bank-preview-line.js') : null); /* loaded first */
  var minorOf = Line.minorOf,
    moneyText = Line.moneyText,
    dateText = Line.dateText;
  /** the lines a press would post: ready, and not already added in this session */
  function readyItems(preview) {
    return preview.items.filter(function (item) {
      return (!preview.only || item.key === preview.only) && item.ready && !(preview.results[item.key] && preview.results[item.key].ok);
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
  /** what the press reaches when ONE line is answered: that line's own carried figures (its amount and its tax record), not the statement's totals */
  function oneLineReach(preview, item) {
    var line = item ? item.line : {};
    return { currency: preview.projection.currency, count: item ? 1 : 0, in: line.credit_minor || 0, out: line.debit_minor || 0, tax: item && item.tax ? item.tax.tax_minor : 0, from: line.date || null, to: line.date || null, needs_you: 0, closed: 0, newParties: newPartyCount(preview), single: true };
  }
  /** what the press reaches: the engine's carried totals of the READY lines, the lines a closed month holds back, the lines that still need a person; null when the engine sent none */
  function reachOf(preview) {
    var totals = preview.projection && preview.projection.totals,
      counts = preview.projection && preview.projection.counts;
    if (!totals || !counts) return null;
    var held = preview.items.filter(function (item) {
      return item.closed;
    }).length;
    if (preview.only) return oneLineReach(preview, readyItems(preview)[0]);
    return { currency: preview.projection.currency, count: readyItems(preview).length, in: totals.in, out: totals.out, tax: totals.tax, from: totals.from, to: totals.to, needs_you: Math.max(0, counts.needs_you - held), closed: held, newParties: newPartyCount(preview) };
  }
  /** the popup: count · in · out · date range · currency · new parties · how many still need you */
  function confirmWords(reach, amountText) {
    var amountOf = function (value) {
      return amountText ? amountText(value) : moneyText(value, reach.currency); /* a host draws money its own way (the in-app Bank page: plain figures, the currency said once) */
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
        reach.single ? null : reach.needs_you + ' still need you; they are left out for now.' + held
      ].filter(Boolean)
    };
  }

  var reachKit = { readyItems: readyItems, newPartyCount: newPartyCount, oneLineReach: oneLineReach, reachOf: reachOf, confirmWords: confirmWords };
  root.CBBankPreviewReach = reachKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = reachKit;
})(typeof globalThis !== 'undefined' ? globalThis : this);
