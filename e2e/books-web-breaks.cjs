/* books-web-breaks.cjs — */ // break each Ledger guard once, run the harness, restore FROM A COPY (never git checkout)
const fs = require('fs'), path = require('path'), cp = require('child_process');
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
];
/* BREAK_ONLY=M1 runs just the breaks whose name contains it */
const ONLY = process.env.BREAK_ONLY || '';
let good = 0, ran = 0;
for (const [name, rel, a, b] of BREAKS) {
  if (ONLY && name.indexOf(ONLY) < 0) continue;
  ran++;
  const f = path.join(W, rel), bak = f + '.bak';
  const s = fs.readFileSync(f, 'utf8'); const n = s.split(a).length - 1;
  if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n); continue; }
  fs.copyFileSync(f, bak);
  try {
    fs.writeFileSync(f, s.split(a).join(b));
    /* ⚠️ 600s, not 300: a break that strands the harness on its catch-all waits runs long, and on a loaded
       Windows machine 'M10 download not remembered' crossed 300s — reported NOT caught when it was only slow. */
    const r = cp.spawnSync(process.execPath, ['e2e/books-web.cjs'], { cwd: W, encoding: 'utf8', timeout: 600000 });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+XX/.test(l));
    const caught = r.status !== 0 && xx.length > 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + xx[0].trim() : 'NOT caught (exit ' + r.status + ')'));
  } finally { fs.copyFileSync(bak, f); fs.unlinkSync(bak); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught');
process.exitCode = good === ran ? 0 : 1;
