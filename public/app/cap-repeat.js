/* cap-repeat.js — REPEAT SUPPLY as an AGREEMENT both parties hold (round RI1, 2026-10-12): CB Finance › Repeat supply (the seller's list),
 * "Repeat this…" on a sent invoice (CBSteps), and the agreement's own panel in the chit sheet — Accept · Counter · Decline · Skip on the
 * customer's side, Run now · Pause · Resume · Agree · Skip · End on the seller's. Loaded by finance.html (after cap-finance-terms.js) and
 * lazily by app.html (ensureCap('repeat')) when the chit sheet meets a sent invoice or an agreement chit.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): CBList.mount (the one list — the Finance tabs' own mount) · CBSteps (step-flow.js, the one
 * step flow) · openChitSheet (a row's details ARE the agreement chit; the panel sits inside the sheet) · CBAction (M64: one press one write,
 * End and Decline ask first, the outcome said beside the control) · bkDate / bkMoney / fmtMoney (M36) · finTab / ftNav (the Finance tabs) ·
 * modal / closeModal (the page's own sheet) · api() and EP (one name per endpoint, e2e/ep-aliases).
 * ⭐ ONE CALCULATION (rule 2): nothing here works out a date, a quantity or a rupee. The next date, the last run, the agreement's state and
 * EVERY verb's may/why come from /api/repeat (lib/repeat-supply may()); the per-run money is the agreement chit's own frozen summary.
 * A button the server refuses is greyed WITH its sentence (the server's `say`).
 * ⭐ NEW PATHS (rule 4): RP (the tab's state) · CB_REPEAT_EP (the 14 /api/repeat rows, declared once here) · the tab (#/repeat — a third
 * place on the Finance nav) · rpStart (the composer: Finance had no step flow and the sheet no "repeat" verb) · rpPanel (the agreement's
 * panel in the sheet: the sheet's status verbs are the rail's; the agreement's verbs are its own table).
 * ⚠️ Never error.message on a screen: a failure says what happened (CBAction.words) and the button stays.
 */
/* OWNS Repeat supply as an agreement both parties hold
 * CALLED BY finance.html and app.html (ensureCap('repeat'))
 * FLOW agreement chit -> rpMoney paints its total in the agreement's own currency -> actions per side
 * CARD 16-finance/repeat-supply */
'use strict';

var RP = { gen: 0, rows: [], state: 'loading', err: null, api: null, migrated: true, msg: null, flow: null, draft: null, panel: null };
var CB_REPEAT_EP = {
  repeatList:    { m: 'GET',  p: '/api/repeat',             ok: 'y' },   // the seller's agreements: next date · last run · the other side's state · actions (may/why)
  repeatCreate:  { m: 'POST', p: '/api/repeat',             ok: '✓' },   // { chit_id, every, unit, start_on, until: { runs | on }, mode } — the agreement chit is SENT
  repeatSweep:   { m: 'POST', p: '/api/repeat/sweep',       ok: '✓' },   // run everything due (what the nightly does)
  repeatGet:     { m: 'GET',  p: '/api/repeat/:id',         ok: 'y' },   // ?chit= — either side (the customer names the chit they hold)
  repeatAccept:  { m: 'POST', p: '/api/repeat/:id/accept',  ok: '✓' },   // customer
  repeatCounter: { m: 'POST', p: '/api/repeat/:id/counter', ok: '✓' },   // customer: { chit_id, lines?, every?, unit?, start_on?, note }
  repeatDecline: { m: 'POST', p: '/api/repeat/:id/decline', ok: '✓' },   // customer: { chit_id, reason? }
  repeatSkip:    { m: 'POST', p: '/api/repeat/:id/skip',    ok: '✓' },   // either side: { chit_id?, reason } (the customer must say why)
  repeatAgree:   { m: 'POST', p: '/api/repeat/:id/agree',   ok: '✓' },   // seller: the counter becomes the terms
  repeatRefuse:  { m: 'POST', p: '/api/repeat/:id/refuse',  ok: '✓' },   // seller: { reason? }
  repeatPause:   { m: 'POST', p: '/api/repeat/:id/pause',   ok: '✓' },   // seller: { reason? }
  repeatResume:  { m: 'POST', p: '/api/repeat/:id/resume',  ok: '✓' },   // seller
  repeatEnd:     { m: 'POST', p: '/api/repeat/:id/end',     ok: '✓' },   // seller: { reason? } — asks first
  repeatRun:     { m: 'POST', p: '/api/repeat/:id/run',     ok: '✓' },   // seller: run what is due now
};
Object.assign(EP, CB_REPEAT_EP);

