/* walk-index-one-screen.cjs - THE ONE HOME FITS ONE SCREEN (Athi 21 Nov: "a single page app, not scroll, but to showcase all"), 1366x768 and 390x844.
 * Mocked api (the pattern of phone-card.cjs / index-page.cjs); no live site. Seats: out (signed out: the showcase) · shop (a new shop) · live (a shop with figures) · firm (the practice list).
 * Proves (exit 1 on any failure): the page is no taller or wider than the viewport; no clipped child; no page error; every tile (signed out) opens its in-page panel
 * listing each entry Live or Coming; every row (signed in) opens and the page still does not scroll; and the REPEAT RULE (Athi 21 Nov): no visible string repeats more
 * than 3 times on one screen except data values. The firm's practice list (FIRM_N=150 clients, health groups, holders) is held to it too; FIRM_REPEATS=0 switches it off.
 * Run:  NODE_PATH=e2e/node_modules node e2e/walk-index-one-screen.cjs   (env WHO=out,shop,live,firm  VIEWS=1366x768,390x844  THEMES=cream,dark  SHOTS=dir) */
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public'), SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const books = require('./lib/books-api.cjs'), C = require('./lib/contract.cjs');
const json = (r, s, o) => C.json(r, s, o);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  ok  ' : '  XX  ') + m); };
const e = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const tok = (c) => e({ alg: 'none' }) + '.' + e(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.x'; /* clock-ok: a token expiry an hour from the real clock, not a business day */
const SHOP = { token: tok({ identity_id: 'ent-NEW', identity_type: 'entity' }), role: 'entity', name: 'Asha', entity: 'Bluegum Cafe', bridgeId: 'CBNEW00001', country: 'AU', currency: 'AUD' };
const FIRM = { token: tok({ identity_id: 'ent-FIRM', identity_type: 'entity' }), role: 'entity', name: 'Pat Accountant', entity: 'Blue Gum Books', country: 'AU', currency: 'AUD' };
const NAMES = ['Eastlake Fresh', 'Harbour Cafe', 'Northside Plumbing', 'Wattle Bakery', 'Coastal Cycles', 'Bayside Books', 'Redgum Timber', 'Lakeview Dental', 'Manly Surf Co', 'Pyrmont Print'];
const STAFF = ['Asha Rao', 'Ben Ortiz', 'Chen Wei'], HEALTH = [['good', 'Doing well'], ['watch', 'Watch'], ['help', 'Needs help']], STAGES = ['books_in', 'complete', 'checked', 'ready', 'lodged'];
/* a client row as the server sends it (books-practice): health, stage, bank, queries, checked, grant and holders; FIRM_N clients (the auditor brings about 150 shops) */
const client = (n, i) => { const h = HEALTH[i % 7 === 0 ? 2 : i % 7 < 3 ? 1 : 0];
  return { entity_id: 'c' + i, name: n + (i >= NAMES.length ? ' ' + (i + 1) : ''), country: 'AU', role: 'auditor', currency: 'AUD', stage: STAGES[i % 5], stage_blocker: i % 2 ? 'months' : null,
  year_end: { fy: '2025-26', of: 12, locked: 9, bank_to_end: true, end: '2026-06-30' }, queries: { open: i % 3, on_us: i % 3, waiting_over_14: 0, oldest_days: 0 }, bank: { state: 'reconciled', unexplained_minor: 0 },
  checked: { n: 8, of: 12 }, to_check: 4, months_unlocked: 3, bas: { due_date: '2026-12-15', due_in_days: 24 }, changed: null, last_look: null, grant: { expires_at: null, ends_in_days: null, read_only: true, can_see_costs: false },
  health: { status: h[0], words: h[1], reasons: [], codes: [], sales_trend_pct: null, gross_margin_pct: null, cash_minor: null, profit_quarter_minor: null, withheld: { costs: null } },
  holders: i % 4 === 0 ? [] : [{ name: STAFF[i % 3] }] }; };
const FIRM_N = Number(process.env.FIRM_N || 150), NAMES_N = Array.from({ length: FIRM_N }, (_, i) => NAMES[i % NAMES.length]);
const practice = () => ({ own_trade: false, may_assign: true, clients: NAMES_N.map(client), band: { bands: [{ key: 'pipeline', first: true, tiles: STAGES.map((k, x) => ({ key: k, n: NAMES_N.filter((_, i) => i % 5 === x).length })) }] }, words: {} });
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
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if (((!f.startsWith(PUB)) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port, b = await chromium.launch();
  for (const who of (process.env.WHO || 'out,shop,live,firm').split(',')) for (const [w, h] of (process.env.VIEWS || '1366x768,390x844').split(',').map((v) => v.split('x').map(Number))) for (const theme of (process.env.THEMES || 'cream').split(',')) {
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
    await ctx.addInitScript(([s, out]) => { try { localStorage.setItem('cb_api_base', location.origin); if (!out) localStorage.setItem('cb_sess', JSON.stringify(s)); } catch (_) {} }, [who === 'firm' ? FIRM : SHOP, who === 'out']);
    const p = await ctx.newPage(), threw = [];
    p.on('pageerror', (x) => threw.push(x.message));
    let bytes = 0;
    p.on('response', (r) => { if (!/\/api\//.test(r.url())) r.body().then((b) => { bytes += b.length; }).catch(() => {}); });
    await p.goto(base + '/');
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
    /* the repeat rule: a visible leaf string (no digit = not a data value) printed more than 3 times on this screen */
    const reps = await p.evaluate(() => {
      const count = {};
      [].slice.call(document.querySelectorAll('body *')).forEach((x) => {
        if (x.children.length || x.closest('[hidden],[aria-hidden=true],dialog:not([open])')) return;
        const r = x.getBoundingClientRect(), t = (x.textContent || '').replace(/\s+/g, ' ').trim();
        if (r.width < 1 || r.height < 1 || r.top > innerHeight || r.left > innerWidth || !t || t.length > 60 || /\d/.test(t) || !/\p{L}/u.test(t) || x.closest('[data-value]')) return; /* a digit, a bare glyph (caret, sort arrow) or a marked data value (a holder's initials) is not a repeated string */
        count[t] = (count[t] || 0) + 1;
      });
      return Object.keys(count).filter((t) => count[t] > 3).map((t) => t + ' x' + count[t]);
    });
    console.log('  ' + tag + ' repeated strings (>3): ' + (reps.join(' | ') || 'none') + ' · first paint ' + Math.round(bytes / 1024) + ' KB');
    if (process.env.FIRM_REPEATS !== '0') ok(!reps.length, tag + ': no visible string repeats more than 3 times');
    const noScroll = () => p.evaluate(() => { const mn = document.querySelector('.cbsh-main'); return { mainY: mn.scrollHeight - mn.clientHeight, sy: document.documentElement.scrollHeight - innerHeight, sx: document.documentElement.scrollWidth - innerWidth }; });
    if (who === 'out') {
      const ids = await p.$$eval('.ix-row', (n) => n.map((x) => x.parentNode.getAttribute('data-pillar')));
      ids.push(...await p.$$eval('.ix-fw', (n) => n.map((x) => x.getAttribute('data-pillar'))));
      ok(ids.length === 9, tag + ': six tiles + Labs, Standards, Setup (' + ids.length + ')');
      for (const id of ids) {
        await p.click('button.ix-fw[data-pillar="' + id + '"], .ix-item[data-pillar="' + id + '"] .ix-row');
        await p.waitForTimeout(150);
        const o = await p.evaluate(() => ({ open: !!document.querySelector('dialog[open]'), lines: document.querySelectorAll('dialog[open] .ix-se').length, soon: document.querySelectorAll('dialog[open] .ix-se.soon').length }));
        const ns = await noScroll();
        ok(o.open && o.lines > 0 && ns.sy <= 1 && ns.sx <= 0, tag + ': ' + id + ' opens its panel in the page (' + o.lines + ' entries, ' + o.soon + ' coming), no scroll');
        if (id === 'sell') await p.screenshot({ path: path.join(SHOTS, tag + '-panel.png') });
        await p.click('dialog[open] .ix-x');
        await p.waitForTimeout(100);
      }
    } else if (who !== 'firm') {
      const ids = await p.$$eval('.ix-row', (n) => n.map((x) => x.parentNode.getAttribute('data-pillar')));
      for (const id of ids) {
        await p.click('.ix-item[data-pillar="' + id + '"] .ix-row');
        await p.waitForTimeout(250);
        const ns = await noScroll(), expanded = await p.$eval('.ix-item[data-pillar="' + id + '"] .ix-row', (x) => x.getAttribute('aria-expanded'));
        ok(expanded === 'true' && ns.mainY <= 1 && ns.sy <= 1, tag + ': row ' + id + ' opens, still no page scroll ' + JSON.stringify(ns));
        if (id === ids[0]) await p.screenshot({ path: path.join(SHOTS, tag + '-open1.png') });
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
