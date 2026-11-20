'use strict';
// @type: unit
/* tests/webreds-2026-11-20.test.cjs — FULLPROOF-B web items (docs/walks/FULLPROOF-B-2026-11-20.md, sections A and C).
 * HAND-COMPUTED  Two seats: A's save answered Checked, then B's Query landed. A's screen re-reads on focus and every 20 s while the sheet is open: Checked -> Query + "Changed by Anna just now.".
 *   Months 1..8 of FY all hard_locked -> Reopen month on month 8 only. Years 2024, 2025 closed (12 hard months each) -> Reopen year on 2025 only.
 *   Firm ledger drill: a line of entry e1 with evidence shows the same chip column as the Day book.
 * OWNS checks on cap-mark.js (reread/watch), cap-books.js (bkLastHardKey), cap-books-lock.js (the lock buttons, bkLastClosedYear), cap-period.js (peYearActionsHtml), books-grant-drill.js (evidence column). CARD 12-ux-locale */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const APP = path.join(__dirname, '..', 'public', 'app');
const rd = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const slice = (src, from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, 'slice ' + from); return src.slice(a, b); };
let pass = 0;
const ok = async (n, f) => { await f(); pass++; console.log('  ok   ' + n); };
(async () => {
  await ok('mark: focus and the 20 s timer re-read the mark and say who changed it', async () => {
    const listeners = {}, timers = [];
    const doc = { hidden: false, querySelectorAll: () => [], createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }), head: { appendChild() {} }, body: {}, documentElement: {}, addEventListener: (n, f) => { listeners['doc:' + n] = f; } };
    const root = { tx: (s) => s, document: doc, addEventListener: (n, f) => { listeners[n] = f; }, setInterval: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearInterval: (id) => { timers[id - 1] = null; } };
    root.window = root; root.globalThis = root; const ctx = vm.createContext(root);
    ['cap-mark-sheet.js', 'cap-mark.js'].forEach((f) => vm.runInContext(rd(f), ctx, { filename: f }));
    let server = { marks: [{ subject_id: 'e1', kind: 'clear', class: 'clear', by_name: 'Me' }], actions: { set: { ok: true } } };
    const reads = [];
    const ctl = root.CBMark.use({ adopter: 'acc.audit', call: (key) => { reads.push(key); return Promise.resolve(server); } });
    await ctl.load(['e1']);
    assert.strictEqual(ctl.row('e1').class, 'clear');
    let said = ''; root.toast = (t) => { said = t; };
    server = { marks: [{ subject_id: 'e1', kind: 'query', class: 'open', by_name: 'Anna' }], actions: { set: { ok: true } } };
    const stop = ctl.watch('e1');
    assert.strictEqual(timers[0].ms, 20000, 'the timer is 20 s');
    doc.hidden = true; reads.length = 0; timers[0].f(); assert.strictEqual(reads.length, 0, 'a hidden tab is not read');
    doc.hidden = false; timers[0].f();
    await new Promise((r) => setTimeout(r, 5));
    assert.strictEqual(ctl.row('e1').class, 'open'); assert.strictEqual(said, 'Changed by Anna just now.');
    stop(); assert.strictEqual(timers[0], null, 'closing the sheet stops the timer');
    assert.ok(typeof listeners.focus === 'function' && typeof listeners['doc:visibilitychange'] === 'function', 'focus and visibility are watched');
    assert.ok(/ctl\.watch|control\.watch/.test(rd('cap-mark-sheet.js')), 'the sheet starts the watch');
    const same = await ctl.reread(['e1']); assert.strictEqual(same.length, 0, 'no change, no message');
  });
  await ok('months: Reopen month only on the last hard-locked month; Reopen year only on the newest closed year', () => {
    const cb = rd('cap-books.js'), lk = rd('cap-books-lock.js'), cp = rd('cap-period.js');
    const BK = { lk: { fy: '2026', rows: {}, years: ['2026', '2025', '2024'] } };
    for (let m = 1; m <= 8; m++) BK.lk.rows['2026|' + m] = 'hard_locked';
    for (const y of ['2025', '2024']) for (let m = 1; m <= 12; m++) BK.lk.rows[y + '|' + m] = 'hard_locked';
    const fns = new Function('BK', slice(cb, 'function bkLastHardKey', '/* a select of the financial years') + '; return { bkLastHardKey, bkLastClosedYear };')(BK);
    assert.strictEqual(fns.bkLastHardKey(), '2026|8');
    assert.strictEqual(fns.bkLastClosedYear(), '2025', 'newest year with 12 hard months');
    const btn = new Function('esc', 'tx', 'bkMountAttribute', slice(lk, 'function bkLockOpenButton', '/** who locked or opened') + '; return bkLockButtonsHTML;')((s) => s, (s) => s, () => '');
    const shown = [];
    for (let m = 1; m <= 8; m++) shown.push(btn(true, 'hard_locked', m, { lastHard: m === 8 }).includes('lk-reopen-month-' + m));
    assert.deepStrictEqual(shown, [false, false, false, false, false, false, false, true]);
    assert.ok(/rule\.lastHard = bkLastHardKey\(\) === lock\.fy/.test(lk), 'the row asks the periods list');
    const acts = new Function('peOwner', 'peVal', 'esc', 'tx', 'bkLastClosedYear', 'peNote', 'peYearLodgedTick', slice(cp, 'function peYearActionsHtml', 'async function peYearStatus') + '; return peYearActionsHtml;');
    const mk = (fy) => acts(() => true, () => fy, (s) => s, (s) => s, fns.bkLastClosedYear, () => '', () => '');
    assert.ok(mk('2025')({ closed: true }).includes('py-reopen'));
    assert.ok(!mk('2024')({ closed: true }).includes('py-reopen'), 'an older closed year has no Reopen');
  });
  await ok('firm ledger drill: the evidence chip column, read only, before the mark', () => {
    const dr = rd('books-grant-drill.js');
    assert.ok(/ctx\.ev\.ingest\(book\.entries\)/.test(dr), 'the entries feed the evidence control');
    assert.ok(/\['evidence', 'Evidence', 'ev'\]/.test(dr) && /ctx\.ev\.chip\(state\.entries\[row\.entry_id\]\)/.test(dr));
    assert.ok(!/ev\.(set|attach|remove)/.test(dr), 'no write from the drill');
  });
  console.log('\n' + pass + ' passed');
})().catch((e) => { console.error('FAIL', e.stack); process.exit(1); });
