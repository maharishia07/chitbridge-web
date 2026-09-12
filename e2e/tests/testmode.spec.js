// [TM] TEST MODE — THE TESTER'S OWN TOOL, DRIVEN.
//
// ── ⭐⭐⭐ WHY THIS SPEC EXISTS ─────────────────────────────────────────────────────────────────────────────────
//
// Athi, 2026-09-13: *"use playwright to test the testing tool."*
//
// ⚠️⚠️ THIS IS THE TOOL A TESTER USES, so when it is wrong it does not fail loudly — it records the wrong thing,
// or nothing, and everybody trusts the board anyway. In one sitting Athi found SIX faults in it by hand and not
// one was caught by a guard, because every one of them lived where two STATES met rather than inside a feature:
//
//     test mode        on · off
//     the lab panel    open · closed
//     the board        read · not read
//     what is in front screen · record · dialog
//
// ⭐ So this spec is written by combination. The most valuable test in it is TM-03: a verdict recorded with the
// lab NEVER OPENED. That is the exact state that broke, and the state nobody thinks to try, because everybody
// who built it had opened the lab first.
//
// ⚠️ IT DRIVES CONTROLS, NOT FUNCTIONS. The chip is clicked, the buttons are pressed — otherwise the one thing
// that could be broken (a missing global, a wrong id, a handler on the wrong element) is exactly what is
// skipped. The two exceptions are marked where they occur and say why.
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

const tokenOf = (p) => p.evaluate(() => SESSION.token);

/**
 * turn test mode on through its own switch, and wait for the board it reads.
 *
 * ⚠⚠ THE REMEMBERED PREFERENCES ARE CLEARED FIRST, and that is not tidiness. The case filter and the lab
 * view are kept in localStorage — rightly, a tester works one way all day — so TM-10 leaving the filter on
 * “Passed” made TM-12 and TM-13 read a list with their own new case filtered OUT of it. Both passed alone and
 * failed in the batch: the most expensive kind of failure, because it reads as a regression in whatever was
 * changed last.
 */
async function modeOn(page) {
  await page.evaluate(() => {
    try { localStorage.removeItem('cb_case_filter'); localStorage.removeItem('cb_test_view');
          localStorage.removeItem('cb_test_scrsort');
          /* ⚠ and the panel's own area — the third remembered preference to leak between tests */
          localStorage.removeItem('cb_case_area'); } catch (_) {}
  });
  const sw = page.locator('[data-testid="vp-test"]');
  /* ⚠ a freshly minted entity can take a while to paint the top bar — wait, do not assume */
  await expect(sw).toBeVisible({ timeout: 45000 });
  if (!(await sw.textContent() || '').includes('on')) await sw.click();
  await expect(sw).toContainText('on');
  /* ⭐ the chip only appears once the board has been read — waiting for it IS the assertion that mode reads it */
  await expect(page.locator('[data-testid="screen-cases"]').first()).toBeVisible({ timeout: 30000 });
}

/**
 * ⭐ the first time the lab is opened it explains itself in a modal — by design (“the first tick explains
 * itself”). A spec has seen it before, so it closes it; a modal backdrop otherwise swallows every click.
 */
async function dismissModal(page) {
  const m = page.locator("#modalhost .modal");
  if (await m.count()) {
    await page.evaluate(() => { try { closeModal(); } catch (_) {} });
    await expect(m).toHaveCount(0);
  }
}

/** the panel, opened the way a tester opens it: by the chip on the screen */
async function openPanel(page) {
  await page.locator('[data-testid="screen-cases"]').first().click();
  await expect(page.locator('#cbcasespanel')).toBeVisible();
}

async function writeCase(page, { req, op, exp, got }, outcome) {
  /* ⭐ the panel opens on CASES when a screen has any, so writing starts by asking for the Write area —
     which is what a tester does too. */
  if (!(await page.locator('#wcTitle').count())) {
    await page.locator('#cbcasesbody button', { hasText: /^Write$/ }).first().click();
    await expect(page.locator('#wcTitle')).toBeVisible();
  }
  await page.fill('#wcTitle', req);
  await page.fill('#wcDo', op);
  await page.fill('#wcSee', exp);
  if (got) await page.fill('#wcGot', got);
  const label = outcome === 'inc' ? 'Incident' : outcome === 'req' ? 'Requirement'
              : outcome === 'pass' ? 'Pass' : 'Save';
  await page.locator('#cbcasespanel button', { hasText: new RegExp('^' + label + '$') }).first().click();
}

