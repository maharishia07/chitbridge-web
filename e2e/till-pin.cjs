/* till-pin.cjs — ⭐⭐⭐ G2: THE COUNTER PIN SIGNS A PERSON IN WITH THE LINE DOWN, AND A NAME ALONE SIGNS NOBODY IN
 *
 * Athi, 2026-09-28: *"PIN should work offline."* And, on the name picker: *"is there multiple entry path? different
 * piece of code allowing the application to sign-in?"* — there were two, and the picker asked for no proof at all.
 * [SPEC-counter-identity.md §2–3]
 *
 * ⭐ DRIVEN THROUGH THE DIALOG'S OWN CONTROLS, with the browser really offline (navigator.onLine false) for the
 * offline half, against a stand-in ChitBridge that COUNTS its sign-in calls — so "no network" is measured, not
 * assumed. [[feedback-shoot-the-screen-not-the-dom]]
 *
 * Run: node e2e/till-pin.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const SHOTS = path.join(__dirname, '..', 'test-results', 'till-pin');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(68) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const web = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  const calls = { register: 0, verify: 0 };
  const api = http.createServer(async (q, r) => {
    let raw = ''; for await (const c of q) raw += c;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const j = (c2, o) => { r.writeHead(c2, Object.assign({ 'content-type': 'application/json' }, cors)); r.end(JSON.stringify(o)); };
    if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
    const u = q.url.split('?')[0];
    const b = raw ? JSON.parse(raw) : {};
    if (u === '/api/entities/register') { calls.register++; return j(200, { message: 'sent', dev_otp: '123456' }); }
    if (u === '/api/entities/verify') {
      calls.verify++;
      if (b.user_id !== 'xclerk') return j(404, { message: 'not found' });
      return j(200, { token: 'TOKEN-x', identity: { identity_id: 'p-x', bridge_id: 'CB-P', display_name: 'X Clerk',
                      user_id: 'xclerk', identity_type: 'actor', entity_id: 'ent-x' } });
    }
    if (u === '/api/till/snapshot') {
      if (q.headers['x-api-key'] !== 'KEY-X') return j(401, { message: 'key refused' });
      return j(200, { at: new Date().toISOString(), entity_id: 'ent-x', shop: { name: 'Shop X', bridge_id: 'CB-X' },
        staff: [{ id: 'p-x', name: 'X Clerk', hat: 'cashier' }, { id: 'p-z', name: 'Zed New', hat: 'cashier' }],
        items: [{ id: 'xmango', name: 'XMANGO', price: 50, unit: 'nos', code: 'XMANGO' }] });
    }
    return j(200, { ok: true });
  });
  await new Promise((res) => web.listen(0, '127.0.0.1', res));
  await new Promise((res) => api.listen(0, '127.0.0.1', res));
  const API = 'http://127.0.0.1:' + api.address().port;

  const b = await chromium.launch();
  const ctx = await b.newContext();
  await ctx.addInitScript((a) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('cb_till_api', a); localStorage.setItem('cb_till_key', 'KEY-X');
  }, API);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const who = () => p.evaluate(() => (typeof WHO !== 'undefined' && WHO && WHO.name) || null);
  const why = () => p.locator('[data-testid="till-usign-why"]').textContent().catch(() => '');
  const out = async () => { await p.evaluate(() => { try { usignOut(); usignClose(); } catch (_) {} }); };
  const typeWho = async (id) => {
    await p.evaluate(() => usignOpen());
    await p.fill('[data-testid="till-usign-who"]', id);
    await p.click('[data-testid="till-usign-ask"]');
  };
  const pin = async (v) => { await p.fill('[data-testid="till-usign-otp"]', v); await p.click('[data-testid="till-usign-verify"]'); };

  await p.goto('http://127.0.0.1:' + web.address().port + '/till.html');
  await p.waitForFunction(() => typeof usignOpen === 'function' && typeof pinBook === 'function', null, { timeout: 30000 });
  await p.evaluate(() => refresh().catch(function(){}));
  await p.waitForFunction(() => S && S.shop && S.shop.name === 'Shop X', null, { timeout: 30000 });

  console.log('\n── ⭐ ONLINE: a real sign-in, then the counter PIN is offered and SET ' + '─'.repeat(0));
  await typeWho('xclerk');
  await p.waitForSelector('[data-testid="till-usign-otp"]');
  await p.click('[data-testid="till-usign-verify"]');
  await p.waitForSelector('[data-testid="till-usign-pin1"]', { timeout: 10000 });
  say('after a real sign-in, a counter PIN is offered', true, 'the "Choose a counter PIN" step is on screen');
  await p.fill('[data-testid="till-usign-pin1"]', '1234');
  await p.fill('[data-testid="till-usign-pin2"]', '1234');
  await p.click('[data-testid="till-usign-pinsave"]');
  say('a run (1234) is refused', /too easy/i.test(await why()), '"' + (await why()) + '"');
  await p.fill('[data-testid="till-usign-pin1"]', '4826');
  await p.fill('[data-testid="till-usign-pin2"]', '4862');
  await p.click('[data-testid="till-usign-pinsave"]');
  say('two different typings are refused', /different/i.test(await why()), '"' + (await why()) + '"');
  await p.fill('[data-testid="till-usign-pin1"]', '4826');
  await p.fill('[data-testid="till-usign-pin2"]', '4826');
  await p.click('[data-testid="till-usign-pinsave"]');
  await p.waitForSelector('[data-testid="till-usign-in"]', { timeout: 10000 });
  const stored = await p.evaluate(() => localStorage.getItem(shopLs('cb_till_pins')) || '');
  say('⚠️ what is kept is a salt and a hash — the PIN itself appears nowhere', /"salt"/.test(stored) && /"hash"/.test(stored) && stored.indexOf('4826') < 0, stored.length + ' chars');
  say('under the SHOP\'s own slot, not the device', await p.evaluate(() => shopLs('cb_till_pins') !== 'cb_till_pins' && !localStorage.getItem('cb_till_pins')), 'key=' + await p.evaluate(() => shopLs('cb_till_pins')));
  await out();

  console.log('\n── ⭐⭐⭐ OFFLINE: the same person signs in with the counter PIN — and nothing reaches the network ' + '─'.repeat(0));
  await ctx.setOffline(true);
  const before = calls.register + calls.verify;
  say('the page knows the line is down', await p.evaluate(() => !lineUp()), 'lineUp()=false');
  await typeWho('xclerk');
  await p.waitForSelector('[data-testid="till-usign-otp"]', { timeout: 10000 });
  await pin('9173');
  await p.waitForSelector('[data-testid="till-usign-why"]');
  say('a wrong PIN is refused, and says how many tries are left', /4 tries left/.test(await why()), '"' + (await why()) + '"');
  await pin('4826');
  await p.waitForSelector('[data-testid="till-usign-in"]', { timeout: 10000 });
  await p.screenshot({ path: path.join(SHOTS, '1-offline-in.png') });
  say('⭐⭐ the right PIN signs X Clerk in WITH THE LINE DOWN', (await who()) === 'X Clerk', 'who=' + (await who()));
  say('⚠️ and not one sign-in call left the counter', calls.register + calls.verify === before, 'calls before/after=' + before + '/' + (calls.register + calls.verify));
  await out();

  console.log('\n── ⚠️ OFFLINE, somebody with no counter PIN here — refused in words, never waved through ' + '─'.repeat(0));
  await typeWho('zed');
  await p.waitForSelector('[data-testid="till-usign-why"]');
  say('no PIN on this counter + no line = nobody signed in, and it says why', /no counter PIN/i.test(await why()) && (await who()) === null, '"' + (await why()) + '"');
  await p.evaluate(() => usignClose());

  console.log('\n── ⚠️⚠️ THE PICKER: tapping a name asks for that person\'s PIN; a name alone signs nobody in ' + '─'.repeat(0));
  await p.evaluate(() => openWho());
  await p.click('[data-testid="till-who-p-x"]');
  await p.waitForSelector('[data-testid="till-usign-otp"]', { timeout: 10000 });
  say('tapping X Clerk opens the PIN box, not a signed-in counter', (await who()) === null, 'who=' + (await who()));
  await pin('4826');
  await p.waitForSelector('#askdlg[open]', { timeout: 10000 });
  await p.fill('#askinput', '500');
  await p.click('#askok');
  await p.waitForFunction(() => WHO && WHO.name === 'X Clerk', null, { timeout: 10000 });
  say('after the PIN, the drawer is asked and recorded', await p.evaluate(() => WHO.float === 500), 'float=' + await p.evaluate(() => WHO.float));
  await out();
  await p.evaluate(() => openWho());
  await p.click('[data-testid="till-who-p-z"]');
  await p.waitForSelector('[data-testid="till-usign-why"]', { timeout: 10000 });
  say('⚠️ tapping somebody with no PIN here (offline) signs NOBODY in', (await who()) === null && /no counter PIN/i.test(await why()), '"' + (await why()) + '"');
  await p.evaluate(() => usignClose());

  console.log('\n── ⚠️⚠️ FIVE WRONG AND THE PIN STOPS — a right one after that is still refused ' + '─'.repeat(0));
  await typeWho('xclerk');
  await p.waitForSelector('[data-testid="till-usign-otp"]');
  /* wait on the COUNT, not on a refusal already on screen — the dialog repaints under the next typing */
  for (let i = 0; i < 5; i++) {
    const was = await p.evaluate(() => (pinBook().xclerk || {}).tries || 0);
    await pin('9' + (170 + i));
    await p.waitForFunction((w) => ((pinBook().xclerk || {}).tries || 0) > w || (pinBook().xclerk || {}).tries >= 5, was, { timeout: 10000 });
    if (i < 4) await p.waitForSelector('[data-testid="till-usign-otp"]');
  }
  await p.waitForFunction(() => /Too many/.test((document.querySelector('[data-testid="till-usign-why"]') || {}).textContent || ''), null, { timeout: 10000 });
  const locked = await why();
  say('the fifth wrong PIN locks it, and says the way back', /Too many wrong PINs/i.test(locked) && /internet/i.test(locked), '"' + locked + '"');
  await p.evaluate(() => usignClose());
  await typeWho('xclerk');
  await p.waitForSelector('[data-testid="till-usign-why"]');
  say('the right PIN no longer opens the counter', (await who()) === null && /Too many/i.test(await why()), '"' + (await why()) + '"');
  await p.evaluate(() => usignClose());

  console.log('\n── ⭐ BACK ONLINE: a real sign-in, and a new PIN, is the way back ' + '─'.repeat(0));
  await ctx.setOffline(false);
  await p.waitForFunction(() => lineUp(), null, { timeout: 10000 });
  await typeWho('xclerk');
  await p.waitForSelector('[data-testid="till-usign-otp"]');
  await p.click('[data-testid="till-usign-verify"]');
  await p.waitForSelector('[data-testid="till-usign-pin1"]', { timeout: 10000 });
  say('a locked PIN is offered again after the online sign-in', true, 'the choose-a-PIN step is back');
  await p.fill('[data-testid="till-usign-pin1"]', '7394');
  await p.fill('[data-testid="till-usign-pin2"]', '7394');
  await p.click('[data-testid="till-usign-pinsave"]');
  await p.waitForSelector('[data-testid="till-usign-in"]');
  await out();
  await ctx.setOffline(true);
  await typeWho('xclerk');
  await p.waitForSelector('[data-testid="till-usign-otp"]');
  await pin('7394');
  await p.waitForSelector('[data-testid="till-usign-in"]', { timeout: 10000 });
  say('and the new PIN works offline straight away', (await who()) === 'X Clerk', 'who=' + (await who()));

  console.log('\nconsole/page errors:', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  say('no page errors', errs.length === 0, errs.length + ' error(s)');
  await b.close(); web.close(); api.close();
  console.log('\n' + (bad ? '✗ ' + bad + ' FAILED\n' : '✓ all good\n'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
