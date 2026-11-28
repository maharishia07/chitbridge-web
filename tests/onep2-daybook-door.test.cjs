/* tests/onep2-daybook-door.test.cjs — ONEP-2 PR 7b (PM/ONEP-2-PLAN-2026-11-28.md rows 4 and 7): the firm's Day book painter is gone; the owner's Day book (accounts.html tab daybook) is the ONE screen, a door.
 * LANDING (named, as the plan asks): a client opens straight on the owner's Day book. The way back carries view=dues (the first read this view still has), so the door is opened once and Back never bounces.
 * HAND: client 's1' Acme Pty, auditor seat, fresh open (no view) -> /accounts.html?acting=s1&role=auditor&view=dues#/daybook ; the adviser role=adviser.
 *   A Months row 2026-07-01 – 2026-07-31 -> the same door with &from=2026-07-01&to=2026-07-31 (the month, not the year). The bell's words (mark, note, nl) ride to the door once.
 *   A return to view=dues opens no door and reads the dues (a read this view still has).
 * GUARD (the enforcer): no firm / network view file reads or paints a Day book of its own (names AND content); the auditor may open tab daybook. 6 mutations go red.
 * CARD 14-accounting/day-book */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok   ' + name); });
const PARTS = ['public/app/books-audit-tools.js', 'public/app/books-grant-reports.js', 'public/app/books-grant-cells.js', 'public/app/books-grant-marks.js', 'public/app/books-grant-list.js', 'public/app/books-grant-view.js'];
function open(role, search, view, parts, periods) {
  const assigned = [], reads = [], replaced = [];
  const root = {
    tx: (s) => s, esc: String, shopDay: (d) => 'D' + d, URLSearchParams, Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, setTimeout,
    document: { getElementById: () => null, addEventListener() {} }, history: {}, location: { search, pathname: '/network.html', hash: '', assign: (u) => assigned.push(u), replace: (u) => { assigned.push(u); replaced.push(u); } },
    CBPeriodPick: { toAddress: (p) => (p && p.fy ? '&fy=' + p.fy : ''), same: () => true, filled: (p) => p }, CBShell: {},
    CBBooksActing: { enter() {}, onClear: () => () => {}, current: () => ({ store: { id: 's1', name: 'Acme Pty' } }), headers: () => ({}), setCurrency() {}, css() {}, banner: () => '', crumbs: () => '', periodSlot: () => '', figure: String, auditAddressOf: (store, tab, carry, r) => '/accounts.html?acting=' + store.id + '&role=' + r + (carry || '') + '#/' + tab },
    CBBooksGrantApi: { run: (call, key) => { reads.push(key); return periods === 'fail' ? Promise.reject(new Error('no')) : Promise.resolve(periods || { periods: [], entries: [] }); } }
  };
  root.window = root; root.globalThis = root;
  const context = vm.createContext(root);
  (parts || PARTS).forEach((f) => vm.runInContext(typeof f === 'string' && f.startsWith('public/') ? read(f) : f.src, context, { filename: f.name || f }));
  const host = { innerHTML: '', querySelectorAll: () => [], isConnected: true };
  const handle = root.CBBooksGrantView.mount(host, { onRead() { root.__onRead = (root.__onRead || 0) + 1; }, member: { id: 's1', name: 'Acme Pty', role }, view, call: () => Promise.resolve({}), mountList() {}, stores: [] });
  return { assigned, replaced, reads, root, handle, host };
}
(async () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
  const landed = async (...args) => { const r = open(...args); await settle(); return r; };
  await ok('LANDING: a fresh open goes straight to the owner Day book, auditor and adviser; view=dues rides back so Back never bounces', async () => {
    assert.deepStrictEqual((await landed('auditor', '', '')).assigned, ['/accounts.html?acting=s1&role=auditor&view=dues#/daybook']);
    assert.deepStrictEqual((await landed('adviser', '', '')).assigned, ['/accounts.html?acting=s1&role=adviser&view=dues#/daybook']);
  });
  await ok('LANDING PERIOD: ONE GET /periods read first, so the door carries the year under review (fy and its own dates), not the current year', async () => {
    const r = await landed('auditor', '', '', undefined, { under_review: { fy: '2024-25', from: '2024-07-01', to: '2025-06-30' }, years: [{ fy: '2024-25', from: '2024-07-01', to: '2025-06-30', entries: 5 }] });
    assert.deepStrictEqual(r.reads, ['readPeriods']);
    assert.strictEqual(r.assigned[0], '/accounts.html?acting=s1&role=auditor&view=dues&fy=2024-25&from=2024-07-01&to=2025-06-30#/daybook');
  });
  await ok('the seat the person chose is remembered (onRead) once the periods read answered, because no Day book read of this view says so any more; a failed read does not', async () => {
    const good = await landed('auditor', '', '', undefined, { under_review: { fy: '2024-25', from: '2024-07-01', to: '2025-06-30' }, years: [{ fy: '2024-25', from: '2024-07-01', to: '2025-06-30', entries: 5 }] });
    assert.strictEqual(good.root.__onRead, 1);
    const bad = await landed('auditor', '', '', undefined, 'fail'); assert.ok(!bad.root.__onRead);
  });
  await ok('a failed periods read still opens the door (no period carried)', async () => {
    const r = await landed('auditor', '', '', undefined, 'fail');
    assert.deepStrictEqual(r.assigned, ['/accounts.html?acting=s1&role=auditor&view=dues#/daybook']);
  });
  await ok('BACK: the landing REPLACES the history entry (location.replace), a Months row pushes one (assign)', async () => {
    assert.strictEqual((await landed('auditor', '', '')).replaced.length, 1);
    const r = await landed('auditor', '', 'periods'); r.root.CBBooksGrantKit.openMonth('2026-07-01', '2026-07-31'); assert.strictEqual(r.replaced.length, 0);
  });
  await ok('an old address (view=daybook) is no known read: it lands on the door too; a return with view=dues opens no door and reads the dues', async () => {
    assert.strictEqual((await landed('auditor', '', 'daybook')).assigned.length, 1);
    assert.deepStrictEqual((await landed('auditor', '', 'dues')).assigned, []);
  });
  await ok('the bell words (mark, note, label) ride to the door once; a bad word never leaves', async () => {
    const r = await landed('auditor', '?open=s1&mark=e2&nl=J-2&note=e5', '');
    assert.ok(/&mark=e2/.test(r.assigned[0]) && /&note=e5/.test(r.assigned[0]) && /&nl=J-2/.test(r.assigned[0]), r.assigned[0]);
  });
  await ok('since=mine and the filter words (dbf_risk) ride to the door, so a Home link "N since I checked" still opens the changed list', async () => {
    const r = await landed('auditor', '?open=s1&view=daybook&since=mine&dbf_risk=any', '');
    assert.ok(/&since=mine/.test(r.assigned[0]) && /&dbf_risk=any/.test(r.assigned[0]), r.assigned[0]);
  });
  await ok('a Months row opens the door on THAT month (from and to), not the year', async () => {
    const r = await landed('auditor', '', 'periods');
    r.root.CBBooksGrantKit.openMonth('2026-07-01', '2026-07-31');
    assert.ok(/&from=2026-07-01&to=2026-07-31#\/daybook$/.test(r.assigned[0]) && !/fy=/.test(r.assigned[0]), r.assigned[0]);
  });
  await ok('the firm view reads dues, months and the tax return; the Day book is a tab that is a door', async () => {
    const r = await landed('auditor', '', 'dues');
    assert.strictEqual(r.root.CBBooksGrantKit.REPORTS.map((x) => x.k).join(), 'dues,periods,bas');
  });
  /* ---- the guard ---- */
  const dir = path.join(__dirname, '..', 'public/app');
  const VIEW = fs.readdirSync(dir).filter((f) => /^books-grant-(reports|cells|marks|list|view|member|words)\.js$|^books-practice.*\.js$|^network.*\.js$/.test(f));
  const BAN = [/\bk: 'daybook'/, /bookOrder/, /recordedText|recorded_text/, /risk_list|riskOf\b|riskWords/, /seen_to/, /since: 'mine'/, /DAYBOOK_PAGE|loadAllDaybook|paintPager/, /afterRange/, /CBBooksGrantFilters/, /CBMark\b|\.mk\.chip|queriesOnly/, /entry_no/];
  const offenders = (files) => { const out = []; Object.keys(files).forEach((f) => BAN.forEach((re) => { if (re.test(files[f])) out.push(f + ' ~ ' + re); })); return out; };
  const real = {}; VIEW.forEach((f) => { real[f] = read('public/app/' + f); });
  await ok('GUARD: no firm / network view file reads or paints a Day book of its own (' + VIEW.length + ' files, names and content)', () => assert.deepStrictEqual(offenders(real), []));
  const view = real['books-grant-view.js'], acting = read('public/app/books-acting.js'), cap = read('public/app/cap-books.js');
  await ok('GUARD: the door exists (button, phone line), the auditor may open tab daybook, and paint() ends its markup so wirePainted is its OWN statement', () => {
    assert.ok(/door: 'daybook', id: 'bv_daybook'/.test(view) && /_daybook: 'daybook'/.test(view) && /auditAddressOf\(/.test(view));
    assert.ok(/AUDITOR_TABS = \[[^\]]*'daybook'/.test(acting));
    assert.ok(/data-testid="bv-list"><\/div>';\n    wirePainted\(report\);/.test(view));
  });
  await ok('GUARD: the owner screen holds what the painter had: the tools, the flags for a firm seat, the bell words, no CSV for a read-only seat', () => {
    ['bkJetFilters', 'bkSinceOn', 'bkAskedOpen', 'bkFirmFlags', 'bkJetRange', 'bkDbSeed'].forEach((f) => assert.ok(new RegExp('function ' + f + '\\(').test(cap), f));
    assert.ok(/csv: bkReadOnlySeat\(\)/.test(cap));
  });
  const mutate = (file, fn) => Object.assign({}, real, { [file]: fn(real[file]) });
  await ok('MUTATION 1: re-adding the Day book report entry goes red', () => assert.ok(offenders(mutate('books-grant-reports.js', (s) => s.replace('  ];', "    { k: 'daybook', label: 'Day book' }\n  ];"))).length > 0));
  await ok('MUTATION 2: a renamed copy of the old book order or Risk cell goes red (content rule)', () => {
    assert.ok(offenders(Object.assign({}, real, { 'books-grant-ledger.js': 'x = bookOrder(a.entries)' })).length > 0);
    assert.ok(offenders(Object.assign({}, real, { 'books-grant-box.js': 'row.risk_list' })).length > 0);
  });
  await ok('MUTATION 3: the since read or the filters file back in a view file goes red', () => {
    assert.ok(offenders(mutate('books-grant-view.js', (s) => s + "\n var q = { since: 'mine' };")).length > 0);
    assert.ok(offenders(mutate('books-grant-list.js', (s) => s + '\n root.CBBooksGrantFilters.filtersFor()')).length > 0);
  });
  await ok('MUTATION 4: dropping the landing door (fresh open reads the view again) is caught', async () => {
    const src = real['books-grant-view.js'].replace("if (fresh) landOnDaybook();", 'if (false) landOnDaybook();');
    const r = open('auditor', '', '', PARTS.map((f) => f.endsWith('view.js') ? { src, name: f } : f)); await settle();
    assert.deepStrictEqual(r.assigned, []);
  });
  await ok('MUTATION 5: wirePainted joined to the markup (the bug #819 left) is caught by the statement-shape guard', () => {
    const broken = view.replace("></div>';\n    wirePainted(report);", "></div>' +\n    wirePainted(report);");
    assert.notStrictEqual(broken, view); assert.ok(!/data-testid="bv-list"><\/div>';\n    wirePainted\(report\);/.test(broken));
  });
  await ok('MUTATION 6: the auditor losing tab daybook is caught', () => assert.ok(!/AUDITOR_TABS = \[[^\]]*'daybook'/.test(acting.replace("'gstclose', 'daybook', ", "'gstclose', "))));
  console.log('\n' + n + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
