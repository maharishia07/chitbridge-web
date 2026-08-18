// standards.spec.js — Settings › Standards: what the platform follows, what you follow, what your trade follows.
//
// ⚠️⚠️ THE STATUS COLUMN IS WHAT THIS SPEC PROTECTS. A standards page is the page someone quotes to a buyer, so
// an overstatement here does more harm than a gap. Every row declares live / part / plan, and anything not in
// force must say what is missing. A future edit that promoted a row to "In force" without shipping the work
// would look like progress in a diff and be a false claim in production — these tests are what would notice.

const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

const open = async (page, tab) => {
  await page.evaluate(() => window.navTo('settings'));
  await page.waitForTimeout(1200);
  await page.getByTestId('set-sec-standards').click();
  await page.waitForTimeout(700);
  if (tab) { await page.getByTestId('std-tab-' + tab).click(); await page.waitForTimeout(600); }
};

test.describe('Settings › Standards', () => {
  test.describe.configure({ timeout: 240_000 });

  test('[STD-01] the section exists with all three views', async ({ page }) => {
    await mintEntity(page);
    await open(page);
    for (const t of ['platform', 'yours', 'commercial']) {
      await expect(page.getByTestId('std-tab-' + t), t + ' view').toBeVisible();
    }
  });

  test('[STD-02] ⚠️ every standard declares a status, and nothing unfinished claims otherwise', async ({ page }) => {
    await mintEntity(page);
    /* ⚠️ OPEN THE SECTION FIRST. cap-admin.js is a LAZILY-LOADED capability — nothing in it exists on `window`
       until something navigates to Settings and ensureCap() fetches it. Reading STANDARDS before that returned
       an empty list, which read exactly like "the register is empty" and is really "the file is not here yet". */
    await open(page);
    const rows = await page.evaluate(() => (window.STANDARDS || []).map((s) => ({ n: s.n, s: s.s, note: s.note || '' })));
    expect(rows.length, 'the register is populated').toBeGreaterThan(15);

    for (const r of rows) {
      expect(['live', 'part', 'plan'], r.n + ' declares a known status').toContain(r.s);
      /* ⚠️ THE RULE THAT KEEPS THIS PAGE HONEST. "Partly" without saying what is missing is indistinguishable
         from "done" to anyone reading quickly — which is exactly the reader this page is written for. */
      if (r.s === 'part') {
        expect(r.note.length, r.n + ' is partial, so it must say what is missing').toBeGreaterThan(15);
      }
    }
  });

  test('[STD-03] the platform view counts them honestly rather than showing ticks', async ({ page }) => {
    await mintEntity(page);
    await open(page, 'platform');
    const body = await page.locator('#setbody').textContent();
    expect(body, 'in-force count is stated').toMatch(/\d+ in force/);
    expect(body, 'partial count is stated').toMatch(/\d+ partly/);
    expect(body, 'planned count is stated').toMatch(/\d+ planned/);
    /* The standards themselves — a page that named none of them would pass every structural check above. */
    for (const std of ['BCP 47', 'RFC 4647', 'Okabe', 'WCAG 2.2', 'RFC 7386', 'PostgreSQL RLS']) {
      expect(body, std + ' is named').toContain(std);
    }
    /* ⚠️ The RLS row must keep naming the carve-out. "Tenant isolation enforced by the database" alone would be
       true of the six direct tables and misleading about identities, which deliberately has no policy. */
    expect(body, 'the RLS carve-out is disclosed, not glossed').toMatch(/carve-out/i);
  });

  test('[STD-04] ⭐ "what you follow" is a LIVE reading, not a stored copy', async ({ page }) => {
    await mintEntity(page);
    try {
      await page.evaluate(() => { window.CBLocale.setRegion('AE'); window.CBLocale.setLangs(['ar', 'en']); });
      await open(page, 'yours');
      let body = await page.locator('#setbody').textContent();
      expect(body, 'Arabic first means right-to-left').toMatch(/Right to left/i);

      /* Flip the order — same region, same two languages, opposite reading order. This is the assertion that
         proves direction follows the LANGUAGE rather than the region, from the UI rather than from a unit test. */
      await page.evaluate(() => window.CBLocale.setLangs(['en', 'ar']));
      await open(page, 'yours');
      body = await page.locator('#setbody').textContent();
      expect(body, 'English first means left-to-right, in the SAME region').toMatch(/Left to right/i);
    } finally {
      await page.evaluate(() => {
        ['cb_region', 'cb_langs', 'cb_lang', 'cb_locale'].forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });
        try { window.CBLocale.apply(); window.api('savePrefs', { params: { kind: 'locale' }, body: {} }).catch(() => {}); } catch (_) {}
      });
    }
  });

  test('[STD-05] the commercial view separates carried from enforced', async ({ page }) => {
    await mintEntity(page);
    await open(page, 'commercial');
    const body = await page.locator('#setbody').textContent();
    expect(body, 'Incoterms is named').toContain('Incoterms');
    /* ⚠️ The distinction a buyer would care about most, and the one easiest to blur. An Incoterm on a chit
       records what was agreed; it does not check the shipment against it. Saying so here is the difference
       between a standards page and a claim. */
    expect(body, 'and the gap is stated rather than left for a dispute').toMatch(/not the same as enforced/i);
  });
});
