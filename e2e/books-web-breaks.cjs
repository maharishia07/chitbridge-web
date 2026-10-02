/* books-web-breaks.cjs — break each Ledger guard once, run e2e/books-web.cjs against a COPY of public/, throw the copy away.
 * Nothing in the working tree is ever edited (never git checkout to restore). A CRLF checkout matches the same anchors:
 * the copy is read as LF text and written back in the file's own line endings (the way chit-sheet-breaks.cjs does it). */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const W = path.join(__dirname, '..');
const CAP = 'public/app/cap-books.js', APP = 'public/app.html', ADMIN = 'public/app/cap-admin.js';
const BREAKS = [
  ['switch sends nothing', ADMIN, `if (on) await api('booksEnable', { body: {} });`, `if (on) {}`],
  ['switch shown to an actor', ADMIN, `(SESSION.role === 'entity'`, `(true`],
  ['door gate', APP, `if (it[0] === 'ledger' && SESSION.booksOn !== true) return false; `, ''],
  ['duplicate warning', CAP, `box.textContent = hit ? txf(`, `box.textContent = false ? txf(`],
  ['disputed refusal', CAP, ` || (x.disputed && x.amount_minor > 0);`, `;`],
  ['over-open refusal', CAP, ` || x.amount_minor > x.open_minor || (x.disputed`, ` || (x.disputed`],
  ['unlock needs reason', CAP, `if (what !== 'lock' && !why.trim()) {`, `if (false) {`],
  ['opening one-amount', CAP, `|| (dr && cr) || (!dr && !cr)`, `|| (!dr && !cr)`],
  ['tb balanced chip', CAP, `var ok = Number(r.total_dr_minor) === Number(r.total_cr_minor);`, `var ok = true;`],
  ['locked-month message', CAP, `} catch (e) { if (why) why.textContent = bkWhy(e, tx('Could not record it')); }`, `} catch (e) { }`],
  ['statement closing', CAP, `esc(bkMoney(r && r.closing_minor, c))`, `esc(bkMoney(r && r.opening_minor, c))`],
  /* ── the 2026-09-30 fix pass (review M10 · M11 · M12 · F11): every new guard, broken once ── */
  ['M11 payment recorded twice', CAP, `      if (!PAY.id) {`, `      if (true) {`],
  ['M11 payment has no client_ref', CAP, `          client_ref: PAY.ref };`, `          };`],
  ['M11 button live while the call is out', CAP, `  if (btn) btn.disabled = true;`, ``],
  ['M11 one ref for every form', CAP, `name: r.nickname || r.display_name || '', ref: bkRef() };`, `name: r.nickname || r.display_name || '', ref: 'web-0-0' };`],
  ['M11 opening has no client_ref', CAP, `{ rows: rows, client_ref: BK.openingRef }`, `{ rows: rows }`],
  ['M11 opening can be pressed twice', CAP, `var box = document.getElementById('op_csv'); if (box) box.value = '';`, ``],
  ['M11 opening ref never renewed', CAP, `      BK.openingRef = bkRef();`, ``],
  ['M10 download is not the file', CAP, `fetch(base + EP.booksPackFile.p.replace(`, `fetch(base + EP.booksPackGet.p.replace(`],
  ['M10 We have it never asks', CAP, `      if (!(BK.packGot && BK.packGot[id])) {`, `      if (false) {`],
  ['M10 download not remembered', CAP, `BK.packGot = BK.packGot || {}; BK.packGot[id] = true;`, ``],
  ['M10 no-file pack still offers buttons', CAP, `        : has === false ? '<span data-testid="pack-nofile-'`, `        : false ? '<span data-testid="pack-nofile-'`],
  ['M10 ack without asking for the file', CAP, `if (bkPackHasFile(BK.packRows && BK.packRows[id], r) !== true) { bkPackNoFile(id); return; }`, ``],
  ['M12 cheque step not sent', CAP, `body: { status: to } });`, `body: {} });`],
  ['M12 cheque steps not offered', CAP, `    + (next.length ? ' <span class="supacts"`, `    + (false ? ' <span class="supacts"`],
  ['M12 bounce does not ask', CAP, `  if (to === 'bounced') {`, `  if (false) {`],
  ['M12 server cheques not listed', CAP, `  ((r && r.cheques) || []).forEach(bkChequeKeep);`, ``],
  ['M12 refused step swallowed', CAP, `    } catch (e) { say(bkWhy(e, tx('Could not change it'))); }`, `    } catch (e) { c.status = to; }`],
  ['M12 waiting reason not shown', CAP, `esc(w.reason || w.why || tx('No reason given'))`, `esc(tx('No reason given'))`],
  ['M12 retry not sent', CAP, `      await api('booksRetry', { body: {} });`, ``],
  ['M12 waiting count not shown', CAP, `el.textContent = '🕗 ' + tx('Waiting') + (n ? ' · ' + n : '');`, ``],
  ['F11 payable buckets have no column', CAP, `var cols = side === 'pay' ? BK_BUCKETS_PAY : BK_BUCKETS,`, `var cols = BK_BUCKETS,`],
  /* ── where an entry came from (Athi, 2026-10-01: "how do I connect to the sale record, who has done it?") ── */
  ['SRC source not shown', CAP, `return [head].concat(party ? [esc(party)] : [], bkSourceParts(s, tid, cur)).join(' · ')`, `return head`],
  ['SRC bill number not a link', CAP, `var link = s.chit_id ? '<a href="#"`, `var link = false ? '<a href="#"`],
  ['SRC link also opens the row', CAP, `onclick="event.stopPropagation();openChitSheet(\\''`, `onclick="openChitSheet(\\''`],
  ['SRC day count missing', CAP, `if (s.count != null) out.push(`, `if (false) out.push(`],
  ['SRC counter missing', CAP, `  if (s.counter) out.push(esc(tx('Counter')) + ' ' + esc(s.counter));`, ``],
  ['SRC seller missing', CAP, `  if (s.by) out.push(esc(s.by) + (bkIsShopName(s.by) ? ' ' + esc(tx('(owner)')) : ''));`, ``],
  ['SRC day reads its long narration', CAP, `s && s.kind === 'day' ? esc(tx('Walk-in day'))`, `false ? esc(tx('Walk-in day'))`],
  ['SRC ledger lines lose their source', CAP, `bkEntryHead(l, 'stmt-src-' + i, c)`, `esc(l.what || '')`],
  /* ── how it was paid (Athi, 2026-10-01: "clearly segregate credit, cash, UPI (UPI id)") ── */
  ['HOW tender not shown', CAP, `  else if (s.how) out.push(`, `  else if (false) out.push(`],
  ['HOW day split not shown', CAP, `if (s.kind === 'day' && s.split && s.split.length) out.push(`, `if (false) out.push(`],
  ['HOW payment reference dropped', CAP, `(s.how_ref ? ' <span class="mono">' + esc(bkShortRef(s.how_ref))`, `(false ? ' <span class="mono">' + esc(bkShortRef(s.how_ref))`],
  /* ── both times (Athi, 2026-10-01: "the time the bill was made or the time the entry was accepted? both should be there") ── */
  ['TIME bill time not shown', CAP, `link + (s.doc_at ? ' <span`, `link + (false ? ' <span`],
  ['TIME late entry not marked', CAP, `  if (!late) return '';`, `  return '';`],
  ['TIME same-day entry marked anyway', CAP, `  if (!late) return '';`, `  if (false) return '';`],
  ['HOW receipt not called Received', CAP, `s && s.kind === 'receipt' ? esc(tx('Received'))`, `false ? esc(tx('Received'))`],
  /* ── the Day book's strip and to-do (Athi, 2026-10-01: "see the total sale in different counters … act one by one") ── */
  ['TODO strip counter amount dropped', CAP, `counters[c].amount_minor += total; counters[c].bills += bills;`, `counters[c].bills += bills;`],
  ['TODO strip per-bill does not count one', CAP, `var bills = s.kind === 'day' ? Number(s.count || 0) : 1;`, `var bills = s.kind === 'day' ? Number(s.count || 0) : 0;`],
  ['TODO strip day split not in tenders', CAP, `if (s.kind === 'day') (s.split || []).forEach(function (x) { add(x.how, Number(x.amount_minor || 0)); });`, `if (false) (s.split || []).forEach(function (x) { add(x.how, Number(x.amount_minor || 0)); });`],
  ['TODO strip bill tender dropped', CAP, `    else if (s.how) add(s.how, total);`, ``],
  ['TODO walk-in note never said', CAP, `var note = t.day_closed ? ''`, `var note = true ? ''`],
  ['TODO note said though the day closed', CAP, `var note = t.day_closed ? ''`, `var note = false ? ''`],
  ['TODO accept filter counts everything', CAP, `/^Waiting for you to confirm/.test(String(w.reason || w.why || ''))`, `true`],
  ['TODO overdue counts the settled too', CAP, `return Object.keys(b).some(function (k) { return k !== 'not_due' && Number(b[k] || 0); });`, `return true;`],
  ['TODO cheque without a step counted', CAP, `bkChequeNext({ status: bkChequeStatus(x.status), next: Array.isArray(x.next) ? x.next : null }).length > 0`, `true`],
  ['TODO waiting double-counts the supplier bills', CAP, `waiting: waiting.length - confirm.length`, `waiting: waiting.length`],
  ['TODO a zero still earns a row', CAP, `if (n.accept) items.push(`, `if (true) items.push(`],
  ['TODO quiet line missing', CAP, `if (!items.length) return '<div data-testid="todo-none"`, `if (false) return '<div data-testid="todo-none"`],
  ['TODO dues tap dead', CAP, `"bkTab('dues')"`, `""`],
  ['TODO cheques tap dead', CAP, `"bkTab('cheques')"`, `""`],
  ['TODO waiting tap dead', CAP, `tx('waiting to be recorded'), "bkTab('waiting')"));`, `tx('waiting to be recorded'), ""));`],
  ['TODO phone tap shows nothing', CAP, `  if (!silent && UI.vp === 'mob') { UI.mdetail = true; var pn = document.getElementById('panel'); if (pn) pn.classList.add('showdetail'); }`, ``],
  /* ── the Day book's views (Athi, 2026-10-01: "expand all, collapse all, search, filter, daily view, weekly view … the gist as a summary") ── */
  ['VIEW gist from a second formula', CAP, `m[key].amt += Number(l.dr_minor || 0) + Number(l.cr_minor || 0);`, `m[key].amt += Math.round(Number(l.dr_minor || 0) * 1.01) + Number(l.cr_minor || 0);`],
  ['VIEW GST rate lines not merged', CAP, `key = gst ? 'GST' : String(l.code);`, `key = String(l.code);`],
  ['VIEW filter ignored', CAP, `return bkDvVals(e, x[0]).some(function (v) { return on.indexOf(v) >= 0; });`, `return true;`],
  ['VIEW search ignored', CAP, `if (!bkDvMatch(e, d.q, c)) return false;`, ``],
  ['VIEW search skips amounts', CAP, `return amts.some(function (a) { return dec ? a === minor : Math.floor(a / pow) === n; });`, `return false;`],
  ['VIEW paise search matches the whole rupee', CAP, `return dec ? a === minor : Math.floor(a / pow) === n;`, `return Math.floor(a / pow) === Math.floor(n);`],
  ['VIEW collapse-all leaves one open', CAP, `if (on) bkDvShown().forEach(function (e) { d.open[e.entry_no] = true; }); else d.open = {};`, `if (on) bkDvShown().forEach(function (e) { d.open[e.entry_no] = true; }); else { var k0 = Object.keys(d.open)[0]; d.open = {}; if (k0) d.open[k0] = true; }`],
  ['VIEW expand-all misses some', CAP, `if (on) bkDvShown().forEach(function (e) { d.open[e.entry_no] = true; });`, `if (on) bkDvShown().slice(1).forEach(function (e) { d.open[e.entry_no] = true; });`],
  ['VIEW open by default', CAP, `var no = esc(e.entry_no), open = !!BK.dv.open[e.entry_no];`, `var no = esc(e.entry_no), open = true;`],
  ['VIEW group heads ignore the filter', CAP, `bkDvGroups(list, d.group).map(function (g) {`, `bkDvGroups(d.r.entries, d.group).map(function (g) {`],
  ['VIEW week starts on Sunday', CAP, `new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 864e5)`, `new Date(t.getTime() - t.getUTCDay() * 864e5)`],
  ['VIEW week number missing', CAP, `label: txf('Week {n}', { n: wk }) + ' · ' + `, `label: `],
  ['VIEW month head not grouped', CAP, `if (mode === 'month') return { key: day.slice(0, 7),`, `if (mode === 'month') return { key: day,`],
  ['VIEW day head loses a tender', CAP, `tn.forEach(function (x) { parts.push(`, `tn.slice(1).forEach(function (x) { parts.push(`],
  ['VIEW arrow down does not move', CAP, `at = ev.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) :`, `at = ev.key === 'ArrowDown' ? at :`],
  ['VIEW Enter does nothing', CAP, `else if (ev.key === 'Enter' && !typing && BK.dv.hl) {`, `else if (false) {`],
  ['VIEW Esc swallowed', CAP, `if (ev.key === 'Escape') return;`, `if (ev.key === 'Escape') { ev.preventDefault(); return; }`],
  ['VIEW CSV drops a row', CAP, `    rows.push([String(e.posting_date).slice(0, 10), e.entry_no,`, `    if (e.entry_no !== 'JV/2026-27/000001') rows.push([String(e.posting_date).slice(0, 10), e.entry_no,`],
  ['VIEW CSV ignores the filter', CAP, `new Blob(['\ufeff' + bkDvCsv(bkDvShown(), d.r.currency)]`, `new Blob(['\ufeff' + bkDvCsv(d.r.entries, d.r.currency)]`],
  ['VIEW chip for a value not in range', CAP, `if (seen.indexOf(v) < 0) seen.push(v); }); });`, `if (seen.indexOf(v) < 0) seen.push(v); }); }); if (x[0] === 'kind') seen.push('Purchases');`],
  ['VIEW lit chip not marked', CAP, `'" aria-pressed="' + on + '" data-dim="'`, `'" aria-pressed="false" data-dim="'`],
  ['VIEW bill link also toggles the row', CAP, `onclick="event.stopPropagation();openChitSheet(\\''`, `onclick="openChitSheet(\\''`],
  ['VIEW phone chips wrap', CAP, `.bkdv-chips{flex-wrap:nowrap;overflow-x:auto;`, `.bkdv-chips{flex-wrap:wrap;overflow-x:auto;`],
  ['VIEW phone rows not cards', CAP, `.bkdv-row{border:1px solid var(--line);border-radius:12px;`, `.bkdv-row{border:0;border-radius:0;`],
];
/* BREAK_ONLY=M1 runs just the breaks whose name contains it */
const ONLY = process.env.BREAK_ONLY || '';
let good = 0, ran = 0;
for (const [name, rel, a, b] of BREAKS) {
  if (ONLY && name.indexOf(ONLY) < 0) continue;
  ran++;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bkw-'));
  try {
    fs.cpSync(path.join(W, 'public'), path.join(tmp, 'public'), { recursive: true });
    const f = path.join(tmp, rel), raw = fs.readFileSync(f, 'utf8'), crlf = raw.indexOf('\r\n') >= 0, s = raw.replace(/\r\n/g, '\n'), n = s.split(a).length - 1;
    if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n); continue; }
    const out = s.split(a).join(b);
    fs.writeFileSync(f, crlf ? out.replace(/\n/g, '\r\n') : out);
    /* ⚠️ 600s, not 300: a break that strands the harness on its catch-all waits runs long, and on a loaded
       Windows machine 'M10 download not remembered' crossed 300s — reported NOT caught when it was only slow. */
    const r = cp.spawnSync(process.execPath, ['e2e/books-web.cjs'], { cwd: W, encoding: 'utf8', timeout: 600000, env: Object.assign({}, process.env, { BOOKS_ROOT: path.join(tmp, 'public') }) });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+XX/.test(l));
    const caught = r.status !== 0 && xx.length > 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + xx[0].trim() : 'NOT caught (exit ' + r.status + ')'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught');
process.exitCode = good === ran ? 0 : 1;
