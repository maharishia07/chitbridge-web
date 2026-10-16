/* cap-country.js — COUNTRY SETUP (CS1, 2026-10-12): the step after registration, before the books open (lazy; ensureCap('country') → #/country).
 *
 * Athi, 2026-10-03 (DECISIONS "Country packs: the three switch decisions"): a shop with NO country is REFUSED, no silent India fallback;
 * a country with no pack is SAID; a country change is a NEW entity. Registration already reads the country from the time zone (M196,
 * engine/govcontext.js) and shows it with its source; this screen is where the OWNER confirms it — country · money · financial year · tax
 * registration — one row each, prefilled, each with where the answer came from, and one tap to change any of them.
 *
 * ── WHAT IS REUSED (CLAUDE.md rule 1) ────────────────────────────────────────────────────────────────────────────────────────────
 *   · the rows ARE the registration's gov panel (.govbox / .govrow / .gw .gv .gf, app.html) — the same look the person agreed to a minute ago
 *   · the prefill is CBGov.read() (M196) and the server's own answer (GET /api/governance/country-setup); this file computes nothing
 *   · the write goes through CBAction.run (M64, app/accounts-shell.js): one press, one write, the outcome said where it happened
 *   · the sentence for a country with no pack is the SERVER's (engines regulation.status) — painted, never composed here
 *   · the frame is the auth card (.auth .card .top .body) every sign-in screen uses — no new style
 * ── WHAT IS NEW, AND WHY ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   renderCountrySetup() — nothing existing painted a country step (the gov panel is read-only and lives inside Register).
 * Flow step: Onboarding · Register → Country setup → the app (docs/process/flows.json: Accounts · step "country").
 *
 * ── CS2 (2026-10-13) — THE CONSTITUTION, THE ZONE, THE COUNTRIES OFFERED ───────────────────────────────────────────────────────
 *   · the picker offers EXACTLY the server's `countries[]` (= the registered packs, CS1's rule) whatever the browser's locale; CBLocale.REGIONS
 *     is only the offline fallback. Choosing a country paints what ITS pack derives (currency · year · zones) from that same list — the server
 *     re-derives on save (country-setup.derive); this file computes nothing.
 *   · the time zone: a one-zone pack sets it (no Change); a multi-zone pack ASKS, the browser's zone preselected when it is one of the pack's.
 *   · `constituted` (the shop already holds a product or a transaction): Country and Money are greyed — no Change, the reason on the row —
 *     and the server refuses a change with its sentence (409 COUNTRY_CHANGE_IS_NEW_ENTITY), painted here. Before it, a correction is free and
 *     the save's `rederived` says what was set again.
 *   csuReadyHTML() (CL3) — "Where ChitBridge is for <country>" for the CHOSEN country, so a new shop sees what works for it. The rows are
 *     CBCountryReady's (app/country-ready.js — the same unit the Country lab paints), drawn in this step's own gov-panel rows; nothing typed.
 *
 * OWNS      the Country step's state (CSU), its prefill, its rows and its one write (countrySetupSave); the pack facts come from the server and the engines.
 * CALLED BY app.html (#/country, ensureCap('country')) and settings.html (CBCountry.mount into the Country pane).
 * FLOW      mount → csuRead() → csuPrefill() → renderCountrySetup() → csuSet() per change → csuSave() → csuDone()
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/cap-country
 */
'use strict';
var CSU = { p: null, loading: false, readErr: false, edit: null, src: {}, open: {}, err: '', later: false, host: null, onDone: null };
/* host · onDone (SET1, 2026-10-13): a small app (settings.html, CB Settings › Country) mounts the SAME rows in its own pane — CBCountry.mount(host, onDone).
   With no host the step paints app.html's auth card at #root, as CS1 built it. One renderer, two frames; never a second copy of the rows. */
/** CS2: the server's pack row for a country ({ code, name, currency, fy_start_month, zones, locale }) — null when the server sent no list or has no pack for it */
function csuPackOf(code) {
  code = String(code || '').toUpperCase();
  var list = CSU.p && Array.isArray(CSU.p.countries) ? CSU.p.countries : [];
  for (var i = 0; i < list.length; i++) if (list[i] && String(list[i].code).toUpperCase() === code) return list[i];
  return null;
}
/** the country's name a person reads — the server's pack list, the locale engine's served list, else the browser's own region names, else the code (never a guess) */
function csuCountryName(code, list) {
  if (!code) return '';
  /* STD2 (additive): `list` = another holder of the server's pack rows (the register panel's REG.spin.countries) — the one name reader, never a copy */
  var pk = null; if (Array.isArray(list)) { for (var i = 0; i < list.length; i++) if (list[i] && String(list[i].code).toUpperCase() === String(code).toUpperCase()) pk = list[i]; } else pk = csuPackOf(code);
  if (pk && pk.name) return pk.name;
  try { var R = window.CBLocale && CBLocale.REGIONS; if (R && R[code] && R[code].name) return R[code].name; } catch (_) {}
  try { var n = new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(code); if (n && n !== code && !/unknown/i.test(n)) return n; } catch (_) {}
  return code;
}
/**
 * the countries the picker offers — CS2: EXACTLY the server's registered packs, plus the one the shop holds now (a pack-less country stays
 * visible as what it is). Without the server's list (offline, an older api): the locale engine's list, the browser's and the server's.
 */
