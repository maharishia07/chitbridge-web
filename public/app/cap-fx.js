/* cap-fx.js — FOREIGN CURRENCY (FX1, 2026-10-14): CB Accounts › Setup › Rates, and Month lock's "Foreign balances" line.
 * A foreign bill posts at the rate of ITS day; a rate is evidence the owner types or imports (CSV) — the server never fetches one and never assumes one.
 * A bill with no rate waits on Waiting, named ("No USD rate for 14 Oct — add it in Accounts › Rates"); it posts once the rate is here.
 *
 * ── WHAT IS REUSED (CLAUDE.md rule 1) ────────────────────────────────────────────────────────────────────────────────────────────
 *   · the rates ARE CBList (app/list-ctl.js): search, the source filter, sort, cards at 390 px, only the rows scroll
 *   · each write (add · import · revalue) goes through CBAction.run (M64, accounts-shell.js); the server's `may` greys the button WITH its sentence
 *   · a field row is Move in's miRow (cap-move-in.js); every amount is bkMoney / bkDrCr (M36 / M25, cap-books.js); dates bkDate
 *   · every figure — the rate, the revaluation, the gain or loss — is the server's (lib/fx-rates over CBPosting fxRevaluation); nothing is computed here
 * ── WHAT IS NEW, AND WHY ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   fxView · fxPaint · fxList · fxAdd* · fxImport · fxLockLine · fxRevalue — nothing kept exchange rates or revalued a foreign balance before.
 *   Flow: FX (Foreign currency) steps 1–3, docs/process/flows.json.
 * Better than Xero / QuickBooks (a rate feed you cannot see the source of, revaluation as a report you re-run) because every entry NAMES the rate it used
 * (typed, imported or official, and its day), a missing rate is a named wait — never a silent guess — and the revaluation is two sealed entries that come back.
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  booksFxRates:       { m: 'GET',  p: '/api/books/fx-rates',        ok: 'y' },   /* anyone who reads the books: the rates, ready, may.add, the pack's rule */
  booksFxRateAdd:     { m: 'POST', p: '/api/books/fx-rates',        ok: 'y' },   /* owner: one rate (insert-only; a newer row for the day corrects it) */
  booksFxImport:      { m: 'POST', p: '/api/books/fx-rates/import', ok: 'y' },   /* owner: a CSV of rates — good rows in, bad rows named */
  booksFxRevalue:     { m: 'GET',  p: '/api/books/fx-revalue',      ok: 'y' },   /* owner: the open foreign balances at the closing rate (Month lock) */
  booksFxRevaluePost: { m: 'POST', p: '/api/books/fx-revalue',      ok: 'y' },   /* owner: post the revaluation and its reversal */
}); }

var FXV = { r: null, err: '', add: null, gen: 0, lk: null };
var FX_SOURCE = { manual: 'Typed', import: 'Imported', official: 'Official' };

