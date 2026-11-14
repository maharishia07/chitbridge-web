/* bank-demo.js — the page script of public/bank-demo.html (the no-login Bank-to-books showcase). External, because the page's CSP allows no inline script.
 * OWNS      the sample statement and sample books (AU, AUD), the DEMO post adapter (it only updates the on-screen books and party list), and the painting of
 *           the lines, the books-after ledger, the reconciliation and the confirm popup. The flow itself is public/app/bank-preview.js.
 * CALLED BY public/bank-demo.html. No api call, no storage, no cookie: a file the visitor loads is read on the device and held in memory.
 * FLOW      load → CBBankPreview.create({ engine, post: demoPost }) → load(text) → paint → "Add N" → CBLabKit.confirm(reach) → postReady → paint again
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  BKS017-B01 load the sample · BKS017-I01 load your own CSV · BKS017-B02 add the ready lines · BKS017-S01..S03 the three views · BKS017-I02 new party name
 *           BKS017-S04 new party kind · BKS017-B03 use an existing party · BKS017-B04 GST on cash · BKS017-B05 GST on accrual · BKS017-B06 start again
 */
(function (root) {
  'use strict';
  var P = root.CBBankPreview,
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

  var books = { opening_minor: 1000000, lines: [] },
    parties = [],
    ctl = null,
    view = 'lines',
    posted = 0;

  function el(id) {
    return doc.getElementById(id);
  }
  function resetBooks() {
    posted = 0;
    parties = [];
    books.lines = SAMPLE_BOOKS.map(function (row, index) {
      return { id: 'L' + (index + 1), date: row[0], dr_minor: row[1], cr_minor: row[2], ref: '', narration: row[3], entry_no: 'MJ-' + (index + 1) };
    });
  }
  /** the DEMO adapter: no server, no storage. A new party joins the on-screen list; the entry joins the on-screen books as the statement line's own side. */
  async function demoPost(item) {
    if (item.party && item.party.status === 'new') parties.push({ name: item.party.name, kind: item.party.kind });
    posted += 1;
    books.lines.push({ id: 'D' + posted, date: item.line.date, dr_minor: item.line.credit_minor || 0, cr_minor: item.line.debit_minor || 0, ref: item.ref, narration: item.line.narration, entry_no: 'DEMO-' + posted });
    return { ok: true, entry_no: 'DEMO-' + posted };
  }
  function makeController() {
    ctl = P.create({
      engine: { recon: root.CBBankRecon, project: root.CBBankProject },
      currency: CURRENCY,
      account: ACCOUNT,
      ledger: function () {
        return { lines: books.lines.slice(), opening_minor: books.opening_minor };
      },
      post: demoPost,
      lockedMonth: function () {
        return null;
      },
      explainOpts: { learned: LEARNED, country: 'AU', parties: parties },
      parseOpts: { country: 'AU', currency: CURRENCY }
    });
  }
  function money(minor) {
    return P.moneyText(minor, CURRENCY);
  }
  function tag(kind, words) {
    return '<span class="bd-tag bd-' + kind + '">' + esc(words) + '</span>';
  }

  /* ── painting ── */
  function lineNote(item, result) {
    if (result) return result.ok ? tag('ok', 'Added in the demo books') : tag('bad', 'Not added: ' + result.why);
    if (item.needs === 'gst_basis') return gstQuestion();
    if (item.state === 'needs_you') return item.needs ? tag('ask', P.NEEDS_WORDS[item.needs] || 'Needs you') : '<span class="bd-why">' + esc(item.why || 'Nothing here says who or what this is.') + '</span>';
    return item.state === 'closed' ? tag('bad', item.why) : '';
  }
  function gstQuestion() {
    return (
      '<span class="bd-ask">' + esc(P.NEEDS_WORDS.gst_basis) + ' Do you account for GST on:</span> ' +
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
      '</select> ' + (meant ? '<span class="bd-why">Did you mean</span> ' + meant : '') + '</span>'
    );
  }
  function lineRow(item, results) {
    var line = item.line,
      result = results[item.key];
    var stateKey = result ? (result.ok ? 'posted' : 'failed') : item.state;
    return (
      '<tr class="bd-row bd-s-' + esc(stateKey) + '"><td class="bd-d">' + esc(P.dateText(line.date)) + '</td><td class="bd-n">' + esc(line.narration) + '</td>' +
      '<td class="bd-m">' + (line.debit_minor ? esc(money(line.debit_minor)) : '') + '</td><td class="bd-m">' + (line.credit_minor ? esc(money(line.credit_minor)) : '') + '</td>' +
      '<td class="bd-st">' + tag(stateKey === 'posted' ? 'ok' : stateKey === 'proposed' ? 'go' : stateKey === 'in_books' ? 'diff' : 'ask', P.STATE_WORDS[stateKey] || 'Needs you') +
      '<div class="bd-sub">' + partyBox(item) + lineNote(item, result) + '</div></td></tr>'
    );
  }
  function paintLines(model) {
    el('bd_lines').innerHTML =
      '<table class="bd-table"><thead><tr><th>Date</th><th>What the bank says</th><th>Out</th><th>In</th><th>In your books?</th></tr></thead><tbody>' +
      model.items.map(function (item) { return lineRow(item, model.results); }).join('') + '</tbody></table>';
  }
  function paintBooks(model) {
    var rows = (model.projection && model.projection.ledger) || [];
    el('bd_books').innerHTML =
      '<p class="bd-note">Your bank account as it will read once the ready lines are in. Preview: not yet in your books.</p>' +
      '<table class="bd-table"><thead><tr><th>Date</th><th>What</th><th>In</th><th>Out</th><th>Balance</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="' + (r.proposed ? 'bd-prop' : '') + '"><td class="bd-d">' + esc(P.dateText(r.date)) + '</td><td class="bd-n">' + esc(r.narration) + (r.proposed ? ' ' + tag('go', 'to add') : '') + '</td><td class="bd-m">' + (r.dr_minor ? esc(money(r.dr_minor)) : '') + '</td><td class="bd-m">' + (r.cr_minor ? esc(money(r.cr_minor)) : '') + '</td><td class="bd-m">' + esc(money(r.balance_minor)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function paintBrs(model) {
    var b = model.projection && model.projection.brs;
    if (!b) return void (el('bd_brs').innerHTML = '');
    var open = (b.open || []).map(function (o) { return '<li>' + esc(P.dateText(o.date)) + ' · ' + esc(o.narration) + ' · ' + esc(money(o.amount_minor)) + '</li>'; }).join('');
    el('bd_brs').innerHTML =
      '<dl class="bd-brs"><dt>Statement closing</dt><dd>' + esc(money(b.statement_closing_minor)) + '</dd><dt>Your books</dt><dd>' + esc(money(b.books_closing_minor)) +
      '</dd><dt>Difference</dt><dd class="' + (b.difference_minor === 0 ? 'bd-zero' : 'bd-diff') + '">' + esc(money(b.difference_minor)) + '</dd></dl>' +
      (open ? '<p class="bd-note">Still open:</p><ul class="bd-open">' + open + '</ul>' : '<p class="bd-note">Every line is in the books.</p>');
  }
  function paintStrip(model) {
    var b = model.projection && model.projection.brs,
      n = ctl.readyCount();
    el('bd_sum').textContent = b ? 'Statement ' + money(b.statement_closing_minor) + ' · Books ' + money(b.books_closing_minor) + ' · Difference ' + money(b.difference_minor) : '';
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
    var model = ctl.view();
    el('bd_msg').textContent = model.refusal || '';
    if (!model.parsed) return;
    paintLines(model);
    paintBooks(model);
    paintBrs(model);
    paintStrip(model);
    paintView();
  }

  /* ── actions ── */
  function load(text, name) {
    var said = ctl.load(text, name);
    el('bd_msg').textContent = said.ok ? '' : said.why;
    if (said.ok) paint();
    return said;
  }
  function startAgain() {
    resetBooks();
    makeController();
    load(SAMPLE_CSV, 'Sample statement');
  }
  function askToPost() {
    var text = ctl.confirmText();
    if (!text) return void (el('bd_msg').textContent = 'The engine sent no figures for this press, so nothing was added.');
    var body = text.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '<p class="bd-note">Demo: only the books on this page change.</p>';
    root.CBLabKit.confirm(text.title, body, function () {
      ctl.postReady().then(function () { view = 'brs'; paint(); });
    }, { okLabel: 'Add to the demo books' });
  }
  function onFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return void (el('bd_msg').textContent = 'That file is too big for this page (2 MB at most).');
    file.text().then(function (text) {
      resetBooks();
      makeController();
      load(text, file.name);
    });
  }
  function onClick(event) {
    var t = event.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'gst') ctl.answer('gst_basis', t.getAttribute('data-v'));
    else if (act === 'meant') ctl.editParty(t.getAttribute('data-key'), { status: 'existing', id: t.getAttribute('data-id'), name: t.getAttribute('data-name') });
    else if (act === 'view') view = t.getAttribute('data-v');
    paint();
  }
  function onChange(event) {
    var t = event.target,
      act = t.getAttribute && t.getAttribute('data-act'),
      key = t.getAttribute && t.getAttribute('data-key');
    if (act !== 'pname' && act !== 'pkind') return;
    var party = ctl.view().items.filter(function (i) { return i.key === key; })[0].party;
    var said = ctl.editParty(key, { name: act === 'pname' ? t.value : party.name, kind: act === 'pkind' ? t.value : party.kind });
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
