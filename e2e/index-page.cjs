/* index-page.cjs — THE INDEX PAGE AT /, PROVED (docs/design/index-page/cb-index.md · docs/design/SYSTEM.md §4).
 * Pattern: books-web.cjs — Playwright, a stand-in API on this machine answering INSIDE the page; the static
 * server takes a free port from the OS. Nothing here ever reaches localhost:3000, port 7351, or the live site:
 * every /api/** call is fulfilled by ctx.route before it can leave the browser.
 *
 * The six checks from the design, plus the pass mark:
 *  1  three boxes under Day to day; four labs, in a tinted band
 *  2  with no alerts the alert block renders nothing at all — no container, no border
 *  3  the Catalogue's "no cost" and the Product Lab's "without a cost" come from ONE function and agree
 *  4  every alert has a fix button
 *  5  document.scrollWidth === 390 at phone width (and no horizontal scroll at 1080)
 *  6  under 250 words on the page
 *  +  every tile's link target · signed out = the one sign-in door and NO facts, no reads · Ledger off →
 *     "Not switched on" · the strings "accounting"/"books of account" absent · no alert() · the four bands on
 *     the Ledgers view (reached through the new deep link app.html#/app/ledger)
 * Screenshots: e2e/shots/index-{laptop,phone,alerts,all-well}.png and e2e/shots/ledgers-bands.png
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const SHOTS = path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });

/* ── the stand-in: one shop's day, one figure per source ───────────────────────────────────────────────────── */
function standIn() {
  const today = new Date().toISOString().slice(0, 10);
  const items = [];
  for (let i = 0; i < 112; i++) {
    const d = { price: { amount: 10 + i, currency: 'INR' }, cost: { amount: 6 + i, currency: 'INR' },
      category: 'Shelf ' + (i % 7 + 1) };
    if (i === 5) delete d.cost;                       /* the ONE item with no cost written down */
    if (i < 5) d.modifiers = [{ name: 'M' + i }, { name: 'N' + i }];   /* 10 modifiers in all */
    items.push({ id: 'p' + i, item_data: d });
  }
  return {
    calls: [],                                        /* every /api path asked, in order */
    me: { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR', gstn: null } },
    counters: [{ id: 'C1', name: 'Counter 1', open: true }],
    summary: { rows: [{ key: today, count: 12, total: 4280 }],
      prices_read_at: new Date(Date.now() - 3600 * 1000).toISOString(), unsent: 0 },
    items,
    combos: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
    drafts: [{ definition_id: 'd1', status: 'draft' }],
    booksOn: true,
    health: { enabled: true, last_posted_day: '2026-09-26', waiting: [] },
    accounts: [
      { code: '1300', name: 'Debtors', is_group: false }, { code: '1300-P00001', name: 'Ravi Stores', is_group: false },
      { code: '2100', name: 'Creditors', is_group: false }, { code: '2100-P00003', name: 'Agro Mills', is_group: false },
      { code: '1400', name: 'Cash', is_group: false }, { code: '1450', name: 'Bank', is_group: false },
      { code: '2201', name: 'GST payable', is_group: false }, { code: '3000', name: 'Capital', is_group: false },
      { code: '4000', name: 'Sales', is_group: false }, { code: '6000', name: 'Expenses', is_group: true },
      { code: '6010', name: 'Rent', is_group: false },
    ],
  };
}
function route(S, r) {
  const u = new URL(r.request().url()), p = u.pathname;
  S.calls.push(p);
  if (p === '/api/entities/me') return J(r, 200, S.me);
  if (p === '/api/till/counters') return J(r, 200, { ok: true, counters: S.counters });
  if (p === '/api/till/summary') return J(r, 200, S.summary);
  if (p === '/api/products') return J(r, 200, { items: S.items });
  if (p === '/api/combo-templates') return J(r, 200, { templates: S.combos });
  if (p === '/api/definitions') return J(r, 200, { definitions: S.drafts });
  if (p.startsWith('/api/books')) {
    if (!S.booksOn) return J(r, 404, { error: 'Not found' });
    if (p === '/api/books/health') return J(r, 200, S.health);
    if (p === '/api/books/accounts') return J(r, 200, { accounts: S.accounts });
  }
  if (r.request().method() === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  /* '/' is the page under test (the repo-root index.html — what the build puts at dist/index.html); everything
     else is public/, exactly as it deploys. */
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if ((!f.startsWith(PUB) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const threw = [];

  async function open(S, opts) {
    opts = opts || {};
    const ctx = await b.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => route(S, r));
    if (!opts.signedOut) await ctx.addInitScript(() => { try {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const tok = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-idx', identity_type: 'entity', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
      localStorage.setItem('cb_sess', JSON.stringify({ token: tok, role: 'entity', name: 'Mayur', entity: 'Mayur Bhavan' })); } catch (_) {} });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + (opts.path || '/'));
    return { ctx, p };
  }
  const settle = (p) => p.waitForTimeout(700);
  const words = (p) => p.evaluate(() => document.body.innerText.trim().split(/\s+/).filter(Boolean).length);
  const noBadWords = async (p, where) => {
    const t = await p.evaluate(() => document.body.innerText);
    ok(!/accounting|books of account/i.test(t), where + ': "accounting" / "books of account" appear nowhere');
  };

  /* ── the page's own source: no alert(), and ONE "no cost" counter ── */
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    ok(!/\balert\s*\(/.test(src), 'no alert() anywhere in the page');
    ok((src.match(/function noCostCount\(/g) || []).length === 1, 'exactly one definition of noCostCount()');
    ok(!/accounting|books of account/i.test(src), 'the source carries neither forbidden string');
    ok(/the ledger records it/.test(src), 'the opening sentence reads "the ledger records it"');
  }

  /* ── 1 · SIGNED IN, ALL WELL (laptop) ───────────────────────────────────────────────────────────────────── */
  {
    const S = standIn();
    const { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="nocost-cat"]', { timeout: 15000 });
    await settle(p);

    ok(await p.locator('[data-testid="day-to-day"] .box').count() === 3, 'three boxes under Day to day');
    ok(await p.locator('[data-testid="labs-band"] .lab').count() === 4, 'four labs under Labs');
    const tint = await p.evaluate(() => {
      const band = getComputedStyle(document.querySelector('[data-testid="labs-band"]')).backgroundColor;
      const page = getComputedStyle(document.body).backgroundColor;
      return { band, page };
    });
    ok(tint.band !== tint.page && tint.band !== 'rgba(0, 0, 0, 0)', 'the labs sit in a tinted band (' + tint.band + ')');

    /* 2 · nothing wrong → the alert block renders NOTHING: no box, no border, no height */
    const al = await p.evaluate(() => {
      const a = document.getElementById('alerts'), cs = getComputedStyle(a);
      return { kids: a.childElementCount, disp: cs.display, h: a.offsetHeight, border: cs.borderTopWidth };
    });
    ok(al.kids === 0 && al.disp === 'none' && al.h === 0, 'no alerts → the block renders nothing at all (display:' + al.disp + ', height:' + al.h + ')');

    /* 3 · one function, two doors, one number */
    const catN = await p.textContent('[data-testid="nocost-cat"]');
    const labN = await p.textContent('#st_prod');
    ok(/^1$/.test(catN.trim()) && /^1 without a cost$/.test(labN.trim()),
      'Catalogue "' + catN.trim() + ' with no cost written down" and Product Lab "' + labN.trim() + '" agree');
    const one = await p.evaluate(() => typeof noCostCount === 'function'
      && noCostCount([{ item_data: {} }, { item_data: { cost: { amount: 4 } } }, { item_data: { cost: 0 } }]) === 2);
    ok(one, 'noCostCount is the one counter, and it counts a missing or zero cost');

    /* the other live facts, each from its one source */
    const till = await p.textContent('#f_till');
    ok(/Counter 1 open/.test(till) && /12/.test(till) && /4,280/.test(till), 'Till: counter open · 12 bills · ₹4,280 today (' + till.replace(/\s+/g, ' ').trim() + ')');
    const cat = await p.textContent('#f_cat');
    ok(/112/.test(cat) && /7/.test(cat), 'Catalogue: 112 products · 7 shelves');
    const bk = await p.textContent('#f_bk');
    ok(/Ledger up to/.test(bk) && /26 Sep/.test(bk), 'Ledger: up to 26 Sep (' + bk.replace(/\s+/g, ' ').trim() + ')');
    ok(/1 draft waiting/.test(await p.textContent('#st_offer')), 'Offer Lab: 1 draft waiting');
    await p.waitForFunction(() => ((document.getElementById('st_combo') || {}).textContent || '').length > 0, null, { timeout: 8000 }).catch(() => {});
    ok(/3 combos · 10 modifiers/.test(await p.textContent('#st_combo')), 'Combo Lab: 3 combos · 10 modifiers');
    ok(/no GSTIN — cash memos/.test(await p.textContent('#st_tax')), 'Tax Lab: no GSTIN — cash memos');
    ok(/Prices read/.test(await p.textContent('[data-testid="prices-read"]')), 'the footer says when prices were read');

    /* every tile's link target */
    const href = (t) => p.getAttribute('[data-testid="' + t + '"]', 'href');
    ok(await href('box-till') === '/till.html' && await p.getAttribute('[data-testid="box-till"]', 'target') === '_blank', 'Till → /till.html, its own tab');
    ok(await href('box-catalogue') === 'app.html#/app/catalogue', 'Catalogue → app.html#/app/catalogue');
    ok(await href('box-ledger') === 'app.html#/app/ledger', 'Ledger → app.html#/app/ledger');
    ok(await href('lab-product') === 'product-lab.html' && await href('lab-offer') === 'offer-lab.html' && await href('lab-combo') === 'combo-lab.html', 'each Lab tile → its own page');
    ok(await p.evaluate(() => { const t = document.querySelector('[data-testid="lab-tax"]'); return t.tagName !== 'A' && !t.getAttribute('href'); }), 'Tax Lab is not a link — the page does not exist yet');
    ok(await href('foot-shop') === 'app.html#/app/settings' && await href('foot-coassists') === 'app.html#/app/coassists'
      && await href('foot-suppliers') === 'app.html#/app/suppliers' && await href('foot-connectors') === 'app.html#/app/connectors'
      && await href('foot-counters') === 'app.html#/app/settings', 'the footer rows open the app\'s sections');

    /* 6 · the word budget */
    const w = await words(p);
    ok(w < 250, 'under 250 words on the page (' + w + ')');
    await noBadWords(p, 'all well');

    await p.screenshot({ path: path.join(SHOTS, 'index-laptop.png'), fullPage: true });
    await p.setViewportSize({ width: 1080, height: 800 });
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 1080, 'no horizontal scroll at 1080');
    await p.screenshot({ path: path.join(SHOTS, 'index-all-well.png'), fullPage: true });

    /* 5 · phone: exactly the viewport, one column each */
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(250);
    ok(await p.evaluate(() => document.documentElement.scrollWidth) === 390, 'document.scrollWidth === 390 at phone width');
    const cols = await p.evaluate(() => ({
      main: getComputedStyle(document.querySelector('.main')).gridTemplateColumns.split(' ').length,
      labs: getComputedStyle(document.querySelector('.lgrid')).gridTemplateColumns.split(' ').length,
    }));
    ok(cols.main === 1 && cols.labs === 1, 'boxes stack and labs go one per row on a phone');
    await p.screenshot({ path: path.join(SHOTS, 'index-phone.png'), fullPage: true });
    await ctx.close();
  }

  /* ── 2 · THE DAY SOMETHING IS WRONG: three alerts, each with its fix ────────────────────────────────────── */
  {
    const S = standIn();
    S.summary.prices_read_at = new Date(Date.now() - 38 * 3600 * 1000).toISOString();
    S.summary.unsent = 3;
    S.health.waiting = [{ id: 1, reason: 'Paid by Points — there is no ledger for Points yet.' },
                        { id: 2, reason: 'September is locked.' }];
    const { ctx, p } = await open(S);
    await p.waitForFunction(() => document.querySelectorAll('#alerts .al').length === 3, null, { timeout: 15000 });
    await settle(p);
    const n = await p.locator('#alerts .al').count();
    ok(n === 3, 'a failing thing earns a row — three failing things, three rows (' + n + ')');
    ok(await p.locator('#alerts .al .fix').count() === n, 'every alert carries the button that fixes it');
    const fixes = await p.$$eval('#alerts .al .fix', (els) => els.map((e) => e.getAttribute('href')));
    ok(fixes.every(Boolean) && fixes.filter((f) => f === '/till.html').length === 2 && fixes.indexOf('app.html#/app/ledger') >= 0,
      'each fix button opens the place that fixes it (' + fixes.join(' · ') + ')');
    ok(await p.evaluate(() => document.querySelector('#alerts .al').classList.contains('bad')), 'what is wrong now sits first');
    ok(/Prices are 38 hours old/.test(await p.textContent('#alerts')), 'the price alert says how old, in hours');
    /* rule 11: the amber fact is the SAME number as the alert above it */
    const bk = await p.textContent('#f_bk');
    ok(/2/.test(bk) && /2 waiting/.test(await p.textContent('#alerts')), 'the Ledger box\'s amber "2 waiting" is the alert\'s own number');
    ok(!/error|failed|exception/i.test(await p.evaluate(() => document.body.innerText)), 'no error string reaches the screen');
    const w = await words(p);
    ok(w < 250, 'still under 250 words with every alert up (' + w + ')');
    await p.screenshot({ path: path.join(SHOTS, 'index-alerts.png'), fullPage: true });
    await ctx.close();
  }

  /* ── 3 · SIGNED OUT: the three boxes, no facts, no reads, one door in ───────────────────────────────────── */
  {
    const S = standIn();
    const { ctx, p } = await open(S, { signedOut: true });
    await p.waitForSelector('[data-testid="signin-door"]', { timeout: 15000 });
    await settle(p);
    ok(await p.getAttribute('[data-testid="signin-door"]', 'href') === 'app.html#/login', 'the one sign-in door → app.html#/login');
    ok(await p.locator('[data-testid="day-to-day"] .box').count() === 3 && await p.locator('[data-testid="labs-band"] .lab').count() === 4, 'the three boxes and four labs are still shown');
    ok(await p.locator('.box .f').count() === 0, 'signed out: no facts');
    ok(S.calls.length === 0, 'signed out: not one API call leaves the page (' + S.calls.length + ')');
    ok(await p.evaluate(() => document.getElementById('alerts').childElementCount) === 0, 'signed out: no alerts either');
    ok(/^coming$/.test((await p.textContent('#st_tax')).trim()), 'Tax Lab says "coming" and nothing else');
    await noBadWords(p, 'signed out');
    await ctx.close();
  }

  /* ── 4 · THE LEDGER IS OFF: 404 → "Not switched on", and the box still opens the app's Ledger ───────────── */
  {
    const S = standIn();
    S.booksOn = false;
    const { ctx, p } = await open(S);
    await p.waitForFunction(() => /Not switched on/.test((document.getElementById('f_bk') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    ok(/Not switched on/.test(await p.textContent('#f_bk')), 'Ledger off: the box says "Not switched on"');
    ok(await p.getAttribute('[data-testid="box-ledger"]', 'href') === 'app.html#/app/ledger', 'and still opens the app\'s Ledger section, which explains');
    ok(!/404|error/i.test(await p.evaluate(() => document.body.innerText)), 'the 404 never reaches the screen');
    await ctx.close();
  }

  /* ── 5 · THE DEEP LINK AND THE FOUR BANDS on the app's Ledgers view ─────────────────────────────────────── */
  {
    const S = standIn();
    const { ctx, p } = await open(S, { path: '/app.html#/app/ledger' });
    const landed = await p.waitForSelector('[data-testid="bk-tab-daybook"]', { timeout: 20000 }).catch(() => null);
    ok(!!landed, 'app.html#/app/ledger lands on the Ledger — the deep link sets UI.nav on arrival');
    if (landed) await p.click('[data-testid="bk-tab-ledgers"]');
    await p.waitForSelector('[data-testid="bk-band-people"]', { timeout: 15000 }).catch(() => {});
    const band = (t) => p.textContent('[data-testid="' + t + '"] + div', { timeout: 3000 }).catch(() => '');
    const people = await band('bk-band-people'), things = await band('bk-band-things'), income = await band('bk-band-income');
    ok(/1300 · Debtors/.test(people) && /2100 · Creditors/.test(people) && /Ravi Stores/.test(people) && /Agro Mills/.test(people),
      'People: Debtors and Creditors as the control lines, their parties beside them');
    ok(/1400 · Cash/.test(things) && /1450 · Bank/.test(things) && /2201 · GST payable/.test(things) && /3000 · Capital/.test(things) && !/Debtors|Creditors/.test(things),
      'Things you hold: cash, bank, GST payable — never the party lines');
    ok(/4000 · Sales/.test(income) && /6010 · Rent/.test(income), 'Income and expenses: 4xxx–6xxx');
    ok(await p.locator('[data-testid="bk-band-results"]').count() === 1
      && await p.locator('[data-testid="lg-go-tb"]').count() === 1 && await p.locator('[data-testid="lg-go-pl"]').count() === 1 && await p.locator('[data-testid="lg-go-bs"]').count() === 1,
      'Results: the three doors — Trial balance, P&L, Balance sheet');
    const bandTxt = await p.textContent('[data-testid="bk-body"]');
    ok(/People/.test(bandTxt) && /personal/.test(bandTxt) && /real/.test(bandTxt) && /nominal/.test(bandTxt), 'each band says the plain word first, the classical word after');
    ok(await p.locator('[data-testid="nav-home"]').count() === 1 && await p.getAttribute('[data-testid="nav-home"]', 'href') === '/', 'the app\'s top bar carries Home → /');
    await noBadWords(p, 'ledgers view');
    await p.screenshot({ path: path.join(SHOTS, 'ledgers-bands.png'), fullPage: false });
    await ctx.close();
  }

  /* ── 6 · each Lab page's header carries Home → / ────────────────────────────────────────────────────────── */
  for (const page of ['product-lab.html', 'offer-lab.html', 'combo-lab.html']) {
    const src = fs.readFileSync(path.join(PUB, page), 'utf8');
    ok(/data-testid="nav-home" href="\/"/.test(src), page + ': the header carries Home → /');
  }

  const mine = threw.filter((m) => !/fonts|favicon/i.test(m));
  ok(mine.length === 0, 'no page error' + (mine.length ? ' — ' + mine.slice(0, 3).join(' | ').slice(0, 300) : ''));
  await b.close(); srv.close();
  console.log('\n  index-page: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
