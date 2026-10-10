/* cap-crm-leads.js — CB CRM L1: LEADS AS PARTIES. The Leads tab (a CBList mount, the Parties list's own look), Add lead, and the record's
 * stage chip + "Move to…". A lead IS a party (the API's added_via 'lead'); its stage is the server's (memberships, b297) — this page only labels it.
 * ⚠️ BEFORE the API's b297 runs the writes answer 503 LEADS_NOT_MIGRATED: the page says "Lead stages arrive after the next update." — never silence,
 *   never the server's message. Every write goes through CBAction (M64). Needs cap-crm.js (CRM · crmLoad · crmNormalize · crmFuJoin · cells).
 * ⭐ NEW PATHS (rule 4): the Leads list is not a second contact list — it reads GET /api/crm/parties?view=leads (the same rows, leads only) and paints them
 *   with cap-crm.js's own cells; the sheets reuse modal() · CBAction. Nothing here decides a stage or a rule.
 */
'use strict';
var LEADS = { rows: [], state: 'loading', err: null, ready: true, loaded: false, gen: 0, api: null, busy: 0 };
var CRM_STAGE = { lead: 'New lead', demo: 'Demo', trial: 'Trial', parked: 'Not now', lost: 'Lost', customer: 'Customer' };
var CRM_LEADS_WAIT = 'Lead stages arrive after the next update.';

/** the stage, as a chip (the server's word, labelled here) */
function crmStageChip(lead) {
  if (!lead || !lead.stage) return '';
  return '<span class="tag' + (lead.stage === 'lost' ? '' : lead.stage === 'parked' ? ' local' : ' on') + '" data-testid="crm-stage-chip" data-stage="' + esc(lead.stage) + '">' + esc(tx(CRM_STAGE[lead.stage] || lead.stage)) + '</span>';
}
/** what a lead write's failure says, in the shop's words (the server's message is never shown) */
function crmLeadWords(e) {
  var code = e && e.data && e.data.code;
  if (e && e.status === 503) return tx(CRM_LEADS_WAIT);
  if (code === 'EXISTS') return tx('That name is already on your list.');
  if (code === 'BAD_PHONE') return tx('That phone number does not look right.');
  if (code === 'BAD_NAME') return tx('Give the lead a name.');
  if (code === 'IS_CUSTOMER') return tx('They are a customer now.');
  return tx("Couldn't save that. Try again.");
}

/* ═══ THE READ — leads only; kept beside CRM.rows, never inside it (the Parties list stays clean) ═══════════════════ */
async function crmLeadsLoad(quiet) {
  var g = ++LEADS.gen;
  if (!quiet || !LEADS.loaded) { LEADS.state = 'loading'; crmLeadsRefresh(); }
  try {
    var r = await api('crmParties', { query: { view: 'leads' } });
    if (g !== LEADS.gen) return;
    LEADS.ready = !(r && r.leads_migrated === false);
    LEADS.rows = crmNormalize((r && r.parties) || []);
    await crmFuJoin(LEADS.rows, r);
    if (g !== LEADS.gen) return;
    crmLeadsIndex(); LEADS.state = 'ready'; LEADS.loaded = true; LEADS.err = null;
  } catch (e) {
    if (g !== LEADS.gen) return;
    if (LEADS.loaded) LEADS.state = 'ready'; else { LEADS.state = 'error'; LEADS.err = e; }
  }
  crmNav(CRM.route && CRM.route.nav); crmLeadsRefresh();
}
function crmLeadsRefresh() { var a = LEADS.api; if (a && a.el && document.body.contains(a.el)) a.refresh(); }
/** a lead opens on the same record as any party: its key must resolve (crmIndex calls this after every Parties read too) */
function crmLeadsIndex() { LEADS.rows.forEach(function (p) { CRM.byKey[p.party_id] = p; if (p.party_no) CRM.byKey[p.party_no] = p; }); }
/** the record asks for this when a key is no row: a lead opened from a link before the Leads tab was read */
async function crmLeadsEnsure() { if (!LEADS.loaded) await crmLeadsLoad(true); }

