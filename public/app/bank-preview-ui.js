/* bank-preview-ui.js — the ONE painter of the Bank-to-books statement lines (shared by the no-login demo and the in-app Bank sheet).
 * OWNS      the statement-lines table of a CBBankPreview controller: each line's state tag, the entry it would make (account and tax in words), the ONE question it asks next
 *           (already in the books? · cash or accrual · tax invoice · is this right · what tax is this), the party box, the account box, the rows the file lost; and the clicks
 *           and changes on those controls. It paints what the controller carries and sends each answer back to the controller; it works out no money and no tax.
 * CALLED BY public/app/bank-demo.js (the demo page) · public/app/cap-bank-sheet.js (the in-app Bank view)
 * FLOW      mount({ host, controller, currency, country, say, changed }) → paint(model, results) → a click or change on host → the controller's answer method → say(words) if refused → changed()
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  BKS017-B03 use an existing party · BKS017-B04 GST on cash · BKS017-B05 GST on accrual · BKS017-B07 use this party · BKS017-B08 use this account · BKS017-B09 yes, this is right
 *           BKS017-B10/B11 tax invoice held / not held · BKS017-B12 same payment · BKS017-B13 it is new · BKS017-B15 use this tax · BKS017-B18 add a line the sheet cannot finish as its own entry · BKS017-B19 what this line is (one step) · BKS017-S10 which account that answer names · BKS017-I02 new party name · BKS017-S04 new party kind
 *           BKS017-S05 account · BKS017-S06 tax kind · BKS017-S08 the tax a line carries
 * ⭐ Written for pages with no inline script (the demo's CSP): everything is data-act on a button, one delegated listener on the host.
 */
