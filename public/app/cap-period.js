/* cap-period.js — MONTH & YEAR END on CB Accounts: Closing stock · Assets & depreciation · Accruals & recurring · GST close & pay · Year close.
 * Contract: docs/design/cb-accounts-ia/REQUIREMENT.md ("Month & year end"); the server's shapes: chitbridge-api routes/books.js (the period-end routes),
 * lib/books-period.js, lib/books-recurring.js and GET /year/:fy/status. Loaded by accounts.html after cap-books.js, which owns the helpers used here
 * (bkMoney · bkToMinor · bkOnce · bkRef · bkWhy · bkPeriodsLoad · bkIsOwner · CBList mounting).
 *
 * ⭐ THE PAGE COMPUTES NO MONEY. Every figure on these pages is read from the API's answer (set-off, payable, basis, entry number, WDV);
 *   a typed amount is parsed to minor units (bkToMinor) and sent. Nothing is added up here.
 * ⭐ EVERY ENTRY IS POSTED THROUGH THE API, which numbers it (MJ / JV) — this file shows the number it was given and never makes one.
 * ⭐ ONE TAP, ONE RECORD: each form carries ONE client_ref from the moment it opens (PE.ref), the button is dead while its call is out (bkOnce),
 *   and the ref is replaced only after the server said yes — so a second tap answers the first entry (duplicate) instead of posting twice.
 * ⭐ OWNER-ONLY ACTIONS ARE NOT DRAWN for anyone else (the server enforces it; this only decides who is offered the button).
 * ⭐ A REFUSAL IS A PLAIN SENTENCE WITH ITS FIX: the server's words, and the one button that goes where the fix is (Month lock for a locked month).
 *   A 503 (the table is not migrated yet) is one calm line — "Starts after an update" — never a raw message.
 * Never the word "accounting" on a screen.
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  perStock:      { m: 'POST',   p: '/api/books/closing-stock' },
  perAssets:     { m: 'GET',    p: '/api/books/assets' },
  perAssetAdd:   { m: 'POST',   p: '/api/books/assets' },
  perAssetSell:  { m: 'POST',   p: '/api/books/assets/:id/dispose' },
  perDepRun:     { m: 'POST',   p: '/api/books/depreciation/run' },
  perRecList:    { m: 'GET',    p: '/api/books/recurring' },
  perRecAdd:     { m: 'POST',   p: '/api/books/recurring' },
  perRecPatch:   { m: 'PATCH',  p: '/api/books/recurring/:id' },
  perRecStop:    { m: 'DELETE', p: '/api/books/recurring/:id' },
  perRecPost:    { m: 'POST',   p: '/api/books/recurring/:id/post' },
  perRecSkip:    { m: 'POST',   p: '/api/books/recurring/:id/skip' },
  perAccrue:     { m: 'POST',   p: '/api/books/accruals' },
  perAccrueRev:  { m: 'POST',   p: '/api/books/accruals/:ref/reverse' },
  perGstClose:   { m: 'POST',   p: '/api/books/gst/close' },
  perGstPay:     { m: 'POST',   p: '/api/books/gst/pay' },
  perYearStatus: { m: 'GET',    p: '/api/books/year/:fy/status' },
  perYearClose:  { m: 'POST',   p: '/api/books/year/:fy/close' },
}); }

var PE = { ref: {}, accr: [], rec: [], tab: 'rec' };
const peE = (v) => (typeof esc === 'function' ? esc(v) : String(v == null ? '' : v).replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c])));
const peEl = (id) => document.getElementById(id);
const peVal = (id) => { const e = peEl(id); return e ? String(e.value || '').trim() : ''; };
const peOwner = () => typeof bkIsOwner === 'function' && bkIsOwner();
const peRef = (k) => PE.ref[k] || (PE.ref[k] = bkRef());
const peYmd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
/** the last day of the month `back` months ago (1 = last month) — a date for a field's default, not money */
function peMonthEnd(back) { const n = new Date(); return peYmd(new Date(n.getFullYear(), n.getMonth() - back + 1, 0)); }
function peDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return peYmd(d); }
function peList(r, k) { return Array.isArray(r) ? r : ((r && r[k]) || []); }

