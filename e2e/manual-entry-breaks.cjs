/* manual-entry-breaks.cjs — BREAK EACH ＋ ENTRY GUARD ONCE, RUN ITS HARNESS, RESTORE FROM A COPY (never git checkout).
 * A guard that has never been seen to fail may not be there. Each line damages cap-entry.js in exactly the way manual-entry.cjs exists
 * to catch — the two the task names first: a page that COMPUTES a line's amount, and Save enabled while the entry is unbalanced.
 * BREAK_ONLY=<text> runs just the breaks whose name contains it · BREAK_CHECK=1 only checks every anchor matches once.
 * Exit 0 only when every break was caught. Same runner as cb-accounts-breaks.cjs. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = path.join(__dirname, '..');
const ENT = 'public/app/cap-entry.js', A = 'e2e/manual-entry.cjs';
const BREAKS = [
  /* the two the task names */
  ['the page computes a line\'s amount', ENT, `l.dr_minor ? enE(bkMoney(l.dr_minor, c)) : ''`, `l.dr_minor ? enE(bkMoney(Math.round(l.dr_minor * 1.18), c)) : ''`, A],
  ['Save is on while the server says it does not balance', ENT, `return !!(pv && pv.balanced === true && !(pv.refusals || []).length`, `return !!(pv && !(pv.refusals || []).length`, A],
  /* the rest */
  ['Save is on while the server refuses the entry', ENT, `&& !(pv.refusals || []).length && !EN.pvBusy`, `&& !EN.pvBusy`, A],
  ['the page sends a different amount than was typed', ENT, `b.amount_minor = bkToMinor(EN.v.amount);`, `b.amount_minor = bkToMinor(EN.v.amount) + 1;`, A],
  ['a locked month is not refused at the date', ENT, `EN.dateRef = r && r.code === 'PERIOD_LOCKED' ? enWords(r.refusals, r.code).slice(0, 1) : [];`, `EN.dateRef = [];`, A],
  /* three layers stand in the way of a second post (the page's EN.saving, bkOnce, and api()'s own in-flight lock): the break removes all three */
  ['a double tap posts twice', ENT, `await bkOnce('entry-save', btn, async function () {\n    EN.saving = true; var body = enBody(); body.client_ref = EN.ref; if (EN.photo) body.attachment = EN.photo;\n    var key = 'booksEventPost';\n    try {\n      var r = await api(key, { body: body });`, `await (function (k, b, fn) { return fn(); })('entry-save', btn, async function () {\n    var body = enBody(); body.client_ref = EN.ref; if (EN.photo) body.attachment = EN.photo;\n    var key = 'booksEventPost';\n    try {\n      var r = await api(key, { body: body, params: { n: Math.random() } });`, A],
  ['a retry loses its client_ref', ENT, `body.client_ref = EN.ref;`, `body.client_ref = bkRef();`, A],
  ['Save posts to the wrong route', ENT, `var key = 'booksEventPost';`, `var key = 'booksPreview';`, A],
  ['Reverse posts without asking first', ENT, `if (!id) return;\n  confirmAsk(`, `if (!id) return;\n  (function (a, b, c, go) { go(); })(`, A],
  ['a line does not name the rule that placed it', ENT, `enE(l.rule || '')`, `enE('')`, A],
  ['a line does not name its type', ENT, `enE(tx(l.type || ''))`, `enE('')`, A],
  ['a warning has no fix button', ENT, `'<button type="button" data-testid="en-wfix-'`, `'<i hidden data-testid="en-wfix-'`, A],
  ['the word accounting reaches the screen', ENT, `'Which lines?'`, `'Which accounting lines?'`, A],
  ['the journal sheet is wider than the phone', ENT, `grid-template-columns:minmax(0,1fr) 84px minmax(0,96px) 44px`, `grid-template-columns:260px 84px minmax(0,96px) 44px`, A],
  /* the real shapes (api #20) */
  ['the journal sends lines the server does not read', ENT, `o[l.side === 'cr' ? 'cr_minor' : 'dr_minor'] = bkToMinor(l.amt);`, `o.amount_minor = bkToMinor(l.amt); o.side = l.side;`, A],
  ['the voucher is shown without its kind', ENT, `kind: r.voucher.type }`, `kind: '' }`, A],
  ['an event with a route of its own is offered on the sheet', ENT, `e.preview !== false && !e.route`, `true`, A],
  ['the page reads the server\'s refusals as nothing', ENT, `refusals: enWords(r.refusals, r.code),`, `refusals: [],`, A],
  ['an alert() sneaks in', ENT, `function enClose() {`, `function enClose() { alert('hi');`, A],
];
const ONLY = process.env.BREAK_ONLY || '';
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
  if (/\r\n/.test(s)) { a = a.replace(/\r?\n/g, '\r\n'); b = b.replace(/\r?\n/g, '\r\n'); }
  const n = s.split(a).length - 1;
  if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n + ' — this break measured NOTHING'); unanchored++; continue; }
  fs.copyFileSync(f, bak);
  try {
    fs.writeFileSync(f, s.split(a).join(b));
    const r = cp.spawnSync(process.execPath, [harness], { cwd: W, encoding: 'utf8', timeout: 400000 });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+XX/.test(l));
    const caught = r.status !== 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + (xx[0] || (r.stderr || '').split('\n')[0] || 'harness failed').trim().slice(0, 150) : 'NOT caught (exit ' + r.status + ')'));
  } finally { fs.copyFileSync(bak, f); fs.unlinkSync(bak); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught' + (unanchored ? ', ' + unanchored + ' unanchored' : ''));
process.exitCode = good === ran && !unanchored ? 0 : 1;
