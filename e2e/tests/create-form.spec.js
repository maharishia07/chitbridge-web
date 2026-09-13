// [CREATE] ONE FORM, THE TYPE CHOSEN FIRST — test case · incident · requirement.
//
// ── ⭐⭐⭐ WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────────────
//
// Athi, 2026-09-13: *"we are using the same dialog box for creating requirement, observation or incident? So
// possibly those chips should be on top, based on the chip the information received can be changed, and finally
// a proper save or cancel button."* · *"when I click requirement, if there is a text that states you are writing
// a requirement, that would be good."* · *"I am not sure what those chips are doing while creating a case."* ·
// *"rename Write to Create."*
//
// ⚠️⚠️ THE TYPE USED TO BE CHOSEN BY WHICHEVER BUTTON YOU PRESSED AT THE END — Pass · Incident · Requirement ·
// Save · Cancel, five equal buttons after four boxes whose labels had to suit all three at once.
//
// ⭐ WHAT THIS HOLDS IN PLACE, because each one is a thing that can quietly regress:
//   1 · the type is a control at the TOP, and the sentence under it changes with it;
//   2 · the four boxes keep their order and only their WORDS change — a form that rearranges itself under
//       somebody's hands has to be re-read every time;
//   3 · the primary button says what it will DO, and there is exactly one of it, plus Cancel;
//   4 · severity is asked for an incident and priority for the other two, because they are different questions;
//   5 · ⚠️ and the severity chosen is the severity FILED — it was hardcoded Sev-3 for every incident ever
//       raised this way, which made the one field a release gate reads a constant.
//
// Run: npx playwright test tests/create-form.spec.js --reporter=line
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

async function openCreate(page) {
  const sw = page.locator('[data-testid="vp-test"]');
  await expect(sw).toBeVisible({ timeout: 45000 });
  if (!((await sw.textContent()) || '').includes('on')) await sw.click();
  await expect(sw).toContainText('on');
  /* the door a tester actually uses: the screen code in the corner of the screen they are standing on */
  await page.locator('[data-testid="screen-cases"]').first().click();
  await expect(page.locator('#cbcasespanel')).toBeVisible({ timeout: 30000 });
  const modal = page.locator('#modalhost .modal');
  if (await modal.count()) await page.locator('#modalhost .modal button').last().click();
  await page.evaluate(() => { CBTEST.caseArea = 'write'; CBTEST.writeKind = 'case'; screenCasesPaint(); });
  /* the empty state offers the door; the form itself only exists once it is opened */
  const plus = page.locator('#cbcasespanel button', { hasText: 'Create' }).first();
  if (await plus.count()) await plus.click();
  await expect(page.locator('#wcTitle')).toBeVisible({ timeout: 15000 });
}

test('[CREATE-01] the type is chosen first, and the form says what it means', async ({ page }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Form ' + Date.now().toString().slice(-6) });
  await openCreate(page);

  /* ── 1 · all three types are offered, at the top, before any box ── */
  for (const k of ['case', 'inc', 'req']) {
    await expect(page.locator('[data-testid="wkind-' + k + '"]')).toBeVisible();
  }
  const says = page.locator('[data-testid="wkind-says"]');
  await expect(says).toContainText('A CHECK ANYONE CAN REPEAT');
  await expect(page.locator('[data-testid="wsave"]')).toContainText('Create case');
  /* a test case is graded by how soon, not by how bad */
  await expect(page.locator('#wcPri')).toBeVisible();
  await expect(page.locator('#wcSev')).toHaveCount(0);

  /* ── 2 · ⭐ THE SENTENCE AND THE LABELS FOLLOW THE CHIP ── */
  await page.locator('[data-testid="wkind-inc"]').click();
  await expect(says).toContainText('SOMETHING IS WRONG NOW');
  await expect(says).toContainText('retest');
  await expect(page.locator('[data-testid="wsave"]')).toContainText('Raise incident');
  await expect(page.locator('#wcSev')).toBeVisible();
  await expect(page.locator('#wcPri')).toHaveCount(0);
  /* the fourth box now says it is required, because for an incident it is the evidence */
  expect(await page.locator('#wcGot').getAttribute('placeholder')).toContain('required');

  await page.locator('[data-testid="wkind-req"]').click();
  await expect(says).toContainText('NOTHING IS BROKEN');
  await expect(page.locator('[data-testid="wsave"]')).toContainText('Raise requirement');
  await expect(page.locator('#wcPri')).toBeVisible();

  /* ── 3 · the boxes never move: four, in order, whichever type is chosen ── */
  const order = await page.evaluate(() => Array.from(document.querySelectorAll('#cbcasespanel input[id^="wc"]'))
    .map((el) => el.id));
  expect(order.slice(0, 4)).toEqual(['wcTitle', 'wcDo', 'wcSee', 'wcGot']);

  /* ── 4 · one primary action and a Cancel, not a row of five equal questions ── */
  await expect(page.locator('[data-testid="wsave"]')).toHaveCount(1);
  await expect(page.locator('#cbcasespanel button', { hasText: /^Cancel$/ })).toHaveCount(1);

  /* ⚠️ and the 29119-4 helper is FOLDED — five unexplained chips under the boxes read as part of the form */
  await expect(page.locator('#tqField')).toHaveCount(0);
  await expect(page.locator('#cbcasespanel')).toContainText('What else should I try?');
});

test('[CREATE-02] the severity chosen is the severity filed', async ({ page }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Sev ' + Date.now().toString().slice(-6) });
  const token = await page.evaluate(() => SESSION.token);
  await openCreate(page);

  await page.locator('[data-testid="wkind-inc"]').click();
  await page.locator('#wcTitle').fill('The counter must total the cart');
  await page.locator('#wcDo').fill('Add two items and read the total');
  await page.locator('#wcSee').fill('The total is the sum of the two');
  await page.locator('#wcGot').fill('It shows the price of the last item only');
  /* ⚠️ NOT the default: Sev-3 would pass this test on the broken code, which hardcoded exactly that */
  await page.locator('#wcSev').selectOption('Sev-1');
  await page.locator('[data-testid="wsave"]').click();

  await expect.poll(async () => {
    const r = await page.request.get(API + '/api/testing/incidents?state=all&_=' + Date.now(),
      { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok()) return null;
    return ((await r.json()).incidents || [])[0] || null;
  }, { message: 'no incident was raised from the form', timeout: 45000 }).not.toBeNull();

  const r = await page.request.get(API + '/api/testing/incidents?state=all&_=' + Date.now(),
    { headers: { Authorization: 'Bearer ' + token } });
  const inc = ((await r.json()).incidents || [])[0];
  expect(inc.severity, 'the severity the person chose was thrown away').toBe('Sev-1');
  expect(inc.observed).toContain('last item only');
  /* ⭐ and the whole return leg hangs on this one field */
  expect(inc.raised_by_id, 'the raiser was not recorded, so nobody can be told it is their turn').toBeTruthy();
});
