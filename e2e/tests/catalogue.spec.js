// MODULE: Catalogue — add a product to your own catalogue (full CRUD is live: POST/PATCH /products).
// FLOW: mint → nav-catalogue → New product → name + price → Add → the product appears in the list.
// LOCATORS: nav-catalogue · cat-new-product · cat-field-name/unit/price/code/desc · cat-add · cat-search · cat-product-*
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Module · Catalogue', () => {
  test('mint, add a product, see it in the list', async ({ page }) => {
    await mintEntity(page);
    const product = 'E2E Widget ' + Date.now();

    await test.step('open Catalogue → New product', async () => {
      await page.getByTestId('nav-catalogue').click();
      await page.getByTestId('cat-new-product').click();
      await expect(page.getByTestId('cat-field-name')).toBeVisible();
    });

    await test.step('fill + Add', async () => {
      await page.getByTestId('cat-field-name').fill(product);
      await page.getByTestId('cat-field-price').fill('250');
      await page.getByTestId('cat-add').click();
    });

    await test.step('it appears in the catalogue', async () => {
      await expect(page.getByText(product)).toBeVisible();
    });
  });
});
