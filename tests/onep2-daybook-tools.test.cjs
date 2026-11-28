/* tests/onep2-daybook-tools.test.cjs — ONEP-2 PR 7a (PM/ONEP-2-PLAN-2026-11-28.md rows 4 and 7): the auditor's Day book tools are ONE module the OWNER's Day book mounts, behind the seat.
 * The owner's screen (cap-books.js bkDaybook) is read by the owner, the adviser and the auditor; only a firm seat (auditor, adviser) whose server says marking is on gets the marks bar, "since I last looked", the JET filters, the Risk column and the c / q keys.
 * HAND FIXTURE (AU shop, period 2026-07-01 – 2026-07-31, six entries, amounts = the debits; shop zone = UTC here; weekend = Sat + Sun):
 *   E1 posted 07-10 recorded Fri 07-10 10:00, 15,000  -> 0 risks            marked CLEAR (checked)
 *   E2 posted 07-11 recorded Sun 08-02 10:00, 20,000, no narration -> after period end, over 7 days late (22), weekend, round sum, no narration = 5 risks   marked QUERY (open)
 *   E3 posted 07-14 recorded Tue 07-14 21:30, 12,345 -> after hours = 1
 *   E4 posted 07-01 recorded Thu 07-09 10:00, 5,000 -> 8 days late = 1
 *   E5 posted 07-20 recorded Mon 07-20 06:59, 10,000 -> after hours + round sum = 2
 *   E6 posted 07-22 recorded Wed 07-22 07:00, 7,777 -> 0 risks   (the one entry posted since the person last looked)
 *   Risk counts 0,5,1,1,2,0 · Any risk = E2 E3 E4 E5 · Round = E2 E5 · Recorded after period end = E2 · over 7 days = E2 E4 · Checked = E1 · Not checked = E2..E6 · Queried = E2.
 * The server's answers are carried; nothing is added up here. Owner, adviser, auditor make the SAME booksDaybook call and hold the SAME six rows.
 * GUARD (the enforcer): bkAudit is the one seat test; the acting guard lets a firm seat call /api/marks (exactly that path) and nothing else new; Mark as checked stays on the grant call, never api(). Mutations go red.
 * CARD 14-accounting/day-book */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok   ' + name); });
