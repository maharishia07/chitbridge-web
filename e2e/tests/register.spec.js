// MODULE: The Register (RAID) — b185. A register attached to anything; entries that END with a disposition.
// FLOW A: the three views exist and are reachable — Live · Closure · Impact.
// FLOW B: ⭐ THE OUTCOME LOOP. Open a standalone register → record a risk → the gate refuses to close it →
//         end it as an ACTION → it comes out under "Work came out of it" → the register can then be closed.
// LOCATORS: nav-raida · register-panel · register-tab-{live|closure|impact} · register-new · register-new-type
//           register-new-name · register-new-save · register-subject · raida-add-open · raida-kind · raida-body
//           raida-save · raida-item · raida-close · raida-disposition · raida-close-note · raida-close-save
//           closure-item · register-close
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

/**
 * ⚠️⚠️ FORCED LOGGED-OUT, so this file ALWAYS mints its own entity. The authed project carries a saved
 * session, and mintEntity returns that existing entity untouched when one is present — which would write a
 * test register into whoever is signed in. A spec that creates data must own the account it creates it in.
 */
test.use({ storageState: { cookies: [], origins: [] } });

/* ⚠️ The Register is a LAZY capability (app/cap-register.js) opened as an overlay, not a nav screen — so the
   rail button opens a panel and leaves UI.nav where it was. Every wait below is on the panel, never on a URL. */
async function openRegister(page) {
  await page.getByTestId('nav-raida').click();
  await expect(page.getByTestId('register-panel')).toBeVisible({ timeout: 15000 });
}

test.describe('Module · Register', () => {
  test('[REG-01] three views, each reachable', async ({ page }) => {
    await mintEntity(page);
    await openRegister(page);
    for (const v of ['live', 'closure', 'impact']) {
      await test.step(`view: ${v}`, async () => {
        await page.getByTestId(`register-tab-${v}`).click();
        await expect(page.getByTestId(`register-tab-${v}`)).toHaveClass(/on/);
      });
    }
  });

  test('[REG-02] a finding becomes an action, and only then does the register close', async ({ page }) => {
    await mintEntity(page);
    await openRegister(page);

    /* A register on something that is NOT an order — the whole point of register_subject. */
    await page.getByTestId('register-new').click();
    await page.getByTestId('register-new-type').selectOption('campaign');
    await page.getByTestId('register-new-name').fill('E2E qualification');
    await page.getByTestId('register-new-save').click();
    await expect(page.getByTestId('register-subject').filter({ hasText: 'E2E qualification' }))
      .toBeVisible({ timeout: 15000 });

    await page.getByTestId('raida-add-open').click();
    await page.getByTestId('raida-kind').selectOption('risk');
    await page.getByTestId('raida-body').fill('Rig availability may slip past week 3');
    await page.getByTestId('raida-save').click();
    await expect(page.getByTestId('raida-item').filter({ hasText: 'Rig availability' }))
      .toBeVisible({ timeout: 15000 });

    /* ⭐⭐ THE GATE, stated before the button rather than discovered by pressing it. While anything is open the
       close control must not be offered at all — an affordance that will refuse is worse than none. */
    await page.getByTestId('register-tab-closure').click();
    await expect(page.getByText('1 still open')).toBeVisible();
    await expect(page.getByTestId('register-close')).toHaveCount(0);

    /* End it as work, not as "done" — the distinction the six dispositions exist for. */
    await page.getByTestId('register-tab-live').click();
    await page.getByTestId('raida-close').first().click();
    await page.getByTestId('raida-disposition').selectOption('action');
    await page.getByTestId('raida-close-note').fill('Booked the rig for week 2');
    await page.getByTestId('raida-close-save').click();

    /* ⭐ THE OUTCOME. Athi: "at the end of the test, it has to clearly come out as actions?" — it does, and it
       is grouped by what it LANDS ON someone, not by the fact that it stopped being open. */
    await page.getByTestId('register-tab-closure').click();
    await expect(page.getByText('Work came out of it')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('closure-item').filter({ hasText: 'Rig availability' })).toBeVisible();
    await expect(page.getByTestId('register-close')).toBeVisible();
  });

  /**
   * ⚠️⚠️ BOTH HALVES OF THIS WERE MISSING AND NEITHER FAILED LOUDLY — found by the showcase driver once it was
   * made to verify its own writes:
   *
   *   1. the add form had NO target field, so `to_id` was never set, every dependency stayed a sentence, and
   *      the Impact view could not be populated through the product no matter what anyone typed;
   *   2. `carried_forward` was offered in the endings list while the server refuses it without a destination,
   *      so choosing it ALWAYS failed — an affordance that will refuse, which reads as the user's mistake.
   */
  test('[REG-03] a dependency that names a target becomes a walkable edge', async ({ page }) => {
    await mintEntity(page);
    await openRegister(page);

    const newRegister = async (type, name) => {
      await page.getByTestId('register-new').click();
      await page.getByTestId('register-new-type').selectOption(type);
      await page.getByTestId('register-new-name').fill(name);
      await page.getByTestId('register-new-save').click();
      await expect(page.getByTestId('register-subject').filter({ hasText: name.split(' ')[0] }))
        .toBeVisible({ timeout: 20000 });
    };
    await newRegister('release', 'Pad refurbishment');
    await newRegister('campaign', 'Engine E-7 qualification');

    await page.getByTestId('raida-add-open').click();
    await page.getByTestId('raida-kind').selectOption('dependency');
    /* The target fields appear ONLY for a dependency — the other five kinds do not point. */
    await expect(page.getByTestId('raida-to')).toBeVisible();
    await page.getByTestId('raida-body').fill('Cannot start hot-fire until the pad is signed off');
    await page.getByTestId('raida-to').selectOption({ label: 'Pad refurbishment' });
    await page.getByTestId('raida-save').click();
    await expect(page.getByTestId('raida-item').filter({ hasText: 'hot-fire' }))
      .toBeVisible({ timeout: 20000 });

    /* ⭐ THE GRAPH. Before the target field existed this pane could only ever say "nothing points anywhere". */
    await page.getByTestId('register-tab-impact').click();
    await expect(page.getByTestId('walk-graph')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('walk-graph')).toContainText('Pad refurbishment');

    /* And carrying it forward names where it went, rather than failing silently. */
    await page.getByTestId('register-tab-live').click();
    await page.getByTestId('raida-close').first().click();
    await page.getByTestId('raida-disposition').selectOption('carried_forward');
    await expect(page.getByTestId('raida-carry')).toBeVisible();
    await page.getByTestId('raida-carry').selectOption({ label: 'Pad refurbishment' });
    await page.getByTestId('raida-close-note').fill('Moves to the pad register');
    await page.getByTestId('raida-close-save').click();
    await page.getByTestId('register-tab-closure').click();
    await expect(page.getByText('Work came out of it')).toBeVisible({ timeout: 20000 });
  });
});
