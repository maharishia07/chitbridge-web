/* cap-entry.js — ＋ ENTRY on the Day book: what happened → with whom / what → how much, when, on what paper → check and save.
 * Contract: docs/design/manual-entry/REQUIREMENT.md; the server's shapes: chitbridge-api routes/books.js (GET /events · POST /preview · POST /events · POST /entries/:id/reverse) and lib/books-manual.js. Loaded by accounts.html after cap-books.js; the Day book offers the ＋ only when
 * enOpen exists (cap-books.js bkDvHead), and offers Reverse on a row through CBList's own `actions`.
 *
 * ⭐ THE PAGE HOLDS NO RULES AND COMPUTES NO MONEY. The events, their words, icons, fields and save routes are GET /api/books/events;
 * the journal (lines, each line's type and the golden rule that placed it, the voucher, balanced or not, every refusal and warning with
 * its fix) is POST /api/books/preview. This file asks, shows what the server said, and enables Save only when the server said
 * `balanced` and refused nothing. A typed amount is parsed to minor units (bkToMinor) and sent; no figure is ever added up here.
 * ⭐ One tap, one record: the sheet carries ONE client_ref from the moment it opens (bkRef), the Save button is dead while its call is out
 * (bkOnce) — the same two halves cap-books.js uses for payments.
 * ⭐ Never "accounting" on a screen. Insert-only: a saved entry is never edited — Reverse adds the mirror.
 * Look: the chit sheet's own popup (a <dialog>, same tokens), the Day book's own line rows (CBList.nextRow). No new style of list.
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  booksEvents:    { m: 'GET',  p: '/api/books/events' },
  booksPreview:   { m: 'POST', p: '/api/books/preview' },
  booksEventPost: { m: 'POST', p: '/api/books/events' },             /* ONE save door for every event (the server's own composition); `event` names which */
  booksReverse:   { m: 'POST', p: '/api/books/entries/:id/reverse' },
}); }

/* the server names a band, an icon and a pick; the page only gives them words and a glyph (display, never a rule) */
var EN_BAND = { paid: 'Paid', received: 'Received', owner: 'The owner', staff: 'Staff', money: 'Money moves', adjust: 'Your own journal' };
var EN_ICON = { receipt: '🧾', coins: '🪙', 'wallet-in': '👛', 'wallet-out': '💸', 'person-out': '🧑', 'person-in': '🧑', swap: '🔁', pen: '✍️' };
var EN_MODE = { cash: 'Cash', bank: 'Bank', upi: 'UPI', card: 'Card' };
var EN_LABEL = { class: 'What for', paid_from: 'Paid from', into: 'Came into', from: 'Taken from', to: 'Put into', ledger: 'Which staff ledger', amount: 'How much', date: 'Date', narration: 'Note' };
var EN = { step: 1, events: null, ev: null, v: {}, lines: [], pv: null, pvBusy: false, dateRef: null, ref: null, saved: null, err: null, denied: false, photo: null, rev: {}, seq: 0 };
/* the four kinds of "who / what" field live on step 2; the rest are step 3 — a layout choice, never a rule of the books. A field may name its own step. */
var EN_STEP2 = { party: 1, ledger: 1, bank: 1, asset_class: 1, loan: 1, lines: 1, choice: 1 };

