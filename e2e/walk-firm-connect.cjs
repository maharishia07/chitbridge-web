#!/usr/bin/env node
/**
 * e2e/walk-firm-connect.cjs — UX-215/216/220 (firm-connect 1138): the Requests view of "Who can see my books", the grant edits, the visits, the bell's pinned row and the Home Network card, on a STAND-IN api.
 *
 * OWNS      the proof that an owner sees each request with the firm's name, bridge id and country; Accept, Refuse and Cancel each ask first and send the one write; Ask to connect finds, picks and sends the right end (the firm is the parent); a refusal is a plain sentence; an invitation that was NOT sent says so; a staff seat sees the owner's card greyed with the server's sentence;
 *           Give access with no firm says "Connect your bookkeeper or auditor first." and its button opens the finder; the grant row's detail holds every fact; a rise in costs asks in words and sends consent, a 503 says it is not switched on; Who looked is one row per visit; the bell's dot reads the badge and its one pinned row opens the requests; the Home card names the waiting requests. Fit 1366x768 and 390x844.
 * CALLED BY e2e/run-shard.cjs (walk-*.cjs) · CARD 04-network/connections-and-invitations
 * Which api: a STAND-IN (the answers pinned by the api's tests/firm-connect-1138.test.cjs and docs/critique/firm-connect-1138-WEB-HANDOFF.md). The server's rules are the api's own tests.
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-firm-connect.cjs
 */
'use strict';
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const T = (id) => '[data-testid="' + id + '"]';
const WIDE = { width: 1366, height: 768 }, NARROW = { width: 390, height: 844 };
const MEMBER = 'a0000000-0000-4000-8000-000000000001', FIRM = 'b0000000-0000-4000-8000-000000000009', GRANT = 'c0000000-0000-4000-8000-000000000001';
const DAY = (n) => new Date(W.nowMs() + n * 86400000).toISOString();
const ASK = (id, name, bridge, country, iAm) => ({ edge_id: id, kind: 'firm', i_am: iAm, name, bridge_id: bridge, country, asked_at: DAY(-1) });

