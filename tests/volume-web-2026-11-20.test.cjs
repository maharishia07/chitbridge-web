'use strict';
// @type: unit
/* tests/volume-web-2026-11-20.test.cjs — the sit-grund VOLUME run's web defects (docs/walks/VOLUME-2026-11-20.md).
 * HAND-COMPUTED  Day book: 307 rows, 100 loaded -> a search/CSV first reads every page ("Loading all…"); a cap or failed read is SAID in the file and on screen.
 *   A search matching nothing says "0 shown of 309". Two seats: A asks Checked, the server answers Query by Anna -> A's chip shows the Query and "Changed by Anna just now.".
 * OWNS the offline guard of list-ctl.js (loadAllThen, empty count), cap-books.js (bkDvPartialNote, BK_READ_WORDS), cap-mark.js (setMark), cap-period.js (Reopen year). CARD 12-ux-locale */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const APP = path.join(__dirname, '..', 'public', 'app');
const rd = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0;
const ok = async (n, f) => { await f(); pass++; console.log('  ok   ' + n); };
const slice = (src, from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, 'slice ' + from); return src.slice(a, b); };
(async () => {
  const lc = rd('list-ctl.js'), cb = rd('cap-books.js');
  await ok('list-ctl: an empty narrowing repaints the count ("0 shown of N")', () => {
    const step5 = slice(lc, 'function paintListStep5', 'function paintListStep6');
    assert.ok(/emptyCount\.textContent = countText\(inst, ctx\.m\)/.test(step5) && step5.indexOf('emptyCount') < step5.lastIndexOf('return true'));
    const T = (I, s, v) => s.replace('{n}', v && v.n);
    const countText = new Function('T', 'remote', 'val', slice(lc, '  function itemCount(rows)', '  /* ── ⚑ NEEDS YOU') + '; return countText;')(T, () => false, (x) => x);
    const all = Array.from({ length: 309 }, (_, i) => ({ id: i }));
    assert.strictEqual(countText({ o: {} }, { rows: [], all }), '0 shown of 309');
  });
  await ok('list-ctl: loadAll runs before a search is drawn and before the CSV; a complete list does not wait', async () => {
    const src = slice(lc, '  function loadAllThen', '  function setQ');
    const nodes = { t: '' };
    const fn = new Function('safe', 'remote', '$', 'T', src + '; return loadAllThen;')((f, d) => { try { return f(); } catch (_) { return d; } }, () => false, () => ({ set textContent(v) { nodes.t = v; } }), (I, s) => s);
    let drawn = 0, ran = 0, left = true;
    const I = { o: { loadAll: { incomplete: () => left, run: () => new Promise((r) => setTimeout(() => { ran++; left = false; r(); }, 5)) } } };
    assert.strictEqual(fn(I, () => drawn++), true);
    assert.strictEqual(nodes.t, 'Loading all…'); assert.strictEqual(drawn, 0);
    await new Promise((r) => setTimeout(r, 30));
    assert.deepStrictEqual([ran, drawn], [1, 1]);
    assert.strictEqual(fn(I, () => drawn++), false, 'everything held: no wait');
    assert.ok(/loadAllThen\(I, function \(\) \{ paintList\(I\); \}\)/.test(lc) && /loadAllThen\(I, function \(\) \{ download\(I\); \}\)/.test(lc));
  });
  await ok('Day book: the list declares loadAll, the CSV says when it is partial, never silently', () => {
    assert.ok(/loadAll: \{ incomplete: bkDvIncomplete, run: bkDvLoadAll \}/.test(cb));
    const src = slice(cb, 'var BK_ALL_PAGES', 'function bkDvLoadAll');
    const BK = { dv: { r: { entries: new Array(100), next: 'x', total: 307 } } };
    const f = new Function('BK', 'txf', src + '; return { bkDvIncomplete: bkDvIncomplete, bkDvPartialNote: bkDvPartialNote };')(BK, (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]));
    assert.strictEqual(f.bkDvIncomplete(), true);
    assert.ok(/only 100 of 307 entries/.test(f.bkDvPartialNote(BK.dv)));
    BK.dv.capped = true; assert.strictEqual(f.bkDvIncomplete(), false, 'a cap stops the reading');
    assert.ok(f.bkDvPartialNote(BK.dv), 'but the note stays');
    BK.dv.r.next = null; assert.strictEqual(f.bkDvPartialNote(BK.dv), '', 'whole range held: no note');
    const dl = slice(cb, 'function bkDvDownload', '/** what the search looks in');
    assert.ok(/bkDvPartialNote\(d\)/.test(dl) && /toast\(note\)/.test(dl));
  });
  await ok('one sentence of who may read a gated books screen', () => {
    assert.ok(cb.includes("Only the owner, the shop's accountant or bookkeeper, or the shop's auditor may read these figures."));
    assert.ok(!cb.includes("Only the owner or the shop's auditor may read these figures"));
  });
  await ok("mark: a save answered with the other seat's Query shows the Query and who changed it; a 409 re-reads", async () => {
    const root = { tx: (s) => s, document: { querySelectorAll: () => [], createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }), head: { appendChild() {} }, body: {}, documentElement: {}, addEventListener() {} }, Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, Intl, setTimeout };
    root.window = root; root.globalThis = root; const ctx = vm.createContext(root);
    ['cap-mark-sheet.js', 'cap-mark.js'].forEach((f) => vm.runInContext(rd(f), ctx, { filename: f }));
    const sent = [];
    let mode = 'query';
    const anna = { marks: [{ subject_id: 'e1', kind: 'query', class: 'open', by_name: 'Anna' }], actions: { set: { ok: true } } };
    const call = (key) => {
      sent.push(key);
      if (key === 'marksSet' && mode === 'conflict') { const e = new Error('changed'); e.status = 409; return Promise.reject(e); }
      return Promise.resolve(anna);
    };
    const ctl = root.CBMark.use({ adopter: 'acc.audit', call });
    ctl.ingest([{ entry_id: 'e1', entry_no: 'JV-1' }], { mark_actions: { set: { ok: true } } });
    let said = '';
    root.toast = (t) => { said = t; };
    await ctl.set('e1', 'clear', '', null);
    assert.strictEqual(ctl.row('e1').class, 'open', "the screen shows the server's Query, not Checked");
    assert.strictEqual(said, 'Changed by Anna just now.');
    mode = 'conflict'; said = ''; sent.length = 0;
    await ctl.set('e1', 'clear', '', null).then(() => assert.fail('must reject'), (e) => assert.strictEqual(e.status, 409));
    assert.ok(sent.includes('marksRead'), 'a 409 re-reads the mark'); assert.strictEqual(said, 'Changed by Anna just now.');
  });
  await ok('year: the close words tell the truth; Reopen year is owner-only with a reason dialog; month reopen on a hard-locked month', () => {
    const cp = rd('cap-period.js');
    assert.ok(!/cannot be undone/.test(cp) && /You can reopen only this latest year later, with a reason; it is logged\./.test(cp));
    const acts = slice(cp, 'function peYearActionsHtml', 'async function peYearStatus');
    assert.ok(/yearState\.closed && peOwner\(\)/.test(acts) && /data-testid="py-reopen"/.test(acts) && /BKS016-B12/.test(acts));
    assert.ok(cp.includes("perYearReopen: { m: 'POST', p: '/api/books/year/:fy/reopen' }") && cp.includes('bkReasonDialog('));
    assert.ok(rd('cap-books-lock.js').includes("state === 'hard_locked'") && cb.includes("booksReopenMonth: { m: 'POST', p: '/api/books/periods/:fy/:p/reopen' }"));
    assert.ok(/if \(!reason\)/.test(slice(rd('cap-books-lock.js'), 'function bkReasonGo', 'async function bkLockDo')), 'the reason is required');
  });
  console.log('\n' + pass + ' passed');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
