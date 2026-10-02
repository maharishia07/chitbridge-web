/* cap-crm-record.js — CB CRM: ONE party's record, its timeline, the Log sheet, the Next block, and the party edit.
 * Loaded by crm.html after cap-crm.js (which owns the list, the router and the shared helpers). docs/design/crm/REQUIREMENT-record.md ·
 * REQUIREMENT-timeline.md · FLOWS F3–F8 · the designer handoff, where the FROZEN list standard wins: both timeline views are CBList
 * mounts (the record's latest five, and the full server-paged history) — no entry, row or card is drawn by hand.
 *
 * ⭐ REUSE (rule 1): CBList (every list) · partyDueChipHTML / partyBooksHTML / partyStatementLoad / partyEditOpen / payOpen / bkMoney / bkDate
 * (cap-books.js — the Ledger block, the dues chip, the edit sheet, Receive/Pay) · openChitSheet (chit-sheet.js — a chit, bill or message
 * opens in place) · CBLedger.run (accounts-shell.js — the Switch on) · custPatch/supPatch/custAdd (the existing relationship routes).
 * ⭐ ONE CALCULATION (rule 2): no money, no due-ness, no step and no on-ChitBridge is worked out here. Amounts are `amount_minor` /
 * `balance_minor` / `credit_limit_minor` painted by bkMoney; "late" is the server's; a bill's step word is the server's `state.word`;
 * the place-of-supply words are mapped from the server's `supply_type`.
 * ⭐ NEW PATHS (rule 4): the identity block + Next block + entry grammar (REQUIREMENT-record §4 — nothing gathered these per party; each
 * is an arrangement of existing tokens), the Log sheet (no store or sheet for a call/visit/note existed), `custDel` (customers had no
 * remove route; same shape as supDel).
 */
'use strict';
var CRMR = { tok: 0, p: null, rec: null, menu: false, tl: null, tlApi: null, headApi: null, keep: {} };

/* what a kind looks like: [icon, tone-when-the-state-gives-none, word for screen readers] */
var CRM_KIND = {
  chit: ['chit', '', 'Chit'], message: ['msg', 'blue', 'Message'], message_internal: ['msg', '', 'Internal message'], bill: ['bill', '', 'Bill'], payment: ['pay', 'green', 'Payment'],
  dispute: ['flag', 'red', 'Dispute'], call: ['phone', '', 'Call'], visit: ['pin', '', 'Visit'], whatsapp: ['wa', 'green', 'WhatsApp'], note: ['note', '', 'Note'],
  mail: ['mail', '', 'Mail'], followup: ['clock', 'amber', 'Follow-up'], change: ['pencil', '', 'Change'], link: ['link', 'green', 'Linked'],
};
var CRM_TABS = [['all', 'All'], ['messages', 'Messages'], ['bills', 'Bills'], ['notes', 'Notes & calls'], ['mail', 'Mail'], ['followups', 'Follow-ups']];
var CRM_SUPPLY = { intra: 'Same state — CGST and SGST', inter: 'Another state — IGST' };
var CRM_ADDED = { counter: 'At the counter', storefront: 'Storefront', handle: 'By User ID', name: 'By name', chit: 'From a chit', import: 'Imported' };
var CRM_CHAN = { chitbridge: 'ChitBridge', email: 'E-mail', phone: 'Phone', sms: 'SMS', whatsapp: 'WhatsApp' };

/* ═══ THE TIMELINE ENTRY — one grammar for every kind: mark · line · by · time · chip (REQUIREMENT-timeline §4) ═══════ */
function crmEntryWhat(e) {
  var k = CRM_KIND[e.kind] || CRM_KIND.note, tone = (e.state && e.state.tone) || k[1] || '';
  var unread = e.thread && e.thread.unread;
  return '<div class="entry' + (e.theirs ? ' theirs' : '') + '" data-testid="crm-entry-' + esc(e.id) + '" data-kind="' + esc(e.kind) + '"><span class="mk ' + esc(tone) + '" title="' + esc(tx(k[2])) + '">' + crmIcon(k[0]) + '<span class="sr-only">' + esc(tx(k[2])) + '</span></span>'
    + '<span class="tx"><span' + (unread ? ' class="unread-line"' : '') + '>' + (unread ? '<span class="udot" title="' + esc(tx('Unread')) + '"></span> ' : '') + esc(e.line) + '</span>' + (e.kind === 'message_internal' ? '<span class="tagi">' + esc(tx('internal')) + '</span>' : '')
    + (e.thread && e.thread.count > 1 ? ' <span class="sub">+' + (e.thread.count - 1) + ' ' + esc(tx('more')) + '</span>' : '')
    + '<span class="by">' + (e.theirs ? '<span style="color:var(--blue-i)">↙</span> ' : '') + esc(e.by || '') + (e.direction ? ' · ' + esc(tx(e.direction === 'in' ? 'in' : 'out')) : '') + '</span></span></div>';
}
function crmEntryState(e) {
  var h = '';
  if (e.state && e.state.word) h += '<span class="tag ' + esc(e.state.tone || '') + '" data-testid="crm-state-' + esc(e.id) + '">' + esc(e.state.word) + '</span>';
  if (e.amount_minor != null) h += ' <span class="mono" data-testid="crm-amt-' + esc(e.id) + '">' + esc(bkMoney(e.amount_minor, e.currency)) + '</span>';
  if (e.fix && crmEdit()) h += ' <button type="button" class="crm-mini" data-crm="fixaddr" data-testid="crm-fix-' + esc(e.id) + '">' + esc(tx(e.fix)) + '</button>';
  return h || '<span class="sub">—</span>';
}
function crmTlCols() {
  return [{ key: 'what', label: 'What', prio: 1, w: 560, html: true, cell: crmEntryWhat, value: function (e) { return e.line; } },
    { key: 'when', label: 'When', prio: 2, w: 150, html: true, cell: function (e) { return esc(crmWhen(e.at)); }, value: function (e) { return e.at; } },
    { key: 'state', label: 'State', prio: 3, w: 210, html: true, cell: crmEntryState, value: function (e) { return (e.state && e.state.word) || ''; } }];
}
function crmEntryNext(e) {
  var long = /^(call|visit|whatsapp|note)$/.test(e.kind);
  return '<div data-testid="crm-entry-next-' + esc(e.id) + '">' + (long ? '<div style="white-space:pre-wrap">' + esc(e.line) + '</div>' : '') + CBList.nextRow(['<span style="color:var(--muted)">' + esc(tx('By')) + '</span> ' + esc(e.by || '—') + ' · ' + esc(bkDate(e.at)) + ' ' + esc(bkTime(e.at))], []) + '</div>';
}
function crmEntryOpen(e) {
  if (e.chit_id) return openChitSheet(e.chit_id);
  if (e.followup_id) return crmGo('#/followups');
}
function crmDayGroup(e) { var d = new Date(e.at); return [crmDayWord(e.at), isNaN(d) ? 'x' : crmLocalISO(d)]; }