var RP_UNIT = { daily: ['day', 'days'], weekly: ['week', 'weeks'], monthly: ['month', 'months'] };
var RP_VERB = { accept: 'Accept', counter: 'Counter', decline: 'Decline', skip: 'Skip next', run: 'Run now', pause: 'Pause', resume: 'Resume', agree: 'Agree', refuse: "Don't agree", end: 'End' };
var RP_TONE = { proposed: 'amber', agreed: 'green', countered: 'amber', paused: '', declined: '', ended: '' };

function rpT(s) { return typeof tx === 'function' ? tx(s) : s; }
/** "every 2 weeks" · "every day" — the schedule in words, from the server's fields */
function rpEvery(list) { var u = RP_UNIT[list.unit] || [list.unit, list.unit]; var n = Number(list.every) || 1; return rpT('every') + ' ' + (n > 1 ? n + ' ' + rpT(u[1]) : rpT(u[0])); }
/** the per-run money as the agreement chit was frozen with — a mapping, never a sum */
function rpMoney(a) { var m = a && a.money; if (!m || m.total == null) return '—'; return typeof fmtMoney === 'function' ? fmtMoney(m.total, a.currency || m.currency_code) : String(m.total); }
function rpDate(d) { return typeof bkDate === 'function' ? bkDate(d) : (d || '—'); }
function rpSession() { return (typeof SESS !== 'undefined' && SESS) || (typeof SESSION !== 'undefined' && SESSION) || {}; }
/** a verb button: enabled when the server says ok; otherwise greyed, its sentence on the control and said on a tap */
function rpBtn(a, verb, tid, cls, sayInline) {
  var v = (a.actions || {})[verb]; if (!v) return '';
  var ok = !!v.ok, say = v.say || '';
  return '<button type="button" class="' + (cls || 'act sm') + '" data-testid="' + esc(tid) + '" data-verb="' + verb + '"' + (ok ? '' : ' disabled aria-disabled="true" title="' + esc(say) + '" data-why="' + esc(say) + '"')
    + ' onclick="CBRepeat.act(\'' + esc(a.agreement_id) + '\',\'' + verb + '\',this)">' + esc(rpT(RP_VERB[verb] || verb)) + '</button>'
    /* greyed WITH its sentence: a disabled button never answers a tap, so the sentence stands beside it */
    + (!ok && sayInline ? '<div class="hint" data-testid="' + esc(tid) + '-say">' + esc(say) + '</div>' : '');
}
/** the greyed verbs' sentences, once each, with the verbs they refuse — under the panel's buttons */
function rpSaysHTML(a, verbs) {
  var by = {}; verbs.forEach(function (item) { var x = (a.actions || {})[item]; if (x && !x.ok && x.say) (by[x.say] = by[x.say] || []).push(rpT(RP_VERB[item] || item)); });
  return Object.keys(by).map(function (item) { return '<div class="hint" data-testid="rp-says">' + esc(by[item].join(' · ') + ': ' + item) + '</div>'; }).join('');
}

/* ── the Finance tab: the seller's agreements ─────────────────────────────────────────────────────────────── */

