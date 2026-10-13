/* cap-country.js — COUNTRY SETUP (CS1, 2026-10-12): the step after registration, before the books open (lazy; ensureCap('country') → #/country).
 *
 * Athi, 2026-10-03 (DECISIONS "Country packs: the three switch decisions"): a shop with NO country is REFUSED, no silent India fallback;
 * a country with no pack is SAID; a country change is a NEW entity. Registration already reads the country from the time zone (M196,
 * app/govcontext.js) and shows it with its source; this screen is where the OWNER confirms it — country · money · financial year · tax
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
 */
'use strict';
var CSU = { p: null, loading: false, readErr: false, edit: null, src: {}, open: {}, err: '', later: false, host: null, onDone: null };
/* host · onDone (SET1, 2026-10-13): a small app (settings.html, CB Settings › Country) mounts the SAME rows in its own pane — CBCountry.mount(host, onDone).
   With no host the step paints app.html's auth card at #root, as CS1 built it. One renderer, two frames; never a second copy of the rows. */
var CSU_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** CS2: the server's pack row for a country ({ code, name, currency, fy_start_month, zones, locale }) — null when the server sent no list or has no pack for it */
function csuPackOf(code) {
  code = String(code || '').toUpperCase();
  var list = CSU.p && Array.isArray(CSU.p.countries) ? CSU.p.countries : [];
  for (var i = 0; i < list.length; i++) if (list[i] && String(list[i].code).toUpperCase() === code) return list[i];
  return null;
}
/** the country's name a person reads — the server's pack list, the locale engine's served list, else the browser's own region names, else the code (never a guess) */
function csuCountryName(code) {
  if (!code) return '';
  var pk = csuPackOf(code); if (pk && pk.name) return pk.name;
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
/** the registered pack of a country (CBRegulation, app/tax.js) — its scheme word, currency and year start; null when the page has no registry */
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
/** the prefill: the server's answer first (it knows what registration stored), else what the browser worked out (M196) — each with its source */
function csuPrefill() {
  var p = CSU.p, g = null; try { g = govCtx(); } catch (_) {}
  var e = { country: '', currency: '', fy: 0, registered: false, number: '', scheme: 'regular', timezone: '' }, src = {};
  if (p) {
    e.country = (p.country && p.country.code) || ''; e.currency = p.currency || ''; e.fy = p.fy_start_month || 0;
    e.registered = !!(p.tax && p.tax.registered); e.number = (p.tax && p.tax.number) || ''; e.scheme = (p.tax && p.tax.scheme) || 'regular';
    src = Object.assign({}, p.source || {});
    if (!src.country && e.country) src.country = p.done ? tx('what you set') : (g && g.country && g.country.value === e.country && g.country.from) || tx('your registration');
    if (!src.currency && e.currency) src.currency = p.done ? tx('what you set') : (g && g.currency && g.currency.value === e.currency && g.currency.from) || tx('your registration');
    if (!src.fy_start_month && e.fy) src.fy_start_month = p.done ? tx('what you set') : (p.pack && p.pack.id ? txf('the {c} pack', { c: csuCountryName(p.pack.id) }) : tx('the usual year'));
    if (!src.tax) src.tax = e.registered ? tx('your registration') : tx('not set yet');
  }
  /* CX0: before the step is DONE, the server's country is the database's default (identities.country 'IN', b299 §⚠️), not the owner's fact —
     the clock's served country (M196) wins over it, and the currency follows the clock too, never the default's INR */
  if (p && !p.done && g && g.country && g.country.value && g.country.value !== e.country && csuPack(g.country.value)) {
    e.country = g.country.value; src.country = g.country.from; e.currency = ''; e.fy = 0; }
  if (!e.country && g && g.country && g.country.value) { e.country = g.country.value; src.country = g.country.from; }
  if (!e.currency && g && g.currency && g.currency.value) { e.currency = g.currency.value; src.currency = g.currency.from; }
  var pk = csuPackOf(e.country), rp = csuPack(e.country);
  /* the year: the server's pack row (CS2), else the regulation pack's (CX0: AU July · AE January), never India-or-January by guess */
  if (!e.fy) { e.fy = (pk && pk.fy_start_month) || (rp && rp.fiscalYear && rp.fiscalYear.startMonth) || (e.country === 'IN' ? 4 : 1);
    src.fy_start_month = (pk || rp || e.country === 'IN') ? txf('the {c} pack', { c: csuCountryName(e.country) }) : tx('the usual year'); }
  if (!src.tax) src.tax = tx('not set yet');
  /* CS2: the zone — the pack's one, or the held / device one when the pack names several (the step asks), or what registration wrote */
  var z = csuZoneFor(e.country, (p && p.timezone) || csuDeviceZone());
  e.timezone = z.value; src.timezone = src.timezone || z.from;
  if (z.ask && !z.value) CSU.open.timezone = true;   /* nothing to preselect: the picker is open from the start */
  CSU.edit = e; CSU.src = src;
}
function csuRead() {
  if (CSU.loading) return;
  CSU.loading = true; CSU.readErr = false;
  api('countrySetup').then(function (p) { CSU.p = p || null; }, function () { CSU.p = null; CSU.readErr = true; })
    .then(function () { CSU.loading = false; csuPrefill(); renderCountrySetup(); });
}
function csuSet(k, v) {
  if (!CSU.edit) return;
  var map = { country: 'country', currency: 'currency', fy: 'fy_start_month', registered: 'tax', number: 'tax', scheme: 'tax', timezone: 'timezone' };
  if (k === 'country') {
    var c = String(v || '').toUpperCase(); CSU.edit.country = c;
    /* CS2: the whole shop follows the country — what its pack derives is painted now, the way the server sets it on save (derive) */
    var pk = csuPackOf(c), packName = txf('the {c} pack', { c: csuCountryName(c) });
    var curs = csuCurrencies(c); if (curs.length && curs.indexOf(CSU.edit.currency) < 0 || (pk && pk.currency && pk.currency !== CSU.edit.currency)) { CSU.edit.currency = pk && pk.currency ? pk.currency : curs[0]; CSU.src.currency = pk ? packName : txf('the usual currency in {c}', { c: csuCountryName(c) }); }
    if (pk && pk.fy_start_month) { CSU.edit.fy = pk.fy_start_month; CSU.src.fy_start_month = packName; }
    if (c !== 'IN' && CSU.edit.scheme === 'composition') CSU.edit.scheme = 'regular';
    var z = csuZoneFor(c, CSU.edit.timezone); CSU.edit.timezone = z.value; CSU.src.timezone = z.from; CSU.open.timezone = z.ask && !z.value;
  }
  else if (k === 'currency') CSU.edit.currency = String(v || '').toUpperCase().slice(0, 3);
  else if (k === 'fy') CSU.edit.fy = Number(v) || 0;
  else if (k === 'registered') CSU.edit.registered = (v === true || v === 'yes');
  else if (k === 'number') CSU.edit.number = String(v || '');
  else if (k === 'scheme') CSU.edit.scheme = String(v || 'regular');
  else if (k === 'timezone') CSU.edit.timezone = String(v || '');
  if (k !== 'country') CSU.src[map[k]] = tx('typed'); else CSU.src.country = tx('typed');
  CSU.err = '';
  renderCountrySetup();
}
/* CL3 · the readiness reader, loaded once on first paint (a small shared unit, not a cap); its data is read once per page */
var CSU_READY = { data: null, state: '' };
function csuReadyLoad() {
  if (CSU_READY.state) return;
  CSU_READY.state = 'loading';
  var go2 = function () { CBCountryReady.load().then(function (d) { CSU_READY.data = d; CSU_READY.state = 'ok'; }, function () { CSU_READY.state = 'err'; }).then(function () { if (/^#\/country/.test(location.hash)) renderCountrySetup(); }); };
  if (window.CBCountryReady) return go2();
  var sc = document.createElement('script'); sc.src = '/app/country-ready.js?v=' + (typeof CB_BUILD !== 'undefined' ? CB_BUILD : ''); sc.onload = go2;
  sc.onerror = function () { CSU_READY.state = 'err'; renderCountrySetup(); }; document.head.appendChild(sc);
}
/** "Where ChitBridge is for <country>": one row per product area — symbol · area · one line — in the gov panel's rows */
function csuReadyHTML(cc) {
  csuReadyLoad();
  if (!cc || CSU_READY.state === 'loading' || !CSU_READY.state) return '';
  if (CSU_READY.state === 'err') return '<div class="hint" data-testid="cs-ready-err">' + esc(tx('Could not read where ChitBridge is for each country.')) + '</div>';
  var v = CBCountryReady.view(CSU_READY.data, cc, csuCountryName(cc));
  return '<div class="govbox" data-testid="cs-ready">'
    + '<div style="font-weight:700" data-testid="cs-ready-title">' + esc(v.title) + '</div>'
    + '<div style="color:var(--grey);font-size:var(--fs-1)" data-testid="' + (v.known ? 'cs-ready-pack' : 'cs-ready-none') + '">' + esc(v.known ? v.pack : v.none) + '</div>'
    + v.rows.map(function (r) {
      return '<div class="govrow" data-testid="cs-ready-row" data-state="' + esc(r.state) + '"><span class="gw"><span aria-hidden="true">' + esc(r.sym) + '</span> ' + esc(r.area) + '</span><span class="gv" style="font-weight:600;font-size:var(--fs-2)">' + esc(r.line) + '</span></div>';
    }).join('')
    + '</div>';
}
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
function csuSel(id, k, opts, cur) {
  return '<select class="inp" id="' + id + '" data-testid="' + id + '" onchange="csuSet(\'' + k + '\', this.value)">'
    + opts.map(function (o) { return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(cur) ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select>';
}
function renderCountrySetup() {
  if (!SESSION.token && !CSU.host) return go('#/login');   /* a host page holds its own sign-in window (CBFrame) */
  if (!CSU.p && !CSU.loading && !CSU.readErr) { csuRead(); }
  if (!CSU.edit) csuPrefill();
  var e = CSU.edit, p = CSU.p, s = CSU.src;
  var noPack = p && p.pack && p.pack.books === false && p.pack.why;
  var body;
  if (CSU.loading && !p) {
    body = '<div class="body" data-testid="cs-loading" style="color:var(--grey)">' + esc(tx('Reading…')) + '</div>';
  } else {
    var countryOpts = csuCountries().map(function (c) { return { v: c, t: csuCountryName(c) + ' · ' + c }; });
    var curOpts = csuCurrencies(e.country).map(function (c) { return { v: c, t: c }; });
    /* CS2: once the shop holds a product or a transaction, Country and Money are fixed — greyed, with the reason, never a Change */
    var fixed = csuConstituted();
    var fixedWhy = fixed ? txf('fixed — the shop already has {w}', { w: csuFixedBy() }) : null;
    var zones = csuZones(e.country), zoneAsk = zones.length > 1;
    var zoneOpts = (e.timezone && zones.indexOf(e.timezone) >= 0 ? [] : [{ v: '', t: tx('Pick the time zone') }]).concat(zones.map(function (z) { return { v: z, t: z.replace(/_/g, ' ') }; }));
    var rows = csuRow('country', tx('Country'), esc(csuCountryName(e.country) || tx('not known')), fixedWhy || s.country,
        csuSel('cs-country', 'country', countryOpts, e.country), fixed)
      + csuRow('currency', tx('Money'), esc(e.currency || tx('not known')), fixedWhy || s.currency,
        curOpts.length ? csuSel('cs-currency', 'currency', curOpts, e.currency) : '<input class="inp" id="cs-currency" data-testid="cs-currency" maxlength="3" placeholder="' + esc((csuPackOf(e.country) || csuPack(e.country) || {}).currency || '') + '" value="' + esc(e.currency) + '" onchange="csuSet(\'currency\', this.value)">', fixed)
      + csuRow('fy', tx('Year starts'), esc(CSU_MONTHS[(e.fy || 1) - 1] || ''), s.fy_start_month,
        csuSel('cs-fy', 'fy', CSU_MONTHS.map(function (m, i) { return { v: i + 1, t: m }; }), e.fy))
      + ((zones.length || e.timezone)
        ? csuRow('timezone', tx('Time zone'), e.timezone ? '<span translate="no">' + esc(e.timezone.replace(/_/g, ' ')) + '</span>' : esc(tx('not picked yet')), s.timezone,   /* the IANA id is an identifier, never translated (LOCALE-STANDARD) */
            csuSel('cs-timezone', 'timezone', zoneOpts, e.timezone), !zoneAsk)
        : '')
      + csuRow('tax', csuScheme(e.country),
        esc(e.registered ? ((e.country === 'IN' ? (e.scheme === 'composition' ? tx('Composition') : tx('Regular')) + ' · ' : tx('Registered') + ' · ') + (e.number || '')) : tx('Not registered')), s.tax,
        '<div style="display:grid;gap:6px">'
        + csuSel('cs-tax-reg', 'registered', [{ v: 'no', t: tx('Not registered') }, { v: 'yes', t: txf('Registered for {s}', { s: csuScheme(e.country) }) }], e.registered ? 'yes' : 'no')
        + (e.registered ? '<input class="inp" id="cs-tax-number" data-testid="cs-tax-number" placeholder="' + esc(csuTaxIdHint(e.country)) + '" value="' + esc(e.number) + '" onchange="csuSet(\'number\', this.value)">' : '')
        + (e.registered && e.country === 'IN' ? csuSel('cs-tax-scheme', 'scheme', [{ v: 'regular', t: tx('Regular') }, { v: 'composition', t: tx('Composition') }], e.scheme) : '')
        + '</div>');
    body = '<div class="body">'
      + '<div style="color:var(--grey);font-size:var(--fs-2);margin-bottom:6px">' + esc(tx('We filled these in. Change any, then continue.')) + '</div>'
      + '<div class="govbox" data-testid="cs-rows">' + rows + '</div>'
      + (noPack ? '<div class="hint" data-testid="cs-nopack" style="color:var(--warn-2)">' + esc(p.pack.why) + '</div>' : '')
      + (CSU.readErr ? '<div class="hint" data-testid="cs-readerr">' + esc(tx('Could not read what registration stored — these are from this device.')) + '</div>' : '')
      + (CSU.err ? '<div class="err" data-testid="cs-err">' + esc(CSU.err) + '</div>' : '')
      + (CSU.later
          ? '<button class="btn" id="cs-open" data-testid="cs-open" onclick="csuDone()">' + esc(tx(CSU.host ? 'Done' : 'Open the app')) + ' <span class=arw>→</span></button>'
          : '<button class="btn" id="cs-save" data-testid="cs-save">' + esc(tx('Continue')) + ' <span class=arw>→</span></button>')
      + '<div class="hint" data-testid="cs-rule">' + esc(fixed
          ? tx('Country and money never change once a shop has products or transactions. Register a new business for another country.')
          : tx('Country and money can still be corrected now. Once the shop has a product or a transaction they are fixed for good.')) + '</div>'
      /* CPS1: the Country Standard — what a country pack carries and what each pack still lacks (standards.html opens on that row's search) */
      + '<div class="hint"><a href="/standards.html?std=country" data-testid="cs-standard" style="font-weight:600;color:var(--blue);cursor:pointer">' + esc(tx('What a country pack must carry — the Country Standard')) + ' ›</a></div>'
      /* CL3: under Continue, so the step's one action stays beside its rows; the card scrolls to its top (.auth align-items:safe center)
         and ends --scroll-tail above the fold (app.html's own rule), so its last row scrolls clear of the pinned Assistant button */
      + csuReadyHTML(e.country)
      + '</div>';
  }
  if (CSU.host) CSU.host.innerHTML = '<div class="cs"><h2 class="shop-h" data-testid="cs-title">' + esc(tx('Country setup')) + '</h2>' + body + '</div>';
  else document.getElementById('root').innerHTML = modeRibbon() + '<div class="auth"><div class="card" style="margin-bottom:var(--scroll-tail,120px)">'
    + '<div class="top">' + logo() + '<h1 data-testid="cs-title">' + esc(tx('Country setup')) + '</h1></div>' + body + '</div></div>';
  var b = document.getElementById('cs-save'); if (b) b.onclick = csuSave;
}
/** the one write — M64: one press, one call; a server refusal is said in the form, in its own words */
function csuSave() {
  var btn = document.getElementById('cs-save'), e = CSU.edit; if (!e) return;
  CSU.err = '';
  var body = { country: e.country, currency: e.currency, fy_start_month: e.fy, tax: { registered: !!e.registered, number: e.registered ? e.number : null, scheme: e.registered ? e.scheme : null },
               timezone: e.timezone || null, source: CSU.src };   /* CS2: the zone picked of the pack's several (a one-zone pack: the server sets it anyway) */
  CBAction.run(btn, function () { return api('countrySetupSave', { body: body }); }, {
    key: 'cs-save', busy: tx('Saving…'),
    outcome: function (p) {
      CSU.p = p || CSU.p; try { if (p && p.pack) SESSION.booksOn = false; } catch (_) {}
      /* CS2: a correction before the shop was constituted — the server says what it set again from the new pack */
      toast(p && p.rederived ? txf('Country corrected to {c} — money, year, tax, time zone and chart set again from its pack.', { c: csuCountryName(p.rederived.to) }) : tx('Country set.'));
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
/** where the step goes when it is done: the HOST says (app.html's route sets the workshop's own; settings.html its Your shop) — this file names no door */
function csuDone(){ if (CSU.onDone) CSU.onDone(); }
/** CB Settings › Country (settings.html): the same rows, painted in the page's pane. Re-mounting re-reads nothing the server already answered. */
var CBCountry = { mount: function (host, onDone) { CSU.host = host; CSU.onDone = onDone || null; renderCountrySetup(); } };
