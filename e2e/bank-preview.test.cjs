'use strict';
// @type: unit
/**
 * bank-preview.test.cjs - the Bank-to-books preview module, its in-app post adapter and the no-login demo page.
 *
 * OWNS      the proof that public/app/bank-preview.js (1) fingerprints a line the same in a re-exported file, (2) refuses a statement in another currency than the
 *           account, naming both, (3) never offers a line that needs a person, (4) posts ONE LINE AT A TIME: a failing line shows its own reason and the others go on,
 *           (5) refuses a line in a closed month before the press and counts it in the popup, (6) counts new parties once, (7) asks the GST basis and reads again with
 *           it; that public/app/cap-bank-post.js makes a new party FIRST, then posts with the party id and client_ref bank:<fp>, and says an owner-only refusal once;
 *           and that public/bank-demo.html is public and inert: strict CSP, noindex, no config.js / device-id.js, no network call and no storage in its files.
 *           The engines are stand-ins here (their contract is read through one door, projectionOf_); the real engines are proven by the SIT walk.
 * CALLED BY ci.yml (the unit checks): node e2e/bank-preview.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'),
  path = require('path'),
  assert = require('assert');
const pub = (rel) => path.join(__dirname, '..', 'public', rel);
const read = (rel) => fs.readFileSync(pub(rel), 'utf8').split('\r\n').join('\n');
const P = require(pub('app/bank-preview.js')),
  POST = require(pub('app/cap-bank-post.js'));
let ran = 0;
const ok = (name) => console.log('ok  ' + name) || ran++;

/* ── stand-in engines, shaped as the engines contract says (project(lines, proposals, books); amounts are { amount_minor, currency }) ── */
const LINES = [
  { date: '2026-10-23', narration: 'Account fee', debit_minor: 2200, credit_minor: 0 },
  { date: '2026-10-28', narration: 'Credit interest', debit_minor: 0, credit_minor: 1250 },
  { date: '2026-11-02', narration: 'ATO payment', debit_minor: 120000, credit_minor: 0 },
  { date: '2026-11-05', narration: 'Telstra', debit_minor: 11000, credit_minor: 0 },
  { date: '2026-11-06', narration: 'EFT customer', debit_minor: 0, credit_minor: 55000 }
];
const money = (minor) => ({ amount_minor: minor, currency: 'AUD' });
function engines(seen) {
  return {
    recon: {
      parse: (text) => (text === 'bad' ? { ok: false, why: 'Nothing to read: the statement is empty.' } : { ok: true, lines: LINES, warnings: [], opening_minor: 1000000, closing_minor: 1750850 }),
      match: () => ({ matched: [{ stmt: [4], ledger: ['L1'], how: 'amount+date' }] }),
      suggest: (line, o) => (seen.suggest.push(o), { event: { type: 'expense', date: line.date, amount: 1 } })
    },
    project: {
      project: (lines, proposals, books) => {
        seen.project++;
        seen.args = { lines, proposals, books };
        if (books.statement.currency !== books.currency) return { ok: false, code: 'currency_mismatch', why: 'This statement is in ' + books.statement.currency + ' but the bank account is in ' + books.currency + '. Nothing is converted in this version.' };
        const gst = seen.suggest[seen.suggest.length - 1].gst_basis ? [] : ['gst_basis'];
        const row = (i, state, ready, blockers, party) => ({ i, state, ready, blockers, ref: 'bank:' + 'a'.repeat(23) + i + '-1', entry: ready || blockers.length ? { lines: [] } : null, party: party || null });
        return {
          ok: true,
          currency: 'AUD',
          lines: [
            row(0, 'proposed', true, []),
            row(1, 'proposed', true, [], { status: 'new', name: 'Origin Energy', kind: 'supplier' }),
            row(2, 'needs_you', false, ['no_entry'], { status: 'new', name: 'ATO', kind: 'supplier' }),
            row(3, 'proposed', !gst.length, gst, { status: 'new', name: 'origin energy', kind: 'supplier' }),
            row(4, 'in_books', false, [])
          ],
          ledger: [],
          brs: null,
          totals: seen.noTotals ? null : { entries: 3, in: money(1250), out: money(13200), tax: money(0), from: '2026-10-23', to: '2026-11-05' },
          counts: { lines: 5, in_books: 1, proposed: 3, ready: 3, needs_you: 1 },
          parties_to_create: [{ key: 'party:1', name: 'ATO', kind: 'supplier', lines: [2], did_you_mean: [{ id: 'p1', name: 'Australian Taxation Office', kind: 'supplier', score: 0.7 }] }]
        };
      }
    }
  };
}
const make = (over) => {
  const seen = { suggest: [], project: 0, posted: [] };
  const ctl = P.create(
    Object.assign(
      {
        engine: engines(seen),
        currency: 'AUD',
        account: 'Demo',
        ledger: () => ({ lines: [], opening_minor: 1000000 }),
        post: async (item) => (seen.posted.push(item.ref), { ok: true, entry_no: 'E' + seen.posted.length }),
        lockedMonth: () => null
      },
      over
    )
  );
  return { ctl, seen };
};

