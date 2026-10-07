/* person-signin.cjs — ⭐⭐⭐ M08 · A PHONE IS A PERSON ON A DEVICE (MASTER-BUILD row 47 · SPEC-iam-build PR 8 · DESIGN-person-signin)
 *
 * DECIDED (2026-10 cycle): *"A phone is a person session (ID + PIN), not a device key."* Until M08 a browser counter spent
 * its sign-in on POST /api/till/enrol, became "Counter C1" (the shop PC's number), and the PC's next sign-in closed it —
 * the ping-pong behind Athi's phone showing "Due to maintenance" with its bills stuck (DESIGN §1.1).
 *
 * Driven through the screen at phone size (390×844, touch, typed code), against a stand-in ChitBridge that answers
 * /api/signin/ask·verify, /api/till/snapshot and /api/chits/send exactly as the M05/M06 server does (a listed session
 * bound to X-Device-Id; a key keeps working). Every state is photographed to e2e/shots/person-signin-*.png.
 *
 *   T0  ⚠️⚠️ A PHONE THAT ALREADY HOLDS A KEY (Athi's own phone, with UNSENT bills in its key store): after the M08 page
 *       loads, the same store is read, its bills are still listed, and they still go. Nothing moved, renamed or cleared.
 *   T1  a fresh phone signs in as a PERSON: no POST /api/till/enrol, no /api/counters, no key; a 30-day session bound to
 *       this device; the store is per shop + device.
 *   T2  the shop PC opens C1 while the phone bills 3 times: the phone never sees a 401, never hears COUNTER_HELD, its
 *       prefix is not C1, and the 3 bills land once (a second drain adds nothing).
 *   T3  a PC takes C1 over from another PC: the phone is untouched — same session, next bill lands.
 *   T4  words per code: SESSION_EXPIRED → "Sign in to send 1 bill" (never "maintenance"); signing in again keeps the queue
 *       and the same client_ref; DEVICE_REVOKED → "The shop removed this phone" + what is kept.
 *   T5  the page's own version check reloads ONCE and clears nothing — bills, session and device id survive.
 *
 * Run: node e2e/person-signin.cjs         (ports from the OS; never localhost:3000, never the live site)
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', 'public');
const SHOTS = path.join(__dirname, 'shots');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(74) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'en-IN',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36' };
const TEA = { item_id: 't1', name: 'Tea', code: 'T1', category: 'Drinks', unit: 'cup', price: 15 };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
/** djb2 of the key, base 36 — exactly tillStore()'s name for a KEY store (the one Athi's phone holds today) */
const keyStore = (k) => { let h = 5381; for (let i = 0; i < k.length; i++) h = (((h * 33) ^ k.charCodeAt(i)) >>> 0); return 'cb-till-' + h.toString(36); };

/**
 * ⭐ THE STAND-IN CHITBRIDGE. A person session is a token that names its jti + device; the server honours it only while
 * the jti is listed and X-Device-Id matches (M05). A key (KEY-OLD) is honoured as today. The shop PC's claims change
 * REG and close PC keys — a phone holds no key, so there is nothing of hers to close.
 */
