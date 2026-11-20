'use strict';
/**
 * e2e/walk-assign-bulk.cjs — ASSIGN-W2 (CBAssign v2), the web side: the firm's client list on Home shows the Held-by chip; the owner or a manager assigns with two presses (chip, person), ticks rows with no mode, uses the 3-button bar (Assign to… · Hand over · Back to pool) and undoes from the previous holders the server returns.
 * The api is a STAND-IN (no real api, no network): its answers are the shapes of PM/firm-staff/DECISIONS-SLICE1.md "api contract" (assign-bulk widened, jobs/open, practice holders, actors job_assignable).
 * Pattern: e2e/walk-firm-landing.cjs (static server for the repo, the page's default api base routed to the stand-in).
 * Steps, at 1366x768 and 390x844, light and dark:
 *   1 150 clients, an empty chip (+ Assign to…) on every row · 2 always-on ticks, bar of 3 buttons, no Open jobs · 3 assign 10 to Anna (the popover lists only job_assignable people, nobody pre-picked) · 3b one chip press then a person · 3c Undo puts the previous holders back · 3d key A · 4 assign 12 to Ben · 5 hand one over to Ben with a note
 *   6 one back to the pool (target_actor_id null) · 7 a partial: 1 assigned, 1 skipped with the SERVER's sentence · 8 a refused call shows the server's sentence, nothing else · 9 an assistant: own clients, no bulk bar
 *   every size: no sideways scroll; contrast of the new parts at AA (4.5:1)
 *   W3 (1366 light, after the loop): CRM follow-ups (Held-by chip, one write per follow-up, Undo, bulk bar of 3) · Employees (Holds column, Hand over all… -> hand-over-all, Undo only when every moved item is a chit)
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
const C = require('./lib/contract.cjs');
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
  const s = { jobs: new Set(Array.from({ length: 29 }, (_, i) => id(i + 1))), holder: new Map(), calls: [], refuse: false, assistant: false };
  const rowOf = (n, mine) => ({
    entity_id: id(n), currency: 'AUD', name: 'Client ' + String(n).padStart(3, '0') + ' demo', role: n === 150 ? 'auditor' : 'adviser', stage: 'books_in', stage_blocker: null,
    year_end: { fy: '2025-26', of: 12, locked: 6, bank_to_end: false, end: '2026-06-30' }, queries: { open: 0, on_us: 0 }, bank: { state: 'reconciled', unexplained_minor: 0 },
    health: { status: 'good', words: 'Doing well', reasons: [], withheld: { costs: null, currencies: null }, gross_margin_pct: 40, profit_quarter_minor: 500, cash_minor: 900, codes: [] },
    checked: { n: 1, of: 1 }, months_unlocked: 1, bas: { due_date: null, due_in_days: null }, grant: { can_see_costs: true, expires_at: null, ends_in_days: 400 }, last_look: null, action_count: 0,
    holders: s.holder.has(id(n)) ? [s.holder.get(id(n))] : []
  });
  s.practice = () => {
    const rows = s.assistant ? [1, 2, 3, 4, 5].map((n) => { s.holder.set(id(n), { actor_id: 'self', name: 'Dev Assistant' }); return rowOf(n); }) : Array.from({ length: 150 }, (_, i) => rowOf(i + 1));
    return { rule: 'r', words: WORDS, today: '2026-11-17', band: { bands: [{ key: 'pipeline', first: true, tiles: [] }], pipeline: [] }, clients: rows, may_assign: !s.assistant, total: rows.length, page: 1, limit: 200, has_more: false, truncated: false, own_trade: false };
  };
  s.assignBulk = (body) => {
    if (s.refuse) return { status: 403, body: { type: 'about:blank', title: 'Not permitted', status: 403, code: 'CHIT_NOT_PERMITTED', detail: REFUSAL, may: false, why: REFUSAL, message: REFUSAL } };
    const skipped = [], previous = []; let assigned = 0;
    body.subject_ids.forEach((sub) => {
      if (!s.jobs.has(sub)) return skipped.push({ subject_id: sub, code: 'JOB_NOT_OPEN', reason: NO_JOB });
      previous.push({ chit_id: 'h-' + sub, subject_id: sub, actor_id: s.holder.has(sub) ? s.holder.get(sub).actor_id : null });
      if (body.target_actor_id === null) s.holder.delete(sub);
      else s.holder.set(sub, { actor_id: body.target_actor_id, name: body.target_actor_id === ANNA.actor_id ? ANNA.display_name : BEN.display_name });
      assigned++;
    });
    return { status: 200, body: { message: assigned + ' assigned', assigned_to: body.target_actor_id, assigned, skipped, previous } };
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
  await ctx.route(/^http:\/\/(localhost:3000|127\.0\.0\.1:\d+)\/api\//, async (route) => {
    const r = C.wrap(route);   /* M43: each answer for a route in the API contract is held to it */
    const req = r.request(), u = new URL(req.url());
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.pathname.includes('/events/stream')) return r.abort();
    const send = (status, body) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/api/entities/me') return send(200, { entity: { display_name: 'Coastal Accounting Advisers', currency_code: 'AUD' } });
    if (u.pathname === '/api/books-grants/practice') return send(200, api.practice());
    if (u.pathname === '/api/actors' && req.method() === 'GET') return send(200, { suggested: BEN.actor_id, actors: [{ ...ANNA, open_load: 4 }, { ...BEN, open_load: 2, suggested: true }, CARA], total: 3, page: 1, limit: 100, summary: {} });
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
  for (const x of ids) await page.locator('[data-selrow="' + x + '"]').check(); /* always-on ticks: no Select mode */
}
async function bulk(page, which) { await page.locator('[data-bulk="' + which + '"]').click(); }
/** the popover (ui.dialog): press a person by name; nothing is pre-picked, so one press is the whole answer */
async function pickAndGo(page, name, note) {
  await page.waitForSelector('[data-as-pick]');
  if (note) await page.locator('[data-testid="assign-note"]').fill(note);
  await page.locator('[data-as-pick]', { hasText: name }).first().click();
}
const heldText = (page, n) => page.locator('[data-testid="practice-row-' + id(n) + '"]').innerText();
const sleep = pause;

