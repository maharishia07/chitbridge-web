// MODULE: Disputes — THE USP. A dispute is TARGETED (only picked parties see it), the room is PRIVATE to them, and
// resolution is PER-PARTY. Two tests:
//   1 (single entity): the mechanics — raise on a chit, resolve it.
//   2 (THREE entities, multi-context): the real USP — A → B,C; A disputes with B ONLY → B sees it, C does NOT → A resolves.
// Run headed to watch it: `npm run test:multiparty` (or `playwright test disputes --headed`).
// LOCATORS: chit-dispute · dispute-category/reason/raise · dispute-resolve-open/note/submit · dispute-room-input/send ·
//           input.dispparty (the party picker) · nav-disputes
const { test, expect } = require('@playwright/test');
const { mintEntity, mintInContext, addRecipientByName, composeSelfChit, settle } = require('../fixtures');

test.describe('Module · Disputes', () => {
  test('[DISP-01] mechanics — raise a dispute on a chit, then resolve it', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E dispute ' + Date.now();
    await composeSelfChit(page, subject);
    await test.step('RAISE', async () => {
      await page.getByTestId('nav-task').click();
      await page.getByText(subject).first().click();
      await page.getByTestId('chit-dispute').click();
      await page.getByTestId('dispute-category').selectOption('quality');
      await page.getByTestId('dispute-reason').fill('Quantity short by two units, please replace.');
      await page.getByTestId('dispute-raise').click();
      await settle(page);
    });
    await test.step('RESOLVE', async () => {
      await page.getByTestId('nav-disputes').click();
      await expect(page.getByText(/Quantity short/i)).toBeVisible();
      await page.getByTestId('dispute-resolve-open').first().click();
      await page.getByTestId('dispute-resolve-note').fill('Replacement sent and confirmed.');
      await page.getByTestId('dispute-resolve-submit').click();
      await expect(page.getByText(/resolved/i)).toBeVisible();
    });
  });

  test('[DISP-02] USP — A disputes with B only; B sees it, C does NOT; A resolves per-party', async ({ browser }) => {
    test.slow();   // 3 entities minted in 3 contexts → needs 3× the default timeout
    const A = await mintInContext(browser);   // sender / raiser
    const B = await mintInContext(browser);   // disputed party
    const C = await mintInContext(browser);   // other party — must be EXCLUDED
    const stamp = Date.now();
    const subject = 'USP order ' + stamp;
    const reason = 'Quality issue ' + stamp + ' — please review and replace.';

    await test.step('A composes ONE chit to both B and C', async () => {
      await A.page.getByTestId('nav-compose').click();
      await addRecipientByName(A.page, B.name);
      await addRecipientByName(A.page, C.name);
      const subj = A.page.locator('[data-testid="chit-field-subject"]');
      if (await subj.count()) await subj.fill(subject);
      else await A.page.locator('[data-testid^="chit-field-"]').first().fill(subject);
      await A.page.getByTestId('chit-item-name').fill('Widget');
      await A.page.getByTestId('chit-item-add').click();
      await A.page.getByTestId('chit-send').click();
    });

    await test.step('A raises a dispute TARGETED at B only', async () => {
      await A.page.getByTestId('nav-order').click();
      await A.page.getByText(subject).first().click();
      await A.page.getByTestId('chit-dispute').click();
      // tick ONLY B in the party picker (C left unticked → excluded)
      await A.page.locator('label').filter({ hasText: B.name }).locator('input.dispparty').check();
      await A.page.getByTestId('dispute-category').selectOption('quality');
      await A.page.getByTestId('dispute-reason').fill(reason);
      await A.page.getByTestId('dispute-raise').click();
      await settle(A.page);
    });

    await test.step('B SEES the dispute — C does NOT (targeting + privacy)', async () => {
      await B.page.reload();
      await B.page.getByTestId('nav-disputes').click();
      await expect(B.page.getByText(reason)).toBeVisible();          // B is on the dispute

      await C.page.reload();
      await C.page.getByTestId('nav-disputes').click();
      await expect(C.page.getByText(reason)).toHaveCount(0);         // C is excluded — never sees it
    });

    await test.step('A resolves WITH B (per-party)', async () => {
      await A.page.getByTestId('nav-disputes').click();
      await expect(A.page.getByText(reason)).toBeVisible();
      await A.page.getByTestId('dispute-resolve-open').first().click();
      await A.page.getByTestId('dispute-resolve-note').fill('Resolved with B — replacement shipped.');
      await A.page.getByTestId('dispute-resolve-submit').click();
      await expect(A.page.getByText(/resolved/i)).toBeVisible();
    });

    await A.context.close();
    await B.context.close();
    await C.context.close();
  });
});
