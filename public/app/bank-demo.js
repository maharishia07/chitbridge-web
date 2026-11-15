/* bank-demo.js — the page script of public/bank-demo.html (the no-login Bank-to-books showcase). External, because the page's CSP allows no inline script.
 * OWNS      the sample statement and sample books (AU, AUD), the DEMO post adapter (it only updates the on-screen books and party list), and the painting of the three figure cards,
 *           the page's one GST question, the statement lines, the "What is this?" panel, the books-after ledger, the bank reconciliation statement and the confirm popup. The flow itself is public/app/bank-preview.js.
 * CALLED BY public/bank-demo.html. No api call, no storage, no cookie: a file the visitor loads is read on the device and held in memory.
 * FLOW      load → CBBankPreview.create({ engine, post: demoPost }) → load(text) → paint → "Add N" → CBLabKit.confirm(each line's Dr and Cr) → postReady → paint again
 * ⭐ ONE STANDING PER LINE. standing(item, result) decides Ready / Waits for the GST answer / Needs you / In the books / Added once; the chip, the sticky bar and the button all read it, and the button's N is the controller's readyCount().
 * ⭐ NO MONEY IS COMPUTED HERE. Every figure is one the engines carried (figures, entry lines and their totals, the reconciliation); the page lists and formats them.
 * ⭐ WHAT IS THIS? is the engine's closed list (CBBankEntry.whatIsThis: expense, other income, transfer, card settlement, cash, tax payment, loan received, loan repaid): the page lists what the engine says
 *   for the line's side, then asks the account that answer needs. It names no answer itself; with no list from the engine the panel falls back to the pack's chart.
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  BKS017-B01 load the sample · BKS017-I01 load your own CSV · BKS017-B02 add the ready lines · BKS017-S01..S03 the three views · BKS017-I02 payee name · BKS017-S04 payee kind · BKS017-B03 use an existing payee
 *           BKS017-B04 GST on cash · BKS017-B05 GST on accrual (the segments of the ui.choice BKS017-U01) · BKS017-B06 start again · BKS017-B07 use this payee · BKS017-S05 account · BKS017-S06 tax kind · BKS017-B08 mark ready
 *           BKS017-B19 More (phone) · BKS017-B21 an answer · BKS017-B22 next · BKS017-B23 change the answer · BKS017-B14 print · BKS017-B15 see the reconciliation · BKS017-B16 deal with the lines left
 *           BKS017-B17 try again · BKS017-B18 / B26 the column map · BKS017-N01 the demo banner · BKS017-N02 a problem · BKS017-F01 the sticky bar · BKS017-R01 a line that needs you · BKS017-R90 the report
 */