/* ═══ THE RECORD ═════════════════════════════════════════════════════════════════════════════════════════════════ */
async function crmRecordOpen(route) {
  var tok = ++CRMR.tok, s = document.getElementById('screen');
  CRMR.menu = false;
  if (!CRM.loaded) { s.className = 'screen'; s.innerHTML = '<div class="content"><div class="loadwrap" role="status"><span class="spin"></span>' + esc(tx('Reading…')) + '</div></div>'; await crmLoad(true); if (tok !== CRMR.tok) return; }
  var p = CRM.byKey[route.key];
  if (!p) return crmRecordFold(route, tok);
  crmNav('parties');
  CRMR.p = p; CRMR.rec = null;
  var back = '<a href="#/parties" data-testid="crm-back">‹ ' + esc(tx('Parties')) + '</a>' + (p.party_no ? ' <span class="sub">/</span> <span class="mono">' + esc(p.party_no) + '</span>' : '');
  crmBar(back, route.sub === 'timeline' ? '' : '');
  if (route.sub === 'timeline') return crmTimelineView(p, tok);
  s.className = 'screen';
  /* header from the list row at once (no flash); the sections fill as the record read returns */
  s.innerHTML = '<div class="rec" data-testid="crm-record">' + crmHeaderHTML(p) + '<div class="loadwrap" role="status" data-testid="crm-rec-loading"><span class="spin"></span>' + esc(tx('Reading…')) + '</div></div>';
  var rec;
  try { rec = await api('crmParty', { params: { id: p.party_id } }); }
  catch (e) {
    if (tok !== CRMR.tok) return;
    s.querySelector('.loadwrap').outerHTML = '<div class="empty" data-testid="crm-rec-error"><div class="t">' + esc(tx("Couldn't open this party.")) + '</div><button type="button" class="act ghost" data-crm="recretry" data-testid="crm-rec-retry">' + esc(tx('Try again')) + '</button></div>';
    return;
  }
  if (tok !== CRMR.tok) return;
  CRMR.rec = rec || {};
  crmRecordPaint(p, CRMR.rec);
  if (route.sub === 'log') crmLogOpen(p);
  else if (route.sub === 'edit') crmEditOpen(p);
}
/** a key that is no row: a folded party opens its keeper once with "Merged from …" (the server answers the keeper's record) */
async function crmRecordFold(route, tok) {
  var s = document.getElementById('screen');
  try {
    var rec = await api('crmParty', { params: { id: route.key } });
    if (tok !== CRMR.tok) return;
    var keeper = rec && CRM.byKey[rec.party_id];
    if (keeper) { CRMR.mergedNote = rec.merged_from || route.key; return crmGo('#/party/' + encodeURIComponent(crmKey(keeper)), true); }
  } catch (_) {}
  if (tok !== CRMR.tok) return;
  crmBar('<a href="#/parties">‹ ' + esc(tx('Parties')) + '</a>', '');
  s.className = 'screen';
  s.innerHTML = '<div class="content"><div class="empty" data-testid="crm-rec-missing"><div class="t">' + esc(tx("Couldn't open this party.")) + '</div><a class="act ghost" href="#/parties">' + esc(tx('Back to parties')) + '</a></div></div>';
}
function crmHeaderHTML(p) {
  var legal = p.legal_name && p.legal_name !== p.display_name ? '<div class="legal" data-testid="crm-legal">' + esc(p.legal_name) + '</div>' : '';
  return '<div class="rhead"><h1 data-testid="crm-rec-name">' + esc(p.display_name) + '</h1>' + legal
    + '<div class="rchips">' + crmRoleChips(p) + crmRailChip(p) + (CRM.ledger && p.balance_minor != null ? crmDueCell(p) : '') + crmSegChip(p) + '</div></div>';
}
function crmIdentityHTML(p, rec) {
  if (p.kind === 'walk-in') return '<div class="idblk walk" data-testid="crm-ident"><div class="verdict off">' + crmIcon('walk') + '<span>' + esc(tx('Walk-in — known by phone at the counter. A party number comes when you add them.')) + '</span></div></div>';
  var on = !!p.on_chitbridge, minted = p.kind === 'local' || !p.bridge_id;
  var cell = function (k, v, none, tid) { return '<div class="c"><div class="k">' + esc(tx(k)) + '</div><div class="v' + (v ? '' : ' none') + '" data-testid="' + tid + '">' + (v ? esc(v) : esc(tx(none))) + '</div></div>'; };
  var why = p.why_not === 'inactive' ? 'Account inactive — bills are yours only.' : p.why_not === 'other_population' ? 'Test space — bills are yours only.' : 'Not on ChitBridge — bills are yours only.';
  return '<div class="idblk' + (on ? '' : ' local') + '" data-testid="crm-ident">' + '<div class="cells">'
    + cell('Party no', p.party_no, '—', 'crm-id-no') + cell('User ID', minted ? null : p.user_id, 'none — kept by you', 'crm-id-user') + cell('ChitBridge ID', minted ? null : p.bridge_id, '—', 'crm-id-bridge') + '</div>'
    + (on ? '<div class="verdict on" data-testid="crm-verdict">' + crmIcon('link') + '<span><b>' + esc(tx('On ChitBridge')) + '</b> — ' + esc(tx('bills, orders and messages reach them in their app.')) + '</span></div>'
      : '<div class="verdict off" data-testid="crm-verdict">' + crmIcon('house') + '<span>' + esc(tx(why)) + '</span></div>') + '</div>';
}
/* ── Next: only failing or due things, each with its button (SYSTEM rule 1) ── */
function crmNextHTML(p, rec) {
  var items = [], ed = crmEdit(), key = esc(crmKey(p));
  var btn = function (a, label, pri, extra, tid) { return ed ? '<button type="button" class="act sm' + (pri ? '' : ' ghost') + '" data-crm="' + a + '"' + (extra || '') + ' data-testid="' + tid + '">' + esc(tx(label)) + '</button>' : ''; };
  (rec.followups || []).forEach(function (f) {
    if (!f.late && f.bucket !== 'today' && f.due_today !== true && crmDayWord(f.due_at) !== tx('Today')) return;
    items.push('<div class="nx" data-testid="crm-next-followup"><span class="ic">' + crmIcon('clock') + '</span><span class="tx"><b>' + (f.late ? esc(tx('Late since')) + ' ' + esc(bkDate(f.due_at)) : esc(tx('Today')) + ' ' + esc(bkTime(f.due_at))) + '</b> · ' + esc(f.what) + '<span class="s">' + esc(f.assignee_name || tx('Unassigned')) + '</span></span>'
      + '<span class="btns">' + btn('rfudone', 'Done', true, ' data-id="' + esc(f.followup_id) + '"', 'crm-next-done-' + esc(f.followup_id)) + '</span></div>');
  });
  if (p.unread) items.push('<div class="nx" data-testid="crm-next-unread"><span class="ic">' + crmIcon('msg') + '</span><span class="tx"><b>' + esc(crmPlural(p.unread, 'unread message', 'unread messages')) + '</b></span><span class="btns"><a class="act sm" href="#/party/' + key + '/timeline?f=messages" data-testid="crm-next-open-msgs">' + esc(tx('Open')) + '</a></span></div>');
  if (CRM.ledger && p.dues_overdue) {
    var owes = p.balance_minor > 0;
    items.push('<div class="nx" data-testid="crm-next-dues"><span class="ic">' + crmIcon('pay') + '</span><span class="tx"><b>' + esc(tx(owes ? 'Late dues' : 'You are late paying')) + '</b> · ' + esc(tx('oldest since')) + ' ' + esc(bkDate(p.oldest_due)) + '</span><span class="btns">'
      + (owes ? btn('rremind', 'Remind', false, '', 'crm-next-remind') + btn('rpay', 'Receive payment', true, '', 'crm-next-pay') : btn('rpay', 'Pay', true, '', 'crm-next-pay')) + '</span></div>');
  }
  var mine = (p.tax_ids || []).filter(function (t) { return t.scheme === 'GSTIN'; })[0];
  if (rec.gstn_profile && mine && rec.gstn_profile !== mine.value && CRMR.keep[p.party_id + rec.gstn_profile] !== 1)
    items.push('<div class="nx" data-testid="crm-next-gstin"><span class="ic">' + crmIcon('warn') + '</span><span class="tx"><b>' + esc(tx('GSTIN differs from their profile')) + '</b><span class="s mono">' + esc(tx('Yours')) + ' ' + esc(mine.value) + ' · ' + esc(tx('theirs')) + ' ' + esc(rec.gstn_profile) + '</span></span><span class="btns">'
      + btn('rgtheirs', 'Use theirs', true, '', 'crm-gstin-theirs') + btn('rgmine', 'Keep mine', false, '', 'crm-gstin-mine') + '</span></div>');
  if (rec.mail_bounced) items.push('<div class="nx" data-testid="crm-next-bounce"><span class="ic">' + crmIcon('mail') + '</span><span class="tx"><b>' + esc(tx('Mail bounced')) + '</b> · ' + esc(rec.mail_bounced.to) + '<span class="s">' + esc(crmWhen(rec.mail_bounced.at)) + ' — ' + esc(tx('check the address')) + '</span></span><span class="btns">' + btn('fixaddr', 'Fix address', true, '', 'crm-next-fix') + '</span></div>');
  var c = rec.contacts || {};
  if (p.kind !== 'walk-in' && !((c.phones || []).length || (c.emails || []).length)) items.push('<div class="nx" data-testid="crm-next-nocontact"><span class="ic">' + crmIcon('phone') + '</span><span class="tx"><b>' + esc(tx('No phone or e-mail yet')) + '</b></span><span class="btns">' + btn('redit', 'Add', true, '', 'crm-next-add') + '</span></div>');
  return items.length ? '<section class="next" aria-label="' + esc(tx('Next')) + '" data-testid="crm-next"><div class="nh">' + esc(tx('Next')) + '</div>' + items.join('') + '</section>' : '';
}
/* ── the actions: Message (on ChitBridge) › Call › Mail; Log · Follow-up · Edit · More. Hidden for a viewer, never disabled-and-unexplained ── */
function crmMailBlock(p, rec) {
  var e = (rec.prefs || []).filter(function (x) { return x.channel === 'email'; })[0], c = rec.contacts || {};
  if (e && e.allowed === false) return tx('They asked not to be mailed');
  if (!(c.emails || []).length) return tx('No e-mail yet');
  return '';
}
function crmActionsHTML(p, rec) {
  if (!crmEdit()) return '';
  var c = rec.contacts || {}, phone = (c.phones || [])[0], mail = (c.emails || []).filter(function (m) { return !(rec.mail_bounced && rec.mail_bounced.to === m); })[0] || (c.emails || [])[0], mb = crmMailBlock(p, rec), primary, inline = [];
  var key = esc(crmKey(p)), icon = function (k) { return crmIcon(k); };
  var mailBtn = '<a class="act ghost wide-only" href="mailto:' + esc(mail || '') + '" data-crm="mail" data-testid="crm-act-mail">' + icon('mail') + esc(tx('Mail')) + '</a>';
  var callBtn = function (pri) { return '<a class="act' + (pri ? '' : ' ghost wide-only') + '" href="tel:' + esc(String(phone || '').replace(/\s+/g, '')) + '" data-crm="call" data-testid="crm-act-call">' + icon('phone') + esc(tx('Call')) + '</a>'; };
  if (p.kind === 'walk-in') primary = '<button type="button" class="act" data-crm="walkin" data-testid="crm-act-walkin">' + icon('plus') + esc(tx('Add to my parties')) + '</button>';
  else if (p.on_chitbridge) { primary = '<button type="button" class="act" data-crm="message" data-testid="crm-act-message">' + icon('msg') + esc(tx('Message')) + '</button>'; if (!mb) inline.push(mailBtn); if (phone) inline.push(callBtn(false)); }
  else if (phone) { primary = callBtn(true); if (!mb) inline.push(mailBtn); }
  else if (!mb) primary = mailBtn.replace('ghost wide-only', '');
  else primary = '<button type="button" class="act" data-crm="redit" data-testid="crm-act-addcontact">' + icon('plus') + esc(tx('Add phone or e-mail')) + '</button>';
  var more = [];
  if (p.kind !== 'walk-in') more.push('<button type="button" class="narrow-only" data-crm="rfu" data-testid="crm-more-fu">' + icon('clock') + esc(tx('Follow-up')) + '</button>', '<button type="button" class="narrow-only" data-crm="redit" data-testid="crm-more-edit">' + icon('pencil') + esc(tx('Edit')) + '</button>');
  if (mb && p.kind !== 'walk-in') more.push('<button type="button" disabled data-testid="crm-act-mail-off" title="' + esc(mb) + '">' + icon('mail') + esc(tx('Mail')) + '<span class="why" data-testid="crm-mail-why">' + esc(mb) + '</span></button>');
  if (!mb && inline.indexOf(mailBtn) >= 0) more.push('<a class="narrow-only" style="display:flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;text-decoration:none;color:var(--ink)" href="mailto:' + esc(mail || '') + '">' + icon('mail') + esc(tx('Mail')) + '</a>');
  if (p.kind !== 'walk-in' && p.roles.length === 1) more.push('<button type="button" data-crm="alsorole" data-testid="crm-more-also">' + icon('plus') + esc(tx(p.roles[0] === 'customer' ? 'Also a supplier' : 'Also a customer')) + '</button>');
  if (crmOwner() && p.kind !== 'walk-in') {
    var open = CRM.ledger && !!p.balance_minor;
    more.push('<button type="button" class="danger" data-crm="rremove" data-testid="crm-more-remove"' + (open ? ' disabled' : '') + '>' + icon('warn') + esc(tx('Remove from my parties')) + (open ? '<span class="why">' + esc(tx('dues open')) + '</span>' : '') + '</button>');
  }
  var wide = p.kind === 'walk-in' ? '' : '<button type="button" class="act quiet wide-only" data-crm="rfu" data-testid="crm-act-fu">' + icon('clock') + esc(tx('Follow-up')) + '</button><button type="button" class="act quiet wide-only" data-crm="redit" data-testid="crm-act-edit">' + icon('pencil') + esc(tx('Edit')) + '</button>';
  return '<div class="actbar pin" role="toolbar" aria-label="' + esc(tx('Actions')) + '" data-testid="crm-actions">' + primary + inline.join('') + '<button type="button" class="act quiet" data-crm="rlog" data-testid="crm-act-log">' + icon('note') + esc(tx('Log')) + '</button>' + wide
    + '<span class="more"><button type="button" class="act quiet" data-crm="rmore" aria-haspopup="true" aria-expanded="' + CRMR.menu + '" data-testid="crm-act-more">' + icon('dots') + esc(tx('More')) + '</button>' + (CRMR.menu && more.length ? '<div class="menu" role="menu" data-testid="crm-more-menu">' + more.join('') + '</div>' : '') + '</span></div>';
}
function crmSec(id, title, fact, body, open) {
  return '<details class="rsec" data-testid="crm-sec-' + id + '"' + (open ? ' open' : '') + '><summary>' + esc(tx(title)) + '<span class="fact" data-testid="crm-sec-fact-' + id + '">' + (fact || '') + '</span></summary><div class="rbody">' + body + '</div></details>';
}
function crmKV(l, v) { return v == null || v === '' ? '' : '<div class="kv"><b>' + esc(tx(l)) + '</b><span>' + v + '</span></div>'; }
function crmRecordPaint(p, rec) {
  var R = Object.assign({}, p, rec), s = document.getElementById('screen'), c = rec.contacts || {}, one = R.roles.length === 1, ed = crmEdit();
  var merged = CRMR.mergedNote ? '<div class="banner" data-testid="crm-merged">' + crmIcon('link') + '<span>' + esc(txf('Merged from {no}', { no: CRMR.mergedNote })) + '</span></div>' : ''; CRMR.mergedNote = null;
  var secs = [];
  /* Timeline — the latest five (a CBList mount) and See all */
  var all = (rec.counts && rec.counts.all) != null ? rec.counts.all : (rec.timeline_head || []).length;
  secs.push(crmSec('timeline', 'Timeline', all ? esc(crmPlural(all, 'entry', 'entries')) : '', '<div class="tl-wrap"><div id="crm_tlhead" data-testid="crm-tl-head"></div></div>'
    + (all > 5 ? '<div style="padding-top:10px"><a class="act sm ghost" href="#/party/' + esc(crmKey(p)) + '/timeline" data-testid="crm-tl-all">' + esc(txf('See all {n}', { n: all })) + '</a></div>' : ''), true));
  /* Who & contact */
  var prefs = (rec.prefs || []).map(function (x) { return CRM_CHAN[x.channel] ? esc(tx(CRM_CHAN[x.channel])) + ': ' + esc(x.allowed === false ? tx('Not allowed') : x.allowed ? tx('Allowed') + (x.purpose ? ' · ' + tx(x.purpose) : '') : tx('Not recorded')) : ''; }).filter(Boolean);
  ['email', 'phone', 'whatsapp'].forEach(function (ch) { if (!(rec.prefs || []).some(function (x) { return x.channel === ch; })) prefs.push(esc(tx(CRM_CHAN[ch])) + ': ' + esc(tx('Not recorded'))); });
  var who = crmKV('Legal name', R.legal_name && R.legal_name !== R.display_name ? esc(R.legal_name) : '')
    + crmKV('Phone', (c.phones || []).map(esc).join('<br>')) + crmKV('E-mail', (c.emails || []).map(function (m) { return esc(m) + (rec.mail_bounced && rec.mail_bounced.to === m ? ' <span class="tag amber">' + esc(tx('bounced')) + '</span>' : ''); }).join('<br>'))
    + crmKV('Address', esc(c.address || '')) + (p.city ? crmKV('City', esc(p.city)) : '') + crmKV('Contact preferences', prefs.join('<br>'))
    + (!(c.phones || []).length && !(c.emails || []).length && p.kind !== 'walk-in' ? '<div class="kv"><span>' + esc(tx('No phone or e-mail yet')) + '</span></div>' : '');
  secs.push(crmSec('who', 'Who & contact', esc((c.phones || [])[0] || (c.emails || [])[0] || ''), who || '<div class="hint">' + esc(tx('Nothing more is recorded')) + '</div>', true));
  /* Tax & terms */
  var cu = rec.customer, su = rec.supplier, lim = function (x) { return x && x.credit_limit_minor != null ? ' · ' + esc(tx('limit')) + ' ' + esc(bkMoney(x.credit_limit_minor, p.currency)) : ''; };
  var days = function (x) { return x && x.credit_days != null ? esc(txf('{n} days', { n: x.credit_days })) + lim(x) : ''; };
  var gst = (R.tax_ids || []).filter(function (t) { return t.scheme === 'GSTIN'; })[0];
  var tax = crmKV('Tax IDs', (R.tax_ids || []).map(function (t) { return esc(t.scheme) + ' <span class="mono">' + esc(t.value) + '</span>'; }).join('<br>'))
    + crmKV('State', R.state_code ? esc(R.state_code) + (R.supply_type ? ' · ' + esc(tx(CRM_SUPPLY[R.supply_type] || R.supply_type)) : '') : '')
    + (cu ? crmKV('Credit you give', days(cu)) : '') + (su ? crmKV('Credit you get', days(su)) : '');
  secs.push(crmSec('tax', 'Tax & terms', gst ? '<span class="mono">' + esc(gst.value) + '</span>' : '', tax || '<div class="hint">' + esc(tx('Nothing more is recorded')) + '</div>', false));
  /* Customer · Supplier */
  if (cu) secs.push(crmSec('customer', 'Customer', esc(txf('{n} bills', { n: cu.txn_count || 0 })),
    crmKV('Bills', esc(String(cu.txn_count || 0))) + crmKV('Last bill', cu.last_bill_at ? esc(bkDate(cu.last_bill_at)) : '') + crmKV('Customer since', cu.since ? esc(bkDate(cu.since)) : '') + crmKV('Added', esc(tx(CRM_ADDED[cu.added_via] || cu.added_via || '')))
    + crmKV('Segment', cu.segment ? esc(tx(CRM_SEG[cu.segment] || cu.segment)) + (cu.segment_override ? ' · ' + esc(tx('set by you')) : '') : '') + crmKV('Groups', (cu.groups || []).map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join(' '))
    + crmKV('Points', rec.points ? esc(String(rec.points.balance)) + (rec.points.programme ? ' · ' + esc(rec.points.programme) : '') : ''), one));
  if (su) secs.push(crmSec('supplier', 'Supplier', su.category ? esc(su.category) : '',
    crmKV('Category', esc(su.category || '')) + crmKV('Preferred', su.preferred ? esc(tx('Yes')) : '') + crmKV('Supplies', esc(tx(su.supply_kind === 'resale' ? 'For resale' : su.supply_kind === 'own_use' ? 'For the shop' : su.supply_kind || '')))
    + crmKV('Catalogue', su.catalogue ? esc(tx('On ChitBridge')) : '') + crmKV('Availability', '<span class="sub">' + esc(tx("can't tell — not built yet")) + '</span>') + (su.notes ? '<div class="kv" data-testid="crm-notes"><b>' + esc(tx('Notes')) + '</b><span>📌 ' + esc(su.notes) + '</span></div>' : ''), one));
  /* Ledger — cap-books.js's own block; off → one line and the owner's switch */
  if (p.kind !== 'walk-in') {
    var kind = cu ? 'customer' : 'supplier', pid = p.party_id;
    if (CRM.ledger) secs.push(crmSec('ledger', 'Ledger', p.balance_minor != null ? crmDueCell(p) : '', '<div id="crm_ledger" data-testid="crm-ledger"></div>', false));
    else secs.push(crmSec('ledger', 'Ledger', '', '<p style="margin:8px 0">' + esc(tx('Dues show when CB Accounts is on')) + '</p>' + (crmOwner() ? '<button type="button" class="act sm" data-crm="ledgeron" data-testid="crm-ledger-on">' + esc(tx('Switch on')) + '</button>' : ''), false));
  }
  if (crmOwner() && (rec.changes || []).length) secs.push(crmSec('changes', 'History of changes', esc(crmPlural(rec.changes.length, 'change', 'changes')), (rec.changes || []).map(function (x) { return '<div class="kv" data-testid="crm-change"><b>' + esc(bkDate(x.at)) + '</b><span>' + esc(x.line) + ' <span class="sub">· ' + esc(x.by || '') + '</span></span></div>'; }).join(''), false));
  s.className = 'screen';
  s.innerHTML = '<div class="rec" data-testid="crm-record" data-party="' + esc(p.party_id) + '">' + merged + crmHeaderHTML(R) + crmIdentityHTML(R, rec) + crmNextHTML(R, rec) + crmActionsHTML(R, rec) + secs.join('') + '</div>';
  /* the mounts */
  crmEditPrep(p, rec);
  var head = document.getElementById('crm_tlhead');
  if (head) { if (CRMR.headApi) { try { CRMR.headApi.destroy(); } catch (_) {} } CRMR.headApi = CBList.mount(head, { key: 'crm-tl-head', t: tx, fill: false, view: 'lines', tools: { search: false, csv: false }, rows: function () { return rec.timeline_head || []; }, id: function (e) { return e.id; },
    columns: crmTlCols, rowTid: function (e) { return 'crm-tl-' + e.id; }, onOpen: crmEntryOpen, next: crmEntryNext, empty: { title: tx('Nothing yet with this party.'), sub: tx('Use Log to record a call or note.') } }); }
  var led = document.getElementById('crm_ledger');
  if (led) led.innerHTML = partyBooksHTML(cu ? 'customer' : 'supplier', p.party_id, crmLedgerRow(p, rec));
}
function crmLedgerRow(p, rec) {
  var side = rec.customer || rec.supplier || {};
  return { party_no: p.party_no, legal_name: p.legal_name, nickname: p.nickname, tax_ids: p.tax_ids, credit_days: side.credit_days, credit_limit_minor: side.credit_limit_minor };
}