const cap = read('public/app/cap-books.js');
const grab = (src, name) => { const m = new RegExp(String.raw`(?:async )?function ${name}\([^)]*\) \{[\s\S]*?\n\}\n`).exec(src); assert.ok(m, name + ' not found'); return m[0]; };
const FN = (src) => ['bkAudit', 'bkSinceOn', 'bkDbSeed', 'bkJetRange', 'bkJetPeriod', 'bkJetChosen', 'bkJetPreset', 'bkJetRow', 'bkJetRisk', 'bkJetFilters', 'bkDvTotal', 'bkDvOpenDay', 'bkDvAppend', 'bkDaybook', 'bkDvReadQuery', 'bkPlWindow', 'bkDbPeriod'].map((f) => grab(src, f)).join('') + (src.match(/var BK_JET_KEYS = [^\n]*\n/) || [''])[0] + (src.match(/var BK_PAGE = 100;\n/) || [''])[0];
const E = (id, no, posting, recorded, dr, extra) => Object.assign({ entry_id: id, entry_no: no, posting_date: posting, recorded_at: recorded, lines: [{ dr_minor: dr }] }, extra || {});
const ENTRIES = [
  E('e1', 'J-1', '2026-07-10', '2026-07-10T10:00:00Z', 15000),
  E('e2', 'J-2', '2026-07-11', '2026-08-02T10:00:00Z', 20000, { no_narration: true }),
  E('e3', 'J-3', '2026-07-14', '2026-07-14T21:30:00Z', 12345),
  E('e4', 'J-4', '2026-07-01', '2026-07-09T10:00:00Z', 5000),
  E('e5', 'J-5', '2026-07-20', '2026-07-20T06:59:00Z', 10000),
  E('e6', 'J-6', '2026-07-22', '2026-07-22T07:00:00Z', 7777)
];
const MARKS = { e1: { state: 'clear', altered: false }, e2: { state: 'open', altered: false } };
const mkFake = (may) => ({ state: () => ({ may }), markOf: (id) => MARKS[id] || { state: 'none', altered: false }, row: (id) => MARKS[id] ? { class: MARKS[id].state } : null });
function world(seat, search, replyOver) {
  const calls = [], body = { innerHTML: '' };
  const root = {
    BK: { mk: mkFake({ set: { ok: true } }) }, URLSearchParams, JSON, Date, Number, Promise, isNaN, Object, Array, String, Math,
    location: { search, pathname: '/accounts.html', hash: '' }, history: {},
    tx: (s) => s, esc: String, shopDay: (d) => 'D' + String(d).slice(0, 10), setTimeout,
    document: { getElementById: () => null, addEventListener() {}, removeEventListener() {} },
    CBShopTime: { parts: (iso) => { const d = new Date(iso); return { day: iso.slice(0, 10), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()], hour: d.getUTCHours() }; } },
    CBMoney: { decimals: () => 2 }, CBLocale: { weekInfo: () => null }, dayBookKind: () => 'Sale',
    bkRange: () => ({ from: '2026-07-01', to: '2026-07-31' }), bkToday: () => '2026-11-28', bkFyFrom: () => '2025-07-01',
    bkChequesLoad: async () => [], bkHealthLoad: async () => ({}), bkTodoCounts: () => ({}), bkDuesStore() {}, bkQuiet() {}, bkErr: (e) => 'ERR ' + e, bkMarksIngest() {}, bkEvidenceIngest() {}, bkFlagsIngest() {},
    bkDvMount: () => ({ refresh() {}, destroy() {} }), bkPagerPaint() {}, bkDvCountsHook() {}, bkDvLoadAll() { return Promise.resolve(); }, bkDvDraw() {}, bkAuditPaint() {}, bkJetWatch() {}, bkTab() {}, bkDvOlder() {}
  };
  vm.createContext(root);
  vm.runInContext(['books-grant-api.js', 'books-acting.js', 'books-grant-filters.js', 'books-audit-tools.js'].map((f) => read('public/app/' + f)).join('\n'), root);
  if (seat) root.CBBooksActing.enter({ id: 's1', name: 'Acme Pty' }, seat);
  root.api = async (name, o) => { calls.push([name, JSON.stringify((o && o.query) || null), seat && seat !== 'owner' ? 'X-Books-For' : '-']); return Object.assign({ currency: 'AUD', country: 'AU', entries: ENTRIES, total: 6, count: 6, next: null, mark_actions: { set: { ok: true } } }, replyOver || {}); };
  vm.runInContext(FN(cap) + '\n;globalThis.__go = bkDaybook; globalThis.__bkAudit = bkAudit; globalThis.__jet = bkJetFilters; globalThis.__risk = bkJetRisk;', root);
  return { root, calls, body };
}
const DAY = 'booksDaybook{"limit":100,"order":"desc","from":"2026-07-01","to":"2026-07-31"}';
const call = (w) => w.calls.filter((c) => c[0] === 'booksDaybook').map((c) => c[0] + c[1]);
const keysOf = (w) => Array.from(w.root.__jet().map((f) => f.key));
const ids = (w, key, v) => ENTRIES.filter((e) => w.root.__jet().filter((f) => f.key === key)[0].match(e, v)).map((e) => e.entry_id).join();
(async () => {
  await ok('owner, adviser, auditor make the SAME booksDaybook call and hold the SAME six rows (desc, page 100)', async () => {
    const ws = [world(null, ''), world('adviser', ''), world('auditor', '')];
    for (const w of ws) { await w.root.__go(w.body); assert.deepStrictEqual(call(w), [DAY]); assert.strictEqual(w.root.BK.dv.r.entries.length, 6); assert.strictEqual(w.root.BK.dv.since, false); }
    assert.deepStrictEqual(ws[1].root.BK.dv.r.entries, ws[0].root.BK.dv.r.entries); assert.deepStrictEqual(ws[2].root.BK.dv.r.entries, ws[0].root.BK.dv.r.entries);
  });
  await ok('the seat test: the auditor and the adviser get the tools, the owner and a seat with no firm grant do not (even when the server says marking is on)', async () => {
    assert.strictEqual(world('auditor', '').root.__bkAudit(), true); assert.strictEqual(world('adviser', '').root.__bkAudit(), true);
    assert.strictEqual(world(null, '').root.__bkAudit(), false); assert.strictEqual(world('owner', '').root.__bkAudit(), false);
    const off = world('auditor', ''); off.root.BK.mk = mkFake(null); assert.strictEqual(off.root.__bkAudit(), false);
  });
  await ok('the JET filters on the owner list: Mark · Risk · Recorded · Made · Round sum · Narration · Year end · Made by (the owner keeps its own Kind · Person · Evidence · Saved)', async () => {
    const w = world('auditor', ''); await w.root.__go(w.body);
    assert.deepStrictEqual(keysOf(w).sort(), ['by', 'mark', 'narr', 'rec', 'risk', 'round', 'time', 'ye'].map((k) => k === 'by' ? 'madeby' : k).sort());
  });
  await ok('HAND: Risk counts 0,5,1,1,2,0 and each filter keeps exactly its entries (amount = the debits)', async () => {
    const w = world('auditor', ''); await w.root.__go(w.body);
    assert.deepStrictEqual(ENTRIES.map((e) => w.root.__risk(e).length), [0, 5, 1, 1, 2, 0]);
    assert.strictEqual(ids(w, 'risk', 'any'), 'e2,e3,e4,e5');
    assert.strictEqual(ids(w, 'round', '100'), 'e2,e5');
    assert.strictEqual(ids(w, 'rec', 'afterend'), 'e2');
    assert.strictEqual(ids(w, 'rec', 'late7'), 'e2,e4');
    assert.strictEqual(ids(w, 'time', 'night'), 'e3,e5');
    assert.strictEqual(ids(w, 'time', 'weekend'), 'e2');
    assert.strictEqual(ids(w, 'narr', 'none'), 'e2');
    assert.strictEqual(ids(w, 'mark', 'checked'), 'e1'); assert.strictEqual(ids(w, 'mark', 'notchecked'), 'e2,e3,e4,e5,e6'); assert.strictEqual(ids(w, 'mark', 'query'), 'e2');
  });
  await ok('boundaries: 19:59 is not after hours, 20:00 is; exactly 7 days is not late, 8 is', async () => {
    const w = world('auditor', ''); await w.root.__go(w.body);
    const t = (rec, posting) => w.root.__risk(E('x', 'X', posting, rec, 123)).join('|');
    assert.ok(!/After hours/.test(t('2026-07-14T19:59:00Z', '2026-07-14')) && /After hours/.test(t('2026-07-14T20:00:00Z', '2026-07-14')));
    assert.ok(!/Over 7 days/.test(t('2026-07-15T10:00:00Z', '2026-07-08')) && /Over 7 days/.test(t('2026-07-16T10:00:00Z', '2026-07-08')));
  });
  await ok('since: ONE call {since: mine, limit: 500}, no range, no paging; the watermark is carried; Mark as checked is the grant call', async () => {
    const w = world('auditor', '?since=mine', { entries: [ENTRIES[5]], total: 1, count: 1, seen_to: '2026-07-22T07:00:00Z', since: { at: '2026-07-01T00:00:00Z' } });
    await w.root.__go(w.body);
    assert.deepStrictEqual(call(w), ['booksDaybook{"since":"mine","limit":500}']);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(w.root.BK.dv.seen)), { to: '2026-07-22T07:00:00Z', total: 1, since: { at: '2026-07-01T00:00:00Z' } });
    assert.strictEqual(w.root.BK.dv.since, true);
    assert.ok(/CBBooksAuditTools\.markChecked\(\{[^}]*call: bkFlagCall/.test(cap) && /'practiceBaseline'/.test(read('public/app/books-audit-tools.js')) && !/api\('practiceBaseline'/.test(cap));
    const owner = world(null, '?since=mine'); await owner.root.__go(owner.body);
    assert.deepStrictEqual(call(owner), [DAY]); /* an owner asking for since gets the normal read */
  });
  await ok('JET judges the default window against the financial year END, not today: an entry recorded after 2026-06-30 trips After period end on the default page (FY 2025-07-01 to 2026-06-30)', async () => {
    const w = world('auditor', ''); w.root.bkRange = () => ({ from: '2025-07-01', to: '2026-11-28' }); await w.root.__go(w.body);
    assert.strictEqual(w.root.BK.dv.period.to, '2026-06-30');
    assert.ok(/After period end/.test(w.root.__risk(E('x', 'X', '2026-06-20', '2026-07-02T10:00:00Z', 123)).join('|')));
  });
  await ok('JET: the FIRST MONTH of the year (window 2025-07-01 to 2025-07-31) is judged as itself: a recording on 2025-08-05 is After period end; a whole-year window is not cut', async () => {
    const w = world('auditor', ''); w.root.bkRange = () => ({ from: '2025-07-01', to: '2025-07-31' }); await w.root.__go(w.body);
    assert.strictEqual(w.root.BK.dv.period.to, '2025-07-31');
    assert.ok(/After period end/.test(w.root.__risk(E('x', 'X', '2025-07-20', '2025-08-05T10:00:00Z', 123)).join('|')));
    const y = world('auditor', ''); y.root.bkRange = () => ({ from: '2025-07-01', to: '2026-06-30' }); await y.root.__go(y.body); assert.strictEqual(y.root.BK.dv.period.to, '2026-06-30');
  });
  await ok('the door carries the window: from= and to= seed the Day book once; a bad pair is no pick', async () => {
    const w = world('auditor', '?from=2026-07-01&to=2026-07-31'); await w.root.__go(w.body);
    assert.strictEqual(w.root.BK.dbp.preset, 'custom'); assert.strictEqual(w.root.BK.dbp.to, '2026-07-31');
    const bad = world('auditor', '?from=2026-08-01&to=2026-07-01'); await bad.root.__go(bad.body); assert.ok(!bad.root.BK.dbp);
  });
  await ok('Year end Dated after it reads the days AFTER the period (one year on), only in a firm seat; the owner ignores the word', async () => {
    const w = world('auditor', '?dbf_ye=dated'); await w.root.__go(w.body);
    assert.ok(call(w)[0].includes('"from":"2026-08-01","to":"2027-08-01"'), call(w)[0]);
    const o = world(null, '?dbf_ye=dated'); await o.root.__go(o.body); assert.deepStrictEqual(call(o), [DAY]);
  });
  await ok('the address word dbf_by is the Made by filter; it becomes the preset on the owner list', async () => {
    const w = world('auditor', '?dbf_risk=any&dbf_by=Pat'); await w.root.__go(w.body);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(w.root.bkJetPreset ? w.root.bkJetPreset() : vm.runInContext('bkJetPreset()', w.root))), { filt: { risk: 'any', madeby: 'Pat' } });
  });
  /* ---- the acting guard: ONE allowance, exactly /api/marks, firm seats only ---- */
  const guardOf = (role) => { const w = world(role, ''); return (p, m) => { try { w.root.CBBooksActing.guard({ p, m }); return true; } catch (e) { return false; } }; };
  await ok('GUARD: auditor and adviser may call /api/marks (GET and POST); every other /api path is still refused; owner and no seat unchanged', () => {
    for (const role of ['auditor', 'adviser']) { const g = guardOf(role); assert.ok(g('/api/marks', 'GET') && g('/api/marks', 'POST') && g('/api/books/daybook', 'GET')); assert.ok(g('/api/marks/:id/messages', 'GET') && g('/api/marks/:id/messages', 'POST')); assert.ok(!g('/api/marks/:id/messages/x', 'POST') && !g('/api/marks/:id', 'GET') && !g('/api/marks/x/messages', 'GET') && !g('/api/chits', 'GET')); }
    const own = guardOf('owner'); assert.ok(own('/api/marks', 'POST') && own('/api/chits', 'GET'));
    assert.ok(guardOf(null)('/api/marks', 'POST'));
  });
  /* ---- the guard on the source ---- */
  const tools = read('public/app/books-audit-tools.js'), acting = read('public/app/books-acting.js');
  await ok('GUARD: the one seat test is firmSeat (auditor | adviser) and every tool mounts behind bkAudit / bkSinceOn', () => {
    assert.ok(/seat\.role === 'auditor' \|\| seat\.role === 'adviser'/.test(tools));
    assert.ok(/CBBooksAuditTools\.seatOn\(BK\.mk\)/.test(cap) && /CBBooksAuditTools\.firmSeat\(\)/.test(cap));
    assert.ok(/if \(bkAudit\(\)\) bkJetFilters\(\)/.test(cap) && /if \(bkAudit\(\)\) \{\n    cols\.splice/.test(cap) && /bkJetPreset\(\) : null/.test(cap));
  });
  await ok('GUARD: no firm-view file keeps its own copy of the since bar, Mark as checked, the Risk cell or the row keys (moved to books-audit-tools.js)', () => {
    const view = ['books-grant-marks.js', 'books-grant-cells.js', 'books-grant-list.js', 'books-grant-view.js'].map((f) => read('public/app/' + f)).join('\n');
    [/function sinceLine/, /function sinceAction/, /function sinceFrom/, /function riskCount/, /function isRowKey/, /function keyedRow/, /words('entries posted since')/, /Mark as checked waits/, /bv-risk"/].forEach((re) => assert.ok(!re.test(view), String(re)));
  });
  await ok('GUARD: read-only seat has no CSV; the Posted column shows only in the since view', () => {
    assert.ok(/csv: bkReadOnlySeat\(\)\n      \? false/.test(cap)); assert.ok(/if \(BK\.dv && BK\.dv\.since\) cols\.splice\(cols\.length - 1, 0, \{ key: 'posted'/.test(cap));
  });
  /* ---- mutations ---- */
  await ok('MUTATION 1: drop the seat gate (bkAudit always true) -> the owner gets the tools -> red', async () => {
    const mutated = cap.replace('CBBooksAuditTools.seatOn(BK.mk);', 'true;');
    const w = world(null, ''); vm.runInContext(FN(mutated) + ';globalThis.__bkAudit = bkAudit;', w.root); assert.strictEqual(w.root.__bkAudit(), true);
    assert.strictEqual(world(null, '').root.__bkAudit(), false);
  });
  await ok('MUTATION 2: widen the marks allowance to every role -> the owner-less seat check goes red; widen to every /api/marks* path -> red', () => {
    const wide = acting.replace("if (MARKS_PATHS.indexOf(path) >= 0) return context.role === 'auditor' || context.role === 'adviser';", "if (MARKS_PATHS.indexOf(path) >= 0) return true;");
    assert.notStrictEqual(wide, acting); assert.ok(!/context\.role === 'auditor' \|\| context\.role === 'adviser'; \/\*/.test(wide));
    const prefix = acting.replace('MARKS_PATHS.indexOf(path) >= 0', 'path.indexOf("/api/marks") === 0'); assert.notStrictEqual(prefix, acting);
    assert.ok(/MARKS_PATHS\.indexOf\(path\) >= 0\) return context\.role === 'auditor' \|\| context\.role === 'adviser'/.test(acting) && /MARKS_PATHS = \['\/api\/marks', '\/api\/marks\/:id\/messages'\]/.test(acting));
  });
  await ok('MUTATION 3: Mark as checked through api() -> red', () => assert.ok(/api\('practiceBaseline'/.test(cap.replace('call: bkFlagCall', "x: api('practiceBaseline')"))));
  await ok('MUTATION 4: a tool drawn for a seat with no firm grant (firmSeat dropped) -> red', async () => {
    const w = world('owner', ''); vm.runInContext(tools.replace("return !!seat && (seat.role === 'auditor' || seat.role === 'adviser');", 'return !!seat;'), w.root); assert.strictEqual(w.root.CBBooksAuditTools.seatOn(mkFake({ set: true })), true);
    assert.strictEqual(world('owner', '').root.CBBooksAuditTools.seatOn(mkFake({ set: true })), false);
  });
  console.log('\n' + n + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
