'use strict';
// @type: unit
/**
 * bank-rules-1129.test.cjs - bank rules slice 1, the web half (walks/CRITIC-REQ-BANK-RULES-2026-11-21.md items 1 and 5).
 *
 * OWNS      the proof that (1) the sheet's controller HOLDS the rule an answer taught (view().taught, by line) and drops it when the answer is changed, so the host keeps it ONLY when Add posts the line;
 *           (2) the host keeps it through the one writer bkbKeepRule, and no dead BKB.teach hook is left; (3) the accept mark's `how` is rule:<id> when a taught rule decided the line;
 *           (4) a held-back rule shows its own words (rule_check). The engines are stand-ins; the rule's key, amount and flags are proven in engines tests/bank-rules-1129.test.js.
 * CALLED BY ci.yml (the unit checks): node e2e/bank-rules-1129.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'),
  path = require('path'),
  assert = require('assert');
const pub = (rel) => path.join(__dirname, '..', 'public', rel);
const src = (rel) => fs.readFileSync(pub(rel), 'utf8').split('\r\n').join('\n');
require(pub('app/shop-time.js'));
const P = require(pub('app/bank-preview.js'));

const FEE_LINE = { date: '2026-11-03', narration: 'Account fee', debit_minor: 1000, credit_minor: 0 };
const RULE = { id: 'out:ACCOUNT_FEE', has: 'ACCOUNT FEE', phrase: 'ACCOUNT FEE', amount_minor: 1000, side: 'out', event: { type: 'expense', class: 'bank_charges', paid_from: 'bank' } };
function ruleEngines() {
  const ref = 'bank:' + 'a'.repeat(23) + '0-1';
  return {
    recon: {
      parse: () => ({ ok: true, lines: [FEE_LINE], warnings: [], skipped: [], opening_minor: 0, closing_minor: 0 }),
      match: () => ({ matched: [], unmatched_stmt: [Object.assign({ i: 0 }, FEE_LINE)], unmatched_ledger: [] }),
      suggest: () => ({ event: null, confidence: 'none', proposal: false })
    },
    entry: {
      resolve: (line, answers) => (answers.account === 'refused' ? { ok: false, why: 'no' } : { ok: true, taught: RULE, learned: true, event: { type: 'expense', date: line.date, amount: 10 }, proposal: true, basis: 'taught' })
    },
    project: {
      refsOf: () => [ref],
      project: (lines, proposals) => ({
        ok: true,
        currency: 'AUD',
        lines: [{ i: 0, state: proposals[0] && proposals[0].event ? 'proposed' : 'needs_you', ready: !!(proposals[0] && proposals[0].event), blockers: [], ref, entry: proposals[0] && proposals[0].event ? { lines: [] } : null, party: null }],
        ledger: [],
        brs: null,
        totals: null,
        counts: { lines: 1, in_books: 0, proposed: 1, ready: 1, needs_you: 0 },
        parties_to_create: []
      })
    }
  };
}
const ctl = P.create({ engine: ruleEngines(), currency: 'AUD', statementCurrency: () => 'AUD', account: 'Demo', ledger: () => ({ lines: [], opening_minor: 0 }), post: async () => ({ ok: true, entry_no: 'E1' }), lockedMonth: () => null });
assert.strictEqual(ctl.load('ok', 'f.csv').ok, true);
const key = ctl.view().items[0].key;
assert.deepStrictEqual(ctl.view().taught, {}, 'nothing is taught before the owner answers');
ctl.resolveLine(key, { kind: 'expense', account: 'bank_charges', tax_kind: 'gst_free' });
assert.strictEqual(ctl.view().taught[key].id, 'out:ACCOUNT_FEE', 'the answer taught a rule: held for the host');
console.log('ok  the controller holds the rule an answer taught, by line');
ctl.resolveLine(key, { kind: 'expense', account: 'refused', tax_kind: 'gst_free' });
assert.strictEqual(ctl.view().taught[key], undefined, 'a refused answer teaches nothing');
console.log('ok  a refused answer holds no rule');

const sheet = src('app/cap-bank-sheet.js'), bank = src('app/cap-bank.js');
assert.ok(/taught\[item\.key\]\) bkbKeepRule\(taught\[item\.key\]\)/.test(sheet) && /results\[item\.key\]\.ok/.test(sheet), 'the host keeps a rule only for a line that posted');
assert.ok(/function bkbKeepRule\(/.test(bank), 'one writer of a rule on the device');
assert.ok(!/BKB\.teach/.test(bank), 'the dead BKB.teach hook is gone');
assert.ok(/how: \('rule:' \+ id\)\.slice\(0, 40\)/.test(sheet), "the accept mark's how names the rule");
assert.ok(/rule_check:/.test(src('app/bank-preview-line.js')), 'a held-back rule says why on the line');
console.log('ok  the host keeps the rule only when the line posted; the accept mark says rule:<id>; rule_check has words');
console.log('4 checks');