(async () => {
  /* currency */
  const usd = make({ statementCurrency: () => 'USD' });
  const refused = usd.ctl.load('ok', 'x.csv');
  assert.strictEqual(refused.ok, false);
  assert.ok(/USD/.test(refused.why) && /AUD/.test(refused.why));
  assert.deepStrictEqual(usd.ctl.view().items, []);
  assert.strictEqual(make().ctl.load('bad').ok, false);
  ok('a statement in another currency is refused (the engine words, naming both) and no line is shown');

  /* never offered: needs-you, gst question; ready count */
  const m = make();
  assert.strictEqual(m.ctl.load('ok', 'f.csv').ok, true);
  const items = m.ctl.view().items;
  assert.deepStrictEqual(items.map((i) => i.ready), [true, true, false, false, false]);
  assert.strictEqual(items[3].needs, 'gst_basis');
  ok('a line with no proposal, and a line waiting on the GST basis, are not ready');
  m.ctl.answer('gst_basis', 'cash');
  assert.strictEqual(m.seen.suggest[m.seen.suggest.length - 1].gst_basis, 'cash');
  assert.strictEqual(m.ctl.readyCount(), 3);
  ok('the GST basis is passed to the engine and the proposals are read again');

  /* popup */
  const text = m.ctl.confirmText();
  const all = text.title + text.lines.join('|');
  ['Add 3 entries', 'AUD 12.50', 'AUD 132.00', '23 Oct 2026 to 5 Nov 2026', 'AUD', '1 new party', '1 still need you'].forEach((w) => assert.ok(all.includes(w), w + ' in ' + all));
  ok('the popup says count, in, out, range, currency, new parties and who still needs you; two lines naming one payee make one party');
  m.seen.noTotals = true;
  m.ctl.answer('x', 1);
  assert.strictEqual(m.ctl.confirmText(), null);
  ok('with no carried figures from the engine the popup is not made up');

  /* one at a time: a failure shows on its line, the rest go on */
  const f = make({
    post: async (item) => {
      if (item.i === 1) return { ok: false, why: 'The server said no.' };
      if (item.i === 3) throw new Error('Network down');
      return { ok: true, entry_no: 'E1' };
    }
  });
  f.ctl.load('ok', 'f.csv');
  f.ctl.answer('gst_basis', 'cash');
  const told = [];
  const sum = await f.ctl.postReady((item, r) => told.push(item.i + ':' + r.ok));
  assert.deepStrictEqual(sum, { tried: 3, added: 1, failed: 2 });
  assert.deepStrictEqual(told, ['0:true', '1:false', '3:false']);
  assert.strictEqual(f.ctl.view().results[f.ctl.view().items[1].key].why, 'The server said no.');
  assert.strictEqual(f.ctl.view().results[f.ctl.view().items[3].key].why, 'Network down');
  assert.ok(f.seen.project >= 3, 'the books are read and projected again after the press');
  ok('posting is one line at a time: a failure (answer or throw) is that line\'s reason and the others continue');

  /* closed month */
  const c = make({ lockedMonth: (d) => (d.startsWith('2026-10') ? { month: 'Oct 2026', words: 'Oct 2026 is closed.' } : null) });
  c.ctl.load('ok', 'f.csv');
  c.ctl.answer('gst_basis', 'cash');
  assert.deepStrictEqual(c.ctl.view().items.map((i) => i.state), ['closed', 'closed', 'needs_you', 'proposed', 'in_books']);
  assert.strictEqual(c.ctl.view().items[0].why, 'Oct 2026 is closed.');
  assert.ok(c.ctl.confirmText().lines.join('|').includes('2 in a closed month'));
  await c.ctl.postReady();
  assert.deepStrictEqual(c.seen.posted.length, 1);
  ok('a line in a closed month is refused before the press, named, counted, and never posted');

  /* party edit */
  const e = make();
  e.ctl.load('ok');
  const k1 = e.ctl.view().items[1].key;
  assert.strictEqual(e.ctl.editParty(k1, { name: '  ', kind: 'supplier' }).ok, false);
  e.ctl.editParty(k1, { status: 'existing', id: 'p9', name: 'Origin Energy Pty' });
  assert.strictEqual(e.ctl.view().items[1].party.status, 'existing');
  ok('a new party needs a name; an existing party can be picked from did-you-mean');

  /* in-app adapter */
  const calls = [];
  const api = async (key, o) => {
    calls.push([key, o.body]);
    if (key === 'supAdd') return o.body.name === 'Fail Co' ? Promise.reject(new Error('Name taken')) : { supplier: { supplier_entity_id: 'sup-1' } };
    return { entry_no: 'MJ-9', duplicate: false };
  };
  const post = POST.adapter({ api, who: { role: 'owner' } });
  const item = { ref: 'bank:abc', event: { type: 'expense', amount: 1 }, party: { status: 'new', name: 'Origin Energy', kind: 'supplier' } };
  const done = await post(item);
  assert.deepStrictEqual(calls.map((x) => x[0]), ['supAdd', 'booksEventPost']);
  assert.strictEqual(calls[1][1].party, 'sup-1');
  assert.strictEqual(calls[1][1].client_ref, 'bank:abc');
  assert.strictEqual(done.ok, true);
  await post(item);
  assert.strictEqual(calls.filter((x) => x[0] === 'supAdd').length, 1);
  const bad = await post({ ref: 'bank:x', event: {}, party: { status: 'new', name: 'Fail Co', kind: 'supplier' } });
  assert.strictEqual(bad.ok, false);
  assert.ok(/Fail Co/.test(bad.why) && /Name taken/.test(bad.why));
  assert.strictEqual(calls.filter((x) => x[1] && x[1].client_ref === 'bank:x').length, 0);
  const acct = await POST.adapter({ api, who: { role: 'accountant' } })(item);
  assert.strictEqual(acct.ok, false);
  ok('app adapter: the party is made FIRST (once), the entry carries its id and bank:<fp>; a party failure fails that line only; a non-owner is told at once');

  /* the demo page is public and inert */
  const html = read('bank-demo.html');
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html);
  assert.ok(csp && !/unsafe-inline|unsafe-eval|https?:/.test(csp[1]) && /connect-src 'none'/.test(csp[1]), 'strict CSP, no network');
  assert.ok(/name="robots" content="noindex/.test(html));
  assert.ok(/Demo\. Nothing is saved/.test(html));
  assert.ok(!/config\.js|device-id\.js|analytics|<script>[^<]|style="/.test(html.replace(/<!--[\s\S]*?-->/g, '')));
  const codes = html.match(/data-cbsid="[^"]+"/g) || [];
  assert.strictEqual(new Set(codes).size, codes.length);
  assert.ok(codes.every((x) => /BKS017-[A-Z]\d\d/.test(x)));
  ['app/bank-demo.js', 'app/bank-preview.js', 'app/bank-demo.css'].forEach((rel) => {
    const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|document\.cookie|@import|url\(/.test(src), rel + ' is inert');
  });
  ok('bank-demo.html: strict CSP, noindex, a Demo banner, no config.js / device-id.js, one code per control, and no network or storage in its files');
  console.log(ran + ' checks passed');
})().catch((err) => {
  console.error('FAIL', err && err.stack ? err.stack : err);
  process.exit(1);
});
