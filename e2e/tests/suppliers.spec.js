// MODULE: Suppliers — CRUD is cross-entity: B adds A (another entity) as a supplier, edits, removes.
// FLOW A (runnable): mint → nav-suppliers → the add box renders.
// FLOW B (CRUD): mint A (the supplier), mint B (the buyer), B adds A by A's email → edit → remove.
// LOCATORS: nav-suppliers · sup-add-input · sup-add · sup-row-* · sup-nick · sup-category · sup-notes · sup-save · sup-remove
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Module · Suppliers', () => {
  test('[SUP-01] suppliers screen loads with the add box', async ({ page }) => {
    await mintEntity(page);
    await page.getByTestId('nav-suppliers').click();
    await expect(page.getByTestId('sup-add-input')).toBeVisible();
    await expect(page.getByTestId('sup-add')).toBeVisible();
  });

  test('[SUP-02] CRUD — B adds A as a supplier, edits, removes', async ({ page }) => {
    const A = await mintEntity(page);                                  // entity A = the supplier
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await mintEntity(page);                                            // entity B = the buyer

    await test.step('CREATE — add A by email', async () => {
      await page.getByTestId('nav-suppliers').click();
      await page.getByTestId('sup-add-input').fill(A.email);
      await page.getByTestId('sup-add').click();
      await expect(page.locator('[data-testid^="sup-row-"]').first()).toBeVisible();
    });
    await test.step('READ + UPDATE — open, switch to Edit, save a nickname', async () => {
      await page.locator('[data-testid^="sup-row-"]').first().click();
      await page.getByText('Edit').click();                            // view→edit segment (not testid-tagged)
      await page.getByTestId('sup-nick').fill('Local yard');
      await page.getByTestId('sup-save').click();
    });
    await test.step('DELETE — remove from list', async () => {
      await page.locator('[data-testid^="sup-row-"]').first().click();
      await page.getByTestId('sup-remove').click();
      await expect(page.locator('[data-testid^="sup-row-"]')).toHaveCount(0);
    });
  });
});
