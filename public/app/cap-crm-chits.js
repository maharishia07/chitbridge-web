/* cap-crm-chits.js — THE CHITS BEHIND THE HOME RAIL: In · Out · Stuck, stuck first (black-box H1 · H4 · H10).
 * Home's "24 in · 0 out · 21 stuck" must open the chits it counts. This is the smallest honest list of them: ONE read,
 * GET /api/facts/rail/chits — the SAME rows and the SAME overdue test the Home figures are counted from (lib/home-facts railScope),
 * so the stuck rows here number the stuck chip on Home. Only chits THIS shop holds a copy of are in it; a chit between two other
 * businesses cannot appear. It draws with CBList (the CRM's own list unit) and a row opens the chit sheet in place (openChitSheet).
 * Nothing is computed here: the reason a chit is stuck is the server's sentence. A stuck row names its fix by opening the sheet,
 * whose action row offers only what this chit allows (accept · answer · close · cancel).
 * Route: CB CRM  #/chits?tab=stuck|in|out. Needs from cap-crm.js: CRM · crmNav · crmBar · crmGo · esc · tx · api · crmErrWords. */
'use strict';

var CHITS = { items: [], state: 'loading', err: null, truncated: false, days: 7, api: null, gen: 0 };

function chitsWhen(iso) { try { return (CBLocale.date(iso, { day: '2-digit', month: 'short' }) || '').trim(); } catch (_) { return String(iso || '').slice(0, 10); } }
function chitsAge(c) { var d = Math.floor(Number(c.age_days) || 0); return d <= 0 ? tx('Today') : d === 1 ? tx('1 day old') : d + ' ' + tx('days old'); }
function chitsMoney(c) {
  if (c.value == null) return '';
  try { return esc(fmtMoney(Number(c.value), c.currency || 'INR')); } catch (_) { return esc(String(c.value)); }
}
function chitsStuckCount() { return CHITS.items.filter(function (c) { return c.stuck; }).length; }

async function chitsLoad() {
  var g = ++CHITS.gen;
  CHITS.state = 'loading'; chitsRefresh();
  try {
    var r = await api('railChits');
    if (g !== CHITS.gen) return;
    CHITS.items = Array.isArray(r) ? r : ((r && r.items) || []); CHITS.truncated = !!(r && r.truncated); CHITS.days = (r && r.overdue_days) || 7;   /* core.js unwrap() collapses a reply to its array when it carries no 'truncated' key */
    CHITS.state = 'ready'; CHITS.err = null;
  } catch (e) {
    if (g !== CHITS.gen) return;
    CHITS.state = 'error'; CHITS.err = e;
  }
  crmNav('chits'); chitsRefresh();
}
function chitsRefresh() { var a = CHITS.api; if (a && a.el && document.body.contains(a.el)) a.refresh(); }

function chitsCols() {
  return [
    { key: 'chit', label: 'Chit', prio: 1, w: 300, html: true, value: function (c) { return c.subject || c.who || ''; },
      cell: function (c) {
        return '<div><b>' + esc(c.subject || tx('A chit')) + '</b>' + (c.stuck ? ' <span class="tag late" data-testid="chits-stuck-tag">' + esc(tx('Stuck')) + '</span>' : '')
          + '</div><div class="sub">' + esc((c.tab === 'in' ? tx('From') : tx('To')) + ' ' + (c.self ? tx('your own shop') : (c.who || tx('a business')))) + '</div>'
          + (c.stuck && c.why ? '<div class="sub" data-testid="chits-why" style="color:var(--amber-i,#7A5205)">' + esc(tx(c.why)) + '</div>' : ''); } },
    { key: 'dir', label: 'In · Out', prio: 2, w: 90, value: function (c) { return c.tab === 'in' ? tx('In') : tx('Out'); }, cell: function (c) { return c.tab === 'in' ? tx('In') : tx('Out'); } },
    { key: 'age', label: 'Age', prio: 3, w: 120, value: function (c) { return c.age_days; }, cell: function (c) { return chitsAge(c); } },
    { key: 'when', label: 'Filed', prio: 4, w: 110, value: function (c) { return c.created_at || ''; }, cell: function (c) { return chitsWhen(c.created_at); } },
    { key: 'val', label: 'Amount', prio: 5, w: 130, html: true, value: function (c) { return c.value == null ? '' : c.value; }, cell: function (c) { return chitsMoney(c) || '<span class="sub">—</span>'; } }
  ];
}
function chitsFilters() {
  return [{ key: 'tab', label: tx('Show'), all: tx('Stuck, in and out'),
    options: [{ v: 'stuck', label: tx('Stuck') }, { v: 'in', label: tx('In') }, { v: 'out', label: tx('Out') }],
    match: function (c, v) { return v === 'stuck' ? !!c.stuck : c.tab === v; } }];
}
function chitsNotices() {
  var n = chitsStuckCount(), out = [];
  if (CHITS.truncated) { out.push({ text: tx('This shop holds too many chits to list them here yet.'), cls: 'warn', tid: 'chits-truncated' }); return out; }
  out.push({ text: n
    ? n + ' ' + tx(n === 1 ? 'chit is stuck: open for more than' : 'chits are stuck: open for more than') + ' ' + CHITS.days + ' ' + tx('days. A chit is not a bill until it is accepted, so Dues, Waiting and Bills do not show it yet. Open one to answer, close or cancel it.')
    : tx('Nothing is stuck.'), cls: n ? 'warn' : '', tid: 'chits-note' });
  return out;
}

function chitsHome(params) {
  crmBar('<strong>' + esc(tx('Chits')) + '</strong>', '', true);
  var s = document.getElementById('screen'); s.className = 'screen flush';
  s.innerHTML = '<div id="chits_list" data-testid="chits-list"></div>';
  if (CHITS.api && CHITS.api.destroy) { try { CHITS.api.destroy(); } catch (_) {} }
  var tab = params && /^(stuck|in|out)$/.test(params.tab || '') ? params.tab : null;
  CHITS.api = CBList.mount(document.getElementById('chits_list'), {
    key: 'rail-chits', t: tx, rows: function () { return CHITS.items; }, id: function (c) { return c.chit_id; }, rowTid: function (c) { return 'chits-row-' + c.chit_id; },
    columns: chitsCols, defaultCols: ['chit', 'age', 'val'], cardMax: 3,
    head: function () { return { title: tx('Chits'), notices: CHITS.state === 'ready' ? chitsNotices() : [] }; },
    state: function () { return CHITS.state; }, error: function () { return crmErrWords(CHITS.err, 'your chits'); }, onRetry: function () { chitsLoad(); },
    empty: { title: tx('Nothing open'), sub: tx('Every chit you hold has been answered or closed.') },
    search: function (c) { return [c.subject, c.who].join(' '); }, searchHint: tx('Subject or business'),
    filters: chitsFilters(), preset: tab ? { filt: { tab: tab } } : null,
    onOpen: function (c) { if (typeof openChitSheet === 'function') openChitSheet(c.chit_id); },
    actions: [{ id: 'open', label: tx('Open chit'), tid: 'chits-open', run: function (c) { if (typeof openChitSheet === 'function') openChitSheet(c.chit_id); } }]
  });
  chitsLoad();
}
