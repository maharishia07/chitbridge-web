// [TECH] THE TECHNIQUE HELPER READS THE FIELDS OFF THE WIRE, AND SHOWS ITS WORKING.
//
// ── ⚠️⚠️ THE FAULT THIS FILE STANDS AGAINST ─────────────────────────────────────────────────────────────────
//
// Athi, 2026-09-13: *"what field, where does it come from? From the current API? Can we figure this out and
// show these are the fields that have to be checked?"* and *"the screen has to be a little more usable — what
// field, highest, lowest — it has to be prominent. Also give some example as a 'try this', so people
// understand what we are saying here."*
//
// A blank box labelled "which field?" asks the tester to already know the product's field names, which is the
// one thing somebody testing a screen for the first time does not have. So the helper was usable only by
// people who did not need it.
//
// ⭐ THE CALL LOG ALREADY HELD THE ANSWER. Every request the screen made is in CBCALLS with its body, and those
// bodies are literally the fields it puts on the wire — not a guess and not a hand-maintained schema.
//
// Run: npx playwright test tests/techniques.spec.js --reporter=line
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test('[TECH-01] every technique says what it is for, with a worked example', async ({ page }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Tech ' + Date.now().toString().slice(-6) });

  const sw = page.locator('[data-testid="vp-test"]');
  await expect(sw).toBeVisible({ timeout: 45000 });
  if (!((await sw.textContent()) || '').includes('on')) await sw.click();
  await page.locator('[data-testid="screen-cases"]').first().click();
  await expect(page.locator('#cbcasespanel')).toBeVisible({ timeout: 30000 });
  const modal = page.locator('#modalhost .modal');
  if (await modal.count()) await page.locator('#modalhost .modal button').last().click();
  await page.evaluate(() => { CBTEST.tech = {}; testArea('tech'); });

  const panel = page.locator('#cbcasespanel');
  /* ⚠️ before a technique is chosen, five bare chips taught nobody anything — each now says what it is FOR */
  await expect(panel).toContainText('A number that has a lowest and a highest allowed value');
  await expect(panel).toContainText('Kinds of value that the product is supposed to treat differently');
  await expect(panel).toContainText('Something that moves through named stages');

  /* ── choose one, and it shows its working ── */
  await page.locator('#cbcasespanel button', { hasText: 'A number range' }).click();
  await expect(panel).toContainText('Try this:');
  await expect(panel).toContainText('quantity');
  /* ⭐ and it names the standard's own reason, which is the sentence a tester can repeat to a sceptic */
  await expect(panel).toContainText('Boundary value analysis');

  /* the inputs are prominent and labelled, not a row of narrow boxes with placeholder-only hints */
  await expect(panel).toContainText('Lowest allowed');
  await expect(panel).toContainText('Highest allowed');
  await expect(page.locator('#tqLo')).toBeVisible();
  await expect(page.locator('#tqHi')).toBeVisible();
  await expect(page.locator('#cbcasespanel button', { hasText: 'Write the cases' })).toHaveCount(1);
});

test('[TECH-02] the field chips are read from what the screen actually sent', async ({ page }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Tech2 ' + Date.now().toString().slice(-6) });

  const sw = page.locator('[data-testid="vp-test"]');
  await expect(sw).toBeVisible({ timeout: 45000 });
  if (!((await sw.textContent()) || '').includes('on')) await sw.click();

  /**
   * ⚠️ THE READER IS THE ASSERTION, NOT THE CHIPS. Which fields appear depends on what the screen the tester
   * happens to be standing on has posted, and a spec that demanded a particular field name would be testing
   * the fixture. What must hold is that it reads REQUEST BODIES and infers a kind from the VALUE — so this
   * feeds it a known body and checks what comes back out.
   */
  const got = await page.evaluate(() => {
    window.CBCALLS = window.CBCALLS || [];
    CBCALLS.unshift({
      key: 'probe', m: 'POST', path: '/api/probe', ms: 1, status: 200,
      scr: (typeof navScreenKey === 'function' ? navScreenKey() : null), gen: window.CBGEN || 0,
      sent: JSON.stringify({ quantity: 7, note: 'a longer sentence that is plainly free text here',
                             status: 'available', when: '2026-09-13', flag: true,
                             entity_id: 'ignore-me', secret: '[redacted]' }),
      body: null, at: Date.now(),
    });
    return testTechFields();
  });
  const by = {};
  got.forEach((f) => { by[f.key] = f.kind; });

  expect(by.quantity, 'a number was not seen as a number').toBe('number');
  expect(by.status, 'a short value was not offered for equivalence classes').toBe('short text');
  expect(by.when, 'an ISO date was not seen as a date').toBe('date');
  expect(by.flag).toBe('yes/no');
  expect(by.note, 'a sentence is text, not a class').toBe('text');
  /* ⚠️ plumbing is not a field a tester exercises — offering it buries the four that matter */
  expect(by.entity_id, 'an id was offered as a field to test').toBeUndefined();
  /* ⚠️⚠️ and a redacted value must never be shown back as a sample, having been redacted at capture */
  expect(by.secret, 'a redacted value was offered as a field').toBeUndefined();

  /* ⭐ the kind chooses the technique, and it is inferred from the VALUE — order_no would be wrong by name */
  const forKind = await page.evaluate(() => [testTechFor('number'), testTechFor('short text'),
    testTechFor('yes/no'), testTechFor('text')]);
  expect(forKind).toEqual(['bounds', 'classes', 'decision', 'guess']);
});
