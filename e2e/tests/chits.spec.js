// MODULE: Chits — compose a self-chit → send → it appears in the sender's Order (sent) list.
// FLOW: mint → nav-compose → add Self → subject + a line item → send → nav-order → the chit is there.
// LOCATORS: nav-compose · chit-add-self · chit-field-* · chit-item-name/qty/price · chit-item-add · chit-send · nav-order
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Module · Chits', () => {
  test('mint, compose a self-chit, send it, see it in Order', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E order ' + Date.now();

    await test.step('open Compose', async () => {
      await page.getByTestId('nav-compose').click();
      await expect(page.getByTestId('chit-send')).toBeVisible();
    });

    await test.step('add Self + subject + a line item', async () => {
      await page.getByTestId('chit-add-self').click();
      const subj = page.locator('[data-testid="chit-field-subject"]');
      if (await subj.count()) await subj.fill(subject);
      else await page.locator('[data-testid^="chit-field-"]').first().fill(subject);   // first schema field
      await page.getByTestId('chit-item-name').fill('Widget');
      await page.getByTestId('chit-item-qty').fill('3');
      await page.getByTestId('chit-item-price').fill('100');
      await page.getByTestId('chit-item-add').click();
    });

    await test.step('send → it lands in Order (sent)', async () => {
      await page.getByTestId('chit-send').click();
      await page.getByTestId('nav-order').click();
      await expect(page.getByText(subject)).toBeVisible();
    });
  });
});