/* ── words: the server's sentence, its one fix button, and the calm line for "not migrated yet" ── */
function peFix(msg) {
  if (/locked|closed for good/i.test(msg)) return { label: tx('Open Month lock'), tab: 'lock' };
  return null;
}
function peWhy(e, fallback) {
  if (e && e.status === 503) return { text: tx('Starts after an update'), calm: true, fix: null };
  const text = bkWhy(e, fallback || tx('Could not be saved'));
  return { text, calm: false, fix: peFix(text) };
}
function peBad(id, e, fallback) {
  const el = peEl(id); if (!el) return;
  const w = typeof e === 'string' ? { text: e, calm: false, fix: null } : peWhy(e, fallback);
  el.innerHTML = '<div class="pe-' + (w.calm ? 'calm' : 'bad') + '" data-testid="pe-refused" role="alert"><span>' + (w.calm ? '⏳ ' : '⚠ ') + peE(w.text) + '</span>'
    + (w.fix ? '<button type="button" class="pe-fix" data-testid="pe-fix" onclick="show(\'' + w.fix.tab + '\')">' + peE(w.fix.label) + '</button>' : '') + '</div>';
}
function peOk(id, html) { const el = peEl(id); if (el) el.innerHTML = '<div class="pe-ok" data-testid="pe-ok" role="status">✓ ' + html + '</div>'; }
function peNote(tid, text) { return '<div class="pe-note" data-testid="' + tid + '">' + peE(tx(text)) + '</div>'; }
const peNoOwner = (what) => peNote('pe-readonly', what);
const peField = (id, label, inner) => '<label class="pe-f"><span>' + peE(tx(label)) + '</span>' + inner + '</label>';
const peInput = (id, val, ph, type, extra) => '<input class="inp" id="' + id + '" data-testid="' + id + '"' + (type ? ' type="' + type + '"' : ' inputmode="text"') + (ph ? ' placeholder="' + peE(ph) + '"' : '') + ' value="' + peE(val || '') + '"' + (extra || '') + '>';
const peAmt = (id, val, ph) => bkMoneyInput({ id: id, text: val || '', ph: ph == null ? undefined : ph });   /* the one money input (cap-books bkMoneyInput) */
const peSel = (id, opts, cur, extra) => '<select class="inp" id="' + id + '" data-testid="' + id + '"' + (extra || '') + '>' + opts.map((o) => '<option value="' + peE(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + peE(tx(o[1])) + '</option>').join('') + '</select>';
const peMODES = [['cash', 'Cash'], ['bank', 'Bank'], ['upi', 'UPI'], ['card', 'Card']];
const peBtn = (tid, label, fn, cls) => '<button type="button" class="' + (cls || 'supact-pri') + '" data-testid="' + tid + '" onclick="' + fn + '">' + peE(tx(label)) + '</button>';
/** a minor amount as the text of an amount field (the field is parsed back with bkToMinor — the same digits) */
function peText(minor) { return bkMinorText(minor); }
const peMoney = (minor) => bkMoney(minor);
const peHeads = ['cgst', 'sgst', 'igst', 'cess'];

/* ═══ 1 · CLOSING STOCK ═════════════════════════════════════════════════════════════════════════════════════════════════
   POST /closing-stock { date, value_minor, nrv_minor?, method: 'manual', client_ref } — only the DIFFERENCE from the books posts (the engine reads `book`).
   The last counts are the stock ledger's own lines (GET /ledger/stock): date · entry · what it changed · stock after. */
async function peStockView(body) {
  const own = peOwner();
  body.innerHTML = (own
    ? '<div class="pe-card" data-testid="ps-form"><div class="pe-form">'
      + peField('ps_date', 'Month end', peInput('ps_date', peMonthEnd(1), '', 'date'))
      + peField('ps_val', 'Stock on hand, at cost', peAmt('ps_val'))
      + peField('ps_nrv', 'Worth less now? (only if lower)', peAmt('ps_nrv', '', tx('Leave empty if not')))
      + '</div><div class="supacts">' + peBtn('ps-save', 'Save closing stock', 'peStockSave(this)') + '</div><div id="ps_out" class="pe-slot"></div></div>'
    : peNoOwner('Only the owner enters the closing stock'))
    + '<div id="bkl_stock" data-testid="stock-list"></div>';
  await peStockList();
}
async function peStockList() {
  const host = peEl('bkl_stock'); if (!host) return;
  let lines = [];
  try {
    const r = await api('booksLedger', { params: { account: 'stock' }, query: { from: peDaysAgo(400), to: peYmd(new Date()) } });
    lines = ((r && r.lines) || []).filter((l) => /closing stock/i.test(String(l.what || ''))).map((l, i) => Object.assign({ i }, l)).reverse();
  } catch (e) { if (!(e && e.status === 404)) { host.innerHTML = '<div class="pe-bad">' + bkErr(e) + '</div>'; return; } }
  CBList.reset && CBList.reset('stock');
  CBList.mount(host, {
    key: 'stock', t: tx, rows: () => lines, id: (l) => String(l.ref) + '#' + l.i, rowTid: (l) => 'stock-' + l.i,
    columns: [
      { key: 'date', label: tx('Month end'), prio: 1, sort: 'date', w: 150, html: true, cell: (l) => peE(bkDate(l.date)) },
      { key: 'entry', label: tx('Entry'), prio: 3, sort: 'entry', w: 150, html: true, cell: (l) => '<span class="mono">' + peE(l.ref || '') + '</span>' },
      { key: 'change', label: tx('Changed the stock by'), prio: 2, sort: 'change', num: true, w: 200, html: true, cell: (l) => peE(l.dr_minor ? peMoney(l.dr_minor) + ' ' + tx('Dr') : peMoney(l.cr_minor) + ' ' + tx('Cr')) },
      { key: 'after', label: tx('Stock after'), prio: 4, sort: 'after', num: true, w: 190, html: true, cell: (l) => peE(bkDrCr(l.running_minor)) },
    ],
    search: (l) => [l.date, l.ref, l.what].join(' '),
    sorts: [{ key: 'date', label: tx('Newest first'), cmp: (a, b) => String(b.date).localeCompare(String(a.date)) }],
    empty: { title: tx('No counts yet') },
  });
}
async function peStockSave(btn) {
  const date = peVal('ps_date'), v = bkMoneyMinor(peVal('ps_val'));
  if (!date || isNaN(v)) return peBad('ps_out', tx('Enter the month end and the value of the stock on hand.'));
  const body = { date, value_minor: v, method: 'manual', client_ref: peRef('stock') };
  if (peVal('ps_nrv')) { const n = bkMoneyMinor(peVal('ps_nrv')); if (isNaN(n)) return peBad('ps_out', tx('The lower value must be an amount.')); body.nrv_minor = n; }
  await bkOnce('pe-stock', btn, async () => {
    try {
      const r = await api('perStock', { body });
      PE.ref.stock = null;
      peOk('ps_out', r && r.entry_no ? peE(txf('Saved · {no}', { no: r.entry_no })) : peE(tx((r && r.why) || 'Saved')));
      peStockList();
    } catch (e) { peBad('ps_out', e); }
  });
}

/* ═══ 2 · ASSETS & DEPRECIATION ═════════════════════════════════════════════════════════════════════════════════════════
   GET /assets → the register; POST /assets (by hand); POST /assets/:id/dispose; POST /depreciation/run { fy } → one entry, and the basis it used.
   The classes are the India pack's (the server refuses another and names them). */
const PE_CLASSES = [['buildings', 'Buildings'], ['plant', 'Plant & machinery'], ['furniture', 'Furniture'], ['vehicles', 'Vehicles'], ['office', 'Office equipment'], ['computers', 'Computers']];
const PE_CLASS_WORD = PE_CLASSES.reduce((m, c) => { m[c[0]] = c[1]; return m; }, {});
const PE_BASIS = { it_act_wdv: 'Income-tax WDV', schedule_ii: 'Schedule II' };
const PE_ENTITY = { proprietor: 'proprietor', partnership: 'partnership', llp: 'LLP', huf: 'HUF', trust: 'trust', company: 'company' };
async function peAssetsView(body) {
  if (!peOwner()) { body.innerHTML = peNoOwner('Only the owner sees the asset register'); return; }
  body.innerHTML = '<div class="supacts pe-bar">' + peBtn('pa-add-open', '＋ Add an asset', 'peAssetForm()') + peBtn('pa-dep-open', 'Run depreciation', 'peDepForm()', '') + '</div>'
    + '<div id="pa_form" class="pe-slot"></div><div id="pa_out" class="pe-slot"></div><div id="bkl_assets" data-testid="assets-list"></div>';
  await peAssetsList();
}
async function peAssetsList() {
  const host = peEl('bkl_assets'); if (!host) return;
  let r;
  try { r = await api('perAssets'); } catch (e) { const w = peWhy(e, tx('Could not be read')); host.innerHTML = '<div class="' + (w.calm ? 'pe-calm' : 'pe-bad') + '" data-testid="pe-refused">' + (w.calm ? '⏳ ' : '') + peE(w.text) + '</div>'; return; }
  PE.assets = (r && r.assets) || [];
  const net = (r && r.net_block) || [];
  CBList.reset && CBList.reset('assets');
  CBList.mount(host, {
    key: 'assets', t: tx, rows: () => PE.assets, id: (a) => a.asset_id, rowTid: (a) => 'asset-' + a.asset_id,
    head: () => ({ chips: [{ tid: 'pa-total', text: tx('Written-down value') + ' ' + peMoney(r.total_wdv_minor) }],
      notices: net.filter((c) => c.agrees === false).map((c) => ({ cls: 'bad', tid: 'pa-differs-' + c.asset_class, text: txf('{c}: the register and the Ledger differ', { c: tx(PE_CLASS_WORD[c.asset_class] || c.asset_class) }) })) }),
    columns: [
      { key: 'name', label: tx('Asset'), prio: 1, sort: 'name', w: 240, html: true, cell: (a) => peE(a.name) + (a.disposed_on ? ' <span class="optchip" data-testid="asset-sold-' + peE(a.asset_id) + '">' + peE(tx('Sold')) + '</span>' : '') },
      { key: 'class', label: tx('Kind'), prio: 4, sort: 'class', w: 170, html: true, cell: (a) => peE(tx(PE_CLASS_WORD[a.asset_class] || a.asset_class)) },
      { key: 'cost', label: tx('Cost'), prio: 3, sort: 'cost', num: true, w: 150, html: true, cell: (a) => peE(peMoney(a.cost_minor)) },
      { key: 'use', label: tx('Put to use'), prio: 5, sort: 'use', w: 140, html: true, cell: (a) => peE(bkDate(a.put_to_use)) },
      { key: 'wdv', label: tx('Written-down value'), prio: 2, sort: 'wdv', num: true, w: 190, html: true, cell: (a) => peE(peMoney(a.wdv_minor)) },
    ],
    search: (a) => [a.name, a.asset_class, PE_CLASS_WORD[a.asset_class]].join(' '),
    sorts: [{ key: 'name', label: tx('Name'), cmp: (a, b) => String(a.name).localeCompare(String(b.name)) }, { key: 'cost', label: tx('Cost'), cmp: (a, b) => a.cost_minor - b.cost_minor },
      { key: 'wdv', label: tx('Written-down value'), cmp: (a, b) => a.wdv_minor - b.wdv_minor }, { key: 'use', label: tx('Put to use'), cmp: (a, b) => String(a.put_to_use).localeCompare(String(b.put_to_use)) },
      { key: 'class', label: tx('Kind'), cmp: (a, b) => String(a.asset_class).localeCompare(String(b.asset_class)) }],
    actions: [{ id: 'dispose', icon: '↗', label: 'Sold or scrapped', tid: 'pa-dispose', when: (a) => !a.disposed_on, run: (a) => peSellForm(a.asset_id) }],
    empty: { title: tx('No assets yet') },
  });
}
function peAssetForm() {
  PE.ref.asset = PE.ref.asset || bkRef();
  peEl('pa_form').innerHTML = '<div class="pe-card" data-testid="pa-form"><div class="pe-form">'
    + peField('pa_name', 'What is it?', peInput('pa_name', '', tx('e.g. Display fridge')))
    + peField('pa_class', 'Kind', peSel('pa_class', PE_CLASSES, 'furniture'))
    + peField('pa_cost', 'Cost', peAmt('pa_cost'))
    + peField('pa_date', 'Bought on', peInput('pa_date', peYmd(new Date()), '', 'date'))
    + peField('pa_use', 'Put to use on (if later)', peInput('pa_use', '', '', 'date'))
    + peField('pa_how', 'Paid from', peSel('pa_how', peMODES, 'bank'))
    + '</div><div class="supacts">' + peBtn('pa-save', 'Add asset', 'peAssetSave(this)') + peBtn('pa-cancel', 'Cancel', 'peEl(\'pa_form\').innerHTML=\'\'', '') + '</div><div id="pa_fout" class="pe-slot"></div></div>';
}
async function peAssetSave(btn) {
  const cost = bkMoneyMinor(peVal('pa_cost'));
  if (!peVal('pa_name') || isNaN(cost)) return peBad('pa_fout', tx('Name the asset and say what it cost.'));
  const body = { name: peVal('pa_name'), class: peVal('pa_class'), cost_minor: cost, date: peVal('pa_date'), how: peVal('pa_how'), client_ref: PE.ref.asset };
  if (peVal('pa_use')) body.put_to_use = peVal('pa_use');
  await bkOnce('pe-asset', btn, async () => {
    try {
      const r = await api('perAssetAdd', { body });
      PE.ref.asset = null; peEl('pa_form').innerHTML = '';
      peOk('pa_out', peE(txf('Asset added · {no}', { no: (r && r.entry_no) || '' })));
      peAssetsList();
    } catch (e) { peBad('pa_fout', e); }
  });
}
function peSellForm(id) {
  PE.ref['sell' + id] = PE.ref['sell' + id] || bkRef();
  const a = (PE.assets || []).filter((x) => x.asset_id === id)[0] || {};
  peEl('pa_form').innerHTML = '<div class="pe-card" data-testid="pa-sell-form"><div class="pe-sub">' + peE(a.name || '') + '</div><div class="pe-form">'
    + peField('pd_date', 'Sold or scrapped on', peInput('pd_date', peYmd(new Date()), '', 'date'))
    + peField('pd_get', 'What it fetched (empty if scrapped)', peAmt('pd_get', '', tx('Leave empty if scrapped')))
    + peField('pd_into', 'Money came into', peSel('pd_into', peMODES, 'bank'))
    + '</div><div class="supacts">' + peBtn('pd-save', 'Save', 'peSellSave(this,\'' + peE(id) + '\')') + peBtn('pd-cancel', 'Cancel', 'peEl(\'pa_form\').innerHTML=\'\'', '') + '</div><div id="pd_out" class="pe-slot"></div></div>';
  peEl('pa_form').scrollIntoView && peEl('pa_form').scrollIntoView({ block: 'nearest' });
}
async function peSellSave(btn, id) {
  const body = { date: peVal('pd_date'), into: peVal('pd_into'), client_ref: PE.ref['sell' + id] };
  if (peVal('pd_get')) { const m = bkMoneyMinor(peVal('pd_get')); if (isNaN(m)) return peBad('pd_out', tx('What it fetched must be an amount.')); body.proceeds_minor = m; }
  await bkOnce('pe-sell-' + id, btn, async () => {
    try {
      const r = await api('perAssetSell', { params: { id }, body });
      PE.ref['sell' + id] = null; peEl('pa_form').innerHTML = '';
      peOk('pa_out', peE(txf('Saved · {no}', { no: (r && r.entry_no) || '' })));
      peAssetsList();
    } catch (e) { peBad('pd_out', e); }
  });
}
async function peDepForm() {
  let L; try { L = await bkPeriodsLoad(); } catch (e) { return peBad('pa_out', e); }
  const prev = (() => { const y = Number(bkFyNow().slice(0, 4)) - 1; return y + '-' + String((y + 1) % 100).padStart(2, '0'); })();
  const years = L.years.slice(); if (years.indexOf(prev) < 0) years.push(prev); years.sort().reverse();
  peEl('pa_form').innerHTML = '<div class="pe-card" data-testid="pdp-form"><div class="pe-form">'
    + peField('pdp_fy', 'Financial year', peSel('pdp_fy', years.map((y) => [y, y]), prev, ' onchange="peDepLabel()"'))
    + '</div><div class="supacts"><button type="button" class="supact-pri" id="pdp_run" data-testid="pdp-run" onclick="peDepRun(this)"></button>'
    + peBtn('pdp-cancel', 'Cancel', 'peEl(\'pa_form\').innerHTML=\'\'', '') + '</div><div id="pdp_out" class="pe-slot"></div></div>';
  peDepLabel();
}
function peDepLabel() { const b = peEl('pdp_run'); if (b) b.textContent = txf('Run depreciation for {fy}', { fy: peVal('pdp_fy') }); }
async function peDepRun(btn) {
  const fy = peVal('pdp_fy');
  await bkOnce('pe-dep', btn, async () => {
    try {
      const r = await api('perDepRun', { body: { fy, client_ref: peRef('dep' + fy) } }) || {};
      PE.ref['dep' + fy] = null;
      const basis = (PE_ENTITY[r.entity_basis] || r.entity_basis || '') + ': ' + tx(PE_BASIS[r.basis_rule] || 'as set for this shop');
      let h = '<div class="pe-basis" data-testid="pdp-basis">' + peE(txf('Basis used — {b}', { b: basis })) + '</div>';
      if (r.entity_note) h += '<div class="pe-warn" data-testid="pdp-note">⚠ ' + peE(r.entity_note) + '</div>';
      if (r.nothing_to_post) h += '<div class="pe-note" data-testid="pdp-nothing">' + peE(r.why || tx('Nothing to depreciate')) + '</div>';
      else if (r.duplicate) h += '<div class="pe-note" data-testid="pdp-dup">' + peE(txf('Already run for {fy} · {no}', { fy, no: r.entry_no || '' })) + '</div>';
      else h += '<div class="pe-ok" data-testid="pdp-done">✓ ' + peE(txf('Depreciation for {fy} saved · {no}', { fy, no: r.entry_no || '' })) + '</div>';
      if ((r.by_class || []).length) h += '<div class="pe-rows" data-testid="pdp-classes">' + r.by_class.map((c) => '<div class="pe-row"><span>' + peE(tx(PE_CLASS_WORD[c.class] || c.class)) + '</span><span class="mono">' + peE(c.rate) + '%</span><span class="mono">' + peE(CBLocale.money(Number(c.amount), bkCur())) + '</span></div>').join('') + '</div>';
      peEl('pdp_out').innerHTML = h;
      peAssetsList();
    } catch (e) { peBad('pdp_out', e); }
  });
}

/* ═══ 3 · ACCRUALS & RECURRING ═════════════════════════════════════════════════════════════════════════════════════════
   Repeating entries: CRUD /recurring, post or skip a due one. Accruals: POST /accruals (comes back on the first day of the next month), POST /accruals/:ref/reverse.
   There is no list of accruals on the API yet: the page shows the ones that are DUE to turn back (the To-do feed's own list) and the ones made in this visit. */
const PE_FREQ = [['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
const PE_ACCR = [['outstanding', 'Owed, not yet paid'], ['prepaid', 'Paid in advance'], ['accrued_income', 'Earned, not yet received'], ['income_in_advance', 'Received in advance']];
async function peAccrualsView(body) {
  if (!peOwner()) { body.innerHTML = peNoOwner('Only the owner sees repeating entries and accruals'); return; }
  body.innerHTML = '<div class="tabs" role="tablist">'
    + [['rec', 'Repeating'], ['acc', 'Accruals']].map((t) => '<button type="button" class="pe-tab" role="tab" data-testid="pr-tab-' + t[0] + '" aria-pressed="' + (PE.tab === t[0]) + '" onclick="peAccrTab(\'' + t[0] + '\')">' + peE(tx(t[1])) + '</button>').join('') + '</div>'
    + '<div id="pr_body"></div>';
  peAccrPaint();
}
function peAccrTab(t) { PE.tab = t; document.querySelectorAll('[data-testid^="pr-tab-"]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-testid') === 'pr-tab-' + t))); peAccrPaint(); }
function peAccrPaint() { const b = peEl('pr_body'); if (!b) return; if (PE.tab === 'acc') peAccrBody(b); else peRecBody(b); }

