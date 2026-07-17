// MODULE: Catalogue — FULL CRUD on a product (the worked example; the same pattern extends to suppliers/chits/co-assists).
// C: New product → name+price → Add.  R: open it → view shows the values.  U: Edit → change price → Save.  D: Delete.
// LOCATORS: nav-catalogue · cat-new-product · cat-field-name/price · cat-add · cat-product-* · cat-edit · cat-save · cat-delete
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

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
      await expect(page.getByText(name)).toBeVisible();          // now in view mode showing the new product
    });

    await test.step('READ', async () => {
      await expect(page.getByText('250', { exact: false })).toBeVisible();   // view pane shows the price
    });

    await test.step('UPDATE', async () => {
      await page.getByTestId('cat-edit').click();
      await page.getByTestId('cat-field-price').fill('999');
      await page.getByTestId('cat-save').click();
      await expect(page.getByText('999', { exact: false })).toBeVisible();
    });

    await test.step('DELETE', async () => {
      page.once('dialog', (d) => d.accept());                    // delProduct() uses window.confirm()
      await page.getByTestId('cat-delete').click();
      await expect(page.getByText(name)).toHaveCount(0);         // gone from the list
    });
  });
});
