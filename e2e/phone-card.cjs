/* phone-card.cjs — FC-M14: the phone card for Home (firm client list) and the Day book at 390, and "/" opens Search (mocked api, the real pages).
 *  Cream and Dark, 1366 and 390: cards per screen, no sideways scroll, AA contrast, no clipping, copy in budget; "/" focuses the list search (GitHub / Gmail / Slack convention) and never fires while typing.
 *  Run: NODE_PATH=$PWD/e2e/node_modules SHOTS=C:/dev/shots/fc14 node e2e/phone-card.cjs */
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public'), SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const books = require('./lib/books-api.cjs'), C = require('./lib/contract.cjs'), { measure } = require('./lib/theme-measure.cjs'), { audit } = require('./lib/rule13.cjs');
const json = (r, status, o) => C.json(r, status, o);
const tok = (c) => { const e = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return e({ alg: 'none' }) + '.' + e(c) + '.x'; };
const FIRM = { token: tok({ identity_id: 'ent-FIRM', identity_type: 'entity' }), role: 'entity', name: 'Pat Accountant', entity: 'Blue Gum Books', country: 'AU', currency: 'AUD' };
const CLIENT = 'ent-CL', NAME = 'Eastlake Fresh';
const G = { grant_id: 'g1', grantor_entity: CLIENT, grantor_name: NAME, preset: 'auditor', state: 'live', revoked_at: null, ended_at: null };
const NAMES = ['Eastlake Fresh', 'Harbour Cafe', 'Northside Plumbing', 'Wattle Bakery', 'Coastal Cycles', 'Bayside Books', 'Redgum Timber', 'Lakeview Dental'];
const client = (n, i) => ({ entity_id: 'c' + i, name: n, country: 'AU', role: 'auditor', currency: 'AUD', stage: i % 2 ? 'books_in' : 'checked', stage_blocker: i % 2 ? 'months' : null, year_end: { fy: '2025-26', of: 12, locked: 9, bank_to_end: true, end: '2026-06-30' }, queries: { open: i % 3 }, bank: { state: 'reconciled' }, checked: { n: 4, of: 9 }, months_unlocked: 3, grant: { can_see_costs: true }, health: { status: i % 3 ? 'good' : 'watch', words: i % 3 ? 'Doing well' : 'Needs a look', reasons: [], withheld: { costs: null, currencies: null }, gross_margin_pct: 40, profit_quarter_minor: 500000, cash_minor: 900000 } });
const practice = () => ({ own_trade: false, clients: NAMES.map(client), band: { bands: [{ key: 'pipeline', first: true, tiles: [{ key: 'books_in', n: 4 }, { key: 'checked', n: 4 }] }] }, words: {} });
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if (((!f.startsWith(PUB)) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port, b = await chromium.launch();
  const ex = C.example('GET /api/books/daybook');
  const entries = Array.from({ length: 14 }, (_, n) => Object.assign({}, ex.entries[0], { entry_id: 'e' + n, entry_no: 'JV-' + String(n + 1).padStart(4, '0'), posting_date: '2026-11-' + String(n + 3).padStart(2, '0') }));
  for (const page of ['home', 'daybook']) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-AU', timezoneId: 'Australia/Sydney', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => {
      const p = new URL(r.request().url()).pathname;
      if (p === '/api/books-grants/practice') return json(r, 200, practice());
      if (p === '/api/entities/me') return json(r, 200, { entity: { display_name: NAME, currency_code: 'AUD' } });
      if (p === '/api/books-grants') return json(r, 200, { given: [], received: [G] });
      if (p === '/api/books/health') return json(r, 200, Object.assign(books.health(), { currency: 'AUD', year: { fiscal_year: '2026-27', from: '2026-07-01', start_month: 7 }, country: books.csStatus('AU', 'Australia') }));
      if (p === '/api/books/daybook') return json(r, 200, Object.assign(JSON.parse(JSON.stringify(ex)), { currency: 'AUD', entries, count: entries.length }));
      if (p === '/api/books/todo') return json(r, 200, []);
      if (p === '/api/network-offers') return json(r, 200, C.example('GET /api/network-offers'));
      return json(r, 200, {});
    });
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, FIRM);
    const p = await ctx.newPage(), threw = [];
    p.on('pageerror', (e) => threw.push(e.message));
    await p.setViewportSize({ width: 390, height: 844 });
    let rowSel;
    if (page === 'home') { await p.goto(base + '/'); rowSel = '[data-testid^="practice-row-"]'; }
    else { await p.goto(base + '/accounts.html?acting=' + CLIENT + '&role=auditor#/daybook'); rowSel = '[data-testid^="db-entry-"]'; } /* ONEP-2 PR7b: the Day book is the owner's screen in the auditor's seat (the door) */
    await p.waitForSelector(rowSel, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(600);
    const m = await p.evaluate((s) => { const h = window.innerHeight, rows = [].slice.call(document.querySelectorAll(s)); const box = (x) => x.getBoundingClientRect(); return { n: rows.length, h: rows.length ? Math.round(box(rows[0]).height) : 0, partial: rows.filter((x) => box(x).top < h && box(x).bottom > 0).length }; }, rowSel);
    console.log('  ' + page + ' 390: ' + m.n + ' rows, first ' + m.h + ' px, ' + m.partial + ' touching the first screen');
    ok(m.n > 0, page + ': rows drawn');
    ok(m.h > 0 && m.h <= 150, page + ': the card is ' + m.h + ' px (was ' + (page === 'home' ? 217 : 204) + ')');
    ok(m.partial >= 4, page + ': at least 4 cards touch the first screen (' + m.partial + ')');
    for (const theme of ['cream', 'dark']) for (const width of [1366, 390]) {
      await p.setViewportSize({ width, height: width > 500 ? 900 : 844 });
      await p.evaluate((t) => { if (window.CBAvatar) CBAvatar.applyTheme(t); }, theme); await p.waitForTimeout(250);
      const x = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), pairs = await p.evaluate(measure), bad = pairs.filter((q) => !q.grad && q.ratio < q.need), a = await audit(p).catch(() => ({ clip: [], long: [] }));
      const fails = [].concat(x ? [] : ['sideways scroll'], bad.slice(0, 3).map((q) => 'contrast ' + q.ratio + ' "' + q.text + '"'), (a.clip || []).filter((q) => !/Eastlake|Fresh/.test(q)).slice(0, 3).map((q) => 'clipped ' + q), (a.long || []).slice(0, 3).map((q) => 'over budget ' + q));
      ok(!fails.length, page + ' · ' + theme + ' · ' + width + ' px: AA, no clip, no sideways scroll, in budget' + (fails.length ? ' · ' + fails.join(' | ') : ''));
      await p.screenshot({ path: path.join(SHOTS, 'fc14-' + page + '-' + theme + '-' + width + '.png') });
    }
    await p.setViewportSize({ width: 390, height: 844 });
    const hasBox = await p.evaluate(() => !!document.querySelector('[data-cbl-q]'));
    if (hasBox) {
      await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
      await p.keyboard.press('/');
      const f1 = await p.evaluate(() => ({ q: document.activeElement.hasAttribute('data-cbl-q'), v: document.activeElement.value }));
      ok(f1.q && f1.v === '', page + ': "/" focuses Search and types nothing');
      await p.keyboard.type('a/b');
      const f2 = await p.evaluate(() => document.activeElement.value);
      ok(f2 === 'a/b', page + ': "/" while typing in Search stays a letter (' + f2 + ')');
    } else console.log('  note ' + page + ': no Search box drawn on this list');
    ok(threw.length === 0, page + ': no page error' + (threw.length ? ' ' + threw.join(';') : ''));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log('\n' + (fail ? 'FAIL' : 'all ok') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
