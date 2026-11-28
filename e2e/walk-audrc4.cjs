#!/usr/bin/env node
/**
 * e2e/walk-audrc4.cjs - AUD-RC-4 (Fable R4): the client's Day book opens in book order (date, then entry number, ascending, whatever order the api sends), the Risk column is in view at 1366, the risk label counts "1 risk", no sideways scroll at 390, light and dark. MOCKED api (the stand-in shapes of walk-books-grant).
 * OWNS      the R4 polish items of the client's Day book. CALLED BY e2e/run-shard.cjs (walk-*.cjs) · CARD 04-network/ACC-176-AUDITOR-GRANT
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-audrc4.cjs
 */
'use strict';
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const D = require('./lib/door.cjs');   /* every /api/books answer the stand-in serves is held to the api's own examples */
const T = (id) => '[data-testid="' + id + '"]';
const WIDE = { width: 1366, height: 768 }, NARROW = { width: 390, height: 844 };
const MEMBER = 'a0000000-0000-4000-8000-000000000001', OTHER = 'a0000000-0000-4000-8000-000000000002', BRAND = 'b0000000-0000-4000-8000-000000000009';
const GRANT = 'c0000000-0000-4000-8000-000000000001';
const DAY = (n) => new Date(W.nowMs() + n * 86400000).toISOString();

W.run('audrc4', async (w) => {
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
    const door = D.stubs(p, (st, body) => J(r, st, body)); if (door) return door; /* entities/me for the owner page */
    if (p === '/api/network-offers') { const ex = example('GET /api/network-offers'); ex.store.networks = [Object.assign({}, ex.store.networks[0], { brand_id: BRAND, brand_name: 'Acme Brand', membership: Object.assign({}, ex.store.networks[0].membership, { state: 'active' }), offers: [] })]; ex.may_design = { ok: false, why: 'Only the owner designs a network.' }; return J(r, 200, ex); }
    if (p === '/api/network-design/stores') return J(r, 200, { stores: [{ entity_id: MEMBER, name: 'Store One', city: 'Pune', km: 4, purpose: 'Tea' }, { entity_id: OTHER, name: 'Store Two', city: 'Delhi', km: 9, purpose: 'Snacks' }] });
    if (p === '/api/books-grants/consent') return J(r, 200, { headline: 'Let your network parent read your books', can_read: ['your trial balance', 'your profit and loss'], cannot: ['change or add anything'], costs: u.searchParams.get('can_see_costs') === 'false' ? 'It will not see your costs and margins.' : 'It will see your costs and margins.', rights: 'You can end this at any time.' });
    if (p === '/api/books-grants/log') return J(r, 200, { looks: [{ at: DAY(-1), grant_id: GRANT, grantee_entity: BRAND, actor_identity_id: 'x', route_pattern: 'GET /trial-balance', query_shape: null, status: 200, outcome: 'allowed' }, { at: DAY(-2), grant_id: GRANT, grantee_entity: BRAND, actor_identity_id: 'x', route_pattern: 'GET /packs', query_shape: null, status: 403, outcome: 'not_listed' }] });
    if (p === '/api/books-grants' && m === 'GET') return J(r, 200, { given: S.given, received: [{ grant_id: GRANT, grantor_entity: MEMBER, grantee_entity: BRAND, state: 'live', expires_at: DAY(200) }] });
    if (p === '/api/books-grants' && m === 'POST') { S.gives.push(JSON.parse(q.postData() || '{}')); return J(r, 201, { grant_id: GRANT, grantor_entity: MEMBER, grantee_entity: BRAND, purpose: 'x', expires_at: DAY(300) }); }
    if (/\/api\/books-grants\/[^/]+\/revoke$/.test(p)) { S.revokes.push(p); S.given = S.given.map((g) => Object.assign({}, g, { state: 'revoked', revoked_at: DAY(0) })); return J(r, 200, { grant_id: GRANT }); }
    if (p.indexOf('/api/books/') === 0) {
      if (p === '/api/books/daybook') {
        const ex = example('GET /api/books/daybook'), base0 = ex.entries[0];
        const mk = (no, day, rec, amt, narr) => Object.assign({}, base0, { entry_id: 'e0000000-0000-4000-8000-0000000000' + no.slice(-2), entry_no: no, posting_date: day, doc_date: day, event_type: 'sale', narration: narr, source: Object.assign({}, base0.source, { recorded_at: rec, doc_at: day + 'T09:00:00.000Z' }), lines: [{ code: '1000', name: 'Cash', party_id: null, party_name: null, dr_minor: amt, cr_minor: 0, counter: null, rate: null, fx: null }, { code: '4000', name: 'Sales', party_id: null, party_name: null, dr_minor: 0, cr_minor: amt, counter: null, rate: null, fx: null }] });
        /* the api sends them OUT of book order on purpose: the page must still read date, then number, ascending */
        const entries = [mk('JV-0009', '2026-06-29', '2026-07-20T03:00:00.000Z', 123400, 'Late sale'), mk('JV-0010', '2025-07-05', '2025-07-05T05:00:00.000Z', 100000, ''), mk('JV-0002', '2025-07-05', '2025-07-05T05:00:00.000Z', 54321, 'Cash sale'), mk('JV-0001', '2025-07-04', '2025-07-04T05:00:00.000Z', 54321, 'Cash sale')];
        return J(r, 200, Object.assign(ex, { currency: 'INR', entries, count: entries.length }));
      }
      const ex = example('GET ' + p); ['entries', 'parties', 'periods'].forEach((k) => { if (Array.isArray(ex[k])) ex[k] = []; }); return J(r, 200, ex);
    }
    return J(r, 200, {});
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  const shot = (name) => page.screenshot({ path: 'C:/dev/shots/audrc4/' + name + '.png' }).catch(() => {});
  const noSide = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const open = () => D.openDaybook(page, base, MEMBER, { grid: true }); /* ONEP-2 PR7b: Open books lands on the owner's Day book (the door) */
  for (const [vp, tag] of [[WIDE, '1366'], [NARROW, '390']]) for (const scheme of ['light', 'dark']) {
    await page.setViewportSize(vp); await page.emulateMedia({ colorScheme: scheme }); await open();
    await w.step('R4-' + tag + scheme[0], 'Day book ' + tag + ' ' + scheme + ': rows in book order JV-0001, 0002, 0010, 0009; Risk in view; no sideways scroll', async () => {
      await D.sortBy(page, 'book'); /* the owner opens newest first; Book order (oldest first, date then number) is the sort choice a firm seat has */
      const order = await D.entryNos(page);
      const risk = await page.$$eval('[data-testid="bv-risk"]', (els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, w: b.width, label: e.getAttribute('aria-label') }; }));
      await shot('daybook-' + tag + '-' + scheme);
      const inView = risk.length > 0 && risk.every((b) => b.x >= 0 && b.x + b.w <= vp.width);
      return { ok: order.join() === 'JV-0001,JV-0002,JV-0010,JV-0009' && inView && (await noSide()) && risk.every((b) => !/ 1 risks/.test(b.label || '')), saw: order.join() + ' · risk ' + JSON.stringify(risk.slice(0, 2)) };
    });
  }
});