W.run('firm-connect', async (w) => {
  const { page, ctx, base } = w;
  const S = { writes: [], staff: false, refuse: null, costs503: false, asks: 2, invite: { sent: false, delivered: false, message: 'That address could not be reached.' },
    to_me: [ASK('e1', 'Acme Books Pty Ltd', 'CB0ACME001', 'AU', 'shop'), ASK('e2', 'Birch Audit', 'CB0BIRCH02', null, 'shop')], by_me: [ASK('e3', 'Cedar Partners', 'CB0CEDAR03', 'AU', 'shop')],
    given: [{ grant_id: GRANT, grantor_entity: MEMBER, grantee_entity: FIRM, grantee_name: 'Acme Books Pty Ltd', preset: 'adviser', posting: 'owner_approves', can_see_costs: false, purpose: 'Year-end books', granted_at: DAY(-5), expires_at: DAY(200), state: 'live' }] };
  const J = (r, status, body) => C.json(r, status, body);
  const example = (key) => { const hit = C.load().routes.filter((e) => e.key === key)[0]; return hit ? JSON.parse(JSON.stringify(hit.example)) : {}; };
  const problem = (r, status, code, message) => J(r, status, { code, message, detail: message });

  await ctx.route(base + '/api/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
    let body = null; try { body = q.postData() ? JSON.parse(q.postData()) : null; } catch (_) {}
    if (m !== 'GET') S.writes.push(m + ' ' + p + (body ? ' ' + JSON.stringify(body) : ''));
    if (p === '/api/network-offers') { const ex = example('GET /api/network-offers'); ex.store = Object.assign({}, ex.store, { networks: [] }); ex.may_design = { ok: false, why: 'Only the owner designs a network.' }; return J(r, 200, ex); }
    if (p === '/api/network-design/stores') return J(r, 200, { stores: [] });
    if (p === '/api/network/asks') return S.staff ? problem(r, 403, 'OWNER_ONLY', 'Only the owner sends and answers requests.') : J(r, 200, { to_me: S.to_me, by_me: S.by_me });
    if (p === '/api/network/connections' && m === 'POST') return S.refuse ? problem(r, S.refuse.status, S.refuse.code, S.refuse.message) : J(r, 200, { id: 'e9', state: 'requested' });
    if (/\/api\/network\/connections\/[^/]+\/(approve|decline)$/.test(p)) { const id = p.split('/')[4]; S.to_me = S.to_me.filter((a) => a.edge_id !== id); S.by_me = S.by_me.filter((a) => a.edge_id !== id); return J(r, 200, { id, ok: true }); }
    if (p === '/api/network/firm-invites') return J(r, 200, S.invite);
    if (p === '/api/entities/search') return J(r, 200, { results: [{ bridge_id: 'CB0ACME001', display_name: 'Acme Books Pty Ltd', user_id: 'acme', kind: 'business' }], count: 1, answers: [] });
    if (p === '/api/books-grants/consent') return J(r, 200, { headline: 'Let your firm see your costs and margins', can_read: ['your trial balance'], cannot: ['change anything'], costs: 'It will see your costs and margins.', rights: 'You can hide them again any time.', posting_choices: [{ value: 'owner_approves', words: 'You approve each post' }, { value: 'adviser_posts', words: 'Your accountant posts for you' }] });
    if (p === '/api/books-grants/log') return J(r, 200, { looks: [], visits: [{ grant_id: GRANT, grantee_entity: FIRM, actor_identity_id: 'p1', actor_name: 'Priya Nair', actor_entity_name: 'Acme Books Pty Ltd', preset: 'adviser', from: DAY(-1), to: DAY(-1), pages: 3, refused: 1, pages_list: [{ route_pattern: 'GET /trial-balance', count: 2 }, { route_pattern: 'GET /pl', count: 1 }] }] });
    if (/\/api\/books-grants\/[^/]+$/.test(p) && m === 'PATCH') return S.costs503 ? problem(r, 503, 'BOOKS_GRANT_NOT_SWITCHED_ON', 'not yet') : J(r, 200, { grant_id: GRANT });
    if (p === '/api/books-grants' && m === 'GET') return J(r, 200, { given: S.given, received: [] });
    if (p === '/api/notifications') return J(r, 200, u.searchParams.get('count') === '1' ? { count: 1 + S.asks, asks: S.asks, total: 1, seen_at: null } : { notifications: [], count: 0, total: 0, page: 1, limit: 30, seen_at: null });
    if (p === '/api/notifications/seen') return J(r, 200, { ok: true });
    if (p === '/api/facts/network') return J(r, 200, { lines: [{ text: S.asks + ' requests to connect', value: S.asks, tone: 'dn' }], figures: { requests: S.asks, waiting: 1 }, state: 'needs_you' });
    if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Fixture Shop', country_code: 'AU', currency_code: 'AUD' } });
    return J(r, 200, {});
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const has = (sel) => page.locator(sel).count().then((n) => n > 0);
  const noScroll = () => page.evaluate(() => ({ y: document.documentElement.scrollHeight <= window.innerHeight + 1, x: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
  const wrote = (re) => S.writes.filter((x) => re.test(x));
  const confirmYes = async () => { await page.waitForSelector(T('confirm'), { timeout: 5000 }); const said = await txt(T('confirm')); await page.click(T('confirm-ok')); await page.waitForTimeout(500); return said; };
  const open = async (hash) => { await page.goto(base + '/network.html' + (hash || '')); await page.reload(); await page.waitForSelector(T('nw-body'), { timeout: 20000 }); await page.waitForTimeout(400); };
  /** open the row (unless its actions already show: a second press would close it) and press one action */
  const pickRow = async (tid, action) => { if (!(await has(T(action)))) await page.click(T(tid)); await page.waitForSelector(T(action), { timeout: 5000 }); await page.click(T(action)); };

  await page.setViewportSize(WIDE);
  await open('#asks');
  await w.step('F1', 'Requests opens from the #asks door; each request shows the firm, its bridge id and country', async () => {
    await page.waitForSelector(T('ba-list'), { timeout: 15000 });
    const list = await txt(T('ba-list')), pressed = await page.getAttribute(T('bg-seg-asks'), 'aria-pressed');
    return { ok: pressed === 'true' && /Waiting for your answer/i.test(list) && /Acme Books Pty Ltd/.test(list) && /CB0ACME001/.test(list) && /AU/.test(list) && /Waiting for their answer/i.test(list) && /Cedar Partners/.test(list) && !/network parent/i.test(list), saw: list.slice(0, 200) };
  });
  await w.step('F2', 'Accept asks first (names the firm), sends the one approve, and says Accept alone gives no access', async () => {
    await pickRow('ba-ask-me', 'ba-accept');
    const said = await confirmYes();
    return { ok: wrote(/POST \/api\/network\/connections\/e1\/approve/).length === 1 && /Acme Books/.test(said) && /cannot see your books until you give them access/i.test(said), saw: said.slice(0, 160) };
  });
  await w.step('F3', 'Refuse asks first and sends the one decline for that request', async () => {
    await pickRow('ba-ask-me', 'ba-refuse');
    const said = await confirmYes();
    return { ok: wrote(/POST \/api\/network\/connections\/e2\/decline/).length === 1 && /Birch Audit/.test(said), saw: said.slice(0, 120) };
  });
  await w.step('F4', 'Cancel my own request asks first and sends the decline of that edge', async () => {
    await pickRow('ba-ask-them', 'ba-cancel');
    await confirmYes();
    return { ok: wrote(/POST \/api\/network\/connections\/e3\/decline/).length === 1, saw: wrote(/decline/).join(' | ') };
  });
  await w.step('F5', 'Ask to connect: find, pick, Send is held until a pick; the shop asks its firm as the PARENT', async () => {
    await page.click(T('ba-ask')); await page.waitForSelector(T('ba-form'), { timeout: 5000 });
    const held = await page.getAttribute(T('ba-send'), 'aria-disabled');
    await page.fill(T('ba-q'), 'acme'); await page.click(T('ba-find')); await page.waitForSelector(T('ba-pick'), { timeout: 5000 });
    await page.click(T('ba-pick')); await page.click(T('ba-send')); await confirmYes();
    const sent = wrote(/POST \/api\/network\/connections [{]/)[0] || '';
    return { ok: held === 'true' && /"parentHandle":"acme"/.test(sent) && /"type":"agency"/.test(sent) && !/childBridgeId/.test(sent), saw: sent };
  });
  await w.step('F6', 'a firm asking a shop sends the child end by bridge id', async () => {
    await page.click(T('ba-ask')); await page.waitForSelector(T('ba-form'), { timeout: 5000 });
    await page.selectOption(T('ba-dir'), 'firm'); await page.fill(T('ba-q'), 'acme'); await page.click(T('ba-find')); await page.waitForSelector(T('ba-pick'), { timeout: 5000 });
    await page.click(T('ba-pick')); await page.click(T('ba-send')); await confirmYes();
    const sent = wrote(/POST \/api\/network\/connections [{]/)[1] || '';
    return { ok: /"childBridgeId":"CB0ACME001"/.test(sent) && !/parentHandle/.test(sent), saw: sent };
  });
  await w.step('F7', 'a refusal is a plain sentence, the sheet stays open and nothing is promised (EXISTS, ASK_COOLING_OFF)', async () => {
    const said = [];
    for (const code of ['EXISTS', 'ASK_COOLING_OFF']) {
      S.refuse = { status: code === 'EXISTS' ? 409 : 429, code, message: 'server words' };
      await page.click(T('ba-ask')); await page.waitForSelector(T('ba-form'), { timeout: 5000 });
      await page.fill(T('ba-q'), 'acme'); await page.click(T('ba-find')); await page.waitForSelector(T('ba-pick'), { timeout: 5000 });
      await page.click(T('ba-pick')); await page.click(T('ba-send')); await confirmYes(); await page.waitForTimeout(300);
      said.push(await txt(T('ba-out'))); await page.click(T('ba-cancel'));
    }
    S.refuse = null;
    return { ok: /already asked|already connected/i.test(said[0]) && /refused a short while ago/i.test(said[1]) && !/server words/.test(said.join(' ')), saw: said.join(' | ') };
  });
  await w.step('F8', 'Invite by email: an invitation that was NOT sent says so in the server\'s words', async () => {
    await page.click(T('ba-invite')); await page.waitForSelector(T('ba-email'), { timeout: 5000 });
    await page.fill(T('ba-email'), 'firm@example.com'); await page.click(T('ba-isend')); await page.waitForTimeout(500);
    const said = await txt(T('ba-iout'));
    await page.click(T('ba-icancel'));
    return { ok: wrote(/firm-invites .*firm@example.com/).length === 1 && /Not sent/.test(said) && /could not be reached/.test(said), saw: said };
  });
  await w.step('F9', 'a staff seat sees the owner\'s card greyed with the server\'s sentence, no second read', async () => {
    S.staff = true; await open('#asks'); await page.waitForSelector(T('ba-why'), { timeout: 15000 });
    const why = await txt(T('ba-why')), askOff = await page.getAttribute(T('ba-ask'), 'aria-disabled'), invOff = await page.getAttribute(T('ba-invite'), 'aria-disabled');
    S.staff = false;
    return { ok: /Only the owner sends and answers requests/.test(why) && askOff === 'true' && invOff === 'true', saw: why };
  });
  await w.step('F10', 'Give access with no firm says "Connect your bookkeeper or auditor first." and Find your firm opens the finder', async () => {
    S.given = []; await open('#books'); await page.waitForSelector(T('bg-give'), { timeout: 15000 });
    await page.click(T('bg-give')); await page.waitForSelector(T('bg-noparent'), { timeout: 5000 });
    const said = await txt(T('bg-noparent'));
    await page.click(T('bg-findfirm')); await page.waitForSelector(T('ba-form'), { timeout: 8000 });
    await page.click(T('ba-cancel'));
    return { ok: /Connect your bookkeeper or auditor first/.test(said) && !/network parent/i.test(said), saw: said };
  });
  await w.step('F11', 'Access I gave: the row detail holds who, role, until, why, costs and who posts; the empty list says Connect first', async () => {
    S.given = [{ grant_id: GRANT, grantor_entity: MEMBER, grantee_entity: FIRM, grantee_name: 'Acme Books Pty Ltd', preset: 'adviser', posting: 'owner_approves', can_see_costs: false, purpose: 'Year-end books', granted_at: DAY(-5), expires_at: DAY(200), state: 'live' }];
    await open('#books'); await page.waitForSelector(T('bg-grant-firm-' + FIRM), { timeout: 15000 });
    await page.click(T('bg-grant-firm-' + FIRM)); await page.waitForSelector(T('bg-detail'), { timeout: 5000 });
    const d = await txt(T('bg-detail'));
    return { ok: /Year-end books/.test(d) && /Hidden/.test(d) && /You approve each post/.test(d) && /Accountant/.test(d) && /Until/.test(d), saw: d };
  });
  await w.step('F12', 'a RISE in costs asks in the server\'s words first and sends consent:true; a 503 says it is not switched on yet', async () => {
    await pickRow('bg-grant-firm-' + FIRM, 'bg-change'); await page.waitForSelector(T('bg-costs2'), { timeout: 5000 });
    await page.check(T('bg-costs2')); await page.click(T('bg-save'));
    const said = await confirmYes();
    const patch = wrote(/PATCH \/api\/books-grants\//)[0] || '';
    const first = /"can_see_costs":true/.test(patch) && /"consent":true/.test(patch) && /see your costs and margins/i.test(said);
    S.costs503 = true;
    await pickRow('bg-grant-firm-' + FIRM, 'bg-change'); await page.waitForSelector(T('bg-costs2'), { timeout: 5000 });
    await page.check(T('bg-costs2')); await page.click(T('bg-save')); await confirmYes(); await page.waitForTimeout(400);
    const out = await txt(T('bg-out2')) + ' ' + await txt(T('confirm'));
    S.costs503 = false;
    return { ok: first && /not switched on yet/i.test(await page.locator('body').innerText()), saw: patch + ' · ' + out.slice(0, 80) };
  });
  await w.step('F13', 'Who looked is one row per visit: the firm and the person, 3 pages, the pages in the detail', async () => {
    await open('#books'); await page.waitForSelector(T('bg-seg-looks'), { timeout: 15000 }); await page.click(T('bg-seg-looks')); await page.waitForSelector(T('bg-visit-refused'), { timeout: 8000 });
    const row = await txt(T('bg-visit-refused'));
    await page.click(T('bg-visit-refused')); await page.waitForSelector(T('bg-visit-pages'), { timeout: 5000 });
    const pages = await txt(T('bg-visit-pages'));
    return { ok: /Acme Books Pty Ltd · Priya Nair/.test(row) && /3 pages/.test(row) && /trial balance/i.test(pages) && /× 2/.test(pages), saw: row + ' || ' + pages };
  });
  await w.step('F14', 'the bell\'s dot reads the badge (asks counted), its one pinned row opens the requests', async () => {
    await open('#books'); await page.waitForSelector(T('bell-btn'), { timeout: 15000 }); await page.waitForTimeout(500);
    const dot = await txt(T('bell-dot'));
    await page.click(T('bell-btn')); await page.waitForSelector(T('bell-asks'), { timeout: 5000 });
    const row = await txt(T('bell-asks'));
    await page.click(T('bell-asks')); await page.waitForSelector(T('ba-list'), { timeout: 15000 });
    return { ok: dot === '3' && /2 requests to connect/.test(row) && /asks/.test(page.url()), saw: 'dot ' + dot + ' · row "' + row + '" · ' + page.url().slice(-18) };
  });
  await w.step('F15', 'the Home card names the waiting requests and its door opens the Requests', async () => {
    await page.goto(base + '/'); await page.waitForSelector(T('cbshell'), { timeout: 20000 });
    await page.evaluate(() => window.SHELL && window.SHELL.ready);
    await page.waitForSelector(T('shell-facts-network'), { state: 'attached', timeout: 20000 }); await page.waitForTimeout(1500);
    const card = await page.evaluate(() => { const el = document.querySelector('[data-testid="shell-facts-network"]'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
    return { ok: /2 requests to connect/.test(card), saw: card };
  });
  await w.step('F16', 'the Requests view fits 1366x768 and 390x844 with no page scroll', async () => {
    S.to_me = [ASK('e1', 'Acme Books Pty Ltd', 'CB0ACME001', 'AU', 'shop'), ASK('e2', 'Birch Audit', 'CB0BIRCH02', null, 'shop')]; S.by_me = [ASK('e3', 'Cedar Partners', 'CB0CEDAR03', 'AU', 'shop')];
    await page.setViewportSize(WIDE); await open('#asks'); await page.waitForSelector(T('ba-list'), { timeout: 15000 }); await page.waitForTimeout(300);
    const a = await noScroll(); await page.setViewportSize(NARROW); await page.waitForTimeout(300); const b = await noScroll();
    return { ok: a.y && a.x && b.y && b.x && (await has(T('ba-ask'))), saw: 'wide ' + a.y + '/' + a.x + ' · narrow ' + b.y + '/' + b.x };
  });
});
