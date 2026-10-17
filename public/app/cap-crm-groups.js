/* cap-crm-groups.js — CB CRM: GROUPS & SEGMENTS and the SHOP WINDOW (T3-P2-CRM, 2026-10-14; docs/design/crm/REQUIREMENT-segments.md).
 * The Groups screen (#/groups) is a CBList mount — the Task table's look — one row per SEGMENT (the api's one rule, lib/customer-groups
 * SEGMENT_SQL) and per named GROUP (customer_list.groups, b205): each with its members (the server's count), the offers that are only for it,
 * and who may be sent offers (the server's verdict per member, counted BY CODE — lib/privacy.mayAll). A row's ▸ is the mini-card: the
 * members (each opens the party record), the reach in words, the offers. The Shop window (#/showcase) picks a showcase template (the
 * policy flag `showcase_template`, the workshop's own chooser lifted into app/cap-showcase.js), previews the shop's OWN page, and shares
 * its link with a party or a group through the consented channel.
 * ⭐ REUSE: CBList (every list) · crmMiniBox/crmMiniRow/crmMiniKV (the mini-card) · modal()/closeModal() (the sheets) · CBAction (M64, every
 *   write) · CBConfirm (a delete asks first) · CRM.rows (the members: the Parties list already in memory, REQUIREMENT §9) · crmLog's own route
 *   for the share's out message (the server's gate) · CBShowcase + CBShowcasePick (the templates and the chooser) · policyGet/policySet.
 * ⭐ ONE CALCULATION: no segment, no count and no "may" is worked out here — GET /api/crm/segments answers them; a send asks the server
 *   twice (dry: who may; then the one sender). ⭐ The server's may/why on every action: New group · Send · Delete are SHOWN greyed with the
 *   sentence (`may.group/send/delete`), never hidden. "Make an offer" is greyed with its own sentence: Offer Lab cannot pick a group yet.
 * ⭐ NEW PATHS (rule 4): this module (no groups screen existed — the workshop has a per-customer chip row only); the three sheets (New group ·
 *   Send · Share) — each one field over the new routes; CRM_EP gained the four rows (cap-crm.js).
 * CALLED BY crm.html (#/groups) · cap-crm.js · app.html
 * FLOW crm.html → cap-crm.js → this file paints Groups & segments → the server answers each write
 * // CARD 11-crm-and-marketing/marketing-app
 * Needs cap-crm.js (CRM · crmNav · crmBar · crmGo · crmKey · crmEdit · crmOwner · crmIsLead · cells · modal · CBAction · tx/txf · esc · api). */
'use strict';

var GROUPS = { rows: [], state: 'loading', err: null, loaded: false, gen: 0, api: null, may: null, flags: {}, channel: 'whatsapp', purpose: 'marketing', consent: true, migrated: true };
var CRM_KIND_WORD = { segment: 'Segment', group: 'Group' };
/* the server's codes, in the shop's words (lib/privacy CODES — the screen branches on the code, never on the sentence) */
var CRM_CODE_WORD = { NO_CONSENT: 'no consent yet', SAID_NO: 'said no', CONSENT_WITHDRAWN: 'withdrew consent', OPTED_OUT: 'asked not to be messaged', CONSENT_UNREADABLE: 'consent could not be read' };
var CRM_OFFER_WHY = 'Offer Lab cannot pick a group yet.';

/* ═══ THE READ — one answer: segments + groups, counts, offers, reach, may ═══════════════════════════════════════════ */
function crmGroupsRows(r) {
  var segs = ((r && r.segments) || []).map(function (s) { return Object.assign({ kind: 'segment' }, s); });
  var grs = ((r && r.groups) || []).map(function (g) { return Object.assign({ kind: 'group' }, g); });
  return segs.concat(grs);
}
async function crmGroupsLoad(quiet) {
  var g = ++GROUPS.gen;
  if (!quiet || !GROUPS.loaded) { GROUPS.state = 'loading'; crmGroupsRefresh(); }
  try {
    var r = await api('crmSegments');
    if (g !== GROUPS.gen) return;
    GROUPS.rows = crmGroupsRows(r); GROUPS.may = (r && r.may) || null; GROUPS.channel = (r && r.channel) || 'whatsapp'; GROUPS.purpose = (r && r.purpose) || 'marketing';
    GROUPS.consent = !(r && r.consent_migrated === false); GROUPS.migrated = !(r && r.groups_migrated === false);
    GROUPS.state = 'ready'; GROUPS.loaded = true; GROUPS.err = null;
  } catch (e) {
    if (g !== GROUPS.gen) return;
    if (GROUPS.loaded) GROUPS.state = 'ready'; else { GROUPS.state = 'error'; GROUPS.err = e; }
  }
  if (CRM.route && CRM.route.view === 'groups') crmGroupsBar();
  crmGroupsRefresh();
}
function crmGroupsRefresh() { var a = GROUPS.api; if (a && a.el && document.body.contains(a.el)) a.refresh(); }
/** the server's may/why for an action; before the answer lands the login's level is the guess (the server refuses anyway) */
function crmGroupsMay(k) {
  var m = GROUPS.may && GROUPS.may[k];
  if (m) return m.may ? '' : (m.why || tx('Not allowed'));
  if (k === 'delete') return crmOwner() ? '' : tx('Only the owner deletes a group.');
  return crmEdit() ? '' : tx('Your login can only view.');
}
/** the members of a row, from the Parties list in memory (never a lead, never a walk-in — the same rule the server counts with) */
function crmGroupMembers(row) {
  return CRM.rows.filter(function (p) {
    if (p.kind === 'walk-in' || (p.roles || []).indexOf('customer') < 0 || crmIsLead(p)) return false;
    return row.kind === 'segment' ? p.segment === row.key : (p.groups || []).indexOf(row.name) >= 0;
  });
}
function crmReachWords(reach) {
  var r = reach || { may: 0, not: 0, refused_by: [] };
  var why = (r.refused_by || []).map(function (x) { return x.n + ' ' + tx(CRM_CODE_WORD[x.code] || x.code.toLowerCase()); }).join(' · ');
  return { may: txf('{n} may be sent offers', { n: r.may }), not: r.not ? txf('{n} not', { n: r.not }) + (why ? ' — ' + why : '') : '' };
}
function crmGroupsParamsHref(row) { return row.kind === 'segment' ? '#/parties?seg=' + encodeURIComponent(row.key) : '#/parties?group=' + encodeURIComponent(row.name); }

