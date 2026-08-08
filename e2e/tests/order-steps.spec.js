/**
 * step-flow.spec.js — the ORDER WIZARD, driven in a real browser.
 *
 * Athi, 2026-08-08: *"we do not want the left half, we are going to show just the product list and the cart,
 * nothing else, once all the selection is over, then we show the rest in order one by one."*
 * and: *"reduce number of clicks, otherwise no one will be interested."*
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────────────────────
 * scripts/step-flow.test.mjs proves the wizard's RULES headlessly — guards, the rail, the last step re-asking the
 * earlier ones. It cannot prove a screen wired them up. Every defect of 2026-08-09 was of exactly that kind: legal
 * JavaScript that no unit test could see, only a browser driving the real page.
 *
 * So this walks the flow the way a person does: pick a supplier, press +, check out, fill the details, review, and
 * confirm the primary button says what it will do. It stops SHORT of actually sending, deliberately — see below.
 *
 *      npx playwright test step-flow --project=authed
 */
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

const API = process.env.CB_API || 'https://chitbridge-api-production.up.railway.app';
const OTP = process.env.DEV_OTP || '123456';
// The same published shop variants.spec.js uses — a supplier that really has a catalogue to order from.
const SHOP = { email: 'beta@test-cb.com', name: 'Beta Fresh' };

test.describe('Order step flow', () => {
  test('★★ SUPPLIERS — the catalogue IS the screen, and the flow walks Items → Details → Review', async ({ page }) => {
    await mintEntity(page);
    page.on('dialog', (d) => d.accept());          // addSupplier() confirms before it posts

    await page.getByTestId('nav-suppliers').click();
    await expect(page.getByTestId('sup-add-input')).toBeVisible();
    await page.getByTestId('sup-add-input').fill(SHOP.email);
    await page.getByTestId('sup-add').click();
    const row = page.locator('[data-testid^="sup-row-"]').first();
    await expect(row).toBeVisible();
    await row.click();

    /**
     * ⭐ THE CLICK COUNT, WHICH IS THE POINT. Selecting a supplier means you intend to order from them, so their
     * catalogue is already on screen — no profile to read past, no "Compose order" modal to open first.
     */
    await expect(page.getByTestId('sup-catalogue'), 'the catalogue is not the default view').toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('sup-chip'), 'the supplier chip is missing').toBeVisible();

    // THREE steps — no "To". The recipient IS the supplier.
    const rail = page.locator('[data-testid^="steps-"]');
    await expect(rail).toBeVisible();
    await expect(rail.locator('.cbst')).toHaveCount(3);
    await expect(page.getByTestId('step-items')).toBeVisible();
    await expect(page.getByTestId('step-to'), 'Suppliers must NOT have a To step').toHaveCount(0);

    // ⚠️ A blocked step says WHY, in words — not just a dead button.
    const nextBtn = page.locator('[data-testid^="step-next-"]');
    await expect(nextBtn).toBeDisabled();
    await expect(page.locator('[data-testid^="step-why-"]')).toContainText('Add at least one item');

    // Press + on the first line.
    await page.getByTestId('cart-add').first().click();
    await expect(page.locator('[data-testid^="cart-count-"]').first()).toBeVisible();
    await expect(nextBtn, 'adding a line did not unblock the step').toBeEnabled();
    await expect(nextBtn).toContainText('Check out');

    await nextBtn.click();

    // ── DETAILS ──────────────────────────────────────────────────────────────────────────────────────────────
    await expect(page.getByTestId('sup-subject'), 'the Details step did not render').toBeVisible();
    // The subject is PROPOSED, not demanded — the schema requires one and nobody should be stopped by a blank box.
    await expect(page.getByTestId('sup-subject')).toHaveValue(/Order —/);
    await page.getByTestId('sup-addr').fill('16a Hill Side, 641001');
    await page.locator('[data-testid^="step-next-"]').click();

    // ── REVIEW ───────────────────────────────────────────────────────────────────────────────────────────────
    await expect(page.getByTestId('sup-total'), 'the Review step did not render').toBeVisible();
    const send = page.locator('[data-testid^="step-next-"]');
    await expect(send, 'the last step must name what it sends').toContainText('Send order to');
    await expect(send).toBeEnabled();
    // The escape hatch is present: three steps cannot express CC, attachments or an unlisted line.
    await expect(page.getByTestId('sup-open-compose')).toBeVisible();

    /**
     * ⚠️ IT DOES NOT PRESS SEND. This spec runs against PRODUCTION, and sending mints a real chit on a real
     * entity — a test that leaves live obligations behind every run is a test that makes the data untrustworthy.
     * What sending DOES is covered by the chit specs, which own their own cleanup. What this owns is the flow.
     */

    // ── GOING BACK IS FREE, and what was typed survives it ────────────────────────────────────────────────────
    await page.getByTestId('step-items').click();
    await expect(page.getByTestId('sup-catalogue')).toBeVisible();
    await expect(page.locator('[data-testid^="cart-count-"]').first(),
      'stepping back emptied the cart').toBeVisible();
    await page.getByTestId('step-details').click();
    await expect(page.getByTestId('sup-addr'), 'the details did not survive a walk back to Items')
      .toHaveValue('16a Hill Side, 641001');
  });

  test('★ SUPPLIERS — the rail cannot be used to skip a step that is not answered', async ({ page }) => {
    await mintEntity(page);
    page.on('dialog', (d) => d.accept());
    await page.getByTestId('nav-suppliers').click();
    await page.getByTestId('sup-add-input').fill(SHOP.email);
    await page.getByTestId('sup-add').click();
    await page.locator('[data-testid^="sup-row-"]').first().click();
    await expect(page.getByTestId('sup-catalogue')).toBeVisible({ timeout: 15000 });

    /**
     * ⚠️ THE GUARD MUST NOT BE WALKABLE-AROUND. The chips are drawn for every step; with an empty cart, clicking
     * "Review" must do nothing at all. If the rail could jump the guard, the disabled footer button would be
     * decoration and an order with no lines could reach the send.
     */
    await page.getByTestId('step-review').click();
    await expect(page.getByTestId('sup-catalogue'), 'the rail jumped a guard — Review was reachable with an empty cart')
      .toBeVisible();
    await expect(page.locator('[data-testid^="step-next-"]')).toBeDisabled();
  });
});
