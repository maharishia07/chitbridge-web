// SHOWCASE: MULTIPARTY — the real capability. A shared, signed record between DIFFERENT parties, each in their own
// browser context (their own logged-in session). Run headed to WATCH the windows act together: `npm run test:multiparty`.
//   Test 1 (runnable): A sends a chit to B → B receives their own copy (sender ↔ receiver).
//   Test 2 (skeleton): A→B,C + a TARGETED dispute with B only → B sees it, C does NOT (the USP, live).
const { test, expect } = require('@playwright/test');
const { mintInContext, addRecipientByName } = require('../fixtures');

test.describe('Multiparty · the real capability', () => {
  test('[MP-01] A sends a chit to B; B receives their own copy', async ({ browser }) => {
    const A = await mintInContext(browser);   // sender
    const B = await mintInContext(browser);   // receiver
    const subject = 'Multiparty order ' + Date.now();

    await test.step('A composes a chit addressed to B', async () => {
      await A.page.getByTestId('nav-compose').click();
      await addRecipientByName(A.page, B.name);
      const subj = A.page.locator('[data-testid="chit-field-subject"]');
      if (await subj.count()) await subj.fill(subject);
      else await A.page.locator('[data-testid^="chit-field-"]').first().fill(subject);
      await A.page.getByTestId('chit-item-name').fill('Widget');
      await A.page.getByTestId('chit-item-add').click();
      await A.page.getByTestId('chit-send').click();
    });

    await test.step("B sees the chit in B's own Task inbox", async () => {
      await B.page.reload();                            // pull B's fresh state
      await B.page.getByTestId('nav-task').click();
      await expect(B.page.getByText(subject)).toBeVisible();
    });

    await A.context.close();
    await B.context.close();
  });

  // THE USP, LIVE — 3 parties, targeted dispute, privacy. Uses the same multi-context pattern.
  test.skip('[MP-02] A → B,C; A disputes with B only → B sees it, C does not (the USP)', async ({ browser }) => {
    // TODO: mint A, B, C in 3 contexts. A composes a chit To B + To C, send.
    //   A opens it → chit-dispute → TICK only B → dispute-reason → dispute-raise → dispute-room-send a private note.
    //   B: nav-task → open → sees the dispute + the room note.  C: nav-task → open → NO dispute, NO room.
    //   A resolves WITH B (dispute-resolve-open) → B resolved; C never involved. Watch it all headed.
  });
});
