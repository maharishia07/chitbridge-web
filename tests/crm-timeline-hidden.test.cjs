/**
 * tests/crm-timeline-hidden.test.cjs - CRM-206 (web follow-up of api RAIL-146h, #744): a cost-blind reader's party timeline sends a chit `value`
 * null + cost_hidden and a ledger `amount_minor` null + cost_hidden, and the party read `dues.cost_hidden`. The page says "hidden" there,
 * leaves a hidden figure out of the unbilled sum, and an owner / cost-allowed reader's answer paints exactly as before.
 * Payload shapes are the api's own stand-ins (tests/rail146h-timeline-cost-blind.test.cjs). Run: node tests/crm-timeline-hidden.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const NL = String.fromCharCode(10);
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8').replace(/\r\n/g, NL);
const crm = read('cap-crm.js'), rec = read('cap-crm-record.js');
/* just the named functions, cut out of the page's own files - no second copy of the logic lives in this test */
const fn = (src, name) => {
  const i = src.indexOf('function ' + name + '('); assert(i >= 0, name + ' not found');
  const first = src.slice(i, src.indexOf(NL, i));
  return first.split('{').length === first.split('}').length ? first : src.slice(i, src.indexOf(NL + '}' + NL, i) + 2);
};
globalThis.tx = (s) => s; globalThis.esc = (s) => String(s);
globalThis.bkMoney = (m, c) => (c === 'INR' ? '\u20b9' : c + ' ') + (m / 100).toLocaleString('en-IN');
globalThis.bkToMinor = (v) => Math.round(v * 100); globalThis.bkDate = (d) => d;
globalThis.cbIsRawId = () => false; globalThis.CRM_KIND = {}; globalThis.CRM_CHANNEL = {}; globalThis.CRMR = { p: null, added: '' };
globalThis.CRM = { ledger: true, currency: 'INR' };
globalThis.crmRolesList = (r) => r; globalThis.crmRealEmail = (v) => v; globalThis.crmPlural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
globalThis.crmNoDate = (s) => s; globalThis.crmEntryWhat = globalThis.crmEntryState = () => '';
eval(
  [fn(crm, 'crmNothingDueCell'), fn(crm, 'crmDueCell'), fn(crm, 'crmUnbilledSaid'), fn(crm, 'crmUnbilledNotes'), fn(crm, 'crmUnbilledFigs'), fn(crm, 'crmUnbilledParts'), fn(crm, 'crmUnbilledMoney'), fn(crm, 'crmDueListCell'), fn(rec, 'crmDueChip'), fn(crm, 'crmPartyFrom'), fn(rec, 'crmIsOpenOrder'), fn(rec, 'crmBillFacts'), fn(rec, 'crmEntryFrom'), fn(rec, 'crmMarkHidden'), fn(rec, 'crmTlCols')].join(NL) +
    NL + 'globalThis.dueCell = crmDueCell; globalThis.partyFrom = crmPartyFrom; globalThis.facts = crmBillFacts; globalThis.unbilledMoney = crmUnbilledMoney; globalThis.chip = crmDueChip; globalThis.said = crmUnbilledSaid; globalThis.listCell = crmDueListCell; globalThis.entry = crmEntryFrom; globalThis.cols = crmTlCols;'
);
const amountCell = (e) => cols().filter((c) => c.key === 'amount')[0].cell(e);
const order = (o) => Object.assign({ kind: 'chit', at: '2026-11-01T10:00:00Z', chit_id: 'c1', purpose: 'order', title: 'Order', currency: 'INR', direction: 'out' }, o);

