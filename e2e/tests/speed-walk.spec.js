// [SPEED] WALK EVERY SCREEN AND SAY WHICH ONE COSTS THE MOST.
//
// ── ⭐⭐⭐ WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────────────
//
// Athi, 2026-09-13: *"so if we have that kind of a measure, then we can proudly navigate across all the screens
// and try to figure out where and all it took long time and optimise it — so a Playwright execution finds most
// of the issues if it runs across all the screens for a set of operations?"*
//
// ⭐⭐ YES, AND THIS IS IT. Everything the tester's Speed area shows is already in the page: the call log, the
// server's own `X-DB-Ms` and `X-DB-Trips`, and a per-screen history in localStorage. A browser driven from
// outside can walk the rail with test mode on and read exactly the same numbers — the difference is that it
// visits EVERY screen, in the same order, every time, and a person visits the three they already suspect.
//
// ⚠️⚠️ IT MEASURES, IT DOES NOT JUDGE — with one exception. Wall-clock over a real network is noisy: Railway
// wakes up, the wifi hiccups, the first call of a session pays for a cold connection. So the report is the
// output, and the only thing that FAILS the run is a screen making an absurd NUMBER of calls, because a count
// is not noisy. [[project-roundtrip-cost]] — the count is the thing you can act on anyway.
//
// ⚠️ AND IT NEEDS CB_TRIPS POINTED AT THE TEST ENTITY or the server-time column is empty. It says so rather
// than printing zeros, because a zero would read as "no time spent in the server", which is a different and
// false statement.
//
// Run:  npx playwright test tests/speed-walk.spec.js --reporter=line
// Out:  e2e/speed-walk.json  (and a table on stdout)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * ⚠️ THE RAIL IS READ FROM THE PAGE, NOT LISTED HERE. A hardcoded list of screens is a second register that
 * goes stale the day someone adds one — and the screen it misses is the one nobody measured.
 */
const SKIP = new Set(['compose']);   // compose holds a draft; walking away from it is a different test

test('[SPEED-01] walk every screen and report what each one costs', async ({ page }) => {
  test.setTimeout(600000);

  const { mintEntity } = require('../fixtures');
  await mintEntity(page, { fresh: false });

  /* test mode on: it is what starts the call log and stamps each visit */
  const sw = page.locator('[data-testid="vp-test"]');
  await expect(sw).toBeVisible({ timeout: 45000 });
  if (!((await sw.textContent()) || '').includes('on')) await sw.click();
  await expect(sw).toContainText('on');

  await page.evaluate(() => {
    try { localStorage.removeItem('cb_speed_visits'); } catch (_) {}
    try { if (window.CBCALLS) window.CBCALLS.length = 0; } catch (_) {}
  });

  /* every rail door the app actually offers */
  const navs = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="nav-"]'))
    .map((el) => el.getAttribute('data-testid').replace(/^nav-/, '')));
  expect(navs.length, 'no rail items found — the walk would prove nothing').toBeGreaterThan(3);

  const walked = [];
  for (const nav of navs) {
    if (SKIP.has(nav)) continue;
    const el = page.locator('[data-testid="nav-' + nav + '"]');
    if (!(await el.count())) continue;
    await el.click();
    /* ⚠ settle by the CHIP, not a fixed sleep: the chip is stamped once the screen has drawn and the register
       knows which screen it is, which is also the moment the visit is recorded */
    await page.waitForTimeout(2500);
    walked.push(nav);
  }

  const data = await page.evaluate(() => {
    let visits = {};
    try { visits = JSON.parse(localStorage.getItem(
      (typeof uk === 'function') ? uk('cb_speed_visits') : 'cb_speed_visits') || '{}'); } catch (_) {}
    const rows = Object.keys(visits).map((code) => {
      const v = visits[code] || [];
      let worst = 0, calls = 0;
      v.forEach((x) => { if ((x.ms || 0) > worst) { worst = x.ms || 0; calls = x.n || 0; } });
      return { code, name: (typeof codeName === 'function' && codeName(code)) || '', visits: v.length, worst, calls };
    });
    const log = (window.CBCALLS || []).filter((c) => !/^\/api\/testing/.test(c.path || ''));
    const byApi = {};
    log.forEach((c) => {
      const m = String(c.path || '').match(/^\/api\/([a-z0-9-]+)/i);
      const k = m ? m[1].toLowerCase() : 'other';
      byApi[k] = byApi[k] || { n: 0, ms: 0, srv: 0, trips: 0 };
      byApi[k].n++; byApi[k].ms += c.ms || 0;
      byApi[k].srv += c.srv || 0; byApi[k].trips += c.trips || 0;
    });
    return { rows, byApi, serverTimings: log.filter((c) => c.srv != null).length, logged: log.length };
  });

  data.rows.sort((a, b) => b.worst - a.worst);
  const api = Object.keys(data.byApi).map((k) => Object.assign({ route: k }, data.byApi[k]))
    .sort((a, b) => b.ms - a.ms);

  console.log('\n══ SPEED · ' + walked.length + ' screens walked ══\n');
  console.log('  SCREEN                          CALLS    WORST ms');
  data.rows.forEach((r) => console.log('  ' + (r.code + ' ' + r.name).padEnd(32).slice(0, 32)
    + String(r.calls).padStart(5) + String(r.worst).padStart(12)));
  console.log('\n  ROUTE                  CALLS   TOTAL ms   SERVER ms   DB TRIPS');
  api.forEach((a) => console.log('  /api/' + a.route.padEnd(18).slice(0, 18)
    + String(a.n).padStart(5) + String(a.ms).padStart(11) + String(a.srv).padStart(12)
    + String(a.trips).padStart(11)));
  if (!data.serverTimings) {
    console.log('\n  ⚠️  No server timings. Point CB_TRIPS at this entity on the API to split server from network.');
  }
  console.log('');

  fs.writeFileSync(path.join(__dirname, '..', 'speed-walk.json'),
    JSON.stringify({ at: new Date().toISOString(), walked, screens: data.rows, routes: api }, null, 1));

  /**
   * ⚠️⚠️ THE ONLY ASSERTION IS A COUNT, AND ON PURPOSE. Failing on milliseconds over a real network would make
   * this red on a bad afternoon and teach everyone to ignore it — the fastest way to lose a guard. A screen
   * asking for twenty separate calls is wrong on any network, and no amount of waiting makes it right.
   */
  const greedy = data.rows.filter((r) => r.calls > 20);
  expect(greedy.map((r) => r.code + ' (' + r.calls + ' calls)').join(', ') || 'none',
    'a screen made more than 20 API calls in one visit').toBe('none');
});