/* ═══ THE SCREEN — a CBList mount, grouped Segments · Groups ═══════════════════════════════════════════════════════ */
function crmGroupsCols() {
  return [
    { key: 'name', label: 'Segment or group', prio: 1, w: 260, sort: 'name', html: true, cell: function (r) { return '<b>' + esc(r.name) + '</b> <span class="tag' + (r.kind === 'segment' ? ' seg' : '') + '">' + esc(tx(CRM_KIND_WORD[r.kind])) + '</span>'; }, value: function (r) { return r.name; }, tid: function (r) { return 'crm-grp-name-' + crmGroupTid(r); } },
    { key: 'count', label: 'Members', prio: 2, w: 110, num: true, sort: 'count', cell: function (r) { return String(r.count); }, value: function (r) { return r.count; }, tid: function (r) { return 'crm-grp-count-' + crmGroupTid(r); } },
    { key: 'reach', label: 'May be sent offers', prio: 3, w: 220, html: true, sort: 'reach', cell: function (r) { var w = crmReachWords(r.reach); return '<span data-testid="crm-grp-reach-' + crmGroupTid(r) + '">' + esc(String((r.reach || {}).may || 0)) + '</span>' + (r.reach && r.reach.not ? ' <span class="sub">· ' + esc(w.not) + '</span>' : ''); }, value: function (r) { return (r.reach || {}).may || 0; } },
    { key: 'offers', label: 'Offers only for them', prio: 4, w: 160, num: true, cell: function (r) { return String(r.offers || 0); }, value: function (r) { return r.offers || 0; } },
    { key: 'rule', label: 'Rule', prio: 5, w: 280, cell: function (r) { return r.rule ? r.rule + (r.overrides ? ' · ' + txf('{n} set by you', { n: r.overrides }) : '') : tx('Named by you'); } }];
}
function crmGroupTid(r) { return String(r.key).replace(/[^A-Za-z0-9_-]/g, '_'); }
function crmGroupsBar() {
  var why = crmGroupsMay('group');
  var btn = why ? crmViewOnlyBtn('crm-grp-add', '+ ' + tx('New group'), why) : '<button type="button" class="act sm" data-testid="crm-grp-add" data-crm="grpnew">+ ' + esc(tx('New group')) + '</button>';
  if (GROUPS.loaded && !GROUPS.migrated) btn = crmViewOnlyBtn('crm-grp-add', '+ ' + tx('New group'), tx('Named groups need one database step (b205).'));
  crmBar('<strong>' + esc(tx('CRM')) + '</strong>', btn, true);
}
function crmGroupsNotices() {
  var n = [];
  if (!GROUPS.migrated) n.push({ text: tx('Named groups need one database step (b205). Segments still count.'), cls: 'warn', tid: 'crm-grp-nomig' });
  if (!GROUPS.consent) n.push({ text: tx('Consent records are not set up yet (b306). Nobody can be sent offers until they are.'), cls: 'warn', tid: 'crm-grp-noconsent' });
  return n;
}
/** ▸ the mini-card: members · reach · offers — the same three-box shape as a party's */
function crmGroupMini(r) {
  var ms = crmGroupMembers(r), key = crmGroupTid(r), w = crmReachWords(r.reach);
  var names = ms.slice(0, 6).map(function (p) { return crmMiniRow('person', '<a href="#/party/' + esc(encodeURIComponent(crmKey(p))) + '" data-testid="crm-grp-member-' + esc(crmKey(p)) + '">' + esc(p.display_name) + '</a>'); }).join('');
  var more = ms.length > 6 ? crmMiniRow('', '<a href="' + crmGroupsParamsHref(r) + '" data-testid="crm-grp-seeall-' + key + '">' + esc(txf('See all {n} in Parties', { n: ms.length })) + '</a>') : '';
  var members = ms.length ? names + more : '<div class="mc-r sub" style="white-space:normal">' + esc(r.kind === 'group' ? tx('Nobody is in this group yet. Use Members.') : tx('Nobody is in this segment right now.')) + '</div>';
  var reach = [crmMiniRow('msg', '<b data-testid="crm-grp-may-' + key + '">' + esc(w.may) + '</b>'), w.not ? '<div class="mc-r sub" style="white-space:normal;min-height:0" data-testid="crm-grp-not-' + key + '">' + esc(w.not) + '</div>' : '',
    crmMiniKV('Channel', esc(tx('WhatsApp')) + ' · ' + esc(tx('offers')))];
  var offers = [crmMiniKV('Offers only for them', '<b>' + esc(String(r.offers || 0)) + '</b>'), '<div class="mc-r sub" style="white-space:normal;min-height:0">' + esc(tx('An offer "Only for" this set reaches its members in the app and at the counter.')) + '</div>'];
  return '<div class="mc" data-testid="crm-grp-mini-' + key + '">' + crmMiniBox('mc-what', 'Members', [members], 'crm-grp-mini-members-' + key) + crmMiniBox('mc-money', 'Reach', reach, 'crm-grp-mini-reach-' + key) + crmMiniBox('mc-last', 'Offers', offers, 'crm-grp-mini-offers-' + key) + '</div>';
}
function crmGroupsWhyNot(r, act) {
  if (act === 'send') { var w = crmGroupsMay('send'); if (w) return w; return r.count ? '' : tx('Nobody to send to'); }
  if (act === 'members') return GROUPS.migrated ? crmGroupsMay('group') : tx('Named groups need one database step (b205).');
  if (act === 'delete') return crmGroupsMay('delete');
  if (act === 'offer') return tx(CRM_OFFER_WHY);
  return '';
}
function crmGroupsActions() {
  return [
    { id: 'send', label: tx('Send offer message'), icon: '💬', tid: 'crm-grp-send', why: function (r) { return crmGroupsWhyNot(r, 'send'); }, run: function (r) { crmSendOpen(r); } },
    { id: 'offer', label: tx('Make an offer'), icon: '%', tid: 'crm-grp-offer', why: function (r) { return crmGroupsWhyNot(r, 'offer'); }, run: function () { toast(tx(CRM_OFFER_WHY)); } },
    { id: 'members', label: tx('Members'), icon: '☑', tid: 'crm-grp-members', when: function (r) { return r.kind === 'group'; }, why: function (r) { return crmGroupsWhyNot(r, 'members'); }, run: function (r) { crmGroupOpen(r.name); } },
    { id: 'delete', label: tx('Delete group'), icon: '✕', tid: 'crm-grp-delete', when: function (r) { return r.kind === 'group'; }, why: function (r) { return crmGroupsWhyNot(r, 'delete'); }, run: function (r) { crmGroupDelete(r); } },
    { id: 'seeall', label: tx('Open in Parties'), icon: '↗', tid: 'crm-grp-open', run: function (r) { crmGo(crmGroupsParamsHref(r)); } }];
}
function crmGroups(frame) {
  crmGroupsBar();
  var s = document.getElementById('screen'); s.className = 'screen flush';
  s.innerHTML = '<div id="crm_groups" data-testid="crm-groups"></div>';
  if (GROUPS.api && GROUPS.api.destroy) { try { GROUPS.api.destroy(); } catch (_) {} }
  GROUPS.api = CBList.mount(document.getElementById('crm_groups'), {
    key: 'crm-groups', t: tx, rows: function () { return GROUPS.rows; }, id: function (r) { return r.key; }, rowTid: function (r) { return 'crm-grp-' + crmGroupTid(r); },
    columns: crmGroupsCols, defaultCols: ['name', 'count', 'reach'], cardMax: 3, fill: false,
    head: function () { return { title: tx('Groups & segments'), notices: GROUPS.state === 'ready' ? crmGroupsNotices() : [] }; },
    state: function () { return GROUPS.state; }, error: function () { return crmErrWords(GROUPS.err, 'your groups'); }, onRetry: function () { crmGroupsLoad(); },
    empty: { title: tx('No groups yet'), sub: tx('Name one to offer or message a set of customers together. Use + New group.') },
    search: function (r) { return [r.name, r.rule].join(' '); }, searchHint: tx('Segment or group'),
    sorts: [{ key: 'name', label: tx('Name'), cmp: function (a, b) { return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }); } },
      { key: 'count', label: tx('Members'), cmp: function (a, b) { return (b.count || 0) - (a.count || 0); } }, { key: 'reach', label: tx('May be sent offers'), cmp: function (a, b) { return ((b.reach || {}).may || 0) - ((a.reach || {}).may || 0); } }],
    group: { options: [['kind', 'Kind'], ['none', 'None']], default: 'kind', tid: 'crm-groups', as: 'select', fig: function (rows) { return crmPlural(rows.length, 'row', 'rows'); },
      by: function (r, mode) { return mode === 'kind' ? [tx(r.kind === 'segment' ? 'Segments' : 'Groups'), r.kind] : null; } },
    next: function (r) { return crmGroupMini(r); }, actions: crmGroupsActions()
  });
  if (frame) return;
  if (!CRM.loaded) crmLoad(true);   /* the members come from the Parties list in memory */
  crmGroupsLoad(GROUPS.loaded);
}

