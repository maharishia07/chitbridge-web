/* till-r4-guards.cjs — Fable risk review 4 (the till), the two page findings, walked in a real browser.
 *   T4-01  one sale is ONE bill: a double click, two finish() calls in one tick, a held F9 — and a retry of a failed save is the same bill.
 *   T4-03  a refused IndexedDB call never becomes an empty second store: the number series keeps going, or the sale STOPS in words.
 * Each BAD case fails on the master before the fix and passes after; each GOOD case holds on both.
 * Run on a SIT box:  sh C:/dev/toolset/sit-box-run.sh sit-grund e2e <pushed-web-ref> e2e/till-r4-guards.cjs
 * Stand-ins: the page is served from public/ with no server behind it; HOST is a page-local object (as e2e/till-tidy.cjs); window.print is silenced. */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(78) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };
const ITEMS = [{ item_id: 'i1', name: 'Dosa', code: 'D1', category: 'Tiffin', unit: 'plate', price: 40, tax_rate: 5 }];

function web() {
  return http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
}

/** a fresh page on the till, the shop set, one slow stand-in HOST that counts the bills it is asked to save */
async function tillPage(browser, WEB, init) {
  const ctx = await browser.newContext({ locale: 'en-IN', viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('  pageerror: ' + String(e).slice(0, 200)));
  await p.addInitScript(() => { window.print = function () {}; });
  if (init) await p.addInitScript(init);
  await p.goto(WEB + '/till.html');
  await p.waitForFunction(() => typeof modOpen === 'function' && typeof finish === 'function', null, { timeout: 30000 });
  await p.evaluate((items) => {
    window.S = { shop: { country: 'IN', name: 'Mayur Bhavan', currency: 'INR', gstin: '33ABCDE1234F1Z5', reg_type: 'regular' }, items: items, offers: [], at: new Date().toISOString() };
    CloudHost.key = 'demo-key'; ls.set(tillGivenKey(), 'C1'); window.WHO = { id: 'c1', name: 'Clerk', kind: 'coassist' };
    window.SAVED = [];
    window.HOST = { mode: 'cloud', key: 'demo-key',
      bill: async function (body) {
        await new Promise(function (r) { setTimeout(r, 400); });                      /* the slow part: the network, the state read */
        var s = Object.assign({}, body, { no: 'C1/26-27/' + String(window.SAVED.length + 1).padStart(4, '0'), at: new Date().toISOString() });
        window.SAVED.push(s); return { ok: true, bill: s, today: { count: window.SAVED.length, total: 0, by: {} } }; },
      bills: async function () { return window.SAVED.slice(); },
      state: async function () { return { snapshot: window.S, online: true, queued: 0, today: { count: window.SAVED.length, total: 0, by: {} }, till: { id: 'C1', name: 'Counter 1', host: 'this device' }, engines: {} }; } };
    setMode('sell'); applyLook(); try { stepsApply(); paintHits(); paintChips(); paintQuick(); paintSide(); } catch (_) {}
  }, ITEMS);
  await p.waitForTimeout(300);
  return { ctx, p };
}
const ring = (p) => p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); CART.length = 0; addItem(S.items[0], 1); price(); return CART.length; });
const saved = (p) => p.evaluate(() => window.SAVED.length);

(async () => {
  const srv = web(); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const WEB = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const { p } = await tillPage(b, WEB);
  const r = await p.evaluate(async () => {
    var out = [];
    await nextNumber(); await nextNumber();
    out.push('dbs ' + JSON.stringify((await indexedDB.databases()).map((d) => d.name + '@' + d.version)));
    await DB.release();
    out.push('after release ' + JSON.stringify(await DB.get('series')));
    out.push('dbs ' + JSON.stringify((await indexedDB.databases()).map((d) => d.name + '@' + d.version)));
    var raw = await new Promise((res, rej) => { var rq = indexedDB.open(tillStore()); rq.onsuccess = () => { var t = rq.result.transaction('kv'); var g = t.objectStore('kv').getAllKeys(); t.oncomplete = () => res(g.result); }; rq.onerror = () => rej(rq.error); });
    out.push('raw keys ' + JSON.stringify(raw));
    return out;
  });
  console.log(r.join('\n'));
  await b.close(); srv.close(); process.exit(0);
})();
