// MODULE: Offers — the LIFECYCLE, driven end to end through the controls a person uses.
// author (draft) → edit → make live → attach to a product → seen on the product → retire → gone from the product.
// LOCATORS: catset-sec-offers · catset-offer-new · cbdef-sub · cbdef-name · cbdef-rule-percent · cbdef-save ·
//           .catset-drow (Edit / Make live / Retire) · cat-edit · prod-tab-offers · cat-offer-<id> · prod-pane-offers
//
// Athi, 2026-09-03: "i created one, couldn't edit and how will you attach to a product" → "run the life cycle using
// playwright and fix the bugs". Two bugs came out of the first sentence alone: Edit from Catalogue setup looked the
// offer up in a list only the Definitions screen loads (silent no-op), and Setup had no way to make an offer LIVE —
// while a product's Offers tab lists live offers only. This spec is the guard against both, and the rest of the cycle.
//
// ⚠️ A FRESH ENTITY, on purpose: the shared account accumulates offers across runs and "the offer is listed" would pass
// for the wrong reason. Every write is waited on (the response), never a screen timeout.
const { test, expect } = require('@playwright/test');
const { mintEntity, addProduct, clickNav, settle, dismissModal } = require('../fixtures');

const isDefWrite = (r, method) => /\/api\/definitions/.test(r.url()) && r.request().method() === method && r.status() < 400;

test('[OFF-01] author → edit → live → attach → seen → retire', async ({ page }) => {
  test.setTimeout(180000);
  await mintEntity(page);
  const prod = 'Offer Rice ' + Date.now();
  const offerName = 'E2E ten off ' + Date.now();
  await addProduct(page, { name: prod, price: 100 });

  const row = () => page.locator('.catset-drow', { hasText: offerName.slice(0, 12) }).first();
  const openOffersSection = async () => {
    await clickNav(page, 'catsetup');
    await page.getByTestId('catset-sec-offers').click();
    await settle(page);
  };

  await test.step('AUTHOR — a 10% offer, saved as a draft', async () => {
    await openOffersSection();
    await page.getByTestId('catset-offer-new').click();
    await expect(page.getByTestId('cbdef-name')).toBeVisible();
    const sub = page.getByTestId('cbdef-sub');
    if (await sub.count()) await sub.selectOption('percent_off');       // repaints the form; fill AFTER it
    await page.getByTestId('cbdef-name').fill(offerName);
    await page.getByTestId('cbdef-rule-percent').fill('10');
    const saved = page.waitForResponse((r) => isDefWrite(r, 'POST'), { timeout: 45000 });
    await page.getByTestId('cbdef-save').click();
    await saved;
    await settle(page);
    await expect(row()).toBeVisible();
    await expect(row()).toContainText(/draft/i);
  });

  await test.step('EDIT — from Setup, the form opens WITH the offer in it (this was a silent no-op)', async () => {
    await row().getByText('Edit', { exact: true }).click();
    const name = page.getByTestId('cbdef-name');
    await expect(name).toBeVisible({ timeout: 15000 });
    await expect(name).toHaveValue(offerName);                         // the lookup found it
    await name.fill(offerName + ' v2');
    const saved = page.waitForResponse((r) => isDefWrite(r, 'PUT'), { timeout: 45000 });
    await page.getByTestId('cbdef-save').click();
    await saved;
    await settle(page);
    await expect(row()).toContainText('v2');                           // the Setup list refreshed, not only Definitions
  });

  await test.step('LIVE — from the same list', async () => {
    const saved = page.waitForResponse((r) => isDefWrite(r, 'PUT'), { timeout: 45000 });
    await row().getByText('Make live', { exact: true }).click();
    await saved;
    await settle(page);
    await expect(row()).toContainText(/live/i);
    await expect(row().getByText('Back to draft', { exact: true })).toBeVisible();
  });

  let offerId = null;
  await test.step('ATTACH — Edit › Offers on the product, tick it', async () => {
    await clickNav(page, 'catalogue');
    await settle(page);
    await page.locator('[data-testid^="cat-product-"]', { hasText: prod }).first().click();
    await page.getByTestId('cat-edit').click();
    await page.getByTestId('prod-tab-offers').click();
    const chip = page.getByTestId('prod-pane-offers').locator('[data-testid^="cat-offer-"]', { hasText: offerName.slice(0, 12) }).first();
    await expect(chip).toBeVisible({ timeout: 20000 });                 // live → it is offered here
    offerId = (await chip.getAttribute('data-testid')).replace('cat-offer-', '');
    const saved = page.waitForResponse((r) => isDefWrite(r, 'PUT'), { timeout: 45000 });
    await chip.click();
    await saved;
    await settle(page);
    await expect(page.getByTestId('cat-offer-' + offerId)).toContainText('✓');
  });

  await test.step('SEEN — View › Offers lists it with its terms', async () => {
    await page.getByText('Cancel', { exact: true }).first().click();  // back to View, tab stays on Offers
    await settle(page);
    const pane = page.getByTestId('prod-pane-offers');
    await expect(pane).toContainText(offerName.slice(0, 12), { timeout: 15000 });
    await expect(pane).toContainText('10% off');
  });

  await test.step('RETIRE — and it leaves the product', async () => {
    await openOffersSection();
    await row().getByText('Retire', { exact: true }).click();
    const ok = page.getByTestId('confirm-ok');
    if (await ok.isVisible().catch(() => false)) {
      /* Retire is a DELETE that never deletes — the row survives as "retired" so chits that cite it stay explicable. */
      const saved = page.waitForResponse((r) => isDefWrite(r, 'DELETE'), { timeout: 45000 });
      await ok.click();
      await saved;
    }
    await settle(page);
    await expect(row()).toContainText(/retired/i);

    await clickNav(page, 'catalogue');
    await settle(page);
    await page.locator('[data-testid^="cat-product-"]', { hasText: prod }).first().click();
    await page.getByTestId('prod-tab-offers').click();
    await expect(page.getByTestId('prod-pane-offers')).not.toContainText(offerName.slice(0, 12), { timeout: 15000 });
  });
});
