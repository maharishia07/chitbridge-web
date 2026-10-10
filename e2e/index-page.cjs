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
 *   3  1366 · every read the page makes is a budgeted one (the API's round-trips.budget.json has a line for it); a facts URL that is null
 *      paints nothing; nothing wrong → the alerts slot draws nothing; N19 404 → the sheet's empty state (kept)
 *   4  1366 · PLANTED manifest (facts URLs + the rail) and a planted API: each card's lines are the API's; the rail's digits are the API's;
 *      "2 waiting for the ledger" carries its fix; a counter paired to another shop earns an amber row with its fix
 *   5  word budget per VISIBLE area (Q10): Home ≤ 120 (with the rail and the alerts up), every other area ≤ 100 — at 1366 and at 390
 *   6  390: scrollWidth === 390; bottom tabs, one area at a time; the kural at the foot of Home
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
const BUDGETED = ['/api/entities/header', '/api/books/health',
  '/api/entities/me',
  /* R06: the bell in the shell's slot (CBBell) — the Activity badge (budgeted: GET /api/notifications) and the push ticket + stream, which
     replace polling; ⚠️ POST /api/events/ticket and GET /api/events/stream have NO budget line yet (named in the R06 PR) */
  '/api/notifications', '/api/events/ticket', '/api/events/stream'];   /* ⚠️ not this page's: CBAvatar hydrates its prefs from it on every page it mounts (public/app/avatar.js) — it has NO budget line yet (named in the N18 PR) */

/* a planted manifest: facts URLs on two cards, the rail with its read and its door */
const PLANTED = { version: 2,
  rail: { route: '/network.html', facts: '/api/facts/rail' },
  entries: [
    { id: 'till', name: 'Till', route: '/till.html', icon: '▤', area: 'selling', state: 'built', what: 'Take money at the counter.', facts: '/api/facts/till' },
    { id: 'storefront', name: 'Storefront', route: '/shop.html', icon: '◇', area: 'selling', state: 'built', what: 'Your shop on the web.', facts: null },
    { id: 'catalogue', name: 'Catalogue', route: null, icon: '▦', area: 'selling', state: 'workshop' },
    { id: 'orders', name: 'Orders', route: null, icon: '↓', area: 'selling', state: 'coming' },
    { id: 'accounts', name: 'CB Accounts', route: '/accounts.html', icon: '₹', area: 'running', state: 'built', what: 'What the shop made, and what it owes.', facts: '/api/facts/accounts' },
    { id: 'crm', name: 'CB CRM', route: '/crm.html', icon: '◍', area: 'running', state: 'built', what: 'Who buys, and how often.', facts: null },
    { id: 'product-lab', name: 'Product Lab', route: '/product-lab.html', icon: '◈', area: 'labs', state: 'built', what: 'Cost, price, and what each one leaves you.', facts: null },
    { id: 'tax-lab', name: 'Tax Lab', route: null, icon: '§', area: 'labs', state: 'coming' },
    { id: 'standards', name: 'Standards', route: '/standards.html', icon: '≡', area: 'setup', state: 'built', what: 'What a chit must contain.', facts: null },
    { id: 'shop', name: 'Your shop', route: null, icon: '⌂', area: 'setup', state: 'workshop' }
  ] };
const FACTS = {
  '/api/facts/till': { lines: [{ text: '12 bills · {money}', money: { amount: 4280, currency: 'INR' } }, { text: '1 bill waiting to send', tone: 'dn', act: { label: 'Send now', href: '/till.html' } }] },
  '/api/facts/accounts': { lines: ['Ledger up to 7 Oct'] },
  '/api/facts/rail': { suppliers: 4, customers: 128, in: 3, out: 2, stuck: 1 }
};

async function run() {
  const { chromium } = require('@playwright/test');
  const out = { pass: 0, fail: 0 };
  const ok = (c, m) => { if (c) out.pass++; else out.fail++; console.log((c ? '  ok  ' : '  XX  ') + m); };

  /* ── 1 · static ── */
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  /* the sign-in window's Register link is the workshop's page until a customer register page exists (BACKLOG: REGISTER PAGE) - the ONE allowed mention */
  ok(!/app\.html/.test(src.replace(/registerHref:\s*'\/app\.html#\/register'/, '')), 'static · zero "app.html" in index.html (I12) bar the Register link');
  ok(!/\btier\b/i.test(src), 'static · no word "tier" (Q5)');
  ok(!/accounting|books of account/i.test(src), 'static · neither "accounting" nor "books of account" (it is the Ledger)');
  ok(!/class="(box|lab|cbsh-box|cbsh-sc)[" ]/.test(src) && !/data-testid="(box|lab)-/.test(src), 'static · no hand-written card: every card is a manifest row');
  ok(/\/app\/shell\.js/.test(src) && /CBShell\.mount\(/.test(src) && /host:\s*null/.test(src), 'static · index.html mounts CBShell as Home (host null)');
  ok(!/\balert\s*\(/.test(src), 'static · no alert()');
  const man = JSON.parse(fs.readFileSync(path.join(PUB, 'app', 'manifest.json'), 'utf8'));
  const exists = (r) => { const p = r.split(/[#?]/)[0]; return p === '/' ? false : fs.existsSync(path.join(PUB, p)); };
  const badBuilt = man.entries.filter((e) => e.state === 'built' && !(e.route && exists(e.route) && !/app\.html/.test(e.route))).map((e) => e.id);
  const badRest = man.entries.filter((e) => e.state !== 'built' && e.route).map((e) => e.id);
  ok(badBuilt.length === 0, 'manifest · every built entry routes to a utility page that exists, never app.html, never the index itself' + (badBuilt.length ? ' — not: ' + badBuilt.join(', ') : ''));
  ok(badRest.length === 0, 'manifest · coming / workshop entries have no route (dashed chips)' + (badRest.length ? ' — routed: ' + badRest.join(', ') : ''));
  ok(man.rail && 'route' in man.rail && 'facts' in man.rail && !/app\.html/.test(JSON.stringify(man)), 'manifest · the rail widget is declared (route · facts), and nothing names app.html');
  const eff = (e) => (e.works && e.state === 'workshop' ? 'built' : e.state);   /* the roadmap's reading of a row (manifest `works`) */
  const BUILT = man.entries.filter((e) => e.state === 'built'), REST = man.entries.filter((e) => e.state !== 'built');
  for (const w of ['Catalogue', 'CB Accounts', 'Till', 'Standards', 'Suppliers', 'Co-assist', 'Connectors', 'Your shop', 'Counters & keys', 'CB CRM', 'Product Lab', 'Offer Lab', 'Combo Lab']) {
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
    const seen = [];
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    if (p.manifest) await ctx.route('**/app/manifest.json', (r) => J(r, 200, p.manifest));
    await ctx.route('**/api/**', (r) => {
      const u = new URL(r.request().url()); seen.push(u.pathname);
      if (u.pathname === '/api/entities/header') return J(r, 404, { error: 'not found' });            /* N19 built, not live: the empty state stays */
      if (u.pathname === '/api/books/health') {
        if (p.booksOff) return J(r, 404, { error: 'Not found' });
        return J(r, 200, books.health({ waiting: (p.waiting || []).map((w) => books.waitingRow(w)) }));
      }
      if (FACTS[u.pathname]) return J(r, 200, FACTS[u.pathname]);
      return J(r, 404, { error: 'not found' });
    });
    await ctx.addInitScript(([s, signedOut, pair]) => { try {
      localStorage.setItem('cb_api_base', location.origin);
      if (signedOut) localStorage.removeItem('cb_sess'); else localStorage.setItem('cb_sess', s);
      if (pair) { localStorage.setItem('cb_till_lastslot', 'cb-till-abc1'); localStorage.setItem('cb_till_key', 'k-abc1');
        localStorage.setItem('cb_till_shop@abc1', pair.ent); localStorage.setItem('cb_till_shopname@abc1', pair.name); }
    } catch (_) {} }, [SESSION, !!p.signedOut, p.pair || null]);
    return { ctx, seen };
  }
  async function open(ctx, q) {
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errs.push(String(e.message)));
    await pg.goto(base + '/' + (q || ''));
    await pg.waitForSelector('[data-testid="cbshell"]', { timeout: 20000 });
    await pg.evaluate(() => window.SHELL && window.SHELL.ready);
    await pg.waitForTimeout(400);
    return pg;
  }
  const vis = (pg, sel) => pg.locator(sel).first().isVisible().catch(() => false);
  const areaWords = (pg, a) => pg.evaluate((x) => { const s = document.querySelector('.cbsh-sec.' + x); if (!s) return -1; return (s.innerText || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length; }, a);
  const BUDGET = { home: 120, selling: 100, running: 100, labs: 100, setup: 100 };
  /* the allow-list: whatever CBAvatar writes in its own slot (its Profile · Support doors, the Sign in door) — nothing else may name app.html */
  const offList = (pg) => pg.$$eval('a[href*="app.html"]', (as) => as.filter((a) => !a.closest('[data-testid="shell-avatar"]') && a.getAttribute('data-testid') !== 'signin-register').map((a) => a.getAttribute('href')));
  fs.mkdirSync(SHOTS, { recursive: true });

  try {
    /* ── 2 + 3 · 1366, signed in, the shipped manifest, nothing wrong ── */
    {
      const { ctx, seen } = await profile(1366, 800), pg = await open(ctx);
      ok(await pg.locator('[data-testid="cbshell"]').count() === 1 && await pg.getAttribute('[data-testid="cbshell"]', 'data-mode') === 'home', '1366 · Home mounts the shell once, as Home');
      ok(await pg.locator('[data-testid="shell-nav"]').count() === 1 && await pg.locator('[data-testid="shell-avatar"] [data-testid="cbavatar"]').count() === 1, '1366 · the rail of five areas and the one avatar are the shell\'s');
      ok(await pg.locator('.cbsh-box').count() === BUILT.length && await pg.locator('.cbsh-sc').count() === REST.length, '1366 · ' + BUILT.length + ' cards and ' + REST.length + ' dashed chips — one per manifest row');
      let hrefsOk = true;
      for (const e of BUILT) { const h = await pg.getAttribute('[data-testid="shell-card-' + e.id + '"]', 'href'); if (h !== e.route.replace('{bridge_id}', 'CBTEST1234')) { hrefsOk = false; console.log('      ' + e.id + ' → ' + h); } }
      ok(hrefsOk, '1366 · every built card links to its utility page');
      ok((await offList(pg)).length === 0, '1366 · zero app.html hrefs outside the avatar (the allow-list: CBAvatar\'s own doors)');
      const chips = await pg.$$eval('.cbsh-sc', (cs) => cs.map((c) => ({ id: c.dataset.testid, st: c.dataset.state, link: c.tagName === 'A' || !!c.querySelector('a'), via: c.dataset.via === '1', href: c.getAttribute('href'), tag: (c.querySelector('.tag') || {}).textContent })));
      ok(chips.length && chips.every((c) => (c.via ? /^\/[a-z-]+\.html$/.test(c.href || '') : !c.link) && (c.st === 'workshop' || c.st === 'coming' || c.st === 'works') && c.tag), '1366 · every chip is dashed, names its state, and is not a link (bar a workshop item that names its closest built page: Catalogue to Product Lab)');
      const before = pg.url(), pages = ctx.pages().length;
      await pg.click('[data-testid="shell-chip-stock"]'); await pg.waitForTimeout(250);
      ok(pg.url() === before && ctx.pages().length === pages, '1366 · a workshop chip opens nothing');
      /* reads: only budgeted ones; null facts paint nothing */
      const unbudgeted = seen.filter((p) => !BUDGETED.includes(p));
      ok(unbudgeted.length === 0, '1366 · every read has its budget line (' + [...new Set(seen)].join(' · ') + ')' + (unbudgeted.length ? ' — not: ' + unbudgeted.join(', ') : ''));
      ok(seen.includes('/api/books/health'), '1366 · the ledger\'s waiting posts were asked (GET /api/books/health)');
      const factsText = await pg.$$eval('.cbsh-box .facts', (fs_) => fs_.map((f) => f.textContent.trim()).join(''));
      ok(factsText === '', '1366 · a card whose facts read does not exist yet shows no figure');
      const al = await pg.evaluate(() => { const a = document.querySelector('[data-slot="alerts"]'); return { kids: a.childElementCount, h: a.offsetHeight }; });
      ok(al.kids === 0 && al.h === 0, '1366 · nothing wrong → the alerts slot draws nothing (' + al.h + 'px)');
      ok(await pg.locator('[data-testid="rail"]').count() === 0, '1366 · the rail has no read yet → it is not drawn (never an invented number)');
      await pg.click('[data-testid="shell-shop"]');
      const st = await pg.locator('[data-testid="shell-sheet"]').innerText();
      ok(await vis(pg, '[data-testid="shell-sheet-empty"]') && /not available yet/i.test(st) && !/\d/.test(st), '1366 · N19 404 → the sheet\'s empty state, no number (kept)');
      await pg.keyboard.press('Escape');
      ok(await pg.evaluate(() => !!document.querySelector('.cbsh-foot #cbkural')), '1366 · the kural is the footer band');
      for (const a of Object.keys(BUDGET)) { const n = await areaWords(pg, a); ok(n >= 0 && n <= BUDGET[a], '1366 · words in ' + a + ': ' + n + ' ≤ ' + BUDGET[a]); }
      ok(!/accounting|books of account|error|404/i.test(await pg.evaluate(() => document.body.innerText)), '1366 · no forbidden word, no error string on the screen');
      await pg.screenshot({ path: path.join(SHOTS, 'index-laptop.png') });
      await ctx.close();
    }

    /* ── 4 · 1366, a planted manifest and a planted API: facts, the rail, the alerts ── */
    {
      const { ctx } = await profile(1366, 800, { manifest: PLANTED, waiting: [{ id: 1, reason: 'Paid by Points — there is no ledger for Points yet.' }, { id: 2, reason: 'September is locked.' }], pair: { ent: 'ent-C', name: 'Mayuri123' } });
      const pg = await open(ctx);
      await pg.waitForSelector('[data-testid="rail"]', { timeout: 8000 }).catch(() => {});
      const f = (await pg.locator('[data-testid="shell-facts-till"]').innerText()).replace(/\s+/g, ' ');
      ok(/12 bills · ₹4,280/.test(f) && /1 bill waiting to send Send now ›/.test(f) && !/INR|{money}/.test(f), 'planted · the Till card\'s lines are the API\'s ("' + f + '")');
      ok(/Ledger up to 7 Oct/.test(await pg.locator('[data-testid="shell-facts-accounts"]').innerText()), 'planted · the CB Accounts card\'s line is the API\'s');
      ok((await pg.locator('[data-testid="shell-facts-crm"]').innerText()).trim() === '', 'planted · a card with facts null shows nothing');
      const rail = await pg.evaluate(() => { const t = (s) => (document.querySelector('[data-testid="' + s + '"]') || {}).textContent; return { s: t('rail-suppliers'), c: t('rail-customers'), i: t('rail-in'), o: t('rail-out'), k: t('rail-stuck'), open: (document.querySelector('[data-testid="rail-open"]') || {}).getAttribute && document.querySelector('[data-testid="rail-open"]').getAttribute('href') }; });
      ok(rail.s === '4' && rail.c === '128' && rail.i === '3 in' && rail.o === '2 out' && rail.k === '1 stuck', 'planted · the rail\'s digits are the API\'s (' + JSON.stringify(rail) + ')');
      ok(rail.open === '/network.html', 'planted · the rail\'s Open goes where the manifest says');
      const rows = await pg.$$eval('[data-slot="alerts"] .al', (els) => els.map((e) => ({ id: e.dataset.testid, lvl: e.className.replace('al ', ''), text: e.textContent.replace(/\s+/g, ' ').trim(), fix: (e.querySelector('.fix') || {}).getAttribute && e.querySelector('.fix').getAttribute('href') })));
      const led = rows.find((r) => r.id === 'ledger-waiting'), pr = rows.find((r) => r.id === 'till-paired');
      ok(led && /2 waiting for the ledger/.test(led.text) && led.fix === '/accounts.html#waiting', 'planted · "2 waiting for the ledger" — the alert\'s number is the API\'s, its fix opens CB Accounts (' + (led && led.text) + ')');
      ok(pr && pr.lvl === 'warn' && /Counter 1 · paired to Mayuri123, not this shop/.test(pr.text) && pr.fix === '/till.html', 'planted · a counter paired to another shop earns an amber row with its fix (' + (pr && pr.text) + ')');
      ok(rows.every((r) => r.fix), 'planted · every alert carries the button that fixes it');
      for (const a of Object.keys(BUDGET)) { const n = await areaWords(pg, a); ok(n >= 0 && n <= BUDGET[a], 'planted 1366 · words in ' + a + ': ' + n + ' ≤ ' + BUDGET[a]); }
      await pg.screenshot({ path: path.join(SHOTS, 'index-alerts.png') });
      await ctx.close();
    }

    /* ── 5 + 6 · 390, the same planted day: bottom tabs, one area at a time, the rail and the alerts on Home, no sideways scroll ── */
    {
      const { ctx } = await profile(390, 844, { manifest: PLANTED, waiting: [{ id: 1, reason: 'September is locked.' }] }), pg = await open(ctx);
      await pg.waitForSelector('[data-testid="rail"]', { timeout: 8000 }).catch(() => {});
      const sw = () => pg.evaluate(() => document.scrollingElement.scrollWidth);
      ok(await sw() === 390, '390 · scrollWidth === 390 (' + await sw() + ')');
      const nav = await pg.evaluate(() => { const r = document.querySelector('.cbsh-nav').getBoundingClientRect(); return { bottom: Math.round(r.bottom), w: Math.round(r.width) }; });
      ok(nav.bottom === 844 && nav.w === 390, '390 · the five areas are a bottom tab bar');
      ok(await pg.evaluate(() => [...document.querySelectorAll('.cbsh-sec')].filter((s) => s.offsetParent).map((s) => s.dataset.area).join()) === 'home', '390 · one area at a time: Home first');
      ok(await vis(pg, '[data-testid="rail"]') && await vis(pg, '[data-testid="ledger-waiting"]'), '390 · Home shows the rail and the alert');
      const railR = await pg.evaluate(() => { const r = document.querySelector('[data-testid="rail"]').getBoundingClientRect(); return { l: r.left, r: Math.round(r.right) }; });
      ok(railR.l >= 0 && railR.r <= 390, '390 · the rail sits inside the screen (' + railR.l + ' → ' + railR.r + ')');
      ok(await pg.evaluate(() => !!document.querySelector('[data-testid="shell-pfoot"] #cbkural')), '390 · the kural sits in the footer above the tab bar (never a card in Home)');
      await pg.screenshot({ path: path.join(SHOTS, 'index-phone.png') });
      for (const a of Object.keys(BUDGET)) {
        await pg.click('[data-testid="shell-nav-' + a + '"]'); await pg.waitForTimeout(120);
        const shown = await pg.evaluate(() => [...document.querySelectorAll('.cbsh-sec')].filter((s) => s.offsetParent).map((s) => s.dataset.area).join());
        const n = await areaWords(pg, a);
        ok(shown === a && n <= BUDGET[a] && await sw() === 390, '390 · tab ' + a + ' shows only ' + a + ', ' + n + ' words ≤ ' + BUDGET[a] + ', no sideways scroll');
        if (a === 'selling') await pg.screenshot({ path: path.join(SHOTS, 'index-phone-selling.png') });
      }
      ok((await offList(pg)).length === 0, '390 · zero app.html hrefs outside the avatar');
      await ctx.close();
    }

    /* ── the ledger off: a 404 is nothing wrong ── */
    {
      const { ctx, seen } = await profile(1366, 800, { booksOff: true }), pg = await open(ctx);
      await pg.waitForTimeout(300);
      ok(seen.includes('/api/books/health') && await pg.locator('[data-slot="alerts"] .al').count() === 0 && !/404/.test(await pg.evaluate(() => document.body.innerText)), 'ledger off · the 404 earns no row and never reaches the screen');
      await ctx.close();
    }

    /* ── 7 · signed out ── */
    {
      const { ctx, seen } = await profile(1366, 800, { signedOut: true }), pg = await open(ctx);
      ok(seen.length === 0, 'signed out · not one /api call leaves the page (' + seen.length + ')');
      ok(await pg.locator('.cbsh-box').count() === BUILT.length && await pg.$$eval('.cbsh-box .facts', (fs_) => fs_.every((f) => f.textContent.trim() === '')), 'signed out · the cards are still drawn, with no facts');
      ok(await pg.locator('[data-testid="signin-door"]').count() === 1 && await pg.locator('[data-testid="shell-shop"]').count() === 0, 'signed out · the avatar is the one Sign in door; no shop button');
      ok(await pg.locator('[data-slot="alerts"] .al').count() === 0, 'signed out · no alerts');
      ok((await offList(pg)).length === 0, 'signed out · zero app.html hrefs outside the avatar');
      await ctx.close();
    }
    {
      const { ctx, seen } = await profile(1366, 800), pg = await open(ctx, '?left=Other%20Shop');
      const row = pg.locator('[data-testid="signed-out-why"]');
      ok(await row.count() === 1 && /Signed out — Other Shop opened in another tab\./.test(await row.innerText()), 'left · the row says why (' + (await row.innerText().catch(() => '')).replace(/\s+/g, ' ').trim() + ')');
      ok(await pg.locator('[data-testid="signed-out-go"]').count() === 1 && await pg.locator('[data-testid="signin-door"]').count() === 1 && seen.length === 0, 'left · its button is the avatar\'s door, and nothing was read');
      ok((await offList(pg)).length === 0, 'left · still zero app.html hrefs outside the avatar');
      await ctx.close();
    }

    /* ── 8 · THE ROADMAP: drawn from the manifest, for a stranger with NO session, and no per-shop figure in it ── */
    {
      const rmSrc = fs.readFileSync(path.join(PUB, 'app', 'roadmap.js'), 'utf8');
      ok(!/app\.html/.test(rmSrc) && !/fetch\(|XMLHttpRequest|localStorage|cb_sess/.test(rmSrc), 'roadmap · static · the unit names no app.html and reads no session, no storage, no /api');
      ok(man.entries.every((e) => !rmSrc.includes("'" + e.id + "'") || ['till', 'accounts', 'crm', 'trade', 'connectors'].includes(e.id)), 'roadmap · static · no entry is hand-written in the unit (only the places of the diagram name a row)');
      ok(man.entries.every((e) => !e.rows || Array.isArray(e.rows)) && man.entries.every((e) => !e.phase || typeof e.phase === 'string') && man.entries.every((e) => !e.fits || (typeof e.fits === 'string' && e.fits.split(' ').length <= 16)), 'roadmap · manifest · rows is a list, phase and fits are short strings');
      ok(/rows = /.test(man._) && /phase = /.test(man._) && /fits = /.test(man._), 'roadmap · manifest · the new keys (rows · phase · fits) are in the manifest\'s own dictionary');
      const { ctx, seen } = await profile(1366, 800, { signedOut: true }), pg = await open(ctx);
      ok(seen.length === 0, 'roadmap · signed out · not one /api call (' + seen.length + ')');
      ok(await pg.locator('[data-testid="roadmap"]').count() === 1 && await vis(pg, '[data-testid="rm-going"] summary'), 'roadmap · signed out · it is on the page');
      await pg.click('[data-testid="rm-going"] summary'); await pg.click('[data-testid="rm-fits"] summary'); await pg.click('[data-testid="rm-rail"] summary');
      const items = await pg.$$eval('[data-testid^="rm-item-"]', (ls) => ls.map((l) => ({ id: l.dataset.testid.slice(8), st: l.dataset.state, chip: (l.querySelector('.rm-chip') || {}).textContent })));
      ok(items.length === man.entries.length && man.entries.every((e) => items.some((i) => i.id === e.id && i.st === (e.works && e.state === 'workshop' ? 'built' : e.state))), 'roadmap · every item is a manifest row, with its state (' + items.length + ' of ' + man.entries.length + ')');
      ok(items.every((i) => /(built|coming|workshop)$/.test(String(i.chip).trim()) && /^[✓◌⚒]/.test(String(i.chip).trim())), 'roadmap · every chip is a symbol and a word');
      /* H12/H13/H14/H15/H17/H18/H19 — what a reader sees, and what the data says */
      const rmText = await pg.evaluate(() => document.querySelector('[data-testid="roadmap"]').innerText);
      ok(!/\b[MRNP][0-9]{1,3}\b/.test(rmText), 'roadmap · H12 · no plan id (M62, R06, N05, P5) is printed for a reader');
      const plan = await pg.$$eval('[data-testid^="rm-item-"][data-plan]', (ls) => ls.map((l) => l.dataset.testid.slice(8) + '=' + l.dataset.plan));
      ok(plan.length > 0 && plan.every((p) => /[MRN][0-9]+|P[0-9]/.test(p)), 'roadmap · H12 · the plan ids stay in the data (data-plan + tooltip) for a tester (' + plan.length + ')');
      const byE = {}; man.entries.forEach((e) => { byE[e.id] = e; });
      ok(!(byE.catalogue.rows || []).includes('M41') && !(byE.storefront.rows || []).includes('R06') && !(byE.standards.rows || []).includes('N05') && (byE.standards.rows || []).includes('M41'), 'roadmap · H13 · Catalogue is not M41 (Standards), Storefront is not R06 (the bell), Standards is M41 not N05');
      ok(byE.connectors.works === true && (await pg.locator('[data-testid="rm-item-connectors"]').getAttribute('data-state')) === 'built', 'roadmap · H14 · Connectors (Tally + Zoho work) is not drawn as workshop');
      ok(byE.governance.state === 'coming' && /Constitution v2/.test(byE.governance.fits) && /coming/.test(byE.governance.fits), 'roadmap · H15 · Governance says the rules are written and the page is coming (agrees with Constitution v2 Current)');
      ok(await pg.locator('[data-testid="rm-fit-other"]').count() === 1 && /same chit/.test(await pg.locator('[data-testid="rm-fit-other"]').innerText()), 'roadmap · H17 · the diagram shows the OTHER business holding the same chit');
      const attrs = await pg.$$eval('li[data-testid^="rm-attr-"]', (ls) => ls.map((l) => ({ t: l.querySelector('.rm-n').textContent, m: (l.querySelector('.rm-chip') || {}).textContent, f: (l.querySelector('.rm-f') || {}).textContent })));
      const tbl = await pg.$$eval('[data-testid="rm-compare"] tbody tr', (rs) => rs.map((r) => ({ t: r.children[0].textContent, m: r.children[1].textContent.trim() })));
      ok(attrs.length === 4 && attrs.every((a) => a.f && a.f.length > 20), 'roadmap · H19 · each attribute has one plain sentence (' + attrs.length + ')');
      ok(attrs.filter((a) => a.m).every((a) => { const row = tbl[[0, 1, 3][attrs.filter((x) => x.m).indexOf(a)]]; return row && row.m.replace(/\s+/g, ' ') === a.m.replace(/\s+/g, ' '); }), 'roadmap · H18 · a headline carries the SAME mark as its row in the table');
      const groupsOk = await pg.$$eval('[data-testid^="rm-area-"]', (hs) => hs.map((h) => h.dataset.testid.slice(8)));
      ok(['selling', 'running', 'labs', 'setup'].every((a) => groupsOk.includes(a)), 'roadmap · grouped by area (' + groupsOk.join(', ') + ')');
      const sum = await pg.locator('[data-testid="rm-going"] summary').innerText();
      ok(sum.includes(man.entries.filter((e) => eff(e) === 'built').length + ' built') && sum.includes(man.entries.filter((e) => eff(e) === 'coming').length + ' coming') && sum.includes(man.entries.filter((e) => eff(e) === 'workshop').length + ' in the workshop'), 'roadmap · the counts are the manifest\'s (' + sum.replace(/\s+/g, ' ') + ')');
      let routesOk = true;
      for (const e of BUILT) { const r = await ctx.request.get(base + e.route); if (r.status() !== 200) { routesOk = false; console.log('      ' + e.route + ' → ' + r.status()); } }
      ok(routesOk, 'roadmap · every built item\'s route returns 200');
      const pg2 = await ctx.newPage(); const first = BUILT[0];
      const resp = await pg2.goto(base + first.route, { waitUntil: 'domcontentloaded' }).catch(() => null);
      ok(resp && resp.status() === 200, 'roadmap · the first built route opens (' + first.route + ')');
      await pg2.close();
      ok(await pg.locator('[data-testid="roadmap"] a[href]').count() === 0, 'roadmap · it holds no link a not-built item could be opened by');
      const fitN = await pg.$$eval('[data-testid^="rm-fit-"]', (ns) => ns.map((n) => ({ id: n.dataset.testid.slice(7), st: n.dataset.state })));
      const byId = Object.fromEntries(man.entries.map((e) => [e.id, eff(e)]));
      ok(fitN.some((n) => n.id === 'rail') && ['till', 'accounts', 'crm', 'trade', 'connectors', 'labs'].every((id) => fitN.some((n) => n.id === id)), 'roadmap · the fit diagram: the rail and its six places');
      ok(['till', 'accounts', 'crm', 'trade', 'connectors'].every((id) => fitN.find((n) => n.id === id).st === byId[id]), 'roadmap · each place is coloured by its manifest state');
      const labsSt = man.entries.filter((e) => e.area === 'labs'), nb = labsSt.filter((e) => eff(e) === 'built').length;
      ok(fitN.find((n) => n.id === 'labs').st === (nb === labsSt.length ? 'built' : nb ? 'partly' : labsSt[0].state), 'roadmap · the Labs place follows its rows (' + nb + ' of ' + labsSt.length + ' built)');
      const cells = await pg.$$eval('[data-testid="rm-compare"] td:not(:first-child)', (cs) => cs.map((c) => c.textContent.trim()));
      ok(cells.length > 0 && cells.every((c) => /^(✓ yes|◐ partly|◌ planned|– no)$/.test(c)), 'roadmap · the comparison marks are symbol + word (' + cells.length + ' cells)');
      const tradeRow = await pg.$$eval('[data-testid="rm-compare"] tr', (rs) => rs.filter((r) => /across borders/.test(r.textContent)).map((r) => r.children[1].textContent.trim()));
      ok(byId.trade === 'built' || tradeRow[0] === '◌ planned', 'roadmap · "trade across borders" is planned while CB Trade is not built');
      const txt = await pg.evaluate(() => document.querySelector('[data-testid="roadmap"]').innerText);
      ok(!/\b(tier|accounting|books of account|error|404)\b/i.test(txt), 'roadmap · no forbidden word');
      ok(!/\d+ (bills|customers|suppliers)|₹/.test(txt), 'roadmap · no per-shop figure (no bills, customers, rupees)');
      ok((await offList(pg)).length === 0, 'roadmap · signed out · zero app.html hrefs outside the avatar');
      await pg.screenshot({ path: path.join(SHOTS, 'index-roadmap.png'), fullPage: true });
      await ctx.close();
    }
    {
      const { ctx } = await profile(390, 844, { signedOut: true }), pg = await open(ctx);
      for (const k of ['going', 'fits', 'rail']) await pg.click('[data-testid="rm-' + k + '"] summary');
      const sw = await pg.evaluate(() => document.scrollingElement.scrollWidth);
      ok(sw === 390, 'roadmap · 390 · all folds open, scrollWidth === 390 (' + sw + ')');
      const inside = await pg.evaluate(() => { const r = document.querySelector('[data-testid="rm-fit"]').getBoundingClientRect(); return r.left >= 0 && Math.round(r.right) <= 390; });
      ok(inside, 'roadmap · 390 · the diagram sits inside the screen');
      ok((await offList(pg)).length === 0, 'roadmap · 390 · zero app.html hrefs outside the avatar');
      await pg.screenshot({ path: path.join(SHOTS, 'index-roadmap-phone.png'), fullPage: true });
      await ctx.close();
    }
    {
      const { ctx } = await profile(1366, 800, { manifest: PLANTED }), pg = await open(ctx);
      await pg.waitForSelector('[data-testid="rail"]', { timeout: 8000 }).catch(() => {});
      ok(await pg.locator('[data-testid="roadmap"]').count() === 1 && await pg.locator('[data-testid="rail"]').count() === 1, 'roadmap · signed in · the rail widget and the roadmap sit together');
      ok(await pg.locator('[data-testid^="rm-item-"]').count() === PLANTED.entries.length, 'roadmap · a planted manifest is drawn row for row (' + PLANTED.entries.length + ')');
      /* H16 — signed in the page is the working app: ONE quiet fold, not three folds above the cards */
      ok(await pg.locator('[data-testid="rm-quiet-fold"]').count() === 1 && await vis(pg, '[data-testid="rm-quiet-fold"] > summary') && !(await vis(pg, '[data-testid="rm-going"] summary')), 'roadmap · H16 · signed in: one quiet "Where we are going ›", the three folds are inside it');
      await pg.click('[data-testid="rm-quiet-fold"] > summary');
      ok(await vis(pg, '[data-testid="rm-going"] summary'), 'roadmap · H16 · the quiet fold opens to the same roadmap');
      /* H1/H10/H11 — every rail number is a door to what it counts */
      const hrefs = await pg.evaluate(() => { const h = (s) => ((document.querySelector('[data-testid="' + s + '"]') || {}).getAttribute || function () { return null; }).call(document.querySelector('[data-testid="' + s + '"]'), 'href'); return { i: h('rail-in'), o: h('rail-out'), k: h('rail-stuck'), s: h('rail-suppliers-open'), c: h('rail-customers-open') }; });
      ok(hrefs.i === '/network.html#/chits?tab=in' && hrefs.o === '/network.html#/chits?tab=out' && hrefs.k === '/network.html#/chits?tab=stuck', 'rail · H10 · 3 in / 2 out / 1 stuck open that tab of the chits view (' + JSON.stringify(hrefs) + ')');
      ok(hrefs.s === '/network.html#/parties?role=supplier' && hrefs.c === '/network.html#/parties?role=customer', 'rail · H11 · Suppliers / Customers open the parties list filtered to that role');
      await ctx.close();
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
