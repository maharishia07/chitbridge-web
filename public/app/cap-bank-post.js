/* cap-bank-post.js — the IN-APP post adapter for public/app/bank-preview.js: one confirmed bank line becomes one POST /events (series MJ) or one POST /payments (a named party), after its NEW party, if any, is made.
 * OWNS      adapter(deps) → post(item): (1) a new party is made FIRST through the ONE party list door (supAdd / custAdd, POST /api/relationships/suppliers | customers,
 *           CRM's, { name }), (2) the entry is posted with client_ref = item.ref = bank:<fingerprint> (the same line twice answers the first entry, duplicate:true).
 *           A failure at either step is THAT line's reason and nothing more: bank-preview.js goes on with the others.
 * CALLED BY public/app/cap-bank-sheet.js (the in-app Bank sheet, FIN-117); loaded by public/accounts.html after bank-preview.js. The body it sends is the one POST /events reads (kind, never type; no key the closed EVENT_BODY lacks).
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
    return one.supplier_entity_id || one.customer_entity_id || one.customer_identity_id || one.identity_id || one.id || null; /* a NEW customer answers customer_identity_id (BNK-new-4) */
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
  /** the keys of each entry kind POST /events reads beside the common ones (books-contract EVENT_BODY is CLOSED: a key it does not list is refused, so nothing else is sent) */
  var KIND_KEYS = { expense: ['class', 'paid_from'], other_income: ['class', 'into'], contra: ['from', 'to'] };
  /** money in from / out to a named party goes through the ONE payments door (POST /payments, what Dues records through), never POST /events: direction in | out */
  var PAYMENT_DIRECTION = { payment_received: 'in', payment_made: 'out' };
  /** the engine proposes these for a line with no payee (whatIsThis), but no api door takes them yet (BKS-ACC-4): refused in words here, never posted wrong */
  var NOT_YET = { tax_payment: 'A tax payment to the tax office', loan_taken: 'A loan received', loan_repaid: 'A loan repayment' };
  /** the event types this adapter posts: through POST /events, and through POST /payments for a party */
  var POSTABLE = Object.keys(KIND_KEYS).concat(Object.keys(PAYMENT_DIRECTION));
  /**
   * the body POST /events takes, built from the proposal's own event (the one posting.post composed the entry from): `kind` (the server reads kind, not type), the common fields, the
   * kind's own keys, the one client_ref. A taxed expense sends the NET as amount and the tax inside the bank figure as input_tax_minor, both the engine's own figures (nothing is worked out here).
   */
  function bodyOf(item, partyId, modeOf) {
    var event = item.event || {},
      body = { kind: event.type, date: event.date, amount: event.amount, narration: event.narration, client_ref: item.ref };
    (KIND_KEYS[event.type] || []).forEach(function (key) {
      if (event[key] != null) body[key] = event[key];
    });
    if (event.type === 'expense' && item.tax && item.tax.tax_minor > 0) {
      body.input_tax_minor = item.tax.tax_minor;
      if (item.tax.invoice_answer === 'held') body.tax_invoice = 'held'; /* the person's word that they hold the tax invoice (the server needs it at the pack's threshold; 'none' sends no tax at all) */
    }
    return modeOf ? modeOf(body) : body;
  }
  /**
   * the body POST /payments takes for a line the bank shows as money in from / out to a party: the statement line's own figure (minor units, never worked out here), the statement
   * account's mode, the line's own client_ref (a replay answers the first payment). allocate 'none': the receipt waits on account and Dues settles it against bills; the owner decides, nothing is allocated here.
   * acknowledge same_again: a line the owner ticked, or a second identical line on the SAME statement (item.twin), is a real second payment the bank itself shows, so the server's "Already paid?" is answered.
   */
  /** the statement line's own figure in minor units, whichever side it is on (nothing is worked out) */
  function lineFigure(line) {
    return Math.abs((+line.credit_minor || 0) - (+line.debit_minor || 0));
  }
  /** the payment mode of the statement's own account (cap-bank.js bkbModeOf via the host's modeOf), else what the proposal said */
  function statementMode(modeOf, event) {
    return (modeOf && modeOf({ paid_from: 'bank' }).paid_from) || event.mode || 'bank';
  }
  function paymentBodyOf(item, partyId, modeOf) {
    var line = item.line || {}, event = item.event || {};
    var body = { party_id: partyId, direction: PAYMENT_DIRECTION[event.type], amount_minor: lineFigure(line), mode: statementMode(modeOf, event), received_at: event.date || line.date, reference: item.ref, allocate: 'none', client_ref: item.ref };
    if (item.ticked || item.twin) body.acknowledge = ['same_again'];
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
      var refused = ownerRefusal(deps.who) || refusalOf(item.event && item.event.type);
      if (refused) return { ok: false, why: refused };
      try {
        return await postLine(deps, made, item);
      } catch (failure) {
        return { ok: false, why: (failure && failure.message) || 'Could not add this entry.' };
      }
    };
  }
  /** one line: its party first (made once), then its one door: POST /payments for money in from / out to a party, else POST /events */
  async function postLine(deps, made, item) {
    var party = await partyOf(deps, made, item.party);
    if (!party.ok) return party;
    if (!PAYMENT_DIRECTION[item.event.type]) return postEntry(deps, item, party.id);
    return party.id ? postPayment(deps, item, party.id) : { ok: false, why: 'Pick who this payment is with, then try again.' };
  }
  /** why this kind of line is not added from here (in words); null when it is */
  function refusalOf(type) {
    if (NOT_YET[type]) return NOT_YET[type] + ' cannot be added from a bank line yet. Record it from Books, then load the statement again.';
    return POSTABLE.indexOf(type) < 0 ? 'This kind of line cannot be added from here yet.' : null;
  }
  /** one entry through POST /events */
  async function postEntry(deps, item, partyId) {
    var reply = await deps.api('booksEventPost', { body: bodyOf(item, partyId, deps.modeOf) });
    return { ok: true, duplicate: !!(reply && reply.duplicate), entry_no: (reply && (reply.entry_no || reply.no)) || null };
  }
  /** one receipt or payment through POST /payments, the door Dues records through */
  async function postPayment(deps, item, partyId) {
    var reply = await deps.api('booksPayRecord', { body: paymentBodyOf(item, partyId, deps.modeOf) });
    return { ok: true, duplicate: !!(reply && reply.payment && reply.payment.duplicate), entry_no: (reply && reply.posted && reply.posted.entry_no) || null };
  }

  root.CBBankPost = { POSTABLE: POSTABLE, adapter: adapter, ownerRefusal: ownerRefusal, idOfParty: idOfParty, makeParty: makeParty, bodyOf: bodyOf, paymentBodyOf: paymentBodyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankPost;
})(typeof globalThis !== 'undefined' ? globalThis : this);
