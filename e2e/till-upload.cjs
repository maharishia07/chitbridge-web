/* till-upload.cjs — A PRODUCT LIST, READ BEFORE IT BECOMES DATA ([TILL-108])
 *
 * Athi: *"do the upload screen with the preflight report."*
 *
 * ⚠️⚠️ THE REPORT IS THE FEATURE. csv-preflight exists because the old import regex-matched two columns and
 * took every other header verbatim — so `Rate`, `Price (INR)`, `Unit Price` and `price` became four different
 * fields on four different products. A screen that mapped silently would rebuild that bug behind a progress
 * bar, so what is asserted here is mostly what the screen ASKS and what it REFUSES.
 *
 * ⭐ THE FIXTURE IS NOT HAND-WRITTEN. The report injected below is produced by running the real
 * lib/csv-preflight over a real messy sheet, so this harness cannot drift into testing a shape the server
 * stopped returning.
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const SHOTS = process.argv.includes('--shots');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log(String(l).padEnd(28) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

/* ⚠️ a spreadsheet as the world writes one: Tally's words, a rupee prefix, a column we have never heard of,
   and two rows that cannot be sold. */
const SHEET = [
  'Particulars,Rate (INR),UOM,Group,Fridge shelf',
  'Tomato,40,Kg,Vegetables,A1',
  'Onion,Rs 30,kg,Vegetables,A2',
  ',55,kg,Vegetables,A3',          /* no name */
  'Beans,abc,kg,Vegetables,A4',    /* not a number */
].join('\n');

/* the REAL report, from the real module — never a shape invented here */
const PF = require(path.join(__dirname, '..', '..', 'chitbridge-api', 'lib', 'csv-preflight'));
const CSVLIB = require(path.join(__dirname, '..', '..', 'chitbridge-api', 'lib', 'csv'));
function reportFor(text) {
  const parsed = CSVLIB.parseCSV(text);
  const rows = parsed.rows.map((r) => parsed.headers.map((h) => r[h]));
  const template = { columns: ['name', 'price', 'unit', 'category', 'sku'], optional: ['category', 'sku'] };
  return { ok: true, accepted: template.columns, dry_run: true,
    report: PF.preflight({ headers: parsed.headers, rows, template,
      labels: { name: 'Name', price: 'Price', unit: 'Unit', category: 'Category', sku: 'Code' },
      required: ['name', 'price'] }) };
}

