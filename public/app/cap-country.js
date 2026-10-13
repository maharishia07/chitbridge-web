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
 *   csuReadyHTML() (CL3) — "Where ChitBridge is for <country>" for the CHOSEN country, so a new shop sees what works for it. The rows are
 *     CBCountryReady's (app/country-ready.js — the same unit the Country lab paints), drawn in this step's own gov-panel rows; nothing typed.
 * Flow step: Onboarding · Register → Country setup → the app. (docs/process/flows.json is PM1's, not merged yet.)
 */
'use strict';
var CSU = { p: null, loading: false, readErr: false, edit: null, src: {}, open: {}, err: '', later: false };
var CSU_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** the country's name a person reads — the locale engine's served list, else the browser's own region names, else the code (never a guess) */
function csuCountryName(code) {
  if (!code) return '';
  try { var R = window.CBLocale && CBLocale.REGIONS; if (R && R[code] && R[code].name) return R[code].name; } catch (_) {}
  try { var n = new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(code); if (n && n !== code && !/unknown/i.test(n)) return n; } catch (_) {}
  return code;
}
/** the countries the picker offers: the served list, plus the one the browser sits in and the one the server holds */
function csuCountries() {
  var out = [], seen = {};
  var add = function (c) { c = String(c || '').toUpperCase(); if (c && /^[A-Z]{2}$/.test(c) && !seen[c]) { seen[c] = 1; out.push(c); } };
  try { Object.keys((window.CBLocale && CBLocale.REGIONS) || {}).forEach(add); } catch (_) {}
  try { var g = govCtx(); if (g && g.country) { add(g.country.value); add(g.country.unserved); } } catch (_) {}
  if (CSU.p && CSU.p.country) add(CSU.p.country.code);
  if (CSU.edit) add(CSU.edit.country);
  return out;
}
/** the money a country usually keeps its prices in (the locale engine's list), plus whatever is set now */
function csuCurrencies(country) {
  var out = [], seen = {};
  var add = function (c) { c = String(c || '').toUpperCase(); if (c && /^[A-Z]{3}$/.test(c) && !seen[c]) { seen[c] = 1; out.push(c); } };
  try { var R = window.CBLocale && CBLocale.REGIONS; if (R && R[country]) (R[country].cur || []).forEach(add); } catch (_) {}
  if (CSU.edit) add(CSU.edit.currency);
  if (CSU.p) add(CSU.p.currency);
  return out;
}
/** the prefill: the server's answer first (it knows what registration stored), else what the browser worked out (M196) — each with its source */
function csuPrefill() {
  var p = CSU.p, g = null; try { g = govCtx(); } catch (_) {}
  var e = { country: '', currency: '', fy: 0, registered: false, number: '', scheme: 'regular' }, src = {};
  if (p) {
    e.country = (p.country && p.country.code) || ''; e.currency = p.currency || ''; e.fy = p.fy_start_month || 0;
    e.registered = !!(p.tax && p.tax.registered); e.number = (p.tax && p.tax.number) || ''; e.scheme = (p.tax && p.tax.scheme) || 'regular';
    src = Object.assign({}, p.source || {});
    if (!src.country && e.country) src.country = p.done ? tx('what you set') : (g && g.country && g.country.value === e.country && g.country.from) || tx('your registration');
    if (!src.currency && e.currency) src.currency = p.done ? tx('what you set') : (g && g.currency && g.currency.value === e.currency && g.currency.from) || tx('your registration');
    if (!src.fy_start_month && e.fy) src.fy_start_month = p.done ? tx('what you set') : (p.pack && p.pack.id ? txf('the {c} pack', { c: csuCountryName(p.pack.id) }) : tx('the usual year'));
    if (!src.tax) src.tax = e.registered ? tx('your registration') : tx('not set yet');
  }
  if (!e.country && g && g.country && g.country.value) { e.country = g.country.value; src.country = g.country.from; }
  if (!e.currency && g && g.currency && g.currency.value) { e.currency = g.currency.value; src.currency = g.currency.from; }
  if (!e.fy) { e.fy = e.country === 'IN' ? 4 : 1; src.fy_start_month = e.country === 'IN' ? tx('the India pack') : tx('the usual year'); }
  if (!src.tax) src.tax = tx('not set yet');
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
  var map = { country: 'country', currency: 'currency', fy: 'fy_start_month', registered: 'tax', number: 'tax', scheme: 'tax' };
  if (k === 'country') { var c = String(v || '').toUpperCase(); CSU.edit.country = c; var curs = csuCurrencies(c); if (curs.length && curs.indexOf(CSU.edit.currency) < 0) { CSU.edit.currency = curs[0]; CSU.src.currency = txf('the usual currency in {c}', { c: csuCountryName(c) }); } if (c !== 'IN' && CSU.edit.scheme === 'composition') CSU.edit.scheme = 'regular'; }
  else if (k === 'currency') CSU.edit.currency = String(v || '').toUpperCase().slice(0, 3);
  else if (k === 'fy') CSU.edit.fy = Number(v) || 0;
  else if (k === 'registered') CSU.edit.registered = (v === true || v === 'yes');
  else if (k === 'number') CSU.edit.number = String(v || '');
  else if (k === 'scheme') CSU.edit.scheme = String(v || 'regular');
  CSU.src[map[k]] = tx('typed');
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
    + (v.known ? '<div class="hint" data-testid="cs-ready-pack">' + esc(v.pack) + '</div>' : '<div class="hint" data-testid="cs-ready-none">' + esc(v.none) + '</div>')
    + v.rows.map(function (r) {
      return '<div class="govrow" data-testid="cs-ready-row" data-state="' + esc(r.state) + '"><span class="gw"><span aria-hidden="true">' + esc(r.sym) + '</span> ' + esc(r.area) + '</span><span class="gv" style="font-weight:600">' + esc(r.line) + '</span></div>';
    }).join('')
    + '</div>';
}
function csuOpen(k) { CSU.open[k] = !CSU.open[k]; renderCountrySetup(); }
/** one row: what · value · where it came from · Change (the registration's gov panel, with the one tap it lacked) */
function csuRow(key, what, valueHtml, from, editHtml) {
  return '<div class="govrow" data-testid="cs-row-' + key + '">'
    + '<span class="gw">' + esc(what) + '</span>'
    + '<span class="gv" data-testid="cs-val-' + key + '">' + valueHtml + ' <a data-testid="cs-change-' + key + '" onclick="csuOpen(\'' + key + '\')" style="font-weight:600;color:var(--blue);cursor:pointer;margin-inline-start:6px">' + esc(CSU.open[key] ? tx('Done') : tx('Change')) + '</a></span>'
    + '<span class="gf" data-testid="cs-src-' + key + '">' + esc(from || '') + '</span>'
    + (CSU.open[key] ? '<span style="grid-column:1 / -1;padding-top:4px">' + editHtml + '</span>' : '')
    + '</div>';
}
function csuSel(id, k, opts, cur) {
  return '<select class="inp" id="' + id + '" data-testid="' + id + '" onchange="csuSet(\'' + k + '\', this.value)">'
    + opts.map(function (o) { return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(cur) ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select>';
}
function renderCountrySetup() {
  if (!SESSION.token) return go('#/login');
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
    var rows = csuRow('country', tx('Country'), esc(csuCountryName(e.country) || tx('not known')), s.country,
        csuSel('cs-country', 'country', countryOpts, e.country))
      + csuRow('currency', tx('Money'), esc(e.currency || tx('not known')), s.currency,
        curOpts.length ? csuSel('cs-currency', 'currency', curOpts, e.currency) : '<input class="inp" id="cs-currency" data-testid="cs-currency" maxlength="3" placeholder="INR" value="' + esc(e.currency) + '" onchange="csuSet(\'currency\', this.value)">')
      + csuRow('fy', tx('Year starts'), esc(CSU_MONTHS[(e.fy || 1) - 1] || ''), s.fy_start_month,
        csuSel('cs-fy', 'fy', CSU_MONTHS.map(function (m, i) { return { v: i + 1, t: m }; }), e.fy))
      + csuRow('tax', e.country === 'IN' ? tx('GST') : tx('Tax'),
        esc(e.registered ? ((e.country === 'IN' ? (e.scheme === 'composition' ? tx('Composition') : tx('Regular')) + ' · ' : tx('Registered') + ' · ') + (e.number || '')) : tx('Not registered')), s.tax,
        '<div style="display:grid;gap:6px">'
        + csuSel('cs-tax-reg', 'registered', [{ v: 'no', t: tx('Not registered') }, { v: 'yes', t: e.country === 'IN' ? tx('Registered for GST') : tx('Registered for tax') }], e.registered ? 'yes' : 'no')
        + (e.registered ? '<input class="inp" id="cs-tax-number" data-testid="cs-tax-number" placeholder="' + esc(e.country === 'IN' ? '33AAAAA0000A1Z5' : tx('Registration number')) + '" value="' + esc(e.number) + '" onchange="csuSet(\'number\', this.value)">' : '')
        + (e.registered && e.country === 'IN' ? csuSel('cs-tax-scheme', 'scheme', [{ v: 'regular', t: tx('Regular') }, { v: 'composition', t: tx('Composition') }], e.scheme) : '')
        + '</div>');
    body = '<div class="body">'
      + '<div style="color:var(--grey);font-size:var(--fs-2);margin-bottom:6px">' + esc(tx('We filled these in. Change any, then continue.')) + '</div>'
      + '<div class="govbox" data-testid="cs-rows">' + rows + '</div>'
      + (noPack ? '<div class="hint" data-testid="cs-nopack" style="color:var(--warn-2)">' + esc(p.pack.why) + '</div>' : '')
      + csuReadyHTML(e.country)
      + (CSU.readErr ? '<div class="hint" data-testid="cs-readerr">' + esc(tx('Could not read what registration stored — these are from this device.')) + '</div>' : '')
      + (CSU.err ? '<div class="err" data-testid="cs-err">' + esc(CSU.err) + '</div>' : '')
      + (CSU.later
          ? '<button class="btn" id="cs-open" data-testid="cs-open" onclick="go(\'#/app\')">' + esc(tx('Open the app')) + ' <span class=arw>→</span></button>'
          : '<button class="btn" id="cs-save" data-testid="cs-save">' + esc(tx('Continue')) + ' <span class=arw>→</span></button>')
      + '<div class="hint">' + esc(tx('Set once. A shop in another country is a new registration.')) + '</div>'
      + '</div>';
  }
  document.getElementById('root').innerHTML = modeRibbon() + '<div class="auth"><div class="card">'
    + '<div class="top">' + logo() + '<h1 data-testid="cs-title">' + esc(tx('Country setup')) + '</h1></div>' + body + '</div></div>';
  var b = document.getElementById('cs-save'); if (b) b.onclick = csuSave;
}
/** the one write — M64: one press, one call; a server refusal is said in the form, in its own words */
function csuSave() {
  var btn = document.getElementById('cs-save'), e = CSU.edit; if (!e) return;
  CSU.err = '';
  var body = { country: e.country, currency: e.currency, fy_start_month: e.fy, tax: { registered: !!e.registered, number: e.registered ? e.number : null, scheme: e.registered ? e.scheme : null }, source: CSU.src };
  CBAction.run(btn, function () { return api('countrySetupSave', { body: body }); }, {
    key: 'cs-save', busy: tx('Saving…'),
    outcome: function (p) { CSU.p = p || CSU.p; try { if (p && p.pack) SESSION.booksOn = false; } catch (_) {} toast(tx('Country set.')); go('#/app'); },
    onFail: function (words, err) {
      var st = err && err.status;
      /* before the database update that holds this step: say so, and let the shop in — selling and the rail work meanwhile */
      if (st === 503) { CSU.later = true; CSU.err = (err.data && err.data.message) || words; }
      else CSU.err = words;
      renderCountrySetup();
    },
  });
}
