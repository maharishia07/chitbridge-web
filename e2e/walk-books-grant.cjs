#!/usr/bin/env node
/**
 * e2e/walk-books-grant.cjs — ACC-176 WALKED: "Who can see my books" (the member) and "Open books" (the auditor), on a MOCKED api.
 *
 * OWNS      the proof of the two web screens of the auditor grant: (member) the grant list, the plain-words consent, Give access held until yes and asked in a confirm that names who, until when and read only,
 *           End access, Who looked; (auditor) "Open books" only on a store with a live grant, the "Viewing <store> — read only" band, the X-Books-For header on every read, a refusal said in the server's words, Back to My network.
 *           Fit at 1366×768 and 390×844 with no page scroll, a keyboard path through the auditor's screen, no write control in the read-only view.
 * CALLED BY e2e/run-shard.cjs (walk-*.cjs) · the PR's CI walk
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 * Which api: a STAND-IN. The answers are the shapes of api PR #1302 (routes/books-grants.js, lib/books-grants-contract.js, middleware/books-grant.js). It proves the web; the server's rules (RLS, the allow-list, the log) are proved by the api's own acc-176 tests.
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-books-grant.cjs
 */
'use strict';
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');   /* every /api/books answer the stand-in serves is held to the api's own examples */
const T = (id) => '[data-testid="' + id + '"]';
const WIDE = { width: 1366, height: 768 }, NARROW = { width: 390, height: 844 };
const MEMBER = 'a0000000-0000-4000-8000-000000000001', OTHER = 'a0000000-0000-4000-8000-000000000002', BRAND = 'b0000000-0000-4000-8000-000000000009';
const GRANT = 'c0000000-0000-4000-8000-000000000001';
const DAY = (n) => new Date(W.nowMs() + n * 86400000).toISOString();