async function peEntryKinds() {
  if (PE.kinds) return PE.kinds;
  const r = await api('booksEvents');
  const picks = (r && r.picks) || {};
  PE.picks = picks;
  PE.kinds = ((r && r.events) || []).filter((e) => e.preview !== false && !e.route && e.kind !== 'journal' && (e.fields || []).length);
  return PE.kinds;
}
function peKindFields(kind) {
  const ev = (PE.kinds || []).filter((e) => e.kind === kind)[0]; if (!ev) return '';
  return (ev.fields || []).map((f) => typeof f === 'string' ? { key: f, kind: f } : f).filter((f) => f.key !== 'date').map((f) => {
    const id = 'prf_' + f.key, lab = f.label || ({ class: 'What for', paid_from: 'Paid from', into: 'Came into', from: 'Taken from', to: 'Put into', amount: 'How much', narration: 'Note' })[f.key] || f.key;
    if (f.kind === 'amount') return peField(id, lab, peAmt(id));
    if (f.kind === 'pick') {
      const opts = f.pick === 'mode' ? peMODES : ((PE.picks || {})[f.pick] || []).map((o) => [o.role || o.code, o.name]);
      return peField(id, lab, peSel(id, [['', 'Choose…']].concat(opts), ''));
    }
    return peField(id, lab, peInput(id, '', ''));
  }).join('');
}
function peRecKind() {
  const k = peVal('pr_kind'); const box = peEl('pr_kfields'); if (box) box.innerHTML = k ? peKindFields(k) : '';
}
async function peRecBody(b) {
  b.innerHTML = '<div class="supacts pe-bar">' + peBtn('pr-add-open', '＋ New repeating entry', 'peRecForm()') + '</div><div id="pr_form" class="pe-slot"></div><div id="pr_out" class="pe-slot"></div><div id="bkl_rec" data-testid="recurring-list"></div>';
  await peRecList();
}
async function peRecList() {
  const host = peEl('bkl_rec'); if (!host) return;
  try { PE.rec = peList(await api('perRecList'), 'recurring'); }
  catch (e) { const w = peWhy(e, tx('Could not be read')); host.innerHTML = '<div class="' + (w.calm ? 'pe-calm' : 'pe-bad') + '" data-testid="pe-refused">' + (w.calm ? '⏳ ' : '') + peE(w.text) + '</div>'; return; }
  const today = peYmd(new Date()), isDue = (t) => t.active && t.next_on && t.next_on <= today;
  CBList.reset && CBList.reset('recurring');
  CBList.mount(host, {
    key: 'recurring', t: tx, rows: () => PE.rec, id: (t) => t.recurring_id, rowTid: (t) => 'rec-' + t.recurring_id,
    head: () => ({ notices: PE.rec.filter(isDue).length ? [{ cls: 'warn', tid: 'pr-due', text: txf('{n} due', { n: PE.rec.filter(isDue).length }) }] : [] }),
    columns: [
      { key: 'name', label: tx('Name'), prio: 1, sort: 'name', w: 230, html: true, cell: (t) => peE(t.name) + (t.active ? '' : ' <span class="optchip">' + peE(tx('Stopped')) + '</span>') },
      { key: 'next', label: tx('Next'), prio: 2, sort: 'next', w: 190, html: true, cell: (t) => t.next_on ? peE(bkDate(t.next_on)) + (isDue(t) ? ' <span class="optchip" data-testid="rec-due-' + peE(t.recurring_id) + '">' + peE(tx('Due')) + '</span>' : '') : '—' },
      { key: 'freq', label: tx('How often'), prio: 3, sort: 'freq', w: 160, html: true, cell: (t) => peE(tx((PE_FREQ.filter((f) => f[0] === t.frequency)[0] || [0, t.frequency])[1])) },
      { key: 'what', label: tx('What'), prio: 4, sort: 'what', w: 170, html: true, cell: (t) => peE(tx(((t.event || {}).kind || (t.event || {}).type || '').replace(/_/g, ' '))) },
      { key: 'auto', label: tx('Posts'), prio: 5, sort: 'auto', w: 160, html: true, cell: (t) => peE(tx(t.auto ? 'By itself' : 'When I accept')) },
    ],
    search: (t) => [t.name, t.frequency, t.next_on, (t.event || {}).kind].join(' '),
    sorts: [{ key: 'next', label: tx('Next due'), cmp: (a, b) => String(a.next_on).localeCompare(String(b.next_on)) }, { key: 'name', label: tx('Name'), cmp: (a, b) => String(a.name).localeCompare(String(b.name)) },
      { key: 'freq', label: tx('How often'), cmp: (a, b) => String(a.frequency).localeCompare(String(b.frequency)) }],
    actions: [
      { id: 'post', icon: '✓', label: 'Post it', tid: 'rec-post', when: isDue, run: (t) => peRecDo('perRecPost', t, 'Posted') },
      { id: 'skip', icon: '⤼', label: 'Skip this one', tid: 'rec-skip', when: isDue, run: (t) => peRecDo('perRecSkip', t, 'Skipped') },
      { id: 'auto', icon: '⚙', label: 'Post by itself / ask me', tid: 'rec-auto', when: (t) => t.active, run: (t) => peRecAuto(t) },
      { id: 'stop', icon: '■', label: 'Stop it', tid: 'rec-stop', when: (t) => t.active, run: (t) => peRecStop(t) },
    ],
    empty: { title: tx('No repeating entries yet') },
  });
}
async function peRecDo(key, t, word) {
  await bkOnce('pe-rec-' + key + t.recurring_id, null, async () => {
    try {
      const r = await api(key, { params: { id: t.recurring_id }, body: {} }) || {};
      const no = r.posted && (r.posted.entry_no || r.posted.no);
      peOk('pr_out', peE(tx(word)) + (no ? ' · ' + peE(no) : '') + ' — ' + peE(t.name));
      peRecList();
    } catch (e) { peBad('pr_out', e); }
  });
}
async function peRecAuto(t) {
  await bkOnce('pe-rec-auto' + t.recurring_id, null, async () => {
    try { await api('perRecPatch', { params: { id: t.recurring_id }, body: { auto: !t.auto } }); peOk('pr_out', peE(tx(!t.auto ? 'It will post by itself' : 'It will ask you each time'))); peRecList(); }
    catch (e) { peBad('pr_out', e); }
  });
}
function peRecStop(t) {
  confirmAsk(tx('Stop this repeating entry?'), peE(txf('{n} stops. What it already posted stays.', { n: t.name })), tx('Stop it'), async () => {
    try { await api('perRecStop', { params: { id: t.recurring_id } }); peOk('pr_out', peE(txf('{n} stopped', { n: t.name }))); peRecList(); }
    catch (e) { peBad('pr_out', e); }
  }, true);
}
async function peRecForm() {
  try { await peEntryKinds(); } catch (e) { return peBad('pr_out', e); }
  PE.ref.rec = PE.ref.rec || bkRef();
  peEl('pr_form').innerHTML = '<div class="pe-card" data-testid="pr-form"><div class="pe-form">'
    + peField('pr_name', 'Name', peInput('pr_name', '', tx('e.g. Shop rent')))
    + peField('pr_kind', 'What happens', peSel('pr_kind', [['', 'Choose…']].concat(PE.kinds.map((e) => [e.kind, e.words || e.kind])), '', ' onchange="peRecKind()"'))
    + '<div id="pr_kfields" class="pe-sub-form"></div>'
    + peField('pr_freq', 'How often', peSel('pr_freq', PE_FREQ, 'monthly'))
    + peField('pr_next', 'First one on', peInput('pr_next', peYmd(new Date()), '', 'date'))
    + peField('pr_end', 'Last one on (optional)', peInput('pr_end', '', '', 'date'))
    + peField('pr_auto', 'Posts', peSel('pr_auto', [['0', 'When I accept'], ['1', 'By itself']], '0'))
    + '</div><div class="supacts">' + peBtn('pr-save', 'Save', 'peRecSave(this)') + peBtn('pr-cancel', 'Cancel', 'peEl(\'pr_form\').innerHTML=\'\'', '') + '</div><div id="pr_fout" class="pe-slot"></div></div>';
}
async function peRecSave(btn) {
  const kind = peVal('pr_kind'); if (!peVal('pr_name') || !kind) return peBad('pr_fout', tx('Name it and say what happens each time.'));
  const ev = { kind };
  const fields = ((PE.kinds || []).filter((e) => e.kind === kind)[0] || {}).fields || [];
  for (const f0 of fields) {
    const f = typeof f0 === 'string' ? { key: f0, kind: f0 } : f0; if (f.key === 'date') continue;
    const v = peVal('prf_' + f.key); if (!v) continue;
    if (f.kind === 'amount') { const m = bkMoneyMinor(v); if (isNaN(m)) return peBad('pr_fout', tx('The amount must be a number.')); ev.amount_minor = m; } else ev[f.key] = v;
  }
  const body = { name: peVal('pr_name'), event: ev, frequency: peVal('pr_freq'), next_on: peVal('pr_next'), auto: peVal('pr_auto') === '1' };
  if (peVal('pr_end')) body.end_on = peVal('pr_end');
  await bkOnce('pe-rec-add', btn, async () => {
    try { await api('perRecAdd', { body }); PE.ref.rec = null; peEl('pr_form').innerHTML = ''; peOk('pr_out', peE(txf('{n} saved', { n: body.name }))); peRecList(); }
    catch (e) { peBad('pr_fout', e); }
  });
}