test.describe('test mode', () => {

  test('[TM-01] the chip is off for everyone who is not testing', async ({ page }) => {
    test.setTimeout(180000);
    await mintEntity(page, { fresh: true, name: 'TM one ' + Date.now().toString().slice(-6) });

    /* ⚠️ a shopkeeper billing a customer must never see a testing control on their counter */
    await expect(page.locator('[data-testid="screen-code"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="screen-cases"]')).toHaveCount(0);

    await modeOn(page);
    await expect(page.locator('[data-testid="screen-cases"]').first()).toBeVisible();

    /* and off again takes them away */
    await page.locator('[data-testid="vp-test"]').click();
    await expect(page.locator('[data-testid="vp-test"]')).toContainText('off');
    await expect(page.locator('[data-testid="screen-cases"]')).toHaveCount(0);
  });

  test('[TM-02] the switch and the lab are two different things', async ({ page }) => {
    test.setTimeout(180000);
    await mintEntity(page, { fresh: true, name: 'TM two ' + Date.now().toString().slice(-6) });
    await modeOn(page);

    /* the lab is its own door and does not exist until it is opened */
    await expect(page.locator('#cbtesthost')).toHaveCount(0);
    await page.locator('[data-testid="vp-lab"]').click();
    /* ⚠ the PANEL, not the host: #cbtesthost is a zero-size wrapper and Playwright rightly calls it hidden */
    await expect(page.locator('#cbtestpanel')).toBeVisible();
    await dismissModal(page);

    /**
     * ⚠️ CLOSING THE LAB MUST NOT TURN THE MODE OFF. Until 2026-09-12 they were one button, so a person putting
     * the board away lost the chips they were using.
     */
    await page.locator('#cbtesthead button[title="Close the lab"]').click();
    await expect(page.locator('#cbtesthost')).toHaveCount(0);
    await expect(page.locator('[data-testid="vp-test"]')).toContainText('on');
    await expect(page.locator('[data-testid="screen-cases"]').first()).toBeVisible();
  });

  test('[TM-03] a verdict records with the lab NEVER opened', async ({ page }) => {
    test.setTimeout(240000);
    await mintEntity(page, { fresh: true, name: 'TM three ' + Date.now().toString().slice(-6) });

    /**
     * ⚠️⚠️ THE FAULT THIS SPEC EXISTS FOR. The run every verdict belongs to was created as a side effect of
     * opening the lab, so recording from a screen threw "cannot read properties of null (reading id)".
     * Clearing the saved run reproduces a genuinely first-ever sitting.
     */
    await page.evaluate(() => { try { localStorage.removeItem('cb_testrun'); } catch (_) {} });
    await page.reload();
    await modeOn(page);
    await expect(page.locator('#cbtesthost')).toHaveCount(0);   // the lab is NOT open, and must not be

    await openPanel(page);
    await writeCase(page, {
      req: 'The screen opens and names itself',
      op: 'Open it from the rail',
      exp: 'The code in the corner is the one this case is filed under',
      got: 'As expected.',
    }, 'pass');

    /* ⚠️ the assertion is the COUNT MOVING, not the absence of a toast: a verdict that recorded but did not
       repaint reads to a tester exactly like a press that did not land. The tally lives in the HEADER since
       the panel gained its three areas. */
    await expect(page.locator('#cbcaseshead')).toContainText('1', { timeout: 30000 });
    await expect(page.locator('#cbcasesbody')).toContainText('Cases 1', { timeout: 30000 });
    await page.locator('#cbcasesbody button', { hasText: /^Cases/ }).first().click();
    await expect(page.locator('#cbcasesbody')).toContainText('Passed 1', { timeout: 20000 });
  });

  test('[TM-04] the panel follows the screen and the record', async ({ page }) => {
    test.setTimeout(240000);
    await mintEntity(page, { fresh: true, name: 'TM four ' + Date.now().toString().slice(-6) });
    await modeOn(page);
    await openPanel(page);

    const head = page.locator('#cbcaseshead');
    const first = await head.textContent();

    await page.locator('[data-testid="nav-catalogue"]').click();
    await expect(head).toContainText('CAT', { timeout: 20000 });
    const second = await head.textContent();
    expect(second).not.toBe(first);

    await page.locator('[data-testid="nav-suppliers"]').click();
    await expect(head).toContainText('BUS002', { timeout: 20000 });
    await expect(page.locator('#cbcasespanel')).toBeVisible();   // it followed; it did not close
  });

  test('[TM-05] it does NOT follow while you are typing', async ({ page }) => {
    test.setTimeout(240000);
    await mintEntity(page, { fresh: true, name: 'TM five ' + Date.now().toString().slice(-6) });
    await modeOn(page);
    await openPanel(page);

    await page.fill('#wcTitle', 'half a sentence I have not finished');
    const before = await page.locator('#cbcaseshead').textContent();

    await page.locator('[data-testid="nav-catalogue"]').click();
    await page.waitForTimeout(2500);

    /* ⚠️ following the reader is helpful; throwing away their half-written sentence is not */
    /* ⚠ the CODE, not the whole header: the incident and requirement counts arrive a beat later and
       would fail an exact-text match for a reason that has nothing to do with following. */
    await expect(page.locator('#cbcaseshead')).toContainText(before.replace(/[^A-Z0-9]/g, '').slice(0, 6));
    await expect(page.locator('#wcTitle')).toHaveValue('half a sentence I have not finished');
  });

  test('[TM-06] a case cannot be written without an expectation', async ({ page }) => {
    test.setTimeout(240000);
    await mintEntity(page, { fresh: true, name: 'TM six ' + Date.now().toString().slice(-6) });
    await modeOn(page);
    await openPanel(page);

    await expect(page.locator('#cbcasesbody')).toContainText('Cases 0');
    await page.locator('#cbcasespanel button', { hasText: /^Save$/ }).first().click();
    await page.waitForTimeout(1500);
    /* ⚠ nothing was written — asserted on the COUNT, not on a prefix of the panel text, which now carries
       counts that arrive a beat later and would fail for a reason unrelated to the refusal */
    await expect(page.locator('#cbcasesbody')).toContainText('Cases 0');

    await page.fill('#wcTitle', 'only the requirement');
    await page.locator('#cbcasespanel button', { hasText: /^Save$/ }).first().click();
    await page.waitForTimeout(1200);
    await expect(page.locator('#wcTitle')).toHaveValue('only the requirement');  // still unsaved, still there
  });

  test('[TM-09] several cases on one screen, and Cancel is not a one-way door', async ({ page }) => {
    test.setTimeout(300000);
    await mintEntity(page, { fresh: true, name: 'TM nine ' + Date.now().toString().slice(-6) });
    await modeOn(page);
    await openPanel(page);

    await writeCase(page, { req: 'first thing that must be true', op: 'do the first thing', exp: 'the first result' });
    await expect(page.locator('#cbcasesbody')).toContainText('Cases 1', { timeout: 30000 });
    /* ⚠️ the form must still be standing, and empty — saving used to remove it, so the first case was the last */
    await expect(page.locator('#wcTitle')).toHaveValue('');

    await writeCase(page, { req: 'second thing that must be true', op: 'do the second thing', exp: 'the second result' });
    await expect(page.locator('#cbcasesbody')).toContainText('Cases 2', { timeout: 30000 });

    await page.locator('#cbcasespanel button', { hasText: /^Cancel$/ }).first().click();
    await expect(page.locator('#wcTitle')).toHaveCount(0);
    await page.locator('#cbcasespanel button', { hasText: /New test case/ }).first().click();
    await expect(page.locator('#wcTitle')).toBeVisible();
  });

  test('[TM-10] a passed case stands down, and comes back on Re-test', async ({ page }) => {
    test.setTimeout(300000);
    await mintEntity(page, { fresh: true, name: 'TM ten ' + Date.now().toString().slice(-6) });
    await modeOn(page);
    await openPanel(page);

    await writeCase(page, { req: 'a thing that passes', op: 'do it', exp: 'it works', got: 'As expected.' }, 'pass');
    await expect(page.locator('#cbcasesbody')).toContainText('Cases 1', { timeout: 30000 });

    /* ⭐ the panel stays on Write after a verdict — by design — so the piles are asked for */
    await page.locator('#cbcasesbody button', { hasText: /^Cases/ }).first().click();

    /* the default pile is TO DO, and a passed case is not in it */
    await expect(page.locator('#cbcasesbody')).toContainText('To do');
    await expect(page.locator('#cbcasesbody')).toContainText('Passed 1');
    await expect(page.locator('#cbcasesbody button', { hasText: /^Re-test$/ })).toHaveCount(0);

    await page.locator('#cbcasesbody button', { hasText: /^Passed/ }).first().click();
    const retest = page.locator('#cbcasesbody button', { hasText: /^Re-test$/ }).first();
    await expect(retest).toBeVisible();
    await retest.click();
    /* opened out again: its observation box is back */
    await expect(page.locator('#cbcasesbody input[id^="cbt_n_"]').first()).toBeVisible();
  });

  test('[TM-12] a case belongs to the screen it was written on', async ({ page }) => {
    test.setTimeout(300000);
    await mintEntity(page, { fresh: true, name: 'TM twelve ' + Date.now().toString().slice(-6) });
    await modeOn(page);

    await page.locator('[data-testid="nav-suppliers"]').click();
    await expect(page.locator('[data-testid="screen-code"]').first()).toHaveText('BUS002', { timeout: 20000 });
    await openPanel(page);
    await writeCase(page, { req: 'a supplier thing', op: 'open a supplier', exp: 'it says what it is' });
    /* ⚠ wait for the board to come back before reading it: writeCase presses the button, it does not wait */
    await expect(page.locator('#cbcasesbody')).toContainText('Cases 1', { timeout: 30000 });

    /* ⚠️ a written case once landed with NO menu, mapped to no screen, and vanished from the view that wrote it */
    const keys = await page.evaluate(() => (CBTEST.cases || [])
      .filter((c) => /^BUS002-H/.test(c.case_key)).map((c) => c.case_key));
    expect(keys.length).toBe(1);

    await page.locator('[data-testid="nav-catalogue"]').click();
    await page.waitForTimeout(2500);
    await expect(page.locator('#cbcasesbody')).not.toContainText(keys[0]);
  });

  test('[TM-13] writing one case does not disturb the rest of the board', async ({ page }) => {
    test.setTimeout(300000);
    await mintEntity(page, { fresh: true, name: 'TM thirteen ' + Date.now().toString().slice(-6) });
    await modeOn(page);

    /* seed the board so there is something for a bad import to destroy */
    await page.evaluate(async () => { await api('testSeed', { body: {} }); });
    await page.evaluate(async () => { if (typeof testLoad === 'function') await testLoad(true); });
    const before = await page.evaluate(() => (CBTEST.cases || []).length);
    expect(before).toBeGreaterThan(50);

    await openPanel(page);
    await writeCase(page, { req: 'one more', op: 'do it', exp: 'fine' });
    /* ⚠ wait for the reload the save triggers — counting before it lands reads as a case that never saved */
    /* ⚠ read the BOARD, not a tab: the panel stays on Write after a save and the tab count is not on screen */
    await expect.poll(async () => page.evaluate(() => (CBTEST.cases || []).length),
      { timeout: 45000 }).toBe(before + 1);

    /**
     * ⚠️⚠️ WRITING ONE CASE ONCE REPORTED 1447 ORPHANS. Nothing was retired, and only because a 90%
     * plausibility guard written for a different worry happened to cover it. On a small board the same call
     * would have retired everything.
     */
    const after = await page.evaluate(() => (CBTEST.cases || []).length);
    expect(after).toBe(before + 1);
  });

  test('[TM-11] a screenshot attaches, and comes back as the same bytes', async ({ page }) => {
    test.setTimeout(240000);
    await mintEntity(page, { fresh: true, name: 'TM eleven ' + Date.now().toString().slice(-6) });
    await modeOn(page);
    await openPanel(page);

    /**
     * ⚠️ ONE OF THE TWO PLACES THIS SPEC DOES NOT DRIVE THE CONTROL, and the reason is honest: a clipboard
     * paste and a screen-capture prompt are both outside the page's gift. The UPLOAD PATH is what is under
     * test here, and it is the same function the paste handler calls with the same blob.
     */
    const shot = await page.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 40;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 120, 40);
      g.fillStyle = '#000'; g.font = '12px sans-serif'; g.fillText('evidence', 6, 24);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      await testShotSend(blob, 'spec.png');
      return CBTEST.shot;
    });
    expect(shot && shot.id).toBeTruthy();

    /* the thumbnail proves the bytes made the round trip without opening anything */
    await expect(page.locator('#cbcasesbody img')).toBeVisible();

    /**
     * ⚠️⚠️ AND IT MUST BE FETCHABLE WITH THE TOKEN. A plain <a href> could never have worked — the endpoint is
     * authenticated and a link carries no Authorization header. That was the "unauthorised" Athi hit.
     */
    const res = await page.request.get(API + '/api/attachments/' + shot.id,
      { headers: { Authorization: 'Bearer ' + await tokenOf(page) } });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    expect((await res.body()).length).toBe(shot.size);
  });

  test('[TM-15] three testers, one board, and the report says who did what', async ({ page }) => {
    test.setTimeout(420000);
    await mintEntity(page, { fresh: true, name: 'TM team ' + Date.now().toString().slice(-6) });
    const owner = await tokenOf(page);

    /* the entity's own user id — an actor signs in as key@that */
    const userId = await page.evaluate(async () => {
      const m = await api('me'); const e = (m && m.entity) || m || {};
      return e.user_id || e.entity_user_id || null;
    });
    expect(userId).toBeTruthy();

    /* seed so there are cases for three people to record against */
    await page.evaluate(async () => { await api('testSeed', { body: {} }); });
    const keys = await page.evaluate(async () => {
      const r = await api('testCases', {});
      return (r.cases || []).slice(0, 6).map((c) => ({ key: c.case_key, mod: c.module_key }));
    });
    expect(keys.length).toBeGreaterThan(2);

    /**
     * ⭐ TWO MORE IDENTITIES IN THE SAME ENTITY — which is the shape the answer depends on. Ten testers of one
     * product are ten identities in ONE entity; ten separate entities would be ten separate boards, and RLS
     * keeping them apart is the core principle working rather than a gap.
     */
    const people = [];
    for (const who of [{ key: 'tester1', name: 'Tester One' }, { key: 'tester2', name: 'Tester Two' }]) {
      const made = await page.request.post(API + '/api/actors', {
        headers: { Authorization: 'Bearer ' + owner, 'Content-Type': 'application/json' },
        data: { display_name: who.name, actor_key: who.key, actor_role: 'tester',
                access_level: 'editor', whole_entity: true },
      });
      expect(made.ok(), 'could not create ' + who.key + ': ' + made.status()).toBeTruthy();
      const body = await made.json();
      /**
       * ⭐ EVERYTHING THE INVITE NEEDS COMES BACK FROM THE CREATE. The response carries the OTP and the exact
       *  — key@entity-slug — so nothing has to be assembled here. My first attempt built the
       * username from the entity’s user_id and asked for a second OTP against , a field this API
       * does not use (it is ), which 500’d on /actors/undefined/otp.
       */
      const code = body.otp;
      const username = (body.actor && body.actor.login_format) || (who.key + '@' + userId);
      expect(code, 'no OTP came back with the new actor').toBeTruthy();

      const login = await page.request.post(API + '/api/actors/login', {
        headers: { 'Content-Type': 'application/json' },
        data: { username, otp: String(code) },
      });
      expect(login.ok(), 'could not sign in as ' + who.key + ': ' + login.status()).toBeTruthy();
      const lj = await login.json();
      people.push({ name: who.name, token: lj.token });
    }
    expect(people.length).toBe(2);

    /* each person records a verdict on a DIFFERENT case, so nobody overwrites anybody */
    const record = async (token, k, status) => {
      const r = await page.request.post(API + '/api/testing/results', {
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        data: { results: [{ case_key: k.key, module_key: k.mod, status, run_kind: 'manual' }] },
      });
      expect(r.ok(), 'result refused: ' + r.status()).toBeTruthy();
    };
    await record(owner, keys[0], 'pass');
    await record(people[0].token, keys[1], 'pass');
    await record(people[1].token, keys[2], 'fail');

    /* ⭐ and the report answers per person as well as together */
    const rep = await page.request.get(API + '/api/testing/report',
      { headers: { Authorization: 'Bearer ' + owner } });
    expect(rep.ok()).toBeTruthy();
    const j = await rep.json();
    const byTester = (j.sections || []).filter((s) => s.id === '1b')[0];
    expect(byTester, 'the report has no By tester section').toBeTruthy();

    const rows = byTester.body.people || [];
    expect(rows.length, 'three people recorded, the report shows ' + rows.length).toBe(3);
    /* ⚠️ the sum must match: a leaderboard that double-counts is worse than none */
    expect(rows.reduce((a, p) => a + p.recorded, 0)).toBe(3);
    expect(rows.filter((p) => p.failed === 1).length).toBe(1);
    expect(new Set(rows.map((p) => p.tester_id)).size).toBe(3);
  });
});
