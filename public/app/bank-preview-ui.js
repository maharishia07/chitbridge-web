/* bank-preview-ui.js — the ONE painter of the Bank-to-books statement lines (shared by the no-login demo and the in-app Bank sheet).
 * OWNS      the statement-lines table of a CBBankPreview controller: each line's state tag, the entry it would make (account and tax in words), the ONE question it asks next
 *           (already in the books? · cash or accrual · tax invoice · is this right · what tax is this), the party box, the account box, the rows the file lost; and the clicks
 *           and changes on those controls. It paints what the controller carries and sends each answer back to the controller; it works out no money and no tax.
 * CALLED BY public/app/bank-demo.js (the demo page) · public/app/cap-bank-sheet.js (the in-app Bank view)
 * FLOW      mount({ host, controller, currency, country, say, changed }) → paint(model, results) → a click or change on host → the controller's answer method → say(words) if refused → changed()
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  BKS017-B03 use an existing party · BKS017-B04 GST on cash · BKS017-B05 GST on accrual · BKS017-B07 use this party · BKS017-B08 use this account · BKS017-B09 yes, this is right
 *           BKS017-B10/B11 tax invoice held / not held · BKS017-B12 same payment · BKS017-B13 it is new · BKS017-B15 use this tax · BKS017-I02 new party name · BKS017-S04 new party kind
 *           BKS017-S05 account · BKS017-S06 tax kind · BKS017-S08 the tax a line carries
 * ⭐ Written for pages with no inline script (the demo's CSP): everything is data-act on a button, one delegated listener on the host.
 */
