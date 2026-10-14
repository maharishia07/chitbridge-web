#!/usr/bin/env node
/**
 * e2e/walk-settings-ops.cjs - CB SETTINGS › COUNTERS & KEYS · CONNECTORS · POLICY & LOCALISATION · PLAN & USAGE, WALKED (T3-SETTINGS, 2026-10-14:
 * settings.html + app/cap-counters.js · cap-connectors.js · cap-policy.js · cap-locale.js · cap-plan.js — the workshop's own screens, MOVED into
 * modules and mounted in the small app).
 * Black box: it presses what an owner presses — add a counter, open one on this PC, revoke a key, tick a connector, hand a stream over, change a
 * rule — and what a CO-ASSIST sees: the server's refusal (OWNER_ONLY · PLATFORM_BOUND) greyed WITH its sentence, never hidden, never a blank.
 * A FIXTURE shop; the API is a stand-in answering inside the page with the shapes api routes answer (tests/counters-owner-gate · policy-may ·
 * home-facts prove the server side), so nothing leaves the runner. Then RULE 13 (e2e/lib/rule13.cjs): the four sections, Cream and Dark, 1366 and 390.
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-settings-ops.cjs            headless, the stand-in
 *   node e2e/walk-settings-ops.cjs --real                                      the local api (e2e/lib/real-stack.cjs): the sim shop's real answers
 *   node e2e/walk-settings-ops.cjs --show                                      watch it
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-settings-ops-NN.png.
 */
