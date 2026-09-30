/* phone-signin.cjs — ⚠️⚠️ A PHONE THAT HAS NEVER BEEN PAIRED MUST BE ABLE TO SIGN IN, AS A PERSON WOULD
 *
 * Athi, 2026-10-01: *"i couldn't login at all in the mobile, it is not accepting the user id and the otp code
 * 123456. also, the empty counter application in mobile seems to be complicated."* He opened the deployed browser
 * counter (till.html) on a phone that had never been paired.
 *
 * ⭐ DRIVEN THROUGH THE SCREEN, AT PHONE SIZE — 390×844, touch, a mobile user agent, taps not clicks, the code
 * TYPED (the real server does not echo it back). The same walk is then done at desktop width, so a phone-only
 * fault shows up as a difference. Every state is photographed to e2e/shots/phone-signin-*.png.
 *
 * ⚠️⚠️ WHAT A FRESH DEVICE MEETS THAT A PAIRED ONE NEVER DOES. A browser with no key spends the sign-in on
 * POST /api/till/enrol, which claims a COUNTER NUMBER — and a fresh browser always asks for C1. On a shop whose
 * C1 is already open on the shop PC (or on the desktop counter opened from the app), the phone was offered only
 * "Leave it alone" (nobody signed in) or "Take counter C1 here" (knocks the PC off). On a shop that has no
 * counter registered at all, enrol answered "There is no counter C1 in this shop." Neither is a stage a phone
 * standing beside a working PC can pass. The stand-in ChitBridge below answers exactly as routes/counters.js
 * claim() does.
 *
 * Run: node e2e/phone-signin.cjs         (never localhost:3000, never 7351, never the live site: ports from the OS)
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const SHOTS = path.join(__dirname, 'shots');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(70) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36' };
const DESK = { viewport: { width: 1280, height: 800 } };
const KEYBOARD = 336;                    /* a phone's on-screen keyboard takes roughly this much of 844 */

/** ⭐ one stand-in ChitBridge per walk — the shop's counter register decides what enrol answers */
function standIn(reg) {
  const calls = [];
  const REG = JSON.parse(JSON.stringify(reg));     /* id → { held_by: 'Shop PC' | null } */
  const PEOPLE = { athi: { identity_id: 'ent-a', user_id: 'athi', display_name: 'Athi', identity_type: 'entity', entity_id: 'ent-a' } };
  const keyOf = {};                                /* key → counter id */
  let issued = null;
  const srv = http.createServer(async (q, r) => {
    let raw = ''; for await (const c of q) raw += c;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const j = (c2, o) => { r.writeHead(c2, Object.assign({ 'content-type': 'application/json' }, cors)); r.end(JSON.stringify(o)); };
    if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
    const u = q.url.split('?')[0];
    let b = {}; try { b = raw ? JSON.parse(raw) : {}; } catch (_) {}
    calls.push({ m: q.method, u, b });
    const bearer = String(q.headers.authorization || '').replace('Bearer ', '');
    const who = bearer === 'TOKEN-athi' ? PEOPLE.athi : null;
    if (u === '/api/entities/register') {
      const p = PEOPLE[String(b.user_id || b.email || '').trim().toLowerCase()];
      if (!p) return j(400, { error: 'Not found', message: 'Entity not found — check your name, User ID, or email address' });
      issued = p.user_id;                          /* ⚠️ like production: the code is NOT echoed back */
      return j(200, { message: 'Verification code sent to your email', email: 'a***@example.com' });
    }
    if (u === '/api/entities/verify') {
      const p = PEOPLE[String(b.user_id || '').trim().toLowerCase()];
      if (!p) return j(400, { error: 'Verification failed', message: 'That User ID is not recognised.' });
      if (issued !== p.user_id || b.otp !== '123456') return j(400, { error: 'Verification failed', message: 'Invalid or expired OTP' });
      issued = null;
      return j(200, { token: 'TOKEN-athi', identity: p });
    }
    if (u === '/api/counters' && q.method === 'GET') {
      if (!who) return j(401, { message: 'Sign in' });
      return j(200, { counters: Object.keys(REG).map((id) => ({ id, name: 'Counter ' + id, state: REG[id].held_by ? 'open' : 'closed',
        held_by: REG[id].held_by ? { name: REG[id].held_by } : null })) });
    }
    if (u === '/api/counters' && q.method === 'POST') {
      if (!who) return j(401, { message: 'Sign in' });
      const id = ['C1', 'C2', 'C3', 'C4'].find((x) => !REG[x]);
      REG[id] = { held_by: null };
      return j(201, { counter: { id, name: b.name || ('Counter ' + id), state: 'closed' } });
    }
    if (u === '/api/till/enrol') {
      if (!who) return j(403, { message: 'Sign in to connect a counter.' });
      const id = String(b.counter || 'C1').toUpperCase();
      const c = REG[id];
      if (!c) return j(404, { error: 'Not found', message: 'There is no counter ' + id + ' in this shop.' });
      if (c.held_by && !b.takeover) return j(409, { error: 'Counter already open', code: 'COUNTER_HELD',
        counter: { id, name: 'Counter ' + id, state: 'open', held_by: { name: c.held_by } }, held_by: c.held_by, seen: new Date().toISOString(),
        message: 'Counter ' + id + ' is already open on ' + c.held_by + '. Close it there first — or, if that PC is gone, take it over from here.' });
      c.held_by = 'Browser counter';
      const key = 'KEY-' + id; keyOf[key] = id;
      return j(200, { key, counter: id, took_over: !!b.takeover, shop: { entity_id: 'ent-a', bridge_id: 'CB-A', name: 'Athi Stores' } });
    }
    if (u === '/api/till/snapshot') {
      const id = keyOf[q.headers['x-api-key']];
      if (!id) return j(401, { message: 'key refused' });
      return j(200, { at: new Date().toISOString(), entity_id: 'ent-a', shop: { name: 'Athi Stores', bridge_id: 'CB-A' },
        staff: [], items: [], till: { assigned_id: id, counter: id, counter_name: 'Counter ' + id, resume_next: 1 } });
    }
    return j(200, { ok: true });
  });
  return { srv, calls, REG };
}

