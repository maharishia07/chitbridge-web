/* till-shop-switch.cjs — ⚠️⚠️⚠️ A PERSON FROM ANOTHER SHOP SIGNING IN SWITCHES THE WHOLE COUNTER, OR NOBODY IS SIGNED IN
 *
 * Athi, 2026-09-28: "i have signed in shop x and trying to load new products etc, then signed out and sign-in
 * again into another shop, but still i could see the products of shop x. when sign-in, if the shop credentials
 * are different, then the till has to switch to new shop and it should not allow to carry on."
 *
 * ⚠️ WHY [TILL-04] NEVER CAUGHT IT. counter-key.spec.js opens the counter from the APP, where counterHasKey()
 * compares shops. This path is the counter's OWN sign-in dialog, which trusted any key it already held
 * (usignEnrolIfNeeded) and adopted a person from shop Y onto shop X's shelf.
 *
 * ⭐ DRIVEN THROUGH THE DIALOG'S OWN CONTROLS — type the user id, press "Send me a code", press "Sign in",
 * answer the question — against a stand-in ChitBridge that answers PER KEY, so each shop's shelf arrives through
 * the page's real boot path, not planted in S. [[feedback-shoot-the-screen-not-the-dom]]
 *
 * Run: node e2e/till-shop-switch.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const SHOTS = path.join(__dirname, '..', 'test-results', 'till-shop-switch');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(66) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

/* two shops, one person each — and one person from a server too old to say which shop they belong to */
const SHOPS = {
  'KEY-X': { entity_id: 'ent-x', shop: { name: 'Shop X', bridge_id: 'CB-X' }, item: 'XMANGO' },
  'KEY-Y': { entity_id: 'ent-y', shop: { name: 'Shop Y', bridge_id: 'CB-Y' }, item: 'YPANEER' },
};
const PEOPLE = {
  xclerk:  { identity_id: 'p-x', user_id: 'xclerk',  display_name: 'X Clerk', identity_type: 'actor',  entity_id: 'ent-x', key: 'KEY-X' },
  yowner:  { identity_id: 'ent-y', user_id: 'yowner', display_name: 'Y Owner', identity_type: 'entity', entity_id: 'ent-y', key: 'KEY-Y' },
  oldsrv:  { identity_id: 'p-o', user_id: 'oldsrv',  display_name: 'Old Server', identity_type: 'actor' /* no entity_id */ },
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const web = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  const enrolled = [];
  const api = http.createServer(async (q, r) => {
    let raw = ''; for await (const c of q) raw += c;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const j = (c2, o) => { r.writeHead(c2, Object.assign({ 'content-type': 'application/json' }, cors)); r.end(JSON.stringify(o)); };
    if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
    const u = q.url.split('?')[0];
    const b = raw ? JSON.parse(raw) : {};
    if (u === '/api/entities/register') return j(200, { message: 'sent', dev_otp: '123456' });
    if (u === '/api/entities/verify') {
      const p = PEOPLE[b.user_id]; if (!p) return j(404, { message: 'not found' });
      const id = { identity_id: p.identity_id, bridge_id: 'CB-P', display_name: p.display_name, user_id: p.user_id,
                   identity_type: p.identity_type };
      if (p.entity_id) id.entity_id = p.entity_id;
      return j(200, { token: 'TOKEN-' + p.user_id, identity: id });
    }
    if (u === '/api/till/enrol') {
      const who = String(q.headers.authorization || '').replace('Bearer TOKEN-', '');
      const p = PEOPLE[who]; enrolled.push(who);
      if (!p || !p.key) return j(403, { message: 'no shop' });
      return j(200, { key: p.key, shop: SHOPS[p.key].shop });
    }
    if (u === '/api/till/snapshot') {
      const s = SHOPS[q.headers['x-api-key']]; if (!s) return j(401, { message: 'key refused' });
      return j(200, { at: new Date().toISOString(), entity_id: s.entity_id, shop: s.shop,
        items: [{ id: s.item.toLowerCase(), name: s.item, price: 50, unit: 'nos', code: s.item }] });
    }
    return j(200, { ok: true });
  });
  await new Promise((res) => web.listen(0, '127.0.0.1', res));
  await new Promise((res) => api.listen(0, '127.0.0.1', res));
  const API = 'http://127.0.0.1:' + api.address().port;

  const b = await chromium.launch();
  const ctx = await b.newContext();
  /* the device already belongs to shop X — set ONCE, never again after a reload */
  await ctx.addInitScript((a) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('cb_till_api', a); localStorage.setItem('cb_till_key', 'KEY-X');
  }, API);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const shelf = () => p.evaluate(() => ({ shop: (S && S.shop && S.shop.name) || null,
    items: ((S && S.items) || []).map((i) => i.name), key: localStorage.getItem('cb_till_key'),
    who: (typeof WHO !== 'undefined' && WHO && WHO.name) || null }));
  const ready = async (shop) => {
    await p.waitForFunction(() => typeof usignOpen === 'function' && typeof usignOtherShop === 'function', null, { timeout: 30000 });
    await p.evaluate(() => refresh().catch(function(){}));
    await p.waitForFunction((n) => S && S.shop && S.shop.name === n, shop, { timeout: 30000 });
  };
  /* the real dialog: user id → "Send me a code" → the test server's code is filled in → "Sign in" */
  const signIn = async (who) => {
    await p.evaluate(() => usignOpen());
    await p.fill('[data-testid="till-usign-who"]', who);
    await p.click('[data-testid="till-usign-ask"]');
    await p.waitForSelector('[data-testid="till-usign-otp"]');
    await p.click('[data-testid="till-usign-verify"]');
  };

  await p.goto('http://127.0.0.1:' + web.address().port + '/till.html');
  await ready('Shop X');
  const x0 = await shelf();
  say('the counter starts as shop X, with X\'s own shelf', x0.shop === 'Shop X' && x0.items.indexOf('XMANGO') >= 0, JSON.stringify(x0.items));

  console.log('\n── ⭐ SHOP X\'s OWN PERSON signs in — nothing switches, nothing is asked ' + '─'.repeat(0));
  await signIn('xclerk');
  await p.waitForSelector('[data-testid="till-usign-in"]', { timeout: 10000 });
  const x1 = await shelf();
  say('signed in on the same counter', x1.who === 'X Clerk' && x1.key === 'KEY-X', 'who=' + x1.who + ' key=' + x1.key);
  say('no enrol call — an ordinary sign-in stays cheap', enrolled.length === 0, 'enrol calls=' + enrolled.length);
  await p.click('[data-testid="till-usign-out"]');
  await p.evaluate(() => usignClose());

  console.log('\n── ⚠️⚠️ SHOP Y\'s OWNER signs in and says STAY — nobody is signed in, the counter stays X ' + '─'.repeat(0));
  await signIn('yowner');
  await p.waitForSelector('#askdlg[open]', { timeout: 10000 });
  const asked = await p.evaluate(() => document.getElementById('askbody').textContent + ' | ' + document.getElementById('askok').textContent);
  say('the counter ASKS before anything changes', /different shop/i.test(asked) && /Switch/i.test(asked), '"' + asked.slice(0, 70) + '…"');
  await p.screenshot({ path: path.join(SHOTS, '1-asked.png') });
  await p.click('#askno');
  await p.waitForSelector('[data-testid="till-usign-why"]', { timeout: 10000 });
  const x2 = await shelf();
  say('⚠️ Y is NOT signed in on X\'s counter', x2.who === null, 'who=' + x2.who);
  say('the counter is still X, key and shelf', x2.key === 'KEY-X' && x2.shop === 'Shop X' && x2.items.indexOf('XMANGO') >= 0, x2.key + ' · ' + x2.shop);
  await p.evaluate(() => usignClose());

  console.log('\n── ⭐⭐⭐ SHOP Y\'s OWNER signs in and SWITCHES — the whole counter becomes Y ' + '─'.repeat(0));
  await signIn('yowner');
  await p.waitForSelector('#askdlg[open]', { timeout: 10000 });
  const nav = p.waitForEvent('load', { timeout: 30000 });
  await p.click('#askok');
  await nav;
  await ready('Shop Y');
  const y = await shelf();
  await p.screenshot({ path: path.join(SHOTS, '2-switched.png') });
  say('the page RELOADED into shop Y (not repainted)', y.shop === 'Shop Y', 'shop=' + y.shop);
  say('shop Y\'s own shelf is on it', y.items.indexOf('YPANEER') >= 0, JSON.stringify(y.items));
  say('⚠️⚠️ and NOTHING of shop X', y.items.indexOf('XMANGO') < 0, 'XMANGO present=' + (y.items.indexOf('XMANGO') >= 0));
  const txt = await p.evaluate(() => document.body.innerText);
  say('not on the screen anywhere either', txt.indexOf('XMANGO') < 0 && txt.indexOf('Shop X') < 0, 'screen text checked');
  say('the device holds Y\'s key now', y.key === 'KEY-Y', 'key=' + y.key);
  say('and the person who switched it is signed in', y.who === 'Y Owner', 'who=' + y.who);
  const stores = await p.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []));
  say('X\'s own store is KEPT, not wiped (its queue is money)', stores.filter((n) => /^cb-till-/.test(n)).length >= 2, JSON.stringify(stores));

  console.log('\n── ⚠️ A SERVER THAT CANNOT SAY WHICH SHOP — the old behaviour, never a new refusal ' + '─'.repeat(0));
  await p.click('[data-testid="till-usign-out"]').catch(() => {});
  await p.evaluate(() => { try { usignOut(); usignClose(); } catch (_) {} });
  await signIn('oldsrv');
  await p.waitForSelector('[data-testid="till-usign-in"]', { timeout: 10000 });
  const o = await shelf();
  say('signed in as before, on the same counter', o.who === 'Old Server' && o.key === 'KEY-Y', 'who=' + o.who + ' key=' + o.key);

  console.log('\nconsole/page errors:', errs.length ? errs.join(' | ') : 'none');
  say('no page errors', errs.length === 0, errs.length + ' error(s)');
  await b.close(); web.close(); api.close();
  console.log('\n' + (bad ? '✗ ' + bad + ' FAILED\n' : '✓ all good\n'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