/* the blind reader: a chit value null + cost_hidden -> "hidden", never 0 and never a dash */
const blind = entry(order({ value: null, cost_hidden: true }), 0);
assert.strictEqual(blind.amount_minor, undefined, 'a hidden value carries no figure');
assert(/>hidden</.test(amountCell(blind)) && /crm-amt-hidden-/.test(amountCell(blind)), 'the Amount column says hidden: ' + amountCell(blind));
const ledBlind = entry({ kind: 'ledger', at: '2026-11-01T10:00:00Z', ledger_kind: 'bill', ref: 'B-1', amount_minor: null, currency: 'INR', cost_hidden: true }, 1);
assert(/>hidden</.test(amountCell(ledBlind)), 'a hidden ledger amount says hidden too');
/* CRM-D7: the page adds no money - the record paints the SERVER's carried figure (api sumUnbilled); the entries only give a count when it is absent */
const shown = entry(order({ chit_id: 'c2', value: 1000 }), 2);
let f = facts([shown, blind]);
assert.deepStrictEqual([f.orders, f.unbilled], [2, undefined], 'the entries give the order count, never a sum');
assert.strictEqual(unbilledMoney({ n: 2, minor: null, currency: 'INR', cost_hidden: true }), 'hidden', 'a blind reader: the word, not a made-up zero');
assert.strictEqual(unbilledMoney({ n: 1, minor: 100000, currency: 'INR', by_currency: [{ currency: 'INR', minor: 100000, n: 1 }], no_currency: 0, unpriced: 0 }), '₹1,000', 'the owner: the figure, no "hidden" anywhere');
assert(!/hidden/.test(amountCell(shown)) && /₹1,000/.test(amountCell(shown)), 'owner: the figure');
assert(/>—</.test(amountCell(entry(order({ chit_id: 'c4', value: null }), 4))), 'a null value WITHOUT cost_hidden is still a dash (a note has no amount)');
/* the party list: dues.cost_hidden -> "hidden" in the Dues cell; a plain null balance is still a dash; the owner's figure unchanged */
const row = (dues) => partyFrom({ party_id: 'pid-1', dues, may_trade: { ok: true } });
assert(/>hidden</.test(dueCell(row({ balance_minor: null, oldest_due: null, cost_hidden: true }))) && /party-due-hidden-pid-1/.test(dueCell(row({ balance_minor: null, cost_hidden: true }))), 'blind: Dues says hidden');
assert(/>\u2014</.test(dueCell(row({ balance_minor: null }))), 'no figure and not hidden: a dash');
assert(/you'll get/.test(dueCell(row({ balance_minor: 100000 }))), 'owner: the figure and its word');
/* the chip (record header) and the list cell are the same ONE painter, fed the carried figure */
let h = chip({ party_id: 'pid-1', balance_minor: 0, unbilled: { n: 2, minor: null, currency: 'INR', cost_hidden: true } });
assert(/2 orders not billed yet hidden/.test(h) && !/₹0/.test(h), 'chip, blind: ' + h);
h = listCell({ party_id: 'pid-1', balance_minor: 0, unbilled: { n: 2, minor: null, currency: 'INR', cost_hidden: true } });
assert(/2 orders not billed yet hidden/.test(h) && !/₹0/.test(h), 'list cell, the SERVER shape for a blind reader (api rail146e): ' + h);
h = listCell({ party_id: 'pid-1', balance_minor: 0, unbilled: { n: 0, minor: 0, currency: null } });
assert(/Settled/.test(h) && !/hidden/.test(h), 'a true zero still says Settled: ' + h);
h = listCell({ party_id: 'pid-1', balance_minor: 0, unbilled: { n: 2, minor: null, currency: null } });
assert(/2 orders not billed yet<\/span>/.test(h) && !/hidden/.test(h), 'an older api, two currencies (no split): the count alone: ' + h);
assert(!/hidden/.test(listCell({ party_id: 'pid-1', balance_minor: 0, unbilled: { n: 1, minor: 42000, currency: 'INR' } })), 'owner list cell unchanged (the server sends no hidden)');
/* CRM-D7, hand-computed (minor units): A INR 50000, B INR 34000, C AUD 9000, D AUD 6000, E no currency 7000 */
const S = (u) => globalThis.said(u, 'INR');
const split = (by, extra) => Object.assign({ n: 0, minor: null, currency: null, by_currency: by, no_currency: 0, unpriced: 0 }, extra);
assert.strictEqual(S(split([{ currency: 'INR', minor: 84000, n: 2 }], { n: 2, minor: 84000, currency: 'INR' })), '2 orders not billed yet ₹840', 'INR only: the same bytes as before');
assert.strictEqual(S(split([{ currency: 'AUD', minor: 15000, n: 2 }], { n: 2, minor: 15000, currency: 'AUD' })), '2 orders not billed yet AUD 150');
h = S(split([{ currency: 'INR', minor: 84000, n: 2 }, { currency: 'AUD', minor: 15000, n: 2 }], { n: 4 }));
assert.strictEqual(h, '4 orders not billed yet ₹840 + AUD 150 · not added together');
assert(!/990/.test(h), 'old code painted the sum 84000+15000 as INR 990: it must not');
assert.strictEqual(S(split([{ currency: 'INR', minor: 50000, n: 1 }], { n: 2, minor: 50000, currency: 'INR', no_currency: 1 })), '2 orders not billed yet ₹500 · 1 without a currency', 'E is left out of the money and never given the reader currency');
assert.strictEqual(S(split([], { n: 1, no_currency: 1 })), '1 order not billed yet · 1 without a currency');
assert.strictEqual(S(split([], { n: 1, unpriced: 1 })), '1 order not billed yet · 1 not priced yet', 'unpriced: said, never a wrong 0');
assert.strictEqual(S(Object.assign(split([{ currency: 'INR', minor: 50000, n: 1 }, { currency: 'AUD', minor: 9000, n: 1 }], { n: 2 }), { minor: null, cost_hidden: true })), '2 orders not billed yet hidden', 'blind wins: no per-currency figure is read');
assert.strictEqual(S({ n: 2 }), '2 orders not billed yet', 'field absent (older api): the count, no money, no 0');
console.log('crm-timeline-hidden: all ok');
