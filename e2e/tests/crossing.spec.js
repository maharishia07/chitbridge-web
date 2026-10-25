// MODULE: Trading across installations (CTP crossing) and the multi-currency supplier flows — the SCREEN side of the pack whose headless side is chitbridge-api tests/crossing/.
// SCENARIO IDS are the 25 Oct 2026 walk's (docs/walks/WALK-2026-10-25-IN-AU.md): R12-R16 and G2/G4 here; R1-R11 and R17-R30 are proven headless (the api pack) because they are rails and rounds, not screens.
// ONE CONFIG: topology, shops and bindings come from the api repo's tests/crossing/topology.json (e2e/lib/crossing.cjs reads it from CB_API_DIR). One browser CONTEXT per shop, on that shop's installation origin.
// OFF BY DEFAULT: needs CB_CROSSING=1, the ssh key to the SIT VMs (the tester code is read from the VM into memory, never from a file) and the `crossing` project:
//     CB_CROSSING=1 CB_API_DIR=../wt-ctp-pack-api npx playwright test --project=crossing            (headless)
//     CB_CROSSING=1 CB_API_DIR=../wt-ctp-pack-api npx playwright test --project=crossing --headed   (watch it)
// One playwright invocation at a time. The specs create only tagged chits ("[CTPX <run>]"), delete nothing, and change no shop setting (R13 cancels its confirm).
// FIXME = a screen that does not exist yet (or a known-open finding): kept as test.fixme with the finding id so it turns into a real test the day the screen lands; nothing is faked.
// @type: system
const { test, expect } = require('@playwright/test');
const X = require('../lib/crossing.cjs');

const WHY_OFF = X.skipReason();
test.skip(!!WHY_OFF, WHY_OFF || '');
test.describe.configure({ mode: 'serial' });

const MONEY_WORD = { INR: /₹|INR|Rs/, AUD: /A\$|AUD/, DKK: /kr|DKK/, HUF: /Ft|HUF/ };
const RUN = 'x' + Date.now().toString(36);
const TAG = '[CTPX ' + RUN + ']';
const SETTLE = { timeout: 45000 };

/** the supplier row the buyer's list holds for the seller (added by address through the api, as the screen's Add does) */
async function supplierRow(buyerKey, sellerKey) {
  const { topo, flow } = X.pack();
  const buyer = await X.signedIn(buyerKey);
  const seller = Object.assign({ key: sellerKey }, topo.shops[sellerKey]);
  const ctx = { topo };
  await buyer.post('/api/relationships/suppliers', { supplier_bridge_id: flow.addressOf(ctx, buyer, seller) });
  const stub = await flow.findSupplier(buyer, seller);
  expect(stub, 'the seller is not in ' + buyerKey + '\'s supplier list after adding it by address').toBeTruthy();
  return { stub, seller };
}

/** open the buyer's Suppliers, pick the seller, wait for the catalogue to settle, add one item. → { page, context, seller } */
async function browseAndAdd(browser, buyerKey, sellerKey) {
  const { stub, seller } = await supplierRow(buyerKey, sellerKey);
  const opened = await X.openAs(browser, buyerKey);
  const page = opened.page;
  await page.getByTestId('nav-suppliers').click();
  await page.getByTestId('sup-row-' + stub.supplier_list_id).click();
  await expect.poll(async () => page.locator('#sup_body [data-testid="cart-add"]').count(), { timeout: 60000, message: 'the remote catalogue showed no item to add' }).toBeGreaterThan(0);
  let prev = -1;
  await expect.poll(async () => { const n = await page.locator('#sup_body *').count(); const same = n === prev; prev = n; return same; }, { timeout: 20000, intervals: [400, 400, 400] }).toBe(true);
  await page.locator('#sup_body [data-testid="cart-add"]').first().click();
  await expect(page.locator('[data-testid^="cart-count-"]').first()).toBeVisible();
  return { page, context: opened.context, seller };
}

const nextStep = (page) => page.locator('#sup_foot [data-testid^="step-next-"]');

