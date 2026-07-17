// MODULE: Suppliers — add a supplier (by User ID / email) → appears in your list; edit their details.
// FLOW A (runnable): mint → nav-suppliers → the add box + empty state render.
// FLOW B (skeleton): add a REAL supplier — needs a second entity's User ID (cross-entity), so it's a two-mint setup.
// LOCATORS: nav-suppliers · sup-add-input · sup-add · sup-row-* · sup-nick · sup-category · sup-notes · sup-save · sup-remove · sup-compose-order
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Module · Suppliers', () => {
  test('suppliers screen loads with the add box', async ({ page }) => {
    await mintEntity(page);
    await page.getByTestId('nav-suppliers').click();
    await expect(page.getByTestId('sup-add-input')).toBeVisible();
    await expect(page.getByTestId('sup-add')).toBeVisible();
  });

  test.skip('add a real supplier by User ID (needs a 2nd entity)', async ({ page }) => {
    // TODO(per-module): mint entity A (capture its bridge/User ID), mint entity B, then as B:
    //   nav-suppliers → sup-add-input.fill(A.userId) → sup-add → expect a sup-row-* for A → open it →
    //   sup-nick/sup-category/sup-notes → sup-save. (mintEntity needs to also return the bridge_id.)
  });
});
