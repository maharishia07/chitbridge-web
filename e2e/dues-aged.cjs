/* dues-aged.cjs — W21: A FIRM'S "WHO OWES WHOM" IS AN AGED TABLE (Current · 1–30 · 31–60 · 61–90 · 90+ days past due, one row per party, a total row), IN THE FIRM'S VOICE.
 *  A firm reads "Customers owe <client>" / "<client> owes suppliers"; the owner's own wording stays "Customers owe you" / "You owe suppliers".
 *  The fixture is hand-computed: Ravi 100.00 (1–30) + 100.00 (31–60) = 200.00 · Mei 100.00 current + 150.00 90+ = 250.00 · Zed 500.00 (61–90) → customers 950.00; supplier Anand 300.00 (90+).
 *  Fits 1366x768 and 390x844 with no sideways scroll. */
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public'), SHOTS = process.env.OUT || path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const books = require('./lib/books-api.cjs');
const json = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
const tok = (c) => { const e = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return e({ alg: 'none' }) + '.' + e(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)); };
const FIRM = { token: tok({ identity_id: 'ent-FIRM', identity_type: 'entity' }), role: 'entity', name: 'Pat Accountant', entity: 'Blue Gum Books', country: 'AU', currency: 'AUD' };
const CLIENT = 'ent-CL', NAME = 'Eastlake Fresh';
const Z = { not_due: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, worst: null, no_terms_minor: 0, terms: 'ok' };
const fu = (o) => Object.assign({}, Z, o);
const party = (id, name, side, balance, f) => ({ party_id: id, name, side, balance_minor: balance, oldest_due: '2026-08-01', disputed_minor: 0, buckets: {}, follow_up: fu(f) });
const DUES = { currency: 'AUD', asOf: '2026-11-16', total_minor: 65000, parties: [
  party('p1', 'Ravi', 'customer', 20000, { d0_30: 10000, d31_60: 10000 }), party('p2', 'Mei', 'customer', 25000, { not_due: 10000, d90_plus: 15000 }), party('p3', 'Zed', 'customer', 50000, { d61_90: 50000 }),
  party('p4', 'Anand', 'supplier', -30000, { d90_plus: 30000 }) ],
  aged_totals: { customer: Object.assign(fu({ not_due: 10000, d0_30: 10000, d31_60: 10000, d61_90: 50000, d90_plus: 15000 }), { balance_minor: 95000 }), supplier: Object.assign(fu({ d90_plus: 30000 }), { balance_minor: -30000 }) } };
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
  const G = { grant_id: 'g1', grantor_entity: CLIENT, grantor_name: NAME, preset: 'auditor', state: 'live', revoked_at: null, ended_at: null };
  async function open(width, height, hash) {
    const ctx = await b.newContext({ viewport: { width, height }, locale: 'en-AU', timezoneId: 'Australia/Sydney', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await ctx.clock.setFixedTime(new Date('2026-11-16T10:00:00+11:00'));
    await ctx.route('**/api/**', (r) => {
      const p = new URL(r.request().url()).pathname;
      if (p === '/api/entities/me') return json(r, 200, { entity: { display_name: NAME, currency_code: 'AUD' } });
      if (p === '/api/books-grants') return json(r, 200, { given: [], received: [G] });
      if (p === '/api/books/health') return json(r, 200, Object.assign(books.health(), { currency: 'AUD', year: { fiscal_year: '2026-27', from: '2026-07-01', start_month: 7 }, country: books.csStatus('AU', 'Australia') }));
      if (p === '/api/books/dues') return json(r, 200, DUES);
      if (p === '/api/books/daybook') return json(r, 200, { entries: [], total: 0 });
      if (p === '/api/books/todo') return json(r, 200, []);
      return json(r, 200, {});
    });
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, FIRM);
    const p = await ctx.newPage(), threw = [];
    p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + '/accounts.html?acting=' + CLIENT + hash);
    await p.waitForSelector('[data-testid="bv-dues-customers"]', { timeout: 20000, state: 'attached' }).catch(() => {});
    await p.waitForTimeout(2000);
    return { ctx, p, threw };
  }
  const text = (p, sel) => p.locator(sel).innerText().then((t) => t.replace(/\s+/g, ' '));
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    const { ctx, p, threw } = await open(w, h, '#/dues');
    const c = await text(p, '[data-testid="bv-dues-customers"]'), s = await text(p, '[data-testid="bv-dues-suppliers"]'), page = await p.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));
    const tag = w + ' · ';
    ok((await text(p, '[data-testid="bv-dues-customers-head"]')) === 'Customers owe ' + NAME, tag + 'firm voice: "Customers owe ' + NAME + '"');
    ok((await text(p, '[data-testid="bv-dues-suppliers-head"]')) === NAME + ' owes suppliers', tag + 'firm voice: "' + NAME + ' owes suppliers"');
    ok(!/Customers owe you|You owe suppliers/.test(page), tag + 'the owner wording is not on a firm page');
    ok(/Ravi/.test(c) && /Mei/.test(c) && /Zed/.test(c), tag + 'one row per customer');
    if (w === 1366) {
      for (const label of ['Current', '1–30', '31–60', '61–90', '90+', 'Total']) ok(c.includes(label), tag + 'column ' + label);
      ok(/Total .*950\.00/.test(c) && /100\.00/.test(c) && /500\.00/.test(c) && /150\.00/.test(c), tag + 'the total row carries the server 950.00, the rows 100.00 · 500.00 · 150.00');
      ok(/Anand .*300\.00/.test(s) && /Total .*300\.00/.test(s), tag + 'supplier row and total, 300.00');
      ok(!/-\s?\$?300|−/.test(s), tag + 'no minus sign on what is owed');
    }
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 0, tag + 'no sideways scroll (' + over + 'px over)');
    ok(threw.length === 0, tag + 'no page error ' + threw.join(';'));
    await p.screenshot({ path: path.join(SHOTS, 'dues-aged-' + w + '.png') });
    await ctx.close();
  }
  { /* the owner's own voice: no client named */
    const { ctx, p } = await open(1366, 768, '#/daybook');
    const v = await p.evaluate(() => window.CBBooksGrantView.duesVoice(''));
    ok(v.customer === 'Customers owe you' && v.supplier === 'You owe suppliers', 'owner voice stays "Customers owe you" / "You owe suppliers"');
    const f = await p.evaluate(() => window.CBBooksGrantView.duesVoice('Acme Ltd'));
    ok(f.customer === 'Customers owe Acme Ltd' && f.supplier === 'Acme Ltd owes suppliers', 'firm voice names the client');
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log('\n' + (fail ? 'FAIL' : 'all ok') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
