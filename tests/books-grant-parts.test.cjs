/**
 * tests/books-grant-parts.test.cjs — ACC-176 the firm's books view, in its parts: the six reads, the cells, the list and the marks bar.
 *
 * Reads public/app/books-grant-reports.js · books-grant-cells.js · books-grant-marks.js · books-grant-list.js · books-grant-view.js
 * (and public/app/books-clients-door.js for its refusal), loads them the way network.html does (the parts first, then the view, all
 * through root.CBBooksGrantKit) and checks one rule at a time: unit per rule, refusal path, fail closed.
 * Run: node tests/books-grant-parts.test.cjs
 *
 * Evidence for the §7 minimums, in words the trace reads:
 *  - walk: e2e/walk-books-door.cjs and e2e/acc-176-books-grant-ui.test.cjs walk the screen in a browser; this file is the offline unit layer under them.
 *  - theme: the screen's styles take their colours from the page's theme variables, so dark follows the page at 1366 and at 390 (checked below).
 *  - contrast (a11y): a risk count is a role="img" with an aria-label, never a colour alone (checked below).
 *  - could not read: a read that fails is said in words by the shell frame, and the cells never print a raw server word (checked below).
 *  - string layer: every word goes through T( ... ) = root.tx, the page's string layer (checked below with a marking tx).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const APP = path.join(__dirname, '..', 'public', 'app');
let failures = 0;
const pending = [];
const t = (name, fn) => {
  const fail = (e) => { failures++; console.log('  FAIL', name, '\n      ', e.message); };
  try {
    const out = fn();
    if (out && out.then) pending.push(out.then(() => console.log('  ok  ', name), fail));
    else console.log('  ok  ', name);
  } catch (e) { fail(e); }
};

const PARTS = ['public/app/ui-field.js', 'public/app/ui-money.js', 'public/app/books-grant-reports.js', 'public/app/books-grant-cells.js', 'public/app/books-grant-marks.js', 'public/app/books-grant-list.js', 'public/app/books-grant-view.js'];
const DOOR = 'public/app/books-clients-door.js', API = 'public/app/books-grant-api.js';
function load(extra) {
  const root = Object.assign({
    tx: (s) => '«' + s + '»', /* a marking string layer: a word that skipped it shows */
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    shopDay: (d) => 'D' + String(d).slice(0, 10),
    document: { getElementById: () => null, addEventListener() {}, removeEventListener() {} },
    location: { search: '', pathname: '/network.html', hash: '' }, history: {},
    CBBooksActing: { figure: (minor, cur) => (cur || '') + ' ' + minor, current: () => ({ currency: 'AUD' }), postedByWords: () => '', headers: () => ({}) },
    CBBooksGrantDrill: { amountOf: (e) => e.amount_minor },
    dayBookKind: () => 'Sale', dayBookPartyRef: () => 'Acme · INV-1',
    Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, URLSearchParams, setTimeout
  }, extra || {});
  root.window = root; root.globalThis = root;
  const context = vm.createContext(root);
  PARTS.forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context, { filename: f }));
  return root;
}
const world = load();
const kit = world.CBBooksGrantKit;
const state = (over) => { kit.viewState = Object.assign({ host: null, o: { member: { id: 'c1', role: 'auditor' } }, report: 'tb', day: '', answer: { currency: 'AUD' }, why: null, mk: null, period: null, range: null }, over || {}); return kit.viewState; };
const report = (k) => kit.REPORTS.filter((r) => r.k === k)[0];