/* accruals */
async function peAccrBody(b) {
  b.innerHTML = '<div class="supacts pe-bar">' + peBtn('pc-add-open', '＋ New accrual', 'peAccrForm()') + '</div><div id="pc_form" class="pe-slot"></div><div id="pc_out" class="pe-slot"></div><div id="bkl_accr" data-testid="accruals-list"></div>';
  let due = [];
  try { const t = peList(await api('booksTodo'), 'items').filter((i) => i.kind === 'accrual_reversals_due')[0]; due = (t && t.items) || []; } catch (_) {}
  const seen = {}; PE.accr.forEach((a) => { seen[a.ref] = 1; });
  PE.accrDue = due.map((d) => ({ ref: d.ref, kind: '', reverses_on: d.due, posted_on: d.posted_on, due: true }));
  PE.accrDue.forEach((d) => { if (seen[d.ref]) { const m = PE.accr.filter((a) => a.ref === d.ref)[0]; m.due = true; } });
  peAccrList();
}
const peAccrRows = () => PE.accr.concat((PE.accrDue || []).filter((d) => !PE.accr.some((a) => a.ref === d.ref)));
function peAccrList() {
  const host = peEl('bkl_accr'); if (!host) return;
  const today = peYmd(new Date()), due = (a) => a.reverses_on && a.reverses_on <= today && !a.reversed;
  CBList.reset && CBList.reset('accruals');
  CBList.mount(host, {
    key: 'accruals', t: tx, rows: peAccrRows, id: (a) => a.ref, rowTid: (a) => 'accr-' + a.ref,
    head: () => ({ notices: peAccrRows().filter(due).length ? [{ cls: 'warn', tid: 'pc-due', text: txf('{n} due to turn back', { n: peAccrRows().filter(due).length }) }] : [] }),
    columns: [
      { key: 'ref', label: tx('Reference'), prio: 1, sort: 'ref', w: 200, html: true, cell: (a) => '<span class="mono">' + peE(a.ref) + '</span>' },
      { key: 'kind', label: tx('Kind'), prio: 3, sort: 'kind', w: 220, html: true, cell: (a) => a.kind ? peE(tx((PE_ACCR.filter((k) => k[0] === a.kind)[0] || [0, a.kind])[1])) : '—' },
      { key: 'back', label: tx('Turns back on'), prio: 2, sort: 'back', w: 190, html: true, cell: (a) => peE(bkDate(a.reverses_on)) + (a.reversed ? ' <span class="optchip">' + peE(tx('Turned back')) + '</span>' : due(a) ? ' <span class="optchip" data-testid="accr-due-' + peE(a.ref) + '">' + peE(tx('Due')) + '</span>' : '') },
      { key: 'no', label: tx('Entry'), prio: 4, sort: 'no', w: 150, html: true, cell: (a) => a.entry_no ? '<span class="mono">' + peE(a.entry_no) + '</span>' : '—' },
    ],
    search: (a) => [a.ref, a.kind, a.entry_no].join(' '),
    sorts: [{ key: 'back', label: tx('Turns back on'), cmp: (a, b) => String(a.reverses_on).localeCompare(String(b.reverses_on)) }, { key: 'ref', label: tx('Reference'), cmp: (a, b) => String(a.ref).localeCompare(String(b.ref)) }],
    actions: [{ id: 'rev', icon: '↩', label: 'Turn it back now', tid: 'accr-reverse', when: due, run: (a) => peAccrRev(a) }],
    empty: { title: tx('Nothing due to turn back') },
  });
}
async function peAccrForm() {
  try { await peEntryKinds(); } catch (e) { return peBad('pc_out', e); }
  PE.ref.accr = PE.ref.accr || bkRef();
  const cls = ((PE.picks || {}).expense_class || []).map((o) => [o.code || o.role, o.name]).concat(((PE.picks || {}).income_class || []).map((o) => [o.code || o.role, o.name]));
  peEl('pc_form').innerHTML = '<div class="pe-card" data-testid="pc-form"><div class="pe-form">'
    + peField('pc_ref', 'Reference', peInput('pc_ref', '', tx('e.g. ELEC-2026-09')))
    + peField('pc_kind', 'Kind', peSel('pc_kind', PE_ACCR, 'outstanding'))
    + peField('pc_class', 'Which expense or income', peSel('pc_class', [['', 'Choose…']].concat(cls), ''))
    + peField('pc_amt', 'How much', peAmt('pc_amt'))
    + peField('pc_date', 'At month end', peInput('pc_date', peMonthEnd(1), '', 'date'))
    + '</div><div class="supacts">' + peBtn('pc-save', 'Save', 'peAccrSave(this)') + peBtn('pc-cancel', 'Cancel', 'peEl(\'pc_form\').innerHTML=\'\'', '') + '</div><div id="pc_fout" class="pe-slot"></div></div>';
}
async function peAccrSave(btn) {
  const m = bkMoneyMinor(peVal('pc_amt'));
  if (!peVal('pc_ref') || !peVal('pc_class') || isNaN(m)) return peBad('pc_fout', tx('Give it a reference, pick the expense or income, and say how much.'));
  const body = { ref: peVal('pc_ref'), kind: peVal('pc_kind'), class: peVal('pc_class'), amount_minor: m, date: peVal('pc_date'), client_ref: PE.ref.accr };
  await bkOnce('pe-accr', btn, async () => {
    try {
      const r = await api('perAccrue', { body }) || {};
      PE.ref.accr = null; peEl('pc_form').innerHTML = '';
      PE.accr = PE.accr.filter((a) => a.ref !== body.ref).concat([{ ref: body.ref, kind: body.kind, reverses_on: r.reverses_on, entry_no: r.entry_no }]);
      peOk('pc_out', peE(txf('Saved · {no} · turns back on {d}', { no: r.entry_no || '', d: bkDate(r.reverses_on) })));
      peAccrList();
    } catch (e) { peBad('pc_fout', e); }
  });
}
async function peAccrRev(a) {
  await bkOnce('pe-accr-rev' + a.ref, null, async () => {
    try {
      const r = await api('perAccrueRev', { params: { ref: a.ref }, body: { client_ref: 'accr-rev-' + a.ref } }) || {};
      PE.accr.forEach((x) => { if (x.ref === a.ref) x.reversed = true; });
      PE.accrDue = (PE.accrDue || []).filter((x) => x.ref !== a.ref);
      peOk('pc_out', peE(txf('Turned back · {no}', { no: r.entry_no || '' })));
      peAccrList();
    } catch (e) { peBad('pc_out', e); }
  });
}