(function (root) {
  'use strict';
  var preview = root.CBBankPreview,
    doc = root.document,
    labKit = root.CBLabKit;
  var COUNTRY = 'AU',
    CURRENCY = 'AUD',
    ACCOUNT = 'Business bank account';
  var SAMPLE_CSV = root.CBBankDemoSample.SAMPLE_CSV,
    SAMPLE_BOOKS = root.CBBankDemoSample.SAMPLE_BOOKS,
    LEARNED = root.CBBankDemoSample.LEARNED,
    PARTIES = root.CBBankDemoSample.PARTIES,
    OPENING_MINOR = root.CBBankDemoSample.OPENING_MINOR;
  var books = { opening_minor: 1000000, lines: [] },
    parties = [],
    controller = null,
    view = 'lines',
    posted = 0,
    added = null /* { count, balance, open } of the last press, shown as one calm card until the next action */,
    askPanel = null,
    report = null,
    loadRefusal = null /* { why, text, name } of a file that could not be read: the plain words, and the text for the column map */;

  function el(id) {
    return doc.getElementById(id);
  }
  function resetBooks() {
    posted = 0;
    added = null;
    parties = PARTIES.map(function (one) { return Object.assign({}, one); });
    books.opening_minor = OPENING_MINOR;
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
  function controllerOpts() {
    return {
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
      suggestOpts: { learned: LEARNED, country: COUNTRY, parties: parties },
      parseOpts: { country: COUNTRY, currency: CURRENCY }
    };
  }
  function makeController(parseOpts) {
    var opts = controllerOpts();
    if (parseOpts) opts.parseOpts = parseOpts;
    controller = preview.create(opts);
  }
  /** an amount as digits only: the currency is said ONCE (the column and card headings, the report heading), never on every figure */
  function amountText(value) {
    return preview.moneyText(value, CURRENCY).replace(/^[A-Z]{3}\s/, '');
  }
  /** an amount inside a sentence, with its currency */
  function amountWithCurrency(value) {
    return preview.moneyText(value, CURRENCY);
  }
  function tag(kind, words) {
    return '<span class="bd-tag bd-' + kind + '">' + esc(words) + '</span>';
  }
  function plural(count, one, many) {
    return count + ' ' + (count === 1 ? one : many);
  }

  /* ── the country pack's own words: the account names, the tax kinds ── */
  function packOf() {
    return root.CBRegulation && root.CBRegulation.resolve ? root.CBRegulation.resolve({ country: COUNTRY }) : null;
  }
  /** an account's words from the pack (ledgers, expense and income classes); the role spelled out when the pack does not name it */
  function nameOf(role) {
    var pack = packOf(),
      found = null;
    ['ledgers', 'expense_classes', 'income_classes'].forEach(function (key) {
      ((pack && pack[key]) || []).forEach(function (one) {
        if (!found && one.role === role) found = one.name;
      });
    });
    return found || String(role || '').replace(/_/g, ' ').replace(/^./, function (letter) { return letter.toUpperCase(); });
  }
  /** the chart the owner may pick from when the engine has no "What is this?" list yet: the pack's expense and income classes and its tax kinds */
  function chartOf() {
    var pack = packOf();
    if (!pack) return { expense: [], income: [], taxKinds: [] };
    var kinds = (pack.tax && pack.tax.supplyKinds) || {};
    return { expense: pack.expense_classes || [], income: pack.income_classes || [], taxKinds: Object.keys(kinds).map(function (id) { return { id: id, name: String(kinds[id].name).replace(/\s*supply$/i, '') }; }) };
  }
  /** the engine's closed "What is this?" list (CBBankEntry.whatIsThis); null when the engine does not carry it yet */
  function whatIsThis() {
    var entry = root.CBBankEntry;
    var said = entry && entry.whatIsThis ? entry.whatIsThis({ country: COUNTRY }) : null;
    return said && said.ok ? said : null;
  }

  /* ── one standing per line: the chip, the bar and the popup all read THIS, so the counts cannot disagree ── */
  var CHIPS = {
    in: ['ok', 'In your books ✓'],
    ready: ['go-tag', 'Ready to add'],
    wait: ['ask', 'Waits for your GST answer'],
    need: ['ask', 'Needs you'],
    posted: ['ok', 'Added ✓'],
    failed: ['bad', 'Not added'],
    closed: ['bad', 'Month closed']
  };
  function standing(item, result) {
    if (result) return result.ok ? 'posted' : 'failed';
    if (item.state === 'closed') return 'closed';
    if (item.state === 'in_books') return 'in';
    if (item.state === 'proposed') return item.ready ? 'ready' : item.needs === 'gst_basis' ? 'wait' : 'need';
    return 'need';
  }
  function countsOf(model) {
    var counts = { in: 0, ready: 0, wait: 0, need: 0, posted: 0, failed: 0, closed: 0 };
    model.items.forEach(function (item) {
      counts[standing(item, model.results[item.key])] += 1;
    });
    return counts;
  }

  /* ── the payee and the badge of a line ── */
  var GENERIC_PAYEE = /^(customer|supplier|unknown payer|card settlement.*|atm.*)$/i;
  var CATEGORY_ICONS = [
    [/origin|energy|electric|power/i, 'bolt'],
    [/telstra|phone|mobile|optus|internet/i, 'phone'],
    [/\bato\b|tax office|taxation/i, 'gov'],
    [/fee|interest|bank/i, 'bank'],
    [/atm|cash|withdraw/i, 'cash'],
    [/card|settlement|eftpos/i, 'card'],
    [/rent/i, 'home']
  ];
  /** the words a bank prints in capitals, as a person writes them: "Jones Plumbing Supplies" (its prefix and trailing reference left off) */
  function tidyPayee(narration) {
    var said = String(narration || '').replace(/^(EFT|CHEQUE|EFTPOS|DIRECT DEBIT|DIRECT CREDIT)\s+/i, '');
    for (var again = 0; again < 3; again++) said = said.replace(/\s+(INV\s?\d+|J\d+|\d{3,}|SYDNEY)$/i, '');
    said = said.trim();
    return said && said === said.toUpperCase() ? said.toLowerCase().replace(/(^|\s)([a-z])/g, function (all, space, letter) { return space + letter.toUpperCase(); }) : said;
  }
  function payeeOf(item) {
    var named = item.party && item.party.name && item.party.status === 'existing' ? item.party.name : '';
    var said = named || tidyPayee(item.line.narration) || 'This line';
    return said.charAt(0).toUpperCase() + said.slice(1);
  }
  function badgeOf(item) {
    var words = item.line.narration + ' ' + payeeOf(item),
      icon = null;
    CATEGORY_ICONS.forEach(function (rule) {
      if (!icon && rule[0].test(words)) icon = rule[1];
    });
    var payee = payeeOf(item);
    if (!icon && GENERIC_PAYEE.test(payee)) icon = 'who';
    return '<span class="bd-lk-badge">' + labKit.badge(icon ? { icon: icon } : { name: payee }) + '</span>';
  }
  /** the account a ready line is proposed to, from the entry the engine composed: its non-bank lines, "Electricity · tax included" or "Bank fees · no tax" */
  function accountOf(item) {
    var legs = ((item.entry && item.entry.lines) || []).filter(function (leg) { return leg.account !== 'bank'; });
    if (!legs.length) return '';
    return nameOf(legs[0].account) + (legs.length > 1 ? ' · tax included' : ' · no tax');
  }

  /* ── painting ── */
  function figures(model) {
    var recon = model.projection && model.projection.brs,
      counts = countsOf(model),
      open = model.items.length - counts.in - counts.posted;
    if (!recon) return void (el('bd_figs').hidden = true);
    var closed = preview.minorOf(recon.difference_before) === 0 && !open;
    el('bd_figs').hidden = false;
    el('bd_figs').innerHTML =
      labKit.figure({ label: 'Statement', value: amountText(recon.closing_statement) }) +
      labKit.figure({ label: 'Your books', value: amountText(recon.closing_books_before) }) +
      labKit.figure({ label: 'Difference', value: amountText(recon.difference_before), good: closed, note: closed ? 'Reconciled to the statement of ' + dateWords(recon.statement_date || lastDate(model)) : plural(open, 'line', 'lines') + ' to go' });
  }
  function lastDate(model) {
    var dates = model.items.map(function (item) { return item.line.date; }).sort();
    return dates[dates.length - 1] || '';
  }
  function dateWords(iso) {
    return preview.dateText(iso) || 'the last day';
  }
  function gstStrip(model) {
    var node = el('bd_gst'),
      asking = model.items.some(function (item) { return item.needs === 'gst_basis'; });
    if (gstFact || (!asking && !gstBasis)) return void (node.hidden = true);
    node.hidden = false;
    node.className = 'bd-gst' + (gstBasis ? ' bd-answered' : '');
    var waiting = countsOf(model).wait;
    var group = root.ui.choice({ mount: 'BKS017-U01', key: 'gst', id: 'bd_gst_choice', testid: 'bd-gst', size: 'compact', label: 'Do you count GST when money moves (cash) or when you invoice (accrual)?', value: gstBasis || '', items: [{ value: 'cash', label: 'Cash' }, { value: 'accrual', label: 'Accrual' }], onChange: answerBasis });
    node.innerHTML =
      '<b>Do you count GST when money moves (cash) or when you invoice (accrual)?</b>' + group +
      '<span class="bd-why">' + (waiting ? 'Asked once for every line. ' + plural(waiting, 'line waits', 'lines wait') + ' for it.' : 'Asked once, for every line.') + '</span>';
  }
  /** the one GST answer of the page: every line reads it through the controller, so the chips, the bar and the popup change together */
  function answerBasis(value) {
    gstBasis = value;
    controller.answer('gst_basis', value);
    added = null;
    setMessage('');
    paint();
    var again = doc.querySelector('#bd_gst [data-choice-value="' + value + '"]');
    if (again && again.focus) again.focus();
  }
  /** the entries of the books the statement does not show yet (the engine's match(), read, never redone) */
  function ledgerOutside(model) {
    var recon = root.CBBankRecon;
    return recon && model.parsed ? recon.match(model.parsed.lines, books.lines, { window_days: 3 }).unmatched_ledger : [];
  }
  /** which entry of the books each statement line was matched to, in the entry's own words: { statementIndex: 'Invoice INV-2: Coogee Bay Cafe' } (the engine's match(), read, never redone) */
  function matchNames(model) {
    var recon = root.CBBankRecon,
      names = {};
    if (!recon || !model.parsed) return names;
    recon.match(model.parsed.lines, books.lines, { window_days: 3 }).matched.forEach(function (pair) {
      var entry = books.lines.filter(function (line) { return line.id === pair.ledger[0]; })[0];
      pair.stmt.forEach(function (index) { names[index] = entry ? entry.narration : ''; });
    });
    return names;
  }
  /** the payee, with the date (shown on a phone only) and the bank's own words under it */
  function whoCell(item) {
    var line = item.line;
    return '<span class="bd-who">' + badgeOf(item) + '<span class="bd-names"><span class="bd-payee">' + esc(payeeOf(item)) + '</span><span class="bd-bank"><span class="bd-pdate">' + esc(preview.dateText(line.date)) + ' · </span>' + esc(line.narration) + '</span></span></span>';
  }
  /** the entry a ready line will make, in an accountant's terms: "Dr Trade creditors 880.00 · Cr Business bank account 880.00" (the legs the engine composed) */
  function entryWords(item) {
    return ((item.entry && item.entry.lines) || []).map(function (leg) {
      var debit = (leg.dr_minor || 0) > 0;
      return (debit ? 'Dr ' : 'Cr ') + nameOf(leg.account) + ' ' + amountText({ amount_minor: debit ? leg.dr_minor : leg.cr_minor, currency: CURRENCY });
    }).join(' \u00b7 ');
  }
  /** the tax the engine says this line claims, in words: "8.80 GST" */
  function taxWords(item) {
    return item.tax && item.tax.tax_minor ? amountText({ amount_minor: item.tax.tax_minor, currency: CURRENCY }) + ' GST' : 'GST';
  }
  /** what a line that needs you asks, inline: the tax invoice first, then who it is, else a way to say what it is */
  function questionHtml(item) {
    var key = esc(item.key),
      more = '<button type="button" class="bd-link" data-act="open" data-key="' + key + '" data-cbsid="BKS017-R01">Choose what this is</button>';
    if (item.needs === 'tax_invoice') {
      return '<span class="bd-question"><span class="bd-q">This claims ' + esc(taxWords(item)) + ' and needs a tax invoice. Do you hold it?</span>' +
        '<button type="button" class="bd-btn" data-act="taxinvoice" data-v="held" data-cbsid="BKS017-B10">Yes, I hold it</button>' +
        '<button type="button" class="bd-btn" data-act="taxinvoice" data-v="none" data-cbsid="BKS017-B11">No: book it without the GST credit</button></span>';
    }
    if (item.party && item.party.status === 'new') {
      return '<span class="bd-question"><span class="bd-q">Who is this?</span><button type="button" class="bd-btn" data-act="newparty" data-key="' + key + '" data-cbsid="BKS017-B07">New ' + esc(item.party.kind) + ': ' + esc(item.party.name) + '</button>' + more + '</span>';
    }
    return '<span class="bd-question">' + more + '</span>';
  }
  /** the right-hand column of a line, under its chip: the entry it matched, the entry it will make, or the question it asks */
  function detailHtml(item, state, matched) {
    if (state === 'in') return '<span class="bd-detail">' + esc(matched || '') + '</span>';
    if (state === 'ready' || state === 'posted') return '<span class="bd-detail">' + esc(entryWords(item)) + '</span>';
    return state === 'need' ? questionHtml(item) : '';
  }
  /** one money cell: the carried amount as digits (the currency is in the column heading), or an empty cell; which is 'out' (spent) or 'in' (received) */
  function moneyCell(minor, which) {
    return '<span class="bd-m bd-' + which + ' bd-cell' + which + '">' + (minor ? esc(amountText(minor)) : '') + '</span>';
  }
  function lineRow(item, results, matched) {
    var line = item.line,
      result = results[item.key],
      state = standing(item, result),
      chip = CHIPS[state],
      reason = result && !result.ok ? '<span class="bd-why">' + esc(result.why) + '</span>' : '';
    var inner =
      '<span class="bd-date">' + esc(preview.dateText(line.date)) + '</span>' + whoCell(item) +
      moneyCell(line.debit_minor, 'out') + moneyCell(line.credit_minor, 'in') +
      '<span class="bd-status">' + tag(chip[0], chip[1]) + reason + detailHtml(item, state, matched) + '</span>';
    return '<li><div class="bd-row bd-s-' + (state === 'need' ? 'needs_you' : state) + '">' + inner + '</div></li>';
  }
  function paintLines(model, names) {
    var rows = model.items
      .map(function (item) {
        return lineRow(item, model.results, names[item.i]);
      })
      .join('');
    el('bd_lines').innerHTML =
      report.successCard(added) +
      '<div class="bd-colh" role="presentation"><span>Date</span><span>Payee and what the bank says</span><span class="bd-m">Spent (AUD)</span><span class="bd-m">Received (AUD)</span><span>In your books?</span></div>' +
      '<ul class="bd-list">' + rows + '</ul>';
  }
  function paintEmpty() {
    ['bd_figs', 'bd_gst'].forEach(function (id) { el(id).hidden = true; });
    el('bd_sub').textContent = '';
    el('bd_lines').innerHTML = report.problemCard(loadRefusal) + (loadRefusal && loadRefusal.mapping ? askPanel.mapCard(loadRefusal.text) || report.emptyCard() : report.emptyCard());
    el('bd_books').innerHTML = '';
    el('bd_brs').innerHTML = '';
    paintBar(null);
    paintView();
  }
  function paintBar(model) {
    var addButton = el('bd_add'),
      count = el('bd_count');
    if (!model) {
      addButton.disabled = true;
      addButton.textContent = 'Nothing ready to add';
      count.textContent = '';
      return;
    }
    var counts = countsOf(model),
      readyCount = controller.readyCount();
    var parts = ['<b>' + (counts.in + counts.posted) + '</b> already in your books', '<b>' + counts.ready + '</b> ready to add'];
    if (counts.wait) parts.push('<b>' + counts.wait + '</b> ' + (counts.wait === 1 ? 'waits' : 'wait') + ' for your GST answer');
    parts.push('<b>' + counts.need + '</b> ' + (counts.need === 1 ? 'needs' : 'need') + ' you');
    count.innerHTML = parts.join(' \u00b7 ');
    addButton.disabled = !readyCount;
    addButton.setAttribute('data-ready', String(readyCount));
    addButton.textContent = readyCount ? 'Add ' + plural(readyCount, 'line', 'lines') + ' to the books' : 'Nothing ready to add';
  }
  function paintView() {
    ['lines', 'books', 'brs'].forEach(function (name) {
      el('bd_' + name).hidden = name !== view;
      el('bd_tab_' + name).setAttribute('aria-selected', String(name === view));
    });
  }
  function paint() {
    var model = controller.view();
    el('bd_msg').className = 'bd-msg' + (msgOk ? ' bd-okmsg' : '');
    el('bd_msg').textContent = model.parsed && model.refusal ? plainRefusal(model.refusal) : msg;
    if (!model.parsed) return paintEmpty();
    loadRefusal = null;
    el('bd_sub').textContent = 'Statement to ' + dateWords(lastDate(model)) + ' \u00b7 all amounts in ' + CURRENCY + (gstFact ? ' \u00b7 tax counted on an accrual basis (sample books)' : '');
    figures(model);
    paintCheck();
    gstStrip(model);
    paintLines(model, matchNames(model));
    report.paintBooks(model, posted, books.opening_minor);
    report.paintBrs(model, ledgerOutside(model));
    paintBar(model);
    paintView();
  }
  /** the slot before the figures for what the engine says about the FILE: its warnings now (for example no description column was read); the statement-check panel (refuse, confirm, already done) goes here */
  function paintCheck() {
    var slot = el('bd_warn');
    slot.hidden = !warnings.length;
    slot.innerHTML = warnings.map(function (words) { return '<p>' + esc(typeof words === 'string' ? words : words.why || words.words || 'Check this file.') + '</p>'; }).join('');
  }
  var gstFact = false /* the sample books' own basis is a fact of the sample, not a question */,
    warnings = [],
    msg = '',
    msgOk = false,
    gstBasis = null;
  function setMessage(words, good) {
    msg = words || '';
    msgOk = !!good;
  }

  /* ── the "What is this?" panel: the lab-kit popup in its side / sheet placement (CMP002 variant) ── */
  function itemOf(key) {
    return controller.view().items.filter(function (one) { return one.key === key; })[0] || null;
  }

  /* ── actions ── */
  /** the slot #bd_check is left for the statement check (web #718's bank-preview-check.js and bank-preview-ui.js, engines #146): refuse, confirm, already done; it clears here when a file is loaded */
  function loadStatement(text, name) {
    el('bd_check').hidden = true;
    warnings = [];
    var said = controller.load(text, name);
    if (said.ok) {
      loadRefusal = null;
      warnings = said.warnings || [];
      setMessage('');
    } else {
      view = 'lines';
      loadRefusal = { why: plainRefusal(said.why), text: /header|column|mapping|preset/i.test(said.why) ? text : '', name: name };
      setMessage('');
    }
    paint();
    return said;
  }
  /** the engine's reason in a shopkeeper's words: a file the page cannot read says what to do next, never "pass a preset or a mapping" */
  function plainRefusal(why) {
    if (/header|column|mapping|preset/i.test(why)) return 'We could not tell which column is which in that file.';
    if (/too big|has not loaded/i.test(why)) return why;
    if (/currency/i.test(why)) return 'That file is in a different currency from this bank account. Nothing is converted in this demo.';
    return 'That file is not a bank statement we can read.';
  }
  function startAgain() {
    resetBooks();
    makeController();
    gstFact = true;
    gstBasis = 'accrual';
    controller.answer('gst_basis', gstBasis);
    loadRefusal = null;
    view = 'lines';
    setMessage('');
    loadStatement(SAMPLE_CSV, 'Sample statement');
  }
  function askToPost() {
    var text = controller.confirmText();
    if (!text) return void (setMessage('The engine sent no figures for this press, so nothing was added.'), paint());
    var title = 'Add ' + plural(controller.readyCount(), 'entry', 'entries') + ' to the sample books?';
    labKit.confirm(title, askPanel.confirmBody(text), function () {
      controller.postReady().then(function (said) {
        var model = controller.view(),
          counts = countsOf(model);
        var recon = model.projection && model.projection.brs;
        added = { count: said.added, balance: recon ? amountWithCurrency(recon.closing_books_before) : '', open: counts.need + counts.wait };
        setMessage(said.failed ? plural(said.failed, 'line was', 'lines were') + ' not added.' : plural(said.added, 'entry', 'entries') + ' added to the sample books.', !said.failed);
        view = counts.need + counts.wait ? 'lines' : 'brs';
        paint();
      });
    }, { okLabel: 'Add ' + plural(controller.readyCount(), 'entry', 'entries'), cancelLabel: 'Not now', className: 'bd-wide', onClose: function () { return el('bd_add'); } });
  }
  function readFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      view = 'lines';
      loadRefusal = { why: 'That file is too big for this page (2 MB at most). Export a shorter period.', text: '' };
      resetBooks();
      makeController();
      return paint();
    }
    file.text().then(function (text) {
      resetBooks();
      makeController();
      gstFact = false;
      gstBasis = null;
      loadStatement(text, file.name);
    });
  }
  function onFile(event) {
    readFile(event.target.files && event.target.files[0]);
    event.target.value = '';
  }

  /* ── the column map: a file whose first row names columns we do not know (a "Narrative" header) ── */
  function readWithMap() {
    var text = loadRefusal.text,
      name = loadRefusal.name;
    resetBooks();
    makeController({ country: COUNTRY, currency: CURRENCY, mapping: askPanel.mapping() });
    loadStatement(text, name);
  }
  function toggleMore(open) {
    el('bd_menu').hidden = !open;
    el('bd_more').setAttribute('aria-expanded', String(open));
  }
  /** the actions of the page, by data-act (the panel's are bank-demo-ask.js's): each takes the pressed control and its data-key; one that changes nothing on screen returns true (no repaint) */
  var ACTIONS = {
    view: function (target) { view = target.getAttribute('data-v'); },
    firstneed: function () {
      view = 'lines';
      added = null;
      paint();
      var next = askPanel.firstNeedKey(),
        node = next && doc.querySelector('[data-key="' + next + '"]');
      if (node) node.focus();
      return true;
    },
    print: function () { root.print(); return true; },
    reset: function () { startAgain(); return true; },
    taxinvoice: function (target) {
      controller.answer('tax_invoice', target.getAttribute('data-v'));
      added = null;
      setMessage('');
    },
    newparty: function (target, key) {
      var said = controller.resolveLine(key);
      setMessage(said.ok ? '' : said.why);
    },
    retry: function () {
      loadRefusal = null;
      paintEmpty();
      el('bd_file').click();
      return true;
    },
    showmap: function () { loadRefusal.mapping = true; },
    readmap: function () { readWithMap(); return true; }
  };
  function onClick(event) {
    var target = event.target.closest('[data-act]');
    if (!target) {
      if (!event.target.closest('.bd-more')) toggleMore(false);
      return;
    }
    var handler = ACTIONS[target.getAttribute('data-act')] || askPanel.actions[target.getAttribute('data-act')];
    if (handler && handler(target, target.getAttribute('data-key'))) return;
    paint();
  }
  function onChange(event) {
    var action = event.target.getAttribute && event.target.getAttribute('data-act');
    if (action === 'pname' || action === 'pkind') askPanel.editPayee(event.target);
  }
  /** what the other modules of the page may use: the page's own readers and painters, never its state */
  function hostFor() {
    return {
      doc: doc, el: el, labKit: labKit, preview: preview, CURRENCY: CURRENCY, ACCOUNT: ACCOUNT, controller: function () { return controller; },
      itemOf: itemOf, paint: paint, standing: standing, countsOf: countsOf, payeeOf: payeeOf, accountOf: accountOf, nameOf: nameOf, chartOf: chartOf, whatIsThis: whatIsThis,
      amountText: amountText, plural: plural, tag: tag, dateWords: dateWords, lastDate: lastDate,
      onResolved: function () {
        added = null;
        setMessage('');
        paint();
      }
    };
  }
  /** the one product header: CBFrame bar, signed out ("Sign in" goes to Home); nothing stored is read, nothing is fetched, no font is linked (the page's CSP) */
  function mountHeader() {
    if (!root.CBFrame || !el('shell')) return;
    root.CBFrame.mount({ app: 'bank-demo', bar: true, signin: false, anonymous: true, manifest: { entries: [] }, fonts: false, host: el('shell'), title: { icon: '\u21c4', name: 'Harbour Plumbing Pty Ltd \u00b7 sample books' } });
  }
  function start() {
    mountHeader();
    askPanel = root.CBBankDemoAsk.create(hostFor());
    report = root.CBBankDemoReport.create(hostFor());
    ['bd_load', 'bd_load2'].forEach(function (id) { el(id).addEventListener('click', function () { toggleMore(false); startAgain(); }); });
    ['bd_reset', 'bd_reset2'].forEach(function (id) { el(id).addEventListener('click', function () { toggleMore(false); startAgain(); }); });
    ['bd_file', 'bd_file2'].forEach(function (id) { el(id).addEventListener('change', function (event) { toggleMore(false); onFile(event); }); });
    el('bd_more').addEventListener('click', function () { toggleMore(el('bd_menu').hidden); });
    el('bd_add').addEventListener('click', askToPost);
    doc.addEventListener('click', onClick);
    doc.addEventListener('change', onChange);
    doc.addEventListener('keydown', function (event) { if (event.key === 'Escape') toggleMore(false); });
    startAgain();
  }
  if (doc && doc.getElementById('bd_lines')) start();
  root.CBBankDemo = { SAMPLE_CSV: SAMPLE_CSV, SAMPLE_BOOKS: SAMPLE_BOOKS, LEARNED: LEARNED };
})(typeof globalThis !== 'undefined' ? globalThis : this);
