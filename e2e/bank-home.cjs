/* bank-home.cjs — THE BANK HOME (l16, W15-84; app/cap-bank-home.js). Pattern: bank-statements-box.cjs (Playwright, a stand-in API answering inside the page, a free port; nothing leaves the machine).
 *  1  the menu's Bank lands on the home: the account × month grid (Aug ✓ signed off, Sep ● not signed off, the rest Missing) and a card "September 2026 · Not signed off yet · Continue"
 *  2  a month pressed opens its lines; the trail reads "← Bank › account › September 2026"; Back (button) returns to the home; the browser's Back does the same, Forward opens the lines again
 *  3  the menu's Bank from the lines lands on the home (never the last statement); no Add statement toggle over the lines
 *  4  keyboard only (focus the month, Enter, Back, Enter); 1366×768 and 390×844 need no page scroll
 * OUT=<dir> says where the shots go. */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public'), SHOTS = process.env.OUT || path.join(__dirname, "shots");
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const books = require('./lib/books-api.cjs');
const json = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
const tok = (c) => { const e = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return e({ alg: 'none' }) + '.' + e(Object.assign({ exp: Math.floor(Date.now() / 1000) + 86400 }, c)); };
const OWNER = { token: tok({ identity_id: 'ent-M', identity_type: 'entity' }), role: 'entity', name: 'Mayur', entity: 'Mayur Bhavan' };

const SEP = [
  'Account No: 50100123456789',
  'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
  '01/09/26,UPI-RAVI STORES-ravi@okbank-ZZMARKER7731,UPI0001,01/09/26,,12000.00,112000.00',
  '05/09/26,CHQ PAID-0001234-KV TRADERS,0001234,05/09/26,5000.00,,107000.00',
  '25/09/26,NEFT-UNKNOWN PARTY XYZ,N123456,25/09/26,,3500.00,109016.40'
].join('\n');
/** a second file whose dates cross the first (20 Sep to 10 Oct) */
const CROSS = [
  'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
  '20/09/26,CHQ PAID-0009999-SOME PAYEE,0009999,20/09/26,100.00,,100.00',
  '10/10/26,SMS ALERT CHARGES,,10/10/26,23.60,,76.40'
].join('\n');
const ACCOUNTS = [
  { code: 'G-BANK', name: 'Bank accounts', is_group: true, role: null, parent_code: null },
  { code: '1500', name: 'Bank', is_group: false, role: 'bank', parent_code: 'G-BANK', active: true }
];
const sha = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const monthsEnding = (end, count) => { const out = []; let y = Number(end.slice(0, 4)), m = Number(end.slice(5, 7)); for (let n = 0; n < count; n++) { out.unshift(y + '-' + String(m).padStart(2, '0')); m -= 1; if (m === 0) { m = 12; y -= 1; } } return out; };
const lastDay = (month) => month + '-' + String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0');

