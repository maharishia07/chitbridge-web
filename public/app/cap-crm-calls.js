/* cap-crm-calls.js — CB CRM L2: THE CALL DESK. The Calls tab (a CBList mount, the Follow-ups list's own look): today's queue, one-tap outcome buttons.
 * ⭐ THE SERVER DECIDES: GET /api/crm/calls sends the queue AND the list of outcomes; the next-follow-up days and the stage moves live in the API's
 *   lib/crm-calls.js (OUTCOMES). This page only gives each outcome its word and its picture (CALL_WORD · CALL_ICO) and sends { outcome, after? | due_at? }.
 * ⚠️ BEFORE the API's b297 runs an outcome that moves a stage answers 503 LEADS_NOT_MIGRATED: the button is greyed WITH its sentence, and the server still refuses.
 *   Every write goes through CBAction (M64). Never the server's message. Needs cap-crm.js (CRM · crmEdit · crmGo · crmBar · crmNav · crmErrWords) and cap-crm-leads.js (CRM_STAGE · crmStageChip).
 * ⭐ NEW PATHS (rule 4): the Calls list is not a second follow-up list — it paints GET /api/crm/calls (follow-ups due + untouched leads) with the Follow-ups list's own unit; nothing here decides a day or a stage.
 */
'use strict';
var CALLS = { rows: [], outcomes: [], may: { ok: true }, state: 'loading', err: null, loaded: false, gen: 0, api: null, scope: null, late: 0 };
/* the outcome keys are the server's; the words and pictures are this page's (docs/design/ICON-MAP.md rows "Call: …") */
var CALL_WORD = { no_answer: 'No answer', call_back: 'Call back', interested: 'Interested', demo_booked: 'Demo booked', not_now: 'Not now', wrong_number: 'Wrong number' };
var CALL_ICO = { no_answer: '📵', call_back: '↩', interested: '👍', demo_booked: '📅', not_now: '⏳', wrong_number: '🚫' };
var CALL_PRESET = { today: 'Today', tomorrow: 'Tomorrow', '3days': 'In 3 days' };
var CALL_VIEW_ONLY = 'Your login can only view';

/** what a call write's failure says, in the shop's words (the server's message is never shown) */
function crmCallWords(e) {
  var code = e && e.data && e.data.code;
  if (code === 'LEADS_NOT_MIGRATED') return tx(CRM_LEADS_WAIT);
  if (code === 'CRM_NOT_MIGRATED') return tx('Calls and follow-ups start after an update. Nothing is lost.');
  if (code === 'NEED_DAY') return tx('Pick a day.');
  if (code === 'BAD_DUE' || code === 'BAD_AFTER') return tx('Pick a day from today.');
  if (code === 'NOT_FOUND') return tx('Not your party.');
  return tx("Couldn't save that. Try again.");
}

