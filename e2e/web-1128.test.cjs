/**
 * web-1128.test.cjs — batch 1128 web fixes, offline (no browser, no network).
 * OWNS      COUNT-SOURCE (headline counts read the server total; a filtered count is labelled by its filter) · the tax-close amend offer · till surface only from a paired counter · E-F-10 repeated labels.
 * CALLED BY .github/workflows/ci.yml (Offline guards).   node e2e/web-1128.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { liftFns } = require('./lib/lift-fn.cjs');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');

/* COUNT-SOURCE: the practice head, and the CRM nav, read the server's total; finance group heads say what the filter is */
assert.ok(/escapeHtml\(clientCount\(practiceKit\.practiceState\.data\)\)/.test(src('app/books-practice.js')) && /function clientCount\(data\) \{[^\n]*data && data\.total/.test(src('app/books-practice.js')), 'practice head reads data.total ?? clients.length (through clientCount, the batch 1127 helper)');
]*data && data.total/.test(src('app/books-practice.js')), 'practice head reads data.total ?? clients.length (through clientCount, the batch 1127 helper)');
assert.ok(/CRM\.total != null \? CRM\.total : CRM\.rows\.length/.test(src('app/cap-crm.js')), 'CRM nav reads the server total');
assert.ok(/CRM\.total = reply && reply\.total != null/.test(src('app/cap-crm.js')));
assert.ok(!/txn\('\{count\} part(y|ies)'.*rows\.length\) \+/.test(src('app/cap-finance.js').split('\n').join(' ').replace(/\s+/g, ' ')) , 'finance heads are "N owe you", not "N parties"');
assert.ok(src('app/cap-finance.js').includes("txn('{count} owes you', '{count} owe you', rows.length)"));

/* the tax-close amend offer: a refusal that names the closed tax period adds "Amend this return"; any other refusal does not */
function run(what, failure) {
  const out = { textContent: '', kids: [], attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild(n) { this.kids.push(n); }, };
  const cx = vm.createContext({ tx: (s) => s, bkLockReopen: () => {}, document: { getElementById: () => out, createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }), createTextNode: (t) => ({ t }) } });
  vm.runInContext(liftFns('public/app/cap-books-lock.js', ['bkLockRefused']) + '\nthis.f = bkLockRefused;', cx);
  cx.f(what, 3, 'the words', failure);
  return out;
}
const closed = run('unlock', { status: 400, message: 'This month is in a closed tax period (Q1). Opening it means amending that return' });
assert.strictEqual(closed.textContent, 'the words'); assert.strictEqual(closed.kids.filter((k) => k.textContent === 'Amend this return').length, 1);
assert.strictEqual(run('unlock', { status: 400, message: 'Only the owner may' }).kids.length, 0);
assert.strictEqual(run('lock', { status: 400, message: 'closed tax period' }).kids.length, 0);
assert.ok(/amend_tax: true/.test(src('app/cap-books-lock.js')));

/* sign-in: 'till' only from a paired counter; the two new refusals are said in words */
const till = src('till.html');
assert.ok(till.includes("surface: tillSurface()") && !/surface: 'till'/.test(till.replace(/\/\*[\s\S]*?\*\//g, '')), 'the till never hard-codes surface till');
const tcx = vm.createContext({ CloudHost: { key: null }, ls: { get: () => null } });
vm.runInContext(liftFns('public/till.html', ['tillSurface']) + '\nthis.f = tillSurface;', tcx);
assert.strictEqual(tcx.f(), 'web'); tcx.CloudHost.key = 'k'; assert.strictEqual(tcx.f(), 'till');
const si = src('app/signin-ui.js'); assert.ok(si.includes("PIN_ALREADY_SET") && si.includes("SESSION_EXPIRED"));

/* India returns: the _cb notes (tax_differs, einvoice, reversed credit-note rows) reach the GSTR screen as the server's own sentences */
const rcx = vm.createContext({});
vm.runInContext(liftFns('public/app/cap-finance-returns.js', ['frNotes']) + '\nthis.f = frNotes;', rcx);
const said = rcx.f({ tax_differs: [{ words: 'Bill 7 differs' }], einvoice: { words: 'E-invoicing warning' }, reversed: [{ credit_note: true, words: 'Bill 3 carried as a credit note' }, { words: '' }] });
assert.strictEqual(JSON.stringify(said), JSON.stringify(['Bill 7 differs', 'E-invoicing warning', 'Bill 3 carried as a credit note']));
assert.strictEqual(rcx.f(null).length, 0);
assert.ok(src('app/cap-finance-returns.js').includes('frNotesHtml(cb)') && src('app/helpers.js').includes('onReply(reply)'));

/* E-F-10 */
assert.ok(/nl: true/.test(src('app/cap-mis-trend.js')) && src('app/cap-mis-trend.js').includes('tr-key'));
assert.ok(!/class=\\"tag\' \+ \(group\.kind === 'segment'/.test(src('app/cap-crm-groups.js')));
console.log('web-1128: all offline checks pass');
