'use strict';
/**
 * e2e/walk-assign-bulk.cjs — ASSIGN-1 slice 1, the web side: the firm's client list on Home shows "Held by", and the owner or a manager assigns, hands over, returns to the pool and opens jobs in bulk.
 * The api is a STAND-IN (no real api, no network): its answers are the shapes of PM/firm-staff/DECISIONS-SLICE1.md "api contract" (assign-bulk widened, jobs/open, practice holders, actors job_assignable).
 * Pattern: e2e/walk-firm-landing.cjs (static server for the repo, the page's default api base routed to the stand-in).
 * Steps, at 1366x768 and 390x844, light and dark:
 *   1 150 clients, Held by "Unassigned" on every row · 2 open jobs for 22 · 3 assign 10 to Anna (the picker lists only job_assignable people) · 4 assign 12 to Ben · 5 hand one over to Ben with a note
 *   6 one back to the pool (target_actor_id null) · 7 a partial: 1 assigned, 1 skipped with the SERVER's sentence · 8 a refused call shows the server's sentence, nothing else · 9 an assistant: own clients, no bulk bar
 *   every size: no sideways scroll; contrast of the new parts at AA (4.5:1)
 * CARD 01-rail-core-the-chit/assign
 * MIN walk
 * MIN cream-and-dark-1366-390
 * MIN aa-contrast
 * MIN could-not-read-words (a refused call shows the server's sentence)
 * env: OUT (shots folder, default C:/dev/shots/assign1-web) · run: NODE_PATH=C:/dev/chitbridge-web/e2e/node_modules node e2e/walk-assign-bulk.cjs
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { measure } = require('./lib/theme-measure.cjs');
const OUT = process.env.OUT || 'C:/dev/shots/assign1-web';
const PUB = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (what, cond, info) => { if (cond) { pass++; console.log('  ok   ' + what); } else { fail++; console.log('  FAIL ' + what + (info ? ' :: ' + String(info).slice(0, 300) : '')); } };

const ANNA = { actor_id: 'a0000000-0000-4000-8000-00000000000a', display_name: 'Anna Lee', job_assignable: true, assignable: true };
const BEN = { actor_id: 'b0000000-0000-4000-8000-00000000000b', display_name: 'Ben Ortiz', job_assignable: true, assignable: true };
const CARA = { actor_id: 'c0000000-0000-4000-8000-00000000000c', display_name: 'Cara Viewer', job_assignable: false, assignable: false };
const REFUSAL = 'Only the partner or a manager can assign clients.';
const NO_JOB = 'No job is open for this client and role.';
const id = (n) => 'c' + String(n).padStart(3, '0');
const WORDS = { ready: 'Ready to lodge', done: "Lodged (owner's word)" };

/** the api stand-in: the state a firm would hold (open jobs, holders), and every call it received */
function standIn() {
  const s = { jobs: new Set(), holder: new Map(), calls: [], refuse: false, assistant: false };
  const rowOf = (n, mine) => ({
    entity_id: id(n), currency: 'AUD', name: 'Client ' + String(n).padStart(3, '0') + ' demo', role: n === 150 ? 'auditor' : 'adviser', stage: 'books_in', stage_blocker: null,
    year_end: { fy: '2025-26', of: 12, locked: 6, bank_to_end: false, end: '2026-06-30' }, queries: { open: 0, on_us: 0 }, bank: { state: 'reconciled', unexplained_minor: 0 },
    health: { status: 'good', words: 'Doing well', reasons: [], withheld: { costs: null, currencies: null }, gross_margin_pct: 40, profit_quarter_minor: 500, cash_minor: 900, codes: [] },
    checked: { n: 1, of: 1 }, months_unlocked: 1, bas: { due_date: null, due_in_days: null }, grant: { can_see_costs: true, expires_at: null, ends_in_days: 400 }, last_look: null, action_count: 0,
    holders: s.holder.has(id(n)) ? [s.holder.get(id(n))] : []
  });
  s.practice = () => {
    const rows = s.assistant ? [1, 2, 3, 4, 5].map((n) => { s.holder.set(id(n), { actor_id: 'self', name: 'Dev Assistant' }); return rowOf(n); }) : Array.from({ length: 150 }, (_, i) => rowOf(i + 1));
    return { rule: 'r', words: WORDS, today: '2026-11-17', band: { bands: [{ key: 'pipeline', first: true, tiles: [] }], pipeline: [] }, clients: rows, total: rows.length, page: 1, limit: 200, has_more: false, truncated: false, own_trade: false };
  };
  s.assignBulk = (body) => {
    if (s.refuse) return { status: 403, body: { type: 'about:blank', title: 'Not permitted', status: 403, code: 'CHIT_NOT_PERMITTED', detail: REFUSAL, may: false, why: REFUSAL, message: REFUSAL } };
    const skipped = []; let assigned = 0;
    body.subject_ids.forEach((sub) => {
      if (!s.jobs.has(sub)) return skipped.push({ subject_id: sub, code: 'JOB_NOT_OPEN', reason: NO_JOB });
      if (body.target_actor_id === null) s.holder.delete(sub);
      else s.holder.set(sub, { actor_id: body.target_actor_id, name: body.target_actor_id === ANNA.actor_id ? ANNA.display_name : BEN.display_name });
      assigned++;
    });
    return { status: 200, body: { message: assigned + ' assigned', assigned_to: body.target_actor_id, assigned, skipped } };
  };
  s.openJobs = (body) => {
    const jobs = body.subject_ids.map((sub) => { const had = s.jobs.has(sub); s.jobs.add(sub); return { subject_id: sub, chit_id: 'h-' + sub, outcome: had ? 'existing' : 'opened' }; });
    return { status: 200, body: { opened: jobs.filter((j) => j.outcome === 'opened').length, existing: jobs.filter((j) => j.outcome === 'existing').length, assigned: 0, skipped: [], jobs } };
  };
  return s;
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
  return { srv, base: 'http://127.0.0.1:' + srv.address().port };
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function open(browser, base, api, vp, theme, who) {
  const token = who === 'assistant' ? b64({ alg: 'none' }) + '.' + b64({ hat: 'act', identity_id: 'ac000000-0000-4000-8000-000000000001', parent_entity_id: 'e0000000-0000-4000-8000-000000000001', display_name: 'Dev Assistant' }) + '.assistanttoken' : b64({ alg: 'none' }) + '.' + b64({ identity_id: 'e0000000-0000-4000-8000-000000000001', display_name: 'Coastal Accounting Advisers' }) + '.ownertoken1234';
  const sess = { token, role: who === 'assistant' ? 'actor' : 'entity', name: who === 'assistant' ? 'Dev Assistant' : 'Coastal Accounting Advisers' };
  const ctx = await browser.newContext({ viewport: vp, locale: 'en-AU', timezoneId: 'Australia/Sydney', serviceWorkers: 'block', colorScheme: theme, isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  await ctx.addInitScript((a) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(a.s)); localStorage.setItem('cb_practice_hint', '1:' + a.s.token.slice(-12)); } } catch (_) {} }, { s: sess });
  await ctx.route(/^http:\/\/(localhost:3000|127\.0\.0\.1:\d+)\/api\//, async (r) => {
    const req = r.request(), u = new URL(req.url());
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.pathname.includes('/events/stream')) return r.abort();
    const send = (status, body) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/api/entities/me') return send(200, { entity: { display_name: 'Coastal Accounting Advisers', currency_code: 'AUD' } });
    if (u.pathname === '/api/books-grants/practice') return send(200, api.practice());
    if (u.pathname === '/api/actors' && req.method() === 'GET') return send(200, { actors: [ANNA, BEN, CARA], total: 3, page: 1, limit: 100, summary: {} });
    if (u.pathname === '/api/chits/assign-bulk') { const body = JSON.parse(req.postData() || '{}'); api.calls.push({ path: u.pathname, body }); const a = api.assignBulk(body); return send(a.status, a.body); }
    if (u.pathname === '/api/chits/jobs/open') { const body = JSON.parse(req.postData() || '{}'); api.calls.push({ path: u.pathname, body }); const a = api.openJobs(body); return send(a.status, a.body); }
    return send(404, { error: 'not found' });
  });
  const page = await ctx.newPage();
  page.__threw = [];
  page.on('pageerror', (e) => page.__threw.push(e.message));
  await page.goto(base + '/');
  await page.waitForSelector('[data-testid^="practice-row-"]', { timeout: 30000 }).catch(() => {});
  await pause(600);
  return { ctx, page };
}
const rows = (page) => page.locator('[data-testid^="practice-row-"]').count();
async function tick(page, ids) {
  if (!(await page.locator('[data-selrow]').count())) await page.locator('[data-cbl-selmode]').first().click();
  for (const x of ids) await page.locator('[data-selrow="' + x + '"]').check();
}
async function bulk(page, which) { await page.locator('[data-bulk="' + which + '"]').click(); }
async function pickAndGo(page, name) {
  await page.waitForSelector('[data-testid="assign-picker"]');
  await page.locator('[data-testid="assign-person"]').selectOption({ label: name });
}
const heldText = (page, n) => page.locator('[data-testid="practice-row-' + id(n) + '"]').innerText();
const sleep = pause;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { base } = await serve();
  const browser = await chromium.launch();
  for (const vp of [{ width: 1366, height: 768, tag: '1366' }, { width: 390, height: 844, tag: '390' }]) {
    for (const theme of ['light', 'dark']) {
      const tag = vp.tag + ' ' + theme, file = (n) => path.join(OUT, 'assign1-' + vp.tag + '-' + theme + '-' + n + '.png');
      console.log('--- ' + tag);
      const api = standIn();
      const { ctx, page } = await open(browser, base, api, vp, theme, 'owner');
      ok(tag + ' · 1 the list is drawn from the 150 clients', (await rows(page)) > 0, await rows(page));
      ok(tag + ' · 1 "Held by" says Unassigned on a row', /Unassigned/.test(await heldText(page, 1)), await heldText(page, 1));
      ok(tag + ' · no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await page.screenshot({ path: file('1-list') });

      /* 2 open jobs for 22 */
      const first22 = Array.from({ length: 22 }, (_, i) => id(i + 1));
      await tick(page, first22);
      ok(tag + ' · bulk bar offers Assign to…, Hand over, Back to pool, Open jobs', (await page.locator('[data-bulk]').count()) === 4, await page.locator('[data-bulk]').allInnerTexts());
      await page.screenshot({ path: file('2-bulk-bar') });
      await bulk(page, 'open');
      await page.waitForSelector('[data-testid="assign-result"]');
      await pause(500);
      const open1 = api.calls.filter((c) => c.path === '/api/chits/jobs/open');
      ok(tag + ' · 2 Open jobs sends the 22 ticked clients, plug client, role adviser, period standing', open1.length === 1 && open1[0].body.subject_ids.length === 22 && open1[0].body.plug === 'client' && open1[0].body.role === 'adviser' && open1[0].body.period === 'standing', JSON.stringify(open1));
      ok(tag + ' · 2 the line says what the server did (22 jobs open)', /22 jobs open/.test(await page.locator('[data-testid="assign-result"]').innerText()), await page.locator('[data-testid="assign-result"]').innerText());

      /* 3 ten to Anna */
      await tick(page, first22.slice(0, 10));
      await bulk(page, 'assign');
      await pickAndGo(page, ANNA.display_name);
      const names = await page.locator('[data-testid="assign-person"] option').allInnerTexts();
      ok(tag + ' · 3 the picker lists only job_assignable people (Anna, Ben; not Cara)', JSON.stringify(names) === JSON.stringify([ANNA.display_name, BEN.display_name]), names);
      await page.screenshot({ path: file('3-picker') });
      const dark = await page.evaluate(measure);
      const mine = dark.filter((e) => /as-|assign-|data-bulk/.test(e.html) && !e.grad);
      ok(tag + ' · AA contrast on the picker and the bar (' + mine.length + ' text elements measured)', mine.length > 0 && mine.every((e) => e.ratio >= e.need), JSON.stringify(mine.filter((e) => e.ratio < e.need).map((e) => e.text + ' ' + e.ratio)));
      await page.locator('[data-testid="assign-go"]').click();
      await pause(900);
      const a1 = api.calls.filter((c) => c.path === '/api/chits/assign-bulk')[0];
      ok(tag + ' · 3 assign-bulk got plug client, role, 10 subject ids and Anna', !!a1 && a1.body.plug === 'client' && a1.body.role === 'adviser' && a1.body.subject_ids.length === 10 && a1.body.target_actor_id === ANNA.actor_id && !('chit_ids' in a1.body), JSON.stringify(a1));
      ok(tag + ' · 3 the line says 10 clients assigned', /10 clients assigned/.test(await page.locator('[data-testid="assign-result"]').innerText()));
      ok(tag + ' · 3 Held by now shows Anna on a ticked row', /Anna Lee/.test(await heldText(page, 1)), await heldText(page, 1));

      /* 4 twelve to Ben */
      await tick(page, first22.slice(10));
      await bulk(page, 'assign');
      await pickAndGo(page, BEN.display_name);
      await page.locator('[data-testid="assign-go"]').click();
      await pause(900);
      const a2 = api.calls.filter((c) => c.path === '/api/chits/assign-bulk')[1];
      ok(tag + ' · 4 12 clients to Ben', !!a2 && a2.body.subject_ids.length === 12 && a2.body.target_actor_id === BEN.actor_id, JSON.stringify(a2));
      ok(tag + ' · 4 the server holds 10 for Anna and 12 for Ben', [...api.holder.values()].filter((h) => h.name === 'Anna Lee').length === 10 && [...api.holder.values()].filter((h) => h.name === 'Ben Ortiz').length === 12);
      await page.screenshot({ path: file('4-assigned') });

      /* 5 hand one over, with a note */
      await tick(page, [id(1)]);
      await bulk(page, 'handover');
      await pickAndGo(page, BEN.display_name);
      await page.locator('[data-testid="assign-note"]').fill('Anna is on leave');
      await page.locator('[data-testid="assign-go"]').click();
      await pause(900);
      const a3 = api.calls.filter((c) => c.path === '/api/chits/assign-bulk')[2];
      ok(tag + ' · 5 hand over: one client, Ben, with the note', !!a3 && a3.body.subject_ids.length === 1 && a3.body.target_actor_id === BEN.actor_id && a3.body.note === 'Anna is on leave', JSON.stringify(a3));
      ok(tag + ' · 5 Held by now shows Ben on that row', /Ben Ortiz/.test(await heldText(page, 1)));

      /* 6 one back to the pool */
      await tick(page, [id(2)]);
      await bulk(page, 'pool');
      await pause(900);
      const a4 = api.calls.filter((c) => c.path === '/api/chits/assign-bulk')[3];
      ok(tag + ' · 6 back to pool sends target_actor_id null for that client', !!a4 && a4.body.target_actor_id === null && a4.body.subject_ids.length === 1 && a4.body.subject_ids[0] === id(2), JSON.stringify(a4));
      ok(tag + ' · 6 Held by says Unassigned again', /Unassigned/.test(await heldText(page, 2)), await heldText(page, 2));

      /* 7 a partial: client 30 has no job, client 2 has one (still open, unassigned) */
      await tick(page, [id(2), id(30)]);
      await bulk(page, 'assign');
      await pickAndGo(page, ANNA.display_name);
      await page.locator('[data-testid="assign-go"]').click();
      await pause(900);
      const shown = await page.locator('[data-testid="assign-result"]').innerText();
      ok(tag + ' · 7 a partial run says 1 assigned and the SERVER sentence for the skipped one', /1 client assigned/.test(shown) && shown.includes(NO_JOB), shown);
      await page.screenshot({ path: file('7-partial') });

      /* 8 a refused call: the server's own sentence, nothing assigned */
      api.refuse = true;
      const before = api.holder.size;
      await tick(page, [id(5)]);
      await bulk(page, 'assign');
      await pickAndGo(page, ANNA.display_name);
      await page.locator('[data-testid="assign-go"]').click();
      await pause(900);
      const refused = await page.locator('[data-testid="assign-result"]').innerText();
      ok(tag + ' · 8 a refusal shows exactly the server sentence', refused.trim() === REFUSAL, refused);
      ok(tag + ' · 8 nothing changed', api.holder.size === before);
      await page.screenshot({ path: file('8-refused') });
      ok(tag + ' · no sideways scroll at the end', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(tag + ' · no script error from the assign parts', !page.__threw.some((m) => /assign|CBAssign/i.test(m)), page.__threw.join(' | '));
      await ctx.close();

      /* 9 an assistant: own clients, Held by, no bulk bar, no select mode */
      const mine2 = standIn(); mine2.assistant = true;
      const asst = await open(browser, base, mine2, vp, theme, 'assistant');
      const n = await rows(asst.page);
      ok(tag + ' · 9 the assistant sees only their own 5 clients', n === 5, n);
      ok(tag + ' · 9 the assistant has no bulk bar and no select mode', (await asst.page.locator('[data-bulk]').count()) === 0 && (await asst.page.locator('[data-cbl-selmode]').count()) === 0);
      ok(tag + ' · 9 Held by shows their own name', /Dev Assistant/.test(await asst.page.locator('[data-testid^="practice-row-"]').first().innerText()));
      await asst.page.screenshot({ path: file('9-assistant') });
      await asst.ctx.close();
    }
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed · shots: ' + OUT);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
