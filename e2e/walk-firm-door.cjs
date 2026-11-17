#!/usr/bin/env node
/**
 * e2e/walk-firm-door.cjs — FIRM-PARENT-DOOR WALKED on a MOCKED api: the owner's "Your accountant or auditor" card (My books) and the firm's "Add a client" card.
 *
 * OWNS      the proof of the two door cards (public/app/firm-door.js): the invite sends type agency with the handle; the three kinds of row (a firm's ask, my own invitation, a connected firm) carry their own actions;
 *           "Accept and choose access" is ONE step: a confirm, the approve, then the existing Give access sheet with that firm picked (the data consent stays a second, separate yes); a refusal (not the owner) greys Invite
 *           with the server's sentence; the firm side says Add a client and lists its waiting asks. Then RULE 13 (lib/rule13.cjs): Cream and Dark x 1366 and 390 px for the owner's card and the firm's card.
 * CALLED BY e2e/run-shard.cjs (walk-*.cjs) · the PR's CI walk
 * CARD      04-network/connections-and-invitations
 * Which api: a STAND-IN with the shapes of api src/routes/network.js (edge rows with type, state, requested_by, parent_name, child_name) and routes/books-grants.js. It proves the web; the server's rules are tests/firm-door.realstack.cjs.
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-firm-door.cjs
 */
'use strict';
const W = require('./lib/walk.cjs');
const T = (id) => '[data-testid="' + id + '"]';
const NODE = 'a0000000-0000-4000-8000-0000000000aa', SMITH_NODE = 'a0000000-0000-4000-8000-0000000000bb', JONES_NODE = 'a0000000-0000-4000-8000-0000000000cc', BROWN_NODE = 'a0000000-0000-4000-8000-0000000000dd';
const SMITH = 'a0000000-0000-4000-8000-0000000000b1';
const BAKERY = 'a0000000-0000-4000-8000-0000000000ee', CAFE = 'a0000000-0000-4000-8000-0000000000ff', BRAND = 'a0000000-0000-4000-8000-000000000011';

