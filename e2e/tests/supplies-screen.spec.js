// [SUP-01] THE SUPPLIES SCREEN, DRIVEN. Athi: "we may have to have a screen to add sundry items in case if it is
// not coming through the channel." Built 2026-09-10 and opened by nobody — this is the first time it runs.
//
// ⚠️ IT DRIVES THE SCREEN, NOT THE API. The routes are already covered by [ADOPT-01]; what is untested here is
// whether a person can actually reach any of it: whether the rail row exists, whether the capability loads,
// whether the buttons are wired to functions that exist. A screen nobody has opened is where the missing global
// and the mistyped id live.
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test('[SUP-01] a shop can list, add, buy and use supplies from the screen', async ({ page }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Sundry ' + Date.now().toString().slice(-6) });

  await test.step('⭐ the rail carries a row for it, and it opens', async () => {
    /* ⚠️ CLICK THE RAIL, do not set UI.nav by hand. Driving the control is the only way to prove a person can
       get there — go() would skip exactly the wiring that is under test. */
    const row = page.locator('text=Supplies').first();
    await expect(row, 'there is no way into the screen from the rail').toBeVisible({ timeout: 30000 });
    await row.click();
    /* the capability is lazy — the screen arrives a moment after the click */
    await expect(page.getByTestId('sup-add')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('sup-buy')).toBeVisible();
  });

  await test.step('⚠️ the empty screen SAYS what it is for — without that it reads like a second catalogue', async () => {
    const body = await page.locator('#sup_body').textContent();
    expect(body).toMatch(/never appear on your storefront/i);
    expect(body, 'it must point somewhere for the things a shop SELLS').toMatch(/Catalogue/);
  });

  await test.step('⭐⭐ add one by hand — the off-channel case, which is the common one', async () => {
    await page.getByTestId('sup-add').click();
    await expect(page.getByTestId('sup-name')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('sup-name').fill('Floor cleaner 5L');
    await page.getByTestId('sup-unit').fill('can');
    await page.getByTestId('sup-save').click();
    await expect(page.getByTestId('sup-row').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#sup_body')).toContainText('Floor cleaner 5L');
    /* ⚠️ EXPENSED BY DEFAULT — the materiality call, and the default is the cheaper one */
    await expect(page.locator('#sup_body'), 'a new supply must default to expensed, not counted')
      .toContainText(/expensed/i);
  });

  await test.step('⭐ one that IS counted', async () => {
    await page.getByTestId('sup-add').click();
    await page.getByTestId('sup-name').fill('Carry covers');
    await page.getByTestId('sup-unit').fill('piece');
    await page.getByTestId('sup-keep').check();
    await page.getByTestId('sup-save').click();
    await expect(page.locator('#sup_body')).toContainText('Carry covers', { timeout: 20000 });
    await expect(page.locator('#sup_body')).toContainText(/counted/i);
  });

  await test.step('⚠️ a purchase with no reference is refused, and says what to put', async () => {
    await page.getByTestId('sup-buy').click();
    await expect(page.getByTestId('sup-l-name')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('sup-l-name').first().fill('Floor cleaner 5L');
    await page.getByTestId('sup-l-qty').first().fill('2');
    await page.getByTestId('sup-l-cost').first().fill('400');
    await page.getByTestId('sup-record').click();
    /* ⚠️ THE MESSAGE SAYS WHAT TO PUT, not that a field is missing — a bill number, or the date and the shop */
    await expect(page.locator('body')).toContainText(/reference/i, { timeout: 15000 });
  });

  await test.step('⭐⭐ record a cash purchase from a shop that is not on ChitBridge', async () => {
    await page.getByTestId('sup-from').fill('Corner Hardware');
    await page.getByTestId('sup-ref').fill('CASH-' + Date.now().toString().slice(-6));
    await page.getByTestId('sup-record').click();
    /* the list repaints with what it last cost and who from — the two facts that make a repeat purchase
       recognisable at the counter of the hardware shop */
    await expect(page.locator('#sup_body')).toContainText('Corner Hardware', { timeout: 25000 });
  });

  await test.step('⭐ a counted supply can be marked used; an expensed one offers no such button', async () => {
    const rows = page.getByTestId('sup-row');
    const n = await rows.count();
    let counted = null, expensed = null;
    for (let i = 0; i < n; i++) {
      const t = await rows.nth(i).textContent();
      if (/Carry covers/.test(t)) counted = rows.nth(i);
      if (/Floor cleaner/.test(t)) expensed = rows.nth(i);
    }
    expect(counted, 'the counted supply is missing from the list').toBeTruthy();
    /**
     * ⚠️ AN EXPENSED SUPPLY HAS NO BALANCE TO ISSUE FROM, so it must not offer the button at all. Offering it and
     * then refusing on the server would be a screen that invites a person to do something impossible.
     */
    expect(await expensed.getByTestId('sup-use').count(), 'an expensed supply must not offer "Used some"').toBe(0);
    await counted.getByTestId('sup-use').click();
    await page.getByTestId('sup-use-qty').fill('50');
    await page.getByTestId('sup-use-save').click();
    await expect(page.getByTestId('sup-add'), 'the modal should close and the screen come back').toBeVisible({ timeout: 20000 });
  });

  await test.step('⚠️⚠️ and NOTHING from here reaches the catalogue', async () => {
    const items = await page.evaluate(async () => api('prodList'));
    const names = ((items && (items.items || items.products || items)) || [])
      .map((x) => (x.item_data && x.item_data.name) || x.name || '').join(' | ');
    /* the whole reason supplies are a separate table rather than a flag */
    expect(names).not.toMatch(/Floor cleaner|Carry covers/);
  });
});