/* ═══ THE LEADS TAB ═════════════════════════════════════════════════════════════════════════════════════════════ */
function crmLeadCols() {
  return [
    { key: 'party', label: 'Lead', prio: 1, w: 270, sort: 'name', html: true, cell: crmPartyCell, value: function (p) { return p.display_name; } },
    { key: 'stage', label: 'Stage', prio: 2, w: 150, sort: 'stage', hfilter: 'stage', html: true, cell: function (p) { return crmStageChip(p.lead) || '<span class="sub">—</span>'; }, tid: function (p) { return 'crm-lead-stage-' + crmKey(p); }, value: function (p) { return p.lead ? p.lead.stage : ''; } },
    { key: 'phone', label: 'Phone', prio: 3, w: 170, cell: function (p) { return p.phone || p.otp_contact || '—'; } },
    { key: 'next', label: 'Next follow-up', prio: 4, w: 170, sort: 'next', html: true, cell: crmFuCell, value: function (p) { return p.next_followup_at || '9999'; } },
    { key: 'last', label: 'Last activity', prio: 5, w: 190, html: true, cell: crmLastCell, value: function (p) { return p.last_at || ''; } }];
}
function crmLeadAddBtn() {
  if (!crmEdit()) return '';
  var off = LEADS.loaded && !LEADS.ready;
  return '<button type="button" class="act sm' + (off ? ' ghost' : '') + '" data-testid="crm-lead-add" data-crm="leadadd"' + (off ? ' disabled title="' + esc(tx(CRM_LEADS_WAIT)) + '"' : '') + '>+ ' + esc(tx('Add lead')) + '</button>';
}
function crmLeads(frame) {
  crmBar('<strong>' + esc(tx('CB CRM')) + '</strong>', crmLeadAddBtn(), true);
  var s = document.getElementById('screen'); s.className = 'screen flush';
  s.innerHTML = '<div id="crm_leads" data-testid="crm-leads"></div>';
  if (LEADS.api && LEADS.api.destroy) { try { LEADS.api.destroy(); } catch (_) {} }
  LEADS.api = CBList.mount(document.getElementById('crm_leads'), {
    key: 'crm-leads', t: tx, rows: function () { return LEADS.rows; }, id: function (p) { return p.party_id; }, rowTid: function (p) { return 'crm-lead-' + crmKey(p); },
    columns: crmLeadCols, defaultCols: ['party', 'stage', 'phone', 'next'], cardMax: 3, fill: false,
    head: function () { return { title: tx('Leads'), notices: LEADS.state === 'ready' && !LEADS.ready ? [{ text: tx(CRM_LEADS_WAIT), cls: 'warn', tid: 'crm-leads-wait' }] : [] }; },
    state: function () { return LEADS.state; }, error: function () { return crmErrWords(LEADS.err, 'your leads'); }, onRetry: function () { crmLeadsLoad(); },
    empty: { title: tx(LEADS.ready ? 'No leads yet' : CRM_LEADS_WAIT), sub: tx(LEADS.ready ? 'People you have not traded with yet. Use + Add lead.' : 'Nothing is lost.') },
    search: function (p) { return [p.display_name, p.party_no, p.phone, p.otp_contact].join(' '); }, searchHint: tx('Name or phone'),
    filters: [{ key: 'stage', label: tx('Stage'), all: tx('All stages'), options: ['lead', 'demo', 'trial', 'parked', 'lost'].map(function (k) { return { v: k, label: tx(CRM_STAGE[k]) }; }), match: function (p, v) { return !!p.lead && p.lead.stage === v; } }],
    sorts: [{ key: 'name', label: tx('Name'), cmp: function (a, b) { return String(a.display_name).localeCompare(String(b.display_name), undefined, { sensitivity: 'base' }); } },
      { key: 'next', label: tx('Next follow-up'), cmp: function (a, b) { return String(a.next_followup_at || '9999').localeCompare(String(b.next_followup_at || '9999')); } }],
    onOpen: function (p) { crmGo('#/party/' + encodeURIComponent(crmKey(p))); }
  });
  if (frame) return;
  crmLeadsLoad(LEADS.loaded);
}

