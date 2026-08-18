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

test.describe('Standards · where they bite, and why we bother', () => {
  test.describe.configure({ timeout: 240_000 });

  test('[STD-06] ⭐ every standard says WHERE it is used and WHAT it removes', async ({ page }) => {
    await mintEntity(page);
    await page.evaluate(() => window.navTo('settings'));
    await page.waitForTimeout(1200);
    await page.getByTestId('set-sec-standards').click();
    await page.waitForTimeout(700);
    const rows = await page.evaluate(() => (window.STANDARDS || []).map((s) => ({ n: s.n, at: s.at || '', why: s.why || '' })));
    expect(rows.length).toBeGreaterThan(15);
    for (const r of rows) {
      /* ⚠️ A standard named without a place is trivia. "GS1 — SKU identity" tells a reader nothing they can act
         on; "used in Catalogue › product identity, because the three-way match needs both sides to agree this is
         the same product" is the difference between a compliance list and an explanation. */
      expect(r.at.length, r.n + ' says where it is used').toBeGreaterThan(3);
      expect(r.why.length, r.n + ' says what failure it removes').toBeGreaterThan(25);
    }
  });

  test('[STD-07] ⚠️ the argument states its COSTS, not only its benefits', async ({ page }) => {
    await mintEntity(page);
    await page.evaluate(() => window.navTo('settings'));
    await page.waitForTimeout(1200);
    await page.getByTestId('set-sec-standards').click();
    await page.waitForTimeout(700);
    await page.getByTestId('std-tab-why').click();
    await page.waitForTimeout(600);
    const body = await page.locator('#setbody').textContent();

    expect(body, 'the structural reason, not "quality"').toMatch(/crosses a boundary/i);
    /* ⚠️ A page listing only benefits would be the same overclaim the status column exists to prevent, one level
       up. If a later edit trimmed the costs to make the page read better, this is what would catch it. */
    expect(body, 'costs are stated').toMatch(/What it costs/i);
    expect(body, 'including the obligation a claim creates').toMatch(/broken promise/i);
    /* Evidence from this codebase rather than assertions — the part that turns an opinion into a case. */
    expect(body, 'and what it has actually caught here').toMatch(/117 real failures/);
  });

  test('[STD-08] governance links to where the choice is made, rather than swallowing it', async ({ page }) => {
    await mintEntity(page);
    await page.evaluate(() => window.navTo('settings'));
    await page.waitForTimeout(1200);
    await page.getByTestId('set-sec-governance').click();
    await page.waitForTimeout(800);
    /* ⚠️ Governance sets the ENVELOPE; Settings picks a point inside it. Merging them would bury a weekly
       control inside a screen visited twice a year — so the two are linked instead, and these are the links. */
    for (const id of ['gov-to-locale', 'gov-to-appearance', 'gov-to-standards']) {
      await expect(page.getByTestId(id).first(), id).toBeVisible();
    }
  });
});

test.describe('Standards in the Legend', () => {
  test.describe.configure({ timeout: 240_000 });

  test('[STD-09] ⭐ the Legend carries the same argument, from the same renderer', async ({ page }) => {
    await mintEntity(page);
    await page.evaluate(() => { if (typeof window.openLegend === 'function') window.openLegend(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.setLbTab && window.setLbTab('std'));
    await page.waitForTimeout(2500);            // cap-standards loads on demand from this surface
    const body = await page.locator('#lbhost').textContent();

    expect(body, 'the structural claim, word for word').toMatch(/crosses a boundary/i);
    /* ⚠️ THE COSTS MUST TRAVEL TOO. The Legend is where this is used to PERSUADE, which is exactly the surface
       where a benefits-only version would be tempting — and exactly where it would do most damage. */
    expect(body, 'the costs travel with the benefits').toMatch(/What it costs/i);
    expect(body, 'and the evidence from this codebase').toMatch(/117 real failures/);
  });

  test('[STD-10] the Legend counts are LIVE, not a sentence someone typed', async ({ page }) => {
    await mintEntity(page);
    await page.evaluate(() => { if (typeof window.openLegend === 'function') window.openLegend(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.setLbTab && window.setLbTab('std'));
    await page.waitForTimeout(2500);
    const shown = await page.locator('#lbhost').textContent();
    const real = await page.evaluate(() => {
      const n = { live: 0, part: 0, plan: 0 };
      (window.STANDARDS || []).forEach((x) => { n[x.s]++; });
      return n;
    });
    /* A Legend claiming "26 standards" that had drifted from the register would be the overclaim this whole
       area exists to prevent — on the one surface where it is being used to persuade. */
    expect(real.live, 'the register is loaded').toBeGreaterThan(5);
    expect(shown, 'the in-force count matches the register').toContain(real.live + ' in force');
    expect(shown, 'and so does the partial count').toContain(real.part + ' partly');
  });
});