/* ═══ THE READ ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
async function crmCallsLoad(quiet) {
  var g = ++CALLS.gen;
  if (!quiet || !CALLS.loaded) { CALLS.state = 'loading'; crmCallsRefresh(); }
  try {
    var r = await api('crmCalls', { query: { scope: CALLS.scope || (crmOwner() ? 'all' : 'mine') } });
    if (g !== CALLS.gen) return;
    CALLS.rows = ((r && r.calls) || []).map(function (c) { return Object.assign({ id: c.followup_id || 'new-' + c.party_id }, c); });
    CALLS.outcomes = (r && r.outcomes) || []; CALLS.may = (r && r.may) || { ok: true }; CALLS.late = Number(r && r.late) || 0;
    CALLS.state = 'ready'; CALLS.loaded = true; CALLS.err = null;
  } catch (e) {
    if (g !== CALLS.gen) return;
    if (CALLS.loaded) CALLS.state = 'ready'; else { CALLS.state = e && e.status === 503 ? 'notyet' : 'error'; CALLS.err = e; }
  }
  crmNav(CRM.route && CRM.route.nav); crmCallsRefresh();
}
function crmCallsRefresh() { var a = CALLS.api; if (a && a.el && document.body.contains(a.el)) a.refresh(); }

/* ═══ THE ROW ════════════════════════════════════════════════════════════════════════════════════════════════════ */
function crmCallPhone(c) {
  return c.phone ? '<a href="tel:' + esc(String(c.phone).replace(/\s+/g, '')) + '" data-testid="crm-call-tel-' + esc(c.party_id) + '">' + esc(c.phone) + '</a>' : '<span class="sub">' + esc(tx('no phone')) + '</span>';
}
function crmCallDue(c) {
  if (c.new) return '<span class="tag on" data-testid="crm-call-new">' + esc(tx('New')) + '</span>';
  if (c.late) return '<span class="late red">⚠ ' + esc(tx('Late')) + ' · ' + esc(bkDate(c.due_day)) + '</span>';
  return esc(tx('Today'));
}
function crmCallLast(c) { return c.last_outcome ? esc(tx(c.last_outcome)) + (c.last_at ? ' <span class="sub">' + esc(bkDate(c.last_at)) + '</span>' : '') : '<span class="sub">—</span>'; }
/** why this outcome is greyed for this login — the sentence; '' = allowed (the server still refuses) */
function crmCallWhy(o) {
  return function () {
    if (!crmEdit()) return tx(CALL_VIEW_ONLY);
    if (o.moves && CALLS.may && CALLS.may.ok === false) return tx(CRM_LEADS_WAIT);
    return '';
  };
}
function crmCallActions() {
  return (CALLS.outcomes || []).map(function (o) {
    return { id: o.key, label: tx(CALL_WORD[o.key] || o.key), icon: CALL_ICO[o.key] || '•', tid: 'crm-call-' + o.key, why: crmCallWhy(o), run: function (c) { crmCallPick(c, o); } };
  });
}

/* ═══ THE ONE TAP ════════════════════════════════════════════════════════════════════════════════════════════════ */
function crmCallPick(c, o) {
  if (!o.ask) { crmCallSend(c, o, {}, null); return; }
  CALLS.pick = { c: c, o: o };
  modal('<div class="mhd"><div class="t">' + esc(tx(CALL_WORD[o.key] || o.key)) + ' · ' + esc(c.party_name || '') + '</div></div><div class="mbody" data-testid="crm-call-ask">'
    + '<div class="supacts">' + (o.presets || []).map(function (k) { return '<button type="button" class="act ghost" data-crm="callafter" data-v="' + esc(k) + '" data-testid="crm-call-after-' + esc(k) + '">' + esc(tx(CALL_PRESET[k] || k)) + '</button>'; }).join('') + '</div>'
    + '<label>' + esc(tx('Pick a day')) + '<input class="inp" type="date" id="crm_call_day" data-testid="crm-call-day"></label>'
    + '<div id="crm_call_msg" class="hint" role="status" data-testid="crm-call-msg"></div></div>'
    + '<div class="mfoot"><button type="button" onclick="closeModal()">' + esc(tx('Cancel')) + '</button><button type="button" class="pri" data-crm="callday" data-testid="crm-call-day-save">' + esc(tx('Save')) + '</button></div>');
}
function crmCallSend(c, o, extra, btn) {
  var msg = document.getElementById('crm_call_msg');
  return CBAction.run(btn, async function () { return api('crmOutcome', { params: { id: c.party_id }, body: Object.assign({ outcome: o.key }, extra) }); }, {
    key: 'call-outcome:' + c.party_id, busy: btn ? tx('Saving…') : undefined,
    onFail: function (words, e) { if (msg) msg.textContent = crmCallWords(e); else toast(crmCallWords(e)); },
    outcome: async function (r) {
      closeModal(); toast(r && r.suggest ? tx('Saved. Try Not now?') : tx('Saved'));
      CALLS.rows = CALLS.rows.filter(function (x) { return x.party_id !== c.party_id; }); crmCallsRefresh();
      await crmCallsLoad(true); crmLoad(true); if (typeof LEADS !== 'undefined' && LEADS.loaded) crmLeadsLoad(true);
    }
  });
}
function crmCallClick(a, t) {
  if (a === 'callafter' || a === 'callday') {
    var p = CALLS.pick; if (!p) return true;
    var extra = {};
    if (a === 'callafter') extra.after = t.getAttribute('data-v');
    else { var d = String((document.getElementById('crm_call_day') || {}).value || ''); if (!d) { var m = document.getElementById('crm_call_msg'); if (m) m.textContent = tx('Pick a day.'); return true; } extra.due_at = d; }
    crmCallSend(p.c, p.o, extra, t); return true;
  }
  return false;
}

