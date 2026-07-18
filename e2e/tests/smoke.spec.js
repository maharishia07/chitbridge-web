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
      await page.keyboard.press('Escape').catch(() => {});
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