function csuCountries() {
  var out = [], seen = {};
  var add = function (c) { c = String(c || '').toUpperCase(); if (c && /^[A-Z]{2}$/.test(c) && !seen[c]) { seen[c] = 1; out.push(c); } };
  var served = CSU.p && Array.isArray(CSU.p.countries) && CSU.p.countries.length ? CSU.p.countries : null;
  if (served) served.forEach(function (c) { add(c && c.code); });
  else {
    try { Object.keys((window.CBLocale && CBLocale.REGIONS) || {}).forEach(add); } catch (_) {}
    try { var g = govCtx(); if (g && g.country) { add(g.country.value); add(g.country.unserved); } } catch (_) {}
  }
  if (CSU.p && CSU.p.country) add(CSU.p.country.code);
  if (CSU.edit) add(CSU.edit.country);
  return out;
}
/** the money a country keeps its prices in — the pack's first (the server's list), the locale engine's, plus whatever is set now */
function csuCurrencies(country) {
  var out = [], seen = {};
  var add = function (c) { c = String(c || '').toUpperCase(); if (c && /^[A-Z]{3}$/.test(c) && !seen[c]) { seen[c] = 1; out.push(c); } };
  var pk = csuPackOf(country); if (pk) add(pk.currency);
  try { var R = window.CBLocale && CBLocale.REGIONS; if (R && R[country]) (R[country].cur || []).forEach(add); } catch (_) {}
  if (CSU.edit) add(CSU.edit.currency);
  if (CSU.p) add(CSU.p.currency);
  return out;
}
/** the registered pack of a country (CBRegulation, engine/tax.js) — its scheme word, currency and year start; null when the page has no registry */
function csuPack(code) { try { return (window.CBRegulation && code && CBRegulation.packFor(String(code).toUpperCase())) || null; } catch (_) { return null; } }
/** the scheme's own word for the tax row: GST · GST · VAT (pack.tax.scheme); 'Tax' when no pack says */
function csuScheme(code) { var p = csuPack(code); return (p && p.tax && p.tax.scheme) || tx('Tax'); }
/** the tax-id the pack names (abn · trn · gstin), for the placeholder; India's GSTIN example until reg-in carries one */
function csuTaxIdHint(code) { var p = csuPack(code); if (code === 'IN') return '33AAAAA0000A1Z5'; if (p && p.abn) return 'ABN · 11 digits'; if (p && p.trn) return 'TRN · 15 digits'; return tx('Registration number'); }
/** CS2: the IANA zones a country's pack names — the server's list for the chosen country; for the shop's own country also the profile's `zones` */
function csuZones(country) {
  var pk = csuPackOf(country);
  if (pk && Array.isArray(pk.zones) && pk.zones.length) return pk.zones.slice();
  if (CSU.p && CSU.p.country && CSU.p.country.code === country && Array.isArray(CSU.p.zones)) return CSU.p.zones.slice();
  return [];
}
/** the zone this device sits in (M196's reading of the clock) — preselected when it is one of the pack's */
function csuDeviceZone() {
  try { var g = govCtx(); if (g && g.timezone && g.timezone.value) return g.timezone.value; } catch (_) {}
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; }
}
/**
 * CS2: the zone for a country, the way the server will set it (country-setup.derive): ONE zone → that one, from the pack; SEVERAL → the one
 * already held when it is one of them, else the device's when it is one of them, else nothing (the step asks); NONE named → what is held.
 */
