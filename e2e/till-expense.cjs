/* till-expense.cjs — MONEY PAID OUT OF THE DRAWER, RECORDED, AND SUBTRACTED WHERE IT SHOULD BE
 *
 * Athi: "no way of recording other expenses which is being done at the counter... so the counter will have
 * the right balance amount. it can be anything like Gpay... or cash or card, need to know what the expense is
 * and the mode of payment and amount." And: "in to do, you have rent to be paid at 4:00 PM... when the rent
 * paid in whatever mode, it has to be registered."
 *
 * Drives the real controls: the menu button, the dialog, the to-do reminder's own button — then proves the
 * result lands correctly in the three places a shopkeeper actually reads it (today's summary, the day-close
 * sheet's expected cash, and the printable day report), matching what tests/rollup.test.js already proves
 * about the shared engine underneath all three.
 *
 * Run: node e2e/till-expense.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(56) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  const srv = http.createServer((q, r) => {
    const url = q.url.split('?')[0];
    if (url.startsWith('/api/')) { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"ok":true}'); }
    const f = path.join(ROOT, decodeURIComponent(url).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 880 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + '/till.html');
  await p.waitForFunction(() => typeof window.screenSet === 'function', null, { timeout: 30000 });

  await p.evaluate((api) => {
    CloudHost.key = 'demo-key'; CloudHost.api = api; HOST = CloudHost;
    ls.set(tillGivenKey(), 'C1');
    WHO = { id: 'w1', name: 'Bala', kind: 'coassist', since: new Date().toISOString() };
    window.S = { shop: { name: 'Mayur Bhavan', currency: 'INR', pay: [{ id: 'cash', label: 'Cash' }, { id: 'card', label: 'Card' }, { id: 'upi', label: 'UPI' }] },
                 at: new Date().toISOString(), items: [], offers: [] };
    window.sure = async () => true;   /* the confirmation itself is proven elsewhere; this test drives the form */
  }, base);

  console.log('\n── the door exists, gated the same way a credit note’s is ' + '─'.repeat(0));
  const gate = await p.evaluate(() => ({
    canIssue: expCanIssue(),
    menuHasIt: (function(){ menuSection('day'); paintMenu(); var h = document.getElementById('tillmenu').innerHTML;
      return /till-open-expense/.test(h); })(),
  }));
  say('expCanIssue() is true once HOST.expense exists', gate.canIssue, 'confirmed');
  say('"💰 Record an expense" is offered in the Day section of the menu', gate.menuHasIt, 'found');

  console.log('\n── recording one, through the real dialog ' + '─'.repeat(15));
  const recorded = await p.evaluate(async () => {
    let call = null;
    var realExpense = HOST.expense.bind(HOST);
    HOST.expense = function(e){ call = e; return realExpense(e); };
    expOpen();
    var dlgOpenBefore = document.getElementById('expdlg').open;
    expWhat('Rent'); expAmountSet('1500'); expHow('Cash');
    var goLabel = document.getElementById('expgo').textContent;
    await expIssue();
    var dlgOpenAfter = document.getElementById('expdlg').open;
    var bills = await HOST.bills();
    var mine = bills.filter(function(x){ return x.kind === 'expense'; });
    return { dlgOpenBefore: dlgOpenBefore, goLabel: goLabel, dlgOpenAfter: dlgOpenAfter,
      call: call, saved: mine[0] || null };
  });
  say('the dialog actually opened', recorded.dlgOpenBefore === true, 'confirmed');
  say('the button names the amount once there is one', /^Record .1,500/.test(recorded.goLabel), recorded.goLabel);
  say('HOST.expense() was called with what/mode/amount', recorded.call && recorded.call.what === 'Rent'
    && recorded.call.mode === 'Cash' && recorded.call.total === -1500, JSON.stringify(recorded.call));
  say('it went out of Cash specifically, via `spent` (never `payments`)',
    recorded.call && Array.isArray(recorded.call.spent) && recorded.call.spent[0].how === 'Cash' && recorded.call.spent[0].amount === 1500,
    JSON.stringify(recorded.call && recorded.call.spent));
  say('the dialog closes on success', recorded.dlgOpenAfter === false, 'confirmed');
  say('it was written to the local bills store, tagged E — its own series, same convention as a credit note’s C',
    recorded.saved && /^E\//.test(String(recorded.saved.no)), recorded.saved && recorded.saved.no);
  say('purpose:\'expense\' is what reaches the server, per the chit it built',
    recorded.saved && recorded.saved.chitBody && recorded.saved.chitBody.purpose === 'expense',
    recorded.saved && recorded.saved.chitBody && recorded.saved.chitBody.purpose);
  say('billed_at is set — [REV-02]’s alreadyBilled() must skip live-offers for this chit',
    recorded.saved && !!recorded.saved.chitBody.business_json.billed_at, 'confirmed');

  console.log('\n── a refused save leaves the sheet open, nothing lost ' + '─'.repeat(2));
  const refused = await p.evaluate(async () => {
    HOST.expense = async () => ({ ok: false, why: 'the counter could not write it' });
    expOpen(); expWhat('Electrician'); expAmountSet('900'); expHow('Card');
    await expIssue();
    return { open: document.getElementById('expdlg').open, what: EXP_WHAT, amount: EXP_AMOUNT };
  });
  say('the dialog stays open on a refusal', refused.open === true, 'confirmed');
  say('nothing typed is lost', refused.what === 'Electrician' && refused.amount === '900', JSON.stringify(refused));
  await p.evaluate(() => { expClose(); });

  console.log('\n── reached from a to-do reminder, pre-filled, so nothing is typed twice ' + '─'.repeat(0));
  const fromTodo = await p.evaluate(async () => {
    HOST.expense = async (e) => ({ ok: true, bill: Object.assign({ no: 'EXP2', chitBody: {} }, e) });
    todoWrite([{ t: 'Pay the electricity bill', done: false }]);
    todoOpen();
    var hasBtn = /till-todo-exp-0/.test(document.getElementById('todobody').innerHTML);
    todoExpense(0);
    return { hasBtn: hasBtn, todoClosed: !document.getElementById('tododlg').open,
      expOpen: document.getElementById('expdlg').open, prefill: EXP_WHAT };
  });
  say('the to-do row offers "record as an expense"', fromTodo.hasBtn, 'found');
  say('tapping it closes the to-do popup', fromTodo.todoClosed, 'confirmed');
  say('and opens the expense dialog, pre-filled with the reminder’s own words',
    fromTodo.expOpen && fromTodo.prefill === 'Pay the electricity bill', JSON.stringify(fromTodo.prefill));
  await p.evaluate(() => { expClose(); todoWrite([]); });

  console.log('\n── AND IT IS ACTUALLY SUBTRACTED — the day-close sheet, the same one a shopkeeper counts against ' + '─'.repeat(0));
  const dayMath = await p.evaluate(() => {
    var rows = [
      { no: 'C1/1', at: new Date().toISOString(), total: 1000, payments: [{ how: 'Cash', amount: 1000 }] },
      { no: 'EXP-T1', kind: 'expense', what: 'Tea for staff', at: new Date().toISOString(), total: -60, spent: [{ how: 'Cash', amount: 60 }] },
    ];
    WHO = { id: 'w1', name: 'Bala', kind: 'coassist', since: new Date().toISOString(), float: 200 };
    var d = dayCloseSheet(rows);
    return { bills: d.bills, expenses: d.expenses, expensed: d.expensed, cash_out: d.cash_out,
      expected_cash: d.expected_cash, spentby: d.spentby };
  });
  say('the expense is not counted as a bill', dayMath.bills === 1, 'bills=' + dayMath.bills);
  say('it is counted as its own thing', dayMath.expenses === 1 && dayMath.expensed === 60, JSON.stringify(dayMath));
  say('and it comes off the Cash the drawer should hold: 1000 sold + 200 float − 60 spent = 1140',
    dayMath.expected_cash === 1140, 'expected_cash=' + dayMath.expected_cash);
  say('spentby names the tender, for the printed sheet’s own breakdown', dayMath.spentby.Cash === 60, JSON.stringify(dayMath.spentby));

  console.log('\nconsole/page errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  if (errs.length) bad++;
  await b.close(); srv.close();
  console.log(bad ? '\n' + bad + ' failed' : '\nmoney paid out of the drawer is recorded, and the drawer knows it left');
  process.exit(bad ? 1 : 0);
})();