/* ── the party edit: cap-books.js's own sheet (partyEditOpen), fed the record's ids and terms; the CRM list is its one source ── */
function crmEditPrep(p, rec) {
  var set = function (list, idKey, kind, side, listId) {
    var row = list.filter(function (r) { return r[idKey] === p.party_id; })[0]; if (!row) return;
    Object.assign(row, { display_name: p.display_name, nickname: p.nickname, legal_name: p.legal_name, tax_ids: p.tax_ids.slice(), state_code: p.state_code, party_no: p.party_no,
      credit_days: side && side.credit_days != null ? side.credit_days : null, credit_limit_minor: side && side.credit_limit_minor != null ? side.credit_limit_minor : null });
    row[kind === 'supplier' ? 'supplier_list_id' : 'customer_list_id'] = side && side.list_id;
    var other = kind === 'supplier' ? rec.customer : rec.supplier;
    row.also = other && other.list_id ? { kind: kind === 'supplier' ? 'customer' : 'supplier', id: other.list_id } : null;
    row.contacts = (p.kind === 'local') ? { phone: ((rec.contacts || {}).phones || [])[0] || '', email: ((rec.contacts || {}).emails || [])[0] || '' } : null;
  };
  set(UI.custs, 'customer_identity_id', 'customer', rec.customer);
  set(UI.sups, 'supplier_entity_id', 'supplier', rec.supplier);
}
function crmEditOpen(p) {
  var kind = (CRMR.rec && CRMR.rec.customer) ? 'customer' : 'supplier';
  partyEditOpen(kind, p.party_id);
}
/** cap-books.js calls this after a party edit saves: the list and the record are read again (one source) */
function crmAfterEdit(kind, partyId) { crmLoad(true).then(function () { if (CRM.route && CRM.route.view === 'party') crmRecordOpen(CRM.route); }); }