/* ═══ NEW GROUP · MEMBERS — one sheet: a name, then who is in it (the customers of the Parties list, ticked) ═══════ */
var GSHEET = { name: '', fixed: false, orig: {}, on: {}, q: '' };
function crmGroupOpen(name) {
  GSHEET = { name: name || '', fixed: !!name, orig: {}, on: {}, q: '' };
  if (name) CRM.rows.forEach(function (p) { if ((p.groups || []).indexOf(name) >= 0) { GSHEET.orig[p.party_id] = 1; GSHEET.on[p.party_id] = 1; } });
  modal('<div class="mhd"><div class="t">' + esc(name ? txf('Members of {name}', { name: name }) : tx('New group')) + '</div></div><div class="mbody" data-testid="crm-grp-sheet">'
    + '<label>' + esc(tx('Name')) + '<input class="inp" id="crm_grp_name" data-testid="crm-grp-name" maxlength="40" autocomplete="off" value="' + esc(name || '') + '"' + (name ? ' readonly' : '') + '></label>'
    + '<label>' + esc(tx('Find a customer')) + '<input class="inp" id="crm_grp_q" data-testid="crm-grp-q" placeholder="' + esc(tx('Name, ID, phone')) + '" autocomplete="off" oninput="crmGroupPick(this.value)"></label>'
    + '<div id="crm_grp_list" class="grp-list" data-testid="crm-grp-list"></div>'
    + '<div id="crm_grp_msg" class="hint" role="status" data-testid="crm-grp-msg"></div></div>'
    + '<div class="mfoot"><span class="sub" id="crm_grp_n" data-testid="crm-grp-n" style="margin-right:auto;align-self:center"></span><button type="button" onclick="closeModal()">' + esc(tx('Cancel')) + '</button><button type="button" class="pri" data-crm="grpsave" data-testid="crm-grp-save">' + esc(tx('Save')) + '</button></div>');
  crmGroupPick('');
  var n = document.getElementById(name ? 'crm_grp_q' : 'crm_grp_name'); if (n) n.focus();
}
function crmGroupCands() { return CRM.rows.filter(function (p) { return p.kind !== 'walk-in' && (p.roles || []).indexOf('customer') >= 0 && !crmIsLead(p); }); }
function crmGroupPick(q) {
  GSHEET.q = String(q || '').trim().toLowerCase();
  var box = document.getElementById('crm_grp_list'); if (!box) return;
  var all = crmGroupCands(), m = all.filter(function (p) { return !GSHEET.q || [p.display_name, p.nickname, p.party_no, p.phone, p.user_id].join(' ').toLowerCase().indexOf(GSHEET.q) >= 0; });
  var ticked = all.filter(function (p) { return GSHEET.on[p.party_id]; });
  box.innerHTML = (m.length ? m.slice(0, 60).map(function (p) {
    return '<label class="grp-row" data-testid="crm-grp-cand-' + esc(crmKey(p)) + '"><input type="checkbox" data-crm="grptick" data-k="' + esc(p.party_id) + '"' + (GSHEET.on[p.party_id] ? ' checked' : '') + '><span class="nm">' + esc(p.display_name) + '</span><span class="sub">' + esc(p.party_no || p.phone || '') + '</span></label>';
  }).join('') + (m.length > 60 ? '<div class="hint">' + esc(txf('{n} more — type to narrow', { n: m.length - 60 })) + '</div>' : '') : '<div class="hint">' + esc(all.length ? tx('Nobody matches.') : tx('No customers yet. They appear when you bill them.')) + '</div>');
  var n = document.getElementById('crm_grp_n'); if (n) n.textContent = crmPlural(ticked.length, 'member', 'members');
}
function crmGroupTick(k, on) { if (on) GSHEET.on[k] = 1; else delete GSHEET.on[k]; var n = document.getElementById('crm_grp_n'); if (n) n.textContent = crmPlural(Object.keys(GSHEET.on).length, 'member', 'members'); }
function crmGroupWords(e) {
  var code = e && e.data && e.data.code;
  if (e && e.status === 403) return (e.data && (e.data.why || e.data.message)) || tx('Your login can only view.');
  if (code === 'GROUPS_NOT_MIGRATED') return tx('Named groups need one database step (b205).');
  if (code === 'BAD_NAME') return tx('Name the group: up to 40 letters, digits, spaces, - & /.');
  if (code === 'TOO_MANY_GROUPS') return tx('A customer can be in at most 20 groups.');
  if (code === 'TOO_MANY') return tx('At most 500 at a time.');
  if (code === 'NOTHING_TO_DO') return tx('Tick at least one customer.');
  return tx("Couldn't save the group. Try again.");
}
function crmGroupSave(btn) {
  var name = String((document.getElementById('crm_grp_name') || {}).value || '').replace(/\s+/g, ' ').trim(), msg = document.getElementById('crm_grp_msg');
  if (!name) { msg.textContent = tx('Name the group.'); return; }
  var add = Object.keys(GSHEET.on).filter(function (k) { return !GSHEET.orig[k]; }), remove = Object.keys(GSHEET.orig).filter(function (k) { return !GSHEET.on[k]; });
  if (!add.length && !remove.length) { msg.textContent = tx('Tick at least one customer.'); return; }
  return CBAction.run(btn, async function () { return api('crmGroupSet', { body: { name: name, add: add, remove: remove } }); }, {
    key: 'group-save', busy: tx('Saving…'),
    onFail: function (words, e) { msg.textContent = crmGroupWords(e); },
    outcome: async function (r) {
      closeModal(); toast(txf('{name}: {n}', { name: (r && r.name) || name, n: crmPlural((r && r.count) || 0, 'member', 'members') }));
      await crmLoad(true); crmGroupsLoad(true);
    }
  });
}
/** a delete asks first — with the offers that name it (the server's count): they would reach no one */
function crmGroupDelete(r) {
  var body = r.offers ? txf('{n} only for this group. They will reach no one.', { n: crmPlural(r.offers, 'offer is', 'offers are') }) : tx('Its members stay your customers; only the name goes.');
  CBAction.run(null, async function () { return api('crmGroupDel', { params: { name: r.name } }); }, {
    key: 'group-del', confirm: { title: txf('Delete group {name}?', { name: r.name }), body: esc(body), yes: r.offers ? tx('Delete anyway') : tx('Delete') },
    onFail: function (words, e) { toast(crmGroupWords(e)); },
    outcome: async function () { toast(txf('{name} deleted', { name: r.name })); await crmLoad(true); crmGroupsLoad(true); }
  });
}

