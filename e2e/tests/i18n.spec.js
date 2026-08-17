// i18n.spec.js — the string registry: does choosing a language actually change what the app says?
//
// Athi, 2026-08-16: *"each icon we have to change the language — if french is using then all the icon should show
// french. If the icon text is hardcoded, we need to make it language friendly."*
//
// ⚠️ SCOPE, STATED HONESTLY: the RAIL is translated and the rest of the app is not. This spec asserts exactly
// that and no more. A test that implied full coverage would be the same lie as a picker that implies it.

const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('i18n · the rail speaks the chosen language', () => {
  test.describe.configure({ timeout: 150_000 });

  test('[I18N-01] every registry entry has a key that the app actually asks for', async ({ page }) => {
    await mintEntity(page);
    const report = await page.evaluate(() => {
      const reg = window.CBI18N || {};
      const langs = Object.keys(reg).filter((l) => l !== 'en');
      const enKeys = new Set();
      // the rail is the wired surface: every item asks for nav.<key>
      document.querySelectorAll('.menu [data-testid^="nav-"]').forEach((b) => {
        enKeys.add('nav.' + b.getAttribute('data-testid').replace(/^nav-/, ''));
      });
      const orphans = {};
      langs.forEach((l) => {
        const extra = Object.keys(reg[l]).filter((k) => k.startsWith('nav.') && !enKeys.has(k));
        if (extra.length) orphans[l] = extra;
      });
      return { langs, railKeys: [...enKeys], orphans };
    });
    expect(report.langs.length, 'more than English must be registered').toBeGreaterThan(0);
    /* ⚠️ AN ORPHAN IS A TRANSLATION NOBODY WILL EVER SEE — a key that no longer matches any rail item, usually
       because the item was renamed. It costs nothing at runtime and quietly rots the registry, so it is worth
       naming while it is one line rather than fifty. */
    expect(report.orphans, 'every nav.* translation must correspond to a rail item that exists').toEqual({});
  });

  test('[I18N-02] ⭐ switching to Tamil changes the rail, and back to English restores it', async ({ page }) => {
    await mintEntity(page);
    const railText = () => page.evaluate(() =>
      [...document.querySelectorAll('.menu [data-testid^="nav-"]')].map((b) => b.textContent.trim()).join(' | '));

    const before = await railText();
    expect(before, 'the rail must render before we can test it changing').toContain('Catalogue');

    await page.evaluate(() => window.cbSetLang('ta'));
    await page.waitForTimeout(700);
    const ta = await railText();
    expect(ta, 'the Tamil rail must not read the same as the English one').not.toEqual(before);
    expect(ta, 'Catalogue must render in Tamil').toContain('பட்டியல்');

    await page.evaluate(() => window.cbSetLang('en'));
    await page.waitForTimeout(700);
    expect(await railText(), 'switching back must restore English exactly').toEqual(before);
  });

  test('[I18N-03] an unknown language falls back to English rather than blanking the rail', async ({ page }) => {
    await mintEntity(page);
    const before = await page.evaluate(() =>
      [...document.querySelectorAll('.menu [data-testid^="nav-"]')].map((b) => b.textContent.trim()).join(' | '));
    /* ⚠️ Written straight to storage, bypassing cbSetLang's guard — because the value that will actually appear
       here one day is a stale one saved by an older build, not one a picker offered. */
    await page.evaluate(() => { try { localStorage.setItem('cb_lang', 'xx'); } catch (_) {} });
    await page.reload();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() =>
      [...document.querySelectorAll('.menu [data-testid^="nav-"]')].map((b) => b.textContent.trim()).join(' | '));
    expect(after, 'an unknown language must degrade to English, never to blanks or key names').toEqual(before);
    expect(after, 'a raw key must never reach the screen').not.toContain('nav.');
    await page.evaluate(() => { try { localStorage.removeItem('cb_lang'); } catch (_) {} });
  });

  test('[I18N-04] the picker is beside the theme, and says what is still English', async ({ page }) => {
    await mintEntity(page);
    await page.getByTestId('icon-avatar').click();
    await expect(page.getByTestId('lang-picker'), 'the language picker must live with the theme picker').toBeVisible();
    await expect(page.getByTestId('theme-picker')).toBeVisible();
    const body = await page.getByTestId('lang-picker').locator('..').textContent();
    /* ⚠️ The honesty note is part of the feature. Four language buttons imply the app speaks four; it does not
       yet, and letting it imply otherwise is how someone switches to Tamil, sees English, and reports a bug. */
    expect(body, 'the picker must say the rest of the app is still English').toMatch(/still English/i);
  });
});