/* ── the view (BK.views.rates) ── */
function fxView(body) {
  FXV.add = null; FXV.err = '';
  body.innerHTML = '<div data-testid="fx" class="fx"><div id="fx_bar"></div><div id="fx_form"></div><div id="fx_rows" data-testid="fx-rows" style="min-height:240px"></div></div>';
  fxLoad();
}
function fxLoad() {
  var g = ++FXV.gen;
  return api('booksFxRates').then(function (reply) { if (g !== FXV.gen) return; FXV.r = reply || {}; FXV.err = ''; fxPaint(); },
    function (e) { if (g !== FXV.gen) return; FXV.r = null; FXV.err = bkWhy(e, tx('Could not be read')); fxPaint(); });
}
function fxMay() { return (FXV.r && FXV.r.may && FXV.r.may.add) || { may: false, why: FXV.err || null }; }
function fxPaint() {
  var bar = document.getElementById('fx_bar'); if (!bar) return;
  var may = fxMay(), r = FXV.r || {}, rule = r.rule || {};
  var dis = may.may ? '' : ' disabled title="' + esc(may.why || '') + '"';
  bar.innerHTML = '<div class="supacts" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'
    + '<button type="button" data-testid="fx-add" onclick="fxAddOpen()"' + dis + '>' + esc(tx('Add rate')) + '</button>'
    + '<label class="act" data-testid="fx-import-label" style="cursor:pointer' + (may.may ? '' : ';opacity:.6;pointer-events:none') + '">' + esc(tx('Import CSV'))
    + '<input type="file" accept=".csv,text/csv" data-testid="fx-import" onchange="fxImport(this)" style="display:none"' + (may.may ? '' : ' disabled') + '></label></div>'
    + (!may.may && may.why ? '<div data-testid="fx-why" style="color:var(--grey);font-size:var(--fs-1);margin-bottom:8px">' + esc(may.why) + '</div>' : '')
    + (rule.official_name ? '<div data-testid="fx-rule" title="' + esc(rule.tax_rate_rule || '') + '" style="color:var(--grey);font-size:var(--fs-1);margin-bottom:8px">' + esc(txf('Tax value uses the {name}.', { name: rule.official_name })) + '</div>' : '');
  if (FXV.err && !FXV.r) { document.getElementById('fx_rows').innerHTML = '<div class="err" data-testid="fx-err" style="color:var(--warn-2)">' + esc(FXV.err) + '</div>'; return; }
  fxList();
}
/* the rates: CBList — day · currency · rate · source · reference; newest first (the server's order) */
function fxList() {
  var el = document.getElementById('fx_rows'); if (!el) return;
  var r = FXV.r || {}, rows = r.rates || [], cur = r.currency || '';
  CBList.reset('fx-rates');
  CBList.mount(el, {
    key: 'fx-rates', t: tx, rows: function () { return rows; }, id: function (x) { return x.rate_id; }, rowTid: function (x) { return 'fx-row-' + x.from + '-' + x.date; },
    columns: [
      { key: 'date', label: tx('Day'), prio: 1, sort: 'date', w: 120, cell: function (x) { return bkDate(x.date); } },
      { key: 'from', label: tx('Currency'), prio: 1, sort: 'from', w: 100, cell: function (x) { return x.from; } },
      { key: 'rate', label: tx('Rate'), prio: 1, num: true, w: 170, cell: function (x) { return '1 ' + x.from + ' = ' + x.rate + ' ' + (x.to || cur); } },
      { key: 'source', label: tx('Source'), prio: 2, w: 110, hfilter: 'source', cell: function (x) { return tx(FX_SOURCE[x.source] || x.source); } },
      { key: 'ref', label: tx('Reference'), prio: 3, w: 220, cell: function (x) { return x.source_ref || ''; } },
    ],
    defaultCols: ['date', 'from', 'rate', 'source', 'ref'],
    filters: [{ key: 'source', label: tx('Source'), all: tx('Every source'), options: Object.keys(FX_SOURCE).map(function (item) { return { v: item, label: tx(FX_SOURCE[item]) }; }), match: function (x, v) { return x.source === v; } }],
    sorts: [{ key: 'date', label: tx('Newest first'), cmp: function () { return 0; } }, { key: 'from', label: tx('Currency'), cmp: function (a, b) { return String(a.from).localeCompare(String(b.from)) || String(b.date).localeCompare(String(a.date)); } }],
    search: function (x) { return [x.date, x.from, x.rate, x.source, x.source_ref].join(' '); },
    empty: { title: tx('No rates yet. Add the day\'s rate.') },
  });
}

