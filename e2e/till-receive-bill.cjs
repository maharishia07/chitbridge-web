/* till-receive-bill.cjs — F10 · F11: A RECEIPT THAT CARRIES THE SUPPLIER'S BILL, AND THE SUPPLIER THE DOOR KNOWS
 *
 * Athi, 14 Oct ("yes to F10, build it"): the Receive form asks for their bill no. + total, the slip echoed them — and afterwards the books
 * said "You owe nobody". F11: typing "Sri Ganesh" at the door did not suggest the known supplier "Sri Ganesh Provisions".
 *
 * Drives the real Receive pane of public/till.html (the vendored copy) on the cloud host:
 *   · the snapshot's supplier names fill the door's suggestion list (datalist suplist) — "Sri Ganesh" is in "Sri Ganesh Provisions"
 *   · a part-typed name picks nobody; the full name (what a pick types) carries the party's id, and their GSTIN's state fills the state box
 *   · Confirm → the slip shows their bill, what it says, and that it waits in the books to accept
 *   · the chit that goes to the server carries party.party_id, their_bill, and each line's gst_rate (the books tax their bill from it)
 *   · a receipt WITHOUT their bill says nothing about the books
 *
 * Run: NODE_PATH=$PWD/e2e/node_modules node e2e/till-receive-bill.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
            '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(70) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };
const SG = '33333333-3333-4333-8333-333333333333';

(async () => {
  const srv = http.createServer((q, r) => {
    const url = q.url.split('?')[0];
    if (url.startsWith('/api/')) { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"ok":true}'); }
    const f = path.join(ROOT, decodeURIComponent(url).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 880 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + '/till.html');
  await p.waitForFunction(() => typeof window.screenSet === 'function' && typeof window.rcvConfirm === 'function', null, { timeout: 30000 });

  await p.evaluate(({ api, sg }) => {
    CloudHost.key = 'demo-key'; CloudHost.api = api; HOST = CloudHost;
    HOST.drain = function () {};                       /* the chit is read from the queue below, not sent */
    ls.set(tillGivenKey(), 'C1');
    WHO = { id: 'w1', name: 'Bala', kind: 'coassist', since: new Date().toISOString() };
    window.S = { shop: { name: 'Mayur Stores', currency: 'INR', state_code: '33', gstin: '33AAAAA0000A1Z5', reg_type: 'regular', pay: [{ id: 'cash', label: 'Cash' }] },
                 at: new Date().toISOString(), items: [], offers: [], customers: [],
                 suppliers: [{ party_id: sg, name: 'Sri Ganesh Provisions', state: '33', party_no: 'P-00001' }, { party_id: '44444444-4444-4444-8444-444444444444', name: 'Lakshmi Agencies' }] };
    window.__q = [];
    var put0 = DB.put; DB.put = function (st, row) { if (st === 'queue' && row && row.chitBody) window.__q.push(JSON.parse(JSON.stringify(row.chitBody))); return put0(st, row); };
    paintCustomers(); setMode('receive');
  }, { api: base, sg: SG });

  console.log('\n── F11 · the door suggests the shop\'s own suppliers ───────────');
  const sug = await p.evaluate(() => ({
    list: document.getElementById('rcv_vendor').getAttribute('list'),
    opts: Array.prototype.map.call(document.querySelectorAll('#suplist option'), (o) => o.value),
  }));
  say('the supplier box suggests from the snapshot\'s suppliers (datalist suplist)', sug.list === 'suplist' && sug.opts.indexOf('Sri Ganesh Provisions') >= 0, JSON.stringify(sug));
  say('"Sri Ganesh" is in the suggestion the browser offers as it is typed', sug.opts.some((o) => o.toLowerCase().indexOf('sri ganesh') >= 0), 'found');

  await p.click('[data-testid="rcv-vendor"]');
  await p.keyboard.type('Sri Ganesh', { delay: 20 });
  const part = await p.evaluate(() => ({ party: RCV.vendor_party, vendor: RCV.vendor }));
  say('a part-typed name picks nobody (never a guess)', part.party === null && part.vendor === 'Sri Ganesh', JSON.stringify(part));
  await p.fill('[data-testid="rcv-vendor"]', 'Sri Ganesh Provisions');   /* what picking the suggestion types */
  const pick = await p.evaluate(() => ({ party: RCV.vendor_party, state: RCV.vendor_state, box: document.getElementById('rcv_vstate').value }));
  say('picking "Sri Ganesh Provisions" carries the party\'s id', pick.party === SG, String(pick.party));
  say('…and their GSTIN\'s state fills the empty state box (CGST/SGST vs IGST)', pick.state === '33' && pick.box === '33', JSON.stringify(pick));

  console.log('\n── F10 · their bill, captured at the door → the slip ───────────');
  await p.evaluate(() => {
    rcvAdd({ item_id: 'i1', name: 'Rice 25kg', unit: 'bag', price: 100 }, 10);
    RCV.lines[0].gst_rate = 18; RCV.lines[0].rate = 100; paintReceive();
  });
  await p.fill('[data-testid="rcv-billno"]', 'SG-101');
  await p.fill('[data-testid="rcv-billtotal"]', '1180');
  await p.evaluate(async () => { await rcvConfirm(); });
  const slip = await p.evaluate(() => ({ open: document.getElementById('slipdlg').open, text: document.getElementById('slipbox').innerText.replace(/\s+/g, ' '),
    books: !!document.querySelector('#slipbox [data-testid="rcv-slip-books"]') }));
  say('Confirm opens the receipt slip', slip.open === true, 'open');
  say('the slip names their bill and what it says', /Their bill\s*SG-101/.test(slip.text) && /Their bill says\s*₹\s?1,180/.test(slip.text), slip.text.slice(0, 120));
  say('…and that it waits in the books for the owner to accept', slip.books && /waits in the books for you to accept/.test(slip.text), String(slip.books));
  const chit = await p.evaluate(() => window.__q.filter((c) => c.purpose === 'receipt').pop() || null);
  const bj = (chit && chit.business_json) || {};
  say('the chit to the server is a receipt carrying their bill (no. + total)', chit && bj.their_bill && bj.their_bill.no === 'SG-101' && Number(bj.their_bill.total) === 1180, JSON.stringify(bj.their_bill));
  say('…naming the supplier by id (party.party_id), never only a typed name', bj.party && bj.party.party_id === SG && bj.party.name === 'Sri Ganesh Provisions', JSON.stringify(bj.party));
  say('…each line carrying the GST rate on their bill (line_items[].gst_rate)', chit && chit.line_items && chit.line_items[0].gst_rate === 18 && chit.line_items[0].price === 100 && chit.line_items[0].quantity === 10, JSON.stringify(chit && chit.line_items && chit.line_items[0]));
  say('…and the input tax with the supplier\'s state', bj.input_tax && bj.input_tax.vendor_state === '33' && bj.input_tax.tax === 180, JSON.stringify(bj.input_tax));
  await p.evaluate(() => { try { document.getElementById('slipdlg').close(); } catch (_) {} });

  console.log('\n── a receipt WITHOUT their bill stays a goods receipt ───────────');
  await p.evaluate(async () => {
    rcvClear(); RCV.vendor = 'Lakshmi Agencies'; document.getElementById('rcv_vendor').value = RCV.vendor; rcvVendorPick();
    rcvAdd({ item_id: 'i2', name: 'Dal 1kg', unit: 'piece', price: 120 }, 5); await rcvConfirm();
  });
  const plain = await p.evaluate(() => ({ books: !!document.querySelector('#slipbox [data-testid="rcv-slip-books"]'), chit: window.__q.filter((c) => c.purpose === 'receipt').pop() }));
  say('no bill no. / total → the slip says nothing about the books', plain.books === false, String(plain.books));
  say('…and the chit carries no bill (their_bill no and total empty)', plain.chit && plain.chit.business_json.their_bill && !plain.chit.business_json.their_bill.no && plain.chit.business_json.their_bill.total == null,
    JSON.stringify(plain.chit && plain.chit.business_json.their_bill));
  say('…the second known supplier is carried by id too', plain.chit && plain.chit.business_json.party.party_id === '44444444-4444-4444-8444-444444444444', JSON.stringify(plain.chit && plain.chit.business_json.party));

  console.log('\n── FX-F10W · a snapshot stored by an older counter (no suppliers) is read again once on start ───────────');
  const heal = await p.evaluate(async () => {
    const calls = []; const was = { refresh: HOST.refresh, state: HOST.state, lineUp: window.lineUp };
    HOST.refresh = async function () { calls.push('refresh'); return { ok: true }; };
    window.lineUp = function () { return true; };
    const run = async (snap) => { FIRST_READ = false; HOST.state = async function () { return { snapshot: snap }; }; calls.length = 0; await load(); await new Promise((r) => setTimeout(r, 50)); return calls.length; };
    const base = JSON.parse(JSON.stringify(S));
    const old = JSON.parse(JSON.stringify(base)); delete old.suppliers;
    const out = { lacks: snapLacks(old), has: snapLacks(base), oldRefreshed: await run(old) };
    out.again = await (async () => { calls.length = 0; await load(); await new Promise((r) => setTimeout(r, 50)); return calls.length; })();   /* once per page: FIRST_READ */
    out.newRefreshed = await run(base);
    HOST.refresh = was.refresh; HOST.state = was.state; window.lineUp = was.lineUp;
    return out;
  });
  say('a stored snapshot without `suppliers` is lacking a key this build reads (SNAP_NEEDS)', heal.lacks === true && heal.has === false, JSON.stringify(heal));
  say('…so the counter refreshes once on start — the existing HOST.refresh, no new route', heal.oldRefreshed === 1, String(heal.oldRefreshed));
  say('…and only once per page (the same FIRST_READ guard a blank counter uses)', heal.again === 0, String(heal.again));
  say('a snapshot that carries every key is not read again on start', heal.newRefreshed === 0, String(heal.newRefreshed));

  say('no page errors', errs.length === 0, errs.slice(0, 2).join(' | ') || 'none');
  await b.close(); srv.close();
  console.log('\n' + (bad ? '✗ ' + bad + ' FAILED' : '✓ till-receive-bill: all checks passed') + '\n');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('✗ threw: ' + (e && e.stack)); process.exit(1); });