W.run('firm-door', async (w) => {
  const { page, ctx, base } = w;
  const S = { asks: [], approves: [], declines: [], approved: false, refuse: false, parents: [], practice: null, practiceHits: 0 };
  const edges = () => [
    { id: 'e1', parent_id: SMITH_NODE, child_id: NODE, type: 'agency', state: S.approved ? 'active' : 'requested', requested_by: SMITH_NODE, parent_name: 'Smith & Co', child_name: 'Fixture Shop' },
    { id: 'e2', parent_id: JONES_NODE, child_id: NODE, type: 'agency', state: 'requested', requested_by: NODE, parent_name: 'Jones Audit', child_name: 'Fixture Shop' },
    { id: 'e3', parent_id: BROWN_NODE, child_id: NODE, type: 'agency', state: 'active', requested_by: BROWN_NODE, parent_name: 'Brown Partners', child_name: 'Fixture Shop' },
    { id: 'e4', parent_id: NODE, child_id: BAKERY, type: 'agency', state: 'requested', requested_by: NODE, parent_name: 'Fixture Shop', child_name: 'Client Bakery' },
    { id: 'e5', parent_id: NODE, child_id: CAFE, type: 'agency', state: 'requested', requested_by: CAFE, parent_name: 'Fixture Shop', child_name: 'Client Cafe' },
    { id: 'e6', parent_id: NODE, child_id: BRAND, type: 'commercial', state: 'active', requested_by: NODE, parent_name: 'Fixture Shop', child_name: 'A brand store' }
  ];
  const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await ctx.route(base + '/api/**', async (r) => {
    const q = r.request(), p = new URL(q.url()).pathname, m = q.method();
    if (p === '/api/books-grants/practice') { S.practiceHits++; return J(r, 200, S.practice || { clients: [], own_trade: true }); }
    if (p === '/api/network-offers') return J(r, 200, { store: { networks: [], offers: [] } });
    if (p === '/api/network-design/stores') return J(r, 200, { stores: [] });
    if (p === '/api/network/entities/lookup') return J(r, 200, { found: true, id: NODE, entity: { id: NODE } });
    if (p === '/api/network/entities/' + NODE + '/connections') return J(r, 200, edges());
    if (p === '/api/network/connections' && m === 'POST') {
      if (S.refuse) return J(r, 403, { error: 'Forbidden', code: 'OWNER_ONLY', may: false, why: 'Only the business owner can ask to connect. Sign in as the business itself.', message: 'Only the business owner can ask to connect. Sign in as the business itself.' });
      S.asks.push(JSON.parse(q.postData() || '{}')); return J(r, 201, { id: 'e9', type: 'agency', state: 'requested' });
    }
    if (/\/connections\/[^/]+\/approve$/.test(p)) { S.approves.push(p); S.approved = true; S.parents = [{ entity_id: SMITH, name: 'Smith & Co' }]; return J(r, 200, { id: 'e1', state: 'active' }); }
    if (/\/connections\/[^/]+\/decline$/.test(p)) { S.declines.push(p); return J(r, 200, { id: 'e2', state: 'declined' }); }
    if (p === '/api/books-grants/consent') return J(r, 200, { headline: 'Let your accountant read your books', can_read: ['your trial balance'], cannot: ['change anything'], costs: 'They can see your costs.', consent: 'ok' });
    if (p === '/api/books-grants' && m === 'GET') return J(r, 200, { given: [], received: [], parents: S.parents });
    if (p === '/api/books-grants/log') return J(r, 200, { looks: [] });
    return J(r, 200, {});
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const has = (sel) => page.locator(sel).count().then((n) => n > 0);
  const openOwner = async () => {
    await page.goto(base + '/network.html');
    await page.waitForSelector(T('nw-books-door'), { timeout: 20000 });
    await page.click(T('nw-books-door'));
    await page.waitForSelector(T('fd-owner-card'), { timeout: 10000 });
    await page.waitForSelector(T('fd-row-e1'), { timeout: 10000 });
  };

  await page.setViewportSize({ width: 1366, height: 900 });
  await openOwner();
  await w.step('D1', 'My books -> Your accountant or auditor: the card, the invite box and the three kinds of row', async () => {
    const t = await txt(T('fd-owner-card'));
    const ok = /Your accountant or auditor/.test(t) && /Smith & Co/.test(t) && /Asks to be your accountant or auditor/.test(t) && /Invited\. Waiting for them/.test(t) && /Connected\. No access yet/.test(t) && !/A brand store|Client Bakery/.test(t);
    return { ok, saw: t.slice(0, 160) };
  });
  await w.step('D2', 'Each row carries its own actions: Accept and choose access + Decline, Cancel invitation, Give access + Remove my accountant', async () => {
    const seen = {};
    for (const [row, names] of [['e1', ['accept', 'decline']], ['e2', ['cancel']], ['e3', ['give', 'remove']]]) {
      await page.click(T('fd-row-' + row)); await page.waitForTimeout(250);
      for (const name of names) seen[name] = await has(T('fd-owner-' + name));
    }
    return { ok: Object.keys(seen).length === 5 && Object.values(seen).every(Boolean), saw: JSON.stringify(seen) };
  });
  await w.step('D3', 'Invite by handle sends the one agency ask (a parentHandle, type agency)', async () => {
    await page.fill(T('fd-owner-handle'), 'smith-co'); await page.click(T('fd-owner-add')); await page.waitForTimeout(700);
    const sent = S.asks[0] || {};
    return { ok: sent.parentHandle === 'smith-co' && sent.type === 'agency', saw: JSON.stringify(sent) };
  });
  await w.step('D4', 'Accept and choose access: ONE step - a confirm, the approve, then the Give access sheet with Smith & Co picked', async () => {
    await page.click(T('fd-row-e1')); await page.waitForSelector(T('fd-owner-accept'), { timeout: 5000 });
    await page.click(T('fd-owner-accept')); await page.waitForSelector(T('confirm'), { timeout: 5000 });
    await page.click(T('confirm-ok')); const confirmed = true;
    await page.waitForSelector(T('bg-who'), { timeout: 8000 });
    const who = await page.evaluate(() => { const s = document.querySelector('[data-testid="bg-who"]'); return s.options[s.selectedIndex].text; });
    return { ok: confirmed && S.approves.length === 1 && who === 'Smith & Co', saw: 'confirm ' + confirmed + ' approves ' + S.approves.length + ' who ' + who };
  });
  await w.step('D5', 'Accepting alone gives nothing: Give access still needs its own yes (held until ticked)', async () => {
    const held = await page.evaluate(() => document.querySelector('[data-testid="bg-go"]').disabled === true);
    return { ok: held, saw: 'go held ' + held };
  });
  await openOwner();
  await w.step('D6', 'A refusal (not the owner): Invite is greyed WITH the server sentence', async () => {
    S.refuse = true; await page.fill(T('fd-owner-handle'), 'x-firm'); await page.click(T('fd-owner-add')); await page.waitForTimeout(700);
    const off = await page.evaluate(() => { const b = document.querySelector('[data-testid="fd-owner-add"]'); return { d: b.disabled, t: b.title }; });
    S.refuse = false;
    return { ok: off.d && /Only the business owner can ask/.test(off.t), saw: JSON.stringify(off) };
  });
  await openOwner();
  await require('./lib/rule13.cjs').rule13(w, 'R13a', 'My books · Your accountant or auditor', 'bg_door');

  /* the firm's side: the same module, side firm, in a host of its own (the practice page mounts it above the client list) */
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'fd_firm_host';
    host.setAttribute('data-testid', 'fd-firm-host');
    document.querySelector('#bg_door').parentNode.insertBefore(host, document.querySelector('#bg_door'));
    return CBFirmDoor.mount(host, { side: 'firm', token: JSON.parse(localStorage.getItem('cb_sess')).token, base: location.origin, bridgeId: 'CBFIXTURE01' });
  });
  await page.waitForSelector(T('fd-firm-card'), { timeout: 8000 });
  await page.waitForSelector(T('fd-row-e4'), { timeout: 8000 });
  await w.step('F1', 'The firm: Add a client box and the waiting asks (its own, and a client ask to accept)', async () => {
    const t = await txt(T('fd-firm-card'));
    await page.click(T('fd-row-e5')); await page.waitForTimeout(250);
    const accept = await has(T('fd-firm-accept'));
    await page.click(T('fd-row-e4')); await page.waitForTimeout(250);
    const ok = /Add a client/.test(t) && /Client Bakery/.test(t) && /Asked\. Waiting for them/.test(t) && /Client Cafe/.test(t) && /Asks you to act for them/.test(t) && accept && await has(T('fd-firm-cancel'));
    return { ok, saw: t.slice(0, 160) };
  });
  await w.step('F2', 'Add a client sends a childHandle with type agency', async () => {
    S.asks = []; await page.fill(T('fd-firm-handle'), 'CBBAKERY01'); await page.click(T('fd-firm-add')); await page.waitForTimeout(700);
    const sent = S.asks[0] || {};
    return { ok: sent.childHandle === 'CBBAKERY01' && sent.type === 'agency', saw: JSON.stringify(sent) };
  });
  await require('./lib/rule13.cjs').rule13(w, 'R13b', 'Practice · Add a client', 'fd_firm_host');

  /* the ZERO-CLIENT firm: its Home is the practice with an empty state, "Add a client" and one line on what happens next (books-practice.js drawEmpty) */
  S.practice = { clients: [], own_trade: false, firm: true, band: null, today: '2026-11-18' };
  S.asks = [];
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(base + '/');
  await page.waitForSelector(T('fd-firm-card'), { timeout: 20000 });
  await w.step('Z1', 'A firm with no client: Home shows the practice, No clients yet, the one line, and Add a client (not the shop Home)', async () => {
    const t = await txt(T('practice'));
    const shopCards = await has('[data-testid="shell-areas"] .cbsh-card:visible');
    const ok = /Your practice/.test(t) && /No clients yet/.test(t) && /Add a client below. They accept/.test(t) && /Add a client/.test(t) && !(await has(T('fd-firm-note')));
    return { ok, saw: t.replace(/s+/g, ' ').slice(0, 200) + ' · shop cards ' + shopCards };
  });
  await w.step('Z2', 'No scroll on the desktop app: 1366 x 768, the page fits the window', async () => {
    const m = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth }));
    return { ok: m.h <= m.ih + 1 && m.w <= m.iw + 1, saw: JSON.stringify(m) };
  });
  await w.step('Z3', 'Add a client from the empty Home sends the one agency ask (a childHandle)', async () => {
    await page.fill(T('fd-firm-handle'), 'CBBAKERY01'); await page.click(T('fd-firm-add')); await page.waitForTimeout(700);
    const sent = S.asks[0] || {};
    return { ok: sent.childHandle === 'CBBAKERY01' && sent.type === 'agency', saw: JSON.stringify(sent) };
  });
  await require('./lib/rule13.cjs').rule13(w, 'R13c', 'Home · a firm with no client', 'bp_practice');
});