/* ═══ ADD LEAD — a name, a phone, a stage ═══════════════════════════════════════════════════════════════════════ */
function crmLeadAddOpen() {
  if (LEADS.loaded && !LEADS.ready) { toast(tx(CRM_LEADS_WAIT)); return; }
  modal('<div class="mhd"><div class="t">' + esc(tx('Add lead')) + '</div></div><div class="mbody" data-testid="crm-lead-sheet">'
    + '<label>' + esc(tx('Name')) + '<input class="inp" id="crm_lead_name" data-testid="crm-lead-name" autocomplete="off"></label>'
    + '<label>' + esc(tx('Phone')) + '<input class="inp" id="crm_lead_phone" data-testid="crm-lead-phone" type="tel" autocomplete="off"></label>'
    + '<label>' + esc(tx('Stage')) + '<select class="inp" id="crm_lead_stage" data-testid="crm-lead-stage">' + ['lead', 'demo', 'trial'].map(function (k) { return '<option value="' + k + '">' + esc(tx(CRM_STAGE[k])) + '</option>'; }).join('') + '</select></label>'
    + '<div id="crm_lead_msg" class="hint" role="status" data-testid="crm-lead-msg"></div></div>'
    + '<div class="mfoot"><button type="button" onclick="closeModal()">' + esc(tx('Cancel')) + '</button><button type="button" class="pri" data-crm="leadsave" data-testid="crm-lead-save">' + esc(tx('Save')) + '</button></div>');
  var n = document.getElementById('crm_lead_name'); if (n) n.focus();
}
function crmLeadSave(btn) {
  var g = function (id) { return String((document.getElementById(id) || {}).value || '').trim(); }, msg = document.getElementById('crm_lead_msg');
  if (!g('crm_lead_name')) { msg.textContent = tx('Give the lead a name.'); return; }
  var body = { name: g('crm_lead_name'), stage: g('crm_lead_stage') || 'lead' }; if (g('crm_lead_phone')) body.phone = g('crm_lead_phone');
  return CBAction.run(btn, async function () { return api('crmLeadAdd', { body: body }); }, {
    key: 'lead-add', busy: tx('Saving…'),
    onFail: function (words, e) { msg.textContent = crmLeadWords(e); },
    outcome: async function (r) {
      closeModal(); toast(tx('Lead added'));
      await crmLeadsLoad(true);
      var id = r && r.party && r.party.party_id; if (id && CRM.byKey[id] && CRM.route && CRM.route.view === 'leads') crmLeadsRefresh();
    }
  });
}

/* ═══ THE RECORD — "Move to…" (the server says which moves, and may/why) ════════════════════════════════════════ */
function crmStageBtn(p) {
  if (!crmEdit() || !p.lead || p.lead.stage === 'customer') return '';
  var may = p.lead.may || { ok: true }, off = may.ok === false;
  return '<button type="button" class="act quiet' + (off ? ' ghost' : '') + '" data-crm="rstage" data-testid="crm-act-stage"' + (off ? ' disabled title="' + esc(tx(CRM_LEADS_WAIT)) + '"' : '') + '>' + esc(tx('Move to…')) + (off ? '<span class="why wide-only">' + esc(tx(CRM_LEADS_WAIT)) + '</span>' : '') + '</button>';
}
function crmStageOpen(p, rec) {
  var lead = (rec && rec.lead) || p.lead; if (!lead) return;
  modal('<div class="mhd"><div class="t">' + esc(tx('Move to…')) + '</div></div><div class="mbody" data-testid="crm-stage-sheet">'
    + '<div class="supacts">' + (lead.moves || []).map(function (k) { return '<button type="button" class="act ghost" data-crm="stagego" data-v="' + esc(k) + '" data-testid="crm-stage-' + esc(k) + '">' + esc(tx(CRM_STAGE[k] || k)) + '</button>'; }).join('') + '</div>'
    + '<div id="crm_stage_msg" class="hint" role="status" data-testid="crm-stage-msg"></div></div>'
    + '<div class="mfoot"><button type="button" onclick="closeModal()">' + esc(tx('Cancel')) + '</button></div>');
}
function crmStageGo(stage, btn) {
  var p = CRMR.p, msg = document.getElementById('crm_stage_msg');
  return CBAction.run(btn, async function () { return api('crmStage', { params: { id: p.party_id }, body: { stage: stage } }); }, {
    key: 'lead-stage:' + p.party_id,
    onFail: function (words, e) { if (msg) msg.textContent = crmLeadWords(e); },
    outcome: async function () {
      closeModal(); toast(tx('Moved'));
      if (LEADS.loaded) await crmLeadsLoad(true);
      await crmLoad(true); if (CRM.route && CRM.route.view === 'party') crmRecordOpen(CRM.route);
    }
  });
}
function crmLeadClick(a, t) {
  if (a === 'leadadd') { crmLeadAddOpen(); return true; }
  if (a === 'leadsave') { crmLeadSave(t); return true; }
  if (a === 'rstage') { crmStageOpen(CRMR.p, CRMR.rec); return true; }
  if (a === 'stagego') { crmStageGo(t.getAttribute('data-v'), t); return true; }
  return false;
}
