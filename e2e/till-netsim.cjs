/* till-netsim.cjs — A LINE YOU CAN TURN DOWN ([TILL-116])
 *
 * Athi: *"give an icon to set-up network capability like switch off network reduce the speed to 2g and so on,
 * so we can see how it works… you will be able to simulate the combinations, can you?"*
 *
 * ⚠️⚠️ THE SIMULATOR IS ONLY WORTH HAVING IF IT IS FAITHFUL. The counter asks `navigator.onLine` in 34 places —
 * whether to queue a bill, whether to offer Send now, whether to try at all. A simulator that only slowed
 * fetch would leave all 34 believing the line was fine and produce behaviour no real outage causes, so the
 * assertions below are mostly about that: does the page BELIEVE it.
 *
 * ⚠️⚠️⚠️ AND A COUNTER LEFT IN "off" MUST NOT LOOK BROKEN. It persists across a reload on purpose — testing
 * whether an offline bill survives a restart is the point — so the banner is the thing that stops somebody
 * debugging a counter that was never faulty.
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const SHOTS = process.argv.includes('--shots');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log(String(l).padEnd(28) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, r));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 880 } });
  const p = await ctx.newPage();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/till.html';
  await p.goto(URL);
  await p.waitForFunction(() => typeof window.screenSet === 'function', null, { timeout: 30000 });

  console.log('\n── the settings on offer ' + '─'.repeat(36));
  const opts = await p.evaluate(() => Object.keys(NETS).map((k) => k + '=' + NETS[k].label));
  say('the line can be turned down', opts.length >= 4, opts.join('  '));

  /* ══ ⚠️⚠️ OFF MEANS OFF EVERYWHERE, not merely slow ═══════════════════════════════════════════════════ */
  console.log('\n── switched off ' + '─'.repeat(45));
  const off = await p.evaluate(async () => {
    netSet('off');
    const before = navigator.onLine;
    let threw = null;
    try { await fetchBy('/till.html', {}, 5000); } catch (e) { threw = e.name || 'Error'; }
    return { onLine: before, threw,
             banner: (document.getElementById('netbar') || {}).hidden,
             text: (document.getElementById('netbar') || { innerText: '' }).innerText.replace(/\s+/g, ' ').trim(),
             shifted: document.body.classList.contains('neton') };
  });
  /* ⭐ THE PAGE BELIEVES IT — this is what makes the simulation faithful rather than cosmetic */
  say('the page believes it is off', off.onLine === false, 'navigator.onLine is ' + off.onLine);
  say('and a request really fails', off.threw === 'TypeError', 'fetchBy rejected with ' + off.threw);
  /* ⚠️⚠️ AND IT SAYS SO — a counter quietly on a fake dead line is indistinguishable from a broken one */
  say('the banner is up', off.banner === false && /simulator/i.test(off.text), '"' + off.text.slice(0, 74) + '"');
  say('and nothing is covered', off.shifted, 'the shell moves down for the banner');

  /* ══ ⭐ A SLOW LINE DELAYS RATHER THAN FAILS ══════════════════════════════════════════════════════════ */
  console.log('\n── very slow · 2G ' + '─'.repeat(43));
  const slow = await p.evaluate(async () => {
    netSet('g2');
    const t0 = Date.now();
    let ok = false;
    try { await fetchBy('/till.html', {}, 20000); ok = true; } catch (_) {}
    return { ms: Date.now() - t0, ok, onLine: navigator.onLine };
  });
  say('2G is slow, not broken', slow.ok && slow.ms >= 1800, 'the request took ' + slow.ms + 'ms and succeeded');
  /* ⚠️ a slow line is still a line — the page must NOT think it is offline and start queueing */
  say('and still counts as online', slow.onLine === true, 'navigator.onLine stays true');

  /* ══ ⚠️⚠️ IT SURVIVES A RELOAD, which is the point — and must announce itself when it does ═══════════ */
  console.log('\n── after a restart ' + '─'.repeat(42));
  const p2 = await ctx.newPage();
  await p2.goto(URL);
  await p2.waitForFunction(() => typeof window.screenSet === 'function', null, { timeout: 30000 });
  await p2.waitForTimeout(400);
  const after = await p2.evaluate(() => ({
    now: netNow(),
    banner: (document.getElementById('netbar') || {}).hidden,
    text: (document.getElementById('netbar') || { innerText: '' }).innerText.replace(/\s+/g, ' ').trim(),
  }));
  say('the setting survives', after.now === 'g2', 'it came back on "' + after.now + '"');
  /**
   * ⚠️⚠️⚠️ AND ANNOUNCES ITSELF IMMEDIATELY. A persisted setting with no banner is the whole hazard: the person
   * who finds the counter is not the person who set it, and they will debug a fault that does not exist.
   */
  say('and says so on load', after.banner === false && /simulator/i.test(after.text), '"' + after.text.slice(0, 70) + '"');

  /* ══ ⭐ AND ONE CLICK BACK ════════════════════════════════════════════════════════════════════════════ */
  const back = await p2.evaluate(async () => {
    document.querySelector('[data-testid="till-net-off"]').click();
    await new Promise((r) => setTimeout(r, 100));
    return { now: netNow(), banner: (document.getElementById('netbar') || {}).hidden, onLine: navigator.onLine };
  });
  say('one click restores it', back.now === 'full' && back.banner === true, 'back to full speed, banner gone');

  if (SHOTS) {
    await p2.evaluate(() => netSet('off'));
    const out = path.join(__dirname, '..', 'png', 'NetSim.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await p2.screenshot({ path: out });
    console.log('  shot                        · png/NetSim.png');
  }

  await b.close(); srv.close();
  console.log(bad ? '\n' + bad + ' failed' : '\nthe line can be turned down, and it says so while it is');
  process.exit(bad ? 1 : 0);
})();
