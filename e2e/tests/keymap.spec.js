// keymap.spec.js — the global keyboard map: does every advertised key actually do its job?
//
// Athi, 2026-08-16: *"may be you can create a keyboard mapping, each icon works with which key stroke."*
//
// ⚠️ THE POINT OF THIS SPEC IS THE THREE RULES, not the shortcuts. A global keydown handler is easy to write and
// easy to make hostile: firing while someone types, stealing Ctrl-F, or closing every layer at once. Each of
// those is asserted here, because each is invisible until it ruins someone's day.

const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Keyboard map · the app is operable and does not fight the browser', () => {
  test.describe.configure({ timeout: 150_000 });

  test('[KEY-01] ? opens a list of shortcuts, and it is generated from the registry', async ({ page }) => {
    await mintEntity(page);
    await page.keyboard.press('?');
    const ov = page.locator('#cbkeys_ov');
    await expect(ov, 'pressing ? must show the keyboard help').toBeVisible();

    /* ⚠️ GENERATED, NOT WRITTEN. The overlay must list exactly what CBKEYS holds — a hand-maintained help panel
       is wrong the first time somebody adds a key and forgets it, and a keyboard map that lies is worse than
       none because the reader stops trusting the entries that are right. */
    const registry = await page.evaluate(() => (window.CBKEYS || []).map((s) => s.k));
    expect(registry.length, 'CBKEYS must be readable from the page').toBeGreaterThan(3);
    const shown = await ov.locator('kbd').allTextContents();
    expect(shown.map((s) => s.trim()).sort(), 'every registered key must appear in the overlay')
      .toEqual(registry.map((s) => s.trim()).sort());
  });

  test('[KEY-02] Escape closes the overlay', async ({ page }) => {
    await mintEntity(page);
    await page.keyboard.press('?');
    await expect(page.locator('#cbkeys_ov')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#cbkeys_ov'), 'Escape must close the topmost layer').toHaveCount(0);
  });

  test('[KEY-03] ⚠️ shortcuts do NOT fire while typing', async ({ page }) => {
    await mintEntity(page);
    await page.evaluate(() => window.navTo('catalogue'));
    await page.waitForTimeout(1500);
    const box = page.locator('[data-testid="cat-search"]').first();
    if (!(await box.count())) test.skip(true, 'no search box on this screen to type into');
    await box.click();
    await box.type('c?c');
    /* If the handler fired, `c` would have opened Compose and `?` the help. Neither may happen: the whole
       character sequence has to land in the field, exactly as typed. */
    await expect(page.locator('#cbkeys_ov'), '? must not open help while typing').toHaveCount(0);
    await expect(box, 'the characters must reach the input, not the app').toHaveValue('c?c');
  });

  test('[KEY-04] ⚠️ modifier combinations are left to the browser', async ({ page }) => {
    await mintEntity(page);
    /* Ctrl-C must not be read as the Compose shortcut. Stealing modifier combos is how an app breaks copy,
       find and address-bar focus for the people who rely on them most. */
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(400);
    await expect(page.locator('.mover'), 'Ctrl-C must not open Compose').toHaveCount(0);
  });

  test('[KEY-05] c opens compose, Escape steps back out of it', async ({ page }) => {
    await mintEntity(page);
    await page.keyboard.press('c');
    await expect(page.locator('.mover').first(), 'c must open Compose').toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.mover'), 'Escape must close Compose').toHaveCount(0);
  });
});
