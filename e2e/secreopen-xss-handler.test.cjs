// e2e/secreopen-xss-handler.test.cjs — APPXSS 1129 a (retest 25 Nov): a supplier named  d&#39;);window.__xss=1;//  must not run script on "Record a delivery" / "Record a purchase".
// Real browser: serves THIS checkout's public/ on a loopback port, draws the supplier pane (supDetailHTML) for the hostile name, CLICKS the button and
// reads window.__xss. A control draws the OLD local q() the same way and must be exploited (so the test can fail). No api, no sign-in, no data written anywhere.
// Run on a SIT box (sh toolset/sit-box-run.sh sit-grund e2e <web-ref> e2e/secreopen-xss-handler.test.cjs) or locally with NODE_PATH=e2e/node_modules.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('@playwright/test');
const PUB = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const PAYLOADS = ["d&#39;);window.__xss=1;//", "d');window.__xss=1;//", 'd");window.__xss=1;//', 'x\\\');window.__xss=1;//'];
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) bad++; };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u.startsWith('/api')) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{}'); }
  const f = path.join(PUB, u === '/' ? 'app.html' : u);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const kind of ['own_use', 'trade']) for (const name of PAYLOADS) {
    const ctx = await browser.newContext(), page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof supDetailHTML === 'function', null, { timeout: 20000 }).catch(() => {});
    if (!(await page.evaluate(() => typeof supDetailHTML === 'function' && typeof supName === 'function'))) {
      await page.addScriptTag({ url: base + '/app/cap-suppliers.js' }).catch(() => {});
    }
    const drawn = await page.evaluate(({ name, kind }) => {
      window.__xss = 0; window.supBuyModal = function () {}; window.supRecordDelivery = function () {};
      const x = { display_name: name, name: name, supplier_entity_id: name, user_id: 'u1', kind: kind, supplier_kind: kind, off_rail: true };
      UI.supDet = { supplier: x, offRail: true }; UI.supFind = false;
      const box = document.createElement('div'); box.id = '__t'; document.body.appendChild(box);
      box.innerHTML = supDetailHTML();
      const b = box.querySelector('[data-testid="sup-record-buy"],[data-testid="sup-record-delivery"]');
      if (b) b.click();
      return { button: !!b, xss: window.__xss };
    }, { name, kind });
    ok(drawn.button && !drawn.xss, kind + ' ' + JSON.stringify(name) + ': button drawn, click ran no script (xss=' + drawn.xss + ')');
    await ctx.close();
  }
  { /* control: the OLD q() with the entity quote is exploited, so this test can go red */
    const ctx = await browser.newContext(), page = await ctx.newPage();
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded' });
    const r = await page.evaluate((name) => {
      window.__xss = 0; window.f = function () {};
      const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') + "'";
      const box = document.createElement('div'); box.innerHTML = '<button onclick="f(' + q(name) + ')">x</button>'; document.body.appendChild(box);
      box.querySelector('button').click(); return window.__xss;
    }, PAYLOADS[0]);
    ok(r === 1, 'control: the old local q() IS exploited by the entity-quote name (xss=' + r + ')');
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(bad ? bad + ' FAILED' : 'secreopen-xss-handler: all passed');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('  FAIL crash ' + e.message); process.exit(1); });