/* ═══ THE TIMELINE — the whole history, answered 50 at a time by the server (never read all at once) ════════════════════
   A CBList mount like every list: the kind filter and the search sit in the unit's own Filters and search box (the head stays three rows);
   the page asks the server again when either changes (crmWatch), and asks for the next 50 when the rows are scrolled to the end. */
async function crmTlLoad(more) {
  var T = CRMR.tl; if (!T || (more && (T.busy || !T.next))) return;
  var g = ++T.gen; T.busy = !!more;
  if (!more) { T.state = 'loading'; T.entries = []; if (CRMR.tlApi) CRMR.tlApi.refresh(); }
  try {
    var r = await api('crmTimeline', { params: { id: T.p.party_id }, query: { kind: T.kind === 'all' ? '' : T.kind, q: T.q || '', before: more ? T.next : '' } });
    if (g !== T.gen) return;
    T.entries = (more ? T.entries : []).concat((r && r.entries) || []); T.next = (r && r.next_before) || null; T.counts = (r && r.counts) || T.counts || {}; T.state = 'ready';
  } catch (e) { if (g !== T.gen) return; T.state = 'error'; T.err = e; }
  T.busy = false;
  if (CRMR.tlApi) CRMR.tlApi.refresh({ filters: crmTlFilters(T) });
}
function crmTlFilters(T) {
  return [{ key: 'kind', label: tx('Show'), all: tx('All') + (T.counts.all != null ? ' (' + T.counts.all + ')' : ''), match: function () { return true; },
    options: CRM_TABS.filter(function (t) { return t[0] !== 'all' && (T.counts[t[0]] == null || T.counts[t[0]] > 0); }).map(function (t) { return { v: t[0], label: tx(t[1]) + (T.counts[t[0]] != null ? ' (' + T.counts[t[0]] + ')' : '') }; }) }];
}
function crmTimelineView(p, tok) {
  var s = document.getElementById('screen'), f = (CRM.route.params || {}).f;
  var T = CRMR.tl = { p: p, kind: 'all', q: '', entries: [], next: null, counts: {}, state: 'loading', gen: 0, err: null, busy: false };
  crmBar('<a href="#/party/' + esc(crmKey(p)) + '" data-testid="crm-back">‹ ' + esc(p.display_name) + '</a>', crmEdit() ? '<button type="button" class="act sm" data-crm="rlog" data-testid="crm-act-log">+ ' + esc(tx('Log a call or note')) + '</button>' : '', true);
  s.className = 'screen flush';
  s.innerHTML = '<div id="crm_tl" data-testid="crm-timeline"></div>';
  if (CRMR.tlApi) { try { CRMR.tlApi.destroy(); } catch (_) {} }
  var el = document.getElementById('crm_tl');
  CRMR.tlApi = CBList.mount(el, {
    key: 'crm-timeline', t: tx, rows: function () { return T.state === 'ready' ? T.entries : []; }, id: function (e) { return e.id; }, rowTid: function (e) { return 'crm-tl-' + e.id; },
    columns: crmTlCols, view: 'grid',
    head: function () { return { title: tx('Timeline') + ' · ' + p.display_name, chips: T.state === 'ready' && T.counts[T.kind] != null ? [{ text: T.entries.length + ' ' + tx('of') + ' ' + T.counts[T.kind], tid: 'crm-tl-of' }] : [] }; },
    state: function () { return T.state === 'loading' ? 'loading' : T.state === 'error' ? 'error' : null; },
    error: function () { return { title: tx("Couldn't load the history."), sub: tx('The record’s other sections still show.') }; }, onRetry: function () { crmTlLoad(false); },
    empty: { title: tx('Nothing yet with this party.'), sub: tx('Use Log a call or note.') },
    filters: crmTlFilters(T), search: function () { var i = el.querySelector('[data-cbl-q]'); return i ? i.value : ''; }, searchHint: tx('Search this history'),
    group: { default: 'on', tid: 'crm-tl', by: crmDayGroup },
    onScroll: function (box) { if (T.next && box.scrollTop + box.clientHeight >= box.scrollHeight - 160) crmTlLoad(true); },
    onOpen: crmEntryOpen, next: crmEntryNext,
  });
  crmWatch(el, function (c) { T.kind = c.filt.kind || 'all'; T.q = c.q; crmTlLoad(false); });
  crmTlLoad(false);
}