/* ── ASSIGN-W3: CRM follow-ups and Employees on the same CBAssign (1366, light) ─────────────────────────────────────────────────────────────────────────── */
const FU = (n, who) => ({ followup_id: 'fu-' + n, party_id: 'p-' + n, party_no: null, party_name: 'Party ' + n, party_listed: true, what: 'Call back ' + n, due_at: '2026-11-19T09:00:00.000Z', due_day: '2026-11-19',
  assignee_user_id: who ? who.actor_id : null, assignee_name: who ? who.display_name : null, source: 'manual', done_at: null, created_at: '2026-11-17T09:00:00.000Z', late: false, today: false, bucket: 'week' });
const EMP = (id, name, state) => ({ id, name, user_id: id + '@walk.br', role: 'Staff', phone: '', state, jobs: 0, last_at: null, access: { key: 'manager', label: 'Manager', why: 'Sees the whole shop.', level: 'editor', whole_entity: true, can_see_costs: false },
  may: { access: { ok: true }, email: { ok: true }, reset_pin: { ok: true }, switch: { ok: true, to: state === 'on' ? 'off' : 'on' }, cover: { ok: true } }, cover: null, cover_options: [] });
async function w3Page(browser, base, handler, url, readySel) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-AU', serviceWorkers: 'block' });
  const sess = { token: b64({ alg: 'none' }) + '.' + b64({ identity_id: 'e0000000-0000-4000-8000-000000000001', display_name: 'Fixture Shop' }) + '.ownertoken1234', role: 'entity', name: 'Fixture Shop' };
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, sess);
  await ctx.route(/^http:\/\/(localhost:3000|127\.0\.0\.1:\d+)\/api\//, async (route) => {
    const r = C.wrap(route);   /* M43: each answer for a route in the API contract is held to it */
    const req = r.request(), u = new URL(req.url());
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.pathname.includes('/events/stream')) return r.abort();
    const send = (status, body) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    let body = null; try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch (_) {}
    if (u.pathname === '/api/entities/me') return send(200, { entity: { display_name: 'Fixture Shop', currency_code: 'AUD' } });
    if (u.pathname === '/api/actors' && req.method() === 'GET') return send(200, { actors: [ANNA, BEN, CARA].map((a) => ({ ...a, open_load: 1 })), total: 3, page: 1, limit: 100 });
    const out = handler(u.pathname, req.method(), body, send);
    return out === undefined ? send(404, { error: 'not found' }) : out;
  });
  const page = await ctx.newPage();
  page.__threw = [];
  page.on('pageerror', (e) => page.__threw.push(e.message));
  await page.goto(base + url);
  await page.waitForSelector(readySel, { timeout: 30000 }).catch(() => {});
  await pause(600);
  return { ctx, page };
}
async function w3Crm(browser, base) {
  const calls = [], fus = [FU(1, null), FU(2, null), FU(3, ANNA)];
  const crmMay = { write: { may: true, code: null, why: null }, remove: { ok: true, code: null, why: null }, assign: { ok: true, code: null, why: null } };
  const { ctx, page } = await w3Page(browser, base, (p, m, body, send) => {
    if (p === '/api/crm/followups' && m === 'GET') return send(200, { followups: fus, total: fus.length, page: 1, limit: fus.length, may: crmMay, late: 0, today: 0, shop_day: '2026-11-18' });
    if (p === '/api/crm/parties' && m === 'GET') return send(200, { parties: [], walk_ins: [], count: 0, total: 0, page: 1, limit: 5000, truncated: false, may: crmMay, alerts: { dues_overdue: 0 } });
    const mm = /^\/api\/crm\/followups\/([^/]+)$/.exec(p);
    if (mm && (m === 'PATCH' || m === 'PUT')) { calls.push({ path: p, method: m, body }); const f = fus.find((x) => x.followup_id === mm[1]); const t = [ANNA, BEN].find((x) => x.actor_id === body.assignee_user_id); if (f) { f.assignee_user_id = t ? t.actor_id : null; f.assignee_name = t ? t.display_name : null; } return send(200, { followup: f }); }
  }, '/crm.html#/followups', '[data-testid="crm-fu-list"]');
  const tag = 'w3 crm follow-ups';
  await page.waitForSelector('[data-testid="crm-fu-list"] [data-testid="assign-chip"]', { timeout: 15000 }).catch(() => {});
  const chips = await page.locator('[data-testid="crm-fu-list"] [data-testid="assign-chip"]').count();
  ok(tag + ' · 1 the Held-by column draws a chip on every follow-up (3)', chips === 3, chips);
  ok(tag + ' · 1 the empty ones say "+ Assign to…", the held one says Anna Lee', /Assign to/.test(await page.locator('[data-testid="crm-fu-fu-1"]').innerText()) && /Anna Lee/.test(await page.locator('[data-testid="crm-fu-fu-3"]').innerText()));
  ok(tag + ' · 1 the old Assign button (CRM001-B07) is gone', (await page.locator('[data-cbsid="CRM001-B07"]').count()) === 0);
  await page.locator('[data-testid="crm-fu-fu-1"] [data-testid="assign-chip"]').click();
  await page.waitForSelector('[data-as-pick]');
  const names = await page.locator('[data-as-pick]').allInnerTexts();
  ok(tag + ' · 2 the popover lists the people the server flags (Anna, Ben; not Cara)', names.some((n) => /Anna Lee/.test(n)) && names.some((n) => /Ben Ortiz/.test(n)) && !names.some((n) => /Cara/.test(n)), names);
  await pickAndGo(page, 'Ben Ortiz');
  await pause(900);
  const c1 = calls[0];
  ok(tag + ' · 2 one chip press then a person: ONE write to /api/crm/followups/fu-1 { assignee_user_id: Ben }', calls.length === 1 && !!c1 && /fu-1$/.test(c1.path) && c1.body.assignee_user_id === BEN.actor_id, JSON.stringify(calls));
  ok(tag + ' · 2 the result line says it and the chip now reads Ben Ortiz', /1 follow-up/.test(await page.locator('[data-testid="assign-result"]').innerText()) && /Ben Ortiz/.test(await page.locator('[data-testid="crm-fu-fu-1"]').innerText()));
  ok(tag + ' · 2 Undo is offered and puts the previous holder (nobody) back', (await page.locator('[data-testid="assign-undo"]').count()) === 1);
  await page.locator('[data-testid="assign-undo"]').click(); await pause(900);
  ok(tag + ' · 2 Undo wrote one more call with assignee_user_id null', calls.length === 2 && calls[1].body.assignee_user_id === null, JSON.stringify(calls.slice(1)));
  /* the bar: tick two, the 3 buttons, assign both to Anna */
  await tick(page, ['fu-1', 'fu-2']);
  const bar = await page.locator('[data-bulk]').evaluateAll((els) => els.map((e) => e.getAttribute('data-bulk')));
  ok(tag + ' · 3 the bulk bar shows Assign to… · Hand over · Back to pool', ['assign', 'handover', 'pool'].every((b) => bar.includes(b)), bar);
  await bulk(page, 'assign'); await pickAndGo(page, 'Anna Lee'); await pause(1200);
  const patched = calls.slice(2);
  ok(tag + ' · 3 two ticked follow-ups = two writes, both to Anna, one result line', patched.length === 2 && patched.every((c) => c.body.assignee_user_id === ANNA.actor_id) && /2 follow-ups/.test(await page.locator('[data-testid="assign-result"]').innerText()), JSON.stringify(patched));
  ok(tag + ' · no script error from the assign parts', !page.__threw.some((x) => /assign|CBAssign|crmFu/i.test(x)), page.__threw.join(' | '));
  await ctx.close();
}
async function w3Employees(browser, base) {
  const calls = [];
  const people = [EMP('p1', 'Anna Lee', 'on'), EMP('p2', 'Ben Ortiz', 'on'), EMP('p3', 'Cara Viewer', 'on')];
  const HOLDS = { p1: { actor_id: 'p1', name: 'Anna Lee', total: 3, followups: 1, plugs: [{ plug: 'task', count: 2 }, { plug: 'followup', count: 1 }] }, p2: { actor_id: 'p2', name: 'Ben Ortiz', total: 2, followups: 0, plugs: [{ plug: 'task', count: 2 }] }, p3: { actor_id: 'p3', name: 'Cara Viewer', total: 0, followups: 0, plugs: [] } };
  let moved = 'chits';
  const { ctx, page } = await w3Page(browser, base, (p, m, body, send) => {
    if (p === '/api/people' && m === 'GET') return send(200, { people: people, may: { add: { ok: true } }, access_choices: [], counts: { on: 3, off: 0 }, payroll: { here: false, said: 'Pay is not done here yet.' } });
    if (p === '/api/chits/holds' && m === 'GET') return send(200, { people: Object.values(HOLDS) });
    if (p === '/api/chits/hand-over-all' && m === 'POST') {
      calls.push({ path: p, body });
      const previous = moved === 'chits'
        ? [{ chit_id: 'h1', subject_id: 'c1', plug: 'task', role: '', actor_id: body.from_actor_id }, { chit_id: 'h2', subject_id: 'c2', plug: 'task', role: '', actor_id: body.from_actor_id }]
        : [{ chit_id: 'h1', subject_id: 'c1', plug: 'task', role: '', actor_id: body.from_actor_id }, { subject_id: 'fu-9', plug: 'followup', actor_id: body.from_actor_id }];
      return send(200, { moved: previous.length, skipped: [], previous });
    }
    if (p === '/api/chits/assign-bulk' && m === 'POST') { calls.push({ path: p, body }); return send(200, { assigned: (body.subject_ids || []).length, skipped: [], previous: [] }); }
  }, '/employees.html', '[data-testid="emp-list"]');
  const tag = 'w3 employees';
  await page.waitForSelector('[data-testid="emp-row-p1"]', { timeout: 15000 }).catch(() => {});
  const head = await page.locator('[data-testid="emp-list"]').innerText();
  ok(tag + ' · 1 the list has a Holds column; Anna 3, Ben 2', /Holds/i.test(head) && /3/.test(await page.locator('[data-testid="emp-row-p1"]').innerText()) && /2/.test(await page.locator('[data-testid="emp-row-p2"]').innerText()), head.slice(0, 200));
  await page.locator('[data-testid="emp-row-p1"]').click(); await page.waitForSelector('#emp_handall', { timeout: 6000 });
  ok(tag + ' · 2 the sheet says what Anna holds in words (2 tasks · 1 follow-up) and Hand over all… is open', /2 tasks/.test(await page.locator('[data-testid="emp-holds-now"]').innerText()) && (await page.$eval('#emp_handall', (b) => b.disabled)) === false);
  await page.click('#emp_handall'); await pause(500);
  ok(tag + ' · 2 the sheet closes first and the one person popover opens', !(await page.$eval('[data-testid="emp-sheet"]', (d) => d.open).catch(() => false)) && (await page.locator('[data-as-pick]').count()) > 0);
  await pickAndGo(page, 'Ben Ortiz'); await pause(900);
  ok(tag + ' · 2 ONE POST /api/chits/hand-over-all { from p1, to Ben }', calls.length === 1 && calls[0].body.from_actor_id === 'p1' && !!calls[0].body.to_actor_id, JSON.stringify(calls));
  ok(tag + ' · 2 every moved item is a chit: the result line carries Undo', (await page.locator('[data-testid="assign-undo"]').count()) === 1);
  /* a follow-up among the moved items: no undo route yet, so no Undo */
  moved = 'mixed';
  await page.locator('[data-testid="emp-row-p1"]').click(); await page.waitForSelector('#emp_handall', { timeout: 6000 });
  await page.click('#emp_handall'); await pickAndGo(page, 'Ben Ortiz'); await pause(900);
  ok(tag + ' · 3 a follow-up among the moved items: the result says what moved and shows NO Undo', calls.length === 2 && /2/.test(await page.locator('[data-testid="assign-result"]').innerText()) && (await page.locator('[data-testid="assign-undo"]').count()) === 0);
  ok(tag + ' · no script error from the assign parts', !page.__threw.some((x) => /assign|CBAssign|emp/i.test(x)), page.__threw.join(' | '));
  await ctx.close();
}

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
      ok(tag + ' · 1 Held by is plain text, no button on the row (a dash when nobody holds it)', (await page.locator('[data-testid="practice-row-' + id(1) + '"] [data-as-chip]').count()) === 0 && (await page.locator('[data-testid="practice-row-' + id(1) + '"] [data-testid="assign-held"]').first().innerText()).trim() === '—', await heldText(page, 1));
      ok(tag + ' · 1 the quick views Mine · Unassigned · Everyone are on the first paint', /Mine[^]*Unassigned[^]*Everyone/.test(await page.locator('.cbl-views').first().innerText()));
      ok(tag + ' · no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await page.screenshot({ path: file('1-list') });

      /* 2 always-on ticks: the bar appears on the first tick, three buttons, no Open jobs */
      const first22 = Array.from({ length: 22 }, (_, i) => id(i + 1));
      ok(tag + ' · 2 no Select mode button and no bar before a tick', (await page.locator('[data-cbl-selmode]').count()) === 0 && (await page.locator('[data-bulk]').count()) === 0);
      await tick(page, first22);
      ok(tag + ' · 2 the bar offers Assign to me, Assign to…, Hand over, Back to pool (4 buttons, no Open jobs; MTX-new-4 put Assign to me first)', (await page.locator('[data-bulk]').count()) === 4, await page.locator('[data-bulk]').allInnerTexts());
      ok(tag + ' · 2 the count is said once: 22 selected', /22 selected/.test(await page.locator('[data-testid^="cbl-selcount-"]').first().innerText()));
      await page.screenshot({ path: file('2-bulk-bar') });

      /* 3 ten to Anna */
      await page.locator('[data-cbl-selclear]').click();
      await tick(page, first22.slice(0, 10));
      await bulk(page, 'assign');
      await page.waitForSelector('[data-as-pick]');
      const names = await page.locator('[data-as-pick]').evaluateAll((els) => els.map((e) => e.getAttribute('data-as-name')));
      ok(tag + ' · 3 the popover lists only job_assignable people (Anna, Ben; not Cara), nobody pre-picked', names.includes(ANNA.display_name) && names.includes(BEN.display_name) && !names.includes(CARA.display_name) && (await page.locator('[data-as-pick][aria-pressed="true"]').count()) === 0, names);
      await page.screenshot({ path: file('3-picker') });
      const dark = await page.evaluate(measure);
      const mine = dark.filter((e) => /assign-|data-as-|data-bulk|mhd|mbody/.test(e.html) && !e.grad);
      ok(tag + ' · AA contrast on the popover, the chip and the bar (' + mine.length + ' text elements measured)', mine.length > 0 && mine.every((e) => e.ratio >= e.need), JSON.stringify(mine.filter((e) => e.ratio < e.need).map((e) => e.text + ' ' + e.ratio)));
      await pickAndGo(page, ANNA.display_name);
      await pause(900);
      const a1 = api.calls.filter((c) => c.path === '/api/chits/assign-bulk')[0];
      ok(tag + ' · 3 assign-bulk got plug client, role, 10 subject ids and Anna', !!a1 && a1.body.plug === 'client' && a1.body.role === 'adviser' && a1.body.subject_ids.length === 10 && a1.body.target_actor_id === ANNA.actor_id && !('chit_ids' in a1.body), JSON.stringify(a1));
      ok(tag + ' · 3 the line says 10 clients assigned', /10 clients assigned to Anna Lee/.test(await page.locator('[data-testid="assign-result"]').innerText()));
      ok(tag + ' · 3 the ticks stay after the action and the bar stays for the next group', (await page.locator('[data-bulk]').count()) === 4);
      ok(tag + ' · 3 Held by now shows Anna on a ticked row', /Anna Lee/.test(await heldText(page, 1)), await heldText(page, 1));

      /* 4 twelve to Ben: Clear the first group, tick the next */
      await page.locator('[data-cbl-selclear]').click();
      await tick(page, first22.slice(10));
      await bulk(page, 'assign');
      await pickAndGo(page, BEN.display_name);
      await pause(900);
      const a2 = api.calls.filter((c) => c.path === '/api/chits/assign-bulk')[1];
      ok(tag + ' · 4 12 clients to Ben', !!a2 && a2.body.subject_ids.length === 12 && a2.body.target_actor_id === BEN.actor_id, JSON.stringify(a2));
      ok(tag + ' · 4 the server holds 10 for Anna and 12 for Ben', [...api.holder.values()].filter((h) => h.name === 'Anna Lee').length === 10 && [...api.holder.values()].filter((h) => h.name === 'Ben Ortiz').length === 12);
      await page.screenshot({ path: file('4-assigned') });

      /* 5 hand one over, with a note */
      await page.locator('[data-cbl-selclear]').click();
      await tick(page, [id(1)]);
      await bulk(page, 'handover');
      await pickAndGo(page, BEN.display_name, 'Anna is on leave');
      await pause(900);
      const a3 = api.calls.filter((c) => c.path === '/api/chits/assign-bulk')[2];
      ok(tag + ' · 5 hand over: one client, Ben, with the note', !!a3 && a3.body.subject_ids.length === 1 && a3.body.target_actor_id === BEN.actor_id && a3.body.note === 'Anna is on leave', JSON.stringify(a3));
      ok(tag + ' · 5 Held by now shows Ben on that row', /Ben Ortiz/.test(await heldText(page, 1)));

      /* 6 one back to the pool */
      await page.locator('[data-cbl-selclear]').click();
      await tick(page, [id(2)]);
      await bulk(page, 'pool');
      await pause(900);
      const a4 = api.calls.filter((c) => c.path === '/api/chits/assign-bulk')[3];
      ok(tag + ' · 6 back to pool sends target_actor_id null for that client', !!a4 && a4.body.target_actor_id === null && a4.body.subject_ids.length === 1 && a4.body.subject_ids[0] === id(2), JSON.stringify(a4));
      ok(tag + ' · 6 Held by is empty again (a dash)', /—/.test(await page.locator('[data-testid="practice-row-' + id(2) + '"] [data-testid="assign-held"]').first().innerText()), await heldText(page, 2));

      /* 3b one press on a chip, one on a person; 3c Undo from the previous holders; 3d the A key */
      await page.locator('[data-cbl-selclear]').click();
      const callsBefore = api.calls.filter((c) => c.path === '/api/chits/assign-bulk').length;
      await page.locator('[data-testid="practice-row-' + id(23) + '"]').first().focus();
      await page.keyboard.press('a');
      await page.waitForSelector('[data-as-pick]');
      ok(tag + ' · 3b the popover for ONE client shows the suggested person first', /Suggested/.test(await page.locator('[data-as-pick]').first().innerText()), await page.locator('[data-as-pick]').first().innerText());
      await pickAndGo(page, ANNA.display_name);
      await pause(900);
      ok(tag + ' · 3b two presses assigned one client', api.calls.filter((c) => c.path === '/api/chits/assign-bulk').length === callsBefore + 1);
      await page.locator('[data-testid="assign-undo"]').click();
      await pause(900);
      const undoCall = api.calls.filter((c) => c.path === '/api/chits/assign-bulk').slice(-1)[0];
      ok(tag + ' · 3c Undo sends the previous holder (the pool, null) for that client', !!undoCall && undoCall.body.target_actor_id === null && undoCall.body.subject_ids[0] === id(23), JSON.stringify(undoCall) + ' | result: ' + (await page.locator('[data-testid="assign-result"]').innerText()));
      await page.locator('[data-testid="practice-row-' + id(4) + '"]').first().focus();
      await page.keyboard.press('a');
      await page.waitForSelector('[data-as-pick]');
      ok(tag + ' · 3d the A key opens the popover on a focused row', (await page.locator('[data-as-pick]').count()) > 0);
      await page.keyboard.press('Escape');
      await pause(300);

      /* 7 a partial: client 30 has no job, client 2 has one (still open, unassigned) */
      await tick(page, [id(2), id(30)]);
      await bulk(page, 'assign');
      await pickAndGo(page, ANNA.display_name);
      await pause(900);
      const shown = await page.locator('[data-testid="assign-result"]').innerText();
      ok(tag + ' · 7 a partial run says 1 assigned and the SERVER sentence for the skipped one', /1 client assigned to Anna Lee/.test(shown) && shown.includes(NO_JOB), shown);
      await page.screenshot({ path: file('7-partial') });

      /* 8 a refused call: the server's own sentence, nothing assigned */
      api.refuse = true;
      const before = api.holder.size;
      await tick(page, [id(5)]);
      await bulk(page, 'assign');
      await pickAndGo(page, ANNA.display_name);
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
      ok(tag + ' · 9 the assistant has no bulk bar and no select mode', (await asst.page.locator('[data-bulk]').count()) === 0 && (await asst.page.locator('[data-selrow]').count()) === 0 && (await asst.page.locator('[data-as-chip]').count()) === 0);
      ok(tag + ' · 9 Held by shows their own name', /Dev Assistant/.test(await asst.page.locator('[data-testid^="practice-row-"]').first().innerText()));
      await asst.page.screenshot({ path: file('9-assistant') });
      await asst.ctx.close();
    }
  }
  console.log('--- ASSIGN-W3 mounts');
  await w3Crm(browser, base);
  await w3Employees(browser, base);
  const verdict = C.finish();
  ok('every answer the stand-in served for a route in the API contract matches it (keys, nesting, types)', verdict[0], verdict[1]);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed · shots: ' + OUT);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
