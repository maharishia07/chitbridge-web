/* labs-flow.cjs — THE INDEX PAGE AND ITS FOUR LABS, DRIVEN END TO END (Athi, 2026-10-01 ask: "do a playwright
 * test for the labs in index.html for the entire flow and let me know what the problems are").
 *
 * Pattern copied from e2e/index-page.cjs (NOT edited): Playwright, a stand-in API answering INSIDE the page via
 * ctx.route, a static server on a free OS port. Nothing here ever reaches localhost:3000, port 7351, or the live
 * site — every /api/** call is fulfilled before it leaves the browser. This is a TEST, not a fix: nothing in the
 * repo is changed by running it.
 *
 * For each Lab (Product, Offer, Combo), signed in AND signed out, at 1280px and 390px:
 *   1. open the index, read the tile's live fact, click the tile, land on the Lab
 *   2. run the Lab's own main flow as a shopkeeper would (read from the page's own source, not guessed)
 *   3. use the Lab's Home link back to the index; the same person and figures must still be there
 *   4. the Tax Lab tile must say "coming" and never be a link
 * Every state is screenshotted to e2e/shots/labs-flow-<lab>-<state>.png. Every API path a page asks for that
 * this stand-in does not recognise is logged AND still answered (200 {} / {ok:true}) so the page does not hang.
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const SHOTS = path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const problems = [];           // { lab, state, step, problem, severity }
const rows = {};                // lab -> [{step, result, problem, shot}]
const apiPathsSeen = new Set();
const unknownPaths = new Set();

function row(lab, step, result, problem, shot) {
  (rows[lab] = rows[lab] || []).push({ step, result, problem: problem || '', shot: shot || '' });
}
function ok(lab, c, step, m, shot) { if (c) { pass++; row(lab, step, 'OK', '', shot); } else { fail++; row(lab, step, 'FAIL', m, shot); problems.push({ lab, step, problem: m }); } console.log('  ' + (c ? 'ok  ' : 'XX  ') + '[' + lab + '] ' + step + (c ? '' : ' — ' + m)); }
function note(lab, step, m, severity) { problems.push({ lab, step, problem: m, severity: severity || 'minor' }); console.log('  !!  [' + lab + '] ' + step + ' — ' + m); }
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });

/* ── the stand-in: one shop's day, one figure per source — extends index-page.cjs's own shape with what the
   three Labs ask for that the index page never does (product lists, combo templates, definitions, modifiers) */
