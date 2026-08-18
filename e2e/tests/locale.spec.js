// locale.spec.js — the localisation layer and its screen.
//
// ⚠️ WHY THIS EXISTS, BEYOND THE FEATURE: three times in one session a generator-only constant (`BT`, then `Q`
// twice) was emitted into shipped code. Each one PARSES — a bare identifier is valid syntax — so node --check,
// the guard and the parse loop all pass, and the failure only arrives when the line RUNS. Each reached Athi as
// "the menu doesn't open" / "selection doesn't work", never as an error.
//
// A test that RENDERS the screen and presses its controls is the only thing that catches that class.

const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

const openLocale = async (page) => {
  await page.evaluate(() => window.navTo('settings'));
  await page.waitForTimeout(1200);
  await page.getByTestId('set-sec-locale').click();
  await page.waitForTimeout(800);
};

test.describe('Localisation · the layer and its screen', () => {
  test.describe.configure({ timeout: 180_000 });

  test('[LOC-01] every control renders, and the preview with them', async ({ page }) => {
    await mintEntity(page);
    await openLocale(page);
    for (const id of ['loc-format', 'loc-nu', 'loc-hc', 'loc-ca', 'loc-fw', 'loc-preview']) {
      await expect(page.getByTestId(id), id + ' must render').toBeVisible();
    }
    /* ⚠️ The preview is the component that makes the rest usable — nobody can predict what ar-EG does to a
       number. A screen that renders its selects and not its preview is the failure this asserts against. */
    const prev = await page.getByTestId('loc-preview').textContent();
    expect(prev, 'the preview must show a locale tag').toMatch(/en-IN|en-US/);
  });

  test('[LOC-02] ⭐ millions vs lakhs — choosing the format changes the grouping', async ({ page }) => {
    await mintEntity(page);
    await openLocale(page);
    await page.getByTestId('loc-format').selectOption('en-US');
    await page.waitForTimeout(900);
    expect(await page.getByTestId('loc-preview').textContent(),
      'en-US groups in millions').toContain('123,456,789');

    await page.getByTestId('loc-format').selectOption('en-IN');
    await page.waitForTimeout(900);
    expect(await page.getByTestId('loc-preview').textContent(),
      'en-IN groups in lakhs and crores').toContain('12,34,56,789');
  });

  test('[LOC-03] the Unicode subtags actually apply', async ({ page }) => {
    await mintEntity(page);
    await openLocale(page);
    await page.getByTestId('loc-nu').selectOption('arab');
    await page.waitForTimeout(900);
    /* -u-nu-arab → Eastern Arabic digits. If the subtag were dropped or malformed this stays Western. */
    expect(await page.getByTestId('loc-preview').textContent(),
      'the numbering-system subtag must reach Intl').toMatch(/[٠-٩]/);

    await page.getByTestId('loc-nu').selectOption('');
    await page.getByTestId('loc-hc').selectOption('h23');
    await page.waitForTimeout(900);
    const tag = await page.evaluate(() => window.CBLocale.tag());
    expect(tag, 'the composed tag must carry the subtag').toContain('hc-h23');
  });

  test('[LOC-04] ⚠️ money takes the currency from the money and the format from the reader', async ({ page }) => {
    await mintEntity(page);
    const both = await page.evaluate(() => {
      window.CBLocale.setLocale('de-DE');
      const de = { inr: window.CBLocale.money(1234.5, 'INR'), usd: window.CBLocale.money(1234.5, 'USD') };
      window.CBLocale.setLocale('en-IN');
      const inLoc = { inr: window.CBLocale.money(1234.5, 'INR'), usd: window.CBLocale.money(1234.5, 'USD') };
      window.CBLocale.setLocale('');
      return { de, inLoc };
    });
    /* The same currency, formatted two ways, because the READER changed — which is the whole point. The old
       CCY_LOCALE mapping gave every reader the same string for a given currency. */
    expect(both.de.usd, 'a German reader sees German grouping on a USD amount').not.toEqual(both.inLoc.usd);
    expect(both.de.inr, 'and on an INR amount too').not.toEqual(both.inLoc.inr);
  });

  test('[LOC-05] ⚠️ the weekend comes from CLDR, not from an assumption', async ({ page }) => {
    await mintEntity(page);
    const w = await page.evaluate(() => {
      window.CBLocale.setLocale('ar-AE');
      const ae = window.CBLocale.weekInfo();
      window.CBLocale.setLocale('en-IN');
      const inw = window.CBLocale.weekInfo();
      window.CBLocale.setLocale('');
      return { ae: ae && ae.weekend, inw: inw && inw.weekend };
    });
    /* ⚠️ LOAD-BEARING FOR A TRADE PLATFORM: "due in three working days" lands on a different date in Dubai and
       Mumbai. Saudi Arabia's weekend is Fri+Sat; India's is Sunday ALONE; the UAE moved to Sat+Sun in 2022.
       Any SLA that assumes Sat/Sun is wrong for most
       of the market this product is aimed at. */
    /* ⚠️ The ASSERTION was right and its LABEL was wrong — [6,7] is Saturday+Sunday. The UAE moved to a
       Sat–Sun weekend in 2022; Fri+Sat is Saudi Arabia. A green test with a false description is worse than a
       red one, because it teaches the next reader the wrong fact with the authority of a passing check. */
    expect(w.ae, 'the UAE weekend is Saturday and Sunday (it changed in 2022)').toEqual([6, 7]);
    expect(w.inw, "India's weekend is Sunday alone").toEqual([7]);
  });

  test('[LOC-06] governance layer 2 resolves the locale rather than asserting it', async ({ page }) => {
    await mintEntity(page);
    await page.evaluate(() => window.navTo('settings'));
    await page.waitForTimeout(1000);
    await page.getByTestId('set-sec-governance').click();
    await page.waitForTimeout(800);
    await page.getByTestId('gov-layer-1').click();      // 2 · Jurisdiction
    await page.waitForTimeout(800);
    const body = await page.locator('#setbody').textContent();
    /* It read a literal em-dash until 2026-08-18 — the layer declared it governed the locale bundle and could
       not see it. */
    expect(body, 'the layer must show a real locale, not a dash').toMatch(/en-IN|en-US|English/);
    expect(body, 'and the direction it implies').toMatch(/left to right|right to left/i);
  });
});
