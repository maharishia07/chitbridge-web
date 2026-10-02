/* cb-accounts-breaks.cjs — BREAK EACH CB ACCOUNTS GUARD ONCE, RUN ITS HARNESS, RESTORE FROM A COPY (never git checkout).
 * A guard that has never been seen to fail is a guard that may not be there: each line below damages the page (or the index
 * tile) in exactly the way the harness exists to catch, and the harness must go red. The four the task names — a view missing
 * from the sidebar, a per-row balance fetch, the Active badge shown while off, the gate not attached — come first.
 * BREAK_ONLY=<text> runs just the breaks whose name contains it. Exit 0 only when every break was caught. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = path.join(__dirname, '..');
const CAPB = 'public/app/cap-books.js', LCTL = 'public/app/list-ctl.js';
const AV = 'public/app/avatar.js';   /* the avatar is CBAvatar now: its Profile link and its sign-out live here, not on the page */
const PAGE = 'public/accounts.html', IDX = 'index.html', SHELL = 'public/app/accounts-shell.js';
const A = 'e2e/cb-accounts.cjs', I = 'e2e/index-page.cjs';
const BREAKS = [
  /* the four the task names */
  ['a view goes missing from the sidebar (Bills)', PAGE, `  ['bills', 'Bills', 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4'],\n`, ``, A],
  ['a balance is fetched per row', CAPB, `BK.lt.bal = rr[1];`, `BK.lt.bal = rr[1]; (BK.lt.model || []).forEach(function (b) { b.groups.forEach(function (g) { g.accts.forEach(function (a) { api('booksLedger', { params: { account: a.code }, query: bkRange('lg') }).catch(function () {}); }); }); });`, A],
  ['the Active badge is shown while the Ledger is off', IDX, `badge.hidden = on !== true;`, `badge.hidden = false;`, I],
  ['the one-shop gate is not attached', PAGE, `CBOnePerson.attach({ quiet: true, who: () => MINE,`, `void ({ quiet: true, who: () => MINE,`, A],
  /* party ledgers (docs/design/party-ledgers/CLOUD-TASK.md) */
  ['a statement is fetched per party row', CAPB, `function bkLtParties(ctrl) {\n`, `function bkLtParties(ctrl) {\n  Object.keys(BK.dues || {}).forEach(function (k) { api('booksStatement', { params: { id: k } }).catch(function () {}); });\n`, A],
  ['a row does not name its party', CAPB, `var pl = l.party_id ? bkPartyLabel(l.party_id, l.party_name) : (l.party_name || '');`, `var pl = l.party_id ? '' : (l.party_name || '');`, A],
  ['the cashier is not marked "rung by"', CAPB, `esc(tx('rung by')) + ' ' + esc(s.by)`, `esc(s.by)`, A],
  /* the rest of the page's guards */
  ['a co-assist is offered Switch on', PAGE, `const isOwner = () => SESSION.role === 'entity';`, `const isOwner = () => true;`, A],
  ['Switch on is sent before the owner confirms', PAGE, `    ask: confirmAsk,\n    working: () => { b.disabled = true;`, `    ask: (t, bd, ok, go) => go(),\n    working: () => { b.disabled = true;`, A],
  ['a failed read is mistaken for a Ledger that is off', PAGE, `    if (e && e.status === 404) return offCard();\n    return failedCard();`, `    return offCard();`, A],
  ['Sign out keeps the session (the avatar\'s sign-out, public/app/avatar.js)', AV, `      root.localStorage.removeItem('cb_sess');\n`, ``, A],
  ['Home goes somewhere else', PAGE, `<a class="home" href="/" data-testid="acc-home">`, `<a class="home" href="/app.html" data-testid="acc-home">`, A],
  ['Profile goes somewhere else (the avatar\'s Profile link)', AV, `o.profileHref || '/app.html#/app/profile'`, `o.profileHref || '/app.html#/app/settings'`, A],
  ['a code the design never named vanishes', CAPB, `title = g ? g[1] : 'Other';`, `title = g ? g[1] : 'Other'; if (!g) return;`, A],
  ['the step chip is decided by the page, not the server', PAGE, `data-step="\${esc(b.step || '')}">\${esc(b.label)}</span>`, `data-step="\${esc(b.step || '')}">\${esc(b.step)}</span>`, A],
  ['the phone overflows', LCTL, `.tblx{container:tblx/inline-size;min-width:0}`, `.tblx{container:tblx/inline-size;min-width:900px}`, A],
  ['the sidebar stays wide on a phone', PAGE, `  .side{width:64px}\n  .side .label,#toggleNav{display:none}`, `  .side .label,#toggleNav{display:none}`, A],
  ['a table scrolls sideways instead of folding into cards', PAGE, `#bk_body table.bktab thead{display:none}`, ``, A],
  /* ── ONE TABLE (docs/design/one-table): the Ledgers' folder tree and party leaves ── */
  ['ONE the ledger tree lists the per-party accounts as leaves', CAPB, `!/^(1300|2100)-/.test(String(a.code))`, `true`, A],
  ['ONE the control account hides its parties', CAPB, `if (open) inner += parties.map(function (p) {`, `if (false) inner += parties.map(function (p) {`, A],
  ['ONE the parties and the ledger may disagree unsaid', CAPB, `(total === closing ? '' : '<div data-testid="lg-parties-diff"`, `(true ? '' : '<div data-testid="lg-parties-diff"`, A],
  ['ONE the ledger rows draw their own table', CAPB, `return tblWrapFor('ledger', fit, tblHeadFor('ledger', fit) +`, `return '<table class="bktab"><tbody><tr><td>x</td></tr></tbody></table>' + (false ? tblWrapFor('ledger', fit, tblHeadFor('ledger', fit) +`, A],
  ['ONE an entry has no next level', CAPB, `  var e = bkLgEntry(l);\n`, `  var e = null;\n`, A],
  ['ONE a bill number opens no sheet in the ledger', CAPB, `function bkBillPart(s, tid) {\n`, `function bkBillPart(s, tid) {\n  s = Object.assign({}, s, { chit_id: null });\n`, A],
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
/* BREAK_CHECK=1 only checks that every anchor still matches the source exactly once (fast — nothing is run) */
if (process.env.BREAK_CHECK) {
  let bad = 0;
  for (const [name, rel, a2] of BREAKS) { const n = fs.readFileSync(path.join(W, rel), 'utf8').replace(/\r\n/g, '\n').split(a2.replace(/\r?\n/g, '\n')).length - 1; if (n !== 1) { bad++; console.log('  ??  ' + name + ': anchor x' + n); } }
  console.log('\n  ' + (BREAKS.length - bad) + '/' + BREAKS.length + ' anchors match once'); process.exit(bad ? 1 : 0);
}
let good = 0, ran = 0, unanchored = 0;
for (let [name, rel, a, b, harness] of BREAKS) {
  if (ONLY && name.indexOf(ONLY) < 0) continue;
  ran++;
  const f = path.join(W, rel), bak = f + '.bak';
  const s = fs.readFileSync(f, 'utf8');
  /* ⚠️ CRLF-SAFE (2026-10-02): a Windows checkout (core.autocrlf) has \r\n, and a two-line anchor written with \n matched
     nothing there — the break was skipped as "anchor x0" and the run still exited 0. Anchors follow the file's own endings. */
  if (/\r\n/.test(s)) { a = a.replace(/\r?\n/g, '\r\n'); b = b.replace(/\r?\n/g, '\r\n'); }
  const n = s.split(a).length - 1;
  if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n + ' — this break measured NOTHING'); unanchored++; continue; }
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
