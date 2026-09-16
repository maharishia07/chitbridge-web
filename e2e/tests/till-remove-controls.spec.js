// [TILL-09] THE × THAT DID NOT REMOVE. Athi, 2026-09-16: *"two bill just saved, but when I click the x mark it
// is not getting removed."*
//
// ⚠️ THERE ARE TWO × CONTROLS HE COULD MEAN and guessing between them is how a wrong fix ships. A cart LINE has
// one (drop) and a SAVED — parked — bill has one (dropParked). This drives both through the real page and says
// which of them actually fails, so the fix is aimed at the broken one rather than at the likelier-sounding one.
const { test, expect } = require('@playwright/test');
const { mintEntity, addProduct } = require('../fixtures');

// ⭐ the COUNTER page can be pointed at a local build while the app it mints its key from stays where it
// is — the only way to prove a counter fix that is not deployed yet. CB_TILL_BASE=http://localhost:8941
const TILL = process.env.CB_TILL_BASE || '';

test('[TILL-09] both × controls remove what they sit on', async ({ page, context }) => {
  test.setTimeout(420000);
  await mintEntity(page, { fresh: true, name: 'Rm ' + Date.now().toString().slice(-6) });
  await addProduct(page, { name: 'Ponni rice 1 kg', unit: 'kg', price: 62, code: 'RICE9' });
  await addProduct(page, { name: 'Filter coffee 200 g', unit: 'packet', price: 145, code: 'COF9' });

  let till;
  await test.step('pair a counter', async () => {
    const key = await page.evaluate(async () => {
      if (typeof ensureCap === 'function') await ensureCap('admin');
      const r = await api('keysMint', { body: { name: 'rm counter', scopes: ['till'], days: 1 } });
      return (r && (r.key || r.api_key)) || null;
    });
    expect(key, 'no till key was minted').toBeTruthy();
    till = await context.newPage();
    await till.goto(TILL + '/till.html#key=' + encodeURIComponent(key));
    await till.waitForFunction(() => window.CBOffers && window.CBTax, null, { timeout: 40000 });
    await till.evaluate(() => refresh());
    await till.waitForSelector('[data-testid="till-hit-0"]', { timeout: 40000 });
  });

  await test.step('⭐ a cart line’s × removes THAT line', async () => {
    await till.evaluate(() => { add(0); add(1); });
    await expect(till.locator('[data-testid="till-line-1"]')).toBeVisible();
    const before = await till.evaluate(() => CART.map((c) => c.name));
    /* the control, driven the way a person drives it — the button, not the function behind it */
    await till.locator('[data-testid="till-line-0"] button.x').click();
    await till.waitForTimeout(250);
    const after = await till.evaluate(() => CART.map((c) => c.name));
    expect(after.length, 'the cart × left the line where it was: ' + JSON.stringify(before) + ' → ' + JSON.stringify(after)).toBe(before.length - 1);
    expect(after).not.toContain(before[0]);
  });

  await test.step('⭐⭐ a SAVED (parked) bill’s × throws that bill away', async () => {
    /* two saved bills, which is exactly what he had on screen */
    await till.evaluate(() => { CART = []; add(0); parkBill(); add(1); parkBill(); });
    await till.waitForTimeout(250);
    await expect(till.locator('[data-testid="till-parked-1"]')).toBeVisible();
    const before = await till.evaluate(() => PARKED.length);
    expect(before, 'two bills should be parked').toBe(2);

    /* ⚠️ the × is a SPAN INSIDE the chip button — clicking it must throw the bill away and must NOT bring it back */
    await till.locator('[data-testid="till-parked-0"] span').click();
    await till.waitForTimeout(300);
    const after = await till.evaluate(() => ({ parked: PARKED.length, cart: CART.length }));
    expect(after.parked, 'the parked × did not remove the bill').toBe(1);
    expect(after.cart, 'the parked × brought the bill back into the cart instead of throwing it away').toBe(0);

    /* and it must survive a reload — a removal that only repaints is not a removal */
    const stored = await till.evaluate(() => JSON.parse(localStorage.getItem(shopLs('cb_till_parked')) || '[]').length);
    expect(stored, 'the removal was not written to this device').toBe(1);
  });
});