/* ── add one rate (the one write, M64) ── */
function fxAddOpen() {
  var node = document.getElementById('fx_form'); if (!node) return;
  FXV.add = { err: '' };
  var today = bkToday();
  node.innerHTML = '<div data-testid="fx-form" style="max-width:420px;margin-bottom:10px">'
    + miRow(tx('Day'), '<input class="inp" type="date" id="fx_date" data-testid="fx-date" value="' + esc(today) + '" style="width:auto;max-width:100%">')
    + miRow(tx('Currency'), '<input class="inp" id="fx_cur" data-testid="fx-cur" maxlength="3" placeholder="USD" style="width:6em;text-transform:uppercase">')
    + miRow(txf('Rate in {c}', { c: (FXV.r && FXV.r.currency) || '' }), '<input class="inp" id="fx_rate" data-testid="fx-rate" inputmode="decimal" placeholder="83.25" style="width:9em">')
    + miRow(tx('Source'), '<select class="inp" id="fx_src" data-testid="fx-src" style="min-width:0;max-width:100%"><option value="manual">' + esc(tx('Typed')) + '</option><option value="official">' + esc(tx('Official')) + '</option></select>')
    + miRow(tx('Reference'), '<input class="inp" id="fx_ref" data-testid="fx-ref" maxlength="120" placeholder="' + esc(tx('Where it came from')) + '" style="width:100%">')
    + '<div id="fx_ferr" data-testid="fx-form-err" style="color:var(--warn-2);font-size:var(--fs-1)"></div>'
    + '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="supact-pri" data-testid="fx-save" onclick="fxAddSave(this)">' + esc(tx('Save rate')) + '</button>'
    + '<button type="button" data-testid="fx-cancel" onclick="fxAddCancel()">' + esc(tx('Cancel')) + '</button></div></div>';
}
function fxAddCancel() { FXV.add = null; var node = document.getElementById('fx_form'); if (node) node.innerHTML = ''; }
function fxVal(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
function fxAddSave(btn) {
  var body = { date: fxVal('fx_date'), currency: fxVal('fx_cur').toUpperCase(), rate: fxVal('fx_rate'), source: fxVal('fx_src') || 'manual' };
  if (fxVal('fx_ref')) body.source_ref = fxVal('fx_ref');
  CBAction.run(btn, function () { return api('booksFxRateAdd', { body: body }); }, {
    key: 'fx-add', busy: tx('Saving…'),
    outcome: function (r) { var x = (r && r.rate) || {}; toast(txf('{c} rate for {d} saved.', { c: x.from || body.currency, d: bkDate(x.date || body.date) })); fxAddCancel(); fxLoad(); },
    onFail: function (words) { var e = document.getElementById('fx_ferr'); if (e) e.textContent = words; },
  });
}
/* ── import a CSV: date · currency · rate (· source · source_ref) — the server checks each row and names the bad ones ── */
function fxImport(input) {
  var file = input && input.files && input.files[0]; if (!file) return;
  var label = document.querySelector('[data-testid="fx-import-label"]');
  file.text().then(function (text) {
    CBAction.run(label, function () { return api('booksFxImport', { body: { csv: text, file_name: file.name } }); }, {
      key: 'fx-import', busy: tx('Importing…'),
      outcome: function (r) {
        var bad = (r && r.refused) || [];
        toast(txf('{n} rates added.', { n: (r && r.added) || 0 }) + (bad.length ? ' ' + txf('Line {l}: {w}', { l: bad[0].line, w: bad[0].why }) : ''));
        input.value = ''; fxLoad();
      },
      onFail: function (words) { toast(words); input.value = ''; },
    });
  });
}

/* ── Month lock: the foreign balances of the month to lock next — revalue first, then lock (cap-books bkLockRowsPaint calls this) ── */
function fxLockMonth() {
  var L = (typeof BK !== 'undefined' && BK.lk) || {}, info = L.info || {};
  for (var count = 1; count <= 12; count++) { var x = info[L.fy + '|' + count]; if (x && x.lock && x.lock.may && (L.rows || {})[L.fy + '|' + count] !== 'soft_locked' && (L.rows || {})[L.fy + '|' + count] !== 'hard_locked') return { fy: L.fy, p: count }; }
  return null;
}
function fxLockLine() {
  var host = document.getElementById('lk_fx'), m = fxLockMonth(); if (!host) return;
  if (!m || !bkIsOwner()) { host.innerHTML = ''; return; }
  var k = m.fy + '|' + m.p; if (FXV.lk && FXV.lk.k === k && FXV.lk.r) return fxLockPaint(host, FXV.lk.r);
  FXV.lk = { k: k, r: null };
  api('booksFxRevalue', { query: { fiscal_year: m.fy, period: m.p } }).then(function (reply) { if (FXV.lk && FXV.lk.k === k) { FXV.lk.r = reply || {}; fxLockPaint(host, FXV.lk.r); } },
    function () { host.innerHTML = ''; });
}
function fxLockPaint(host, r) {
  var rows = r.rows || [];
  if (!r.ready || (!rows.length && !(r.missing || []).length)) { host.innerHTML = ''; return; }   /* no foreign balance: nothing to say (fine collapses) */
  var c = r.functional, may = (r.may && r.may.post) || { may: false, why: r.why };
  var g = Number(r.gain_minor || 0), word = r.posted ? txf('Revalued — {no}', { no: r.posted.entry_no }) : g ? txf(g > 0 ? 'Gain {a} at the closing rate' : 'Loss {a} at the closing rate', { a: bkMoney(Math.abs(g), c) }) : tx('At the closing rate already');
  host.innerHTML = '<div data-testid="lk-fx" style="border:1px solid var(--line,#ddd);border-radius:8px;padding:8px 10px">'
    + '<div style="font-weight:700">' + esc(tx('Foreign balances')) + '</div>'
    + '<div data-testid="lk-fx-words" style="font-size:var(--fs-1)">' + esc(word) + '</div>'
    + rows.map(function (x) { return CBList.nextRow([esc(x.party || x.code || '') + ' · ' + esc(bkMoney(Math.abs(x.balance_txn_minor), x.txn_currency)), esc(bkDrCr(x.diff_minor, c))], [120]); }).join('')
    + (!may.may && may.why && !r.posted ? '<div data-testid="lk-fx-why" style="color:var(--grey);font-size:var(--fs-1)">' + esc(may.why) + '</div>' : '')
    + (r.posted ? '' : '<button type="button" data-testid="lk-fx-revalue" style="margin-top:6px"' + (may.may ? ' onclick="fxRevalue(this)"' : ' disabled title="' + esc(may.why || '') + '"') + '>' + esc(tx('Revalue')) + '</button>')
    + '</div>';
}
function fxRevalue(btn) {
  var m = fxLockMonth(); if (!m) return;
  CBAction.run(btn, function () { return api('booksFxRevaluePost', { body: { fiscal_year: m.fy, period: Number(m.p) } }); }, {
    key: 'fx-revalue', busy: tx('Revaluing…'),
    outcome: function (r) { toast(txf('Revalued — {no}. It comes back on {d}.', { no: (r && r.entry_no) || '', d: bkDate((r && r.reverses_on) || '') })); FXV.lk = null; fxLockLine(); },
    onFail: function (words) { toast(words); },
  });
}
