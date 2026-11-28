/* cap-bank-post.js — the IN-APP post adapter for public/app/bank-preview.js: one confirmed bank line becomes one POST /events (series MJ) or one POST /payments (a named party), after its NEW party, if any, is made.
 * OWNS      adapter(deps) → post(item): (1) a new party is made FIRST through the ONE party list door (supAdd / custAdd, POST /api/relationships/suppliers | customers,
 *           CRM's, { name }), (2) the entry is posted with client_ref = item.ref = bank:<fingerprint> (the same line twice answers the first entry, duplicate:true).
 *           A failure at either step is THAT line's reason and nothing more: bank-preview.js goes on with the others.
 * CALLED BY public/app/cap-bank-sheet.js (the in-app Bank sheet, FIN-117); loaded by public/accounts.html after bank-preview.js. The body it sends is the one POST /events reads (kind, never type; no key the closed EVENT_BODY lacks).
 * FLOW      bank-preview.postReady → post(item) → [party door] → api('booksEventPost') → { ok, duplicate?, entry_no? } | { ok:false, why }
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * ⚠️ POST /events is the OWNER's, and an acting ADVISER's only when the grant posts (CBBooksActing.posts(); then no new party: the owner adds it first). Anyone else is told up front (ownerRefusal), not once per line. A closed month answers 409 PERIOD_LOCKED / YEAR_CLOSED; the
 *   server's own words are shown on the line. bank-preview.js pre-checks the months, so the popup already counted them.
 */