function enE(v) { return typeof esc === 'function' ? esc(v) : String(v == null ? '' : v).replace(/[<>"&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c]; }); }
function enCss() {
  if (document.getElementById('en_css')) return;
  var s = document.createElement('style'); s.id = 'en_css';
  s.textContent = '#entrysheet{border:0;padding:0;margin:auto;width:min(620px,100vw);max-width:100vw;height:min(760px,94dvh);border-radius:14px;background:var(--card,#fff);color:var(--ink,#0F2E3D);box-shadow:var(--shadow,0 12px 34px rgba(15,46,61,.2));overflow:hidden}'
    + '#entrysheet[open]{display:flex;flex-direction:column}#entrysheet::backdrop{background:rgba(15,46,61,.45)}'
    + '#entrysheet .en-top{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 14px;border-bottom:1px solid var(--line,#E7E2D8);font-size:var(--fs-3,14px);font-weight:700}#entrysheet .en-top span{flex:1}'
    + '#entrysheet .en-top button{cursor:pointer;min-width:44px;min-height:44px;border:0;background:none;font-size:var(--fs-4,16px);color:inherit}'
    + '#entrysheet .en-body{padding:12px 14px;overflow:auto;flex:1;min-height:0;overscroll-behavior:contain;font-size:var(--fs-2,12.5px)}'
    + '#entrysheet .en-dots{display:flex;gap:6px;padding:8px 14px 0}#entrysheet .en-dots i{flex:1;height:4px;border-radius:2px;background:var(--line,#E7E2D8)}#entrysheet .en-dots i.on{background:var(--ink,#0F2E3D)}'
    + '#entrysheet h3{margin:4px 0 10px;font-size:var(--fs-4,16px)}#entrysheet .en-sec{margin:12px 0 6px;font-size:var(--fs-1,11px);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--grey,#494F56)}'
    + '#entrysheet .en-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}'
    + '#entrysheet .en-tile{cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:84px;padding:8px 6px;border:1px solid var(--line,#E7E2D8);border-radius:12px;background:var(--card,#fff);color:inherit;font:inherit;font-weight:600;text-align:center}'
    + '#entrysheet .en-tile .ic{font-size:26px;line-height:1}#entrysheet .en-tile:hover,#entrysheet .en-tile:focus-visible{background:var(--gold-soft,#F7F1E4)}'
    + '#entrysheet label.en-f{display:block;margin:0 0 12px;font-weight:600}#entrysheet label.en-f>span{display:block;margin-bottom:4px;color:var(--grey,#494F56);font-size:var(--fs-1,11px)}'
    + '#entrysheet .en-f input,#entrysheet .en-f select,#entrysheet .en-ln input,#entrysheet .en-ln select{width:100%;box-sizing:border-box;min-height:44px;padding:0 10px;border:1px solid var(--line,#E7E2D8);border-radius:9px;background:var(--card,#fff);color:inherit;font:inherit}'
    + '#entrysheet .en-ln{display:grid;grid-template-columns:minmax(0,1fr) 84px minmax(0,96px) 44px;gap:6px;margin-bottom:8px}'
    + '#entrysheet .en-bad{margin:6px 0 12px;padding:8px 10px;border:1px solid var(--red-b,#E8B7A6);background:var(--red-t,#FBEDE8);color:var(--red-i,#8E3517);border-radius:8px}'
    + '#entrysheet .en-warn{margin:6px 0 12px;padding:8px 10px;border:1px solid var(--gold-line,#E8D9BC);background:var(--gold-soft,#F7F1E4);border-radius:8px}'
    + '#entrysheet .en-bad button,#entrysheet .en-warn button{cursor:pointer;display:block;margin-top:6px;min-height:44px;padding:0 14px;border:1px solid currentColor;border-radius:9px;background:none;color:inherit;font:inherit;font-weight:700}'
    + '#entrysheet .en-chip{display:inline-block;border:1px solid var(--line,#E7E2D8);border-radius:99px;padding:1px 8px;font-size:var(--fs-1,11px);font-weight:600}'
    + '#entrysheet .en-why{color:var(--grey,#494F56);font-size:var(--fs-1,11px);padding:0 0 8px;border-bottom:1px dashed var(--line,#E7E2D8)}'
    + '#entrysheet .en-ok{color:var(--ok,#27794c);font-weight:700}'
    + '#entrysheet .en-acts{display:flex;gap:8px;justify-content:space-between;padding:8px 14px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line,#E7E2D8);background:var(--paper,#FAF8F4)}'
    + '#entrysheet .en-btn{cursor:pointer;min-height:44px;padding:0 18px;border:1px solid var(--line,#E7E2D8);border-radius:9px;background:transparent;color:inherit;font:inherit;font-weight:700}'
    + '#entrysheet .en-btn.pri{background:var(--green,#16693F);border-color:var(--green,#16693F);color:#fff}#entrysheet .en-btn:disabled{opacity:.45;cursor:default}';
  document.head.appendChild(s);
}
function enDlg() {
  var d = document.getElementById('entrysheet'); if (d) return d;
  enCss();
  d = document.createElement('dialog'); d.id = 'entrysheet'; d.setAttribute('aria-label', tx('New entry'));
  d.innerHTML = '<div class="en-top"><span data-testid="en-title"></span><button type="button" data-testid="en-close" aria-label="' + enE(tx('Close')) + '" onclick="enClose()">✕</button></div><div class="en-dots" id="en_dots"></div><div class="en-body" id="en_body"></div><div class="en-acts" id="en_acts"></div>';
  d.addEventListener('close', function () { try { document.documentElement.style.overflow = ''; } catch (_) {} });
  d.addEventListener('click', function (e) { if (e.target === d) enClose(); });
  document.body.appendChild(d);
  return d;
}
function enClose() { var d = document.getElementById('entrysheet'); if (d && d.open) d.close(); try { document.documentElement.style.overflow = ''; } catch (_) {} }

/* ── the one door ── */
async function enOpen() {
  var d = enDlg();
  EN.step = 1; EN.ev = null; EN.v = {}; EN.lines = []; EN.pv = null; EN.dateRef = null; EN.saved = null; EN.err = null; EN.denied = false; EN.photo = null; EN.ref = bkRef();
  enPaint();
  try { document.documentElement.style.overflow = 'hidden'; } catch (_) {}
  if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  try {
    var rr = await Promise.all([api('booksEvents'), api('booksAccounts').catch(function () { return { accounts: [] }; }), typeof booksDuesLoad === 'function' ? booksDuesLoad(false).catch(function () {}) : null]);
    EN.picks = (rr[0] && rr[0].picks) || {}; EN.accounts = (rr[1] && rr[1].accounts) || [];
    /* the events that POST /events can preview and save; the ones with a route of their own (asset, loan …) are not offered on this sheet */
    EN.events = ((rr[0] && rr[0].events) || []).filter(function (e) { return e.preview !== false && !e.route; }).map(enNorm);
  } catch (e) { if (e && (e.status === 403 || /not allowed|forbidden|403/i.test(String(e.message)))) EN.denied = true; else EN.err = bkWhy(e, tx('Could not be read')); }
  enPaint();
}

/** the server's event → the page's: id = kind, label = words, group = its band's words, icon = a glyph for the server's icon name */
function enNorm(e) { return Object.assign({}, e, { id: e.kind, label: e.words || e.label || e.kind, group: EN_BAND[e.band] || e.group || '', icon: EN_ICON[e.icon] || e.icon || '＋', fields: e.fields || [] }); }
/** a field's kind as the page lays it out: pick → ledger / mode / class by what the server says it picks */
function enKind(f) { return f.kind === 'pick' ? (f.pick === 'ledger' ? 'ledger' : 'pick') : f.kind; }

/* ── paint ── */
function enSteps() { return EN.ev && enFields(2).length === 0 ? [1, 3, 4] : [1, 2, 3, 4]; }
function enFields(step) {
  if (!EN.ev) return [];
  return (EN.ev.fields || []).map(function (f) { return typeof f === 'string' ? { key: f, kind: f } : f; }).filter(function (f) {
    return (f.step ? Number(f.step) : (EN_STEP2[enKind(f)] || (f.kind === 'pick' && f.pick !== 'mode') ? 2 : 3)) === step;
  });
}
function enStepWord(n) { return { 1: 'What happened?', 2: EN.ev && EN.ev.kind === 'journal' ? 'Which lines?' : 'With whom / what?', 3: EN.ev && EN.ev.kind === 'journal' ? 'When, on what paper?' : 'How much, when, on what paper?', 4: 'Check and save' }[n]; }
function enPaint() {
  var body = document.getElementById('en_body'), acts = document.getElementById('en_acts'), dots = document.getElementById('en_dots'); if (!body) return;
  var T = document.querySelector('#entrysheet [data-testid="en-title"]');
  if (T) T.textContent = EN.saved ? tx('Saved') : EN.ev ? tx(EN.ev.label) : tx('New entry');
  var order = enSteps();
  dots.innerHTML = EN.saved || EN.denied ? '' : order.map(function (n) { return '<i class="' + (n <= EN.step ? 'on' : '') + '"></i>'; }).join('');
  if (EN.denied) { body.innerHTML = '<div class="en-warn" data-testid="en-denied">' + enE(tx('Only the owner and co-assists the owner has allowed can add entries. You can read everything.')) + '</div>'; acts.innerHTML = '<button class="en-btn" onclick="enClose()">' + enE(tx('Close')) + '</button>'; return; }
  if (EN.err) { body.innerHTML = '<div class="en-bad" data-testid="en-err">' + enE(EN.err) + '<button type="button" data-testid="en-retry" onclick="enOpen()">' + enE(tx('Try again')) + '</button></div>'; acts.innerHTML = ''; return; }
  if (!EN.events) { body.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + enE(tx('Reading…')) + '</div>'; acts.innerHTML = ''; return; }
  if (EN.saved) return enPaintSaved(body, acts);
  var h = '<h3 data-testid="en-step-' + EN.step + '">' + enE(tx(enStepWord(EN.step))) + '</h3>';
  if (EN.step === 1) { body.innerHTML = h + enGridHTML(); acts.innerHTML = '<button class="en-btn" onclick="enClose()">' + enE(tx('Cancel')) + '</button>'; return; }
  if (EN.step === 4) { body.innerHTML = h + enPreviewHTML(); }
  else body.innerHTML = h + enFormHTML(EN.step);
  enActs();
}
function enActs() {
  var acts = document.getElementById('en_acts'), last = EN.step === 4, pv = EN.pv, can = enCanSave();
  acts.innerHTML = '<button class="en-btn" data-testid="en-back" onclick="enBack()">‹ ' + enE(tx('Back')) + '</button>'
    + (last ? '<button class="en-btn pri" data-testid="en-save" id="en_save" onclick="enSave(this)"' + (can ? '' : ' disabled') + '>' + enE(tx('Save')) + '</button>'
            : '<button class="en-btn pri" data-testid="en-next" id="en_next" onclick="enNext()"' + (enStepReady(EN.step) ? '' : ' disabled') + '>' + enE(tx('Next')) + ' ›</button>');
}
/* Save is on only when the SERVER said the journal balances and refused nothing — the page never works that out itself */
function enCanSave() { var pv = EN.pv; return !!(pv && pv.balanced === true && !(pv.refusals || []).length && !EN.pvBusy && !EN.saving); }
function enGridHTML() {
  var groups = [], by = {};
  EN.events.forEach(function (ev) { var g = ev.group || ''; if (!by[g]) { by[g] = []; groups.push(g); } by[g].push(ev); });
  if (!EN.events.some(function (e) { return e.kind === 'journal'; })) { if (!by['']) { by[''] = []; groups.push(''); } by[''].push(enJournalEv()); }
  /* the journal tile is the LAST tile, wherever the server listed it */
  var last = null;
  groups.forEach(function (g) { by[g] = by[g].filter(function (e) { if (e.kind === 'journal') { last = e; return false; } return true; }); });
  return groups.map(function (g, gi) {
    var tiles = by[g].concat(gi === groups.length - 1 && last ? [last] : []);
    return '<div class="en-sec">' + enE(g ? tx(g) : tx('Your own journal')) + '</div>' + '<div class="en-grid">' + tiles.map(function (ev) {
      return '<button type="button" class="en-tile" data-testid="en-event-' + enE(ev.id) + '" onclick="enPick(\'' + enE(ev.id) + '\')"><span class="ic" aria-hidden="true">' + enE(ev.icon || '＋') + '</span><span>' + enE(tx(ev.label)) + '</span></button>';
    }).join('') + '</div>';
  }).join('');
}
/* the free journal is the one tile the page may supply itself when the server's list has none: its fields are the CA's own (lines, date, paper, note) */
function enJournalEv() { return { id: 'journal', kind: 'journal', icon: '✍️', label: 'Write a journal', fields: [{ key: 'lines', kind: 'lines', required: true }, { key: 'narration', kind: 'text', required: true }, { key: 'date', kind: 'date' }] }; }
function enPick(id) {
  var ev = EN.events.filter(function (e) { return e.id === id; })[0];
  if (!ev && id === 'journal') ev = enJournalEv();
  if (!ev) return;
  EN.ev = ev; EN.v = { date: bkToday() }; EN.pv = null; EN.dateRef = null; EN.photo = null;
  if (ev.kind === 'journal') EN.lines = [{ code: '', side: 'dr', amt: '' }, { code: '', side: 'cr', amt: '' }];
  EN.step = enSteps()[1]; enPaint();
}
function enBack() { var o = enSteps(), i = o.indexOf(EN.step); EN.step = i > 0 ? o[i - 1] : 1; EN.pv = null; enPaint(); }
function enNext() { var o = enSteps(), i = o.indexOf(EN.step); if (!enStepReady(EN.step) || i < 0) return; EN.step = o[i + 1]; enPaint(); if (EN.step === 4) enPreview(); }

/* ── the fields ── */
function enOptions(f) {
  if (f.kind === 'pick' && f.pick !== 'ledger' && !(f.options && f.options.length)) return ((EN.picks || {})[f.pick] || []).map(function (o) { return { v: o.role || o.code, l: o.name }; });
  if (f.options && f.options.length) return f.options.map(function (o) { return typeof o === 'object' ? o : { v: o, l: tx(EN_MODE[o] || o) }; }).map(function (o) { return { v: o.v != null ? o.v : o.code, l: o.l || o.label || o.name || o.v }; });
  if (f.kind === 'party') {
    /* the one /dues read the whole page shares (cap-books.js booksDuesLoad → BK.dues, party_id → party) */
    var ps = Object.keys(BK.dues || {}).map(function (k) { return BK.dues[k]; });
    return ps.filter(function (p) { return !f.side || p.side === f.side; }).map(function (p) { return { v: p.party_id, l: bkPartyLabel(p.party_id, p.name) }; });
  }
  return [];
}
/** a ledger the shop added itself (the chart carries no role on it) — the server still refuses one outside Loans and advances, in words */
function enShopLedger(code) { var a = (EN.accounts || []).filter(function (x) { return String(x.code) === String(code); })[0]; return !!a && !a.role; }
function enLedgerSelect(id, cur, onch, onlyGroup) {
  var bands = bkLtModel(EN.accounts || []), h = '<option value="">' + enE(tx('Choose…')) + '</option>';
  bands.forEach(function (b) {
    var gs = b.groups.filter(function (g) { return !onlyGroup || g.title === onlyGroup; }); var inner = '', own = onlyGroup === 'Stock & advances';
    gs.forEach(function (g) { g.accts.forEach(function (a) { if (own && !enShopLedger(a.code)) return; inner += '<option value="' + enE(a.code) + '"' + (a.code === cur ? ' selected' : '') + '>' + enE(a.code + ' · ' + a.name) + '</option>'; }); });
    if (inner) h += '<optgroup label="' + enE(tx(b.title)) + '">' + inner + '</optgroup>';
  });
  return '<select id="' + id + '" onchange="' + onch + '">' + h + '</select>';
}
function enFieldHTML(f) {
  var k = f.key, v = EN.v[k] == null ? '' : EN.v[k], lab = tx(f.label || EN_LABEL[k] || ({ party: 'Who', ledger: 'Which ledger', bank: 'Which bank', asset_class: 'What kind', loan: 'Which loan', amount: 'How much', date: 'Date', paid_by: 'Paid by', doc_no: 'Bill / receipt no.', photo: 'Photo of the paper', narration: 'Note', text: k })[f.kind] || k), tid = 'en-f-' + k;
  var wrap = function (inner) { return '<label class="en-f"><span>' + enE(lab) + '</span>' + inner + '</label>'; };
  var on = 'enSet(\'' + enE(k) + '\',this.value)';
  if (f.kind === 'pick' && f.pick === 'ledger') return '<label class="en-f"><span>' + enE(lab) + '</span>' + enLedgerSelect(tid, v, on, 'Stock & advances').replace('<select ', '<select data-testid="' + tid + '" ')  + '</label>';
  if (f.kind === 'pick') return wrap(enSelect(tid, enOptions(f), v, on));
  if (f.kind === 'ledger') return '<label class="en-f"><span>' + enE(lab) + '</span>' + enLedgerSelect(tid, v, on).replace('<select ', '<select data-testid="' + tid + '" ') + '</label>';
  if (f.kind === 'bank') return '<label class="en-f"><span>' + enE(lab) + '</span>' + (enOptions(f).length ? enSelect(tid, enOptions(f), v, on) : enLedgerSelect(tid, v, on, 'Cash & bank').replace('<select ', '<select data-testid="' + tid + '" ')) + '</label>';
  if (f.kind === 'party' || f.kind === 'asset_class' || f.kind === 'loan' || f.kind === 'choice') { var o = enOptions(f); return o.length ? wrap(enSelect(tid, o, v, on)) : wrap('<input data-testid="' + tid + '" value="' + enE(v) + '" oninput="' + on + '">'); }
  if (f.kind === 'amount') return wrap('<input data-testid="' + tid + '" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + enE(v) + '" oninput="' + on + '" onchange="enCheckDate()">');
  if (f.kind === 'date') return wrap('<input data-testid="' + tid + '" type="date" value="' + enE(v) + '" onchange="enSet(\'date\',this.value);enCheckDate()">') + '<div id="en_dateref">' + enRefusalHTML(EN.dateRef) + '</div>';
  if (f.kind === 'paid_by') {
    var m = (f.options && f.options.length ? enOptions(f) : [{ v: 'cash', l: tx('Cash') }, { v: 'bank', l: tx('Bank') }, { v: 'upi', l: tx('UPI') }, { v: 'cheque', l: tx('Cheque') }]);
    return wrap(enSelect(tid, m, v, 'enSet(\'paid_by\',this.value);enPaintKeep()')) + (v === 'cheque' ? '<label class="en-f"><span>' + enE(tx('Cheque no.')) + '</span><input data-testid="en-f-cheque_no" value="' + enE(EN.v.cheque_no || '') + '" oninput="enSet(\'cheque_no\',this.value)"></label><label class="en-f"><span>' + enE(tx('Cheque date')) + '</span><input data-testid="en-f-cheque_date" type="date" value="' + enE(EN.v.cheque_date || '') + '" onchange="enSet(\'cheque_date\',this.value)"></label>' : '');
  }
  if (f.kind === 'photo') return wrap('<input data-testid="' + tid + '" type="file" accept="image/*,application/pdf" onchange="enPhoto(this)">') + (EN.photo ? '<div class="en-why" data-testid="en-photo-name">📎 ' + enE(EN.photo.name) + '</div>' : '');
  if (f.kind === 'lines') return enLinesHTML();
  return wrap('<input data-testid="' + tid + '" value="' + enE(v) + '" oninput="' + on + '">');
}
function enSelect(id, opts, cur, onch) { return '<select data-testid="' + id + '" onchange="' + onch + '"><option value="">' + enE(tx('Choose…')) + '</option>' + opts.map(function (o) { return '<option value="' + enE(o.v) + '"' + (String(o.v) === String(cur) ? ' selected' : '') + '>' + enE(o.l) + '</option>'; }).join('') + '</select>'; }
function enFormHTML(step) { return enFields(step).map(enFieldHTML).join('') || '<div class="en-why">' + enE(tx('Nothing to ask here')) + '</div>'; }
function enSet(k, v) { EN.v[k] = v; EN.pv = null; var b = document.getElementById('en_next'); if (b) b.disabled = !enStepReady(EN.step); }
function enPaintKeep() { enPaint(); }
function enStepReady(step) {
  return enFields(step).every(function (f) {
    if (f.kind === 'date') return !!EN.v.date && !(EN.dateRef && EN.dateRef.length);
    if (f.required === false || f.kind === 'photo' || f.kind === 'narration' || f.kind === 'doc_no') return !(f.kind === 'doc_no' && f.required);
    if (f.kind === 'lines') return EN.lines.length >= 2 && EN.lines.every(function (l) { return l.code && String(l.amt).trim() !== ''; });
    if (f.kind === 'amount') return String(EN.v[f.key] || '').trim() !== '';
    if (f.kind === 'paid_by') return !!EN.v.paid_by && (EN.v.paid_by !== 'cheque' || !!EN.v.cheque_no);
    return String(EN.v[f.key] == null ? '' : EN.v[f.key]).trim() !== '';
  });
}
function enPhoto(inp) {
  var f = inp.files && inp.files[0]; if (!f) { EN.photo = null; return; }
  if (f.size > 6 * 1024 * 1024) { toast(f.name + ' ' + tx('is over 6MB — skipped.')); inp.value = ''; return; }
  var r = new FileReader(); r.onload = function () { EN.photo = { name: f.name, type: f.type, data: String(r.result) }; enPaint(); }; r.readAsDataURL(f);
}

/* ── the journal's own lines (the CA's door): ledger · Dr/Cr · amount. The server says whether they balance. ── */
function enLinesHTML() {
  return '<div class="en-sec">' + enE(tx('Lines')) + '</div>' + EN.lines.map(function (l, i) {
    return '<div class="en-ln" data-testid="en-line-' + i + '">' + enLedgerSelect('en_lc' + i, l.code, 'enLine(' + i + ',\'code\',this.value)').replace('<select ', '<select data-testid="en-line-code-' + i + '" ')
      + '<select data-testid="en-line-side-' + i + '" onchange="enLine(' + i + ',\'side\',this.value)"><option value="dr"' + (l.side === 'dr' ? ' selected' : '') + '>Dr</option><option value="cr"' + (l.side === 'cr' ? ' selected' : '') + '>Cr</option></select>'
      + '<input data-testid="en-line-amt-' + i + '" inputmode="decimal" placeholder="0.00" value="' + enE(l.amt) + '" oninput="enLine(' + i + ',\'amt\',this.value)">'
      + '<button type="button" class="en-btn" style="padding:0" aria-label="' + enE(tx('Remove')) + '" data-testid="en-line-del-' + i + '" onclick="enLineDel(' + i + ')"' + (EN.lines.length <= 2 ? ' disabled' : '') + '>✕</button></div>';
  }).join('') + '<button type="button" class="en-btn" data-testid="en-line-add" onclick="enLineAdd()">＋ ' + enE(tx('Add a line')) + '</button>';
}
function enLine(i, k, v) { EN.lines[i][k] = v; EN.pv = null; var b = document.getElementById('en_next'); if (b) b.disabled = !enStepReady(EN.step); }
function enLineAdd() { EN.lines.push({ code: '', side: 'dr', amt: '' }); enPaint(); }
function enLineDel(i) { if (EN.lines.length > 2) EN.lines.splice(i, 1); enPaint(); }

/* ── the server's journal ── */
/* the app's api() refuses a second POST to the same route while one is out, so the page asks one preview at a time and the newest answer wins (EN.seq) */
function enAsk(body) { var go = function () { return api('booksPreview', { body: body }); }; var p = (EN.q || Promise.resolve()).then(go, go); EN.q = p.catch(function () {}); return p; }
function enBody() {
  var b = { event: EN.ev.kind || EN.ev.id };
  Object.keys(EN.v).forEach(function (k) { if (EN.v[k] !== '' && EN.v[k] != null) b[k] = EN.v[k]; });
  if (EN.v.amount != null && EN.v.amount !== '') { b.amount_minor = bkToMinor(EN.v.amount); delete b.amount; }
  if (EN.ev.kind === 'journal') b.lines = EN.lines.map(function (l) { var o = { code: l.code }; o[l.side === 'cr' ? 'cr_minor' : 'dr_minor'] = bkToMinor(l.amt); return o; });
  return b;
}
/** the server's refusals are plain sentences (and `code` for the first); give each a button back to the form. Nothing here decides anything. */
function enWords(list, code, dateStep) {
  return (list || []).map(function (m, i) {
    var c = i === 0 && code ? code : null, msg = typeof m === 'object' && m ? m.message : m;
    return { code: c || (typeof m === 'object' && m && m.code) || 'R' + i, message: String(msg), fix: c === 'PERIOD_LOCKED' ? { label: tx('Pick another date'), step: dateStep || 3, focus: 'date' } : { label: tx('Change it'), step: enSteps()[1] } };
  });
}
function enSeen(r) {
  r = r || {};
  return { balanced: r.balanced === true, voucher: r.voucher ? { series: r.voucher.series, kind: r.voucher.type } : null, currency: r.currency, narration: r.narration,
    lines: (r.lines || []).map(function (l) { return Object.assign({}, l, { name: l.ledger || l.name }); }),
    refusals: enWords(r.refusals, r.code), warnings: enWords(r.flags || r.warnings, null).map(function (w, i) { return Object.assign(w, { code: 'FLAG' + i }); }) };
}
async function enPreview() {
  var seq = ++EN.seq; EN.pvBusy = true; EN.err = null; enPaint2();
  try { var r = await enAsk(enBody()); if (seq !== EN.seq) return; EN.pv = enSeen(r); }
  catch (e) { if (seq !== EN.seq) return; EN.pv = { balanced: false, refusals: [{ code: 'READ', message: bkWhy(e, tx('Could not check this entry')), fix: { label: tx('Try again'), retry: true } }], lines: [] }; }
  EN.pvBusy = false; enPaint2();
}
function enPaint2() { var b = document.getElementById('en_body'); if (!b) return; if (EN.step === 4) { b.innerHTML = '<h3 data-testid="en-step-4">' + enE(tx(enStepWord(4))) + '</h3>' + enPreviewHTML(); enActs(); } }
/* a locked month is refused the moment the date is picked: the server's answer, shown under the date */
async function enCheckDate() {
  var seq = ++EN.seq, d = EN.v.date; EN.dateRef = null;
  if (!EN.ev || !d) return;
  /* the server has no date-only question: it is asked with what is filled in so far, and only its "month is locked" answer is read here */
  try { var r = await enAsk(enBody()); if (seq !== EN.seq) return; EN.dateRef = r && r.code === 'PERIOD_LOCKED' ? enWords(r.refusals, r.code).slice(0, 1) : []; }
  catch (e) { if (seq !== EN.seq) return; EN.dateRef = [{ code: 'READ', message: bkWhy(e, tx('Could not check this date')), fix: { label: tx('Try again'), retry: true } }]; }
  var el = document.getElementById('en_dateref'); if (el) el.innerHTML = enRefusalHTML(EN.dateRef); var n = document.getElementById('en_next'); if (n) n.disabled = !enStepReady(EN.step);
}
function enFixGo(i, w) {
  var list = w === 'date' ? EN.dateRef : (EN.pv && EN.pv[w]); var x = list && list[i]; var f = (x && x.fix) || {};
  if (f.retry) { if (EN.step === 4) return enPreview(); return enCheckDate(); }
  EN.pv = null; EN.step = Number(f.step || 3); enPaint();
  if (f.focus) { var el = document.querySelector('[data-testid="en-f-' + f.focus + '"]'); if (el) el.focus(); }
}
/* every refusal and every warning carries a button that takes the person to the fix */
function enRefusalHTML(list, w) {
  w = w || 'date';
  return (list || []).map(function (x, i) { return '<div class="en-bad" data-testid="en-refusal-' + enE(x.code || i) + '">' + enE(x.message) + '<button type="button" data-testid="en-fix-' + enE(x.code || i) + '" onclick="enFixGo(' + i + ',\'' + w + '\')">' + enE((x.fix && x.fix.label) || tx('Change it')) + '</button></div>'; }).join('');
}
function enWarnHTML(list) {
  return (list || []).map(function (x, i) { return '<div class="en-warn" data-testid="en-warning-' + enE(x.code || i) + '">' + enE(x.message) + '<button type="button" data-testid="en-wfix-' + enE(x.code || i) + '" onclick="enFixGo(' + i + ',\'warnings\')">' + enE((x.fix && x.fix.label) || tx('Change it')) + '</button></div>'; }).join('');
}
function enLineHTML(l, c) {
  var rate = l.rate != null && l.rate !== '' ? ' ' + enE(String(l.rate)) + '%' : '';
  return '<div data-testid="en-pline-' + enE(l.code) + '">' + CBList.nextRow(['<span class="mono">' + enE(l.code) + '</span> ' + enE(l.name) + rate + (l.party_name ? ' · ' + enE(l.party_name) : ''),
      l.dr_minor ? enE(bkMoney(l.dr_minor, c)) : '', l.cr_minor ? enE(bkMoney(l.cr_minor, c)) : ''], [110, 110])
    + '<div class="en-why" data-testid="en-prule-' + enE(l.code) + '"><span class="en-chip" data-testid="en-ptype-' + enE(l.code) + '">' + enE(tx(l.type || '')) + '</span> ' + enE(l.rule || '') + '</div></div>';
}
function enPreviewHTML() {
  var pv = EN.pv; if (!pv) return '<div class="loadwrap"><span class="spin"></span> ' + enE(tx('Checking…')) + '</div>';
  var c = pv.currency, v = pv.voucher || {};
  var grey = 'color:var(--grey);font-size:var(--fs-1);text-transform:uppercase';
  return '<div style="margin-bottom:8px"><span class="en-chip" data-testid="en-voucher">' + enE((v.series || 'MJ') + (v.kind ? ' · ' + tx(v.kind) : '')) + '</span> '
    + (pv.balanced === true ? '<span class="en-ok" data-testid="en-balanced">✓ ' + enE(tx('Both sides match')) + '</span>' : '<b data-testid="en-unbalanced" style="color:var(--red-i,#8E3517)">' + enE(tx('The two sides do not match')) + '</b>') + '</div>'
    + enRefusalHTML(pv.refusals, 'refusals') + enWarnHTML(pv.warnings)
    + '<div style="' + grey + '">' + CBList.nextRow([enE(tx('Code')) + ' · ' + enE(tx('Ledger')), enE(tx('Debit')), enE(tx('Credit'))], [110, 110]) + '</div>'
    + (pv.lines || []).map(function (l) { return enLineHTML(l, c); }).join('')
    + (pv.narration ? '<div class="en-why" style="border:0;margin-top:8px">' + enE(pv.narration) + '</div>' : '');
}

/* ── save: one tap, one record ── */
async function enSave(btn) {
  if (!enCanSave() || !EN.ev) return;
  await bkOnce('entry-save', btn, async function () {
    EN.saving = true; var body = enBody(); body.client_ref = EN.ref; if (EN.photo) body.attachment = EN.photo;
    var key = 'booksEventPost';
    try {
      var r = await api(key, { body: body });
      EN.saved = r || {}; EN.saving = false; EN.ref = null;
      try { if (typeof bkHealthLoad === 'function') bkHealthLoad().catch(function () {}); if (typeof BK !== 'undefined' && BK.tab === 'daybook' && typeof bkTab === 'function') bkTab('daybook', true); } catch (_) {}
      enPaint();
    } catch (e) {
      EN.saving = false;
      EN.pv = Object.assign({}, EN.pv, { refusals: [{ code: 'SAVE', message: bkWhy(e, tx('Could not save this entry')), fix: { label: tx('Try again'), retry: true } }] });
      enPaint2();
    }
  });
}
function enPaintSaved(body, acts) {
  var s = EN.saved, no = s.entry_no || s.no || '';
  body.innerHTML = '<h3 data-testid="en-saved"><span class="en-ok">✓</span> ' + enE(tx('Saved')) + '</h3><div data-testid="en-saved-no" class="en-chip">' + enE(no) + '</div>'
    + '<div class="en-why" style="border:0;margin-top:10px">' + enE(tx('It is now in the Day book, Ledgers and Trial balance.')) + '</div>';
  acts.innerHTML = '<button class="en-btn" data-testid="en-reverse-now" onclick="enReverse(\'' + enE(s.entry_id || s.id || '') + '\',\'' + enE(no) + '\',true)">↩ ' + enE(tx('Reverse this entry')) + '</button>'
    + '<button class="en-btn pri" data-testid="en-done" onclick="enClose()">' + enE(tx('Done')) + '</button>';
}

/* ── Reverse this entry: a plain confirm, then the mirror entry (insert-only) ── */
function enReverse(id, no, fromSheet) {
  if (!id) return;
  confirmAsk(tx('Reverse this entry?'), enE(txf('{no} stays as it is. A new entry that cancels it is added.', { no: no || '' })), tx('Reverse'), function () {
    bkOnce('rev-' + id, null, async function () {
      EN.rev[id] = EN.rev[id] || bkRef();
      try {
        var r = await api('booksReverse', { params: { id: id }, body: { client_ref: EN.rev[id] } });
        delete EN.rev[id]; toast(txf('Reversed — new entry {no}', { no: (r && (r.entry_no || r.no)) || '' }));
        if (fromSheet) enClose();
        if (typeof BK !== 'undefined' && BK.tab === 'daybook') bkTab('daybook', true);
      } catch (e) { toast(bkWhy(e, tx('Could not reverse this entry'))); }
    });
  }, true);
}