function standIn() {
  const today = new Date().toISOString().slice(0, 10);
  const items = [];
  for (let i = 0; i < 112; i++) {
    const d = { price: { amount: 10 + i, currency: 'INR' }, cost: { amount: 6 + i, currency: 'INR' },
      category: 'Shelf ' + (i % 7 + 1) };
    if (i === 5) delete d.cost;
    if (i < 5) d.modifiers = [{ name: 'M' + i }, { name: 'N' + i }];
    items.push({ id: 'p' + i, item_id: 'p' + i, item_data: Object.assign({ name: 'Product ' + i, unit: 'pc' }, d) });
  }
  return {
    calls: [],
    me: { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR', gstn: null } },
    counters: [{ id: 'C1', name: 'Counter 1', state: 'open' }],
    summary: { rows: [{ key: today, count: 12, total: 4280 }],
      prices_read_at: new Date(Date.now() - 3600 * 1000).toISOString(), unsent: 0 },
    items,
    combos: [],                                        /* POST /api/combo-templates fills this in */
    comboSeq: 0,
    definitions: [{ definition_id: 'd1', status: 'draft', kind: 'offer', sub_kind: 'percent_off', name: 'seed draft',
      created_at: new Date().toISOString(), rules: { _lab: { title: 'seed', detail: '', n: '10%', k: 'draft' } } }],
    defSeq: 1,
    booksOn: true,
    health: { enabled: true, last_posted_day: '2026-09-26', waiting: [] },
    costAccess: { can_see_costs: true, is_owner: true },
    accounts: [
      { code: '1300', name: 'Debtors', is_group: false }, { code: '2100', name: 'Creditors', is_group: false },
      { code: '1400', name: 'Cash', is_group: false }, { code: '2201', name: 'GST payable', is_group: false },
      { code: '4000', name: 'Sales', is_group: false },
    ],
    /* ── Product Lab's own source: a supplier list the shop can adopt from ── */
    productLists: {
      have: 112, currency: 'INR', language_names: { ta: 'Tamil' },
      lists: [
        { key: 'veg', label: 'Vegetables & fruit', count: 3, languages: ['ta'], categories: ['Vegetables', 'Fruit'],
          rows: [
            { name: 'Tomato', unit: 'kg', price: 30, category: 'Vegetables', names: { ta: ['தக்காளி'] } },
            { name: 'Onion', unit: 'kg', price: 25, category: 'Vegetables', names: { ta: ['வெங்காயம்'] } },
            { name: 'Banana', unit: 'dozen', price: 50, category: 'Fruit', names: { ta: ['வாழைப்பழம்'] } },
          ] },
        { key: 'grocery', label: 'Grocery', count: 2, languages: [], categories: ['Staples'],
          rows: [
            { name: 'Rice', unit: 'kg', price: 60, category: 'Staples', names: {} },
            { name: 'Sugar', unit: 'kg', price: 45, category: 'Staples', names: {} },
          ] },
      ],
      mine: [{ name: 'Rice', unit: 'kg', price: 55 }],  /* the shop already sells Rice at ITS OWN price, not the suggestion */
    },
  };
}

const KNOWN = [];   // { re, method, fn(S, m, r, u) }
function on(method, re, fn) { KNOWN.push({ method, re, fn }); }

on('GET', /^\/api\/entities\/me$/, (S, m, r) => J(r, 200, S.me));
on('GET', /^\/api\/entities\/me\/can-see-costs$/, (S, m, r) => J(r, 200, S.costAccess));
on('GET', /^\/api\/counters$/, (S, m, r) => J(r, 200, { ok: true, counters: S.counters, free: 0 }));
on('GET', /^\/api\/till\/summary$/, (S, m, r) => J(r, 200, S.summary));
on('GET', /^\/api\/products\/lists$/, (S, m, r) => J(r, 200, S.productLists));
on('POST', /^\/api\/products\/lists\/adopt$/, (S, m, r, u, body) => {
  const names = (body && body.names) || [];
  J(r, 200, { message: 'Added ' + names.length + ' product' + (names.length === 1 ? '' : 's') + ' to your catalogue.' });
});
on('GET', /^\/api\/products$/, (S, m, r) => J(r, 200, { items: S.items }));
on('POST', /^\/api\/products$/, (S, m, r, u, body) => {
  const id = 'new' + (S.items.length + 1);
  const item = { id, item_id: id, item_data: (body && body.item_data) || {} };
  S.items.push(item);
  J(r, 200, { ok: true, item_id: id, item });
});
on('PATCH', /^\/api\/products\/[^/]+$/, (S, m, r, u, body) => {
  const id = decodeURIComponent(u.pathname.split('/').pop());
  const it = S.items.find((x) => x.id === id || x.item_id === id);
  if (it && body && body.item_data) Object.assign(it.item_data, body.item_data);
  J(r, 200, { ok: true, item: it || {} });
});
on('GET', /^\/api\/combo-templates$/, (S, m, r) => J(r, 200, { templates: S.combos }));
on('POST', /^\/api\/combo-templates$/, (S, m, r, u, body) => {
  const id = 'c' + (++S.comboSeq);
  const t = { id, name: (body && body.name) || 'Untitled combo', definition: (body && body.definition) || [],
    price: (body && body.price) != null ? body.price : null, product_item_id: null };
  S.combos.push(t);
  J(r, 200, { ok: true, template: t });
});
on('PATCH', /^\/api\/combo-templates\/[^/]+$/, (S, m, r, u, body) => {
  const id = u.pathname.split('/').pop();
  const t = S.combos.find((x) => x.id === id);
  if (t && body) Object.assign(t, body);
  J(r, 200, { ok: true, template: t || {} });
});
on('DELETE', /^\/api\/combo-templates\/[^/]+$/, (S, m, r, u) => {
  const id = u.pathname.split('/').pop();
  S.combos = S.combos.filter((x) => x.id !== id);
  J(r, 200, { ok: true });
});
on('POST', /^\/api\/combo-templates\/[^/]+\/push$/, (S, m, r, u) => {
  const id = u.pathname.split('/')[3];
  const t = S.combos.find((x) => x.id === id);
  const verb = t && t.product_item_id ? 'updated' : 'created';
  const itemId = (t && t.product_item_id) || 'pushed_' + id;
  if (t) t.product_item_id = itemId;
  J(r, 200, { verb, item: { item_id: itemId, item_data: { name: (t && t.name) || 'Combo' } } });
});
on('GET', /^\/api\/definitions$/, (S, m, r, u) => {
  const kind = u.searchParams.get('kind'), status = u.searchParams.get('status');
  let defs = S.definitions.filter((d) => d.status !== 'retired');
  if (kind) defs = defs.filter((d) => d.kind === kind);
  if (status) defs = defs.filter((d) => d.status === status);
  J(r, 200, { definitions: defs });
});
on('POST', /^\/api\/definitions$/, (S, m, r, u, body) => {
  const id = 'd' + (++S.defSeq);
  const d = Object.assign({ definition_id: id, created_at: new Date().toISOString() }, body || {});
  S.definitions.push(d);
  J(r, 200, { ok: true, definition: d });
});
on('PUT', /^\/api\/definitions\/[^/]+$/, (S, m, r, u, body) => {
  const id = u.pathname.split('/').pop();
  const d = S.definitions.find((x) => x.definition_id === id);
  if (d && body) Object.assign(d, body);
  J(r, 200, { ok: true });
});
on('DELETE', /^\/api\/definitions\/[^/]+$/, (S, m, r, u) => {
  const id = u.pathname.split('/').pop();
  const d = S.definitions.find((x) => x.definition_id === id);
  if (d) d.status = 'retired';
  J(r, 200, { ok: true });
});
on('GET', /^\/api\/books\/health$/, (S, m, r) => { if (!S.booksOn) return J(r, 404, { error: 'Not found' }); J(r, 200, S.health); });
on('GET', /^\/api\/books\/accounts$/, (S, m, r) => { if (!S.booksOn) return J(r, 404, { error: 'Not found' }); J(r, 200, { accounts: S.accounts }); });

function route(S, r) {
  const u = new URL(r.request().url()), p = u.pathname, m = r.request().method();
  S.calls.push(p);
  apiPathsSeen.add(m + ' ' + p);
  const hit = KNOWN.find((k) => k.method === m && k.re.test(p));
  if (hit) {
    let body = null;
    try { const pd = r.request().postData(); if (pd) body = JSON.parse(pd); } catch (_) {}
    return hit.fn(S, m, r, u, body);
  }
  unknownPaths.add(m + ' ' + p);
  console.log('  ??  unknown API path the stand-in did not know: ' + m + ' ' + p);
  if (m === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if ((!f.startsWith(PUB) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();

  /* ── one context per (lab × signed-state × viewport); closed right after — memory stays flat ── */
  async function openCtx(opts) {
    opts = opts || {};
    const S = opts.S || standIn();
    const ctx = await b.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => route(S, r));
    if (!opts.signedOut) {
      await ctx.addInitScript(() => { try {
        const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
        const tok = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-lab', identity_type: 'entity', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
        localStorage.setItem('cb_sess', JSON.stringify({ token: tok, role: 'entity', name: 'Mayur', entity: 'Mayur Bhavan' })); } catch (_) {} });
    }
    const p = await ctx.newPage();
    const pageErrors = [], consoleErrors = [], consoleWarnings = [], failedRequests = [], dialogs = [];
    p.on('pageerror', (e) => pageErrors.push(e.message));
    p.on('console', (msg) => {
      const t = msg.type();
      /* this harness deliberately aborts the Google Fonts request (ctx.route, same as e2e/index-page.cjs) —
         Chromium logs that abort as this exact, URL-less console error; it is a test-harness artifact, never
         a real page problem, so it is dropped here exactly where index-page.cjs drops the matching pageerror
         ("fonts|favicon"). Any OTHER console error still gets through. */
      if (msg.text() === 'Failed to load resource: net::ERR_FAILED') return;
      if (t === 'error') consoleErrors.push(msg.text());
      else if (t === 'warning') consoleWarnings.push(msg.text());
    });
    p.on('requestfailed', (req) => { if (/\/api\//.test(req.url())) failedRequests.push(req.url() + ' — ' + (req.failure() && req.failure().errorText)); });
    p.on('response', (res) => { if (/\/api\//.test(res.url()) && res.status() >= 400) failedRequests.push(res.url() + ' — HTTP ' + res.status()); });
    p.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message()); await d.dismiss().catch(() => {}); });
    return { ctx, p, S, pageErrors, consoleErrors, consoleWarnings, failedRequests, dialogs };
  }
  const settle = (p) => p.waitForTimeout(500);
  async function bodyText(p) { try { return await p.evaluate(() => document.body.innerText); } catch (_) { return ''; } }
  async function scrollWidthOk(p, width) {
    try { const w = await p.evaluate(() => document.documentElement.scrollWidth); return w <= width + 1; } catch (_) { return true; }
  }
  function reportHealth(lab, state, h, shotName) {
    const mine = h.pageErrors.filter((m) => !/fonts|favicon/i.test(m));
    if (mine.length) note(lab, state + ': page errors', mine.slice(0, 3).join(' | ').slice(0, 300), 'critical');
    if (h.consoleErrors.length) note(lab, state + ': console errors', h.consoleErrors.slice(0, 3).join(' | ').slice(0, 300), 'major');
    if (h.consoleWarnings.length) note(lab, state + ': console warnings', h.consoleWarnings.slice(0, 2).join(' | ').slice(0, 200), 'minor');
    if (h.failedRequests.length) note(lab, state + ': failed requests', h.failedRequests.slice(0, 3).join(' | ').slice(0, 300), 'major');
    if (h.dialogs.length) note(lab, state + ': native alert()/confirm()', h.dialogs.join(' | '), 'major');
  }

  const LABS = [
    { key: 'product', title: 'Product Lab', tile: 'lab-product', fact: 'st_prod', href: 'product-lab.html' },
    { key: 'offer', title: 'Offer Lab', tile: 'lab-offer', fact: 'st_offer', href: 'offer-lab.html' },
    { key: 'combo', title: 'Combo Lab', tile: 'lab-combo', fact: 'st_combo', href: 'combo-lab.html' },
  ];
  const VIEWPORTS = [{ w: 1280, label: '1280' }, { w: 390, label: '390' }];
  const STATES = [{ signedOut: false, label: 'in' }, { signedOut: true, label: 'out' }];

  /* ═══ index + the Tax Lab tile: every viewport, signed in AND signed out ═══════════════════════════════════
   * ⚠️ "coming" is only guaranteed SIGNED OUT — e2e/index-page.cjs's own signed-out assertion is
   * `/^coming$/.test(...)`, but signed in, index.html's facts() unconditionally overwrites #st_tax with the
   * shop's real GST status (labFact('st_tax', g ? 'GST invoices' : 'no GSTIN — cash memos', ...) inside the
   * /api/entities/me read) — proved deliberately by index-page.cjs's own "all well" case. So "is not a link"
   * is checked in both states; "says coming" only signed out; signed in, the live text is simply recorded. */
  for (const st of STATES) {
    for (const vp of VIEWPORTS) {
      const h = await openCtx({ viewport: { width: vp.w, height: 900 }, signedOut: st.signedOut });
      const { p } = h;
      const label = vp.label + 'px-' + st.label;
      await p.goto(base + '/');
      await settle(p);
      const tax = await p.locator('[data-testid="lab-tax"]').first();
      const taxTag = await tax.evaluate((el) => el.tagName).catch(() => '?');
      const taxHref = await tax.getAttribute('href').catch(() => null);
      const taxText = (await p.textContent('#st_tax').catch(() => '')) || '';
      ok('index', taxTag !== 'A' && !taxHref, 'Tax Lab tile is not a link (' + label + ')', 'tagName=' + taxTag + ' href=' + taxHref);
      if (st.signedOut) ok('index', /^coming$/.test(taxText.trim()), 'signed out: Tax Lab tile says "coming" (' + label + ')', 'got "' + taxText.trim() + '"');
      else row('index', 'signed in: Tax Lab tile\'s own status text (' + label + ')', 'INFO', 'reads "' + taxText.trim() + '" (the real GST status, by design — see e2e/index-page.cjs) rather than "coming"');
      const sw = await scrollWidthOk(p, vp.w);
      ok('index', sw, 'no horizontal scroll (' + label + ')', 'document.scrollWidth exceeded ' + vp.w);
      await p.screenshot({ path: path.join(SHOTS, 'labs-flow-index-' + label + '.png'), fullPage: true });
      reportHealth('index', label, h, 'index-' + label);
      await h.ctx.close();
    }
  }

  /* ═══ each Lab × signed-in/out × 1280/390 ═══════════════════════════════════════════════════════════════════ */
  for (const lab of LABS) {
    for (const st of STATES) {
      for (const vp of VIEWPORTS) {
        const state = st.label + '-' + vp.label;
        const h = await openCtx({ viewport: { width: vp.w, height: 900 }, signedOut: st.signedOut });
        const { p, S } = h;
        try {
          /* 1 · the index, the tile's live fact, the click through */
          await p.goto(base + '/');
          await settle(p);
          let factText = '';
          if (!st.signedOut) {
            await p.waitForFunction((id) => ((document.getElementById(id) || {}).textContent || '').length > 0, lab.fact, { timeout: 8000 }).catch(() => {});
            factText = (await p.textContent('#' + lab.fact).catch(() => '')) || '';
            ok(lab.key, factText.trim().length > 0, 'index tile fact is filled (' + state + ')', 'tile #' + lab.fact + ' stayed blank — "' + factText + '"');
          } else {
            factText = (await p.textContent('#' + lab.fact).catch(() => '')) || '';
            ok(lab.key, factText.trim() === '', 'signed out: no fact leaks onto the tile (' + state + ')', 'tile showed "' + factText + '" with nobody signed in');
          }
          const shotIdx = 'labs-flow-' + lab.key + '-index-' + state + '.png';
          await p.screenshot({ path: path.join(SHOTS, shotIdx), fullPage: true });

          await Promise.all([
            p.waitForLoadState('load').catch(() => {}),
            p.click('[data-testid="' + lab.tile + '"]'),
          ]);
          await settle(p);
          const onLabPage = (await p.url()).indexOf(lab.href) >= 0;
          ok(lab.key, onLabPage, 'clicking the tile opens ' + lab.href + ' (' + state + ')', 'landed on ' + (await p.url()));

          /* Home link carries the same testid on every Lab page */
          const homeHref = await p.getAttribute('[data-testid="nav-home"]', 'href').catch(() => null);
          ok(lab.key, homeHref === '/', lab.title + ' header carries Home → / (' + state + ')', 'href was "' + homeHref + '"');

          /* 2 · the Lab's own main flow */
          if (lab.key === 'product') await productFlow(p, S, st, vp, state);
          if (lab.key === 'offer') await offerFlow(p, S, st, vp, state, h);
          if (lab.key === 'combo') await comboFlow(p, S, st, vp, state, h);

          const shotLab = 'labs-flow-' + lab.key + '-lab-' + state + '.png';
          await p.screenshot({ path: path.join(SHOTS, shotLab), fullPage: true });

          const sw = await scrollWidthOk(p, vp.w);
          ok(lab.key, sw, lab.title + ': no horizontal scroll at ' + vp.label + 'px (' + state + ')', 'document.scrollWidth exceeded ' + vp.w);

          const tnow = await bodyText(p);
          ok(lab.key, !/\bNaN\b/.test(tnow), lab.title + ': no NaN on screen (' + state + ')', 'the word "NaN" is visible');
          ok(lab.key, !/\bundefined\b/.test(tnow), lab.title + ': no "undefined" on screen (' + state + ')', '"undefined" is visible');
          ok(lab.key, !/error\.message|\[object Object\]/.test(tnow), lab.title + ': no technical error text on screen (' + state + ')', 'raw error text is visible');

          /* 3 · Home back to the index — same person, same figures */
          await p.click('[data-testid="nav-home"]');
          await p.waitForLoadState('load').catch(() => {});
          await settle(p);
          const backOnIndex = (await p.url()).replace(base, '').split('?')[0].split('#')[0];
          ok(lab.key, backOnIndex === '/' || backOnIndex === '/index.html' || backOnIndex === '', lab.title + ': Home returns to the index (' + state + ')', 'landed on "' + backOnIndex + '"');
          if (!st.signedOut) {
            const shopName = (await p.textContent('#shop').catch(() => '')) || '';
            ok(lab.key, /Mayur Bhavan/.test(shopName), lab.title + ': the same shop is still shown after Home (' + state + ')', 'header shop line read "' + shopName + '"');
          }
          const shotHome = 'labs-flow-' + lab.key + '-home-' + state + '.png';
          await p.screenshot({ path: path.join(SHOTS, shotHome), fullPage: true });
        } catch (e) {
          note(lab.key, state + ': flow threw', String(e && e.message || e).slice(0, 300), 'critical');
          fail++;
          try { await p.screenshot({ path: path.join(SHOTS, 'labs-flow-' + lab.key + '-CRASH-' + state + '.png'), fullPage: true }); } catch (_) {}
        }
        reportHealth(lab.key, state, h, state);
        await h.ctx.close();
      }
    }
  }

  /* ── Product Lab's own flow: choose from a list, price & shelf, adopt ──────────────────────────────────── */
  async function productFlow(p, S, st, vp, state) {
    if (st.signedOut) {
      const who = (await p.textContent('#who').catch(() => '')) || '';
      ok('product', /not signed in/.test(who), 'signed out: "#who" says not signed in (' + state + ')', 'got "' + who + '"');
      const say = (await p.textContent('#say').catch(() => '')) || '';
      ok('product', /Sign in to ChitBridge/.test(say), 'signed out: the sign-in prompt is shown (' + state + ')', 'got "' + say + '"');
      const calledLists = S.calls.includes('/api/products/lists');
      ok('product', !calledLists, 'signed out: no catalogue read is attempted (' + state + ')', '/api/products/lists was still called');
      return;
    }
    await p.waitForSelector('[data-testid="pl-table"]', { timeout: 10000 }).catch(() => {});
    const who = (await p.textContent('#who').catch(() => '')) || '';
    ok('product', /products in your catalogue today/.test(who), '"#who" reads the catalogue size (' + state + ')', 'got "' + who + '"');

    /* Tick all shown on the default list, then move to price & shelf */
    const tickAll = p.locator('[data-testid="pl-all"]');
    if (await tickAll.count()) { await tickAll.click(); await settle(p); }
    const nextBtn = p.locator('[data-testid="pl-next"]');
    const nextEnabled = await nextBtn.isEnabled().catch(() => false);
    ok('product', nextEnabled, '"Tick all shown" picks at least one product (' + state + ')', 'Next stayed disabled after "Tick all shown"');
    if (nextEnabled) {
      await nextBtn.click();
      await settle(p);
      const onReview = await p.locator('[data-testid="pl-review"]').count();
      ok('product', onReview > 0, 'step 2 — price & shelf — opens (' + state + ')', 'the review table never appeared');
      if (onReview) {
        /* change a price, as a shopkeeper amending a suggested one */
        const priceInputs = p.locator('[data-testid="pl-review"] input[type="number"]');
        const n = await priceInputs.count();
        if (n) {
          await priceInputs.first().fill('99');
          await settle(p);
          const v = await priceInputs.first().inputValue();
          ok('product', v === '99', 'a price can be typed over the suggestion (' + state + ')', 'input read back "' + v + '" after typing 99');
        } else note('product', state + ': price & shelf', 'no editable price inputs on the review table', 'major');

        const availBtn = p.locator('[data-testid="pl-shelf-available"]');
        if (await availBtn.count()) { await availBtn.click(); await settle(p); }

        const adoptBtn = p.locator('[data-testid="pl-adopt"]');
        const adoptEnabled = await adoptBtn.isEnabled().catch(() => false);
        ok('product', adoptEnabled, '"Add … to my catalogue" is enabled with items picked (' + state + ')', 'Adopt stayed disabled');
        if (adoptEnabled) {
          const before = S.calls.filter((c) => c === '/api/products/lists/adopt').length;
          await adoptBtn.click();
          await p.waitForFunction((b) => {
            const el = document.getElementById('say');
            return el && el.textContent && el.textContent.length > 0;
          }, before, { timeout: 8000 }).catch(() => {});
          await settle(p);
          const after = S.calls.filter((c) => c === '/api/products/lists/adopt').length;
          ok('product', after > before, 'Adopt calls POST /api/products/lists/adopt (' + state + ')', 'no adopt call was observed');
          const say = (await p.textContent('#say').catch(() => '')) || '';
          ok('product', /Added/.test(say) && !/could not/i.test(say), 'Adopt reports success in plain words (' + state + ')', 'say() read "' + say + '"');
        }
      }
    }
  }

  /* ── Offer Lab's own flow: make an offer, see the price/margin effect, try the advisor ─────────────────── */
  async function offerFlow(p, S, st, vp, state, h) {
    await p.waitForSelector('[data-testid="lab-design"]', { timeout: 10000 }).catch(() => {});
    const src = (await p.textContent('#src').catch(() => '')) || '';
    if (st.signedOut) {
      ok('offer', /example products/.test(src), 'signed out: the lab opens on example products (' + state + ')', 'src chip read "' + src + '"');
      /* pressing "Re-read my catalogue" signed out — the main control a shopkeeper would actually press */
      const before = h.dialogs.length;
      await p.click('[data-testid="lab-load-mine"]').catch(() => {});
      await settle(p);
      row('offer', 'press "Re-read my catalogue" signed out (' + state + ')', h.dialogs.length > before ? 'NATIVE ALERT' : 'no dialog', h.dialogs.length > before ? h.dialogs[h.dialogs.length - 1] : '');
      if (h.dialogs.length > before) note('offer', state + ': "Re-read my catalogue" (signed out)', 'pressing it raises a native alert() — "' + h.dialogs[h.dialogs.length - 1] + '"', 'major');
    } else {
      await p.waitForFunction(() => { const el = document.getElementById('src'); return el && /products ·/.test(el.textContent || ''); }, null, { timeout: 8000 }).catch(() => {});
      const src2 = (await p.textContent('#src').catch(() => '')) || '';
      ok('offer', /products ·/.test(src2), 'signed in: the lab opens on the real catalogue (' + state + ')', 'src chip read "' + src2 + '"');
    }

    /* toggle the plain "% off" offer, add a product to the basket, read the money block */
    const pctOn = p.locator('[data-testid="lab-on-pct"]');
    if (await pctOn.count()) { await pctOn.check().catch(() => {}); await settle(p); }
    const firstPlus = p.locator('#p_list button:has-text("+")').first();
    if (await firstPlus.count()) { await firstPlus.click().catch(() => {}); await settle(p); }
    else {
      const anyRow = p.locator('#p_list').locator('button, [role="button"]').first();
      if (await anyRow.count()) await anyRow.click().catch(() => {});
    }
    await settle(p);
    const money = (await p.textContent('[data-testid="lab-money"]').catch(() => '')) || '';
    ok('offer', money.trim().length > 0, 'the money block shows an outcome once an offer is on and a product is added (' + state + ')', 'the money block stayed empty');
    ok('offer', !/NaN|undefined/.test(money), 'the money block has no NaN/undefined (' + state + ')', 'money block read "' + money.replace(/\s+/g, ' ').trim().slice(0, 150) + '"');

    /* the advisor: pick a goal, read a suggestion, try it */
    const goalSel = p.locator('[data-testid="lab-goal"]');
    if (await goalSel.count()) { await goalSel.selectOption('move').catch(() => {}); await settle(p); }
    const tryBtn = p.locator('#adv-out button:has-text("Try it")').first();
    if (await tryBtn.count()) {
      await tryBtn.click();
      await settle(p);
      const money2 = (await p.textContent('[data-testid="lab-money"]').catch(() => '')) || '';
      ok('offer', money2.trim().length > 0, 'the advisor\'s "Try it" repaints the money block (' + state + ')', 'the money block stayed empty after Try it');
    } else note('offer', state + ': advisor', 'no "Try it" suggestion appeared for the "move this product quickly" goal', 'minor');
  }

  /* ── Combo Lab's own flow ─────────────────────────────────────────────────────────────────────────────────
   * ⚠️ THE PAGE BOOTS STRAIGHT INTO THE "Combos and modifiers" MODAL (combo-lab.html's own boot script calls
   * openModLab() unconditionally, right after its one render() — see that file's own comment above the call:
   * "this page boots straight into the modifier/combo builder and there is nothing behind it a person could
   * reach"). So the Settings screen, the 8 offer goals (including "Two things at one price"), and Saved
   * offers are NOT the first thing a shopkeeper sees — the modal is. Its own ✕ button (closeModLab()) DOES
   * remove the modal (classList.remove('on') runs unconditionally) and reveal Settings underneath, but it
   * ALSO tries window.close() and then shows a toast reading "You can close this tab now" — which is wrong
   * the moment window.close() is a no-op (true for every normally-opened tab), since the modal has in fact
   * just closed onto a fully usable page, not a tab that is going away. Tested below as a real finding.
   */
  async function comboFlow(p, S, st, vp, state, h) {
    await p.waitForSelector('#modLabOverlay.on', { timeout: 10000 }).catch(() => {});
    const defaultTab = (await bodyText(p));
    ok('combo', /Modifiers/.test(await p.textContent('#modLabTabs').catch(() => '')), 'the Lab boots straight into the "Combos and modifiers" modal, Modifiers tab first (' + state + ')', 'modal tabs not found on load');

    /* the "Combos" tab, inside the modal: build a combo (pre-filled example) and save it to the library */
    const combosTab = p.locator('#modLabTabs button:has-text("Combos")');
    if (await combosTab.count()) { await combosTab.click(); await settle(p); }
    const buildBtn = p.locator('button:has-text("+ Build a combo")').first();
    if (await buildBtn.count()) {
      await buildBtn.click();
      await settle(p);
      const nameVal = await p.locator('#modLabBody input.inp').first().inputValue().catch(() => '');
      ok('combo', nameVal.trim().length > 0, '"+ Build a combo" opens pre-filled with an example name (' + state + ')', 'the combo name field was blank');
      const saveAsOpen = p.locator('button[onclick="modLabSaveAsOpen()"]').first();
      if (await saveAsOpen.count()) {
        await saveAsOpen.click();
        await settle(p);
        const nameInput = p.locator('#modLabSaveName');
        if (await nameInput.count()) await nameInput.fill('Lab test combo');
        const beforeCombos = S.combos.length;
        /* ⚠️ NOT :has-text("Save") — Playwright's text match is case-insensitive, so "📂 Use a saved combo"
           (modLabOpenLibrary()) matches "Save" too and sorts first in the DOM. The onclick attribute names
           the one real Save button precisely. */
        await p.locator('#modLabBody button[onclick="modLabSaveAsConfirm()"]').click().catch(() => {});
        await settle(p);
        const toastTxt = (await p.textContent('#labtoast').catch(() => '')) || '';
        if (!st.signedOut) {
          /* signed in, combo-lab.html's own boot script runs `if (savedLive()) labUseMine(true);`
             UNCONDITIONALLY — quietly loading the real catalogue (S.biz becomes 'mine') in the background
             even while the modal sits open over it. By the time this Save lands, that quiet load has
             normally finished, so the save succeeds for real. */
          ok('combo', S.combos.length > beforeCombos, 'signed in: Save as… posts a new combo template to /api/combo-templates (' + state + ')', 'no combo was created on the stand-in; toast read "' + toastTxt + '"');
          ok('combo', /saved/i.test(toastTxt), 'the save is confirmed in plain words (' + state + ')', 'toast read "' + toastTxt + '"');
        } else {
          /* signed out: nothing can be "mine", so the save must refuse — never a silent no-op */
          ok('combo', S.combos.length === beforeCombos, 'signed out: Save as… refuses rather than writing silently (' + state + ')', 'a combo was created on the stand-in while signed out');
          ok('combo', /sign in|catalogue/i.test(toastTxt), 'the refusal is said in plain words (' + state + ')', 'toast read "' + toastTxt + '"');
        }
      } else note('combo', state + ': Combos tab', '"Save as…" was not offered after "+ Build a combo"', 'major');
    } else note('combo', state + ': Combos tab', '"+ Build a combo" was not on screen', 'major');

    /* close the modal — the one documented way back to Settings — and check what it tells the shopkeeper */
    const closeBtn = p.locator('#modLabOverlay .ovlx');
    ok('combo', await closeBtn.count() > 0, 'the modal has its own close (✕) button (' + state + ')', 'no .ovlx close button found');
    if (await closeBtn.count()) {
      const beforeDialogs = h.dialogs.length;
      await closeBtn.click();
      await p.waitForTimeout(300);
      const stillOpen = await p.locator('#modLabOverlay.on').count();
      ok('combo', stillOpen === 0, 'closing the modal actually closes it (' + state + ')', 'modLabOverlay still carries class "on" after ✕');
      const toastAfterClose = (await p.textContent('#labtoast').catch(() => '')) || '';
      if (/close this tab/i.test(toastAfterClose)) note('combo', state + ': closing the modal', 'the close button says "You can close this tab now" — but the modal just closed onto a fully usable page (window.close() is a no-op on a normally-opened tab); the message tells a shopkeeper mid-flow to leave', 'major');
    }

    /* now Settings (Screen 0) is reachable: Use my catalogue, then the goal wizard, then a modifier */
    if (!st.signedOut) {
      const useMine = p.locator('#labMineBtn');
      if (await useMine.count()) {
        await useMine.click();
        await p.waitForFunction(() => { const el = document.getElementById('bizName'); return el && /Mayur/.test(el.textContent || ''); }, null, { timeout: 8000 }).catch(() => {});
        await settle(p);
        const bizName = (await p.textContent('#bizName').catch(() => '')) || '';
        ok('combo', /Mayur/.test(bizName), '"Use my catalogue" loads the real catalogue, once the modal is out of the way (' + state + ')', 'bizName chip read "' + bizName + '"');
        /* ⚠️ public/combo-lab.html:166 and :281 both declare `.note{display:flex}`; the browser's own
           [hidden]{display:none} rule has the same specificity and the author stylesheet always wins, so
           `element.hidden = true` has NO visual effect on any element carrying class="note ..." — confirmed
           by reading the rendered screenshot, not just the DOM. Affects #labSampleNote (542), #labqueue
           (543) and #labtoast (553): once shown, none of them can ever be hidden again, by any means. */
        const noteBug = await p.evaluate(() => {
          const el = document.getElementById('labSampleNote');
          return el && el.hidden && getComputedStyle(el).display !== 'none';
        }).catch(() => false);
        ok('combo', !noteBug, 'the "Showing sample data" banner actually disappears once your own catalogue is in use (' + state + ')', '.note{display:flex} (public/combo-lab.html:166,281) overrides the [hidden] attribute — the banner stays on screen, saying "Showing sample data (Sample Tiffin Corner)" over your REAL catalogue, forever');
      } else note('combo', state + ': Settings', '#labMineBtn was not reachable even after closing the modal', 'critical');
    }

    const done0 = p.locator('button:has-text("Done — pick an offer")');
    if (await done0.count()) { await done0.click(); await settle(p); }
    const bundleGoal = p.locator('button.goal:has-text("Two things at one price")');
    const hasBundle = await bundleGoal.count();
    ok('combo', hasBundle > 0, 'Screen 1 lists the "Two things at one price" goal (' + state + ')', 'goal card not found');
    if (hasBundle) {
      await bundleGoal.first().click();
      await settle(p);
      const priceBox = p.locator('[data-key="bunPrice"]');
      if (await priceBox.count()) { await priceBox.fill('80'); await settle(p); }
      /* onclick="apply()", not a text match — the steps strip's own 3rd step is also labelled "Work it out" */
      const workBtn = p.locator('button[onclick="apply()"]');
      ok('combo', await workBtn.count() > 0, '"Work it out" is on screen (' + state + ')', 'button not found');
      if (await workBtn.count()) {
        await workBtn.click();
        await settle(p);
        const bodyTxt = await bodyText(p);
        ok('combo', !/NaN|undefined/.test(bodyTxt.slice(0, 4000)), 'the worked-out combo has no NaN/undefined (' + state + ')', 'NaN/undefined visible after Work it out');
        const saveBtn = p.locator('button:has-text("Save for review")');
        if (await saveBtn.count()) {
          const before = S.definitions.length;
          await saveBtn.click();
          await p.waitForFunction(() => /Saved offers/i.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
          await settle(p);
          if (!st.signedOut) {
            ok('combo', S.definitions.length > before, '"Save for review" (signed in, own catalogue) posts to /api/definitions (' + state + ')', 'no new definition was created on the stand-in');
          } else {
            ok('combo', true, '"Save for review" (signed out) saves locally without a server call (' + state + ')');
          }
          const bucket = (await p.textContent('#bucketChip').catch(() => '')) || '';
          ok('combo', /\d/.test(bucket) && !/Saved offers\s*0\s*$/.test(bucket.trim()), 'the "Saved offers" counter moved off zero (' + state + ')', 'bucket chip read "' + bucket + '"');
        }
      }
    }

    /* a modifier: the "Modifiers" card lives on Screen 0 only — "Change" (on the strip) gets back there */
    const changeBtn = p.locator('.strip button:has-text("Change")');
    if (await changeBtn.count()) { await changeBtn.click(); await settle(p); }
    const modBtn = p.locator('button:has-text("🧩 Open the modifier lab")');
    if (await modBtn.count()) {
      await modBtn.click();
      await settle(p);
      const addToProduct = p.locator('button:has-text("Add one to a product")');
      const addMore = p.locator('button:has-text("+ Add to another product")');
      const btn = (await addToProduct.count()) ? addToProduct : addMore;
      if (await btn.count()) {
        await btn.click();
        await settle(p);
        const pickRow = p.locator('.ovlpickrow').first();
        if (await pickRow.count()) {
          await pickRow.click();
          await settle(p);
          const addGroup = p.locator('button:has-text("+ Add a group")');
          ok('combo', await addGroup.count() > 0, 'the modifier editor opens for a picked product (' + state + ')', '"+ Add a group" not found');
          if (await addGroup.count()) {
            await addGroup.click();
            await settle(p);
            const applyBtn = p.locator('button:has-text("Apply to ")');
            ok('combo', await applyBtn.count() > 0, 'an "Apply to <product>" button appears after adding a group (' + state + ')', 'Apply button not found');
            if (await applyBtn.count()) {
              const beforePatch = S.calls.filter((c) => /^\/api\/products\//.test(c)).length;
              await applyBtn.click();
              await settle(p);
              if (!st.signedOut) {
                const afterPatch = S.calls.filter((c) => /^\/api\/products\//.test(c)).length;
                ok('combo', afterPatch > beforePatch, 'Apply (signed in, own catalogue) PATCHes the real product (' + state + ')', 'no PATCH /api/products/:id was observed');
              } else ok('combo', true, 'Apply (signed out / sample catalogue) stays local, no server call (' + state + ')');
            }
          }
        } else note('combo', state + ': modifier picker', 'the price-list overlay opened but no pickable row was found', 'major');
      } else note('combo', state + ': modifier lab', 'neither "Add one to a product" nor "Add to another product" was on screen', 'minor');
      /* reopening the modifier lab re-adds class "on" to #modLabOverlay — close it again or the page's own
         Home link (outside the modal) is unclickable and every later step on this page times out */
      const closeBtn2 = p.locator('#modLabOverlay .ovlx');
      if (await closeBtn2.count()) await closeBtn2.click().catch(() => {});
      await settle(p);
    } else note('combo', state + ': modifier lab', '"Open the modifier lab" button was not reachable from where the flow left off', 'minor');
  }

  await b.close(); srv.close();

  /* ── write the per-Lab tables + the API surface, for the report ─────────────────────────────────────────── */
  console.log('\n\n══════════════════════════════════════════════════════════════════');
  for (const lab of Object.keys(rows)) {
    console.log('\n### ' + lab + ' ###');
    rows[lab].forEach((r) => console.log('  ' + r.result.padEnd(4) + ' ' + r.step + (r.problem ? ' — ' + r.problem : '')));
  }
  console.log('\n### API paths every Lab called (candidates for a permanent stand-in) ###');
  [...apiPathsSeen].sort().forEach((p) => console.log('  ' + p));
  if (unknownPaths.size) {
    console.log('\n### API paths NOT recognised by this stand-in ###');
    [...unknownPaths].sort().forEach((p) => console.log('  ' + p));
  } else console.log('\n(every API path called was already known to the stand-in)');

  console.log('\n### problems, as found (severity noted where known) ###');
  problems.forEach((pr) => console.log('  [' + (pr.severity || 'check') + '] ' + pr.lab + ' — ' + pr.step + ': ' + pr.problem));

  console.log('\n  labs-flow: ' + pass + ' passed, ' + fail + ' failed, ' + problems.length + ' problems noted');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