/** the box's stand-in: what the api answers, in its shapes (lib/bank-statement-file.js) */
function stand() {
  const S = { reqs: [], posts: [], reads: [], files: [], pending: false, ledgerCalls: [], signed: [] };
  S.list = (query) => {
    const months = monthsEnding(query.get('to') || '2026-11', Number(query.get('months') || 6));
    const account = { account_id: 'acc-1500', code: '1500', name: 'Bank', label: null };
    const cells = months.map((month) => { const here = S.files.filter((f) => f.period_from <= lastDay(month) && f.period_to >= month + '-01'); return { account_id: 'acc-1500', month, missing: !here.length, file_ids: here.map((f) => f.id) }; });
    return { currency: 'INR', months, accounts: [account], cells, files: S.files.map((f) => Object.assign({}, f, { text: undefined, sha: undefined })), older: 0 };
  };
  return S;
}
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if (((!f.startsWith(PUB)) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const threw = [];

  async function open(S) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-AU', timezoneId: 'Australia/Sydney', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    ctx.on('request', (rq) => { S.reqs.push({ m: rq.method(), u: rq.url(), h: rq.headers(), d: rq.postData() || '' }); });
    await ctx.route('**/api/**', (r) => {
      const u = new URL(r.request().url()), p = u.pathname, m = r.request().method();
      if (p === '/api/entities/me') return json(r, 200, { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR', ledger_on: true } });
      if (p === '/api/books/health') return json(r, 200, books.health());
      if (p === '/api/books/todo') return json(r, 200, []);
      if (p === '/api/books/accounts') return json(r, 200, { accounts: ACCOUNTS.map((a) => Object.assign({ account_id: 'acc-' + a.code, tally_group: 'Group', nature: 'asset', active: true }, a)) });
      if (p === '/api/books/dues') return json(r, 200, books.dues([]));
      if (p === '/api/books/bank/log') return json(r, 200, { currency: 'INR', account: { account_id: 'acc-1500', code: '1500', name: 'Bank' }, marks: [], statements: S.signed, posted: [], exceptions: [] });
      if (p === '/api/books/bank/rail') return json(r, 200, { currency: 'INR', from: u.searchParams.get('from'), to: u.searchParams.get('to'), me: 'Mayur Bhavan', books: { parties: [], open_items: [] }, rail_chits: [], parties: [], may: { ask: { ok: true } } });
      if (p === '/api/books/ledger/1500') { S.ledgerCalls.push(u.search); return json(r, 200, books.ledger('1500', 'Bank', [], { from: u.searchParams.get('from'), to: u.searchParams.get('to'), opening_minor: 10000000, closing_minor: 10000000 })); }
      if (p === '/api/books/events' && m === 'GET') return json(r, 200, books.eventsAnswer({ events: [], picks: {} }));
      if (p === '/api/books/bank/statement-files' && S.pending) return json(r, 503, { code: 'BOOKS_NOT_MIGRATED', error: 'The statements box arrives after the next update.', message: 'The statements box arrives after the next update.', detail: 'The statements box arrives after the next update.' });
      if (p === '/api/books/bank/statement-files' && m === 'GET') return json(r, 200, S.list(u.searchParams));
      if (p === '/api/books/bank/statement-files' && m === 'POST') {
        const body = r.request().postDataJSON(); S.posts.push(body);
        const same = S.files.find((f) => f.sha === body.sha256);
        if (same) return json(r, 409, { code: 'ALREADY_IN_BOX', error: 'Already in the box: this file is kept for 1 Sep 2026 to 25 Sep 2026.', message: 'Already in the box: this file is kept for 1 Sep 2026 to 25 Sep 2026.', detail: 'Already in the box: this file is kept for 1 Sep 2026 to 25 Sep 2026.' });
        const crossed = S.files.filter((f) => f.period_from <= body.period_to && f.period_to >= body.period_from);
        const file = { id: 'f' + (S.files.length + 1), account_id: 'acc-1500', label: body.label || null, period_from: body.period_from, period_to: body.period_to, currency: body.currency, name: body.name, size: body.text.length, mime: 'text/csv', kind: 'bank_statement', source: 'owner', overlaps: crossed.length > 0, by_name: 'Mayur', by_firm: null, for_client: false, added_at: new Date().toISOString(), read_at: null, reads: 0, text: body.text, sha: body.sha256 };
        S.files.push(file);
        return json(r, 201, { file: Object.assign({}, file, { text: undefined, sha: undefined }), overlaps: crossed.map((f) => ({ id: f.id, name: f.name, period_from: f.period_from, period_to: f.period_to })), words: crossed.length ? 'Kept. It overlaps 1 other statement of this account (1 Sep 2026 to 25 Sep 2026). Both are shown.' : 'Kept.' });
      }
      const file = /^\/api\/books\/bank\/statement-files\/([^/]+)\/file$/.exec(p);
      if (file) { const found = S.files.find((f) => f.id === file[1]); S.reads.push({ id: file[1], use: u.searchParams.get('use'), h: r.request().headers() }); return found ? r.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream', 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store' }, body: found.text }) : json(r, 404, { code: 'NOT_FOUND', error: 'Not found', message: 'No such statement in this shop.' }); }
      return json(r, 200, {});
    });
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, OWNER);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { threw.push(e.message); if (process.env.DEBUG_PE) console.log('  !! pageerror: ' + e.message); });
    await p.goto(base + '/accounts.html#bank');
    await p.waitForSelector('[data-testid="bank-file"]', { timeout: 15000, state: 'attached' });
    return { ctx, p };
  }
  const SEPAUG = SEP.replace(/\/09\/26/g, '/08/26').replace('25/08/26', '29/08/26');
  const row = (id, from, to, name, text) => ({ id, account_id: 'acc-1500', label: null, period_from: from, period_to: to, currency: 'INR', name, size: text.length, mime: 'text/csv', kind: 'bank_statement', source: 'owner', overlaps: false, by_name: 'Mayur', by_firm: null, for_client: false, added_at: to + 'T00:00:00Z', read_at: null, reads: 0, text, sha: sha(text) });
  const S = stand();
  S.signed = [{ period_from: '2026-08-01', period_to: '2026-08-29', at: '2026-09-02T01:00:00Z', by_name: 'Mayur', difference_minor: 0, tied: true, currency: 'INR' }];
  S.files.push(row('f1', '2026-08-01', '2026-08-29', 'aug.csv', SEPAUG), row('f2', '2026-09-01', '2026-09-25', 'sep.csv', SEP));
  const { ctx, p } = await open(S);
  const shot = (name) => p.screenshot({ path: path.join(SHOTS, name) });
  const fits = () => p.evaluate(() => document.querySelector('.main').scrollHeight <= document.querySelector('.main').clientHeight + 2 && document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  const text = (sel) => p.textContent(sel);
  const trail = '[data-testid="bank-home-trail"]', grid = '[data-testid="bank-stmts-grid"]', lines = '[data-testid="bank-list"].cbl [data-status]', sepCell = '[data-testid="bank-home-month-acc-1500-2026-09"]';
  /* 1 */
  await p.waitForSelector(grid, { timeout: 10000 });
  await p.waitForSelector('[data-testid="bank-home-card-acc-1500-2026-09"]');
  ok(/✓/.test(await text('[data-testid="bank-stmts-have-acc-1500-2026-08"]')) && /●/.test(await text('[data-testid="bank-stmts-have-acc-1500-2026-09"]')) && (await p.locator('.bks-miss').count()) === 4, 'home: Aug ✓ signed off, Sep ● not signed off, four months Missing');
  ok(/September 2026/.test(await text('[data-testid="bank-home-cards"]')) && /Continue/.test(await text('[data-testid="bank-home-cards"]')) && (await p.locator('[data-testid="bank-home-card-acc-1500-2026-08"]').count()) === 0, 'one card, for September only, with Continue');
  ok((await p.locator(trail).count()) === 0 && !(await p.locator('[data-testid="bank-form"]').isVisible()), 'the home has no trail and the plain picker form is folded away');
  ok(await fits(), '1366: the home needs no page scroll and nothing scrolls sideways');
  await shot('01-home-1366.png');
  /* 2 */
  await p.click(sepCell);
  await p.waitForSelector(lines, { timeout: 10000 });
  ok(/Bank/.test(await text(trail)) && /September 2026/.test(await text(trail)), 'lines: the trail reads ' + (await text(trail)).replace(/\s+/g, ' ').trim());
  ok(/#bank\/1500\/2026-09/.test(await p.evaluate(() => location.hash)), 'the address names the statement (#bank/1500/2026-09)');
  ok((await p.locator('[data-testid="bank-stmts-toggle"]').count()) === 0, 'no "Add statement" toggle over the lines');
  ok(await fits(), '1366: the lines with the trail need no page scroll');
  console.log('  GEOM ' + JSON.stringify(await p.evaluate(() => ['.content', '#bk_body', '.pe-bank', '#bk_stmts', '.bkh-trail', '#bk_res', '[data-testid="bank-list"]'].map((q) => { const n = document.querySelector(q); if (!n) return q; const r = n.getBoundingClientRect(); return q + ' top ' + Math.round(r.top) + ' h ' + Math.round(r.height) + ' mb ' + getComputedStyle(n).marginBottom + ' pt ' + getComputedStyle(n).paddingTop; }))));
  await shot('02-lines-1366.png');
  await p.click('[data-testid="bank-home-back"]');
  await p.waitForSelector(grid);
  ok(!(await p.evaluate(() => location.hash)).includes('/') && (await p.locator('[data-testid="bank-list"]').count()) === 0, 'Back returns to the home (#bank, no lines)');
  await shot('03-back-home-1366.png');
  await p.click('[data-testid="bank-home-continue"]');
  await p.waitForSelector(lines, { timeout: 10000 });
  await p.goBack();
  await p.waitForSelector(grid);
  ok((await p.locator('[data-testid="bank-list"]').count()) === 0, "the browser's Back does the same (Continue opened the same lines first)");
  await p.goForward();
  await p.waitForSelector(lines, { timeout: 10000 });
  ok((await p.locator(trail).count()) === 1, "the browser's Forward opens the lines again");
  /* 3 */
  await p.click('[data-testid="acc-nav-bank"]');
  await p.waitForSelector(grid, { timeout: 10000 });
  ok((await p.locator('[data-testid="bank-list"]').count()) === 0 && (await p.locator(trail).count()) === 0, 'menu Bank from the lines lands on the home, not on the last statement');
  await shot('04-menu-bank-home-1366.png');
  /* 4 · keyboard only */
  await p.focus(sepCell);
  await p.keyboard.press('Enter');
  await p.waitForSelector('[data-testid="bank-home-back"]', { timeout: 10000 });
  await p.focus('[data-testid="bank-home-back"]');
  ok((await p.evaluate(() => document.activeElement.getAttribute('data-testid'))) === 'bank-home-back', 'keyboard: the Back control takes focus');
  await p.keyboard.press('Enter');
  await p.waitForSelector(grid);
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => /bkh-cell|bkh-go|bks-tog/.test(document.activeElement.className)), "keyboard: after Back focus lands on the home's first press");
  /* 4b · a reload or a bookmark on #bank/<account>/<month> reopens that statement (the router read the whole hash as a page name and fell to To do) */
  await p.goto(base + '/accounts.html#bank/1500/2026-09');
  await p.waitForSelector(lines, { timeout: 15000 });
  ok(/September 2026/.test(await text(trail)) && /#bank\/1500\/2026-09/.test(await p.evaluate(() => location.hash)), 'a reload on #bank/1500/2026-09 reopens that account and month, not To do');
  await p.goto(base + '/accounts.html#bank/1500/2026-01');
  await p.waitForSelector(grid, { timeout: 15000 });
  ok((await p.locator(lines).count()) === 0 && /^#bank/.test(await p.evaluate(() => location.hash)), 'a month with no statement kept lands on the Bank home');
  /* 4c · Enter on Add statement keeps the keyboard on that button, opening the box or closing it */
  const tog = '[data-testid="bank-stmts-toggle"]', focusedTog = () => p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid'));
  await p.focus(tog);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  ok((await focusedTog()) === 'bank-stmts-toggle', 'Enter on Add statement: focus stays on Add statement (' + (await focusedTog()) + ')');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  ok((await focusedTog()) === 'bank-stmts-toggle', 'Enter again, to close the open box: focus stays on the button (' + (await focusedTog()) + ')');
  /* 5 · phone */
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  ok(await fits(), '390: the home needs no page scroll and nothing scrolls sideways');
  await shot('05-home-390.png');
  await p.click(sepCell);
  await p.waitForSelector(trail, { timeout: 10000 }); await p.waitForTimeout(500);
  ok(await fits(), '390: the lines with the trail: no page scroll, nothing sideways');
  await shot('06-lines-390.png');
  await p.click('[data-testid="bank-home-back"]');
  await p.waitForSelector(grid);
  await shot('07-back-home-390.png');
  ok(threw.length === 0, 'no page error' + (threw.length ? ': ' + threw[0] : ''));
  await b.close(); srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