/* ═══ SEND — the one sheet: who may (the server's dry answer, by code), then the send through the one sender ═══════ */
var SEND = { row: null, dry: null, done: null };
function crmSendOpen(r, pre) {
  SEND = { row: r, dry: null, done: null };
  modal('<div class="mhd"><div class="t">' + esc(txf('Send to {name}', { name: r.name })) + '</div><span class="sub">' + esc(crmPlural(r.count, 'member', 'members')) + '</span></div><div class="mbody" data-testid="crm-send-sheet">'
    + '<div class="kv"><b>' + esc(tx('Channel')) + '</b><span data-testid="crm-send-channel">' + esc(tx('WhatsApp')) + ' · ' + esc(tx('offers — only to those who agreed')) + '</span></div>'
    + '<label>' + esc(tx('Message')) + '<textarea class="inp" id="crm_send_text" data-testid="crm-send-text" rows="4" maxlength="1000">' + esc((pre && pre.text) || '') + '</textarea></label>'
    + '<div id="crm_send_who" class="hint" role="status" data-testid="crm-send-who">' + esc(tx('Check who may be sent first; nothing goes out until you press Send.')) + '</div>'
    + '<div id="crm_send_out" data-testid="crm-send-out"></div></div>'
    + '<div class="mfoot"><button type="button" onclick="closeModal()">' + esc(tx('Close')) + '</button><button type="button" data-crm="sendcheck" data-testid="crm-send-check">' + esc(tx('Who may be sent?')) + '</button>'
    + '<button type="button" class="pri" data-crm="sendgo" data-testid="crm-send-go" disabled title="' + esc(tx('Check first')) + '">' + esc(tx('Send')) + '</button></div>');
  var t = document.getElementById('crm_send_text'); if (t) t.focus();
}
function crmSendWords(e) {
  var code = e && e.data && e.data.code, m = e && e.data && (e.data.why || e.data.message);
  if (e && e.status === 403) return m || tx('Your login can only view.');
  if (code === 'NO_TEXT') return tx('Write the message.');
  if (code === 'TOO_LONG') return tx('Keep the message under 1000 characters.');
  if (code === 'TOO_MANY') return m || tx('Send to at most 100 at a time. Make a smaller group.');
  if (code === 'CHANNEL_NOT_SENDABLE') return tx('Only WhatsApp can be sent from here today.');
  return tx("Couldn't send. Try again.");
}
function crmSendBody(dry) { return { channel: GROUPS.channel, purpose: GROUPS.purpose, text: String((document.getElementById('crm_send_text') || {}).value || '').trim(), dry: !!dry }; }
function crmSendCheck(btn) {
  var who = document.getElementById('crm_send_who'), go = document.getElementById('crm_send_go') || document.querySelector('[data-testid="crm-send-go"]');
  var body = crmSendBody(true); if (!body.text) { who.textContent = tx('Write the message.'); return; }
  return CBAction.run(btn, async function () { return api('crmSegSend', { params: { key: SEND.row.key }, body: body }); }, {
    key: 'send-check', busy: tx('Checking…'),
    onFail: function (words, e) { who.textContent = crmSendWords(e); },
    outcome: function (r) {
      SEND.dry = r;
      var w = crmReachWords({ may: r.may, not: r.refused_n, refused_by: r.refused_by });
      who.innerHTML = '<b data-testid="crm-send-may">' + esc(w.may) + '</b>' + (w.not ? ' · ' + esc(w.not) : '') + (r.refused && r.refused.length ? '<div class="sub" data-testid="crm-send-refused">' + r.refused.slice(0, 5).map(function (x) { return esc(x.name) + ' — ' + esc(x.why); }).join('<br>') + (r.refused.length > 5 ? '<br>…' : '') + '</div>' : '');
      if (go) { go.disabled = !(r.may > 0); go.title = r.may > 0 ? '' : tx('Nobody may be sent this'); go.textContent = r.may > 0 ? txf('Send to {n}', { n: r.may }) : tx('Send'); }
    }
  });
}
function crmSendGo(btn) {
  var out = document.getElementById('crm_send_out'), body = crmSendBody(false);
  if (!SEND.dry || !(SEND.dry.may > 0)) { out.innerHTML = '<div class="hint">' + esc(tx('Check who may be sent first.')) + '</div>'; return; }
  return CBAction.run(btn, async function () { return api('crmSegSend', { params: { key: SEND.row.key }, body: body }); }, {
    key: 'send-go', busy: tx('Sending…'),
    onFail: function (words, e) { out.innerHTML = '<div class="banner bad" data-testid="crm-send-fail">' + esc(crmSendWords(e)) + '</div>'; },
    outcome: function (r) {
      SEND.done = r;
      /* three facts, never one number: sent · not sent (the sender refused or failed — its reason is on each line) · not asked (no consent — the server's codes) */
      var notSent = (r.sent || []).filter(function (x) { return x.status !== 'sent'; }).length, notAsked = (r.refused_by || []).reduce(function (a, x) { return a + (Number(x.n) || 0); }, 0);
      var line = [txf('{n} sent', { n: r.sent_n || 0 }), notSent ? txf('{n} not sent', { n: notSent }) : '', notAsked ? txf('{n} not asked — no consent', { n: notAsked }) : ''].filter(Boolean).join(' · ');
      out.innerHTML = '<div class="result" data-testid="crm-send-done"><span><span class="k">' + esc(tx('Outcome')) + '</span><b>' + esc(line) + '</b></span></div>'
        + ((r.sent || []).length ? '<div class="sub" data-testid="crm-send-lines">' + r.sent.slice(0, 8).map(function (x) { return esc(x.name || x.party_id) + ' — ' + esc(tx(x.status)) + (x.reason ? ': ' + esc(x.reason) : ''); }).join('<br>') + (r.sent.length > 8 ? '<br>…' : '') + '</div>' : '');
      var go = document.querySelector('[data-testid="crm-send-go"]'); if (go) { go.disabled = true; go.title = tx('Sent'); }
    }
  });
}