(function (root) {
  'use strict';
  var preview = root.CBBankPreview;
  /** the choice that says a line is neither an income nor an expense (a tax payment, a loan, drawings, a transfer between own accounts): it has no account here, the owner adds it with + Entry */
  var NOT_INCOME_OR_EXPENSE = '__other__';
  /** a line already in the books: who put it there and when, in the check's words; '' for any other line */
  function alreadyNote(item, escapeHtml) {
    return item.state === 'in_books' && item.alreadyWhy ? '<span class="bd-why">' + escapeHtml(String(item.alreadyWhy).replace(/s*((?:ref )?bank:[^)]*)/g, '')) + '</span>' : ''; /* the line's internal reference is not for the reader */
  }
  /** every other thing holding a line back besides its entry and its one question, as tags */
  function otherNeeds(item, tag) {
    return (item.blockers || [])
      .filter(function (code) {
        return code !== 'no_entry' && code !== item.needs;
      })
      .map(function (code) {
        return tag('ask', preview.NEEDS_WORDS[code] || code);
      })
      .join(' ');
  }
  /** the words of a line: the pack's tax name, the tax it carries, the entry it would make, the chart the owner picks from; each function lands on the one shared `ctx` */
  function addWords(ctx) {
    var cfg = ctx.cfg, escapeHtml = ctx.escapeHtml, amountText = ctx.amountText;
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
    /** a leg's account in words: the pack's role (bank_charges → bank charges), or the name of the shop's own ledger the leg carries by code (a savings account the owner added) */
    function legName(leg) {
      var raw = leg.account != null ? leg.account : leg.code != null ? leg.code : leg.ledger,
        own = (cfg.ownAccounts ? cfg.ownAccounts() : []).filter(function (one) { return String(one.code) === String(raw); })[0];
      return own ? own.name : String(raw == null ? 'account' : raw).replace(/_/g, ' ');
    }
    function entryNote(item) {
      if (!item.entry) return '';
      var legs = item.entry.lines
        .map(function (leg) {
          return (leg.dr_minor ? 'Dr' : 'Cr') + ' ' + legName(leg) + ' ' + amountText(leg.dr_minor || leg.cr_minor);
        })
        .join(' · ');
      return '<span class="bd-why bd-entry">' + escapeHtml(legs + '.' + taxWordsOf(item.tax)) + '</span> ';
    }
    /** the chart the owner may pick from, read from the country pack (never a new account): expense and income classes, and the tax kinds */
    function chartOf() {
      var pack = root.CBRegulation && root.CBRegulation.resolve({ country: cfg.country });
      if (!pack) return { expense: [], income: [], taxKinds: [] };
      var kinds = (pack.tax && pack.tax.supplyKinds) || {};
      return { expense: pack.expense_classes || [], income: pack.income_classes || [], taxKinds: Object.keys(kinds).map(function (id) { return { id: id, name: kinds[id].name }; }) };
    }
    function optionsOf(list, valueOf, nameOf) {
      return '<option value="">Choose</option>' + list.map(function (one) { return '<option value="' + escapeHtml(valueOf(one)) + '">' + escapeHtml(nameOf(one)) + '</option>'; }).join('');
    }
    Object.assign(ctx, { taxWordOf, taxWordsOf, entryNote, chartOf, optionsOf });
  }
  /** the questions a held-back line asks: pair with a books entry, the tax invoice, the tick, the GST basis; each function lands on the one shared `ctx` */
  function addQuestions(ctx) {
    var cfg = ctx.cfg, escapeHtml = ctx.escapeHtml, amountText = ctx.amountText, dataKey = ctx.dataKey, taxWordOf = ctx.taxWordOf;
    /** B5-02: books entries with this amount and side nearby: pair the line with the one it is, or say it is new */
    function nearBox(item) {
      var entries = (item.near || [])
        .map(function (one) {
          return '<button data-cbsid="BKS017-B12" type="button" class="bd-btn" data-act="pair"' + dataKey(item) + ' data-id="' + escapeHtml(one.id) + '">Same payment: ' + escapeHtml(preview.dateText(one.date)) + ' ' + escapeHtml(one.narration) + ' ' + escapeHtml(one.entry_no || '') + ' (' + one.gap_days + ' days apart)</button>';
        })
        .join(' ');
      return '<span class="bd-ask">May already be in your books. Is it one of these?</span> ' + entries + ' <button data-cbsid="BKS017-B13" type="button" class="bd-btn" data-act="notmatch"' + dataKey(item) + '>No, it is new</button>';
    }
    /** B5-03: a tax credit above the pack's threshold waits for the tax invoice */
    function invoiceQuestion(item) {
      return (
        '<span class="bd-ask">' + escapeHtml('This claims ' + amountText(item.tax.tax_minor) + ' ' + taxWordOf() + ' and needs a tax invoice. Do you hold it?') + '</span> ' +
        '<button data-cbsid="BKS017-B10" type="button" class="bd-btn" data-act="inv" data-v="held"' + dataKey(item) + '>Yes, I hold it</button> ' +
        '<button data-cbsid="BKS017-B11" type="button" class="bd-btn" data-act="inv" data-v="none"' + dataKey(item) + '>No: book it without the ' + taxWordOf() + ' credit</button>'
      );
    }
    /** B5-01: only the words on the bank line proposed this, no rule you taught and no party you know: it is added only when you say it is right */
    function tickBox(item) {
      return '<span class="bd-ask">' + escapeHtml('Only the words on the line proposed this: ' + (item.why || '')) + '</span> <button data-cbsid="BKS017-B09" type="button" class="bd-btn" data-act="tick"' + dataKey(item) + '>Yes, this is right</button>';
    }
    function basisQuestion() {
      return (
        '<span class="bd-ask">' + escapeHtml('Is your GST on a cash or an accrual basis?') + '</span> ' +
        '<button data-cbsid="BKS017-B04"' + (cfg.gstIds ? ' id="bd_gst_cash"' : '') + ' type="button" class="bd-btn" data-act="gst" data-v="cash">Cash</button> ' +
        '<button data-cbsid="BKS017-B05"' + (cfg.gstIds ? ' id="bd_gst_accrual"' : '') + ' type="button" class="bd-btn" data-act="gst" data-v="accrual">Accrual</button>'
      );
    }
    Object.assign(ctx, { nearBox, invoiceQuestion, tickBox, basisQuestion });
  }
  /** the tax kind question, the ONE question a held-back line asks next, and the note under a line; each function lands on the one shared `ctx` */
  function addAsks(ctx) {
    var cfg = ctx.cfg, escapeHtml = ctx.escapeHtml, amountText = ctx.amountText, tag = ctx.tag, dataKey = ctx.dataKey, taxWordOf = ctx.taxWordOf, chartOf = ctx.chartOf, optionsOf = ctx.optionsOf, entryNote = ctx.entryNote, nearBox = ctx.nearBox, invoiceQuestion = ctx.invoiceQuestion, tickBox = ctx.tickBox, basisQuestion = ctx.basisQuestion;
    /** FIN-116: a money-out line the bank's words proposed carries no tax until the owner says what tax it is: the pack's own kinds, chosen here, never a default; the answer goes through the controller (resolve: one taught rule, the one splitter) */
    function taxKindBox(item) {
      var kinds = chartOf().taxKinds;
      if (!kinds.length) return '<span class="bd-why">' + escapeHtml('No ' + taxWordOf() + ' kinds are set for this country, so nothing is claimed on this line.') + '</span>';
      return (
        '<span class="bd-ask">' + escapeHtml('Does this carry ' + taxWordOf() + '? Say what kind it is.') + '</span> ' +
        '<select data-cbsid="BKS017-S08" class="bd-inp" aria-label="' + escapeHtml(taxWordOf() + ' kind') + '" data-act="taxkind1" data-key="' + escapeHtml(item.key) + '">' + optionsOf(kinds, function (one) { return one.id; }, function (one) { return one.name; }) + '</select> ' +
        '<button data-cbsid="BKS017-B15" type="button" class="bd-btn" data-act="taxuse"' + dataKey(item) + '>Use this</button>'
      );
    }
    /** the one question a held-back line asks next */
    function askedBox(item) {
      if (item.needs === 'may_be_in_books') return nearBox(item);
      if (item.needs === 'gst_basis') return '<span class="bd-why">Waiting for your GST basis, asked above.</span>';
      if (item.needs === 'tax_invoice') return invoiceQuestion(item);
      if (item.needs === 'needs_tick') return tickBox(item);
      if (item.needs === 'tax_kind') return taxKindBox(item);
      return '';
    }
    /** what a line says under its state: the entry it would make, the ONE question it asks next, and every other thing holding it back (none is dropped) */
    /** the message of a line the sheet cannot finish (a tax payment, a loan, a transfer between own accounts, a card settlement with tax), ON THE LINE with its one step; the words are the controller's (item.say) or the refusal this line was given */
    function sayBox(item) {
      var words = item.say || ctx.says[item.key];
      if (!words) return '';
      return '<span class="bd-say" role="status" data-testid="bd-line-say" data-line-say="' + escapeHtml(item.key) + '">' + escapeHtml(words) + ' <button data-cbsid="BKS017-B18" type="button" class="bd-btn bd-go" data-act="entry"' + dataKey(item) + '>' + escapeHtml(cfg.entryWords || 'Add it as an entry') + '</button></span>';
    }
    function lineNote(item, result) {
      if (result) return result.ok ? tag('ok', cfg.addedWords || 'Added') : tag('bad', 'Not added: ' + result.why);
      if (item.state === 'closed') return tag('bad', item.why);
      var done = alreadyNote(item, escapeHtml);
      if (done) return done;
      var asked = askedBox(item),
        others = otherNeeds(item, tag);
      var reason = item.state === 'needs_you' && !asked ? '<span class="bd-why">' + escapeHtml(/^no rule matched$/i.test(item.why || '') ? 'Nothing here says who or what this is.' : item.why || 'Nothing here says who or what this is.') + '</span>' : '';
      return entryNote(item) + asked + (others ? ' ' + others : '') + reason + sayBox(item);
    }
    Object.assign(ctx, { taxKindBox, askedBox, sayBox, lineNote });
  }
  /** a new party, and the account a line nothing explained is given; each function lands on the one shared `ctx` */
  function addParties(ctx) {
    var cfg = ctx.cfg, escapeHtml = ctx.escapeHtml, dataKey = ctx.dataKey, chartOf = ctx.chartOf, optionsOf = ctx.optionsOf;
    function partyBox(item) {
      var party = item.party;
      if (!party || party.status !== 'new') return party ? '<span class="bd-why">Party: ' + escapeHtml(party.name) + '</span>' : '';
      var meant = (item.didYouMean || [])
        .map(function (one) {
          return '<button data-cbsid="BKS017-B03" type="button" class="bd-btn bd-meant" data-act="meant" data-key="' + escapeHtml(item.key) + '" data-id="' + escapeHtml(one.id) + '" data-name="' + escapeHtml(one.name) + '">Use ' + escapeHtml(one.name) + '</button>';
        })
        .join(' ');
      return (
        '<span class="bd-party"><b>New party:</b> <input data-cbsid="BKS017-I02" class="bd-inp" type="text" maxlength="120" aria-label="New party name" data-act="pname" data-key="' + escapeHtml(item.key) + '" value="' + escapeHtml(party.name) + '"> ' +
        '<select data-cbsid="BKS017-S04" class="bd-inp" aria-label="New party kind" data-act="pkind" data-key="' + escapeHtml(item.key) + '">' +
        ['supplier', 'customer'].map(function (kind) { return '<option value="' + kind + '"' + (party.kind === kind ? ' selected' : '') + '>' + kind + '</option>'; }).join('') +
        '</select> <button data-cbsid="BKS017-B07" type="button" class="bd-btn" data-act="resolve" data-key="' + escapeHtml(item.key) + '">Use this party</button> ' + (meant ? '<span class="bd-why">Did you mean</span> ' + meant : '') + '</span>'
      );
    }
    /** B5-04: for a line nothing explained: money out goes to an expense class, money in to an income class, and BOTH name their tax kind (the pack's, never a default); the answer goes through resolve() */
    function accountBox(item) {
      if (item.state !== 'needs_you' || item.entry) return '';
      var out = item.line.debit_minor > 0,
        chart = chartOf(),
        key = escapeHtml(item.key),
        none = '<option value="' + NOT_INCOME_OR_EXPENSE + '">' + (out ? 'Not an expense (tax, loan, drawings, transfer)' : 'Not income (loan, capital, transfer)') + '</option>';
      return (
        '<span class="bd-party"><b>Or an account:</b> <select data-cbsid="BKS017-S05" class="bd-inp" aria-label="Account" data-act="acct" data-key="' + key + '">' +
        optionsOf(out ? chart.expense : chart.income, function (one) { return one.role; }, function (one) { return one.name; }).replace('</option>', '</option>' + none) + '</select> ' +
        '<select data-cbsid="BKS017-S06" class="bd-inp" aria-label="Tax kind" data-act="taxkind" data-key="' + key + '">' + optionsOf(chart.taxKinds, function (one) { return one.id; }, function (one) { return one.name; }) + '</select> ' +
        '<button data-cbsid="BKS017-B08" type="button" class="bd-btn" data-act="useacct" data-key="' + key + '">Use this account</button></span>'
      );
    }
    /**
     * "What is this?" ON THE LINE, for a line nothing explained: one step each from the engine's own closed list (CBBankEntry.whatIsThis, the same list resolve() uses): moved between my own accounts
     * (asks which account when the shop has more than one), card takings paid to the bank, cash, tax paid to the tax office, a loan. The screen lists nothing of its own; an answer goes to resolveLine(key, { kind, account }).
     */
    /** the savings (or other own) account a transfer goes to does not exist yet: its name and one press make it, then the line is answered with it */
    function addOwnBox(key) {
      return '<input data-cbsid="BKS017-I03" class="bd-inp" type="text" maxlength="60" data-testid="bd-addown-name" aria-label="Name of a new savings account" placeholder="+ add a savings account: name" data-act="addownname" data-key="' + key + '"> <button data-cbsid="BKS017-B20" type="button" class="bd-btn" data-testid="bd-addown" data-act="addown" data-key="' + key + '">Add it</button> ';
    }
    function kindBox(item) {
      var engine = root.CBBankEntry;
      if (item.state !== 'needs_you' || item.entry || !engine || !engine.whatIsThis) return '';
      var out = item.line.debit_minor > 0,
        key = escapeHtml(item.key),
        listed = engine.whatIsThis({ country: cfg.country, own_accounts: cfg.ownAccounts ? cfg.ownAccounts() : [] }).items || [];
      var buttons = listed
        .filter(function (one) {
          return one.id !== 'expense' && one.id !== 'other_income' && (one.side === 'both' || one.side === (out ? 'out' : 'in'));
        })
        .map(function (one) {
          var pick = one.ask === 'account' && one.accounts.length > 1;
          if (!pick) return '<button data-cbsid="BKS017-B19" type="button" class="bd-btn" data-act="kind" data-key="' + key + '" data-kind="' + escapeHtml(one.id) + '"' + (one.ask === 'account' ? ' data-acct="' + escapeHtml(one.accounts[0].role || one.accounts[0].code) + '"' : '') + '>' + escapeHtml(one.words) + '</button>';
          return '<span class="bd-party">' + (one.id === 'transfer' && cfg.addOwn ? addOwnBox(key) : '') + '<select data-cbsid="BKS017-S10" class="bd-inp" aria-label="' + escapeHtml(one.words) + '" data-act="kindacct-' + escapeHtml(one.id) + '" data-key="' + key + '">' + optionsOf(one.accounts, function (entry) { return entry.role || entry.code; }, function (entry) { return entry.name; }) + '</select> <button data-cbsid="BKS017-B19" type="button" class="bd-btn" data-act="kind" data-key="' + key + '" data-kind="' + escapeHtml(one.id) + '">' + escapeHtml(one.words) + '</button></span>';
        });
      return buttons.length ? '<span class="bd-party"><b>What is this?</b> ' + buttons.join(' ') + '</span>' : '';
    }
    Object.assign(ctx, { partyBox, accountBox, kindBox });
  }
  /** one table row, and the box for the rows the file lost; each function lands on the one shared `ctx` */
  function addRows(ctx) {
    var escapeHtml = ctx.escapeHtml, amountText = ctx.amountText, tag = ctx.tag, partyBox = ctx.partyBox, accountBox = ctx.accountBox, kindBox = ctx.kindBox, lineNote = ctx.lineNote;
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
        '<tr class="bd-row bd-s-' + escapeHtml(stateKey) + '" data-line="' + escapeHtml(item.key) + '"><td class="bd-d">' + escapeHtml(preview.dateText(line.date)) + '</td><td class="bd-n">' + escapeHtml(line.narration) + '</td>' +
        '<td class="bd-m">' + (line.debit_minor ? escapeHtml(amountText(line.debit_minor)) : '') + '</td><td class="bd-m">' + (line.credit_minor ? escapeHtml(amountText(line.credit_minor)) : '') + '</td>' +
        '<td class="bd-st">' + tag(stateKey === 'posted' ? 'ok' : stateKey === 'proposed' ? 'go' : stateKey === 'in_books' ? 'plain' : 'ask', preview.STATE_WORDS[stateKey] || 'Needs you') +
        '<div class="bd-sub">' + partyBox(item) + accountBox(item) + kindBox(item) + (item.resolveWhy ? tag('bad', item.resolveWhy) : '') + lineNote(item, result) + '</div></td></tr>'
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
      var rows = skipped.map(function (one) { return '<li class="bd-skip-row"><b>Row ' + one.row + ' was not read:</b> ' + escapeHtml(one.why) + '</li>'; }).concat(other.map(function (words) { return '<li>' + escapeHtml(words) + '</li>'; })).join('');
      return (
        '<div class="bd-skip" role="alert" data-testid="bd-skip"><p><b>' + (skipped.length ? skipped.length + (skipped.length === 1 ? ' row' : ' rows') + ' of your file ' + (skipped.length === 1 ? 'was' : 'were') + ' not read.' : 'The reader noted:') + '</b>' +
        (skipped.length ? ' Check them against the bank. The reconciliation cannot say tied while a row is missing.' : '') + '</p><ul>' + rows + '</ul></div>'
      );
    }
    Object.assign(ctx, { stateKeyOf, lineRow, skipBox });
  }
  /** the statement check, in words: each finding's sentence, a tick on what the owner must confirm, "Use it anyway" on what the owner may override, the account to choose, and the all-done summary */
  function addCheck(ctx) {
    var escapeHtml = ctx.escapeHtml;
    function button(item, label) {
      return ' <button data-cbsid="BKS017-B16" type="button" class="bd-btn" data-act="chk" data-key="' + escapeHtml(item.code) + '">' + escapeHtml(label) + '</button>';
    }
    function pickOf(item) {
      var choices = (item.choose_from || []).map(function (one) { return '<option value="' + escapeHtml(one.id) + '">' + escapeHtml(one.name + (one.masked ? ' ' + one.masked : '')) + '</option>'; });
      return choices.length ? ' <select data-cbsid="BKS017-S09" class="bd-inp" aria-label="Which account" data-act="acctpick"><option value="">Choose</option>' + choices.join('') + '</select>' : '';
    }
    function findingBox(item) {
      var open = !item.confirmed && item.level === 'confirm' ? button(item, 'Yes, go on') : '';
      var anyway = !item.confirmed && item.level === 'refuse' && item.override ? button(item, 'Use it anyway') : '';
      return '<p class="bd-find bd-' + escapeHtml(item.level) + '" data-testid="bd-check-' + escapeHtml(item.code) + '">' + escapeHtml(item.why) + open + anyway + pickOf(item) + '</p>';
    }
    function checkBox(model) {
      var check = model.check;
      if (!check) return '';
      var all = check.already && check.already.all ? '<p class="bd-find bd-info" data-testid="bd-check-all">' + escapeHtml(check.already.summary) + '</p>' : '';
      return '<div class="bd-check" role="status">' + (check.items || []).filter(function (item) { return item.level !== 'info' || !item.confirmed; }).map(findingBox).join('') + all + '</div>';
    }
    ctx.checkBox = checkBox;
  }
  /** the painter for one mount: it reads its currency and country once, so no tax name or money unit is written here */
  function painter(cfg) {
    var ctx = { cfg: cfg, says: {}, escapeHtml: root.esc /* helpers.js's ONE esc: every page that mounts this painter loads helpers.js first */ };
    ctx.amountText = cfg.amountText || function (value) { return preview.moneyText(value, cfg.currency); }; /* a host may draw money its own way (the in-app Bank sheet: the page's symbol form, as the band) */
    ctx.tag = function (kind, words) { return '<span class="bd-tag bd-' + kind + '">' + ctx.escapeHtml(words) + '</span>'; };
    ctx.dataKey = function (item) { return ' data-key="' + ctx.escapeHtml(item.key) + '"'; };
    addWords(ctx); addQuestions(ctx); addAsks(ctx); addParties(ctx); addRows(ctx); addCheck(ctx);
    return {
      says: ctx.says,
      skipBox: ctx.skipBox,
      chartOf: ctx.chartOf,
      taxWordOf: ctx.taxWordOf,
      linesHtml: function (model) {
        return (
          ctx.checkBox(model) + ctx.skipBox(model) +
          (model.items.some(function (item) { return item.needs === 'gst_basis'; }) ? '<p class="bd-find bd-confirm" data-testid="bd-gst-basis">' + ctx.basisQuestion() + '</p>' : '') +
          '<table class="bd-table"><thead><tr><th>Date</th><th>What the bank says</th><th>Out</th><th>In</th><th>In your books?</th></tr></thead><tbody>' +
          model.items.map(function (item) { return ctx.lineRow(item, model.results); }).join('') + '</tbody></table>'
        );
      }
    };
  }

  /** the value of the select a line carries for this action (data-act) and key; '' when it is not on the page */
  function chosenIn(host, action, key) {
    var found = Array.prototype.filter.call(host.querySelectorAll('select[data-act="' + action + '"]'), function (one) { return one.getAttribute('data-key') === key; })[0];
    return found ? found.value : '';
  }
  /** what each button does, by its data-act (the answers the controller gives, or { ok, why } when it refuses) */
  function actionsOf(cfg, chosenFor, taxWordOf, says) {
    /** the owner picked an account and a tax kind for a line nothing explained; "not income or expense" is no account here (B5-04) */
    function useAccount(key) {
      var account = chosenFor('acct', key);
      if (account === NOT_INCOME_OR_EXPENSE) return { ok: false, line: true, why: 'A tax payment, a loan, drawings or a transfer between your own accounts is not an expense or income, so it is added as its own entry.' };
      return cfg.controller().resolveLine(key, { account: account, tax_kind: chosenFor('taxkind', key) });
    }
    /** FIN-116: the tax kind for a line the bank's words proposed: its own class (the proposal's, never a literal) with the chosen kind, through resolve() */
    function useTax(key) {
      var item = cfg.controller().view().items.filter(function (one) { return one.key === key; })[0],
        kind = chosenFor('taxkind1', key);
      if (!kind) return { ok: false, why: 'Choose what kind of ' + taxWordOf() + ' this is first.' };
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
      notmatch: function (key) { return cfg.controller().notMatch(key); },
      kind: function (key, target) {
        var id = target.getAttribute('data-kind'),
          account = target.getAttribute('data-acct') || chosenFor('kindacct-' + id, key);
        var said = cfg.controller().resolveLine(key, { kind: id, account: account || undefined });
        return said && said.ok === false ? Object.assign({ line: true }, said) : said; /* a refusal is said on the line, in its words */
      },
      addown: function (key, target) {
        var field = target.parentNode.querySelector('input[data-act="addownname"]'),
          name = field ? String(field.value || '').trim() : '';
        if (!name) return { ok: false, line: true, why: 'Type the name of the new account first.' };
        Promise.resolve(cfg.addOwn(name)).then(function (made) {
          var said = made && made.ok ? cfg.controller().resolveLine(key, { kind: 'transfer', account: made.code }) : made;
          if (said && said.ok === false) says[key] = said.why;
          cfg.changed();
        });
        return { ok: true };
      },
      entry: function (key) { return cfg.entry ? cfg.entry(key) : { ok: false, why: 'This starts after an update.' }; },
      chk: function (code) { return cfg.controller().confirmCheck(code) ? { ok: true } : { ok: false, why: 'Could not read this statement again.' }; }
    };
    return ACTIONS;
  }
  /** the owner chose which of their accounts this statement is for */
  function pickAccount(cfg, field) {
    if (field.value) cfg.controller().chooseAccount(field.value);
    cfg.changed();
  }
  /**
   * mount(cfg) → { paint(), chosenFor }
   *   cfg.host        the element the lines are painted into (clicks and changes are listened for on it)
   *   cfg.controller  () → the CBBankPreview controller now in use
   *   cfg.currency · cfg.country · cfg.addedWords (what an added line says)
   *   cfg.amountText(money)  optional: the host's own money text; the default is moneyText ("AUD 2,200.00")
 *   cfg.entry(key)  the one step of a line the sheet cannot finish: opens its entry (the host's business); cfg.entryWords its button's words
 *   cfg.say(words)  where a refusal is shown                      cfg.changed()  called after every answer, so the host paints its other panes
   */
  function mount(cfg) {
    var paintLines = painter(cfg);
    var host = cfg.host;
    var chosenFor = function (action, key) { return chosenIn(host, action, key); };
    var ACTIONS = actionsOf(cfg, chosenFor, paintLines.taxWordOf, paintLines.says);
    function onClick(event) {
      var target = event.target.closest('[data-act]');
      if (!target) return;
      var act = ACTIONS[target.getAttribute('data-act')];
      if (!act) return;
      var key = target.getAttribute('data-key'),
        said = act(key, target);
      if (said && said.ok === false && said.line) {
        paintLines.says[key] = said.why; /* the message stays ON THE LINE with its one step, never at the top of the sheet */
        cfg.say('');
      } else if (said && said.ok === false) cfg.say(said.why);
      else cfg.say('');
      cfg.changed();
    }
    function onChange(event) {
      var field = event.target,
        action = field.getAttribute && field.getAttribute('data-act'),
        key = field.getAttribute && field.getAttribute('data-key');
      if (action === 'acctpick') return pickAccount(cfg, field);
      if (action !== 'pname' && action !== 'pkind') return;
      var party = cfg.controller().view().items.filter(function (one) { return one.key === key; })[0].party;
      var said = cfg.controller().editParty(key, { name: action === 'pname' ? field.value : party.name, kind: action === 'pkind' ? field.value : party.kind });
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