(function (root) {
  'use strict';
  var PARTY_DOORS = { supplier: 'supAdd', customer: 'custAdd' };

  /** an adviser acting for a client: the grant's posting decides (it posts, or it proposes to the owner); null when it may */
  function adviserRefusal(who) {
    if (who.posts || who.proposes) return null;
    return catalogueText('The owner has not let you post straight into these books. Prepare a journal for the owner to accept instead.');
  }
  /** why this login may not post (the server decides; this only says it first, once); null when it may */
  function ownerRefusal(who) {
    if (who && who.role === 'adviser') return adviserRefusal(who); /* an adviser acting for a client: the grant's posting decides; the server stays the authority */
    return who && who.role && who.role !== 'owner' && who.role !== 'bookkeeper' ? catalogueText('Adding entries is for the owner. Ask the owner to confirm this statement.') : null;
  }
  /** one catalogue sentence: the page's tx() when it has one */
  function catalogueText(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  /** BB-P1-2: an adviser whose grant PROPOSES (owner_approves) sends entries to the owner to approve; a receipt or payment with a named party, and a loan instalment, have no held form yet (the server refuses them), so they are said up front */
  function proposeRefusal(who, type) {
    var proposing = !!who && who.role === 'adviser' && !who.posts && !!who.proposes;
    var noHeldForm = !!PAYMENT_DIRECTION[type] || type === 'loan_repaid';
    return proposing && noHeldForm ? catalogueText('The owner records payments and loan instalments. Send the other lines to the owner to approve.') : null;
  }
  /** why this line cannot be added by this person from here (the seat, the kind, a proposing adviser's payment), in words; null when it can */
  function lineRefusal(who, type) {
    return ownerRefusal(who) || refusalOf(type) || proposeRefusal(who, type);
  }
  /** an adviser never makes a party (those doors are outside /api/books and refused): a line that needs a new one waits for the owner to add it */
  function newPartyRefusal(who, name) {
    return who && who.role === 'adviser' ? (typeof root.txf === 'function' ? root.txf('Ask the owner to add {name} to the party list first, then add this line.', { name: name || catalogueText('this party') }) : 'Ask the owner to add ' + (name || 'this party') + ' to the party list first, then add this line.') : null;
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
  var KIND_KEYS = { expense: ['class', 'paid_from'], other_income: ['class', 'into'], contra: ['from', 'to', 'fee'], tax_payment: [], drawings: ['paid_from'] };
  /** money in from / out to a named party goes through the ONE payments door (POST /payments, what Dues records through), never POST /events: direction in | out */
  var PAYMENT_DIRECTION = { payment_received: 'in', payment_made: 'out' };
  /** the engine proposes these for a line with no payee (whatIsThis), but no api door takes them yet (BKS-ACC-4): refused in words here, never posted wrong */
  var NOT_YET = { loan_taken: 'A loan received' };
  /** the event types this adapter posts: through POST /events, and through POST /payments for a party */
  var POSTABLE = Object.keys(KIND_KEYS).concat(Object.keys(PAYMENT_DIRECTION), ['loan_repaid']); /* loan_repaid: POST /loans/:ref/emi (postLoanEmi) */
  /** the tax the proposal carries, as the keys POST /events takes (the engine's own figures, nothing is worked out here): the input tax of an expense (with the person's word on the tax invoice), the output tax inside an other-income figure, the tax inside a card settlement's fee; {} when the line carries none */
  function taxKeysOf(event, item) {
    var taxRecord = item.tax;
    if (!taxRecord || !(taxRecord.tax_minor > 0)) return {};
    if (event.type === 'expense') {
      /* the person's word that they hold the tax invoice (the server needs it at the pack's threshold; 'none' sends no tax at all) */
      return taxRecord.invoice_answer === 'held' ? { input_tax_minor: taxRecord.tax_minor, tax_invoice: 'held' } : { input_tax_minor: taxRecord.tax_minor };
    }
    if (event.type === 'other_income' && taxRecord.direction === 'output') return { output_tax_minor: taxRecord.tax_minor }; /* the GST collected INSIDE the bank figure, the engine's own split: amount is the NET */
    if (event.type === 'contra' && event.fee != null) return { fee_tax_minor: taxRecord.tax_minor }; /* a card settlement net of its fee: the taxRecord inside the fee, the engine's own figure; fee is the NET of it */
    return {};
  }
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
    Object.assign(body, taxKeysOf(event, item));
    if (event.type === 'tax_payment') Object.assign(body, { paid_from: 'bank' }); /* the whole figure, the statement account's mode (modeOf below); the api puts it on the pack's one tax head */
    if (item.moveTo) body.if_locked = 'next_open'; /* W15-85: the person chose to post this locked month's line in the next open month; the api adds the "<Month> locked" note (W15-85a, one wording) */
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
  /** the server's acknowledgements this line answers: "same_again" for a ticked or twin line; "excess" when the owner ticked a proposal that says A$X stays on the customer's account, answered and never without the tick */
  function acknowledgementsOf(item) {
    var said = [];
    if (item.ticked || item.twin) said.push('same_again');
    if (item.ticked && item.onAccount > 0) said.push('excess');
    return said;
  }
  function paymentBodyOf(item, partyId, modeOf) {
    var line = item.line || {}, event = item.event || {};
    var body = { party_id: partyId, direction: PAYMENT_DIRECTION[event.type], amount_minor: lineFigure(line), mode: statementMode(modeOf, event), received_at: event.date || line.date, reference: item.ref, allocate: 'none', client_ref: item.ref };
    if (item.against && item.against.length) {
      body.allocations = item.against.map(function (one) { return { against_ref: one.against_ref, amount_minor: one.amount_minor }; }); /* the engine found the open document this line IS: the receipt settles it, nothing is worked out here */
      delete body.allocate;
    }
    var said = acknowledgementsOf(item);
    if (said.length) body.acknowledge = said;
    if (item.moveTo) body.if_locked = 'next_open';
    return body;
  }
  /** the id of the party this line's entry names: an existing one as picked, a new one made FIRST (once per name and kind in this run); { ok, id } or the reason it could not be made */
  async function partyOf(deps, made, party) {
    if (!party) return { ok: true, id: null };
    var noNew = party.status === 'new' && newPartyRefusal(deps.who, party.name);
    if (noNew) return { ok: false, why: noNew };
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
    async function post(item) {
      var refused = lineRefusal(deps.who, item.event && item.event.type);
      if (refused) return { ok: false, why: refused };
      try {
        return await postLine(deps, made, item);
      } catch (failure) {
        return { ok: false, why: (failure && failure.message) || 'Could not add this entry.' };
      }
    }
    /** a plain entry for a party the books know (or none): the lines POST /events/batch takes; a new party, a payment and a loan instalment keep their own doors, one at a time */
    post.batchable = function (item) {
      var type = item.event && item.event.type;
      return !lineRefusal(deps.who, type) && type !== 'loan_repaid' && !PAYMENT_DIRECTION[type] && !(item.party && item.party.status === 'new');
    };
    /** the plain-entry lines in ONE call: a reply per line in order (same shape as post), or null when the call cannot be used so the caller posts them one by one (an owner-approval shop answers 409; every line has its client_ref, so a repeat posts nothing twice) */
    post.many = async function (items) {
      var bodies = items.map(function (item) {
        return bodyOf(item, item.party && item.party.status === 'existing' ? item.party.id : null, deps.modeOf);
      });
      var out;
      try {
        out = await deps.api('booksEventsBatch', { body: { events: bodies } });
      } catch (failure) {
        if (typeof cbQuiet === 'function') cbQuiet('bank-post: the many-entries call could not be used, the lines go one at a time', failure);
        return null;
      }
      var results = out && out.results;
      if (!Array.isArray(results) || results.length !== items.length) return null;
      return results.map(rowOf);
    };
    return post;
  }
  /** a party the books already know: the engine's proposal names it by id in event.party when the line carries no party record (a taught rule or a name found in the narration) */
  function namedPartyId(event) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(event.party || '')) ? event.party : null;
  }
  /** one line: its party first (made once), then its one door: POST /payments for money in from / out to a party, else POST /events */
  async function postLine(deps, made, item) {
    var party = await partyOf(deps, made, item.party);
    if (!party.ok) return party;
    if (item.event.type === 'loan_repaid') return postLoanEmi(deps, item);
    if (!PAYMENT_DIRECTION[item.event.type]) return postEntry(deps, item, party.id);
    var partyId = party.id || namedPartyId(item.event);
    if (partyId) return postPayment(deps, item, partyId);
    var needs = newPartyRefusal(deps.who, (item.party && item.party.name) || '');
    return { ok: false, why: needs || 'Pick who this payment is with, then try again.' };
  }
  /** why this kind of line is not added from here (in words); null when it is */
  function refusalOf(type) {
    if (NOT_YET[type]) return NOT_YET[type] + ' cannot be added from a bank line yet. Record it from Books, then load the statement again.';
    return POSTABLE.indexOf(type) < 0 ? 'This kind of line cannot be added from here yet.' : null;
  }
  /** why a loan instalment line cannot be posted yet (no loan picked · no interest typed · interest above the payment), or null */
  function loanEmiRefusal(item) {
    if (!item.loanRef) return 'Choose which loan this pays first.';
    if (typeof item.interestMinor !== 'number' || !(item.interestMinor >= 0)) return "Type the interest from the lender's statement first.";
    if (lineFigure(item.line || {}) - item.interestMinor < 0) return 'The interest is more than the payment.';
    return null;
  }
  /** the body of POST /loans/:ref/emi: the bank's split as given, paid from the mode the till chose */
  function loanEmiBody(item, modeOf) {
    var body = { principal_minor: lineFigure(item.line || {}) - item.interestMinor, interest_minor: item.interestMinor, from: 'bank', date: (item.event && item.event.date) || (item.line || {}).date, client_ref: item.ref };
    return modeOf ? Object.assign(body, { from: modeOf({ paid_from: 'bank' }).paid_from }) : body;
  }
  /** M-06: a loan instalment through POST /loans/:ref/emi, the bank's split AS GIVEN: the interest the owner typed (never computed here) and the rest of the line as principal; the loan is the one the owner picked */
  async function postLoanEmi(deps, item) {
    var why = loanEmiRefusal(item);
    if (why) return { ok: false, why: why };
    var reply = await deps.api('booksLoanEmi', { params: { ref: item.loanRef }, body: loanEmiBody(item, deps.modeOf) });
    return { ok: true, duplicate: !!(reply && reply.duplicate), entry_no: (reply && (reply.entry_no || reply.no)) || null, posting_date: (reply && reply.posting_date) || null };
  }
  /** BB-P1-2: a line the server HELD for the owner (a 202 under owner_approves: the held action, nothing posted) is ok and `held`, never an entry */
  function heldOf(reply) {
    if (!reply) return false;
    if (reply.held === true) return true;
    var waiting = reply.state === 'waiting_review' || reply.state === 'waiting_accept';
    return waiting && !!reply.action_id && !reply.entry_no && !reply.entry;
  }
  /** one row of a batch answer as the preview keeps it: held for the owner, posted (or a duplicate), or refused with the server's words */
  function rowOf(one) {
    if (!one || one.ok !== true) return { ok: false, why: (one && one.detail) || 'Could not add this entry.' };
    return entryOrHeld(one);
  }
  /** one entry through POST /events */
  async function postEntry(deps, item, partyId) {
    var reply = await deps.api('booksEventPost', { body: bodyOf(item, partyId, deps.modeOf) });
    return entryOrHeld(reply);
  }
  /** the answer of POST /events as the preview keeps it: held for the owner (a 202), or the entry made (a repeat says duplicate) */
  function entryOrHeld(reply) {
    return heldOf(reply) ? { ok: true, held: true, action_id: reply.action_id || null } : entryOf(reply);
  }
  /** the entry POST /events made, as the preview keeps it (a repeat says duplicate) */
  function entryOf(reply) {
    var one = reply || {};
    return { ok: true, duplicate: !!one.duplicate, entry_no: one.entry_no || one.no || null, posting_date: one.posting_date || null };
  }
  /** one receipt or payment through POST /payments, the door Dues records through */
  async function postPayment(deps, item, partyId) {
    var reply = await deps.api('booksPayRecord', { body: paymentBodyOf(item, partyId, deps.modeOf) });
    return { ok: true, duplicate: !!(reply && reply.payment && reply.payment.duplicate), entry_no: (reply && reply.posted && reply.posted.entry_no) || null, posting_date: (reply && reply.posted && reply.posted.posting_date) || null };
  }

  root.CBBankPost = { POSTABLE: POSTABLE, adapter: adapter, ownerRefusal: ownerRefusal, idOfParty: idOfParty, makeParty: makeParty, bodyOf: bodyOf, paymentBodyOf: paymentBodyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankPost;
})(typeof globalThis !== 'undefined' ? globalThis : this);