/* ═══ THE SHOP WINDOW — pick a template, preview the shop's own page, share the link through the consented channel ═══ */
var SHOW = { flags: null, state: 'loading', err: null, gen: 0, party: null, rec: null, busy: false };
function crmShopUrl() { var id = SESSION.bridgeId || SESSION.userId || ''; return location.origin + '/shop.html?s=' + encodeURIComponent(id); }
function crmShowcase(frame) {
  crmBar('<strong>' + esc(tx('CRM')) + '</strong>', '', false);
  var s = document.getElementById('screen'); s.className = 'screen';
  s.innerHTML = '<div class="content" data-testid="crm-showcase"><div class="rsec" style="padding:14px"><div class="sec">' + esc(tx('Shop window')) + '</div>'
    + '<p class="hint" style="margin:0 0 10px">' + esc(tx('Your customers see this page. Pick its look, then share the link with those who agreed to hear from you.')) + '</p>'
    + '<div id="crm_sc_pick" data-testid="crm-sc-pick"><div class="loadwrap"><span class="spin"></span>' + esc(tx('Reading…')) + '</div></div></div>'
    + '<div class="rsec" style="padding:14px"><div class="sec">' + esc(tx('Share')) + '</div>'
    + '<div class="kv"><b>' + esc(tx('Link')) + '</b><span class="mono" data-testid="crm-sc-url">' + esc(crmShopUrl()) + '</span></div>'
    + '<div class="supacts"><button type="button" class="act sm quiet" data-crm="sccopy" data-testid="crm-sc-copy">' + esc(tx('Copy link')) + '</button>'
    + '<button type="button" class="act sm quiet" data-crm="scgroup" data-testid="crm-sc-group">' + esc(tx('Share with a group')) + '</button></div>'
    + '<label style="display:block;margin-top:12px;font-size:13.5px;font-weight:600">' + esc(tx('Share with a party')) + '<input class="inp" id="crm_sc_q" data-testid="crm-sc-q" placeholder="' + esc(tx('Name, ID, phone')) + '" autocomplete="off" oninput="crmSharePick(this.value)"></label>'
    + '<div id="crm_sc_res" data-testid="crm-sc-res"></div><div id="crm_sc_party" data-testid="crm-sc-party"></div></div></div>';
  if (frame) return;
  if (!CRM.loaded) crmLoad(true);
  crmShowcaseLoad();
}
async function crmShowcaseLoad() {
  var g = ++SHOW.gen;
  try { var r = await api('policyGet'); if (g !== SHOW.gen) return; SHOW.flags = (r && r.flags) || {}; SHOW.state = 'ready'; }
  catch (e) { if (g !== SHOW.gen) return; SHOW.flags = {}; SHOW.state = 'error'; SHOW.err = e; }
  crmShowcasePaint();
}
function crmShowcasePaint() {
  var box = document.getElementById('crm_sc_pick'); if (!box || typeof CBShowcasePick === 'undefined') return;
  var why = crmEdit() ? '' : tx('Your login can only view.');
  box.innerHTML = (SHOW.state === 'error' ? '<div class="hint" data-testid="crm-sc-readfail">' + esc(tx('Could not read the current choice. The default is shown.')) + '</div>' : '')
    + CBShowcasePick.html({ current: SHOW.flags && SHOW.flags.showcase_template, shopId: SESSION.bridgeId || SESSION.userId || '', t: tx, cls: 'act sm quiet', clsOn: 'act sm', why: why, origin: '' })
    + '<div id="crm_sc_msg" class="hint" role="status" data-testid="crm-sc-msg"></div>';
}
function crmShowcasePick(name, btn) {
  var msg = document.getElementById('crm_sc_msg');
  return CBAction.run(btn, async function () { return api('policySet', { body: { showcase_template: name } }); }, {
    key: 'sc-pick', busy: tx('Saving…'),
    onFail: function (words, e) { if (msg) msg.textContent = (e && e.status === 403 && e.data && (e.data.why || e.data.message)) || tx("Couldn't save the choice. Try again."); },
    outcome: function () { SHOW.flags = Object.assign({}, SHOW.flags, { showcase_template: name }); crmShowcasePaint(); toast(tx('Shop window saved')); }
  });
}
/* share with a party: the record's own consent verdict (contact_prefs.may — the server's code) decides whether Share is lit */
function crmSharePick(q) {
  var box = document.getElementById('crm_sc_res'); if (!box) return;
  q = String(q || '').trim().toLowerCase(); if (!q) { box.innerHTML = ''; return; }
  var m = CRM.rows.filter(function (p) { return p.kind !== 'walk-in' && [p.display_name, p.nickname, p.party_no, p.phone, p.user_id].join(' ').toLowerCase().indexOf(q) >= 0; }).slice(0, 5);
  box.innerHTML = m.map(function (p) { return '<button type="button" class="result" style="text-align:left;background:var(--surface);width:100%;margin-top:6px" data-crm="scparty" data-k="' + esc(p.party_id) + '" data-testid="crm-sc-pick-' + esc(crmKey(p)) + '"><span><b>' + esc(p.display_name) + '</b> <span class="sub">' + esc(p.party_no || p.phone || '') + '</span></span></button>'; }).join('')
    || '<div class="hint">' + esc(tx('Nobody matches.')) + '</div>';
}
async function crmShareParty(k) {
  var p = CRM.byKey[k] || CRM.rows.filter(function (x) { return x.party_id === k; })[0], box = document.getElementById('crm_sc_party'); if (!p || !box) return;
  SHOW.party = p; SHOW.rec = null;
  box.innerHTML = '<div class="loadwrap"><span class="spin"></span>' + esc(tx('Reading their consent…')) + '</div>';
  var g = ++SHOW.gen;
  try { SHOW.rec = await api('crmParty', { params: { id: p.party_id } }); } catch (e) { if (typeof cblog === 'function') cblog('error', 'share: record read failed: ' + ((e && e.message) || e)); SHOW.rec = null; }
  if (g !== SHOW.gen || SHOW.party !== p) return;
  crmSharePaint();
}
function crmShareVerdict() {
  var rec = SHOW.rec, cp = rec && rec.contact_prefs, v = cp && cp.may && cp.may[GROUPS.channel] && cp.may[GROUPS.channel][GROUPS.purpose];
  if (!rec) return { may: false, code: 'UNREADABLE', why: tx('Could not read their consent, so nothing can be sent.') };
  if (!v) return { may: false, code: 'NO_CONSENT', why: tx('No consent for offers on WhatsApp. Ask them first.') };
  return v;
}
function crmSharePaint() {
  var p = SHOW.party, box = document.getElementById('crm_sc_party'); if (!p || !box) return;
  var v = crmShareVerdict(), phone = String(p.phone || '').replace(/[^0-9]/g, ''), why = v.may ? (phone ? '' : tx('No phone number yet')) : (v.why || tx('Not allowed'));
  if (!crmEdit()) why = tx('Your login can only view.');
  box.innerHTML = '<div class="result" data-testid="crm-sc-verdict" data-code="' + esc(v.code || '') + '"><span><span class="k">' + esc(tx('Share with')) + '</span><b>' + esc(p.display_name) + '</b></span>'
    + '<span class="tag' + (v.may ? ' on' : ' amber') + '" data-testid="crm-sc-may">' + esc(v.may ? tx('They agreed to offers') : tx('Not now')) + '</span></div>'
    + '<div class="supacts" style="margin-top:8px">' + (why ? crmViewOnlyBtn('crm-sc-share', tx('Share on WhatsApp'), why) : '<button type="button" class="act sm" data-crm="scshare" data-testid="crm-sc-share">' + esc(tx('Share on WhatsApp')) + '</button>') + '</div>';
}
/** the share: the shop's own phone sends it (wa.me, the device), and the out message is LOGGED through the gated route — the server decides again */
function crmShareGo(btn) {
  var p = SHOW.party; if (!p) return;
  var phone = String(p.phone || '').replace(/[^0-9]/g, ''), text = txf('Have a look at our shop window: {url}', { url: crmShopUrl() });
  return CBAction.run(btn, async function () { return api('crmLog', { params: { id: p.party_id }, body: { kind: 'message', direction: 'out', channel: GROUPS.channel, purpose: GROUPS.purpose, body: text } }); }, {
    key: 'sc-share', busy: tx('Opening…'),
    onFail: function (words, e) { var box = document.getElementById('crm_sc_party'); if (box) box.insertAdjacentHTML('beforeend', '<div class="banner bad" data-testid="crm-sc-refused">' + esc((e && e.data && (e.data.why || e.data.message)) || tx("Couldn't share. Try again.")) + '</div>'); },
    outcome: function () {
      var w = window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      if (!w && typeof cblog === 'function') cblog('warn', 'share: the WhatsApp window was blocked');
      toast(tx('Shared — the message is on their timeline'));
    }
  });
}
function crmShareGroup() {
  if (!GROUPS.loaded) { toast(tx('Reading your groups…')); return crmGroupsLoad(true).then(crmShareGroup); }
  var rows = GROUPS.rows;
  if (!rows.length) { toast(tx('No groups yet. Make one under Groups.')); return; }
  modal('<div class="mhd"><div class="t">' + esc(tx('Share with a group')) + '</div></div><div class="mbody" data-testid="crm-sc-groups">'
    + rows.map(function (r) { return '<button type="button" class="result" style="text-align:left;background:var(--surface)" data-crm="scgrouppick" data-k="' + esc(r.key) + '" data-testid="crm-sc-grp-' + crmGroupTid(r) + '"><span><b>' + esc(r.name) + '</b> <span class="sub">' + esc(crmPlural(r.count, 'member', 'members')) + ' · ' + esc(crmReachWords(r.reach).may) + '</span></span></button>'; }).join('')
    + '</div><div class="mfoot"><button type="button" onclick="closeModal()">' + esc(tx('Cancel')) + '</button></div>');
}

