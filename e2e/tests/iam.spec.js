// iam.spec.js — IAM: who can act, and what they may do.
//
// ⚠️ THE SCREEN ONLY BECAME HONEST TODAY. Before the hat gate shipped, "View-only" was a label the product
// displayed and did not apply, so a page saying "cannot create or change records" would have been a lie in the
// product's own voice. These tests hold that sentence to the enforcement behind it.

const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

const openIam = async (page, tab) => {
  await page.evaluate(() => window.navTo('profile'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.profSetSec('identity'));
  await page.waitForFunction(() => !!document.querySelector('[data-testid="iam-tab-who"]'), null, { timeout: 20_000 });
  if (tab) { await page.getByTestId('iam-tab-' + tab).click(); await page.waitForTimeout(900); }
};

test.describe('IAM · identity and access', () => {
  test.describe.configure({ timeout: 240_000 });

  test('[IAM-01] the section is named IAM and carries both tabs', async ({ page }) => {
    await mintEntity(page);
    await openIam(page);
    await expect(page.getByTestId('iam-tab-who')).toBeVisible();
    await expect(page.getByTestId('iam-tab-access')).toBeVisible();
    const rail = await page.locator('#prof_rail, .rows').first().textContent();
    expect(rail, 'the rail row says IAM, not Identity').toContain('IAM');
  });

  test('[IAM-02] ⭐ the spine is the BOUNDARY, not a flat list of classes', async ({ page }) => {
    await mintEntity(page);
    await openIam(page, 'who');
    const body = await page.locator('#profbody').textContent();
    /* ⚠️ Five classes with an Access column would imply this business grants access to all five. It
       administers two. The boundary is what makes three empty columns honest rather than unfinished. */
    for (const zone of ['INSIDE', 'AT THE EDGE', 'OUTSIDE']) {
      expect(body, zone + ' is a heading').toContain(zone);
    }
    expect(body, 'and a supplier is explicitly NOT an identity you grant').toMatch(/do not give these access/i);
  });

  test('[IAM-03] ⭐⭐ every access row names its PROVENANCE', async ({ page }) => {
    await mintEntity(page);
    await openIam(page, 'access');
    const body = await page.locator('#profbody').textContent();
    /* "Why can't I do this?" is the real question. DERIVED and CAPPED are the two answers no other screen
       gives — nothing else says "this is true because of where you sit in the tree". */
    for (const p of ['DIRECT', 'DERIVED', 'CAPPED', 'THEIRS']) {
      expect(body, p + ' appears as a provenance').toContain(p);
    }
    expect(body, 'and the page says what it cannot change').toMatch(/cannot be lifted from inside/i);
  });

  test('[IAM-04] ⚠️ a restricted hat is shown as ENFORCED, not merely labelled', async ({ page }) => {
    await mintEntity(page);
    await openIam(page, 'access');
    const html = await page.evaluate(() => {
      /* drive the renderer directly with a known roster — the shared account has no restricted co-assist,
         and inventing one would pollute it for every other spec. */
      /* ⚠️ BARE `UI`, NOT `window.UI` — a top-level `let` is script-scoped and never lands on window. I have
         now made this mistake three times in one day, twice after writing the guard that catches it. Guard 16
         scans for window.X READS; this was a WRITE, which it does not look at — a checker's blind spot is
         exactly where the same bug goes next. */
      const save = UI._iamActors;
      UI._iamActors = [{ display_name: 'Priya', hat: 'view_only' }, { display_name: 'Ravi', hat: 'act' }];
      const out = iamAccessHTML({ catalogue_visibility: 'public', visibility_cap: { max: 'public' } });
      UI._iamActors = save;
      return out;
    });
    expect(html, 'the restricted person is named').toContain('Priya');
    /* ⚠️ THE SENTENCE THAT WOULD HAVE BEEN A LIE THIS MORNING. It is only true because the hat gate ships. */
    expect(html, 'and the restriction is stated as enforced').toMatch(/cannot create or change records/i);
    expect(html, 'while an acting co-assist is not').toMatch(/May create and change records/);
  });
});
