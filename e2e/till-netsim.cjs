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

  /* ══ ⚠️⚠️⚠️ AND A REFRESH ON A DEAD LINE SAYS SO ([TILL-143]) ══════════════════════════════════════════
   *
   * Athi: *"when i set the network speed to stop, and when i try to refresh the shop, what it is suppose to
   * say?"* It said NOTHING — netGate rejects, nobody caught it, the busy box vanished and the rejection went
   * unhandled. A counter that swallows a failed read teaches its owner that the button does nothing.
   *
   * ⚠️ AND THE SERVER-ERROR PATH LIED: {ok:false,status:500} fell through and toasted "up to date".
   */
  console.log('\n── a refresh that could not happen ' + '─'.repeat(26));
  const fail = await p2.evaluate(async () => {
    netSet('off');
    CloudHost.key = 'test-key'; CloudHost.api = location.origin; HOST = CloudHost;
    document.getElementById('lastnote').textContent = '';
    await refresh();
    return { note: document.getElementById('lastnote').textContent,
             busy: (document.getElementById('busy') || {}).hidden };
  });
  say('it does not fail silently', /./.test(fail.note), '"' + fail.note + '"');
  say('it names what went wrong', /could not read the shop/i.test(fail.note), 'the read is reported as failed');
  /* ⭐ THE HALF THAT MATTERS TO A SHOPKEEPER — a failed READ costs nothing, and he should be told that */
  say('and says billing carries on', /billing carries on|no prices on this counter/i.test(fail.note),
      'it says what still works');
  /* ⚠️⚠️ NEVER DIAGNOSE A FAULT SOMEBODY CHOSE ([TILL-140]) */
  say('and owns up to the simulator', /simulator/i.test(fail.note), 'it does not blame a real router');
  say('and the busy box gets out of the way', fail.busy === true, 'busyDone ran');

  const lied = await p2.evaluate(async () => {
    netSet('full');
    HOST = { mode: 'cloud', refresh: async () => ({ ok: false, status: 500 }) };
    document.getElementById('lastnote').textContent = '';
    await refresh();
    return document.getElementById('lastnote').textContent;
  });
  say('a refused read is not "up to date"', !/up to date/i.test(lied) && /error \(500\)/.test(lied),
      '"' + lied + '"');

  /* ══ ⭐⭐⭐ AND IT SAYS WHAT IT BREAKS, AT THE PLACE YOU SWITCH IT ON ([TILL-144]) ════════════════════
   *
   * Athi: *"can you bring what are to be affected in the test location itself? … what will be other issues
   * to be listed? can we make it explicit?"* A simulator that will not name its consequences makes a tester
   * guess which failures are theirs — and a guess goes wrong in both directions.
   */
  console.log('\n── what the simulation affects ' + '─'.repeat(30));
  const what = await p2.evaluate(async () => {
    netSet('off');
    document.querySelector('[data-testid="till-net-what"]').click();
    await new Promise((r) => setTimeout(r, 120));
    const el = document.getElementById('netwhat');
    return { open: el.hidden === false, text: el.innerText.replace(/\s+/g, ' ').trim(),
             stop: el.querySelectorAll('.stop li').length, goes: el.querySelectorAll('.goes li').length };
  });
  say('the list opens from the bar', what.open, 'the panel is there beside the switch');
  say('and it is specific, not "things may not work"', what.stop >= 8, what.stop + ' named consequences');
  /* ⭐ THE HALF A TESTER NEEDS MOST — what is still expected to work, so a real fault stands out */
  say('it also says what still works', what.goes >= 1, what.goes + ' still working');
  say('and that billing is not at risk', /never touch/i.test(what.text), 'billing is excluded, and says why');
  /* ⚠️⚠️ THE ROWS THAT COST REAL MONEY IF A TESTER DOES NOT KNOW THEY STOPPED */
  ['Bills leaving this counter', 'Closing the counter', 'Live updates'].forEach((n) => {
    say('it names: ' + n.toLowerCase(), what.text.indexOf(n) >= 0, 'listed');
  });

  /* ══ ⚠️⚠️⚠️ AND THE WATCHDOG REPORTS THE SAME ROWS WHEN ONE REALLY STOPS ════════════════════════════ */
  console.log('\n── the watchdog ' + '─'.repeat(45));
  const dog = await p2.evaluate(async () => {
    netSet('full');
    WATCH_WAS = null;
    document.getElementById('lastnote').textContent = '';   /* the previous section left a line here */
    watchTick();                                  /* the baseline — must say nothing */
    const first = document.getElementById('lastnote').textContent;
    /* ⚠️ a REAL fault, not a simulated one: the device stops being able to save */
    MEM.fail = true;
    document.getElementById('lastnote').textContent = '';
    watchTick();
    const spoke = document.getElementById('lastnote').textContent;
    document.getElementById('lastnote').textContent = '';
    watchTick();                                  /* nothing changed — must not repeat itself */
    const again = document.getElementById('lastnote').textContent;
    MEM.fail = false;
    document.getElementById('lastnote').textContent = '';
    watchTick();
    const back = document.getElementById('lastnote').textContent;
    return { first, spoke, again, back, rows: watchNow().length };
  });
  say('one list, both readers', dog.rows >= 10, dog.rows + ' rows watched');
  say('the first reading is a baseline', dog.first === '', 'it does not announce the state it started in');
  say('a real fault is reported', /Saving a bill/.test(dog.spoke) && /lose work/i.test(dog.spoke),
      '"' + dog.spoke + '"');
  /* ⚠️ a line that repeats every 15s is wallpaper, and wallpaper is how the next real one is missed */
  say('and it does not repeat itself', dog.again === '', 'silent while nothing changes');
  say('and it says when it comes back', /working again/i.test(dog.back), '"' + dog.back + '"');

  /* ⚠️⚠️ NEVER DIAGNOSE A FAULT SOMEBODY CHOSE ([TILL-140]) — except the one that loses work */
  const quiet = await p2.evaluate(async () => {
    netSet('off');
    WATCH_WAS = null; watchTick();
    document.getElementById('lastnote').textContent = '';
    WATCH_WAS = '';                                /* pretend everything was fine a moment ago */
    watchTick();
    const said = document.getElementById('lastnote').textContent;
    MEM.fail = true;
    document.getElementById('lastnote').textContent = '';
    WATCH_WAS = '';
    watchTick();
    const loud = document.getElementById('lastnote').textContent;
    MEM.fail = false; netSet('full');
    return { said, loud };
  });
  say('it stays quiet about a simulated outage', quiet.said === '', 'the bar is already saying so');
  say('but never about losing work', /Saving a bill/.test(quiet.loud), '"' + quiet.loud + '"');

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
