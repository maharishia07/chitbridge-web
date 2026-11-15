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
    kit = root.CBLabKit;
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
    panel = null /* the open "What is this?" panel: { key, step, choice, refused, shown } */,
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
    return '<span class="bd-lk-badge">' + kit.badge(icon ? { icon: icon } : { name: payee }) + '</span>';
  }
  /** the account a ready line is proposed to, from the entry the engine composed: its non-bank lines, "Electricity · tax included" or "Bank fees · no tax" */
  function accountOf(item) {
    var legs = ((item.entry && item.entry.lines) || []).filter(function (leg) { return leg.account !== 'bank'; });
    if (!legs.length) return '';
    return nameOf(legs[0].account) + (legs.length > 1 ? ' · tax included' : ' · no tax');
  }

  /* ── painting ── */
  function figures(model) {
    var b = model.projection && model.projection.brs,
      counts = countsOf(model),
      total = model.items.length,
      held = counts.in + counts.posted,
      open = total - held;
    if (!b) return void (el('bd_figs').hidden = true);
    var closed = preview.minorOf(b.difference_before) === 0 && !open;
    el('bd_figs').hidden = false;
    el('bd_figs').innerHTML =
      kit.figure({ label: 'Statement balance, ' + dateWords(b.statement_date || lastDate(model)), value: amountText(b.closing_statement) }) +
      kit.figure({ label: 'Balance in the books', value: amountText(b.closing_books_before) }) +
      kit.figure({ label: 'Difference', value: amountText(b.difference_before), done: held, total: total, good: closed, note: closed ? 'All ' + total + ' lines are in the books' : plural(open, 'statement line is', 'statement lines are') + ' not in the books' });
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
      ask = model.items.some(function (item) { return item.needs === 'gst_basis'; });
    if (!ask && !gstBasis) return void (node.hidden = true);
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
    say('');
    paint();
    var again = doc.querySelector('#bd_gst [data-choice-value="' + value + '"]');
    if (again && again.focus) again.focus();
  }
  function lineRow(item, results, opensPanel) {
    var line = item.line,
      result = results[item.key],
      state = standing(item, result),
      chip = CHIPS[state],
      account = state === 'in' || state === 'posted' ? '' : accountOf(item) || (state === 'need' ? 'Choose what this is' : '');
    var out = line.debit_minor ? esc(amountText(line.debit_minor)) : '',
      inn = line.credit_minor ? esc(amountText(line.credit_minor)) : '';
    var why = result && !result.ok ? '<span class="bd-why">' + esc(result.why) + '</span>' : '';
    var inner =
      '<span class="bd-date">' + esc(preview.dateText(line.date)) + '</span>' +
      '<span class="bd-who">' + badgeOf(item) + '<span class="bd-names"><span class="bd-payee">' + esc(payeeOf(item)) + '</span><span class="bd-bank"><span class="bd-pdate">' + esc(preview.dateText(line.date)) + ' · </span>' + esc(line.narration) + '</span></span>' +
      '</span><span class="bd-acc">' + esc(account) + '</span>' +
      '<span class="bd-m bd-out bd-cellout">' + out + '</span><span class="bd-m bd-in bd-cellin">' + inn + '</span>' +
      '<span class="bd-status">' + tag(chip[0], chip[1]) + why + '</span><span class="bd-chev" aria-hidden="true">' + (opensPanel ? '›' : '') + '</span>';
    var cls = 'bd-row bd-s-' + (state === 'need' ? 'needs_you' : state);
    if (opensPanel) {
      return '<li><button type="button" class="' + cls + '" data-act="open" data-key="' + esc(item.key) + '" data-cbsid="BKS017-R01" aria-label="' + esc(payeeOf(item) + ', ' + line.narration + '. Needs you. Open') + '">' + inner + '</button></li>';
    }
    return '<li><div class="' + cls + '">' + inner + '</div></li>';
  }
  function successCard() {
    if (!added) return '';
    return (
      '<div class="bd-card" data-testid="bd-added"><div class="bd-mark" aria-hidden="true">✓</div><h2>' + esc(plural(added.count, 'line', 'lines') + ' added to the demo books') + '</h2>' +
      '<p>The bank account now reads <b>' + esc(added.balance) + '</b>.' + (added.open ? ' ' + esc(plural(added.open, 'line still needs', 'lines still need')) + ' you, and those are the only lines not in the books.' : ' Every statement line is in the books.') + '</p>' +
      '<div class="bd-card-acts"><button type="button" class="bd-btn bd-go" data-act="view" data-v="brs" data-cbsid="BKS017-B15">See the bank reconciliation</button>' +
      (added.open ? '<button type="button" class="bd-btn" data-act="firstneed" data-cbsid="BKS017-B16">Deal with the ' + added.open + '</button>' : '') + '</div>' +
      '<p class="bd-why">Demo: nothing was saved. Start again to run it again.</p></div>'
    );
  }
  function emptyCard() {
    return (
      '<div class="bd-card" data-testid="bd-empty"><div class="bd-mark" aria-hidden="true">' + kit.badge({ icon: 'bank' }) + '</div><h2>Start with a bank statement</h2>' +
      '<p>Load the sample, or your own CSV from your bank. We compare it with the books, show what is missing, and add it only when you say so.</p>' +
      '<p class="bd-why">A file you load stays on this device.</p></div>'
    );
  }
  function problemCard() {
    if (!loadRefusal) return '';
    var map = loadRefusal.text ? '<button type="button" class="bd-btn" data-act="showmap" data-cbsid="BKS017-B18">Tell us which column is which</button>' : '';
    return (
      '<div class="bd-problem" role="alert" data-cbsid="BKS017-N02"><b>' + esc(loadRefusal.why) + '</b>' + (map ? '<span>The first row may name columns we do not know.</span>' + map : '') +
      '<button type="button" class="bd-btn" data-act="retry" data-cbsid="BKS017-B17">Try again</button></div>'
    );
  }
  function paintLines(model) {
    var rows = model.items
      .map(function (item) {
        var state = standing(item, model.results[item.key]);
        return lineRow(item, model.results, state === 'need');
      })
      .join('');
    el('bd_lines').innerHTML =
      successCard() +
      '<div class="bd-colh" role="presentation"><span>Date</span><span>Payee and what the bank says</span><span>Account</span><span class="bd-m">Spent (AUD)</span><span class="bd-m">Received (AUD)</span><span>Status</span><span></span></div>' +
      '<ul class="bd-list">' + rows + '</ul>';
  }
  function paintEmpty() {
    ['bd_figs', 'bd_gst'].forEach(function (id) { el(id).hidden = true; });
    el('bd_sub').textContent = '';
    el('bd_lines').innerHTML = problemCard() + (loadRefusal && loadRefusal.mapping ? mapCard() : emptyCard());
    el('bd_books').innerHTML = '';
    el('bd_brs').innerHTML = '';
    paintBar(null);
    paintView();
  }
  function paintBooks(model) {
    var rows = (model.projection && model.projection.ledger) || [],
      ready = countsOf(model).ready,
      said = ready ? 'The bank account as it will read once the ' + plural(ready, 'ready line is', 'ready lines are') + ' in (opening ' + amountText({ amount_minor: books.opening_minor, currency: CURRENCY }) + '). Preview: not yet in the books.' : posted ? 'The bank account as it reads now, with the ' + plural(posted, 'line', 'lines') + ' added in this demo marked.' : 'The bank account as it reads now. Nothing is waiting to be added.';
    el('bd_books').innerHTML =
      '<p class="bd-note">' + esc(said) + '</p>' +
      '<table class="bd-table"><thead><tr><th>Date</th><th>What</th><th class="bd-r">In (AUD)</th><th class="bd-r">Out (AUD)</th><th class="bd-r">Balance (AUD)</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var proposed = r.state === 'proposed',
          mine = /^DEMO-/.test(r.entry_no || '');
        return '<tr class="' + (proposed ? 'bd-prop' : '') + '"><td class="bd-d">' + esc(preview.dateText(r.date)) + '</td><td>' + esc(r.narration) + (proposed ? ' ' + tag('go-tag', 'To add') : mine ? ' ' + tag('ok', 'Added') : '') + '</td><td class="bd-m">' + (preview.minorOf(r.dr) ? esc(amountText(r.dr)) : '') + '</td><td class="bd-m">' + (preview.minorOf(r.cr) ? esc(amountText(r.cr)) : '') + '</td><td class="bd-m">' + esc(amountText(r.balance)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  /** the bank reconciliation as a statement an auditor reads: books, the statement lines not yet in them, the statement; a tick ONLY when nothing is left outside the books */
  function paintBrs(model) {
    var b = model.projection && model.projection.brs;
    if (!b) return void (el('bd_brs').innerHTML = '');
    var outside = model.items.filter(function (item) {
      var state = standing(item, model.results[item.key]);
      return state !== 'in' && state !== 'posted';
    });
    var receipts = outside.filter(function (item) { return item.line.credit_minor; }),
      payments = outside.filter(function (item) { return item.line.debit_minor; });
    var line = function (item, minor) {
      return '<tr class="bd-i"><td>' + esc(preview.dateText(item.line.date)) + '</td><td>' + esc(item.line.narration) + '</td><td class="bd-r">' + esc(amountText({ amount_minor: minor, currency: CURRENCY })) + '</td></tr>';
    };
    var none = '<tr class="bd-none bd-i"><td colspan="3">None</td></tr>';
    var done = !outside.length && preview.minorOf(b.difference_before) === 0;
    var sub = function (words, money) {
      return money ? '<tr class="bd-k"><td colspan="2">' + words + '</td><td class="bd-r">' + esc(amountText(money)) + '</td></tr>' : '';
    };
    var nib = b.not_in_books || {};
    el('bd_brs').innerHTML =
      '<div class="bd-report"><article class="bd-sheet" data-cbsid="BKS017-R90"><header class="bd-sheet-h"><div><h2>Bank reconciliation statement</h2><p class="bd-sheet-sub"><b>Demo, sample data</b> · ' + esc(ACCOUNT) + ' · as at ' + esc(dateWords(b.statement_date || lastDate(model))) + ' · Currency ' + CURRENCY + '</p></div>' +
      '<div><button type="button" class="bd-btn" data-act="print" data-cbsid="BKS017-B14">Print or save as PDF</button></div></header>' +
      '<table><tbody><tr class="bd-k"><td colspan="2">Balance per the books</td><td class="bd-r">' + esc(amountText(b.closing_books_before)) + '</td></tr>' +
      '<tr class="bd-g"><td colspan="3">Add: receipts on the statement, not yet in the books (' + receipts.length + ')</td></tr>' +
      (receipts.length ? receipts.map(function (item) { return line(item, item.line.credit_minor); }).join('') + sub('Total receipts', nib.in) : none) +
      '<tr class="bd-g"><td colspan="3">Less: payments on the statement, not yet in the books (' + payments.length + ')</td></tr>' +
      (payments.length ? payments.map(function (item) { return line(item, item.line.debit_minor); }).join('') + sub('Total payments', nib.out) : none) +
      '<tr class="bd-k"><td colspan="2">Balance per the bank statement</td><td class="bd-r">' + esc(amountText(b.closing_statement)) + '</td></tr>' +
      '<tr class="bd-g"><td colspan="3">In the books, not yet on the statement</td></tr>' + none +
      '<tr class="bd-res"><td colspan="2">Difference, statement less books' + (done ? '' : ' <span class="bd-pending">' + esc(plural(outside.length, 'statement line', 'statement lines') + ' not in the books yet') + '</span>') + '</td><td class="bd-r">' + esc(amountText(b.difference_before)) + (done ? ' <span class="bd-tick" aria-label="Reconciled">✓</span>' : '') + '</td></tr></tbody></table>' +
      '<p class="bd-foot">' + (done ? 'Reconciled: every statement line is in the books and the statement and the books agree.' : 'Not reconciled yet. The tick appears when no statement line is left outside the books.') + '</p>' +
      '<div class="bd-sign"><span>Prepared by ________________</span><span>Reviewed by ________________</span></div></article>' +
      '<div class="bd-edges"><h3>Not in this demo yet</h3><ul><li>Match to an invoice (find and match several, part payment)</li><li>Split a line</li><li>Undo a posted line</li><li>Bank rules you write yourself</li><li>Bank feeds: CSV only for now, no OFX or QIF</li></ul>' +
      '<h3>What this does that others do not</h3><ul><li>Shows a preview before anything posts</li><li>Recognises a line seen in an earlier file</li><li>Names a closed month, never skips it silently</li><li>Nothing posts by itself</li></ul></div></div>';
  }
  function paintBar(model) {
    var go = el('bd_add'),
      count = el('bd_count');
    if (!model) {
      go.disabled = true;
      go.textContent = 'Nothing ready to add';
      count.textContent = '';
      return;
    }
    var counts = countsOf(model),
      n = controller.readyCount();
    var held = counts.in + counts.posted;
    var parts = ['<b>' + counts.ready + '</b> ready'];
    if (counts.wait) parts.push('<b>' + counts.wait + '</b> ' + (counts.wait === 1 ? 'waits' : 'wait') + ' for your GST answer');
    parts.push('<b>' + counts.need + '</b> ' + (counts.need === 1 ? 'needs' : 'need') + ' you');
    parts.push(held + ' in the books');
    count.innerHTML = parts.join(' · ');
    go.disabled = !n;
    go.setAttribute('data-ready', String(n));
    go.textContent = n ? 'Add ' + plural(n, 'line', 'lines') + ' to the demo books' : 'Nothing ready to add';
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
    gstStrip(model);
    paintLines(model);
    paintBooks(model);
    paintBrs(model);
    paintBar(model);
    paintView();
  }
  var msg = '',
    msgOk = false,
    gstBasis = null;
  function say(words, good) {
    msg = words || '';
    msgOk = !!good;
  }

  /* ── the "What is this?" panel: the lab-kit popup in its side / sheet placement (CMP002 variant) ── */
  function itemOf(key) {
    return controller.view().items.filter(function (one) { return one.key === key; })[0] || null;
  }
  function choicesFor(item) {
    var said = whatIsThis(),
      out = item.line.debit_minor > 0;
    var list = said ? said.items.filter(function (one) { return one.side === 'both' || one.side === (out ? 'out' : 'in'); }) : [];
    return { items: list, later: said ? said.later : [], said: !!said };
  }
  function selectHtml(label, name, options, value) {
    return '<label>' + esc(label) + '<select class="bd-inp" data-cbsid="BKS017-S05" data-field="' + name + '"><option value="">Choose</option>' +
      options.map(function (one) { return '<option value="' + esc(one[0]) + '"' + (value === one[0] ? ' selected' : '') + '>' + esc(one[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function panelStep1(item, choices) {
    var out = item.line.debit_minor > 0,
      all = [];
    if (item.party) all.push(['payee', 'Someone I deal with', 'A customer or a supplier: say who']);
    choices.items.forEach(function (one) { all.push([one.id, one.words, '']); });
    var rows = all.map(function (one) {
      return '<button type="button" role="radio" aria-checked="' + (panel.choice === one[0]) + '" data-act="pick" data-kind="' + esc(one[0]) + '" data-cbsid="BKS017-B21">' + esc(one[1]) + (one[2] ? '<small>' + esc(one[2]) + '</small>' : '') + '</button>';
    }).join('');
    var later = choices.later.map(function (one) {
      return '<button type="button" role="radio" aria-checked="false" disabled>' + esc(one.words) + '<small>Later: not in this demo yet</small></button>';
    }).join('');
    return '<p class="bd-step">Step 1 of 2</p><p class="bd-q"><b>What is this?</b> Money ' + (out ? 'out' : 'in') + '. Nothing on the line says.</p>' +
      '<div class="bd-choices" role="radiogroup" aria-label="What is this?">' + rows + later + '</div>' +
      '<button type="button" class="lk-btn lk-btn-go" data-act="next" data-cbsid="BKS017-B22"' + (panel.choice ? '' : ' disabled') + '>Next</button>';
  }
  function partyPanel(item) {
    var party = item.party;
    if (!party) return '<p class="bd-q">Say who this is.</p>';
    var meant = (item.didYouMean || []).map(function (one) {
      return '<button data-cbsid="BKS017-B03" type="button" class="bd-btn" data-act="meant" data-key="' + esc(item.key) + '" data-id="' + esc(one.id) + '" data-name="' + esc(one.name) + '">' + esc(one.name) + '</button>';
    }).join('');
    return '<label>Payee<input data-cbsid="BKS017-I02" class="bd-inp" type="text" maxlength="120" aria-label="Payee name" data-act="pname" data-key="' + esc(item.key) + '" value="' + esc(party.name) + '"></label>' +
      '<label>Payee kind<select data-cbsid="BKS017-S04" class="bd-inp" aria-label="Payee kind" data-act="pkind" data-key="' + esc(item.key) + '">' +
      ['supplier', 'customer'].map(function (kind) { return '<option value="' + kind + '"' + (party.kind === kind ? ' selected' : '') + '>' + kind + '</option>'; }).join('') + '</select></label>' +
      (meant ? '<div class="bd-dym"><span>Did you mean</span> ' + meant + '</div>' : '') +
      '<button type="button" class="lk-btn lk-btn-go" data-act="resolve" data-key="' + esc(item.key) + '" data-cbsid="BKS017-B07">Mark ready</button>';
  }
  function panelStep2(item, choices) {
    var back = '<p class="bd-step">Step 2 of 2</p><button type="button" class="bd-back" data-act="back" data-cbsid="BKS017-B23">‹ Change the answer</button>';
    if (panel.choice === 'payee') return back + partyPanel(item);
    var one = choices.items.filter(function (entry) { return entry.id === panel.choice; })[0];
    if (!one) return back + '<p class="bd-q">Pick an answer first.</p>';
    var out = item.line.debit_minor > 0,
      body = '<p class="bd-q"><b>' + esc(one.words) + '</b></p>';
    if (one.ask === 'account') body += selectHtml('Account', 'account', one.accounts.map(function (acct) { return [acct.role, acct.name]; }), '');
    else if (one.fixed) body += '<p class="bd-why">Between the bank and ' + esc(nameOf(one.fixed)) + '. No payee and no tax are asked.</p>';
    else body += '<p class="bd-why">Paid to the tax office. No account and no tax kind are asked.</p>';
    if (one.event === 'expense' || one.event === 'other_income') body += selectHtml('Tax on this line', 'taxkind', chartOf().taxKinds.map(function (kind) { return [kind.id, kind.name]; }), '');
    return back + body + (panel.refused ? '<p class="bd-refused" role="alert">' + esc(panel.refused) + '</p>' : '') +
      '<button type="button" class="lk-btn lk-btn-go" data-act="resolve2" data-key="' + esc(item.key) + '" data-cbsid="BKS017-B08">Mark ready</button>';
  }
  /** no "What is this?" list from the engine yet: the old single step, an account from the pack's chart (and the tax kind on money out), or who it is */
  function panelPlain(item) {
    var out = item.line.debit_minor > 0,
      chart = chartOf(),
      list = (out ? chart.expense : chart.income).map(function (acct) { return [acct.role, acct.name]; });
    return '<p class="bd-q"><b>What is this?</b> Pick an account, or say who it is.</p>' + selectHtml('Account', 'account', list, '') +
      (out ? selectHtml('Tax on this line', 'taxkind', chart.taxKinds.map(function (kind) { return [kind.id, kind.name]; }), '') : '') +
      (panel.refused ? '<p class="bd-refused" role="alert">' + esc(panel.refused) + '</p>' : '') +
      '<button type="button" class="lk-btn lk-btn-go" data-act="resolve2" data-key="' + esc(item.key) + '" data-cbsid="BKS017-B08">Mark ready</button>' + (item.party ? '<p class="bd-step">Or a payee</p>' + partyPanel(item) : '');
  }
  function paintPanel() {
    if (!panel || !panel.shown) return;
    var item = itemOf(panel.key);
    var body = panel.shown.node.querySelector('.lk-pop-body');
    if (!item) return void panel.shown.close();
    var choices = choicesFor(item);
    body.innerHTML = '<div class="bd-panel">' + (!choices.said ? panelPlain(item) : panel.step === 2 ? panelStep2(item, choices) : panelStep1(item, choices)) + '</div>';
    var first = (panel.focusSel && body.querySelector(panel.focusSel)) || body.querySelector('[aria-checked="true"],[data-act="pick"],select,input,button');
    if (first && first.focus) first.focus();
  }
  function openPanel(key) {
    var item = itemOf(key);
    if (!item) return;
    panel = { key: key, step: 1, choice: null, refused: '', focusSel: '', shown: null };
    var title = payeeOf(item) + ' · ' + preview.dateText(item.line.date) + ' · ' + amountText(item.line.debit_minor ? { amount_minor: item.line.debit_minor, currency: CURRENCY } : { amount_minor: item.line.credit_minor, currency: CURRENCY });
    panel.shown = kit.popup(title, function () {}, 'lk-side', function () {
      var after = panel && panel.next;
      panel = null;
      return (after && doc.querySelector('[data-key="' + after + '"]')) || el('bd_add');
    });
    paintPanel();
  }
  function closePanel(nextKey) {
    if (!panel || !panel.shown) return;
    panel.next = nextKey || null;
    panel.shown.close();
  }
  function firstNeedKey() {
    var model = controller.view();
    var found = model.items.filter(function (item) { return standing(item, model.results[item.key]) === 'need'; })[0];
    return found ? found.key : null;
  }
  /** the select a button reads: the panel's own fields, by data-field */
  function fieldOf(name) {
    var node = panel && panel.shown && panel.shown.node.querySelector('select[data-field="' + name + '"]');
    return node ? node.value : '';
  }
  function resolvePanel(key, plain) {
    var said = null;
    if (plain === 'party') said = controller.resolveLine(key);
    else said = controller.resolveLine(key, { kind: panel.choice && panel.choice !== 'payee' ? panel.choice : undefined, account: fieldOf('account') || undefined, tax_kind: fieldOf('taxkind') || undefined });
    if (!said.ok) {
      panel.refused = said.why;
      panel.focusSel = '.bd-refused,[data-act^="resolve"]';
      paint();
      return paintPanel();
    }
    added = null;
    say('');
    paint();
    closePanel(firstNeedKey());
  }

  /* ── actions ── */
  function loadStatement(text, name) {
    var said = controller.load(text, name);
    if (said.ok) {
      loadRefusal = null;
      say('');
    } else {
      loadRefusal = { why: plainRefusal(said.why), text: /header|column|mapping|preset/i.test(said.why) ? text : '', name: name };
      say('');
    }
    paint();
    return said;
  }
  /** the engine's reason in a shopkeeper's words: a file the page cannot read says what to do next, never "pass a preset or a mapping" */
  function plainRefusal(why) {
    if (/header|column|mapping|preset/i.test(why)) return 'We could not tell which column is which in that file.';
    if (/too big/i.test(why)) return why;
    if (/currency/i.test(why)) return 'That file is in a different currency from this bank account. Nothing is converted in this demo.';
    return 'That file is not a bank statement we can read.';
  }
  function startAgain() {
    resetBooks();
    makeController();
    gstBasis = null;
    loadRefusal = null;
    view = 'lines';
    say('');
    loadStatement(SAMPLE_CSV, 'Sample statement');
  }
  /** the confirm popup: the reach first, then each line with its payee, account and the Dr and Cr lines the engine composed, each entry's own totals */
  function confirmBody(text) {
    var model = controller.view(),
      ready = model.items.filter(function (item) { return standing(item, model.results[item.key]) === 'ready'; });
    var money = function (minor) { return esc(amountText({ amount_minor: minor, currency: CURRENCY })); };
    var cards = ready.map(function (item) {
      var entry = item.entry || { lines: [], totals: null },
        t = entry.totals;
      var legs = (entry.lines || []).map(function (leg) {
        var dr = (leg.dr_minor || 0) > 0;
        return '<tr><td>' + (dr ? 'Dr' : 'Cr') + '</td><td>' + esc(nameOf(leg.account)) + '</td><td class="bd-r">' + money(dr ? leg.dr_minor : leg.cr_minor) + '</td></tr>';
      }).join('');
      return '<li><div class="bd-lp-top"><span>' + esc(payeeOf(item)) + '</span><span>' + esc(preview.dateText(item.line.date)) + '</span></div><div class="bd-lp-sub">' + esc(accountOf(item)) + (item.party && item.party.status === 'new' ? ' · new payee made first' : '') + '</div><table class="bd-jt"><tbody>' + legs + '</tbody></table>' +
        (t ? '<div class="bd-lp-sub">Dr ' + money(t.dr_minor) + ' = Cr ' + money(t.cr_minor) + (t.dr_minor === t.cr_minor ? ' ✓' : '') + '</div>' : '') + '</li>';
    }).join('');
    var facts = text.lines.map(function (words) { return esc(words.replace(/new part(y|ies)/g, function (_, tail) { return tail === 'y' ? 'new payee' : 'new payees'; })); });
    return '<p class="lk-reach">' + facts.slice(0, 2).join(' · ') + '</p><p>' + facts.slice(2).join('</p><p>') + '</p><ul class="bd-lines-pop">' + cards + '</ul><p class="bd-note">Demo: only the books on this page change. Nothing is sent or saved.</p>';
  }
  function askToPost() {
    var text = controller.confirmText();
    if (!text) return void (say('The engine sent no figures for this press, so nothing was added.'), paint());
    var title = 'Add ' + plural(controller.readyCount(), 'line', 'lines') + ' to the demo books?';
    kit.confirm(title, confirmBody(text), function () {
      controller.postReady().then(function (said) {
        var model = controller.view(),
          counts = countsOf(model);
        var b = model.projection && model.projection.brs;
        added = { count: said.added, balance: b ? amountText(b.closing_books_before) : '', open: counts.need + counts.wait };
        say(said.failed ? plural(said.failed, 'line was', 'lines were') + ' not added.' : plural(said.added, 'line', 'lines') + ' added to the demo books.', !said.failed);
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
  var MAP_FIELDS = [['date', 'Date'], ['narration', 'What the bank says'], ['debit', 'Money out'], ['credit', 'Money in'], ['amount', 'One amount column (minus = out)'], ['balance', 'Balance']];
  function headCells(text) {
    var first = String(text || '').split(/\r?\n/).filter(function (row) { return row.trim(); })[0] || '';
    return first.split(',').map(function (cell) { return cell.replace(/^"|"$/g, '').trim(); }).filter(Boolean);
  }
  function mapCard() {
    var cells = headCells(loadRefusal.text);
    if (!cells.length) return emptyCard();
    return '<div class="bd-map" data-cbsid="BKS017-M01"><h2>Which column is which?</h2><p class="bd-why">Tell us once and we read the rest of the file. Nothing is guessed.</p><div class="bd-map-grid">' +
      MAP_FIELDS.map(function (field) {
        return '<label>' + esc(field[1]) + '<select class="bd-inp" data-cbsid="BKS017-S07" data-map="' + field[0] + '"><option value="">Not in this file</option>' + cells.map(function (cell) { return '<option value="' + esc(cell) + '">' + esc(cell) + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div><button type="button" class="bd-btn bd-go" data-act="readmap" data-cbsid="BKS017-B26">Read the file</button></div>';
  }
  function readWithMap() {
    var mapping = {};
    Array.prototype.forEach.call(doc.querySelectorAll('select[data-map]'), function (node) {
      if (node.value) mapping[node.getAttribute('data-map')] = node.value;
    });
    var text = loadRefusal.text,
      name = loadRefusal.name;
    resetBooks();
    makeController({ country: COUNTRY, currency: CURRENCY, mapping: mapping });
    loadStatement(text, name);
  }
  function toggleMore(open) {
    var menu = el('bd_menu');
    menu.hidden = !open;
    el('bd_more').setAttribute('aria-expanded', String(open));
  }
  function onClick(event) {
    var target = event.target.closest('[data-act]');
    if (!target) {
      if (!event.target.closest('.bd-more')) toggleMore(false);
      return;
    }
    var action = target.getAttribute('data-act'),
      key = target.getAttribute('data-key'),
      said = null;
    if (action === 'open') return openPanel(key);
    else if (action === 'pick') {
      panel.choice = target.getAttribute('data-kind');
      panel.focusSel = '[data-kind="' + panel.choice + '"]';
      return paintPanel();
    } else if (action === 'next') {
      panel.step = 2;
      panel.focusSel = 'select,input';
      return paintPanel();
    } else if (action === 'back') {
      panel.step = 1;
      panel.refused = '';
      panel.focusSel = '[aria-checked="true"]';
      return paintPanel();
    } else if (action === 'resolve') return resolvePanel(key, 'party');
    else if (action === 'resolve2') return resolvePanel(key, 'kind');
    else if (action === 'meant') {
      controller.editParty(key, { status: 'existing', id: target.getAttribute('data-id'), name: target.getAttribute('data-name') });
      panel.focusSel = '[data-act="resolve"]';
      paint();
      return paintPanel();
    } else if (action === 'view') view = target.getAttribute('data-v');
    else if (action === 'firstneed') {
      view = 'lines';
      added = null;
      paint();
      var next = firstNeedKey();
      var node = next && doc.querySelector('[data-key="' + next + '"]');
      return node && node.focus();
    } else if (action === 'print') return root.print();
    else if (action === 'retry') {
      loadRefusal = null;
      paintEmpty();
      return el('bd_file').click();
    } else if (action === 'showmap') {
      loadRefusal.mapping = true;
      return paint();
    } else if (action === 'readmap') return readWithMap();
    if (said && !said.ok) say(said.why);
    paint();
  }
  function onChange(event) {
    var t = event.target,
      act = t.getAttribute && t.getAttribute('data-act'),
      key = t.getAttribute && t.getAttribute('data-key');
    if (act !== 'pname' && act !== 'pkind') return;
    var one = itemOf(key);
    if (!one || !one.party) return;
    var said = controller.editParty(key, { name: act === 'pname' ? t.value : one.party.name, kind: act === 'pkind' ? t.value : one.party.kind });
    if (!said.ok && panel) panel.refused = said.why;
    paint();
    paintPanel();
  }
  /** the one product header: CBFrame bar, signed out ("Sign in" goes to Home); nothing stored is read, nothing is fetched, no font is linked (the page's CSP) */
  function mountHeader() {
    if (!root.CBFrame || !el('shell')) return;
    root.CBFrame.mount({ app: 'bank-demo', bar: true, signin: false, anonymous: true, manifest: { entries: [] }, fonts: false, host: el('shell'), title: { icon: '⇄', name: 'Bank to books' } });
  }
  function start() {
    mountHeader();
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