function csuZoneFor(country, held) {
  var zones = csuZones(country), dev = csuDeviceZone();
  if (zones.length === 1) return { value: zones[0], from: txf('the {c} pack', { c: csuCountryName(country) }), ask: false };
  if (zones.length > 1) {
    if (held && zones.indexOf(held) >= 0) return { value: held, from: held === dev ? tx('your device clock') : tx('what you set'), ask: true };
    if (dev && zones.indexOf(dev) >= 0) return { value: dev, from: tx('your device clock'), ask: true };
    return { value: '', from: txf('{c} has several — pick one', { c: csuCountryName(country) }), ask: true };
  }
  return { value: held || '', from: held ? tx('your registration') : '', ask: false };
}
/** CS2: the words for what fixed the country — the server's `constituted_by`, in shopkeeper words */
function csuFixedBy() {
  var by = (CSU.p && CSU.p.constituted_by) || {}, w = [];
  if (by.products) w.push(tx('products')); if (by.chits) w.push(tx('chits')); if (by.entries) w.push(tx('books entries'));
  return w.join(', ') || tx('transactions');
}
function csuConstituted() { return !!(CSU.p && CSU.p.constituted); }
/** a source line that says "what you set" once the step is done, else the browser's own reason for the guess, else "not confirmed yet" */
function csuSourceOf(done, guess, value) {
  return done ? tx('what you set') : (guess && guess.value === value && guess.from) || tx('not confirmed yet');
}
/** the blank answer the prefill fills in (words and supplies are read beside the step, defaults when not read) */
function csuBlankSetup() {
  return { country: '', currency: '', fy: 0, registered: false, number: '', scheme: 'regular', timezone: '', words: (CSU.flags && CSU.flags.number_words) || 'pack', supplies: (CSU.me && CSU.me.supplies) || 'goods' };
}
/** what registration stored, into the setup (country · money · year · tax registration) */
function csuReadServerFacts(setup, served) {
  var taxFacts = served.tax || {};
  setup.country = (served.country && served.country.code) || ''; setup.currency = served.currency || ''; setup.fy = served.fy_start_month || 0;
  setup.registered = !!taxFacts.registered; setup.number = taxFacts.number || ''; setup.scheme = taxFacts.scheme || 'regular';
}
/** the sources the server did not word get ours: "what you set" once done, the browser's own reason before, "not confirmed yet" otherwise */
function csuFillSources(setup, served, browserGuess) {
  var sources = Object.assign({}, served.source || {});
  /* FX-AU1: registration now stores the guess WITH its source (the server's words, entity_governance.setup_source). A value with no source
     before the step is done is the database default ('IN'), never the owner's answer — so it is "not confirmed yet", never "your registration" */
  if (!sources.country && setup.country) sources.country = csuSourceOf(served.done, browserGuess && browserGuess.country, setup.country);
  if (!sources.currency && setup.currency) sources.currency = csuSourceOf(served.done, browserGuess && browserGuess.currency, setup.currency);
  if (!sources.fy_start_month && setup.fy) sources.fy_start_month = served.done ? tx('what you set') : (served.pack && served.pack.id ? txf('the {c} pack', { c: csuCountryName(served.pack.id) }) : tx('the usual year'));
  if (!sources.tax) sources.tax = setup.registered ? tx('your registration') : tx('not set yet');
  return sources;
}
/** the server's answer into the setup: what registration stored, each fact with its source */
function csuFromServer(setup, served, browserGuess) {
  csuReadServerFacts(setup, served);
  return csuFillSources(setup, served, browserGuess);
}
/** CX0 · GOV-SPIN: before the step is DONE the server's country is the database's default (identities.country 'IN', b299 §⚠️), not the owner's fact —
 *  the clock's country (M196) wins over it and the currency follows the clock, never the default's INR. ONLY when the server's country has no source:
 *  a country registration stored WITH its source (the installation's, accepted with reg-agree, or the guess FX-AU1 labelled) is a fact the owner saw,
 *  and the clock must not silently undo "This ChitBridge runs in Australia" */
