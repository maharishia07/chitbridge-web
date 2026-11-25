/* till-return-address.cjs: RW1-27, THE COUNTER OPENED AT A BILL'S RETURN (/till.html?return=<chit_id>)
 *
 * The chit sheet's Credit note and the Day book's sale entry send the owner here. ONE return flow: the address only finds the bill (this device, else the shop's
 * history of the last 30 days) and opens the till's own return sheet; the posting is the one credit-note path. The real till.html, a stand-in ChitBridge.
 *   1  a bill this device does NOT hold (rung on another counter) opens the return sheet, prefilled with that bill and its lines
 *   2  the credit note is issued through the sheet (kind credit_note, against that bill's number AND chit id)
 *   3  the same address again says everything has come back, and opens nothing
 *   4  an id the shop does not hold says so
 * Run: node e2e/till-return-address.cjs   (on a box with only playwright-core: TAG=till node e2e/rw127-grund.cjs)
 */
'use strict';
const { chromium } = require('@playwright/test');
const SI = require('./lib/signin.cjs');
const { recheckStub } = require('./lib/recheck-stub.cjs');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const SHOTS = path.join(__dirname, 'shots');
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(70) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, 'FAILED'))); };
const CHIT = 'abcdef12-3456-4789-8abc-def012345678', NO = 'C7/26-27/0042';