W.run('books-grant', async (w) => {
  const { page, ctx, base } = w;
  const S = { calls: [], gives: [], revokes: [], given: [], refuse: null };
  const reset = () => { S.given = [{ grant_id: GRANT, grantor_entity: MEMBER, grantee_entity: BRAND, preset: 'auditor', can_see_costs: true, purpose: 'Year-end audit', granted_at: DAY(-5), expires_at: DAY(200), revoked_at: null, state: 'live' }]; };
  reset();
  const J = (r, status, body) => C.json(r, status, body);
  const example = (key) => { const hit = C.load().routes.filter((e) => e.key === key)[0]; return hit ? JSON.parse(JSON.stringify(hit.example)) : {}; };   /* the api's own answer shape, then our figures over it */
  const line = (ex, over) => Object.assign({}, ex, over);

  await ctx.route(base + '/api/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method(), h = q.headers();
    S.calls.push({ m, p, q: u.search, h });
    if (p === '/api/network-offers') return J(r, 200, { store: { networks: [{ brand_id: BRAND, brand_name: 'Acme Brand', policy: 'open', membership: { state: 'active' }, offers: [] }], price_notices: [] }, may_design: { ok: false, why: 'Only the owner designs a network.' } });
    if (p === '/api/network-design/stores') return J(r, 200, { stores: [{ entity_id: MEMBER, name: 'Store One', city: 'Pune', km: 4, purpose: 'Tea' }, { entity_id: OTHER, name: 'Store Two', city: 'Delhi', km: 9, purpose: 'Snacks' }] });
    if (p === '/api/books-grants/consent') return J(r, 200, { headline: 'Let your network parent read your books', can_read: ['your trial balance', 'your profit and loss'], cannot: ['change or add anything'], costs: u.searchParams.get('can_see_costs') === 'false' ? 'It will not see your costs and margins.' : 'It will see your costs and margins.', rights: 'You can end this at any time.' });
    if (p === '/api/books-grants/log') return J(r, 200, { looks: [{ at: DAY(-1), grant_id: GRANT, grantee_entity: BRAND, actor_identity_id: 'x', route_pattern: 'GET /trial-balance', query_shape: null, status: 200, outcome: 'allowed' }, { at: DAY(-2), grant_id: GRANT, grantee_entity: BRAND, actor_identity_id: 'x', route_pattern: 'GET /packs', query_shape: null, status: 403, outcome: 'not_listed' }] });
    if (p === '/api/books-grants' && m === 'GET') return J(r, 200, { given: S.given, received: [{ grant_id: GRANT, grantor_entity: MEMBER, grantee_entity: BRAND, state: 'live', expires_at: DAY(200) }] });
    if (p === '/api/books-grants' && m === 'POST') { S.gives.push(JSON.parse(q.postData() || '{}')); return J(r, 201, { grant_id: GRANT, grantor_entity: MEMBER, grantee_entity: BRAND, purpose: 'x', expires_at: DAY(300) }); }
    if (/\/api\/books-grants\/[^/]+\/revoke$/.test(p)) { S.revokes.push(p); S.given = S.given.map((g) => Object.assign({}, g, { state: 'revoked', revoked_at: DAY(0) })); return J(r, 200, { grant_id: GRANT }); }
    if (p.indexOf('/api/books/') === 0) {
      if (h['x-books-for'] !== MEMBER) return J(r, 403, { error: 'No access has been given for these books.', message: 'No access has been given for these books.' });
      if (S.refuse && p === S.refuse.path) return J(r, 403, { error: S.refuse.words, message: S.refuse.words, code: 'GRANT_ROUTE_NOT_LISTED' });
      if (p === '/api/books/trial-balance') { const ex = example('GET /api/books/trial-balance'); return J(r, 200, Object.assign(ex, { currency: 'INR', rows: [line(ex.rows[0], { code: '1000', name: 'Cash', group: 'Assets', dr_minor: 123400, cr_minor: 0 }), line(ex.rows[0], { code: '4000', name: 'Sales', group: 'Income', dr_minor: 0, cr_minor: 123400 })], total_dr_minor: 123400, total_cr_minor: 123400, balanced: true })); }
      if (p === '/api/books/pl') { const ex = example('GET /api/books/pl'); return J(r, 200, Object.assign(ex, { currency: 'INR', income: [line(ex.income[0], { code: '4000', name: 'Sales', amount_minor: 500000 })], expense: [line(ex.expense[0], { code: '5000', name: 'Rent', amount_minor: 100000 })], total_income_minor: 500000, total_expense_minor: 100000, profit_minor: 400000 })); }
      const ex = example('GET ' + p); return J(r, 200, Object.assign(ex, { entries: [], parties: [], periods: [] }));
    }
    return J(r, 200, {});
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const has = (sel) => page.locator(sel).count().then((n) => n > 0);
  const noScroll = () => page.evaluate(() => ({ y: document.documentElement.scrollHeight <= window.innerHeight + 1, x: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
  const openNetwork = async () => { await page.goto(base + '/network.html'); await page.waitForSelector(T('nw-store-' + MEMBER), { timeout: 20000 }); await page.waitForTimeout(300); };
  const booksSection = async () => { await page.click(T('nw-books-door')); await page.waitForSelector(T('bg-give'), { timeout: 10000 }); await page.waitForTimeout(300); };

  /* ═══ the auditor ═══ */
  await page.setViewportSize(WIDE);
  await openNetwork();
  await w.step('A1', 'the auditor · My network · "Open books" only on the store with a live grant', async () => {
    const one = await has(T('nw-books-' + MEMBER)), two = await has(T('nw-books-' + OTHER));
    return { ok: one && !two, saw: 'Store One button: ' + one + ' · Store Two button: ' + two };
  });
  await w.step('A2', 'the auditor · keyboard: focus "Open books", Enter → the band says "Viewing Store One — read only", the trial balance is listed', async () => {
    await page.focus(T('nw-books-' + MEMBER)); await page.keyboard.press('Enter');
    await page.waitForSelector(T('bv-band'), { timeout: 10000 }); await page.waitForSelector(T('bv-row-0'), { timeout: 10000 });
    const band = await txt(T('bv-band')), rows = await txt(T('bv-list'));
    const asked = S.calls.filter((c) => c.p === '/api/books/trial-balance');
    return { ok: /Viewing Store One — read only/.test(band) && /Cash/.test(rows) && /1,234|1234/.test(rows) && asked.length > 0 && asked.every((c) => c.h['x-books-for'] === MEMBER), saw: band + ' · ' + rows.slice(0, 80) + ' · header sent ' + asked.length + '×' };
  });
  await w.step('A3', 'the auditor · the view has no write control (every button is Back or a report)', async () => {
    const names = await page.$$eval(T('bv-band') + ' button,' + T('bv-tabs') + ' button', (els) => els.map((e) => e.textContent.trim()));
    return { ok: names.every((n) => /Back|Trial|Profit|Balance|Day|owes|Closed/.test(n)) && !(await has('#nw_body [data-act]')), saw: names.join(' · ') };
  });
  await w.step('A4', 'the auditor · Profit and loss by keyboard: Tab to the tab, Enter → income, expense and the profit', async () => {
    await page.focus(T('bv-tab-pl')); await page.keyboard.press('Enter');
    await page.waitForSelector(T('bv-fact-profit_minor'), { timeout: 10000 });
    const facts = await txt(T('bv-facts')), rows = await txt(T('bv-list'));
    return { ok: /Profit/.test(facts) && /Rent/.test(rows) && /Sales/.test(rows), saw: facts + ' · ' + rows.slice(0, 70) };
  });
  await w.step('A5', 'the auditor · a part the server refuses is said in the server\'s words, not shown as an empty table', async () => {
    S.refuse = { path: '/api/books/bs', words: 'This part of the books is not open to an auditor.' };
    await page.click(T('bv-tab-bs')); await page.waitForSelector(T('bv-why'), { timeout: 10000 });
    const why = await txt(T('bv-why')), tbl = await has(T('bv-row-0'));
    S.refuse = null;
    return { ok: why === 'This part of the books is not open to an auditor.' && !tbl, saw: why };
  });
  await w.step('A6', 'the auditor · fits 1366×768 with no page scroll, in the view and on the list', async () => {
    const a = await noScroll();
    return { ok: a.y && a.x, saw: 'no vertical scroll ' + a.y + ' · no sideways ' + a.x };
  });
  await w.step('A7', 'the auditor · Back to My network → the list again, focus on the same "Open books"', async () => {
    await page.click(T('bv-back')); await page.waitForSelector(T('nw-store-' + MEMBER), { timeout: 10000 }); await page.waitForTimeout(200);
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid'));
    return { ok: focused === 'nw-books-' + MEMBER, saw: 'focus on ' + focused };
  });
  await page.setViewportSize(NARROW); await page.waitForTimeout(300);
  await w.step('A8', 'the auditor · 390×844: Open books → the band and the list fit, no page scroll, no sideways scroll', async () => {
    await page.click(T('nw-books-' + MEMBER)); await page.waitForSelector(T('bv-band'), { timeout: 10000 }); await page.waitForSelector(T('bv-row-0'), { timeout: 10000 });
    const a = await noScroll();
    return { ok: a.y && a.x, saw: 'no vertical scroll ' + a.y + ' · no sideways ' + a.x };
  });

  /* ═══ the member ═══ */
  await page.setViewportSize(WIDE);
  await openNetwork(); await booksSection();
  await w.step('M1', 'the member · My books › Access I gave: the grant, its purpose, until when and "Open"', async () => {
    const list = await txt(T('bg-list'));
    return { ok: /Acme Brand/.test(list) && /Year-end audit/.test(list) && /Open/.test(list), saw: list.slice(0, 120) };
  });
  await w.step('M2', 'the member · Give access: the plain-words consent shows; "Give access" stays greyed until yes is ticked', async () => {
    await page.click(T('bg-give')); await page.waitForSelector(T('bg-consent') + ' b', { timeout: 10000 });
    const consent = await txt(T('bg-consent')), before = await page.locator(T('bg-go')).isDisabled();
    await page.check(T('bg-yes')); const after = await page.locator(T('bg-go')).isDisabled();
    const until = await page.inputValue(T('bg-until')), months = Math.round((new Date(until + 'T12:00:00') - W.nowMs()) / 86400000 / 30.4);
    return { ok: /read your books/.test(consent) && /cannot/i.test(consent) && before && !after && months >= 11 && months <= 12, saw: 'greyed ' + before + ' → ' + after + ' · default end ' + until + ' (~' + months + ' months)' };
  });
  await w.step('M3', 'the member · untick costs → the consent says it will not see costs and margins, yes is cleared', async () => {
    await page.uncheck(T('bg-costs')); await page.waitForTimeout(400);
    const consent = await txt(T('bg-consent')), yes = await page.isChecked(T('bg-yes'));
    return { ok: /will not see your costs/.test(consent) && !yes, saw: consent.slice(-60) + ' · yes ' + yes };
  });
  await w.step('M4', 'the member · Give access asks first (who, until when, read only); Cancel sends nothing; Yes sends ONE post with consent', async () => {
    await page.check(T('bg-yes')); await page.click(T('bg-go')); await page.waitForSelector(T('confirm'), { timeout: 5000 });
    const ask = await txt(T('confirm'));
    await page.click(T('confirm-cancel')); await page.waitForTimeout(300);
    const none = S.gives.length === 0;
    await page.click(T('bg-go')); await page.waitForSelector(T('confirm'), { timeout: 5000 }); await page.click(T('confirm-ok')); await page.waitForTimeout(600);
    const sent = S.gives[0] || {};
    return { ok: /Acme Brand/.test(ask) && /read only/i.test(ask) && /until/i.test(ask) && none && S.gives.length === 1 && sent.consent === true && sent.grantee === BRAND && sent.can_see_costs === false && !!sent.expires_at, saw: ask.slice(0, 110) + ' · posts ' + S.gives.length };
  });
  await w.step('M5', 'the member · Who looked: when, who, what — the refused look is said as refused', async () => {
    await page.click(T('bg-seg-looks')); await page.waitForSelector(T('bg-look-allowed'), { timeout: 10000 });
    const list = await txt(T('bg-list'));
    return { ok: /Trial balance/.test(list) && /Looked/.test(list) && /Refused: not open to an auditor/.test(list), saw: list.slice(0, 140) };
  });
  await w.step('M6', 'the member · End access asks first, then ends: the row says Ended', async () => {
    await page.click(T('bg-seg-given')); await page.waitForSelector(T('bg-grant-' + GRANT), { timeout: 10000 });
    await page.click(T('bg-grant-' + GRANT)); await page.waitForSelector(T('bg-end'), { timeout: 5000 });
    await page.click(T('bg-end')); await page.waitForSelector(T('confirm'), { timeout: 5000 });
    const ask = await txt(T('confirm')); await page.click(T('confirm-ok')); await page.waitForTimeout(700);
    const list = await txt(T('bg-list'));
    return { ok: /Acme Brand/.test(ask) && S.revokes.length === 1 && /Ended/.test(list), saw: ask.slice(0, 80) + ' · revokes ' + S.revokes.length + ' · ' + list.slice(0, 60) };
  });
  await w.step('X1', 'every /api/books answer the stand-in served matched the api contract (web-api.contract.json)', async () => { const [ok, saw] = C.finish(); return { ok, saw }; });
  await w.step('M7', 'the member · fits 1366×768 and 390×844 with no page scroll', async () => {
    const a = await noScroll(); await page.setViewportSize(NARROW); await page.waitForTimeout(300); const b = await noScroll();
    return { ok: a.y && a.x && b.y && b.x, saw: 'wide ' + a.y + '/' + a.x + ' · narrow ' + b.y + '/' + b.x };
  });
});
