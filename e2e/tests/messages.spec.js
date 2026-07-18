// MODULE: Messages — on a chit, INTERNAL (your team only) vs EXTERNAL (the counterparty sees it). The channel toggle is
// the point: the same composer sends to two different audiences. (On a self-chit both land with you; the toggle + send
// are what's exercised. The true internal-stays-internal privacy is a multi-entity assertion — noted below.)
// LOCATORS: msg-tab · msg-channel-internal · msg-channel-external · msg-body · msg-send
const { test, expect } = require('@playwright/test');
const { mintEntity, composeSelfChit, settle } = require('../fixtures');

test.describe('Module · Messages', () => {
  test('[MSG-01] send an internal note and an external message on a chit', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E msg ' + Date.now();
    await composeSelfChit(page, subject);
    await page.getByTestId('nav-task').click();
    await page.getByText(subject).first().click();
    await settle(page);
    await page.getByTestId('msg-tab').click();

    await test.step('INTERNAL — a team-only note', async () => {
      await page.locator('[data-testid="msg-channel-internal"]:visible').first().click();
      await page.locator('[data-testid="msg-body"]:visible').first().fill('Internal: check stock before confirming.');
      await page.locator('[data-testid="msg-send"]:visible').first().click();
      await expect(page.getByText(/check stock/i).first()).toBeVisible();
    });

    await test.step('EXTERNAL — a message the counterparty sees', async () => {
      await page.locator('[data-testid="msg-channel-external"]:visible').first().click();
      await page.locator('[data-testid="msg-body"]:visible').first().fill('External: your order is confirmed.');
      await page.locator('[data-testid="msg-send"]:visible').first().click();
      await expect(page.getByText(/order is confirmed/i).first()).toBeVisible();
    });
  });

  // PRIVACY PROOF (skeleton, needs 2 entities): as A send an INTERNAL note + an EXTERNAL message on an A→B chit; sign in
  // as B → B sees ONLY the external message, never the internal note. That is the internal/external boundary, proven.
  test.skip('[MSG-02] privacy — the counterparty sees external, never internal (needs a 2nd entity)', async ({ page }) => {});
});