(async () => {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, r));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/till.html');
  await p.waitForFunction(() => typeof window.screenSet === 'function', null, { timeout: 30000 });

  const dirty = reportFor(SHEET);
  console.log('  (the real preflight found ' + dirty.report.summary.errors + ' bad rows of '
    + dirty.report.summary.rows + ', and could not place ' + (dirty.report.unmatched || []).length + ' column)');

  await p.evaluate(() => {
    window.S = { shop: { name: 'A new shop', currency: 'INR', country: 'IN' }, items: [], offers: [], at: new Date().toISOString() };
    setMode('sell'); applyLook();
  });

  /* ══ the file is read and the report is shown ═════════════════════════════════════════════════════════ */
  console.log('\n── a messy spreadsheet ' + '─'.repeat(38));
  const shown = await p.evaluate(async ({ text, rep }) => {
    window.HOST.tillPost = async (pathname, body) => {
      window.__sent = { pathname, body };
      return pathname.indexOf('preflight') >= 0 ? rep : { ok: true, message: '2 products added' };
    };
    await upRead(new File([text], 'shop.csv', { type: 'text/csv' }));
    const sels = [...document.querySelectorAll('#upbody select')].map((s) => ({
      inc: s.getAttribute('data-inc'), val: s.value, ask: s.classList.contains('ask') }));
    return {
      open: document.getElementById('updlg').open,
      head: (document.querySelector('[data-testid="till-upload-head"]') || { innerText: '' }).innerText,
      sels,
      rows: (document.querySelector('[data-testid="till-upload-rows"]') || { innerText: '' }).innerText,
      go: document.getElementById('upgo').disabled,
      sayText: document.getElementById('upsay').innerText,
      sentTo: (window.__sent || {}).pathname,
    };
  }, { text: SHEET, rep: dirty });

  say('it reads the file', shown.open && shown.sentTo === '/api/products/import/preflight',
    'sent to ' + shown.sentTo);
  /* ⭐ the headline is what will HAPPEN, not a status code */
  say('the headline is plain', /2 of 4 rows can be added/.test(shown.head.replace(/\s+/g, ' ')),
    '"' + shown.head.replace(/\s+/g, ' ') + '"');

  /* ⚠️⚠️ THE MAPPING IS SHOWN IN FULL, including the confident ones — hiding those is how a wrong confident
     match goes unnoticed, which is the bug csv-preflight was written for. */
  const byInc = {};
  shown.sels.forEach((s) => { byInc[s.inc] = s; });
  say('every column is shown', shown.sels.length === 5, shown.sels.map((s) => s.inc + '→' + (s.val || '·')).join('  '));
  say('Tally\'s words are placed', byInc['Particulars'].val === 'name' && byInc['Rate (INR)'].val === 'price'
    && byInc['Group'].val === 'category' && byInc['UOM'].val === 'unit', 'Particulars · Rate (INR) · UOM · Group');
  /* ⭐ AND THE ONE WE CANNOT PLACE IS A QUESTION, not a silent drop */
  say('the unknown one is asked', byInc['Fridge shelf'].val === '' && byInc['Fridge shelf'].ask,
    '"Fridge shelf" is marked for an answer rather than dropped');

  /* ══ and it refuses to import half a file ═════════════════════════════════════════════════════════════ */
  say('bad rows are named', /Row 4/.test(shown.rows) && /Row 5/.test(shown.rows),
    '"' + shown.rows.replace(/\s+/g, ' ').slice(0, 90) + '"');
  /**
   * ⚠️⚠️⚠️ THE WHOLE FILE GOES IN OR NONE OF IT DOES. The route refuses while any row is in error, on purpose —
   * *"rather than importing 'the good ones' and leaving a person to work out which lines are missing."*
   */
  say('it will not add a part', shown.go === true, 'the button is disabled: "' + shown.sayText + '"');

  /* ══ a clean file, and the axiom still gates it ═══════════════════════════════════════════════════════ */
  console.log('\n── a clean spreadsheet ' + '─'.repeat(38));
  const CLEAN = ['Particulars,Rate (INR),UOM,Group', 'Tomato,40,Kg,Vegetables', 'Onion,Rs 30,kg,Vegetables'].join('\n');
  const clean = reportFor(CLEAN);
  const ok2 = await p.evaluate(async ({ text, rep }) => {
    window.HOST.tillPost = async (pathname, body) => {
      window.__sent = { pathname, body };
      return pathname.indexOf('preflight') >= 0 ? rep : { ok: true, message: '2 products added' };
    };
    await upRead(new File([text], 'clean.csv', { type: 'text/csv' }));
    const before = document.getElementById('upgo').disabled;
    /* ⚠️ now take the PRICE away and watch it refuse — the axiom is a gate, not a suggestion */
    const sel = document.querySelector('#upbody select[data-inc="Rate (INR)"]');
    sel.value = ''; upDecide(sel);
    return { before, afterDropPrice: document.getElementById('upgo').disabled,
             said: document.getElementById('upsay').innerText };
  }, { text: CLEAN, rep: clean });
  say('a clean file may go in', ok2.before === false, 'the button is live');
  say('the axiom is a gate', ok2.afterDropPrice === true && /price/i.test(ok2.said),
    'dropping the price column disables it: "' + ok2.said + '"');

  /* ══ what is actually sent ════════════════════════════════════════════════════════════════════════════ */
  console.log('\n── committing ' + '─'.repeat(47));
  const sent = await p.evaluate(async () => {
    const sel = document.querySelector('#upbody select[data-inc="Rate (INR)"]');
    sel.value = 'price'; upDecide(sel);
    await upCommit();
    return { sent: window.__sent, open: document.getElementById('updlg').open };
  });
  const body = (sent.sent || {}).body || {};
  say('it commits to the import', (sent.sent || {}).pathname === '/api/products/import', (sent.sent || {}).pathname);
  /* ⚠️ THE FILE AND THE DECISIONS TRAVEL, never the page's parsed rows — the route re-reads it itself because
     "the client's report is a display artifact and is never trusted". */
  say('it sends the file itself', typeof body.csv === 'string' && body.csv.indexOf('Particulars') === 0,
    'the raw csv, so the server re-reads it');
  say('and a decision per column', Array.isArray(body.decisions) && body.decisions.length === 4
    && body.decisions.every((d) => d.incoming && d.action), JSON.stringify(body.decisions));
  say('no parsed rows are sent', !body.products && !body.rows && !body.items, 'the page never decides what a row means');
  /* ⚠️ the route refuses anything that is not explicitly confirmed */
  say('it is explicitly confirmed', body.confirm === true, 'confirm:true');
  say('the dialog closes', !sent.open, 'the shopkeeper is returned to the counter');

  if (SHOTS) {
    await p.evaluate(async ({ text, rep }) => {
      window.HOST.tillPost = async (pathname) => (pathname.indexOf('preflight') >= 0 ? rep : { ok: true });
      await upRead(new File([text], 'shop.csv', { type: 'text/csv' }));
    }, { text: SHEET, rep: dirty });
    const out = path.join(__dirname, '..', 'png', 'Upload.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await p.screenshot({ path: out });
    console.log('  shot                        · png/Upload.png');
  }

  await b.close(); srv.close();
  console.log(bad ? '\n' + bad + ' failed' : '\nthe file is read, the report is approved, and only then is anything added');
  process.exit(bad ? 1 : 0);
})();
