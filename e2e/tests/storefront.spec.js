// MODULE: Storefront — a customer orders from a public shop → a chit lands back with the shop.
// FLOW: open shop → pick a finish → Order → qty/name/contact → Send code → OTP → Place order → "Order placed".
// DATA: CB_SHOP_BRIDGE = a seeded public shop's bridge id; DEV_OTP=123456.
// LOCATORS: shop-order-* · shop-combo · shop-qty · shop-name · shop-area · shop-contact · shop-send-code · shop-otp · shop-place-order
const { test, expect } = require('@playwright/test');
const { DEV_OTP } = require('../fixtures');

test.describe('Module · Storefront', () => {
  test('[SHOP-01] customer places an order → chit', async ({ page }) => {
    const bridge = process.env.CB_SHOP_BRIDGE;
    test.skip(!bridge, 'set CB_SHOP_BRIDGE to a seeded public shop bridge id');

    await test.step('open the shop, order the first finish', async () => {
      await page.goto(`/shop.html?bridge=${bridge}`);
      await page.locator('[data-testid^="shop-order-"]').first().click();
      await expect(page.getByTestId('shop-contact')).toBeVisible();
    });
    await test.step('fill details → send code', async () => {
      await page.getByTestId('shop-qty').fill('10');
      await page.getByTestId('shop-name').fill('E2E Customer');
      await page.getByTestId('shop-contact').fill('e2e' + Date.now() + '@test.example');
      await page.getByTestId('shop-send-code').click();
    });
    await test.step('OTP → place order', async () => {
      await expect(page.getByTestId('shop-otp')).toBeVisible();
      await page.getByTestId('shop-otp').fill(DEV_OTP);
      await page.getByTestId('shop-place-order').click();
      await expect(page.getByText('Order placed')).toBeVisible();
    });
  });
});