function csuClockOverridesDefault(setup, sources, served, browserGuess, clockCountry) {
  var hasOwnersCountry = served && (served.done || (served.source && served.source.country));
  if (!served || hasOwnersCountry || !clockCountry || clockCountry === setup.country || !csuPack(clockCountry)) return;
  setup.country = clockCountry; sources.country = browserGuess.country.from; setup.currency = ''; setup.fy = 0;
}
/** the clock's country and currency (M196) fill what the server left empty, and win over the database's default country */
function csuFromClock(setup, sources, served, browserGuess) {
  var clockCountry = browserGuess && browserGuess.country && browserGuess.country.value;
  var clockCurrency = browserGuess && browserGuess.currency && browserGuess.currency.value;
  csuClockOverridesDefault(setup, sources, served, browserGuess, clockCountry);
  if (!setup.country && clockCountry) { setup.country = clockCountry; sources.country = browserGuess.country.from; }
  if (!setup.currency && clockCurrency) { setup.currency = clockCurrency; sources.currency = browserGuess.currency.from; }
}
/** W10: the browser's guess worded the money's reason ("the usual currency in India") on an Australian shop — the reason names the SHOP's country */
function csuCurrencyReason(setup, sources, served) {
  var isGuessWording = /the usual currency in /.test(String(sources.currency));
  if (setup.country && sources.currency && isGuessWording && !served) sources.currency = txf('the usual currency in {c}', { c: csuCountryName(setup.country) });
  if (setup.country && served && !served.done && (!sources.currency || isGuessWording)) sources.currency = txf('the usual currency in {c}', { c: csuCountryName(setup.country) });
}
/** the year: the server's pack row (CS2), else the regulation pack's (CX0: AU July · AE January), never India-or-January by guess */
function csuYearFromPack(setup, sources) {
  if (setup.fy) return;
  var packRow = csuPackOf(setup.country), regulationPack = csuPack(setup.country);
  setup.fy = (packRow && packRow.fy_start_month) || (regulationPack && regulationPack.fiscalYear && regulationPack.fiscalYear.startMonth) || (setup.country === 'IN' ? 4 : 1);
  sources.fy_start_month = (packRow || regulationPack || setup.country === 'IN') ? txf('the {c} pack', { c: csuCountryName(setup.country) }) : tx('the usual year');
}
/** the prefill: the server's answer first (it knows what registration stored), else what the browser worked out (M196) — each with its source */
function csuPrefill() {
  var served = CSU.p, browserGuess = null; try { browserGuess = govCtx(); } catch (error) { console.warn('country setup: the browser could not guess the country', (error && error.message) || error); }
  var setup = csuBlankSetup(), sources = served ? csuFromServer(setup, served, browserGuess) : {};
  csuFromClock(setup, sources, served, browserGuess);
  csuCurrencyReason(setup, sources, served);
  csuYearFromPack(setup, sources);
  if (!sources.tax) sources.tax = tx('not set yet');
  /* CS2: the zone — the pack's one, or the held / device one when the pack names several (the step asks), or what registration wrote */
  var zone = csuZoneFor(setup.country, (served && served.timezone) || csuDeviceZone());
  setup.timezone = zone.value; sources.timezone = sources.timezone || zone.from;
  if (zone.ask && !zone.value) CSU.open.timezone = true;   /* nothing to preselect: the picker is open from the start */
  CSU.edit = setup; CSU.src = sources;
}
/** the three reads the step paints from (the step, the policy flags, /me); a failed side read is logged and the step still opens on its defaults */
function csuRead() {
  if (CSU.loading) return;
  CSU.loading = true; CSU.readErr = false;
  /* W28 · W27(a): the words choice (policy_flags.number_words) and the supplies (identities.supplies) are read beside the step — their one writers stay PATCH /entities/policy and PATCH /entities/profile */
  Promise.all([
    api('countrySetup').then(function (served) { CSU.p = served || null; }, function () { CSU.p = null; CSU.readErr = true; }),
    api('policyGet').then(function (answer) { CSU.flags = (answer && answer.flags) || {}; }, function (e) { CSU.flags = {}; if (typeof cblog === 'function') cblog('error', 'country setup: policy read: ' + ((e && e.message) || e)); }),
    api('me').then(function (answer) { CSU.me = (answer && (answer.entity || answer)) || {}; }, function (e) { CSU.me = {}; if (typeof cblog === 'function') cblog('error', 'country setup: /me read: ' + ((e && e.message) || e)); }),
  ]).then(function () { CSU.loading = false; csuPrefill(); renderCountrySetup(); });
}
/* ── ⭐ SET-WALK1 · W28(b) — MONEY CONFIRMS MORE THAN THE CODE: the symbol · the number format · the words for big numbers · the decimals · the date,
 * each a LIVE EXAMPLE from the SAME engine the bills use (CBLocale.money/symbol/date — the currency's own grouping, MONEY_LOCALE; CBMoney.decimals).
 * This file computes nothing: it paints what the engine paints. The grouping is the currency's (not a choice: ₹1,23,45,67,890 is how rupees are
 * written, A$1,234,567,890 how dollars are; INT7c W29: a long sample, so the grouping shows from the 3rd comma on); the WORDS are the shop's (policy_flags.number_words — an Indian shop may say lakh/crore or million). */
