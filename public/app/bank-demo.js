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
    COUNTRY = 'AU',
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
      suggestOpts: { learned: LEARNED, country: COUNTRY, parties: parties },
      parseOpts: { country: COUNTRY, currency: CURRENCY }
    });
  }
  function amountText(value) {
    return preview.moneyText(value, CURRENCY);
  }
  function tag(kind, words) {
    return '<span class="bd-tag bd-' + kind + '">' + esc(words) + '</span>';
  }

  /* ── painting ── */
  /* the lines pane is the shared painter's (bank-preview-ui.js, also the in-app Bank sheet); the demo adds only its own panes and buttons */
  var linesUi = null;
  function paintLines(model) {
    linesUi.paint(model);
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
      tiedVerdict(b) + linesUi.skipBox(model) +
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
    statementCur = CURRENCY; /* the sample statement is ours and says the demo account's currency */
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
  /** the demo's own buttons: the three tabs and "Read this file" (every answer on a line is the shared painter's, bank-preview-ui.js) */
  var ACTIONS = {
    curuse: function () { readAskedFile(); return { cancelled: true }; },
    view: function (key, target) { view = target.getAttribute('data-v'); }
  };
  function onClick(event) {
    var target = event.target.closest('[data-act]');
    var act = target && ACTIONS[target.getAttribute('data-act')];
    if (!act) return;
    var said = act(target.getAttribute('data-key'), target);
    if (said && said.cancelled) return;
    paint();
  }
  function start() {
    linesUi = root.CBBankPreviewUI.mount({
      host: el('bd_lines'),
      controller: function () {
        return controller;
      },
      currency: CURRENCY,
      country: COUNTRY,
      addedWords: 'Added in the demo books',
      gstIds: true,
      say: function (words) {
        el('bd_msg').textContent = words;
      },
      changed: paint
    });
    el('bd_load').addEventListener('click', startAgain);
    el('bd_reset').addEventListener('click', startAgain);
    el('bd_file').addEventListener('change', onFile);
    el('bd_add').addEventListener('click', askToPost);
    doc.addEventListener('click', onClick);
    startAgain();
  }
  if (doc && doc.getElementById('bd_lines')) start();
  root.CBBankDemo = { SAMPLE_CSV: SAMPLE_CSV, SAMPLE_BOOKS: SAMPLE_BOOKS, LEARNED: LEARNED };
})(typeof globalThis !== 'undefined' ? globalThis : this);
