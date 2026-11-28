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

  /** why this login may not post (the server decides; this only says it first, once); null when it may */
  function ownerRefusal(who) {
    if (who && who.role === 'adviser') return who.posts ? null : catalogueText('The owner has not let you post straight into these books. Prepare a journal for the owner to accept instead.'); /* an adviser acting for a client: the grant's posting decides; the server stays the authority */
    return who && who.role && who.role !== 'owner' && who.role !== 'bookkeeper' ? catalogueText('Adding entries is for the owner. Ask the owner to confirm this statement.') : null;
  }
  /** one catalogue sentence: the page's tx() when it has one */
  function catalogueText(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
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
  var KIND_KEYS = { expense: ['class', 'paid_from'], other_income: ['class', 'into'], contra: ['from', 'to', 'fee'], tax_payment: [], drawings: ['paid_from'], bank_expense_supplier: ['class', 'paid_from', 'supplier'] };
  /** BB-P1-3: a bank line paid to a named supplier is ONE entry, the expense and its payment (engines posting.js bank_expense_supplier): the party and the tax split are both kept; the supplier nets to nil */
  var SUPPLIER_EXPENSE = 'bank_expense_supplier';
  /** the kind POST /events gets for this line: an expense the owner gave a supplier is a supplier expense (never a customer, never without the party's id); every other kind is itself */
  function kindOf(event, item, partyId) {
    if (event.type === SUPPLIER_EXPENSE) return SUPPLIER_EXPENSE;
    return event.type === 'expense' && partyId && !(item.party && item.party.kind === 'customer') ? SUPPLIER_EXPENSE : event.type;
  }
  /** money in from / out to a named party goes through the ONE payments door (POST /payments, what Dues records through), never POST /events: direction in | out */
  var PAYMENT_DIRECTION = { payment_received: 'in', payment_made: 'out' };
  /** the engine proposes these for a line with no payee (whatIsThis), but no api door takes them yet (BKS-ACC-4): refused in words here, never posted wrong */
  var NOT_YET = { loan_taken: 'A loan received' };
  /** the event types this adapter posts: through POST /events, and through POST /payments for a party */
  var CHEQUE_RETURN = 'cheque_dishonoured'; /* BB-P1-1: POST /entries/:id/reverse on the receipt it names (postChequeReturn) */
  var POSTABLE = Object.keys(KIND_KEYS).concat(Object.keys(PAYMENT_DIRECTION), ['loan_repaid', CHEQUE_RETURN]); /* loan_repaid: POST /loans/:ref/emi (postLoanEmi) */
  /** the tax the proposal carries, as the keys POST /events takes (the engine's own figures, nothing is worked out here): the input tax of an expense (with the person's word on the tax invoice), the output tax inside an other-income figure, the tax inside a card settlement's fee; {} when the line carries none */
  function taxKeysOf(event, item) {
    var taxRecord = item.tax;
    if (!taxRecord || !(taxRecord.tax_minor > 0)) return {};
    if (event.type === 'expense' || event.type === SUPPLIER_EXPENSE) {
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
      body = { kind: kindOf(event, item, partyId || namedPartyId(event)), date: event.date, amount: event.amount, narration: event.narration, client_ref: item.ref };
    (KIND_KEYS[event.type] || []).forEach(function (key) {
      if (event[key] != null) body[key] = event[key];
    });
    Object.assign(body, taxKeysOf(event, item));
    if (body.kind === SUPPLIER_EXPENSE) {
      body.supplier = partyId || namedPartyId(event); /* the party's id, made first when new */
      if (item.notThisBill) body.not_this_bill = true; /* the owner said it is a new expense, not the open bill the api found */
    }
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
    if (body.direction === 'out') body.bank_line = true; /* BB-P1-3: the api refuses a money-out bank line with no bill and no account (422 NEEDS_WHICH_*) instead of leaving it on account; money in is unchanged */
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
      var refused = ownerRefusal(deps.who) || refusalOf(item.event && item.event.type);
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
      return !ownerRefusal(deps.who) && !refusalOf(type) && type !== 'loan_repaid' && !PAYMENT_DIRECTION[type] && !(item.party && item.party.status === 'new') && bodyOf(item, item.party && item.party.id, null).kind !== SUPPLIER_EXPENSE; /* a supplier expense keeps its own door, one entry at a time */
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
      return results.map(function (one) {
        return one && one.ok === true ? { ok: true, duplicate: !!one.duplicate, entry_no: one.entry_no || one.no || null, posting_date: one.posting_date || null } : { ok: false, why: (one && one.detail) || 'Could not add this entry.' };
      });
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
    if (item.event.type === CHEQUE_RETURN) return postChequeReturn(deps, item);
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
  /** the words of what a loan instalment line still lacks, by the need code the sheet shows (bank-preview-line.js NEEDS_WORDS carries the short labels) */
  var LOAN_WORDS = { no_loan: 'No loan in your books to pay. Add the loan in Books first, then load the statement again.', which_loan: 'Choose which loan this pays first.', interest: "Type the interest from the lender's statement first.", interest_too_big: 'The interest is more than the payment.' };
  /** THE one test of a loan instalment line (BB-P1-1: the sheet's Ready and the press both read it): the need code it still has (no loan listed, no loan picked, no interest typed, interest above the payment), or null when the api can take it */
  function loanNeed(item, loans) {
    if (!(loans || []).length) return 'no_loan';
    if (!item.loanRef) return 'which_loan';
    if (typeof item.interestMinor !== 'number' || !(item.interestMinor >= 0)) return 'interest';
    return lineFigure(item.line || {}) - item.interestMinor < 0 ? 'interest_too_big' : null;
  }
  /** why a loan instalment line cannot be posted yet, in words, or null: the press asks the same loanNeed (a picked loan means the host listed some) */
  function loanEmiRefusal(item) {
    return LOAN_WORDS[loanNeed(item, [item.loanRef])] || null;
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
  /** how far back a returned cheque's receipt is looked for (the bank sends one back one to three weeks later, often in an earlier month) */
  var RECEIPT_LOOKBACK_DAYS = 90;
  /** the days of the books' bank ledger read for the receipts a returned cheque can reverse: from the lookback before the statement's first day to its last */
  function receiptWindow(first, last) {
    var start = Date.parse(String(first).slice(0, 10) + 'T00:00:00Z');
    return isNaN(start) ? null : { from: new Date(start - RECEIPT_LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10), to: String(last || first).slice(0, 10) };
  }
  /** the cleared customer receipts of the bank ledger's lines (GET /ledger/:account) a returned cheque can reverse: money in, naming a party, not itself reversed, not a reversal, a payment received → the engine's options.receipts [{ ref (the entry id), party, party_name, amount_minor, cheque_no, date }] */
  function receiptsOf(lines) {
    return (lines || []).filter(function (one) { return Number(one.dr_minor) > 0 && one.party_id && one.entry_id && !one.reversed_by && !one.reverses_entry_id && one.event_type === 'payment_received'; }).map(function (one) {
      return { ref: one.entry_id, party: one.party_id, party_name: one.party_name || '', amount_minor: Number(one.dr_minor), cheque_no: (one.source && one.source.how_ref) || null, date: one.date };
    });
  }
  /** the days apart of two ISO days, whole days, never negative; null when either is not a day */
  function daysApart(first, second) {
    var one = Date.parse(String(first || '').slice(0, 10) + 'T00:00:00Z'), two = Date.parse(String(second || '').slice(0, 10) + 'T00:00:00Z');
    return isNaN(one) || isNaN(two) ? null : Math.abs(Math.round((one - two) / 86400000));
  }
  /** a second press on a receipt the books already reversed (409 ALREADY_REVERSED): done only when that reversal sits inside the statement match window of THIS line (then it matches it), else said plainly; never "Added" for nothing */
  function alreadyReturned(failure, line) {
    var day = (failure && ((failure.data && failure.data.posting_date) || failure.posting_date)) || null,
      window = (root.CBBankPreviewLine && root.CBBankPreviewLine.MATCH_WINDOW_DAYS) || 0,
      apart = daysApart(day, line.date);
    if (apart != null && apart <= window) return { ok: true, duplicate: true, entry_no: (failure.data && failure.data.entry_no) || null, posting_date: day };
    return { ok: false, why: 'This receipt was already reversed' + (day ? ' on ' + day : '') + '. That entry will not match this line: check it in the Day book.' };
  }
  /** a dishonoured cheque: the mirror of the receipt the proposal names (POST /entries/:id/reverse, the door that also reopens the bills it settled), dated the day the bank returned it; a held, refused or already-done answer is said in words and never counted as added */
  async function postChequeReturn(deps, item) {
    var event = item.event || {}, line = item.line || {};
    if (!event.reverses || !event.party) return { ok: false, why: 'Choose which receipt this cheque was for first.' };
    var body = { reason: 'Cheque returned by the bank: ' + String(event.narration || line.narration || '').slice(0, 200), date: event.date || line.date };
    var reply = await deps.api('booksReverse', { params: { id: event.reverses }, body: body }).catch(function (failure) { return { failed: failure }; });
    if (reply && reply.failed) return reversalRefused(reply.failed, line);
    return reversedAnswer(reply);
  }
  /** the api refused the reversal: a second press is the ALREADY_REVERSED answer (judged by its day), any other refusal goes on up to the line's own reason */
  function reversalRefused(failure, line) {
    if (failure && failure.code === 'ALREADY_REVERSED') return alreadyReturned(failure, line);
    throw failure;
  }
  /** the api's answer to a reversal as the line's result: a reversal held for the owner's OK is not added; else the mirror entry */
  function reversedAnswer(reply) {
    if (reply && reply.state === 'waiting_accept' && reply.action_id && !reply.entry_no) return { ok: false, why: 'Sent to the owner for OK. It is not added until the owner accepts.' };
    return { ok: true, duplicate: false, entry_no: (reply && (reply.entry_no || reply.no)) || null, posting_date: (reply && reply.posting_date) || null };
  }
  /** one entry through POST /events; the api (BB-P1-3) asks, with nothing posted, when this supplier has ONE open bill of exactly this amount: the answer is the line's question, never a failure */
  async function postEntry(deps, item, partyId) {
    var reply;
    try {
      reply = await deps.api('booksEventPost', { body: bodyOf(item, partyId, deps.modeOf) });
    } catch (failure) {
      var asked = needsOf(failure);
      if (!asked || asked.needs !== 'which_bill' || !asked.bill) throw failure;
      return { ok: false, why: 'Same amount as an open bill. Use it?', needs: 'which_bill', bill: asked.bill, via: 'event' };
    }
    return { ok: true, duplicate: !!(reply && reply.duplicate), entry_no: (reply && (reply.entry_no || reply.no)) || null, posting_date: (reply && reply.posting_date) || null };
  }
  /** the question the api's 422 asks of a bank line (BB-P1-3): { needs: 'which_account' } or { needs: 'which_bill', bill: { ref, open_minor } }, read from the code and the body's own keys, never the sentence; null for any other refusal */
  function needsOf(failure) {
    var data = (failure && failure.data) || {};
    var needs = (failure && failure.code === 'NEEDS_WHICH_BILL') || data.needs === 'which_bill' ? 'which_bill' : (failure && failure.code === 'NEEDS_WHICH_ACCOUNT') || data.needs === 'which_account' ? 'which_account' : null;
    return needs ? { needs: needs, bill: needs === 'which_bill' && data.bill ? data.bill : null } : null;
  }
  /** one receipt or payment through POST /payments, the door Dues records through; a bank line the api cannot place asks its question (nothing posted) and is never marked added */
  async function postPayment(deps, item, partyId) {
    var reply;
    try {
      reply = await deps.api('booksPayRecord', { body: paymentBodyOf(item, partyId, deps.modeOf) });
    } catch (failure) {
      var asked = needsOf(failure);
      if (!asked || (asked.needs === 'which_bill' && !asked.bill)) throw failure;
      return Object.assign({ ok: false, why: asked.needs === 'which_bill' ? 'Same amount as an open bill. Use it?' : 'Which account is this for?' }, asked);
    }
    return { ok: true, duplicate: !!(reply && reply.payment && reply.payment.duplicate), entry_no: (reply && reply.posted && reply.posted.entry_no) || null, posting_date: (reply && reply.posted && reply.posted.posting_date) || null };
  }

  root.CBBankPost = { POSTABLE: POSTABLE, receiptWindow: receiptWindow, receiptsOf: receiptsOf, loanNeed: loanNeed, loanEmiRefusal: loanEmiRefusal, adapter: adapter, ownerRefusal: ownerRefusal, idOfParty: idOfParty, makeParty: makeParty, bodyOf: bodyOf, paymentBodyOf: paymentBodyOf, needsOf: needsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankPost;
})(typeof globalThis !== 'undefined' ? globalThis : this);