'use strict';
const W = require('./lib/walk.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const R13 = require('./lib/rule13.cjs');
const REAL = process.argv.includes('--real');
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ago = (ms) => new Date(Date.now() - ms).toISOString();

const walk = async (w) => {
  const { page, ctx, base } = w;
  const S = { calls: [], assist: false, country: 'IN', planDown: false, stack: null };
  const ME = { display_name: 'Fixture Shop', country_code: 'IN', currency_code: 'INR', ui_prefs: {} };
  const COUNTERS = () => ({ counters: [
    { id: 'C1', name: 'Front desk', state: 'open', held_by: { name: 'counter C1 · Win32 · 2026-10-01', last4: 'ab12', seen: { at: ago(60000), ip: '10.0.0.5' } }, next: 42, last_no: 'C1/26-27/0041', assigned: null },
    { id: 'C2', name: 'Billing 2', state: 'closed', held_by: null, next: 1, closed_at: ago(3 * 86400000), assigned: null }], free: 1 });
  const KEYS = () => ({ keys: [
    { jti: 'k1', name: 'counter C1 · Win32 · 2026-10-01', scopes: ['till'], last4: 'ab12', created_at: '2026-10-01T09:00:00Z', seen: { at: ago(60000), ip: '10.0.0.5', agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/128' }, till: { id: 'C1' }, counter: 'C1' },
    { jti: 'k2', name: 'Zoho Books', scopes: ['services'], last4: 'zz99', created_at: '2026-09-20T09:00:00Z' }], scopes: ['services', 'offers', 'pricing', 'tax', 'invoice', 'till', 'connector', 'testing'] });
  const NAMES = { AU: 'Australia' };
  const CAT = () => ({ connectors: ['tally', 'zoho', 'csv'].map((id) => ({ id, name: { tally: 'Tally connector', zoho: 'Zoho Books connector', csv: 'File connector (CSV)' }[id], adapters: [id], default_adapter: id,
    runs_on: 'a shop PC', does: 'Carries products and stock up, orders down as vouchers.', status: 'proven', steps: ['Download, unzip, double-click start.cmd.'], needs: [], watch_out: [], docs: '/api/integrations/docs/' + id,
    may: S.country !== 'IN' && id !== 'csv' ? { ok: false, why: 'The ' + id + ' connector is built on India\'s GST books, so it is not offered for a ' + NAMES[S.country] + ' shop. Use the File connector (CSV) or the Counter.' } : { ok: true, why: null } })) });
  const RUN = () => ({ connectors: [{ id: 'tally@OFFICE-PC', actor_id: 'a1', name: 'Tally on OFFICE-PC', adapter: 'tally', host: 'OFFICE-PC', version: '1.4', key_jti: 'k9', last_seen: ago(60000), health: 'live',
    source: { ok: true, at: ago(60000) }, counters: { products_ok: 12, orders_ok: 3 }, note: '', kit: true, enrol: { approved: true, host: 'OFFICE-PC', company: 'Fixture Shop' } },
    /* a second connector: with one, the streams card SAYS it carries everything (no hand-over to offer); with two, the owner's select appears */
    { id: 'csv@BACK-PC', actor_id: 'a2', name: 'Files on BACK-PC', adapter: 'csv', host: 'BACK-PC', version: '1.4', key_jti: 'k8', last_seen: ago(3 * 86400000), health: 'offline', source: null, counters: { products_ok: 0, orders_ok: 0 }, note: '', kit: true, enrol: null }] });
  const STREAMS = () => ({ streams: [{ id: 'products', label: 'Products', dir: 'in', what: 'the item list this account sells from' }, { id: 'order', label: 'Sales voucher', dir: 'out', what: 'an order you received becomes a sales invoice' }],
    owner: { products: 'tally@OFFICE-PC' }, connectors: [{ id: 'tally@OFFICE-PC', name: 'Tally on OFFICE-PC', adapter: 'tally' }, { id: 'csv@BACK-PC', name: 'Files on BACK-PC', adapter: 'csv' }] });
  const FLAGS = { trade_side: 'sell', gst_registration: 'regular', books_at: 'accepted', books_overdue_hours: 12, tol_weight_bp: 50, tol_count_units: 0, tol_rate_bp: 0, trade_cover: 'off', self_copy_pref: 'received', detail_design: 'chit', chit_expiry_days: 0, retention_days: 0, dispute_scope: 'per-party', quick_key_reset_at: 'business_day', connectors_in_use: ['tally'], _migrated: true };
  const MAY = () => { const m = {}; Object.keys(FLAGS).forEach((k) => { m[k] = { ok: true, code: null, why: null }; });
    m.dispute_scope = { ok: false, code: 'PLATFORM_BOUND', why: 'Set by the platform for every shop.' };
    /* ⭐ the client must grey on the SERVER's code alone: in the co-assist run the server refuses an ordinary-looking rule, and the screen follows */
    if (S.assist) m.gst_registration = { ok: false, code: 'OWNER_ONLY', why: 'Only the owner may change how the shop is registered.' };
    return m; };
  const PLAN = () => ({ lines: [{ text: 'Free plan', value: 1 }, { text: '4 chits today of 10', value: 4 }], figures: { plan: 'free', limits: { max_entities: 5, chits_per_day: 10, max_networks: 1, network_depth: 1, public_facing: false, mode: 'b2b_only' }, used: { chits_today: 4 } } });

  let api = base;
  if (REAL) {
    S.stack = await require('./lib/real-stack.cjs').up({ webBase: base });
    api = S.stack.api;
    const owner = await require('./lib/real-stack.cjs').signIn(api, 'simstores@test.example');
    await ctx.addInitScript((a, s) => { try { localStorage.setItem('cb_api_base', a); localStorage.setItem('cb_sess', s); } catch (_) {} }, api, JSON.stringify(owner.session));
    ctx.on('request', (q) => { if (q.url().startsWith(api) && q.method() !== 'GET' && q.method() !== 'OPTIONS') S.calls.push(q.method() + ' ' + new URL(q.url()).pathname + ' ' + (q.postData() || '')); });
  } else {
    await ctx.route('**/api/**', async (r) => {
      const q = r.request(), p = new URL(q.url()).pathname, m = q.method();
      let body = null; try { body = q.postData() ? JSON.parse(q.postData()) : null; } catch (_) {}
      if (m !== 'GET') S.calls.push(m + ' ' + p + (body ? ' ' + JSON.stringify(body) : ''));
      if (p === '/api/entities/me') return J(r, 200, { entity: ME });
      /* counters: the server's ONE gate — a co-assist is refused on every route, with the code the screen greys on */
      if (/^\/api\/counters/.test(p) && S.assist) return J(r, 403, { error: 'Forbidden', code: 'OWNER_ONLY', message: 'Only the owner manages the counters.' });
      if (p === '/api/counters' && m === 'GET') return J(r, 200, COUNTERS());
      if (p === '/api/counters' && m === 'POST') return J(r, 201, { counter: { id: 'C3', name: body.name, state: 'closed' } });
      if (p === '/api/counters/C2/open') return J(r, 200, { key: 'fixture.counter.key', counter: { id: 'C2', state: 'open' } });
      if (p === '/api/counters/C1/release') return J(r, 200, { ok: true, id: 'C1', released_from: 'counter C1' });
      if (p === '/api/keys' && m === 'GET') return J(r, 200, KEYS());
      if (p === '/api/keys' && m === 'POST') return J(r, 201, { key: 'shown.once.fixture', jti: 'k3', name: body.name, scopes: body.scopes, last4: 'ture', note: 'Shown once.' });
      if (/^\/api\/keys\/k2$/.test(p) && m === 'DELETE') return J(r, 200, { message: 'Key revoked', jti: 'k2' });
      if (p === '/api/integrations/catalogue') return J(r, 200, CAT());
      if (p === '/api/integrations/status') return J(r, 200, RUN());
      if (p === '/api/integrations/streams' && m === 'GET') return J(r, 200, STREAMS());
      if (p === '/api/integrations/streams' && m === 'PUT') return J(r, 200, { ok: true });
      if (p === '/api/entities/policy' && m === 'GET') return J(r, 200, { flags: FLAGS, schema: {}, bound: { dispute_scope: 'per-party' }, may: MAY() });
      if (p === '/api/entities/policy' && m === 'PATCH') { Object.assign(FLAGS, body); return J(r, 200, { flags: FLAGS }); }
      if (p === '/api/facts/plan') return S.planDown ? J(r, 500, { error: 'Failed', message: 'The plan could not be read right now.' }) : J(r, 200, PLAN());
      if (p === '/api/entities/usage') return S.planDown ? J(r, 200, { ok: true, not_enabled: true }) : J(r, 200, { ok: true, window_days: 30, counts: { billed: 7 }, total_cost_usd: 0.0123, daily: [], by_meter: [], recent: [] });
      if (p === '/api/facts/rail') return J(r, 200, { suppliers: 0, customers: 0, in: 0, out: 0, stuck: 0 });
      return J(r, 200, {});
    });
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  }
  /* no second tab: "Open on this PC" would open the till — the walk records the address instead */
  await ctx.addInitScript(() => { window.__opened = []; window.open = function (u) { window.__opened.push(String(u)); return null; }; });

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const wrote = (re) => S.calls.filter((c) => re.test(c));
  /* a FRESH load each time (a same-URL goto keeps the page and its reads — walk-settings.cjs T6A found the same): the query changes, the hash names the section */
  let nav = 0;
  const open = async (sec, sel) => { await page.goto(base + '/settings.html?n=' + (++nav) + '#/' + sec); await page.waitForSelector(sel, { timeout: 20000 }); await page.waitForTimeout(400); };
  const counters = () => open('counters', REAL ? '[data-testid="ctr-screen"]' : '[data-testid="ctr-C1"]');
  const connectors = () => open('connectors', REAL ? '[data-testid="int-screen"]' : '[data-testid="int-connector-tally"]');
  const policy = () => open('policy', '[data-testid="pol-trade_side"], [data-testid="pol-why-trade_side"]');
  const plan = () => open('plan', '[data-testid="plan-name"], [data-testid="plan-err"]');

  /* ── COUNTERS & KEYS ── */
  await counters();
  await w.step('C1', 'CB Settings › Counters & keys: the register (C1 open on its PC · C2 closed), the pairings, and the keys other systems hold', async () => {
    if (REAL) { const t = await txt('[data-testid="ctr-screen"]'); return { ok: /Counters/.test(t) && !/undefined|\[object/.test(t), saw: t.slice(0, 120) }; }
    const c1 = await txt('[data-testid="ctr-state-C1"]'), c2 = await txt('[data-testid="ctr-state-C2"]'), k = await txt('[data-testid="int-key-k2"]'), pair = await txt('[data-testid="int-counter-k1"]');
    return { ok: /open on/.test(c1) && /closed/.test(c2) && /Zoho Books/.test(k) && /services/.test(k) && /open now/.test(pair) && /#\/counters$/.test(page.url()), saw: 'C1 "' + c1 + '" · C2 "' + c2 + '" · key "' + k.slice(0, 50) + '"' };
  });
  if (!REAL) {
    await w.step('C2', 'Add a counter -> one POST /api/counters with the name, "Counter added"', async () => {
      await page.fill('#ctr_new_name', 'Godown desk'); await page.click('[data-testid="ctr-add"]'); await page.waitForTimeout(600);
      const n = wrote(/POST \/api\/counters /); return { ok: n.length === 1 && /Godown desk/.test(n[0]) && /Counter added/.test(await txt('#toast')), saw: (n[0] || 'no POST') + ' · toast "' + await txt('#toast') + '"' };
    });
    await w.step('C3', 'C2 › Open on this PC -> POST /counters/C2/open, the key kept for the till, the till opened with it (never the workshop)', async () => {
      await counters(); await page.click('[data-testid="ctr-open-C2"]'); await page.waitForTimeout(600);
      const opened = await page.evaluate(() => window.__opened), key = await page.evaluate(() => localStorage.getItem('cb_till_key'));
      return { ok: wrote(/POST \/api\/counters\/C2\/open/).length === 1 && key === 'fixture.counter.key' && /^\/till\.html#key=fixture\.counter\.key/.test(opened[0] || '') && !/app\.html/.test(opened.join()), saw: 'opened ' + (opened[0] || 'nothing') };
    });
    await w.step('C4', 'Release C1: the first press arms it and SAYS the cost, the second releases -> POST /counters/C1/release', async () => {
      await counters(); await page.click('[data-testid="ctr-release-C1"]'); await page.waitForTimeout(300);
      const armed = await txt('[data-testid="ctr-release-C1"]'); await page.click('[data-testid="ctr-release-C1"]'); await page.waitForTimeout(500);
      return { ok: /unsent bills stay/.test(armed) && wrote(/POST \/api\/counters\/C1\/release/).length === 1, saw: 'armed "' + armed + '" · ' + wrote(/release/).length + ' POST' };
    });
    await w.step('C5', 'Revoke the Zoho key -> DELETE /api/keys/k2, "Key revoked"', async () => {
      await counters(); await page.click('[data-testid="int-key-revoke-k2"]'); await page.waitForTimeout(500);
      return { ok: wrote(/DELETE \/api\/keys\/k2/).length === 1 && /Key revoked/.test(await txt('#toast')), saw: wrote(/DELETE/).join(' ') + ' · toast "' + await txt('#toast') + '"' };
    });
    await w.step('C6', 'Mint a key for another system -> POST /api/keys with its scope; the key shown ONCE with "Copy it now"', async () => {
      await counters(); await page.fill('#int_key_name', 'Shopify'); await page.selectOption('#int_key_scope', 'services'); await page.click('[data-testid="int-key-mint"]'); await page.waitForTimeout(600);
      const shown = await txt('[data-testid="int-key-value"]'), n = wrote(/POST \/api\/keys /);
      return { ok: n.length === 1 && /"scopes":\["services"\]/.test(n[0]) && shown === 'shown.once.fixture' && /Copy it now/.test(await txt('[data-testid="int-key-shown"]')), saw: (n[0] || 'no POST') + ' · shown "' + shown + '"' };
    });
    await w.step('C7', 'a CO-ASSIST: the server refuses the register (403 OWNER_ONLY) -> the sentence painted, Add greyed WITH it, the keys still listed, no blank', async () => {
      S.assist = true; await open('counters', '[data-testid="ctr-why"]'); await page.waitForSelector('[data-testid="int-key-k1"]', { timeout: 10000 });
      const why = await txt('[data-testid="ctr-why"]'), add = await page.$eval('[data-testid="ctr-add"]', (b) => ({ disabled: b.disabled, title: b.title })), keys = await txt('[data-testid="int-key-k1"]');
      S.assist = false;
      return { ok: why === 'Only the owner manages the counters.' && add.disabled && add.title === why && /counter C1/.test(keys), saw: '"' + why + '" · Add ' + (add.disabled ? 'greyed' : 'LIVE') + ' · keys ' + (keys ? 'listed' : 'missing') };
    });
  }

  /* ── CONNECTORS ── */
  await connectors();
  await w.step('N1', 'CB Settings › Connectors: what you can attach (Tally · Zoho · CSV, Download live), who checked in (Tally on OFFICE-PC, answered), who owns what (Products → Tally)', async () => {
    if (REAL) { const t = await txt('[data-testid="int-screen"]'); return { ok: /Connectors/.test(t) && !/undefined|\[object/.test(t), saw: t.slice(0, 120) }; }
    const dl = await page.$eval('[data-testid="int-download-tally-tally"]', (b) => b.disabled), run = await txt('[data-testid="int-running-tally@OFFICE-PC"]'), src = await txt('[data-testid="int-source-tally@OFFICE-PC"]'),
      own = await page.$eval('[data-testid="int-stream-products"]', (s) => s.value);
    return { ok: !dl && /Tally on OFFICE-PC/.test(run) && /products 12/.test(run) && /answered/.test(src) && own === 'tally@OFFICE-PC' && /#\/connectors$/.test(page.url()), saw: 'download ' + (dl ? 'greyed' : 'live') + ' · "' + run.slice(0, 60) + '" · products owned by ' + own };
  });
  if (!REAL) {
    await w.step('N2', 'an AU shop: Tally and Zoho greyed WITH the server\'s sentence naming Australia; CSV live; a greyed Download sends nothing', async () => {
      S.country = 'AU'; await connectors();
      const t = await page.$eval('[data-testid="int-download-tally-tally"]', (b) => b.disabled), why = await txt('[data-testid="int-why-tally"]'), csv = await page.$eval('[data-testid="int-download-csv-csv"]', (b) => b.disabled);
      await page.click('[data-testid="int-download-tally-tally"]', { force: true, timeout: 2000 }).catch(() => {}); await page.waitForTimeout(200);
      S.country = 'IN';
      return { ok: t && /Australia/.test(why) && !csv && !wrote(/download/).length, saw: 'tally ' + (t ? 'greyed' : 'LIVE') + ' "' + why.slice(0, 60) + '…" · csv ' + (csv ? 'greyed' : 'live') };
    });
    await w.step('N3', 'Hand the Products stream to nobody -> PUT /api/integrations/streams { products: null }', async () => {
      await connectors(); await page.selectOption('[data-testid="int-stream-products"]', ''); await page.waitForTimeout(500);
      const n = wrote(/PUT \/api\/integrations\/streams/); return { ok: n.length === 1 && /"products":null/.test(n[0]), saw: n[0] || 'no PUT' };
    });
    await w.step('N4', '"we use this" on Zoho -> PATCH /entities/policy connectors_in_use (the one policy writer)', async () => {
      await connectors(); await page.click('[data-testid="int-use-zoho"]'); await page.waitForTimeout(500);
      const n = wrote(/PATCH \/api\/entities\/policy/); return { ok: n.length === 1 && /connectors_in_use/.test(n[0]) && /zoho/.test(n[0]), saw: n[0] || 'no PATCH' };
    });
  }

  /* ── POLICY & LOCALISATION ── */
  await policy();
  await w.step('P1', 'CB Settings › Policy & Localisation: the rules, each with its class; the platform\'s one locked WITH the server\'s sentence; Localisation under it', async () => {
    const rows = await page.$$eval('[data-testid^="pol-"]', (els) => els.filter((e) => /^(select|input)$/i.test(e.tagName)).length);
    const why = await txt('[data-testid="pol-why-dispute_scope"]'), loc = await txt('[data-testid="loc-title"]'), sub = await txt('[data-testid="pol-sub"]');
    /* the heading is upper-cased by CSS (.sec) and innerText reads the rendering: case-insensitive */
    if (REAL) return { ok: rows > 5 && /Localisation/i.test(loc), saw: rows + ' controls · "' + why + '"' };
    return { ok: rows >= 12 && why === 'Set by the platform for every shop.' && /Localisation/i.test(loc) && /server says/.test(sub) && /#\/policy$/.test(page.url()), saw: rows + ' controls · dispute_scope "' + why + '" · ' + loc };
  });
  if (!REAL) {
    await w.step('P2', 'Change "This entity" to receive -> one PATCH /entities/policy { trade_side: receive }, the card repainted from the server\'s answer', async () => {
      await page.selectOption('[data-testid="pol-trade_side"]', 'receive'); await page.waitForTimeout(600);
      const n = wrote(/PATCH \/api\/entities\/policy/).filter((c) => /trade_side/.test(c)), v = await page.$eval('[data-testid="pol-trade_side"]', (s) => s.value);
      return { ok: n.length === 1 && /"trade_side":"receive"/.test(n[0]) && v === 'receive' && /saved/.test(await txt('#toast')), saw: (n[0] || 'no PATCH') + ' · now ' + v };
    });
    await w.step('P3', 'a CO-ASSIST: the server marks GST registration OWNER_ONLY -> the value, a lock and the sentence; no control; the other rules stay live', async () => {
      S.assist = true; await open('policy', '[data-testid="pol-why-gst_registration"]');
      const why = await txt('[data-testid="pol-why-gst_registration"]'), ctl = await page.$('[data-testid="pol-gst_registration"]'), other = await page.$('select[data-testid="pol-trade_side"]');
      S.assist = false;
      return { ok: /Only the owner may change how the shop is registered/.test(why) && !ctl && !!other, saw: '"' + why + '" · control ' + (ctl ? 'STILL THERE' : 'gone') + ' · trade_side ' + (other ? 'live' : 'MISSING') };
    });
  }

  /* ── PLAN & USAGE ── */
  await plan();
  await w.step('L1', 'CB Settings › Plan & usage: the server\'s plan, chits today against the declared limit, the billed ledger', async () => {
    const name = await txt('[data-testid="plan-name"]'), screen = await txt('[data-testid="plan-screen"]');
    if (REAL) return { ok: /plan|No plan recorded/.test(name + screen) && !/undefined|NaN/.test(screen), saw: name + ' · ' + screen.slice(0, 100) };
    return { ok: name === 'Free plan' && /Chits today/.test(screen) && /4 of 10/.test(screen) && /\$0\.0123/.test(screen) && /7/.test(await txt('[data-testid="usage-events"]')) && /#\/plan$/.test(page.url()), saw: name + ' · ' + screen.replace(/Plan & usage/, '').slice(0, 110) };
  });
  if (!REAL) {
    await w.step('L2', 'the plan read fails and usage is not switched on -> each card says so in the server\'s words, never a blank or a 0', async () => {
      S.planDown = true; await open('plan', '[data-testid="plan-err"]');
      const e = await txt('[data-testid="plan-err"]'), u = await txt('[data-testid="usage-off"]'); S.planDown = false;
      return { ok: /could not be read/.test(e) && /not switched on/.test(u), saw: '"' + e + '" · "' + u + '"' };
    });
  }

  /* ── RULE 13: two themes × two widths × four sections ── */
  const frameClip = await R13.sweep(w, page, measure, { host: 'set', sections: { counters, connectors, policy, plan }, from: 1, prefix: 'R', min: 8 });   /* min 8: Plan & usage is two short cards */
  if (frameClip.size) w.note('R99', 'the shared frame\'s top bar at 390 px (not this page\'s pane)', 'ellipsised: ' + [...frameClip].join(' · '));
  if (w.errs.length) w.note('X99', 'page errors seen during the walk', w.errs.slice(0, 3).join(' | '));
  if (S.stack) await S.stack.stop();
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('settings-ops', walk);
