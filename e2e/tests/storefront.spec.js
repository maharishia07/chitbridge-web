// MODULE: Storefront — a customer orders from a shop → a chit lands back with the shop.
// STATUS: needs a seeded shop bridge_id (a catalogue entity with a public storefront). shop.html uses stable ids
// (#o_qty/#o_name/#o_contact/#o_otp) so it can be driven without new testids once a shop exists.
const { test, expect } = require('@playwright/test');
const { DEV_OTP } = require('../fixtures');

test.describe('Module · Storefront', () => {
  test.skip('customer places an order → chit (needs CB_SHOP_BRIDGE)', async ({ page }) => {
    const bridge = process.env.CB_SHOP_BRIDGE;   // a real public shop's bridge id (a minted catalogue entity)
    test.skip(!bridge, 'set CB_SHOP_BRIDGE to a seeded shop');
    await page.goto(`/shop.html?bridge=${bridge}`);
    // TODO(per-module): pick a finish → orderOpen → fill #o_qty/#o_name/#o_contact → order/start (OTP) → #o_otp (DEV_OTP)
    //   → orderConfirm → expect "Order placed". Then log in as the shop and assert the chit is in its inbox.
  });
});
