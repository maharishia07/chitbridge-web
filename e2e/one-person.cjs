/* one-person.cjs — ONE BROWSER, ONE SHOP, PROVED (Athi, 2026-10-01).
 * *"the very first check is to see any fingerprint of any other entity here. if so make sure that it logs out and
 * very clear. do not allow the shop to open until the browser or session is clear out of danger."*
 *
 * Pattern: index-page.cjs / books-web.cjs — Playwright, ONE browser context (tabs share localStorage and a
 * BroadcastChannel, as a real browser's tabs do), a stand-in API answering INSIDE the page, the static server on a
 * free OS port. Nothing here reaches localhost:3000, port 7351, or the live site.
 *
 *  1  tab 1 signs in as Alpha Timers (A) → the shop opens; cb_sess and cb_owner say A
 *  2  tab 2 signs in as Tally Test (B) → STOPPED at "Close the other shop first": an app tab open · 1 unsent draft.
 *     The shop does not open, cb_sess is NOT B's, a renderApp() or a deep link from behind the screen opens nothing
 *  3  "Sync and sign Alpha Timers out" → tab 1 signs out and says why; A's session, draft and saved screen settings
 *     are gone; tab 2 opens as B; cb_owner says B
 *  4  the index in tab 3 shows B; the Till tile: not paired · paired to B · paired to Mayuri123 (amber, still a link)
 *  5  a co-assist of the SAME shop signs in → no screen, nobody is signed out
 *  6  sign out in tab 2 → the co-assist's tab and the index are signed out too; a read that lands late paints nothing
 *  7  a counter paired to Mayuri123 (in the counter's own IndexedDB) → B is stopped; the screen sends you to the
 *     counter; once the counter's keys say Mayuri123 is gone, "Check again" opens B. Never creates a database.
 *  8  A's session left behind with no tab → "still signed in" → cleared
 *  9  the index with another shop's app tab open → the close-first row instead of facts → cleared → facts
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const exp = Math.floor(Date.now() / 1000) + 3600;
const tok = (claims) => b64({ alg: 'none' }) + '.' + b64(Object.assign({ exp }, claims)) + '.x';
const SHOPS = {
  alpha: { ent: 'ent-A', name: 'Alpha Timers', email: 'alpha@shop.in', items: 3 },
  tallytest: { ent: 'ent-B', name: 'Tally Test', email: 'tally@shop.in', items: 7 },
};
for (const k of Object.keys(SHOPS)) SHOPS[k].token = tok({ identity_id: SHOPS[k].ent, identity_type: 'entity' });
const RAVI = tok({ identity_id: 'act-B1', identity_type: 'actor', parent_entity_id: 'ent-B', parent_entity_name: 'Tally Test', display_name: 'Ravi' });

function claimsOf(h) { try { return JSON.parse(Buffer.from(String(h || '').replace(/^Bearer /, '').split('.')[1], 'base64').toString()); } catch (_) { return {}; } }
function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  let body = {}; try { body = JSON.parse(q.postData() || '{}'); } catch (_) {}
  const c = claimsOf(q.headers().authorization), ent = c.parent_entity_id || c.identity_id;
  const shop = Object.values(SHOPS).find((s) => s.ent === ent);
  if (p === '/api/entities/register' && m === 'POST') { const s = SHOPS[String(body.display_name || '').toLowerCase()]; return s ? J(r, 200, { email: s.email }) : J(r, 404, { error: 'not found' }); }
  if (p === '/api/entities/verify' && m === 'POST') { const s = Object.values(SHOPS).find((x) => x.email === body.email); return s ? J(r, 200, { token: s.token, entity: { display_name: s.name, bridge_id: s.ent + '-br' } }) : J(r, 401, { error: 'bad code' }); }
  if (p === '/api/actors/check-login') return J(r, 200, { valid: true, has_pin: true });
  if (p === '/api/actors/login' && m === 'POST') return J(r, 200, { token: RAVI, actor: { display_name: 'Ravi', parent_entity: 'Tally Test', break_status: 'active' } });
  if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: shop ? shop.name : '', currency_code: 'INR', gstn: null } });
  if (p === '/api/products') {
    const n = shop ? shop.items : 0, items = [];
    for (let i = 0; i < n; i++) items.push({ id: 'p' + i, item_data: { price: { amount: 10 }, cost: { amount: 5 }, category: 'S' + i } });
    if (S.slowProducts) return new Promise((res) => setTimeout(() => res(J(r, 200, { items })), S.slowProducts));
    return J(r, 200, { items });
  }
  if (m === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}

(async () => {
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
  const S = {};
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route('**/api/**', (r) => route(S, r));
  /* the counter page is the counter's own (vendored, never driven here): a stand-in, so opening it changes no key */
  let tillOpened = 0;
  await ctx.route('**/till.html*', (r) => { tillOpened++; return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>counter stand-in</title>' }); });
  const tab = async (url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => threw.push(e.message)); if (url) await p.goto(base + url); return p; };
  const ls = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
  const sessEnt = async (p) => { const s = JSON.parse(await ls(p, 'cb_sess') || 'null'); return s ? claimsOf('Bearer ' + s.token).parent_entity_id || claimsOf('Bearer ' + s.token).identity_id : null; };
  const opened = (p, ms) => p.waitForSelector('[data-testid="nav-home"]', { timeout: ms || 15000 }).then(() => true, () => false);
  const gated = (p, ms) => p.waitForSelector('[data-testid="gate"]', { timeout: ms || 15000 }).then(() => true, () => false);
  async function signIn(p, id, code) {
    if (!/#\/login/.test(p.url())) await p.goto(base + '/app.html#/login');
    await p.waitForSelector('#l_id', { timeout: 15000 });
    await p.fill('#l_id', id); await p.click('#l_go');
    const sel = id.includes('@') ? '#l_pin' : '#l_otp';
    await p.waitForSelector(sel, { timeout: 15000 });
    await p.fill(sel, code); await p.click('#l_go');
  }
  async function signOutVia(p) {
    await p.click('[data-testid="icon-logout"]');
    await p.waitForSelector('[data-testid="confirm-ok"]', { timeout: 5000 });
    await p.click('[data-testid="confirm-ok"]');
  }

  /* ── 1 · A opens ─────────────────────────────────────────────────────────────────────────────────────────── */
  const t1 = await tab('/app.html#/login');
  await signIn(t1, 'alpha', '111111');
  ok(await opened(t1), '1 · Alpha Timers signs in in tab 1 — the shop opens');
  ok(await sessEnt(t1) === 'ent-A', '1 · cb_sess is A\'s');
  ok(JSON.parse(await ls(t1, 'cb_owner') || '{}').ent === 'ent-A', '1 · cb_owner says the browser\'s work is A\'s');
  /* what A leaves behind: a half-typed message, and a saved screen setting under A's id */
  await t1.evaluate(() => { localStorage.setItem('cb.draft.msg.c1', JSON.stringify({ at: Date.now(), data: 'half a message' }));
                             localStorage.setItem('cb_colw@ent-A', '{"w":1}'); });

  /* ── 2 · B is stopped ────────────────────────────────────────────────────────────────────────────────────── */
  const t2 = await tab('/app.html#/login');
  await signIn(t2, 'tallytest', '222222');
  ok(await gated(t2), '2 · Tally Test signs in in tab 2 — STOPPED at the close-first screen');
  const say = await t2.textContent('[data-testid="gate-other"]').catch(() => '');
  ok(/This browser still holds Alpha Timers: an app tab open · 1 unsent draft\. Close it first\./.test(say), '2 · it names the shop and what it holds ("' + say.replace(/\s+/g, ' ').trim().slice(0, 110) + '")');
  ok(/Sync and sign Alpha Timers out/.test(await t2.textContent('[data-testid="gate-clear"]').catch(() => '')), '2 · one button: "Sync and sign Alpha Timers out"');
  ok(!(await opened(t2, 600)), '2 · the shop has not opened');
  ok(await sessEnt(t2) === 'ent-A', '2 · cb_sess is NOT written for B before the browser is clean');
  /* the back doors: an async loader calling renderApp(), and a deep link, from behind the screen */
  await t2.evaluate(() => { try { renderApp(); } catch (_) {} });
  await t2.evaluate(() => { location.hash = '#/app/ledger'; });
  await t2.waitForTimeout(700);
  ok(await t2.locator('[data-testid="gate"]').count() === 1 && !(await opened(t2, 300)), '2 · renderApp() and a deep link from behind the screen open nothing');
  ok(await ls(t2, 'cb_nav@ent-B') === null, '2 · the deep link wrote nothing of B\'s either (route stopped before it)');
  ok(await opened(t1, 1000) && await sessEnt(t1) === 'ent-A', '2 · tab 1 is still A — nobody was switched silently');
  await t2.screenshot({ path: path.join(__dirname, 'shots', 'one-person-gate.png') }).catch(() => {});

  /* ── 3 · Sync and sign A out ─────────────────────────────────────────────────────────────────────────────── */
  await t2.click('[data-testid="gate-clear"]');
  ok(await opened(t2, 15000), '3 · after the clear-out, tab 2 opens as Tally Test');
  await t1.waitForSelector('[data-testid="signed-out-why"]', { timeout: 8000 }).catch(() => {});
  const why1 = await t1.textContent('[data-testid="signed-out-why"]').catch(() => '');
  ok(/^Signed out — Tally Test opened in another tab\.$/.test(why1.trim()), '3 · tab 1 signs out and says why ("' + why1.trim() + '")');
  ok(await t1.locator('#l_id').count() === 1 && await t1.locator('[data-testid="nav-home"]').count() === 0, '3 · tab 1 is at sign-in — it did not re-render as B');
  ok(await sessEnt(t2) === 'ent-B', '3 · cb_sess is now B\'s');
  ok(await ls(t2, 'cb.draft.msg.c1') === null, '3 · A\'s unsent draft is gone');
  ok(await ls(t2, 'cb_colw@ent-A') === null, '3 · A\'s saved screen settings are gone');
  ok(JSON.parse(await ls(t2, 'cb_owner') || '{}').ent === 'ent-B', '3 · cb_owner now says B');
  ok(/Tally Test/.test(await t2.evaluate(() => document.body.innerText)) && !/Alpha Timers/.test(await t2.evaluate(() => document.body.innerText)), '3 · tab 2 shows B\'s shop and nothing of A');
  await t1.screenshot({ path: path.join(__dirname, 'shots', 'one-person-left.png') }).catch(() => {});

  /* ── 4 · the index shows B, and the Till tile names the counter's shop ───────────────────────────────────── */
  const t3 = await tab('/');
  await t3.waitForSelector('[data-testid="till-paired"]', { timeout: 15000 }).catch(() => {});
  await t3.waitForFunction(() => /Tally Test/.test((document.querySelector('[data-testid="shop-name"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Tally Test/.test(await t3.textContent('[data-testid="shop-name"]')), '4 · the index in tab 3 shows Tally Test');
  await t3.waitForFunction(() => /7/.test((document.getElementById('f_cat') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/\b7\b/.test(await t3.textContent('#f_cat')), '4 · and B\'s own figures (7 products)');
  ok((await t3.textContent('[data-testid="till-paired"]')).trim() === 'Not paired yet', '4 · Till tile: "Not paired yet" when no counter is paired');
  const pairTo = async (ent, name) => t2.evaluate(([e, n]) => { localStorage.setItem('cb_till_shop@abc1', e); localStorage.setItem('cb_till_shopname@abc1', n);
    localStorage.setItem('cb_till_key', 'k-' + e); localStorage.setItem('cb_till_lastslot', 'cb-till-abc1'); }, [ent, name]);
  await pairTo('ent-B', 'Tally Test');
  await t3.waitForFunction(() => /paired to Tally Test/.test((document.querySelector('[data-testid="till-paired"]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  ok(/^Counter 1 · paired to Tally Test$/.test((await t3.textContent('[data-testid="till-paired"]')).trim()), '4 · paired here → "Counter 1 · paired to Tally Test" (repainted from the counter\'s keys, no reload)');
  await pairTo('ent-C', 'Mayuri123');
  await t3.waitForFunction(() => /Mayuri123/.test((document.querySelector('[data-testid="till-paired"]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const amber = await t3.evaluate(() => { const e = document.querySelector('[data-testid="till-paired"]'); return { t: e.textContent.trim(), dn: e.classList.contains('dn'), c: getComputedStyle(e).color }; });
  ok(amber.t === 'Counter 1 · paired to Mayuri123, not this shop' && amber.dn, '4 · paired elsewhere → amber "' + amber.t + '" (' + amber.c + ')');
  ok(await t3.getAttribute('[data-testid="box-till"]', 'href') === '/till.html', '4 · and the tile still opens the counter, which offers the switch itself');
  await t3.screenshot({ path: path.join(__dirname, 'shots', 'one-person-index-amber.png') }).catch(() => {});
  await t2.evaluate(() => ['cb_till_shop@abc1', 'cb_till_shopname@abc1', 'cb_till_key', 'cb_till_lastslot'].forEach((k) => localStorage.removeItem(k)));
  await t3.waitForFunction(() => /Not paired yet/.test((document.querySelector('[data-testid="till-paired"]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});

  /* ── 5 · the same shop passes cleanly ────────────────────────────────────────────────────────────────────── */
  const t4 = await tab('/app.html#/login');
  await signIn(t4, 'ravi@tallytest', '1234');
  ok(await opened(t4), '5 · Ravi, a co-assist of Tally Test, signs in — the shop opens');
  ok(await t4.locator('[data-testid="gate"]').count() === 0, '5 · no close-first screen for the same shop');
  await t4.waitForTimeout(600);
  ok(await opened(t2, 500) && await t2.locator('[data-testid="signed-out-why"]').count() === 0, '5 · the owner\'s tab 2 is still signed in');
  ok(/Tally Test/.test(await t3.textContent('[data-testid="shop-name"]')) && await t3.locator('[data-testid="signed-out-why"]').count() === 0, '5 · the index still shows Tally Test');

  /* ── 6 · sign out in tab 2 → the others follow; a late read paints nothing ───────────────────────────────── */
  S.slowProducts = 1500;
  await t3.reload(); await t3.waitForSelector('[data-testid="till-paired"]', { timeout: 15000 }).catch(() => {});
  await signOutVia(t2);
  await t4.waitForSelector('[data-testid="signed-out-why"]', { timeout: 8000 }).catch(() => {});
  ok(/Signed out — you signed out in another tab\./.test(await t4.textContent('[data-testid="signed-out-why"]').catch(() => '')), '6 · sign out in tab 2 → the co-assist\'s tab signs out and says why');
  await t3.waitForSelector('[data-testid="signin-door"]', { timeout: 8000 }).catch(() => {});
  ok(await t3.locator('[data-testid="signin-door"]').count() === 1 && /signed out in another tab/.test(await t3.textContent('#alerts')), '6 · the index signs out too, with the one door in');
  await t3.waitForTimeout(1800);
  ok(await t3.locator('.box .f').count() === 0, '6 · the read that landed after the sign-out painted nothing (' + await t3.locator('.box .f').count() + ' facts)');
  S.slowProducts = 0;
  ok(await t2.evaluate(() => _mePrefetch === null && _meReq === null && GATE.ent === null), '6 · signing out drops the old person\'s /me and closes the gate');

  /* ── 7 · a counter paired to another shop: the shop waits until the counter is switched ON the counter ──── */
  await t2.evaluate(() => new Promise((res) => {
    const rq = indexedDB.open('cb-till-c7', 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); rq.result.createObjectStore('bills', { keyPath: 'no' }); rq.result.createObjectStore('queue', { keyPath: 'no' }); };
    rq.onsuccess = () => { const db = rq.result; const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ entity_id: 'ent-C', shop: { name: 'Mayuri123' }, items: [] }, 'snapshot');
      tx.oncomplete = () => { db.close(); localStorage.setItem('cb_till_key', 'k-c'); localStorage.setItem('cb_till_lastslot', 'cb-till-c7'); res(); }; };
  }));
  await signIn(t2, 'tallytest', '222222');
  ok(await gated(t2), '7 · counter paired to Mayuri123 → Tally Test is stopped');
  const cs = await t2.textContent('[data-testid="gate-counter"]').catch(() => '');
  ok(/The counter here is paired to Mayuri123\. Switch it on the counter itself/.test(cs), '7 · the screen names the counter\'s shop, read from the counter\'s own copy ("' + cs.replace(/\s+/g, ' ').trim().slice(0, 70) + '…")');
  ok(await t2.locator('[data-testid="gate-clear"]').count() === 0, '7 · the app offers no button that clears the counter — that is the counter\'s');
  ok(!(await opened(t2, 600)) && await sessEnt(t2) === null, '7 · the shop does not open, and cb_sess stays empty');
  const pop = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await t2.click('[data-testid="gate-counter-open"]');
  const tp = await pop; if (tp) await tp.waitForLoadState().catch(() => {});
  ok(!!tp && /\/till\.html$/.test(tp.url()) && tillOpened >= 1, '7 · "Open the counter to switch it" opens /till.html');
  if (tp) await tp.close();
  await t2.click('[data-testid="gate-recheck"]'); await t2.waitForTimeout(800);
  ok(!(await opened(t2, 300)), '7 · Check again while the counter is still Mayuri123\'s → still stopped');
  /* the counter's own sign-in switched it (simulated: its keys no longer name Mayuri123) */
  await t2.evaluate(() => new Promise((res) => { localStorage.removeItem('cb_till_key'); localStorage.removeItem('cb_till_lastslot');
    const d = indexedDB.deleteDatabase('cb-till-c7'); d.onsuccess = d.onerror = d.onblocked = () => res(); }));
  await t2.click('[data-testid="gate-recheck"]');
  ok(await opened(t2), '7 · once the counter\'s keys say Mayuri123 is gone, Check again opens Tally Test');
  /* the check never creates a database: a slot named but absent stays absent */
  await t2.evaluate(() => localStorage.setItem('cb_till_lastslot', 'cb-till-ghost'));
  await t2.evaluate(() => CBOnePerson.counterPair());
  const dbs = await t2.evaluate(() => indexedDB.databases().then((l) => l.map((d) => d.name)));
  ok(dbs.indexOf('cb-till-ghost') < 0, '7 · reading the counter never creates its database (' + JSON.stringify(dbs) + ')');
  await t2.evaluate(() => localStorage.removeItem('cb_till_lastslot'));

  /* ── 8 · A's session left behind, no tab open ────────────────────────────────────────────────────────────── */
  await signOutVia(t2);
  await t2.waitForSelector('#l_id', { timeout: 8000 });
  await t2.evaluate((t) => localStorage.setItem('cb_sess', JSON.stringify({ token: t, role: 'entity', name: 'Alpha Timers', entity: 'Alpha Timers' })), SHOPS.alpha.token);
  for (const p of [t1, t3, t4]) await p.close();
  const t5 = await tab('/app.html#/login');
  await signIn(t5, 'tallytest', '222222');
  ok(await gated(t5), '8 · A\'s session left behind (no tab) → Tally Test is stopped');
  ok(/This browser still holds Alpha Timers: still signed in\. Close it first\./.test(await t5.textContent('[data-testid="gate-other"]').catch(() => '')), '8 · "This browser still holds Alpha Timers: still signed in."');
  await t5.click('[data-testid="gate-clear"]');
  ok(await opened(t5) && await sessEnt(t5) === 'ent-B', '8 · cleared → Tally Test opens, cb_sess is B\'s');

  /* ── 9 · the index, with another shop's app tab still open ───────────────────────────────────────────────── */
  const fake = await tab('/app.html#/login');   /* a tab that answers as A over the channel, as an old A tab would */
  await fake.evaluate(() => { window.__left = 0; const c = new BroadcastChannel('cb-one-person');
    c.onmessage = (e) => { const m = e.data || {}; if (m.t === 'who') c.postMessage({ t: 'here', q: m.q, tab: 'fake', ent: 'ent-A', uid: 'ent-A', name: 'Alpha Timers' });
      if (m.t === 'leave' && m.ent === 'ent-A') { window.__left++; c.close(); c2.postMessage({ t: 'left', q: m.q, tab: 'fake' }); } };
    const c2 = new BroadcastChannel('cb-one-person'); window.__c = c; });
  const t6 = await tab('/');
  await t6.waitForSelector('[data-testid="close-first"]', { timeout: 10000 }).catch(() => {});
  ok(/This browser still holds Alpha Timers: an app tab open\. Close it first\./.test(await t6.textContent('#alerts')), '9 · the index with A\'s app tab open → the close-first row');
  ok(await t6.locator('#f_cat .f').count() === 0, '9 · and no facts while it is there');
  ok(await t6.locator('[data-testid="till-paired"]').count() === 1, '9 · the Till tile still says what the counter is paired to');
  await t6.screenshot({ path: path.join(__dirname, 'shots', 'one-person-index-close.png') }).catch(() => {});
  await t6.click('[data-testid="close-first-go"]');
  await t6.waitForFunction(() => /7/.test((document.getElementById('f_cat') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
  ok(await fake.evaluate(() => window.__left) === 1, '9 · the A tab was told to leave');
  ok(/\b7\b/.test(await t6.textContent('#f_cat')) && await t6.locator('[data-testid="close-first"]').count() === 0, '9 · cleared → the index shows Tally Test\'s facts');

  /* ── the words ── */
  const src = fs.readFileSync(path.join(PUB, 'app', 'one-person.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(!/accounting/i.test(src), 'the word "accounting" appears nowhere in what this adds');

  const mine = threw.filter((m) => !/fonts|favicon/i.test(m));
  ok(mine.length === 0, 'no page error' + (mine.length ? ' — ' + mine.slice(0, 3).join(' | ').slice(0, 300) : ''));
  await b.close(); srv.close();
  console.log('\n  one-person: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
