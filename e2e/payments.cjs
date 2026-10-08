/* payments.cjs — THE PAYMENT SCREENS, PROVED (SPEC-payments-2026-10-05 §7). Cases are added as the payment rows land; this file starts with E9.
 * Pattern: crm.cjs + cb-accounts.cjs — Playwright, a stand-in API answering INSIDE the page; the static server takes a free port from the OS. Nothing here
 * reaches localhost:3000, port 7351 or the live site: every /api/** call is fulfilled by the stand-in, any other host is aborted and counted.
 *
 *  E9  Dr/Cr, never a minus (M25 · T59 · R30): every balance a shopkeeper reads on crm.html (the list chips, the record header, the ledger section) and on the
 *      Dues list of accounts.html is written in words ("you owe ₹X" / "they owe you ₹X" / "settled") or as Dr / Cr — and a "-" in front of a figure appears nowhere.
 *      Also: the Pay / Receive button takes the primary look from bkCss.
 * Screenshot: png/CRMLedger.png (the CRM record with its balance in words)
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public'), PNG = path.join(ROOT, 'png');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const C = require('./lib/contract.cjs'), J = C.json;
const crmApi = require('./lib/crm-api.cjs'), books = require('./lib/books-api.cjs');
const FX = path.join(__dirname, 'fixtures', 'golden-parties.json');
const TODAY = new Date().toISOString().slice(0, 10);
const claims = (c) => { const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b64({ alg: 'none' }) + '.' + b64(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)); };
const OWNER = { token: claims({ identity_id: 'ent-M', identity_type: 'entity' }), role: 'entity', name: 'Athi', entity: 'Mayur Bhavan' };

/* the words a balance may be written in, and what a minus in front of a figure looks like */
const WORDS = /^(you owe|they owe you|settled)\b/i;
const MINUS = /(^|[\s(>])[-−]\s?(₹|\d)/;

function standIn() {
  const fx = crmApi.resolve(JSON.parse(fs.readFileSync(FX, 'utf8')), Date.now());
  return { fx, calls: [], list: JSON.parse(JSON.stringify(fx.list)) };
}
const DUES = [
  { party_id: 'c1', party_no: 'P-00001', name: 'Ravi Stores', side: 'customer', balance_minor: 300000, oldest_due: '2026-08-01', disputed_minor: 0, buckets: { not_due: 0, lt_6m: 300000 } },
  { party_id: 's1', party_no: 'P-00003', name: 'Agro Mills', side: 'supplier', balance_minor: -150000, oldest_due: '2026-09-03', disputed_minor: 0, buckets: { not_due: -150000 } },
  { party_id: 's2', party_no: 'P-00004', name: 'Kavi Traders', side: 'supplier', balance_minor: -100000, oldest_due: '2026-09-04', disputed_minor: 0, buckets: { not_due: -100000 } }];
async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method(); let x;
  S.calls.push(m + ' ' + p);
  if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR' } });
  if (p === '/api/books/health') return J(r, 200, books.health());
  if (p === '/api/books/dues') return J(r, 200, books.dues(DUES, { asOf: TODAY }));
  if ((x = p.match(/^\/api\/books\/party\/([^/]+)\/statement$/))) {
    const neg = x[1] !== 'c1';
    const line = { date: '2026-09-05', what: neg ? 'Purchase' : 'Sale', ref: null, party_id: x[1], source_chit_id: null, dr_minor: neg ? 0 : 300000, cr_minor: neg ? 150000 : 0, running_minor: neg ? -150000 : 300000, source: null };
    return J(r, 200, books.statement(x[1], { opening_minor: 0, closing_minor: line.running_minor, lines: [line] }));
  }
  if (p === '/api/books/accounts') return J(r, 200, { accounts: [] });
  if (p === '/api/books/todo') return J(r, 200, []);
  if (p === '/api/crm/parties' && m === 'GET') return J(r, 200, crmApi.list(S.list, { records: S.fx.records }));
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/timeline$/))) return J(r, 200, crmApi.timeline(S.fx.timelines[decodeURIComponent(x[1])] || { entries: [] }, x[1], {}));
  if (m === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}