var CSU_SAMPLE = 1234567890.89, CSU_WORDS = [['pack', 'as the money is written'], ['lakh', 'lakh · crore'], ['million', 'million']];
/** the Intl tag the money engine writes this currency under (en-US when the engine cannot say) */
function csuMoneyTag(currency) {
  try { return (window.CBLocale && CBLocale.moneyTag && CBLocale.moneyTag(currency)) || 'en-US'; }
  catch (error) { console.warn('country setup: no number-format tag for ' + currency, (error && error.message) || error); return 'en-US'; }
}
/** the words for a big number under a tag — Intl's compact notation (en-IN: "12 lakh" · en-US: "1.2 million"); the engine's own tag table decides which */
function csuBigWords(amount, words, currency) {
  var tag = words === 'lakh' ? 'en-IN' : words === 'million' ? 'en-US' : csuMoneyTag(currency);
  try { return new Intl.NumberFormat(tag, { notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 1 }).format(amount); }
  catch (error) { console.warn('country setup: no compact words for ' + tag, (error && error.message) || error); return String(amount); }
}
/** the sample amount and today as the BILL writes them, and the symbol cut out of the money (A$ · ₹ · AED) — not the reader's own */
function csuLocaleExamples(currency) {
  var locale = window.CBLocale, example = { symbol: '', number: '', date: '' };
  try {
    example.number = locale.money(CSU_SAMPLE, currency); example.date = locale.date(Date.now());
    example.symbol = String(example.number).replace(/[\d.,\s\u00a0]/g, '') || locale.symbol(currency);
  } catch (e) { if (typeof cblog === 'function') cblog('error', 'country setup: locale example: ' + ((e && e.message) || e)); }
  return example;
}
/** the currency's decimals from the money unit (2 when the unit cannot say) */
function csuDecimalsOf(currency) {
  var moneyUnit = window.CBMoney;
  try { return moneyUnit && moneyUnit.decimals ? moneyUnit.decimals(currency) : 2; }
  catch (error) { console.warn('country setup: no decimals for ' + currency, (error && error.message) || error); return 2; }
}
/** the live examples of the Money row: symbol · number · decimals · date · big-number words, all from the engines the bills use */
function csuMoneyExamples(currency, words) {
  var example = csuLocaleExamples(currency);
  return { symbol: example.symbol || currency, number: example.number, decimals: csuDecimalsOf(currency), date: example.date, words: csuBigWords(CSU_SAMPLE, words, currency), lakhPack: csuMoneyTag(currency) === 'en-IN' };
}
/** one example row of the Money block: what it is · the example · "live example" */
function csuExampleLine(what, valueHtml, testId) {
  return '<div class="govrow" data-testid="cs-money-' + testId + '"><span class="gw">' + esc(what) + '</span><span class="gv" style="font-weight:600">' + valueHtml + '</span><span class="gf">' + esc(tx('live example')) + '</span></div>';
}
/** the Money row's confirm block: symbol · number format · words · decimals · date, each a live example; the words a choice only where the money's own convention is lakh */
function csuMoneyConfirmHTML(e) {
  var example = csuMoneyExamples(e.currency, e.words);
  var wordsSelect = example.lakhPack
    ? csuSel('cs-words', 'words', CSU_WORDS.map(function (choice) { return { v: choice[0], t: tx(choice[1]) + ' — ' + csuBigWords(CSU_SAMPLE, choice[0], e.currency) }; }), e.words)
    : '<span data-testid="cs-words-fixed">' + esc(example.words) + '</span>';
  return '<div class="govbox" data-testid="cs-money-confirm" style="margin-top:4px">'
    + csuExampleLine(tx('Symbol'), '<span translate="no">' + esc(example.symbol) + '</span>', 'symbol')
    + csuExampleLine(tx('Number format'), '<span translate="no">' + esc(example.number) + '</span>', 'number')
    + csuExampleLine(tx('Decimals'), esc(String(example.decimals)), 'decimals')
    + csuExampleLine(tx('Big numbers'), wordsSelect, 'words')
    + csuExampleLine(tx('Date'), '<span translate="no">' + esc(example.date) + '</span>', 'date')
    + '</div>';
}
/** W27(a): goods · services · both — the GST/WTO vocabulary; "both" is the common case (a garage sells a part and fits it) */
function csuSuppliesRow(e) {
  var choices = SHOP_SUPPLIES.map(function (supply) { return { v: supply[0], t: tx(supply[1]) }; }), chosen = choices.filter(function (choice) { return choice.v === e.supplies; })[0];
  return csuRow('supplies', tx('Supplies'), esc(chosen ? chosen.t : tx('not said yet')), CSU.me && CSU.me.supplies ? tx('your shop') : tx('not set yet'), csuSel('cs-supplies', 'supplies', choices, e.supplies));
}
/** the field → where its "you chose" source is kept (the three tax fields share one source line) */
var CSU_SOURCE_KEY = { country: 'country', currency: 'currency', fy: 'fy_start_month', registered: 'tax', number: 'tax', scheme: 'tax', timezone: 'timezone', words: 'words', supplies: 'supplies' };
/** the field → how a typed value is cleaned into the setup */
var CSU_FIELD_SETTERS = {
  currency: function (setup, value) { setup.currency = String(value || '').toUpperCase().slice(0, 3); },
  fy: function (setup, value) { setup.fy = Number(value) || 0; },
  registered: function (setup, value) { setup.registered = (value === true || value === 'yes'); },
  number: function (setup, value) { setup.number = String(value || ''); },
  scheme: function (setup, value) { setup.scheme = String(value || 'regular'); },
  timezone: function (setup, value) { setup.timezone = String(value || ''); },
  words: function (setup, value) { setup.words = String(value || 'pack'); },
  supplies: function (setup, value) { setup.supplies = String(value || 'goods'); },
};
/** CS2: the whole shop follows the country — what its pack derives (money · year · scheme · zone) is painted now, the way the server sets it on save (derive) */
function csuSetCountry(code) {
  var setup = CSU.edit, packRow = csuPackOf(code), packName = txf('the {c} pack', { c: csuCountryName(code) });
  setup.country = code;
  var currencies = csuCurrencies(code);
  var currencyStale = (currencies.length && currencies.indexOf(setup.currency) < 0) || (packRow && packRow.currency && packRow.currency !== setup.currency);
  if (currencyStale) { setup.currency = packRow && packRow.currency ? packRow.currency : currencies[0]; CSU.src.currency = packRow ? packName : txf('the usual currency in {c}', { c: csuCountryName(code) }); }
  if (packRow && packRow.fy_start_month) { setup.fy = packRow.fy_start_month; CSU.src.fy_start_month = packName; }
  if (code !== 'IN' && setup.scheme === 'composition') setup.scheme = 'regular';
  var zone = csuZoneFor(code, setup.timezone); setup.timezone = zone.value; CSU.src.timezone = zone.from; CSU.open.timezone = zone.ask && !zone.value;
}
/** a field changed: clean it into the setup, say it came from the person ("you chose", never "typed"), mark the form moved and repaint */
function csuSet(field, value) {
  if (!CSU.edit) return;
  if (field === 'country') csuSetCountry(String(value || '').toUpperCase());
  else if (CSU_FIELD_SETTERS[field]) CSU_FIELD_SETTERS[field](CSU.edit, value);
  /* W12: where the value came from, in words a person reads — "you chose", never "typed" */
  CSU.src[CSU_SOURCE_KEY[field]] = tx('you chose');
  CSU.touched = true;   /* W24: something moved since the read */
  CSU.err = '';
  renderCountrySetup();
}
/* CL3 → W28(c): the "Where ChitBridge is for <country>" rows left this step — they are Standards › Country readiness (standards.html ?ready=<cc>, the same CBCountryReady unit); the link above opens it */
function csuOpen(k) { CSU.open[k] = !CSU.open[k]; renderCountrySetup(); }
/**
 * one row: what · value · where it came from · Change (the registration's gov panel, with the one tap it lacked).
 * CS2: `locked` — no Change at all (the value is fixed, or the pack sets it); the reason is the row's source line.
 */
