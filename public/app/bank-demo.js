/* bank-demo.js — the page script of public/bank-demo.html (the no-login Bank-to-books showcase). External, because the page's CSP allows no inline script.
 * OWNS      the sample statement and sample books (AU, AUD), the DEMO post adapter (it only updates the on-screen books and party list), and the painting of
 *           the lines, the books-after ledger, the reconciliation and the confirm popup. The flow itself is public/app/bank-preview.js.
 * CALLED BY public/bank-demo.html. No api call, no storage, no cookie: a file the visitor loads is read on the device and held in memory.
 * FLOW      load → CBBankPreview.create({ engine, post: demoPost }) → load(text) → paint → "Add N" → CBLabKit.confirm(reach) → postReady → paint again
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  BKS017-B01 load the sample · BKS017-I01 load your own CSV · BKS017-B02 add the ready lines · BKS017-S01..S03 the three views · BKS017-I02 new party name
 *           BKS017-S04 new party kind · BKS017-B03 use an existing party · BKS017-B04 GST on cash · BKS017-B05 GST on accrual · BKS017-B06 start again · BKS017-B07 use this party · BKS017-S05 account · BKS017-S06 tax kind · BKS017-B08 use this account · BKS017-B09 yes this is right (tick) · BKS017-B10 I hold the tax invoice · BKS017-B11 no tax invoice, no credit · BKS017-B12 same payment (pair with a books entry) · BKS017-B13 it is new · BKS017-S07 statement currency · BKS017-B14 read this file
 */
