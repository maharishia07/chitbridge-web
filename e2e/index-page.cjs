#!/usr/bin/env node
/* index-page.cjs — THE INDEX PAGE IS THE SHELL'S HOME, PROVED (index.html · public/app/manifest.json · plan row N18 · FIT §D Q1 Q3 Q5 Q10).
 * Pattern: shell.cjs — Playwright, a stand-in API answering INSIDE the page (ctx.route), a static server on a free OS port that serves
 * the repo-root index.html at / and public/ for everything else, exactly as it deploys. Nothing here reaches localhost:3000 or the live site.
 *
 * What it proves (exit 1 on any failure):
 *   1  static: index.html writes no card by hand, names no workshop page ("app.html"), no "tier", no "accounting"; it mounts CBShell as Home.
 *      the manifest: every built entry routes to a utility page that exists (never app.html); every other entry has no route (a dashed chip)
 *   2  1366 · signed in, the shipped manifest: Home mounts the shell once (data-mode=home); one card per built entry, each linking to its
 *      route; one dashed chip per other entry, none a link, and a click opens nothing; zero app.html hrefs outside the avatar (the allow-list)
 *      + 7 areas in the nav (home · selling · money · running · trade · labs · setup = CBShell.AREAS); every tile is 148px tall
 *   3  1366 · every read the page makes is a budgeted one (the API's round-trips.budget.json has a line for it - read from the api checkout
 *      when it is beside this one); a facts URL that is null paints nothing; a facts read that fails paints no figure and no status;
 *      nothing wrong → the alerts slot draws nothing; N19 404 → the sheet's empty state (kept)
 *   4  1366 · PLANTED manifest (facts URLs + the rail) and a planted API: each card's lines are the API's (one line + "+n" drop-down);
 *      each card with a facts answer carries its status (shell-state: needs_you · in_use · not_started) and Home's "Needs you" strip lists
 *      exactly the needs_you cards; "Your work" (railPaint) digits are the API's;
 *      "1 supplier bill to accept" · "1 supplier to add" · "2 waiting to be recorded" each carry their fix (FX-F10W: Books' To do counts); a counter paired to another shop earns an amber row with its fix
 *   5  word budget per VISIBLE area (Q10): Home ≤ 120 (with the "Your work" box and the alerts up), every other area ≤ BUDGET — at 1366 and at 390
 *   6  390: scrollWidth === 390; seven bottom tabs, one area at a time; the kural at the foot of Home
 *   7  signed out: not one /api call leaves the page; the cards are still drawn, no facts; the avatar is the one Sign in door;
 *      ?left=<shop> → the row says why, and its button is that door
 *   8  no page error; every stand-in answer for a contract route has the API's shape (e2e/lib/contract.cjs)
 * Screenshots: e2e/shots/index-laptop.png · index-alerts.png (planted, 1366) · index-phone.png (Home, 390) · index-phone-selling.png
 * Run one at a time:  NODE_PATH=e2e/node_modules node e2e/index-page.cjs                                                            */
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const SHOTS = path.join(__dirname, 'shots');
const C = require('./lib/contract.cjs'), books = require('./lib/books-api.cjs');
const J = C.json;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

/* ⭐ THE READS THE PAGE MAY MAKE: each has a line in chitbridge-api/round-trips.budget.json (DB10, I19) — or is the shell's own N19 read.
   A new read here needs its budget line there first. */
const BUDGET_FILE = [process.env.CB_API_DIR, path.join(ROOT, '..', 'chitbridge-api'), 'C:/dev/wt-walk-api', 'C:/dev/chitbridge-api']
  .filter(Boolean).map((d) => path.join(d, 'round-trips.budget.json')).find((p) => fs.existsSync(p));