/* ═══ THE LOG SHEET — a call, a visit, a WhatsApp or a note; optionally the follow-up it leaves (F4) ═════════════════ */
var LOG = { kind: 'call', dir: 'out', fu: false, busy: false };
function crmLogOpen(p) {
  LOG.kind = 'call'; LOG.dir = 'out'; LOG.fu = false; LOG.busy = false; LOG.p = p;
  var seg = function (a, items, cur) { return '<div class="seg2" role="group">' + items.map(function (x) { return '<button type="button" data-crm="' + a + '" data-v="' + x[0] + '" aria-pressed="' + (x[0] === cur) + '" data-testid="crm-' + a + '-' + x[0] + '">' + esc(tx(x[1])) + '</button>'; }).join('') + '</div>'; };
  modal('<div class="mhd"><div class="t">' + esc(tx('Log')) + ' · ' + esc(p.display_name) + '</div></div><div class="mbody" data-testid="crm-log-sheet">'
    + '<div class="supacts">' + seg('logkind', [['call', 'Call'], ['visit', 'Visit'], ['whatsapp', 'WhatsApp'], ['note', 'Note']], 'call') + '<span id="crm_logdir">' + seg('logdir', [['out', 'Out'], ['in', 'In']], 'out') + '</span></div>'
    + '<label>' + esc(tx('What happened?')) + '<textarea class="inp" id="crm_log_body" data-testid="crm-log-body" rows="4" placeholder="' + esc(tx('Said, agreed, asked…')) + '"></textarea></label>'
    + '<label style="flex-direction:row;align-items:center;gap:8px;font-weight:600"><input type="checkbox" id="crm_log_fu" data-crm="logfu" data-testid="crm-log-fu"> ' + esc(tx('Add a follow-up')) + '</label>'
    + '<div id="crm_log_fubox" hidden style="display:none;flex-direction:column;gap:8px"><input class="inp" id="crm_log_fuwhat" data-testid="crm-log-fuwhat" placeholder="' + esc(tx('Call back about…')) + '"><div class="supacts"><input class="inp" id="crm_log_fudue" data-testid="crm-log-fudue" type="date" style="width:auto">'
    + [['tomorrow', 'Tomorrow'], ['week', 'Next week']].map(function (x) { return '<button type="button" class="crm-mini" data-crm="logpreset" data-v="' + x[0] + '">' + esc(tx(x[1])) + '</button>'; }).join('') + '</div></div>'
    + '<div id="crm_log_msg" class="hint" role="status"></div></div>'
    + '<div class="mfoot"><button type="button" onclick="closeModal()">' + esc(tx('Cancel')) + '</button><button type="button" class="pri" data-crm="logsave" data-testid="crm-log-save">' + esc(tx('Save')) + '</button></div>');
  document.getElementById('crm_log_body').focus();
}
async function crmLogSave() {
  if (LOG.busy) return;
  var g = function (id) { return String((document.getElementById(id) || {}).value || '').trim(); }, msg = document.getElementById('crm_log_msg'), p = LOG.p;
  if (!g('crm_log_body')) { msg.textContent = tx('Say what happened.'); return; }
  LOG.busy = true;
  try {
    await api('crmLog', { params: { id: p.party_id }, body: { kind: LOG.kind, direction: LOG.kind === 'note' ? null : LOG.dir, body: g('crm_log_body') } });
    if (LOG.fu && g('crm_log_fuwhat') && g('crm_log_fudue')) await api('crmFollowAdd', { body: { party_id: p.party_id, what: g('crm_log_fuwhat'), due_at: new Date(g('crm_log_fudue') + 'T09:00:00').toISOString(), source: 'interaction' } });
    closeModal(); toast(tx('Logged')); crmLoad(true);
    if (CRM.route && CRM.route.view === 'party') crmRecordOpen(CRM.route);
  } catch (e) {
    msg.textContent = e && e.status === 503 ? tx('Calls and follow-ups start after an update. Nothing is lost.') : tx("Couldn't save that. Try again.");
  }
  LOG.busy = false;
}

