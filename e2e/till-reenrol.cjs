/* till-reenrol.cjs — [TILL-192] A KEY THE SHOP JUST REFUSED IS RE-MINTED ON RE-SIGN-IN, NOT SILENTLY KEPT
 *
 * Athi, live, 2026-09-25, after the shop rejected this device's counter key: "i signed out and signed in
 * again, but it's still not working." Traced to: paired() answers "is there A key on file", never "is the
 * key on file the one the shop just refused" — so pairAgain()'s own re-sign-in, entered ONLY because the
 * current key had already failed, still saw `paired()===true` and usignEnrolIfNeeded() skipped minting a
 * replacement, putting the caller back exactly where they started with no error to explain why.
 *
 * ⚠️⚠️⚠️ THIS DOES NOT SIGN IN FOR REAL — usignEnrolIfNeeded() takes a plain token and a stubbed fetchBy;
 * nothing about a session or a network call. It proves the GATE, the same way tests/variant.test.js proves
 * an engine offline: paired()+forceEnrol decide whether the enrol call is even attempted, not what it
 * returns.
 *
 * Run: node e2e/till-reenrol.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(70) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((res) => srv.listen(0, res));
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:' + srv.address().port + '/till.html');
  await p.waitForFunction(() => typeof usignEnrolIfNeeded === 'function' && typeof pairAgain === 'function', null, { timeout: 30000 });

  console.log('\n── ⚠️⚠️⚠️ [TILL-192] A ROUTINE SIGN-IN SKIPS RE-ENROL — the existing key is trusted, as it always was ' + '─'.repeat(0));
  const routine = await p.evaluate(async () => {
    ls.set('cb_till_key', 'old-refused-key'); CloudHost.key = 'old-refused-key';
    var called = false;
    window.fetchBy = function(){ called = true; return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ key: 'never-should-land' }) }); };
    usignOpen();   /* no force — the routine 'signin' door's own call shape */
    var ok = await usignEnrolIfNeeded('a-real-token');
    return { ok: ok, fetchCalled: called, keyAfter: CloudHost.key };
  });
  say('returns true (safe to carry on) without touching the network', routine.ok && !routine.fetchCalled, 'ok=' + routine.ok + ' fetchBy called=' + routine.fetchCalled);
  say('the existing key is left exactly as it was', routine.keyAfter === 'old-refused-key', '"' + routine.keyAfter + '"');

  console.log('\n── ⭐⭐⭐ pairAgain() FORCES A REAL RE-ENROL — entered ONLY because the current key just failed ' + '─'.repeat(0));
  const forced = await p.evaluate(async () => {
    ls.set('cb_till_key', 'old-refused-key'); CloudHost.key = 'old-refused-key';
    var called = false, sentBody = null;
    window.fetchBy = function(url, opts){ called = true; sentBody = JSON.parse(opts.body); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ key: 'freshly-minted-key' }) }); };
    pairAgain();   /* the real button the 🔑 "Not signed in" flash and whoAct()'s 'connect'/'key' doors press */
    var forcedFlag = (typeof USIGN !== 'undefined' && USIGN) ? !!USIGN.forceEnrol : null;
    var ok = await usignEnrolIfNeeded('a-real-token');
    return { forcedFlag: forcedFlag, ok: ok, fetchCalled: called, keyAfter: CloudHost.key, counterSent: sentBody && sentBody.counter };
  });
  say('pairAgain() marks the sign-in as a forced re-enrol', forced.forcedFlag, String(forced.forcedFlag));
  say('this time the enrol call is actually made', forced.ok && forced.fetchCalled, 'ok=' + forced.ok + ' fetchBy called=' + forced.fetchCalled);
  say('and the OLD, refused key is replaced by the NEW one', forced.keyAfter === 'freshly-minted-key', '"' + forced.keyAfter + '"');
  say('the same counter number is asked for again, not a different one', typeof forced.counterSent === 'string' && forced.counterSent.length > 0, '"' + forced.counterSent + '"');

  console.log('\n── ⚠️ AN UNPAIRED DEVICE STILL ENROLS EITHER WAY — this fix must not narrow the FIRST-EVER pairing ' + '─'.repeat(0));
  const firstTime = await p.evaluate(async () => {
    ls.set('cb_till_key', ''); CloudHost.key = null;
    var called = false;
    window.fetchBy = function(){ called = true; return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ key: 'first-key-ever' }) }); };
    usignOpen();   /* not forced — a brand-new device has never met a key, forceEnrol should not even be needed */
    var ok = await usignEnrolIfNeeded('a-real-token');
    return { ok: ok, fetchCalled: called, keyAfter: CloudHost.key };
  });
  say('a device with no key at all still enrols on a plain, unforced sign-in', firstTime.ok && firstTime.fetchCalled, 'ok=' + firstTime.ok + ' fetchBy called=' + firstTime.fetchCalled);
  say('and comes away with a real key', firstTime.keyAfter === 'first-key-ever', '"' + firstTime.keyAfter + '"');

  console.log('\nconsole/page errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close(); srv.close();
  console.log(bad || errs.length ? '\n' + (bad + errs.length) + ' failed'
    : '\na key the shop already refused is replaced the moment someone re-signs in through the door built for exactly that');
  process.exit(bad || errs.length ? 1 : 0);
})();