function webServer() {
  return http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
}

/** ⭐ is every control of the open dialog on screen and big enough to hit with a thumb? */
async function dialogFits(p) {
  return p.evaluate(() => {
    const d = Array.prototype.slice.call(document.querySelectorAll('dialog[open]')).pop();
    if (!d) return { open: false };
    const vw = window.innerWidth, vh = window.innerHeight, dr = d.getBoundingClientRect();
    const ctl = Array.prototype.slice.call(d.querySelectorAll('button,input')).filter((e) => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const out = ctl.filter((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > vw + 0.5 || r.top < 0 || r.bottom > vh + 0.5; })
      .map((e) => (e.dataset.testid || e.id || e.textContent.trim()).slice(0, 30));
    const small = ctl.filter((e) => e.getBoundingClientRect().height < 40).map((e) => (e.dataset.testid || e.id || e.textContent.trim()).slice(0, 30));
    return { open: true, id: d.id, box: [Math.round(dr.left), Math.round(dr.top), Math.round(dr.width), Math.round(dr.height)],
             out, small, hscroll: document.documentElement.scrollWidth > vw + 1, dialogScrolls: d.scrollHeight > d.clientHeight + 1 };
  });
}

/**
 * ⭐ ONE WALK, AS A PERSON: open → the sign-in door → user id → "Send me a code" → 123456 → Sign in → whatever
 * the counter asks next. `tag` names the screenshots; `reg` is the shop's counter register.
 */
async function walk(b, WEB, tag, dev, reg, opts) {
  opts = opts || {};
  const phone = !!dev.isMobile;
  const api = standIn(reg);
  await new Promise((res) => api.srv.listen(0, '127.0.0.1', res));
  const API = 'http://127.0.0.1:' + api.srv.address().port;
  const ctx = await b.newContext(dev);
  /* ⚠️ the ONLY thing planted: which ChitBridge to talk to. No key, no counter number, no person — a fresh device. */
  await ctx.addInitScript((a) => { try { if (!localStorage.getItem('cb_till_api')) localStorage.setItem('cb_till_api', a); } catch (_) {} }, API);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const shot = async (n) => { const f = 'phone-signin-' + tag + '-' + n + '.png'; await p.screenshot({ path: path.join(SHOTS, f) }); return f; };
  const tap = async (sel) => (phone ? p.tap(sel) : p.click(sel));
  const why = async () => ((await p.locator('[data-testid="till-usign-why"]').count())
    ? (await p.locator('[data-testid="till-usign-why"]').textContent()) : '');
  const res = { tag, shots: [], why: '', errs };

  await p.goto(WEB + '/till.html');
  await p.waitForFunction(() => typeof usignOpen === 'function' && typeof becomeShop === 'function', null, { timeout: 30000 });
  await p.waitForTimeout(800);
  res.shots.push(await shot('01-open'));

  /* the door a person sees: the "nobody signed in" pill at the top */
  await tap('[data-testid="till-who"]');
  await p.waitForSelector('#usigndlg[open] [data-testid="till-usign-who"]', { timeout: 10000 });
  res.fitWho = await dialogFits(p);
  res.whoAttrs = await p.evaluate(() => { const i = document.getElementById('usign_who');
    return { type: i.type, autocapitalize: i.getAttribute('autocapitalize'), autocorrect: i.getAttribute('autocorrect'),
             spellcheck: i.getAttribute('spellcheck'), inputmode: i.getAttribute('inputmode'), autocomplete: i.getAttribute('autocomplete') }; });
  res.shots.push(await shot('02-door'));
  if (phone) {
    /* the keyboard is up: the same dialog in what is left of the screen */
    await p.setViewportSize({ width: 390, height: 844 - KEYBOARD });
    await p.waitForTimeout(200);
    res.fitWhoKb = await dialogFits(p);
    res.shots.push(await shot('03-keyboard'));
  }
  await tap('[data-testid="till-usign-who"]');
  await p.keyboard.type(opts.typed || 'athi');
  await tap('[data-testid="till-usign-ask"]');
  await p.waitForSelector('[data-testid="till-usign-otp"], [data-testid="till-usign-why"]', { timeout: 10000 });
  res.shots.push(await shot('04-code'));
  if (!(await p.locator('[data-testid="till-usign-otp"]').count())) { res.why = await why(); res.stuck = 'who'; return finish(); }
  res.fitCode = await dialogFits(p);
  res.otpAttrs = await p.evaluate(() => { const i = document.getElementById('usign_otp');
    return { type: i.type, inputmode: i.getAttribute('inputmode'), autocomplete: i.getAttribute('autocomplete'), maxlength: i.getAttribute('maxlength') }; });
  await tap('[data-testid="till-usign-otp"]');
  await p.keyboard.type('123456');
  /* the keyboard goes down when Sign in is pressed */
  if (phone) await p.setViewportSize(PHONE.viewport);
  const nav = p.waitForEvent('load', { timeout: 15000 }).catch(() => null);
  await tap('[data-testid="till-usign-verify"]');
  /* either the page reloads into the shop, or the dialog stops on a stage */
  const stage = await Promise.race([
    nav.then((x) => (x ? 'reloaded' : 'no-reload')),
    p.waitForSelector('[data-testid="till-signin-takeover"], [data-testid="till-usign-why"]', { timeout: 15000 }).then(() => 'stopped').catch(() => 'nothing'),
  ]);
  res.afterVerify = stage;
  if (stage === 'stopped') {
    res.shots.push(await shot('05-stopped'));
    res.fitStopped = await dialogFits(p);
    res.why = await why();
    res.stageText = await p.evaluate(() => (document.getElementById('usignbody') || {}).innerText || '');
    if (await p.locator('[data-testid="till-usign-newcounter"]').count()) {
      /* ⭐ the way a phone beside a working PC carries on: its own counter number, the PC left alone */
      const nav2 = p.waitForEvent('load', { timeout: 15000 }).catch(() => null);
      await tap('[data-testid="till-usign-newcounter"]');
      res.afterNew = (await nav2) ? 'reloaded' : 'no-reload';
      if (res.afterNew !== 'reloaded') { res.why = await why(); res.shots.push(await shot('05b-stopped')); res.stuck = 'newcounter'; return finish(); }
    } else { res.stuck = 'stopped'; return finish(); }
  } else if (stage !== 'reloaded') { res.shots.push(await shot('05-nothing')); res.stuck = stage; return finish(); }

  /* ⭐ reloaded into the shop — now whatever the counter asks: a counter PIN to choose */
  await p.waitForFunction(() => typeof S !== 'undefined' && S && S.shop && S.shop.name === 'Athi Stores', null, { timeout: 30000 }).catch(() => {});
  await p.waitForSelector('[data-testid="till-usign-pin1"], [data-testid="till-usign-in"]', { timeout: 15000 }).catch(() => {});
  res.shots.push(await shot('06-after-reload'));
  if (await p.locator('[data-testid="till-usign-pin1"]').count()) {
    res.fitPin = await dialogFits(p);
    await tap('[data-testid="till-usign-pin1"]'); await p.keyboard.type('4826');
    await tap('[data-testid="till-usign-pin2"]'); await p.keyboard.type('4826');
    await tap('[data-testid="till-usign-pinsave"]');
    await p.waitForSelector('[data-testid="till-usign-in"]', { timeout: 15000 }).catch(() => {});
    res.shots.push(await shot('07-signed-in'));
  }
  if (await p.locator('[data-testid="till-usign-done"]').count()) await tap('[data-testid="till-usign-done"]');
  await p.waitForTimeout(600);
  res.shots.push(await shot('08-first-screen'));
  res.firstScreen = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < window.innerHeight && getComputedStyle(e).visibility !== 'hidden'; };
    return { buttons: Array.prototype.slice.call(document.querySelectorAll('button,select,input')).filter(vis)
      .map((x) => (x.textContent || x.placeholder || x.value || '').trim().slice(0, 28)).filter(Boolean),
      text: document.body.innerText.slice(0, 600) };
  });
  return finish();

  async function finish() {
    res.who = await p.evaluate(() => (typeof WHO !== 'undefined' && WHO && WHO.name) || null).catch(() => null);
    res.key = await p.evaluate(() => localStorage.getItem('cb_till_key')).catch(() => null);
    res.counter = await p.evaluate(() => localStorage.getItem('cb_till_id')).catch(() => null);
    res.header = await p.evaluate(() => (document.querySelector('header') || {}).innerText || '').catch(() => '');
    res.took = api.calls.filter((c) => c.u === '/api/till/enrol' && c.b.takeover).length;
    res.reg = api.REG;
    await ctx.close(); api.srv.close();
    return res;
  }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const web = webServer();
  await new Promise((res) => web.listen(0, '127.0.0.1', res));
  const WEB = 'http://127.0.0.1:' + web.address().port;
  const b = await chromium.launch();

  console.log('\n── ⭐ A FRESH PHONE, A SHOP WHOSE C1 IS FREE — the plain walk, and every control on screen ' + '─'.repeat(0));
  const a = await walk(b, WEB, 'free', PHONE, { C1: { held_by: null } });
  say('the sign-in dialog fits a 390 px screen, nothing off the edge', a.fitWho.open && !a.fitWho.out.length && !a.fitWho.hscroll, JSON.stringify(a.fitWho.out) + ' box=' + a.fitWho.box);
  say('with the keyboard up, the box and "Send me a code" are still on screen', !a.fitWhoKb.out.length, 'off-screen=' + JSON.stringify(a.fitWhoKb.out));
  say('every control is at least 40 px tall', !a.fitWho.small.length, JSON.stringify(a.fitWho.small));
  const wa = a.whoAttrs || {};
  say('⚠️ the user-ID box does not capitalise, correct or spell-check what is typed',
      wa.autocapitalize === 'none' && wa.autocorrect === 'off' && wa.spellcheck === 'false', JSON.stringify(wa));
  say('with the keyboard up, the code box and "Sign in" are still on screen', !!a.fitCode && !a.fitCode.out.length, a.fitCode ? 'off-screen=' + JSON.stringify(a.fitCode.out) : 'no code stage');
  say('the code box brings up the number pad and takes six digits', a.otpAttrs && a.otpAttrs.inputmode === 'numeric' && a.otpAttrs.maxlength === '6', JSON.stringify(a.otpAttrs));
  say('⭐ user id + 123456 → the phone reloads into the shop, signed in', a.who === 'Athi' && !!a.key, 'who=' + a.who + ' key=' + a.key + ' stuck=' + (a.stuck || '-') + ' "' + a.why + '"');
  say('the counter PIN step fits the phone', !a.fitPin || !a.fitPin.out.length, a.fitPin ? JSON.stringify(a.fitPin.out) : 'not offered');

  console.log('\n── the same walk at desktop width, for comparison ' + '─'.repeat(0));
  const d = await walk(b, WEB, 'desk-free', DESK, { C1: { held_by: null } });
  say('desktop: user id + 123456 → signed in', d.who === 'Athi' && !!d.key, 'who=' + d.who + ' stuck=' + (d.stuck || '-'));

  console.log('\n── ⚠️⚠️⚠️ A FRESH PHONE, C1 ALREADY OPEN ON THE SHOP PC — the phone must get in WITHOUT knocking the PC off ' + '─'.repeat(0));
  const h = await walk(b, WEB, 'held', PHONE, { C1: { held_by: 'Shop PC' } });
  console.log('     stage after the code: ' + h.afterVerify + ' · "' + String(h.stageText || '').replace(/\s+/g, ' ').slice(0, 160) + '"');
  say('⭐⭐ the phone is signed in', h.who === 'Athi' && !!h.key, 'who=' + h.who + ' key=' + h.key + ' stuck=' + (h.stuck || '-'));
  say('⚠️ on a counter number of its own, not C1', !!h.counter && h.counter !== 'C1', 'counter=' + h.counter);
  say('⚠️ and the shop PC still holds C1 — nothing was taken over', h.took === 0 && h.reg.C1.held_by === 'Shop PC', 'takeovers=' + h.took + ' C1=' + h.reg.C1.held_by);
  say('the held stage fits the phone', !h.fitStopped || !h.fitStopped.out.length, h.fitStopped ? JSON.stringify(h.fitStopped.out) : '-');
  /* ⚠️ NOT ASSERTED, SAID: the header pill shows cb_till_name, which defaults to "Counter 1" on every fresh browser
     whatever number it holds — a naming question for Athi, not part of this fix */
  console.log('     (header pill on the C2 phone reads: ' + JSON.stringify(String(h.header || '').split('\n')[1] || '') + ')');
  const dh = await walk(b, WEB, 'desk-held', DESK, { C1: { held_by: 'Shop PC' } });
  say('desktop, same shop: the same answer (a fresh browser is a fresh browser)', dh.who === h.who, 'desk who=' + dh.who + ' stuck=' + (dh.stuck || '-'));

  console.log('\n── ⚠️⚠️ A FRESH PHONE, A SHOP WITH NO COUNTER REGISTERED YET ' + '─'.repeat(0));
  const n = await walk(b, WEB, 'nocounter', PHONE, {});
  console.log('     stage after the code: ' + n.afterVerify + ' · "' + n.why + '"');
  say('⭐⭐ the phone is signed in, on a counter the shop now has', n.who === 'Athi' && !!n.key && Object.keys(n.reg).length === 1, 'who=' + n.who + ' reg=' + JSON.stringify(n.reg) + ' stuck=' + (n.stuck || '-'));

  console.log('\n── the first screen of an EMPTY shop, at phone size (for the design note) ' + '─'.repeat(0));
  console.log('     ' + (a.shots.filter((s) => /08-first/.test(s))[0] || '-') + ' · on screen: ' + JSON.stringify((a.firstScreen || {}).buttons || []));

  const errs = [].concat(a.errs, d.errs, h.errs, dh.errs, n.errs);
  console.log('\nshots: e2e/shots/phone-signin-*.png (' + [a, d, h, dh, n].reduce((s, r) => s + r.shots.length, 0) + ')');
  say('no page errors', errs.length === 0, errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  await b.close(); web.close();
  console.log('\n' + (bad ? '✗ ' + bad + ' FAILED\n' : '✓ all good\n'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