async function rpLoad(quiet) {
  var g = ++RP.gen;
  if (!quiet) { RP.state = 'loading'; if (RP.api) RP.api.refresh(); }
  try {
    var reply = await api('repeatList');
    if (g !== RP.gen) return;
    RP.rows = (reply && reply.agreements) || []; RP.migrated = !(reply && reply.migrated === false); RP.msg = (reply && reply.message) || null;
    RP.state = 'ready'; RP.err = null;
  } catch (e) {
    if (g !== RP.gen) return;
    RP.state = e && e.status === 403 ? 'denied' : 'error'; RP.err = e;
  }
  rpHead(); if (RP.api) RP.api.refresh();
}
function rpRetry() { rpLoad(); }
/** the one line above the list: what is due (the server's rows) and the button that runs it — or the migration sentence, greyed */
function rpHead() {
  var node = document.getElementById('rp_head'); if (!node) return;
  if (RP.state === 'denied') { node.innerHTML = '<p data-testid="rp-denied" style="opacity:.75">' + esc(rpT('Only the owner or a sales person may see agreements.')) + '</p>'; return; }
  if (!RP.migrated) { node.innerHTML = '<p data-testid="rp-not-yet" style="opacity:.75">' + esc(rpT(RP.msg || 'Repeat supply arrives after the next update.')) + '</p>'; return; }
  var due = RP.rows.filter(function (item) { return item.due; }).length;
  node.innerHTML = '<div class="kv"><b data-testid="rp-due">' + esc(due ? (typeof txn === 'function' ? txn('{count} run due', '{count} runs due', due) : due + ' due') : rpT('Nothing due today')) + '</b>'
    + '<span><button type="button" class="act sm" data-testid="rp-run-due"' + (due ? '' : ' disabled aria-disabled="true" title="' + esc(rpT('Nothing is due.')) + '"') + ' onclick="rpSweep(this)">' + esc(rpT('Run what is due')) + '</button>'
    + ' <span id="rp_why" data-testid="rp-why" class="hint"' + (RP.said ? ' data-tone="' + esc(RP.said.tone) + '"' : '') + '>' + esc(RP.said ? RP.said.text : '') + '</span></span></div>';
}
function rpSweep(btn) {
  return CBAction.run(btn, function () { return api('repeatSweep', { body: {} }); },
    { key: 'rp-sweep', out: 'rp_why', failed: rpT('Could not run them'), outcome: function (r) {
      var n = (r && r.ran || []).length, p = (r && r.problems || []).length;
      RP.said = { text: (n ? (typeof txn === 'function' ? txn('{count} run made', '{count} runs made', n) : n + ' made') : rpT('Nothing to run')) + (p ? ' · ' + rpT('some could not: see the row') : ''), tone: p ? 'warn' : 'ok' };
      rpHead(); rpLoad(true);
    } });
}
function rpCols() {
  var dash = '<span style="color:var(--grey)">—</span>';
  return [
    { key: 'customer', label: rpT('Customer'), prio: 1, sort: 'name', w: 220, html: true, cell: function (a) { return '<b>' + esc(a.customer && a.customer.name || rpT('Customer')) + '</b><div class="hint" data-b="each">' + esc(rpEvery(a)) + (a.mode === 'send' ? ' · ' + esc(rpT('sent')) : ' · ' + esc(rpT('drafted'))) + '</div>'; } },
    { key: 'money', label: rpT('Each run'), prio: 3, num: true, w: 130, html: true, cell: function (a) { return '<span data-b="money">' + esc(rpMoney(a)) + '</span>'; } },
    { key: 'next', label: rpT('Next run'), prio: 2, sort: 'next', w: 150, html: true, cell: function (a) { return a.state === 'agreed' || a.state === 'paused' ? '<span data-b="next">' + esc(rpDate(a.next_on)) + '</span>' + (a.due ? ' <span class="tag amber">' + esc(rpT('Due')) + '</span>' : '') : dash; } },
    { key: 'last', label: rpT('Last run'), prio: 4, w: 130, html: true, cell: function (a) { return a.last_run_on ? '<span data-b="last">' + esc(rpDate(a.last_run_on)) + '</span> <span class="hint">' + esc(String(a.runs_done)) + (a.runs_max ? '/' + esc(String(a.runs_max)) : '') + '</span>' : dash; } },
    { key: 'state', label: rpT('Their side'), prio: 1, sort: 'state', w: 200, html: true, cell: function (a) {
      return '<span class="tag ' + (RP_TONE[a.state] || '') + '" data-b="state">' + esc(rpT(a.words || a.state)) + '</span>' + (a.state_note ? '<div class="hint" data-b="note">' + esc(a.state_note) + '</div>' : ''); } },
    { key: 'act', label: ' ', prio: 1, pin: 'end', w: 170, html: true, cell: function (a) {
      var v = a.state === 'countered' ? 'agree' : a.state === 'paused' ? 'resume' : 'run';
      return '<span style="display:inline-flex;gap:6px;flex-direction:column;align-items:flex-start" onclick="event.stopPropagation()">' + rpBtn(a, v, 'rp-' + v + '-' + a.agreement_id, 'cbl-tbtn', true) + '</span>'; } },
  ];
}
function rpMount(frame) {
  var node = document.getElementById('screen'); if (!node) return;
  if (typeof ftNav === 'function') ftNav();
  node.className = 'screen flush';
  node.innerHTML = '<div class="card" id="rp_head" data-testid="rp-head"></div><div id="rp_list" data-testid="rp-list" style="flex:1 1 auto;min-height:0"></div>';
  rpHead();
  RP.api = CBList.mount(document.getElementById('rp_list'), {
    key: 'fin-repeat', t: rpT, rows: function () { return RP.rows; }, id: function (a) { return a.agreement_id; }, rowTid: function (a) { return 'rp-row-' + a.agreement_id; },
    columns: rpCols(), defaultCols: ['customer', 'next', 'state', 'money', 'last'], cardMax: 4, fill: false,
    head: function () { return { title: rpT('Repeat supply') }; },
    state: function () { return RP.state === 'denied' ? 'ready' : RP.state; }, error: function () { return { title: rpT('Could not read your agreements.'), sub: rpT('Nothing was lost. Try again.') }; }, onRetry: rpRetry,
    empty: { title: rpT('No repeat supply yet'), sub: rpT('Open a sent bill and press Repeat this…') },
    onOpen: function (a) { if (typeof openChitSheet === 'function') openChitSheet(a.chit_id); },
    search: function (a) { return [a.customer && a.customer.name, a.subject, a.words].join(' '); },
    sorts: [
      { key: 'next', label: rpT('Next run'), cmp: function (a, b) { return String(a.next_on || '9999').localeCompare(String(b.next_on || '9999')); } },
      { key: 'name', label: rpT('Customer'), cmp: function (a, b) { return String(a.customer && a.customer.name || '').localeCompare(String(b.customer && b.customer.name || '')); } },
      { key: 'state', label: rpT('Their side'), cmp: function (a, b) { return String(a.state).localeCompare(String(b.state)); } },
    ],
    filters: [{ key: 'state', label: rpT('Show'), all: rpT('All'), options: [{ v: 'live', label: rpT('Running') }, { v: 'waiting', label: rpT('Waiting on them') }, { v: 'over', label: rpT('Ended') }],
      match: function (a, v) { return v === 'live' ? /^(agreed|paused)$/.test(a.state) : v === 'waiting' ? /^(proposed|countered)$/.test(a.state) : /^(ended|declined)$/.test(a.state); } }],
  });
  if (!frame) rpLoad(RP.rows.length > 0);
}