/* ═══ 4 · GST CLOSE & PAY ═══════════════════════════════════════════════════════════════════════════════════════════════
   POST /gst/close { fy, period } → { utilised: [{ from, against, amount_minor }], payable_minor{cgst_minor…}, rcm_minor?, cash_minor?, carried_minor, pay_total_minor, entry_no }
   POST /gst/pay { fy, period, amounts, rcm, bank, challan_no } — a slip of the finger is caught by the server against what is owed. */
async function peGstView(body) {
  if (!peOwner()) { body.innerHTML = peNoOwner('Only the owner closes and pays GST'); return; }
  let L; try { L = await bkPeriodsLoad(); } catch (e) { body.innerHTML = '<div class="pe-bad">' + bkErr(e) + '</div>'; return; }
  const last = peMonthEnd(1), lastP = (Number(last.slice(5, 7)) + 8) % 12 + 1;    /* April = 1 … March = 12 */
  const lastFy = (() => { const y = Number(last.slice(5, 7)) >= 4 ? Number(last.slice(0, 4)) : Number(last.slice(0, 4)) - 1; return y + '-' + String((y + 1) % 100).padStart(2, '0'); })();
  const years = L.years.slice(); if (years.indexOf(lastFy) < 0) years.push(lastFy); years.sort().reverse();
  body.innerHTML = '<div class="pe-card" data-testid="pg-form"><div class="pe-form">'
    + peField('pg_fy', 'Financial year', peSel('pg_fy', years.map((y) => [y, y]), lastFy))
    + peField('pg_p', 'Month', peSel('pg_p', BK_MONTHS.map((m, i) => [String(i + 1), m]), String(lastP)))
    + '</div><div class="supacts">' + peBtn('pg-close', 'Close the month', 'peGstClose(this)') + '</div><div id="pg_out" class="pe-slot"></div></div><div id="pg_res"></div>';
}
function peGstSetOff(r) {
  const used = r.utilised || [];
  let h = '<div class="pe-card" data-testid="pg-setoff"><div class="pe-sub">' + peE(tx('Credit used')) + '</div>';
  h += used.length ? '<div class="pe-rows">' + used.map((u, i) => '<div class="pe-row" data-testid="pg-used-' + i + '"><span>' + peE(String(u.from).toUpperCase()) + ' → ' + peE(String(u.against).toUpperCase()) + '</span><span class="mono">' + peE(peMoney(u.amount_minor)) + '</span></div>').join('') + '</div>'
    : '<div class="pe-note" data-testid="pg-nouse">' + peE(tx('No credit was used')) + '</div>';
  if (r.rcm_minor) {
    h += '<div class="pe-sub">' + peE(tx('Reverse charge — paid in cash')) + '</div><div class="pe-rows">'
      + ['cgst', 'sgst', 'igst'].filter((k) => r.rcm_minor[k]).map((k) => '<div class="pe-row" data-testid="pg-rcm-' + k + '"><span>' + k.toUpperCase() + '</span><span class="mono">' + peE(peMoney(r.rcm_minor[k])) + '</span></div>').join('') + '</div>';
  }
  h += '<div class="pe-sub">' + peE(tx('To pay by challan')) + '</div><div class="pe-rows">'
    + peHeads.filter((k) => (r.payable_minor || {})[k + '_minor']).map((k) => '<div class="pe-row" data-testid="pg-pay-' + k + '"><span>' + k.toUpperCase() + '</span><span class="mono">' + peE(peMoney(r.payable_minor[k + '_minor'])) + '</span></div>').join('') + '</div>';
  h += '<div class="pe-total" data-testid="pg-total"><span>' + peE(tx('Payable')) + '</span><span class="mono">' + peE(peMoney(r.pay_total_minor)) + '</span></div></div>';
  return h;
}
async function peGstClose(btn) {
  const fy = peVal('pg_fy'), period = Number(peVal('pg_p'));
  await bkOnce('pe-gst-close', btn, async () => {
    try {
      const r = await api('perGstClose', { body: { fy, period, client_ref: 'gstclose-' + fy + '-' + period } }) || {};
      PE.gst = Object.assign({ fy, period }, r);
      let h = peGstSetOff(r);
      if (r.duplicate) h = '<div class="pe-note" data-testid="pg-dup">' + peE(txf('Already closed · {no}', { no: r.entry_no || '' })) + '</div>' + h;
      else if (r.nothing_to_set_off) h = '<div class="pe-note" data-testid="pg-nothing">' + peE(tx('Nothing to set off this month')) + '</div>' + h;
      else h = '<div class="pe-ok" data-testid="pg-closed">✓ ' + peE(txf('Month closed · {no}', { no: r.entry_no || '' })) + '</div>' + h;
      if (r.pay_total_minor > 0) h += peGstPayForm(r);
      peEl('pg_res').innerHTML = h; peEl('pg_out').innerHTML = '';
    } catch (e) { peBad('pg_out', e); peEl('pg_res').innerHTML = ''; }
  });
}
function peGstPayForm(r) {
  const heads = peHeads.filter((k) => (r.payable_minor || {})[k + '_minor']), rc = ['cgst', 'sgst', 'igst'].filter((k) => (r.rcm_minor || {})[k]);
  return '<div class="pe-card" data-testid="pg-pay-form"><div class="pe-form">'
    + peField('pgp_bank', 'Paid from', peSel('pgp_bank', peMODES, 'bank'))
    + peField('pgp_ch', 'Challan number', peInput('pgp_ch', '', tx('The CPIN on the challan')))
    + heads.map((k) => peField('pgp_' + k, k.toUpperCase(), peAmt('pgp_' + k, peText(r.payable_minor[k + '_minor'])))).join('')
    + rc.map((k) => peField('pgr_' + k, k.toUpperCase() + ' · ' + tx('reverse charge'), peAmt('pgr_' + k, peText(r.rcm_minor[k])))).join('')
    + '</div><div class="supacts">' + peBtn('pg-pay', 'Pay', 'peGstPay(this)') + '</div><div id="pgp_out" class="pe-slot"></div></div>';
}
async function peGstPay(btn) {
  const g = PE.gst || {}, amounts = {}, rcm = {};
  for (const k of peHeads) { const e = peEl('pgp_' + k); if (e) { const m = bkMoneyMinor(e.value); if (isNaN(m)) return peBad('pgp_out', tx('Each amount must be a number.')); amounts[k + '_minor'] = m; } }
  for (const k of ['cgst', 'sgst', 'igst']) { const e = peEl('pgr_' + k); if (e) { const m = bkMoneyMinor(e.value); if (isNaN(m)) return peBad('pgp_out', tx('Each amount must be a number.')); rcm[k + '_minor'] = m; } }
  if (!peVal('pgp_ch')) return peBad('pgp_out', tx('Give the challan number (the CPIN).'));
  const body = { fy: g.fy, period: g.period, amounts, bank: peVal('pgp_bank'), challan_no: peVal('pgp_ch') };
  if (Object.keys(rcm).length) body.rcm = rcm;
  await bkOnce('pe-gst-pay', btn, async () => {
    try { const r = await api('perGstPay', { body }) || {}; peOk('pgp_out', peE(txf('Paid · {no}', { no: r.entry_no || '' }))); }
    catch (e) { peBad('pgp_out', e); }
  });
}