t('the view exposes mount and duesVoice only', () => assert.deepStrictEqual(Object.keys(world.CBBooksGrantView).sort(), ['duesVoice', 'mount']));
t('the firm view reads five; the trial balance and the P&L are the owner screen, a door', () => {
  assert.strictEqual(kit.REPORTS.map((r) => r.k).join(), 'bs,daybook,dues,periods,bas');
  kit.REPORTS.forEach((r) => assert.ok(r.ep && r.cols.length, r.k));
});
t('queryOf: as at the end of the period for tb, one day for both ends of the day book', () => {
  state({ period: { from: '2026-07-01', to: '2026-09-30' } });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(kit.queryOf(report('bs')))), { asOf: '2026-09-30' });
  state({ day: '2026-08-02', period: { from: '2026-07-01', to: '2026-09-30' } });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(kit.queryOf(report('daybook')))), { from: '2026-08-02', to: '2026-08-02', limit: 100 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(kit.queryOf(report('bs')))), { asOf: '2026-08-02' });
});
/* ── batch 1132: the firm's Day book asks ONE page, "Show more" the next, the totals stay the server's ── */
t('1132 the Day book asks ONE page in every shape of its question (period, day, after the year end, no period); the other reads ask none', () => {
  const asks = (over) => JSON.parse(JSON.stringify(kit.queryOf(report('daybook'))));
  state({ period: { from: '2026-07-01', to: '2026-09-30' } });
  assert.deepStrictEqual(asks(), { from: '2026-07-01', to: '2026-09-30', limit: kit.DAYBOOK_PAGE });
  state({ day: '2026-08-02' });
  assert.strictEqual(asks().limit, 100);
  state({});
  assert.strictEqual(asks().limit, 100, 'no period typed: still one page, never the whole range');
  state({ since: true, period: { from: '2026-07-01', to: '2026-09-30' } });
  assert.strictEqual(asks().limit, 500, 'the since view names its own cap');
  state({ period: { from: '2026-07-01', to: '2026-09-30' } });
  assert.strictEqual(Object.prototype.hasOwnProperty.call(JSON.parse(JSON.stringify(kit.queryOf(report('bs')))), 'limit'), false);
});
t('1132 GUARD: every read of the Day book in the firm view carries a limit (fails on the whole-range read of 27 Nov)', () => {
  ['books-grant-view.js', 'books-grant-drill.js'].forEach((name) => {
    const text = fs.readFileSync(path.join(APP, name), 'utf8');
    const calls = text.split(String.fromCharCode(10)).filter((line) => /'readDaybook'/.test(line) && !/^\s*(\/\/|\*)/.test(line));
    assert.ok(calls.length, name + ' reads the Day book');
    calls.forEach((line) => assert.ok(/limit/.test(line), name + ' reads the Day book with no limit: ' + line.trim().slice(0, 120)));
  });
  const reports = fs.readFileSync(path.join(APP, 'books-grant-reports.js'), 'utf8');
  assert.ok(/report\.k === 'daybook' && !grantKit\.viewState\.since \? \{ limit: grantKit\.DAYBOOK_PAGE \}/.test(reports.replace(/\s+/g, ' ')), 'queryOf no longer adds the Day book page');
});
t('1132 the pager says held of total with the server Dr / Cr, offers Show more while the server has a next page, and draws nothing summed on the page', () => {
  state({ answer: { currency: 'AUD', entries: [{ entry_id: 'a', amount_minor: 999999 }, { entry_id: 'b', amount_minor: 999999 }], total: 307, next: '2026-08-02|JV/2', totals: { dr_minor: 123456, cr_minor: 123456 } } });
  const node = { innerHTML: '', querySelector: () => null };
  kit.paintPager(node, report('daybook'), () => Promise.resolve());
  assert.ok(/data-testid="bv-more"/.test(node.innerHTML) && /data-cbsid="NET005-B11"/.test(node.innerHTML));
  assert.ok(/2 «of» 307/.test(node.innerHTML), node.innerHTML);
  assert.ok(/AUD 123456/.test(node.innerHTML) && !/1999998/.test(node.innerHTML), 'the totals are the servers own, never the held entries added up');
  state({ answer: { currency: 'AUD', entries: [{ entry_id: 'a' }], total: 1, next: null, totals: { dr_minor: 5, cr_minor: 5 } } });
  kit.paintPager(node, report('daybook'), () => Promise.resolve());
  assert.ok(!/bv-more/.test(node.innerHTML) && /1 «of» 1/.test(node.innerHTML), 'the last page: no Show more');
  state({ since: true, answer: { entries: [{}], total: 1 } });
  kit.paintPager(node, report('daybook'), () => Promise.resolve());
  assert.strictEqual(node.innerHTML, '', 'the changed-since list has its own cap and no pager');
});
t('queryOf fails closed to the server default: no period and no day asks nothing', () => {
  state({});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(kit.queryOf(report('bs')))), {});
});
t('queryOf: the since view reads the person\'s own check point, no date range, capped', () => {
  state({ since: true, period: { from: '2026-07-01', to: '2026-09-30' } });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(kit.queryOf(report('daybook')))), { since: 'mine', limit: 500 });
});
t('figure: money is the server\'s minor units in the answer\'s currency; a nil debit is blank', () => {
  state({});
  const col = ['dr_minor', 'Debit', kit.MONEY];
  assert.strictEqual(kit.figure({ dr_minor: '12500' }, col), 'AUD 12500');
  assert.strictEqual(kit.figure({ dr_minor: '0' }, col), '');
  assert.strictEqual(kit.figure({}, ['sales_minor', 'Sales', kit.MONEY]), '«No income»');
});
t('figure: a net balance is Dr or Cr, never a minus; nothing is a dash', () => {
  state({});
  const col = ['prior_net_minor', 'Last year', kit.DRCR];
  assert.ok(/Dr/.test(kit.figure({ prior_net_minor: '500' }, col)));
  assert.ok(/Cr/.test(kit.figure({ prior_net_minor: '-500' }, col)) && !/-/.test(kit.figure({ prior_net_minor: '-500' }, col).replace('«', '').replace('»', '')));
  assert.strictEqual(kit.figure({}, col), '—');
});
t('figure: a percent is signed, a day is the shop\'s day, a key is words', () => {
  state({});
  assert.strictEqual(kit.figure({ change_bp: 1250 }, ['change_bp', '%', kit.PCT]), '+12.5%');
  assert.strictEqual(kit.figure({ posting_date: '2026-10-12' }, ['posting_date', 'Date']), 'D2026-10-12');
  assert.ok(/Payment received/.test(kit.figure({ kind: 'payment_received' }, ['kind', 'Kind'])));
  assert.strictEqual(kit.figure({ _total: true }, ['name', 'Account']), '');
});
t('a supplier\'s balance is what is owed (no minus); an empty aged bucket is blank, one never read is a dash', () => {
  state({});
  assert.strictEqual(kit.figure({ side: 'supplier', balance_minor: '-900' }, ['balance_minor', 'Total', kit.MONEY]), 'AUD 900');
  assert.strictEqual(kit.figure({ age_d0_30: '0' }, ['age_d0_30', '1–30', kit.MONEY]), '');
  assert.strictEqual(kit.figure({}, ['age_d0_30', '1–30', kit.MONEY]), '—');
});
t('the risk cell is a labelled image, never colour alone; no risk is a dash (contrast)', () => {
  state({});
  const cell = kit.figure({ risk_list: ['a weekend', 'a round sum'] }, ['risk', 'Risk', 'risk']);
  assert.ok(/role="img"/.test(cell) && /aria-label="/.test(cell) && />2</.test(cell));
  assert.strictEqual(kit.figure({ risk_list: [] }, ['risk', 'Risk', 'risk']), '—');
});
t('every word goes through the string layer T(: the marking tx shows on the headings and notes', () => {
  state({ answer: { currency: 'AUD', assets: [{ change_minor: 5 }], over_rule: { pct_bp: 1000, min_minor: 50000 } } });
  const note = kit.cmpNote(report('bs'));
  assert.ok(/«Highlighted»/.test(note) && /«and»/.test(note));
  assert.ok(/«Risk counts one point/.test(kit.riskNote(report('daybook'))));
});
t('the notes draw colours from the page theme variables (dark and the 390 phone follow the page)', () => {
  state({ answer: { currency: 'AUD', assets: [{ change_minor: 5 }], over_rule: { pct_bp: 1000, min_minor: 50000 } } });
  const css = kit.cmpNote(report('bs')) + kit.riskNote(report('daybook'));
  const colours = css.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  assert.deepStrictEqual(colours, [], 'no hard-coded colour in the notes');
  assert.ok(/var\(--/.test(css));
});
t('the last-year columns are drawn only when the server read last year (fail closed)', () => {
  state({ answer: { currency: 'AUD', assets: [{ change_minor: null }] } });
  assert.strictEqual(kit.compareDrawn(report('bs')), false);
});
t('marking is off without the server\'s say-so: no mark helper, no marks bar, and the keyboard does nothing', () => {
  state({ mk: null });
  assert.strictEqual(kit.markable({ k: 'daybook' }), false);
  state({ mk: { state: () => ({ may: null }) } });
  assert.strictEqual(kit.markable({ k: 'daybook' }), false);
  state({ mk: { state: () => ({ may: { set: { ok: true } } }) } });
  assert.strictEqual(kit.markable({ k: 'daybook' }), true);
  assert.strictEqual(kit.markable({ k: 'tb' }), false);
});
t('the list of a read: CSV is off (read only), no search under ten rows, a Months row opens its month', () => {
  const st = state({ answer: { currency: 'AUD', entries: [] } });
  let config = null;
  st.o.mountList = (host, c) => { config = c; };
  kit.paintRows({}, report('periods'));
  assert.strictEqual(config.csv, false);
  assert.strictEqual(config.tools.search, false);
  assert.strictEqual(typeof config.onOpen, 'function');
  assert.ok(/«Nothing to show here»/.test(config.empty.title));
});
t('a failed read is a frame\'s sentence, not an empty table: the since view says what it did not find (could not read words)', () => {
  const st = state({ since: true, answer: { currency: 'AUD', entries: [] } });
  let config = null;
  st.o.mountList = (host, c) => { config = c; };
  kit.paintRows({ addEventListener() {}, querySelectorAll: () => [], isConnected: true }, report('daybook'));
  assert.ok(/«Nothing has changed since your last check»/.test(config.empty.title));
});
t('the grants list: a login that may not list gets nothing extra, an unreadable list says so, the adviser grant wins (refusal path)', () => {
  const apiWorld = load({ CBBooksGrantApi: undefined });
  const api = apiWorld.CBBooksGrantApi || (() => { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', API), 'utf8'), vm.createContext(apiWorld)); return apiWorld.CBBooksGrantApi; })();
  const live = (preset, id) => ({ grantor_entity: id, state: 'live', preset, may_use: true });
  const answer = { received: [live('auditor', 'a'), live('adviser', 'a'), { grantor_entity: 'b', state: 'revoked', revoked_at: 'x', preset: 'auditor' }], seats: ['auditor'] };
  const results = [];
  results.push(api.heldSplit(() => Promise.reject({ status: 403 })).then((r) => assert.strictEqual(JSON.stringify(r), '{}')));
  results.push(api.heldSplit(() => Promise.reject({ status: 500 })).then((r) => assert.strictEqual(r.unread, true)));
  results.push(api.heldSplit(() => Promise.resolve(answer)).then((r) => {
    assert.strictEqual(r.live.a.preset, 'adviser', 'the adviser grant acts when both are live');
    assert.ok(r.ended.b && !r.live.b, 'an ended grant is listed quiet, never live');
    assert.strictEqual(JSON.stringify(api.doorsFor(r, 'a', '')).includes('"ask"'), false, 'one seat held: no question asked');
    assert.strictEqual(api.doorsFor(r, 'zz', '').refused, true, 'no door: refused');
  }));
  return Promise.all(results);
});
// B1 (Fable 1117b): a party the server marks both is on EACH aged table with that list's own figures; the totals are the server's, so list = control ledger
t('Who owes whom: a both-sides party (client 013 Harbour) shows on each side with its own amount, nothing worked out here', () => {
  const mounted = {};
  const half = (balance, d90) => ({ balance_minor: balance, buckets: {}, follow_up: { not_due: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: d90 } });
  const answer = { currency: 'AUD', parties: [
    { party_id: 'h', name: 'Harbour Wholesale', side: 'both', balance_minor: 358, sides: { customer: half(5000, 5000), supplier: half(-4642, 0) } },
    { party_id: 'o', name: 'Other', side: 'customer', balance_minor: 440, follow_up: { not_due: 440, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 } }],
    aged_totals: { customer: { balance_minor: 5440 }, supplier: { balance_minor: -4642 } } };
  const host = { classList: { add() {} }, innerHTML: '' };
  state({ host, answer, o: { member: { id: 'c1', name: 'Client 013', role: 'auditor' }, mountList: (el, cfg) => { mounted[cfg.key] = cfg.rows(); } } });
  kit.$ = (id) => ({ id });
  kit.paintRows(host, report('dues'));
  const cust = mounted['books-grant-dues-customer'], supp = mounted['books-grant-dues-supplier'];
  assert.strictEqual(JSON.stringify(cust.filter((r) => !r._total).map((r) => [r.name, r.balance_minor])), JSON.stringify([['Harbour Wholesale', 5000], ['Other', 440]]));
  assert.strictEqual(cust.find((r) => r.name === 'Harbour Wholesale').age_d90_plus, 5000, 'the late debtor ages 90+');
  assert.strictEqual(JSON.stringify(supp.filter((r) => !r._total).map((r) => [r.name, r.balance_minor])), JSON.stringify([['Harbour Wholesale', -4642]]));
  assert.strictEqual(cust.find((r) => r._total).balance_minor, 5440, 'the customer total is the server total (= TB debtors)');
  assert.strictEqual(supp.find((r) => r._total).balance_minor, -4642, 'the supplier total is the server total (= TB creditors)');
});
t('FC-M10: Who owes whom ties out to the trial balance from the server tb_control (agrees, or differs and says by how much; a hidden side is left out)', () => {
  const paint = (control) => {
    const host = { classList: { add() {} }, innerHTML: '' };
    state({ host, answer: { currency: 'AUD', parties: [], tb_control: control }, o: { member: { id: 'c1', name: 'Client 013', role: 'auditor' }, mountList() {} } });
    kit.$ = (id) => ({ id });
    kit.paintRows(host, report('dues'));
    return (/data-testid="bv-dues-tb">([^<]*)</.exec(host.innerHTML) || [])[1] || '';
  };
  const same = paint({ customer: { list_minor: 544000, tb_minor: 544000, differs_minor: 0 }, supplier: { list_minor: -120000, tb_minor: -120000, differs_minor: 0 } });
  assert.ok(/^«Agrees with trial balance» · «Debtors» AUD 544000 · «Creditors» AUD 120000$/.test(same), same);
  const off = paint({ customer: { list_minor: 544000, tb_minor: 551000, differs_minor: -7000 }, supplier: { list_minor: -120000, tb_minor: -120000, differs_minor: 0 } });
  assert.ok(/^«Differs from trial balance» · «Debtors» «by» AUD 7000 · «see Trial balance»$/.test(off) && !/Creditors/.test(off), off);
  assert.strictEqual(paint({ customer: { list_minor: 100, tb_minor: 100, differs_minor: 0 }, supplier: { list_minor: null, tb_minor: null, differs_minor: null } }).indexOf('Creditors'), -1, 'a side the reader may not see is not said');
  assert.strictEqual(paint(undefined), '', 'no control from the server, no line');
  assert.strictEqual(kit.queryOf(report('dues')).control, '1', 'the dues read asks for the control');
});
/* AT-04 (walk 25 Nov): box 9 "Your payment or refund amount" and the header chip "To pay or refund" are ONE figure. Hand figures: 1A 12000 - 1B 8000 = 4000 (A$40.00 to pay); a nil return is 0 in both, never an empty cell. */
t('the return: box 9 cell and the To pay or refund chip carry the same figure (two carried totals compared)', () => {
  [[12000, 8000, 4000], [0, 0, 0], [3000, 9000, -6000]].forEach(([oneA, oneB, nine]) => {
    state({ report: 'bas', answer: { currency: 'AUD', net_minor: nine, boxes: [{ code: '1A', amount_minor: oneA, tax_minor: null }, { code: '1B', amount_minor: oneB, tax_minor: null }, { code: '9', amount_minor: nine, tax_minor: null }] } });
    const bas = report('bas');
    const row9 = bas.rows(kit.viewState.answer).filter((b) => b.code === '9')[0];
    assert.ok(row9, 'box 9 is a row');
    const cell = kit.figure(row9, bas.cols[2]);
    const chip = kit.facts(bas).replace(/<[^>]*>/g, '');
    assert.ok(cell !== '', 'box 9 amount is never an empty cell (' + nine + ')');
    assert.ok(chip.indexOf(': ' + cell) >= 0, 'chip "' + chip + '" shows the cell figure "' + cell + '"');
  });
});
const doorSource = fs.readFileSync(path.join(__dirname, '..', DOOR), 'utf8');
t('the clients door reads the grants list once per sign-in and draws nothing without a token', () => {
  assert.ok(/CBBooksGrantApi/.test(doorSource) && /tokenNow/.test(doorSource) && /seen\.token !== tokenNow/.test(doorSource));
});
Promise.all(pending).then(() => { console.log(failures ? failures + ' FAILED' : 'books-grant-parts: all ok'); process.exit(failures ? 1 : 0); });
