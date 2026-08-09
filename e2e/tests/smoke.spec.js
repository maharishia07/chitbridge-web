// SMOKE: after minting, open EVERY menu item + toolbar icon and confirm each part renders (no crash).
// This is the "we've seen each part is working" pass. Menu items auto-get a nav-<key> testid (menuBtn), so this list
// is the coverage checklist — extend it as the panel grows. Capability-gated items (connectors/disputes) may be hidden;
// those are skipped (not failed) when absent.
const { test, expect } = require('@playwright/test');
const { mintEntity, dismissModal } = require('../fixtures');

const NAV = ['task', 'order', 'folders', 'drafts', 'trash', 'archive', 'network', 'suppliers', 'customers',
  'catalogue', 'readiness', 'coassists', 'mis', 'disputes', 'profile', 'settings', 'assistreview'];

test.describe('Smoke · every menu item + icon renders', () => {
  test('[SMOKE-01] open each menu item', async ({ page }) => {
    await mintEntity(page);
    await expect(page.getByTestId('nav-compose')).toBeVisible();   // app shell (restored session lands at #/, fresh mint at #/app)
    for (const key of NAV) {
      await test.step(`nav: ${key}`, async () => {
        const item = page.getByTestId(`nav-${key}`);
        if (await item.count() === 0) return;               // capability-gated + hidden → skip, don't fail
        await item.click();
        await expect(page.locator('#mainbody')).toBeVisible();   // the screen mounted without crashing
      });
    }
  });

  test('[SMOKE-02] open compose + each toolbar icon', async ({ page }) => {
    await mintEntity(page);
    await test.step('compose (modal)', async () => {
      await page.getByTestId('nav-compose').click();
      await expect(page.locator('#modalhost')).not.toBeEmpty();   // compose modal opened
      /**
       * ⚠️ Escape was a NO-OP here and this step only continued because the modal was being destroyed underneath
       * it by a background renderApp (fixed 2026-08-09). With that gone, compose correctly stays open and its
       * backdrop intercepts every toolbar click below — so close it deliberately, the way the other steps do.
       *
       * Escape-to-close is deliberately NOT wired for compose: it would discard a draft on a stray keypress,
       * which is the same lost work the renderApp fix exists to prevent. Cancel and the ✕ are explicit; minimise
       * keeps the draft.
       */
      await dismissModal(page);
      await expect(page.locator('#modalhost')).toBeEmpty();
    });
    await test.step('assistant', async () => {
      await page.getByTestId('assistant-open').click();
      await expect(page.getByTestId('assist-input')).toBeVisible();
      await page.getByTestId('assist-close').click();
    });
    await test.step('messages', async () => { await page.getByTestId('icon-messages').click(); await dismissModal(page); });
    await test.step('notifications', async () => { await page.getByTestId('icon-notifications').click(); await dismissModal(page); });
    await test.step('legend', async () => { await page.getByTestId('icon-legend').click(); await dismissModal(page); });
  });
});