function csuRow(key, what, valueHtml, from, editHtml, locked) {
  return '<div class="govrow" data-testid="cs-row-' + key + '"' + (locked ? ' data-locked="1"' : '') + '>'
    + '<span class="gw">' + esc(what) + '</span>'
    + '<span class="gv" data-testid="cs-val-' + key + '">' + valueHtml + (locked ? '' : ' <a data-testid="cs-change-' + key + '" onclick="csuOpen(\'' + key + '\')" style="font-weight:600;color:var(--blue);cursor:pointer;margin-inline-start:6px">' + esc(CSU.open[key] ? tx('Done') : tx('Change')) + '</a>') + '</span>'
    + '<span class="gf" data-testid="cs-src-' + key + '">' + esc(from || '') + '</span>'
    + (CSU.open[key] && !locked ? '<span style="grid-column:1 / -1;padding-top:4px">' + editHtml + '</span>' : '')
    + '</div>';
}
/** a <select> of choices ({v, t}) that sets `field` on change, `current` selected */
function csuSel(id, field, choices, current) {
  return '<select class="inp" id="' + id + '" data-testid="' + id + '" onchange="csuSet(\'' + field + '\', this.value)">'
    + choices.map(function (choice) { return '<option value="' + esc(choice.v) + '"' + (String(choice.v) === String(current) ? ' selected' : '') + '>' + esc(choice.t) + '</option>'; }).join('') + '</select>';
}
/** the Money row: the code (a pick from the pack's currencies, else a 3-letter box) with the live examples of the money under it */
function csuMoneyRow(e, reason, locked) {
  var currencies = csuCurrencies(e.country).map(function (code) { return { v: code, t: code }; });
  var editHtml = currencies.length ? csuSel('cs-currency', 'currency', currencies, e.currency)
    : '<input class="inp" id="cs-currency" data-testid="cs-currency" maxlength="3" placeholder="' + esc((csuPackOf(e.country) || csuPack(e.country) || {}).currency || '') + '" value="' + esc(e.currency) + '" onchange="csuSet(\'currency\', this.value)">';
  return csuRow('currency', tx('Money'), esc(e.currency || tx('not known')), reason, editHtml, locked) + (e.currency ? csuMoneyConfirmHTML(e) : '');
}
/** the Time zone row: the pack's one (no Change) or a pick of the pack's several; absent when the country has no zones and none is held */
function csuZoneRow(e, sources) {
  var zones = csuZones(e.country);
  if (!zones.length && !e.timezone) return '';
  var held = e.timezone && zones.indexOf(e.timezone) >= 0;
  var zoneChoices = (held ? [] : [{ v: '', t: tx('Pick the time zone') }]).concat(zones.map(function (zone) { return { v: zone, t: zone.replace(/_/g, ' ') }; }));
  /* the IANA id is an identifier, never translated (LOCALE-STANDARD) */
  var shown = e.timezone ? '<span translate="no">' + esc(e.timezone.replace(/_/g, ' ')) + '</span>' : esc(tx('not picked yet'));
  return csuRow('timezone', tx('Time zone'), shown, sources.timezone, csuSel('cs-timezone', 'timezone', zoneChoices, e.timezone), zones.length <= 1);
}
/** the tax registration's one-line value: "Regular · 33AAB…" · "Registered · …" · "Not registered" */
function csuTaxValue(e) {
  if (!e.registered) return tx('Not registered');
  var kind = e.country === 'IN' ? (e.scheme === 'composition' ? tx('Composition') : tx('Regular')) : tx('Registered');
  return kind + ' · ' + (e.number || '');
}
/** the Tax row: registered or not, the number, and (India) the scheme */
function csuTaxRow(e, sources) {
  var registeredChoices = [{ v: 'no', t: tx('Not registered') }, { v: 'yes', t: txf('Registered for {s}', { s: csuScheme(e.country) }) }];
  var numberBox = e.registered ? '<input class="inp" id="cs-tax-number" data-testid="cs-tax-number" placeholder="' + esc(csuTaxIdHint(e.country)) + '" value="' + esc(e.number) + '" onchange="csuSet(\'number\', this.value)">' : '';
  var schemeBox = e.registered && e.country === 'IN' ? csuSel('cs-tax-scheme', 'scheme', [{ v: 'regular', t: tx('Regular') }, { v: 'composition', t: tx('Composition') }], e.scheme) : '';
  return csuRow('tax', csuScheme(e.country), esc(csuTaxValue(e)), sources.tax,
    '<div style="display:grid;gap:6px">' + csuSel('cs-tax-reg', 'registered', registeredChoices, e.registered ? 'yes' : 'no') + numberBox + schemeBox + '</div>');
}
/** the rows of the step: Country · Money (+ examples) · Year starts · Time zone · Tax · Supplies */
function csuRowsHtml(e, sources) {
  /* CS2: once the shop holds a product or a transaction, Country and Money are fixed — greyed, with the reason, never a Change */
  var fixed = csuConstituted();
  var fixedWhy = fixed ? txf('fixed — the shop already has {w}', { w: csuFixedBy() }) : null;
  var countryChoices = csuCountries().map(function (code) { return { v: code, t: csuCountryName(code) + ' · ' + code }; });
  var months = monthNames('long');
  return csuRow('country', tx('Country'), esc(csuCountryName(e.country) || tx('not known')), fixedWhy || sources.country, csuSel('cs-country', 'country', countryChoices, e.country), fixed)
    + csuMoneyRow(e, fixedWhy || sources.currency, fixed)
    + csuRow('fy', tx('Year starts'), esc(months[(e.fy || 1) - 1] || ''), sources.fy_start_month, csuSel('cs-fy', 'fy', months.map(function (month, i) { return { v: i + 1, t: month }; }), e.fy))
    + csuZoneRow(e, sources)
    + csuTaxRow(e, sources)
    /* W27(a): the supplies live beside the registration — a tax attribute, not a bill line */
    + csuSuppliesRow(e);
}
/** the links under the step: the Country Standard (CPS1) and, for a chosen country, "Where ChitBridge is for <country>" (W28c, Standards › Country readiness) */
function csuLinksHtml(e) {
  /* CPS1: the Country Standard — what a country pack carries and what each pack still lacks (standards.html opens on that row's search) */
  return '<div class="hint"><a href="/standards.html?std=country" data-testid="cs-standard" style="font-weight:600;color:var(--blue);cursor:pointer">' + esc(tx('What a country pack must carry — the Country Standard')) + ' ›</a>'
    /* W28(c): "Where ChitBridge is for <country>" is NOT a setup row — it lives under Standards › Country readiness (the same CBCountryReady unit); one link from here */
    + (e.country ? ' · <a href="/standards.html?std=country&ready=' + esc(e.country) + '" data-testid="cs-ready-link" style="font-weight:600;color:var(--blue);cursor:pointer">' + esc(txf('Where ChitBridge is for {c}', { c: csuCountryName(e.country) })) + ' ›</a>' : '') + '</div>';
}
/** the step's body once read: the rows, the pack's "no books" reason, the read/save errors, Continue (or Open the app after a 503) and the rule */
function csuBodyHtml(e, served, sources) {
  var noPack = served && served.pack && served.pack.books === false && served.pack.why;
  var fixed = csuConstituted();
  var goButton = CSU.later
    ? '<button class="btn" id="cs-open" data-testid="cs-open" onclick="csuDone()">' + esc(tx(CSU.host ? 'Done' : 'Open the app')) + ' <span class=arw>→</span></button>'
    : '<button class="btn" id="cs-save" data-testid="cs-save">' + esc(tx('Continue')) + ' <span class=arw>→</span></button>';
  return '<div class="body">'
    + '<div style="color:var(--grey);font-size:var(--fs-2);margin-bottom:6px">' + esc(tx('We filled these in. Change any, then continue.')) + '</div>'
    + '<div class="govbox" data-testid="cs-rows">' + csuRowsHtml(e, sources) + '</div>'
    + (noPack ? '<div class="hint" data-testid="cs-nopack" style="color:var(--warn-2)">' + esc(served.pack.why) + '</div>' : '')
    + (CSU.readErr ? '<div class="hint" data-testid="cs-readerr">' + esc(tx('Could not read what registration stored — these are from this device.')) + '</div>' : '')
    + (CSU.err ? '<div class="err" data-testid="cs-err">' + esc(CSU.err) + '</div>' : '')
    + goButton
    + '<div class="hint" data-testid="cs-rule">' + esc(fixed
        ? tx('Country and money never change once a shop has products or transactions. Register a new business for another country.')
        : tx('Country and money can still be corrected now. Once the shop has a product or a transaction they are fixed for good.')) + '</div>'
    + csuLinksHtml(e)
    + '</div>';
}
/** paint the step: in the host page's pane (settings), else as the auth card at #root; the Continue button is wired to csuSave */
function renderCountrySetup() {
  if (!SESSION.token && !CSU.host) return go('#/login');   /* a host page holds its own sign-in window (CBFrame) */
  if (!CSU.p && !CSU.loading && !CSU.readErr) { csuRead(); }
  if (!CSU.edit) csuPrefill();
  var body = CSU.loading && !CSU.p
    ? '<div class="body" data-testid="cs-loading" style="color:var(--grey)">' + esc(tx('Reading…')) + '</div>'
    : csuBodyHtml(CSU.edit, CSU.p, CSU.src);
  if (CSU.host) CSU.host.innerHTML = '<div class="cs"><h2 class="shop-h" data-testid="cs-title">' + esc(tx('Country setup')) + '</h2>' + body + '</div>';
  else document.getElementById('root').innerHTML = modeRibbon() + '<div class="auth"><div class="card" style="margin-bottom:var(--scroll-tail,120px)">'
    + '<div class="top">' + logo() + '<h1 data-testid="cs-title">' + esc(tx('Country setup')) + '</h1></div>' + body + '</div></div>';
  var saveButton = document.getElementById('cs-save'); if (saveButton) saveButton.onclick = csuSave;
}
/** the body of the one write: the setup as the server's country-setup route takes it (a one-zone pack: the server sets the zone anyway — CS2) */
function csuSaveBody(e) {
  return { country: e.country, currency: e.currency, fy_start_month: e.fy, tax: { registered: !!e.registered, number: e.registered ? e.number : null, scheme: e.registered ? e.scheme : null },
    timezone: e.timezone || null, source: CSU.src };
}
/** the one write — M64: one press, one call; a server refusal is said in the form, in its own words */
function csuSave() {
  var saveButton = document.getElementById('cs-save'), e = CSU.edit; if (!e) return;
  CSU.err = '';
  var body = csuSaveBody(e);
  CBAction.run(saveButton, function () { return api('countrySetupSave', { body: body }).then(function (saved) { return csuSaveBeside(e).then(function () { return saved; }); }); }, {
    key: 'cs-save', busy: tx('Saving…'),
    outcome: function (saved) {
      CSU.touched = false;
      CSU.p = saved || CSU.p; try { if (saved && saved.pack) SESSION.booksOn = false; } catch (error) { console.warn('country setup: the books switch was not reset', (error && error.message) || error); }
      /* CS2: a correction before the shop was constituted — the server says what it set again from the new pack */
      toast(saved && saved.rederived ? txf('Country corrected to {c} — money, year, tax, time zone and chart set again from its pack.', { c: csuCountryName(saved.rederived.to) }) : tx('Country set.'));
      csuDone();
    },
    onFail: function (words, err) {
      var st = err && err.status;
      /* before the database update that holds this step: say so, and let the shop in — selling and the rail work meanwhile */
      if (st === 503) { CSU.later = true; CSU.err = (err.data && err.data.message) || words; }
      else CSU.err = words;
      renderCountrySetup();
    },
  });
}
/** W28 · W27(a): the two facts beside the step, each through its ONE writer, only when it moved — the words (policy_flags.number_words) and the supplies (identities.supplies) */
function csuSaveBeside(e) {
  var jobs = [];
  if (e.words !== ((CSU.flags && CSU.flags.number_words) || 'pack')) jobs.push(api('policySet', { body: { number_words: e.words } }).then(function (answer) { CSU.flags = (answer && answer.flags) || CSU.flags; }));
  if (e.supplies !== ((CSU.me && CSU.me.supplies) || 'goods')) jobs.push(api('saveProfile', { body: { supplies: e.supplies } }).then(function () { CSU.me = Object.assign({}, CSU.me, { supplies: e.supplies }); }));
  return Promise.all(jobs);
}
/** where the step goes when it is done: the HOST says (app.html's route sets the workshop's own; settings.html its Your shop) — this file names no door */
function csuDone(){ if (CSU.onDone) CSU.onDone(); }
/** CB Settings › Country (settings.html): the same rows, painted in the page's pane. Re-mounting re-reads nothing the server already answered. */
var CBCountry = { mount: function (host, onDone) {
  CSU.host = host; CSU.onDone = onDone || null; CSU.touched = false;
  if (window.CBUnsaved) CBUnsaved.form({ dirty: function () { return !!CSU.touched; }, save: function () { return new Promise(function (resolve, reject) { if (!document.getElementById('cs-save')) return resolve(); csuSaveThen(resolve, reject); }); } });   /* W24 */
  renderCountrySetup();
} };
/** W24: the same save as the button, awaited by CBUnsaved (resolve on the outcome, reject on a refusal) */
function csuSaveThen(resolve, reject) {
  var e = CSU.edit; if (!e) return resolve();
  api('countrySetupSave', { body: csuSaveBody(e) }).then(function (saved) { CSU.p = saved || CSU.p; return csuSaveBeside(e); }).then(function () { CSU.touched = false; resolve(); }, reject);
}
