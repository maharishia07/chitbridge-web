/* index2-shots.cjs — index2.html (the crisp one-page Home, Fable review 18 Nov §3) at 1366x768 and 390x844: a NEW shop and a firm auditor.
 * Mocked api (the pattern of phone-card.cjs / index-page.cjs); no live site. Proves: no page scroll, no sideways scroll, no clipped child, then shoots.
 * Run on a SIT box only:  NODE_PATH=e2e/node_modules SHOTS=/work/shots node e2e/index2-shots.cjs  (env THEMES=cream,dark) */
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public'), SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const books = require('./lib/books-api.cjs'), C = require('./lib/contract.cjs');
const json = (r, s, o) => C.json(r, s, o);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  ok  ' : '  XX  ') + m); };
const e = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const tok = (c) => e({ alg: 'none' }) + '.' + e(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.x';
const SHOP = { token: tok({ identity_id: 'ent-NEW', identity_type: 'entity' }), role: 'entity', name: 'Asha', entity: 'Bluegum Cafe', bridgeId: 'CBNEW00001', country: 'AU', currency: 'AUD' };
const FIRM = { token: tok({ identity_id: 'ent-FIRM', identity_type: 'entity' }), role: 'entity', name: 'Pat Accountant', entity: 'Blue Gum Books', country: 'AU', currency: 'AUD' };
const NAMES = ['Eastlake Fresh', 'Harbour Cafe', 'Northside Plumbing', 'Wattle Bakery', 'Coastal Cycles', 'Bayside Books', 'Redgum Timber', 'Lakeview Dental', 'Manly Surf Co', 'Pyrmont Print'];
const client = (n, i) => ({ entity_id: 'c' + i, name: n, country: 'AU', role: 'auditor', currency: 'AUD', stage: i % 3 === 0 ? 'needs_help' : i % 2 ? 'books_in' : 'checked', stage_blocker: i % 2 ? 'months' : null,
  year_end: { fy: '2025-26', of: 12, locked: 9, bank_to_end: true, end: '2026-06-30' }, queries: i % 3, unexplained_minor: i % 3 ? 120000 : 0 });
const practice = () => ({ own_trade: false, clients: NAMES.map(client), band: { bands: [{ key: 'pipeline', first: true, tiles: [{ key: 'books_in', n: 4 }, { key: 'checked', n: 4 }] }] }, words: {} });
const G = (i) => ({ grant_id: 'g' + i, grantor_entity: 'c' + i, grantor_name: NAMES[i], preset: 'auditor', state: 'live', revoked_at: null, ended_at: null });
const LIVE = {
  '/api/facts/till': { state: 'in_use', lines: ['12 bills · A$428', '1 bill waiting to send'], figures: { trend: { spark: [400, 380, 410, 420, 450, 410, 470, 480], vs_last_year_pct: 12 } } },
  '/api/facts/finance': { state: 'needs_you', lines: [{ text: '3 customers owe you A$1,240', tone: 'dn' }, '2 bills to pay'] },
  '/api/facts/accounts': { state: 'in_use', lines: ['Ledger up to 7 Nov'] },
  '/api/facts/bank': { state: 'needs_you', lines: [{ text: '4 bank lines to match', tone: 'dn' }] },
  '/api/facts/crm': { state: 'in_use', lines: ['86 customers'] },
  '/api/facts/marketing': { state: 'not_started', lines: [] },
  '/api/facts/operations': { state: 'in_use', lines: ['2 supplier bills to pay'] },
  '/api/facts/people': { state: 'in_use', lines: ['5 people'] },
  '/api/facts/reports': { state: 'in_use', lines: ['Sales up 12%'] },
  '/api/facts/trend': { state: 'in_use', lines: ['8 weeks'] },
  '/api/facts/compare': { state: 'not_started', lines: [] },
  '/api/facts/storefront': { state: 'not_started', lines: [] },
  '/api/facts/product-lab': { state: 'in_use', lines: ['120 items'] },
};
async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : rel === 'index2.html' ? path.join(ROOT, 'index2.html') : path.join(PUB, rel);
    if (((!f.startsWith(PUB)) && f !== path.join(ROOT, 'index.html') && f !== path.join(ROOT, 'index2.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port, b = await chromium.launch();
  for (const who of (process.env.WHO || 'shop,firm').split(',')) for (const [w, h] of (process.env.VIEWS || '1366x768,390x844').split(',').map((v) => v.split('x').map(Number))) for (const theme of (process.env.THEMES || 'cream').split(',')) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'en-AU', timezoneId: 'Australia/Sydney', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => {
      const p = new URL(r.request().url()).pathname;
      if (p === '/api/books-grants/practice') return who === 'firm' ? json(r, 200, practice()) : json(r, 200, { own_trade: true, clients: [] });
      if (p === '/api/entities/me') return json(r, 200, { entity: { display_name: who === 'firm' ? 'Blue Gum Books' : 'Bluegum Cafe', currency_code: 'AUD' }, ledger_on: true });
      if (p === '/api/books-grants') return json(r, 200, { given: [], received: who === 'firm' ? NAMES.map((n, i) => G(i)) : [] });
      if (p === '/api/books/health') return json(r, 200, Object.assign(books.health(), { currency: 'AUD', country: books.csStatus('AU', 'Australia') }));
      if (p === '/api/entities/sides') return json(r, 200, { lean: [], use: [], impact: null });
      if (p === '/api/work/facts') return json(r, 200, who === 'live' ? { truncated: false, counts: { orders_in: 5, tasks: 4 }, lines: [], figures: { orders_new: 3, tasks_mine: 2, orders_in: 5, tasks: 4 } } : { truncated: false, counts: {}, lines: [], figures: {} });
      if (who === 'live' && LIVE[p]) return json(r, 200, LIVE[p]);
      if (/^\/api\/facts\//.test(p)) return json(r, 200, { state: 'not_started', lines: [] });
      if (p === '/api/events/stream') return r.abort();
      return json(r, 404, { error: 'not found' });
    });
    await ctx.addInitScript(([s, t]) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', JSON.stringify(s)); localStorage.setItem('cb_home_layout', 'new'); } catch (_) {} }, [who === 'firm' ? FIRM : SHOP, theme]);
    const p = await ctx.newPage(), threw = [];
    p.on('pageerror', (x) => threw.push(x.message));
    await p.goto(base + '/index2.html');
    await p.waitForSelector('[data-testid="cbshell"]', { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(2500);
    if (theme === 'dark') { await p.evaluate(() => window.CBAvatar && CBAvatar.applyTheme && CBAvatar.applyTheme('dark')).catch(() => {}); await p.waitForTimeout(300); }
    const m = await p.evaluate(() => {
      const d = document.documentElement, vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden'; };
      const main = document.querySelector('.cbsh-main') || document.body;
      const clip = [].slice.call(document.querySelectorAll('.cbsh-main *')).filter((x) => vis(x) && x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflowX !== 'visible' && getComputedStyle(x).textOverflow !== 'ellipsis').map((x) => (x.className || x.tagName) + '').slice(0, 5);
      const scrollers = [].slice.call(document.querySelectorAll('.cbsh-main *')).filter((x) => vis(x) && x.scrollHeight > x.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(x).overflowY)).map((x) => (x.className || x.tagName) + '').slice(0, 5);
      const mainY = main.scrollHeight - main.clientHeight;
      const rows = document.querySelectorAll('.ix-row').length, shopCards = document.querySelectorAll('.cbsh-box').length, pr = document.querySelectorAll('[data-testid^="practice-row-"]').length;
      return { sx: d.scrollWidth - innerWidth, sy: d.scrollHeight - innerHeight, mainY, clip, scrollers, rows, shopCards, practiceRows: pr, text: main.innerText.replace(/\s+/g, ' ').slice(0, 500) };
    });
    const tag = who + '-' + theme + '-' + w + 'x' + h;
    console.log('  ' + tag + ' ' + JSON.stringify(m));
    ok(m.sx <= 0, tag + ': no sideways scroll');
    ok(m.sy <= 1 && m.mainY <= 1 && (who === 'firm' || !m.scrollers.length), tag + ': no page scroll (doc ' + m.sy + ', main ' + m.mainY + ', inner ' + m.scrollers.join('|') + ')');
    ok(!m.clip.length, tag + ': no clipped child ' + m.clip.join('|'));
    ok(threw.length === 0, tag + ': no page error ' + threw.join(';'));
    await p.screenshot({ path: path.join(SHOTS, tag + '.png') });
    if (who !== 'firm') {
      const row = await p.$('.ix-row');
      if (row) {
        await row.click(); await p.waitForTimeout(400);
        await p.screenshot({ path: path.join(SHOTS, tag + '-open1.png') });
        const m2 = await p.evaluate(() => { const mn = document.querySelector('.cbsh-main'); return { mainY: mn.scrollHeight - mn.clientHeight, sy: document.documentElement.scrollHeight - innerHeight }; });
        ok(m2.mainY <= 1 && m2.sy <= 1, tag + ': first row open, still no page scroll ' + JSON.stringify(m2));
      }
    }
    if (process.env.PROBE) console.log('  PROBE ' + tag + ' ' + JSON.stringify(await p.evaluate((sel) => [].slice.call(document.querySelectorAll(sel)).slice(0, 2).map((n) => ({ html: n.outerHTML.slice(0, 900), kids: [].slice.call(n.querySelectorAll('*')).slice(0, 14).map((k) => k.className + ':' + getComputedStyle(k).display + ':' + Math.round(k.getBoundingClientRect().width)) })), process.env.PROBE)));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log('\n' + (fail ? 'FAIL' : 'all ok') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
main().catch((x) => { console.error(x); process.exit(1); });
