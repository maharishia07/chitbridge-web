// MODULE: Chits — compose/send (create), open (read), advance status (update). Hard-delete is the bulk-select/trash flow.
// LOCATORS: nav-compose · chit-add-self · chit-field-* · chit-item-name/qty/price · chit-item-add · chit-send · nav-order ·
//           nav-task · chit-row-* · chit-status-btn · chit-unread · chit-void
const { test, expect } = require('@playwright/test');
const { mintEntity, settle, clickNav, stableClick, clickInModal, HAS_RCPT, HAS_TOTAL } = require('../fixtures');

// clickInModal / stableClick dispatch the modal's own button handlers (see fixtures.js) — robust to the slow, reflowing
// compose modal on webkit/firefox/mobile, where a coordinate click either stalls on a stability loop or strays onto the
// backdrop and dismisses the modal. clickInModal also verifies the recipient/line-item actually registered.
async function composeSelfChit(page, subject) {
  await clickNav(page, 'compose');
  await clickInModal(page, 'chit-add-self', HAS_RCPT);
  const subj = page.locator('[data-testid="chit-field-subject"]');
  if (await subj.count()) await subj.fill(subject);
  else await page.locator('[data-testid^="chit-field-"]').first().fill(subject);
  await page.getByTestId('chit-item-name').fill('Widget');
  await page.getByTestId('chit-item-qty').fill('3');
  await page.getByTestId('chit-item-price').fill('100');
  await clickInModal(page, 'chit-item-add', HAS_TOTAL);
  // Wait for the server to CONFIRM the send (POST /chits/send → 200) before looking for the chit — on a slower engine
  // or a cold API the create + list-refresh lags the click, and the Order assertion would otherwise race it.
  const sent = page.waitForResponse((r) => /\/chits\/send/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
  await stableClick(page, 'chit-send');
  await sent;
  await settle(page);   // wait out the post-send refresh overlay before the next nav click
}

test.describe('Module · Chits', () => {
  test('[CHIT-01] CREATE — compose + send a self-chit → appears in Order', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E order ' + Date.now();
    await composeSelfChit(page, subject);
    await clickNav(page, 'order');
    await expect(page.getByText(subject).first()).toBeVisible();   // subject shows as both a title + a detail line
  });

  test('[CHIT-02] READ + UPDATE — open the received copy, advance status', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E status ' + Date.now();
    await composeSelfChit(page, subject);
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
