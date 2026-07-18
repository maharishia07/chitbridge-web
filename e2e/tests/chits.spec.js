// MODULE: Chits — compose/send (create), open (read), advance status (update). Hard-delete is the bulk-select/trash flow.
// LOCATORS: nav-compose · chit-add-self · chit-field-* · chit-item-name/qty/price · chit-item-add · chit-send · nav-order ·
//           nav-task · chit-row-* · chit-status-btn · chit-unread · chit-void
const { test, expect } = require('@playwright/test');
const { mintEntity, settle } = require('../fixtures');

async function composeSelfChit(page, subject) {
  await page.getByTestId('nav-compose').click();
  await page.getByTestId('chit-add-self').click();
  const subj = page.locator('[data-testid="chit-field-subject"]');
  if (await subj.count()) await subj.fill(subject);
  else await page.locator('[data-testid^="chit-field-"]').first().fill(subject);
  await page.getByTestId('chit-item-name').fill('Widget');
  await page.getByTestId('chit-item-qty').fill('3');
  await page.getByTestId('chit-item-price').fill('100');
  await page.getByTestId('chit-item-add').click();
  await page.getByTestId('chit-send').click();
  await settle(page);   // wait out the post-send refresh overlay before the next nav click
}

test.describe('Module · Chits', () => {
  test('[CHIT-01] CREATE — compose + send a self-chit → appears in Order', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E order ' + Date.now();
    await composeSelfChit(page, subject);
    await page.getByTestId('nav-order').click();
    await expect(page.getByText(subject).first()).toBeVisible();   // subject shows as both a title + a detail line
  });

  test('[CHIT-02] READ + UPDATE — open the received copy, advance status', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E status ' + Date.now();
    await composeSelfChit(page, subject);
    await test.step('READ — open the received copy in Task', async () => {
      await page.getByTestId('nav-task').click();
      await page.getByText(subject).first().click();   // subject appears as a title + a detail line
      await expect(page.locator('#mainbody')).toContainText(subject);
    });
    await test.step('UPDATE — advance status (picker opens)', async () => {
      await page.getByTestId('chit-status-btn').click();
      await expect(page.locator('#modalhost')).not.toBeEmpty();   // the status picker opened
    });
  });
});
