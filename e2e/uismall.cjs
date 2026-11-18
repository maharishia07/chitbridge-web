/* uismall.cjs — TWO SMALL UI FAULTS (walks 2026-11-18). RED FIRST, mocked, 1366 + 390, light + dark.
 * 1 THE BANK STATEMENTS GRID FITS ITS BOX AT 1366 (no inner sideways scroll; Fable 1117b r2 N2: 98 px over) and is the card form at 390.
 * 2 A MARK THREAD OF TWO MESSAGES SAYS "2 messages" (the lead is a message; rail-thread.js counted rows only), by the locale plural rule.
 * Built on bankgrid.cjs' stand-in. Run:  OUT=C:/dev/shots/uismall node e2e/uismall.cjs   (exit 1 on any failure) */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public'), SHOTS = process.env.OUT || path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const books = require('./lib/books-api.cjs');
const C = require('./lib/contract.cjs');   /* every answer the stand-in serves for a route in the api contract is checked (e2e/contract.cjs holds this) */
const json = (r, status, o) => C.json(r, status, o);
const tok = (c) => { const e = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return e({ alg: 'none' }) + '.' + e(Object.assign({ exp: Math.floor(Date.now() / 1000) + 86400 }, c)); };
const FIRM = { token: tok({ identity_id: 'ent-FIRM', identity_type: 'entity' }), role: 'entity', name: 'Pat Accountant', entity: 'Blue Gum Books', country: 'AU', currency: 'AUD' };
const CLIENT = 'ent-CL';
const ACCTS = [{ account_id: 'acc-1500', code: '1500', name: 'Business bank account', label: null }, { account_id: 'acc-1510', code: '1510', name: 'Card and EFTPOS settlements', label: null }];
const refused = (r, code, words) => json(r, 403, { code, error: words, message: words, detail: words });
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
  async function open(role, hash, wait, opt) {
    opt = opt || {};
    const S = { reqs: [], bad: [] };
    const ctx = await b.newContext({ viewport: { width: (opt && opt.width) || 1366, height: 768 }, colorScheme: opt.scheme || 'light', locale: 'en-AU', timezoneId: 'Australia/Sydney', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await ctx.clock.setFixedTime(new Date('2026-11-16T10:00:00+11:00'));
    ctx.on('response', (rs) => { if (/\/api\//.test(rs.url()) && rs.status() >= 400) S.bad.push(rs.status() + ' ' + new URL(rs.url()).pathname); });
    await ctx.route('**/api/**', (r) => {
      const u = new URL(r.request().url()), p = u.pathname, m = r.request().method();
      S.reqs.push(m + ' ' + p);
      if (p === '/api/entities/me') return json(r, 200, { entity: { display_name: 'Eastlake Fresh', currency_code: 'AUD' } });
      if (p === '/api/books-grants' && opt.grants) return json(r, opt.grants, { code: 'X', message: 'x' });
      if (p === '/api/books-grants') return json(r, 200, { given: [], received: [{ grant_id: 'g1', grantor_entity: CLIENT, grantor_name: 'Eastlake Fresh', preset: role === 'auditor' ? 'auditor' : 'adviser', state: 'live', revoked_at: null, ended_at: null }] });
      /* the api's own rule: /attention is an ADVISER read (ADVISER_EXTRA_READS), closed to the auditor; /fx-revalue is closed to both (GRANT_HELD_BACK) */
      if (p === '/api/books/attention') return role === 'adviser' ? json(r, 200, { from: u.searchParams.get('from'), to: u.searchParams.get('to'), total: 0, no_tax_invoice: 0, no_file: 0, no_source: 0, open_queries: null, needs: 0 }) : refused(r, 'GRANT_ROUTE_NOT_LISTED', 'This part of the books is not open to an auditor.');
      if (p === '/api/books/fx-revalue') return refused(r, 'GRANT_ROUTE_NOT_LISTED', 'This part of the books is not open to a grant.');
      if (p === '/api/books/health') return json(r, 200, Object.assign(books.health(), { currency: 'AUD', year: { fiscal_year: '2026-27', from: '2026-07-01', start_month: 7 }, country: books.csStatus('AU', 'Australia') }));
      if (p === '/api/books/accounts') return json(r, 200, { accounts: [{ code: 'G-BANK', name: 'Bank accounts', is_group: true, role: null, parent_code: null }, { code: '1500', name: 'Business bank account', is_group: false, role: 'bank', parent_code: 'G-BANK', active: true }, { code: '1510', name: 'Card and EFTPOS settlements', is_group: false, role: 'bank', parent_code: 'G-BANK', active: true }].map((a) => Object.assign({ account_id: 'acc-' + a.code, tally_group: null, nature: 'asset', active: true }, a)) });
      if (p === '/api/books/periods' && m === 'GET') return json(r, 200, { under_review: { fy: '2026-27', from: '2026-07-01', to: '2027-06-30' }, years: [{ fy: '2026-27', from: '2026-07-01', to: '2027-06-30', months: 12, locked: 0, entries: 0, checked: null, of: null }], periods: [1, 2, 3, 4].map((n) => Object.assign(books.periodRow('2026-27', n, 'open'), { start_date: '2026-' + String(n + 6).padStart(2, '0') + '-01', end_date: '2026-' + String(n + 6).padStart(2, '0') + '-28' })) });
      if (p === '/api/books/bank/log') return json(r, 200, { currency: 'AUD', account: { account_id: 'acc-1500', code: '1500', name: 'Bank' }, marks: [], marks_next: null, statements: (opt.wide ? [{ period_from: '2025-07-01', period_to: '2026-10-31', currency: 'AUD', difference_minor: 0, closing_bank_minor: 20286000, closing_books_minor: 20286000, opening_minor: 0, by_name: 'Pat', at: '2026-11-02T01:00:00Z' }] : []).concat([{ period_from: '2026-10-01', period_to: '2026-10-31', currency: 'AUD', difference_minor: 35432, closing_bank_minor: 99900, closing_books_minor: 64468, opening_minor: 0, by_name: 'Pat', at: '2026-11-02T01:00:00Z' }, { period_from: '2026-06-01', period_to: '2026-06-30', currency: 'AUD', difference_minor: 0, closing_bank_minor: 20336000, closing_books_minor: 20286000, opening_minor: 0, by_name: 'Pat', at: '2026-07-02T01:00:00Z' }]), posted: [], exceptions: [] });
      if (p === '/api/books/bank/statement-files') {
        const to = u.searchParams.get('to') || '2026-11', ty = Number(to.slice(0, 4)), tm = Number(to.slice(5, 7)), months = Array.from({ length: Number(u.searchParams.get('months')) || 6 }, (_, i) => (Number(u.searchParams.get('months')) || 6) - 1 - i).map((k) => { const t = ty * 12 + tm - 1 - k; return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0'); });
        const kept = (opt.kept || []).map((m) => ({ id: 'f-' + m, account_id: 'acc-1500', label: null, period_from: m + '-01', period_to: m + '-28', name: m + '.csv', size: 9, source: 'owner', overlaps: false, by_name: 'M', by_firm: null, for_client: false, added_at: '2026-11-02T01:00:00Z', read_at: null, reads: 0 }));
        const unexplained = opt.unexplained || { accounts: [{ account_id: 'acc-1500', currency: 'AUD', unexplained_minor: 35432, to: '2026-10-31' }], by_currency: [{ currency: 'AUD', unexplained_minor: 35432, to: '2026-10-31' }], currency: 'AUD', unexplained_minor: 35432, to: '2026-10-31', count: 1 };
        const asOf = u.searchParams.get('asOf'), signed = [{ period_to: '2026-10-31', statement_minor: 99900, books_signed_minor: 64468, unexplained_minor: 35432, tied: false, made_at: '2026-11-02 01:00:00+00' }, { period_to: '2026-06-30', statement_minor: 20336000, books_signed_minor: 20286000, unexplained_minor: 0, tied: true, made_at: '2026-07-02 01:00:00+00' }].filter((x) => !asOf || x.period_to <= asOf).slice(0, 1).map((x) => Object.assign({ account_id: 'acc-1500', currency: 'AUD' }, x));
        return json(r, 200, Object.assign({ currency: 'AUD', today: '2026-11-16', months, unexplained, accounts: ACCTS, cells: months.flatMap((month) => ACCTS.map((A) => ({ account_id: A.account_id, month, missing: !(opt.kept || []).includes(month), file_ids: (opt.kept || []).includes(month) ? ['f-' + month] : [], overlaps: false, newest_id: (opt.kept || []).includes(month) ? 'f-' + month : null, newest_name: (opt.kept || []).includes(month) ? month + '.csv' : null }))), files: kept, total: kept.length, next: null, older: 0 }, asOf ? { signed_as_at: { asOf, accounts: signed } } : {}));
      }
      if (p === '/api/books/dues') return json(r, 200, books.dues([]));
      if (p === '/api/books/daybook') return json(r, 200, books.daybook([], { currency: 'AUD', country: 'AU' }));
      if (p === '/api/books/todo') return json(r, 200, []);
      return json(r, 200, {});
    });
    await ctx.addInitScript(({ s, opt }) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } localStorage.setItem('cb_theme', opt.scheme === 'dark' ? 'dark' : 'cream'); } catch (_) {} }, { s: FIRM, opt: { scheme: opt.scheme } });
    const p = await ctx.newPage(), threw = [];
    p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + '/accounts.html?acting=' + CLIENT + (role === 'auditor' ? '&role=auditor' : '') + (opt.q || '') + hash);
    await p.waitForSelector(wait, { timeout: 20000, state: 'attached' });
    await p.waitForTimeout(2500);
    return { ctx, p, S, threw };
  }

  async function openThread(scheme, width) {
    const ctx = await b.newContext({ viewport: { width, height: 768 }, colorScheme: scheme, locale: 'en-AU', serviceWorkers: 'block' });
    await ctx.route((u) => u.hostname !== '127.0.0.1', (r) => r.abort());
    await ctx.route('**/api/**', (r) => json(r, 200, {}));
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_sess', JSON.stringify(s)); localStorage.setItem('cb_theme', scheme === 'dark' ? 'dark' : 'cream'); } catch (_) {} }, FIRM);
    const p = await ctx.newPage();
    await p.goto(base + '/accounts.html?acting=' + CLIENT + '#/bank');
    await p.waitForFunction(() => window.CBThread && window.CBThreadKit, null, { timeout: 20000 });
    const read = (lead, n) => p.evaluate(async ({ lead, n }) => {
      const host = document.createElement('div'); host.id = 'uis_' + Math.random().toString(36).slice(2); document.body.appendChild(host);
      const rows = Array.from({ length: n }, (_, i) => ({ message_id: 'm' + i, message_text: 'Reply ' + i, sender_display_name: 'Pat', created_at: '2026-11-17T10:0' + i + ':00Z', msg_type: 'info', thread_type: 'external' }));
      window.CBThread.mount(host, { subject: { type: 'mark', id: 'mk-1' }, transport: async () => ({ messages: rows }), lead: lead ? { who: 'Sam', at: '2026-11-17T09:00:00Z', text: 'Why is this late?' } : null, readOnly: true, actions: { message_external: { ok: false, why: 'x' } } });
      await new Promise((r) => setTimeout(r, 900));
      const c = host.querySelector('[data-testid="rt-count"]'); return { text: c ? c.textContent.trim() : null, bubbles: host.querySelectorAll('.rt-m').length };
    }, { lead, n });
    const two = await read(true, 1); const one = await read(true, 0); const rep = await read(false, 2);
    return { text: two.text, one: one.text, rep: rep.text, ctx, shot: (f) => p.screenshot({ path: f, fullPage: false }) };
  }
  const text = (p) => p.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));
  for (const scheme of ['light', 'dark']) for (const width of [1366, 390]) {
    const tag = scheme + '-' + width;
    const g = await open('adviser', '#/bank', '[data-testid="bank-stmts-grid"]', { q: '&fy=2026-27', width, scheme });
    const m = await g.p.evaluate(() => { const w = document.querySelector('.bkh-gridwrap'), t = document.querySelector('[data-testid="bank-stmts-grid"]'); const r = t.getBoundingClientRect(), b = w.getBoundingClientRect(); return { over: w.scrollWidth - w.clientWidth, tableW: Math.round(r.width), boxW: Math.round(b.width), card: getComputedStyle(t.querySelector('tr')).display, page: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    if (width === 1366) ok(m.over <= 0, tag + ' · grid fits its box (over ' + m.over + ' px; table ' + m.tableW + ' in ' + m.boxW + ')');
    else ok(m.card === 'grid' && m.over <= 0, tag + ' · card form (tr display ' + m.card + '), over ' + m.over);
    ok(m.page <= 0, tag + ' · no page sideways scroll');
    ok((await g.p.evaluate(() => document.documentElement.getAttribute('data-theme'))) === (scheme === 'dark' ? 'dark' : 'cream'), tag + ' · theme applied');
    await g.p.screenshot({ path: path.join(SHOTS, 'grid-' + tag + '.png') });
    await g.ctx.close();
    const t = await openThread(scheme, width);
    ok(t.text === '2 messages', tag + ' · mark thread lead + 1 reply reads "2 messages" (got "' + t.text + '")');
    ok(t.rep === '2 messages', tag + ' · two rows, no lead, reads "2 messages" (got "' + t.rep + '")');
    await t.shot(path.join(SHOTS, 'thread-' + tag + '.png'));
    await t.ctx.close();
  }
  ok(...C.finish());
  await b.close(); srv.close();
  console.log(pass + ' ok / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})();