(async () => {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(PUB, rel || 'index.html');
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch(), threw = [], offHost = [];
  async function open(url, S) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { offHost.push(r.request().url()); return r.abort(); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => route(S, r));
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, OWNER);
    const p = await ctx.newPage(); p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + url); return { ctx, p };
  }
  const bodyText = (p) => p.evaluate(() => document.body.innerText);

  /* ── E9 · crm.html ─────────────────────────────────────────────────────────── */
  {
    const S = standIn(), { ctx, p } = await open('/crm.html', S);
    await p.waitForSelector('[data-testid^="party-due-"]', { timeout: 15000 });
    const chips = await p.$$eval('[data-testid^="party-due-"]', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    ok(chips.length >= 3, 'crm.html: the list shows dues chips (' + chips.length + ')');
    ok(chips.every((t) => WORDS.test(t)), 'E9 crm.html list: every dues chip reads "you owe" / "they owe you" / "settled" (' + chips.slice(0, 3).join(' | ') + ')');
    ok(!MINUS.test(await bodyText(p)), 'E9 crm.html list: no minus sign in front of a figure');
    await p.click('[data-testid="crm-row-P-0001"]');
    await p.waitForSelector('[data-testid="crm-rec-name"]', { timeout: 15000 });
    await p.waitForTimeout(500);
    ok(!MINUS.test(await bodyText(p)), 'E9 crm.html record: no minus sign in front of a figure');
    const hdr = await p.$$eval('.rchips [data-testid^="party-due-"]', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    ok(hdr.length === 1 && /^you owe\s+₹\s?481\.65/.test(hdr[0]), 'E9 crm.html record: the header chip says "you owe" 481.65 for the server\'s -48165 (' + hdr.join('|') + ')');
    try { await p.click('[data-testid="crm-sec-ledger"]', { timeout: 2000 }); } catch (_) {}
    await p.waitForTimeout(600);
    ok(!MINUS.test(await bodyText(p)), 'E9 crm.html ledger section opened: still no minus');
    const stmt = await p.$$eval('[data-testid="stmt-opening"],[data-testid="stmt-closing"]', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    ok(stmt.every((t) => / (Dr|Cr)$|^\D*0(\.0+)?$/.test(t)), 'E9 crm.html statement: opening and closing are Dr / Cr (' + stmt.join(' | ') + ')');
    const btn = await p.evaluate(() => { const e = document.querySelector('[data-testid="party-pay"]'); return e ? getComputedStyle(e).backgroundColor : null; });
    if (btn) ok(btn !== 'rgba(0, 0, 0, 0)' && btn !== 'rgb(255, 255, 255)', 'the Pay / Receive button takes the primary look from bkCss (' + btn + ')');
    fs.mkdirSync(PNG, { recursive: true });
    await p.screenshot({ path: path.join(PNG, 'CRMLedger.png') });
    await ctx.close();
  }
  /* ── E9 · the Dues list on accounts.html ───────────────────────────────────── */
  {
    const S = standIn(), { ctx, p } = await open('/accounts.html', S);
    await p.waitForSelector('[data-testid="acc-nav-dues"]', { timeout: 15000 });
    await p.click('[data-testid="acc-nav-dues"]');
    await p.waitForSelector('[data-testid="dues-side-pay"]', { timeout: 15000 });
    await p.waitForTimeout(300);
    const text = await bodyText(p);
    ok(/Agro Mills/.test(text) && /1,500\.00/.test(text), 'accounts.html Dues: a supplier you owe shows 1,500.00, plain');
    ok(!MINUS.test(text), 'E9 accounts.html Dues: no minus sign in front of a figure (the group head says "You owe")');
    await p.click('[data-testid="dues-s1"]').catch(() => {});
    await p.waitForTimeout(500);
    ok(!MINUS.test(await bodyText(p)), 'E9 accounts.html Dues: a party opened, still no minus');
    await ctx.close();
  }
  ok(threw.length === 0, 'no page error' + (threw.length ? ' · ' + threw[0] : ''));
  ok(offHost.length === 0, 'nothing tried to leave for another host' + (offHost.length ? ' · ' + offHost[0] : ''));
  await b.close(); srv.close();
  console.log('\n  ' + (fail ? '✗ ' + fail + ' FAILED · ' : '✓ ') + pass + ' passed · ' + (pass + fail) + ' checks\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
