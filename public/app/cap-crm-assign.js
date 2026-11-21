/* cap-crm-assign.js — CB CRM: who holds a follow-up (the signed token's claims, the Unassigned bucket, the Assign button's body).
 * OWNS      the token's claims (crmTokenClaims) · who sees the Unassigned bucket (crmSeesUnassigned) · the Parties headline (crmKeepHeadlines · crmTotalOf · crmPartyCount, moved from cap-crm.js, file-size ratchet 28 Nov) · the Show filter's choices (crmScopeOptions) · the follow-up's holder on CBAssign (crmAssignOpts · crmFuWrite · crmFuHolders; ASSIGN-W3 L6, replaces the leaver-only Assign button); moved out of cap-crm.js (2026-11-18, size ratchet; behaviour unchanged)
 * CALLED BY crm.html (<script src>, after cap-crm.js) · cap-crm.js (crmHat · crmFollowups filters · the Held-by column and bar)
 * FLOW      crmFollowups → crmScopeOptions(def) → crmSeesUnassigned() ← CRM.may.assign (the server's verdict on every CRM read); crmTokenClaims reads the token's access LEVEL only (cap-crm.js crmHat), never the hat
 * CARD      11-crm-and-marketing/crm-followups
 */
'use strict';
/** the claims in the signed token's own payload (the session record does not keep them); an unreadable token has none, and says so in the log */
function crmTokenClaims(token) {
  var part = String(token || '').split('.')[1];
  if (!part) return {}; /* signed out: nothing to read, nothing to log */
  try {
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch (err) {
    if (typeof cblog === 'function') cblog('info', 'crm: the session token has no readable claims: ' + ((err && err.message) || err));
    return {};
  }
}
/** the two who see the Unassigned bucket (the follow-ups nobody holds): the partner and a manager, as the SERVER says in `may.assign` (A2, 18 Nov: no token claim is read; nothing said yet = not shown) */
function crmSeesUnassigned() {
  return !!(CRM.may && CRM.may.assign && CRM.may.assign.ok);
}
/** the Show filter's other choices: Mine or Everyone (whichever is not the default), and Unassigned for the two who see it */
function crmScopeOptions(def) {
  var options = [{ v: def === 'all' ? 'mine' : 'all', label: tx(def === 'all' ? 'Mine' : 'Everyone') }];
  if (crmSeesUnassigned()) options.push({ v: 'unassigned', label: tx('Unassigned') });
  return options;
}
/**
 * ASSIGN-W3 · L6: a follow-up's holder on the ONE CBAssign pattern (public/app/assign-bar.js). A follow-up is not a chit, so it is written by its own route (PATCH /api/crm/followups/:id { assignee_user_id });
 * CBAssign takes that writer as opts.write and keeps the chip, the bar, the popover, the result line and Undo. The api takes a person's id, never a name (BAD_ASSIGNEE); who may is the server's (CRM.may.assign).
 * plug 'followup' · noun 'follow-up' (the plug word of GET /api/chits/my-work and /holds).
 */
function crmFuHolders(f) {
  return f && f.assignee_user_id && f.assignee_name && !f.assignee_left ? [{ actor_id: f.assignee_user_id, name: f.assignee_name }] : [];
}
/** the writer CBAssign calls: one PATCH per follow-up, answered like assign-bulk ({ assigned, skipped[], previous[], sentence }); the first refusal stops the run and carries the server's sentence */
function crmFuWrite(ids, targetId) {
  var out = { ok: true, assigned: 0, skipped: [], previous: [], sentence: '' };
  var chain = Promise.resolve();
  ids.forEach(function (id) {
    chain = chain.then(function () {
      if (!out.ok) return null;
      var row = CRM.fu.filter(function (f) { return f.followup_id === id; })[0];
      return api('crmFollowSet', { params: { id: id }, body: { assignee_user_id: targetId || null } }).then(
        function () {
          out.assigned++;
          out.previous.push({ subject_id: id, actor_id: (row && row.assignee_user_id) || null });
        },
        function (e) {
          out.ok = false;
          out.sentence = (e && (e.detail || e.message)) || tx("Couldn't save that. Try again.");
        }
      );
    });
  });
  return chain.then(function () {
    return out;
  });
}
/** the one options object CBAssign takes for a follow-up: its plug word, noun, holders and the writer above */
function crmAssignOpts() {
  return {
    plug: 'followup',
    noun: 'follow-up',
    nounMany: 'follow-ups',
    flag: 'assignable',
    said: crmSeesUnassigned(),
    subjectOf: function (f) { return f.followup_id; },
    roleOf: function () { return ''; },
    heldOf: function (f) { return crmFuHolders(f).length > 0; },
    write: crmFuWrite,
    reload: function () { return crmFuLoad(); }
  };
}
/** Add follow-up › Who: the same people the popover lists (GET /api/actors, the people who may hold work, with Me first), so a partner with four editors is not offered only "Me" (A6); a read that fails leaves the list the sheet came with */
function crmFuWhoFill() {
  var select = document.getElementById('crm_fu_who');
  if (!select || !window.CBAssign || !CBAssign.roster) return;
  CBAssign.roster('assignable').then(function (list) {
    if (!list.length || !document.body.contains(select)) return;
    var meId = CBAssign.meId();
    var mine = list.filter(function (p) { return p.me; })[0];
    select.innerHTML =
      '<option value="">' + esc(tx('Me')) + '</option>' +
      list.filter(function (p) { return !p.me && String(p.id) !== meId; }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + (p.holds != null ? ' · ' + p.holds : '') + '</option>'; }).join('');
    if (mine) select.options[0].textContent = tx('Me') + ' · ' + mine.name;
  }, function () { /* the sheet keeps the list it came with */ });
}
/** the alert counts and the headline total of an answer; COUNT-SOURCE: the headline is the server's total (+ the walk-ins listed beside it), never a client-side filter's length */
function crmKeepHeadlines(reply) {
  CRM.alerts = (reply && reply.alerts) || {};
  CRM.total = crmTotalOf(reply);
}
/** the Parties headline: the server's total plus the walk-ins listed beside it, or null when the server sent none */
function crmTotalOf(reply) {
  return reply && reply.total != null ? Number(reply.total) + (reply.walk_ins || []).length : null;
}
/** the number on the Parties tab: the server's total, else the rows held here */
function crmPartyCount() {
  return CRM.total != null ? CRM.total : CRM.rows.length;
}
