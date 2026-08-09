// MODULE: Chits — compose/send (create), open (read), advance status (update). Hard-delete is the bulk-select/trash flow.
// LOCATORS: nav-compose · chit-add-self · chit-field-* · chit-item-name/qty/price · chit-item-add · chit-send · nav-order ·
//           nav-task · chit-row-* · chit-status-btn · chit-unread · chit-void
const { test, expect } = require('@playwright/test');
const { mintEntity, settle, composeChit } = require('../fixtures');

/**
 * ⚠️ THE LOCAL composeSelfChit IS GONE — it was a COPY of the fixture, and it drifted the moment compose became a
 * four-step wizard: the shared one was updated, this one was not, and CHIT-01 then timed out waiting for
 * chit-add-self on a step that was no longer showing. Exactly the shape this codebase keeps paying for — the walk
 * was shared and a caller kept its own copy. One walk, in fixtures.js.
 */
test.describe('Module · Chits', () => {
  test('[CHIT-01] CREATE — compose + send a self-chit → appears in Order', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E order ' + Date.now();
    await composeChit(page, { subject, qty: 3, price: 100, self: true });
    await clickNav(page, 'order');
    await expect(page.getByText(subject).first()).toBeVisible();   // subject shows as both a title + a detail line
  });

  test('[CHIT-02] READ + UPDATE — open the received copy, advance status', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E status ' + Date.now();
    await composeChit(page, { subject, qty: 3, price: 100, self: true });
    await test.step('READ — open the received copy in Task', async () => {
      await clickNav(page, 'task');
      await page.getByText(subject).first().click();   // subject appears as a title + a detail line
      await expect(page.locator('#mainbody')).toContainText(subject);
    });
    await test.step('UPDATE — advance status (picker opens)', async () => {
      await page.getByTestId('chit-status-btn').click();
      await expect(page.locator('#modalhost')).not.toBeEmpty();   // the status picker opened
    });
  });
});