/* ═══ THE CALLS TAB ═════════════════════════════════════════════════════════════════════════════════════════════ */
function crmCalls(frame) {
  crmBar('<strong>' + esc(tx('CB CRM')) + '</strong>', '', true);
  var s = document.getElementById('screen'); s.className = 'screen flush';
  s.innerHTML = '<div id="crm_calls" data-testid="crm-calls"></div>';
  if (CALLS.api && CALLS.api.destroy) { try { CALLS.api.destroy(); } catch (_) {} }
  var def = crmOwner() ? 'all' : 'mine', el = document.getElementById('crm_calls');
  CALLS.api = CBList.mount(el, {
    key: 'crm-calls', t: tx, rows: function () { return CALLS.state === 'ready' ? CALLS.rows : []; }, id: function (c) { return c.id; }, rowTid: function (c) { return 'crm-call-row-' + c.party_id; },
    columns: [{ key: 'party', label: 'Lead', prio: 1, w: 260, html: true, cell: function (c) { return '<span class="nm">' + esc(c.party_name || '—') + '</span>'; }, value: function (c) { return c.party_name; } },
      { key: 'phone', label: 'Phone', prio: 2, w: 170, html: true, cell: crmCallPhone, value: function (c) { return c.phone || ''; } },
      { key: 'stage', label: 'Stage', prio: 3, w: 130, html: true, cell: function (c) { return crmStageChip({ stage: c.stage }); }, value: function (c) { return c.stage; } },
      { key: 'due', label: 'Due', prio: 4, w: 170, html: true, cell: crmCallDue, value: function (c) { return c.due_day || '0000'; } },
      { key: 'last', label: 'Last call', prio: 5, w: 200, html: true, cell: crmCallLast, value: function (c) { return c.last_at || ''; } }],
    defaultCols: ['party', 'phone', 'due'], cardMax: 3, fill: false,
    head: function () { return { title: tx('Calls'), chips: CALLS.state === 'ready' && !CALLS.rows.length ? [{ text: tx('No calls today'), tid: 'crm-calls-none' }] : [] }; },
    state: function () { return CALLS.state === 'loading' ? 'loading' : (CALLS.state === 'error' ? 'error' : null); },
    error: function () { return crmErrWords(CALLS.err, 'your calls'); }, onRetry: function () { crmCallsLoad(); },
    empty: function () { return CALLS.state === 'notyet' ? { title: tx('Calls and follow-ups start after an update.'), sub: tx('Nothing is lost.') } : { title: tx('No calls today.'), sub: tx('Add leads, or log a call with a follow-up.') }; },
    search: function (c) { return [c.party_name, c.phone].join(' '); }, searchHint: tx('Name or phone'),
    filters: [{ key: 'scope', label: tx('Show'), all: tx(def === 'all' ? 'Everyone' : 'Mine'), options: [{ v: def === 'all' ? 'mine' : 'all', label: tx(def === 'all' ? 'Mine' : 'Everyone') }], match: function () { return true; } }],
    onOpen: function (c) { crmGo('#/party/' + encodeURIComponent(c.party_id)); },
    actions: crmCallActions()
  });
  crmWatch(el, function (c) { CALLS.scope = c.filt.scope || def; crmCallsLoad(); });
  if (!frame) crmCallsLoad(CALLS.loaded);
}
