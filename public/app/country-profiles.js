/* OWNS  the Country lab's "Countries" view: every registered country on the left, everything its engine says on the right —
         money · tax · tax ID (with a live check) · bills & documents · filing · government rules · language & time · payments · connectors · open items.
   READS the adopted engines only: CBRegulation (the packs), CBCountries (the registry: taxId · returnInfo · meta · contractGaps), Intl. It types no
         country's fact: a value the pack does not carry is painted as "not in the pack", never filled in.
   CALLED BY country-lab.html (#/countries, the default view).
   FLOW  mount → paint (the list · the picked country's nine cards) → a pick repaints · the tax-ID box runs the pack's own check
   CARD  15-tax-and-country-packs/country-lab · RUNBOOK-ADD-A-COUNTRY Q11 (Athi, 2026-10-16: "left side panel, country name and right side all the
         attributes, documents, filling, govt norms") */
(function (root) {
  'use strict';
  var RUNBOOK = 'C:/dev/docs/15-tax-and-country-packs/RUNBOOK-ADD-A-COUNTRY.md';
  var STATE = { host: null, code: null };

  /** text made safe for HTML — the shared helper when the page has it */
  function safe(value) { return typeof root.esc === 'function' ? root.esc(value) : String(value == null ? '' : value).replace(/[&<>"']/g, function (symbol) { return '&#' + symbol.charCodeAt(0) + ';'; }); }
  /** a failure this view survives, logged through the page's cbQuiet */
  function quiet(where, failure) { if (root.cbQuiet) root.cbQuiet('country-profiles:' + where, failure); }
  /** every registered pack, in the registry's order */
  function allPacks() { try { return root.CBRegulation ? CBRegulation.list() : []; } catch (failure) { quiet('list', failure); return []; } }
  /** the pack for a country code, or null */
  function packOf(code) { try { return root.CBRegulation ? CBRegulation.packFor(code) : null; } catch (failure) { quiet('pack', failure); return null; } }
  /** the flag from the two letters (regional-indicator symbols) */
  function flagOf(code) { return String(code).toUpperCase().replace(/[A-Z]/g, function (letter) { return String.fromCodePoint(127397 + letter.charCodeAt(0)); }); }
  /** a country, currency or language code in words (Intl) */
  function nameOf(kind, code) { try { return new Intl.DisplayNames(['en'], { type: kind }).of(code) || code; } catch (failure) { quiet('name', failure); return code; } }
  /** the pack's own number and date format (BCP-47) */
  function formatTag(pack) { return (pack.locale && pack.locale.format) || 'en'; }
  /** how many decimals the currency has (Intl decides; ¥ has none) */
  function decimalsOf(currency) { try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency }).resolvedOptions().maximumFractionDigits; } catch (failure) { quiet('decimals', failure); return 2; } }
  /** an amount in the country's own currency and format */
  function inCountryMoney(pack, amount) { try { return new Intl.NumberFormat(formatTag(pack), { style: 'currency', currency: pack.currency }).format(amount); } catch (failure) { quiet('money', failure); return pack.currency + ' ' + amount; } }
  /** an amount held in minor units, in the country's format; null when there is none */
  function minorMoney(pack, minor) { return minor == null ? null : inCountryMoney(pack, Number(minor) / Math.pow(10, decimalsOf(pack.currency))); }
  /** what a card says where the pack carries nothing */
  function notInPack() { return '<span class="chip warn">not in the pack</span>'; }
  /** one label · value line, the source behind ⓘ */
  function rowHTML(label, value, cite) {
    return '<div class="kv"><span>' + safe(label) + (cite ? ' <button class="btn x cp-i" type="button" title="' + safe(cite) + '" aria-label="' + safe(cite) + '">ⓘ</button>' : '') + '</span><span>' + (value == null || value === '' ? notInPack() : value) + '</span></div>';
  }
  /** a titled card */
  function cardHTML(title, body, testid) { return '<section class="card cp-card" data-testid="cp-' + testid + '"><div class="sec">' + safe(title) + '</div>' + body + '</section>'; }
  /** words as chips; null when there are none */
  function chips(items) { return items && items.length ? items.map(function (item) { return '<span class="chip">' + safe(item) + '</span>'; }).join(' ') : null; }

  /** ✓ when a local accountant has read the pack, ⚠ until then */
  function readMark(pack) { return pack.verified ? '<span class="chip ok" title="Read by a local accountant">✓</span>' : '<span class="chip warn" title="Not yet read by a local accountant">⚠</span>'; }
  /** one country's button in the left panel */
  function pickButton(pack) {
    var on = pack.id === STATE.code;
    return '<button type="button" class="cp-pick' + (on ? ' on' : '') + '" data-cc="' + safe(pack.id) + '" data-testid="cp-pick-' + safe(pack.id) + '" aria-pressed="' + on + '">'
      + '<span class="cp-flag" aria-hidden="true">' + flagOf(pack.id) + '</span><span class="cp-name">' + safe(nameOf('region', pack.id)) + '</span>'
      + '<span class="cp-cur">' + safe(pack.currency) + '</span>' + readMark(pack) + '</button>';
  }
  /** the left panel: one button per country (a picker on a phone) */
  function sideHTML(packs) {
    var buttons = packs.map(pickButton).join('');
    var picker = '<select class="cp-select" data-testid="cp-select" aria-label="Country">' + packs.map(function (pack) { return '<option value="' + safe(pack.id) + '"' + (pack.id === STATE.code ? ' selected' : '') + '>' + flagOf(pack.id) + ' ' + safe(nameOf('region', pack.id)) + '</option>'; }).join('') + '</select>';
    return '<div class="sec">Countries · ' + packs.length + '</div>' + picker + '<div class="cp-list">' + buttons + '</div>';
  }

  /** money: the currency, its decimals, how an amount looks, the invoice rounding */
  function moneyCard(pack) {
    var taxRules = pack.tax || {};
    return cardHTML('Money', rowHTML('Currency', safe(pack.currency) + ' · ' + safe(nameOf('currency', pack.currency)))
      + rowHTML('Decimals', String(decimalsOf(pack.currency)))
      + rowHTML('Looks like', '<b>' + safe(inCountryMoney(pack, 1234567.891)) + '</b>')
      + rowHTML('Invoice rounds to', taxRules.invoice_round_to != null ? safe(inCountryMoney(pack, taxRules.invoice_round_to)) : null), 'money');
  }
  /** does the pack credit input tax? asked of its own setOff with 100 out and 150 in */
  function creditOf(pack) {
    var head = (pack.taxHeads || [])[0]; if (!head || typeof pack.setOff !== 'function') return null;
    try {
      var output = {}, input = {}; output[head] = 100; input[head] = 150;
      var answer = pack.setOff({ output: output, input: input }, function (amount) { return Number(amount || 0); });
      return answer.utilised && answer.utilised.length ? 'Input tax is credited' : 'No input credit (single-stage)';
    } catch (failure) { quiet('setOff', failure); return null; }
  }
  /** the supply kinds as a small table: name · rate · input credit */
  function kindsTable(pack) {
    var kinds = (pack.tax && pack.tax.supplyKinds) || {}, names = Object.keys(kinds);
    if (!names.length) return '';
    return '<table class="grid cp-kinds"><thead><tr><th>Supply</th><th class="r">Rate</th><th>Input credit</th></tr></thead><tbody>' + names.map(function (name) {
      var kind = kinds[name]; return '<tr title="' + safe(kind.why || '') + '"><td>' + safe(kind.name || name) + '</td><td class="r">' + safe(kind.rate) + '%</td><td>' + (kind.credit ? '✓' : '—') + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  /** the standard rate, or how many state rates a country without one carries; null when neither */
  function standardRateText(taxRules) {
    if (taxRules.standard_rate != null) return safe(taxRules.standard_rate + '%');
    return taxRules.stateRates ? safe(Object.keys(taxRules.stateRates).length + ' state rates') : null;
  }
  /** one rate country-wide, or split by state; null when the pack does not say */
  function oneRateText(taxRules) { return { state: 'No — split by state', border: 'Yes' }[taxRules.supply] || null; }
  /** tax: name, rates, one rate or by state, input credit, the registration threshold, the supply kinds */
  function taxCard(pack) {
    var taxRules = pack.tax || {}, registration = taxRules.registration || {}, credit = creditOf(pack);
    var rates = (taxRules.rates || []).map(function (rate) { return rate + '%'; });
    return cardHTML('Tax', rowHTML('Name', safe(taxRules.scheme || (pack.words && pack.words.taxName))) + rowHTML('Rates', chips(rates))
      + rowHTML('Standard rate', standardRateText(taxRules)) + rowHTML('One rate country-wide', oneRateText(taxRules)) + rowHTML('Input tax', credit ? safe(credit) : null)
      + rowHTML('Must register above', registration.mandatory_minor != null ? safe(minorMoney(pack, registration.mandatory_minor)) : null, registration.cite)
      + kindsTable(pack), 'tax');
  }
  /** the tax ID: its word, an example, and a box that runs the pack's own check */
  function taxIdCard(pack) {
    var taxId = root.CBCountries ? CBCountries.taxId(pack) : { word: null };
    return cardHTML('Tax ID', rowHTML('Called', taxId.word ? '<b>' + safe(taxId.word) + '</b>' : null) + rowHTML('Looks like', taxId.hint ? '<span class="mono">' + safe(taxId.hint) + '</span>' : null)
      + '<div class="idck"><input class="cp-idbox" data-testid="cp-idbox" aria-label="Try a number" placeholder="' + safe(taxId.hint || '') + '"><span class="cp-idverdict" data-testid="cp-idverdict" role="status">'
      + (taxId.check ? '' : '<span class="chip warn">checked on save</span>') + '</span></div>', 'taxid');
  }
  /** the bill-number scheme the pack suggests (an option of docnumber), in words; null when it suggests none */
  function numberingText(numbering) {
    var scheme = numbering && numbering.default; if (!scheme) return null;
    return safe((scheme.dating || '') + (scheme.resets ? ' · resets ' + scheme.resets : ''));
  }
  /** the voucher series as "Sales SV" words */
  function seriesOf(pack) { var all = pack.voucherSeries || {}; return Object.keys(all).map(function (name) { return name + ' ' + all[name]; }); }
  /** bills & documents: what a tax invoice must show, the simplified limit, bill numbers, voucher series */
  function documentsCard(pack) {
    var extras = root.CBCountries ? CBCountries.meta(pack) : {}, invoice = extras.invoice || {}, invoiceRule = (pack.tax && pack.tax.taxInvoice) || {};
    var lines = (invoice.requiredLines || []).map(function (line) { return line.replace(/_/g, ' '); });
    return cardHTML('Bills & documents', rowHTML('A tax invoice must show', chips(lines), invoice.cite)
      + rowHTML('Simplified invoice up to', invoiceRule.simplified_upto_minor != null ? safe(minorMoney(pack, invoiceRule.simplified_upto_minor)) : null, invoiceRule.cite)
      + rowHTML('Bill numbers', numberingText(extras.numbering)) + rowHTML('Voucher series', chips(seriesOf(pack))), 'documents');
  }
  /** this year's return periods from the pack's own calendar (a stagger the authority assigns: the first is shown) */
  function periodsOf(pack) {
    var form = pack.returns; if (!form || typeof form.periods !== 'function') return null;
    var year = new Date().getFullYear(), stagger = form.staggers ? Object.keys(form.staggers)[0] : undefined;
    try { return form.periods({ year: year, fy: year, frequency: (form.frequencies || [])[0], stagger: stagger }) || []; } catch (failure) { quiet('periods', failure); return null; }
  }
  /** this year's periods and their due dates as a table ('' when the pack names none) */
  function periodsTable(pack) {
    var periods = periodsOf(pack); if (!periods || !periods.length) return '';
    var staggerNote = pack.returns.staggers ? ' (stagger ' + Object.keys(pack.returns.staggers)[0] + ' shown)' : '';
    return '<table class="grid cp-periods"><thead><tr><th>Period' + safe(staggerNote) + '</th><th>Due</th></tr></thead><tbody>'
      + periods.slice(0, 6).map(function (period) { return '<tr><td>' + safe(period.label || period.period) + '</td><td>' + safe(period.due || '') + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  /** filing: the return, who it is filed with, how often, and this year's periods with their due dates */
  function filingCard(pack) {
    var info = root.CBCountries ? CBCountries.returnInfo(pack) : null;
    if (!info) return cardHTML('Filing', rowHTML('Return', null), 'filing');
    return cardHTML('Filing', rowHTML('Return', '<b>' + safe(info.name) + '</b>') + rowHTML('Filed with', safe([info.authority, info.portal].filter(Boolean).join(' · ')))
      + rowHTML('How often', chips(info.frequencies)) + rowHTML('Built from the books', info.builds ? '✓' : null) + periodsTable(pack), 'filing');
  }
  /** government rules: the year, record keeping, the statement basis, whether a local accountant has read the pack, its sources */
  function rulesCard(pack) {
    var fiscal = pack.fiscalYear || {}, records = pack.records || {};
    return cardHTML('Government rules', rowHTML('Year starts', fiscal.startMonth ? safe(root.monthNames('long')[fiscal.startMonth - 1]) : null)
      + rowHTML('Keep records', pack.retentionYears ? safe(pack.retentionYears + ' years') : null, records.cite)
      + rowHTML('Statements follow', safe(pack.basis || '')) + rowHTML('Pack version', safe(pack.version))
      + rowHTML('Read by a local accountant', pack.verified ? '✓' : '<span class="chip warn">not yet</span>')
      + rowHTML('Sources', pack.tax && pack.tax.source ? '<span class="hint">' + safe(pack.tax.source) + '</span>' : null), 'rules');
  }
  /** language & time: the format, today in it, the languages, the time zones */
  function localeCard(pack) {
    var tag = formatTag(pack), langs = (pack.locale && pack.locale.langs) || [], today = '';
    try { today = new Date().toLocaleDateString(tag, { year: 'numeric', month: 'long', day: 'numeric' }) + ' · ' + new Date().toLocaleDateString(tag); } catch (failure) { quiet('today', failure); today = ''; }
    return cardHTML('Language & time', rowHTML('Format', safe(tag)) + rowHTML('Today', today ? safe(today) : null)
      + rowHTML('Languages', chips(langs.map(function (lang) { return nameOf('language', lang); }))) + rowHTML('Time zones', chips(pack.timeZones || [])), 'locale');
  }
  /** payments & connectors: the ways to pay, the accounting systems common there */
  function paymentsCard(pack) {
    var extras = root.CBCountries ? CBCountries.meta(pack) : {};
    var ways = extras.payments || (pack.chart && pack.chart.paymentModes ? Object.keys(pack.chart.paymentModes) : []);
    var systems = (extras.connectors || []).map(function (system) { return system.name + (system.fits === 'none' ? ' · not built' : ''); });
    return cardHTML('Payments & connectors', rowHTML('Ways to pay', chips(ways)) + rowHTML('Accounting systems', chips(systems)), 'payments');
  }
  /** a scope list ({ member: why }) as bullet lines */
  function scopeList(entries) { return Object.keys(entries || {}).map(function (member) { return '<li><b>' + safe(member) + '</b> — ' + safe(entries[member]) + '</li>'; }).join(''); }
  /** open items: what the registry cannot answer yet, what the pack leaves out or only partly does, and the runbook */
  function gapsCard(pack) {
    var gaps = root.CBCountries ? CBCountries.contractGaps(pack) : [], scope = pack.scope || {};
    var leftOut = scopeList(scope.out), partly = scopeList(scope.partial);
    return cardHTML('Open items', rowHTML('Not answered yet', gaps.length ? chips(gaps) : '<span class="chip ok">none</span>')
      + (leftOut ? '<div class="hint">Left out</div><ul class="cp-ul">' + leftOut + '</ul>' : '') + (partly ? '<div class="hint">Partly done</div><ul class="cp-ul">' + partly + '</ul>' : '')
      + '<div class="hint" data-testid="cp-runbook">How a country is added: ' + safe(RUNBOOK) + '</div>', 'gaps');
  }
  /** the right side: the country's head and its nine cards */
  function detailHTML(pack) {
    if (!pack) return '<div class="card nopack" data-testid="cp-none">No country pack is loaded.</div>';
    return '<div class="cp-head" data-testid="cp-head"><span class="cp-bigflag" aria-hidden="true">' + flagOf(pack.id) + '</span><div><h2>' + safe(nameOf('region', pack.id)) + '</h2><div class="hint">' + safe(pack.name) + ' · ' + safe(pack.id) + '</div></div></div>'
      + '<div class="cp-grid">' + [moneyCard(pack), taxCard(pack), taxIdCard(pack), documentsCard(pack), filingCard(pack), rulesCard(pack), localeCard(pack), paymentsCard(pack), gapsCard(pack)].join('') + '</div>';
  }

  /** draw the whole view */
  function paint() {
    var host = STATE.host; if (!host) return;
    var packs = allPacks(); if (!STATE.code && packs.length) STATE.code = packs[0].id;
    host.innerHTML = '<div class="cp"><aside class="cp-side" data-testid="cp-side">' + sideHTML(packs) + '</aside><div class="cp-main" data-testid="cp-main">' + detailHTML(packOf(STATE.code)) + '</div></div>';
  }
  /** a country was picked: draw it and keep it in the address */
  function choose(code) { STATE.code = code; paint(); try { history.replaceState(null, '', '#/countries/' + code); } catch (failure) { quiet('hash', failure); } }
  /** the tax-ID box changed: run the pack's own check and say the verdict */
  function checkId(box) {
    var verdict = STATE.host.querySelector('.cp-idverdict'), taxId = root.CBCountries ? CBCountries.taxId(STATE.code) : null;
    if (!verdict || !taxId || !taxId.check) return;
    var typed = box.value.trim(); if (!typed) { verdict.innerHTML = ''; return; }
    var answer = taxId.check(typed);
    verdict.innerHTML = answer.ok ? '<span class="chip ok">✓ ' + safe(answer.value || typed) + '</span>' : '<span class="chip bad">✕ ' + safe(answer.why || '') + '</span>';
  }
  /** mount the view in a host, optionally on one country */
  function mount(host, code) {
    STATE.host = host; STATE.code = code ? String(code).toUpperCase() : null; paint();
    host.addEventListener('click', function (event) { var button = event.target.closest('[data-cc]'); if (button) choose(button.getAttribute('data-cc')); });
    host.addEventListener('change', function (event) { if (event.target.matches('.cp-select')) choose(event.target.value); });
    host.addEventListener('input', function (event) { if (event.target.matches('.cp-idbox')) checkId(event.target); });
  }
  root.CBCountryProfiles = { mount: mount };
})(typeof window !== 'undefined' ? window : this);