test.describe('Crossing · screens (IN <-> AU, Grundfos)', () => {
  test('[CTPX-R14] the remote catalogue and the cart bar read in the SELLER\'s currency (IN buys from AU)', async ({ browser }) => {
    const { page, context, seller } = await browseAndAdd(browser, 'chennai', 'sydney');
    try {
      const word = MONEY_WORD[seller.currency];
      await expect(page.locator('#sup_body'), 'the catalogue prices are not in ' + seller.currency).toContainText(word, SETTLE);
      await expect(page.locator('#cbcartbar_sup'), 'the cart bar shows the buyer\'s money instead of ' + seller.currency).toContainText(word, SETTLE);
      await expect(page.locator('#sup_body'), 'the buyer\'s own symbol leaked into the seller\'s catalogue').not.toContainText(/₹\s?\d/);
    } finally {
      await context.close();
    }
  });

  test('[CTPX-R16] Review says "they reprice on receipt" in the seller\'s money; the order sent states that currency', async ({ browser }) => {
    const { page, context, seller } = await browseAndAdd(browser, 'chennai', 'sydney');
    try {
      await nextStep(page).click(); // Check out -> Details
      await page.getByTestId('sup-subject').fill(TAG + ' R16 order from the screen');
      await nextStep(page).click(); // Details -> Review
      await expect(page.locator('#sup_body'), 'the review lost the "this is a request" wording').toContainText(/They reprice on receipt/, SETTLE);
      await expect(page.locator('#sup_body'), 'the review is not in ' + seller.currency).toContainText(MONEY_WORD[seller.currency]);
      const sending = page.waitForRequest((r) => /\/api\/chits\/send$/.test(r.url()) && r.method() === 'POST');
      const answered = page.waitForResponse((r) => /\/api\/chits\/send$/.test(r.url()) && r.request().method() === 'POST');
      await nextStep(page).click(); // Send order
      const body = JSON.parse((await sending).postData() || '{}');
      expect(body.purpose, 'the order is purpose order').toBe('order');
      expect(body.business_json && body.business_json.currency, 'the send must STATE the cart\'s currency (W24 / UX-121)').toBe(seller.currency);
      const reply = await answered;
      expect(reply.status(), 'the send answered ' + reply.status()).toBeLessThan(300);
      const chitId = (await reply.json()).chit_id;
      expect(chitId, 'the send answered no chit id').toBeTruthy();
      const sellerApi = await X.signedIn('sydney');
      await expect.poll(async () => (await sellerApi.get('/api/chits/' + chitId)).status, { timeout: 120000, intervals: [3000], message: 'the order never reached the seller\'s installation' }).toBe(200);
    } finally {
      await context.close();
    }
  });

  test('[CTPX-G2] same installation, other currency: the INR plant sees the HUF supplier\'s catalogue and cart in HUF', async ({ browser }) => {
    const { page, context, seller } = await browseAndAdd(browser, 'grund-plant', 'grund-hu');
    try {
      await expect(page.locator('#sup_body')).toContainText(MONEY_WORD[seller.currency], SETTLE);
      await expect(page.locator('#cbcartbar_sup')).toContainText(MONEY_WORD[seller.currency], SETTLE);
    } finally {
      await context.close();
    }
  });

  test('[CTPX-G4c] across installations: the AUD buyer sees the DKK exporter\'s catalogue and cart in DKK', async ({ browser }) => {
    const { page, context, seller } = await browseAndAdd(browser, 'sydney', 'grund-hq');
    try {
      await expect(page.locator('#sup_body')).toContainText(MONEY_WORD[seller.currency], SETTLE);
      await expect(page.locator('#cbcartbar_sup')).toContainText(MONEY_WORD[seller.currency], SETTLE);
    } finally {
      await context.close();
    }
  });

  test('[CTPX-G4b] the Where picker on another installation lists only exporters', async ({ browser }) => {
    const { topo, flow } = X.pack();
    const opened = await X.openAs(browser, 'sydney');
    const page = opened.page;
    try {
      await page.getByTestId('nav-suppliers').click();
      const where = page.getByTestId('sup-where');
      await expect(where, 'the Where picker did not offer another installation').toBeVisible({ timeout: 30000 });
      await where.selectOption(flow.dbKeyOf({ topo }, 'sit-grund'));
      await page.getByTestId('sup-add-input').fill('Grundfos');
      await expect.poll(async () => page.locator('.ccsugg-item').count(), { timeout: 30000, message: 'the search listed nobody' }).toBeGreaterThan(0);
      const shown = (await page.locator('.ccsugg-item .ccsugg-nm').allTextContents()).join(' | ');
      expect(shown, 'a shop that does not sell outside its own ChitBridge is listed').not.toMatch(/Gyor|Plant Chennai|No-Context/i);
      const api = await X.signedIn('sydney');
      const listed = ((await api.get('/api/entities/search?q=Grundfos&where=' + encodeURIComponent(flow.dbKeyOf({ topo }, 'sit-grund')))).body.results || []).map((r) => r.display_name);
      expect(listed.length, 'the api listed nobody either').toBeGreaterThan(0);
      for (const name of listed) expect(shown, 'the screen hides "' + name + '" which the api lists').toContain(name);
    } finally {
      await opened.context.close();
    }
  });

  test('[CTPX-R15] a shop that sells only on its own ChitBridge cannot be added from another installation: the refusal sentence', async ({ browser }) => {
    const { topo, flow } = X.pack();
    const opened = await X.openAs(browser, 'sydney');
    const page = opened.page;
    try {
      const buyer = await X.signedIn('sydney');
      const hu = Object.assign({ key: 'grund-hu' }, topo.shops['grund-hu']);
      await page.getByTestId('nav-suppliers').click();
      await page.getByTestId('sup-add-input').fill(flow.addressOf({ topo }, buyer, hu));
      await page.getByTestId('sup-add').click();
      const confirm = page.getByTestId('confirm-ok');
      if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();
      await expect(page.getByText(/sells only on their own ChitBridge, so they cannot be your supplier from here/), 'the refusal sentence is not on the screen').toBeVisible({ timeout: 30000 });
    } finally {
      await opened.context.close();
    }
  });

  test('[CTPX-R13] Settings > Your business > Selling abroad: it is on, Save asks for a confirm, Cancel changes nothing', async ({ browser }) => {
    const opened = await X.openAs(browser, 'sydney');
    const page = opened.page;
    try {
      await page.getByTestId('icon-avatar').click();
      await page.getByTestId('nav-settings').click();
      await page.getByTestId('set-sec-business').click();
      const box = page.getByTestId('biz-abroad-on');
      await expect(box, 'Selling abroad is not on for the exporter').toBeChecked({ timeout: 30000 });
      await box.uncheck();
      await page.getByTestId('biz-abroad-save').click();
      await expect(page.getByTestId('confirm-ok'), 'Save did not ask for a confirm').toBeVisible();
      await expect(page.locator('#modalhost')).toContainText(/Stop showing my shop outside your own ChitBridge/);
      await page.getByTestId('confirm-cancel').click(); // never saves
      const who = await X.signedIn('sydney');
      const profile = await who.get('/api/governance/profile');
      expect(profile.body.trade_mode, 'cancelling the confirm must leave trade_mode export').toBe('export');
    } finally {
      await opened.context.close();
    }
  });
});

