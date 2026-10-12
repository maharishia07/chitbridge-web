/* cap-finance-cash.js — CB Finance · Cash (round F3): today's cash and bank, then day by day what comes in and goes out for 7 or 30 days, and the FIRST
 * day it goes below zero — in one sentence on top. Loaded by finance.html after cap-finance.js. docs: C:/dev/CB-FINANCE-PLAN.md §4 F3.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): CBList.mount (the one list — the days ARE the table the chart's numbers live in; a11y) · CBList.nextRow (what
 * a day counts: the dues and cheques behind it) · head.notices (the sentence on top, as the Ledger's To-do strip) · bkMoney / bkDrCr / bkDate / bkToday /
 * bkPartyLabel (cap-books.js — M25 Dr/Cr words, the M36 money unit) · finOff (the ledger-off card with the owner's switch) · finDenied (the owner-only sentence,
 * greyed) · the page's .tabs/.tab pills (the 7/30 toggle) and .card (the chart's frame) — finance.html's own styles, no new look.
 * ⭐ ONE CALCULATION (rule 2): this file computes NO money. Opening, each day's in · out · running balance, the shortfall and every sentence are the
 * server's (GET /api/books/cashflow); the chart draws the server's balance_minor per day and the table shows the same figures. Nothing is added here.
 * ⭐ NEW PATHS (rule 4): FC (this tab's state) · FC_EP (the one new route) · fcChart (an inline SVG of the running balance — the owner-approved
 * bar/line; theme tokens only, every figure also in the table beneath) — nothing in the app drew a day-by-day balance before.
 * ⚠️ Never error.message on a screen: a failure says what happened and offers Try again. Finance SUGGESTS: there is no button here that posts.
 */
'use strict';

var FC = { gen: 0, days: 7, r: null, rows: [], state: 'loading', api: null };
var FC_EP = {
  booksCashflow: { m: 'GET', p: '/api/books/cashflow' },   /* owner · ?days=7|30 → the cash position (lib/books-cashflow.project) */
};
Object.assign(EP, FC_EP);
var FC_OWNER_ONLY = 'Only the owner may see the cash position.';
var FC_KIND = { due_in: 'Bill due', due_out: 'Bill to pay', cheque_in: 'Cheque in hand', cheque_out: 'Cheque written', gst: 'GST challan' };

function fcIsIn(it) { return /_in$/.test(String(it && it.kind)); }

async function fcLoad(quiet) {
  var g = ++FC.gen;
  if (!quiet) { FC.state = 'loading'; if (FC.api) FC.api.refresh(); }
  try {
    var r = await api('booksCashflow', { query: { days: String(FC.days) } });
    if (g !== FC.gen) return;
    FC.r = r; FC.rows = (r && r.series) || []; FC.state = 'ready';
  } catch (e) {
    if (g !== FC.gen) return;
    if (e && e.status === 404) { finOff(); return; }                       /* the Ledger is off for this shop (M212) */
    if (e && e.status === 403) { finDenied(FC_OWNER_ONLY); return; }      /* the server said who may see it */
    FC.state = 'error';
  }
  fcPaintTop();
  if (FC.api) FC.api.refresh();
}
function fcRetry() { fcLoad(); }
function fcDays(n) { if (FC.days === n) return; FC.days = n; fcPaintTop(); fcLoad(); }

/* ── the toggle and the chart: the frame is the page's own (.tabs pills · .card) ── */
function fcPaintTop() {
  var el = document.getElementById('fc_top'); if (!el) return;
  var pill = function (n) { return '<button type="button" class="tab" role="tab" aria-pressed="' + (FC.days === n ? 'true' : 'false') + '" data-testid="fc-days-' + n + '" onclick="fcDays(' + n + ')">' + esc(txn('{count} day', '{count} days', n)) + '</button>'; };
  el.innerHTML = '<div class="tabs" role="tablist" aria-label="' + esc(tx('How far ahead')) + '" style="margin:10px 20px 0">' + pill(7) + pill(30) + '</div>'
    + '<div class="card" id="fc_chart" data-testid="fc-chart" style="margin:10px 20px 6px;max-width:none;padding:12px 16px 10px"></div>';
  fcPaintChart();
}
/** the chart is drawn at the card's own width (one SVG unit = one CSS pixel, so no label is stretched); drawn again when the window changes size */
function fcPaintChart() {
  var box = document.getElementById('fc_chart'); if (!box) return;
  if (!(FC.state === 'ready' && FC.r)) { box.innerHTML = '<p class="hint">' + esc(FC.state === 'error' ? tx('Could not read your cash position.') : tx('Loading…')) + '</p>'; return; }
  box.innerHTML = fcChart(FC.r, Math.max(240, (box.clientWidth || 640) - 32));
}
window.addEventListener('resize', function () { clearTimeout(FC.rs); FC.rs = setTimeout(fcPaintChart, 150); });
/**
 * the running balance as bars, one per day (the server's balance_minor — drawn, never worked out here): the accent above zero, red below (a sale
 * at risk is the one red), a zero line, the day under every bar (every 5th on 30 days) and the lowest day labelled. The same numbers are the table.
 */