function standIn() {
  const calls = [], chits = [], sessions = {}, devices = {};
  const REG = { C1: { held_by: 'Shop PC', key: 'KEY-PC' } };
  const KEYS = { 'KEY-OLD': { counter: 'C2', closed: false }, 'KEY-PC': { counter: 'C1', closed: false } };
  const PEOPLE = { athi: { identity_id: 'ent-a', user_id: 'athi', display_name: 'Athi', identity_type: 'entity', entity_id: 'ent-a', bridge_id: 'CB-A' } };
  let issued = null;
  const snap = (till) => ({ at: new Date().toISOString(), entity_id: 'ent-a', shop: { name: 'Athi Stores', bridge_id: 'CB-A', currency: 'INR' },
    staff: [], items: [TEA], offers: [], till });
  const srv = http.createServer(async (q, r) => {
    let raw = ''; for await (const c of q) raw += c;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const u = q.url.split('?')[0];
    let b = {}; try { b = raw ? JSON.parse(raw) : {}; } catch (_) {}
    const rec = { m: q.method, u, b, dev: q.headers['x-device-id'] || null,
                  auth: q.headers.authorization ? 'bearer' : (q.headers['x-api-key'] ? 'key' : null), status: 0, code: null };
    const j = (c2, o) => { rec.status = c2; rec.code = (o && o.code) || null; r.writeHead(c2, Object.assign({ 'content-type': 'application/json' }, cors)); r.end(JSON.stringify(o)); };
    if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
    calls.push(rec);
    /* who is calling — a key, or a person session (verified like middleware/auth.js does) */
    const who = (() => {
      const key = q.headers['x-api-key'];
      if (key) { const k = KEYS[key]; if (!k) return { err: [401, { error: 'Unauthorised', message: 'API key revoked or unknown' }] };
                 if (k.closed) return { err: [401, { error: 'Unauthorised', code: 'COUNTER_CLOSED', message: 'closed' }] }; return { key, counter: k.counter }; }
      const tok = String(q.headers.authorization || '').replace(/^Bearer /, '');
      if (!tok) return null;
      let p = null; try { p = JSON.parse(Buffer.from(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); } catch (_) {}
      if (!p || !p.jti) return { err: [401, { error: 'Unauthorised', message: 'bad token' }] };
      if (String(q.headers['x-device-id'] || '') !== String(p.device_id)) return { err: [401, { error: 'Unauthorised', code: 'DEVICE_MISMATCH', message: 'This sign-in belongs to another device. Sign in on this one.' }] };
      if (devices[p.device_id] && devices[p.device_id].revoked_at) return { err: [401, { error: 'Unauthorised', code: 'DEVICE_REVOKED', message: 'The shop removed this device. Your bills are kept here; ask the owner.' }] };
      if (!sessions[p.jti]) return { err: [401, { error: 'Unauthorised', code: 'SESSION_EXPIRED', message: 'Sign in to continue.' }] };
      return { person: p };
    })();
    if (u === '/api/signin/ask' || u === '/api/entities/register') {
      const p = PEOPLE[String(b.user_id || b.email || b.id || '').trim().toLowerCase()];
      if (!p) return j(404, { error: 'Not found', code: 'NO_ACCOUNT', message: 'That user ID is not known here.' });
      issued = p.user_id;                                   /* ⚠️ like production: the code is NOT echoed back */
      return j(200, { message: 'Verification code sent to your email', email: 'a***@example.com' });
    }
    if (u === '/api/signin/verify' || u === '/api/entities/verify') {
      const p = PEOPLE[String(b.user_id || b.email || b.id || '').trim().toLowerCase()];
      if (!p) return j(400, { error: 'Verification failed', message: 'That User ID is not recognised.' });
      if (issued !== p.user_id || b.otp !== '123456') return j(400, { error: 'Verification failed', message: 'Invalid or expired OTP' });
      issued = null;
      const device_id = b.device_id || q.headers['x-device-id'] || null;
      const now = Math.floor(Date.now() / 1000);
      let token;
      if (device_id) {                                       /* M05: a page that names its device gets a LISTED session */
        if (devices[device_id] && devices[device_id].revoked_at) return j(401, { error: 'Unauthorised', code: 'DEVICE_REVOKED', message: 'The shop removed this device.' });
        const jti = crypto.randomUUID(), surface = b.surface || 'web';
        sessions[jti] = { device_id, surface, by: p.identity_id, iat: now, exp: now + (surface === 'till' ? 30 : 7) * 86400 };
        devices[device_id] = devices[device_id] || { first_seen: now, revoked_at: null, sessions: [] };
        devices[device_id].sessions.push(jti);
        token = b64u({ alg: 'none' }) + '.' + b64u({ identity_id: p.identity_id, identity_type: 'entity', display_name: p.display_name, bridge_id: p.bridge_id,
                  kind: 'person', jti, device_id, surface, iat: now, exp: sessions[jti].exp }) + '.sig';
      } else token = b64u({ alg: 'none' }) + '.' + b64u({ identity_id: p.identity_id, identity_type: 'entity', iat: now, exp: now + 7 * 86400 }) + '.sig';
      return j(200, { message: 'Verified successfully', token, entity: { identity_id: p.identity_id, bridge_id: p.bridge_id, display_name: p.display_name },
        identity: { identity_id: p.identity_id, user_id: p.user_id, display_name: p.display_name, identity_type: 'entity', entity_id: p.entity_id, bridge_id: p.bridge_id } });
    }
    /* ⚠️ a phone must never reach these — they are the counter-claim doors (the shop PC's) — but if it does, answer as the server would */
    if (u === '/api/till/enrol') { rec.code = 'ENROL'; return j(409, { error: 'Counter already open', code: 'COUNTER_HELD', counter: { id: 'C1', held_by: { name: 'Shop PC' } } }); }
    if (u.indexOf('/api/counters') === 0) return j(200, { counters: Object.keys(REG).map((id) => ({ id, state: REG[id].held_by ? 'open' : 'closed' })) });
    if (!who) return j(401, { error: 'Unauthorised', message: 'No token' });
    if (who.err) return j(who.err[0], who.err[1]);
    if (u === '/api/till/snapshot')
      return j(200, snap(who.key ? { assigned_id: who.counter, counter: who.counter, counter_name: 'Counter ' + who.counter.slice(1), resume_next: 1 } : null));
    if (u === '/api/till/verify') return j(200, { ok: true, shop: 'Athi Stores' });
    if (u === '/api/chits/send') {
      const ref = b.client_ref || null;
      const dup = chits.find((c) => c.client_ref === ref);
      if (dup) return j(200, { ok: true, chit_id: dup.chit_id, duplicate: true, client_ref: ref });
      const chit_id = 'chit-' + (chits.length + 1);
      chits.push({ chit_id, client_ref: ref, till: (b.business_json && b.business_json.till) || null, by: who.person ? who.person.identity_id : 'key', at: Date.now() });
      return j(201, { ok: true, chit_id, client_ref: ref });
    }
    if (u === '/api/till/bills') return j(200, { bills: [] });
    if (u === '/api/till/tasks') return j(200, { tasks: [] });
    if (u === '/api/events/ticket') return j(200, { ticket: null });
    return j(200, { ok: true });
  });
  /* what the shop PC does to the register — a phone never calls these; they happen beside it */
  const pcClaim = (id, from, takeover) => { const c = REG[id] || (REG[id] = {}); if (c.key && takeover) KEYS[c.key].closed = true; c.held_by = from; c.key = 'KEY-' + from.replace(/\s+/g, '').toUpperCase(); KEYS[c.key] = { counter: id, closed: false }; };
  return { srv, calls, chits, sessions, devices, REG, KEYS, pcClaim,
           revokeSession: (jti) => { delete sessions[jti]; }, revokeDevice: (d) => { (devices[d] = devices[d] || { sessions: [] }).revoked_at = Date.now(); } };
}

function webServer(flag) {
  return http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    if (rel === 'engine/versions.json' && flag.laterPage) {        /* T5: the server has a NEWER page than the one running */
      const j = JSON.parse(fs.readFileSync(f, 'utf8')); j.page = 'later-than-this';
      r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return r.end(JSON.stringify(j));
    }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
}

/** ring one bill through the screen: Tea → Pay → Cash. Returns once the page has a new last bill. */
async function ringBill(p) {
  const before = await p.evaluate(async () => ((await DB.all('bills')) || []).length);
  /* a phone sells in steps — Pick first, where the shelf and the search box are */
  await p.evaluate(() => { try { usignClose(); } catch (_) {} });
  if (await p.locator('[data-testid="till-step-pick"]').count()) await p.tap('[data-testid="till-step-pick"]');
  await p.waitForSelector('#q', { state: 'visible', timeout: 10000 });
  await p.fill('#q', 'Tea');
  await p.waitForSelector('[data-testid="till-hit-0"][data-item="t1"]', { timeout: 10000 });
  await p.tap('[data-testid="till-add-0"]');
  await p.tap('[data-testid="till-step-pay"]');
  await p.tap('[data-testid="till-pay-cash"]');
  await p.tap('#save');                                           /* Save & print · F9 — the bill is written here */
  await p.waitForFunction(async (n) => ((await DB.all('bills')) || []).length > n, before, { timeout: 15000 });
  await p.waitForTimeout(300);
  await p.evaluate(() => { Array.prototype.slice.call(document.querySelectorAll('dialog[open]')).forEach(function(d){ try { d.close(); } catch (_) {} }); });
}
/** the stand-in's chit count, once it stops moving (drain is asynchronous on the page) */
async function settle(api, want, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 12000)) { if (api.chits.length >= want) break; await new Promise((r) => setTimeout(r, 200)); }
  return api.chits.length;
}
/** the real dialog, as a person: user id → Send me a code → 123456 → Sign in */
async function signIn(p, who) {
  if (!(await p.locator('#usigndlg[open]').count())) await p.tap('[data-testid="till-who"]');
  await p.waitForSelector('#usigndlg[open] [data-testid="till-usign-who"]', { timeout: 10000 });
  await p.fill('[data-testid="till-usign-who"]', who);
  await p.tap('[data-testid="till-usign-ask"]');
  await p.waitForSelector('[data-testid="till-usign-otp"], [data-testid="till-usign-why"]', { timeout: 10000 });
  await p.fill('[data-testid="till-usign-otp"]', '123456');
  await p.tap('[data-testid="till-usign-verify"]');
}
/** after a sign-in: choose a counter PIN if offered, then Done */
async function afterIn(p, pin) {
  await p.waitForSelector('[data-testid="till-usign-pin1"], [data-testid="till-usign-in"], [data-testid="till-usign-why"]', { timeout: 20000 }).catch(() => {});
  if (await p.locator('[data-testid="till-usign-pin1"]').count()) {
    if (pin) { await p.fill('[data-testid="till-usign-pin1"]', pin); await p.fill('[data-testid="till-usign-pin2"]', pin); await p.tap('[data-testid="till-usign-pinsave"]'); }
    else await p.tap('[data-testid="till-usign-pinlater"]');
    await p.waitForSelector('[data-testid="till-usign-in"]', { timeout: 10000 }).catch(() => {});
  }
  if (await p.locator('[data-testid="till-usign-done"]').count()) await p.tap('[data-testid="till-usign-done"]');
  await p.waitForTimeout(300);
}
const facts = (p) => p.evaluate(async () => ({
  who: (typeof WHO !== 'undefined' && WHO && WHO.name) || null,
  key: localStorage.getItem('cb_till_key'),
  person: (function(){ try { return JSON.parse(localStorage.getItem('cb_till_person') || 'null'); } catch (_) { return null; } })(),
  device: localStorage.getItem('cb_device_id'),
  store: tillStore(), prefix: tillId(), shop: (S && S.shop && S.shop.name) || null,
  bills: ((await DB.all('bills')) || []).length, queue: ((await DB.all('queue')) || []).length,
  given: ls.get(tillGivenKey(), ''), flash: ((document.getElementById('flash') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
  keyOk: typeof KEY_OK !== 'undefined' ? KEY_OK : null, build: typeof TILL_BUILD !== 'undefined' ? TILL_BUILD : null,
}));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const flag = { laterPage: false };
  const web = webServer(flag);
  await new Promise((res) => web.listen(0, '127.0.0.1', res));
  const WEB = 'http://127.0.0.1:' + web.address().port;
  const api = standIn();
  await new Promise((res) => api.srv.listen(0, '127.0.0.1', res));
  const API = 'http://127.0.0.1:' + api.srv.address().port;
  const b = await chromium.launch();
  const errs = [];
  const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, 'person-signin-' + n + '.png') });

  /* ── T0 ───────────────────────────────────────────────────────────────────────────────────────────────────── */
  console.log('\n── T0 ⚠️⚠️ A PHONE THAT ALREADY HOLDS A KEY, WITH UNSENT BILLS — the M08 page must read the same store, list them, send them');
  {
    const ctx = await b.newContext(PHONE);
    await ctx.addInitScript((a) => { try { if (!localStorage.getItem('cb_till_api')) { localStorage.setItem('cb_till_api', a); localStorage.setItem('cb_till_key', 'KEY-OLD'); } } catch (_) {} }, API);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push('T0 ' + e));
    await p.goto(WEB + '/till.html');
    await p.waitForFunction(() => typeof usignOpen === 'function' && S && S.shop && S.shop.name === 'Athi Stores', null, { timeout: 30000 });
    const k0 = await facts(p);
    say('the keyed phone opens its shop by its KEY, in the key-named store', k0.key === 'KEY-OLD' && k0.store === keyStore('KEY-OLD') && !k0.person, 'store=' + k0.store + ' person=' + JSON.stringify(k0.person));
    /* a routine sign-in on a working keyed phone: identity only — no session kept, the store does not move */
    await signIn(p, 'athi'); await afterIn(p, null);
    const k1 = await facts(p);
    say('a routine sign-in on it keeps NO session and does not move the store', k1.who === 'Athi' && !k1.person && k1.store === k0.store && k1.key === 'KEY-OLD', 'who=' + k1.who + ' store=' + k1.store);
    const callsBefore = api.calls.length;
    await ctx.setOffline(true);
    await ringBill(p); await ringBill(p);
    const k2 = await facts(p);
    say('two bills taken with the line down sit in the key store\'s queue', k2.bills === 2 && k2.queue === 2 && k2.prefix === 'C2', 'bills=' + k2.bills + ' queue=' + k2.queue + ' prefix=' + k2.prefix);
    await shot(p, 't0-queued');
    /* ⭐ THE M08 PAGE LOADS AGAIN over that store (same page, same code — exactly what a deploy does to Athi's phone) */
    await ctx.setOffline(false);
    await p.reload();
    await p.waitForFunction(() => typeof usignOpen === 'function' && S && S.shop && S.shop.name === 'Athi Stores', null, { timeout: 30000 });
    const k3 = await facts(p);
    /* (the line is back, so load() may already have started sending — the queue is 2 or fewer, never more, never re-stamped) */
    say('⭐⭐⭐ after the reload the SAME key store is read: both bills still listed, still queued/sending', k3.store === keyStore('KEY-OLD') && k3.bills === 2 && k3.queue <= 2 && !k3.person, 'store=' + k3.store + ' bills=' + k3.bills + ' queue=' + k3.queue);
    await p.evaluate(() => HOST.drain());
    const landed = await settle(api, 2);
    const k4 = await facts(p);
    say('⭐⭐⭐ and they still go — under the key, once each', landed === 2 && k4.queue === 0 && api.chits.every((c) => c.by === 'key' && /^C2\//.test(c.client_ref)), 'landed=' + landed + ' queue=' + k4.queue + ' refs=' + api.chits.map((c) => c.client_ref).join(','));
    const t0calls = api.calls.slice(callsBefore);
    say('every call the keyed phone made was signed with its KEY (the key path is byte-for-byte as before)', t0calls.filter((c) => c.u.indexOf('/api/till') === 0 || c.u === '/api/chits/send').every((c) => c.auth === 'key'), t0calls.map((c) => c.auth + ':' + c.u).filter((x, i, a) => a.indexOf(x) === i).join(' '));
    say('no sign-in session was asked for and no enrol happened', !api.calls.some((c) => c.u === '/api/till/enrol' || c.u.indexOf('/api/counters') === 0), api.calls.filter((c) => c.u.indexOf('/api/till') < 0).map((c) => c.u).join(' '));
    await shot(p, 't0-sent');
    await ctx.close();
  }
  const chitsAfterT0 = api.chits.length;

  /* ── T1 ───────────────────────────────────────────────────────────────────────────────────────────────────── */
  console.log('\n── T1 ⭐⭐⭐ A FRESH PHONE SIGNS IN AS A PERSON — no key, no counter claimed, a session bound to this device');
  const ctx = await b.newContext(PHONE);
  await ctx.addInitScript((a) => { try { if (!localStorage.getItem('cb_till_api')) localStorage.setItem('cb_till_api', a); } catch (_) {} }, API);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push('T1+ ' + e));
  let loads = 0; p.on('load', () => loads++);
  await p.goto(WEB + '/till.html');
  await p.waitForFunction(() => typeof usignOpen === 'function' && typeof becomeShop === 'function', null, { timeout: 30000 });
  await p.waitForTimeout(500);
  const f0 = await facts(p);
  await shot(p, 't1-fresh');
  const stop0 = await p.evaluate(() => (shopReady().stops[0] || {}));
  say('a fresh phone says "nobody has signed in", never "maintenance" and never "key"', /signed in/i.test(stop0.why || '') && !/maintenance|key/i.test((stop0.why || '') + (stop0.means || '')), JSON.stringify(stop0.why));
  const callsT1 = api.calls.length;
  await signIn(p, 'athi');
  await p.waitForFunction(() => typeof S !== 'undefined' && S && S.shop && S.shop.name === 'Athi Stores', null, { timeout: 30000 }).catch(() => {});
  await afterIn(p, '4826');
  await shot(p, 't1-signed-in');
  const f1 = await facts(p);
  const verifyCall = api.calls.slice(callsT1).find((c) => c.u === '/api/signin/verify');
  say('⭐ user id + 123456 → the phone reloads into the shop, signed in', f1.who === 'Athi' && f1.shop === 'Athi Stores', 'who=' + f1.who + ' shop=' + f1.shop + ' loads=' + loads);
  say('⭐⭐⭐ no POST /api/till/enrol, no /api/counters — a phone claims no counter', !api.calls.some((c) => c.u === '/api/till/enrol' || c.u.indexOf('/api/counters') === 0), api.calls.slice(callsT1).map((c) => c.u).filter((x, i, a) => a.indexOf(x) === i).join(' '));
  say('⭐⭐ no key on the phone; a person session is kept instead, naming its shop', f1.key === null && f1.person && f1.person.entity_id === 'ent-a' && f1.person.by === 'athi' && !!f1.person.jti, 'key=' + f1.key + ' person=' + JSON.stringify(f1.person && { entity_id: f1.person.entity_id, by: f1.person.by }));
  say('the sign-in named this device and the surface (a 30-day listed session, D3)', verifyCall && verifyCall.b.device_id === f1.device && verifyCall.b.surface === 'till' && verifyCall.dev === f1.device && api.sessions[f1.person.jti] && api.sessions[f1.person.jti].exp - api.sessions[f1.person.jti].iat === 30 * 86400, JSON.stringify(verifyCall && { device_id: verifyCall.b.device_id, surface: verifyCall.b.surface }));
  say('the device id was made once (at the first cloud call), device-wide, and is the same after the reload', !!f1.device && verifyCall && verifyCall.b.device_id === f1.device && f1.device === f1.person.device_id && (f0.device === null || f0.device === f1.device), f1.device);
  say('⭐⭐ the store is per SHOP + DEVICE (never per token)', f1.store === 'cb-till-ent-a-' + String(f1.device).replace(/[^A-Za-z0-9_-]/g, ''), f1.store);
  const snaps = api.calls.filter((c) => c.u === '/api/till/snapshot' && c.auth === 'bearer');
  say('the snapshot was read with the session as Bearer + X-Device-Id (no key header)', snaps.length >= 1 && snaps.every((c) => c.dev === f1.device && c.status === 200), 'snapshots=' + snaps.length);
  say('the phone has its own bill prefix — not C1, the shop PC\'s', /^D[0-9A-Z]{3}$/.test(f1.prefix) && !!f1.given, 'prefix=' + f1.prefix + ' given=' + f1.given);

  /* ── T2 ───────────────────────────────────────────────────────────────────────────────────────────────────── */
  console.log('\n── T2 ⭐⭐⭐ THE SHOP PC OPENS C1 WHILE THE PHONE BILLS — 0×401 on the phone, prefix ≠ C1, 3 bills land once');
  const t2from = api.calls.length;
  await ringBill(p);
  await p.waitForTimeout(1500);
  console.log('     probe after bill 1: ' + JSON.stringify(await p.evaluate(async () => ({ last: HOST.last, line: lineUp(), onLine: navigator.onLine, st: lineState().state,
    queued: STATE && STATE.queued, q: ((await DB.all('queue')) || []).length, bills: ((await DB.all('bills')) || []).length, busy: HOST._busy, cred: HOST.cred(), owner: OWNER, mem: MEM.on }))).slice(0, 600));
  api.pcClaim('C1', 'Shop PC', false);          /* the PC signs in again and opens C1 — beside the phone */
  await ringBill(p);
  api.pcClaim('C1', 'Shop PC', true);           /* …and once with takeover, as its morning enrol does */
  await ringBill(p);
  const t2land = await settle(api, chitsAfterT0 + 3);
  const t2calls = api.calls.slice(t2from);
  const f2 = await facts(p);
  await shot(p, 't2-three-bills');
  say('⭐⭐⭐ the phone never received a 401 while the PC opened C1', t2calls.every((c) => c.status < 400), 'statuses=' + t2calls.map((c) => c.status).filter((x, i, a) => a.indexOf(x) === i).join(','));
  say('⭐⭐⭐ the phone never heard COUNTER_HELD and never asked for a counter', !api.calls.some((c) => c.code === 'COUNTER_HELD' || c.code === 'ENROL' || c.u.indexOf('/api/counters') === 0), 'codes=' + api.calls.map((c) => c.code).filter(Boolean).join(',') || 'none');
  const mine = api.chits.slice(chitsAfterT0);
  say('⭐⭐ all 3 bills landed, once each, as the person on this device', t2land === chitsAfterT0 + 3 && mine.length === 3 && mine.every((c) => c.by === 'ent-a') && f2.queue === 0, 'landed=' + mine.length + ' queue=' + f2.queue);
  say('⭐⭐ their prefix is the phone\'s own — not C1', mine.every((c) => c.client_ref.indexOf(f1.prefix + '/') === 0 && c.client_ref.indexOf('C1/') !== 0), mine.map((c) => c.client_ref).join(' '));
  say('the bill records the counter label it was billed under', mine.every((c) => c.till && c.till.id === f1.prefix), JSON.stringify(mine[0] && mine[0].till));
  await p.evaluate(() => HOST.drain());
  await p.waitForTimeout(800);
  say('a second drain adds nothing (client_ref makes a retry harmless)', api.chits.length === chitsAfterT0 + 3, 'chits=' + api.chits.length);
  say('and the shop PC still holds C1 — nothing of the PC was touched by the phone', api.REG.C1.held_by === 'Shop PC', JSON.stringify(api.REG.C1));

  /* ── T3 ───────────────────────────────────────────────────────────────────────────────────────────────────── */
  console.log('\n── T3 ⭐⭐ A PC TAKES C1 OVER FROM ANOTHER PC — the phone\'s session is untouched');
  const t3from = api.calls.length, jtiBefore = f2.person.jti;
  api.pcClaim('C1', 'Other PC', true);          /* closes KEY-SHOPPC; the phone holds no key */
  await p.evaluate(() => refresh().catch(function(){}));
  await p.waitForTimeout(800);
  await ringBill(p);
  const t3land = await settle(api, chitsAfterT0 + 4);
  const f3 = await facts(p);
  say('⭐⭐ the phone read its shop and billed again — no 401, same session', api.calls.slice(t3from).every((c) => c.status < 400) && t3land === chitsAfterT0 + 4 && f3.person.jti === jtiBefore, 'statuses=' + api.calls.slice(t3from).map((c) => c.status).filter((x, i, a) => a.indexOf(x) === i).join(',') + ' chits=' + t3land);
  say('nothing on the phone says "maintenance"', !/maintenance/i.test(f3.flash), JSON.stringify(f3.flash));

  /* ── T4 ───────────────────────────────────────────────────────────────────────────────────────────────────── */
  console.log('\n── T4 ⭐⭐ WORDS PER CODE — SESSION_EXPIRED is "Sign in to send 1 bill", never "maintenance"; the queue survives the new sign-in');
  await ctx.setOffline(true);
  await ringBill(p);                                      /* a bill with the line down — queued */
  api.revokeSession(f3.person.jti);                       /* …and while it waited, the session ended (logout elsewhere / expiry) */
  await ctx.setOffline(false);
  await p.evaluate(() => HOST.drain());
  await p.waitForFunction(() => HOST && HOST.last && /Sign in to send/.test(String(HOST.last.why || '')), null, { timeout: 15000 }).catch(() => {});
  const f4 = await facts(p);
  const last = await p.evaluate(() => HOST.last);
  const qb = await p.evaluate(() => queueBlock());
  say('⭐⭐ drain says "Sign in to send 1 bill" — the code decides, the row is kept', /Sign in to send 1 bill/.test(String(last && last.why)) && last.code === 'SESSION_EXPIRED' && f4.queue === 1, JSON.stringify(last && last.why).slice(0, 90) + ' queue=' + f4.queue);
  say('the queue card says the same words and offers the sign-in', qb && /Sign in to send 1 bill/.test(qb.line) && qb.act === 'pairAgain' && qb.fix === 'Sign in', JSON.stringify(qb));
  await p.evaluate(() => refresh().catch(function(){}));
  await p.waitForFunction(() => /Sign in/.test((document.getElementById('flash') || {}).innerText || ''), null, { timeout: 10000 }).catch(() => {});
  const f4b = await facts(p);
  await shot(p, 't4-expired');
  say('⭐ the flash over the shelf says "Sign in to send 1 bill" and never "Due to maintenance"', /Sign in to send 1 bill/.test(f4b.flash) && !/maintenance/i.test(f4b.flash) && f4b.keyOk === false, JSON.stringify(f4b.flash));
  /* the person signs in again on the same phone, same shop → the fresh session replaces the old one IN PLACE */
  const loadsBefore = loads, callsT4 = api.calls.length;
  await p.evaluate(() => pairAgain());
  await signIn(p, 'athi'); await afterIn(p, null);
  const landedT4 = await settle(api, chitsAfterT0 + 5);
  const f5 = await facts(p);
  await shot(p, 't4-signed-in-again');
  say('⭐⭐⭐ after signing in again the queued bill lands, once, under the SAME client_ref — nothing was re-stamped', landedT4 === chitsAfterT0 + 5 && f5.queue === 0 && api.chits.length === chitsAfterT0 + 5, 'chits=' + api.chits.length + ' queue=' + f5.queue + ' last=' + (api.chits[api.chits.length - 1] || {}).client_ref);
  say('a new session for the same shop replaced the old one in place — no reload, same store, no enrol', loads === loadsBefore && f5.person.jti !== jtiBefore && f5.store === f1.store && f5.who === 'Athi' && !api.calls.slice(callsT4).some((c) => c.u === '/api/till/enrol'), 'loads=' + loads + '/' + loadsBefore + ' jti changed=' + (f5.person.jti !== jtiBefore) + ' flash=' + JSON.stringify(f5.flash));
  /* DEVICE_REVOKED: the owner removed this phone */
  api.revokeDevice(f5.device);
  await p.evaluate(() => refresh().catch(function(){}));
  await p.waitForFunction(() => /removed/.test((document.getElementById('flash') || {}).innerText || ''), null, { timeout: 10000 }).catch(() => {});
  const f6 = await facts(p);
  await shot(p, 't4-revoked');
  say('⭐ DEVICE_REVOKED → "The shop removed this phone" + what is kept here (never "maintenance")', /removed this phone/.test(f6.flash) && /kept/i.test(f6.flash) && !/maintenance/i.test(f6.flash) && f6.bills === 5 && f6.queue === 0, JSON.stringify(f6.flash) + ' bills=' + f6.bills);
  api.devices[f5.device].revoked_at = null;               /* the owner undoes it — the next refresh is ordinary again */

  /* ── T5 ───────────────────────────────────────────────────────────────────────────────────────────────────── */
  console.log('\n── T5 ⭐ THE PAGE CHECKS ITS OWN VERSION — reloads once for a newer page, and clears nothing');
  flag.laterPage = true;
  const loads5 = loads;
  await p.reload();
  await p.waitForFunction(() => typeof usignOpen === 'function', null, { timeout: 30000 });
  await p.waitForTimeout(2500);                            /* the check runs once the shop is read; the reload follows ~0.6 s later */
  await p.waitForFunction(() => typeof usignOpen === 'function' && S && S.shop, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const f7 = await facts(p);
  const mark = await p.evaluate(() => sessionStorage.getItem('cb_till_reloaded_for'));
  say('⭐ a newer page on the server → the page reloaded itself exactly once more', loads - loads5 === 2 && mark === 'later-than-this', 'loads=' + (loads - loads5) + ' mark=' + mark);
  say('⭐⭐⭐ history is never cleared by a version check: bills, session, device id, prefix all intact', f7.bills === 5 && f7.person && f7.person.jti === f5.person.jti && f7.device === f1.device && f7.prefix === f1.prefix && f7.who === 'Athi', 'bills=' + f7.bills + ' who=' + f7.who + ' prefix=' + f7.prefix);
  flag.laterPage = false;
  await shot(p, 't5-after-version-check');

  /* ('cb-till' is the unscoped shelf a never-paired page opens before anything names a shop — as before M08) */
  const stores = await p.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name).filter((n) => /^cb-till-/.test(n)) : []));
  say('this phone holds exactly its one person store (no key store was created beside it)', stores.length === 1 && stores[0] === f1.store, JSON.stringify(stores));
  say('no page errors', errs.length === 0, errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  console.log('\nshots: e2e/shots/person-signin-*.png');
  await ctx.close(); await b.close(); web.close(); api.srv.close();
  console.log('\n' + (bad ? '✗ ' + bad + ' FAILED\n' : '✓ all good\n'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