(function (root) {
  'use strict';
  var preview = root.CBBankPreview,
    doc = root.document;
  var CURRENCY = 'AUD',
    ACCOUNT = 'Demo bank account';
  var SAMPLE_CSV = [
    'Date,Description,Debit,Credit,Balance',
    '19/10/2026,EFT Smith Pty,,2200.00,12200.00',
    '20/10/2026,Rent,1650.00,,10550.00',
    '21/10/2026,EFT customer,,3300.00,13850.00',
    '22/10/2026,EFT supplier,880.00,,12970.00',
    '23/10/2026,Account fee,22.00,,12948.00',
    '26/10/2026,"Card settlement, no customer",,880.00,13828.00',
    '27/10/2026,Origin Energy,330.00,,13498.00',
    '28/10/2026,Credit interest,,12.50,13510.50',
    '29/10/2026,ATM withdrawal,500.00,,13010.50',
    '30/10/2026,EFT unknown payer,,4400.00,17410.50',
    '02/11/2026,ATO payment,1200.00,,16210.50',
    '03/11/2026,Cheque supplier,770.00,,15440.50',
    '04/11/2026,EFT customer,,1650.00,17090.50',
    '05/11/2026,Telstra,110.00,,16980.50',
    '06/11/2026,EFT customer,,550.00,17530.50',
    '13/11/2026,Account fee,22.00,,17508.50'
  ].join('\n');
  /* the books before the load: the seven lines already in the bank ledger (Dr = money in), opening 10,000.00 */
  var SAMPLE_BOOKS = [
    ['2026-10-19', 220000, 0, 'EFT Smith Pty'],
    ['2026-10-20', 0, 165000, 'Rent'],
    ['2026-10-21', 330000, 0, 'EFT customer'],
    ['2026-10-22', 0, 88000, 'EFT supplier'],
    ['2026-11-03', 0, 77000, 'Cheque supplier'],
    ['2026-11-04', 165000, 0, 'EFT customer'],
    ['2026-11-06', 55000, 0, 'EFT customer']
  ];
  /* two rules the books already learned, so the pass test's utility and phone lines have a proposal (never a guess: each says who taught it) */
  var TAUGHT = { date: '2026-09-01', narration: 'taught in the sample books', by: 'sample' };
  var LEARNED = [
    { id: 'out:origin_energy', has: 'ORIGIN ENERGY', side: 'out', party: null, party_name: 'Origin Energy', label: 'Electricity', event: { type: 'expense', class: 'electricity', paid_from: 'bank', tax_kind: 'taxable' }, source: TAUGHT },
    { id: 'out:telstra', has: 'TELSTRA', side: 'out', party: null, party_name: 'Telstra', label: 'Telephone', event: { type: 'expense', class: 'telephone', paid_from: 'bank', tax_kind: 'taxable' }, source: TAUGHT }
  ];

  /* B5-05: the currency the STATEMENT says it is in. The sample says AUD itself; a file the visitor loads says nothing until they are asked (askedFile), and the account's AUD is never read as the file's. */
  var books = { opening_minor: 1000000, lines: [] },
    parties = [],
    controller = null,
    view = 'lines',
    posted = 0,
    statementCur = null,
    askedFile = null;

  function el(id) {
    return doc.getElementById(id);
  }
  function resetBooks() {
    posted = 0;
    parties = [];
    books.lines = SAMPLE_BOOKS.map(function (row, index) {
      return { id: 'L' + (index + 1), currency: CURRENCY, date: row[0], dr_minor: row[1], cr_minor: row[2], ref: '', narration: row[3], entry_no: 'MJ-' + (index + 1) };
    });
  }
  /** the DEMO adapter: no server, no storage. A new party joins the on-screen list; the entry joins the on-screen books as the statement line's own side. */
  async function demoPost(item) {
    if (item.party && item.party.status === 'new') parties.push({ name: item.party.name, kind: item.party.kind });
    posted += 1;
    books.lines.push({ id: 'D' + posted, currency: CURRENCY, date: item.line.date, dr_minor: item.line.credit_minor || 0, cr_minor: item.line.debit_minor || 0, ref: item.ref, narration: item.line.narration, entry_no: 'DEMO-' + posted });
    return { ok: true, entry_no: 'DEMO-' + posted };
  }
  function makeController() {
    controller = preview.create({
      engine: { recon: root.CBBankRecon, project: root.CBBankProject, entry: root.CBBankEntry },
      currency: CURRENCY,
      account: ACCOUNT,
      ledger: function () {
        return { lines: books.lines.slice(), opening_minor: books.opening_minor, posted_refs: books.lines.map(function (line) { return line.ref; }).filter(Boolean) };
      },
      post: demoPost,
      lockedMonth: function () {
        return null;
      },
      statementCurrency: function () {
        return statementCur;
      },
      suggestOpts: { learned: LEARNED, country: 'AU', parties: parties },
      parseOpts: { country: 'AU', currency: CURRENCY }
    });
  }
  function amountText(value) {
    return preview.moneyText(value, CURRENCY);
  }
  function tag(kind, words) {
    return '<span class="bd-tag bd-' + kind + '">' + esc(words) + '</span>';
  }

  /* ── painting ── */
  /**
   * what a line says under its state: the entry it would make (account and tax, so nothing ready is a surprise), the ONE question it asks next, and every other thing holding it back.
   * A held-back line always says why (B5-01/02/03): the engine's blockers are painted, none is dropped.
   */
  function lineNote(item, result) {
    if (result) return result.ok ? tag('ok', 'Added in the demo books') : tag('bad', 'Not added: ' + result.why);
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
  /** the entry a proposed line would make, in words: each leg's account and amount, and the tax it carries (B5-03: shown on the row, ready or not) */
  function entryNote(item) {
    if (!item.entry) return '';
    var legs = item.entry.lines
      .map(function (leg) {
        var side = leg.dr_minor ? 'Dr' : 'Cr';
        return side + ' ' + String(leg.account).replace(/_/g, ' ') + ' ' + amountText(leg.dr_minor || leg.cr_minor);
      })
      .join(' · ');
    return '<span class="bd-why bd-entry">' + esc(legs + '.' + taxWordsOf(item.tax)) + '</span> ';
  }
  /** the tax a proposal carries, in words: GST collected or paid, the invoice it needs, or that no credit is claimed */
  function taxWordsOf(taxRecord) {
    if (!taxRecord) return '';
    if (taxRecord.invoice_answer === 'none') return ' No GST credit: you hold no tax invoice.';
    if (!taxRecord.tax_minor) return '';
    var invoice = taxRecord.invoice && taxRecord.invoice.required ? ', tax invoice required' + (taxRecord.invoice_answer === 'held' ? ', you hold it' : '') : '';
    return ' ' + (taxRecord.direction === 'output' ? 'GST collected ' : 'GST ') + amountText(taxRecord.tax_minor) + ' (' + String(taxRecord.kind).replace(/_/g, ' ') + ')' + invoice + '.';
  }
  /** the one question a held-back line asks next: is it already in the books · cash or accrual · do you hold the tax invoice · is this right */
  function askedBox(item) {
    if (item.needs === 'may_be_in_books') return nearBox(item);
    if (item.needs === 'gst_basis') return gstQuestion();
    if (item.needs === 'tax_invoice') return invoiceQuestion(item);
    if (item.needs === 'needs_tick') return tickBox(item);
    return '';
  }
  function dataKey(item) {
    return ' data-key="' + esc(item.key) + '"';
  }
  /** B5-02: books entries with this amount and side nearby: pair the line with the one it is, or say it is new */
  function nearBox(item) {
    var entries = (item.near || [])
      .map(function (one) {
        return (
          '<button data-cbsid="BKS017-B12" type="button" class="bd-btn" data-act="pair"' + dataKey(item) + ' data-id="' + esc(one.id) + '">Same payment: ' + esc(preview.dateText(one.date)) + ' ' + esc(one.narration) + ' ' + esc(one.entry_no || '') + ' (' + one.gap_days + ' days apart)</button>'
        );
      })
      .join(' ');
    return '<span class="bd-ask">May already be in your books. Is it one of these?</span> ' + entries + ' <button data-cbsid="BKS017-B13" type="button" class="bd-btn" data-act="notmatch"' + dataKey(item) + '>No, it is new</button>';
  }
  /** B5-03: a GST credit above the pack's threshold waits for the tax invoice */
  function invoiceQuestion(item) {
    return (
      '<span class="bd-ask">' + esc('This claims ' + amountText(item.tax.tax_minor) + ' GST and needs a tax invoice. Do you hold it?') + '</span> ' +
      '<button data-cbsid="BKS017-B10" type="button" class="bd-btn" data-act="inv" data-v="held"' + dataKey(item) + '>Yes, I hold it</button> ' +
      '<button data-cbsid="BKS017-B11" type="button" class="bd-btn" data-act="inv" data-v="none"' + dataKey(item) + '>No: book it without the GST credit</button>'
    );
  }
  /** B5-01: only the words on the bank line proposed this, no rule you taught and no party you know: it is added only when you say it is right */
  function tickBox(item) {
    return '<span class="bd-ask">' + esc('Only the words on the line proposed this: ' + (item.why || '')) + '</span> <button data-cbsid="BKS017-B09" type="button" class="bd-btn" data-act="tick"' + dataKey(item) + '>Yes, this is right</button>';
  }
  function gstQuestion() {
    return (
      '<span class="bd-ask">' + esc('Is your GST on a cash or an accrual basis?') + '</span> ' +
      '<button data-cbsid="BKS017-B04" id="bd_gst_cash" type="button" class="bd-btn" data-act="gst" data-v="cash">Cash</button> ' +
      '<button data-cbsid="BKS017-B05" id="bd_gst_accrual" type="button" class="bd-btn" data-act="gst" data-v="accrual">Accrual</button>'
    );
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
  /** the chart the owner may pick from, read from the country pack (never a new account): expense and income classes, and the tax kinds */
  function chartOf() {
    var pack = root.CBRegulation && root.CBRegulation.resolve({ country: 'AU' });
    if (!pack) return { expense: [], income: [], taxKinds: [] };
    var kinds = (pack.tax && pack.tax.supplyKinds) || {};
    return { expense: pack.expense_classes || [], income: pack.income_classes || [], taxKinds: Object.keys(kinds).map(function (id) { return { id: id, name: kinds[id].name }; }) };
  }
  function optionsOf(list, value, valueOf, nameOf) {
    return '<option value="">Choose</option>' + list.map(function (one) { return '<option value="' + esc(valueOf(one)) + '">' + esc(nameOf(one)) + '</option>'; }).join('');
  }
  /** for a line nothing explained: pick an account from the chart (and, on money out, the tax kind), or say who it is above; the answer goes through resolve() */
  /**
   * B5-04: money out goes to an expense class, money in to an income class, and BOTH name their tax kind (the pack's supply kinds, never a default). Anything that is neither an income nor an expense
   * (a tax payment, a loan repayment, drawings, a transfer between your own accounts) has no account here yet: the last choice says so and the line stays with you for ＋ Entry.
   */
  var NOT_INCOME_OR_EXPENSE = '__other__';
  function accountBox(item) {
    if (item.state !== 'needs_you' || item.entry) return '';
    var out = item.line.debit_minor > 0,
      chart = chartOf(),
      key = esc(item.key);
    return (
      '<span class="bd-party"><b>Or an account:</b> <select data-cbsid="BKS017-S05" class="bd-inp" aria-label="Account" data-act="acct" data-key="' + key + '">' +
      optionsOf(out ? chart.expense : chart.income, '', function (one) { return one.role; }, function (one) { return one.name; }).replace('</option>', '</option><option value="' + NOT_INCOME_OR_EXPENSE + '">' + (out ? 'Not an expense (tax, loan, drawings, transfer)' : 'Not income (loan, capital, transfer)') + '</option>') + '</select> ' +
      '<select data-cbsid="BKS017-S06" class="bd-inp" aria-label="Tax kind" data-act="taxkind" data-key="' + key + '">' + optionsOf(chart.taxKinds, '', function (one) { return one.id; }, function (one) { return one.name; }) + '</select> ' +
      '<button data-cbsid="BKS017-B08" type="button" class="bd-btn" data-act="useacct" data-key="' + key + '">Use this account</button></span>'
    );
  }
  /** what the chosen select of a line says (account or tax kind), read when the button is pressed */
  function chosenFor(action, key) {
    var found = Array.prototype.filter.call(doc.querySelectorAll('select[data-act="' + action + '"]'), function (one) { return one.getAttribute('data-key') === key; })[0];
    return found ? found.value : '';
  }
  /** the state a row is painted in: what happened to it when added, else its state; a proposal something still holds back is never painted "Ready to add" */
  function stateKeyOf(item, result) {
    if (result) return result.ok ? 'posted' : 'failed';
    return item.state === 'proposed' && !item.ready ? 'check' : item.state;
  }
  function lineRow(item, results) {
    var line = item.line,
      result = results[item.key];
    var stateKey = stateKeyOf(item, result);
    return (
      '<tr class="bd-row bd-s-' + esc(stateKey) + '"><td class="bd-d">' + esc(preview.dateText(line.date)) + '</td><td class="bd-n">' + esc(line.narration) + '</td>' +
      '<td class="bd-m">' + (line.debit_minor ? esc(amountText(line.debit_minor)) : '') + '</td><td class="bd-m">' + (line.credit_minor ? esc(amountText(line.credit_minor)) : '') + '</td>' +
      '<td class="bd-st">' + tag(stateKey === 'posted' ? 'ok' : stateKey === 'proposed' ? 'go' : stateKey === 'in_books' ? 'plain' : 'ask', preview.STATE_WORDS[stateKey] || 'Needs you') +
      '<div class="bd-sub">' + partyBox(item) + accountBox(item) + (item.resolveWhy ? tag('bad', item.resolveWhy) : '') + lineNote(item, result) + '</div></td></tr>'
    );
  }
  /** B5-06: every row the file lost, by its row number, and every other warning the reader made; never hidden, and the reconciliation says it cannot be tied while any row is missing */
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
  function paintLines(model) {
    el('bd_lines').innerHTML =
      skipBox(model) +
      '<table class="bd-table"><thead><tr><th>Date</th><th>What the bank says</th><th>Out</th><th>In</th><th>In your books?</th></tr></thead><tbody>' +
      model.items.map(function (item) { return lineRow(item, model.results); }).join('') + '</tbody></table>';
  }
  function paintBooks(model) {
    var rows = (model.projection && model.projection.ledger) || [];
    el('bd_books').innerHTML =
      '<p class="bd-note">Your bank account as it will read once the ready lines are in. Preview: not yet in your books.</p>' +
      '<table class="bd-table"><thead><tr><th>Date</th><th>What</th><th>In</th><th>Out</th><th>Balance</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var proposed = r.state === 'proposed';
        return '<tr class="' + (proposed ? 'bd-prop' : '') + '"><td class="bd-d">' + esc(preview.dateText(r.date)) + '</td><td class="bd-n">' + esc(r.narration) + (proposed ? ' ' + tag('go', 'to add') : '') + '</td><td class="bd-m">' + (preview.minorOf(r.dr) ? esc(amountText(r.dr)) : '') + '</td><td class="bd-m">' + (preview.minorOf(r.cr) ? esc(amountText(r.cr)) : '') + '</td><td class="bd-m">' + esc(amountText(r.balance)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function paintBrs(model) {
    var b = model.projection && model.projection.brs;
    if (!b) return void (el('bd_brs').innerHTML = '');
    var open = (b.open_lines || []).map(function (o) { return '<li>' + esc(preview.dateText(o.date)) + ' · ' + esc(o.narration) + ' · ' + esc(amountText(o.amount)) + ' ' + esc(o.side === 'in' ? 'in' : 'out') + '</li>'; }).join('');
    el('bd_brs').innerHTML =
      tiedVerdict(b) + skipBox(model) +
      '<dl class="bd-brs"><dt>Statement closing</dt><dd>' + esc(amountText(b.closing_statement)) + '</dd><dt>Your books now</dt><dd>' + esc(amountText(b.closing_books_before)) + '</dd><dt>Your books after the ready lines</dt><dd>' + esc(amountText(b.closing_books_after)) +
      '</dd><dt>Difference after</dt><dd class="' + (b.tied ? 'bd-zero' : 'bd-diff') + '">' + esc(amountText(b.difference_after)) + '</dd></dl>' +
      (open ? '<p class="bd-note">Still open:</p><ul class="bd-open">' + open + '</ul>' : b.tied ? '<p class="bd-note">Every line is in the books.</p>' : '');
  }
  /** B5-06: the verdict in words: tied only when the engine says so; otherwise every reason it is not (rows not read, the file's printed closing, lines still open) */
  function tiedVerdict(b) {
    if (b.tied) return '<p class="bd-note bd-zero" data-testid="bd-tied">Tied: your books agree with the bank.</p>';
    var why = [];
    if ((b.skipped || []).length) why.push(b.skipped.length + (b.skipped.length === 1 ? ' row of the file was' : ' rows of the file were') + ' not read');
    if (b.stated_closing_mismatch) why.push("the closing balance printed on the file (" + amountText(b.stated_closing_mismatch) + ') is not what its lines add up to (' + amountText(b.closing_statement) + ')');
    if ((b.open_lines || []).length) why.push((b.open_lines.length === 1 ? '1 line is' : b.open_lines.length + ' lines are') + ' not in your books yet');
    return '<p class="bd-note bd-diff" data-testid="bd-not-tied">Not tied' + (why.length ? ': ' + esc(why.join('; ')) : ' yet') + '.</p>';
  }
  function paintStrip(model) {
    var b = model.projection && model.projection.brs,
      n = controller.readyCount();
    el('bd_sum').textContent = b ? 'Statement ' + amountText(b.closing_statement) + ' · Books now ' + amountText(b.closing_books_before) + ' · Difference now ' + amountText(b.difference_before) : '';
    var go = el('bd_add');
    go.disabled = !n;
    go.textContent = n ? 'Add ' + n + (n === 1 ? ' line' : ' lines') + ' to the demo books' : 'Nothing ready to add';
  }
  function paintView() {
    ['lines', 'books', 'brs'].forEach(function (name) {
      el('bd_' + name).hidden = name !== view;
      el('bd_tab_' + name).setAttribute('aria-selected', String(name === view));
    });
  }
  function paint() {
    var model = controller.view();
    el('bd_msg').textContent = model.refusal || '';
    if (!model.parsed) return;
    paintLines(model);
    paintBooks(model);
    paintBrs(model);
    paintStrip(model);
    paintView();
  }

  /* ── actions ── */
  /** a refused file leaves NOTHING of the last statement on the screen: a stale table beside a refusal would read as the refused file's */
  function clearPanes() {
    ['bd_lines', 'bd_books', 'bd_brs'].forEach(function (id) { el(id).innerHTML = ''; });
    el('bd_sum').textContent = '';
    el('bd_add').disabled = true;
    el('bd_add').textContent = 'Nothing ready to add';
  }
  function loadStatement(text, name) {
    var said = controller.load(text, name);
    el('bd_msg').textContent = said.ok ? '' : said.why;
    if (said.ok) paint();
    else clearPanes();
    return said;
  }
  function startAgain() {
    askedFile = null;
    showCurrencyAsk();
    statementCur = 'AUD'; /* the sample statement is ours and says AUD */
    resetBooks();
    makeController();
    loadStatement(SAMPLE_CSV, 'Sample statement');
  }
  /** B5-05: a file of the visitor's does not say what currency it is in, so it is ASKED, and the engine refuses one that is not the demo account's (AUD); nothing is converted */
  function showCurrencyAsk() {
    var box = el('bd_cur');
    box.hidden = !askedFile;
    box.innerHTML = askedFile
      ? '<span class="bd-ask">' + esc('Which currency is ' + askedFile.name + ' in? The demo account is in ' + CURRENCY + '. Nothing is converted.') + '</span> ' +
        '<input data-cbsid="BKS017-S07" id="bd_cur_sel" class="bd-inp" type="text" maxlength="3" size="4" autocomplete="off" aria-label="Statement currency, three capital letters" data-testid="bd-cur-sel"> ' +
        '<button data-cbsid="BKS017-B14" id="bd_cur_go" type="button" class="bd-btn" data-act="curuse" data-testid="bd-cur-go">Read this file</button>'
      : '';
  }
  function readAskedFile() {
    var chosen = el('bd_cur_sel').value.trim().toUpperCase();
    if (!chosen) return void (el('bd_msg').textContent = 'Say which currency the file is in first.');
    if (root.CBMoney && root.CBMoney.isIsoCurrency && !root.CBMoney.isIsoCurrency(chosen)) return void (el('bd_msg').textContent = 'That is not a currency code. Use three capital letters.');
    statementCur = chosen;
    var file = askedFile;
    askedFile = null;
    showCurrencyAsk();
    resetBooks();
    makeController();
    loadStatement(file.text, file.name);
  }
  function askToPost() {
    var text = controller.confirmText();
    if (!text) return void (el('bd_msg').textContent = 'The engine sent no figures for this press, so nothing was added.');
    var body = text.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '<p class="bd-note">Demo: only the books on this page change.</p>';
    root.CBLabKit.confirm(text.title, body, function () {
      controller.postReady().then(function () { view = 'brs'; paint(); });
    }, { okLabel: 'Add to the demo books' });
  }
  function onFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return void (el('bd_msg').textContent = 'That file is too big for this page (2 MB at most).');
    file.text().then(function (text) {
      statementCur = null;
      askedFile = { text: text, name: file.name };
      clearPanes();
      el('bd_msg').textContent = '';
      showCurrencyAsk();
    });
  }
  /** the owner picked an account and a tax kind for a line nothing explained; "not income or expense" is no account here, it is the owner's for ＋ Entry (B5-04) */
  function useAccount(key) {
    var account = chosenFor('acct', key);
    if (account === NOT_INCOME_OR_EXPENSE) return { ok: false, why: 'A tax payment, loan, drawings or a transfer between your own accounts is not booked here yet. Add it with + Entry in the app.' };
    return controller.resolveLine(key, { account: account, tax_kind: chosenFor('taxkind', key) });
  }
  /** what each button does, by its data-act: it reads its own attributes and answers { ok, why } when the controller refuses, nothing otherwise */
  var ACTIONS = {
    gst: function (key, target) { return controller.answer('gst_basis', target.getAttribute('data-v')); },
    meant: function (key, target) { return controller.editParty(key, { status: 'existing', id: target.getAttribute('data-id'), name: target.getAttribute('data-name') }); },
    resolve: function (key) { return controller.resolveLine(key); },
    useacct: function (key) { return useAccount(key); },
    tick: function (key) { return controller.tick(key); },
    inv: function (key, target) { return controller.invoice(key, target.getAttribute('data-v')); },
    pair: function (key, target) { return controller.pair(key, target.getAttribute('data-id')); },
    notmatch: function (key) { return controller.notMatch(key); },
    curuse: function () { readAskedFile(); return { cancelled: true }; },
    view: function (key, target) { view = target.getAttribute('data-v'); }
  };
  function onClick(event) {
    var target = event.target.closest('[data-act]');
    if (!target) return;
    var act = ACTIONS[target.getAttribute('data-act')],
      said = act ? act(target.getAttribute('data-key'), target) : null;
    if (said && said.cancelled) return;
    if (said && said.ok === false) el('bd_msg').textContent = said.why;
    paint();
  }
  function onChange(event) {
    var t = event.target,
      act = t.getAttribute && t.getAttribute('data-act'),
      key = t.getAttribute && t.getAttribute('data-key');
    if (act !== 'pname' && act !== 'pkind') return;
    var party = controller.view().items.filter(function (i) { return i.key === key; })[0].party;
    var said = controller.editParty(key, { name: act === 'pname' ? t.value : party.name, kind: act === 'pkind' ? t.value : party.kind });
    if (!said.ok) el('bd_msg').textContent = said.why;
    paint();
  }
  function start() {
    el('bd_load').addEventListener('click', startAgain);
    el('bd_reset').addEventListener('click', startAgain);
    el('bd_file').addEventListener('change', onFile);
    el('bd_add').addEventListener('click', askToPost);
    doc.addEventListener('click', onClick);
    doc.addEventListener('change', onChange);
    startAgain();
  }
  if (doc && doc.getElementById('bd_lines')) start();
  root.CBBankDemo = { SAMPLE_CSV: SAMPLE_CSV, SAMPLE_BOOKS: SAMPLE_BOOKS, LEARNED: LEARNED };
})(typeof globalThis !== 'undefined' ? globalThis : this);
