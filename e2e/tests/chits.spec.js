// MODULE: Chits — compose → send → the chit appears in the sender's Order (sent) list.
// STATUS: mint (arrange) works today; the compose steps need Compose data-testids (per-module follow-up).
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Module · Chits', () => {
  test('mint, then compose + send a chit', async ({ page }) => {
    await mintEntity(page);
    await expect(page).toHaveURL(/#\/app/);
    await expect(page.locator('#root')).toBeVisible();

    // TODO(per-module): add data-testid to Compose, then drive it here:
    //   await page.getByTestId('nav-compose').click();
    //   await page.getByTestId('chit-subject').fill('E2E order');
    //   await page.getByTestId('chit-item-name').fill('Widget');
    //   await page.getByTestId('chit-item-qty').fill('3');
    //   await page.getByTestId('chit-add-item').click();
    //   await page.getByTestId('chit-send').click();
    //   await page.getByTestId('nav-order').click();
    //   await expect(page.getByText('E2E order')).toBeVisible();
    test.info().annotations.push({ type: 'todo', description: 'Compose testids pending — extend this module next.' });
  });
});
