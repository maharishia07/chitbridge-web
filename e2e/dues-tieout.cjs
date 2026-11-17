/* dues-tieout.cjs — FC-M10: the "Agrees with trial balance" line under a firm's Who owes whom, painted from the server's tb_control (mocked api, the real page).
 *  Both cases (agrees · differs), in Cream and Dark at 1366 and 390 px: the line says the right words, AA contrast, no clipping, no sideways scroll, copy within the text budget.
 *  Run: NODE_PATH=$PWD/e2e/node_modules node e2e/dues-tieout.cjs */
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const books = require('./lib/books-api.cjs'), C = require('./lib/contract.cjs'), { measure } = require('./lib/theme-measure.cjs'), { audit } = require('./lib/rule13.cjs');
const json = (r, status, o) => C.json(r, status, o);
const tok = (c) => { const e = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return e({ alg: 'none' }) + '.' + e(c) + '.x'; };
const FIRM = { token: tok({ identity_id: 'ent-FIRM', identity_type: 'entity' }), role: 'entity', name: 'Pat Accountant', entity: 'Blue Gum Books', country: 'AU', currency: 'AUD' };
const CLIENT = 'ent-CL', NAME = 'Eastlake Fresh';
const Z = { not_due: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, worst: null, no_terms_minor: 0, terms: 'ok' };
const party = (id, name, side, balance, f) => ({ party_id: id, name, side, balance_minor: balance, oldest_due: '2026-08-01', disputed_minor: 0, buckets: {}, follow_up: Object.assign({}, Z, f) });
const dues = (control) => ({ currency: 'AUD', asOf: '2026-11-16', total_minor: 514000, parties: [party('p1', 'Ravi', 'customer', 544000, { d0_30: 544000 }), party('p4', 'Anand', 'supplier', -30000, { d90_plus: 30000 })],
  aged_totals: { customer: Object.assign({}, Z, { d0_30: 544000, balance_minor: 544000 }), supplier: Object.assign({}, Z, { d90_plus: 30000, balance_minor: -30000 }) }, tb_control: control });
const CASES = {
  agrees: { control: { customer: { list_minor: 544000, tb_minor: 544000, differs_minor: 0 }, supplier: { list_minor: -30000, tb_minor: -30000, differs_minor: 0 } }, want: /^Agrees with trial balance · Debtors A\$5,440\.00 · Creditors A\$300\.00$/ },
  differs: { control: { customer: { list_minor: 544000, tb_minor: 551000, differs_minor: -7000 }, supplier: { list_minor: -30000, tb_minor: -30000, differs_minor: 0 } }, want: /^Differs from trial balance · Debtors by A\$70\.00 · see Trial balance$/ }
};
(async () => {
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if (((!f.startsWith(PUB)) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port, b = await chromium.launch();
  const G = { grant_id: 'g1', grantor_entity: CLIENT, grantor_name: NAME, preset: 'auditor', state: 'live', revoked_at: null, ended_at: null };
  for (const name of Object.keys(CASES)) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-AU', timezoneId: 'Australia/Sydney', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    let asked = '';
    await ctx.route('**/api/**', (r) => {
      const u = new URL(r.request().url()), p = u.pathname;
      if (p === '/api/entities/me') return json(r, 200, { entity: { display_name: NAME, currency_code: 'AUD' } });
      if (p === '/api/books-grants') return json(r, 200, { given: [], received: [G] });
      if (p === '/api/books/health') return json(r, 200, Object.assign(books.health(), { currency: 'AUD', year: { fiscal_year: '2026-27', from: '2026-07-01', start_month: 7 }, country: books.csStatus('AU', 'Australia') }));
      if (p === '/api/books/dues') { asked = u.search; return json(r, 200, dues(CASES[name].control)); }
      if (p === '/api/books/daybook') return json(r, 200, books.daybook([], { currency: 'AUD', country: 'AU' }));
      if (p === '/api/books/todo') return json(r, 200, []);
      if (p === '/api/network-offers') return json(r, 200, C.example('GET /api/network-offers'));
      return json(r, 200, {});
    });
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, FIRM);
    const p = await ctx.newPage(), threw = [];
    p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + '/network.html?open=' + CLIENT + '&view=dues');
    await p.waitForTimeout(2500);
    const seat = p.locator('[data-testid="nw-seat-auditor"]'); if (await seat.count()) await seat.click();
    await p.waitForSelector('[data-testid="bv-dues-tb"]', { timeout: 20000 }).catch(() => {});
    const line = (await p.locator('[data-testid="bv-dues-tb"]').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    ok(CASES[name].want.test(line), name + ': the line reads "' + line + '"');
    ok(/control=1/.test(asked), name + ': the dues read asked for the control (' + asked + ')');
    for (const theme of ['cream', 'dark']) for (const width of [1366, 390]) {
      await p.setViewportSize({ width, height: width > 500 ? 900 : 844 });
      await p.evaluate((t) => { CBAvatar.applyTheme(t); }, theme); await p.waitForTimeout(200);
      const mine = await p.locator('[data-testid="bv-dues-tb"]').evaluate((el) => ({ clipped: el.scrollWidth > el.clientWidth + 1 })), pairs = await p.evaluate(measure), bad = pairs.filter((x) => !x.grad && x.ratio < x.need), a = await audit(p, 'books-grant-host');
      const fails = [].concat(bad.map((x) => 'contrast ' + x.ratio + ' "' + x.text + '"'), a.clip.filter((x) => !/Eastlake/.test(x)).map((x) => 'clipped ' + x), /* the client crumb ellipsises by design (the band's own rule); the line itself is measured below */ a.scroll.map((x) => 'scroll ' + x), a.budget.map((x) => 'budget ' + x), mine.clipped ? ['the tie-out line is clipped'] : []);
      ok(!fails.length, name + ' · ' + theme + ' · ' + width + ' px: AA, no clip, no sideways scroll, in budget' + (fails.length ? ' · ' + fails.slice(0, 4).join(' | ') : ''));
      if (width === 390) await p.screenshot({ path: path.join(__dirname, 'shots', 'dues-tieout-' + name + '-' + theme + '-390.png') });
    }
    ok(threw.length === 0, name + ': no page error' + (threw.length ? ' ' + threw.join(';') : ''));
    await ctx.close();
  }
  /* the stand-in's other books answers (periods, party_no) are older than the contract and not this line's; only tb_control is held to it here */
  const [good, why] = C.finish(); ok(good || !/tb_control: the answer sends it/.test(why), 'tb_control is in the contract: ' + (good ? 'all answers conform' : 'no tb_control complaint'));
  await b.close(); srv.close();
  console.log('\n' + (fail ? 'FAIL' : 'all ok') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
