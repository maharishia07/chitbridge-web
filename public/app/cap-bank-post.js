/* cap-bank-post.js — the IN-APP post adapter for public/app/bank-preview.js: one confirmed bank line becomes one POST /events (series MJ), after its NEW party, if any, is made.
 * OWNS      adapter(deps) → post(item): (1) a new party is made FIRST through the ONE party list door (supAdd / custAdd, POST /api/relationships/suppliers | customers,
 *           CRM's, { name }), (2) the entry is posted with client_ref = item.ref = bank:<fingerprint> (the same line twice answers the first entry, duplicate:true).
 *           A failure at either step is THAT line's reason and nothing more: bank-preview.js goes on with the others.
 * CALLED BY nothing yet. ⚠️ TODO(BANK-WEB-2, follow-up): wire it behind the Bank view's entry point. cap-bank.js is at its size ceiling and the Bank view loads
 *           by cap name from app.html (/app/cap-<name>.js?v=CB_BUILD), so wiring = one call-in from cap-bank.js + a loader row + a CB_BUILD bump + the owner-only
 *           check below; it is its own small change, not part of the no-login showcase.
 * FLOW      bank-preview.postReady → post(item) → [party door] → api('booksEventPost') → { ok, duplicate?, entry_no? } | { ok:false, why }
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * ⚠️ POST /events is OWNER-ONLY: an accountant login is told up front (ownerRefusal), not once per line. A closed month answers 409 PERIOD_LOCKED / YEAR_CLOSED; the
 *   server's own words are shown on the line. bank-preview.js pre-checks the months, so the popup already counted them.
 */
(function (root) {
  'use strict';
  var PARTY_DOORS = { supplier: 'supAdd', customer: 'custAdd' };

  /** why this login may not post (the server decides; this only says it first, once); null when it may */
  function ownerRefusal(who) {
    return who && who.role && who.role !== 'owner' ? 'Adding entries is for the owner. Ask the owner to confirm this statement.' : null;
  }
  /** the id of the party a party door answered with, whichever shape that door uses; null when it sent none */
  function idOfParty(reply) {
    var one = (reply && (reply.supplier || reply.customer)) || reply || {};
    return one.supplier_entity_id || one.customer_entity_id || one.identity_id || one.id || null;
  }
  /** make the new party, or say why not; ok with an id when it is made. "Already on your list" is not made twice: the server names it, the person picks it from did-you-mean. */
  async function makeParty(api, party) {
    var door = PARTY_DOORS[party.kind];
    if (!door) return { ok: false, why: 'Say whether ' + party.name + ' is a supplier or a customer.' };
    try {
      var reply = await api(door, { body: { name: party.name } });
      var id = idOfParty(reply);
      return id ? { ok: true, id: id } : { ok: false, why: party.name + ' was added, but the list did not say which one. Pick it from the list and try again.' };
    } catch (failure) {
      return { ok: false, why: 'Could not add ' + party.name + ': ' + ((failure && failure.message) || 'try again') };
    }
  }
  /** the body POST /events takes: the proposal's own event (the one posting.post composed the entry from), its party, and the one client_ref */
  function bodyOf(item, partyId, modeOf) {
    var body = Object.assign({}, item.event, { client_ref: item.ref });
    if (partyId) body.party = partyId;
    if (modeOf) body = modeOf(body);
    return body;
  }
  /** the id of the party this line's entry names: an existing one as picked, a new one made FIRST (once per name and kind in this run); { ok, id } or the reason it could not be made */
  async function partyOf(deps, made, party) {
    if (!party) return { ok: true, id: null };
    if (party.status !== 'new') return { ok: true, id: party.status === 'existing' ? party.id : null };
    var tag = String(party.name).toLowerCase() + '|' + party.kind;
    if (!made[tag]) {
      var step = await makeParty(deps.api, party);
      if (!step.ok) return step;
      made[tag] = step.id;
    }
    return { ok: true, id: made[tag] };
  }
  /**
   * adapter({ api, who?, modeOf? }) → async post(item)
   *   api     the page's api(key, { body }) (core.js)            who  { role } of the signed-in person
   *   modeOf  (body) → body: put the statement's own ledger in paid_from / into (cap-bank.js bkbModeOf), never a fixed "bank"
   */
  function adapter(deps) {
    var made = {}; /* new party (name|kind) → id made in this run, so two lines naming one payee make it once */
    return async function post(item) {
      var refused = ownerRefusal(deps.who);
      if (refused) return { ok: false, why: refused };
      var party = await partyOf(deps, made, item.party);
      if (!party.ok) return party;
      try {
        var reply = await deps.api('booksEventPost', { body: bodyOf(item, party.id, deps.modeOf) });
        return { ok: true, duplicate: !!(reply && reply.duplicate), entry_no: (reply && (reply.entry_no || reply.no)) || null };
      } catch (failure) {
        return { ok: false, why: (failure && failure.message) || 'Could not add this entry.' };
      }
    };
  }

  root.CBBankPost = { adapter: adapter, ownerRefusal: ownerRefusal, idOfParty: idOfParty, makeParty: makeParty, bodyOf: bodyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankPost;
})(typeof globalThis !== 'undefined' ? globalThis : this);
