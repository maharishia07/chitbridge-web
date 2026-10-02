/* cb-accounts-breaks.cjs — BREAK EACH CB ACCOUNTS GUARD ONCE, RUN ITS HARNESS, RESTORE FROM A COPY (never git checkout).
 * A guard that has never been seen to fail is a guard that may not be there: each line below damages the page (or the index
 * tile) in exactly the way the harness exists to catch, and the harness must go red. The four the task names — a view missing
 * from the sidebar, a per-row balance fetch, the Active badge shown while off, the gate not attached — come first.
 * BREAK_ONLY=<text> runs just the breaks whose name contains it. Exit 0 only when every break was caught. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = path.join(__dirname, '..');
const CAPB = 'public/app/cap-books.js';
const PAGE = 'public/accounts.html', IDX = 'index.html', SHELL = 'public/app/accounts-shell.js';
const A = 'e2e/cb-accounts.cjs', I = 'e2e/index-page.cjs';
const BREAKS = [
  /* the four the task names */
  ['a view goes missing from the sidebar (Bills)', PAGE, `  ['bills', 'Bills', 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4'],\n`, ``, A],
  ['a balance is fetched per row', PAGE, `ACC.bal = bal;`, `ACC.bal = bal; ACC.secs.forEach((s) => s.groups.forEach((g) => g.accounts.forEach((a) => { api('booksLedger', { params: { account: a[0] }, query: bkRange('lg') }).catch(() => {}); })));`, A],
  ['the Active badge is shown while the Ledger is off', IDX, `badge.hidden = on !== true;`, `badge.hidden = false;`, I],
  ['the one-shop gate is not attached', PAGE, `CBOnePerson.attach({ quiet: true, who: () => MINE,`, `void ({ quiet: true, who: () => MINE,`, A],
  /* party ledgers (docs/design/party-ledgers/CLOUD-TASK.md) */
  ['a statement is fetched per party row', CAPB, `  var list = Object.keys(BK.dues || {})`, `  Object.keys(BK.dues || {}).forEach(function (k) { api('booksStatement', { params: { id: k } }).catch(function () {}); });\n  var list = Object.keys(BK.dues || {})`, A],
  ['a row does not name its party', CAPB, `bkEntryHead(l, 'stmt-src-' + i, c, bkPartyLabel(l.party_id || partyId || (r && r.party_id), l.party_name))`, `bkEntryHead(l, 'stmt-src-' + i, c)`, A],
  ['the cashier is not marked "rung by"', CAPB, `out.push(esc(tx('rung by')) + ' ' + esc(s.by)`, `out.push(esc(s.by)`, A],
  /* the rest of the page's guards */
  ['a co-assist is offered Switch on', PAGE, `const isOwner = () => SESSION.role === 'entity';`, `const isOwner = () => true;`, A],
  ['Switch on is sent before the owner confirms', PAGE, `    ask: confirmAsk,\n    working: () => { b.disabled = true;`, `    ask: (t, bd, ok, go) => go(),\n    working: () => { b.disabled = true;`, A],
  ['a failed read is mistaken for a Ledger that is off', PAGE, `    if (e && e.status === 404) return offCard();\n    return failedCard();`, `    return offCard();`, A],
  ['Sign out keeps the session', PAGE, `    localStorage.removeItem('cb_sess');\n    Object.keys`, `    Object.keys`, A],
  ['Home goes somewhere else', PAGE, `<a class="home" href="/" data-testid="acc-home">`, `<a class="home" href="/app.html" data-testid="acc-home">`, A],
  ['Profile goes somewhere else', PAGE, `<a href="/app.html#/app/profile" data-testid="nav-profile">`, `<a href="/app.html#/app/settings" data-testid="nav-profile">`, A],
  ['a code the design never named vanishes', PAGE, `accounts.filter((a) => !a.is_group).forEach((a) => {`, `accounts.filter((a) => !a.is_group && groupOf(a.code)[1] !== 'OTHER').forEach((a) => {`, A],
  ['the step chip is decided by the page, not the server', PAGE, `\${esc(b.label)}</span>\` : ''}`, `\${esc(b.step)}</span>\` : ''}`, A],
  ['the phone overflows', PAGE, `.search{flex-grow:1;min-width:0;`, `.search{flex-grow:1;min-width:420px;`, A],
  ['the sidebar stays wide on a phone', PAGE, `  .side{width:64px}\n  .side .label,#toggleNav{display:none}`, `  .side .label,#toggleNav{display:none}`, A],
  ['a table scrolls sideways instead of folding into cards', PAGE, `#bk_body table.bktab thead{display:none}`, ``, A],
  ['the word accounting reaches the screen', PAGE, `<span class="brand-name">CB Accounts</span>`, `<span class="brand-name">CB Accounts accounting</span>`, A],
  ['an alert() sneaks in', PAGE, `function navTo(k){`, `function navTo(k){ alert('hi');`, A],
  ['the Switch on call is copied into the page', PAGE, `call: (on) => CBLedger.call({ api: api }, on),`, `call: (on) => api('booksEnable', { body: {} }),`, A],
  /* the index tile */
  ['the tile never lights', IDX, `box.classList.toggle('lit', on === true);`, `box.classList.toggle('lit', false);`, I],
  ['a co-assist is offered Switch on on the tile', IDX, `if (SESS && SESS.role === 'entity'){`, `if (true){`, I],
  ['the lit tile pulses for a reader who asked for less motion', IDX, `@media (prefers-reduced-motion:no-preference){.box.lit{animation:`, `@media all{.box.lit{animation:`, I],
  ['the tile opens the old Ledger screen', IDX, `<a class="cover" href="/accounts.html" data-testid="box-ledger-link">`, `<a class="cover" href="app.html#/app/ledger" data-testid="box-ledger-link">`, I],
  ['the tile is still called Ledger', IDX, `<h3>CB Accounts<span`, `<h3>Ledger<span`, I],
  ['the tile sends Switch on before the owner confirms', IDX, `    ask: CBConfirm,`, `    ask: function(t, b, o, go){ go(); },`, I],
];
const ONLY = process.env.BREAK_ONLY || '';
let good = 0, ran = 0;
for (const [name, rel, a, b, harness] of BREAKS) {
  if (ONLY && name.indexOf(ONLY) < 0) continue;
  ran++;
  const f = path.join(W, rel), bak = f + '.bak';
  const s = fs.readFileSync(f, 'utf8'); const n = s.split(a).length - 1;
  if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n); continue; }
  fs.copyFileSync(f, bak);
  try {
    fs.writeFileSync(f, s.split(a).join(b));
    const r = cp.spawnSync(process.execPath, [harness], { cwd: W, encoding: 'utf8', timeout: 400000 });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+XX/.test(l));
    const caught = r.status !== 0 && xx.length > 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + xx[0].trim().slice(0, 150) : 'NOT caught (exit ' + r.status + ')'));
  } finally { fs.copyFileSync(bak, f); fs.unlinkSync(bak); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught');
process.exitCode = good === ran ? 0 : 1;