(function (root) {
  'use strict';
  var preview = root.CBBankPreview;
  /** the choice that says a line is neither an income nor an expense (a tax payment, a loan, drawings, a transfer between own accounts): it has no account here, the owner adds it with + Entry */
  var NOT_INCOME_OR_EXPENSE = '__other__';
  /* the one escaper: public/app/helpers.js (loaded before this file on accounts.html and bank-demo.html) */
  var ESC = function (value) { return root.esc(value); };

  /** the painter for one mount: it reads its currency and country once, so no tax name or money unit is written here */
  function painter(cfg) {
    var esc = ESC;
    var amountText = function (value) {
      return preview.moneyText(value, cfg.currency);
    };
    var tag = function (kind, words) {
      return '<span class="bd-tag bd-' + kind + '">' + esc(words) + '</span>';
    };
    var dataKey = function (item) {
      return ' data-key="' + esc(item.key) + '"';
    };
    /** the pack's own word for its tax (CBCountries.meta(country).words.taxName), so no tax name is written here; plain "tax" when the pack says none */
    function taxWordOf() {
      var meta = root.CBCountries && root.CBCountries.meta && root.CBCountries.meta(cfg.country);
      return (meta && meta.words && meta.words.taxName) || 'tax';
    }
    /** the tax a proposal carries, in words: tax collected or paid, the invoice it needs, or that no credit is claimed */
    function taxWordsOf(taxRecord) {
      if (!taxRecord) return '';
      var taxWord = taxWordOf();
      if (taxRecord.invoice_answer === 'none') return ' No ' + taxWord + ' credit: you hold no tax invoice.';
      if (!taxRecord.tax_minor) return '';
      var invoice = taxRecord.invoice && taxRecord.invoice.required ? ', tax invoice required' + (taxRecord.invoice_answer === 'held' ? ', you hold it' : '') : '';
      return ' ' + (taxRecord.direction === 'output' ? taxWord + ' collected ' : taxWord + ' ') + amountText(taxRecord.tax_minor) + ' (' + String(taxRecord.kind).replace(/_/g, ' ') + ')' + invoice + '.';
    }
    /** the entry a proposed line would make, in words: each leg's account and amount, and the tax it carries (shown on the row, ready or not) */
    function entryNote(item) {
      if (!item.entry) return '';
      var legs = item.entry.lines
        .map(function (leg) {
          return (leg.dr_minor ? 'Dr' : 'Cr') + ' ' + String(leg.account).replace(/_/g, ' ') + ' ' + amountText(leg.dr_minor || leg.cr_minor);
        })
        .join(' · ');
      return '<span class="bd-why bd-entry">' + esc(legs + '.' + taxWordsOf(item.tax)) + '</span> ';
    }
    /** the chart the owner may pick from, read from the country pack (never a new account): expense and income classes, and the tax kinds */
    function chartOf() {
      var pack = root.CBRegulation && root.CBRegulation.resolve({ country: cfg.country });
      if (!pack) return { expense: [], income: [], taxKinds: [] };
      var kinds = (pack.tax && pack.tax.supplyKinds) || {};
      return { expense: pack.expense_classes || [], income: pack.income_classes || [], taxKinds: Object.keys(kinds).map(function (id) { return { id: id, name: kinds[id].name }; }) };
    }
    function optionsOf(list, valueOf, nameOf) {
      return '<option value="">Choose</option>' + list.map(function (one) { return '<option value="' + esc(valueOf(one)) + '">' + esc(nameOf(one)) + '</option>'; }).join('');
    }
    /** B5-02: books entries with this amount and side nearby: pair the line with the one it is, or say it is new */
    function nearBox(item) {
      var entries = (item.near || [])
        .map(function (one) {
          return '<button data-cbsid="BKS017-B12" type="button" class="bd-btn" data-act="pair"' + dataKey(item) + ' data-id="' + esc(one.id) + '">Same payment: ' + esc(preview.dateText(one.date)) + ' ' + esc(one.narration) + ' ' + esc(one.entry_no || '') + ' (' + one.gap_days + ' days apart)</button>';
        })
        .join(' ');
      return '<span class="bd-ask">May already be in your books. Is it one of these?</span> ' + entries + ' <button data-cbsid="BKS017-B13" type="button" class="bd-btn" data-act="notmatch"' + dataKey(item) + '>No, it is new</button>';
    }
    /** B5-03: a tax credit above the pack's threshold waits for the tax invoice */
    function invoiceQuestion(item) {
      return (
        '<span class="bd-ask">' + esc('This claims ' + amountText(item.tax.tax_minor) + ' ' + taxWordOf() + ' and needs a tax invoice. Do you hold it?') + '</span> ' +
        '<button data-cbsid="BKS017-B10" type="button" class="bd-btn" data-act="inv" data-v="held"' + dataKey(item) + '>Yes, I hold it</button> ' +
        '<button data-cbsid="BKS017-B11" type="button" class="bd-btn" data-act="inv" data-v="none"' + dataKey(item) + '>No: book it without the ' + taxWordOf() + ' credit</button>'
      );
    }
    /** B5-01: only the words on the bank line proposed this, no rule you taught and no party you know: it is added only when you say it is right */
    function tickBox(item) {
      return '<span class="bd-ask">' + esc('Only the words on the line proposed this: ' + (item.why || '')) + '</span> <button data-cbsid="BKS017-B09" type="button" class="bd-btn" data-act="tick"' + dataKey(item) + '>Yes, this is right</button>';
    }
    function basisQuestion() {
      return (
        '<span class="bd-ask">' + esc('Is your GST on a cash or an accrual basis?') + '</span> ' +
        '<button data-cbsid="BKS017-B04"' + (cfg.gstIds ? ' id="bd_gst_cash"' : '') + ' type="button" class="bd-btn" data-act="gst" data-v="cash">Cash</button> ' +
        '<button data-cbsid="BKS017-B05"' + (cfg.gstIds ? ' id="bd_gst_accrual"' : '') + ' type="button" class="bd-btn" data-act="gst" data-v="accrual">Accrual</button>'
      );
    }
    /** FIN-116: a money-out line the bank's words proposed carries no tax until the owner says what tax it is: the pack's own kinds, chosen here, never a default; the answer goes through the controller (resolve: one taught rule, the one splitter) */
    function taxKindBox(item) {
      var kinds = chartOf().taxKinds;
      if (!kinds.length) return '<span class="bd-why">' + esc('No ' + taxWordOf() + ' kinds are set for this country, so nothing is claimed on this line.') + '</span>';
      return (
        '<span class="bd-ask">' + esc('Does this carry ' + taxWordOf() + '? Say what kind it is.') + '</span> ' +
        '<select data-cbsid="BKS017-S08" class="bd-inp" aria-label="' + esc(taxWordOf() + ' kind') + '" data-act="taxkind1" data-key="' + esc(item.key) + '">' + optionsOf(kinds, function (one) { return one.id; }, function (one) { return one.name; }) + '</select> ' +
        '<button data-cbsid="BKS017-B15" type="button" class="bd-btn" data-act="taxuse"' + dataKey(item) + '>Use this</button>'
      );
    }
    /** the one question a held-back line asks next */
    function askedBox(item) {
      if (item.needs === 'may_be_in_books') return nearBox(item);
      if (item.needs === 'gst_basis') return basisQuestion();
      if (item.needs === 'tax_invoice') return invoiceQuestion(item);
      if (item.needs === 'needs_tick') return tickBox(item);
      if (item.needs === 'tax_kind') return taxKindBox(item);
      return '';
    }
    /** what a line says under its state: the entry it would make, the ONE question it asks next, and every other thing holding it back (none is dropped) */
    function lineNote(item, result) {
      if (result) return result.ok ? tag('ok', cfg.addedWords || 'Added') : tag('bad', 'Not added: ' + result.why);
      if (item.state === 'closed') return tag('bad', item.why);
      var asked = askedBox(item),
        others = (item.blockers || [])
          .filter(function (code) {
            return code !== 'no_entry' && code !== item.needs;
          })
          .map(function (code) {
            return tag('ask', preview.NEEDS_WORDS[code] || code);
          })
          .join(' ');
      var reason = item.state === 'needs_you' && !asked ? '<span class="bd-why">' + esc(item.why || 'Nothing here says who or what this is.') + '</span>' : '';
      return entryNote(item) + asked + (others ? ' ' + others : '') + reason;
    }
    function partyBox(item) {
      var party = item.party;
      if (!party || party.status !== 'new') return party ? '<span class="bd-why">Party: ' + esc(party.name) + '</span>' : '';
      var meant = (item.didYouMean || [])
        .map(function (one) {
          return '<button data-cbsid="BKS017-B03" type="button" class="bd-btn bd-meant" data-act="meant" data-key="' + esc(item.key) + '" data-id="' + esc(one.id) + '" data-name="' + esc(one.name) + '">Use ' + esc(one.name) + '</button>';
        })
        .join(' ');
      return (
        '<span class="bd-party"><b>New party:</b> <input data-cbsid="BKS017-I02" class="bd-inp" type="text" maxlength="120" aria-label="New party name" data-act="pname" data-key="' + esc(item.key) + '" value="' + esc(party.name) + '"> ' +
        '<select data-cbsid="BKS017-S04" class="bd-inp" aria-label="New party kind" data-act="pkind" data-key="' + esc(item.key) + '">' +
        ['supplier', 'customer'].map(function (kind) { return '<option value="' + kind + '"' + (party.kind === kind ? ' selected' : '') + '>' + kind + '</option>'; }).join('') +
        '</select> <button data-cbsid="BKS017-B07" type="button" class="bd-btn" data-act="resolve" data-key="' + esc(item.key) + '">Use this party</button> ' + (meant ? '<span class="bd-why">Did you mean</span> ' + meant : '') + '</span>'
      );
    }
    /** B5-04: for a line nothing explained: money out goes to an expense class, money in to an income class, and BOTH name their tax kind (the pack's, never a default); the answer goes through resolve() */
    function accountBox(item) {
      if (item.state !== 'needs_you' || item.entry) return '';
      var out = item.line.debit_minor > 0,
        chart = chartOf(),
        key = esc(item.key),
        none = '<option value="' + NOT_INCOME_OR_EXPENSE + '">' + (out ? 'Not an expense (tax, loan, drawings, transfer)' : 'Not income (loan, capital, transfer)') + '</option>';
      return (
        '<span class="bd-party"><b>Or an account:</b> <select data-cbsid="BKS017-S05" class="bd-inp" aria-label="Account" data-act="acct" data-key="' + key + '">' +
        optionsOf(out ? chart.expense : chart.income, function (one) { return one.role; }, function (one) { return one.name; }).replace('</option>', '</option>' + none) + '</select> ' +
        '<select data-cbsid="BKS017-S06" class="bd-inp" aria-label="Tax kind" data-act="taxkind" data-key="' + key + '">' + optionsOf(chart.taxKinds, function (one) { return one.id; }, function (one) { return one.name; }) + '</select> ' +
        '<button data-cbsid="BKS017-B08" type="button" class="bd-btn" data-act="useacct" data-key="' + key + '">Use this account</button></span>'
      );
    }
    /** the state a row is painted in: what happened to it when added, else its state; a proposal something still holds back is never painted "Ready to add" */
    function stateKeyOf(item, result) {
      if (result) return result.ok ? 'posted' : 'failed';
      return item.state === 'proposed' && !item.ready ? 'check' : item.state;
    }
    function lineRow(item, results) {
      var line = item.line,
        result = results[item.key],
        stateKey = stateKeyOf(item, result);
      return (
        '<tr class="bd-row bd-s-' + esc(stateKey) + '" data-line="' + esc(item.key) + '"><td class="bd-d">' + esc(preview.dateText(line.date)) + '</td><td class="bd-n">' + esc(line.narration) + '</td>' +
        '<td class="bd-m">' + (line.debit_minor ? esc(amountText(line.debit_minor)) : '') + '</td><td class="bd-m">' + (line.credit_minor ? esc(amountText(line.credit_minor)) : '') + '</td>' +
        '<td class="bd-st">' + tag(stateKey === 'posted' ? 'ok' : stateKey === 'proposed' ? 'go' : stateKey === 'in_books' ? 'plain' : 'ask', preview.STATE_WORDS[stateKey] || 'Needs you') +
        '<div class="bd-sub">' + partyBox(item) + accountBox(item) + (item.resolveWhy ? tag('bad', item.resolveWhy) : '') + lineNote(item, result) + '</div></td></tr>'
      );
    }
    /** B5-06: every row the file lost, by its row number, and every other warning the reader made; never hidden */
    function skipBox(model) {
      var parsed = model.parsed || {},
        skipped = parsed.skipped || [],
        other = (parsed.warnings || []).filter(function (words) {
          return !/ skipped$/.test(words);
        });
      if (!skipped.length && !other.length) return '';
      var rows = skipped.map(function (one) { return '<li class="bd-skip-row"><b>Row ' + one.row + ' was not read:</b> ' + esc(one.why) + '</li>'; }).concat(other.map(function (words) { return '<li>' + esc(words) + '</li>'; })).join('');
      return (
        '<div class="bd-skip" role="alert" data-testid="bd-skip"><p><b>' + (skipped.length ? skipped.length + (skipped.length === 1 ? ' row' : ' rows') + ' of your file ' + (skipped.length === 1 ? 'was' : 'were') + ' not read.' : 'The reader noted:') + '</b>' +
        (skipped.length ? ' Check them against the bank. The reconciliation cannot say tied while a row is missing.' : '') + '</p><ul>' + rows + '</ul></div>'
      );
    }
    return {
      skipBox: skipBox,
      chartOf: chartOf,
      taxWordOf: taxWordOf,
      linesHtml: function (model) {
        return (
          skipBox(model) +
          '<table class="bd-table"><thead><tr><th>Date</th><th>What the bank says</th><th>Out</th><th>In</th><th>In your books?</th></tr></thead><tbody>' +
          model.items.map(function (item) { return lineRow(item, model.results); }).join('') + '</tbody></table>'
        );
      }
    };
  }

  /**
   * mount(cfg) → { paint(), chosenFor }
   *   cfg.host        the element the lines are painted into (clicks and changes are listened for on it)
   *   cfg.controller  () → the CBBankPreview controller now in use
   *   cfg.currency · cfg.country · cfg.addedWords (what an added line says)
   *   cfg.say(words)  where a refusal is shown                      cfg.changed()  called after every answer, so the host paints its other panes
   */
  function mount(cfg) {
    var paintLines = painter(cfg);
    var host = cfg.host;
    function chosenFor(action, key) {
      var found = Array.prototype.filter.call(host.querySelectorAll('select[data-act="' + action + '"]'), function (one) { return one.getAttribute('data-key') === key; })[0];
      return found ? found.value : '';
    }
    /** the owner picked an account and a tax kind for a line nothing explained; "not income or expense" is no account here (B5-04) */
    function useAccount(key) {
      var account = chosenFor('acct', key);
      if (account === NOT_INCOME_OR_EXPENSE) return { ok: false, why: 'A tax payment, loan, drawings or a transfer between your own accounts is not booked here yet. Add it with + Entry in the app.' };
      return cfg.controller().resolveLine(key, { account: account, tax_kind: chosenFor('taxkind', key) });
    }
    /** FIN-116: the tax kind for a line the bank's words proposed: its own class (the proposal's, never a literal) with the chosen kind, through resolve() */
    function useTax(key) {
      var item = cfg.controller().view().items.filter(function (one) { return one.key === key; })[0],
        kind = chosenFor('taxkind1', key);
      if (!kind) return { ok: false, why: 'Choose what kind of ' + paintLines.taxWordOf() + ' this is first.' };
      if (!item || !item.event || !item.event.class) return { ok: false, why: 'This line has no account to carry the tax on.' };
      return cfg.controller().resolveLine(key, { account: item.event.class, tax_kind: kind });
    }
    /** what each button does, by its data-act: it reads its own attributes and answers { ok, why } when the controller refuses, nothing otherwise */
    var ACTIONS = {
      gst: function (key, target) { return cfg.controller().answer('gst_basis', target.getAttribute('data-v')); },
      meant: function (key, target) { return cfg.controller().editParty(key, { status: 'existing', id: target.getAttribute('data-id'), name: target.getAttribute('data-name') }); },
      resolve: function (key) { return cfg.controller().resolveLine(key); },
      useacct: useAccount,
      taxuse: useTax,
      tick: function (key) { return cfg.controller().tick(key); },
      inv: function (key, target) { return cfg.controller().invoice(key, target.getAttribute('data-v')); },
      pair: function (key, target) { return cfg.controller().pair(key, target.getAttribute('data-id')); },
      notmatch: function (key) { return cfg.controller().notMatch(key); }
    };
    function onClick(event) {
      var target = event.target.closest('[data-act]');
      if (!target) return;
      var act = ACTIONS[target.getAttribute('data-act')];
      if (!act) return;
      var said = act(target.getAttribute('data-key'), target);
      if (said && said.ok === false) cfg.say(said.why);
      else cfg.say('');
      cfg.changed();
    }
    function onChange(event) {
      var field = event.target,
        act = field.getAttribute && field.getAttribute('data-act'),
        key = field.getAttribute && field.getAttribute('data-key');
      if (act !== 'pname' && act !== 'pkind') return;
      var party = cfg.controller().view().items.filter(function (one) { return one.key === key; })[0].party;
      var said = cfg.controller().editParty(key, { name: act === 'pname' ? field.value : party.name, kind: act === 'pkind' ? field.value : party.kind });
      if (!said.ok) cfg.say(said.why);
      cfg.changed();
    }
    host.addEventListener('click', onClick);
    host.addEventListener('change', onChange);
    return {
      paint: function (model) {
        host.innerHTML = paintLines.linesHtml(model);
      },
      skipBox: paintLines.skipBox,
      chosenFor: chosenFor
    };
  }

  root.CBBankPreviewUI = { mount: mount, NOT_INCOME_OR_EXPENSE: NOT_INCOME_OR_EXPENSE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankPreviewUI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
