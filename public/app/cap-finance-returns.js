/* cap-finance-returns.js — CB Finance · Returns (round T3-P1-MONEY): COUNTRY-FIRST. An Indian shop downloads the GSTR-1 / GSTR-3B files the server
 * already builds, for the month chosen; an AU / AE shop is told which return applies (BAS · VAT return) and where it is prepared (CB Accounts › GST);
 * a country whose pack has no return is told so; no country → Settings › Country. Loaded by finance.html after cap-finance.js.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): api('me') (the shop's country — the read Home and Settings make; no ledger needed: India's return is the
 * rail's) · shopReg (helpers.js: the shop's pack, CBRegulation — never a second `country === 'IN'` for words) · gstrDownload (helpers.js: THE ONE download,
 * lifted from cap-admin.js misTaxExport) · monthNames (helpers.js) · bkToday (cap-books.js, the shop's day) · CBAction (M64 — a press, one file) · the
 * page's .card / .act / .inp / .hint (no new look) · finDenied.
 * ⭐ ONE CALCULATION (rule 2): nothing is summed here. The files are the server's (routes/tax.js → tax-lines gstr1 · gstr3b, the one builder); AU BAS /
 * AE VAT201 are books-period.taxReturn → engines gst-returns.returnFor, painted in CB Accounts — this tab builds no second return and shows no figure.
 * ⭐ NEW PATHS (rule 4): FR (this tab's state) · frMonths (the last twelve calendar months as a picker; the workshop's band has one typed month and
 * bkMonths is the fiscal year's names, not a picker) · frPaint.
 * ⚠️ Never error.message on a screen: a failure says what happened and offers Try again.
 * OWNS      the Returns tab of CB Finance: the country's return, the server's files and words painted (frLoad · frMount · frMonths · frCard · frPaint · frGet)
 * CALLED BY public/finance.html (script tag) · public/app/cap-finance.js (frLoad · frMount). Not loaded by app.html
 * FLOW      finance.html opens Returns → api('me') (the shop's country) → frPaint: India downloads the GSTR files (gstrDownload), AU / AE are told where the return is prepared → Try again on a failure
 * CARD      15-tax-and-country-packs/gst-returns-bas-vat
 */
'use strict';

var FR = { gen: 0, state: 'loading', code: null, pack: null };
var FR_SEE = 'Only the owner may see returns.';

/** the Returns page's read: the shop's country and its tax pack (a late answer is dropped, an owner-only refusal is said in words) */
async function frLoad(quiet) {
  var generation = ++FR.gen;
  if (!quiet) {
    FR.state = 'loading';
    frPaint();
  }
  try {
    var reply = await api('me');
    if (generation !== FR.gen) return;
    var e = (reply && reply.entity) || reply || {},
      code = e.country ? String(e.country).toUpperCase() : null;
    FR.code = code;
    FR.pack = code ? shopReg(code) : null;
    if (code && typeof SESSION !== 'undefined' && SESSION) SESSION.country = code; /* CX0: the pack's words reach this page too */
    FR.state = 'ready';
    ftNav();
  } catch (e2) {
    if (generation !== FR.gen) return;
    if (e2 && e2.status === 403) {
      finDenied(FR_SEE, 'Returns');
      return;
    }
    FR.state = 'error';
  }
  frPaint();
}
function frRetry() {
  frLoad();
}

/** the running month and the eleven before it, newest first, from the shop's day — value YYYY-MM, label in the reader's month words (IN-F-08: the month in progress can be asked for, marked as running) */
function frMonths() {
  var today = bkToday(),
    y = Number(today.slice(0, 4)),
    monthNo = Number(today.slice(5, 7)),
    names = monthNames('short'),
    out = [];
  for (var index = 0; index < 12; index++) {
    var shownMonth = monthNo - index,
      shownYear = y;
    while (shownMonth < 1) {
      shownMonth += 12;
      shownYear -= 1;
    }
    out.push({ v: shownYear + '-' + String(shownMonth).padStart(2, '0'), label: names[shownMonth - 1] + ' ' + shownYear + (index === 0 ? ' · ' + tx('running') : '') });
  }
  return out;
}
function frCard(html, tid) {
  return '<div class="content"><div class="card" data-testid="' + tid + '" style="margin:0">' + html + '</div></div>';
}

