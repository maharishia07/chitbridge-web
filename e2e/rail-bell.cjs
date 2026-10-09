/* rail-bell.cjs — R06: CBBell (public/app/rail-bell.js) mounted on crm.html and accounts.html, against a REAL SSE stream.
 * T1: a message on a chit -> the dot on crm.html within 5 s.   Invariants: the bell never polls · a notification is shown only to a
 * signed-in person of the shop (signed out / customer: no bell, no ticket, no stream).
 * A real http server serves public/ and stands in for the API (the page is pointed at it with cb_api_base); nothing leaves 127.0.0.1.
 * Run: sh C:/dev/toolset/e2e.sh <checkout> e2e/rail-bell.cjs */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const claims = (c) => b64({ alg: 'none' }) + '.' + b64(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.x';
const OWNER = { token: claims({ identity_id: 'ent-M', identity_type: 'entity' }), role: 'entity', name: 'Athi', entity: 'Mayur Bhavan' };

const S = { calls: [], conns: [], notifs: [], count: 0, tickets: 0, dismissed: 0 };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'), p = u.pathname, j = (c, o) => { r.writeHead(c, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }); r.end(JSON.stringify(o)); };
  if (q.method === 'OPTIONS') return j(204, {});
  if (p.startsWith('/api/')) S.calls.push(q.method + ' ' + p);
  if (p === '/api/events/ticket') { S.tickets++; return j(200, { ticket: 'tk' + S.tickets }); }
  if (p === '/api/events/stream') {
    r.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'access-control-allow-origin': '*' });
    r.write('event: hello\ndata: {}\n\n'); S.conns.push(r); q.on('close', () => { const i = S.conns.indexOf(r); if (i >= 0) S.conns.splice(i, 1); }); return;
  }
  if (p === '/__push') {   /* a message lands on a chit: the feed gains a row, the badge 1, and the stream says so */
    S.notifs.unshift({ log_id: 'L' + (S.notifs.length + 1), chit_id: 'ch-1', action: 'message_sent', action_by_display_name: 'Ravi', auto_subject: 'Order 17', detail: 'Friday is fine', created_at: new Date().toISOString() });
    S.count++; S.conns.forEach((c) => c.write('event: cb\ndata: {"kind":"message","id":"ch-1"}\n\n')); return j(200, { ok: true });
  }
  if (p === '/api/notifications') return j(200, { notifications: S.notifs, count: S.count });
  if (p === '/api/notifications/seen') { S.count = 0; return j(200, { ok: true }); }
  if (p === '/api/notifications/dismiss') { S.dismissed++; S.notifs = []; S.count = 0; return j(200, { ok: true }); }
  if (p.startsWith('/api/')) return j(404, { error: 'Not found' });
  const f = path.join(PUB, decodeURIComponent(p).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const n = (re) => S.calls.filter((c) => re.test(c)).length;

(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const errs = [];
  async function page(sess, url) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript((a) => { try { localStorage.setItem('cb_api_base', a.base); if (a.sess) localStorage.setItem('cb_sess', JSON.stringify(a.sess)); } catch (_) {} }, { base, sess });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e.message)));
    await p.goto(base + url); return p;
  }

  console.log('\n-- crm.html: the dot arrives by the stream, within 5 s --');
  let p = await page(OWNER, '/crm.html');
  await p.waitForSelector('[data-testid="bell-btn"]', { timeout: 20000 });
  ok(await p.locator('[data-testid="bell"]').count() === 1, 'the bell is in the crm header');
  ok(await p.locator('[data-testid="bell-dot"]').count() === 0, 'no dot while nothing has arrived');
  await p.waitForFunction(() => true); await wait(800);
  ok(S.tickets === 1 && S.conns.length === 1, 'one ticket, one stream (' + S.tickets + '/' + S.conns.length + ')');
  const reads0 = n(/GET \/api\/notifications$/);
  const t0 = Date.now();
  await new Promise((res) => http.get(base + '/__push', (x) => { x.resume(); x.on('end', res); }));
  await p.waitForSelector('[data-testid="bell-dot"]', { timeout: 5000 });
  const dt = Date.now() - t0;
  ok(dt < 5000 && /1/.test(await p.textContent('[data-testid="bell-dot"]')), 'a message on a chit -> the dot shows 1 in ' + dt + ' ms');
  ok(n(/GET \/api\/notifications$/) === reads0 + 1, 'ONE read for the arrival');
  await wait(6000);
  ok(n(/GET \/api\/notifications$/) === reads0 + 1 && S.tickets === 1, 'idle for 6 s: no further reads, no new ticket — the bell never polls');

  console.log('\n-- the list, seen, a row, clear --');
  await p.evaluate(() => { window.__opened = []; window.openChitSheet = (id) => window.__opened.push(id); });
  const seen0 = n(/POST \/api\/notifications\/seen/);
  await p.click('[data-testid="bell-btn"]');
  await p.waitForSelector('[data-testid="bell-row"]', { timeout: 5000 });
  ok(/Ravi/.test(await p.textContent('[data-testid="bell-row"]')) && /wrote about/.test(await p.textContent('[data-testid="bell-row"]')), 'the row reads like a sentence: "Ravi wrote about Order 17"');
  await p.waitForFunction(() => !document.querySelector('[data-testid="bell-dot"]'), null, { timeout: 5000 });
  ok(n(/POST \/api\/notifications\/seen/) === seen0 + 1, 'opening is seeing: one seen, the dot clears');
  ok(await p.locator('[data-testid="bell-panel"]').count() === 1, 'the panel stays open after the repaint');
  await p.click('[data-testid="bell-row"]');
  ok(JSON.stringify(await p.evaluate(() => window.__opened)) === '["ch-1"]' && await p.locator('[data-testid="bell-panel"]').count() === 0, 'a row opens its chit through the host and closes the panel');
  await p.click('[data-testid="bell-btn"]'); await p.waitForSelector('[data-testid="bell-clear"]:not([disabled])');
  await p.click('[data-testid="bell-clear"]');
  await p.waitForSelector('[data-testid="confirm-ok"]', { timeout: 5000 });
  ok(S.dismissed === 0, 'Clear all asks first — nothing sent yet');
  await p.click('[data-testid="confirm-ok"]');
  await p.waitForSelector('[data-testid="bell-empty"]', { timeout: 5000 });
  ok(S.dismissed === 1 && /cleared/.test(await p.textContent('[data-testid="bell-out"]')), 'confirmed: ONE dismiss, the outcome said under the button');
  await p.keyboard.press('Escape');
  ok(await p.locator('[data-testid="bell-panel"]').count() === 0, 'Escape closes the panel');
  await p.setViewportSize({ width: 390, height: 800 });
  await p.click('[data-testid="bell-btn"]');
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'phone 390 px: no sideways scroll with the panel open');

  console.log('\n-- accounts.html: same unit, a second host --');
  const tk = S.tickets;
  const a = await page(OWNER, '/accounts.html');
  await a.waitForSelector('[data-testid="bell-btn"]', { timeout: 20000 });
  ok(await a.locator('[data-testid="bell"]').count() === 1, 'the bell is in the accounts header');
  await wait(800);
  ok(S.tickets === tk + 1, 'accounts opened its own ticket');
  const before = S.count;
  await new Promise((res) => http.get(base + '/__push', (x) => { x.resume(); x.on('end', res); }));
  await a.waitForSelector('[data-testid="bell-dot"]', { timeout: 5000 });
  ok(S.count === before + 1, 'a push reaches accounts too');

  console.log('\n-- signed out: no bell, no ticket, no stream --');
  const tk2 = S.tickets, cn = S.conns.length;
  const o = await page(null, '/crm.html'); await wait(2500);
  ok(await o.locator('[data-testid="bell-btn"]').count() === 0 && S.tickets === tk2 && S.conns.length === cn, 'signed out: nothing drawn, nothing opened');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
