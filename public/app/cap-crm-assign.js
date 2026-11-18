/* cap-crm-assign.js — CB CRM: who holds a follow-up (the signed token's claims, the Unassigned bucket, the Assign button's body).
 * OWNS      the token's claims (crmTokenClaims) · who sees the Unassigned bucket (crmSeesUnassigned) · the Show filter's choices (crmScopeOptions) · the Assign button's patch (crmAssignPatch); moved out of cap-crm.js (2026-11-18, size ratchet; behaviour unchanged)
 * CALLED BY crm.html (<script src>, after cap-crm.js) · cap-crm.js (crmHat · crmFollowups filters · CRM_CLICK.fuassign)
 * FLOW      crmFollowups → crmScopeOptions(def) → crmSeesUnassigned() ← CRM.may.assign (the server's verdict on every CRM read); crmTokenClaims reads the token's access LEVEL only (cap-crm.js crmHat), never the hat
 * CARD      11-crm-and-marketing/crm-followups
 */
'use strict';
/** the claims in the signed token's own payload (the session record does not keep them); an unreadable token has none, and says so in the log */
function crmTokenClaims() {
  var part = String(SESSION.token || '').split('.')[1];
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
/** the Assign button's patch: the api takes a person's id, never a name (BAD_ASSIGNEE) */
function crmAssignPatch() {
  return { assignee_user_id: cbMeId() };
}