/** India's return files (GSTR-1 and GSTR-3B), read from the rail: the month picker, the two file buttons greyed with the reason for a view-only login, the month's GST by head */
function frPaintRail(node) {
  var months = frMonths(),
    shut = viewOnlyLogin() ? viewOnlyMoneyWhy() : ''; /* M-F-03: a view-only login is refused the figures by the api; the file buttons are GREYED with that reason (one readiness state), never offered */
  var shutAttrs = shut ? ' aria-disabled="true" data-ready="no" disabled title="' + esc(shut) + '" style="opacity:.55;cursor:not-allowed"' : '';
  node.innerHTML = frCard(
    '<h2>' +
      esc(tx('GSTR-1 and GSTR-3B')) +
      '</h2><p>' +
      esc(tx('Read from the rail. Check in the offline tool before filing.')) +
      '</p>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:13.5px;font-weight:600">' +
      esc(tx('Month')) +
      '<select data-cbsid="FIN007-S01" class="inp" id="fr_month" data-testid="fr-month" onchange="frShow()">' +
      months
        .map(function (x) {
          return '<option value="' + esc(x.v) + '">' + esc(x.label) + '</option>';
        })
        .join('') +
      '</select></label>' +
      '<div class="supacts"><button data-cbsid="FIN007-B01" type="button" class="act" data-testid="fr-gstr1"' + shutAttrs + ' onclick="frGet(\'gstr1\',this)">' +
      esc(tx('GSTR-1 file')) +
      '</button>' +
      '<button data-cbsid="FIN007-B02" type="button" class="act quiet" data-testid="fr-gstr3b"' + shutAttrs + ' onclick="frGet(\'gstr3b\',this)">' +
      esc(tx('GSTR-3B file')) +
      '</button></div>' +
      (shut ? '<p class="hint" data-testid="fr-shut-why">' + esc(shut) + '</p>' : '') +
      '<div id="fr_view" data-testid="fr-view" role="status"></div>' +
      '<div id="fr_out" class="hint" role="status" data-testid="fr-out"></div>' +
      '<p class="hint" data-testid="fr-prepared">' +
      esc(tx('Prepared, not filed.')) +
      '</p>',
    'fr-gstr'
  );
  if (!shut) frShow(); /* IN-F-08: the running month's GST is on the screen as it opens (a view-only login is refused it, so it is not asked) */
}
/** the Returns screen drawn from FR: loading, the read failed, no country set, the GST rail (frPaintRail), or the country pack's own return */
function frPaint() {
  var node = document.getElementById('screen');
  if (!node) return;
  node.className = 'screen';
  if (FR.state === 'loading') {
    node.innerHTML = frCard('<div class="loadwrap"><span class="spin"></span>' + esc(tx('Loading…')) + '</div>', 'fr-loading');
    return;
  }
  if (FR.state === 'error') {
    node.innerHTML = frCard(
      '<h2>' +
        esc(tx('Could not read your country')) +
        '</h2><p>' +
        esc(tx('Nothing was lost.')) +
        '</p>' +
        '<button data-cbsid="CMP009" type="button" class="act" data-testid="fr-retry" onclick="frRetry()">' +
        esc(tx('Try again')) +
        '</button>',
      'fr-error'
    );
    return;
  }
  if (!FR.code) {
    node.innerHTML = frCard(
      '<h2>' +
        esc(tx('Country not set')) +
        '</h2><p>' +
        esc(tx('A return follows the country your shop keeps its books in.')) +
        '</p>' +
        '<a class="act" href="/settings.html#/country" data-testid="fr-country">' +
        esc(tx('Set the country')) +
        '</a>',
      'fr-nocountry'
    );
    return;
  }
  var pack = FR.pack;
  /* India's GSTR-1 / 3B are the RAIL's read (books-period.taxReturn refuses the ledgers for the IN pack the same way): the pack id decides, not a word */
  if (pack && packRegForm(pack.id).railReturn) {
    frPaintRail(node);
    return;
  }
  if (pack && pack.returns && pack.returns.id) {
    node.innerHTML = frCard(
      '<h2 data-testid="fr-which">' +
        esc(pack.returns.short || pack.returns.id) +
        '</h2><p>' +
        esc(txf('{name}: prepared in Accounts, not here.', { name: pack.returns.name || pack.returns.id })) +
        '</p>' +
        '<a class="act" href="/accounts.html#gstclose" data-testid="fr-accounts">' +
        esc(tx('Open Accounts')) +
        '</a>',
      'fr-elsewhere'
    );
    return;
  }
  node.innerHTML = frCard(
    '<h2>' +
      esc(tx('No return built yet')) +
      '</h2><p data-testid="fr-none-why">' +
      esc(txf('Nothing is built for {country} yet.', { country: (pack && pack.name) || FR.code })) +
      '</p>',
    'fr-none'
  );
}
/** one table row per tax head (CGST · SGST · IGST): on your sales · credit from purchases · to pay now · credit kept */
function frHeadRows(heads) {
  var cell = function (v) {
    return '<td style="text-align:end">' + esc(fmtMoney(v || 0)) + '</td>';
  };
  return heads
    .map(function (h) {
      return '<tr data-testid="fr-view-' + h.name.toLowerCase() + '"><th scope="row" style="text-align:start">' + esc(h.name) + '</th>' + cell(h.out) + cell(h.inp) + cell(h.pay) + cell(h.keep) + '</tr>';
    })
    .join('');
}
/**
 * IN-F-08 (walk IN 21 Nov): THIS MONTH'S GST BY HEAD, ON SCREEN, with the set-off preview — read only. Every figure is the server's (GET /api/tax/gstr?form=gstr3b: tax on sales, credit from purchases and
 * _cb.setoff, the engine's own CBPosting.gstSetOff in s.49 order); nothing is summed here. It posts nothing: the GST close stays closed until the month has ended.
 */
