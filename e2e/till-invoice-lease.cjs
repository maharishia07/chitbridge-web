/* till-invoice-lease.cjs — CTR-213 (ACC-192 S2), THE TILL HALF IN A REAL BROWSER: two UAE counters print their invoice numbers from blocks the server leased.
 *
 * The real public/till.html runs in two browser contexts (two tills, each with its own IndexedDB). The api's lease door is played by this file the way
 * lib/invoice-lease answers it (ONE counter, blocks that never overlap, a further invoice draws one number from the same counter); the till's own
 * nextNumber() is what is driven, nothing is retyped.
 *
 * Hand figures (block 50, refill at 20 percent left = 10 numbers; the counter starts at 1):
 *   C1 asks first: 1-50. C2 asks: 51-100. The counter stands at 101.
 *   C1 prints 41 numbers (0001..0041): 9 are left, so C1 asks again and gets 101-150; the counter stands at 151.
 *   C2 prints 0051. One further invoice (the server's own draw) takes 151.
 *   C1 goes on: 0042..0050, then 0101 (the second block). No number appears twice; the day-close view of what was printed (1-41, 42-50, 101, 51, 151)
 *   has NO gap inside any block that is below its highest printed number.
 *   A counter with a block of 7-9 held and no line prints 0007, 0008, 0009; the 4th bill is refused in words and no number is made up.
 * Run: NODE_PATH=$PWD/e2e/node_modules node e2e/till-invoice-lease.cjs   (exit 1 on any failure)
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log(String(l).padEnd(48) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

/** the server's one counter and its leases */
const server = { counter: 1, leases: [], calls: [] };
const lease = (body) => {
  server.calls.push(body);
  const mine = server.leases.filter((l) => l.till_id === body.till_id && !l.closed);
  const last = mine[mine.length - 1];
  if (last && body.remaining != null && body.remaining > (last.last_no - last.first_no + 1) * 0.2) return Object.assign({ ok: true, reused: true }, last);
  const size = body.want || 50, first = server.counter; server.counter += size;
  const row = { lease_id: '00000000-0000-4000-8000-' + String(server.leases.length + 1).padStart(12, '0'), till_id: body.till_id, first_no: first, last_no: first + size - 1, size, expires_at: '2099-01-01T00:00:00Z' };
  server.leases.push(row);
  return Object.assign({ ok: true, reused: false }, row);
};

(async () => {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();

  /** one counter: a page of the real till, an AE shop, the cloud host with a key, and the lease door answered by `lease` (or the line cut) */
  async function counter(id, cut) {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    await p.route('**/api/till/invoice-lease/close', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const row = server.leases.find((l) => l.lease_id === body.lease_id); if (row) row.closed = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, lease_id: body.lease_id, closed: true, unused: [] }) });
    });
    await p.route('**/api/till/invoice-lease', (route) => {
      if (cut) return route.abort();
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lease(JSON.parse(route.request().postData() || '{}'))) });
    });
    await p.goto(base + '/till.html');
    await p.waitForFunction(() => typeof window.nextNumber === 'function' && typeof window.leaseRefill === 'function', null, { timeout: 30000 });
    await p.evaluate(({ id, base }) => {
      tillIdSet(id);
      window.S = { shop: { name: 'A shop', currency: 'AED', country: 'AE', gstin: '100123456700003', reg_type: 'regular' }, items: [], offers: [], slabs: [], at: new Date().toISOString() };
      CloudHost.api = base; CloudHost.key = 'test-counter-key'; HOST = CloudHost;
    }, { id, base });
    return p;
  }
  const draw = (p, n) => p.evaluate(async (n) => { const out = []; for (let i = 0; i < n; i++) out.push(await nextNumber(undefined, false)); return out; }, n);
  const settle = (p) => p.waitForTimeout(400);

  const c1 = await counter('C1'), c2 = await counter('C2');
  await c1.evaluate(() => leaseRefill(true)); await c2.evaluate(() => leaseRefill(true));
  say('two tills ask: 1-50 and 51-100, counter at 101', server.leases.length === 2 && server.leases[0].first_no === 1 && server.leases[0].last_no === 50 && server.leases[1].first_no === 51 && server.leases[1].last_no === 100 && server.counter === 101,
    JSON.stringify(server.leases.map((l) => [l.first_no, l.last_no])) + ' counter ' + server.counter);

  const printed = [];
  const first41 = await draw(c1, 41); printed.push(...first41);
  await settle(c1);
  say('C1 prints 0001..0041', first41[0] === '0001' && first41[40] === '0041', first41[0] + ' … ' + first41[40]);
  say('at 9 left C1 asked again: 101-150, counter 151', server.leases.length === 3 && server.leases[2].first_no === 101 && server.leases[2].last_no === 150 && server.counter === 151, JSON.stringify(server.leases.map((l) => [l.first_no, l.last_no])) + ' counter ' + server.counter);

  const c2first = await draw(c2, 1); printed.push(...c2first);
  const further = server.counter++; printed.push(String(further).padStart(4, '0'));
  say('C2 prints 0051; the further invoice takes 0151', c2first[0] === '0051' && further === 151, c2first[0] + ' / ' + further);

  const more = await draw(c1, 10); printed.push(...more);
  await settle(c1);
  say('C1 goes on: 0042..0050 then 0101', more.slice(0, 9).join() === '0042,0043,0044,0045,0046,0047,0048,0049,0050' && more[9] === '0101', more.join(' '));
  say('no number appears twice', new Set(printed).size === printed.length, printed.length + ' printed, ' + new Set(printed).size + ' different');
  say('the first block, used up, was told to the server', server.leases[0].closed === true, 'closed=' + server.leases[0].closed);
  const inBlock = (l) => printed.map(Number).filter((n) => n >= l.first_no && n <= l.last_no).sort((a, c) => a - c);
  const gaps = server.leases.map((l) => { const got = inBlock(l); if (!got.length) return 0; let g = 0; for (let n = l.first_no; n < got[got.length - 1]; n++) if (!got.includes(n)) g++; return g; });
  say('no gap inside any block below its highest number', gaps.every((g) => g === 0), 'gaps per block ' + JSON.stringify(gaps));

  /* offline: 7-9 held, the line cut */
  const off = await counter('C3', true);
  await off.evaluate(() => DB.set('invoice-lease', { till: 'C3', leased: true, used: 6, blocks: [{ lease_id: '00000000-0000-4000-8000-0000000000aa', first_no: 1, last_no: 9, expires_at: '2099-01-01T00:00:00Z' }] }));
  const three = await draw(off, 3);
  say('offline with 7-9 held: 0007 0008 0009', three.join() === '0007,0008,0009', three.join(' '));
  const fourth = await off.evaluate(async () => { try { return { no: await nextNumber(undefined, false) }; } catch (e) { return { err: String(e.message) }; } });
  say('the 4th is refused in words, no number made up', !!fourth.err && /used all its invoice numbers/.test(fourth.err) && !fourth.no, JSON.stringify(fourth));

  await b.close(); srv.close();
  console.log(bad ? '\n' + bad + ' FAILED' : '\nall OK');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
