/* crm-breaks.cjs — BREAK EACH CB CRM GUARD ONCE, RUN ITS HARNESS, RESTORE FROM A COPY (never git checkout).
 * A guard that has never been seen to fail is a guard that may not be there: each line below damages the page in exactly the way
 * crm.cjs exists to catch, and the harness must go red. The five the task names — a both-roles party drawn twice, a merged party
 * listed, Message offered to a local party, mail offered with the preference off, a per-row fetch — come first.
 * BREAK_ONLY=<text> runs just the breaks whose name contains it · BREAK_CHECK=1 only checks that every anchor still matches the
 * source exactly once (fast — nothing is run). Exit 0 only when every break was caught. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = path.join(__dirname, '..');
const PAGE = 'public/crm.html', HOME = 'public/app/cap-crm.js', REC = 'public/app/cap-crm-record.js';
const H = 'e2e/crm.cjs';
const BREAKS = [
  /* the five the task names */
  ['a both-roles party is drawn twice', HOME, `    if (seen) { (p.roles || []).forEach(`, `    if (false && seen) { (p.roles || []).forEach(`, H],
  ['a merged party is listed', HOME, `    if (!p || p.merged_into) return;`, `    if (!p) return;`, H],
  ['Message is offered to a local party', REC, `  else if (p.on_chitbridge) { primary = '<button type="button" class="act" data-crm="message"`, `  else if (true) { primary = '<button type="button" class="act" data-crm="message"`, H],
  ['Mail is offered with the preference off', REC, `  if (e && e.allowed === false) return tx('They asked not to be mailed');`, `  if (false) return tx('They asked not to be mailed');`, H],
  ['a row fetches its own record (a per-row fetch)', HOME, `function crmPartyCell(p) {\n`, `function crmPartyCell(p) {\n  api('crmParty', { params: { id: p.party_id } }).catch(function () {});\n`, H],
  /* money is read, never computed */
  ['the page works out a tax on the dues', HOME, `  if (!CRM.ledger || p.balance_minor == null) return '<span class="sub">—</span>';`, `  if (!CRM.ledger || p.balance_minor == null) return '<span class="sub">—</span>';\n  var _gst = p.balance_minor * 1.18;`, H],
  ['the page sums the dues of every party', HOME, `function crmNotices() {\n`, `function crmNotices() {\n  var _tot = CRM.rows.reduce(function (a, p) { return a + (p.balance_minor || 0); }, 0);\n`, H],
  /* the frozen look */
  ['a column header is drawn by hand', HOME, `function crmHome(frame) {\n`, `function crmHome(frame) {\n  var _h = '<thead><tr><th>Party</th></tr></thead>';\n`, H],
  ['a banner row sits above the list (the head grows past 20%)', HOME, `  s.innerHTML = '<div id="crm_list" data-testid="crm-list"></div>';`, `  s.innerHTML = '<div style="height:90px">banner</div><div id="crm_list" data-testid="crm-list"></div>';`, H],
  ['the page draws its own avatar', PAGE, `data-testid="avatar-slot"></span>\``, `data-testid="avatar-slot"><b class="avatar">A</b></span>\``, H],
  ['the phone overflows', PAGE, `  .content,.rec{padding-left:16px;padding-right:16px}`, `  .content,.rec{padding-left:16px;padding-right:16px;min-width:700px}`, H],
  /* who sees what */
  ['a viewer is offered every action', HOME, `function crmEdit() { return crmRole() !== 'viewer'; }`, `function crmEdit() { return true; }`, H],
  ['a co-assist is treated as the owner', HOME, `function crmOwner() { return SESSION.role === 'entity'; }`, `function crmOwner() { return true; }`, H],
  ['a co-assist\'s follow-ups default to Everyone', HOME, `  var def = crmOwner() ? 'all' : 'mine';`, `  var def = 'all';`, H],
  /* the ledger */
  ['the late-dues alert shows with the Ledger off', HOME, `  if (CRM.ledger && du > 0)`, `  if (du > 0)`, H],
  ['the Dues column is drawn with the Ledger off', HOME, `  if (CRM.ledger) cols.push({ key: 'dues'`, `  if (true) cols.push({ key: 'dues'`, H],
  ['the Ledger section ignores the switch', REC, `    if (CRM.ledger) secs.push(crmSec('ledger'`, `    if (true) secs.push(crmSec('ledger'`, H],
  /* the words and the states */
  ['a migration answer is shown as a plain failure', HOME, `  if (st === 409) return crmOwner()`, `  if (false) return crmOwner()`, H],
  ['a failed list shows the server\'s own message', HOME, `  return { title: tx("Couldn't load " + what + "."), sub: tx('Check the connection and try again.') };`, `  return { title: tx("Couldn't load " + what + "."), sub: (e && e.message) || '' };`, H],
  ['the Fix address button is dropped from Next', REC, `btn('fixaddr', 'Fix address', true, '', 'crm-next-fix')`, `''`, H],
  ['a minted party shows a ChitBridge ID', REC, `cell('ChitBridge ID', minted ? null : p.bridge_id, '—', 'crm-id-bridge')`, `cell('ChitBridge ID', p.bridge_id || 'CB00LOCAL0', '—', 'crm-id-bridge')`, H],
  ['the timeline reads the whole history in one go', REC, `before: more ? T.next : '' } });`, `before: '' } });`, H],
  ['the timeline lists kinds that have nothing', REC, `(T.counts[t[0]] == null || T.counts[t[0]] > 0); }).map(`, `(true); }).map(`, H],
  ['the unread dot is gone', REC, `(unread ? '<span class="udot" title="' + esc(tx('Unread')) + '"></span> ' : '')`, `''`, H],
  ['an internal message is not tagged', REC, `(e.kind === 'message_internal' ? '<span class="tagi">' + esc(tx('internal')) + '</span>' : '')`, `''`, H],
  ['a long call is not cut short', REC, `l.length > CRM_LONG ?`, `l.length > 99999 ?`, H],
  ['Done does not send done:true', HOME, `if (a === 'fudone') { ev.stopPropagation(); return crmFuAct(id, { done: true }); }`, `if (a === 'fudone') { ev.stopPropagation(); return crmFuAct(id, { snoozed: true }); }`, H],
  ['the log sheet saves a follow-up as manual', REC, `source: 'interaction' } });`, `source: 'manual' } });`, H],
  ['the edit sheet keeps one tax id', 'public/app/cap-books.js', `var taxes = (r.tax_ids && r.tax_ids.length) ? r.tax_ids : [{}];`, `var taxes = (r.tax_ids && r.tax_ids.length) ? [r.tax_ids[0]] : [{}];`, H],
  ['the page is no longer named CB CRM', PAGE, `<title>CB CRM</title>`, `<title>CB Accounts</title>`, H],
  ['the word accounting reaches the page', PAGE, `<div class="brand-name label">CB CRM</div>`, `<div class="brand-name label">CB CRM accounting</div>`, H],
  /* the lists round (2026-10-09): the handle is never an e-mail · the stripe · the whole frame in the first paint */
  ['an internal .cr handle is shown as an e-mail', HOME, `  if (!/@[^@.\\s]+\\.(cr|br)$/i.test(s)) return s;`, `  if (true) return s;`, H],
  ['the zebra stripe is gone', 'public/app/list-ctl.js', `var zb = (zi++ % 2) === 1;`, `var zb = false; zi++;`, H],
  ['the first paint is not the whole frame (the menu waits for the data)', PAGE, `  crmRoute(true);`, `  /* crmRoute(true); */`, H],
  ['an alert() sneaks in', HOME, `function crmOwner() {`, `function crmOwner() { alert('hi');`, H],
  ['the one-shop gate is not attached', PAGE, `CBOnePerson.attach({ quiet: true, who: () => MINE,`, `void ({ quiet: true, who: () => MINE,`, H],
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
    const caught = r.status !== 0 && xx.length > 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + xx[0].trim().slice(0, 150) : 'NOT caught (exit ' + r.status + ')'));
  } finally { fs.copyFileSync(bak, f); fs.unlinkSync(bak); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught' + (unanchored ? ', ' + unanchored + ' unanchored' : ''));
process.exitCode = good === ran && !unanchored ? 0 : 1;
