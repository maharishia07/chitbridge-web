/* chit-sheet-breaks.cjs — break each chit-sheet guard once, run e2e/chit-sheet.cjs against a COPY of public/, throw the copy away.
 * Nothing in the working tree is ever edited (never git checkout to restore). Each break must make the harness exit non-zero with an XX line. */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const W = path.join(__dirname, '..');
const SHEET = 'app/chit-sheet.js', BOOKS = 'app/cap-books.js', APP = 'app.html', ACCOUNTS = 'accounts.html';
const BREAKS = [
  ['Dispute offered on a cart bill', SHEET, `if (m.counterBill) { a.push('print'); if (!dead) a.push('return'); }`, `if (m.counterBill) { a.push('print'); a.push('dispute'); if (!dead) a.push('return'); }`],
  ['Accept offered on a cart bill', SHEET, `if (m.counterBill) { a.push('print');`, `if (m.counterBill) { a.push('accept'); a.push('print');`],
  ['supplier bill loses Goods in', SHEET, `if (open) { a.push('accept'); a.push('dispute'); a.push('goodsin'); }`, `if (open) { a.push('accept'); a.push('dispute'); }`],
  ['accepted bill still offers Accept', SHEET, `else if (!dead) a.push('dispute');\n    } else {`, `else if (!dead) { a.push('accept'); a.push('dispute'); }\n    } else {`],
  ['navigation instead of the sheet', BOOKS, `onclick="event.stopPropagation();openChitSheet(\\''`, `onclick="event.stopPropagation();openChit(\\''`],
  ['Waiting row navigates', BOOKS, `(w.chit_id ? ' style="cursor:pointer" onclick="openChitSheet(`, `(w.chit_id ? ' style="cursor:pointer" onclick="openChit(`],
  /* ── web-reads-invoice (2026-10-02): the four breaks the task names, and the guards around them ── */
  ['hand arithmetic back: a hand-halved CGST', SHEET, `E(money(inter ? v.igst : v.cgst, m.cur))`, `E(money(inter ? v.igst : Math.round(Number(v.tax) * 50) / 100, m.cur))`],
  ['hand arithmetic back: SGST worked out as tax − half', SHEET, `(inter ? '' : E(money(v.sgst, m.cur)))`, `(inter ? '' : E(money(Math.round((Number(v.tax) - Math.round(Number(v.tax) * 50) / 100) * 100) / 100, m.cur)))`],
  ['hand arithmetic back: the total summed from the lines', SHEET, `var mo = m.money || {}, t = mo.total;`, `var mo = m.money || {}, t = m.lines.reduce(function (a, l) { return a + Number(l.total || 0); }, 0);`],
  ['the frozen invoice ignored (the header read instead)', SHEET, `if (bj && bj.invoice && root.CBTax && root.CBTax.moneyOf) return`, `if (false) return`],
  ['line totals from the chit lines, not the invoice', SHEET, `money(f ? f.total : (l.total != null ? l.total : l.net), m.cur)`, `money(l.total != null ? l.total : l.net, m.cur)`],
  ['an invented total when none is recorded', SHEET, `E(t == null ? T('not recorded') : money(t, m.cur))`, `E(t == null ? money(0, m.cur) : money(t, m.cur))`],
  ['Accept without the choice', SHEET, `if (m.billRx) { CS.useAsk = true; CS.note = null; return paint(); } return move('act'); }`, `return move('act'); }`],
  ['Accept: the status first, the use after', SHEET, `if (use && to === 'act' && m.billRx) await api('billUse', { params: { id: id }, body: { use: use } });\n      var word`, `var word`],
  ['the step read from the shared status', SHEET, `status: billRx ? billStepStatus(log) : String(h.current_status || h.status || 'pending')`, `status: String(h.current_status || h.status || 'pending')`],
  ['the to-do and Waiting not re-read after Accept', SHEET, `try { if (typeof bkHealthLoad === 'function') bkHealthLoad()`, `try { if (false) bkHealthLoad()`],
  ['the counter named by the till, not the series', SHEET, `counter: counterOfBill(bill, bj.till),`, `counter: bj.till && (bj.till.name || bj.till.id) || '',`],
  ['the ledger route not redirected (#/app/ledger)', APP, `if(SESSION.token && _lg) return ledgerDoorClosed(_lg[1]);`, ``],
  ['a remembered cb_nav of ledger not redirected', APP, `if(SESSION.token && UI.nav==="ledger" && /^#\\/app$|^#\\/?$/.test(h)) return ledgerDoorClosed();`, ``],
  ['navTo("ledger") not redirected', APP, `function navTo(k){if(k==="ledger") return ledgerDoorClosed();`, `function navTo(k){`],
  ['the redirect drops the view', APP, `var v=view||((typeof BK!=="undefined"&&BK&&BK.tab)||"");`, `var v="";`],
  ['no Bills door in the app menu', APP, `["intake","📨","Intake"],["bills","🧾","Bills"],`, `["intake","📨","Intake"],`],
  ['CB Accounts does not load the sheet', ACCOUNTS, `<script src="/app/chit-sheet.js"></script>`, ``],
  ['CB Accounts does not load tax.js', ACCOUNTS, `<script src="/app/tax.js"></script>`, ``],
  ['a Bills row opens a new tab, not the sheet', ACCOUNTS, `if (bill) openChitSheet(bill.dataset.id);`, `if (bill) openChit(bill.dataset.id);`],
  ['Bills shows the handle, not the name', ACCOUNTS, `\${by ? ' · ' + esc(by) : ''}`, `\${b.by ? ' · ' + esc(b.by) : ''}`],
  ['GST rate rows dropped', SHEET, `+ linesHTML(m) + gstHTML(m) + totalHTML(m)`, `+ linesHTML(m) + totalHTML(m)`],
  ['total not shown', SHEET, `+ linesHTML(m) + gstHTML(m) + totalHTML(m) + tenderHTML(m)`, `+ linesHTML(m) + gstHTML(m) + tenderHTML(m)`],
  ['tender not shown', SHEET, `+ linesHTML(m) + gstHTML(m) + totalHTML(m) + tenderHTML(m)`, `+ linesHTML(m) + gstHTML(m) + totalHTML(m)`],
  ['offer not shown', SHEET, `offs.map(function (o) {`, `[].map(function (o) {`],
  ['Accept sends nothing', SHEET, `var sr = await api('status', { params: { id: id }, body: { status: word } });`, `var sr = null;`],
  ['Accept sent twice', SHEET, `var sr = await api('status', { params: { id: id }, body: { status: word } });`, `var sr = await api('status', { params: { id: id }, body: { status: word } }); await api('status', { params: { id: id }, body: { status: word } });`],
  ['sheet not repainted after Accept', SHEET, `      await read(id);\n      /* the Day book's to-do`, `      /* the Day book's to-do`],
  ['Open page does not open the page', SHEET, `if (k === 'page') { close(); if (typeof openChit === 'function') openChit(id); }`, `if (k === 'page') { close(); }`],
  ['Open page keeps the sheet', SHEET, `if (k === 'page') { close(); if`, `if (k === 'page') { if`],
  ['page scrolls behind the sheet / close moves it', SHEET, `d.addEventListener('close', function () { lock(false); CS.id = null; });`, `d.addEventListener('close', function () { lock(false); CS.id = null; window.scrollTo(0, 0); var s = document.querySelector('.bkentry'); if (s && s.scrollIntoView) s.scrollIntoView(); });`],
  ['sheet runs sideways on a phone', SHEET, `width:min(560px,100vw);max-width:100vw;`, `width:600px;max-width:none;`],
  ['to-do goes back to Intake', BOOKS, `(n.accept === 1 && (n.acceptIds || []).length === 1) ? "openChitSheet('" + esc(n.acceptIds[0]) + "')" : "bkTab('waiting')"`, `"navTo('intake')"`],
  ['to-do with several bills goes to Intake', BOOKS, `: "bkTab('waiting')"));`, `: "navTo('intake')"));`],
  ['title back to "Chit"', SHEET, `if (ttl) ttl.textContent = T(m ? titleFor(m) : 'Bill');`, `if (ttl) ttl.textContent = T('Chit');`],
  ['supplier bill titled as a counter bill', SHEET, `if (m.billRx) return 'Supplier bill';`, `if (m.billRx) return 'Bill';`],
  ['tender sum wrong', SHEET, `E(money(x.amount, m.cur)) + '</b></div>';`, `E(money(Number(x.amount) + 1, m.cur)) + '</b></div>';`],
  ['change line dropped', SHEET, `(p.change > 0 ? '<div class="cs-row cs-mute" data-testid="cs-change">`, `(false ? '<div class="cs-row cs-mute" data-testid="cs-change">`],
  ['owner suffix missing', BOOKS, `(bkIsShopName(s.by) ? ' ' + esc(tx('(owner)')) : '')`, `''`],
  ['owner suffix on everyone', BOOKS, `(bkIsShopName(s.by) ? ' ' + esc(tx('(owner)')) : '')`, `' ' + esc(tx('(owner)'))`],
];
const ONLY = process.env.BREAK_ONLY || '';
let good = 0, ran = 0;
for (const [name, rel, a, b] of BREAKS) {
  if (ONLY && name.indexOf(ONLY) < 0) continue;
  ran++;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chs-'));
  try {
    fs.cpSync(path.join(W, 'public'), path.join(tmp, 'public'), { recursive: true });
    /* a CRLF checkout (Windows) must match the same anchors: match on LF text, write back in the file's own endings */
    const f = path.join(tmp, 'public', rel), raw = fs.readFileSync(f, 'utf8'), crlf = raw.indexOf('\r\n') >= 0, s = raw.replace(/\r\n/g, '\n'), n = s.split(a).length - 1;
    if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n); continue; }
    const out = s.split(a).join(b);
    fs.writeFileSync(f, crlf ? out.replace(/\n/g, '\r\n') : out);
    const r = cp.spawnSync(process.execPath, ['e2e/chit-sheet.cjs'], { cwd: W, encoding: 'utf8', timeout: 600000, env: Object.assign({}, process.env, { CHS_ROOT: path.join(tmp, 'public') }) });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+XX/.test(l));
    const caught = r.status !== 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + (xx[0] || (r.stderr || '').split('\n')[0] || 'harness stopped').trim().slice(0, 140) : 'NOT caught'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught');
process.exitCode = good === ran ? 0 : 1;
