// [LAB-01] THE OFFER LAB — the engine as a page (Athi, 2026-09-06: "a single page offer engine … so people can understand how I can design
// my offer; this is our USP"). Real engine, real cart: switch an offer on and the row, the money block and the reasons repaint; an
// exclusive offer silences the others and says why; buy X get another product Y free names the earned item; the advisor turns a goal
// into a pre-filled offer with the margin left; the mark-up calculator shows the declared price for a shown discount.
const { test, expect } = require('@playwright/test');

test('[LAB-01] the offer lab: switch, see, compare, advise', async ({ page }) => {
  test.setTimeout(120000);
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/offer-lab.html'); await page.locator('[data-testid^="cbcat-row-"]').first().waitFor({ timeout: 30000 });
  expect(await page.locator('[data-testid^="cbcat-row-"]').count(), 'the sample products draw through the real cart').toBeGreaterThanOrEqual(5);

  /* a 10% line offer, an order size of 2 typed on the row (Athi: "order size on the right side, so it can be tried here"): the row, the block and the reason agree */
  await page.getByTestId('lab-on-pct').click();
  await page.getByTestId('lab-qty-grapes').fill('2'); await page.getByTestId('lab-qty-grapes').press('Tab'); await page.waitForTimeout(400);
  /* the tick beside it: untick Sunflower oil and the offer leaves that row only */
  await page.getByTestId('lab-apply-oil').uncheck(); await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="cbcat-row-oil"] .cbcat-pr')).not.toContainText('225.00');
  await page.getByTestId('lab-apply-all').check(); await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="cbcat-row-grapes"] .cbcat-pr')).toContainText('180.00');
  await expect(page.getByTestId('lab-money')).toContainText('360.00');
  await expect(page.getByTestId('lab-why')).toContainText('10% off');

  /* exclusive: instead of the others, and it says so */
  await page.getByTestId('lab-on-amt').click(); await page.check('#amt-excl'); await page.waitForTimeout(400);
  await expect(page.getByTestId('lab-why')).toContainText('an exclusive offer already applied');
  await expect(page.locator('[data-testid="cbcat-row-grapes"] .cbcat-tags')).not.toContainText('10% off');

  /* buy X get ANOTHER product free: the earned item is named, never added by the engine */
  await page.check('#amt-excl', { force: true }); await page.uncheck('#amt-excl'); await page.getByTestId('lab-on-bxgy').click(); await page.selectOption('#bxgy-item', 'oil'); await page.waitForTimeout(400);
  await expect(page.getByTestId('lab-why')).toContainText('Sunflower oil');

  /* who is looking: a customer-only offer fails closed for a stranger; compare says the two figures */
  await page.selectOption('#pct-only', 'high_value'); await page.selectOption('#viewer', 'high_value'); await page.check('#cmp'); await page.waitForTimeout(400);
  await expect(page.locator('#p_cmp')).toContainText('a stranger would pay');

  /* the advisor: a goal becomes a pre-filled offer with the margin left */
  await page.selectOption('#adv-goal', 'free'); await page.waitForTimeout(200);
  await expect(page.locator('#adv-out')).toContainText('margin');
  await page.locator('#adv-out button').first().click(); await page.waitForTimeout(500);
  await expect(page.getByTestId('lab-why')).toContainText('earned');
  await page.selectOption('#adv-goal', 'show'); await page.waitForTimeout(200); await page.locator('#adv-out button').first().click(); await page.waitForTimeout(300);
  await expect(page.locator('#mk-out')).toContainText('Declare the list price');
  expect(errs, 'no page errors').toEqual([]);
});
