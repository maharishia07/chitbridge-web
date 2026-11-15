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


  var books = { opening_minor: 1000000, lines: [] },
    parties = [],
    controller = null,
    view = 'lines',
    posted = 0,
    added = null /* { count, balance, open } of the last press, shown as one calm card until the next action */,
    askPanel = null,
    checkPanel = null,
    report = null,
    loadRefusal = null /* { why, text, name } of a file that could not be read: the plain words, and the text for the column map */;

  function el(id) {
    return doc.getElementById(id);
  }
  function resetBooks() {
    posted = 0;
    added = null;
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
  function amountText(value) {
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
    in: ['ok', 'In the books ✓'],
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
  function payeeOf(item) {
    var named = item.party && item.party.name && item.party.status === 'existing' ? item.party.name : '';
    return named || String(item.line.narration || '').replace(/^(EFT|Cheque|Card)\s+/i, '').trim() || 'This line';
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
      total = model.items.length,
      held = counts.in + counts.posted,
      open = total - held;
    if (!recon) return void (el('bd_figs').hidden = true);
    var closed = preview.minorOf(recon.difference_before) === 0 && !open;
    el('bd_figs').hidden = false;
    el('bd_figs').innerHTML =
      labKit.figure({ label: 'Statement balance, ' + dateWords(recon.statement_date || lastDate(model)), value: amountText(recon.closing_statement) }) +
      labKit.figure({ label: 'Balance in the books', value: amountText(recon.closing_books_before) }) +
      labKit.figure({ label: 'Difference', value: amountText(recon.difference_before), done: held, total: total, good: closed, note: closed ? 'All ' + total + ' lines are in the books' : plural(open, 'statement line is', 'statement lines are') + ' not in the books' });
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
    if (!asking && !gstBasis) return void (node.hidden = true);
    node.hidden = false;
    node.className = 'bd-gst' + (gstBasis ? ' bd-answered' : '');
    var waiting = countsOf(model).wait;
    var group = root.ui.choice({ mount: 'BKS017-U01', key: 'gst', id: 'bd_gst_choice', testid: 'bd-gst', size: 'compact', label: 'Is your GST on a cash or an accrual basis?', value: gstBasis || '', items: [{ value: 'cash', label: 'Cash' }, { value: 'accrual', label: 'Accrual' }], onChange: answerBasis });
    node.innerHTML =
      '<b>Is your GST on a cash or an accrual basis?</b>' + group +
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
  /** the words of the Account column: what the engine proposed, the ask for a line nothing explains, nothing for a line already in the books */
  function accountWords(item, state) {
    if (state === 'in' || state === 'posted') return '';
    return accountOf(item) || (state === 'need' ? 'Choose what this is' : '');
  }
  /** one money cell: the carried amount in its currency, or an empty cell; which is 'out' (spent) or 'in' (received) */
  function moneyCell(minor, which) {
    return '<span class="bd-m bd-' + which + ' bd-cell' + which + '">' + (minor ? esc(amountText(minor)) : '') + '</span>';
  }
  /** the payee, with the date (shown on a phone only) and the bank's own words under it */
  function whoCell(item) {
    var line = item.line;
    return '<span class="bd-who">' + badgeOf(item) + '<span class="bd-names"><span class="bd-payee">' + esc(payeeOf(item)) + '</span><span class="bd-bank"><span class="bd-pdate">' + esc(preview.dateText(line.date)) + ' · </span>' + esc(line.narration) + '</span></span></span>';
  }
  function lineRow(item, results, opensPanel) {
    var line = item.line,
      result = results[item.key],
      state = standing(item, result),
      chip = CHIPS[state],
      reason = result && !result.ok ? '<span class="bd-why">' + esc(result.why) + '</span>' : '';
    var inner =
      '<span class="bd-date">' + esc(preview.dateText(line.date)) + '</span>' + whoCell(item) + '<span class="bd-acc">' + esc(accountWords(item, state)) + '</span>' +
      moneyCell(line.debit_minor, 'out') + moneyCell(line.credit_minor, 'in') +
      '<span class="bd-status">' + tag(chip[0], chip[1]) + reason + '</span><span class="bd-chev" aria-hidden="true">' + (opensPanel ? '›' : '') + '</span>';
    var rowClass = 'bd-row bd-s-' + (state === 'need' ? 'needs_you' : state);
    if (!opensPanel) return '<li><div class="' + rowClass + '">' + inner + '</div></li>';
    return '<li><button type="button" class="' + rowClass + '" data-act="open" data-key="' + esc(item.key) + '" data-cbsid="BKS017-R01" aria-label="' + esc(payeeOf(item) + ', ' + line.narration + '. Needs you. Open') + '">' + inner + '</button></li>';
  }
  function paintLines(model) {
    var rows = model.items
      .map(function (item) {
        var state = standing(item, model.results[item.key]);
        return lineRow(item, model.results, state === 'need');
      })
      .join('');
    el('bd_lines').innerHTML =
      report.successCard(added) +
      '<div class="bd-colh" role="presentation"><span>Date</span><span>Payee and what the bank says</span><span>Account</span><span class="bd-m">Spent (AUD)</span><span class="bd-m">Received (AUD)</span><span>Status</span><span></span></div>' +
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
    var held = counts.in + counts.posted;
    var parts = ['<b>' + counts.ready + '</b> ready'];
    if (counts.wait) parts.push('<b>' + counts.wait + '</b> ' + (counts.wait === 1 ? 'waits' : 'wait') + ' for your GST answer');
    parts.push('<b>' + counts.need + '</b> ' + (counts.need === 1 ? 'needs' : 'need') + ' you');
    parts.push(held + ' in the books');
    count.innerHTML = parts.join(' · ');
    addButton.disabled = !readyCount;
    addButton.setAttribute('data-ready', String(readyCount));
    addButton.textContent = readyCount ? 'Add ' + plural(readyCount, 'line', 'lines') + ' to the demo books' : 'Nothing ready to add';
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
    el('bd_sub').textContent = (model.name || 'Statement') + ' · ' + plural(model.items.length, 'line', 'lines');
    figures(model);
    paintCheck();
    gstStrip(model);
    paintLines(model);
    report.paintBooks(model, posted, books.opening_minor);
    report.paintBrs(model);
    paintBar(model);
    paintView();
  }
  /** the slot before the figures for what the engine says about the FILE: its warnings now (for example no description column was read); the statement-check panel (refuse, confirm, already done) goes here */
  function paintCheck() {
    var slot = el('bd_warn');
    slot.hidden = !warnings.length;
    slot.innerHTML = warnings.map(function (words) { return '<p>' + esc(typeof words === 'string' ? words : words.why || words.words || 'Check this file.') + '</p>'; }).join('');
  }
  var warnings = [],
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
  /** a file goes through the statement check first (when the engine has one); the books page reads it only when the verdict allows */
  function loadStatement(text, name) {
    var slot = el('bd_check');
    slot.hidden = true;
    slot.innerHTML = '';
    checkPanel.run(text, name, function () { return readStatement(text, name); });
  }
  function readStatement(text, name) {
    warnings = [];
    var said = controller.load(text, name);
    if (said.ok) {
      loadRefusal = null;
      warnings = said.warnings || [];
      setMessage('');
    } else {
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
    gstBasis = null;
    loadRefusal = null;
    view = 'lines';
    setMessage('');
    loadStatement(SAMPLE_CSV, 'Sample statement');
  }
  function askToPost() {
    var text = controller.confirmText();
    if (!text) return void (setMessage('The engine sent no figures for this press, so nothing was added.'), paint());
    var title = 'Add ' + plural(controller.readyCount(), 'line', 'lines') + ' to the demo books?';
    labKit.confirm(title, askPanel.confirmBody(text), function () {
      controller.postReady().then(function (said) {
        var model = controller.view(),
          counts = countsOf(model);
        var recon = model.projection && model.projection.brs;
        added = { count: said.added, balance: recon ? amountText(recon.closing_books_before) : '', open: counts.need + counts.wait };
        setMessage(said.failed ? plural(said.failed, 'line was', 'lines were') + ' not added.' : plural(said.added, 'line', 'lines') + ' added to the demo books.', !said.failed);
        view = 'lines';
        paint();
      });
    }, { okLabel: 'Add to the demo books', cancelLabel: 'Not now', className: 'bd-wide', onClose: function () { return el('bd_add'); } });
  }
  function readFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      loadRefusal = { why: 'That file is too big for this page (2 MB at most). Export a shorter period.', text: '' };
      resetBooks();
      makeController();
      return paint();
    }
    file.text().then(function (text) {
      resetBooks();
      makeController();
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
    var handler = ACTIONS[target.getAttribute('data-act')] || askPanel.actions[target.getAttribute('data-act')] || checkPanel.actions[target.getAttribute('data-act')];
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
      openingMinor: function () { return books.opening_minor; }, parseOpts: function () { return { country: COUNTRY, currency: CURRENCY }; },
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
    root.CBFrame.mount({ app: 'bank-demo', bar: true, signin: false, anonymous: true, manifest: { entries: [] }, fonts: false, host: el('shell'), title: { icon: '⇄', name: 'Bank to books' } });
  }
  function start() {
    mountHeader();
    askPanel = root.CBBankDemoAsk.create(hostFor());
    checkPanel = root.CBBankDemoCheck.create(hostFor());
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
