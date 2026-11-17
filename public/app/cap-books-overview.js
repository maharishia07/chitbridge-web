/* app/cap-books-overview.js — CB ACCOUNTS › HOW WE ARE DOING: the owner's overview, one read, painted (REP-26, REQ-MIS-SHOWCASE 14, critic c26fe54e).
 * CARD 26-reporting-mis-and-bi/mis
 *
 * ⭐ ONE CALCULATION: every figure, change and sentence piece is the server's — GET /api/books/overview (lib/books-mis): sales (SOLD, tax in) · income, expenses, profit (the P&L, tax out) · to collect, to pay (Dues) · cash ahead (the Cash view, 30 days).
 *   This page formats (money bkMoney → CBLocale in the shop's currency; a percent bkPct, basis points) and draws (CBDraw). It adds, rounds and compares NOTHING.
 * ⭐ ABSENT IS NOT DRAWN: a figure the server did not send (no sales yet, no last year, a seat without costs) has no tile; the page never prints a 0 for an unknown figure, and never says "not available".
 * ⭐ "SO FAR": a running period says so in its own words; the comparison is the same dates last year (a week: the same weekdays of the same week).
 * ⭐ NEVER COLOUR ALONE: bars solid, the running month hatched (CBDraw), a table under each picture, a change is a signed percent.
 * Host globals (accounts.html): api · EP · esc · tx · txf · bkMoney · bkPct · bkDate · CBDraw · CBLocale.
 * OWNS      OV (this view's state) and the How we are doing view (ovView · ovLoad · ovPaint)
 * CALLED BY public/accounts.html (BK.views.overview)
 * FLOW      #overview → ovView() → ovLoad() → GET /api/books/overview?period= → ovPaint(): headline · tiles · two pictures with their tables
 * Flow step: R2R · reports (docs/process/flows.json).
 */
'use strict';
if (typeof EP !== 'undefined') Object.assign(EP, { booksOverview: { m: 'GET', p: '/api/books/overview', ok: 'y' } /* owner · adviser · auditor: how the business is doing, one read (the seat decides the keys) */ });

var OV = { period: 'ytd', answer: null, state: 'loading', gen: 0, timer: null };
var OV_PERIODS = [
  ['week', 'This week so far'],
  ['mtd', 'This month so far'],
  ['quarter', 'This quarter so far'],
  ['ytd', 'This year so far']
];
var OV_SAME = { week: 'the same weekdays last year', mtd: 'the same dates last year', quarter: 'the same dates last year', ytd: 'the same dates last year' };