// ⚠️⚠️ THE ACTUAL FAULT OF 2026-09-16, kept as a case. The × was never broken. `parkedSave()` serialised the
// whole rail in the ARGUMENT to a storage call, so one parked cart that would not stringify threw before the
// repaint — the chip stayed, the removal was never written, and `ls.set` swallowed its own failure so nothing
// said a word. Athi: *"other parked bills are removed, but this two got stuck."*
test('[TILL-10] one unsaveable parked bill does not wedge the rail, and a failed write is spoken aloud', async ({ page, context }) => {
  test.setTimeout(420000);
  await mintEntity(page, { fresh: true, name: 'Wedge ' + Date.now().toString().slice(-6) });
  await addProduct(page, { name: 'Sugar 1 kg', unit: 'kg', price: 44, code: 'SUG9' });

  const key = await page.evaluate(async () => {
    if (typeof ensureCap === 'function') await ensureCap('admin');
    const r = await api('keysMint', { body: { name: 'wedge counter', scopes: ['till'], days: 1 } });
    return (r && (r.key || r.api_key)) || null;
  });
  const till = await context.newPage();
  await till.goto(TILL + '/till.html#key=' + encodeURIComponent(key));
  await till.waitForFunction(() => window.CBOffers && window.CBTax, null, { timeout: 40000 });
  await till.evaluate(() => refresh());
  await till.waitForSelector('[data-testid="till-hit-0"]', { timeout: 40000 });

  await test.step('⭐⭐ a circular cart is dropped by name instead of jamming every other bill', async () => {
    await till.evaluate(() => {
      CART = []; add(0); parkBill();
      CART = []; add(0); parkBill();
      /* ⚠️ a row JSON.stringify genuinely REFUSES. An earlier version of this case set a property on the cart
         ARRAY, which stringify silently ignores — the case passed while testing nothing at all. */
      PARKED[0].name = 'Poison';
      PARKED[0].cart = [{ name: 'x', qty: 1, price: 1, net: 1,
                          toJSON: function(){ throw new Error('will not serialise'); } }];
    });
    /* removing the OTHER bill must still work, and must reach the device */
    await till.evaluate(() => dropParked(1));
    await till.waitForTimeout(250);
    const after = await till.evaluate(() => ({
      mem: PARKED.length,
      stored: JSON.parse(localStorage.getItem(shopLs('cb_till_parked')) || '[]').length,
    }));
    /* the poison row is dropped too — but the rail is NOT wedged and the write did happen */
    expect(after.mem, 'the rail was wedged by one bad row').toBeLessThanOrEqual(1);
    expect(after.stored, 'the removal never reached the device').toBe(after.mem);
  });

  await test.step('⚠️ and a storage that refuses is reported, not swallowed', async () => {
    const said = await till.evaluate(() => {
      /* ⚠️ Storage has a NAMED-PROPERTY SETTER: `localStorage.setItem = fn` quietly stores the string "fn"
         under the key "setItem" instead of shadowing the method. The prototype is the only place to stand. */
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k) {
        if (String(k).indexOf('cb_probe') === 0) return real.apply(this, arguments);
        const e = new Error('full'); e.name = 'QuotaExceededError'; throw e;
      };
      const ok = ls.set('cb_till_probe_write', 'x');
      Storage.prototype.setItem = real;
      return { ok, why: ls.last && ls.last.why };
    });
    expect(said.ok, 'ls.set claimed a write that never happened').toBe(false);
    expect(said.why, 'the failure was not recorded anywhere').toBe('QuotaExceededError');
  });
});