/* ═══ ONE click door for the record's controls (cap-crm.js hands every data-crm it does not own to this) ═══════════ */
function crmRecordClick(a, t, ev) {
  var p = CRMR.p, rec = CRMR.rec || {}, v = t.getAttribute('data-v');
  if (a === 'rmore') { CRMR.menu = !CRMR.menu; return crmRecordPaint(p, rec); }
  if (a === 'recretry') return crmRecordOpen(CRM.route);
  if (a === 'rlog') return crmLogOpen(p);
  if (a === 'rfu') return crmFuAddOpen(p.party_id, function () { crmRecordOpen(CRM.route); });
  if (a === 'redit' || a === 'fixaddr') return crmEditOpen(p);
  if (a === 'logkind') { LOG.kind = v; document.querySelectorAll('[data-crm="logkind"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)); }); document.getElementById('crm_logdir').style.display = v === 'note' ? 'none' : ''; return; }
  if (a === 'logdir') { LOG.dir = v; document.querySelectorAll('[data-crm="logdir"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)); }); return; }
  if (a === 'logfu') { LOG.fu = t.checked; var bx = document.getElementById('crm_log_fubox'); bx.hidden = !t.checked; bx.style.display = t.checked ? 'flex' : 'none'; return; }
  if (a === 'logpreset') { var d = new Date(); d.setDate(d.getDate() + (v === 'week' ? 7 : 1)); document.getElementById('crm_log_fudue').value = crmLocalISO(d); return; }
  if (a === 'logsave') return crmLogSave();
  if (a === 'call') { setTimeout(function () { if (CRMR.p) crmLogOpen(CRMR.p); }, 400); return; }
  if (a === 'mail') { setTimeout(function () { if (CRMR.p) crmLogOpen(CRMR.p); }, 400); return; }
  if (a === 'message') return crmMessage(p, rec);
  if (a === 'rfudone') return crmFuAct(t.getAttribute('data-id'), { done: true }, function () { setTimeout(function () { crmRecordOpen(CRM.route); }, 0); });
  if (a === 'rremind') return crmFuAddOpen(p.party_id, function () { crmRecordOpen(CRM.route); }, { what: tx('Remind about the overdue dues'), source: 'dues' });
  if (a === 'rpay') return payOpen(p.balance_minor > 0 || !rec.supplier ? 'customer' : 'supplier', p.party_id);
  if (a === 'rgtheirs') return crmGstinTheirs(p, rec);
  if (a === 'rgmine') { CRMR.keep[p.party_id + rec.gstn_profile] = 1; return crmRecordPaint(p, rec); }
  if (a === 'ledgeron') return crmLedgerOn();
  if (a === 'walkin') return crmWalkin(p);
  if (a === 'alsorole') return crmAlsoRole(p, rec);
  if (a === 'rremove') return crmRemove(p, rec);
}
document.addEventListener('click', function (ev) {
  if (!CRMR.menu) return;
  if (!ev.target.closest || !ev.target.closest('.more')) { CRMR.menu = false; if (CRMR.p && CRMR.rec && CRM.route && CRM.route.view === 'party' && !CRM.route.sub) crmRecordPaint(CRMR.p, CRMR.rec); }
});
/** Message: the thread already open with this party, in the chit sheet — compose has no deep link yet (reported in the PR), so a new message starts in the app */
function crmMessage(p, rec) {
  var th = (rec.timeline_head || []).filter(function (e) { return e.chit_id && /^(message|chit)$/.test(e.kind); })[0];
  if (th) return openChitSheet(th.chit_id);
  toast(tx('Start a message from Chits in the app.'));
}
async function crmGstinTheirs(p, rec) {
  var side = rec.customer || rec.supplier, kind = rec.customer ? 'customer' : 'supplier';
  var ids = (p.tax_ids || []).map(function (t) { return t.scheme === 'GSTIN' ? { scheme: 'GSTIN', value: rec.gstn_profile } : t; });
  try { await api(kind === 'supplier' ? 'supPatch' : 'custGroup', { params: { id: side.list_id }, body: { tax_ids: ids } }); toast(tx('Saved')); await crmLoad(true); crmRecordOpen(CRM.route); }
  catch (e) { toast((e && e.message) || tx("Couldn't save that. Try again.")); }
}
function crmLedgerOn() {
  CBLedger.run(true, { ask: confirmAsk, working: function () {}, call: function (on) { return CBLedger.call({ api: api }, on); },
    done: function () { CRM.ledger = true; crmLoad(true).then(function () { crmRecordOpen(CRM.route); }); }, failed: function (e) { toast(tx('Could not switch it on.') + ' ' + friendlyErr(e)); } });
}
async function crmWalkin(p) {
  try {
    var r = await api('custAdd', { body: { name: p.display_name, phone: p.phone } });
    var made = (r && r.customer) || {}, pts = r && r.points_claimed != null ? r.points_claimed : (p.points && p.points.balance);
    toast(tx('Added to your parties') + (pts ? ' — ' + txf('{n} points kept', { n: pts }) : '')); await crmLoad(true);
    var np = made.customer_identity_id && CRM.byKey[made.customer_identity_id]; crmGo(np ? '#/party/' + encodeURIComponent(crmKey(np)) : '#/parties');
  } catch (e) { toast((e && e.message) || tx("Couldn't add that. Try again.")); }
}
async function crmAlsoRole(p, rec) {
  var toSup = p.roles[0] === 'customer';
  try { await api(toSup ? 'supAdd' : 'custAdd', { body: toSup ? (p.on_chitbridge ? { supplier_bridge_id: p.bridge_id } : { name: p.display_name }) : (p.on_chitbridge ? { handle: p.user_id } : { name: p.display_name, phone: p.phone }) }); CRMR.menu = false; toast(tx('Added')); await crmLoad(true); crmRecordOpen(CRM.route); }
  catch (e) { toast((e && e.message) || tx("Couldn't add that. Try again.")); }
}
function crmRemove(p, rec) {
  confirmAsk(tx('Remove from my parties?'), esc(txf('{name} is hidden from your parties. Nothing is deleted.', { name: p.display_name })), tx('Remove'), async function () {
    try {
      if (rec.customer) await api('custDel', { params: { id: rec.customer.list_id } });
      if (rec.supplier) await api('supDel', { params: { id: rec.supplier.list_id } });
      toast(tx('Removed')); await crmLoad(true); crmGo('#/parties');
    } catch (e) { toast((e && e.message) || tx("Couldn't remove that. Try again.")); }
  }, true);
}
