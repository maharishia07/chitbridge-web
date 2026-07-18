// VISUAL REGRESSION (reviewer §4) — baseline SETTLED screens, diff pixels each run, fail on unexpected shift/overlap/break.
// ⚠ ONLY on STABLE flows — a screen still being redesigned "fails" on every intentional change (noise). First run creates
// the baseline; commit it once the screen is settled. Runs at the counter viewport (config). Add screens as they settle.
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Visual regression · settled screens only', () => {
  test('[VIS-01] entry / sign-in screen matches baseline', async ({ page }) => {
    await page.goto('/app.html');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);                         // let it settle before the snapshot
    await expect(page).toHaveScreenshot('entry.png', { maxDiffPixelRatio: 0.02, animations: 'disabled' });
  });
});

// POST-ACTION LAYOUT SHIFT (reviewer §5) — a keyboard/nav action must NOT make the screen jump (the operator loses their
// place — a real counter-speed killer). Anchor a stable element and assert it doesn't move after an action.
test.describe('Layout stability · no jump after an action', () => {
  test('[SHIFT-01] switching screens does not shift the sidebar', async ({ page }) => {
    await mintEntity(page);
    const anchor = page.getByTestId('nav-compose');
    const before = await anchor.boundingBox();
    await page.getByTestId('nav-task').click();
    await page.waitForTimeout(300);
    const after = await anchor.boundingBox();
    expect(Math.abs((after && after.y || 0) - (before && before.y || 0)), 'sidebar shifted after a nav action').toBeLessThan(5);
  });
});