/* ── "Repeat this…" on a sent invoice: the composer (CBSteps) ─────────────────────────────────────────────── */

function rpDraftOf(m) {
  var today = typeof bkToday === 'function' ? bkToday() : new Date().toISOString().slice(0, 10);
  return { chit_id: m.id, lines: m.lines || [], who: m.who || '', every: 1, unit: 'weekly', start_on: today, until: 'none', runs: 12, on: '', mode: 'draft' };
}
function rpField(label, input) { return '<div class="kv"><b style="flex:1 1 140px">' + esc(label) + '</b><span style="flex:1 1 160px">' + input + '</span></div>'; }
function rpStepSchedule() {
  var list = RP.draft, sel = function (v) { return list.unit === v ? ' selected' : ''; }, chk = function (k, v) { return list[k] === v ? ' checked' : ''; };
  return rpField(rpT('Every'), '<input class="inp" id="rp_every" data-testid="rp-every" inputmode="numeric" value="' + esc(String(list.every)) + '" style="width:70px" oninput="CBRepeat.read()"> '
      + '<select class="inp" id="rp_unit" data-testid="rp-unit" onchange="CBRepeat.read()"><option value="daily"' + sel('daily') + '>' + esc(rpT('day(s)')) + '</option><option value="weekly"' + sel('weekly') + '>' + esc(rpT('week(s)')) + '</option><option value="monthly"' + sel('monthly') + '>' + esc(rpT('month(s)')) + '</option></select>')
    + rpField(rpT('From'), '<input class="inp" type="date" id="rp_start" data-testid="rp-start" value="' + esc(list.start_on) + '" onchange="CBRepeat.read()">')
    + rpField(rpT('Until'), '<label><input type="radio" name="rp_until" value="none" data-testid="rp-until-none"' + chk('until', 'none') + ' onchange="CBRepeat.read()"> ' + esc(rpT('You end it')) + '</label> '
      + '<label><input type="radio" name="rp_until" value="runs" data-testid="rp-until-runs"' + chk('until', 'runs') + ' onchange="CBRepeat.read()"> <input class="inp" id="rp_runs" data-testid="rp-runs" inputmode="numeric" value="' + esc(String(list.runs)) + '" style="width:60px" oninput="CBRepeat.read()"> ' + esc(rpT('runs')) + '</label> '
      + '<label><input type="radio" name="rp_until" value="on" data-testid="rp-until-on"' + chk('until', 'on') + ' onchange="CBRepeat.read()"> <input class="inp" type="date" id="rp_on" data-testid="rp-on" value="' + esc(list.on) + '" onchange="CBRepeat.read()"></label>')
    + rpField(rpT('Each run'), '<label><input type="radio" name="rp_mode" value="draft" data-testid="rp-mode-draft"' + chk('mode', 'draft') + ' onchange="CBRepeat.read()"> ' + esc(rpT('Draft for me to send')) + '</label> '
      + '<label><input type="radio" name="rp_mode" value="send" data-testid="rp-mode-send"' + chk('mode', 'send') + ' onchange="CBRepeat.read()"> ' + esc(rpT('Send it')) + '</label>');
}
function rpStepReview() {
  var list = RP.draft, u = RP_UNIT[list.unit] || [list.unit, list.unit], n = Number(list.every) || 1;
  var until = list.until === 'runs' ? (typeof txn === 'function' ? txn('{count} run', '{count} runs', Number(list.runs)) : list.runs + ' runs') : list.until === 'on' ? rpT('until') + ' ' + rpDate(list.on) : rpT('until you end it');
  return '<div class="kv"><b>' + esc(list.who) + '</b><span data-testid="rp-review">' + esc(rpT('every') + ' ' + (n > 1 ? n + ' ' + rpT(u[1]) : rpT(u[0])) + ' · ' + rpT('from') + ' ' + rpDate(list.start_on) + ' · ' + until + ' · ' + (list.mode === 'send' ? rpT('each run is sent') : rpT('each run is drafted for you'))) + '</span></div>'
    + '<p class="hint" data-testid="rp-review-lines">' + esc((typeof txn === 'function' ? txn('{count} line', '{count} lines', list.lines.length) : list.lines.length + ' lines') + ' · ' + rpT('the customer accepts, counters or declines before anything is billed')) + '</p>'
    + '<p class="hint" id="rp_send_why" data-testid="rp-send-why"></p>';
}
function rpRead() {
  var list = RP.draft; if (!list) return;
  var node = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  var r = function (n) { var el = document.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : ''; };
  if (document.getElementById('rp_every')) { list.every = node('rp_every'); list.unit = node('rp_unit') || list.unit; list.start_on = node('rp_start'); list.until = r('rp_until') || list.until; list.runs = node('rp_runs'); list.on = node('rp_on'); list.mode = r('rp_mode') || list.mode; }
  if (RP.flow) RP.flow.paintFoot();
}
function rpGuard(k) {
  var list = RP.draft; if (!list) return null;
  if (k !== 'schedule') return null;
  var n = Number(list.every); if (!(n >= 1 && n <= 365) || n !== Math.floor(n)) return rpT('Every how many? 1 to 365.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(list.start_on)) return rpT('From when?');
  if (list.until === 'runs' && !(Number(list.runs) >= 1)) return rpT('How many runs?');
  if (list.until === 'on' && !/^\d{4}-\d{2}-\d{2}$/.test(list.on)) return rpT('Until when?');
  return null;
}
function rpBody() { return { chit_id: RP.draft.chit_id, every: Number(RP.draft.every), unit: RP.draft.unit, start_on: RP.draft.start_on, until: RP.draft.until === 'runs' ? { runs: Number(RP.draft.runs) } : RP.draft.until === 'on' ? { on: RP.draft.on } : {}, mode: RP.draft.mode }; }
/** the composer over the page's own sheet: Schedule → Review → Send agreement */
function rpStart(chitId, m) {
  if (typeof modal !== 'function' || typeof CBSteps === 'undefined') { if (typeof toast === 'function') toast(rpT('Open this bill on the app to repeat it')); return; }
  if (typeof CBSheet !== 'undefined' && CBSheet.close) CBSheet.close();
  RP.draft = rpDraftOf(m || { id: chitId });
  modal('<div class="mhd"><div class="t" data-testid="rp-title">' + esc(rpT('Repeat this bill')) + '</div><div class="sub" id="rp_sub"></div></div><div id="rp_rail"></div><div class="mbody" id="rp_body"></div><div class="mfoot" id="rp_foot"></div>');
  if (RP.flow) RP.flow.destroy();
  RP.flow = CBSteps.create({
    steps: [{ k: 'schedule', n: rpT('Schedule'), t: rpT('How often, from when, until when') }, { k: 'review', n: rpT('Review'), t: rpT('The customer agrees before anything is billed') }],
    railEl: 'rp_rail', bodyEl: 'rp_body', footEl: 'rp_foot', subEl: 'rp_sub',
    render: function (k) { return k === 'schedule' ? rpStepSchedule() : rpStepReview(); },
    guard: rpGuard, sendLabel: rpT('Send agreement'), sendTestid: 'rp-send', cancelLabel: rpT('Cancel'),
    onCancel: function () { closeModal(); },
    onSend: function () {
      var btn = document.querySelector('[data-testid="rp-send"]');
      return CBAction.run(btn, function () { return api('repeatCreate', { body: rpBody() }); },
        { key: 'rp-send', out: 'rp_send_why', busy: rpT('Sending…'), failed: rpT('Could not send the agreement'), outcome: function () {
          closeModal(); if (typeof toast === 'function') toast(rpT('Agreement sent — waiting for the customer'));
          if (document.getElementById('rp_list')) rpLoad(true);
        } });
    },
  });
  RP.flow.paint();
}

/* ── the agreement's panel in the chit sheet (either side) ────────────────────────────────────────────────── */

/** the sheet's model → is this chit an agreement? (business_json.repeat is stamped at send on both copies) */
function rpIsAgreement(m) { return !!(m && m.bj && m.bj.repeat && m.bj.repeat.agreement_id); }
function rpPanelHTML() { return '<div class="cs-sec">' + esc(rpT('Repeat supply')) + '</div><div data-testid="rp-panel" id="rp_panel"><div class="cs-mute">' + esc(rpT('Reading…')) + '</div></div>'; }
/** mount after the sheet has painted: read the agreement as THIS side sees it and paint the verbs the server allows */
async function rpPanel(m) {
  var el = document.getElementById('rp_panel'); if (!el || !rpIsAgreement(m)) return;
  var id = m.bj.repeat.agreement_id;
  try {
    var reply = await api('repeatGet', { params: { id: id }, query: { chit: m.id } });
    RP.panel = { id: id, chit: m.id, a: reply.agreement, lines: m.lines || [] };
    rpPanelPaint();
  } catch (e) {
    var w = typeof CBAction !== 'undefined' ? CBAction.words(e, rpT('Could not read the agreement')) : rpT('Could not read the agreement');
    el.innerHTML = '<div class="cs-mute" data-testid="rp-panel-err">' + esc(w) + '</div>';
  }
}
function rpPanelPaint() {
  var el = document.getElementById('rp_panel'), p = RP.panel; if (!el || !p) return;
  var a = p.a, seller = a.side === 'seller';
  var until = a.runs_max ? (typeof txn === 'function' ? txn('{count} run', '{count} runs', a.runs_max) : a.runs_max + ' runs') : a.end_on ? rpT('until') + ' ' + rpDate(a.end_on) : rpT('until ended');
  var line = rpEvery(a) + ' · ' + until + ' · ' + (a.mode === 'send' ? rpT('each run is sent') : rpT('each run is drafted'));
  var verbs = seller ? ['run', 'pause', 'resume', 'agree', 'refuse', 'skip', 'end'] : ['accept', 'counter', 'decline', 'skip'];
  var c = a.counter;
  el.innerHTML = '<div class="cs-row"><span data-testid="rp-schedule">' + esc(line) + '</span><span class="tag ' + (RP_TONE[a.state] || '') + '" data-testid="rp-state">' + esc(rpT(a.words || a.state)) + '</span></div>'
    + '<div class="cs-row cs-mute"><span>' + esc(rpT('Next run')) + '</span><span data-testid="rp-next">' + esc(/^(agreed|paused)$/.test(a.state) ? rpDate(a.next_on) : '—') + '</span></div>'
    + '<div class="cs-row cs-mute"><span>' + esc(rpT('Last run')) + '</span><span data-testid="rp-last">' + esc(a.last_run_on ? rpDate(a.last_run_on) + ' · ' + a.runs_done : '—') + '</span></div>'
    + (a.state_note ? '<div class="cs-row cs-mute"><span>' + esc(rpT('Note')) + '</span><span data-testid="rp-note">' + esc(a.state_note) + '</span></div>' : '')
    + (c ? '<div class="cs-note" data-testid="rp-counter">' + esc(rpT('Proposed change') + ': ' + rpCounterWords(c, p.lines)) + '</div>' : '')
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px" data-testid="rp-verbs">' + verbs.map(function (item) { return rpBtn(a, item, 'rp-act-' + item); }).join('') + '</div>' + rpSaysHTML(a, verbs)
    + '<div id="rp_form" data-testid="rp-form"></div><div class="cs-mute" id="rp_panel_why" data-testid="rp-panel-why"></div>';
}
function rpCounterWords(list, lines) {
  var byId = {}; (lines || []).forEach(function (item) { byId[item.line_id] = item; });
  return [list.lines ? list.lines.map(function (x) { var l = byId[x.line_id]; return (l ? (l.particulars || l.name || x.line_id) : x.line_id) + ' × ' + x.quantity; }).join(', ') : null,
    list.every != null ? rpEvery(list) + ' ' + rpT('from') + ' ' + rpDate(list.start_on) : null, list.note || null].filter(Boolean).join(' · ');
}
/** the Counter form: a quantity per line, how often, from when, a note */
function rpCounterForm(p) {
  var list = p.a;
  return '<div class="cs-sec">' + esc(rpT('Your counter')) + '</div>'
    + (p.lines || []).map(function (item, index) { return '<div class="cs-row"><span>' + esc(item.particulars || item.name || '') + '</span><input class="inp" data-testid="rp-cq-' + index + '" data-line="' + esc(item.line_id || '') + '" inputmode="numeric" style="width:70px" value="' + esc(String(item.quantity != null ? item.quantity : (item.qty || ''))) + '"></div>'; }).join('')
    + '<div class="cs-row"><span>' + esc(rpT('Every')) + '</span><span><input class="inp" id="rp_c_every" data-testid="rp-c-every" inputmode="numeric" style="width:60px" value="' + esc(String(list.every)) + '"> <select class="inp" id="rp_c_unit" data-testid="rp-c-unit">'
      + ['daily', 'weekly', 'monthly'].map(function (item) { return '<option value="' + item + '"' + (list.unit === item ? ' selected' : '') + '>' + esc(rpT(RP_UNIT[item][0])) + '</option>'; }).join('') + '</select></span></div>'
    + '<div class="cs-row"><span>' + esc(rpT('From')) + '</span><input class="inp" type="date" id="rp_c_start" data-testid="rp-c-start" value="' + esc(list.next_on || '') + '"></div>'
    + '<input class="inp" id="rp_c_note" data-testid="rp-c-note" placeholder="' + esc(rpT('Why (they will read it)')) + '" style="width:100%;margin:6px 0">'
    + '<button type="button" class="act sm" data-testid="rp-c-send" onclick="CBRepeat.sendCounter(this)">' + esc(rpT('Send counter')) + '</button>';
}
function rpReasonForm(verb, label, ph) {
  return '<div class="cs-row"><input class="inp" id="rp_reason" data-testid="rp-reason" placeholder="' + esc(ph) + '" style="flex:1">'
    + '<button type="button" class="act sm" data-testid="rp-' + verb + '-go" onclick="CBRepeat.go(\'' + verb + '\',this)">' + esc(label) + '</button></div>';
}
/** a verb pressed: the forms that need words first (counter · skip · decline · end · pause · refuse); the rest go straight to the server */
function rpAct(id, verb, btn) {
  var p = RP.panel; var form = document.getElementById('rp_form');
  if (!p || p.id !== id) { return rpRowAct(id, verb, btn); }
  if (verb === 'counter') { form.innerHTML = rpCounterForm(p); return; }
  if (verb === 'skip') { form.innerHTML = rpReasonForm('skip', rpT('Skip it'), p.a.side === 'customer' ? rpT('Why — they will read it') : rpT('Why (optional)')); return; }
  if (verb === 'decline' || verb === 'end' || verb === 'pause' || verb === 'refuse') { form.innerHTML = rpReasonForm(verb, rpT(RP_VERB[verb]), rpT('Why (optional)')); return; }
  return rpGo(verb, btn);
}
/** a verb from the LIST row (no panel open): run · agree · resume straight to the server, the row re-read */
function rpRowAct(id, verb, btn) {
  var a = RP.rows.filter(function (x) { return x.agreement_id === id; })[0]; if (!a) return;
  return CBAction.run(btn, function () { return api(rpEpOf(verb), { params: { id: id }, body: {} }); },
    { key: 'rp-' + verb + '-' + id, out: 'rp_why', failed: rpT('That did not go through'), done: rpT(RP_VERB[verb]) + ' ✓', outcome: function (r) { rpSaid(verb, r); rpLoad(true); } });
}
function rpEpOf(verb) { return 'repeat' + verb.charAt(0).toUpperCase() + verb.slice(1); }
function rpSaid(verb, r) {
  var n = verb === 'run' ? ((r && r.ran) || []).length : 0;
  var text = verb === 'run' ? (n ? (typeof txn === 'function' ? txn('{count} run made', '{count} runs made', n) : n + ' made') : rpT('Nothing to run')) : rpT(RP_VERB[verb]) + ' ✓';
  var panel = document.getElementById('rp_panel_why');
  if (panel) { panel.textContent = text; panel.setAttribute('data-tone', 'ok'); return; }
  RP.said = { text: text, tone: 'ok' }; rpHead();   /* the head is repainted on every load: the outcome rides on RP.said */
}
function rpGo(verb, btn) {
  var p = RP.panel; if (!p) return;
  var reason = (document.getElementById('rp_reason') || {}).value || '';
  var body = Object.assign({ chit_id: p.chit }, reason ? { reason: String(reason).trim() } : {});
  var ask = verb === 'end' ? { title: rpT('End this agreement?'), body: rpT('No more runs. What was billed stays.'), yes: rpT('End it') }
    : verb === 'decline' ? { title: rpT('Decline this agreement?'), body: rpT('The shop is told. Nothing is billed.'), yes: rpT('Decline') } : null;
  return CBAction.run(btn, function () { return api(rpEpOf(verb), { params: { id: p.id }, body: body }); },
    { key: 'rp-' + verb + '-' + p.id, out: 'rp_panel_why', confirm: ask, busy: rpT('Working…'), failed: rpT('That did not go through'), outcome: function (r) {
      if (r && r.agreement) p.a = r.agreement;
      rpPanelPaint(); rpSaid(verb, r);
      if (document.getElementById('rp_list')) rpLoad(true);
      /* the sheet's step word (accepted · rejected) is the rail's: read the chit again */
      if ((verb === 'accept' || verb === 'decline') && typeof CBSheet !== 'undefined' && CBSheet.open) CBSheet.open(p.chit);
    } });
}
function rpSendCounter(btn) {
  var p = RP.panel; if (!p) return;
  var lines = []; document.querySelectorAll('[data-testid^="rp-cq-"]').forEach(function (item) { var q = Number(item.value); if (item.getAttribute('data-line') && isFinite(q)) lines.push({ line_id: item.getAttribute('data-line'), quantity: q }); });
  var node = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  var body = { chit_id: p.chit, note: node('rp_c_note') };
  var changed = lines.filter(function (x) { var l = (p.lines || []).filter(function (y) { return y.line_id === x.line_id; })[0]; return l && Number(l.quantity != null ? l.quantity : l.qty) !== x.quantity; });
  if (changed.length) body.lines = changed;
  if (Number(node('rp_c_every')) !== Number(p.a.every) || node('rp_c_unit') !== p.a.unit || (node('rp_c_start') && node('rp_c_start') !== p.a.next_on)) { body.every = Number(node('rp_c_every')); body.unit = node('rp_c_unit'); body.start_on = node('rp_c_start'); }
  return CBAction.run(btn, function () { return api('repeatCounter', { params: { id: p.id }, body: body }); },
    { key: 'rp-counter-' + p.id, out: 'rp_panel_why', busy: rpT('Sending…'), failed: rpT('Could not send the counter'), outcome: function (r) { if (r && r.agreement) p.a = r.agreement; rpPanelPaint(); rpSaid('counter', r); } });
}

var CBRepeat = { start: rpStart, read: rpRead, isAgreement: rpIsAgreement, panelHTML: rpPanelHTML, panel: rpPanel, act: rpAct, go: rpGo, sendCounter: rpSendCounter, mount: rpMount, load: rpLoad };
