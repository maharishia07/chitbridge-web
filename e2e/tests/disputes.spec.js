// MODULE: Disputes — THE USP. A dispute is TARGETED (only the picked parties see it), its room messages are PRIVATE to
// those parties (per-copy), and resolution is PER-PARTY (raiser-only). Two tests:
//   A (runnable): the mechanics — raise a dispute on a chit, then resolve it.
//   B (skeleton): the USP proof — on an A→B,C chit, A disputes with B ONLY; assert C is excluded + the room is private.
// LOCATORS: chit-dispute · dispute-category · dispute-reason · dispute-raise · dispute-resolve-open/note/submit ·
//           dispute-room-input · dispute-room-send · nav-disputes
const { test, expect } = require('@playwright/test');
const { mintEntity, composeSelfChit } = require('../fixtures');

test.describe('Module · Disputes', () => {
  test('mechanics — raise a dispute on a chit, then resolve it', async ({ page }) => {
    await mintEntity(page);
    const subject = 'E2E dispute ' + Date.now();
    await composeSelfChit(page, subject);

    await test.step('RAISE — open the chit, dispute it', async () => {
      await page.getByTestId('nav-task').click();
      await page.getByText(subject).click();
      await page.getByTestId('chit-dispute').click();
      await page.getByTestId('dispute-category').selectOption('quality');
      await page.getByTestId('dispute-reason').fill('Quantity short by two units, please replace.');   // ≥10 chars
      await page.getByTestId('dispute-raise').click();
    });

    await test.step('RESOLVE — from the Disputes queue (per-party / chit-wide)', async () => {
      await page.getByTestId('nav-disputes').click();
      await expect(page.getByText(/Quantity short/i)).toBeVisible();
      await page.getByTestId('dispute-resolve-open').first().click();
      await page.getByTestId('dispute-resolve-note').fill('Replacement sent and confirmed.');
      await page.getByTestId('dispute-resolve-submit').click();
      await expect(page.getByText(/resolved/i)).toBeVisible();
    });
  });

  // THE USP PROOF — needs THREE entities on one chit. Confirms targeting + privacy + per-party resolution.
  test.skip('USP — A disputes with B only; C is excluded; the room is private (needs 3 entities)', async ({ page }) => {
    // TODO(setup): mint A, B, C. As A, compose a chit To B + To C. Open it → chit-dispute → TICK only B (the party
    //   checkbox in the raise modal) → dispute-reason → dispute-raise → post in the room (dispute-room-input/send).
    //   Then: sign in as B → sees the dispute + the room message. Sign in as C → the chit shows NO dispute, no room.
    //   Then A resolves WITH B (dispute-resolve-open for B) → B resolved; a second party would stay open (per-party).
  });
});