function frViewHTML(reply) {
  var outputTax = ((reply || {}).sup_details || {}).osup_det || {},
    credit = ((reply || {}).itc_elg || {}).itc_net || {},
    setOff = ((reply || {})._cb || {}).setoff;
  if (!setOff) return '<p class="hint" data-testid="fr-view-none">' + esc(tx('The set-off could not be worked out for this month.')) + '</p>';
  var heads = [
    { name: 'CGST', out: outputTax.camt, inp: credit.camt, pay: setOff.payable.cgst, keep: setOff.carried.cgst },
    { name: 'SGST', out: outputTax.samt, inp: credit.samt, pay: setOff.payable.sgst, keep: setOff.carried.sgst },
    { name: 'IGST', out: outputTax.iamt, inp: credit.iamt, pay: setOff.payable.igst, keep: setOff.carried.igst }
  ];
  var rows = frHeadRows(heads);
  var used = (setOff.utilised || [])
    .map(function (u) {
      return esc(txf('{from} credit {amount} set against {against}', { from: String(u.from).toUpperCase(), amount: fmtMoney(u.amount), against: String(u.against).toUpperCase() }));
    })
    .join(' · ');
  return (
    '<table class="tbl" data-testid="fr-view-table" style="width:100%;margin-top:10px"><thead><tr><th style="text-align:start">' + esc(tx('Tax')) + '</th><th style="text-align:end">' + esc(tx('On your sales')) +
    '</th><th style="text-align:end">' + esc(tx('Credit from purchases')) + '</th><th style="text-align:end">' + esc(tx('To pay now')) + '</th><th style="text-align:end">' + esc(tx('Credit kept')) + '</th></tr></thead><tbody>' +
    rows + '</tbody></table>' +
    (used ? '<p class="hint" data-testid="fr-view-setoff">' + used + '</p>' : '') +
    '<p class="hint" data-testid="fr-view-note">' + esc(tx('A preview from your bills of the month, IGST credit first, then CGST, then SGST. Nothing is posted; the GST close opens when the month has ended.')) + '</p>'
  );
}
/** the month chosen, on screen: the server's GSTR-3B read, painted by frViewHTML (a late answer for another month is dropped) */
async function frShow() {
  var select = document.getElementById('fr_month'),
    box = document.getElementById('fr_view');
  if (!select || !box) return;
  var month = select.value,
    seen = (FR.viewGen = (FR.viewGen || 0) + 1);
  box.innerHTML = '<div class="hint">' + esc(tx('Loading…')) + '</div>';
  try {
    var reply = await api('taxGstr', { query: { month: month, form: 'gstr3b' } });
    if (seen !== FR.viewGen) return;
    box.innerHTML = frViewHTML(reply);
  } catch (e) {
    if (seen !== FR.viewGen) return;
    box.innerHTML = '<p class="hint" data-testid="fr-view-failed">' + esc(tx('Could not read this month.')) + '</p>';
  }
}
/** BE-F-03: the plain reason a figure differs, from what the server's check names (place_of_supply · supply → place; cgst · sgst · igst · cess → split; every other figure → value) */
function frReasonOf(what) {
  var key = String(what || '');
  if (/^(place_of_supply|supply)$/.test(key)) return 'place';
  if (/^(cgst|sgst|igst|cess|csamt)$/.test(key)) return 'split';
  return 'value';
}
/** BE-F-03: the bills the server's check disagrees with, ONE line per reason (never one long line per bill): the reason, how many, which bills (the first four). A bill's own number is read off the server's sentence ("Bill C1/…:"). Items with no named differences pass through as the server's own words. */
function frTaxDiffers(items) {
  var order = ['place', 'split', 'value'],
    group = { place: [], split: [], value: [] },
    plain = [];
  (items || []).forEach(function (item) {
    var diffs = item && item.differences;
    if (!diffs || !diffs.length) {
      var t = typeof item === 'string' ? item : item && (item.words || item.says);
      if (t) plain.push(String(t));
      return;
    }
    var named = /^Bill (.+?):/.exec(String(item.words || '')),
      label = named ? named[1] : tx('a bill'),
      seen = {};
    diffs.forEach(function (d) {
      var reason = frReasonOf(d && d.what);
      if (!seen[reason]) {
        seen[reason] = true;
        group[reason].push(label);
      }
    });
  });
  var words = {
    place: 'State of supply (inside or outside your state) differs from the server check ({n}): {bills}.',
    split: 'The CGST, SGST and IGST split differs from the server check ({n}): {bills}.',
    value: 'The taxable value or total differs from the server check ({n}): {bills}.'
  };
  var lines = order
    .filter(function (reason) { return group[reason].length; })
    .map(function (reason) {
      var bills = group[reason];
      return txf(words[reason], { n: bills.length, bills: bills.slice(0, 4).join(', ') + (bills.length > 4 ? txf(' and {m} more', { m: bills.length - 4 }) : '') });
    });
  if (lines.length) lines.push(tx('The file carries the figures as issued. Look at these bills before you file.'));
  return plain.concat(lines);
}
/** BE-F-03: the period totals the file holds, read from the download's own _cb (summary for GSTR-1, net for GSTR-3B), never summed here → '' when the file carries none */
function frTotalsHtml(cb) {
  cb = cb || {};
  var text = '';
  if (cb.summary) text = txf('Invoices {i} · Credit notes {n} · Taxable value {taxable} · Tax {tax}', { i: cb.summary.invoices, n: cb.summary.notes, taxable: fmtMoney(cb.summary.taxable || 0), tax: fmtMoney(cb.summary.tax || 0) });
  else if (cb.net && cb.net.total != null) text = txf('Net tax in this file {tax}', { tax: fmtMoney(cb.net.total) });
  return text ? '<p data-testid="fr-totals" style="margin:6px 0 0">' + esc(text) + '</p>' : '';
}
/** what the return says beside its figures: the tax the server's check does not reproduce (one line per reason, frTaxDiffers), the e-invoice warning, and the bills reversed after filing (their credit-note rows, the server's own sentences) → [sentence] */
function frNotes(cb) {
  cb = cb || {};
  var said = [];
  function addNote(item) {
    var t = typeof item === 'string' ? item : item && (item.words || item.says);
    if (t) said.push(String(t));
  }
  frTaxDiffers(cb.tax_differs).forEach(function (line) { said.push(line); });
  if (cb.einvoice) addNote(cb.einvoice);
  (cb.reversed || []).forEach(addNote);
  return said;
}
function frNotesHtml(cb) {
  var said = frNotes(cb);
  if (!said.length) return '';
  return '<ul class="hint" data-testid="fr-notes" style="margin:6px 0 0;padding-left:18px">' + said.slice(0, 5).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + (said.length > 5 ? '<li>' + esc(txf('{n} more in the file', { n: said.length - 5 })) + '</li>' : '') + '</ul>';
}
/** one press, one file: the server's JSON saved as gstr1-YYYY-MM.json / gstr3b-YYYY-MM.json (helpers.js gstrDownload) */
function frGet(form, btn) {
  var node = document.getElementById('fr_month'),
    month = node ? node.value : null;
  if (!month) return;
  var cb = null;
  return CBAction.run(
    btn,
    function () {
      return gstrDownload(month, form, function (reply) { cb = reply && reply._cb; });
    },
    {
      key: 'fr-' + form,
      out: 'fr_out',
      failed: tx('Could not build the file'),
      done: tx('Downloaded'),
      outcome: function (name) {
        var element = document.getElementById('fr_out');
        if (element) element.innerHTML = esc(tx('Saved as') + ' ' + name) + frTotalsHtml(cb) + frNotesHtml(cb);
      }
    }
  );
}
function frMount(frame) {
  var node = document.getElementById('screen');
  if (!node) return;
  ftNav();
  frPaint();
  if (!frame) frLoad(FR.state === 'ready');
}