test.describe('Crossing · screens that do not exist yet or are known open (kept as fixme, not faked)', () => {
  test.fixme('[CTPX-R17..R22] the rounds screen: a priced round, accept / counter / reject, "quotation" wording — WALK-10-25 W25', async () => {
    // Today the rounds are driven only through /api/chits/:id/proposals (api pack R17-R22, R28, G3, G4e-f). When the screen lands:
    // the seller prices a round, the buyer sees "Quotation" with the seller's money, Counter takes TEXT (money stays null), Accept makes it a pro-forma on both screens.
  });
  test.fixme('[CTPX-R21] the step tracker for a cross-installation order (request -> quotation -> pro-forma) — WALK-10-25 W25', async () => {});
  test.fixme('[CTPX-R16c] a confirm before the FIRST cross-installation send names the other installation and says "they reprice" — WALK-10-25 (open, web)', async () => {});
  test.fixme('[CTPX-G3] a web switch for "Ask for a quote" (deal_type rfq) on a same-installation order — WALK-10-25 W25', async () => {});
  test.fixme('[CTPX-R8] a message the far side has not confirmed is marked unconfirmed on the sender\'s screen — WALK-10-25 W18 (the api answers ctp_unconfirmed; app.html never reads it)', async () => {});
  test.fixme('[CTPX-R1] an open chit repaints when the far side\'s status arrives — WALK-10-25 W14', async () => {});
});
