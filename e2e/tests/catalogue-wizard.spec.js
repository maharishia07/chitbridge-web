// VISUAL WALKTHROUGH — the NEW catalogue setup wizard (local prototype on feat/panel-fixes).
// Runs headless against localhost (set CB_WEB_BASE=http://localhost:5173). Screenshots every step into
// wizard-shots/ so a human can eyeball the rendering. The wizard uses onclick handlers (no data-testids yet),
// so we navigate via its GLOBAL functions (cwNext/cwBulkMode/…) and exercise real inputs for content.
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, '..', 'wizard-shots');
// a tiny 2×2 PNG so the photo path shows a real thumbnail
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSFENAJd0A/3nQ0f0AAAAAElFTkSuQmCC', 'base64');

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
}
const openWizard = (page) => page.evaluate(() => { UI.catf = null; UI.cw = null; UI.nav = 'cataloguesetup'; renderApp(); });
const step = (page) => page.evaluate(() => (UI.cw && UI.cw.step) || 0);

test.use({ video: 'on' });   // record a filmstrip Athi can watch

test.describe('Catalogue wizard · visual walkthrough', () => {
  test('[CWIZ-01] walk all six steps + face + standards', async ({ page }) => {
    test.setTimeout(120_000);
    await mintEntity(page);
    await openWizard(page);
    await page.waitForTimeout(500);

    await test.step('Step 1 · Vertical + fields + units', async () => {
      await shot(page, '01-step1-empty.png');
      // describe a purpose and let it suggest fields
      const purpose = page.locator('#cw_purpose');
      if (await purpose.count()) { await purpose.fill('A paint shop selling Royale Play textured finishes by the litre, plus putty by kg and brushes by count'); }
      await page.evaluate(() => { if (typeof cwUnderstand === 'function') cwUnderstand(); });
      await shot(page, '02-step1-fields.png');
      // UNITS multi-select — pick several + add a custom one
      await page.evaluate(() => { ['kg', 'litre', 'count'].forEach(function (u) { cwToggleUnit(u); }); });
      const nu = page.locator('#cw_newunit');
      if (await nu.count()) { await nu.fill('drum'); await page.evaluate(() => cwAddUnit()); }
      await shot(page, '03-step1-units.png');
    });

    await test.step('Step 2 · Blueprint', async () => {
      await page.evaluate(() => cwNext());
      await page.waitForTimeout(1200);   // Step 2 loads sources from the API
      await shot(page, '04-step2-blueprint.png');
    });

    await test.step('Step 3 · ERP mapping', async () => {
      await page.evaluate(() => cwNext());
      await shot(page, '05-step3-erp.png');
    });

    await test.step('Step 4 · Manual — CSV + photos', async () => {
      await page.evaluate(() => cwNext());
      // CSV tab: paste a row with a QUOTED COMMA (the fix) and import
      await page.evaluate(() => cwBulkMode('csv'));
      const csv = page.locator('#cw_bulk_csv');
      if (await csv.count()) { await csv.fill('name,price,hsn\n"Royale Play, Metallic",640,3209\nPutty,120,3214'); await page.evaluate(() => cwImportCSV()); }
      await shot(page, '06-step4-csv.png');
      // Photos tab: upload two images (one path) → thumbnails, then commit
      await page.evaluate(() => cwBulkMode('photos'));
      const fi = page.locator('#cw_photo_input');
      if (await fi.count()) {
        await fi.setInputFiles([{ name: 'tussar.png', mimeType: 'image/png', buffer: PNG }, { name: 'ikkat.png', mimeType: 'image/png', buffer: PNG }]);
        await page.waitForTimeout(500);
      }
      await shot(page, '07-step4-photos.png');
      await page.evaluate(() => { if (typeof cwPhotosCommit === 'function') cwPhotosCommit(); });
      await shot(page, '08-step4-photos-added.png');
    });

    await test.step('Step 5 · Price', async () => {
      await page.evaluate(() => cwNext());
      await shot(page, '09-step5-price.png');
    });

    await test.step('Step 6 · Tax + finish', async () => {
      await page.evaluate(() => cwNext());
      await shot(page, '10-step6-tax.png');
    });

    await test.step('Finish → committed face', async () => {
      await page.evaluate(() => { if (typeof cwFinish === 'function') cwFinish(); });
      await page.waitForTimeout(800);
      await shot(page, '11-face.png');
    });

    await test.step('Standards panel', async () => {
      await page.evaluate(() => { if (typeof catfStandardsModal === 'function') catfStandardsModal(); });
      await page.waitForTimeout(400);
      await shot(page, '12-standards.png');
    });

    // sanity: we actually reached the face (or at least ran the wizard)
    expect(await page.evaluate(() => !!(UI.catf || UI.cw))).toBeTruthy();
  });
});