function ovView(body) {
  body.innerHTML = '<div data-testid="ov" class="ov"><div id="ov_bar"></div><div id="ov_main"></div></div>';
  ovLoad();
}
/** one read; a newer read wins; a failure is a sentence and a button, never a half page */
async function ovLoad() {
  var generation = ++OV.gen;
  OV.state = 'loading';
  ovPaint();
  try {
    var answer = await api('booksOverview', { query: { period: OV.period } });
    if (generation !== OV.gen) return;
    OV.answer = answer || null;
    OV.state = 'ready';
  } catch (error) {
    if (generation !== OV.gen) return;
    if (typeof cblog === 'function') cblog('error', 'overview: ' + ((error && error.message) || error));
    OV.state = 'error';
  }
  ovPaint();
}
function ovPick(period) {
  OV.period = period;
  ovLoad();
}
function ovMoney(minor) {
  return bkMoney(minor, OV.answer && OV.answer.currency);
}
/** a month's name for a bar, from its first day */
function ovMonth(day, form) {
  var parts = /^(\d{4})-(\d{2})/.exec(day || '');
  return parts ? CBLocale.date(Date.UTC(+parts[1], +parts[2] - 1, 15), { month: form, year: form === 'long' ? 'numeric' : '2-digit' }) : '';
}
function ovSelect() {
  return (
    '<select class="inp" id="ov_pick" data-testid="ov-pick" aria-label="' + esc(tx('Which period')) + '" onchange="ovPick(this.value)">' +
    OV_PERIODS.map(function (item) {
      return '<option value="' + item[0] + '"' + (item[0] === OV.period ? ' selected' : '') + '>' + esc(tx(item[1])) + '</option>';
    }).join('') +
    '</select>'
  );
}
/** the top line: the lead figure (income, tax out; sales for a reader without costs), what it is, and its change on last year, all carried */
function ovHeadline(a) {
  var lead = a.income && a.income.minor != null ? { words: 'Income', fig: a.income } : a.sales && a.sales.minor != null ? { words: 'Sales', fig: a.sales } : null;
  if (!lead) return '';
  var change = lead.fig.change_bp != null ? ' (' + bkPct(lead.fig.change_bp, true) + ' ' + esc(tx('on')) + ' ' + esc(tx(OV_SAME[a.period.word])) + ')' : '';
  return '<p data-testid="ov-headline" class="ov-head">' + esc(tx(lead.words)) + ' ' + esc(tx(OV_PERIODS.filter(function (x) { return x[0] === a.period.word; })[0][1]).toLowerCase()) + ': <b>' + esc(ovMoney(lead.fig.minor)) + '</b>' + change + '</p>';
}
/** one tile: a label, the figure, its note; a link into the page that holds the figure; absent → nothing */
function ovTile(tid, label, minor, note, href) {
  if (minor == null) return '';
  return (
    '<a class="ov-tile" href="' + href + '" data-testid="ov-' + tid + '"><span class="ov-l">' + esc(tx(label)) + '</span><span class="ov-v">' + esc(ovMoney(minor)) + '</span>' +
    (note ? '<span class="ov-n">' + note + '</span>' : '') + '</a>'
  );
}
function ovChange(fig) {
  return fig && fig.change_bp != null ? bkPct(fig.change_bp, true) + ' ' + esc(tx('on last year')) : '';
}
function ovTiles(a) {
  var s = a.sales || {},
    cash = a.cash;
  var tiles = [
    ovTile('sales', 'Sales, tax in', s.minor, ovChange(s) + (s.partial ? ' · ' + esc(tx('books began part-way')) : ''), '#daybook'),
    a.income ? ovTile('income', 'Income, tax out', a.income.minor, ovChange(a.income), '#pl') : '',
    a.profit ? ovTile('profit', 'Profit', a.profit.minor, ovChange(a.profit), '#pl') : '',
    a.to_collect ? ovTile('collect', 'To collect', a.to_collect.minor, '', '#dues') : '',
    a.to_pay ? ovTile('pay', 'To pay', a.to_pay.minor, '', '#dues') : ''
  ];
  if (cash && cash.words) tiles.push('<a class="ov-tile ov-wide" href="/finance.html#/cash" data-testid="ov-cash"><span class="ov-l">' + esc(tx('Cash ahead, 30 days')) + '</span><span class="ov-n">' + esc(cash.words) + '</span></a>');
  return '<div class="ov-tiles">' + tiles.join('') + '</div>';
}
/** THE CHART SLOT: today CBDraw.bars (the library helper); the MIS chart components (lane next/mischarts-web: 12 months, week vs week, 7 years) replace this one call, nothing else on the page changes */
function ovChart(points, opts) {
  return CBDraw.bars(points, opts);
}
/** one picture and its table (a table under every chart): points [{ from, running, value }] oldest first */
function ovPicture(tid, title, list, key) {
  var points = list.map(function (item) {
    var name = ovMonth(item.from, 'long') + (item.running ? ' · ' + tx('so far') : '');
    return { key: item.from, label: ovMonth(item.from, 'short'), value: item[key], hatch: !!item.running, title: name + ' · ' + (item[key] == null ? tx('no figure') : ovMoney(item[key])) };
  });
  if (!points.some(function (point) { return point.value != null; })) return '';
  var rows = points.map(function (point) {
    return '<tr><td>' + esc(point.title.split(' · ')[0] + (point.hatch ? ' ' + tx('(so far)') : '')) + '</td><td class="num">' + (point.value == null ? '<span style="color:var(--grey)">—</span>' : esc(ovMoney(point.value))) + '</td></tr>';
  });
  var box = document.getElementById('ov_main');
  var width = Math.max(240, Math.floor(((box && box.clientWidth) || 640) / (window.innerWidth > 900 ? 2 : 1)) - 24);
  return (
    '<section class="ov-pic" data-testid="ov-' + tid + '"><h3>' + esc(tx(title)) + '</h3>' +
    ovChart(points, { width: width, height: 130, id: 'ov' + tid, tid: 'ov-' + tid + '-svg', aria: tx(title) }) +
    '<details><summary>' + esc(tx('Show the figures')) + '</summary><table class="bk-st"><tbody>' + rows.join('') + '</tbody></table></details></section>'
  );
}
function ovCss() {
  return (
    '<style>.ov{padding:0 12px 12px}.ov-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}.ov-head{margin:4px 0 8px;font:600 var(--fs-3,17px) var(--sans,sans-serif);color:var(--ink,#2a2418)}' +
    '.ov-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px}.ov-tile{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid var(--line-3,#d8ccb0);border-radius:8px;background:var(--card,#fffdf8);color:var(--ink,#2a2418);text-decoration:none}' +
    '.ov-l{font-size:var(--fs-1,12px);color:var(--muted,#6f6450)}.ov-v{font:700 var(--fs-3,17px) var(--sans,sans-serif)}.ov-n{font-size:var(--fs-1,12px);color:var(--muted,#6f6450)}.ov-wide{grid-column:1/-1}' +
    '.ov-pics{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:901px){.ov-pics{grid-template-columns:1fr 1fr}}.ov-pic{border:1px solid var(--line-3,#d8ccb0);border-radius:8px;padding:6px 10px;background:var(--card,#fffdf8);min-width:0;overflow:hidden}.ov-pic h3{margin:0 0 2px;font-size:var(--fs-2,14px)}.ov-pic details{font-size:var(--fs-1,12px)}.ov .bk-st .num{text-align:right}</style>'
  );
}
function ovPaint() {
  var bar = document.getElementById('ov_bar'),
    main = document.getElementById('ov_main');
  if (!bar || !main) return;
  bar.innerHTML = ovCss() + '<div class="ov-bar">' + ovSelect() + (OV.state === 'ready' && OV.answer && OV.answer.sales && OV.answer.sales.through ? '<span style="color:var(--grey);font-size:var(--fs-1)" data-testid="ov-through">' + esc(txf('Books in to {date}', { date: bkDate(OV.answer.sales.through) })) + '</span>' : '') + '</div>';
  if (OV.state === 'loading') main.innerHTML = '<p class="hint">' + esc(tx('Loading…')) + '</p>';
  else if (OV.state !== 'ready' || !OV.answer) main.innerHTML = '<p class="hint" data-testid="ov-error">' + esc(tx('This did not load.')) + ' <button class="btn" type="button" data-testid="ov-retry" onclick="ovLoad()">' + esc(tx('Try again')) + '</button></p>';
  else {
    var a = OV.answer;
    main.innerHTML = ovHeadline(a) + ovTiles(a) + '<div class="ov-pics">' + ovPicture('sales', 'Sales by month, tax in', a.bars || [], 'sold_minor') + ovPicture('profit', 'Profit by month', a.profit_by_month || [], 'profit_minor') + '</div>';
  }
}
window.addEventListener('resize', function () {
  clearTimeout(OV.timer);
  OV.timer = setTimeout(function () {
    if (document.getElementById('ov_main') && OV.state === 'ready') ovPaint();
  }, 150);
});
