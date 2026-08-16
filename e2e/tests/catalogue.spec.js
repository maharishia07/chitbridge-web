// MODULE: Catalogue — FULL CRUD on a product (the worked example; the same pattern extends to suppliers/chits/co-assists).
// C: New product → name+price → Add.  R: open it → view shows the values.  U: Edit → change price → Save.  D: Delete.
// LOCATORS: nav-catalogue · cat-new-product · cat-field-name/price · cat-add · cat-product-* · cat-edit · cat-save · cat-delete
const { test, expect } = require('@playwright/test');
const { mintEntity, settle } = require('../fixtures');

test.describe('Module · Catalogue (full CRUD)', () => {
  test('[CAT-01] create → read → update → delete a product', async ({ page }) => {
    await mintEntity(page);
    const name = 'E2E Widget ' + Date.now();

    await test.step('CREATE', async () => {
      await page.getByTestId('nav-catalogue').click();
      await page.getByTestId('cat-new-product').click();
      await page.getByTestId('cat-field-name').fill(name);
      await page.getByTestId('cat-field-price').fill('250');
      await page.getByTestId('cat-add').click();
      await settle(page);
      await expect(page.getByText(name).first()).toBeVisible();  // renders in list + detail (title/code) → .first()
    });

    await test.step('READ', async () => {
      await expect(page.getByText('250', { exact: false }).first()).toBeVisible();   // view pane shows the price
    });

    await test.step('UPDATE', async () => {
      await page.getByTestId('cat-edit').click();
      const price = page.getByTestId('cat-field-price');
      await price.waitFor({ state: 'visible' });
      await price.fill('999');
      await expect(price).toHaveValue('999');   // guard: the edit form actually holds the new value before saving
      await page.getByTestId('cat-save').click();
      await settle(page);
      await expect(page.getByText('999', { exact: false }).first()).toBeVisible();
    });

    await test.step('DELETE', async () => {
      /* ⚠️ IN-APP CONFIRM NOW, NOT window.confirm() — delProduct routes through confirmAsk (2026-08-16, the
         native-dialog sweep). The old `page.once('dialog', …)` handler is not just unnecessary, it is a trap:
         it never fires, so it silently does nothing, and the click alone would leave the modal open with the
         product still there. Confirming a destructive action is now a real click on a real button. */
      await page.getByTestId('cat-delete').click();
      await page.getByTestId('confirm-ok').click();
      await expect(page.getByText(name)).toHaveCount(0);         // gone from the list
    });
  });
});