function fcChart(r, width) {
  var rows = r.series || [], n = rows.length; if (!n) return '';
  var cur = r.currency, vals = rows.map(function (d) { return Number(d.balance_minor || 0); });
  var hi = Math.max(0, Math.max.apply(null, vals)), lo = Math.min(0, Math.min.apply(null, vals)), span = (hi - lo) || 1;
  var W = width || 640, H = 150, top = 14, bottom = 22, plot = H - top - bottom, gap = 2, bw = Math.max(2, Math.floor(W / n) - gap), step = W / n;
  var y = function (v) { return top + (hi - v) / span * plot; }, y0 = y(0);
  var lowI = vals.indexOf(Math.min.apply(null, vals));
  var bars = rows.map(function (d, i) {
    var v = vals[i], x = i * step + (step - bw) / 2, h = Math.max(1, Math.abs(y(v) - y0)), yy = v >= 0 ? y0 - h : y0;
    var neg = v < 0, today = i === 0;
    return '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" rx="2" data-testid="fc-bar-' + esc(d.date) + '" data-neg="' + neg + '"'
      + ' style="fill:' + (neg ? 'var(--red,#C4562F)' : 'var(--accent,#1f5f5b)') + (today ? '' : ';opacity:.82') + '"><title>' + esc(bkDate(d.date) + ' · ' + bkDrCr(v, cur)) + '</title></rect>'
      + ((n <= 7 || i % 5 === 0 || i === n - 1) ? '<text x="' + (i * step + step / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" style="font:10px var(--mono,monospace);fill:var(--muted,#6f6450)">' + esc(String(d.date).slice(8, 10)) + '</text>' : '');
  }).join('');
  var lowX = lowI * step + step / 2, lowLabel = '<text x="' + lowX.toFixed(1) + '" y="' + (vals[lowI] < 0 ? Math.min(H - bottom - 2, y(vals[lowI]) + 11) : Math.max(10, y(vals[lowI]) - 4)).toFixed(1) + '" text-anchor="' + (lowX > W * 0.8 ? 'end' : lowX < W * 0.2 ? 'start' : 'middle') + '" data-testid="fc-low-label" style="font:600 11px var(--mono,monospace);fill:var(--ink,#2a2418)">' + esc(bkDrCr(vals[lowI], cur)) + '</text>';
  return '<div class="sec" style="display:flex;justify-content:space-between;gap:8px"><span>' + esc(tx('Running balance')) + '</span><span class="mono" data-testid="fc-opening">' + esc(tx('Today') + ' ' + bkDrCr(r.opening_minor, cur)) + '</span></div>'
    /* inline sizes: the page's icon rule (svg{width:18px;height:18px;stroke:currentColor}) would otherwise shrink the chart to an icon */
    + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(r.words || '') + '" style="display:block;width:100%;height:' + H + 'px;overflow:visible;stroke:none;fill:none">'
    + '<line x1="0" x2="' + W + '" y1="' + y0.toFixed(1) + '" y2="' + y0.toFixed(1) + '" style="stroke:var(--line-3,#d8ccb0);stroke-width:1"/>' + bars + lowLabel + '</svg>';
}

/* ── the table: the days — every figure is the server's ── */
function fcCols() {
  var c = function () { return (FC.r && FC.r.currency) || 'INR'; }, dash = '<span style="color:var(--grey)">—</span>';
  return [
    { key: 'date', label: tx('Day'), prio: 1, sort: 'date', w: 170, html: true, cell: function (d) { return '<span data-b="date">' + esc(bkDate(d.date)) + '</span>' + (d.date === bkToday() ? ' <span class="tag">' + esc(tx('Today')) + '</span>' : '') + (d.items.length ? '' : ' <span class="sub">' + esc(tx('quiet')) + '</span>'); } },
    { key: 'in', label: tx('Coming in'), prio: 3, num: true, w: 150, html: true, cell: function (d) { return Number(d.in_minor) ? '<span class="due get" data-b="in">' + esc(bkMoney(d.in_minor, c())) + '</span>' : dash; } },
    { key: 'out', label: tx('Going out'), prio: 4, num: true, w: 150, html: true, cell: function (d) { return Number(d.out_minor) ? '<span class="due give" data-b="out">' + esc(bkMoney(d.out_minor, c())) + '</span>' : dash; } },
    { key: 'bal', label: tx('Balance'), prio: 2, sort: 'bal', num: true, w: 190, html: true, cell: function (d) {
      var v = Number(d.balance_minor || 0);
      return '<b data-b="balance">' + esc(bkDrCr(v, c())) + '</b>' + (v < 0 ? ' <span class="tag red" data-b="short">⚠ ' + esc(tx('Short')) + '</span>' : ''); } },
    { key: 'what', label: tx('What'), prio: 5, w: 320, html: true, cell: function (d) { return d.items.length ? esc(d.items.map(function (it) { return it.name; }).join(' · ')) : dash; } },
  ];
}
/** what a day counts: the dues and cheques behind it, as the server listed them (the Task table's next level, CBList.nextRow) */
function fcNext(d) {
  var c = (FC.r && FC.r.currency) || 'INR';
  var rows = (d.items || []).map(function (it) {
    var who = it.party_id ? bkPartyLabel(it.party_id, it.name) : esc(it.name || '');
    var what = tx(FC_KIND[it.kind] || it.kind) + (it.cheque_no ? ' ' + it.cheque_no : '') + (it.promised ? ' · ' + tx('promised') : it.overdue ? ' · ' + tx('overdue') : it.due_date && it.due_date !== d.date ? ' · ' + tx('due') + ' ' + bkDate(it.due_date) : '');
    return CBList.nextRow(['<span data-b="who">' + esc(who) + '</span> <span class="sub">' + esc(what) + '</span>', '<span class="due ' + (fcIsIn(it) ? 'get' : 'give') + '">' + esc((fcIsIn(it) ? '+ ' : '− ') + bkMoney(it.amount_minor, c)) + '</span>'], [140]);
  }).join('');
  return '<div data-testid="fc-next-' + esc(d.date) + '">' + (rows || '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Nothing is due this day')) + '</div>') + '</div>';
}
/** the sentence on top (the server's words), what is left out, and GST — as the list's own notices and chips */
function fcHead() {
  var r = FC.r, notices = [], chips = [];
  if (r && FC.state === 'ready') {
    notices.push({ cls: r.shortfall ? 'warn' : '', tid: 'fc-words', text: r.words, onOpen: function () { if (r.shortfall && FC.api) FC.api.refresh(); } });
    if (r.uncounted && r.uncounted.words) notices.push({ cls: 'warn', tid: 'fc-uncounted', text: r.uncounted.words });
    if (r.gst && Number(r.gst.payable_minor) > 0) chips.push({ tid: 'fc-gst', text: tx('GST') + ' ' + bkMoney(r.gst.payable_minor, r.currency) + ' · ' + bkDate(r.gst.due_date) + (r.gst.counted ? '' : ' · ' + tx('after this window')) });
  }
  return { title: tx('Cash position'), notices: notices, chips: chips };
}
function fcMount(frame) {
  var s = document.getElementById('screen'); if (!s) return;
  ftNav();
  s.className = 'screen flush';
  s.innerHTML = '<div id="fc_top" data-testid="fc-top"></div><div id="fc_list" data-testid="fc-list" style="flex:1 1 auto;min-height:0"></div>';
  fcPaintTop();
  FC.api = CBList.mount(document.getElementById('fc_list'), {
    key: 'fin-cash', t: tx, rows: function () { return FC.rows; }, id: function (d) { return d.date; }, rowTid: function (d) { return 'fc-row-' + d.date; },
    columns: fcCols(), defaultCols: ['date', 'in', 'out', 'bal', 'what'], cardMax: 4, fill: false,
    head: fcHead,
    state: function () { return FC.state; }, error: function () { return { title: tx('Could not read your cash position.'), sub: tx('Nothing was lost. Try again.') }; }, onRetry: fcRetry,
    empty: { title: tx('No days to show') },
    search: function (d) { return [d.date, bkDate(d.date)].concat((d.items || []).map(function (it) { return it.name + ' ' + (it.cheque_no || ''); })).join(' '); },
    sorts: [{ key: 'date', label: tx('Day'), cmp: function (a, b) { return String(a.date).localeCompare(String(b.date)); } },
      { key: 'bal', label: tx('Balance'), cmp: function (a, b) { return Number(a.balance_minor || 0) - Number(b.balance_minor || 0); } }],
    filters: [{ key: 'show', label: tx('Show'), all: tx('Every day'), options: [{ v: 'busy', label: tx('Money moving') }, { v: 'short', label: tx('Short') }],
      match: function (d, v) { return v === 'busy' ? d.items.length > 0 : Number(d.balance_minor) < 0; } }],
    next: fcNext,
  });
  if (!frame) fcLoad(FC.rows.length > 0);
}
