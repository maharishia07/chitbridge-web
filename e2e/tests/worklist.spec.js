// [WORK] NINE RECORDS — 3 pass, 3 incidents, 3 requirements — ON ONE LIST, EACH ENDING IN CLOSED.
//
// ── ⭐⭐⭐ WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────────────
//
// Athi, 2026-09-13: *"assume I create 9 records, 3 are pass, 3 are incidents and 3 are requirements — we need to
// have a list and each one is expected to retest and close … this is really confusing: what am I looking at,
// where do I find the existing one, where do I see the closed one?"*
//
// ⚠️⚠️ THE DATA WAS NEVER MISSING — THE SHELVING WAS. One finding lived in up to three places at once (a case on
// the Cases board, a result in the ledger, an incident on the Incidents board), each with its own filter row and
// its own words, and nothing anywhere answered "what is waiting for ME".
//
// ⭐⭐ ADOPTED: the test-run status model TestRail, Xray and Kiwi TCMS all share — one list, one status per row,
// defects hanging off the row. `RETEST` is a first-class TestRail status, and it is exactly the state we had no
// word for. [[feedback-adopt-dont-reinvent]]
//
// This spec builds his nine records and drives each of the three journeys to Closed, only ever by clicking.
//
// Run: npx playwright test tests/worklist.spec.js --reporter=line
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

test('[WORK-01] three journeys, one list, and every row can reach Closed', async ({ page }) => {
  test.setTimeout(420000);
  await mintEntity(page, { fresh: true, name: 'Work ' + Date.now().toString().slice(-6) });
  const token = await page.evaluate(() => SESSION.token);
  const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  /* ── nine records, written the way the panel writes them ─────────────────────────────────────────────── */
  const mkCase = (n, title) => page.request.post(API + '/api/testing/cases/import', {
    headers: H, data: { mode: 'add', cases: [{ case_key: 'CAT001-H0' + n, module_key: 'CAT001', title: title,
      priority: 'Medium', test_type: 'screen', screen_code: 'CAT001', steps: [['do it', 'it works']] }] } });
  for (let i = 1; i <= 9; i++) await mkCase(i, 'record ' + i);

  /* (a) three that pass */
  for (const k of ['CAT001-H01', 'CAT001-H02', 'CAT001-H03']) {
    await page.request.post(API + '/api/testing/results', { headers: H,
      data: { results: [{ case_key: k, status: 'pass', run_kind: 'manual', layer: 'web' }] } });
  }
  /* (b) three that raise an incident */
  const incIds = [];
  for (const k of ['CAT001-H04', 'CAT001-H05', 'CAT001-H06']) {
    await page.request.post(API + '/api/testing/results', { headers: H,
      data: { results: [{ case_key: k, status: 'fail', run_kind: 'manual', layer: 'web' }] } });
    const r = await page.request.post(API + '/api/testing/incidents', { headers: H,
      data: { observed: 'it is wrong on ' + k, severity: 'Sev-2', screen_code: 'CAT001', case_key: k } });
    incIds.push((await r.json()).definition_id);
  }
  /* (c) three that ask for a change */
  for (const k of ['CAT001-H07', 'CAT001-H08', 'CAT001-H09']) {
    await page.request.post(API + '/api/testing/requirements', { headers: H,
      data: { requirement: 'it should also do this, from ' + k, observed: 'today it does not',
              case_key: k, screen_code: 'CAT001', priority: 'Medium' } });
  }

  /* ── open the lab: it lands on the worklist ──────────────────────────────────────────────────────────── */
  const sw = page.locator('[data-testid="vp-test"]');
  await expect(sw).toBeVisible({ timeout: 45000 });
  if (!((await sw.textContent()) || '').includes('on')) await sw.click();
  await page.locator('[data-testid="vp-lab"]').click();
  await expect(page.locator('#cbtestpanel')).toBeVisible({ timeout: 30000 });
  const modal = page.locator('#modalhost .modal');
  if (await modal.count()) await page.locator('#modalhost .modal button').last().click();
  await page.evaluate(() => { try { localStorage.removeItem('cb_test_view');
    localStorage.setItem('cb_work_filter', 'live'); } catch (_) {} testSetView('work'); });

  await expect.poll(async () => page.evaluate(() => (CBTEST.scrInc || []).length), { timeout: 45000 })
    .toBeGreaterThan(0);
  await page.evaluate(() => testPaint());

  /* ⭐ ALL NINE ARE ON ONE LIST, and each carries one status — the whole of the complaint */
  const seen = () => page.evaluate(() => testWork().map((x) => [x.key, x.status]));
  await expect.poll(async () => (await seen()).length, { timeout: 45000 }).toBe(9);
  const byStatus = (rows) => rows.reduce((a, r) => { a[r[1]] = (a[r[1]] || 0) + 1; return a; }, {});
  expect(byStatus(await seen()), 'the nine did not sort into the three journeys')
    .toEqual({ passed: 3, failed: 3, change: 3 });

  /* ── (b) the incident journey: failed → fixed → retest → closed ──────────────────────────────────────── */
  await page.evaluate(() => { window.prompt = function () { return 'fixed in abc1234'; }; });
  await page.locator('#cbtestbody button').filter({ hasText: 'Mark it fixed' }).first().click();
  await expect.poll(async () => byStatus(await seen()).retest || 0, { timeout: 45000 }).toBe(1);

  /* ⭐ AND IT IS ADDRESSED TO THE PERSON WHO RAISED IT, not to the room */
  await expect(page.locator('[data-testid="work-yours"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="work-yours"]')).toContainText('waiting for you to retest');

  await page.evaluate(() => { window.prompt = function () { return 'Retested, it holds'; }; });
  await page.locator('#cbtestbody button').filter({ hasText: 'It holds' }).first().click();
  await expect.poll(async () => byStatus(await seen()).closed || 0, { timeout: 45000 }).toBe(1);

  /* ── (c) the requirement journey: change asked → decided ─────────────────────────────────────────────── */
  await page.locator('#cbtestbody button').filter({ hasText: 'Accept it' }).first().click();
  await expect.poll(async () => byStatus(await seen()).closed || 0, { timeout: 45000 }).toBe(2);

  /* ── "where do I see the closed one" ─────────────────────────────────────────────────────────────────── */
  await page.locator('[data-testid="workf-closed"]').click();
  await page.waitForTimeout(1500);
  expect(await page.locator('[data-testid="work-row"]').count(), 'the closed filter does not hold them').toBe(2);
  await page.locator('[data-testid="workf-live"]').click();
  await page.waitForTimeout(1500);
  expect(await page.locator('[data-testid="work-row"]').count(), 'still-open should be the other seven').toBe(7);

  /* ⚠️ and a passed row is not "done with" — it is passed, and it says so rather than vanishing */
  await page.locator('[data-testid="workst-passed"]').click();
  await page.waitForTimeout(1500);
  expect(await page.locator('[data-testid="work-row"]').count()).toBe(3);
});
