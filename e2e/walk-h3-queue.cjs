'use strict';
/**
 * e2e/walk-h3-queue.cjs — H3 design lane (20 Nov): the ONE work queue (CBAssign.queue, app/assign-bar.js) on a firm's client list, measured the same way BEFORE and AFTER.
 * The api is a STAND-IN (no network): the shapes of GET /api/books-grants/practice (holders, may_assign), GET /api/actors, POST /api/chits/assign-bulk. Pattern: e2e/walk-assign-bulk.cjs.
 * Places: firm B queue (adviser clients) and firm C queue (auditor clients), at 1366x768 and 390x844. Seats: a manager who holds nothing yet (the pool is waiting), a staff member who holds 5.
 * Measured per place and size: clicks to open "my next item", page scroll, rows on the first screen, contrast fails (WCAG 1.4.3), focus ring (2.4.7), the words on the tabs and the empty state, register codes missing.
 * BEFORE or AFTER is read from the code under test (does assign-bar.js carry the shared empty state), so one file measures both heads; shots h3-out/<place>-before|after-<w>.png and h3-out/h3-metrics-<tag>.json.
 * CARD 01-rail-core-the-chit/assign · MIN walk · MIN cream-and-dark-1366-390 · MIN aa-contrast · MIN could-not-read-words
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { measure } = require('./lib/theme-measure.cjs');
const OUT = process.env.OUT || path.join(__dirname, '..', 'h3-out');
const PUB = path.join(__dirname, '..', 'public');
const AFTER = /queueEmpty/.test(fs.readFileSync(path.join(PUB, 'app', 'assign-bar.js'), 'utf8')), TAG = AFTER ? 'after' : 'before';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const C = require('./lib/contract.cjs');
const ME = { actor_id: 'a0000000-0000-4000-8000-00000000000a', display_name: 'Anna Lee', job_assignable: true, assignable: true, is_me: true };
const BEN = { actor_id: 'b0000000-0000-4000-8000-00000000000b', display_name: 'Ben Ortiz', job_assignable: true, assignable: true };
const id = (n) => 'c' + String(n).padStart(3, '0');
const WORDS = { ready: 'Ready to lodge', done: "Lodged (owner's word)" };
const metrics = [];

function standIn(kind, seat) {
  const holder = new Map(), calls = [];
  if (seat === 'staff') for (let n = 1; n <= 5; n++) holder.set(id(n), { actor_id: ME.actor_id, name: ME.display_name });
  if (seat === 'manager') for (let n = 1; n <= 12; n++) holder.set(id(n), { actor_id: BEN.actor_id, name: BEN.display_name });
  const label = kind === 'c' ? 'Audit client ' : 'Client ';
  const rowOf = (n) => ({
    entity_id: id(n), currency: 'AUD', name: label + String(n).padStart(3, '0'), role: kind === 'c' ? 'auditor' : 'adviser', stage: 'books_in', stage_blocker: null,
    year_end: { fy: '2025-26', of: 12, locked: 6, bank_to_end: false, end: '2026-06-30' }, queries: { open: 0, on_us: 0 }, bank: { state: 'reconciled', unexplained_minor: 0 },
    health: { status: 'good', words: 'Doing well', reasons: [], withheld: { costs: null, currencies: null }, gross_margin_pct: 40, profit_quarter_minor: 500, cash_minor: 900, codes: [] },
    checked: { n: 1, of: 1 }, months_unlocked: 1, bas: { due_date: null, due_in_days: null }, grant: { can_see_costs: true, expires_at: null, ends_in_days: 400 }, last_look: null, action_count: 0,
    holders: holder.has(id(n)) ? [holder.get(id(n))] : []
  });
  const total = seat === 'staff' ? 30 : 40;
  return {
    calls, holder,
    practice: () => ({ rule: 'r', words: WORDS, today: '2026-11-20', band: { bands: [{ key: 'pipeline', first: true, tiles: [] }], pipeline: [] }, clients: Array.from({ length: total }, (_, i) => rowOf(i + 1)), may_assign: seat !== 'staff', total, page: 1, limit: 200, has_more: false, truncated: false, own_trade: false }),
    assign: (body) => { calls.push(body); (body.subject_ids || []).forEach((s) => holder.set(s, { actor_id: body.target_actor_id, name: ME.display_name })); return { assigned: (body.subject_ids || []).length, skipped: [], previous: (body.subject_ids || []).map((s) => ({ chit_id: 'h-' + s, subject_id: s, actor_id: null })) }; }
  };
}
async function serve() {
  const srv = http.createServer((q, r) => {
    const url = q.url.split('?')[0];
    if (url === '/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end('window.CB_API = location.origin;'); }
    const home = url === '/' || url === '/index.html';
    const rel = decodeURIComponent(url).replace(/^[/]+/, ''), f = home ? path.join(PUB, '..', 'index.html') : path.join(PUB, rel);
    if ((!home && !f.startsWith(PUB)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { base: 'http://127.0.0.1:' + srv.address().port };
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function open(browser, base, api, vp, theme) {
  const token = b64({ alg: 'none' }) + '.' + b64({ identity_id: ME.actor_id, display_name: ME.display_name }) + '.h3token123456';
  const sess = { token, role: 'actor', name: ME.display_name, actor_id: ME.actor_id };
  const ctx = await browser.newContext({ viewport: vp, locale: 'en-AU', timezoneId: 'Australia/Sydney', serviceWorkers: 'block', colorScheme: theme, isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  await ctx.addInitScript((a) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(a.s)); localStorage.setItem('cb_practice_hint', '1:' + a.s.token.slice(-12)); } } catch (_) {} }, { s: sess });
  await ctx.route(/^http:\/\/(localhost:3000|127\.0\.0\.1:\d+)\/api\//, async (route) => {
    const r = C.wrap(route), req = r.request(), u = new URL(req.url());
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.pathname.includes('/events/stream')) return r.abort();
    const send = (status, body) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/api/entities/me') return send(200, { entity: { display_name: 'Coastal Accounting Advisers', currency_code: 'AUD' } });
    if (u.pathname === '/api/books-grants/practice') return send(200, api.practice());
    if (u.pathname === '/api/actors' && req.method() === 'GET') return send(200, { suggested: ME.actor_id, actors: [{ ...ME, open_load: 0 }, { ...BEN, open_load: 12 }], total: 2, page: 1, limit: 100, summary: {} });
    if (u.pathname === '/api/chits/assign-bulk') { const a = api.assign(JSON.parse(req.postData() || '{}')); return send(200, a); }
    return send(404, { error: 'not found' });
  });
  const page = await ctx.newPage();
  page.__threw = [];
  page.on('pageerror', (e) => page.__threw.push(e.message));
  await page.goto(base + '/');
  await page.waitForSelector('[data-testid^="practice-row-"],[data-testid="cbl-empty-own-practice-clients-pipeline"],.cbl-views', { timeout: 30000 }).catch(() => {});
  await pause(900);
  return { ctx, page };
}
/** what is on screen now: scroll, rows in the first screen, the tab words, the empty words, controls without a register code, contrast fails, focus ring */
async function look(page, vp) {
  const base = await page.evaluate(() => {
    const doc = document.documentElement, rows = Array.from(document.querySelectorAll('[data-testid^="practice-row-"]')).filter((e) => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.innerHeight && b.width > 0; });
    const list = document.querySelector('.cbl-list') || document.body, box = list.getBoundingClientRect();
    const tabs = Array.from(document.querySelectorAll('.cbl-vtab')).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
    const empty = document.querySelector('.cbl-state'), emptyWords = empty ? empty.innerText.replace(/\s+/g, ' ').trim() : '';
    const controls = Array.from(document.querySelectorAll('.cbl button,.cbl input,.cbl select,[data-view-tab],[data-bulk]')).filter((e) => e.getBoundingClientRect().width > 0);
    const noCode = controls.filter((e) => !e.getAttribute('data-cbsid') && !e.closest('[data-cbsid]')).map((e) => (e.getAttribute('data-testid') || e.className || e.tagName).toString().slice(0, 40));
    return { scrollY: Math.max(0, doc.scrollHeight - window.innerHeight), scrollX: Math.max(0, doc.scrollWidth - window.innerWidth), rowsFirstScreen: rows.length, listTop: Math.round(box.top), tabs, emptyWords, controls: controls.length, noCode };
  });
  const dark = await page.evaluate(measure);
  base.contrastFails = dark.filter((e) => !e.grad && e.ratio < e.need && /cbl|assign|as-|bulk/.test(e.html)).map((e) => e.text + ' ' + e.ratio);
  const ring = await page.evaluate(() => { const b = document.querySelector('[data-view-tab]'); if (!b) return 'no tab'; b.focus(); const cs = getComputedStyle(b); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 ? 'ring ' + cs.outlineWidth : cs.boxShadow !== 'none' ? 'shadow' : 'NONE'; });
  base.focus = ring;
  return base;
}
const shot = (page, place, vp) => page.screenshot({ path: path.join(OUT, place + '-' + TAG + '-' + vp.tag + '.png') });
async function rec(page, place, vp, seat, flow, extra) {
  const m = Object.assign({ tag: TAG, place, w: vp.tag, seat, flow }, await look(page, vp), extra || {});
  metrics.push(m);
  console.log(JSON.stringify(m));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { base } = await serve();
  const browser = await chromium.launch();
  for (const vp of [{ width: 1366, height: 768, tag: '1366' }, { width: 390, height: 844, tag: '390' }]) {
    for (const [place, kind] of [['firm-b-queue', 'b'], ['firm-c-queue', 'c']]) {
      /* A. staff who holds 5: opens on Mine, one press opens the next item */
      { const api = standIn(kind, 'staff'); const { ctx, page } = await open(browser, base, api, vp, 'light');
        await rec(page, place + '-mine', vp, 'staff holds 5', 'land on Mine; open my next = 1 click', { clicksToNext: 1 });
        await shot(page, place + '-mine', vp); await ctx.close(); }
      /* B. manager who holds nothing: Mine is empty; the way to the next item */
      { const api = standIn(kind, 'manager'); const { ctx, page } = await open(browser, base, api, vp, 'light');
        await rec(page, place + '-landing', vp, 'manager holds 0', 'landing');
        await shot(page, place + '-landing', vp);
        let clicks = 0;
        await page.locator('[data-view-tab="held-mine"]').click(); clicks++; await pause(500);
        await rec(page, place + '-mine-empty', vp, 'manager holds 0', 'Mine tab, nothing held');
        await shot(page, place + '-mine-empty', vp);
        const act = page.locator('[data-testid="cbl-empty-act"]');
        if (await act.count()) { await act.click(); clicks++; await pause(1500); }
        else {
          await page.locator('[data-view-tab="held-none"]').click(); clicks++; await pause(400);
          await page.locator('[data-selrow="' + id(13) + '"]').check(); clicks++;
          await page.locator('[data-bulk="me"]').click(); clicks++; await pause(1500);
          await page.locator('[data-view-tab="held-mine"]').click(); clicks++; await pause(500);
        }
        const mineNow = await page.locator('[data-testid^="practice-row-"]').count();
        clicks++; /* the press on the client's name opens it */
        await rec(page, place + '-after-pickup', vp, 'manager holds 0', 'one now Mine', { clicksToNext: clicks, mineRowsAfter: mineNow, assignCalls: api.calls.length });
        await shot(page, place + '-pickup', vp);
        await ctx.close(); }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'h3-metrics-' + TAG + '.json'), JSON.stringify(metrics, null, 1));
  console.log('done ' + TAG + ' ' + metrics.length);
})().catch((e) => { console.log('FATAL ' + (e.stack || e)); process.exit(2); });