(async () => {
  const web = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  const sent = [];
  const HISTORY = [{ chit_id: CHIT, no: NO, at: new Date(Date.now() - 3 * 86400000).toISOString(), total: 236, customer: 'Walk-in', kind: 'cash', payments: [{ how: 'cash', amount: 236 }],
    taxable: 200, tax: 36, lines: [{ name: 'Pen', qty: 2, unit: 'nos', price: 118, net: 236, gst_rate: 18 }] }];
  const OLD = Object.assign({}, HISTORY[0], { chit_id: '11111111-2222-4333-8444-555555555555', no: 'C7/26-27/0007', at: new Date(Date.now() - 90 * 86400000).toISOString() });
  const api = http.createServer(async (q, r) => {
    let raw = ''; for await (const c of q) raw += c;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const j = (c2, o) => { r.writeHead(c2, Object.assign({ 'content-type': 'application/json' }, cors)); r.end(JSON.stringify(o)); };
    if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
    const u = q.url.split('?')[0];
    if (u === '/api/till/snapshot') return j(200, { at: new Date().toISOString(), entity_id: 'ent-x', shop: { country: 'IN', name: 'Shop X', bridge_id: 'CB-X' }, till: { suggested_id: 'C1', assigned_id: 'C1' }, items: [{ id: 'xmango', item_id: 'xmango', name: 'XMANGO', price: 50, unit: 'nos', code: 'XMANGO' }] });
    if (u === '/api/till/recheck') return j(200, recheckStub(raw, { xmango: 50 }));
    if (u === '/api/till/bills') { const want = new URL(q.url, 'http://x').searchParams.get('chit'); return j(200, { bills: want ? HISTORY.concat([OLD]).filter((x) => x.chit_id === want) : HISTORY }); } /* RW2-05: the route answers ONE bill by ?chit=, of any age */
    if (u === '/api/entities/register' || u === '/api/signin/ask') return j(200, { message: 'sent', dev_otp: '123456' });
    if (u === '/api/entities/verify' || u === '/api/signin/verify') return j(200, { token: 'T', identity: { identity_id: 'p-x', user_id: 'xclerk', display_name: 'X Clerk', identity_type: 'actor', entity_id: 'ent-x' } });
    if (u === '/api/chits/send') { try { sent.push(JSON.parse(raw)); } catch (_) {} return j(200, { chit_id: 'c' + sent.length }); }
    return j(200, { ok: true });
  });
  await new Promise((res) => web.listen(0, '127.0.0.1', res)); await new Promise((res) => api.listen(0, '127.0.0.1', res));
  const API = 'http://127.0.0.1:' + api.address().port;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript((a) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('cb_till_api', a); localStorage.setItem('cb_till_key', 'KEY-X'); localStorage.setItem('cb_till_autolock@', '0'); }, API);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:' + web.address().port + '/till.html');
  await p.waitForFunction(() => typeof returnFromAddress === 'function' && typeof refresh === 'function', null, { timeout: 30000 });
  await p.evaluate(() => refresh().catch(function () {}));
  await p.waitForFunction(() => S && S.shop && S.shop.name === 'Shop X', null, { timeout: 30000 });
  await SI.signIn(p, 'xclerk'); await SI.signedIn(p); await p.evaluate(() => usignClose());
  const said = () => p.evaluate(() => (document.getElementById('lastnote') || {}).textContent || '');
  const ask = (id) => p.evaluate(async (i) => { history.replaceState(null, '', '/till.html?return=' + i); await returnFromAddress(); return { open: !!document.getElementById('retdlg').open, no: RET_FOR && RET_FOR.no, url: location.search }; }, id);

  console.log('\n-- 1 · a bill this device does not hold, opened from the address');
  const held0 = await p.evaluate(async () => (await DB.all('bills')).map((x) => x.no));
  say('(set-up) this device does not hold the bill', held0.indexOf(NO) < 0, JSON.stringify(held0));
  const r1 = await ask(CHIT);
  say('the return sheet opens at that bill', r1.open && r1.no === NO, JSON.stringify(r1));
  say('the address is cleaned (read once)', !/return=/.test(r1.url), r1.url || '(empty)');
  const lines = await p.evaluate(() => document.getElementById('retdlg').innerText);
  say('it shows the bill and its line, not an empty sheet', lines.indexOf(NO) >= 0 && /Pen/.test(lines), lines.replace(/\s+/g, ' ').slice(0, 90));
  fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, 'rw127-till-return-open.png') });

  console.log('\n-- 2 · the credit note goes through the one posting path');
  await p.click('[data-testid="till-ret-all"]'); await p.click('[data-testid="till-return-go"]');
  await p.waitForSelector('#askdlg[open]', { timeout: 10000 }); await p.click('#askok');
  await p.waitForFunction(() => /Credit note/.test(document.getElementById('sliptitle').textContent || ''), null, { timeout: 20000 });
  await p.evaluate(() => { try { document.getElementById('slipdlg').close(); } catch (_) {} });
  const cn = await p.evaluate(async () => { var c = (await DB.all('bills')).filter((x) => x.kind === 'credit_note').pop(); return c && { no: c.against && c.against.bill_no, chit: c.against && c.against.chit_id, total: c.total }; });
  say('a credit note is issued against that bill, naming its chit id', cn && cn.no === NO && cn.chit === CHIT && cn.total === -236, JSON.stringify(cn));

  console.log('\n-- 3 · again: nothing left to take back');
  const r3 = await ask(CHIT);
  say('the sheet does not open', !r3.open, JSON.stringify(r3));
  say('it says every item has come back', /already come back/.test(await said()), (await said()).replace(/\s+/g, ' ').slice(0, 80));

  console.log('\n-- 4 · an id the shop does not hold');
  const r4 = await ask('00000000-0000-4000-8000-000000000000');
  say('nothing opens and it says why', !r4.open && /holds no counter bill with that address/.test(await said()), (await said()).replace(/\s+/g, ' ').slice(0, 80));

  console.log('\n-- 5 · RW2-05: a sale 90 days old is read by its id, opened, and not kept on the device');
  const r5 = await ask(OLD.chit_id);
  say('the return sheet opens at the old bill', r5.open && r5.no === OLD.no, JSON.stringify(r5));
  const kept = await p.evaluate(async (n) => (await DB.all('bills')).some((x) => x.no === n), OLD.no);
  say('the old bill is not left in the device store', !kept, String(kept));

  console.log('\nconsole/page errors:', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  say('no page errors', errs.length === 0, errs.length + ' error(s)');
  await b.close(); web.close(); api.close();
  console.log('\n' + (bad ? bad + ' FAILED\n' : 'all good\n')); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
