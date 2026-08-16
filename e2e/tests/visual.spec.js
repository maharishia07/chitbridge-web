// VISUAL REGRESSION (reviewer §4) — baseline SETTLED screens, diff pixels each run, fail on unexpected shift/overlap/break.
// ⚠ ONLY on STABLE flows — a screen still being redesigned "fails" on every intentional change (noise). First run creates
// the baseline; commit it once the screen is settled. Runs at the counter viewport (config). Add screens as they settle.
//
// ══ ⚠️ THIS TEST ROTTED FOR THREE WEEKS, AND THAT IS THE FAILURE WORTH LEARNING FROM ══════════════════════════════
// Baseline committed 2026-07-28. By 2026-08-16 it was failing by 41,358 px — and `app.html` had had 113 commits in
// between. Not a regression: three weeks of intentional design change measured against a snapshot nobody refreshed.
//
// ⭐ A PERMANENTLY-RED TEST IS WORSE THAN NO TEST. It fails every run, so its failure stops carrying information,
// and the one time it catches something real nobody looks. It was still red on the morning of the contrast pass,
// which is how ~773 px of genuine colour change hid inside 41k of noise.
//
// ⚠️ SO: RE-BASELINE DELIBERATELY, AND SOON AFTER A SETTLED CHANGE — not "eventually". If this screen is being
// actively redesigned, take it OUT of the suite rather than let it sit red. And when re-baselining, LOOK at the
// screen first: the point is to confirm nothing is broken, not to make the number go away. Re-based 2026-08-16
// after confirming the sign-in screen renders clean — no overlap, no clipping.
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