/* ═══ the clicks this module answers (cap-crm.js's one listener asks) ═══════════════════════════════════════════════ */
function crmGroupsClick(a, t) {
  if (a === 'grpnew') { crmGroupOpen(null); return true; }
  if (a === 'grptick') { crmGroupTick(t.getAttribute('data-k'), t.checked); return true; }
  if (a === 'grpsave') { crmGroupSave(t); return true; }
  if (a === 'sendcheck') { crmSendCheck(t); return true; }
  if (a === 'sendgo') { crmSendGo(t); return true; }
  if (a === 'sccopy') { var u = crmShopUrl(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject(new Error('no clipboard'))).then(function () { toast(tx('Link copied')); }, function () { toast(u); }); return true; }
  if (a === 'scgroup') { crmShareGroup(); return true; }
  if (a === 'scgrouppick') { var r = GROUPS.rows.filter(function (x) { return x.key === t.getAttribute('data-k'); })[0]; closeModal(); if (r) crmSendOpen(r, { text: txf('Have a look at our shop window: {url}', { url: crmShopUrl() }) }); return true; }
  if (a === 'scparty') { crmShareParty(t.getAttribute('data-k')); return true; }
  if (a === 'scshare') { crmShareGo(t); return true; }
  return false;
}
document.addEventListener('click', function (ev) {
  var t = ev.target.closest && ev.target.closest('[data-sc-pick]'); if (!t || t.disabled) return;
  if (CRM.route && CRM.route.view === 'showcase') crmShowcasePick(t.getAttribute('data-sc-pick'), t);
});