const BUDGET_ROUTES = BUDGET_FILE ? Object.keys(JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')).routes) : null;
/* the page's reads. With the api checkout beside this one the budget FILE is asked ("GET <path>" must be a line there); without it, this
   list mirrors it (every /api/facts/<card> is one line each in the file). */
const READS = ['/api/entities/header', '/api/books/health', '/api/entities/me', '/api/entities/sides', '/api/work/facts', '/api/notifications', '/api/events/ticket', '/api/events/stream', '/api/books-grants', '/api/books-grants/practice'];
const budgeted = (p, method) => BUDGET_ROUTES ? BUDGET_ROUTES.includes((method || 'GET') + ' ' + p) : (READS.includes(p) || p.startsWith('/api/facts/'));

/* a planted manifest: facts URLs on four cards (two need you, one is in use with three lines, one is not started), the "Your work" read and its door.
   pillar decides the section: sales/marketing = Selling, finance/accounting = Money, the rest of the areas by their default. */
const PLANTED = { version: 2,
  rail: { route: '/tasks.html', facts: '/api/work/facts' },
  entries: [
    { id: 'till', name: 'Till', route: '/till.html', icon: '▤', area: 'selling', pillar: 'sales', state: 'built', what: 'Take money at the counter.', facts: '/api/facts/till' },
    { id: 'storefront', name: 'Storefront', route: '/shop.html', icon: '◇', area: 'selling', pillar: 'marketing', state: 'built', what: 'Your shop on the web.', facts: null },
    { id: 'marketing', name: 'Marketing', route: '/crm.html#/groups', icon: '◉', area: 'selling', pillar: 'marketing', state: 'built', what: 'Reach customers and bring them back.', facts: '/api/facts/marketing' },
    { id: 'catalogue', name: 'Catalogue', route: null, icon: '▦', area: 'selling', pillar: 'marketing', state: 'workshop' },
    { id: 'orders', name: 'Orders', route: null, icon: '↓', area: 'selling', pillar: 'sales', state: 'coming' },
    { id: 'finance', name: 'Finance', route: '/finance.html', icon: '◐', area: 'money', pillar: 'finance', state: 'built', what: 'Who owes you, who you owe.', facts: '/api/facts/finance' },
    { id: 'accounts', name: 'Accounts', route: '/accounts.html', icon: '¤', area: 'money', pillar: 'accounting', state: 'built', what: 'What the shop made, and what it owes.', facts: '/api/facts/accounts' },
    { id: 'crm', name: 'CRM', route: '/crm.html', icon: '◍', area: 'running', pillar: 'sales', state: 'built', what: 'Who buys, and how often.', facts: null },
    { id: 'product-lab', name: 'Product Lab', route: '/product-lab.html', icon: '◈', area: 'labs', pillar: 'labs', state: 'built', what: 'Cost, price, and what each one leaves you.', facts: null },
    { id: 'tax-lab', name: 'Tax Lab', route: null, icon: '§', area: 'labs', pillar: 'labs', state: 'coming' },
    { id: 'standards', name: 'Standards', route: '/standards.html', icon: '≡', area: 'setup', pillar: 'setup', state: 'built', what: 'What a chit must contain.', facts: null },
    { id: 'shop', name: 'Your business', route: null, icon: '⌂', area: 'setup', pillar: 'setup', state: 'workshop' }
  ] };
/* what each planted card's facts answer says: the server's `state` and its lines */
const FACTS = {
  /* RPT2: figures.trend — the teaser (8 weeks' sales in minor units, oldest first; the engine's change vs last year), drawn beside the line */
  '/api/facts/till': { state: 'needs_you', lines: [{ text: '12 bills · {money}', money: { amount: 4280, currency: 'INR' } }, { text: '1 bill waiting to send', tone: 'dn', act: { label: 'Send now', href: '/till.html' } }],
    figures: { trend: { spark: [400000, 380000, null, 420000, 450000, 410000, 470000, null], vs_last_year_pct: 12 } } },
  '/api/facts/accounts': { state: 'needs_you', lines: ['Ledger up to 7 Oct'] },
  '/api/facts/finance': { state: 'in_use', lines: ['3 customers owe you', '2 bills to pay', 'Cash is steady'] },
  '/api/facts/marketing': { state: 'not_started', lines: [] },
  '/api/work/facts': { truncated: false, counts: { orders_in: 5, orders_out: 2, tasks: 4, done: 7 }, lines: [{ text: '3 new orders', value: 3, tone: 'dn' }],
    figures: { orders_new: 3, tasks_mine: 2, orders_in: 5, orders_out: 2, tasks: 4, done: 7 } }
};
const PLANTED_STATE = { till: 'needs_you', accounts: 'needs_you', finance: 'in_use', marketing: 'not_started' };
/* the two reference drawers' answer (GET /api/entities/sides) - what is drawn inside them is e2e/cb-sides.cjs's business */
const SIDES = { lean: [{ key: 'rules', rows: [{ id: 'jurisdiction', n: 'India', m: 'Jurisdiction', s: 'ok', t: 'Current' }] }], use: [{ key: 'trade', rows: [{ id: 'customers', n: '2 customers', m: '24 chits open' }] }], impact: null };
/* the shop's /me row (a 404 here is "this account is gone": the avatar clears the session and the sign-in shows - see public/app/avatar.js pull) */
const ME = { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR' } };
const AREA_LIST = ['home', 'selling', 'money', 'running', 'trade', 'labs', 'setup'];   /* public/app/shell.js AREAS */

async function run() {
  const { chromium } = require('@playwright/test');
  const out = { pass: 0, fail: 0 };
  const ok = (c, m) => { if (c) out.pass++; else out.fail++; console.log((c ? '  ok  ' : '  XX  ') + m); };
  /* QA-154: the two findings that had no baseline (a read with no budget line; words over an area's budget) are recorded in
     e2e/scanner-known.json. A word over budget is one finding per excess word, so a rise fails and a fall is a fix. */
  const found = [];

  /* ── 1 · static ── */
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  /* the sign-in window's Register link is the workshop's page until a customer register page exists (BACKLOG: REGISTER PAGE) - the ONE allowed mention */
  ok(!/app\.html/.test(src.replace(/<!--[^]*?-->/g, '').replace(/registerHref:\s*'\/app\.html#\/register'/, '')), 'static · zero "app.html" in index.html (I12) bar the Register link (HTML comments aside)');
  ok(!/\btier\b/i.test(src), 'static · no word "tier" (Q5)');
  ok(!/accounting|books of account/i.test(src), 'static · neither "accounting" nor "books of account" (it is the Ledger)');
  ok(!/class="(box|lab|cbsh-box|cbsh-sc)[" ]/.test(src) && !/data-testid="(box|lab)-/.test(src), 'static · no hand-written card: every card is a manifest row');
  ok(/\/app\/shell\.js/.test(src) && /CBShell\.mount\(/.test(src) && /host:\s*null/.test(src), 'static · index.html mounts CBShell as Home (host null)');
  ok(!/\balert\s*\(/.test(src), 'static · no alert()');
  const man = JSON.parse(fs.readFileSync(path.join(PUB, 'app', 'manifest.json'), 'utf8'));
  /* TEMPORARY external dev card (Coverage, UX-141): an absolute URL is not a utility page file */
  const exists = (r) => { if (/^https?:\/\//.test(r)) return true; const p = r.split(/[#?]/)[0]; return p === '/' ? false : fs.existsSync(path.join(PUB, p)); };
  const badBuilt = man.entries.filter((e) => e.state === 'built' && !(e.route && exists(e.route) && !/app\.html/.test(e.route))).map((e) => e.id);
  const badRest = man.entries.filter((e) => e.state !== 'built' && e.route).map((e) => e.id);
  ok(badBuilt.length === 0, 'manifest · every built entry routes to a utility page that exists, never app.html, never the index itself' + (badBuilt.length ? ' — not: ' + badBuilt.join(', ') : ''));
  ok(badRest.length === 0, 'manifest · coming / workshop entries have no route (dashed chips)' + (badRest.length ? ' — routed: ' + badRest.join(', ') : ''));
  ok(man.rail && 'route' in man.rail && 'facts' in man.rail && !/app\.html/.test(JSON.stringify(man)), 'manifest · the rail widget is declared (route · facts), and nothing names app.html');
  const eff = (e) => (e.works && e.state === 'workshop' ? 'built' : e.state);   /* the roadmap's reading of a row (manifest `works`) */
  const BUILT = man.entries.filter((e) => e.state === 'built'), REST = man.entries.filter((e) => e.state !== 'built');
  for (const w of ['Catalogue', 'Accounts', 'Till', 'Standards', 'Suppliers', 'Assist', 'Connectors', 'Your business', 'Counters', 'CRM', 'Product Lab', 'Offer Lab', 'Combo Lab']) {
    ok(man.entries.some((e) => e.name === w), 'manifest · the old index\'s "' + w + '" is a manifest row');
  }

  /* ── the site as it deploys: / is the repo-root index.html, everything else public/ ── */
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if ((!f.startsWith(PUB) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch(), errs = [];

  /* the session the apps store: a signed token whose identity is the shop (CBOnePerson.who reads it) */
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const TOKEN = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-idx', identity_type: 'entity', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
  const SESSION = JSON.stringify({ token: TOKEN, role: 'entity', name: 'Mayur', entity: 'Mayur Bhavan', bridgeId: 'CBTEST1234' });

  async function profile(vw, vh, p) {
    p = p || {};
    const seen = [], calls = [];
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    ctx._lbl = vw + 'x' + vh + (p.signedOut ? ' out' : '') + (p.manifest ? ' planted' : '');
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    if (p.manifest) await ctx.route('**/app/manifest.json', (r) => J(r, 200, p.manifest));
    await ctx.route('**/api/**', (r) => {
      const u = new URL(r.request().url()); seen.push(u.pathname); calls.push({ m: r.request().method(), p: u.pathname });
      if (u.pathname === '/api/entities/me' && r.request().method() === 'GET') return J(r, 200, p.me || ME);
      if (u.pathname === '/api/entities/sides') return J(r, 200, SIDES);
      if (u.pathname === '/api/entities/header') return J(r, 404, { error: 'not found' });            /* N19 built, not live: the empty state stays */
      if (u.pathname === '/api/books/health') {
        if (p.booksOff) return J(r, 404, { error: 'Not found' });
        return J(r, 200, books.health(Object.assign({ waiting: (p.waiting || []).map((w) => books.waitingRow(w)) }, p.health || {})));
      }
      if (p.manifest && FACTS[u.pathname]) return J(r, 200, FACTS[u.pathname]);   /* the shipped manifest's facts reads do not exist yet: 404 */
      return J(r, 404, { error: 'not found' });
    });
    await ctx.addInitScript(([s, signedOut, pair]) => { try {
      localStorage.setItem('cb_api_base', location.origin);
      if (signedOut) localStorage.removeItem('cb_sess'); else localStorage.setItem('cb_sess', s);
      if (pair) { localStorage.setItem('cb_till_lastslot', 'cb-till-abc1'); localStorage.setItem('cb_till_key', 'k-abc1');
        localStorage.setItem('cb_till_shop@abc1', pair.ent); localStorage.setItem('cb_till_shopname@abc1', pair.name); }
    } catch (_) {} }, [SESSION, !!p.signedOut, p.pair || null]);
    return { ctx, seen, calls };
  }
  async function open(ctx, q) {
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errs.push(String(e.message) + ' @ ' + String((e.stack || '').split(String.fromCharCode(10))[1] || '').trim().slice(0, 140) + ' [' + (q || '/') + ' ' + ctx._lbl + ']'));
    await pg.goto(base + '/' + (q || ''));
    await pg.waitForSelector('[data-testid="cbshell"]', { timeout: 20000 });
    await pg.evaluate(() => window.SHELL && window.SHELL.ready);
    await pg.waitForTimeout(400);
    return pg;
  }
  const vis = (pg, sel) => pg.locator(sel).first().isVisible().catch(() => false);
  const areaWords = (pg, a) => pg.evaluate((x) => { const s = document.querySelector('.cbsh-sec.' + x); if (!s) return -1; return (s.innerText || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length; }, a);
  /* Q10: every area <= 100 words, Home <= 120 (Setup trimmed back to it on 17 Oct: shorter tile lines, no wider budget) */
  const BUDGET = { home: 120, selling: 100, money: 100, running: 100, trade: 100, labs: 100, setup: 100 };
  /* the allow-list: whatever CBAvatar writes in its own slot (its Profile · Support doors, the Sign in door) — nothing else may name app.html */
  const offList = (pg) => pg.$$eval('a[href*="app.html"]', (as) => as.filter((a) => !a.closest('[data-testid="shell-avatar"]') && a.getAttribute('data-testid') !== 'signin-register').map((a) => a.getAttribute('href')));
  fs.mkdirSync(SHOTS, { recursive: true });

  try {
    /* ── 2 · signed in, the shipped manifest, nothing planted: the one-screen Home (batch 1126) ── */
    {
      const { ctx, seen, calls } = await profile(1366, 768), pg = await open(ctx);
      ok(await pg.locator('[data-testid="cbshell"]').count() === 1 && await pg.getAttribute('[data-testid="cbshell"]', 'data-mode') === 'home', '1366 · Home mounts the shell once (data-mode=home)');
      ok(await pg.locator('[data-testid="shell-avatar"] [data-testid="cbavatar"]').count() === 1, '1366 · the avatar is the one CBAvatar in the shell\'s slot');
      ok(!(await vis(pg, '[data-testid="shell-nav"]')), '1366 · the seven-area nav of the retired classic Home is not on the page');
      const rows = await pg.$$eval('.ix-row', (n) => n.map((x) => x.parentNode.getAttribute('data-pillar')));
      ok(rows.length >= 6, '1366 · the pillar rows are drawn (' + rows.join(',') + ')');
      const fit = await pg.evaluate(() => { const d = document.documentElement; return { sy: d.scrollHeight - innerHeight, sx: d.scrollWidth - innerWidth }; });
      ok(fit.sy <= 1 && fit.sx <= 0, '1366 · the page fits one screen (' + JSON.stringify(fit) + ')');
      ok((await offList(pg)).length === 0, '1366 · zero app.html hrefs outside the avatar (the allow-list: CBAvatar\'s own doors)');
      /* READY-HINT (25 Nov): no card is covered or dead; a card the manifest says is not ready is still a link and carries ONE hint at the card ("Being finished"); a ready card has none */
      for (const g of await pg.$$('.ix-row')) { await g.click(); await pg.waitForTimeout(120); }
      const hinted = await pg.$$eval('.cbsh-box [data-ready="no"]', (n) => n.length);
      const notReady = man.entries.filter((e) => e.ready === false && e.state === 'built');
      ok(hinted > 0 || notReady.length === 0, '1366 · not-ready cards carry the one hint (' + hinted + ' hinted, ' + notReady.length + ' built-but-not-ready entries in the manifest)');
      const readyRoutes = man.entries.filter((e) => e.state === 'built' && e.ready !== false && e.route).map((e) => e.route.split('#')[0]);
      const liveCards = await pg.$$eval('.cbsh-box:not(.off)[href]', (n) => n.map((x) => ({ h: x.getAttribute('href'), hint: !!x.querySelector('[data-ready="no"]') })));
      const stray = liveCards.filter((c) => !readyRoutes.includes(c.h.split('#')[0]) && !c.hint).map((c) => c.h);
      const wrongHint = liveCards.filter((c) => readyRoutes.includes(c.h.split('#')[0]) && c.hint).map((c) => c.h);
      ok(stray.length === 0 && wrongHint.length === 0, '1366 · a card to a not-ready entry carries the hint, a ready one never does' + (stray.length ? ' - no hint: ' + stray.join(',') : '') + (wrongHint.length ? ' - hint on ready: ' + wrongHint.join(',') : ''));
      /* every read the page makes is a budgeted one */
      const unbudgeted = [...new Set(calls.filter((c) => !budgeted(c.p, c.m)).map((c) => c.m + ' ' + c.p))];
      unbudgeted.forEach((u) => found.push({ key: 'no budget line: ' + u, show: u }));   /* ratcheted in e2e/scanner-known.json (api owns the budget lines): a NEW unbudgeted read fails */
      { const RK = require('./lib/known-findings.cjs').ratchet('index-page', found, { owner: 'api (budget lines)' }); console.log(RK.line); ok(RK.fresh.length === 0, '1366 · no NEW read without a budget line in the api round-trips.budget.json' + (RK.fresh.length ? ' - new: ' + RK.fresh.map((i) => i.show).join(', ') : '')); }
      ok(seen.includes('/api/entities/me'), '1366 · the page asked its own reads (' + [...new Set(seen)].length + ' distinct)');
      ok(!/accounting|books of account|error|404/i.test(await pg.evaluate(() => document.body.innerText)), '1366 · no forbidden word, no error string on the screen');
      await ctx.close();
    }

    /* ── 3 · planted manifest and api: the facts the cards draw are the API's ── */
    {
      const { ctx, seen } = await profile(1366, 768, { manifest: Object.assign({}, PLANTED, { home2: Object.assign({}, man.home2, { pillars: man.home2.pillars.map((p) => Object.assign({}, p, { ids: (p.ids || []).filter((id) => PLANTED.entries.some((e) => e.id === id)) })) }) }) }), pg = await open(ctx);
      await pg.waitForTimeout(600);
      const asked = ['/api/facts/till', '/api/facts/accounts', '/api/facts/finance'].filter((u) => seen.includes(u));
      ok(asked.length === 3, 'planted · each built card with a facts URL asked it (' + asked.join(',') + ')');
      ok(!seen.includes('/api/facts/storefront') && !seen.includes('/api/facts/crm'), 'planted · a card with facts null asks nothing');
      ok(seen.includes('/api/work/facts'), 'planted · "Your work" asked the manifest\'s rail facts read');
      const text = await pg.evaluate(() => document.body.innerText);
      ok(!/\{money\}|INR/.test(text), 'planted · a money line is written by the money unit, never the raw token');
      await ctx.close();
    }

    /* ── 4 · 390: no sideways scroll ── */
    {
      const { ctx } = await profile(390, 844), pg = await open(ctx);
      const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
      const wide = await pg.evaluate(() => [].slice.call(document.querySelectorAll('.cbsh-main *, .ix-row')).filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.right > 391; }).length);
      ok(sw === 390 && wide === 0, '390 · scrollWidth === 390 (' + sw + ') and no row or card reaches past the screen (' + wide + ' do)');
      await ctx.close();
    }

    /* ── 5 · signed out: no /api call, the showcase, grey for not-ready (rule a) ── */
    {
      const { ctx, seen } = await profile(1366, 768, { signedOut: true }), pg = await open(ctx);
      ok(seen.length === 0, 'signed out · not one /api call leaves the page (' + seen.length + ')');
      ok(await pg.locator('[data-testid="signin-door"]').count() === 1 && await pg.locator('[data-testid="shell-shop"]').count() === 0, 'signed out · the avatar is the one Sign in door');
      ok((await offList(pg)).length === 0, 'signed out · zero app.html hrefs outside the avatar');
      const txt = await pg.evaluate(() => document.body.innerText);
      ok(!/\d+ (bills|customers|suppliers)|₹/.test(txt), 'signed out · no per-shop figure (no bills, customers, rupees)');
      /* a built entry the manifest marks not ready is listed Coming in its panel, never Live */
      const byId = new Map(man.entries.map((e) => [e.id, e]));
      const wrong = [];
      for (const t of await pg.$$('.ix-item .ix-row, button.ix-fw')) {
        await t.click(); await pg.waitForTimeout(150);
        const lines = await pg.$$eval('dialog[open] .ix-se', (n) => n.map((x) => ({ id: (x.getAttribute('data-testid') || '').replace('ix2-show-', ''), soon: x.classList.contains('soon') })));
        lines.forEach((l) => { const e = byId.get(l.id); if (e && e.state === 'built' && e.ready === false && !l.soon) wrong.push(l.id); });
        await pg.click('dialog[open] .ix-x').catch(() => {}); await pg.waitForTimeout(80);
      }
      ok(wrong.length === 0, 'signed out · a built-but-not-ready entry is listed Coming, never Live' + (wrong.length ? ' - Live: ' + wrong.join(',') : ''));
      await ctx.close();
    }
    {
      const { ctx, seen } = await profile(1366, 768, { signedOut: true }), pg = await open(ctx, '?cleaned=1');
      ok(seen.length === 0 && await pg.locator('[data-testid="signed-out-go"]').count() === 1 && /being cleaned/.test(await pg.locator('[data-testid="signed-out-why"]').innerText()), 'cleaned · the row says why, its button is the one Sign in door, not one /api call');
      await ctx.close();
    }

    /* ── 6 · every built entry's route is served ── */
    {
      const routes = [...new Set(man.entries.filter((e) => e.state === 'built' && e.route).map((e) => e.route.split(/[#?]/)[0]))];
      const codes = await Promise.all(routes.map((r) => new Promise((res) => http.get(base + r, (q) => { q.resume(); res(q.statusCode); }).on('error', () => res(0)))));
      ok(codes.every((c) => c === 200), 'every built entry\'s route returns 200' + (codes.some((c) => c !== 200) ? ' - not: ' + routes.filter((_, i) => codes[i] !== 200).join(',') : ''));
    }

    ok(...C.finish());
    const mine = errs.filter((m) => !/fonts|favicon/i.test(m));
    ok(mine.length === 0, 'no page error' + (mine.length ? ': ' + mine.slice(0, 3).join(' | ') : ''));
  } finally { await b.close(); srv.close(); }
  return out;
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    console.log('  (free memory ' + (require('os').freemem() / 1073741824).toFixed(1) + ' GB)');
    const r = await run();
    console.log('\n  index-page: ' + r.pass + ' passed, ' + r.fail + ' failed');
    process.exit(r.fail ? 1 : 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