/* ═══ 5 · YEAR CLOSE ═══════════════════════════════════════════════════════════════════════════════════════════════════
   GET /year/:fy/status → { fiscal_year, closed, can_close, refusals: [{ name, why }], months: [{ period, status }], next } — what a close would say, nothing written
   POST /year/:fy/close → { ok, next, locked, opening } · refused (422) with the refusals in plain words */
async function peYearView(body) {
  let L; try { L = await bkPeriodsLoad(); } catch (e) { body.innerHTML = '<div class="pe-bad">' + bkErr(e) + '</div>'; return; }
  const prev = (() => { const y = Number(bkFyNow().slice(0, 4)) - 1; return y + '-' + String((y + 1) % 100).padStart(2, '0'); })();
  const years = L.years.slice(); if (years.indexOf(prev) < 0) years.push(prev); years.sort().reverse();
  body.innerHTML = '<div class="pe-card"><div class="pe-form">' + peField('py_fy', 'Financial year', peSel('py_fy', years.map((y) => [y, y]), prev, ' onchange="peYearStatus()"')) + '</div></div><div id="py_res" data-testid="py-res"></div>';
  peYearStatus();
}
/** the page's fix for a failing check: where to go (the check's own sentence says what is wrong) */
function peYearFix(x) {
  const s = (x.name || '') + ' ' + (x.why || '');
  if (/month|lock/i.test(s)) return { label: tx('Open Month lock'), tab: 'lock' };
  if (/suspense/i.test(s)) return { label: tx('Open the Day book'), tab: 'daybook' };
  if (/balance|trial/i.test(s)) return { label: tx('Open Trial balance'), tab: 'tb' };
  return null;
}
async function peYearStatus() {
  const fy = peVal('py_fy'), host = peEl('py_res'); if (!host) return;
  host.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + peE(tx('Reading…')) + '</div>';
  let st;
  try { st = await api('perYearStatus', { params: { fy } }) || {}; }
  catch (e) { const w = peWhy(e, tx('Could not be read')); host.innerHTML = '<div class="' + (w.calm ? 'pe-calm' : 'pe-bad') + '" data-testid="pe-refused">' + (w.calm ? '⏳ ' : '') + peE(w.text) + '</div>'; return; }
  PE.year = st;
  const months = st.months || [], open = months.filter((m) => m.status === 'open').length, refs = st.refusals || [];
  let h = '<div class="pe-card" data-testid="py-checks">';
  if (st.closed) h += '<div class="pe-ok" data-testid="py-closed">✓ ' + peE(txf('{fy} is closed for good', { fy })) + '</div>';
  else {
    const notLocked = open + Math.max(0, 12 - months.length);
    h += '<div class="pe-check ' + (notLocked ? 'bad' : 'ok') + '" data-testid="py-months"><span>' + (notLocked ? '✗' : '✓') + '</span><span>'
      + peE(notLocked ? txf('{n} of 12 months are not locked yet', { n: notLocked }) : tx('Every month is locked')) + '</span>'
      + (notLocked ? '<button type="button" class="pe-fix" data-testid="py-fix-months" onclick="show(\'lock\')">' + peE(tx('Open Month lock')) + '</button>' : '') + '</div>';
    h += refs.map((x, i) => { const f = peYearFix(x); return '<div class="pe-check bad" data-testid="py-check-' + i + '"><span>✗</span><span>' + peE(x.why) + '</span>'
      + (f ? '<button type="button" class="pe-fix" data-testid="py-fix-' + i + '" onclick="show(\'' + f.tab + '\')">' + peE(f.label) + '</button>' : '') + '</div>'; }).join('');
    if (!refs.length) h += '<div class="pe-check ok" data-testid="py-rest"><span>✓</span><span>' + peE(tx('Nothing else stands in the way')) + '</span></div>';
  }
  h += '</div>';
  if (!st.closed && peOwner()) h += '<div class="supacts">' + '<button type="button" class="supact-pri" data-testid="py-close"' + (st.can_close ? '' : ' disabled') + ' onclick="peYearClose(this)">' + peE(tx('Close the year')) + '</button></div>';
  if (!st.closed && !peOwner()) h += peNote('pe-readonly', 'Only the owner can close the year');
  h += '<div id="py_out" class="pe-slot"></div>';
  host.innerHTML = h;
}
function peYearClose(btn) {
  const fy = peVal('py_fy');
  confirmAsk(tx('Close the year?'), peE(txf('{fy} is carried forward and locked for good. This cannot be undone.', { fy })), tx('Close the year'), () => {
    bkOnce('pe-year-' + fy, btn, async () => {
      try {
        const r = await api('perYearClose', { params: { fy }, body: {} }) || {};
        peOk('py_out', peE(txf('{fy} closed · carried to {next}', { fy, next: r.next || '' })));
        const b = document.querySelector('[data-testid="py-close"]'); if (b) b.remove();
      } catch (e) { peBad('py_out', e); }
    });
  }, true);
}
